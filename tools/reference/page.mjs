// The reference page template — one structure, rendered once per language by tools/build-reference.mjs.
// The records arrive merged (tools/reference/model.mjs): what the code says plus what a person wrote.
//
// Static HTML on purpose: crawlers and AI agents read every entry without JavaScript. assets/reference/reference.js adds
// the search box, the live examples (a sandboxed iframe, on demand) and the copy buttons; assets/docs/docs.js (the
// handbook's) adds the categories drawer, scroll-spy and copy-link on anchors, because this page is built on the same frame.

import { SITE, BLOB, SOFTWARE_ID, esc, attr, headBasics, pageNode, breadcrumbNode, homeUrl, topBar, siteFooter, guardEmail } from '../site/chrome.mjs';
import { inline, highlight } from '../docs/markdown.mjs';
import { CATEGORIES } from './categories.mjs';
import { LOADER, P5, parseParams, signatureOf } from './model.mjs';

const fill = (s, vars) => String(s).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
export const P5_VERSIONS = ['1.11.11', '2.3.4'];

const link = { resolveLink: (h) => h };
/** Paragraphs separated by a blank line, and ```lang fences as code blocks: all the markup an entry's text may use (plus `code`, **bold**, [links](#id)). */
function para(text) {
  const parts = String(text).split(/```(\w*)\n([\s\S]*?)```/);
  let out = '';
  for (let i = 0; i < parts.length; i += 3) {
    for (const p of parts[i].split(/\n{2,}/)) if (p.trim()) out += `<p>${inline(p.trim(), link)}</p>`;
    if (i + 1 < parts.length) {
      const lang = parts[i + 1] || 'js';
      out += `<div class="term" data-lang="${attr(lang)}"><div class="term-bar"><span>${esc(lang)}</span></div><pre><code class="language-${attr(lang)}">${highlight(parts[i + 2].replace(/\n+$/, ''), lang)}</code></pre></div>`;
    }
  }
  return out;
}

function valueHtml(r, e, L, t) {
  const v = e.value;
  if (!v) return '';
  const rows = [];
  rows.push(`<div><dt>${esc(t.sec.type)}</dt><dd><code>${esc(v.type)}</code></dd></div>`);
  if (v.range) rows.push(`<div><dt>${L === 'zh' ? '範圍' : 'Range'}</dt><dd><code>${esc(v.range)}</code></dd></div>`);
  if (v.options) rows.push(`<div><dt>${L === 'zh' ? '可用的值' : 'Values'}</dt><dd><code>${esc(v.options)}</code></dd></div>`);
  if (v.default !== undefined) rows.push(`<div><dt>${esc(t.default)}</dt><dd><code>${esc(v.default)}</code></dd></div>`);
  return `<dl class="ref-value">${rows.join('')}</dl>${v[L] ? para(v[L]) : ''}`;
}

function paramsHtml(r, e, L, t) {
  const list = e.params || [];
  if (!list.length) return '';
  const declared = r.item.params !== undefined ? parseParams(r.item.params) : [];
  const rows = list.map((p, i) => {
    const d = declared[i] && declared[i].name === p.name ? declared[i] : null;
    const optional = p.optional !== undefined ? p.optional : d ? d.optional : false;
    const def = p.default !== undefined ? p.default : d ? d.default : undefined;
    const bits = [];
    if (optional) bits.push(`<span class="ref-tag">${esc(t.optional)}</span>`);
    if (def !== undefined && def !== null) bits.push(`<span class="ref-tag">${esc(t.default)} <code>${esc(def)}</code></span>`);
    if (p.viaArguments) bits.push(`<span class="ref-tag">${esc(t.viaArguments)}</span>`);
    return `<tr><td><code>${esc(p.name)}</code></td><td>${p.type ? `<code>${esc(p.type)}</code>` : ''}</td><td>${inline(p[L], { resolveLink: (h) => h })} ${bits.join(' ')}</td></tr>`;
  });
  return `<div class="ref-sec"><h4>${esc(t.sec.params)}</h4><div class="table-wrap"><table><thead><tr><th>${esc(t.cols.name)}</th><th>${esc(t.cols.type)}</th><th>${esc(t.cols.description)}</th></tr></thead><tbody>${rows.join('')}</tbody></table></div></div>`;
}

function membersHtml(r, e, L, t) {
  const ms = r.item.members || [];
  if (!ms.length) return '';
  const authored = e && e.members ? e.members : {};
  const rows = ms.map((m) => {
    const sig = m.sig !== undefined && m.member.includes('method') ? `(${m.sig})` : '';
    const d = authored[m.name] ? authored[m.name][L] : (L === 'en' ? m.doc : '');
    return `<tr><td><a href="${attr(`${BLOB}${r.source.file}#L${m.line}`)}"><code>${esc(m.name)}${esc(sig)}</code></a></td><td><span class="ref-tag">${esc(m.member)}</span></td><td>${d ? inline(d, { resolveLink: (h) => h }) : ''}</td></tr>`;
  });
  return `<div class="ref-sec"><h4>${esc(t.sec.members)}</h4><div class="table-wrap"><table><thead><tr><th>${esc(t.cols.name)}</th><th></th><th>${esc(t.cols.description)}</th></tr></thead><tbody>${rows.join('')}</tbody></table></div></div>`;
}

function examplesHtml(r, e, L, t) {
  const list = e.examples || [];
  if (!list.length) return '';
  const items = list.map((ex, i) => {
    const run = ex.run || (r.ns === P5 ? 'sketch' : 'module');
    const lang = ex.lang || 'js';
    const tools = [];
    if (run === 'sketch') tools.push(`<button type="button" class="ref-run" hidden>${esc(t.ex.run)}</button>`);
    tools.push(`<button type="button" class="ref-copy" hidden title="${attr(run === 'sketch' ? t.ex.copyTitle : t.ex.copy)}">${esc(t.ex.copy)}</button>`);
    if (run === 'sketch') tools.push(`<a class="ref-op" href="https://openprocessing.org/" target="_blank" rel="noopener">${esc(t.ex.open)}</a>`);
    const mic = ex.needs === 'mic' ? ` <span class="ref-tag">${esc(t.ex.needsMic)}</span>` : '';
    const note = run === 'static' || run === 'module' ? `<span class="ref-tag" title="${attr(t.ex.notRun)}">${esc(run === 'module' ? 'module' : 'static')}</span> ` : '';
    return `<figure class="ref-ex" data-run="${run}">
<div class="term" data-lang="${lang}"><div class="term-bar"><span>${esc(lang)}</span><span class="ref-ex-tools">${tools.join('')}</span></div><pre><code class="language-${lang}">${highlight(ex.code.replace(/\n+$/, ''), lang)}</code></pre></div>
<figcaption>${note}${inline(ex.caption[L], { resolveLink: (h) => h })}${mic}</figcaption>
<div class="ref-live" hidden></div>
</figure>`;
  });
  return `<div class="ref-sec"><h4>${esc(t.sec.examples)}</h4>${items.join('\n')}</div>`;
}

/** One entry card. */
export function entryHtml(r, L, t, byKey) {
  const e = r.entry;
  const kindLabel = t.kinds[r.kind] || r.kind;
  const showName = r.kind === 'function' || r.kind === 'event' ? `${r.name}()` : r.name.replace(/^option:/, '');
  const sig = signatureOf(r);
  const aliases = r.covers.filter((c) => c !== r.key);
  const searchNames = [r.key, ...aliases, ...(r.key.startsWith('OAVp5') ? [r.key.replace(/^OAVp5/, 'midi'), ...aliases.map((a) => a.replace(/^OAVp5/, 'midi'))] : [])];
  const kw = e && e.keywords ? [...(e.keywords.en || []), ...(e.keywords.zh || [])] : [];
  const attrs = `data-name="${attr(r.key.replace(/^option:/, ''))}" data-names="${attr(searchNames.join(' '))}" data-kw="${attr(kw.join(' '))}" data-kind="${r.kind}" data-pkg="${attr(r.pkg)}" data-cat="${r.category}"`;
  const head = `<header class="ref-head"><h3 id="${attr(r.id)}"><code>${esc(showName)}</code><a class="anchor" href="#${attr(r.id)}" aria-label="${attr(t.anchorLabel)}">#</a></h3>
<span class="ref-badges"><span class="badge badge-kind" data-kind="${r.kind}" title="${attr(t.kindHelp[r.kind] || '')}">${esc(kindLabel)}</span><span class="badge badge-pkg">${esc(r.pkg)}</span></span></header>`;
  const aliasAnchors = r.aliasIds.map((id) => `<span id="${attr(id)}" class="ref-alias-anchor"></span>`).join('');
  const sigHtml = `<pre class="ref-sig"><code>${highlight(sig, 'js')}</code></pre>`;
  const alsoHtml = aliases.length ? `<p class="ref-also">${esc(t.sec.also)}: ${aliases.map((a) => `<code>${esc(a.replace(/^option:/, ''))}</code>`).join(' ')}</p>` : '';
  const sourceHtml = `<p class="ref-source">${r.import ? `<code class="ref-import">${esc(r.import)}</code> ` : ''}${r.item.alsoFrom && r.item.alsoFrom.length ? `<span class="ref-tag">${esc(t.sec.alsoFrom)} ${esc(r.item.alsoFrom.join(', '))}</span> ` : ''}<a href="${attr(r.source.url)}">${esc(fill(t.sourceLine, { file: r.source.file, line: r.source.line }))}</a></p>`;
  if (!e) {
    return `<article class="ref ref-stub" ${attrs}>${aliasAnchors}${head}${sigHtml}${alsoHtml}<p class="ref-nodoc">${esc(t.noDoc)}</p>${r.item.doc && L === 'en' ? `<p class="ref-srcdoc">${esc(r.item.doc)}</p>` : ''}${membersHtml(r, null, L, t)}${sourceHtml}</article>`;
  }
  const related = (e.related || []).map((k) => byKey.get(k)).filter(Boolean);
  const relHtml = related.length ? `<div class="ref-sec ref-rel"><h4>${esc(t.sec.related)}</h4><ul>${related.map((x) => `<li><a href="#${attr(x.id)}"><code>${esc(x.name.replace(/^option:/, ''))}${x.kind === 'function' || x.kind === 'event' ? '()' : ''}</code></a> <span>${x.entry ? esc(x.entry.summary[L]) : ''}</span></li>`).join('')}</ul></div>` : '';
  const needs = e.needs ? `<div class="callout callout-tip"><p class="callout-title">${esc(r.kind === 'function' || r.kind === 'class' ? t.sec.needsFn : t.sec.needs)}</p>${para(e.needs[L])}</div>` : '';
  const notes = (e.notes || []).length ? `<div class="ref-sec"><h4>${esc(t.sec.notes)}</h4><ul>${e.notes.map((n) => `<li>${inline(n[L], { resolveLink: (h) => h })}</li>`).join('')}</ul></div>` : '';
  const returns = e.returns ? `<div class="ref-sec"><h4>${esc(t.sec.returns)}</h4><p>${e.returns.type ? `<code>${esc(e.returns.type)}</code> ` : ''}${inline(e.returns[L], { resolveLink: (h) => h })}</p></div>` : '';
  const tbd = (e.tbd || []).length ? `<div class="callout callout-warning"><p class="callout-title">${esc(t.sec.tbd)}</p>${e.tbd.map((x) => para(x[L])).join('')}</div>` : '';
  return `<article class="ref" ${attrs}>${aliasAnchors}${head}${sigHtml}${alsoHtml}
<p class="ref-summary">${inline(e.summary[L], { resolveLink: (h) => h })}</p>
<div class="ref-body">${(e.description || []).map((d) => para(d[L])).join('')}</div>
${valueHtml(r, e, L, t)}${needs}${paramsHtml(r, e, L, t)}${returns}${membersHtml(r, e, L, t)}${notes}${examplesHtml(r, e, L, t)}${tbd}${relHtml}${sourceHtml}</article>`;
}

/**
 * @param {object} t      strings (tools/reference/en.mjs | zh.mjs)
 * @param {object} home   homepage strings (top bar, footer, html lang)
 * @param {object} o
 * @param {object} o.c    pathCtx for the page
 * @param {object[]} o.records
 * @param {string} o.version, o.p5Version
 * @param {{css:string, js:string, docsCss:string, docsJs:string}} o.assets  cache stamps
 */
export function renderReferencePage(t, home, { c, records, version, p5Version, assets, guideHref }) {
  const L = c.locale;
  const byKey = new Map();
  for (const r of records) for (const k of r.covers) byKey.set(k, r);
  const cats = CATEGORIES.filter((cat) => records.some((r) => r.category === cat.id));
  const written = records.filter((r) => r.entry).length, waiting = records.length - written;
  const ld = [
    pageNode(c, home, {
      type: 'TechArticle', '@id': c.self + '#article', headline: t.title, name: t.meta.title, description: t.meta.description,
      version, license: 'https://opensource.org/licenses/MIT', about: { '@id': SOFTWARE_ID }, articleSection: cats.map((x) => x[L]),
      breadcrumb: { '@id': c.self + '#breadcrumb' },
    }),
    breadcrumbNode(c, [['open-audiovisual', homeUrl(c)], [home.ui.nav.docs, SITE + (L === 'zh' ? 'zh/' : '') + 'docs/'], [t.eyebrow, c.self]]),
  ];
  const runtime = {
    copy: t.copy, copied: t.copied, linkCopied: t.linkCopied, tocButton: t.tocButton, tocClose: t.tocClose,
  };
  const refRuntime = {
    loader: LOADER, ex: t.ex, searchNone: t.searchNone, searchCount: t.searchCount, p5: { default: P5_VERSIONS[0], list: P5_VERSIONS },
    oav: c.root + 'p5/oav-p5.js', lang: L,
  };
  const json = (o) => JSON.stringify(o).replace(/</g, '\\u003c');

  const toc = `<nav class="toc" aria-label="${attr(t.tocLabel)}">
      <p class="toc-title">${esc(t.tocTitle)}</p>
      <ol class="toc-chapters">
        ${cats.map((cat) => `<li class="toc-ch" data-ch="cat-${cat.id}"><a href="#cat-${cat.id}"><span class="n">${records.filter((r) => r.category === cat.id).length}</span><span class="t">${esc(cat[L])}</span></a></li>`).join('\n        ')}
      </ol>
    </nav>`;

  const sections = cats.map((cat) => {
    const rs = records.filter((r) => r.category === cat.id);
    let lastPkg = null;
    const body = rs.map((r) => {
      const head = r.pkg !== lastPkg ? `<p class="ref-pkg-head">${esc(r.pkg)}</p>` : '';
      lastPkg = r.pkg;
      return head + entryHtml(r, L, t, byKey);
    }).join('\n');
    return `<section class="chapter ref-cat" data-chapter="cat-${cat.id}" aria-labelledby="cat-${cat.id}">
<h2 id="cat-${cat.id}">${esc(cat[L])}<a class="anchor" href="#cat-${cat.id}" aria-label="${attr(t.anchorLabel)}">#</a></h2>
<p class="ref-cat-hint">${esc(cat.hint[L])} <span class="ref-cat-n">${rs.length}</span></p>
${body}
</section>`;
  }).join('\n\n');

  const stats = fill(t.stats, { names: records.length, written }) + (waiting ? fill(t.statsWaiting, { waiting }) : '');

  return guardEmail(`<!DOCTYPE html>
<html lang="${home.htmlLang}">
<head>
${headBasics(home, c, { title: t.meta.title, description: t.meta.description, ogDescription: t.meta.ogDescription, ogType: 'article', ld })}
<link rel="stylesheet" href="${c.root}assets/docs/docs.css?v=${assets.docsCss}">
<link rel="stylesheet" href="${c.root}assets/reference/reference.css?v=${assets.css}">
<script>document.documentElement.classList.add('js', 'refpage')</script>
</head>
<body class="docs-page ref-page">
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
      <p class="docs-stats">${esc(stats)} · ${esc(fill(t.versions, { p5: p5Version, version }))}</p>
      <p class="docs-note">${fill(t.dataset, { json: c.root + 'docs/reference/reference.json' })} · ${fill(t.guide, { href: guideHref })}</p>
    </header>

    <div class="ref-search" role="search">
      <label class="ref-search-label" for="ref-q">${esc(t.searchLabel)}</label>
      <div class="ref-search-box">
        <input id="ref-q" type="search" autocomplete="off" spellcheck="false" placeholder="${attr(t.searchPlaceholder)}" aria-controls="ref-list">
        <kbd class="ref-search-key" aria-hidden="true">/</kbd>
        <button type="button" class="ref-search-clear" hidden>${esc(t.searchClear)}</button>
      </div>
      <p class="ref-search-status" role="status" aria-live="polite"></p>
    </div>

    <aside class="ref-loader">
      <p class="ref-loader-title">${esc(t.loaderTitle)}</p>
      <div class="term" data-lang="js"><div class="term-bar"><span>js</span><button type="button" class="ref-loader-copy" hidden>${esc(t.loaderCopy)}</button></div><pre><code class="language-js">${highlight(LOADER, 'js')}</code></pre></div>
      <p class="ref-loader-body">${esc(t.loaderBody)}</p>
      <label class="ref-p5v" hidden>${esc(t.p5Version)} <select></select></label>
    </aside>

    <div id="ref-list" class="ref-list">
${sections}
    </div>
    <p class="ref-none" hidden></p>

    <p class="docs-end"><a href="#top">↑ ${esc(t.backToTop)}</a></p>
  </main>
</div>

${siteFooter(home, c)}

<p class="docs-toast" role="status" aria-live="polite"></p>
<script type="application/json" id="oav-docs-i18n">${json(runtime)}</script>
<script type="application/json" id="oav-ref">${json(refRuntime)}</script>
<script type="module" src="${c.root}assets/docs/docs.js?v=${assets.docsJs}"></script>
<script type="module" src="${c.root}assets/reference/reference.js?v=${assets.js}"></script>
</body>
</html>
`);
}
