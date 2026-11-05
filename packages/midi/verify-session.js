// @openav/midi · verify-session — checking a profile against a real unit, one control at a time.
//
// The page lights a cell, a person moves that control, and this file compares what arrived with what the
// profile says. It knows nothing about the page: bytes go in through feed(), decisions through accept() /
// reject() / retry() / skip() / absent() / back(), and applyVerification() writes the result into the profile
// JSON. Pure (no DOM, no Web MIDI, no clock), so every rule here is unit-tested without hardware.
//
//   const s = new VerifySession(profile);
//   s.current                        // { id, key, control, expected }: light this one
//   s.feed([0xb0, 74, 100])          // { kind: 'hearing' | 'differs' | 'ignored', … }
//   s.settle()                       // the hand has stopped: a match is recorded, the next step comes up
//
// Hands are messy, so most of what arrives is not an answer. A note-off, aftertouch, clock and the rest of a knob
// sweep after the step moved on are all ignored; only the first new message of a step counts, and a message
// the profile gives to another control is flagged as probably the wrong control rather than offered as a fix.

import { parseMessage } from './parse.js?v=288eccc';
import { normalizeProfile, indexProfile, eventKey, validateProfile } from './profiles.js?v=288eccc';

/** Message types a person can answer with. The rest arrive around an answer, not as one. */
const ANSWERS = new Set(['cc', 'noteon', 'pitchbend', 'chanat', 'program']);
/** Port names that are not a device: a check through one proves nothing about any hardware. */
const VIRTUAL_PORT = /\b(iac|loopmidi|loopbe|virtual|loopback|network session|midi through|bome|teVirtualMIDI|oav)\b/i;
const MESSAGE_FIELDS = ['msg', 'ch', 'cc', 'note', 'from', 'to', 'relative'];

/** The fields of a control that say what it sends. */
export function messageOf(c) {
  const m = {};
  for (const k of MESSAGE_FIELDS) if (c[k] !== undefined && !(k === 'note' && c.msg !== 'note') && !(k === 'relative' && c.type !== 'encoder')) m[k] = c[k];
  return m;
}

/** "CC 74 · ch 1", "Note 36 · ch 10", "Notes 48–72 · ch 1", "Pitch bend · ch 1". */
export function messageText(m) {
  if (!m) return '';
  const ch = `ch ${m.ch}`;
  if (m.msg === 'cc') return `CC ${m.cc} · ${ch}`;
  if (m.from !== undefined) return `Notes ${m.from}–${m.to} · ${ch}`;
  if (m.msg === 'note') return `Note ${m.note} · ${ch}`;
  return `${{ pitchbend: 'Pitch bend', chanat: 'Channel pressure', program: 'Program change' }[m.msg] || m.msg} · ${ch}`;
}

const eventMessage = (ev) => (ev.type === 'cc' ? { msg: 'cc', ch: ev.ch, cc: ev.cc } : ev.type === 'noteon' ? { msg: 'note', ch: ev.ch, note: ev.note } : { msg: ev.type, ch: ev.ch });
const stepKey = (s) => (s.key ? `${s.id}#${s.key}` : s.id);

/**
 * What a run of CC values says about an encoder: one of RELATIVE_MODES, false for absolute, null when it cannot tell.
 * An absolute control never sends the same value twice in a row, and a relative one sits near its centre and repeats.
 * Needs a few clicks in each direction; a single turn one way reads the same in several encodings.
 */
export function inferRelative(values) {
  const v = Array.from(values || []);
  if (v.length < 4) return null;
  const repeats = v.some((x, i) => i && x === v[i - 1]);
  const span = Math.max(...v) - Math.min(...v);
  if (!repeats && span >= v.length - 1 && v.every((x, i) => !i || Math.abs(x - v[i - 1]) <= 8)) return false;
  const near = (c, r = 12) => v.every((x) => x !== c && Math.abs(x - c) <= r);
  const up = v.some((x) => x <= 15), hi = v.some((x) => x >= 113), mid = v.some((x) => x >= 65 && x <= 79);
  if (near(64)) return 'offset64';
  if (near(16)) return 'offset16';
  if (v.every((x) => x <= 15 || x >= 113) && up && hi) return 'twos';
  if (v.every((x) => x <= 15 || (x >= 65 && x <= 79)) && up && mid) return 'signbit';
  return null;
}

/** How a check through this port is logged. Only a port that is not virtual, with a person saying it is a real unit, is `hardware`. */
export function portMethod(portName, { simulated = false, attested = false } = {}) {
  if (simulated) return 'simulated';
  return attested && !VIRTUAL_PORT.test(String(portName || '')) ? 'hardware' : 'virtual';
}

export class VerifySession {
  /**
   * @param {object} profile   the raw profile JSON
   * @param {object} [o]
   * @param {'all'|'unconfirmed'} [o.only='all']   'unconfirmed': only what the file marks `verified: false`
   */
  constructor(profile, { only = 'all' } = {}) {
    this.raw = profile;
    this.p = JSON.parse(JSON.stringify(normalizeProfile(profile)));
    this._reindex();
    this.steps = this._steps(only);
    this.at = 0;
    this.state = this.steps.length ? 'waiting' : 'done';   // waiting → hearing → (next) | differs → (decision)
    this.marks = new Map();          // step key → { result, got?, owner? }
    this.heard = [];                 // events of this step so far
    this.got = null;                 // what arrived instead of the expected message
    this.owner = null;               // the control that message belongs to in the file
    this._trail = new Set();         // messages of the steps just left: the hand is still on that control
  }

  _reindex() { this.index = indexProfile(this.p); }

  _steps(only) {
    const seen = new Set(), order = [];
    for (const sec of this.p.sections) for (const id of sec.controls || []) if (!seen.has(id)) { seen.add(id); order.push(id); }
    for (const c of this.p.controls) if (!seen.has(c.id)) order.push(c.id);
    const out = [];
    for (const id of order) {
      const c = this.p.controls.find((x) => x.id === id);
      if (only === 'unconfirmed' && c.verified !== false) continue;
      if (c.type === 'keys') out.push({ id, key: 'low' }, { id, key: 'high' });
      else out.push({ id, key: null });
    }
    return out;
  }

  /** The step to do now, with its control and the message the file expects; null when the run is over. */
  get current() {
    const s = this.steps[this.at];
    if (!s) return null;
    const control = this.p.controls.find((c) => c.id === s.id);
    return { ...s, control, expected: this._expected(s, control), index: this.at, total: this.steps.length };
  }

  _expected(s, c) {
    if (s.key === 'low') return { msg: 'note', ch: c.ch, note: c.from };
    if (s.key === 'high') return { msg: 'note', ch: c.ch, note: c.to };
    return messageOf(c);
  }

  _keyOf(m) { return m.msg === 'cc' ? `cc:${m.ch}:${m.cc}` : m.msg === 'note' ? `note:${m.ch}:${m.note}` : `${m.msg}:${m.ch}`; }

  /** A message arrived. Returns { kind: 'ignored' | 'hearing' | 'differs', … }. */
  feed(data) {
    const ev = parseMessage(data), step = this.current;
    if (!ev || !step || this.state === 'differs') return { kind: 'ignored' };
    if (!ANSWERS.has(ev.type)) return { kind: 'ignored' };
    if (ev.type === 'chanat' && step.expected.msg !== 'chanat') return { kind: 'ignored' };   // a pad held down, not a new control
    const key = eventKey(ev);
    if (key === this._keyOf(step.expected)) {
      this.state = 'hearing'; this.heard.push(ev);
      return { kind: 'hearing', step };
    }
    if (this.state === 'hearing' || this._trail.has(key)) return { kind: 'ignored' };   // the same hand, a moment later
    const hit = this.index.get(key)?.[0], owner = hit && hit.control.id !== step.id ? hit.control : null;
    this.got = eventMessage(ev); this.owner = owner; this.state = 'differs'; this.heard = [ev];
    return { kind: 'differs', step, got: this.got, owner, confirmed: owner ? this._confirmed(owner.id) : false };
  }

  _confirmed(id) { return [...this.marks].some(([k, m]) => k.split('#')[0] === id && (m.result === 'match' || m.result === 'corrected')); }

  /** The hand has stopped: a step that heard its message is recorded (or, for an encoder that reads wrong, opened as a difference). */
  settle() {
    if (this.state !== 'hearing') return null;
    const step = this.current, c = step.control;
    if (c.type === 'encoder') {
      const seen = inferRelative(this.heard.map((e) => e.value));
      if (seen !== null && seen !== (c.relative ?? false)) {
        this.got = { ...messageOf(c), relative: seen }; this.owner = null; this.state = 'differs';
        return { kind: 'differs', step, got: this.got, owner: null, confirmed: false, encoding: true };
      }
    }
    this._mark({ result: 'match' });
    return { kind: 'match', step };
  }

  _mark(mark) {
    const step = this.steps[this.at];
    this.marks.set(stepKey(step), mark);
    this._advance();
  }
  _advance() {
    const step = this.current;
    if (step) { this._trail = new Set([this._keyOf(step.expected), ...this.heard.map((e) => eventKey(e))]); }
    this.heard = []; this.got = null; this.owner = null;
    this.at++;
    this.state = this.at < this.steps.length ? 'waiting' : 'done';
  }

  /** Use what the unit sent. Refused (false) when the message belongs to a control already confirmed: two controls cannot share one. */
  accept() {
    if (this.state !== 'differs' || !this.got) return false;
    const step = this.current, c = step.control, owner = this.owner;
    if (owner && this._confirmed(owner.id)) return false;
    const was = messageOf(c), got = this.got;
    if (step.key === 'low') Object.assign(c, { ch: got.ch, from: got.note, to: got.note + (c.to - c.from) });
    else if (step.key === 'high') Object.assign(c, { ch: got.ch, to: got.note });
    else {
      if (owner) { const old = messageOf(c); for (const k of ['cc', 'note']) delete owner[k]; Object.assign(owner, { ...old, relative: owner.relative }); if (owner.relative === undefined) delete owner.relative; }
      for (const k of ['cc', 'note']) delete c[k];
      Object.assign(c, got);
    }
    this._reindex();
    this._mark({ result: 'corrected', was, got, ...(owner ? { swapped: owner.id } : {}) });
    return true;
  }
  /** Keep the file as it is and log the difference. */
  reject() {
    if (this.state !== 'differs') return false;
    this._mark({ result: 'mismatch', got: this.got });
    return true;
  }
  /** The wrong control, or a slipped hand: forget this message and listen again. */
  retry() {
    if (this.state !== 'differs') return false;
    this._trail.add(this._keyOf(this.got));
    this.heard = []; this.got = null; this.owner = null; this.state = 'waiting';
    return true;
  }
  /** Leave this control unchecked. */
  skip() { if (this.state === 'done') return false; this.heard = []; this._trailOff(); this._advance(); return true; }
  /** This unit does not have it, or it sends nothing. */
  absent() { if (this.state === 'done') return false; this.heard = []; this._trailOff(); this._mark({ result: 'absent' }); return true; }
  _trailOff() { this.got = null; this.owner = null; }
  /** One step back, forgetting what that step recorded. A correction made there stays in the file's numbers until reset. */
  back() {
    if (this.at === 0) return false;
    this.at--; this.marks.delete(stepKey(this.steps[this.at]));
    this.heard = []; this.got = null; this.owner = null; this._trail = new Set(); this.state = 'waiting';
    return true;
  }

  /** What the LED of one control did when it was sent: 'match' or 'mismatch'. */
  setLed(id, led) { (this.leds ||= new Map()).set(id, led); }

  /** Per control, in `results` form: keys merge their two steps, unchecked controls are left out. */
  results() {
    const out = {};
    for (const c of this.p.controls) {
      const parts = this.steps.filter((s) => s.id === c.id).map((s) => this.marks.get(stepKey(s))).filter(Boolean);
      if (!parts.length) continue;
      const worst = ['mismatch', 'absent', 'corrected', 'match'].find((r) => parts.some((m) => m.result === r));
      const m = parts.find((x) => x.result === worst), led = this.leds?.get(c.id);
      const extra = { ...(m.was ? { was: m.was } : {}), ...(m.got ? { got: m.got } : {}), ...(led ? { led } : {}) };
      out[c.id] = Object.keys(extra).length ? { result: worst, ...extra } : worst;
    }
    return out;
  }

  /** How the run stands: { done, total, match, corrected, mismatch, absent, skipped }. */
  counts() {
    const out = { done: this.at, total: this.steps.length, match: 0, corrected: 0, mismatch: 0, absent: 0, skipped: 0 };
    for (const s of this.steps.slice(0, this.at)) { const m = this.marks.get(stepKey(s)); if (m) out[m.result]++; else out.skipped++; }
    return out;
  }

  /** The mark of one control so far, for painting the faceplate: 'match' | 'corrected' | 'mismatch' | 'absent' | null. */
  markOf(id) {
    const r = this.results()[id];
    return r === undefined ? null : typeof r === 'string' ? r : r.result;
  }
}

/**
 * The profile JSON with this run written into it, ready to save or send.
 * Only `method: 'hardware'` changes anything but the log: a match turns `verified: true`, a correction rewrites the numbers. A virtual
 * or simulated run leaves the numbers and the marks alone and logs its corrections as mismatches.
 * @param {object} raw       the profile as shipped
 * @param {VerifySession} session
 * @param {{date:string, by:string, method:string, firmware?:string, os?:string, browser?:string, port?:string, tool?:string, note?:string}} meta
 * @returns {{profile:object, problems:string[]}}
 */
export function applyVerification(raw, session, meta) {
  const p = JSON.parse(JSON.stringify(raw)), hardware = meta.method === 'hardware';
  const results = session.results(), log = {};
  for (const [id, r] of Object.entries(results)) {
    const c = p.controls.find((x) => x.id === id), res = typeof r === 'string' ? r : r.result;
    if (!hardware) { log[id] = res === 'corrected' ? { result: 'mismatch', got: r.got } : r; continue; }
    log[id] = r;
    if (res === 'match' || res === 'corrected') {
      c.verified = true;
      if (res === 'corrected') {
        const now = session.p.controls.find((x) => x.id === id);
        if (now.msg !== 'note') { if (typeof c.note === 'number') delete c.note; } else c.note = now.note ?? c.note;
        delete c.cc;
        for (const k of MESSAGE_FIELDS) if (k !== 'note' && now[k] !== undefined && (k !== 'relative' || c.type === 'encoder')) c[k] = now[k];
      }
    } else if (c.verified === true) c.verified = false;
  }
  if (hardware) {
    // a swap moved the other control's message too: it was not checked, so it says so
    for (const c of p.controls) {
      const now = session.p.controls.find((x) => x.id === c.id);
      if (results[c.id] !== undefined || JSON.stringify(messageOf(now)) === JSON.stringify(messageOf(normalizeProfile(raw).controls.find((x) => x.id === c.id)))) continue;
      if (c.msg !== 'note' || now.msg !== 'note') delete c.note;
      delete c.cc;
      for (const k of MESSAGE_FIELDS) if (now[k] !== undefined && (k !== 'relative' || c.type === 'encoder')) c[k] = now[k];
      c.verified = false;
    }
  }
  const { date, by, method, firmware, os, browser, port, tool, note } = meta;
  const record = { date, by, method, ...(firmware ? { firmware } : {}), ...(os ? { os } : {}), ...(browser ? { browser } : {}), ...(port ? { port } : {}), ...(tool ? { tool } : {}), ...(note ? { note } : {}), results: log };
  p.verifications = [...(p.verifications || []), record];
  return { profile: p, problems: validateProfile(p) };
}

/** A report for a GitHub issue, as Markdown: who, on what, the counts, and every difference. Kept short enough for a URL. */
export function verificationReport(raw, session, meta, { max = 5500 } = {}) {
  const c = session.counts(), lines = [
    `Checked **${raw.name}** (\`${raw.id}\`) on the [verification page](https://openaudiovisual.com/controllers/verify/).`, '',
    `- Date: ${meta.date}`, `- By: ${meta.by || '?'}`, `- Method: ${meta.method}`, `- Firmware: ${meta.firmware || '?'}`,
    `- OS / browser: ${meta.os || '?'} / ${meta.browser || '?'}`, `- Port: ${meta.port || '?'}`, '',
    `Match ${c.match} · corrected ${c.corrected} · mismatch ${c.mismatch} · sends nothing ${c.absent} · skipped ${c.skipped}`,
  ];
  const diffs = Object.entries(session.results()).filter(([, r]) => typeof r === 'object' && (r.result === 'corrected' || r.result === 'mismatch'));
  if (diffs.length) {
    lines.push('', '| Control | File says | Unit sent |', '|---|---|---|');
    for (const [id, r] of diffs) lines.push(`| \`${id}\` | ${messageText(r.was || messageOf(session.p.controls.find((x) => x.id === id)))} | ${messageText(r.got)} |`);
  }
  lines.push('', 'The updated JSON is attached (or pasted below).');
  let out = lines.join('\n');
  if (out.length > max) out = out.slice(0, max) + '\n\n(cut to fit a link: the JSON has every result)';
  return out;
}

