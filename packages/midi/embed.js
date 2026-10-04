// @openav/midi · embed — the pure half of <oav-controller> and /embed/controller/.
//
// Everything an embed decides without a DOM lives here, so it is unit-tested in
// node: how attributes / query params read, what a `control` event carries,
// the postMessage protocol between an iframe and its page, which MIDI port a
// name means, how tall a controller wants to be for a box this wide.
//
//   parseEmbedOptions(el)                      // attributes → options (or URLSearchParams, or a plain object)
//   await resolveProfile('akai-lpd8', { profiles })   // id, short name, or a URL to a profile JSON
//   controlDetail(controller, id, st, info)    // the `control` event payload
//   describeDetail(detail)                     // "midi/lpd8/k1 = 0.42 ← CC 70 · ch 1"
//   toParent('control', detail) / fromParent(msg)     // iframe → page / page → iframe
//
// Sources in a payload are 'ui' (a finger, a mouse, set()) or 'hardware' (a real
// port, or bytes you ingest()). The profile's own words are kept: `id`, `type`,
// `signal` are what the rest of open-audiovisual calls the same control.

import { encodeMessage, relativeDelta } from './parse.js?v=35d96ac';
import { validateProfile } from './profiles.js?v=35d96ac';

/** Attributes <oav-controller> reads (also the query params of /embed/controller/). */
export const EMBED_ATTRS = ['profile', 'layout', 'hardware', 'midi-out', 'channel', 'learn', 'picker', 'readout', 'follow', 'theme'];
/** DOM events <oav-controller> dispatches (bubbling, composed). */
export const EMBED_EVENTS = ['ready', 'control', 'noteon', 'noteoff', 'connect', 'disconnect', 'status', 'profilechange', 'error'];
export const EMBED_LAYOUTS = ['auto', 'face', 'stack'];
export const DEFAULT_PROFILE = 'arturia-minilab3';

// ------------------------------------------------------------------ attributes
/** A boolean attribute: present means on, unless it says false / 0 / off / no. */
export function embedFlag(v) {
  if (v === null || v === undefined || v === false) return false;
  if (v === true) return true;
  return !/^(false|0|off|no)$/i.test(String(v).trim());
}

/** hardware / midi-out: off | ask (a button, so the permission prompt waits for a click) | on (+ which port).
 *  `hardware` alone = on; `midi-out` alone = ask (there is no sensible default port to send to). */
export function embedMode(v, { bare = 'on' } = {}) {
  if (v === null || v === undefined || v === false) return { mode: 'off', port: null };
  const s = v === true ? '' : String(v).trim();
  if (s === '') return { mode: bare, port: null };
  if (/^(false|0|off|no)$/i.test(s)) return { mode: 'off', port: null };
  if (/^ask$/i.test(s)) return { mode: 'ask', port: null };
  if (/^(on|true|yes|auto)$/i.test(s)) return { mode: 'on', port: null };
  return { mode: 'on', port: s };
}

/** MIDI channel override: 1..16, else null. */
export function embedChannel(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 && n <= 16 ? n : null;
}

/** A background the iframe page accepts: transparent, #rgb / #rrggbb(aa), or a plain colour name. */
export function embedColor(v) {
  if (!v) return null;
  const s = String(v).trim();
  if (/^transparent$/i.test(s)) return 'transparent';
  if (/^#?[0-9a-f]{3,8}$/i.test(s) && [3, 4, 6, 8].includes(s.replace('#', '').length)) return '#' + s.replace('#', '');
  if (/^[a-z]{3,20}$/i.test(s)) return s.toLowerCase();
  return null;
}

/**
 * Read the options of one embed from wherever they live.
 * @param {Element|URLSearchParams|object|((name:string)=>string|null)} src
 * @returns {{profile:string, layout:'auto'|'face'|'stack', hardware:{mode:string,port:string|null}, midiOut:{mode:string,port:string|null},
 *            channel:number|null, learn:boolean, picker:boolean, readout:boolean, follow:boolean, theme:'dark'|'light',
 *            bg:string|null, frame:string|null, origin:string|null, lang:string|null}}
 */
export function parseEmbedOptions(src) {
  const get = typeof src === 'function' ? src
    : src && typeof src.getAttribute === 'function' ? (n) => src.getAttribute(n)
    : src && typeof src.get === 'function' && typeof src.has === 'function' ? (n) => (src.has(n) ? src.get(n) : null)
    : (n) => (src && n in src ? src[n] : null);
  const any = (...names) => { for (const n of names) { const v = get(n); if (v !== null && v !== undefined) return v; } return null; };
  const layout = String(any('layout') || 'auto').toLowerCase();
  const theme = String(any('theme') || 'dark').toLowerCase();
  const origin = any('origin');
  return {
    profile: String(any('profile') || DEFAULT_PROFILE).trim(),
    layout: EMBED_LAYOUTS.includes(layout) ? layout : 'auto',
    hardware: embedMode(any('hardware')),
    midiOut: embedMode(any('midi-out', 'midiout', 'midiOut'), { bare: 'ask' }),
    channel: embedChannel(any('channel')),
    learn: embedFlag(any('learn')),
    picker: embedFlag(any('picker')),
    readout: embedFlag(any('readout')),
    follow: embedFlag(any('follow')),
    theme: theme === 'light' ? 'light' : 'dark',
    bg: embedColor(any('bg')),
    frame: any('frame', 'id') ? String(any('frame', 'id')).slice(0, 64) : null,
    origin: origin && /^https?:\/\/[^/\s]+$/i.test(origin) ? origin : null,
    lang: any('lang') ? String(any('lang')).slice(0, 16) : null,
  };
}

// ------------------------------------------------------------------ profiles
/** Is this profile reference a URL (to a JSON file) rather than an id? */
export const isProfileUrl = (ref) => typeof ref === 'string' && (/^(https?:|blob:|data:)/i.test(ref) || /^\.{0,2}\//.test(ref) || /\.json(\?|#|$)/i.test(ref));

/** Find a shipped profile by id or short name. */
export const findProfile = (ref, profiles) => profiles.find((p) => p.id === ref || p.short === ref) || null;

/**
 * A profile object, an id / short name, or a URL to a profile JSON → a valid profile.
 * Throws with every validation problem listed (a bad file should say why, not draw nothing).
 */
export async function resolveProfile(ref, { profiles = [], fetch = globalThis.fetch, base = undefined } = {}) {
  if (ref && typeof ref === 'object') return checked(ref, 'profile object');
  const s = String(ref || '').trim();
  if (!s) throw new Error('no MIDI profile given');
  if (!isProfileUrl(s)) {
    const p = findProfile(s, profiles);
    if (!p) throw new Error(`unknown MIDI profile "${s}" (known: ${profiles.map((x) => x.id).join(', ')})`);
    return p;
  }
  if (typeof fetch !== 'function') throw new Error('cannot load a profile URL here (no fetch)');
  const url = base ? new URL(s, base).href : s;
  const res = await fetch(url);
  if (!res || !res.ok) throw new Error(`could not load MIDI profile ${url} (${res ? res.status : 'no response'})`);
  return checked(await res.json(), url);
}
function checked(p, where) {
  const errs = validateProfile(p);
  if (errs.length) throw new Error(`invalid MIDI profile (${where}):\n  ` + errs.join('\n  '));
  return p;
}

/** The same device set to another MIDI channel (every control moves; explicit LED channels stay). */
export function withChannel(profile, ch) {
  if (!ch) return profile;
  const p = JSON.parse(JSON.stringify(profile));
  p.channel = ch;
  for (const c of p.controls) c.ch = ch;
  return checked(p, `${p.id} on channel ${ch}`);
}

// ------------------------------------------------------------------ ports
/** A port by name: "/regex/flags", the exact name, then a case-insensitive substring. */
export function findPort(ports, query) {
  if (!query || !ports || !ports.length) return null;
  const q = String(query);
  const re = /^\/(.+)\/([a-z]*)$/.exec(q);
  if (re) { let r; try { r = new RegExp(re[1], re[2] || 'i'); } catch { return null; } return ports.find((p) => r.test(p.name || '')) || null; }
  return ports.find((p) => p.name === q) || ports.find((p) => String(p.name || '').toLowerCase().includes(q.toLowerCase())) || null;
}

// ------------------------------------------------------------------ events
const SOURCES = { hw: 'hardware', ui: 'ui', mirror: 'mirror' };

/**
 * The `control` event payload for one control change.
 *   { profile, id, type, label, value, raw, signal, message, bytes, source, time, note?, velocity?, delta?, pressure?, held? }
 * value: 0..1 (−1..1 for bipolar wheels); pads = velocity while held, 0 on release; buttons 0 / 1;
 *        keys = this note's velocity, 0 on release. raw: the MIDI number (0..127, pitch bend 0..16383).
 */
export function controlDetail(mc, id, st, info = {}) {
  const c = mc.control(id);
  const ev = info.ev || null;
  const isKeys = c.type === 'keys';
  const note = info.note ?? (ev && 'note' in ev ? ev.note : null);
  const d = {
    profile: mc.id,
    id, type: c.type, label: c.label ?? id,
    value: isKeys ? (ev && ev.type === 'noteon' ? ev.vel / 127 : 0) : st.value,
    raw: isKeys ? (ev && ev.type === 'noteon' ? ev.vel : 0) : st.raw,
    signal: isKeys && note != null ? `midi/${mc.short}/n${note}` : `midi/${mc.short}/${id}`,
    message: ev ? { ...ev } : null,
    bytes: info.bytes ? Array.from(info.bytes) : ev ? encodeMessage(ev) : null,
    source: SOURCES[info.source] || info.source || 'ui',
    time: Math.round(typeof performance !== 'undefined' ? performance.now() : Date.now()),
  };
  if (note != null && ev && (ev.type === 'noteon' || ev.type === 'noteoff' || ev.type === 'polyat')) { d.note = note; d.velocity = ev.type === 'noteon' ? ev.vel : 0; }
  if (c.type === 'encoder' && c.relative && ev && ev.type === 'cc') d.delta = relativeDelta(ev.value, c.relative);
  if (c.type === 'pad') { d.held = !!st.held; if (st.pressure) d.pressure = st.pressure; }
  if (c.type === 'button') d.held = !!st.held;
  return d;
}

const fmt = (v) => (typeof v === 'number' ? (Math.abs(v) >= 100 ? String(Math.round(v)) : v.toFixed(2)) : String(v));
/** One message as a person reads it: "CC 70", "Note 36 · vel 90", "Bend 12288". */
export function describeMessage(m) {
  if (!m) return '';
  switch (m.type) {
    case 'cc': return `CC ${m.cc} = ${m.value}`;
    case 'noteon': return `Note ${m.note} · vel ${m.vel}`;
    case 'noteoff': return `Note ${m.note} off`;
    case 'pitchbend': return `Bend ${m.value}`;
    case 'chanat': return `Pressure ${m.value}`;
    case 'polyat': return `Poly AT ${m.note} = ${m.value}`;
    case 'program': return `Program ${m.value}`;
    default: return m.type;
  }
}
/** The readout line: "midi/minilab3/knob1 = 0.42 ← CC 74 = 53 · ch 1". */
export function describeDetail(d) {
  if (!d) return '';
  const m = d.message;
  return `${d.signal} = ${fmt(d.value)}${m ? ` ← ${describeMessage(m)} · ch ${m.ch}` : ''}`;
}

/** Every control's current value: { id: number } (keys: 1 while any key is held). */
export function valuesOf(mc) {
  const out = {};
  for (const c of mc.profile.controls) out[c.id] = mc.get(c.id).value;
  return out;
}

/**
 * Move one control the way a hand would, whatever its type:
 *   knob / fader / wheel / strip / encoder   value 0..1 (−1..1 bipolar)
 *   pad, momentary button                    value > 0 presses (with that velocity), 0 releases
 *   toggle button                            value ≥ 0.5 = on
 *   keys                                     set('keys', velocity, note) — 0 releases that note
 * source 'ui' publishes and reaches MIDI out; 'mirror' only moves the faceplate (two-way binding).
 * @returns {number[]|null} the bytes the control sent (null: nothing changed)
 */
export function setControl(mc, id, value, { note = null, source = 'ui' } = {}) {
  const c = mc.control(id);
  if (!c) throw new Error(`${mc.id} has no control "${id}" (controls: ${mc.profile.controls.map((x) => x.id).join(', ')})`);
  const v = Number(value);
  if (!Number.isFinite(v)) throw new Error(`set("${id}"): value must be a number`);
  const o = { source };
  switch (c.type) {
    case 'pad': return v > 0 ? mc.press(id, Math.min(1, v), null, o) : mc.get(id).held ? mc.release(id, null, o) : null;
    case 'button':
      if (c.mode === 'toggle') return (v >= 0.5) !== !!mc.get(id).held ? mc.press(id, 1, null, o) : null;
      return v > 0 ? (mc.get(id).held ? null : mc.press(id, 1, null, o)) : mc.get(id).held ? mc.release(id, null, o) : null;
    case 'keys': { const n = note ?? c.from; return v > 0 ? mc.press(id, Math.min(1, v), n, o) : mc.keys.has(n) ? mc.release(id, n, o) : null; }
    default: return mc.setValue(id, v, o);
  }
}

/** Where a control rests: knobs and faders at their default (0), bipolar wheels centred, nothing held. */
export function restValue(c) {
  if (c.type === 'keys' || c.type === 'pad' || c.type === 'button') return 0;
  if (c.bipolar) return 0;
  return c.def ?? (c.type === 'encoder' && c.relative ? 0.5 : 0);
}

// ------------------------------------------------------------------ sizing
/**
 * The width ÷ height a controller wants in a box this wide.
 *   the faceplate's own proportions while every control stays finger-sized;
 *   a taller box (re-gridded as a stack) on a phone, if the device allows it;
 *   square-ish grid devices (Launchpad) always keep their face.
 */
export function preferredAspect(profile, width, { layout = 'auto', minTouch = 38 } = {}) {
  const f = profile.face;
  const face = f.w / f.h;
  const stackable = profile.stack !== false;
  const secs = profile.sections || [];
  const smallest = secs.length ? Math.min(...secs.map((s) => Math.max(s.w / s.cols, (s.h - (s.label ? 2 : 0)) / s.rows))) : f.w;
  // stricter than the view's own rule for wide boxes (0.8 × minTouch): when we choose the height, a phone gets thumbs-sized controls
  const fits = width > 0 && smallest * (width / f.w) >= minTouch;
  const mode = layout === 'face' || !stackable ? 'face' : layout === 'stack' ? 'stack' : fits ? 'face' : 'stack';
  if (mode === 'face') return { mode, aspect: face };
  // a stack: one band per portrait section, each about as tall as its weight says
  const bands = (profile.portrait || secs.map((s) => ({ weight: s.h }))).reduce((a, s) => a + (s.weight ?? 1), 0);
  const k = Math.max(0.8, Math.min(1.5, bands * 0.2));   // height ≈ k × width
  return { mode, aspect: 1 / k };
}

// ------------------------------------------------------------------ postMessage protocol
export const POST_SOURCE = 'openav';
export const POST_VERSION = 1;
/** Commands a page may send into an embed iframe. */
export const FRAME_COMMANDS = ['set', 'ingest', 'reset', 'profile', 'layout', 'get', 'press', 'release'];

const plain = (x) => (x === undefined ? null : JSON.parse(JSON.stringify(x)));

/** iframe → page: { source: 'openav', v: 1, type, frame, detail } */
export function toParent(type, detail = null, { frame = null } = {}) {
  return { source: POST_SOURCE, v: POST_VERSION, type: String(type), frame: frame ?? null, detail: plain(detail) };
}
/** page side: read a message from an embed iframe (null if it is not one). */
export function fromFrame(data) {
  if (!data || typeof data !== 'object' || data.source !== POST_SOURCE || typeof data.type !== 'string') return null;
  return { type: data.type, frame: data.frame ?? null, detail: data.detail ?? null, v: data.v ?? 1 };
}
/** page → iframe: { target: 'openav', v: 1, type, ...args } */
export function toFrame(type, args = {}) {
  return { target: POST_SOURCE, v: POST_VERSION, type: String(type), ...plain(args) };
}
const isBytes = (b) => Array.isArray(b) && b.length >= 1 && b.length <= 3 && b.every((x) => Number.isInteger(x) && x >= 0 && x <= 255) && b[0] >= 0x80;

/** iframe side: validate a command from the page → a clean command, or null (ignored). */
export function fromParent(data) {
  if (!data || typeof data !== 'object' || data.target !== POST_SOURCE || !FRAME_COMMANDS.includes(data.type)) return null;
  const id = typeof data.id === 'string' && /^[a-z0-9][a-z0-9_-]*$/.test(data.id) ? data.id : null;
  const note = Number.isInteger(data.note) && data.note >= 0 && data.note <= 127 ? data.note : null;
  switch (data.type) {
    case 'set': { const value = Number(data.value); return id && Number.isFinite(value) ? { type: 'set', id, value, note, quiet: !!data.quiet } : null; }
    case 'press': { const vel = data.velocity === undefined ? 1 : Number(data.velocity); return id && Number.isFinite(vel) ? { type: 'press', id, velocity: Math.max(0, Math.min(1, vel)), note } : null; }
    case 'release': return id ? { type: 'release', id, note } : null;
    case 'ingest': {
      const bytes = Array.isArray(data.bytes) ? data.bytes : null;
      if (bytes && isBytes(bytes)) return { type: 'ingest', bytes: [...bytes] };
      if (bytes && bytes.length && bytes.every(Array.isArray) && bytes.length <= 256 && bytes.every(isBytes)) return { type: 'ingest', bytes: bytes.map((b) => [...b]) };
      return null;
    }
    case 'profile': { const p = typeof data.profile === 'string' ? data.profile.trim() : ''; return p && (/^[a-z0-9][a-z0-9_-]*$/.test(p) || /^https:\/\//.test(p)) ? { type: 'profile', profile: p } : null; }
    case 'layout': return EMBED_LAYOUTS.includes(data.layout) ? { type: 'layout', layout: data.layout } : null;
    case 'reset': return { type: 'reset' };
    case 'get': return { type: 'get' };
  }
  return null;
}
