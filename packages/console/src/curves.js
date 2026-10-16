// Curves — the pure half of the desk's curve view. No DOM, no canvas: Node can test every line (tests/console-curves.test.js).
//
// The view draws, for every param that has automation, the curve of the WHOLE show: time across, the param's range up,
// the segment boundaries and ids behind it, the playhead on it, and — when a knob, a slider or a phone has taken the param
// over — where it was taken to. curves-panel.js paints; this file answers the questions it paints from:
//
//   which params get a curve        curveParams()      · hasCurves() for the cheap yes/no
//   the horizontal axis             curveAxis()        the same span as the scrubber (a standby may start before 0)
//   segment boundaries and ids      curveBands()       the timeline's scenes (with a score: its segments)
//   the curve itself                sampleCurve()      timeline.valueAt() over the axis, so a derived cut shows its own length
//   the keyframes                   keyframeMarks()    where each one lands in SHOW seconds (see autoToShow)
//   the playhead and the override   curveCursor()      the curve's value there, and the override if one holds the param
//   "when must the curves be redrawn"  curveSignature()   one number; the same while the show merely plays
//
// Two kinds of seconds meet here, and mixing them up draws a derived cut wrong: timeline.automation holds the root cut's
// seconds, while timeline.t, the scenes and the axis are the cut being played (a `short` cut with scale 0.5 plays everything
// in half the time). timeline.valueAt(key, T) takes show seconds and does the conversion itself; keyframes and takes come
// out of timeline.automation / the recorders in automation seconds, so they go through autoToShow() before they are placed.

const finite = (x) => typeof x === 'number' && Number.isFinite(x);
const clamp01 = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x);

// ───────────── which params get a curve ─────────────

/** Does any param the desk shows have keyframes? Cheap (no allocation): the closed panel asks it now and then to decide whether to show its header. */
export function hasCurves(params, timeline) {
  const auto = timeline?.automation;
  if (!auto) return false;
  for (const p of params?.schema || []) {
    if (p && !p.pulse && !p.hidden && Array.isArray(auto[p.key]) && auto[p.key].length) return true;
  }
  return false;
}

/**
 * The params that get a curve, in the order they were declared (the order of the Params panel): not pulses, not the
 * ones hidden (another instrument's knobs), only those with at least one keyframe. A param without a usable range
 * (min/max missing or equal) takes the range of its own keyframes, so it still has a height to be drawn in.
 * @returns {{ key: string, label: string, min: number, max: number, step: number, def: number|undefined }[]}
 */
export function curveParams(params, timeline) {
  const auto = timeline?.automation || {}, out = [];
  for (const p of params?.schema || []) {
    if (!p || p.pulse || p.hidden) continue;
    const kf = auto[p.key];
    if (!Array.isArray(kf) || !kf.length) continue;
    let { min, max } = p;
    if (!(finite(min) && finite(max) && max > min)) {
      const vs = kf.map((k) => k[1]).filter(finite);
      min = vs.length ? Math.min(...vs) : 0; max = vs.length ? Math.max(...vs) : 1;
      if (!(max > min)) { min -= 0.5; max += 0.5; }
    }
    out.push({ key: p.key, label: p.label || p.key, min, max, step: p.step || 0, def: p.def });
  }
  return out;
}

// ───────────── the horizontal axis ─────────────

/** The whole show on one axis: from the first scene (which may start before 0, a standby) to the total. Same as the scrubber's. */
export function curveAxis(timeline) {
  const sc = timeline?.scenes || [];
  const lo = sc.length ? Math.min(0, sc[0].t) : 0;
  const hi = finite(timeline?.total) ? timeline.total : lo + 1;
  return { lo, hi, span: hi - lo > 1e-9 ? hi - lo : 1 };
}
/** Seconds → 0…1 across the axis (clamped). */
export const axisFrac = (axis, t) => clamp01((t - axis.lo) / axis.span);
/** 0…1 across the axis → seconds (clamped to the show). This is what a click seeks to, as on the scrubber. */
export const axisTime = (axis, f) => axis.lo + axis.span * clamp01(f);

/**
 * The segments as bands across the axis. With a score the timeline's scenes ARE the score's segments, so the ids are the
 * segment ids; a plain timeline gives its scenes; none → no bands. `hold`: the show waits at the end of this one.
 * @returns {{ index: number, id: string, title: string, t0: number, t1: number, x0: number, x1: number, hold: boolean }[]}
 */
export function curveBands(timeline, axis = curveAxis(timeline)) {
  const sc = timeline?.scenes || [];
  return sc.map((s, i) => {
    const t0 = s.t, t1 = timeline.sceneEnd(i);
    return { index: i, id: s.id != null ? String(s.id) : String(i), title: s.title || s.id || '', t0, t1, x0: axisFrac(axis, t0), x1: axisFrac(axis, t1), hold: !!s.hold };
  });
}

// ───────────── the curve ─────────────

/** n+1 values of the param's curve, evenly over the axis — exactly timeline.valueAt() at each second, so a step stays a step. */
export function sampleCurve(timeline, key, axis, n) {
  const m = Math.max(1, Math.floor(n)), out = new Array(m + 1);
  for (let i = 0; i <= m; i++) out[i] = timeline.valueAt(key, axis.lo + axis.span * (i / m));
  return out;
}

/** A value's height in the param's range: 0 at the bottom, 1 at the top, clamped (a number we cannot place is the bottom). */
export function levelOf(p, v) {
  if (!finite(v)) return 0;
  return clamp01((v - p.min) / (p.max - p.min));
}

/** Where a level sits in a plot `h` px tall that keeps `pad` px free above and below (so a dot at the top or bottom is whole). */
export const plotY = (level, h, pad = 4) => pad + (1 - level) * (h - 2 * pad);

/**
 * Automation seconds → show seconds. The same without a score; with one it undoes the cut's stretch
 * (score.baseTime(T) = T / scale, so a half-length cut shows a keyframe at 30 s of the root cut at 15 s).
 */
export function autoToShow(timeline) {
  const s = timeline?.score;
  if (!s || typeof s.baseTime !== 'function') return (t) => t;
  const b0 = s.baseTime(0), k = s.baseTime(1) - b0;
  if (!(k > 0) || !Number.isFinite(k)) return (t) => t;                       // not a stretch we can undo: read the seconds as they are
  return (t) => (t - b0) / k;
}

/**
 * Where the keyframes of a param sit: `{ t (show seconds), x (0…1), v, kind }`. `kind` is the curve that ARRIVES at the keyframe:
 * 'linear' (also when none is written), 'ease', 'in', 'out', 'step', or 'fn' for a function. Keyframes outside the show are left out.
 */
export function keyframeMarks(timeline, key, axis) {
  const kf = timeline?.automation?.[key];
  if (!Array.isArray(kf)) return [];
  const toShow = autoToShow(timeline), eps = 1e-6 * axis.span, out = [];
  for (const k of kf) {
    const t = toShow(k[0]);
    if (!finite(t) || t < axis.lo - eps || t > axis.hi + eps) continue;
    out.push({ t, x: axisFrac(axis, t), v: k[1], kind: typeof k[2] === 'function' ? 'fn' : (k[2] ?? 'linear') });
  }
  return out;
}

/** The take being recorded into a param's lane (timeline.record), as `{ x, v }` points on the axis; [] when none is open or it has one point. */
export function takePoints(timeline, key, axis) {
  const take = timeline?.recorders?.get?.(key)?.take;
  if (!take || take.length < 2) return [];
  const toShow = autoToShow(timeline);
  return take.map(([t, v]) => ({ x: axisFrac(axis, toShow(t)), v }));
}

// ───────────── the playhead and the override ─────────────

/**
 * What to draw for one param right now: the playhead's `x` (0…1); `at`, the curve's value there, and its level `yAt`;
 * and, when the param is overridden (a slider, a mapped knob, a phone), the `override` value and its level `yOver` — both
 * are given, because the point of the view is to see where you took the param away from where the curve would have it.
 * `now` is the value the show is using (state[key] when given). `state` is the resolved param state console.render() gets.
 */
export function curveCursor({ timeline, params, p, state, axis }) {
  const at = timeline.valueAt(p.key);
  const raw = params.isOverridden?.(p.key) ? params.overrides[p.key] : null;
  const overridden = finite(raw);
  const now = finite(state?.[p.key]) ? state[p.key] : overridden ? raw : at;
  return {
    x: axisFrac(axis, timeline.t), at, yAt: levelOf(p, at),
    overridden, override: overridden ? raw : null, yOver: overridden ? levelOf(p, raw) : null,
    now,
  };
}

/** The keys among the curves in view that are overridden right now (curve order). */
export function overriddenKeys(params, list) {
  const out = [];
  for (const p of list) if (params.isOverridden(p.key)) out.push(p.key);
  return out;
}

/** Give these params back to their curves. Returns how many were overridden (and are not now). Others stay as they are. */
export function clearOverrides(params, keys) {
  let n = 0;
  for (const k of keys) if (params.isOverridden(k)) { params.clearOverride(k); n++; }
  return n;
}

// ───────────── when the curves must be redrawn ─────────────

const f64 = new Float64Array(1), u32 = new Uint32Array(f64.buffer);

/**
 * One number that stands for everything the CURVES (not the cursor) depend on: the axis (total, start, the scene boundaries, holds,
 * the cut), which params get a row and their label and range, and every keyframe — time, value, curve — of those params. It
 * ignores the playhead, the overrides and a take being recorded, which change every frame and live on the cursor layer.
 * It reads the keyframes themselves instead of trusting object identity, so an edit in place (`automation.hue[2][1] = 0.4`)
 * is noticed; that is a few thousand multiplications a frame for a big show, with no allocation.
 */
export function curveSignature(timeline, params) {
  let h = 2166136261;
  const mix = (x) => { h = Math.imul(h ^ x, 16777619); };
  const num = (x) => { f64[0] = x; mix(u32[0]); mix(u32[1]); };
  const str = (s) => { s = String(s); mix(s.length); for (let i = 0; i < s.length; i++) mix(s.charCodeAt(i)); };
  num(timeline.total); num(timeline.start ?? 0);
  const sc = timeline.scenes || [];
  mix(sc.length);
  for (const s of sc) { num(s.t); str(s.id ?? ''); mix(s.hold ? 1 : 0); }
  const score = timeline.score;
  if (score) { str(score.cut ?? ''); num(score.scale ?? 1); }
  const auto = timeline.automation || {};
  for (const p of params?.schema || []) {
    if (!p || p.pulse || p.hidden) continue;
    const kf = auto[p.key];
    if (!Array.isArray(kf) || !kf.length) continue;
    str(p.key); str(p.label || ''); num(p.min ?? NaN); num(p.max ?? NaN); num(p.step || 0);
    mix(kf.length);
    for (const k of kf) { num(k[0]); num(k[1]); const c = k[2]; if (c === undefined || c === null) mix(0); else if (typeof c === 'function') mix(1); else str(c); }
  }
  return h >>> 0;
}

// ───────────── a list longer than its window ─────────────

/** The rows [from, to] (inclusive) that intersect the scroll window, `margin` rows more on each side. `to < from`: none (a closed list has no height). */
export function visibleRows(scrollTop, viewH, rowH, count, margin = 0) {
  if (!(count > 0) || !(viewH > 0) || !(rowH > 0)) return [0, -1];
  const from = Math.max(0, Math.floor(scrollTop / rowH) - margin);
  const to = Math.min(count - 1, Math.ceil((scrollTop + viewH) / rowH) - 1 + margin);
  return [Math.min(from, count - 1), to];
}

// ───────────── text ─────────────

/** A value as a head prints it: two decimals, none from 100 up (as the Params panel). */
export function fmtValue(v) {
  if (!finite(v)) return '–';
  return Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(2);
}

/** Seconds as a clock, as the transport prints it: 0:07, 12:03, -0:30 (a standby before the start). */
export function fmtClock(t) {
  if (!finite(t)) return '–';
  const neg = t < 0; t = Math.abs(t);
  return (neg ? '-' : '') + Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0');
}
