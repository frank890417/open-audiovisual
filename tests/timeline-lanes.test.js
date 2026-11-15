// @openav/timeline · 以段落為單位的自動化（lanes）。
//
//   automation: { lvl: { rise: [[0, 0.2], [1, 0.8, 'ease']] } }     // 每個鍵是段落 id，點是 [段內進度 p, 值, 曲線?]
//
// Timeline 對「當前 root cut」編成絕對秒；衍生 cut 照舊用 score.baseTime 伸縮。舊的絕對秒寫法一個位元都沒變。
// 固定資料是虛構的：兩個結構不同的 root cut（long 有 coda、brief 沒有、各段長度不同）與一個從 long 衍生的 half。
// （automation 的匯出／匯入與「秒 ↔ (段落 id, p)」換算在 timeline-automation-io.test.js。）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Score, Director } from '../packages/score/index.js';
import { Params } from '../packages/core/src/params.js';
import { Timeline, CURVES } from '../packages/timeline/index.js';

const near = (a, b, e = 1e-9) => assert.ok(Math.abs(a - b) <= e, `${a} ≉ ${b}`);
const P = [{ key: 'lvl', min: 0, max: 1, def: 0.5 }, { key: 'mode', min: 0, max: 3, def: 0, step: 1 }];
const CUTS = [
  { id: 'long', segments: [{ id: 'intro', dur: 10 }, { id: 'rise', dur: 60 }, { id: 'peak', dur: 30 }, { id: 'coda', dur: 20 }] },
  { id: 'brief', segments: [{ id: 'intro', dur: 4 }, { id: 'rise', dur: 12 }, { id: 'peak', dur: 8 }] },
  { id: 'half', from: 'long', scale: 0.5 },
];
const score = (cut) => new Score({ cuts: CUTS, cut });
const tl = (cut, automation, extra = {}) => new Timeline({ params: P, score: score(cut), automation, ...extra });
const LANES = {
  lvl: {
    intro: [[0, 0.2]],
    rise: [[0, 0.2], [1, 0.8, 'ease']],
    peak: [[0, 0.8], [1, 0.8]],
    coda: [[0, 0.8], [1, 0.1, 'out']],
  },
};

// ───────────── G1 · 以段落 id 寫曲線 ─────────────

test('lanes: a point [p, v, curve] is the keyframe [seg.start + p × seg.dur, v, curve] of the current root cut', () => {
  const t = tl('long', LANES);
  near(t.valueAt('lvl', 10), 0.2);                                    // rise p=0
  near(t.valueAt('lvl', 40), 0.2 + 0.6 * CURVES.ease(0.5));           // rise p=0.5, ease
  near(t.valueAt('lvl', 25), 0.2 + 0.6 * CURVES.ease(0.25));
  near(t.valueAt('lvl', 70), 0.8);
  near(t.valueAt('lvl', 100), 0.8);                                   // coda p=0
  near(t.valueAt('lvl', 110), 0.8 + (0.1 - 0.8) * CURVES.out(0.5));   // coda p=0.5, out
  near(t.valueAt('lvl', 120), 0.1);
});

test('lanes: the compiled automation is ordinary absolute-second keyframes in timeline.automation', () => {
  const t = tl('long', LANES);
  assert.ok(Array.isArray(t.automation.lvl));
  const first = t.automation.lvl[0], ease = t.automation.lvl.find((k) => k[2] === 'ease');
  assert.deepEqual(first, [0, 0.2]);
  assert.deepEqual(ease, [70, 0.8, 'ease']);
});

test('lanes: another root cut with other lengths compiles against its own structure, the same (segment, p) reads the same value', () => {
  const long = tl('long', LANES), brief = tl('brief', LANES);
  for (const p of [0, 0.1, 0.25, 0.5, 0.75, 0.999]) {
    const a = long.valueAt('lvl', long.score.timeAt('rise', p)), b = brief.valueAt('lvl', brief.score.timeAt('rise', p));
    near(a, b, 1e-9);
    near(a, 0.2 + 0.6 * CURVES.ease(p), 1e-9);
  }
  near(brief.valueAt('lvl', 4 + 6), 0.5);                            // brief: rise starts at 4 and lasts 12
});

test('lanes: a derived cut stretches a lane exactly like it stretches absolute keyframes (baseTime)', () => {
  const half = tl('half', LANES), long = tl('long', LANES);
  for (const id of ['intro', 'rise', 'peak', 'coda']) {
    for (const p of [0, 0.3, 0.5, 0.9]) {
      near(half.valueAt('lvl', half.score.timeAt(id, p)), long.valueAt('lvl', long.score.timeAt(id, p)), 1e-9);
    }
  }
  near(half.valueAt('lvl', 20), 0.5, 1e-9);                          // half: rise is 5 … 35, p=0.5 at 20
});

test('lanes: a segment id that another cut has but this one lacks is skipped; an id no cut has throws (a typo)', () => {
  assert.doesNotThrow(() => tl('brief', LANES), 'brief has no coda, long does');
  assert.throws(() => tl('long', { lvl: { riise: [[0, 0]] } }), /lvl.*riise|riise.*lvl/);
});

test('lanes: a number is the whole segment held flat (one value per segment)', () => {
  const t = tl('long', { lvl: { intro: 0.1, rise: 0.4, peak: 0.9, coda: 0.9 } });
  near(t.valueAt('lvl', 0), 0.1); near(t.valueAt('lvl', 9.999), 0.1);
  near(t.valueAt('lvl', 30), 0.4); near(t.valueAt('lvl', 90), 0.9);
});

test('lanes: a jump is two points at the same instant — the last segment\'s p=1 and the next one\'s p=0', () => {
  const t = tl('long', { lvl: { intro: [[0, 0], [1, 0.3]], rise: [[0, 0.7], [1, 0.7]], peak: [[0, 0.7]], coda: [[0, 0.7]] } });
  near(t.valueAt('lvl', 10 - 1e-6), 0.3, 1e-4);
  near(t.valueAt('lvl', 10), 0.7);
});

test('lanes: a step param holds across a lane exactly as it holds across absolute keyframes', () => {
  const t = tl('long', { mode: { intro: [[0, 0]], rise: [[0, 0], [1, 2]], peak: [[0, 2]], coda: [[0, 2]] } });
  assert.equal(t.valueAt('mode', 40), 0);
  assert.equal(t.valueAt('mode', 90), 2);
});

test('lanes: absolute keyframes are untouched — the same array object, the same values, mixed freely with lanes', () => {
  const abs = { lvl: [[0, 0], [10, 1]] };
  const plain = new Timeline({ params: P, total: 10, automation: abs });
  assert.equal(plain.automation, abs, 'no lane in it: the very object you passed');
  near(plain.valueAt('lvl', 5), 0.5);
  const mixed = tl('long', { lvl: LANES.lvl, mode: [[0, 0], [60, 3]] });
  assert.ok(Array.isArray(mixed.automation.mode));
  near(mixed.valueAt('lvl', 25), 0.2 + 0.6 * CURVES.ease(0.25), 1e-9);      // 同一個 automation 裡，lvl 是 lane、mode 是絕對秒
  assert.equal(mixed.valueAt('mode', 30), 0, 'mode is a step param: it holds the old value');
  assert.equal(mixed.valueAt('mode', 60), 3);
  assert.equal(LANES.lvl.rise.length, 2, 'the lane object you passed is not modified');
});

test('lanes: without a score the scenes are the segments (a scene lasts until the next one starts)', () => {
  const t = new Timeline({ params: P, total: 30, scenes: [{ id: 'a', t: 0 }, { id: 'b', t: 10 }, { id: 'c', t: 20 }], automation: { lvl: { b: [[0, 0], [1, 1]] } } });
  near(t.valueAt('lvl', 15), 0.5); near(t.valueAt('lvl', 5), 0); near(t.valueAt('lvl', 25), 1);
  assert.throws(() => new Timeline({ params: P, total: 30, automation: { lvl: { b: [[0, 0]] } } }), /segment|scene/i, 'no scenes and no score: nothing for an id to mean');
});

test('lanes: a bad point says which key, segment and index', () => {
  const bad = (pts, re) => assert.throws(() => tl('long', { lvl: { rise: pts } }), re);
  bad([[0, 0], [1.5, 1]], /lvl.*rise.*\[1\].*p/);
  bad([[-0.1, 0]], /lvl.*rise.*\[0\].*p/);
  bad([[0, 'x']], /lvl.*rise.*\[0\].*value/);
  bad([[0.6, 0], [0.4, 1]], /lvl.*rise.*\[1\].*ascend/);
  bad([], /lvl.*rise.*point/);
  bad('nope', /lvl.*rise/);
});

test('lanes: recording writes into the compiled keyframes (a take merges as before)', () => {
  const t = tl('long', LANES);
  t.record('lvl', () => 0.9);
  t.seek(40); t.play(); for (let i = 0; i < 10; i++) t.advance(0.5);
  t.stopRecording();
  assert.ok(Array.isArray(t.automation.lvl));
  near(t.valueAt('lvl', 42), 0.9, 1e-6);
});

test('lanes: a score-like object without rootSegments still works — the scenes are read back into automation seconds with baseTime', () => {
  const double = {
    total: 30, startT: 0, baseTime: (T) => T / 0.5,
    scenes: () => [{ id: 'a', t: 0 }, { id: 'b', t: 10 }],
  };
  const t = new Timeline({ params: P, score: double, automation: { lvl: { b: [[0, 0], [1, 1]] } } });
  near(t.valueAt('lvl', 20), 0.5);                                    // show 20 s → automation 40 s: half way through b (20 … 60)
  assert.deepEqual(t.lanePlan().map((s) => [s.id, s.start, s.end]), [['a', 0, 20], ['b', 20, 60]]);
});

test('lanes + the rest of the stack: a segment module rewrites the lane\'s value, and a performer\'s override still wins (the order is unchanged)', () => {
  const params = new Params([...P]);
  const sc = score('long');
  const t = new Timeline({ params, score: sc, automation: LANES });
  const dir = new Director({ score: sc, modules: [{ id: 'rise', param: (key, v, ctx) => (key === 'lvl' ? v * 0.5 + ctx.p * 0.1 : v) }] });
  t.layer = (key, v, T) => dir.param(key, v, T);
  t.onSeek((T, kind) => (kind === 'reset' ? dir.reset() : dir.seek(T)));
  t.seek(40);                                                          // rise p = 0.5：lane 值 0.5
  dir.update(t.t, 0, { playing: false });
  near(t.state().lvl, 0.5 * 0.5 + 0.5 * 0.1, 1e-9);                   // 模組在 lane 的值上改
  near(t.valueAt('lvl', 5), 0.2);                                      // 未經模組的 lane 值（intro 的值）
  params.override('lvl', 0.9);
  near(params.resolve(t.state()).lvl, 0.9);                            // 旋鈕在最後蓋過
});
