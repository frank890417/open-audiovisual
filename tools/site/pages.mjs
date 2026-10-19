// The register of every public page of the site, and the one place sitemap.xml is made.
//
//   import { registry, sitemapXml, unstamp } from '../site/pages.mjs';
//
// A page is in the sitemap because it is in this list; nothing else decides. The list is computed: the
// top-level pages are written below, the examples come from examples/NN-*/, the device pages from the
// controller profiles. Every build-*.mjs writes sitemap.xml through sitemapXml(), so whichever generator
// you run, the file that comes out is the same one.
//
// To register a page another workstream builds (an /examples/ index, /zh/p5/, a new section): add one
// object to STATIC below:
//
//   { id: 'examples', path: 'examples/', langs: ['en', 'zh'], src: ['tools/examples'] }
//
//   path   under the site root, no "zh/" (the zh twin is derived)
//   langs  ['en'] → one url, no hreflang · ['en','zh'] → two urls, hreflang-linked (both files must exist)
//   src    repo paths whose last commit is the page's <lastmod> (files or directories; none → no <lastmod>)
//   files  {en, zh}: the file that proves the page exists, when it is not <path>index.html
//
// A test (tests/site.test.js) checks that every registered page exists on disk, and that every indexable
// index.html on disk is registered: a page cannot be forgotten, or promised and not built.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SITE } from './chrome.mjs';
import { getFacts } from './facts.mjs';
import { lastmodOf } from './git.mjs';
import { catalog, PROFILE_DIR, detailPath, detailUrl } from '../controllers/page.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/**
 * The pages, in sitemap order. `derive` marks where a computed group goes: the device pages (from the
 * controller profiles) and the example pages (from examples/NN-*).
 */
export const STATIC = [
  { id: 'home', path: '', langs: ['en', 'zh'], src: ['tools/home'] },
  { id: 'docs', path: 'docs/', langs: ['en', 'zh'], src: ['docs', 'tools/docs'] },
  // the API reference (tools/build-reference.mjs): its sources are the code it reads and the words written beside it
  { id: 'reference', path: 'docs/reference/', langs: ['en', 'zh'], src: ['tools/reference', 'assets/reference', 'assets/search', 'p5/oav-p5.js', 'p5/reference', 'packages'] },
  { derive: 'controllers' },
  { id: 'webtoe', path: 'webtoe/', langs: ['en', 'zh'], src: ['tools/webtoe'] },
  // the device check: tools/build-check.mjs, behaviour in assets/check/
  { id: 'check', path: 'check/', langs: ['en', 'zh'], src: ['tools/check', 'assets/check'] },
  // the examples index (tools/build-examples.mjs reads examples/catalog.json), then one page per example (derived)
  { id: 'examples', path: 'examples/', langs: ['en', 'zh'], src: ['examples/catalog.json', 'tools/examples', 'assets/examples/pages.css'] },
  { derive: 'examples' },
  // /p5/ and /zh/p5/: docs/p5.md and docs/zh/p5.md in the site's frame (tools/build-examples.mjs); p5/oav-p5.js is untouched
  { id: 'p5', path: 'p5/', langs: ['en', 'zh'], src: ['docs/p5.md', 'docs/zh/p5.md', 'tools/examples/page.mjs'] },
  // /changelog/ and /zh/changelog/: docs/changelog.md and docs/zh/changelog.md in the same frame as /p5/ (tools/build-examples.mjs)
  { id: 'changelog', path: 'changelog/', langs: ['en', 'zh'], src: ['docs/changelog.md', 'docs/zh/changelog.md'] },
];

const GALLERY_SRC = [PROFILE_DIR, 'tools/controllers/page.mjs', 'tools/controllers/en.mjs', 'tools/controllers/zh.mjs'];

const DERIVED = {
  controllers() {
    const cat = catalog();
    return [
      { id: 'controllers', path: 'controllers/', langs: ['en', 'zh'], src: GALLERY_SRC, group: 'controllers' },
      ...[...cat.devices, ...cat.generic].map((d) => ({ id: 'controllers/' + d.p.id, path: detailPath(d.p.id, 'en'), langs: ['en', 'zh'], src: [`${PROFILE_DIR}/${d.file}`], group: 'controllers' })),
    ];
  },
  examples() {
    return getFacts().examples.map((e) => ({ id: 'examples/' + e.id, path: `examples/${e.id}/`, langs: ['en'], src: [`examples/${e.id}`], group: 'examples' }));
  },
};

/** Every public page: { id, path, langs, src, group?, files? }. */
export function registry() {
  return STATIC.flatMap((e) => (e.derive ? DERIVED[e.derive]() : [e]));
}

/** The file proving a page exists in one language (repo-relative). */
export const fileOf = (e, lang) => (e.files && e.files[lang]) || (lang === 'zh' ? 'zh/' : '') + e.path + 'index.html';
export const urlOf = (e, lang) => SITE + (lang === 'zh' ? 'zh/' : '') + e.path;

/** Every <url> of the sitemap, flattened: { loc, lang, entry, lastmod, alt }. */
export function urls(reg = registry()) {
  return reg.flatMap((e) => {
    const lastmod = lastmodOf(e.src);
    const both = e.langs.includes('en') && e.langs.includes('zh');
    return e.langs.map((lang) => ({
      loc: urlOf(e, lang), lang, entry: e, lastmod,
      alt: both ? [['en', urlOf(e, 'en')], ['zh-Hant', urlOf(e, 'zh')], ['x-default', urlOf(e, 'en')]] : [],
    }));
  });
}

function block(u) {
  return `  <url>\n    <loc>${u.loc}</loc>\n${u.lastmod ? `    <lastmod>${u.lastmod}</lastmod>\n` : ''}`
    + u.alt.map(([l, href]) => `    <xhtml:link rel="alternate" hreflang="${l}" href="${href}"/>\n`).join('') + '  </url>\n';
}

/** The <url> blocks of a part of the register (e.g. group 'controllers'), as the sitemap writes them. */
export const urlBlocks = (reg = registry()) => urls(reg).map(block).join('');

/** sitemap.xml: every page of the register, both languages, hreflang-linked, with the date git last saw its source change. */
export function sitemapXml(reg = registry()) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urlBlocks(reg)}</urlset>
`;
}

/** What `--check` compares: a generated file minus the two things the generators do not own, `?v=` stamps (stamp-version) and <lastmod> (git). */
export const unstamp = (s) => s.replace(/\?v=[\w.+-]+/g, '').replace(/<lastmod>[^<]*<\/lastmod>\s*/g, '');

export { detailUrl };
