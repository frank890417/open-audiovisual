// tools/indexnow-urls.mjs: only what a release changed goes to IndexNow; a release that changed nothing sends nothing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sitemapEntries, changedUrls, requestBody } from '../tools/indexnow-urls.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const url = (loc, lastmod) => `  <url>\n    <loc>${loc}</loc>\n${lastmod ? `    <lastmod>${lastmod}</lastmod>\n` : ''}  </url>`;
const sitemap = (...urls) => `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
const A = 'https://openaudiovisual.com/', B = 'https://openaudiovisual.com/zh/', C = 'https://openaudiovisual.com/p5/';

test('the committed sitemap: every <url> is read, with its lastmod', () => {
  const xml = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
  const entries = sitemapEntries(xml);
  assert.equal(entries.size, (xml.match(/<url>/g) || []).length);
  for (const [loc, mod] of entries) { assert.match(loc, /^https:\/\/openaudiovisual\.com\//); assert.match(mod, /^\d{4}-\d{2}-\d{2}/, loc); }
});

test('nothing changed: nothing to send (the real sitemap against itself, too)', () => {
  const xml = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
  assert.deepEqual(changedUrls(xml, xml), { added: [], modified: [], removed: [] });
  const s = sitemap(url(A, '2026-10-19'), url(B, '2026-10-19'));
  assert.deepEqual(changedUrls(s, s), { added: [], modified: [], removed: [] });
});

test('new URL, moved lastmod and a URL that left the sitemap are each sent; an untouched one is not', () => {
  const before = sitemap(url(A, '2026-10-19'), url(B, '2026-10-19'), url(C, '2026-10-15'));
  const after = sitemap(url(A, '2026-10-25'), url(C, '2026-10-15'), url('https://openaudiovisual.com/new/', '2026-10-25'));
  assert.deepEqual(changedUrls(before, after), { added: ['https://openaudiovisual.com/new/'], modified: [A], removed: [B] });
});

test('a lastmod that appears or disappears counts as moved', () => {
  assert.deepEqual(changedUrls(sitemap(url(A, '')), sitemap(url(A, '2026-10-25'))).modified, [A]);
  assert.deepEqual(changedUrls(sitemap(url(A, '2026-10-25')), sitemap(url(A, ''))).modified, [A]);
});

test('request body: this host only, key location at the root, over the limit throws', () => {
  const body = requestBody([A, 'https://webtoe.openaudiovisual.com/'], 'k123');
  assert.deepEqual(body, { host: 'openaudiovisual.com', key: 'k123', keyLocation: 'https://openaudiovisual.com/k123.txt', urlList: [A] });
  assert.throws(() => requestBody(Array.from({ length: 10001 }, (_, i) => `${A}x${i}/`), 'k'), /over the IndexNow limit/);
});
