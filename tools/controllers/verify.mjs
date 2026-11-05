// /controllers/verify/ and /zh/controllers/verify/: check a controller against its file, one control at a time.
// Rendered by tools/build-controllers.mjs next to the gallery. The page is a tool, so it needs JavaScript and Web MIDI;
// what it is and how it works is still in the HTML for anyone reading it without them. The logic lives in
// packages/midi/verify-session.js (pure, tested); assets/controllers/verify.js only joins it to the page.

import { SITE, REPO, pathCtx, headBasics, pageNode, breadcrumbNode, homeUrl, topBar, siteFooter, guardEmail, esc, attr } from '../site/chrome.mjs';
import { noMidiStrip, nameOf, PROFILE_DIR, fill } from './page.mjs';
import { fullName } from './detail.mjs';

export const VERIFY_PATH = 'controllers/verify/';
const OG_IMAGE = SITE + 'assets/home/og.png';

export const verifyCtx = (locale) => pathCtx(VERIFY_PATH, locale, { page: 'controllers' });

export function renderVerify(t, home, locale, cat) {
  const V = t.verify, c = verifyCtx(locale);
  const head = headBasics(home, c, {
    title: V.meta.title, description: V.meta.description, ogDescription: V.meta.description, ogImage: OG_IMAGE, ogImageAlt: V.meta.title,
    robots: 'index, follow, max-image-preview:large, max-snippet:-1',
    ld: [
      breadcrumbNode(c, [[t.detail.crumbs.home, homeUrl(c)], [t.detail.crumbs.controllers, SITE + (locale === 'zh' ? 'zh/' : '') + 'controllers/'], [V.h1, c.self]]),
      pageNode(c, home, { name: V.meta.title, description: V.meta.description, image: OG_IMAGE, breadcrumb: { '@id': c.self + '#breadcrumb' } }),
    ],
  });
  const groups = [[V.setup.devices, cat.devices], [V.setup.generic, cat.generic]];
  const options = groups.map(([label, list]) => `<optgroup label="${attr(label)}">${list.map((d) => `<option value="${d.p.id}">${esc(fullName(d.p, locale))}</option>`).join('')}</optgroup>`).join('\n            ');
  const files = Object.fromEntries([...cat.devices, ...cat.generic].map((d) => [d.p.id, d.file]));
  const runtime = { lang: locale, repo: REPO, dir: PROFILE_DIR, files, tool: 'openaudiovisual.com/controllers/verify/', detailBase: c.to('controllers'), s: V.run, end: V.end, setup: V.setup };

  return guardEmail(`<!DOCTYPE html>
<html lang="${t.htmlLang}">
<head>
${head}
<link rel="stylesheet" href="${c.root}assets/controllers/controllers.css">
<noscript><style>.js-only { display: none !important; }</style></noscript>
</head>
<body class="page-controllers page-verify">
${topBar(home, c)}

<main id="main">
  ${noMidiStrip(t, c)}

  <section class="ch-hero" aria-labelledby="vf-title">
    <nav class="crumbs" aria-label="${attr(t.detail.crumbs.label)}">
      <ol>
        <li><a href="${c.to('home')}">${t.detail.crumbs.home}</a></li>
        <li><a href="${c.to('controllers')}">${t.detail.crumbs.controllers}</a></li>
        <li aria-current="page">${V.h1}</li>
      </ol>
    </nav>
    <p class="eyebrow">${V.eyebrow}</p>
    <h1 id="vf-title">${V.h1}</h1>
    <div class="vf-lede">
      <p>${V.lede}</p>
      <ol class="vf-how">
        ${V.how.map((x) => `<li>${x}</li>`).join('\n        ')}
      </ol>
    </div>
    <noscript><p class="noscript">${V.noscript}</p></noscript>
  </section>

  <section class="sec vf js-only" id="vf-setup" aria-labelledby="vf-setup-title">
    <h2 id="vf-setup-title">${V.setup.title}</h2>
    <form id="vf-form" class="vf-form">
      <label class="vf-f"><span>${V.setup.model}</span>
        <select id="vf-model" name="model">
            ${options}
        </select>
      </label>
      <label class="vf-f"><span>${V.setup.scope}</span>
        <select id="vf-scope" name="scope">
          <option value="all">${V.setup.scopeAll}</option>
          <option value="unconfirmed">${V.setup.scopeUnconfirmed}</option>
        </select>
      </label>
      <div class="vf-f vf-port"><span>${V.setup.port}</span>
        <div class="vf-row">
          <button type="button" class="vf-btn" id="vf-connect">${V.setup.connect}</button>
          <select id="vf-port" name="port" hidden aria-label="${attr(V.setup.port)}"></select>
        </div>
      </div>
      <p class="vf-status" id="vf-status" role="status"></p>
      <div class="vf-row">
        <button type="submit" class="vf-btn vf-go" id="vf-start" disabled>${V.setup.start}</button>
        <button type="button" class="vf-btn vf-quiet" id="vf-sim">${V.setup.simulate}</button>
      </div>
      <p class="vf-note">${V.setup.note}</p>
    </form>
  </section>

  <section class="sec vf" id="vf-run" aria-labelledby="vf-prompt" hidden>
    <div class="vf-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" aria-label="${attr(V.run.progress)}"><i id="vf-bar"></i></div>
    <p class="vf-count" id="vf-count"></p>
    <p class="vf-sim-tag" id="vf-sim-tag" hidden>${V.run.simTag}</p>
    <h2 class="vf-prompt" id="vf-prompt" aria-live="polite"></h2>
    <p class="vf-expect"><span>${V.run.expected}</span> <code id="vf-expected"></code></p>
    <p class="vf-heard"><span>${V.run.heard}</span> <code id="vf-heard">–</code></p>

    <div class="vf-diff" id="vf-diff" role="alert" hidden>
      <p class="vf-diff-title" id="vf-diff-title"></p>
      <table>
        <tbody>
          <tr><th scope="row">${V.run.fileSays}</th><td><code id="vf-was"></code></td></tr>
          <tr><th scope="row">${V.run.unitSent}</th><td><code id="vf-got"></code></td></tr>
        </tbody>
      </table>
      <div class="vf-row">
        <button type="button" class="vf-btn vf-go" id="vf-accept">${V.run.accept}</button>
        <button type="button" class="vf-btn" id="vf-retry">${V.run.retry}</button>
        <button type="button" class="vf-btn vf-quiet" id="vf-reject">${V.run.reject}</button>
      </div>
    </div>

    <div class="vf-row vf-actions" id="vf-actions">
      <button type="button" class="vf-btn" id="vf-skip">${V.run.skip}</button>
      <button type="button" class="vf-btn" id="vf-absent">${V.run.absent}</button>
      <button type="button" class="vf-btn vf-quiet" id="vf-back">${V.run.back}</button>
      <button type="button" class="vf-btn vf-quiet" id="vf-finish">${V.run.finish}</button>
      <button type="button" class="vf-btn vf-quiet" id="vf-wrong" hidden>${V.run.simWrong}</button>
    </div>
    <div class="stage vf-stage"><oav-controller id="vf-ctl" layout="face"></oav-controller></div>
  </section>

  <section class="sec vf" id="vf-end" aria-labelledby="vf-end-title" hidden>
    <h2 id="vf-end-title">${V.end.title}</h2>
    <dl class="vf-tally" id="vf-tally"></dl>
    <div class="table-scroll" tabindex="0" role="region" aria-label="${attr(V.end.tableLabel)}" id="vf-diffs-wrap" hidden>
      <table><thead><tr><th scope="col">${V.end.cols.control}</th><th scope="col">${V.end.cols.result}</th><th scope="col">${V.run.fileSays}</th><th scope="col">${V.run.unitSent}</th></tr></thead><tbody id="vf-diffs"></tbody></table>
    </div>

    <form id="vf-meta" class="vf-form">
      <h3>${V.end.metaTitle}</h3>
      <label class="vf-f"><span>${V.end.by}</span><input id="vf-by" name="by" autocomplete="name" required></label>
      <label class="vf-f"><span>${V.end.firmware}</span>
        <input id="vf-firmware" name="firmware" autocomplete="off" placeholder="${attr(V.end.firmwareHint)}">
      </label>
      <div class="vf-row" id="vf-fw-row" hidden>
        <button type="button" class="vf-btn vf-quiet" id="vf-read-fw">${V.end.readFirmware}</button>
        <span class="vf-note" id="vf-fw-status">${V.end.readFirmwareNote}</span>
      </div>
      <label class="vf-f"><span>${V.end.os}</span><input id="vf-os" name="os" autocomplete="off"></label>
      <label class="vf-f"><span>${V.end.browser}</span><input id="vf-browser" name="browser" autocomplete="off"></label>
      <label class="vf-check" id="vf-attest-row"><input type="checkbox" id="vf-attest"> <span>${V.end.attest}</span></label>
      <p class="vf-method" id="vf-method" role="status"></p>
      <p class="vf-problems" id="vf-problems" role="alert" hidden></p>
    </form>

    <div class="vf-row vf-out">
      <button type="button" class="vf-btn vf-go" id="vf-download">${V.end.download}</button>
      <button type="button" class="vf-btn" id="vf-copy">${V.end.copy}</button>
      <a class="vf-btn" id="vf-issue" href="${REPO}/issues/new" rel="noopener">${V.end.issue} ↗</a>
      <a class="vf-btn" id="vf-pr" href="${REPO}" rel="noopener">${V.end.pr} ↗</a>
      <button type="button" class="vf-btn vf-quiet" id="vf-again">${V.end.again}</button>
    </div>
    <p class="vf-note">${V.end.prSteps}</p>
  </section>

  <section class="sec" id="vf-why" aria-labelledby="vf-why-title">
    <h2 id="vf-why-title">${V.why.title}</h2>
    <dl class="vf-levels">
      ${V.why.levels.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('\n      ')}
    </dl>
    <p>${fill(V.why.text, { link: `<a href="${REPO}/blob/main/packages/midi/README.md#how-sure-a-profile-is">${V.why.linkText} ↗</a>` })}</p>
  </section>
</main>

${siteFooter(home, c)}

<script type="application/json" id="ctl-i18n">${JSON.stringify(runtime).replace(/</g, '\\u003c')}</script>
<script type="module" src="${c.root}assets/controllers/verify.js"></script>
</body>
</html>
`);
}
