// @openav/timeline — the theatrical spine: param automation + scenes + transport.
//
// Lineage: The Last Input core/timeline.js — drove a full 14-scene IRCAM show.
// Pure logic, no DOM. Feed it params/automation/scenes and it answers one
// question: "what is the state of the world at time t?"
//
//   const tl = new Timeline({ params, automation, scenes, total })
//   tl.state(t)                  // {key: value} for all params at t
//   tl.play()/pause()/seek(t)/jumpScene(±1)/next()/prev()
//   tl.advance(dt)               // call per frame
//   tl.onSceneChange((i, scene, { cause }) => …)   // scene hook (sound, lights, prompts)
//   tl.onCue((cue, { cause }) => …)                // scene.cues: fired when PLAYBACK passes them (never by a seek)
//   new Timeline({ loop: true | 'scene' | sceneId | { from, to } })   // wrap the show, the scene you are in, or a range
//   tl.record('hue', () => knobValueOrNull)        // write a value source into a lane while playing; tl.onRecord(cb)
//
// automation: { paramKey: [[t, value, curve?], …] }  linear interp (step params hold)
//   curve = the way the segment that ENDS at this keyframe gets there: 'linear' (default) · 'ease' · 'in' · 'out' · 'step'
//   (or a function f ∈ [0,1] → [0,1]). A keyframe without a third item is exactly what it always was.
// automation: { paramKey: { segmentId: [[p, value, curve?], …] } }   a LANE: the same keyframes written per segment, p = 0…1
//   through it ('ease' etc. as above; a bare number holds the whole segment). Compiled at construction against the ROOT cut
//   of the score (or the scenes without one), so a cut with other lengths — or a derived one — reads the same (segment, p)
//   the same way. Absolute-second arrays and lanes mix freely in one automation.
// scenes:     [{ id, t, title?, note?, act?, acts?, hold?, cues? }, …]  t may be negative (pre-show standby)
//
// Since the score (@openav/score): pass `score` and the scenes, the total and the start come
// from it. A scene with `hold: true` stops playback at its end until release() / play() / next().
// `layer(key, value, t)` lets segment modules rewrite a param (a performer's override still wins:
// Params.resolve applies overrides after this). `start` is where reset() goes: default 0, a number, or
// 'first' for the first scene (a pre-show standby at -30 s).

/** The ways a segment can arrive at its keyframe: f ∈ [0,1] → eased f. `step` holds the old value until the keyframe. */
export const CURVES = {
  linear: (f) => f,
  ease:   (f) => f * f * (3 - 2 * f),    // smoothstep: slow, fast, slow
  in:     (f) => f * f,                  // starts slow
  out:    (f) => 1 - (1 - f) * (1 - f),  // starts fast
  step:   () => 0,                       // handled before interpolating; kept so the list is the whole vocabulary
};
const curveFn = (kind) => (typeof kind === 'function' ? kind : CURVES[kind] || CURVES.linear);   // unknown name → linear: a typo never stops a show

/** A hold parks the playhead this far before the boundary, so it still belongs to the segment that is waiting. */
export const HOLD_EPS = 1e-6;

// ───────────────────────────────────────────────────────────────────────────────────────────
// lanes：以段落為單位寫曲線。一個 lane ＝ { 段落 id: [[p, 值, 曲線?], …] }，p 是段內進度 0…1。
// 一個點 [p, v, c] 就是絕對秒的關鍵點 [段首 + p × 段長, v, c]，沒有別的規則：段與段之間照一般關鍵點內插，
// 兩點落在同一秒（上一段的 p=1、下一段的 p=0）就是跳變。段落表 plan ＝ [{ id, start, end? | dur? }]：
// score.rootSegments 或 timeline.lanePlan() 的樣子。這些函式不認得 Timeline，工具也能單獨用。
// ───────────────────────────────────────────────────────────────────────────────────────────

/** 物件＝ lane（每段一組點）；陣列＝絕對秒的關鍵點。 */
export const isLane = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);

const bounds = (s) => [s.start, s.end ?? s.start + s.dur];
const secOf = (s, p) => { const [a, b] = bounds(s); return p === 0 ? a : p === 1 ? b : a + p * (b - a); };   // p=0／1 落在段界上，不留浮點誤差
const show = (x) => (typeof x === 'string' ? JSON.stringify(x) : String(x));

/**
 * lane → 絕對秒的關鍵點 [[t, v, curve?], …]（已照時間排好）。
 * 數字＝整段維持這個值；null／undefined＝這段不寫。`known` 是「任何一個 cut 有過的段落 id」：
 * lane 寫到「這個 cut 沒有、別的 cut 有」的段就略過（結構不同的 cut 各自成立），誰都沒有的才丟錯（多半是打錯字）。
 */
export function compileLane(plan, lane, { key = '?', known = null } = {}) {
  const at = (id, i) => `[timeline] automation "${key}", segment "${id}"${i === undefined ? '' : `, point [${i}]`}`;
  const index = new Map();
  plan.forEach((s, i) => { if (!index.has(s.id)) index.set(s.id, i); });
  const rows = [];
  for (const [id, raw] of Object.entries(lane)) {
    if (raw === null || raw === undefined) continue;
    const si = index.get(id);
    if (si === undefined) {
      if (known && known.has(id)) continue;
      throw new Error(`[timeline] automation "${key}": there is no segment "${id}" (segments: ${plan.map((s) => s.id).join(', ') || 'none'})`);
    }
    if (typeof raw === 'number' && !Number.isFinite(raw)) throw new Error(`${at(id)}: the value must be a finite number (got ${show(raw)})`);
    const pts = typeof raw === 'number' ? [[0, raw], [1, raw]] : raw;
    if (!Array.isArray(pts)) throw new Error(`${at(id)}: expected a number or a list of [p, value, curve?] points (got ${show(raw)})`);
    if (!pts.length) throw new Error(`${at(id)}: needs at least one point`);
    let last = -Infinity;
    pts.forEach((pt, i) => {
      if (!Array.isArray(pt) || pt.length < 2) throw new Error(`${at(id, i)}: a point is [p, value, curve?]`);
      const [p, v, c] = pt;
      if (!(Number.isFinite(p) && p >= 0 && p <= 1)) throw new Error(`${at(id, i)}: p must be a number from 0 to 1 (got ${show(p)})`);
      if (!Number.isFinite(v)) throw new Error(`${at(id, i)}: the value must be a finite number (got ${show(v)})`);
      if (p < last) throw new Error(`${at(id, i)}: p must be in ascending order (${p} comes after ${last})`);
      last = p;
      const t = secOf(plan[si], p);
      rows.push({ t, si, order: rows.length, kf: c === undefined || c === null ? [t, v] : [t, v, c] });
    });
  }
  rows.sort((x, y) => x.t - y.t || x.si - y.si || x.order - y.order);   // 同一秒：先上一段的 p=1，再下一段的 p=0，後者是跳變後的值
  return rows.map((r) => r.kf);
}

export class Timeline {
  constructor({ params, automation = {}, scenes = [], total = 600, score = null, start = null, loop = false, onCue = null }) {
    this.params = params;           // Params instance or plain schema array
    this.schema = Array.isArray(params) ? params : params.schema;
    this.automation = automation;   // 全是絕對秒的陣列時就是你傳進來的那個物件；有 lane 的鍵會在下面編成陣列（新物件）
    this.score = score;
    // with a score the structure comes from it, and automation (written once against the root cut) stretches with a derived cut
    this.scenes = score ? score.scenes() : scenes;
    this.total = score ? score.total : total;
    // where reset() rewinds to: 0 unless told (a number, or 'first' = the first scene, e.g. a standby at -30) or the score says
    this.start = start === 'first' ? (this.scenes.length ? this.scenes[0].t : 0) : (start ?? (score ? score.startT : 0));
    this.t = this.start;
    this.playing = false;
    this.holding = false;           // parked at the end of a `hold` scene, waiting for release()
    this.rate = 1;
    this.layer = null;              // (key, value, t) => value — segment modules rewrite params here
    this._lastScene = -1;
    this._holdAt = null;            // { time, index } while holding
    this._sceneCbs = [];
    this._seekCbs = [];
    this.loop = loop;               // false | true | 'scene' | sceneId | { from, to } — see loopRange()
    this.loops = 0;                 // laps completed since reset()
    this.recorders = new Map();     // key → Recorder, the armed lanes
    this._cueCbs = onCue ? [onCue] : [];
    this._cueIncl = true;           // the first advance after construct / reset() also fires a cue sitting exactly on the start
    this._loopCbs = [];
    this._recCbs = [];
    if (automation && Object.values(automation).some(isLane)) this.automation = this._compileAutomation(automation);
  }

  _autoTime(t) { return this.score ? this.score.baseTime(t) : t; }

  valueAt(key, t = this.t) {
    t = this._autoTime(t);
    const p = this.schema.find(p => p.key === key);
    const kf = this.automation[key];
    if (!kf || !kf.length) return p ? p.def : 0;
    if (t <= kf[0][0]) return kf[0][1];
    if (t >= kf[kf.length - 1][0]) return kf[kf.length - 1][1];
    for (let i = 0; i < kf.length - 1; i++) {
      if (t >= kf[i][0] && t < kf[i + 1][0]) {
        if (p && p.step) return kf[i][1];
        const kind = kf[i + 1][2];                       // the curve of the segment ending at the next keyframe
        if (kind === 'step') return kf[i][1];
        const f = (t - kf[i][0]) / (kf[i + 1][0] - kf[i][0]);
        return kf[i][1] + (kf[i + 1][1] - kf[i][1]) * (kind === undefined ? f : curveFn(kind)(f));
      }
    }
    return kf[kf.length - 1][1];
  }

  /** Base state for all params at time t (no overrides — Params.resolve applies those). */
  state(t = this.t) {
    const s = {};
    for (const p of this.schema) {
      const v = this.valueAt(p.key, t);
      s[p.key] = this.layer ? this.layer(p.key, v, t) : v;
    }
    return s;
  }

  // ── lanes：以段落為單位的自動化 ─────────────────────────────────────
  // 這一節的「秒」都是 automation 的秒（root cut 的秒），也就是 timeline.automation 裡 t 的意思；
  // 衍生 cut 的 show 秒要先 score.baseTime(T)，或直接用 score.locate(T) / score.timeAt(id, p)。

  /** 段落表 [{ id, start, end, dur }]，automation 的秒：有總譜用它的 root cut，沒有就用 scenes（一個 scene 到下一個 scene 開始為止）。 */
  _plan() {
    const sc = this.score;
    if (sc && Array.isArray(sc.rootSegments)) return sc.rootSegments;
    return this.scenes.map((x, i) => {                         // 沒有 rootSegments 的 score（替身）：把 scenes 還原成 automation 的秒
      const a = this._autoTime(x.t), b = Math.max(a, this._autoTime(this.sceneEnd(i)));
      return { id: x.id, start: a, end: b, dur: b - a };
    });
  }
  /** 每次都回新陣列，改它不會動到總譜。 */
  lanePlan() { return this._plan().map(({ id, start, end, dur }) => ({ id, start, end, dur })); }
  _known() { const sc = this.score; return sc && typeof sc.allSegmentIds === 'function' ? sc.allSegmentIds() : null; }

  _laneKeyframes(key, lane, plan = this._plan(), known = this._known()) {
    if (!plan.length) throw new Error(`[timeline] automation "${key}" is written per segment, but this timeline has no segments (pass a score, or scenes with ids)`);
    return compileLane(plan, lane, { key, known });
  }
  _compileAutomation(src) {
    const plan = this._plan(), known = this._known(), out = {};
    for (const [key, v] of Object.entries(src)) out[key] = isLane(v) ? this._laneKeyframes(key, v, plan, known) : v;
    return out;
  }

  sceneIndexAt(t = this.t) { let i = 0; for (let k = 0; k < this.scenes.length; k++) if (t >= this.scenes[k].t) i = k; return i; }
  sceneEnd(i) { return i + 1 < this.scenes.length ? this.scenes[i + 1].t : this.total; }
  currentScene(t = this.t) { return this.scenes[this.sceneIndexAt(t)]; }

  /** cb(index, scene, { cause }) — cause: 'play' | 'release' | 'seek' | 'jump' | 'reset' | 'loop' */
  onSceneChange(cb) { this._sceneCbs.push(cb); }
  /** cb(t, kind) when the playhead is moved by hand — kind: 'seek' | 'jump' | 'reset'. Not called while playing. */
  onSeek(cb) { this._seekCbs.push(cb); }
  _checkScene(cause = 'play') {
    const i = this.sceneIndexAt(this.t);
    if (i !== this._lastScene) { this._lastScene = i; this._sceneCbs.forEach(cb => cb(i, this.scenes[i], { cause })); }
  }
  _moved(kind) { for (const cb of this._seekCbs) { try { cb(this.t, kind); } catch (e) { console.error('[timeline] onSeek handler:', e); } } }

  /** Play. Parked at a hold? Then this lets the show go on to the next scene. */
  play() { if (this.holding) { this.release(); return; } this.playing = true; }
  pause() { this.playing = false; this._closeTakes('pause'); }
  toggle() { if (this.playing) this.pause(); else this.play(); return this.playing; }

  /** Move the playhead to t (clamped). Leaving a hold this way releases it. */
  seek(t, cause = 'seek') {
    const lo = this.scenes.length ? Math.min(0, this.scenes[0].t) : 0;   // negative t allowed (standby scenes)
    this.t = Math.max(lo, Math.min(this.total, t));
    this.holding = false; this._holdAt = null;
    this._cueIncl = false;                  // a seek never fires cues; playing on from here fires what comes next
    this._closeTakes(cause);                // a take never spans a jump
    this._checkScene(cause);
    this._moved(cause);
  }
  jumpScene(d) { const i = Math.max(0, Math.min(this.scenes.length - 1, this.sceneIndexAt(this.t) + d)); this.seek(this.scenes[i].t, 'jump'); }
  /** → : release a hold (and keep playing), otherwise jump to the next scene. */
  next() { if (this.holding) return this.release(); this.jumpScene(1); return true; }
  /** ← : the previous scene. */
  prev() { this.jumpScene(-1); return true; }
  /** Let a hold go: the next scene starts now and playback continues. false when nothing was holding. */
  release() {
    if (!this.holding) return false;
    const h = this._holdAt, parked = this.t;
    this.holding = false; this._holdAt = null;
    this.t = h.time;
    this.playing = true;
    this._checkScene('release');
    this._cuesIn(parked, h.time, false, true);   // a cue sitting on the boundary belongs to the scene that starts now
    return true;
  }
  /** Back to the start (default 0, or `start`): stopped, not holding. */
  reset() {
    this.t = this.start; this.playing = false; this.holding = false; this._holdAt = null; this._lastScene = -1;
    this.loops = 0; this._cueIncl = true;
    this._closeTakes('reset');
    this._moved('reset');
  }

  // the first hold boundary the playhead crosses going from a to b (a < boundary ≤ b)
  _holdBetween(a, b) {
    for (let i = 0; i < this.scenes.length - 1; i++) {
      if (!this.scenes[i].hold) continue;
      const h = this.scenes[i + 1].t;
      if (a < h && h <= b) return { time: h, index: i };
    }
    return null;
  }

  /** Call per frame with clamped dt. Returns whether still playing. */
  advance(dt) {
    if (!this.playing) return false;
    const from = this.t, step = dt * this.rate, next = from + step;
    const L = step > 0 ? this.loopRange(from) : null;
    const wrap = !!L && from <= L.b && next >= L.b;
    const hold = this._holdBetween(from, next);
    const incl = this._cueIncl; this._cueIncl = false;
    if (hold && !(wrap && hold.time >= L.b)) {       // a hold before the loop's end parks the show; a loop ending on the hold keeps looping
      const park = hold.time - HOLD_EPS;
      this.t = park;
      this.playing = false; this.holding = true; this._holdAt = hold;
      this._checkScene();
      this._cuesIn(from, park, incl, true);
      this._sample(); this._closeTakes('hold');
      return false;
    }
    if (wrap) {
      const span = L.b - L.a, over = (next - L.b) % span;
      this.t = L.b;                                  // the lap ends here: its cues and its take belong to this lap
      this._cuesIn(from, L.b, incl, L.b >= this.total - 1e-9);
      this._sample(); this._closeTakes('loop');
      this.loops += 1 + Math.floor((next - L.b) / span);
      this.t = L.a + over;
      this._checkScene('loop');
      this._cuesIn(L.a, this.t, true, true);        // the new lap includes a cue sitting on its first instant
      const info = { t: this.t, from: L.a, to: L.b, count: this.loops };
      for (const cb of this._loopCbs) { try { cb(info); } catch (e) { console.error('[timeline] onLoop handler:', e); } }
      this._sample();
      return true;
    }
    this.t = next;
    const ended = this.t >= this.total;
    if (ended) { this.t = this.total; this.playing = false; }
    this._checkScene();
    this._cuesIn(from, this.t, incl, true);
    this._sample();
    if (ended) this._closeTakes('end');
    return this.playing;
  }

  // ── loop ───────────────────────────────────────────────────────────────────────────────────
  /** The range being looped right now, { a, b } in seconds, or null. `loop` is true (the show, from 0 to total),
   *  'scene' (the scene the playhead is in), a scene id, or { from, to } (seconds or scene ids: a `from` id is that scene's
   *  start, a `to` id its end). */
  loopRange(t = this.t) {
    const L = this.loop;
    if (!L) return null;
    const scene = (i) => (i >= 0 && i < this.scenes.length ? [this.scenes[i].t, this.sceneEnd(i)] : [NaN, NaN]);
    const edge = (x, end) => { if (typeof x === 'number') return x; const [a, b] = scene(this.scenes.findIndex((sc) => sc.id === x)); return end ? b : a; };
    let a, b;
    if (L === true) { a = Math.max(0, this.start); b = this.total; }
    else if (L === 'scene') [a, b] = scene(this.sceneIndexAt(t));
    else if (typeof L === 'string') [a, b] = scene(this.scenes.findIndex((sc) => sc.id === L));
    else if (typeof L === 'object') { a = edge(L.from ?? 0, false); b = edge(L.to ?? this.total, true); }
    return b - a > 1e-9 ? { a, b } : null;
  }
  /** cb({ t, from, to, count }) each time the playhead wraps round the loop. */
  onLoop(cb) { this._loopCbs.push(cb); }

  // ── cues ───────────────────────────────────────────────────────────────────────────────────
  /** Every cue of every scene, in time order: { …cue, scene: sceneId, sceneIndex }. */
  cues() { return this._cuesIn(-Infinity, Infinity, true, true, false); }
  /** cb(cue, { cause }) when PLAYBACK passes a scene cue (cause 'play') or fireCue() sets it off by hand ('manual').
   *  A seek, a jump, a drag across the scrubber or a reset never fires one. */
  onCue(cb) { this._cueCbs.push(cb); }
  /** Set a cue off by hand (the scrubber's ◆ click). Accepts an item of cues() or any { name, t }. */
  fireCue(c) {
    const i = c.sceneIndex ?? this.sceneIndexAt(c.t);
    this._emitCue(c.sceneIndex === undefined ? { ...c, scene: this.scenes[i]?.id, sceneIndex: i } : c, 'manual');
  }
  _emitCue(c, cause) { for (const cb of this._cueCbs) { try { cb(c, { cause }); } catch (e) { console.error('[timeline] onCue handler:', e); } } }
  // the cues with a < t ≤ b (leftIncl / rightIncl: the bound itself counts), in time order; fires them unless emit === false
  _cuesIn(a, b, leftIncl, rightIncl, emit = true) {
    if (emit && !this._cueCbs.length) return;
    const hits = [];
    this.scenes.forEach((sc, i) => {
      for (const c of sc.cues || []) {
        if ((leftIncl ? c.t >= a : c.t > a) && (rightIncl ? c.t <= b : c.t < b)) hits.push({ ...c, scene: sc.id, sceneIndex: i });
      }
    });
    hits.sort((x, y) => x.t - y.t || x.sceneIndex - y.sceneIndex);
    if (!emit) return hits;
    for (const c of hits) this._emitCue(c, 'play');
  }

  // ── recording ──────────────────────────────────────────────────────────────────────────────
  /** Arm a lane: while the timeline PLAYS, whatever `source()` returns is written into automation[key] as keyframes.
   *  `source` returns a number while someone is "touching" (a knob override, a fader) and null/undefined when not: that
   *  closes the take. A take is also closed by pause, seek, jump, reset, a hold, the end of the show and each lap of a loop;
   *  the recorder stays armed until stop(). A closed take is thinned and merged by mergeTake(), then onRecord fires.
   *  opts = mergeTake()'s options. Returns the Recorder { key, take, active, commit(), stop() }. */
  record(key, source, opts = {}) {
    if (!this.schema.some((p) => p.key === key)) throw new Error(`[timeline] record(): unknown param "${key}"`);
    if (typeof source !== 'function') throw new Error('[timeline] record(): source must be a function returning a number or null');
    this.recorders.get(key)?.stop();
    const rec = new Recorder(this, key, source, opts);
    this.recorders.set(key, rec);
    return rec;
  }
  get recording() { return this.recorders.size > 0; }
  /** Close every armed recorder (committing what each holds). */
  stopRecording() { for (const r of [...this.recorders.values()]) r.stop(); }
  /** cb({ key, from, to, count, cause, keyframes }) when a take closes. count 0 = the take was too short to keep.
   *  cause: 'release' | 'stop' | 'pause' | 'seek' | 'jump' | 'reset' | 'hold' | 'loop' | 'end' | 'manual' */
  onRecord(cb) { this._recCbs.push(cb); }
  _sample() {
    if (!this.recorders.size) return;
    const T = this._autoTime(this.t);
    for (const r of this.recorders.values()) r.sample(T);
  }
  _closeTakes(cause) { for (const r of this.recorders.values()) r.commit(cause); }

  /** Write a take (an array of [t, value], t in automation time) into automation[key]:
   *   · thinned: the first and last points stay; a point in between stays when its value moved more than `epsilon`
   *     (default 0.6 % of the param's range) from the last kept one, or `maxGap` seconds (0.5) passed
   *   · merged: the existing keyframes inside the take's time span are replaced by it, those outside stay as they were
   *     (the segment that arrives at the take's first point keeps the take's curve; the next old keyframe keeps its own)
   *   · written as [t, value] (or [t, value, curve] when opts.curve is not 'linear'); t rounded to 3 decimals, value to 4
   *  Fewer than two points writes nothing. Returns { from, to, count } or null. */
  mergeTake(key, raw, opts = {}) {
    if (!raw || raw.length < 2) return null;
    const p = this.schema.find((q) => q.key === key);
    const { epsilon = p && Number.isFinite(p.max - p.min) ? (p.max - p.min) * 0.006 : 0, maxGap = 0.5, curve = 'linear' } = opts;
    const pts = [raw[0]];
    for (let i = 1; i < raw.length - 1; i++) {
      const last = pts[pts.length - 1];
      if (Math.abs(raw[i][1] - last[1]) > epsilon || raw[i][0] - last[0] > maxGap) pts.push(raw[i]);
    }
    pts.push(raw[raw.length - 1]);
    const written = [];
    for (const [t, v] of pts) {
      const k = curve === 'linear' ? [+t.toFixed(3), +v.toFixed(4)] : [+t.toFixed(3), +v.toFixed(4), curve];
      if (written.length && written[written.length - 1][0] === k[0]) written[written.length - 1] = k; else written.push(k);
    }
    const from = written[0][0], to = written[written.length - 1][0];
    const kept = (this.automation[key] || []).filter((k) => k[0] < from - 1e-3 || k[0] > to + 1e-3);
    this.automation[key] = [...kept, ...written].sort((x, y) => x[0] - y[0]);
    return { from, to, count: written.length };
  }
}

/** One armed lane — made by Timeline.record(). */
class Recorder {
  constructor(tl, key, source, opts) { this.tl = tl; this.key = key; this.source = source; this.opts = opts; this.take = []; this.active = true; }
  sample(T) {
    let v = null;
    try { v = this.source(); } catch (e) { console.error('[timeline] record source:', e); }
    if (typeof v === 'number' && Number.isFinite(v)) this.take.push([T, v]);
    else if (this.take.length) this.commit('release');
  }
  /** Close the take now (no-op when there is none). The recorder stays armed. */
  commit(cause = 'manual') {
    if (!this.take.length) return null;
    const raw = this.take; this.take = [];
    const r = this.tl.mergeTake(this.key, raw, this.opts);
    const info = { key: this.key, from: r ? r.from : raw[0][0], to: r ? r.to : raw[raw.length - 1][0], count: r ? r.count : 0, cause, keyframes: this.tl.automation[this.key] };
    for (const cb of this.tl._recCbs) { try { cb(info); } catch (e) { console.error('[timeline] onRecord handler:', e); } }
    return info;
  }
  /** Close the take and disarm. */
  stop() {
    this.commit('stop'); this.active = false;
    if (this.tl.recorders.get(this.key) === this) this.tl.recorders.delete(this.key);
  }
}
