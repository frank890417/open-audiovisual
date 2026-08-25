import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MidiMeter } from '../packages/console/src/midi-meter.js';

test('note-on drives env/flash/held/dots; note-off releases held', () => {
  const m = new MidiMeter();
  m.ingest([0x90, 60, 100], 0);            // ch1 note on
  const c = m.ch[0];
  assert.ok(c.env > 0.7 && c.flash === 1);
  assert.equal(c.held.size, 1);
  assert.equal(c.dots.length, 1);
  m.ingest([0x80, 60, 0], 0.1);
  assert.equal(c.held.size, 0);
});

test('decay: env falls, held floor keeps it up', () => {
  const m = new MidiMeter();
  m.ingest([0x90, 60, 127], 0);
  m.decay(0); m.decay(2);                   // 2s later
  assert.ok(m.ch[0].env >= 0.85 * 0.99, 'held note keeps an env floor');
  m.ingest([0x80, 60, 0], 2);
  m.decay(4);                               // decay clamps dt to 0.25 per call
  for (let t = 4; t < 10; t += 0.1) m.decay(t);
  assert.ok(m.ch[0].env < 0.05, 'released note decays away');
});

test('panic (CC123) clears held without counting as signal', () => {
  const m = new MidiMeter();
  m.ingest([0x90, 60, 100], 0);
  m.ingest([0x90, 64, 100], 0);
  const before = m.ch[0].evCount;
  m.ingest([0xb0, 123, 0], 0.1);
  assert.equal(m.ch[0].held.size, 0);
  assert.equal(m.ch[0].evCount, before);
});

test('rate window counts events per second per channel', () => {
  const m = new MidiMeter();
  for (let i = 0; i < 5; i++) m.ingest([0x91, 60 + i, 90], 0.1 * i);  // ch2
  m.decay(0.5); m.decay(1.6);               // cross the 1s boundary
  assert.equal(m.ch[1].rate, 5);
});
