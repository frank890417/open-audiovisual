// /controllers/<id>/ — makes a device's own page playable. Everything on the page (title, text, the whole
// MIDI table, sources, snippets) is already HTML; this only loads the <oav-controller> element, which
// swaps the live faceplate in over the static one, and wires the copy buttons.
// Nothing here asks for MIDI: the element's Connect button does, when the visitor presses it.

import { PROFILES } from '../../packages/midi/element.js?v=b10fa0c';

const T = JSON.parse(document.getElementById('ctl-i18n').textContent);
if (!PROFILES.some((p) => p.id === T.profile)) console.warn('[controllers] unknown profile', T.profile);

document.addEventListener('click', async (e) => {
  const b = e.target.closest('.copy[data-copy]'); if (!b) return;
  const pre = document.getElementById(b.dataset.copy); if (!pre) return;
  try { await navigator.clipboard.writeText(pre.textContent); }
  catch { const r = document.createRange(); r.selectNodeContents(pre); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); return; }
  b.textContent = T.copied; b.dataset.done = '';
  setTimeout(() => { b.textContent = T.copy; delete b.dataset.done; }, 1400);
});
