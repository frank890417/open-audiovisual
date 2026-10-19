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
//     mode: 'override' }        // override (sticky) — pulse targets fire instead
//
// Learn flow (generalized MIDI-learn): learn('bloom') → next *moving* signal
// becomes the source. Works for knobs, hands, audio — anything that changes.
//
// Persistence: toJSON()/fromJSON() + save()/load() (localStorage per profile name).
// Files: exportMap()/importMap() read and write the portable `openav.map` JSON (see MAP_FORMAT below),
// and loadMapUrl() fetches one for `?map=<url>`. docs/mapping.md#save-load-and-share.

// the one-pole lag a smoothed route steps with: the same function oav-p5's lag() uses (packages/chop)
import { approach } from '../chop/index.js?v=f3ec262';

const CURVES = {
  linear: (x) => x,
  exp: (x) => x * x,
  log: (x) => Math.sqrt(x),
  smooth: (x) => x * x * (3 - 2 * x),
};

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
      return o;
    }),
  };
}

/**
 * Read a map file (a JSON string or an already parsed value). Never throws.
 * → { ok:true, version, world, routes:[{ signal, param, curve, inMin, inMax, outMin?, outMax?, smooth, invert, enabled }], dropped }
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
   * @param {import('../core/src/signals.js?v=f3ec262').Signals} deps.signals
   * @param {import('../core/src/params.js?v=f3ec262').Params} deps.params
   * @param {string} [deps.profile='default'] localStorage namespace
   * @param {() => void} [deps.onChange] routes changed (UI refresh)
   * @param {(route: object, sig: string) => void} [deps.onLearn]
   */
  constructor({ signals, params, profile = 'default', onChange = null, onLearn = null }) {
    this.signals = signals;
    this.params = params;
    this.profile = profile;
    this.onChange = onChange || (() => {});
    this.onLearn = onLearn || (() => {});
    this.routes = [];
    this.learnTarget = null;
    this.report = null;           // what the last import/?map= said (see importMap)
    this.reportSeq = 0;
    this._values = new Map();     // routeId -> smoothed current value
    this._learnBase = new Map();  // signal -> value at learn start (movement detection)
    this._unsub = signals.onAny((name, value) => this._onSignal(name, value));
  }

  addRoute(r) {
    const p = this.params.get(r.target);
    const route = {
      id: _nextId++, inMin: 0, inMax: 1, curve: 'linear', invert: false, smooth: 0,
      outMin: p ? p.min : 0, outMax: p ? p.max : 1,
      ...r,
    };
    this.routes.push(route);
    this.onChange();
    return route;
  }

  removeRoute(id) {
    this.routes = this.routes.filter(r => r.id !== id);
    this._values.delete(id);
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
      if (r.invert) x = 1 - x;
      x = (CURVES[r.curve] || CURVES.linear)(x);
      const out = r.outMin + (r.outMax - r.outMin) * x;
      if (r.smooth > 0) {
        r._target = out;
        // seed the smoother from the param's CURRENT value, not the target —
        // otherwise the first signal jumps instead of gliding
        if (!this._values.has(r.id)) this._values.set(r.id, this.params.overrides[r.target] ?? p.def);
      } else this.params.override(r.target, out);
    }
  }

  _normIn(r, value) {
    const span = r.inMax - r.inMin;
    if (!span) return 0;
    return Math.min(1, Math.max(0, (value - r.inMin) / span));
  }

  /** Call per frame — advances smoothed routes. */
  update(dt) {
    for (const r of this.routes) {
      if (r.smooth > 0 && r._target !== undefined) {
        const cur = this._values.get(r.id) ?? r._target;
        const next = approach(cur, r._target, r.smooth, dt);
        this._values.set(r.id, next);
        this.params.override(r.target, next);
      }
    }
  }

  toJSON() { return this.routes.map(({ _last, _target, ...r }) => r); }
  fromJSON(arr) {
    this.routes = (arr || []).map(r => ({ ...r }));
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
      if (mode === 'replace') { for (const r of prev) this._values.delete(r.id); this.routes = []; }
      for (const r of accepted) this.addRoute(r);
    } finally { this.onChange = prevOnChange; }
    this.save();
    return this.setReport({ ok: true, source, address, name, mode, world: p.world, version: p.version, added: accepted.length,
      skipped, waiting, dropped: p.dropped, crossWorld: !same });
  }

  /** Remove every route (and forget it: the saved profile is emptied too). */
  clear() { for (const r of this.routes) this._values.delete(r.id); this.routes = []; this.save(); this.onChange(); }

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

export { LearnWizard } from './wizard.js?v=f3ec262';
