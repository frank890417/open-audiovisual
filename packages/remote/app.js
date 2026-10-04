// @openav/remote · app — a TouchOSC-like page shell for a phone or iPad.
//
//   ┌ header: ● connected · 1 show · 12 ms · room · phone/ab12 · ⛶ ┐
//   │                                                              │
//   │   [ current page ]                                            │
//   │                                                              │
//   └ tabs:  感測 · 琴鍵 · 控制台 ──────────────────────────────────┘
//   (portrait: tabs at the bottom, thumb range; landscape: a slim left rail,
//    so the page keeps the full height — a keyboard needs every pixel)
//
// Pages share ONE relay connection (role controller). Signals:
//   感測    phone/<id>/…         (sensors.js — same names as the lab's /control)
//   琴鍵    midi/note/on|off     (same shape as a hardware keyboard) + midi/cc/64
//   控制台  surface/<page>/<id>  (a layout JSON, or the show's own params via autoSurface)
//   MIDI    midi/<device>/…      (a virtual MIDI controller — packages/midi/remote-tab.js)
// Tabs beyond the three built-ins are PLUGINS a package declares in its package.json
// (`lab.remoteTab`: {id, label, icon, entry}); a host may pass the list as
// window.__REMOTE__.tabs (the lab generates it from those declarations), else
// DEFAULT_PLUGIN_TABS below — a test keeps it equal to the declarations.
// Where the control page's layout comes from, in priority order:
//   1. ?surface=<url to layout.json>           (explicit)
//   2. ?meta=<url to a JSON with .params>      → autoSurface(params)   (explicit)
//   3. whatever the show (runner) publishes over the relay as config "surface"
//   4. a small generic panel, so the page is never blank
// A host page may preseed window.__REMOTE__ = { room, surface, meta, work } (the lab server does).

import { RelayClient, deviceId } from '../relay/index.js?v=f860ae3';
import { Surface, autoSurface, lockViewport, keepAwake, canFullscreen, toggleFullscreen, injectTheme } from '../surface/index.js?v=f860ae3';
import { PhoneSensors, attachTouchPad } from './sensors.js?v=f860ae3';

const CSS = `
.rm { position: fixed; inset: 0; display: grid; background: var(--oav-bg); color: var(--oav-text); font: 14px/1.35 var(--oav-font);
  grid-template-rows: auto minmax(0, 1fr) auto; grid-template-columns: minmax(0, 1fr);
  grid-template-areas: "hd" "pg" "tb"; padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
  -webkit-user-select: none; user-select: none; touch-action: none; }
.rm * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
.rm-hd { grid-area: hd; display: flex; align-items: center; gap: 10px; padding: 6px 12px; min-height: 36px; border-bottom: 1px solid var(--oav-line); font-size: 12px; color: var(--oav-dim); white-space: nowrap; overflow: hidden; }
.rm-dot { width: 9px; height: 9px; border-radius: 50%; background: var(--oav-bad); flex: none; }
.rm-dot.open { background: var(--oav-warn); } .rm-dot.live { background: var(--oav-ok); }
.rm-hd .sp { flex: 1; }
.rm-hd .mono { font-family: var(--oav-mono); }
.rm-fs { border: 1px solid var(--oav-line); background: var(--oav-surface); color: var(--oav-text); border-radius: 8px; width: 34px; height: 28px; font-size: 14px; touch-action: manipulation; }
.rm-pg { grid-area: pg; position: relative; min-height: 0; min-width: 0; }
.rm-page { position: absolute; inset: 0; display: none; }
.rm-page.on { display: block; }
.rm-tb { grid-area: tb; display: flex; border-top: 1px solid var(--oav-line); background: var(--oav-surface); }
.rm-tab { flex: 1; min-height: 52px; border: 0; background: none; color: var(--oav-dim); font: 700 13px var(--oav-font); letter-spacing: .06em; display: grid; place-items: center; gap: 0; touch-action: manipulation; }
.rm-tab .ic { font-size: 18px; line-height: 1; }
.rm-tab.on { color: var(--oav-accent); box-shadow: inset 0 2px 0 var(--oav-accent); }
@media (orientation: landscape) and (max-height: 600px) {
  .rm { grid-template-rows: auto minmax(0, 1fr); grid-template-columns: 62px minmax(0, 1fr); grid-template-areas: "tb hd" "tb pg"; }
  .rm-tb { flex-direction: column; border-top: 0; border-right: 1px solid var(--oav-line); }
  .rm-tab { min-height: 0; } .rm-tab.on { box-shadow: inset 2px 0 0 var(--oav-accent); }
  .rm-hd { padding: 4px 12px; min-height: 30px; }
}

/* sense page */
.sn { position: absolute; inset: 0; display: grid; gap: 10px; padding: 10px; grid-template-rows: minmax(0, 1.05fr) minmax(0, 1fr); grid-template-columns: minmax(0, 1fr); }
@media (orientation: landscape) { .sn { grid-template-rows: minmax(0, 1fr); grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); } }
.sn-a { display: flex; flex-direction: column; gap: 8px; min-height: 0; }
.sn-arena { position: relative; flex: 1; min-height: 0; border-radius: 16px; background: radial-gradient(circle at 50% 50%, #18202e, var(--oav-surface)); border: 1px solid var(--oav-line); overflow: hidden; }
.sn-arena::before, .sn-arena::after { content: ''; position: absolute; left: 50%; top: 50%; border: 1px dashed var(--oav-line); border-radius: 50%; transform: translate(-50%, -50%); }
.sn-arena::before { width: 33%; aspect-ratio: 1; } .sn-arena::after { width: 66%; aspect-ratio: 1; }
.sn-ball { position: absolute; width: 18%; max-width: 64px; aspect-ratio: 1; border-radius: 50%; left: 50%; top: 50%; margin: -9% 0 0 -9%; background: radial-gradient(circle at 35% 30%, #fff, var(--oav-accent) 55%, #2b4a9a); box-shadow: 0 0 24px -4px var(--oav-accent); will-change: transform; }
.sn-knock { position: absolute; inset: 0; border-radius: inherit; background: var(--oav-warn); opacity: 0; pointer-events: none; }
.sn-lbl { position: absolute; left: 12px; top: 8px; font: 700 10.5px var(--oav-font); letter-spacing: .1em; color: var(--oav-dim); text-transform: uppercase; }
.sn-read { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; font: 600 11px var(--oav-mono); color: var(--oav-dim); }
.sn-read div { background: var(--oav-surface); border: 1px solid var(--oav-line); border-radius: 10px; padding: 6px 8px; min-width: 0; overflow: hidden; }
.sn-read b { display: block; color: var(--oav-text); font-weight: 600; margin-top: 1px; font-variant-numeric: tabular-nums; }
.sn-ctl { display: flex; gap: 6px; }
.sn-ctl button, .sn-ctl label { flex: 1; min-height: 40px; border-radius: 10px; border: 1px solid var(--oav-line); background: var(--oav-surface); color: var(--oav-text); font: 600 12px var(--oav-font); display: grid; place-items: center; touch-action: manipulation; padding: 0 6px; text-align: center; }
.sn-ctl label input { margin-right: 6px; accent-color: var(--oav-accent); }
.sn-pad { position: relative; border-radius: 16px; border: 1px dashed #3a4258; background: radial-gradient(circle at 50% 50%, #151b27, var(--oav-bg)); overflow: hidden; touch-action: none; min-height: 0; }
.sn-pad .hint { position: absolute; inset: 0; display: grid; place-items: center; color: var(--oav-dim); font-size: 12px; pointer-events: none; text-align: center; padding: 0 16px; }
.sn-pad .f { position: absolute; width: 56px; height: 56px; margin: -28px 0 0 -28px; border-radius: 50%; border: 2px solid var(--oav-accent); background: rgba(126,166,255,.25); pointer-events: none; }
.sn-start { position: absolute; inset: 0; z-index: 3; display: grid; place-items: center; padding: 20px; background: rgba(10,12,17,.86); }
.sn-start button { width: min(420px, 100%); padding: 28px 0; font: 800 26px var(--oav-font); border: 0; border-radius: 22px; background: var(--oav-accent); color: #001; touch-action: manipulation; }
.sn-start p { margin: 14px 0 0; text-align: center; color: var(--oav-dim); font-size: 13px; max-width: 420px; }
.sn-msg { position: absolute; left: 12px; right: 12px; bottom: 8px; z-index: 2; color: var(--oav-warn); font-size: 12px; text-align: center; pointer-events: none; }
`;

const GENERIC = {
  version: 1, title: 'generic',
  pages: [{ id: 'main', title: 'Generic', grid: { cols: 8, rows: 4 }, widgets: [
    { id: 'f1', type: 'fader', label: 'A', color: 'cyan', x: 0, y: 0, w: 1, h: 4 },
    { id: 'f2', type: 'fader', label: 'B', color: 'amber', x: 1, y: 0, w: 1, h: 4 },
    { id: 'f3', type: 'fader', label: 'C', color: 'magenta', x: 2, y: 0, w: 1, h: 4 },
    { id: 'f4', type: 'fader', label: 'D', color: 'lime', x: 3, y: 0, w: 1, h: 4 },
    { id: 'xy', type: 'xy', label: 'XY', color: 'violet', x: 4, y: 0, w: 4, h: 3 },
    { id: 'b1', type: 'button', label: 'Trigger', color: 'coral', x: 4, y: 3, w: 2, h: 1 },
    { id: 't1', type: 'toggle', label: 'Hold', color: 'white', x: 6, y: 3, w: 2, h: 1 },
  ] }],
};
/** Same as the `remoteTab` declarations in packages/<pkg>/package.json (tests/remote-tabs.test.js checks). */
export const DEFAULT_PLUGIN_TABS = [{ id: 'midi', label: 'MIDI', icon: '🎛', entry: 'midi/remote-tab.js' }];

const KEYS_LAYOUT = { version: 1, pages: [{ id: 'keys', title: 'Keys', grid: { cols: 8, rows: 4 }, widgets: [{ id: 'kb', type: 'keyboard', color: 'cyan', x: 0, y: 0, w: 8, h: 4 }] }] };

const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };

/**
 * @param {HTMLElement} root
 * @param {object} [opts]  room, relayUrl, surfaceUrl, metaUrl, work — each also readable from window.__REMOTE__ / the query string
 */
export function mountRemote(root, opts = {}) {
  injectTheme();
  const q = new URLSearchParams(location.search);
  const pre = window.__REMOTE__ || {};
  const cfg = {
    room: opts.room || q.get('room') || pre.room || 'default',
    // ?relay=wss://host/relay：public pages whose show runs elsewhere (the lab's public site uses a relay on its own
    // host, close to the phones). Only ws:/wss: — a link must not be able to point the phone anywhere else.
    relayUrl: opts.relayUrl || [q.get('relay'), pre.relay].find((u) => typeof u === 'string' && /^wss?:\/\//i.test(u)) || null,
    surfaceUrl: opts.surfaceUrl || q.get('surface') || pre.surface || null,
    metaUrl: opts.metaUrl || q.get('meta') || pre.meta || null,
    tab: q.get('tab') || null,
  };
  if (!document.getElementById('openav-remote-css')) {
    const st = h('style'); st.id = 'openav-remote-css'; st.textContent = CSS; document.head.appendChild(st);
  }
  const unlock = lockViewport();
  const awake = keepAwake();

  // ---------- link ----------
  let surface = null, explicit = false, controlSurface = null;
  const id = deviceId();
  const relay = new RelayClient({
    role: 'controller', room: cfg.room, id,
    onStatus: paintStatus,
    onFeedback: (name, value) => { controlSurface?.feedback(name, value); for (const fn of fbSubs) { try { fn(name, value); } catch (e) { console.error('[remote] tab feedback', e); } } },
    onConfig: (key, data) => { configs[key] = data; if (key === 'surface' && !explicit && data?.layout) loadControl(data.layout); for (const fn of cfgSubs) { try { fn(key, data); } catch (e) { console.error('[remote] tab config', e); } } },
  });
  const fbSubs = new Set(), cfgSubs = new Set(), configs = {};
  if (cfg.relayUrl) relay.url = cfg.relayUrl + (cfg.relayUrl.includes('?') ? '&' : '?') + `role=controller&room=${encodeURIComponent(cfg.room)}&id=${encodeURIComponent(id)}`;
  const P = (n) => `phone/${id}/${n}`;
  const phoneIO = { set: (n, v) => relay.set(P(n), v), send: (n, v, p) => relay.send(P(n), v, p) };
  const sink = (name, value, info = {}) => { if (info.pulse) relay.send(name, value, true); else relay.set(name, value); };

  // ---------- shell ----------
  const rm = h('div', 'rm');
  const hd = h('div', 'rm-hd', `<span class="rm-dot"></span><span class="st">連線中…</span><span class="sp"></span><span class="mono rm-room"></span><span class="mono">phone/${id}</span>`);
  const pg = h('div', 'rm-pg');
  const tb = h('div', 'rm-tb');
  const plugins = (Array.isArray(pre.tabs) ? pre.tabs : DEFAULT_PLUGIN_TABS).filter((t) => t && /^[\w-]+$/.test(t.id || '') && typeof t.entry === 'string' && /^[\w./-]+\.js$/.test(t.entry) && !t.entry.includes('..'));
  const PAGES = [['sense', '感測', '◎'], ['keys', '琴鍵', '♪'], ['control', '控制台', '☰'], ...plugins.map((t) => [t.id, t.label || t.id, t.icon || '◇'])];
  const pages = {}, tabs = {}, mounted = {};
  for (const [key, label, ic] of PAGES) {
    pages[key] = h('div', 'rm-page'); pages[key].dataset.page = key; pg.appendChild(pages[key]);
    const t = h('button', 'rm-tab', `<span class="ic">${ic}</span><span>${label}</span>`); t.type = 'button';
    t.addEventListener('pointerdown', (e) => { e.preventDefault(); show(key); });
    tb.appendChild(t); tabs[key] = t;
  }
  hd.querySelector('.rm-room').textContent = cfg.room === 'default' ? '' : '#' + cfg.room;
  if (canFullscreen()) { const fs = h('button', 'rm-fs', '⛶'); fs.type = 'button'; fs.addEventListener('pointerdown', (e) => { e.preventDefault(); toggleFullscreen(); }); hd.appendChild(fs); }
  rm.append(hd, pg, tb); root.appendChild(rm);

  function paintStatus(l) {
    const dot = hd.querySelector('.rm-dot'), st = hd.querySelector('.st');
    dot.className = 'rm-dot' + (l.status === 'open' ? (l.peers.runners ? ' live' : ' open') : '');
    st.textContent = l.status === 'open'
      ? (l.peers.runners ? `已連線 · 作品 ${l.peers.runners}` : '已連線 · 等作品開啟') + (l.latency != null ? ` · ${l.latency} ms` : '')
      : (l.status === 'connecting' ? '連線中…' : '斷線，重連中…');
  }

  let current = null;
  function show(key) {
    current = key;
    for (const k in pages) { pages[k].classList.toggle('on', k === key); tabs[k].classList.toggle('on', k === key); }
    try { sessionStorage.setItem('oav.remote.tab', key); } catch {}
    if (key === 'keys' && !keysSurface) buildKeys();
    if (key === 'control' && !controlSurface) loadControl(GENERIC);
    for (const [k, m] of Object.entries(mounted)) if (k !== key) m?.hide?.();
    const plug = plugins.find((t) => t.id === key);
    if (plug && !mounted[key]) mountPlugin(plug);
  }

  // ---------- plugin tabs (packages declare them; loaded on first open) ----------
  async function mountPlugin(t) {
    mounted[t.id] = { pending: true };
    try {
      const mod = await import(new URL('../' + t.entry, import.meta.url).href);
      mounted[t.id] = mod.mount(pages[t.id], {
        relay, sink, room: cfg.room, config: configs,
        onFeedback: (fn) => { fbSubs.add(fn); return () => fbSubs.delete(fn); },
        onConfig: (fn) => { cfgSubs.add(fn); return () => cfgSubs.delete(fn); },
      }) || {};
    } catch (e) {
      console.error('[remote] tab', t.id, e);
      pages[t.id].innerHTML = `<div style="padding:24px;color:#f5a524;font:14px system-ui">這個分頁載入失敗：${String(e.message || e).replace(/</g, '&lt;')}<br><small style="color:#8691a8">（JSON 模組需要 iOS／iPadOS 17.2 以上的 Safari）</small></div>`;
      mounted[t.id] = null;
    }
  }

  // ---------- 感測 ----------
  buildSense();
  function buildSense() {
    const p = pages.sense;
    p.innerHTML = `<div class="sn">
      <div class="sn-a">
        <div class="sn-arena"><span class="sn-lbl">傾斜 tilt</span><div class="sn-ball"></div><div class="sn-knock"></div></div>
        <div class="sn-read"><div>tilt<b class="r-tilt">0 · 0</b></div><div>accel<b class="r-acc">–</b></div><div>knock<b class="r-knock">–</b></div><div>light<b class="r-light">–</b></div></div>
        <div class="sn-ctl"><button class="c-cal" type="button">傾斜歸零</button><label><input type="checkbox" class="c-cam">光照（鏡頭）</label><button class="c-thr" type="button">敲擊門檻 <span class="thr">10</span></button></div>
      </div>
      <div class="sn-pad"><div class="hint">觸控板：手指在這裡滑動（多指）→ touch/*</div></div>
      <div class="sn-start"><div><button type="button">開始</button><p>iOS 需要在這裡點一下才會授權動作感測（HTTPS）。<br>觸控與琴鍵不需要授權。</p></div></div>
      <div class="sn-msg"></div></div>`;
    const $ = (s) => p.querySelector(s);
    const ball = $('.sn-ball'), arena = $('.sn-arena'), flash = $('.sn-knock');
    const live = { tx: 0, ty: 0 };
    const sensors = new PhoneSensors(phoneIO, {
      onSample: (n, v) => {
        if (n === 'tilt/x') live.tx = v; else if (n === 'tilt/y') live.ty = v;
        else if (n === 'accel/x') live.ax = v; else if (n === 'accel/y') live.ay = v; else if (n === 'accel/z') live.az = v;
        else if (n === 'light') $('.r-light').textContent = v.toFixed(2);
      },
      onKnock: (s) => { $('.r-knock').textContent = s.toFixed(2); flash.style.transition = 'none'; flash.style.opacity = String(0.2 + s * 0.45); requestAnimationFrame(() => { flash.style.transition = 'opacity .3s'; flash.style.opacity = '0'; }); },
      notify: (m) => { $('.sn-msg').textContent = m || ''; },
    });
    if (!window.isSecureContext) $('.sn-msg').textContent = '目前是 http：iOS 的感測器與攝影機要 HTTPS。觸控與琴鍵仍可用。';
    $('.sn-start button').addEventListener('click', async () => { await sensors.start(); $('.sn-start').remove(); });
    $('.c-cal').addEventListener('click', () => sensors.calibrate());
    $('.c-thr').addEventListener('click', () => { $('.thr').textContent = sensors.cycleThreshold(); });
    $('.c-cam').addEventListener('change', async (e) => { if (!(await sensors.setCamera(e.target.checked))) e.target.checked = false; });
    // paint at display rate, not sensor rate (devicemotion can burst)
    const paint = () => {
      const r = arena.getBoundingClientRect(), ext = Math.min(r.width, r.height) * 0.36;
      ball.style.transform = `translate(${(live.tx * ext).toFixed(1)}px, ${(live.ty * ext).toFixed(1)}px)`;
      $('.r-tilt').textContent = `${live.tx.toFixed(2)} · ${live.ty.toFixed(2)}`;
      if (live.ax != null) $('.r-acc').textContent = `${live.ax.toFixed(1)} ${live.ay.toFixed(1)} ${live.az.toFixed(1)}`;
      requestAnimationFrame(paint);
    };
    requestAnimationFrame(paint);
    const pad = $('.sn-pad'), fingers = new Map();
    attachTouchPad(pad, phoneIO, {
      onMove: (slot, x, y) => {
        let f = fingers.get(slot);
        if (!f) { f = h('div', 'f'); pad.appendChild(f); fingers.set(slot, f); }
        f.style.left = x * 100 + '%'; f.style.top = y * 100 + '%';
      },
      onEnd: (slot) => { fingers.get(slot)?.remove(); fingers.delete(slot); },
    });
  }

  // ---------- 琴鍵 ----------
  let keysSurface = null;
  function buildKeys() {
    keysSurface = new Surface(pages.keys, { layout: KEYS_LAYOUT, sink, tabs: false });
  }

  // ---------- 控制台 ----------
  function loadControl(layout) {
    try {
      if (controlSurface) controlSurface.setLayout(layout);
      else controlSurface = new Surface(pages.control, { layout, sink });
    } catch (e) { console.error('[remote] bad layout', e); pages.control.textContent = String(e.message); }
  }
  async function loadExplicit() {
    try {
      if (cfg.surfaceUrl) {
        const r = await fetch(cfg.surfaceUrl, { cache: 'no-store' });
        if (r.ok) { explicit = true; loadControl(await r.json()); return; }
      }
      if (cfg.metaUrl) {
        const r = await fetch(cfg.metaUrl, { cache: 'no-store' });
        if (r.ok) {
          const meta = await r.json();
          if (Array.isArray(meta.params) && meta.params.length) { explicit = true; loadControl(autoSurface(meta.params, { title: meta.titleZh || meta.title || '' }).layout); }
        }
      }
    } catch (e) { console.warn('[remote] could not load surface source', e); }
  }

  relay.connect();
  loadExplicit();
  let start = cfg.tab || q.get('page'); try { start = start || sessionStorage.getItem('oav.remote.tab'); } catch {}
  show(PAGES.some(([k]) => k === start) ? start : 'sense');

  return {
    relay, show, get surface() { return controlSurface; },
    dispose() { relay.close(); unlock(); awake.release(); controlSurface?.dispose(); keysSurface?.dispose(); for (const m of Object.values(mounted)) m?.dispose?.(); rm.remove(); },
  };
}
