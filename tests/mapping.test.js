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
