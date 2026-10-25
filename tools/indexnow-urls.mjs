#!/usr/bin/env node
// IndexNow: which URLs a release actually changed. Writes them out; never sends anything.
//
// IndexNow is "this page changed, come back", not a site list (the sitemap is the site list). Sending the whole sitemap
// on every release is what got cheyuwu.com a Bing "Avoid IndexNow Batch Mode" warning (2026-09-12). So the list is the
// difference between the sitemap before and after: new URLs, URLs whose lastmod moved, and URLs that left the sitemap
// (IndexNow wants deleted and redirected URLs too). sitemap.xml's lastmod is the last commit of each page's sources
// (RELEASING.md §lastmod), so "lastmod moved" means "the page's content changed", not "the site was rebuilt".
//
// Submitting is not part of the release (RELEASING.md §Not in the script): this prints, a person sends.
//
//   node tools/indexnow-urls.mjs --before <sha> [--after <sha>]   # one URL per line on stdout, nothing when nothing changed
//   node tools/indexnow-urls.mjs --before <sha> --key <key>        # the IndexNow request body instead (the key file has to be live first)
//   stderr: a summary for people

import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const HOST = 'openaudiovisual.com';
const MAX = 10000; // IndexNow's limit for one request

/** loc → lastmod ('' when the entry has none) for every <url> of a sitemap. */
export function sitemapEntries(xml) {
  const out = new Map();
  for (const m of xml.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
    const loc = m[1].match(/<loc>\s*([^<\s]+)\s*<\/loc>/);
    if (!loc) continue;
    const lastmod = m[1].match(/<lastmod>\s*([^<\s]+)\s*<\/lastmod>/);
    out.set(loc[1], lastmod ? lastmod[1] : '');
  }
  return out;
}

/** What changed between two sitemaps: { added, modified, removed }, each sorted. */
export function changedUrls(beforeXml, afterXml) {
  const before = sitemapEntries(beforeXml), after = sitemapEntries(afterXml);
  const added = [], modified = [], removed = [];
  for (const [loc, mod] of after) {
    if (!before.has(loc)) added.push(loc);
    else if (before.get(loc) !== mod) modified.push(loc);
  }
  for (const loc of before.keys()) if (!after.has(loc)) removed.push(loc);
  return { added: added.sort(), modified: modified.sort(), removed: removed.sort() };
}

/** The IndexNow request body for these URLs (only this host's). */
export function requestBody(urls, key) {
  const urlList = urls.filter((u) => new URL(u).host === HOST);
  if (urlList.length > MAX) throw new Error(`${urlList.length} URLs: over the IndexNow limit of ${MAX}`);
  return { host: HOST, key, keyLocation: `https://${HOST}/${key}.txt`, urlList };
}

const showSitemap = (sha) => execFileSync('git', ['show', `${sha}:sitemap.xml`], { encoding: 'utf8' });

function main(argv) {
  const arg = (name) => { const i = argv.indexOf(name); return i < 0 ? null : argv[i + 1]; };
  const before = arg('--before'), after = arg('--after') || 'HEAD', key = arg('--key');
  if (!before) { console.error('usage: node tools/indexnow-urls.mjs --before <sha> [--after <sha>] [--key <key>]'); process.exit(2); }
  const { added, modified, removed } = changedUrls(showSitemap(before), showSitemap(after));
  const urls = [...added, ...modified, ...removed];
  console.error(`indexnow ${before}..${after}: ${urls.length} URL(s) · added ${added.length} · lastmod moved ${modified.length} · left the sitemap ${removed.length}`);
  for (const [label, list] of [['+', added], ['~', modified], ['-', removed]]) for (const u of list) console.error(`  ${label} ${u}`);
  if (!urls.length) return;
  process.stdout.write(key ? JSON.stringify(requestBody(urls, key)) + '\n' : urls.join('\n') + '\n');
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv.slice(2));
