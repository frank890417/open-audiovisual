// take-player.js — record what you play; play it back into the show.
//
// TakeRecorder is an EventLog that listens to midi/* on a Signals bus: press
// record, play, press stop → a take (take.js). TakePlayer re-publishes a take's
// events into the same bus at the right times, so the work — its visuals, its
// sound, its chord detector — cannot tell the take from you playing. That is
// what lets a work's preview play itself.
//
// No stuck notes, ever: the player tracks every key it pressed (in whichever
// spelling it pressed it) and the sustain pedal, and lets go of them on pause,
// stop, seek and at every loop wrap. A recorder stopped mid-chord closes the
// held keys in the take itself.
//
// Live playing wins: with `yieldToLive`, the moment a key goes down that the
// player did not press (your keyboard, the on-screen piano, a phone), the take
// falls silent and you take over; `resumeAfter` brings it back after you stop.

import { EventLog } from './events.js?v=e353777';
import { normalizeTake, noteOf, noteOffFor } from './take.js?v=e353777';

const defaultNow = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
const PEDAL = /\/cc\/64$/;

// while a TakePlayer is publishing, every listener runs inside its call: this is how a
// recorder (overdub: false) and the player's own live detection tell playback from playing
let playbackDepth = 0;

/** Does this event fire (pulse) rather than hold a value? */
function isPulseEvent(name, value) {
  return (value !== null && typeof value === 'object') || /\/note\/(on|off)$/.test(name) || name === 'midi/virtual';
}

/** A live key-down (any spelling except raw bytes, which arrive alongside a named one). */
function defaultIsLive(name, value) {
  const n = noteOf({ name, value });
  return !!(n && n.on && n.family !== 'virtual');
}

export class TakeRecorder extends EventLog {
  /**
   * @param {object} opts
   * @param {object} opts.signals the bus to listen to (`@openav/core` Signals or lab.signals)
   * @param {RegExp|((name:string, value:any, meta?:object) => boolean)} [opts.filter=/^midi\//] which signals are the take
   * @param {string} [opts.name='take']
   * @param {object} [opts.meta] { bpm, device, notes } — copied into the take
   * @param {boolean} [opts.overdub=false] also record what a TakePlayer is playing back right now
   * @param {number} [opts.throttleMs=0] continuous signals (knobs, aftertouch): at most one per name per window
   * @param {() => number} [opts.now] clock in ms (performance.now)
   */
  constructor({ signals, filter = /^midi\//, name = 'take', meta = {}, overdub = false, throttleMs = 0, now = defaultNow } = {}) {
    const test = filter instanceof RegExp ? (n) => filter.test(n) : typeof filter === 'function' ? filter : null;
    super({ now, throttleMs, filter: (n, v, m) => (overdub || playbackDepth === 0) && (!test || test(n, v, m)) });
    this.signals = signals;
    this.name = name;
    this.meta = { ...meta };
    this._held = new Map();     // family|ch:note → noteOf()
    this._pedals = new Map();   // …/cc/64 name → last value
  }

  /** Clear and start listening. Pass `recorder.t0` to line the take up with a video. */
  start(at = this.now()) {
    super.start(at);
    this._held.clear(); this._pedals.clear();
    this.detach();
    if (this.signals) this.attach(this.signals);
    return this;
  }

  add(name, value = null, opts = {}) {
    const ev = super.add(name, value, opts);
    if (ev) {
      const n = noteOf(ev);
      if (n) { const k = n.family + '|' + n.key; if (n.on) this._held.set(k, n); else this._held.delete(k); }
      else if (PEDAL.test(name) && typeof ev.value === 'number') this._pedals.set(name, ev.value);
    }
    return ev;
  }

  /**
   * Stop listening and return the take. Keys still held (and a sustain pedal still
   * down) are released at the stop time, so the take never ends on a stuck note.
   * @returns {{v:1, name:string, createdAt:string|null, durationMs:number, events:object[], meta:object}}
   */
  stop(at = this.now()) {
    if (this.running) {
      const held = [...this._held.values()];
      for (const n of held) for (const off of noteOffFor(n)) this.add(off.name, off.value, { at });
      for (const [name, v] of this._pedals) if (v >= 0.5) this.add(name, 0, { at, pulse: true });
      super.stop(at);
    }
    this.detach();
    return this.toTake();
  }

  toTake({ name = this.name, meta = this.meta } = {}) {
    const take = super.toTake({ name, meta });
    if (!take.meta.device) {
      const d = take.events.find((e) => e.value && typeof e.value === 'object' && typeof e.value.device === 'string' && e.value.device);
      if (d) take.meta.device = d.value.device;
    }
    return take;
  }
}

export class TakePlayer {
  /**
   * @param {object} opts
   * @param {object} opts.signals the bus to publish into
   * @param {object|string} [opts.take] a take (or its JSON); load() another later
   * @param {boolean} [opts.loop=true]
   * @param {number} [opts.speed=1] 0.5 = half speed
   * @param {boolean} [opts.yieldToLive=false] pause when someone plays live
   * @param {number} [opts.resumeAfter=0] seconds of no live playing before a yielded take resumes (0 = stay paused)
   * @param {(name:string, value:any) => boolean} [opts.isLive] what counts as live playing (default: any key-down)
   * @param {boolean} [opts.chase=true] on seek, re-send the controllers' values at that point (pedal, knobs)
   * @param {'raf'|'timer'|'manual'} [opts.clock] who drives time: requestAnimationFrame (default in a page),
   *   a 10 ms timer (tighter for sound, keeps going in a background tab at a slower rate), or you (update(dt) / tick())
   * @param {number} [opts.maxStepMs=250] a longer gap (a frozen tab) is clamped: the take slows, it never bursts
   * @param {(ev:{t:number,name:string,value:any}, player:TakePlayer) => void} [opts.onEvent] every event as it is played
   * @param {(state:string, reason?:string) => void} [opts.onState] 'playing' | 'paused' | 'yielded' | 'stopped'
   * @param {() => number} [opts.now] clock in ms
   */
  constructor({ signals = null, take = null, loop = true, speed = 1, yieldToLive = false, resumeAfter = 0, isLive = defaultIsLive,
    chase = true, clock, maxStepMs = 250, onEvent = null, onState = null, now = defaultNow } = {}) {
    this.signals = signals;
    this.loop = loop;
    this.speed = speed;
    this.yieldToLive = yieldToLive;
    this.resumeAfter = resumeAfter;
    this.isLive = isLive;
    this.chase = chase;
    this.clock = clock || (typeof requestAnimationFrame === 'function' ? 'raf' : 'manual');
    this.maxStepMs = maxStepMs;
    this.onEvent = onEvent;
    this.onState = onState;
    this.now = now;
    this.take = null;
    this.position = 0;          // ms into the take
    this.playing = false;
    this.yielded = false;
    this.loops = 0;
    this._i = 0;
    this._sounding = new Map(); // family|ch:note → noteOf()
    this._pedals = new Map();
    this._idle = 0;
    this._own = 0;              // > 0 while this player publishes
    if (signals) {
      signals.define('take/playing', { min: 0, max: 1, source: 'take', description: '1 while a take plays' });
      signals.define('take/position', { min: 0, max: 1, source: 'take', description: 'how far into the take' });
      this._off = signals.onAny((name, value) => this._onSignal(name, value));
    }
    if (take) this.load(take);
  }

  get duration() { return this.take ? this.take.durationMs : 0; }
  get progress() { return this.duration ? Math.min(1, this.position / this.duration) : 0; }
  get state() { return this.playing ? 'playing' : this.yielded ? 'yielded' : this.position > 0 ? 'paused' : 'stopped'; }

  /** Replace the take (stops the current one, releasing its notes). */
  load(take) {
    this.stop();
    this.take = take ? normalizeTake(take) : null;
    this.position = 0; this._i = 0; this.loops = 0;
    return this;
  }

  /**
   * Play from the current position (from the start after the end), or from `from` ms.
   * @returns {boolean} false when there is nothing to play
   */
  play({ from } = {}) {
    if (!this.take || !this.take.events.length || !this.duration) return false;
    if (from !== undefined) this.seek(from);
    else if (this.position >= this.duration) this.seek(0);
    this.playing = true; this.yielded = false; this._idle = 0;
    this._publishState('playing');
    this._run();
    return true;
  }

  /** Pause where it is; sounding notes are released. */
  pause(reason) {
    const was = this.playing;
    this.playing = false;
    this._releaseAll();
    if (was) this._publishState('paused', reason);
    return this;
  }

  /** Stop and rewind; sounding notes are released. */
  stop() {
    const was = this.playing || this.yielded || this.position > 0;
    this.playing = false; this.yielded = false;
    this._releaseAll();
    this.position = 0; this._i = 0;
    if (was) { this._publishState('stopped'); this._publishPosition(); }
    this._halt();
    return this;
  }

  /** Jump to `ms` (sounding notes released; controllers chased when `chase`). */
  seek(ms) {
    this._releaseAll();
    this.position = Math.max(0, Math.min(this.duration, +ms || 0));
    const ev = this.take ? this.take.events : [];
    let i = 0; while (i < ev.length && ev[i].t < this.position) i++;
    this._i = i;
    if (this.chase && i) this._chaseTo(i);
    this._publishPosition();
    return this;
  }

  /** Advance by `dt` seconds (the Loop's / lab.frame's dt). For clock: 'manual'. */
  update(dt) { this._advance(dt * 1000); }

  /** Advance to clock time `nowMs` (default now()): what the raf and timer clocks call. */
  tick(nowMs = this.now()) {
    const dt = this._last === undefined ? 0 : nowMs - this._last;
    this._last = nowMs;
    this._advance(dt);
  }

  /** Stop, release, unsubscribe. */
  dispose() { this.stop(); if (this._off) { this._off(); this._off = null; } }

  // ---- internals ------------------------------------------------------------------------------

  _onSignal(name, value) {
    if (this._own || playbackDepth || !this.yieldToLive) return;
    if (!this.isLive(name, value)) return;
    this._idle = 0;
    if (this.playing) {
      this.playing = false;
      this.yielded = true;
      this._releaseAll();
      this._publishState('yielded', 'live');
      this._run();          // keep the clock going so resumeAfter can count the silence
    }
  }

  _advance(ms) {
    if (!(ms > 0)) return;
    if (this.yielded && !this.playing) {
      this._idle += ms;
      if (this.resumeAfter > 0 && this._idle >= this.resumeAfter * 1000) {
        this.yielded = false; this.playing = true;
        this._publishState('playing', 'resume');
      }
      return;
    }
    if (!this.playing || !this.take) return;
    const D = this.duration;
    let pos = this.position + Math.min(ms, this.maxStepMs) * this.speed;
    for (let guard = 0; pos >= D && guard < 64; guard++) {
      this._emitUntil(D);
      this._releaseAll();
      if (!this.loop) {
        this.playing = false; this.position = D; this._i = this.take.events.length;
        this._publishPosition(); this._publishState('stopped', 'end');
        return;
      }
      pos -= D; this._i = 0; this.loops++;
    }
    if (pos >= D) pos = 0;
    this._emitUntil(pos);
    this.position = pos;
    this._publishPosition();
  }

  _emitUntil(pos) {
    const ev = this.take.events;
    while (this._i < ev.length && ev[this._i].t <= pos) this._emit(ev[this._i++]);
  }

  _emit(ev) {
    const value = ev.value && typeof ev.value === 'object' ? (Array.isArray(ev.value) ? [...ev.value] : { ...ev.value }) : ev.value;
    const n = noteOf(ev);
    if (n) { const k = n.family + '|' + n.key; if (n.on) this._sounding.set(k, n); else this._sounding.delete(k); }
    else if (PEDAL.test(ev.name) && typeof value === 'number') this._pedals.set(ev.name, value);
    this._own++; playbackDepth++;
    try {
      const s = this.signals;
      if (s) {
        const pulse = isPulseEvent(ev.name, value);
        if (!s.meta.has(ev.name)) s.define(ev.name, pulse ? { kind: 'pulse', source: 'take' } : { min: /bend$/.test(ev.name) ? -1 : 0, max: 1, source: 'take' });
        if (pulse) s.pulse(ev.name, value); else s.set(ev.name, value);
      }
      if (this.onEvent) this.onEvent({ t: ev.t, name: ev.name, value }, this);
    } catch (e) { console.error('[take] ' + ev.name, e); }
    finally { this._own--; playbackDepth--; }
  }

  _releaseAll() {
    const notes = [...this._sounding.values()];
    for (const n of notes) for (const off of noteOffFor(n)) this._emit({ t: this.position, ...off });
    this._sounding.clear();
    for (const [name, v] of [...this._pedals]) if (v >= 0.5) this._emit({ t: this.position, name, value: 0 });
    this._pedals.clear();
  }

  _chaseTo(i) {
    const last = new Map();
    const ev = this.take.events;
    for (let j = 0; j < i; j++) if (typeof ev[j].value === 'number' && !noteOf(ev[j])) last.set(ev[j].name, ev[j]);
    for (const e of last.values()) this._emit(e);
  }

  _publishState(state, reason) {
    if (this.signals) { this._own++; try { this.signals.set('take/playing', this.playing ? 1 : 0); } finally { this._own--; } }
    if (this.onState) { try { this.onState(state, reason); } catch (e) { console.error('[take] onState', e); } }
  }

  _publishPosition() {
    if (this.signals) { this._own++; try { this.signals.set('take/position', this.progress); } finally { this._own--; } }
  }

  _run() {
    this._last = this.now();
    if (this.clock === 'manual' || this._loopOn) return;
    const alive = () => this.playing || (this.yielded && this.resumeAfter > 0);
    this._loopOn = true;
    if (this.clock === 'timer') {
      this._timer = setInterval(() => { if (!alive()) return this._halt(); this.tick(); }, 10);
    } else {
      const step = () => { if (!alive()) return this._halt(); this.tick(); this._raf = requestAnimationFrame(step); };
      this._raf = requestAnimationFrame(step);
    }
  }

  _halt() {
    this._loopOn = false;
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
    if (this._raf) { cancelAnimationFrame(this._raf); this._raf = 0; }
  }
}
