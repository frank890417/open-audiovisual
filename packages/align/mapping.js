// @openav/align · mapping — the layout flattened into one table of tiles, and everything that reads it.
//
// computeMapping(layout) gives one tile per feed: src is its rectangle on the art canvas, dst its rectangle on the
// desktop (absolute physical pixels, origin top-left). Everything downstream reads only this table:
//   blitPlan          WebGL viewport, scissor and UV per tile (three's setViewport takes CSS px: already ÷ pixelRatio)
//   composePlan       the desktop frame put back together as the art canvas (thumbnails, export)
//   patterns.js       the test patterns are drawn tile by tile from the same table, so they take the work's own path
//   vendorPlacements  where the vendor's alignment images go
import { ALIGN_FORMAT, PALETTE, normalizeLayout, rectOf } from './layout.js?v=cedb93fa';
import { cellAt } from './cells.js?v=cedb93fa';

const contains = (r, x, y) => x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h;

/**
 * @typedef {{x:number,y:number,w:number,h:number}} Rect
 * @typedef {object} Tile
 * @property {string} name       the feed's name
 * @property {string} segment    segment id
 * @property {string} output     output id
 * @property {Rect} src          on the art canvas
 * @property {Rect} dst          on the desktop (absolute px)
 * @property {{x:number,y:number}} scale  dst ÷ src (both 1 at 1:1)
 * @property {Rect|null} visible what the room really sees of dst (relative to dst); null when all of it
 * @property {[string,string]} color  the checkerboard's dark and light colour
 * @property {{w:number,h:number}|null} meters  the segment's size in metres (null when nobody measured)
 * @property {number} cell       cell size, art px
 * @property {object|null} blend { l, r, t, b, curve, gamma }
 */

/**
 * A layout → its mapping: one tile per feed (where on the art canvas, where on the desktop), the outputs, the segments.
 * Throws LayoutError for a layout that breaks the format.
 * @param {object} layout
 * @returns {object}
 */
export function computeMapping(layout) {
  const L = normalizeLayout(layout);
  const segs = new Map(L.segments.map((s) => [s.id, s]));
  const outs = new Map(L.outputs.map((o) => [o.id, o]));
  const tiles = L.feeds.map((f, i) => {
    const s = segs.get(f.segment), o = outs.get(f.output);
    const src = rectOf(s);
    const dst = { x: o.x + f.x, y: o.y + f.y, w: f.w, h: f.h };
    const v = f.visible;
    const visible = v ? { x: v.x ?? 0, y: v.y ?? 0, w: v.w ?? dst.w, h: v.h ?? dst.h } : null;
    const c = f.color ?? s.color ?? PALETTE[i % PALETTE.length];
    const turned = f.rotate === 90 || f.rotate === 270;
    const tile = {
      name: f.name, segment: s.id, output: o.id, src, dst,
      scale: turned ? { x: dst.w / src.h, y: dst.h / src.w } : { x: dst.w / src.w, y: dst.h / src.h },
      visible,
      color: typeof c === 'string' ? [c, c] : c,
      meters: s.meters ?? null,
      cell: s.cell,
      blend: s.blend ? { l: 0, r: 0, t: 0, b: 0, curve: 'cosine', gamma: 2.2, ...s.blend } : null,
    };
    // optional fields appear only when the layout writes them
    if (f.rotate) tile.rotate = f.rotate;
    if (s.label != null) tile.label = s.label;
    if (s.plan != null) tile.plan = s.plan;
    // masks as fractions (u, v) of the segment: the calibration's coordinates, the same for a turned feed
    if (s.masks?.length) tile.masks = s.masks.map((m) => ({ u: m.x / s.w, v: m.y / s.h, w: m.w / s.w, h: m.h / s.h, ...(m.label != null ? { label: m.label } : {}) }));
    return tile;
  });
  return {
    format: ALIGN_FORMAT,
    id: L.id,
    title: L.title ?? L.id,
    art: { w: L.art.w, h: L.art.h, meters: L.art.meters ?? null },
    desktop: { w: L.desktop.w, h: L.desktop.h },
    outputs: L.outputs.map((o) => ({ id: o.id, ...rectOf(o), label: o.label ?? o.id, ...(o.cuts ? { cuts: { cols: o.cuts.cols ?? 1, rows: o.cuts.rows ?? 1 } } : {}) })),
    segments: L.segments.map((s) => ({ id: s.id, ...rectOf(s), meters: s.meters ?? null, cell: s.cell })),
    tiles,
    vendor: (L.vendor ?? []).map((v) => ({ ...v })),
    warnings: L.warnings,
    ...(L.params ? { params: paramValues(L.params) } : {}),
    ...(L.ident ? { ident: JSON.parse(JSON.stringify(L.ident)) } : {}),
  };
}

/** A layout's params → { name: value } (value, else default). */
export function paramValues(params) {
  return Object.fromEntries(Object.entries(params || {}).map(([k, p]) => [k, 'value' in p ? p.value : p.default]));
}

// a point of the segment (u, v in 0..1) → a point of dst (p, q in 0..1), and back; a turned feed turns clockwise
const SEG_TO_DST = { 0: (u, v) => [u, v], 90: (u, v) => [1 - v, u], 180: (u, v) => [1 - u, 1 - v], 270: (u, v) => [v, 1 - u] };
const DST_TO_SEG = { 0: (p, q) => [p, q], 90: (p, q) => [q, 1 - p], 180: (p, q) => [1 - p, 1 - q], 270: (p, q) => [1 - q, p] };

/**
 * How WebGL draws the mapping: the work renders into an art.w × art.h render target, then each tile is copied 1:1
 * (or scaled) with a viewport and a scissor:
 *   viewport, scissor = (dst.x, H − dst.y − dst.h, dst.w, dst.h) ÷ pixelRatio   (GL's origin is bottom-left; three takes CSS px)
 *   uvOffset = (src.x / art.w, 1 − (src.y + src.h) / art.h), uvScale = (src.w / art.w, src.h / art.h)
 * Forgetting ÷ pixelRatio draws every tile twice as big over its neighbours: it is divided here, once.
 * @param {object} mapping
 * @returns {{full:object, mismatch:boolean, tiles:object[]}}
 */
export function blitPlan(mapping, { pixelRatio = 1, buffer = mapping.desktop } = {}) {
  const pr = pixelRatio, W = buffer.w, H = buffer.h, A = mapping.art;
  return {
    full: { x: 0, y: 0, w: W / pr, h: H / pr },
    mismatch: W !== mapping.desktop.w || H !== mapping.desktop.h,
    tiles: mapping.tiles.map((t) => {
      const vy = H - t.dst.y - t.dst.h;
      const rect = { x: t.dst.x / pr, y: vy / pr, w: t.dst.w / pr, h: t.dst.h / pr };
      return {
        name: t.name,
        viewport: rect,
        scissor: { ...rect },
        uvOffset: { x: t.src.x / A.w, y: (A.h - t.src.y - t.src.h) / A.h },
        uvScale: { x: t.src.w / A.w, y: t.src.h / A.h },
        ...(t.rotate ? { rotate: t.rotate } : {}),   // a viewport cannot turn: createBlitter refuses, createWarpRenderer can
      };
    }),
  };
}

/**
 * The desktop frame back to the art canvas: one drawImage(source, sx, sy, sw, sh, dx, dy, dw, dh) per tile.
 * A stacked segment is drawn twice, with the same content.
 * @param {object} mapping
 * @returns {number[][]}
 */
export function composePlan(mapping) {
  return mapping.tiles.map((t) => [t.dst.x, t.dst.y, t.dst.w, t.dst.h, t.src.x, t.src.y, t.src.w, t.src.h]);
}

/**
 * Put a desktop frame (a canvas, an image) back together as the art canvas, with composePlan.
 * @param {CanvasImageSource} source
 * @param {object} mapping
 * @param {Document} [doc]
 * @returns {HTMLCanvasElement}
 */
export function composeArtCanvas(source, mapping, doc = globalThis.document) {
  const out = doc.createElement('canvas');
  out.width = mapping.art.w; out.height = mapping.art.h;
  const g = out.getContext('2d');
  if (!g) return source;
  g.fillStyle = '#000'; g.fillRect(0, 0, out.width, out.height);
  for (const a of composePlan(mapping)) g.drawImage(source, ...a);
  return out;
}

/**
 * The art canvas as it is, uncut: one tile per segment with dst = src. On a laptop it shows what the wall will look
 * like, and every pattern runs on as one continuous band.
 * @param {object} mapping
 * @returns {object}
 */
export function artView(mapping) {
  const seen = new Set();
  const tiles = [];
  for (const t of mapping.tiles) {
    if (seen.has(t.segment)) continue;
    seen.add(t.segment);
    const v = t.visible
      ? { x: t.visible.x / t.scale.x, y: t.visible.y / t.scale.y, w: t.visible.w / t.scale.x, h: t.visible.h / t.scale.y }
      : null;
    const a = { ...t, name: t.segment, output: null, dst: { ...t.src }, scale: { x: 1, y: 1 }, visible: v };
    delete a.rotate;   // the art view is never turned
    tiles.push(a);
  }
  return { ...mapping, id: `${mapping.id}#art`, desktop: { w: mapping.art.w, h: mapping.art.h }, outputs: [{ id: 'ART', x: 0, y: 0, w: mapping.art.w, h: mapping.art.h, label: 'art canvas' }], tiles, view: 'art' };
}

/**
 * A desktop point → the art-canvas point under it, in the tile drawn last there; null over no tile.
 * @param {object} mapping
 * @param {number} x
 * @param {number} y
 * @returns {{tile:string, segment:string, output:string, x:number, y:number, cell:string|null}|null}
 */
export function desktopToArt(mapping, x, y) {
  for (let i = mapping.tiles.length - 1; i >= 0; i--) {
    const t = mapping.tiles[i];
    if (!contains(t.dst, x, y)) continue;
    const [u, v] = DST_TO_SEG[t.rotate || 0]((x - t.dst.x) / t.dst.w, (y - t.dst.y) / t.dst.h);
    const ax = t.src.x + u * t.src.w, ay = t.src.y + v * t.src.h;
    return { tile: t.name, segment: t.segment, output: t.output, x: ax, y: ay, cell: cellAt(t.src, t.cell, Math.floor(ax), Math.floor(ay)) };
  }
  return null;
}

/**
 * An art-canvas point → every desktop point it lands on (a stacked segment lands on several).
 * @param {object} mapping
 * @param {number} ax
 * @param {number} ay
 * @returns {{tile:string, output:string, x:number, y:number}[]}
 */
export function artToDesktop(mapping, ax, ay) {
  return mapping.tiles.filter((t) => contains(t.src, ax, ay)).map((t) => {
    const [p, q] = SEG_TO_DST[t.rotate || 0]((ax - t.src.x) / t.src.w, (ay - t.src.y) / t.src.h);
    return { tile: t.name, output: t.output, x: t.dst.x + p * t.dst.w, y: t.dst.y + q * t.dst.h };
  });
}

/**
 * The cell an art-canvas point falls in, with its segment: 'L:C8'; null outside every segment.
 * @param {object} mapping
 * @param {number} ax
 * @param {number} ay
 * @returns {string|null}
 */
export function cellIdAt(mapping, ax, ay) {
  for (const s of mapping.segments) {
    const c = cellAt(s, s.cell, ax, ay);
    if (c) return `${s.id}:${c}`;
  }
  return null;
}

/**
 * Where light adds up:
 *   stacks  one segment fed into two or more outputs (two projectors on one picture): aligned, it is evenly brighter;
 *           misaligned, it doubles.
 *   bands   two different segments that share part of the canvas (the edge overlap of two projectors).
 * @param {object} mapping
 * @returns {{stacks:{segment:string,tiles:string[]}[], bands:{a:string,b:string,rect:object}[]}}
 */
export function analyzeOverlaps(mapping) {
  const bySeg = new Map();
  for (const t of mapping.tiles) bySeg.set(t.segment, [...(bySeg.get(t.segment) || []), t.name]);
  const stacks = [...bySeg].filter(([, names]) => names.length > 1).map(([segment, tiles]) => ({ segment, tiles }));
  const bands = [];
  const S = mapping.segments;
  for (let i = 0; i < S.length; i++) for (let j = i + 1; j < S.length; j++) {
    const a = S[i], b = S[j];
    const x0 = Math.max(a.x, b.x), y0 = Math.max(a.y, b.y), x1 = Math.min(a.x + a.w, b.x + b.w), y1 = Math.min(a.y + a.h, b.y + b.h);
    if (x1 > x0 && y1 > y0) bands.push({ a: a.id, b: b.id, rect: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } });
  }
  return { stacks, bands };
}

const ramp = (u, curve) => {
  const x = Math.min(1, Math.max(0, u));
  if (curve === 'linear') return x;
  if (curve === 'smoothstep') return x * x * (3 - 2 * x);
  return 0.5 - 0.5 * Math.cos(Math.PI * x);   // cosine
};

/**
 * A tile's blend weight at the art-canvas point (ax, ay), 0..1, in linear light: it climbs from 0 to 1 across each band
 * (l, r, t, b, art px). When two segments declare the same band width, their weights add up to 1 everywhere in the
 * overlap. What a projector is sent is weight^(1/gamma) (blendAlpha).
 * @param {object} tile
 * @param {number} ax
 * @param {number} ay
 * @returns {number}
 */
export function blendWeight(tile, ax, ay) {
  const b = tile.blend;
  if (!b) return contains(tile.src, ax, ay) ? 1 : 0;
  const s = tile.src;
  if (!contains(s, ax, ay)) return 0;
  let w = 1;
  if (b.l) w *= ramp((ax - s.x) / b.l, b.curve);
  if (b.r) w *= ramp((s.x + s.w - ax) / b.r, b.curve);
  if (b.t) w *= ramp((ay - s.y) / b.t, b.curve);
  if (b.b) w *= ramp((s.y + s.h - ay) / b.b, b.curve);
  return w;
}
/** A blend weight (linear light) → the pixel value to send: weight^(1/gamma). */
export const blendAlpha = (weight, gamma = 1) => Math.pow(weight, 1 / gamma);

/**
 * Where the vendor's alignment images go: any number, each filling an output or a rectangle of the desktop. pct is the
 * share of the desktop, ready to be a fullscreen page's CSS left, top, width and height.
 * @param {object} mapping
 * @returns {{file:string, url:string, output:string|null, rect:object, pct:object}[]}
 */
export function vendorPlacements(mapping, { base = '', vendor = mapping.vendor } = {}) {
  const D = mapping.desktop;
  return (vendor || []).map((v) => {
    const o = v.output != null ? mapping.outputs.find((x) => x.id === v.output) : null;
    const rect = v.rect ? { ...v.rect } : { x: o.x, y: o.y, w: o.w, h: o.h };
    return {
      file: v.file, url: base + v.file, output: v.output ?? null, rect,
      pct: { left: (rect.x / D.w) * 100, top: (rect.y / D.h) * 100, width: (rect.w / D.w) * 100, height: (rect.h / D.h) * 100 },
    };
  });
}
