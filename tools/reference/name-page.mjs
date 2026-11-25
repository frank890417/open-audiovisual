// One oav-p5 name, one page: /docs/reference/<slug>/ and /zh/docs/reference/<slug>/ (tools/build-reference.mjs writes them;
// tools/reference/slug.mjs says where). The names of p5/oav-p5.js only, the ones with runnable sketches; the package exports stay
// on the one reference page, which is the index of every name.
//
// The page is the entry the index used to carry in full: summary, description, value / parameters / returns, what it needs first,
// notes, every example with the same run / copy / edit behaviour (assets/reference/reference.js), related names, the source line.
// Around it: the loader line (the examples leave it out), the other names of its category, and the examples whose sketch uses it
// (the next step, from tools/examples/uses.mjs, the same reading the index's block makes).

import { SITE, SOFTWARE_ID, esc, attr, headBasics, pageNode, breadcrumbNode, homeUrl, topBar, siteFooter, guardEmail } from '../site/chrome.mjs';
import { CATEGORIES } from './categories.mjs';
import { entryHtml, loaderAside, refRuntimeOf, showNameOf, hasPage } from './page.mjs';
import { nameSlug } from './slug.mjs';
import { describe, mdText } from '../site/describe.mjs';
import { examplesUsing } from '../examples/uses.mjs';
import { usesBlock } from '../site/next-step.mjs';

const fill = (s, vars) => String(s).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
const json = (o) => JSON.stringify(o).replace(/</g, '\\u003c');

/** The name as a title shows it: startMic(), micLevel, and an option with its kind (scope is also a function). */
export const titleNameOf = (r, t) => showNameOf(r) + (r.kind === 'option' ? (t.ldLanguage === 'en' ? ` (${t.kinds.option})` : `（${t.kinds.option}）`) : '');

/** The page's description: the entry's one-sentence summary; a short one (most Chinese ones) goes on into its description. */
export function nameDescription(r, L) {
  const e = r.entry, sum = mdText(e.summary[L]);
  if (sum.length >= 50) return sum;
  return describe([sum, ...(e.description || []).map((d) => mdText(d[L]))], L, { min: 50, max: L === 'zh' ? 110 : 170 });
}

/**
 * @param {object} t      reference strings (tools/reference/en.mjs | zh.mjs)
 * @param {object} home   homepage strings
 * @param {object} o      { c: pathCtx('docs/reference/<slug>/'), r: the record, records, byKey, version, p5Version, assets }
 */
export function renderNamePage(t, home, { c, r, records, byKey, version, assets }) {
  const L = c.locale;
  const shown = titleNameOf(r, t);
  const title = fill(t.name.title, { name: shown });
  const description = nameDescription(r, L);
  const cat = CATEGORIES.find((x) => x.id === r.category);
  const index = SITE + (L === 'zh' ? 'zh/' : '') + 'docs/reference/';
  // from one level down: a name with a page is ../<slug>/, anything else is its card on the index (../#id)
  const anchorOwner = new Map();
  for (const x of records) for (const id of [x.id, ...x.aliasIds]) anchorOwner.set(id, x);
  const hrefOf = (x, anchor = x.id) => (hasPage(x) ? `../${nameSlug(x.id)}/${anchor === x.id ? '' : '#' + anchor}` : `../#${anchor}`);
  const lk = {
    resolveLink: (h) => {
      if (!h || !h.startsWith('#')) return h;
      const x = anchorOwner.get(h.slice(1));
      return x ? (x === r ? h : hrefOf(x, h.slice(1))) : '../' + h;
    },
  };
  // the loader line sits right above the examples, which leave it out ("Every sketch starts with one line")
  const examplesHead = `<div class="ref-sec"><h4>${esc(t.sec.examples)}</h4>`;
  const entry = entryHtml(r, L, t, byKey, { mode: 'page', lk, relHref: (x) => hrefOf(x) }).replace(examplesHead, `${loaderAside(t)}\n${examplesHead}`);

  const ld = [
    pageNode(c, home, {
      type: 'TechArticle', '@id': c.self + '#article', headline: shown, name: title, description, version,
      license: 'https://opensource.org/licenses/MIT', about: { '@id': SOFTWARE_ID }, articleSection: cat ? cat[L] : undefined,
      breadcrumb: { '@id': c.self + '#breadcrumb' },
    }),
    breadcrumbNode(c, [['open-audiovisual', homeUrl(c)], [home.ui.nav.docs, SITE + (L === 'zh' ? 'zh/' : '') + 'docs/'], [t.eyebrow, index], [shown, c.self]]),
  ];

  // the side contents: the other oav-p5 names of this category (each a page), and the way back to every name
  const near = records.filter((x) => x.category === r.category && hasPage(x));
  const toc = `<nav class="toc" aria-label="${attr(t.tocLabel)}">
      <p class="toc-title">${esc(cat ? cat[L] : t.tocTitle)}</p>
      <p class="toc-ref"><a href="../">${esc(t.name.all)}</a></p>
      <ol class="toc-chapters toc-names">
        ${near.map((x) => x === r
          ? `<li class="toc-ch is-here"><a href="./" aria-current="page"><span class="t"><code>${esc(showNameOf(x))}</code></span></a></li>`
          : `<li class="toc-ch"><a href="../${nameSlug(x.id)}/"><span class="t"><code>${esc(showNameOf(x))}</code></span></a></li>`).join('\n        ')}
      </ol>
    </nav>`;

  const runtime = { copy: t.copy, copied: t.copied, linkCopied: t.linkCopied, tocButton: t.tocButton, tocClose: t.tocClose };
  const examples = examplesUsing({ names: r.covers });

  return guardEmail(`<!DOCTYPE html>
<html lang="${home.htmlLang}">
<head>
${headBasics(home, c, { title, description, ogType: 'article', ld, pageType: 'reference_name', pageId: nameSlug(r.id) })}
<link rel="stylesheet" href="${c.root}assets/docs/docs.css?v=${assets.docsCss}">
<link rel="stylesheet" href="${c.root}assets/reference/reference.css?v=${assets.css}">
<script>document.documentElement.classList.add('js')</script>
</head>
<body class="docs-page ref-page ref-name-page">
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
    <p class="eyebrow ch-eyebrow" id="top"><a href="../">${esc(t.name.eyebrow)}</a>${cat ? ` · <a href="../#cat-${cat.id}">${esc(cat[L])}</a>` : ''}</p>
    <div class="chapter ref-one" data-chapter="${attr(r.id)}">
${entry}
    </div>

    ${usesBlock({ c, locale: L, home, title: fill(t.name.uses, { name: showNameOf(r) }), groups: [{ label: showNameOf(r), examples }] })}

    <p class="docs-end"><a href="#top">↑ ${esc(t.backToTop)}</a> · <a href="../">${esc(t.name.all)}</a></p>
  </main>
</div>

${siteFooter(home, c)}

<p class="docs-toast" role="status" aria-live="polite"></p>
<script type="application/json" id="oav-docs-i18n">${json(runtime)}</script>
<script type="application/json" id="oav-ref">${json(refRuntimeOf(t, c))}</script>
<script type="module" src="${c.root}assets/docs/docs.js?v=${assets.docsJs}"></script>
<script type="module" src="${c.root}assets/reference/reference.js?v=${assets.js}"></script>
</body>
</html>
`);
}
