// /controllers/ (en) and /zh/controllers/ are static pages rendered from one template
// (tools/build-controllers.mjs) with every device fact read from packages/midi/profiles.
// These tests keep them honest: fresh, same shape, every profile present, links alive.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPages, stalePages, PAGES } from '../tools/build-controllers.mjs';
import { shapeDiff } from '../tools/build-home.mjs';
import { catalog, placeSection } from '../tools/controllers/page.mjs';
import en from '../tools/controllers/en.mjs';
import zh from '../tools/controllers/zh.mjs';
import { PROFILES } from '../packages/midi/profiles/index.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const URLS = { en: 'https://openaudiovisual.com/controllers/', zh: 'https://openaudiovisual.com/zh/controllers/' };
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const html = { en: read(PAGES.en), zh: read(PAGES.zh) };
const all = (re, s) => [...s.matchAll(re)].map((m) => m[1]);
const body = (s) => s.slice(s.indexOf('<body'));
// pages another agent is building at the same time; their links are checked once the file exists
const PENDING = new Set(['docs/index.html', 'zh/docs/index.html']);

test('string tables have the same shape', () => { assert.deepEqual(shapeDiff(en, zh), []); });

test('committed pages are what the template renders (run node tools/build-controllers.mjs)', () => {
  assert.deepEqual(stalePages(buildPages()), []);
});

test('every registered profile has a card, an index row (the old #spec-<id> anchor) and a hero chip, all linking to its own page', () => {
  for (const lang of ['en', 'zh']) {
    const s = html[lang];
    for (const p of PROFILES) {
      assert.match(s, new RegExp(`<li class="card" id="card-${p.id}"`), `${lang}: card ${p.id}`);
      assert.match(s, new RegExp(`<tr id="spec-${p.id}"><th scope="row"><a href="${p.id}/">`), `${lang}: index row / #spec-${p.id} anchor`);
      assert.match(s, new RegExp(`class="chip" href="${p.id}/" data-profile="${p.id}"`), `${lang}: chip ${p.id}`);
      assert.match(s, new RegExp(`<h4 class="card-name"><a href="${p.id}/">`), `${lang}: card name link ${p.id}`);
      assert.match(s, new RegExp(`<a class="card-face-link" href="${p.id}/"`), `${lang}: card face link ${p.id}`);
    }
  }
});

test('numbers on the page come from the profiles (a few spot checks)', () => {
  const lpd8 = read('controllers/akai-lpd8/index.html');
  assert.match(lpd8, /K1 <code class="cid">k1<\/code><\/th>\s*<td>knob<\/td>\s*<td>CC<\/td>\s*<td class="n">1<\/td>\s*<td class="n">70<\/td>/);
  assert.match(lpd8, /Pad 1 <code class="cid">pad1<\/code><\/th>\s*<td>pad<\/td>\s*<td>Note · velocity<\/td>\s*<td class="n">10<\/td>\s*<td class="n">36 · C2<\/td>/);
  const { stats } = catalog();
  assert.equal(stats.devices, PROFILES.filter((p) => p.kind === 'device').length);
  assert.match(html.en, new RegExp(`<dd>${stats.controls}</dd>`));
});

test('both pages: same sections, same headings, same links one to one', () => {
  const ids = (s) => all(/<section[^>]*\sid="([^"]+)"/g, s);
  assert.deepEqual(ids(html.en), ['play', 'catalog', 'specs', 'embed', 'model']);
  assert.deepEqual(ids(html.zh), ids(html.en));
  for (const lvl of [1, 2, 3, 4]) {
    const n = (s) => (body(s).match(new RegExp(`<h${lvl}[\\s>]`, 'g')) || []).length;
    assert.equal(n(html.zh), n(html.en), `h${lvl} count`);
  }
  assert.equal((html.en.match(/<h1[\s>]/g) || []).length, 1);
  const norm = (h, base) => new URL(h, base).href.replace(/\?v=[\w.-]+/, '').replace(/^(https?:\/\/[^/]+)\/zh(\/|$)/, '$1/');
  const links = (lang) => all(/<a\s[^>]*href="([^"]+)"/g, body(html[lang])).map((h) => norm(h.replace(/&amp;/g, '&'), URLS[lang]))
    .filter((h) => !/tobias-erichsen/.test(h));
  assert.deepEqual(links('zh'), links('en'));
});

test('language metadata: lang, canonical, hreflang trio, JSON-LD', () => {
  for (const [lang, want] of [['en', 'en'], ['zh', 'zh-Hant-TW']]) {
    const s = html[lang];
    assert.match(s, new RegExp(`<html lang="${want}">`));
    assert.match(s, new RegExp(`<link rel="canonical" href="${URLS[lang]}">`));
    for (const [hl, url] of [['en', URLS.en], ['zh-Hant', URLS.zh], ['x-default', URLS.en]])
      assert.match(s, new RegExp(`<link rel="alternate" hreflang="${hl}" href="${url}">`), `${lang} hreflang ${hl}`);
    const ld = JSON.parse(s.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
    const [ds, list] = ld['@graph'];
    assert.equal(ds['@type'], 'Dataset'); assert.equal(ds.distribution.length, PROFILES.length);
    assert.equal(list['@type'], 'ItemList'); assert.equal(list.numberOfItems, PROFILES.length);
  }
});

test('every local link and asset exists, every #anchor has a target', () => {
  for (const [lang, rel] of Object.entries(PAGES)) {
    const s = html[lang];
    const dir = path.dirname(path.join(ROOT, rel));
    for (const ref of all(/\s(?:href|src)="([^"]+)"/g, s)) {
      if (/^(https?:|data:|mailto:)/.test(ref)) continue;
      if (ref.startsWith('#')) { assert.match(s, new RegExp(`id="${ref.slice(1)}"`), `${lang}: ${ref} has no target`); continue; }
      const clean = ref.replace(/&amp;/g, '&').split(/[?#]/)[0];
      let f = path.join(dir, clean);
      if (clean.endsWith('/')) f = path.join(f, 'index.html');
      const r = path.relative(ROOT, f);
      if (PENDING.has(r) && !fs.existsSync(f)) continue;
      assert.ok(fs.existsSync(f), `${lang}: ${ref} → ${r} missing`);
    }
  }
});

test('no-JS readers get everything: the hero has a static faceplate, every card has a link, the index lists every profile', () => {
  assert.match(html.en, /<oav-controller id="hero-ctl"[^>]*><svg class="fp"/);
  assert.equal((html.en.match(/<tr id="spec-/g) || []).length, PROFILES.length);
});

test('old links keep working: #spec-<id> and ?profile=<id> are redirected to /controllers/<id>/ by a script in <head>', () => {
  for (const lang of ['en', 'zh']) {
    const head = html[lang].slice(0, html[lang].indexOf('</head>'));
    const m = head.match(/<script>\(function\(\)\{var ids=(\[[^\]]*\])[\s\S]*?location\.replace\([\s\S]*?<\/script>/);
    assert.ok(m, `${lang}: redirect script`);
    assert.deepEqual(JSON.parse(m[1]), PROFILES.map((p) => p.id));
    assert.match(m[0], /#spec-/); assert.match(m[0], /profile=/);
  }
});

test('static faceplate placement follows CSS grid flow and spans (nanoKONTROL2 strips)', () => {
  const nano = PROFILES.find((p) => p.id === 'korg-nanokontrol2');
  const pl = placeSection(nano.sections.find((s) => s.id === 'strips'));
  assert.equal(pl.size, 32);
  const f1 = pl.get('f1');
  assert.deepEqual([f1.cs, f1.rs, f1.row], [1, 3, 0]);
  const cells = new Set();
  for (const v of pl.values()) for (let a = 0; a < v.cs; a++) for (let b = 0; b < v.rs; b++) { const k = `${v.col + a},${v.row + b}`; assert.ok(!cells.has(k), 'no overlap ' + k); cells.add(k); }
});

test('the iframe embed page exists and loads its script', () => {
  const s = read('embed/controller/index.html');
  assert.match(s, /<oav-controller id="ctl"[^>]*>/);
  assert.match(s, /<script type="module" src="\.\/frame\.js/);
  assert.ok(fs.existsSync(path.join(ROOT, 'embed/controller/frame.js')));
});
