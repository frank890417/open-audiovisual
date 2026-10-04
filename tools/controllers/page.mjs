// The /controllers/ template — one structure, rendered once per language by
// tools/build-controllers.mjs (strings: en.mjs / zh.mjs). Everything that must
// not drift between languages lives HERE: section order, ids, links, code.
//
// Every device fact on the page comes from packages/midi/profiles/*.json at
// build time (through PROFILES, the list profiles/index.js registers): counts,
// tables, sources, the static faceplates. Nothing is hand-copied, so a new
// profile appears on the page by being registered — no edit here.
//
// Output is static HTML on purpose: crawlers and AI agents read every device's
// full MIDI map without running JavaScript. assets/controllers/controllers.js
// only brings it to life (the live controller, lazy live cards, the builder).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SITE, REPO, BLOB, TREE, pageCtx, headBasics, topBar, siteFooter, esc, attr } from '../site/chrome.mjs';
import { PROFILES } from '../../packages/midi/profiles/index.js';
import { normalizeProfile } from '../../packages/midi/profiles.js';
import { CONTROL_COLORS } from '../../packages/midi/view.js';
import { snippets, hl } from '../../assets/controllers/snippets.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PROFILE_DIR = 'packages/midi/profiles';
export const HERO_DEFAULT = 'arturia-minilab3';
export const BUILDER_DEFAULT = 'akai-lpd8';
export const SECTIONS = ['play', 'catalog', 'specs', 'embed', 'model'];
const TYPE_ORDER = ['pad', 'keys', 'knob', 'encoder', 'fader', 'button', 'strip', 'wheel'];
const FILTERS = ['all', 'pad', 'keys', 'knob', 'fader', 'encoder', 'led'];
const NOTE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const noteName = (n) => NOTE[((n % 12) + 12) % 12] + (Math.floor(n / 12) - 1);
const fill = (s, o) => String(s).replace(/\{(\w+)\}/g, (m, k) => (k in o ? o[k] : m));
const num = (v) => String(+v.toFixed(2));

// ------------------------------------------------------------------ data
/** id → file name in packages/midi/profiles/ (read from disk, so a renamed file cannot break a link). */
export function profileFiles() {
  const map = {};
  for (const f of fs.readdirSync(path.join(ROOT, PROFILE_DIR))) {
    if (!f.endsWith('.json')) continue;
    try { const j = JSON.parse(fs.readFileSync(path.join(ROOT, PROFILE_DIR, f), 'utf8')); if (j && j.id) map[j.id] = f; } catch { /* not a profile */ }
  }
  return map;
}

const physical = (c) => (c.type === 'keys' ? c.to - c.from + 1 : 1);
const isTool = (s) => /\.(tox|toe)\b/i.test(s.title || '');
const isCommunity = (s) => /non-official|community/i.test(`${s.title || ''} ${s.note || ''}`);
export function sourceKind(s, p) {
  if (p.kind === 'generic') return 'convention';
  if (isTool(s)) return 'tool';
  if (isCommunity(s)) return 'community';
  return s.url ? 'maker' : 'tool';
}

/** Everything the page says about one profile, derived from its JSON. */
export function describeProfile(raw, i, files) {
  const p = normalizeProfile(raw);
  const counts = new Map();
  for (const c of p.controls) counts.set(c.type, (counts.get(c.type) || 0) + physical(c));
  const sources = p.sources || [];
  const prov = {
    maker: p.kind === 'device' && sources.some((s) => sourceKind(s, p) === 'maker'),
    community: sources.some((s) => sourceKind(s, p) === 'community'),
    tool: p.origin && p.origin.tool ? p.origin.tool : sources.some(isTool) ? 'TouchDesigner' : null,
    generic: p.kind === 'generic',
    unverified: p.controls.filter((c) => c.verified === false).reduce((a, c) => a + physical(c), 0),
    led: p.controls.some((c) => c.led),
  };
  const has = TYPE_ORDER.filter((t) => counts.has(t));
  if (prov.led) has.push('led');
  return { p, raw, i, file: files[p.id] || `${p.id}.json`, counts, prov, has, total: [...counts.values()].reduce((a, b) => a + b, 0) };
}

export function catalog() {
  const files = profileFiles();
  const all = PROFILES.map((raw, i) => describeProfile(raw, i, files));
  const devices = all.filter((x) => x.p.kind === 'device').sort((a, b) => String(a.p.maker || '').localeCompare(String(b.p.maker || ''), 'en') || a.i - b.i);
  const generic = all.filter((x) => x.p.kind !== 'device');
  const seen = new Set();
  for (const d of devices) for (const s of d.p.sources) seen.add(`${s.title}|${s.url || ''}`);
  const stats = {
    devices: devices.length,
    generic: generic.length,
    controls: devices.reduce((a, d) => a + d.total, 0),
    sources: seen.size,
    unverified: devices.reduce((a, d) => a + d.prov.unverified, 0),
  };
  return { all, devices, generic, stats, byId: new Map(all.map((x) => [x.p.id, x])) };
}

const nameOf = (p, locale) => (locale === 'zh' ? p.name : p.nameEn || p.name);
const countsText = (t, d) => TYPE_ORDER.filter((k) => d.counts.has(k)).map((k) => { const n = d.counts.get(k); return fill(t.types[k][n === 1 ? 0 : 1], { n }); }).join(' · ');

// ------------------------------------------------------------------ the static faceplate (SVG)
// Drawn from the same sections / grid / spans the live view uses, in face units, so the
// static picture and the live component line up. It is what no-JS readers, crawlers and
// the first paint see; controllers.js swaps the live component in on top.
const GAP = 0.7, LBL = 1.7;

/** CSS-grid-like auto placement (row or column flow, spans): id → {col, row, cs, rs}. */
export function placeSection(s) {
  const occ = new Set(), out = new Map();
  const colFlow = s.flow === 'column';
  let cursor = 0;
  for (const id of s.controls) {
    const [cs, rs] = (s.spans && s.spans[id]) || [1, 1];
    for (let i = cursor; i < s.cols * s.rows * 4; i++) {
      const col = colFlow ? Math.floor(i / s.rows) : i % s.cols;
      const row = colFlow ? i % s.rows : Math.floor(i / s.cols);
      if (col + cs > s.cols || row + rs > s.rows) continue;
      let free = true;
      for (let a = 0; a < cs && free; a++) for (let b = 0; b < rs && free; b++) if (occ.has(`${col + a},${row + b}`)) free = false;
      if (!free) continue;
      for (let a = 0; a < cs; a++) for (let b = 0; b < rs; b++) occ.add(`${col + a},${row + b}`);
      out.set(id, { col, row, cs, rs });
      cursor = i + 1;
      break;
    }
  }
  return out;
}

function svgControl(c, x, y, w, h) {
  const col = c.tint || CONTROL_COLORS[c.color] || CONTROL_COLORS.cyan;
  const label = (cx, ly) => (c.label ? `<text class="fp-cl" x="${num(cx)}" y="${num(ly)}">${esc(String(c.label).slice(0, 10))}</text>` : '');
  switch (c.type) {
    case 'knob': case 'encoder': {
      const ah = Math.max(1, h - LBL), r = Math.max(0.4, (Math.min(w, ah) / 2) * 0.84), cx = x + w / 2, cy = y + ah / 2;
      const endless = c.type === 'encoder' && c.relative;
      const a = endless ? 0 : (-135 * Math.PI) / 180, dx = Math.sin(a), dy = -Math.cos(a);
      return `<circle class="fp-ring${endless ? ' fp-endless' : ''}" cx="${num(cx)}" cy="${num(cy)}" r="${num(r)}" stroke="${col}"/>`
        + `<circle class="fp-cap" cx="${num(cx)}" cy="${num(cy)}" r="${num(r * 0.7)}"/>`
        + `<line class="fp-ptr" x1="${num(cx + dx * r * 0.25)}" y1="${num(cy + dy * r * 0.25)}" x2="${num(cx + dx * r * 0.66)}" y2="${num(cy + dy * r * 0.66)}"/>`
        + label(cx, y + h - 0.3);
    }
    case 'fader': {
      const ah = Math.max(1, h - LBL), cx = x + w / 2, cw = Math.min(w * 0.8, 4.6);
      return `<rect class="fp-slot" x="${num(cx - 0.4)}" y="${num(y + 0.6)}" width="0.8" height="${num(Math.max(0.5, ah - 1.2))}" rx="0.4"/>`
        + `<rect class="fp-fcap" x="${num(cx - cw / 2)}" y="${num(y + ah - 1.9)}" width="${num(cw)}" height="1.6" rx="0.3"/>`
        + label(cx, y + h - 0.3);
    }
    case 'pad':
      return `<rect class="fp-pad" x="${num(x)}" y="${num(y)}" width="${num(w)}" height="${num(h)}" rx="${num(Math.min(w, h) * 0.1)}" fill="${col}"/>`;
    case 'button': {
      if (c.shape === 'round') { const r = Math.min(w, h) / 2 * 0.8; return `<circle class="fp-btn" cx="${num(x + w / 2)}" cy="${num(y + h / 2)}" r="${num(r)}"/>`; }
      const bh = Math.min(h, 5), by = y + (h - bh) / 2;
      const t = c.label && String(c.label).length <= 3 ? `<text class="fp-bl" x="${num(x + w / 2)}" y="${num(by + bh / 2 + 0.45)}">${esc(c.label)}</text>` : '';
      return `<rect class="fp-btn" x="${num(x)}" y="${num(by)}" width="${num(w)}" height="${num(bh)}" rx="${num(Math.min(w, bh) * 0.15)}"/>${t}`;
    }
    case 'wheel': case 'strip': {
      const ah = Math.max(1, h - LBL), sw = Math.min(w * 0.72, 4.2), cx = x + w / 2, ty = c.bipolar ? y + ah / 2 : y + ah - 0.8;
      return `<rect class="fp-strip" x="${num(cx - sw / 2)}" y="${num(y)}" width="${num(sw)}" height="${num(ah)}" rx="${num(Math.min(sw, ah) * 0.18)}"/>`
        + `<rect class="fp-thumb" x="${num(cx - sw / 2 + 0.3)}" y="${num(ty - 0.35)}" width="${num(Math.max(0.2, sw - 0.6))}" height="0.7" rx="0.35" fill="${col}"/>`
        + label(cx, y + h - 0.3);
    }
    case 'keys': {
      const white = [], black = [];
      let wi = 0;
      const whites = [];
      for (let n = c.from; n <= c.to; n++) if (![1, 3, 6, 8, 10].includes(n % 12)) whites.push(n);
      const ww = w / whites.length;
      for (let n = c.from; n <= c.to; n++) {
        const isBlack = [1, 3, 6, 8, 10].includes(n % 12);
        if (!isBlack) { white.push(`<rect class="fp-kw" x="${num(x + wi * ww)}" y="${num(y)}" width="${num(ww)}" height="${num(h)}"/>`); wi++; }
        else if (wi > 0) black.push(`<rect class="fp-kb" x="${num(x + wi * ww - ww * 0.31)}" y="${num(y)}" width="${num(ww * 0.62)}" height="${num(h * 0.6)}"/>`);
      }
      return white.join('') + black.join('');
    }
  }
  return '';
}

function svgDeco(d) {
  const box = `x="${num(d.x)}" y="${num(d.y)}" width="${num(d.w)}" height="${num(d.h)}"`;
  switch (d.type) {
    case 'screen': return `<rect class="fp-screen" ${box} rx="0.5"/><text class="fp-st" x="${num(d.x + d.w / 2)}" y="${num(d.y + d.h / 2 + 0.5)}">${esc(d.text || '')}</text>`;
    case 'logo': return `<rect class="fp-logo" ${box} rx="0.5"/>`;
    case 'buttons': {
      const items = d.items || [], gap = 0.6, bw = (d.w - gap * (items.length - 1)) / Math.max(1, items.length);
      return items.map((t, i) => `<rect class="fp-btn" x="${num(d.x + i * (bw + gap))}" y="${num(d.y)}" width="${num(bw)}" height="${num(d.h)}" rx="0.4"/><text class="fp-bl fp-small" x="${num(d.x + i * (bw + gap) + bw / 2)}" y="${num(d.y + d.h / 2 + 0.35)}">${esc(t)}</text>`).join('');
    }
    case 'label': return `<text class="fp-sl" x="${num(d.x)}" y="${num(d.y + d.h / 2 + 0.4)}">${esc(String(d.text || '').toUpperCase())}</text>`;
  }
  return '';
}

/** The faceplate as a static SVG (face units; scales to its box). */
export function faceSvg(p, title) {
  const f = p.face, out = [];
  out.push(`<rect class="fp-body" width="${num(f.w)}" height="${num(f.h)}" rx="${num(Math.min(f.w, f.h) * 0.035)}"${f.body ? ` fill="${attr(f.body)}"` : ''}/>`);
  if (f.label) out.push(`<text class="fp-fl" x="2" y="${num(Math.min(2.6, f.h * 0.09))}">${esc(String(f.label).toUpperCase())}</text>`);
  for (const d of f.deco || []) out.push(svgDeco(d));
  for (const s of p.sections) {
    const top = s.label ? 1.9 : 0;
    if (s.label) out.push(`<text class="fp-sl" x="${num(s.x + 0.3)}" y="${num(s.y + 1.2)}">${esc(String(s.label).toUpperCase())}</text>`);
    const gy = s.y + top, gh = s.h - top;
    const cw = (s.w - GAP * (s.cols - 1)) / s.cols, ch = (gh - GAP * (s.rows - 1)) / s.rows;
    for (const [id, cell] of placeSection(s)) {
      const c = p.controls.find((x) => x.id === id); if (!c) continue;
      out.push(svgControl(c, s.x + cell.col * (cw + GAP), gy + cell.row * (ch + GAP), cell.cs * cw + (cell.cs - 1) * GAP, cell.rs * ch + (cell.rs - 1) * GAP));
    }
  }
  return `<svg class="fp" viewBox="0 0 ${num(f.w)} ${num(f.h)}" role="img" aria-label="${attr(title)}" focusable="false" preserveAspectRatio="xMidYMid meet">${out.join('')}</svg>`;
}

// ------------------------------------------------------------------ spec sheets
function msgText(t, c) {
  const S = t.specs, x = [];
  const base = c.type === 'keys' ? S.msg.note : S.msg[c.msg] || c.msg;
  if (c.type === 'encoder') x.push(c.relative ? fill(S.relative, { mode: c.relative }) : S.absolute);
  if (c.type === 'button') x.push(c.mode === 'toggle' ? S.toggle : S.momentary);
  if (c.type === 'pad' || c.type === 'keys') x.push(S.velocity);
  if (c.aftertouch) x.push(c.aftertouch === 'channel' ? S.chanAt : S.polyAt);
  if (c.spring) x.push(S.spring);
  return [base, ...x].join(' · ');
}
function numText(t, c) {
  if (c.type === 'keys') return fill(t.specs.keysRange, { from: c.from, to: c.to, a: noteName(c.from), b: noteName(c.to) });
  if (c.msg === 'cc') return String(c.cc);
  if (c.msg === 'note') return `${c.note} · ${noteName(c.note)}`;
  if (c.msg === 'pitchbend') return t.specs.bendRange;
  return '—';
}
function ledText(t, c) {
  const L = c.led, S = t.specs;
  if (!L) return S.ledNone;
  const what = L.msg === 'note' ? `${S.led.note} ${L.note ?? (c.type === 'keys' ? '' : c.note)}` : `CC ${L.cc ?? c.cc}`;
  const on = L.velocity ? S.led.velocity : L.on ?? 127;
  return `${what.trim()}${L.ch ? ` · ch ${L.ch}` : ''} · ${S.led.on} ${on} / ${S.led.off} ${L.off ?? 0}`;
}
function sigText(p, c) {
  const b = `midi/${p.short}/${c.id}`;
  return c.type === 'keys' ? `${b}/on · ${b}/off · midi/${p.short}/n${c.from}…n${c.to}` : b;
}

function specSheet(t, d, c, locale) {
  const p = d.p, S = t.specs, name = nameOf(p, locale);
  const rows = p.controls.map((x) => `<tr${x.verified === false ? ' class="unv"' : ''}>
            <th scope="row">${x.label && x.label !== x.id ? `${esc(x.label)} ` : ''}<code class="cid">${esc(x.id)}</code></th>
            <td>${esc(t.typeNames[x.type] || x.type)}</td>
            <td>${esc(msgText(t, x))}</td>
            <td class="n">${x.ch}</td>
            <td class="n">${esc(numText(t, x))}</td>
            <td><code>${esc(sigText(p, x))}</code></td>
            <td>${esc(ledText(t, x))}</td>
            <td>${x.verified === false ? `<span class="tag-unv"${typeof x.note === 'string' ? ` title="${attr(x.note)}"` : ''}>${S.unverified}</span>` : S.yes}</td>
          </tr>`).join('\n          ');
  // `note` is the MIDI note number on note controls and a remark (text) on the others
  const notes = p.controls.filter((x) => typeof x.note === 'string' && x.note);
  const src = (s) => `<li><span class="src-kind">${S.sourceKinds[sourceKind(s, p)]}</span> ${s.url ? `<a href="${attr(s.url)}">${esc(s.title)}</a>` : esc(s.title)}${s.note ? `<span class="src-note">${esc(s.note)}</span>` : ''}</li>`;
  const m = p.match || {};
  const ports = p.kind === 'generic' ? `<p>${S.noMatch}</p>` : `<dl class="ports">${['ports', 'prefer', 'avoid'].filter((k) => (m[k] || []).length).map((k) => `<div><dt>${S.match[k]}</dt><dd>${m[k].map((r) => `<code>/${esc(r)}/i</code>`).join(' ')}</dd></div>`).join('')}</dl>`;
  return `<details class="spec" id="spec-${p.id}">
      <summary><span class="spec-name">${esc(name)}</span><span class="spec-meta">${esc(p.maker || t.catalog.badges.generic)} · ${fill(t.hero.controlsN, { n: d.total })} · <code>midi/${esc(p.short)}/…</code></span></summary>
      <div class="spec-body">
        <div class="table-scroll" role="region" aria-label="${attr(fill(S.caption, { name }))}" tabindex="0">
        <table>
          <caption>${esc(fill(S.caption, { name }))}</caption>
          <thead><tr>${['control', 'type', 'message', 'ch', 'number', 'signal', 'led', 'verified'].map((k) => `<th scope="col">${S.cols[k]}</th>`).join('')}</tr></thead>
          <tbody>
          ${rows}
          </tbody>
        </table>
        </div>
        ${notes.length ? `<h4>${S.controlNotes}</h4>
        <ul class="cnotes">${notes.map((x) => `<li><code>${esc(x.id)}</code> ${esc(x.note)}</li>`).join('')}</ul>` : ''}
        <div class="spec-grid">
          <div>
            <h4>${S.sources}</h4>
            <ul class="sources">${(p.sources || []).map(src).join('')}</ul>
            ${p.origin ? `<h4>${S.origin}</h4><p class="raw-note">${esc(p.origin.note || '')}${p.origin.file ? ` <code>${esc(p.origin.file)}</code>` : ''}</p>` : ''}
          </div>
          <div>
            ${p.notes ? `<h4>${S.notes}</h4><p class="raw-note">${esc(p.notes)}</p>` : ''}
            <h4>${S.ports}</h4>
            ${ports}
          </div>
          <div>
            <h4>${S.signals}</h4>
            <p>${fill(S.signalsText, { short: esc(p.short) })}</p>
            <p class="spec-links"><a href="${c.root}${PROFILE_DIR}/${d.file}">${S.raw} ↗</a> <a href="${c.root}examples/09-midi-controllers/?view=controller&amp;profile=${p.id}">${t.catalog.links.full} ↗</a> <a href="#card-${p.id}">↑ ${S.toCard}</a></p>
          </div>
        </div>
      </div>
    </details>`;
}

// ------------------------------------------------------------------ cards
function card(t, d, c, locale) {
  const p = d.p, B = t.catalog.badges, L = t.catalog.links, name = nameOf(p, locale);
  const badges = [];
  if (d.prov.maker) badges.push(`<li class="b-maker">${B.maker}</li>`);
  if (d.prov.tool) badges.push(`<li class="b-tool">${fill(B.tool, { tool: esc(d.prov.tool) })}</li>`);
  if (d.prov.community) badges.push(`<li class="b-comm">${B.community}</li>`);
  if (d.prov.generic) badges.push(`<li class="b-gen">${B.generic}</li>`);
  if (d.prov.led) badges.push(`<li class="b-led">${B.led}</li>`);
  if (d.prov.unverified) badges.push(`<li class="b-unv">${fill(B.unverified, { n: d.prov.unverified })}</li>`);
  return `<li class="card" id="card-${p.id}" data-profile="${p.id}" data-has="${d.has.join(' ')}">
        <div class="card-face" data-face="${p.id}">${faceSvg(p, fill(t.catalog.faceLabel, { name }))}</div>
        <div class="card-body">
          <p class="card-maker">${esc(p.maker || B.generic)}</p>
          <h4 class="card-name"><a href="#spec-${p.id}">${esc(name)}</a></h4>
          <p class="card-counts">${countsText(t, d)}</p>
          <ul class="badges">${badges.join('')}</ul>
          <p class="card-links"><a href="#play" data-play="${p.id}">${L.play}</a><a href="${c.root}examples/09-midi-controllers/?view=controller&amp;profile=${p.id}">${L.full} ↗</a><a href="${c.root}${PROFILE_DIR}/${d.file}">${L.json}</a><a href="#embed" data-embed="${p.id}">${L.embed}</a></p>
        </div>
      </li>`;
}

// ------------------------------------------------------------------ code shown on the page
const PROTOCOL = `// iframe → your page, for every event
{ source: 'openav', v: 1, type: 'control', frame: 'pads',
  detail: { id, type, value, raw, signal, message, bytes, source } }
// type: ready · control · noteon · noteoff · connect · disconnect · status · profilechange · error

// your page → iframe
const win = document.querySelector('iframe').contentWindow;
win.postMessage({ target: 'openav', type: 'set', id: 'k1', value: 0.5 }, '*');
win.postMessage({ target: 'openav', type: 'ingest', bytes: [0xb0, 70, 64] }, '*');
win.postMessage({ target: 'openav', type: 'get' }, '*');   // answers with type 'values'
// also: press · release · reset · profile · layout`;

const SCHEMA = `{
  "id": "my-pads", "short": "mypads", "name": "My Pads", "maker": "…", "kind": "device",
  "match": { "ports": ["my\\\\s*pads"] },
  "sources": [{ "title": "My Pads manual, MIDI implementation chart", "url": "https://…",
                "note": "pads: notes 36–43 on channel 10" }],
  "face": { "w": 100, "h": 30, "label": "MY PADS" },
  "sections": [{ "id": "pads", "x": 2, "y": 4, "w": 60, "h": 24, "cols": 4, "rows": 2,
                 "controls": ["pad1", "pad2", "…"] }],
  "controls": [
    { "id": "pad1", "type": "pad", "msg": "note", "ch": 10, "note": 36, "label": "1" },
    { "id": "k1", "type": "knob", "msg": "cc", "cc": 70, "label": "K1",
      "verified": false, "note": "default not printed in the manual" }
  ]
}`;

const CHECK = `// check.mjs — run: node check.mjs
import { validateProfile } from './packages/midi/profiles.js';
import p from './packages/midi/profiles/my-pads.json' with { type: 'json' };

console.log(validateProfile(p));   // [] = valid; otherwise every problem, in words`;

// ------------------------------------------------------------------ the page
export function renderPage(t, home, locale) {
  const c = pageCtx('controllers', locale);
  const cat = catalog();
  const S = cat.stats;
  const heroD = cat.byId.get(HERO_DEFAULT) || cat.devices[0] || cat.all[0];
  const buildD = cat.byId.get(BUILDER_DEFAULT) || cat.devices[0] || cat.all[0];
  const E = t.embed, F = E.form;
  const bOpts = { profile: buildD.p.id, layout: 'auto', readout: true, hardware: 'off', midiOut: 'off', theme: 'dark' };
  const snip = snippets(bOpts, buildD.p);
  const SNIPS = [['element', 'html'], ['iframe', 'html'], ['module', 'javascript'], ['events', 'javascript'], ['daw', 'html']];

  const sec = (id, eyebrow, title, lede = '') => `
    <header class="sec-head">
      <p class="eyebrow">${eyebrow}</p>
      <h2 id="${id}-title">${title}</h2>
      ${lede ? `<p class="sec-lede">${lede}</p>` : ''}
    </header>`;
  const copyBtn = (id) => `<button type="button" class="copy" data-copy="${id}">${home.ui.copy}</button>`;
  const term = (label, id, code) => `<div class="term"><div class="term-bar"><span>${label}</span>${copyBtn(id)}</div><pre id="${id}"><code>${hl(code)}</code></pre></div>`;
  const opt = (x) => `<option value="${x.p.id}"${x.p.id === buildD.p.id ? ' selected' : ''}>${esc(nameOf(x.p, locale))}</option>`;

  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Dataset', '@id': c.self + '#dataset', name: t.meta.ldName, description: t.meta.ldDescription, url: c.self, inLanguage: home.ldLanguage,
        license: 'https://opensource.org/licenses/MIT', isAccessibleForFree: true,
        creator: { '@type': 'Person', name: 'Che-Yu Wu', alternateName: '吳哲宇', url: 'https://cheyuwu.com' },
        isPartOf: { '@type': 'SoftwareSourceCode', name: 'open-audiovisual', codeRepository: REPO },
        keywords: ['MIDI', 'MIDI controller', 'MIDI implementation chart', 'Web MIDI', 'web component', 'TouchDesigner', 'Ableton Live'],
        distribution: cat.all.map((d) => ({ '@type': 'DataDownload', name: d.p.nameEn || d.p.name, encodingFormat: 'application/json', contentUrl: SITE + `${PROFILE_DIR}/${d.file}` })),
      },
      {
        '@type': 'ItemList', name: t.meta.ldList, numberOfItems: cat.all.length,
        itemListElement: [...cat.devices, ...cat.generic].map((d, i) => ({ '@type': 'ListItem', position: i + 1, name: d.p.nameEn || d.p.name, url: `${c.self}#spec-${d.p.id}` })),
      },
    ],
  };

  const runtime = {
    lang: locale, copy: home.ui.copy, copied: home.ui.copied,
    connect: t.hero.connect, asking: t.hero.asking, connected: t.hero.connected, waiting: t.hero.waiting, noMidi: t.hero.noMidi, denied: t.hero.denied,
    readoutIdle: t.hero.readoutIdle, controlsN: t.hero.controlsN, shown: t.catalog.shown, eventsIdle: E.eventsIdle,
    fullHref: `${c.root}examples/09-midi-controllers/?view=controller&profile=`,
  };

  const chip = (d) => `<a class="chip" href="#spec-${d.p.id}" data-profile="${d.p.id}"${d === heroD ? ' aria-current="true"' : ''}>${esc(nameOf(d.p, locale))}</a>`;

  return `<!DOCTYPE html>
<html lang="${t.htmlLang}">
<head>
${headBasics(home, c, { title: t.meta.title, description: t.meta.description, ogDescription: t.meta.ogDescription })}
<link rel="stylesheet" href="${c.root}assets/controllers/controllers.css">
<noscript><style>.js-only { display: none !important; }</style></noscript>
<script type="application/ld+json">
${JSON.stringify(ld, null, 2)}
</script>
</head>
<body class="page-controllers">
${topBar(home, c)}

<main id="main">

  <!-- ═════ 01 · play: one live controller, any device, your hardware moves it ═════ -->
  <section class="ch-hero" id="play" aria-labelledby="play-title">
    <p class="eyebrow">${t.hero.eyebrow}</p>
    <h1 id="play-title">${t.hero.title}</h1>
    <div class="hero-cols">
      <p class="lede">${t.hero.lede}</p>
      <div class="hero-facts">
        <p class="why">${t.hero.why}</p>
        <dl class="stats">
          <div><dt>${t.hero.stats.devices}</dt><dd>${S.devices}</dd></div>
          <div><dt>${t.hero.stats.generic}</dt><dd>${S.generic}</dd></div>
          <div><dt>${t.hero.stats.controls}</dt><dd>${S.controls}</dd></div>
          <div><dt>${t.hero.stats.sources}</dt><dd>${S.sources}</dd></div>
        </dl>
        <p class="unv-note">${fill(t.hero.unverified, { n: S.unverified })}</p>
      </div>
    </div>

    <div class="stage-bar">
      <nav class="switch" aria-label="${attr(t.hero.switchLabel)}">
        <span class="switch-k">${t.hero.devices}</span>
        ${cat.devices.map(chip).join('\n        ')}
        <span class="switch-k">${t.hero.generic}</span>
        ${cat.generic.map(chip).join('\n        ')}
      </nav>
      <button type="button" class="connect js-only" id="hero-connect"><span class="led" aria-hidden="true"></span>${t.hero.connect}</button>
    </div>
    <p class="hw-status js-only" id="hw-status" role="status"></p>

    <div class="stage">
      <oav-controller id="hero-ctl" profile="${heroD.p.id}" follow>${faceSvg(heroD.p, fill(t.catalog.faceLabel, { name: nameOf(heroD.p, locale) }))}</oav-controller>
    </div>
    <div class="stage-foot">
      <p class="readout js-only"><span class="ro-k">${t.hero.readoutLabel}</span><code id="hero-readout">${t.hero.readoutIdle}</code></p>
      <p class="stage-meta" id="hero-meta"><b id="hm-name">${esc(nameOf(heroD.p, locale))}</b> <span id="hm-count">${fill(t.hero.controlsN, { n: heroD.total })}</span> <a id="hm-spec" href="#spec-${heroD.p.id}">${t.hero.specLink}</a> <a id="hm-full" href="${c.root}examples/09-midi-controllers/?view=controller&amp;profile=${heroD.p.id}">${t.hero.fullLink} ↗</a></p>
    </div>
    <p class="hint js-only">${t.hero.hint}</p>
    <noscript><p class="noscript">${t.hero.noscript}</p></noscript>
  </section>

  <!-- ═════ 02 · catalog ═════ -->
  <section class="sec" id="catalog" aria-labelledby="catalog-title">
    ${sec('catalog', t.catalog.eyebrow, t.catalog.title, t.catalog.lede)}
    <div class="filters js-only" role="group" aria-label="${attr(t.catalog.filterLabel)}">
      <span class="filters-k">${t.catalog.filterLabel}</span>
      ${FILTERS.map((f) => `<button type="button" data-filter="${f}" aria-pressed="${f === 'all'}">${t.catalog.filters[f]}</button>`).join('\n      ')}
      <span class="shown" id="shown" aria-live="polite"></span>
    </div>
    <div class="cat-group">
    <h3 class="cat-h">${t.catalog.devices} <span>${S.devices}</span></h3>
    <ul class="cards">
      ${cat.devices.map((d) => card(t, d, c, locale)).join('\n      ')}
    </ul>
    </div>
    <div class="cat-group">
    <h3 class="cat-h">${t.catalog.generic} <span>${S.generic}</span></h3>
    <p class="cat-note">${t.catalog.genericNote}</p>
    <ul class="cards">
      ${cat.generic.map((d) => card(t, d, c, locale)).join('\n      ')}
    </ul>
    </div>
  </section>

  <!-- ═════ 03 · spec sheets: the full MIDI map, static ═════ -->
  <section class="sec" id="specs" aria-labelledby="specs-title">
    ${sec('specs', t.specs.eyebrow, t.specs.title, t.specs.lede)}
    <div class="specs">
    ${[...cat.devices, ...cat.generic].map((d) => specSheet(t, d, c, locale)).join('\n    ')}
    </div>
  </section>

  <!-- ═════ 04 · embed it ═════ -->
  <section class="sec" id="embed" aria-labelledby="embed-title">
    ${sec('embed', E.eyebrow, E.title, E.lede)}
    <div class="builder">
      <form class="b-form js-only" id="builder" aria-label="${attr(E.title)}">
        <label class="f"><span>${F.device}</span>
          <select name="profile"><optgroup label="${attr(t.catalog.devices)}">${cat.devices.map(opt).join('')}</optgroup><optgroup label="${attr(t.catalog.generic)}">${cat.generic.map(opt).join('')}</optgroup></select></label>
        <fieldset class="f"><legend>${F.layout}</legend>
          ${['auto', 'face', 'stack'].map((v) => `<label class="r"><input type="radio" name="layout" value="${v}"${v === 'auto' ? ' checked' : ''}> ${F.layouts[v]}</label>`).join('')}</fieldset>
        <fieldset class="f"><legend>${F.show}</legend>
          ${['picker', 'readout', 'learn'].map((v) => `<label class="r"><input type="checkbox" name="${v}"${bOpts[v] ? ' checked' : ''}> ${F[v]}</label>`).join('')}</fieldset>
        <label class="f"><span>${F.hardware}</span><select name="hardware">${['off', 'ask', 'on'].map((v) => `<option value="${v}">${F.hw[v]}</option>`).join('')}</select></label>
        <label class="f"><span>${F.midiOut}</span><select name="midiOut">${['off', 'ask', 'IAC', 'loopMIDI'].map((v) => `<option value="${v}">${F.out[v]}</option>`).join('')}</select></label>
        <fieldset class="f"><legend>${F.theme}</legend>
          ${['dark', 'light'].map((v) => `<label class="r"><input type="radio" name="theme" value="${v}"${v === 'dark' ? ' checked' : ''}> ${F.themes[v]}</label>`).join('')}</fieldset>
      </form>
      <div class="b-preview">
        <p class="b-label">${E.preview}</p>
        <div class="b-stage"><oav-controller id="b-ctl" profile="${buildD.p.id}" readout>${faceSvg(buildD.p, fill(t.catalog.faceLabel, { name: nameOf(buildD.p, locale) }))}</oav-controller></div>
        <p class="b-label">${E.events}</p>
        <pre class="b-event" id="b-event"><code>${E.eventsIdle}</code></pre>
      </div>
    </div>

    <ol class="snips">
      ${SNIPS.map(([k, lang], i) => `<li class="snip">
        <h3>${E.snips[i].title}</h3>
        <p>${E.snips[i].text}</p>
        ${term(lang, `snip-${k}`, snip[k])}
      </li>`).join('\n      ')}
    </ol>

    <div class="embed-grid">
      <div>
        <h3>${E.dawTitle}</h3>
        <ol class="daw">${E.mac.map((s) => `<li>${s}</li>`).join('')}</ol>
        <p class="note">${E.browsers}</p>
        <p class="note">${E.loop}</p>
        <p class="note">${E.telemetry.replace('{href}', c.to('docs', '#controllers-telemetry'))}</p>
      </div>
      <div>
        <h3>${E.protocolTitle}</h3>
        <p>${E.protocolText}</p>
        ${term('postMessage', 'snip-protocol', PROTOCOL)}
      </div>
    </div>

    <h3>${E.apiTitle}</h3>
    <div class="table-scroll" role="region" aria-label="${attr(E.apiTitle)}" tabindex="0">
    <table class="api">
      <thead><tr><th scope="col">${E.apiCols.name}</th><th scope="col">${E.apiCols.kind}</th><th scope="col">${E.apiCols.what}</th></tr></thead>
      <tbody>
        ${E.api.map((r) => `<tr><th scope="row"><code>${esc(r.name)}</code></th><td>${r.kind}</td><td>${r.what}</td></tr>`).join('\n        ')}
      </tbody>
    </table>
    </div>
    <p><a class="more" href="${BLOB}packages/midi/README.md">${E.readme} →</a></p>
  </section>

  <!-- ═════ 05 · model yours ═════ -->
  <section class="sec" id="model" aria-labelledby="model-title">
    ${sec('model', t.model.eyebrow, t.model.title, t.model.lede)}
    <ol class="steps">
      ${t.model.steps.map((s) => `<li><strong>${s.head}</strong> ${s.text}</li>`).join('\n      ')}
    </ol>
    <div class="model-grid">
      <div>
        <h3>${t.model.schemaTitle}</h3>
        ${term('packages/midi/profiles/my-pads.json', 'snip-schema', SCHEMA)}
        <h3>${t.model.validateTitle}</h3>
        ${term('check.mjs', 'snip-check', CHECK)}
      </div>
      <div>
        <h3>${t.model.typesTitle}</h3>
        <div class="table-scroll" role="region" aria-label="${attr(t.model.typesTitle)}" tabindex="0">
        <table class="types">
          <thead><tr><th scope="col">${t.model.typesCols.type}</th><th scope="col">${t.model.typesCols.sends}</th><th scope="col">${t.model.typesCols.signal}</th></tr></thead>
          <tbody>
            ${t.model.types.map((r) => `<tr><th scope="row"><code>${r.type}</code></th><td>${r.sends}</td><td>${r.signal}</td></tr>`).join('\n            ')}
          </tbody>
        </table>
        </div>
        <h3>${t.model.learnTitle}</h3>
        <p>${t.model.learnText}</p>
        <ul class="model-links">
          <li><a href="${REPO}">${t.model.links.repo} ↗</a></li>
          <li><a href="${BLOB}packages/midi/README.md">${t.model.links.readme} ↗</a></li>
          <li><a href="${TREE}packages/midi/profiles">${t.model.links.folder} ↗</a></li>
          <li><a href="${REPO}/issues/new?title=MIDI%20controller%20request%3A%20">${t.model.links.issue} ↗</a></li>
        </ul>
      </div>
    </div>
  </section>

</main>

${siteFooter(home, c)}

<script type="application/json" id="ctl-i18n">${JSON.stringify(runtime).replace(/</g, '\\u003c')}</script>
<script type="module" src="${c.root}assets/controllers/controllers.js"></script>
</body>
</html>
`;
}
