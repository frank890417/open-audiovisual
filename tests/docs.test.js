// The docs handbook: Markdown in docs/ (en) and docs/zh/ (zh) rendered by tools/build-docs.mjs into one page per
// chapter (docs/<chapter>/index.html, zh/docs/<chapter>/index.html) and the contents (docs/index.html, zh/docs/index.html).
// These tests keep the renderer honest and the two languages in step: same anchors, same code, nothing stale, no broken
// link, and every #anchor the one-page handbook ever had still lands on its heading.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderMarkdown, inline, highlight, slugify, splitRow } from '../tools/docs/markdown.mjs';
import vm from 'node:vm';
import { buildDocs, githubSlug, chapterFile } from '../tools/build-docs.mjs';
import { CHAPTERS } from '../tools/docs/chapters.mjs';
import { DOC_PAGES, RESERVED, P5_CHAPTER, chapterPath, anchorMap, chapterOfAnchor } from '../tools/docs/anchors.mjs';
import { landing } from './_docs.js';
import { shapeDiff } from '../tools/build-home.mjs';
import { ldNode } from './_ld.js';
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

test('markdown: a code span that names something openable becomes a link (codeHref), never inside a link', () => {
  const codeHref = (c) => (c === 'p5/examples/mic/' ? '../p5/examples/mic/' : null);
  assert.equal(inline('open `p5/examples/mic/` or `knob1`', { codeHref }), 'open <a href="../p5/examples/mic/"><code>p5/examples/mic/</code></a> or <code>knob1</code>');
  assert.equal(inline('open `p5/examples/mic/`'), 'open <code>p5/examples/mic/</code>', 'no codeHref, no link');
  assert.equal(inline('[`p5/examples/mic/`](x)', { codeHref, resolveLink: (h) => h }), '<a href="x"><code>p5/examples/mic/</code></a>', 'no link inside a link');
});

test('docs: a ready-made sketch named as code (`p5/examples/<name>/`) links to its page, or to its source when it has none', async () => {
  const { getFacts } = await import('../tools/site/facts.mjs');
  const f = getFacts();
  assert.ok(f.p5Sketches.length >= 7, 'p5/examples has its sketches');
  const pages = [['p5/index.html', '../'], ['zh/p5/index.html', '../../'], ...DOC_PAGES.flatMap((c) => [[`docs/${c.id}/index.html`, '../../'], [`zh/docs/${c.id}/index.html`, '../../../']])];
  for (const [file, root] of pages) {
    const s = read(file);
    assert.ok(!/(?<!">)<code>p5\/examples\/[a-z0-9-]+\/<\/code>/.test(s), `${file}: every p5/examples/<name>/ in the text is a link`);
    for (const x of f.p5Sketches) {
      if (!s.includes(`<code>p5/examples/${x.name}/</code>`)) continue;
      const href = x.page ? `${root}p5/examples/${x.name}/` : `https://github.com/frank890417/open-audiovisual/blob/main/p5/examples/${x.name}/sketch.js`;
      assert.ok(s.includes(`<a href="${href}"><code>p5/examples/${x.name}/</code></a>`), `${file}: ${x.name} → ${href}`);
      if (x.page) assert.ok(fs.existsSync(path.join(ROOT, `p5/examples/${x.name}/index.html`)));
    }
  }
  assert.ok(read('p5/index.html').includes('<a href="../p5/examples/mic/"><code>p5/examples/mic/</code></a>'), 'the microphone sketch is linked on /p5/ (the handbook\'s p5 chapter)');
});

// ───────────── the built pages: the contents (/docs/) and one page per chapter (/docs/<chapter>/) ─────────────

const built = buildDocs();
const SITE = 'https://openaudiovisual.com/';
const CONTENTS = { en: 'docs/index.html', zh: 'zh/docs/index.html' };
const pre = (lang) => (lang === 'zh' ? 'zh/' : '');
const PAGED = DOC_PAGES.map((c) => c.id);                       // every chapter but p5, whose page is /p5/
const fileOfCh = (id, lang) => chapterFile(id, lang);
const body = (s) => s.slice(s.indexOf('<body'));
const ids = (s) => all(/\sid="([^"]+)"/g, body(s).replace(/<script[\s\S]*?<\/script>/g, ''));
const headIds = (s) => all(/<h[1-6] id="([^"]+)"/g, body(s));

test('docs string tables have the same shape', () => {
  assert.deepEqual(shapeDiff(en, zh), []);
});

test('committed pages are what the sources render (run node tools/build-docs.mjs)', () => {
  const unstamp = (s) => s.replace(/\?v=[\w.-]+/g, '');
  for (const rel of Object.keys(built.pages)) {
    assert.ok(fs.existsSync(path.join(ROOT, rel)), rel + ' missing');
    assert.equal(unstamp(read(rel)), unstamp(built.pages[rel]), rel + ' is stale');
  }
  assert.equal(Object.keys(built.pages).length, 2 + 2 * PAGED.length + 2, 'the contents, a page per chapter, and the /docs/p5/ stub, in both languages');
});

test('the build has no warnings (broken chapter links, structure drift, missing files)', () => {
  assert.deepEqual(built.warnings, []);
});

test('chapter addresses: one per chapter, none of them a folder docs/ already uses; the p5 chapter is /p5/', () => {
  assert.equal(new Set(CHAPTERS.map((c) => c.id)).size, CHAPTERS.length, 'chapter ids are unique');
  for (const c of CHAPTERS) {
    assert.ok(!RESERVED.includes(c.id), `${c.id}: not one of ${RESERVED.join(', ')}`);
    assert.match(c.id, /^[a-z0-9]+(-[a-z0-9]+)*$/, `${c.id}: lowercase, dashes`);
  }
  assert.equal(chapterPath(P5_CHAPTER), 'p5/');
  assert.deepEqual(PAGED, CHAPTERS.filter((c) => c.id !== 'p5').map((c) => c.id));
  for (const lang of ['en', 'zh']) {
    const stub = built.pages[pre(lang) + 'docs/p5/index.html'];
    assert.match(stub, /<meta name="robots" content="noindex">/, `${lang}: /docs/p5/ is not indexed`);
    assert.ok(stub.includes(`<link rel="canonical" href="${SITE}${pre(lang)}p5/">`) && /location\.replace\(".*p5\/" \+ location\.hash\)/.test(stub), `${lang}: /docs/p5/ forwards to /p5/`);
  }
});

test('every chapter has its own page in both languages, with the same anchors as the one page had', () => {
  for (const lang of ['en', 'zh']) assert.deepEqual(built.chapters[lang].map((c) => c.id), CHAPTERS.map((c) => c.id), lang);
  for (const id of PAGED) {
    const page = { en: built.pages[fileOfCh(id, 'en')], zh: built.pages[fileOfCh(id, 'zh')] };
    assert.ok(page.en && page.zh, `${id}: en and zh pages`);
    assert.deepEqual(headIds(page.zh), headIds(page.en), `${id}: zh headings mirror en (same ids, same order)`);
    assert.equal(new Set(ids(page.en)).size, ids(page.en).length, `${id}: ids are unique on the page`);
    assert.equal((page.en.match(/<h1[\s>]/g) || []).length, 1, `${id}: exactly one h1`);
    assert.match(page.en, new RegExp(`<h1 id="${id}">`), `${id}: the chapter title is the h1, with the chapter's anchor`);
    // the side contents: every chapter, this one open with its ## sections, pointing at real headings on this page
    for (const lang of ['en', 'zh']) {
      const s = page[lang], ch = built.chapters[lang].find((c) => c.id === id);
      const toc = s.slice(s.indexOf('<nav class="toc"'), s.indexOf('</nav>', s.indexOf('<nav class="toc"')));
      assert.deepEqual(all(/href="#([^"]+)"/g, toc), [id, ...ch.sections.map((x) => x.id)], `${lang} ${id}: the sections in the side contents`);
      for (const x of all(/href="#([^"]+)"/g, toc)) assert.ok(s.includes(`id="${x}"`), `${lang} ${id}: #${x} is on the page`);
      assert.equal(all(/<li class="toc-ch[ "]/g, toc).length, CHAPTERS.length, `${lang} ${id}: every chapter in the side contents`);
    }
  }
});

test('a chapter page: its title, a description from its own first paragraph, canonical, hreflang, breadcrumb, previous and next', () => {
  const want = { en: ['en', 'en'], zh: ['zh-Hant-TW', 'zh-Hant-TW'] };
  for (const lang of ['en', 'zh']) {
    const chs = built.chapters[lang];
    for (const id of PAGED) {
      const i = chs.findIndex((c) => c.id === id), ch = chs[i], s = built.pages[fileOfCh(id, lang)];
      const self = SITE + pre(lang) + `docs/${id}/`;
      assert.match(s, new RegExp(`<html lang="${want[lang][0]}">`));
      assert.ok(s.includes(`<title>${ch.title.replace(/&/g, '&amp;').replace(/</g, '&lt;')}${lang === 'zh' ? '｜' : ' · '}open-audiovisual</title>`), `${lang} ${id}: title`);
      const desc = /<meta name="description" content="([^"]*)">/.exec(s)[1].replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
      assert.equal(desc, ch.description, `${lang} ${id}: description`);
      assert.ok(desc.length >= 50 && desc.length <= 200, `${lang} ${id}: description length ${desc.length}`);
      const flat = (x) => x.replace(/\s+/g, '');
      const text = flat(body(s).replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'));
      for (const part of desc.replace(/…$/, '').split(/(?<=[。！？])|(?<=[.!?])\s/).map(flat).filter(Boolean)) assert.ok(text.includes(part), `${lang} ${id}: "${part}" is the chapter's own words`);
      assert.ok(s.includes(`<link rel="canonical" href="${self}">`), `${lang} ${id}: canonical`);
      for (const [hl, url] of [['en', `${SITE}docs/${id}/`], ['zh-Hant', `${SITE}zh/docs/${id}/`], ['x-default', `${SITE}docs/${id}/`]])
        assert.ok(s.includes(`<link rel="alternate" hreflang="${hl}" href="${url}">`), `${lang} ${id}: hreflang ${hl}`);
      const art = ldNode(s, 'TechArticle');
      assert.equal(art.url, self); assert.equal(art.headline, ch.title); assert.equal(art.inLanguage, want[lang][1]);
      const crumbs = ldNode(s, 'BreadcrumbList').itemListElement.map((x) => x.item);
      assert.deepEqual(crumbs, [SITE + pre(lang), SITE + pre(lang) + 'docs/', self], `${lang} ${id}: breadcrumb home → docs → chapter`);
      assert.match(s, /<meta name="oav-page-type" content="docs_chapter" data-oav-id="[\w-]+">/);
      // previous and next: the neighbouring chapters' pages (the p5 chapter's is /p5/)
      const nav = s.slice(s.indexOf('<nav class="ch-nav"'), s.indexOf('</nav>', s.indexOf('<nav class="ch-nav"')));
      const near = (c) => `../../${lang === 'zh' ? '../zh/' : ''}${chapterPath(c.id)}`;
      if (chs[i - 1]) assert.ok(nav.includes(`rel="prev" href="${near(chs[i - 1])}"`), `${lang} ${id}: previous is ${chs[i - 1].id}`); else assert.ok(!nav.includes('rel="prev"'));
      if (chs[i + 1]) assert.ok(nav.includes(`rel="next" href="${near(chs[i + 1])}"`), `${lang} ${id}: next is ${chs[i + 1].id}`); else assert.ok(!nav.includes('rel="next"'));
    }
  }
});

test('the contents page: every chapter with its first sentence and its sections as links, and none of the chapters\' text', () => {
  for (const lang of ['en', 'zh']) {
    const s = built.pages[CONTENTS[lang]];
    assert.ok(s.length < 80000, `${lang}: the contents is small (${s.length} bytes; the one page was 580 000)`);
    assert.ok(!/<pre[\s>]/.test(s), `${lang}: no code blocks`);
    assert.deepEqual(ids(s).sort(), ['main', 'toc', 'top'], `${lang}: no chapter's anchors (they forward to the chapter pages)`);
    const items = s.slice(s.indexOf('<ol class="contents"'), s.indexOf('</ol>', s.indexOf('<ol class="contents"')));
    for (const ch of built.chapters[lang]) {
      const href = (lang === 'zh' ? '../../zh/' : '../') + chapterPath(ch.id);
      assert.ok(items.includes(`<a href="${href}">`), `${lang}: ${ch.id} → ${href}`);
      for (const x of ch.sections) assert.ok(items.includes(`<a href="${href}#${x.id}">`), `${lang}: ${ch.id} section #${x.id}`);
      if (ch.first) assert.ok(items.includes(`<p>${ch.first.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`), `${lang}: ${ch.id}'s first sentence`);
    }
    assert.match(s, new RegExp(`<link rel="canonical" href="${SITE}${pre(lang)}docs/">`));
    const list = ldNode(s, 'ItemList');
    assert.equal(list.itemListElement.length, CHAPTERS.length, `${lang}: JSON-LD lists every chapter`);
    assert.ok(ldNode(s, 'CollectionPage'), `${lang}: a CollectionPage`);
  }
});

test('old one-page links still land: every id the committed /docs/ had, through the forwarder the page ships', () => {
  const before = JSON.parse(read('tests/fixtures/docs-anchors-before.json'));
  let n = 0;
  for (const lang of ['en', 'zh']) {
    assert.ok(before[lang].length > 250, `${lang}: the fixture has the ids (${before[lang].length})`);
    const s = built.pages[CONTENTS[lang]];
    const script = /<head>[\s\S]*?<script>(\(function\(\)\{var G=[\s\S]*?)<\/script>/.exec(s)[1];
    for (const id of before[lang]) {
      let to = null;
      vm.runInNewContext(script, { location: { hash: '#' + encodeURIComponent(id), replace: (u) => { to = u; } }, decodeURIComponent });
      if (to === null) { assert.ok(ids(s).includes(id), `${lang}: #${id} stays on /docs/ and is there`); n++; continue; }
      const land = landing(CONTENTS[lang], to);
      assert.ok(land.ok, `${lang}: /docs/#${id} → ${to} (${land.file}) has no id="${land.frag}"`);
      assert.ok(land.frag ? land.frag === id : read(land.file).includes(`id="${id}"`), `${lang}: #${id} lands on the heading itself`);
      n++;
    }
  }
  assert.equal(n, JSON.parse(read('tests/fixtures/docs-anchors-before.json')).en.length * 2);
  // and the build-time map says the same as the forwarder, for every heading there is now
  for (const [id, ch] of anchorMap()) assert.equal(chapterOfAnchor(id), ch);
});

test('no generated page links to an old one-page anchor (docs/#…): every generator writes the chapter page', () => {
  const skip = new Set(['.git', '.claude', 'node_modules', 'tests', 'tools', 'packages', 'assets', 'evolve', 'design']);
  const files = [];
  const walk = (rel) => { for (const e of fs.readdirSync(path.join(ROOT, rel), { withFileTypes: true })) { const r = rel ? `${rel}/${e.name}` : e.name; if (e.isDirectory()) { if (!skip.has(e.name)) walk(r); } else if (/\.html$/.test(e.name)) files.push(r); } };
  walk('');
  assert.ok(files.length > 300, `the scan sees the site (${files.length} pages)`);
  for (const f of files) {
    const bad = all(/(?:href|src)="([^"]*docs\/#[^"]*)"/g, read(f));
    assert.deepEqual(bad, [], `${f} links to the one-page handbook`);
  }
  for (const f of ['llms.txt', 'zh/llms.txt']) assert.deepEqual(all(/\]\((https:\/\/openaudiovisual\.com\/(?:zh\/)?docs\/#[^)]*)\)/g, read(f)), [], f);
  const idx = JSON.parse(read('assets/search/index.json'));
  assert.deepEqual((idx.records || idx).filter((r) => /docs\/#/.test(r.u)).map((r) => r.u), [], 'the search index');
});

test('code blocks are identical in English and Chinese', () => {
  const fences = (s) => [...s.matchAll(/^( {0,3})(```|~~~)[^\n]*\n([\s\S]*?)^\1\2\s*$/gm)].map((m) => m[3]);
  for (const ch of CHAPTERS) {
    if (ch.external || !fs.existsSync(path.join(ROOT, ch.en)) || !fs.existsSync(path.join(ROOT, ch.zh))) continue;
    assert.deepEqual(fences(read(ch.zh)), fences(read(ch.en)), ch.zh);
  }
});

test('every local link and asset exists, every #anchor has a target (the contents and every chapter page)', () => {
  for (const [rel, s] of Object.entries(built.pages)) {
    if (/docs\/p5\/index\.html$/.test(rel)) continue;
    for (const ref of all(/\s(?:href|src)="([^"]+)"/g, s)) {
      if (/^(https?:|data:|mailto:)/.test(ref)) continue;
      if (ref.startsWith('#')) { assert.ok(s.includes(`id="${ref.slice(1)}"`), `${rel}: ${ref} has no target`); continue; }
      const land = landing(rel, ref.replace(/\?[^#]*/, ''));
      const target = built.pages[land.file];
      if (target) { if (land.frag) assert.ok(target.includes(`id="${land.frag}"`), `${rel}: ${ref} → ${land.file} has no #${land.frag}`); continue; }
      assert.ok(fs.existsSync(path.join(ROOT, land.file)), `${rel}: ${ref} → ${land.file} missing`);
      if (land.frag && /\.html$/.test(land.file)) assert.ok(land.ok, `${rel}: ${ref} → ${land.file} has no #${land.frag}`);
    }
    // GitHub links point at files that exist in this repository
    for (const ref of all(/href="https:\/\/github\.com\/frank890417\/open-audiovisual\/(?:blob|tree)\/main\/([^"#]+)/g, s)) {
      assert.ok(fs.existsSync(path.join(ROOT, decodeURIComponent(ref))), `${rel}: GitHub link to missing ${ref}`);
    }
  }
});

test('/p5/ is the p5 chapter: every p5 heading of the handbook is on it, and it links the chapters before and after', () => {
  for (const lang of ['en', 'zh']) {
    const s = read(pre(lang) + 'p5/index.html');
    for (const h of built.chapters[lang].find((c) => c.id === 'p5').headings) assert.ok(s.includes(`id="${h.id}"`), `${lang}: /p5/ has #${h.id}`);
    const i = CHAPTERS.findIndex((c) => c.id === 'p5');
    assert.ok(s.includes(`rel="prev" href="../${lang === 'zh' ? '../zh/' : ''}docs/${CHAPTERS[i - 1].id}/"`), `${lang}: previous chapter`);
    assert.ok(s.includes(`rel="next" href="../${lang === 'zh' ? '../zh/' : ''}docs/${CHAPTERS[i + 1].id}/"`), `${lang}: next chapter`);
  }
});
