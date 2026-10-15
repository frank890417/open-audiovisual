// Anything → TriMesh. No imports of three.js or smlibwasm: they are recognised by shape (duck typing).
//   ① TriMesh                         { vertices, triangles }
//   ② smlibwasm Part / Shape           has .tessellate()
//   ③ smlibwasm Mesh / any mesh-like   { positions|vertices|points, indices|triangles|faces|index }
//   ④ three.js Mesh / Object3D / BufferGeometry (Y up → Z up: (x, y, z) → (x, -z, y); opts.scale = mm per unit)

const isTri = (x) => x && x.vertices && x.triangles && typeof x.vertices.length === 'number' && typeof x.triangles.length === 'number' && !Array.isArray(x.vertices[0]);
const isThenable = (x) => x && typeof x.then === 'function';

const flat = (a) => {
  if (!a) return null;
  if (ArrayBuffer.isView(a)) return a;
  if (Array.isArray(a)) {
    if (a.length && (Array.isArray(a[0]) || ArrayBuffer.isView(a[0]))) { const o = []; for (const p of a) for (const q of p) o.push(q); return o; }
    if (a.length && typeof a[0] === 'object') { const o = []; for (const p of a) o.push(p.x, p.y, p.z); return o; }
    return a;
  }
  return null;
};

// A tessellation result in whichever spelling the kernel uses → TriMesh (units copied, default mm)
export function fromMeshLike(m, scale = 1) {
  if (!m) throw new Error('fab：拿不到網格（tessellate 沒有回傳東西）。');
  const pos = flat(m.positions || m.vertices || m.points || m.position);
  let idx = flat(m.indices || m.triangles || m.faces || m.index || m.triVerts);
  if (!pos || !pos.length) throw new Error('fab：看不懂這個網格（找不到 positions／vertices）。');
  const n = (pos.length / 3) | 0;
  if (!idx || !idx.length) { idx = new Uint32Array(n); for (let i = 0; i < n; i++) idx[i] = i; }
  const vertices = new Float64Array(pos.length);
  for (let i = 0; i < pos.length; i++) vertices[i] = pos[i] * scale;
  return { vertices, triangles: Uint32Array.from(idx), units: m.units || 'mm' };
}

function fromThree(root, scale) {
  if (typeof root.updateMatrixWorld === 'function') root.updateMatrixWorld(true);
  const meshes = [];
  if (!root.isObject3D && root.attributes && root.attributes.position) meshes.push({ geometry: root, matrixWorld: null });
  else {
    const visit = (o) => {
      if (o.geometry && o.geometry.attributes && o.geometry.attributes.position && o.visible !== false) meshes.push(o);
      for (const c of o.children || []) visit(c);
    };
    visit(root);
  }
  if (!meshes.length) throw new Error('fab：這個 three 物件裡找不到任何網格（geometry.attributes.position）。');
  const verts = [], tris = [];
  let base = 0;
  for (const m of meshes) {
    const pos = m.geometry.attributes.position, count = pos.count != null ? pos.count : (pos.array.length / (pos.itemSize || 3)) | 0;
    const e = m.matrixWorld && m.matrixWorld.elements ? m.matrixWorld.elements : [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    const det = e[0] * (e[5] * e[10] - e[6] * e[9]) - e[4] * (e[1] * e[10] - e[2] * e[9]) + e[8] * (e[1] * e[6] - e[2] * e[5]);
    const get = pos.isInterleavedBufferAttribute || !pos.array
      ? (i) => [pos.getX(i), pos.getY(i), pos.getZ(i)]
      : (i) => { const s = pos.itemSize || 3; return [pos.array[i * s], pos.array[i * s + 1], pos.array[i * s + 2]]; };
    for (let i = 0; i < count; i++) {
      const [x, y, z] = get(i);
      const wx = e[0] * x + e[4] * y + e[8] * z + e[12], wy = e[1] * x + e[5] * y + e[9] * z + e[13], wz = e[2] * x + e[6] * y + e[10] * z + e[14];
      verts.push(wx * scale, (0 - wz) * scale, wy * scale);
    }
    const ix = m.geometry.index;
    const flip = det < 0;   // mirrored object: keep faces outward
    const push = (a, b, c) => { if (flip) tris.push(base + a, base + c, base + b); else tris.push(base + a, base + b, base + c); };
    if (ix && ix.array) { const m3 = ix.count != null ? ix.count : ix.array.length; for (let i = 0; i + 2 < m3; i += 3) push(ix.array[i], ix.array[i + 1], ix.array[i + 2]); }
    else for (let i = 0; i + 2 < count; i += 3) push(i, i + 1, i + 2);
    base += count;
  }
  return { vertices: Float64Array.from(verts), triangles: Uint32Array.from(tris), units: 'mm' };
}

export function meshOf(x, opts = {}) {
  const scale = opts.scale != null ? opts.scale : 1;
  if (x == null) throw new Error('fab：沒有給任何東西可以轉成網格。');
  if (isTri(x)) return { vertices: x.vertices, triangles: x.triangles instanceof Uint32Array ? x.triangles : Uint32Array.from(x.triangles), units: x.units || 'mm' };
  if (x.isObject3D || (x.attributes && x.attributes.position) || (x.geometry && x.geometry.attributes)) return fromThree(x, scale);
  if (typeof x.tessellate === 'function') {
    const r = x.tessellate(opts.tessellate);
    if (isThenable(r)) throw new Error('fab：tessellate 回傳 Promise，請改用 await lab.fab.meshOfAsync(x)。');
    return fromMeshLike(r, scale);
  }
  return fromMeshLike(x, scale);
}

export async function meshOfAsync(x, opts = {}) {
  if (x && !isTri(x) && !x.isObject3D && typeof x.tessellate === 'function') return fromMeshLike(await x.tessellate(opts.tessellate), opts.scale != null ? opts.scale : 1);
  return meshOf(x, opts);
}
