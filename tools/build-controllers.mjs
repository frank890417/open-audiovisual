#!/usr/bin/env node
// build-controllers — render /controllers/ (en), /zh/controllers/ (繁中) and one page per device from ONE template,
// and keep the /controllers/ urls in sitemap.xml current.
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
import { renderDetail, lastmodOf } from './controllers/detail.mjs';
import { shapeDiff } from './build-home.mjs';
import { SITE } from './site/chrome.mjs';
import en from './controllers/en.mjs';
import zh from './controllers/zh.mjs';
import homeEn from './home/en.mjs';
import homeZh from './home/zh.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const PAGES = { en: 'controllers/index.html', zh: 'zh/controllers/index.html' };
export const SITEMAP = 'sitemap.xml';
/** Where a device's own page is written: controllers/<id>/index.html, zh/controllers/<id>/index.html. */
export const detailFile = (id, lang) => detailPath(id, lang) + 'index.html';

/** The urls the sitemap lists for /controllers/: the gallery and one page per profile, both languages, with hreflang. */
export function sitemapEntries(cat = catalog()) {
  const lm = (d) => lastmodOf(`${PROFILE_DIR}/${d.file}`);
  const all = [...cat.devices, ...cat.generic];
  const newest = all.map(lm).filter(Boolean).sort().pop() || '';
  const entry = (en_, zh_, lastmod) => ['en', 'zh'].map((l) => {
    const loc = l === 'en' ? en_ : zh_;
    return `  <url>\n    <loc>${loc}</loc>\n${lastmod ? `    <lastmod>${lastmod}</lastmod>\n` : ''}`
      + `    <xhtml:link rel="alternate" hreflang="en" href="${en_}"/>\n    <xhtml:link rel="alternate" hreflang="zh-Hant" href="${zh_}"/>\n    <xhtml:link rel="alternate" hreflang="x-default" href="${en_}"/>\n  </url>\n`;
  }).join('');
  return entry(SITE + 'controllers/', SITE + 'zh/controllers/', newest)
    + all.map((d) => entry(detailUrl(d.p.id, 'en'), detailUrl(d.p.id, 'zh'), lm(d))).join('');
}

const MARK = ['  <!-- controllers: written by tools/build-controllers.mjs -->\n', '  <!-- /controllers -->\n'];
const ownUrl = /[ \t]*<url>\s*<loc>https:\/\/openaudiovisual\.com\/(?:zh\/)?controllers\/[^<]*<\/loc>[\s\S]*?<\/url>[ \t]*\n?/g;

/** sitemap.xml with the /controllers/ urls regenerated; every other url is left exactly as it was. */
export function sitemapWith(current, entries = sitemapEntries()) {
  const block = MARK[0] + entries + MARK[1];
  const i = current.indexOf(MARK[0]), j = current.indexOf(MARK[1]);
  if (i >= 0 && j > i) return current.slice(0, i) + block + current.slice(j + MARK[1].length);
  let placed = false;
  const out = current.replace(ownUrl, () => (placed ? '' : ((placed = true), block)));
  return placed ? out : out.replace('</urlset>', block + '</urlset>');
}

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
  const sm = path.join(ROOT, SITEMAP);
  files[SITEMAP] = sitemapWith(fs.existsSync(sm) ? fs.readFileSync(sm, 'utf8') : '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n</urlset>\n', sitemapEntries(cat));
  return files;
}

// ?v= stamps and <lastmod> dates are not template output: the first is stamp-version's, the second is git's
export const unstamp = (s) => s.replace(/\?v=[\w.+-]+/g, '').replace(/<lastmod>[^<]*<\/lastmod>\s*/g, '');

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
