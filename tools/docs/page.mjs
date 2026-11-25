// The handbook's page templates, rendered once per language by tools/build-docs.mjs:
//
//   renderContentsPage   /docs/, /zh/docs/: every chapter with its title, its first sentence and its sections as links. It carries
//                        no chapter text (each chapter has one address), and a forwarder in <head> sends an old one-page link
//                        (/docs/#mapping-curves) to its chapter page (/docs/mapping/#mapping-curves) before anything is drawn.
//   renderChapterPage    /docs/<chapter>/: one chapter, its title as the page's h1, its sections in the side contents, the
//                        previous and next chapter. Same frame as the one page it replaces (assets/docs/docs.css + docs.js).
//   renderMovedStub      /docs/p5/: noindex, forwards to /p5/, where the p5 chapter lives (tools/docs/anchors.mjs, P5_CHAPTER)
//   chapterNav           the previous / next links, also at the end of /p5/ (tools/examples/page.mjs)
//
// Chapters arrive already rendered from Markdown (tools/docs/markdown.mjs); this file only lays out the frame.
// Static HTML on purpose: crawlers and AI agents read every word without JavaScript. assets/docs/docs.js only adds
// scroll-spy, the narrow-screen contents drawer, copy buttons and copy-link on heading anchors.

import { SITE, BLOB, SOFTWARE_ID, esc, attr, headBasics, pageNode, breadcrumbNode, homeUrl, topBar, siteFooter, guardEmail } from '../site/chrome.mjs';
import { chapterPath, forwarderScript } from './anchors.mjs';

const fill = (s, vars) => String(s).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
const pad2 = (n) => String(n).padStart(2, '0');
const docsUrl = (locale) => SITE + (locale === 'zh' ? 'zh/' : '') + 'docs/';
/** href of a chapter's page from a page whose way back to the site root is `root`. */
export const chapterHref = (root, locale, id) => root + (locale === 'zh' ? 'zh/' : '') + chapterPath(id);
/** The chapter html as its own page: the # title becomes the h1, ## the h2 … (the one page had them one level down). */
const liftHeadings = (html) => html.replace(/<(\/?)h([2-6])(?=[\s>])/g, (m, slash, n) => `<${slash}h${n - 1}`);

/**
 * "← Previous: Concepts · Next: Architecture →", counted as oav_next_step (to: docs). `prev`, `next`: { id, title } or null.
 * @param {object} t  docs strings
 */
export function chapterNav(t, c, prev, next) {
  if (!prev && !next) return '';
  const link = (ch, rel, label) => `<a class="ch-${rel}" rel="${rel}" href="${chapterHref(c.root, c.locale, ch.id)}" data-oav-event="next_step" data-oav-to="docs"><span class="ch-nav-k">${esc(label)}</span><span class="ch-nav-t">${esc(ch.title)}</span></a>`;
  return `<nav class="ch-nav" aria-label="${attr(t.navLabel)}">
      ${[prev && link(prev, 'prev', '← ' + t.prev), next && link(next, 'next', t.next + ' →')].filter(Boolean).join('\n      ')}
    </nav>`;
}

/** The lines every page of the handbook shares under its title: the versions (linked to /changelog/), the sources, llms.txt. */
const sourceNote = (t, c) => `<p class="docs-note">${t.sourceNote} <a href="${BLOB}${c.locale === 'zh' ? 'docs/zh/' : 'docs/'}">GitHub ↗</a> · ${fill(t.llmsNote, { llms: c.root + 'llms.txt', llmsFull: c.root + 'llms-full.txt' })}</p>`;

/**
 * /docs/: the contents.
 * @param {object} t        docs strings (tools/docs/en.mjs | zh.mjs)
 * @param {object} home     homepage strings (top bar, footer, html lang)
 * @param {object} o
 * @param {object} o.c      pageCtx('docs', locale)
 * @param {{id:string, title:string, first:string, sections:{id:string, html:string}[]}[]} o.chapters
 */
export function renderContentsPage(t, home, { c, chapters, version, assets }) {
  const sections = chapters.reduce((n, ch) => n + ch.sections.length, 0);
  const ld = [
    pageNode(c, home, {
      type: 'CollectionPage', name: t.meta.title, description: t.meta.description, about: { '@id': SOFTWARE_ID }, version,
      breadcrumb: { '@id': c.self + '#breadcrumb' }, mainEntity: { '@id': c.self + '#chapters' },
    }),
    breadcrumbNode(c, [['open-audiovisual', homeUrl(c)], [home.ui.nav.docs, c.self]]),
    {
      '@type': 'ItemList', '@id': c.self + '#chapters', name: t.title, numberOfItems: chapters.length,
      itemListElement: chapters.map((ch, i) => ({ '@type': 'ListItem', position: i + 1, name: ch.title, url: SITE + (c.locale === 'zh' ? 'zh/' : '') + chapterPath(ch.id) })),
    },
  ];
  const href = (id) => chapterHref(c.root, c.locale, id);
  const list = chapters.map((ch, i) => `<li class="contents-ch">
        <h2><a href="${href(ch.id)}"><span class="n">${pad2(i + 1)}</span><span class="t">${esc(ch.title)}</span></a></h2>
        ${ch.first ? `<p>${esc(ch.first)}</p>` : ''}${ch.sections.length ? `
        <ul class="contents-secs">${ch.sections.map((s) => `<li><a href="${href(ch.id)}#${s.id}">${s.html}</a></li>`).join('')}</ul>` : ''}
      </li>`).join('\n      ');

  return guardEmail(`<!DOCTYPE html>
<html lang="${home.htmlLang}">
<head>
${headBasics(home, c, { title: t.meta.title, description: t.meta.description, ogDescription: t.meta.ogDescription, ld, pageType: 'docs' })}
<script>${forwarderScript()}</script>
<link rel="stylesheet" href="${c.root}assets/docs/docs.css?v=${assets.css}">
</head>
<body class="docs-page docs-contents-page">
${topBar(home, c)}

<main id="main" class="docs-main docs-contents">
  <header class="docs-head" id="top">
    <p class="eyebrow">${esc(t.eyebrow)}</p>
    <h1>${esc(t.title)}</h1>
    <p class="docs-lede">${esc(t.lede)}</p>
    <div class="docs-quick">
      <a class="docs-quick-card is-cheat" href="${c.to('cheatsheet')}"><strong>${esc(t.cheatsheet.label)} →</strong><span>${esc(t.cheatsheet.text)}</span></a>
      <a class="docs-quick-card" href="${c.to('reference')}"><strong>${esc(t.reference.label)} →</strong><span>${esc(t.reference.text)}</span></a>
    </div>
    <p class="docs-stats">${esc(fill(t.stats, { chapters: chapters.length, sections }))} · <a href="${c.to('changelog')}">${esc(home.ui.versions)}</a></p>
    ${sourceNote(t, c)}
  </header>

  <nav aria-label="${attr(t.tocLabel)}">
    <ol class="contents" id="toc">
      ${list}
    </ol>
  </nav>
</main>

${siteFooter(home, c)}
</body>
</html>
`);
}

/**
 * /docs/<chapter>/: one chapter.
 * @param {object} o
 * @param {object} o.c         pathCtx('docs/<id>/', locale)
 * @param {object} o.ch        { id, title, html, src, fallback, sections, description }
 * @param {number} o.index     its place in the handbook (0-based)
 * @param {object[]} o.chapters  every chapter ({ id, title }), for the side contents and previous / next
 */
export function renderChapterPage(t, home, { c, ch, index, chapters, version, assets }) {
  const title = fill(t.chapterTitle, { title: ch.title });
  const prev = chapters[index - 1] || null, next = chapters[index + 1] || null;
  const ld = [
    pageNode(c, home, {
      type: 'TechArticle', '@id': c.self + '#article', headline: ch.title, name: title, description: ch.description,
      version, license: 'https://opensource.org/licenses/MIT', about: { '@id': SOFTWARE_ID },
      articleSection: ch.sections.map((s) => s.text), position: index + 1,
      breadcrumb: { '@id': c.self + '#breadcrumb' },
    }),
    breadcrumbNode(c, [['open-audiovisual', homeUrl(c)], [home.ui.nav.docs, docsUrl(c.locale)], [ch.title, c.self]]),
  ];
  const runtime = { copy: t.copy, copied: t.copied, linkCopied: t.linkCopied, tocButton: t.tocButton, tocClose: t.tocClose };
  const href = (id) => chapterHref(c.root, c.locale, id);

  // the side contents: every chapter (a link to its page), this one open with its sections (links on this page)
  const toc = `<nav class="toc" aria-label="${attr(t.tocLabel)}">
      <p class="toc-title">${esc(t.tocTitle)}</p>
      <p class="toc-ref"><a href="${c.to('docs')}">${esc(t.contentsLink)}</a></p>
      <p class="toc-ref"><a href="${c.to('reference')}">${esc(t.reference.toc)}</a></p>
      <ol class="toc-chapters">
        ${chapters.map((x, i) => x.id === ch.id ? `<li class="toc-ch is-here" data-ch="${x.id}">
          <a href="#${x.id}" aria-current="page"><span class="n">${pad2(i + 1)}</span><span class="t">${esc(x.title)}</span></a>${ch.sections.length ? `
          <ol class="toc-secs">
            ${ch.sections.map((s) => `<li><a href="#${s.id}">${s.html}</a></li>`).join('\n            ')}
          </ol>` : ''}
        </li>` : `<li class="toc-ch" data-ch="${x.id}"><a href="${href(x.id)}"><span class="n">${pad2(i + 1)}</span><span class="t">${esc(x.title)}</span></a></li>`).join('\n        ')}
      </ol>
    </nav>`;

  // the chapter number and its Markdown source sit right under the title (a placeholder chapter has no source file yet, so no link)
  const src = ch.fallback === 'placeholder' ? esc(ch.src) : `<a href="${BLOB}${ch.src}">${esc(ch.src)}</a>`;
  const meta = `<p class="chapter-meta"><span class="chapter-n">${esc(fill(t.chapterN, { n: index + 1, total: chapters.length }))}</span><span>${esc(t.chapterSource)}: ${src}</span></p>`;
  const body = liftHeadings(ch.html).replace(/(<\/h1>)/, `$1\n${meta}`);

  return guardEmail(`<!DOCTYPE html>
<html lang="${home.htmlLang}">
<head>
${headBasics(home, c, { title, description: ch.description, ogType: 'article', ld, pageType: 'docs_chapter', pageId: ch.id })}
<link rel="stylesheet" href="${c.root}assets/docs/docs.css?v=${assets.css}">
<script>document.documentElement.classList.add('js')</script>
</head>
<body class="docs-page docs-chapter-page">
${topBar(home, c)}

<div class="docs-bar">
  <button type="button" class="toc-toggle" aria-expanded="false" aria-controls="toc"><span class="toc-icon" aria-hidden="true"></span><span class="toc-toggle-label">${esc(t.tocButton)}</span></button>
  <span class="docs-bar-where" aria-hidden="true"></span>
</div>

<div class="docs-layout">
  <aside class="docs-side" id="toc">
    ${toc}
  </aside>

  <main id="main" class="docs-main">
    <p class="eyebrow ch-eyebrow" id="top"><a href="${c.to('docs')}">${esc(t.eyebrow)}</a></p>
    <article class="chapter" data-chapter="${ch.id}" aria-labelledby="${ch.id}">
${body}
    </article>

    ${chapterNav(t, c, prev, next)}
    <p class="docs-end"><a href="#top">↑ ${esc(t.backToTop)}</a> · <a href="${c.to('docs')}">${esc(t.contentsLink)}</a></p>
  </main>
</div>

${siteFooter(home, c)}

<p class="docs-toast" role="status" aria-live="polite"></p>
<script type="application/json" id="oav-docs-i18n">${JSON.stringify(runtime).replace(/</g, '\\u003c')}</script>
<script type="module" src="${c.root}assets/docs/docs.js?v=${assets.js}"></script>
</body>
</html>
`);
}

/** /docs/p5/ (and /zh/docs/p5/): the address the pattern promises, sent on to /p5/ where that chapter lives. Not in the sitemap. */
export function renderMovedStub(t, home, { c, to, title }) {
  return guardEmail(`<!DOCTYPE html>
<html lang="${home.htmlLang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="robots" content="noindex">
<link rel="canonical" href="${SITE + to.abs}">
<meta http-equiv="refresh" content="0; url=${attr(to.rel)}">
<script>location.replace(${JSON.stringify(to.rel)} + location.hash)</script>
</head>
<body>
<p>${fill(esc(t.moved), { href: `<a href="${attr(to.rel)}">${esc(SITE + to.abs)}</a>` })}</p>
</body>
</html>
`);
}
