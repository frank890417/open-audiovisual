// What the three device templates share (tools/devices/hub.mjs, fixture.mjs, device.mjs): the section header, a code block
// with its Copy button, names for protocols, plural words, the "report wrong data" block. No strings of its own: the words come
// from en.mjs / zh.mjs and the homepage tables.

import { SITE, REPO, BLOB, esc, attr } from '../site/chrome.mjs';
import { hl } from '../../assets/controllers/snippets.js';
import { fill } from '../controllers/page.mjs';

export { fill, esc, attr, hl, SITE, REPO, BLOB };
export const OG_IMAGE = SITE + 'assets/home/og.png';
/** Where a snippet loads the packages from: this site, so it runs pasted into any page. The tests swap it for the local files. */
export const PKG = SITE + 'packages/';
export const SCHEMA_FIXTURE = 'packages/dmx/fixtures/fixture.schema.json';
export const SCHEMA_DEVICE = 'packages/devices/device.schema.json';
export const OFL_SITE = 'https://open-fixture-library.org/';

/** How a protocol id of a record is written for people (the same in both languages). */
export const PROTOCOL_NAMES = {
  midi: 'MIDI', dmx512: 'DMX512', rdm: 'RDM', 'enttec-usb-pro': 'ENTTEC USB Pro API', 'art-net': 'Art-Net', 'e1.31': 'sACN (E1.31)', ddp: 'DDP', 'tpm2.net': 'TPM2.net',
  'udp-realtime': 'WLED UDP realtime', http: 'HTTP', 'json-api': 'JSON API', mqtt: 'MQTT', uvc: 'USB Video Class (UVC)', 'usb-audio-class-2': 'USB Audio Class 2.0', dante: 'Dante',
  raster: 'Raster', 'esc-p': 'ESC/P', 'p-touch-template': 'P-touch Template', airprint: 'AirPrint', i2c: 'I²C', spi: 'SPI',
};
export const protocolName = (p) => PROTOCOL_NAMES[p] || p;

/** "a, b and c" in English, "a、b、c" in Chinese. */
export const listText = (t, arr) => (t.lang === 'zh' ? arr.join(t.sep) : arr.length < 2 ? arr.join('') : arr.slice(0, -1).join(t.sep) + t.and + arr[arr.length - 1]);
/** One of a [singular, plural] pair. */
export const plural = (pair, n) => pair[n === 1 ? 0 : 1];
/** A kind as a word: kindWord(t, 'dmx-fixture', 2) → "DMX fixtures". */
export const kindWord = (t, kind, n = 1) => plural(t.kinds[kind], n);

/** The section header every page of the site uses (.sec-head). */
export const sec = (sid, eyebrow, ttl, lede = '') => `
    <header class="sec-head">
      <p class="eyebrow">${eyebrow}</p>
      <h2 id="${sid}-title">${ttl}</h2>${lede ? `\n      <p class="sec-lede">${lede}</p>` : ''}
    </header>`;

/** A code block with a Copy button (assets/devices/*.js copies it; assets/track.js counts the copy). */
export const term = (home, label, cid, code, kind) => `<div class="term"><div class="term-bar"><span>${esc(label)}</span><button type="button" class="copy" data-copy="${cid}"${kind ? ` data-oav-copy="${kind}"` : ''}>${home.ui.copy}</button></div><pre id="${cid}"><code>${hl(code)}</code></pre></div>`;

/** A source as a link with its title (and the day it was read, for a hand-written record). A maker's page counts as vendor. */
export function sourceItem(t, s, { vendor = false } = {}) {
  const read = s.read ? ` <span class="src-note">${esc(fill(t.readOn, { date: s.read }))}</span>` : '';
  const note = s.note ? ` <span class="src-note">${esc(s.note)}</span>` : '';
  return `<li>${s.url ? `<a href="${attr(s.url)}" rel="noopener"${vendor ? ' data-oav-link="vendor"' : ''}>${esc(s.title)}</a>` : esc(s.title)}${read}${note}</li>`;
}

/** A source of a hand-written record is the maker's own page unless it is this project's (the repository or the handbook). */
export const isVendor = (s) => !!s.url && !/openaudiovisual\.com|github\.com\/frank890417\/open-audiovisual/.test(s.url);

/** "Wrong data?": an issue with the device's name, and the file it comes from. */
export function reportBlock(t, name, id, rel) {
  const R = t.report;
  const issue = `${REPO}/issues/new?title=${encodeURIComponent(fill(R.issueTitle, { name, id }))}`;
  return `<section class="sec" id="report" aria-labelledby="report-title">
    ${sec('report', 'GitHub', R.title, R.text)}
    <ul class="model-links">
      <li><a href="${issue}">${R.issue} ↗</a></li>
      <li><a href="${BLOB}${rel}">${R.file} ↗</a></li>
    </ul>
  </section>`;
}

/** The copy-button wiring and nothing else, for a page with no other script (inline, so it needs no file). */
export const COPY_SCRIPT = `document.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('.copy[data-copy]');if(!b)return;var p=document.getElementById(b.getAttribute('data-copy'));if(!p)return;var t=p.textContent,l=b.textContent,d=function(){b.textContent=b.getAttribute('data-done-label')||'Copied';b.setAttribute('data-done','');setTimeout(function(){b.textContent=l;b.removeAttribute('data-done')},1400)};if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(t).then(d,function(){});});`;
