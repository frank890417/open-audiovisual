// Which examples use which names, read from the examples' own code, so the "examples that use these names" block at the
// end of /docs/cheatsheet/ and /docs/reference/ follows the code instead of a list kept by hand.
//
//   import { exampleUses, examplesUsing } from '../examples/uses.mjs';
//   examplesUsing({ names: ['micLevel', 'beat'], packages: ['audio'] })   // → catalog entries, best match first
//
//   names      the identifiers of a p5 example's sketch (catalog `sketch`), comments and strings left out, and a name
//              after a dot left out (x.note is not note). A dotted name counts with its prefixes (OAVp5.drums.edit
//              is also OAVp5.drums and OAVp5).
//   packages   what an example's .js files import from @openav/*, and the inputs it asks createShow() for
//              (`modules: { chord: true, hands: … }`: a world gets its packages that way, not by importing them; a key set
//              to false is not counted). A package half the examples or more use (show: every world) says nothing about
//              where to look, so it is left out of the match.
// Examples are ranked by how many of the names and packages they use, then by their place on the path (catalog order).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { EXAMPLES } from './catalog.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/** Every identifier a piece of JavaScript uses as code (not in a comment, not in a string, not after a dot). */
export function identifiers(code) {
  const src = String(code).replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*|'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g, ' ');
  const out = new Set();
  for (const m of src.matchAll(/[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*/g)) {
    if (m.index && src[m.index - 1] === '.') continue;
    const parts = m[0].split('.');
    for (let i = 1; i <= parts.length; i++) out.add(parts.slice(0, i).join('.'));
  }
  return out;
}

/** Code without its comments and strings (a comment that quotes `modules: { remote: true }` is not a show). */
const bare = (code) => String(code).replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*|'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g, ' ');

/** createShow()'s `modules` keys and the package each one starts (packages/show/index.js: modules.hands is a HandTracker of
 *  @openav/pose, and so on; tests/next-step.test.js holds this list to that file). */
export const SHOW_MODULES = { midi: 'midi', keys: 'keys', drums: 'drums', audio: 'audio', chord: 'chord', hands: 'pose', pose: 'pose', leap: 'leap', remote: 'remote', sound: 'sound' };

/** The packages a piece of JavaScript asks createShow() for: the top-level keys of `modules: { … }` that are not false. */
export function showModulesOf(code) {
  const src = bare(code), out = new Set();
  for (const m of src.matchAll(/\bmodules\s*:\s*\{/g)) {
    let depth = 1, i = m.index + m[0].length, body = '';
    for (; i < src.length && depth; i++) { const ch = src[i]; if (ch === '{') depth++; else if (ch === '}') depth--; if (depth === 1 || (depth === 2 && ch === '{')) body += depth === 1 ? ch : ''; }
    for (const k of body.matchAll(/(?:^|[,{\s])([A-Za-z_$][\w$]*)\s*:\s*(false\b)?/g)) if (!k[2] && SHOW_MODULES[k[1]]) out.add(SHOW_MODULES[k[1]]);
  }
  return out;
}

/** The @openav/* packages a piece of JavaScript imports (static or dynamic). */
export function importsOf(code) {
  return new Set([...String(code).matchAll(/\b(?:from\s*|import\s*\(\s*)['"]@openav\/([\w-]+)/g)].map((m) => m[1]));
}

let memo = null;
/** [{ e, names, packages }] for every example of the catalog, in path order. */
export function exampleUses() {
  if (memo) return memo;
  memo = EXAMPLES.map((e) => {
    const js = fs.readdirSync(path.join(ROOT, e.dir)).filter((f) => f.endsWith('.js')).map((f) => read(e.dir + f)).join('\n');
    return { e, names: e.sketch ? identifiers(read(e.sketch)) : new Set(), packages: new Set([...importsOf(js), ...showModulesOf(js)]) };
  });
  return memo;
}

/** The catalog entries that use any of `names` (oav-p5 names) or `packages` (directory names under packages/), best first. */
export function examplesUsing({ names = [], packages = [] } = {}, { max = 4, uses = exampleUses() } = {}) {
  const common = new Set();
  const count = new Map();
  for (const u of uses) for (const p of u.packages) count.set(p, (count.get(p) || 0) + 1);
  for (const [p, n] of count) if (n >= uses.length / 2) common.add(p);
  const want = [...new Set(names)], pk = [...new Set(packages)].filter((p) => !common.has(p));
  return uses
    .map((u, i) => ({ u, i, score: want.filter((n) => u.names.has(n)).length + pk.filter((p) => u.packages.has(p)).length }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .slice(0, max)
    .map((x) => x.u.e);
}
