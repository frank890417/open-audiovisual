// @openav/osc — OSC output from the browser, via a ~100-line Node bridge.
//
// Browsers can't speak UDP. So: browser batches messages → POST /osc → bridge
// (bridges/osc-bridge.js) → UDP OSC → Spat / Reaper / TouchDesigner / anything.
//
// Battle-tested pattern from The Last Input: batch per frame, keep only the
// latest message per address (position streams don't need intermediate values),
// back off when the bridge dies instead of spamming fetch.
//
//   const osc = new OscOut();               // default http://127.0.0.1:7456
//   await osc.enable();                     // probes /health, fails gracefully
//   osc.send('/source/1/xyz', [x, y, z]);   // queue
//   osc.flush();                            // once per frame

export class OscOut {
  constructor(url = 'http://127.0.0.1:7456') {
    this.url = url;
    this.enabled = false;
    this.udp = '';
    this.onStatus = null;   // (ok, info) =>
    this.onMsg = null;      // (addr, args) => console hook (high-frequency; use sparingly)
    this._queue = [];
    this._sending = false;
    this._sent = 0;
    this._rateCount = 0;
    this._failStreak = 0;
  }

  async enable() {
    try {
      const r = await fetch(this.url + '/health');
      const j = await r.json().catch(() => ({}));
      this.enabled = true;
      this.udp = j.udp || '';
      this._failStreak = 0;
      this.onStatus?.(true, this.udp);
      return true;
    } catch (e) {
      this.enabled = false;
      this.onStatus?.(false, 'bridge not running (node bridges/osc-bridge.js)');
      return false;
    }
  }

  disable() { this.enabled = false; this._queue.length = 0; this.onStatus?.(false, 'disabled'); }

  send(addr, args) {
    const a = Array.isArray(args) ? args : [args];
    this._queue.push({ addr, args: a });
    this.onMsg?.(addr, a);
  }

  /** msgs per second (resets on read) — monitor food. */
  rate() { const r = this._rateCount; this._rateCount = 0; return r; }

  async flush() {
    if (!this.enabled) { this._queue.length = 0; return; }
    if (this._sending || this._queue.length === 0) return;
    const byAddr = new Map();
    for (const m of this._queue) byAddr.set(m.addr, m);   // latest per address wins
    this._queue.length = 0;
    const messages = [...byAddr.values()];
    this._sending = true;
    try {
      await fetch(this.url + '/osc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages }),
        keepalive: true,
      });
      this._sent += messages.length;
      this._rateCount += messages.length;
      this._failStreak = 0;
    } catch (e) {
      if (++this._failStreak === 1) this.onStatus?.(false, 'bridge lost');
      if (this._failStreak > 30) this.enabled = false;   // bridge is dead; stop hammering
    } finally {
      this._sending = false;
    }
  }
}
