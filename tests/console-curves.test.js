// @openav/console · 曲線視圖（G6）的純邏輯：哪些參數有曲線、橫軸、段落邊界、取樣、游標、覆寫標記、清除覆寫、快取鍵。
// 畫布在 console-curves-browser.test.js 用真瀏覽器驗；這裡只有不碰 DOM 的部分，Node 就能跑。
//
// 固定資料是虛構的：一個四段的 cut（第一段是 hold）與從它衍生的 short（長度 × 0.5）。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Params } from '../packages/core/src/params.js';
import { Timeline } from '../packages/timeline/index.js';
import { Score } from '../packages/score/index.js';
import {
  hasCurves, curveParams, curveAxis, axisFrac, axisTime, curveBands, sampleCurve, levelOf, plotY, autoToShow, keyframeMarks, takePoints,
  curveCursor, curveSignature, overriddenKeys, clearOverrides, visibleRows, fmtValue, fmtClock,
} from '../packages/console/src/curves.js';

const near = (a, b, e = 1e-9) => assert.ok(Math.abs(a - b) <= e, `${a} ≉ ${b}`);
const SCHEMA = [
  { key: 'haze', label: 'Haze', min: 0, max: 1, def: 0.1 },
  { key: 'sun', label: 'Sun height', min: -1, max: 1, def: 0 },
  { key: 'mode', min: 0, max: 3, def: 0, step: 1 },
  { key: 'flare', label: 'Flare!', pulse: true },
  { key: 'ghost', min: 0, max: 1, def: 0, hidden: true },
  { key: 'plain', label: 'Plain', min: 0, max: 1, def: 0.5 },
];
const CUTS = [
  { id: 'full', segments: [{ id: 'standby', dur: 6, hold: true }, { id: 'dawn', dur: 24 }, { id: 'noon', dur: 30 }, { id: 'night', dur: 40 }] },
  { id: 'short', from: 'full', scale: 0.5 },
];
const AUTOMATION = {
  haze: { standby: 0.1, dawn: [[0, 0.1], [1, 0.3]], noon: [[0, 0.3], [1, 0.55, 'ease']], night: [[0, 0.34], [0.45, 0.2], [1, 0.1]] },
  sun: [[0, -1], [100, 1]],
  mode: [[0, 0], [50, 3, 'step'], [100, 1]],
  flare: [[0, 1]],      // 脈衝參數：不畫
  ghost: [[0, 1]],      // hidden：不畫
};
const ABSOLUTE = { sun: AUTOMATION.sun, mode: AUTOMATION.mode };       // 沒有總譜就沒有段落 id 可以寫 lane：只用絕對秒
/** 一個有總譜的時間軸（cut: 'full' | 'short'），或沒有總譜的（cut: null，scenes 自己給）。 */
function rig(cut = 'full', automation = cut ? AUTOMATION : ABSOLUTE) {
  const params = new Params(structuredClone(SCHEMA));
  const score = cut ? new Score({ cuts: CUTS, cut }) : null;
  const timeline = new Timeline(score
    ? { params, score, automation: structuredClone(automation) }
    : { params, total: 60, scenes: [{ id: 'a', t: -10, title: 'Standby' }, { id: 'b', t: 0 }, { id: 'c', t: 30, hold: true }], automation: structuredClone(automation) });
  return { params, score, timeline, axis: curveAxis(timeline) };
}

// ───────────── 哪些參數有曲線 ─────────────

test('curves: one curve per param that has automation — schema order, no pulses, no hidden, no params without keyframes', () => {
  const { params, timeline } = rig();
  const list = curveParams(params, timeline);
  assert.deepEqual(list.map((p) => p.key), ['haze', 'sun', 'mode']);
  assert.deepEqual(list[0], { key: 'haze', label: 'Haze', min: 0, max: 1, step: 0, def: 0.1 });
  assert.equal(list[2].label, 'mode', 'no label: the key');
  assert.equal(list[2].step, 1);
  assert.equal(hasCurves(params, timeline), true);
});

test('curves: nothing automated → no curves; an empty keyframe list does not count; a param that appears later is picked up', () => {
  const { params, timeline } = rig('full', {});
  assert.deepEqual(curveParams(params, timeline), []);
  assert.equal(hasCurves(params, timeline), false);
  timeline.automation.plain = [];
  assert.equal(hasCurves(params, timeline), false, '[] is no curve');
  timeline.automation.plain = [[0, 0.2], [60, 0.8]];
  assert.deepEqual(curveParams(params, timeline).map((p) => p.key), ['plain']);
  params.add([{ key: 'late', min: 0, max: 5, def: 1 }]);
  timeline.automation.late = [[0, 1], [10, 4]];
  assert.deepEqual(curveParams(params, timeline).map((p) => p.key), ['plain', 'late'], 'schema order');
});

test('curves: a param without a usable range takes the range of its own curve', () => {
  const params = new Params([{ key: 'open' }, { key: 'flat', min: 5, max: 5 }]);
  const timeline = new Timeline({ params, total: 10, automation: { open: [[0, 2], [10, 6]], flat: [[0, 5]] } });
  const [a, b] = curveParams(params, timeline);
  assert.deepEqual([a.min, a.max], [2, 6]);
  assert.ok(b.max > b.min, 'a flat curve still has a height to draw in');
});

// ───────────── 橫軸與段落邊界 ─────────────

test('axis: the whole show, from the first scene (a standby may start before 0) to the total — the same axis as the scrubber', () => {
  const { timeline, axis } = rig('full');
  assert.deepEqual(axis, { lo: 0, hi: 100, span: 100 });
  const pre = rig(null).axis;
  assert.deepEqual(pre, { lo: -10, hi: 60, span: 70 }, 'a standby at -10 s is on the axis');
  near(axisFrac(pre, -10), 0); near(axisFrac(pre, 0), 10 / 70); near(axisFrac(pre, 60), 1);
  near(axisFrac(pre, -99), 0); near(axisFrac(pre, 999), 1);                   // outside the show: clamped
  near(axisTime(pre, 0), -10); near(axisTime(pre, 1), 60); near(axisTime(pre, 2), 60); near(axisTime(pre, -1), -10);
  for (const f of [0, 0.123, 0.5, 1]) near(axisFrac(pre, axisTime(pre, f)), f);
  assert.deepEqual(curveAxis(new Timeline({ params: new Params([]), total: 0 })), { lo: 0, hi: 0, span: 1 }, 'a show of no length still has an axis');
  void timeline;
});

test('bands: with a score every segment is a band with its id; they tile the axis; a hold is flagged', () => {
  const { timeline, axis } = rig('full');
  const bands = curveBands(timeline, axis);
  assert.deepEqual(bands.map((b) => b.id), ['standby', 'dawn', 'noon', 'night']);
  assert.deepEqual(bands.map((b) => [b.t0, b.t1]), [[0, 6], [6, 30], [30, 60], [60, 100]]);
  assert.deepEqual(bands.map((b) => b.hold), [true, false, false, false]);
  near(bands[0].x0, 0); near(bands[1].x0, 0.06); near(bands[3].x1, 1);
  for (let i = 1; i < bands.length; i++) near(bands[i].x0, bands[i - 1].x1);
  assert.deepEqual(curveBands(new Timeline({ params: new Params([]), total: 10 })), [], 'no scenes: no bands');
});

test('bands: a derived cut has the same proportions (the short cut is the full one × 0.5), a scene without an id is named by its place', () => {
  const full = curveBands(rig('full').timeline), short = rig('short');
  const sb = curveBands(short.timeline, short.axis);
  assert.equal(short.axis.hi, 50);
  assert.deepEqual(sb.map((b) => b.t1), [3, 15, 30, 50]);
  sb.forEach((b, i) => { near(b.x0, full[i].x0); near(b.x1, full[i].x1); });
  const bare = new Timeline({ params: new Params([]), total: 10, scenes: [{ t: 0 }, { t: 5, title: 'Second' }] });
  assert.deepEqual(curveBands(bare).map((b) => [b.id, b.title]), [['0', ''], ['1', 'Second']]);
});

// ───────────── 取樣 ─────────────

test('sampleCurve: n+1 values over the whole axis, each exactly what timeline.valueAt says at that second', () => {
  const { timeline, axis } = rig('full');
  const v = sampleCurve(timeline, 'haze', axis, 100);
  assert.equal(v.length, 101);
  for (const i of [0, 6, 30, 45, 60, 77, 100]) near(v[i], timeline.valueAt('haze', i), 1e-12);
  near(v[0], 0.1); near(v[30], 0.3); near(v[60], 0.34); near(v[100], 0.1);
  near(v[18], 0.1 + 0.2 * 0.5);                                              // dawn p=0.5, linear
  assert.equal(sampleCurve(timeline, 'haze', axis, 0).length, 2, 'n is at least 1');
});

test('sampleCurve: a derived cut shows the same curve, stretched — what the director sees is what the cut plays', () => {
  const a = rig('full'), b = rig('short');
  const va = sampleCurve(a.timeline, 'haze', a.axis, 200), vb = sampleCurve(b.timeline, 'haze', b.axis, 200);
  va.forEach((x, i) => near(x, vb[i], 1e-12));
  const ma = sampleCurve(a.timeline, 'mode', a.axis, 100);
  near(ma[49], 0); near(ma[50], 3); near(ma[51], 3, 0.1);                    // 'step' holds, then jumps
});

test('sampleCurve: before the first keyframe and after the last the value holds; a param with no keyframes is its default', () => {
  const { timeline } = rig(null);
  const axis = curveAxis(timeline);
  const v = sampleCurve(timeline, 'sun', axis, 70);
  near(v[0], -1); near(v[70], timeline.valueAt('sun', 60));
  const plain = sampleCurve(timeline, 'plain', axis, 4);
  assert.deepEqual(plain, [0.5, 0.5, 0.5, 0.5, 0.5]);
});

test('levelOf: where a value sits in the param range, 0 at the bottom and 1 at the top, clamped', () => {
  const sun = { min: -1, max: 1 };
  near(levelOf(sun, -1), 0); near(levelOf(sun, 0), 0.5); near(levelOf(sun, 1), 1);
  near(levelOf(sun, 7), 1); near(levelOf(sun, -7), 0);
  assert.equal(levelOf(sun, NaN), 0);
  assert.equal(levelOf(sun, Infinity), 0, 'not a number we can place');
});

test('plotY: a level is a height in a plot with 4 px free above and below, so a dot at the top or the bottom is whole', () => {
  near(plotY(1, 36), 4); near(plotY(0, 36), 32); near(plotY(0.5, 36), 18);
  near(plotY(0.9, 36), 4 + 0.1 * 28);
  near(plotY(0, 20, 0), 20);
});

// ───────────── 關鍵點與錄音中的 take ─────────────

test('keyframeMarks: the keyframes at their show time — a lane point lands on its segment boundary, on every cut', () => {
  for (const cut of ['full', 'short']) {
    const { timeline, axis, score } = rig(cut);
    const marks = keyframeMarks(timeline, 'haze', axis);
    // 'night' p=0.45 is the keyframe [60 + 0.45 × 40, 0.2] in the root cut
    const m = marks.find((k) => Math.abs(k.v - 0.2) < 1e-9);
    near(m.x, 0.78, 1e-9);
    near(m.t, score.timeAt('night', 0.45), 1e-9);
    assert.equal(m.kind, 'linear');
    const ease = marks.find((k) => k.kind === 'ease');
    near(ease.x, 0.6, 1e-9);                                                  // noon p=1
  }
  const { timeline, axis } = rig('full');
  assert.deepEqual(keyframeMarks(timeline, 'mode', axis).map((k) => k.kind), ['linear', 'step', 'linear']);
  timeline.automation.sun = [[0, -1], [50, 0, (f) => f * f], [500, 1]];
  assert.deepEqual(keyframeMarks(timeline, 'sun', axis).map((k) => k.kind), ['linear', 'fn'], 'a function curve is just "fn"; a keyframe off the end of the show is not drawn');
  assert.deepEqual(keyframeMarks(timeline, 'nothing', axis), []);
});

test('autoToShow: automation seconds → show seconds (identity without a score, undoes the stretch of a derived cut)', () => {
  const full = autoToShow(rig('full').timeline), short = autoToShow(rig('short').timeline), none = autoToShow(rig(null).timeline);
  near(full(30), 30); near(short(30), 15); near(short(100), 50); near(none(12.5), 12.5);
});

test('takePoints: the take being recorded, at show time, so the desk can draw what the curve is about to become', () => {
  const { timeline, axis } = rig('short');
  assert.deepEqual(takePoints(timeline, 'haze', axis), [], 'nothing armed');
  timeline.seek(10);                                                          // past the standby's hold (it would park the show and close a take)
  timeline.record('haze', () => 0.8);
  assert.deepEqual(takePoints(timeline, 'haze', axis), [], 'armed but nothing written yet');
  timeline.play();
  for (let i = 0; i < 20; i++) timeline.advance(0.25);                       // 5 show seconds
  const pts = takePoints(timeline, 'haze', axis);
  assert.ok(pts.length >= 10, String(pts.length));
  assert.ok(pts.every((p) => p.v === 0.8));
  near(pts[pts.length - 1].x, axisFrac(axis, timeline.t), 1e-9);             // the take ends where the playhead is
  for (let i = 1; i < pts.length; i++) assert.ok(pts[i].x >= pts[i - 1].x);
});

// ───────────── 游標與覆寫標記 ─────────────

test('cursor: the playhead on the axis, the curve\'s value there, and the value the show is really using', () => {
  const { params, timeline, axis } = rig('full');
  const p = curveParams(params, timeline)[0];
  timeline.seek(18);                                                          // dawn p = 0.5 → 0.2
  const c = curveCursor({ timeline, params, p, state: { haze: 0.2 }, axis });
  near(c.x, 0.18); near(c.at, 0.2); near(c.yAt, 0.2);
  assert.equal(c.overridden, false); assert.equal(c.override, null); assert.equal(c.yOver, null);
  near(c.now, 0.2);
  near(curveCursor({ timeline, params, p, state: {}, axis }).now, 0.2, 1e-12);          // no state for it: the curve's value
});

test('cursor: an overridden param reports the override and its level; the curve keeps its own value, so the desk can draw both', () => {
  const { params, timeline, axis } = rig('full');
  const p = curveParams(params, timeline)[1];                                // sun, -1…1
  timeline.seek(50);                                                          // the curve says 0
  params.override('sun', 0.5);
  const c = curveCursor({ timeline, params, p, state: params.resolve(timeline.state()), axis });
  assert.equal(c.overridden, true);
  assert.equal(c.override, 0.5); near(c.yOver, 0.75);
  near(c.at, 0); near(c.yAt, 0.5);
  assert.equal(c.now, 0.5, 'the number the show uses is the override');
  params.override('sun', 9);                                                  // Params clamps to the range
  assert.equal(curveCursor({ timeline, params, p, state: {}, axis }).override, 1);
});

test('overrides: which of the shown curves are overridden, and "clear all" gives back those — not params the view does not show', () => {
  const { params, timeline } = rig('full');
  const list = curveParams(params, timeline);
  assert.deepEqual(overriddenKeys(params, list), []);
  params.override('sun', 0.1); params.override('haze', 0.9); params.override('plain', 0.2);   // plain has no curve
  assert.deepEqual(overriddenKeys(params, list), ['haze', 'sun'], 'schema order');
  assert.equal(clearOverrides(params, overriddenKeys(params, list)), 2);
  assert.deepEqual(overriddenKeys(params, list), []);
  assert.equal(params.isOverridden('plain'), true, 'an override the view does not show stays');
  assert.equal(clearOverrides(params, ['haze']), 0, 'nothing to clear');
  assert.equal(clearOverrides(params, []), 0);
});

// ───────────── 快取：什麼時候要重畫曲線 ─────────────

test('signature: the same while the show just plays — time, overrides, a take being recorded do not redraw the curves', () => {
  const { params, timeline } = rig('full');
  const sig = curveSignature(timeline, params);
  assert.equal(typeof sig, 'number');
  assert.equal(curveSignature(timeline, params), sig, 'deterministic');
  timeline.play(); timeline.advance(1); timeline.seek(33); params.override('sun', 0.3); timeline.record('haze', () => 0.5); timeline.advance(0.5);
  assert.equal(curveSignature(timeline, params), sig);
});

test('signature: changes when the automation does — a keyframe edited in place, an import, a recorded take, a new lane, a removed one', () => {
  const seen = new Set();
  const check = (what, change) => {
    const { params, timeline } = rig('full');
    const before = curveSignature(timeline, params);
    change(timeline, params);
    const after = curveSignature(timeline, params);
    assert.notEqual(after, before, what);
    seen.add(after);
  };
  check('edit a value in place', (t) => { t.automation.sun[1][1] = 0.75; });
  check('edit a time in place', (t) => { t.automation.sun[1][0] = 90; });
  check('change a curve in place', (t) => { t.automation.mode[1][2] = 'ease'; });
  check('import', (t) => { t.importAutomation({ sun: [[0, 0], [10, 1]] }); });
  check('import with replace', (t) => { t.importAutomation({ sun: [[0, 0], [10, 1]] }, { replace: true }); });
  check('a recorded take', (t) => { t.mergeTake('sun', [[10, 0.2], [11, 0.4], [12, 0.9]]); });
  check('a new lane', (t) => { t.automation.plain = [[0, 0], [50, 1]]; });
  check('a lane removed', (t) => { delete t.automation.sun; });
  check('keyframes added', (t) => { t.automation.sun.push([120, 0]); });
  assert.equal(seen.size, 9, 'every kind of change has its own signature');
});

test('signature: changes when the axis or the params do — total, a scene boundary, the cut, a range or a label', () => {
  const sigOf = (t, p) => curveSignature(t, p);
  const base = rig('full'), s0 = sigOf(base.timeline, base.params);
  const total = rig('full'); total.timeline.total = 120;
  assert.notEqual(sigOf(total.timeline, total.params), s0, 'total');
  const moved = rig('full'); moved.timeline.scenes[1].t = 7;
  assert.notEqual(sigOf(moved.timeline, moved.params), s0, 'scene boundary');
  const hold = rig('full'); hold.timeline.scenes[2].hold = true;
  assert.notEqual(sigOf(hold.timeline, hold.params), s0, 'a hold');
  const short = rig('short');
  assert.notEqual(sigOf(short.timeline, short.params), s0, 'another cut');
  const range = rig('full'); range.params.schema[0].max = 2;
  assert.notEqual(sigOf(range.timeline, range.params), s0, 'range');
  const label = rig('full'); label.params.schema[0].label = 'Fog';
  assert.notEqual(sigOf(label.timeline, label.params), s0, 'label');
  const hid = rig('full'); hid.params.schema[1].hidden = true;
  assert.notEqual(sigOf(hid.timeline, hid.params), s0, 'a param hidden');
  const again = rig('full');
  assert.equal(sigOf(again.timeline, again.params), s0, 'an identical show has the identical signature');
});

test('signature: cheap enough to ask every frame (40 curves of 200 keyframes)', () => {
  const schema = Array.from({ length: 40 }, (_, i) => ({ key: 'p' + i, min: 0, max: 1, def: 0 }));
  const automation = Object.fromEntries(schema.map((p) => [p.key, Array.from({ length: 200 }, (_, k) => [k, (k % 7) / 7, k % 3 ? 'ease' : undefined].filter((x) => x !== undefined))]));
  const params = new Params(schema), timeline = new Timeline({ params, total: 200, automation });
  const t0 = performance.now();
  for (let i = 0; i < 100; i++) curveSignature(timeline, params);
  const per = (performance.now() - t0) / 100;
  assert.ok(per < 2, `${per.toFixed(3)} ms per call`);                       // 8000 keyframes: a fraction of a millisecond on any machine
});

// ───────────── 清單太長時的捲動 ─────────────

test('visibleRows: only the rows in the scroll window (plus a margin) are drawn', () => {
  assert.deepEqual(visibleRows(0, 100, 50, 10), [0, 1]);
  assert.deepEqual(visibleRows(25, 100, 50, 10), [0, 2], 'a row half in view counts');
  assert.deepEqual(visibleRows(100, 100, 50, 10, 1), [1, 4], 'margin rows on both sides');
  assert.deepEqual(visibleRows(0, 100, 50, 2, 1), [0, 1], 'clamped to the rows there are');
  assert.deepEqual(visibleRows(9999, 100, 50, 10), [9, 9], 'scrolled past the end: the last row');
  const none = visibleRows(0, 0, 50, 10);
  assert.ok(none[1] < none[0], 'a closed (zero-height) list shows no rows');
  const empty = visibleRows(0, 100, 50, 0);
  assert.ok(empty[1] < empty[0], 'no rows');
});

test('fmtValue: the number a head prints — two decimals, none from 100 up', () => {
  assert.equal(fmtValue(0.5), '0.50');
  assert.equal(fmtValue(-0.256), '-0.26');
  assert.equal(fmtValue(120.4), '120');
  assert.equal(fmtValue(-150), '-150');
  assert.equal(fmtValue(NaN), '–');
  assert.equal(fmtValue(undefined), '–');
});

test('fmtClock: the clock of the transport — m:ss, a minus before the start', () => {
  assert.equal(fmtClock(0), '0:00'); assert.equal(fmtClock(7.9), '0:07'); assert.equal(fmtClock(125), '2:05'); assert.equal(fmtClock(-30), '-0:30');
  assert.equal(fmtClock(NaN), '–');
});
