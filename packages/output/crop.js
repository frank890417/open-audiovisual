// @openav/output · crop — which part of the stage an output shows, and how it fills the output. Pure: no DOM.
//
// One canvas, two projectors side by side: the left one shows { x: 0, y: 0, w: 0.5, h: 1 } of the stage, the right one
// { x: 0.5, y: 0, w: 0.5, h: 1 }. A crop is normalized (0..1 of the stage), so it holds whatever size the stage is drawn
// at. Where the two pictures meet there is no blend: edge blending (two projectors overlapping with a soft ramp) is not
// part of this package.

export const FULL = Object.freeze({ x: 0, y: 0, w: 1, h: 1 });
export const FITS = ['contain', 'cover', 'stretch'];

/** A crop as { x, y, w, h }, checked: inside 0..1, w and h above 0. `null` or nothing is the whole stage. Throws on a bad one. */
export function normalizeCrop(crop) {
  if (crop === null || crop === undefined) return { ...FULL };
  const c = Array.isArray(crop) ? { x: crop[0], y: crop[1], w: crop[2], h: crop[3] } : crop;
  if (typeof c !== 'object') throw new Error(`[output] crop must be { x, y, w, h } (0..1 of the stage), got ${JSON.stringify(crop)}`);
  const { x = 0, y = 0, w = 1, h = 1 } = c;
  for (const [k, v] of Object.entries({ x, y, w, h })) if (!Number.isFinite(v)) throw new Error(`[output] crop.${k} must be a number, got ${JSON.stringify(v)}`);
  const tol = 1e-9;
  if (x < -tol || y < -tol || !(w > 0) || !(h > 0) || x + w > 1 + tol || y + h > 1 + tol) {
    throw new Error(`[output] crop { x: ${x}, y: ${y}, w: ${w}, h: ${h} } must lie inside the stage: x, y ≥ 0, w, h > 0, x + w ≤ 1, y + h ≤ 1`);
  }
  return { x, y, w, h };
}

/**
 * Where the source goes so that its crop region shows in a box.
 *   contain   the whole region, as large as fits, black bars on two sides when the shapes differ (default)
 *   cover     the box filled, the region's overflow cut off
 *   stretch   the region pulled to the box's shape
 * @param {{ crop?:object, source:{w:number,h:number}, box:{w:number,h:number}, fit?:'contain'|'cover'|'stretch' }} o
 * @returns {{ clip:{left:number,top:number,width:number,height:number}, source:{left:number,top:number,width:number,height:number} }}
 *   clip: the part of the box the picture covers (anything of the source outside it is hidden). source: where the whole
 *   source sits, in the box's pixels (it may reach far outside the box: the crop is what shows through the clip).
 */
export function cropBox({ crop = null, source, box, fit = 'contain' } = {}) {
  const c = normalizeCrop(crop);
  if (!FITS.includes(fit)) throw new Error(`[output] fit must be ${FITS.join(', ')}, got ${JSON.stringify(fit)}`);
  if (!source || !(source.w > 0) || !(source.h > 0)) throw new Error('[output] cropBox: source { w, h } must be above 0');
  if (!box || !(box.w > 0) || !(box.h > 0)) throw new Error('[output] cropBox: box { w, h } must be above 0');
  const rw = c.w * source.w, rh = c.h * source.h;                 // the region, in source pixels
  let sx = box.w / rw, sy = box.h / rh;
  if (fit === 'contain') sx = sy = Math.min(sx, sy);
  else if (fit === 'cover') sx = sy = Math.max(sx, sy);
  const cw = rw * sx, ch = rh * sy;                               // the region, in box pixels
  const rl = (box.w - cw) / 2, rt = (box.h - ch) / 2;             // centred
  const clip = { left: Math.max(0, rl), top: Math.max(0, rt), width: Math.min(box.w, cw), height: Math.min(box.h, ch) };
  const src = { left: rl - c.x * source.w * sx, top: rt - c.y * source.h * sy, width: source.w * sx, height: source.h * sy };
  return { clip, source: src };
}
