// Loop — requestAnimationFrame loop with dt clamp, FPS estimate, and a
// hidden-tab fallback: browsers freeze rAF when the page is hidden, but a
// performance must not stop because someone alt-tabbed the projection window —
// the timeline, mapped signals, OSC and the backstage feed all live in this
// loop. When rAF stalls, a low-rate setInterval (~30fps) keeps the show alive.
// (Lesson inherited from The Last Input: never tie show-time to paint-time.)
//
// Who supplies the time is a choice, and the default is the page's own:
//   new Loop(fn)                          requestAnimationFrame + performance.now + the hidden-tab Worker
//   new Loop(fn, { clock, raf })          your sources: a test's fake timer, a recorder's frame pump. No Worker (a real timer
//                                         must not step a fake clock); `heartbeat: true` turns it back on.
//   new Loop(fn, { manual: true })        nothing is scheduled: you call loop.step(dt) and each call is one frame
// loop.step(dt) works on any loop, started or not. That is how a show is recorded frame by frame, unit-tested or run
// headless for a night without replacing the global requestAnimationFrame / performance.now.
export class Loop {
  /**
   * @param {(dt:number, now:number)=>void} onFrame  dt in seconds, now in ms (the same clock as `clock`; in a manual loop: virtual)
   * @param {object} [o]
   * @param {number} [o.maxDt=0.1]        clamp for automatic frames, so a stall never makes a world explode
   * @param {()=>number} [o.clock]        milliseconds, monotonic (default performance.now)
   * @param {(cb:(now?:number)=>void)=>any} [o.raf]   schedules one callback for the next frame (default requestAnimationFrame);
   *                                      the callback may be given a timestamp, else `clock()` is read
   * @param {boolean} [o.manual=false]    no scheduling at all: frames come from step(dt)
   * @param {boolean} [o.heartbeat]       the hidden-tab Worker; default on with the real rAF, off with an injected `raf` or `manual`
   */
  constructor(onFrame, { maxDt = 0.1, clock, raf, manual = false, heartbeat } = {}) {
    this.onFrame = onFrame;
    this.maxDt = maxDt;      // clamp big gaps so worlds don't explode
    this.manual = !!manual;
    this.running = false;
    this.fps = 0;
    this._clock = typeof clock === 'function' ? clock : () => performance.now();
    this._raf = typeof raf === 'function' ? raf : null;
    this._heartbeat = heartbeat ?? (!this._raf && !this.manual);
    this._gen = 0;           // every start() opens a new chain of frames; an older chain stops itself
    this._last = 0;
    this._lastTickAt = 0;
    this._fpsAcc = 0; this._fpsN = 0; this._fpsAt = 0;
  }
  _frame(dt, now) {
    // fps: rolling 0.5s window
    this._fpsAcc += dt; this._fpsN++;
    if (now - this._fpsAt > 500) { this.fps = this._fpsAcc > 0 ? Math.round(this._fpsN / this._fpsAcc) : 0; this._fpsAcc = 0; this._fpsN = 0; this._fpsAt = now; }
    try { this.onFrame(dt, now); } catch (e) { console.error('[loop]', e); }
  }
  _step(now) {
    let dt = (now - this._last) / 1000;
    this._last = now;
    this._lastTickAt = now;
    if (dt > this.maxDt) dt = this.maxDt;
    if (dt <= 0) return;
    this._frame(dt, now);
  }
  /**
   * One frame of `dt` seconds, now. Not clamped (you chose that dt; a manual loop has no stall to guard against). `dt = 0`
   * is a frame too (redraw in place). The time passed on to onFrame moves on by dt, from where the loop's own time stood
   * (0 for a loop that has not run). Returns false, running nothing, when dt is not a finite number >= 0.
   * Meant for manual loops; on an automatic one it just adds a frame (and the loop's time jumps with it).
   * @param {number} dt seconds
   * @returns {boolean}
   */
  step(dt) {
    if (typeof dt !== 'number' || !Number.isFinite(dt) || dt < 0) return false;
    const now = this._last + dt * 1000;
    this._last = now;
    this._lastTickAt = now;
    this._frame(dt, now);
    return true;
  }
  start() {
    if (this.running) return;
    if (this.manual) { this.running = true; return; }
    const raf = this._raf || (typeof requestAnimationFrame === 'function' ? (cb) => requestAnimationFrame(cb) : null);
    if (!raf) throw new Error('Loop: there is no requestAnimationFrame here. Pass { raf } (and { clock }) to drive it yourself, or { manual: true } and call loop.step(dt).');
    this.running = true;
    this._last = this._clock();
    const gen = ++this._gen;
    const tick = (now) => {
      if (!this.running || gen !== this._gen) return;
      this._step(Number.isFinite(now) ? now : this._clock());
      raf(tick);
    };
    raf(tick);
    // fallback heartbeat: if rAF hasn't ticked for 50ms (hidden tab), step manually.
    // The tick comes from a Web Worker because page timers are throttled to 1Hz in
    // hidden tabs, while worker timers are not — the standard keep-the-show-running trick.
    if (!this._heartbeat) return;
    try {
      const src = 'setInterval(() => postMessage(0), 33)';
      this._worker = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
      this._worker.onmessage = () => {
        if (!this.running) return;
        const now = this._clock();
        if (now - this._lastTickAt > 50) this._step(now);   // 66ms cadence — under maxDt, so show-time stays real-time
      };
    } catch (e) { /* strict CSP: no worker — hidden-tab resilience degrades gracefully */ }
  }
  stop() { this.running = false; this._worker?.terminate(); this._worker = null; }
}
