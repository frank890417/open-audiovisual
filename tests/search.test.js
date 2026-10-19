// The search core (assets/search/core.js): matching and ranking shared by the reference page's box and the nav's search dialog.
// Pure functions, so they run here in Node. The index and the dialog have their own tests below the core's.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { norm, words, tokens, prepare, rank, score, snippet } from '../assets/search/core.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const R = (name, o = {}) => prepare({ name, names: '', kw: '', summary: '', text: '', ...o });

test('norm: case, width and accents do not matter', () => {
  assert.equal(norm('MicLevel'), 'miclevel');
  assert.equal(norm('ＭＩＣ'), 'mic');          // full-width Latin
  assert.equal(norm('Café'), 'café');
  assert.equal(norm(null), '');
});

test('words: a name is also its words', () => {
  assert.equal(words('micLevel'), 'mic level');
  assert.equal(words('OAVp5.mic.start'), 'oavp5 mic start', 'OAVp5 stays one word');
  assert.equal(words('option:mic'), 'option mic');
  assert.equal(words('startDrums'), 'start drums');
  assert.equal(words('HTMLElement'), 'html element');
});

test('tokens: every word of the query, folded', () => {
  assert.deepEqual(tokens('  Mic   LEVEL '), ['mic', 'level']);
  assert.deepEqual(tokens('麥克風 音量'), ['麥克風', '音量']);
  assert.deepEqual(tokens(''), []);
});

test('rank: an exact name beats a prefix beats a word inside beats the description', () => {
  const recs = [
    R('micLevel', { summary: 'How loud the microphone hears things' }),
    R('micSensitivity', { summary: 'Makes the microphone more sensitive' }),
    R('startMic', { summary: 'Turns the microphone on' }),
    R('beat', { summary: 'True for one frame when the microphone hears a beat', text: 'micLevel is related' }),
  ];
  assert.deepEqual(rank(recs, 'micLevel').map((x) => x.rec.name), ['micLevel', 'beat'], 'exact first; a mention in the text last');
  assert.deepEqual(rank(recs, 'mic').map((x) => x.rec.name).slice(0, 2), ['micLevel', 'micSensitivity'], 'prefix of the name beats the word inside (startMic)');
  assert.equal(rank(recs, 'mic')[2].rec.name, 'startMic');
  assert.deepEqual(rank(recs, 'level').map((x) => x.rec.name)[0], 'micLevel', 'a word of a camelCase name');
  assert.deepEqual(rank(recs, 'mic level').map((x) => x.rec.name)[0], 'micLevel', 'two words, both must match');
  assert.deepEqual(rank(recs, 'zzz'), []);
  assert.deepEqual(rank(recs, '   '), []);
});

test('rank: Chinese is a substring, with no word list; keywords bridge the two languages', () => {
  const recs = [
    R('micLevel', { kw: 'microphone volume 麥克風 音量 聲音大小', summary: '麥克風聽到的聲音有多大聲' }),
    R('noteName', { kw: 'note name 音名', summary: '把 MIDI 號碼轉成音名' }),
  ];
  assert.equal(rank(recs, '麥克風')[0].rec.name, 'micLevel');
  assert.equal(rank(recs, '麥克')[0].rec.name, 'micLevel', 'part of a word');
  assert.equal(rank(recs, '音名')[0].rec.name, 'noteName');
  assert.equal(rank(recs, 'microphone')[0].rec.name, 'micLevel', 'the English keyword');
  assert.deepEqual(rank(recs, '麥克風 音量').map((x) => x.rec.name), ['micLevel'], 'every word has to match');
});

test('rank: aliases and shared names (knob1 … knob8 is one entry)', () => {
  const recs = [R('knob1', { names: 'knob1 knob2 knob3 knob8' }), R('knob', { summary: 'the function form' })];
  assert.equal(rank(recs, 'knob3')[0].rec.name, 'knob1', 'an alias is an exact match');
  assert.equal(rank(recs, 'knob')[0].rec.name, 'knob', 'the exact name first');
});

test('snippet: a piece of text around the match, the match marked', () => {
  const text = 'It follows the browser animation frames rather than draw(), so a sketch at frameRate(10) still reads the latest value.';
  const parts = snippet(text, ['frames'], { before: 10, after: 20 });
  assert.ok(parts.some((p) => p.hit && p.text.toLowerCase() === 'frames'));
  assert.equal(parts[0].text, '…');
  assert.equal(snippet('', ['x']).length, 1);
  assert.match(snippet('麥克風聽到的聲音有多大聲', ['聲音'], { before: 2, after: 4 }).map((p) => p.text).join(''), /聲音/);
});

test('the reference dataset through the core: micLevel is first for its name, in the first five for the words people use', () => {
  const ds = JSON.parse(read('docs/reference/reference.json'));
  const recs = ds.entries.map((e) => prepare({
    name: e.name.replace(/^option:/, ''), names: [e.key, ...e.aliases].join(' '), kw: [...e.keywords.en, ...e.keywords.zh].join(' '),
    summary: e.summary ? `${e.summary.en} ${e.summary.zh}` : '', text: e.description.map((d) => `${d.en} ${d.zh}`).join(' '),
  }));
  const top = (q, n = 5) => rank(recs, q, { limit: n }).map((x) => x.rec.name);
  assert.equal(top('micLevel', 1)[0], 'micLevel');
  assert.equal(top('miclevel', 1)[0], 'micLevel', 'case does not matter');
  assert.ok(top('mic level').includes('micLevel'));
  assert.ok(top('麥克風').includes('micLevel'), '麥克風 finds micLevel');
  assert.ok(top('microphone').includes('micLevel'));
  assert.ok(top('音量').includes('micLevel'));
  assert.equal(top('startMic', 1)[0], 'startMic');
  assert.equal(top('knob3', 1)[0], 'knob1', 'knob3 is covered by the knob1 entry');
  assert.ok(score(recs.find((r) => r.name === 'micLevel'), tokens('loudness')) > 0, 'loudness (a keyword)');
});

// ---------------------------------------------------------------------------- the site search: the index and the way in
import zlib from 'node:zlib';
import { buildIndex, indexText, INDEX, plain } from '../tools/build-search.mjs';
import { EXAMPLES } from '../tools/examples/catalog.mjs';
import { catalog } from '../tools/controllers/page.mjs';
import { CHAPTERS } from '../tools/docs/chapters.mjs';

const idx = JSON.parse(read(INDEX));
const built = buildIndex();
const prepared = idx.records.map((r) => prepare({ ...r, name: r.n, names: r.a, kw: r.k, title: r.s, summary: r.d, text: r.x }));
const ask = (q, lang = 'en', n = 5) => rank(prepared, q, { limit: 40, boost: (r) => (r.l === lang ? 400 : 0) + 6 * Math.min(r.w || 0, 10) }).map((x) => x.rec).filter((r, i, a) => a.findIndex((y) => y.i === r.i) === i).slice(0, n);

test('the index exists and is what the sources build (node tools/build-search.mjs)', () => {
  assert.equal(read(INDEX), indexText(built), 'assets/search/index.json is stale');
  assert.equal(idx.schema, 1);
  assert.equal(idx.count, idx.records.length);
});

test('the index covers every source, in both languages: the reference, the handbook, the examples, the controllers, the pages', () => {
  const n = (t, l) => idx.records.filter((r) => r.t === t && r.l === l).length;
  const ref = JSON.parse(read('docs/reference/reference.json')).entries.length;
  const cat = catalog();
  for (const l of ['en', 'zh']) {
    assert.equal(n('ref', l), ref, `${l}: one record per reference entry`);
    assert.equal(n('ex', l), EXAMPLES.length, `${l}: one per example`);
    assert.equal(n('ctl', l), cat.devices.length + cat.generic.length, `${l}: one per controller`);
    assert.ok(n('doc', l) >= CHAPTERS.length * 3, `${l}: the chapters and their sections (${n('doc', l)})`);
    assert.ok(n('page', l) >= 6, `${l}: the site's pages`);
  }
  for (const ch of CHAPTERS) for (const l of ['en', 'zh']) assert.ok(idx.records.some((r) => r.t === 'doc' && r.l === l && r.i === `doc:${ch.id}`), `${l}: chapter ${ch.id}`);
  for (const r of idx.records) {
    assert.ok(r.n && typeof r.u === 'string' && r.i && r.t && r.l, `a record has a name, a url, an id, a type and a language: ${JSON.stringify(r).slice(0, 80)}`);
    assert.ok(typeof r.u === 'string' && !/^https?:|^\//.test(r.u), `${r.u}: urls are relative to the site root ("" is the home page)`);
  }
});

test('every url in the index is a page (or a place on a page) that exists', () => {
  const ids = (file) => new Set([...read(file).matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  const cache = new Map();
  for (const r of idx.records) {
    const [p, hash] = r.u.split('#');
    const file = p === '' || p.endsWith('/') ? `${p}index.html` : p;
    assert.ok(fs.existsSync(path.join(ROOT, file)), `${r.u}: ${file} exists`);
    if (hash) { if (!cache.has(file)) cache.set(file, ids(file)); assert.ok(cache.get(file).has(hash), `${r.u}: #${hash} is on the page`); }
  }
});

const askRef = (q, lang = 'en', n = 5) => ask(q, lang, 80).filter((r) => r.t === 'ref').slice(0, n);   // the dialog shows the API reference group first
test('micLevel: found in both languages, by its name, its words, and the Chinese and English words people use', () => {
  assert.equal(idx.records.filter((r) => r.i === 'ref:micLevel').length, 2, 'one record per language');
  assert.equal(ask('micLevel', 'en', 1)[0].i, 'ref:micLevel');
  assert.equal(ask('micLevel', 'zh', 1)[0].u, 'zh/docs/reference/#micLevel', 'from the Chinese site it is the Chinese page');
  for (const q of ['miclevel', 'mic level', '麥克風 音量', 'volume', 'loudness']) assert.equal(askRef(q, 'en', 1)[0].i, 'ref:micLevel', `"${q}": micLevel is the first API reference result`);
  for (const q of ['microphone', '麥克風', '音量']) assert.ok(askRef(q, 'en', 3).some((r) => r.i === 'ref:micLevel'), `"${q}": micLevel is in the first three API reference results`);
  // the keywords of both languages are in both records, so a query in one language is answered in the language of the page you are on
  assert.equal(askRef('麥克風', 'en', 6).find((r) => r.i === 'ref:micLevel').l, 'en', 'a Chinese word from the English site: the English entry');
  assert.equal(askRef('microphone', 'zh', 6).find((r) => r.i === 'ref:micLevel').l, 'zh', 'an English word from the Chinese site: the Chinese entry');
});

test('the names people type: aliases (knob3), OAVp5 members as midi.x, options, events, classes', () => {
  assert.equal(ask('knob3', 'en', 1)[0].i, 'ref:knob1', 'knob3 is an alias of the knob1 entry');
  assert.equal(ask('startDrums', 'en', 1)[0].i, 'ref:startDrums');
  assert.equal(ask('midi.play', 'en', 1)[0].i, 'ref:OAVp5.play', 'midi.play is OAVp5.play');
  assert.equal(ask('notePressed', 'en', 1)[0].i, 'ref:notePressed');
  assert.equal(ask('AudioAnalyzer', 'en', 1)[0].i, 'ref:AudioAnalyzer');
  assert.ok(ask('mic', 'en', 5).some((r) => r.i === 'ref:option-mic'), 'an option');
});

test('the handbook, the examples, the controllers and the pages are found by their own words', () => {
  assert.ok(ask('relay', 'en', 8).some((r) => r.t === 'doc'), 'a handbook section');
  assert.ok(ask('map curves smoothing', 'en', 8).some((r) => r.t === 'doc' && /mapping/.test(r.i)), 'a section of the mapping chapter');
  assert.ok(ask('minilab', 'en', 5).some((r) => r.t === 'ctl'), 'a controller');
  assert.ok(ask('note names', 'en', 6).some((r) => r.i === 'ex:24-p5-note-names'), 'example 24');
  assert.ok(ask('音名', 'zh', 6).some((r) => r.i === 'ex:24-p5-note-names'), 'example 24, from Chinese');
  assert.ok(ask('webtoe', 'en', 6).some((r) => r.t === 'page'), 'a page');
  assert.ok(ask('控制器', 'zh', 8).some((r) => r.t === 'ctl' || r.t === 'page'), 'Chinese for controller');
  assert.ok(ask('手機', 'zh', 8).some((r) => r.t === 'doc'), 'a Chinese handbook section');
});

test('the index has a size budget: a page of text, not a library', () => {
  const raw = Buffer.from(read(INDEX));
  assert.ok(raw.length < 3 * 1024 * 1024, `${raw.length} bytes raw`);
  assert.ok(zlib.gzipSync(raw).length < 700 * 1024, `${zlib.gzipSync(raw).length} bytes gzipped`);
});

test('plain(): code blocks and tags out, entities decoded', () => {
  assert.equal(plain('<p>a &amp; <code>b</code></p><pre>code here</pre><p>c</p>'), 'a & b c');
});

test('every page with a top bar has the search button and the script that makes it work; no JavaScript: it is a link to the reference', () => {
  const pages = ['index.html', 'zh/index.html', 'docs/index.html', 'zh/docs/index.html', 'docs/reference/index.html', 'zh/docs/reference/index.html', 'controllers/index.html', 'zh/controllers/index.html',
    'controllers/arturia-minilab3/index.html', 'examples/index.html', 'zh/examples/index.html', 'p5/index.html', 'zh/p5/index.html', 'changelog/index.html', 'webtoe/index.html', 'check/index.html', '404.html'];
  for (const f of pages) {
    const h = read(f);
    assert.match(h, /<a class="nav-search" href="[^"]*docs\/reference\/"[^>]* data-search /, `${f}: the button, a link to the reference`);
    assert.match(h, /<script type="module" src="[^"]*assets\/search\/search\.js/, `${f}: search.js`);
    assert.match(h, /aria-keyshortcuts="Control\+K Meta\+K \/"/, `${f}: the shortcuts are announced`);
  }
  for (const f of ['zh/index.html', 'zh/docs/index.html']) assert.match(read(f), /<span class="nav-search-label">搜尋<\/span>/, `${f}: the Chinese label`);
  // an example page is a sketch with no top bar: it has none of it
  assert.doesNotMatch(read('examples/24-p5-note-names/index.html'), /nav-search|search\.js/);
});

test('the search is in the stamp list (the script is stamped like every module) and the browser check exists', () => {
  const stamp = read('tools/stamp-version.mjs');
  for (const f of ['changelog/index.html', 'docs/reference/index.html']) assert.ok(stamp.includes(`'${f}'`), `stamp-version covers ${f}`);
  assert.ok(fs.existsSync(path.join(ROOT, 'p5/test/search-smoke.cjs')));
  assert.match(read('.github/workflows/checks.yml'), /search-smoke\.cjs/, 'CI runs it');
});
