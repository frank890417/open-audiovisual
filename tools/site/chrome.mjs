// The frame every page of the site shares: <head> basics, the top bar, the
// footer. One copy, so the homepage, /controllers/ and /docs/ never drift.
//
//   import { PAGES, pageCtx, headBasics, topBar, siteFooter } from '../site/chrome.mjs';
//   const c = pageCtx('docs', 'zh');           // urls, relative root, language-switch hrefs
//   `${headBasics(t, c, { title, description })} … ${topBar(t, c)} … ${siteFooter(t, c)}`
//
// Strings come from the homepage tables (tools/home/en.mjs, zh.mjs: `ui`, `footer`),
// so a nav label is translated once for the whole site.

export const SITE = 'https://openaudiovisual.com/';
export const REPO = 'https://github.com/frank890417/open-audiovisual';
export const BLOB = REPO + '/blob/main/';
export const TREE = REPO + '/tree/main/';

/** Every page of the site: its path under / (and under /zh/). */
export const PAGES = {
  home: '',
  controllers: 'controllers/',
  docs: 'docs/',
  webtoe: 'webtoe/',
};

/** The top-bar nav. `home` entries are sections of the homepage; the others are pages. */
export const NAV = [
  ['play', { home: '#play' }],
  ['how', { home: '#how' }],
  ['works', { home: '#works' }],
  ['controllers', { page: 'controllers' }],
  ['docs', { page: 'docs' }],
  ['webtoe', { page: 'webtoe' }],
  ['agents', { home: '#agents' }],
];

/** Google Analytics for the site's own pages (property "open-audiovisual (openaudiovisual.com)").
 *  Only on openaudiovisual.com itself, so local runs and forks don't report. The packages never load this:
 *  embeds send one anonymous hit instead (packages/midi/telemetry.js). Examples carry the same snippet. */
export const GA_ID = 'G-1YG2JHK2WT';
export const GA_SNIPPET = `<script>if(/(^|\\.)openaudiovisual\\.com$/.test(location.hostname)){window.dataLayer=window.dataLayer||[];window.gtag=function(){dataLayer.push(arguments)};gtag('js',new Date());gtag('config','${GA_ID}');var s=document.createElement('script');s.async=true;s.src='https://www.googletagmanager.com/gtag/js?id=${GA_ID}';document.head.appendChild(s)}</script>`;

export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export const attr = (s) => esc(s).replace(/"/g, '&quot;');

export const LOGO = `<svg class="mark" viewBox="0 0 32 32" aria-hidden="true" focusable="false"><circle cx="6.5" cy="16" r="3.6"/><path d="M11 16c2.6 0 2.9-9 6-9s3.2 18 6.2 18 3-9 5.8-9"/></svg>`;

export const FAVICON = 'data:image/svg+xml,' + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#0b0b0c"/><circle cx="7" cy="16" r="3.4" fill="#ff5a1f"/><path d="M11 16c2.6 0 2.9-9 6-9s3.2 18 6.2 18 3-9 5.8-9" fill="none" stroke="#edebe5" stroke-width="2.4" stroke-linecap="round"/></svg>`);

/**
 * Everything a page needs to place itself: absolute urls in both languages,
 * the relative path back to the site root (for assets and packages), and
 * relative hrefs for the language switch.
 */
export function pageCtx(page, locale) {
  const p = PAGES[page];
  if (p === undefined) throw new Error(`unknown page "${page}"`);
  const depth = (locale === 'zh' ? 1 : 0) + p.split('/').filter(Boolean).length;
  const root = depth ? '../'.repeat(depth) : './';
  const url = { en: SITE + p, zh: SITE + 'zh/' + p };
  const lang = { en: root + p || './', zh: root + 'zh/' + p };
  return { page, locale, other: locale === 'en' ? 'zh' : 'en', root, self: url[locale], url, lang,
    /** href to another page of the site, in this language */
    to: (other, hash = '') => (root + (locale === 'zh' ? 'zh/' : '') + PAGES[other]) + hash || './' };
}

/** charset, viewport, title, description, canonical + hreflang trio, theme, OG, favicon, fonts, site CSS. */
export function headBasics(t, c, { title, description, ogDescription = description, ogImage = SITE + 'assets/home/og.png' }) {
  return `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${attr(description)}">
<link rel="canonical" href="${c.self}">
<link rel="alternate" hreflang="en" href="${c.url.en}">
<link rel="alternate" hreflang="zh-Hant" href="${c.url.zh}">
<link rel="alternate" hreflang="x-default" href="${c.url.en}">
<link rel="alternate" type="text/markdown" href="${c.root}llms.txt" title="llms.txt">
<meta name="theme-color" content="#0b0b0c">
<meta name="color-scheme" content="dark">
<meta property="og:type" content="website">
<meta property="og:site_name" content="open-audiovisual">
<meta property="og:title" content="${attr(title)}">
<meta property="og:description" content="${attr(ogDescription)}">
<meta property="og:url" content="${c.self}">
<meta property="og:locale" content="${t.ogLocale}">
<meta property="og:image" content="${ogImage}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="${FAVICON}">
<link rel="preload" href="${c.root}assets/home/fonts/archivo-var-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${c.root}assets/home/home.css">
${GA_SNIPPET}`;
}

/** Skip link + sticky top bar: brand, site nav (current page marked), language switch, GitHub. */
export function topBar(t, c) {
  const href = ([, d]) => d.page ? c.to(d.page) : (c.page === 'home' ? d.home : c.to('home', d.home));
  const cur = ([, d]) => d.page && d.page === c.page ? ' aria-current="page"' : '';
  return `<a class="skip" href="#main">${t.ui.skip}</a>

<header class="top">
  <a class="brand" href="${c.to('home')}" aria-label="${attr(t.ui.home)}">${LOGO}<span>open-audiovisual</span></a>
  <nav class="nav" aria-label="${attr(t.ui.navLabel)}">
    ${NAV.map((n) => `<a href="${href(n)}"${cur(n)}>${t.ui.nav[n[0]]}</a>`).join('\n    ')}
  </nav>
  <div class="top-end">
    <div class="langs" role="group" aria-label="${attr(t.ui.langLabel)}">
      <a href="${c.lang.en}" hreflang="en" lang="en" data-lang="en"${c.locale === 'en' ? ' aria-current="page"' : ''}>EN</a><span aria-hidden="true">|</span><a href="${c.lang.zh}" hreflang="zh-Hant" lang="zh-Hant-TW" data-lang="zh"${c.locale === 'zh' ? ' aria-current="page"' : ''}>中文</a>
    </div>
    <a class="gh" href="${REPO}">GitHub</a>
  </div>
</header>`;
}

/** Footer: wordmark, license, the site's pages (the top nav hides on narrow screens), machine-readable files. */
export function siteFooter(t, c) {
  return `<footer class="foot">
  <p class="foot-mark" aria-hidden="true">open-audiovisual</p>
  <div class="foot-grid">
    <div>
      <p>${t.footer.license}</p>
      <p class="note">${t.footer.artworks}</p>
    </div>
    <nav aria-label="${attr(t.footer.pages)}">
      <a href="${c.to('home')}">${t.footer.homeLink}</a>
      <a href="${c.to('controllers')}">${t.ui.nav.controllers}</a>
      <a href="${c.to('docs')}">${t.ui.nav.docs}</a>
      <a href="${c.to('webtoe')}">${t.ui.nav.webtoe}</a>
    </nav>
    <nav aria-label="${attr(t.footer.machine)}">
      <a href="${REPO}">GitHub</a>
      <a href="${c.root}llms.txt">llms.txt</a>
      <a href="${c.root}llms-full.txt">llms-full.txt</a>
      <a href="${BLOB}AGENTS.md">AGENTS.md</a>
    </nav>
  </div>
</footer>`;
}
