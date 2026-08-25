import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SimPlayer, PIANO_KEYMAP } from '../packages/keys/index.js';

test('PIANO_KEYMAP is the DAW standard (A-row whites, W-row blacks)', () => {
  assert.equal(PIANO_KEYMAP.a, 0);    // C
  assert.equal(PIANO_KEYMAP.w, 1);    // C#
  assert.equal(PIANO_KEYMAP.k, 12);   // C up an octave
});

test('SimPlayer plays notes, holds them, releases them, stays in range', () => {
  const on = new Map(); const events = [];
  const sim = new SimPlayer({
    press: (n, v) => { on.set(n, v); events.push(['on', n]); assert.ok(v > 0 && v <= 1); },
    release: (n) => { assert.ok(on.delete(n), `release of un-pressed note ${n}`); events.push(['off', n]); },
    base: 60, density: 4,
  });
  sim.toggle(true);
  for (let i = 0; i < 2000; i++) sim.update(1 / 60);   // ~33 simulated seconds
  assert.ok(events.filter(e => e[0] === 'on').length > 10, 'should have played notes');
  for (const [, n] of events) assert.ok(n >= 36 && n <= 108, `note ${n} out of a sane range`);
  sim.toggle(false);
  assert.equal(on.size, 0, 'toggle-off must release everything (no stuck notes)');
});

test('SimPlayer is silent when disabled', () => {
  let fired = 0;
  const sim = new SimPlayer({ press: () => fired++, release: () => {} });
  for (let i = 0; i < 600; i++) sim.update(1 / 60);
  assert.equal(fired, 0);
});
