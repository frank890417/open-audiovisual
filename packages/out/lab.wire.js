// lab.wire.js — @openav/out in the cheyuwu-lab runtime (declared in package.json → "lab").
// Runs inside the lab's generated runtime/modules/out.js, with `lab` (window.lab) and OutClient in scope.
// Not an ES module: no import/export, no top-level return.
//
// What a work gets from `"modules": ["out"]`:
//   lab.out.set(ch, v)        send one value to the hardware bridge (ch like "light/1/r", v a number)
//   lab.out.batch({ ch: v })  several at once; same channel twice in one frame → only the last leaves
//   lab.out.status            'connecting' | 'open' | 'closed' | 'sim' ; lab.out.onStatus(fn) → unsubscribe
//   lab.out.last              { ch: last value } (also in sim mode)
//   meta.params[i].out        "light/1/brightness" or an array: that param drives the channel(s) whenever it changes;
//                             the value is normalized to 0..1 by the param's min–max ("outRaw": true sends it as is)
//   meta.out                  { "url": "ws://…", "simulate": true }
//   ?out=sim                  no bridge; values only land in lab.out.last · ?out=ws://host:port/out another bridge · ?out=0 off
// The bridge: node open-audiovisual/packages/out/bridge/out-bridge.mjs --config out.json (127.0.0.1:6450).
// If the page stops sending, the bridge puts the hardware on its configured safe values.
(() => {
  const cfg = (lab.meta && typeof lab.meta.out === 'object' && lab.meta.out) || {};
  const qs = new URLSearchParams(location.search);
  const q = qs.get('out');
  const off = q != null && /^(0|false|no|off)$/i.test(q);
  const sim = q === 'sim' || q === 'mock' || (cfg.simulate === true && q == null);
  const url = q && /^wss?:\/\//.test(q) ? q : (typeof cfg.url === 'string' && cfg.url) || undefined;

  const out = new OutClient({ url, id: lab.id || null });
  lab.out = out;
  if (sim) out.simulate();
  else if (!off) out.connect();

  // https pages (lab.cheyuwu.com) need Chrome's loopback-network permission to reach 127.0.0.1; without it the status
  // just stays "connecting". After 5 s, say once how to fix it.
  if (!off && !sim && typeof document !== 'undefined' && (location.protocol === 'https:' || /^wss?:\/\/(127\.0\.0\.1|localhost)/.test(out.url))) {
    setTimeout(async () => {
      if (out.status !== 'connecting' || location.protocol !== 'https:') return;
      let state = '';
      try { state = (await navigator.permissions.query({ name: 'loopback-network' })).state; } catch { /* no such permission in this browser */ }
      if (out.status !== 'connecting') return;
      const msg = state === 'denied'
        ? '硬體輸出連不上：這個網站被設成不能連到這台電腦上的程式。點網址列左邊的「網站設定」，把「這台裝置上的應用程式與服務」改成允許，再重新整理。'
        : '硬體輸出還沒連上：確認這台電腦有開輸出橋接（open-audiovisual 的 out-bridge，127.0.0.1:6450）；Chrome 問能不能連到這台裝置上的程式時，按允許。';
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
      const un = out.onStatus((st) => { if (st !== 'connecting') { box.remove(); un(); } });
    }, 5000);
  }

  // ---- param → channel
  const toOut = (p, v) => {
    if (typeof v === 'boolean') return v ? 1 : 0;
    if (typeof v === 'string') {
      const i = Array.isArray(p.options) ? p.options.findIndex((o) => (o && typeof o === 'object' ? o.value : o) === v) : -1;
      return i < 0 || p.options.length < 2 ? null : (p.outRaw ? i : i / (p.options.length - 1));
    }
    if (typeof v !== 'number' || !Number.isFinite(v)) return null;
    if (p.outRaw) return v;
    const lo = typeof p.min === 'number' ? p.min : 0, hi = typeof p.max === 'number' ? p.max : 1;
    return hi === lo ? 0 : Math.min(1, Math.max(0, (v - lo) / (hi - lo)));
  };
  for (const p of (lab.meta && Array.isArray(lab.meta.params) ? lab.meta.params : [])) {
    if (!p || !p.key || !p.out) continue;
    const chs = [].concat(p.out).filter((c) => typeof c === 'string' && c);
    const push = (v) => { const o = toOut(p, v); if (o != null) for (const ch of chs) out.set(ch, o); };
    lab.on('param/' + p.key, (v) => push(v === undefined && lab.params ? lab.params[p.key] : v));
    if (lab.params && lab.params[p.key] !== undefined) push(lab.params[p.key]);      // the starting value goes out too
  }
})();
