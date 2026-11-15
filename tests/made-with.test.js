// /made-with/ and /zh/made-with/: the works that run on the framework. One data file (made-with/works.json), one
// template, no script. The page is how the project learns who uses it without taking anything from anyone:
// people add themselves.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const read = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const exists = (f) => existsSync(new URL('../' + f, import.meta.url));

test('made-with: both pages exist, are generated, and --check finds them current', async () => {
  for (const f of ['made-with/index.html', 'zh/made-with/index.html', 'made-with/works.json', 'assets/made-with/badge.svg']) assert.ok(exists(f), f);
  const { stalePages } = await import('../tools/build-made-with.mjs');
  assert.deepEqual(stalePages(), []);
});

test('made-with: registered, in the sitemap, with hreflang twins, and in the footer of the site', async () => {
  const { registry } = await import('../tools/site/pages.mjs');
  assert.ok(registry().find((x) => x.id === 'made'));
  const sm = read('sitemap.xml');
  for (const u of ['https://openaudiovisual.com/made-with/', 'https://openaudiovisual.com/zh/made-with/']) assert.ok(sm.includes(`<loc>${u}</loc>`), u);
  const s = read('made-with/index.html');
  assert.ok(s.includes('hreflang="zh-Hant" href="https://openaudiovisual.com/zh/made-with/"'));
  assert.match(read('index.html'), /href="\.\/made-with\/"/, 'homepage footer links the page');
});

test('made-with: every work in the data file is a card on both pages, with its link', async () => {
  const data = JSON.parse(read('made-with/works.json'));
  const { checkWorks } = await import('../tools/made-with/page.mjs');
  assert.deepEqual(checkWorks(data), []);
  assert.ok(data.works.length >= 1);
  for (const f of ['made-with/index.html', 'zh/made-with/index.html']) {
    const s = read(f);
    for (const w of data.works) {
      assert.ok(s.includes(`id="${w.id}"`), `${f}: ${w.id}`);
      assert.ok(s.includes(`href="${w.url}"`), `${f}: ${w.url}`);
    }
    assert.doesNotMatch(s, /<script(?![^>]*application\/ld\+json)[^>]*src=(?![^>]*(googletagmanager|search))/, `${f}: no script of its own`);
  }
});

test('made-with: the data check refuses what would break the page or mislead', async () => {
  const { checkWorks, FORMAT } = await import('../tools/made-with/page.mjs');
  const ok = { id: 'a-work', title: 'A', by: 'B', url: 'https://example.org/a', kind: 'sketch', en: 'x', zh: '中文', added: '2026-11-15' };
  assert.deepEqual(checkWorks({ format: FORMAT, works: [ok] }), []);
  const bad = (patch) => checkWorks({ format: FORMAT, works: [{ ...ok, ...patch }] }).length > 0;
  assert.ok(bad({ url: 'http://example.org' }), 'http link');
  assert.ok(bad({ url: 'javascript:alert(1)' }), 'script link');
  assert.ok(bad({ kind: 'advert' }), 'unknown kind');
  assert.ok(bad({ zh: '' }), 'no Chinese');
  assert.ok(bad({ zh: '一句；兩句' }), 'full-width semicolon');
  assert.ok(bad({ added: 'yesterday' }), 'date');
  assert.ok(checkWorks({ format: FORMAT, works: [ok, ok] }).length > 0, 'same id twice');
  assert.ok(checkWorks({ format: 'x', works: [] }).length > 0, 'format');
});

test('made-with: a title with markup in it is shown as text', async () => {
  const { renderPage, FORMAT } = await import('../tools/made-with/page.mjs');
  const en = (await import('../tools/made-with/en.mjs')).default;
  const home = (await import('../tools/home/en.mjs')).default;
  const html = renderPage(en, home, 'en', { format: FORMAT, works: [{ id: 'x', title: '<img src=x onerror=1>', by: 'B', url: 'https://example.org/', kind: 'sketch', en: '<b>hi</b>', zh: '嗨', added: '2026-11-15' }] }, { version: '0.0.0' });
  assert.ok(!html.includes('<img src=x'), 'title escaped');
  assert.ok(html.includes('&lt;b&gt;hi&lt;/b&gt;'), 'text escaped');
});

test('made-with: the issue form exists and asks whose work it is; the page says nothing is sent', () => {
  const y = read('.github/ISSUE_TEMPLATE/made-with.yml');
  assert.match(y, /required: true/);
  assert.match(y, /my work, or I have the maker's go-ahead/);
  assert.match(read('made-with/index.html'), /Nothing is sent anywhere/);
  assert.match(read('zh/made-with/index.html'), /不會把任何東西送到任何地方/);
});
