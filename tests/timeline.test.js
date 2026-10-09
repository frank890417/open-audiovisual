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

// ───────────── after the score: new members, old behavior untouched ─────────────

test('compat: the original constructor, defaults and transport behave as before', () => {
  const t2 = new Timeline({ params: schema, automation: {}, scenes: [{ id: 'a', t: 0 }, { id: 'b', t: 10 }], total: 30 });
  assert.equal(t2.t, 0);
  assert.equal(t2.start, 0);
  assert.equal(t2.holding, false);
  assert.equal(t2.score, null);
  assert.equal(t2.layer, null);
  assert.equal(t2.toggle(), true);
  assert.equal(t2.toggle(), false);
  t2.seek(12);
  assert.equal(t2.sceneIndexAt(), 1);
  t2.jumpScene(-1);
  assert.equal(t2.t, 0);
  t2.seek(25); t2.reset();
  assert.equal(t2.t, 0, 'reset() still rewinds to 0 when no start is given');
  assert.equal(t2.playing, false);
  t2.seek(-50);
  assert.equal(t2.t, 0, 'no negative scene: the lower clamp is still 0');
});

test('compat: reset() goes to a negative standby scene only when start says so', () => {
  const scenes = [{ id: 'standby', t: -30 }, { id: 'show', t: 0 }];
  const old = new Timeline({ params: schema, automation: {}, scenes, total: 60 });
  old.seek(20); old.reset();
  assert.equal(old.t, 0, 'default unchanged: 0, not -30');
  const standby = new Timeline({ params: schema, automation: {}, scenes, total: 60, start: -30 });
  assert.equal(standby.t, -30, 'a new Timeline begins at start');
  standby.seek(20); standby.reset();
  assert.equal(standby.t, -30);
  assert.equal(standby.sceneIndexAt(), 0);
  standby.start = 0; standby.reset();
  assert.equal(standby.t, 0, 'start can be changed later');
  const first = new Timeline({ params: schema, automation: {}, scenes, total: 60, start: 'first' });
  assert.equal(first.t, -30, "start: 'first' means the first scene, whatever its time");
  first.seek(20); first.reset();
  assert.equal(first.currentScene().id, 'standby');
});

test('compat: onSceneChange still gets (index, scene); the new third argument says why', () => {
  const t2 = new Timeline({ params: schema, total: 100, automation: {}, scenes: [{ id: 'x', t: 0 }, { id: 'y', t: 10 }, { id: 'z', t: 20 }] });
  const seen = [];
  t2.onSceneChange((i, sc, info) => seen.push([i, sc.id, info.cause]));
  t2.play(); t2.advance(0.1);
  t2.seek(12); t2.jumpScene(1);
  assert.deepEqual(seen, [[0, 'x', 'play'], [1, 'y', 'seek'], [2, 'z', 'jump']]);
});

test('onSeek is called for seek, jump and reset, never while playing', () => {
  const t2 = new Timeline({ params: schema, total: 100, automation: {}, scenes: [{ id: 'x', t: 0 }, { id: 'y', t: 10 }] });
  const seen = [];
  t2.onSeek((t, kind) => seen.push([t, kind]));
  t2.play(); t2.advance(1);
  assert.deepEqual(seen, []);
  t2.seek(5); t2.jumpScene(1); t2.reset();
  assert.deepEqual(seen, [[5, 'seek'], [10, 'jump'], [0, 'reset']]);
});

test('layer(key, value, t) rewrites automation values; Params.resolve still lets an override win', () => {
  const p = new Params([...schema]);
  const t2 = new Timeline({ params: p, total: 10, automation: { a: [[0, 0], [10, 10]] } });
  t2.layer = (key, v, t) => (key === 'a' ? v + 100 : v);
  assert.equal(t2.state(5).a, 105);
  assert.equal(t2.state(5).mode, 0, 'other params untouched');
  p.override('a', 7);
  assert.equal(p.resolve(t2.state(5)).a, 7, 'the performer wins over the layer');
});

test('a scene with hold: true stops playback at its end; play / next / release let it go; the last scene never holds', () => {
  const mkTl = () => new Timeline({ params: schema, total: 30, automation: {}, scenes: [{ id: 'a', t: 0, hold: true }, { id: 'b', t: 10, hold: true }, { id: 'c', t: 20, hold: true }] });
  const tl2 = mkTl();
  tl2.play();
  for (let i = 0; i < 400; i++) tl2.advance(0.05);
  assert.equal(tl2.holding, true);
  assert.equal(tl2.playing, false);
  assert.equal(tl2.currentScene().id, 'a');
  assert.ok(tl2.t < 10 && tl2.t > 9.999);
  tl2.play();
  assert.equal(tl2.holding, false);
  assert.equal(tl2.currentScene().id, 'b');
  for (let i = 0; i < 400; i++) tl2.advance(0.05);
  assert.equal(tl2.holding, true, 'the second hold');
  assert.equal(tl2.currentScene().id, 'b');
  assert.equal(tl2.release(), true);
  assert.equal(tl2.release(), false, 'nothing to release the second time');
  for (let i = 0; i < 400; i++) tl2.advance(0.05);
  assert.equal(tl2.t, 30);
  assert.equal(tl2.holding, false, 'the last scene ends the show instead of holding');
  assert.equal(tl2.playing, false);
});

test('next() releases a hold and otherwise jumps a scene; prev() jumps back', () => {
  const tl2 = new Timeline({ params: schema, total: 30, automation: {}, scenes: [{ id: 'a', t: 0, hold: true }, { id: 'b', t: 10 }, { id: 'c', t: 20 }] });
  tl2.next();
  assert.equal(tl2.currentScene().id, 'b');
  assert.equal(tl2.playing, false, 'a plain jump does not start playback');
  tl2.prev();
  assert.equal(tl2.currentScene().id, 'a');
  tl2.seek(9.9); tl2.play(); tl2.advance(0.5);
  assert.equal(tl2.holding, true);
  tl2.next();
  assert.equal(tl2.currentScene().id, 'b');
  assert.equal(tl2.playing, true, 'releasing a hold plays on');
});

test('Timeline.reset() while holding clears the hold', () => {
  const tl2 = new Timeline({ params: schema, total: 30, automation: {}, scenes: [{ id: 'a', t: 0, hold: true }, { id: 'b', t: 10 }] });
  tl2.seek(9); tl2.play(); tl2.advance(2);
  assert.equal(tl2.holding, true);
  tl2.reset();
  assert.equal(tl2.holding, false);
  assert.equal(tl2.t, 0);
});
