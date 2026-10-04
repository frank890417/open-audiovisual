// @openav/relay — the browser side of the room relay.
//
// One class, three roles, same wire format as the lab-dev relay:
//
//   const phone = new RelayClient({ role: 'controller', room: 'ab12' });
//   phone.connect();
//   phone.set('phone/me/tilt/x', 0.3);            // continuous: batched @30 Hz + re-sent 1 Hz
//   phone.send('midi/note/on', {note: 60}, true); // pulse: immediate, never coalesced
//
//   const show = new RelayClient({ role: 'runner', room: 'ab12' });
//   bindSignals(show, signals);                   // phone signals → the show's Signals
//   show.feedback('surface/main/level', 0.4);     // runner → phones (meters, fader echo)
//   show.config('surface', layoutJson);           // runner → phones, replayed to late joiners
//
// Why continuous values are re-sent once a second: a phone that joins after the
// show page opened (or a show page reloaded mid-performance) would otherwise sit
// on stale defaults until someone happens to wiggle each control. The 1 Hz
// refresh costs ~nothing and makes "last value wins" true for late joiners.
// Why pulses are never batched or re-sent: a note-on delivered twice is a bug.

export { bindSignals, signalMeta, aliasOf, fileSignal, normalizeValue } from './signals.js?v=114e448';

const rnd = () => Math.random().toString(36).slice(2, 7);

/** Short device id kept in localStorage — the `<id>` in phone/<id>/…
 *  Shares the lab's key so /control and /remote on one phone are one device. */
export function deviceId(key = 'lab.deviceId') {
  let id = null;
  try { id = localStorage.getItem(key); } catch {}
  if (!id) { id = rnd(); try { localStorage.setItem(key, id); } catch {} }
  return id;
}

export class RelayClient {
  /**
   * @param {object} o
   * @param {'controller'|'runner'|'monitor'} [o.role]
   * @param {string} [o.room]            room name (default 'default'; the lab relay ignores it)
   * @param {string} [o.id]              device id
   * @param {string} [o.url]             full ws url; default same-origin /relay (or ?relay=ws://… on the page)
   * @param {number} [o.batchHz]         continuous-signal flush rate
   * @param {(c:RelayClient)=>void} [o.onStatus]
   * @param {(name:string, value:any, msg:object)=>void} [o.onSignal]    runner/monitor: incoming signals
   * @param {(name:string, value:any)=>void} [o.onFeedback]              controller: runner → phone values
   * @param {(key:string, data:any)=>void} [o.onConfig]                  controller: runner's standing config
   */
  constructor({ role = 'controller', room = 'default', id = deviceId(), url = null, batchHz = 30, resendMs = 1000, onStatus, onSignal, onFeedback, onConfig } = {}) {
    Object.assign(this, { role, room, id, batchHz, resendMs, onStatus, onSignal, onFeedback, onConfig });
    this.url = url;
    this.status = 'connecting';
    this.latency = null;
    this.peers = { controllers: 0, runners: 0, monitors: 0 };
    this.sent = 0;
    this._values = new Map(); this._dirty = new Set(); this._fb = new Map(); this._fbDirty = new Set();
    this._ws = null; this._retry = 0; this._timers = []; this._closed = false;
  }

  _wsUrl() {
    if (this.url) return this.url;
    const q = new URLSearchParams(location.search).get('relay');
    const base = q || `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/relay`;
    return base + (base.includes('?') ? '&' : '?') + `role=${this.role}&room=${encodeURIComponent(this.room)}&id=${encodeURIComponent(this.id)}`;
  }
  get open() { return this._ws?.readyState === 1; }
  _raw(obj) { if (this.open) { this._ws.send(JSON.stringify(obj)); this.sent++; } }
  _emit() { this.onStatus?.(this); }

  connect() {
    this._closed = false;
    if (!this._timers.length) {
      this._timers.push(
        setInterval(() => this._flush(false), 1000 / this.batchHz),
        setInterval(() => this._flush(true), this.resendMs),
        setInterval(() => this._raw({ type: 'ping', t: Date.now() }), 2000),
      );
    }
    let ws;
    try { ws = this._ws = new WebSocket(this._wsUrl()); } catch { return this._again(); }
    ws.onopen = () => { this.status = 'open'; this._retry = 0; this._emit(); this._raw({ type: 'ping', t: Date.now() }); this._flush(true); };
    ws.onmessage = (ev) => this._onMessage(ev.data);
    ws.onclose = () => { this.status = 'closed'; this.latency = null; this._emit(); this._again(); };
    ws.onerror = () => { try { ws.close(); } catch {} };
    return this;
  }

  _again() {
    if (this._closed) return;
    // 0.5 s → 5 s: a phone walking out of wifi range should be back within a beat of returning
    setTimeout(() => this.connect(), Math.min(5000, 500 * 2 ** this._retry++));
  }

  close() {
    this._closed = true;
    this._timers.forEach(clearInterval); this._timers = [];
    try { this._ws?.close(); } catch {}
  }

  _onMessage(data) {
    let m; try { m = JSON.parse(data); } catch { return; }
    switch (m.type) {
      case 'pong': this.latency = Date.now() - m.t; this._emit(); break;
      case 'status': case 'hello':
        this.peers = { controllers: m.controllers, runners: m.runners, monitors: m.monitors }; this._emit(); break;
      case 'signal': this.onSignal?.(m.name, m.value, m); break;
      case 'batch': for (const it of m.items || []) this.onSignal?.(it.name, it.value, it); break;
      case 'feedback': this.onFeedback?.(m.name, m.value); break;
      case 'config': this.onConfig?.(m.key, m.data); break;
    }
  }

  /** Immediate, un-coalesced. For events (pulses). */
  send(name, value, pulse = false, extra) {
    this._raw({ type: 'signal', name, value, t: Date.now(), pulse: pulse ? true : undefined, ...extra });
  }
  /** Continuous value: only the latest per name survives a flush. */
  set(name, value) { if (this._values.get(name) !== value) { this._values.set(name, value); this._dirty.add(name); } }
  /** Runner → controllers: a value to display (meter) or echo (fader follows the timeline). */
  feedback(name, value) { if (this._fb.get(name) !== value) { this._fb.set(name, value); this._fbDirty.add(name); } }
  /** Runner → controllers: standing config (e.g. 'surface' layout). Stored by the server for late joiners. */
  config(key, data) { this._raw({ type: 'config', key, data }); }

  _flush(all) {
    if (!this.open) return;
    const t = Date.now();
    const names = all ? [...this._values.keys()] : [...this._dirty];
    this._dirty.clear();
    if (names.length) this._raw({ type: 'batch', items: names.map((name) => ({ type: 'signal', name, value: this._values.get(name), t })) });
    if (this.role === 'runner') {
      const fb = all ? [...this._fb.keys()] : [...this._fbDirty];
      this._fbDirty.clear();
      // feedback is a few values at ~10 Hz, one message each; the lab relay ignores unknown types
      for (const name of fb) this._raw({ type: 'feedback', name, value: this._fb.get(name) });
    }
  }
}
