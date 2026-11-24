// @openav/dmx — the engine: scenes, cues with fades, chases on beats, effects with phase spread, live values, the master,
// blackout and the safety rules (the 3 Hz flash cap, control channels), all as a pure function of time.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Patch } from '../packages/dmx/patch.js';
import { DmxEngine } from '../packages/dmx/engine.js';

const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

/** Four dimmers in a row (addresses 1–4), an RGB par (10–12), a 16-channel moving head (20–35). */
function rig(opts) {
  const p = new Patch();
  for (let i = 1; i <= 4; i++) p.add({ id: `d${i}`, profile: 'generic-dimmer', address: i, groups: ['row'] });
  p.add({ id: 'rgb', profile: 'generic-rgb', address: 10, groups: ['pars'] });
  p.add({ id: 'mh', profile: 'generic-moving-head', mode: '16ch', address: 20, groups: ['heads'] });
  return new DmxEngine(p, opts);
}
const dim = (e, t, opts) => e.state(t, opts).fixtures;
/** Rising edges of one byte over [t0, t1), sampled every dt: how many times it flashes on. */
function flashes(e, at, { t0 = 0, t1 = 1, dt = 0.001, bpm } = {}) {
  let n = 0, was = 0;                                                        // dark before the first sample: a light on at t0 counts
  for (let t = t0; t < t1 - 1e-12; t += dt) {
    const v = e.render(t, { bpm }).get(1).get(at);
    if (v > 127 && was <= 127) n++;
    was = v;
  }
  return n;
}

test('engine: the same time always gives the same bytes, whatever was rendered in between', () => {
  const e = rig();
  e.scene('look', { row: { dimmer: 0.8 }, rgb: { color: [1, 0.3, 0] }, mh: { dimmer: 1, pan: 0.4, tilt: 0.6, color: [0, 0.5, 1] } }).base('look');
  e.scene('off', { row: { dimmer: 0 } }).cue('a', { scene: 'off', fadeIn: 2, curve: 'smooth' }).go('a', 1);
  e.effect('flick', { target: 'row', wave: 'flicker', rate: 2, seed: 7 });
  e.effect('sway', { target: 'heads', property: 'pan', wave: 'sine', rate: 0.25, depth: 0.5 });
  e.effect('hue', { target: 'pars', property: 'color', wave: 'rainbow', rate: 0.1 });
  const first = e.render(1.234).bytes(1);
  const other = e.render(7.5).bytes(1);
  const again = e.render(1.234).bytes(1);
  assert.deepEqual(again, first);
  assert.notDeepEqual(other, first, 'a different time is a different look (the test is not vacuous)');
  assert.deepEqual(rig().scene('x', { row: { dimmer: 0.5 } }).base('x').render(3).bytes(1), rig().scene('x', { row: { dimmer: 0.5 } }).base('x').render(3).bytes(1), 'two engines, same answer');
  // flicker is seeded: the same seed gives the same flicker, another seed another one
  const f = (seed) => { const x = rig().scene('on', { row: { dimmer: 1 } }).base('on'); x.effect('f', { target: 'row', wave: 'flicker', rate: 3, seed }); return [0.1, 0.5, 0.9].map((t) => x.render(t).bytes(1).slice(0, 4).join()).join('|'); };
  assert.equal(f(1), f(1)); assert.notEqual(f(1), f(2));
});

test('engine: a cue rises over its fade in while the one before falls over its fade out, at the times they were given', () => {
  const e = rig();
  e.scene('full', { d1: { dimmer: 1 } }).scene('dark', { d1: { dimmer: 0 } }).scene('base', { d1: { dimmer: 0.2 } });
  e.cue('A', { scene: 'full' }).cue('B', { scene: 'dark', fadeIn: 2 }).cue('C', { scene: 'full', fadeIn: 4, curve: 'smooth' });
  e.go('A', 0).go('B', 10);
  assert.equal(dim(e, -1).d1.dimmer, 0, 'before anything goes: the default (dark)');
  assert.equal(dim(e, 0).d1.dimmer, 1, 'A has no fade: full at once');
  assert.equal(dim(e, 9.99).d1.dimmer, 1);
  assert.ok(near(dim(e, 11).d1.dimmer, 0.5), 'halfway through a 2 s crossfade');
  assert.equal(e.render(11).get(1).get(1), 128);
  assert.equal(dim(e, 12).d1.dimmer, 0);
  // the times belong to the cue you go to: C (4 s, smooth, fadeOut = fadeIn) rises while B falls, both over 4 s
  e.go('C', 20);
  const s = (x) => x * x * (3 - 2 * x);
  assert.ok(near(dim(e, 21).d1.dimmer, s(0.25)), 'C at a quarter of its smooth rise; B (dimmer 0) adds nothing');
  assert.ok(near(dim(e, 22).d1.dimmer, 0.5));
  // a dip: when the two weights add up to less than 1, what is under the cues shows through
  const d = rig();
  d.scene('full', { d1: { dimmer: 1 } }).scene('dark', { d1: { dimmer: 0 } }).scene('base', { d1: { dimmer: 0.2 } }).base('base');
  d.cue('A', { scene: 'full' }).cue('B', { scene: 'dark', fadeIn: 2, fadeOut: 1 }).go('A', 0).go('B', 10);
  assert.ok(near(dim(d, 10.5).d1.dimmer, 0.5 * 1 + 0.25 * 0 + 0.25 * 0.2), 'A falls over B\'s 1 s, B rises over 2 s: the base 0.2 shows under the missing quarter');
  d.release(20);
  assert.ok(near(dim(d, 20.5).d1.dimmer, 0.5 * 0 + 0.5 * 0.2), 'release: B falls over its own 1 s fadeOut, back to the base');
  assert.ok(near(dim(d, 21).d1.dimmer, 0.2));
  d.go('A', 30).release(40, 4);
  assert.ok(near(dim(d, 41).d1.dimmer, 0.75 * 1 + 0.25 * 0.2), 'a release with its own time');
  // go() at an earlier time than one already given is placed in time order
  const o = rig(); o.scene('full', { d1: { dimmer: 1 } }).scene('dark', { d1: { dimmer: 0 } }).cue('A', { scene: 'full' }).cue('B', { scene: 'dark' });
  o.go('B', 5).go('A', 1);
  assert.equal(dim(o, 3).d1.dimmer, 1); assert.equal(dim(o, 6).d1.dimmer, 0);
  assert.throws(() => e.go('A'), /at is a time/); assert.throws(() => e.go('Z', 1), /no cue "Z"/);
  assert.throws(() => e.cue('X', { scene: 'nope' }), /no scene "nope"/);
  assert.throws(() => e.cue('X', { scene: 'full', curve: 'bounce' }), /curve is one of/);
});

test('engine: a chase steps on the beat, from the tempo or from a beat position it is given', () => {
  const e = rig();
  e.scene('a', { d1: { dimmer: 1 } }).scene('b', { d2: { dimmer: 1 } }).scene('c', { d3: { dimmer: 1 } });
  e.chase('walk', { steps: ['a', 'b', 'c'], every: 1 });
  const on = (t, o) => { const f = dim(e, t, o); return ['d1', 'd2', 'd3'].filter((id) => f[id].dimmer > 0.5).join(); };
  // 120 bpm: a beat is 0.5 s
  assert.deepEqual([0, 0.25, 0.5, 0.99, 1.0, 1.5, 2.0].map((t) => on(t)), ['d1', 'd1', 'd2', 'd2', 'd3', 'd1', 'd2']);
  assert.equal(on(1, { bpm: 60 }), 'd2', 'at 60 bpm, t = 1 s is beat 1');
  assert.equal(on(0, { beat: 4, bpm: 120 }), 'd2', 'a beat position (MIDI clock, drums) wins over the clock: beat 4 is step 4 mod 3');
  assert.throws(() => e.render(0, { beat: 4 }), /give bpm with beat/, 'a beat position without its tempo would blind the flash cap');
  // two-beat steps starting on beat 2, in seconds
  e.chase('walk', { steps: ['a', 'b', 'c'], every: 2, start: 2 });
  assert.equal(on(0.5), '', 'before its start the chase does nothing');
  assert.deepEqual([1, 1.9, 2, 3].map((t) => on(t)), ['d1', 'd1', 'd2', 'd3']);
  e.chase('walk', { steps: ['a', 'b'], every: 0.5, unit: 'second' });
  assert.deepEqual([0, 0.5, 1].map((t) => on(t)), ['d1', 'd2', 'd1']);
  e.run('walk', false);
  assert.equal(on(0), '', 'stopped'); e.run('walk', true); assert.equal(on(0), 'd1');
  // a crossfade over the last half of each step
  e.chase('walk', { steps: ['a', 'b'], every: 1, unit: 'second', fade: 0.5 });
  assert.ok(near(dim(e, 0.75).d1.dimmer, 0.5) && near(dim(e, 0.75).d2.dimmer, 0.5));
  e.remove('walk'); assert.equal(on(0), '');
  assert.throws(() => e.run('walk'), /no chase or effect/);
});

test('engine: effects over a group, with each fixture behind the one before by the spread', () => {
  const e = rig();
  e.scene('on', { row: { dimmer: 1 } }).base('on');
  // a chase wave walks the row: 1 → 2 → 3 → 4, a quarter cycle each
  e.effect('run', { target: 'row', wave: 'chase', rate: 1 });
  const lit = (t) => ['d1', 'd2', 'd3', 'd4'].filter((id) => dim(e, t)[id].dimmer > 0.5).join();
  assert.deepEqual([0, 0.25, 0.5, 0.75, 1].map(lit), ['d1', 'd2', 'd3', 'd4', 'd1']);
  // a sine with half a cycle of spread over 2 fixtures: opposite phase, the two always add to the full level
  e.remove('run');
  const two = rig(); two.scene('on', { d1: { dimmer: 1 }, d2: { dimmer: 1 } }).base('on');
  two.effect('breathe', { target: ['d1', 'd2'], wave: 'sine', rate: 0.5, spread: 1 });
  for (const t of [0, 0.3, 0.77, 1.5]) { const f = dim(two, t); assert.ok(near(f.d1.dimmer + f.d2.dimmer, 1), `t=${t}`); }
  assert.equal(dim(two, 0).d1.dimmer, 0, 'a sine starts dark');
  // depth: a dimmer effect only takes light away from the look under it
  const half = rig(); half.scene('on', { d1: { dimmer: 0.6 } }).base('on');
  half.effect('pulse', { target: 'd1', wave: 'square', rate: 1, depth: 0.5 });
  assert.ok(near(dim(half, 0.1).d1.dimmer, 0.6) && near(dim(half, 0.6).d1.dimmer, 0.3), 'square on: 0.6, off: 0.6 × (1 − 0.5)');
  // pan swings around where the head points
  const mh = rig(); mh.scene('pos', { mh: { pan: 0.5 } }).base('pos');
  mh.effect('swing', { target: 'mh', property: 'pan', wave: 'saw', rate: 1, depth: 0.4 });
  assert.ok(near(dim(mh, 0).mh.pan, 0.3) && near(dim(mh, 0.5).mh.pan, 0.5));
  // rainbow on colour: red at the start of the cycle, green a third of the way
  const rb = rig(); rb.effect('hue', { target: 'rgb', property: 'color', wave: 'rainbow', rate: 0.1 });
  assert.deepEqual(dim(rb, 0).rgb.color, [1, 0, 0]);
  assert.deepEqual(dim(rb, 10 / 3).rgb.color.map((x) => Math.round(x * 1000) / 1000), [0, 1, 0]);
  assert.throws(() => rb.effect('x', { target: 'rgb', property: 'color', wave: 'sine' }), /rainbow runs on color/);
  assert.throws(() => rb.effect('x', { target: 'nobody' }), /not a fixture or a group/);
  assert.throws(() => rb.effect('x', { target: 'rgb', property: 'reset' }), /property is one of/);
});

test('engine: live values sit on top; the master scales; blackout darkens and leaves pan, tilt and zoom', () => {
  const e = rig();
  e.scene('look', { row: { dimmer: 1 }, rgb: { color: [1, 0, 0] }, mh: { dimmer: 1, pan: 0.3, tilt: 0.7, zoom: 0.4, color: [1, 1, 1] } }).base('look');
  e.effect('wave', { target: 'row', wave: 'sine', rate: 1 });
  e.set('d1', { dimmer: 0.3 });
  assert.ok(near(dim(e, 0.5).d1.dimmer, 0.3), 'a live value wins over the effect');
  e.set('row', { dimmer: 0.6 }).set('d1', { dimmer: 0.1 });
  assert.ok(near(dim(e, 0.5).d2.dimmer, 0.6) && near(dim(e, 0.5).d1.dimmer, 0.1), 'the latest set wins per fixture');
  e.clear('d1', 'dimmer'); assert.ok(near(dim(e, 0.5).d1.dimmer, 1), 'the sine at its top again'); e.clear();
  e.master = 0.5;
  const m = e.render(0.5).get(1);
  assert.equal(m.get(1), 128, 'dimmer 1 × master 0.5');
  assert.deepEqual([m.get(10), m.get(11), m.get(12)], [128, 0, 0], 'the RGB par has no dimmer channel: the master is in its colour');
  e.master = 1;
  const before = e.render(0.5).get(1).copy();
  e.blackout = true;
  const after = e.render(0.5).get(1);
  assert.equal(after.get(1), 0); assert.deepEqual([after.get(10), after.get(11), after.get(12)], [0, 0, 0]);
  assert.equal(after.get(20 + 5), 0, 'head dimmer');
  for (const [name, at] of [['pan', 20], ['panFine', 21], ['tilt', 22], ['tiltFine', 23], ['zoom', 32]]) assert.equal(after.get(at), before.get(at), `${name} stays where it was`);
  assert.ok(before.get(20) > 0 && before.get(22) > 0, 'and it was not zero to begin with');
});

test('engine: an effect on intensity flashes 3 times a second at most, unless the cap is raised on purpose', () => {
  const sq = (opts, fx) => { const e = rig(opts); e.scene('on', { row: { dimmer: 1 } }).base('on'); e.effect('strobe', { target: 'd1', wave: 'square', ...fx }); return e; };
  const capped = sq(undefined, { rate: 10 });
  assert.ok(flashes(capped, 1) <= 3, `${flashes(capped, 1)} flashes in one second`);
  assert.equal(flashes(capped, 1), 3);
  assert.deepEqual(capped.state(0).capped, [{ kind: 'effect', name: 'strobe', hz: 10, to: 3 }]);
  assert.equal(flashes(sq({ maxFlashHz: Infinity }, { rate: 10 }), 1), 10, 'with the cap off on purpose: 10');
  assert.equal(flashes(sq({ maxFlashHz: 12 }, { rate: 10 }), 1), 10);
  assert.equal(flashes(sq(undefined, { rate: 2 }), 1), 2, 'under the cap: untouched');
  assert.deepEqual(sq(undefined, { rate: 2 }).state(0).capped, []);
  // beat-synced: 8 per beat at 120 bpm is 16 Hz; halved until it is under the cap (2 Hz), so it stays on the beat
  const beat = sq(undefined, { rate: 8, unit: 'beat' });
  assert.ok(flashes(beat, 1) <= 3);
  assert.deepEqual(beat.state(0).capped, [{ kind: 'effect', name: 'strobe', hz: 16, to: 2 }]);
  // a beat position from outside (MIDI clock) with its tempo: 1 flash per beat at 240 bpm is 4 Hz, halved to 2 Hz
  const ext = sq(undefined, { rate: 1, unit: 'beat' });
  let n = 0, was = 0;
  for (let t = 0; t < 1; t += 0.001) { const v = ext.render(t, { beat: t * 4, bpm: 240 }).get(1).get(1); if (v > 127 && was <= 127) n++; was = v; }
  assert.equal(n, 2);
  // an invalid cap does not switch the cap off: only Infinity does
  for (const bad of [NaN, undefined, 0, -1, '3']) {
    capped.maxFlashHz = bad;
    assert.throws(() => capped.render(0), /maxFlashHz/, String(bad));
    assert.throws(() => capped.patch.render({}, { maxFlashHz: bad === undefined ? null : bad }), /maxFlashHz/, `patch ${bad}`);
  }
  capped.maxFlashHz = 3;
  // a random flicker draws at most 3 new values a second
  const fl = rig(); fl.scene('on', { row: { dimmer: 1 } }).base('on'); fl.effect('f', { target: 'd1', wave: 'flicker', rate: 30 });
  const seen = new Set(); for (let t = 0; t < 1; t += 0.001) seen.add(fl.render(t).get(1).get(1));
  assert.ok(seen.size <= 3, `${seen.size} different values in one second`);
  // movement is not light: a fast pan effect is not slowed
  const pan = rig(); pan.effect('wiggle', { target: 'mh', property: 'pan', wave: 'square', rate: 10 });
  assert.deepEqual(pan.state(0).capped, []);
});

test('engine: a chase that flashes is held to the cap by doubling its step; one that only moves heads is not', () => {
  const e = rig();
  e.scene('on', { d1: { dimmer: 1 } }).scene('off', { d1: { dimmer: 0 } });
  e.chase('blink', { steps: ['on', 'off'], every: 0.125 });                      // 1/8 beat at 120 bpm: 16 steps, 8 flashes a second
  assert.ok(flashes(e, 1) <= 3, `${flashes(e, 1)} flashes`);
  assert.equal(e.state(0).capped[0].kind, 'chase');
  assert.equal(e.state(0).capped[0].to, 2, 'held to 4 steps a second (every 1/2 beat): 2 flashes, on the beat');
  e.maxFlashHz = Infinity;
  assert.equal(flashes(e, 1), 8);
  const heads = rig(); heads.scene('l', { mh: { pan: 0 } }).scene('r', { mh: { pan: 1 } }).chase('look', { steps: ['l', 'r'], every: 0.125 });
  assert.deepEqual(heads.state(0).capped, []);
});

test('engine: the strobe channel follows the cap too, and is kept open where its profile has no Hz', () => {
  const e = rig();
  const p = e.patch;
  p.add({ id: 'par', profile: 'generic-rgbw', mode: '6ch', address: 50 });
  e.set('par', { dimmer: 1, strobe: 1 });
  assert.equal(e.render(0).get(1).get(55), 0, 'generic RGBW: no Hz, so the strobe channel stays open');
  assert.equal(e.state(0).fixtures.par.strobe, 0);
  e.maxFlashHz = Infinity;
  assert.equal(e.render(0).get(1).get(55), 255);
});

test('engine: a control channel (reset, program) is written by control() and nothing else', () => {
  const e = rig();
  assert.throws(() => e.scene('bad', { mh: { reset: 1 } }), /control channel/);
  assert.throws(() => e.set('heads', { program: 0.5 }), /control channel/);
  assert.throws(() => e.set('mh', { sparkle: 1 }), /not a property/);
  assert.throws(() => e.scene('bad', { nobody: { dimmer: 1 } }), /not a fixture or a group/);
  assert.equal(e.render(0).get(1).get(35), 0);
  e.control('mh', 'reset', 255);
  assert.equal(e.render(0).get(1).get(35), 255);
  e.blackout = true; e.master = 0;
  assert.equal(e.render(0).get(1).get(35), 255, 'neither blackout nor the master touches it');
  e.control('mh', 'reset', null);
  assert.equal(e.render(0).get(1).get(35), 0, 'null lets it go back to its default');
  assert.throws(() => e.control('mh', 'dimmer', 10), /not a control channel/);
  assert.throws(() => e.control('mh', 'reset', 256), /byte 0–255/);
  assert.throws(() => e.control('ghost', 'reset', 1), /no fixture/);
});

test('engine: base scenes stack (later wins), groups and fixtures in one scene, and the options are checked', () => {
  const e = rig();
  e.scene('wash', { '*': { dimmer: 0.4 } }).scene('hi', { row: { dimmer: 0.9 }, d4: { dimmer: 0.1 } });
  e.base('wash', 'hi');
  const f = dim(e, 0);
  assert.ok(near(f.d1.dimmer, 0.9) && near(f.d4.dimmer, 0.1) && near(f.mh.dimmer, 0.4));
  assert.throws(() => e.base('nope'), /no scene "nope"/);
  assert.throws(() => new DmxEngine({}), /needs a Patch/);
  assert.throws(() => new DmxEngine(e.patch, { maxFlashHz: 0 }), /maxFlashHz/);
  assert.throws(() => e.render('now'), /t is a time/);
  assert.throws(() => e.scene('c', { d1: { color: [1, 0] } }), /color is \[r, g, b\]/);
  assert.throws(() => e.chase('c', { steps: [] }), /steps is a list/);
  e.chase('c', { steps: ['wash'] });
  assert.throws(() => e.effect('c', { target: 'row' }), /already a chase/);
});
