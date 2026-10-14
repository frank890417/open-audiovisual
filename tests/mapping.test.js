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

// ───────────── map files: export / import / ?map= / remember ─────────────

import { serializeMap, parseMap, parseMapUrl, loadMapUrl, MAP_FORMAT, MAP_VERSION } from '../packages/mapping/index.js';

function rigFile(profile = 'particles') {
  const signals = new Signals();
  const params = new Params([
    { key: 'bloom', min: 0, max: 100, def: 10 },
    { key: 'hue', min: 0, max: 360, def: 0 },
    { key: 'burst', pulse: true },
  ]);
  signals.define('audio/rms', {});
  signals.define('pose/hand/x', {});
  const mapper = new Mapper({ signals, params, profile });
  return { signals, params, mapper };
}
const strip = (routes) => routes.map(({ id, ...r }) => r);

test('map file: export → import round-trips the routes exactly', () => {
  const a = rigFile();
  a.mapper.addRoute({ source: 'midi/cc/74', target: 'bloom', curve: 'exp', smooth: 0.25, inMin: 0.1, inMax: 0.9, outMin: 5, outMax: 80 });
  a.mapper.addRoute({ source: 'audio/rms', target: 'hue', invert: true, curve: 'smooth' });
  a.mapper.addRoute({ source: 'pose/hand/x', target: 'hue', enabled: false });
  const file = JSON.parse(JSON.stringify(a.mapper.exportMap({ now: new Date('2026-10-15T00:00:00Z') })));
  assert.equal(file.format, MAP_FORMAT);
  assert.equal(file.version, MAP_VERSION);
  assert.equal(file.world, 'particles');
  assert.deepEqual(file.routes[0], { signal: 'midi/cc/74', param: 'bloom', curve: 'exp', range: { in: [0.1, 0.9], out: [5, 80] }, smooth: 0.25, invert: false });
  assert.equal(file.routes[2].enabled, false);

  const b = rigFile();
  const rep = b.mapper.importMap(JSON.stringify(file));
  assert.equal(rep.ok, true);
  assert.equal(rep.added, 3);
  assert.deepEqual(rep.skipped, []);
  assert.deepEqual(strip(b.mapper.toJSON()), strip(a.mapper.toJSON()));
});

test('map file: the imported routes actually drive the params', () => {
  const a = rigFile();
  a.mapper.addRoute({ source: 'audio/rms', target: 'bloom', outMin: 0, outMax: 100 });
  const b = rigFile();
  b.mapper.importMap(a.mapper.exportMap());
  b.signals.set('audio/rms', 0.5);
  assert.equal(b.params.resolve({}).bloom, 50);
});

test('map file: replace swaps the routes, add keeps them', () => {
  const { mapper } = rigFile();
  mapper.addRoute({ source: 'audio/rms', target: 'hue' });
  const file = serializeMap([{ source: 'pose/hand/x', target: 'bloom' }], { world: 'particles' });
  mapper.importMap(file, { mode: 'add' });
  assert.equal(mapper.routes.length, 2);
  mapper.importMap(file);
  assert.deepEqual(mapper.routes.map((r) => r.source), ['pose/hand/x']);
});

test('map file: version newer than ours is refused and changes nothing', () => {
  const { mapper } = rigFile();
  mapper.addRoute({ source: 'audio/rms', target: 'hue' });
  const rep = mapper.importMap({ format: MAP_FORMAT, version: MAP_VERSION + 1, world: 'x', routes: [{ signal: 'audio/rms', param: 'bloom' }] });
  assert.equal(rep.ok, false);
  assert.match(rep.error, /version 2/);
  assert.equal(mapper.routes.length, 1);
  assert.equal(mapper.report, rep);
});

test('map file: bad files fail with a reason, never throw', () => {
  const { mapper } = rigFile();
  for (const bad of ['', '{nope', '42', 'null', '{"format":"other","version":1,"routes":[]}', `{"format":"${MAP_FORMAT}","routes":[]}`,
    `{"format":"${MAP_FORMAT}","version":1}`, `{"format":"${MAP_FORMAT}","version":0,"routes":[]}`]) {
    const rep = mapper.importMap(bad);
    assert.equal(rep.ok, false, bad);
    assert.ok(rep.error.length > 5);
  }
  assert.equal(parseMap('x'.repeat(300 * 1024)).ok, false);
});

test('map file: routes with an unknown param or signal are skipped and listed', () => {
  const { mapper } = rigFile();
  const rep = mapper.importMap({ format: MAP_FORMAT, version: 1, world: 'other', routes: [
    { signal: 'audio/rms', param: 'bloom' },            // fine
    { signal: 'audio/rms', param: 'no-such-param' },    // param missing here
    { signal: 'leap/palm/x', param: 'hue' },            // signal nothing here can make
    { signal: 'midi/cc/74', param: 'hue' },             // born on first message: kept, "waiting"
  ] });
  assert.equal(rep.ok, true);
  assert.equal(rep.added, 2);
  assert.deepEqual(rep.skipped, [{ signal: 'audio/rms', param: 'no-such-param', reason: 'param' }, { signal: 'leap/palm/x', param: 'hue', reason: 'signal' }]);
  assert.deepEqual(rep.waiting, [{ signal: 'midi/cc/74', param: 'hue' }]);
  assert.equal(mapper.routes.length, 2);
});

test('map file: another world keeps the shape of a route but not its output range', () => {
  const { mapper, params } = rigFile('particles');
  const file = { format: MAP_FORMAT, version: 1, world: 'cylinder', routes: [{ signal: 'audio/rms', param: 'bloom', range: { in: [0, 1], out: [3, 4] } }] };
  const rep = mapper.importMap(file);
  assert.equal(rep.crossWorld, true);
  assert.equal(mapper.routes[0].outMax, params.get('bloom').max);      // this world's own range
  mapper.importMap({ ...file, world: 'particles' });
  assert.equal(mapper.routes[0].outMax, 4);                            // same world: the file's range
});

test('map file: hostile or sloppy values are cleaned', () => {
  const p = parseMap({ format: MAP_FORMAT, version: 1, routes: [
    { signal: 'a', param: 'b', curve: 'constructor', smooth: -5, range: { in: ['x', 1], out: [0, NaN] }, invert: 'yes', evil: 1, __proto__: { x: 1 } },
    { signal: 7, param: 'b' }, null, 'str', { signal: 'a' },
  ] });
  assert.equal(p.ok, true);
  assert.equal(p.routes.length, 1);
  assert.equal(p.dropped, 4);
  assert.deepEqual(p.routes[0], { signal: 'a', param: 'b', curve: 'linear', inMin: 0, inMax: 1, smooth: 0, invert: false, enabled: true });
});

test('map file: a bare toJSON() array (version 0) is still readable', () => {
  const a = rigFile();
  a.mapper.addRoute({ source: 'audio/rms', target: 'bloom', curve: 'log', smooth: 0.5 });
  const p = parseMap(JSON.stringify(a.mapper.toJSON()));
  assert.equal(p.ok, true);
  assert.equal(p.version, 0);
  const b = rigFile();
  assert.equal(b.mapper.importMap(p).added, 1);
  assert.equal(b.mapper.routes[0].curve, 'log');
});

test('?map= address: same origin or https only', () => {
  const base = 'https://openaudiovisual.com/examples/01-hello-particles/?map=x';
  assert.deepEqual(parseMapUrl('maps/a.json', base), { ok: true, url: 'https://openaudiovisual.com/examples/01-hello-particles/maps/a.json' });
  assert.equal(parseMapUrl('https://gist.githubusercontent.com/u/a.json', base).ok, true);
  assert.equal(parseMapUrl('http://localhost:8475/m.json', 'http://localhost:8475/').ok, true);   // same origin, even plain http
  for (const bad of ['http://evil.example/m.json', 'javascript:alert(1)', 'data:application/json,[]', 'file:///etc/passwd', 'blob:https://x/1',
    'ftp://x/m.json', 'https://user:pw@x.example/m.json', '', '   ', 'http://localhost:9999/m.json']) {
    assert.equal(parseMapUrl(bad, base).ok, false, bad);
  }
  assert.equal(parseMapUrl('http://localhost:9999/m.json', 'http://localhost:8475/').ok, false);     // other port = other origin
});

test('?map=: loadMapUrl imports on success and reports (not throws) on every failure', async () => {
  const file = serializeMap([{ source: 'audio/rms', target: 'bloom' }], { world: 'particles' });
  const ok = (body, status = 200) => async () => ({ ok: status < 400, status, text: async () => body });
  const base = 'https://openaudiovisual.com/x/';
  let m = rigFile().mapper;
  let rep = await loadMapUrl(m, 'm.json', { base, fetchImpl: ok(JSON.stringify(file)) });
  assert.equal(rep.ok, true); assert.equal(rep.source, 'url'); assert.equal(m.routes.length, 1);

  m.addRoute({ source: 'pose/hand/x', target: 'hue' });
  let called = 0;
  rep = await loadMapUrl(m, 'http://evil.example/m.json', { base, fetchImpl: async () => { called++; return ok('[]')(); } });
  assert.equal(rep.ok, false); assert.match(rep.error, /https/); assert.equal(called, 0);
  rep = await loadMapUrl(m, 'm.json', { base, fetchImpl: ok('', 404) });
  assert.match(rep.error, /404/);
  rep = await loadMapUrl(m, 'm.json', { base, fetchImpl: ok('<html>') });
  assert.match(rep.error, /JSON/);
  rep = await loadMapUrl(m, 'm.json', { base, fetchImpl: async () => { throw new TypeError('Failed to fetch'); } });
  assert.equal(rep.ok, false);
  assert.equal(m.routes.length, 2, 'failures leave the routes alone');
  assert.equal(m.report, rep);
});

test('remember: save/load per world name, and storage that throws does not break anything', () => {
  const store = new Map();
  globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: (k) => store.delete(k) };
  try {
    const a = rigFile('world-a'); a.mapper.addRoute({ source: 'audio/rms', target: 'bloom' });
    a.mapper.save();
    const b = rigFile('world-b'); b.mapper.addRoute({ source: 'pose/hand/x', target: 'hue' }); b.mapper.save();
    const a2 = rigFile('world-a');
    assert.equal(a2.mapper.load(), true);
    assert.deepEqual(a2.mapper.routes.map((r) => r.source), ['audio/rms']);
    // an import is remembered at once
    const c = rigFile('world-c');
    c.mapper.importMap(a.mapper.exportMap());
    assert.equal(rigFile('world-c').mapper.load(), true);
    // clear empties the remembered copy too
    c.mapper.clear();
    const c2 = rigFile('world-c'); c2.mapper.load();
    assert.equal(c2.mapper.routes.length, 0);
    // private window: every access throws
    globalThis.localStorage = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
    const d = rigFile('world-d');
    assert.doesNotThrow(() => { d.mapper.addRoute({ source: 'audio/rms', target: 'hue' }); d.mapper.save(); });
    assert.equal(d.mapper.load(), false);
    assert.equal(d.mapper.importMap(a.mapper.exportMap()).ok, true);
  } finally { delete globalThis.localStorage; }
});
