// The /webtoe/ template — one structure, rendered once per language by
// tools/build-webtoe.mjs (strings: en.mjs / zh.mjs). Everything that must not
// drift between languages lives HERE: section order, ids, links, code, and the
// numbers (copied verbatim from the WebToe README, so both pages quote the same
// measurement).
//
// WebToe is the sister project: the engine half of the stack. This page says
// what it is, how packages/world-webtoe plugs it into a show, and what its
// TouchDesigner import can and cannot promise. Static HTML, no script.

import { SITE, TREE, pageCtx, headBasics, topBar, siteFooter, esc, attr } from '../site/chrome.mjs';
import { hl } from '../../assets/controllers/snippets.js';

/** WebToe's own addresses, shared with the homepage section. */
export const WEBTOE = {
  app: 'https://webtoe.openaudiovisual.com/',
  docs: 'https://webtoe.openaudiovisual.com/docs/',
  repo: 'https://github.com/frank890417/WebToe',
  toe: 'https://webtoe.openaudiovisual.com/?project=examples/toe/2022-fractals.toe',
  format: 'https://github.com/frank890417/WebToe/blob/main/docs/TOE-FORMAT.md',
};

export const SECTIONS = ['intro', 'engine', 'stack', 'import'];

/** Screenshots from the WebToe README (docs/media), cropped to 16:7, 800 and 1600 wide. */
export const SHOTS = { hero: 'hero-lfo-garden', engine: 'feedback-trails', import: 'import-report' };
export const shot = (root, name, alt, { lazy = true, sizes = '(min-width: 1500px) 1440px, 100vw' } = {}) =>
  `<img src="${root}assets/webtoe/${name}-1600.webp" srcset="${root}assets/webtoe/${name}-800.webp 800w, ${root}assets/webtoe/${name}-1600.webp 1600w" sizes="${sizes}" width="1600" height="700"${lazy ? ' loading="lazy"' : ''} decoding="async" alt="${attr(alt)}">`;

// the doors under the hero, in order (labels in the string tables)
const DOORS = [WEBTOE.app, WEBTOE.docs, WEBTOE.repo, WEBTOE.toe];

// numbers on the page, verbatim from the WebToe README
const STATS = ['~90 KB', 'WebGL2 + WebGPU', '62.3%', '12'];
const FACTS = ['125 / 125', '17.7 s', '4.2 s', '8 s'];

// the four steps from a knob to a patch parameter; the first three are open-audiovisual's layers
const STEPS = [
  { cls: 'l1', code: 'midi/cc/1' },
  { cls: 'l2', code: 'midi/cc/1 → speed' },
  { cls: 'l3', code: "{ type: 'webtoe:ext', values }" },
  { cls: 'wt', code: "ext('speed', 0.5)" },
];

// ---------- code shown on the page (identical in both languages) ----------
const SHOW_CODE = `import { createShow } from '@openav/show';
import { webtoeWorld } from '@openav/world-webtoe';

await createShow({
  world: webtoeWorld({
    project: new URL('./garden.webtoe.json', location.href).href,
    // the keys are the names the patch listens for
    params: [
      { key: 'speed', min: 0, max: 1, def: 0.5 },
      { key: 'hue', min: 0, max: 360, def: 205 },
    ],
  }),
  routes: [{ source: 'midi/cc/1', target: 'speed' }],
});`;

const PATCH_CODE = `// lfo1 · frequency
0.11 * (0.2 + ext('speed', 0.5) * 2.2)

// hsv1 · hueoffset
fract(ext('hue', 205) / 360 + time.seconds * 0.01)`;

const MESSAGE_CODE = `const webtoe = iframe.contentWindow;   // an iframe showing the WebToe app

// set the values every ext('name') in the patch reads
webtoe.postMessage({ type: 'webtoe:ext', values: { speed: 0.72 } }, '*');

// open another project: a .webtoe.json or .toe URL the app may fetch
webtoe.postMessage({ type: 'webtoe:load', url: nextProjectUrl }, '*');`;

const BRIDGE_CODE = `npx webtoe        # the app, served locally with the bridge: drag your .toe in`;
/** shell lines: only the # comments are painted */
const shell = (s) => esc(s).replace(/(^|\s)(#[^\n]*)/g, '$1<span class="tc">$2</span>');

// ---------- the page ----------
export function renderPage(t, home, locale) {
  const c = pageCtx('webtoe', locale);
  const root = c.root;
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: t.meta.title,
    description: t.meta.description,
    url: c.self,
    inLanguage: home.ldLanguage,
    isPartOf: { '@type': 'WebSite', name: 'open-audiovisual', url: SITE },
    about: {
      '@type': 'SoftwareApplication',
      name: 'WebToe',
      description: t.meta.ld,
      url: WEBTOE.app,
      sameAs: [WEBTOE.repo],
      applicationCategory: 'MultimediaApplication',
      operatingSystem: 'Web browser',
      license: 'https://opensource.org/licenses/MIT',
      author: { '@type': 'Person', name: 'Che-Yu Wu', alternateName: '吳哲宇', url: 'https://cheyuwu.com' },
    },
    image: `${SITE}assets/webtoe/${SHOTS.hero}-1600.webp`,
  };

  const sec = (id, eyebrow, title, lede = '') => `
    <header class="sec-head">
      <p class="eyebrow">${eyebrow}</p>
      <h2 id="${id}-title">${title}</h2>
      ${lede ? `<p class="sec-lede">${lede}</p>` : ''}
    </header>`;
  const term = (label, code, paint = hl) => `
      <div class="term">
        <div class="term-bar"><span>${label}</span></div>
        <pre><code>${paint(code)}</code></pre>
      </div>`;
  const figure = (name, alt, caption, opts) => `<figure class="wt-shot">
      ${shot(root, name, alt, opts)}
      <figcaption>${caption}</figcaption>
    </figure>`;

  return `<!DOCTYPE html>
<html lang="${home.htmlLang}">
<head>
${headBasics(home, c, { title: t.meta.title, description: t.meta.description, ogDescription: t.meta.ogDescription })}
<link rel="stylesheet" href="${root}assets/webtoe/webtoe.css">
<script type="application/ld+json">
${JSON.stringify(ld, null, 2)}
</script>
</head>
<body class="page-webtoe">
${topBar(home, c)}

<main id="main">

  <!-- ═════ what WebToe is ═════ -->
  <section class="wt-hero" id="intro" aria-labelledby="intro-title">
    <p class="eyebrow"><i class="wt-dot" aria-hidden="true"></i>${t.hero.eyebrow}</p>
    <h1 id="intro-title"><span class="wt-word">WebToe</span> <span class="wt-sub">${t.hero.sub}</span></h1>
    <div class="hero-grid">
      <div class="hero-text">
        <p class="lede">${t.hero.lede}</p>
        <p class="wt-tagline">${t.hero.tagline}</p>
      </div>
      <nav class="doors" aria-label="${attr(t.hero.doorsLabel)}">
        ${t.hero.doors.map((d, i) => `<a class="door" href="${DOORS[i]}"><span class="door-who">${d.who}</span><span class="door-what">${d.what}</span><span class="door-arrow" aria-hidden="true">↗</span></a>`).join('\n        ')}
      </nav>
    </div>
    ${figure(SHOTS.hero, t.hero.shotAlt, t.hero.shotCaption, { lazy: false })}
  </section>

  <!-- ═════ 01 · the engine ═════ -->
  <section class="sec" id="engine" aria-labelledby="engine-title">
    ${sec('engine', t.engine.eyebrow, t.engine.title, t.engine.lede)}
    <dl class="wt-stats">
      ${STATS.map((v, i) => `<div><dt>${t.engine.stats[i]}</dt><dd>${esc(v)}</dd></div>`).join('\n      ')}
    </dl>
    <p class="wt-source">${t.engine.statsSource}</p>
    <div class="wt-cols">
      <ul class="wt-points">
        ${t.engine.points.map((p) => `<li><strong>${p.head}</strong> ${p.text}</li>`).join('\n        ')}
      </ul>
      ${figure(SHOTS.engine, t.engine.shotAlt, t.engine.shotCaption, { sizes: '(min-width: 1080px) 50vw, 100vw' })}
    </div>
  </section>

  <!-- ═════ 02 · with open-audiovisual: params in, ext() out ═════ -->
  <section class="sec" id="stack" aria-labelledby="stack-title">
    ${sec('stack', t.stack.eyebrow, t.stack.title, t.stack.lede)}
    <ol class="wt-flow">
      ${STEPS.map((s, i) => `<li class="wt-step wt-step-${s.cls}">
        <p class="wt-step-name"><span>${String(i + 1).padStart(2, '0')}</span> ${t.stack.steps[i].name}</p>
        <p class="wt-step-code"><code>${esc(s.code)}</code></p>
        <p class="wt-step-text">${t.stack.steps[i].text}</p>
      </li>`).join('\n      ')}
    </ol>
    <div class="wt-code">
      <div>
        <h3>${t.stack.showTitle}</h3>
        <p>${t.stack.showText}</p>
        ${term('examples/04-webtoe-stage/main.js', SHOW_CODE)}
        <p class="wt-links"><a class="more" href="${root}examples/04-webtoe-stage/">${t.stack.links.example} →</a> <a class="more" href="${TREE}packages/world-webtoe">${t.stack.links.source} ↗</a></p>
      </div>
      <div>
        <h3>${t.stack.patchTitle}</h3>
        <p>${t.stack.patchText}</p>
        ${term('garden.webtoe.json', PATCH_CODE)}
        <h3>${t.stack.messageTitle}</h3>
        <p>${t.stack.messageText}</p>
        ${term('postMessage', MESSAGE_CODE)}
        <p class="wt-links"><a class="more" href="${c.to('docs', '#packages-openav-world-webtoe')}">${t.stack.links.docs} →</a></p>
      </div>
    </div>
  </section>

  <!-- ═════ 03 · TouchDesigner projects ═════ -->
  <section class="sec" id="import" aria-labelledby="import-title">
    ${sec('import', t.import.eyebrow, t.import.title, t.import.lede)}
    <div class="wt-cols wt-cols-import">
      <div>
        <h3>${t.import.factsTitle}</h3>
        <dl class="wt-facts">
          ${FACTS.map((v, i) => `<div><dt>${esc(v)}</dt><dd>${t.import.facts[i]}</dd></div>`).join('\n          ')}
        </dl>
        <p><a class="more" href="${WEBTOE.toe}">${t.import.tryLink} ↗</a></p>
      </div>
      ${figure(SHOTS.import, t.import.shotAlt, t.import.shotCaption, { sizes: '(min-width: 1080px) 50vw, 100vw' })}
    </div>
    <aside class="wt-research" aria-label="${attr(t.import.researchLabel)}">
      <p>${t.import.research}</p>
      <p><a href="${WEBTOE.format}">${t.import.formatLink} ↗</a></p>
    </aside>
    <div class="wt-bridge">
      <div>
        <h3>${t.import.bridgeTitle}</h3>
        <p>${t.import.bridgeText}</p>
      </div>
      ${term('terminal', BRIDGE_CODE, shell)}
    </div>
    <p class="wt-legal">${t.legal}</p>
  </section>

</main>

${siteFooter(home, c)}
</body>
</html>
`;
}
