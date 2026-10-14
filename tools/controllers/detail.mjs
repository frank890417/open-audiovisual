// One page per controller: /controllers/<id>/ and /zh/controllers/<id>/, rendered by
// tools/build-controllers.mjs next to the gallery. Same rules as the gallery (page.mjs):
// every device fact is read from packages/midi/profiles/*.json at build time, strings live
// in en.mjs / zh.mjs under `detail`, and the core content (title, text, the whole MIDI table,
// sources) is in the HTML itself so crawlers and language models read it without running
// JavaScript. assets/controllers/detail.js only makes the faceplate playable and wires the copy buttons.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { SITE, REPO, BLOB, PAGES, headBasics, topBar, siteFooter, esc, attr, pageCtx } from '../site/chrome.mjs';
import { snippets, hl } from '../../assets/controllers/snippets.js';
import { catalog, faceSvg, specParts, nameOf, countsText, detailPath, detailUrl, fill, noteName, TYPE_ORDER, PROFILE_DIR } from './page.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OG_IMAGE = SITE + 'assets/home/og.png';
const P5_SRC = SITE + 'p5/oav-p5.js';

// ------------------------------------------------------------------ context
/** pageCtx() for a page that is not in PAGES: /controllers/<id>/ is two levels deeper than /controllers/. */
export function detailCtx(id, locale) {
  const base = pageCtx('controllers', locale);
  const depth = (locale === 'zh' ? 1 : 0) + 2;
  const root = '../'.repeat(depth);
  return {
    ...base, root,
    self: detailUrl(id, locale),
    url: { en: detailUrl(id, 'en'), zh: detailUrl(id, 'zh') },
    lang: { en: root + detailPath(id, 'en'), zh: root + detailPath(id, 'zh') },
    to: (other, hash = '') => (root + (locale === 'zh' ? 'zh/' : '') + PAGES[other]) + hash || './',
  };
}

/** Date of the last commit that touched a file (YYYY-MM-DD), '' when git cannot say (new file, no history). */
const lm = new Map();
export function lastmodOf(rel) {
  if (!lm.has(rel)) {
    let out = '';
    try { out = execFileSync('git', ['log', '-1', '--format=%cs', '--', rel], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { /* no git */ }
    lm.set(rel, /^\d{4}-\d{2}-\d{2}$/.test(out) ? out : '');
  }
  return lm.get(rel);
}

// ------------------------------------------------------------------ words from data
/** "AKAI LPD8 (mk2)" stays; "OP-1 field" by "teenage engineering" becomes "teenage engineering OP-1 field". */
export function fullName(p, locale) {
  const n = nameOf(p, locale);
  if (p.kind !== 'device' || !p.maker) return n;
  const first = String(p.maker).split(/\s+/)[0].toLowerCase();
  return n.toLowerCase().startsWith(first) ? n : `${p.maker} ${n}`;
}
/** The model without the brand in front of it ("LPD8 (mk2)"), for schema.org `model`. */
export function modelName(p) {
  const n = p.name;
  if (!p.maker) return n;
  const first = String(p.maker).split(/\s+/)[0];
  return n.toLowerCase().startsWith(first.toLowerCase()) ? n.slice(first.length).trim() || n : n;
}

const list = (t, arr) => (t.lang === 'zh' ? arr.join(t.detail.sep) : arr.length < 2 ? arr.join('') : arr.slice(0, -1).join(t.detail.sep) + t.detail.and + arr[arr.length - 1]);
const typeWords = (t, d, max = 99) => TYPE_ORDER.filter((k) => d.counts.has(k)).slice(0, max).map((k) => { const n = d.counts.get(k); return fill(t.types[k][n === 1 ? 0 : 1], { n }); });
const msgKinds = (t, d) => [...new Set(d.p.controls.map((c) => (c.type === 'keys' ? 'note' : c.msg)))].map((m) => t.specs.msg[m] || m);
const channels = (d) => [...new Set(d.p.controls.map((c) => c.ch))].sort((a, b) => a - b);

/** meta description: as many of the sentences as fit the budget (en ~158 chars, zh ~80). */
export function descriptionOf(t, d, locale) {
  const D = t.detail, p = d.p, name = fullName(p, locale), head = D.desc.head[p.kind === 'device' ? 'device' : 'generic'];
  let out = '';
  for (let take = 99; take >= 1; take = take > 3 ? 3 : take - 1) {
    out = fill(head, { name, counts: list(t, typeWords(t, d, take)) });
    if (out.length <= D.desc.max) break;
  }
  for (const tail of D.desc.tails) {
    const next = out + (locale === 'zh' ? '' : ' ') + tail;
    if (next.length <= D.desc.max) out = next;
  }
  return out;
}

// ------------------------------------------------------------------ related controllers
export function related(cat, d, n = 6) {
  const all = [...cat.devices, ...cat.generic];
  return all.filter((x) => x !== d).map((x) => {
    const shared = x.has.filter((h) => d.has.includes(h)).length, union = new Set([...x.has, ...d.has]).size;
    return { x, score: (d.p.maker && x.p.maker === d.p.maker ? 10 : 0) + (6 * shared) / union + (x.p.kind === d.p.kind ? 0.5 : 0) };
  }).sort((a, b) => b.score - a.score || all.indexOf(a.x) - all.indexOf(b.x)).slice(0, n).map((s) => s.x);
}

// ------------------------------------------------------------------ p5.js names (the rule is p5/oav-p5.js tableOf())
const P5_LIMIT = { knob: 8, fader: 8, pad: 16 };   // knob1…knob8, fader1…fader8, pad1…pad16; knob(n) for any n
/** Knobs, faders and pads numbered in the order the profile lists them — the same count oav-p5 does. */
export function p5Names(d) {
  const rows = { knob: [], fader: [], pad: [] };
  for (const c of d.p.controls) if (rows[c.type]) rows[c.type].push({ n: rows[c.type].length + 1, c });
  const name = (kind, n) => (n <= P5_LIMIT[kind] ? `${kind}${n}` : `${kind}(${n})`);
  return { rows, name };
}

function p5Sketch(d, names) {
  const { rows, name } = names, first = (r) => r[0] && r[0].c;
  const cont = [...rows.knob.map((r) => ['knob', r]), ...rows.fader.map((r) => ['fader', r])];
  const cm = (kind, r) => `${r.c.label || r.c.id} · ${r.c.msg === 'cc' ? 'CC ' + r.c.cc : 'note ' + r.c.note}`;
  const draw = [];
  if (cont[0]) draw.push(`  background(${name(cont[0][0], cont[0][1].n)} * 255);   // ${cm(...cont[0])}`); else draw.push('  background(20);');
  if (cont[1]) draw.push(`  circle(width / 2, height / 2, 50 + ${name(cont[1][0], cont[1][1].n)} * 300);   // ${cm(...cont[1])}`);
  let out = `function draw() {\n${draw.join('\n')}\n}`;
  if (rows.pad.length) out += `\n\nfunction padPressed(n, velocity) {      // n = 1…${rows.pad.length}, as in the table\n  circle(random(width), random(height), velocity * 100);\n}`;
  if (d.p.controls.some((c) => c.type === 'keys')) out += `\n\nfunction notePressed(note, velocity) {   // a key goes down\n  circle(random(width), random(height), velocity * 100);\n}`;
  return out;
}

function p5Table(t, d, names) {
  const U = t.detail.use, S = t.specs, { rows, name } = names;
  const msg = (c) => (c.msg === 'cc' ? `CC ${c.cc}` : c.msg === 'note' ? `${S.msg.note} ${c.note} · ${noteName(c.note)}` : S.msg[c.msg] || c.msg);
  const out = [];
  for (const kind of ['knob', 'fader', 'pad']) {
    const rs = rows[kind];
    for (const { n, c } of rs.slice(0, 16)) out.push(`<tr><th scope="row"><code>${name(kind, n)}</code></th><td>${esc(c.label && c.label !== c.id ? c.label + ' ' : '')}<code class="cid">${esc(c.id)}</code></td><td>${esc(msg(c))} · ${S.cols.ch} ${c.ch}</td></tr>`);
    if (rs.length > 16) out.push(`<tr><td colspan="3">${fill(U.p5More, { n: rs.length - 16, kind, last: rs.length })}</td></tr>`);
  }
  const keys = d.p.controls.find((c) => c.type === 'keys');
  if (keys) out.push(`<tr><th scope="row"><code>notePressed(note, velocity)</code></th><td>${esc(fill(t.specs.keysRange, { from: keys.from, to: keys.to, a: noteName(keys.from), b: noteName(keys.to) }))}</td><td>${U.p5KeysRow}</td></tr>`);
  if (!out.length) return '';
  return `<div class="table-scroll" role="region" aria-label="${attr(U.p5Title)}" tabindex="0">
      <table class="p5">
        <thead><tr><th scope="col">${U.p5Cols.read}</th><th scope="col">${U.p5Cols.control}</th><th scope="col">${U.p5Cols.message}</th></tr></thead>
        <tbody>
        ${out.join('\n        ')}
        </tbody>
      </table>
      </div>`;
}

// ------------------------------------------------------------------ JSON-LD
function jsonLd(t, home, c, d, locale, { title, description, file }) {
  const D = t.detail, p = d.p, self = c.self, name = fullName(p, locale);
  const galleryUrl = SITE + (locale === 'zh' ? 'zh/' : '') + 'controllers/';
  const homeUrl = SITE + (locale === 'zh' ? 'zh/' : '');
  const jsonUrl = `${SITE}${PROFILE_DIR}/${file}`;
  const thing = p.kind === 'device'
    ? { '@type': 'Product', '@id': self + '#product', name: p.name, model: modelName(p), brand: { '@type': 'Brand', name: p.maker }, category: D.ld.category, description }
    : { '@type': 'Thing', '@id': self + '#product', name: nameOf(p, locale), alternateName: p.name === nameOf(p, locale) ? undefined : p.name, description: D.ld.categoryGeneric };
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList', '@id': self + '#breadcrumb',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: D.crumbs.home, item: homeUrl },
          { '@type': 'ListItem', position: 2, name: D.crumbs.controllers, item: galleryUrl },
          { '@type': 'ListItem', position: 3, name, item: self },
        ],
      },
      {
        '@type': 'WebPage', '@id': self + '#webpage', url: self, name: title, description, inLanguage: home.ldLanguage,
        isPartOf: { '@type': 'WebSite', name: 'open-audiovisual', url: SITE },
        breadcrumb: { '@id': self + '#breadcrumb' },
        about: { '@id': self + '#product' },
        mainEntity: { '@id': self + '#dataset' },
        primaryImageOfPage: { '@type': 'ImageObject', url: OG_IMAGE, width: 1200, height: 630 },
      },
      thing,
      {
        '@type': 'Dataset', '@id': self + '#dataset', name: fill(D.ld.dataset, { name }), description: fill(D.ld.datasetDesc, { name }), url: self, inLanguage: home.ldLanguage,
        license: 'https://opensource.org/licenses/MIT', isAccessibleForFree: true,
        creator: { '@type': 'Person', name: 'Che-Yu Wu', alternateName: '吳哲宇', url: 'https://cheyuwu.com' },
        isPartOf: { '@id': galleryUrl + '#dataset' },
        about: { '@id': self + '#product' },
        keywords: ['MIDI', 'MIDI controller', 'MIDI implementation chart', 'Web MIDI', name, ...(p.maker ? [p.maker] : [])],
        distribution: [{ '@type': 'DataDownload', name: file, encodingFormat: 'application/json', contentUrl: jsonUrl }],
        ...((p.sources || []).length ? { citation: p.sources.map((s) => ({ '@type': 'CreativeWork', name: s.title, ...(s.url ? { url: s.url } : {}) })) } : {}),
      },
    ],
  };
}

// ------------------------------------------------------------------ the page
export function renderDetail(t, home, locale, d, cat) {
  const D = t.detail, p = d.p, id = p.id, c = detailCtx(id, locale);
  const name = fullName(p, locale), device = p.kind === 'device';
  const title = fill(D.title[device ? 'device' : 'generic'], { name });
  const description = descriptionOf(t, d, locale);
  const file = d.file, jsonRel = `${PROFILE_DIR}/${file}`;
  const ld = jsonLd(t, home, c, d, locale, { title, description, file });
  const all = [...cat.devices, ...cat.generic], at = all.indexOf(d);
  const prev = all[(at - 1 + all.length) % all.length], next = all[(at + 1) % all.length];
  const rel = related(cat, d);
  const sp = specParts(t, d, c, locale);
  const names = p5Names(d);

  const copyBtn = (cid) => `<button type="button" class="copy" data-copy="${cid}">${home.ui.copy}</button>`;
  const term = (label, cid, code) => `<div class="term"><div class="term-bar"><span>${label}</span>${copyBtn(cid)}</div><pre id="${cid}"><code>${hl(code)}</code></pre></div>`;
  const sec = (sid, eyebrow, ttl, lede = '') => `
    <header class="sec-head">
      <p class="eyebrow">${eyebrow}</p>
      <h2 id="${sid}-title">${ttl}</h2>${lede ? `\n      <p class="sec-lede">${lede}</p>` : ''}
    </header>`;
  const href = (x) => `../${x.p.id}/`;

  // text from data
  const counts = list(t, typeWords(t, d));
  const chs = channels(d);
  const chText = fill(D.channelWord[chs.length === 1 ? 0 : 1], { list: chs.join(t.lang === 'zh' ? '、' : ', ') });
  const nSrc = (p.sources || []).length;
  const srcText = fill(D.sourcesN[nSrc === 1 ? 0 : 1], { n: nSrc });
  const lede1 = device ? fill(D.ledeDevice, { name: esc(name), maker: esc(p.maker), counts }) : fill(D.ledeGeneric, { name: esc(name), counts });
  const lede2 = device ? `${fill(D.ledeData, { messages: list(t, msgKinds(t, d)), channels: chText, sources: srcText })} ${d.prov.unverified ? fill(D.unvSome, { n: d.prov.unverified }) : D.unvNone}` : '';
  const F = D.facts;
  const ports = ((p.match && p.match.ports) || []).map((r) => `<code>/${esc(r)}/i</code>`).join(' ');
  const facts = [
    [F.kind, device ? F.kindDevice : F.kindGeneric],
    ...(device ? [[F.maker, esc(p.maker)]] : []),
    [F.controls, fill(t.hero.controlsN, { n: d.total })],
    [F.messages, esc(msgKinds(t, d).join(' · '))],
    [F.channels, chs.join(', ')],
    [F.led, d.prov.led ? F.ledYes : F.ledNo],
    [F.signals, `<code>midi/${esc(p.short)}/…</code>`],
    [F.port, ports || F.portNone],
  ];
  const badgeLi = [];
  const B = t.catalog.badges;
  if (d.prov.maker) badgeLi.push(`<li class="b-maker">${B.maker}</li>`);
  if (d.prov.tool) badgeLi.push(`<li class="b-tool">${fill(B.tool, { tool: esc(d.prov.tool) })}</li>`);
  if (d.prov.community) badgeLi.push(`<li class="b-comm">${B.community}</li>`);
  if (d.prov.generic) badgeLi.push(`<li class="b-gen">${B.generic}</li>`);
  if (d.prov.led) badgeLi.push(`<li class="b-led">${B.led}</li>`);
  if (d.prov.unverified) badgeLi.push(`<li class="b-unv">${fill(B.unverified, { n: d.prov.unverified })}</li>`);

  // snippets
  const base = { profile: id, layout: 'auto', readout: true };
  const sn = snippets(base, p), snOut = snippets({ ...base, midiOut: 'IAC' }, p);
  const inject = `document.head.prepend(Object.assign(document.createElement('script'), { src: '${P5_SRC}?profile=${id}' }));`;
  const issueUrl = `${REPO}/issues/new?title=${encodeURIComponent(fill(D.report.issueTitle, { name, id }))}`;
  const runtime = { lang: locale, copy: home.ui.copy, copied: home.ui.copied, profile: id };

  const head = headBasics(home, c, { title, description, ogDescription: description });
  return `<!DOCTYPE html>
<html lang="${t.htmlLang}">
<head>
${head}
<meta property="og:image:alt" content="${attr(D.ld.image)}">
<meta name="twitter:title" content="${attr(title)}">
<meta name="twitter:description" content="${attr(description)}">
<meta name="twitter:image" content="${OG_IMAGE}">
<meta name="twitter:image:alt" content="${attr(D.ld.image)}">
<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">
<link rel="alternate" type="application/json" href="${c.root}${jsonRel}" title="${attr(name)} MIDI profile (JSON)">
<link rel="stylesheet" href="${c.root}assets/controllers/controllers.css">
<noscript><style>.js-only { display: none !important; }</style></noscript>
<script type="application/ld+json">
${JSON.stringify(ld, null, 2)}
</script>
</head>
<body class="page-controllers page-controller">
${topBar(home, c)}

<main id="main">

  <!-- ═════ the instrument first, then the words ═════ -->
  <section class="ch-hero" id="play" aria-labelledby="play-title">
    <nav class="crumbs" aria-label="${attr(D.crumbs.label)}">
      <ol>
        <li><a href="${c.to('home')}">${D.crumbs.home}</a></li>
        <li><a href="${c.to('controllers')}">${D.crumbs.controllers}</a></li>
        <li aria-current="page">${esc(name)}</li>
      </ol>
    </nav>
    <p class="eyebrow">${device ? esc(p.maker) : D.eyebrowGeneric}</p>
    <h1 id="play-title">${esc(name)}</h1>
    <div class="hero-cols">
      <div class="lede d-lede">
        <p>${lede1}</p>${lede2 ? `\n        <p>${lede2}</p>` : ''}
        <ul class="badges">${badgeLi.join('')}</ul>
      </div>
      <div class="hero-facts">
        <dl class="d-facts">
          ${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('\n          ')}
        </dl>
      </div>
    </div>

    <div class="stage">
      <oav-controller id="d-ctl" profile="${id}" hardware="ask" readout>${faceSvg(p, fill(t.catalog.faceLabel, { name }))}</oav-controller>
    </div>
    <div class="stage-foot">
      <p class="stage-meta"><b>${fill(D.play.title, { name: esc(name) })}</b> <a href="${c.root}examples/09-midi-controllers/?view=controller&amp;profile=${id}">${D.play.full} ↗</a> <a href="${c.root}${jsonRel}">${D.report.raw} ↗</a> <a href="${c.to('controllers')}">${D.play.back}</a></p>
    </div>
    <p class="hint js-only">${D.play.hint}</p>
    <noscript><p class="noscript">${D.play.noscript}</p></noscript>
  </section>

  <!-- ═════ the full MIDI implementation ═════ -->
  <section class="sec" id="midi-map" aria-labelledby="midi-map-title">
    ${sec('midi-map', D.spec.eyebrow, fill(D.spec.title, { name: esc(name) }), D.spec.lede)}
    ${sp.table}
    ${sp.controlNotes ? `<h3>${D.spec.notesTitle}</h3>\n    ${sp.controlNotes}` : ''}
    <div class="spec-grid">
      <div>
        <h3>${t.specs.sources}</h3>
        ${sp.sources}
        ${sp.origin ? `<h3>${t.specs.origin}</h3>${sp.origin}` : ''}
      </div>
      <div>
        ${sp.notes ? `<h3>${t.specs.notes}</h3>${sp.notes}` : ''}
        <h3>${t.specs.ports}</h3>
        ${sp.ports}
      </div>
      <div>
        <h3>${t.specs.signals}</h3>
        ${sp.signals}
      </div>
    </div>
  </section>

  <!-- ═════ use it ═════ -->
  <section class="sec" id="use" aria-labelledby="use-title">
    ${sec('use', D.use.eyebrow, fill(D.use.title, { name: esc(name) }))}
    <ol class="snips">
      <li class="snip"><h3>${D.use.embedTitle}</h3><p>${D.use.embedText}</p>${term('html', 'snip-element', sn.element)}</li>
      <li class="snip"><h3>${D.use.iframeTitle}</h3><p>${D.use.iframeText}</p>${term('html', 'snip-iframe', sn.iframe)}</li>
      <li class="snip"><h3>${D.use.outTitle}</h3><p>${fill(D.use.outText, { href: c.to('controllers', '#embed') })}</p>${term('html', 'snip-daw', snOut.daw)}<p class="note">${D.use.outSteps}</p></li>
    </ol>
    <div class="p5-block" id="p5">
      <h3>${D.use.p5Title}</h3>
      <p>${fill(device ? D.use.p5Text : D.use.p5TextGeneric, { id, name: esc(name) })}</p>
      ${term('javascript', 'snip-p5', inject)}
      ${p5Table(t, d, names)}
      ${term(D.use.p5Sketch, 'snip-p5-sketch', p5Sketch(d, names))}
      ${d.p.controls.some((x) => !['knob', 'fader', 'pad', 'keys'].includes(x.type)) ? `<p class="note">${D.use.p5Other}</p>` : ''}
      ${device ? '' : `<p class="note">${D.use.p5Generic}</p>`}
      <p><a class="more" href="${c.to('docs', '')}#p5">${D.use.p5Docs} →</a></p>
    </div>
  </section>

  <!-- ═════ around it ═════ -->
  <section class="sec" id="related" aria-labelledby="related-title">
    ${sec('related', D.more.eyebrow, D.more.title)}
    <ul class="rel" aria-label="${attr(D.more.relatedLabel)}">
      ${rel.map((x) => `<li><a href="${href(x)}">${esc(fullName(x.p, locale))}</a><span>${esc(x.p.maker || B.generic)} · ${countsText(t, x)}</span></li>`).join('\n      ')}
    </ul>
    <nav class="step" aria-label="${attr(D.more.stepLabel)}">
      <a rel="prev" href="${href(prev)}"><small>← ${D.more.prev}</small>${esc(fullName(prev.p, locale))}</a>
      <a class="back" href="${c.to('controllers')}">${D.more.back}</a>
      <a rel="next" href="${href(next)}"><small>${D.more.next} →</small>${esc(fullName(next.p, locale))}</a>
    </nav>
  </section>

  <!-- ═════ wrong data? ═════ -->
  <section class="sec" id="report" aria-labelledby="report-title">
    ${sec('report', 'GitHub', D.report.title, D.report.text)}
    <ul class="model-links">
      <li><a href="${issueUrl}">${D.report.issue} ↗</a></li>
      <li><a href="${BLOB}${jsonRel}">${D.report.file} ↗</a></li>
      <li><a href="${c.root}${jsonRel}">${D.report.raw}</a></li>
    </ul>
  </section>

</main>

${siteFooter(home, c)}

<script type="application/json" id="ctl-i18n">${JSON.stringify(runtime).replace(/</g, '\\u003c')}</script>
<script type="module" src="${c.root}assets/controllers/detail.js"></script>
</body>
</html>
`;
}
