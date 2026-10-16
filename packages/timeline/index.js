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
//   tl.exportAutomation({ as: 'seconds' | 'segments' }) / tl.importAutomation(json) · lanePos(t) / laneTime(id, p): seconds ↔ (segment, p)
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

/** automation 檔案的 format 欄位。 */
export const AUTOMATION_FORMAT = 'openav-automation';
const LANE_EPS = 1e-9;

/** 物件＝ lane（每段一組點）；陣列＝絕對秒的關鍵點。 */
export const isLane = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);

const bounds = (s) => [s.start, s.end ?? s.start + s.dur];
const secOf = (s, p) => { const [a, b] = bounds(s); return p === 0 ? a : p === 1 ? b : a + p * (b - a); };   // p=0／1 落在段界上，不留浮點誤差
const show = (x) => (typeof x === 'string' ? JSON.stringify(x) : String(x));

/** 秒 → 屬於哪一段、走了多少：{ id, index, p }。段界屬於從那裡開始的那段，演出的最後一秒是最後一段的 p=1；演出之外是 null。 */
export function lanePos(plan, t) {
  const n = plan.length;
  if (!n || !Number.isFinite(t)) return null;
  if (t < bounds(plan[0])[0] - LANE_EPS || t > bounds(plan[n - 1])[1] + LANE_EPS) return null;
  for (let i = 0; i < n; i++) {
    const [a, b] = bounds(plan[i]);
    if (t < b - LANE_EPS || i === n - 1) return { id: plan[i].id, index: i, p: b - a > 0 ? Math.min(1, Math.max(0, (t - a) / (b - a))) : 0 };
  }
  return null;
}

/** lanePos 的反函數：第 id 段走到 p（預設 0）是第幾秒；沒有這個 id 就 NaN。 */
export function laneTime(plan, id, p = 0) {
  const s = plan.find((x) => x.id === id);
  return s && Number.isFinite(p) ? secOf(s, p) : NaN;
}

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

/**
 * compileLane 的反函數：絕對秒的關鍵點 → lane。每個關鍵點落進它所在的那一段；
 * 恰在段界上的：單獨一點歸下一段的 p=0，同一秒有兩點以上就是跳變，前面的歸上一段的 p=1、最後一點歸下一段的 p=0
 * （所以 compileLane 編出來的 lane 拆回去一模一樣）。演出範圍之外的關鍵點寫不成 (段落, p)，丟 RangeError。
 * p 四捨五入到 `precision` 位小數（預設 9：一小時的段落誤差不到 2 µs）；null＝不捨入。
 */
export function decompileLane(plan, keyframes, { key = '?', precision = 9 } = {}) {
  if (!plan.length) throw new Error(`[timeline] automation "${key}" cannot be written per segment: there are no segments (pass a score or scenes)`);
  if (new Set(plan.map((s) => s.id)).size !== plan.length) throw new Error(`[timeline] automation "${key}" cannot be written per segment: two segments share an id`);
  const rows = keyframes.map((k, i) => ({ t: k[0], v: k[1], c: k[2], i })).sort((x, y) => x.t - y.t || x.i - y.i);
  const n = plan.length, B = plan.map(bounds), lo = B[0][0], hi = B[n - 1][1];
  const q = precision === null ? null : 10 ** precision;
  const lane = {};
  const put = (si, p, r) => (lane[plan[si].id] || (lane[plan[si].id] = [])).push(r.c === undefined || r.c === null ? [p, r.v] : [p, r.v, r.c]);
  for (let g = 0; g < rows.length;) {
    let e = g + 1;
    while (e < rows.length && rows[e].t - rows[g].t <= LANE_EPS) e++;
    const group = rows.slice(g, e), t = group[0].t;
    g = e;
    if (t < lo - LANE_EPS || t > hi + LANE_EPS) {
      throw new RangeError(`[timeline] automation "${key}": the keyframe at ${t} s is outside the show (${lo} … ${hi} s), so it has no (segment, p); export as seconds instead`);
    }
    let si = 0;
    while (si < n - 1 && t >= B[si][1] - LANE_EPS) si++;
    const [a, b] = B[si];
    const atEnd = si === n - 1 && t >= b - LANE_EPS;
    const atStart = !atEnd && Math.abs(t - a) <= LANE_EPS;
    if (atEnd) group.forEach((r) => put(si, 1, r));
    else if (atStart) {
      group.forEach((r, k) => (k < group.length - 1 && si > 0 ? put(si - 1, 1, r) : put(si, 0, r)));
    } else {
      const raw = (t - a) / (b - a), p = q === null ? raw : Math.round(raw * q) / q;
      group.forEach((r) => put(si, Math.min(1, Math.max(0, p)), r));
    }
  }
  return lane;
}

/** [[t, v, curve?], …] → 檢查（有限數字）、複製、照時間排好。壞的丟錯，指出是哪個鍵的第幾點。 */
function cleanKeyframes(key, kf, { json = false } = {}) {
  if (!Array.isArray(kf)) throw new Error(`[timeline] automation "${key}": expected keyframes [[t, value, curve?], …] or a lane { segmentId: [[p, value], …] } (got ${show(kf)})`);
  const out = kf.map((k, i) => {
    if (!Array.isArray(k) || k.length < 2) throw new Error(`[timeline] automation "${key}"[${i}]: a keyframe is [t, value, curve?]`);
    if (!Number.isFinite(k[0])) throw new Error(`[timeline] automation "${key}"[${i}]: t must be a finite number (got ${show(k[0])})`);
    if (!Number.isFinite(k[1])) throw new Error(`[timeline] automation "${key}"[${i}]: the value must be a finite number (got ${show(k[1])})`);
    if (json && typeof k[2] === 'function') throw new Error(`[timeline] exportAutomation(): "${key}"[${i}] has a curve function, which JSON cannot hold; name the curve ('ease', 'in', …) to export it`);
    return k[2] === undefined || k[2] === null ? [k[0], k[1]] : [k[0], k[1], k[2]];
  });
  return out.map((k, i) => ({ k, i })).sort((x, y) => x.k[0] - y.k[0] || x.i - y.i).map((x) => x.k);
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

  // ── lanes：以段落為單位的自動化，和 automation 的匯出／匯入 ─────────────────────────────────────
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

  /** automation 的某一秒落在哪一段、走了多少：{ id, index, p }；演出之外是 null。 */
  lanePos(t) { return lanePos(this._plan(), t); }
  /** lanePos 的反函數：第 id 段走到 p（預設 0）是 automation 的第幾秒；沒有這個 id 是 NaN。 */
  laneTime(id, p = 0) { return laneTime(this._plan(), id, p); }
  /** 把 automation（絕對秒）寫成 lane：{ key: { 段落 id: [[p, 值, 曲線?], …] } }。keys 預設全部有關鍵點的鍵。 */
  lanes(keys = Object.keys(this.automation), { precision } = {}) {
    const plan = this._plan(), out = {};
    for (const key of keys) {
      if (!Array.isArray(this.automation[key])) continue;
      out[key] = decompileLane(plan, cleanKeyframes(key, this.automation[key]), { key, precision });
    }
    return out;
  }

  /**
   * 匯出 automation 成可以 JSON.stringify 的物件（一份拷貝，改它不會動到時間軸）：
   *   { format: 'openav-automation', version: 1, cut, as, automation }
   * as 'seconds'（預設）：每個鍵是 root cut 秒數的關鍵點；as 'segments'：每個鍵是 lane，換了 cut 長度也成立。
   * `cut` 是 root cut 的 id（沒有總譜是 null）。curve 是函式的關鍵點寫不進 JSON，會丟錯；沒有關鍵點的鍵不寫。
   * @param {{ keys?: string[], as?: 'seconds'|'segments', precision?: number|null }} [opts]
   */
  exportAutomation({ keys = Object.keys(this.automation), as = 'seconds', precision } = {}) {
    if (as !== 'seconds' && as !== 'segments') throw new TypeError(`[timeline] exportAutomation(): as must be 'seconds' or 'segments' (got ${show(as)})`);
    const plan = as === 'segments' ? this._plan() : null, automation = {};
    for (const key of keys) {
      if (!Array.isArray(this.automation[key])) continue;
      const kf = cleanKeyframes(key, this.automation[key], { json: true });
      automation[key] = plan ? decompileLane(plan, kf, { key, precision }) : kf;
    }
    return { format: AUTOMATION_FORMAT, version: 1, cut: this.score ? this.score.base : null, as, automation };
  }

  /**
   * 匯入 exportAutomation() 的結果（物件或 JSON 字串），或一張光溜溜的 { key: 關鍵點｜lane }。回傳匯入的鍵。
   * 只換檔案裡有的鍵（keys 可再挑）；replace: true 連檔案沒提到的鍵也清掉。全有或全無：任何一個鍵壞了，所有鍵都維持原樣。
   * 絕對秒的檔案是對著某個 root cut 寫的，cut 和這條時間軸的 root cut 不同就丟錯（ignoreCut: true 蓋過）；lane 不受影響。
   * @param {object|string} doc
   * @param {{ keys?: string[], replace?: boolean, ignoreCut?: boolean }} [opts]
   */
  importAutomation(doc, { keys = null, replace = false, ignoreCut = false } = {}) {
    let d = doc;
    if (typeof d === 'string') { try { d = JSON.parse(d); } catch (e) { throw new Error(`[timeline] importAutomation(): not valid JSON (${e.message})`); } }
    if (!isLane(d)) throw new TypeError('[timeline] importAutomation(): expected an object or a JSON string');
    let map = d, cut = null;
    if (typeof d.format === 'string') {
      if (d.format !== AUTOMATION_FORMAT) throw new Error(`[timeline] importAutomation(): format ${show(d.format)} is not "${AUTOMATION_FORMAT}"`);
      if (!((d.version ?? 1) <= 1)) throw new Error(`[timeline] importAutomation(): version ${d.version} is newer than this timeline reads (1)`);
      if (!isLane(d.automation)) throw new Error('[timeline] importAutomation(): the file has no "automation" object');
      map = d.automation; cut = d.cut ?? null;
    }
    const plan = this._plan(), known = this._known(), next = {};
    for (const [key, v] of Object.entries(map)) {
      if (keys && !keys.includes(key)) continue;
      if (isLane(v)) { next[key] = this._laneKeyframes(key, v, plan, known); continue; }
      if (cut !== null && this.score && cut !== this.score.base && !ignoreCut) {
        throw new Error(`[timeline] importAutomation(): "${key}" is in seconds written against cut "${cut}", but this timeline's root cut is "${this.score.base}" (export as 'segments' to share it across cuts, or pass ignoreCut: true)`);
      }
      next[key] = cleanKeyframes(key, v);
    }
    if (replace) for (const k of Object.keys(this.automation)) if (!(k in next)) delete this.automation[k];
    Object.assign(this.automation, next);
    return Object.keys(next);
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
