// The homepage template — one structure, rendered once per language by
// tools/build-home.mjs (strings: en.mjs / zh.mjs). Everything that must not
// drift between languages lives HERE: section order, ids, links, code,
// signal names, the instrument's markup.
//
// Output is static HTML on purpose: crawlers and AI agents read every word
// without running JavaScript. The script only brings the instrument to life.

import { SITE, REPO, BLOB, TREE, pageCtx, topBar, siteFooter, GA_SNIPPET } from '../site/chrome.mjs';
import { WEBTOE, SHOTS as WEBTOE_SHOTS, shot } from '../webtoe/page.mjs';
export { SITE, REPO };

export const LOCALES = {
  en: { path: '', root: './', url: SITE },
  zh: { path: 'zh/', root: '../', url: SITE + 'zh/' },
};

export const WORKS = [
  '01-hello-particles', '02-chord-garden', '03-pose-field', '04-webtoe-stage', '05-prebiotic-flake',
  '06-cylinder-earth', '07-firework-festival', '08-remote-surface', '09-midi-controllers',
];
const CREDITED = { 4: 0, 5: 1, 6: 2 };          // works index → credits index (artworks by the author)

export const PACKAGE_GROUPS = [
  { layer: 'l1', pkgs: ['midi', 'audio', 'chord', 'pose', 'keys', 'drums'] },
  { layer: 'l2', pkgs: ['mapping'] },
  { layer: 'l3', pkgs: ['stage', 'world-webtoe'] },
  { layer: 'l4', pkgs: ['sound', 'osc'] },
  { layer: 'sp', pkgs: ['timeline', 'console', 'monitor'] },
  { layer: 'sp', pkgs: ['relay', 'surface', 'remote'] },
  { layer: 'sig', pkgs: ['core', 'show', 'mcp'] },
];

// chapters of the /docs/ handbook (ids = tools/docs/chapters.mjs)
const DOCS = [
  ['architecture', 'architecture'],
  ['world', 'writing-a-world'],
  ['signals', 'signals'],
  ['show', 'show-control'],
  ['roadmap', 'roadmap'],
  ['agents', 'agents'],
];

// the hero's patch bay: sources (signals) and targets (params). The wires are
// drawn at runtime from mapper.routes; the `to` text is the no-JS reading.
const BAY_SOURCES = [
  { sig: 'midi/note/on', to: '@world', kind: 'pulse' },
  { sig: 'chord/consonance', to: 'order' },
  { sig: 'pointer/x', to: 'hue' },
  { sig: 'pointer/y', to: 'twist' },
  { sig: 'midi/cc/1', to: 'twist', device: 'midi' },
  { sig: 'audio/rms', to: 'energy', device: 'mic' },
];
const BAY_TARGETS = ['@world', 'order', 'hue', 'twist', 'energy'];

const LAYERS = [
  { id: 'l1', tag: 'L1', pkgs: ['midi', 'audio', 'chord', 'pose', 'keys', 'drums', 'remote'],
    specimen: (t) => `<span class="k">pointer/x</span> = <b data-live-sig="pointer/x">0.50</b>` },
  { id: 'l2', tag: 'L2', pkgs: ['mapping'],
    specimen: () => `<span class="k">pointer/x</span> → <span class="k">hue</span> <span class="c">smooth 0.25</span>` },
  { id: 'l3', tag: 'L3', pkgs: ['stage', 'world-webtoe'],
    specimen: () => `<span class="k">hue</span> = <b data-live-param="hue">14</b>` },
  { id: 'l4', tag: 'L4', pkgs: ['sound', 'osc', 'midi'],
    specimen: () => `<span class="k">screen</span> · <b data-live-fps>60</b> fps` },
];

// ---------- code shown on the page (identical in both languages) ----------
const CMD_RUN = `git clone https://github.com/frank890417/open-audiovisual.git
cd open-audiovisual
node serve.js        # → http://localhost:8080`;

const CMD_COMPANIONS = `node packages/monitor/server.js           # backstage monitor (:7457)
node packages/osc/bridges/osc-bridge.js   # OSC → UDP bridge`;

const WORLD_CODE = `import { createShow } from '@openav/show';
import { createCanvas } from '@openav/stage';

const pulse = {
  name: 'pulse',
  // what the piece is performed WITH: sliders, knobs, hands, the timeline
  params: [{ key: 'size', min: 10, max: 200, def: 40 }],
  init({ container, signals }) {
    this.view = createCanvas(container);
    this.r = 0;
    // a struck note is an event, so it may come straight from a signal
    signals.on('midi/note/on', ({ vel }) => { this.r = 120 * vel; });
  },
  update(dt, state) { this.r = Math.max(0, this.r - dt * 90); this.size = state.size; },
  render() {
    const { ctx } = this.view, { w, h } = this.view.fit();
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(w / 2, h / 2, this.size + this.r, 0, 7); ctx.fill();
  },
  dispose() { this.view.dispose(); },
};

await createShow({ world: pulse, modules: { sound: true } });`;

const MCP_JSON = `{
  "mcpServers": {
    "openav": {
      "command": "node",
      "args": ["/path/to/open-audiovisual/packages/mcp/server.js"]
    }
  }
}`;

const IMPORTS = ['core', 'mapping', 'keys', 'chord', 'stage', 'sound', 'midi', 'audio'];

// ---------- helpers ----------
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const attr = (s) => esc(s).replace(/"/g, '&quot;');
const strip = (s) => String(s).replace(/<[^>]+>/g, '');

const KW = new Set(['import', 'from', 'const', 'let', 'await', 'export', 'return', 'this', 'new', 'function']);
/** tiny, deliberate highlighter: comments, strings, keywords. Escapes as it goes. */
function hl(code) {
  let out = '', i = 0;
  const re = /(\/\/[^\n]*|#[^\n]*)|('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")|\b([A-Za-z_]\w*)\b/g;
  let m;
  while ((m = re.exec(code))) {
    out += esc(code.slice(i, m.index));
    if (m[1]) {
      // a comment starts after whitespace or at line start, never mid-token (https://, '#000')
      const prev = m.index ? code[m.index - 1] : '\n';
      if (!/\s/.test(prev)) { out += esc(m[1][0]); re.lastIndex = m.index + 1; i = m.index + 1; continue; }
      out += `<span class="tc">${esc(m[1])}</span>`;
    } else if (m[2]) out += `<span class="ts">${esc(m[2])}</span>`;
    else if (KW.has(m[3])) out += `<span class="tk">${m[3]}</span>`;
    else out += esc(m[3]);
    i = re.lastIndex;
  }
  return out + esc(code.slice(i));
}

const FAVICON = 'data:image/svg+xml,' + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#0b0b0c"/><circle cx="7" cy="16" r="3.4" fill="#ff5a1f"/><path d="M11 16c2.6 0 2.9-9 6-9s3.2 18 6.2 18 3-9 5.8-9" fill="none" stroke="#edebe5" stroke-width="2.4" stroke-linecap="round"/></svg>`);

// ---------- the page ----------
export function renderPage(t, { locale, other, version }) {
  const L = LOCALES[locale];
  const root = L.root;
  const self = L.url;
  const href = (h) => h.startsWith('#') || /^https?:/.test(h) ? h : root + h;
  const langHref = { en: locale === 'en' ? './' : '../', zh: locale === 'en' ? './zh/' : './' };
  const altPage = langHref[other];

  const ld = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareSourceCode',
    name: 'open-audiovisual',
    alternateName: 'OAV',
    description: t.meta.ld,
    url: self,
    inLanguage: t.ldLanguage,
    codeRepository: REPO,
    license: 'https://opensource.org/licenses/MIT',
    programmingLanguage: { '@type': 'ComputerLanguage', name: 'JavaScript' },
    runtimePlatform: 'Web browser',
    version,
    author: { '@type': 'Person', name: 'Che-Yu Wu', alternateName: '吳哲宇', url: 'https://cheyuwu.com' },
    keywords: ['audiovisual performance', 'creative coding', 'Web MIDI', 'generative art', 'live visuals', 'OSC', 'show control', 'MCP'],
    image: SITE + 'assets/home/og.png',
  };

  // strings the instrument needs at runtime
  const runtime = {
    statusSim: t.inst.statusSim, statusYou: t.inst.statusYou, statusIdle: t.inst.statusIdle,
    midiNone: t.inst.midiNone, midiOn: t.inst.midiOn, micOn: t.inst.micOn, micDenied: t.inst.micDenied,
    soundLoading: t.inst.soundLoading, soundOn: t.inst.soundOn, consonance: t.inst.consonance,
    copy: t.ui.copy, copied: t.ui.copied, eventTarget: t.inst.eventTarget,
  };

  const importmap = { imports: Object.fromEntries(IMPORTS.map(p => [`@openav/${p}`, `${root}packages/${p}/index.js`])) };

  const sec = (id, eyebrow, title, lede = '') => `
    <header class="sec-head">
      <p class="eyebrow">${eyebrow}</p>
      <h2 id="${id}-title">${title}</h2>
      ${lede ? `<p class="sec-lede">${lede}</p>` : ''}
    </header>`;

  const copyBtn = (target) => `<button type="button" class="copy" data-copy="${target}">${t.ui.copy}</button>`;
  const term = (label, id, code, { copy = true, cls = '' } = {}) => `
      <div class="term ${cls}">
        <div class="term-bar"><span>${label}</span>${copy ? copyBtn(id) : ''}</div>
        <pre id="${id}"><code>${hl(code)}</code></pre>
      </div>`;

  return `<!DOCTYPE html>
<html lang="${t.htmlLang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(t.meta.title)}</title>
<meta name="description" content="${attr(t.meta.description)}">
<link rel="canonical" href="${self}">
<link rel="alternate" hreflang="en" href="${LOCALES.en.url}">
<link rel="alternate" hreflang="zh-Hant" href="${LOCALES.zh.url}">
<link rel="alternate" hreflang="x-default" href="${LOCALES.en.url}">
<link rel="alternate" type="text/markdown" href="${root}llms.txt" title="llms.txt">
<meta name="theme-color" content="#0b0b0c">
<meta name="color-scheme" content="dark">
<meta property="og:type" content="website">
<meta property="og:site_name" content="open-audiovisual">
<meta property="og:title" content="${attr(t.meta.title)}">
<meta property="og:description" content="${attr(t.meta.ogDescription)}">
<meta property="og:url" content="${self}">
<meta property="og:locale" content="${t.ogLocale}">
<meta property="og:image" content="${SITE}assets/home/og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="${FAVICON}">
<link rel="preload" href="${root}assets/home/fonts/archivo-var-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${root}assets/home/home.css">
${GA_SNIPPET}
<noscript><style>.status, .switches, .keys-hint, .roll { display: none; }</style></noscript>
<script type="application/ld+json">
${JSON.stringify(ld, null, 2)}
</script>
<script type="importmap">
${JSON.stringify(importmap, null, 2)}
</script>
</head>
<body>
${topBar(t, pageCtx('home', locale))}

<main id="main">

  <!-- ═════ 01 · the instrument: this hero IS the framework running ═════ -->
  <section class="hero" id="play" aria-labelledby="hero-title">
    <h1 id="hero-title"><span class="wordmark">open-<wbr>audiovisual</span> <span class="h1-sub">${t.hero.sub}</span></h1>
    <div class="hero-grid">
      <div class="hero-text">
        <p class="lede">${t.hero.lede}</p>
        <p class="eyebrow facts">${t.hero.eyebrow}</p>
      </div>
      <nav class="doors" aria-label="${attr(t.hero.doorsLabel)}">
        ${t.hero.doors.map((d, i) => `<a class="door door-${i + 1}" href="${href(d.href)}"><span class="door-who">${d.who}</span><span class="door-what">${d.what}</span><span class="door-arrow" aria-hidden="true">→</span></a>`).join('\n        ')}
      </nav>
    </div>

    <div class="inst" id="instrument" tabindex="0" aria-labelledby="inst-title" aria-describedby="inst-help">
      <h2 class="inst-title" id="inst-title"><span class="eyebrow">${t.inst.eyebrow}</span> ${t.inst.title}</h2>
      <div class="stage" id="stage" role="img" aria-label="${attr(t.inst.canvasLabel)}">
        <noscript><img class="poster" src="${root}assets/home/poster.webp" width="1200" height="427" alt=""><p class="noscript">${t.inst.noscript}</p></noscript>
        <span class="hud hud-tl">${t.inst.stageLabel}</span>
        <span class="hud hud-tr"><span id="hud-fps">60</span> fps</span>
        <span class="hud hud-br"><span id="hud-chord"></span><span id="hud-voices">0</span> ${t.inst.voices}</span>
        <p class="status" id="inst-status" aria-live="polite"><span class="led" aria-hidden="true"></span><span id="status-text">${t.inst.statusIdle}</span></p>
      </div>
      <div class="bar">
        <div class="switches" role="group" aria-label="${attr(t.inst.controlsLabel)}">
          <button type="button" class="sw" data-sw="auto" aria-pressed="false"><span class="led" aria-hidden="true"></span>${t.inst.btnAuto}</button>
          <button type="button" class="sw" data-sw="sound" aria-pressed="false"><span class="led" aria-hidden="true"></span>${t.inst.btnSound}</button>
          <button type="button" class="sw" data-sw="midi" aria-pressed="false"><span class="led" aria-hidden="true"></span>${t.inst.btnMidi}</button>
          <button type="button" class="sw" data-sw="mic" aria-pressed="false"><span class="led" aria-hidden="true"></span>${t.inst.btnMic}</button>
        </div>
      </div>
      <aside class="bay" aria-labelledby="bay-title">
        <div class="bay-head"><h3 id="bay-title">${t.inst.bayTitle}</h3><span class="bay-live"><span class="led" aria-hidden="true"></span>${t.inst.bayLive}</span></div>
        <div class="bay-cols"><p><b>${t.inst.srcHead}</b> ${t.inst.srcNote}</p><p><b>${t.inst.dstHead}</b> ${t.inst.dstNote}</p></div>
        <div class="bay-grid" id="bay">
          <ul class="bay-src">
            ${BAY_SOURCES.map(s => `<li data-sig="${s.sig}"${s.device ? ` data-device="${s.device}"` : ''}${s.kind ? ` data-kind="${s.kind}"` : ''}><code>${s.sig}</code><span class="v" aria-hidden="true"></span><span class="to">→ ${s.to === '@world' ? t.inst.eventTarget : s.to}</span><i class="jack" aria-hidden="true"></i></li>`).join('\n            ')}
          </ul>
          <svg class="bay-wires" id="bay-wires" aria-hidden="true" focusable="false"></svg>
          <ul class="bay-dst">
            ${BAY_TARGETS.map(p => `<li data-param="${p}"><i class="jack" aria-hidden="true"></i><code>${p === '@world' ? t.inst.eventTarget : p}</code>${p === '@world' ? '' : '<span class="v" aria-hidden="true"></span>'}</li>`).join('\n            ')}
          </ul>
        </div>
        <p class="bay-legend">${t.inst.legend}</p>
        <p class="bay-wait"><i aria-hidden="true"></i>${t.inst.waiting}</p>
      </aside>
      <canvas class="roll" id="roll" aria-hidden="true"></canvas>
      <div class="keys" id="keys" role="group" aria-label="${attr(t.inst.keysLabel)}"></div>
      <p class="keys-hint" id="inst-help">${t.inst.keysHint}</p>
    </div>
    <p class="inst-caption">${t.inst.caption} <a href="${BLOB}assets/home/home.js">${t.inst.sourceLink} →</a></p>
  </section>

  <!-- ═════ 02 · how it works, in plain words ═════ -->
  <section class="sec" id="how" aria-labelledby="how-title">
    ${sec('how', t.how.eyebrow, t.how.title, t.how.lede)}
    <ol class="layers">
      ${LAYERS.map((l, i) => {
        const x = t.how.layers[i];
        return `<li class="layer layer-${l.id}">
        <p class="layer-tag"><span>${l.tag}</span> ${x.name}</p>
        <p class="layer-quote">“${x.quote}”</p>
        <p class="layer-text">${x.text}</p>
        <p class="layer-spec"><code>${l.specimen(t)}</code><small>${t.how.specimenLabel}</small></p>
        <p class="layer-pkgs">${l.pkgs.map(p => `<a href="${TREE}packages/${p}">${p}</a>`).join(' ')}</p>
      </li>`;
      }).join('\n      ')}
    </ol>

    <div class="how-grid">
      <div>
        <h3>${t.how.spinesTitle}</h3>
        <dl class="spines">
          ${t.how.spines.map(s => `<div><dt>${s.name}</dt><dd>${s.text}</dd></div>`).join('\n          ')}
        </dl>
      </div>
      <div>
        <h3>${t.how.rulesTitle}</h3>
        <ol class="rules">
          ${t.how.rules.map(r => `<li><strong>${r.head}</strong> ${r.text}</li>`).join('\n          ')}
        </ol>
      </div>
    </div>

    <h3 class="glossary-title">${t.how.glossaryTitle}</h3>
    <dl class="glossary">
      ${t.how.glossary.map(g => `<div><dt><dfn>${g.term}</dfn></dt><dd>${g.def}</dd></div>`).join('\n      ')}
    </dl>
  </section>

  <!-- ═════ 03 · works ═════ -->
  <section class="sec" id="works" aria-labelledby="works-title">
    ${sec('works', t.works.eyebrow, t.works.title, t.works.lede)}
    <ol class="works">
      ${WORKS.map((dir, i) => {
        const w = t.works.items[i], n = dir.slice(0, 2);
        const credit = i in CREDITED ? `<p class="work-credit">${t.works.credits[CREDITED[i]]}</p>` : '';
        return `<li class="work" id="work-${n}">
        <div class="work-img"><img src="${root}assets/home/works/${n}.webp" width="800" height="500" loading="lazy" decoding="async" alt="${attr(w.alt)}"></div>
        <div class="work-label">
          <p class="work-n">${n}</p>
          <h3><a class="work-link" href="${root}examples/${dir}/">${w.title}</a></h3>
          ${credit}
          <p class="work-in"><span>${t.works.playsWith}</span> ${w.inputs}</p>
          <p class="work-text">${w.text}</p>
          <p class="work-links"><a class="work-src" href="${TREE}examples/${dir}">${t.ui.source} ↗</a></p>
        </div>
      </li>`;
      }).join('\n      ')}
    </ol>
    <p class="works-note">${t.works.note}</p>
  </section>

  <!-- ═════ the engine: WebToe, the sister project (full page at /webtoe/) ═════ -->
  <section class="sec sec-webtoe" id="webtoe" aria-labelledby="webtoe-title">
    <div class="wt-band">
      <div class="wt-band-text">
        <p class="eyebrow"><i class="wt-dot" aria-hidden="true"></i>${t.webtoe.eyebrow}</p>
        <h2 id="webtoe-title">${t.webtoe.title}</h2>
        <p>${t.webtoe.text}</p>
        <p class="wt-band-links"><a class="more" href="${pageCtx('home', locale).to('webtoe')}">${t.webtoe.more} →</a> <a class="more" href="${WEBTOE.app}">${t.webtoe.open} ↗</a></p>
      </div>
      <div class="wt-band-shot">${shot(root, WEBTOE_SHOTS.hero, t.webtoe.alt, { sizes: '(min-width: 1080px) 55vw, 100vw' })}</div>
    </div>
  </section>

  <!-- ═════ 04 · start ═════ -->
  <section class="sec" id="start" aria-labelledby="start-title">
    ${sec('start', t.start.eyebrow, t.start.title, t.start.lede)}
    <div class="start-grid">
      <div class="start-run">
        ${term('terminal', 'cmd-run', CMD_RUN)}
        <p>${t.start.after}</p>
        ${term('terminal', 'cmd-companions', CMD_COMPANIONS, { cls: 'term-quiet' })}
        <p class="note">${t.start.companions}</p>
      </div>
      <div class="start-world">
        <h3>${t.start.worldTitle}</h3>
        <p>${t.start.worldText}</p>
        ${term('examples/10-pulse/main.js', 'code-world', WORLD_CODE)}
        <p><a class="more" href="${BLOB}docs/writing-a-world.md">${t.start.worldLink} →</a></p>
      </div>
    </div>

    <h3 class="pkgs-title">${t.start.packagesTitle}</h3>
    <p class="pkgs-lede">${t.start.packagesLede}</p>
    <div class="pkgs">
      ${PACKAGE_GROUPS.map((g, gi) => `<div class="pkg-group pg-${g.layer}">
        <h4>${t.start.groups[gi]}</h4>
        <ul>
          ${g.pkgs.map(p => `<li><a href="${TREE}packages/${p}"><code>@openav/${p}</code></a><span>${t.start.packages[p]}</span></li>`).join('\n          ')}
        </ul>
      </div>`).join('\n      ')}
    </div>

    <h3 class="docs-title">${t.start.docsTitle}</h3>
    ${t.start.docsNote ? `<p class="note">${t.start.docsNote}</p>` : ''}
    <ul class="docs">
      ${DOCS.map(([k, id]) => `<li><a href="${pageCtx('home', locale).to('docs', '#' + id)}">${t.start.docNames[k]}</a><span>${t.start.docs[k]}</span></li>`).join('\n      ')}
    </ul>
  </section>

  <!-- ═════ 05 · for AI agents ═════ -->
  <section class="sec sec-agents" id="agents" aria-labelledby="agents-title">
    ${sec('agents', t.agents.eyebrow, t.agents.title, t.agents.lede)}
    <div class="agents-grid">
      <div>
        <h3>${t.agents.promptTitle}</h3>
        <div class="term term-prompt">
          <div class="term-bar"><span>prompt</span>${copyBtn('agent-prompt')}</div>
          <pre id="agent-prompt"><code>${esc(t.agents.prompt.join('\n'))}</code></pre>
        </div>
      </div>
      <div>
        <h3>${t.agents.mcpTitle}</h3>
        <p>${t.agents.mcpText}</p>
        ${term('mcp.json', 'mcp-json', MCP_JSON)}
        <h4>${t.agents.toolsTitle}</h4>
        <dl class="tools">
          ${Object.entries(t.agents.tools).map(([k, v]) => `<div><dt><code>${k}</code></dt><dd>${v}</dd></div>`).join('\n          ')}
        </dl>
      </div>
    </div>
    <h3>${t.agents.filesTitle}</h3>
    <ul class="files">
      <li><a href="${root}llms.txt">/llms.txt</a><span>${t.agents.files.llms}</span></li>
      <li><a href="${root}llms-full.txt">/llms-full.txt</a><span>${t.agents.files.llmsFull}</span></li>
      <li><a href="${BLOB}AGENTS.md">AGENTS.md</a><span>${t.agents.files.agentsMd}</span></li>
      <li><a href="${BLOB}.claude/skills/create-world/SKILL.md">/create-world</a><span>${t.agents.files.skill}</span></li>
      <li><code>application/ld+json</code><span>${t.agents.files.ld}</span></li>
      <li><a href="${altPage}" hreflang="${other === 'zh' ? 'zh-Hant' : 'en'}">${other === 'zh' ? '/zh/' : '/'}</a><span>${t.agents.files.alt}</span></li>
    </ul>
  </section>

  <!-- ═════ 06 · lineage ═════ -->
  <section class="sec" id="lineage" aria-labelledby="lineage-title">
    ${sec('lineage', t.lineage.eyebrow, t.lineage.title)}
    <div class="lineage-grid">
      <div class="prose">
        <p>${t.lineage.p1}</p>
        <p>${t.lineage.p2}</p>
      </div>
      <figure class="pull">
        <blockquote><p>${t.lineage.quote}</p></blockquote>
        <figcaption>${t.lineage.quoteCite}</figcaption>
      </figure>
    </div>
    <h3>${t.lineage.nextTitle}</h3>
    <ol class="next">
      ${t.lineage.next.map(n => `<li>${n}</li>`).join('\n      ')}
    </ol>
    <p><a class="more" href="${BLOB}docs/roadmap.md">${t.lineage.roadmapLink} →</a></p>
  </section>

</main>

${siteFooter(t, pageCtx('home', locale))}

<script type="application/json" id="oav-i18n">${JSON.stringify(runtime).replace(/</g, '\\u003c')}</script>
<script type="module" src="${root}assets/home/home.js"></script>
</body>
</html>
`;
}

export { strip };
