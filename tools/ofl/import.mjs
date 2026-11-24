// An Open Fixture Library fixture as one of ours (open-audiovisual/fixture@1). Pure: parsed JSON in, data out. tools/import-ofl.mjs does the files.
//
// OFL (https://github.com/OpenLightingProject/open-fixture-library, MIT) describes each channel by what its DMX ranges do
// ("capabilities"). This keeps what the engine needs (the channel's job, its default, the open and strobe ranges, Hz only where
// OFL gives Hz) and leaves the rest. Nothing here has been checked on a light by this project: every file says verified: false
// and names the OFL file and commit it came from. The data stays under OFL's MIT licence: see NOTICE.
//
// Rules worth knowing before reading the code:
//   • A channel with any Maintenance capability (reset, lamp on/off) becomes "control", whatever else it does: those are
//     the values that must never be reached by a fader or an effect.
//   • A channel with any strobe capability becomes "strobe", even when part of it is a dimmer: written as a dimmer, the top of
//     its range would start strobing with nobody asking (and with no cap). The engine only ever writes its open value or a
//     value inside its strobe range.
//   • Otherwise, a channel with any Effect capability (built-in programs, sound-active modes) becomes "control": those hand the
//     light to the fixture's own show, which no flash cap reaches.
//   • Hz is kept only when OFL writes Hz ("0Hz" … "20Hz"). "slow" and "fast" are never turned into numbers: without Hz the
//     engine keeps the channel open under the flash cap.
//   • 16-bit (one fine channel) is kept. A mode that needs a 24-bit channel (fine^2) is left out and listed in `skipped`.
//   • Matrix, template and switching channels are refused with an error, not guessed: a wrong guess is a wrong address.
//     (OFL writes a switch on a capability, `switchChannels`, and names the switched alias in the mode: both are refused.)
//   • A wheel slot keeps the name OFL's wheel gives it ("Red", "Open", "Gobo 3"); a slot between two is "Red / Green".
//   • The manual and product page the OFL file links to are kept as sources, marked as not read by this project.

import { FORMAT } from '../../packages/dmx/fixture.js';

export const OFL_REPO = 'https://github.com/OpenLightingProject/open-fixture-library';

const COLOR = {
  Red: 'red', Green: 'green', Blue: 'blue', White: 'white', 'Warm White': 'warmWhite', 'Cold White': 'coldWhite',
  Amber: 'amber', UV: 'uv', Cyan: 'cyan', Magenta: 'magenta', Yellow: 'yellow', Lime: 'lime', Indigo: 'indigo',
};
const KIND = {
  Dimmer: 'dimmer', 'Color Changer': 'par', Blinder: 'par', 'Pixel Bar': 'bar', Strobe: 'strobe', 'Moving Head': 'moving-head',
  Scanner: 'scanner', 'Barrel Scanner': 'scanner', Laser: 'effect', Smoke: 'effect', Hazer: 'effect', Fan: 'effect', Effect: 'effect', Flower: 'effect',
};
const SAME = { Intensity: 'intensity', Pan: 'pan', Tilt: 'tilt', Zoom: 'zoom', Focus: 'focus', Speed: 'speed', PanTiltSpeed: 'speed', EffectSpeed: 'speed', StrobeSpeed: 'speed' };
const STROBY = new Set(['Strobe', 'Pulse', 'RampUp', 'RampDown', 'RampUpDown', 'Lightning', 'Spikes', 'Burst']);

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const lowerFirst = (s) => s.charAt(0).toLowerCase() + s.slice(1);
function keyOf(name, used) {
  const words = String(name).replace(/\^/g, ' ').split(/[^A-Za-z0-9]+/).filter(Boolean);
  let k = words.map((w, i) => (i ? w.charAt(0).toUpperCase() + w.slice(1) : w.charAt(0).toLowerCase() + w.slice(1))).join('') || 'channel';
  if (!/^[A-Za-z]/.test(k)) k = 'c' + k;
  let out = k;
  for (let n = 2; used.has(out); n++) out = `${k}${n}`;
  used.add(out);
  return out;
}
const hzOf = (s) => { const m = /^(\d+(?:\.\d+)?)Hz$/.exec(String(s ?? '')); return m ? Number(m[1]) : null; };
const degOf = (s) => { const m = /^(-?\d+(?:\.\d+)?)deg$/.exec(String(s ?? '')); return m ? Number(m[1]) : null; };

function bitsOf(ch) {
  const r = /^(8|16|24)bit$/.exec(ch.dmxValueResolution || '');
  return r ? Number(r[1]) : 8 * (1 + (ch.fineChannelAliases || []).length);
}

/** What one OFL channel does, as our channel type (the strictest reading wins: control, then strobe). */
function typeOf(caps, name) {
  const types = caps.map((c) => c.type);
  if (types.includes('Maintenance')) return 'control';
  if (caps.some((c) => c.type === 'ShutterStrobe' && STROBY.has(c.shutterEffect))) return 'strobe';
  if (types.includes('Effect')) return 'control';
  const real = caps.filter((c) => c.type !== 'NoFunction');
  if (!real.length) return 'generic';
  const all = (t) => real.every((c) => c.type === t);
  if (all('ShutterStrobe')) return 'strobe';
  if (all('ColorIntensity') && new Set(real.map((c) => c.color)).size === 1 && COLOR[real[0].color]) return 'color';
  for (const [t, ours] of Object.entries(SAME)) if (all(t)) return ours;
  if (real.every((c) => /^Wheel/.test(c.type))) {
    const wheel = String(real[0].wheel || name);
    return /gobo/i.test(wheel) ? 'gobo' : /colou?r/i.test(wheel) ? 'colorWheel' : 'generic';
  }
  if (real.every((c) => c.type === 'Speed' || c.type === 'PanTiltSpeed' || c.type === 'EffectSpeed' || c.type === 'StrobeSpeed')) return 'speed';
  return 'generic';
}

/** What a wheel slot is called: its name in OFL's wheel, else its type and number; a fractional slot sits between two. */
function slotName(wheel, n) {
  const slots = (wheel && wheel.slots) || [];
  const one = (i) => { const x = slots[i - 1]; return x ? x.name || (x.type === 'Open' ? 'Open' : `${x.type || 'Slot'} ${i}`) : null; };
  if (typeof n !== 'number') return null;
  if (Number.isInteger(n)) return one(n);
  const a = one(Math.floor(n)), b = one(Math.ceil(n));
  return a && b ? `${a} / ${b}` : a || b;
}

/** One OFL capability's range, in 8-bit values, saying what it does. */
function rangeOf(c, bits, onStrobe, wheels = {}, channelName = '') {
  const shift = bits - 8;
  const [a, b] = c.dmxRange || [0, 2 ** bits - 1];
  let is;
  if (c.type === 'ShutterStrobe') is = c.shutterEffect === 'Open' ? 'open' : c.shutterEffect === 'Closed' ? 'closed' : STROBY.has(c.shutterEffect) ? 'strobe' : lowerFirst(c.shutterEffect || 'shutter');
  else if (c.type === 'NoFunction') is = onStrobe ? 'open' : 'none';
  else is = lowerFirst(c.type);
  const r = { from: a >> shift, to: b >> shift, is };
  if (is === 'strobe') {
    const lo = hzOf(c.speedStart ?? c.speed), hi = hzOf(c.speedEnd ?? c.speed);
    if (lo !== null && hi !== null) r.hz = [Math.min(lo, hi), Math.max(lo, hi)];
  }
  const wheel = /^Wheel/.test(c.type) ? wheels[c.wheel || channelName] || wheels[String(channelName).replace(/\s+(Rotation|Shake)$/i, '')] : null;
  const slot = c.type === 'WheelSlot' || c.type === 'WheelShake' ? (c.slotNumber !== undefined ? slotName(wheel, c.slotNumber) : c.slotNumberStart !== undefined ? [slotName(wheel, c.slotNumberStart), slotName(wheel, c.slotNumberEnd)].filter(Boolean).join(' → ') : null) : null;
  const label = c.effectName || c.comment || slot || (c.type === 'ShutterStrobe' ? c.shutterEffect : null);
  if (label) r.label = String(label);
  return r;
}

/** The default byte(s): OFL writes a number in the channel's resolution or a percentage. */
function defaultsOf(ch, bits, wide) {
  const d = ch.defaultValue;
  if (d === undefined) return { coarse: 0, fine: 0 };
  let frac16;
  if (typeof d === 'string') {
    const m = /^(\d+(?:\.\d+)?)%$/.exec(d);
    if (!m) throw new Error(`defaultValue ${JSON.stringify(d)} is neither a number nor a percentage`);
    frac16 = Math.round((Number(m[1]) / 100) * 65535);
  } else frac16 = bits >= 16 ? d >> (bits - 16) : d << (16 - bits);
  return wide ? { coarse: frac16 >> 8, fine: frac16 & 255 } : { coarse: frac16 >> 8, fine: 0 };
}

/**
 * An OFL fixture as an open-audiovisual/fixture@1 profile.
 * @param {object} ofl  the parsed OFL fixture JSON
 * @param {{ file: string, commit: string, manufacturer?: string, date?: string }} where  `file` is the path in the OFL
 *   repository (fixtures/<manufacturer>/<fixture>.json); `manufacturer` is the display name from OFL's manufacturers.json
 * @returns {{ fixture: object, skipped: string[] }}
 */
export function fixtureFromOfl(ofl, { file, commit, manufacturer, date } = {}) {
  const m = /^fixtures\/([a-z0-9-]+)\/([a-z0-9-]+)\.json$/.exec(file || '');
  if (!m) throw new Error(`file is the path in the OFL repository, fixtures/<manufacturer>/<fixture>.json (got ${file})`);
  if (!/^[0-9a-f]{40}$/.test(commit || '')) throw new Error('commit is the full 40-character OFL commit');
  const [, man, key] = m;
  if (ofl.matrix || ofl.templateChannels) throw new Error(`${file}: matrix and template channels are not supported`);
  const avail = ofl.availableChannels || {};
  for (const [n, ch] of Object.entries(avail)) {
    const caps = ch.capabilities || (ch.capability ? [ch.capability] : []);
    if (ch.switchChannels || caps.some((c) => c && c.switchChannels)) throw new Error(`${file}: "${n}" switches channels, which is not supported`);
  }

  // every name a mode can use → { kind: 'coarse' | 'fine' | 'fine2', of }
  const names = new Map();
  for (const [n, ch] of Object.entries(avail)) {
    names.set(n, { kind: 'coarse', of: n });
    (ch.fineChannelAliases || []).forEach((alias, i) => names.set(alias, { kind: i === 0 ? 'fine' : 'fine2', of: n }));
  }

  const skipped = [];
  const keptModes = [];
  for (const mode of ofl.modes || []) {
    const label = mode.shortName || mode.name;
    if (mode.channels.some((c) => c !== null && typeof c !== 'string')) throw new Error(`${file}: mode "${label}" inserts matrix channels, which is not supported`);
    const unknown = mode.channels.find((c) => c !== null && !names.has(c));
    if (unknown) throw new Error(`${file}: mode "${label}" uses "${unknown}", which is not a channel`);
    if (mode.channels.some((c) => c !== null && names.get(c).kind === 'fine2')) { skipped.push(`mode "${label}": needs a 24-bit channel (fine^2), which this format does not have`); continue; }
    keptModes.push(mode);
  }
  if (!keptModes.length) throw new Error(`${file}: no mode left to import (${skipped.join('; ')})`);

  // channels used by the kept modes, in the order OFL lists them
  const used = new Set(keptModes.flatMap((md) => md.channels.filter((c) => c !== null)));
  const coarseUsed = new Set([...used].map((c) => names.get(c).of));
  const keys = new Set(), keyFor = new Map(), channels = {}, notes = [];
  for (const [n, ch] of Object.entries(avail)) {
    if (!coarseUsed.has(n)) continue;
    const k = keyOf(n, keys);
    keyFor.set(n, k);
    const caps = ch.capabilities || (ch.capability ? [ch.capability] : []);
    if (!caps.length) throw new Error(`${file}: "${n}" has no capability`);
    const type = typeOf(caps, n);
    const bits = bitsOf(ch);
    const fineName = (ch.fineChannelAliases || [])[0];
    const wide = fineName !== undefined && used.has(fineName);
    const def = defaultsOf(ch, bits, wide);
    const c = { type };
    if (n !== k) c.name = n;
    if (type === 'color') c.color = COLOR[caps.find((x) => x.type === 'ColorIntensity').color];
    if (def.coarse) c.default = def.coarse;
    if ((type === 'pan' || type === 'tilt') && caps.length === 1) {
      const a = degOf(caps[0].angleStart), b = degOf(caps[0].angleEnd);
      if (a !== null && b !== null && a !== b) c.degrees = Math.abs(b - a);
    }
    if (caps.length > 1 || type === 'strobe') c.ranges = caps.map((x) => rangeOf(x, bits, type === 'strobe', ofl.wheels || {}, n));
    for (const x of caps) if (x.helpWanted) notes.push(`${n}: ${x.helpWanted}`);
    if (ch.helpWanted) notes.push(`${n}: ${ch.helpWanted}`);
    channels[k] = c;
    if (wide) {
      const fk = keyOf(fineName, keys);
      keyFor.set(fineName, fk);
      channels[fk] = { fineOf: k, ...(fk !== fineName ? { name: fineName } : {}), ...(def.fine ? { default: def.fine } : {}) };
    }
  }
  let spare = 0;
  const modeIds = new Set();
  const modes = keptModes.map((md) => {
    let id = slug(md.shortName || md.name) || 'mode';
    for (let n = 2; modeIds.has(id); n++) id = `${slug(md.shortName || md.name)}-${n}`;
    modeIds.add(id);
    const list = md.channels.map((c) => {
      if (c !== null) return keyFor.get(c);
      const k = keyOf(`unused ${++spare}`, keys);          // an empty slot in OFL: keeps every later address where it is
      channels[k] = { type: 'generic', name: 'no function' };
      return k;
    });
    return { id, name: md.name, channels: list };
  });

  const authors = (ofl.meta && ofl.meta.authors) || [];
  const modified = ofl.meta && ofl.meta.lastModifyDate;
  const links = ofl.links || {};
  const linked = [
    ...(links.manual || []).map((url) => ({ title: `${manufacturer || man} ${ofl.name}: manual`, url, note: 'linked from the OFL file; not read by this project' })),
    ...(links.productPage || []).map((url) => ({ title: `${manufacturer || man} ${ofl.name}: product page`, url, note: 'linked from the OFL file; not read by this project' })),
  ];
  const kind = ((ofl.categories || []).map((c) => KIND[c]).find(Boolean)) || 'other';
  const fixture = {
    format: FORMAT,
    id: man === 'generic' ? `ofl-generic-${key}` : `${man}-${key}`,      // ours are generic-*: OFL's generic ones must not take those ids
    manufacturer: manufacturer || man,
    name: ofl.name,
    kind,
    modes,
    channels,
    license: 'MIT',
    origin: {
      tool: 'Open Fixture Library', repo: OFL_REPO, commit, file, license: 'MIT',
      ...(authors.length ? { author: authors.join(', ') } : {}),
      note: `Imported from the Open Fixture Library${date ? ` on ${date}` : ''}${modified ? ` (the OFL file was last modified on ${modified})` : ''}.`,
    },
    sources: [{
      title: `Open Fixture Library ${file}`,
      url: `${OFL_REPO}/blob/${commit}/${file}`,
      note: `${authors.length ? `by ${authors.join(', ')}; ` : ''}MIT; channel jobs and ranges read from OFL's capabilities, not checked by this project`,
      license: 'MIT',
    }, ...linked],
    notes: [
      'Imported from the Open Fixture Library. Nobody has checked it on a light for this project.',
      ...(skipped.length ? [`Left out: ${skipped.join('; ')}.`] : []),
      ...(notes.length ? [`OFL asks for help: ${notes.join(' ')}`] : []),
    ].join(' '),
    verified: false,
    verifications: [],
  };
  return { fixture, skipped };
}
