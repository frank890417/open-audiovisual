// Open Fixture Library fixtures coming in (tools/ofl/import.mjs): three real OFL files, unchanged (tests/fixtures/ofl, MIT),
// converted, validated, patched and rendered. What OFL does not say (Hz for "slow" and "fast", 24-bit) stays unsaid.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { fixtureFromOfl, OFL_REPO } from '../tools/ofl/import.mjs';
import { validateFixture } from '../packages/dmx/fixture.js';
import { Patch } from '../packages/dmx/patch.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const COMMIT = '849343f6eb7ab64f8d7d93209320bb25a1f5e11d';
const read = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/fixtures/ofl', rel), 'utf8'));
const convert = (rel, manufacturer) => fixtureFromOfl(read(rel), { file: `fixtures/${rel}`, commit: COMMIT, manufacturer, date: '2026-11-25' });

test('OFL: every sample converts into a valid, MIT, unverified profile that names its file and commit', () => {
  for (const [rel, maker] of [['generic/pan-tilt.json', 'Generic'], ['chauvet-dj/slimpar-t12-bt.json', 'Chauvet DJ'], ['eurolite/led-ml-56-rgbw.json', 'Eurolite']]) {
    const { fixture: f } = convert(rel, maker);
    assert.deepEqual(validateFixture(f), [], rel);
    assert.equal(f.license, 'MIT'); assert.equal(f.verified, false); assert.deepEqual(f.verifications, []);
    assert.equal(f.manufacturer, maker);
    assert.deepEqual({ repo: f.origin.repo, commit: f.origin.commit, file: f.origin.file, license: f.origin.license }, { repo: OFL_REPO, commit: COMMIT, file: `fixtures/${rel}`, license: 'MIT' });
    assert.equal(f.sources[0].url, `${OFL_REPO}/blob/${COMMIT}/fixtures/${rel}`);
    assert.ok(f.origin.author, 'the authors are kept');
    assert.match(f.notes, /Nobody has checked it on a light/);
  }
  assert.equal(convert('generic/pan-tilt.json').fixture.id, 'ofl-generic-pan-tilt', 'OFL\'s generic fixtures do not take our generic-* ids');
  assert.equal(convert('chauvet-dj/slimpar-t12-bt.json').fixture.id, 'chauvet-dj-slimpar-t12-bt');
  assert.throws(() => fixtureFromOfl(read('generic/pan-tilt.json'), { file: 'pan-tilt.json', commit: COMMIT }), /fixtures\/<manufacturer>/);
  assert.throws(() => fixtureFromOfl(read('generic/pan-tilt.json'), { file: 'fixtures/generic/pan-tilt.json', commit: 'main' }), /40-character/);
});

test('OFL pan/tilt: fine channels become 16-bit pairs, "50%" is the middle, 24-bit modes are left out and said so', () => {
  const { fixture: f, skipped } = convert('generic/pan-tilt.json', 'Generic');
  assert.deepEqual(f.modes.map((m) => [m.id, m.channels]), [['8bit', ['pan', 'tilt']], ['16bit', ['pan', 'panFine', 'tilt', 'tiltFine']], ['16bit-alt', ['pan', 'tilt', 'panFine', 'tiltFine']]]);
  assert.deepEqual(skipped.map((s) => /"(\w+-?\w*)"/.exec(s)[1]), ['24bit', '24bit-alt']);
  assert.match(f.notes, /Left out: mode "24bit"/);
  assert.deepEqual(f.channels.pan, { type: 'pan', name: 'Pan', default: 128, degrees: 540 });
  assert.deepEqual(f.channels.panFine, { fineOf: 'pan', name: 'Pan fine' });
  assert.equal(f.channels.tilt.degrees, 180);
  // patched in the alternate order, pan 0.3 lands on addresses 1 and 3
  const p = new Patch({ profiles: [f] });
  p.add({ id: 'h', profile: f.id, mode: '16bit-alt', address: 1 });
  assert.deepEqual([...p.render({ h: { pan: 0.3, tilt: 0.5 } }).bytes(1).slice(0, 4)], [76, 128, 205, 0]);
  assert.deepEqual([...p.render({}).bytes(1).slice(0, 4)], [128, 128, 0, 0], 'defaults: the middle');
});

test('OFL SlimPAR T12 BT: OFL\'s Hz becomes the strobe range\'s Hz, and the cap holds the strobe at 3 Hz', () => {
  const { fixture: f } = convert('chauvet-dj/slimpar-t12-bt.json', 'Chauvet DJ');
  assert.equal(f.kind, 'par');
  assert.deepEqual(f.modes.map((m) => m.id), ['3ch', '7ch']);
  assert.deepEqual(f.channels.strobe, { type: 'strobe', name: 'Strobe', ranges: [{ from: 0, to: 255, is: 'strobe', hz: [0, 20], label: 'Strobe' }] });
  assert.equal(f.channels.autoProgram.type, 'control', 'built-in programs are the fixture\'s own show: control only');
  assert.equal(f.channels.autoProgramSpeed.type, 'control', 'a sound-active range on it: control too');
  assert.match(f.notes, /OFL asks for help: Strobe: At which DMX values is strobe disabled/);
  const p = new Patch({ profiles: [f] });
  p.add({ id: 's', profile: f.id, mode: '7ch', address: 1 });
  // 7ch: red green blue strobe autoProgram autoProgramSpeed dimmer. 3 Hz of 0–20 Hz over 0–255: floor(0.15 · 255) = 38
  assert.deepEqual([...p.render({ s: { dimmer: 1, color: [1, 0, 0], strobe: 1 } }).bytes(1).slice(0, 7)], [255, 0, 0, 38, 0, 0, 255]);
  assert.equal(p.render({ s: { strobe: 1 } }, { maxFlashHz: Infinity }).get(1).get(4), 255);
});

test('OFL Eurolite LED ML-56: a mixed "Function" channel is a strobe whose open values are kept, and "slow/fast" gets no Hz', () => {
  const { fixture: f } = convert('eurolite/led-ml-56-rgbw.json', 'Eurolite');
  assert.deepEqual(f.channels.coolWhite, { type: 'color', name: 'Cool White', color: 'white' });
  assert.deepEqual(f.channels.function.ranges, [
    { from: 0, to: 0, is: 'open' }, { from: 1, to: 5, is: 'effect', label: 'Sound Controlled (15 Colors)' },
    { from: 6, to: 10, is: 'open' }, { from: 11, to: 255, is: 'strobe', label: 'Strobe' },
  ]);
  assert.ok(f.channels.function.ranges.every((r) => r.hz === undefined), 'slow → fast is not turned into Hz');
  const p = new Patch({ profiles: [f] });
  p.add({ id: 'e', profile: f.id, mode: '6ch', address: 1 });
  const b = (st, o) => [...p.render({ e: st }, o).bytes(1).slice(0, 6)];
  assert.deepEqual(b({ dimmer: 1, color: [1, 1, 1], strobe: 1 }), [0, 0, 0, 255, 255, 0], 'no Hz: under the cap the strobe stays open');
  assert.deepEqual(b({ dimmer: 1, strobe: 0.5 }, { maxFlashHz: Infinity }).slice(5), [133], 'cap off: inside 11–255, never the sound-active 1–5');
});

test('OFL: what the converter refuses instead of guessing', () => {
  const base = read('generic/pan-tilt.json');
  const at = { file: 'fixtures/generic/pan-tilt.json', commit: COMMIT };
  assert.throws(() => fixtureFromOfl({ ...base, matrix: { pixelCount: [4, 1, 1] } }, at), /matrix/);
  assert.throws(() => fixtureFromOfl({ ...base, availableChannels: { ...base.availableChannels, Pan: { ...base.availableChannels.Pan, switchChannels: {} } } }, at), /switches channels/);
  assert.throws(() => fixtureFromOfl({ ...base, modes: [{ name: 'x', channels: ['Pan', { insert: 'matrixChannels' }] }] }, at), /matrix channels/);
  assert.throws(() => fixtureFromOfl({ ...base, modes: [{ name: 'x', channels: ['Pan', 'Pan fine^2'] }] }, at), /no mode left/);
  // an empty slot in an OFL mode keeps the addresses after it where they are
  const { fixture } = fixtureFromOfl({ ...base, modes: [{ name: 'gap', channels: ['Pan', null, 'Tilt'] }] }, at);
  assert.deepEqual(fixture.modes[0].channels, ['pan', 'unused1', 'tilt']);
  assert.equal(fixture.channels.unused1.type, 'generic');
  // a Maintenance capability (reset, lamp) makes the whole channel a control channel
  const reset = fixtureFromOfl({ ...base, availableChannels: { ...base.availableChannels, Tilt: { capabilities: [{ dmxRange: [0, 199], type: 'Tilt', angleStart: '0deg', angleEnd: '180deg' }, { dmxRange: [200, 255], type: 'Maintenance', comment: 'Reset' }] } }, modes: [{ name: '8 bit', channels: ['Pan', 'Tilt'] }] }, at);
  assert.equal(reset.fixture.channels.tilt.type, 'control');
});

test('licences: the notice names OFL and its commit; the samples are OFL\'s files byte for byte', () => {
  const n = fs.readFileSync(path.join(ROOT, 'NOTICE'), 'utf8');
  assert.ok(n.includes('Open Fixture Library') && n.includes(COMMIT) && n.includes('LICENSES/MIT-open-fixture-library.txt'));
  assert.match(fs.readFileSync(path.join(ROOT, 'LICENSES/MIT-open-fixture-library.txt'), 'utf8'), /^MIT License\n\nCopyright \(c\) 2017 Florian & Felix Edelmann/);
  assert.ok(fs.readFileSync(path.join(ROOT, 'tests/fixtures/ofl/README.md'), 'utf8').includes(COMMIT));
  // git blob ids of the three files in OFL at that commit: the copies here are unchanged
  const blob = (rel) => { const b = fs.readFileSync(path.join(ROOT, 'tests/fixtures/ofl', rel)); return crypto.createHash('sha1').update(`blob ${b.length}\0`).update(b).digest('hex'); };
  assert.equal(blob('generic/pan-tilt.json'), '901651e1490c2ba7565f3d9ceee31c49da0a3b4d');
  assert.equal(blob('chauvet-dj/slimpar-t12-bt.json'), '6cddb0f63317804523e0b85a9cbfc33b4b751773');
  assert.equal(blob('eurolite/led-ml-56-rgbw.json'), 'f1dec5c505ceb4377268aeeab7eaf8f4d694d79e');
});
