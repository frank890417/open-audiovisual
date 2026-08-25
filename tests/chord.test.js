import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ChordDetector } from '../packages/chord/index.js';

const d = new ChordDetector();

test('single note', () => {
  const a = d.analyze([60]);
  assert.equal(a.chordType, 'single');
  assert.equal(a.dissonanceLevel, 0);
});

test('C major triad — consonant, triad, stacked thirds', () => {
  const a = d.analyze([60, 64, 67]);
  assert.equal(a.chordType, 'major');
  assert.ok(a.isTriad);
  assert.ok(a.isConsonant);
  assert.ok(a.thirdsFraction === 1);
  assert.equal(a.dissonanceLevel, 0);
});

test('A minor triad', () => {
  const a = d.analyze([57, 60, 64]);
  assert.equal(a.chordType, 'minor');
  assert.ok(a.isTriad);
});

test('first-inversion major (E-G-C) resolves via rotation', () => {
  const a = d.analyze([64, 67, 72]);
  assert.equal(a.chordType, 'major');
});

test('dominant 7th', () => {
  const a = d.analyze([60, 64, 67, 70]);
  assert.equal(a.chordType, 'dom7');
});

test('chromatic cluster — severe dissonance', () => {
  const a = d.analyze([60, 61, 62, 63]);
  assert.equal(a.dissonanceLevel, 2);
  assert.ok(a.isDissonant);
  assert.ok(a.consonance < -0.4 || a.chordType === 'cluster');
});

test('mild dissonance = level 1 (storm warning, not decay)', () => {
  const a = d.analyze([60, 62]);        // major 2nd
  assert.equal(a.dissonanceLevel, 1);
});

test('gesture window flushes one chord', async () => {
  let got = null;
  const det = new ChordDetector({ window: 10, onChord: (a) => { got = a; } });
  det.noteOn(60); det.noteOn(64); det.noteOn(67);
  await new Promise(r => setTimeout(r, 40));
  assert.ok(got);
  assert.equal(got.chordType, 'major');
  assert.equal(got.count, 3);
});
