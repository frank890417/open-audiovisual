// @openav/timeline · curves, loop, cues, recording — the additions, and proof the old format did not move.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Timeline, CURVES } from '../packages/timeline/index.js';

const near = (a, b, e = 1e-9) => assert.ok(Math.abs(a - b) <= e, `${a} !~ ${b}`);
const X = [{ key: 'x', min: 0, max: 100, def: 0 }];
const mk = (opts = {}) => new Timeline({ params: X, total: 40, ...opts });

// ───────────── the curve kinds ─────────────

test('CURVES: linear, ease, in, out, step are exported and hit 0 → 0, 1 → 1 (step: 0 until the end)', () => {
  assert.deepEqual(Object.keys(CURVES).sort(), ['ease', 'in', 'linear', 'out', 'step']);
  for (const k of ['linear', 'ease', 'in', 'out']) { near(CURVES[k](0), 0); near(CURVES[k](1), 1); }
  near(CURVES.linear(0.25), 0.25);
  near(CURVES.ease(0.5), 0.5); near(CURVES.ease(0.25), 0.15625);   // smoothstep
  near(CURVES.in(0.5), 0.25);
  near(CURVES.out(0.5), 0.75);
  assert.equal(CURVES.step(0.999), 0);
});

test('a keyframe\'s third item is the curve of the segment that ENDS at it', () => {
  const at = (kind, t) => mk({ automation: { x: [[0, 0], [10, 100, kind]] } }).valueAt('x', t);
  near(at('linear', 5), 50);
  near(at(undefined, 5), 50);
  near(at('ease', 2.5), 15.625);
  near(at('ease', 5), 50);
  near(at('in', 5), 25);
  near(at('out', 5), 75);
  assert.equal(at('step', 5), 0, 'step holds the old value…');
  assert.equal(at('step', 9.999), 0);
  assert.equal(at('step', 10), 100, '…until the keyframe, then jumps');
});

test('curves land exactly on their keyframes and apply per segment', () => {
  const tl = mk({ automation: { x: [[0, 10], [10, 90, 'in'], [20, 20, 'out'], [30, 60, 'step'], [40, 0, 'ease']] } });
  for (const [t, v] of [[0, 10], [10, 90], [20, 20], [30, 60], [40, 0]]) near(tl.valueAt('x', t), v);
  near(tl.valueAt('x', 15), 90 + (20 - 90) * CURVES.out(0.5));
  assert.equal(tl.valueAt('x', 25), 20);
  near(tl.valueAt('x', 35), 60 + (0 - 60) * CURVES.ease(0.5));
});

test('a custom function can stand in for a curve name; an unknown name is linear (a typo never stops a show)', () => {
  near(mk({ automation: { x: [[0, 0], [10, 100, (f) => f * f * f]] } }).valueAt('x', 5), 12.5);
  near(mk({ automation: { x: [[0, 0], [10, 100, 'wobble']] } }).valueAt('x', 5), 50);
});

test('a `step` param still holds, whatever the curve says', () => {
  const tl = new Timeline({ params: [{ key: 'm', min: 0, max: 3, def: 0, step: 1 }], total: 10, automation: { m: [[0, 0], [10, 3, 'ease']] } });
  assert.equal(tl.valueAt('m', 9.9), 0);
  assert.equal(tl.valueAt('m', 10), 3);
});

// ───────────── the old format: bit for bit what it was ─────────────

// the interpolation exactly as it was before the curves (2ab58a8), kept here as the reference
function legacyValueAt(schema, automation, key, t) {
  const p = schema.find((q) => q.key === key);
  const kf = automation[key];
  if (!kf || !kf.length) return p ? p.def : 0;
  if (t <= kf[0][0]) return kf[0][1];
  if (t >= kf[kf.length - 1][0]) return kf[kf.length - 1][1];
  for (let i = 0; i < kf.length - 1; i++) {
    if (t >= kf[i][0] && t < kf[i + 1][0]) {
      if (p && p.step) return kf[i][1];
      const f = (t - kf[i][0]) / (kf[i + 1][0] - kf[i][0]);
      return kf[i][1] + (kf[i + 1][1] - kf[i][1]) * f;
    }
  }
  return kf[kf.length - 1][1];
}

test('compat: keyframes without a curve give exactly the old numbers (seeded lanes, 2000 probes each)', () => {
  let s = 12345; const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  const schema = [{ key: 'a', min: -5, max: 500, def: 7 }, { key: 'b', min: 0, max: 9, def: 0, step: 1 }, { key: 'c', min: 0, max: 1, def: 0.5 }];
  const automation = {};
  for (const key of ['a', 'b']) {
    let t = rnd() * 3; const kf = [];
    for (let i = 0; i < 12; i++) { kf.push([t, rnd() * 400 - 3]); t += 0.2 + rnd() * 9; }
    automation[key] = kf;
  }
  // an explicit 'linear' is the same as none
  const withLinear = Object.fromEntries(Object.entries(automation).map(([k, kf]) => [k, kf.map(([t, v], i) => (i ? [t, v, 'linear'] : [t, v]))]));
  const tl = new Timeline({ params: schema, total: 200, automation });
  const tlLin = new Timeline({ params: schema, total: 200, automation: withLinear });
  for (const key of ['a', 'b', 'c']) {
    for (let i = 0; i < 2000; i++) {
      const t = -2 + rnd() * 120;
      const want = legacyValueAt(schema, automation, key, t);
      assert.equal(tl.valueAt(key, t), want, `${key}@${t}`);
      assert.equal(tlLin.valueAt(key, t), want, `${key}@${t} (explicit linear)`);
    }
    for (const k of automation[key] || []) assert.equal(tl.valueAt(key, k[0]), legacyValueAt(schema, automation, key, k[0]));
  }
  assert.deepEqual(tl.state(33), Object.fromEntries(schema.map((p) => [p.key, legacyValueAt(schema, automation, p.key, 33)])));
});

test('compat: nothing new happens unless asked — no loop, no cues, no recording, same stop at total', () => {
  const tl = new Timeline({ params: X, total: 10, automation: {}, scenes: [{ id: 'a', t: 0, cues: [{ name: 'boom', t: 2 }] }] });
  assert.equal(tl.loop, false);
  assert.equal(tl.recording, false);
  const seen = []; tl.onSceneChange((i, sc, info) => seen.push([i, info.cause]));
  tl.play();
  for (let i = 0; i < 300; i++) tl.advance(0.1);
  assert.equal(tl.t, 10); assert.equal(tl.playing, false);
  assert.deepEqual(seen, [[0, 'play']]);
});

// ───────────── loop ─────────────

test('loop: true wraps the whole show at total and keeps playing (the overshoot carries over)', () => {
  const tl = mk({ total: 10, loop: true, automation: {}, scenes: [{ id: 'a', t: 0 }, { id: 'b', t: 6 }] });
  const loops = []; tl.onLoop((e) => loops.push([+e.t.toFixed(6), e.from, e.to, e.count]));
  const scenes = []; tl.onSceneChange((i, sc, info) => scenes.push([sc.id, info.cause]));
  tl.seek(9.5); tl.play();
  tl.advance(1);                                  // 9.5 → 10.5 → wraps to 0.5
  near(tl.t, 0.5); assert.equal(tl.playing, true);
  assert.deepEqual(loops, [[0.5, 0, 10, 1]]);
  assert.deepEqual(scenes, [['b', 'seek'], ['a', 'loop']]);
  for (let i = 0; i < 100; i++) tl.advance(0.25);  // 25 s = two and a half more laps
  assert.equal(tl.playing, true);
  assert.equal(loops.length, 3, '0.5 + 25 s = two more wraps');
  tl.loop = false; tl.seek(9.9); tl.advance(1);
  assert.equal(tl.t, 10); assert.equal(tl.playing, false, 'turning loop off restores the stop at total');
});

test('loop: a big dt wraps by modulo, never past the loop range', () => {
  const tl = mk({ total: 10, loop: true, automation: {} });
  tl.play(); tl.advance(27.25);
  near(tl.t, 7.25);
});

test("loop: 'scene' repeats the scene the playhead is in; next() moves the loop on", () => {
  const tl = mk({ total: 30, automation: {}, loop: 'scene', scenes: [{ id: 'a', t: 0 }, { id: 'b', t: 10 }, { id: 'c', t: 20 }] });
  const scenes = []; tl.onSceneChange((i, sc) => scenes.push(sc.id));
  tl.seek(18); tl.play();
  for (let i = 0; i < 40; i++) tl.advance(0.25);  // 10 s of play: 18 → 20 → wraps to 10 → …
  assert.ok(tl.t >= 10 && tl.t < 20, `stayed inside scene b: ${tl.t}`);
  assert.equal(tl.currentScene().id, 'b');
  assert.deepEqual(scenes, ['b'], 'a scene loop is not a scene change');
  tl.next();
  assert.equal(tl.currentScene().id, 'c');
  tl.play();
  for (let i = 0; i < 200; i++) tl.advance(0.25);
  assert.ok(tl.t >= 20 && tl.t < 30, 'now the last scene loops');
  assert.equal(tl.playing, true);
});

test('loop: a scene id and a {from, to} range (seconds or scene ids); playing from outside the range just plays', () => {
  const scenes = [{ id: 'a', t: 0 }, { id: 'b', t: 10 }, { id: 'c', t: 20 }];
  const byId = mk({ total: 30, automation: {}, scenes, loop: 'b' });
  byId.seek(5); byId.play(); byId.advance(7);
  near(byId.t, 12, 1e-9);                          // before the loop: plays through to 12, nothing wrapped
  byId.advance(9);                                 // 12 → 21 → wraps to 11
  near(byId.t, 11);
  const range = mk({ total: 30, automation: {}, scenes, loop: { from: 4, to: 6 } });
  range.seek(5.5); range.play(); range.advance(1);
  near(range.t, 4.5);
  const ids = mk({ total: 30, automation: {}, scenes, loop: { from: 'a', to: 'b' } });   // from the start of a to the end of b
  ids.seek(19); ids.play(); ids.advance(2);
  near(ids.t, 1);
});

test('loop: a hold inside the loop still holds; a loop that ends on a hold keeps looping until the scene is left', () => {
  const sc = [{ id: 'a', t: 0 }, { id: 'b', t: 10, hold: true }, { id: 'c', t: 20 }];
  const whole = mk({ total: 30, automation: {}, scenes: sc, loop: true });
  whole.seek(9); whole.play(); whole.advance(2);
  assert.equal(whole.holding, false, 'the hold is at the END of b (t=20)');
  whole.advance(10);
  assert.equal(whole.holding, true); assert.ok(whole.t < 20);
  const scene = mk({ total: 30, automation: {}, scenes: sc, loop: 'scene' });
  scene.seek(15); scene.play(); scene.advance(6);
  assert.equal(scene.holding, false); near(scene.t, 11);
});

test('loop: the position never leaves [from, to) however it is driven', () => {
  const tl = mk({ total: 10, loop: { from: 2, to: 5 }, automation: {} });
  tl.seek(3); tl.play();
  let s = 7; const rnd = () => ((s = (s * 1103515245 + 12345) >>> 0) / 2 ** 32);
  for (let i = 0; i < 500; i++) { tl.advance(rnd() * 1.7); assert.ok(tl.t >= 2 && tl.t < 5, `t=${tl.t}`); }
});

// ───────────── cues ─────────────

const cueShow = (opts = {}) => new Timeline({
  params: X, total: 40, automation: {}, ...opts,
  scenes: [
    { id: 'a', t: 0 },
    { id: 'b', t: 10, cues: [{ name: 'ripple', t: 12 }, { name: 'ripple', t: 14 }] },
    { id: 'c', t: 20, cues: [{ name: 'flash', t: 20 }, { name: 'flash', t: 25 }] },
  ],
});
const run = (tl, secs, dt = 0.1) => { for (let i = 0, n = Math.round(secs / dt); i < n; i++) tl.advance(dt); };

test('onCue: playing over a cue fires it once, with its name, time and scene', () => {
  const tl = cueShow(); const got = [];
  tl.onCue((c, info) => got.push([c.name, c.t, c.scene, c.sceneIndex, info.cause]));
  tl.play(); run(tl, 30);
  assert.deepEqual(got, [['ripple', 12, 'b', 1, 'play'], ['ripple', 14, 'b', 1, 'play'], ['flash', 20, 'c', 2, 'play'], ['flash', 25, 'c', 2, 'play']]);
  run(tl, 5);                                       // paused at 30 or beyond: nothing again
  assert.equal(got.length, 4);
});

test('onCue: seek, jump, drag (many seeks) and reset do NOT fire; playing on afterwards fires only what comes next', () => {
  const tl = cueShow(); const got = [];
  tl.onCue((c) => got.push(c.t));
  tl.seek(30); tl.seek(5); tl.jumpScene(1); tl.seek(26);
  for (let t = 0; t <= 40; t += 0.5) tl.seek(t);   // a drag over everything
  tl.reset();
  assert.deepEqual(got, []);
  tl.seek(11.9); tl.play(); tl.advance(0.2);
  assert.deepEqual(got, [12]);
});

test('onCue: a cue exactly on the frame boundary fires once, not twice or never (steps of 0.5 over t=12)', () => {
  const tl = cueShow(); const got = [];
  tl.onCue((c) => got.push(c.t));
  tl.seek(10); tl.play(); run(tl, 6, 0.5);
  assert.deepEqual(got, [12, 14]);
});

test('onCue: a cue at t=0 fires on the first play after reset; a big dt fires every cue it crossed, in order', () => {
  const tl = new Timeline({ params: X, total: 20, automation: {}, scenes: [{ id: 'a', t: 0, cues: [{ name: 'go', t: 0 }, { name: 'later', t: 5 }, { name: 'later', t: 6 }] }] });
  const got = []; tl.onCue((c) => got.push([c.name, c.t]));
  tl.play(); tl.advance(7);
  assert.deepEqual(got, [['go', 0], ['later', 5], ['later', 6]]);
});

test('onCue: loop fires the cues again each lap, including one on the loop start; a cue is never fired twice in one lap', () => {
  const tl = new Timeline({ params: X, total: 10, loop: true, automation: {}, scenes: [{ id: 'a', t: 0, cues: [{ name: 'k', t: 0 }, { name: 'k', t: 4 }, { name: 'k', t: 10 }] }] });
  const got = []; tl.onCue((c) => got.push(c.t));
  tl.play(); run(tl, 20.5, 0.25);
  // lap 1: 0 (first play), 4, 10 · lap 2: 0, 4, 10 · lap 3 starts: 0
  assert.deepEqual(got, [0, 4, 10, 0, 4, 10, 0]);
});

test('onCue: not fired while a hold parks the playhead, and a cue on the boundary fires when it is released', () => {
  const tl = new Timeline({ params: X, total: 30, automation: {}, scenes: [{ id: 'a', t: 0, hold: true, cues: [{ name: 'in', t: 8 }] }, { id: 'b', t: 10, cues: [{ name: 'out', t: 10 }, { name: 'out', t: 12 }] }] });
  const got = []; tl.onCue((c) => got.push(c.t));
  tl.play(); run(tl, 15);
  assert.equal(tl.holding, true); assert.deepEqual(got, [8]);
  tl.play();                                         // release
  assert.deepEqual(got, [8, 10]);
  run(tl, 3);
  assert.deepEqual(got, [8, 10, 12]);
});

test('onCue: cues() lists them in time order; fireCue() is the manual trigger (cause "manual"); a throwing handler does not stop the show', () => {
  const tl = cueShow();
  assert.deepEqual(tl.cues().map((c) => [c.name, c.t, c.scene]), [['ripple', 12, 'b'], ['ripple', 14, 'b'], ['flash', 20, 'c'], ['flash', 25, 'c']]);
  const got = []; const errs = []; const orig = console.error; console.error = (...a) => errs.push(a);
  tl.onCue(() => { throw new Error('boom'); });
  tl.onCue((c, info) => got.push([c.t, info.cause]));
  tl.fireCue(tl.cues()[0]);
  tl.seek(11.9); tl.play(); tl.advance(0.2);
  console.error = orig;
  assert.deepEqual(got, [[12, 'manual'], [12, 'play']]);
  assert.equal(errs.length, 2);
});

test('onCue also works as a constructor option', () => {
  const got = [];
  const tl = cueShow({ onCue: (c) => got.push(c.t) });
  tl.seek(24); tl.play(); tl.advance(2);
  assert.deepEqual(got, [25]);
});

// ───────────── recording ─────────────

const REC = [{ key: 'x', min: 0, max: 100, def: 0 }, { key: 'y', min: 0, max: 10, def: 5 }];
const recShow = (automation = {}, opts = {}) => new Timeline({ params: REC, total: 40, automation, ...opts });

test('record(key, source): while playing, source values become keyframes; stop() commits them', () => {
  const tl = recShow({ x: [[0, 0], [40, 0]] });
  let v = null; const done = [];
  tl.onRecord((e) => done.push(e));
  const rec = tl.record('x', () => v);
  assert.equal(tl.recording, true);
  tl.play();
  for (let i = 0; i < 20; i++) { tl.advance(0.1); }       // 0 → 2 with the source idle: nothing recorded
  assert.equal(rec.take.length, 0);
  for (let i = 0; i < 40; i++) { v = 10 + i; tl.advance(0.1); }   // 2 → 6, a rising knob
  assert.ok(rec.take.length > 30);
  rec.stop();
  assert.equal(tl.recording, false);
  assert.equal(done.length, 1);
  assert.equal(done[0].key, 'x'); assert.equal(done[0].cause, 'stop');
  near(done[0].from, 2.1, 1e-6); near(done[0].to, 6, 1e-6);
  near(tl.valueAt('x', 4), 10 + 19.0, 0.5);               // the take now shapes the lane
  near(tl.valueAt('x', 1), 10 * 1 / 2.1, 1e-3);           // before the take: the old keyframe at 0, gliding to the take's first point
  assert.deepEqual(tl.automation.x[0], [0, 0]); assert.deepEqual(tl.automation.x.at(-1), [40, 0]);   // the old ends stay
});

test('record: the source going null closes the take at once; later takes merge too', () => {
  const tl = recShow({}); let v = null; const done = [];
  tl.onRecord((e) => done.push([e.key, e.cause, e.count]));
  tl.record('x', () => v);
  tl.play();
  v = 20; run(tl, 1); v = null; tl.advance(0.1);
  assert.equal(done.length, 1); assert.equal(done[0][1], 'release');
  run(tl, 2);
  v = 80; run(tl, 1); v = 80; tl.advance(0.1); v = null; tl.advance(0.1);
  assert.equal(done.length, 2);
  const kf = tl.automation.x;
  assert.ok(kf.every((k, i) => !i || k[0] > kf[i - 1][0]), 'keyframes stay in ascending time order');
  near(tl.valueAt('x', 0.5), 20); near(tl.valueAt('x', 4.5), 80);
});

test('record: seek, jump, reset and pause close the take (a take never spans a jump); the recorder stays armed', () => {
  const tl = recShow({}); let v = 30; const causes = [];
  tl.onRecord((e) => causes.push(e.cause));
  const rec = tl.record('x', () => v);
  tl.play(); run(tl, 1);
  tl.seek(10); assert.equal(rec.take.length, 0);
  run(tl, 1); tl.pause();
  tl.play(); run(tl, 1); tl.reset();
  assert.deepEqual(causes, ['seek', 'pause', 'reset']);
  assert.equal(tl.recording, true);
});

test('record: a loop wrap closes the take at the end of the lap and the next lap starts a new one', () => {
  const tl = recShow({}, { total: 4, loop: true }); let v = 50; const done = [];
  tl.onRecord((e) => done.push([e.cause, +e.from.toFixed(2), +e.to.toFixed(2)]));
  tl.record('x', () => v);
  tl.seek(3); tl.play(); run(tl, 2.5, 0.25);
  assert.equal(done.length, 1);
  assert.equal(done[0][0], 'loop'); near(done[0][1], 3.25, 0.011); near(done[0][2], 4, 0.011);
  assert.ok(tl.recorders.get('x').take.length >= 1, 'the new lap is already recording');
});

test('record: playing into total stops the show and commits', () => {
  const tl = recShow({}, { total: 3 }); const causes = [];
  tl.onRecord((e) => causes.push(e.cause)); tl.record('x', () => 40);
  tl.play(); run(tl, 4);
  assert.deepEqual(causes, ['end']);
});

test('mergeTake: thins a take, then replaces the keyframes it covered and keeps everything outside', () => {
  const tl = recShow({ x: [[0, 0], [5, 50], [10, 100, 'ease'], [15, 20], [30, 90, 'in']] });
  const take = []; for (let i = 0; i <= 100; i++) take.push([6 + i * 0.05, 30 + i * 0.1]);   // 6 → 11, a gentle ramp
  const r = tl.mergeTake('x', take);
  const kf = tl.automation.x;
  assert.equal(r.from, 6); assert.equal(r.to, 11);
  assert.ok(r.count < 20 && r.count >= 2, `thinned (${r.count})`);
  assert.deepEqual(kf.filter((k) => k[0] < 6), [[0, 0], [5, 50]], 'before: untouched');
  assert.deepEqual(kf.filter((k) => k[0] > 11), [[15, 20], [30, 90, 'in']], 'after: untouched, with its own curve');
  assert.ok(!kf.some((k) => k[0] === 10), 'the old keyframe inside the take is replaced');
  near(tl.valueAt('x', 8.5), 30 + 2.5 * 2, 0.7);
  assert.ok(kf.every((k, i) => !i || k[0] > kf[i - 1][0]));
});

test('mergeTake: a flat knob collapses to two keyframes; fewer than two points writes nothing; epsilon and maxGap are options', () => {
  const tl = recShow({});
  assert.equal(tl.mergeTake('x', [[1, 5]]), null);
  assert.equal(tl.automation.x, undefined);
  const flat = []; for (let i = 0; i <= 100; i++) flat.push([i * 0.004, 40]);
  assert.equal(tl.mergeTake('x', flat).count, 2);
  const tl2 = recShow({});
  const ramp = []; for (let i = 0; i <= 100; i++) ramp.push([i * 0.1, i * 0.4]);
  const coarse = tl2.mergeTake('x', ramp, { epsilon: 10 }).count;
  const fine = recShow({}).mergeTake('x', ramp, { epsilon: 0.01 }).count;
  assert.ok(coarse < fine, `${coarse} < ${fine}`);
  assert.equal(fine, 101);
  const slow = []; for (let i = 0; i <= 20; i++) slow.push([i * 0.1, 40]);   // flat for 2 s: a point every maxGap
  assert.equal(recShow({}).mergeTake('x', slow, { maxGap: 0.5 }).count, 5);
  assert.equal(recShow({}).mergeTake('x', slow, { maxGap: 10 }).count, 2);
});

test('mergeTake: `curve` marks the written keyframes; the default writes plain [t, v] (the old format)', () => {
  const a = recShow({}); a.mergeTake('x', [[0, 0], [1, 10], [2, 30]]);
  assert.ok(a.automation.x.every((k) => k.length === 2), JSON.stringify(a.automation.x));
  const b = recShow({}); b.mergeTake('x', [[0, 0], [1, 10], [2, 30]], { curve: 'ease' });
  assert.ok(b.automation.x.every((k) => k[2] === 'ease'));
});

test('record: a score-time offset — with a score the keyframes are written in the base cut\'s time', () => {
  const score = { total: 20, startT: 0, scenes: () => [{ id: 's', t: 0 }], baseTime: (T) => T / 2 };
  const tl = new Timeline({ params: REC, automation: {}, score });
  tl.record('x', () => 60);
  tl.play(); run(tl, 4); tl.pause();
  const kf = tl.automation.x;
  near(kf[kf.length - 1][0], 2, 0.011);                  // played to T=4 → base time 2
  near(tl.valueAt('x', 3), 60);
});

test('record: arming the same key again replaces the recorder; stopRecording() disarms all; record() validates its input', () => {
  const tl = recShow({});
  const r1 = tl.record('x', () => 1); const r2 = tl.record('x', () => 2);
  assert.equal(tl.recorders.size, 1); assert.notEqual(r1, r2); assert.equal(r1.active, false);
  tl.record('y', () => 3);
  tl.stopRecording();
  assert.equal(tl.recording, false);
  assert.throws(() => tl.record('nope', () => 1), /unknown param/);
  assert.throws(() => tl.record('x', 5), /function/);
});
