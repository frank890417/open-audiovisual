// @openav/midi · panel — the controller you can dock under a work or open full screen.
//
//   const panel = mountMidiPanel(document.body, controllers, { mode: 'dock' });   // a drawer at the bottom
//   mountMidiPanel(el, controllers, { mode: 'full' });                             // fills `el` (phone tab, example page)
//
// Bar: which device (profiles) · where it comes from (● hardware port / ○ virtual)
// · which port drives it · 學習 learn · the last MIDI message (a tiny monitor,
// so you can see that the hardware is talking before you see what it moves).

import { ControllerView } from './view.js?v=993b491';

const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export const PANEL_CSS = `
.mcp { position: absolute; inset: 0; display: flex; flex-direction: column; background: #0b0d12; color: #e8ecf5; font: 13px/1.3 system-ui, -apple-system, 'Helvetica Neue', sans-serif;
  -webkit-user-select: none; user-select: none; z-index: 2147483000; }
.mcp * { box-sizing: border-box; }
.mcp.dock { position: fixed; inset: auto 0 0 0; height: var(--mcp-h, 40vh); min-height: 190px; max-height: 92vh; border-top: 1px solid #283044; box-shadow: 0 -12px 40px -10px rgba(0,0,0,.7);
  padding-bottom: env(safe-area-inset-bottom); }
.mcp.dock.contained { position: absolute; }
.mcp.dock.closed { display: none; }
.mcp-grip { position: absolute; left: 50%; top: -1px; width: 64px; height: 14px; margin-left: -32px; cursor: ns-resize; touch-action: none; display: none; }
.mcp-grip::after { content: ''; position: absolute; left: 18px; right: 18px; top: 5px; height: 3px; border-radius: 2px; background: #3a4258; }
.mcp.dock .mcp-grip { display: block; }
.mcp-bar { flex: none; display: flex; align-items: center; gap: 8px; padding: 7px 10px; border-bottom: 1px solid #1d2331; overflow-x: auto; scrollbar-width: none; white-space: nowrap; }
.mcp-bar::-webkit-scrollbar { display: none; }
.mcp-bar select, .mcp-bar button { flex: none; height: 30px; border-radius: 8px; border: 1px solid #2c3446; background: #151a24; color: #e8ecf5; font: 600 12.5px system-ui, sans-serif; padding: 0 10px; }
.mcp-bar select { max-width: 46vw; padding-right: 4px; }
.mcp-bar button { cursor: pointer; touch-action: manipulation; }
.mcp-bar button.on { background: #f5a524; border-color: #f5a524; color: #111; }
.mcp-chip { flex: none; display: inline-flex; align-items: center; gap: 6px; height: 26px; padding: 0 10px; border-radius: 99px; font: 600 12px system-ui, sans-serif; background: #151a24; color: #8691a8; border: 1px solid #222a3a; }
.mcp-chip i { width: 8px; height: 8px; border-radius: 50%; background: #5a6274; flex: none; }
.mcp-chip.hw { color: #c9f7d9; border-color: #1f5136; background: #0f2219; }
.mcp-chip.hw i { background: #3ddc84; box-shadow: 0 0 8px #3ddc84; }
.mcp-mon { flex: 1 0 auto; min-width: 80px; text-align: right; font: 600 11.5px ui-monospace, Menlo, monospace; color: #6f7a91; font-variant-numeric: tabular-nums; }
.mcp-mon.fresh { color: #9fd3ff; }
.mcp-hint { flex: none; padding: 6px 12px; font-size: 12.5px; color: #f5d08a; background: #231c0d; border-bottom: 1px solid #3a2f12; display: none; }
.mcp.learning .mcp-hint { display: block; }
.mcp-body { position: relative; flex: 1; min-height: 0; padding: 6px; }
.mcp.compact .mcp-port, .mcp.compact .mcp-mon { display: none; }
@media (max-width: 520px) { .mcp-mon { display: none; } .mcp-bar { gap: 6px; padding: 6px 8px; } .mcp-bar select { max-width: 52vw; } }
`;

function injectCss() {
  if (typeof document === 'undefined' || document.getElementById('openav-midi-panel-css')) return;
  const s = document.createElement('style'); s.id = 'openav-midi-panel-css'; s.textContent = PANEL_CSS; document.head.appendChild(s);
}

/**
 * @param {HTMLElement} parent
 * @param {import('./manager.js?v=993b491').MidiControllers} mcs
 * @param {object} [o]
 * @param {'dock'|'full'} [o.mode='full']
 * @param {boolean} [o.open=true]
 * @param {string} [o.id]               element id (hosts that skip their own UI by id prefix use it)
 * @param {(open:boolean)=>void} [o.onToggle]
 * @param {boolean} [o.closeButton]     dock mode: show ✕
 * @param {string[]} [o.profiles]       limit the picker to these ids
 * @param {boolean} [o.contained]       dock inside `parent` (absolute) instead of the viewport (fixed)
 */
export function mountMidiPanel(parent, mcs, { mode = 'full', open = true, id = null, onToggle = null, closeButton = mode === 'dock', profiles = null, contained = false } = {}) {
  injectCss();
  const el = h('div', `mcp ${mode}${open ? '' : ' closed'}${contained ? ' contained' : ''}`);
  if (id) el.id = id;
  const list = mcs.profiles.filter((p) => !profiles || profiles.includes(p.id));
  const opt = (p) => `<option value="${esc(p.id)}">${esc(p.name)}</option>`;
  el.innerHTML = `<div class="mcp-grip" title="拖曳調整高度"></div>
    <div class="mcp-bar">
      <select class="mcp-prof" title="控制器 (controller profile)"><optgroup label="裝置 devices">${list.filter((p) => p.kind === 'device').map(opt).join('')}</optgroup><optgroup label="通用 generic">${list.filter((p) => p.kind !== 'device').map(opt).join('')}</optgroup></select>
      <span class="mcp-chip"><i></i><span class="t"></span></span>
      <select class="mcp-port" title="哪個 MIDI 輸入驅動這台 (which hardware input drives it)"></select>
      <button type="button" class="mcp-learn" title="學習：點一個控制項，再動硬體 (learn)">學習</button>
      <button type="button" class="mcp-reset" title="還原這台的預設對應 (reset mapping)" style="display:none">還原</button>
      <span class="mcp-mon"></span>
      ${closeButton ? '<button type="button" class="mcp-x" title="收起 (close)">✕</button>' : ''}
    </div>
    <div class="mcp-hint"></div>
    <div class="mcp-body"></div>`;
  parent.appendChild(el);
  const $ = (s) => el.querySelector(s);
  const prof = $('.mcp-prof'), port = $('.mcp-port'), chip = $('.mcp-chip'), mon = $('.mcp-mon'), learnBtn = $('.mcp-learn'), resetBtn = $('.mcp-reset'), hint = $('.mcp-hint');
  let view = null, learning = false, unsubC = null, monT = null;

  const ensureView = () => {
    if (view || el.classList.contains('closed')) return;
    view = new ControllerView($('.mcp-body'), mcs.current);
    view.onLearnTap = (cid) => { hint.textContent = `已選「${mcs.current.control(cid)?.label || cid}」：現在動一下硬體上對應的控制項（或再點一次取消）`; };
  };
  const watch = () => {
    unsubC?.();
    unsubC = mcs.current.onChange((cid, st, info) => {
      if (info?.meta) { if (learning && !mcs.current.learning) hint.textContent = '已綁定。再點一個控制項繼續學，或按「學習」結束。'; return; }
      const e = mcs.current.lastEvent; if (!e) return;
      mon.textContent = e.text + (e.source === 'hw' ? ' · 硬體' : e.source === 'mirror' ? ' · 遠端' : '');
      mon.classList.add('fresh'); clearTimeout(monT); monT = setTimeout(() => mon.classList.remove('fresh'), 900);
    });
  };
  const paintChip = () => {
    const name = mcs.hardwareFor(mcs.current.id);
    chip.classList.toggle('hw', !!name);
    const noWebMidi = mcs.midi && !mcs.midi.enabled && typeof navigator !== 'undefined' && !navigator.requestMIDIAccess;
    chip.querySelector('.t').textContent = name ? '硬體 ' + name : mcs.midi?.enabled ? '虛擬（沒有接硬體）' : noWebMidi ? '虛擬（沒有 Web MIDI）' : '虛擬';
    chip.title = name ? `${name} 正在驅動畫面上的控制器` : '用手指或滑鼠操作；接上硬體會自動切換';
  };
  const paintPorts = () => {
    const devs = mcs.devices();
    port.style.display = devs.length ? '' : 'none';
    const cur = mcs.current.id;
    port.innerHTML = `<option value="">MIDI 輸入：${devs.length} 個</option>` + devs.map((d) => `<option value="${esc(d.slug)}"${d.profileId === cur ? ' selected' : ''}>${d.profileId === cur ? '● ' : ''}${esc(d.name)}${d.profileId && d.profileId !== cur ? ' → ' + esc(mcs.byId.get(d.profileId)?.name || d.profileId) : ''}</option>`).join('');
  };
  const paint = () => { prof.value = mcs.current.id; paintChip(); paintPorts(); learnBtn.classList.toggle('on', learning); resetBtn.style.display = learning ? '' : 'none'; el.classList.toggle('learning', learning); };

  prof.addEventListener('change', () => mcs.select(prof.value));
  port.addEventListener('change', () => { if (port.value) mcs.assign(port.value, mcs.current.id); });
  learnBtn.addEventListener('click', () => {
    learning = !learning; if (!learning) mcs.current.learning = null;
    hint.textContent = mcs.current.profile.learn
      ? '學習中：直接依序動你的硬體（旋鈕、推桿、打擊墊），會照順序填進這個通用版面；也可以先點一個控制項指定。'
      : '學習中：點畫面上的一個控制項，再動硬體上你要對應的那一個。';
    view?.setLearning(learning); paint();
  });
  resetBtn.addEventListener('click', () => { mcs.current.resetMapping(); hint.textContent = '已還原預設對應。'; });
  $('.mcp-x')?.addEventListener('click', () => api.close());
  // dock height: drag the grip, remembered per browser
  const grip = $('.mcp-grip');
  try { const hh = localStorage.getItem('openav.midi.panelH'); if (hh) el.style.setProperty('--mcp-h', hh); } catch { /* */ }
  grip.addEventListener('pointerdown', (e) => {
    e.preventDefault(); grip.setPointerCapture(e.pointerId);
    const mv = (ev) => { const hh = Math.max(190, Math.min(innerHeight * 0.92, innerHeight - ev.clientY)) + 'px'; el.style.setProperty('--mcp-h', hh); try { localStorage.setItem('openav.midi.panelH', hh); } catch { /* */ } };
    const up = () => { grip.removeEventListener('pointermove', mv); grip.removeEventListener('pointerup', up); };
    grip.addEventListener('pointermove', mv); grip.addEventListener('pointerup', up);
  });

  const off = mcs.onChange((e) => {
    if (e.type === 'select') { learning = false; view?.setController(mcs.current); view?.setLearning(false); watch(); }
    paint();
  });
  watch(); paint(); ensureView();

  const api = {
    el, get view() { return view; }, get isOpen() { return !el.classList.contains('closed'); },
    open() { el.classList.remove('closed'); ensureView(); onToggle?.(true); return api; },
    close() { el.classList.add('closed'); mcs.current.releaseAll(); onToggle?.(false); return api; },
    toggle() { return api.isOpen ? api.close() : api.open(); },
    dispose() { off(); unsubC?.(); view?.dispose(); el.remove(); },
  };
  return api;
}
