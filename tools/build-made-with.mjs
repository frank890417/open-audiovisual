#!/usr/bin/env node
// build-made-with — render /made-with/ (en) and /zh/made-with/ (繁中) from ONE template and ONE data file.
//
//   node tools/build-made-with.mjs          # write made-with/index.html, zh/made-with/index.html (and sitemap.xml)
//   node tools/build-made-with.mjs --check  # exit 1 if the committed pages are stale
//
// Inputs: made-with/works.json (the works: one object each, added by the people who made them), tools/made-with/page.mjs
// (structure and the data check), en.mjs / zh.mjs (strings), tools/home/en.mjs, zh.mjs (nav and footer). No script on the page.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderPage, checkWorks, DATA_FILE } from './made-with/page.mjs';
import { VERSION } from '../packages/core/src/signature.js';
import { shapeDiff } from './build-home.mjs';
import { sitemapXml, unstamp } from './site/pages.mjs';
import en from './made-with/en.mjs';
import zh from './made-with/zh.mjs';
import homeEn from './home/en.mjs';
import homeZh from './home/zh.mjs';
import { isMain } from './site/is-main.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const PAGES = { en: 'made-with/index.html', zh: 'zh/made-with/index.html' };

export function buildPages() {
  const diff = shapeDiff(en, zh);
  if (diff.length) throw new Error('made-with string tables differ in shape:\n  ' + diff.join('\n  '));
  const data = JSON.parse(fs.readFileSync(path.join(ROOT, DATA_FILE), 'utf8'));
  const bad = checkWorks(data);
  if (bad.length) throw new Error(DATA_FILE + ':\n  ' + bad.join('\n  '));
  return {
    [PAGES.en]: renderPage(en, homeEn, 'en', data, { version: VERSION }),
    [PAGES.zh]: renderPage(zh, homeZh, 'zh', data, { version: VERSION }),
  };
}

export { unstamp };

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

if (isMain(import.meta.url)) {
  const files = { ...buildPages(), 'sitemap.xml': sitemapXml() };
  if (process.argv.includes('--check')) {
    const stale = stalePages(files);
    if (stale.length) { console.error('stale (run node tools/build-made-with.mjs):\n  ' + stale.join('\n  ')); process.exit(1); }
    console.log('✅ made-with pages up to date (en, zh)');
  } else {
    for (const [rel, out] of Object.entries(files)) {
      const file = path.join(ROOT, rel);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, out);
      console.log('wrote', rel, `(${out.length} bytes)`);
    }
  }
}
