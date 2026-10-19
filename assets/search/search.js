// open-audiovisual site search — the nav's button, ⌘K / Ctrl+K / "/" , one dialog, results grouped by kind.
// Loaded by every page that has a top bar (tools/site/chrome.mjs headBasics). The page works without it: the button is a plain
// link to the API reference, which has its own search box. What this adds:
//   · the dialog (<dialog>, made the first time it opens), and the index (assets/search/index.json, fetched then, once)
//   · results from the API reference, the handbook (every section), the examples and the controllers, in both languages:
//     the page's own language first; the other language only when just that one matches (the keywords of each entry carry both,
//     so "麥克風" finds micLevel from the English site)
//   · ↑ ↓ to move, Enter to open, Esc to close; on a phone it is the whole screen's width
// The matching is assets/search/core.js; the index is built by tools/build-search.mjs from the same sources as the pages.

import { prepare, rank, tokens, snippet, weightBoost } from './core.js?v=2399f6b';

const here = new URL(import.meta.url);
const root = new URL('../../', here);
const stamp = here.search;                                   // ?v=<commit> on the deployed site: a new release fetches a new index
const lang = /^zh/i.test(document.documentElement.lang) ? 'zh' : 'en';
const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '');
const GROUPS = ['ref', 'doc', 'ex', 'ctl', 'page'];
const PER = { ref: 7, doc: 5, ex: 3, ctl: 3, page: 3 };

let recs = null, ui = null, loading = null, dlg = null, input = null, list = null, foot = null;
let items = [], active = -1, lastQ = '', opener = null;

const $ = (s, el = document) => el.querySelector(s);
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

function load() {
  if (!loading) {
    loading = fetch(new URL('assets/search/index.json' + stamp, root)).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); }).then((j) => {
      ui = j.ui[lang];
      recs = j.records.map((r) => prepare({ ...r, name: r.n, names: r.a, kw: r.k, title: r.s, summary: r.d, text: r.x }));
      return recs;
    });
  }
  return loading;
}

// ───────── the button
const buttons = [...document.querySelectorAll('[data-search]')];
for (const b of buttons) {
  const k = document.createElement('kbd'); k.setAttribute('aria-hidden', 'true'); k.textContent = isMac ? '⌘K' : 'Ctrl K'; b.append(k);
  b.addEventListener('click', (e) => { if (e.metaKey || e.ctrlKey || e.shiftKey || e.button) return; e.preventDefault(); open(b); });
  b.addEventListener('pointerenter', load, { once: true });
  b.addEventListener('focus', load, { once: true });
}
addEventListener('keydown', (e) => {
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '') || document.activeElement?.isContentEditable;
  if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === 'k') { e.preventDefault(); open(document.activeElement); return; }
  // "/" opens it, except where the page already uses "/" for its own search box (the API reference)
  if (e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey && !typing && !document.querySelector('#ref-q') && !(dlg && dlg.open)) { e.preventDefault(); open(null); }
});

// ───────── the dialog
function build() {
  if (dlg) return;
  const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = new URL('assets/search/search.css' + stamp, root).href; document.head.append(css);
  const b = buttons[0];
  dlg = el('dialog', 'oav-search');
  dlg.setAttribute('aria-label', b ? b.getAttribute('aria-label') : 'Search');
  const box = el('div', 'os-box');
  input = el('input', 'os-input');
  input.type = 'search'; input.autocomplete = 'off'; input.spellcheck = false; input.enterKeyHint = 'go';
  input.placeholder = b ? b.dataset.placeholder : '';
  input.setAttribute('aria-label', input.placeholder); input.setAttribute('role', 'combobox'); input.setAttribute('aria-expanded', 'true'); input.setAttribute('aria-controls', 'os-list');
  const close = el('button', 'os-close', '×'); close.type = 'button'; close.setAttribute('aria-label', 'Close');
  box.append(input, close);
  list = el('div', 'os-list'); list.id = 'os-list'; list.setAttribute('role', 'listbox');
  foot = el('p', 'os-foot');
  dlg.append(box, list, foot);
  document.body.append(dlg);
  close.addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });           // a click on the backdrop
  dlg.addEventListener('close', () => { document.documentElement.classList.remove('search-open'); if (opener && opener.focus && document.contains(opener)) opener.focus(); });
  input.addEventListener('input', () => render(input.value));
  dlg.addEventListener('keydown', onKey);
  list.addEventListener('mousemove', (e) => { const li = e.target.closest('[role=option]'); if (li) setActive(items.indexOf(li), false); });
  list.addEventListener('click', (e) => { const a = e.target.closest('a'); if (a) onPick(a, e); });
}

function open(from) {
  build();
  opener = from && from.focus ? from : null;
  if (!dlg.open) { dlg.showModal(); document.documentElement.classList.add('search-open'); }
  input.focus(); input.select();
  if (recs) render(input.value);
  else {
    list.replaceChildren(el('p', 'os-note', (buttons[0] && buttons[0].dataset.loading) || '…'));
    load().then(() => render(input.value), () => { list.replaceChildren(el('p', 'os-note', lang === 'zh' ? '搜尋索引沒有載入。API 參考頁有自己的搜尋框。' : 'The search index did not load. The API reference has its own search box.')); });
  }
}

function onKey(e) {
  if (e.key === 'Escape') { e.preventDefault(); dlg.close(); }                    // a search field eats Esc to clear itself: one press closes here
  else if (e.key === 'ArrowDown') { e.preventDefault(); setActive(Math.min(items.length - 1, active + 1), true); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(Math.max(0, active - 1), true); }
  else if (e.key === 'Enter' && items[active]) { e.preventDefault(); const a = $('a', items[active]); if (a) onPick(a, e); }
  else if (e.key === 'Home' && e.target !== input) { e.preventDefault(); setActive(0, true); }
  else if (e.key === 'End' && e.target !== input) { e.preventDefault(); setActive(items.length - 1, true); }
}

function setActive(i, scroll) {
  if (i === active) return;
  if (items[active]) { items[active].setAttribute('aria-selected', 'false'); items[active].classList.remove('is-active'); }
  active = i;
  const li = items[i];
  if (!li) { input.removeAttribute('aria-activedescendant'); return; }
  li.setAttribute('aria-selected', 'true'); li.classList.add('is-active'); input.setAttribute('aria-activedescendant', li.id);
  if (scroll) li.scrollIntoView({ block: 'nearest' });
}

/** Go there. Same page (the reference page's own cards): just move the hash and close. */
function onPick(a, e) {
  const to = new URL(a.href, location.href);
  if (e.type === 'click' && (e.metaKey || e.ctrlKey || e.shiftKey || e.button)) return;     // let the browser open a new tab
  if (to.pathname === location.pathname && to.hash) { e.preventDefault(); dlg.close(); location.hash = to.hash; return; }
  if (e.type !== 'click') { e.preventDefault(); location.href = to.href; return; }
  dlg.close();
}

// ───────── the results
function highlight(parent, text, toks) {
  for (const p of snippet(text, toks, { before: 200, after: 200 })) {
    if (p.hit) parent.append(el('mark', null, p.text)); else parent.append(document.createTextNode(p.text));
  }
}

function render(q) {
  lastQ = q;
  if (!recs) return;                                    // typed before the index arrived: open() renders once it has
  const toks = tokens(q);
  list.replaceChildren(); items = []; active = -1;
  if (!toks.length) { foot.textContent = ui ? ui.keys : ''; list.append(el('p', 'os-note', ui ? ui.hint : '')); return; }
  const boost = (r) => (r.l === lang ? 400 : 0) + weightBoost(r);   // the page's language first; then the entries other entries send you to
  const ranked = rank(recs, q, { boost });
  // one result per page: the page's language wins; the other language shows only if its twin did not match
  const seen = new Set(), uniq = [];
  for (const x of ranked) { if (seen.has(x.rec.i)) continue; seen.add(x.rec.i); uniq.push(x); }
  const byType = Object.fromEntries(GROUPS.map((g) => [g, []]));
  for (const x of uniq) byType[x.rec.t].push(x);
  let n = 0;
  for (const g of GROUPS) {
    const rows = byType[g];
    if (!rows.length) continue;
    const sec = el('section', 'os-group');
    sec.append(el('h3', 'os-h', ui.groups[g]));
    for (const { rec } of rows.slice(0, PER[g])) {
      const li = el('div', 'os-item'); li.setAttribute('role', 'option'); li.setAttribute('aria-selected', 'false'); li.id = `os-${n++}`;
      const a = el('a', 'os-a'); a.href = new URL(rec.u, root).href;
      const head = el('span', 'os-t'); highlight(head, rec.n, toks);
      a.append(head);
      if (rec.s || rec.l !== lang) {
        const sub = el('span', 'os-s', rec.s);
        if (rec.l !== lang) sub.append(el('span', 'os-lang', ui.otherLang[rec.l]));
        a.append(sub);
      }
      const src = rec.d && toks.some((w) => rec._summary.includes(w)) ? rec.d : (rec.x && toks.some((w) => rec._text.includes(w)) ? rec.x : rec.d);
      if (src) { const d = el('span', 'os-d'); for (const p of snippet(src, toks, { before: 40, after: 110 })) d.append(p.hit ? el('mark', null, p.text) : document.createTextNode(p.text)); a.append(d); }
      li.append(a); sec.append(li); items.push(li);
    }
    if (g === 'ref' && rows.length > PER.ref) {
      const more = el('a', 'os-more', ui.seeAll.replace('{n}', rows.length));
      more.href = new URL(`${lang === 'zh' ? 'zh/' : ''}docs/reference/?q=${encodeURIComponent(q.trim())}`, root).href;
      sec.append(more);
    }
    list.append(sec);
  }
  if (!items.length) list.append(el('p', 'os-note', ui.none.replace('{q}', q.trim())));
  foot.textContent = ui.keys;
  if (items.length) setActive(0, false);
}
