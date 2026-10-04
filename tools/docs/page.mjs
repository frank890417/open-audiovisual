// The docs page template — one structure, rendered once per language by
// tools/build-docs.mjs. Chapters arrive already rendered from Markdown
// (tools/docs/markdown.mjs); this file only lays out the frame: head, top bar,
// table of contents, chapters, footer.
//
// Static HTML on purpose: crawlers and AI agents read every word without
// JavaScript. assets/docs/docs.js only adds scroll-spy, the narrow-screen
// contents drawer, copy buttons and copy-link on heading anchors.

import { SITE, REPO, BLOB, esc, attr, headBasics, topBar, siteFooter } from '../site/chrome.mjs';

const fill = (s, vars) => String(s).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
const pad2 = (n) => String(n).padStart(2, '0');

/**
 * @param {object} t        docs strings (tools/docs/en.mjs | zh.mjs)
 * @param {object} home     homepage strings (top bar, footer, html lang)
 * @param {object} o
 * @param {object} o.c      pageCtx('docs', locale)
 * @param {{id:string, title:string, html:string, src:string, sections:{id:string, html:string, text:string}[]}[]} o.chapters
 * @param {string} o.version
 * @param {{css:string, js:string}} o.assets   cache stamps for the docs assets
 */
export function renderDocsPage(t, home, { c, chapters, version, assets }) {
  const sections = chapters.reduce((n, ch) => n + ch.sections.length, 0);
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: t.title,
    name: t.meta.title,
    description: t.meta.description,
    url: c.self,
    inLanguage: t.ldLanguage,
    version,
    license: 'https://opensource.org/licenses/MIT',
    author: { '@type': 'Person', name: 'Che-Yu Wu', alternateName: '吳哲宇', url: 'https://cheyuwu.com' },
    isPartOf: { '@type': 'WebSite', name: 'open-audiovisual', url: SITE },
    about: { '@type': 'SoftwareSourceCode', name: 'open-audiovisual', codeRepository: REPO, programmingLanguage: 'JavaScript' },
    articleSection: chapters.map((ch) => ch.title),
    image: SITE + 'assets/home/og.png',
  };
  const runtime = { copy: t.copy, copied: t.copied, linkCopied: t.linkCopied, tocButton: t.tocButton, tocClose: t.tocClose };

  const toc = `<nav class="toc" aria-label="${attr(t.tocLabel)}">
      <p class="toc-title">${esc(t.tocTitle)}</p>
      <ol class="toc-chapters">
        ${chapters.map((ch, i) => `<li class="toc-ch" data-ch="${ch.id}">
          <a href="#${ch.id}"><span class="n">${pad2(i + 1)}</span><span class="t">${esc(ch.title)}</span></a>${ch.sections.length ? `
          <ol class="toc-secs">
            ${ch.sections.map((s) => `<li><a href="#${s.id}">${s.html}</a></li>`).join('\n            ')}
          </ol>` : ''}
        </li>`).join('\n        ')}
      </ol>
    </nav>`;

  const chapterHtml = (ch, i) => {
    // the chapter number and its Markdown source sit right under the chapter heading
    // (a placeholder chapter has no source file yet, so no link)
    const src = ch.fallback === 'placeholder' ? esc(ch.src) : `<a href="${BLOB}${ch.src}">${esc(ch.src)}</a>`;
    const meta = `<p class="chapter-meta"><span class="chapter-n">${pad2(i + 1)}</span><span>${esc(t.chapterSource)}: ${src}</span></p>`;
    const body = ch.html.replace(/(<\/h2>)/, `$1\n${meta}`);
    return `<section class="chapter" data-chapter="${ch.id}" aria-labelledby="${ch.id}">
${body}
</section>`;
  };

  return `<!DOCTYPE html>
<html lang="${home.htmlLang}">
<head>
${headBasics(home, c, { title: t.meta.title, description: t.meta.description, ogDescription: t.meta.ogDescription })}
<link rel="stylesheet" href="${c.root}assets/docs/docs.css?v=${assets.css}">
<script>document.documentElement.classList.add('js')</script>
<script type="application/ld+json">
${JSON.stringify(ld, null, 2)}
</script>
</head>
<body class="docs-page">
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
    <header class="docs-head" id="top">
      <p class="eyebrow">${esc(t.eyebrow)}</p>
      <h1>${esc(t.title)}</h1>
      <p class="docs-lede">${esc(t.lede)}</p>
      <p class="docs-stats">${esc(fill(t.stats, { chapters: chapters.length, sections, version }))}</p>
      <p class="docs-note">${t.sourceNote} <a href="${BLOB}${c.locale === 'zh' ? 'docs/zh/' : 'docs/'}">GitHub ↗</a> · ${fill(t.llmsNote, { llms: c.root + 'llms.txt', llmsFull: c.root + 'llms-full.txt' })}</p>
    </header>

${chapters.map(chapterHtml).join('\n\n')}

    <p class="docs-end"><a href="#top">↑ ${esc(t.backToTop)}</a></p>
  </main>
</div>

${siteFooter(home, c)}

<p class="docs-toast" role="status" aria-live="polite"></p>
<script type="application/json" id="oav-docs-i18n">${JSON.stringify(runtime).replace(/</g, '\\u003c')}</script>
<script type="module" src="${c.root}assets/docs/docs.js?v=${assets.js}"></script>
</body>
</html>
`;
}
