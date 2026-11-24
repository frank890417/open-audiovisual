// @openav/dmx, photosensitive safety per fixture. The 3-flashes-a-second cap is about the light one fixture really emits, not
// about each effect or chase on its own, so it is held twice:
//   1. in the engine (pure, the same t gives the same bytes): the flashing sources on one fixture add up to at most the cap
//   2. at the output (stateful, wall time): FlashGuard in every dmxTransport, ChannelFlashGuard in the bridge's DMX sinks,
//      whatever made the light flash (a live value, a kick drum on a dimmer)
// Flashes are counted by tests/_flash.js, written apart from the guard (WCAG 2.3.1: a pair of opposing changes of 10%).
// No real timers: every clock here is injected.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Patch, DmxEngine, dmxTransport, FlashGuard } from '../packages/dmx/index.js';
import { ChannelFlashGuard, fixtureLevel, flashBudget } from '../packages/dmx/flash-guard.js';
import { DmxFrames } from '../packages/out/bridge/sinks/dmx-frames.js';
import { create as createArtnet } from '../packages/out/bridge/sinks/artnet.js';
import { maxFlashes, turns, plainLevel } from './_flash.js';

const FPS = 40;
const frames = (seconds) => Array.from({ length: Math.round(seconds * FPS) }, (_, f) => f / FPS);

/** Two RGBW pars (6ch: dimmer r g b w strobe at 1 and 7) and a 16-channel moving head at 13 (pan 13/14, tilt 15/16, dimmer 18, r g b w 20–23). */
function rig(opts) {
  const patch = new Patch();
  patch.add({ id: 'par1', profile: 'generic-rgbw', mode: '6ch', address: 1, groups: ['pars'] });
  patch.add({ id: 'par2', profile: 'generic-rgbw', mode: '6ch', address: 7, groups: ['pars'] });
  patch.add({ id: 'head', profile: 'generic-moving-head', mode: '16ch', address: 13, groups: ['heads'] });
  const engine = new DmxEngine(patch, opts);
  engine.scene('on', { pars: { dimmer: 1, color: [1, 1, 1] }, heads: { dimmer: 1, color: [1, 1, 1], tilt: 0.5 } }).base('on');
  return { patch, engine };
}
const PAR1 = { intensity: 1, colors: [2, 3, 4, 5] };
const HEAD = { intensity: 18, colors: [20, 21, 22, 23] };
/** par1's brightness, frame by frame, from a function that gives the bytes of universe 1 at t. */
const series = (bytesAt, ts, where = PAR1) => ts.map((t) => [t, plainLevel(bytesAt(t), where)]);

// ───────────── the counter itself ─────────────

test('flash counter: 10% from the last turning point, half-open seconds, dark before the first sample', () => {
  const sq = (hz) => frames(10).map((t) => [t, Math.floor(t * hz * 2) % 2 ? 0 : 1]);
  assert.equal(maxFlashes(sq(3)).flashes, 3, 'a 3 Hz square: 3 in any second (its seventh edge opens the next second)');
  assert.equal(maxFlashes(sq(2)).flashes, 2);
  // a slow sine moves under 10% a frame and still turns: 4 Hz at 30% depth is 4 flashes a second
  const sine = frames(10).map((t) => [t, 0.7 + 0.15 * Math.cos(2 * Math.PI * 4 * t)]);
  assert.equal(maxFlashes(sine).flashes, 4);
  // under 10% is not a flash; a light on from the start has risen once
  assert.equal(maxFlashes(frames(5).map((t) => [t, 0.5 + 0.04 * Math.sin(20 * t)])).flashes, 0);
  assert.deepEqual(turns([[0, 1], [1, 1]]), [{ t: 0, up: true }]);
});

// ───────────── layer 1: the engine, per fixture ─────────────

test('engine: two 3 Hz effects on one fixture flash it at most 3 times in any second (6 before the per-fixture cap)', () => {
  // two sines in antiphase on one dimmer: each is 3 Hz, their product is a 6 Hz flicker
  const make = (opts) => {
    const { engine } = rig(opts);
    engine.effect('a', { target: 'par1', wave: 'sine', rate: 3, depth: 1 });
    engine.effect('b', { target: 'par1', wave: 'sine', rate: 3, depth: 1, phase: 0.5 });
    return engine;
  };
  const capped = make(), open = make({ maxFlashHz: Infinity });
  const after = maxFlashes(series((t) => capped.render(t).bytes(1), frames(10)));
  const before = maxFlashes(series((t) => open.render(t).bytes(1), frames(10)));
  assert.equal(before.flashes, 6, 'each effect alone is within the cap, together they are not: the measure sees it');
  assert.ok(after.flashes <= 3, `${after.flashes} flashes in a second`);
  assert.equal(after.flashes, 3);
  const st = capped.state(0);
  assert.deepEqual(st.capped, [], 'neither effect is over the cap on its own');
  assert.equal(st.slowed.length, 1);
  assert.equal(st.slowed[0].id, 'par1');
  assert.ok(Math.abs(st.slowed[0].hz - 6) < 1e-9 && Math.abs(st.slowed[0].to - 3) < 1e-9, JSON.stringify(st.slowed[0]));
  assert.deepEqual(st.slowed[0].sources.map((s) => [s.kind, s.name, s.hz, s.to]), [['effect', 'a', 3, 1.5], ['effect', 'b', 3, 1.5]]);
  assert.deepEqual(capped.describe().slowed, st.slowed, 'describe() says the same (at the engine\'s own bpm)');
  // par2 has neither effect: untouched
  assert.equal(capped.render(0.37).bytes(1)[6], open.render(0.37).bytes(1)[6]);
});

test('engine: a chase and an effect on one fixture share the cap; a beat rate halves (stays on the beat), a rate in seconds scales', () => {
  const { engine } = rig();
  engine.scene('hi', { par1: { dimmer: 1 } }).scene('lo', { par1: { dimmer: 0.2 } });
  engine.chase('blink', { steps: ['hi', 'lo'], every: 0.25, unit: 'beat' });         // 120 bpm: 8 steps a second, 4 Hz → floor 2 Hz
  engine.effect('wave', { target: 'pars', wave: 'square', rate: 2.5, depth: 0.6 });   // 2.5 Hz, under the cap on its own
  const st = engine.state(0);
  assert.deepEqual(st.capped.map((c) => [c.kind, c.name, c.to]), [['chase', 'blink', 2]], 'the chase on its own: 4 → 2 Hz (its step doubled)');
  const s = st.slowed.find((x) => x.id === 'par1');
  assert.ok(s, 'par1 carries both: 2 + 2.5 = 4.5 Hz');
  const by = Object.fromEntries(s.sources.map((x) => [x.name, x.to]));
  assert.equal(by.blink, 1, 'the chase in beats: halved again, to one flash a beat-pair (on the beat)');
  assert.ok(Math.abs(by.wave - 2.5 * (3 / 4.5)) < 1e-9, 'the effect in seconds: by the proportional factor');
  assert.ok(s.to <= 3 + 1e-9, `${s.to} Hz`);
  assert.equal(st.slowed.some((x) => x.id === 'par2'), false, 'par2 has only the effect: not slowed');
  const counted = maxFlashes(series((t) => engine.render(t).bytes(1), frames(10)));
  assert.ok(counted.flashes <= 3, `${counted.flashes} flashes in a second on par1`);
  // the chase is slower on par1 only: par2 still runs the effect at its own 2.5 Hz
  assert.equal(maxFlashes(series((t) => engine.render(t).bytes(1), frames(10), { intensity: 7, colors: [8, 9, 10, 11] })).flashes, 2, 'par2: 2.5 Hz, five edges in a second');
});

test('engine: the same t gives the same bytes with the per-fixture cap at work, whatever was rendered in between', () => {
  const { engine } = rig();
  engine.effect('a', { target: 'pars', wave: 'square', rate: 3, spread: 1 });
  engine.effect('b', { target: 'par1', wave: 'flicker', rate: 3, depth: 0.5, seed: 7 });
  engine.scene('x', { pars: { color: [1, 0, 0] } }).scene('y', { pars: { color: [0, 0, 1] } }).chase('c', { steps: ['x', 'y'], every: 0.4, unit: 'second' });
  const at = [0, 0.1, 3.3, 17.77, 120.5];
  const first = at.map((t) => Array.from(engine.render(t).bytes(1)));
  for (const t of [9, 0.5, 1000, 2.2]) engine.render(t);
  assert.deepEqual(at.map((t) => Array.from(engine.render(t).bytes(1))), first);
  assert.deepEqual([...at].reverse().map((t) => Array.from(engine.render(t).bytes(1))), [...first].reverse());
  assert.ok(engine.state(0).slowed.some((s) => s.id === 'par1'), 'and par1 is being slowed');
});

test('engine: a knob turned on one of two waves sharing a fixture moves neither with a jump (tune carries both on)', () => {
  // at t ≈ 100 s a rate change that moved the other wave's speed without re-anchoring it would jump it at every step
  const { engine } = rig();
  engine.effect('a', { target: 'par1', wave: 'sine', rate: 2, depth: 0.6 });
  engine.effect('b', { target: 'par1', wave: 'sine', rate: 2, depth: 0.6, phase: 0.3 });
  const ts = frames(4).map((t) => 100 + t);
  const s = [];
  let maxStep = 0, prev = null;
  ts.forEach((t, i) => {
    if (i > 0 && i <= 120) engine.tune('a', { rate: 2 + i * 0.01 }, t);   // a knob turned slowly, every frame for 3 s
    const v = plainLevel(engine.render(t).bytes(1), PAR1);
    if (prev !== null) maxStep = Math.max(maxStep, Math.abs(v - prev));
    prev = v; s.push([t, v]);
  });
  assert.ok(engine.state(101).slowed.some((x) => x.id === 'par1'), 'the two are over the cap together the whole time');
  assert.ok(maxStep < 0.2, `no jump: the largest change in one frame is ${maxStep.toFixed(3)}`);
  assert.ok(maxFlashes(s).flashes <= 3, `${maxFlashes(s).flashes} flashes in a second`);
});

test('engine: a knob on an effect carries on a chase that shares the fixture too (its step there changes speed, not place)', () => {
  const { engine } = rig();
  engine.scene('hi', { par1: { dimmer: 1 } }).scene('lo', { par1: { dimmer: 0.2 } });
  engine.chase('c', { steps: ['hi', 'lo'], every: 0.25, unit: 'second', fade: 0.4 });     // 2 Hz
  engine.effect('w', { target: 'par1', wave: 'sine', rate: 2, depth: 0.5 });              // 2 Hz: 4 together, slowed to 3
  const at = 100.123;
  const before = engine.state(at).fixtures.par1.dimmer;
  const chaseHz = () => engine.state(at).slowed.find((x) => x.id === 'par1').sources.find((x) => x.name === 'c').to;
  const was = chaseHz();
  engine.tune('w', { rate: 2.5 }, at);                                                    // 4.5 together: the chase slows again on par1
  assert.ok(chaseHz() < was - 0.1, `the chase on par1 runs at ${chaseHz()} Hz now, ${was} before`);
  assert.ok(Math.abs(engine.state(at).fixtures.par1.dimmer - before) < 1e-9, 'the same light at the moment of the change');
  const s = frames(3).map((t) => [at + t, plainLevel(engine.render(at + t).bytes(1), PAR1)]);
  assert.ok(maxFlashes(s).flashes <= 3);
});

test('engine: stopping one of two waves on a fixture lets the other rejoin its row (no fixture left out of step)', () => {
  const { engine } = rig();
  engine.effect('row', { target: 'pars', wave: 'sine', rate: 2, depth: 1, spread: 1 });
  engine.effect('extra', { target: 'par1', wave: 'sine', rate: 2, depth: 1 });
  engine.tune('row', { rate: 2.2 }, 50);                    // par1 gets a phase of its own (it runs slower there)
  engine.run('extra', false);
  assert.deepEqual(engine.state(0).slowed, []);
  const ref = rig().engine;
  ref.effect('row', { target: 'pars', wave: 'sine', rate: 2.2, depth: 1, spread: 1, phase: engine.describe().effects.row.phase });
  for (const t of [50, 51.3, 77]) assert.deepEqual(Array.from(engine.render(t).bytes(1).slice(0, 12)), Array.from(ref.render(t).bytes(1).slice(0, 12)), `t=${t}`);
});

test('engine: movement does not count, a rainbow on a light with no colour channel does not count, the cap can still be raised on purpose', () => {
  const { engine, patch } = rig();
  patch.add({ id: 'dim', profile: 'generic-dimmer', address: 40, groups: ['pars'] });
  engine.effect('wig', { target: 'head', property: 'pan', wave: 'square', rate: 10 });
  engine.effect('d', { target: 'head', wave: 'square', rate: 3 });
  engine.effect('rb', { target: 'pars', property: 'color', wave: 'rainbow', rate: 3, depth: 1 });
  engine.effect('d2', { target: 'dim', wave: 'square', rate: 3 });
  const st = engine.state(0);
  assert.equal(st.slowed.some((s) => s.id === 'head'), false, 'pan at 10 Hz plus a 3 Hz dimmer: only the dimmer flashes');
  assert.equal(st.slowed.some((s) => s.id === 'dim'), false, 'a rainbow does nothing to a plain dimmer');
  engine.maxFlashHz = Infinity;
  assert.deepEqual(engine.state(0).slowed, []);
});

// ───────────── layer 2: the output guard, per fixture ─────────────

/** A 12 Hz square on par1's dimmer from set(), every frame (a kick at 180 bpm sixteenths), sent at 40 fps on an injected clock. */
function liveSquare(transportOpts, seconds = 10) {
  const { patch, engine } = rig();
  let ms = 0;
  const out = dmxTransport('sim', { patch, now: () => ms, ...transportOpts });
  const s = [];
  for (const t of frames(seconds)) {
    ms = t * 1000;
    engine.set('par1', { dimmer: Math.floor(t * 24) % 2 ? 0 : 1 });
    out.send(engine.render(t));
    s.push([t, plainLevel(out.bytes(1), PAR1)]);
  }
  return { s, out, engine, patch };
}

test('guard: a 12 Hz live value on a dimmer leaves as at most 3 flashes in any second; with flashGuard: false it does not', () => {
  const on = liveSquare({}), off = liveSquare({ flashGuard: false });
  const a = maxFlashes(on.s), b = maxFlashes(off.s);
  assert.ok(b.flashes > 3, `unguarded: ${b.flashes} flashes in a second (the test measures something)`);
  assert.ok(b.flashes >= 10, `unguarded: ${b.flashes}`);
  assert.ok(a.flashes <= 3, `guarded: ${a.flashes}`);
  assert.equal(a.flashes, 3);
  assert.ok(a.rises <= 3);
  assert.deepEqual(on.out.flashGuard.unit, 'fixture');
  assert.equal(on.out.flashGuard.on, true);
  assert.deepEqual(off.out.flashGuard, { on: false, unit: null, maxFlashHz: null, held: [] });
  // a held light is steady: every frame is either what was asked or what went the frame before (no ripple under the line)
  const asked = off.s;
  const ripple = on.s.filter(([, v], i) => i > 0 && v !== asked[i][1] && v !== on.s[i - 1][1]);
  assert.deepEqual(ripple, [], 'held means held where it was');
  // what is held is never brighter than what was asked: the guard only takes light away
  const { patch, engine } = rig();
  let ms = 0;
  const out = dmxTransport('sim', { patch, now: () => ms });
  for (const t of frames(3)) {
    ms = t * 1000;
    engine.set('par1', { dimmer: Math.floor(t * 24) % 2 ? 0 : 1 });
    const U = engine.render(t);
    out.send(U);
    assert.ok(out.bytes(1)[0] <= U.bytes(1)[0], `t=${t}`);
  }
});

test('guard: blackout and a cue to dark land on the next frame, however hard the light was flashing', () => {
  const { patch, engine } = rig();
  let ms = 0;
  const out = dmxTransport('sim', { patch, now: () => ms });
  let held = 0;
  for (const t of frames(0.6)) {
    ms = t * 1000;
    engine.set('par1', { dimmer: Math.floor(t * 24) % 2 ? 0 : 1 });
    out.send(engine.render(t));
    if (out.flashGuard.held.includes('par1')) held++;
  }
  assert.ok(held > 0, 'the guard was holding par1 back');
  ms += 25;
  engine.blackout = true;
  out.send(engine.render(0.625));
  assert.deepEqual(Array.from(out.bytes(1).slice(0, 12)), Array.from(engine.render(0.625).bytes(1).slice(0, 12)), 'dark at once');
  assert.equal(out.bytes(1)[0], 0);
});

test('guard: a slow fade and a steady colour change are not touched (bytes in are bytes out); nothing is held', () => {
  const { patch, engine } = rig();
  engine.effect('fade', { target: 'par1', wave: 'sine', rate: 0.25, depth: 1 });           // 4 s up and down
  engine.effect('hue', { target: 'par2', property: 'color', wave: 'rainbow', rate: 0.2, depth: 1 });
  engine.effect('sway', { target: 'head', property: 'pan', wave: 'sine', rate: 0.5, depth: 0.8 });
  let ms = 0;
  const out = dmxTransport('sim', { patch, now: () => ms });
  for (const t of frames(12)) {
    ms = t * 1000;
    const U = engine.render(t);
    out.send(U);
    assert.deepEqual(out.flashGuard.held, [], `t=${t}`);
    assert.ok(out.bytes(1).every((b, i) => b === U.bytes(1)[i]), `t=${t}: bytes in are bytes out`);
  }
  // FlashGuard on its own hands back the very same arrays when it holds nothing
  const g = new FlashGuard(patch);
  const raw = { 1: new Uint8Array(512).fill(40) };
  const [[id, bytes]] = g.apply(raw, 1);
  assert.equal(id, 1);
  assert.equal(bytes, raw[1], 'the same array, not a copy');
});

test('guard: a moving head held back keeps pan, tilt and every other channel exactly as sent; only its intensity drops', () => {
  const { patch, engine } = rig();
  engine.effect('sway', { target: 'head', property: 'pan', wave: 'sine', rate: 0.7, depth: 0.9 });
  engine.effect('nod', { target: 'head', property: 'tilt', wave: 'sine', rate: 0.4, depth: 0.5 });
  let ms = 0, heldFrames = 0;
  const out = dmxTransport('sim', { patch, now: () => ms });
  const s = [];
  for (const t of frames(6)) {
    ms = t * 1000;
    engine.set('head', { dimmer: Math.floor(t * 24) % 2 ? 0.05 : 1, color: [1, 0.4, 0] });
    const U = engine.render(t).bytes(1);
    out.send(engine.render(t));
    const got = out.bytes(1);
    for (let a = 13; a <= 28; a++) if (a !== 18) assert.equal(got[a - 1], U[a - 1], `t=${t} address ${a}`);
    if (got[17] !== U[17]) heldFrames++;
    s.push([t, plainLevel(got, HEAD)]);
  }
  assert.ok(heldFrames > 50, `the dimmer was held in ${heldFrames} frames`);
  assert.ok(maxFlashes(s).flashes <= 3);
});

test('guard: no patch → per channel (coarser, said in the status); a fixture with no dimmer is held through its colour; the levels read 16 bits', () => {
  let ms = 0;
  const out = dmxTransport('sim', { now: () => ms });
  assert.equal(out.flashGuard.unit, 'channel');
  const s = [];
  for (const t of frames(5)) { ms = t * 1000; const u = new Uint8Array(512); u[99] = Math.floor(t * 24) % 2 ? 0 : 255; out.send({ 1: u }); s.push([t, out.bytes(1)[99] / 255]); }
  assert.ok(maxFlashes(s).flashes <= 3);
  // an RGB par (no dimmer channel): held by scaling its colour, the hue kept
  const patch = new Patch();
  patch.add({ id: 'rgb', profile: 'generic-rgb', address: 1 });
  const g = new FlashGuard(patch);
  const tint = (on) => { const u = new Uint8Array(512); if (on) { u[0] = 200; u[1] = 100; u[2] = 50; } return { 1: u }; };
  const lvl = [];
  let heldOnce = false;
  for (let f = 0; f < 40; f++) {                                                   // on, off, on… every frame for a second
    const got = g.apply(tint(f % 2 === 0), f / 40)[0][1];
    lvl.push([f / 40, got[0] / 255]);
    if (g.held.includes('rgb')) { heldOnce = true; assert.ok(got[0] < 200, 'held: dimmer than asked'); }
    if (got[0] > 4) assert.ok(Math.abs(got[1] / got[0] - 0.5) < 0.05 && Math.abs(got[2] / got[0] - 0.25) < 0.05, `f=${f}: the hue stays (${got[0]} ${got[1]} ${got[2]})`);
  }
  assert.ok(heldOnce, 'its fourth rise in the second was held');
  assert.ok(maxFlashes(lvl).flashes <= 3);
  // 16 bits: a moving head's intensity is one byte here, but the reader takes the fine byte where a mode has one
  const rec = { address: 1, layout: { intensities: [{ offset: 0, fineOffset: 1 }], colors: [] } };
  assert.ok(Math.abs(fixtureLevel(rec, [128, 0]) - (128 * 256) / 65535) < 1e-12);
  assert.deepEqual(flashBudget(3), { rises: 3, window: 1 });
  assert.deepEqual(flashBudget(2.5), { rises: 2, window: 1 });
  assert.deepEqual(flashBudget(0.5), { rises: 1, window: 2 });
  assert.throws(() => dmxTransport('sim', { flashGuard: 'off' }), /flashGuard is true/);
  assert.throws(() => new FlashGuard(patch, { maxFlashHz: NaN }), /maxFlashHz/);
});

// ───────────── the bridge: per channel ─────────────

test('bridge guard: DmxFrames on a fake clock holds a 12 Hz channel to 3 flashes, leaves exempt channels, flushes safe values as they are', () => {
  let now = 0;
  const sent = [];
  const make = (flashGuard) => new DmxFrames({ now: () => now, emit: (u, data) => sent.push([now, u, Uint8Array.from(data)]), flashGuard });
  const run = (frames, seconds = 6) => {
    sent.length = 0;
    for (let ms = 0; ms < seconds * 1000; ms += 5) {
      now = ms;
      frames.set('dmx/1/1', Math.floor(ms / (1000 / 24)) % 2 ? 0 : 1);   // 12 Hz
      frames.set('dmx/1/50', Math.floor(ms / (1000 / 24)) % 2 ? 0 : 1);  // the same on an exempt channel
      if (ms % 25 === 0) frames.tick();
    }
    return sent.map(([t, , d]) => [t / 1000, d]);
  };
  const guarded = run(make(new ChannelFlashGuard({ exempt: (u, a) => u === 1 && a === 50 })));
  const open = run(make(null));
  const count = (rows, a) => maxFlashes(rows.map(([t, d]) => [t, d[a - 1] / 255])).flashes;
  assert.ok(count(open, 1) > 3, `unguarded: ${count(open, 1)}`);
  assert.ok(count(guarded, 1) <= 3, `guarded: ${count(guarded, 1)}`);
  assert.equal(count(guarded, 50), count(open, 50), 'an exempt channel leaves as it came');
  // the bridge's safe values: flush() sends them as they are, at once, even mid-hold
  const g = new ChannelFlashGuard();
  const f = make(g);
  sent.length = 0;
  for (let ms = 0; ms < 400; ms += 25) { now = ms; f.set('dmx/1/1', (ms / 25) % 2 ? 1 : 0); f.tick(); }
  now = 425; f.set('dmx/1/1', 1); f.tick();
  assert.ok(sent.at(-1)[2][0] < 255, 'a rise that is one too many is held');
  now = 430; f.set('dmx/1/1', 0.8); f.flush();
  assert.equal(sent.at(-1)[2][0], 204, 'flush (safe values) goes out as it is');
});

test('bridge guard: the artnet sink has it on by default, "flashGuard": false switches it off, "exempt" leaves channels alone; status says which', () => {
  const ctx = { log: () => {} };
  const on = createArtnet({ host: '127.0.0.1', port: 9 }, ctx);
  const off = createArtnet({ host: '127.0.0.1', port: 9, flashGuard: false }, ctx);
  const ex = createArtnet({ host: '127.0.0.1', port: 9, flashGuard: { exempt: ['dmx/1/49', 'dmx/1/50-52'], maxFlashHz: 2 } }, ctx);
  try {
    assert.deepEqual(on.status().flashGuard, { on: true, unit: 'channel', maxFlashHz: 3, exempt: [], held: [] });
    assert.deepEqual(off.status().flashGuard, { on: false });
    assert.equal(ex.status().flashGuard.maxFlashHz, 2);
    assert.deepEqual(ex.status().flashGuard.exempt, ['dmx/1/49', 'dmx/1/50-52']);
    assert.throws(() => createArtnet({ host: '127.0.0.1', flashGuard: 'no' }, ctx), /flashGuard/);
    assert.throws(() => createArtnet({ host: '127.0.0.1', flashGuard: { exempt: ['dmx/1/0'] } }, ctx), /exempt/);
  } finally { on.close(); off.close(); ex.close(); }
});
