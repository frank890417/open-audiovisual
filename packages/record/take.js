// take.js — a MIDI take: what was played, as data. Pure, unit-tested.
//
// A take is the signals a performance published, timestamped in ms from its
// start — exactly what an EventLog records, filtered to midi/*. Replaying it
// into a Signals bus makes a work see the same performance again, so a preview
// can play itself the way a sketchbook page plays back.
//
//   { v: 1, name, createdAt, durationMs,
//     events: [{ t, name, value }],         t in ms, name = a signal ('midi/note/on'), value = its payload
//     meta: { bpm?, device?, notes? } }     notes = free text
//
// The events are the signals as published, so a hardware take holds both naming
// families (`midi/note/on` and `midi/ch/1/note/60`) and any device names
// (`midi/minilab3/pad1`): replaying all of them is what makes it faithful.
// Conversions to MIDI (midiEventsOf, toMidiFile) pick ONE family so nothing doubles.

import { bendToUnit, unitToBend } from '../midi/parse.js?v=a8b6135';

export const TAKE_VERSION = 1;

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const r1 = (ms) => Math.round(ms * 10) / 10;

/**
 * Coerce anything take-shaped into a valid take: events sorted by t (stable),
 * invalid events dropped, t ≥ 0, durationMs ≥ the last event, v = 1.
 * @param {object|string} input a take or its JSON
 * @returns {{v:1, name:string, createdAt:string|null, durationMs:number, events:{t:number,name:string,value:any}[], meta:object}}
 */
export function normalizeTake(input) {
  const d = typeof input === 'string' ? JSON.parse(input) : input;
  if (!isObj(d)) throw new TypeError('normalizeTake: not a take');
  const events = (Array.isArray(d.events) ? d.events : [])
    .map((e, i) => ({ e, i }))
    .filter(({ e }) => isObj(e) && typeof e.name === 'string' && e.name && Number.isFinite(+e.t))
    .map(({ e, i }) => ({ t: Math.max(0, r1(+e.t)), name: e.name, value: e.value === undefined ? null : e.value, i }))
    .sort((a, b) => a.t - b.t || a.i - b.i)
    .map(({ t, name, value }) => ({ t, name, value }));
  const last = events.length ? events[events.length - 1].t : 0;
  return {
    v: TAKE_VERSION,
    name: typeof d.name === 'string' && d.name ? d.name : 'take',
    createdAt: typeof d.createdAt === 'string' ? d.createdAt : null,
    durationMs: Math.max(last, Number.isFinite(+d.durationMs) ? r1(+d.durationMs) : 0),
    events,
    meta: isObj(d.meta) ? { ...d.meta } : {},
  };
}

/**
 * Problems with a take, as sentences ([] = valid). Does not throw.
 * @param {any} take @returns {string[]}
 */
export function validateTake(take) {
  const out = [];
  if (!isObj(take)) return ['not an object'];
  if (take.v !== TAKE_VERSION) out.push(`v must be ${TAKE_VERSION} (got ${JSON.stringify(take.v)})`);
  if (typeof take.name !== 'string') out.push('name must be a string');
  if (!Number.isFinite(take.durationMs) || take.durationMs < 0) out.push('durationMs must be a number ≥ 0');
  if (!Array.isArray(take.events)) { out.push('events must be an array'); return out; }
  let prev = -Infinity;
  take.events.forEach((e, i) => {
    if (!isObj(e)) { out.push(`events[${i}] is not an object`); return; }
    if (typeof e.name !== 'string' || !e.name) out.push(`events[${i}].name must be a signal name`);
    if (!Number.isFinite(e.t) || e.t < 0) out.push(`events[${i}].t must be ms ≥ 0`);
    else {
      if (e.t < prev) out.push(`events[${i}] is out of order (t ${e.t} < ${prev})`);
      if (Number.isFinite(take.durationMs) && e.t > take.durationMs) out.push(`events[${i}].t is after durationMs`);
      prev = e.t;
    }
  });
  if (take.meta !== undefined && !isObj(take.meta)) out.push('meta must be an object');
  return out;
}

// ---- reading notes out of signal events --------------------------------------------------------

const LEGACY_NOTE = /^midi\/note\/(on|off)$/;
const SLUG_NOTE = /^midi\/([^/]+)\/note\/(on|off)$/;           // midi/<slug>/note/on (per device)
const CH_NOTE = /^midi\/ch\/(\d+)\/note\/(\d+)$/;
const CH_CC = /^midi\/ch\/(\d+)\/cc\/(\d+)$/;
const LEGACY_CC = /^midi\/cc\/(\d+)$/;
const SLUG_CC = /^midi\/([^/]+)\/cc\/(\d+)$/;
const CH_BEND = /^midi\/ch\/(\d+)\/bend$/;
const SLUG_BEND = /^midi\/([^/]+)\/bend$/;
const CH_PRESSURE = /^midi\/ch\/(\d+)\/pressure$/;
const CH_POLY = /^midi\/ch\/(\d+)\/poly\/(\d+)$/;

const ch16 = (c) => { const n = Math.round(+c); return n >= 1 && n <= 16 ? n : 1; };   // the on-screen piano says ch 0
const b7 = (v) => Math.max(0, Math.min(127, Math.round(v)));
const velOf = (v) => (Number.isFinite(v?.velocity) ? b7(v.velocity) : Number.isFinite(v?.vel) ? b7(v.vel * 127) : 100);

/**
 * Is this event a key going down / up? → `{ key, on, note, ch, family }` or null.
 * Recognises all three spellings (legacy, per-channel, per-device) and raw bytes
 * on `midi/virtual` (`{ data: [status, note, vel] }`).
 * @param {{name:string, value:any}} ev
 */
export function noteOf(ev) {
  const { name, value } = ev;
  let m;
  if ((m = LEGACY_NOTE.exec(name)) && isObj(value) && Number.isFinite(value.note)) {
    const ch = ch16(value.ch);
    return { key: `${ch}:${value.note}`, on: m[1] === 'on', note: value.note, ch, family: 'legacy', vel: velOf(value) };
  }
  if ((m = CH_NOTE.exec(name)) && typeof value === 'number') {
    const ch = ch16(m[1]), note = +m[2];
    return { key: `${ch}:${note}`, on: value > 0, note, ch, family: 'channel', vel: b7(value * 127) || 1 };
  }
  if ((m = SLUG_NOTE.exec(name)) && m[1] !== 'ch' && isObj(value) && Number.isFinite(value.note)) {
    const ch = ch16(value.ch);
    return { key: `${ch}:${value.note}`, on: m[2] === 'on', note: value.note, ch, family: 'slug:' + m[1], vel: velOf(value) };
  }
  if (name === 'midi/virtual' && isObj(value) && Array.isArray(value.data) && value.data.length >= 3) {
    const [st, note, vel] = value.data, type = st & 0xf0, ch = (st & 0x0f) + 1;
    if (type === 0x90 || type === 0x80) return { key: `${ch}:${note}`, on: type === 0x90 && vel > 0, note, ch, family: 'virtual', vel };
  }
  return null;
}

/**
 * The signal events that release a sounding note, in the spelling it was played in.
 * @param {{note:number, ch:number, family:string}} n from noteOf
 * @returns {{name:string, value:any}[]}
 */
export function noteOffFor(n) {
  if (n.family === 'legacy') return [{ name: 'midi/note/off', value: { note: n.note, ch: n.ch } }];
  if (n.family === 'channel') return [{ name: `midi/ch/${n.ch}/note/${n.note}`, value: 0 }];
  if (n.family === 'virtual') return [{ name: 'midi/virtual', value: { data: [0x80 | (n.ch - 1), n.note, 0] } }];
  if (n.family.startsWith('slug:')) return [{ name: `midi/${n.family.slice(5)}/note/off`, value: { note: n.note, ch: n.ch } }];
  return [];
}

/**
 * The take as MIDI events in @openav/midi's shape (`{ t, type, ch, note, vel }`,
 * `{ t, type: 'cc', ch, cc, value }`, `{ t, type: 'pitchbend', ch, value 0..16383 }`,
 * `chanat`, `polyat`), one family only so nothing doubles: notes from `midi/note/*`
 * if present, else `midi/ch/*`, else one device's `midi/<slug>/note/*`, else raw
 * `midi/virtual` bytes; controllers and bend from `midi/ch/*` if present, else the
 * legacy names (channel 1), else one device's.
 * @param {object} take
 * @returns {{t:number, type:string, ch:number, note?:number, vel?:number, cc?:number, value?:number}[]}
 */
export function midiEventsOf(take) {
  const evs = normalizeTake(take).events;
  const has = (re) => evs.some((e) => re.test(e.name));
  const slugNotes = evs.map((e) => SLUG_NOTE.exec(e.name)).find((m) => m && m[1] !== 'ch');
  const noteFamily = has(LEGACY_NOTE) ? 'legacy' : has(CH_NOTE) ? 'channel' : slugNotes ? 'slug:' + slugNotes[1] : 'virtual';
  const slugCc = evs.map((e) => SLUG_CC.exec(e.name)).find((m) => m && m[1] !== 'ch');
  const ccFamily = has(CH_CC) ? 'channel' : has(LEGACY_CC) ? 'legacy' : slugCc ? slugCc[1] : null;
  const slugBend = evs.map((e) => SLUG_BEND.exec(e.name)).find((m) => m && m[1] !== 'ch');
  const bendFamily = has(CH_BEND) ? 'channel' : evs.some((e) => e.name === 'midi/bend') ? 'legacy' : slugBend ? slugBend[1] : null;
  const out = [];
  for (const e of evs) {
    const n = noteOf(e);
    if (n) {
      if (n.family === noteFamily) out.push(n.on ? { t: e.t, type: 'noteon', ch: n.ch, note: n.note, vel: Math.max(1, n.vel) } : { t: e.t, type: 'noteoff', ch: n.ch, note: n.note, vel: 0 });
      continue;
    }
    if (typeof e.value !== 'number') {
      if (e.name === 'midi/virtual' && noteFamily === 'virtual' && isObj(e.value) && Array.isArray(e.value.data)) {
        const [st, a = 0, b = 0] = e.value.data, type = st & 0xf0, ch = (st & 0x0f) + 1;
        if (type === 0xb0) out.push({ t: e.t, type: 'cc', ch, cc: a, value: b });
        else if (type === 0xe0) out.push({ t: e.t, type: 'pitchbend', ch, value: (b << 7) | a });
      }
      continue;
    }
    let m;
    if (ccFamily === 'channel' && (m = CH_CC.exec(e.name))) out.push({ t: e.t, type: 'cc', ch: ch16(m[1]), cc: +m[2], value: b7(e.value * 127) });
    else if (ccFamily === 'legacy' && (m = LEGACY_CC.exec(e.name))) out.push({ t: e.t, type: 'cc', ch: 1, cc: +m[1], value: b7(e.value * 127) });
    else if (ccFamily && ccFamily !== 'channel' && ccFamily !== 'legacy' && (m = SLUG_CC.exec(e.name)) && m[1] === ccFamily) out.push({ t: e.t, type: 'cc', ch: 1, cc: +m[2], value: b7(e.value * 127) });
    else if (bendFamily === 'channel' && (m = CH_BEND.exec(e.name))) out.push({ t: e.t, type: 'pitchbend', ch: ch16(m[1]), value: unitToBend(Math.max(-1, Math.min(1, e.value))) });
    else if (bendFamily === 'legacy' && e.name === 'midi/bend') out.push({ t: e.t, type: 'pitchbend', ch: 1, value: unitToBend(Math.max(-1, Math.min(1, e.value))) });
    else if (bendFamily && bendFamily !== 'channel' && bendFamily !== 'legacy' && (m = SLUG_BEND.exec(e.name)) && m[1] === bendFamily) out.push({ t: e.t, type: 'pitchbend', ch: 1, value: unitToBend(Math.max(-1, Math.min(1, e.value))) });
    else if ((m = CH_PRESSURE.exec(e.name))) out.push({ t: e.t, type: 'chanat', ch: ch16(m[1]), value: b7(e.value * 127) });
    else if ((m = CH_POLY.exec(e.name))) out.push({ t: e.t, type: 'polyat', ch: ch16(m[1]), note: +m[2], value: b7(e.value * 127) });
  }
  return out;
}

/**
 * One MIDI event → the signal events @openav/midi publishes for it (what a
 * hardware keyboard would have produced), so a take made from a .mid file
 * drives a work exactly like playing it live.
 * @param {{type:string, ch:number, note?:number, vel?:number, cc?:number, value?:number}} ev
 * @param {{ families?: 'both'|'legacy'|'channel', device?: string|null }} [opts]
 * @returns {{name:string, value:any}[]}
 */
export function signalsOfMidi(ev, { families = 'both', device = null } = {}) {
  const L = families !== 'channel', C = families !== 'legacy', out = [];
  const ch = ch16(ev.ch), P = `midi/ch/${ch}`;
  switch (ev.type) {
    case 'noteon':
      if (L) out.push({ name: 'midi/note/on', value: { note: ev.note, vel: Math.round(ev.vel / 127 * 1e6) / 1e6, velocity: ev.vel, ch, ...(device ? { device } : {}) } });
      if (C) out.push({ name: `${P}/note/${ev.note}`, value: Math.round(ev.vel / 127 * 1e6) / 1e6 });
      break;
    case 'noteoff':
      if (L) out.push({ name: 'midi/note/off', value: { note: ev.note, ch, ...(device ? { device } : {}) } });
      if (C) out.push({ name: `${P}/note/${ev.note}`, value: 0 });
      break;
    case 'cc':
      if (L) out.push({ name: `midi/cc/${ev.cc}`, value: Math.round(ev.value / 127 * 1e6) / 1e6 });
      if (C) out.push({ name: `${P}/cc/${ev.cc}`, value: Math.round(ev.value / 127 * 1e6) / 1e6 });
      break;
    case 'pitchbend': {
      const u = Math.round(bendToUnit(ev.value) * 1e6) / 1e6;
      if (L) out.push({ name: 'midi/bend', value: u });
      if (C) out.push({ name: `${P}/bend`, value: u });
      break;
    }
    case 'chanat': if (C) out.push({ name: `${P}/pressure`, value: Math.round(ev.value / 127 * 1e6) / 1e6 }); break;
    case 'polyat': if (C) out.push({ name: `${P}/poly/${ev.note}`, value: Math.round(ev.value / 127 * 1e6) / 1e6 }); break;
  }
  return out;
}

/**
 * Numbers about a take: note count (key-downs, one family), events, length,
 * channels used, lowest / highest note.
 * @param {object} take
 * @returns {{ notes:number, events:number, durationMs:number, channels:number[], low:number|null, high:number|null }}
 */
export function takeStats(take) {
  const t = normalizeTake(take);
  const notes = midiEventsOf(t).filter((e) => e.type === 'noteon');
  const pitches = notes.map((e) => e.note);
  return {
    notes: notes.length, events: t.events.length, durationMs: t.durationMs,
    channels: [...new Set(notes.map((e) => e.ch))].sort((a, b) => a - b),
    low: pitches.length ? pitches.reduce((a, b) => Math.min(a, b)) : null,
    high: pitches.length ? pitches.reduce((a, b) => Math.max(a, b)) : null,
  };
}

/**
 * Cut the silence before the first key-down: everything moves earlier so that
 * note lands at `keep` ms. Controller values set during the silence (the sustain
 * pedal, a knob) are kept, moved to t = 0, so the take still starts in the same state.
 * @param {object} take @param {{ keep?: number }} [opts]
 * @returns {object} a new take
 */
export function trimSilence(take, { keep = 0 } = {}) {
  const t = normalizeTake(take);
  const first = t.events.find((e) => { const n = noteOf(e); return n && n.on; });
  const start = first ? first.t : t.events.length ? t.events[0].t : 0;
  const cut = Math.max(0, start - Math.max(0, keep));
  if (!cut) return t;
  return { ...t, durationMs: r1(Math.max(0, t.durationMs - cut)), events: t.events.map((e) => ({ ...e, t: r1(Math.max(0, e.t - cut)) })) };
}

/**
 * Snap key-downs to a grid (`grid` steps per beat at `bpm`: 4 = sixteenths).
 * Each note's key-up moves with it, so lengths are kept; everything that is not a
 * note stays where it was. `strength` 0..1 moves part of the way (0.5 = half).
 * @param {object} take
 * @param {{ bpm?: number, grid?: number, strength?: number, offsetMs?: number }} [opts] bpm defaults to meta.bpm, then 120
 * @returns {object} a new take
 */
export function quantizeTake(take, { bpm, grid = 4, strength = 1, offsetMs = 0 } = {}) {
  const t = normalizeTake(take);
  const tempo = bpm || t.meta.bpm || 120;
  const step = 60000 / tempo / Math.max(1, grid);
  const k = Math.max(0, Math.min(1, strength));
  const shift = new Map();   // note key → delta of its latest key-down
  const events = t.events.map((e) => {
    const n = noteOf(e);
    if (!n) return e;
    if (n.on) {
      const snapped = offsetMs + Math.round((e.t - offsetMs) / step) * step;
      const prev = shift.get(n.key);
      // the other spelling of the same key-down (same t) moves by the same amount
      const d = prev && prev.at === e.t ? prev.d : (snapped - e.t) * k;
      shift.set(n.key, { d, at: e.t });
      return { ...e, t: r1(Math.max(0, e.t + d)) };
    }
    const s = shift.get(n.key);
    return s ? { ...e, t: r1(Math.max(0, e.t + s.d)) } : e;
  });
  return normalizeTake({ ...t, events, durationMs: events.reduce((a, e) => Math.max(a, e.t), t.durationMs) });
}
