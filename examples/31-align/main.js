// 31 · Align — a wall of several outputs, aligned by hand, on one screen with no hardware.
//
// The world draws one art canvas (slow light bands and circles that run on across segments) and knows nothing about
// projectors (rule 2). The page below takes that canvas through @openav/align: one layout file says how the wall is
// built, the desktop preview shows every output of it side by side, and the picture goes out through the calibration
// (four corners, a mesh, feathered edges, masks, gain) drawn by createWarpRenderer with three.js, the same path a venue
// machine uses.
//
//   Align         the align mode: drag the corners (C), the mesh (G), set the feather (E) and masks (K); P the next picture
//   picture       the work, the identification screen, the patterns, bars, white, grey, black: all through the same warp
//   Gray code     the structured-light frames, in output pixels and one colour channel per projector, never warped
//   Chart         the vendor's 1:1 chart of every output, side by side
//   Save / Load   the calibration as a file; it is also kept in this browser, a second after every change
//   ?layout=      one of packages/align/layouts/ (default example-edge-blend: two projectors with a blend band)
//
// Continuous control goes through params (rule 1): hue, speed and width move the work; the align mode edits a file.

import * as THREE from 'three';
import { createShow } from '@openav/show';
import {
  computeMapping, findLayout, normalizeCalibration, createWarpRenderer, createPatternTexture, createCalStore, createAlignUI,
  graySequence, channelPlan, drawGrayFrame, frameLabel, drawChart, drawOutputs, PATTERN_SOURCES,
} from '@openav/align';

const query = new URLSearchParams(location.search);
const LAYOUTS = '../../packages/align/layouts/';
const lang = (() => { try { return localStorage.getItem('oav-ui'); } catch { return null; } })() || (/^zh/i.test(navigator.language || '') ? 'zh' : 'en');

// ---------------------------------------------------------------- the layouts and this page's calibration
const index = await (await fetch(LAYOUTS + 'index.json')).json();
const layouts = await Promise.all(index.map(async (e) => (await fetch(LAYOUTS + e.file)).json()));
const layout = findLayout(layouts, query.get('layout') || 'example-edge-blend') ?? layouts[0];
const M = computeMapping(layout);
const region = { x: 0, y: 0, w: M.desktop.w, h: M.desktop.h };           // this one canvas shows the whole desktop
const store = createCalStore({ prefix: 'oav-example-31' });              // every layout is a variant of one file
const saved = await store.load();
let cal = normalizeCalibration(saved.calibration, M, M.id);
const state = { mode: 'play', source: 'live', variant: M.id, zone: M.tiles[0].name, ...saved.state, variant: M.id };
if (query.get('source') && PATTERN_SOURCES.includes(query.get('source'))) state.source = query.get('source');
const zones = () => cal.variants[M.id].zones;

// ---------------------------------------------------------------- the work: one art canvas, nothing about projectors
const bands = {
  name: 'align-bands',
  params: [
    { key: 'hue',   label: 'Hue',   min: 0,    max: 360, def: 190 },
    { key: 'speed', label: 'Speed', min: 0,    max: 2,   def: 0.4 },
    { key: 'width', label: 'Width', min: 0.02, max: 0.4, def: 0.12 },   // how wide a band is, a share of the canvas height
  ],
  init({ container }) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = container.clientWidth; this.canvas.height = container.clientHeight;
    container.appendChild(this.canvas);
    this.g = this.canvas.getContext('2d');
    this.t = 0; this.s = null;
  },
  update(dt, s) { this.s = s; this.t += dt * s.speed; },
  render() {
    const { g, s, t } = this, W = this.canvas.width, H = this.canvas.height;
    if (!s) return;
    g.fillStyle = '#05070c'; g.fillRect(0, 0, W, H);
    // diagonal bands across the whole canvas: a seam, a step or a double edge between two outputs shows at once
    const bw = s.width * H, step = bw * 2.6;
    for (let k = -Math.ceil(H / step) - 2; k * step < W + H; k++) {
      const x = k * step + ((t * step) % step);
      g.fillStyle = `hsla(${(s.hue + k * 23) % 360}, 80%, 55%, 0.55)`;
      g.beginPath(); g.moveTo(x, 0); g.lineTo(x + bw, 0); g.lineTo(x + bw - H, H); g.lineTo(x - H, H); g.closePath(); g.fill();
    }
    // circles in canvas pixels: on the wall each must stay round, across any output it crosses
    g.lineWidth = Math.max(2, H / 200);
    for (let i = 0; i < 5; i++) {
      const cx = ((i + 0.5) / 5) * W + Math.sin(t * 0.7 + i) * W * 0.04, cy = H / 2 + Math.cos(t * 0.5 + i * 2) * H * 0.18, r = H * (0.16 + 0.05 * i);
      g.strokeStyle = `hsla(${(s.hue + 180 + i * 30) % 360}, 90%, 75%, 0.85)`;
      g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke();
    }
    g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = Math.max(3, H / 150); g.strokeRect(0, 0, W, H);   // the art canvas's own edge
  },
  dispose() { this.canvas.remove(); },
};

// ---------------------------------------------------------------- the desktop preview: the warp, the frames, the charts
const desk = document.createElement('div');
desk.className = 'align-desk';
desk.style.cssText = 'position:absolute;inset:0;background:#000';
const artHost = document.createElement('div');          // the world's canvas, at the art canvas's size, never shown itself
artHost.style.cssText = `position:absolute;left:-200000px;top:0;width:${M.art.w}px;height:${M.art.h}px;visibility:hidden`;
const k = Math.min(1, 1920 / M.desktop.w, 1200 / M.desktop.h);             // the preview's pixels per desktop pixel
const fit = 'position:absolute;inset:0;width:100%;height:100%;object-fit:contain';
const glCanvas = Object.assign(document.createElement('canvas'), { width: Math.round(M.desktop.w * k), height: Math.round(M.desktop.h * k) });
glCanvas.style.cssText = fit;
const flat = Object.assign(document.createElement('canvas'), { width: glCanvas.width, height: glCanvas.height });
flat.style.cssText = fit + ';display:none';
desk.append(glCanvas, flat);

const renderer = new THREE.WebGLRenderer({ canvas: glCanvas, preserveDrawingBuffer: true, antialias: false });
renderer.setPixelRatio(1);
renderer.setSize(glCanvas.width, glCanvas.height, false);
const warp = createWarpRenderer(THREE);
const rebuild = () => warp.build(M, zones(), 24);
rebuild();
let liveTexture = null;
const patterns = createPatternTexture(THREE, M.art, document, { lang });

// Gray code: the largest output decides the bits; more than three projectors take more passes
const frames = graySequence({ w: Math.max(...M.outputs.map((o) => o.w)), h: Math.max(...M.outputs.map((o) => o.h)) });
const passes = channelPlan(M);
const gray = { frame: 0, pass: 0 };

function drawFlat() {
  const g = flat.getContext('2d'), view = { k, x: 0, y: 0 };
  g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#000'; g.fillRect(0, 0, flat.width, flat.height);
  if (state.mode === 'gray') {
    drawGrayFrame(g, M, frames[gray.frame], { assign: passes[gray.pass], view });
  } else if (state.mode === 'chart') {
    for (const o of M.outputs) {              // each output's chart at its full size, then into its place on the preview
      const c = Object.assign(document.createElement('canvas'), { width: o.w, height: o.h });
      drawChart(c.getContext('2d'), M, o.id, { lang, date: new Date().toISOString().slice(0, 10) });
      g.drawImage(c, o.x * k, o.y * k, o.w * k, o.h * k);
    }
  }
  if (state.mode !== 'gray') drawOutputs(g, M, view);   // nothing over a Gray-code frame: magenta frames would add R + B to the stripes
  bar.update();
}

function frame(artCanvas) {
  if (state.mode === 'gray' || state.mode === 'chart') return;
  let texture;
  if (state.source === 'live') {
    liveTexture ??= Object.assign(new THREE.CanvasTexture(artCanvas), { minFilter: THREE.LinearFilter, generateMipmaps: false });
    liveTexture.needsUpdate = true;
    texture = liveTexture;
  } else texture = patterns.draw(M, state.source, performance.now() / 1000);
  warp.draw(renderer, texture, region);
}

// ---------------------------------------------------------------- the align mode
let ui = null;
function setMode(mode) {
  state.mode = mode;
  document.body.classList.toggle('align', mode === 'align');
  glCanvas.style.display = mode === 'gray' || mode === 'chart' ? 'none' : '';
  flat.style.display = mode === 'gray' || mode === 'chart' ? '' : 'none';
  if (mode === 'gray' || mode === 'chart') drawFlat();
  store.saveState({ ...state }).catch(() => {});
  ui?.draw();
  bar.update();
}

// ---------------------------------------------------------------- the operator's bar (never on a clean output page)
const T = lang === 'zh'
  ? { play: '播放', align: '對位', gray: '格雷碼', chart: '對位圖', save: '存檔', load: '讀檔', picture: '畫面', layout: '佈局', saved: '已存', frame: '張', pass: '輪' }
  : { play: 'Play', align: 'Align', gray: 'Gray code', chart: 'Chart', save: 'Save', load: 'Load', picture: 'picture', layout: 'layout', saved: 'saved', frame: 'frame', pass: 'pass' };
const bar = (() => {
  const el = document.createElement('div');
  el.className = 'oav-operator align-bar';
  el.style.cssText = 'position:absolute;right:12px;top:12px;z-index:45;display:flex;flex-wrap:wrap;gap:6px;align-items:center;max-width:min(760px,calc(100% - 24px));justify-content:flex-end;font:12px system-ui,sans-serif;color:#cfd6e4';
  const css = 'padding:6px 11px;border-radius:8px;border:1px solid #3a4558;background:rgba(10,12,17,.88);color:#e8eef8;font:600 12px system-ui,sans-serif;cursor:pointer';
  const button = (label, on) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.style.cssText = css; b.onclick = on; el.appendChild(b); return b; };
  const select = (opts, value, on, title) => { const s = document.createElement('select'); s.title = title; s.style.cssText = css; for (const [v, l] of opts) s.add(new Option(l, v, false, v === value)); s.onchange = () => on(s.value); el.appendChild(s); return s; };
  const lay = select(layouts.map((l) => [l.id, l.id]), M.id, (id) => { const q = new URLSearchParams(location.search); q.set('layout', id); location.search = q; }, T.layout);
  const src = select(PATTERN_SOURCES.map((s) => [s, s]), state.source, (s) => { state.source = s; store.saveState({ ...state }).catch(() => {}); ui?.draw(); }, T.picture);
  const modes = { play: button(T.play, () => setMode('play')), align: button(T.align, () => setMode('align')), gray: button(T.gray, () => setMode('gray')), chart: button(T.chart, () => setMode('chart')) };
  const prev = button('◀', () => stepGray(-1)), next = button('▶', () => stepGray(1));
  const label = document.createElement('span'); label.style.cssText = 'padding:0 4px;min-width:12em'; el.appendChild(label);
  button(T.save, () => store.exportTo(cal));
  button(T.load, async () => { const c = await store.importFrom(); if (c) replaceCalibration(c); });
  return {
    el, lay, src,
    update() {
      for (const [m, b] of Object.entries(modes)) b.style.borderColor = state.mode === m ? '#ffd166' : '#3a4558';
      src.value = state.source;
      prev.style.display = next.style.display = state.mode === 'gray' ? '' : 'none';
      label.textContent = state.mode === 'gray' ? `${T.frame} ${gray.frame + 1}/${frames.length} · ${frameLabel(frames[gray.frame], lang)}${passes.length > 1 ? ` · ${T.pass} ${gray.pass + 1}/${passes.length}` : ''}` : '';
    },
  };
})();
function stepGray(d) {
  const n = gray.pass * frames.length + gray.frame + d, total = frames.length * passes.length;
  const m = ((n % total) + total) % total;
  gray.pass = Math.floor(m / frames.length); gray.frame = m % frames.length;
  drawFlat();
}
addEventListener('keydown', (e) => {          // in Gray code: [ and ] step (in align mode the align UI has every key)
  if (state.mode !== 'gray' || (e.key !== '[' && e.key !== ']')) return;
  e.preventDefault(); e.stopImmediatePropagation();
  stepGray(e.key === ']' ? 1 : -1);
}, true);
function replaceCalibration(c) {
  cal = normalizeCalibration(c, M, M.id);
  rebuild();
  ui?.setCalibration(cal);
  store.saveCalibration(cal).catch(() => {});
}

// ---------------------------------------------------------------- the show: the world, wrapped so its canvas goes out through the warp
const world = {
  name: bands.name, params: bands.params,
  init(io) {
    io.container.append(desk, artHost, bar.el);
    bands.init({ ...io, container: artHost });
    ui = createAlignUI({
      canvas: glCanvas, region, getMapping: () => M, store, state, cal, lang,
      onChange: (why) => { if (why === 'cal') rebuild(); bar.update(); },
      setMode, replaceCalibration,
    });
    setMode(query.has('align') ? 'align' : query.has('gray') ? 'gray' : query.has('chart') ? 'chart' : 'play');
  },
  update(dt, s, io) { bands.update(dt, s, io); },
  render() { bands.render(); frame(bands.canvas); },
  dispose() { bands.dispose(); warp.dispose(); patterns.dispose(); renderer.dispose(); },
};

const show = await createShow({
  world,
  profile: false,
  modules: { keys: false },
  routes: [{ source: 'midi/cc/1', target: 'speed', outMax: 1.5 }, { source: 'midi/cc/2', target: 'hue', outMax: 360 }],
  timeline: {
    total: 32, loop: true,
    automation: { hue: [[0, 190], [16, 300], [32, 190]], speed: [[0, 0.3], [16, 0.8], [32, 0.3]], width: [[0, 0.1], [24, 0.25], [32, 0.1]] },
    scenes: [
      { id: 'flow', t: 0, title: 'Flow', note: 'Align: drag the corners onto the wall · P the next picture' },
      { id: 'wide', t: 16, title: 'Wide', note: 'wider bands: a seam or a double edge between outputs shows' },
    ],
  },
  hint: 'Align: drag corners (C), mesh (G), feather (E), masks (K), P the next picture · Gray code: [ ] step · Chart: the vendor charts · ?layout=room-corner',
});

// for devtools and scripted checks, beside window.openav
window.openav.align = { M, get cal() { return cal; }, state, gray, frames, passes, renderer, warp, ui, setMode, stepGray, replaceCalibration, store };
void show;
