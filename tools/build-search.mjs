#!/usr/bin/env node
// build-search — the site search index: assets/search/index.json.
//
//   node tools/build-search.mjs          # write the index (and sitemap.xml)
//   node tools/build-search.mjs --check  # exit 1 if the committed index is stale
//
// The index is made from the same sources as the pages it points at, never typed:
//   ref   every entry of the API reference, from docs/reference/reference.json (tools/build-reference.mjs writes it first):
//         name, aliases (and midi.x for OAVp5.x), the keywords in BOTH languages, the one-line summary, the description
//   doc   every chapter and every section of the handbook, from the same Markdown render the /docs/ page is made of
//         (tools/build-docs.mjs buildDocs()): title, heading, the text under it (code blocks left out)
//   ex    every example: title, what it teaches, the three things to try, from examples/catalog.json
//   ctl   every MIDI controller page: its name, maker, kind
//   page  the site's pages: the title and the one-line blurb llms.txt gives them
// Each record exists once per language (en, zh); the search dialog shows the page's language first and the other language when only
// that one matches, so "麥克風" finds micLevel from the English site and "microphone" finds it from the Chinese one.
// No dependency, no stemming, no word list: matching is substring (assets/search/core.js), which is what a Chinese word needs.
// The dialog (assets/search/search.js) fetches this file the first time it opens. --check ignores nothing: it has no stamps.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDocs } from './build-docs.mjs';
import { EXAMPLES, plainText } from './examples/catalog.mjs';
import { catalog, detailPath } from './controllers/page.mjs';
import { fullName } from './controllers/detail.mjs';
import { registry } from './site/pages.mjs';
import { PAGE_TITLE, PAGE_BLURB } from './site/llms.mjs';
import { sitemapXml } from './site/pages.mjs';
import { UI } from './search/strings.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => { try { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); } catch { return null; } };
export const INDEX = 'assets/search/index.json';
const LANGS = ['en', 'zh'];
const CAP = { ref: 1500, doc: 2600, ex: 900, ctl: 300, page: 400 };

const ENT = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&#x27;': "'", '&nbsp;': ' ' };
/** HTML → plain text for the index: code blocks and scripts dropped, tags dropped, entities decoded, one line. */
export function plain(html) {
  return String(html || '')
    .replace(/<pre[\s\S]*?<\/pre>/g, ' ').replace(/<(script|style)[\s\S]*?<\/\1>/g, ' ')
    .replace(/<\/(p|li|h[1-6]|tr|div|dd|dt)>|<br\s*\/?>/g, ' ').replace(/<[^>]+>/g, '')
    .replace(/&(?:amp|lt|gt|quot|#39|#x27|nbsp);/g, (m) => ENT[m]).replace(/\s+/g, ' ').trim();
}
/** The Markdown an entry's text may hold ([text](#link), `code`, **bold**, a ```fence```) as plain words. */
export const mdText = (t) => String(t || '').replace(/```[\s\S]*?```/g, ' ').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[`*]|__/g, '').replace(/\s+/g, ' ').trim();
const cap = (s, n) => (s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : s);
const pre = (l) => (l === 'zh' ? 'zh/' : '');

// ---------------------------------------------------------------------------- the sources
function refRecords() {
  const raw = read('docs/reference/reference.json');
  if (raw === null) throw new Error('build-search: docs/reference/reference.json is missing: run node tools/build-reference.mjs first');
  const ds = JSON.parse(raw);
  const out = [];
  // how many other entries point at this one, in `related` or with a [link](#anchor) in their text: the entries people are sent to
  // are the ones to show first among equals (micLevel is linked from every microphone entry; an option nobody mentions is not)
  const refs = new Map(), anchor = new Map();
  for (const e of ds.entries) for (const a of [e.id, ...e.aliases.map((x) => (x.startsWith('option:') ? 'option-' + x.slice(7) : x))]) anchor.set(a, e);
  const linked = new Map();                                  // target id → the set of entries that point at it
  const point = (from, to) => { if (to && to !== from) { if (!linked.has(to.id)) linked.set(to.id, new Set()); linked.get(to.id).add(from.id); } };
  for (const e of ds.entries) {
    for (const k of e.related) point(e, ds.entries.find((x) => x.key === k || x.aliases.includes(k)));
    const texts = [e.summary && e.summary.en, ...e.description.map((d) => d.en), e.needs && e.needs.en, ...e.notes.map((n) => n.en)].filter(Boolean).join(' ');
    for (const m of texts.matchAll(/\]\(#([^)\s]+)\)/g)) point(e, anchor.get(m[1]));
  }
  for (const [id, set] of linked) refs.set(id, set.size);
  for (const e of ds.entries) {
    const shown = e.name.replace(/^option:/, '');
    const al = [e.key.replace(/^option:/, ''), ...e.aliases.map((a) => a.replace(/^option:/, ''))];
    const midi = al.filter((a) => a.startsWith('OAVp5')).map((a) => a.replace(/^OAVp5/, 'midi'));
    for (const l of LANGS) {
      const kw = [...(e.keywords.en || []), ...(e.keywords.zh || [])].join(' ');
      const text = mdText([...e.description.map((d) => d[l]), e.needs && e.needs[l], ...e.notes.map((n) => n[l]), ...e.params.map((p) => `${p.name} ${p[l] || ''}`), e.returns && e.returns[l], e.value && e.value[l]].filter(Boolean).join(' '));
      out.push({
        i: `ref:${e.id}`, t: 'ref', l, n: shown + (e.kind === 'function' || e.kind === 'event' ? '()' : ''), u: `${pre(l)}docs/reference/#${e.id}`,
        s: `${e.package} · ${UI[l].kinds[e.kind] || e.kind}`, a: [...al, ...midi].join(' '), k: kw,
        d: e.summary ? mdText(e.summary[l]) : '', x: cap(plain(e.documented ? text : e.signature), CAP.ref), w: Math.min(refs.get(e.id) || 0, 40),
      });
    }
  }
  return out;
}

function docRecords() {
  const { chapters } = buildDocs();
  const out = [];
  for (const l of LANGS) {
    for (const ch of chapters[l]) {
      const re = /<h([1-6]) id="([^"]+)">([\s\S]*?)<\/h\1>/g;
      const marks = [...ch.html.matchAll(re)].map((m) => ({ level: +m[1], id: m[2], title: plain(m[3]).replace(/\s*#$/, ''), start: m.index, end: m.index + m[0].length }));
      marks.forEach((h, k) => {
        if (h.level > 4) return;
        const body = plain(ch.html.slice(h.end, k + 1 < marks.length ? marks[k + 1].start : undefined));
        const isChapter = h.level === 2;
        out.push({ i: `doc:${ch.id}${isChapter ? '' : '#' + h.id}`, t: 'doc', l, n: h.title, u: `${pre(l)}docs/#${h.id}`, s: isChapter ? '' : ch.title, a: '', k: '', d: '', x: cap(body, CAP.doc) });
      });
    }
  }
  return out;
}

function exampleRecords() {
  const out = [];
  for (const e of EXAMPLES) for (const l of LANGS) {
    out.push({
      i: `ex:${e.id}`, t: 'ex', l, n: e.title[l], u: `examples/${e.id}/`, s: UI[l].example.replace('{n}', Number(e.num)), a: e.id, k: plainText(e.plays[l] || ''),
      d: plainText(e.teaches[l]), x: cap(plainText([e.summary[l], ...(e.tryThree[l] || [])].join(' ')), CAP.ex),
    });
  }
  return out;
}

function controllerRecords() {
  const cat = catalog();
  const out = [];
  for (const d of [...cat.devices, ...cat.generic]) for (const l of LANGS) {
    out.push({ i: `ctl:${d.p.id}`, t: 'ctl', l, n: fullName(d.p, l), u: detailPath(d.p.id, l), s: d.p.maker || '', a: `${d.p.id} ${d.p.short || ''}`, k: `${d.p.maker || ''} ${d.p.kind || ''}`, d: '', x: '' });
  }
  return out;
}

function pageRecords() {
  const reg = registry();
  const out = [];
  for (const p of Object.keys(PAGE_TITLE)) {
    if (!reg.some((e) => e.path === p)) continue;
    for (const l of LANGS) {
      const i = l === 'zh' ? 1 : 0;
      out.push({ i: `page:${p || 'home'}`, t: 'page', l, n: PAGE_TITLE[p][i], u: `${pre(l)}${p}`, s: '', a: '', k: '', d: '', x: cap(plain(PAGE_BLURB[p][i].replace(/`/g, '')), CAP.page) });
    }
  }
  return out;
}

/** The whole index, as the object that is written. */
export function buildIndex() {
  const records = [...refRecords(), ...docRecords(), ...exampleRecords(), ...controllerRecords(), ...pageRecords()];
  return { schema: 1, count: records.length, ui: UI, records };
}

/** One record per line, so a change to one entry is a change to one line in git. */
export function indexText(idx) {
  return `{"schema":${idx.schema},"count":${idx.count},"ui":${JSON.stringify(idx.ui)},"records":[\n${idx.records.map((r) => JSON.stringify(r)).join(',\n')}\n]}\n`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const files = { [INDEX]: indexText(buildIndex()), 'sitemap.xml': sitemapXml() };
  if (process.argv.includes('--check')) {
    const stale = Object.entries(files).filter(([rel, out]) => read(rel) === null || (rel === 'sitemap.xml' ? read(rel).replace(/<lastmod>[^<]*<\/lastmod>\s*/g, '') !== out.replace(/<lastmod>[^<]*<\/lastmod>\s*/g, '') : read(rel) !== out)).map(([rel]) => rel);
    if (stale.length) { console.error('stale (run node tools/build-search.mjs):\n  ' + stale.join('\n  ')); process.exit(1); }
    console.log('✅ search index up to date');
  } else {
    for (const [rel, out] of Object.entries(files)) {
      fs.mkdirSync(path.dirname(path.join(ROOT, rel)), { recursive: true });
      fs.writeFileSync(path.join(ROOT, rel), out);
      console.log('wrote', rel, `(${out.length} bytes)`);
    }
  }
}
