#!/usr/bin/env node
// build-reference — the API reference: /docs/reference/ (en), /zh/docs/reference/ (繁中) and docs/reference/reference.json,
// and the one-page cheat sheet built from the same entries: /docs/cheatsheet/ and /zh/docs/cheatsheet/ (tools/reference/cheatsheet.mjs).
//
//   node tools/build-reference.mjs            # write the three files (and sitemap.xml); exit 1 if a gate is red
//   node tools/build-reference.mjs --check    # exit 1 if a committed file is stale or a gate is red
//   node tools/build-reference.mjs --missing  # print a stub for every public name that has no entry (copy, then write the words)
//   node tools/build-reference.mjs --problems # only run the gates and print what is wrong
//   node tools/build-reference.mjs --init-ledger   # first time only: list every undocumented name in the ledger
//   node tools/build-reference.mjs --prune-ledger  # drop the names that have an entry now (the only edit the ledger accepts)
//
// What is on the page comes from two places (tools/reference/model.mjs): what the CODE says, read every build by
// tools/reference/scan.mjs (names, kinds, signatures, defaults, source lines, class members), and what a PERSON wrote,
// in p5/reference/*.mjs and packages/<package>/reference.mjs. A name the code has and nobody wrote about, or an entry for a
// name the code no longer has, is a red gate here and in tests/reference.test.js. How to write an entry: AGENTS.md,
// "Documenting a public name". --check ignores ?v= stamps.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { loadModel, toDataset, LEDGER_FILE, P5 } from './reference/model.mjs';
import { renderReferencePage } from './reference/page.mjs';
import { renderCheatsheetPage } from './reference/cheatsheet.mjs';
import { CATEGORIES } from './reference/categories.mjs';
import { SITE, BLOB, pathCtx } from './site/chrome.mjs';
import { shapeDiff } from './build-home.mjs';
import { sitemapXml, unstamp } from './site/pages.mjs';
import en from './reference/en.mjs';
import zh from './reference/zh.mjs';
import homeEn from './home/en.mjs';
import homeZh from './home/zh.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => { try { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); } catch { return null; } };
const hash = (rel) => crypto.createHash('sha1').update(read(rel) || '').digest('hex').slice(0, 8);

export const PAGES = { en: 'docs/reference/index.html', zh: 'zh/docs/reference/index.html' };
export const CHEAT_PAGES = { en: 'docs/cheatsheet/index.html', zh: 'zh/docs/cheatsheet/index.html' };
export const DATASET = 'docs/reference/reference.json';
const STRINGS = { en, zh };
const HOME = { en: homeEn, zh: homeZh };
export const GUIDE_URL = `${BLOB}AGENTS.md#documenting-a-public-name`;

/** Dataset text: one entry per line, so a change to one entry is a change to one line in git. */
export function datasetText(ds) {
  const head = JSON.stringify({ ...ds, entries: undefined }).slice(0, -1);
  return `${head},"entries":[\n${ds.entries.map((e) => JSON.stringify(e)).join(',\n')}\n]}\n`;
}

/** The files, from a model that has already been loaded (and checked). */
export function buildFiles(model) {
  const diff = shapeDiff(en, zh);
  if (diff.length) throw new Error('reference string tables differ in shape:\n  ' + diff.join('\n  '));
  const pkg = JSON.parse(read('package.json'));
  const p5Version = /OAV_P5_VERSION = '([\d.]+)'/.exec(read('p5/oav-p5.js'))[1];
  const assets = { css: hash('assets/reference/reference.css'), js: hash('assets/reference/reference.js'), docsCss: hash('assets/docs/docs.css'), docsJs: hash('assets/docs/docs.js'), cheatCss: hash('assets/reference/cheatsheet.css') };
  const files = {};
  for (const locale of ['en', 'zh']) {
    const c = pathCtx('docs/reference/', locale, { page: 'docs' });
    files[PAGES[locale]] = renderReferencePage(STRINGS[locale], HOME[locale], { c, records: model.records, version: pkg.version, p5Version, assets, guideHref: GUIDE_URL });
    files[CHEAT_PAGES[locale]] = renderCheatsheetPage(STRINGS[locale], HOME[locale], { c: pathCtx('docs/cheatsheet/', locale, { page: 'docs' }), records: model.records, p5Version, assets });
  }
  files[DATASET] = datasetText(toDataset(model, { p5Version, version: pkg.version }));
  return files;
}

/** --missing: a paste-ready stub for each public name without an entry. */
export function stubs(model) {
  const have = new Set(model.authored.map((a) => `${a.ns}::${a.key}`));
  const out = [];
  for (const r of model.records) {
    if (r.entry) continue;
    const it = r.item;
    const where = it.ns === P5 ? 'p5/reference/<area>.mjs' : `packages/${it.pkgDir}/reference.mjs`;
    const cat = r.category;
    const ps = it.params ? `   // the code declares (${it.params})` : '';
    out.push(`// ${where}  ·  ${it.kind}  ·  ${it.src.file}:${it.src.line}${r.ledger ? '  ·  in the ledger' : ''}\n  ${JSON.stringify(r.key)}: {\n    group: ${JSON.stringify(cat)},\n    summary: { en: '', zh: '' },\n    description: [{ en: '', zh: '' }],${ps ? '\n' + ps : ''}\n    examples: [{ code: \`\`, caption: { en: '', zh: '' } }],\n  },`);
  }
  void have;
  return out;
}

function printProblems(problems) {
  for (const p of problems) console.error(`✗ ${p.code}  ${p.msg}`);
  console.error(`\n${problems.length} problem(s) in the reference (the gates are in tests/reference.test.js; how to write an entry: AGENTS.md "Documenting a public name")`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes('--check');
  const model = await loadModel();
  if (process.argv.includes('--missing')) {
    const list = stubs(model);
    process.stdout.write((list.length ? list.join('\n\n') : '// every public name has an entry') + '\n', () => {   // exit only after the pipe has taken it all
      console.error(`${list.length} public name(s) without an entry`);
      process.exit(0);
    });
    await new Promise(() => {});
  }
  if (process.argv.includes('--init-ledger')) {
    if (fs.existsSync(path.join(ROOT, LEDGER_FILE)) && !process.argv.includes('--force')) { console.error(`${LEDGER_FILE} exists: the ledger may only shrink (--force to rewrite it from scratch)`); process.exit(1); }
    const names = model.records.filter((r) => !r.entry).flatMap((r) => [r.uid, ...r.covers.filter((c) => c !== r.key).map((c) => `${r.ns}::${c}`)]);
    fs.writeFileSync(path.join(ROOT, LEDGER_FILE), JSON.stringify({ done: false, names }, null, 1) + '\n');
    console.log(`wrote ${LEDGER_FILE}: ${names.length} names`);
    process.exit(0);
  }
  if (process.argv.includes('--prune-ledger')) {
    const led = JSON.parse(read(LEDGER_FILE));
    const documented = new Set(model.authored.flatMap((a) => [`${a.ns}::${a.key}`, ...((a.entry.aliases || []).map((x) => `${a.ns}::${x}`))]));
    const keep = led.names.filter((n) => !documented.has(n));
    fs.writeFileSync(path.join(ROOT, LEDGER_FILE), JSON.stringify({ ...led, names: keep }, null, 1) + '\n');
    console.log(`ledger: ${led.names.length} → ${keep.length} names`);
    process.exit(0);
  }
  if (model.problems.length) { printProblems(model.problems); process.exit(1); }
  if (process.argv.includes('--problems')) { console.log(`✅ no problems: ${model.items.length} public names, ${model.records.filter((r) => r.entry).length} records with a description, ${model.ledger.names.length} in the ledger`); process.exit(0); }
  const files = { ...buildFiles(model), 'sitemap.xml': sitemapXml() };
  const stale = [];
  for (const [rel, out] of Object.entries(files)) {
    const cur = read(rel);
    if (check) { if (cur === null || unstamp(cur) !== unstamp(out)) stale.push(rel); continue; }
    fs.mkdirSync(path.dirname(path.join(ROOT, rel)), { recursive: true });
    fs.writeFileSync(path.join(ROOT, rel), out);
    console.log('wrote', rel, `(${out.length} bytes)`);
  }
  if (check) {
    if (stale.length) { console.error('stale (run node tools/build-reference.mjs):\n  ' + stale.join('\n  ')); process.exit(1); }
    console.log('✅ reference up to date (en, zh, reference.json, sitemap.xml)');
  }
  void SITE; void CATEGORIES;
  process.exit(0);
}
