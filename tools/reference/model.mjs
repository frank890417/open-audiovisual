// model — the API reference as data: what the code says (scan.mjs) joined with what a person wrote
// (p5/reference/*.mjs, packages/<package>/reference.mjs), checked in both directions.
//
//   const model = await loadModel();       // { items, entries, ledger, records, problems }
//
// Vocabulary:
//   item     a public name the code has: { uid, ns, key, kind, … } from scan.mjs
//   entry    what a person wrote about one or more items (their key and `aliases`)
//   ledger   tools/reference/undocumented.json: names still waiting for an entry. It may only shrink; when it says
//            "done": true it must be empty. A name in it is listed on the page with what the code knows, and "no description yet".
//   record   an item with its entry merged in: what the page and reference.json render
//   problem  something a test turns red for: { code: 'G1'…'G9', msg }
//
// Every function after loadModel() is pure (inputs in, problems out), so tests/reference.test.js can drill the gates:
// delete an entry, keep a ghost, lie in the ledger, and watch each one go red.

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { pathToFileURL } from 'node:url';
import { scanAll, ROOT, packageDirs } from './scan.mjs';
import { CATEGORY_IDS, PACKAGE_CATEGORY } from './categories.mjs';

export const P5 = 'oav-p5';
export const REPO_BLOB = 'https://github.com/frank890417/open-audiovisual/blob/main/';
export const LEDGER_FILE = 'tools/reference/undocumented.json';
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(ROOT, rel));

const CJK = /[⺀-⿿぀-ヿ㐀-鿿豈-﫿＀-￯]/;
export const hasCJK = (s) => CJK.test(String(s));
/** The loader line every oav-p5 sketch starts with (the one place it is written; the page and the copy button read it). */
export const LOADER = "document.head.prepend(Object.assign(document.createElement('script'), { src: 'https://openaudiovisual.com/p5/oav-p5.js' }));";

// ---------------------------------------------------------------------------- parameters
/** "{ a = 1, b } = {}, c, d = 2, ...rest" → [{ name, default?, optional, rest?, group? }]; one entry per name the caller can pass. */
export function parseParams(text) {
  const out = [];
  const t = String(text || '').trim();
  if (!t) return out;
  const split = (s) => {
    const parts = []; let depth = 0, q = null, cur = '';
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (q) { cur += c; if (c === '\\') { cur += s[++i]; } else if (c === q) q = null; continue; }
      if (c === '"' || c === "'" || c === '`') { q = c; cur += c; continue; }
      if ('([{'.includes(c)) depth++;
      if (')]}'.includes(c)) depth--;
      if (c === ',' && depth === 0) { parts.push(cur); cur = ''; continue; }
      cur += c;
    }
    if (cur.trim()) parts.push(cur);
    return parts.map((p) => p.trim()).filter(Boolean);
  };
  for (const part of split(t)) {
    if (part.startsWith('...')) { out.push({ name: part.slice(3).trim(), optional: true, rest: true }); continue; }
    if (part.startsWith('{')) {
      // a destructured options object: its keys are what the caller passes
      let depth = 0, end = -1;
      for (let i = 0; i < part.length; i++) { if (part[i] === '{') depth++; if (part[i] === '}') { depth--; if (depth === 0) { end = i; break; } } }
      const inner = part.slice(1, end);
      for (const k of split(inner)) {
        const m = /^([\w$]+)\s*(?::\s*[\w$]+\s*)?(?:=\s*([\s\S]+))?$/.exec(k);
        if (m) out.push({ name: m[1], optional: m[2] !== undefined || true, default: m[2] !== undefined ? m[2].trim() : undefined, group: 'options' });
      }
      continue;
    }
    if (part.startsWith('[')) { out.push({ name: 'array', optional: false }); continue; }
    const m = /^([\w$]+)\s*(?:=\s*([\s\S]+))?$/.exec(part);
    if (m) out.push({ name: m[1], optional: m[2] !== undefined, default: m[2] !== undefined ? m[2].trim() : undefined });
  }
  return out;
}

// ---------------------------------------------------------------------------- items: the public names the code has
const itemUid = (ns, key) => `${ns}::${key}`;

/** Every public name of the scan as an item. (A pure function of the scan result.) */
export function itemsOf(surface) {
  const items = [];
  const p5 = surface.p5;
  const src = (line) => ({ file: p5.file, line });
  for (const g of p5.globals) {
    if (['OAVp5', 'midi', 'oavMidi'].includes(g.name)) {   // one object under three names: the entry for OAVp5 lists the other two as aliases
      items.push({ ns: P5, key: g.name, kind: 'object', src: src(g.line), valueType: 'object' });
      continue;
    }
    items.push({ ns: P5, key: g.name, kind: g.type === 'function' ? 'function' : 'variable', src: src(g.line), params: g.params, valueType: g.type === 'getter' ? 'number' : g.type, initial: g.initial, getter: g.getter });
  }
  for (const c of p5.callbacks) items.push({ ns: P5, key: c.name, kind: 'event', src: src(c.line) });
  for (const o of p5.options) items.push({ ns: P5, key: `option:${o.name}`, kind: 'option', src: src(o.line), name: o.name, dflt: o.dflt });
  for (const m of p5.members) {
    items.push({ ns: P5, key: m.path, kind: m.type === 'function' ? 'function' : (m.type === 'object' ? 'object' : 'variable'), src: src(m.line), params: m.params, valueType: m.type, name: m.path });
  }
  for (const p of surface.packages) {
    items.push({
      ns: p.pkg, key: p.name, kind: p.kind, src: { file: p.def.file, line: p.def.line }, pkgDir: p.dir, spec: p.spec, alsoFrom: p.alsoFrom, params: p.params,
      doc: p.doc, members: p.members, valueType: p.valueType, preview: p.preview, async: p.async, generator: p.generator, conflict: p.conflict,
    });
  }
  for (const t of surface.mcp) items.push({ ns: t.pkg, key: t.name, kind: 'tool', src: { file: t.def.file, line: t.def.line }, pkgDir: t.dir, doc: t.doc });
  for (const it of items) { it.uid = itemUid(it.ns, it.key); it.name = it.name || it.key; }
  return items;
}

// ---------------------------------------------------------------------------- authored entries
/** Load every sidecar: [{ ns, key, file, entry }] and the problems met on the way. */
export async function loadAuthored() {
  const files = [];
  if (exists('p5/reference')) for (const f of fs.readdirSync(path.join(ROOT, 'p5/reference')).filter((x) => x.endsWith('.mjs')).sort()) files.push({ ns: P5, file: `p5/reference/${f}` });
  for (const d of packageDirs()) if (exists(`packages/${d}/reference.mjs`)) files.push({ ns: JSON.parse(read(`packages/${d}/package.json`)).name, file: `packages/${d}/reference.mjs` });
  const list = [], problems = [];
  for (const f of files) {
    let mod;
    try { mod = await import(pathToFileURL(path.join(ROOT, f.file)).href); } catch (e) { problems.push({ code: 'G4', msg: `${f.file}: cannot be loaded: ${e.message}` }); continue; }
    const data = mod.default;
    if (!data || typeof data !== 'object' || Array.isArray(data)) { problems.push({ code: 'G4', msg: `${f.file}: must export default { name: { … } }` }); continue; }
    for (const [key, entry] of Object.entries(data)) list.push({ ns: f.ns, key, file: f.file, entry });
  }
  return { list, problems };
}

export function loadLedger() {
  if (!exists(LEDGER_FILE)) return { done: false, names: [] };
  const j = JSON.parse(read(LEDGER_FILE));
  return { done: !!j.done, names: Array.isArray(j.names) ? j.names : [] };
}

// ---------------------------------------------------------------------------- the gates (pure)
/**
 * G1  every public name has an entry (its key or an alias) or is in the ledger
 * G2  every entry names something the code has
 * G3  the ledger is honest: its names exist, have no entry yet, and it is empty when it says it is done
 */
export function checkCoverage(items, authored, ledger) {
  const problems = [];
  const have = new Map(items.map((i) => [i.uid, i]));
  const covered = new Map();                                // uid → entry owner uid
  const seenKeys = new Set();
  for (const a of authored) {
    const uid = itemUid(a.ns, a.key);
    if (seenKeys.has(uid)) problems.push({ code: 'G2', msg: `${a.file}: "${a.key}" is written twice` });
    seenKeys.add(uid);
    if (!have.has(uid)) {
      problems.push({ code: 'G2', msg: `${a.file}: "${a.key}" is documented but the code has no such public name in ${a.ns} (renamed or removed? delete or rename the entry)` });
    }
    covered.set(uid, uid);
    for (const al of a.entry.aliases || []) {
      const auid = itemUid(a.ns, al);
      if (!have.has(auid)) problems.push({ code: 'G2', msg: `${a.file}: "${a.key}" lists the alias "${al}" but the code has no such public name in ${a.ns}` });
      else if (covered.has(auid)) problems.push({ code: 'G2', msg: `${a.file}: "${al}" is covered twice (by ${covered.get(auid)} and ${uid})` });
      covered.set(auid, uid);
    }
  }
  const led = new Set(ledger.names);
  for (const it of items) {
    if (!covered.has(it.uid) && !led.has(it.uid)) {
      problems.push({ code: 'G1', msg: `${it.ns}: public name "${it.key}" (${it.kind}, ${it.src.file}:${it.src.line}) has no documentation: add an entry for it (node tools/build-reference.mjs --missing prints a stub)` });
    }
  }
  for (const uid of led) {
    if (!have.has(uid)) problems.push({ code: 'G3', msg: `${LEDGER_FILE}: "${uid}" is not a public name any more: remove it from the ledger` });
    else if (covered.has(uid)) problems.push({ code: 'G3', msg: `${LEDGER_FILE}: "${uid}" has an entry now: remove it from the ledger` });
  }
  if (ledger.done && led.size) problems.push({ code: 'G3', msg: `${LEDGER_FILE} says "done": true but still lists ${led.size} name(s)` });
  return problems;
}

const PAIR_FIELDS = ['summary'];
const pair = (v) => v && typeof v === 'object' && typeof v.en === 'string' && typeof v.zh === 'string';
const ALLOWED = new Set(['group', 'aliases', 'summary', 'description', 'value', 'params', 'returns', 'needs', 'notes', 'examples', 'related', 'keywords', 'tbd', 'claims', 'signature', 'members', 'sort']);

/** Syntax check of one example: a sketch is a classic script; a module has its imports taken off and sits in an async function. */
export function exampleSyntaxError(ex) {
  const lang = ex.lang || 'js';
  if (lang !== 'js') return null;
  let code = ex.code;
  try {
    if ((ex.run || 'sketch') === 'module') {
      code = code.replace(/^\s*import\s[\s\S]*?\sfrom\s+['"][^'"]+['"];?[ \t]*$/gm, '').replace(/^\s*import\s+['"][^'"]+['"];?[ \t]*$/gm, '');
      new vm.Script('(async () => {\n' + code + '\n})', { filename: 'example.js' });
    } else new vm.Script(code, { filename: 'example.js' });
    return null;
  } catch (e) { return e.message; }
}

/** G4, G5, G6: one entry against the item it documents. */
export function checkEntry(item, a, ctx = {}) {
  const P = [];
  const at = `${a.file}: ${a.key}`;
  const e = a.entry;
  const bad = (code, msg) => P.push({ code, msg: `${at}: ${msg}` });
  for (const k of Object.keys(e)) if (!ALLOWED.has(k)) bad('G4', `unknown field "${k}" (allowed: ${[...ALLOWED].join(', ')})`);
  if (!CATEGORY_IDS.includes(e.group)) bad('G4', `group "${e.group}" is not a category (tools/reference/categories.mjs)`);
  if (!pair(e.summary) || !e.summary.en.trim() || !e.summary.zh.trim()) bad('G4', 'summary needs { en, zh }, both written');
  else {
    if (hasCJK(e.summary.en)) bad('G4', 'summary.en contains Chinese characters');
    if (!hasCJK(e.summary.zh)) bad('G4', 'summary.zh has no Chinese characters (a copy of the English?)');
    if (e.summary.en.length > 170) bad('G4', `summary.en is ${e.summary.en.length} characters: the first sentence only (≤ 170)`);
  }
  const checkPair = (v, where) => {
    if (!pair(v) || !v.en.trim() || !v.zh.trim()) { bad('G4', `${where} needs { en, zh }, both written`); return; }
    if (hasCJK(v.en)) bad('G4', `${where}.en contains Chinese characters`);
    if (!hasCJK(v.zh)) bad('G4', `${where}.zh has no Chinese characters`);
  };
  const needsDescription = item.ns === P5 || item.kind === 'class' || item.kind === 'function' || item.kind === 'tool';
  if (!Array.isArray(e.description) || (needsDescription && !e.description.length)) bad('G4', 'description: at least one paragraph [{ en, zh }]');
  else e.description.forEach((d, i) => checkPair(d, `description[${i}]`));
  (e.notes || []).forEach((d, i) => checkPair(d, `notes[${i}]`));
  (e.tbd || []).forEach((d, i) => checkPair(d, `tbd[${i}]`));
  if (e.needs) checkPair(e.needs, 'needs');
  if (e.returns) { if (!pair(e.returns)) bad('G4', 'returns needs { type?, en, zh }'); else checkPair(e.returns, 'returns'); }
  if (e.value) {
    if (typeof e.value.type !== 'string') bad('G4', 'value.type is a string ("Number")');
    if (e.value.en !== undefined) checkPair(e.value, 'value');
  }
  if (item.kind === 'variable' && item.ns === P5 && !e.value) bad('G4', 'a variable needs `value: { type, range?, en, zh }` (type, range, when it updates)');
  // examples
  const examples = e.examples || [];
  if (item.ns === P5 && item.kind !== 'object' && !examples.length) bad('G4', 'an oav-p5 entry needs at least one example');
  examples.forEach((ex, i) => {
    const w = `examples[${i}]`;
    if (typeof ex.code !== 'string' || !ex.code.trim()) { bad('G4', `${w}.code is empty`); return; }
    if (!pair(ex.caption)) bad('G4', `${w}.caption needs { en, zh }: what you will see, in one sentence`); else checkPair(ex.caption, `${w}.caption`);
    const run = ex.run || (item.ns === P5 ? 'sketch' : 'module');
    if (!['sketch', 'module', 'static'].includes(run)) bad('G4', `${w}.run is sketch | module | static`);
    if (run === 'static' && !ex.why) bad('G4', `${w}: a static example (never run in CI) must say why in \`why\``);
    if (run === 'sketch' && !/\bfunction\s+(setup|draw)\b/.test(ex.code)) bad('G4', `${w}: a sketch needs setup() or draw()`);
    if (run === 'sketch' && /document\.head\.prepend\(/.test(ex.code)) bad('G4', `${w}: leave the loader line out, the page adds it`);
    const err = exampleSyntaxError({ ...ex, run });
    if (err) bad('G6', `${w}: does not parse: ${err}`);
  });
  // params
  const declared = item.params !== undefined ? parseParams(item.params) : null;
  if (e.params !== undefined && !Array.isArray(e.params)) bad('G5', 'params is an array');
  else if (declared) {
    const names = (e.params || []).map((p) => p.name);
    const dn = declared.map((p) => p.name);
    for (let i = 0; i < dn.length; i++) if (names[i] !== dn[i]) { bad('G5', `params do not match the code: the code declares (${dn.join(', ')}), the entry lists (${names.join(', ') || 'nothing'})`); break; }
    (e.params || []).slice(dn.length).forEach((p) => { if (!p.viaArguments) bad('G5', `param "${p.name}" is not in the code's declaration (${dn.join(', ') || 'no parameters'}): if the function reads it from \`arguments\`, mark it viaArguments: true`); });
  }
  (e.params || []).forEach((p, i) => { if (p.en !== undefined || p.zh !== undefined) checkPair(p, `params[${i}]`); else bad('G4', `params[${i}] (${p.name}) needs { en, zh }`); });
  // keywords
  if (e.keywords) for (const l of ['en', 'zh']) if (e.keywords[l] !== undefined && !Array.isArray(e.keywords[l])) bad('G4', `keywords.${l} is an array of words`);
  void ctx; void PAIR_FIELDS;
  return P;
}

// ---------------------------------------------------------------------------- records
const slugPkg = (ns) => ns.replace(/^@openav\//, '');

/** Merge items and entries into the records the page renders. Also: ids, categories, import lines, source links. */
export function buildRecords(items, authored, ledger) {
  const byUid = new Map(authored.map((a) => [itemUid(a.ns, a.key), a]));
  const owner = new Map();                                  // uid of an alias → the entry that covers it
  for (const a of authored) for (const al of a.entry.aliases || []) owner.set(itemUid(a.ns, al), a);
  const led = new Set(ledger.names);
  const records = [];
  for (const it of items) {
    if (owner.has(it.uid)) continue;                        // an alias: shown inside its owner's entry
    const a = byUid.get(it.uid) || null;
    const covers = [it.key, ...((a && a.entry.aliases) || [])];
    const kind = it.kind;
    const pkgDir = it.pkgDir;
    const category = a ? a.entry.group : (it.ns === P5 ? (kind === 'option' ? 'options' : it.key.startsWith('OAVp5') ? 'oavp5' : 'midi') : PACKAGE_CATEGORY[pkgDir] || 'core');
    records.push({
      uid: it.uid, ns: it.ns, key: it.key, name: it.name, kind, category, covers,
      item: it, entry: a ? a.entry : null, file: a ? a.file : null, ledger: led.has(it.uid),
    });
  }
  // anchors: the name itself (the anchor people type); a package name another name already uses gets the package in front
  const count = new Map();
  for (const r of records) for (const c of r.covers) { const id = anchorOf(r, c, false); count.set(id, (count.get(id) || 0) + 1); }
  for (const r of records) {
    r.id = anchorOf(r, r.key, count.get(anchorOf(r, r.key, false)) > 1);
    r.aliasIds = r.covers.filter((c) => c !== r.key).map((c) => anchorOf(r, c, count.get(anchorOf(r, c, false)) > 1));
    r.source = { file: r.item.src.file, line: r.item.src.line, url: `${REPO_BLOB}${r.item.src.file}#L${r.item.src.line}` };
    r.pkg = r.ns;
    if (r.ns !== P5 && r.item.spec) r.import = importLine(r.item);
  }
  const order = new Map(CATEGORY_IDS.map((c, i) => [c, i]));
  records.sort((x, y) => (order.get(x.category) - order.get(y.category)) || ((x.ns === P5 ? 0 : 1) - (y.ns === P5 ? 0 : 1)) || x.ns.localeCompare(y.ns) || sortKey(x).localeCompare(sortKey(y)));
  return records;
}
const sortKey = (r) => (r.entry && r.entry.sort) || r.key.replace(/^OAVp5\./, 'zz.').replace(/^option:/, '');

function anchorOf(r, key, qualify) {
  if (r.ns === P5) return key.startsWith('option:') ? `option-${key.slice(7)}` : key;
  return qualify ? `${slugPkg(r.ns)}-${key}` : key;
}

function importLine(it) {
  return `import { ${it.key} } from '${it.spec}';`;
}

/** Everything the gates look at, in one list of problems. (loadModel() calls this; so does the test.) */
export function checkModel({ items, authored, ledger, records }) {
  const problems = checkCoverage(items, authored, ledger);
  const byUid = new Map(items.map((i) => [i.uid, i]));
  for (const a of authored) {
    const it = byUid.get(itemUid(a.ns, a.key));
    if (it) problems.push(...checkEntry(it, a));
  }
  // ids are unique; related names and #links point at something
  const ids = new Map();
  for (const r of records) for (const id of [r.id, ...r.aliasIds]) { if (ids.has(id)) problems.push({ code: 'G9', msg: `anchor "${id}" is used by ${ids.get(id)} and ${r.uid}` }); ids.set(id, r.uid); }
  const keys = new Set(); for (const r of records) for (const c of r.covers) keys.add(c);
  const anchor = (key) => records.find((r) => r.covers.includes(key));
  for (const r of records) {
    if (!r.entry) continue;
    for (const k of r.entry.related || []) if (!anchor(k)) problems.push({ code: 'G4', msg: `${r.file}: ${r.key}: related "${k}" is not a documented name` });
    const texts = [r.entry.summary, ...(r.entry.description || []), ...(r.entry.notes || []), r.entry.needs].filter(Boolean).flatMap((p) => [p.en, p.zh]);
    for (const t of texts) for (const m of String(t).matchAll(/\]\(#([^)\s]+)\)/g)) if (!ids.has(m[1])) problems.push({ code: 'G9', msg: `${r.file}: ${r.key}: link to #${m[1]} goes nowhere` });
    for (const c of r.entry.claims || []) if (!c.expr) problems.push({ code: 'G4', msg: `${r.file}: ${r.key}: a claim needs expr` });
  }
  for (const r of records) {
    const f = path.join(ROOT, r.source.file);
    if (!fs.existsSync(f)) problems.push({ code: 'G9', msg: `${r.uid}: source file ${r.source.file} does not exist` });
    else if (r.source.line > fs.readFileSync(f, 'utf8').split('\n').length) problems.push({ code: 'G9', msg: `${r.uid}: source line ${r.source.line} is past the end of ${r.source.file}` });
    if (r.item.conflict) problems.push({ code: 'G9', msg: `${r.uid}: one name, two definitions behind ${r.item.conflict.join(', ')}` });
  }
  return problems;
}

/** Load the scan, the sidecars and the ledger; join them; run every gate. */
export async function loadModel() {
  const surface = await scanAll();
  const items = itemsOf(surface);
  const { list: authored, problems: loadProblems } = await loadAuthored();
  const ledger = loadLedger();
  const records = buildRecords(items, authored, ledger);
  const problems = [...loadProblems, ...checkModel({ items, authored, ledger, records })];
  return { surface, items, authored, ledger, records, problems };
}

// ---------------------------------------------------------------------------- the dataset (docs/reference/reference.json)
/** What an agent or the search index reads: every record, both languages, the facts the code gave. No dates. */
export function toDataset(model, { p5Version, version }) {
  const text = (t) => (t ? { en: t.en, zh: t.zh } : undefined);
  const out = model.records.map((r) => {
    const e = r.entry;
    const it = r.item;
    return {
      id: r.id, key: r.key, name: r.name, aliases: r.covers.filter((c) => c !== r.key), kind: r.kind, package: r.ns, category: r.category,
      documented: !!e,
      signature: signatureOf(r),
      import: r.import,
      source: r.source,
      summary: e ? text(e.summary) : undefined,
      description: e ? (e.description || []).map(text) : [],
      value: e && e.value ? { type: e.value.type, range: e.value.range, options: e.value.options, default: e.value.default, ...text(e.value.en !== undefined ? e.value : null) } : undefined,
      params: e ? (e.params || []).map((p) => ({ name: p.name, type: p.type, optional: p.optional, default: p.default, en: p.en, zh: p.zh })) : [],
      returns: e && e.returns ? { type: e.returns.type, en: e.returns.en, zh: e.returns.zh } : undefined,
      needs: e ? text(e.needs) : undefined,
      notes: e ? (e.notes || []).map(text) : [],
      examples: e ? (e.examples || []).map((x) => ({ code: x.code, caption: text(x.caption), run: x.run || (r.ns === P5 ? 'sketch' : 'module'), lang: x.lang || 'js' })) : [],
      related: e ? e.related || [] : [],
      keywords: e && e.keywords ? { en: e.keywords.en || [], zh: e.keywords.zh || [] } : { en: [], zh: [] },
      tbd: e ? (e.tbd || []).map(text) : [],
      claims: e ? e.claims || [] : [],
      members: it.members && it.members.length ? it.members.map((m) => ({ name: m.name, member: m.member, signature: m.sig, doc: m.doc, line: m.line })) : undefined,
    };
  });
  return { schema: 1, version, p5Version, categories: [...new Set(model.records.map((r) => r.category))], count: out.length, entries: out };
}

/** The signature line for a record: from the code where the code has it. */
export function signatureOf(r) {
  const it = r.item, e = r.entry || {};
  if (e.signature) return e.signature;
  const decl = it.params !== undefined ? parseParams(it.params) : null;
  const withOptional = (list) => list.map((p) => (p.optional ? `[${p.rest ? '...' : ''}${p.name}]` : p.name)).join(', ');
  if (it.ns === P5) {
    if (it.kind === 'event') return `function ${it.key}(${(e.params || []).map((p) => p.name).join(', ')}) {}`;
    if (it.kind === 'option') return `?oav_${it.name}=${(e.value && e.value.options) || '…'}`;
    if (it.kind === 'function') {
      const names = (e.params || []).map((p) => (p.optional ? `[${p.name}]` : p.name));
      return `${it.key}(${names.join(', ')})`;
    }
    return it.key;
  }
  if (it.kind === 'class') return `new ${it.key}(${it.params || ''})`;
  if (it.kind === 'function') return `${it.async ? 'async ' : ''}${it.generator ? 'function* ' : ''}${it.key}(${it.params || ''})`;
  if (it.kind === 'constant') return it.preview ? `${it.key} = ${it.preview}` : it.key;
  if (it.kind === 'tool') return it.key;
  void decl; void withOptional;
  return it.key;
}
