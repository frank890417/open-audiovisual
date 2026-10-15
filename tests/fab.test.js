// @openav/fab — pure checks and exports on hand-built meshes; the CAD kernels are stubbed, nothing is fetched.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Fab, checkMesh, weldMesh, meshOf, toStlBytes, fromStlBytes, toObjText, toGlbBytes, candidateUrls } from '../packages/fab/index.js';

// unit cube scaled by (sx, sy, sz), 8 shared vertices, 12 outward counter-clockwise faces
const FACES = [[0, 2, 1], [0, 3, 2], [4, 5, 6], [4, 6, 7], [0, 1, 5], [0, 5, 4], [3, 7, 6], [3, 6, 2], [0, 4, 7], [0, 7, 3], [1, 2, 6], [1, 6, 5]];
const CORNERS = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0], [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]];
const cube = (sx = 10, sy = sx, sz = sx, drop = 0) => ({
  vertices: Float64Array.from(CORNERS.flatMap(([x, y, z]) => [x * sx, y * sy, z * sz])),
  triangles: Uint32Array.from(FACES.slice(0, 12 - drop).flat()), units: 'mm',
});
// the same cube as a triangle soup: 36 vertices, no sharing (what three's toNonIndexed() or an STL gives)
const soup = (m) => {
  const v = [];
  for (const i of m.triangles) v.push(m.vertices[i * 3], m.vertices[i * 3 + 1], m.vertices[i * 3 + 2]);
  return { vertices: Float32Array.from(v), triangles: Uint32Array.from({ length: m.triangles.length }, (_, i) => i), units: 'mm' };
};
const near = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${a} ≉ ${b}`);

test('cube: watertight, volume, mass, STL is 84 + 50n bytes and reads back with the same triangle count', () => {
  const r = checkMesh(cube(10));
  assert.equal(r.watertight, true); assert.equal(r.openEdges, 0); assert.equal(r.nonManifoldEdges, 0);
  near(r.volume, 1000); near(r.grams.PETG, 1.27); near(r.grams.PLA, 1.24);
  assert.deepEqual(r.bbox.size, [10, 10, 10]); assert.equal(r.triangles, 12);
  const stl = toStlBytes(cube(10));
  assert.equal(stl.length, 84 + 50 * 12);
  const back = fromStlBytes(stl);
  assert.equal(back.triangles.length / 3, 12);
  assert.equal(checkMesh(back).watertight, true);   // the soup read back from STL is closed once welded
});

test('open box (one face missing): not watertight, exactly 4 open edges, and it says so in Chinese', () => {
  const r = checkMesh(cube(10, 10, 10, 2));   // top face dropped
  assert.equal(r.watertight, false); assert.equal(r.openEdges, 4);
  assert.ok(r.warnings.some((w) => w.includes('不水密')));
});

test('old behaviour goes red: an un-indexed cube (36 vertices) is watertight only when vertices are merged', () => {
  const s = soup(cube(10));
  assert.equal(s.vertices.length / 3, 36);
  assert.equal(checkMesh(s, { weld: false }).watertight, false, 'naive topology on a triangle soup sees every edge as open');
  const r = checkMesh(s);
  assert.equal(r.watertight, true);
  near(r.volume, 1000);
  assert.equal(weldMesh(s).vertices.length / 3, 8);
});

test('overhang: inverted pyramid ≈ analytic ratio, cube flat on the bed = 0', () => {
  const a = 10, h = 2, A = [-5, -5, h], B = [5, -5, h], C = [5, 5, h], D = [-5, 5, h], P = [0, 0, 0];
  const V = [A, B, C, D, P], F = [[0, 1, 2], [0, 2, 3], [0, 4, 1], [1, 4, 2], [2, 4, 3], [3, 4, 0]];
  const pyr = { vertices: Float64Array.from(V.flat()), triangles: Uint32Array.from(F.flat()), units: 'mm' };
  const side = 4 * 0.5 * a * Math.hypot(h, a / 2), expected = side / (side + a * a);
  const r = checkMesh(pyr);
  assert.equal(r.watertight, true);
  near(r.overhang.ratio, expected, 1e-9);
  assert.ok(r.overhang.ratio > 0.5 && r.warnings.some((w) => w.includes('懸空')));
  assert.equal(checkMesh(cube(20)).overhang.ratio, 0);
  assert.equal(checkMesh(soup(cube(20))).overhang.ratio, 0);
});

test('thinnest wall: a 20×20×2 plate reads 2 mm (±5%), and a 1 mm one triggers the warning', () => {
  const r = checkMesh(cube(20, 20, 2));
  assert.ok(r.minWall && Math.abs(r.minWall.value - 2) <= 0.1, JSON.stringify(r.minWall));
  assert.ok(!r.warnings.some((w) => w.includes('最薄壁')));
  assert.ok(checkMesh(cube(20, 20, 1)).warnings.some((w) => w.includes('最薄壁')));
  assert.equal(checkMesh(cube(500)).warnings.some((w) => w.includes('超出列印床')), true);
});

test('three.js duck type: indexed or not, matrixWorld applied, Y up → Z up, scale in mm per unit', () => {
  const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  const tri = { isMesh: true, geometry: { attributes: { position: { array: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), itemSize: 3, count: 3 } }, index: null }, matrixWorld: { elements: I } };
  const m = meshOf(tri);
  assert.deepEqual([...m.vertices], [0, 0, 0, 1, 0, 0, 0, 0, 1]);   // three (0,1,0) → (0,0,1)
  assert.deepEqual([...m.triangles], [0, 1, 2]);
  // translated by (0, 0, 2) in three (= -2 in Y of the fab frame), scaled ×10, indexed
  const T = I.slice(); T[14] = 2;
  const idx = { isObject3D: true, children: [{ isMesh: true, geometry: { attributes: { position: { array: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), itemSize: 3, count: 3 } }, index: { array: new Uint16Array([0, 2, 1]), count: 3 } }, matrixWorld: { elements: T } }] };
  const m2 = meshOf(idx, { scale: 10 });
  assert.deepEqual([...m2.vertices], [0, -20, 0, 10, -20, 0, 0, -20, 10]);
  assert.deepEqual([...m2.triangles], [0, 2, 1]);
  // a whole non-indexed cube through the same door is watertight
  const s = soup(cube(10)), pos = { array: s.vertices, itemSize: 3, count: 36 };
  const r = new Fab().check({ isMesh: true, geometry: { attributes: { position: pos }, index: null }, matrixWorld: { elements: I } });
  assert.equal(r.watertight, true); near(r.volume, 1000);
});

test('Part-like stubs are routed to the (fake) kernel; plain meshes cannot become STEP', async () => {
  const calls = [];
  const sm = { toStep: (p) => { calls.push('toStep'); return 'ISO-10303-21;'; }, toDxf: () => { calls.push('toDxf'); return new Uint8Array([1, 2]); }, toGlb: () => { calls.push('toGlb'); return new Uint8Array([103, 108, 84, 70]).buffer; } };
  const fab = new Fab({ importer: async (u) => { calls.push('import ' + u); return sm; } });
  const part = { tessellate: () => ({ positions: cube(10).vertices, indices: cube(10).triangles }) };
  const step = await fab.export(part, 'step');
  assert.equal(new TextDecoder().decode(step.bytes), 'ISO-10303-21;'); assert.equal(step.ext, 'step'); assert.equal(step.report.watertight, true);
  assert.deepEqual([...(await fab.export(part, 'dxf')).bytes], [1, 2]);
  assert.equal((await fab.export(part, 'glb')).bytes.length, 4);
  assert.equal(calls.filter((c) => c.startsWith('import')).length, 1, 'the kernel is imported once');
  await assert.rejects(fab.export(cube(10), 'step'), /STEP.*Part/);
  const stl = await fab.export(part, 'stl');
  assert.equal(stl.bytes.length, 84 + 50 * 12); assert.equal(stl.mime, 'model/stl');
  await assert.rejects(fab.export(part, 'xyz'), /不支援/);
});

test('OBJ and GLB writers: shared vertices, valid glTF container', () => {
  const obj = toObjText(soup(cube(10)));
  assert.equal(obj.split('\n').filter((l) => l.startsWith('v ')).length, 8);
  assert.equal(obj.split('\n').filter((l) => l.startsWith('f ')).length, 12);
  const g = toGlbBytes(soup(cube(10))), dv = new DataView(g.buffer);
  assert.equal(dv.getUint32(0, true), 0x46546c67); assert.equal(dv.getUint32(8, true), g.length); assert.equal(g.length % 4, 0);
  const jl = dv.getUint32(12, true), json = JSON.parse(new TextDecoder().decode(g.subarray(20, 20 + jl)));
  assert.equal(json.accessors[0].count, 8); assert.equal(json.accessors[1].count, 36);
  assert.deepEqual(json.accessors[0].max, [10, 10, 10]);
});

test('kernel loading: URL order, one import, error names every URL, failure can be retried', async () => {
  assert.deepEqual(candidateUrls('smlib', { urls: { smlib: 'https://a/x.js' } }), ['https://a/x.js', 'https://unpkg.com/@classcad/smlibwasm@0.3.0/dist/index.js']);
  const seen = [];
  const bad = new Fab({ urls: { manifold: ['https://one/m.js', 'https://two/m.js'] }, importer: async (u) => { seen.push(u); throw new Error('boom'); } });
  await assert.rejects(bad.manifold(), (e) => e.message.includes('https://one/m.js') && e.message.includes('https://two/m.js') && e.message.includes('unpkg.com/manifold-3d@3.5.4'));
  const n = seen.length;
  await assert.rejects(bad.manifold());
  assert.equal(seen.length, 2 * n, 'a rejected load is not cached');
  let setup = 0;
  const ok = new Fab({ urls: { manifold: 'https://v/m.js' }, importer: async () => ({ default: async () => ({ setup() { setup++; } }) }) });
  const [a, b] = [ok.manifold(), ok.manifold()];
  assert.equal(a, b); await a; assert.equal(setup, 1);
});

test('save(): saver result wins; no saver or a null saver falls back to a download', async () => {
  const part = cube(10), got = [];
  const fab = new Fab({ context: () => ({ id: 'w1', params: { k: 1 } }), download: (bytes, info) => got.push(['dl', info.name, info.ext]) });
  fab.saver = async (bytes, info) => { got.push(['saver', info.id, info.params, info.fmt, bytes.length]); return { n: 3, file: 'a.stl', path: '/x/a.stl' }; };
  const r = await fab.save(part, 'stl', { name: 'a', note: 'hi' });
  assert.equal(r.n, 3); assert.equal(r.report.watertight, true);
  assert.deepEqual(got[0], ['saver', 'w1', { k: 1 }, 'stl', 84 + 600]);
  fab.saver = async () => null;
  const d = await fab.save(part, 'obj', { name: 'b' });
  assert.equal(d.downloaded, true); assert.deepEqual(got[1], ['dl', 'b', 'obj']);
  fab.saver = null;
  assert.equal((await fab.save(part, 'stl')).downloaded, true);
});
