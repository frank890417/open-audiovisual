// @openav/dmx, the live half: the engine's submasters, tune() (a rate change goes on from where the wave is) and describe();
// the transports (sim records, the bridge transport sends only changed channels and arrives as Art-Net through a real
// bridge, Web Serial on a fake navigator.serial); dmxParams (with every param at its default the look is untouched, and each
// param changes the rendered bytes); the monitor's pure part, fixtureLook(), without a DOM.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import dgram from 'node:dgram';
import { Patch, DmxEngine, dmxTransport, dmxParams, mountDmxMonitor, decodeArtDmx, decodeEnttecDmx } from '../packages/dmx/index.js';
import { fixtureLook, cssColor } from '../packages/dmx/monitor.js';
import { hsv } from '../packages/dmx/params.js';
import { startBridge } from '../packages/out/bridge/out-bridge.mjs';
import { OutClient } from '../packages/out/client.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(pred, ms = 2000, what = 'condition') {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { const r = pred(); if (r) return r; await sleep(5); }
  throw new Error(`timed out after ${ms} ms waiting for ${what}`);
}
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

/** 4 RGBW pars (6ch) and a moving head (16ch), as example 28 has them, smaller. */
function rig() {
  const patch = new Patch();
  for (let i = 0; i < 4; i++) patch.add({ id: `par${i + 1}`, profile: 'generic-rgbw', mode: '6ch', address: 1 + i * 6, groups: ['pars', i % 2 ? 'even' : 'odd'] });
  patch.add({ id: 'head1', profile: 'generic-moving-head', mode: '16ch', address: 25, groups: ['heads'] });
  const engine = new DmxEngine(patch);
  engine.scene('on', { pars: { dimmer: 1, color: [1, 1, 1] }, heads: { dimmer: 1, tilt: 0.3 } }).base('on');
  return { patch, engine };
}
const par1 = (U) => Array.from(U.bytes(1).slice(0, 6));     // dimmer r g b w strobe

// ───────────── engine: submaster, tune, describe ─────────────

test('submaster: scales the dimmer after every layer (the effect under it keeps running), levels multiply, null removes', () => {
  const { engine } = rig();
  engine.effect('breathe', { target: 'pars', wave: 'sine', rate: 0.5, depth: 1 });
  const at = (t) => engine.state(t).fixtures.par1.dimmer;
  const free = [0.25, 0.5, 1.5].map(at);
  engine.submaster('pars', 0.5);
  assert.deepEqual([0.25, 0.5, 1.5].map(at).map((x) => +x.toFixed(9)), free.map((x) => +(x * 0.5).toFixed(9)), 'the same wave, half as bright');
  engine.submaster('odd', 0.5);
  assert.ok(near(engine.state(1).fixtures.par1.dimmer * 2, engine.state(1).fixtures.par2.dimmer), 'par1 is in both groups: 0.25, par2 only in pars: 0.5');
  assert.equal(engine.state(1).fixtures.head1.dimmer, 1, 'the head is in neither');
  engine.submaster('pars', null).submaster('odd', null);
  assert.deepEqual([0.25, 0.5, 1.5].map(at), free);
  assert.throws(() => engine.submaster('nobody', 1), /not a fixture or a group/);
  assert.throws(() => engine.submaster('pars', 'loud'), /level/);
});

test('tune: a new rate takes over from where the wave is (no jump), unlike defining the effect again', () => {
  const { engine } = rig();
  engine.effect('breathe', { target: 'pars', wave: 'sine', rate: 0.25, depth: 1 });
  const at = (t) => engine.state(t).fixtures.par1.dimmer;
  const t0 = 100.3, before = at(t0);
  engine.tune('breathe', { rate: 1 }, t0);
  assert.ok(near(at(t0), before, 1e-9), `same value at the moment of the change (${before} → ${at(t0)})`);
  // 0.1 s later the wave has moved 0.1 cycles at the new rate, not 0.025 and not a jump of 75 cycles
  const ref = new DmxEngine(engine.patch);
  ref.scene('on', { pars: { dimmer: 1, color: [1, 1, 1] } }).base('on');
  ref.effect('breathe', { target: 'pars', wave: 'sine', rate: 1, depth: 1, phase: engine.describe().effects.breathe.phase });
  assert.ok(near(at(t0 + 0.1), ref.state(t0 + 0.1).fixtures.par1.dimmer, 1e-9));
  // what redefining would have done: at t0 the wave lands somewhere else
  const naive = new DmxEngine(engine.patch);
  naive.scene('on', { pars: { dimmer: 1, color: [1, 1, 1] } }).base('on');
  naive.effect('breathe', { target: 'pars', wave: 'sine', rate: 1, depth: 1 });
  assert.ok(Math.abs(naive.state(t0).fixtures.par1.dimmer - before) > 0.1, 'a plain redefinition jumps');
  engine.tune('breathe', { depth: 0.25 });
  assert.equal(engine.describe().effects.breathe.depth, 0.25);
  assert.throws(() => engine.tune('breathe', { rate: 2 }), /at is the time/);
  assert.throws(() => engine.tune('nope', { depth: 1 }), /no effect/);
});

test('tune: continuity holds under the flash cap and in beats (a rate above the cap is changed as the cap plays it)', () => {
  const { engine } = rig();
  engine.effect('fast', { target: 'pars', wave: 'sine', rate: 10, depth: 1 });            // capped to 3 Hz
  engine.effect('beat', { target: 'heads', property: 'pan', wave: 'sine', rate: 1, unit: 'beat', depth: 1 });
  const d = (t) => engine.state(t).fixtures.par1.dimmer, p = (t) => engine.state(t).fixtures.head1.pan;
  const t0 = 37.77, a = d(t0), b = p(t0);
  engine.tune('fast', { rate: 2 }, t0).tune('beat', { rate: 0.5 }, t0);
  assert.ok(near(d(t0), a, 1e-9) && near(p(t0), b, 1e-9));
  assert.deepEqual(engine.state(t0 + 0.01).capped, [], 'at 2 Hz the cap has nothing to slow');
});

test('describe: names, base, chases and effects with their settings and whether they run, submasters; copies only', () => {
  const { engine } = rig();
  engine.scene('odd', { odd: { dimmer: 1 }, even: { dimmer: 0 } }).scene('even', { odd: { dimmer: 0 }, even: { dimmer: 1 } });
  engine.chase('walk', { steps: ['odd', 'even'], every: 1 }).run('walk', false);
  engine.effect('sweep', { target: 'heads', property: 'pan', rate: 0.1, depth: 0.6 });
  engine.cue('A', { scene: 'odd', fadeIn: 1, curve: 'smooth' }).submaster('heads', 0.4);
  const d = engine.describe();
  assert.deepEqual(d.scenes, ['on', 'odd', 'even']); assert.deepEqual(d.cues, ['A']); assert.deepEqual(d.base, ['on']);
  assert.deepEqual(d.chases.walk, { steps: ['odd', 'even'], every: 1, unit: 'beat', fade: 0, start: 0, curve: 'linear', running: false });
  assert.equal(d.effects.sweep.rate, 0.1); assert.equal(d.effects.sweep.running, true); assert.equal(d.effects.sweep.property, 'pan');
  assert.deepEqual(d.submasters, [{ target: 'heads', level: 0.4 }]);
  assert.deepEqual([d.master, d.blackout, d.maxFlashHz, d.bpm], [1, false, 3, 120]);
  d.chases.walk.steps.push('x'); d.base.push('y'); d.effects.sweep.rate = 9;
  assert.deepEqual(engine.describe().chases.walk.steps, ['odd', 'even']); assert.equal(engine.describe().effects.sweep.rate, 0.1);
});

// ───────────── transports ─────────────

test('sim transport: remembers what it delivered, sends only what changed, says which channels', () => {
  const { engine } = rig();
  const out = dmxTransport('sim');
  assert.equal(out.status, 'sim'); assert.equal(out.kind, 'sim');
  const n = out.send(engine.render(0));
  assert.ok(n > 0); assert.deepEqual(Array.from(out.bytes(1).slice(0, 6)), par1(engine.render(0)));
  assert.equal(out.send(engine.render(0)), 0, 'the same frame again: nothing');
  assert.deepEqual(out.changed, []);
  engine.master = 0.5;
  out.send(engine.render(0));
  assert.deepEqual(out.changed.filter((c) => c.address <= 6), [{ universe: 1, address: 1, value: 128 }], 'only par1\'s dimmer moved');
  assert.equal(out.send({ 2: new Uint8Array(512).fill(9) }), 512, 'plain { id: bytes } works too');
  assert.deepEqual(out.universes, [1, 2]);
  assert.throws(() => dmxTransport('usb'), /'sim', 'bridge' or 'serial'/);
});

test('bridge transport: one client.set(dmx/<u>/<address>, byte / 255) per changed channel, nothing for the rest; status follows the client', () => {
  const sets = [];
  let st = 'open';
  const subs = new Set();
  const client = { get status() { return st; }, set: (ch, v) => sets.push([ch, v]), onStatus: (f) => { subs.add(f); return () => subs.delete(f); } };
  const out = dmxTransport('bridge', { client });
  const U = { 1: new Uint8Array(512) };
  U[1][0] = 255; U[1][48] = 128;
  assert.equal(out.send(U), 2);
  assert.deepEqual(sets, [['dmx/1/1', 1], ['dmx/1/49', 128 / 255]]);
  assert.equal(Math.round(sets[1][1] * 255), 128, 'the bridge turns it back into the same byte');
  sets.length = 0;
  assert.equal(out.send(U), 0); assert.deepEqual(sets, []);
  U[1][48] = 0;
  out.send(U);
  assert.deepEqual(sets, [['dmx/1/49', 0]], 'going back to 0 is a change too');
  st = 'connecting'; for (const f of subs) f(st);
  assert.equal(out.status, 'connecting');
  out.close(); assert.equal(subs.size, 0);
  assert.throws(() => dmxTransport('bridge', {}), /OutClient/);
});

test('bridge transport end to end: engine → OutClient → out-bridge → Art-Net on loopback, the bytes the engine rendered', async () => {
  const sock = dgram.createSocket('udp4');
  const got = [];
  sock.on('message', (m) => { const d = decodeArtDmx(m); if (d) got.push(d); });
  await new Promise((r) => sock.bind(0, '127.0.0.1', r));
  const bridge = await startBridge({ port: 0, config: { channels: [{ match: 'dmx/*', sink: 'artnet', host: '127.0.0.1', port: sock.address().port }], safe: { 'dmx/*': 0 }, timeoutMs: 5000 } });
  const client = new OutClient({ url: `ws://127.0.0.1:${bridge.port}/out`, id: 'dmx-test', schedule: (fn) => setTimeout(fn, 5) }).connect();
  try {
    const { engine } = rig();
    engine.set('head1', { pan: 0.25, color: [0, 0, 1] });
    const out = dmxTransport('bridge', { client });
    await until(() => out.status === 'open', 1000, 'open');
    const want = engine.render(2).bytes(1);
    out.send(engine.render(2));
    const p = await until(() => got.find((x) => x.universe === 1 && x.data.every((b, i) => b === want[i])), 1500, 'the rendered universe');
    assert.equal(p.data[24], 64, 'head1 pan coarse byte (0.25 of 16 bits)');
    client.close();
    await until(() => got.at(-1).data.every((b) => b === 0), 1000, 'dark once the page lets go');
  } finally { client.close(); await bridge.close(); await new Promise((r) => sock.close(r)); }
});

/** navigator.serial as a test needs it: requestPort() hands a port whose writer records every frame. */
function fakeSerial({ slow = 0 } = {}) {
  const S = { asked: 0, opened: null, frames: [], closed: false, released: false, listeners: {} };
  const port = {
    async open(o) { S.opened = o; },
    async close() { S.closed = true; },
    writable: { getWriter: () => ({ write: async (b) => { if (slow) await sleep(slow); S.frames.push(Uint8Array.from(b)); }, close: async () => {}, releaseLock: () => { S.released = true; } }) },
  };
  S.api = { requestPort: async () => { S.asked++; return port; }, addEventListener: (n, f) => { S.listeners[n] = f; } };
  S.port = port;
  return S;
}

test('serial transport: no Web Serial → "unsupported" and connect() says why; nothing is asked for until connect()', async () => {
  const none = dmxTransport('serial', { serial: null });
  assert.equal(none.status, 'unsupported'); assert.equal(none.supported, false);
  await assert.rejects(() => none.connect(), /Web Serial is not in this browser/);
  const S = fakeSerial();
  const out = dmxTransport('serial', { serial: S.api });
  assert.equal(out.status, 'idle');
  out.send({ 1: new Uint8Array(512).fill(1) });
  assert.equal(S.asked, 0, 'sending never asks for a port: only connect() does, from a click');
});

test('serial transport: Enttec frames of its universe, only when something changed, at most one every 25 ms, the newest wins', async () => {
  const S = fakeSerial();
  const out = dmxTransport('serial', { serial: S.api, universe: 2 });
  const U = (v) => ({ 1: new Uint8Array(512).fill(7), 2: Uint8Array.from({ length: 512 }, (_, i) => (i === 0 ? v : 0)) });
  out.send(U(10));
  await out.connect();
  assert.deepEqual([S.asked, S.opened.baudRate, out.status], [1, 57600, 'open']);
  await until(() => S.frames.length === 1, 500, 'the frame it had, at once');
  assert.equal(decodeEnttecDmx(S.frames[0]).data[0], 10, 'universe 2, not 1');
  await sleep(40);
  out.send(U(10));
  await sleep(40);
  assert.equal(S.frames.length, 1, 'nothing changed: no frame');
  out.send(U(20));                                      // a change: it leaves at once…
  out.send(U(30)); out.send(U(40)); out.send(U(50));    // …and three more inside its 25 ms cool-down wait for the next slot
  await until(() => S.frames.length === 3, 500, 'the change, then the newest of the ones that waited');
  await sleep(60);
  assert.equal(S.frames.length, 3, 'four changes went out as two frames');
  assert.deepEqual(S.frames.slice(1).map((f) => decodeEnttecDmx(f).data[0]), [20, 50], 'the first at once, then only the newest (30 and 40 never leave)');
  await until(() => S.frames.length === 4, 1600, 'keep-alive after a second');
  assert.equal(decodeEnttecDmx(S.frames[3]).data[0], 50);
  out.send(U(0));                                       // the last word: dark, then close at once
  await out.close();
  assert.equal(decodeEnttecDmx(S.frames.at(-1)).data[0], 0, 'close() lets the newest frame leave first');
  assert.ok(S.closed); assert.equal(out.status, 'closed');
});

// ───────────── dmxParams ─────────────

test('dmxParams: with every param at its default the look is untouched (scene, effect and chase still show in the bytes)', () => {
  const plain = rig(), driven = rig();
  for (const r of [plain, driven]) {
    r.engine.scene('odd', { odd: { dimmer: 1 }, even: { dimmer: 0.2 } }).scene('even', { odd: { dimmer: 0.2 }, even: { dimmer: 1 } });
    r.engine.chase('walk', { steps: ['odd', 'even'], every: 1, unit: 'second' });
    r.engine.effect('breathe', { target: 'pars', wave: 'sine', rate: 0.25, depth: 0.5 });
    r.engine.effect('sweep', { target: 'heads', property: 'pan', rate: 0.1, depth: 0.6 });
  }
  const p = dmxParams(driven.engine, { effects: ['breathe', 'sweep'], chases: ['walk'], groups: ['heads'] });
  const defaults = Object.fromEntries(p.params.map((x) => [x.key, x.def]));
  for (const t of [0, 0.4, 1.3, 7.9]) {
    p.apply(defaults, t);
    const a = plain.engine.render(t), b = driven.engine.render(t);
    assert.deepEqual(Array.from(b.bytes(1).slice(0, 24)), Array.from(a.bytes(1).slice(0, 24)), `pars at ${t} s`);
    assert.deepEqual([b.bytes(1)[24], b.bytes(1)[25]], [a.bytes(1)[24], a.bytes(1)[25]], `the head's pan at ${t} s`);
  }
  assert.ok(plain.engine.state(0.4).fixtures.par1.dimmer !== plain.engine.state(1.3).fixtures.par1.dimmer, 'and the look does move');
});

test('dmxParams: the params, their keys, ranges and defaults (what the engine says now)', () => {
  const { engine } = rig();
  engine.effect('breathe', { target: 'pars', rate: 0.25, depth: 0.5 });
  engine.chase('walk', { steps: ['on'] }).run('walk', false);
  const p = dmxParams(engine, { groups: { pars: { hue: 0.6, saturation: 1 }, heads: {} }, effects: { breathe: { max: 2 } }, chases: ['walk'] });
  const by = Object.fromEntries(p.params.map((x) => [x.key, x]));
  assert.deepEqual(Object.keys(by), ['dmx/master', 'dmx/blackout', 'dmx/pars/dimmer', 'dmx/pars/hue', 'dmx/pars/saturation', 'dmx/heads/dimmer', 'dmx/heads/hue', 'dmx/heads/saturation', 'dmx/breathe/rate', 'dmx/breathe/depth', 'dmx/walk/run']);
  assert.deepEqual([by['dmx/blackout'].step, by['dmx/walk/run'].step, by['dmx/walk/run'].def], [1, 1, 0]);
  assert.deepEqual([by['dmx/breathe/rate'].max, by['dmx/breathe/rate'].def, by['dmx/breathe/depth'].def], [2, 0.25, 0.5]);
  assert.deepEqual([by['dmx/pars/hue'].def, by['dmx/pars/saturation'].def], [0.6, 1]);
  assert.ok(p.params.every((x) => x.group === 'lights' && x.min === 0));
  assert.equal(p.keys.groups.pars.dimmer, 'dmx/pars/dimmer');
  assert.deepEqual(engine.describe().base, ['on', 'dmx:colour'], 'the colours sit on top of the base');
  assert.throws(() => dmxParams(engine, { effects: ['nope'] }), /no effect "nope"/);
  assert.throws(() => dmxParams(engine, { groups: ['nobody'] }), /not a fixture or a group/);
  assert.equal(dmxParams(engine, { prefix: 'lx' }).params[0].key, 'lx/master');
});

test('dmxParams: each param moves the bytes: master, blackout, a group dimmer over a running effect, hue, a rate without a jump, a chase', () => {
  const { engine } = rig();
  engine.scene('odd', { odd: { dimmer: 1 }, even: { dimmer: 0 } }).scene('even', { odd: { dimmer: 0 }, even: { dimmer: 1 } });
  engine.chase('walk', { steps: ['odd', 'even'], every: 1, unit: 'second' }).run('walk', false);
  engine.effect('breathe', { target: 'pars', wave: 'sine', rate: 0.25, depth: 0.5 });
  const p = dmxParams(engine, { groups: { pars: { hue: 0, saturation: 0 } }, effects: ['breathe'], chases: ['walk'] });
  const S = Object.fromEntries(p.params.map((x) => [x.key, x.def]));
  const t = 3.3;
  p.apply(S, t);
  const base = par1(engine.render(t));
  assert.deepEqual(base.slice(1, 5), [0, 0, 0, 255], 'saturation 0: white, from the white LED');
  p.apply({ ...S, 'dmx/master': 0.5 }, t);
  assert.ok(Math.abs(par1(engine.render(t))[0] - base[0] / 2) <= 1, 'master 0.5: half');
  p.apply({ ...S, 'dmx/blackout': 1 }, t);
  assert.equal(par1(engine.render(t))[0], 0, 'blackout');
  p.apply({ ...S, 'dmx/pars/dimmer': 0.5 }, t);
  const a = engine.state(t).fixtures.par1.dimmer, b = engine.state(t + 1).fixtures.par1.dimmer;
  assert.ok(a !== b, 'the breathe effect still runs under the group dimmer');
  p.apply({ ...S, 'dmx/pars/dimmer': 1 }, t);
  assert.ok(near(engine.state(t).fixtures.par1.dimmer, a * 2, 1e-9) && near(engine.state(t + 1).fixtures.par1.dimmer, b * 2, 1e-9), 'and it is scaled by it');
  p.apply({ ...S, 'dmx/pars/saturation': 1, 'dmx/pars/hue': 0 }, t);
  assert.deepEqual(par1(engine.render(t)).slice(1, 5), [255, 0, 0, 0], 'hue 0, full saturation: red');
  p.apply({ ...S, 'dmx/pars/saturation': 1, 'dmx/pars/hue': 2 / 3 }, t);
  assert.deepEqual(par1(engine.render(t)).slice(1, 5), [0, 0, 255, 0], 'hue 2/3: blue');
  const before = engine.state(t).fixtures.par1.dimmer;
  p.apply({ ...S, 'dmx/breathe/rate': 2 }, t);
  assert.ok(near(engine.state(t).fixtures.par1.dimmer, before, 1e-9), 'a new rate from a knob: no jump');
  assert.equal(engine.describe().effects.breathe.rate, 2);
  p.apply({ ...S, 'dmx/breathe/rate': 2, 'dmx/breathe/depth': 0 }, t);
  assert.equal(engine.state(t).fixtures.par1.dimmer, engine.state(t + 0.37).fixtures.par1.dimmer, 'depth 0: still');
  assert.equal(engine.state(0.5).fixtures.par2.dimmer, engine.state(0.5).fixtures.par1.dimmer);
  p.apply({ ...S, 'dmx/walk/run': 1, 'dmx/breathe/depth': 0 }, t);
  assert.deepEqual([engine.state(0.5).fixtures.par1.dimmer, engine.state(0.5).fixtures.par2.dimmer], [1, 0], 'the chase runs');
  assert.throws(() => p.apply({ ...S, 'dmx/breathe/rate': 3 }), /give t/);
  assert.deepEqual(hsv(0, 1), [1, 0, 0]); assert.deepEqual(hsv(1 / 3, 1).map((x) => +x.toFixed(6)), [0, 1, 0]); assert.deepEqual(hsv(0.5, 0), [1, 1, 1]);
});

// ───────────── monitor: the pure part ─────────────

test('fixtureLook: colour × dimmer read back from the bytes; white mixes; pan and tilt as 16 bits; a fixture without a dimmer channel', () => {
  const patch = new Patch({ profiles: [{
    format: 'open-audiovisual/fixture@1', id: 'test-cmy', manufacturer: 'Test', name: 'CMY head', kind: 'moving-head',
    modes: [{ id: '4ch', channels: ['cyan', 'magenta', 'yellow', 'dimmer'] }],
    channels: { cyan: { type: 'color', color: 'cyan' }, magenta: { type: 'color', color: 'magenta' }, yellow: { type: 'color', color: 'yellow' }, dimmer: { type: 'intensity' } },
  }] });
  const par = patch.add({ id: 'par', profile: 'generic-rgbw', mode: '6ch', address: 1 });
  const rgb = patch.add({ id: 'rgb', profile: 'generic-rgb', address: 7 });
  const head = patch.add({ id: 'head', profile: 'generic-moving-head', mode: '16ch', address: 20 });
  const cmy = patch.add({ id: 'cmy', profile: 'test-cmy', address: 40 });
  const dim = patch.add({ id: 'dim', profile: 'generic-dimmer', address: 50 });
  const U = patch.render({
    par: { dimmer: 0.5, color: [1, 1, 1] }, rgb: { dimmer: 1, color: [0, 1, 0] },
    head: { dimmer: 1, pan: 0.25, tilt: 0.75, color: [1, 0, 0] }, cmy: { dimmer: 1, color: [1, 0, 0] }, dim: { dimmer: 0.4 },
  }).bytes(1);
  const p = fixtureLook(par, U);
  assert.deepEqual(p.mixed, [1, 1, 1], 'white from the white LED'); assert.ok(near(p.dimmer, 128 / 255)); assert.ok(p.color.every((c) => near(c, 128 / 255)));
  assert.equal(p.pan, null); assert.equal(p.strobe, 0);
  const g = fixtureLook(rgb, U);
  assert.deepEqual([g.dimmer, ...g.color], [1, 0, 1, 0], 'no dimmer channel: the colour bytes are the brightness');
  const h = fixtureLook(head, U);
  assert.ok(near(h.pan, 0.25, 1 / 65535) && near(h.tilt, 0.75, 1 / 65535)); assert.deepEqual(h.color, [1, 0, 0]);
  assert.deepEqual(fixtureLook(cmy, U).mixed, [1, 0, 0], 'colour flags: red is magenta + yellow');
  const d = fixtureLook(dim, U);
  assert.ok(near(d.dimmer, 102 / 255)); assert.ok(d.color[0] > d.color[2], 'a plain dimmer reads as a warm lamp');
  const mix = new Uint8Array(512); mix[0] = 255; mix[1] = 255; mix[4] = 255;   // dimmer full, red and white full
  assert.deepEqual(fixtureLook(par, mix).mixed, [1, 0.5, 0.5], 'red + white: a pink, its brightest channel at 1');
  assert.equal(cssColor([1, 0.5, 0]), 'rgb(255 128 0)');
  assert.throws(() => mountDmxMonitor(null, { patch }), /element/);
});
