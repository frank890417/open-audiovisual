// One page per device that is not a controller or a fixture: /devices/<id>/ and /zh/devices/<id>/ (tools/build-devices.mjs).
// A hand-written record (packages/devices/records/<id>.json) gives the facts with their sources, the connections, the setup,
// the problems and the code that reaches it; a part of the electronics library (packages/hw/parts.js) gives its pins, voltages
// and currents with the datasheets. Everything is read at build time and is in the HTML. assets/devices/device.js adds what
// needs a browser: the live helper of a camera or an audio input (only when a button is pressed) and the Enttec frame.
//
// Each snippet prints something on its first lines (the record's own data) and does anything that needs a permission or a
// connection only in a click handler; the test runs every snippet taken from the committed HTML and compares what it prints.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pathCtx, headBasics, pageNode, breadcrumbNode, homeUrl, topBar, siteFooter, guardEmail, PERSON_ID, SOFTWARE_ID } from '../site/chrome.mjs';
import { nextLink } from '../site/next-step.mjs';
import { byId as exampleById, L as pick } from '../examples/catalog.mjs';
import { device as loadDevice } from '../../packages/devices/index.js';
import { fill, esc, attr, sec, term, listText, kindWord, article, protocolName, sourceItem, isVendor, reportBlock, OG_IMAGE, PKG, SCHEMA_DEVICE, SITE, BLOB } from './common.mjs';
import { HUB_PATH } from './sources.mjs';
import { DMX_EXAMPLE } from './fixture.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const TITLE_MAX = 90;
const MEDIA = new Set(['camera', 'audio-interface']);
/** The handbook section of the package a device's code starts from. */
const PKG_DOC = { '@openav/devices': 'devices', '@openav/dmx': 'dmx', '@openav/out': 'packages-openav-out', '@openav/leap': 'packages-openav-leap', '@openav/audio': 'packages-openav-audio', '@openav/record': 'packages-openav-record', '@openav/hw': 'packages-openav-hw' };

// ------------------------------------------------------------------ words from data
const valueText = (v) => (Array.isArray(v) ? v.join(', ') : String(v));
export const isPart = (d) => d.row.from === 'hw-part';

/** The page title, shortened to fit (as the <title> is written): the kind's pattern, then the name without its parenthesis. */
export function titleOf(t, d) {
  const T = t.device.title, k = isPart(d) ? 'part' : d.row.kind, name = d.row.name, short = name.replace(/\s*\([^)]*\)\s*/g, ' ').trim();
  for (const x of [fill(T[k] || T.other, { name }), fill(T[k] || T.other, { name: short }), fill(T.other, { name: short })]) if (esc(x).length <= TITLE_MAX) return x;
  return fill(T.other, { name: short });
}

const connWords = (t, r) => listText(t, r.connections.map((x) => t.connections[x] || x));

export function descriptionOf(t, d) {
  const D = t.device.desc, r = d.row;
  const kind = isPart(d) ? (t.partKinds[d.data.kind] || d.data.kind) : kindWord(t, r.kind);
  let out = fill(D.head, { name: r.name, kind, conn: r.connections.length && !isPart(d) ? fill(D.conn, { list: connWords(t, r) }) : '' });
  const tails = isPart(d) ? D.tails.part : MEDIA.has(r.kind) ? D.tails.media : D.tails.record;
  for (const tail of tails) { const next = out + (t.lang === 'zh' ? '' : ' ') + tail; if (next.length <= D.max) out = next; }
  return out;
}

// ------------------------------------------------------------------ the snippet: one per kind, printing what it says it prints
const button = (label) => `const button = document.body.appendChild(Object.assign(document.createElement('button'), { textContent: ${JSON.stringify(label)} }));`;

/** The code a device page hands over, without the "// →" line (code), and with it (full). null when OAV has no code for it. */
export async function deviceSnippet(d) {
  const r = d.row, id = r.id, name = r.name;
  if (!d.offers.snippet) return null;
  const head = `import { device } from '${PKG}devices/index.js';`;
  const dev = await loadDevice(id);
  let lines, prints;
  if (isPart(d)) {
    lines = [head, '', `const part = await device('${id}');   // ${name}`, 'console.log(JSON.stringify(part.part.supply), Object.keys(part.part.pins).join(\' \'));'];
    prints = `${JSON.stringify(dev.part.supply)} ${Object.keys(dev.part.pins).join(' ')}`;
  } else if (r.kind === 'camera') {
    lines = [head, '', `const cam = await device('${id}');   // ${name}`, 'console.log(JSON.stringify(cam.constraints()));', `@@`,
      'const video = document.body.appendChild(Object.assign(document.createElement(\'video\'), { autoplay: true, muted: true, playsInline: true }));',
      button(name), 'button.onclick = async () => {', '  video.srcObject = await cam.open();   // asks once, finds it by its name, opens it', '};'];
    prints = JSON.stringify(dev.constraints());
  } else if (r.kind === 'audio-interface') {
    lines = [head, `import { Signals } from '${PKG}core/index.js';`, `import { AudioAnalyzer } from '${PKG}audio/index.js';`, '',
      `const input = await device('${id}');   // ${name}`, 'console.log(JSON.stringify(input.constraints()));', '@@',
      'const signals = new Signals();', button(name), 'button.onclick = async () => {',
      '  const stream = await input.open();   // asks once, finds it by its name, voice processing off',
      '  const a = new AudioAnalyzer({ signals });', '  a.input().context.createMediaStreamSource(stream).connect(a.input());',
      '  setInterval(() => { a.update(); console.log(\'audio/rms\', signals.get(\'audio/rms\')); }, 500);', '};'];
    prints = JSON.stringify(dev.constraints());
  } else if (r.kind === 'sensor' && d.record.use.some((u) => u.package === '@openav/leap')) {
    lines = [head, `import { Signals } from '${PKG}core/index.js';`, `import { LeapInput } from '${PKG}leap/index.js';`, '',
      `const leap = await device('${id}');   // ${name}`, 'console.log(leap.record.use.map((u) => u.package).join(\' \'));', '@@',
      'const signals = new Signals();', button('Connect the Leap bridge'), 'button.onclick = () => new LeapInput({ signals }).connect();   // the bridge on this computer: see Setup'];
    prints = dev.record.use.map((u) => u.package).join(' ');
  } else if (d.record.use.some((u) => u.sink === 'ddp')) {
    lines = [head, `import { OutClient } from '${PKG}out/client.js';`, '',
      `const strip = await device('${id}');   // ${name}`, 'console.log(strip.record.use.map((u) => `${u.package} ${u.sink}`).join(\', \'));', '@@',
      button('Pixel 0 red'), 'button.onclick = () => new OutClient({ url: \'ws://127.0.0.1:6450/out\' }).connect().set(\'light/0/r\', 1);   // through the out-bridge, out.json below'];
    prints = dev.record.use.map((u) => `${u.package} ${u.sink}`).join(', ');
  } else if (r.protocols.includes('enttec-usb-pro')) {
    lines = [head, `import { Patch, DmxEngine, dmxTransport } from '${PKG}dmx/index.js';`, '',
      `const pro = await device('${id}');   // ${name}`, 'console.log(pro.record.protocols.join(\' \'));', '@@',
      'const patch = new Patch();', 'patch.add({ id: \'par1\', profile: \'generic-rgbw\', mode: \'6ch\', address: 1 });',
      'const engine = new DmxEngine(patch);', 'engine.set(\'par1\', { dimmer: 1, color: [1, 0.5, 0] });',
      'const out = dmxTransport(\'serial\', { patch, universe: 1 });', button(`Connect the ${name}`),
      'button.onclick = async () => { await out.connect(); out.send(engine.render(0)); };   // the browser asks which port'];
    prints = dev.record.protocols.join(' ');
  } else {
    lines = [head, '', `const it = await device('${id}');   // ${name}`, 'console.log(it.record.use.map((u) => u.package).join(\' \'));', '@@'];
    prints = d.record.use.map((x) => x.package).join(' ');
  }
  const at = lines.indexOf('@@');
  const arrow = `// → ${prints}`;
  const full = (at >= 0 ? [...lines.slice(0, at), arrow, ...lines.slice(at + 1)] : [...lines, arrow]).join('\n');
  return { code: full, prints };
}

// ------------------------------------------------------------------ files to take away
/** The out-bridge routes in packages/out/bridge/out.example.json, by sink. */
function exampleRoutes() {
  const ex = JSON.parse(fs.readFileSync(path.join(ROOT, 'packages/out/bridge/out.example.json'), 'utf8'));
  return { routes: new Map(ex.channels.map((c) => [c.sink, c])), timeoutMs: ex.timeoutMs };
}

/** An out-bridge config for a device the bridge reaches (WLED over DDP, an Enttec DMX USB Pro), or null. */
export function bridgeConfig(d) {
  if (isPart(d) || !d.record.use) return null;
  const { routes, timeoutMs } = exampleRoutes();
  if (d.record.use.some((u) => u.sink === 'ddp')) {
    return { channels: [{ ...routes.get('ddp') }, { match: '*', sink: 'log' }], safe: { 'light/*': 0 }, timeoutMs };
  }
  if (d.record.use.some((u) => u.sink === 'enttec')) {
    const e = routes.get('enttec');
    return { channels: [{ match: 'dmx/1/*', sink: 'enttec', path: e.path, universe: 1 }, { match: '*', sink: 'log' }], safe: { 'dmx/*': 0 }, timeoutMs };
  }
  return null;
}

/** The part as one file: its library entry and its record. */
export const partFile = (d) => JSON.stringify({ format: 'open-audiovisual/hw-part@1', id: d.row.id, part: d.data, record: d.record }, null, 1) + '\n';

/** The files written beside a device page (its folder, English side): { name: text }. */
export function deviceFiles(d) {
  const out = {};
  if (isPart(d)) out[`${d.row.id}.json`] = partFile(d);
  const cfg = bridgeConfig(d);
  if (cfg) out['out.json'] = JSON.stringify(cfg, null, 1) + '\n';
  return out;
}

// ------------------------------------------------------------------ sections
function factsTable(t, d) {
  const F = t.device.facts, r = d.record, src = r.sources;
  const rows = r.data.facts.map((f) => {
    const s = src[f.source];
    const v = `${esc(valueText(f.value))}${f.unit ? ` ${esc(f.unit)}` : ''}${f.note ? `<small lang="en">${esc(f.note)}</small>` : ''}`;
    return `<tr><th scope="row">${esc(t.device.factNames[f.key] || f.key)}</th><td${t.lang === 'zh' ? ' lang="en"' : ''}>${v}</td><td>${s.url ? `<a href="${attr(s.url)}" rel="noopener"${isVendor(s) ? ' data-oav-link="vendor"' : ''}>${esc(s.title)}</a>` : esc(s.title)}</td></tr>`;
  });
  return `<div class="table-scroll" role="region" aria-label="${attr(fill(F.title, { name: d.row.name }))}" tabindex="0">
      <table class="facts-table">
        <thead><tr><th scope="col">${F.cols.fact}</th><th scope="col">${F.cols.value}</th><th scope="col">${F.cols.source}</th></tr></thead>
        <tbody>
        ${rows.join('\n        ')}
        </tbody>
      </table>
      </div>`;
}

function partFacts(t, d) {
  const P = t.device.part, p = d.data, rows = [];
  const num = (v) => (v === null || v === undefined ? P.unknown : v);
  if (p.supply) rows.push([P.facts.supply, fill(P.supplyText, { min: num(p.supply.min), max: num(p.supply.max), nominal: num(p.supply.nominal) })]);
  if (p.logic) {
    rows.push([P.facts.logic, fill(P.logicText, { v: num(p.logic.v), voh: num(p.logic.vohMin) })]);
    rows.push([P.facts.fiveVolt, p.logic.fiveVoltSafe === true ? P.yes : p.logic.fiveVoltSafe === false ? P.no : P.unknown]);
  }
  if (p.current) rows.push([P.facts.current, fill(P.currentText, { typ: num(p.current.typ), max: num(p.current.max) })]);
  if (p.perLed) rows.push([P.facts.perLed, fill(P.perLedText, { typ: num(p.perLed.typ), max: num(p.perLed.max) })]);
  if (p.leds) rows.push([P.facts.leds, p.leds]);
  if (p.mAh) rows.push([P.facts.mAh, `${Array.isArray(p.mAh) ? p.mAh.join(' / ') : p.mAh} mAh`]);
  if (p.resistance) rows.push([P.facts.resistance, `${p.resistance} Ω`]);
  if (p.i2c && p.i2c.addr) rows.push([P.facts.i2c, p.i2c.addr.map((a) => '0x' + Number(a).toString(16).toUpperCase().padStart(2, '0')).join(', ')]);
  if (p.size) rows.push([P.facts.size, ['w', 'h', 'd'].map((k) => num(p.size[k])).join(' × ') + ' mm']);
  if (p.connector) rows.push([P.facts.connector, `<span lang="zh-Hant">${esc(p.connector)}</span>`]);
  return rows;
}

function pinsTable(t, d) {
  const P = t.device.part, pins = d.data.pins || {};
  const volts = (x) => (x.v !== undefined ? `${x.v} V${x.when ? ` (${esc(x.when)})` : ''}` : x.vmax !== undefined ? `≤ ${x.vmax} V` : '');
  const limit = (x) => [x.limitMa !== undefined && x.limitMa !== null ? `≤ ${x.limitMa} mA` : x.limitMa === null ? P.unknown : '', x.recMa ? `(${x.recMa} mA)` : ''].filter(Boolean).join(' ');
  return `<div class="table-scroll" role="region" aria-label="${attr(fill(P.title, { name: d.row.name }))}" tabindex="0">
      <table class="pins-table">
        <thead><tr>${['pin', 'kind', 'label', 'volts', 'limit', 'also', 'note'].map((k) => `<th scope="col">${P.cols[k]}</th>`).join('')}</tr></thead>
        <tbody>
        ${Object.entries(pins).map(([k, x]) => `<tr><th scope="row"><code>${esc(k)}</code></th><td>${esc(P.kinds[x.kind] || x.kind)}</td><td>${esc(x.label || '')}</td><td>${volts(x)}</td><td>${limit(x)}</td><td>${esc((x.aliases || []).join(', '))}</td><td>${x.note ? `<span lang="zh-Hant">${esc(x.note)}</span>` : ''}</td></tr>`).join('\n        ')}
        </tbody>
      </table>
      </div>`;
}

const pairs = (t, list) => list.map((x) => esc(x[t.lang === 'zh' ? 'zh' : 'en']));

// ------------------------------------------------------------------ the page
/**
 * @param d     one entry of collection(): a hand-written record or a part, with a page
 * @param ctx   { pages: every device-page entry (for related) }
 */
export async function renderDevice(t, home, locale, d, ctx) {
  const T = t.device, r = d.row, rec = d.record, id = r.id, name = r.name, part = isPart(d);
  const c = pathCtx(d.page, locale, { page: 'devices' });
  const title = titleOf(t, d), description = descriptionOf(t, d);
  const hubUrl = SITE + (locale === 'zh' ? 'zh/' : '') + HUB_PATH;
  const kind = part ? (t.partKinds[d.data.kind] || d.data.kind) : kindWord(t, r.kind);
  const snip = await deviceSnippet(d);
  const files = deviceFiles(d);
  const recordRel = part ? null : `packages/${d.file}`;
  const fileHref = (f) => `${c.root}${d.page}${f}`;   // files sit beside the English page; both languages link to them
  const conn = r.connections.length && !part ? fill(T.conn, { list: esc(connWords(t, r)) }) : '';
  const lede = part ? fill(T.lede.part, { name: esc(name), kind: esc(kind) }) : fill(T.lede.record, { name: esc(name), a: article(kind), kind: esc(kind), conn });
  const ex = exampleById.get(DMX_EXAMPLE);

  // hero facts
  const facts = [
    [t.fixture.facts.kind, esc(kind)],
    ...(r.manufacturer ? [[t.fixture.facts.maker, esc(r.manufacturer)]] : []),
    ...(!part && r.connections.length ? [[T.connect.connections, esc(connWords(t, r))]] : []),
    ...(r.protocols.length ? [[T.connect.protocols, esc(r.protocols.map(protocolName).join(' · '))]] : []),
    [t.fixture.facts.license, esc(rec.license)],
    [t.fixture.facts.verified, rec.verified ? t.verified.yes : t.verified.no],
  ];

  // the live helper / the frame (behind buttons, built by assets/devices/device.js)
  const L = T.live;
  const mediaKind = r.kind === 'camera' ? 'camera' : r.kind === 'audio-interface' ? 'audio' : null;
  const live = mediaKind ? `<section class="sec" id="try" aria-labelledby="try-title">
    ${sec('try', L.eyebrow, fill(L.title, { name: esc(name) }), fill(L.lede, { inputs: L.inputs[mediaKind] }))}
    <div class="live js-only" id="live" data-device="${id}" data-input="${mediaKind}">
      <div class="vf-row"><button type="button" class="vf-btn" id="live-find">${L.find}</button><button type="button" class="vf-btn vf-go" id="live-open">${L.open}</button><button type="button" class="vf-btn" id="live-stop" disabled>${L.stop}</button></div>
      <p class="vf-note" id="live-status" role="status"></p>
      ${mediaKind === 'camera' ? '<video id="live-video" class="live-video" playsinline muted hidden></video>' : `<div class="live-meter" id="live-meter" hidden><span class="vfx-k">${L.level}</span><meter id="live-level" min="0" max="1" value="0"></meter></div>`}
      <dl class="d-facts live-settings" id="live-settings" hidden></dl>
    </div>
  </section>` : '';
  const frame = !part && r.protocols.includes('enttec-usb-pro') ? `<section class="sec" id="try" aria-labelledby="try-title">
    ${sec('try', T.frame.eyebrow, fill(T.frame.title, { name: esc(name) }), T.frame.lede)}
    <div class="frame js-only" id="frame">
      <div class="vfx-sliders">${[1, 2, 3].map((n) => `<label class="vfx-slider"><span>${fill(T.frame.ch, { n })}</span><input type="range" min="0" max="255" step="1" value="${[255, 128, 0][n - 1]}" data-ch="${n}"><output>${[255, 128, 0][n - 1]}</output></label>`).join('')}</div>
      <p class="vfx-k" id="frame-len" data-tpl="${attr(T.frame.bytes)}"></p>
      <pre class="frame-bytes" id="frame-bytes"><code></code></pre>
      <p class="note">${T.frame.parts}</p>
    </div>
  </section>` : '';

  // JSON-LD
  const thing = r.manufacturer && !part
    ? { '@type': 'Product', '@id': c.self + '#product', name, brand: { '@type': 'Brand', name: r.manufacturer }, category: kindWord(t, r.kind), description }
    : { '@type': 'Thing', '@id': c.self + '#product', name, description: kind };
  const dataUrl = part ? SITE + d.page + `${id}.json` : SITE + recordRel;
  const ld = [
    breadcrumbNode(c, [[t.crumbs.home, homeUrl(c)], [t.crumbs.devices, hubUrl], [name, c.self]]),
    pageNode(c, home, { name: title, description, image: OG_IMAGE, breadcrumb: { '@id': c.self + '#breadcrumb' }, about: { '@id': c.self + '#product' }, mainEntity: { '@id': c.self + '#dataset' } }),
    thing,
    {
      '@type': 'Dataset', '@id': c.self + '#dataset', name: `${name}: ${part ? 'pins and ratings' : 'device record'}`, description, url: c.self, inLanguage: home.ldLanguage,
      license: 'https://opensource.org/licenses/MIT', isAccessibleForFree: true, creator: { '@id': PERSON_ID }, isPartOf: { '@id': hubUrl + '#dataset' }, about: { '@id': c.self + '#product' },
      keywords: [name, kind, ...r.protocols.map(protocolName), ...(r.manufacturer ? [r.manufacturer] : [])],
      distribution: [{ '@type': 'DataDownload', name: part ? `${id}.json` : d.file.split('/').pop(), encodingFormat: 'application/json', contentUrl: dataUrl }],
      citation: rec.sources.map((s) => ({ '@type': 'CreativeWork', name: s.title, ...(s.url ? { url: s.url } : {}) })),
    },
    { '@type': 'Dataset', '@id': hubUrl + '#dataset', name: t.hub.meta.ldName, url: hubUrl, isPartOf: { '@id': SOFTWARE_ID } },
  ];

  // body sections
  const factsSec = part
    ? `<section class="sec" id="facts" aria-labelledby="facts-title">
    ${sec('facts', T.facts.eyebrow, fill(T.facts.title, { name: esc(name) }), T.facts.ledePart)}
    <dl class="d-facts part-facts">
      ${partFacts(t, d).map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('\n      ')}
    </dl>
  </section>

  <section class="sec" id="pins" aria-labelledby="pins-title">
    ${sec('pins', T.part.eyebrow, fill(T.part.title, { name: esc(name) }))}
    ${pinsTable(t, d)}
    ${(d.data.notes || []).length ? `<h3>${T.part.notes}</h3><p class="note">${T.part.zhNote}</p><ul class="cnotes" lang="zh-Hant">${d.data.notes.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
    ${d.data.boot ? `<ul class="cnotes" lang="zh-Hant">${Object.entries(d.data.boot).map(([k, x]) => `<li><code>${esc(k)}</code> ${esc(x)}</li>`).join('')}</ul>` : ''}
    <p class="next-links"><a class="more" href="${c.to('docs', '#packages-openav-hw')}">${T.part.hwDocs} →</a> <a class="more" href="${c.to('docs', '#devices-a-part')}">${T.part.partDocs} →</a></p>
  </section>`
    : `<section class="sec" id="facts" aria-labelledby="facts-title">
    ${sec('facts', T.facts.eyebrow, fill(T.facts.title, { name: esc(name) }), T.facts.lede)}
    ${factsTable(t, d)}
  </section>

  <section class="sec" id="connect" aria-labelledby="connect-title">
    ${sec('connect', T.connect.eyebrow, T.connect.title)}
    <div class="spec-grid">
      <div><h3>${T.connect.connections}</h3><p>${r.connections.length ? esc(r.connections.map((x) => t.connections[x] || x).join(' · ')) : T.connect.none}</p></div>
      <div><h3>${T.connect.protocols}</h3><p>${r.protocols.length ? esc(r.protocols.map(protocolName).join(' · ')) : T.connect.none}</p></div>
      ${rec.media ? `<div><h3>${L.settings}</h3><p><code>${esc(JSON.stringify(rec.media.constraints))}</code></p></div>` : ''}
    </div>
  </section>

  <section class="sec" id="setup" aria-labelledby="setup-title">
    ${sec('setup', T.setup.eyebrow, T.setup.title)}
    ${rec.setup.length ? `<ol class="steps">${rec.setup.map((x) => { const s = rec.sources[x.source]; return `<li>${esc(x[t.lang === 'zh' ? 'zh' : 'en'])} <span class="src-note"><a href="${attr(s.url || '#')}" rel="noopener">${esc(s.title)}</a></span></li>`; }).join('')}</ol>` : ''}
    <h3>${T.setup.problems}</h3>
    ${rec.problems.length ? `<ul class="cnotes">${rec.problems.map((x) => { const s = rec.sources[x.source]; return `<li>${esc(x[t.lang === 'zh' ? 'zh' : 'en'])} <span class="src-note"><a href="${attr(s.url || '#')}" rel="noopener">${esc(s.title)}</a></span></li>`; }).join('')}</ul>` : `<p>${T.setup.noProblems}</p>`}
  </section>`;

  const useSec = `<section class="sec" id="use" aria-labelledby="use-title">
    ${sec('use', T.use.eyebrow, fill(T.use.title, { name: esc(name) }), snip ? (part ? T.use.ledePart : T.use.lede) : '')}
    ${snip ? term(home, 'javascript', 'snip-device', snip.code, 'code') : `<p class="note">${T.use.none}</p>`}
    ${rec.use ? `<h3>${T.use.calls}</h3>
    <ul class="uses">${rec.use.map((u) => `<li><p><code>${esc(u.package)}</code> · <code>${esc(u.entry)}</code>${u.sink ? ` · sink <code>${esc(u.sink)}</code>` : ''}</p><pre><code>${esc(u.call)}</code></pre><p>${esc(u[t.lang === 'zh' ? 'zh' : 'en'])}</p></li>`).join('')}</ul>` : ''}
  </section>`;

  const fileLinks = [
    ...(part ? [`<div><p>${T.files.part}</p><div class="vf-row"><a class="vf-btn" href="${fileHref(`${id}.json`)}" download="${id}.json" data-oav-event="export_download" data-oav-format="json" data-oav-id="${id}">${id}.json</a></div></div>`]
      : [`<div><p>${T.files.record}</p><div class="vf-row"><a class="vf-btn" href="${c.root}${recordRel}" download="${attr(d.file.split('/').pop())}" data-oav-event="export_download" data-oav-format="json" data-oav-id="${id}">${esc(d.file.split('/').pop())}</a></div></div>`]),
    ...(files['out.json'] ? [`<div><p>${T.files.bridge}</p><div class="vf-row"><a class="vf-btn" href="${fileHref('out.json')}" download="out.json" data-oav-event="export_download" data-oav-format="json" data-oav-id="${id}">out.json</a></div></div>`] : []),
  ];
  const filesSec = `<section class="sec" id="files" aria-labelledby="files-title">
    ${sec('files', T.files.eyebrow, T.files.title)}
    <div class="spec-grid">${fileLinks.join('')}</div>
    <ul class="model-links">
      <li><a href="${c.root}${SCHEMA_DEVICE}">${T.files.schema}</a></li>
      <li><a href="${BLOB}packages/${d.file}">${T.files.github} ↗</a></li>
    </ul>
  </section>`;

  const tbd = part ? (d.data.tbd || []).map((x) => `<li lang="zh-Hant">${esc(x)}</li>`) : (rec.tbd || []).map((x) => `<li>${esc(x[t.lang === 'zh' ? 'zh' : 'en'])}</li>`);
  const notes = part ? [] : pairs(t, rec.notes || []);
  const statusSec = `<section class="sec" id="status" aria-labelledby="status-title">
    ${sec('status', T.status.eyebrow, T.status.title)}
    <p>${rec.verified ? fill(T.status.verified, { n: rec.verifications.length }) : T.status.unverified}</p>
    ${notes.length ? `<h3>${T.status.notes}</h3><ul class="cnotes">${notes.map((x) => `<li>${x}</li>`).join('')}</ul>` : ''}
    ${tbd.length ? `<h3>${t.tbdTitle}</h3><ul class="cnotes tbd">${tbd.join('')}</ul>` : ''}
    <h3>${t.sourcesTitle}</h3>
    <ul class="sources">${rec.sources.map((s) => sourceItem(t, s, { vendor: isVendor(s) })).join('')}</ul>
  </section>`;

  const others = ctx.pages.filter((x) => x !== d);
  const rel = [...others.filter((x) => x.row.kind === r.kind && isPart(x) === part && (!part || x.data.kind === d.data.kind)), ...others.filter((x) => isPart(x) === part && !(x.row.kind === r.kind && (!part || x.data.kind === d.data.kind))), ...others.filter((x) => isPart(x) !== part)].slice(0, 6);
  const mainPkg = (rec.use && rec.use.find((u) => u.package !== '@openav/devices')) || (rec.use && rec.use[0]);
  const pkgAnchor = part ? 'packages-openav-hw' : (mainPkg && PKG_DOC[mainPkg.package]) || 'packages';
  const dmxish = r.protocols.some((p) => ['dmx512', 'art-net', 'e1.31', 'ddp'].includes(p));

  const runtime = { device: id, input: mediaKind, copy: home.ui.copy, copied: home.ui.copied, live: L, frame: frame ? T.frame : null };
  const head = headBasics(home, c, { title, description, ogImage: OG_IMAGE, robots: 'index, follow, max-image-preview:large, max-snippet:-1', ld, pageType: 'device', pageId: id });
  return guardEmail(`<!DOCTYPE html>
<html lang="${t.htmlLang}">
<head>
${head}
<link rel="alternate" type="application/json" href="${part ? fileHref(`${id}.json`) : c.root + recordRel}" title="${attr(name)} (JSON)">
<link rel="stylesheet" href="${c.root}assets/controllers/controllers.css">
<link rel="stylesheet" href="${c.root}assets/devices/devices.css">
<noscript><style>.js-only { display: none !important; }</style></noscript>
</head>
<body class="page-controllers page-controller page-device">
${topBar(home, c)}

<main id="main">
  <section class="ch-hero" id="about" aria-labelledby="about-title">
    <nav class="crumbs" aria-label="${attr(t.crumbs.label)}">
      <ol>
        <li><a href="${c.to('home')}">${t.crumbs.home}</a></li>
        <li><a href="${c.root}${locale === 'zh' ? 'zh/' : ''}${HUB_PATH}#kind-${r.kind}">${t.crumbs.devices}</a></li>
        <li aria-current="page">${esc(name)}</li>
      </ol>
    </nav>
    <p class="eyebrow">${esc(kind)}</p>
    <h1 id="about-title">${esc(name)}</h1>
    <div class="hero-cols">
      <div class="lede d-lede">
        <p>${lede}</p>
        ${r.aliases.length ? `<p class="dev-al">${T.aliases}: ${esc(r.aliases.join(' · '))}</p>` : ''}
        <ul class="badges"><li class="b-gen">${part ? t.origin.library : t.origin.record}</li><li class="b-unv">${rec.verified ? t.verified.yes : t.verified.no}</li></ul>
      </div>
      <div class="hero-facts">
        <dl class="d-facts">
          ${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('\n          ')}
        </dl>
      </div>
    </div>
  </section>

  ${live}${frame}

  ${factsSec}

  ${useSec}

  ${filesSec}

  ${statusSec}

  <section class="sec" id="related" aria-labelledby="related-title">
    ${sec('related', t.more.related, T.related.title)}
    <ul class="rel" aria-label="${attr(t.more.relatedLabel)}">
      ${rel.map((x) => `<li><a href="../${x.row.id}/">${esc(x.row.name)}</a><span>${esc(isPart(x) ? (t.partKinds[x.data.kind] || x.data.kind) : kindWord(t, x.row.kind))}</span></li>`).join('\n      ')}
    </ul>
    <p class="cmp-link"><a href="${c.root}${locale === 'zh' ? 'zh/' : ''}${HUB_PATH}#kind-${r.kind}">${t.more.back} →</a></p>
  </section>

  ${reportBlock(t, name, id, `packages/${d.file}`)}

  <section class="sec next-step" id="next-step" aria-labelledby="next-step-title">
    ${sec('next-step', home.next.label, T.nextTitle, fill(T.nextLede, { name: esc(name) }))}
    <p class="next-links">${nextLink(c.to('docs', '#devices'), 'docs', `${T.nextDocs} →`)} ${nextLink(c.to('docs', '#' + pkgAnchor), 'docs', `${esc(fill(T.nextPkg, { pkg: part ? '@openav/hw' : mainPkg ? mainPkg.package : '@openav/devices' }))} →`)}${dmxish ? ` ${nextLink(`${c.root}${ex.dir}`, 'example', `${esc(fill(T.nextExample, { num: ex.num, title: pick(ex.title, locale) }))} →`)}` : ''}</p>
  </section>

</main>

${siteFooter(home, c)}

<script type="application/json" id="dev-data">${JSON.stringify(runtime).replace(/</g, '\\u003c')}</script>
<script type="module" src="${c.root}assets/devices/device.js"></script>
</body>
</html>
`);
}
