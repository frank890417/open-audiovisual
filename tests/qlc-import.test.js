// QLC+'s input profiles coming in: what becomes a new file, what only fills a gap, and the rules that hold for every one of them.
// The conversion is run on real .qxi files (tests/fixtures/qlc, Apache-2.0) and the committed output is read as it stands.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateProfile, normalizeProfile, matchProfile } from '../packages/midi/profiles.js';
import { PROFILES, profileById } from '../packages/midi/profiles/index.js';
import { IMPORTED, importedUrl } from '../packages/midi/profiles/imported.js';
import { resolveProfile } from '../packages/midi/embed.js';
import { MidiController } from '../packages/midi/controller.js';
import { MidiControllers } from '../packages/midi/manager.js';
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
      assert.doesNotMatch(page, /Artist's QLC|作者的 QLC/, `${lang} ${p.id}: QLC+ is not the artist's tool`);
      assert.ok(page.includes(`controllers/verify/?profile=${p.id}`), `${lang} ${p.id}: and how to check it`);
      assert.ok(page.includes(`?profile=${p.id}`), `${lang} ${p.id}: oav-p5 takes this id`);
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

// ------------------------------------------------------------------ plugged in
/** What a port would become: a shipped profile wins, an imported one only if none claims it. */
const who = (n) => matchProfile(n, PROFILES)?.profile.id ?? matchProfile(n, IMPORTED)?.profile.id ?? null;

test('each model answers to its own port name, with the endings operating systems add', () => {
  const table = {
    'behringer-bcf2000': ['BCF2000', 'BCF2000 Port 2', 'BCF2000 MIDI 1', 'bcf2000'],
    'behringer-bcr2000': ['BCR2000', 'BCR2000 Port 1'],
    'behringer-x-touch-compact': ['X-TOUCH COMPACT', 'X-Touch Compact 1'],
    'behringer-x-touch-extender': ['X-Touch-Ext', 'X-TOUCH EXTENDER'],
    'akai-apc40': ['APC40', 'Akai APC40', 'APC40 1'], 'akai-apc20': ['APC20', 'Akai APC20'], 'akai-apc-mini': ['APC MINI', 'APC mini', 'Akai APC Mini'],
    'korg-nanokontrol': ['nanoKONTROL', 'nanoKONTROL SLIDER/KNOB'], 'korg-nanokontrol-studio': ['nanoKONTROL Studio', 'nanoKONTROL Studio CTRL'],
    'korg-nanopad': ['nanoPAD', 'nanoPAD PAD'], 'korg-nanopad2': ['nanoPAD2', 'nanoPAD2 PAD'],
    'novation-launchpad': ['Launchpad', 'Launchpad 1'], 'novation-launchpad-mk2': ['Launchpad MK2'], 'novation-launchpad-pro': ['Launchpad Pro', 'Launchpad Pro Standalone Port'],
    'novation-launch-control': ['Launch Control', 'Launch Control 1'], 'elation-midicon': ['MIDIcon'],
    'm-vave-smc-mixer': ['SMC-Mixer'], 'm-vave-smc-pad': ['SMC-PAD'], 'zoom-r16': ['ZOOM R16_R24'],
  };
  for (const [id, names] of Object.entries(table)) for (const n of names) assert.equal(who(n), id, n);
  assert.equal(who('MIDICON-2'), 'adj-midicon-2');
});

test('a neighbour keeps its own port: shipped profiles win, and a near name is no match', () => {
  const shipped = { 'APC40 mkII': 'akai-apc40-mk2', 'APC mini mk2 Control': 'akai-apc-mini-mk2', nanoKONTROL2: 'korg-nanokontrol2', 'nanoKONTROL2 SLIDER/KNOB': 'korg-nanokontrol2', nanoKEY2: 'korg-nanokey2', 'X-TOUCH MINI': 'behringer-x-touch-mini', 'Launch Control XL': 'novation-launch-control-xl-mk2', 'LPMiniMK3 MIDI': 'novation-launchpad-mini-mk3', 'LPProMK3 MIDI': 'novation-launchpad-pro-mk3', 'Launchkey MK4 37 MIDI': 'novation-launchkey-37-mk4' };
  for (const [n, id] of Object.entries(shipped)) assert.equal(who(n), id, n);
  for (const n of ['Launchpad S', 'Launchpad X LPX MIDI', 'LPX MIDI', 'Launchpad Pro Live Port', 'Launchpad Pro MIDI Port', 'LPProMK3 DAW', 'LPMiniMK3 DAW', 'IAC Driver Bus 1', 'Scarlett 2i2 USB', 'USB MIDI Interface', 'MIDI', 'Generic MIDI', 'BCF', 'BCF2000X', 'APC', 'APC Key 25', 'SMC', 'nanoSERIES', 'Launch', 'Pad', 'Zoom']) assert.equal(who(n), null, n);
});

test('what has no name to go by is never picked: DIN-only devices, and the second mode of one unit', () => {
  for (const id of ['behringer-bcf2000-mackie-mode', 'behringer-lc2412', 'pmj-9-faders-controller', 'pmj-circus', 'pmj-midikey', 'showtec-showmaster-24']) {
    const row = IMPORTED.find((p) => p.id === id);
    assert.deepEqual(row.match.ports, [], id);
    assert.match(all.find((p) => p.id === id).notes, /assign it by hand/, id);
  }
  for (const r of IMPORTED) {
    assert.deepEqual(r.match.ports, all.find((p) => p.id === r.id).match.ports, `${r.id}: the list and the file say the same`);
    for (const re of r.match.ports) { assert.match(re, /^\^/, `${r.id}: starts at the start`); assert.match(re, /\$$/, `${r.id}: ends at the end`); }
  }
});

function fakeMidi(names) {
  const subs = new Set();
  return {
    enabled: true, outputs: [], list: names.map((n) => ({ slug: n.toLowerCase().replace(/\W+/g, '-'), name: n, listening: true })),
    devices() { return this.list; }, listen: () => () => {}, onDevices(fn) { subs.add(fn); return () => subs.delete(fn); },
    plug(name) { this.list = [...this.list, { slug: name.toLowerCase().replace(/\W+/g, '-'), name, listening: true }]; for (const f of subs) f(this.list); },
  };
}
const fileOf = async (id) => JSON.parse(read(`${dir}/${id}.json`));
const settle = () => new Promise((r) => setTimeout(r, 0));

test('plug in an imported model: its one file is fetched, and it comes on screen like any other', async () => {
  const asked = [];
  const c = new MidiControllers({ profiles: PROFILES, storage: null, loadImported: (id) => { asked.push(id); return fileOf(id); } });
  const midi = fakeMidi([]); c.attach(midi);
  midi.plug('BCF2000');
  await settle(); await settle();
  assert.deepEqual(asked, ['behringer-bcf2000']);
  assert.equal(c.current.id, 'behringer-bcf2000', 'it takes the stage');
  assert.equal(c.devices()[0].profileId, 'behringer-bcf2000');
  assert.equal(c.devices()[0].auto, true);
  midi.plug('BCR2000'); await settle(); await settle();
  midi.plug('BCF2000 Port 2'); await settle(); await settle();
  assert.deepEqual(asked, ['behringer-bcf2000', 'behringer-bcr2000'], 'each file once, however many ports');
});

test('it stays out of the way: shipped ports, unknown ports, a chosen layout, and when turned off', async () => {
  const asked = [], loadImported = (id) => { asked.push(id); return fileOf(id); };
  const a = new MidiControllers({ profiles: PROFILES, storage: null, loadImported });
  a.attach(fakeMidi(['LPProMK3 DAW', 'nanoKONTROL2', 'USB MIDI Interface', 'Launchpad X LPX MIDI']));
  await settle();
  assert.deepEqual(asked, [], 'nothing fetched for a port a shipped profile answers or refuses, or nobody knows');
  const off = new MidiControllers({ profiles: PROFILES, storage: null, imported: [], loadImported });
  off.attach(fakeMidi(['BCF2000'])); await settle();
  assert.deepEqual(asked, [], 'imported: [] turns it off');
  // a port someone assigned by hand keeps that assignment
  const store = new Map([['openav.midi.assign', JSON.stringify({ BCF2000: 'generic-8f' })]]), storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  const m = new MidiControllers({ profiles: PROFILES, storage, loadImported });
  m.attach(fakeMidi(['BCF2000'])); await settle();
  assert.deepEqual(asked, []); assert.equal(m.devices()[0].profileId, 'generic-8f');
  // …and an imported model chosen by hand comes back after a reload
  const back = new Map([['openav.midi.assign', JSON.stringify({ 'Some Box': 'pmj-circus' })]]);
  const n = new MidiControllers({ profiles: PROFILES, loadImported, storage: { getItem: (k) => back.get(k) ?? null, setItem: (k, v) => back.set(k, v) } });
  n.attach(fakeMidi(['Some Box'])); await settle(); await settle();
  assert.deepEqual(asked, ['pmj-circus']); assert.equal(n.devices()[0].profileId, 'pmj-circus');
});

test('a file that does not arrive leaves the port unknown, and it can try again', async () => {
  let fail = true; const errs = []; const warn = console.warn; console.warn = (...a) => errs.push(a.join(' '));
  const c = new MidiControllers({ profiles: PROFILES, storage: null, loadImported: async (id) => { if (fail) throw new Error('offline'); return fileOf(id); } });
  const midi = fakeMidi(['BCR2000']); c.attach(midi);
  await settle(); await settle();
  assert.equal(c.devices()[0].profileId, null); assert.match(errs.join(), /could not load behringer-bcr2000/);
  fail = false; midi.plug('Something else'); await settle(); await settle();
  assert.equal(c.devices()[0].profileId, 'behringer-bcr2000');
  console.warn = warn;
});
