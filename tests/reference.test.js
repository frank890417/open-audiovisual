// The API reference (/docs/reference/): the gates that keep the code and its documentation from drifting apart.
//
// What is true of the code is READ from it on every run (tools/reference/scan.mjs): every public name of oav-p5 and of every
// package. What a person wrote about each name sits beside the code (p5/reference/*.mjs, packages/<package>/reference.mjs).
// These tests put the two side by side and go red when they disagree, in either direction:
//   G1  a public name has no entry                     G4  an entry is incomplete (a language missing, no example…)
//   G2  an entry names something the code lacks        G5  the parameter table does not match the code's declaration
//   G3  the ledger of "still to write" lies            G6  an example does not parse (G7, running it, is p5/test/reference-smoke.cjs in CI)
//   G8  the generated pages are not what the sources build      G9  an anchor, a link or a source line is wrong
// "Drill" tests prove the gates can go red: they delete an entry, keep a ghost, lie in the ledger, rename a name in the code,
// break an example, and watch the right gate say so. They stay in the suite for good.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadModel, checkCoverage, checkEntry, itemsOf, buildRecords, checkModel, parseParams, exampleSyntaxError, toDataset, P5, LEDGER_FILE, signatureOf } from '../tools/reference/model.mjs';
import { CATEGORIES, CATEGORY_IDS, PACKAGE_CATEGORY } from '../tools/reference/categories.mjs';
import { packageDirs } from '../tools/reference/scan.mjs';
import { buildFiles, PAGES, DATASET } from '../tools/build-reference.mjs';
import { unstamp } from '../tools/site/pages.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(ROOT, rel));
const model = await loadModel();
const codes = (problems, code) => problems.filter((p) => p.code === code).map((p) => p.msg);
const has = (items, key, ns = P5) => items.find((i) => i.ns === ns && i.key === key);

// ---------------------------------------------------------------------------- the scan reads the code (positive controls)
test('scan: oav-p5 — globals, events, options and OAVp5 members are found, with the right kind', () => {
  const k = (key) => has(model.items, key);
  assert.equal(k('micLevel').kind, 'variable');
  assert.equal(k('micLevel').getter, true, 'micLevel is a reader on the page, not a value');
  assert.equal(k('startMic').kind, 'function');
  assert.equal(k('notePressed').kind, 'event');
  assert.equal(k('beatDetected').kind, 'event');
  assert.equal(k('option:mic').kind, 'option');
  assert.equal(k('OAVp5.mic.start').kind, 'function');
  assert.equal(k('OAVp5.mic.level').kind, 'variable');
  assert.equal(k('OAVp5').kind, 'object');
  for (let i = 1; i <= 8; i++) assert.ok(k(`knob${i}`) && k(`fader${i}`), `knob${i} and fader${i}`);
  for (let i = 1; i <= 16; i++) assert.ok(k(`pad${i}`), `pad${i}`);
  assert.deepEqual(k('noteName').params, 'v, o', 'the parameters come from the function as written');
  const events = model.items.filter((i) => i.ns === P5 && i.kind === 'event').map((i) => i.key);
  for (const e of ['notePressed', 'noteReleased', 'knobMoved', 'faderMoved', 'padPressed', 'padReleased', 'noteOn', 'noteOff', 'controlChange', 'pitchBend', 'midiMessage', 'beatDetected', 'kickDetected', 'snareDetected', 'hatDetected', 'drumHit', 'barStarted', 'stepStarted', 'cueFired', 'rhythmChanged', 'recordingSaved']) assert.ok(events.includes(e), `event ${e}`);
  assert.ok(!model.items.some((i) => i.ns === P5 && /(^|\.)_/.test(i.key)), 'private (underscore) members are not public names');
});

test('scan: packages — every package.json "exports" entry is read; a class brings its public members and its source line', () => {
  const a = has(model.items, 'AudioAnalyzer', '@openav/audio');
  assert.equal(a.kind, 'class');
  assert.match(a.params, /fftSize = 2048/, 'the constructor options as written, defaults included');
  assert.ok(a.members.some((m) => m.name === 'enableMic') && a.members.some((m) => m.name === 'update'));
  assert.ok(!a.members.some((m) => m.name.startsWith('_')), 'no private members');
  assert.equal(a.src.file, 'packages/audio/index.js');
  assert.match(read(a.src.file).split('\n')[a.src.line - 1], /export class AudioAnalyzer/, 'the line the link points at is the declaration');
  assert.equal(has(model.items, 'Midi', '@openav/midi').kind, 'class');
  assert.equal(has(model.items, 'createShow', '@openav/show').kind, 'function');
  assert.equal(has(model.items, 'DEFAULT_URL', '@openav/leap').kind, 'constant');
  // a door that is not the index (leap/bridge) is read too, and the same name in two packages stays two names
  assert.equal(has(model.items, 'startBridge', '@openav/leap').spec, '@openav/leap/bridge');
  assert.equal(has(model.items, 'startBridge', '@openav/out').spec, '@openav/out/bridge');
  const rec = (key, pkg) => model.records.find((r) => r.ns === pkg && r.key === key);
  assert.notEqual(rec('startBridge', '@openav/leap').id, rec('startBridge', '@openav/out').id, 'a shared name gets a package in front of its anchor');
  // every package directory shows up (mcp through its tools)
  for (const d of packageDirs()) {
    const name = JSON.parse(read(`packages/${d}/package.json`)).name;
    assert.ok(model.items.some((i) => i.ns === name), `${name}: no public name found: is its entry point importable, or does it need a scan rule?`);
    assert.ok(PACKAGE_CATEGORY[d], `${d}: add it to PACKAGE_CATEGORY (tools/reference/categories.mjs)`);
  }
  assert.equal(model.items.filter((i) => i.ns === '@openav/mcp').length, 8, 'the MCP server\'s tools');
});

test('scan: the same code gives the same list twice (the generated files are reproducible)', async () => {
  const again = await loadModel();
  assert.deepEqual(again.items.map((i) => i.uid), model.items.map((i) => i.uid));
});

test('parseParams: names, defaults, rest, and the keys of an options object', () => {
  assert.deepEqual(parseParams('v, o').map((p) => p.name), ['v', 'o']);
  const p = parseParams('{ signals = null, fftSize = 2048 } = {}');
  assert.deepEqual(p.map((x) => [x.name, x.default]), [['signals', 'null'], ['fftSize', '2048']]);
  assert.equal(p[0].group, 'options');
  const q = parseParams("a, b = 'x,y', ...rest");
  assert.deepEqual(q.map((x) => [x.name, x.optional, !!x.rest]), [['a', false, false], ['b', true, false], ['rest', true, true]]);
  assert.deepEqual(parseParams(''), []);
});

// ---------------------------------------------------------------------------- the gates on the real repository
test('G1 every public name has an entry (or is in the ledger)', () => {
  assert.deepEqual(codes(model.problems, 'G1'), []);
});
test('G2 every entry names something the code has', () => {
  assert.deepEqual(codes(model.problems, 'G2'), []);
});
test('G3 the ledger only lists names that exist and have no entry; when it says done it is empty', () => {
  assert.deepEqual(codes(model.problems, 'G3'), []);
});
test('G4 every entry is complete: both languages, a group, examples where oav-p5 needs them, related names that exist', () => {
  assert.deepEqual(codes(model.problems, 'G4'), []);
});
test('G5 the parameter tables match what the code declares', () => {
  assert.deepEqual(codes(model.problems, 'G5'), []);
});
test('G6 every example parses', () => {
  assert.deepEqual(codes(model.problems, 'G6'), []);
});
test('G9 anchors are unique, #links go somewhere, source lines exist', () => {
  assert.deepEqual(codes(model.problems, 'G9'), []);
});
test('the categories: every entry names one, every category has an entry', () => {
  const used = new Set(model.records.map((r) => r.category));
  for (const id of used) assert.ok(CATEGORY_IDS.includes(id), `category ${id}`);
  // while names wait in the ledger a category may still be empty; once the ledger says done, every category has an entry
  if (model.ledger.done) for (const c of CATEGORIES) assert.ok(used.has(c.id), `category ${c.id} has no entry: remove it from tools/reference/categories.mjs or document something in it`);
  for (const c of CATEGORIES) assert.ok(c.en && c.zh && c.hint.en && c.hint.zh, `${c.id}: both languages`);
});
test('micLevel, the entry that started this page, says range, update rate and what to do first', () => {
  const e = model.records.find((r) => r.key === 'micLevel').entry;
  assert.equal(e.value.type, 'Number');
  assert.equal(e.value.range, '0..1');
  const all = JSON.stringify(e);
  assert.ok(/display frame/.test(all) && /startMic/.test(all) && /allow/i.test(all), 'update rate, startMic, permission');
  assert.ok(e.examples.length >= 2);
  assert.ok(e.claims.some((c) => c.expr === 'micLevel' && c.min === 0 && c.max === 1));
  assert.ok(e.tbd.length >= 1, 'what could not be checked is said, not guessed');
});

// ---------------------------------------------------------------------------- drills: the gates can go red, both ways
const drillAuthored = () => model.authored.map((a) => ({ ...a }));
const noLedger = { done: false, names: [] };
// a world where only the documented names exist, so the drill is about one change at a time
const documentedItems = model.items.filter((i) => model.authored.some((a) => a.ns === i.ns && (a.key === i.key || (a.entry.aliases || []).includes(i.key))));

test('drill G1: deleting one entry turns the gate red and says which name', () => {
  assert.deepEqual(checkCoverage(documentedItems, drillAuthored(), noLedger), [], 'green before');
  const without = drillAuthored().filter((a) => a.key !== 'micLevel');
  const p = checkCoverage(documentedItems, without, noLedger);
  assert.equal(p.length, 1);
  assert.equal(p[0].code, 'G1');
  assert.match(p[0].msg, /"micLevel"/);
});
test('drill G2: an entry for a name that is not in the code turns the gate red', () => {
  const ghost = [...drillAuthored(), { ns: P5, key: 'micLoudness', file: 'p5/reference/mic.mjs', entry: { group: 'mic' } }];
  const p = checkCoverage(documentedItems, ghost, noLedger);
  assert.equal(p.length, 1);
  assert.equal(p[0].code, 'G2');
  assert.match(p[0].msg, /"micLoudness" is documented but the code has no such public name/);
  const aliasGhost = drillAuthored().map((a) => (a.key === 'bass' ? { ...a, entry: { ...a.entry, aliases: ['mid', 'treble', 'bassy'] } } : a));
  assert.match(checkCoverage(documentedItems, aliasGhost, noLedger).map((x) => x.msg).join('\n'), /alias "bassy"/);
});
test('drill G1 + G2: renaming a name in the code makes the old entry a ghost and the new name undocumented', () => {
  const renamed = documentedItems.map((i) => (i.key === 'micLevel' ? { ...i, key: 'micLoud', uid: `${P5}::micLoud`, name: 'micLoud' } : i));
  const p = checkCoverage(renamed, drillAuthored(), noLedger);
  assert.deepEqual(p.map((x) => x.code).sort(), ['G1', 'G2']);
});
test('drill G3: the ledger cannot lie (a name that has an entry, a name that is gone, "done" with names left)', () => {
  assert.equal(codes(checkCoverage(documentedItems, drillAuthored(), { done: false, names: [`${P5}::micLevel`] }), 'G3').length, 1);
  assert.equal(codes(checkCoverage(documentedItems, drillAuthored(), { done: false, names: [`${P5}::notAName`] }), 'G3').length, 1);
  const open = model.items.filter((i) => !documentedItems.includes(i));
  assert.ok(open.length === 0 || codes(checkCoverage(model.items, drillAuthored(), { done: true, names: open.map((i) => i.uid) }), 'G3').length >= 1);
  // and a name with no entry that is NOT in the ledger is G1: the ledger is the only way to wait
  if (open.length) assert.equal(codes(checkCoverage([...documentedItems, open[0]], drillAuthored(), noLedger), 'G1').length, 1);
});
test('drill G4: a missing language, a Chinese sentence in the English field, a long summary, a missing example', () => {
  const item = has(model.items, 'micLevel');
  const base = model.authored.find((a) => a.key === 'micLevel');
  const bad = (patch) => checkEntry(item, { ...base, entry: { ...base.entry, ...patch } });
  assert.deepEqual(bad({}), [], 'green before');
  assert.ok(bad({ summary: { en: 'only English' } }).some((p) => p.code === 'G4'));
  assert.ok(bad({ summary: { en: '麥克風有多大聲', zh: '麥克風有多大聲' } }).some((p) => /summary\.en contains Chinese/.test(p.msg)));
  assert.ok(bad({ summary: { en: 'a copy', zh: 'a copy' } }).some((p) => /summary\.zh has no Chinese/.test(p.msg)));
  assert.ok(bad({ summary: { en: 'x'.repeat(200), zh: '短' } }).some((p) => /first sentence only/.test(p.msg)));
  assert.ok(bad({ summary: { en: 'a', zh: '一；二' } }).some((p) => /uses "；"/.test(p.msg)), 'the site\'s Chinese has no full-width semicolon');
  assert.ok(bad({ examples: [] }).some((p) => /at least one example/.test(p.msg)));
  assert.ok(bad({ group: 'nowhere' }).some((p) => /not a category/.test(p.msg)));
  assert.ok(bad({ nonsense: 1 }).some((p) => /unknown field/.test(p.msg)));
  assert.ok(bad({ value: undefined }).some((p) => /needs `value/.test(p.msg)));
  assert.ok(bad({ examples: [{ code: 'function setup() {}', caption: { en: 'x', zh: '中' }, run: 'static' }] }).some((p) => /must say why/.test(p.msg)));
  assert.ok(bad({ examples: [{ code: 'function draw() {}\ndocument.head.prepend(x)', caption: { en: 'x', zh: '中' } }] }).some((p) => /leave the loader line out/.test(p.msg)));
});
test('drill G5: a parameter table that does not match the code declaration turns red; an extra read from arguments is allowed only when said', () => {
  const item = has(model.items, 'micSensitivity');
  const base = model.authored.find((a) => a.key === 'micSensitivity');
  const run = (params) => checkEntry(item, { ...base, entry: { ...base.entry, params } });
  const p0 = base.entry.params[0];
  assert.deepEqual(run([p0]), [], 'green before');
  assert.ok(run([{ ...p0, name: 'amount' }]).some((p) => p.code === 'G5' && /do not match the code/.test(p.msg)));
  assert.ok(run([]).some((p) => p.code === 'G5'), 'a parameter the code takes, left out');
  assert.ok(run([p0, { ...p0, name: 'extra' }]).some((p) => p.code === 'G5' && /viaArguments/.test(p.msg)));
  assert.deepEqual(run([p0, { ...p0, name: 'extra', viaArguments: true }]).filter((p) => p.code === 'G5'), []);
});
test('drill G6: an example with a syntax error is red; a module example is parsed as a module', () => {
  assert.equal(exampleSyntaxError({ code: 'function setup() { createCanvas(400, 300) }', run: 'sketch' }), null);
  assert.match(exampleSyntaxError({ code: 'function setup() { createCanvas(400, 300', run: 'sketch' }), /./);
  assert.match(exampleSyntaxError({ code: "const s = 'a\nb';", run: 'sketch' }), /./, 'an unterminated string');
  assert.equal(exampleSyntaxError({ code: "import { A } from '@openav/audio';\nconst a = new A();\nawait a.enableMic();", run: 'module' }), null);
  assert.equal(exampleSyntaxError({ code: 'not : js', lang: 'html', run: 'static' }), null, 'only JavaScript is parsed');
  const item = has(model.items, 'micLevel');
  const base = model.authored.find((a) => a.key === 'micLevel');
  const broken = { ...base, entry: { ...base.entry, examples: [{ ...base.entry.examples[0], code: 'function draw() { circle(' }] } };
  assert.ok(checkEntry(item, broken).some((p) => p.code === 'G6'));
});
test('drill G9: a source line past the end of the file, one name behind two definitions, a link to nowhere', () => {
  const items = itemsOf({ ...model.surface, p5: { ...model.surface.p5, globals: model.surface.p5.globals.map((g) => (g.name === 'micLevel' ? { ...g, line: 999999 } : g)) } });
  const recs = buildRecords(items, model.authored, model.ledger);
  const p = checkModel({ items, authored: model.authored, ledger: model.ledger, records: recs });
  assert.ok(p.some((x) => x.code === 'G9' && /past the end/.test(x.msg)));
  const link = model.authored.map((a) => (a.key === 'micLevel' ? { ...a, entry: { ...a.entry, description: [{ en: 'see [this](#nowhereAtAll)', zh: '看[這個](#nowhereAtAll)' }] } } : a));
  const recs2 = buildRecords(model.items, link, model.ledger);
  assert.ok(checkModel({ items: model.items, authored: link, ledger: model.ledger, records: recs2 }).some((x) => x.code === 'G9' && /nowhereAtAll/.test(x.msg)));
});

// ---------------------------------------------------------------------------- G8: the generated files are what the sources build
const built = buildFiles(model);
test('G8 docs/reference/ (en), zh/docs/reference/ and reference.json are what the sources build (node tools/build-reference.mjs)', () => {
  for (const rel of [PAGES.en, PAGES.zh, DATASET]) {
    assert.ok(exists(rel), `${rel} exists`);
    assert.equal(unstamp(read(rel)), unstamp(built[rel]), `${rel} is stale: run node tools/build-reference.mjs`);
  }
});

// ---------------------------------------------------------------------------- the pages
const html = { en: read(PAGES.en), zh: read(PAGES.zh) };
test('both pages: one card per record, an anchor for every name (aliases too), a search box, source links that point into the repository', () => {
  for (const [lang, h] of Object.entries(html)) {
    const cards = [...h.matchAll(/<article class="ref[ "]/g)].length;
    assert.equal(cards, model.records.length, `${lang}: a card per record`);
    for (const r of model.records) for (const id of [r.id, ...r.aliasIds]) assert.ok(h.includes(`id="${id}"`), `${lang}: anchor #${id}`);
    assert.match(h, /<input id="ref-q" type="search"/, `${lang}: search box`);
    assert.ok(h.includes('<script type="module" src="../../assets/reference/reference.js') || h.includes('<script type="module" src="../../../assets/reference/reference.js'), `${lang}: reference.js`);
    for (const m of h.matchAll(/href="(https:\/\/github\.com\/frank890417\/open-audiovisual\/blob\/main\/([^"#]+)#L(\d+))"/g)) {
      assert.ok(exists(m[2]), `${lang}: ${m[2]} exists`);
    }
    assert.ok(h.includes(`<html lang="${lang === 'zh' ? 'zh-Hant-TW' : 'en'}"`) || /<html lang=/.test(h), `${lang}: html lang`);
  }
  assert.ok(html.en.includes('id="micLevel"') && html.zh.includes('id="micLevel"'), '#micLevel in both languages');
  assert.match(html.zh, /麥克風聽到的聲音有多大聲/, 'the zh page says it in Chinese');
  assert.doesNotMatch(html.en, /麥克風聽到的聲音有多大聲/, 'the en page does not');
});
test('both pages: canonical, hreflang trio, the docs nav is marked, a way back to /docs/, one JSON-LD graph', () => {
  const SITE = 'https://openaudiovisual.com/';
  for (const [lang, h] of Object.entries(html)) {
    const self = SITE + (lang === 'zh' ? 'zh/' : '') + 'docs/reference/';
    assert.ok(h.includes(`<link rel="canonical" href="${self}">`), `${lang}: canonical`);
    for (const [hl, url] of [['en', SITE + 'docs/reference/'], ['zh-Hant', SITE + 'zh/docs/reference/'], ['x-default', SITE + 'docs/reference/']]) assert.ok(h.includes(`<link rel="alternate" hreflang="${hl}" href="${url}">`), `${lang}: hreflang ${hl}`);
    assert.match(h, /<a href="[^"]*docs\/"[^>]*aria-current="page">/, `${lang}: Docs is marked in the nav`);
    assert.equal([...h.matchAll(/<script type="application\/ld\+json">/g)].length, 1, `${lang}: one JSON-LD script`);
    assert.ok(/<!--email_off-->/.test(h), `${lang}: the email_off fence`);
  }
});
test('the handbook page links to the reference (a way in from /docs/), in both languages', () => {
  assert.match(read('docs/index.html'), /href="\.\.\/docs\/reference\/"|href="[^"]*docs\/reference\/"/, 'docs/index.html links to docs/reference/');
  assert.match(read('zh/docs/index.html'), /href="[^"]*docs\/reference\/"/, 'zh/docs/index.html links to docs/reference/');
});
test('the page is registered (sitemap, stamp list, llms.txt) and its own files exist', async () => {
  const { registry } = await import('../tools/site/pages.mjs');
  assert.ok(registry().some((e) => e.path === 'docs/reference/' && e.langs.length === 2), 'registered in tools/site/pages.mjs');
  const sm = read('sitemap.xml');
  assert.ok(sm.includes('https://openaudiovisual.com/docs/reference/') && sm.includes('https://openaudiovisual.com/zh/docs/reference/'), 'sitemap.xml');
  const stamp = read('tools/stamp-version.mjs');
  for (const rel of [PAGES.en, PAGES.zh]) assert.ok(stamp.includes(`'${rel}'`), `stamp-version covers ${rel}`);
  for (const f of ['assets/reference/reference.css', 'assets/reference/reference.js', 'assets/search/core.js']) assert.ok(exists(f), f);
  const llms = read('llms.txt'), llmsZh = read('zh/llms.txt');
  assert.ok(llms.includes('https://openaudiovisual.com/docs/reference/'), 'llms.txt points at the reference');
  assert.ok(llmsZh.includes('https://openaudiovisual.com/zh/docs/reference/'), 'zh/llms.txt points at the reference');
  assert.ok(llms.includes('/docs/reference/reference.json'), 'llms.txt points at the dataset');
});
test('llms-full.txt carries the reference: every documented name with its one-line summary', () => {
  const full = read('llms-full.txt');
  assert.ok(full.includes('<!-- source: docs/reference/reference.json -->'), 'the reference section is in');
  for (const r of model.records.filter((x) => x.entry)) {
    assert.ok(full.includes(`\`${r.key.replace(/^option:/, '')}\``) && full.includes(r.entry.summary.en.replace(/`/g, '')) || full.includes(r.entry.summary.en), `llms-full.txt has ${r.key}`);
  }
});

// ---------------------------------------------------------------------------- the dataset
test('reference.json: parses, one object per record, the facts from the code and both languages', () => {
  const ds = JSON.parse(read(DATASET));
  assert.equal(ds.schema, 1);
  assert.equal(ds.count, model.records.length);
  assert.equal(ds.entries.length, model.records.length);
  const mic = ds.entries.find((e) => e.key === 'micLevel');
  assert.equal(mic.kind, 'variable');
  assert.equal(mic.package, 'oav-p5');
  assert.equal(mic.value.range, '0..1');
  assert.ok(mic.summary.en && mic.summary.zh);
  assert.match(mic.source.url, /p5\/oav-p5\.js#L\d+$/);
  assert.ok(mic.examples.length >= 2 && mic.examples.every((x) => x.run === 'sketch'));
  assert.ok(mic.keywords.zh.includes('麥克風') && mic.keywords.en.includes('microphone'), 'keywords bridge the two languages');
  const an = ds.entries.find((e) => e.key === 'AudioAnalyzer');
  assert.equal(an.kind, 'class');
  assert.match(an.import, /from '@openav\/audio'/);
  assert.ok(an.members.some((m) => m.name === 'enableMic'));
  assert.deepEqual(JSON.parse(JSON.stringify(toDataset(model, { p5Version: ds.p5Version, version: ds.version }))), ds, 'the committed dataset is what toDataset() gives');
});
test('signatures: events and options are written from the entry, functions from the code', () => {
  const sig = (k) => signatureOf(model.records.find((r) => r.key === k));
  assert.equal(sig('micLevel'), 'micLevel');
  assert.equal(sig('micSensitivity'), 'micSensitivity([v])');
  assert.equal(sig('notePressed'), 'function notePressed(note, velocity) {}');
  assert.match(sig('AudioAnalyzer'), /^new AudioAnalyzer\(\{ signals = null/);
});

// ---------------------------------------------------------------------------- the ledger and the CI job
test('the ledger: valid JSON, no name twice, written in the shape the gate reads', () => {
  const led = JSON.parse(read(LEDGER_FILE));
  assert.equal(typeof led.done, 'boolean');
  assert.equal(new Set(led.names).size, led.names.length, 'no name twice');
  for (const n of led.names) assert.match(n, /^[^:]+::.+$/, n);
});
test('the headless gate exists and CI runs it: reference-smoke.cjs and examples-smoke.cjs as jobs', () => {
  assert.ok(exists('p5/test/reference-smoke.cjs') && exists('p5/test/examples-smoke.cjs'));
  const yml = read('.github/workflows/checks.yml');
  assert.match(yml, /reference-smoke\.cjs/, 'a CI job runs the reference smoke');
  assert.match(yml, /examples-smoke\.cjs/, 'a CI job runs the examples smoke');
  assert.match(yml, /fetch-depth: 0/, 'the test job sees the whole history (sitemap lastmod and the changelog read it)');
});
test('AGENTS.md tells the next agent how to document a name', () => {
  const a = read('AGENTS.md');
  assert.match(a, /## Documenting a public name/);
  for (const w of ['tools/build-reference.mjs --missing', 'p5/reference/', 'reference.mjs', 'undocumented.json', 'tests/reference.test.js', 'reference-smoke.cjs']) assert.ok(a.includes(w), `AGENTS.md mentions ${w}`);
});
