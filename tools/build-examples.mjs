#!/usr/bin/env node
// build-examples — everything that reads examples/catalog.json (the one list of the examples).
//
//   node tools/build-examples.mjs          # write the files below
//   node tools/build-examples.mjs --check  # exit 1 if any of them is stale
//
// Writes:
//   examples/index.html, zh/examples/index.html   the examples by route (tools/examples/page.mjs renderIndex)
//   p5/index.html, zh/p5/index.html               docs/p5.md and docs/zh/p5.md in the site's frame (p5/oav-p5.js is never touched)
//   changelog/index.html, zh/changelog/index.html docs/changelog.md and docs/zh/changelog.md in the same frame
//   examples/NN-*/index.html                      three marked regions, the rest of each page is hand-written and untouched:
//       <!-- oav:head -->…<!-- /oav:head -->       title, description, canonical, Open Graph, JSON-LD (replaces the page's own charset/viewport/title/description/canonical)
//       <!-- oav:guide -->…<!-- /oav:guide -->     the guide card (description, three things to try, needs, lines to read, next) + assets/examples/guide.js
//       <!-- oav:next -->…<!-- /oav:next -->       example 15 only (it explains itself): the link to the next example
//   README.md                                      <!--gen:NAME--> blocks and the facts block (tools/examples/readme.mjs)
//   docs/agents.md, docs/zh/agents.md, docs/packages.md, docs/zh/packages.md   the next example number and the package count, from the facts
//   docs/introduction.md, docs/zh/introduction.md                              the number of examples, from the facts
//   sitemap.xml                                    the one file every build-*.mjs writes
//
// Like the other generators this is a site build, not a framework build step; --check ignores ?v= stamps
// (tools/stamp-version.mjs adds them to the guide's css/js links and leaves the regions otherwise alone).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderIndex, renderP5, renderChangelog, exampleHead, exampleGuide, exampleNext } from './examples/page.mjs';
import { readmeBlocks } from './examples/readme.mjs';
import { EXAMPLES } from './examples/catalog.mjs';
import { STRINGS } from './examples/strings.mjs';
import { shapeDiff } from './build-home.mjs';
import { sitemapXml, unstamp } from './site/pages.mjs';
import { getFacts, applyBlocks, applyReadmeBlock, enWords, zhWords, cap } from './site/facts.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => { try { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); } catch { return null; } };

export const REGIONS = {
  head: ['<!-- oav:head -->', '<!-- /oav:head -->'],
  guide: ['<!-- oav:guide -->', '<!-- /oav:guide -->'],
  next: ['<!-- oav:next -->', '<!-- /oav:next -->'],
};
const regionRe = (m) => new RegExp(`${m[0]}[\\s\\S]*?${m[1].replace(/\//g, '\\/')}\\n?`);
const block = (m, inner) => `${m[0]}\n${inner}\n${m[1]}\n`;

/** What the page's own <head> said before the head region took it over: one line each, dropped from outside the region. */
const HEAD_CRUFT = [/^\s*<meta charset="[^"]*">\s*$/, /^\s*<meta name="viewport"[^>]*>\s*$/, /^\s*<title>[^<]*<\/title>\s*$/, /^\s*<meta name="description"[^>]*>\s*$/, /^\s*<link rel="canonical"[^>]*>\s*$/, /^\s*<link rel="icon" href="data:,">\s*$/];

/** One example page with its regions written (idempotent: running it on its own output changes nothing). */
export function patchExample(html, e) {
  const hasGuide = e.guide !== false;
  // 1. <head>: lift the region out, drop what it replaces, put the region back first
  html = html.replace(/<head>\n([\s\S]*?)<\/head>/, (m, head) => {
    const rest = head.replace(regionRe(REGIONS.head), '').split('\n').filter((l) => !HEAD_CRUFT.some((re) => re.test(l))).join('\n');
    return `<head>\n${block(REGIONS.head, exampleHead(e))}${rest}</head>`;
  });
  // 2. <body>: the guide card first thing in the body (it is position: fixed, so it takes no layout space); example 15: the next link before its footer
  for (const k of ['guide', 'next']) html = html.replace(regionRe(REGIONS[k]), '');
  if (hasGuide) html = html.replace(/(<body[^>]*>\n)/, (m) => m + block(REGIONS.guide, exampleGuide(e)));
  else html = html.replace(/(<footer)/, (m) => block(REGIONS.next, exampleNext(e)) + m);
  return html;
}

// ---------------------------------------------------------------------------- facts written into the docs sources
/** The next example number, the package count and the example count, as literal text in the Markdown (so GitHub, the MCP server and llms-full read the same). */
export function applyDocsFacts(rel, text, f = getFacts()) {
  if (/agents\.md$/.test(rel)) return text.replace(/(Create examples\/)\d\d(-<name>\/)/, `$1${f.nextExampleNumber}$2`);
  if (rel === 'docs/introduction.md') return text.replace(/(a live instrument and the\s+)[a-z]+(?:-[a-z]+)?( example works)/, `$1${enWords(f.exampleCount)}$2`);
  if (rel === 'docs/zh/introduction.md') return text.replace(/(還有)[一二三四五六七八九十]+(件範例作品)/, `$1${zhWords(f.exampleCount)}$2`);
  if (rel === 'docs/packages.md') return text.replace(/^[A-Z][a-z]+(?:-[a-z]+)? packages live in/m, `${cap(enWords(f.packageCount))} packages live in`);
  if (rel === 'docs/zh/packages.md') return text.replace(/^[一二三四五六七八九十]+個套件放在/m, `${zhWords(f.packageCount)}個套件放在`);
  return text;
}
export const DOCS_WITH_FACTS = ['docs/agents.md', 'docs/zh/agents.md', 'docs/packages.md', 'docs/zh/packages.md', 'docs/introduction.md', 'docs/zh/introduction.md'];

/** Every file this generator owns: { rel: content }. */
export function buildAll() {
  const diff = shapeDiff(STRINGS.en, STRINGS.zh).filter((d) => !/index\.(title|h1|description)/.test(d));
  if (diff.length) throw new Error('examples string tables differ in shape:\n  ' + diff.join('\n  '));
  const files = {
    'examples/index.html': renderIndex('en'),
    'zh/examples/index.html': renderIndex('zh'),
    'p5/index.html': renderP5('en'),
    'zh/p5/index.html': renderP5('zh'),
    'changelog/index.html': renderChangelog('en'),
    'zh/changelog/index.html': renderChangelog('zh'),
  };
  for (const e of EXAMPLES) {
    const rel = `${e.dir}index.html`;
    const cur = read(rel);
    if (cur === null) throw new Error(`catalog lists ${e.id} but ${rel} does not exist`);
    files[rel] = patchExample(cur, e);
  }
  const f = getFacts({ fresh: true });
  files['README.md'] = applyReadmeBlock(applyBlocks(read('README.md'), readmeBlocks(f)), f);
  for (const rel of DOCS_WITH_FACTS) files[rel] = applyDocsFacts(rel, read(rel), f);
  files['sitemap.xml'] = sitemapXml();
  return files;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes('--check');
  const files = buildAll();
  const stale = [];
  let n = 0;
  for (const [rel, out] of Object.entries(files)) {
    const cur = read(rel);
    if (check) { if (cur === null || unstamp(cur) !== unstamp(out)) stale.push(rel); continue; }
    if (cur === out) continue;
    // a regenerated example page keeps the ?v= stamps stamp-version put on its module urls
    fs.mkdirSync(path.dirname(path.join(ROOT, rel)), { recursive: true });
    fs.writeFileSync(path.join(ROOT, rel), out);
    n++;
    console.log('wrote', rel);
  }
  if (check) {
    if (stale.length) { console.error('stale (run node tools/build-examples.mjs):\n  ' + stale.join('\n  ')); process.exit(1); }
    console.log(`✅ examples up to date (${EXAMPLES.length} example pages, /examples/ ×2, /p5/ ×2, /changelog/ ×2, README, docs facts, sitemap.xml)`);
  } else console.log(`${n} file(s) written, ${Object.keys(files).length - n} unchanged`);
}
