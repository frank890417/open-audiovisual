// @openav/midi · sysex — a device's System Exclusive messages as DATA.
//
// Switching a Launchpad to Programmer mode, picking a Launch Control XL template, lighting a pad in any
// RGB colour: these are the messages that turn a controller from "a thing that sends CCs" into a surface
// a show can set up on its own. A profile lists them with what each one is for and where the bytes came
// from; this file reads that list and builds the bytes. Pure (no Web MIDI), so every rule is unit-tested
// without hardware. Sending lives in index.js and always waits for someone to ask: a browser shows a
// permission prompt for SysEx, and nobody should meet that prompt just by opening a page.
//
//   "sysex": {
//     "messages": [
//       { "id": "programmer-mode", "purpose": "mode", "label": "Programmer mode", "undo": "live-mode",
//         "bytes": "F0 00 20 29 02 0D 0E 01 F7", "cite": { "source": 0, "where": "p. 7" } },
//       { "id": "led-rgb", "purpose": "led", "label": "Light one pad in any colour",
//         "bytes": "F0 00 20 29 02 0D 03 03 {led} {r} {g} {b} F7",
//         "args": [{ "name": "led", "min": 11, "max": 99 }, { "name": "r" }, { "name": "g" }, { "name": "b" }] }
//     ],
//     "connect": ["programmer-mode"]        // what a host sends on connect, once the user has switched SysEx on
//   }
//
// In `bytes`, a token is one hex byte or {name}: an argument, one 7-bit byte. {name.msb} and {name.lsb} split a
// value too big for one byte into the two 7-bit halves a device asks for (AKAI's 8-bit colours).

export const SYSEX_PURPOSES = ['identity', 'init', 'mode', 'template', 'led', 'display', 'config', 'transport'];
export const SYSEX_DIRECTIONS = ['out', 'in'];
const ID_RE = /^[a-z0-9][a-z0-9_-]*$/;
const TOKEN = /^\{([a-zA-Z][a-zA-Z0-9_]*)(?:\.(msb|lsb))?\}$/;
const isInt = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;

/** "F0 7E 7F 06 01 F7" (any spacing, 0x or trailing h allowed) → [240, 126, 127, 6, 1, 247]. Throws on anything else. */
export function parseHex(text) {
  const out = String(text).trim().split(/[\s,]+/).filter(Boolean).map((t) => {
    const m = /^(?:0x)?([0-9a-fA-F]{1,2})h?$/.exec(t);
    if (!m) throw new Error(`"${t}" is not a hex byte`);
    return parseInt(m[1], 16);
  });
  return out;
}

/** [240, 126, 127, 6, 1, 247] → "F0 7E 7F 06 01 F7". */
export const formatHex = (bytes) => Array.from(bytes || [], (b) => (b & 0xff).toString(16).toUpperCase().padStart(2, '0')).join(' ');

/** The tokens of a `bytes` template: [{ byte }, { arg, part }…]. Throws with the reason when one does not parse. */
export function parseSysexTemplate(text) {
  return String(text).trim().split(/\s+/).filter(Boolean).map((t) => {
    const m = TOKEN.exec(t);
    if (m) return { arg: m[1], part: m[2] || null };
    if (!/^[0-9a-fA-F]{2}$/.test(t)) throw new Error(`"${t}" is neither a hex byte nor {name}`);
    return { byte: parseInt(t, 16) };
  });
}

/** Every problem with one message of a profile's `sysex.messages`, as strings ([] = valid). */
function checkMessage(m, at, nSources) {
  const errs = [];
  if (!m || typeof m !== 'object') return [`${at}: must be an object`];
  if (!ID_RE.test(m.id || '')) errs.push(`${at}: id must be lower-case [a-z0-9_-]`);
  if (!SYSEX_PURPOSES.includes(m.purpose)) errs.push(`${at}: purpose must be one of ${SYSEX_PURPOSES.join(' ')}`);
  if (m.dir !== undefined && !SYSEX_DIRECTIONS.includes(m.dir)) errs.push(`${at}: dir must be out or in`);
  if (!m.label || typeof m.label !== 'string') errs.push(`${at}: needs a label (what it does, in words)`);
  if (m.verified !== undefined && typeof m.verified !== 'boolean') errs.push(`${at}: verified must be true or false`);
  // every message says where its bytes came from: a wrong one can leave a unit in a mode nobody can find the way out of
  if (!m.cite || !isInt(m.cite.source, 0, Math.max(0, nSources - 1)) || nSources === 0) errs.push(`${at}: cite.source must be an index into sources`);
  let tokens = null;
  try { tokens = parseSysexTemplate(m.bytes || ''); } catch (e) { errs.push(`${at}: bytes: ${e.message}`); }
  if (tokens) {
    if (tokens[0]?.byte !== 0xf0 || tokens[tokens.length - 1]?.byte !== 0xf7) errs.push(`${at}: bytes must start with F0 and end with F7`);
    for (const t of tokens.slice(1, -1)) if (t.byte !== undefined && t.byte > 0x7f) errs.push(`${at}: data byte ${t.byte.toString(16).toUpperCase()} is above 7F`);
    const declared = new Map((Array.isArray(m.args) ? m.args : []).map((a) => [a && a.name, a]));
    const used = new Set(tokens.filter((t) => t.arg).map((t) => t.arg));
    for (const n of used) if (!declared.has(n)) errs.push(`${at}: {${n}} is used in bytes but not declared in args`);
    for (const [n, a] of declared) {
      if (!used.has(n)) errs.push(`${at}: arg "${n}" is declared but not used in bytes`);
      const split = tokens.some((t) => t.arg === n && t.part);
      const top = split ? 16383 : 127, min = a?.min ?? 0, max = a?.max ?? 127;
      if (!isInt(min, 0, top) || !isInt(max, 0, top) || min > max) errs.push(`${at}: arg "${n}" needs 0 ≤ min ≤ max ≤ ${top}`);
      if (a?.default !== undefined && !isInt(a.default, min, max)) errs.push(`${at}: arg "${n}" default is outside min..max`);
    }
  }
  return errs;
}

/** Every problem with a profile's `sysex` block, as strings. A profile without one has none. */
export function validateSysexBlock(p) {
  const s = p.sysex;
  if (s === undefined) return [];
  if (!s || typeof s !== 'object' || !Array.isArray(s.messages)) return ['sysex.messages must be an array'];
  const errs = [], ids = new Set(), nSources = (p.sources || []).length;
  for (const [i, m] of s.messages.entries()) {
    const at = `sysex.messages[${i}]${m && m.id ? ` (${m.id})` : ''}`;
    errs.push(...checkMessage(m, at, nSources));
    if (m && m.id) { if (ids.has(m.id)) errs.push(`${at}: duplicate id`); ids.add(m.id); }
  }
  const byId = new Map(s.messages.filter(Boolean).map((m) => [m.id, m]));
  for (const m of s.messages) if (m && m.undo !== undefined && !byId.has(m.undo)) errs.push(`sysex.messages (${m.id}): undo "${m.undo}" is not a message here`);
  for (const id of s.connect ?? []) {
    const m = byId.get(id);
    if (!m) errs.push(`sysex.connect: "${id}" is not a message here`);
    else if (m.dir === 'in') errs.push(`sysex.connect: "${id}" is something the device sends, it cannot be sent to it`);
    else if ((m.args || []).some((a) => a.default === undefined)) errs.push(`sysex.connect: "${id}" has an argument without a default, so it cannot be sent unattended`);
  }
  return errs;
}

/** One message of a profile by id, or null. */
export const sysexMessage = (p, id) => p?.sysex?.messages?.find((m) => m.id === id) ?? null;

/**
 * The bytes of a message with its arguments filled in, ready for `output.send()`.
 * @param {object} message   an entry of `sysex.messages`
 * @param {Object<string,number>} [args]   name → value; a missing one takes its `default`
 * @returns {number[]}
 * @throws when an argument is missing or outside its min..max (a wrong byte in SysEx is not a harmless typo)
 */
export function sysexBytes(message, args = {}) {
  const spec = new Map((message.args || []).map((a) => [a.name, a]));
  return parseSysexTemplate(message.bytes).map((t) => {
    if (t.byte !== undefined) return t.byte;
    const a = spec.get(t.arg), v = args[t.arg] ?? a?.default;
    if (!Number.isInteger(v)) throw new Error(`SysEx "${message.id}": argument "${t.arg}" is missing`);
    const min = a?.min ?? 0, max = a?.max ?? 127;
    if (v < min || v > max) throw new Error(`SysEx "${message.id}": ${t.arg} = ${v} is outside ${min}..${max}`);
    return t.part === 'msb' ? (v >> 7) & 0x7f : t.part === 'lsb' ? v & 0x7f : v;
  });
}

/**
 * The bytes that light one control in a colour, from the profile's `led` messages and the control's `ledIndex`; null when it has neither.
 * Colours come in as 0..255 and are scaled to what the message takes (Novation 0..127, AKAI 0..255).
 * @param {object} p   a profile
 * @param {object} control   one of its controls
 * @param {{r:number,g:number,b:number}|{color:number}} color   any RGB, or a palette value
 * @returns {number[]|null}
 */
export function ledSysex(p, control, color) {
  if (control?.ledIndex === undefined) return null;
  const leds = (p?.sysex?.messages || []).filter((m) => m.purpose === 'led' && m.dir !== 'in');
  const takes = (m, ...names) => names.every((n) => (m.args || []).some((a) => a.name === n));
  if (color && 'r' in color) {
    const m = leds.find((x) => takes(x, 'led', 'r', 'g', 'b'));
    if (!m) return null;
    const scale = (name) => { const top = m.args.find((a) => a.name === name).max ?? 127; return Math.round((Math.max(0, Math.min(255, color[name])) / 255) * top); };
    return sysexBytes(m, { led: control.ledIndex, r: scale('r'), g: scale('g'), b: scale('b') });
  }
  const m = leds.find((x) => takes(x, 'led', 'color'));
  return m ? sysexBytes(m, { led: control.ledIndex, color: color?.color }) : null;
}

/**
 * The reply to the Universal Device Inquiry (send `DEVICE_INQUIRY`), or null for anything else.
 * Every firmware version a verification record stores can come from here, so nobody has to dig through a menu.
 * @returns {{manufacturer:number[], family:number[], model:number[], version:number[], text:string}|null}
 */
export function parseDeviceInquiry(data) {
  const b = Array.from(data || []);
  if (b.length < 15 || b[0] !== 0xf0 || b[1] !== 0x7e || b[3] !== 0x06 || b[4] !== 0x02 || b[b.length - 1] !== 0xf7) return null;
  const idLen = b[5] === 0 ? 3 : 1, at = 5 + idLen;
  // AKAI's protocols put a length (00 19) after a one-byte model where the specification has family and model: the version moves by one
  const akai = b[5] === 0x47 && b[7] === 0 && b[8] === 0x19, from = akai ? 9 : at + 4;
  const version = b.slice(from, from + 4);
  return { manufacturer: b.slice(5, at), family: akai ? [b[6]] : b.slice(at, at + 2), model: akai ? [b[6]] : b.slice(at + 2, at + 4), version, text: version.join('.') };
}

/** Universal Device Inquiry, to all devices: any MIDI 1.0 device that implements it answers with its maker and firmware. */
export const DEVICE_INQUIRY = [0xf0, 0x7e, 0x7f, 0x06, 0x01, 0xf7];
