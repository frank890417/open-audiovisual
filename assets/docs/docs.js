// open-audiovisual docs — the small amount of behaviour the static handbook needs.
// The page is complete without this file; it only adds:
//   · scroll-spy: the contents highlight where you are (and the language switch keeps your place)
//   · the narrow-screen contents drawer
//   · copy buttons on code blocks, and copy-link on heading anchors

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
let i18n = {};
try { i18n = JSON.parse($('#oav-docs-i18n')?.textContent || '{}'); } catch { /* defaults below */ }
const T = { copy: 'Copy', copied: 'Copied', linkCopied: 'Link copied', tocButton: 'Contents', tocClose: 'Close contents', ...i18n };

const root = document.documentElement;
const side = $('.docs-side');
const toggle = $('.toc-toggle');
const where = $('.docs-bar-where');
const toast = $('.docs-toast');

// ───────── copy ─────────
function flash(msg) {
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(flash.t);
  flash.t = setTimeout(() => toast.classList.remove('show'), 1600);
}

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}

for (const btn of $$('.term .copy')) {
  btn.hidden = false;
  btn.addEventListener('click', async () => {
    const pre = btn.closest('.term').querySelector('pre');
    if (await copyText(pre.innerText.replace(/\n$/, ''))) {
      btn.textContent = T.copied; btn.dataset.done = '';
    } else {
      // no clipboard permission: select the code so ⌘C / Ctrl+C works
      const r = document.createRange(); r.selectNodeContents(pre);
      getSelection().removeAllRanges(); getSelection().addRange(r);
    }
    setTimeout(() => { btn.textContent = T.copy; delete btn.dataset.done; }, 1600);
  });
}

// heading anchors: follow the link as usual, and put the full URL on the clipboard
document.addEventListener('click', async (e) => {
  const a = e.target.closest?.('a.anchor');
  if (!a) return;
  const url = location.origin + location.pathname + a.getAttribute('href');
  if (await copyText(url)) flash(T.linkCopied);
});

// ───────── contents drawer (narrow screens) ─────────
const narrow = matchMedia('(max-width: 1000px)');
function setDrawer(open) {
  root.classList.toggle('toc-open', open);
  toggle?.setAttribute('aria-expanded', String(open));
  const label = toggle?.querySelector('.toc-toggle-label');
  if (label) label.textContent = open ? T.tocClose : T.tocButton;
  if (open) {
    const cur = $('.toc a[aria-current="true"]', side) || $('.toc a', side);
    cur?.scrollIntoView({ block: 'center' });
    cur?.focus({ preventScroll: true });
  }
}
toggle?.addEventListener('click', () => setDrawer(!root.classList.contains('toc-open')));
side?.addEventListener('click', (e) => { if (e.target.closest('a') && root.classList.contains('toc-open')) setDrawer(false); });
addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && root.classList.contains('toc-open')) { setDrawer(false); toggle?.focus(); }
});
narrow.addEventListener?.('change', () => { if (!narrow.matches) setDrawer(false); });

// ───────── scroll-spy ─────────
const heads = $$('.docs-main .chapter h2[id], .docs-main .chapter h3[id]');
const links = new Map($$('.toc a[href^="#"]').map((a) => [decodeURIComponent(a.getAttribute('href').slice(1)), a]));
const chapterOf = new Map(heads.map((h) => [h.id, h.closest('.chapter')?.dataset.chapter]));
const titleOf = new Map($$('.toc-ch').map((li) => [li.dataset.ch, li.querySelector(':scope > a .t')?.textContent || '']));
const langLinks = $$('.langs a[data-lang]').map((a) => ({ a, base: a.getAttribute('href').split('#')[0] }));
let tops = [];
let current;

function measure() { tops = heads.map((h) => h.getBoundingClientRect().top + scrollY); spy(true); }

function spy(force = false) {
  const pad = parseFloat(getComputedStyle(root).scrollPaddingTop) || 80;
  const line = scrollY + pad + 12;
  let lo = 0, hi = tops.length - 1, k = -1;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (tops[m] <= line) { k = m; lo = m + 1; } else hi = m - 1; }
  const id = k >= 0 ? heads[k].id : null;
  if (id === current && !force) return;
  current = id;

  for (const a of $$('.toc a[aria-current]')) a.removeAttribute('aria-current');
  for (const li of $$('.toc-ch.is-current')) li.classList.remove('is-current');
  for (const { a, base } of langLinks) a.setAttribute('href', base + (id ? '#' + id : ''));
  if (!id) { if (where) where.textContent = ''; return; }

  const ch = chapterOf.get(id);
  const li = $(`.toc-ch[data-ch="${CSS.escape(ch)}"]`);
  li?.classList.add('is-current');
  const link = links.get(id);
  link?.setAttribute('aria-current', 'true');
  if (where) where.textContent = titleOf.get(ch) + (id !== ch && link ? ' · ' + link.textContent : '');

  // keep the highlighted entry in view inside the sidebar (desktop), without moving the page
  if (link && side && !narrow.matches && side.scrollHeight > side.clientHeight) {
    const r = link.getBoundingClientRect(), s = side.getBoundingClientRect();
    if (r.top < s.top + 48 || r.bottom > s.bottom - 48) side.scrollTop += r.top - s.top - s.height / 3;
  }
}

let ticking = false;
addEventListener('scroll', () => {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => { ticking = false; spy(); });
}, { passive: true });
addEventListener('resize', measure);
if ('ResizeObserver' in window) new ResizeObserver(() => measure()).observe($('.docs-main'));

// a deep link (/docs/#mapping-curves) must land on its heading even though web fonts
// arrive after the browser's first jump and reflow everything above it
let userMoved = false;
for (const ev of ['wheel', 'touchstart', 'keydown', 'pointerdown']) addEventListener(ev, () => { userMoved = true; }, { once: true, passive: true });
function settle() {
  const id = decodeURIComponent(location.hash.slice(1));
  const el = id && document.getElementById(id);
  if (el && !userMoved) el.scrollIntoView({ block: 'start' });
  measure();
}
document.fonts?.ready.then(settle);
addEventListener('load', settle);
measure();
