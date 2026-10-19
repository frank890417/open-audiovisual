// The frame every page of the site shares: <head> basics, the top bar, the
// footer. One copy, so the homepage, /controllers/ and /docs/ never drift.
//
//   import { PAGES, pageCtx, headBasics, topBar, siteFooter } from '../site/chrome.mjs';
//   const c = pageCtx('docs', 'zh');           // urls, relative root, language-switch hrefs
//   `${headBasics(t, c, { title, description })} … ${topBar(t, c)} … ${siteFooter(t, c)}`
//
// Strings come from the homepage tables (tools/home/en.mjs, zh.mjs: `ui`, `footer`, `seo`),
// so a nav label is translated once for the whole site.
//
// headBasics() is the ONE place a <head> is made: title, description, robots, canonical + the hreflang
// trio, Open Graph and Twitter (with image alt), real icon files, the manifest, the llms.txt pointer and
// the page's JSON-LD (jsonLdGraph: WebSite, Person and the software, tied together by @id, plus the page's
// own nodes). pathCtx() places ANY page of the site (examples, /p5/, device pages …); pageCtx() is the same
// for the named top-level pages. guardEmail() fences a page off from Cloudflare's email obfuscation.
//
// This file imports nothing from the other site modules (facts, pages): they import it.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';



const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export const SITE = 'https://openaudiovisual.com/';
export const REPO = 'https://github.com/frank890417/open-audiovisual';
export const BLOB = REPO + '/blob/main/';
export const TREE = REPO + '/tree/main/';

/** The named top-level pages: their path under / (and under /zh/). Every other public page is in tools/site/pages.mjs. */
export const PAGES = {
  home: '',
  controllers: 'controllers/',
  docs: 'docs/',
  reference: 'docs/reference/',
  webtoe: 'webtoe/',
  examples: 'examples/',
  p5: 'p5/',
  check: 'check/',
  changelog: 'changelog/',
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

/** The magnifier in the top bar's search button. */
export const SEARCH_ICON = `<svg class="search-icon" viewBox="0 0 20 20" aria-hidden="true" focusable="false"><circle cx="8.5" cy="8.5" r="5.5"/><path d="M13 13l4.5 4.5"/></svg>`;

export const LOGO = `<svg class="mark" viewBox="0 0 32 32" aria-hidden="true" focusable="false"><circle cx="6.5" cy="16" r="3.6"/><path d="M11 16c2.6 0 2.9-9 6-9s3.2 18 6.2 18 3-9 5.8-9"/></svg>`;

// ---------------------------------------------------------------------------- icons
/** The mark, as a standalone icon. tools/site/make-icons.mjs rasterizes it into the files below. */
export const ICON_SVG = (rx = 6) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="${rx}" fill="#0b0b0c"/><circle cx="7" cy="16" r="3.4" fill="#ff5a1f"/><path d="M11 16c2.6 0 2.9-9 6-9s3.2 18 6.2 18 3-9 5.8-9" fill="none" stroke="#edebe5" stroke-width="2.4" stroke-linecap="round"/></svg>`;
/** The icon files a page links (paths from the site root). Real files, not data: URIs, so image crawlers can fetch them. */
export const ICON_FILES = {
  ico: 'favicon.ico',                       // 16, 32, 48 px
  svg: 'favicon.svg',
  apple: 'apple-touch-icon.png',            // 180 px, full-bleed (iOS rounds it itself)
  png192: 'assets/icons/icon-192.png',
  png512: 'assets/icons/icon-512.png',
  manifest: 'site.webmanifest',
};

// ---------------------------------------------------------------------------- contexts
/**
 * Where any page of the site sits: absolute urls in both languages, the relative path back to the site root
 * (for assets and packages), and relative hrefs for the language switch.
 *   p        path under the site root, "" | "docs/" | "examples/01-hello-particles/" (no "zh/")
 *   langs    which languages the page exists in; a one-language page gets a canonical and no hreflang
 *   page     the top-level page this one belongs to (marks the nav)
 */
export function pathCtx(p, locale, { langs = ['en', 'zh'], page } = {}) {
  const depth = (locale === 'zh' ? 1 : 0) + p.split('/').filter(Boolean).length;
  const root = depth ? '../'.repeat(depth) : './';
  const url = { en: SITE + p, zh: SITE + 'zh/' + p };
  const both = langs.includes('en') && langs.includes('zh');
  const lang = { en: root + p || './', zh: both ? root + 'zh/' + p : root + 'zh/' };   // no twin: the switch goes to the homepage
  return { page, locale, other: locale === 'en' ? 'zh' : 'en', root, self: url[locale], url, lang, langs, both,
    /** href to another page of the site, in this language */
    to: (other, hash = '') => (root + (locale === 'zh' ? 'zh/' : '') + PAGES[other]) + hash || './' };
}

/** pathCtx() for a named page of PAGES. */
export function pageCtx(page, locale) {
  const p = PAGES[page];
  if (p === undefined) throw new Error(`unknown page "${page}"`);
  return pathCtx(p, locale, { page });
}

/** A context for pages that sit at any depth (404.html answers every missing url): every path is absolute from "/". */
export function absoluteCtx(locale) {
  return { page: undefined, locale, other: locale === 'en' ? 'zh' : 'en', root: '/', self: null, url: { en: SITE, zh: SITE + 'zh/' },
    lang: { en: '/', zh: '/zh/' }, langs: ['en', 'zh'], both: true,
    to: (other, hash = '') => '/' + (locale === 'zh' ? 'zh/' : '') + PAGES[other] + hash };
}

// ---------------------------------------------------------------------------- JSON-LD
export const PERSON_ID = 'https://cheyuwu.com/#person';
export const WEBSITE_ID = SITE + '#website';
export const SOFTWARE_ID = SITE + '#software';
const pkg = () => JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

/**
 * The nodes every page shares. Same @id on every page, so a crawler that reads two pages knows it is one site
 * by one person: WebSite → publisher → Person (the same @id cheyuwu.com uses), and the software they are about.
 * No Organization: there is no organization, and a made-up one is a made-up claim.
 */
export function sharedNodes() {
  return [
    { '@type': 'WebSite', '@id': WEBSITE_ID, url: SITE, name: 'open-audiovisual', inLanguage: ['en', 'zh-Hant'], publisher: { '@id': PERSON_ID },
      potentialAction: { '@type': 'SearchAction', target: { '@type': 'EntryPoint', urlTemplate: SITE + 'docs/reference/?q={search_term_string}' }, 'query-input': 'required name=search_term_string' } },
    { '@type': 'Person', '@id': PERSON_ID, name: 'Che-Yu Wu', alternateName: '吳哲宇', url: 'https://cheyuwu.com/',
      sameAs: ['https://github.com/frank890417', 'https://www.wikidata.org/wiki/Q138836579'] },
    {
      '@type': ['SoftwareSourceCode', 'SoftwareApplication'], '@id': SOFTWARE_ID,
      name: 'open-audiovisual', alternateName: 'OAV', url: SITE,
      description: 'A web-native, zero-build, zero-dependency JavaScript framework for audiovisual performance: MIDI, microphones, chords, hand tracking and phones publish named signals, a mapping layer routes them to parameters, and algorithmic worlds (p5.js, WebGL, WebToe) render and sound them.',
      codeRepository: REPO, programmingLanguage: 'JavaScript', runtimePlatform: 'Web browser',
      applicationCategory: 'MultimediaApplication', operatingSystem: 'Any (Chromium for Web MIDI)',
      license: 'https://opensource.org/licenses/MIT', isAccessibleForFree: true,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      version: pkg().version,
      keywords: ['audiovisual performance', 'creative coding', 'Web MIDI', 'generative art', 'live visuals', 'OSC', 'show control', 'MCP'],
      author: { '@id': PERSON_ID }, isPartOf: { '@id': WEBSITE_ID }, sameAs: [REPO],
    },
  ];
}

/** One JSON-LD @graph for a page: the shared nodes plus the page's own. */
export function jsonLdGraph(c, t, nodes = []) {
  return { '@context': 'https://schema.org', '@graph': [...sharedNodes(), ...nodes.filter(Boolean)] };
}

/** The page's own WebPage-ish node (type: WebPage, CollectionPage, TechArticle, …): in this site, by this person, in this language. */
export function pageNode(c, t, { type = 'WebPage', name, description, image = SITE + 'assets/home/og.png', ...more }) {
  return {
    '@type': type, '@id': c.self + '#webpage', url: c.self, name, description, inLanguage: t.ldLanguage,
    isPartOf: { '@id': WEBSITE_ID }, author: { '@id': PERSON_ID }, publisher: { '@id': PERSON_ID },
    primaryImageOfPage: { '@type': 'ImageObject', url: image, width: 1200, height: 630 },
    ...more,
  };
}

/** The homepage of this page's language. */
export const homeUrl = (c) => SITE + (c.locale === 'zh' ? 'zh/' : '');

/** BreadcrumbList node (@id self#breadcrumb): trail = [[name, url], …] ending with this page. */
export function breadcrumbNode(c, trail) {
  return {
    '@type': 'BreadcrumbList', '@id': c.self + '#breadcrumb',
    itemListElement: trail.map(([name, item], i) => ({ '@type': 'ListItem', position: i + 1, name, item })),
  };
}

/** One compact line: the shared nodes ride on every page, so their size is paid fifty times. `<` is escaped so no string can close the tag. */
export const ldScript = (graph) => `<script type="application/ld+json">${JSON.stringify(graph).replace(/</g, '\\u003c')}</script>`;

// ---------------------------------------------------------------------------- <head>
const OG_LOCALE = { en: 'en_US', zh: 'zh_TW' };

/**
 * charset, viewport, title, description, robots, canonical + hreflang trio, theme, Open Graph, Twitter, icons,
 * manifest, llms.txt, fonts, site CSS, analytics and the JSON-LD graph.
 *
 *   title, description, ogDescription   (ogDescription defaults to description)
 *   ogImage, ogImageAlt, ogType         (website | article | …; the image defaults to the shared card)
 *   noindex                             true → <meta name="robots" content="noindex">, and no canonical / hreflang / og:url
 *   robots                              a robots string for an indexable page (default: none, the engines' default)
 *   markdownHref                        this page's own Markdown twin (rel="alternate" type="text/markdown")
 *   ld                                  the page's JSON-LD nodes, added to the shared graph; false → no JSON-LD at all
 *   siteCss                             false → no site font preload / home.css (a page with its own styles, like an example)
 *   analytics                           false → no Google Analytics snippet (a page that already carries its own, like an example)
 */
export function headBasics(t, c, {
  title, description, ogDescription = description, ogImage = SITE + 'assets/home/og.png', ogImageAlt = t.seo.ogImageAlt,
  ogType = 'website', noindex = false, robots = '', markdownHref = '', ld = [], siteCss = true, analytics = true,
}) {
  const canonical = !noindex && c.self;
  const twin = canonical && c.both;
  const lines = [
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${attr(description)}">`,
    noindex ? '<meta name="robots" content="noindex">' : robots ? `<meta name="robots" content="${attr(robots)}">` : '',
    canonical ? `<link rel="canonical" href="${c.self}">` : '',
    twin ? `<link rel="alternate" hreflang="en" href="${c.url.en}">` : '',
    twin ? `<link rel="alternate" hreflang="zh-Hant" href="${c.url.zh}">` : '',
    twin ? `<link rel="alternate" hreflang="x-default" href="${c.url.en}">` : '',
    markdownHref ? `<link rel="alternate" type="text/markdown" href="${markdownHref}">` : '',
    `<link rel="describedby" href="${c.root}llms.txt" title="llms.txt">`,
    '<meta name="theme-color" content="#0b0b0c">',
    '<meta name="color-scheme" content="dark">',
    `<meta property="og:type" content="${ogType}">`,
    '<meta property="og:site_name" content="open-audiovisual">',
    `<meta property="og:title" content="${attr(title)}">`,
    `<meta property="og:description" content="${attr(ogDescription)}">`,
    canonical ? `<meta property="og:url" content="${c.self}">` : '',
    `<meta property="og:locale" content="${t.ogLocale}">`,
    twin ? `<meta property="og:locale:alternate" content="${OG_LOCALE[c.other]}">` : '',
    `<meta property="og:image" content="${ogImage}">`,
    '<meta property="og:image:width" content="1200">',
    '<meta property="og:image:height" content="630">',
    `<meta property="og:image:alt" content="${attr(ogImageAlt)}">`,
    '<meta name="twitter:card" content="summary_large_image">',
    `<meta name="twitter:title" content="${attr(title)}">`,
    `<meta name="twitter:description" content="${attr(ogDescription)}">`,
    `<meta name="twitter:image" content="${ogImage}">`,
    `<meta name="twitter:image:alt" content="${attr(ogImageAlt)}">`,
    `<link rel="icon" href="${c.root}${ICON_FILES.ico}" sizes="48x48">`,
    `<link rel="icon" href="${c.root}${ICON_FILES.svg}" type="image/svg+xml" sizes="any">`,
    `<link rel="apple-touch-icon" href="${c.root}${ICON_FILES.apple}">`,
    `<link rel="manifest" href="${c.root}${ICON_FILES.manifest}">`,
    siteCss ? `<link rel="preload" href="${c.root}assets/home/fonts/archivo-var-latin.woff2" as="font" type="font/woff2" crossorigin>` : '',
    siteCss ? `<link rel="stylesheet" href="${c.root}assets/home/home.css">` : '',
    siteCss ? `<script type="module" src="${c.root}assets/search/search.js"></script>` : '',   // the nav's search (every page with a top bar)
    analytics ? GA_SNIPPET : '',
    ld === false ? '' : ldScript(jsonLdGraph(c, t, ld)),
  ];
  return lines.filter(Boolean).join('\n');
}

/**
 * Cloudflare's Email Address Obfuscation rewrites anything that looks like user@host.tld, and `p5@1.11.11`
 * in a code block does. It skips what sits between these two comments, so every generated page puts its
 * whole body in between: the repository side of the fix (switching the setting off in the dashboard is the other).
 */
export const EMAIL_OFF = ['<!--email_off-->', '<!--/email_off-->'];
export function guardEmail(html) {
  return html.replace(/(<body[^>]*>)/, `$1\n${EMAIL_OFF[0]}`).replace(/<\/body>/, `${EMAIL_OFF[1]}\n</body>`);
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
    <a class="nav-search" href="${c.to('reference')}" data-search data-placeholder="${attr(t.ui.searchPlaceholder)}" data-loading="${attr(t.ui.searchLoading)}" aria-label="${attr(t.ui.searchLabel)}" aria-keyshortcuts="Control+K Meta+K /">${SEARCH_ICON}<span class="nav-search-label">${esc(t.ui.search)}</span></a>
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
      <a href="${c.to('examples')}">${t.footer.examples}</a>
      <a href="${c.to('controllers')}">${t.ui.nav.controllers}</a>
      <a href="${c.to('docs')}">${t.ui.nav.docs}</a>
      <a href="${c.to('p5')}">${t.footer.p5}</a>
      <a href="${c.to('webtoe')}">${t.ui.nav.webtoe}</a>
      <a href="${c.to('changelog')}">${t.footer.changelog}</a>
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
