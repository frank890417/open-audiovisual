// @openav/midi · parse — MIDI bytes ⇄ events, and the signal names they become.
// Pure (no DOM, no Web MIDI) so every rule here is unit-tested without hardware.
//
//   parseMessage([0x90, 60, 100]) → { type: 'noteon', ch: 1, note: 60, vel: 100 }
//   encodeMessage({ type: 'cc', ch: 1, cc: 74, value: 64 }) → [0xb0, 74, 64]
//   relativeDelta(65, 'offset64') → +1      (endless encoders)
//
// Channels are 1..16 everywhere (what a human reads on the device), bytes are
// 0..127, pitch bend is 14-bit (0..16383, centre 8192).
//
// Naming note for TouchDesigner users: TD's MIDI In CHOP names channels
// 1-based — `ch1n49` is MIDI note 48 and `ch1ctrl75` is CC 74. Everything in
// open-audiovisual uses the real MIDI numbers.

export const BEND_CENTER = 8192;

/** Bytes (Array | Uint8Array) → event object, or null for nothing we know. */
export function parseMessage(data) {
  if (!data || !data.length) return null;
  const status = data[0] & 0xff, d1 = (data[1] ?? 0) & 0x7f, d2 = (data[2] ?? 0) & 0x7f;
  if (status < 0x80) return null;                       // running status is resolved by the browser
  if (status >= 0xf0) {
    switch (status) {
      case 0xf8: return { type: 'clock' };
      case 0xfa: return { type: 'start' };
      case 0xfb: return { type: 'continue' };
      case 0xfc: return { type: 'stop' };
      case 0xf0: return { type: 'sysex', data: Array.from(data) };
      default: return { type: 'system', status };
    }
  }
  const type = status & 0xf0, ch = (status & 0x0f) + 1;
  switch (type) {
    case 0x90: return d2 > 0 ? { type: 'noteon', ch, note: d1, vel: d2 } : { type: 'noteoff', ch, note: d1, vel: 0 };
    case 0x80: return { type: 'noteoff', ch, note: d1, vel: d2 };
    case 0xa0: return { type: 'polyat', ch, note: d1, value: d2 };
    case 0xb0: return { type: 'cc', ch, cc: d1, value: d2 };
    case 0xc0: return { type: 'program', ch, value: d1 };
    case 0xd0: return { type: 'chanat', ch, value: d1 };
    case 0xe0: return { type: 'pitchbend', ch, value: (d2 << 7) | d1 };
  }
  return null;
}

const clamp7 = (v) => Math.max(0, Math.min(127, Math.round(v)));

/** Event object → bytes. The inverse of parseMessage (for the virtual controller and LED feedback). */
export function encodeMessage(ev) {
  const ch = Math.max(1, Math.min(16, ev.ch || 1)) - 1;
  switch (ev.type) {
    case 'noteon': return [0x90 | ch, clamp7(ev.note), clamp7(ev.vel ?? 100)];
    case 'noteoff': return [0x80 | ch, clamp7(ev.note), clamp7(ev.vel ?? 0)];
    case 'polyat': return [0xa0 | ch, clamp7(ev.note), clamp7(ev.value)];
    case 'cc': return [0xb0 | ch, clamp7(ev.cc), clamp7(ev.value)];
    case 'program': return [0xc0 | ch, clamp7(ev.value)];
    case 'chanat': return [0xd0 | ch, clamp7(ev.value)];
    case 'pitchbend': { const v = Math.max(0, Math.min(16383, Math.round(ev.value))); return [0xe0 | ch, v & 0x7f, (v >> 7) & 0x7f]; }
  }
  return null;
}

/** Endless-encoder steps from one CC value. Devices disagree on the encoding,
 *  so profiles name it:
 *    offset64  64 = no move, 65 = +1, 63 = −1        (a.k.a. "binary offset", Arturia Relative #1)
 *    offset16  16 = no move, 17 = +1, 15 = −1        (Arturia Relative #3)
 *    twos      1..63 = +1..+63, 127..65 = −1..−63    (two's complement, Arturia Relative #2)
 *    signbit   1..63 = +, 65..127 = −(v−64)          (sign-magnitude) */
export function relativeDelta(value, mode = 'offset64') {
  const v = value & 0x7f;
  switch (mode) {
    case 'offset64': return v - 64;
    case 'offset16': return v - 16;
    case 'twos': return v < 64 ? v : v - 128;
    case 'signbit': return v & 0x40 ? -(v & 0x3f) : v;
    default: throw new Error(`unknown relative mode "${mode}"`);
  }
}
/** Inverse of relativeDelta (virtual encoders send the same encoding the hardware does). */
export function relativeValue(delta, mode = 'offset64') {
  const d = Math.max(-63, Math.min(63, Math.round(delta)));
  switch (mode) {
    case 'offset64': return 64 + d;
    case 'offset16': return Math.max(0, Math.min(127, 16 + d));
    case 'twos': return d >= 0 ? d : 128 + d;
    case 'signbit': return d >= 0 ? d : 64 | -d;
    default: throw new Error(`unknown relative mode "${mode}"`);
  }
}
export const RELATIVE_MODES = ['offset64', 'offset16', 'twos', 'signbit'];

/** Pitch bend 0..16383 → −1..1 (centre exactly 0; the top end reaches +1). */
export const bendToUnit = (v) => (v >= BEND_CENTER ? (v - BEND_CENTER) / (16383 - BEND_CENTER) : (v - BEND_CENTER) / BEND_CENTER);
export const unitToBend = (u) => Math.round(u >= 0 ? BEND_CENTER + u * (16383 - BEND_CENTER) : BEND_CENTER + u * BEND_CENTER);

/** The generic, device-independent signals one message becomes.
 *  Two families, both published for every hardware port and every virtual controller:
 *    legacy (the names every World already uses — any channel):
 *      midi/note/on  midi/note/off  (pulses {note, vel 0..1, velocity 1..127, ch, device})
 *      midi/cc/<n>   0..1            midi/bend  −1..1
 *    per channel (when two devices share a CC number, or a work cares about channels):
 *      midi/ch/<ch>/cc/<n>  0..1     midi/ch/<ch>/note/<n>  velocity 0..1 while held, 0 on release
 *      midi/ch/<ch>/bend −1..1       midi/ch/<ch>/pressure 0..1    midi/ch/<ch>/poly/<n> 0..1
 *  (Not midi/cc/<ch>/<n>: under prefix subscriptions — lab.on('midi/cc/1') — it would
 *  collide with the existing "CC 1 on any channel".)
 *  @returns {{name:string, value:any, pulse?:boolean, min?:number, max?:number}[]} */
export function genericSignals(ev, { device = null, legacy = true, channel = true } = {}) {
  if (!ev) return [];
  const out = [];
  const C = `midi/ch/${ev.ch}`;
  switch (ev.type) {
    case 'noteon': {
      if (legacy) out.push({ name: 'midi/note/on', value: { note: ev.note, vel: ev.vel / 127, velocity: ev.vel, ch: ev.ch, device }, pulse: true });
      if (channel) out.push({ name: `${C}/note/${ev.note}`, value: ev.vel / 127 });
      break;
    }
    case 'noteoff': {
      if (legacy) out.push({ name: 'midi/note/off', value: { note: ev.note, ch: ev.ch, device }, pulse: true });
      if (channel) out.push({ name: `${C}/note/${ev.note}`, value: 0 });
      break;
    }
    case 'cc': {
      if (legacy) out.push({ name: `midi/cc/${ev.cc}`, value: ev.value / 127 });
      if (channel) out.push({ name: `${C}/cc/${ev.cc}`, value: ev.value / 127 });
      break;
    }
    case 'pitchbend': {
      const u = bendToUnit(ev.value);
      if (legacy) out.push({ name: 'midi/bend', value: u, min: -1, max: 1 });
      if (channel) out.push({ name: `${C}/bend`, value: u, min: -1, max: 1 });
      break;
    }
    case 'chanat': if (channel) out.push({ name: `${C}/pressure`, value: ev.value / 127 }); break;
    case 'polyat': if (channel) out.push({ name: `${C}/poly/${ev.note}`, value: ev.value / 127 }); break;
  }
  return out;
}

const CH_SIG = /^midi\/ch\/(\d+)\/(note|cc|poly)\/(\d+)$/;
const CH_SIG1 = /^midi\/ch\/(\d+)\/(bend|pressure)$/;
const LEGACY_CC = /^midi\/cc\/(\d+)$/;
const chOf = (v, dflt) => { const n = Math.round(+v); return n >= 1 && n <= 16 ? n : dflt; };   // the on-screen piano says ch 0
const b7 = (v) => Math.max(0, Math.min(127, Math.round(v)));
const num = (v) => typeof v === 'number' && Number.isFinite(v);

/** The inverse of genericSignals: one generic signal → the MIDI event it came from, so anything
 *  that only hears a Signals bus (a take playing back, the on-screen piano, a phone) can drive a
 *  controller model as if the bytes had arrived. Device names (`midi/<short>/…`), `midi/virtual`
 *  and anything else → null.
 *    eventOfSignal('midi/ch/10/note/36', 0.5) → { family: 'channel', ev: { type: 'noteon', ch: 10, note: 36, vel: 64 } }
 *    eventOfSignal('midi/cc/74', 1)           → { family: 'legacy',  ev: { type: 'cc', ch: 1, cc: 74, value: 127 } }
 *  Legacy CC and bend carry no channel: they get `channel`. Velocity and values come back on the
 *  0..127 scale they were published from (v × 127, rounded), so the round trip is exact.
 *  @param {string} name @param {any} value
 *  @param {{channel?:number}} [o] channel for names that do not say one (default 1)
 *  @returns {{family:'channel'|'legacy', ev:object} | null} */
export function eventOfSignal(name, value, { channel = 1 } = {}) {
  if (typeof name !== 'string' || !name.startsWith('midi/')) return null;
  let m;
  if ((m = CH_SIG.exec(name))) {
    if (!num(value)) return null;
    const ch = chOf(m[1], 0), n = +m[3];
    if (!ch || n > 127) return null;
    if (m[2] === 'note') return { family: 'channel', ev: value > 0 ? { type: 'noteon', ch, note: n, vel: Math.max(1, b7(value * 127)) } : { type: 'noteoff', ch, note: n, vel: 0 } };
    if (m[2] === 'cc') return { family: 'channel', ev: { type: 'cc', ch, cc: n, value: b7(value * 127) } };
    return { family: 'channel', ev: { type: 'polyat', ch, note: n, value: b7(value * 127) } };
  }
  if ((m = CH_SIG1.exec(name))) {
    if (!num(value)) return null;
    const ch = chOf(m[1], 0); if (!ch) return null;
    return m[2] === 'bend' ? { family: 'channel', ev: { type: 'pitchbend', ch, value: unitToBend(Math.max(-1, Math.min(1, value))) } }
      : { family: 'channel', ev: { type: 'chanat', ch, value: b7(value * 127) } };
  }
  if (name === 'midi/note/on' || name === 'midi/note/off') {
    if (!value || typeof value !== 'object' || !num(value.note)) return null;
    const ch = chOf(value.ch, channel), note = b7(value.note);
    if (name === 'midi/note/off') return { family: 'legacy', ev: { type: 'noteoff', ch, note, vel: 0 } };
    const vel = num(value.velocity) ? b7(value.velocity) : num(value.vel) ? b7(value.vel * 127) : 100;
    return { family: 'legacy', ev: vel > 0 ? { type: 'noteon', ch, note, vel } : { type: 'noteoff', ch, note, vel: 0 } };
  }
  if ((m = LEGACY_CC.exec(name))) return num(value) && +m[1] <= 127 ? { family: 'legacy', ev: { type: 'cc', ch: chOf(channel, 1), cc: +m[1], value: b7(value * 127) } } : null;
  if (name === 'midi/bend') return num(value) ? { family: 'legacy', ev: { type: 'pitchbend', ch: chOf(channel, 1), value: unitToBend(Math.max(-1, Math.min(1, value))) } } : null;
  return null;
}

/** Publish a list of {name, value, pulse, min, max} into a Signals registry, declaring on first sight. */
export function publish(signals, list) {
  if (!signals) return;
  for (const s of list) {
    if (!signals.meta.has(s.name)) signals.define(s.name, s.pulse ? { kind: 'pulse', source: 'midi' } : { min: s.min ?? 0, max: s.max ?? 1, source: 'midi' });
    if (s.pulse) signals.pulse(s.name, s.value); else signals.set(s.name, s.value);
  }
}

/** Human-readable one-liner for logs and the learn UI. */
export function describe(ev) {
  if (!ev) return '?';
  switch (ev.type) {
    case 'noteon': return `Note On  ch${ev.ch} n${ev.note} v${ev.vel}`;
    case 'noteoff': return `Note Off ch${ev.ch} n${ev.note}`;
    case 'cc': return `CC ch${ev.ch} #${ev.cc}=${ev.value}`;
    case 'pitchbend': return `Bend ch${ev.ch} ${bendToUnit(ev.value).toFixed(2)}`;
    case 'chanat': return `Pressure ch${ev.ch} ${ev.value}`;
    case 'polyat': return `Poly AT ch${ev.ch} n${ev.note} ${ev.value}`;
    case 'program': return `Program ch${ev.ch} ${ev.value}`;
    default: return ev.type;
  }
}
