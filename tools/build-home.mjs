#!/usr/bin/env node
// build-home — render the homepage in every language from ONE template.
//
//   node tools/build-home.mjs          # write index.html, zh/index.html, llms.txt, zh/llms.txt, llms-full.txt, sitemap.xml, 404.html, site.webmanifest
//   node tools/build-home.mjs --check  # exit 1 if the committed files are stale
//
// Why a generator in a zero-build framework: the site is two static pages
// (crawlers and AI agents must read both languages without running JS), and two
// hand-kept HTML files drift. The framework itself still needs no build step;
// this script only regenerates committed, static output. Inputs:
//   tools/home/page.mjs   structure, links, code, ids (shared)
//   tools/home/en.mjs     English strings  → /
//   tools/home/zh.mjs     Traditional Chinese strings → /zh/
// Run tools/stamp-version.mjs afterwards, as before every deploy (cache-busting);
// --check ignores ?v= stamps.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderPage, LOCALES } from './home/page.mjs';
import { sitemapXml, unstamp } from './site/pages.mjs';
import { llmsTxt, llmsFull } from './site/llms.mjs';
import { renderNotFound } from './site/notfound.mjs';
import { webManifest } from './site/manifest.mjs';
import en from './home/en.mjs';
import zh from './home/zh.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const check = process.argv.includes('--check');
const version = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;

/** Both string tables must have the same shape: same keys, same array lengths. */
export function shapeDiff(a, b, at = '') {
  const out = [];
  const kind = (v) => Array.isArray(v) ? 'array' : v === null ? 'null' : typeof v;
  if (kind(a) !== kind(b)) return [`${at || '(root)'}: ${kind(a)} vs ${kind(b)}`];
  if (kind(a) === 'array') {
    if (a.length !== b.length) out.push(`${at}: length ${a.length} vs ${b.length}`);
    for (let i = 0; i < Math.min(a.length, b.length); i++) out.push(...shapeDiff(a[i], b[i], `${at}[${i}]`));
  } else if (kind(a) === 'object') {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (!(k in a)) out.push(`${at}.${k}: missing in en`);
      else if (!(k in b)) out.push(`${at}.${k}: missing in zh`);
      else out.push(...shapeDiff(a[k], b[k], `${at}.${k}`));
    }
  }
  return out;
}

export function buildAll() {
  const diff = shapeDiff(en, zh);
  if (diff.length) throw new Error('string tables differ in shape:\n  ' + diff.join('\n  '));
  return {
    [LOCALES.en.path + 'index.html']: renderPage(en, { locale: 'en', other: 'zh', version }),
    [LOCALES.zh.path + 'index.html']: renderPage(zh, { locale: 'zh', other: 'en', version }),
    // generated from the repository (tools/site/llms.mjs): counts, pages, every device page, every example, every chapter
    'llms.txt': llmsTxt('en'),
    'zh/llms.txt': llmsTxt('zh'),
    'llms-full.txt': llmsFull(),
    // one sitemap, four writers: every build-*.mjs writes this same function's output (tools/site/pages.mjs)
    'sitemap.xml': sitemapXml(),
    '404.html': renderNotFound(),
    'site.webmanifest': webManifest(),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const files = buildAll();
  const stale = [];
  for (const [rel, out] of Object.entries(files)) {
    const file = path.join(ROOT, rel);
    const cur = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
    if (check) { if (cur === null || unstamp(cur) !== unstamp(out)) stale.push(rel); continue; }
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, out);
    console.log('wrote', rel, `(${out.length} bytes)`);
  }
  if (check) {
    if (stale.length) { console.error('stale (run node tools/build-home.mjs):\n  ' + stale.join('\n  ')); process.exit(1); }
    console.log('✅ homepage up to date (en, zh, llms.txt ×2, llms-full.txt, sitemap.xml, 404.html, site.webmanifest)');
  }
}
