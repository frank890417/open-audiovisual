// Everything the examples workstream renders, as strings:
//   renderIndex(locale)        /examples/ and /zh/examples/: the examples by route, one card each
//   exampleHead(e)             the <head> region of examples/NN-*/index.html (title, description, canonical, Open Graph, JSON-LD)
//   exampleGuide(e)            the guide card region: a readable description that needs no JavaScript, collapsible with it
//   exampleNext(e)             example 15 only: the "next example" link (its page has its own explanation)
//   renderP5(locale)           /p5/ and /zh/p5/, from docs/p5.md and docs/zh/p5.md
//
// tools/build-examples.mjs writes the results; nothing here touches the disk except reading docs/p5.md.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SITE, REPO, BLOB, TREE, SOFTWARE_ID, PERSON_ID, esc, attr, pathCtx, pageCtx, headBasics, pageNode, breadcrumbNode, homeUrl, topBar, siteFooter, guardEmail,
} from '../site/chrome.mjs';
import { EXAMPLES, routeGroups, byId, nextOf, L, plainText, exampleUrl, sourceUrl, lineUrl } from './catalog.mjs';
import { STRINGS, TAGS, ROUTE_NAMES, ROUTE_INTRO, ROUTE_LAYER, routeMark } from './strings.mjs';
import { CHAPTERS } from '../docs/chapters.mjs';
import { renderMarkdown } from '../docs/markdown.mjs';
import homeEn from '../home/en.mjs';
import homeZh from '../home/zh.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const HOME = { en: homeEn, zh: homeZh };
const ZH = 'zh-Hant';
const tag = (id, locale) => TAGS[id][locale === 'zh' ? 1 : 0];

/** Both languages of one element: <tag lang="en">…</tag><tag lang="zh-Hant">…</tag>. `en` and `zh` are HTML. */
const bi = (en, zh, el = 'span', cls = '') => `<${el}${cls ? ` class="${cls}"` : ''} lang="en">${en}</${el}><${el}${cls ? ` class="${cls}"` : ''} lang="${ZH}">${zh}</${el}>`;
const pair = (v, f = esc) => [f(v.en), f(v.zh)];

// ---------------------------------------------------------------------------- /examples/
const chips = (ids, locale, cls) => `<ul class="chips">${ids.map((id) => `<li class="chip ${cls}">${esc(tag(id, locale))}</li>`).join('')}</ul>`;

function chipRows(e, locale) {
  const S = STRINGS[locale].card;
  if (!e.needs.length) return `<div class="chip-row"><span class="chip-label chip-ok">${esc(S.noneNeeded)}</span>${chips(e.standIn, locale, 'chip-stand')}</div>`;
  return `<div class="chip-row"><span class="chip-label">${esc(S.needs)}</span>${chips(e.needs, locale, 'chip-need')}</div>
        <div class="chip-row"><span class="chip-label">${esc(S.without)}</span>${chips(e.standIn, locale, 'chip-stand')}</div>`;
}

function workCard(e, locale, c) {
  const S = STRINGS[locale].card;
  const href = `${c.root}${e.dir}`;
  return `<li class="work" id="ex-${e.num}">
        <div class="work-img"><img src="${c.root}${e.thumb}" width="800" height="500" loading="lazy" decoding="async" alt="${attr(L(e.alt, locale))}"></div>
        <div class="work-label">
          <p class="work-n">${e.num}</p>
          <h3><a class="work-link" data-ex href="${href}">${esc(L(e.title, locale))}</a></h3>
          <p class="work-text">${esc(L(e.teaches, locale))}</p>
          ${chipRows(e, locale)}
          <p class="work-links"><a class="work-open" data-ex href="${href}">${esc(S.open)} →</a> <a class="work-src" href="${sourceUrl(e)}">${esc(S.source)} ↗</a></p>
        </div>
      </li>`;
}

export function renderIndex(locale) {
  const t = HOME[locale], S = STRINGS[locale], c = pageCtx('examples', locale);
  const title = S.index.title(), description = S.index.description();
  const groups = routeGroups();
  const url = (e) => exampleUrl(e.id);
  const ld = [
    pageNode(c, t, { type: 'CollectionPage', name: title, description, about: { '@id': SOFTWARE_ID }, mainEntity: { '@id': c.self + '#list' }, breadcrumb: { '@id': c.self + '#breadcrumb' } }),
    {
      '@type': 'ItemList', '@id': c.self + '#list', name: S.index.h1(), numberOfItems: EXAMPLES.length, itemListOrder: 'https://schema.org/ItemListOrderAscending',
      itemListElement: groups.flatMap((g) => g.items).map((e, i) => ({ '@type': 'ListItem', position: i + 1, url: url(e), name: L(e.title, locale) })),
    },
    breadcrumbNode(c, [[S.crumbs.home, homeUrl(c)], [S.crumbs.examples, c.self]]),
  ];
  const routeNav = groups.map((g) => `<li><a href="#route-${g.route}"><span class="rn-mark">${routeMark(g.route)}</span> ${esc(ROUTE_NAMES[g.route][locale === 'zh' ? 1 : 0])} <small>${g.items.length}</small></a></li>`).join('\n        ');
  const sections = groups.map((g) => {
    const layer = ROUTE_LAYER[g.route];
    return `  <section class="sec route" id="route-${g.route}" aria-labelledby="route-${g.route}-title">
    <header class="sec-head">
      <p class="eyebrow">${routeMark(g.route)} ${esc(S.index.routeLabel)}${layer ? ` · ${esc(layer)}` : ''}</p>
      <h2 id="route-${g.route}-title">${esc(ROUTE_NAMES[g.route][locale === 'zh' ? 1 : 0])}</h2>
      <p class="sec-lede">${esc(ROUTE_INTRO[g.route][locale === 'zh' ? 1 : 0])}</p>
    </header>
    <ol class="works">
      ${g.items.map((e) => workCard(e, locale, c)).join('\n      ')}
    </ol>
  </section>`;
  }).join('\n\n');

  return guardEmail(`<!DOCTYPE html>
<html lang="${t.htmlLang}">
<head>
${headBasics(t, c, { title, description, ld })}
<link rel="stylesheet" href="${c.root}assets/examples/pages.css">
</head>
<body class="examples-page">
${topBar(t, c)}

<main id="main">
  <section class="sec ex-intro" aria-labelledby="ex-title">
    <header class="sec-head">
      <p class="eyebrow">${esc(S.index.eyebrow)}</p>
      <h1 id="ex-title">${esc(S.index.h1())}</h1>
      <p class="sec-lede">${t.works.lede}</p>
    </header>
    <nav class="route-nav" aria-label="${attr(S.index.routeLabel)}">
      <ol>
        ${routeNav}
      </ol>
    </nav>
    <p class="works-note">${esc(S.index.how)}</p>
  </section>

${sections}

  <section class="sec ex-end">
    <p class="works-note">${t.works.note}</p>
  </section>
</main>

${siteFooter(t, c)}
<script>document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a[data-ex]');if(a){try{localStorage.setItem('oav-ui','${locale}')}catch(x){}}})</script>
</body>
</html>
`);
}

// ---------------------------------------------------------------------------- one example page
const exCtx = (e) => pathCtx(`examples/${e.id}/`, 'en', { langs: ['en'], page: 'examples' });

/** The example's title and description, as the <head> and the guide card use them. */
export function exampleMeta(e) {
  const title = `${e.title.en} · open-audiovisual example`;
  const description = `${plainText(e.teaches.en)} ${e.needs.length ? `Plays with ${e.plays.en}.` : 'Runs in the browser, no hardware needed.'}`;
  return { title, description };
}

export function exampleHead(e) {
  const c = exCtx(e), t = homeEn;
  const { title, description } = exampleMeta(e);
  const code = {
    '@type': 'SoftwareSourceCode', '@id': c.self + '#code', name: `${e.title.en} (open-audiovisual example ${e.num})`,
    url: sourceUrl(e), codeRepository: REPO, programmingLanguage: 'JavaScript', runtimePlatform: 'Web browser',
    isPartOf: { '@id': SOFTWARE_ID }, author: { '@id': PERSON_ID },
    ...(e.credit ? { copyrightNotice: `${plainText(e.credit.en)}. ${e.credit.rights.en}` } : {}),
  };
  const ld = [
    pageNode(c, t, {
      name: title, description, inLanguage: ['en', ZH], about: { '@id': SOFTWARE_ID }, mainEntity: { '@id': code['@id'] },
      breadcrumb: { '@id': c.self + '#breadcrumb' },
      ...(nextOf(e) ? { significantLink: exampleUrl(nextOf(e).id) } : {}),
    }),
    code,
    breadcrumbNode(c, [[STRINGS.en.crumbs.home, SITE], [STRINGS.en.crumbs.examples, SITE + 'examples/'], [e.title.en, c.self]]),
  ];
  return [
    headBasics(t, c, { title, description, ld, siteCss: false, analytics: false }),
    e.guide === false ? '' : `<link rel="stylesheet" href="${c.root}assets/examples/guide.css">`,
  ].filter(Boolean).join('\n');
}

const href = (c, p) => c.root + p;

/** The guide card: static, bilingual (the page's own language switch, data-ui, picks one), no JavaScript needed to read it. */
export function exampleGuide(e) {
  const c = exCtx(e), G = { en: STRINGS.en.guide, zh: STRINGS.zh.guide };
  const next = nextOf(e);
  const route = [ROUTE_NAMES[e.route][0], ROUTE_NAMES[e.route][1]];
  const needsRow = e.needs.length
    ? `<p class="g-row">${bi(`<b>${G.en.needs}:</b> ${e.needs.map((x) => esc(tag(x, 'en'))).join(' · ')}.`, `<b>${G.zh.needs}：</b>${e.needs.map((x) => esc(tag(x, 'zh'))).join('、')}。`)}
        ${bi(`${G.en.without} ${e.standIn.map((x) => esc(tag(x, 'en'))).join(' · ')}.`, `${G.zh.without}${e.standIn.map((x) => esc(tag(x, 'zh'))).join('、')}。`)}</p>`
    : `<p class="g-row">${bi(`<b>${G.en.noneNeeded}</b> ${e.standIn.map((x) => esc(tag(x, 'en'))).join(' · ')}.`, `<b>${G.zh.noneNeeded}</b>${e.standIn.map((x) => esc(tag(x, 'zh'))).join('、')}。`)}</p>`;
  const tries = ['en', 'zh'].map((l) => `<ol class="g-try" lang="${l === 'zh' ? ZH : 'en'}">${e.tryThree[l].map((x) => `<li>${esc(x)}</li>`).join('')}</ol>`).join('\n        ');
  const reads = `<ul class="g-read">${e.read.map((r) => `<li><a href="${lineUrl(e, r)}"><code>${esc(r.file)}:${r.from}${r.to > r.from ? '–' + r.to : ''}</code></a> ${bi(esc(r.note.en), esc(r.note.zh))}</li>`).join('')}</ul>`;
  const docs = e.docs.length
    ? `<p class="g-row"><b>${bi(G.en.docs, G.zh.docs)}:</b> ${e.docs.map((d) => `${bi(`<a href="${href(c, 'docs/')}#${d.id}">${esc(d.en)}</a>`, `<a href="${href(c, 'zh/docs/')}#${d.id}">${esc(d.zh)}</a>`)}`).join(' · ')}</p>`
    : '';
  const p5 = e.p5Line
    ? `<p class="g-row g-p5">${bi(`<b>${esc(G.en.p5)}</b>`, `<b>${esc(G.zh.p5)}</b>`)} ${bi(`<a href="${href(c, 'examples/15-p5-one-line/')}">${G.en.p5Example}</a> · <a href="${href(c, 'docs/')}#p5">${G.en.p5Docs}</a>`, `<a href="${href(c, 'examples/15-p5-one-line/')}">${G.zh.p5Example}</a> · <a href="${href(c, 'zh/docs/')}#p5">${G.zh.p5Docs}</a>`)}</p>`
    : '';
  const credit = e.credit
    ? `<p class="g-credit">${bi(`${G.en.copyright}: ${e.credit.en}. ${esc(e.credit.rights.en)}`, `${G.zh.copyright}：${e.credit.zh}。${esc(e.credit.rights.zh)}`)}</p>`
    : '';
  const nextRow = `<p class="g-next">${next
    ? bi(`<b>${G.en.next}:</b> <a href="${href(c, next.dir)}">${next.num} ${esc(next.title.en)} →</a>`, `<b>${G.zh.next}：</b><a href="${href(c, next.dir)}">${next.num} ${esc(next.title.zh)} →</a>`)
    : bi(esc(G.en.last), esc(G.zh.last))}
    ${bi(`<a href="${href(c, 'examples/')}">${G.en.all}</a>`, `<a href="${href(c, 'zh/examples/')}">${G.zh.all}</a>`)}</p>`;
  return `<aside class="oav-guide" id="oav-guide" data-ui="en" aria-labelledby="g-title">
  <div class="g-bar">
    <p class="g-eyebrow">${bi(`${G.en.example} ${e.num} · <a href="${href(c, 'examples/')}#route-${e.route}">${esc(route[0])}</a>`, `${G.zh.example} ${e.num} · <a href="${href(c, 'zh/examples/')}#route-${e.route}">${esc(route[1])}</a>`)}</p>
    <span class="g-tools" hidden>
      <button type="button" class="g-lang" data-set="en" aria-pressed="true">EN</button><button type="button" class="g-lang" data-set="zh" aria-pressed="false">中文</button>
      <button type="button" class="g-toggle" aria-expanded="true" aria-controls="g-body" data-hide="${attr(G.en.hide)}" data-show="${attr(G.en.show)}" data-hide-zh="${attr(G.zh.hide)}" data-show-zh="${attr(G.zh.show)}">${G.en.hide}</button>
    </span>
  </div>
  <div class="g-body" id="g-body">
    <h1 id="g-title">${bi(esc(e.title.en), esc(e.title.zh))}</h1>
    <p class="g-teaches">${bi(esc(e.teaches.en), esc(e.teaches.zh))}</p>
    <h2>${bi(G.en.try, G.zh.try)}</h2>
        ${tries}
    ${needsRow}
    <h2>${bi(G.en.read, G.zh.read)}</h2>
    ${reads}
    ${p5}
    ${docs}
    ${nextRow}
    ${credit}
  </div>
</aside>
<script src="${href(c, 'assets/examples/guide.js')}"></script>`;
}

/** Example 15 has its own explanation: only the way on. */
export function exampleNext(e) {
  const c = exCtx(e), G = { en: STRINGS.en.guide, zh: STRINGS.zh.guide }, next = nextOf(e);
  return `<nav class="oav-next" aria-label="${attr(G.en.next)}" style="max-width:920px;margin:0 auto;padding:8px 20px 0">
  <p class="links">${next
    ? bi(`${G.en.next}: <a href="${href(c, next.dir)}">${next.num} ${esc(next.title.en)} →</a>`, `${G.zh.next}：<a href="${href(c, next.dir)}">${next.num} ${esc(next.title.zh)} →</a>`)
    : ''}
  ${bi(`<a href="${href(c, 'examples/')}">${G.en.all}</a>`, `<a href="${href(c, 'zh/examples/')}">${G.zh.all}</a>`)}</p>
</nav>`;
}

// ---------------------------------------------------------------------------- /p5/
const CHAPTER_OF = new Map(CHAPTERS.map((ch) => [path.posix.basename(ch.en), ch.id]));

function p5Resolver(c) {
  return (h) => {
    if (!h || /^[a-z][\w+.-]*:/i.test(h) || h.startsWith('#')) return h;
    const [p, frag] = h.split('#');
    const id = CHAPTER_OF.get(path.posix.basename(p));
    return id ? c.to('docs', '#' + (frag ? `${id}-${frag}` : id)) : h;
  };
}

export const P5_SOURCE = { en: 'docs/p5.md', zh: 'docs/zh/p5.md' };

export function renderP5(locale) {
  const t = HOME[locale], S = STRINGS[locale], c = pageCtx('p5', locale);
  const md = fs.readFileSync(path.join(ROOT, P5_SOURCE[locale]), 'utf8');
  const heading = /^#\s+(.+)$/m.exec(md)[1].trim();
  const body = md.replace(/^#\s+.+\n+/, '');
  const used = new Set(['top', 'main', 'toc']);
  const r = renderMarkdown(`# ${heading}\n\n${body}`, {
    idPrefix: 'p5', shift: 1, used, site: SITE, resolveLink: p5Resolver(c),
    labels: { note: 'Note', tip: 'Tip', important: 'Important', warning: 'Warning', caution: 'Caution', copy: t.ui.copy }, anchorLabel: '#',
  });
  const description = locale === 'en'
    ? 'Add one line to any p5.js sketch and play it from a MIDI controller, an on-screen controller or a phone. Works with p5 1.x and 2.x, OpenProcessing included.'
    : '在任何 p5.js 草圖最上面加一行，就能用 MIDI 控制器、螢幕上的控制器或手機彈。支援 p5 1.x 與 2.x，包含 OpenProcessing。';
  const title = S.p5.title;
  const swNode = {
    '@type': 'SoftwareSourceCode', '@id': c.self + '#code', name: 'oav-p5', url: SITE + 'p5/oav-p5.js', codeRepository: REPO,
    programmingLanguage: 'JavaScript', runtimePlatform: 'Web browser, p5.js 1.x and 2.x', isPartOf: { '@id': SOFTWARE_ID }, author: { '@id': PERSON_ID },
  };
  const ld = [
    pageNode(c, t, { type: 'TechArticle', '@id': c.self + '#article', headline: heading, name: title, description, about: { '@id': SOFTWARE_ID }, mainEntity: { '@id': swNode['@id'] }, breadcrumb: { '@id': c.self + '#breadcrumb' }, mentions: [{ '@id': SITE + 'examples/15-p5-one-line/' }].slice(0, 0) }),
    swNode,
    breadcrumbNode(c, [[S.crumbs.home, homeUrl(c)], [S.crumbs.p5, c.self]]),
  ];
  const ex15 = c.root + 'examples/15-p5-one-line/';
  const runtime = { copy: t.ui.copy, copied: t.ui.copied, linkCopied: '', tocButton: '', tocClose: '' };
  return guardEmail(`<!DOCTYPE html>
<html lang="${t.htmlLang}">
<head>
${headBasics(t, c, { title, description, ogType: 'article', markdownHref: `${c.root}${P5_SOURCE[locale]}`, ld })}
<link rel="stylesheet" href="${c.root}assets/docs/docs.css">
<link rel="stylesheet" href="${c.root}assets/examples/pages.css">
<script>document.documentElement.classList.add('js')</script>
</head>
<body class="docs-page p5-page">
${topBar(t, c)}

<main id="main" class="docs-main p5-main">
  <header class="docs-head" id="top">
    <p class="eyebrow">${esc(S.p5.eyebrow)}</p>
    <h1>${esc(heading)}</h1>
    <p class="p5-cta"><a class="cta" href="${ex15}">${esc(S.p5.try)} →</a> <a class="more" href="${c.to('docs', '#p5')}">${esc(S.p5.docsLink)}</a> <a class="more" href="${TREE}p5">${esc(S.p5.github)} ↗</a></p>
    <p class="docs-note">${esc(S.p5.tryNote)}</p>
  </header>

  <section class="chapter p5-chapter" data-chapter="p5" aria-labelledby="p5">
${r.html.replace(/^<h2[^>]*>[\s\S]*?<\/h2>\n?/, '')}
  </section>

  <p class="docs-end"><a href="#top">↑</a></p>
</main>

${siteFooter(t, c)}

<p class="docs-toast" role="status" aria-live="polite"></p>
<script type="application/json" id="oav-docs-i18n">${JSON.stringify(runtime).replace(/</g, '\\u003c')}</script>
<script type="module" src="${c.root}assets/docs/docs.js"></script>
</body>
</html>
`);
}
