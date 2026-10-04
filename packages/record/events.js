// events.js — EventLog: what was played, and when, on the recording's clock.
//
// A video keeps the picture and the sound; the log keeps the *score* of the take:
// every note, pad hit and (throttled) hand position, timestamped in ms from the
// moment the recorder started. With it a take can be re-rendered at another size,
// re-synced to a better audio take, or turned into MIDI later.
//
// Pure apart from the default clock (performance.now): pass `now` to test it.

const defaultNow = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/**
 * A JSON-safe copy of a signal value: numbers rounded to 6 decimals, typed arrays
 * → arrays, nested objects to depth 4 (deeper → null), non-finite numbers → null;
 * functions / symbols / undefined → null in arrays, dropped as object keys.
 * @param {*} v @param {number} [depth]
 * @returns {*}
 */
export function cleanValue(v, depth = 0) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : null;
  if (typeof v === 'string' || typeof v === 'boolean') return v;
  if (typeof v === 'bigint') return Number(v);
  if (typeof v !== 'object' || depth >= 4) return null;
  if (ArrayBuffer.isView(v)) return Array.from(/** @type {any} */ (v), (x) => cleanValue(x, depth + 1));
  if (Array.isArray(v)) return v.map((x) => cleanValue(x, depth + 1));
  const out = {};
  for (const k of Object.keys(v)) {
    const x = v[k];
    if (x === undefined || typeof x === 'function' || typeof x === 'symbol') continue;   // not data: the key goes
    out[k] = cleanValue(x, depth + 1);
  }
  return out;
}

const round01 = (ms) => Math.round(ms * 10) / 10;

export class EventLog {
  /**
   * @param {object} [opts]
   * @param {() => number} [opts.now] clock in ms (default performance.now — the same clock as Recorder.t0)
   * @param {(name:string, value:any, meta?:object) => boolean} [opts.filter] keep an event? (applies to add() too)
   * @param {number} [opts.throttleMs=0] continuous signals: at most one event per name per window; pulses are never throttled
   */
  constructor({ now = defaultNow, filter = null, throttleMs = 0 } = {}) {
    this.now = now;
    this.filter = filter;
    this.throttleMs = throttleMs;
    /** @type {{t:number, name:string, value:any}[]} */
    this.events = [];
    this.t0 = null;
    this.startedAt = null;    // wall clock (ISO) — when the take was made
    this.durationMs = null;
    this._last = new Map();   // name → t of the last kept continuous event
    this._unsubs = [];
  }

  get running() { return this.t0 !== null && this.durationMs === null; }

  /**
   * Start a take: clears the log. Pass the recorder's start time (`recorder.t0`)
   * so event times line up with the video's first frame.
   * @param {number} [at] clock time of t = 0
   */
  start(at = this.now()) {
    this.events = [];
    this._last.clear();
    this.t0 = at;
    this.durationMs = null;
    this.startedAt = new Date().toISOString();
    return this;
  }

  /** End the take; later events are ignored. */
  stop(at = this.now()) {
    if (this.running) this.durationMs = round01(at - this.t0);
    return this;
  }

  /**
   * Log one event. Ignored (returns null) when not running, filtered out, or throttled.
   * @param {string} name e.g. 'midi/note/on', 'param/hue', 'mark'
   * @param {*} [value]
   * @param {{ at?: number, pulse?: boolean, meta?: object }} [opts]
   *   `pulse: false` makes it subject to throttling (attach() sets it from the signal's kind)
   * @returns {{t:number, name:string, value:any} | null}
   */
  add(name, value = null, { at = this.now(), pulse = true, meta } = {}) {
    if (!this.running) return null;
    if (this.filter && !this.filter(name, value, meta)) return null;
    const t = round01(at - this.t0);
    if (t < 0) return null;
    if (!pulse && this.throttleMs > 0) {
      const last = this._last.get(name);
      if (last !== undefined && t - last < this.throttleMs) return null;
      this._last.set(name, t);
    }
    const ev = { t, name, value: cleanValue(value) };
    this.events.push(ev);
    return ev;
  }

  /** A labelled marker ("chorus", "take 2 starts here") — shows up as name 'mark'. */
  mark(label, data = null) { return this.add('mark', data ? { label, ...data } : { label }); }

  /**
   * Log every signal a `Signals` registry publishes (`signals.onAny`). Pulses
   * (`midi/note/on`…) are always kept; continuous signals obey `throttleMs`.
   * @param {{onAny: Function}} signals
   * @returns {() => void} detach
   */
  attach(signals) {
    const off = signals.onAny((name, value, meta) => {
      this.add(name, value, { pulse: !meta || meta.kind === 'pulse', meta });
    });
    this._unsubs.push(off);
    return () => { off(); this._unsubs = this._unsubs.filter((u) => u !== off); };
  }

  /** Detach from every registry. */
  detach() { for (const u of this._unsubs.splice(0)) u(); }

  /** Events with start ≤ t < end (ms). */
  between(start, end) { return this.events.filter((e) => e.t >= start && e.t < end); }

  /** @returns {{format:'openav-eventlog', version:1, startedAt:string|null, durationMs:number|null, count:number, events:{t:number,name:string,value:any}[]}} */
  toJSON() {
    return {
      format: 'openav-eventlog', version: 1,
      startedAt: this.startedAt, durationMs: this.durationMs,
      count: this.events.length,
      events: this.events.map((e) => ({ t: e.t, name: e.name, value: e.value })),
    };
  }

  /**
   * The log as a take (see take.js): `{ v: 1, name, createdAt, durationMs, events, meta }`.
   * A take is an EventLog filtered to midi/* — TakeRecorder is exactly that.
   * @param {{ name?: string, meta?: object }} [opts]
   */
  toTake({ name = 'take', meta = {} } = {}) {
    const last = this.events.length ? this.events[this.events.length - 1].t : 0;
    return {
      v: 1, name, createdAt: this.startedAt,
      durationMs: Math.max(last, this.durationMs ?? 0),
      events: this.events.map((e) => ({ t: e.t, name: e.name, value: e.value })),
      meta: { ...meta },
    };
  }

  /**
   * Rebuild a (stopped) log from toJSON() output or its string.
   * @param {object|string} json @returns {EventLog}
   */
  static fromJSON(json) {
    const d = typeof json === 'string' ? JSON.parse(json) : json;
    if (!d || d.format !== 'openav-eventlog' || !Array.isArray(d.events)) throw new TypeError('EventLog.fromJSON: not an openav-eventlog');
    const log = new EventLog();
    log.t0 = 0;
    log.startedAt = d.startedAt ?? null;
    log.durationMs = d.durationMs ?? (d.events.length ? d.events[d.events.length - 1].t : 0);
    log.events = d.events.map((e) => ({ t: +e.t, name: String(e.name), value: e.value ?? null }));
    return log;
  }
}
