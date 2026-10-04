// @openav/monitor (client side) — stream performance state to the backstage relay.
//
//   const mon = new MonitorFeed({ url: 'ws://localhost:7457' });
//   mon.connect();
//   // per frame (throttled internally to `hz`):
//   mon.frame({ t, scene, state, signals, fps });
//
// Reconnects automatically; silent when no relay is running (zero cost to always
// leave it on in your app). On https pages it stays off unless given a wss:// url.

/**
 * Where the backstage relay is, unless told otherwise: the machine serving the page, port 7457.
 * Not on an https page: the browser blocks ws:// there (mixed content, logged as an error), and a
 * page published over https (openaudiovisual.com, a tunnel) has no relay beside it. A show that
 * does run one behind TLS passes { url: 'wss://…' } explicitly.
 */
export function defaultMonitorUrl(loc = globalThis.location) {
  if (!loc || loc.protocol === 'https:') return null;
  return `ws://${loc.hostname}:7457`;
}

export class MonitorFeed {
  constructor({ url = defaultMonitorUrl(), hz = 15 } = {}) {
    this.url = url ? url + (url.includes('?') ? '&' : '?') + 'role=stage' : null;
    this.hz = hz;
    this.ws = null;
    this.connected = false;
    this._lastSend = 0;
    this._retryTimer = null;
    this.onStatus = null;
  }

  connect() {
    if (!this.url) return;                // no relay to reach from here (see defaultMonitorUrl)
    try { this.ws = new WebSocket(this.url); } catch (e) { return this._retry(); }
    this.ws.onopen = () => { this.connected = true; this._backoff = 0; this.onStatus?.(true); };
    this.ws.onclose = () => { this.connected = false; this.onStatus?.(false); this._retry(); };
    this.ws.onerror = () => {};
  }

  _retry() {
    if (this._retryTimer) return;
    // exponential backoff 3s → 30s: a missing relay must not spam the console all show
    this._backoff = Math.min((this._backoff || 3000) * 1.6, 30000);
    this._retryTimer = setTimeout(() => { this._retryTimer = null; this.connect(); }, this._backoff);
  }

  /** Call per frame; throttles itself. snapshot should be JSON-serializable. */
  frame(snapshot) {
    if (!this.connected) return;
    const now = performance.now();
    if (now - this._lastSend < 1000 / this.hz) return;
    this._lastSend = now;
    try { this.ws.send(JSON.stringify({ at: Date.now(), ...snapshot })); } catch (e) {}
  }
}

/** Convenience: build a snapshot from the usual app objects. */
export function snapshotOf({ timeline, params, signals, stage, loop }, state) {
  return {
    t: timeline?.t ?? 0,
    playing: timeline?.playing ?? false,
    total: timeline?.total ?? 0,
    sceneIndex: timeline?.sceneIndexAt() ?? 0,
    scene: timeline?.currentScene()?.title || timeline?.currentScene()?.id || '',
    world: stage?.activeName || '',
    fps: loop?.fps ?? 0,
    state: state || {},
    overrides: params ? Object.keys(params.overrides) : [],
    signals: signals ? signals.list().map(s => ({ n: s.name, v: (typeof s.value === 'number' ? Number(s.value.toFixed(3)) : s.value), k: s.kind })) : [],
  };
}
