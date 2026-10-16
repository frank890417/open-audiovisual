// @openav/mapping — the layer where "what happened" becomes "what it means".
//
// Routes any signal to any param. Many-to-many by design (lineage: The Last Input
// controller-map.js — "learn ADDS, it never replaces"; one knob may drive three
// params, one param may listen to a knob AND a hand).
//
// A route:
//   { id, source: 'midi/cc/74', target: 'bloom',
//     inMin: 0, inMax: 1,       // source reading window
//     curve: 'linear'|'exp'|'log'|'smooth',
//     invert: false,
//     smooth: 0,                // seconds to ~63% (one-pole); 0 = instant
//     mode: 'override',         // override (sticky) — pulse targets fire instead
//                               //   'trim'   疊加：旋鈕的值加在時間軸「當下的值」上，時間軸繼續走、旋鈕只是微調
//                               //   'pickup' 接管要先「碰到」：旋鈕得先經過參數現在的值，才開始帶它走（一轉就跳的問題）
//     release: 0 }              // 秒。訊號靜止這麼久就放手、時間軸接回去（0 = 不放，和以前一樣）；trim 是偏移淡回 0
//
// 時間軸「現在的值」由 `new Mapper({ …, base })` 提供：base() → { key: value }（createShow 之外要自己給，
// 通常就是 () => timeline.state()）。沒給的話，trim／pickup／平滑的起點都以參數的 def 為「時間軸的值」。
//
// Learn flow (generalized MIDI-learn): learn('bloom') → next *moving* signal
// becomes the source. Works for knobs, hands, audio — anything that changes.
//
// Persistence: toJSON()/fromJSON() + save()/load() (localStorage per profile name).
// Files: exportMap()/importMap() read and write the portable `openav.map` JSON (see MAP_FORMAT below),
// and loadMapUrl() fetches one for `?map=<url>`. docs/mapping.md#save-load-and-share.

// the one-pole lag a smoothed route steps with: the same function oav-p5's lag() uses (packages/chop)
import { approach } from '../chop/index.js?v=72212d8';

const CURVES = {
  linear: (x) => x,
  exp: (x) => x * x,
  log: (x) => Math.sqrt(x),
  smooth: (x) => x * x * (3 - 2 * x),
};

// 相對模式。'override' 是預設，路線上不寫（舊的 route 與地圖檔一個字都不用改）。
const modeOf = (r) => (r.mode === 'trim' || r.mode === 'pickup' ? r.mode : 'override');
const RELEASE_MAX = 600;      // release 的上限（秒）
const FADE = 3;               // 放手時淡回時間軸的長度 = smooth × 3（一階低通走完約 95%）；smooth 為 0 就是當場放手
const PICKUP_TOL = 0.02;      // pickup：旋鈕離參數現在的值不到 route 輸出範圍的 2%，就算碰到
const MOVED = 1e-3;           // 輸入窗內動超過 0.1% 才算「動過」（同一個值重送不算，不重置 release 的計時）
const SETTLE = 1e-3;          // 平滑走到離目標不到輸出範圍的 0.1% 就貼上去、停筆（不再每幀改寫覆寫）
const publicRoute = (r) => { const o = {}; for (const k in r) if (k[0] !== '_') o[k] = r[k]; return o; };   // 執行期狀態以 _ 開頭，不外流

// ───────────── the portable map file ─────────────
//
//   { "format": "openav.map", "version": 1, "world": "particles", "exported": "2026-10-15T…Z",
//     "routes": [ { "signal": "midi/cc/74", "param": "bloom", "curve": "exp",
//                   "range": { "in": [0, 1], "out": [0, 100] }, "smooth": 0.1, "invert": false } ] }
//
// Names are by signal and param, never by id, so a file can move between worlds: a route whose
// param this world does not have, or whose signal nothing here can produce, is skipped and listed.
// A bare array (what toJSON() returns, `source`/`target` keys) is read as version 0.

export const MAP_FORMAT = 'openav.map';
export const MAP_VERSION = 1;
export const MAP_MAX_BYTES = 256 * 1024;
const MAP_MAX_ROUTES = 500;
// Namespaces whose signals are born when the first message arrives (a CC that has not moved yet is not
// defined). A route on one of these is kept even if the signal is unknown right now, and reported as "waiting".
const LAZY_SIGNALS = /^(midi|surface|phone|osc|key|keys|take)\//;

const finite = (v) => typeof v === 'number' && Number.isFinite(v);
const pair = (a) => Array.isArray(a) && a.length === 2 && finite(a[0]) && finite(a[1]) ? [a[0], a[1]] : null;

/** Build the file object from a routes array (as in toJSON()). */
export function serializeMap(routes, { world = 'default', now = new Date() } = {}) {
  return {
    format: MAP_FORMAT, version: MAP_VERSION, world,
    exported: now instanceof Date ? now.toISOString() : String(now),
    routes: routes.map((r) => {
      const o = { signal: r.source, param: r.target, curve: r.curve || 'linear',
        range: { in: [r.inMin ?? 0, r.inMax ?? 1], out: [r.outMin ?? 0, r.outMax ?? 1] },
        smooth: r.smooth || 0, invert: !!r.invert };
      if (r.enabled === false) o.enabled = false;
      if (modeOf(r) !== 'override') o.mode = modeOf(r);                    // 預設的 route 照舊不多寫欄位
      if (finite(r.release) && r.release > 0) o.release = Math.min(RELEASE_MAX, r.release);
      return o;
    }),
  };
}

/**
 * Read a map file (a JSON string or an already parsed value). Never throws.
 * → { ok:true, version, world, routes:[{ signal, param, curve, inMin, inMax, outMin?, outMax?, smooth, invert, enabled, mode?, release? }], dropped }
 *   or { ok:false, error }. `routes` are cleaned: unknown keys gone, numbers finite, curve one we know.
 */
export function parseMap(input) {
  let data = input;
  if (typeof input === 'string') {
    if (input.length > MAP_MAX_BYTES) return { ok: false, error: 'file is too large for a map (over 256 KB)' };
    try { data = JSON.parse(input); } catch (e) { return { ok: false, error: 'not valid JSON' }; }
  }
  let version, world = null, list;
  if (Array.isArray(data)) { version = 0; list = data.map((r) => (r && typeof r === 'object' ? { signal: r.source, param: r.target, ...r } : r)); }
  else if (data && typeof data === 'object') {
    if (data.format !== MAP_FORMAT) return { ok: false, error: `not an OAV map (format is ${JSON.stringify(data.format ?? null)}, expected "${MAP_FORMAT}")` };
    if (!Number.isInteger(data.version) || data.version < 1) return { ok: false, error: 'the map has no valid "version"' };
    if (data.version > MAP_VERSION) return { ok: false, error: `this map is version ${data.version}; this build of OAV reads up to version ${MAP_VERSION}. Update OAV or re-export it.` };
    version = data.version; world = typeof data.world === 'string' ? data.world.slice(0, 120) : null; list = data.routes;
    if (!Array.isArray(list)) return { ok: false, error: 'the map has no "routes" list' };
  } else return { ok: false, error: 'not an OAV map' };
  if (list.length > MAP_MAX_ROUTES) return { ok: false, error: `too many routes (${list.length}; the limit is ${MAP_MAX_ROUTES})` };
  const routes = []; let dropped = 0;
  for (const r of list) {
    if (!r || typeof r !== 'object' || typeof r.signal !== 'string' || typeof r.param !== 'string' || !r.signal || !r.param || r.signal.length > 200 || r.param.length > 200) { dropped++; continue; }
    const rin = version === 0 ? pair([r.inMin, r.inMax]) : pair(r.range?.in);
    const rout = version === 0 ? pair([r.outMin, r.outMax]) : pair(r.range?.out);
    const o = { signal: r.signal, param: r.param,
      curve: Object.prototype.hasOwnProperty.call(CURVES, r.curve) ? r.curve : 'linear',
      inMin: rin ? rin[0] : 0, inMax: rin ? rin[1] : 1,
      smooth: finite(r.smooth) ? Math.min(60, Math.max(0, r.smooth)) : 0,
      invert: r.invert === true, enabled: r.enabled !== false };
    if (rout) { o.outMin = rout[0]; o.outMax = rout[1]; }
    if (r.mode === 'trim' || r.mode === 'pickup') o.mode = r.mode;          // 版本 1 的選填欄位：舊版讀到會忽略
    if (finite(r.release) && r.release > 0) o.release = Math.min(RELEASE_MAX, r.release);
    routes.push(o);
  }
  return { ok: true, version, world, routes, dropped };
}

/**
 * Decide whether a `?map=` value may be fetched. Same origin (any scheme) or an absolute https URL;
 * nothing else (no http to another host, no data:, javascript:, file:, blob:). → { ok, url } | { ok:false, error }
 */
export function parseMapUrl(value, base) {
  if (typeof value !== 'string' || !value.trim()) return { ok: false, error: 'empty map address' };
  if (value.length > 2048) return { ok: false, error: 'map address is too long' };
  let u;
  try { u = new URL(value.trim(), base); } catch (e) { return { ok: false, error: 'map address is not a URL' }; }
  if (u.username || u.password) return { ok: false, error: 'map address must not carry a login' };
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return { ok: false, error: `${u.protocol} addresses are not accepted; use https` };
  let sameOrigin = false;
  try { sameOrigin = !!base && u.origin === new URL(base).origin; } catch (e) {}
  if (!sameOrigin && u.protocol !== 'https:') return { ok: false, error: 'a map from another site must be served over https' };
  return { ok: true, url: u.href };
}

/**
 * Fetch a map from `?map=` and put it on the mapper. Never throws, never blocks the show:
 * any failure lands in mapper.report (the console shows it) and the routes stay as they were.
 */
export async function loadMapUrl(mapper, value, { base = (typeof location !== 'undefined' ? location.href : undefined), fetchImpl = (typeof fetch !== 'undefined' ? fetch : null), timeoutMs = 8000 } = {}) {
  const fail = (error) => mapper.setReport({ ok: false, source: 'url', address: String(value).slice(0, 200), error });
  const a = parseMapUrl(value, base);
  if (!a.ok) return fail(a.error);
  if (!fetchImpl) return fail('fetch is not available here');
  try {
    const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = ctl ? setTimeout(() => ctl.abort(), timeoutMs) : null;
    let res;
    try { res = await fetchImpl(a.url, { credentials: 'omit', redirect: 'follow', signal: ctl?.signal }); } finally { clearTimeout(timer); }
    if (!res.ok) return fail(`the server answered ${res.status}`);
    const text = await res.text();
    return mapper.importMap(text, { source: 'url', address: a.url });
  } catch (e) {
    return fail(e?.name === 'AbortError' ? 'timed out' : 'could not fetch it (offline, or the other site blocks cross-origin reads)');
  }
}

let _nextId = 1;

export class Mapper {
  /**
   * @param {object} deps
   * @param {import('../core/src/signals.js?v=72212d8').Signals} deps.signals
   * @param {import('../core/src/params.js?v=72212d8').Params} deps.params
   * @param {string} [deps.profile='default'] localStorage namespace
   * @param {() => void} [deps.onChange] routes changed (UI refresh)
   * @param {(route: object, sig: string) => void} [deps.onLearn]
   * @param {() => Object<string, number>} [deps.base] 時間軸「現在」的值 { key: value }，通常是 () => timeline.state()。
   *        trim／pickup 疊在它上面、平滑從它起跳。沒給就用參數的 def。可以之後再指定：mapper.base = fn
   */
  constructor({ signals, params, profile = 'default', onChange = null, onLearn = null, base = null }) {
    this.signals = signals;
    this.params = params;
    this.profile = profile;
    this.base = base;
    this.onChange = onChange || (() => {});
    this.onLearn = onLearn || (() => {});
    this.routes = [];
    this.learnTarget = null;
    this.report = null;           // what the last import/?map= said (see importMap)
    this.reportSeq = 0;
    this._owned = new Map();      // target -> 我們最後寫進 params.overrides 的值；之後讀到不一樣，就是 ✕ 或滑桿動過
    this._stamp = 0;              // 誰最後寫的：同一個參數有幾條取代 route 時，最近寫的那條贏
    this._learnBase = new Map();  // signal -> value at learn start (movement detection)
    this._unsub = signals.onAny((name, value) => this._onSignal(name, value));
  }

  addRoute(r) {
    const p = this.params.get(r.target);
    // trim 的 out 範圍是「偏移量」：沒指定就是參數範圍的正負一半（旋鈕在中間＝不動）
    const half = p ? (p.max - p.min) / 2 : 0.5;
    const trim = r.mode === 'trim';
    const route = {
      id: _nextId++, inMin: 0, inMax: 1, curve: 'linear', invert: false, smooth: 0,
      outMin: trim ? -half : (p ? p.min : 0), outMax: trim ? half : (p ? p.max : 1),
      ...r,
    };
    this.routes.push(route);
    this.onChange();
    return route;
  }

  removeRoute(id) {
    const gone = this.routes.filter(r => r.id === id);
    this.routes = this.routes.filter(r => r.id !== id);
    this._letGo(gone);
    this.onChange();
  }

  routesFor(target) { return this.routes.filter(r => r.target === target); }

  /** Toggle learn mode for a param. Next moving signal becomes its source. */
  learn(target) {
    this.learnTarget = (this.learnTarget === target) ? null : target;
    this._learnBase.clear();
    if (this.learnTarget) for (const s of this.signals.list()) if (s.kind !== 'pulse') this._learnBase.set(s.name, s.value);
    this.onChange();
  }

  _onSignal(name, value) {
    // learn: bind on first signal that MOVES (≥5% of its range) — knobs and hands qualify,
    // idle noise doesn't
    if (this.learnTarget) {
      const meta = this.signals.meta.get(name);
      if (meta && meta.kind === 'pulse') {
        const route = this.addRoute({ source: name, target: this.learnTarget });
        const t = this.learnTarget; this.learnTarget = null;
        this.onLearn(route, name); this.onChange();
        return;
      }
      const base = this._learnBase.get(name);
      const range = meta ? (meta.max - meta.min) : 1;
      if (base === undefined) { this._learnBase.set(name, value); return; }
      if (Math.abs(value - base) >= 0.05 * (range || 1)) {
        const route = this.addRoute({ source: name, target: this.learnTarget });
        const t = this.learnTarget; this.learnTarget = null;
        this.onLearn(route, name); this.onChange();
      }
      return;
    }
    // routing
    for (const r of this.routes) {
      if (r.source !== name || r.enabled === false) continue;
      const p = this.params.get(r.target);
      if (!p) continue;
      if (p.pulse) {
        // pulse param: fire on pulse signal, or rising edge past 0.5 for continuous
        const meta = this.signals.meta.get(name);
        if (meta?.kind === 'pulse') this.params.firePulse(r.target);
        else {
          const last = r._last ?? 0;
          const norm = this._normIn(r, value);
          if (norm > 0.5 && last <= 0.5) this.params.firePulse(r.target);
          r._last = norm;
        }
        continue;
      }
      let x = this._normIn(r, value);
      const xin = x;                       // 動沒動看輸入窗內的位置，不看曲線之後
      if (r.invert) x = 1 - x;
      x = (CURVES[r.curve] || CURVES.linear)(x);
      this._feed(r, r.outMin + (r.outMax - r.outMin) * x, xin);
    }
  }

  _normIn(r, value) {
    const span = r.inMax - r.inMin;
    if (!span) return 0;
    return Math.min(1, Math.max(0, (value - r.inMin) / span));
  }

  // ───────────── 一條 route 怎麼握住一個參數 ─────────────
  //
  // 每條 route 帶一點執行期狀態（都以 _ 開頭，toJSON 不外流）：
  //   _held     現在握著這個參數（取代／pickup：覆寫是它的值；trim：偏移是它的）
  //   _cur      目前（滑過的）輸出。取代／pickup 是絕對值，trim 是偏移量
  //   _target   訊號最近一次算出的輸出，_cur 往它滑
  //   _caught   pickup：旋鈕已經碰到過參數的值
  //   _leaving  正在放手（淡回時間軸），_rest 放手後訊號沒再動就不重新接管
  // 這個參數最後寫成什麼，由 _commit 統一算：取代 route 的值（沒有就是時間軸的值）＋所有 trim 偏移的總和。

  /** 時間軸現在的值 { key: value }；沒提供、丟錯、或不是物件，就當沒有（絕不讓一個壞掉的 base 擋住演出）。 */
  _axis() {
    try { const b = typeof this.base === 'function' ? this.base() : null; return b && typeof b === 'object' ? b : null; } catch (e) { return null; }
  }
  _baseOf(key, axis = this._axis()) {
    const v = axis?.[key];
    if (finite(v)) return v;
    const p = this.params.get(key);
    return p && finite(p.def) ? p.def : 0;
  }
  /** 參數現在的值：手動覆寫的話是覆寫，否則就是時間軸說的。平滑從這裡起跳、pickup 跟它比。 */
  _now(key) {
    const o = this.params.overrides[key];
    return o !== undefined ? o : this._baseOf(key);
  }

  /** 有人（主控台的 ✕、滑桿）動過我們寫的覆寫：我們不再是它的主人，這個參數上的 route 全部放手，等旋鈕下次再動。 */
  _sync(target) {
    if (!this._owned.has(target) || this.params.overrides[target] === this._owned.get(target)) return;
    this._owned.delete(target);
    for (const r of this.routes) if (r.target === target) this._drop(r);
  }
  _drop(r) { r._held = false; r._leaving = false; r._caught = false; r._side = 0; r._target = undefined; r._idle = 0; }
  _leave(r) { r._leaving = true; r._fade = 0; r._from = r._cur; r._rest = true; r._caught = false; r._side = 0; }

  /** pickup：旋鈕（out）碰到參數現在的值了嗎？離得夠近，或這次和上次在值的兩側（越過去了）都算。 */
  _meets(r, out) {
    const d = out - this._now(r.target);
    if (Math.abs(d) <= PICKUP_TOL * Math.abs(r.outMax - r.outMin)) return true;
    const side = d > 0 ? 1 : -1;
    if (r._side && side !== r._side) return true;
    r._side = side;
    return false;
  }

  /** 一個訊號讀數到了某條（非 pulse）route：算好的輸出是 out，輸入窗內的位置是 xin。 */
  _feed(r, out, xin) {
    const mode = modeOf(r), t = r.target;
    this._sync(t);
    const moved = r._xin === undefined || Math.abs(xin - r._xin) > MOVED;   // 和「上次算動過的位置」比：慢慢飄的來源累積起來也算動
    if (moved) r._xin = xin;
    if (r._rest) { if (!moved) return; r._rest = false; }     // 放手之後，要旋鈕真的動了才再接管；一直重送同一個值的來源不算
    if (moved) r._idle = 0;
    r._target = out;
    if (mode === 'pickup' && !r._caught) {
      if (!this._meets(r, out)) return;                        // 還沒碰到：時間軸照舊，旋鈕只是在旁邊動
      r._caught = true;
    }
    if (!r._held) {                                            // 剛接管：從參數現在的樣子開始，所以第一個讀數不會讓它跳
      r._held = true;
      r._cur = mode === 'trim' ? 0 : this._now(t);
    }
    r._leaving = false;
    r._stamp = ++this._stamp;
    if (r.smooth > 0) { r._settled = false; return; }          // 交給 update() 滑過去
    r._cur = out;
    this._commit(t);
  }

  /** 把這個參數寫成：握著它的取代 route（最近寫的那條；沒有就是時間軸）＋所有 trim 的偏移。沒人握著了就把覆寫還給時間軸。 */
  _commit(target, axisNow = () => this._axis()) {
    let win = null, offset = 0, trimmed = false;
    for (const r of this.routes) {
      if (r.target !== target || !r._held) continue;
      if (modeOf(r) === 'trim') { if (r.enabled !== false) { offset += r._cur; trimmed = true; } }
      else if (!win || (r._stamp || 0) >= (win._stamp || 0)) win = r;
    }
    if (!win && !trimmed) {
      if (this._owned.has(target) && this.params.overrides[target] === this._owned.get(target)) this.params.clearOverride(target);
      this._owned.delete(target);
      return;
    }
    this.params.override(target, (win ? win._cur : this._baseOf(target, axisNow())) + offset);
    this._owned.set(target, this.params.overrides[target]);
  }

  /** 這些 route 被拿掉了（移除／換掉整組）：還握著參數的 trim 要把偏移收掉，不然覆寫會停在最後一個 base＋偏移。取代模式維持黏著。 */
  _letGo(gone) {
    const targets = new Set();
    for (const r of gone) if (r._held && modeOf(r) === 'trim') targets.add(r.target);
    for (const t of targets) this._commit(t);
  }

  /** Call per frame — glides smoothed routes, keeps trims riding the time axis, lets go of what has been left alone. */
  update(dt) {
    if (!(dt > 0)) dt = 0;
    for (const t of [...this._owned.keys()]) this._sync(t);          // 先認出 ✕ 與滑桿，再動筆
    let axis;                                                        // 時間軸這一幀的值：要用才問，一幀只問一次
    const axisNow = () => (axis === undefined ? (axis = this._axis()) : axis);
    const dirty = new Set();
    for (const r of this.routes) {
      if (!r._held) continue;
      const p = this.params.get(r.target);
      if (!p) continue;
      const trim = modeOf(r) === 'trim';
      if (r.enabled === false) { if (trim) { this._drop(r); dirty.add(r.target); } continue; }   // 靜音的 trim 把偏移收掉；取代維持黏著
      if (!r._leaving && r.release > 0) {                            // 訊號靜止夠久：放手
        r._idle = (r._idle || 0) + dt;
        if (r._idle >= r.release) this._leave(r);
      }
      if (r._leaving) {
        r._fade += dt;
        const w = r.smooth > 0 ? Math.min(1, r._fade / (r.smooth * FADE)) : 1;
        dirty.add(r.target);
        if (w >= 1) { this._drop(r); continue; }
        const goal = trim ? 0 : this._baseOf(r.target, axisNow());   // 時間軸還在動，所以是淡入它，不是追它
        r._cur = r._from + (goal - r._from) * w;
        r._stamp = ++this._stamp;
      } else if (trim) {
        if (r.smooth > 0 && r._target !== undefined) r._cur = approach(r._cur, r._target, r.smooth, dt);
        dirty.add(r.target);                                         // 時間軸會動，偏移跟著重算
      } else if (r.smooth > 0 && !r._settled && r._target !== undefined) {
        let next = approach(r._cur, r._target, r.smooth, dt);
        if (Math.abs(next - r._target) <= Math.max(SETTLE * Math.abs(r.outMax - r.outMin), 1e-9)) { next = r._target; r._settled = true; }   // 到了就停筆
        r._cur = next;
        r._stamp = ++this._stamp;
        dirty.add(r.target);
      }
    }
    for (const t of dirty) this._commit(t, axisNow);
  }

  toJSON() { return this.routes.map(publicRoute); }
  fromJSON(arr) {
    const old = this.routes;
    this.routes = (arr || []).map(publicRoute);
    this._letGo(old);
    _nextId = Math.max(_nextId, ...this.routes.map(r => r.id + 1), 1);
    this.onChange();
  }
  /** The portable file for the current routes ({ format, version, world, routes }). */
  exportMap({ world = this.profile, now } = {}) { return serializeMap(this.toJSON(), { world, now }); }

  /**
   * Put a map file on this mapper. `input` is the JSON text or a parsed value (or parseMap's result).
   * mode 'replace' (default) swaps all routes; 'add' keeps the current ones and appends.
   * Routes whose param is missing, or whose signal this show cannot produce, are skipped and listed.
   * An unreadable file changes nothing. → the report (also kept in this.report for the console).
   */
  importMap(input, { mode = 'replace', source = 'file', address = '', name = '' } = {}) {
    const p = input && typeof input === 'object' && 'ok' in input && Array.isArray(input.routes) ? input : parseMap(input);
    if (!p.ok) return this.setReport({ ok: false, source, address, name, error: p.error });
    const same = !p.world || p.world === this.profile;
    const skipped = [], waiting = [], accepted = [];
    for (const r of p.routes) {
      const prm = this.params.get(r.param);
      if (!prm) { skipped.push({ signal: r.signal, param: r.param, reason: 'param' }); continue; }
      if (!this.signals.meta.has(r.signal)) {
        if (!LAZY_SIGNALS.test(r.signal)) { skipped.push({ signal: r.signal, param: r.param, reason: 'signal' }); continue; }
        waiting.push({ signal: r.signal, param: r.param });
      }
      const { signal, param, enabled, outMin, outMax, ...rest } = r;
      const route = { ...rest, source: signal, target: param };
      if (same && outMin !== undefined) { route.outMin = outMin; route.outMax = outMax; }   // out ranges belong to one world's params
      if (!enabled) route.enabled = false;
      accepted.push(route);
    }
    const prev = this.routes, prevOnChange = this.onChange;
    this.onChange = () => {};
    try {
      if (mode === 'replace') this.routes = [];
      for (const r of accepted) this.addRoute(r);
    } finally { this.onChange = prevOnChange; }
    if (mode === 'replace') this._letGo(prev);
    this.save();
    return this.setReport({ ok: true, source, address, name, mode, world: p.world, version: p.version, added: accepted.length,
      skipped, waiting, dropped: p.dropped, crossWorld: !same });
  }

  /** Remove every route (and forget it: the saved profile is emptied too). */
  clear() { const gone = this.routes; this.routes = []; this._letGo(gone); this.save(); this.onChange(); }

  /** Remember what the last import said and tell the UI (a failure shows up here, never as an exception). */
  setReport(rep) { this.report = rep; this.reportSeq = (this.reportSeq || 0) + 1; this.onChange(); return rep; }

  save() { try { localStorage.setItem('openav.map.' + this.profile, JSON.stringify(this.toJSON())); } catch (e) {} }
  load() {
    try {
      const raw = localStorage.getItem('openav.map.' + this.profile);
      if (raw) {
        const v = JSON.parse(raw);
        this.fromJSON(Array.isArray(v) ? v : (v && Array.isArray(v.routes) ? v.routes : []));   // bare array (always written) or an old/hand-made object
        return true;
      }
    } catch (e) {}
    return false;
  }
  dispose() { this._unsub?.(); }
}

export { LearnWizard } from './wizard.js?v=72212d8';
