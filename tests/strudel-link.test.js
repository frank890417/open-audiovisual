// oav-p5 0.7: other programs on the page and across the room. The virtual OUTPUT port heard (Strudel's
// `.midi('OAV Virtual MIDI')` → notePressed, at the timestamp it gave), no feedback loop between it and the virtual
// input, an external clock moving drumPhase and the drum machine, a link between pages (@openav/relay's MidiLink over the
// relay), Strudel's own names said once, and 🩺's "Other programs" row. Fake clocks; the browser half (on strudel.cc
// itself) is p5/test/strudel-smoke.cjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import http from 'node:http';
import vm from 'node:vm';
import { attachRelay } from '../packages/relay/server.js';
import { MidiLink, LinkTiming } from '../packages/relay/link.js';
import { DrumScheduler, DrumTransport } from '../packages/drums/index.js';

const SRC = readFileSync(new URL('../p5/oav-p5.js', import.meta.url), 'utf8');
const MODULES = {
  'packages/midi/virtual-access.js': () => import('../packages/midi/virtual-access.js'),
  'packages/midi/clock.js': () => import('../packages/midi/clock.js'),
};
const plain = (o) => JSON.parse(JSON.stringify(o));
const settle = async () => { for (let i = 0; i < 20; i++) await new Promise((r) => setImmediate(r)); };

/** a fake performance clock (ms) and timers that run only when told to */
function fakeTime(T0 = 1000) {
  const ft = { T: T0, timers: [], id: 0 };
  ft.performance = { now: () => ft.T, timeOrigin: 1.7e12 };
  ft.setTimeout = (fn, ms) => { const id = ++ft.id; ft.timers.push({ id, at: ft.T + Math.max(0, +ms || 0), fn }); return id; };
  ft.clearTimeout = (id) => { ft.timers = ft.timers.filter((x) => x.id !== id); };
  ft.to = (end) => {
    for (;;) {
      ft.timers.sort((a, b) => a.at - b.at || a.id - b.id);
      const x = ft.timers[0];
      if (!x || x.at > end) break;
      ft.timers.shift(); ft.T = Math.max(ft.T, x.at); x.fn();
    }
    ft.T = Math.max(ft.T, end);
  };
  ft.advance = (ms) => ft.to(ft.T + ms);
  return ft;
}
/** a page with no document (oav-p5 runs headless), a fake clock, and lazy modules from a map */
function page(globals = {}, modules = {}) {
  const ft = fakeTime();
  const log = [];
  const win = { console: { info: (...a) => log.push(a.join(' ')), warn: (...a) => log.push(a.join(' ')), error() {} }, navigator: {}, location: { search: '', hostname: 'example.org' },
    URL, URLSearchParams, Promise, setInterval, clearInterval, performance: ft.performance, setTimeout: ft.setTimeout, clearTimeout: ft.clearTimeout, ...globals };
  win.window = win; win.globalThis = win;
  vm.runInNewContext(SRC, win);
  const all = { ...MODULES, ...modules };
  win.OAVp5._import = (url) => { const k = Object.keys(all).find((x) => url.includes(x)); return k ? Promise.resolve(all[k]()) : Promise.reject(new Error('not in this test: ' + url)); };
  return { w: win, ft, log };
}
async function ports(w) {
  const access = await w.navigator.requestMIDIAccess();
  const out = [...access.outputs.values()].find((p) => p.name === 'OAV Virtual MIDI');
  const inp = [...access.inputs.values()].find((p) => p.name === 'OAV Virtual MIDI');
  return { access, out, inp };
}

// ---------------------------------------------------------------- the virtual output, heard

test('0.7: a program that plays into "OAV Virtual MIDI" is heard by the sketch — at the timestamp it gave, in order, source virtual-out', async () => {
  const got = [];
  const { w, ft } = page({ notePressed: (n, v) => got.push(['p', n, Math.round(v * 127), ft.T]), noteReleased: (n) => got.push(['r', n, ft.T]) });
  const { out } = await ports(w);
  assert.ok(out, 'the virtual output is listed');
  // what Strudel sends for note("c3 e3 g3 c4").midi('OAV Virtual MIDI'): each note-on with its note-off, both at once,
  // 250 ms ahead, the note-off 1 ms before the next note-on
  [48, 52, 55, 60].forEach((n, i) => { out.send([0x90, n, 114], 1250 + 500 * i); out.send([0x80, n, 64], 1250 + 500 * i + 499); });
  ft.advance(200);
  assert.deepEqual(got, [], 'nothing before its time');
  ft.to(3000);
  assert.deepEqual(got, [['p', 48, 114, 1250], ['r', 48, 1749], ['p', 52, 114, 1750], ['r', 52, 2249], ['p', 55, 114, 2250], ['r', 55, 2749], ['p', 60, 114, 2750]]);
  ft.to(3300);
  assert.deepEqual(got.at(-1), ['r', 60, 3249]);
  assert.equal(w.midi.last.source, 'virtual-out');
  // no timestamp: now; two messages in one send(): both, in order; a knob
  out.send([0x90, 64, 100, 0x80, 64, 0]);
  out.send([0xB0, 74, 127]);
  assert.deepEqual(got.slice(-2), [['p', 64, 100, ft.T], ['r', 64, ft.T]]);
  assert.equal(w.knob1, 1, 'CC 74 is knob 1 on the on-screen MiniLab 3');
});

test('0.7: no feedback loop — what comes in on the virtual OUTPUT never goes back out of the virtual INPUT (Strudel midin ↔ .midi)', async () => {
  let pressed = 0;
  const { w, ft } = page({ notePressed: () => pressed++ });
  const { out, inp } = await ports(w);
  let echoed = 0;
  inp.onmidimessage = (e) => { echoed++; out.send(e.data); };          // a program that plays back out whatever it hears (midikeys → .midi)
  out.send([0x90, 60, 100]);
  ft.advance(1000);
  assert.equal(pressed, 1, 'heard once');
  assert.equal(echoed, 0, 'and not handed to the program listening on the input');
  w.midi.play(64, 0.8);                                                 // the 🎹 on screen: the program hears it and plays it back out
  ft.advance(1000);
  assert.equal(echoed, 1, 'the program heard the screen once');
  assert.equal(pressed, 3, 'the screen note, and its echo from the program, once each');
  for (let i = 0; i < 50; i++) ft.advance(20);
  assert.equal(echoed, 1, 'and nothing bounces after that');
  assert.equal(inp.listening, 1, 'the input knows one program listens');
});

test('0.7: output.clear() drops what waits, but a waiting note-off lands now (no key left held)', async () => {
  const { w, ft } = page();
  const { out } = await ports(w);
  out.send([0x90, 60, 100]);
  assert.deepEqual([...w.midi.held], [60], 'heard at once (no timestamp)');
  out.send([0x80, 60, 0], ft.T + 300); out.send([0x90, 62, 100], ft.T + 400);
  out.clear();
  assert.deepEqual([...w.midi.held], [], 'the note-off came at once');
  ft.advance(1000);
  assert.equal(w.midi.note[62], 0, 'the dropped note-on never came');
});

// ---------------------------------------------------------------- the external clock

/** Strudel's `midicmd("clock*96, <start stop>/2").midi('OAV Virtual MIDI')` at 120 bpm: sent 250 ms ahead, in 100 ms
 *  slices, the start three times with one timestamp (as measured on strudel.cc) */
function strudelClock(ft, out, { from, startAt, stopAt = Infinity, until, bpm = 120 }) {
  const dt = 60000 / bpm / 24;
  let k = Math.ceil((from - startAt) / dt), sentStart = false, sentStop = false;
  for (let now = ft.T; now < until; now += 100) {
    ft.to(now);
    const horizon = now + 250;
    while (startAt + k * dt < horizon && startAt + k * dt < until) {
      const t = startAt + k * dt;
      if (!sentStart && t >= startAt - 0.01) { out.send([0xFA], startAt); out.send([0xFA], startAt); out.send([0xFA], startAt); sentStart = true; }
      if (!sentStop && t >= stopAt) { out.send([0xFC], stopAt); sentStop = true; }
      out.send([0xF8], t); k++;
    }
  }
  ft.to(until);
}

test('0.7: an external clock (Strudel\'s midicmd) moves drumPhase, beatPhase, drumBar, drumStep, drumBpm — no drum machine needed', async () => {
  const { w, ft, log } = page();
  const { out } = await ports(w);
  const first = 2000 - 35 * 60000 / 120 / 24;                           // Strudel's clock runs before its start
  out.send([0xF8], first);
  await settle();                                                       // packages/midi/clock.js, the first time
  strudelClock(ft, out, { from: first + 1, startAt: 2000, until: 6000 });
  const at = (t) => { ft.to(t); return { bar: w.drumPhase, beat: w.beatPhase, drumBar: w.drumBar, step: w.drumStep, bpm: w.drumBpm }; };
  const a = at(6280);                                                   // start at 2000 ms, a 2-s bar: 4.28 s = bar 3, 0.14 in
  assert.ok(Math.abs(a.bar - 0.14) < 0.002 && Math.abs(a.beat - 0.56) < 0.008, JSON.stringify(a));
  assert.equal(a.drumBar, 3); assert.equal(a.step, 2); assert.equal(a.bpm, 120);
  const ci = plain(w.OAVp5.clock.info);
  assert.equal(ci.state, 'running'); assert.equal(ci.bpm, 120); assert.equal(ci.starts, 1); assert.equal(ci.dupes, 2, 'the start ×3 counted once');
  assert.equal(ci.source, 'virtual-out');
  assert.equal(log.filter((l) => /external MIDI clock \(120 BPM\)/.test(l)).length, 1, `said once in the console: ${log.join(' | ')}`);
});

test('0.7: the drum machine follows an external start, tempo and stop; without a clock it is 0.6 (clock=off: it ignores one)', async () => {
  const { w, ft } = page();
  const { out } = await ports(w);
  // a stand-in for mountDrums' machine around a real DrumTransport on this page's fake clock (no AudioContext: performance time)
  const seq = new DrumTransport({ scheduler: new DrumScheduler({ bpm: 112, humanize: 0 }), heartbeat: false, now: () => ft.T / 1000, hidden: () => false });
  w.OAVp5.drums.machine = { seq, root: null, update() { seq.frame(); }, phase: () => seq.phase(), info: () => seq.info(), setBpm: (b) => seq.setBpm(b) };
  w.OAVp5.drums.state = 'stopped';
  const first = 2000 - 30 * 60000 / 128 / 24;
  out.send([0xF8], first);
  await settle();
  strudelClock(ft, out, { from: first + 1, startAt: 2000, stopAt: 6000, until: 5900, bpm: 128 });
  assert.equal(seq.playing, true, 'started by the external start');
  assert.equal(w.OAVp5.drums.state, 'on');
  const f = seq.followInfo();
  assert.ok(f && Math.abs(f.bpm - 128) < 0.01 && Math.abs(f.err) < 0.002, JSON.stringify(f));
  const expect = ((5900 - 2000) / 1000 * 128 / 240) % 1;
  assert.ok(Math.abs(seq.phase().bar - expect) < 0.004, `drumPhase ${seq.phase().bar} vs the clock's ${expect}`);
  strudelClock(ft, out, { from: 5900, startAt: 2000, stopAt: 6000, until: 6500, bpm: 128 });
  assert.equal(seq.playing, false, 'stopped at the external stop');
  // clock=off
  const off = page({ OAV_P5: { clock: 'off' } });
  const p2 = await ports(off.w);
  p2.out.send([0xFA]); p2.out.send([0xF8]);
  await settle();
  assert.equal(off.w.OAVp5.clock.info.state, 'none');
});

// ---------------------------------------------------------------- a link between pages

test('0.7: link=<room> — what the programs play goes out with its time; what comes in is told when it sounds; never sent on, and an echo is held back', async () => {
  const stub = { sent: [], o: null };
  class FakeLink { constructor(o) { stub.o = o; } connect() {} send(b, t) { stub.sent.push([[...b], t]); } }
  let pressed = [];
  const { w, ft } = page({ OAV_P5: { link: 'class-4' }, notePressed: (n) => pressed.push([n, ft.T, w.midi.last.source]) }, { 'packages/relay/link.js': () => ({ MidiLink: FakeLink }) });
  await settle();
  assert.equal(stub.o.room, 'class-4');
  const { out, inp } = await ports(w);
  out.send([0x90, 60, 100], ft.T + 200); out.send([0xF8], ft.T + 210);
  assert.deepEqual(stub.sent, [[[0x90, 60, 100], 1200], [[0xF8], 1210]], 'notes and clock, with when they sound');
  // a linked page's note arrives: told at its time, source link, and handed to this page's Web MIDI programs
  let heard = 0;
  inp.onmidimessage = (e) => { heard++; out.send(e.data); };          // a program that plays back out what it hears
  stub.o.onMessages([{ bytes: [0x90, 67, 90], at: ft.T + 50, late: false }]);
  ft.advance(40); assert.equal(pressed.filter((p) => p[0] === 67).length, 0);
  ft.advance(20);
  assert.deepEqual(pressed.find((p) => p[0] === 67), [67, 1050, 'link']);
  assert.equal(heard, 1);
  ft.advance(10);
  assert.equal(stub.sent.filter((s) => s[0][1] === 67).length, 0, 'its echo through the program is not sent back to the room');
  assert.equal(w.OAVp5.check({ show: false }).external.echoes, 1);
  out.send([0x90, 72, 100]);
  assert.equal(stub.sent.filter((s) => s[0][1] === 72).length, 1, 'a note of its own still goes');
  assert.equal(w.OAVp5.options.link, 'class-4');
});

async function relayServer() {
  const server = http.createServer();
  const relay = attachRelay(server);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return { url: `ws://127.0.0.1:${server.address().port}/relay`, close: () => { relay.close(); server.close(); } };
}
const until = async (fn, ms = 3000) => { const t0 = Date.now(); while (!fn()) { if (Date.now() - t0 > ms) throw new Error('timed out'); await new Promise((r) => setTimeout(r, 10)); } };

test('MidiLink over a real relay: page B hears page A\'s note at A\'s time (same machine: within a few ms), not its own, each message once; late ones play at once', async (t) => {
  if (typeof WebSocket !== 'function') return t.skip('no WebSocket in this Node');
  const r = await relayServer();
  const inbox = { a: [], b: [] };
  const A = new MidiLink({ url: r.url, room: 'r1', id: 'pageA', onMessages: (l) => inbox.a.push(...l), beaconMs: 100 });
  const B = new MidiLink({ url: r.url, room: 'r1', id: 'pageB', onMessages: (l) => inbox.b.push(...l), beaconMs: 100 });
  const other = new MidiLink({ url: r.url, room: 'r2', id: 'pageC', onMessages: () => { throw new Error('another room heard it'); } });
  try {
    A.connect(); B.connect(); other.connect();
    await until(() => A.open && B.open && other.open && B.peerCount() === 1 && A.peerCount() === 1);
    const when = performance.now() + 200;
    A.send([0x90, 60, 100], when); A.send([0x80, 60, 0], when + 499);
    await until(() => inbox.b.length === 2);
    assert.deepEqual(inbox.b.map((x) => x.bytes), [[0x90, 60, 100], [0x80, 60, 0]]);
    const err = inbox.b[0].at - when;
    assert.ok(Math.abs(err) < 15, `B will play it ${err.toFixed(2)} ms from when A plays it`);
    assert.equal(inbox.b[0].late, false);
    assert.equal(inbox.a.length, 0, 'A does not hear itself');
    B._receive({ v: 1, src: 'pageA', seq: A.seq, at: A.now(), items: [[A.now(), 0x90, 1, 1]] });
    assert.equal(B.stats.dupes, 1, 'the same message twice: once');
    A.send([0x90, 61, 100], performance.now() - 500);                    // sent with no lead at all (already past)
    await until(() => inbox.b.length === 3);
    assert.equal(inbox.b[2].late, true);
    const i = B.info();
    assert.equal(i.state, 'open'); assert.equal(i.peers, 1); assert.ok(i.received >= 3);
  } finally { A.close(); B.close(); other.close(); r.close(); }
});

test('LinkTiming: two computers 5 s apart with a jittery 40–120 ms trip → the clock difference, from the fastest trip', () => {
  const lt = new LinkTiming();
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  let fastest = Infinity;
  for (let k = 0; k < 20; k++) { const at = 1e6 + k * 500, trip = 40 + rnd() * 80; fastest = Math.min(fastest, trip); lt.sample(at, at + 5000 + trip); }   // 10 s of messages
  const d = lt.diff(40);                                                  // the trip the two ping round trips say: 40 ms
  assert.ok(Math.abs(d - 5000 - (fastest - 40)) < 1e-6, `off by exactly how much slower the fastest trip was than 40 ms: ${d}`);
  assert.ok(Math.abs(d - 5000) < 10, `${d}`);
  for (let k = 0; k < 30; k++) lt.sample(2e6 + k * 500, 2e6 + k * 500 + 5000 + 200);   // 10 s later the route is slower
  assert.ok(Math.abs(lt.diff(200) - 5000) < 1e-6, 'samples older than 10 s are forgotten');
});

// ---------------------------------------------------------------- in Strudel

test('0.7: in Strudel — its note / velocity / beat are said once (with what to read instead), MIDI waits for its midin(), the panel is compact', async () => {
  let asked = 0;
  const fn = () => {};
  const { w } = page({ location: { search: '', hostname: 'strudel.cc' }, note: fn, velocity: fn, beat: fn, s: fn, stack: fn, samples: fn,
    navigator: { requestMIDIAccess: () => { asked++; return Promise.resolve({ inputs: new Map(), outputs: new Map(), addEventListener() {} }); }, language: 'en-US' } });
  assert.equal(asked, 0, 'hardware=click: no permission prompt when it loads');
  assert.equal(w.OAVp5.options.hardware, 'click');
  assert.equal(w.OAVp5.options.compact, true);
  assert.equal(w.note, fn, "Strudel's note() untouched"); assert.equal(w.beat, fn);
  const h = w.OAVp5.hints.find((x) => x.id === 'strudelNames');
  assert.ok(h, 'one card');
  assert.match(h.what, /beat, note, velocity \(Strudel's\)/);
  assert.match(h.next, /beat → OAVp5\.mic\.on\('beat', fn\); note → OAVp5\.last\.note; velocity → OAVp5\.last\.value/);
  w.midi.input([0x90, 60, 100]);
  assert.equal(w.OAVp5.hints.filter((x) => /^own:/.test(x.id)).length, 0, 'not the sketch card ("your sketch has its own note")');
  assert.equal(w.OAVp5.last.note, 60);
  void w.knob1;                                                           // read from "the code"
  assert.match(w.OAVp5.check({ show: false }).wiring, /knob1 \(your code\)/);
  // the same globals on an ordinary page with strudel=off: a p5 page as before (the hint comes on first use)
  const p = page({ OAV_P5: { strudel: 'off' }, note: fn });
  assert.equal(p.w.OAVp5.options.compact, false); assert.equal(p.w.OAVp5.options.hardware, 'auto');
  assert.equal(p.w.OAVp5.hints.find((x) => x.id === 'strudelNames'), undefined);
});

test('0.7: 🩺 says what other programs did — nothing asked yet, then the port, its output, the clock', async () => {
  const { w, ft } = page();
  assert.match(w.OAVp5.check({ show: false }).text, /Other programs: no program has asked OAV Virtual MIDI for MIDI \(if this page opened MIDI before oav-p5 loaded, reload/);
  const { out, inp } = await ports(w);
  inp.addEventListener('midimessage', () => {});
  out.send([0x90, 60, 100]);
  ft.advance(300);
  out.send([0xF8], ft.T); await settle();
  for (let k = 1; k < 30; k++) out.send([0xF8], ft.T + k * 20.8333);
  ft.advance(100);
  const r = w.OAVp5.check({ show: false });
  assert.match(r.text, /Other programs: OAV Virtual MIDI handed out 1× · 1 listening on its input · its output got 31 \(last clock, [\d.]+ s ago\) · clock 120 BPM \(running\)/);
  assert.equal(r.external.asked, 1); assert.equal(r.external.out, 31);
});
