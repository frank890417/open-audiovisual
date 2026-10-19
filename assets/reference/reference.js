// open-audiovisual API reference — the behaviour the static page needs. The page is complete without this file
// (every entry is in the HTML); this adds:
//   · the search box: type and the entries narrow, best match first; ?q=micLevel arrives pre-filled; "/" focuses it
//   · live examples: ▶ Run puts the sketch in a sandboxed iframe (p5 + oav-p5 + the example), ■ Stop takes it away
//   · copy: an oav-p5 example is copied WITH the line that loads oav-p5, so it runs as pasted into OpenProcessing
// The categories drawer, scroll-spy and copy-link on anchors come from assets/docs/docs.js (same frame).

import { prepare, rank, tokens } from '../search/core.js?v=f3ec262';

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

// ───────── examples ─────────
const exOf = (btn) => btn.closest('.ref-ex');
const codeOf = (fig) => $('pre', fig).innerText.replace(/\n$/, '');
const withLoader = (fig, code) => (fig.dataset.run === 'sketch' ? LOADER + '\n\n' + code : code);

page.addEventListener('click', async (e) => {
  const copy = e.target.closest('.ref-copy');
  if (copy) {
    const fig = exOf(copy), text = withLoader(fig, codeOf(fig));
    if (await copyText(text)) { copy.textContent = T.copied; flash(fig.dataset.run === 'sketch' ? T.copyTitle || T.copied : T.copied); } else selectText($('pre', fig));
    setTimeout(() => { copy.textContent = copy.dataset.label; }, 1600);
    return;
  }
  const run = e.target.closest('.ref-run');
  if (run) {
    const fig = exOf(run), live = $('.ref-live', fig);
    if (!live.hidden) { stop(fig); return; }
    start(fig);
  }
});

function pickedP5() { try { return localStorage.getItem('oav-ref-p5') || R.p5.default; } catch { return R.p5.default; } }
function start(fig) {
  const live = $('.ref-live', fig), run = $('.ref-run', fig);
  const p5 = `https://cdn.jsdelivr.net/npm/p5@${pickedP5()}/lib/p5.min.js`;
  const oav = new URL(R.oav, location.href).href;
  const code = codeOf(fig).replace(/<\/script/gi, '<\\/script');
  const doc = `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:#111;overflow:hidden}</style>` +
    `<script>window.OAV_P5={panel:'closed'}</script><script src="${p5}"></script><script src="${oav}"></script><script>${code}</script>`;
  const f = document.createElement('iframe');
  f.title = T.frameTitle || 'Live example';
  f.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups allow-modals');
  f.setAttribute('allow', 'microphone; midi; autoplay');
  f.srcdoc = doc;
  live.replaceChildren(f); live.hidden = false;
  run.textContent = T.stop;
}
function stop(fig) {
  const live = $('.ref-live', fig), run = $('.ref-run', fig);
  live.replaceChildren(); live.hidden = true; run.textContent = T.run;
}

// which p5 the live examples use (1.x is what OpenProcessing opens by default; 2.x for the new editor)
const sel = $('.ref-p5v select');
if (sel && R.p5) {
  for (const v of R.p5.list) { const o = document.createElement('option'); o.value = v; o.textContent = v; sel.append(o); }
  sel.value = pickedP5();
  sel.addEventListener('change', () => { try { localStorage.setItem('oav-ref-p5', sel.value); } catch { /* private window */ } for (const fig of $$('.ref-ex')) if (!$('.ref-live', fig).hidden) start(fig); });
  $('.ref-p5v').hidden = false;
}
void root;
