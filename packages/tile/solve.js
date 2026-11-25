// @openav/tile · solve — where each screen lies on the table, from one photo. Pure math: no DOM, no OpenCV.
//
//   const { ok, layout, report } = solveLayout({ devices, photo });
//   devices: [{ id, w, h, index?, markers: [{ cell?, device: [[x,y]×4], photo: [[x,y]×4] }] }]
//            device = a marker's corners in that screen's own pixels; photo = the same corners in the photo
//
// The model. Every screen lies in ONE plane (the table), and a screen's pixels are evenly spaced on it, so
// "screen pixels → table" is a similarity (turn + uniform scale + shift) for every screen. The camera adds one
// perspective, "table → photo", the same for all of them. So each screen's homography H_i (screen px → photo) is
// G · S_i, and H_ref⁻¹ · H_i = S_ref⁻¹ · S_i is a similarity: the camera's perspective cancels, and the difference
// in pixel density between a phone and a laptop ends up in the scale. The reference is the screen that covers the
// most of the photo; the shared canvas is measured in its pixels.
//
// The steps:
//   1. per screen, a normalized DLT homography (Hartley: centre and scale the points first, or the 9×9 system is
//      hopeless in double precision with pixel coordinates in the thousands); markers whose corners land far from it
//      are dropped once (a misread id), and a screen with fewer than `minMarkers` markers is reported, not solved;
//   2. S_i from a least-squares similarity fit of the screen's own corners to its photo corners taken back through
//      H_ref⁻¹;
//   3. (refine) all of it at once: one plane homography G and every S_i (S_ref = identity) by Levenberg–Marquardt on
//      the reprojection error in the photo, so the perspective is measured by every marker on the table, not only by
//      the reference's (which matters for a screen far from the reference);
//   4. the canvas is moved so the union of the screens starts at (0, 0).
//
// The output (layout.json) keeps room for the 3D model that comes next: a screen as a window posed in space
// (PnP + off-axis projection, the same model as projection mapping). Each device has `kind: 'planar'` and
// `pose: null` today; a `kind: 'window'` device will carry `pose` instead of relying on the shared plane.

export const LAYOUT_VERSION = 1;

// ---------------------------------------------------------------------------------------------- 3×3, row-major
export const I3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];

export function mul3(A, B) {
  const C = new Array(9);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) C[r * 3 + c] = A[r * 3] * B[c] + A[r * 3 + 1] * B[3 + c] + A[r * 3 + 2] * B[6 + c];
  return C;
}

export function det3(M) {
  return M[0] * (M[4] * M[8] - M[5] * M[7]) - M[1] * (M[3] * M[8] - M[5] * M[6]) + M[2] * (M[3] * M[7] - M[4] * M[6]);
}

/** Inverse, or null for a singular matrix. */
export function inv3(M) {
  const d = det3(M);
  if (!Number.isFinite(d) || Math.abs(d) < 1e-300) return null;
  const k = 1 / d;
  return [
    (M[4] * M[8] - M[5] * M[7]) * k, (M[2] * M[7] - M[1] * M[8]) * k, (M[1] * M[5] - M[2] * M[4]) * k,
    (M[5] * M[6] - M[3] * M[8]) * k, (M[0] * M[8] - M[2] * M[6]) * k, (M[2] * M[3] - M[0] * M[5]) * k,
    (M[3] * M[7] - M[4] * M[6]) * k, (M[1] * M[6] - M[0] * M[7]) * k, (M[0] * M[4] - M[1] * M[3]) * k,
  ];
}

/** (x, y) through a homography. */
export function apply3(M, [x, y]) {
  const w = M[6] * x + M[7] * y + M[8];
  return [(M[0] * x + M[1] * y + M[2]) / w, (M[3] * x + M[4] * y + M[5]) / w];
}

const scaleTo1 = (M) => (Math.abs(M[8]) > 1e-12 ? M.map((v) => v / M[8]) : M);

// ---------------------------------------------------------------------------------------------- similarities
/** {a, b, tx, ty} → 3×3: x' = a·x − b·y + tx, y' = b·x + a·y + ty (a turn by atan2(b, a), a scale of hypot(a, b)). */
export function similarityMatrix({ a, b, tx, ty }) { return [a, -b, tx, b, a, ty, 0, 0, 1]; }
export function similarityOf(M) { return { a: M[0], b: M[3], tx: M[2], ty: M[5] }; }
export const similarityScale = ({ a, b }) => Math.hypot(a, b);
export const similarityAngle = ({ a, b }) => Math.atan2(b, a);

/**
 * The similarity that best carries `src` onto `dst` (least squares, closed form), with its RMS residual.
 * null with fewer than two points or no spread.
 */
export function fitSimilarity(src, dst) {
  const n = Math.min(src.length, dst.length);
  if (n < 2) return null;
  let mux = 0, muy = 0, mqx = 0, mqy = 0;
  for (let k = 0; k < n; k++) { mux += src[k][0]; muy += src[k][1]; mqx += dst[k][0]; mqy += dst[k][1]; }
  mux /= n; muy /= n; mqx /= n; mqy /= n;
  let suu = 0, sa = 0, sb = 0;
  for (let k = 0; k < n; k++) {
    const ux = src[k][0] - mux, uy = src[k][1] - muy, qx = dst[k][0] - mqx, qy = dst[k][1] - mqy;
    suu += ux * ux + uy * uy; sa += ux * qx + uy * qy; sb += ux * qy - uy * qx;
  }
  if (!(suu > 1e-12)) return null;
  const a = sa / suu, b = sb / suu;
  const s = { a, b, tx: mqx - (a * mux - b * muy), ty: mqy - (b * mux + a * muy) };
  return { ...s, rms: rmsError(similarityMatrix(s), src, dst) };
}

/** RMS of the distance between M·src and dst (pixels of dst). */
export function rmsError(M, src, dst) {
  let e = 0;
  for (let k = 0; k < src.length; k++) { const p = apply3(M, src[k]); e += (p[0] - dst[k][0]) ** 2 + (p[1] - dst[k][1]) ** 2; }
  return src.length ? Math.sqrt(e / src.length) : 0;
}

// ---------------------------------------------------------------------------------------------- DLT
/** Hartley's normalization: a similarity that moves the points' centroid to 0 and their mean distance to √2. */
export function normalizer(pts) {
  let cx = 0, cy = 0;
  for (const p of pts) { cx += p[0]; cy += p[1]; }
  cx /= pts.length; cy /= pts.length;
  let d = 0;
  for (const p of pts) d += Math.hypot(p[0] - cx, p[1] - cy);
  d /= pts.length;
  const s = d > 1e-12 ? Math.SQRT2 / d : 1;
  return [s, 0, -s * cx, 0, s, -s * cy, 0, 0, 1];
}

// Eigen-decomposition of a symmetric n×n matrix (cyclic Jacobi): ascending eigenvalues with their vectors.
function eigSym(S, n) {
  const A = S.slice(), V = new Array(n * n).fill(0);
  for (let i = 0; i < n; i++) V[i * n + i] = 1;
  for (let sweep = 0; sweep < 100; sweep++) {
    let off = 0, diag = 0;
    for (let i = 0; i < n; i++) { diag += A[i * n + i] ** 2; for (let j = i + 1; j < n; j++) off += A[i * n + j] ** 2; }
    if (off <= 1e-30 * diag || off === 0) break;
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) {
      const apq = A[p * n + q];
      if (Math.abs(apq) < 1e-300) continue;
      const theta = (A[q * n + q] - A[p * n + p]) / (2 * apq);
      const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
      const c = 1 / Math.sqrt(t * t + 1), s = t * c;
      for (let k = 0; k < n; k++) {                         // A ← A·J
        const akp = A[k * n + p], akq = A[k * n + q];
        A[k * n + p] = c * akp - s * akq; A[k * n + q] = s * akp + c * akq;
      }
      for (let k = 0; k < n; k++) {                         // A ← Jᵀ·A
        const apk = A[p * n + k], aqk = A[q * n + k];
        A[p * n + k] = c * apk - s * aqk; A[q * n + k] = s * apk + c * aqk;
      }
      for (let k = 0; k < n; k++) {
        const vkp = V[k * n + p], vkq = V[k * n + q];
        V[k * n + p] = c * vkp - s * vkq; V[k * n + q] = s * vkp + c * vkq;
      }
    }
  }
  const order = [...Array(n).keys()].sort((i, j) => A[i * n + i] - A[j * n + j]);
  return { values: order.map((i) => A[i * n + i]), vectors: order.map((i) => Array.from({ length: n }, (_, k) => V[k * n + i])) };
}

/**
 * The homography H with dst ≈ H·src, by the direct linear transform on ≥ 4 correspondences.
 * `normalize: false` skips Hartley's normalization (kept only so a test can show why it is there).
 * Returns { ok: true, H } (H[8] = 1) or { ok: false, reason } — never throws.
 */
export function homography(src, dst, { normalize = true } = {}) {
  const n = Math.min(src.length, dst.length);
  if (n < 4) return { ok: false, reason: 'too-few-points' };
  const Ts = normalize ? normalizer(src) : I3, Td = normalize ? normalizer(dst) : I3;
  const AtA = new Array(81).fill(0);
  const add = (row) => { for (let i = 0; i < 9; i++) { if (!row[i]) continue; for (let j = 0; j < 9; j++) AtA[i * 9 + j] += row[i] * row[j]; } };
  for (let k = 0; k < n; k++) {
    const [x, y] = apply3(Ts, src[k]), [u, v] = apply3(Td, dst[k]);
    add([-x, -y, -1, 0, 0, 0, x * u, y * u, u]);
    add([0, 0, 0, -x, -y, -1, x * v, y * v, v]);
  }
  const { values, vectors } = eig(AtA);
  // a second (near-)zero eigenvalue: the points do not pin a homography down (collinear, repeated)
  if (!(values[1] > 1e-12 * Math.max(1e-300, values[8]))) return { ok: false, reason: 'degenerate' };
  const Hn = vectors[0];
  const Tdi = inv3(Td);
  const H = mul3(Tdi, mul3(Hn, Ts));
  if (!H.every(Number.isFinite) || Math.abs(H[8]) < 1e-15 || !inv3(H)) return { ok: false, reason: 'degenerate' };
  return { ok: true, H: scaleTo1(H) };
}
const eig = (S) => eigSym(S, 9);

// ---------------------------------------------------------------------------------------------- linear solve
// (A + λ·diag A) x = b for a small dense system: Gaussian elimination with partial pivoting.
function solveLinear(A, b, n) {
  const M = A.slice(), x = b.slice();
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r * n + c]) > Math.abs(M[p * n + c])) p = r;
    if (Math.abs(M[p * n + c]) < 1e-300) return null;
    if (p !== c) {
      for (let k = 0; k < n; k++) { const t = M[c * n + k]; M[c * n + k] = M[p * n + k]; M[p * n + k] = t; }
      const t = x[c]; x[c] = x[p]; x[p] = t;
    }
    for (let r = c + 1; r < n; r++) {
      const f = M[r * n + c] / M[c * n + c];
      if (!f) continue;
      for (let k = c; k < n; k++) M[r * n + k] -= f * M[c * n + k];
      x[r] -= f * x[c];
    }
  }
  for (let r = n - 1; r >= 0; r--) {
    let s = x[r];
    for (let k = r + 1; k < n; k++) s -= M[r * n + k] * x[k];
    x[r] = s / M[r * n + r];
  }
  return x.every(Number.isFinite) ? x : null;
}

// ---------------------------------------------------------------------------------------------- joint refinement
// Minimize Σ |G·S_i·u − p|² over G (8 numbers, G[8] = 1) and S_i (4 numbers each, the reference's fixed), in
// normalized coordinates so every unknown is of order 1. groups: [{ U, P, S }], ref: index of the reference.
function refineJoint(G0, groups, ref, { iterations = 60 } = {}) {
  const Tp = normalizer(groups.flatMap((g) => g.P));
  const Tc = normalizer(groups.flatMap((g) => g.U.map((u) => apply3(g.S, u))));
  const Tpi = inv3(Tp), Tci = inv3(Tc);
  const Tu = groups.map((g) => normalizer(g.U));
  const Un = groups.map((g, i) => g.U.map((u) => apply3(Tu[i], u)));
  const Pn = groups.map((g) => g.P.map((p) => apply3(Tp, p)));
  const Gn = scaleTo1(mul3(Tp, mul3(G0, Tci)));
  const Sn = groups.map((g, i) => similarityOf(mul3(Tc, mul3(g.S, inv3(Tu[i])))));
  const free = groups.map((_, i) => i).filter((i) => i !== ref);
  const P = 8 + 4 * free.length;
  const pack = () => [...Gn.slice(0, 8), ...free.flatMap((i) => [Sn[i].a, Sn[i].b, Sn[i].tx, Sn[i].ty])];
  const unpack = (x) => {
    const g = [...x.slice(0, 8), 1];
    const s = Sn.map((v) => ({ ...v }));
    free.forEach((i, k) => { const o = 8 + 4 * k; s[i] = { a: x[o], b: x[o + 1], tx: x[o + 2], ty: x[o + 3] }; });
    return { g, s };
  };
  // cost, and (when asked) the normal equations JᵀJ, Jᵀr — rows touch 8 + 4 unknowns, so they are summed directly
  const evaluate = (g, s, normal) => {
    let cost = 0;
    const JtJ = normal ? new Float64Array(P * P) : null, Jtr = normal ? new Float64Array(P) : null;
    groups.forEach((_, i) => {
      const { a, b, tx, ty } = s[i], o = free.indexOf(i), base = o < 0 ? -1 : 8 + 4 * o;
      for (let k = 0; k < Un[i].length; k++) {
        const [u, v] = Un[i][k];
        const x = a * u - b * v + tx, y = b * u + a * v + ty;
        const w = g[6] * x + g[7] * y + 1;
        const px = (g[0] * x + g[1] * y + g[2]) / w, py = (g[3] * x + g[4] * y + g[5]) / w;
        const rx = px - Pn[i][k][0], ry = py - Pn[i][k][1];
        cost += rx * rx + ry * ry;
        if (!normal) continue;
        // d(px, py) / d(g0..g7)
        const jx = [x / w, y / w, 1 / w, 0, 0, 0, -px * x / w, -px * y / w];
        const jy = [0, 0, 0, x / w, y / w, 1 / w, -py * x / w, -py * y / w];
        const idx = [0, 1, 2, 3, 4, 5, 6, 7];
        if (base >= 0) {
          // through (x, y): d(px, py)/d(x, y) · d(x, y)/d(a, b, tx, ty)
          const dxx = (g[0] - px * g[6]) / w, dxy = (g[1] - px * g[7]) / w, dyx = (g[3] - py * g[6]) / w, dyy = (g[4] - py * g[7]) / w;
          const dX = [u, -v, 1, 0], dY = [v, u, 0, 1];
          for (let m = 0; m < 4; m++) { jx.push(dxx * dX[m] + dxy * dY[m]); jy.push(dyx * dX[m] + dyy * dY[m]); idx.push(base + m); }
        }
        for (let p = 0; p < idx.length; p++) {
          Jtr[idx[p]] += jx[p] * rx + jy[p] * ry;
          for (let q = 0; q < idx.length; q++) JtJ[idx[p] * P + idx[q]] += jx[p] * jx[q] + jy[p] * jy[q];
        }
      }
    });
    return { cost, JtJ, Jtr };
  };
  let x = pack(), cur = unpack(x), ev = evaluate(cur.g, cur.s, true), lambda = 1e-3;
  for (let it = 0; it < iterations; it++) {
    const A = Array.from(ev.JtJ);
    for (let d = 0; d < P; d++) A[d * P + d] += lambda * (ev.JtJ[d * P + d] || 1e-12);
    const step = solveLinear(A, Array.from(ev.Jtr, (v) => -v), P);
    if (!step) { lambda *= 10; if (lambda > 1e12) break; continue; }
    const xn = x.map((v, k) => v + step[k]);
    const nx = unpack(xn), cost = evaluate(nx.g, nx.s, false).cost;
    if (Number.isFinite(cost) && cost < ev.cost) {
      const gain = (ev.cost - cost) / Math.max(ev.cost, 1e-300);
      x = xn; cur = nx; ev = evaluate(cur.g, cur.s, true); lambda = Math.max(lambda / 10, 1e-12);
      if (gain < 1e-12) break;
    } else {
      lambda *= 10;
      if (lambda > 1e12) break;
    }
  }
  const G = mul3(Tpi, mul3(cur.g, Tc));
  const S = groups.map((g, i) => (i === ref ? g.S : mul3(Tci, mul3(similarityMatrix(cur.s[i]), Tu[i]))));
  return { G: scaleTo1(G), S };
}

// ---------------------------------------------------------------------------------------------- the layout
const flat = (markers, key) => markers.flatMap((m) => m[key]);
function polygonArea(pts) {
  let s = 0;
  for (let i = 0; i < pts.length; i++) { const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length]; s += x1 * y2 - x2 * y1; }
  return s / 2;
}
const corners = (w, h) => [[0, 0], [w, 0], [w, h], [0, h]];
const round = (v, k = 1e9) => Math.round(v * k) / k;

// One screen's homography, with markers that do not fit it dropped (a misread id lands a marker on the wrong screen).
function fitDevice(dev, { minMarkers, rejectPx }) {
  let markers = (dev.markers || []).filter((m) => m && m.device?.length === 4 && m.photo?.length === 4);
  const all = markers.length;
  if (markers.length < minMarkers) return { status: 'too-few-markers', markers: all };
  let fit = null;
  for (let pass = 0; pass < 3; pass++) {
    fit = homography(flat(markers, 'device'), flat(markers, 'photo'));
    if (!fit.ok) return { status: fit.reason, markers: all };
    const err = markers.map((m) => Math.max(...m.device.map((u, k) => Math.hypot(...apply3(fit.H, u).map((v, j) => v - m.photo[k][j])))));
    const sorted = [...err].sort((p, q) => p - q), median = sorted[Math.floor(sorted.length / 2)];
    const limit = Math.max(rejectPx, 4 * median);
    const keep = markers.filter((_, k) => err[k] <= limit);
    if (keep.length === markers.length) break;
    if (keep.length < minMarkers) return { status: 'inconsistent-markers', markers: all, rejected: all - keep.length };
    markers = keep;
  }
  // the screen faces the camera: its corners keep their clockwise order in the photo (y down)
  const quad = corners(dev.w, dev.h).map((c) => apply3(fit.H, c));
  const area = polygonArea(quad);
  if (!(area > 0)) return { status: 'degenerate', markers: all };
  return { status: 'ok', H: fit.H, kept: markers, markers: markers.length, rejected: all - markers.length, area };
}

/**
 * The layout of every screen from marker correspondences. Never throws.
 * @param {object} o
 * @param {{id:string, w:number, h:number, index?:number, markers:{device:number[][], photo:number[][]}[]}[]} o.devices
 * @param {{w:number, h:number}} [o.photo]     size of the photo, recorded in the layout
 * @param {number} [o.minMarkers=4]            fewer markers in view than this: the screen is reported, not solved
 * @param {string} [o.reference]               a device id; default: the screen that covers the most of the photo
 * @param {boolean} [o.refine=true]            the joint refinement (step 3)
 * @param {number} [o.rejectPx=6]              a marker whose corner is further than this (and 4× the median) is dropped
 * @returns {{ ok: boolean, layout: object|null, report: object[], reason?: string }}
 */
export function solveLayout({ devices = [], photo = null, minMarkers = 4, reference = null, refine = true, rejectPx = 6 } = {}) {
  const report = [];
  const solved = [];
  for (const dev of devices) {
    if (!dev || typeof dev.id !== 'string' || !(dev.w > 0) || !(dev.h > 0)) { report.push({ id: dev?.id ?? null, status: 'bad-device', markers: 0 }); continue; }
    const f = fitDevice(dev, { minMarkers, rejectPx });
    report.push({ id: dev.id, status: f.status, markers: f.markers, rejected: f.rejected || 0 });
    if (f.status === 'ok') solved.push({ dev, ...f });
  }
  if (!solved.length) {
    const seen = devices.reduce((n, d) => n + (d?.markers?.length || 0), 0);
    return { ok: false, layout: null, report, reason: seen ? `no screen shows ${minMarkers} markers` : 'no markers found' };
  }
  let ref = solved.findIndex((s) => s.dev.id === reference);
  if (ref < 0) ref = solved.reduce((best, s, i) => (s.area > solved[best].area ? i : best), 0);
  const Hri = inv3(solved[ref].H);

  // step 2: each screen's similarity to the reference, from its corners taken back through H_ref⁻¹
  const groups = solved.map((s, i) => {
    const U = flat(s.kept, 'device'), P = flat(s.kept, 'photo');
    if (i === ref) return { U, P, S: I3.slice() };
    const f = fitSimilarity(U, P.map((p) => apply3(Hri, p)));
    return { U, P, S: f ? similarityMatrix(f) : I3.slice() };
  });
  let G = solved[ref].H, S = groups.map((g) => g.S);
  if (refine) ({ G, S } = refineJoint(G, groups, ref));

  // step 4: the canvas starts where the screens start
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  solved.forEach((s, i) => { for (const c of corners(s.dev.w, s.dev.h)) { const [x, y] = apply3(S[i], c); x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); } });
  const O = [1, 0, -x0, 0, 1, -y0, 0, 0, 1], Oi = [1, 0, x0, 0, 1, y0, 0, 0, 1];
  const plane = scaleTo1(mul3(G, Oi));

  const out = solved.map((s, i) => {
    const sim = similarityOf(mul3(O, S[i]));
    const similarity = { a: round(sim.a), b: round(sim.b), tx: round(sim.tx, 1e6), ty: round(sim.ty, 1e6) };
    const rms = rmsError(mul3(plane, similarityMatrix(similarity)), groups[i].U, groups[i].P);
    const r = report.find((x) => x.id === s.dev.id);
    r.rms = round(rms, 1e4);
    return {
      id: s.dev.id,
      ...(Number.isInteger(s.dev.index) ? { index: s.dev.index } : {}),
      w: s.dev.w, h: s.dev.h,
      kind: 'planar',
      similarity,
      matrix3x3: similarityMatrix(similarity),
      rms: round(rms, 1e4),
      markers: s.markers,
      pose: null,
    };
  });
  const layout = {
    version: LAYOUT_VERSION,
    kind: 'planar',
    units: 'reference-px',
    reference: solved[ref].dev.id,
    canvas: { w: round(x1 - x0, 1e4), h: round(y1 - y0, 1e4) },
    ...(photo && photo.w > 0 && photo.h > 0 ? { photo: { w: photo.w, h: photo.h } } : {}),
    plane: { matrix3x3: plane.map((v) => round(v, 1e12)) },
    devices: out,
  };
  return { ok: true, layout, report };
}

// ---------------------------------------------------------------------------------------------- the schema
const num = (v) => typeof v === 'number' && Number.isFinite(v);
const mat9 = (m) => Array.isArray(m) && m.length === 9 && m.every(num);

/** Is this a layout a tile can play from? { ok, errors: string[] } — one message per problem, never throws. */
export function validateLayout(L) {
  const e = [];
  if (!L || typeof L !== 'object' || Array.isArray(L)) return { ok: false, errors: ['layout is not an object'] };
  if (L.version !== LAYOUT_VERSION) e.push(`version must be ${LAYOUT_VERSION} (got ${JSON.stringify(L.version)})`);
  if (typeof L.reference !== 'string' || !L.reference) e.push('reference must be a device id');
  if (!L.canvas || !(num(L.canvas.w) && L.canvas.w > 0) || !(num(L.canvas.h) && L.canvas.h > 0)) e.push('canvas must be { w > 0, h > 0 }');
  if (L.plane != null && !mat9(L.plane.matrix3x3)) e.push('plane.matrix3x3 must be 9 numbers');
  if (!Array.isArray(L.devices) || !L.devices.length) e.push('devices must be a non-empty array');
  const ids = new Set();
  for (const [i, d] of (Array.isArray(L.devices) ? L.devices : []).entries()) {
    const at = `devices[${i}]`;
    if (!d || typeof d !== 'object') { e.push(`${at} is not an object`); continue; }
    if (typeof d.id !== 'string' || !d.id) e.push(`${at}.id must be a string`);
    else if (ids.has(d.id)) e.push(`${at}.id "${d.id}" appears twice`);
    else ids.add(d.id);
    if (!(Number.isInteger(d.w) && d.w > 0 && Number.isInteger(d.h) && d.h > 0)) e.push(`${at}: w and h must be positive whole pixels`);
    if (d.kind === 'planar') {
      const s = d.similarity;
      if (!s || ![s.a, s.b, s.tx, s.ty].every(num)) e.push(`${at}.similarity must be { a, b, tx, ty }`);
      else if (!(Math.hypot(s.a, s.b) > 0)) e.push(`${at}.similarity has no scale`);
      if (!mat9(d.matrix3x3)) e.push(`${at}.matrix3x3 must be 9 numbers`);
      else if (s && [s.a, s.b, s.tx, s.ty].every(num)) {
        const m = similarityMatrix(s), tol = 1e-6 * (1 + Math.abs(s.tx) + Math.abs(s.ty));
        if (m.some((v, k) => Math.abs(v - d.matrix3x3[k]) > tol)) e.push(`${at}.matrix3x3 does not match its similarity`);
      }
      if (d.pose != null && typeof d.pose !== 'object') e.push(`${at}.pose must be null or an object`);
    } else if (d.kind === 'window') {
      // reserved for the 3D model: a screen posed in space. A layout of this version may carry it; tiles of this
      // version cannot draw it yet (view.js says so), but the format does not have to change for it.
      if (!d.pose || typeof d.pose !== 'object') e.push(`${at}: kind "window" needs a pose`);
    } else e.push(`${at}.kind must be "planar" or "window"`);
    if (d.rms != null && !(num(d.rms) && d.rms >= 0)) e.push(`${at}.rms must be a number ≥ 0`);
  }
  if (typeof L.reference === 'string' && ids.size && !ids.has(L.reference)) e.push(`reference "${L.reference}" is not one of the devices`);
  return { ok: e.length === 0, errors: e };
}
