// One page per controller: /controllers/<id>/ and /zh/controllers/<id>/ (tools/controllers/detail.mjs).
// Reads the committed files, so it also catches "profile added, generator not rerun".
// Reads files and the profile registry only; it imports nothing from the generator beyond the public build API.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { PROFILES } from '../packages/midi/profiles/index.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://openaudiovisual.com/';
const dir = (id, lang) => `${lang === 'zh' ? 'zh/' : ''}controllers/${id}/`;
const url = (id, lang) => SITE + dir(id, lang);
const file = (id, lang) => path.join(ROOT, dir(id, lang), 'index.html');
const page = (id, lang) => fs.readFileSync(file(id, lang), 'utf8');
const pages = [];
for (const p of PROFILES) for (const lang of ['en', 'zh']) pages.push({ p, lang, id: p.id, s: fs.existsSync(file(p.id, lang)) ? page(p.id, lang) : '' });
const ld = (s) => JSON.parse(s.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1])['@graph'];
const meta = (s, re) => (s.match(re) || [])[1];
const fileOf = (id) => fs.readdirSync(path.join(ROOT, 'packages/midi/profiles')).find((f) => f.endsWith('.json') && JSON.parse(fs.readFileSync(path.join(ROOT, 'packages/midi/profiles', f), 'utf8')).id === id);

test('every profile (devices and generic layouts) has an English and a Chinese page', () => {
  assert.ok(PROFILES.length >= 20);
  for (const { id, lang, s } of pages) assert.ok(s, `${dir(id, lang)}index.html is missing`);
});

test('titles and descriptions are unique, the right size, and say the name', () => {
  const titles = new Map(), descs = new Map();
  for (const { p, id, lang, s } of pages) {
    const title = meta(s, /<title>([^<]*)<\/title>/), desc = meta(s, /<meta name="description" content="([^"]*)"/);
    assert.ok(title && desc, `${id} ${lang}`);
    assert.ok(!titles.has(title + lang), `duplicate title ${title}`); titles.set(title + lang, id);
    assert.ok(!descs.has(desc), `duplicate description for ${id}`); descs.set(desc, id);
    const plain = (x) => x.replace(/&amp;/g, '&');
    assert.ok(plain(title).includes(lang === 'zh' ? p.name : p.nameEn || p.name) || plain(title).includes(p.name), `${id} title names the device`);
    const n = [...plain(desc)].length;
    if (lang === 'en') assert.ok(n >= 110 && n <= 165, `${id} en description ${n} chars`);
    else assert.ok(n >= 50 && n <= 85, `${id} zh description ${n} chars`);
    assert.match(title, lang === 'en' ? /open-audiovisual$/ : /open-audiovisual$/);
  }
});

test('canonical, hreflang trio, lang attribute and og:url point at the right urls', () => {
  for (const { id, lang, s } of pages) {
    assert.match(s, new RegExp(`<html lang="${lang === 'zh' ? 'zh-Hant-TW' : 'en'}">`));
    assert.match(s, new RegExp(`<link rel="canonical" href="${url(id, lang)}">`), `${id} ${lang} canonical`);
    for (const [hl, u] of [['en', url(id, 'en')], ['zh-Hant', url(id, 'zh')], ['x-default', url(id, 'en')]])
      assert.match(s, new RegExp(`<link rel="alternate" hreflang="${hl}" href="${u}">`), `${id} ${lang} hreflang ${hl}`);
    assert.match(s, new RegExp(`<meta property="og:url" content="${url(id, lang)}">`));
    assert.match(s, /<meta property="og:image" content="https:\/\/openaudiovisual\.com\/assets\/home\/og\.png">/);
    assert.match(s, /<meta name="twitter:card" content="summary_large_image">/);
    assert.match(s, /<meta name="twitter:title" content="[^"]+">/);
  }
});

test('JSON-LD parses: BreadcrumbList, WebPage about the hardware, a Dataset pointing at the profile JSON', () => {
  for (const { p, id, lang, s } of pages) {
    const g = ld(s), by = (t) => g.find((x) => x['@type'] === t);
    const bc = by('BreadcrumbList'), wp = by('WebPage'), ds = by('Dataset');
    assert.ok(bc && wp && ds, `${id} ${lang}`);
    assert.deepEqual(bc.itemListElement.map((x) => x.position), [1, 2, 3]);
    assert.equal(bc.itemListElement[1].item, SITE + (lang === 'zh' ? 'zh/' : '') + 'controllers/');
    assert.equal(bc.itemListElement[2].item, url(id, lang));
    assert.equal(wp.url, url(id, lang));
    const about = g.find((x) => x['@id'] === wp.about['@id']);
    assert.ok(about, 'WebPage.about resolves');
    if (p.kind === 'device') {
      assert.equal(about['@type'], 'Product');
      assert.equal(about.brand.name, p.maker); assert.ok(about.name && about.model);
    } else assert.equal(about['@type'], 'Thing');
    for (const bad of ['offers', 'review', 'aggregateRating']) assert.ok(!(bad in about), `${id}: no invented ${bad}`);
    assert.equal(ds.distribution[0].contentUrl, `${SITE}packages/midi/profiles/${fileOf(id)}`);
    assert.equal(ds.distribution[0].encodingFormat, 'application/json');
  }
});

test('the core content is in the HTML, not made by JS: h1, the MIDI table with a row per control, every source', () => {
  for (const { p, id, lang, s } of pages) {
    assert.equal((s.match(/<h1[\s>]/g) || []).length, 1);
    const table = s.match(/<table>\s*<caption>[\s\S]*?<\/table>/)[0];
    assert.equal((table.match(/<tr[\s>]/g) || []).length - 1, p.controls.length, `${id} ${lang} rows`);
    for (const c of p.controls) assert.ok(table.includes(`<code class="cid">${c.id}</code>`), `${id}/${c.id}`);
    for (const src of p.sources || []) assert.ok(s.includes(src.title.replace(/&/g, '&amp;')), `${id}: source "${src.title}"`);
    assert.match(s, /<oav-controller id="d-ctl" profile="[^"]+"[^>]*><svg class="fp"/, 'static faceplate inside the element');
    assert.match(s, new RegExp(`<oav-controller id="d-ctl" profile="${id}"`));
  }
});

test('breadcrumb, related controllers, previous / next, back to the catalog, report links', () => {
  const ids = new Set(PROFILES.map((p) => p.id));
  for (const { id, lang, s } of pages) {
    assert.match(s, /<nav class="crumbs"[^>]*>[\s\S]*?<li aria-current="page">/);
    assert.match(s, /href="(\.\.\/)+(zh\/)?controllers\/"/, 'back to the catalog');
    const rel = [...s.match(/<ul class="rel"[\s\S]*?<\/ul>/)[0].matchAll(/href="\.\.\/([^/"]+)\/"/g)].map((m) => m[1]);
    assert.ok(rel.length >= 3 && rel.length <= 6, `${id}: ${rel.length} related`);
    for (const r of rel) { assert.ok(ids.has(r) && r !== id, `${id}: related ${r}`); }
    assert.match(s, /rel="prev" href="\.\.\/[^/"]+\/"/); assert.match(s, /rel="next" href="\.\.\/[^/"]+\/"/);
    assert.match(s, /github\.com\/frank890417\/open-audiovisual\/issues\/new\?title=[^"]*/);
    assert.match(s, new RegExp(`blob/main/packages/midi/profiles/${fileOf(id)}`));
  }
});

test('"how to use": element and iframe snippets name the device; p5 names follow oav-p5 order', () => {
  const lpd8 = page('akai-lpd8', 'en');
  assert.match(lpd8, /profile=&quot;akai-lpd8&quot;|profile="akai-lpd8"|akai-lpd8/);
  assert.match(lpd8, /p5\/oav-p5\.js\?profile=akai-lpd8/);
  const t = lpd8.match(/<table class="p5">[\s\S]*?<\/table>/)[0];
  assert.match(t, /<code>knob1<\/code><\/th><td>K1 <code class="cid">k1<\/code><\/td><td>CC 70 · Ch 1</);
  assert.match(t, /<code>pad1<\/code><\/th><td>Pad 1 <code class="cid">pad1<\/code><\/td><td>Note 36 · C2 · Ch 10</);
  assert.match(page('generic-keys61', 'en'), /notePressed\(note, velocity\)/);
});

test('sitemap.xml lists every page, both languages, with hreflang and a lastmod taken from the profile\'s last commit', () => {
  const sm = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
  const blocks = [...sm.matchAll(/<url>[\s\S]*?<\/url>/g)].map((m) => m[0]);
  for (const { id, lang } of pages) {
    const u = url(id, lang), b = blocks.find((x) => x.includes(`<loc>${u}</loc>`));
    assert.ok(b, `sitemap lacks ${u}`);
    assert.ok(b.includes(`hreflang="en" href="${url(id, 'en')}"`) && b.includes(`hreflang="zh-Hant" href="${url(id, 'zh')}"`) && b.includes(`hreflang="x-default" href="${url(id, 'en')}"`));
    let want = '';
    try { want = execFileSync('git', ['log', '-1', '--format=%cs', '--', `packages/midi/profiles/${fileOf(id)}`], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { /* no git */ }
    if (want) assert.ok(b.includes(`<lastmod>${want}</lastmod>`), `${u}: lastmod should be ${want}`);
  }
  const locs = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  assert.equal(new Set(locs).size, locs.length, 'no duplicate <loc>');
  for (const keep of ['', 'zh/', 'docs/', 'webtoe/']) assert.ok(locs.includes(SITE + keep), `still lists ${SITE + keep}`);
});

test('the gallery links to every page and keeps #spec-<id> usable', () => {
  for (const lang of ['en', 'zh']) {
    const g = fs.readFileSync(path.join(ROOT, lang === 'zh' ? 'zh/controllers/index.html' : 'controllers/index.html'), 'utf8');
    const itemList = ld(g).find((x) => x['@type'] === 'ItemList');
    for (const p of PROFILES) {
      assert.ok(g.includes(`href="${p.id}/"`), `${lang}: link to ${p.id}`);
      assert.ok(g.includes(`id="spec-${p.id}"`), `${lang}: #spec-${p.id} anchor`);
      assert.ok(itemList.itemListElement.some((x) => x.url === url(p.id, lang)), `${lang}: ItemList url for ${p.id}`);
    }
  }
});

test('the iframe embed and the element are untouched by the pages', () => {
  const emb = fs.readFileSync(path.join(ROOT, 'embed/controller/index.html'), 'utf8');
  assert.match(emb, /<oav-controller id="ctl" data-oav-kind="iframe">/);
  for (const { s } of pages.slice(0, 4)) assert.ok(!/midi-out=/.test(s.match(/<oav-controller id="d-ctl"[^>]*>/)[0]), 'the live element never sends MIDI by itself');
});

// ------------------------------------------------------------------ choose / wish / no Web MIDI, on every device page
const ISSUE_URL = 'https://github.com/frank890417/open-audiovisual/issues/new?template=controller-request.yml';

test('every device page links the request template under "no yours?"', () => {
  for (const { id, lang, s } of pages) {
    const blk = (s.match(/<section class="sec" id="request"[\s\S]*?<\/section>/) || [''])[0];
    assert.ok(blk.includes(`href="${ISSUE_URL}"`), `${id} ${lang}: request link`);
  }
});

test('every device page links back to its own row of the comparison table', () => {
  for (const { id, lang, s } of pages) assert.ok(s.includes(`href="../#cmp-${id}"`), `${id} ${lang}: compare link`);
  const g = fs.readFileSync(path.join(ROOT, 'controllers/index.html'), 'utf8');
  for (const p of PROFILES) assert.ok(g.includes(`<tr id="cmp-${p.id}"`), `the row it points at exists: ${p.id}`);
});

test('every device page says whether its LED feedback is modeled, from the profile', () => {
  for (const { p, id, lang, s } of pages) {
    const has = p.controls.some((c) => c.led);
    const blk = (s.match(/<p class="led-line" data-led="(yes|no)">/) || [])[1];
    assert.equal(blk, has ? 'yes' : 'no', `${id} ${lang}`);
  }
});

test('every device page carries the hidden no-Web-MIDI strip and the detector', () => {
  for (const { id, lang, s } of pages) {
    assert.match(s, /<aside class="no-midi" id="no-midi" role="note" hidden>/, `${id} ${lang}`);
    assert.match(s, /<script>[^<]*requestMIDIAccess[^<]*no-midi[^<]*<\/script>|<script>[^<]*no-midi[^<]*requestMIDIAccess[^<]*<\/script>/, `${id} ${lang}: detector`);
  }
});
