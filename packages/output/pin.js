// @openav/output · pin — the four-corner correction (keystone, corner-pin) as one projective transform. Pure: no DOM.
//
// A projector that is not square to the wall throws a trapezoid. The fix is to draw the picture already distorted the
// other way, so it lands as a rectangle: move each corner of the picture to where the screen's corner really is. Four
// points decide one homography (a 3×3 matrix up to scale), and a browser applies it to a whole element with a CSS
// matrix3d(): the picture, its test grid and anything else in the box bend together, on the GPU, with nothing redrawn.
//
//   const H = cornerPin([[0, 0], [1920, 40], [1900, 1080], [10, 1060]], 1920, 1080);   // the rectangle 1920×1080 → that quad
//   el.style.transformOrigin = '0 0';
//   el.style.transform = toMatrix3d(H);
//
// Corners are always [top-left, top-right, bottom-right, bottom-left] of the picture. The quad must be convex and must
// not fold or collapse: a quad that does is refused (checkQuad says why), because no projector can throw it and the
// matrix for it would turn the picture inside out.

const EPS = 1e-9;

/** Why these four points are not a quad a picture can be pinned to, or null when they are. */
export function checkQuad(corners) {
  if (!Array.isArray(corners) || corners.length !== 4) return 'needs four corners [[x, y] × 4]: top-left, top-right, bottom-right, bottom-left';
  for (let i = 0; i < 4; i++) {
    const p = corners[i];
    if (!Array.isArray(p) || p.length !== 2 || !Number.isFinite(p[0]) || !Number.isFinite(p[1])) return `corner ${i + 1} is not [x, y] with two finite numbers`;
  }
  // the turn at every corner: one sign all the way round = convex; a zero = three corners on one line
  let pos = 0, neg = 0, area = 0, span = 0;
  for (let i = 0; i < 4; i++) {
    const [ax, ay] = corners[i], [bx, by] = corners[(i + 1) % 4], [cx, cy] = corners[(i + 2) % 4];
    const z = (bx - ax) * (cy - by) - (by - ay) * (cx - bx);
    if (z > 0) pos++; else if (z < 0) neg++;
    area += ax * by - bx * ay;
    span = Math.max(span, Math.abs(bx - ax), Math.abs(by - ay));
  }
  const tiny = EPS * Math.max(1, span * span);
  if (pos && neg) return 'the quad is not convex: a corner is pushed inside it, or two edges cross';
  if (Math.abs(area) / 2 <= tiny) return 'the corners enclose no area';
  if (pos + neg < 4) return 'three corners lie on one line';
  return null;
}

/**
 * The homography that takes the rectangle (0, 0)–(width, height) to the quad `corners`, as 9 numbers, row by row:
 * [a, b, c, d, e, f, g, h, i] maps (x, y) to ((a·x + b·y + c) / w, (d·x + e·y + f) / w) with w = g·x + h·y + i.
 * Throws when the quad is not one a picture can be pinned to (see checkQuad).
 * @param {number[][]} corners  [[x, y] × 4]: top-left, top-right, bottom-right, bottom-left
 * @param {number} [width=1]
 * @param {number} [height=1]
 * @returns {number[]}
 */
export function cornerPin(corners, width = 1, height = 1) {
  const why = checkQuad(corners);
  if (why) throw new Error(`[output] cornerPin: ${why}`);
  if (!(width > 0) || !(height > 0)) throw new Error(`[output] cornerPin: width and height must be above 0, got ${width} × ${height}`);
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = corners;
  // the unit square → the quad (Heckbert): an affine part, plus g and h when the quad is not a parallelogram
  const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
  let g = 0, h = 0;
  if (Math.abs(dx3) > EPS || Math.abs(dy3) > EPS) {
    const den = dx1 * dy2 - dx2 * dy1;
    if (Math.abs(den) <= EPS) throw new Error('[output] cornerPin: the quad is degenerate');
    g = (dx3 * dy2 - dx2 * dy3) / den;
    h = (dx1 * dy3 - dx3 * dy1) / den;
  }
  const a = x1 - x0 + g * x1, b = x3 - x0 + h * x3, c = x0;
  const d = y1 - y0 + g * y1, e = y3 - y0 + h * y3, f = y0;
  // every corner must stay in front (w > 0): otherwise the browser draws the picture through infinity
  for (const w of [1, 1 + g, 1 + g + h, 1 + h]) if (!(w > EPS)) throw new Error('[output] cornerPin: the quad folds the picture through infinity');
  // the rectangle → the unit square is a scale; fold it in
  return [a / width, b / height, c, d / width, e / height, f, g / width, h / height, 1];
}

/** Where the point (x, y) lands under the homography H (9 numbers, row by row). */
export function projectPoint(H, x, y) {
  const w = H[6] * x + H[7] * y + H[8];
  return [(H[0] * x + H[1] * y + H[2]) / w, (H[3] * x + H[4] * y + H[5]) / w];
}

// 12 decimals and no exponent: a CSS number may be written 1e-7, but a fixed form is what every engine reads the same way
const num = (v) => {
  if (Object.is(v, -0) || Math.abs(v) < 1e-12) return '0';
  return v.toFixed(12).replace(/\.?0+$/, '');
};

/**
 * The CSS transform for a homography: `matrix3d(…)`. Use it with `transform-origin: 0 0` on an element whose box is the
 * rectangle the homography was made for.
 * @param {number[]} H  9 numbers, row by row (what cornerPin returns)
 * @returns {string}
 */
export function toMatrix3d(H) {
  if (!Array.isArray(H) || H.length !== 9 || !H.every(Number.isFinite)) throw new Error('[output] toMatrix3d: needs the 9 numbers of a homography, row by row');
  // CSS lists a 4×4 matrix column by column; z passes through untouched
  return `matrix3d(${[H[0], H[3], 0, H[6], H[1], H[4], 0, H[7], 0, 0, 1, 0, H[2], H[5], 0, H[8]].map(num).join(', ')})`;
}

/**
 * Flip and rotation as a relabelling of the corners: the picture's corner i lands on the physical corner returned here.
 * rotate (0, 90, 180, 270, clockwise) turns the picture; flipX mirrors it left–right (rear projection), flipY top–bottom
 * (a projector hung upside down that cannot flip itself). The picture's own box is width × height, or height × width
 * after a quarter turn (see pinnedBox).
 * @returns {number[]} for each picture corner 0..3, the index of the physical corner it goes to
 */
export function cornerOrder({ rotate = 0, flipX = false, flipY = false } = {}) {
  const r = (((Math.round(rotate / 90) % 4) + 4) % 4);
  const fx = [1, 0, 3, 2], fy = [3, 2, 1, 0];
  return [0, 1, 2, 3].map((i) => { let j = (i + r) % 4; if (flipX) j = fx[j]; if (flipY) j = fy[j]; return j; });
}

/**
 * Everything one output needs to bend its picture: the picture's box (width × height, swapped after a quarter turn) and
 * the homography from that box to the four physical corners, which are given normalized (0..1 of the window).
 * @param {{ corners:number[][], rotate?:number, flipX?:boolean, flipY?:boolean }} room
 * @param {number} W  window width, px
 * @param {number} H  window height, px
 * @returns {{ width:number, height:number, matrix:number[], css:string, quad:number[][] }}
 */
export function pinnedBox(room, W, H) {
  const quad = room.corners.map(([x, y]) => [x * W, y * H]);
  const order = cornerOrder(room);
  const turned = (((Math.round((room.rotate || 0) / 90) % 2) + 2) % 2) === 1;
  const width = turned ? H : W, height = turned ? W : H;
  const matrix = cornerPin(order.map((j) => quad[j]), width, height);
  return { width, height, matrix, css: toMatrix3d(matrix), quad };
}
