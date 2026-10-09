// @openav/midi · ports — which MIDI output to use, and what to do when one is unplugged;
// plus the guard against hearing our own messages come back. Pure logic: no Web MIDI needed,
// so it is tested in Node with plain objects shaped like MIDIOutput ({ name, state }).
//
// Lineage: the show engine OAV came from. Its output used to be chosen once. A cable pulled
// mid-show then left every message going into a dead port (swallowed by a try/catch) and the
// DAW silent, with nothing on screen saying why. The rules here are the cure.

/** A port you can still send to. */
export const isLive = (p) => !!p && p.state !== 'disconnected';

/**
 * Pick the output by priority, among the live ones:
 *   1. the port named `preferred` (exact name, then a substring)
 *   2. the first port matching each entry of `prefer` in order (a string = substring, a RegExp)
 *   3. the first port
 */
export function pickOutput(outputs, { preferred = '', prefer = [] } = {}) {
  const live = (outputs || []).filter(isLive);
  const name = (p) => p.name || '';
  if (preferred) {
    const hit = live.find((o) => name(o) === preferred) || live.find((o) => name(o).includes(preferred));
    if (hit) return hit;
  }
  for (const want of prefer) {
    const hit = live.find((o) => (want instanceof RegExp ? want.test(name(o)) : name(o).includes(want)));
    if (hit) return hit;
  }
  return live[0] || null;
}

/**
 * The output list changed (or the current port died): decide what to send to now.
 * Switch when
 *   - the current port is gone or disconnected  → the best live one by priority (or none), or
 *   - the port you asked for by name is back while a stand-in is in use → back to it.
 * Otherwise stay: plugging in an unrelated device never steals the output.
 * Returns { next, changed, reason, text } — `text` is the one line to print, in any language-neutral ASCII.
 */
export function reselectOutput({ current, outputs, preferred = '', prefer = [] }) {
  const listed = (outputs || []).includes(current);
  const alive = isLive(current) && listed;
  const best = pickOutput(outputs, { preferred, prefer });
  const fits = (p) => !!preferred && !!p && ((p.name || '') === preferred || (p.name || '').includes(preferred));
  const back = alive && !!best && best !== current && fits(best) && !fits(current);
  const next = alive && !back ? current : best;
  if (next === current) return { next: current, changed: false, reason: 'same', text: '' };
  const was = current ? `"${current.name}"` : '';
  let reason, text;
  if (!next) { reason = 'none'; text = `MIDI out: no output left (${was} is gone); what is sent is dropped until one appears`; }
  else if (!current) { reason = 'found'; text = `MIDI out: connected to "${next.name}"`; }
  else if (back) { reason = 'back'; text = `MIDI out: back on your choice "${next.name}" (it is plugged in again; was on ${was})`; }
  else { reason = 'fallback'; text = `MIDI out: switched to "${next.name}" (${was} was unplugged)`; }
  return { next, changed: true, reason, text };
}

/** `filterOut` as a RegExp (a source string, a RegExp, or nothing). */
export function inputFilter(filterOut) {
  if (!filterOut) return null;
  return filterOut instanceof RegExp ? filterOut : new RegExp(filterOut, 'i');
}

const keyOf = (bytes) => bytes.length === 3 ? (bytes[0] << 16) | (bytes[1] << 8) | bytes[2] : bytes.join(',');
const isNoteOff = (b) => (b[0] & 0xf0) === 0x80 || ((b[0] & 0xf0) === 0x90 && b[2] === 0);

/**
 * Hears our own voice. Remember what we send; if the same bytes arrive on an input within
 * `window` ms, that is the echo (a virtual cable, a DAW sending it back) and not a performer.
 * Each sent message cancels at most ONE echo, so two real identical messages are not both eaten.
 * A note-off echo matches a note-on with velocity 0 and the reverse, since the DAW may rewrite one as the other.
 */
export class EchoGuard {
  constructor({ window = 40, max = 256 } = {}) {
    this.window = window;
    this.max = max;
    this._sent = [];                    // [{ key, at }]
  }
  /** Record a message we just sent. */
  sent(bytes, now = performance.now()) {
    if (!(this.window > 0) || !bytes || bytes.length < 1 || bytes[0] >= 0xf0) return;     // system messages are not echoed notes
    this._sent.push({ key: this._canon(bytes), at: now });
    if (this._sent.length > this.max) this._sent.splice(0, this._sent.length - this.max);
  }
  /** Is this arriving message our own coming back? (and if so, use up that memory) */
  isEcho(bytes, now = performance.now()) {
    if (!(this.window > 0) || !bytes || !this._sent.length) return false;
    this._sent = this._sent.filter((s) => now - s.at <= this.window);
    const k = this._canon(bytes);
    const i = this._sent.findIndex((s) => s.key === k);
    if (i < 0) return false;
    this._sent.splice(i, 1);
    return true;
  }
  _canon(bytes) {
    // a note-on with velocity 0 is a note-off: compare them as one thing
    if (bytes.length === 3 && isNoteOff(bytes)) return keyOf([0x80 | (bytes[0] & 0x0f), bytes[1], 0]);
    return keyOf(bytes);
  }
  clear() { this._sent = []; }
}
