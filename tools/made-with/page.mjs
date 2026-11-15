// The /made-with/ template: one structure, rendered per language by tools/build-made-with.mjs (strings: en.mjs / zh.mjs,
// works: made-with/works.json). Static HTML, no script: the list is the data file, the rest is how to get on it.

import { pageCtx, headBasics, pageNode, breadcrumbNode, homeUrl, topBar, siteFooter, guardEmail, SOFTWARE_ID, REPO, BLOB, SITE, esc, attr } from '../site/chrome.mjs';

export const KINDS = ['performance', 'installation', 'sketch', 'tool', 'teaching', 'other'];
export const FORMAT = 'open-audiovisual/made-with@1';
export const ISSUE_FORM = REPO + '/issues/new?template=made-with.yml';
export const DATA_FILE = 'made-with/works.json';
export const BADGE = 'assets/made-with/badge.svg';

/** What is wrong with the data file, as sentences (an empty list = fine). Pure: tests and the build both call it. */
export function checkWorks(data) {
  const bad = [];
  if (!data || data.format !== FORMAT) bad.push(`format must be "${FORMAT}"`);
  const works = Array.isArray(data?.works) ? data.works : (bad.push('works must be an array'), []);
  const seen = new Set();
  works.forEach((w, i) => {
    const at = `works[${i}]${w?.id ? ` (${w.id})` : ''}`;
    if (!w || typeof w !== 'object') { bad.push(`${at}: not an object`); return; }
    if (!/^[a-z0-9][a-z0-9-]*$/.test(w.id || '')) bad.push(`${at}: id must be lower-case letters, digits and dashes`);
    if (seen.has(w.id)) bad.push(`${at}: id used twice`);
    seen.add(w.id);
    for (const k of ['title', 'by', 'en', 'zh']) if (typeof w[k] !== 'string' || !w[k].trim()) bad.push(`${at}: ${k} is missing`);
    for (const k of ['url', 'byUrl']) if (w[k] !== undefined && !/^https:\/\/[^\s"<>]+$/.test(w[k])) bad.push(`${at}: ${k} must be an https:// address`);
    if (typeof w.url !== 'string') bad.push(`${at}: url is missing`);
    if (!KINDS.includes(w.kind)) bad.push(`${at}: kind must be one of ${KINDS.join(', ')}`);
    if (w.year !== undefined && !(Number.isInteger(w.year) && w.year >= 2020 && w.year <= 2100)) bad.push(`${at}: year must be a year`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(w.added || '')) bad.push(`${at}: added must be a date, YYYY-MM-DD`);
    if (w.uses !== undefined && !(Array.isArray(w.uses) && w.uses.every((u) => /^[a-z0-9-]+$/.test(u)))) bad.push(`${at}: uses must be a list of package names`);
    if (/[；]|——/.test(w.zh || '')) bad.push(`${at}: zh must not use ； or ——`);
  });
  return bad;
}

const fill = (s, vars) => s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));

export function renderPage(t, home, locale, data, { version }) {
  const c = pageCtx('made', locale);
  const works = data.works;
  const vars = { issue: ISSUE_FORM, file: BLOB + DATA_FILE, docs: c.to('docs', '#controllers-telemetry'), version };
  const badgeUrl = SITE + BADGE;
  const snippet = `<a href="${SITE}"><img src="${badgeUrl}" width="188" height="28" alt="${t.badge.alt}"></a>`;
  const ld = [
    pageNode(c, home, {
      name: t.meta.title, description: t.meta.description, breadcrumb: { '@id': c.self + '#breadcrumb' },
      about: { '@id': SOFTWARE_ID },
      mainEntity: {
        '@type': 'ItemList', numberOfItems: works.length,
        itemListElement: works.map((w, i) => ({
          '@type': 'ListItem', position: i + 1,
          item: { '@type': 'CreativeWork', name: w.title, url: w.url, creator: { '@type': 'Person', name: w.by, ...(w.byUrl ? { url: w.byUrl } : {}) }, ...(w.year ? { dateCreated: String(w.year) } : {}), description: w[locale] },
        })),
      },
    }),
    breadcrumbNode(c, [['open-audiovisual', homeUrl(c)], [t.meta.crumb, c.self]]),
  ];

  const card = (w) => `
      <li class="mw" id="${attr(w.id)}">
        <p class="mw-kind">${esc(t.kinds[w.kind])}${w.year ? ' · ' + w.year : ''}</p>
        <h2><a href="${attr(w.url)}" rel="noopener">${esc(w.title)}</a></h2>
        <p class="mw-by">${esc(t.by)} ${w.byUrl ? `<a href="${attr(w.byUrl)}" rel="noopener">${esc(w.by)}</a>` : esc(w.by)}</p>
        <p class="mw-text">${esc(w[locale])}</p>${w.uses?.length ? `
        <ul class="mw-uses" aria-label="${attr(t.usesLabel)}">${w.uses.map((u) => `<li>@openav/${esc(u)}</li>`).join('')}</ul>` : ''}
      </li>`;

  const count = fill(works.length === 1 ? t.hero.count.one : t.hero.count.many, { n: works.length });

  return guardEmail(`<!DOCTYPE html>
<html lang="${home.htmlLang}">
<head>
${headBasics(home, c, { title: t.meta.title, description: t.meta.description, ogDescription: t.meta.ogDescription, ld })}
<link rel="stylesheet" href="${c.root}assets/made-with/made.css">
</head>
<body class="page-made">
${topBar(home, c)}

<main id="main">
  <section class="mw-hero" aria-labelledby="mw-title">
    <p class="eyebrow">${t.hero.eyebrow}</p>
    <h1 id="mw-title">${t.hero.title}</h1>
    <p class="lede">${t.hero.lede}</p>
    <p class="mw-count">${count}</p>
  </section>

  <section class="mw-body" aria-label="${attr(t.hero.eyebrow)}">
    <ul class="mw-list">${works.map(card).join('')}
    </ul>

    <div class="mw-sec" id="add">
      <h2>${t.add.title}</h2>
      <p>${t.add.lede}</p>
      <ol>${t.add.steps.map((s) => `\n        <li>${fill(s, vars)}</li>`).join('')}
      </ol>
      <p>${t.add.note}</p>
    </div>

    <div class="mw-sec" id="badge">
      <h2>${t.badge.title}</h2>
      <p>${t.badge.lede}</p>
      <img class="mw-badge" src="${c.root}${BADGE}" width="188" height="28" alt="${attr(t.badge.alt)}">
      <code class="mw-code">${esc(snippet)}</code>
    </div>

    <div class="mw-sec" id="signature">
      <h2>${t.tell.title}</h2>${t.tell.body.map((p) => `\n      <p>${fill(p, vars)}</p>`).join('')}
    </div>

    <p class="chk-links" style="margin-top:28px"><a href="${c.to('examples')}">${t.links.examples}</a> · <a href="${c.to('controllers')}">${t.links.controllers}</a> · <a href="${c.to('docs')}">${t.links.docs}</a></p>
  </section>
</main>

${siteFooter(home, c)}
</body>
</html>
`);
}
