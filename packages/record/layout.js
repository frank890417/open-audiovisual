// layout.js — where the work and the performer's camera land in the output frame.
//
// Pure: no DOM, no clock. The compositor calls layoutRects() whenever a size
// changes; tests call it with numbers. Every rect is in OUTPUT pixels and is an
// integer, so a 1080×1920 frame is split into exactly 1080×1080 + 1080×840 with
// no seam row. Crops are in SOURCE pixels and stay fractional (drawImage takes
// floats; rounding them would make a 4K camera crop jitter by a pixel).
//
// Orientation: a camera crop is expressed in the DISPLAYED orientation. With a
// mirrored camera (the default: performers expect a mirror) "anchor x = 0.2"
// still means "keep the left of what you see"; the compositor flips the source.

/** Layout names, in the order a picker shows them. */
export const LAYOUTS = ['stack', 'pip', 'side', 'work'];

/** Above this many pixels a frame is recorded at 30 fps instead of 60 (see recommendedFps). */
const FPS60_MAX_PIXELS = 2600000;

/**
 * 60 fps up to about 1080×1920 (and 1440×1800, 1920×1200), 30 fps for 2.7K and 4K:
 * a 4K canvas at 60 is 500 Mpx/s through drawImage + the encoder, which drops
 * frames on a laptop mid-performance; 30 is what cameras shoot 4K at anyway.
 * @param {number} w @param {number} h @returns {30|60}
 */
export function recommendedFps(w, h) {
  return w * h <= FPS60_MAX_PIXELS ? 60 : 30;
}

/**
 * A video bitrate that keeps fast generative detail (particles, thin lines) clean:
 * 0.12 bits per pixel per frame, clamped to 4–80 Mb/s. 1080×1920@60 ≈ 15 Mb/s,
 * 4K@30 ≈ 30 Mb/s. Higher than a streaming bitrate on purpose: the file is a
 * master that gets edited and re-encoded later.
 * @param {number} w @param {number} h @param {number} [fps]
 * @returns {number} bits per second
 */
export function recommendedBitrate(w, h, fps = recommendedFps(w, h)) {
  const bps = w * h * fps * 0.12;
  return Math.round(Math.min(80e6, Math.max(4e6, bps)) / 1e5) * 1e5;
}

const P = (id, group, w, h, label, labelZh) => Object.freeze({
  id, group, w, h, label, labelZh,
  layout: group === 'vertical' ? 'stack' : group === 'landscape' ? 'side' : 'pip',
  fps: recommendedFps(w, h),
});

/**
 * Output sizes. Every dimension is even (H.264 and VP9 encode 4:2:0 chroma, which
 * needs even sizes). `layout` is the suggested layout for that shape; `fps` the
 * recommended frame rate.
 * @type {ReadonlyArray<{id:string, group:'vertical'|'landscape'|'square', w:number, h:number, label:string, labelZh:string, layout:string, fps:number}>}
 */
export const PRESETS = Object.freeze([
  P('vertical-1080p', 'vertical', 1080, 1920, 'Vertical 1080p · 1080×1920 (9:16)', '直式 1080p · 1080×1920（9:16）'),
  P('vertical-4x5', 'vertical', 1440, 1800, 'Portrait 4:5 · 1440×1800', '直式 4:5 · 1440×1800'),
  P('vertical-2.7k', 'vertical', 1520, 2704, 'Vertical 2.7K · 1520×2704 (9:16)', '直式 2.7K · 1520×2704（9:16）'),
  P('vertical-4k', 'vertical', 2160, 3840, 'Vertical 4K · 2160×3840 (9:16)', '直式 4K · 2160×3840（9:16）'),
  P('landscape-1080p', 'landscape', 1920, 1080, 'Landscape 1080p · 1920×1080 (16:9)', '橫式 1080p · 1920×1080（16:9）'),
  P('landscape-16x10', 'landscape', 1920, 1200, 'Landscape 16:10 · 1920×1200', '橫式 16:10 · 1920×1200'),
  P('landscape-2.7k', 'landscape', 2704, 1520, 'Landscape 2.7K · 2704×1520 (16:9)', '橫式 2.7K · 2704×1520（16:9）'),
  P('landscape-4k', 'landscape', 3840, 2160, 'Landscape 4K · 3840×2160 (16:9)', '橫式 4K · 3840×2160（16:9）'),
  P('square-1080', 'square', 1080, 1080, 'Square 1080 · 1080×1080', '方形 1080 · 1080×1080'),
  P('square-2048', 'square', 2048, 2048, 'Square 2048 · 2048×2048', '方形 2048 · 2048×2048'),
  P('square-2160', 'square', 2160, 2160, 'Square 4K · 2160×2160', '方形 4K · 2160×2160'),
]);

/** @param {string} id @returns {typeof PRESETS[number] | null} */
export function presetById(id) {
  return PRESETS.find((p) => p.id === id) || null;
}

/**
 * Any way of naming a size → `{ w, h }`, rounded UP to even numbers.
 * Accepts a preset id ('vertical-4k'), 'WxH' / 'W×H', `[w, h]` or `{ w, h }`.
 * @param {string|number[]|{w:number,h:number}} size
 * @returns {{w:number, h:number}}
 */
export function resolveSize(size) {
  let w, h;
  if (typeof size === 'string') {
    const p = presetById(size);
    if (p) ({ w, h } = p);
    else {
      const m = /^\s*(\d+)\s*[x×*]\s*(\d+)\s*$/i.exec(size);
      if (m) { w = +m[1]; h = +m[2]; }
    }
  } else if (Array.isArray(size)) [w, h] = size;
  else if (size && typeof size === 'object') ({ w, h } = size);
  if (!(Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0)) throw new TypeError(`record: unknown size ${JSON.stringify(size)}`);
  const even = (n) => { n = Math.round(n); return n % 2 ? n + 1 : n; };
  return { w: even(w), h: even(h) };
}

const DEFAULTS = Object.freeze({
  fit: 'contain',          // the work inside its area: 'contain' (letterbox, nothing lost) or 'cover'
  camFit: 'cover',         // the camera inside its area: 'cover' (fills, crops) or 'contain'
  camAnchor: { x: 0.5, y: 0.5 },   // which part of the camera a cover-crop keeps (displayed orientation)
  minCam: 0.2,             // stack/side: the camera never gets less than this share of the long axis…
  split: 0.6,              // …if it would, the work gets this share and the camera the rest
  pip: { corner: 'br', size: 0.3, margin: 0.03, radius: 0.08, aspect: 0 },
});

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const num = (v, d) => (Number.isFinite(v) ? v : d);

/** Largest rect of aspect sw:sh inside box, centered. */
function containIn(box, sw, sh) {
  const s = Math.min(box.w / sw, box.h / sh);
  const w = Math.min(box.w, Math.max(1, Math.round(sw * s))), h = Math.min(box.h, Math.max(1, Math.round(sh * s)));
  return { x: box.x + Math.round((box.w - w) / 2), y: box.y + Math.round((box.h - h) / 2), w, h };
}

/** The part of an sw×sh source that, scaled up, exactly covers dw×dh. */
function coverCrop(sw, sh, dw, dh, anchor) {
  const s = Math.max(dw / sw, dh / sh);
  const w = Math.min(sw, dw / s), h = Math.min(sh, dh / s);
  return { x: (sw - w) * clamp(num(anchor?.x, 0.5), 0, 1), y: (sh - h) * clamp(num(anchor?.y, 0.5), 0, 1), w, h };
}

/** Where the WHOLE source frame would land (cropped parts fall outside rect) — for overlays. */
function frameOf(rect, crop, sw, sh) {
  const s = rect.w / crop.w;
  return { x: rect.x - crop.x * s, y: rect.y - crop.y * s, w: sw * s, h: sh * s };
}

/** Place a source in a box: contain → a smaller rect, no crop; cover → the box, with a crop. */
function place(box, sw, sh, fit, anchor) {
  if (fit === 'cover') {
    const crop = coverCrop(sw, sh, box.w, box.h, anchor);
    return { ...box, crop, frame: frameOf(box, crop, sw, sh), box };
  }
  const r = containIn(box, sw, sh);
  return { ...r, crop: null, frame: { ...r }, box };
}

/**
 * Where the work and the camera go in an output frame.
 *
 *  - `stack` (vertical): the work across the full width at the top (a square for a
 *    1:1 work), the camera fills the rest below, cover-cropped. When the frame is
 *    not tall enough to leave the camera `minCam` of the height (a square or
 *    landscape frame), the work gets `split` of the height and is contained in it.
 *  - `side` (landscape): the same, rotated: work on the left at full height, the
 *    camera fills the right.
 *  - `pip`: the work fills the frame (contain), the camera is a rounded
 *    picture-in-picture in a corner (`pip.corner` 'br'|'bl'|'tr'|'tl', `pip.size`
 *    = its width as a share of the frame width, `pip.aspect` 0 = the camera's own).
 *  - `work`: the work alone; `cam` is null.
 *
 * Unknown camera size (no camera yet, still loading): the camera's area is
 * still reserved and returned with `crop: null, frame: null`, so the frame does
 * not jump when the camera arrives. Unknown work size counts as square.
 *
 * @param {'stack'|'pip'|'side'|'work'} layout
 * @param {{w:number, h:number}} out output size in pixels
 * @param {{workW?:number, workH?:number, camW?:number, camH?:number}} [src] source sizes (0/missing = unknown)
 * @param {object} [opts] see DEFAULTS above: fit, camFit, camAnchor, minCam, split, pip
 * @returns {{ layout:string, out:{w:number,h:number},
 *   work:{x:number,y:number,w:number,h:number, crop:{x,y,w,h}|null, frame:{x,y,w,h}, box:{x,y,w,h}},
 *   cam:{x:number,y:number,w:number,h:number, crop:{x,y,w,h}|null, frame:{x,y,w,h}|null, box:{x,y,w,h}, radius:number}|null }}
 */
export function layoutRects(layout, out, src = {}, opts = {}) {
  if (!LAYOUTS.includes(layout)) throw new TypeError(`layoutRects: unknown layout "${layout}" (${LAYOUTS.join(', ')})`);
  const W = Math.round(out?.w), H = Math.round(out?.h);
  if (!(W > 0 && H > 0)) throw new TypeError('layoutRects: out needs a positive w and h');
  const o = { ...DEFAULTS, ...opts, pip: { ...DEFAULTS.pip, ...(opts.pip || {}) } };
  const fit = o.fit === 'cover' ? 'cover' : 'contain';
  const minCam = clamp(num(o.minCam, DEFAULTS.minCam), 0, 0.9), split = clamp(num(o.split, DEFAULTS.split), 0.1, 0.9);
  const workW = src.workW > 0 ? src.workW : 1, workH = src.workH > 0 ? src.workH : 1;
  const hasCam = src.camW > 0 && src.camH > 0;

  const camIn = (box, radius = 0) => {
    if (!hasCam) return { ...box, crop: null, frame: null, box, radius };
    if (o.camFit === 'contain') {
      const r = place(box, src.camW, src.camH, 'contain');
      return { ...r, crop: { x: 0, y: 0, w: src.camW, h: src.camH }, radius };
    }
    return { ...place(box, src.camW, src.camH, 'cover', o.camAnchor), radius };
  };

  let work, cam = null;
  if (layout === 'work') {
    work = place({ x: 0, y: 0, w: W, h: H }, workW, workH, fit);
  } else if (layout === 'stack') {
    let bh = Math.round(W * workH / workW);               // the work at full width
    if (H - bh < minCam * H) bh = Math.round(H * split);  // not tall enough: share the height
    bh = clamp(bh, 1, H - 1);
    work = place({ x: 0, y: 0, w: W, h: bh }, workW, workH, fit);
    cam = camIn({ x: 0, y: bh, w: W, h: H - bh });
  } else if (layout === 'side') {
    let bw = Math.round(H * workW / workH);               // the work at full height
    if (W - bw < minCam * W) bw = Math.round(W * split);
    bw = clamp(bw, 1, W - 1);
    work = place({ x: 0, y: 0, w: bw, h: H }, workW, workH, fit);
    cam = camIn({ x: bw, y: 0, w: W - bw, h: H });
  } else {                                                // pip
    work = place({ x: 0, y: 0, w: W, h: H }, workW, workH, fit);
    const p = o.pip, short = Math.min(W, H);
    const aspect = p.aspect > 0 ? p.aspect : hasCam ? src.camW / src.camH : 16 / 9;
    let pw = Math.max(2, Math.round(clamp(num(p.size, 0.3), 0.05, 1) * W)), ph = Math.max(2, Math.round(pw / aspect));
    if (ph > H * 0.9) { ph = Math.round(H * 0.9); pw = Math.max(2, Math.round(ph * aspect)); }
    const m = Math.round(clamp(num(p.margin, 0.03), 0, 0.2) * short);
    const corner = /^(t|b)(l|r)$/.test(p.corner) ? p.corner : 'br';
    const x = corner[1] === 'r' ? W - m - pw : m, y = corner[0] === 'b' ? H - m - ph : m;
    cam = camIn({ x, y, w: pw, h: ph }, Math.round(clamp(num(p.radius, 0.08), 0, 0.5) * Math.min(pw, ph)));
  }
  return { layout, out: { w: W, h: H }, work, cam };
}

/**
 * A point given in the camera's own normalized coordinates (0..1 of the full
 * frame, displayed orientation — what HandTracker / PoseTracker landmarks are
 * with `mirror` matching the compositor) → output pixels. Null without a camera.
 * @param {{frame:{x,y,w,h}|null}|null} camRect `rects.cam`
 * @param {number} u @param {number} v
 * @returns {{x:number, y:number} | null}
 */
export function framePoint(camRect, u, v) {
  const f = camRect && camRect.frame;
  return f ? { x: f.x + u * f.w, y: f.y + v * f.h } : null;
}
