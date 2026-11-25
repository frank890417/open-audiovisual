// @openav/align · chart — the alignment chart for the hardware or splitter vendor: one image per output, 1:1 (3840 × 2160
// for a 4K output), read from the same layout as everything else.
//
// On it: a line every 100 px and a heavier one every 500 px with coordinates; the splitter's cuts (outputs[].cuts, thick
// red) and the range of each cut; for each tile its frame, its plan number (segments[].plan) in large type, its label
// (segments[].label), its size in px, its top-left and bottom-right pixel (the last pixel included), which side is the
// art's top (a turned feed shows its turn), and its masks (segments[].masks, a door) hatched red with their names; at the
// bottom the output, its resolution, "pixel to pixel, no scaling" or the real scale, the layout's id and the date. An
// optional logo goes in a corner that covers no tile, header or label (bottom-right, top-right, under the header), or is
// left out when none is free.
// ctx: any CanvasRenderingContext2D, the output's size. Text in English, or Chinese with { lang: 'zh' }.
import { MONO, SANS } from './patterns.js?v=cedb93fa';

const SEG = ['#2f7fd6', '#3fae6a', '#d6902f', '#c04fb0', '#4fb8c0', '#c0504f', '#8a7fd6', '#a0b040'];

const WORDS = {
  en: {
    cut: (n, x0, y0, x1, y1, w, h) => `cut ${n}: (${x0},${y0})–(${x1},${y1})  ${w}×${h}`,
    native: 'native art pixels 1:1', scaled: (k) => `art scaled ×${k}`,
    tl: (x, y) => `top-left (${x}, ${y})`, br: (x, y) => `bottom-right (${x}, ${y})`,
    side: { 0: 'top', 90: 'right', 180: 'bottom', 270: 'left' }, turn: { 90: 'turned 90° clockwise', 180: 'turned 180°', 270: 'turned 90° counter-clockwise' },
    top: (side, turn) => `▲ marks the art's top edge (this block's ${side} side${turn ? `, ${turn}` : ''})`,
    p2p: 'pixel to pixel, no scaling: 1 px of this chart = 1 px the projector receives (no splitter or processor may scale it on the way)',
    scaledHead: '⚠ this output has scaled blocks (see each block)',
    cuts: ' | red lines = the splitter\'s cuts; a "cut" is the range it cuts out, not the picture\'s size',
    layout: (id) => `layout ${id}`, mask: (l) => `${l ?? 'mask'} (black)`, maskShort: (l) => l ?? 'mask',
  },
  zh: {
    cut: (n, x0, y0, x1, y1, w, h) => `切格 ${n}：(${x0},${y0})–(${x1},${y1})  ${w}×${h}`,
    native: '作品原生像素 1:1', scaled: (k) => `作品縮放 ×${k}`,
    tl: (x, y) => `左上 (${x}, ${y})`, br: (x, y) => `右下 (${x}, ${y})`,
    side: { 0: '上', 90: '右', 180: '下', 270: '左' }, turn: { 90: '順時針轉 90°', 180: '轉 180°', 270: '逆時針轉 90°' },
    top: (side, turn) => `▲ 標記＝作品上緣（在這塊的${side}邊${turn ? `，${turn}` : ''}）`,
    p2p: 'pixel to pixel，不縮放：這張圖的 1 px ＝ 投影機收到的 1 px（分割器、處理器中間不要再縮放）',
    scaledHead: '⚠ 這一路有縮放的塊（見各塊標示）',
    cuts: '｜紅線＝分割器切線，「切格」是切出來的範圍，不是畫面大小',
    layout: (id) => `佈局 ${id}`, mask: (l) => `${l ?? '遮罩'}（遮黑）`, maskShort: (l) => l ?? '遮罩',
  },
};

/**
 * Draw the vendor chart of one output.
 * @param {CanvasRenderingContext2D} ctx  the output's size (output.w × output.h)
 * @param {object} mapping  computeMapping()'s result
 * @param {string} outputId
 * @param {{title?:string, note?:string, date?:string, version?:string, logo?:{width:number,height:number}, lang?:'en'|'zh'}} [opts]
 * @returns {{tiles:number, cuts:number, logo?:{x:number,y:number,w:number,h:number}|null}}  logo only when opts.logo was given (null: no corner was free)
 */
export function drawChart(ctx, mapping, outputId, opts = {}) {
  const o = mapping.outputs.find((x) => x.id === outputId);
  if (!o) throw new Error(`[align] layout ${mapping.id} has no output ${outputId} (it has ${mapping.outputs.map((x) => x.id).join(', ')})`);
  const w = WORDS[opts.lang] || WORDS.en;
  const W = o.w, H = o.h, u = Math.max(1, Math.min(W, H) / 1080);   // the unit of type and lines (1080 high = 1)
  const tiles = mapping.tiles.filter((t) => t.output === o.id);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);

  // a line every 100, a heavy one every 500, with coordinates
  for (const [step, color, lw] of [[100, '#1a1f28', 1], [500, '#3a4250', 2]]) {
    ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.beginPath();
    for (let x = step; x < W; x += step) { ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, H); }
    for (let y = step; y < H; y += step) { ctx.moveTo(0, y + 0.5); ctx.lineTo(W, y + 0.5); }
    ctx.stroke();
  }
  ctx.fillStyle = '#7d8798'; ctx.font = `600 ${Math.round(13 * u)}px ${MONO}`; ctx.textBaseline = 'top'; ctx.textAlign = 'left';
  for (let x = 500; x < W; x += 500) ctx.fillText(String(x), x + 4 * u, 4 * u);
  for (let y = 500; y < H; y += 500) ctx.fillText(String(y), 4 * u, y + 4 * u);

  // the splitter's cuts
  const busy = [];   // where text sits (the logo keeps off it)
  const cols = o.cuts?.cols ?? 1, rows = o.cuts?.rows ?? 1, cw = W / cols, ch = H / rows;
  ctx.textBaseline = 'bottom';
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    if (cols * rows === 1) break;
    const x0 = Math.round(i * cw), y0 = Math.round(j * ch), x1 = Math.round((i + 1) * cw) - 1, y1 = Math.round((j + 1) * ch) - 1;
    ctx.fillStyle = '#ff5a5a'; ctx.font = `700 ${Math.round(16 * u)}px ${MONO}`; ctx.textAlign = 'left';   // bottom-left: a centred block leaves it free
    const cut = w.cut(j * cols + i + 1, x0, y0, x1, y1, x1 - x0 + 1, y1 - y0 + 1);
    ctx.fillText(cut, x0 + 46 * u, y1 - 8 * u);
    busy.push({ x: x0 + 46 * u, y: y1 - 30 * u, w: ctx.measureText?.(cut).width ?? 0, h: 22 * u });
  }

  // each tile
  tiles.forEach((t, i) => {
    const d = { x: t.dst.x - o.x, y: t.dst.y - o.y, w: t.dst.w, h: t.dst.h };
    const c = t.color?.[0] && /^#/.test(t.color[0]) ? t.color[1] ?? t.color[0] : SEG[i % SEG.length];
    ctx.globalAlpha = 0.16; ctx.fillStyle = c; ctx.fillRect(d.x, d.y, d.w, d.h); ctx.globalAlpha = 1;
    ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.strokeRect(d.x + 1, d.y + 1, d.w - 2, d.h - 2);   // on the block's outermost pixels
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.strokeRect(d.x + 0.5, d.y + 0.5, d.w - 1, d.h - 1);
    ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 1; ctx.beginPath();
    ctx.moveTo(d.x, d.y); ctx.lineTo(d.x + d.w, d.y + d.h); ctx.moveTo(d.x + d.w, d.y); ctx.lineTo(d.x, d.y + d.h);
    ctx.moveTo(d.x + d.w / 2, d.y); ctx.lineTo(d.x + d.w / 2, d.y + d.h); ctx.moveTo(d.x, d.y + d.h / 2); ctx.lineTo(d.x + d.w, d.y + d.h / 2);
    ctx.stroke();
    // masks: the segment's (u, v) turned with the feed onto this block, dark with red hatching and a name
    for (const m of t.masks || []) drawMask(ctx, maskRect(m, d, t.rotate || 0), m.label, u, w);
    const L = 40 * u; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath();
    for (const [x, y, sx, sy] of [[d.x, d.y, 1, 1], [d.x + d.w, d.y, -1, 1], [d.x + d.w, d.y + d.h, -1, -1], [d.x, d.y + d.h, 1, -1]]) { ctx.moveTo(x + sx * 1.5, y + sy * L); ctx.lineTo(x + sx * 1.5, y + sy * 1.5); ctx.lineTo(x + sx * L, y + sy * 1.5); }
    ctx.stroke();
    const cx = d.x + d.w / 2, cy = d.y + d.h / 2;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (t.plan != null) { ctx.fillStyle = '#fff'; ctx.font = `800 ${Math.round(140 * u)}px ${SANS}`; ctx.fillText(String(t.plan), cx, cy - 77 * u); }
    ctx.fillStyle = '#fff'; ctx.font = `700 ${Math.round(40 * u)}px ${SANS}`;
    ctx.fillText(t.label ?? t.name, cx, cy + 18 * u);
    ctx.fillStyle = '#ffd23f'; ctx.font = `700 ${Math.round(46 * u)}px ${MONO}`;
    ctx.fillText(`${d.w} × ${d.h} px`, cx, cy + 64 * u);
    const native = t.rotate ? (t.scale.x === 1 && t.scale.y === 1) : (t.dst.w === t.src.w && t.dst.h === t.src.h);
    ctx.fillStyle = '#9fb0c8'; ctx.font = `600 ${Math.round(22 * u)}px ${SANS}`;
    ctx.fillText(native ? w.native : w.scaled(t.scale.x.toFixed(4)), cx, cy + 100 * u);
    ctx.font = `700 ${Math.round(20 * u)}px ${MONO}`; ctx.fillStyle = '#fff';
    ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(w.tl(d.x, d.y), d.x + 10 * u, d.y + 10 * u);
    ctx.textAlign = 'right'; ctx.textBaseline = 'bottom'; ctx.fillText(w.br(d.x + d.w - 1, d.y + d.h - 1), d.x + d.w - 10 * u, d.y + d.h - 10 * u);
    // the art's top: a triangle pointing out from the middle of that side; the words under the size
    const rot = t.rotate || 0;
    const [ex, ey, nx, ny] = { 0: [cx, d.y, 0, -1], 90: [d.x + d.w, cy, 1, 0], 180: [cx, d.y + d.h, 0, 1], 270: [d.x, cy, -1, 0] }[rot];
    const a = 26 * u; ctx.fillStyle = c; ctx.beginPath();
    ctx.moveTo(ex - nx * 4 * u, ey - ny * 4 * u); ctx.lineTo(ex - nx * (4 * u + a) + ny * a, ey - ny * (4 * u + a) - nx * a); ctx.lineTo(ex - nx * (4 * u + a) - ny * a, ey - ny * (4 * u + a) + nx * a); ctx.closePath(); ctx.fill();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#c9d4e3'; ctx.font = `600 ${Math.round(20 * u)}px ${SANS}`;
    ctx.fillText(w.top(w.side[rot], w.turn[rot]), cx, cy + 128 * u);
  });

  // the cuts last, over the blocks, red as on a splitter's own diagram
  ctx.strokeStyle = '#ff3b3b'; ctx.lineWidth = 6; ctx.beginPath();
  for (let i = 1; i < cols; i++) { const x = Math.round(i * cw); ctx.moveTo(x, 0); ctx.lineTo(x, H); }
  for (let j = 1; j < rows; j++) { const y = Math.round(j * ch); ctx.moveTo(0, y); ctx.lineTo(W, y); }
  ctx.stroke();

  // the header (top-left on a dark band; a block usually leaves 120 px above it) and the footer
  const pad = 14 * u;
  const allNative = tiles.every((t) => (t.rotate ? t.scale.x === 1 && t.scale.y === 1 : t.dst.w === t.src.w && t.dst.h === t.src.h));
  const h1 = `${o.label ?? o.id}   ${W} × ${H}`;
  const h2 = (allNative ? w.p2p : w.scaledHead) + (cols * rows > 1 ? w.cuts : '');
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.font = `800 ${Math.round(22 * u)}px ${SANS}`; const w1 = ctx.measureText?.(h1).width ?? 0;
  ctx.font = `700 ${Math.round(14 * u)}px ${SANS}`; const w2 = ctx.measureText?.(h2).width ?? 0;
  ctx.fillStyle = 'rgba(0,0,0,.82)'; ctx.fillRect(pad + 30 * u, pad, Math.max(w1, w2) + 20 * u, 50 * u);
  ctx.fillStyle = '#fff'; ctx.font = `800 ${Math.round(22 * u)}px ${SANS}`; ctx.fillText(h1, pad + 40 * u, pad + 4 * u);
  ctx.fillStyle = '#ffd23f'; ctx.font = `700 ${Math.round(14 * u)}px ${SANS}`; ctx.fillText(h2, pad + 40 * u, pad + 32 * u);
  ctx.textBaseline = 'bottom'; ctx.fillStyle = '#7d8798'; ctx.font = `600 ${Math.round(16 * u)}px ${SANS}`;
  const foot = [opts.title ?? mapping.title, w.layout(mapping.id), opts.date, opts.version ? `@openav/align ${opts.version}` : null, opts.note].filter(Boolean).join('   ·   ');
  ctx.fillText(foot, pad + 40 * u, H - pad - 20 * u);
  const out = { tiles: tiles.length, cuts: cols * rows };
  if (opts.logo) {
    const head = { x: pad + 30 * u, y: pad, w: Math.max(w1, w2) + 20 * u, h: 50 * u };
    busy.push({ x: pad + 40 * u, y: H - pad - 40 * u, w: ctx.measureText?.(foot).width ?? 0, h: 22 * u });
    out.logo = placeLogo(opts.logo, W, H, u, [head, ...busy, ...tiles.map((t) => ({ x: t.dst.x - o.x, y: t.dst.y - o.y, w: t.dst.w, h: t.dst.h }))]);
    if (out.logo) { ctx.globalAlpha = 0.9; ctx.drawImage(opts.logo, out.logo.x, out.logo.y, out.logo.w, out.logo.h); ctx.globalAlpha = 1; }
  }
  ctx.restore();
  return out;
}

/** A segment mask (u, v, w, h) → a rectangle on block d (output px); rot = the feed's clockwise turn (90°: the segment's top-left on the block's top-right). */
export function maskRect(m, d, rot = 0) {
  const P = { 0: (a, b) => [a, b], 90: (a, b) => [1 - b, a], 180: (a, b) => [1 - a, 1 - b], 270: (a, b) => [b, 1 - a] }[rot];
  const [x0, y0] = P(m.u, m.v), [x1, y1] = P(m.u + m.w, m.v + m.h);
  const px = (a) => Math.round(a * 1e6) / 1e6;   // float noise (1 − 0.8 is not 0.2) rounded away
  return { x: px(d.x + Math.min(x0, x1) * d.w), y: px(d.y + Math.min(y0, y1) * d.h), w: px(Math.abs(x1 - x0) * d.w), h: px(Math.abs(y1 - y0) * d.h) };
}

function drawMask(ctx, r, label, u, w) {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,.72)'; ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
  ctx.strokeStyle = 'rgba(255,90,90,.55)'; ctx.lineWidth = 2; ctx.beginPath();
  const step = 24 * u;
  for (let k = -r.h; k < r.w; k += step) { ctx.moveTo(r.x + k, r.y + r.h); ctx.lineTo(r.x + k + r.h, r.y); }
  ctx.stroke();
  ctx.strokeStyle = '#ff5a5a'; ctx.lineWidth = 3; ctx.strokeRect(r.x + 1.5, r.y + 1.5, r.w - 3, r.h - 3);
  // the name inside the bottom edge (a door starts at the floor, furthest from the block's big centre text), shrunk to fit
  ctx.fillStyle = '#ffb3b3'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
  let size = 18 * u, text = w.mask(label);
  ctx.font = `700 ${Math.round(size)}px ${SANS}`;
  const fit = (s) => (ctx.measureText?.(s).width ?? 0) <= r.w - 12 * u;
  while (!fit(text) && size > 11 * u) { size -= u; ctx.font = `700 ${Math.round(size)}px ${SANS}`; }
  if (!fit(text)) text = w.maskShort(label);
  ctx.fillText(text, r.x + r.w / 2, r.y + r.h - 8 * u);
  ctx.restore();
}

/** The logo's place: 28u high, tried bottom-right, top-right, under the header; a corner that touches any `avoid` box (8u around) is skipped; null when none is free */
function placeLogo(img, W, H, u, avoid) {
  const h = Math.round(28 * u), w = Math.round((h * img.width) / img.height), m = Math.round(14 * u), gap = 8 * u;
  const head = avoid[0];
  const spots = [[W - m - w, H - m - h], [W - m - w, m], [head.x, head.y + head.h + m]];
  const hit = (x, y) => avoid.some((a) => x < a.x + a.w + gap && a.x - gap < x + w && y < a.y + a.h + gap && a.y - gap < y + h);
  for (const [x, y] of spots) if (x >= 0 && y >= 0 && !hit(x, y)) return { x, y, w, h };
  return null;
}
