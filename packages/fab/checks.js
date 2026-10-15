// @openav/fab — manufacturability checks on a plain triangle mesh. Pure functions, no DOM, no dependencies.
//
// TriMesh = { vertices: Float32Array|Float64Array (x,y,z,…), triangles: Uint32Array (3 per face, counter-clockwise seen from outside), units: 'mm' }

export const DENSITY = { PETG: 1.27, PLA: 1.24 };   // g/cm³

const DEFAULTS = { angle: 45, minWall: 1.2, bed: [320, 320, 325], wallSamples: 2000, overhangWarn: 0.15, weld: true };

export function bboxOf(vertices) {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < vertices.length; i += 3) {
    for (let k = 0; k < 3; k++) { const v = vertices[i + k]; if (v < min[k]) min[k] = v; if (v > max[k]) max[k] = v; }
  }
  if (!vertices.length) return { min: [0, 0, 0], max: [0, 0, 0], size: [0, 0, 0] };
  return { min, max, size: [max[0] - min[0], max[1] - min[1], max[2] - min[2]] };
}

const diagOf = (bb) => Math.hypot(bb.size[0], bb.size[1], bb.size[2]);

// Merge vertices closer than `tolerance` (default 1e-6 × bbox diagonal) and drop faces that collapse.
// Without this an un-indexed mesh (three.js toNonIndexed, STL, every "triangle soup") never looks closed.
export function weldMesh(mesh, tolerance) {
  const v = mesh.vertices, n = (v.length / 3) | 0;
  const bb = bboxOf(v);
  const tol = tolerance != null ? tolerance : 1e-6 * (diagOf(bb) || 1);
  const cell = tol > 0 ? tol : 1e-12;
  const buckets = new Map();
  const remap = new Uint32Array(n);
  const out = [];
  const hash = (a, b, c) => ((a * 73856093) ^ (b * 19349663) ^ (c * 83492791)) | 0;
  for (let i = 0; i < n; i++) {
    const x = v[i * 3], y = v[i * 3 + 1], z = v[i * 3 + 2];
    const cx = Math.floor(x / cell), cy = Math.floor(y / cell), cz = Math.floor(z / cell);
    let found = -1;
    search: for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
      const list = buckets.get(hash(cx + dx, cy + dy, cz + dz));
      if (!list) continue;
      for (const j of list) {
        if (Math.abs(out[j * 3] - x) <= tol && Math.abs(out[j * 3 + 1] - y) <= tol && Math.abs(out[j * 3 + 2] - z) <= tol) { found = j; break search; }
      }
    }
    if (found < 0) {
      found = out.length / 3;
      out.push(x, y, z);
      const h = hash(cx, cy, cz);
      const list = buckets.get(h);
      if (list) list.push(found); else buckets.set(h, [found]);
    }
    remap[i] = found;
  }
  const tri = [];
  const t = mesh.triangles;
  for (let i = 0; i < t.length; i += 3) {
    const a = remap[t[i]], b = remap[t[i + 1]], c = remap[t[i + 2]];
    if (a !== b && b !== c && a !== c) tri.push(a, b, c);
  }
  return { vertices: Float64Array.from(out), triangles: Uint32Array.from(tri), units: mesh.units || 'mm' };
}

// Edge census: every undirected edge counted by direction. Closed + consistently wound = each edge has exactly one forward and one backward use.
export function edgeStats(mesh) {
  const nv = mesh.vertices.length / 3, t = mesh.triangles;
  const edges = new Map();
  for (let i = 0; i < t.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      const a = t[i + k], b = t[i + (k + 1) % 3];
      const lo = a < b ? a : b, hi = a < b ? b : a, key = lo * nv + hi;
      let e = edges.get(key);
      if (!e) { e = [0, 0]; edges.set(key, e); }
      e[a < b ? 0 : 1]++;
    }
  }
  let open = 0, nonManifold = 0, inconsistent = 0;
  for (const [f, b] of edges.values()) {
    const c = f + b;
    if (c === 1) open++;
    else if (c > 2) nonManifold++;
    else if (c === 2 && f !== 1) inconsistent++;
  }
  return { openEdges: open, nonManifoldEdges: nonManifold, inconsistentEdges: inconsistent, watertight: t.length > 0 && open === 0 && nonManifold === 0 && inconsistent === 0 };
}

export function signedVolume(mesh) {
  const v = mesh.vertices, t = mesh.triangles;
  const bb = bboxOf(v), ox = bb.min[0], oy = bb.min[1], oz = bb.min[2];
  let s = 0;
  for (let i = 0; i < t.length; i += 3) {
    const a = t[i] * 3, b = t[i + 1] * 3, c = t[i + 2] * 3;
    const ax = v[a] - ox, ay = v[a + 1] - oy, az = v[a + 2] - oz;
    const bx = v[b] - ox, by = v[b + 1] - oy, bz = v[b + 2] - oz;
    const cx = v[c] - ox, cy = v[c + 1] - oy, cz = v[c + 2] - oz;
    s += ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx);
  }
  return s / 6;
}

// Overhang: share of surface area facing down within (90 - angle)° of -Z. Faces resting on the lowest 0.2 mm (the bed) don't count.
export function overhangOf(mesh, angle = 45, flip = false) {
  const v = mesh.vertices, t = mesh.triangles;
  const zmin = bboxOf(v).min[2];
  const limit = Math.cos(((90 - angle) * Math.PI) / 180);   // -nz must exceed this
  let total = 0, over = 0;
  for (let i = 0; i < t.length; i += 3) {
    const a = t[i] * 3, b = t[i + 1] * 3, c = t[i + 2] * 3;
    const ux = v[b] - v[a], uy = v[b + 1] - v[a + 1], uz = v[b + 2] - v[a + 2];
    const wx = v[c] - v[a], wy = v[c + 1] - v[a + 1], wz = v[c + 2] - v[a + 2];
    const nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
    const len = Math.hypot(nx, ny, nz);
    if (len === 0) continue;
    const area = len / 2;
    total += area;
    const dn = (flip ? 1 : -1) * nz / len;   // downward-facing component
    if (dn <= limit) continue;
    if (Math.max(v[a + 2], v[b + 2], v[c + 2]) < zmin + 0.2) continue;
    over += area;
  }
  return { angle, area: over, ratio: total > 0 ? over / total : 0 };
}

// ---- thinnest wall: shoot a ray into the part from each (sampled) face centre and keep the shortest distance to another face.
function buildBvh(v, t) {
  const nt = t.length / 3;
  const cen = new Float64Array(nt * 3), lo = new Float64Array(nt * 3), hi = new Float64Array(nt * 3);
  for (let i = 0; i < nt; i++) {
    for (let k = 0; k < 3; k++) {
      const p0 = v[t[i * 3] * 3 + k], p1 = v[t[i * 3 + 1] * 3 + k], p2 = v[t[i * 3 + 2] * 3 + k];
      lo[i * 3 + k] = Math.min(p0, p1, p2); hi[i * 3 + k] = Math.max(p0, p1, p2); cen[i * 3 + k] = (p0 + p1 + p2) / 3;
    }
  }
  const order = Array.from({ length: nt }, (_, i) => i);
  const nodes = [];   // { b:[6], l, r, s, n }
  const build = (s, e) => {
    const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
    for (let i = s; i < e; i++) { const f = order[i]; for (let k = 0; k < 3; k++) { if (lo[f * 3 + k] < b[k]) b[k] = lo[f * 3 + k]; if (hi[f * 3 + k] > b[3 + k]) b[3 + k] = hi[f * 3 + k]; } }
    const node = { b, l: -1, r: -1, s, n: e - s };
    const idx = nodes.push(node) - 1;
    if (e - s <= 4) return idx;
    let ax = 0, ext = b[3] - b[0];
    if (b[4] - b[1] > ext) { ax = 1; ext = b[4] - b[1]; }
    if (b[5] - b[2] > ext) ax = 2;
    const part = order.slice(s, e).sort((p, q) => cen[p * 3 + ax] - cen[q * 3 + ax]);
    for (let i = 0; i < part.length; i++) order[s + i] = part[i];
    const mid = (s + e) >> 1;
    node.l = build(s, mid); node.r = build(mid, e); node.n = 0;
    return idx;
  };
  if (nt) build(0, nt);
  return { nodes, order };
}

// nearest hit distance along (o, d) with tMin < t < tMax, ignoring triangle `skip`; Infinity when none
function rayNearest(bvh, v, t, ox, oy, oz, dx, dy, dz, tMin, tMax, skip) {
  const { nodes, order } = bvh;
  const ix = 1 / dx, iy = 1 / dy, iz = 1 / dz;
  const stack = [0];
  let best = tMax;
  while (stack.length) {
    const node = nodes[stack.pop()];
    const b = node.b;
    let t0 = tMin, t1 = best;
    let a = (b[0] - ox) * ix, c = (b[3] - ox) * ix; if (a > c) { const q = a; a = c; c = q; }
    if (a > t0) t0 = a; if (c < t1) t1 = c;
    a = (b[1] - oy) * iy; c = (b[4] - oy) * iy; if (a > c) { const q = a; a = c; c = q; }
    if (a > t0) t0 = a; if (c < t1) t1 = c;
    a = (b[2] - oz) * iz; c = (b[5] - oz) * iz; if (a > c) { const q = a; a = c; c = q; }
    if (a > t0) t0 = a; if (c < t1) t1 = c;
    if (t0 > t1 + 1e-9) continue;
    if (node.l >= 0) { stack.push(node.l, node.r); continue; }
    for (let k = node.s; k < node.s + node.n; k++) {
      const f = order[k];
      if (f === skip) continue;
      const p = t[f * 3] * 3, q = t[f * 3 + 1] * 3, r = t[f * 3 + 2] * 3;
      const e1x = v[q] - v[p], e1y = v[q + 1] - v[p + 1], e1z = v[q + 2] - v[p + 2];
      const e2x = v[r] - v[p], e2y = v[r + 1] - v[p + 1], e2z = v[r + 2] - v[p + 2];
      const px = dy * e2z - dz * e2y, py = dz * e2x - dx * e2z, pz = dx * e2y - dy * e2x;
      const det = e1x * px + e1y * py + e1z * pz;
      if (Math.abs(det) < 1e-14) continue;
      const inv = 1 / det;
      const sx = ox - v[p], sy = oy - v[p + 1], sz = oz - v[p + 2];
      const u = (sx * px + sy * py + sz * pz) * inv;
      if (u < 0 || u > 1) continue;
      const qx = sy * e1z - sz * e1y, qy = sz * e1x - sx * e1z, qz = sx * e1y - sy * e1x;
      const w = (dx * qx + dy * qy + dz * qz) * inv;
      if (w < 0 || u + w > 1) continue;
      const hit = (e2x * qx + e2y * qy + e2z * qz) * inv;
      if (hit > tMin && hit < best) best = hit;
    }
  }
  return best;
}

export function minWallOf(mesh, { samples = 2000, flip = false } = {}) {
  const v = mesh.vertices, t = mesh.triangles, nt = t.length / 3;
  if (!nt) return null;
  const diag = diagOf(bboxOf(v)) || 1;
  const bvh = buildBvh(v, t);
  const step = nt > samples ? nt / samples : 1;
  const eps = 1e-6 * diag;
  let best = Infinity, shot = 0;
  for (let s = 0; s < Math.min(nt, samples); s++) {
    const f = Math.floor(s * step);
    const a = t[f * 3] * 3, b = t[f * 3 + 1] * 3, c = t[f * 3 + 2] * 3;
    const ux = v[b] - v[a], uy = v[b + 1] - v[a + 1], uz = v[b + 2] - v[a + 2];
    const wx = v[c] - v[a], wy = v[c + 1] - v[a + 1], wz = v[c + 2] - v[a + 2];
    let nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
    const len = Math.hypot(nx, ny, nz);
    if (len === 0) continue;
    const sg = flip ? 1 : -1;   // into the part
    nx = (sg * nx) / len; ny = (sg * ny) / len; nz = (sg * nz) / len;
    const ox = (v[a] + v[b] + v[c]) / 3, oy = (v[a + 1] + v[b + 1] + v[c + 1]) / 3, oz = (v[a + 2] + v[b + 2] + v[c + 2]) / 3;
    shot++;
    const d = rayNearest(bvh, v, t, ox, oy, oz, nx || 1e-300, ny || 1e-300, nz || 1e-300, eps, best, f);
    if (d < best) best = d;
  }
  return Number.isFinite(best) ? { value: best, samples: shot } : null;
}

const r3 = (x) => Math.round(x * 1000) / 1000;

export function checkMesh(input, opts = {}) {
  const o = { ...DEFAULTS, ...opts };
  const mesh = o.weld === false ? input : weldMesh(input);
  const bbox = bboxOf(mesh.vertices);
  const edges = edgeStats(mesh);
  const sv = signedVolume(mesh);
  const flip = sv < 0;   // inside-out mesh: measure with the normals reversed
  const volume = Math.abs(sv);
  const overhang = overhangOf(mesh, o.angle, flip);
  const minWall = minWallOf(mesh, { samples: o.wallSamples, flip });
  const grams = { PETG: r3((volume / 1000) * DENSITY.PETG), PLA: r3((volume / 1000) * DENSITY.PLA) };
  const warnings = [];
  if (!edges.watertight) warnings.push(`網格不水密（開放邊 ${edges.openEdges} 條、非流形邊 ${edges.nonManifoldEdges} 條、方向不一致 ${edges.inconsistentEdges} 條），切片軟體可能補不好。`);
  if (overhang.ratio > o.overhangWarn) warnings.push(`懸空面積約 ${Math.round(overhang.ratio * 100)}%（超過 ${o.angle}° 的向下面），多半要加支撐。`);
  if (minWall && minWall.value < o.minWall) warnings.push(`最薄壁約 ${r3(minWall.value)} mm，低於 ${o.minWall} mm，可能印不出來。`);
  const bed = o.bed;
  if (bbox.size.some((s, i) => s > bed[i])) warnings.push(`尺寸 ${bbox.size.map((s) => r3(s)).join('×')} mm 超出列印床 ${bed.join('×')} mm。`);
  return {
    units: mesh.units || 'mm',
    triangles: mesh.triangles.length / 3,
    bbox, volume, watertight: edges.watertight,
    openEdges: edges.openEdges, nonManifoldEdges: edges.nonManifoldEdges, inconsistentEdges: edges.inconsistentEdges,
    overhang, minWall, grams, warnings,
  };
}
