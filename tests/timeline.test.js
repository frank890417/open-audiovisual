import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Timeline } from '../packages/timeline/index.js';
import { Params } from '../packages/core/src/params.js';

const schema = [
  { key: 'a', min: 0, max: 10, def: 5 },
  { key: 'mode', min: 0, max: 3, def: 0, step: 1 },
];
const tl = new Timeline({
  params: schema,
  total: 100,
  automation: { a: [[0, 0], [10, 10]], mode: [[0, 0], [50, 2]] },
  scenes: [{ id: 's0', t: -5 }, { id: 's1', t: 20 }, { id: 's2', t: 60 }],
});

test('linear interpolation', () => {
  assert.equal(tl.valueAt('a', 5), 5);
  assert.equal(tl.valueAt('a', 10), 10);
  assert.equal(tl.valueAt('a', 99), 10);       // hold last keyframe
});

test('step params hold', () => {
  assert.equal(tl.valueAt('mode', 25), 0);     // no interpolation
  assert.equal(tl.valueAt('mode', 50), 2);
});

test('unautomated param falls back to def', () => {
  const t2 = new Timeline({ params: schema, total: 10, automation: {} });
  assert.equal(t2.valueAt('a', 3), 5);
});

test('scene index + negative standby time', () => {
  tl.seek(-5);
  assert.equal(tl.sceneIndexAt(), 0);
  tl.seek(25);
  assert.equal(tl.sceneIndexAt(), 1);
  assert.equal(tl.sceneEnd(1), 60);
});

test('scene change fires once per crossing', () => {
  const t2 = new Timeline({ params: schema, total: 100, automation: {}, scenes: [{ id: 'x', t: 0 }, { id: 'y', t: 10 }] });
  const fired = [];
  t2.onSceneChange((i, sc) => fired.push(sc.id));
  t2.play();
  for (let i = 0; i < 30; i++) t2.advance(0.5);
  assert.deepEqual(fired, ['x', 'y']);
});

test('advance stops at total', () => {
  const t2 = new Timeline({ params: schema, total: 1, automation: {} });
  t2.play();
  t2.advance(2);
  assert.equal(t2.t, 1);
  assert.equal(t2.playing, false);
});

test('Params.resolve merges overrides over base', () => {
  const p = new Params([...schema]);
  const base = { a: 3, mode: 1 };
  assert.deepEqual(p.resolve(base), { a: 3, mode: 1 });
  p.override('a', 999);                        // clamped to max
  assert.equal(p.resolve(base).a, 10);
  p.clearOverride('a');
  assert.equal(p.resolve(base).a, 3);
});
