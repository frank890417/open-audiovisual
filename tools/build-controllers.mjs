#!/usr/bin/env node
// build-controllers — render /controllers/ (en), /zh/controllers/ (繁中) and one page per device from ONE template,
// and write sitemap.xml (the same file every build-*.mjs writes).
//
//   node tools/build-controllers.mjs          # write controllers/ (gallery + <id>/), zh/controllers/, sitemap.xml
//   node tools/build-controllers.mjs --check  # exit 1 if the committed pages are stale
//
// Same pattern as tools/build-home.mjs. Inputs:
//   tools/controllers/page.mjs   structure, ids, links, code, the static faceplates (shared)
//   tools/controllers/en.mjs     English strings          → /controllers/
//   tools/controllers/zh.mjs     Traditional Chinese      → /zh/controllers/
//   tools/controllers/detail.mjs one page per device: /controllers/<id>/ and /zh/controllers/<id>/
//   packages/midi/profiles/*.json (through profiles/index.js) — every device fact on the pages
//   tools/home/en.mjs, zh.mjs    nav and footer strings (the shared site chrome)
// So: a new profile registered in packages/midi/profiles/index.js → rerun this, nothing else (its two pages and sitemap entries appear).
// Run tools/stamp-version.mjs afterwards, as before every deploy; --check ignores ?v= stamps.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderPage, catalog, PROFILE_DIR, detailPath, detailUrl } from './controllers/page.mjs';
import { renderDetail } from './controllers/detail.mjs';
import { shapeDiff } from './build-home.mjs';
import { registry, urlBlocks, sitemapXml, unstamp } from './site/pages.mjs';
export { unstamp };
import en from './controllers/en.mjs';
import zh from './controllers/zh.mjs';
import homeEn from './home/en.mjs';
import homeZh from './home/zh.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const PAGES = { en: 'controllers/index.html', zh: 'zh/controllers/index.html' };
export const SITEMAP = 'sitemap.xml';
/** Where a device's own page is written: controllers/<id>/index.html, zh/controllers/<id>/index.html. */
export const detailFile = (id, lang) => detailPath(id, lang) + 'index.html';

/** The <url> blocks the sitemap lists for /controllers/: the gallery and one page per profile, both languages, with hreflang
 *  and a <lastmod> from git. (sitemap.xml itself is written by tools/site/pages.mjs, the same file whichever generator runs.) */
export const sitemapEntries = () => urlBlocks(registry().filter((e) => e.group === 'controllers'));

export function buildPages() {
  const diff = shapeDiff(en, zh);
  if (diff.length) throw new Error('controllers string tables differ in shape:\n  ' + diff.join('\n  '));
  const cat = catalog();
  const files = {
    [PAGES.en]: renderPage(en, homeEn, 'en'),
    [PAGES.zh]: renderPage(zh, homeZh, 'zh'),
  };
  for (const d of [...cat.devices, ...cat.generic]) {
    files[detailFile(d.p.id, 'en')] = renderDetail(en, homeEn, 'en', d, cat);
    files[detailFile(d.p.id, 'zh')] = renderDetail(zh, homeZh, 'zh', d, cat);
  }
  files[SITEMAP] = sitemapXml();
  return files;
}

/** Which committed pages differ from what the template renders now (and which device pages no profile asks for any more). */
export function stalePages(files = buildPages()) {
  const stale = [];
  for (const [rel, out] of Object.entries(files)) {
    const file = path.join(ROOT, rel);
    const cur = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
    if (cur === null || unstamp(cur) !== unstamp(out)) stale.push(rel);
  }
  for (const rel of orphanPages(files)) stale.push(rel + '  (no profile any more: delete it)');
  return stale;
}

/** controllers/<id>/index.html files on disk that the current profiles do not produce. */
export function orphanPages(files = buildPages()) {
  const out = [];
  for (const base of ['controllers', 'zh/controllers']) {
    const dir = path.join(ROOT, base);
    if (!fs.existsSync(dir)) continue;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const rel = `${base}/${e.name}/index.html`;
      if (e.isDirectory() && fs.existsSync(path.join(ROOT, rel)) && !(rel in files)) out.push(rel);
    }
  }
  return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const files = buildPages();
  if (process.argv.includes('--check')) {
    const stale = stalePages(files);
    if (stale.length) { console.error('stale (run node tools/build-controllers.mjs):\n  ' + stale.join('\n  ')); process.exit(1); }
    console.log(`✅ controllers pages up to date (${Object.keys(files).length - 1} pages + sitemap)`);
  } else {
    let n = 0, bytes = 0;
    for (const [rel, out] of Object.entries(files)) {
      const file = path.join(ROOT, rel);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, out);
      n++; bytes += out.length;
    }
    for (const rel of orphanPages(files)) console.warn('orphan (no profile any more):', rel);
    console.log(`wrote ${n} files (${PAGES.en}, ${PAGES.zh}, ${n - 3} device pages, ${SITEMAP}), ${bytes} bytes`);
  }
}
