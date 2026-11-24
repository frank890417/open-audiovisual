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

// ------------------------------------------------------------------ what the converter learned for the first batch
test('OFL: a switch written on a capability is refused; a wheel slot keeps its name; the linked manual is a source', () => {
  const base = read('generic/pan-tilt.json');
  const at = { file: 'fixtures/generic/pan-tilt.json', commit: COMMIT };
  const sw = { ...base, availableChannels: { ...base.availableChannels, Pan: { capabilities: [{ dmxRange: [0, 127], type: 'Pan', angleStart: '0deg', angleEnd: '540deg', switchChannels: { 'Speed / Strobe': 'Speed' } }, { dmxRange: [128, 255], type: 'Pan', angleStart: '0deg', angleEnd: '540deg', switchChannels: { 'Speed / Strobe': 'Strobe' } }] } } };
  assert.throws(() => fixtureFromOfl(sw, at), /"Pan" switches channels/);
  const wheel = {
    ...base,
    wheels: { 'Color Wheel': { slots: [{ type: 'Open' }, { type: 'Color', name: 'Red' }, { type: 'Gobo' }] } },
    availableChannels: { ...base.availableChannels, 'Color Wheel': { capabilities: [{ dmxRange: [0, 63], type: 'WheelSlot', slotNumber: 1 }, { dmxRange: [64, 95], type: 'WheelSlot', slotNumber: 1.5 }, { dmxRange: [96, 159], type: 'WheelSlot', slotNumber: 2 }, { dmxRange: [160, 255], type: 'WheelSlot', slotNumber: 3 }] } },
    modes: [{ name: '3ch', channels: ['Pan', 'Tilt', 'Color Wheel'] }],
    links: { manual: ['https://example.org/manual.pdf'], productPage: ['https://example.org/p'] },
    meta: { ...base.meta, lastModifyDate: '2024-01-16' },
  };
  const { fixture: f } = fixtureFromOfl(wheel, { ...at, manufacturer: 'Generic', date: '2026-11-24' });
  assert.equal(f.channels.colorWheel.type, 'colorWheel');
  assert.deepEqual(f.channels.colorWheel.ranges.map((r) => r.label), ['Open', 'Open / Red', 'Red', 'Gobo 3']);
  assert.deepEqual(f.sources.slice(1).map((s) => [s.url, s.note]), [['https://example.org/manual.pdf', 'linked from the OFL file; not read by this project'], ['https://example.org/p', 'linked from the OFL file; not read by this project']]);
  assert.match(f.origin.note, /last modified on 2024-01-16/);
});

test('OFL gates: what a fixture must pass before it is imported', async () => {
  const { importProblems, oflProblems, profileProblems } = await import('../tools/ofl/gates.mjs');
  const eurolite = read('eurolite/led-ml-56-rgbw.json');
  const { fixture } = convert('eurolite/led-ml-56-rgbw.json', 'Eurolite');
  assert.deepEqual(importProblems(eurolite, fixture), [], 'a sample OFL ships passes');
  assert.match(oflProblems({ ...eurolite, links: {} }).join(), /manual/);
  const inverted = { ...eurolite, availableChannels: { ...eurolite.availableChannels, Dimmer: { capability: { type: 'Intensity', brightnessStart: '100%', brightnessEnd: '0%' } } } };
  assert.match(oflProblems(inverted).join(), /inverted: "Dimmer"/);
  // a UV channel that OFL calls "Dimmer": the dimmer property cannot reach it
  const uv = { ...fixture, channels: { dimmer: { type: 'color', color: 'uv' } }, modes: [{ id: '1ch', channels: ['dimmer'] }] };
  assert.match(profileProblems(uv).join(), /key: in mode 1ch, "dimmer" is a color channel/);
  // a shutter that rests closed: the light stays dark while a page shows it lit
  const shut = { ...fixture, channels: { ...fixture.channels, function: { type: 'strobe', ranges: [{ from: 0, to: 7, is: 'closed' }, { from: 8, to: 15, is: 'open' }, { from: 16, to: 255, is: 'strobe' }] } } };
  assert.match(profileProblems(shut).join(), /closed: in mode 6ch, "function" rests at 0/);
  const presets = { ...fixture, channels: { macro: { type: 'generic' }, ...fixture.channels }, modes: [{ id: '1ch', channels: ['macro'] }] };
  assert.match(profileProblems(presets).join(), /dark: mode 1ch has no intensity/);
});

// ------------------------------------------------------------------ the batch that is committed
const IMPORTED = path.join(ROOT, 'packages/dmx/fixtures/imported');
const importedFiles = () => (fs.existsSync(IMPORTED) ? fs.readdirSync(IMPORTED).filter((f) => f.endsWith('.json')).sort() : []);

/** The part of JSON Schema fixture.schema.json uses ($ref, oneOf, not, const, enum, pattern, min/max, propertyNames, additionalProperties). */
function schemaErrors(schema, v, root, at = '$', out = []) {
  if (schema.$ref) return schemaErrors(schema.$ref.split('/').slice(1).reduce((s, k) => s[k], root), v, root, at, out);
  const is = { object: () => v !== null && typeof v === 'object' && !Array.isArray(v), array: () => Array.isArray(v), string: () => typeof v === 'string',
    number: () => typeof v === 'number', integer: () => Number.isInteger(v), boolean: () => typeof v === 'boolean' };
  if (schema.oneOf) { const ok = schema.oneOf.filter((s) => !schemaErrors(s, v, root, at).length).length; if (ok !== 1) out.push(`${at}: matches ${ok} of oneOf`); }
  if (schema.not && !schemaErrors(schema.not, v, root, at).length) out.push(`${at}: matches "not"`);
  if (schema.type && !is[schema.type]()) { out.push(`${at}: not ${schema.type}`); return out; }
  if ('const' in schema && v !== schema.const) out.push(`${at}: is not ${schema.const}`);
  if (schema.enum && !schema.enum.includes(v)) out.push(`${at}: ${JSON.stringify(v)} not in enum`);
  if (typeof v === 'string' && schema.pattern && !new RegExp(schema.pattern).test(v)) out.push(`${at}: ${v} does not match ${schema.pattern}`);
  if (typeof v === 'string' && schema.minLength && v.length < schema.minLength) out.push(`${at}: too short`);
  if (typeof v === 'number') {
    if (schema.minimum !== undefined && v < schema.minimum) out.push(`${at}: below minimum`);
    if (schema.maximum !== undefined && v > schema.maximum) out.push(`${at}: above maximum`);
    if (schema.exclusiveMinimum !== undefined && v <= schema.exclusiveMinimum) out.push(`${at}: not above ${schema.exclusiveMinimum}`);
  }
  if (Array.isArray(v)) {
    if (schema.minItems && v.length < schema.minItems) out.push(`${at}: too few items`);
    if (schema.maxItems !== undefined && v.length > schema.maxItems) out.push(`${at}: too many items`);
    if (schema.items) v.forEach((x, i) => schemaErrors(schema.items, x, root, `${at}[${i}]`, out));
  }
  if (is.object()) {
    for (const k of schema.required || []) if (!(k in v)) out.push(`${at}: missing ${k}`);
    if (schema.minProperties && Object.keys(v).length < schema.minProperties) out.push(`${at}: too few properties`);
    for (const [k, x] of Object.entries(v)) {
      if (schema.propertyNames) schemaErrors(schema.propertyNames, k, root, `${at}{${k}}`, out);
      if (schema.properties && k in schema.properties) schemaErrors(schema.properties[k], x, root, `${at}.${k}`, out);
      else if (schema.additionalProperties === false) out.push(`${at}: unknown property ${k}`);
      else if (typeof schema.additionalProperties === 'object') schemaErrors(schema.additionalProperties, x, root, `${at}.${k}`, out);
    }
  }
  return out;
}

test('the imported batch: every file is valid against fixture.schema.json and validateFixture, MIT, unverified, from the pinned OFL commit, and passes the gates', async () => {
  const schema = JSON.parse(fs.readFileSync(path.join(ROOT, 'packages/dmx/fixtures/fixture.schema.json'), 'utf8'));
  const { profileProblems } = await import('../tools/ofl/gates.mjs');
  const batch = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/ofl/batch-1.json'), 'utf8'));
  const files = importedFiles();
  assert.ok(files.length >= 35, `${files.length} imported fixtures`);
  assert.equal(batch.commit, COMMIT, 'the batch was chosen at the commit NOTICE names');
  const fromBatch = new Set(batch.fixtures);
  for (const f of files) {
    const fx = JSON.parse(fs.readFileSync(path.join(IMPORTED, f), 'utf8'));
    assert.equal(`${fx.id}.json`, f, `${f}: the file is named by its id`);
    assert.deepEqual(schemaErrors(schema, fx, schema), [], `${f}: fixture.schema.json`);
    assert.deepEqual(validateFixture(fx), [], `${f}: validateFixture`);
    assert.equal(fx.license, 'MIT'); assert.equal(fx.verified, false); assert.deepEqual(fx.verifications, []);
    assert.equal(fx.origin.commit, COMMIT, `${f}: the pinned commit`); assert.equal(fx.origin.repo, OFL_REPO); assert.equal(fx.origin.license, 'MIT');
    assert.ok(fromBatch.has(fx.origin.file), `${f}: ${fx.origin.file} is in tools/ofl/batch-1.json`);
    assert.equal(fx.sources[0].url, `${OFL_REPO}/blob/${COMMIT}/${fx.origin.file}`);
    assert.ok(fx.sources.some((s) => /: manual$/.test(s.title) && /^https?:\/\//.test(s.url)), `${f}: the manual OFL links`);
    assert.deepEqual(profileProblems(fx), [], `${f}: gates`);
  }
  assert.equal(files.length, batch.fixtures.length, 'one file per fixture of the batch');
});

test('the imported batch is listed lazily: imported-list.js is what the importer writes, and loading one fixture loads one file', async () => {
  const { listFiles, importedOnDisk, LIST_FILE, URL_FILE } = await import('../tools/import-ofl.mjs');
  const want = listFiles(importedOnDisk());
  const unstampText = (s) => s.replace(/\?v=[\w.+-]+/g, '');
  for (const rel of [LIST_FILE, URL_FILE]) assert.equal(unstampText(fs.readFileSync(path.join(ROOT, rel), 'utf8')), want[rel], `${rel} is what tools/import-ofl.mjs writes`);
  const { IMPORTED_FIXTURES, importedFixturePath, loadImportedFixture } = await import('../packages/dmx/fixtures/imported.js');
  assert.deepEqual(IMPORTED_FIXTURES.map((r) => r.id), importedFiles().map((f) => f.replace(/\.json$/, '')));
  assert.ok(!/\.json['"]/.test(fs.readFileSync(path.join(ROOT, LIST_FILE), 'utf8').replace(/\/\/.*$/gm, '')), 'the list imports no JSON');
  const id = IMPORTED_FIXTURES[0].id;
  assert.equal(importedFixturePath(id), `fixtures/imported/${id}.json`);
  assert.ok(fs.existsSync(path.join(ROOT, 'packages/dmx', importedFixturePath(id))));
  assert.equal(importedFixturePath('generic-rgbw'), null);
  const fx = await loadImportedFixture(id);
  assert.equal(fx.id, id);
  const p = new Patch({ profiles: [fx] });
  assert.equal(p.add({ id: 'one', profile: id, address: 1 }).footprint, IMPORTED_FIXTURES[0].modes[0].footprint, 'the row\'s footprint is the file\'s');
  await assert.rejects(loadImportedFixture('nope'), /no imported fixture "nope"/);
  const { FIXTURES } = await import('../packages/dmx/fixtures/index.js');
  assert.ok(FIXTURES.every((f) => f.id.startsWith('generic-')), 'FIXTURES stays the shipped generic ones');
});
