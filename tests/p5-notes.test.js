// oav-p5 0.8.0: note names (C4, c#4, Db3) wherever a note number goes, and noteNumber / noteName / noteFreq.
// C4 = 60 (scientific pitch notation). Run against another build of the file with OAV_P5_FILE=/abs/path.js (0.7.0 goes red).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const SRC = readFileSync(process.env.OAV_P5_FILE || new URL('../p5/oav-p5.js', import.meta.url), 'utf8');
function page(globals = {}) {
  const win = { console: { info() {}, warn() {}, error() {} }, navigator: {}, location: { search: '' }, URL, URLSearchParams, Promise, setTimeout, clearTimeout, setInterval, clearInterval, ...globals };
  win.window = win; win.globalThis = win;
  vm.runInNewContext(SRC, win);
  return win;
}

test('0.8.0: the version, the three names, and none of them is a p5 / p5.sound name', () => {
  const w = page();
  assert.equal(w.OAVp5.version, '0.8.0');
  for (const n of ['noteNumber', 'noteName', 'noteFreq']) assert.equal(typeof w[n], 'function', n);
  // checked against p5 1.11.11, p5 2.0.5 and p5.sound 1.11.11 (grep of the minified files: none has these names or midi.isDown)
  for (const n of ['midiToFreq', 'freqToMidi', 'noteToFreq']) assert.equal(w[n], undefined, `${n} is p5.sound's, not ours`);
});

test('noteNumber: every spelling, case, accidentals, the edges', () => {
  const { noteNumber } = page();
  const table = {
    C4: 60, c4: 60, 'C#4': 61, 'c#4': 61, Db4: 61, db4: 61, 'F♯2': 42, 'B♭1': 34, 'C-1': 0, G9: 127,
    A4: 69, a4: 69, A0: 21, C8: 108, B3: 59, Cb4: 59, 'B#3': 60, 'E#4': 65, Fb4: 64,
    bb2: 46, Bb2: 46, b2: 47, B2: 47, 'C##4': 62, Ebb3: 50, ' C4 ': 60,
  };
  for (const [name, n] of Object.entries(table)) assert.equal(noteNumber(name), n, name);
  assert.equal(noteNumber('G9'), 127);
  assert.equal(noteNumber('C-1'), 0);
  assert.equal(noteNumber('60'), 60);
});

test('noteNumber: a number comes back as it is, held to 0..127', () => {
  const { noteNumber } = page();
  assert.equal(noteNumber(60), 60);
  assert.equal(noteNumber(0), 0);
  assert.equal(noteNumber(127), 127);
  assert.equal(noteNumber(200), 127);
  assert.equal(noteNumber(-5), 0);
  assert.equal(noteNumber(60.4), 60);
});

test('noteNumber: what is not a note throws one clear sentence, in the page language, and a card says it once', () => {
  const w = page();
  for (const bad of ['', 'H4', 'C', 'C#', 'C#b4', 'BB4', 'C-2', 'G#9', 'Cb-1', 'do4', 'C4x', null, undefined, {}, NaN, Infinity, [], true]) {
    assert.throws(() => w.noteNumber(bad), /\[oav-p5\].*A–G.*C4.*F#3.*Bb2/s, String(bad));
  }
  const cards = w.OAVp5.hints.filter((h) => h.id.startsWith('noteBad:'));
  assert.ok(cards.length > 0 && cards.every((h) => h.kind === 'error' && /Bb2/.test(h.next)));
  for (let i = 0; i < 2; i++) assert.throws(() => w.noteNumber('H4'));
  assert.equal(w.OAVp5.hints.filter((h) => h.id === 'noteBad:"H4"').length, 1, 'one card per spelling');
  const z = page({ navigator: { language: 'zh-TW' }, location: { search: '' } });
  try { z.noteNumber('H4'); assert.fail('threw'); } catch (e) { assert.match(e.message, /音名|A–G/); }
});

test('noteName: sharps by default, flats and no-octave on request, round trip, edges', () => {
  const { noteName, noteNumber } = page();
  assert.equal(noteName(61), 'C#4');
  assert.equal(noteName(61, { flats: true }), 'Db4');
  assert.equal(noteName(61, { octave: false }), 'C#');
  assert.equal(noteName(61, { flats: true, octave: false }), 'Db');
  assert.equal(noteName(60), 'C4'); assert.equal(noteName(0), 'C-1'); assert.equal(noteName(127), 'G9'); assert.equal(noteName(69), 'A4');
  assert.equal(noteName('Db4'), 'C#4');
  assert.throws(() => noteName('nope'), /A–G/);
  for (let n = 0; n < 128; n++) { assert.equal(noteNumber(noteName(n)), n); assert.equal(noteNumber(noteName(n, { flats: true })), n); }
});

test('noteFreq: names and numbers to Hz', () => {
  const { noteFreq } = page();
  assert.equal(noteFreq('A4'), 440); assert.equal(noteFreq(69), 440); assert.equal(noteFreq('a4'), 440);
  assert.ok(Math.abs(noteFreq('C4') - 261.6256) < 1e-3);
  assert.ok(Math.abs(noteFreq(81) - 880) < 1e-9);
  assert.ok(Math.abs(noteFreq(69.5) - 440 * Math.pow(2, 0.5 / 12)) < 1e-9);
  assert.throws(() => noteFreq('x'), /A–G/); assert.throws(() => noteFreq(NaN), /A–G/);
});

test("noteIsDown('C4') and noteIsDown(60) agree, whatever the spelling; 0.7.0 answered false to the name", () => {
  const w = page();
  assert.equal(w.noteIsDown('C4'), false); assert.equal(w.noteIsDown(60), false);
  w.midi.input([0x90, 60, 100]);
  assert.equal(w.noteIsDown(60), true);
  for (const s of ['C4', 'c4', 'B#3', 'Dbb4']) assert.equal(w.noteIsDown(s), true, s);
  assert.equal(w.noteIsDown('C#4'), false); assert.equal(w.noteIsDown('C5'), false);
  assert.equal(w.midi.isDown('C4'), true); assert.equal(w.midi.isDown(60), true); assert.equal(w.midi.isDown('D4'), false);
  w.midi.input([0x80, 60, 0]);
  assert.equal(w.noteIsDown('C4'), false);
  assert.throws(() => w.noteIsDown('H4'), /A–G/);
});

test('numbers behave exactly as in 0.7: & 127, undefined is note 0', () => {
  const w = page();
  w.midi.input([0x90, 0, 100]);
  assert.equal(w.noteIsDown(128), true, '128 & 127 = 0');
  assert.equal(w.noteIsDown(), true);
  assert.equal(w.noteIsDown(1), false);
  const seen = []; w.midi.on('noteOn', (n) => seen.push(n));
  w.midi.play(60, 0.5); w.midi.play(188, 1);
  assert.deepEqual(seen, [60, 60], 'play(188) is 188 & 127 = 60');
});

test("midi.play('C#4'): the sketch hears note 61 as a number, velocity 0 releases", () => {
  const pressed = [], released = [];
  const w = page({ notePressed: (n, v) => pressed.push([n, v]), noteReleased: (n) => released.push(n) });
  w.midi.play('C#4', 1);
  w.midi.play('c#4', 0);
  w.midi.play('Db4', 0.5);
  assert.deepEqual(pressed, [[61, 1], [61, Math.round(0.5 * 127) / 127]]);
  assert.deepEqual(released, [61]);
  assert.equal(typeof pressed[0][0], 'number');
  assert.throws(() => w.midi.play('H4', 1), /A–G/);
});

test("midi.play('C#4') sends the bytes [0x90, 61, 127], then [0x80, 61, 0]", () => {
  // midiMessage(bytes) is every message that goes through the one parser, as the bytes a controller would send
  const got = [];
  const w = page({ navigator: {} });
  w.midi.on('midiMessage', (b) => got.push([...b]));
  w.midi.play('C#4', 1); w.midi.play('C#4', 0);
  assert.deepEqual(got.map((b) => b.slice(0, 2)), [[0x90, 61], [0x80, 61]]);
  assert.equal(got[0][2], 127);
});
