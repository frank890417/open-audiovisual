// Loop — requestAnimationFrame loop with dt clamp, FPS estimate, and a
// hidden-tab fallback: browsers freeze rAF when the page is hidden, but a
// performance must not stop because someone alt-tabbed the projection window —
// the timeline, mapped signals, OSC and the backstage feed all live in this
// loop. When rAF stalls, a low-rate setInterval (~30fps) keeps the show alive.
// (Lesson inherited from The Last Input: never tie show-time to paint-time.)
export class Loop {
  constructor(onFrame, { maxDt = 0.1 } = {}) {
    this.onFrame = onFrame;
    this.maxDt = maxDt;      // clamp big gaps so worlds don't explode
    this.running = false;
    this.fps = 0;
    this._last = 0;
    this._lastTickAt = 0;
    this._fpsAcc = 0; this._fpsN = 0; this._fpsAt = 0;
  }
  _step(now) {
    let dt = (now - this._last) / 1000;
    this._last = now;
    this._lastTickAt = now;
    if (dt > this.maxDt) dt = this.maxDt;
    if (dt <= 0) return;
    // fps: rolling 0.5s window
    this._fpsAcc += dt; this._fpsN++;
    if (now - this._fpsAt > 500) { this.fps = this._fpsAcc > 0 ? Math.round(this._fpsN / this._fpsAcc) : 0; this._fpsAcc = 0; this._fpsN = 0; this._fpsAt = now; }
    try { this.onFrame(dt, now); } catch (e) { console.error('[loop]', e); }
  }
  start() {
    if (this.running) return;
    this.running = true;
    this._last = performance.now();
    const tick = (now) => {
      if (!this.running) return;
      this._step(now);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    // fallback heartbeat: if rAF hasn't ticked for 50ms (hidden tab), step manually.
    // The tick comes from a Web Worker because page timers are throttled to 1Hz in
    // hidden tabs, while worker timers are not — the standard keep-the-show-running trick.
    try {
      const src = 'setInterval(() => postMessage(0), 33)';
      this._worker = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
      this._worker.onmessage = () => {
        if (!this.running) return;
        const now = performance.now();
        if (now - this._lastTickAt > 50) this._step(now);   // 66ms cadence — under maxDt, so show-time stays real-time
      };
    } catch (e) { /* strict CSP: no worker — hidden-tab resilience degrades gracefully */ }
  }
  stop() { this.running = false; this._worker?.terminate(); this._worker = null; }
}
