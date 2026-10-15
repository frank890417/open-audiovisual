import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DrumSequencer, PATTERNS, GM, voiceForNote, laneSteps } from '../packages/drums/index.js';

test('GM notes are the standard drum map', () => {
  assert.equal(GM.kick, 36);
  assert.equal(GM.snare, 38);
  assert.equal(GM.hat, 42);
});

test('four-on-floor fires 4 kicks per bar at steady bpm', () => {
  const hits = [];
  const seq = new DrumSequencer({ onHit: (lane, vel) => hits.push({ lane, vel }), bpm: 120, swing: 0, humanize: 0, pattern: 'four on floor' });
  seq.toggle(true);
  const barDur = (60 / 120 / 4) * 16;               // 2s
  for (let t = 0; t < barDur - 1e-9; t += 1 / 60) seq.update(1 / 60);
  const kicks = hits.filter(h => h.lane === 'kick').length;
  assert.equal(kicks, 4, `expected 4 kicks in one bar, got ${kicks}`);
  const hats = hits.filter(h => h.lane === 'hat').length;
  assert.equal(hats, 8);
  for (const h of hits) assert.ok(h.vel > 0 && h.vel <= 1);
});

test('humanize jitters velocity but stays in range; pattern presets all 16 steps', () => {
  for (const [name, p] of Object.entries(PATTERNS))
    for (const lane of Object.keys(p)) assert.equal(p[lane].length, 16, `${name}/${lane}`);
  const vels = new Set();
  const seq = new DrumSequencer({ onHit: (l, v) => vels.add(v.toFixed(3)), bpm: 140, humanize: 0.8, pattern: 'breakbeat' });
  seq.toggle(true);
  for (let i = 0; i < 600; i++) seq.update(1 / 60);
  assert.ok(vels.size > 3, 'humanize should vary velocities');
});

test('toggleCell edits the grid and marks pattern custom; toggle(false) stops firing', () => {
  let fired = 0;
  const seq = new DrumSequencer({ onHit: () => fired++, pattern: 'sparse' });
  seq.toggleCell('clap', 0);
  assert.equal(seq.grid.clap[0], 1);
  assert.equal(seq.pattern, 'custom');
  seq.toggle(false);
  for (let i = 0; i < 300; i++) seq.update(1 / 60);
  assert.equal(fired, 0);
});

test('the kit covers the GM pad notes: every named voice has a note and plays', () => {
  for (const [name, note] of Object.entries(GM)) assert.equal(voiceForNote(note), name, `${name} (${note})`);
  assert.equal(voiceForNote(35), 'kick'); assert.equal(voiceForNote(57), 'crash'); assert.equal(voiceForNote(59), 'ride');
  assert.equal(voiceForNote(60), null, 'melodic notes stay silent on the drum engine');
});

test('onStep: every 16th is announced once, in order, with the count since start (the clock a timeline counts bars on)', () => {
  const steps = [], hits = [];
  const seq = new DrumSequencer({ onStep: (i, n) => steps.push([i, n]), onHit: (l) => hits.push([l, steps.length]), bpm: 120, swing: 0, humanize: 0 });
  seq.toggle(true);
  for (let t = 0; t < 4 - 1e-9; t += 1 / 60) seq.update(1 / 60);       // two bars at 120 bpm
  assert.equal(steps.length, 32);
  assert.deepEqual(steps.slice(14, 18), [[14, 14], [15, 15], [0, 16], [1, 17]]);
  assert.equal(hits[0][1], 1, 'a step is announced before its hits');
  seq.toggle(false); seq.toggle(true); seq.update(0.001);
  assert.deepEqual(steps.at(-1), [0, 0], 'a restart counts from 0');
});

test('setPattern: a preset, your own grid as text or lists, an unknown name falls back and says so', () => {
  assert.deepEqual(laneSteps('x... x... x... x...'), laneSteps('1000100010001000'));
  assert.deepEqual(laneSteps([1, 0, true]).slice(0, 4), [1, 0, 1, 0]);
  assert.equal(laneSteps('x'.repeat(40)).length, 16);
  const seq = new DrumSequencer({ pattern: 'latin' });
  assert.equal(seq.pattern, 'latin');
  seq.setPattern({ kick: 'x...x...x...x...', hat: [0, 1, 0, 1] });
  assert.equal(seq.pattern, 'custom');
  assert.deepEqual(seq.grid.kick, laneSteps(PATTERNS['four on floor'].kick));
  assert.deepEqual(seq.grid.hat.slice(0, 4), [0, 1, 0, 1]);
  assert.deepEqual(seq.grid.snare, Array(16).fill(0), 'a lane left out is silent');
  seq.setPattern('no such thing');
  assert.equal(seq.pattern, 'four on floor');
});

test('a hit humanized past a stop never lands after the next start', () => {
  let n = 0;
  const seq = new DrumSequencer({ onHit: () => n++, bpm: 120, swing: 0, humanize: 1, pattern: 'four on floor' });
  seq._pending = [{ lane: 'kick', vel: 1, at: 99 }];
  seq.toggle(false); seq.toggle(true);
  assert.equal(seq._pending, null);
});
