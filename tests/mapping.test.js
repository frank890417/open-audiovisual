import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Signals } from '../packages/core/src/signals.js';
import { Params } from '../packages/core/src/params.js';
import { Mapper } from '../packages/mapping/index.js';

// Node has no localStorage/performance quirks that matter here; Mapper only
// touches localStorage in save()/load() which we don't call.
globalThis.performance ??= { now: () => Date.now() };

function rig() {
  const signals = new Signals();
  const params = new Params([
    { key: 'bloom', min: 0, max: 100, def: 10 },
    { key: 'trigger', pulse: true },
  ]);
  const mapper = new Mapper({ signals, params });
  return { signals, params, mapper };
}

test('route: signal drives param across ranges', () => {
  const { signals, params, mapper } = rig();
  mapper.addRoute({ source: 'midi/cc/74', target: 'bloom' });
  signals.set('midi/cc/74', 0.5);
  assert.equal(params.resolve({}).bloom, 50);
});

test('invert + exp curve', () => {
  const { signals, params, mapper } = rig();
  mapper.addRoute({ source: 'x', target: 'bloom', invert: true, curve: 'exp' });
  signals.set('x', 0);                          // invert → 1 → exp → 1 → 100
  assert.equal(params.resolve({}).bloom, 100);
  signals.set('x', 1);
  assert.equal(params.resolve({}).bloom, 0);
});

test('many-to-many: one signal, two params; two signals, one param', () => {
  const { signals, params, mapper } = rig();
  params.add([{ key: 'other', min: 0, max: 1, def: 0 }]);
  mapper.addRoute({ source: 's1', target: 'bloom' });
  mapper.addRoute({ source: 's1', target: 'other' });
  mapper.addRoute({ source: 's2', target: 'bloom' });
  signals.set('s1', 1);
  assert.equal(params.resolve({}).bloom, 100);
  assert.equal(params.resolve({}).other, 1);
  signals.set('s2', 0.25);                      // later signal wins the shared target
  assert.equal(params.resolve({}).bloom, 25);
  assert.equal(mapper.routesFor('bloom').length, 2);
});

test('pulse target fires on rising edge of continuous signal', () => {
  const { signals, params, mapper } = rig();
  let fired = 0;
  params.onPulse('trigger', () => fired++);
  mapper.addRoute({ source: 'pad', target: 'trigger' });
  signals.set('pad', 0.2); signals.set('pad', 0.9); signals.set('pad', 0.95); signals.set('pad', 0.1); signals.set('pad', 0.8);
  assert.equal(fired, 2);
});

test('learn binds the first MOVING signal, then exits learn mode', () => {
  const { signals, params, mapper } = rig();
  signals.define('knob/a'); signals.set('knob/a', 0.5);
  mapper.learn('bloom');
  signals.set('knob/a', 0.51);                  // 1% — noise, shouldn't bind
  assert.equal(mapper.routesFor('bloom').length, 0);
  signals.set('knob/a', 0.8);                   // 30% — bind
  assert.equal(mapper.routesFor('bloom').length, 1);
  assert.equal(mapper.learnTarget, null);
  assert.equal(mapper.routesFor('bloom')[0].source, 'knob/a');
});

test('smooth route approaches target via update(dt)', () => {
  const { signals, params, mapper } = rig();
  mapper.addRoute({ source: 'x', target: 'bloom', smooth: 0.5 });
  signals.set('x', 1);
  mapper.update(0.5);                           // one time constant → ~63%
  const v1 = params.resolve({}).bloom;
  assert.ok(v1 > 55 && v1 < 70, `expected ~63, got ${v1}`);
  for (let i = 0; i < 20; i++) mapper.update(0.5);
  assert.ok(params.resolve({}).bloom > 99);
});

test('toJSON/fromJSON round-trips routes', () => {
  const { mapper, signals, params } = rig();
  mapper.addRoute({ source: 'a', target: 'bloom', curve: 'log', smooth: 0.2 });
  const json = mapper.toJSON();
  const rig2 = rig();
  rig2.mapper.fromJSON(json);
  assert.equal(rig2.mapper.routes.length, 1);
  rig2.signals.set('a', 1);
  for (let i = 0; i < 60; i++) rig2.mapper.update(0.5);   // smooth route needs update() frames
  assert.ok(rig2.params.resolve({}).bloom > 99);
});

// ───────────── "map the knobs in order" ─────────────
import { LearnWizard } from '../packages/mapping/index.js';

function wizRig(keys = ['a', 'b', 'c']) {
  const signals = new Signals();
  for (const n of ['knob/1', 'knob/2', 'knob/3']) signals.define(n, { min: 0, max: 1 });
  const params = new Params(keys.map((k) => ({ key: k, min: 0, max: 1, def: 0 })));
  const mapper = new Mapper({ signals, params });
  const seen = [];
  const wiz = new LearnWizard({ mapper, keys, onChange: (w) => seen.push([w.active, w.current, w.index]) });
  const turn = (name) => { signals.set(name, 0.0); signals.set(name, 0.9); };     // a knob that moves a lot
  return { signals, params, mapper, wiz, seen, turn };
}

test('wizard: arms the first param; each turned knob binds the current param and arms the next', () => {
  const { mapper, wiz, turn } = wizRig();
  assert.equal(wiz.start(), true);
  assert.equal(wiz.current, 'a');
  assert.equal(mapper.learnTarget, 'a');
  turn('knob/1');
  assert.deepEqual(mapper.routes.map((r) => [r.source, r.target]), [['knob/1', 'a']]);
  assert.equal(wiz.current, 'b');
  assert.equal(mapper.learnTarget, 'b');
  turn('knob/2');
  assert.equal(wiz.current, 'c');
  turn('knob/3');
  assert.equal(wiz.active, false);
  assert.equal(wiz.done, true);
  assert.equal(mapper.learnTarget, null, 'learn is disarmed at the end');
  assert.deepEqual(wiz.added.map((x) => x.key), ['a', 'b', 'c']);
  assert.deepEqual(mapper.routes.map((r) => r.target), ['a', 'b', 'c']);
});

test('wizard: learn ADDS — a param that already has a route keeps it and gets a second one', () => {
  const { mapper, wiz, turn } = wizRig(['a']);
  mapper.addRoute({ source: 'knob/1', target: 'a' });
  wiz.start();
  turn('knob/2');
  assert.deepEqual(mapper.routesFor('a').map((r) => r.source), ['knob/1', 'knob/2']);
});

test('wizard: skip leaves a param unbound; back returns to the previous one; stop ends and disarms', () => {
  const { mapper, wiz, turn } = wizRig();
  wiz.start();
  wiz.skip();
  assert.equal(wiz.current, 'b');
  wiz.back();
  assert.equal(wiz.current, 'a');
  assert.equal(mapper.learnTarget, 'a');
  wiz.skip(); turn('knob/1');                      // b gets knob 1
  assert.deepEqual(mapper.routes.map((r) => r.target), ['b']);
  wiz.stop();
  assert.equal(wiz.active, false);
  assert.equal(wiz.done, false);
  assert.equal(mapper.learnTarget, null);
  wiz.back(); wiz.skip();                          // harmless once stopped
  assert.equal(mapper.learnTarget, null);
});

test('wizard: skipping past the last param finishes it; an empty list never starts', () => {
  const { wiz, mapper } = wizRig(['a']);
  wiz.start(); wiz.skip();
  assert.equal(wiz.done, true);
  assert.equal(mapper.routes.length, 0);
  assert.equal(new LearnWizard({ mapper, keys: [] }).start(), false);
});

test('wizard: it hands the mapper\'s own onLearn back when it ends, and still calls it while running', () => {
  const { mapper, wiz, turn } = wizRig(['a', 'b']);
  const calls = []; const mine = (r, s) => calls.push(s);
  mapper.onLearn = mine;
  wiz.start();
  turn('knob/1');
  assert.deepEqual(calls, ['knob/1']);
  wiz.stop();
  assert.equal(mapper.onLearn, mine);
});

test('wizard: sync() re-arms when someone else switched learn off or elsewhere', () => {
  const { mapper, wiz } = wizRig();
  wiz.start();
  mapper.learn('a');                                // the chip clicked: toggles learn OFF
  assert.equal(mapper.learnTarget, null);
  wiz.sync();
  assert.equal(mapper.learnTarget, 'a');
  mapper.learn('c');                                // a chip for another param
  wiz.sync();
  assert.equal(mapper.learnTarget, 'a');
});

test('wizard: keys can be a function, read when it starts', () => {
  const signals = new Signals(), params = new Params([{ key: 'x', min: 0, max: 1, def: 0 }, { key: 'y', min: 0, max: 1, def: 0, hidden: true }]);
  const mapper = new Mapper({ signals, params });
  const wiz = new LearnWizard({ mapper, keys: () => params.schema.filter((p) => !p.hidden).map((p) => p.key) });
  wiz.start();
  assert.deepEqual(wiz.order, ['x']);
});
