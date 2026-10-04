#!/usr/bin/env node
// build-controllers — render /controllers/ (en) and /zh/controllers/ (繁中) from ONE template.
//
//   node tools/build-controllers.mjs          # write controllers/index.html, zh/controllers/index.html
//   node tools/build-controllers.mjs --check  # exit 1 if the committed pages are stale
//
// Same pattern as tools/build-home.mjs. Inputs:
//   tools/controllers/page.mjs   structure, ids, links, code, the static faceplates (shared)
//   tools/controllers/en.mjs     English strings          → /controllers/
//   tools/controllers/zh.mjs     Traditional Chinese      → /zh/controllers/
//   packages/midi/profiles/*.json (through profiles/index.js) — every device fact on the page
//   tools/home/en.mjs, zh.mjs    nav and footer strings (the shared site chrome)
// So: a new profile registered in packages/midi/profiles/index.js → rerun this, nothing else.
// Run tools/stamp-version.mjs afterwards, as before every deploy; --check ignores ?v= stamps.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderPage } from './controllers/page.mjs';
import { shapeDiff } from './build-home.mjs';
import en from './controllers/en.mjs';
import zh from './controllers/zh.mjs';
import homeEn from './home/en.mjs';
import homeZh from './home/zh.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const PAGES = { en: 'controllers/index.html', zh: 'zh/controllers/index.html' };

export function buildPages() {
  const diff = shapeDiff(en, zh);
  if (diff.length) throw new Error('controllers string tables differ in shape:\n  ' + diff.join('\n  '));
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
    if (stale.length) { console.error('stale (run node tools/build-controllers.mjs):\n  ' + stale.join('\n  ')); process.exit(1); }
    console.log('✅ controllers pages up to date (en, zh)');
  } else {
    for (const [rel, out] of Object.entries(files)) {
      const file = path.join(ROOT, rel);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, out);
      console.log('wrote', rel, `(${out.length} bytes)`);
    }
  }
}
