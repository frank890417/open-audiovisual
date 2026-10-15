// @openav/midi · clock — follow an external MIDI clock: 0xF8 ×24 a beat, start / continue / stop, song position.
//
// Another program keeps the time (Strudel's `midicmd("clock*96, <start stop>/4").midi('OAV Virtual MIDI')`, a DAW over
// IAC, a drum machine on a cable) and the page follows it: its tempo, where bar 1 starts, how far through the bar it is.
//
//   const clk = new MidiClock();
//   clk.feed([0xFA], t)   // start, heard at t (seconds, any clock: the caller's; MIDI timestamps / 1000)
//   clk.feed([0xF8], t)   // clock ticks
//   clk.bpm               // 120.0, from the last 24 ticks
//   clk.phaseAt(t)        // { pos: bars since the start, bar 0..1, beat 0..1, bpm, running }
//
// Pure: no timers, no Web MIDI. Every message carries its own time, because the programs that send clock schedule ahead
// (Strudel sends each byte 0.2–0.3 s early with a timestamp; a hardware port delivers it on time with the time it came
// in). So messages may arrive early and slightly out of order, and the same start can come more than once.
//
// The rules, from the MIDI 1.0 specification's System Real Time messages, and what was measured on strudel.cc:
// - Start: the next clock is the downbeat of bar 1 (position 0). A clock with the same timestamp as the start counts as
//   that first clock, whichever of the two arrived first (Strudel sends them in one batch, in no fixed order).
// - The same start / continue / stop with the same timestamp (within 1 ms) is one message: Strudel's first start came
//   three times with one timestamp.
// - Stop: the position holds; clocks may keep coming (tempo still known). Continue: on from where it stopped, or from a
//   Song Position Pointer (0xF2, in 16ths) sent while stopped.
// - Clocks with no start at all (a pattern that sends only `clock`): the tempo is followed, and the first clock after a
//   silence (> `gap` s) is taken as a downbeat, so a phase is there too; a real start replaces it.
// - Tempo: a straight line through the last `window` clocks (least squares), so one late clock moves nothing much.

const SPP_TICKS = 6;     // a Song Position Pointer counts MIDI beats: 16ths, 6 clocks each

export class MidiClock {
  /** @param {{ppq?:number, beatsPerBar?:number, window?:number, gap?:number, lost?:number}} [o]
   *    ppq 24 (the standard), beatsPerBar 4, window: clocks the tempo is fitted over, gap: seconds of silence after
   *    which a clock starts anew, lost: seconds without a clock after which `state` says so */
  constructor({ ppq = 24, beatsPerBar = 4, window = 24, gap = 0.5, lost = 0.6 } = {}) {
    Object.assign(this, { ppq, beatsPerBar, window, gap, lostAfter: lost });
    this.reset();
  }
  reset() {
    this._ticks = [];        // recent clock times, sorted (seconds)
    this._run = null;        // { from, to, base, dropped, implicit }
    this._last = { 0xFA: null, 0xFB: null, 0xFC: null };   // the last start / continue / stop time (dedupe)
    this._spp = null;        // a Song Position Pointer waiting for continue (clocks)
    this._fit = null;        // { a, b } t = a + b·k over the current run's clocks; or null
    this._tempo = null;      // seconds per clock
    this.stats = { clocks: 0, dupes: 0, starts: 0, stops: 0, continues: 0, lastAt: null, lastStartAt: null, lastStopAt: null };
  }
  /** beats a minute (null until two clocks came) */
  get bpm() { return this._tempo ? 60 / (this._tempo * this.ppq) : null; }
  /** clocks in a bar */
  get perBar() { return this.ppq * this.beatsPerBar; }
  /** the transport is running (started or continued, not stopped since); a clock-only stream runs too */
  get running() { return !!this._run && this._run.to === Infinity; }
  /** 'none' (no clock yet) · 'running' · 'stopped' · 'lost' (no clock for `lost` s before `t`) */
  state(t) {
    if (this.stats.lastAt == null && !this._run) return 'none';
    if (t != null && this.stats.lastAt != null && t - this.stats.lastAt > this.lostAfter) return 'lost';
    return this.running ? 'running' : 'stopped';
  }

  /** one message (the status byte first) heard at time t → what it was: 'clock' · 'start' · 'continue' · 'stop' · 'spp'
   *  · 'dupe' (said already) · null (not a clock message) */
  feed(bytes, t) {
    const s = bytes && bytes[0];
    if (!(t >= 0 || t < 0)) return null;               // no time: nothing to place it at
    if (s === 0xF8) return this._clock(t);
    if (s === 0xFA || s === 0xFB || s === 0xFC) {
      const prev = this._last[s];
      if (prev != null && Math.abs(prev - t) <= 0.001) { this.stats.dupes++; return 'dupe'; }
      this._last[s] = t;
      if (s === 0xFA) return this._start(t);
      if (s === 0xFB) return this._continue(t);
      return this._stop(t);
    }
    if (s === 0xF2) {                                   // Song Position Pointer: 14 bits of 16ths, for the next continue
      this._spp = (((bytes[2] & 127) << 7) | (bytes[1] & 127)) * SPP_TICKS;
      return 'spp';
    }
    return null;
  }

  _clock(t) {
    const a = this._ticks;
    for (let i = a.length - 1; i >= 0 && i >= a.length - 4; i--) if (Math.abs(a[i] - t) < 0.0005) { this.stats.dupes++; return 'dupe'; }
    const prevLast = this.stats.lastAt;
    // after a silence, a clock-only stream starts again (a run that a real start opened is left alone)
    if (prevLast != null && t - prevLast > this.gap && (!this._run || this._run.implicit)) { this._ticks = []; if (this._run && this._run.implicit) this._run = null; }
    let i = this._ticks.length;
    while (i > 0 && this._ticks[i - 1] > t) i--;
    this._ticks.splice(i, 0, t);
    this.stats.clocks++;
    if (this.stats.lastAt == null || t > this.stats.lastAt) this.stats.lastAt = t;
    if (!this._run && this._last[0xFA] == null && this._last[0xFB] == null) this._run = { from: t, to: Infinity, base: 0, dropped: 0, implicit: true };
    while (this._ticks.length > Math.max(96, this.window * 4)) {
      const old = this._ticks.shift();
      if (this._run && old >= this._run.from - 0.001 && old < this._run.to - 0.001) this._run.dropped++;
    }
    this._refit();
    return 'clock';
  }
  _start(t) {
    this.stats.starts++; this.stats.lastStartAt = t;
    this._spp = null;
    this._run = { from: t, to: Infinity, base: 0, dropped: 0, implicit: false };
    this._refit();
    return 'start';
  }
  _continue(t) {
    this.stats.continues++;
    const base = this._spp != null ? this._spp : this._run ? this._count(this._run) : 0;
    this._spp = null;
    this._run = { from: t, to: Infinity, base, dropped: 0, implicit: false };
    this._refit();
    return 'continue';
  }
  _stop(t) {
    this.stats.stops++; this.stats.lastStopAt = t;
    if (this._run && this._run.to === Infinity) this._run.to = t;
    return 'stop';
  }
  /** the clocks counted in a run so far (its base, those that left the window, those in it) */
  _count(r) { return r.base + r.dropped + this._inRun(r).length; }
  _inRun(r) { return this._ticks.filter((x) => x >= r.from - 0.001 && x < r.to - 0.001); }

  _refit() {
    // tempo: every recent clock, after the last silence
    const a = this._ticks;
    let from = 0;
    for (let i = a.length - 1; i > 0; i--) if (a[i] - a[i - 1] > this.gap) { from = i; break; }
    const recent = a.slice(Math.max(from, a.length - this.window));
    if (recent.length >= 2) this._tempo = line(recent.map((x, k) => [k, x])).b;
    // position: the current run's clocks, numbered from its first
    const r = this._run;
    this._fit = null;
    if (!r) return;
    const mine = this._inRun(r), k0 = r.base + r.dropped;
    const pts = mine.map((x, k) => [k0 + k, x]).slice(-this.window);
    if (pts.length >= 2) this._fit = line(pts);
    else if (this._tempo) {
      const [k, x] = pts.length ? pts[0] : [r.base, r.from];   // no clock of the run yet: its first is due at the start
      this._fit = { a: x - this._tempo * k, b: this._tempo };
    }
  }
  /** the clock count heard at t (fractional): 0 at the run's first clock; null without a tempo */
  ticksAt(t) {
    const f = this._fit, r = this._run;
    if (!f || !r || !(f.b > 0)) return null;
    const tt = Math.min(t, r.to);                       // stopped: the position holds where it stopped
    return (tt - f.a) / f.b;
  }
  /** where the music is at time t: { pos (bars since the start; 0 = the downbeat of bar 1), bar 0..1, beat 0..1,
   *  bpm, running } — or null while there is no tempo or no run */
  phaseAt(t) {
    const k = this.ticksAt(t);
    if (k == null) return null;
    const pos = Math.max(0, k) / this.perBar, beats = pos * this.beatsPerBar;
    const frac = (x) => Math.max(0, x - Math.floor(x + 1e-9));   // a clock's own time is the start of its beat, not 0.99999
    return { pos, bar: frac(pos), beat: frac(beats), bpm: this.bpm, running: this.running && t >= this._run.from - 0.001 };
  }
  /** one point of the current run to steer by: { pos (bars), at (time), bpm } at its latest clock (or at its start, before
   *  the first) — never a point before the start, where the position is held at 0 */
  anchor() {
    const r = this._run;
    if (!r || !this._fit || !this.bpm) return null;
    const mine = this._inRun(r), last = mine.length ? mine[mine.length - 1] : null;
    const at = last != null && last >= r.from - 0.001 ? last : r.from, k = this.ticksAt(at);
    return k == null ? null : { pos: k / this.perBar, at, bpm: this.bpm };
  }
  /** the time position `pos` (bars) is heard, on the current fit (null without one) */
  timeAt(pos) { const f = this._fit; return f ? f.a + f.b * pos * this.perBar : null; }
  /** where the current run started (its first clock's time) */
  get startedAt() { return this._run ? this._run.from : null; }
  get implicit() { return !!(this._run && this._run.implicit); }
  info(t) {
    return { state: this.state(t), bpm: this.bpm == null ? null : Math.round(this.bpm * 100) / 100, running: this.running, implicit: this.implicit,
      clocks: this.stats.clocks, dupes: this.stats.dupes, starts: this.stats.starts, stops: this.stats.stops, continues: this.stats.continues };
  }
}

/** least squares through [x, y] points → { a, b } with y = a + b·x */
function line(pts) {
  const n = pts.length;
  if (n === 1) return { a: pts[0][1], b: 0 };
  let sx = 0, sy = 0;
  for (const [x, y] of pts) { sx += x; sy += y; }
  const mx = sx / n, my = sy / n;
  let sxx = 0, sxy = 0;
  for (const [x, y] of pts) { sxx += (x - mx) * (x - mx); sxy += (x - mx) * (y - my); }
  const b = sxx > 0 ? sxy / sxx : 0;
  return { a: my - b * mx, b };
}
