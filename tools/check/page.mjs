// The /check/ template: one structure, rendered per language by tools/build-check.mjs (strings: en.mjs / zh.mjs).
// The page is static HTML that already reads without JavaScript; assets/check/check.js fills in the rows. The script
// never asks for anything at load: MIDI is only *detected*, and the microphone, camera, MIDI list and the connection
// test each wait for their own button.

import { pageCtx, headBasics, pageNode, breadcrumbNode, homeUrl, topBar, siteFooter, guardEmail, SOFTWARE_ID, esc, attr } from '../site/chrome.mjs';

export const ROWS = ['browser', 'secure', 'midi', 'mic', 'camera', 'graphics', 'local'];

/** where each row's advice lives in the docs page (anchors = docs chapter id + the English heading) */
export const DOC_ANCHORS = {
  browser: 'quick-start-which-browser',
  secure: 'troubleshooting-the-camera-or-microphone-does-not-start',
  midi: 'troubleshooting-no-midi-devices-appear',
  mic: 'troubleshooting-the-camera-or-microphone-does-not-start',
  camera: 'troubleshooting-the-camera-or-microphone-does-not-start',
  graphics: 'troubleshooting',
  local: 'troubleshooting-chrome-asks-about-the-local-network-or-about-apps-on-this-device',
};

const BUTTONS = { midi: 'btn-midi', mic: 'btn-mic', camera: 'btn-camera', local: 'btn-local' };

/** the strings check.js needs, as JSON for a <script type="application/json"> (`<` escaped) */
const clientStrings = (t) => JSON.stringify({ state: t.state, summary: t.hero.summary, copy: t.actions, ...t.js }).replace(/</g, '\\u003c');

export function renderPage(t, home, locale) {
  const c = pageCtx('check', locale);
  const root = c.root;
  const docs = (anchor) => c.to('docs', '#' + anchor);
  const ld = [
    pageNode(c, home, {
      name: t.meta.title, description: t.meta.description, breadcrumb: { '@id': c.self + '#breadcrumb' },
      mentions: { '@id': SOFTWARE_ID },
    }),
    breadcrumbNode(c, [['open-audiovisual', homeUrl(c)], [t.meta.crumb, c.self]]),
  ];

  const row = (id) => {
    const r = t.rows[id];
    const btn = BUTTONS[id];
    return `
    <li class="chk" id="chk-${id}" data-state="idle">
      <div class="chk-head">
        <span class="chk-dot" aria-hidden="true"></span>
        <h2>${r.title}</h2>
        <span class="chk-badge">${t.state.idle}</span>
      </div>
      <p class="chk-msg" aria-live="polite">${r.idle}</p>${id === 'camera' ? '\n      <video class="chk-video" id="chk-video" muted playsinline hidden></video>' : ''}${id === 'mic' ? '\n      <div class="chk-meter" id="chk-meter" hidden><i></i></div>' : ''}
      ${btn ? `<p class="chk-act"><button type="button" id="${btn}" class="chk-btn">${r.button}</button> <span class="chk-note">${r.note}</span></p>` : ''}
      <p class="chk-doc">${t.docLabel}: <a href="${docs(DOC_ANCHORS[id])}">${r.doc}</a></p>
    </li>`;
  };

  return guardEmail(`<!DOCTYPE html>
<html lang="${home.htmlLang}">
<head>
${headBasics(home, c, { title: t.meta.title, description: t.meta.description, ogDescription: t.meta.ogDescription, ld })}
<link rel="stylesheet" href="${root}assets/check/check.css">
</head>
<body class="page-check">
${topBar(home, c)}

<main id="main">
  <section class="chk-hero" aria-labelledby="chk-title">
    <p class="eyebrow">${t.hero.eyebrow}</p>
    <h1 id="chk-title">${t.hero.title}</h1>
    <p class="lede">${t.hero.lede}</p>
    <p class="chk-promise">${t.hero.promise}</p>
  </section>

  <section class="chk-body" aria-label="${attr(t.hero.eyebrow)}">
    <ol class="chk-list">${ROWS.map(row).join('')}
    </ol>

    <div class="chk-foot">
      <p class="chk-summary" id="chk-summary" aria-live="polite"></p>
      <p class="chk-act"><button type="button" id="btn-copy" class="chk-btn">${t.actions.copy}</button> <span class="chk-note" id="copy-note">${t.actions.copyHint}</span></p>
      <textarea id="chk-out" class="chk-out" readonly rows="9" hidden aria-label="${attr(t.actions.copy)}"></textarea>
      <p class="chk-links"><a href="${docs('troubleshooting')}">${t.allDocs}</a> · <a href="${c.to('controllers')}">${t.links.controllers}</a> · <a href="${c.to('docs')}">${t.links.docs}</a></p>
    </div>
  </section>
</main>

${siteFooter(home, c)}
<script type="application/json" id="chk-strings">${clientStrings(t)}</script>
<script src="${root}assets/check/check.js" defer></script>
</body>
</html>
`);
}
