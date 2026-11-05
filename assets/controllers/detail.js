// /controllers/<id>/ — makes a device's own page playable. Everything on the page (title, text, the whole
// MIDI table, sources, snippets) is already HTML; this only loads the <oav-controller> element, which
// swaps the live faceplate in over the static one, and wires the copy buttons.
// Nothing here asks for MIDI: the element's Connect button does, when the visitor presses it.

import { PROFILES } from '../../packages/midi/element.js?v=dd4a4d59';

const T = JSON.parse(document.getElementById('ctl-i18n').textContent);
if (!PROFILES.some((p) => p.id === T.profile)) console.warn('[controllers] unknown profile', T.profile);

// SysEx: nothing is asked for until the button is pressed, and nothing is sent until a Send is
const sxOn = document.getElementById('sx-on');
if (sxOn) {
  const ctl = document.getElementById('d-ctl'), say = (k, o = {}) => { document.getElementById('sx-status').textContent = String(T.sysex[k]).replace(/\{(\w+)\}/g, (m, x) => o[x] ?? m); };
  const color = document.getElementById('sx-color'), paint = document.getElementById('sx-paint');
  sxOn.addEventListener('click', async () => {
    await ctl.ready;
    say('asking');
    if (!(await ctl.enableSysex())) return say('denied');
    sxOn.disabled = true;
    for (const b of document.querySelectorAll('.sx-send')) b.disabled = false;
    if (color) color.disabled = paint.disabled = false;
    say(ctl.status.hardware === 'connected' ? 'ready' : 'noDevice');
  });
  document.addEventListener('click', (e) => {
    const b = e.target.closest('.sx-send'); if (!b) return;
    say(ctl.sendSysex(b.dataset.sysex) ? 'sent' : 'noDevice', { id: b.dataset.sysex });
  });
  paint?.addEventListener('click', () => {
    const n = parseInt(color.value.slice(1), 16), rgb = { r: n >> 16, g: (n >> 8) & 255, b: n & 255 };
    const sent = ctl.controller.profile.controls.filter((c) => c.ledIndex !== undefined && ctl.setLedColor(c.id, rgb)).length;
    say(sent ? 'painted' : 'noDevice', { n: sent });
  });
}

document.addEventListener('click', async (e) => {
  const b = e.target.closest('.copy[data-copy]'); if (!b) return;
  const pre = document.getElementById(b.dataset.copy); if (!pre) return;
  try { await navigator.clipboard.writeText(pre.textContent); }
  catch { const r = document.createRange(); r.selectNodeContents(pre); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); return; }
  b.textContent = T.copied; b.dataset.done = '';
  setTimeout(() => { b.textContent = T.copy; delete b.dataset.done; }, 1400);
});
