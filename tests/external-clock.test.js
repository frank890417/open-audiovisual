// 0.7: following an external MIDI clock. @openav/midi's MidiClock (packages/midi/clock.js) counts what Strudel (or a DAW,
// or a drum machine) sends — clock ×24 a beat, start / continue / stop, song position — and DrumTransport.follow() keeps
// the drum machine on it. Fake clocks throughout; the browser half (strudel.cc → OAV) is p5/test/strudel-smoke.cjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MidiClock } from '../packages/midi/clock.js';
import { DrumScheduler, DrumTransport, GM } from '../packages/drums/index.js';

const CLOCK = [0xF8], START = [0xFA], CONT = [0xFB], STOP = [0xFC];
const tick = (bpm) => 60 / bpm / 24;

// ---------------------------------------------------------------- MidiClock

test('MidiClock: the tempo from the clocks (24 a beat), exact on a steady clock, and through one late clock', () => {
  const c = new MidiClock();
  assert.equal(c.bpm, null); assert.equal(c.state(0), 'none');
  for (let k = 0; k < 48; k++) c.feed(CLOCK, 10 + k * tick(128));
  assert.ok(Math.abs(c.bpm - 128) < 1e-6, `${c.bpm}`);
  const d = new MidiClock();
  for (let k = 0; k < 48; k++) d.feed(CLOCK, 10 + k * tick(120) + (k === 40 ? 0.004 : 0));   // one clock 4 ms late
  assert.ok(Math.abs(d.bpm - 120) < 0.6, `one late clock moves it < 0.5 %: ${d.bpm}`);
});

test('MidiClock: Strudel\'s start sent three times with one timestamp is one start; a clock with the start\'s timestamp is the downbeat, whichever came first', () => {
  for (const order of ['clock-first', 'start-first']) {
    const c = new MidiClock(), T = 50, dt = tick(120);
    for (let k = -30; k < 0; k++) c.feed(CLOCK, T + k * dt);          // Strudel's clock runs before the start
    if (order === 'clock-first') c.feed(CLOCK, T);
    assert.equal(c.feed(START, T), 'start');
    assert.equal(c.feed(START, T), 'dupe'); assert.equal(c.feed(START, T + 0.0004), 'dupe');
    if (order === 'start-first') c.feed(CLOCK, T);
    for (let k = 1; k <= 96 * 2; k++) c.feed(CLOCK, T + k * dt);
    assert.equal(c.stats.starts, 1); assert.equal(c.stats.dupes, 2);
    assert.ok(Math.abs(c.phaseAt(T).pos) < 1e-9, `${order}: the start's own clock is position 0`);
    const p = c.phaseAt(T + 2.25);                                       // 120 bpm: a bar is 2 s; 2.25 s = bar 2 + an 8th
    assert.ok(Math.abs(p.pos - 1.125) < 1e-6 && Math.abs(p.bar - 0.125) < 1e-6 && Math.abs(p.beat - 0.5) < 1e-6, `${order}: ${JSON.stringify(p)}`);
    assert.equal(c.state(T + 2.25), 'running');
    const a = c.anchor();
    assert.ok(Math.abs(a.at - (T + 192 * dt)) < 1e-9 && Math.abs(a.pos - 2) < 1e-9 && Math.abs(a.bpm - 120) < 1e-6);
  }
});

test('MidiClock: a start announced 0.25 s early (Strudel\'s lead) is placed at its own time; before it the position is 0', () => {
  const c = new MidiClock(), dt = tick(120);
  for (let k = 0; k < 24; k++) c.feed(CLOCK, 10 + k * dt);
  c.feed(START, 11);                                                     // arrives now, sounds at 11
  assert.equal(c.phaseAt(10.9).pos, 0, 'before the start');
  assert.ok(Math.abs(c.phaseAt(11.5).pos - 0.25) < 1e-6, 'its clocks not here yet: the tempo carries the position');
  assert.ok(Math.abs(c.anchor().at - 11) < 1e-9 && c.anchor().pos === 0);
});

test('MidiClock: stop holds the position, clocks keep the tempo; continue goes on from there; song position sets where', () => {
  const c = new MidiClock(), dt = tick(100);
  c.feed(START, 0);
  let k = 0;
  for (; k < 96; k++) c.feed(CLOCK, k * dt);                             // one bar
  c.feed(STOP, 96 * dt);
  for (; k < 140; k++) c.feed(CLOCK, k * dt);                            // clocks go on while stopped
  assert.equal(c.state(140 * dt), 'stopped'); assert.equal(c.running, false);
  assert.ok(Math.abs(c.phaseAt(130 * dt).pos - 1) < 1e-6, 'held at the stop');
  assert.ok(Math.abs(c.bpm - 100) < 1e-6, 'tempo still known');
  c.feed(CONT, 140 * dt);
  for (; k < 200; k++) c.feed(CLOCK, k * dt);
  assert.ok(Math.abs(c.phaseAt(140 * dt + 24 * dt).pos - 1.25) < 1e-6, 'a beat after continue: bar 2 + a beat');
  c.feed(STOP, 200 * dt);
  c.feed([0xF2, 32, 0], 201 * dt);                                       // song position 32 sixteenths = bar 3
  c.feed(CONT, 210 * dt);
  for (k = 210; k < 230; k++) c.feed(CLOCK, k * dt);
  assert.ok(Math.abs(c.phaseAt(210 * dt).pos - 2) < 1e-6, `song position: ${c.phaseAt(210 * dt).pos}`);
  assert.equal(c.stats.continues, 2);
});

test('MidiClock: clocks with no start follow the tempo, and the first after a silence is a downbeat; no clock for 0.6 s is lost', () => {
  const c = new MidiClock(), dt = tick(90);
  for (let k = 0; k < 50; k++) c.feed(CLOCK, 5 + k * dt);
  assert.equal(c.implicit, true); assert.equal(c.state(5 + 50 * dt), 'running');
  assert.ok(Math.abs(c.phaseAt(5 + 24 * dt).pos - 0.25) < 1e-6);
  assert.equal(c.state(5 + 49 * dt + 0.7), 'lost');
  for (let k = 0; k < 30; k++) c.feed(CLOCK, 20 + k * dt);              // back after 15 s: a new run from its first clock
  assert.ok(Math.abs(c.phaseAt(20).pos) < 1e-9 && Math.abs(c.phaseAt(20 + 12 * dt).pos - 0.125) < 1e-6);
  assert.equal(c.feed(CLOCK, 20 + 29 * dt), 'dupe', 'the same clock twice counts once');
});

// ---------------------------------------------------------------- DrumTransport.follow

function world() {
  const w = { T: 100, ctx: null, ctxStart: 0, hidden: false, notes: [] };
  w.now = () => w.T;
  w.startAudio = () => { w.ctxStart = w.T; w.ctx = { state: 'running', outputLatency: 0, get currentTime() { return Math.floor((w.T - w.ctxStart) * 48000 / 128) * 128 / 48000; } }; };
  w.engine = {
    get context() { return w.ctx; }, enable: async () => {},
    noteOn(note, vel, time) { const h = { note, time, cancelled: false, cancel() { this.cancelled = true; } }; w.notes.push(h); return h; },
  };
  return w;
}
const machine = (w, pattern = 'four on floor', bpm = 120) => {
  const log = [];
  const t = new DrumTransport({ scheduler: new DrumScheduler({ bpm, humanize: 0, pattern }), engine: w.engine, heartbeat: false, now: w.now, hidden: () => false,
    onStep: (i, n) => log.push({ k: 'step', i, n, t: w.T }), onHit: (voice, vel, ev) => log.push({ k: 'hit', voice, n: ev.n, t: w.T }) });
  return { t, log };
};
/** run the world: a heartbeat every 25 ms, a frame every 1/60 s, and the external clock's position handed to follow() every
 *  `every` s (as oav-p5 does on the clocks), from `ext(T)` = { pos, bpm, at? } or null (not running); before a start
 *  that is announced ahead, the start itself: { pos: 0, at: T0 } (MidiClock.anchor() never hands out a point before it) */
function run(w, t, secs, ext, every = 0.25) {
  const end = w.T + secs;
  let nb = w.T + 0.025, nf = w.T + 1 / 60, nx = ext ? w.T : Infinity;
  while (w.T < end) {
    const next = Math.min(nb, nf, nx, end);
    w.T = next;
    if (ext && w.T >= nx - 1e-12) { const e = ext(w.T); if (e) t.follow({ pos: e.pos, at: e.at ?? w.T, bpm: e.bpm }, { jump: 1 / 32 }); nx += every; }
    if (w.T >= nb - 1e-12) { t.pump(); nb += 0.025; }
    if (w.T >= nf - 1e-12) { t.frame(); nf += 1 / 60; }
  }
}
const heardAt = (w, n) => w.ctxStart + n.time;   // a kit note's context time on the performance clock (no output latency here)

test('follow: started by an external start 0.3 s ahead, at 128 bpm — every kick on the external beat (< 3 ms), bar 1 on its downbeat', () => {
  const w = world(); w.startAudio(); w.T += 1;
  const { t, log } = machine(w);
  const T0 = w.T + 0.3, bpm = 128;
  t.follow({ pos: 0, at: T0, bpm });
  assert.equal(t.playing, true);
  run(w, t, 10, (T) => (T < T0 ? { pos: 0, at: T0, bpm } : { pos: (T - T0) * bpm / 240, bpm }));
  const kicks = w.notes.filter((n) => n.note === GM.kick && !n.cancelled);
  assert.ok(kicks.length >= 20, `${kicks.length} kicks`);
  let worst = 0;
  kicks.forEach((n, k) => { worst = Math.max(worst, Math.abs(heardAt(w, n) - (T0 + k * 60 / bpm))); });
  assert.ok(worst < 0.003, `worst kick ${(worst * 1000).toFixed(2)} ms off the external beat`);
  const steps = log.filter((e) => e.k === 'step').map((e) => e.n);
  assert.deepEqual(steps, steps.map((_, i) => i), 'every 16th once, from step 0');
  assert.ok(Math.abs(t.bpm - 128) < 1e-9);
  const ph = t.phase(), expect = ((t.times().heard - (T0 - 0)) * bpm / 240) % 1;
  assert.ok(Math.abs(ph.bar - expect) < 0.002, `drumPhase ${ph.bar} vs the external ${expect}`);
});

test('follow: a machine started on its own, 40 ms off the external grid, is pulled in by tempo alone — no hit twice, none missing', () => {
  const w = world(); w.startAudio(); w.T += 1;
  const { t, log } = machine(w);
  t.start();
  const own = t.scheduler._tempo[0].time;                                // its downbeat on the heard timeline (= performance time here)
  const T0 = own + 0.04, bpm = 120;                                      // the external downbeat: 40 ms later
  run(w, t, 6, (T) => (T >= T0 ? { pos: (T - T0) * bpm / 240, bpm } : null));
  const info = t.followInfo();
  assert.equal(info.jumps, 0, 'no restart: 40 ms is less than a 32nd'); assert.ok(info.steers >= 1);
  assert.ok(Math.abs(info.err) < 0.001, `the last error ${(info.err * 1000).toFixed(2)} ms`);
  const steps = log.filter((e) => e.k === 'step').map((e) => e.n);
  assert.deepEqual(steps, steps.map((_, i) => i), 'every 16th once');
  const kicks = w.notes.filter((n) => n.note === GM.kick && !n.cancelled).map((n) => heardAt(w, n));
  assert.equal(new Set(kicks.map((x) => x.toFixed(6))).size, kicks.length, 'no kick twice');
  const late = kicks.filter((x) => x > T0 + 2);
  for (const x of late) { const k = Math.round((x - T0) / 0.5); assert.ok(Math.abs(x - (T0 + k * 0.5)) < 0.002, `kick ${((x - T0 - k * 0.5) * 1000).toFixed(2)} ms off after 2 s`); }
});

test('follow: the external tempo changes 120 → 140 mid-bar; a bar later the kicks are on the new grid', () => {
  const w = world(); w.startAudio(); w.T += 1;
  const { t } = machine(w);
  const T0 = w.T + 0.2, Tc = T0 + 3.1;
  const ext = (T) => (T < T0 ? { pos: 0, at: T0, bpm: 120 } : T < Tc ? { pos: (T - T0) * 120 / 240, bpm: 120 } : { pos: (Tc - T0) * 120 / 240 + (T - Tc) * 140 / 240, bpm: 140 });
  t.follow({ pos: 0, at: T0, bpm: 120 });
  run(w, t, 9, (T) => ext(T));
  const kicks = w.notes.filter((n) => n.note === GM.kick && !n.cancelled).map((n) => heardAt(w, n)).filter((x) => x > Tc + 2);
  assert.ok(kicks.length >= 8);
  for (const x of kicks) { const p = ext(x).pos * 4; assert.ok(Math.abs(p - Math.round(p)) * 60 / 140 < 0.003, `kick ${((p - Math.round(p)) * 60 / 140 * 1000).toFixed(2)} ms off the 140 grid`); }
  assert.ok(Math.abs(t.bpm - 140) < 1e-9);
});

test('follow: joining an external clock at bar 9 jumps onto its grid; the bar numbers are the external ones, the bars that went by skipped', () => {
  const w = world(); w.startAudio(); w.T += 1;
  const { t, log } = machine(w);
  const T0 = w.T - 16.3, bpm = 120;                                      // the external clock started 16.3 s ago: bar 9, 0.15 into it
  t.follow({ pos: (w.T - T0) * bpm / 240, at: w.T, bpm });
  run(w, t, 2.5, (T) => ({ pos: (T - T0) * bpm / 240, bpm }));
  const steps = log.filter((e) => e.k === 'step');
  assert.ok(steps[0].n >= 8 * 16 + 2 && steps[0].n <= 8 * 16 + 5, `the first step told is in bar 9: n = ${steps[0].n}`);
  assert.ok(steps.length < 30, 'no flood of the 130 steps that went by');
  assert.ok(steps.some((e) => e.i === 0 && Math.floor(e.n / 16) + 1 === 10), 'bar 10 starts, numbered as the external clock numbers it');
  const k = w.notes.filter((n) => n.note === GM.kick && !n.cancelled).map((n) => heardAt(w, n));
  for (const x of k) { const b = (x - T0) / 0.5; assert.ok(Math.abs(b - Math.round(b)) * 0.5 < 0.003); }
});

test('follow: stop then a new start in the future — silence until then, bar 1 again on that downbeat', () => {
  const w = world(); w.startAudio(); w.T += 1;
  const { t, log } = machine(w);
  t.follow({ pos: 0, at: w.T + 0.1, bpm: 120 });
  run(w, t, 2);
  t.stop();
  const T1 = w.T + 0.8, n0 = w.notes.filter((n) => !n.cancelled).length;
  run(w, t, 0.5);
  assert.equal(w.notes.filter((n) => !n.cancelled).length, n0, 'stopped: nothing new');
  t.follow({ pos: 0, at: T1, bpm: 120 });
  run(w, t, 0.25);
  assert.ok(w.notes.filter((n) => !n.cancelled && heardAt(w, n) < T1 - 0.003).length === n0, 'nothing before the new downbeat (a 128-frame step of the audio clock: 3 ms)');
  run(w, t, 2.5);
  const first = w.notes.filter((n) => !n.cancelled && n.note === GM.kick && heardAt(w, n) >= T1 - 0.003)[0];
  assert.ok(Math.abs(heardAt(w, first) - T1) < 0.003, 'the first kick on the new downbeat');
  const bars = log.filter((e) => e.k === 'step' && e.i === 0).map((e) => Math.floor(e.n / 16) + 1);
  assert.deepEqual(bars.slice(-2), [1, 2], 'bar 1 again, then bar 2');
});

test('follow: without follow() the transport is exactly 0.6 (no follow state, setBpm untouched)', () => {
  const w = world(); w.startAudio(); w.T += 1;
  const { t } = machine(w);
  t.start(); run(w, t, 1);
  assert.equal(t.followInfo(), null);
  t.setBpm(90); assert.equal(t.bpm, 90);
});
