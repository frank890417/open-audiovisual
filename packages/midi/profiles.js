// @openav/midi · profiles — a MIDI controller described as DATA.
//
// A profile is plain JSON (packages/midi/profiles/*.json): what the device looks
// like (faceplate sections in landscape, a stacked order for portrait), every
// control on it (type + the exact MIDI message it sends), LED feedback where the
// device accepts it, how to recognise its port name, and where each number came
// from (manufacturer manual, the artist's own TouchDesigner tool, or "learnable"
// when nobody has verified it). Pure logic, unit-tested.
//
//   { "id": "arturia-minilab3", "short": "minilab3", "name": "Arturia MiniLab 3",
//     "kind": "device", "match": { "ports": ["minilab\\s*3"], "avoid": ["din thru", "mcu"] },
//     "face": { "w": 100, "h": 36 },
//     "sections": [{ "id": "knobs", "x": 30, "y": 4, "w": 34, "h": 14, "cols": 4, "rows": 2,
//                    "controls": ["knob1", …], "portrait": { "cols": 4, "rows": 2, "weight": 2 } }],
//     "controls": [{ "id": "knob1", "type": "knob", "msg": "cc", "ch": 1, "cc": 74, "group": "knob" }, …] }
//
// Control types        what it sends (msg)                         signal midi/<short>/<id>
//   knob  fader         cc (absolute 0..127)                       0..1
//   encoder             cc, relative (see parse.js relativeDelta)  position 0..1 (+ /delta)
//   pad                 note (velocity; optional poly/chan pressure) velocity 0..1 while held (+ /hit pulse)
//   button              note or cc; mode momentary | toggle        0 / 1
//   keys                note range from..to                        /on /off pulses, n<note> while held
//   wheel  strip        cc or pitchbend; spring returns to rest    0..1, or −1..1 when bipolar

import { RELATIVE_MODES } from './parse.js?v=062bc76';

export const CONTROL_TYPES = ['knob', 'encoder', 'fader', 'pad', 'button', 'keys', 'wheel', 'strip'];
export const MSG_TYPES = ['cc', 'note', 'pitchbend', 'chanat', 'program'];
/** Names a control id may not take: they are signal suffixes or generic namespaces. */
export const RESERVED_IDS = ['last', 'raw', 'delta', 'hit', 'on', 'off', 'pressure'];
/** Names a profile `short` may not take: they are the generic midi/… families. */
export const RESERVED_SHORTS = ['cc', 'note', 'bend', 'ch', 'virtual', 'raw', 'clock'];

const ID_RE = /^[a-z0-9][a-z0-9_-]*$/;
const isInt = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;

/** Every problem with a profile, as human-readable strings ([] = valid). */
export function validateProfile(p) {
  const errs = [];
  if (!p || typeof p !== 'object') return ['profile must be an object'];
  if (!ID_RE.test(p.id || '')) errs.push(`id "${p.id}" must be lower-case [a-z0-9_-]`);
  if (!ID_RE.test(p.short || '')) errs.push(`short "${p.short}" must be lower-case [a-z0-9_-] (it becomes midi/<short>/…)`);
  else if (RESERVED_SHORTS.includes(p.short)) errs.push(`short "${p.short}" is reserved (generic midi/${p.short}/… family)`);
  if (!p.name) errs.push('missing name');
  if (!['device', 'generic'].includes(p.kind)) errs.push(`kind must be "device" or "generic"`);
  if (p.kind === 'device' && !(Array.isArray(p.sources) && p.sources.length)) errs.push('a device profile must cite at least one source');
  for (const s of p.sources || []) if (!s || !s.title) errs.push('every source needs a title');
  if (p.match) for (const k of ['ports', 'prefer', 'avoid']) for (const r of p.match[k] || []) { try { new RegExp(r, 'i'); } catch { errs.push(`match.${k}: bad regex "${r}"`); } }
  if (!p.face || !(p.face.w > 0 && p.face.h > 0)) errs.push('face.w / face.h must be positive');
  if (!Array.isArray(p.controls) || !p.controls.length) { errs.push('controls must be a non-empty array'); return errs; }

  const ids = new Set();
  const used = new Map(); // "cc:1:74" → control id (two controls on one message = ambiguous input)
  const claim = (key, id) => { if (used.has(key) && used.get(key) !== id) errs.push(`controls "${used.get(key)}" and "${id}" both listen to ${key}`); else used.set(key, id); };
  for (const [i, c] of p.controls.entries()) {
    const at = `controls[${i}]${c && c.id ? ` (${c.id})` : ''}`;
    if (!c || typeof c !== 'object') { errs.push(`${at}: must be an object`); continue; }
    if (!ID_RE.test(c.id || '')) errs.push(`${at}: id must be lower-case [a-z0-9_-]`);
    else if (RESERVED_IDS.includes(c.id)) errs.push(`${at}: id "${c.id}" is reserved`);
    else if (ids.has(c.id)) errs.push(`${at}: duplicate id`);
    ids.add(c.id);
    if (!CONTROL_TYPES.includes(c.type)) errs.push(`${at}: unknown type "${c.type}"`);
    if (!MSG_TYPES.includes(c.msg)) errs.push(`${at}: unknown msg "${c.msg}"`);
    const ch = c.ch ?? p.channel ?? 1;
    if (!isInt(ch, 1, 16)) errs.push(`${at}: ch must be 1..16`);
    if (c.type === 'keys') {
      if (c.msg !== 'note') errs.push(`${at}: keys send notes`);
      if (!isInt(c.from, 0, 127) || !isInt(c.to, 0, 127) || c.to < c.from) errs.push(`${at}: keys need from ≤ to within 0..127`);
      else for (let n = c.from; n <= c.to; n++) claim(`note:${ch}:${n}`, c.id);
    } else if (c.msg === 'cc') {
      if (!isInt(c.cc, 0, 127)) errs.push(`${at}: cc must be 0..127`);
      else claim(`cc:${ch}:${c.cc}`, c.id);
    } else if (c.msg === 'note') {
      if (!isInt(c.note, 0, 127)) errs.push(`${at}: note must be 0..127`);
      else claim(`note:${ch}:${c.note}`, c.id);
    } else if (c.msg === 'pitchbend' || c.msg === 'chanat') claim(`${c.msg}:${ch}`, c.id);
    if (c.type === 'encoder' && c.msg === 'cc' && c.relative !== false && !RELATIVE_MODES.includes(c.relative)) errs.push(`${at}: encoder needs relative ∈ ${RELATIVE_MODES.join('|')} (or false for absolute)`);
    if (c.type === 'pad' && c.msg !== 'note' && c.msg !== 'cc') errs.push(`${at}: pads send note or cc`);
    if (c.mode && !['momentary', 'toggle'].includes(c.mode)) errs.push(`${at}: mode must be momentary or toggle`);
    if (c.led) {
      if (!['note', 'cc'].includes(c.led.msg)) errs.push(`${at}: led.msg must be note or cc`);
      if (c.led.msg === 'note' && !isInt(c.led.note ?? c.note, 0, 127)) errs.push(`${at}: led note`);
      if (c.led.msg === 'cc' && !isInt(c.led.cc ?? c.cc, 0, 127)) errs.push(`${at}: led cc`);
    }
  }
  // the faceplate (landscape) and the optional portrait arrangement must each show every control once
  const checkLayout = (list, where, face) => {
    const placed = new Set();
    for (const [i, s] of (list || []).entries()) {
      const at = `${where}[${i}]${s && s.id ? ` (${s.id})` : ''}`;
      if (!s || !ID_RE.test(s.id || '')) errs.push(`${at}: id must be lower-case [a-z0-9_-]`);
      if (face) {
        for (const k of ['x', 'y', 'w', 'h']) if (typeof s[k] !== 'number') errs.push(`${at}: ${k} must be a number (face units)`);
        if (s.x + s.w > p.face.w + 1e-6 || s.y + s.h > p.face.h + 1e-6 || s.x < 0 || s.y < 0) errs.push(`${at}: outside the faceplate`);
      }
      if (!isInt(s.cols, 1, 64) || !isInt(s.rows, 1, 64)) errs.push(`${at}: cols/rows must be integers`);
      if (s.flow && !['row', 'column'].includes(s.flow)) errs.push(`${at}: flow must be row or column`);
      let cells = 0;
      for (const id of s.controls || []) {
        if (!ids.has(id)) errs.push(`${at}: unknown control "${id}"`);
        else if (placed.has(id)) errs.push(`${at}: control "${id}" placed twice`);
        placed.add(id);
        const sp = s.spans?.[id]; cells += sp ? sp[0] * sp[1] : 1;
      }
      if (cells > s.cols * s.rows) errs.push(`${at}: ${cells} cells of controls in a ${s.cols}×${s.rows} grid`);
    }
    for (const id of ids) if (!placed.has(id)) errs.push(`${where}: control "${id}" is not shown (it would be invisible)`);
  };
  checkLayout(p.sections, 'sections', true);
  if (p.portrait) checkLayout(p.portrait, 'portrait', false);
  return errs;
}

/** Fill defaults (channel, labels, groups, portrait hints) without mutating the input. */
export function normalizeProfile(raw) {
  const errs = validateProfile(raw);
  if (errs.length) throw new Error(`invalid MIDI profile "${raw && raw.id}":\n  ` + errs.join('\n  '));
  const ch0 = raw.channel ?? 1;
  const controls = raw.controls.map((c) => ({
    label: c.id, group: c.type, ...c, ch: c.ch ?? ch0,
    ...(c.type === 'encoder' && c.relative === undefined ? { relative: 'offset64' } : {}),
    ...(c.type === 'button' && !c.mode ? { mode: 'momentary' } : {}),
    ...((c.type === 'wheel' || c.type === 'strip') && c.msg === 'pitchbend' && c.bipolar === undefined ? { bipolar: true } : {}),
    ...((c.type === 'wheel' || c.type === 'strip') && c.msg === 'pitchbend' && c.spring === undefined ? { spring: true } : {}),
  }));
  const sections = (raw.sections || []).map((s) => ({ label: '', flow: 'row', spans: {}, ...s }));
  // portrait: explicit, or the faceplate sections stacked top to bottom (weight = their height)
  const portrait = (raw.portrait || [...sections].sort((a, b) => a.y - b.y || a.x - b.x).map((s) => ({ id: s.id, cols: s.cols, rows: s.rows, controls: s.controls, flow: s.flow, spans: s.spans, weight: s.h })))
    .map((s) => ({ label: '', flow: 'row', spans: {}, weight: 1, ...s }));
  return { channel: ch0, learn: raw.kind === 'generic', stack: true, sources: [], ...raw, match: { ports: [], prefer: [], avoid: [], ...(raw.match || {}) }, controls, sections, portrait };
}

/** Message → control lookup: "cc:1:74" → [{control, index}] (keys expand to one entry per note). */
export function indexProfile(p) {
  const map = new Map();
  const put = (k, v) => { if (!map.has(k)) map.set(k, []); map.get(k).push(v); };
  for (const c of p.controls) {
    if (c.type === 'keys') for (let n = c.from; n <= c.to; n++) { put(`note:${c.ch}:${n}`, { control: c, note: n }); put(`polyat:${c.ch}:${n}`, { control: c, note: n }); }
    else if (c.msg === 'cc') put(`cc:${c.ch}:${c.cc}`, { control: c });
    else if (c.msg === 'note') { put(`note:${c.ch}:${c.note}`, { control: c, note: c.note }); put(`polyat:${c.ch}:${c.note}`, { control: c, note: c.note }); }
    else put(`${c.msg}:${c.ch}`, { control: c });
  }
  return map;
}

/** Lookup key for a parsed event (see parse.js). */
export function eventKey(ev) {
  switch (ev.type) {
    case 'noteon': case 'noteoff': return `note:${ev.ch}:${ev.note}`;
    case 'polyat': return `polyat:${ev.ch}:${ev.note}`;
    case 'cc': return `cc:${ev.ch}:${ev.cc}`;
    case 'pitchbend': return `pitchbend:${ev.ch}`;
    case 'chanat': return `chanat:${ev.ch}`;
    case 'program': return `program:${ev.ch}`;
  }
  return null;
}

/** Which profile owns a port name? Device profiles only (generic ones never auto-match).
 *  @returns {{profile:object, score:number}|null} best match */
export function matchProfile(portName, profiles) {
  const name = String(portName || '');
  let best = null;
  for (const p of profiles) {
    if (p.kind !== 'device' || !p.match) continue;
    const hit = (p.match.ports || []).some((r) => new RegExp(r, 'i').test(name));
    if (!hit) continue;
    let score = 1;
    if ((p.match.prefer || []).some((r) => new RegExp(r, 'i').test(name))) score += 1;
    if ((p.match.avoid || []).some((r) => new RegExp(r, 'i').test(name))) score -= 2;
    if (!best || score > best.score) best = { profile: p, score };
  }
  return best && best.score > 0 ? best : null;
}

/** Of several ports a device exposes ("Minilab3 MIDI", "Minilab3 DIN THRU", "Minilab3 MCU/HUI"),
 *  the one to listen to. */
export function pickPort(ports, profile) {
  const m = profile.match || {};
  const scored = ports.map((port) => {
    const n = String(port.name || '');
    let s = (m.ports || []).some((r) => new RegExp(r, 'i').test(n)) ? 1 : -9;
    if ((m.prefer || []).some((r) => new RegExp(r, 'i').test(n))) s += 1;
    if ((m.avoid || []).some((r) => new RegExp(r, 'i').test(n))) s -= 2;
    return { port, s };
  }).filter((x) => x.s > 0).sort((a, b) => b.s - a.s);
  return scored[0]?.port || null;
}

/** All signal names a profile can publish under midi/<short>/… (docs, tests, mapping UIs). */
export function profileSignals(p) {
  const out = [`midi/${p.short}/last`];
  for (const c of p.controls) {
    const b = `midi/${p.short}/${c.id}`;
    if (c.type === 'keys') { out.push(b + '/on', b + '/off'); for (let n = c.from; n <= c.to; n++) out.push(`midi/${p.short}/n${n}`); continue; }
    out.push(b, b + '/raw');
    if (c.type === 'encoder') out.push(b + '/delta');
    if (c.type === 'pad') { out.push(b + '/hit'); if (c.aftertouch) out.push(b + '/pressure'); }
  }
  return out;
}

/** Controls grouped like the TouchDesigner tool's out CHOPs (out_knob, out_slider, out_pad…). */
export function groupsOf(p) {
  const g = {};
  for (const c of p.controls) (g[c.group] ||= []).push(c.id);
  return g;
}
