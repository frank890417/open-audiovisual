#!/usr/bin/env node
// build-check — render /check/ (en) and /zh/check/ (繁中) from ONE template.
//
//   node tools/build-check.mjs          # write check/index.html, zh/check/index.html (and sitemap.xml)
//   node tools/build-check.mjs --check  # exit 1 if the committed pages are stale
//
// Same pattern as tools/build-webtoe.mjs. Inputs: tools/check/page.mjs (structure), en.mjs / zh.mjs (strings),
// tools/home/en.mjs, zh.mjs (nav and footer). The behaviour is assets/check/check.js; run tools/stamp-version.mjs
// before a deploy (the script URL gets its ?v= stamp there); --check ignores ?v= stamps.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderPage } from './check/page.mjs';
import { shapeDiff } from './build-home.mjs';
import { sitemapXml, unstamp } from './site/pages.mjs';
import en from './check/en.mjs';
import zh from './check/zh.mjs';
import homeEn from './home/en.mjs';
import homeZh from './home/zh.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const PAGES = { en: 'check/index.html', zh: 'zh/check/index.html' };

export function buildPages() {
  const diff = shapeDiff(en, zh);
  if (diff.length) throw new Error('check string tables differ in shape:\n  ' + diff.join('\n  '));
  return {
    [PAGES.en]: renderPage(en, homeEn, 'en'),
    [PAGES.zh]: renderPage(zh, homeZh, 'zh'),
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

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const files = { ...buildPages(), 'sitemap.xml': sitemapXml() };
  if (process.argv.includes('--check')) {
    const stale = stalePages(files);
    if (stale.length) { console.error('stale (run node tools/build-check.mjs):\n  ' + stale.join('\n  ')); process.exit(1); }
    console.log('✅ check pages up to date (en, zh)');
  } else {
    for (const [rel, out] of Object.entries(files)) {
      const file = path.join(ROOT, rel);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, out);
      console.log('wrote', rel, `(${out.length} bytes)`);
    }
  }
}
