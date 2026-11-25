// @openav/tile · view — which piece of the shared canvas this screen draws. Pure math; the helpers take your context.
//
//   const view = tileView(layout, myId);          // or soloView(w, h) before there is a layout: the canvas is this screen
//   view.apply2d(ctx, canvas.width / view.device.w)   // 2D canvas: draw in canvas units from here on
//   view.applyP5(sk)                              // p5: applyMatrix() at the top of draw()
//   view.visible(x, y, r)                         // worth drawing here at all?
//
// The canvas is measured in the reference screen's pixels and includes the gaps and bezels between screens: a ball
// that leaves one screen travels behind the bezel and comes out on the next one where it would really be, at the same
// physical size, because each screen's transform is its true position on the table.

import { inv3, apply3, similarityMatrix, similarityScale, similarityAngle } from './solve.js';

function make({ id, w, h, toCanvas, canvas }) {
  const toDevice = inv3(toCanvas);
  const poly = [[0, 0], [w, 0], [w, h], [0, h]].map((c) => apply3(toCanvas, c));
  const xs = poly.map((p) => p[0]), ys = poly.map((p) => p[1]);
  const bounds = { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
  const sim = { a: toCanvas[0], b: toCanvas[3] };
  const m = toDevice;
  return {
    ok: true,
    id,
    device: { w, h },
    canvas,
    toCanvas, toDevice,
    /** device pixels per canvas unit */
    scale: 1 / similarityScale(sim),
    /** how far this screen is turned on the canvas, radians */
    angle: similarityAngle(sim),
    polygon: poly,
    bounds,
    /** a canvas point → this screen's pixels */
    point: (x, y) => apply3(m, [x, y]),
    /** a point of this screen → the canvas */
    fromDevice: (x, y) => apply3(toCanvas, [x, y]),
    /** the six numbers of ctx.setTransform / applyMatrix, for a context that draws in device px × pixelRatio */
    matrix(pixelRatio = 1) { const k = pixelRatio; return [m[0] * k, m[3] * k, m[1] * k, m[4] * k, m[2] * k, m[5] * k]; },
    /** 2D canvas: from now on, draw in canvas units. pixelRatio = backing pixels per device pixel (canvas.width / w). */
    apply2d(ctx, pixelRatio = 1) { ctx.setTransform(...this.matrix(pixelRatio)); },
    /** p5 (instance or global) on a canvas the size of the screen: p5 draws in CSS pixels, device px ÷ density. Top of draw(). */
    applyP5(sk, density = this.device.w / Math.max(1, sk.width)) { sk.applyMatrix(...this.matrix(1 / density)); },
    /** CSS transform for an element laid out in canvas units at the top-left of this screen (transform-origin 0 0). */
    css(dpr = 1) { return `matrix(${this.matrix(1 / dpr).join(',')})`; },
    /** Does a circle of radius r at (x, y) (canvas units) touch this screen? (bounding-box test: cheap, never too strict) */
    visible(x, y, r = 0) { return x + r >= bounds.x0 && x - r <= bounds.x1 && y + r >= bounds.y0 && y - r <= bounds.y1; },
  };
}

/**
 * The view of device `id` in a layout: { ok: true, … } or { ok: false, reason } (not in the layout, or a kind this
 * version cannot draw yet). Never throws.
 */
export function tileView(layout, id) {
  const d = layout?.devices?.find((x) => x.id === id);
  if (!d) return { ok: false, reason: 'not-in-layout' };
  if (d.kind !== 'planar') return { ok: false, reason: `kind "${d.kind}" needs the 3D window model (not in this version)` };
  const toCanvas = Array.isArray(d.matrix3x3) && d.matrix3x3.length === 9 ? d.matrix3x3 : similarityMatrix(d.similarity);
  if (!inv3(toCanvas)) return { ok: false, reason: 'singular' };
  return make({ id, w: d.w, h: d.h, toCanvas, canvas: { ...layout.canvas } });
}

/** A screen on its own: the canvas is this screen, one canvas unit per device pixel. */
export function soloView(w, h, id = 'solo') {
  return make({ id, w, h, toCanvas: [1, 0, 0, 0, 1, 0, 0, 0, 1], canvas: { w, h } });
}
