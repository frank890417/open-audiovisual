// /controllers/ — brings the static page to life. The page itself (every card, every spec
// sheet, every snippet) is already HTML; this only adds what needs a browser:
//   the hero: switch devices, connect hardware (follow = plug a device in → it appears), readout
//   the catalog: live faceplates mounted lazily (mouse / pen only — on a phone a card scrolls,
//                and Play sends it to the big one), filters by control type
//   the builder: options → the preview element's attributes + every snippet, the last event
//   copy buttons, #spec-<id> deep links, ?profile=<id> for the hero
// It uses the same public pieces anyone else would: <oav-controller> and embed.js.

import { PROFILES } from '../../packages/midi/element.js?v=2cd2e50';
import { describeDetail } from '../../packages/midi/embed.js?v=2cd2e50';
import { snippets, hl } from './snippets.js?v=2cd2e50';

const T = JSON.parse(document.getElementById('ctl-i18n').textContent);
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const fill = (s, o) => String(s).replace(/\{(\w+)\}/g, (m, k) => (k in o ? o[k] : m));
const byId = new Map(PROFILES.map((p) => [p.id, p]));
const nameOf = (p) => (T.lang === 'zh' ? p.name : p.nameEn || p.name);
const total = (p) => p.controls.reduce((a, c) => a + (c.type === 'keys' ? c.to - c.from + 1 : 1), 0);
const motion = () => !matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = matchMedia('(pointer: fine)').matches;

// ------------------------------------------------------------------ hero
const hero = $('#hero-ctl');
const switcher = $('.switch');
const chips = $$('.switch .chip');
const readout = $('#hero-readout');
const connectBtn = $('#hero-connect');
const hwStatus = $('#hw-status');

function paintHero(id) {
  const p = byId.get(id); if (!p) return;
  for (const a of chips) {
    const on = a.dataset.profile === id;
    if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
    if (on && switcher) {   // keep the chosen chip visible inside its own scroller, never scroll the page
      const l = a.offsetLeft - switcher.offsetLeft, r = l + a.offsetWidth;
      if (l < switcher.scrollLeft || r > switcher.scrollLeft + switcher.clientWidth) switcher.scrollTo({ left: Math.max(0, l - 24), behavior: motion() ? 'smooth' : 'auto' });
    }
  }
  $('#hm-name').textContent = nameOf(p);
  $('#hm-count').textContent = fill(T.controlsN, { n: total(p) });
  $('#hm-spec').href = '#spec-' + id;
  $('#hm-full').href = T.fullHref + id;
  readout.textContent = T.readoutIdle; readout.removeAttribute('data-hw');
}

function showHero(id, { scroll = false } = {}) {
  if (!byId.has(id)) return;
  if (hero.getAttribute('profile') !== id) hero.setAttribute('profile', id);
  paintHero(id);
  if (scroll) $('#play').scrollIntoView({ behavior: motion() ? 'smooth' : 'auto', block: 'start' });
}

for (const a of chips) a.addEventListener('click', (e) => { e.preventDefault(); showHero(a.dataset.profile); });
hero.addEventListener('profilechange', (e) => paintHero(e.detail.profile));   // follow: a plugged-in device takes the stage

// the readout: at most one write per frame, however fast a knob turns
let pending = null;
hero.addEventListener('control', (e) => {
  if (!pending) requestAnimationFrame(() => {
    readout.textContent = describeDetail(pending);
    if (pending.source === 'hardware') readout.setAttribute('data-hw', ''); else readout.removeAttribute('data-hw');
    pending = null;
  });
  pending = e.detail;
});

function paintStatus(s) {
  const st = s ? s.hardware : 'off';
  connectBtn.dataset.state = st;
  connectBtn.disabled = st === 'asking';
  connectBtn.setAttribute('aria-pressed', String(st === 'connected' || st === 'waiting'));
  const label = st === 'asking' ? T.asking : st === 'connected' ? fill(T.connected, { port: s.input }) : st === 'waiting' ? '● MIDI' : T.connect;
  connectBtn.lastChild.textContent = label;
  hwStatus.textContent = st === 'waiting' ? T.waiting : st === 'unavailable' ? T.noMidi : st === 'denied' ? T.denied : '';
  if (st === 'unavailable' || st === 'denied') hwStatus.setAttribute('data-bad', ''); else hwStatus.removeAttribute('data-bad');
}
connectBtn.addEventListener('click', () => {
  const on = hero.hasAttribute('hardware') && !['unavailable', 'denied'].includes(hero.status?.hardware);
  if (on) hero.removeAttribute('hardware'); else { hero.removeAttribute('hardware'); hero.setAttribute('hardware', 'on'); }
  if (on) paintStatus({ hardware: 'off' });
});
hero.addEventListener('status', (e) => paintStatus(e.detail));

// ------------------------------------------------------------------ catalog
const cards = $$('.card');

function playOnHero(id) { showHero(id, { scroll: true }); }
for (const a of $$('[data-play]')) a.addEventListener('click', (e) => { e.preventDefault(); playOnHero(a.dataset.play); });

// live faceplates: mouse / pen only, mounted as they come near, one per idle moment
if (fine && 'IntersectionObserver' in window) {
  const queue = [];
  let busy = false;
  const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 60));
  const next = () => {
    const face = queue.shift(); if (!face) { busy = false; return; }
    const el = document.createElement('oav-controller');
    el.setAttribute('profile', face.dataset.face);
    el.setAttribute('layout', 'face');
    el.addEventListener('ready', () => face.classList.add('live'), { once: true });
    face.appendChild(el);
    idle(next);
  };
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { io.unobserve(e.target); queue.push(e.target); }
    if (!busy && queue.length) { busy = true; idle(next); }
  }, { rootMargin: '240px 0px' });
  for (const f of $$('.card-face')) io.observe(f);
} else {
  // touch: a card face is a picture; tapping it plays that device on the big one
  for (const f of $$('.card-face')) { f.dataset.tap = ''; f.addEventListener('click', () => playOnHero(f.dataset.face)); }
}

// filters by control type (works for any number of devices)
const filterBtns = $$('[data-filter]');
const shown = $('#shown');
function applyFilter(f) {
  let n = 0;
  for (const b of filterBtns) b.setAttribute('aria-pressed', String(b.dataset.filter === f));
  for (const c of cards) { const ok = f === 'all' || c.dataset.has.split(' ').includes(f); c.hidden = !ok; if (ok) n++; }
  for (const g of $$('#catalog .cat-group')) g.hidden = !$$('.card', g).some((c) => !c.hidden);
  shown.textContent = f === 'all' ? '' : fill(T.shown, { n });
}
for (const b of filterBtns) b.addEventListener('click', () => applyFilter(b.dataset.filter));

// ------------------------------------------------------------------ builder
const form = $('#builder');
const bctl = $('#b-ctl');
const evOut = $('#b-event code');

function readForm() {
  const fd = new FormData(form);
  return { profile: fd.get('profile'), layout: fd.get('layout') || 'auto', picker: fd.has('picker'), readout: fd.has('readout'), learn: fd.has('learn'),
    hardware: fd.get('hardware') || 'off', midiOut: fd.get('midiOut') || 'off', theme: fd.get('theme') || 'dark' };
}
const setAttr = (el, k, v) => { if (v === null || v === false) el.removeAttribute(k); else if (el.getAttribute(k) !== v) el.setAttribute(k, v); };

function applyBuilder() {
  const o = readForm(), p = byId.get(o.profile); if (!p) return;
  setAttr(bctl, 'profile', o.profile);
  setAttr(bctl, 'layout', o.layout === 'auto' ? null : o.layout);
  for (const k of ['picker', 'readout', 'learn']) setAttr(bctl, k, o[k] ? '' : null);
  setAttr(bctl, 'hardware', o.hardware === 'off' ? null : o.hardware === 'on' ? '' : o.hardware);
  setAttr(bctl, 'midi-out', o.midiOut === 'off' ? null : o.midiOut);
  setAttr(bctl, 'theme', o.theme === 'light' ? 'light' : null);
  const s = snippets(o, p);
  for (const [k, code] of Object.entries(s)) { const pre = document.getElementById('snip-' + k); if (pre) pre.innerHTML = `<code>${hl(code)}</code>`; }
}
form.addEventListener('change', applyBuilder);
form.addEventListener('submit', (e) => e.preventDefault());
bctl.addEventListener('profilechange', (e) => { const sel = form.elements.profile; if (sel.value !== e.detail.profile) { sel.value = e.detail.profile; applyBuilder(); } });

let lastEv = null;
bctl.addEventListener('control', (e) => {
  if (!lastEv) requestAnimationFrame(() => { evOut.textContent = `// ${describeDetail(lastEv)}\n` + JSON.stringify(lastEv, null, 2); lastEv = null; });
  lastEv = e.detail;
});

for (const a of $$('[data-embed]')) a.addEventListener('click', (e) => {
  e.preventDefault();
  form.elements.profile.value = a.dataset.embed;
  applyBuilder();
  $('#embed').scrollIntoView({ behavior: motion() ? 'smooth' : 'auto', block: 'start' });
});

// ------------------------------------------------------------------ copy, deep links
document.addEventListener('click', async (e) => {
  const b = e.target.closest('.copy[data-copy]'); if (!b) return;
  const pre = document.getElementById(b.dataset.copy); if (!pre) return;
  try { await navigator.clipboard.writeText(pre.textContent); }
  catch { const r = document.createRange(); r.selectNodeContents(pre); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); return; }
  b.textContent = T.copied; b.dataset.done = '';
  setTimeout(() => { b.textContent = T.copy; delete b.dataset.done; }, 1400);
});

function openFromHash() {
  const m = /^#spec-([\w-]+)$/.exec(location.hash);
  const d = m && document.getElementById('spec-' + m[1]);
  if (d && d.tagName === 'DETAILS') d.open = true;
}
addEventListener('hashchange', openFromHash);
openFromHash();

const q = new URLSearchParams(location.search).get('profile');
if (q && byId.has(q)) showHero(q);
