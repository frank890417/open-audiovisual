// lab.wire.js — @openav/leap in the cheyuwu-lab runtime (declared in package.json → "lab").
// Runs inside the lab's generated runtime/modules/leap.js, with `lab` (window.lab) and every export of
// the files listed in the declaration in scope. Not an ES module: no import/export, no top-level return.
//
// What a work gets from `"modules": ["leap"]`:
//   lab.leap                  LeapInput connected to this machine's leap-bridge (ws://127.0.0.1:6437/v6.json)
//   leap/* signals            in lab.signals: lab.on('leap/hand/right/pinch-start', …), lab.get('leap/hand/right/y')
//   lab.leap.hands            [{ side, palm, fingers[5][5], pinch, grab, … }] in mm — for drawing the hand itself
//   lab.leap.frame            the latest frame (LeapJS v6 format); lab.leap.status, .device
//   lab.leap.bind(ref, key)   a leap signal drives a param: lab.leap.bind('hand/right/y', 'size') → lab.setParam
//   meta.params[i].leap       the same, declared: { "key": "size", …, "leap": "hand/right/y" }; a "leap/…" ref in
//                             meta.params[i].midi (what the workbench's ⌁ learn saves) works too
//   meta.leap                 { "url": "ws://…", "simulate": true, "fingers": false, "panel": true }
//   ?leap=sim                 mouse/touch simulator (no sensor) · ?leap=ws://host:port/v6.json another bridge · ?leap=0 off
//   ✋                         toolbar button: bridge → service → device status, and a live skeleton panel
// Old leap.js sketches need none of this: they connect to ws://127.0.0.1:6437 themselves, and the bridge answers.
(() => {
  const cfg = (lab.meta && typeof lab.meta.leap === 'object' && lab.meta.leap) || {};
  const qs = new URLSearchParams(location.search);
  const q = qs.get('leap');
  const off = q != null && /^(0|false|no|off)$/i.test(q);
  const sim = q === 'sim' || q === 'mock' || (cfg.simulate === true && q == null);
  const url = q && /^wss?:\/\//.test(q) ? q : (typeof cfg.url === 'string' && cfg.url) || undefined;

  const leap = new LeapInput({ signals: lab.signals, url, fingers: cfg.fingers !== false });
  lab.leap = leap;
  if (!off && !sim) leap.connect();
  if (sim) leap.simulate();

  // https 的網頁（lab.cheyuwu.com）連 127.0.0.1 要 Chrome 的「本機網路」許可（loopback-network）；被擋時狀態一直停在 connecting，
  // ✋ 的說明會誤寫成「沒有橋接」。連 5 秒還沒連上就提示一次怎麼開（2026-10-05，Chrome 154 實測：沒許可是 ERR_BLOCKED_BY_LOCAL_NETWORK_ACCESS_CHECKS）
  if (!off && !sim && typeof location !== 'undefined' && location.protocol === 'https:' && typeof document !== 'undefined') {
    setTimeout(async () => {
      if (leap.status !== 'connecting') return;
      let state = '';
      try { state = (await navigator.permissions.query({ name: 'loopback-network' })).state; } catch { /* 這個瀏覽器沒有這個許可名 */ }
      if (leap.status !== 'connecting') return;
      const msg = state === 'denied'
        ? 'Leap Motion 連不上：這個網站被設成不能連到這台電腦上的程式。點網址列左邊的「網站設定」，把「這台裝置上的應用程式與服務」改成允許，再重新整理。'
        : 'Leap Motion 還沒連上：確認這台電腦有開 Leap 橋接（open-audiovisual 的 leap-bridge，127.0.0.1:6437）；Chrome 問能不能連到這台裝置上的程式時，按允許。';
      const box = document.createElement('div');
      box.setAttribute('role', 'status');
      box.style.cssText = 'position:fixed;left:12px;bottom:12px;max-width:min(420px,calc(100vw - 24px));z-index:2147483646;font:13px/1.55 system-ui,sans-serif;color:#fff;background:rgba(20,20,24,.92);border:1px solid rgba(255,255,255,.18);border-radius:8px;padding:10px 34px 10px 12px';
      box.textContent = msg;
      const x = document.createElement('button');
      x.type = 'button'; x.textContent = '×'; x.setAttribute('aria-label', '關閉');
      x.style.cssText = 'position:absolute;right:6px;top:4px;background:none;border:0;color:#fff;font-size:18px;cursor:pointer';
      x.onclick = () => box.remove();
      box.appendChild(x);
      (document.body || document.documentElement).appendChild(box);
      const off2 = leap.onStatus((st) => { if (st !== 'connecting') { box.remove(); off2(); } });
    }, 5000);
  }

  // ---- signal → param (continuous control goes through params; same scaling as lab.midi.bind)
  const nameOf = (ref) => { const r = String(ref).trim(); return r.startsWith('leap/') ? r : 'leap/' + r.replace(/^\/+/, ''); };
  const bind = (ref, key) => {
    const name = nameOf(ref);
    return lab.signals.on(name, (v) => {
      const p = lab.paramSpecs && lab.paramSpecs[key];
      if (typeof v !== 'number') {                                     // a pulse (pinch-start…) flips a bool param
        if (p && p.type === 'bool') lab.setParam(key, !(lab.params && lab.params[key]));
        return;
      }
      const m = lab.signals.meta.get(name) || {};
      const lo = typeof m.min === 'number' ? m.min : 0, hi = typeof m.max === 'number' ? m.max : 1;
      const u = Math.min(1, Math.max(0, hi === lo ? 0 : (v - lo) / (hi - lo)));
      if (!p || p.type === 'number' || p.type === 'int') lab.setParam(key, p && typeof p.min === 'number' && typeof p.max === 'number' ? p.min + u * (p.max - p.min) : u);
      else if (p.type === 'bool') lab.setParam(key, u > 0.5);
      else if (p.type === 'enum' && Array.isArray(p.options) && p.options.length) { const o = p.options[Math.min(p.options.length - 1, Math.floor(u * p.options.length))]; lab.setParam(key, o && typeof o === 'object' ? o.value : o); }
    });
  };
  leap.bind = bind;
  for (const p of (lab.meta && Array.isArray(lab.meta.params) ? lab.meta.params : [])) {
    if (!p || !p.key) continue;
    const refs = [].concat(p.leap || []).concat([].concat(p.midi || []).filter((r) => /^leap\//.test(String(r))));
    for (const ref of new Set(refs.map(nameOf))) bind(ref, p.key);
  }

  // ---- ✋ status + skeleton panel (toolbar button; the dock when there is no toolbar)
  const place = () => {
    if (lab.hideUi || cfg.panel === false) return;
    const btn = document.createElement('button');
    btn.textContent = '✋';
    btn.style.cssText = 'padding:7px 10px;border-radius:10px;border:1px solid rgba(255,255,255,.35);background:rgba(20,20,24,.72);color:#fff;font:inherit;backdrop-filter:blur(6px);cursor:pointer';
    const COLOR = { tracking: '#37c978', simulated: '#7aa6ff', bridge: '#ffd166', 'no-device': '#ff9f43', 'no-service': '#ff9f43' };
    const paintBtn = () => {
      btn.style.borderColor = COLOR[leap.status] || 'rgba(255,90,95,.8)';
      btn.title = 'Leap Motion：' + ({ tracking: '追蹤中', simulated: '模擬（滑鼠／觸控）', bridge: '橋接已連上，等追蹤服務', 'no-service': '橋接已連上，Ultraleap 追蹤服務沒開', 'no-device': '追蹤服務在，沒接 Leap Motion', connecting: '沒有橋接（node open-audiovisual/packages/leap/bridge/leap-bridge.mjs）' }[leap.status] || leap.status);
    };
    leap.onStatus(paintBtn); paintBtn();
    let box = null, view = null;
    btn.onclick = (e) => {
      e.stopPropagation(); btn.blur();
      if (box) { view.destroy(); box.remove(); box = view = null; return; }
      box = document.createElement('div');
      box.id = 'lab-leap';
      box.style.cssText = 'position:fixed;right:8px;bottom:56px;z-index:2147483646;padding:8px;border-radius:10px;background:rgba(10,13,20,.92);border:1px solid #1c2334;backdrop-filter:blur(6px)';
      document.body.appendChild(box);
      view = mountLeapPanel(box, leap, { width: 260 });
    };
    let tries = 0;
    const t = setInterval(() => {   // lab.js builds its toolbar (#lab-rec) on DOMContentLoaded; static pages have none
      const row = document.getElementById('lab-rec');
      if (row && row.lastChild) { clearInterval(t); row.lastChild.insertBefore(btn, row.lastChild.lastChild); }
      else if (++tries > 12) { clearInterval(t); btn.id = 'lab-leap-btn'; btn.style.cssText += ';position:fixed;right:56px;bottom:8px;z-index:2147483646;font:13px system-ui,sans-serif'; document.body.appendChild(btn); }
    }, 150);
  };
  if (document.body) place(); else document.addEventListener('DOMContentLoaded', place);
})();
