#!/usr/bin/env node
// build-webtoe — render /webtoe/ (en) and /zh/webtoe/ (繁中) from ONE template.
//
//   node tools/build-webtoe.mjs          # write webtoe/index.html, zh/webtoe/index.html
//   node tools/build-webtoe.mjs --check  # exit 1 if the committed pages are stale
//
// Same pattern as tools/build-controllers.mjs. Inputs:
//   tools/webtoe/page.mjs   structure, ids, links, code, the README numbers (shared)
//   tools/webtoe/en.mjs     English strings          → /webtoe/
//   tools/webtoe/zh.mjs     Traditional Chinese      → /zh/webtoe/
//   tools/home/en.mjs, zh.mjs    nav and footer strings (the shared site chrome)
// Run tools/stamp-version.mjs afterwards, as before every deploy; --check ignores ?v= stamps.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderPage } from './webtoe/page.mjs';
import { shapeDiff } from './build-home.mjs';
import en from './webtoe/en.mjs';
import zh from './webtoe/zh.mjs';
import homeEn from './home/en.mjs';
import homeZh from './home/zh.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const PAGES = { en: 'webtoe/index.html', zh: 'zh/webtoe/index.html' };

export function buildPages() {
  const diff = shapeDiff(en, zh);
  if (diff.length) throw new Error('webtoe string tables differ in shape:\n  ' + diff.join('\n  '));
  return {
    [PAGES.en]: renderPage(en, homeEn, 'en'),
    [PAGES.zh]: renderPage(zh, homeZh, 'zh'),
  };
}

export const unstamp = (s) => s.replace(/\?v=[\w.+-]+/g, '');

/** Which committed pages differ from what the template renders now. */
export function stalePages(files = buildPages()) {
  const stale = [];
  for (const [rel, out] of Object.entries(files)) {
    const file = path.join(ROOT, rel);
    const cur = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
    if (cur === null || unstamp(cur) !== unstamp(out)) stale.push(rel);
  }
  return stale;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const files = buildPages();
  if (process.argv.includes('--check')) {
    const stale = stalePages(files);
    if (stale.length) { console.error('stale (run node tools/build-webtoe.mjs):\n  ' + stale.join('\n  ')); process.exit(1); }
    console.log('✅ webtoe pages up to date (en, zh)');
  } else {
    for (const [rel, out] of Object.entries(files)) {
      const file = path.join(ROOT, rel);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, out);
      console.log('wrote', rel, `(${out.length} bytes)`);
    }
  }
}
