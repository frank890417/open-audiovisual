// The docs handbook: Markdown in docs/ (en) and docs/zh/ (zh) rendered by
// tools/build-docs.mjs into docs/index.html and zh/docs/index.html.
// These tests keep the renderer honest and the two pages in step: same anchors,
// same code, nothing stale, no broken link.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderMarkdown, inline, highlight, slugify, splitRow } from '../tools/docs/markdown.mjs';
import { buildDocs, githubSlug } from '../tools/build-docs.mjs';
import { CHAPTERS } from '../tools/docs/chapters.mjs';
import { shapeDiff } from '../tools/build-home.mjs';
import en from '../tools/docs/en.mjs';
import zh from '../tools/docs/zh.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const md = (src, o) => renderMarkdown(src, o).html;
const all = (re, s) => [...s.matchAll(re)].map((m) => m[1]);

// ───────────── renderer ─────────────

test('markdown: everything is escaped; only <kbd> passes through', () => {
  const h = md('Hi <script>alert(1)</script> & "q" <kbd>Space</kbd> <b>x</b>');
  assert.ok(!h.includes('<script>'));
  assert.ok(h.includes('&lt;script&gt;alert(1)&lt;/script&gt; &amp; "q"'));
  assert.ok(h.includes('<kbd>Space</kbd>'));
  assert.ok(h.includes('&lt;b&gt;x&lt;/b&gt;'));
  assert.equal(inline('`<b> & </b>`'), '<code>&lt;b&gt; &amp; &lt;/b&gt;</code>');
  assert.equal(inline('[x](javascript:alert(1) "t")', { resolveLink: (h) => h }).includes('<a href="javascript:alert(1'), true, 'resolver decides; attribute is escaped');
  assert.ok(!/<a [^>]*\sonmouseover=/.test(md('[a](" onmouseover="x)') + md('[a](x"onmouseover="y)')), 'quotes cannot break out of href');
});

test('markdown: inline emphasis, code, links, escapes, breaks', () => {
  assert.equal(inline('**bold** and *em* and _em_'), '<strong>bold</strong> and <em>em</em> and <em>em</em>');
  assert.equal(inline('snake_case_name stays'), 'snake_case_name stays');
  assert.equal(inline('``a`b``'), '<code>a`b</code>');
  assert.equal(inline('\\*not em\\*'), '*not em*');
  assert.equal(inline('5 * 3 * 2'), '5 * 3 * 2');
  assert.equal(inline('see [the `docs`](a.md "T")', { resolveLink: (h) => '#' + h }), 'see <a href="#a.md" title="T">the <code>docs</code></a>');
  assert.equal(inline('<https://x.org/a>'), '<a href="https://x.org/a">https://x.org/a</a>');
  assert.equal(inline('line  \nnext'), 'line<br>next');
  assert.equal(inline('**`code` in bold**'), '<strong><code>code</code> in bold</strong>');
});

test('markdown: a soft break between CJK characters joins them (no stray space)', () => {
  assert.equal(inline('訊號是輸入\n唯一的通用貨幣'), '訊號是輸入唯一的通用貨幣');
  assert.equal(inline('用 import map\n引入'), '用 import map\n引入');
});

test('markdown: headings get stable, unique ids; twins share them', () => {
  const used = new Set();
  const r = renderMarkdown('# Mapping\n\n## Curves\n\n## Curves\n\n### Deep `code` here\n\n## Custom {#my-id}', { idPrefix: 'mapping', shift: 1, used });
  assert.equal(r.title, 'Mapping');
  assert.deepEqual(r.headings.map((h) => [h.level, h.id]), [[2, 'mapping'], [3, 'mapping-curves'], [3, 'mapping-curves-2'], [4, 'mapping-deep-code-here'], [3, 'my-id']]);
  assert.match(r.html, /<h3 id="mapping-curves">Curves<a class="anchor" href="#mapping-curves"/);
  assert.match(r.html, /<h4 id="mapping-deep-code-here">Deep <code>code<\/code> here/);
  // zh: positional ids from the English twin; CJK text alone would have no slug
  const twin = r.headings.filter((h) => h.mdLevel > 1);
  const z = renderMarkdown('# 映射\n\n## 曲線\n\n## 曲線二\n\n### 深 `code`\n\n## 自訂', { idPrefix: 'mapping', shift: 1, twin, used: new Set() });
  assert.deepEqual(z.headings.map((h) => h.id), r.headings.map((h) => h.id));
  // without a twin, CJK headings still get an id
  assert.equal(renderMarkdown('## 曲線', { idPrefix: 'm' }).headings[0].id, 'm-1');
  assert.equal(slugify('L1 · Input — Signals'), 'l1-input-signals');
  assert.equal(githubSlug('@openav/remote · @openav/surface'), 'openavremote--openavsurface');
});

test('markdown: tables with alignment, escaped pipes and inline code', () => {
  const h = md('| a | b | c |\n|:--|:-:|--:|\n| `x\\|y` | **b** | 3 |\n| short |');
  assert.match(h, /<div class="table-wrap"><table>/);
  assert.match(h, /<th style="text-align:left">a<\/th><th style="text-align:center">b<\/th><th style="text-align:right">c<\/th>/);
  assert.match(h, /<td style="text-align:left"><code>x\|y<\/code><\/td><td style="text-align:center"><strong>b<\/strong><\/td>/);
  assert.match(h, /<tr><td style="text-align:left">short<\/td><td style="text-align:center"><\/td><td style="text-align:right"><\/td><\/tr>/, 'short rows are padded');
  assert.deepEqual(splitRow('| a | `b\\|c` |'), ['a', '`b|c`']);
});

test('markdown: nested lists, ordered start, lazy lines, tasks, loose items', () => {
  const h = md('- one\n  - inner *a*\n  - inner b\n- two\ncontinued lazily\n\n3. three\n4. four\n\n- [x] done\n- [ ] open');
  assert.match(h, /<ul>\n<li>one\n<ul>\n<li>inner <em>a<\/em><\/li>\n<li>inner b<\/li>\n<\/ul><\/li>\n<li>two\ncontinued lazily<\/li>\n<\/ul>/);
  assert.match(h, /<ol start="3">\n<li>three<\/li>\n<li>four<\/li>\n<\/ol>/);
  assert.match(h, /<ul class="tasks">\n<li class="task"><input type="checkbox" disabled checked aria-label="done"> done<\/li>\n<li class="task"><input type="checkbox" disabled aria-label="open"> open<\/li>/);
  const loose = md('- a\n\n  second paragraph\n- b');
  assert.match(loose, /<li><p>a<\/p>\n<p>second paragraph<\/p><\/li>/);
});

test('markdown: fenced code is escaped and highlighted; # inside tokens is not a comment', () => {
  const h = md("```js\nconst a = '<b>'; // note\nctx.fillStyle = '#000';\n```");
  assert.match(h, /<div class="term" data-lang="js"><div class="term-bar"><span>js<\/span><button type="button" class="copy" hidden>Copy<\/button><\/div><pre><code class="language-js">/);
  assert.ok(h.includes('<span class="tk">const</span> a = <span class="ts">\'&lt;b&gt;\'</span>; <span class="tc">// note</span>'));
  assert.ok(h.includes('<span class="ts">\'#000\'</span>'));
  const sh = highlight('node serve.js   # → http://localhost:8080 #notacomment', 'bash');
  assert.ok(sh.includes('<span class="tc"># → http://localhost:8080 #notacomment</span>'));
  assert.ok(!highlight('a#b', 'bash').includes('tc'), '# mid-token stays text');
  assert.match(md('~~~\nplain <text>\n~~~'), /<pre><code>plain &lt;text&gt;<\/code><\/pre>/);
  assert.equal(highlight('{ "a": true }', 'json'), '{ <span class="ts">"a"</span>: <span class="tk">true</span> }');
});

test('markdown: blockquotes, GitHub alerts and rules', () => {
  assert.match(md('> quoted **text**'), /<blockquote>\n<p>quoted <strong>text<\/strong><\/p>\n<\/blockquote>/);
  const a = md('> [!WARNING]\n> careful', { labels: { warning: '注意' } });
  assert.match(a, /<aside class="callout callout-warning" role="note"><p class="callout-title">注意<\/p>\n<p>careful<\/p>\n<\/aside>/);
  assert.equal(md('---'), '<hr>');
});

test('markdown: links go through the resolver', () => {
  const seen = [];
  md('[a](mapping.md#curves) and [b](../packages/core/index.js)', { resolveLink: (h) => { seen.push(h); return '#x'; } });
  assert.deepEqual(seen, ['mapping.md#curves', '../packages/core/index.js']);
});

// ───────────── the built pages ─────────────

const built = buildDocs();
const PAGES = { en: { file: 'docs/index.html', url: 'https://openaudiovisual.com/docs/' }, zh: { file: 'zh/docs/index.html', url: 'https://openaudiovisual.com/zh/docs/' } };
const html = { en: built.pages[PAGES.en.file], zh: built.pages[PAGES.zh.file] };
const body = (s) => s.slice(s.indexOf('<body'));

test('docs string tables have the same shape', () => {
  assert.deepEqual(shapeDiff(en, zh), []);
});

test('committed pages are what the sources render (run node tools/build-docs.mjs)', () => {
  const unstamp = (s) => s.replace(/\?v=[\w.-]+/g, '');
  for (const rel of Object.keys(built.pages)) {
    assert.ok(fs.existsSync(path.join(ROOT, rel)), rel + ' missing');
    assert.equal(unstamp(read(rel)), unstamp(built.pages[rel]), rel + ' is stale');
  }
});

test('the build has no warnings (broken chapter links, structure drift, missing files)', () => {
  assert.deepEqual(built.warnings, []);
});

test('every chapter is on both pages, in order, with the same section anchors', () => {
  for (const lang of ['en', 'zh']) {
    assert.deepEqual(built.chapters[lang].map((c) => c.id), CHAPTERS.map((c) => c.id), lang);
    assert.deepEqual(all(/<section class="chapter" data-chapter="([^"]+)"/g, html[lang]), CHAPTERS.map((c) => c.id));
  }
  const ids = (s) => all(/<h[2-6] id="([^"]+)"/g, body(s));
  assert.deepEqual(ids(html.zh), ids(html.en), 'zh headings must mirror en (same ids, same order)');
  const unique = new Set(ids(html.en));
  assert.equal(unique.size, ids(html.en).length, 'ids are unique on the page');
  assert.equal((html.en.match(/<h1[\s>]/g) || []).length, 1, 'exactly one h1');
  // the contents list every chapter and every ## section, pointing at real headings
  for (const lang of ['en', 'zh']) {
    const toc = html[lang].slice(html[lang].indexOf('<nav class="toc"'), html[lang].indexOf('</nav>', html[lang].indexOf('<nav class="toc"')));
    const want = built.chapters[lang].flatMap((c) => [c.id, ...c.sections.map((s) => s.id)]);
    assert.deepEqual(all(/href="#([^"]+)"/g, toc), want, lang + ' toc');
  }
});

test('code blocks are identical in English and Chinese', () => {
  const fences = (s) => [...s.matchAll(/^( {0,3})(```|~~~)[^\n]*\n([\s\S]*?)^\1\2\s*$/gm)].map((m) => m[3]);
  for (const ch of CHAPTERS) {
    if (ch.external || !fs.existsSync(path.join(ROOT, ch.en)) || !fs.existsSync(path.join(ROOT, ch.zh))) continue;
    assert.deepEqual(fences(read(ch.zh)), fences(read(ch.en)), ch.zh);
  }
});

test('language metadata: lang, canonical, hreflang, JSON-LD TechArticle', () => {
  const want = { en: ['en', 'en'], zh: ['zh-Hant-TW', 'zh-Hant-TW'] };
  for (const [lang, p] of Object.entries(PAGES)) {
    const s = html[lang];
    assert.match(s, new RegExp(`<html lang="${want[lang][0]}">`));
    assert.match(s, new RegExp(`<link rel="canonical" href="${p.url}">`));
    for (const [hl, url] of [['en', PAGES.en.url], ['zh-Hant', PAGES.zh.url], ['x-default', PAGES.en.url]])
      assert.match(s, new RegExp(`<link rel="alternate" hreflang="${hl}" href="${url}">`), `${lang} hreflang ${hl}`);
    const ld = JSON.parse(s.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
    assert.equal(ld['@type'], 'TechArticle');
    assert.equal(ld.inLanguage, want[lang][1]);
    assert.equal(ld.url, p.url);
    assert.equal(ld.articleSection.length, CHAPTERS.length);
    assert.match(s, /<nav class="nav"[^>]*>[\s\S]*?aria-current="page"[^>]*>|aria-current="page">[^<]*<\/a>/, 'top bar marks the current page');
  }
});

test('every local link and asset exists, every #anchor has a target', () => {
  for (const [lang, p] of Object.entries(PAGES)) {
    const s = html[lang];
    const dir = path.dirname(path.join(ROOT, p.file));
    for (const ref of all(/\s(?:href|src)="([^"]+)"/g, s)) {
      if (/^(https?:|data:|mailto:)/.test(ref)) continue;
      if (ref.startsWith('#')) { assert.ok(s.includes(`id="${ref.slice(1)}"`), `${lang}: ${ref} has no target`); continue; }
      const clean = ref.split(/[?#]/)[0];
      let f = path.join(dir, clean);
      if (clean.endsWith('/') || clean === '' || clean === '.') f = path.join(f, 'index.html');
      assert.ok(fs.existsSync(f), `${lang}: ${ref} → ${path.relative(ROOT, f)} missing`);
      const frag = ref.split('#')[1];
      if (frag && /docs\/$/.test(clean)) assert.ok(html[lang === 'en' ? 'zh' : 'en'].includes(`id="${frag}"`), `${lang}: ${ref} anchor missing on the other page`);
    }
    // GitHub links point at files that exist in this repository
    for (const ref of all(/href="https:\/\/github\.com\/frank890417\/open-audiovisual\/(?:blob|tree)\/main\/([^"#]+)/g, s)) {
      assert.ok(fs.existsSync(path.join(ROOT, decodeURIComponent(ref))), `${lang}: GitHub link to missing ${ref}`);
    }
  }
});
