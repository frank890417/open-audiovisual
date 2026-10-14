// The site's search and AI plumbing: facts computed from the repository, llms.txt, the page register and the
// sitemap, the shared <head> (canonical, hreflang, Open Graph, icons), JSON-LD that links up, the Cloudflare
// email-obfuscation fence, the 404 page, robots.txt. Companion to the per-page tests (home, docs, controllers,
// webtoe), which check each page's own content.
//
// Tests that need the new modules import them inside the test (await import), so on a checkout without them
// each one fails on its own instead of the whole file failing to load.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(ROOT, rel));
const dirs = (rel) => fs.readdirSync(path.join(ROOT, rel), { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort();
const SITE = 'https://openaudiovisual.com/';
const git = (...args) => { try { return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return ''; } };

/** Every generated page (not the hand-written example pages, which the examples workstream owns): { rel, html }. */
function generatedPages() {
  const rels = ['index.html', 'zh/index.html', 'docs/index.html', 'zh/docs/index.html', 'controllers/index.html', 'zh/controllers/index.html', 'webtoe/index.html', 'zh/webtoe/index.html'];
  for (const base of ['controllers', 'zh/controllers']) for (const d of dirs(base)) if (exists(`${base}/${d}/index.html`)) rels.push(`${base}/${d}/index.html`);
  return rels.map((rel) => ({ rel, html: read(rel) }));
}
const pagesCache = generatedPages();
const ldOf = (html) => {
  const m = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  return { count: m.length, graph: m.length ? JSON.parse(m[0][1])['@graph'] : null };
};

// ---------------------------------------------------------------------------- facts
test('facts: the numbers equal what is on disk', async () => {
  const { getFacts } = await import('../tools/site/facts.mjs');
  const f = getFacts({ fresh: true });
  const examples = dirs('examples').filter((d) => /^\d\d-/.test(d) && exists(`examples/${d}/index.html`));
  assert.equal(f.exampleCount, examples.length);
  assert.deepEqual(f.examples.map((e) => e.id), examples);
  assert.equal(f.packageCount, dirs('packages').filter((d) => exists(`packages/${d}/package.json`)).length);
  const profiles = fs.readdirSync(path.join(ROOT, 'packages/midi/profiles')).filter((x) => x.endsWith('.json'));
  assert.equal(f.controllerCount, profiles.length);
  assert.equal(f.deviceCount + f.genericCount, f.controllerCount);
  assert.equal(f.deviceCount, profiles.filter((x) => JSON.parse(read(`packages/midi/profiles/${x}`)).kind === 'device').length);
  assert.ok(f.controlCount > f.deviceCount, 'controls counted');
  assert.equal(f.testFiles, fs.readdirSync(path.join(ROOT, 'tests')).filter((x) => x.endsWith('.test.js')).length);
  assert.ok(f.testCount >= f.testFiles, 'test cases counted');
  const max = Math.max(...examples.map((d) => Number(d.slice(0, 2))));
  assert.equal(f.nextExampleNumber, String(max + 1).padStart(2, '0'));
  assert.equal(f.version, JSON.parse(read('package.json')).version);
});

test('facts: numbers as words (en, zh) and the README block', async () => {
  const { enWords, zhWords, applyReadmeBlock, README_MARK, getFacts } = await import('../tools/site/facts.mjs');
  assert.deepEqual([0, 7, 13, 20, 21, 23, 99].map(enWords), ['zero', 'seven', 'thirteen', 'twenty', 'twenty-one', 'twenty-three', 'ninety-nine']);
  assert.deepEqual([3, 10, 11, 20, 21, 23, 99].map(zhWords), ['三', '十', '十一', '二十', '二十一', '二十三', '九十九']);
  const f = getFacts();
  const out = applyReadmeBlock(`before\n${README_MARK[0]}\nold numbers\n${README_MARK[1]}\nafter\n`, f);
  assert.ok(out.includes(`${f.packageCount} packages`) && !out.includes('old numbers') && out.startsWith('before\n') && out.endsWith('after\n'));
  assert.equal(applyReadmeBlock('no markers here', f), 'no markers here', 'no markers, no change');
});

test('home: the numbers in the prose come from the facts, not from memory', async () => {
  const { getFacts, enWords, zhWords, cap } = await import('../tools/site/facts.mjs');
  const f = getFacts();
  const en = read('index.html'), zh = read('zh/index.html');
  assert.ok(en.includes(`${cap(enWords(f.packageCount))} packages, by layer`), 'en package count');
  assert.ok(zh.includes(`${zhWords(f.packageCount)}個套件`), 'zh package count');
  assert.ok(!/Twenty-one packages/.test(en) && !/二十一個套件/.test(zh), 'no stale count');
  for (const [lang, s] of [['en', en], ['zh', zh]]) {
    assert.ok(s.includes(`examples/${f.nextExampleNumber}-`), `${lang}: next example number is ${f.nextExampleNumber}`);
    assert.ok(!s.includes('examples/10-&lt;') && !s.includes('examples/10-pulse') && !/examples\/10-<(name|名稱)>/.test(s), `${lang}: no hard-coded examples/10-`);
    const cards = [...s.matchAll(/<li><a href="https:\/\/github\.com\/[^"]+\/tree\/main\/packages\/([\w-]+)"/g)].map((m) => m[1]);
    assert.deepEqual([...cards].sort(), f.packages, `${lang}: the package list shows every package once`);
  }
});

// ---------------------------------------------------------------------------- llms.txt
test('llms.txt (en, zh): generated, complete, no GitHub raw links', async () => {
  const { getFacts } = await import('../tools/site/facts.mjs');
  const { llmsTxt } = await import('../tools/site/llms.mjs');
  const { CHAPTERS } = await import('../tools/docs/chapters.mjs');
  const { DOC_BLURB } = await import('../tools/site/llms.mjs');
  const f = getFacts();
  const profiles = fs.readdirSync(path.join(ROOT, 'packages/midi/profiles')).filter((x) => x.endsWith('.json')).map((x) => JSON.parse(read(`packages/midi/profiles/${x}`)).id);
  for (const [lang, file] of [['en', 'llms.txt'], ['zh', 'zh/llms.txt']]) {
    const s = read(file);
    assert.equal(s, llmsTxt(lang), `${file} is what the generator writes (node tools/build-home.mjs)`);
    assert.match(s, /^# open-audiovisual\n\n> \S/, `${file}: llmstxt.org shape`);
    assert.ok(s.includes('\n## Optional\n'), `${file}: Optional section`);
    assert.ok(!s.includes('raw.githubusercontent.com'), `${file}: links point at this site`);
    for (const e of f.examples) assert.ok(s.includes(`${SITE}examples/${e.id}/`), `${file}: example ${e.id}`);
    for (const id of profiles) assert.ok(s.includes(`${SITE}${lang === 'zh' ? 'zh/' : ''}controllers/${id}/`), `${file}: device page ${id}`);
    for (const p of f.packages) assert.ok(new RegExp(`\`${p}\``).test(s), `${file}: package ${p}`);
    for (const ch of CHAPTERS) {
      assert.ok(DOC_BLURB[ch.id], `a one-line blurb for the chapter "${ch.id}" (tools/site/llms.mjs DOC_BLURB)`);
      assert.ok(s.includes(`${SITE}docs/${lang === 'zh' ? 'zh/' : ''}${path.posix.basename(ch.en)}`), `${file}: chapter ${ch.id}`);
    }
    assert.ok(s.includes(`${SITE}p5/`) && s.includes(`docs/${lang === 'zh' ? 'zh/' : ''}p5.md`), `${file}: the p5 one-liner`);
    assert.ok(s.includes('13-score-director') && s.includes('15-p5-one-line'), `${file}: examples 13 and 15`);
    assert.ok(s.includes(`examples/${f.nextExampleNumber}-`), `${file}: the next example number`);
    assert.ok(s.includes('packages/mcp/server.js') && s.includes('Che-Yu Wu') && s.includes('https://github.com/frank890417/open-audiovisual'), `${file}: MCP, author, repository`);
    assert.ok(s.includes(`${f.packageCount}`) && s.includes(`${f.controllerCount}`), `${file}: counts`);
  }
  assert.ok(read('zh/llms.txt').includes(`${SITE}zh/`), 'zh/llms.txt points at the zh site');
});

test('every url llms.txt links to on this site is a file the repository serves', () => {
  for (const file of ['llms.txt', 'zh/llms.txt']) {
    for (const m of read(file).matchAll(/\]\((https:\/\/openaudiovisual\.com\/[^)\s]*)\)/g)) {
      const rel = m[1].slice(SITE.length);
      const f = rel === '' || rel.endsWith('/') ? rel + 'index.html' : rel;
      assert.ok(exists(f) || exists(rel.replace(/\/$/, '') + '/README.md') || rel === 'p5/', `${file}: ${m[1]} → ${f} missing`);
    }
  }
});

test('htmlToText: HTML in Markdown becomes plain text; code stays exactly as written', async () => {
  const { htmlToText } = await import('../tools/site/llms.mjs');
  const md = [
    '# Title', '',
    '<div align="center">', '  <picture><source media="(prefers-color-scheme: dark)" srcset="d.png"><img src="l.png" alt="Banner alt" width="600"></picture>', '  <p align="center"><b>open-audiovisual</b><br>zero build</p>', '</div>', '',
    '<table>', '<thead><tr><th>Device</th><th>CC</th></tr></thead>', '<tbody>', '<tr><td><a href="https://openaudiovisual.com/controllers/akai-lpd8/">LPD8</a></td><td><code>70</code></td></tr>',
    '<tr><td><img src="x.png" alt=""></td><td>press <kbd>Space</kbd></td></tr>', '</tbody></table>', '',
    '<!-- a comment -->', '<details><summary>More</summary>', '', 'hidden text', '', '</details>', '',
    'Prose with `<script type="module">` and a <name> placeholder stays.', '',
    '```html', '<div class="keep">  <table><tr><td>p5@1.9.4</td></tr></table> </div>', '```', '',
    'after the fence <b>bold</b> done',
  ].join('\n');
  const out = htmlToText(md);
  for (const tag of ['<div', '<table', '<tr', '<td', '<picture', '<img', '<p ', '<b>', '<br', '<details', '<summary', '<kbd', '<!--']) {
    const outsideFence = out.replace(/```[\s\S]*?```/g, '');
    assert.ok(!outsideFence.includes(tag), `${tag} removed outside code fences`);
  }
  assert.ok(out.includes('Banner alt') && out.includes('open-audiovisual') && out.includes('zero build'));
  assert.ok(out.includes('Device | CC') && out.includes('[LPD8](https://openaudiovisual.com/controllers/akai-lpd8/) | `70`'), 'table rows become "a | b" lines: ' + JSON.stringify(out));
  assert.ok(out.includes('press Space') && out.includes('hidden text') && out.includes('**More**'));
  assert.ok(out.includes('`<script type="module">`') && out.includes('<name> placeholder'), 'inline code and unknown <words> untouched');
  assert.ok(out.includes('<div class="keep">  <table><tr><td>p5@1.9.4</td></tr></table> </div>'), 'fenced code untouched');
  assert.ok(out.includes('after the fence **bold** done'));
  assert.ok(!/\n{3,}/.test(out), 'no runs of blank lines');
  assert.equal(htmlToText('# plain\n\nno html here, a < b and 1 > 0\n'), '# plain\n\nno html here, a < b and 1 > 0\n', 'plain Markdown passes through');
});

test('htmlToText: a README made of HTML tables, picture galleries and centered blocks', async () => {
  const { htmlToText } = await import('../tools/site/llms.mjs');
  const md = [
    '<p align="center">', '  <a href="https://openaudiovisual.com"><img src="assets/home/og.png" alt="open-audiovisual" width="640"></a>', '</p>', '',
    '<h1 align="center">open-audiovisual</h1>', '',
    '<table>', '  <tr>',
    '    <td align="center" width="33%"><a href="https://openaudiovisual.com/controllers/akai-lpd8/"><img src="a.webp" width="200"><br><sub><b>AKAI LPD8</b></sub></a></td>',
    '    <td align="center"><a href="https://x.test/b"><picture><source srcset="b.avif"><img src="b.webp" alt="Arturia MiniLab 3"></picture></a><br>MiniLab 3</td>',
    '    <td>Plain cell with <code>CC 74</code> &amp; <em>notes</em></td>', '  </tr>', '  <tr><th colspan="3">Wide header</th></tr>', '</table>', '',
    '| a | b |', '|---|---|', '| md table | stays |', '',
    '<p>Run <kbd>node serve.js</kbd> then see <a href="#start">start</a>.</p>', '<br/>', '<img src="only-image.png">',
  ].join('\n');
  const out = htmlToText(md);
  assert.ok(!/[<>]/.test(out.replace(/`[^`]*`/g, '')), 'no angle brackets left: ' + JSON.stringify(out));
  assert.ok(out.includes('[AKAI LPD8](https://openaudiovisual.com/controllers/akai-lpd8/) | [Arturia MiniLab 3](https://x.test/b) MiniLab 3 | Plain cell with `CC 74` & notes'));
  assert.ok(out.includes('Wide header') && out.includes('| md table | stays |') && out.includes('Run node serve.js then see start.'));
  assert.ok(out.includes('# open-audiovisual'), 'a heading stays a heading');
});

test('llms-full.txt: every source in, no HTML noise outside code, versions intact', async () => {
  const { llmsFull, LLMS_SOURCES } = await import('../tools/site/llms.mjs');
  const full = read('llms-full.txt');
  assert.equal(full, llmsFull(), 'llms-full.txt is what the generator writes (node tools/build-home.mjs)');
  for (const src of LLMS_SOURCES) assert.ok(full.includes(`<!-- source: ${src} -->`), `source ${src}`);
  const outside = full.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]+`/g, '');
  assert.ok(!/<\/?(div|table|tr|td|th|picture|img|p|center|details|summary|source)[\s>/]/i.test(outside), 'no HTML block tags outside code');
  assert.ok(full.includes('npm/p5@1.9.4/lib/p5.min.js'), 'a versioned CDN url (p5@1.9.4) survives');
  assert.ok(full.includes('/controllers/akai-lpd8/'), 'controller summary table');
});

// ---------------------------------------------------------------------------- register and sitemap
test('register: every registered page exists, every indexable page on disk is registered', async () => {
  const { registry, fileOf } = await import('../tools/site/pages.mjs');
  const reg = registry();
  assert.equal(new Set(reg.map((e) => e.path)).size, reg.length, 'no page registered twice');
  for (const e of reg) for (const lang of e.langs) {
    const f = fileOf(e, lang);
    assert.ok(exists(f) && fs.statSync(path.join(ROOT, f)).size > 0, `${e.id} (${lang}): ${f} exists and is not empty`);
  }
  // every index.html that is a public page (not a demo, embed, package, tool): registered, or says noindex
  const skip = new Set(['assets', 'packages', 'embed', 'p5', 'tests', 'tools', 'node_modules', '.git', '.wrangler', 'docs/design']);
  const pages = [];
  const walk = (rel) => {
    for (const e of fs.readdirSync(path.join(ROOT, rel), { withFileTypes: true })) {
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) { if (!skip.has(r) && !skip.has(e.name)) walk(r); } else if (e.name === 'index.html') pages.push(r);
    }
  };
  walk('');
  const registered = new Set(reg.flatMap((e) => e.langs.map((l) => fileOf(e, l))));
  for (const p of pages) if (!registered.has(p)) assert.match(read(p), /<meta name="robots" content="[^"]*noindex/, `${p} is neither registered nor noindex: add it to tools/site/pages.mjs`);
});

test('sitemap.xml: every url is in the register, every registered url is in the sitemap, lastmod is real', async () => {
  const { registry, urls, sitemapXml, unstamp } = await import('../tools/site/pages.mjs');
  const sm = read('sitemap.xml');
  assert.equal(unstamp(sm), unstamp(sitemapXml()), 'sitemap.xml is what the generator writes (node tools/build-home.mjs)');
  const locs = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  assert.equal(new Set(locs).size, locs.length, 'no duplicate <loc>');
  const want = urls(registry()).map((u) => u.loc);
  assert.deepEqual([...locs].sort(), [...want].sort(), 'sitemap urls = register urls');
  const blocks = [...sm.matchAll(/<url>[\s\S]*?<\/url>/g)].map((m) => m[0]);
  for (const u of urls(registry())) {
    const b = blocks.find((x) => x.includes(`<loc>${u.loc}</loc>`));
    const lm = b.match(/<lastmod>([^<]*)<\/lastmod>/);
    if (lm) {
      assert.match(lm[1], /^\d{4}-\d{2}-\d{2}$/, `${u.loc}: lastmod is a date`);
      const src = u.entry.src.map((s) => git('log', '-1', '--format=%cs', '--', s)).filter(Boolean).sort().pop();
      assert.equal(lm[1], src, `${u.loc}: lastmod is the last commit that touched ${u.entry.src.join(', ')}`);
    } else assert.ok(!u.entry.src.some((s) => git('log', '-1', '--format=%cs', '--', s)), `${u.loc}: a page with history has a lastmod`);
    const hreflangs = [...b.matchAll(/hreflang="([^"]+)" href="([^"]+)"/g)].map((m) => m.slice(1).join(' '));
    if (u.entry.langs.length === 2) assert.deepEqual(hreflangs, [`en ${SITE}${u.entry.path}`, `zh-Hant ${SITE}zh/${u.entry.path}`, `x-default ${SITE}${u.entry.path}`], `${u.loc}: hreflang trio`);
    else assert.deepEqual(hreflangs, [], `${u.loc}: a one-language page has no hreflang`);
  }
  assert.ok(!/<(changefreq|priority)>/.test(sm), 'Google ignores changefreq and priority');
});

test('sitemap.xml is one file: every generator writes the same bytes', async () => {
  const { sitemapXml } = await import('../tools/site/pages.mjs');
  const { buildPages } = await import('../tools/build-controllers.mjs');
  assert.equal(buildPages()['sitemap.xml'], sitemapXml());
  for (const f of ['build-home.mjs', 'build-docs.mjs', 'build-webtoe.mjs', 'build-controllers.mjs']) assert.ok(/sitemapXml\(\)/.test(read(`tools/${f}`)), `${f} writes sitemap.xml through sitemapXml()`);
});

// ---------------------------------------------------------------------------- the shared <head>
const meta = (html, sel) => { const m = html.match(new RegExp(`<meta ${sel} content="([^"]*)">`)); return m ? m[1] : null; };
const linkHref = (html, rel) => { const m = html.match(new RegExp(`<link rel="${rel}" href="([^"]*)"`)); return m ? m[1] : null; };

test('every generated page: canonical, hreflang trio, Open Graph with image alt, Twitter, icons, manifest, describedby', () => {
  assert.ok(pagesCache.length >= 8 + 2 * 20, `${pagesCache.length} generated pages`);
  for (const { rel, html } of pagesCache) {
    const self = SITE + rel.replace(/index\.html$/, '');
    const twin = rel.startsWith('zh/') ? SITE + rel.slice(3).replace(/index\.html$/, '') : SITE + 'zh/' + rel.replace(/index\.html$/, '');
    const en = rel.startsWith('zh/') ? twin : self, zh = rel.startsWith('zh/') ? self : twin;
    assert.equal(linkHref(html, 'canonical'), self, `${rel}: canonical`);
    for (const [hl, url] of [['en', en], ['zh-Hant', zh], ['x-default', en]]) assert.ok(html.includes(`<link rel="alternate" hreflang="${hl}" href="${url}">`), `${rel}: hreflang ${hl}`);
    assert.equal(meta(html, 'property="og:url"'), self, `${rel}: og:url`);
    assert.match(meta(html, 'property="og:image"') || '', /^https:\/\/openaudiovisual\.com\/assets\/.+\.(png|webp|jpg)$/, `${rel}: og:image`);
    assert.ok((meta(html, 'property="og:image:alt"') || '').length > 20, `${rel}: og:image:alt`);
    assert.equal(meta(html, 'property="og:image:width"'), '1200');
    assert.equal(meta(html, 'property="og:image:height"'), '630');
    assert.match(meta(html, 'property="og:type"') || '', /^(website|article)$/, `${rel}: og:type`);
    assert.ok(['en_US', 'zh_TW'].includes(meta(html, 'property="og:locale"')), `${rel}: og:locale`);
    assert.ok(['en_US', 'zh_TW'].includes(meta(html, 'property="og:locale:alternate"')) && meta(html, 'property="og:locale:alternate"') !== meta(html, 'property="og:locale"'), `${rel}: og:locale:alternate`);
    for (const n of ['title', 'description', 'image', 'image:alt']) assert.ok(meta(html, `name="twitter:${n}"`), `${rel}: twitter:${n}`);
    assert.equal(meta(html, 'name="twitter:card"'), 'summary_large_image');
    assert.match(html, /<link rel="icon" href="[^"]*favicon\.ico" sizes="48x48">/, `${rel}: favicon.ico`);
    assert.match(html, /<link rel="icon" href="[^"]*favicon\.svg" type="image\/svg\+xml"/, `${rel}: favicon.svg`);
    assert.match(html, /<link rel="apple-touch-icon" href="[^"]*apple-touch-icon\.png">/, `${rel}: apple-touch-icon`);
    assert.match(html, /<link rel="manifest" href="[^"]*site\.webmanifest">/, `${rel}: manifest`);
    assert.match(html, /<link rel="describedby" href="[^"]*llms\.txt"/, `${rel}: llms.txt pointer`);
    assert.ok(!html.includes('rel="icon" href="data:'), `${rel}: no data: URI favicon`);
    const t = html.match(/<title>([^<]+)<\/title>/)[1];
    assert.ok(t.length > 10 && t.length <= 90, `${rel}: title length ${t.length}`);
    assert.ok(meta(html, 'name="description"').length >= 50 && meta(html, 'name="description"').length <= 200, `${rel}: description length`);
    // the relative icon paths land on real files
    const dir = path.dirname(path.join(ROOT, rel));
    for (const m of html.matchAll(/<link rel="(?:icon|apple-touch-icon|manifest)" href="([^"]+)"/g)) assert.ok(fs.existsSync(path.join(dir, m[1])), `${rel}: ${m[1]} exists`);
  }
});

test('icon files are real: favicon.ico (16/32/48 PNGs), favicon.svg, apple-touch-icon 180 px, manifest icons, site.webmanifest', () => {
  const ico = fs.readFileSync(path.join(ROOT, 'favicon.ico'));
  assert.deepEqual([...ico.subarray(0, 4)], [0, 0, 1, 0], 'ICO header');
  assert.equal(ico.readUInt16LE(4), 3, 'three sizes');
  assert.ok(read('favicon.svg').includes('<svg') && read('favicon.svg').includes('#ff5a1f'));
  const png = (rel) => { const b = fs.readFileSync(path.join(ROOT, rel)); assert.deepEqual([...b.subarray(1, 4)], [80, 78, 71], `${rel} is a PNG`); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };
  assert.deepEqual(png('apple-touch-icon.png'), [180, 180]);
  assert.deepEqual(png('assets/icons/icon-192.png'), [192, 192]);
  assert.deepEqual(png('assets/icons/icon-512.png'), [512, 512]);
  const m = JSON.parse(read('site.webmanifest'));
  assert.equal(m.name, 'open-audiovisual');
  for (const i of m.icons) assert.ok(exists(i.src.slice(1)), `manifest icon ${i.src}`);
});

// ---------------------------------------------------------------------------- JSON-LD
test('JSON-LD: one parsable @graph per page; WebSite, Person and the software tie together by @id; every reference resolves', () => {
  for (const { rel, html } of pagesCache) {
    const { count, graph } = ldOf(html);
    assert.equal(count, 1, `${rel}: exactly one JSON-LD script`);
    const ids = graph.map((n) => n['@id']).filter(Boolean);
    assert.equal(new Set(ids).size, ids.length, `${rel}: @id unique`);
    const by = (id) => graph.find((n) => n['@id'] === id);
    const site = by(SITE + '#website'), person = by('https://cheyuwu.com/#person'), sw = by(SITE + '#software');
    assert.ok(site && person && sw, `${rel}: WebSite, Person and software in the graph`);
    assert.deepEqual(site.publisher, { '@id': 'https://cheyuwu.com/#person' });
    assert.deepEqual(sw.author, { '@id': 'https://cheyuwu.com/#person' });
    assert.equal(sw.codeRepository, 'https://github.com/frank890417/open-audiovisual');
    assert.ok([].concat(sw['@type']).includes('SoftwareSourceCode'));
    assert.equal(person.url, 'https://cheyuwu.com/');
    assert.ok(person.sameAs.includes('https://github.com/frank890417'));
    // every {"@id": …} reference (an object whose only key is @id) is defined in this graph
    const refs = [];
    const walk = (v) => { if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === 'object') { if (Object.keys(v).length === 1 && v['@id']) refs.push(v['@id']); else Object.values(v).forEach(walk); } };
    graph.forEach((n) => Object.values(n).forEach(walk));
    for (const r of refs) assert.ok(by(r), `${rel}: reference ${r} resolves`);
    assert.ok(!graph.some((n) => [].concat(n['@type']).includes('Organization')), `${rel}: no invented Organization`);
    const here = SITE + rel.replace(/index\.html$/, '');
    const own = graph.find((n) => n['@id'] === here + '#webpage' || n['@id'] === here + '#article');
    assert.ok(own, `${rel}: the page's own node`);
    if (rel !== 'index.html' && rel !== 'zh/index.html') assert.ok(graph.some((n) => n['@type'] === 'BreadcrumbList'), `${rel}: BreadcrumbList`);
  }
});

// ---------------------------------------------------------------------------- email obfuscation
test('email_off: every code block with an @ sits inside the Cloudflare email_off fence', () => {
  let withAt = 0;
  for (const { rel, html } of pagesCache) {
    const fences = [...html.matchAll(/<!--email_off-->[\s\S]*?<!--\/email_off-->/g)].map((m) => [m.index, m.index + m[0].length]);
    assert.ok(fences.length >= 1, `${rel}: has an email_off region`);
    for (const m of html.matchAll(/<(pre|code)[\s>][\s\S]*?<\/\1>/g)) {
      if (!m[0].includes('@')) continue;
      withAt++;
      assert.ok(fences.some(([a, b]) => m.index >= a && m.index + m[0].length <= b), `${rel}: <${m[1]}> with an @ is outside email_off: ${m[0].slice(0, 80)}`);
    }
  }
  assert.ok(withAt > 10, `the test sees code blocks with an @ (${withAt})`);
  for (const rel of ['docs/index.html', 'zh/docs/index.html']) {
    const s = read(rel);
    const at = s.indexOf('p5@1.9.4');
    assert.ok(at > 0, `${rel}: the p5@1.9.4 CDN url is on the page`);
    assert.ok(s.lastIndexOf('<!--email_off-->', at) > s.lastIndexOf('<!--/email_off-->', at), `${rel}: p5@1.9.4 is inside email_off`);
  }
});

// ---------------------------------------------------------------------------- 404, robots, titles
test('404.html: noindex, no canonical or hreflang, absolute links back into the site, in both languages', async () => {
  const s = read('404.html');
  assert.match(s, /<meta name="robots" content="noindex">/);
  assert.ok(!s.includes('<link rel="canonical"') && !s.includes('<link rel="alternate" hreflang'), 'a 404 has no canonical or hreflang');
  for (const href of ['/', '/docs/', '/controllers/', '/zh/']) assert.ok(s.includes(`href="${href}"`), `links to ${href}`);
  assert.ok(/href="\/(examples\/|#works)"/.test(s), 'links to the examples');
  assert.ok(!/(href|src)="\.\.?\//.test(s), 'no relative paths: the page answers at any depth');
  assert.ok(s.includes('rel="stylesheet" href="/assets/home/home.css"') && s.includes('rel="icon" href="/favicon.ico"'));
  assert.ok(s.includes('This page is not here') && s.includes('找不到這一頁'), 'both languages');
  assert.ok(s.includes('<!--email_off-->'));
  const { renderNotFound } = await import('../tools/site/notfound.mjs');
  assert.equal(s, renderNotFound(), '404.html is what the generator writes (node tools/build-home.mjs)');
});

test('robots.txt: sitemap line, search and training crawlers sectioned and welcome, llms pointers', () => {
  const s = read('robots.txt');
  assert.ok(s.includes(`Sitemap: ${SITE}sitemap.xml`), 'Sitemap line');
  assert.ok(/User-agent: \*\nAllow: \//.test(s));
  assert.ok(!/^Disallow:\s*\/\s*$/m.test(s), 'nothing is disallowed');
  for (const ua of ['OAI-SearchBot', 'ChatGPT-User', 'Claude-SearchBot', 'Claude-User', 'PerplexityBot', 'GPTBot', 'ClaudeBot', 'Google-Extended', 'CCBot']) assert.ok(s.includes(`User-agent: ${ua}\n`), `${ua} is named`);
  assert.ok(s.includes(`${SITE}llms.txt`) && s.includes(`${SITE}llms-full.txt`));
});

test('titles and descriptions: short enough to show, different on every page', () => {
  const seen = new Set();
  for (const { rel, html } of pagesCache) {
    const dec = (x) => x.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    const t = dec(html.match(/<title>([^<]+)<\/title>/)[1]), d = dec(meta(html, 'name="description"'));
    const zh = rel.startsWith('zh/');
    assert.ok(!seen.has(t), `${rel}: title is unique`); seen.add(t);
    if (/^(zh\/)?(index|docs\/index|webtoe\/index)\.html$/.test(rel) || /^(zh\/)?controllers\/index\.html$/.test(rel)) {
      assert.ok(t.length <= (zh ? 36 : 60), `${rel}: title ${t.length} chars: ${t}`);
      assert.ok(d.length <= (zh ? 90 : 160), `${rel}: description ${d.length} chars`);
    }
  }
});
