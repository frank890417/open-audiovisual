// Signals — the single currency of the input layer.
//
// Every input module (MIDI, audio analysis, chord detection, pose…) publishes
// *named, normalized signals* here. The mapping layer subscribes and routes them
// to params. Naming convention is path-like, e.g.:
//
//   midi/cc/74          0..1     knob
//   midi/note/on        pulse    {note, vel}
//   chord/consonance    -1..1    harmonic consonance of last played chord
//   audio/rms           0..1     loudness
//   audio/band/low      0..1     energy in low band
//   pose/hand/right/y   0..1     right wrist height (1 = top)
//
// A signal is either `continuous` (has a current value) or `pulse` (fires events,
// value is the payload of the last firing). Consumers should not care where a
// signal comes from — a knob and a raised hand are equal citizens. That equality
// is what "input fusion" means in this framework.

export class Signals {
  constructor() {
    this.meta = new Map();    // name -> {kind, min, max, unit, description, source}
    this.values = new Map();  // name -> last value
    this.stamps = new Map();  // name -> performance.now() of last set
    this._subs = new Map();   // name -> Set<cb>
    this._any = new Set();    // Set<cb(name, value, meta)>
  }

  /** Declare a signal. Idempotent; later declarations merge metadata. */
  define(name, meta = {}) {
    const prev = this.meta.get(name) || {};
    this.meta.set(name, {
      kind: 'continuous', min: 0, max: 1, unit: '', description: '', source: '',
      ...prev, ...meta,
    });
    if (!this.values.has(name)) this.values.set(name, meta.kind === 'pulse' ? null : (meta.min ?? 0));
    return this;
  }

  /** Publish a value. Auto-defines unknown signals (kind guessed as continuous). */
  set(name, value) {
    if (!this.meta.has(name)) this.define(name);
    this.values.set(name, value);
    this.stamps.set(name, (typeof performance !== 'undefined' ? performance.now() : Date.now()));
    const subs = this._subs.get(name);
    if (subs) for (const cb of subs) { try { cb(value, name); } catch (e) { console.error(`[signals] ${name}:`, e); } }
    for (const cb of this._any) { try { cb(name, value, this.meta.get(name)); } catch (e) { console.error('[signals] any:', e); } }
  }

  /** Fire a pulse signal (kind: 'pulse'). */
  pulse(name, payload = 1) { this.set(name, payload); }

  get(name) { return this.values.get(name); }

  /** Normalized 0..1 view of a continuous signal (per its declared min/max). */
  norm(name) {
    const m = this.meta.get(name); if (!m) return 0;
    const v = this.values.get(name) ?? m.min;
    if (m.max === m.min) return 0;
    return Math.min(1, Math.max(0, (v - m.min) / (m.max - m.min)));
  }

  on(name, cb) {
    if (!this._subs.has(name)) this._subs.set(name, new Set());
    this._subs.get(name).add(cb);
    return () => this._subs.get(name)?.delete(cb);
  }

  /** Subscribe to every signal (mapping layer / monitor use this). */
  onAny(cb) { this._any.add(cb); return () => this._any.delete(cb); }

  /** All signals as [{name, value, ...meta}] — monitor food. */
  list() {
    return [...this.meta.entries()].map(([name, m]) => ({ name, value: this.values.get(name), at: this.stamps.get(name) || 0, ...m }));
  }
}
