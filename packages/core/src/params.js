// Params — what the world listens to.
//
// A param has a schema entry: { key, label?, min, max, def, step?, pulse?, group? }
// Its *effective value* is resolved per frame as:
//
//   base value (usually from the Timeline's automation)
//     ⬑ overridden by → override (hand slider / MIDI knob / mapped signal)
//
// The world never knows who set a param. That indifference is the contract that
// lets the same world be performed by a pianist, a dancer, or a timeline.

export class Params {
  constructor(schema = []) {
    this.schema = schema;               // [{key,min,max,def,step,pulse,label,group}]
    this.byKey = new Map(schema.map(p => [p.key, p]));
    this.overrides = {};                // key -> value (sticky until cleared)
    this._pulseSubs = new Map();        // key -> Set<cb>
  }

  add(entries) {
    for (const p of entries) { if (!this.byKey.has(p.key)) { this.schema.push(p); this.byKey.set(p.key, p); } }
    return this;
  }

  get(key) { return this.byKey.get(key); }

  clamp(key, v) {
    const p = this.byKey.get(key); if (!p) return v;
    let x = Math.min(p.max, Math.max(p.min, v));
    if (p.step) x = Math.round(x / p.step) * p.step;
    return x;
  }

  override(key, v) { if (this.byKey.has(key)) this.overrides[key] = this.clamp(key, v); }
  clearOverride(key) { delete this.overrides[key]; }
  clearAllOverrides() { this.overrides = {}; }
  isOverridden(key) { return key in this.overrides; }

  /** Fire a pulse param (momentary trigger, e.g. a pad). */
  firePulse(key) {
    const subs = this._pulseSubs.get(key);
    if (subs) for (const cb of subs) { try { cb(key); } catch (e) { console.error(`[params] pulse ${key}:`, e); } }
  }
  onPulse(key, cb) {
    if (!this._pulseSubs.has(key)) this._pulseSubs.set(key, new Set());
    this._pulseSubs.get(key).add(cb);
    return () => this._pulseSubs.get(key)?.delete(cb);
  }

  /** Resolve effective state: base (e.g. timeline.state(t)) merged with overrides. */
  resolve(base = {}) {
    const s = {};
    for (const p of this.schema) {
      s[p.key] = (p.key in this.overrides) ? this.overrides[p.key] : (p.key in base ? base[p.key] : p.def);
    }
    return s;
  }
}
