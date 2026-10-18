// @openav/tile · camera — the page that takes the photo: packages/tile/?room=<name>
//
//   1. every tile in the room appears in the list (they say hello once a second) and gets a number;
//   2. Markers: every tile paints its markers;
//   3. Take photo (the phone's camera app, full resolution) or Live camera (getUserMedia, one frame);
//   4. OpenCV.js finds the markers (loaded here, on first use), solve.js places every screen, the layout goes to the
//      room, and when every screen was placed the tiles play.
// ?demo=1 runs the same steps on a synthetic photo (three screens under a tilted camera, test/synth.js) and compares
// the layout with the truth: no relay, no screens, no camera needed.
//
// It joins the room as its `runner`: it hears the tiles' hello signals, and what it says (roster, mode, layout, show)
// is standing config that the relay replays to any tile that joins later.

import { TileLink, HELLO_RE, TILE_KEYS } from './join.js';
import { correspondences, GRID_DEFAULTS, drawMarkers, MAX_DEVICES } from './marker.js';
import { solveLayout, mul3, inv3, apply3, similarityOf } from './solve.js';
import { loadOpenCV, detectMarkers, greyPixels, OPENCV_URL } from './detect.js';

const COLORS = ['#ff7a59', '#7ea6ff', '#5fd39a', '#f2c94c', '#c58bff', '#4dd0e1', '#ff8fb1', '#a3e05f'];
const color = (i) => COLORS[i % COLORS.length];
const q = (k) => new URLSearchParams(location.search).get(k);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const CSS = `
:root{color-scheme:dark}
body{margin:0;background:#0a0c11;color:#dfe5f0;font:15px/1.45 system-ui,-apple-system,sans-serif}
.cam{max-width:860px;margin:0 auto;padding:14px 14px 40px}
.cam h1{font-size:18px;margin:4px 0 2px}
.cam .sub{color:#8f9bb3;font-size:13px;margin:0 0 12px}
.cam .mono{font-family:ui-monospace,monospace}
.cam .row{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}
.cam button,.cam label.btn,.cam a.btn{flex:1;min-width:120px;min-height:48px;border-radius:14px;border:1px solid #283044;background:#121722;color:#dfe5f0;
  font:700 15px system-ui;cursor:pointer;display:grid;place-items:center;padding:0 12px;text-align:center}
.cam button.on{background:#7ea6ff;color:#001;border-color:#7ea6ff}
.cam button:disabled{opacity:.45}
.cam input[type=file]{display:none}
.cam table{width:100%;border-collapse:collapse;font-size:13px;margin:6px 0}
.cam td,.cam th{border-bottom:1px solid #1c2334;padding:6px 4px;text-align:left}
.cam th{color:#8f9bb3;font-weight:600}
.cam .dot{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:6px;vertical-align:-1px}
.cam .msg{min-height:22px;color:#cfd6e4;white-space:pre-wrap}
.cam .warn{color:#f2c94c}.cam .bad{color:#ff7a59}.cam .ok{color:#5fd39a}
.cam canvas.photo,.cam video{width:100%;border-radius:12px;background:#000;display:block;margin-top:8px}
.cam canvas.plan{width:100%;border-radius:12px;background:#05060a;margin-top:8px;display:block}
.cam details{margin-top:14px;color:#8f9bb3;font-size:13px}
.cam a{color:#7ea6ff}
.cam [hidden]{display:none!important}
`;

export function mountCamera(el, { room = q('room') || 'tile', url = null, demo = q('demo') != null } = {}) {
  room = String(room).replace(/[^\w-]/g, '').slice(0, 32) || 'tile';
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const memoKey = `oav.tile.camera.${room}`;
  const memo = (() => { try { return JSON.parse(localStorage.getItem(memoKey) || 'null') || {}; } catch { return {}; } })();
  const saveMemo = () => { try { localStorage.setItem(memoKey, JSON.stringify(memo)); } catch {} };
  memo.indices ||= {};
  const grid = { ...GRID_DEFAULTS, ...(memo.grid || {}) };

  el.innerHTML = `<div class="cam">
    <h1>Tile · camera <span class="mono" id="room"></span></h1>
    <p class="sub"><span id="link">○ connecting</span> · <span id="clock">clock…</span></p>
    <table><thead><tr><th>#</th><th>screen</th><th>pixels</th><th>full · awake</th><th>last photo</th></tr></thead><tbody id="list"></tbody></table>
    <p class="sub" id="join"></p>
    <div class="row"><button id="markers">Markers 標記</button><button id="play">Play 演出</button></div>
    <div class="row">
      <label class="btn" for="file">📷 Take photo 拍照</label><input id="file" type="file" accept="image/*" capture="environment">
      <button id="live">Live camera</button><button id="snap" hidden>Capture</button>
    </div>
    <div class="msg" id="msg">Lay the screens flat, press Markers, then take the photo from above with every screen in it.</div>
    <video id="video" playsinline muted hidden></video>
    <canvas class="photo" id="photo" hidden></canvas>
    <canvas class="plan" id="plan" hidden></canvas>
    <div class="row"><button id="restart">New start + seed</button><a class="btn" id="dl" hidden download="layout.json">layout.json</a></div>
    <details><summary>How it works</summary>
      <p>Each tile paints ArUco markers (${GRID_DEFAULTS.short} across its short side) that say which screen and which cell they are.
      OpenCV.js (<span class="mono">${esc(OPENCV_URL.replace('https://', ''))}</span>, loaded on this page only) finds them;
      every screen needs 4 in view. The screens lie in one plane, so each screen's pixels map to the shared canvas by a
      similarity: turn, uniform scale, shift. The canvas is measured in the pixels of the screen that covers the most of the photo.</p>
      <p><a href="?demo=1&room=${esc(room)}">Try it on a synthetic photo</a> · <a href="https://github.com/frank890417/open-audiovisual/tree/main/packages/tile">README</a></p>
    </details>
  </div>`;
  const $ = (id) => el.querySelector('#' + id);
  $('room').textContent = room;
  const tilesUrl = new URL('../../examples/27-tile-dot/', location.href);
  tilesUrl.searchParams.set('room', room);
  $('join').innerHTML = `Screens open <a class="mono" href="${esc(tilesUrl.href)}">${esc(tilesUrl.href)}</a> (or any tiled show with ?room=${esc(room)}).`;

  const roster = new Map();        // id → { id, index, w, h, dpr, fullscreen, wake, seen }
  let mode = 'show', last = null;
  const api = { roster, get last() { return last; }, usePhoto, demo: runDemo, room };
  window.oavTileCamera = api;

  // ------------------------------------------------------------------ the room
  const link = new TileLink({
    role: 'runner', room, url, id: 'camera-' + Math.random().toString(36).slice(2, 6),
    onStatus: (c) => { $('link').textContent = c.open ? `● relay · ${c.peers.controllers} screen socket(s)` : '○ relay closed'; },
    onClock: (c) => { $('clock').textContent = `shared clock ±${(c.rtt / 2).toFixed(0)} ms`; },
    onSignal: (name, v) => {
      const m = HELLO_RE.exec(name);
      if (!m || !v || typeof v !== 'object' || !(v.w > 0 && v.h > 0)) return;
      const id = m[1];
      let d = roster.get(id);
      const fresh = !d;
      if (!d) { d = { id, index: indexFor(id) }; roster.set(id, d); }
      const resized = d.w !== v.w || d.h !== v.h;
      Object.assign(d, { w: Math.round(v.w), h: Math.round(v.h), dpr: v.dpr, fullscreen: !!v.fullscreen, wake: v.wake, seen: Date.now() });
      if (fresh || resized) sendRoster();
      list();
    },
  });
  function indexFor(id) {
    if (Number.isInteger(memo.indices[id])) return memo.indices[id];
    const used = new Set(Object.values(memo.indices));
    let i = 0; while (used.has(i) && i < MAX_DEVICES) i++;
    if (i >= MAX_DEVICES) { // the table is full: hand out the number of the screen seen longest ago
      const old = [...roster.values()].sort((a, b) => (a.seen || 0) - (b.seen || 0))[0];
      i = old ? old.index : 0;
      for (const k of Object.keys(memo.indices)) if (memo.indices[k] === i) delete memo.indices[k];
    }
    memo.indices[id] = i; saveMemo();
    return i;
  }
  const present = () => [...roster.values()].filter((d) => Date.now() - d.seen < 15000).sort((a, b) => a.index - b.index);
  let rosterT = null;
  function sendRoster() {
    clearTimeout(rosterT);
    rosterT = setTimeout(() => link.config(TILE_KEYS.roster, { v: 1, grid, devices: present().map(({ id, index, w, h }) => ({ id, index, w, h })) }), 150);
  }
  function setMode(m) {
    mode = m;
    link.config(TILE_KEYS.mode, m);
    $('markers').classList.toggle('on', m === 'markers'); $('play').classList.toggle('on', m === 'show');
  }
  function ensureShow(fresh = false) {
    if (!memo.show || fresh) { memo.show = { seed: 1 + Math.floor(Math.random() * 1e6), start: Math.round(link.clock.now()) }; saveMemo(); }
    link.config(TILE_KEYS.show, memo.show);
  }
  // the relay forgets a runner's config when it leaves: say it all again on every (re)connect
  let said = false;
  link.onStatus = ((prev) => (c) => {
    prev(c);
    if (c.open && !said) {
      said = true;
      sendRoster(); link.config(TILE_KEYS.mode, mode);
      if (memo.show) link.config(TILE_KEYS.show, memo.show);
      if (memo.layout) link.config(TILE_KEYS.layout, memo.layout);
    }
    if (!c.open) said = false;
  })(link.onStatus);
  if (!demo) link.connect();
  else { $('link').textContent = 'demo · a synthetic photo, no relay'; $('clock').textContent = 'nothing is sent'; }

  $('markers').onclick = () => setMode('markers');
  $('play').onclick = () => { ensureShow(); setMode('show'); };
  $('restart').onclick = () => { ensureShow(true); msg('New start and seed sent: every screen starts the show again, together.'); };
  setInterval(list, 1000);

  // ------------------------------------------------------------------ the photo
  $('file').onchange = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (f) await usePhoto(f);
  };
  let stream = null;
  $('live').onclick = async () => {
    if (stream) { stopLive(); return; }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 4096 }, height: { ideal: 3072 } }, audio: false });
      const v = $('video'); v.srcObject = stream; v.hidden = false; await v.play();
      $('snap').hidden = false; $('live').textContent = 'Stop camera';
    } catch (err) { msg(`No camera: ${err.message || err}. Take a photo instead.`, 'bad'); stream = null; }
  };
  $('snap').onclick = async () => {
    const v = $('video');
    const c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext('2d').drawImage(v, 0, 0);
    stopLive();
    await usePhoto(c);
  };
  function stopLive() { stream?.getTracks().forEach((t) => t.stop()); stream = null; $('video').hidden = true; $('snap').hidden = true; $('live').textContent = 'Live camera'; }

  function msg(text, cls = '') { const m = $('msg'); m.className = 'msg ' + cls; m.textContent = text; }

  /** Detect, solve, send. `src`: a File/Blob, an image, a canvas. Resolves with the result (also window.oavTileCamera.last). */
  async function usePhoto(src, { devices = present(), send = !demo, truth = null } = {}) {
    try {
      const img = src instanceof Blob ? await createImageBitmap(src, { imageOrientation: 'from-image' }) : src;
      drawPhoto(img);
      if (!devices.length) { msg('No screen in the room yet: open the tile page on each screen first.', 'warn'); return (last = { ok: false, reason: 'no-screens' }); }
      msg('Loading OpenCV.js (once, about 3 MB)…');
      const cv = await loadOpenCV();
      msg('Finding markers…');
      await new Promise((r) => setTimeout(r, 30));
      const grey = greyPixels(img);
      const det = detectMarkers(cv, grey);
      const cor = correspondences(det.found, devices, grid);
      const res = solveLayout({ devices: cor.devices, photo: { w: det.w, h: det.h } });
      last = { ...res, found: det.found.length, unknown: cor.unknown.length, duplicate: cor.duplicate.length, ms: det.ms, photo: { w: det.w, h: det.h } };
      overlay(img, det, cor, res);
      if (res.ok) {
        res.layout.created = Math.round(link.clock.ready ? link.clock.now() : Date.now());
        res.layout.room = room;
        memo.layout = res.layout; saveMemo();
        const blob = new Blob([JSON.stringify(res.layout, null, 2)], { type: 'application/json' });
        $('dl').href = URL.createObjectURL(blob); $('dl').hidden = false;
        plan(res.layout);
      }
      if (truth && res.ok) last.truth = compareTruth(res.layout, truth);
      const placed = res.report.filter((r) => r.status === 'ok').length;
      const lines = [`${det.found.length} markers in ${det.ms} ms · ${placed} of ${devices.length} screens placed`];
      for (const r of res.report) lines.push(`  ${r.id}: ${r.status === 'ok' ? `✓ ${r.markers} markers, rms ${r.rms} px` : `✗ ${r.status} (${r.markers} markers)`}`);
      if (last.truth) lines.push('Against the truth: ' + last.truth.map((t) => `${t.id} ${t.dAngle.toFixed(3)}° · ${t.dScale.toFixed(3)} % · ${t.dPx.toFixed(2)} px`).join('  '));
      if (res.ok && send) {
        link.config(TILE_KEYS.layout, res.layout);
        if (placed === devices.length) { ensureShow(); setMode('show'); lines.push('Layout sent. Every screen was placed: playing.'); }
        else lines.push('Layout sent to the placed screens. Retake the photo for the others, or press Play.');
      }
      msg(lines.join('\n'), res.ok ? (placed === devices.length ? 'ok' : 'warn') : 'bad');
      list();
      return last;
    } catch (err) {
      console.error('[tile camera]', err);
      msg(`Could not read the photo: ${err.message || err}`, 'bad');
      return (last = { ok: false, reason: String(err.message || err) });
    }
  }

  // ------------------------------------------------------------------ drawing what was found
  let shown = null;
  function drawPhoto(img) {
    const c = $('photo'), w = img.width || img.naturalWidth, h = img.height || img.naturalHeight;
    const k = Math.min(1, 1600 / Math.max(w, h));
    c.width = Math.round(w * k); c.height = Math.round(h * k); c.hidden = false;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0, c.width, c.height);
    shown = { k };
  }
  function overlay(img, det, cor, res) {
    const ctx = $('photo').getContext('2d'), k = shown.k;
    ctx.lineWidth = 3;
    for (const d of cor.devices) {
      ctx.strokeStyle = color(d.index);
      for (const m of d.markers) { ctx.beginPath(); m.photo.forEach(([x, y], i) => (i ? ctx.lineTo(x * k, y * k) : ctx.moveTo(x * k, y * k))); ctx.closePath(); ctx.stroke(); }
    }
    if (!res.ok) return;
    const G = res.layout.plane.matrix3x3;
    ctx.lineWidth = 5; ctx.font = '600 22px system-ui'; ctx.textAlign = 'center';
    for (const d of res.layout.devices) {
      const H = mul3(G, d.matrix3x3), idx = cor.devices.find((x) => x.id === d.id)?.index ?? 0;
      const q = [[0, 0], [d.w, 0], [d.w, d.h], [0, d.h]].map((c) => apply3(H, c));
      ctx.strokeStyle = color(idx); ctx.setLineDash([14, 8]);
      ctx.beginPath(); q.forEach(([x, y], i) => (i ? ctx.lineTo(x * k, y * k) : ctx.moveTo(x * k, y * k))); ctx.closePath(); ctx.stroke();
      ctx.setLineDash([]);
      const [cx, cy] = apply3(H, [d.w / 2, d.h / 2]);
      ctx.fillStyle = 'rgba(0,0,0,.7)'; ctx.fillRect(cx * k - 70, cy * k - 18, 140, 32);
      ctx.fillStyle = color(idx); ctx.fillText(`#${idx} ${d.id}`, cx * k, cy * k + 6);
    }
  }
  // the canvas from above: every screen where the tiles now think they are
  function plan(L) {
    const c = $('plan'); c.hidden = false;
    const W = 800, k = W / L.canvas.w; c.width = W; c.height = Math.round(L.canvas.h * k) + 2;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#05060a'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.font = '600 13px system-ui'; ctx.textAlign = 'center';
    for (const d of L.devices) {
      const idx = Number.isInteger(d.index) ? d.index : [...roster.values()].find((r) => r.id === d.id)?.index ?? 0;
      const q = [[0, 0], [d.w, 0], [d.w, d.h], [0, d.h]].map((p) => apply3(d.matrix3x3, p));
      ctx.fillStyle = color(idx) + '33'; ctx.strokeStyle = color(idx); ctx.lineWidth = 2;
      ctx.beginPath(); q.forEach(([x, y], i) => (i ? ctx.lineTo(x * k, y * k) : ctx.moveTo(x * k, y * k))); ctx.closePath(); ctx.fill(); ctx.stroke();
      const [x, y] = apply3(d.matrix3x3, [d.w / 2, d.h / 2]);
      ctx.fillStyle = '#dfe5f0'; ctx.fillText(`${d.id}${d.id === L.reference ? ' (reference)' : ''}`, x * k, y * k);
    }
  }
  function list() {
    const rows = [...roster.values()].sort((a, b) => a.index - b.index).map((d) => {
      const away = Date.now() - d.seen > 15000;
      const r = last?.report?.find((x) => x.id === d.id);
      const res = !r ? '–' : r.status === 'ok' ? `<span class="ok">✓ rms ${r.rms}</span>` : `<span class="bad">✗ ${esc(r.status)}</span>`;
      return `<tr${away ? ' style="opacity:.4"' : ''}><td><span class="dot" style="background:${color(d.index)}"></span>${d.index}</td><td class="mono">${esc(d.id)}${away ? ' (gone)' : ''}</td>`
        + `<td class="mono">${d.w}×${d.h}</td><td>${d.fullscreen ? '✓' : '–'} · ${d.wake === 'on' ? '✓' : d.wake === 'none' ? 'n/a' : '–'}</td><td>${res}</td></tr>`;
    });
    $('list').innerHTML = rows.join('') || '<tr><td colspan="5" class="sub">no screens yet</td></tr>';
  }
  list();

  // ------------------------------------------------------------------ ?demo=1: the synthetic photo
  async function runDemo() {
    msg('Drawing a synthetic photo: three screens, their markers drawn by the tiles\' own code, under a tilted camera…');
    await new Promise((r) => setTimeout(r, 30));
    const { sceneThree, renderPhoto, truthLayout } = await import('./test/synth.js');
    const scene = sceneThree();
    const photo = renderPhoto(scene, { screenImage: (s) => markerImage(s.w, s.h, s.index) });
    const c = document.createElement('canvas'); c.width = photo.w; c.height = photo.h;
    const id = c.getContext('2d').createImageData(photo.w, photo.h);
    for (let i = 0; i < photo.data.length; i++) { const v = photo.data[i]; id.data[i * 4] = id.data[i * 4 + 1] = id.data[i * 4 + 2] = v; id.data[i * 4 + 3] = 255; }
    c.getContext('2d').putImageData(id, 0, 0);
    roster.clear();
    for (const s of scene.screens) roster.set(s.id, { id: s.id, index: s.index, w: s.w, h: s.h, dpr: 1, fullscreen: true, wake: 'on', seen: Date.now() });
    return usePhoto(c, { devices: [...roster.values()], send: false, truth: { scene, truthLayout } });
  }
  if (demo) runDemo();
  return api;
}

/** A screen's markers as grey pixels, drawn by the same drawMarkers a tile uses, on a real canvas. */
export function markerImage(w, h, index) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  drawMarkers(ctx, { w, h, index });
  const d = ctx.getImageData(0, 0, w, h).data, g = new Uint8ClampedArray(w * h);
  for (let i = 0; i < g.length; i++) g[i] = d[i * 4];
  return { w, h, data: g };
}

/** The solved layout against the synthetic scene: per screen, its transform to the reference vs the truth. */
function compareTruth(L, { scene, truthLayout }) {
  const truth = truthLayout(scene, L.reference);
  const ref = L.devices.find((d) => d.id === L.reference);
  return L.devices.map((d) => {
    const got = similarityOf(mul3(inv3(ref.matrix3x3), d.matrix3x3)), t = similarityOf(truth[d.id]);
    let dAngle = (Math.atan2(got.b, got.a) - Math.atan2(t.b, t.a)) * 180 / Math.PI;
    dAngle = Math.abs(((dAngle + 540) % 360) - 180);
    const dScale = Math.abs(Math.hypot(got.a, got.b) / Math.hypot(t.a, t.b) - 1) * 100;
    const s = scene.screens.find((x) => x.id === d.id);
    let dPx = 0;   // the screen's corners, where the layout puts them vs where they are, in reference pixels
    for (const c of [[0, 0], [s.w, 0], [s.w, s.h], [0, s.h]]) {
      const a = apply3(mul3(inv3(ref.matrix3x3), d.matrix3x3), c), b = apply3(truth[d.id], c);
      dPx = Math.max(dPx, Math.hypot(a[0] - b[0], a[1] - b[1]));
    }
    return { id: d.id, dAngle, dScale, dPx };
  });
}
