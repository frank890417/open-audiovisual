// Checking a profile against a unit: what counts as an answer, what happens to a difference, and what ends up in the file.
// The rule the whole page stands on: nothing but a hardware run with a person behind it can turn a control true.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateProfile } from '../packages/midi/profiles.js';
import { profileById, PROFILES } from '../packages/midi/profiles/index.js';
import { VerifySession, applyVerification, verificationReport, inferRelative, messageOf, messageText, portMethod, ledTestBytes, ledTestSysex } from '../packages/midi/verify-session.js';

const META = { date: '2026-11-12', by: 'A. Tester', method: 'hardware', firmware: '1.0.4', os: 'macOS 26.1', browser: 'Chrome 142', port: 'LPD8 mk2', tool: 'openaudiovisual.com/controllers/verify/' };
const noteOn = (ch, n, v = 100) => [0x90 | (ch - 1), n, v];
const noteOff = (ch, n) => [0x80 | (ch - 1), n, 0];
const cc = (ch, n, v) => [0xb0 | (ch - 1), n, v];
const bytesOf = (c) => (c.msg === 'cc' ? cc(c.ch, c.cc, 64) : c.msg === 'note' ? noteOn(c.ch, c.note) : c.msg === 'pitchbend' ? [0xe0 | (c.ch - 1), 0, 80] : [0xd0 | (c.ch - 1), 10]);
/** Move every control exactly as the file says. */
function playAll(s) {
  while (s.current) {
    const st = s.current;
    if (st.key) s.feed(noteOn(st.control.ch, st.expected.note)); else s.feed(bytesOf(st.control));
    if (st.control.type === 'encoder') s.feed(bytesOf(st.control));
    s.settle();
  }
}
const profile = (id = 'akai-lpd8') => JSON.parse(JSON.stringify(profileById(id)));

test('a run walks the faceplate in order, and a keyboard is checked at both ends', () => {
  const s = new VerifySession(profile());
  assert.equal(s.steps.length, profile().controls.length);
  assert.deepEqual(s.current.expected, messageOf(s.current.control));
  const k = new VerifySession(profile('arturia-minilab3'));
  const keys = k.steps.filter((x) => x.key);
  assert.deepEqual(keys.map((x) => x.key), ['low', 'high']);
  const u = new VerifySession(profile('akai-lpd8'), { only: 'unconfirmed' });
  assert.equal(u.steps.length, profile().controls.filter((c) => c.verified === false).length);
});

test('every shipped profile can be walked from start to finish and comes out valid', () => {
  for (const raw of PROFILES) {
    const s = new VerifySession(raw); playAll(s);
    assert.equal(s.state, 'done', raw.id);
    const c = s.counts();
    assert.equal(c.match, s.steps.length, `${raw.id}: every step matched`);
    const { profile: out, problems } = applyVerification(raw, s, META);
    assert.deepEqual(problems, [], raw.id);
    assert.ok(out.controls.every((x) => x.verified === true), raw.id);
    assert.equal(out.verifications.length, 1);
  }
});

test('what arrives around an answer is not an answer', () => {
  const s = new VerifySession(profile()), first = s.current;
  for (const m of [[0xf8], [0xfe], [0xfa], [0xf0, 0x7e, 0xf7], noteOff(16, 1), [0xa9, 40, 10], [0xd9, 10]]) assert.equal(s.feed(m).kind, 'ignored', String(m));
  assert.equal(s.current.id, first.id);
  // the sweep of the same control is one answer, however many messages it takes
  const b = bytesOf(first.control);
  assert.equal(s.feed(b).kind, 'hearing'); s.feed(b); s.feed(b);
  assert.equal(s.settle().kind, 'match');
  assert.notEqual(s.current.id, first.id);
  // …and its tail, arriving after the step moved on, is ignored rather than called a mismatch
  assert.equal(s.feed(b).kind, 'ignored');
  assert.equal(s.feed(noteOff(first.control.ch, first.control.note ?? 0)).kind, 'ignored');
  assert.equal(s.state, 'waiting');
});

test('a difference waits for a person, and the message of another control is flagged, not offered as a fix', () => {
  const s = new VerifySession(profile()), a = s.current.control, b = s.steps[1] && profile().controls.find((c) => c.id === s.steps[1].id);
  const r = s.feed(bytesOf(b));
  assert.equal(r.kind, 'differs'); assert.equal(r.owner.id, b.id); assert.equal(r.confirmed, false);
  assert.equal(s.feed(bytesOf(a)).kind, 'ignored', 'nothing moves until someone decides');
  assert.equal(s.retry(), true); assert.equal(s.state, 'waiting'); assert.equal(s.current.id, a.id);
  // the same wrong control again is now the tail of a slip
  assert.equal(s.feed(bytesOf(b)).kind, 'ignored');
  assert.equal(s.feed(bytesOf(a)).kind, 'hearing');
});

test('a correction rewrites the numbers, keeps the old ones, and turns the control true', () => {
  const raw = profile(), s = new VerifySession(raw), id = s.current.id, old = messageOf(s.current.control);
  const r = s.feed(cc(16, 119, 10));
  assert.equal(r.kind, 'differs'); assert.equal(r.owner, null); assert.deepEqual(r.got, { msg: 'cc', ch: 16, cc: 119 });
  assert.equal(s.accept(), true);
  assert.equal(s.markOf(id), 'corrected');
  const { profile: out, problems } = applyVerification(raw, s, META);
  assert.deepEqual(problems, []);
  const c = out.controls.find((x) => x.id === id);
  assert.deepEqual([c.msg, c.ch, c.cc, c.verified], ['cc', 16, 119, true]);
  assert.equal(typeof c.note, 'undefined', 'a note number does not survive a move to CC');
  const v = out.verifications[0].results[id];
  assert.equal(v.result, 'corrected'); assert.deepEqual(v.was, old); assert.deepEqual(v.got, { msg: 'cc', ch: 16, cc: 119 });
  assert.equal(raw.controls.find((x) => x.id === id).cc, undefined, 'the input is not touched');
});

test('a swap: pressing A sends what the file gives B; both move, and B is marked as not checked', () => {
  const raw = profile(), s = new VerifySession(raw), a = s.current.control.id, b = s.steps[1].id;
  const bMsg = messageOf(s.p.controls.find((x) => x.id === b)), aMsg = messageOf(s.current.control);
  s.feed(bytesOf(s.p.controls.find((x) => x.id === b)));
  assert.equal(s.accept(), true);
  assert.deepEqual(s.current.expected, aMsg, 'B is now expected to send what the file gave A');
  s.skip();
  const { profile: out, problems } = applyVerification(raw, s, META);
  assert.deepEqual(problems, []);
  const A = out.controls.find((x) => x.id === a), B = out.controls.find((x) => x.id === b);
  assert.equal(A.note, bMsg.note); assert.equal(B.note, aMsg.note); assert.equal(A.verified, true); assert.equal(B.verified, false);
});

test('a message that a confirmed control already owns cannot be taken', () => {
  const s = new VerifySession(profile()), first = s.current.control;
  s.feed(bytesOf(first)); s.settle();
  s._trail.clear();
  const r = s.feed(bytesOf(first));
  assert.equal(r.kind, 'differs'); assert.equal(r.confirmed, true);
  assert.equal(s.accept(), false, 'two controls cannot share one message');
  assert.equal(s.state, 'differs');
  assert.equal(s.reject(), true);
});

test('keys: a shifted keyboard moves the range; both ends must match', () => {
  const raw = profile('generic-keys25'), s = new VerifySession(raw);
  while (s.current.key !== 'low') s.skip();
  const c = s.current.control, span = c.to - c.from;
  assert.equal(s.feed(noteOn(c.ch, c.from + 12)).kind, 'differs', 'one octave up');
  assert.equal(s.accept(), true);
  assert.equal(s.current.key, 'high'); assert.equal(s.current.expected.note, c.from + span);
  s.feed(noteOn(c.ch, c.from + span)); s.settle();
  const { profile: out, problems } = applyVerification(raw, s, META);
  assert.deepEqual(problems, []);
  const k = out.controls.find((x) => x.type === 'keys');
  assert.equal(k.to - k.from, span); assert.equal(out.verifications[0].results[k.id].result, 'corrected');
});

test('encoders: the encoding is read from a few clicks each way', () => {
  assert.equal(inferRelative([65, 65, 65, 63, 63, 63]), 'offset64');
  assert.equal(inferRelative([17, 17, 15, 15]), 'offset16');
  assert.equal(inferRelative([1, 1, 2, 127, 127, 126]), 'twos');
  assert.equal(inferRelative([1, 1, 2, 65, 65, 66]), 'signbit');
  assert.equal(inferRelative([40, 41, 42, 43, 44, 45]), false, 'absolute');
  assert.equal(inferRelative([65, 63]), null, 'too few to tell');
  assert.equal(inferRelative([3, 90, 12, 77]), null);
  const raw = { ...profile(), controls: [{ id: 'enc', type: 'encoder', msg: 'cc', ch: 1, cc: 20, relative: 'offset64' }], sections: [{ id: 's', x: 0, y: 0, w: 10, h: 10, cols: 1, rows: 1, controls: ['enc'] }], portrait: undefined };
  const s = new VerifySession(raw);
  for (const v of [1, 1, 1, 127, 127, 127]) s.feed(cc(1, 20, v));
  const r = s.settle();
  assert.equal(r.kind, 'differs'); assert.equal(r.encoding, true); assert.equal(r.got.relative, 'twos');
  assert.equal(s.accept(), true);
  const { profile: out, problems } = applyVerification(raw, s, META);
  assert.deepEqual(problems, []);
  assert.equal(out.controls[0].relative, 'twos');
});

test('skip, absent, back', () => {
  const raw = profile(), s = new VerifySession(raw), [a, b] = s.steps.map((x) => x.id);
  s.skip(); assert.equal(s.current.id, b);
  s.absent();
  assert.equal(s.markOf(a), null); assert.equal(s.markOf(b), 'absent');
  assert.equal(s.back(), true); assert.equal(s.current.id, b); assert.equal(s.markOf(b), null);
  const c = s.counts();
  assert.deepEqual([c.skipped, c.absent, c.done], [1, 0, 1]);
  assert.equal(new VerifySession(raw).back(), false);
});

test('a run without hardware changes nothing but the log, whatever it found', () => {
  for (const method of ['virtual', 'simulated']) {
    const raw = profile(), s = new VerifySession(raw), id = s.current.id;
    s.feed(cc(16, 119, 10)); s.accept();
    s.feed(bytesOf(s.current.control)); s.settle();
    const { profile: out, problems } = applyVerification(raw, s, { date: '2026-11-05', by: 'CI', method });
    assert.deepEqual(problems, [], method);
    assert.deepEqual(out.controls, raw.controls, `${method}: the numbers and marks are as they were`);
    assert.ok(!out.controls.some((c) => c.verified === true));
    assert.equal(out.verifications[0].results[id].result, 'mismatch', 'a correction becomes a logged difference');
  }
});

test('a hardware record missing its details is reported, not written quietly', () => {
  const raw = profile(), s = new VerifySession(raw);
  s.feed(bytesOf(s.current.control)); s.settle();
  const { problems } = applyVerification(raw, s, { date: '2026-11-12', by: 'A', method: 'hardware' });
  assert.ok(problems.some((p) => /must record firmware/.test(p)));
});

test('a control that fails on hardware loses a true it had', () => {
  const raw = profile(), id = raw.controls[0].id;
  const first = new VerifySession(raw); first.feed(bytesOf(first.current.control)); first.settle();
  const once = applyVerification(raw, first, META).profile;
  const s = new VerifySession(once); s.absent();
  const { profile: out, problems } = applyVerification(once, s, { ...META, date: '2026-11-20' });
  assert.deepEqual(problems, []);
  assert.equal(out.controls.find((c) => c.id === id).verified, false);
  assert.equal(out.verifications.length, 2);
});

test('only a port that is not virtual, with a person saying so, counts as hardware', () => {
  assert.equal(portMethod('Minilab3 MIDI', { attested: true }), 'hardware');
  assert.equal(portMethod('Minilab3 MIDI'), 'virtual', 'nobody said it is a real unit');
  for (const n of ['IAC Driver Bus 1', 'loopMIDI Port', 'Virtual Raw MIDI', 'Network Session 1', 'Midi Through Port-0']) assert.equal(portMethod(n, { attested: true }), 'virtual', n);
  assert.equal(portMethod('Minilab3 MIDI', { attested: true, simulated: true }), 'simulated');
});

test('text: a message reads the way a chart prints it, and the report lists every difference', () => {
  assert.equal(messageText({ msg: 'cc', ch: 1, cc: 74 }), 'CC 74 · ch 1');
  assert.equal(messageText({ msg: 'note', ch: 10, note: 36 }), 'Note 36 · ch 10');
  assert.equal(messageText({ msg: 'note', ch: 1, from: 48, to: 72 }), 'Notes 48–72 · ch 1');
  assert.equal(messageText({ msg: 'pitchbend', ch: 1 }), 'Pitch bend · ch 1');
  const raw = profile(), s = new VerifySession(raw); s.feed(cc(16, 119, 1)); s.accept();
  const r = verificationReport(raw, s, META);
  assert.match(r, /akai-lpd8/); assert.match(r, /Firmware: 1\.0\.4/); assert.match(r, /CC 119 · ch 16/); assert.match(r, /corrected 1/);
  assert.ok(verificationReport(raw, s, META, { max: 100 }).length < 200, 'stays short enough for a link');
  assert.deepEqual(validateProfile(raw), []);
});

// ------------------------------------------------------------------ picking a run up again
const jsonTrip = (x) => JSON.parse(JSON.stringify(x));

test('a run survives being written down: position, results, corrections and lights', () => {
  const raw = profile(), s = new VerifySession(raw), a = s.current.id;
  s.feed(cc(16, 119, 10)); s.accept();                 // a correction
  s.feed(bytesOf(s.current.control)); s.settle();      // a match
  s.skip(); s.absent();
  s.setLed(a, 'match');
  const t = VerifySession.restore(raw, jsonTrip(s.snapshot()));
  assert.equal(t.at, s.at); assert.equal(t.state, 'waiting'); assert.equal(t.current.id, s.current.id);
  assert.deepEqual(t.results(), s.results());
  assert.deepEqual(t.counts(), s.counts());
  assert.deepEqual(messageOf(t.p.controls.find((c) => c.id === a)), messageOf(s.p.controls.find((c) => c.id === a)), 'the correction came back');
  assert.ok(t.index.get('cc:16:119'), 'and the message lookup knows it');
  // it goes on from there, to the same file
  while (t.current) t.skip();
  const out = applyVerification(raw, t, META);
  assert.deepEqual(out.problems, []);
  assert.equal(out.profile.controls.find((c) => c.id === a).cc, 119);
  assert.equal(out.profile.verifications[0].results[a].led, 'match');
});

test('a finished run restores as finished, and an "only unconfirmed" run keeps its scope', () => {
  const raw = profile(), s = new VerifySession(raw); playAll(s);
  const t = VerifySession.restore(raw, jsonTrip(s.snapshot()));
  assert.equal(t.state, 'done'); assert.equal(t.current, null); assert.equal(t.counts().match, s.steps.length);
  const u = new VerifySession(raw, { only: 'unconfirmed' }); u.skip();
  assert.equal(VerifySession.restore(raw, jsonTrip(u.snapshot())).only, 'unconfirmed');
});

test('a snapshot that no longer fits the file is refused, not half-applied', () => {
  const raw = profile(), snap = jsonTrip(new VerifySession(raw).snapshot());
  assert.equal(VerifySession.restore(profile('korg-nanokontrol2'), snap), null, 'another device');
  assert.equal(VerifySession.restore(raw, { ...snap, v: 2 }), null);
  assert.equal(VerifySession.restore(raw, null), null);
  assert.equal(VerifySession.restore(raw, { ...snap, steps: snap.steps + 1 }), null, 'controls were added since');
  assert.equal(VerifySession.restore(raw, { ...snap, at: 999 }), null);
  assert.equal(VerifySession.restore(raw, { ...snap, marks: [['gone', { result: 'match' }]] }), null);
  assert.equal(VerifySession.restore(raw, { ...snap, changed: { gone: { msg: 'cc', ch: 1, cc: 1 } } }), null);
});

// ------------------------------------------------------------------ the lights
test('the LED of a control is lit with what its file says, and turned off again', () => {
  const pad = { ch: 1, msg: 'note', note: 11, led: { msg: 'note', on: 5, off: 0 } };
  assert.deepEqual(ledTestBytes(pad, true), [0x90, 11, 5]);
  assert.deepEqual(ledTestBytes(pad, false), [0x90, 11, 0]);
  assert.deepEqual(ledTestBytes({ ch: 1, msg: 'cc', cc: 91, led: { msg: 'cc', ch: 3 } }, true), [0xb2, 91, 127], 'a CC LED, on another channel, default on value');
  assert.equal(ledTestBytes({ ch: 1, msg: 'cc', cc: 1 }, true), null);
});

test('only what the run confirmed is offered, and SysEx LEDs only when asked for', () => {
  const raw = profile('akai-apc-mini-mk2'), s = new VerifySession(raw);
  assert.deepEqual(s.ledTargets(), [], 'nothing confirmed yet');
  s.feed(bytesOf(s.current.control)); s.settle();
  assert.equal(s.ledTargets().length, 1);
  const ml = profile('arturia-minilab3'), m = new VerifySession(ml);
  while (m.current?.control.ledIndex === undefined) m.skip();
  m.feed(bytesOf(m.current.control)); m.settle();
  assert.deepEqual(m.ledTargets(), [], 'its pads have no plain LED message');
  assert.equal(m.ledTargets({ sysex: true }).length, 1);
});

test('a SysEx LED is built from the message the file has, and a confirmed light vouches for that message', () => {
  const ml = profile('arturia-minilab3'), pad = ml.controls.find((c) => c.ledIndex !== undefined);
  const on = ledTestSysex(ml, pad, true);
  assert.equal(on.message, 'led-rgb');
  assert.deepEqual(on.bytes.slice(-5), [52, 127, 127, 127, 0xf7]);
  assert.deepEqual(ledTestSysex(ml, pad, false).bytes.slice(-4), [0, 0, 0, 0xf7]);
  const lcxl = profile('novation-launch-control-xl-mk2'), up = lcxl.controls.find((c) => c.id === 'up');
  assert.equal(ledTestSysex(lcxl, up, true).message, 'led-set', 'no RGB message: the flat one');
  assert.equal(ledTestSysex(profile('akai-lpd8'), { ledIndex: 1 }, true), null);
  const s = new VerifySession(ml);
  while (s.current?.control.id !== pad.id) s.skip();
  s.feed(bytesOf(s.current.control)); s.settle();
  s.setLed(pad.id, 'match'); s.setSysex('led-rgb', 'match');
  while (s.current) s.skip();
  const out = applyVerification(ml, s, META);
  assert.deepEqual(out.problems, []);
  assert.equal(out.profile.sysex.messages.find((m) => m.id === 'led-rgb').verified, true);
  assert.equal(out.profile.verifications[0].results['sysex:led-rgb'], 'match');
  assert.equal(out.profile.verifications[0].results[pad.id].led, 'match');
  // the same run without hardware vouches for nothing
  const v = applyVerification(ml, s, { date: '2026-11-06', by: 'CI', method: 'virtual' });
  assert.deepEqual(v.problems, []);
  assert.equal(v.profile.sysex.messages.find((m) => m.id === 'led-rgb').verified, false);
});

test('a dark LED is logged and takes nothing from the control: the input was still right', () => {
  const raw = profile('akai-apc-mini-mk2'), s = new VerifySession(raw), id = s.current.id;
  s.feed(bytesOf(s.current.control)); s.settle();
  s.setLed(id, 'mismatch');
  const { profile: out, problems } = applyVerification(raw, s, META);
  assert.deepEqual(problems, []);
  assert.equal(out.controls.find((c) => c.id === id).verified, true);
  assert.equal(out.verifications[0].results[id].led, 'mismatch');
});
