// One page per DMX fixture: /fixtures/<id>/ and /zh/fixtures/<id>/ (tools/build-devices.mjs). Every fact is read from the
// fixture file at build time (packages/dmx/fixtures/*.json and imported/, which tools/import-ofl.mjs writes), and the core
// content (the name, every mode's channel table, the sources and the licence) is in the HTML, so a crawler or a language model
// reads it without running JavaScript. assets/devices/fixture.js only makes the virtual fixture move and wires Copy.
//
// The snippet on the page is run here, with the real packages, to print the bytes the page says it prints; the test runs the
// snippet taken from the committed HTML again and compares.

import { pathCtx, headBasics, pageNode, breadcrumbNode, homeUrl, topBar, siteFooter, guardEmail, PERSON_ID, SOFTWARE_ID } from '../site/chrome.mjs';
import { nextLink } from '../site/next-step.mjs';
import { byId as exampleById, L as pick } from '../examples/catalog.mjs';
import { Patch, DmxEngine } from '../../packages/dmx/index.js';
import { layoutOf } from '../../packages/dmx/patch.js';
import { fill, esc, attr, sec, term, listText, plural, sourceItem, reportBlock, OG_IMAGE, PKG, SCHEMA_FIXTURE, OFL_SITE, SITE, BLOB } from './common.mjs';
import { HUB_PATH } from './sources.mjs';

export const DMX_EXAMPLE = '28-dmx-lights';
const TITLE_MAX = 90;

// ------------------------------------------------------------------ words from data
const isImported = (fx) => !!(fx.origin && fx.origin.tool === 'Open Fixture Library');
const same = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '');   // "colorWheel" and "Color Wheel" are one name
const camelWords = (s) => String(s).replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
/** The OFL page of an imported fixture: open-fixture-library.org/<manufacturer>/<fixture>. */
export const oflPage = (fx) => { const m = /^fixtures\/([a-z0-9-]+)\/([a-z0-9-]+)\.json$/.exec((fx.origin && fx.origin.file) || ''); return m ? `${OFL_SITE}${m[1]}/${m[2]}` : null; };
const footprints = (fx) => fx.modes.map((m) => m.channels.length);
const footText = (fx) => [...new Set(footprints(fx))].join('/');

/** "{name} DMX channel chart & virtual fixture — open-audiovisual", shortened to fit, never saying DMX twice. */
export function titleOf(t, name) {
  const dmx = /\bDMX\b/i.test(name) ? '' : 'DMX ';
  const full = fill(t.fixture.title.full, { name, dmx });
  return esc(full).length <= TITLE_MAX ? full : fill(t.fixture.title.short, { name, dmx });   // as the <title> is written (& is &amp;)
}

/** The meta description: as many of the sentences as fit (en ~158 characters, zh ~80). */
export function descriptionOf(t, name, fx) {
  const D = t.fixture.desc, n = fx.modes.length;
  let out = fill(D.head, { name, modes: fill(plural(D.modesN, n), { n, list: footText(fx) }) });
  for (const tail of D.tails) { const next = out + (t.lang === 'zh' ? '' : ' ') + tail; if (next.length <= D.max) out = next; }
  return out;
}

/** What one channel's values do, as text: "0–9 open · 10–255 strobe (Strobe) 0–20 Hz", or "0–255" for a plain one. */
export function valuesText(t, c) {
  const F = t.fixture;
  if (!c.ranges || !c.ranges.length) return '0–255';
  return c.ranges.map((r) => {
    const is = F.is[r.is] || camelWords(r.is);
    const hz = r.hz ? ` ${fill(F.channels.hz, { a: r.hz[0], b: r.hz[1] })}` : '';
    const label = r.label && r.label.toLowerCase() !== String(is).toLowerCase() ? ` (${r.label})` : '';
    return `${r.from === r.to ? r.from : `${r.from}–${r.to}`} ${is}${label}${hz}`;
  }).join(' · ');
}

/** The type column: "colour: red", "fine byte of pan", "strobe / shutter". */
export function typeText(t, fx, key) {
  const F = t.fixture, c = fx.channels[key];
  if (c.fineOf) return fill(F.channels.fine, { key: c.fineOf });
  return c.type === 'color' ? `${F.types.color}: ${F.colors[c.color] || c.color}` : F.types[c.type] || c.type;
}

/** The mode the page's snippet patches: the one with the most channels (the full mode), the first of those. */
export function snippetMode(fx) {
  return fx.modes.reduce((best, m) => (m.channels.length > best.channels.length ? m : best), fx.modes[0]);
}

/** The properties the snippet asks for in that mode: a dimmer, a colour where it mixes one, pan and tilt where it moves. */
export function snippetProps(fx, mode) {
  const p = new Patch({ profiles: [fx] });
  const L = layoutOf(p.add({ id: 'x', profile: fx.id, mode: mode.id, address: 1 }).mode);
  const props = { dimmer: 1 };
  if (L.colors.some((s) => ['red', 'green', 'blue'].includes(s.color))) props.color = [1, 0.5, 0];
  else if (L.colors.length) props.color = [1, 1, 1];
  if (L.pan) props.pan = 0.5;
  if (L.tilt) props.tilt = 0.25;
  return props;
}
const propsCode = (props) => `{ ${Object.entries(props).map(([k, v]) => `${k}: ${Array.isArray(v) ? `[${v.join(', ')}]` : v}`).join(', ')} }`;

/** The bytes the snippet prints, computed with the same packages the snippet loads. */
export function snippetBytes(fx, mode, props) {
  const patch = new Patch({ profiles: [fx] });
  patch.add({ id: 'light1', profile: fx.id, mode: mode.id, address: 1 });
  const engine = new DmxEngine(patch);
  engine.set('light1', props);
  return [...engine.render(0).bytes(1).slice(0, mode.channels.length)];
}

/** The paste-ready code: device(id) → Patch → DmxEngine → the bytes, and what it prints. */
export function fixtureSnippet(fx, name) {
  const mode = snippetMode(fx), props = snippetProps(fx, mode), bytes = snippetBytes(fx, mode, props), n = mode.channels.length;
  const code = `import { device } from '${PKG}devices/index.js';
import { Patch, DmxEngine } from '${PKG}dmx/index.js';

const light = await device('${fx.id}');   // ${name}
const patch = new Patch();
light.patch(patch, { id: 'light1', address: 1, mode: '${mode.id}' });   // ${n} channel${n === 1 ? '' : 's'} from address 1
const engine = new DmxEngine(patch);
engine.set('light1', ${propsCode(props)});
console.log(engine.render(0).bytes(1).slice(0, ${n}).join(' '));
// → ${bytes.join(' ')}`;
  return { code, mode, props, bytes };
}

// ------------------------------------------------------------------ related fixtures
export function relatedFixtures(all, d, n = 6) {
  const fx = d.data, foot = new Set(footprints(fx));
  return all.filter((x) => x !== d).map((x) => {
    const f = x.data;
    const score = (f.manufacturer === fx.manufacturer ? 10 : 0) + (f.kind === fx.kind ? 5 : 0) + footprints(f).filter((k) => foot.has(k)).length + (isImported(f) === isImported(fx) ? 0.5 : 0);
    return { x, score };
  }).sort((a, b) => b.score - a.score || a.x.row.name.localeCompare(b.x.row.name)).slice(0, n).map((s) => s.x);
}

// ------------------------------------------------------------------ the page
/**
 * @param d       one entry of collection() for a dmx-fixture: { row, record, data (the fixture file), file, page }
 * @param ctx     { fixtures: every fixture entry (for related) }
 */
export function renderFixture(t, home, locale, d, ctx) {
  const F = t.fixture, fx = d.data, id = fx.id, name = d.row.name;
  const c = pathCtx(d.page, locale, { page: 'devices' });
  const imported = isImported(fx), generic = !imported && fx.manufacturer === 'Generic';
  const title = titleOf(t, name), description = descriptionOf(t, name, fx);
  const rel = `packages/${d.file}`, jsonUrl = SITE + rel, ofl = oflPage(fx);
  const hubUrl = SITE + (locale === 'zh' ? 'zh/' : '') + HUB_PATH;
  const kind = t.fixtureKinds[fx.kind] || fx.kind;
  const modesWords = fill(plural(F.modesText, fx.modes.length), { n: fx.modes.length }) + ` (${listText(t, fx.modes.map((m) => `${esc(m.id)}: ${m.channels.length}`))})`;
  const snip = fixtureSnippet(fx, name);
  const ex = exampleById.get(DMX_EXAMPLE);

  // facts
  const chs = Object.values(fx.channels);
  const pan = chs.find((x) => x.type === 'pan'), tilt = chs.find((x) => x.type === 'tilt');
  const hz = chs.flatMap((x) => (x.ranges || []).filter((r) => r.hz).map((r) => r.hz[1]));
  const strobes = chs.filter((x) => x.type === 'strobe');
  const facts = [
    [F.facts.kind, esc(kind)],
    ...(generic ? [] : [[F.facts.maker, esc(fx.manufacturer)]]),
    [F.facts.modes, modesWords],
    [F.facts.protocol, 'DMX512'],
    ...(pan || tilt ? [[F.facts.panTilt, pan && pan.degrees && tilt && tilt.degrees ? fill(F.facts.degrees, { pan: pan.degrees, tilt: tilt.degrees }) : F.facts.none]] : []),
    ...(strobes.length ? [[F.facts.strobe, hz.length ? fill(F.facts.hz, { hz: Math.max(...hz) }) : F.facts.noHz]] : []),
    [F.facts.license, esc(fx.license || 'MIT')],
    [F.facts.verified, fx.verified ? t.verified.yes : t.verified.no],
    [F.facts.origin, imported ? `<a href="${attr(ofl)}" data-oav-link="other">${fill(F.facts.ofl, { commit: esc(fx.origin.commit.slice(0, 8)) })}</a>` : F.facts.generic],
    [F.facts.file, `<a href="${c.root}${rel}" data-oav-event="export_download" data-oav-format="json" data-oav-id="${id}"><code>${esc(d.file.split('/').pop())}</code></a>`],
  ];

  // the channel tables
  const tables = fx.modes.map((m) => `<div class="mode-table" id="mode-${attr(m.id)}">
      <h3>${esc(fill(F.channels.mode, { name: m.name && m.name !== m.id ? `${m.id} · ${m.name}` : m.id }))} <span>${esc(fill(plural(F.channels.count, m.channels.length), { n: m.channels.length }))}</span></h3>
      <div class="table-scroll" role="region" aria-label="${attr(fill(F.channels.mode, { name: m.id }))}" tabindex="0">
      <table class="ch-table">
        <thead><tr><th scope="col">${F.channels.cols.ch}</th><th scope="col">${F.channels.cols.channel}</th><th scope="col">${F.channels.cols.type}</th><th scope="col">${F.channels.cols.default}</th><th scope="col">${F.channels.cols.values}</th></tr></thead>
        <tbody>
        ${m.channels.map((key, i) => {
          const ch = fx.channels[key];
          return `<tr data-key="${attr(key)}"><td class="n">${i + 1}</td><th scope="row"><code class="cid">${esc(key)}</code>${ch.name && same(ch.name) !== same(key) ? ` ${esc(ch.name)}` : ''}</th><td>${esc(typeText(t, fx, key))}</td><td class="n">${ch.default ?? 0}</td><td>${esc(ch.fineOf ? '0–255' : valuesText(t, ch))}</td></tr>`;
        }).join('\n        ')}
        </tbody>
      </table>
      </div>
    </div>`).join('\n    ');

  // JSON-LD: the page, the light (a Product when a real maker is behind it), the data set the page is made from
  const crumbsLd = breadcrumbNode(c, [[t.crumbs.home, homeUrl(c)], [t.crumbs.devices, hubUrl], [name, c.self]]);
  const thing = generic
    ? { '@type': 'Thing', '@id': c.self + '#product', name, description: kind }
    : { '@type': 'Product', '@id': c.self + '#product', name, model: fx.name, brand: { '@type': 'Brand', name: fx.manufacturer }, category: 'DMX lighting fixture', description };
  const ld = [
    crumbsLd,
    pageNode(c, home, { name: title, description, image: OG_IMAGE, breadcrumb: { '@id': c.self + '#breadcrumb' }, about: { '@id': c.self + '#product' }, mainEntity: { '@id': c.self + '#dataset' } }),
    thing,
    {
      '@type': 'Dataset', '@id': c.self + '#dataset', name: `${name}: DMX channels`, description, url: c.self, inLanguage: home.ldLanguage,
      license: 'https://opensource.org/licenses/MIT', isAccessibleForFree: true, creator: { '@id': PERSON_ID }, isPartOf: { '@id': hubUrl + '#dataset' }, about: { '@id': c.self + '#product' },
      keywords: ['DMX', 'DMX512', 'DMX channel chart', 'lighting fixture', name, ...(generic ? [] : [fx.manufacturer])],
      distribution: [{ '@type': 'DataDownload', name: d.file.split('/').pop(), encodingFormat: 'application/json', contentUrl: jsonUrl }],
      ...(imported ? { isBasedOn: { '@type': 'Dataset', name: `Open Fixture Library: ${fx.origin.file}`, url: ofl, license: 'https://opensource.org/licenses/MIT' } } : {}),
      citation: (fx.sources || []).map((s) => ({ '@type': 'CreativeWork', name: s.title, ...(s.url ? { url: s.url } : {}) })),
    },
    { '@type': 'Dataset', '@id': hubUrl + '#dataset', name: t.hub.meta.ldName, url: hubUrl, isPartOf: { '@id': SOFTWARE_ID } },
  ];

  const lede = imported
    ? fill(F.lede.imported, { name: esc(name), kind: esc(kind), maker: esc(fx.manufacturer), modes: modesWords, ofl: attr(ofl) })
    : fill(F.lede.generic, { name: esc(name), modes: modesWords });
  const relList = relatedFixtures(ctx.fixtures, d);
  const runtime = {
    profile: fx, copy: home.ui.copy, copied: home.ui.copied,
    t: { dimmer: F.try.dimmer, red: F.try.red, green: F.try.green, blue: F.try.blue, pan: F.try.pan, tilt: F.try.tilt, zoom: F.try.zoom, strobe: F.try.strobe, others: F.try.others, shut: F.try.shut, is: F.is, hzRange: F.channels.hz },
  };
  const authors = (fx.origin && fx.origin.author) || '';
  const src = fx.sources || [];

  const head = headBasics(home, c, { title, description, ogImage: OG_IMAGE, robots: 'index, follow, max-image-preview:large, max-snippet:-1', ld, pageType: 'fixture', pageId: id });
  return guardEmail(`<!DOCTYPE html>
<html lang="${t.htmlLang}">
<head>
${head}
<link rel="alternate" type="application/json" href="${c.root}${rel}" title="${attr(name)} DMX fixture (JSON)">
<link rel="stylesheet" href="${c.root}assets/controllers/controllers.css">
<link rel="stylesheet" href="${c.root}assets/devices/devices.css">
<noscript><style>.js-only { display: none !important; }</style></noscript>
</head>
<body class="page-controllers page-controller page-device page-fixture">
${topBar(home, c)}

<main id="main">
  <section class="ch-hero" id="about" aria-labelledby="about-title">
    <nav class="crumbs" aria-label="${attr(t.crumbs.label)}">
      <ol>
        <li><a href="${c.to('home')}">${t.crumbs.home}</a></li>
        <li><a href="${c.root}${locale === 'zh' ? 'zh/' : ''}${HUB_PATH}#kind-dmx-fixture">${t.crumbs.devices}</a></li>
        <li aria-current="page">${esc(name)}</li>
      </ol>
    </nav>
    <p class="eyebrow">${generic ? F.eyebrowGeneric : esc(fx.manufacturer)}</p>
    <h1 id="about-title">${esc(name)}</h1>
    <div class="hero-cols">
      <div class="lede d-lede">
        <p>${lede}</p>
        <ul class="badges"><li class="${imported ? 'b-comm' : 'b-gen'}">${imported ? t.origin.ofl : t.origin.generic}</li><li class="b-unv">${fx.verified ? t.verified.yes : t.verified.no}</li></ul>
      </div>
      <div class="hero-facts">
        <dl class="d-facts">
          ${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('\n          ')}
        </dl>
      </div>
    </div>
  </section>

  <!-- ═════ the light first: a virtual fixture through the real Patch ═════ -->
  <section class="sec" id="try" aria-labelledby="try-title">
    ${sec('try', F.try.eyebrow, fill(F.try.title, { name: esc(name) }), F.try.lede)}
    <div class="vfx js-only" id="vfx">
      <div class="vfx-controls">
        <label class="vfx-field"><span>${F.try.mode}</span><select id="vfx-mode">${fx.modes.map((m) => `<option value="${attr(m.id)}"${m === snip.mode ? ' selected' : ''}>${esc(m.id)} · ${m.channels.length}</option>`).join('')}</select></label>
        <label class="vfx-field"><span>${F.try.address}</span><input id="vfx-address" type="number" min="1" max="512" step="1" value="1" inputmode="numeric"></label>
        <div class="vfx-sliders" id="vfx-sliders"></div>
      </div>
      <div class="vfx-out">
        <p class="vfx-k">${F.try.swatch}</p>
        <div class="vfx-look"><div class="vfx-swatch" id="vfx-swatch" role="img" aria-label="${attr(F.try.swatch)}"></div><svg class="vfx-aim" id="vfx-aim" viewBox="0 0 100 100" aria-hidden="true" focusable="false" style="display: none"><circle cx="50" cy="50" r="46"/><path d="M50 4v92M4 50h92"/><circle id="vfx-dot" class="dot" cx="50" cy="50" r="6"/></svg></div>
        <p class="vfx-state" id="vfx-state" role="status"></p>
        <p class="vfx-k">${F.try.bytes}</p>
        <div class="table-scroll" role="region" aria-label="${attr(F.try.bytes)}" tabindex="0">
        <table class="vfx-bytes"><thead><tr><th scope="col">${F.try.cols.ch}</th><th scope="col">${F.try.cols.channel}</th><th scope="col">${F.try.cols.byte}</th><th scope="col">${F.try.cols.does}</th></tr></thead><tbody id="vfx-bytes"></tbody></table>
        </div>
      </div>
      <p class="note">${F.try.cap}</p>
    </div>
    <noscript><p class="noscript">${F.try.noscript}</p></noscript>
  </section>

  <!-- ═════ every mode, every channel ═════ -->
  <section class="sec" id="channels" aria-labelledby="channels-title">
    ${sec('channels', F.channels.eyebrow, fill(F.channels.title, { name: esc(name) }), F.channels.lede)}
    ${tables}
  </section>

  <!-- ═════ use it ═════ -->
  <section class="sec" id="use" aria-labelledby="use-title">
    ${sec('use', F.use.eyebrow, fill(F.use.title, { name: esc(name) }), fill(F.use.lede, { mode: `<code>${esc(snip.mode.id)}</code>` }))}
    ${term(home, 'javascript', 'snip-fixture', snip.code, 'code')}
    <p>${fill(F.use.prints, { mode: `<code>${esc(snip.mode.id)}</code>` })}</p>
    <ol class="vfx-print">${snip.mode.channels.map((key, i) => `<li><code>${esc(key)}</code> <b>${snip.bytes[i]}</b></li>`).join('')}</ol>
  </section>

  <!-- ═════ files ═════ -->
  <section class="sec" id="files" aria-labelledby="files-title">
    ${sec('files', F.files.eyebrow, F.files.title)}
    <p>${F.files.json}</p>
    <div class="vf-row"><a class="vf-btn" href="${c.root}${rel}" download="${attr(d.file.split('/').pop())}" data-oav-event="export_download" data-oav-format="json" data-oav-id="${id}">${esc(d.file.split('/').pop())}</a></div>
    <ul class="model-links">
      <li><a href="${c.root}${SCHEMA_FIXTURE}">${F.files.schema}</a></li>
      <li><a href="${BLOB}${rel}">${F.files.github} ↗</a></li>
    </ul>
  </section>

  <!-- ═════ where the data comes from ═════ -->
  <section class="sec" id="sources" aria-labelledby="sources-title">
    ${sec('sources', F.sources.eyebrow, F.sources.title)}
    <p class="credit">${imported ? fill(F.sources.ofl, { url: attr(ofl), file: attr(src[0].url), path: esc(fx.origin.file), commit: esc(fx.origin.commit.slice(0, 8)), authors: esc(authors) }) : F.sources.generic}</p>
    <p>${fill(F.sources.license, { license: esc(fx.license || 'MIT') })} ${fx.verified ? fill(F.sources.verified, { n: (fx.verifications || []).length }) : F.sources.unverified}</p>
    <h3>${t.sourcesTitle}</h3>
    <ul class="sources">${src.map((s, i) => sourceItem(t, s, { vendor: imported && i > 0 })).join('')}</ul>
    ${fx.notes ? `<h3>${F.sources.notes}</h3><p class="raw-note" lang="en">${esc(fx.notes)}</p>` : ''}
  </section>

  <!-- ═════ around it ═════ -->
  <section class="sec" id="related" aria-labelledby="related-title">
    ${sec('related', t.more.related, F.related.title)}
    <ul class="rel" aria-label="${attr(t.more.relatedLabel)}">
      ${relList.map((x) => `<li><a href="../${x.row.id}/">${esc(x.row.name)}</a><span>${esc(t.fixtureKinds[x.data.kind] || x.data.kind)} · ${footText(x.data)} ch</span></li>`).join('\n      ')}
    </ul>
    <p class="cmp-link"><a href="${c.root}${locale === 'zh' ? 'zh/' : ''}${HUB_PATH}#kind-dmx-fixture">${F.related.more} →</a></p>
  </section>

  ${reportBlock(t, name, id, rel)}

  <!-- ═════ next step: light it from a work ═════ -->
  <section class="sec next-step" id="next-step" aria-labelledby="next-step-title">
    ${sec('next-step', home.next.label, F.nextTitle, fill(F.nextLede, { num: ex.num }))}
    <p class="next-links">${nextLink(c.to('docs', '#dmx'), 'docs', `${F.nextDmx} →`)} ${nextLink(`${c.root}${ex.dir}`, 'example', `${esc(fill(F.nextExample, { num: ex.num, title: pick(ex.title, locale) }))} →`)}</p>
  </section>

</main>

${siteFooter(home, c)}

<script type="application/json" id="fx-data">${JSON.stringify(runtime).replace(/</g, '\\u003c')}</script>
<script type="module" src="${c.root}assets/devices/fixture.js"></script>
</body>
</html>
`);
}
