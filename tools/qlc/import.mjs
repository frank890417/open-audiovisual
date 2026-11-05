// A QLC+ input profile as one of ours, or as what it adds to one we already have. Pure: text in, data out. tools/import-qlc.mjs does the files.
//
// QLC+ describes each input by number, name and type, with LED values and a colour table where a contributor added them. It has no
// faceplate, so a new profile gets a generated one and says so (face.auto). Nothing here has been checked on a unit by this project, so every
// control is verified: false, and every file names the .qxi and the commit it came from. The data stays under QLC+'s Apache-2.0: see NOTICE.

import { parseQxi, decodeQlcNumber } from './qxi.mjs';

export const QLC_REPO = 'https://github.com/mcallegari/qlcplus';
const RESERVED = new Set(['last', 'raw', 'delta', 'hit', 'on', 'off', 'pressure']);
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/** Not a MIDI controller: another protocol, or QLC+'s own virtual layouts. */
export const SKIP = {
  'Enttec-PlaybackWing.qxi': 'not MIDI (Enttec wing protocol)', 'Enttec-ShortcutWing.qxi': 'not MIDI (Enttec wing protocol)',
  'Lemur-iPadStudioCombo.qxi': 'OSC, not MIDI', 'TouchOSC-Automat5.qxi': 'OSC, not MIDI', 'TouchOSC-Mix16.qxi': 'OSC, not MIDI',
  'Logitech-WingManAttack2.qxi': 'HID, not MIDI', 'Generic-MIDI.qxi': 'a generic table, not a device', 'Mixxx-MIDI.qxi': 'a software link to Mixxx, not a device',
};
/** Devices this project already models: their file gets only what it lacks. */
export const EXISTING = {
  'Akai-APC40-mkII.qxi': 'akai-apc40-mk2', 'Akai-APCMini-mk2.qxi': 'akai-apc-mini-mk2', 'KORG-nanoKONTROL2.qxi': 'korg-nanokontrol2',
  'Novation-LaunchControlXL.qxi': 'novation-launch-control-xl-mk2', 'Novation-LaunchPadMiniMK3.qxi': 'novation-launchpad-mini-mk3',
};
/** The spelling this project already uses for a maker. */
const MAKERS = { Akai: 'AKAI Professional', Korg: 'KORG', 'ADJ': 'American DJ' };
/** A model name too long for a page title. */
const MODELS = { 'BCF2000 in Mackie Control Mode': 'BCF2000 (Mackie mode)' };

const sourceOf = (file, q, commit) => ({
  title: `QLC+ input profile ${file} (non-official)`,
  url: `${QLC_REPO}/blob/${commit}/resources/inputprofiles/${file}`,
  note: `community profile by ${q.creator.author || 'a QLC+ contributor'}; Apache-2.0; numbers read from QLC+ channel numbers, not checked by this project`,
  license: 'Apache-2.0',
});
const paletteOf = (q, source) => (q.colors.length ? {
  cite: { source },
  ...(q.midiChannels.length ? { channels: q.midiChannels.map((c) => ({ ch: c.value + 1, name: c.label })) } : {}),
  // .qxi values are 8-bit; what goes on the wire is half (MIDI2DMX in QLC+)
  colors: dedupe(q.colors.map((c) => ({ value: Math.min(127, c.value >> 1), name: c.label, rgb: c.rgb.toLowerCase() }))),
} : undefined);
function dedupe(colors) { const seen = new Set(); return colors.filter((c) => (seen.has(c.value) ? false : seen.add(c.value))); }
const ledOf = (c, msg) => (c.feedback ? { msg: msg.msg === 'note' ? 'note' : 'cc', on: Math.min(127, c.feedback.upper >> 1), off: Math.min(127, c.feedback.lower >> 1), ...(c.feedback.midiChannel !== undefined ? { ch: c.feedback.midiChannel + 1 } : {}) } : null);

/** What each QLC+ channel becomes; `chan` is where a number with no channel of its own goes. */
function controlOf(c, used) {
  const m = decodeQlcNumber(c.number);
  if (!['cc', 'note', 'pitchbend', 'chanat'].includes(m.msg)) return null;
  let base = slug(c.name) || `c${c.number}`, id = RESERVED.has(base) ? `${base}-c` : base;
  for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
  used.add(id);
  const isPad = /\bpad\b|^pad\d/i.test(c.name);
  const type = { Slider: 'fader', Knob: 'knob', Encoder: 'encoder' }[c.type] || (isPad ? 'pad' : 'button');
  const out = { id, type: m.msg === 'pitchbend' && type === 'button' ? 'fader' : type, msg: m.msg, ch: m.ch ?? 1 };
  if (m.msg === 'cc') out.cc = m.cc;
  if (m.msg === 'note') out.note = m.note;
  if (out.type === 'encoder') out.relative = false;   // a .qxi does not say how an encoder counts
  if (out.type === 'pad' && m.msg === 'chanat') out.type = 'button';
  const led = m.msg === 'cc' || m.msg === 'note' ? ledOf(c, m) : null;
  return { ...out, label: c.name, verified: false, ...(led ? { led } : {}) };
}

const HEIGHT = { fader: 16, knob: 9, encoder: 9, pad: 9, button: 5.5 };
const TITLE = { fader: 'Faders', knob: 'Knobs', encoder: 'Encoders', pad: 'Pads', button: 'Buttons' };
/** A plain faceplate from a list of controls: one block per type, in rows of at most 16. */
export function autoLayout(controls, label) {
  const sections = []; let y = 3;
  for (const type of ['fader', 'knob', 'encoder', 'pad', 'button']) {
    const list = controls.filter((c) => c.type === type);
    if (!list.length) continue;
    const cols = list.length <= 8 ? list.length : list.length <= 64 ? 8 : 16, rows = Math.ceil(list.length / cols), h = rows * HEIGHT[type];
    sections.push({ id: type, label: TITLE[type], x: 2, y, w: 96, h, cols, rows, controls: list.map((c) => c.id) });
    y += h + 3;
  }
  return { face: { w: 100, h: y, label, auto: true }, sections };
}

/** A .qxi as a new profile. The caller checks `id` and `short` against what exists. */
export function profileFromQxi(xml, { file, commit, date }) {
  const q = parseQxi(xml), used = new Set();
  const maker = MAKERS[q.manufacturer] || q.manufacturer, model = MODELS[q.model] || q.model;
  const controls = [];
  const seen = new Set();
  for (const c of q.channels) {
    const x = controlOf(c, used); if (!x) continue;
    const key = `${x.msg}:${x.ch}:${x.cc ?? x.note ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key); controls.push(x);
  }
  const noChannel = q.channels.some((c) => decodeQlcNumber(c.number).ch === null) && controls.some((c) => c.ch === 1);
  const id = slug(`${q.manufacturer} ${model}`), short = slug(model).replace(/-/g, '') || id;
  const { face, sections } = autoLayout(controls, `${maker} ${model}`);
  const source = sourceOf(file, q, commit), palette = paletteOf(q, 0);
  return {
    id, short, name: `${maker} ${model}`, maker, kind: 'device', license: 'Apache-2.0', channel: 1,
    match: { ports: [model.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/[\s-]+/g, '[\\s-]*')], prefer: [], avoid: [] },
    origin: { tool: 'QLC+', repo: QLC_REPO, commit, file: `resources/inputprofiles/${file}`, license: 'Apache-2.0', author: q.creator.author, note: `Imported from QLC+ on ${date}.` },
    sources: [source],
    notes: `Imported from QLC+. The messages are what its community profile lists; nobody has checked them on a unit for this project, so every control is unverified. QLC+ has no faceplate data, so the layout was generated from the list of controls and does not look like the device.${noChannel ? ' QLC+ numbers these controls without a MIDI channel, so channel 1 here is a placeholder: the unit may send on another.' : ''}`,
    ...(palette ? { palette } : {}),
    face, sections, controls,
  };
}

/** What a .qxi adds to a profile we already have: the palette, and LEDs on controls that have none. Numbers we have are never changed. */
export function enrichFromQxi(profile, xml, { file, commit }) {
  const q = parseQxi(xml), p = JSON.parse(JSON.stringify(profile)), added = { palette: false, leds: [] }, disagree = [];
  const ch0 = p.channel ?? 1;
  const keyOf = (c) => `${c.msg}:${c.msg === 'cc' ? c.cc : c.note ?? ''}`;
  const byMessage = new Map();
  for (const c of q.channels) { const m = decodeQlcNumber(c.number); if (m.msg === 'cc' || m.msg === 'note') (byMessage.get(`${m.msg}:${m.cc ?? m.note}`) || byMessage.set(`${m.msg}:${m.cc ?? m.note}`, []).get(`${m.msg}:${m.cc ?? m.note}`)).push({ ...c, m }); }
  const already = p.sources.findIndex((s) => s.title === sourceOf(file, q, commit).title);
  const source = already >= 0 ? already : p.sources.length;
  for (const c of p.controls) {
    if (c.type === 'keys' || c.led) continue;
    const hit = (byMessage.get(keyOf(c)) || []).find((x) => x.m.ch === null || x.m.ch === (c.ch ?? ch0));
    if (hit?.feedback) { c.led = ledOf(hit, hit.m); added.leds.push(c.id); }
  }
  for (const c of q.channels) {
    const m = decodeQlcNumber(c.number); if (m.msg !== 'cc' && m.msg !== 'note') continue;
    if (!p.controls.some((x) => x.type !== 'keys' && keyOf(x) === `${m.msg}:${m.cc ?? m.note}` && (m.ch === null || (x.ch ?? ch0) === m.ch))) disagree.push(`${c.name}: ${m.msg} ${m.cc ?? m.note}${m.ch ? ` ch ${m.ch}` : ''}`);
  }
  if (!p.palette) { const pal = paletteOf(q, source); if (pal) { p.palette = pal; added.palette = true; } }
  if ((added.palette || added.leds.length) && already < 0) p.sources.push(sourceOf(file, q, commit));
  return { profile: p, added, disagree };
}
