// @openav/record — MIDI takes: the format, Standard MIDI File in and out, the recorder,
// and the player's timing, loop, stuck-note safety and yield-to-live, on a fake clock.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeTake, validateTake, trimSilence, quantizeTake, takeStats, midiEventsOf, signalsOfMidi, noteOf, noteOffFor,
} from '../packages/record/take.js';
import { toMidiFile, fromMidiFile } from '../packages/record/smf.js';
import { TakeRecorder, TakePlayer } from '../packages/record/take-player.js';
import { EventLog } from '../packages/record/events.js';
import { Signals } from '../packages/core/index.js';

const on = (t, note, vel = 0.8, ch = 1, extra = {}) => ({ t, name: 'midi/note/on', value: { note, vel, velocity: Math.round(vel * 127), ch, ...extra } });
const off = (t, note, ch = 1) => ({ t, name: 'midi/note/off', value: { note, ch } });
const chOn = (t, note, vel = 0.8, ch = 1) => ({ t, name: `midi/ch/${ch}/note/${note}`, value: vel });
const chOff = (t, note, ch = 1) => ({ t, name: `midi/ch/${ch}/note/${note}`, value: 0 });
/** What a hardware keyboard publishes for one key: both spellings at the same instant. */
const hwNote = (t0, t1, note, vel = 0.8, ch = 1) => [on(t0, note, vel, ch), chOn(t0, note, vel, ch), off(t1, note, ch), chOff(t1, note, ch)];
const take = (events, extra = {}) => ({ v: 1, name: 'test', createdAt: null, durationMs: 0, events, meta: {}, ...extra });
const clock = (t = 0) => { const c = () => c.t; c.t = t; return c; };

// ───────────── format ─────────────

test('normalizeTake: sorted (stable), invalid events dropped, duration covers the last event', () => {
  const t = normalizeTake(JSON.stringify({ name: '', durationMs: 5, events: [
    { t: 30, name: 'b', value: 1 }, { t: 10, name: 'a' }, { t: 30, name: 'c', value: 2 }, { name: 'no-time' }, { t: 'x', name: 'bad' }, null, { t: -5, name: 'neg' },
  ] }));
  assert.deepEqual(t.events.map((e) => [e.t, e.name, e.value]), [[0, 'neg', null], [10, 'a', null], [30, 'b', 1], [30, 'c', 2]]);
  assert.equal(t.durationMs, 30);
  assert.equal(t.v, 1);
  assert.equal(t.name, 'take');
  assert.deepEqual(t.meta, {});
  assert.deepEqual(validateTake(t), []);
  assert.throws(() => normalizeTake(42), /not a take/);
});

test('validateTake: names every problem without throwing', () => {
  assert.deepEqual(validateTake(null), ['not an object']);
  const p = validateTake({ v: 2, name: 3, durationMs: 10, events: [{ t: 5, name: 'a' }, { t: 1, name: '' }, { t: 20, name: 'b' }, 7], meta: [] });
  for (const want of [/^v must be 1/, /^name must be a string/, /events\[1\]\.name/, /events\[1\] is out of order/, /events\[2\]\.t is after durationMs/, /events\[3\] is not an object/, /meta must be an object/]) {
    assert.ok(p.some((x) => want.test(x)), String(want));
  }
});

test('noteOf / noteOffFor: all four spellings, released in the spelling they were played', () => {
  assert.deepEqual(noteOf(on(0, 60, 0.5, 2)), { key: '2:60', on: true, note: 60, ch: 2, family: 'legacy', vel: 64 });
  assert.equal(noteOf({ name: 'midi/note/on', value: { note: 60, vel: 1, ch: 0 } }).ch, 1, 'the on-screen piano says ch 0');
  assert.equal(noteOf(chOff(0, 61, 3)).on, false);
  assert.equal(noteOf({ name: 'midi/minilab3/note/on', value: { note: 40, ch: 10 } }).family, 'slug:minilab3');
  assert.deepEqual(noteOf({ name: 'midi/virtual', value: { data: [0x99, 36, 100] } }), { key: '10:36', on: true, note: 36, ch: 10, family: 'virtual', vel: 100 });
  assert.equal(noteOf({ name: 'midi/cc/64', value: 1 }), null);
  assert.deepEqual(noteOffFor(noteOf(on(0, 60, 0.5, 2))), [{ name: 'midi/note/off', value: { note: 60, ch: 2 } }]);
  assert.deepEqual(noteOffFor(noteOf(chOn(0, 60, 0.5, 2))), [{ name: 'midi/ch/2/note/60', value: 0 }]);
  assert.deepEqual(noteOffFor(noteOf({ name: 'midi/virtual', value: { data: [0x99, 36, 100] } })), [{ name: 'midi/virtual', value: { data: [0x89, 36, 0] } }]);
  assert.deepEqual(noteOffFor(noteOf({ name: 'midi/lpd8/note/on', value: { note: 36, ch: 1 } })), [{ name: 'midi/lpd8/note/off', value: { note: 36, ch: 1 } }]);
});

test('trimSilence: the first key-down lands at `keep`; the pedal set during the silence stays, at 0', () => {
  const t = trimSilence(take([{ t: 100, name: 'midi/cc/64', value: 1 }, ...hwNote(2000, 2500, 60), { t: 3000, name: 'midi/cc/64', value: 0 }], { durationMs: 3200 }), { keep: 50 });
  assert.deepEqual(t.events.map((e) => [e.t, e.name]), [[0, 'midi/cc/64'], [50, 'midi/note/on'], [50, 'midi/ch/1/note/60'], [550, 'midi/note/off'], [550, 'midi/ch/1/note/60'], [1050, 'midi/cc/64']]);
  assert.equal(t.durationMs, 1250);
  const empty = trimSilence(take([]));
  assert.deepEqual(empty.events, []);
});

test('quantizeTake: key-downs snap to the grid, key-ups follow (lengths kept), both spellings together', () => {
  // 120 bpm, sixteenths = 125 ms
  const src = take([...hwNote(130, 400, 60), ...hwNote(240, 300, 64), { t: 260, name: 'midi/cc/1', value: 0.5 }], { meta: { bpm: 120 } });
  const q = quantizeTake(src);
  const at = (name, value) => q.events.filter((e) => e.name === name && (value === undefined || JSON.stringify(e.value) === JSON.stringify(value))).map((e) => e.t);
  assert.deepEqual(at('midi/ch/1/note/60', 0.8), [125]);
  assert.deepEqual(at('midi/note/on').sort((a, b) => a - b), [125, 250]);
  assert.deepEqual(at('midi/ch/1/note/60', 0), [395], 'note 60 keeps its 270 ms');
  assert.deepEqual(at('midi/ch/1/note/64', 0), [310], 'note 64 keeps its 60 ms');
  assert.deepEqual(at('midi/cc/1'), [260], 'controllers stay put');
  const half = quantizeTake(src, { strength: 0.5, bpm: 120, grid: 4 });
  assert.equal(half.events.find((e) => e.name === 'midi/ch/1/note/60').t, 127.5);
  assert.deepEqual(validateTake(q), []);
});

test('midiEventsOf: one family only — a hardware take does not double its notes', () => {
  const t = take([...hwNote(0, 100, 60), { t: 10, name: 'midi/cc/64', value: 1 }, { t: 10, name: 'midi/ch/1/cc/64', value: 1 },
    { t: 20, name: 'midi/bend', value: 1 }, { t: 30, name: 'midi/minilab3/pad1', value: 1 }]);
  const m = midiEventsOf(t);
  assert.deepEqual(m.map((e) => e.type), ['noteon', 'cc', 'pitchbend', 'noteoff']);
  assert.deepEqual(m[0], { t: 0, type: 'noteon', ch: 1, note: 60, vel: 102 });
  assert.deepEqual(m[1], { t: 10, type: 'cc', ch: 1, cc: 64, value: 127 });
  assert.equal(m[2].value, 16383);
  // channel-only takes, device takes and raw bytes still convert
  assert.deepEqual(midiEventsOf(take([chOn(0, 40, 1, 10), chOff(5, 40, 10)])).map((e) => [e.type, e.ch, e.note]), [['noteon', 10, 40], ['noteoff', 10, 40]]);
  assert.equal(midiEventsOf(take([{ t: 0, name: 'midi/lpd8/note/on', value: { note: 36, vel: 1, ch: 10 } }]))[0].ch, 10);
  assert.deepEqual(midiEventsOf(take([{ t: 0, name: 'midi/virtual', value: { data: [0x90, 60, 90] } }, { t: 1, name: 'midi/virtual', value: { data: [0xb0, 7, 100] } }])).map((e) => e.type), ['noteon', 'cc']);
});

test('signalsOfMidi: what a keyboard would have published', () => {
  assert.deepEqual(signalsOfMidi({ type: 'noteon', ch: 10, note: 36, vel: 127 }), [
    { name: 'midi/note/on', value: { note: 36, vel: 1, velocity: 127, ch: 10 } }, { name: 'midi/ch/10/note/36', value: 1 }]);
  assert.deepEqual(signalsOfMidi({ type: 'cc', ch: 2, cc: 74, value: 0 }, { families: 'channel' }), [{ name: 'midi/ch/2/cc/74', value: 0 }]);
  assert.deepEqual(signalsOfMidi({ type: 'pitchbend', ch: 1, value: 8192 }, { families: 'legacy' }), [{ name: 'midi/bend', value: 0 }]);
});

test('takeStats', () => {
  const s = takeStats(take([...hwNote(0, 10, 60), ...hwNote(5, 15, 72, 0.5, 10)]));
  assert.deepEqual(s, { notes: 2, events: 8, durationMs: 15, channels: [1, 10], low: 60, high: 72 });
});

// ───────────── Standard MIDI File ─────────────

const RICH = take([
  { t: 0, name: 'midi/ch/1/cc/64', value: 1 }, { t: 0, name: 'midi/cc/64', value: 1 },
  ...hwNote(12.3, 480.7, 60, 0.5), ...hwNote(250, 260, 36, 1, 10),
  { t: 300, name: 'midi/ch/1/bend', value: -0.5 }, { t: 300, name: 'midi/bend', value: -0.5 },
  { t: 320, name: 'midi/ch/1/pressure', value: 0.25 }, { t: 330, name: 'midi/ch/2/poly/64', value: 0.75 },
  { t: 900, name: 'midi/ch/1/cc/64', value: 0 }, { t: 900, name: 'midi/cc/64', value: 0 },
], { name: 'Étude 練習', durationMs: 1000, meta: { bpm: 96 } });

test('toMidiFile: a well-formed type-0 file', () => {
  const b = toMidiFile(RICH);
  const s = (i, n) => String.fromCharCode(...b.slice(i, i + n));
  assert.equal(s(0, 4), 'MThd');
  assert.deepEqual([...b.slice(4, 14)], [0, 0, 0, 6, 0, 0, 0, 1, 0x03, 0xc0], 'len 6, format 0, 1 track, 960 ppq');
  assert.equal(s(14, 4), 'MTrk');
  const len = (b[18] << 24) | (b[19] << 16) | (b[20] << 8) | b[21];
  assert.equal(len, b.length - 22, 'track length is honest');
  assert.deepEqual([...b.slice(-3)], [0xff, 0x2f, 0x00], 'end of track');
  const hex = Buffer.from(b).toString('hex');
  assert.ok(hex.includes('ff5103' + (625000).toString(16).padStart(6, '0')), 'tempo 96 bpm = 625000 µs/quarter');
  assert.ok(hex.includes('99247f'), 'the drum note stays on channel 10 (0x99)');
});

test('SMF round trip: same notes, channels, velocities, controllers, bend, aftertouch, times to the ms', () => {
  const back = fromMidiFile(toMidiFile(RICH));
  assert.equal(back.name, 'Étude 練習');
  assert.equal(back.meta.bpm, 96);
  assert.ok(Math.abs(back.durationMs - 1000) < 1);
  const a = midiEventsOf(RICH), b = midiEventsOf(back);
  assert.equal(b.length, a.length);
  const sortKey = (e) => `${Math.round(e.t)}|${e.type}|${e.ch}|${e.note ?? e.cc ?? ''}`;
  const A = [...a].sort((x, y) => sortKey(x).localeCompare(sortKey(y))), B = [...b].sort((x, y) => sortKey(x).localeCompare(sortKey(y)));
  A.forEach((e, i) => {
    const f = B[i];
    assert.ok(Math.abs(e.t - f.t) <= 1, `t ${e.t} vs ${f.t}`);
    assert.deepEqual({ ...f, t: 0 }, { ...e, t: 0 });
  });
  // and again: a second trip changes nothing
  const again = fromMidiFile(toMidiFile(back));
  assert.deepEqual(midiEventsOf(again).map((e) => ({ ...e, t: Math.round(e.t) })), midiEventsOf(back).map((e) => ({ ...e, t: Math.round(e.t) })));
});

test('toMidiFile: a zero-length note still ends after it starts; a re-struck key re-sounds', () => {
  const back = midiEventsOf(fromMidiFile(toMidiFile(take([on(100, 60), off(100, 60), on(200, 62), off(300, 62), on(300, 62), off(400, 62)]))));
  assert.deepEqual(back.map((e) => [e.type, e.note]), [['noteon', 60], ['noteoff', 60], ['noteon', 62], ['noteoff', 62], ['noteon', 62], ['noteoff', 62]]);
  assert.ok(back[1].t > back[0].t);
});

test('fromMidiFile: type 1, running status, note-on velocity 0, tempo change, sysex', () => {
  const vlq = (n) => { const o = [n & 0x7f]; while ((n >>= 7)) o.unshift((n & 0x7f) | 0x80); return o; };
  const trk = (bytes) => [0x4d, 0x54, 0x72, 0x6b, 0, 0, (bytes.length >> 8) & 0xff, bytes.length & 0xff, ...bytes];
  const conductor = trk([0, 0xff, 0x51, 3, 0x07, 0xa1, 0x20, ...vlq(480), 0xff, 0x51, 3, 0x03, 0xd0, 0x90, 0, 0xff, 0x2f, 0]); // 120 bpm, then 240 bpm at beat 1
  const music = trk([0, 0xff, 0x03, 4, 0x50, 0x69, 0x61, 0x6e, 0, 0xf0, 2, 0x7e, 0xf7,
    0, 0x91, 60, 100, ...vlq(480), 64, 90, ...vlq(480), 60, 0, 0, 64, 0, 0, 0xb1, 64, 127, 0, 0xff, 0x2f, 0]);
  const file = new Uint8Array([0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 1, 0, 2, 0x01, 0xe0, ...conductor, ...music]);
  const t = fromMidiFile(file, { families: 'legacy' });
  assert.equal(t.name, 'Pian');
  assert.equal(t.meta.bpm, 120);
  const n = t.events.filter((e) => e.name.startsWith('midi/note'));
  assert.deepEqual(n.map((e) => [e.name, e.value.note, e.value.ch, e.t]), [
    ['midi/note/on', 60, 2, 0], ['midi/note/on', 64, 2, 500], ['midi/note/off', 60, 2, 750], ['midi/note/off', 64, 2, 750]]);
  assert.deepEqual(t.events.find((e) => e.name === 'midi/cc/64'), { t: 750, name: 'midi/cc/64', value: 1 });
  assert.ok(!t.events.some((e) => e.name.startsWith('midi/ch/')), 'families: legacy');
});

test('fromMidiFile: SMPTE division, and garbage is refused', () => {
  // 25 fps × 40 ticks per frame = 1 ms per tick
  const body = [0, 0x90, 60, 100, 0x83, 0x60, 0x80, 60, 0, 0, 0xff, 0x2f, 0];   // off after 480 ticks
  const file = new Uint8Array([0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, 0xe7, 0x28, 0x4d, 0x54, 0x72, 0x6b, 0, 0, 0, body.length, ...body]);
  const t = fromMidiFile(file.buffer);
  assert.deepEqual(midiEventsOf(t).map((e) => [e.type, e.t]), [['noteon', 0], ['noteoff', 480]]);
  assert.equal(t.meta.bpm, undefined);
  assert.throws(() => fromMidiFile(new Uint8Array([1, 2, 3, 4])), /not a MIDI file/);
  assert.throws(() => fromMidiFile(new Uint8Array([0x4d, 0x54, 0x68, 0x64, 0, 0])), /ends early/);
});

// ───────────── TakeRecorder ─────────────

test('TakeRecorder: midi/* only, ms from start, held keys and the pedal closed at stop', () => {
  const now = clock(1000), signals = new Signals();
  const rec = new TakeRecorder({ signals, now, name: 'warmup', meta: { bpm: 90 } });
  signals.pulse('midi/note/on', { note: 1, vel: 1, ch: 1 });          // before start: not in the take
  rec.start();
  now.t = 1100; signals.pulse('midi/note/on', { note: 60, vel: 0.5, velocity: 64, ch: 1, device: 'minilab3' }); signals.set('midi/ch/1/note/60', 0.5);
  now.t = 1150; signals.set('midi/cc/64', 1); signals.set('audio/rms', 0.3);
  now.t = 1200; signals.pulse('midi/note/on', { note: 64, vel: 0.5, ch: 1 });
  now.t = 1300; signals.pulse('midi/note/off', { note: 64, ch: 1 });
  now.t = 1500;
  const t = rec.stop();
  assert.equal(rec.running, false);
  assert.deepEqual(validateTake(t), []);
  assert.equal(t.name, 'warmup');
  assert.deepEqual(t.meta, { bpm: 90, device: 'minilab3' });
  assert.equal(t.durationMs, 500);
  assert.ok(!t.events.some((e) => e.name === 'audio/rms'));
  assert.deepEqual(t.events.slice(-3), [
    { t: 500, name: 'midi/note/off', value: { note: 60, ch: 1 } },
    { t: 500, name: 'midi/ch/1/note/60', value: 0 },
    { t: 500, name: 'midi/cc/64', value: 0 },
  ], 'note 60 was still held and the pedal still down');
  signals.pulse('midi/note/on', { note: 70, vel: 1, ch: 1 });
  assert.equal(rec.events.length, t.events.length, 'detached after stop');
  // by name, not instanceof: stamp-version adds ?v= to the package's own relative imports, so the test's
  // '../packages/record/events.js' and the package's './events.js?v=…' are two module instances in Node
  assert.equal(Object.getPrototypeOf(rec.constructor).name, EventLog.name, 'one recorder: a take is an EventLog filtered to midi/*');
});

// ───────────── TakePlayer ─────────────

function rig(events, opts = {}) {
  const signals = new Signals(), heard = [];
  signals.onAny((name, value) => { if (!name.startsWith('take/')) heard.push([name, value]); });
  const player = new TakePlayer({ signals, take: take(events, { durationMs: opts.durationMs ?? 1000 }), clock: 'manual', ...opts });
  return { signals, heard, player };
}
const names = (heard) => heard.map(([n, v]) => n + (v && typeof v === 'object' && 'note' in v ? ':' + v.note : '') + (typeof v === 'number' ? '=' + v : ''));

test('TakePlayer: events arrive at their times, on the update(dt) clock, at any speed', () => {
  const { heard, player, signals } = rig([on(0, 60), off(100, 60), on(250, 62), off(400, 62)], { loop: false, durationMs: 400 });
  assert.equal(player.play(), true);
  assert.equal(signals.get('take/playing'), 1);
  player.update(0.001);
  assert.deepEqual(names(heard), ['midi/note/on:60']);
  player.update(0.098); assert.equal(heard.length, 1, 'not yet at 99 ms');
  player.update(0.002); assert.deepEqual(names(heard).slice(1), ['midi/note/off:60']);
  player.speed = 2;
  player.update(0.075); assert.deepEqual(names(heard).slice(2), ['midi/note/on:62'], '101 + 150 = 251 ms');
  assert.ok(Math.abs(signals.get('take/position') - 251 / 400) < 1e-9);
  player.update(1);   // clamped to maxStepMs (250 × 2): runs past the end
  assert.deepEqual(names(heard).slice(3), ['midi/note/off:62']);
  assert.equal(player.playing, false);
  assert.equal(player.state, 'paused', 'parked at the end');
  assert.equal(signals.get('take/playing'), 0);
  assert.equal(signals.get('take/position'), 1);
  assert.equal(player.play(), true, 'play after the end starts over');
  player.update(0.001);
  assert.equal(names(heard).at(-1), 'midi/note/on:60');
});

test('TakePlayer: loops, and a note sounding across the wrap is released first', () => {
  const { heard, player } = rig([on(0, 60), on(500, 64), off(700, 64), on(900, 67)], { durationMs: 1000 });
  player.play();
  for (let i = 0; i < 6; i++) player.update(0.2);   // 1.2 s
  assert.deepEqual(names(heard), ['midi/note/on:60', 'midi/note/on:64', 'midi/note/off:64', 'midi/note/on:67',
    'midi/note/off:60', 'midi/note/off:67', 'midi/note/on:60']);
  assert.equal(player.loops, 1);
  assert.ok(Math.abs(player.position - 200) < 1e-6);
});

test('TakePlayer: no stuck notes — pause, stop, seek release what sounds, in every spelling, pedal too', () => {
  const evs = [...hwNote(0, 900, 60), { t: 0, name: 'midi/virtual', value: { data: [0x99, 36, 100] } },
    { t: 0, name: 'midi/lpd8/note/on', value: { note: 40, ch: 1 } }, { t: 0, name: 'midi/cc/64', value: 1 }];
  const { heard, player, signals } = rig(evs);
  player.play(); player.update(0.01);
  heard.length = 0;
  player.pause();
  assert.deepEqual(new Set(names(heard)), new Set(['midi/note/off:60', 'midi/ch/1/note/60=0', 'midi/lpd8/note/off:40', 'midi/cc/64=0', 'midi/virtual']));
  assert.deepEqual(heard.find(([n]) => n === 'midi/virtual')[1], { data: [0x89, 36, 0] });
  assert.equal(signals.get('take/playing'), 0);
  heard.length = 0;
  player.pause();
  assert.equal(heard.length, 0, 'nothing left to release');
  player.play(); player.seek(0); player.update(0.01);
  heard.length = 0;
  player.seek(500);
  assert.ok(names(heard).includes('midi/note/off:60'), 'seek releases');
  heard.length = 0;
  player.update(0.01);
  player.stop();
  assert.equal(player.position, 0);
  player.dispose();
});

test('TakePlayer: seek chases controllers to their value at that point', () => {
  const { heard, player } = rig([{ t: 0, name: 'midi/cc/74', value: 0.1 }, { t: 300, name: 'midi/cc/74', value: 0.7 }, on(400, 60), { t: 600, name: 'midi/cc/74', value: 0.9 }], { chase: true });
  player.seek(500);
  assert.deepEqual(names(heard), ['midi/cc/74=0.7'], 'latest value before 500 ms; no notes');
});

test('TakePlayer: yieldToLive — your key-down silences the take, its own notes never do, resumeAfter brings it back', () => {
  const { heard, player, signals } = rig([on(0, 60), off(800, 60)], { yieldToLive: true, resumeAfter: 2 });
  const states = [];
  player.onState = (s, why) => states.push(why ? `${s}:${why}` : s);
  player.play(); player.update(0.05);
  assert.equal(player.playing, true, 'its own note-on did not count as live');
  signals.pulse('midi/note/on', { note: 72, vel: 1, ch: 1 });       // you play
  assert.equal(player.playing, false);
  assert.equal(player.state, 'yielded');
  assert.ok(names(heard).includes('midi/note/off:60'), 'the take let go of its note');
  assert.deepEqual(states, ['playing', 'yielded:live']);
  player.update(0.2); player.update(0.2); player.update(0.2); player.update(0.2); player.update(0.2);   // 1 s of silence
  signals.pulse('midi/note/on', { note: 74, vel: 1, ch: 1 });        // still playing: the 2 s start over
  for (let i = 0; i < 7; i++) player.update(0.25);                    // 1.75 s
  assert.equal(player.playing, false);
  player.update(0.25);                                                // 2 s idle
  assert.equal(player.playing, true);
  assert.equal(states.at(-1), 'playing:resume');
  assert.equal(signals.get('take/playing'), 1);
  // knobs are not "playing": a knob turn does not stop the take
  signals.set('midi/cc/1', 0.5);
  assert.equal(player.playing, true);
});

test('TakePlayer: without yieldToLive, live playing layers over the take', () => {
  const { player, signals } = rig([on(0, 60), off(800, 60)]);
  player.play(); player.update(0.05);
  signals.pulse('midi/note/on', { note: 72, vel: 1, ch: 1 });
  assert.equal(player.playing, true);
});

test('TakePlayer: tick() follows a clock and clamps a frozen-tab gap', () => {
  const now = clock(0);
  const { heard, player } = rig([on(0, 60), on(200, 62), on(900, 64)], { now, maxStepMs: 250 });
  player.play();
  now.t = 16; player.tick();
  now.t = 216; player.tick();
  assert.deepEqual(names(heard), ['midi/note/on:60', 'midi/note/on:62']);
  now.t = 10216; player.tick();             // a 10 s freeze → 250 ms of take, not a burst
  assert.ok(Math.abs(player.position - 466) < 1e-6);
  assert.equal(heard.length, 2);
});

test('TakeRecorder ignores a TakePlayer playing back, unless overdub', () => {
  const signals = new Signals(), now = clock(0);
  const player = new TakePlayer({ signals, take: take([on(0, 60), off(50, 60)], { durationMs: 100 }), clock: 'manual', loop: false });
  const plain = new TakeRecorder({ signals, now }).start();
  const dub = new TakeRecorder({ signals, now, overdub: true }).start();
  player.play(); player.update(0.06);
  signals.pulse('midi/note/on', { note: 70, vel: 1, ch: 1 });
  signals.pulse('midi/note/off', { note: 70, ch: 1 });
  now.t = 100;
  assert.deepEqual(plain.stop().events.map((e) => e.value.note), [70, 70]);
  assert.deepEqual(dub.stop().events.map((e) => e.value.note), [60, 60, 70, 70]);
});

test('TakePlayer: a recorded take plays back what was recorded, and an empty one refuses to play', () => {
  const signals = new Signals(), now = clock(0);
  const rec = new TakeRecorder({ signals, now }).start();
  now.t = 10; signals.pulse('midi/note/on', { note: 60, vel: 1, ch: 1 });
  now.t = 60; signals.pulse('midi/note/off', { note: 60, ch: 1 });
  now.t = 100;
  const t = JSON.parse(JSON.stringify(rec.stop()));    // through a file and back
  const got = [];
  const player = new TakePlayer({ signals, take: t, clock: 'manual', loop: false, onEvent: (e) => got.push([e.t, e.name]) });
  player.play(); player.update(0.2);
  assert.deepEqual(got, [[10, 'midi/note/on'], [60, 'midi/note/off']]);
  assert.equal(new TakePlayer({ signals, clock: 'manual' }).play(), false);
  assert.equal(new TakePlayer({ signals, take: take([]), clock: 'manual' }).play(), false);
});
