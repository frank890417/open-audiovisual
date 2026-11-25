// @openav/align · patterns — the test patterns: tiles, grid, edges, crosshair, bars (vendor images are placed by the page).
//
// Every pattern is drawn tile by tile from the mapping: clip to the tile's dst on the desktop, switch to art-canvas pixels,
// draw that segment. So a test pattern takes the same path as the work, and a pattern that is right on the wall means the
// work is right. Line widths, cells and circles are in target pixels: on a wall whose processor scales, a circle stays
// round and a cell square.
//
// ctx: any CanvasRenderingContext2D (an OffscreenCanvas, a fake one in a test: no measureText is fine).
// view: desktop px → canvas px, { k, x, y } (1:1 is { k: 1, x: 0, y: 0 }; a laptop preview has k < 1).
//
//   tiles      the vendor chart's look: a two-tone checkerboard per segment, cell names, the segment's name, W × H and
//              metres, diagonals, a dashed centre cross, a centre circle. Two tiles of one stacked segment get two colours:
//              aligned, they mix evenly; misaligned, a coloured fringe shows.
//   grid       a line every 100 art px, a heavy one every 500 with the absolute art x (0 to the full width of the canvas)
//   edges      each segment's frame, its four corners and the middle of each side
//   crosshair  a centre cross, thirds, three circles (an ellipse = the proportions are wrong)
//   bars       smpte (SMPTE-style bars), steps (grey steps, 1 % steps near black and near white), ramp (one gradient across
//              the whole art canvas: two segments of different brightness show a step)
import { eachCell } from './cells.js?v=cedb93fa';

export const ALIGN_PATTERNS = ['tiles', 'grid', 'edges', 'crosshair', 'bars', 'vendor'];
export const BAR_VARIANTS = ['smpte', 'steps', 'ramp'];
export const MONO = 'ui-monospace, Menlo, Consolas, "Noto Sans Mono", monospace';
export const SANS = 'system-ui, -apple-system, "Segoe UI", "Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif';

/** The words drawn on the wall, in English and Chinese. */
export const PATTERN_WORDS = {
  en: { visible: (n) => `visible ${n} px ◀`, fedTo: (s, o) => `segment ${s} → ${o}`, nearBlack: 'near black 0→10%', nearWhite: 'near white 90→100%', grey: 'grey' },
  zh: { visible: (n) => `可見 ${n} px ◀`, fedTo: (s, o) => `段 ${s} → ${o}`, nearBlack: '近黑 0→10%', nearWhite: '近白 90→100%', grey: '灰' },
};
const wordsOf = (lang) => PATTERN_WORDS[lang] || PATTERN_WORDS.en;

/**
 * Draw inside one tile in art-canvas pixels, then restore. fn gets env: px = art pixels per canvas pixel;
 * lw(n) = a line width never thinner than one canvas pixel.
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} tile
 * @param {{k:number,x:number,y:number}} view
 * @param {(env:{px:number, lw:(n:number)=>number}) => any} fn
 */
export function withTile(ctx, tile, view, fn) {
  ctx.save();
  // the clip on whole canvas pixels: in a scaled preview two neighbouring tiles share one edge, with no dark seam between
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const X = (v) => Math.round(view.x + v * view.k), Y = (v) => Math.round(view.y + v * view.k);
  const x0 = X(tile.dst.x), y0 = Y(tile.dst.y), x1 = X(tile.dst.x + tile.dst.w), y1 = Y(tile.dst.y + tile.dst.h);
  ctx.beginPath();
  ctx.rect(x0, y0, x1 - x0, y1 - y0);
  ctx.clip();
  ctx.setTransform(view.k, 0, 0, view.k, view.x, view.y);
  if (!tile.rotate) ctx.transform(tile.scale.x, 0, 0, tile.scale.y, tile.dst.x - tile.src.x * tile.scale.x, tile.dst.y - tile.src.y * tile.scale.y);
  else {   // turn inside the segment first (clockwise, as the calibration's default corners), then scale onto dst
    const W = tile.src.w, H = tile.src.h;
    const R = { 90: [0, 1, -1, 0, H, 0], 180: [-1, 0, 0, -1, W, H], 270: [0, -1, 1, 0, 0, W] }[tile.rotate];
    ctx.translate(tile.dst.x, tile.dst.y); ctx.scale(tile.scale.x, tile.scale.y); ctx.transform(...R); ctx.translate(-tile.src.x, -tile.src.y);
  }
  const px = 1 / (view.k * Math.min(tile.scale.x, tile.scale.y));
  try { return fn({ px, lw: (n) => Math.max(n, px) }); } finally { ctx.restore(); }
}

/** Paint the whole desktop one colour (a scaled preview paints around it itself). */
export function clearDesktop(ctx, mapping, view, color = '#000') {
  ctx.save();
  ctx.setTransform(view.k, 0, 0, view.k, view.x, view.y);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, mapping.desktop.w, mapping.desktop.h);
  ctx.restore();
}

/**
 * Draw one test pattern over the whole mapping, tile by tile.
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} mapping   computeMapping()'s result (or artView()'s)
 * @param {string} pattern   one of ALIGN_PATTERNS ('vendor' is placed by the page: { drawn: 0 })
 * @param {object} [opts]
 * @returns {{drawn:number}}
 */
export function drawPattern(ctx, mapping, pattern, opts = {}) {
  const view = opts.view ?? { k: 1, x: 0, y: 0 };
  if (pattern === 'vendor') return { drawn: 0 };
  const fn = DRAW[pattern];
  if (!fn) throw new Error(`[align] no pattern ${pattern} (there are: ${ALIGN_PATTERNS.join(', ')})`);
  const o = { ...opts, words: wordsOf(opts.lang) };
  if (opts.clear !== false && !opts.overlay) clearDesktop(ctx, mapping, view, '#000');
  for (const t of mapping.tiles) withTile(ctx, t, view, (env) => fn(ctx, t, mapping, env, o));
  if (opts.highlight) highlightCell(ctx, mapping, opts.highlight, view);
  if (opts.outputs) drawOutputs(ctx, mapping, view);
  return { drawn: mapping.tiles.length };
}

// ---------------------------------------------------------------- small tools, all in art-canvas pixels
function line(ctx, x1, y1, x2, y2, color, width) {
  ctx.strokeStyle = color; ctx.lineWidth = width;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
}
function text(ctx, s, x, y, size, color = '#fff', align = 'left', base = 'top', font = MONO, weight = '600') {
  ctx.font = `${weight} ${size}px ${font}`;
  ctx.textAlign = align; ctx.textBaseline = base; ctx.fillStyle = color;
  ctx.fillText(s, x, y);
}
const measure = (ctx, s, size) => ctx.measureText?.(s)?.width ?? s.length * size * 0.6;
/** A centred label on its own background (the vendor chart's segment names look like this). */
export function chip(ctx, s, cx, cy, size, fg = '#fff', bg = '#000', font = SANS) {
  ctx.font = `700 ${size}px ${font}`;
  const w = measure(ctx, s, size), padX = size * 0.35, padY = size * 0.2;
  ctx.fillStyle = bg;
  ctx.fillRect(cx - w / 2 - padX, cy - size / 2 - padY, w + padX * 2, size + padY * 2);
  ctx.fillStyle = fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(s, cx, cy);
}
function frame(ctx, s, color, width) {
  ctx.strokeStyle = color; ctx.lineWidth = width;
  ctx.strokeRect(s.x + width / 2, s.y + width / 2, s.w - width, s.h - width);
}
function corners(ctx, s, color, width, len) {
  for (const [cx, cy, dx, dy] of [[s.x, s.y, 1, 1], [s.x + s.w, s.y, -1, 1], [s.x, s.y + s.h, 1, -1], [s.x + s.w, s.y + s.h, -1, -1]]) {
    line(ctx, cx, cy, cx + dx * len, cy, color, width);
    line(ctx, cx, cy, cx, cy + dy * len, color, width);
  }
}
function circle(ctx, cx, cy, r, color, width) {
  ctx.strokeStyle = color; ctx.lineWidth = width;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
}
function dashed(ctx, on, dash, fn) {
  ctx.save();
  if (on && ctx.setLineDash) ctx.setLineDash(dash);
  fn();
  ctx.restore();
}
const tileTitle = (t) => t.name;
const tileSub = (t, w) => (t.output ? (t.name === t.segment ? `→ ${t.output}` : w.fedTo(t.segment, t.output)) : '');
/** What the room really sees, in art pixels: visible is relative to dst */
function visibleArt(t) {
  if (!t.visible) return null;
  return { x: t.src.x + t.visible.x / t.scale.x, y: t.src.y + t.visible.y / t.scale.y, w: t.visible.w / t.scale.x, h: t.visible.h / t.scale.y };
}
function drawVisible(ctx, t, env, w) {
  const v = visibleArt(t);
  if (!v) return;
  const s = t.src;
  const xr = v.x + v.w;
  if (xr < s.x + s.w) {
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(xr, s.y, s.x + s.w - xr, s.h);
    dashed(ctx, true, [s.h * 0.03, s.h * 0.025], () => line(ctx, xr, s.y, xr, s.y + s.h, '#ff0', env.lw(5)));
    chip(ctx, w.visible(Math.round(v.w)), xr - s.h * 0.2, s.y + s.h * 0.86, Math.round(s.h * 0.04), '#000', '#ff0');
  }
}

// ---------------------------------------------------------------- the patterns
function drawTiles(ctx, t, M, env, opts) {
  const s = t.src, size = t.cell, [dark, light] = t.color;
  for (const c of eachCell(s, size)) {   // the checkerboard: A1 is dark, as on a vendor chart
    ctx.fillStyle = (c.row + c.col) % 2 ? light : dark;
    ctx.fillRect(c.x, c.y, c.w, c.h);
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.92)'; ctx.lineWidth = env.lw(1.5);
  ctx.beginPath();
  for (let x = s.x; x <= s.x + s.w; x += size) { ctx.moveTo(x, s.y); ctx.lineTo(x, s.y + s.h); }
  for (let y = s.y; y <= s.y + s.h; y += size) { ctx.moveTo(s.x, y); ctx.lineTo(s.x + s.w, y); }
  ctx.stroke();
  // cell names, centred; a part cell too small for one is left blank
  const fs = Math.max(8, Math.round(size * 0.14));
  ctx.font = `600 ${fs}px ${SANS}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff';
  for (const c of eachCell(s, size)) if (c.w >= size * 0.5 && c.h >= size * 0.5) ctx.fillText(c.name, c.x + c.w / 2, c.y + c.h / 2);
  // diagonals, a dashed centre cross, a centre circle (stretched: an ellipse)
  const cx = s.x + s.w / 2, cy = s.y + s.h / 2;
  line(ctx, s.x, s.y, s.x + s.w, s.y + s.h, 'rgba(255,255,255,0.85)', env.lw(1.5));
  line(ctx, s.x, s.y + s.h, s.x + s.w, s.y, 'rgba(255,255,255,0.85)', env.lw(1.5));
  dashed(ctx, true, [size * 0.05, size * 0.04], () => {
    line(ctx, cx, s.y, cx, s.y + s.h, 'rgba(255,255,255,0.95)', env.lw(1.5));
    line(ctx, s.x, cy, s.x + s.w, cy, 'rgba(255,255,255,0.95)', env.lw(1.5));
  });
  circle(ctx, cx, cy, Math.min(s.w, s.h) * 0.25, 'rgba(255,255,255,0.9)', env.lw(1.5));
  // the segment's name, its pixels, its metres (only when measured: a number nobody measured does not go on the wall)
  const big = Math.round(s.h * 0.075), small = Math.round(s.h * 0.045);
  chip(ctx, tileTitle(t), cx, cy - big * 0.55, big, '#111', '#eee');
  chip(ctx, `W ${s.w} X H ${s.h}`, cx, cy + big * 0.55, small, '#fff', '#111');
  let yy = cy + big * 0.55 + small * 1.35;
  if (t.meters) { chip(ctx, `W ${t.meters.w.toFixed(2)}(m) X H ${t.meters.h.toFixed(2)}(m)`, cx, yy, small, '#fff', '#111'); yy += small * 1.35; }
  const sub = tileSub(t, opts.words);
  if (sub) chip(ctx, sub, cx, yy, Math.round(small * 0.8), '#fff', 'rgba(0,0,0,0.6)');
  frame(ctx, s, '#fff', env.lw(3));
  drawVisible(ctx, t, env, opts.words);
}

function drawGrid(ctx, t, M, env, opts) {
  const s = t.src;
  ctx.fillStyle = opts.overlay ? 'rgba(0,0,0,0.5)' : '#0d0d0d';
  ctx.fillRect(s.x, s.y, s.w, s.h);
  const fs = Math.max(10, Math.round(Math.min(s.h, s.w) * 0.03));
  for (let X = Math.ceil(s.x / 100) * 100; X <= s.x + s.w; X += 100) {
    const major = X % 500 === 0;
    line(ctx, X, s.y, X, s.y + s.h, major ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.3)', env.lw(major ? 2 : 1));
    if (major) text(ctx, String(X), X + fs * 0.25, s.y + fs * 0.3, fs, '#ff0');
  }
  for (let Y = Math.ceil(s.y / 100) * 100; Y <= s.y + s.h; Y += 100) {
    const major = Y % 500 === 0;
    line(ctx, s.x, Y, s.x + s.w, Y, major ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.3)', env.lw(major ? 2 : 1));
    if (major && Y > s.y) text(ctx, String(Y), s.x + fs * 0.25, Y + fs * 0.2, fs, '#ff0');
  }
  line(ctx, s.x, s.y + s.h / 2, s.x + s.w, s.y + s.h / 2, '#4cf', env.lw(2));
  line(ctx, s.x, s.y, s.x + s.w, s.y + s.h, 'rgba(255,80,80,0.8)', env.lw(1.5));
  line(ctx, s.x, s.y + s.h, s.x + s.w, s.y, 'rgba(255,80,80,0.8)', env.lw(1.5));
  frame(ctx, s, '#ff0', env.lw(4));
  const tick = Math.max(24, Math.min(120, s.h * 0.12));
  corners(ctx, s, '#0f0', env.lw(5), tick * 2);
  line(ctx, s.x + s.w / 2, s.y, s.x + s.w / 2, s.y + tick, '#4cf', env.lw(4));
  line(ctx, s.x + s.w / 2, s.y + s.h, s.x + s.w / 2, s.y + s.h - tick, '#4cf', env.lw(4));
  chip(ctx, `${tileTitle(t)}  ${s.x}–${s.x + s.w}`, s.x + s.w / 2, s.y + s.h / 2 - fs * 1.6, Math.round(fs * 1.6), '#fff', 'rgba(0,0,0,0.7)', MONO);
  const sub = tileSub(t, opts.words);
  if (sub) chip(ctx, sub, s.x + s.w / 2, s.y + s.h / 2 + fs * 0.6, fs, '#fff', 'rgba(0,0,0,0.7)', MONO);
  drawVisible(ctx, t, env, opts.words);
}

function drawEdges(ctx, t, M, env, opts) {
  const s = t.src;
  if (!opts.overlay) { ctx.fillStyle = '#000'; ctx.fillRect(s.x, s.y, s.w, s.h); }
  const tick = Math.max(24, Math.min(120, s.h * 0.12));
  frame(ctx, s, '#ff0', env.lw(6));
  corners(ctx, s, '#0f0', env.lw(6), tick * 2);
  for (const [x, y, dx, dy] of [[s.x + s.w / 2, s.y, 0, 1], [s.x + s.w / 2, s.y + s.h, 0, -1], [s.x, s.y + s.h / 2, 1, 0], [s.x + s.w, s.y + s.h / 2, -1, 0]]) {
    line(ctx, x, y, x + dx * tick * 2, y + dy * tick * 2, '#4cf', env.lw(4));
  }
  const fs = Math.max(10, Math.round(s.h * 0.025));
  for (let X = Math.ceil(s.x / 500) * 500; X < s.x + s.w; X += 500) {
    if (X === s.x) continue;
    line(ctx, X, s.y, X, s.y + tick, '#fff', env.lw(3));
    line(ctx, X, s.y + s.h, X, s.y + s.h - tick, '#fff', env.lw(3));
    text(ctx, String(X), X + fs * 0.3, s.y + tick + fs * 0.3, fs, '#fff');
  }
  chip(ctx, `${tileTitle(t)}  ${s.x}–${s.x + s.w}`, s.x + s.w / 2, s.y + s.h / 2, Math.round(s.h * 0.05), '#fff', 'rgba(0,0,0,0.7)', MONO);
  drawVisible(ctx, t, env, opts.words);
}

function drawCrosshair(ctx, t, M, env, opts) {
  const s = t.src, cx = s.x + s.w / 2, cy = s.y + s.h / 2, m = Math.min(s.w, s.h);
  if (!opts.overlay) { ctx.fillStyle = '#000'; ctx.fillRect(s.x, s.y, s.w, s.h); }
  for (const f of [1 / 3, 2 / 3]) {
    line(ctx, s.x + s.w * f, s.y, s.x + s.w * f, s.y + s.h, 'rgba(255,255,255,0.5)', env.lw(1));
    line(ctx, s.x, s.y + s.h * f, s.x + s.w, s.y + s.h * f, 'rgba(255,255,255,0.5)', env.lw(1));
  }
  line(ctx, cx, s.y, cx, s.y + s.h, '#4cf', env.lw(3));
  line(ctx, s.x, cy, s.x + s.w, cy, '#4cf', env.lw(3));
  for (const r of [0.1, 0.25, 0.45]) circle(ctx, cx, cy, m * r, '#4cf', env.lw(3));
  frame(ctx, s, '#ff0', env.lw(6));
  chip(ctx, tileTitle(t), cx, s.y + s.h * 0.12, Math.round(s.h * 0.05), '#fff', 'rgba(0,0,0,0.7)', MONO);
  drawVisible(ctx, t, env, opts.words);
}

// SMPTE-style (the look of EG 1, full-range sRGB): the top 67 % seven 75 % bars, 8 % reversed blue bars, the bottom 25 %
// −I, 100 % white, +Q, black and three near-black steps. Full-range RGB has nothing below black, so the PLUGE is 0, 2 and
// 4 %: 4 % seen and 2 % not = black is right; all three black = the blacks are crushed.
const SMPTE_TOP = ['#bfbfbf', '#bfbf00', '#00bfbf', '#00bf00', '#bf00bf', '#bf0000', '#0000bf'];
const SMPTE_MID = ['#0000bf', '#131313', '#bf00bf', '#131313', '#00bfbf', '#131313', '#bfbfbf'];
const g8 = (p) => { const v = Math.round((p / 100) * 255); return `rgb(${v},${v},${v})`; };
function drawBars(ctx, t, M, env, opts) {
  const s = t.src, variant = BAR_VARIANTS.includes(opts.variant) ? opts.variant : 'smpte', w = opts.words;
  const fs = Math.max(10, Math.round(s.h * 0.03));
  ctx.fillStyle = '#000'; ctx.fillRect(s.x, s.y, s.w, s.h);
  if (variant === 'smpte') {
    const bw = s.w / 7, h1 = s.h * 0.67, h2 = s.h * 0.08;
    SMPTE_TOP.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(s.x + i * bw, s.y, bw + 0.5, h1); });
    SMPTE_MID.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(s.x + i * bw, s.y + h1, bw + 0.5, h2); });
    const y3 = s.y + h1 + h2, h3 = s.h - h1 - h2, w4 = (bw * 5) / 4;
    [['#00214c', '−I'], ['#ffffff', '100%'], ['#32006a', '+Q'], ['#000000', '']].forEach(([c, l], i) => {
      ctx.fillStyle = c; ctx.fillRect(s.x + i * w4, y3, w4 + 0.5, h3);
      if (l) text(ctx, l, s.x + i * w4 + fs * 0.4, y3 + fs * 0.4, fs, i === 1 ? '#000' : '#fff');
    });
    [0, 2, 4].forEach((p, i) => { ctx.fillStyle = g8(p); ctx.fillRect(s.x + bw * 5 + (i * bw) / 3, y3, bw / 3 + 0.5, h3); });
    text(ctx, '0  2  4%', s.x + bw * 5 + fs * 0.3, s.y + s.h - fs * 1.4, fs, '#666');
    ctx.fillStyle = '#000'; ctx.fillRect(s.x + bw * 6, y3, bw, h3);
  } else if (variant === 'steps') {
    const h1 = s.h * 0.55;
    for (let i = 0; i <= 10; i++) {
      ctx.fillStyle = g8(i * 10); ctx.fillRect(s.x + (i * s.w) / 11, s.y, s.w / 11 + 0.5, h1);
      text(ctx, `${i * 10}%`, s.x + (i * s.w) / 11 + fs * 0.4, s.y + fs * 0.4, fs, i > 5 ? '#000' : '#fff');
    }
    // near black 0–10 % and near white 90–100 %, 1 % a step: crushed blacks and clipped whites show at once
    const y2 = s.y + h1, h2 = s.h - h1, half = s.w / 2;
    for (let i = 0; i <= 10; i++) {
      ctx.fillStyle = g8(i); ctx.fillRect(s.x + (i * half) / 11, y2, half / 11 + 0.5, h2);
      ctx.fillStyle = g8(90 + i); ctx.fillRect(s.x + half + (i * half) / 11, y2, half / 11 + 0.5, h2);
    }
    text(ctx, w.nearBlack, s.x + fs * 0.4, s.y + s.h - fs * 1.4, fs, '#888');
    text(ctx, w.nearWhite, s.x + half + fs * 0.4, s.y + s.h - fs * 1.4, fs, '#333');
  } else {
    // ramp: the gradient lives on the whole art canvas, so it runs on across segments; a brightness or colour difference
    // between two of them shows on the wall as a step
    const rows = [['#fff', w.grey], ['#f00', 'R'], ['#0f0', 'G'], ['#00f', 'B']];
    const rh = s.h / rows.length;
    rows.forEach(([c, l], i) => {
      const g = ctx.createLinearGradient ? ctx.createLinearGradient(0, 0, M.art.w, 0) : null;
      if (g) { g.addColorStop(0, '#000'); g.addColorStop(1, c); ctx.fillStyle = g; } else ctx.fillStyle = c;
      ctx.fillRect(s.x - env.px, s.y + i * rh, s.w + env.px * 2, rh + 0.5);   // one pixel more each side: no seam in a scaled preview
      text(ctx, l, s.x + fs * 0.4, s.y + i * rh + fs * 0.3, fs, '#888');
    });
  }
  frame(ctx, s, 'rgba(255,255,255,0.6)', env.lw(2));
  // the segment's name top-right, on a background (at the bottom it would sit on the PLUGE's small print)
  const label = `${tileTitle(t)} · ${variant}`;
  ctx.font = `700 ${fs}px ${SANS}`;
  chip(ctx, label, s.x + s.w - measure(ctx, label, fs) / 2 - fs * 0.8, s.y + fs * 1.1, fs, '#fff', 'rgba(0,0,0,0.65)');
}

const DRAW = { tiles: drawTiles, grid: drawGrid, edges: drawEdges, crosshair: drawCrosshair, bars: drawBars };

/**
 * Outline one cell ('L:C8') on every tile its segment is fed to; false when the cell does not exist.
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} mapping
 * @param {string} id
 * @param {{k:number,x:number,y:number}} [view]
 * @returns {boolean}
 */
export function highlightCell(ctx, mapping, id, view = { k: 1, x: 0, y: 0 }) {
  const i = String(id).lastIndexOf(':');
  const segId = id.slice(0, i), name = id.slice(i + 1).toUpperCase();
  const m = /^([A-Z]+)(\d+)$/.exec(name);
  if (!m) return false;
  let hit = false;
  for (const t of mapping.tiles) {
    if (t.segment !== segId) continue;
    let row = 0;
    for (const ch of m[1]) row = row * 26 + (ch.charCodeAt(0) - 64);
    row -= 1;
    const col = Number(m[2]) - 1, x = t.src.x + col * t.cell, y = t.src.y + row * t.cell;
    if (x >= t.src.x + t.src.w || y >= t.src.y + t.src.h) continue;
    hit = true;
    withTile(ctx, t, view, (env) => {
      ctx.strokeStyle = '#ff0'; ctx.lineWidth = env.lw(t.cell * 0.06);
      ctx.strokeRect(x, y, Math.min(t.cell, t.src.x + t.src.w - x), Math.min(t.cell, t.src.y + t.src.h - y));
    });
  }
  return hit;
}

/**
 * Each output's frame and name, in desktop coordinates (for a preview: on the wall it is that output's signal edge).
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} mapping
 * @param {{k:number,x:number,y:number}} [view]
 */
export function drawOutputs(ctx, mapping, view = { k: 1, x: 0, y: 0 }) {
  ctx.save();
  ctx.setTransform(view.k, 0, 0, view.k, view.x, view.y);
  const fs = Math.max(12, Math.round(Math.min(...mapping.outputs.map((o) => o.h)) * 0.025));
  for (const o of mapping.outputs) {
    ctx.strokeStyle = '#f0f'; ctx.lineWidth = Math.max(2, 2 / view.k);
    if (ctx.setLineDash) ctx.setLineDash([fs, fs * 0.6]);
    ctx.strokeRect(o.x + 1, o.y + 1, o.w - 2, o.h - 2);
    if (ctx.setLineDash) ctx.setLineDash([]);
    text(ctx, `${o.label ?? o.id}  ${o.w}×${o.h} @ ${o.x},${o.y}`, o.x + o.w - fs * 0.5, o.y + o.h - fs * 1.5, fs, '#f0f', 'right');
  }
  ctx.restore();
}
