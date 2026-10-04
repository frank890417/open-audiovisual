#!/usr/bin/env node
// build-docs — render the documentation handbook in every language.
//
//   node tools/build-docs.mjs          # write docs/index.html and zh/docs/index.html
//   node tools/build-docs.mjs --check  # exit 1 if the committed pages are stale
//
// Markdown is the source of truth (tools/docs/chapters.mjs lists the chapters);
// the two pages are static output so crawlers and agents read every word
// without JavaScript. Like tools/build-home.mjs this is a site generator, not a
// framework build step: the framework itself still runs from plain files.
//
// Links inside the Markdown are rewritten so the same file reads well on GitHub
// and on the site: a link to another chapter's .md becomes an in-page #anchor,
// a link to a code file becomes a GitHub URL, a link to a site page stays on the
// site in the page's language. --check ignores ?v= stamps.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { CHAPTERS } from './docs/chapters.mjs';
import { renderMarkdown, slugify, stripMd } from './docs/markdown.mjs';
import { renderDocsPage } from './docs/page.mjs';
import { SITE, BLOB, TREE, PAGES, pageCtx } from './site/chrome.mjs';
import { shapeDiff } from './build-home.mjs';
import en from './docs/en.mjs';
import zh from './docs/zh.mjs';
import homeEn from './home/en.mjs';
import homeZh from './home/zh.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STRINGS = { en, zh };
const HOME = { en: homeEn, zh: homeZh };
const OUT = { en: 'docs/index.html', zh: 'zh/docs/index.html' };
/** Files the site serves at its root (linked as site files, not GitHub blobs). */
const SITE_FILES = new Set(['llms.txt', 'llms-full.txt', 'robots.txt', 'sitemap.xml']);

/** GitHub's heading anchor: lowercase, punctuation dropped, spaces → '-'. */
export const githubSlug = (text) => stripMd(text).toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, '').replace(/\s/g, '-');

const read = (rel) => { try { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); } catch { return null; } };
const hash = (rel) => crypto.createHash('sha1').update(read(rel) || '').digest('hex').slice(0, 8);

/** Load every chapter's Markdown for one locale (fallbacks: zh → en, external → placeholder). */
function sources(locale) {
  return CHAPTERS.map((ch) => {
    const own = read(ch[locale]);
    if (own !== null) return { ch, md: own, src: ch[locale], fallback: null };
    if (locale === 'zh') {
      const enMd = read(ch.en);
      if (enMd !== null) return { ch, md: enMd, src: ch.en, fallback: 'untranslated' };
    }
    if (ch.external && STRINGS[locale].placeholder[ch.id]) return { ch, md: STRINGS[locale].placeholder[ch.id], src: ch[locale], fallback: 'placeholder' };
    throw new Error(`docs: chapter "${ch.id}" has no source (${ch[locale]})`);
  });
}

/** English headings of every chapter: the anchor set both languages share. */
function englishHeadings() {
  const used = new Set(['top', 'main', 'toc']);
  const out = new Map();
  for (const s of sources('en')) {
    const r = renderMarkdown(s.md, { idPrefix: s.ch.id, shift: 1, used });
    out.set(s.ch.id, r.headings);
  }
  return out;
}

/** Find the anchor a `#fragment` means inside a chapter, accepting our ids and GitHub's. */
function findAnchor(chapterId, frag, enHeads) {
  const hs = enHeads.get(chapterId) || [];
  if (!frag) return chapterId;
  const f = decodeURIComponent(frag).toLowerCase();
  const hit = hs.find((h) => h.id === f) || hs.find((h) => h.id === `${chapterId}-${f}`)
    || hs.find((h) => githubSlug(h.text) === f) || hs.find((h) => slugify(h.text) === f);
  return hit ? hit.id : null;
}

/** A link resolver for one Markdown file on one page. Problems are collected, not thrown. */
function linkResolver({ srcPath, chapterId, c, enHeads, warnings }) {
  const chapterOf = (repoPath) => CHAPTERS.find((ch) => ch.en === repoPath || ch.zh === repoPath);
  return (href) => {
    if (!href) return href;
    if (href.startsWith(SITE)) {
      // our own site: keep visitors on the site, in this language, and working on localhost
      const [rest, frag] = href.slice(SITE.length).split('#');
      const page = Object.keys(PAGES).find((p) => PAGES[p] === rest);
      if (page === 'docs' && frag !== undefined) { const id = findAnchorAnywhere(frag); return '#' + (id || frag); }
      if (page) return c.to(page, frag ? '#' + frag : '');
      return c.root + href.slice(SITE.length);
    }
    if (/^[a-z][\w+.-]*:/i.test(href)) return href;                // https:, mailto:, …
    if (href.startsWith('#')) {
      const id = findAnchor(chapterId, href.slice(1), enHeads);
      if (!id) warnings.push(`${srcPath}: no heading for ${href}`);
      return '#' + (id || href.slice(1));
    }
    const [p, frag] = href.split('#');
    const repoPath = path.posix.normalize(path.posix.join(path.posix.dirname(srcPath), p));
    if (repoPath.startsWith('..')) { warnings.push(`${srcPath}: link leaves the repository: ${href}`); return href; }
    const target = chapterOf(repoPath);
    if (target) {
      const id = findAnchor(target.id, frag, enHeads);
      if (!id) warnings.push(`${srcPath}: no heading for ${href}`);
      return '#' + (id || target.id);
    }
    if (SITE_FILES.has(repoPath)) return c.root + repoPath;
    if (repoPath === 'index.html' || repoPath === '.') return c.to('home');
    const page = Object.keys(PAGES).find((k) => PAGES[k] && (repoPath === PAGES[k].replace(/\/$/, '') || repoPath === PAGES[k] + 'index.html'));
    if (page) return c.to(page, frag ? '#' + frag : '');
    const abs = path.join(ROOT, repoPath);
    if (!fs.existsSync(abs)) warnings.push(`${srcPath}: missing file ${repoPath}`);
    const isDir = p.endsWith('/') || (fs.existsSync(abs) && fs.statSync(abs).isDirectory());
    return (isDir ? TREE : BLOB) + repoPath.replace(/\/$/, '') + (isDir ? '/' : '') + (frag && !isDir ? '#' + frag : '');
  };

  function findAnchorAnywhere(frag) {
    for (const ch of CHAPTERS) { const id = findAnchor(ch.id, frag, enHeads); if (id && (id === frag || id.startsWith(ch.id))) return id; }
    return null;
  }
}

/** Render one language: chapters with their sections (the TOC) and HTML. */
function renderLocale(locale, enHeads, warnings) {
  const t = STRINGS[locale];
  const c = pageCtx('docs', locale);
  const used = new Set(['top', 'main', 'toc']);
  const chapters = sources(locale).map(({ ch, md, src, fallback }) => {
    const twin = enHeads.get(ch.id).filter((h) => h.mdLevel > 1);
    let body = md;
    if (fallback === 'untranslated') {
      // keep the chapter title line first, then say why the text is English
      body = md.replace(/^(# .*\n)/, `$1\n> [!NOTE]\n> ${t.untranslated}\n\n`);
    }
    const r = renderMarkdown(body, {
      idPrefix: ch.id, shift: 1, twin, used, site: SITE,
      resolveLink: linkResolver({ srcPath: src, chapterId: ch.id, c, enHeads, warnings }),
      labels: { ...t.alerts, copy: t.copy }, anchorLabel: t.anchorLabel,
    });
    if (!r.title) warnings.push(`${src}: no "# Title" line`);
    if (locale === 'zh' && fallback !== 'placeholder') {
      const mine = r.headings.filter((h) => h.mdLevel > 1).map((h) => h.id).join(' ');
      const theirs = twin.map((h) => h.id).join(' ');
      if (mine !== theirs) warnings.push(`${src}: section structure differs from ${ch.en} (anchors will not match)`);
    }
    return {
      id: ch.id, title: r.title || ch.id, html: r.html, src, fallback,
      sections: r.headings.filter((h) => h.mdLevel === 2).map((h) => ({ id: h.id, html: h.html, text: h.text })),
      headings: r.headings,
    };
  });
  return { t, c, chapters };
}

/** Everything: both pages, plus warnings and numbers for tests and reports. */
export function buildDocs() {
  const diff = shapeDiff(en, zh);
  if (diff.length) throw new Error('docs string tables differ in shape:\n  ' + diff.join('\n  '));
  const version = JSON.parse(read('package.json')).version;
  const assets = { css: hash('assets/docs/docs.css'), js: hash('assets/docs/docs.js') };
  const warnings = [];
  const enHeads = englishHeadings();
  const pages = {}, chapters = {};
  for (const locale of ['en', 'zh']) {
    const { t, c, chapters: chs } = renderLocale(locale, enHeads, warnings);
    chapters[locale] = chs;
    pages[OUT[locale]] = renderDocsPage(t, HOME[locale], { c, chapters: chs, version, assets });
  }
  return { pages, chapters, warnings };
}

/** { 'docs/index.html': html, 'zh/docs/index.html': html } */
export function buildPages() { return buildDocs().pages; }

const unstamp = (s) => s.replace(/\?v=[\w.-]+/g, '');

if (import.meta.url === `file://${process.argv[1]}`) {
  const check = process.argv.includes('--check');
  const { pages, warnings } = buildDocs();
  for (const w of warnings) console.warn('⚠️ ', w);
  const stale = [];
  for (const [rel, out] of Object.entries(pages)) {
    const file = path.join(ROOT, rel);
    const cur = read(rel);
    if (check) { if (cur === null || unstamp(cur) !== unstamp(out)) stale.push(rel); continue; }
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, out);
    console.log('wrote', rel, `(${out.length} bytes)`);
  }
  if (check) {
    if (stale.length) { console.error('stale (run node tools/build-docs.mjs):\n  ' + stale.join('\n  ')); process.exit(1); }
    console.log('✅ docs up to date (en, zh)');
  }
}
