// OutClient — the browser side of the out-bridge: set(channel, value) → ws://127.0.0.1:6450/out.
// Runs in the page (and in Node 22, which has a global WebSocket — the tests use it). No imports.
//
//   const out = new OutClient({ id: 'my-work' });   // url defaults to ws://127.0.0.1:6450/out
//   out.connect();
//   out.set('light/0/r', 0.8);                       // → the bridge, at most once per frame per channel
//   out.batch({ 'light/0/g': 0.2, 'motor/1': 0.5 });
//   out.onStatus((s) => …)                           // 'connecting' | 'open' | 'closed' | 'sim'
//   out.simulate();                                  // no socket; values are only recorded in out.last
//
// Several set() calls on one channel inside one frame leave as one value (the last). While the socket
// is open the client re-sends the held values every timeoutMs/3 so a still slider is not mistaken for a
// dead page by the bridge's watchdog; if the page freezes, that heartbeat stops and the hardware goes safe.

export const OUT_DEFAULT_URL = 'ws://127.0.0.1:6450/out';

export class OutClient {
  /**
   * @param {object} [o]
   * @param {string} [o.url]
   * @param {string} [o.id]            work id, sent in "hello"
   * @param {function} [o.WebSocket]   default globalThis.WebSocket
   * @param {(fn:()=>void)=>any} [o.schedule]  one-frame scheduler (default requestAnimationFrame, else a 16 ms timer)
   * @param {number} [o.maxBackoffMs=5000]
   */
  constructor({ url = OUT_DEFAULT_URL, id = null, WebSocket: WS, schedule, maxBackoffMs = 5000, minBackoffMs = 250 } = {}) {
    this.url = url; this.id = id;
    this._WS = WS || globalThis.WebSocket;
    this._schedule = schedule || ((fn) => (typeof requestAnimationFrame === 'function' && typeof document !== 'undefined' && !document.hidden ? requestAnimationFrame(fn) : setTimeout(fn, 16)));
    this._max = maxBackoffMs; this._min = minBackoffMs;
    this.status = 'closed';
    this.last = {};                 // channel → last value given to set() (also in sim mode)
    this.bridge = null;             // the bridge's last {type:'status'} message
    this.sent = 0;                  // values actually put on the wire (coalescing makes this < set() calls)
    this._pending = new Map();
    this._listeners = new Set();
    this._ws = null; this._wanted = false; this._backoff = this._min; this._retry = null; this._flushing = false; this._beat = null;
  }

  onStatus(fn) { this._listeners.add(fn); return () => this._listeners.delete(fn); }
  _setStatus(s) { if (s === this.status) return; this.status = s; for (const f of [...this._listeners]) try { f(s); } catch {} }

  /** Open the socket (and keep it open: reconnects with exponential backoff, capped). */
  connect() {
    this._wanted = true;
    if (this.status === 'sim' || this._ws || typeof this._WS !== 'function') return this;
    this._setStatus('connecting');
    let ws;
    try { ws = new this._WS(this.url); } catch { return this._reconnect(); }
    this._ws = ws;
    ws.onopen = () => {
      this._backoff = this._min;
      this._setStatus('open');
      this._raw({ type: 'hello', id: this.id });
      for (const [ch, v] of Object.entries(this.last)) this._pending.set(ch, v);   // after a reconnect the bridge has forgotten everything
      this._kick();
      clearInterval(this._beat);
      this._armBeat();
    };
    // the bridge says how long its watchdog waits when the socket opens: beat at a third of THAT, not of the 500 ms we guessed
    // before it spoke (a bridge with timeoutMs 150 was sent safe values between two beats 167 ms apart)
    ws.onmessage = (e) => { try { const m = JSON.parse(e.data); if (m && m.type === 'status') { this.bridge = m; if (this._ws === ws) this._armBeat(); } } catch {} };
    const lost = () => {
      if (this._ws !== ws) return;
      this._ws = null; clearInterval(this._beat);
      ws.onopen = ws.onmessage = ws.onerror = ws.onclose = null;      // before close(): undici fires "error" again from close() on a half-open socket
      try { ws.close(); } catch {}
      if (this._wanted) this._reconnect(); else this._setStatus('closed');
    };
    ws.onclose = lost; ws.onerror = lost;
    return this;
  }
  _reconnect() {
    this._setStatus('connecting');
    clearTimeout(this._retry);
    this._retry = setTimeout(() => { this._retry = null; if (this._wanted) this.connect(); }, this._backoff);
    this._retry.unref?.();
    this._backoff = Math.min(this._max, this._backoff * 2);
    return this;
  }
  /** No socket: values are only recorded in .last (for sketches without hardware, ?out=sim). */
  simulate() { this._wanted = false; this._close(); this._setStatus('sim'); return this; }
  close() { this._wanted = false; this._close(); this._setStatus('closed'); }
  _close() { clearTimeout(this._retry); clearInterval(this._beat); const ws = this._ws; this._ws = null; if (ws) try { ws.close(); } catch {} }

  set(ch, v) {
    v = Number(v);
    if (typeof ch !== 'string' || !Number.isFinite(v)) return;
    this.last[ch] = v;
    if (this.status === 'sim') return;
    this._pending.set(ch, v);
    this._kick();
  }
  batch(obj) { for (const [ch, v] of Object.entries(obj || {})) this.set(ch, v); }

  _kick() {
    if (this._flushing || !this._pending.size) return;
    this._flushing = true;
    this._schedule(() => { this._flushing = false; this._flush(); });
  }
  _flush() {
    if (!this._pending.size) return;
    if (!this._ws || this.status !== 'open') return;       // kept in _pending / .last; resent on (re)connect
    const items = [...this._pending].map(([ch, v]) => ({ ch, v }));
    this._pending.clear();
    this.sent += items.length;
    this._raw(items.length === 1 ? { type: 'set', ch: items[0].ch, v: items[0].v } : { type: 'batch', items });
  }
  _armBeat() {
    clearInterval(this._beat);
    this._beat = setInterval(() => this._heartbeat(), Math.max(50, Math.round(((this.bridge && this.bridge.timeoutMs) || 500) / 3)));
    this._beat.unref?.();
  }
  _heartbeat() {
    if (this._pending.size) return;
    const items = Object.entries(this.last).map(([ch, v]) => ({ ch, v }));
    if (items.length) this._raw({ type: 'batch', items });
  }
  _raw(obj) { try { if (this._ws && this._ws.readyState === 1) this._ws.send(JSON.stringify(obj)); } catch {} }
}
