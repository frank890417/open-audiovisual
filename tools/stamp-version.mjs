#!/usr/bin/env node
// stamp-version — cache-bust module URLs with the current commit.
//
// Why this exists: GitHub Pages serves .js with `cache-control: max-age=14400`
// (4 hours) while HTML expires in 10 minutes. Without a version stamp a visitor
// gets NEW html + OLD javascript for hours after a deploy — the page looks
// unchanged and nothing in the console explains why. (Observed 2026-08-25.)
//
//   node tools/stamp-version.mjs          # stamp with current HEAD
//   node tools/stamp-version.mjs --check  # exit 1 if anything is unstamped/stale
//
// Deliberately narrow: only real module URLs are touched —
//   • <script src="./main.js">                 (html)
//   • import-map values "…/packages/x/index.js" (html)
//   • import … from './rel.js' / import('./rel.js')  (js, relative paths only)
// Comments, JSDoc types, filename strings and CDN/bare specifiers stay untouched;
// an earlier greedy version stamped .test.js inside the MCP server and broke it.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const check = process.argv.includes('--check');
const ver = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();

const stampUrl = (url) => url.replace(/(\?v=[^"'\s]*)?$/, `?v=${ver}`);
const isLocal = (url) => /^\.{1,2}\//.test(url);

function stampHtml(src) {
  return src
    .replace(/(<script[^>]*\ssrc=")([^"]+\.js)(\?v=[^"]*)?(")/g,
      (m, a, url, _v, z) => isLocal(url) ? a + stampUrl(url) + z : m)
    // import-map values: "…/packages/foo/index.js"
    .replace(/("(?:\.\.\/)+packages\/[\w./-]+\.js)(\?v=[^"]*)?"/g, (m, url) => `${stampUrl(url.slice(1))}"`.replace(/^/, '"'));
}

function stampJs(src) {
  // only import statements / dynamic import with a RELATIVE path
  return src
    .replace(/(\bfrom\s+['"])(\.{1,2}\/[\w./-]+\.js)(\?v=[^'"]*)?(['"])/g,
      (m, a, url, _v, q) => a + stampUrl(url) + q)
    .replace(/(\bimport\(\s*['"])(\.{1,2}\/[\w./-]+\.js)(\?v=[^'"]*)?(['"])/g,
      (m, a, url, _v, q) => a + stampUrl(url) + q);
}

const files = [];
const walk = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(html|js)$/.test(e.name)) files.push(p);
  }
};
walk(path.join(ROOT, 'examples'));
walk(path.join(ROOT, 'packages'));
files.push(path.join(ROOT, 'index.html'));

let changed = 0; const stale = [];
for (const f of files) {
  if (f.includes(`${path.sep}mcp${path.sep}`) || f.includes(`${path.sep}bridges${path.sep}`) ||
      /server\.js$|osc-bridge\.js$/.test(f)) continue;         // node-side code: never fetched by a browser
  const src = fs.readFileSync(f, 'utf8');
  const out = f.endsWith('.html') ? stampHtml(src) : stampJs(src);
  if (out !== src) {
    if (check) stale.push(path.relative(ROOT, f));
    else { fs.writeFileSync(f, out); changed++; }
  }
}

if (check) {
  if (stale.length) { console.error(`unstamped/stale (want v=${ver}):\n  ` + stale.join('\n  ')); process.exit(1); }
  console.log(`✅ all module urls stamped v=${ver}`);
} else {
  console.log(`stamped ${changed} file(s) with v=${ver}`);
}
