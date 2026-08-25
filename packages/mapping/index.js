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

const CURVES = {
  linear: (x) => x,
  exp: (x) => x * x,
  log: (x) => Math.sqrt(x),
  smooth: (x) => x * x * (3 - 2 * x),
};

let _nextId = 1;

export class Mapper {
  /**
   * @param {object} deps
   * @param {import('../core/src/signals.js').Signals} deps.signals
   * @param {import('../core/src/params.js').Params} deps.params
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
        const k = 1 - Math.exp(-dt / r.smooth);
        const next = cur + (r._target - cur) * k;
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
  save() { try { localStorage.setItem('openav.map.' + this.profile, JSON.stringify(this.toJSON())); } catch (e) {} }
  load() {
    try {
      const raw = localStorage.getItem('openav.map.' + this.profile);
      if (raw) { this.fromJSON(JSON.parse(raw)); return true; }
    } catch (e) {}
    return false;
  }
  dispose() { this._unsub?.(); }
}
