import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DrumSequencer, PATTERNS, GM } from '../packages/drums/index.js';

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
