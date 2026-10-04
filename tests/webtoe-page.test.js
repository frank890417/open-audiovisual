// /webtoe/ (en) and /zh/webtoe/ are static pages rendered from one template
// (tools/build-webtoe.mjs). These tests keep them honest: fresh, same shape, same
// sections and links, the README's numbers and the research-only note on both,
// and the page reachable from every page of the site (nav, footer, sitemap, llms.txt).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPages, stalePages, PAGES } from '../tools/build-webtoe.mjs';
import { shapeDiff } from '../tools/build-home.mjs';
import { SECTIONS, WEBTOE } from '../tools/webtoe/page.mjs';
import { NAV, PAGES as SITE_PAGES } from '../tools/site/chrome.mjs';
import en from '../tools/webtoe/en.mjs';
import zh from '../tools/webtoe/zh.mjs';
import homeEn from '../tools/home/en.mjs';
import homeZh from '../tools/home/zh.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const URLS = { en: 'https://openaudiovisual.com/webtoe/', zh: 'https://openaudiovisual.com/zh/webtoe/' };
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const html = { en: read(PAGES.en), zh: read(PAGES.zh) };
const all = (re, s) => [...s.matchAll(re)].map((m) => m[1]);
const body = (s) => s.slice(s.indexOf('<body'));

test('string tables have the same shape (every key, every array length)', () => {
  assert.deepEqual(shapeDiff(en, zh), []);
  assert.deepEqual(shapeDiff(homeEn, homeZh), []);
});

test('committed pages are what the template renders (run node tools/build-webtoe.mjs)', () => {
  assert.deepEqual(stalePages(buildPages()), []);
});

test('both pages: same sections, same headings, same links one to one', () => {
  const ids = (s) => all(/<section[^>]*\sid="([^"]+)"/g, s);
  assert.deepEqual(ids(html.en), SECTIONS);
  assert.deepEqual(ids(html.zh), ids(html.en));
  for (const lvl of [1, 2, 3, 4]) {
    const n = (s) => (body(s).match(new RegExp(`<h${lvl}[\\s>]`, 'g')) || []).length;
    assert.equal(n(html.zh), n(html.en), `h${lvl} count`);
  }
  assert.equal((html.en.match(/<h1[\s>]/g) || []).length, 1, 'exactly one h1');
  const norm = (h, base) => new URL(h.replace(/&amp;/g, '&'), base).href.replace(/\?v=[\w.-]+/, '').replace(/^(https?:\/\/[^/]+)\/zh(\/|$)/, '$1/');
  const links = (lang) => all(/<a\s[^>]*href="([^"]+)"/g, body(html[lang])).map((h) => norm(h, URLS[lang]));
  assert.deepEqual(links('zh'), links('en'));
  for (const u of Object.values(WEBTOE)) assert.ok(links('en').includes(u), `links to ${u}`);
});

test('language metadata: lang, canonical, hreflang trio, OG, JSON-LD', () => {
  for (const [lang, want] of [['en', 'en'], ['zh', 'zh-Hant-TW']]) {
    const s = html[lang];
    assert.match(s, new RegExp(`<html lang="${want}">`));
    assert.match(s, new RegExp(`<link rel="canonical" href="${URLS[lang]}">`));
    assert.match(s, new RegExp(`<meta property="og:url" content="${URLS[lang]}">`));
    for (const [hl, url] of [['en', URLS.en], ['zh-Hant', URLS.zh], ['x-default', URLS.en]])
      assert.match(s, new RegExp(`<link rel="alternate" hreflang="${hl}" href="${url}">`), `${lang} hreflang ${hl}`);
    const ld = JSON.parse(s.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
    assert.equal(ld.url, URLS[lang]);
    assert.equal(ld.inLanguage, want);
    assert.equal(ld.about.name, 'WebToe');
    assert.equal(ld.about.url, WEBTOE.app);
  }
});

test('the README numbers, the research-only note and the disclaimer are on both pages', () => {
  for (const lang of ['en', 'zh']) {
    const s = html[lang];
    for (const n of ['~90 KB', 'WebGL2 + WebGPU', '62.3%', '28,698', '125 / 125', '553,230', '17.7 s', '266.5 s'])
      assert.ok(s.includes(n), `${lang}: ${n}`);
    assert.ok(s.includes('Derivative Inc.'), `${lang}: disclaimer`);
  }
  assert.ok(html.en.includes('<strong>Native .toe decoding is provided for research purposes only.</strong>'));
  assert.ok(html.zh.includes('<strong>原生 .toe 解碼僅供研究用途。</strong>'));
  assert.ok(html.en.includes('TouchDesigner is a trademark of Derivative Inc.'));
  assert.ok(html.zh.includes('TouchDesigner 是 Derivative Inc. 的商標'));
});

test('every local link and asset exists, every #anchor has a target', () => {
  for (const [lang, rel] of Object.entries(PAGES)) {
    const s = html[lang];
    const dir = path.dirname(path.join(ROOT, rel));
    const refs = [...all(/\s(?:href|src)="([^"]+)"/g, s), ...all(/\ssrcset="([^"]+)"/g, s).flatMap((v) => v.split(',').map((x) => x.trim().split(/\s+/)[0]))];
    for (const ref of refs) {
      if (/^(https?:|data:|mailto:)/.test(ref)) continue;
      if (ref.startsWith('#')) { assert.match(s, new RegExp(`id="${ref.slice(1)}"`), `${lang}: ${ref} has no target`); continue; }
      const [clean, hash] = ref.replace(/&amp;/g, '&').split(/[?]/)[0].split('#');
      let f = path.join(dir, clean);
      if (clean.endsWith('/')) f = path.join(f, 'index.html');
      assert.ok(fs.existsSync(f), `${lang}: ${ref} → ${path.relative(ROOT, f)} missing`);
      if (hash) assert.match(fs.readFileSync(f, 'utf8'), new RegExp(`id="${hash}"`), `${lang}: ${ref} anchor missing`);
    }
  }
});

test('reachable from the whole site: nav, footer, homepage section, sitemap, llms.txt, stamp list', () => {
  assert.equal(SITE_PAGES.webtoe, 'webtoe/');
  assert.ok(NAV.some(([k, d]) => k === 'webtoe' && d.page === 'webtoe'), 'NAV has webtoe');
  assert.equal(homeEn.ui.nav.webtoe, 'WebToe');
  assert.equal(homeZh.ui.nav.webtoe, 'WebToe');
  const pages = { 'index.html': './webtoe/', 'zh/index.html': '../zh/webtoe/', 'controllers/index.html': '../webtoe/', 'zh/controllers/index.html': '../../zh/webtoe/',
    'docs/index.html': '../webtoe/', 'zh/docs/index.html': '../../zh/webtoe/', 'webtoe/index.html': './', 'zh/webtoe/index.html': './' };
  for (const [rel, href] of Object.entries(pages)) {
    const s = read(rel);
    const nav = s.slice(s.indexOf('<nav class="nav"'), s.indexOf('</nav>', s.indexOf('<nav class="nav"')));
    assert.ok(nav.includes(`>WebToe</a>`), `${rel}: top bar has WebToe`);
    const foot = s.slice(s.indexOf('<footer'));
    assert.ok(foot.includes('>WebToe</a>'), `${rel}: footer has WebToe`);
    if (rel.startsWith('webtoe') || rel.startsWith('zh/webtoe')) assert.match(nav, /aria-current="page">WebToe</, `${rel}: current page marked`);
    else assert.ok(nav.includes(`href="${href}">WebToe</a>`), `${rel}: nav href ${href}`);
  }
  for (const rel of ['index.html', 'zh/index.html']) assert.match(read(rel), /<section class="sec sec-webtoe" id="webtoe"/, `${rel}: homepage section`);
  const sitemap = read('sitemap.xml');
  for (const u of Object.values(URLS)) assert.ok(sitemap.includes(`<loc>${u}</loc>`), `sitemap ${u}`);
  assert.ok(sitemap.includes('<xhtml:link rel="alternate" hreflang="zh-Hant" href="https://openaudiovisual.com/zh/webtoe/"/>'));
  const llms = read('llms.txt');
  assert.ok(llms.includes(URLS.en) && llms.includes(URLS.zh), 'llms.txt lists both languages');
  assert.ok(read('llms-full.txt').includes(URLS.en), 'llms-full.txt mentions the page');
  const stamp = read('tools/stamp-version.mjs');
  for (const rel of Object.values(PAGES)) assert.ok(stamp.includes(`'${rel}'`), `stamp-version covers ${rel}`);
});
