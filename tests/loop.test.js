// @openav/core Loop — the frame clock. Two things are pinned here:
//   1. nothing changes when nothing is injected (real requestAnimationFrame + performance.now + the hidden-tab Worker);
//   2. the loop can be driven from outside: an injected clock and raf, a manual loop and loop.step(dt), so a whole show can be
//      recorded frame by frame, unit-tested or run headless without replacing the page's global clock.
// The browser parts are exercised through fakes here; examples 01 and 13 run the real thing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Loop } from '../packages/core/index.js';

/** A fake clock + raf pair: nothing happens until advance(ms) runs the callbacks queued so far, stamped with the new time. */
function rig() {
  let now = 0, id = 0;
  const queue = [];
  return {
    clock: () => now,
    raf: (cb) => { queue.push(cb); return ++id; },
    advance(ms) { now += ms; const cbs = queue.splice(0); for (const cb of cbs) cb(now); },
    get pending() { return queue.length; },
    get now() { return now; },
  };
}

/** Swap globals for the length of one test (performance, requestAnimationFrame, Worker), then put them back. */
async function withGlobals(over, fn) {
  const had = {};
  for (const k of Object.keys(over)) had[k] = Object.getOwnPropertyDescriptor(globalThis, k);
  for (const [k, v] of Object.entries(over)) Object.defineProperty(globalThis, k, { value: v, configurable: true, writable: true });
  try { return await fn(); } finally {
    for (const k of Object.keys(over)) { if (had[k]) Object.defineProperty(globalThis, k, had[k]); else delete globalThis[k]; }
  }
}
const quiet = (fn) => { const e = console.error; const seen = []; console.error = (...a) => seen.push(a); try { fn(); } finally { console.error = e; } return seen; };

// ───────────── the defaults do not move ─────────────

test('Loop: with nothing injected it still runs on the global requestAnimationFrame and performance.now, with the hidden-tab Worker', async () => {
  let t = 1000; const queue = []; const workers = [];
  class FakeWorker { constructor(url) { this.url = url; this.terminated = false; workers.push(this); } terminate() { this.terminated = true; } }
  await withGlobals({
    performance: { now: () => t },
    requestAnimationFrame: (cb) => { queue.push(cb); return queue.length; },
    Worker: FakeWorker,
  }, () => {
    const URLreal = URL.createObjectURL;
    URL.createObjectURL = () => 'blob:fake';
    try {
      const frames = [];
      const loop = new Loop((dt, now) => frames.push([dt, now]));
      loop.start();
      assert.equal(loop.running, true);
      assert.equal(queue.length, 1, 'one frame requested');
      assert.equal(workers.length, 1, 'the heartbeat Worker is created by default');
      queue.shift()(1016);                                   // rAF hands the timestamp
      assert.equal(frames.length, 1);
      assert.ok(Math.abs(frames[0][0] - 0.016) < 1e-9, 'dt = (1016 − 1000) ms');
      assert.equal(frames[0][1], 1016);
      queue.shift()(1016 + 400);                             // a stall: 0.4 s is clamped to maxDt
      assert.equal(frames[1][0], 0.1);
      // the Worker's beat steps the loop when rAF has been silent for more than 50 ms (a hidden tab)
      t = 1416 + 30;
      workers[0].onmessage();
      assert.equal(frames.length, 2, 'rAF ticked 30 ms ago: no extra frame');
      t = 1416 + 70;
      workers[0].onmessage();
      assert.equal(frames.length, 3, 'rAF silent for 70 ms: the heartbeat steps');
      assert.ok(Math.abs(frames[2][0] - 0.07) < 1e-9);
      loop.stop();
      assert.equal(loop.running, false);
      assert.equal(workers[0].terminated, true, 'stop() ends the heartbeat');
      queue.splice(0).forEach((cb) => cb(9999));
      assert.equal(frames.length, 3, 'a frame requested before stop() does not run after it');
    } finally { URL.createObjectURL = URLreal; }
  });
});

// ───────────── an injected clock and raf ─────────────

test('Loop: { clock, raf } drive the loop; no global requestAnimationFrame, performance.now or Worker is touched', async () => {
  const r = rig(); const frames = [];
  let workers = 0;
  await withGlobals({
    requestAnimationFrame: () => { throw new Error('global rAF must not be used'); },
    Worker: class { constructor() { workers++; } },
    performance: { now: () => { throw new Error('global performance.now must not be used'); } },
  }, () => {
    const loop = new Loop((dt, now) => frames.push([dt, now]), { clock: r.clock, raf: r.raf });
    r.advance(500);                                          // the clock was already at 500 when the loop starts
    loop.start();
    assert.equal(r.pending, 1);
    r.advance(1000 / 60); r.advance(1000 / 60);
    assert.equal(frames.length, 2);
    assert.ok(Math.abs(frames[0][0] - 1 / 60) < 1e-12 && Math.abs(frames[1][0] - 1 / 60) < 1e-12, 'dt comes from the injected timestamps');
    assert.ok(Math.abs(frames[1][1] - (500 + 2000 / 60)) < 1e-9);
    assert.equal(r.pending, 1, 'one frame is always queued while running');
    assert.equal(workers, 0, 'no heartbeat Worker when raf is injected: a fake clock must not be stepped by a real timer');
    loop.stop();
    r.advance(16);
    assert.equal(frames.length, 2, 'stopped');
    assert.equal(loop.running, false);
  });
});

test('Loop: a raf that calls back without a timestamp falls back to the injected clock', () => {
  const r = rig(); const dts = [];
  const loop = new Loop((dt) => dts.push(dt), { clock: r.clock, raf: (cb) => { r.raf(() => cb()); } });   // (cb) => cb() with no argument
  loop.start();
  r.advance(20);
  assert.ok(Math.abs(dts[0] - 0.02) < 1e-12);
});

test('Loop: the injected clock still gets the dt clamp (maxDt), and a repeated timestamp is no frame', () => {
  const r = rig(); const dts = [];
  const loop = new Loop((dt) => dts.push(dt), { clock: r.clock, raf: r.raf, maxDt: 0.05 });
  loop.start();
  r.advance(500); r.advance(0); r.advance(10);
  assert.deepEqual(dts.map((d) => +d.toFixed(6)), [0.05, 0.01], 'clamped; the zero-length frame is dropped');
});

test('Loop: stop() then start() leaves one chain of frames, not two', () => {
  const r = rig(); let n = 0;
  const loop = new Loop(() => n++, { clock: r.clock, raf: r.raf });
  loop.start(); loop.stop(); loop.start();
  r.advance(16); r.advance(16);
  assert.equal(n, 2, 'one frame per advance');
  assert.equal(r.pending, 1);
});

test('Loop: without raf and not manual, start() says what to pass instead of a ReferenceError', async () => {
  await withGlobals({ requestAnimationFrame: undefined }, () => {
    const loop = new Loop(() => {});
    assert.throws(() => loop.start(), /raf|manual/);
    assert.equal(loop.running, false, 'a failed start leaves it stopped');
  });
});

// ───────────── step(dt) and the manual loop ─────────────

test('Loop: step(dt) runs exactly one frame of dt seconds and needs no start, no raf, no clock', async () => {
  await withGlobals({ requestAnimationFrame: undefined, Worker: undefined }, () => {
    const got = [];
    const loop = new Loop((dt, now) => got.push([dt, now]));
    assert.equal(loop.step(1 / 60), true);
    assert.equal(loop.step(0.02), true);
    assert.deepEqual(got.map((g) => g[0]), [1 / 60, 0.02]);
    assert.ok(Math.abs(got[0][1] - 1000 / 60) < 1e-9, 'now is virtual: the sum of the dt stepped, in ms, from 0');
    assert.ok(Math.abs(got[1][1] - (1000 / 60 + 20)) < 1e-9);
    assert.equal(loop.running, false, 'stepping by hand does not start anything');
  });
});

test('Loop: step() does not clamp (the caller chose that dt); an automatic frame still does', () => {
  const got = [];
  const loop = new Loop((dt) => got.push(dt), { manual: true });
  loop.step(2.5);
  assert.deepEqual(got, [2.5]);
  const r = rig(); const auto = [];
  const l2 = new Loop((dt) => auto.push(dt), { clock: r.clock, raf: r.raf });
  l2.start(); r.advance(2500);
  assert.deepEqual(auto, [0.1]);
});

test('Loop: step(0) is a frame (redraw in place); a negative, NaN or non-number dt is refused and runs nothing', () => {
  let n = 0; const dts = [];
  const loop = new Loop((dt) => { n++; dts.push(dt); }, { manual: true });
  assert.equal(loop.step(0), true);
  for (const bad of [-0.01, NaN, Infinity, undefined, '0.016', null]) assert.equal(loop.step(bad), false, String(bad));
  assert.equal(n, 1);
  assert.deepEqual(dts, [0]);
});

test('Loop: { manual: true } start() marks it running but schedules nothing; stop() clears it', async () => {
  let raf = 0, workers = 0;
  await withGlobals({
    requestAnimationFrame: () => { raf++; },
    Worker: class { constructor() { workers++; } },
  }, () => {
    const loop = new Loop(() => {}, { manual: true });
    loop.start();
    assert.equal(loop.running, true);
    assert.equal(raf, 0); assert.equal(workers, 0);
    loop.step(0.016);
    loop.stop();
    assert.equal(loop.running, false);
    assert.equal(loop.step(0.016), true, 'a stopped loop can still be stepped');
  });
});

test('Loop: manual frames are deterministic — the same dts give the same (dt, now) every run, whatever the real clock says', () => {
  const run = () => {
    const seq = [];
    const loop = new Loop((dt, now) => seq.push([dt, now]), { manual: true });
    loop.start();
    for (let i = 0; i < 600; i++) loop.step(i % 3 === 0 ? 1 / 60 : 1 / 30);
    return JSON.stringify(seq) + loop.fps;
  };
  const a = run();
  for (let spin = Date.now(); Date.now() - spin < 5;);        // let real time pass
  assert.equal(run(), a);
});

test('Loop: fps in a manual loop is frames per stepped second (60 steps of 1/60 s read 60)', () => {
  const loop = new Loop(() => {}, { manual: true });
  loop.start();
  for (let i = 0; i < 120; i++) loop.step(1 / 60);
  assert.equal(loop.fps, 60);
});

test('Loop: an error in onFrame is logged and the loop steps on (step() still returns true)', () => {
  let n = 0;
  const loop = new Loop(() => { n++; if (n === 1) throw new Error('boom'); }, { manual: true });
  let ok;
  const logged = quiet(() => { ok = loop.step(0.016); });
  assert.equal(ok, true);
  assert.equal(logged.length, 1);
  assert.equal(logged[0][0], '[loop]');
  assert.equal(loop.step(0.016), true);
  assert.equal(n, 2);
});

test('Loop: step() works on a running automatic loop too — it adds a frame and moves the loop clock on by dt', () => {
  const r = rig(); const got = [];
  const loop = new Loop((dt, now) => got.push([+dt.toFixed(6), +now.toFixed(3)]), { clock: r.clock, raf: r.raf });
  loop.start();
  r.advance(16);
  loop.step(0.5);
  assert.deepEqual(got, [[0.016, 16], [0.5, 516]]);
});
