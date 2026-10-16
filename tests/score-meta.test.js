// @openav/score · 段落欄位透傳（meta）與「段落 id＋段內進度 p ↔ 秒」的換算。
//
// 一個作品想給每段掛自己的資料（層、色盤、事件窗口…）：以前得另開一張表再用 id 對回來。
// 現在 Score 編譯時把 `meta` 與未知欄位原樣留在 segment.meta，scenes() 與導演的 ctx.segment 也看得到。
// 換算（locate / timeAt）讓模組與工具不用自己做 (T - start) / dur。
// 這份固定資料是虛構的一天，不指名任何作品。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Score, ScoreError, Director } from '../packages/score/index.js';
import { Timeline } from '../packages/timeline/index.js';

const PALETTE = ['#fa0', '#f50'];
const FULL = {
  id: 'full', title: 'Full',
  segments: [
    { id: 'dawn', title: 'Dawn', dur: 20, meta: { layer: 'sky', palette: PALETTE } },
    { id: 'noon', dur: 30, tint: 'white', window: [0.55, 0.8], meta: { layer: 'sun', tint: 'gold' } },   // 未知欄位 tint／window，meta 同名者勝
    { id: 'dusk', dur: 20, linger: 4 },
  ],
};
const mk = (cut = 'full', cuts = [FULL, { id: 'short', from: 'full', scale: 0.5 }]) => new Score({ cuts, cut });
const near = (a, b, e = 1e-9) => assert.ok(Math.abs(a - b) <= e, `${a} ≉ ${b}`);

// ───────────── G5 · meta ─────────────

test('meta: a segment keeps its `meta` object', () => {
  const s = mk();
  assert.deepEqual(s.segment('dawn').meta.layer, 'sky');
  assert.deepEqual(s.segment('dawn').meta.palette, PALETTE);
});

test('meta: unknown top-level fields are kept inside meta too; an explicit meta entry wins on a clash', () => {
  const noon = mk().segment('noon');
  assert.deepEqual(noon.meta, { tint: 'gold', window: [0.55, 0.8], layer: 'sun' });
});

test('meta: the fields the score owns are never copied into meta', () => {
  const m = mk().segment('noon').meta;
  for (const k of ['id', 'dur', 'title', 'note', 'linger', 'hold', 'acts', 'cues', 'module', 'start', 'end', 'index']) assert.ok(!(k in m), `${k} must not be in meta`);
});

test('meta: a segment without any is given an empty object, so seg.meta.x is always safe to read', () => {
  assert.deepEqual(mk().segment('dusk').meta, {});
});

test('meta: it survives a derived cut', () => {
  const half = mk('short');
  assert.equal(half.segment('dawn').meta.layer, 'sky');
  assert.equal(half.segment('noon').meta.tint, 'gold');
  near(half.segment('dawn').dur, 10);
});

test('meta: scenes() carries it, so a Timeline built from the score has it on every scene', () => {
  const sc = mk().scenes();
  assert.equal(sc[0].meta.layer, 'sky');
  assert.equal(sc[1].meta.window[1], 0.8);
  const tl = new Timeline({ params: [], score: mk() });
  assert.equal(tl.scenes[0].meta.palette, PALETTE);
});

test('meta: the director hands it to a module as ctx.segment.meta', () => {
  let seen = null;
  const d = new Director({ score: mk(), modules: [{ id: 'dawn', enter: (api, ctx) => { seen = ctx.segment.meta.layer; } }] });
  d.update(1, 0.1, { playing: true });
  assert.equal(seen, 'sky');
});

test('meta: the score keeps its own copy of the top level (changing the source object afterwards changes nothing)', () => {
  const src = { id: 'c', segments: [{ id: 'a', dur: 5, meta: { k: 1 } }] };
  const s = new Score({ cuts: [src] });
  src.segments[0].meta.k = 2; src.segments[0].meta.added = true;
  assert.equal(s.segment('a').meta.k, 1);
  assert.ok(!('added' in s.segment('a').meta));
});

test('meta: it must be a plain object, otherwise the ScoreError names the segment', () => {
  for (const bad of ['sky', 3, [1, 2], null, true]) {
    assert.throws(() => new Score({ cuts: [{ id: 'c', segments: [{ id: 'a', dur: 5, meta: bad }] }] }), (e) => e instanceof ScoreError && /segment "a".*meta must be an object/.test(e.message), JSON.stringify(bad));
  }
});

test('meta: table() keeps its columns (meta is not dumped into console.table)', () => {
  assert.deepEqual(Object.keys(mk().table()[0]), ['index', 'id', 'title', 'start', 'end', 'dur', 'linger', 'hold']);
});

// ───────────── 換算 ─────────────

test('rootSegments: the cut this one was derived from (itself when not derived), in the root cut\'s seconds', () => {
  const half = mk('short');
  assert.deepEqual(half.rootSegments.map((s) => [s.id, s.start, s.end, s.dur]), [['dawn', 0, 20, 20], ['noon', 20, 50, 30], ['dusk', 50, 70, 20]]);
  assert.deepEqual(half.segments.map((s) => s.end), [10, 25, 35], 'segments stay in this cut\'s own seconds');
  const full = mk();
  assert.deepEqual(full.rootSegments.map((s) => s.id), ['dawn', 'noon', 'dusk']);
  assert.equal(full.rootSegments, full.rootSegments, 'the same list every time (not rebuilt per call)');
});

test('allSegmentIds(): every id of every cut, so a tool can tell a typo from a segment this cut simply does not have', () => {
  const s = new Score({ cuts: [FULL, { id: 'brief', segments: [{ id: 'dawn', dur: 4 }, { id: 'finale', dur: 4 }] }], cut: 'full' });
  assert.deepEqual([...s.allSegmentIds()].sort(), ['dawn', 'dusk', 'finale', 'noon']);
  assert.ok(!s.segment('finale'), 'the active cut has no finale');
});

test('locate(T): which segment owns T and how far through it (p may leave 0..1 outside the show)', () => {
  const s = mk();
  assert.deepEqual(s.locate(5), { id: 'dawn', index: 0, p: 0.25, t: 5 });
  const at = s.locate(35);
  assert.equal(at.id, 'noon'); near(at.p, 0.5); near(at.t, 15);
  assert.equal(s.locate(20).id, 'noon', 'a boundary belongs to the segment that starts there');
  assert.equal(s.locate(20).p, 0);
  assert.equal(s.locate(-5).id, 'dawn'); near(s.locate(-5).p, -0.25);
  assert.equal(s.locate(500).id, 'dusk'); assert.ok(s.locate(500).p > 1);
});

test('timeAt(id, p): the inverse of locate, in this cut\'s seconds; NaN for an id it does not have', () => {
  const s = mk(), h = mk('short');
  near(s.timeAt('noon', 0.5), 35);
  near(s.timeAt('noon'), 20, 0);
  near(h.timeAt('noon', 0.5), 17.5, 1e-9);
  assert.ok(Number.isNaN(s.timeAt('nope', 0.5)));
  for (const T of [0, 3.3, 19.999, 20, 41.2, 69.5]) near(s.timeAt(s.locate(T).id, s.locate(T).p), T, 1e-9);
  for (const T of [0, 1.7, 10, 12.5, 34.9]) near(h.timeAt(h.locate(T).id, h.locate(T).p), T, 1e-9);
});
