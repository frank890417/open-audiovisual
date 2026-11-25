#!/usr/bin/env node
// build-docs — render the documentation handbook in every language: one page per chapter, and the contents.
//
//   node tools/build-docs.mjs          # write docs/index.html, docs/<chapter>/index.html and their zh/ twins
//   node tools/build-docs.mjs --check  # exit 1 if the committed pages are stale
//
// Markdown is the source of truth (tools/docs/chapters.mjs lists the chapters); the pages are static output so crawlers
// and agents read every word without JavaScript. Like tools/build-home.mjs this is a site generator, not a framework
// build step: the framework itself still runs from plain files.
//
//   /docs/                 the contents: every chapter, its first sentence, its sections as links (no chapter text), and a
//                          forwarder that sends an old one-page link /docs/#mapping-curves to /docs/mapping/#mapping-curves
//   /docs/<chapter>/       one chapter: its own title, a description from its first paragraph, previous / next
//   /p5/                   the p5 chapter's page (tools/build-examples.mjs renders it); /docs/p5/ is a noindex stub to it
// Where each chapter and each heading lives is decided once, in tools/docs/anchors.mjs.
//
// Links inside the Markdown are rewritten so the same file reads well on GitHub and on the site: a link to another
// chapter's .md becomes that chapter's page (with its #anchor), a link to a code file becomes a GitHub URL, a link to a
// site page stays on the site in the page's language, and a ready-made sketch named as code (`p5/examples/mic/`)
// links to its page. --check ignores ?v= stamps.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { CHAPTERS } from './docs/chapters.mjs';
import { renderMarkdown, slugify, stripMd } from './docs/markdown.mjs';
import { renderContentsPage, renderChapterPage, renderMovedStub } from './docs/page.mjs';
import { englishHeadings, chapterOfAnchor, docsHref, chapterPath, P5_CHAPTER, FRAME_IDS } from './docs/anchors.mjs';
import { SITE, BLOB, TREE, PAGES, pageCtx, pathCtx } from './site/chrome.mjs';
import { shapeDiff } from './build-home.mjs';
import { sitemapXml, unstamp } from './site/pages.mjs';
import { sketchHref } from './site/facts.mjs';
import en from './docs/en.mjs';
import zh from './docs/zh.mjs';
import homeEn from './home/en.mjs';
import homeZh from './home/zh.mjs';
import { isMain } from './site/is-main.mjs';
import { describe, sentences, closing } from './site/describe.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STRINGS = { en, zh };
const HOME = { en: homeEn, zh: homeZh };
const OUT = { en: 'docs/index.html', zh: 'zh/docs/index.html' };
/** The file of a chapter's page (repo-relative). */
export const chapterFile = (id, locale) => (locale === 'zh' ? 'zh/' : '') + chapterPath(id) + 'index.html';
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
  // a heading of this chapter is on this page; any other is on its own chapter's page
  const toAnchor = (id) => (chapterOfAnchor(id) === chapterId ? '#' + id : docsHref(c.root, c.locale, id));
  return (href) => {
    if (!href) return href;
    if (href.startsWith(SITE)) {
      // our own site: keep visitors on the site, in this language, and working on localhost
      const [rest, frag] = href.slice(SITE.length).split('#');
      const page = Object.keys(PAGES).find((p) => PAGES[p] === rest);
      if (page === 'docs' && frag !== undefined) { const id = findAnchorAnywhere(frag); if (!id) warnings.push(`${srcPath}: no heading for ${href}`); return id ? toAnchor(id) : c.to('docs'); }
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
      return toAnchor(id || target.id);
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

// ---------------------------------------------------------------------------- a chapter's own words, for its page
const ENT = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" };
const textOf = (html) => html.replace(/<[^>]+>/g, '').replace(/&(?:amp|lt|gt|quot|#39);/g, (m) => ENT[m]).replace(/\s+/g, ' ').trim();
/** The chapter's paragraphs as plain text, in order (callouts and quotes left out: they are asides, not the opening). */
function paragraphs(html) {
  const bare = html.replace(/<aside[\s\S]*?<\/aside>|<blockquote>[\s\S]*?<\/blockquote>/g, '');
  return [...bare.matchAll(/<p>([\s\S]*?)<\/p>/g)].map((m) => textOf(m[1])).filter(Boolean);
}
/** The first sentence, for the contents page. */
export const firstSentence = (html, locale) => { const p = paragraphs(html)[0]; return p ? closing(sentences(p, locale)[0] || p) : ''; };
/** Where a description may stop: at least `min` characters (a short opening takes the next paragraph's words too), at most `max`. */
export const LIMITS = { en: { min: 70, max: 160 }, zh: { min: 50, max: 100 } };
/** The page's description: the chapter's opening sentences, as many as fit (tools/site/describe.mjs). No new words. */
export const chapterDescription = (html, locale) => describe(paragraphs(html), locale, LIMITS[locale]);

/** Render one language: every chapter (on the page it will live on) with its sections, description and HTML. */
function renderLocale(locale, enHeads, warnings) {
  const t = STRINGS[locale];
  const used = new Set(FRAME_IDS);   // one set across every chapter, in order: the ids the handbook had when it was one page
  const chapters = sources(locale).map(({ ch, md, src, fallback }) => {
    const c = ch.id === P5_CHAPTER ? pageCtx('p5', locale) : pathCtx(chapterPath(ch.id), locale, { page: 'docs' });
    const twin = enHeads.get(ch.id).filter((h) => h.mdLevel > 1);
    let body = md;
    if (fallback === 'untranslated') {
      // keep the chapter title line first, then say why the text is English
      body = md.replace(/^(# .*\n)/, `$1\n> [!NOTE]\n> ${t.untranslated}\n\n`);
    }
    const r = renderMarkdown(body, {
      idPrefix: ch.id, shift: 1, twin, used, site: SITE,
      resolveLink: linkResolver({ srcPath: src, chapterId: ch.id, c, enHeads, warnings }),
      codeHref: (code) => sketchHref(code, c.root),   // `p5/examples/mic/` opens the sketch
      labels: { ...t.alerts, copy: t.copy }, anchorLabel: t.anchorLabel,
    });
    if (!r.title) warnings.push(`${src}: no "# Title" line`);
    if (locale === 'zh' && fallback !== 'placeholder') {
      const mine = r.headings.filter((h) => h.mdLevel > 1).map((h) => h.id).join(' ');
      const theirs = twin.map((h) => h.id).join(' ');
      if (mine !== theirs) warnings.push(`${src}: section structure differs from ${ch.en} (anchors will not match)`);
    }
    return {
      id: ch.id, title: r.title || ch.id, html: r.html, src, fallback, c,
      sections: r.headings.filter((h) => h.mdLevel === 2).map((h) => ({ id: h.id, html: h.html, text: h.text })),
      headings: r.headings,
      first: firstSentence(r.html, locale), description: chapterDescription(r.html, locale),
    };
  });
  return { t, chapters };
}

/** Everything: the contents and every chapter page in both languages, plus warnings and the chapters for tests and the search index. */
export function buildDocs() {
  const diff = shapeDiff(en, zh);
  if (diff.length) throw new Error('docs string tables differ in shape:\n  ' + diff.join('\n  '));
  const version = JSON.parse(read('package.json')).version;
  const assets = { css: hash('assets/docs/docs.css'), js: hash('assets/docs/docs.js') };
  const warnings = [];
  const enHeads = englishHeadings();
  const pages = {}, chapters = {};
  for (const locale of ['en', 'zh']) {
    const { t, chapters: chs } = renderLocale(locale, enHeads, warnings);
    chapters[locale] = chs;
    pages[OUT[locale]] = renderContentsPage(t, HOME[locale], { c: pageCtx('docs', locale), chapters: chs, version, assets });
    chs.forEach((ch, index) => {
      if (ch.id === P5_CHAPTER) {
        // the p5 chapter's page is /p5/ (tools/build-examples.mjs); the address the pattern promises forwards there
        const c = pathCtx(`docs/${ch.id}/`, locale, { page: 'docs' });
        pages[(locale === 'zh' ? 'zh/' : '') + `docs/${ch.id}/index.html`] = renderMovedStub(t, HOME[locale], {
          c, title: ch.title, to: { rel: chapterPath(ch.id).replace(/^/, c.root + (locale === 'zh' ? 'zh/' : '')), abs: (locale === 'zh' ? 'zh/' : '') + chapterPath(ch.id) },
        });
        return;
      }
      pages[chapterFile(ch.id, locale)] = renderChapterPage(t, HOME[locale], { c: ch.c, ch, index, chapters: chs, version, assets });
    });
  }
  return { pages, chapters, warnings };
}

/** { 'docs/index.html': html, 'docs/<chapter>/index.html': html, …, and the zh/ twins } */
export function buildPages() { return buildDocs().pages; }

if (isMain(import.meta.url)) {
  const check = process.argv.includes('--check');
  const { pages: docPages, warnings } = buildDocs();
  const pages = { ...docPages, 'sitemap.xml': sitemapXml() };   // sitemap.xml: the one file every build-*.mjs writes
  for (const w of warnings) console.warn('⚠️ ', w);
  const stale = [], written = [];
  for (const [rel, out] of Object.entries(pages)) {
    const file = path.join(ROOT, rel);
    const cur = read(rel);
    if (check) { if (cur === null || unstamp(cur) !== unstamp(out)) stale.push(rel); continue; }
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, out);
    if (!check) written.push(`${rel} (${out.length} bytes)`);
  }
  if (!check) console.log(`wrote ${written.length} files:\n  ` + written.join('\n  '));
  if (check) {
    if (stale.length) { console.error('stale (run node tools/build-docs.mjs):\n  ' + stale.join('\n  ')); process.exit(1); }
    console.log(`✅ docs up to date (${Object.keys(docPages).length} pages in en and zh, sitemap.xml)`);
  }
}
