// @openav/monitor (client side) — stream performance state to the backstage relay.
//
//   const mon = new MonitorFeed({ url: 'ws://localhost:7457' });
//   mon.connect();
//   // per frame (throttled internally to `hz`):
//   mon.frame({ t, scene, state, signals, fps });
//
// Reconnects automatically; silent when no relay is running (zero cost to always
// leave it on in your app). On https pages it stays off unless given a wss:// url.
//
// 作品自己的數字（健康指標）：後台多一個 "Work" 面板，兩種送法，不用就一個位元組都不多。
//   mon.extra(() => ({ 'sim/tick': 1200, 'sim/drift': { v: 0.004, min: 0, max: 0.1, warn: false } }))
//   snapshotOf({ …, extra: { 'sim/tick': 1200 } }, state)      // extra 也可以是函式，每次問一次
//   world.monitor = () => ({ … })                                // 作品的 World 自己答：createShow 的演出不用接線，snapshotOf 會去問 stage.active
// 值是數字／字串／布林／null，或 { v, min, max, warn }（有 min/max 就畫量條，warn 為真就變紅）。

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

const EXTRA_KEYS = 64;      // 一次最多幾個欄位
const EXTRA_KEY_LEN = 48;   // 欄位名上限
const EXTRA_STR_LEN = 80;   // 字串值上限
const DROP = Symbol('drop');

/** 一個值能不能進快照：數字（非有限 → null）、字串（截斷）、布林、null／undefined（→ null）；其他丟掉。 */
function extraValue(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string') return v.slice(0, EXTRA_STR_LEN);
  if (typeof v === 'boolean') return v;
  if (v === null || v === undefined) return null;
  return DROP;
}

/**
 * 作品送進後台的欄位，整理成一定能 JSON 化、大小有上限的樣子。`x` 是物件，或回傳物件的函式（丟錯就當沒有）。
 * 值是數字／字串／布林／null，或 { v, min, max, warn }。JSON 帶不走的（BigInt、函式、巢狀物件、NaN）會被丟掉或變 null，
 * 一個壞值不能讓整個快照送不出去。沒有任何欄位時回傳 null（快照就不帶 extra）。
 */
export function cleanExtra(x) {
  let src = x;
  if (typeof src === 'function') { try { src = src(); } catch (e) { return null; } }
  if (!src || typeof src !== 'object' || Array.isArray(src)) return null;
  const out = {};
  let n = 0;
  for (const key of Object.keys(src)) {
    if (n >= EXTRA_KEYS) break;
    if (key === '__proto__') continue;
    let e;
    try { e = src[key]; } catch (err) { continue; }                       // 一個會丟錯的 getter 不拖累其他欄位
    let v;
    if (e && typeof e === 'object' && !Array.isArray(e) && 'v' in e) {
      const val = extraValue(e.v);
      v = { v: val === DROP ? null : val };
      if (Number.isFinite(e.min)) v.min = e.min;
      if (Number.isFinite(e.max)) v.max = e.max;
      if (e.warn === true) v.warn = true;
    } else v = extraValue(e);
    if (v === DROP) continue;
    out[key.slice(0, EXTRA_KEY_LEN)] = v;
    n++;
  }
  return n ? out : null;
}

export class MonitorFeed {
  constructor({ url = defaultMonitorUrl(), hz = 15, extra = null } = {}) {
    this.url = url ? url + (url.includes('?') ? '&' : '?') + 'role=stage' : null;
    this.hz = hz;
    this.ws = null;
    this.connected = false;
    this._lastSend = 0;
    this._retryTimer = null;
    this._extras = new Set();
    this.onStatus = null;
    if (extra) this.extra(extra);
  }

  /**
   * 掛一個提供者：fn() → { 欄位: 值 }，作品自己的數字（取樣漂移、世界 tick、NaN 次數…），出現在後台的 Work 面板。
   * 只有真的要送出一幀時才問（節流掉的幀不問），所以貴一點的量測放這裡比放 snapshotOf 划算。同名欄位後掛的贏。
   * → off()：取消。
   */
  extra(fn) {
    if (typeof fn !== 'function') return () => {};
    this._extras.add(fn);
    return () => { this._extras.delete(fn); };
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
    let body = snapshot;
    if (this._extras.size) {
      let mine = null;
      for (const fn of this._extras) { const part = cleanExtra(fn); if (part) mine = { ...mine, ...part }; }
      if (mine) body = { ...snapshot, extra: { ...snapshot.extra, ...mine } };
    }
    try { this.ws.send(JSON.stringify({ at: Date.now(), ...body })); } catch (e) {}
  }
}

/**
 * Convenience: build a snapshot from the usual app objects. The work's own numbers land under `snapshot.extra`: from `extra`
 * (an object, or a function answering one) and from the active world's optional `monitor()` — `extra` wins on a shared name.
 * Without either (or with nothing in them) the snapshot is what it always was.
 */
export function snapshotOf({ timeline, params, signals, stage, loop, extra }, state) {
  const snap = {
    t: timeline?.t ?? 0,
    playing: timeline?.playing ?? false,
    holding: timeline?.holding ?? false,        // parked at the end of a `hold` segment, waiting for the operator
    total: timeline?.total ?? 0,
    sceneIndex: timeline?.sceneIndexAt() ?? 0,
    scene: timeline?.currentScene()?.title || timeline?.currentScene()?.id || '',
    world: stage?.activeName || '',
    fps: loop?.fps ?? 0,
    state: state || {},
    overrides: params ? Object.keys(params.overrides) : [],
    signals: signals ? signals.list().map(s => ({ n: s.name, v: (typeof s.value === 'number' ? Number(s.value.toFixed(3)) : s.value), k: s.kind })) : [],
  };
  const world = stage?.active;
  const fromWorld = typeof world?.monitor === 'function' ? cleanExtra(() => world.monitor()) : null;
  const fromCaller = cleanExtra(extra);
  if (fromWorld || fromCaller) snap.extra = { ...fromWorld, ...fromCaller };
  return snap;
}
