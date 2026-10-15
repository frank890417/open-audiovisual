// @openav/drums 0.6: the lookahead clock (DrumScheduler + DrumTransport) under a fake clock and a fake AudioContext.
// What a class notices — a beat that limps when the sketch is heavy, drums that stop in a hidden tab, a tempo change
// that doubles or drops a hit, a burst of sound or callbacks after a click or a tab switch — each has a test here.
// The browser half (a real Chromium, a real kit, a busy draw()) is p5/test/timing-probe.cjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DrumScheduler, DrumTransport, drumEngine, GM, drumName } from '../packages/drums/index.js';

/** a fake world: performance time T (seconds), and an AudioContext that starts when told and runs in 128-frame quanta */
function world({ latency = 0 } = {}) {
  const w = { T: 100, ctx: null, ctxStart: 0, hidden: false };
  w.now = () => w.T;
  w.startAudio = () => { w.ctxStart = w.T; w.ctx = { state: 'running', outputLatency: latency, get currentTime() { return Math.floor((w.T - w.ctxStart) * 48000 / 128) * 128 / 48000; } }; };
  w.notes = [];
  w.engine = {
    get context() { return w.ctx; },
    enable: async () => {},
    noteOn(note, vel, time) { const h = { note, vel, time, at: w.ctx ? w.ctx.currentTime : null, cancelled: false, cancel() { this.cancelled = true; } }; w.notes.push(h); return h; },
  };
  return w;
}
const transport = (w, o = {}) => {
  const log = [];
  const t = new DrumTransport({ scheduler: new DrumScheduler({ bpm: 120, humanize: 0, pattern: 'four on floor', ...o.sched }), engine: w.engine,
    heartbeat: false, now: w.now, hidden: () => w.hidden, stale: 0.25,
    onStep: (i, n, ev) => log.push({ k: 'step', i, n, quiet: ev.quiet, announce: ev.announce, t: w.T }),
    onHit: (voice, vel, ev) => log.push({ k: 'hit', voice, n: ev.n, pos: ev.pos, t: w.T }), ...o.transport });
  return { t, log };
};
/** run the fake world: a worker heartbeat every `beat` s, a frame every `frame` s (0: none), until T + secs */
function run(w, t, secs, { beat = 0.025, frame = 1 / 60, stall = null } = {}) {
  const end = w.T + secs;
  let nb = w.T + beat, nf = frame ? w.T + frame : Infinity;
  while (w.T < end) {
    const next = Math.min(nb, nf, end);
    w.T = next;
    if (stall && w.T >= stall.at && w.T < stall.at + stall.len) { w.T = stall.at + stall.len; nb = w.T; nf = w.T; }   // the main thread is busy
    if (w.T >= nb - 1e-12) { t.pump(); nb += beat; }
    if (w.T >= nf - 1e-12) { t.frame(); nf += frame; }
  }
}

test('1000 bars at 120 bpm: every step and every hit lands on the tempo grid, no drift (< 1 µs), none twice, none missing', () => {
  const s = new DrumScheduler({ bpm: 120, humanize: 0, pattern: 'four on floor' });
  const t0 = 12345.678;
  s.start(t0);
  const steps = [], kicks = [];
  let now = t0, k = 0;
  while (now < t0 + 2000 + 0.2) {                    // 1000 bars of 2 s, advanced in 20–30 ms ticks like a real heartbeat
    for (const ev of s.advance(now)) (ev.kind === 'step' ? steps : ev.voice === 'kick' ? kicks : []).push(ev);
    s.due(now);
    now += 0.02 + ((k++ * 7919) % 11) / 1000;
  }
  const full = steps.filter((e) => e.pos < 1000);
  assert.equal(full.length, 16000);
  let worst = 0;
  full.forEach((e, n) => { assert.equal(e.n, n); worst = Math.max(worst, Math.abs(e.time - (t0 + n * 0.125))); });
  assert.ok(worst < 1e-6, `worst step error ${worst * 1e6} µs`);
  const kk = kicks.filter((e) => e.pos < 1000);
  assert.equal(kk.length, 4000);
  for (let i = 0; i < kk.length; i++) assert.ok(Math.abs(kk[i].time - (t0 + i * 0.5)) < 1e-6, `kick ${i}`);
});

test('no frames at all (a hidden tab): the heartbeat alone schedules every hit ahead on the audio clock and tells the page', () => {
  const w = world(); w.startAudio(); w.T += 1;          // the kit has been running for a second
  const { t, log } = transport(w);
  t.start();
  run(w, t, 8, { frame: 0 });                           // 8 s = 4 bars, heartbeat only
  const kicks = w.notes.filter((n) => n.note === GM.kick);
  assert.equal(kicks.length, 16 + 1, '4 bars of four on floor, and the downbeat of bar 5 already handed over (lookahead)');
  for (let i = 1; i < kicks.length; i++) assert.ok(Math.abs(kicks[i].time - kicks[i - 1].time - 0.5) < 1e-9, `kick ${i} on time`);
  for (const n of w.notes) assert.ok(n.time - n.at > 0.04, 'every hit handed over well ahead of its time');
  assert.equal(log.filter((e) => e.k === 'step').length, 64, 'the page heard every step of the 4 bars, from the heartbeat');
  assert.equal(t.late, 0); assert.equal(t.lookahead, 0.1);
});

test('a tempo change in the middle of a bar: no step or hit twice, none missing, the new tempo from that moment', () => {
  const w = world(); w.startAudio(); w.T += 0.5;
  const { t, log } = transport(w);
  t.start();
  run(w, t, 3.25);                                      // 60 % into bar 2, 50 ms before a hit already handed over
  const at = w.T;
  t.setBpm(90);
  run(w, t, 6);
  const steps = log.filter((e) => e.k === 'step').map((e) => e.n);
  assert.deepEqual(steps, steps.map((_, i) => i), 'steps 0, 1, 2 … each once');
  const played = w.notes.filter((n) => !n.cancelled);
  const times = played.map((n) => n.note + '@' + n.time.toFixed(9));
  assert.equal(new Set(times).size, times.length, 'no hit sounds twice');
  const heard = log.filter((e) => e.k === 'hit');
  assert.equal(heard.length, played.filter((n) => n.time + t._k <= t._lastHeard).length, 'every hit the page heard was played once');
  assert.ok(w.notes.some((n) => n.cancelled), 'what was handed over at the old tempo was taken back');
  const kicks = played.filter((n) => n.note === GM.kick && n.time + t._k > at + 0.2).map((n) => n.time);
  for (let i = 1; i < kicks.length; i++) assert.ok(Math.abs(kicks[i] - kicks[i - 1] - 60 / 90) < 1e-9, 'kicks a 90-bpm beat apart');
});

test('before the first click: the callbacks run on time, nothing sounds; after it, hits from then on — none from before', () => {
  const w = world();
  const { t, log } = transport(w);
  t.start();
  run(w, t, 3);
  assert.ok(log.filter((e) => e.k === 'hit').length >= 8, 'kickDetected & co. run before any sound');
  assert.equal(w.notes.length, 0, 'no audio before the click');
  const stepsBefore = log.filter((e) => e.k === 'step').length;
  assert.ok(stepsBefore >= 24 && stepsBefore <= 25, `the clock ran in real time on performance.now(): 1.5 bars (${stepsBefore} steps)`);
  w.startAudio();                                       // the click: the kit's AudioContext starts
  const unlockedAt = w.T;
  run(w, t, 3);
  assert.ok(w.notes.length > 0);
  for (const n of w.notes) assert.ok(n.time >= n.at - 1e-9, 'nothing handed over late: no burst of what was missed');
  const first = Math.min(...w.notes.map((n) => n.time + t._k));
  assert.ok(first >= unlockedAt, 'the first sound is a hit due after the click');
  const steps = log.filter((e) => e.k === 'step').map((e) => e.n);
  assert.deepEqual(steps, steps.map((_, i) => i), 'the clock went straight on through the click');
});

test('callback order: a step before its hits, hits in time order, even when a frame stalls', () => {
  const w = world(); w.startAudio(); w.T += 0.2;
  const { t, log } = transport(w, { sched: { pattern: 'breakbeat' } });
  t.start();
  run(w, t, 6, { frame: 0.05, stall: { at: w.T + 2, len: 0.2 } });
  let lastStep = -1, lastPos = -1;
  for (const e of log) {
    if (e.k === 'step') { assert.equal(e.n, lastStep + 1); lastStep = e.n; }
    else { assert.equal(e.n, lastStep, 'a hit comes after its own step, before the next'); assert.ok(e.pos >= lastPos); lastPos = e.pos; }
  }
});

test('hidden tab: the clock moves and announces one bar start per batch; hits and per-step callbacks wait for the eyes', () => {
  const w = world(); w.startAudio(); w.T += 0.2;
  const { t, log } = transport(w);
  t.start();
  run(w, t, 2);
  const before = log.length;
  w.hidden = true;
  run(w, t, 10, { frame: 0 });                          // 5 bars hidden: rAF stopped, the heartbeat keeps going
  const hidden = log.slice(before);
  assert.equal(hidden.filter((e) => e.k === 'hit').length, 0, 'no kickDetected nobody can see');
  assert.ok(hidden.filter((e) => e.k === 'step').every((e) => e.quiet), 'steps are told quietly');
  assert.equal(hidden.filter((e) => e.k === 'step' && e.i === 0 && e.announce).length, 5, 'each bar start announced once, in its time');
  assert.ok(w.notes.filter((n) => n.time + t._k > w.T - 10 && n.time + t._k < w.T).length >= 30, 'the drums kept sounding');
  w.hidden = false;
  const back = log.length;
  t.frame();                                            // the first frame back
  assert.ok(log.length - back <= 3, `no flood when the tab comes back (${log.length - back} told)`);
});

test('a frame loop stuck for 2 s: the stretch it missed is told quietly (one bar start), the present loudly', () => {
  const w = world(); w.startAudio(); w.T += 0.2;
  const { t, log } = transport(w);
  t.start();
  run(w, t, 1, { frame: 1 / 60 });
  const n0 = log.length;
  w.T += 2;                                             // nothing at all ran for 2 s (not even the worker's messages)
  t.frame();
  const burst = log.slice(n0);
  assert.equal(burst.filter((e) => e.k === 'hit').length, burst.filter((e) => e.k === 'hit' && w.T - e.t < 0.25).length);
  assert.ok(burst.filter((e) => e.k === 'hit').length <= 2, 'only what is heard right now is told as a hit');
  assert.ok(burst.filter((e) => e.k === 'step' && e.i === 0 && e.announce).length <= 1);
});

test('a draw() longer than the lookahead: the late hit is counted and the lookahead grows to 0.3 s', () => {
  const w = world(); w.startAudio(); w.T += 0.2;
  const { t } = transport(w);
  t.start();
  run(w, t, 1);
  assert.equal(t.lookahead, 0.1);
  w.T += 0.2;                                           // the page blocked for 200 ms: the window it should have scheduled is late
  t.pump();
  assert.ok(t.late >= 1);
  assert.equal(t.lookahead, 0.3);
  assert.equal(t.info().extended, true);
});

test('a pattern change mid-bar is heard at once: what was handed over is taken back, nothing doubles', () => {
  const w = world(); w.startAudio(); w.T += 0.2;
  const { t, log } = transport(w);
  t.start();
  run(w, t, 1.0);                                       // 50 ms before step 8 (a kick and a hat), which is already handed over
  t.setPattern({ kick: 'x.x.x.x.x.x.x.x.' });
  run(w, t, 2);
  const steps = log.filter((e) => e.k === 'step').map((e) => e.n);
  assert.deepEqual(steps, steps.map((_, i) => i));
  const kicks = w.notes.filter((n) => n.note === GM.kick && !n.cancelled).map((n) => n.time);
  assert.equal(new Set(kicks.map((x) => x.toFixed(9))).size, kicks.length);
  assert.ok(w.notes.some((n) => n.cancelled && n.note === GM.hat), "four on floor's hats ahead of the change were taken back");
  const after = log.filter((e) => e.k === 'hit' && e.n >= 8 && e.n < 16).map((e) => e.voice + e.n);
  assert.deepEqual(after, ['kick8', 'kick10', 'kick12', 'kick14'], 'the new grid from the next 16th on');
});

test('a compiled rhythm: triplets at their exact time, a crash (no lane) plays and is told, tokens ride along', () => {
  const rhythm = { ok: true, eventsInBar: (bar) => [
    { word: 'bd', voice: 'kick', pos: 0, dur: 1 / 3, vel: 1, layer: 0, token: { start: 0, end: 2 } },
    { word: 'sd', voice: 'snare', pos: 1 / 3, dur: 1 / 3, vel: 1, layer: 0, token: { start: 3, end: 5 } },
    { word: 'cr', voice: 'crash', pos: 2 / 3, dur: 1 / 3, vel: 0.5, layer: 0, token: { start: 6, end: 8 } },
    ...(bar % 2 ? [] : [{ word: 'oh', voice: 'openhat', pos: 0.5, dur: 0.1, layer: 1, token: { start: 10, end: 12 } }]),
  ] };
  const w = world(); w.startAudio(); w.T += 0.2;
  const { t, log } = transport(w);
  t.setPattern(rhythm, { text: 'bd sd cr, ~ oh' });
  assert.equal(t.mode, 'string'); assert.equal(t.pattern, 'bd sd cr, ~ oh');
  t.start();
  run(w, t, 4.1);
  const start = t.scheduler._tempo[0].time;
  const sn = w.notes.filter((n) => n.note === GM.snare).map((n) => n.time + t._k);
  assert.ok(Math.abs(sn[0] - (start + 2 / 3)) < 1e-9 && Math.abs(sn[1] - (start + 2 + 2 / 3)) < 1e-9, 'a third of a 2-s bar');
  assert.equal(w.notes.filter((n) => n.note === GM.crash).length, 2);
  assert.equal(w.notes.filter((n) => n.note === GM.openhat).length, 1, 'bar 2 only');
  const crash = log.find((e) => e.k === 'hit' && e.voice === 'crash');
  assert.ok(crash, 'the crash reaches onHit (drumHit) though the grid has no lane for it');
  const r = t.scheduler.gridOf(2);
  assert.deepEqual(r.dropped, ['openhat', 'crash']);
  assert.equal(r.offGrid, 1, 'the triplet snare moved to the nearest 16th');
  assert.equal(r.grid.snare[5], 1);
});

test('drumPhase / beatPhase: 0.25 and 0 at 0.5 s into a 120-bpm bar, rising through the bar, ~0 in the frame a kick is heard', () => {
  const w = world(); w.startAudio(); w.T += 0.2;
  const { t, log } = transport(w);
  t.start();
  const t0 = t.scheduler._tempo[0].time;
  let prev = -1, kickBeats = [];
  const seen = log.length;
  while (w.T < 100.2 + 6) {
    w.T += 1 / 60; t.pump(); const told = t.frame();
    const p = t.phase();
    if (t.times().heard > t0 + 0.01 && t.times().heard < t0 + 1.99) { assert.ok(p.bar >= prev - 1e-12, 'rises through bar 1'); prev = p.bar; }
    if (told.some((e) => e.kind === 'hit' && e.voice === 'kick')) kickBeats.push(p.beat);
  }
  assert.ok(log.length > seen);
  assert.ok(kickBeats.length >= 10 && kickBeats.every((b) => b < 0.05), `beatPhase in the kick's frame: ${kickBeats.map((b) => b.toFixed(3))}`);
  const s = new DrumScheduler({ bpm: 120 }); s.start(10);
  assert.ok(Math.abs(s.phaseAt(10.5).bar - 0.25) < 0.01 && s.phaseAt(10.5).beat < 0.01);
  assert.ok(Math.abs(s.phaseAt(11.75).beat - 0.5) < 0.01);
  assert.equal(s.phaseAt(9).bar, 0, 'before the downbeat: 0');
});

test('the output latency the browser reports: a hit is told when it leaves the speakers, not when it is handed over', () => {
  const w = world({ latency: 0.15 }); w.startAudio(); w.T += 0.2;
  const { t, log } = transport(w);
  t.start();
  run(w, t, 1);
  const first = w.notes[0], heardAt = log.find((e) => e.k === 'hit').t;
  assert.ok(heardAt - (w.ctxStart + first.time) >= 0.15 - 1 / 60, `told ${((heardAt - w.ctxStart - first.time) * 1000).toFixed(0)} ms after it was due on the context clock`);
});

test('the kit schedules a hit at its time and can take back one that has not started', () => {
  const made = [];
  class Param { setValueAtTime() {} linearRampToValueAtTime() {} exponentialRampToValueAtTime() {} }
  class Node { constructor(kind) { this.kind = kind; this.gain = new Param(); this.frequency = new Param(); this.Q = {}; this.out = []; made.push(this); }
    connect(n) { this.out.push(n); return n; } disconnect() { this.out = []; this.gone = true; } start(t) { this.at = t; } stop() {} }
  class Ctx { constructor() { this.state = 'running'; this.currentTime = 5; this.sampleRate = 48000; this.destination = new Node('dest'); }
    createGain() { return new Node('gain'); } createOscillator() { return new Node('osc'); } createBiquadFilter() { return new Node('filter'); }
    createBufferSource() { return new Node('src'); } createBuffer(c, n) { return { getChannelData: () => new Float32Array(n) }; } close() {} }
  const saved = globalThis.window; globalThis.window = { AudioContext: Ctx };
  try {
    const kit = drumEngine();
    return kit.enable().then(() => {
      const h = kit.noteOn(GM.kick, 0.9, 5.25);
      assert.equal(h.time, 5.25);
      assert.equal(made.find((n) => n.kind === 'osc').at, 5.25, 'the oscillator starts at the time asked for');
      assert.equal(kit.noteOn(GM.snare, 0.9, 1).time, 5, 'a time already past plays now');
      assert.equal(kit.noteOn(60, 0.9), null, 'a melodic note: nothing');
      const voice = made.filter((n) => n.kind === 'gain').find((g) => g.out[0] === made.find((m) => m.kind === 'gain' && m.out[0] === kit.context.destination));
      h.cancel();
      assert.ok(made.some((n) => n.kind === 'gain' && n.gone), 'cancel() disconnects the hit');
      assert.ok(voice !== undefined);
    });
  } finally { globalThis.window = saved; }
});

test('lane names a person reads: Chinese where the page is Chinese, English stays as it was', () => {
  assert.deepEqual(['kick', 'snare', 'hat', 'clap'].map((v) => drumName(v, 'zh')), ['大鼓', '小鼓', '鈸', '拍手']);
  assert.deepEqual(['kick', 'snare', 'hat', 'clap'].map((v) => drumName(v)), ['kick', 'snare', 'hat', 'clap']);
  assert.equal(drumName('crash', 'zh'), '碎音鈸');
});

test('swing (off by default, as the grid machine always played straight) delays every odd 16th', () => {
  const s = new DrumScheduler({ bpm: 120, humanize: 0, swing: 0.5, pattern: { hat: 'xxxxxxxxxxxxxxxx' } });
  s.start(0);
  const hats = s.advance(1).filter((e) => e.kind === 'hit').map((e) => e.time);
  assert.ok(Math.abs(hats[1] - (0.125 + 0.0625)) < 1e-9 && Math.abs(hats[2] - 0.25) < 1e-9);
  assert.equal(new DrumScheduler().swing, 0);
});
