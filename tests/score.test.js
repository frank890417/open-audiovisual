// The score and the director (packages/score): structure as segment lengths, cues, hold,
// and a conductor that survives a module that throws. Pure logic, no DOM.
//
// The fixture is a made-up day: a standby that waits (hold), a dawn, a noon with cues, a dusk
// with a tail (linger), a night. Nothing here names a real show.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Score, ScoreError, Director } from '../packages/score/index.js';
import { Timeline } from '../packages/timeline/index.js';

const FULL = {
  id: 'full', title: 'Full day',
  segments: [
    { id: 'standby', title: 'Standby', dur: 5, hold: true, acts: ['check the sound'], cues: { breathe: 0.5 } },
    { id: 'dawn', title: 'Dawn', dur: 20, cues: { rise: 0.25 } },
    { id: 'noon', title: 'Noon', dur: 30, cues: { flare: { s: 6 }, peak: 0.5 }, acts: ['open the filter', 'play slowly'] },
    { id: 'dusk', title: 'Dusk', dur: 20, linger: 4, cues: { glow: 0.4 } },
    { id: 'night', title: 'Night', dur: 25, cues: { stars: 0.2 } },
  ],
};
const SHORT = { id: 'short', from: 'full', scale: 0.5 };
const mk = (o = {}) => new Score({ cuts: [FULL, SHORT], cut: 'full', ...o });
const near = (a, b, e = 1e-9) => assert.ok(Math.abs(a - b) <= e, `${a} ≉ ${b}`);

// a recording module: what the director called, and with which progress
function recorder(id, extra = {}) {
  const log = [];
  return {
    log, id,
    enter: (api, c) => log.push(['enter', +c.p.toFixed(4), c.phase]),
    update: (api, c) => log.push(['update', +c.p.toFixed(4), c.phase]),
    exit: (api, c) => log.push(['exit', +c.p.toFixed(4), c.phase]),
    ...extra,
  };
}
const run = (director, T0, T1, dt = 1 / 30, state = {}) => { for (let T = T0; T <= T1 + 1e-9; T += dt) director.update(T, dt, state); };
const quiet = (fn) => { const e = console.error; const calls = []; console.error = (...a) => calls.push(a); try { fn(calls); } finally { console.error = e; } return calls; };

// ───────────── building ─────────────

test('table: every segment has id, title, start, end, dur; the total is the sum of the lengths', () => {
  const s = mk();
  assert.deepEqual(s.table().map((r) => [r.id, r.title, r.start, r.end, r.dur]), [
    ['standby', 'Standby', 0, 5, 5], ['dawn', 'Dawn', 5, 25, 20], ['noon', 'Noon', 25, 55, 30], ['dusk', 'Dusk', 55, 75, 20], ['night', 'Night', 75, 100, 25],
  ]);
  assert.equal(s.total, FULL.segments.reduce((a, x) => a + x.dur, 0));
  assert.equal(s.total, 100);
});

test('changing one length moves everything after it, and nothing before', () => {
  const longer = { ...FULL, segments: FULL.segments.map((x) => (x.id === 'noon' ? { ...x, dur: 40 } : x)) };
  const a = mk(), b = new Score({ cuts: [longer], cut: 'full' });
  assert.equal(b.total, 110);
  assert.equal(b.cueTime('dawn.rise'), a.cueTime('dawn.rise'));                 // before: untouched
  assert.equal(b.cueTime('dusk.glow'), a.cueTime('dusk.glow') + 10);            // after: moved by exactly the change
  assert.equal(b.cueTime('noon.peak'), 25 + 20);                                // a ratio cue followed its own segment
});

test('a derived cut is the base cut with every length times the scale', () => {
  const full = mk(), half = mk({ cut: 'short' });
  assert.equal(half.cut, 'short');
  assert.equal(half.scale, 0.5);
  assert.equal(half.base, 'full');
  near(half.total, full.total * 0.5);
  for (let i = 0; i < full.segments.length; i++) {
    near(half.segments[i].dur, full.segments[i].dur * 0.5);
    near(half.segments[i].start, full.segments[i].start * 0.5);
    near(half.segments[i].linger, full.segments[i].linger * 0.5);
  }
  // cues keep their place in the music: ratio cues and { s } cues both scale
  near(half.cueTime('noon.peak'), full.cueTime('noon.peak') * 0.5);
  near(half.cueTime('noon.flare'), full.cueTime('noon.flare') * 0.5);
  assert.equal(half.segments[2].title, 'Noon');
  assert.deepEqual(half.segments[2].acts, ['open the filter', 'play slowly']);
});

test('a derived cut can be derived again, and the scale multiplies', () => {
  const s = new Score({ cuts: [FULL, SHORT, { id: 'tiny', from: 'short', scale: 0.5 }], cut: 'tiny' });
  assert.equal(s.scale, 0.25);
  near(s.total, 25);
  assert.equal(s.base, 'full');
});

test('segmentAt / indexAt: a segment owns [start, end); outside the show it clamps', () => {
  const s = mk();
  assert.equal(s.indexAt(0), 0);
  assert.equal(s.indexAt(4.999), 0);
  assert.equal(s.indexAt(5), 1);                     // the boundary belongs to the segment that starts there
  assert.equal(s.segmentAt(54.9).id, 'noon');
  assert.equal(s.segmentAt(55).id, 'dusk');
  assert.equal(s.indexAt(-3), 0);
  assert.equal(s.indexAt(100), 4);
  assert.equal(s.segmentAt(1e9).id, 'night');
  assert.equal(s.indexAt(NaN), 0);
});

test('cueTime: segment start, .end, ratio cues and { s } cues; NaN for anything unknown', () => {
  const s = mk();
  assert.equal(s.cueTime('dusk'), 55);
  assert.equal(s.cueTime('dusk.end'), 75);
  assert.equal(s.cueTime('dawn.rise'), 5 + 0.25 * 20);
  assert.equal(s.cueTime('noon.flare'), 25 + 6);
  assert.ok(Number.isNaN(s.cueTime('dusk.nope')));
  assert.ok(Number.isNaN(s.cueTime('nowhere')));
  assert.ok(Number.isNaN(s.cueTime(undefined)));
});

test('cuesBetween (T0, T1]: in time order, a cue on the edge belongs to exactly one window', () => {
  const s = mk();
  assert.deepEqual(s.cuesBetween(0, 100).map((c) => c.name), ['standby.breathe', 'dawn.rise', 'noon.flare', 'noon.peak', 'dusk.glow', 'night.stars']);
  assert.deepEqual(s.cuesBetween(10, 10), []);
  assert.deepEqual(s.cuesBetween(50, 10), [], 'going backwards passes nothing');
  const edge = s.cueTime('dawn.rise');
  assert.equal(s.cuesBetween(edge - 1, edge).length, 1);
  assert.equal(s.cuesBetween(edge, edge + 1).length, 0);
});

test('scenes(): the table in the shape @openav/timeline reads', () => {
  const sc = mk().scenes();
  assert.equal(sc.length, 5);
  assert.deepEqual([sc[2].id, sc[2].t, sc[2].title, sc[2].acts], ['noon', 25, 'Noon', ['open the filter', 'play slowly']]);
  assert.equal(sc[0].hold, true);
  assert.deepEqual(sc[2].cues.map((c) => [c.name, c.t]), [['flare', 31], ['peak', 40]]);
});

// ───────────── validate: a broken cut is caught, with a message that says what and where ─────────────

const bad = (cuts, cut) => { try { new Score({ cuts, cut }); } catch (e) { return e; } return null; };
const seg = (o) => ({ id: 'a', dur: 1, ...o });

test('validate: duplicate ids, dur ≤ 0, unknown from, scale ≤ 0 each throw a ScoreError that names the problem', () => {
  let e = bad([{ id: 'x', segments: [seg({ id: 'a' }), seg({ id: 'a' })] }]);
  assert.ok(e instanceof ScoreError);
  assert.match(e.message, /id "a" is used twice/);
  e = bad([{ id: 'x', segments: [seg({ dur: 0 })] }]);
  assert.match(e.message, /dur must be a number > 0/);
  e = bad([{ id: 'x', segments: [seg({ dur: -3 })] }]);
  assert.match(e.message, /dur must be a number > 0 \(got -3\)/);
  e = bad([{ id: 'x', segments: [seg()] }, { id: 'y', from: 'ghost', scale: 1 }]);
  assert.match(e.message, /from "ghost" is not a cut/);
  e = bad([{ id: 'x', segments: [seg()] }, { id: 'y', from: 'x', scale: 0 }]);
  assert.match(e.message, /scale must be a number > 0/);
  e = bad([{ id: 'x', segments: [seg()] }, { id: 'y', from: 'x', scale: -2 }]);
  assert.match(e.message, /scale must be a number > 0/);
  e = bad([{ id: 'x', segments: [seg()] }, { id: 'y', from: 'x' }]);
  assert.match(e.message, /scale must be a number > 0/);
});

test('validate: also duplicate cut ids, cycles, bad cues, bad acts, a cut that does not exist; all problems listed together', () => {
  assert.match(bad([{ id: 'x', segments: [seg()] }, { id: 'x', segments: [seg()] }]).message, /cut id "x" is used twice/);
  assert.match(bad([{ id: 'p', from: 'q', scale: 1 }, { id: 'q', from: 'p', scale: 1 }]).message, /derived from itself/);
  assert.match(bad([{ id: 'x', segments: [seg({ cues: { c: 1.5 } })] }]).message, /ratio must be 0 ≤ r < 1/);
  assert.match(bad([{ id: 'x', segments: [seg({ cues: { c: { s: 99 } } })] }]).message, /outside the segment/);
  assert.match(bad([{ id: 'x', segments: [seg({ cues: { end: 0.5 } })] }]).message, /not "end"/);
  assert.match(bad([{ id: 'x', segments: [seg({ acts: 'do this' })] }]).message, /acts must be an array of strings/);
  assert.match(bad([{ id: 'x', segments: [seg({ id: 'a.b' })] }]).message, /without "\."/);
  assert.match(bad([{ id: 'x', segments: [seg()] }], 'nope').message, /cut "nope" is not one of the cuts: x/);
  assert.match(bad([]).message, /no cuts/);
  const many = bad([{ id: 'x', segments: [seg({ dur: 0 }), seg({ id: 'b', dur: -1 })] }]);
  assert.equal(many.problems.length, 2);
});

test('validate(): a score that built is sound and says so', () => {
  assert.equal(mk().validate(), true);
});

// ───────────── director: modules enter, update, exit ─────────────

test('every module enters once and exits once over a whole show; update runs every frame in between', () => {
  const s = mk();
  const mods = s.segments.map((g) => recorder(g.id));
  const d = new Director({ score: s, modules: mods });
  run(d, 0, s.total);
  for (const m of mods) {
    const kinds = m.log.map((x) => x[0]);
    if (m.id === 'night') { assert.equal(kinds.filter((k) => k === 'enter').length, 1); assert.equal(kinds.filter((k) => k === 'exit').length, 0, 'the last segment stays up at the end of the show'); continue; }
    assert.equal(kinds.filter((k) => k === 'enter').length, 1, m.id + ' enter');
    assert.equal(kinds.filter((k) => k === 'exit').length, 1, m.id + ' exit');
    assert.equal(kinds[0], 'enter');
    assert.equal(kinds.at(-1), 'exit');
    assert.ok(kinds.filter((k) => k === 'update').length > 10, m.id + ' updated every frame');
  }
});

test('seeking into the middle of a segment: enter is called with the right p, not 0', () => {
  const s = mk();
  const noon = recorder('noon');
  const d = new Director({ score: s, modules: [noon] });
  d.seek(40);                                        // the middle of noon (25..55) = p 0.5
  d.update(40, 1 / 60);
  assert.deepEqual(noon.log[0], ['enter', 0.5, 'active']);
  assert.deepEqual(noon.log[1], ['update', 0.5, 'active']);
});

test('without a seek() call, a big jump in T is also treated as a seek (and enter still gets the right p)', () => {
  const s = mk();
  const noon = recorder('noon');
  const seen = [];
  const d = new Director({ score: s, modules: [noon], onCue: (c) => seen.push(c.name) });
  d.update(1, 1 / 60); d.update(40, 1 / 60);
  assert.deepEqual(noon.log[0], ['enter', 0.5, 'active']);
  assert.deepEqual(seen, [], 'the cues between 1 s and 40 s were jumped over, not passed');
});

test('seek out of a segment exits it at once; seek back in enters it again', () => {
  const s = mk();
  const noon = recorder('noon');
  const d = new Director({ score: s, modules: [noon] });
  run(d, 26, 30);
  d.seek(3);
  assert.equal(noon.log.at(-1)[0], 'exit');
  d.update(3, 1 / 60);
  d.seek(28); d.update(28, 1 / 60);
  assert.equal(noon.log.filter((x) => x[0] === 'enter').length, 2);
});

test('linger: the module keeps getting update() after the segment ends, with p > 1 and phase "linger", then exits', () => {
  const s = mk();
  const dusk = recorder('dusk');
  const d = new Director({ score: s, modules: [dusk] });
  run(d, 50, 90);
  const lingerUpdates = dusk.log.filter((x) => x[0] === 'update' && x[2] === 'linger');
  assert.ok(lingerUpdates.length > 20, 'updates during the tail');
  assert.ok(lingerUpdates.every((x) => x[1] > 1 && x[1] <= 1.2 + 1e-9), 'p in (1, 1 + linger/dur]');
  // night starts at 75 but dusk lives to 79
  const exitAt = dusk.log.findIndex((x) => x[0] === 'exit');
  assert.ok(exitAt > 0);
  assert.equal(dusk.log.filter((x) => x[0] === 'exit').length, 1);
  assert.ok(dusk.log[exitAt][1] >= 1.2 - 0.05, 'exit only after the whole tail');
});

test('two modules overlap during a linger: the next segment starts while the last one is still tailing', () => {
  const s = mk();
  const dusk = recorder('dusk'), night = recorder('night');
  let both = 0;
  dusk.update = (api, c) => { if (night.log.some((x) => x[0] === 'enter') && !night.log.some((x) => x[0] === 'exit')) both++; };
  const d = new Director({ score: s, modules: [dusk, night] });
  run(d, 70, 85);
  assert.ok(both > 10);
});

test('ctx carries p, t, dt, dur, T, segment and a working cue(name)', () => {
  const s = mk();
  let seen = null;
  const noon = { id: 'noon', update: (api, c) => { seen ||= c; } };
  new Director({ score: s, modules: [noon] }).update(40, 0.02);
  assert.equal(seen.p, 0.5); near(seen.t, 15); assert.equal(seen.dt, 0.02); assert.equal(seen.dur, 30); assert.equal(seen.T, 40);
  assert.equal(seen.segment.id, 'noon');
  assert.equal(seen.cue('peak'), 0.5, 'cue() answers as a progress to compare with p');
  near(seen.cue('flare'), 6 / 30);
  assert.equal(seen.cue('noon.peak'), 0.5, 'a full name works too');
  near(seen.cue('dusk.glow'), (s.cueTime('dusk.glow') - 25) / 30, 1e-9);
  assert.equal(seen.cueT('peak'), 40);
  assert.ok(Number.isNaN(seen.cue('missing')));
});

test('the api object reaches every hook; a function api is called once, when first needed', () => {
  const s = mk();
  let made = 0, got = null;
  const d = new Director({ score: s, api: () => { made++; return { hello: 1 }; }, modules: [{ id: 'dawn', enter: (api) => { got = api; }, update() {} }] });
  assert.equal(made, 0);
  run(d, 6, 8);
  assert.deepEqual(got, { hello: 1 });
  assert.equal(made, 1);
});

// ───────────── director: a module that throws is switched off; the show goes on ─────────────

test('a module that throws is switched off alone: one console.error, the others keep running', () => {
  const s = mk();
  const dawn = recorder('dawn'), noon = recorder('noon', { update() { throw new Error('boom'); } }), dusk = recorder('dusk');
  const d = new Director({ score: s, modules: [dawn, noon, dusk] });
  const errs = quiet(() => run(d, 0, s.total));
  assert.equal(errs.length, 1, 'printed exactly once, not once per frame');
  assert.match(String(errs[0][0]), /"noon" crashed in update: boom/);
  assert.deepEqual(d.status().failed, ['noon']);
  assert.match(d.status().errors.noon, /update: boom/);
  assert.ok(dawn.log.some((x) => x[0] === 'exit'), 'earlier module ran to its end');
  assert.ok(dusk.log.filter((x) => x[0] === 'update').length > 100, 'later module still ran');
  assert.equal(noon.log.filter((x) => x[0] === 'exit').length, 1, 'the crashed module is given one exit() to clean up');
  assert.equal(noon.log.at(-1)[2], 'failed');
});

test('enter and exit and param that throw also disable only that module', () => {
  const s = mk();
  for (const fn of ['enter', 'exit', 'param']) {
    const m = recorder('noon', { [fn]() { throw new Error('x'); } });
    const other = recorder('dusk');
    const d = new Director({ score: s, modules: [m, other] });
    quiet(() => { run(d, 20, 62); d.seek(40); d.update(40, 1 / 60); d.param('anything', 0, 40); });
    assert.deepEqual(d.status().failed, ['noon'], fn);
    assert.ok(other.log.some((x) => x[0] === 'update'), fn + ': the other module is fine');
  }
});

test('a module whose exit() throws while being disabled does not throw again', () => {
  const s = mk();
  const m = { id: 'noon', update() { throw new Error('a'); }, exit() { throw new Error('b'); } };
  const d = new Director({ score: s, modules: [m] });
  const errs = quiet(() => assert.doesNotThrow(() => run(d, 24, 30)));
  assert.equal(errs.length, 1);
});

test('reset() brings a switched-off module back and forgets everything', () => {
  const s = mk();
  let calls = 0;
  const noon = recorder('noon', { update() { calls++; if (calls === 1) throw new Error('once'); }, reset(api) { noon.log.push(['reset']); } });
  const d = new Director({ score: s, modules: [noon] });
  quiet(() => run(d, 30, 32));
  assert.deepEqual(d.status().failed, ['noon']);
  d.reset();
  assert.deepEqual(d.status().failed, []);
  assert.ok(noon.log.some((x) => x[0] === 'reset'));
  run(d, 30, 32);
  assert.ok(calls > 3, 'it runs again after reset');
  assert.deepEqual(d.status().failed, []);
});

test('reset() exits the active modules and the next frame at the start enters from p 0', () => {
  const s = mk();
  const standby = recorder('standby');
  const d = new Director({ score: s, modules: [standby] });
  run(d, 0, 2);
  d.reset();
  assert.equal(standby.log.filter((x) => x[0] === 'exit').length, 1);
  d.update(0, 1 / 60);
  assert.deepEqual(standby.log.filter((x) => x[0] === 'enter').at(-1), ['enter', 0, 'active']);
});

// ───────────── director: param layer ─────────────

test('param(): only the modules of the current segments rewrite a value; outside them the value is untouched', () => {
  const s = mk();
  const noon = { id: 'noon', param: (k, v, c) => (k === 'glow' ? v + c.p : v) };
  const d = new Director({ score: s, modules: [noon] });
  d.update(10, 1 / 60);
  assert.equal(d.param('glow', 0.25, 10), 0.25, 'dawn: noon is not current');
  d.update(40, 1 / 60);
  assert.equal(d.param('glow', 0.25, 40), 0.75, 'noon at p 0.5');
  assert.equal(d.param('other', 0.25, 40), 0.25);
  d.update(80, 1 / 60);
  assert.equal(d.param('glow', 0.25, 80), 0.25, 'night: back to the original value');
});

test('param(): a non-number answer is ignored; the timeline layer + a performer override still wins', () => {
  const s = mk();
  const noon = { id: 'noon', param: (k, v) => (k === 'a' ? 0.9 : k === 'b' ? 'nope' : undefined) };
  const d = new Director({ score: s, modules: [noon] });
  d.update(40, 1 / 60);
  const tl = new Timeline({ params: [{ key: 'a', min: 0, max: 1, def: 0.1 }, { key: 'b', min: 0, max: 1, def: 0.2 }], score: s });
  tl.layer = (k, v, t) => d.param(k, v, t);
  const base = tl.state(40);
  assert.deepEqual(base, { a: 0.9, b: 0.2 });
});

// ───────────── director: cues ─────────────

test('cues fire once each, in order, over a whole show', () => {
  const s = mk();
  const seen = [];
  const d = new Director({ score: s, onCue: (c) => seen.push(c.name) });
  run(d, 0, s.total, 1 / 60);
  assert.deepEqual(seen, ['standby.breathe', 'dawn.rise', 'noon.flare', 'noon.peak', 'dusk.glow', 'night.stars']);
});

test('a cue sitting exactly on the start of the show fires on the first frame', () => {
  const s = new Score({ cuts: [{ id: 'x', segments: [{ id: 'a', dur: 10, cues: { zero: 0 } }] }] });
  const seen = [];
  const d = new Director({ score: s, onCue: (c) => seen.push(c.name) });
  d.update(0, 1 / 60);
  assert.deepEqual(seen, ['a.zero']);
});

test('seeking past cues does not fire them; playing back over them again does', () => {
  const s = mk();
  const seen = [];
  const d = new Director({ score: s, onCue: (c) => seen.push(c.name), maxStep: Infinity });   // no jump heuristic: only the explicit seek() can tell
  d.update(1, 1 / 60);
  d.seek(60); d.update(60, 1 / 60);
  assert.deepEqual(seen, [], 'seek skipped dawn.rise … dusk.glow');
  d.seek(30); d.update(30, 1 / 60); run(d, 30, 45);
  assert.deepEqual(seen, ['noon.flare', 'noon.peak']);
});

test('a module with a cue() hook hears the cues of its own segment', () => {
  const s = mk();
  const heard = [];
  const noon = { id: 'noon', cue: (name, c) => heard.push([name, +c.p.toFixed(2)]) };
  const dawn = { id: 'dawn', cue: (name) => heard.push(['dawn:' + name]) };
  run(new Director({ score: s, modules: [dawn, noon] }), 20, 45);
  assert.deepEqual(heard, [['dawn:rise'], ['flare', 0.2], ['peak', 0.5]].filter((x) => x[0] !== 'dawn:rise'));
});

// ───────────── hold: the timeline waits at the end of the segment until released ─────────────

function holdTimeline() {
  const s = mk();
  return { s, tl: new Timeline({ params: [], score: s }) };
}
const play = (tl, seconds, dt = 1 / 30) => { for (let t = 0; t < seconds; t += dt) tl.advance(dt); };

test('hold: playback stops at the end of the hold segment and stays there however long it is left', () => {
  const { tl } = holdTimeline();
  tl.play();
  play(tl, 5.5);
  assert.equal(tl.holding, true);
  assert.equal(tl.playing, false);
  assert.ok(tl.t < 5 && tl.t > 5 - 1e-3, 'parked just before the boundary, still inside the hold segment');
  assert.equal(tl.currentScene().id, 'standby');
  const t0 = tl.t;
  play(tl, 60);
  assert.equal(tl.t, t0, 'it does not creep on');
});

test('hold: play (Space), next (→) release it; the show continues into the next segment, playing', () => {
  for (const release of [(tl) => tl.play(), (tl) => tl.toggle(), (tl) => tl.next(), (tl) => tl.release()]) {
    const { tl } = holdTimeline();
    tl.play(); play(tl, 6);
    assert.equal(tl.holding, true);
    release(tl);
    assert.equal(tl.holding, false);
    assert.equal(tl.playing, true);
    assert.equal(tl.currentScene().id, 'dawn');
    assert.equal(tl.t, 5);
    play(tl, 2);
    assert.ok(tl.t > 6.9 && tl.holding === false);
  }
});

test('hold: a seek past it does not stop; a seek away clears it; only the end of a hold segment holds', () => {
  const { tl } = holdTimeline();
  tl.play(); play(tl, 6);
  tl.seek(30);
  assert.equal(tl.holding, false);
  tl.play();
  play(tl, 3);
  assert.equal(tl.holding, false);
  assert.ok(tl.t > 30);
  tl.seek(0); tl.play(); play(tl, 6);
  assert.equal(tl.holding, true, 'back at the start it holds again');
});

test('hold: a long frame that jumps over the boundary still stops at it', () => {
  const { tl } = holdTimeline();
  tl.seek(4.9); tl.play();
  tl.advance(3);
  assert.equal(tl.holding, true);
  assert.equal(tl.currentScene().id, 'standby');
});

test('hold: the director sees ctx.holding, p = 1 and a growing ctx.held while waiting; status() says so', () => {
  const { s, tl } = holdTimeline();
  const seen = [];
  const standby = { id: 'standby', update: (api, c) => seen.push([c.holding, c.p, c.held]) };
  const d = new Director({ score: s, modules: [standby] });
  tl.play();
  for (let i = 0; i < 400; i++) { tl.advance(1 / 30); d.update(tl.t, 1 / 30, { holding: tl.holding, playing: tl.playing }); }
  const waiting = seen.filter((x) => x[0]);
  assert.ok(waiting.length > 100);
  assert.ok(waiting.every((x) => x[1] === 1));
  assert.ok(waiting.at(-1)[2] > waiting[0][2], 'held counts up');
  assert.equal(seen.filter((x) => !x[0]).every((x) => x[2] === 0), true);
  const st = d.status();
  assert.equal(st.holding, true);
  assert.equal(st.segment.id, 'standby');
  assert.equal(st.next.id, 'dawn');
  assert.equal(st.next.in, 0);
  // released: the next segment starts, and the held module exits
  tl.release(); d.update(tl.t, 1 / 30, { holding: false, playing: true });
  assert.equal(d.status().holding, false);
  assert.equal(d.status().segment.id, 'dawn');
});

test('hold: a score with no hold never stops by itself', () => {
  const s = new Score({ cuts: [{ id: 'x', segments: [{ id: 'a', dur: 3 }, { id: 'b', dur: 3 }] }] });
  const tl = new Timeline({ params: [], score: s });
  tl.play(); play(tl, 7);
  assert.equal(tl.holding, false);
  assert.equal(tl.t, 6);
  assert.equal(tl.playing, false, 'ended at the total');
});

// ───────────── status ─────────────

test('status(): current segment, next segment and its countdown, active and failed modules', () => {
  const s = mk();
  const d = new Director({ score: s, modules: [recorder('noon')] });
  d.update(40, 1 / 60, { playing: true });
  const st = d.status();
  assert.equal(st.cut, 'full');
  assert.equal(st.segment.id, 'noon');
  assert.equal(st.segment.title, 'Noon');
  assert.equal(st.segment.p, 0.5);
  near(st.segment.remaining, 15);
  assert.deepEqual(st.segment.acts, ['open the filter', 'play slowly']);
  assert.equal(st.next.id, 'dusk');
  near(st.next.in, 15);
  assert.deepEqual(st.active, ['noon']);
  assert.deepEqual(st.failed, []);
  d.update(99, 1 / 60);
  assert.equal(d.status().next, null, 'nothing after the last segment');
});

test('onStatus is told when the segment changes, not every frame', () => {
  const s = mk();
  const seen = [];
  const d = new Director({ score: s, onStatus: (st) => seen.push(st.segment.id) });
  run(d, 0, s.total, 1 / 30);
  assert.deepEqual(seen, ['standby', 'dawn', 'noon', 'dusk', 'night']);
});

test('modules can be given as an object keyed by segment id, and a segment may name its module', () => {
  const s = new Score({ cuts: [{ id: 'x', segments: [{ id: 'a', dur: 4, module: 'shared' }, { id: 'b', dur: 4, module: 'shared' }, { id: 'c', dur: 4 }] }] });
  const shared = recorder('shared'), c = recorder('c');
  const d = new Director({ score: s, modules: { shared, c: { update: c.update } } });   // `c` has no id of its own: its key is its id
  run(d, 0, 12);
  assert.equal(shared.log.filter((x) => x[0] === 'enter').length, 2, 'once per segment it performs');
  assert.ok(c.log.some((x) => x[0] === 'update'), 'an object key is the segment id the module performs');
  assert.equal(d.status().missing.length, 0);
  assert.deepEqual(new Director({ score: s }).status().missing, ['shared']);
});

// ───────────── timeline: score-driven, backward compatible ─────────────

test('a Timeline with a score takes its scenes and total from it and starts at the score start', () => {
  const s = mk();
  const tl = new Timeline({ params: [], total: 9999, scenes: [{ id: 'ignored', t: 0 }], score: s });
  assert.equal(tl.total, 100);
  assert.deepEqual(tl.scenes.map((x) => x.id), ['standby', 'dawn', 'noon', 'dusk', 'night']);
  assert.equal(tl.start, 0);
});

test('automation written against the base cut stretches with a derived cut', () => {
  const params = [{ key: 'v', min: 0, max: 100, def: 0 }];
  const automation = { v: [[0, 0], [100, 100]] };                 // written for the 100 s cut
  const full = new Timeline({ params, automation, score: mk() });
  const half = new Timeline({ params, automation, score: mk({ cut: 'short' }) });
  assert.equal(full.valueAt('v', 40), 40);
  assert.equal(half.valueAt('v', 20), 40, '20 s into the 50 s cut = 40 s into the base');
  assert.equal(half.total, 50);
});

test('Timeline.reset() goes to the start the score (or the start option) names', () => {
  const s = new Score({ cuts: [{ id: 'x', start: 'show', segments: [{ id: 'pre', dur: 10 }, { id: 'show', dur: 20 }] }] });
  assert.equal(s.startT, 10);
  const tl = new Timeline({ params: [], score: s });
  assert.equal(tl.t, 10);
  tl.seek(25); tl.reset();
  assert.equal(tl.t, 10);
  assert.equal(new Timeline({ params: [], total: 50, start: -3 }).t, -3);
});
