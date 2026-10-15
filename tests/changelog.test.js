// /changelog/ and the versions line.
//
// docs/changelog.md (en) and docs/zh/changelog.md (zh) are rendered into /changelog/ and /zh/changelog/ by
// tools/build-examples.mjs, in the same frame as /p5/. The rule that matters: the newest oav-p5 entry is the version
// p5/oav-p5.js carries. A release that bumps OAV_P5_VERSION without writing what changed fails here, and
// tools/release.sh stops before the push.
//
// Also here: the versions line (oav-p5 0.6 · framework 0.1) on the homepage, /p5/ and /docs/, linked to the
// changelog; /p5/'s title, description and ready-made sketches row; the fourth door on the homepage.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(ROOT, rel));
const SRC = { en: 'docs/changelog.md', zh: 'docs/zh/changelog.md' };
const PAGE = { en: 'changelog/index.html', zh: 'zh/changelog/index.html' };
const unstamp = (s) => s.replace(/\?v=[\w.+-]+/g, '');
const semver = (v) => v.split('.').map(Number);
const newer = (a, b) => { const x = semver(a), y = semver(b); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i]; return false; };

test('changelog: the newest oav-p5 entry is the version p5/oav-p5.js carries (bumped it? write what changed)', async () => {
  const { parseChangelog } = await import('../tools/examples/page.mjs');
  const { readP5Version } = await import('../tools/site/facts.mjs');
  const v = readP5Version();
  for (const lang of ['en', 'zh']) {
    assert.ok(exists(SRC[lang]), `${SRC[lang]} exists`);
    const log = parseChangelog(read(SRC[lang]));
    assert.ok(log.p5.length, `${SRC[lang]}: oav-p5 entries under "## oav-p5"`);
    assert.equal(log.p5[0].version, v, `${SRC[lang]}: the newest entry is ${log.p5[0].version}, p5/oav-p5.js is ${v}: add "### ${v}" at the top of the oav-p5 section`);
  }
});

test('changelog: en and zh list the same versions and days, newest first, each version with a date and a commit that exists', async () => {
  const { parseChangelog } = await import('../tools/examples/page.mjs');
  assert.ok(read(SRC.en).startsWith('# Changelog\n') && read(SRC.zh).startsWith('# 更新紀錄\n'), 'each language in its own file');
  assert.ok(!/[\u4e00-\u9fff]/.test(read(SRC.en).replace(/`[^`]*`/g, '')), `${SRC.en} is English`);
  const en = parseChangelog(read(SRC.en)), zh = parseChangelog(read(SRC.zh));
  assert.deepEqual(zh.p5, en.p5, 'same versions, dates and commits in both languages');
  assert.deepEqual(zh.days, en.days, 'same days in both languages');
  en.p5.forEach((e, i) => {
    assert.match(e.version, /^\d+\.\d+\.\d+$/, `version ${e.version}`);
    assert.match(e.date || '', /^\d{4}-\d{2}-\d{2}$/, `${e.version}: a "YYYY-MM-DD · [commit](…/commit/<sha>)" line under the heading`);
    assert.match(e.commit || '', /^[0-9a-f]{7,40}$/, `${e.version}: a commit`);
    if (i) {
      assert.ok(newer(en.p5[i - 1].version, e.version), `${en.p5[i - 1].version} above ${e.version}: newest first`);
      assert.ok(en.p5[i - 1].date >= e.date, `${e.version}: dates newest first`);
    }
  });
  for (const d of en.days) assert.match(d, /^\d{4}-\d{2}-\d{2}$/, `framework day ${d}`);
  assert.deepEqual([...en.days].sort().reverse(), en.days, 'days newest first');
  let git = true;
  try { execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, stdio: 'ignore' }); } catch { git = false; }
  if (git) for (const e of en.p5) {
    assert.doesNotThrow(() => execFileSync('git', ['cat-file', '-e', `${e.commit}^{commit}`], { cwd: ROOT, stdio: 'ignore' }), `${e.version}: commit ${e.commit} is in this repository`);
  }
});

test('changelog pages: what the Markdown renders, registered, every link and #anchor lands', async () => {
  const { renderChangelog, parseChangelog } = await import('../tools/examples/page.mjs');
  const { registry } = await import('../tools/site/pages.mjs');
  assert.ok(registry().some((e) => e.path === 'changelog/' && e.langs.join() === 'en,zh'), 'registered in tools/site/pages.mjs (sitemap, hreflang)');
  assert.ok(read('sitemap.xml').includes('<loc>https://openaudiovisual.com/changelog/</loc>') && read('sitemap.xml').includes('<loc>https://openaudiovisual.com/zh/changelog/</loc>'));
  const versions = parseChangelog(read(SRC.en)).p5.map((e) => e.version);
  for (const lang of ['en', 'zh']) {
    const html = read(PAGE[lang]);
    assert.equal(unstamp(html), unstamp(renderChangelog(lang)), `${PAGE[lang]} is stale (node tools/build-examples.mjs)`);
    const self = `https://openaudiovisual.com/${lang === 'zh' ? 'zh/' : ''}changelog/`;
    assert.ok(html.includes(`<link rel="canonical" href="${self}">`) && html.includes('hreflang="zh-Hant"') && html.includes('hreflang="x-default"'));
    assert.ok(html.includes('<!--email_off-->'));
    // the same anchors in both languages: /changelog/#changelog-0-6-0 and /zh/changelog/#changelog-0-6-0
    for (const v of versions) assert.ok(html.includes(`id="changelog-${v.replace(/\./g, '-')}"`), `${PAGE[lang]}: an anchor for ${v}`);
    const dir = path.dirname(path.join(ROOT, PAGE[lang]));
    for (const m of html.matchAll(/\shref="([^"]+)"/g)) {
      const ref = m[1];
      if (/^(https?:|mailto:|data:)/.test(ref)) continue;
      const [p, frag] = ref.split('#');
      const file = p === '' ? path.join(ROOT, PAGE[lang]) : path.join(dir, p.split('?')[0], p.endsWith('/') ? 'index.html' : '');
      assert.ok(fs.existsSync(file), `${PAGE[lang]}: ${ref} → ${path.relative(ROOT, file)} missing`);
      if (frag) assert.ok(fs.readFileSync(file, 'utf8').includes(`id="${frag}"`), `${PAGE[lang]}: ${ref} has no #${frag} on ${path.relative(ROOT, file)}`);
    }
  }
});

test('versions line: the homepage, /p5/ and /docs/ name oav-p5 and the framework, linked to the changelog in their language', async () => {
  const { getFacts, minor } = await import('../tools/site/facts.mjs');
  const f = getFacts();
  const en = `oav-p5 ${minor(f.p5Version)} · framework ${minor(f.version)}`, zh = `oav-p5 ${minor(f.p5Version)} · 框架 ${minor(f.version)}`;
  for (const [file, href, text] of [
    ['index.html', './changelog/', en], ['zh/index.html', '../zh/changelog/', zh],
    ['p5/index.html', '../changelog/', en], ['zh/p5/index.html', '../../zh/changelog/', zh],
    ['docs/index.html', '../changelog/', en], ['zh/docs/index.html', '../../zh/changelog/', zh],
  ]) {
    const s = read(file);
    assert.ok(s.includes(`<a href="${href}">${text}</a>`), `${file}: <a href="${href}">${text}</a>`);
  }
  assert.ok(!/v0\.1 ·|v\d+\.\d+\.\d+<\/p>/.test(read('index.html') + read('docs/index.html')), 'no hand-typed framework version left');
  // the footer of every site page links the changelog
  for (const file of ['index.html', 'zh/index.html', 'controllers/index.html', 'webtoe/index.html', 'check/index.html', 'examples/index.html']) {
    assert.ok(/<a href="[./]*(zh\/)?changelog\/">(Changelog|更新紀錄)<\/a>/.test(read(file)), `${file}: footer link to the changelog`);
  }
});

test('/p5/: title and description name what the line does now; the ready-made sketches row lists every p5/examples folder', async () => {
  const { STRINGS } = await import('../tools/examples/strings.mjs');
  const { p5Sketches } = await import('../tools/examples/page.mjs');
  const { getFacts } = await import('../tools/site/facts.mjs');
  for (const w of ['MIDI', 'sound', 'drums', 'video']) assert.ok(STRINGS.en.p5.title.includes(w), `en title: ${w}`);
  for (const w of ['MIDI', '聲音', '鼓機', '錄影']) assert.ok(STRINGS.zh.p5.title.includes(w), `zh title: ${w}`);
  for (const w of ['sound', 'drum machine', 'rhythm', 'microphone', 'video']) assert.ok(STRINGS.en.p5.description.includes(w), `en description: ${w}`);
  for (const w of ['聲音', '鼓機', '節奏', '麥克風', '錄成影片']) assert.ok(STRINGS.zh.p5.description.includes(w), `zh description: ${w}`);
  const f = getFacts();
  assert.deepEqual(p5Sketches().map((x) => x.name).sort(), f.p5Sketches.map((x) => x.name).sort(), 'the row is the folder list');
  for (const [file, lang, root] of [['p5/index.html', 'en', '../'], ['zh/p5/index.html', 'zh', '../../']]) {
    const s = read(file);
    const row = s.match(/<p class="docs-note p5-sketches">([\s\S]*?)<\/p>/);
    assert.ok(row, `${file}: the ready-made sketches row`);
    assert.ok(s.includes(`<meta name="description" content="${STRINGS[lang].p5.description}">`), `${file}: description from strings.mjs`);
    for (const x of f.p5Sketches) {
      assert.ok(STRINGS[lang].sketches[x.name], `p5/examples/${x.name}/ needs a name in tools/examples/strings.mjs ${lang}.sketches`);
      const href = x.page ? `${root}p5/examples/${x.name}/` : `https://github.com/frank890417/open-audiovisual/blob/main/p5/examples/${x.name}/sketch.js`;
      assert.ok(row[1].includes(`<a href="${href}">`), `${file}: ${x.name} → ${href}`);
      if (x.page) assert.ok(exists(`p5/examples/${x.name}/index.html`));
      else assert.ok(exists(`p5/examples/${x.name}/sketch.js`));
    }
  }
});

test('homepage: a fourth door for p5.js / OpenProcessing, to /p5/ in this language', async () => {
  const en = (await import('../tools/home/en.mjs')).default, zh = (await import('../tools/home/zh.mjs')).default;
  assert.equal(en.hero.doors.length, 4);
  assert.deepEqual([en.hero.doors[3].href, zh.hero.doors[3].href], ['p5/', 'zh/p5/']);
  assert.ok(read('index.html').includes('<a class="door door-4" href="./p5/">'));
  assert.ok(read('zh/index.html').includes('<a class="door door-4" href="../zh/p5/">'));
});
