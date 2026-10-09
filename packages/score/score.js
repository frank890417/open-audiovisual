// @openav/score · score — a show's structure written as segment LENGTHS, never as absolute seconds.
//
// Why: a show whose timeline is a table of absolute seconds cannot grow. Lengthening one
// scene means finding every cue, every curve and every `if (t > 466)` that mentions a later
// time, and missing one puts the wrong thing on the wrong scene. Here a cut says only how
// LONG each segment is. Every start, end, cue and countdown is computed from those lengths,
// so changing one number moves everything after it, and a second version of the show is a
// few lines of data (a cut derived from another with a scale, or a different list).
//
//   const score = new Score({ cuts, cut: 'full' });
//   score.table();               // [{ id, title, start, end, dur, … }]
//   score.segmentAt(T);          // the segment playing at show time T
//   score.cueTime('dusk.glow');  // show seconds of a named cue
//   score.cuesBetween(T0, T1);   // the cues a playhead passed between two frames
//   score.scenes();              // the same table shaped for @openav/timeline
//
// A cut:
//   { id, title?, start?, segments: [ { id, title?, note?, dur, cues?, acts?, linger?, hold?, module? } ] }
//   { id, title?, from: '<cut id>', scale: <number > 0> }          derived: every length × scale
// cues: { name: ratio | { s: seconds } }   ratio is a fraction of the segment (0 ≤ r < 1); { s } is
//   seconds into the segment. A derived cut scales both, so a cue stays at the same place in the music.
// acts:  what the human operator does in this segment (strings, shown on the desk and the prompter).
// linger: seconds the segment's module keeps running after the segment ends (a decay, a tail).
// hold:   playback stops at the END of this segment and waits until the operator releases it
//         (Space, →). See docs/score.md → "Hold" for exactly what happens.
//
// Pure logic: no DOM, no timers. Everything here runs in Node, which is how it is tested.

/** Thrown when a score cannot be built: `problems` lists every reason, `message` lists them too. */
export class ScoreError extends Error {
  constructor(problems) {
    super(`Score is invalid (${problems.length} problem${problems.length === 1 ? '' : 's'}):\n  - ${problems.join('\n  - ')}`);
    this.name = 'ScoreError';
    this.problems = problems;
  }
}

const isNum = (x) => typeof x === 'number' && Number.isFinite(x);
const isId = (x) => typeof x === 'string' && x.length > 0 && !x.includes('.');

/** Accept `cuts` as an array of cuts, or an object keyed by cut id. */
function listCuts(cuts) {
  if (Array.isArray(cuts)) return cuts;
  if (cuts && typeof cuts === 'object') return Object.entries(cuts).map(([id, c]) => ({ id, ...c }));
  return [];
}

export class Score {
  /**
   * @param {object} o
   * @param {object[]|Object<string,object>} o.cuts   the cuts this show can be performed as
   * @param {string} [o.cut]                          which one to perform (default: the first)
   * @throws {ScoreError} when anything is wrong, with every problem listed
   */
  constructor({ cuts, cut } = {}) {
    this._defs = listCuts(cuts);
    this._problems = [];
    this._compiled = new Map();                    // cut id → { id, title, scale, base, segments, total, start }
    this._compileAll();
    this.cut = cut ?? (this._defs[0] && this._defs[0].id);
    if (this._defs.length && !this._compiled.has(this.cut)) {
      this._problems.push(`cut "${cut}" is not one of the cuts: ${[...this._compiled.keys()].join(', ') || '(none)'}`);
    }
    this.validate();                               // throws before a half-built score can be used
    const c = this._compiled.get(this.cut);
    this.title = c.title;
    this.scale = c.scale;                          // this cut ÷ the cut it was (finally) derived from
    this.base = c.base;                            // id of that root cut (itself when not derived)
    this.segments = c.segments;
    this.total = c.total;
    this.startT = c.startT;
    this._byId = new Map(this.segments.map((s) => [s.id, s]));
    this._cueList = this._buildCueList();
  }

  /** Every cut, for a version picker: [{ id, title, total, from?, scale }] */
  get cuts() {
    return [...this._compiled.values()].map((c) => ({ id: c.id, title: c.title, total: c.total, from: c.from, scale: c.scale, base: c.base }));
  }

  // ── building ────────────────────────────────────────────────────────────────
  _compileAll() {
    const P = this._problems;
    if (!this._defs.length) { P.push('there are no cuts (pass cuts: [{ id, segments: [...] }])'); return; }
    const byId = new Map();
    for (const d of this._defs) {
      if (!d || !isId(d.id)) { P.push(`a cut needs an id (a non-empty string without "."), got ${JSON.stringify(d && d.id)}`); continue; }
      if (byId.has(d.id)) { P.push(`cut id "${d.id}" is used twice`); continue; }
      byId.set(d.id, d);
    }
    const state = new Map();                       // id → 'busy' | compiled
    const resolve = (id, chain = []) => {
      if (state.has(id)) {
        const s = state.get(id);
        if (s === 'busy') { P.push(`cut "${id}" is derived from itself (${[...chain, id].join(' → ')})`); return null; }
        return s;
      }
      const d = byId.get(id);
      if (!d) return null;
      state.set(id, 'busy');
      let out = null;
      if (d.from !== undefined) out = this._derive(d, byId, (x) => resolve(x, [...chain, id]));
      else out = this._compileSegments(d, 1, d.id);
      state.set(id, out);
      if (out) this._compiled.set(id, out);
      return out;
    };
    for (const id of byId.keys()) resolve(id);
  }

  _derive(d, byId, resolve) {
    const P = this._problems, tag = `cut "${d.id}"`;
    if (d.segments !== undefined) P.push(`${tag}: has both "from" and "segments"; a cut is one or the other`);
    if (!byId.has(d.from)) { P.push(`${tag}: from "${d.from}" is not a cut (cuts: ${[...byId.keys()].join(', ')})`); return null; }
    if (!isNum(d.scale) || d.scale <= 0) { P.push(`${tag}: scale must be a number > 0 (got ${JSON.stringify(d.scale)})`); return null; }
    const base = resolve(d.from);
    if (!base) return null;
    const scale = base.scale * d.scale;
    const segments = base.segments.map((s) => ({
      ...s, dur: s.dur * d.scale, linger: s.linger * d.scale,
      cues: Object.fromEntries(Object.entries(s.cues).map(([k, c]) => [k, { p: c.p, s: c.s * d.scale }])),
    }));
    // rebuild start/end from the scaled lengths (not scale × old ends) so the table stays a true running sum
    return this._finish({ id: d.id, title: d.title ?? base.title, from: d.from, scale, base: base.base, segments, startId: base.startId });
  }

  _compileSegments(d, scale, base) {
    const P = this._problems, tag = `cut "${d.id}"`;
    if (!Array.isArray(d.segments) || !d.segments.length) { P.push(`${tag}: segments must be a non-empty array`); return null; }
    const seen = new Set();
    const segments = [];
    d.segments.forEach((s, i) => {
      const where = `${tag}: segment ${s && s.id ? `"${s.id}"` : `#${i}`}`;
      if (!s || typeof s !== 'object') { P.push(`${where} is not an object`); return; }
      if (!isId(s.id)) P.push(`${where}: id must be a non-empty string without "." (got ${JSON.stringify(s.id)})`);
      else if (seen.has(s.id)) P.push(`${where}: id "${s.id}" is used twice in this cut`);
      else seen.add(s.id);
      if (!isNum(s.dur) || s.dur <= 0) P.push(`${where}: dur must be a number > 0 (got ${JSON.stringify(s.dur)})`);
      const linger = s.linger === undefined ? 0 : s.linger;
      if (!isNum(linger) || linger < 0) P.push(`${where}: linger must be a number ≥ 0 (got ${JSON.stringify(s.linger)})`);
      if (s.acts !== undefined && !(Array.isArray(s.acts) && s.acts.every((a) => typeof a === 'string'))) P.push(`${where}: acts must be an array of strings`);
      const cues = {};
      for (const [name, c] of Object.entries(s.cues || {})) {
        const cw = `${where}: cue "${name}"`;
        if (!name || name.includes('.') || name === 'end') { P.push(`${cw}: a cue name is a non-empty string without "." and is not "end"`); continue; }
        const dur = isNum(s.dur) && s.dur > 0 ? s.dur : 1;
        if (isNum(c)) {
          if (c < 0 || c >= 1) { P.push(`${cw}: a ratio must be 0 ≤ r < 1 (got ${c}); use { s: seconds } for a fixed time`); continue; }
          cues[name] = { p: c, s: c * dur };
        } else if (c && typeof c === 'object' && isNum(c.s)) {
          if (c.s < 0 || c.s > dur) { P.push(`${cw}: { s: ${c.s} } is outside the segment (0 … ${dur} s)`); continue; }
          cues[name] = { p: c.s / dur, s: c.s };
        } else P.push(`${cw}: use a ratio (0.5) or { s: seconds } (got ${JSON.stringify(c)})`);
      }
      segments.push({
        id: s.id, title: s.title ?? s.id, note: s.note ?? '', dur: s.dur, linger, hold: !!s.hold,
        acts: s.acts ? [...s.acts] : [], cues, module: s.module ?? null,
      });
    });
    if (d.start !== undefined && !segments.some((s) => s.id === d.start)) P.push(`${tag}: start "${d.start}" is not one of its segments`);
    return this._finish({ id: d.id, title: d.title ?? d.id, scale, base, segments, startId: d.start });
  }

  /** Turn lengths into times: start/end by running sum, cues into absolute show seconds. */
  _finish({ id, title, from, scale, base, segments, startId }) {
    let T = 0;
    const out = segments.map((s, index) => {
      const start = T, end = start + s.dur;
      T = end;
      const cues = {};
      for (const [k, c] of Object.entries(s.cues)) cues[k] = { p: c.p, s: c.s, T: start + c.s };
      return { ...s, index, start, end, cues };
    });
    const startSeg = startId === undefined ? out[0] : out.find((s) => s.id === startId);
    return { id, title, from, scale, base, segments: out, total: T, startId, startT: startSeg ? startSeg.start : 0 };
  }

  /** Re-check everything and throw a ScoreError listing every problem. Returns true when sound. */
  validate() {
    if (this._problems.length) throw new ScoreError([...new Set(this._problems)]);
    return true;
  }

  _buildCueList() {
    const list = [];
    for (const s of this.segments) {
      for (const [cue, c] of Object.entries(s.cues)) list.push({ name: `${s.id}.${cue}`, cue, T: c.T, segment: s, p: c.p });
    }
    list.sort((a, b) => a.T - b.T || a.segment.index - b.segment.index);
    return list.map((c, n) => ({ ...c, n }));
  }

  // ── looking things up ───────────────────────────────────────────────────────
  /** One row per segment, for console.table and docs. */
  table() {
    return this.segments.map((s) => ({ index: s.index, id: s.id, title: s.title, start: s.start, end: s.end, dur: s.dur, linger: s.linger, hold: s.hold }));
  }

  /** The segment with this id (undefined when there is none). */
  segment(id) { return this._byId.get(id); }

  /** Index of the segment playing at show time T. T before the start answers 0, after the end the last one. */
  indexAt(T) {
    if (!(T > 0)) return 0;                            // also NaN
    for (let i = 0; i < this.segments.length; i++) if (T < this.segments[i].end) return i;
    return this.segments.length - 1;
  }
  segmentAt(T) { return this.segments[this.indexAt(T)]; }

  /**
   * A named moment in show seconds. 'dusk' = the segment's start, 'dusk.end' = its end,
   * 'dusk.glow' = a cue declared in the cut. NaN when the name means nothing here.
   */
  cueTime(name) {
    if (typeof name !== 'string') return NaN;
    const i = name.indexOf('.');
    const id = i < 0 ? name : name.slice(0, i), key = i < 0 ? '' : name.slice(i + 1);
    const s = this._byId.get(id);
    if (!s) return NaN;
    if (!key) return s.start;
    if (key === 'end') return s.end;
    const c = s.cues[key];
    return c ? c.T : NaN;
  }

  /** Every cue of the cut in time order: [{ name, cue, T, p, n, segment }] (n = its place in that order). */
  cues() { return this._cueList; }

  /** The cues a playhead passed going from T0 to T1: those with T0 < time ≤ T1, in order. Nothing when T1 ≤ T0. */
  cuesBetween(T0, T1) {
    if (!(T1 > T0)) return [];
    return this._cueList.filter((c) => c.T > T0 && c.T <= T1);
  }

  /**
   * Time on the cut this one was derived from. Automation curves are written once against the
   * root cut; on a scaled version they are stretched with it. Equal to T when the cut is not derived.
   */
  baseTime(T) { return this.scale === 1 ? T : T / this.scale; }

  /** The segments as a @openav/timeline `scenes` array. */
  scenes() {
    return this.segments.map((s) => ({
      id: s.id, t: s.start, title: s.title, note: s.note, dur: s.dur, end: s.end,
      acts: s.acts, hold: s.hold, linger: s.linger,
      cues: Object.entries(s.cues).map(([name, c]) => ({ name, t: c.T, p: c.p })).sort((a, b) => a.t - b.t),
    }));
  }
}
