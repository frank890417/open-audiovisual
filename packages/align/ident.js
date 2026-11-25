// @openav/align · ident — the identification screen: the first thing to show on arrival in the room. Which surface is
// which, which way is up, do the corners join. Drawn on the ART canvas, so it takes the work's own path to the outputs.
//
// Each surface gets its own hue, a grid in metres (or every 100 px) with small coordinates, a circle (an ellipse = the
// proportions are wrong), its name in large letters, which projector and which part of which output feeds it, what is on
// each side of it, an optional north arrow, and a clock (is the picture late, is it frozen). A band of light runs along
// the surfaces listed in ident.sweep, one after another, so the order of the walls and every corner show at a glance.
//
// The data comes from the layout's optional ident block; without it each segment is a surface named after itself:
//   ident.surfaces[]  { id, x, y, w, h (art px), meters: { w, h }, name, big, letter?, sub?, hue,
//                       edges: { left?, right?, top?, bottom? } (words on that side), arrow?: 'up' (north is up the canvas) }
//   ident.sweep       [surface id …] the band runs along these, left to right as one strip; ident.sweepFloor: the
//                     surface whose border a light dot follows
// drawIdentBase draws what stands still (once), drawIdentLive what moves (the band and the clock, 15 fps is plenty).
import { SANS, MONO } from './patterns.js?v=cedb93fa';

const WORDS = {
  en: {
    cell: ['top-left', 'top-right', 'bottom-left', 'bottom-right'], half: ['top half', 'bottom half'], side: ['left half', 'right half'],
    nth: (n) => `cell ${n}`, output: (id) => `output ${id}`, projector: (id) => `projector ${id}`, sep: ' · ',
  },
  zh: {
    cell: ['左上', '右上', '左下', '右下'], half: ['上半', '下半'], side: ['左半', '右半'],
    nth: (n) => `第 ${n} 格`, output: (id) => `輸出 ${id}`, projector: (id) => `投影機 ${id} 號`, sep: '・',
  },
};
const wordsOf = (lang) => WORDS[lang] || WORDS.en;

/** Which part of a cut output a tile sits in: 'top-left' on a 2 × 2 splitter, 'left half' on 2 × 1 … */
function cellWords(o, t, w) {
  const c = o.cuts || { cols: 1, rows: 1 }, cx = t.dst.x - o.x + t.dst.w / 2, cy = t.dst.y - o.y + t.dst.h / 2;
  const col = Math.min(c.cols - 1, Math.floor(cx / (o.w / c.cols))), row = Math.min(c.rows - 1, Math.floor(cy / (o.h / c.rows)));
  if (c.cols === 2 && c.rows === 2) return w.cell[row * 2 + col];
  if (c.cols === 1 && c.rows === 2) return w.half[row];
  if (c.cols === 2 && c.rows === 1) return w.side[col];
  return c.cols * c.rows > 1 ? w.nth(row * c.cols + col + 1) : '';
}

/** The surfaces to identify: the layout's ident.surfaces, or one per segment. */
export function identSurfaces(mapping) {
  if (mapping.ident?.surfaces?.length) return mapping.ident.surfaces;
  return mapping.segments.map((s, i) => ({ id: s.id, x: s.x, y: s.y, w: s.w, h: s.h, meters: s.meters, name: mapping.tiles.find((t) => t.segment === s.id)?.label ?? s.id, big: s.id, hue: (i * 67) % 360, edges: {} }));
}

/** The tiles whose centre lies on a surface, with their output and the part of it */
function zonesOn(mapping, f, w) {
  const out = [];
  for (const t of mapping.tiles) {
    const cx = t.src.x + t.src.w / 2, cy = t.src.y + t.src.h / 2;
    if (cx < f.x || cy < f.y || cx >= f.x + f.w || cy >= f.y + f.h) continue;
    const o = mapping.outputs.find((x) => x.id === t.output);
    const part = o ? cellWords(o, t, w) : '';
    out.push({ name: t.name, label: t.label ?? t.name, cell: `${w.output(t.output)}${part ? ` ${part}` : ''}`, src: t.src, plan: t.plan });
  }
  return out;
}

/**
 * Draw the still part of the identification screen over an art-canvas context.
 * @param {CanvasRenderingContext2D} g
 * @param {object} mapping
 */
export function drawIdentBase(g, mapping, { lang = 'en' } = {}) {
  const W = mapping.art.w, H = mapping.art.h, w = wordsOf(lang);
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  for (const f of identSurfaces(mapping)) drawSurface(g, mapping, f, w);
  g.restore();
}

function drawSurface(g, mapping, f, words) {
  const { x, y, w, h } = f, hue = f.hue ?? 210, ppmX = f.meters ? w / f.meters.w : null, ppmY = f.meters ? h / f.meters.h : null;
  // one type scale per metre (200 px a metre = 1): every surface of a room gets the same size of letters, at any density
  const u = f.meters ? (h / f.meters.h) / 200 : Math.min(w, h, 800) / 800;
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  const grd = g.createRadialGradient?.(x + w / 2, y + h / 2, 0, x + w / 2, y + h / 2, Math.max(w, h) * 0.7);
  if (grd) { grd.addColorStop(0, `hsl(${hue} 45% 13%)`); grd.addColorStop(1, `hsl(${hue} 40% 4%)`); g.fillStyle = grd; } else g.fillStyle = `hsl(${hue} 40% 8%)`;
  g.fillRect(x, y, w, h);
  // a line every 0.5 m (heavier every metre) with small coordinates; every 100 px when nobody measured
  const sx = ppmX ? ppmX / 2 : 100, sy = ppmY ? ppmY / 2 : 100;
  g.lineWidth = Math.max(1, 1.5 * u);
  for (let k = 0, X = x; X <= x + w + 0.5; k++, X = x + k * sx) { g.strokeStyle = `hsla(${hue} 60% 75% / ${k % 2 ? 0.12 : 0.26})`; g.beginPath(); g.moveTo(X, y); g.lineTo(X, y + h); g.stroke(); }
  for (let k = 0, Y = y + h; Y >= y - 0.5; k++, Y = y + h - k * sy) { g.strokeStyle = `hsla(${hue} 60% 75% / ${k % 2 ? 0.12 : 0.26})`; g.beginPath(); g.moveTo(x, Y); g.lineTo(x + w, Y); g.stroke(); }
  if (ppmX) {
    g.font = `500 ${Math.round(18 * u)}px ${MONO}`; g.fillStyle = `hsla(${hue} 40% 75% / .55)`; g.textBaseline = 'bottom'; g.textAlign = 'left';
    for (let m = 1; m < f.meters.w; m++) g.fillText(`${m}m`, x + m * ppmX + 4 * u, y + h - 6 * u);
  }
  // a circle 75 % of the short side (a whole number of metres when measured)
  const dia = ppmX ? Math.max(1, Math.floor(Math.min(f.meters.w, f.meters.h) * 0.75)) * Math.min(ppmX, ppmY) : Math.min(w, h) * 0.75;
  g.strokeStyle = `hsla(${hue} 80% 72% / .55)`; g.lineWidth = Math.max(1, 3 * u); g.beginPath(); g.arc(x + w / 2, y + h / 2, dia / 2, 0, Math.PI * 2); g.stroke();
  // the frame on the surface's edge, and its four corners
  const b = 8 * u; g.strokeStyle = `hsl(${hue} 90% 70%)`; g.lineWidth = b; g.strokeRect(x + b / 2, y + b / 2, w - b, h - b);
  g.lineWidth = 2 * b; const L = Math.min(w, h) * 0.15;
  for (const [cx, cy, ux, uy] of [[x, y, 1, 1], [x + w, y, -1, 1], [x + w, y + h, -1, -1], [x, y + h, 1, -1]]) { g.beginPath(); g.moveTo(cx + ux * L, cy + uy * b); g.lineTo(cx + ux * b, cy + uy * b); g.lineTo(cx + ux * b, cy + uy * L); g.stroke(); }
  // the big letter, the name, the size
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = `hsl(${hue} 85% 82%)`;
  const big = f.big ?? f.id, cy0 = y + h / 2 - 40 * u;
  if (f.letter) {
    g.font = `900 ${Math.round(300 * u)}px ${SANS}`; g.fillText(big, x + w / 2 - 120 * u, cy0);
    g.font = `800 ${Math.round(170 * u)}px ${SANS}`; g.fillText(f.letter, x + w / 2 + 170 * u, cy0 + 20 * u);
  } else { g.font = `900 ${Math.round(260 * u)}px ${SANS}`; g.fillText(big, x + w / 2, cy0 - 20 * u); }
  g.font = `600 ${Math.round(44 * u)}px ${SANS}`; g.fillStyle = `hsl(${hue} 30% 88%)`;
  const dims = f.meters ? `${f.meters.w.toFixed(2)} × ${f.meters.h.toFixed(2)} m` : `${w} × ${h} px`;
  g.fillText([f.name, f.sub, dims].filter(Boolean).join('   '), x + w / 2, y + h / 2 + 150 * u);
  // its tiles: one is written under the name; several each get a dashed frame with their number inside
  const zs = zonesOn(mapping, f, words);
  if (zs.length === 1) { g.font = `500 ${Math.round(36 * u)}px ${SANS}`; g.fillStyle = `hsl(${hue} 20% 70%)`; g.fillText(`${words.projector(zs[0].plan ?? zs[0].name)}${words.sep}${zs[0].cell}`, x + w / 2, y + h / 2 + 215 * u); }
  else for (const s of zs) {
    g.save(); g.setLineDash?.([24 * u, 18 * u]); g.strokeStyle = 'hsla(0 0% 90% / .6)'; g.lineWidth = 4 * u; g.strokeRect(s.src.x + 10 * u, s.src.y + 10 * u, s.src.w - 20 * u, s.src.h - 20 * u); g.restore();
    g.font = `700 ${Math.round(52 * u)}px ${SANS}`; g.fillStyle = 'hsl(0 0% 88%)'; g.fillText(words.projector(s.plan ?? s.name), s.src.x + s.src.w / 2, s.src.y + s.src.h * 0.22);
    g.font = `500 ${Math.round(30 * u)}px ${SANS}`; g.fillStyle = 'hsl(0 0% 70%)'; g.fillText(`${s.label}${words.sep}${s.cell}`, s.src.x + s.src.w / 2, s.src.y + s.src.h * 0.22 + 56 * u);
  }
  // the words on each side (who is next door, the top of the wall, a direction)
  const e = f.edges || {}; g.font = `700 ${Math.round(46 * u)}px ${SANS}`; g.fillStyle = `hsl(${hue} 60% 80%)`;
  if (e.left) { g.save(); g.translate(x + 40 * u, y + h / 2); if (f.arrow) g.rotate(-Math.PI / 2); g.textAlign = f.arrow ? 'center' : 'left'; g.fillText(e.left, 0, 0); g.restore(); }
  if (e.right) { g.save(); g.translate(x + w - 40 * u, y + h / 2); if (f.arrow) g.rotate(Math.PI / 2); g.textAlign = f.arrow ? 'center' : 'right'; g.fillText(e.right, 0, 0); g.restore(); }
  g.textAlign = 'center'; g.font = `600 ${Math.round((f.arrow ? 46 : 34) * u)}px ${SANS}`;
  if (e.top) g.fillText(e.top, x + w / 2, y + 50 * u);
  if (e.bottom) g.fillText(e.bottom, x + w / 2, y + h - 50 * u);
  if (f.arrow === 'up') { const ax = x + w / 2, ay = y + h / 2 + 330 * u; g.fillStyle = 'hsl(0 0% 85%)'; g.beginPath(); g.moveTo(ax, ay - 140 * u); g.lineTo(ax + 50 * u, ay); g.lineTo(ax, ay - 30 * u); g.lineTo(ax - 50 * u, ay); g.closePath(); g.fill(); }
  g.restore();
}

/**
 * Draw the moving part over the still one: the band along ident.sweep (per seconds a surface), the dot round
 * ident.sweepFloor, and a clock in each surface's bottom-right corner.
 * @param {CanvasRenderingContext2D} g
 * @param {object} mapping
 * @param {number} t  seconds
 */
export function drawIdentLive(g, mapping, t, { per = 2.5, now = new Date() } = {}) {
  const S = identSurfaces(mapping), byId = Object.fromEntries(S.map((f) => [f.id, f]));
  const strip = (mapping.ident?.sweep || []).map((id) => byId[id]).filter(Boolean);
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  if (strip.length) {
    const total = strip.reduce((a, f) => a + f.w, 0), pos = ((t / per) % strip.length) / strip.length * total;
    let acc = 0, k = 0; while (k < strip.length - 1 && acc + strip[k].w <= pos) { acc += strip[k].w; k++; }
    const f = strip[k], px = f.x + (pos - acc), bw = f.w * 0.045;
    const band = (X, ff) => { const gr = g.createLinearGradient?.(X - bw, 0, X + bw, 0); if (gr) { gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,250,235,.75)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; } else g.fillStyle = 'rgba(255,250,235,.6)'; g.fillRect(X - bw, ff.y, bw * 2, ff.h); };
    band(px, f);
    const fl = byId[mapping.ident?.sweepFloor];
    if (fl) {   // the dot follows the floor's border along the side of the surface the band is on: first the top, then clockwise
      const s = (pos - acc) / f.w, m = Math.min(fl.w, fl.h) * 0.033;
      const P = [[fl.x + s * fl.w, fl.y + m], [fl.x + fl.w - m, fl.y + s * fl.h], [fl.x + fl.w - s * fl.w, fl.y + fl.h - m], [fl.x + m, fl.y + fl.h - s * fl.h]][k % 4];
      const r = Math.min(fl.w, fl.h) * 0.06, rg = g.createRadialGradient?.(P[0], P[1], 0, P[0], P[1], r);
      if (rg) { rg.addColorStop(0, 'rgba(255,250,235,.9)'); rg.addColorStop(1, 'rgba(255,250,235,0)'); g.fillStyle = rg; }
      g.beginPath(); g.arc(P[0], P[1], r, 0, Math.PI * 2); g.fill();
    }
  }
  const z = (n, l = 2) => String(n).padStart(l, '0'), clock = `${z(now.getHours())}:${z(now.getMinutes())}:${z(now.getSeconds())}.${Math.floor(now.getMilliseconds() / 100)}`;
  g.textAlign = 'right'; g.textBaseline = 'bottom'; g.fillStyle = 'rgba(230,230,230,.7)';
  for (const f of S) { const u = f.meters ? (f.h / f.meters.h) / 200 : Math.min(f.w, f.h, 800) / 800; g.font = `600 ${Math.round(30 * u)}px ${MONO}`; g.fillText(clock, f.x + f.w - 30 * u, f.y + f.h - 24 * u); }
  g.restore();
}

/**
 * The whole identification screen in one call (a still, a test, a chart): drawIdentBase, then drawIdentLive at t.
 * @param {CanvasRenderingContext2D} g
 * @param {object} mapping
 * @param {number} [t]
 * @param {object} [o]  { per, now, lang }
 */
export function drawIdent(g, mapping, t = 0, o = {}) { drawIdentBase(g, mapping, o); drawIdentLive(g, mapping, t, o); }
