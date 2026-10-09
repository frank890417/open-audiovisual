// @openav/score · director — runs the segment modules of a score, and keeps the show alive when one breaks.
//
// A SEGMENT MODULE is the code that performs one segment (the dawn, the storm, the finale):
//
//   {
//     id: 'dusk',                         // the id of the segment it performs (or the segment's `module` name)
//     enter(api, ctx)                     // the segment begins, or a seek landed inside it (ctx.p may be > 0)
//     update(api, ctx)                    // every frame while the segment (and its linger) is current
//     exit(api, ctx)                      // it ends (after linger), or a seek left it: give back what you took
//     param(key, value, ctx) → number     // optional: rewrite a timeline param while this segment is current
//     cue(name, ctx)                      // optional: a cue of this segment was just passed
//     reset(api)                          // optional: R was pressed; forget everything
//   }
//
//   ctx = {
//     p,        // progress through the segment, 0..1 (above 1 during linger; exactly 1 while holding)
//     t,        // seconds into the segment (p × dur)
//     dt,       // seconds since the previous frame
//     dur,      // the segment's length in seconds
//     T,        // show time in seconds
//     segment,  // the segment (id, title, start, end, dur, cues, acts, hold, linger, index)
//     api,      // the api object (so param() and cue(), which are not handed it, can reach the show)
//     cue(name),// where a cue of THIS segment sits, as a progress p to compare with ctx.p ('peak' or 'dusk.peak'); NaN if unknown
//     cueT(name),// the same cue in show seconds
//     phase,    // 'active' | 'linger' | 'failed' (the last one only inside exit() after a crash)
//     holding,  // true while the show waits at the end of this (hold) segment
//     held,     // seconds spent waiting so far: a clock for ambient motion while T is frozen
//     playing,  // whether the timeline is running (update() is called every frame, playing or not)
//   }
//
// WHY every module has its own try/catch: the frame loop of a show must never stop. A segment
// module is the youngest, least-tested code in the room, so when it throws, the Director turns
// off THAT module (calls its exit once, prints one console.error) and the show carries on. The
// desk shows a warning; R (reset) brings the module back.

const EPS = 1e-9;

export class Director {
  /**
   * @param {object} o
   * @param {import('./score.js?v=a8b6135').Score} o.score
   * @param {object[]|Object<string,object>} [o.modules]  segment modules (array: matched by .id; object: by key)
   * @param {object|(()=>object)} [o.api]                 handed to every hook as the first argument (a function is called once, lazily)
   * @param {(status:object)=>void} [o.onStatus]          called when the segment, the holding state or the failed list changes
   * @param {(cue:object)=>void} [o.onCue]                called for each cue the playhead passes: { name, cue, T, n, segment }
   * @param {number} [o.maxStep=2]                        a jump bigger than this many seconds between two updates is a seek (no cues fire)
   */
  constructor({ score, modules = [], api = {}, onStatus = null, onCue = null, maxStep = 2 } = {}) {
    if (!score) throw new Error('Director needs a score');
    this.score = score;
    this.onStatus = onStatus;
    this.onCue = onCue;
    this.maxStep = maxStep;
    this._api = api;
    this._apiReady = false;
    this.modules = new Map();
    this.active = new Map();           // segment index → { seg, mod }
    this.failed = new Map();           // module id → 'fn: message'
    this._lastT = null;                // previous update's show time (for cues passed)
    this._T = score.startT;
    this._held = 0;
    this._holding = false;
    this._playing = false;
    this._sig = '';
    const list = Array.isArray(modules) ? modules : Object.entries(modules || {}).map(([id, m]) => ({ id, ...m }));
    for (const m of list) this.register(m);
  }

  get api() {
    if (!this._apiReady) { this._apiReady = true; if (typeof this._api === 'function') this._api = this._api(); }
    return this._api;
  }

  /** Add a segment module (replaces one with the same id). */
  register(mod) {
    if (!mod || typeof mod.id !== 'string') throw new Error('a segment module needs an id (the id of its segment)');
    this.modules.set(mod.id, mod);
    return this;
  }

  /** The module that performs a segment: its `module` name if the cut gives one, else its own id. */
  moduleFor(seg) { return this.modules.get(seg.module || seg.id) || null; }
  _idOf(seg) { return seg.module || seg.id; }

  get holding() { return this._holding; }

  // ── per frame ───────────────────────────────────────────────────────────────
  /**
   * Call once per frame. T is show time (timeline.t); dt the frame time in seconds.
   * `state.holding` / `state.playing` come from the timeline.
   */
  update(T, dt = 0, state = {}) {
    if (!Number.isFinite(T)) return;
    this._playing = !!state.playing;
    this._holding = !!state.holding;
    this._held = this._holding ? this._held + dt : 0;

    let prev = this._lastT;
    if (prev !== null && Math.abs(T - prev) > this.maxStep) prev = T;       // a jump is a seek: nothing in between is "passed"
    // the very first frame at the start of the show must still pass a cue sitting exactly on the start
    if (prev === null) prev = T <= this.score.startT + EPS ? T - 1e-6 : T;
    this._lastT = T;
    this._T = T;

    const segs = this.score.segments;
    const last = segs.length - 1;
    const on = new Set();
    for (const seg of segs) {
      const inside = T >= seg.start - EPS && (T < seg.end + seg.linger || (seg.index === last && T >= seg.start));
      if (!inside) continue;
      const id = this._idOf(seg), mod = this.modules.get(id);
      if (!mod || this.failed.has(id)) continue;
      on.add(seg.index);
      const ctx = this._ctx(seg, T, dt);
      if (!this.active.has(seg.index)) { this.active.set(seg.index, { seg, mod, id }); this._call(id, 'enter', ctx); }
      if (this.failed.has(id)) continue;
      this._call(id, 'update', ctx);
    }
    for (const [index, { seg, id }] of [...this.active]) {
      if (on.has(index)) continue;
      this.active.delete(index);
      this._call(id, 'exit', this._ctx(seg, T, dt));
    }
    for (const c of this.score.cuesBetween(prev, T)) this._fireCue(c, T, dt);
    this._emitStatus();
  }

  _fireCue(c, T, dt) {
    const evt = { name: c.name, cue: c.cue, T: c.T, n: c.n, segment: c.segment };
    const id = this._idOf(c.segment), a = [...this.active.values()].find((x) => x.seg.index === c.segment.index);
    if (a && !this.failed.has(id)) this._call(id, 'cue', c.cue, this._ctx(c.segment, T, dt));
    if (this.onCue) { try { this.onCue(evt); } catch (e) { console.error('[score] onCue handler threw (the show goes on):', e); } }
  }

  /** The timeline's param layer: let the modules of the current segments rewrite a param. A performer's override still wins (Params.resolve applies it after). */
  param(key, value, T = this._T) {
    if (!this.active.size) return value;
    let v = value;
    for (const { seg, mod, id } of this.active.values()) {
      if (typeof mod.param !== 'function' || this.failed.has(id)) continue;
      try {
        const r = mod.param(key, v, this._ctx(seg, T, 0));
        if (typeof r === 'number' && Number.isFinite(r)) v = r;
      } catch (e) { this._fail(id, 'param', e); }
    }
    return v;
  }

  /** The playhead jumped to T: modules whose segment no longer covers T exit now; the next update() enters the new ones with the right p. */
  seek(T) {
    this._lastT = T;
    this._T = T;
    this._held = 0;
    this._holding = false;
    const last = this.score.segments.length - 1;
    for (const [index, { seg, id }] of [...this.active]) {
      if (T >= seg.start - EPS && (T < seg.end + seg.linger || (index === last && T >= seg.start))) continue;
      this.active.delete(index);
      this._call(id, 'exit', this._ctx(seg, T, 0));
    }
    this._emitStatus();
  }

  /** Back to the start: every active module exits, every module hears reset(), disabled modules come back. */
  reset() {
    for (const [, { seg, id }] of [...this.active]) this._call(id, 'exit', this._ctx(seg, this._T, 0));
    this.active.clear();
    this._lastT = null;
    this._held = 0;
    this._holding = false;
    this._T = this.score.startT;
    this.failed.clear();
    for (const [id, mod] of this.modules) {
      if (typeof mod.reset !== 'function') continue;
      try { mod.reset(this.api); } catch (e) { console.error(`[score] module "${id}" threw in reset() (ignored):`, e); }
    }
    this._emitStatus();
  }

  // ── what is going on ────────────────────────────────────────────────────────
  /** For the desk and the backstage: the current segment, the next one and how long until it, who is off. */
  status() {
    const T = this._T, score = this.score;
    const seg = score.segmentAt(T);
    const nextSeg = score.segments[seg.index + 1] || null;
    const t = Math.min(seg.dur, Math.max(0, T - seg.start));
    const holding = this._holding && seg.hold;
    return {
      cut: score.cut, T, total: score.total,
      segment: { index: seg.index, id: seg.id, title: seg.title, note: seg.note, start: seg.start, end: seg.end, dur: seg.dur, t, p: holding ? 1 : t / seg.dur, remaining: holding ? 0 : Math.max(0, seg.end - T), hold: seg.hold, acts: seg.acts, cues: Object.keys(seg.cues) },
      next: nextSeg ? { index: nextSeg.index, id: nextSeg.id, title: nextSeg.title, start: nextSeg.start, in: holding ? 0 : Math.max(0, nextSeg.start - T) } : null,
      holding, held: this._held,
      active: [...this.active.values()].map((a) => a.seg.id),
      failed: [...this.failed.keys()],
      errors: Object.fromEntries(this.failed),
      missing: [...new Set(score.segments.filter((s) => s.module && !this.modules.has(s.module)).map((s) => s.module))],
    };
  }

  // ── internals ───────────────────────────────────────────────────────────────
  _ctx(seg, T, dt) {
    const holding = this._holding && seg.hold && T >= seg.end - 1e-3 && T <= seg.end + EPS;
    const raw = (T - seg.start) / seg.dur;
    const p = holding ? 1 : raw;
    const cueP = (name) => { const k = name.includes('.') ? this.score.cueTime(name) : seg.cues[name]?.T; return Number.isFinite(k) ? (k - seg.start) / seg.dur : NaN; };
    const cueT = (name) => (name.includes('.') ? this.score.cueTime(name) : seg.cues[name]?.T ?? NaN);
    const self = this;
    return {
      p, t: p * seg.dur, dt, dur: seg.dur, T, segment: seg,
      cue: cueP, cueT, phase: raw > 1 + EPS ? 'linger' : 'active',
      holding, held: holding ? this._held : 0, playing: this._playing,
      get api() { return self.api; },            // the same api enter/update/exit get as their first argument; lets param() and cue() reach the show too
    };
  }

  _call(id, fn, ...args) {
    const mod = this.modules.get(id);
    if (!mod || typeof mod[fn] !== 'function' || this.failed.has(id)) return;
    try {
      if (fn === 'cue') mod[fn](args[0], args[1]);
      else mod[fn](this.api, ...args);
    } catch (e) { this._fail(id, fn, e); }
  }

  _fail(id, fn, e) {
    if (this.failed.has(id)) return;
    const msg = `${fn}: ${e && e.message ? e.message : e}`;
    this.failed.set(id, msg);
    console.error(`[score] segment module "${id}" crashed in ${msg} and was switched off. The show goes on; R (reset) brings it back.`, e);
    for (const [index, a] of [...this.active]) {
      if (a.id !== id) continue;
      this.active.delete(index);
      const m = this.modules.get(id);
      try { if (m && typeof m.exit === 'function') m.exit(this.api, { ...this._ctx(a.seg, this._T, 0), phase: 'failed' }); } catch { /* a module that cannot clean up must not throw again */ }
    }
  }

  _emitStatus() {
    if (!this.onStatus) return;
    const i = this.score.indexAt(this._T);
    const sig = `${i}|${this._holding}|${[...this.failed.keys()].join(',')}`;
    if (sig === this._sig) return;
    this._sig = sig;
    try { this.onStatus(this.status()); } catch (e) { console.error('[score] onStatus handler threw (the show goes on):', e); }
  }
}
