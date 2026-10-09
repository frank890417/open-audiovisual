// MIDI output hot-plug, our-own-echo filtering, and the score → MIDI markers.
// Pure logic first (packages/midi/ports.js, score-out.js), then the Midi engine against a fake MIDIAccess.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickOutput, reselectOutput, EchoGuard, isLive } from '../packages/midi/ports.js';
import { ScoreMidi } from '../packages/midi/score-out.js';
import { Midi } from '../packages/midi/index.js';

const port = (name, state = 'connected') => ({ name, state, sent: [], send(b) { this.sent.push([...b]); } });

// ───────────── choosing an output ─────────────

test('pickOutput: your named port, else the preference list in order, else the first; never a disconnected one', () => {
  const a = port('Synth A'), iac = port('IAC Driver Bus 1'), b = port('Synth B');
  const all = [a, iac, b];
  assert.equal(pickOutput(all), a, 'no preference: the first');
  assert.equal(pickOutput(all, { preferred: 'Synth B' }), b, 'exact name');
  assert.equal(pickOutput(all, { preferred: 'IAC' }), iac, 'substring');
  assert.equal(pickOutput(all, { prefer: ['IAC'] }), iac, 'preference list');
  assert.equal(pickOutput(all, { prefer: [/synth b/i, 'IAC'] }), b, 'first entry that matches wins');
  assert.equal(pickOutput(all, { preferred: 'nope', prefer: ['also nope'] }), a, 'falls through to the first');
  assert.equal(pickOutput([port('X', 'disconnected'), b]), b, 'disconnected ports are skipped');
  assert.equal(pickOutput([port('X', 'disconnected')]), null);
  assert.equal(pickOutput([]), null);
  assert.equal(isLive(port('p')), true);
  assert.equal(isLive(port('p', 'disconnected')), false);
  assert.equal(isLive(null), false);
});

test('reselectOutput: the current port died → the next best by priority; the line says what happened', () => {
  const iac = port('IAC Driver Bus 1'), other = port('Other');
  const dead = port('IAC Driver Bus 1', 'disconnected');
  const r = reselectOutput({ current: dead, outputs: [other], preferred: 'IAC Driver Bus 1' });
  assert.equal(r.next, other);
  assert.equal(r.changed, true);
  assert.equal(r.reason, 'fallback');
  assert.match(r.text, /switched to "Other" \("IAC Driver Bus 1" was unplugged\)/);
  // gone from the list entirely (Chrome removes it) is the same as disconnected
  assert.equal(reselectOutput({ current: iac, outputs: [other] }).next, other);
  // nothing left
  const none = reselectOutput({ current: iac, outputs: [] });
  assert.equal(none.next, null);
  assert.equal(none.reason, 'none');
  assert.match(none.text, /no output left/);
});

test('reselectOutput: the port you named comes back → the output moves back to it', () => {
  const iac = port('IAC Driver Bus 1'), other = port('Other');
  const r = reselectOutput({ current: other, outputs: [other, iac], preferred: 'IAC Driver Bus 1' });
  assert.equal(r.next, iac);
  assert.equal(r.reason, 'back');
  assert.match(r.text, /back on your choice "IAC Driver Bus 1"/);
  // a substring preference counts too
  assert.equal(reselectOutput({ current: other, outputs: [other, iac], preferred: 'IAC' }).next, iac);
});

test('reselectOutput: an unrelated device appearing never steals the output', () => {
  const a = port('A'), b = port('B');
  const r = reselectOutput({ current: b, outputs: [a, b] });      // b is in use though a is listed first: a is not "better"
  assert.equal(r.changed, false);
  assert.equal(r.next, b);
  assert.equal(r.text, '');
  // also with a preference that is simply not plugged in
  assert.equal(reselectOutput({ current: b, outputs: [a, b], preferred: 'Missing' }).changed, false);
});

test('reselectOutput: from nothing to a port says it connected', () => {
  const a = port('A');
  const r = reselectOutput({ current: null, outputs: [a] });
  assert.equal(r.next, a);
  assert.equal(r.reason, 'found');
  assert.match(r.text, /connected to "A"/);
});

// ───────────── hearing ourselves ─────────────

test('EchoGuard: bytes we sent that come back within the window are echo, once each', () => {
  const g = new EchoGuard({ window: 40 });
  g.sent([0x90, 60, 100], 1000);
  assert.equal(g.isEcho([0x90, 60, 100], 1010), true, 'the echo');
  assert.equal(g.isEcho([0x90, 60, 100], 1011), false, 'one send explains one echo, not two');
  g.sent([0xb0, 74, 64], 2000);
  assert.equal(g.isEcho([0xb0, 74, 65], 2005), false, 'a different value is a performer');
  assert.equal(g.isEcho([0xb0, 74, 64], 2005), true);
});

test('EchoGuard: too late is not an echo; a note-on with velocity 0 is the same as a note-off; system messages are ignored; window 0 turns it off', () => {
  const g = new EchoGuard({ window: 40 });
  g.sent([0x90, 60, 100], 1000);
  assert.equal(g.isEcho([0x90, 60, 100], 1100), false, 'a real note played 100 ms later');
  g.sent([0x80, 61, 0], 2000);
  assert.equal(g.isEcho([0x90, 61, 0], 2003), true, 'note-off came back as note-on vel 0');
  g.sent([0xf8], 3000);
  assert.equal(g.isEcho([0xf8], 3001), false, 'clock is not recorded');
  const off = new EchoGuard({ window: 0 });
  off.sent([0x90, 1, 1], 0);
  assert.equal(off.isEcho([0x90, 1, 1], 1), false);
});

test('EchoGuard: remembers only the newest `max` messages', () => {
  const g = new EchoGuard({ window: 1e9, max: 3 });
  for (let n = 0; n < 5; n++) g.sent([0x90, n, 100], n);
  assert.equal(g.isEcho([0x90, 0, 100], 10), false, 'the oldest was forgotten');
  assert.equal(g.isEcho([0x90, 4, 100], 10), true);
});

// ───────────── the Midi engine against a fake MIDIAccess ─────────────

function fakeAccess({ outputs = [], inputs = [] } = {}) {
  const acc = {
    outputs: new Map(outputs.map((o) => [o.name, o])),
    inputs: new Map(inputs.map((i) => [i.name, i])),
    onstatechange: null,
    plugOut(o) { acc.outputs.set(o.name, o); acc.onstatechange?.({}); },
    unplugOut(o) { acc.outputs.delete(o.name); o.state = 'disconnected'; acc.onstatechange?.({}); },
  };
  return acc;
}
const input = (name) => ({ name, state: 'connected', onmidimessage: null, fire(bytes) { this.onmidimessage?.({ data: Uint8Array.from(bytes) }); } });
async function engine(access, opts = {}, preferred = '') {
  const m = new Midi({ requestAccess: async () => access, ...opts });
  const lines = []; m.onMessage = (x) => lines.push(x);
  assert.equal(await m.enable(preferred), true);
  return { m, lines };
}
const quietWarn = (fn) => { const w = console.warn; const out = []; console.warn = (...a) => out.push(a.join(' ')); try { return [fn(), out]; } finally { console.warn = w; } };

test('Midi: the chosen output is unplugged → output moves on, one line in the MIDI log and one in the console; messages reach the new port', async () => {
  const iac = port('IAC Driver Bus 1'), synth = port('Synth');
  const acc = fakeAccess({ outputs: [iac, synth] });
  const { m, lines } = await engine(acc, {}, 'IAC Driver Bus 1');
  assert.equal(m.out, iac);
  m.noteOn(60, 100, 1);
  assert.deepEqual(iac.sent, [[0x90, 60, 100]]);
  const before = lines.length;
  const [, warned] = quietWarn(() => acc.unplugOut(iac));
  assert.equal(m.out, synth);
  const out = lines.slice(before).filter((l) => l.dir === 'out');
  assert.equal(out.length, 1, 'exactly one MIDI log line for the switch');
  assert.match(out[0].text, /switched to "Synth" \("IAC Driver Bus 1" was unplugged\)/);
  assert.equal(warned.length, 1, 'and one console line');
  m.noteOn(61, 100, 1);
  assert.deepEqual(synth.sent, [[0x90, 61, 100]]);
  assert.equal(iac.sent.length, 1, 'nothing more into the dead port');
});

test('Midi: the port you chose is plugged back in → the output returns to it', async () => {
  const iac = port('IAC Driver Bus 1'), synth = port('Synth');
  const acc = fakeAccess({ outputs: [iac, synth] });
  const { m, lines } = await engine(acc, {}, 'IAC Driver Bus 1');
  quietWarn(() => acc.unplugOut(iac));
  const iac2 = port('IAC Driver Bus 1');
  const changes = [];
  m.onOutput((c) => changes.push(c.reason));
  const [, warned] = quietWarn(() => acc.plugOut(iac2));
  assert.equal(m.out, iac2);
  assert.deepEqual(changes, ['back']);
  assert.equal(warned.length, 1);
  assert.match(lines.filter((l) => l.dir === 'out').at(-1).text, /back on your choice "IAC Driver Bus 1"/);
});

test('Midi: with no choice made, the port the engine started on is the one that returns', async () => {
  const a = port('A'), b = port('B');
  const acc = fakeAccess({ outputs: [a, b] });
  const { m } = await engine(acc);
  assert.equal(m.out, a);
  quietWarn(() => acc.unplugOut(a));
  assert.equal(m.out, b);
  quietWarn(() => acc.unplugOut(b));
  assert.equal(m.out, null);
  quietWarn(() => acc.plugOut(port('B')));
  assert.equal(m.out.name, 'B', 'a stand-in is not remembered as wanted: anything is better than nothing');
  quietWarn(() => acc.plugOut(port('A')));
  assert.equal(m.out.name, 'A', 'the original comes back and takes the output');
});

test('Midi: plugging in an unrelated device changes nothing and prints nothing', async () => {
  const iac = port('IAC Driver Bus 1');
  const acc = fakeAccess({ outputs: [iac] });
  const { m, lines } = await engine(acc);
  const n = lines.filter((l) => l.dir === 'out').length;
  const [, warned] = quietWarn(() => acc.plugOut(port('New thing')));
  assert.equal(m.out, iac);
  assert.equal(lines.filter((l) => l.dir === 'out').length, n);
  assert.equal(warned.length, 0);
});

test('Midi: selectOutput remembers your choice; a later hot-plug brings you back to it', async () => {
  const a = port('A'), b = port('B');
  const acc = fakeAccess({ outputs: [a, b] });
  const { m } = await engine(acc);
  assert.equal(m.out, a);
  quietWarn(() => assert.equal(m.selectOutput('B'), true));
  assert.equal(m.out, b);
  assert.equal(m.selectOutput('nonexistent'), false);
  assert.equal(m.out, b, 'a failed selection changes nothing');
  quietWarn(() => acc.unplugOut(b));
  assert.equal(m.out, a);
  quietWarn(() => acc.plugOut(port('B')));
  assert.equal(m.out.name, 'B');
});

test('Midi: the `prefer` list orders the stand-in when the chosen output goes', async () => {
  const a = port('Alpha'), iac = port('IAC Driver Bus 1'), z = port('Zed');
  const acc = fakeAccess({ outputs: [a, iac, z] });
  const { m } = await engine(acc, { prefer: ['IAC'] }, 'Zed');
  assert.equal(m.out, z);
  quietWarn(() => acc.unplugOut(z));
  assert.equal(m.out, iac, 'IAC before the first-listed Alpha');
});

test('Midi: no output left means send() is a quiet no-op and the log says so', async () => {
  const a = port('A');
  const acc = fakeAccess({ outputs: [a] });
  const { m, lines } = await engine(acc);
  quietWarn(() => acc.unplugOut(a));
  assert.equal(m.out, null);
  assert.match(lines.filter((l) => l.dir === 'out').at(-1).text, /no output left/);
  assert.doesNotThrow(() => m.noteOn(60));
});

test('Midi: inputs named IAC are not listened to; our own messages that come back on another port are dropped', async () => {
  const out = port('Some Bus');
  const iacIn = input('IAC Driver Bus 1'), dawIn = input('From DAW'), kb = input('Keyboard');
  const acc = fakeAccess({ outputs: [out], inputs: [iacIn, dawIn, kb] });
  const heard = [];
  const m = new Midi({ requestAccess: async () => acc });
  m.onNote = (n, v, on) => heard.push([n, on]);
  await m.enable();
  assert.equal(iacIn.onmidimessage, null, 'IAC input never wired');
  m.noteOn(60, 100, 1);
  dawIn.fire([0x90, 60, 100]);                   // the DAW sends it straight back
  assert.deepEqual(heard, [], 'our echo is not input');
  assert.equal(m.echoDropped, 1);
  kb.fire([0x90, 60, 100]);                      // the performer plays the same note: not an echo any more
  assert.deepEqual(heard, [[60, true]]);
});

test('Midi: echoWindow 0 hears everything; panic does not leave echo memories behind', async () => {
  const out = port('Bus'), dawIn = input('From DAW');
  const acc = fakeAccess({ outputs: [out], inputs: [dawIn] });
  const heard = [];
  const m = new Midi({ requestAccess: async () => acc, echoWindow: 0 });
  m.onNote = (n, v, on) => heard.push(n);
  await m.enable();
  m.noteOn(60);
  dawIn.fire([0x90, 60, 100]);
  assert.deepEqual(heard, [60]);
  const m2 = new Midi({ requestAccess: async () => acc });
  await m2.enable();
  m2.panic();
  assert.equal(m2.echo._sent.length, 0, 'a sweep of 2000 note-offs is not remembered as 2000 things to wait for');
});

// ───────────── score → MIDI ─────────────

function recMidi() {
  const log = [];
  return { log, noteOn: (n, v, ch) => log.push(['on', n, v, ch]), noteOff: (n, ch) => log.push(['off', n, ch]), cc: (c, v, ch) => log.push(['cc', c, v, ch]) };
}

test('ScoreMidi: a segment change sends a note (base + index) and a CC (index) on the chosen channel; the note is released after `length`', () => {
  const midi = recMidi(), timers = [];
  const out = new ScoreMidi({ midi, channel: 15, segment: { note: 36, cc: 20 }, length: 0.2, timer: (fn, ms) => timers.push([fn, ms]) });
  out.segment({ index: 3, cause: 'play' });
  assert.deepEqual(midi.log, [['on', 39, 100, 15], ['cc', 20, 3, 15]]);
  assert.equal(timers.length, 1);
  assert.equal(timers[0][1], 200);
  timers[0][0]();
  assert.deepEqual(midi.log.at(-1), ['off', 39, 15]);
});

test('ScoreMidi: a cue sends its own note if mapped, else the shared one, and a CC carrying its number', () => {
  const midi = recMidi();
  const out = new ScoreMidi({ midi, channel: 14, segment: false, cue: { note: 84, notes: { 'dusk.glow': 90 }, cc: 21 }, timer: () => {} });
  out.cue({ name: 'dawn.rise', n: 1 });
  out.cue({ name: 'dusk.glow', n: 4 });
  assert.deepEqual(midi.log, [['on', 84, 100, 14], ['cc', 21, 1, 14], ['on', 90, 100, 14], ['cc', 21, 4, 14]]);
});

test('ScoreMidi: only while playing — a scrub, a jump and a reset send nothing unless scrub: true (reset never)', () => {
  const quiet = recMidi(), loud = recMidi();
  const a = new ScoreMidi({ midi: quiet, timer: () => {} }), b = new ScoreMidi({ midi: loud, scrub: true, timer: () => {} });
  for (const cause of ['seek', 'jump', 'reset']) { a.segment({ index: 1, cause }); b.segment({ index: 1, cause }); }
  assert.deepEqual(quiet.log, []);
  assert.equal(loud.log.length, 2, 'seek and jump marked, reset not');
  a.segment({ index: 1, cause: 'release' });
  assert.equal(quiet.log.length, 1, 'a released hold is playing');
});

test('ScoreMidi: enabled = false is silent; a bad channel or no midi is an error at construction; values clamp to 0..127', () => {
  const midi = recMidi();
  const off = new ScoreMidi({ midi, enabled: false, timer: () => {} });
  off.segment({ index: 0 }); off.cue({ name: 'x.y', n: 0 });
  assert.deepEqual(midi.log, []);
  assert.throws(() => new ScoreMidi({ midi, channel: 17 }), /channel/);
  assert.throws(() => new ScoreMidi({}), /needs a Midi/);
  const wide = recMidi();
  new ScoreMidi({ midi: wide, segment: { note: 120, cc: 20 }, timer: () => {} }).segment({ index: 200 });
  assert.deepEqual(wide.log, [['on', 127, 100, 15], ['cc', 20, 127, 15]]);
});

test('ScoreMidi through the Midi engine: it uses the engine\'s own throat, so the meter hook and the port both see it', async () => {
  const out = port('Bus');
  const acc = fakeAccess({ outputs: [out] });
  const { m } = await engine(acc);
  const meter = []; m.onSend = (b) => meter.push([...b]);
  new ScoreMidi({ midi: m, channel: 15, segment: { note: 36 }, timer: () => {} }).segment({ index: 2 });
  assert.deepEqual(meter, [[0x9e, 38, 100]]);
  assert.deepEqual(out.sent, [[0x9e, 38, 100]]);
});
