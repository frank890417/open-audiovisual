// @openav/align · warp — the manual calibration of a projection: four corners, a mesh, a feathered edge, masks, brightness.
//
// One calibration file (open-audiovisual/align-calibration@1) holds, for each tile, where its corners land on the desktop
// (corner pin), a fine mesh on top of that, the feather of each edge (an overlap blend), a gain and black masks. Pure.
//
// One zone, in zone coordinates (u, v) ∈ [0, 1]² (u to the right, v down, over the tile's segment):
//   desktop position = H(u, v) + mesh(u, v)
//     H     the perspective transform the four corners make (the unit square → the quad; top-left, top-right, bottom-right,
//           bottom-left of the segment)
//     mesh  cols × rows control points, each a shift in desktop px, bilinear in between; all 0 = pure perspective
//   brightness = gain × feather(u, v)^(1/gamma) × masks(u, v)
// Not calibrated (the default zone) = the corners are the tile's dst, the mesh is 0, no feather: the same pixels as the
// plain 1:1 or scaled mapping. A turned feed (tile.rotate) turns its default corners; (u, v) stay on the segment.
//
// A file written as art-align-cal/v1 reads unchanged ("contract" is accepted wherever "format" is).
export const CALIBRATION_FORMAT = 'open-audiovisual/align-calibration@1';
/** The format a calibration is written with. Same value as CALIBRATION_FORMAT; the name art-align used. */
export const CAL_CONTRACT = CALIBRATION_FORMAT;
const READ_FORMATS = [CALIBRATION_FORMAT, 'art-align-cal/v1'];
export const MESH_MIN = 2, MESH_MAX = 9;

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const num = (v, d) => (Number.isFinite(+v) ? +v : d);
/** Whether a document is a calibration (either format name). */
export const isCalibration = (c) => !!c && typeof c === 'object' && READ_FORMATS.includes(c.format ?? c.contract);

/**
 * A tile's zone before anyone calibrated it: the corners on its dst (turned with the feed), a flat 3 × 3 mesh, no feather,
 * gamma 2.2, gain 1, and the layout's masks for that segment.
 * @param {object} tile
 * @returns {object}
 */
export function defaultZone(tile) {
  const { x, y, w, h } = tile.dst;
  const box = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
  const r = ((tile.rotate || 0) / 90) % 4;   // turned 90° clockwise: the segment's top-left lands on dst's top-right
  return {
    corners: box.map((_, i) => [...box[(i + r) % 4]]),
    mesh: { cols: 3, rows: 3, d: Array.from({ length: 9 }, () => [0, 0]) },
    feather: { l: 0, r: 0, t: 0, b: 0 },   // share of the zone's width (or height), 0–0.5
    gamma: 2.2,                             // the feather curve's gamma (2.2 is usual for projector blends)
    gain: 1,                                // the zone's brightness, 0–1.5
    masks: (tile.masks || []).map(({ u, v, w, h }) => ({ u, v, w, h })),   // [{ u, v, w, h }] in zone coordinates, drawn black
  };
}

/**
 * One zone made whole: missing parts from the default, numbers clamped to a sane range, a mesh whose point count does
 * not match reset to flat.
 * @param {object} z
 * @param {object} tile
 * @returns {object}
 */
export function normalizeZone(z, tile) {
  const d = defaultZone(tile);
  if (!z || typeof z !== 'object') return d;
  const corners = Array.isArray(z.corners) && z.corners.length === 4 ? z.corners.map((p, i) => [num(p?.[0], d.corners[i][0]), num(p?.[1], d.corners[i][1])]) : d.corners;
  const cols = clamp(Math.round(num(z.mesh?.cols, 3)), MESH_MIN, MESH_MAX), rows = clamp(Math.round(num(z.mesh?.rows, 3)), MESH_MIN, MESH_MAX);
  const md = Array.isArray(z.mesh?.d) && z.mesh.d.length === cols * rows ? z.mesh.d.map((p) => [num(p?.[0], 0), num(p?.[1], 0)]) : Array.from({ length: cols * rows }, () => [0, 0]);
  const f = z.feather || {};
  return {
    corners,
    mesh: { cols, rows, d: md },
    feather: { l: clamp(num(f.l, 0), 0, 0.5), r: clamp(num(f.r, 0), 0, 0.5), t: clamp(num(f.t, 0), 0, 0.5), b: clamp(num(f.b, 0), 0, 0.5) },
    gamma: clamp(num(z.gamma, 2.2), 0.5, 4),
    gain: clamp(num(z.gain, 1), 0, 1.5),
    masks: Array.isArray(z.masks) ? z.masks.map((m) => ({ u: clamp(num(m.u, 0.4), 0, 1), v: clamp(num(m.v, 0.4), 0, 1), w: clamp(num(m.w, 0.2), 0, 1), h: clamp(num(m.h, 0.2), 0, 1) })) : [],
  };
}

/**
 * A whole calibration made whole for one mapping: one zone per tile under variants[variant]. Other variants (other
 * layouts of the same work) are kept as they are. Anything that is not a calibration starts empty.
 * @param {object|null} cal
 * @param {object} mapping
 * @param {string} [variant]
 * @returns {{format:string, savedAt:string|null, variants:object}}
 */
export function normalizeCalibration(cal, mapping, variant = mapping.id) {
  const c = isCalibration(cal) ? cal : { variants: {} };
  const v = c.variants?.[variant] || {};
  const zones = {};
  for (const t of mapping.tiles) zones[t.name] = normalizeZone(v.zones?.[t.name], t);
  return { format: CALIBRATION_FORMAT, savedAt: c.savedAt ?? null, variants: { ...(c.variants || {}), [variant]: { zones } } };
}

/**
 * The 3 × 3 perspective matrix from the unit square (0,0) (1,0) (1,1) (0,1) to a quad, row by row [a, b, c, d, e, f, g, h, 1];
 * null for a degenerate quad (three corners on a line).
 * @param {number[][]} q  [[x, y] × 4]: top-left, top-right, bottom-right, bottom-left
 * @returns {number[]|null}
 */
export function squareToQuad(q) {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = q;
  const dx1 = x1 - x2, dx2 = x3 - x2, dy1 = y1 - y2, dy2 = y3 - y2;
  const sx = x0 - x1 + x2 - x3, sy = y0 - y1 + y2 - y3;
  let g = 0, h = 0;
  if (Math.abs(sx) > 1e-12 || Math.abs(sy) > 1e-12) {
    const den = dx1 * dy2 - dx2 * dy1;
    if (Math.abs(den) < 1e-12) return null;
    g = (sx * dy2 - dx2 * sy) / den;
    h = (dx1 * sy - sx * dy1) / den;
  }
  return [x1 - x0 + g * x1, x3 - x0 + h * x3, x0, y1 - y0 + g * y1, y3 - y0 + h * y3, y0, g, h, 1];
}

/** Where (u, v) lands under the 3 × 3 matrix H. */
export function applyH(H, u, v) {
  const w = H[6] * u + H[7] * v + H[8];
  return [(H[0] * u + H[1] * v + H[2]) / w, (H[3] * u + H[4] * v + H[5]) / w];
}

/** The mesh's shift at (u, v), bilinear between control points. */
export function meshAt(mesh, u, v) {
  const { cols, rows, d } = mesh;
  const fx = clamp(u, 0, 1) * (cols - 1), fy = clamp(v, 0, 1) * (rows - 1);
  const i = Math.min(cols - 2, Math.floor(fx)), j = Math.min(rows - 2, Math.floor(fy));
  const tx = fx - i, ty = fy - j;
  const p = (a, b) => d[b * cols + a];
  const a = p(i, j), b = p(i + 1, j), c = p(i, j + 1), e = p(i + 1, j + 1);
  return [
    (a[0] * (1 - tx) + b[0] * tx) * (1 - ty) + (c[0] * (1 - tx) + e[0] * tx) * ty,
    (a[1] * (1 - tx) + b[1] * tx) * (1 - ty) + (c[1] * (1 - tx) + e[1] * tx) * ty,
  ];
}

/**
 * A zone point (u, v) → desktop px: the corners' perspective, plus the mesh's shift there.
 * @param {object} zone
 * @param {number} u
 * @param {number} v
 * @param {number[]|null} [H]  squareToQuad(zone.corners), when you have it already
 * @returns {number[]}
 */
export function warpPoint(zone, u, v, H = squareToQuad(zone.corners)) {
  if (!H) return [NaN, NaN];
  const [x, y] = applyH(H, u, v), [mx, my] = meshAt(zone.mesh, u, v);
  return [x + mx, y + my];
}

/** Where mesh control point k is on the desktop (the drag handles). */
export function meshPointPos(zone, k, H = squareToQuad(zone.corners)) {
  const { cols, rows } = zone.mesh;
  return warpPoint(zone, (k % cols) / (cols - 1), Math.floor(k / cols) / (rows - 1), H);
}

/** A mesh at another density, its shifts read off the old one: the picture does not jump. */
export function resampleMesh(mesh, cols, rows) {
  cols = clamp(cols, MESH_MIN, MESH_MAX); rows = clamp(rows, MESH_MIN, MESH_MAX);
  const d = [];
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) d.push(meshAt(mesh, i / (cols - 1), j / (rows - 1)));
  return { cols, rows, d };
}

/**
 * The feather weight at (u, v), 0–1: a cosine ramp over each edge's share of the zone, the curve blendWeight uses.
 * @param {{l:number,r:number,t:number,b:number}} f
 * @param {number} u
 * @param {number} v
 * @returns {number}
 */
export function featherAt(f, u, v) {
  const e = (t, w) => (w <= 0 ? 1 : t >= w ? 1 : 0.5 - 0.5 * Math.cos(Math.PI * clamp(t / w, 0, 1)));
  return e(u, f.l) * e(1 - u, f.r) * e(v, f.t) * e(1 - v, f.b);
}

/**
 * The calibrated zone as a triangle grid for WebGL: n × n cells, { pos: Float32Array (x, y desktop px), uv: Float32Array,
 * index: Uint32Array }.
 * @param {object} zone
 * @param {number} [n]
 */
export function zoneGrid(zone, n = 32) {
  const H = squareToQuad(zone.corners);
  const pos = new Float32Array((n + 1) * (n + 1) * 2), uv = new Float32Array((n + 1) * (n + 1) * 2), index = new Uint32Array(n * n * 6);
  let k = 0;
  for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++, k++) {
    const u = i / n, v = j / n, [x, y] = H ? warpPoint(zone, u, v, H) : [0, 0];
    pos[k * 2] = x; pos[k * 2 + 1] = y; uv[k * 2] = u; uv[k * 2 + 1] = v;
  }
  let m = 0;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const a = j * (n + 1) + i, b = a + 1, c = a + n + 1, d = c + 1;
    index[m++] = a; index[m++] = c; index[m++] = b; index[m++] = b; index[m++] = c; index[m++] = d;
  }
  return { pos, uv, index };
}

/** A zone's handles, the four corners and the mesh points, in desktop px (a click takes the nearest). */
export function handlesOf(zone) {
  const H = squareToQuad(zone.corners);
  const out = zone.corners.map((p, i) => ({ kind: 'corner', i, x: p[0], y: p[1] }));
  const { cols, rows } = zone.mesh;
  for (let k = 0; k < cols * rows; k++) { const [x, y] = meshPointPos(zone, k, H); out.push({ kind: 'mesh', i: k, x, y }); }
  return out;
}

/**
 * Turn a whole zone a quarter clockwise (dir −1: back): the corners move round one place, as defaultZone turns a feed.
 * For a projector hung the other way. Changes the zone and returns it.
 * @param {object} zone
 * @param {number} [dir]
 * @returns {object}
 */
export function rotateZone(zone, dir = 1) {
  const c = zone.corners, n = ((dir % 4) + 4) % 4;
  zone.corners = c.map((_, i) => c[(i + n) % 4]);
  return zone;
}

/**
 * Whether four corners make a convex quad, clockwise on the screen (y down). A folded or crossed quad would draw inside out.
 * @param {number[][]} q
 * @returns {boolean}
 */
export function quadOk(q) {
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const [ax, ay] = q[i], [bx, by] = q[(i + 1) % 4], [cx, cy] = q[(i + 2) % 4];
    const z = (bx - ax) * (cy - by) - (by - ay) * (cx - bx);
    if (Math.abs(z) < 1e-9) return false;
    if (!sign) sign = Math.sign(z); else if (Math.sign(z) !== sign) return false;
  }
  return sign > 0;
}
