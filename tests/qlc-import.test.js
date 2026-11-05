// QLC+'s input profiles coming in: what becomes a new file, what only fills a gap, and the rules that hold for every one of them.
// The conversion is run on real .qxi files (tests/fixtures/qlc, Apache-2.0) and the committed output is read as it stands.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateProfile, normalizeProfile } from '../packages/midi/profiles.js';
import { PROFILES, profileById } from '../packages/midi/profiles/index.js';
import { IMPORTED, importedUrl } from '../packages/midi/profiles/imported.js';
import { resolveProfile } from '../packages/midi/embed.js';
import { MidiController } from '../packages/midi/controller.js';
import { profileFromQxi, enrichFromQxi, autoLayout, SKIP, EXISTING, QLC_REPO } from '../tools/qlc/import.mjs';
import { toQxi, toMixxx } from '../packages/midi/export.js';
import { parseQxi } from '../tools/qlc/qxi.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const fixture = (n) => read(`tests/fixtures/qlc/${n}`);
const COMMIT = '6ed78ed0a697aaa48b1428271e004b22327e5be3';
const dir = 'packages/midi/profiles/imported';
const files = fs.readdirSync(path.join(ROOT, dir)).filter((f) => f.endsWith('.json'));
const all = files.map((f) => JSON.parse(read(`${dir}/${f}`)));

test('the list and the folder agree, and nothing collides with what ships', () => {
  assert.equal(files.length, 28);
  assert.deepEqual(IMPORTED.map((p) => p.id).sort(), all.map((p) => p.id).sort());
  const shipped = new Set(PROFILES.flatMap((p) => [p.id, p.short]));
  for (const p of all) { assert.ok(!shipped.has(p.id), p.id); assert.ok(!shipped.has(p.short), p.short); }
  assert.equal(new Set(all.map((p) => p.short)).size, all.length);
  assert.equal(all.length + Object.keys(SKIP).length + Object.keys(EXISTING).length, 41, 'every .qxi of the folder is accounted for');
});

test('every imported file passes the validator and keeps the rules of the import', () => {
  for (const p of all) {
    assert.deepEqual(validateProfile(p), [], p.id);
    assert.ok(p.controls.every((c) => c.verified === false), `${p.id}: every control unverified`);
    assert.ok(!p.verifications, `${p.id}: nobody checked it`);
    assert.equal(p.license, 'Apache-2.0', p.id);
    assert.equal(p.face.auto, true, `${p.id}: the layout says it is generated`);
    assert.equal(p.origin.commit, COMMIT); assert.equal(p.origin.repo, QLC_REPO); assert.match(p.origin.file, /^resources\/inputprofiles\/.+\.qxi$/);
    assert.ok(p.origin.author, `${p.id}: the author is kept`);
    assert.ok(p.sources[0].url.includes(`/blob/${COMMIT}/resources/inputprofiles/`), p.id);
    assert.match(p.sources[0].title, /non-official/);
    assert.ok(new MidiController(p, { sink: () => {} }).profile.controls.length, p.id);
  }
});

test('a new profile keeps the messages of the .qxi', () => {
  const p = profileFromQxi(fixture('KORG-nanoKONTROL2.qxi'), { file: 'KORG-nanoKONTROL2.qxi', commit: COMMIT, date: '2026-11-04' });
  const q = parseQxi(fixture('KORG-nanoKONTROL2.qxi'));
  assert.equal(p.controls.length, q.channels.length);
  const s1 = p.controls.find((c) => c.label === 'Slider 1');
  assert.deepEqual([s1.type, s1.msg, s1.cc, s1.ch], ['fader', 'cc', 0, 1]);
  assert.match(p.notes, /placeholder/, 'numbers with no channel say the channel is a guess');
  assert.deepEqual(validateProfile(p), []);
  const a = profileFromQxi(fixture('Akai-APC40-mkII.qxi'), { file: 'Akai-APC40-mkII.qxi', commit: COMMIT, date: '2026-11-04' });
  const s2 = a.controls.find((c) => c.label === 'Slider 2');
  assert.deepEqual([s2.msg, s2.cc, s2.ch], ['cc', 7, 2], 'number 4103 is CC 7 on channel 2');
  assert.equal(a.maker, 'AKAI Professional', 'one spelling of a maker');
  assert.ok(a.palette.colors.every((c) => c.value <= 127), 'colour values are MIDI values, not the 8-bit ones in the file');
  assert.equal(a.palette.colors.find((c) => c.name === 'Red').value, 5);
  const led = a.controls.find((c) => c.led);
  assert.ok(led.led.on <= 127 && led.led.off <= 127);
});

test('an existing profile only gains: numbers are never changed', () => {
  for (const [file, id] of [['Akai-APC40-mkII.qxi', 'akai-apc40-mk2'], ['KORG-nanoKONTROL2.qxi', 'korg-nanokontrol2']]) {
    const before = JSON.parse(read(`packages/midi/profiles/${id}.json`));
    const { profile } = enrichFromQxi(before, fixture(file), { file, commit: COMMIT });
    assert.equal(profile.controls.length, before.controls.length);
    for (const [i, c] of profile.controls.entries()) {
      const b = before.controls[i];
      assert.deepEqual([c.id, c.msg, c.ch, c.cc, c.note], [b.id, b.msg, b.ch, b.cc, b.note], `${id} ${c.id}`);
      assert.ok(!(b.led && JSON.stringify(c.led) !== JSON.stringify(b.led)), `${id} ${c.id}: an LED it had stays`);
      assert.equal(c.verified, b.verified, `${id} ${c.id}: a mark it had stays`);
    }
    assert.deepEqual(validateProfile(profile), [], id);
  }
});

test('the three enriched files carry the palette with its source, and say whose it is', () => {
  for (const id of ['akai-apc40-mk2', 'akai-apc-mini-mk2', 'novation-launchpad-mini-mk3']) {
    const p = profileById(id), s = p.sources[p.palette.cite.source];
    assert.match(s.title, /QLC\+ input profile/); assert.equal(s.license, 'Apache-2.0'); assert.ok(s.url.includes(COMMIT), id);
    assert.ok(p.palette.colors.length > 50, id);
  }
  // the Launchpad palette agrees with Novation's manual: 5 is red, 13 yellow, 21 green, 45 blue
  const rgb = (v) => profileById('novation-launchpad-mini-mk3').palette.colors.find((c) => c.value === v)?.rgb;
  assert.ok(rgb(5) && rgb(13) && rgb(21) && rgb(45));
  assert.equal(profileById('novation-launchpad-mini-mk3').palette.channels.length, 3);
});

test('a generated layout shows every control once and fits its faceplate', () => {
  const controls = Array.from({ length: 70 }, (_, i) => ({ id: `b${i}`, type: i < 8 ? 'fader' : i < 12 ? 'knob' : 'button' }));
  const { face, sections } = autoLayout(controls, 'Test');
  assert.equal(face.auto, true);
  assert.equal(sections.flatMap((s) => s.controls).length, 70);
  for (const s of sections) { assert.ok(s.y + s.h <= face.h, s.id); assert.ok(s.cols * s.rows >= s.controls.length, s.id); }
});

test('an imported id resolves by fetching its one file, and nothing else is fetched', async () => {
  assert.match(importedUrl('behringer-bcf2000'), /profiles\/imported\/behringer-bcf2000\.json$/);
  assert.equal(importedUrl('bcf2000'), importedUrl('behringer-bcf2000'), 'by short name too');
  assert.equal(importedUrl('nope'), null);
  const asked = [];
  const p = await resolveProfile('behringer-bcf2000', { profiles: PROFILES, fetch: async (url) => { asked.push(url); return { ok: true, json: async () => JSON.parse(read(`${dir}/behringer-bcf2000.json`)) }; } });
  assert.equal(p.id, 'behringer-bcf2000'); assert.equal(asked.length, 1);
  await assert.rejects(resolveProfile('nope', { profiles: PROFILES }), /unknown MIDI profile/);
  assert.equal(PROFILES.length, 27, 'PROFILES stays what every embed loads');
  assert.ok(!read('packages/midi/profiles/index.js').includes('imported/'), 'imported files are not imported statically');
});

test('they export like any other, and every one has its pages', () => {
  for (const p of all) {
    assert.deepEqual(parseQxi(toQxi(p)).channels.length >= p.controls.length, true, p.id);
    assert.doesNotThrow(() => new Function(toMixxx(p).js), p.id);
    for (const [lang, base] of [['en', ''], ['zh', 'zh/']]) {
      const page = read(`${base}controllers/${p.id}/index.html`);
      assert.match(page, lang === 'en' ? /generated automatically/ : /自動產生/, `${lang} ${p.id}: the page says the layout is generated`);
      assert.match(page, /Apache-2\.0/, `${lang} ${p.id}: and whose data it is`);
      assert.ok(page.includes(`controllers/verify/?profile=${p.id}`), `${lang} ${p.id}: and how to check it`);
      assert.ok(!page.includes('id="p5"'), `${lang} ${p.id}: oav-p5 does not know these ids yet`);
    }
  }
  for (const f of ['controllers/index.html', 'zh/controllers/index.html']) { const s = read(f); for (const p of all) assert.ok(s.includes(`href="${p.id}/"`), `${f}: ${p.id}`); }
});

test('licences: the notice names what came from where, and nothing GPL or share-alike came in', () => {
  const n = read('NOTICE');
  assert.ok(n.includes(COMMIT)); assert.match(n, /Apache License 2\.0/); assert.match(n, /Massimo Callegari/);
  assert.match(read('LICENSES/Apache-2.0.txt'), /Apache License\s+Version 2\.0/);
  for (const f of [...PROFILES.map((p) => JSON.stringify(p.sources)), ...all.map((p) => JSON.stringify(p.sources))]) assert.doesNotMatch(f, /midi\.guide|mixxxdj\/mixxx/);
});
