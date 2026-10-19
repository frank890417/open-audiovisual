// scan — the public surface of oav-p5 and of every package, READ FROM THE CODE.
//
//   import { scanAll } from './scan.mjs';
//   const surface = await scanAll();     // { p5: {...}, packages: [...], mcp: [...] }
//
// The reference page (tools/build-reference.mjs) is made from two things: what is true of the code, which this
// file reads every time it runs, and what a person has to write (a sentence, an example), which lives in
// tools/reference/entries/. A name the code has and the entries lack is a red test (tests/reference.test.js);
// so is an entry for a name the code no longer has. Nothing here is typed by hand:
//
//   oav-p5      p5/oav-p5.js is run in a bare context (no page, no p5): every global it installs, every member of
//               OAVp5 (one level of namespaces), and, read from the text, the callbacks a sketch may define
//               (the EVENTS / SKETCH_FNS lists and the places it calls the sketch) and the options (opt('x', …)).
//   packages    every entry point in a package's package.json "exports" is imported; each exported name is a public
//               name. For each: class | function | constant, the parameter list as written, the first sentence of
//               the comment above it, the file and line (a link to the source), and for a class its public members.
//   mcp         packages/mcp/server.js starts a server when imported, so its public names (the tools) are read from
//               the TOOLS table in its text.
//
// Zero dependencies; Node's own vm and import().

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(ROOT, rel));

/** A `?v=abc1234` stamp (tools/stamp-version.mjs) is a cache-buster, not content: it never reaches the page. */
export const noStamp = (s) => String(s).replace(/\?v=[\w.+-]+/g, '');

// ---------------------------------------------------------------------------- text helpers
/** The comment block that ends right above line `at` (1-based) of `lines`, as one string. '' if there is none. */
export function commentAbove(lines, at) {
  let i = at - 2;                                   // the line above `at`
  const out = [];
  while (i >= 0 && /^\s*$/.test(lines[i]) && false) i--;
  if (i >= 0 && /\*\/\s*$/.test(lines[i])) {      // a /** … */ block
    let j = i;
    while (j >= 0 && !/\/\*/.test(lines[j])) j--;
    for (let k = j; k <= i; k++) out.push(lines[k].replace(/^\s*\/\*+\s?/, '').replace(/\s*\*+\/\s*$/, '').replace(/^\s*\*\s?/, ''));
  } else {
    while (i >= 0 && /^\s*\/\/(?!\/)/.test(lines[i])) { out.unshift(lines[i].replace(/^\s*\/\/\s?/, '')); i--; }
  }
  return out.filter((l) => !/^\s*@/.test(l) || out.length === 1).join(' ').replace(/\s+/g, ' ').trim();
}

/** First sentence of a comment, without tags, links to stamps or runs of markup. */
export function firstSentence(text, max = 220) {
  const t = noStamp(String(text || '')).replace(/@\w+.*$/, '').replace(/\s+/g, ' ').trim();
  if (!t) return '';
  const m = /^(.+?[.!?])(\s|$)/.exec(t);
  const s = (m ? m[1] : t);
  return s.length > max ? s.slice(0, max - 1).replace(/\s+\S*$/, '') + '…' : s;
}

/** The text of a balanced (...) that starts at index `open` of `s` (which must be "("), without the outer parens. */
export function balanced(s, open) {
  let depth = 0, q = null;
  for (let i = open; i < s.length; i++) {
    const c = s[i];
    if (q) { if (c === '\\') i++; else if (c === q) q = null; continue; }
    if (c === '"' || c === "'" || c === '`') { q = c; continue; }
    if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') { depth--; if (depth === 0) return s.slice(open + 1, i); }
  }
  return null;
}

/** "{ a = 1, b }" or "a, b = 2" collapsed to one line. */
const oneLine = (s) => noStamp(s).replace(/\s*\n\s*/g, ' ').replace(/\s+/g, ' ').replace(/\(\s+/g, '(').replace(/\s+\)/g, ')').trim();

// ---------------------------------------------------------------------------- oav-p5
const P5_FILE = 'p5/oav-p5.js';

/** The names a bare page ends up with after oav-p5.js has run, and the shape of OAVp5. */
function runP5() {
  const src = read(P5_FILE);
  const win = { console: { info() {}, warn() {}, error() {}, log() {} }, navigator: {}, location: { search: '' }, URL, URLSearchParams, Promise, setTimeout, clearTimeout, setInterval, clearInterval };
  win.window = win; win.globalThis = win;
  const before = new Set(Object.getOwnPropertyNames(win));
  vm.runInNewContext(src, win);
  const added = Object.getOwnPropertyNames(win).filter((k) => !before.has(k));
  const globals = added.map((name) => {
    const d = Object.getOwnPropertyDescriptor(win, name);
    const v = d.get ? undefined : d.value;
    const type = d.get ? 'getter' : Array.isArray(v) ? 'array' : v === null ? 'null' : typeof v;
    return { name, type, getter: !!d.get, initial: d.get ? undefined : (typeof v === 'function' || typeof v === 'object' ? undefined : v),
      params: typeof v === 'function' ? paramsOf(Function.prototype.toString.call(v), false) : undefined };
  });
  return { win, src, globals };
}

const typeOf = (v) => (Array.isArray(v) ? 'array' : v === null ? 'null' : typeof v);

/** 1-based line numbers of the code lines (not comment lines) where `re` matches first; 0 if nowhere. */
function firstCodeLine(lines, re, from = 0) {
  for (let i = from; i < lines.length; i++) {
    if (/^\s*(\/\/|\*|\/\*)/.test(lines[i])) continue;
    if (re.test(lines[i])) return i + 1;
  }
  return 0;
}

/** Best-effort line of a name in oav-p5.js, for the "source" link. Never an invented name: a miss falls back to the header. */
function p5Line(lines, name) {
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const tries = [
    new RegExp(`\\bFUNCS\\.${esc}\\s*=`), new RegExp(`\\bmicName\\('${esc}'`), new RegExp(`^\\s*function ${esc}\\s*\\(`),
    new RegExp(`\\bGLOBALS\\b.*\\b${esc}:`), new RegExp(`^\\s{4}${esc}:\\s*function`), new RegExp(`^\\s*${esc}:\\s*function`),
    new RegExp(`^\\s*(var|let|const)\\s+${esc}\\b`),
  ];
  for (const re of tries) { const n = firstCodeLine(lines, re); if (n) return n; }
  const n = firstCodeLine(lines, new RegExp(`\\b${esc}\\b`));
  return n || 1;
}

/** Where `OAVp5.<ns>.<key>` is written: inside the namespace's object literal. Falls back to the namespace line. */
function memberLine(lines, ns, key) {
  const attach = firstCodeLine(lines, new RegExp(`^\\s*midi\\.${ns}\\s*=\\s*(\\w+)\\s*;`));
  const m = attach ? new RegExp(`^\\s*midi\\.${ns}\\s*=\\s*(\\w+)\\s*;`).exec(lines[attach - 1]) : null;
  let start = 0;
  if (m) start = firstCodeLine(lines, new RegExp(`^\\s*var ${m[1]}\\s*=\\s*\\{`)) || 0;
  else start = firstCodeLine(lines, new RegExp(`^\\s*midi\\.${ns}\\s*=\\s*\\{`)) || 0;
  if (!start) return 0;
  const esc = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`^\\s*(?:/\\*\\*.*?\\*/\\s*)?(?:get\\s+|set\\s+)?${esc}\\s*[:(]`);
  const loose = new RegExp(`[{,]\\s*(?:get\\s+|set\\s+)?${esc}\\s*:|^\\s+(?:get\\s+|set\\s+)?${esc}\\s*\\(`);
  const end = attach || start + 150;
  for (let i = start; i < Math.min(lines.length, end); i++) if (re.test(lines[i])) return i + 1;
  for (let i = start; i < Math.min(lines.length, end); i++) if (!/^\s*(\/\/|\*|\/\*)/.test(lines[i]) && loose.test(lines[i])) return i + 1;
  // methods added after the literal: ns.key = function
  const after = firstCodeLine(lines, new RegExp(`\\b(?:${m ? m[1] : ns})\\.${esc}\\s*=`));
  return after || start;
}

/** oav-p5.js, read: globals, callbacks, members of OAVp5 (and one level below), options. */
export function scanP5() {
  const { win, src, globals } = runP5();
  const lines = src.split('\n');
  const o = win.OAVp5;

  // callbacks: the lists the file itself keeps (EVENTS, SKETCH_FNS) plus every name it calls the sketch with
  const cbs = new Set();
  const list = (re) => { const m = re.exec(src); return m ? [...m[1].matchAll(/'(\w+)'/g)].map((x) => x[1]) : []; };
  list(/var EVENTS = \[([^\]]*)\]/).forEach((n) => cbs.add(n));
  const sk = /var SKETCH_FNS = \{([^}]*)\}/.exec(src);
  if (sk) [...sk[1].matchAll(/(\w+):\s*1/g)].forEach((m) => cbs.add(m[1]));
  [...src.matchAll(/\bcallSketch\('(\w+)'/g)].forEach((m) => cbs.add(m[1]));
  [...src.matchAll(/\bdrumEmit\('\w+',\s*'(\w+)'/g)].forEach((m) => cbs.add(m[1]));
  const micCbs = /var micCbs = \{([^}]*)\}/.exec(src);
  if (micCbs) [...micCbs[1].matchAll(/:\s*'(\w+)'/g)].forEach((m) => cbs.add(m[1]));
  const callbacks = [...cbs].sort().map((name) => ({ name, line: firstCodeLine(lines, new RegExp(`'${name}'`)) || p5Line(lines, name) }));

  // options: every opt('key', default) in the file
  const seen = new Map();
  lines.forEach((l, i) => {
    if (/^\s*(\/\/|\*|\/\*)/.test(l)) return;
    for (const m of l.matchAll(/\bopt\('(\w+)'\s*,\s*([^)]*?)\)/g)) if (!seen.has(m[1])) seen.set(m[1], { name: m[1], dflt: m[2].replace(/\s+/g, ' ').slice(0, 60), line: i + 1 });
  });
  const options = [...seen.values()];

  // members of OAVp5: public (no leading underscore) own keys; objects one level further (options are listed on their own)
  const members = [];
  const isNum = (k) => /^\d+$/.test(k);
  for (const key of Object.keys(o)) {
    if (key.startsWith('_') || key === 'options') continue;
    const v = o[key];
    const type = typeOf(v);
    members.push({ path: `OAVp5.${key}`, ns: null, key, type, line: memberLine(lines, '', key) || p5Line(lines, key), params: type === 'function' ? paramsOf(Function.prototype.toString.call(v), false) : undefined });
    if (type === 'object' && key !== 'note' && key !== 'cc' && key !== 'last' && key !== 'devices') {
      for (const k2 of Object.keys(v)) {
        if (k2.startsWith('_') || isNum(k2)) continue;
        const t2 = typeOf(v[k2]);
        members.push({ path: `OAVp5.${key}.${k2}`, ns: key, key: k2, type: t2, line: memberLine(lines, key, k2), params: t2 === 'function' ? paramsOf(Function.prototype.toString.call(v[k2]), false) : undefined });
      }
    }
  }
  // the top-level members are written inside `var midi = {`
  const midiStart = firstCodeLine(lines, /^\s*var midi = \{/);
  for (const m of members) if (m.ns === null) {
    const re = new RegExp(`^\\s*(?:/\\*\\*.*?\\*/\\s*)?${m.key}\\s*[:(]`);
    let n = 0;
    for (let i = midiStart; i < Math.min(lines.length, midiStart + 60); i++) if (re.test(lines[i])) { n = i + 1; break; }
    if (!n) n = firstCodeLine(lines, new RegExp(`\\bmidi\\.${m.key}\\s*=`));
    m.line = n || midiStart;
  }
  // a member written on one line inside its parent literal (panel: { open: …, close: … }) has no line of its own: the parent's
  for (const m of members) if (m.ns && !m.line) m.line = (members.find((p) => p.path === `OAVp5.${m.ns}`) || {}).line || 1;
  const g = globals.map((x) => ({ ...x, line: p5Line(lines, x.name) }));
  return { file: P5_FILE, version: /OAV_P5_VERSION = '([\d.]+)'/.exec(src)[1], globals: g, callbacks, options, members };
}

// ---------------------------------------------------------------------------- packages
/** Package directories in alphabetical order. */
export function packageDirs() {
  return fs.readdirSync(path.join(ROOT, 'packages'), { withFileTypes: true })
    .filter((e) => e.isDirectory() && exists(`packages/${e.name}/package.json`)).map((e) => e.name).sort();
}

/** Packages that cannot be imported to be read: importing them starts a server. Their names are read from the text. */
const NO_IMPORT = new Set(['mcp']);
/** Entry points that are node-side programs, not an API of the package (they run something when imported). */
const SKIP_ENTRY = new Set(['mcp:.']);

/** [{ subpath: '.' | './element' …, file: 'index.js' }] from package.json "exports", wildcards (data folders) left out. */
export function entryPoints(dir) {
  const pj = JSON.parse(read(`packages/${dir}/package.json`));
  const ex = pj.exports && typeof pj.exports === 'object' ? pj.exports : { '.': pj.main || 'index.js' };
  const out = [];
  for (const [sub, target] of Object.entries(ex)) {
    if (!sub.startsWith('.') || sub.includes('*')) continue;
    const t = typeof target === 'string' ? target : target.import || target.default;
    if (!t || !/\.m?js$/.test(t)) continue;
    // "./element" and "./element.js" are one door spelled twice: keep the shorter spelling
    if (sub !== '.' && sub.endsWith('.js') && ex[sub.replace(/\.js$/, '')] === target) continue;
    out.push({ subpath: sub, file: t.replace(/^\.\//, '') });
  }
  return out;
}

/** Find where `name` is defined, following `export { … } from` and `export *` chains. → { file, line } or null. */
export function findDefinition(rel, name, seen = new Set()) {
  const key = rel + '#' + name;
  if (seen.has(key) || !exists(rel)) return null;
  seen.add(key);
  const src = read(rel);
  const lines = src.split('\n');
  const esc = name.replace(/[$]/g, '\\$');
  // export [async] function [*] NAME / class NAME / const|let|var NAME
  const direct = new RegExp(`^export\\s+(?:default\\s+)?(?:async\\s+)?(?:function\\s*\\*?|class|const|let|var)\\s+${esc}\\b`, 'm').exec(src);
  if (direct) return { file: rel, line: src.slice(0, direct.index).split('\n').length };
  // export { a, b as c } from './x.js'  (several lines allowed)
  for (const m of src.matchAll(/^export\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/gm)) {
    for (const part of m[1].split(',')) {
      const bits = part.trim().split(/\s+as\s+/);
      const orig = bits[0], exported = bits[1] || bits[0];
      if (exported !== name) continue;
      const target = path.posix.normalize(path.posix.join(path.posix.dirname(rel), noStamp(m[2])));
      const hit = findDefinition(target, orig, seen);
      if (hit) return hit;
    }
  }
  for (const m of src.matchAll(/^export\s*\*\s*from\s*['"]([^'"]+)['"]/gm)) {
    const target = path.posix.normalize(path.posix.join(path.posix.dirname(rel), noStamp(m[1])));
    const hit = findDefinition(target, name, seen);
    if (hit) return hit;
  }
  // export { NAME }  → a local declaration of NAME
  for (const m of src.matchAll(/^export\s*\{([^}]*)\}\s*;?\s*$/gm)) {
    for (const part of m[1].split(',')) {
      const bits = part.trim().split(/\s+as\s+/);
      if ((bits[1] || bits[0]) !== name) continue;
      const local = new RegExp(`^(?:async\\s+)?(?:function\\s*\\*?|class|const|let|var)\\s+${bits[0]}\\b`, 'm').exec(src);
      if (local) return { file: rel, line: src.slice(0, local.index).split('\n').length };
      // … or a name this file imported: follow the import
      for (const im of src.matchAll(/^import\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/gm)) {
        for (const ipart of im[1].split(',')) {
          const ib = ipart.trim().split(/\s+as\s+/);
          if ((ib[1] || ib[0]) !== bits[0]) continue;
          const target = path.posix.normalize(path.posix.join(path.posix.dirname(rel), noStamp(im[2])));
          const hit = findDefinition(target, ib[0], seen);
          if (hit) return hit;
        }
      }
    }
  }
  return null;
}

/** Parameter text of a function or class constructor, as written. */
/**
 * The source with its comments taken out (strings and template literals are left alone, so a URL with // in it stays). A comment
 * that holds an apostrophe or the word "constructor (" must not be mistaken for code when the parameters are looked for.
 */
export function stripComments(src) {
  let out = '', i = 0, q = null;
  while (i < src.length) {
    const c = src[i], n = src[i + 1];
    if (q) { out += c; if (c === '\\') { out += src[i + 1] || ''; i += 2; continue; } if (c === q) q = null; i++; continue; }
    if (c === '"' || c === "'" || c === '`') { q = c; out += c; i++; continue; }
    if (c === '\\') { out += c + (src[i + 1] || ''); i += 2; continue; }               // an escaped character, e.g. the \/ inside a regular expression
    if (c === '/' && n === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
    if (c === '/' && n === '*') { i += 2; while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++; i += 2; out += ' '; continue; }
    out += c; i++;
  }
  return out;
}

function paramsOf(fnSrc, isClass) {
  fnSrc = stripComments(fnSrc);
  let at;
  if (isClass) {
    const m = /\bconstructor\s*\(/.exec(fnSrc);
    if (!m) return '';
    at = m.index + m[0].length - 1;
  } else {
    // "async function* name(…)" | "function name(…)" | "(a, b) =>" | "a =>" | "async (…) =>"
    const m = /^(?:async\s+)?(?:function\s*\*?\s*[\w$]*\s*)?\(/.exec(fnSrc);
    if (m) at = m[0].length - 1;
    else { const a = /^(?:async\s+)?([\w$]+)\s*=>/.exec(fnSrc); return a ? a[1] : ''; }
  }
  const inner = balanced(fnSrc, at);
  return inner == null ? '' : oneLine(inner);
}

/** Public members of a class, from the class itself (names) and its text (parameters, the comment above). */
function classMembers(cls, defLine, srcLines) {
  const text = Function.prototype.toString.call(cls);
  const own = text.split('\n');
  const members = [];
  const find = (name, kind) => {
    const esc = name.replace(/[$]/g, '\\$');
    const re = new RegExp(`^\\s+${kind === 'static' ? 'static\\s+(?:async\\s+)?' : '(?:async\\s+)?'}(?:get\\s+|set\\s+)?\\*?${esc}\\s*\\(`);
    for (let i = 1; i < own.length; i++) if (re.test(own[i])) return i;
    return -1;
  };
  const add = (name, desc, isStatic) => {
    if (name.startsWith('_') || name === 'constructor') return;
    const kind = isStatic ? 'static' : 'inst';
    const i = find(name, kind);
    const line = i >= 0 ? defLine + i : defLine;
    let sig = '', doc = '';
    if (i >= 0) {
      const decl = own[i];
      const open = decl.indexOf('(', decl.indexOf(name));
      const rest = stripComments(own.slice(i).join('\n'));
      const inner = balanced(rest, rest.indexOf('(', rest.indexOf(name)));
      sig = inner == null ? '' : oneLine(inner);
      doc = firstSentence(commentAbove(own, i + 1));
      void open;
    }
    const isMethod = !!desc && typeof desc.value === 'function';
    members.push({ name, member: isStatic ? 'static ' + (isMethod ? 'method' : 'property') : desc && desc.get ? 'getter' : isMethod ? 'method' : 'property', sig: isMethod ? sig : '', doc, line });
  };
  for (const n of Object.getOwnPropertyNames(cls.prototype)) add(n, Object.getOwnPropertyDescriptor(cls.prototype, n), false);
  for (const n of Object.getOwnPropertyNames(cls)) if (!['length', 'name', 'prototype', 'caller', 'arguments'].includes(n)) add(n, Object.getOwnPropertyDescriptor(cls, n), true);
  void srcLines;
  return members;
}

/** Preview of a constant for the page: short strings and numbers verbatim, structures by their shape. */
function previewOf(v) {
  if (typeof v === 'string') return v.length > 80 ? JSON.stringify(v.slice(0, 77) + '…') : JSON.stringify(v);
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) return `array, ${v.length} items`;
  if (v && typeof v === 'object') { const k = Object.keys(v); return `object, ${k.length} keys`; }
  return '';
}

/** What one exported value is, as the page shows it. */
function describeExport(name, v, def) {
  const lines = def ? read(def.file).split('\n') : [];
  const doc = def ? firstSentence(commentAbove(lines, def.line)) : '';
  if (typeof v === 'function') {
    const text = Function.prototype.toString.call(v);
    const isClass = /^class[\s{]/.test(text);
    return {
      kind: isClass ? 'class' : 'function', params: paramsOf(text, isClass), doc,
      members: isClass ? classMembers(v, def ? def.line : 1, lines) : [],
      async: /^async\s/.test(text), generator: /^(async\s+)?function\s*\*/.test(text),
    };
  }
  return { kind: 'constant', valueType: typeOf(v), preview: previewOf(v), doc };
}

/** Every exported name of every package, one record per (package, name). */
export async function scanPackages() {
  const out = [];
  for (const dir of packageDirs()) {
    const pkgName = JSON.parse(read(`packages/${dir}/package.json`)).name;
    if (NO_IMPORT.has(dir)) continue;
    const byName = new Map();                       // name → record (the first, shortest entry point wins; the others are "also from")
    const points = entryPoints(dir).filter((p) => !SKIP_ENTRY.has(`${dir}:${p.subpath}`));
    // shortest specifier first: '.' before './element' before './element.js'
    points.sort((a, b) => a.subpath.length - b.subpath.length);
    for (const p of points) {
      const rel = `packages/${dir}/${p.file}`;
      const mod = await import(pathToFileURL(path.join(ROOT, rel)).href);
      const spec = p.subpath === '.' ? pkgName : pkgName + p.subpath.slice(1);
      for (const name of Object.keys(mod)) {
        if (name === 'default') continue;
        const def = findDefinition(rel, name) || { file: rel, line: 1, guessed: true };
        const prior = byName.get(name);
        if (prior) {
          // one thing reached by two doors (the index re-exports './embed.js?v=…', the door imports './embed.js': two module
          // instances, so === says no): the same definition is the same name; a different one is two things under one name
          if (prior.def.file !== def.file || prior.def.line !== def.line) prior.conflict = (prior.conflict || []).concat(spec);
          else prior.alsoFrom.push(spec);
          continue;
        }
        byName.set(name, { pkg: pkgName, dir, name, spec, alsoFrom: [], def, ...describeExport(name, mod[name], def) });
      }
    }
    for (const r of byName.values()) out.push(r);
  }
  return out;
}

// ---------------------------------------------------------------------------- mcp
/** The tools of the MCP server, read from the TOOLS table in its text. */
export function scanMcp() {
  const rel = 'packages/mcp/server.js';
  const src = read(rel);
  const lines = src.split('\n');
  const start = lines.findIndex((l) => /^const TOOLS = \[/.test(l));
  if (start < 0) throw new Error(`${rel}: no "const TOOLS = [" table`);
  const out = [];
  for (let i = start + 1; i < lines.length && !/^\];/.test(lines[i]); i++) {
    const m = /^ {4}name: '(\w+)',/.exec(lines[i]);
    if (m) {
      const d = /^ {4}description: (['`])(.*)\1,?$/.exec(lines[i + 1] || '');
      out.push({ pkg: '@openav/mcp', dir: 'mcp', name: m[1], kind: 'tool', def: { file: rel, line: i + 1 }, doc: d ? firstSentence(d[2].replace(/\\'/g, "'")) : '' });
    }
  }
  return out;
}

/** Everything. */
export async function scanAll() {
  return { p5: scanP5(), packages: await scanPackages(), mcp: scanMcp() };
}
