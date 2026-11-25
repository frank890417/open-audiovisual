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
//
// The desk does want to know: who holds a param right now (docs/mapping.md#who-holds-a-value). Every override is written
// with its holder, { kind: 'hand' } for the slider and for `override()` from code, { kind: 'route', source } for the mapper,
// and holder(key) answers with a record that is new on every write. So a writer that kept the record of its own last write
// can tell that somebody else wrote since, even the same number (a stepped param, a slider let go where it was).

const HAND = Object.freeze({ kind: 'hand', label: 'hand' });

export class Params {
  constructor(schema = []) {
    this.schema = schema;               // [{key,min,max,def,step,pulse,label,group}]
    this.byKey = new Map(schema.map(p => [p.key, p]));
    this.overrides = {};                // key -> value (sticky until cleared)
    this._held = {};                    // key -> the frozen record of the write that put overrides[key] there
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

  override(key, v) { this.hold(key, v, HAND); }
  /**
   * An override that says who holds it: `by` is a label ('piano', 'sound.set') or an object { kind, label, … };
   * left out it is a hand. The mapper writes { kind: 'route', label, source, mode }.
   */
  hold(key, v, by = HAND) {
    if (!this.byKey.has(key)) return;
    const value = this.clamp(key, v);
    this.overrides[key] = value;
    const who = typeof by === 'string' ? { kind: 'hand', label: by } : by && typeof by === 'object' ? { kind: 'hand', label: String(by.kind || 'hand'), ...by } : HAND;
    this._held[key] = Object.freeze({ ...who, value });
  }
  clearOverride(key) { delete this.overrides[key]; delete this._held[key]; }
  clearAllOverrides() { this.overrides = {}; this._held = {}; }
  isOverridden(key) { return key in this.overrides; }
  /**
   * Who holds this param: null while nothing does (the timeline plays, or def), else the record of the write that holds
   * it, { kind, label, value, … }. A value put straight into `params.overrides` (older code does) counts as a hand.
   */
  holder(key) {
    if (!(key in this.overrides)) return null;
    const h = this._held[key];
    if (h && Object.is(h.value, this.overrides[key])) return h;
    return (this._held[key] = Object.freeze({ ...HAND, value: this.overrides[key] }));
  }

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
