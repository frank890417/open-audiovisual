// open-audiovisual API reference — the behaviour the static page needs. The page is complete without this file
// (every entry is in the HTML); this adds:
//   · the search box: type and the entries narrow, best match first; ?q=micLevel arrives pre-filled; "/" focuses it
//   · live examples, the way p5.js's reference shows them: an oav-p5 example runs by itself, in a sandboxed iframe
//     (p5 + oav-p5 + the example) beside its code, while it is on screen, and stops when it scrolls away. The code is
//     editable and the example reruns as you type; ↺ Reset puts the original back. A preview that ran by itself is
//     quiet: no permission prompt from scrolling (the microphone waits for a click inside the frame, Web MIDI for 🎹).
//     ▶ Run starts it the way a pasted sketch runs (asks for the microphone and MIDI); ■ Stop takes it away.
//   · copy: an oav-p5 example is copied WITH the line that loads oav-p5, so it runs as pasted into OpenProcessing
// The categories drawer, scroll-spy and copy-link on anchors come from assets/docs/docs.js (same frame).

import { prepare, rank, tokens } from '../search/core.js?v=918db22';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
let R = {};
try { R = JSON.parse($('#oav-ref')?.textContent || '{}'); } catch { /* defaults */ }
const T = R.ex || {};
const root = document.documentElement;
const page = document.body;
const toast = $('.docs-toast');

function flash(msg) {
  if (!toast) return;
  toast.textContent = msg; toast.classList.add('show');
  clearTimeout(flash.t); flash.t = setTimeout(() => toast.classList.remove('show'), 1800);
}
async function copyText(text) { try { await navigator.clipboard.writeText(text); return true; } catch { return false; } }
function selectText(el) { const r = document.createRange(); r.selectNodeContents(el); getSelection().removeAllRanges(); getSelection().addRange(r); }

// ───────── search ─────────
const articles = $$('.ref');
const input = $('#ref-q');
const status = $('.ref-search-status');
const clearBtn = $('.ref-search-clear');
const none = $('.ref-none');
const total = articles.length;
let recs = null;                                       // built on the first keystroke, not at load
function build() {
  recs = articles.map((el, i) => prepare({
    el, i, name: el.dataset.name, names: el.dataset.names, kw: el.dataset.kw,
    summary: ($('.ref-summary', el) || $('.ref-nodoc', el) || {}).textContent || '', text: el.textContent,
  }));
}

function apply(q, { push = true } = {}) {
  const toks = tokens(q);
  if (!recs && toks.length) build();
  if (!toks.length) {
    page.removeAttribute('data-searching');
    for (const el of articles) { el.hidden = false; el.style.order = ''; el.classList.remove('is-hit'); }
    status.textContent = ''; none.hidden = true; clearBtn.hidden = true;
  } else {
    page.setAttribute('data-searching', '');
    const ranked = rank(recs, q);
    const order = new Map(ranked.map((x, k) => [x.rec.el, k]));
    for (const el of articles) {
      const k = order.get(el);
      el.hidden = k === undefined; el.style.order = k === undefined ? '' : String(k);
      el.classList.toggle('is-hit', k === 0);
    }
    status.textContent = (R.searchCount || '{n} / {total}').replace('{n}', ranked.length).replace('{total}', total);
    none.hidden = ranked.length > 0;
    none.textContent = (R.searchNone || 'No match for “{q}”.').replace('{q}', q.trim());
    clearBtn.hidden = false;
  }
  if (push) {
    const u = new URL(location.href);
    if (q.trim()) u.searchParams.set('q', q.trim()); else u.searchParams.delete('q');
    history.replaceState(null, '', u.pathname + u.search + u.hash);
  }
}

let timer;
input?.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => apply(input.value), 40); });
clearBtn?.addEventListener('click', () => { input.value = ''; apply(''); input.focus(); });
input?.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { if (input.value) { input.value = ''; apply(''); } else input.blur(); }
  if (e.key === 'Enter') {
    const first = articles.find((el) => !el.hidden && el.style.order === '0') || articles.find((el) => !el.hidden);
    if (first) { e.preventDefault(); const h3 = $('h3[id]', first); if (h3) { input.blur(); h3.scrollIntoView({ block: 'start' }); } }
  }
});
addEventListener('keydown', (e) => {
  if (e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '') && !document.activeElement?.isContentEditable) {
    e.preventDefault(); input?.focus(); input?.select();
  }
});

// ?q= on arrival; a #hash that the search would hide wins over the search
(function arrive() {
  const q = new URL(location.href).searchParams.get('q') || '';
  if (!q || !input) return;
  input.value = q;
  apply(q, { push: false });
  const id = decodeURIComponent(location.hash.slice(1));
  const target = id && document.getElementById(id);
  const card = target && target.closest('.ref');
  if (card && card.hidden) { input.value = ''; apply(''); }
  const first = articles.find((el) => !el.hidden && el.style.order === '0');
  if (!id && first) requestAnimationFrame(() => $('h3[id]', first)?.scrollIntoView({ block: 'start' }));
})();

// a link to a card the search has hidden (the nav's search dialog, a pasted #anchor): drop the search so the card is there
addEventListener('hashchange', () => {
  const id = decodeURIComponent(location.hash.slice(1));
  const card = id && document.getElementById(id) && document.getElementById(id).closest('.ref');
  if (card && card.hidden && input) { input.value = ''; apply(''); document.getElementById(id).scrollIntoView({ block: 'start' }); }
});

// ───────── the loader line ─────────
const LOADER = R.loader || '';
$('.ref-loader-copy')?.addEventListener('click', async (e) => {
  const b = e.currentTarget;
  if (await copyText(LOADER)) { b.textContent = T.copied; flash(T.copied); } else selectText($('.ref-loader pre'));
  setTimeout(() => { b.textContent = b.dataset.label; }, 1600);
});
for (const b of $$('.ref-loader-copy, .ref-run, .ref-copy')) { b.hidden = false; b.dataset.label = b.textContent; }
for (const b of $$('.ref-stop, .ref-reset')) b.dataset.label = b.textContent;

// ───────── examples ─────────
const exOf = (el) => el.closest('.ref-ex');
const codeOf = (fig) => $('pre', fig).innerText.replace(/\n$/, '');
// an example about a loading option starts with `window.OAV_P5 = { … };`: that line has to run BEFORE the loader line
const OPT = /^(window\.OAV_P5\s*=\s*\{[\s\S]*?\};)[ \t]*\n/;
const splitOptions = (code) => { const m = OPT.exec(code); return m ? { options: m[1], rest: code.slice(m[0].length).replace(/^\n+/, '') } : { options: '', rest: code }; };
const withLoader = (fig, code) => {
  if (fig.dataset.run !== 'sketch') return code;
  const s = splitOptions(code);
  return (s.options ? s.options + '\n' : '') + LOADER + '\n\n' + s.rest;
};

const sketches = $$('.ref-ex[data-run="sketch"]');
const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;
const MAX_LIVE = matchMedia('(max-width: 640px)').matches ? 2 : 4;   // frames running at once (each is a whole p5)
// reading any of these asks for the microphone; a sketch that starts the drum machine hears the drums instead
const MIC = /\b(micLevel|bass|mid|treble|beat|micIsOn|startMic)\b/;
const needsMic = (fig, code) => fig.dataset.needs === 'mic' || (MIC.test(code) && !/\bstartDrums\s*\(/.test(code));
const isLive = (fig) => !!$('.ref-live iframe', fig);
let AUTO = (() => { try { const v = localStorage.getItem('oav-ref-auto'); return v === null ? !REDUCE : v === '1'; } catch { return !REDUCE; } })();
let nextId = 0;
const figs = new Map();                                // frame id → figure, for the size the frame reports

function poster(fig) {
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'ref-poster'; b.textContent = T.run || '▶ Run';
  b.addEventListener('click', () => { delete fig.dataset.userStopped; start(fig); });
  return b;
}
function buttons(fig) {
  const live = isLive(fig);
  const stopB = $('.ref-stop', fig); if (stopB) stopB.hidden = !live;
  fig.classList.toggle('is-live', live);
}

page.addEventListener('click', async (e) => {
  const copy = e.target.closest('.ref-copy');
  if (copy) {
    const fig = exOf(copy), text = withLoader(fig, codeOf(fig));
    if (await copyText(text)) { copy.textContent = T.copied; flash(fig.dataset.run === 'sketch' ? T.copyTitle || T.copied : T.copied); } else selectText($('pre', fig));
    setTimeout(() => { copy.textContent = copy.dataset.label; }, 1600);
    return;
  }
  const run = e.target.closest('.ref-run');
  if (run) { const fig = exOf(run); delete fig.dataset.userStopped; start(fig); return; }
  const stopB = e.target.closest('.ref-stop');
  if (stopB) { const fig = exOf(stopB); fig.dataset.userStopped = '1'; stop(fig); return; }
  const reset = e.target.closest('.ref-reset');
  if (reset) {
    const fig = exOf(reset), c = $('pre code', fig);
    if (c && c.dataset.orig !== undefined) c.innerHTML = c.dataset.orig;
    reset.hidden = true; fig.classList.remove('is-edited');
    if (isLive(fig)) start(fig, { quiet: fig.dataset.mode === 'quiet' });
  }
});

function pickedP5() { try { return localStorage.getItem('oav-ref-p5') || R.p5.default; } catch { return R.p5.default; } }
function start(fig, { quiet = false } = {}) {
  const live = $('.ref-live', fig);
  const p5 = `https://cdn.jsdelivr.net/npm/p5@${pickedP5()}/lib/p5.min.js`;
  const oav = new URL(R.oav, location.href).href;
  const s = splitOptions(codeOf(fig));
  const code = s.rest.replace(/<\/script/gi, '<\\/script');
  const opts = s.options.replace(/<\/script/gi, '<\\/script');
  const mic = needsMic(fig, s.rest);
  // a quiet preview opens nothing by itself: the microphone after a click inside the frame, Web MIDI from 🎹.
  // An example's own `window.OAV_P5 = { … }` still wins (it is merged over these).
  const defaults = quiet ? { panel: 'closed', hardware: 'click', mic: mic ? 'click' : 'auto' } : { panel: 'closed' };
  const id = ++nextId;
  figs.set(id, fig);
  const micBtn = quiet && mic
    ? `<button id="oav-ref-mic" type="button">${esc(T.micOn || '🎤')}</button><script>document.getElementById('oav-ref-mic').onclick=function(){this.remove();try{startMic()}catch(e){console.error(e)}};<\/script>`
    : '';
  // the frame says how big the canvas is, so the box keeps its shape (and follows resizeCanvas)
  const sizer = `<script>(function(){var last='';setInterval(function(){var c=document.querySelector('canvas');if(!c)return;` +
    `var w=parseFloat(c.style.width)||c.width,h=parseFloat(c.style.height)||c.height,k=w+'x'+h;if(k!==last&&w&&h){last=k;parent.postMessage({oavRef:${id},w:w,h:h},'*')}},250)})();<\/script>`;
  const doc = `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;height:100%;background:#111;overflow:hidden}` +
    `body{display:flex;align-items:center;justify-content:center}canvas{max-width:100%!important;max-height:100%!important;width:auto!important;height:auto!important}` +
    `#oav-ref-mic{position:fixed;left:50%;top:10px;transform:translateX(-50%);z-index:2147483646;font:500 13px/1.2 system-ui,sans-serif;color:#fff;background:rgba(0,0,0,.78);border:1px solid rgba(255,255,255,.45);padding:7px 12px;cursor:pointer}</style>` +
    `<script>window.__oavRef=${JSON.stringify(defaults)};</script>${opts ? `<script>${opts}</script>` : ''}` +
    `<script>window.OAV_P5=Object.assign({},window.__oavRef,window.OAV_P5||{});</script>` +
    `<script src="${p5}"></script><script src="${oav}"></script><script>${code}</script>${sizer}${micBtn}`;
  const f = document.createElement('iframe');
  f.title = T.frameTitle || 'Live example';
  f.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups allow-modals');
  f.setAttribute('allow', 'microphone; midi; autoplay');
  f.dataset.id = String(id);
  f.srcdoc = doc;
  live.replaceChildren(f); live.hidden = false;
  fig.dataset.mode = quiet ? 'quiet' : 'full';
  buttons(fig);
}
function stop(fig) {
  const live = $('.ref-live', fig);
  const f = $('iframe', live); if (f) figs.delete(+f.dataset.id);
  live.replaceChildren(poster(fig));
  delete fig.dataset.mode;
  buttons(fig);
}
function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]); }

addEventListener('message', (e) => {
  const d = e.data;
  if (!d || typeof d.oavRef !== 'number' || !(d.w > 0) || !(d.h > 0)) return;
  const fig = figs.get(d.oavRef), f = fig && $('.ref-live iframe', fig);
  if (!f || f.contentWindow !== e.source) return;
  const live = $('.ref-live', fig);
  live.style.aspectRatio = `${d.w} / ${d.h}`;
  live.style.maxWidth = `${Math.round(d.w)}px`;
});

// every sketch example gets its box beside the code, and editable code
for (const fig of sketches) {
  const live = $('.ref-live', fig);
  live.replaceChildren(poster(fig)); live.hidden = false;
  const c = $('pre code', fig);
  if (!c) continue;
  c.dataset.orig = c.innerHTML;
  try { c.contentEditable = 'plaintext-only'; } catch { c.contentEditable = 'true'; }
  if (c.contentEditable !== 'plaintext-only') c.contentEditable = 'true';
  c.spellcheck = false;
  c.setAttribute('autocapitalize', 'off');
  c.title = T.editHint || '';
  let t;
  c.addEventListener('input', () => {
    fig.classList.add('is-edited');
    const r = $('.ref-reset', fig); if (r) r.hidden = false;
    clearTimeout(t);
    t = setTimeout(() => { if (isLive(fig)) start(fig, { quiet: fig.dataset.mode === 'quiet' }); }, 700);
  });
}

// run what is on screen; stop what scrolled away (each frame is a whole p5 sketch)
const seen = new Set();
function wake(fig) {
  if (!AUTO || fig.dataset.userStopped || isLive(fig) || !seen.has(fig)) return;
  if (sketches.filter(isLive).length >= MAX_LIVE) return;
  start(fig, { quiet: true });
}
const io = 'IntersectionObserver' in window ? new IntersectionObserver((ents) => {
  for (const en of ents) {
    const fig = en.target;
    clearTimeout(fig._wake);
    if (en.isIntersecting) { seen.add(fig); fig._wake = setTimeout(() => wake(fig), 250); }
    else { seen.delete(fig); if (isLive(fig)) stop(fig); setTimeout(() => { for (const f of seen) wake(f); }, 0); }
  }
}, { rootMargin: '40px 0px' }) : null;
if (io) for (const fig of sketches) io.observe(fig);

const auto = $('.ref-auto input');
if (auto && io) {
  auto.checked = AUTO;
  auto.addEventListener('change', () => {
    AUTO = auto.checked;
    try { localStorage.setItem('oav-ref-auto', AUTO ? '1' : '0'); } catch { /* private window */ }
    if (AUTO) for (const f of seen) wake(f);
    else for (const f of sketches) if (isLive(f) && f.dataset.mode === 'quiet') stop(f);
  });
  $('.ref-auto').hidden = false;
}

// which p5 the live examples use (1.x is what OpenProcessing opens by default; 2.x for the new editor)
const sel = $('.ref-p5v select');
if (sel && R.p5) {
  for (const v of R.p5.list) { const o = document.createElement('option'); o.value = v; o.textContent = v; sel.append(o); }
  sel.value = pickedP5();
  sel.addEventListener('change', () => { try { localStorage.setItem('oav-ref-p5', sel.value); } catch { /* private window */ } for (const fig of sketches) if (isLive(fig)) start(fig, { quiet: fig.dataset.mode === 'quiet' }); });
  $('.ref-p5v').hidden = false;
}
void root;
