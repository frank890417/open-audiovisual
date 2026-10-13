// oav-p5.js without a browser: one parser for every source, the state a sketch reads, the callbacks it defines.
// (The browser half — p5 1.x/2.x, the 🎹 panel, the shim, a phone over a relay — is p5/test/smoke.cjs.)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const SRC = readFileSync(new URL('../p5/oav-p5.js', import.meta.url), 'utf8');

/** a fresh "page": no document, no Web MIDI (Safari-like), whatever globals the sketch defines */
function page(globals = {}) {
  const win = { console: { info() {}, warn() {}, error() {} }, navigator: {}, location: { search: '' }, URL, URLSearchParams, Promise, setTimeout, ...globals };
  win.window = win; win.globalThis = win;
  vm.runInNewContext(SRC, win);
  return win;
}

test('a key: midi.note, midi.held, noteOn / noteOff with velocity 0..1 and the channel', () => {
  const calls = [];
  const w = page({ noteOn: (n, v, ch) => calls.push(['on', n, v, ch]), noteOff: (n, ch) => calls.push(['off', n, ch]) });
  w.midi.input([0x90, 60, 127], 'hardware');
  w.midi.input([0x91, 48, 64], 'hardware');
  assert.equal(w.midi.note[60], 1);
  assert.deepEqual([...w.midi.held], [48, 60]);   // copied: the vm realm has its own Array
  w.midi.input([0x80, 60, 0], 'hardware');
  w.midi.input([0x91, 48, 0], 'hardware');               // note-on with velocity 0 is a release
  assert.equal(w.midi.note[60], 0);
  assert.deepEqual([...w.midi.held], []);
  assert.deepEqual(calls, [['on', 60, 1, 1], ['on', 48, 64 / 127, 2], ['off', 60, 1], ['off', 48, 2]]);
});

test('a knob and the bend: midi.cc 0..1, midi.bend −1..1, controlChange', () => {
  const got = [];
  const w = page({ controlChange: (cc, v) => got.push([cc, v]) });
  w.midi.input([0xB0, 74, 127]);
  w.midi.input([0xB0, 1, 0]);
  w.midi.input([0xE0, 0x7F, 0x7F]);
  assert.equal(w.midi.cc[74], 1);
  assert.equal(w.midi.cc[1], 0);
  assert.deepEqual(got, [[74, 1], [1, 0]]);
  assert.equal(w.midi.bend, 1);
  w.midi.input([0xE0, 0, 0x40]);
  assert.equal(w.midi.bend, 0);
  w.midi.input([0xE0, 0, 0]);
  assert.equal(w.midi.bend, -1);
});

test('clock, sysex and stray data bytes never reach the sketch', () => {
  const seen = [];
  const w = page({ midiMessage: (b) => seen.push(b) });
  w.midi.input([0xF8]); w.midi.input([0xF0, 1, 2]); w.midi.input([60, 100]); w.midi.input([]);
  assert.equal(seen.length, 0);
});

test('every source is the same bytes: last.source tells them apart, nothing else does', () => {
  const w = page();
  for (const s of ['hardware', 'screen', 'phone']) {
    w.midi.input([0x90, 62, 100], s);
    assert.equal(w.midi.last.source, s);
    assert.equal(w.midi.note[62], 100 / 127);
    w.midi.input([0x80, 62, 0], s);
  }
  w.midi.play(64, 0.5);
  assert.equal(w.midi.last.source, 'screen');
  assert.equal(w.midi.note[64], Math.round(0.5 * 127) / 127);
});

test('midi.on: several listeners, unknown names refused, off() works', () => {
  const w = page();
  const a = [], b = [];
  const off = w.midi.on('noteOn', (n) => a.push(n));
  w.midi.on('noteon', (n) => b.push(n));                 // the lower-case spelling WebMidi.js users type
  assert.throws(() => w.midi.on('nope', () => {}), /unknown event/);
  w.midi.input([0x90, 1, 1]); off(); w.midi.input([0x90, 2, 1]);
  assert.deepEqual(a, [1]);
  assert.deepEqual(b, [1, 2]);
});

test('an error inside the sketch callback does not stop the next message', () => {
  let n = 0;
  const w = page({ noteOn: () => { n++; throw new Error('student bug'); } });
  w.midi.input([0x90, 60, 1]); w.midi.input([0x90, 61, 1]);
  assert.equal(n, 2);
  assert.equal(w.midi.note[61], 1 / 127);
});

test('no Web MIDI here (Safari): hardware says unavailable instead of throwing', async () => {
  const w = page();
  assert.equal(await w.midi.connectHardware(), false);
  assert.equal(w.midi.hardware, 'unavailable');
});

test('loaded twice (the first line and the Custom Library): the first copy stays', () => {
  const w = page();
  const first = w.OAVp5;
  vm.runInNewContext(SRC, w);
  assert.equal(w.OAVp5, first);
  assert.equal(w.midi, first);
});

test('a page that already has its own `midi` keeps it', () => {
  const mine = { mine: true };
  const w = page({ midi: mine });
  assert.equal(w.midi, mine);
  assert.equal(typeof w.OAVp5.note, 'object');
});
