// TriMesh → STL / OBJ / minimal GLB bytes, and the format router (step / dxf / glb of smlibwasm Parts go through the kernel).
import { weldMesh, checkMesh } from './checks.js?v=25d69b2';
import { meshOfAsync, isKernelShape } from './mesh.js?v=25d69b2';

export const MIME = { stl: 'model/stl', obj: 'model/obj', step: 'model/step', dxf: 'image/vnd.dxf', glb: 'model/gltf-binary' };
const ALIAS = { stp: 'step', gltf: 'glb' };

// Binary STL: 80-byte header, uint32 count, then per face normal(3×f32) + 3 vertices(9×f32) + uint16 0  = 84 + 50n bytes.
export function toStlBytes(mesh) {
  const v = mesh.vertices, t = mesh.triangles, n = t.length / 3;
  const buf = new ArrayBuffer(84 + 50 * n), dv = new DataView(buf);
  const head = new TextEncoder().encode('open-audiovisual fab STL (mm)');
  new Uint8Array(buf, 0, 80).set(head.subarray(0, 80));
  dv.setUint32(80, n, true);
  let o = 84;
  for (let i = 0; i < n; i++) {
    const a = t[i * 3] * 3, b = t[i * 3 + 1] * 3, c = t[i * 3 + 2] * 3;
    const ux = v[b] - v[a], uy = v[b + 1] - v[a + 1], uz = v[b + 2] - v[a + 2];
    const wx = v[c] - v[a], wy = v[c + 1] - v[a + 1], wz = v[c + 2] - v[a + 2];
    let nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len; ny /= len; nz /= len;
    dv.setFloat32(o, nx, true); dv.setFloat32(o + 4, ny, true); dv.setFloat32(o + 8, nz, true);
    let p = o + 12;
    for (const k of [a, b, c]) { dv.setFloat32(p, v[k], true); dv.setFloat32(p + 4, v[k + 1], true); dv.setFloat32(p + 8, v[k + 2], true); p += 12; }
    dv.setUint16(o + 48, 0, true);
    o += 50;
  }
  return new Uint8Array(buf);
}

// Read our own (or any binary) STL back — used by the tests and by anyone who wants to round-trip.
export function fromStlBytes(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const n = dv.getUint32(80, true);
  const vertices = new Float32Array(n * 9), triangles = new Uint32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const o = 84 + 50 * i;
    for (let k = 0; k < 9; k++) vertices[i * 9 + k] = dv.getFloat32(o + 12 + k * 4, true);
    triangles[i * 3] = i * 3; triangles[i * 3 + 1] = i * 3 + 1; triangles[i * 3 + 2] = i * 3 + 2;
  }
  return { vertices, triangles, units: 'mm' };
}

export function toObjText(mesh, name = 'fab') {
  const w = weldMesh(mesh);
  const lines = [`# open-audiovisual fab · units: mm`, `o ${String(name).replace(/\s+/g, '_')}`];
  for (let i = 0; i < w.vertices.length; i += 3) lines.push(`v ${+w.vertices[i].toFixed(6)} ${+w.vertices[i + 1].toFixed(6)} ${+w.vertices[i + 2].toFixed(6)}`);
  for (let i = 0; i < w.triangles.length; i += 3) lines.push(`f ${w.triangles[i] + 1} ${w.triangles[i + 1] + 1} ${w.triangles[i + 2] + 1}`);
  return lines.join('\n') + '\n';
}

// Minimal glTF 2.0 binary: one mesh, POSITION (float32) + uint32 indices. Coordinates stay in mm, Z up (asset.extras says so).
export function toGlbBytes(mesh) {
  const w = weldMesh(mesh);
  const nv = w.vertices.length / 3, ni = w.triangles.length;
  const pos = new Float32Array(w.vertices), idx = new Uint32Array(w.triangles);
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < pos.length; i += 3) for (let k = 0; k < 3; k++) { if (pos[i + k] < min[k]) min[k] = pos[i + k]; if (pos[i + k] > max[k]) max[k] = pos[i + k]; }
  if (!nv) { min.fill(0); max.fill(0); }
  const json = {
    asset: { version: '2.0', generator: 'open-audiovisual fab', extras: { units: 'mm', up: 'Z' } },
    scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1, mode: 4 }] }],
    buffers: [{ byteLength: pos.byteLength + idx.byteLength }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: pos.byteLength, target: 34962 }, { buffer: 0, byteOffset: pos.byteLength, byteLength: idx.byteLength, target: 34963 }],
    accessors: [{ bufferView: 0, componentType: 5126, count: nv, type: 'VEC3', min, max }, { bufferView: 1, componentType: 5125, count: ni, type: 'SCALAR' }],
  };
  const jb = new TextEncoder().encode(JSON.stringify(json));
  const jpad = (4 - (jb.length % 4)) % 4, bin = pos.byteLength + idx.byteLength, bpad = (4 - (bin % 4)) % 4;
  const total = 12 + 8 + jb.length + jpad + 8 + bin + bpad;
  const out = new Uint8Array(total), dv = new DataView(out.buffer);
  dv.setUint32(0, 0x46546c67, true); dv.setUint32(4, 2, true); dv.setUint32(8, total, true);
  dv.setUint32(12, jb.length + jpad, true); dv.setUint32(16, 0x4e4f534a, true);
  out.set(jb, 20); out.fill(0x20, 20 + jb.length, 20 + jb.length + jpad);
  const b0 = 20 + jb.length + jpad;
  dv.setUint32(b0, bin + bpad, true); dv.setUint32(b0 + 4, 0x004e4942, true);
  out.set(new Uint8Array(pos.buffer, pos.byteOffset, pos.byteLength), b0 + 8);
  out.set(new Uint8Array(idx.buffer, idx.byteOffset, idx.byteLength), b0 + 8 + pos.byteLength);
  return out;
}

const toBytes = async (r, what) => {
  if (r == null) throw new Error(`fab：smlibwasm ${what} 沒有回傳內容。`);
  if (typeof r === 'string') return new TextEncoder().encode(r);
  if (r instanceof Uint8Array) return r;
  if (r instanceof ArrayBuffer) return new Uint8Array(r);
  if (ArrayBuffer.isView(r)) return new Uint8Array(r.buffer, r.byteOffset, r.byteLength);
  if (typeof r.arrayBuffer === 'function') return new Uint8Array(await r.arrayBuffer());
  throw new Error(`fab：看不懂 smlibwasm ${what} 回傳的型別。`);
};


// export(x, fmt, opts) → { bytes, mime, ext, report }.  `kernel.smlib()` is only awaited for step / dxf / glb-of-a-Part.
export async function exportAs(x, fmt, opts = {}, kernel = null) {
  const f = ALIAS[String(fmt).toLowerCase()] || String(fmt).toLowerCase();
  if (!MIME[f]) throw new Error(`fab：不支援的格式「${fmt}」（可用：stl、obj、step、dxf、glb）。`);
  // STEP／DXF come straight from the kernel; their report is best-effort (a 2D sketch has no closed mesh).
  let mesh = null, report = null;
  try {
    mesh = await meshOfAsync(x, { ...opts, kernel: opts.kernel || kernel });
    report = checkMesh(mesh, opts);
  } catch (e) {
    if (f !== 'step' && f !== 'dxf') throw e;
  }
  let bytes;
  if (f === 'stl') bytes = toStlBytes(mesh);
  else if (f === 'obj') bytes = new TextEncoder().encode(toObjText(mesh, opts.name));
  else if (f === 'step' || f === 'dxf') {
    if (!isKernelShape(x)) throw new Error(`fab：${f.toUpperCase()} 只能從 smlibwasm 的${f === 'step' ? ' Part（實體）' : ' Shape／Sketch（形狀）'}匯出，網格沒有曲面資訊。`);
    if (!kernel) throw new Error('fab：需要 smlibwasm 核心才能匯出 ' + f.toUpperCase() + '。');
    const sm = await kernel.smlib();
    const fn = f === 'step' ? sm.toStep : sm.toDxf;
    if (typeof fn !== 'function') throw new Error(`fab：這版 smlibwasm 沒有 ${f === 'step' ? 'toStep' : 'toDxf'}。`);
    bytes = await toBytes(await fn.call(sm, x), f === 'step' ? 'toStep' : 'toDxf');
  } else if (isKernelShape(x) && kernel) {
    const sm = await kernel.smlib();
    bytes = typeof sm.toGlb === 'function' ? await toBytes(await sm.toGlb(x), 'toGlb') : toGlbBytes(mesh);
  } else bytes = toGlbBytes(mesh);
  return { bytes, mime: MIME[f], ext: f, report };
}
