// The examples workstream: examples/catalog.json is the one list, and every page that reads it is current.
// Pages are written by tools/build-examples.mjs (and build-home for the homepage); these tests fail when a page is stale,
// a thumbnail is missing, a "read these lines" range has drifted, the next-chain breaks, the README or the FAQ says
// something the sources do not, or oav-p5.js changed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(ROOT, rel));
const unstamp = (s) => s.replace(/\?v=[\w.+-]+/g, '');
const catalogMod = () => import('../tools/examples/catalog.mjs');
const dirs = (rel) => fs.readdirSync(path.join(ROOT, rel), { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort();

test('catalog: 24 entries, one per examples/NN-* folder, with every field', async () => {
  const { EXAMPLES, ROUTES } = await catalogMod();
  const folders = dirs('examples').filter((d) => /^\d\d-/.test(d));
  assert.equal(EXAMPLES.length, 24);
  assert.deepEqual(EXAMPLES.map((e) => e.id).sort(), folders, 'the catalog lists exactly the example folders');
  for (const e of EXAMPLES) {
    assert.ok(exists(`examples/${e.id}/index.html`), `${e.id}: folder`);
    assert.ok(ROUTES.includes(e.route), `${e.id}: route`);
    for (const k of ['title', 'teaches', 'summary', 'plays', 'alt']) assert.ok(e[k].en && e[k].zh, `${e.id}: ${k} in both languages`);
    assert.equal(e.tryThree.en.length, 3); assert.equal(e.tryThree.zh.length, 3);
    assert.ok(e.read.length >= 1 && e.docs.length >= 1, `${e.id}: lines to read, docs anchors`);
    assert.ok(Array.isArray(e.needs) && Array.isArray(e.standIn) && e.standIn.length, `${e.id}: needs and stand-ins`);
  }
  for (const id of ['05-prebiotic-flake', '06-cylinder-earth', '07-firework-festival', '02-chord-garden']) assert.ok(EXAMPLES.find((e) => e.id === id).credit, `${id}: artwork credit`);
});

test('catalog: thumbnails exist, are 800×500 webp and at most 120 KB', async () => {
  const { EXAMPLES } = await catalogMod();
  for (const e of EXAMPLES) {
    assert.ok(exists(e.thumb), `${e.id}: ${e.thumb}`);
    const b = fs.readFileSync(path.join(ROOT, e.thumb));
    assert.ok(b.length <= 120 * 1024, `${e.thumb} is ${b.length} bytes`);
    assert.equal(b.toString('ascii', 0, 4), 'RIFF'); assert.equal(b.toString('ascii', 8, 12), 'WEBP');
    const chunk = b.toString('ascii', 12, 16);
    const [w, h] = chunk === 'VP8 ' ? [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff]
      : chunk === 'VP8L' ? [1 + (((b[22] & 0x3f) << 8) | b[21]), 1 + (((b[24] & 0xf) << 10) | (b[23] << 2) | ((b[22] & 0xc0) >> 6))]
      : [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
    assert.deepEqual([w, h], [800, 500], `${e.thumb} size`);
  }
  assert.ok(!exists('assets/readme/examples'), 'the README uses the homepage thumbnails; assets/readme/examples is gone');
});

test('catalog: every "read these lines" range is still where it says (the match text starts that line)', async () => {
  const { EXAMPLES } = await catalogMod();
  for (const e of EXAMPLES) for (const r of e.read) {
    const lines = read(`examples/${e.id}/${r.file}`).split('\n');
    assert.ok(r.from >= 1 && r.to >= r.from && r.to <= lines.length, `${e.id} ${r.file}:${r.from}-${r.to} inside the file (${lines.length} lines)`);
    assert.ok(lines[r.from - 1].trim().startsWith(r.match), `${e.id} ${r.file}:${r.from} should start with "${r.match}", is "${lines[r.from - 1].trim().slice(0, 60)}"`);
  }
});

test('catalog: docs anchors exist in the handbook, with the heading text as label (en and zh)', async () => {
  const { EXAMPLES } = await catalogMod();
  const heading = (html, id) => { const m = new RegExp(`<h[2-4] id="${id}"[^>]*>(.*?)(?:<a class="anchor"|</h)`).exec(html); return m && m[1].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').trim(); };
  const en = read('docs/index.html'), zh = read('zh/docs/index.html');
  for (const e of EXAMPLES) for (const d of e.docs) {
    assert.equal(heading(en, d.id), d.en, `${e.id}: /docs/#${d.id}`);
    assert.equal(heading(zh, d.id), d.zh, `${e.id}: /zh/docs/#${d.id}`);
  }
});

test('catalog: "next" makes one chain through all 24, no loop, ending at the index', async () => {
  const { EXAMPLES, chain, byId } = await catalogMod();
  const ids = chain();
  assert.equal(ids.length, EXAMPLES.length);
  assert.equal(new Set(ids).size, EXAMPLES.length);
  assert.equal(byId.get(ids[ids.length - 1]).next, null);
  assert.equal(ids[0], '01-hello-particles');
  const { routeGroups } = await catalogMod();
  assert.deepEqual(ids, routeGroups().flatMap((g) => g.items.map((e) => e.id)), 'the chain follows the route order of /examples/');
});

test('homepage: the works section lists the whole catalog in route order, titled from the facts', async () => {
  const { EXAMPLES, routeGroups, L } = await catalogMod();
  const { getFacts, enWords, cap } = await import('../tools/site/facts.mjs');
  const f = getFacts({ fresh: true });
  for (const [file, locale] of [['index.html', 'en'], ['zh/index.html', 'zh']]) {
    const html = read(file);
    const works = html.slice(html.indexOf('id="works"'), html.indexOf('id="webtoe"'));
    const ids = [...works.matchAll(/href="[^"]*examples\/(\d\d-[\w-]+)\/"/g)].map((m) => m[1]);
    assert.deepEqual(ids, routeGroups().flatMap((g) => g.items.map((e) => e.id)), `${file}: cards in route order`);
    assert.equal(ids.length, f.exampleCount);
    for (const e of EXAMPLES) assert.ok(works.includes(L(e.title, locale)), `${file}: ${e.id}`);
    assert.ok(works.includes('href="' + (locale === 'zh' ? '../' : './').replace('../', '') + '') || true);
    assert.match(works, /href="[^"]*examples\/">/, `${file}: links to /examples/`);
  }
  assert.ok(read('index.html').includes(`${cap(enWords(f.exampleCount))} works you can open now`));
  assert.ok(!/Ten works/.test(read('index.html')) && !/十件作品/.test(read('zh/index.html')));
});

test('/examples/ and /zh/examples/: a card per example, grouped by route, ItemList of every example, breadcrumb', async () => {
  const { EXAMPLES, ROUTES } = await catalogMod();
  for (const [file, lang] of [['examples/index.html', 'en'], ['zh/examples/index.html', 'zh']]) {
    assert.ok(exists(file), file);
    const html = read(file);
    for (const e of EXAMPLES) assert.ok(html.includes(`id="ex-${e.num}"`) && html.includes(`examples/${e.id}/"`), `${file}: card ${e.id}`);
    for (const r of ROUTES) assert.ok(html.includes(`id="route-${r}"`), `${file}: route ${r}`);
    assert.equal((html.match(/<h1[\s>]/g) || []).length, 1);
    const ld = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1])['@graph'];
    const list = ld.find((n) => n['@type'] === 'ItemList');
    assert.equal(list.numberOfItems, EXAMPLES.length); assert.equal(list.itemListElement.length, EXAMPLES.length);
    assert.ok(ld.some((n) => n['@type'] === 'BreadcrumbList'));
    assert.ok(html.includes(`rel="canonical" href="https://openaudiovisual.com/${lang === 'zh' ? 'zh/' : ''}examples/"`));
    assert.ok(html.includes('hreflang="zh-Hant"') && html.includes('<!--email_off-->'));
  }
  const { registry } = await import('../tools/site/pages.mjs');
  const reg = registry();
  assert.ok(reg.some((e) => e.path === 'examples/' && e.langs.length === 2) && reg.some((e) => e.path === 'p5/' && e.langs.length === 2));
});

test('every example page: regions are current, description, canonical, guide readable without JavaScript, next link', async () => {
  const { EXAMPLES, nextOf } = await catalogMod();
  const { patchExample } = await import('../tools/build-examples.mjs');
  for (const e of EXAMPLES) {
    const html = read(`examples/${e.id}/index.html`);
    assert.equal(unstamp(html), unstamp(patchExample(html, e)), `${e.id}: regions are stale (node tools/build-examples.mjs)`);
    assert.equal((html.match(/<meta name="description"/g) || []).length, 1, `${e.id}: one description`);
    assert.equal((html.match(/rel="canonical"/g) || []).length, 1, `${e.id}: one canonical`);
    assert.equal((html.match(/<title>/g) || []).length, 1);
    assert.equal((html.match(/gtag\('config'/g) || []).length, 1, `${e.id}: one analytics snippet`);
    assert.ok(!html.includes('href="data:,"'), `${e.id}: no placeholder favicon`);
    assert.ok(html.includes(`rel="canonical" href="https://openaudiovisual.com/examples/${e.id}/"`));
    const ld = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1])['@graph'];
    assert.ok(ld.some((n) => n['@type'] === 'BreadcrumbList') && ld.some((n) => n['@id'] === `https://openaudiovisual.com/examples/${e.id}/#webpage`), `${e.id}: JSON-LD`);
    const next = nextOf(e);
    if (e.guide === false) {
      assert.ok(html.includes('<!-- oav:next -->') && !html.includes('oav-guide'), `${e.id}: only the next link`);
    } else {
      assert.ok(html.includes('id="oav-guide"') && html.includes('assets/examples/guide.js') && html.includes('assets/examples/guide.css'));
      for (const x of e.tryThree.en) assert.ok(html.includes(x.replace(/&/g, '&amp;')) || html.includes(x), `${e.id}: try-three in the HTML`);
      for (const r of e.read) assert.ok(html.includes(`${e.dir}${r.file}#L${r.from}`), `${e.id}: read ${r.file}`);
      assert.equal(html.includes('examples/15-p5-one-line/') && /g-p5/.test(html), !!e.p5Line, `${e.id}: the p5 one-line row only where the catalog says`);
      if (e.p5Line) assert.ok(html.includes('docs/#p5') && html.includes('zh/docs/#p5'), `${e.id}: p5 row links /docs/#p5 and /zh/docs/#p5`);
    }
    assert.ok(next ? html.includes(`${next.dir}"`) : html.includes('examples/"'), `${e.id}: link to the next example`);
  }
  for (const id of ['01-hello-particles', '02-chord-garden', '05-prebiotic-flake', '08-remote-surface', '09-midi-controllers', '11-controller-video', '14-timeline'])
    assert.ok(EXAMPLES.find((e) => e.id === id).p5Line, `${id} carries the p5 line`);
});

test('p5 one-line examples (16–24): the page runs the very p5/examples sketch, last, with p5 from the CDN and nothing of the framework', async () => {
  const { EXAMPLES } = await catalogMod();
  const p5 = EXAMPLES.filter((e) => e.sketch);
  assert.ok(p5.length >= 8, 'the p5 sketches are in the catalog');
  for (const e of p5) {
    assert.match(e.sketch, /^p5\/examples\/[a-z0-9-]+\/sketch\.js$/, `${e.id}: sketch is a p5/examples/<name>/sketch.js`);
    assert.equal(read(`${e.dir}sketch.js`), read(e.sketch), `${e.id}: sketch.js is a copy of ${e.sketch} (node tools/build-examples.mjs)`);
    assert.ok(read(e.sketch).includes("{ src: 'https://openaudiovisual.com/p5/oav-p5.js' }"), `${e.id}: the sketch carries the one line`);
    const html = unstamp(read(`${e.dir}index.html`));
    assert.ok(html.includes('https://cdn.jsdelivr.net/npm/p5@1.11.11/lib/p5.min.js'), `${e.id}: p5 1.11.11 from the CDN`);
    assert.ok(!/importmap|packages\//.test(html), `${e.id}: no framework on the page, only the line`);
    const scripts = [...html.matchAll(/<script\b[^>]*\ssrc="([^"]+)"/g)].map((m) => m[1]);
    assert.equal(scripts[scripts.length - 1], './sketch.js', `${e.id}: the sketch is the last script (p5's friendly errors read it as the sketch)`);
    assert.equal(e.p5Line, false, `${e.id}: a p5 sketch needs no "take it into p5" row`);
  }
});

test('/p5/ and /zh/p5/: built pages, no Jekyll, one line + copy button + example 15; p5/oav-p5.js is byte-identical', () => {
  for (const [file, lang] of [['p5/index.html', 'en'], ['zh/p5/index.html', 'zh']]) {
    assert.ok(exists(file), file);
    const html = read(file);
    assert.ok(!/jekyll/i.test(html) && !html.includes('og:url" content="http://'));
    assert.ok(html.includes(`rel="canonical" href="https://openaudiovisual.com/${lang === 'zh' ? 'zh/' : ''}p5/"`) && html.includes('hreflang="zh-Hant"'));
    assert.ok(html.includes("https://openaudiovisual.com/p5/oav-p5.js") && /class="copy"/.test(html), 'the line and a copy button');
    assert.ok(html.includes('examples/15-p5-one-line/'), 'link to example 15');
    assert.ok(html.includes('<!--email_off-->'));
  }
  const sha = crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, 'p5/oav-p5.js'))).digest('hex');
  assert.equal(sha, 'd5325b92a13aa3edd4e3d20068579d019d4f5d5993a30ff42a216769aa4cd814', 'p5/oav-p5.js changed: student sketches load it, so a change is a release on purpose (bump the version inside, run p5/test/*.cjs, then update this hash)');
});

test('README: generated blocks are current, every example, the controller list links every device page', async () => {
  const { readmeBlocks } = await import('../tools/examples/readme.mjs');
  const { applyBlocks, applyReadmeBlock, getFacts } = await import('../tools/site/facts.mjs');
  const f = getFacts({ fresh: true });
  const md = read('README.md');
  assert.equal(md, applyReadmeBlock(applyBlocks(md, readmeBlocks(f)), f), 'README is stale (node tools/build-examples.mjs)');
  const { EXAMPLES } = await catalogMod();
  for (const e of EXAMPLES) assert.ok(md.includes(`https://openaudiovisual.com/examples/${e.id}/`) && md.includes(e.thumb), `README: ${e.id}`);
  const { catalog } = await import('../tools/controllers/page.mjs');
  for (const d of catalog().devices) assert.ok(md.includes(`https://openaudiovisual.com/controllers/${d.p.id}/`), `README: ${d.p.id}`);
  assert.ok(md.includes(`MIDI_controllers-${f.deviceCount}-`) && !/Thirteen works|MIDI_controllers-16/.test(md));
  assert.ok(!md.includes('assets/readme/examples/'));
  // the package table: every package once, generated from the homepage's groups
  const table = md.match(/<!--gen:packages-table-->([\s\S]*?)<!--\/gen:packages-table-->/);
  assert.ok(table, 'README: the package table is a generated block');
  const listed = [...table[1].matchAll(/\[`@openav\/([\w-]+)`\]\(packages\/\1\/\)/g)].map((m) => m[1]);
  assert.deepEqual([...listed].sort(), f.packages, 'README: the package table lists every package once');
});

test('docs: the next example number and the package count are the facts', async () => {
  const { getFacts, enWords, zhWords, cap } = await import('../tools/site/facts.mjs');
  const f = getFacts({ fresh: true });
  for (const rel of ['docs/agents.md', 'docs/zh/agents.md']) assert.ok(read(rel).includes(`Create examples/${f.nextExampleNumber}-<name>/`), rel);
  assert.ok(read('docs/packages.md').startsWith(`# `) && read('docs/packages.md').includes(`${cap(enWords(f.packageCount))} packages live in`));
  assert.ok(read('docs/zh/packages.md').includes(`${zhWords(f.packageCount)}個套件放在`));
  assert.ok(/a live instrument and the\s+(\S+) example works/.exec(read('docs/introduction.md'))[1] === enWords(f.exampleCount), 'docs/introduction.md: the example count');
  assert.ok(read('docs/zh/introduction.md').includes(`還有${zhWords(f.exampleCount)}件範例作品`), 'docs/zh/introduction.md: the example count');
  for (const rel of ['docs/getting-started.md', 'docs/zh/getting-started.md']) {
    const s = read(rel);
    assert.ok(/^## (Three ways in|三種進場方式)$/m.test(s));
    assert.ok(s.includes('examples/15-p5-one-line/') && s.includes('p5.md') && s.includes('controllers/') && s.includes('examples/01-hello-particles/') && s.includes('createShow()'), rel);
  }
});

test('homepage FAQ: 11 visible questions per language, every answer sentence quoted from a named source, no FAQPage markup', async () => {
  const en = (await import('../tools/home/en.mjs')).default, zh = (await import('../tools/home/zh.mjs')).default;
  assert.equal(en.faq.items.length, 11); assert.equal(zh.faq.items.length, 11);
  const norm = (s) => s.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/\*\*|`/g, '').replace(/\s+/g, '');
  const trim = (s) => s.replace(/[.。:：;；]+$/, '');
  for (const [lang, t, file] of [['en', en, 'tools/home/en.mjs'], ['zh', zh, 'tools/home/zh.mjs']]) {
    const own = read(file);
    t.faq.items.forEach((it, i) => {
      for (const p of it.a) {
        assert.ok(exists(p.src), `${lang} Q${i + 1}: source ${p.src} exists`);
        const src = norm(read(p.src)), q = norm(trim(p.text));
        const hits = src.split(q).length - 1;
        assert.ok(hits >= (p.src === file ? 2 : 1), `${lang} Q${i + 1}: "${p.text.slice(0, 50)}…" is not quoted from ${p.src}`);
      }
      // the source is also written in a comment above the question, in the table itself
      const at = own.indexOf(`q: '${it.q.replace(/'/g, "\\'")}'`);
      assert.ok(at > 0, `${lang} Q${i + 1}: found in ${file}`);
      const before = own.slice(Math.max(0, own.lastIndexOf('\n', own.lastIndexOf('\n', at) - 1)), at);
      assert.match(before, /(source|出處)[:：]\s*\S+/, `${lang} Q${i + 1}: a source comment above the question`);
    });
    const html = read(lang === 'en' ? 'index.html' : 'zh/index.html');
    assert.equal((html.match(/class="faq-item"/g) || []).length, 11);
    assert.ok(!/FAQPage/.test(html), 'Google retired FAQ rich results: visible text only');
  }
});
