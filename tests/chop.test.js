// @openav/chop (values over time: lag, envelope, speed, spring, trail, slope, count) and oav-p5's lag() family on top of it.
// The math is checked with a fake clock: the same curve at 30 fps and at 144 fps. The p5 half runs oav-p5.js in a bare
// context (no document) with p5's frameCount and a performance.now() the test moves; the browser half (p5 1.x / 2.x, the
// scope in the corner, a recording) is p5/test/chop-smoke.cjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as C from '../packages/chop/index.js';
import { Mapper } from '../packages/mapping/index.js';
import { Signals, Params } from '../packages/core/index.js';

const close = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg ?? ''} ${a} ≉ ${b} (±${eps})`);
/** run `fn(t)` once per frame at `fps` for `seconds`, starting at t = 0 (the first call is the frame at 0) → [{ t, v }] */
function run(fps, seconds, fn) {
  const out = [], n = Math.round(seconds * fps), dt = 1 / fps;
  for (let k = 0; k <= n; k++) out.push({ t: k * dt, v: fn(k * dt, k ? dt : 0) });
  return out;
}
/** the value at time t (the frame at or just before it) */
const at = (series, t) => { let v = series[0].v; for (const s of series) { if (s.t <= t + 1e-9) v = s.v; else break; } return v; };

// ---------------------------------------------------------------- the math (packages/chop)

test('approach: the time constant is the time to 63% of a change (the same as @openav/mapping smooth); 0 jumps', () => {
  close(C.approach(0, 1, 0.1, 0.1), 1 - Math.exp(-1), 1e-12, '63% after one time constant');
  close(C.approach(0, 1, 0.1, 0.1 * Math.LN10), 0.9, 1e-12, '90% after 2.3 time constants (TouchDesigner quotes its lag at about 90%)');
  assert.equal(C.approach(0.3, 1, 0, 0.016), 1, 'no lag: at once');
  assert.equal(C.approach(0.3, 1, 0.2, 0), 0.3, 'no time: no change');
  assert.equal(C.TD_LAG_RATIO, Math.LN10);
});

test('Lag: up = 0.1 reaches 90% after 0.1 s at 30, 60, 120 fps (TouchDesigner Lag CHOP seconds); down falls on its own time; the first value is taken as it is', () => {
  for (const fps of [30, 60, 120]) {
    const L = new C.Lag({ up: 0.1, down: 0.4 });
    const s = run(fps, 0.1, (t, dt) => L.step(t === 0 ? 0 : 1, dt));
    close(s.at(-1).v, 0.9, 0.0005, `${fps} fps`);
  }
  const L = new C.Lag({ up: 0.03, down: 0.4 });
  assert.equal(L.step(0.7, 0), 0.7, 'first value: no glide in from 0');
  L.step(0, 0.4);                                       // falling: the down time
  close(L.value, 0.7 * 0.1, 1e-9, 'falls 90% of the way in 0.4 s');
  assert.equal(new C.Lag().step(true, 0), 1, 'a boolean is 0 / 1');
  const k = new C.Lag(); k.step(0.5, 0);
  assert.ok(Number.isNaN(k.step(NaN, 0.1)) && k.value === 0.5, 'a non-number passes through and leaves the memory alone');
});

test('Lag: 30 fps and 144 fps draw the same curve (a knob moved in steps: equal; a 1 Hz sine: within 3%, its sampling)', () => {
  // steps at times both frame rates land on; the value a frame reads is the one held since the frame before (≤: the frame
  // AT the step still reads the old value), which is what a knob turned at that moment looks like to any frame rate
  const knob = (t) => (t <= 1 / 6 + 1e-9 ? 0 : t <= 1 + 1e-9 ? 0.8 : t <= 1.5 + 1e-9 ? 0.2 : 1);
  const a = new C.Lag({ up: 0.05, down: 0.3 }), b = new C.Lag({ up: 0.05, down: 0.3 });
  const s30 = run(30, 2, (t, dt) => a.step(knob(t), dt)), s144 = run(144, 2, (t, dt) => b.step(knob(t), dt));
  let worst = 0;
  for (let t = 0; t <= 2 + 1e-9; t += 1 / 6) worst = Math.max(worst, Math.abs(at(s30, t) - at(s144, t)));
  assert.ok(worst < 1e-9, `steps: worst ${worst}`);
  // TouchDesigner seconds: 0.1 × ln 10 is a time constant of 0.1 s, the speed this sine check was written for
  const c = new C.Lag({ up: 0.1 * Math.LN10, down: 0.1 * Math.LN10 }), d = new C.Lag({ up: 0.1 * Math.LN10, down: 0.1 * Math.LN10 });
  const sine = (t) => 0.5 + 0.5 * Math.sin(2 * Math.PI * t);
  const q30 = run(30, 3, (t, dt) => c.step(sine(t), dt)), q144 = run(144, 3, (t, dt) => d.step(sine(t), dt));
  worst = 0;
  for (let t = 1; t <= 3 + 1e-9; t += 1 / 6) worst = Math.max(worst, Math.abs(at(q30, t) - at(q144, t)));
  // a sketch at 30 fps reads its input only every 33 ms; each step takes the value it reads as the value since the last frame
  // (so a jump answers in the frame it is seen), which on a smooth input is half a frame early: ~3% at 1 Hz, under 1% at 0.25 Hz
  assert.ok(worst < 0.03, `sine: worst ${worst.toFixed(4)} of a 0..1 range`);
});

test('mapping smooth and lag() step with one function (no second copy of the math)', () => {
  const signals = new Signals(), params = new Params([{ key: 'p', min: 0, max: 1, def: 0 }]);
  const m = new Mapper({ signals, params });
  m.addRoute({ source: 'x', target: 'p', smooth: 0.2 });
  signals.set('x', 1);
  m.update(0.05); m.update(0.05);
  close(params.overrides.p, C.approach(C.approach(0, 1, 0.2, 0.05), 1, 0.2, 0.05), 1e-15);
  assert.match(readFileSync(new URL('../packages/mapping/index.js', import.meta.url), 'utf8'), /import \{ approach \} from '\.\.\/chop\/index\.js/);
});

test('envelope (Trigger): a straight attack to 1, a fall to 0 in exactly `decay`; a retrigger starts where it is', () => {
  assert.equal(C.envelope([], 1), 0);
  assert.equal(C.envelope([2], 1), 0, 'an event that has not happened yet');
  close(C.envelope([0], 0.005, 0.01, 0.3), 0.5, 1e-12, 'halfway up the attack');
  close(C.envelope([0], 0.01, 0.01, 0.3), 1, 1e-12, 'the peak at the end of the attack');
  close(C.envelope([0], 0.16, 0.01, 0.3), 0.25, 1e-12, 'halfway down: (1 − ½)² = ¼');
  assert.equal(C.envelope([0], 0.311, 0.01, 0.3), 0, 'at 0 after attack + decay');
  const before = C.envelope([0], 0.1, 0.01, 0.3);
  close(C.envelope([0, 0.1], 0.1, 0.01, 0.3), before, 1e-12, 'a retrigger does not drop to 0 first');
  close(C.envelope([0, 0.1], 0.1 + 0.01 * (1 - before), 0.01, 0.3), 1, 1e-9, '…and climbs the rest of the attack (attack is 0 → peak)');
  assert.equal(C.envelope([0], 0, 0, 0.3), 1, 'no attack: 1 at once');
  // a pure function of time: whatever the frame rate, the frames that land on the same time read the same value
  const kicks = [0.5, 1, 1.5, 1.625, 2];
  const e30 = run(30, 2.5, (t) => C.envelope(kicks, t, 0.01, 0.3)), e144 = run(144, 2.5, (t) => C.envelope(kicks, t, 0.01, 0.3));
  for (let t = 0; t <= 2.5; t += 1 / 6) close(at(e30, t), at(e144, t), 1e-9);
});

test('Speed: adds rate per second, the same at 30 and 144 fps', () => {
  for (const fps of [30, 144]) { const s = new C.Speed(); const r = run(fps, 1.5, (t, dt) => s.step(2, dt)); close(r.at(-1).v, 3, 1e-9, `${fps} fps`); }
  const s = new C.Speed({ value: 1 }); s.step(true, 0.5); assert.equal(s.value, 1.5, 'a boolean rate: 1 per second while true');
});

test('Spring: overshoots and settles; critical damping never overshoots; 30 = 144 fps; a 10 s step lands on the target', () => {
  const a = new C.Spring(), b = new C.Spring();
  const target = (t) => (t <= 1 / 6 + 1e-9 ? 0 : 1);
  const s30 = run(30, 3, (t, dt) => a.step(target(t), dt)), s144 = run(144, 3, (t, dt) => b.step(target(t), dt));
  let worst = 0, peak = 0;
  for (let t = 0; t <= 3 + 1e-9; t += 1 / 6) worst = Math.max(worst, Math.abs(at(s30, t) - at(s144, t)));
  for (const p of s144) peak = Math.max(peak, p.v);
  assert.ok(worst < 1e-9, `frame rates: worst ${worst}`);
  assert.ok(peak > 1.2 && peak < 1.5, `overshoots (defaults 100 / 6): ${peak.toFixed(3)}`);
  close(s144.at(-1).v, 1, 0.02, 'settled after ~3 s');
  const crit = new C.Spring({ stiffness: 100, damping: 20 }); crit.step(0, 0);
  const c = run(144, 3, (t, dt) => crit.step(1, dt));
  assert.ok(c.every((p) => p.v <= 1 + 1e-9), 'damping = 2√stiffness: no overshoot');
  const over = new C.Spring({ stiffness: 100, damping: 60 }); over.step(0, 0);
  assert.ok(over.step(1, 0.5) > 0 && over.value < 1, 'over-damped: creeps');
  const far = new C.Spring(); far.step(0, 0);
  close(far.step(1, 10), 1, 1e-6, 'a long gap: settled, never blown up');
  const [x, v] = C.springStep(0, 0, 1, 0, 0, 1); assert.deepEqual([x, v], [0, 0], 'no spring, no push: stays');
});

test('Trail: a fixed length from the first step (60 a second + the newest), the newest last, the same at 30 and 144 fps', () => {
  const t1 = new C.Trail({ seconds: 2 });
  const first = t1.step(0.3, 0);
  assert.equal(first.length, 121); assert.ok(first.every((v) => v === 0.3), 'filled with the first value');
  assert.equal(t1.step(0.9, 1 / 60).at(-1), 0.9, 'the newest value is the input');
  const sine = (t) => Math.sin(2 * Math.PI * 0.5 * t);
  const a = new C.Trail({ seconds: 1 }), b = new C.Trail({ seconds: 1 });
  let A, B;
  run(30, 2, (t, dt) => (A = a.step(sine(t), dt))); run(144, 2, (t, dt) => (B = b.step(sine(t), dt)));
  assert.equal(A.length, B.length);
  let worst = 0; for (let i = 0; i < A.length; i++) worst = Math.max(worst, Math.abs(A[i] - B[i]));
  assert.ok(worst < 0.01 * 2, `within 1% of the −1..1 range: ${worst.toFixed(4)}`);
  const r = new C.Trail({ seconds: 1 }); r.step(0, 0); for (let i = 1; i <= 60; i++) r.step(i / 60, 1 / 60);
  const shorter = r.step(1, 0, 0.5);
  assert.equal(shorter.length, 31, 'seconds changed: the newest half second kept');
  close(shorter[0], 0.5, 0.02);
  assert.equal(new C.Trail({ seconds: 1 }).step(1, 0).length, 61);
  const g = new C.Trail({ seconds: 1 }); g.step(0, 0);
  assert.ok(g.step(1, 5).every((v) => v === 1), 'a gap longer than the window: only the new value');
});

test('Slope: change per second, 0 on the first step, the same at 30 and 144 fps; Count: turns on, loops with a limit', () => {
  for (const fps of [30, 144]) { const s = new C.Slope(); const r = run(fps, 1, (t, dt) => s.step(3 * t, dt)); close(r.at(-1).v, 3, 1e-9, `${fps} fps`); }
  assert.equal(new C.Slope().step(5, 0.1), 0);
  const c = new C.Count();
  const seq = [false, true, true, false, true, 0.2, 0.9, 0.9, 0, 1].map((x) => c.step(x));
  assert.deepEqual(seq, [0, 1, 1, 1, 2, 2, 3, 3, 3, 4]);
  const loop = new C.Count(); const l = [];
  for (let i = 0; i < 6; i++) { loop.step(false, 4); l.push(loop.step(true, 4)); }
  assert.deepEqual(l, [1, 2, 3, 0, 1, 2]);
  assert.equal(C.wrapCount(7, 0), 7); assert.equal(C.wrapCount(-1, 4), 3);
});

// ---------------------------------------------------------------- oav-p5's lag() family
const SRC = readFileSync(new URL(process.env.OAV_P5_FILE || '../p5/oav-p5.js', import.meta.url), 'utf8');
const NAMES = ['lag', 'env', 'trigger', 'speed', 'spring', 'trail', 'slope', 'count', 'scope', 'drawTrail'];
const settle = async () => { for (let i = 0; i < 20; i++) await new Promise((r) => setTimeout(r, 0)); };

/** a page with p5's frameCount and a clock the test moves; @openav/chop from this checkout, anything else refused */
function page(globals = {}) {
  const clock = { ms: 1000 };
  const win = { console: { info() {}, warn() {}, error() {} }, navigator: {}, location: { search: '' }, URL, URLSearchParams, Promise,
    setTimeout, clearTimeout, setInterval, clearInterval, performance: { now: () => clock.ms }, ...globals };
  win.window = win; win.globalThis = win;
  vm.runInNewContext(SRC, win);
  const loaded = [];
  if (win.OAVp5) win.OAVp5._import = (url) => { loaded.push(url); return url.includes('packages/chop/index.js') ? import('../packages/chop/index.js') : Promise.reject(new Error('not here: ' + url)); };
  /** one p5 frame: frameCount + 1, the clock + 1/fps, then the sketch's draw */
  const frame = (fps, draw) => { win.frameCount = (win.frameCount || 0) + 1; clock.ms += 1000 / fps; return draw(); };
  return { w: win, clock, loaded, frame };
}
/** the module is fetched on the first call: one call, then wait for it */
async function ready(p) { p.frame(60, () => p.w.lag(0)); await settle(); assert.equal(p.w.OAVp5.chop.state, 'on'); p.w.OAVp5.chop.reset(); }

test('0.7.0: the names are there and are no p5 / p5.sound names; a sketch that calls none of them loads nothing', async () => {
  const p = page();
  assert.equal(p.w.OAVp5.version, '0.7.0');
  for (const n of NAMES) assert.equal(typeof p.w[n], 'function', n);
  // checked against p5 1.11.11, 2.0.5, 2.3.4 and p5.sound 1.x / 0.4.1 in a browser by p5/test/chop-smoke.cjs; these by hand
  const p5ish = ['lerp', 'map', 'constrain', 'noise', 'random', 'frameRate', 'deltaTime', 'Env', 'Envelope', 'Amplitude', 'FFT', 'getAudioContext', 'userStartAudio', 'loadSound'];
  for (const n of NAMES) assert.ok(!p5ish.includes(n), n);
  p.frame(60, () => { p.w.midi.play(60, 1); p.w.OAVp5.drums._hit('kick', 1); });
  await settle();
  assert.deepEqual(p.loaded, [], 'nothing loads');
  assert.equal(p.w.OAVp5.chop.state, 'off');
});

test("0.7.0: a sketch's own speed / count / trail / env is left alone; OAVp5.chop.speed is still there", () => {
  const p = page({ speed: 3, count: 0, trail: () => 'mine', env: 'x' });
  assert.equal(p.w.speed, 3); assert.equal(p.w.count, 0); assert.equal(p.w.trail(), 'mine'); assert.equal(p.w.env, 'x');
  assert.equal(typeof p.w.OAVp5.chop.speed, 'function');
  assert.equal(typeof p.w.lag, 'function');
});

test('lag(): returns its input until @openav/chop arrives, then rises in `up` and falls in `down` seconds — 30 fps = 144 fps', async () => {
  const p = page();
  assert.equal(p.frame(60, () => p.w.lag(0.7, 0.1, 0.4)), 0.7, 'not loaded yet: as it is');
  assert.equal(p.w.OAVp5.chop.state, 'loading');
  await settle();
  assert.ok(p.loaded[0].endsWith('packages/chop/index.js?v=p5-0.7.0'), p.loaded[0]);
  const curve = (fps) => {
    const q = page(); q.w.OAVp5.chop.module = p.w.OAVp5.chop.module;   // the same module, no wait
    const input = (t) => (t <= 0.5 + 1e-9 ? 0 : t <= 1.5 + 1e-9 ? 1 : 0);
    const out = [];
    for (let k = 0; k <= 2 * fps; k++) { const t = k / fps; out.push({ t, v: q.frame(fps, () => q.w.lag(input(t), 0.1, 0.4)) }); }
    return out;
  };
  const a = curve(30), b = curve(144);
  for (const s of [a, b]) {                             // times both frame rates have a frame at
    // TouchDesigner seconds: the time constant is seconds ÷ ln 10
    close(at(s, 0.5 + 1 / 6), 1 - Math.exp(-(1 / 6) / (0.1 / Math.LN10)), 1e-6, 'up 0.1: rising from the step at 0.5');
    close(at(s, 1.5 + 1 / 3), (1 - Math.exp(-10 * Math.LN10)) * Math.exp(-(1 / 3) / (0.4 / Math.LN10)), 1e-6, 'down 0.4: falling from the step at 1.5');
  }
  let worst = 0; for (let t = 0; t <= 2; t += 1 / 6) worst = Math.max(worst, Math.abs(at(a, t) - at(b, t)));
  assert.ok(worst < 0.01, `30 vs 144 fps: ${worst}`);
});

test('immediate mode: the Nth unnamed call is the Nth slot every frame, each kind counted on its own; a name is its own slot', async () => {
  const p = page(); await ready(p);
  const draw = () => [p.w.lag(1, 0.1), p.w.spring(5), p.w.lag(0, 0.1), p.w.lag(10, 0.1, 0.1, 'named')];
  p.frame(60, () => [p.w.lag(0, 0.1), p.w.spring(0), p.w.lag(1, 0.1), p.w.lag(0, 0.1, 0.1, 'named')]);   // seeds: 0, 0, 1, 0
  const r = p.frame(10, draw);                          // 0.1 s later
  close(r[0], 0.9, 1e-9, 'first lag rose from its own 0 (90% in its 0.1 s)');
  close(r[2], 0.1, 1e-9, 'second lag fell from its own 1');
  close(r[3], 10 * 0.9, 1e-9, 'the named one');
  assert.ok(r[1] > 0 && r[1] < 5, 'spring is not counted among the lags');
  const slots = p.w.OAVp5.chop.slots();
  assert.deepEqual([...slots.map((s) => `${s.kind} ${s.mode} ${s.key}`)], ['lag order #1', 'lag order #2', 'lag name named', 'spring order #1']);
  // a named slot is the same one in a callback (outside draw), and counts no place in the order
  p.w.p5 = { instance: { _inUserDraw: false, frameCount: p.w.frameCount } };
  p.clock.ms += 100;
  const fromCallback = p.w.lag(10, 0.1, 0.1, 'named');
  assert.ok(fromCallback > r[3] && fromCallback < 10, 'kept going from where draw() left it');
});

test('outside draw() an unnamed call returns its input and says so once; env, trigger and count(name) work anywhere', async () => {
  const p = page(); await ready(p);
  const inst = { _inUserDraw: false, frameCount: 0 };
  p.w.p5 = { instance: inst };                          // setup(): p5 is not in draw()
  assert.equal(p.w.lag(0.4, 0.5), 0.4);
  assert.equal(p.w.speed(3), 0);
  assert.equal(p.w.trail(0.2).length, 0);
  assert.equal(p.w.lag(0.6, 0.5), 0.6);
  const cards = [...p.w.OAVp5.hints.filter((h) => /^chopOut:/.test(h.id)).map((h) => h.id)];
  assert.deepEqual(cards, ['chopOut:lag', 'chopOut:speed', 'chopOut:trail'], 'once per kind');
  assert.ok(p.w.OAVp5.hints[0].what.includes('lag()') && p.w.OAVp5.hints[0].next.includes("'a'"));
  p.w.trigger('boom');
  p.clock.ms += 5;
  close(p.w.env('boom', 0.01, 0.3), 0.5, 1e-9, 'env in a callback: halfway up 5 ms after the trigger');
  assert.equal(p.w.count('boom'), 1);
  assert.equal(p.w.OAVp5.chop.slots().length, 0, 'nothing was stored');
});

test('the number of calls changes (a call inside an if): a card, then each call is matched by its line; nobody keeps a neighbour\'s memory', async () => {
  const p = page(); await ready(p);
  let extra = false;
  const draw = (a, b) => {
    const out = {};
    if (extra) out.x = p.w.speed(100);                  // the inserted call: its own line
    out.a = p.w.speed(1);
    out.b = p.w.speed(a ? 2 : b);
    return out;
  };
  let r;
  for (let i = 0; i < 31; i++) r = p.frame(30, () => draw(true));          // 1 s: a = 1, b = 2
  close(r.a, 1, 1e-9); close(r.b, 2, 1e-9);
  extra = true; p.frame(30, () => draw(true));         // the frame the order shifted: one frame of a neighbour's memory
  for (let i = 0; i < 30; i++) r = p.frame(30, () => draw(true));
  const card = p.w.OAVp5.hints.find((h) => h.id === 'chopOrder:speed');
  assert.ok(card && card.why.includes('3') && card.why.includes('2'), 'the card says how many calls, then and now');
  assert.ok(p.w.OAVp5.chop.slots().some((s) => s.kind === 'speed' && s.mode === 'site'), 'matched by line from now on');
  close(r.x, 100 * 29 / 30, 0.01, 'the new call: a fresh slot from the first frame matched by line');
  close(r.a, 1 + 31 / 30, 1e-9, "a: its own memory, the borrowed frame undone (1 s + 31 frames at 1/s)");
  close(r.b, 2 * (1 + 31 / 30), 1e-9, 'b: its own, at 2/s');
  extra = false;
  for (let i = 0; i < 30; i++) r = p.frame(30, () => draw(true));
  close(r.a, 1 + 61 / 30, 1e-9, 'the if turns off again: still its own'); close(r.b, 2 * (1 + 61 / 30), 1e-9);
  assert.equal(p.w.OAVp5.hints.filter((h) => h.id === 'chopOrder:speed').length, 1, 'said once');
});

test('env(\'kick\'): the drum machine and the microphone both trigger it; 1 after each hit, 0 after decay; beat once per step', async () => {
  const p = page(); await ready(p);
  const d = p.w.OAVp5.drums;
  assert.equal(p.frame(60, () => p.w.env('kick', 0.01, 0.3)), 0, 'nothing yet');
  d.count = 0; d._hit('kick', 0.6);
  p.clock.ms += 10; p.w.frameCount++;
  const after = (ms) => { p.clock.ms += ms; p.w.frameCount++; return p.w.env('kick', 0.01, 0.3); };
  const peakish = after(0);
  assert.ok(peakish > 0.9, `at the top: ${peakish}`);
  close(after(150), 0.25, 1e-9, 'halfway down the decay: ¼');
  assert.equal(after(300), 0, 'gone after the decay');
  d.count = 1; d._hit('hat', 0.4); d._hit('snare', 0.5); d._hit('clap', 0.5);   // the next step: one beat for two hits, as beatDetected
  p.clock.ms += 10; p.w.frameCount++;
  assert.ok(p.w.env('hat') > 0.9 && p.w.env('snare') > 0.9 && p.w.env('beat') > 0.9);
  assert.equal(p.w.count('snare'), 2, 'snare and clap are both snareDetected');
  assert.equal(p.w.count('beat'), 2, 'one beat per step (the kick on step 0, snare + clap on step 1)');
  p.w.OAVp5.mic._frame({ rms: 0.1, peak: 0.3, low: 0.5, mid: 0.2, high: 0.1, centroid: 0.2, onset: true, kick: { hit: true, level: 0.6, env: 0.6 }, snare: { hit: false }, hat: { hit: false } });
  assert.equal(p.w.count('kick'), 2, 'the microphone\'s kick counts too');
  p.w.midi.play(60, 0.8);
  assert.equal(p.w.count('note'), 0, 'note was not listened to before its first call');
  p.w.midi.play(62, 0.8); assert.equal(p.w.count('note'), 1);
  assert.equal(p.w.count('kick', 2), 0, 'count(name, limit) loops');
});

test("env('kick') with no drum machine asks for the microphone, as a read of micLevel does; with startDrums() it does not", async () => {
  const asked = { n: 0 };
  const navigator = { mediaDevices: { getUserMedia() { asked.n++; return Promise.reject(Object.assign(new Error('no'), { name: 'NotAllowedError' })); } } };
  const p = page({ navigator }); await ready(p);
  p.frame(60, () => p.w.env('kick'));
  assert.equal(asked.n, 0, 'not yet: @openav/audio is loaded first');
  await settle();
  assert.equal(p.w.OAVp5.mic.state, 'unavailable', 'it tried (the test refuses @openav/audio)');
  const q = page({ navigator }); await ready(q);
  q.w.OAVp5.drums.start('four on floor');               // no document here: the machine never mounts, but the sketch asked for drums
  q.frame(60, () => q.w.env('kick'));
  await settle();
  assert.equal(q.w.OAVp5.mic.state, 'off', 'the drums are the kicks');
});

test("env(gate): on every turn-on of a boolean or a number above 0.5; trigger('boom') + env('boom'); a name nobody triggers gets a card", async () => {
  const timers = [];
  const p = page({ setTimeout: (fn, ms) => { if (ms >= 1000) timers.push(fn); else setTimeout(fn, ms); return 0; } }); await ready(p);
  p.frame(60, () => p.w.env(false, 0, 0.5));
  const v1 = p.frame(60, () => p.w.env(true, 0, 0.5));
  assert.equal(v1, 1, 'turned on: 1');
  const v2 = p.frame(4, () => p.w.env(true, 0, 0.5));
  close(v2, (1 - 0.25 / 0.5) ** 2, 1e-9, 'held: it does not trigger again');
  p.w.trigger('boom');
  p.clock.ms += 5; p.w.frameCount++;
  close(p.w.env('boom', 0.01, 0.3), 0.5, 1e-9);
  p.frame(60, () => p.w.env('kik'));
  timers.forEach((fn) => fn());
  const card = p.w.OAVp5.hints.find((h) => h.id === 'chopEvent:kik');
  assert.ok(card && card.why.includes('kick') && card.next.includes("trigger('kik')"), 'the typo is pointed out');
  assert.ok(!p.w.OAVp5.hints.some((h) => h.id === 'chopEvent:boom'), 'a triggered name is not');
});

test('speed / spring / trail / slope / count through the globals: seconds are seconds at 30 and 144 fps; a name is its own', async () => {
  const p = page(); await ready(p);
  const one = (fps) => {
    const q = page(); q.w.OAVp5.chop.module = p.w.OAVp5.chop.module;
    let r;
    for (let k = 0; k <= fps; k++) r = q.frame(fps, () => ({ s: q.w.speed(Math.PI), t: q.w.trail(k / fps, 0.5), sl: q.w.slope(2 * k / fps), c: q.w.count(k % 10 === 0), sp: q.w.spring(k ? 1 : 0) }));
    return r;
  };
  const a = one(30), b = one(144);
  close(a.s, Math.PI, 0.0001, 'speed(π): half a turn a second'); close(b.s, Math.PI, 0.0001);
  assert.equal(a.t.length, 31); assert.equal(b.t.length, 31);
  close(a.t[0], 0.5, 0.02, 'trail(…, 0.5): half a second ago'); close(b.t[0], 0.5, 0.02);
  close(a.sl, 2, 1e-9); close(b.sl, 2, 1e-9);
  assert.equal(a.c, 4); assert.equal(b.c, 15);
  close(a.sp, b.sp, 0.01, 'spring: the same place after 1 s');
  const n = page(); n.w.OAVp5.chop.module = p.w.OAVp5.chop.module;
  n.frame(30, () => n.w.speed(1, 'spin')); n.frame(30, () => n.w.speed(1, 'spin'));
  close(n.w.speed(0, 'spin'), 1 / 30, 1e-9, "speed(rate, 'spin'): its own");
});

test('scope() with no page returns its value and builds nothing; drawTrail() draws a line through the values on the canvas', async () => {
  const shapes = [];
  let cur = null;
  const p5fns = { push() {}, pop() {}, noFill() {}, stroke: () => shapes.push('stroke'), beginShape: () => { cur = []; }, vertex: (x, y) => cur.push([x, y]), endShape: () => shapes.push(cur), width: 200, height: 100 };
  const p = page(p5fns); await ready(p);
  assert.equal(p.frame(60, () => p.w.scope(0.3, 'mic')), 0.3);
  const v = p.w.drawTrail([0, 0.5, 1], 10, 20, 100, 50);
  assert.deepEqual(v, [0, 0.5, 1]);
  assert.deepEqual(shapes.at(-1), [[10, 70], [60, 45], [110, 20]], 'oldest at x, 0 at the bottom, 1 at the top');
  p.w.drawTrail([2, -1], 0, 0, 10, 10);
  assert.deepEqual(shapes.at(-1), [[0, 0], [10, 10]], 'kept inside its box');
  p.w.drawTrail([5, 10], 0, 0, 10, 10, 0, 10);
  assert.deepEqual(shapes.at(-1), [[0, 5], [10, 0]], 'its own range');
  const t = p.frame(60, () => p.w.drawTrail(0.25, 0, 0, 120, 10));
  assert.equal(t.length, 121, 'a number: its own last 2 s');
  assert.ok(!shapes.includes('stroke'), "the sketch's stroke is used");
});
