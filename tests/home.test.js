// The homepage is two static pages (en at /, zh at /zh/) rendered from one
// template by tools/build-home.mjs. These tests keep them honest: same shape,
// same sections, same links, nothing stale, nothing broken.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildAll, shapeDiff } from '../tools/build-home.mjs';
import en from '../tools/home/en.mjs';
import zh from '../tools/home/zh.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PAGES = { en: { file: 'index.html', url: 'https://openaudiovisual.com/' }, zh: { file: 'zh/index.html', url: 'https://openaudiovisual.com/zh/' } };
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const html = { en: read(PAGES.en.file), zh: read(PAGES.zh.file) };
const all = (re, s) => [...s.matchAll(re)].map((m) => m[1]);
const body = (s) => s.slice(s.indexOf('<body'));

// one language's link, expressed so that the other language's twin is identical
const normLink = (href, base) => new URL(href, base).href.replace(/\?v=[\w.-]+/, '')
  .replace(/^(https?:\/\/[^/]+)\/zh(\/|$)/, '$1/');

test('string tables have the same shape (every key, every array length)', () => {
  assert.deepEqual(shapeDiff(en, zh), []);
});

test('committed pages are what the template renders (run node tools/build-home.mjs)', () => {
  const built = buildAll();
  const unstamp = (s) => s.replace(/\?v=[\w.-]+/g, '');
  for (const rel of ['index.html', 'zh/index.html', 'llms-full.txt']) assert.equal(unstamp(read(rel)), unstamp(built[rel]), rel + ' is stale');
});

test('both pages have the same sections, in the same order', () => {
  const ids = (s) => all(/<section[^>]*\sid="([^"]+)"/g, s);
  assert.deepEqual(ids(html.en), ['play', 'how', 'works', 'webtoe', 'start', 'agents', 'lineage']);
  assert.deepEqual(ids(html.zh), ids(html.en));
  for (const lvl of [1, 2, 3, 4]) {
    const n = (s) => (body(s).match(new RegExp(`<h${lvl}[\\s>]`, 'g')) || []).length;
    assert.equal(n(html.zh), n(html.en), `h${lvl} count`);
  }
  assert.equal((html.en.match(/<h1[\s>]/g) || []).length, 1, 'exactly one h1');
});

test('both pages link to the same places, one to one', () => {
  const links = (lang) => all(/<a\s[^>]*href="([^"]+)"/g, body(html[lang])).map((h) => normLink(h, PAGES[lang].url));
  assert.deepEqual(links('zh'), links('en'));
});

test('language metadata: lang, canonical, hreflang, JSON-LD', () => {
  const want = { en: ['en', 'en'], zh: ['zh-Hant-TW', 'zh-Hant-TW'] };
  for (const [lang, p] of Object.entries(PAGES)) {
    const s = html[lang];
    assert.match(s, new RegExp(`<html lang="${want[lang][0]}">`));
    assert.match(s, new RegExp(`<link rel="canonical" href="${p.url}">`));
    for (const [hl, url] of [['en', PAGES.en.url], ['zh-Hant', PAGES.zh.url], ['x-default', PAGES.en.url]])
      assert.match(s, new RegExp(`<link rel="alternate" hreflang="${hl}" href="${url}">`), `${lang} hreflang ${hl}`);
    const ld = JSON.parse(s.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
    assert.equal(ld['@type'], 'SoftwareSourceCode');
    assert.equal(ld.inLanguage, want[lang][1]);
    assert.equal(ld.codeRepository, 'https://github.com/frank890417/open-audiovisual');
    assert.equal(ld.url, p.url);
  }
});

test('every local link and asset exists, every #anchor has a target', () => {
  for (const [lang, p] of Object.entries(PAGES)) {
    const s = html[lang];
    const dir = path.dirname(path.join(ROOT, p.file));
    const refs = [...all(/\s(?:href|src)="([^"]+)"/g, s), ...Object.values(JSON.parse(s.match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]).imports)];
    for (const ref of refs) {
      if (/^(https?:|data:|mailto:)/.test(ref)) continue;
      if (ref.startsWith('#')) { assert.match(s, new RegExp(`id="${ref.slice(1)}"`), `${lang}: ${ref} has no target`); continue; }
      let f = path.join(dir, ref.split(/[?#]/)[0]);
      if (ref.split(/[?#]/)[0].endsWith('/')) f = path.join(f, 'index.html');
      assert.ok(fs.existsSync(f), `${lang}: ${ref} → ${path.relative(ROOT, f)} missing`);
    }
  }
});

test('llms.txt points at both languages and the MCP server', () => {
  const s = read('llms.txt');
  assert.match(s, /^# open-audiovisual\n\n> /);
  assert.ok(s.includes('https://openaudiovisual.com/zh/'));
  assert.ok(s.includes('packages/mcp/server.js'));
});
