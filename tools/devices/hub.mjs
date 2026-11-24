// /devices/ and /zh/devices/: every device of the collection in one list, grouped by kind (tools/build-devices.mjs).
// The whole list is in the HTML, every row a link to its page (a controller to its existing /controllers/<id>/, a fixture to
// /fixtures/<id>/, the rest to /devices/<id>/) or, for a device with no page of its own, to its record file, so a crawler sees
// every link without JavaScript. assets/devices/hub.js filters the rows already on the page (kind, manufacturer, a search over
// the name and the aliases): no request, no index to fetch.

import { pathCtx, headBasics, pageNode, breadcrumbNode, homeUrl, topBar, siteFooter, guardEmail, PERSON_ID, SOFTWARE_ID } from '../site/chrome.mjs';
import { nextLink } from '../site/next-step.mjs';
import { byId as exampleById, L as pick } from '../examples/catalog.mjs';
import { KINDS } from '../../packages/devices/record.js';
import { fill, esc, attr, sec, listText, plural, kindWord, protocolName, OG_IMAGE, SITE } from './common.mjs';
import { HUB_PATH } from './sources.mjs';
import { DMX_EXAMPLE } from './fixture.mjs';

/** The words a row is searched by: its name, aliases, id and manufacturer, folded the way devices() folds them. */
export const searchText = (r) => [r.name, ...r.aliases, r.id, r.manufacturer || ''].join(' ').toLowerCase();
/** A manufacturer as a filter value. */
export const makerKey = (m) => String(m || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** The small line under a row's name: who makes it, and the one number that says what it is. */
function rowMeta(t, d, ctl) {
  const R = t.hub.row, r = d.row, bits = [];
  if (r.manufacturer) bits.push(esc(r.manufacturer));
  if (r.kind === 'midi-controller') {
    const x = ctl.get(r.id);
    if (x) bits.push(fill(R.controls, { n: x.total }));
    bits.push(x && x.prov.imported ? t.origin.qlc : x && x.prov.generic ? t.origin.generic : t.origin.hand);
  } else if (r.kind === 'dmx-fixture') {
    const n = d.data.modes.length;
    bits.push(`${n === 1 ? R.mode : fill(R.modes, { n })} (${[...new Set(d.data.modes.map((m) => m.channels.length))].join('/')} ch)`);
    bits.push(d.data.origin ? t.origin.ofl : t.origin.generic);
  } else if (r.kind === 'part') {
    bits.push(esc(t.partKinds[d.data.kind] || d.data.kind));
    bits.push(t.origin.library);
  } else {
    const conn = r.connections.map((x) => t.connections[x] || x), proto = r.protocols.map(protocolName);
    if (conn.length || proto.length) bits.push(esc([...conn, ...proto].join(' · ')));
    bits.push(t.origin.record);
  }
  return bits.join(' · ');
}

/**
 * @param list   collection() entries, in collection order
 * @param ctl    tools/controllers/page.mjs catalog().byId (control counts, provenance)
 */
export function renderHub(t, home, locale, list, ctl) {
  const H = t.hub, c = pathCtx(HUB_PATH, locale, { page: 'devices' });
  const n = (k) => list.filter((d) => d.row.kind === k).length;
  const withPage = list.filter((d) => d.page);
  const description = fill(H.meta.description, { total: list.length, midi: n('midi-controller'), dmx: n('dmx-fixture') });
  const kinds = KINDS.filter((k) => n(k));
  const makers = [...new Map(list.filter((d) => d.row.manufacturer).map((d) => [makerKey(d.row.manufacturer), d.row.manufacturer])).entries()].sort((a, b) => a[1].localeCompare(b[1], 'en', { sensitivity: 'base' }));
  const href = (d) => `${c.root}${locale === 'zh' ? 'zh/' : ''}${d.page}`;
  const ex = exampleById.get(DMX_EXAMPLE);

  const row = (d) => {
    const r = d.row;
    const name = d.page ? `<a class="dev-name" href="${href(d)}">${esc(r.name)}</a>` : `<span class="dev-name">${esc(r.name)}</span>`;
    const tail = d.page ? '' : `<span class="dev-nopage">${H.row.noPage} <a href="${c.root}packages/${d.file}">${H.row.record}</a></span>`;
    const al = r.aliases.filter((a) => a !== r.name).slice(0, 4);
    return `<li class="dev" data-id="${r.id}" data-kind="${r.kind}" data-maker="${attr(makerKey(r.manufacturer))}" data-q="${attr(searchText(r))}">${name}<span class="dev-meta">${rowMeta(t, d, ctl)}</span>${al.length ? `<span class="dev-al">${esc(al.join(' · '))}</span>` : ''}${tail}</li>`;
  };

  const groups = kinds.map((k) => {
    const rows = list.filter((d) => d.row.kind === k);
    const note = H.groupNote[k];
    return `<section class="dev-group" id="kind-${k}" data-group="${k}" aria-labelledby="kind-${k}-title">
      <h2 class="cat-h" id="kind-${k}-title">${esc(kindWord(t, k, 2))} <span>${rows.length}</span></h2>${note ? `\n      <p class="cat-note">${note}</p>` : ''}
      <ul class="dev-list">
        ${rows.map(row).join('\n        ')}
      </ul>
    </section>`;
  }).join('\n    ');

  const ld = [
    pageNode(c, home, { type: 'CollectionPage', name: H.meta.title, description, about: { '@id': SOFTWARE_ID }, breadcrumb: { '@id': c.self + '#breadcrumb' }, mainEntity: { '@id': c.self + '#list' } }),
    breadcrumbNode(c, [[t.crumbs.home, homeUrl(c)], [t.crumbs.devices, c.self]]),
    {
      '@type': 'Dataset', '@id': c.self + '#dataset', name: H.meta.ldName, description, url: c.self, inLanguage: home.ldLanguage,
      license: 'https://opensource.org/licenses/MIT', isAccessibleForFree: true, creator: { '@id': PERSON_ID }, isPartOf: { '@id': SOFTWARE_ID },
      keywords: ['MIDI controller', 'DMX fixture', 'DMX channel chart', 'camera', 'audio interface', 'LED controller', 'show control'],
      distribution: [{ '@type': 'DataDownload', name: 'catalog.js', encodingFormat: 'text/javascript', contentUrl: SITE + 'packages/devices/catalog.js' }],
    },
    {
      '@type': 'ItemList', '@id': c.self + '#list', name: H.meta.ldList, numberOfItems: withPage.length,
      itemListElement: withPage.map((d, i) => ({ '@type': 'ListItem', position: i + 1, name: d.row.name, url: SITE + (locale === 'zh' ? 'zh/' : '') + d.page })),
    },
  ];

  const head = headBasics(home, c, { title: H.meta.title, description, ogImage: OG_IMAGE, ld, pageType: 'devices_index' });
  return guardEmail(`<!DOCTYPE html>
<html lang="${t.htmlLang}">
<head>
${head}
<link rel="stylesheet" href="${c.root}assets/controllers/controllers.css">
<link rel="stylesheet" href="${c.root}assets/devices/devices.css">
<noscript><style>.js-only { display: none !important; }</style></noscript>
</head>
<body class="page-controllers page-devices">
${topBar(home, c)}

<main id="main">
  <section class="ch-hero" id="top" aria-labelledby="top-title">
    <nav class="crumbs" aria-label="${attr(t.crumbs.label)}">
      <ol>
        <li><a href="${c.to('home')}">${t.crumbs.home}</a></li>
        <li aria-current="page">${t.crumbs.devices}</li>
      </ol>
    </nav>
    <p class="eyebrow">${H.eyebrow}</p>
    <h1 id="top-title">${H.title}</h1>
    <div class="hero-cols">
      <p class="lede">${H.lede}</p>
      <div class="hero-facts">
        <dl class="stats">
          <div><dt>${H.stats.total}</dt><dd>${list.length}</dd></div>
          <div><dt>${H.stats.pages}</dt><dd>${withPage.length}</dd></div>
          ${kinds.map((k) => `<div><dt>${esc(kindWord(t, k, n(k)))}</dt><dd><a href="#kind-${k}">${n(k)}</a></dd></div>`).join('\n          ')}
        </dl>
      </div>
    </div>
  </section>

  <section class="sec" id="list" aria-label="${attr(H.title)}">
    <div class="dev-filter js-only" role="search">
      <label class="dev-search"><span class="sr-only">${H.filter.search}</span><input type="search" id="dev-q" placeholder="${attr(H.filter.placeholder)}" aria-label="${attr(H.filter.search)}" autocomplete="off" spellcheck="false"></label>
      <div class="filters" role="group" aria-label="${attr(H.filter.label)}">
        <span class="filters-k">${H.filter.label}</span>
        <button type="button" data-kind="all" aria-pressed="true">${H.filter.all} <b>${list.length}</b></button>
        ${kinds.map((k) => `<button type="button" data-kind="${k}" aria-pressed="false">${esc(kindWord(t, k, 2))} <b>${n(k)}</b></button>`).join('\n        ')}
      </div>
      <label class="dev-maker"><span>${H.filter.maker}</span><select id="dev-maker"><option value="">${H.filter.makerAll}</option>${makers.map(([k, m]) => `<option value="${attr(k)}">${esc(m)}</option>`).join('')}</select></label>
      <p class="shown" id="dev-shown" aria-live="polite" data-tpl="${attr(H.filter.shown)}" data-total="${list.length}"></p>
      <p class="dev-none" id="dev-none" hidden>${H.filter.none}</p>
    </div>
    <noscript><p class="noscript">${H.noscript}</p></noscript>
    ${groups}
  </section>

  <section class="sec next-step" id="next-step" aria-labelledby="next-step-title">
    ${sec('next-step', home.next.label, H.nextTitle, H.nextLede)}
    <p class="next-links">${nextLink(c.to('docs', '#devices'), 'docs', `${H.nextDocs} →`)} ${nextLink(c.to('controllers'), 'controllers', `${H.nextControllers} →`)} ${nextLink(`${c.root}${ex.dir}`, 'example', `${esc(fill(H.nextExample, { num: ex.num, title: pick(ex.title, locale) }))} →`)}</p>
  </section>
</main>

${siteFooter(home, c)}

<script type="module" src="${c.root}assets/devices/hub.js"></script>
</body>
</html>
`);
}
