// 02 chord garden: the L-system port from The Last Input stays deterministic and bounded.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ARCHETYPES, PLANT_SPECIES, makeGene, growSkeleton } from '../examples/02-chord-garden/lsystem.js';

const seeded = (seed) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;

test('14 TLI species, each grows a bounded skeleton with a real height', () => {
  assert.equal(PLANT_SPECIES.length, 14);
  for (const name of PLANT_SPECIES) {
    const sk = growSkeleton(makeGene(seeded(42), 0.6, 0, name));
    assert.ok(sk.n > 0 && sk.n <= 601, `${name}: ${sk.n} segments`);
    assert.ok(sk.height > 0, `${name} has height`);
    assert.equal(sk.seg.length, sk.n * 6);
  }
});

test('makeGene: species by name is honoured, same seed is the same plant', () => {
  assert.equal(makeGene(seeded(1), 0.5, 0, 'palm').species, 'palm');
  const a = makeGene(seeded(7), 0.8), b = makeGene(seeded(7), 0.8);
  assert.deepEqual(a, b);
});

test('segments are ordered by branch order: the trunk grows before the twigs', () => {
  const sk = growSkeleton(makeGene(seeded(3), 0.9, 0, 'tree'));
  for (let i = 1; i < sk.n; i++) assert.ok(sk.depth[i] >= sk.depth[i - 1]);
  assert.ok(sk.tips.length > 1, 'branch tips exist for leaves and flowers');
});

test('velocity prefers size classes: loud notes lean tall, soft notes lean short', () => {
  const mean = (vel) => { const r = seeded(99); let t = 0; for (let i = 0; i < 400; i++) { const sp = makeGene(r, vel).species; t += ARCHETYPES.find(a => a.name === sp).scale; } return t / 400; };
  assert.ok(mean(0.95) > mean(0.05));
});
