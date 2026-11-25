// @openav/align: the manual calibration (four corners, mesh, feather, masks, gain) and its file
// (open-audiovisual/align-calibration@1, art-align-cal/v1 read unchanged), turned feeds, the WebGL renderers with a fake
// three.js, the pattern texture, the store with a storage in memory, the vendor chart and the identification screen.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as A from '../packages/align/index.js';
import { maskRect } from '../packages/align/chart.js';
import { meshAt, resampleMesh, applyH, handlesOf } from '../packages/align/warp.js';
import { SOURCE_LABELS } from '../packages/align/pattern-texture.js';
import { UI_WORDS } from '../packages/align/align-ui.js';
import { loadLayout, clone, fakeCtx, texts, fakeThree, fakeRenderer, memoryStorage } from './_align.js';

const close = (a, b, eps = 1e-6, msg = '') => assert.ok(Math.abs(a - b) <= eps, `${msg} ${a} ≠ ${b}`);
const IDS = ['one-projector', 'example-edge-blend', 'led-wall-two-outputs', 'stacked-double', 'room-corner'];
const ROOM = A.computeMapping(loadLayout('room-corner'));
const BLEND = A.computeMapping(loadLayout('example-edge-blend'));

test('align warp: an uncalibrated zone is the plain mapping: every vertex of its grid sits where the 1:1 or scaled copy puts it', () => {
  for (const id of IDS) {
    const M = A.computeMapping(loadLayout(id));
    for (const t of M.tiles.filter((x) => !x.rotate)) {
      const g = A.zoneGrid(A.defaultZone(t), 8);
      assert.equal(g.pos.length, 81 * 2); assert.equal(g.index.length, 64 * 6);
      for (let k = 0; k < g.uv.length / 2; k++) {
        close(g.pos[k * 2], t.dst.x + g.uv[k * 2] * t.dst.w, 1e-2, `${id} ${t.name} x`);
        close(g.pos[k * 2 + 1], t.dst.y + g.uv[k * 2 + 1] * t.dst.h, 1e-2, `${id} ${t.name} y`);
      }
    }
  }
});

test('align warp: a turned feed turns its default corners (180°: the segment\'s top-left on dst\'s bottom-right); every turn stays clockwise', () => {
  const t = ROOM.tiles.find((x) => x.name === 'FL');
  const z = A.defaultZone(t);
  assert.deepEqual(A.warpPoint(z, 0, 0), [t.dst.x + t.dst.w, t.dst.y + t.dst.h]);
  assert.deepEqual(A.warpPoint(z, 1, 1), [t.dst.x, t.dst.y]);
  const z90 = A.defaultZone({ ...t, rotate: 90 });
  assert.deepEqual(A.warpPoint(z90, 0, 0), [t.dst.x + t.dst.w, t.dst.y], '90°: top-left on top-right');
  for (const r of [0, 90, 180, 270]) assert.ok(A.quadOk(A.defaultZone({ ...t, rotate: r }).corners), `rotate ${r}`);
  const plain = { dst: { x: 10, y: 20, w: 300, h: 100 } }, z0 = A.defaultZone(plain), orig = JSON.stringify(z0.corners);
  A.rotateZone(z0); assert.deepEqual(z0.corners, A.defaultZone({ ...plain, rotate: 90 }).corners, 'rotateZone turns as a feed does');
  A.rotateZone(z0); A.rotateZone(z0); A.rotateZone(z0); assert.equal(JSON.stringify(z0.corners), orig, 'four turns: back home');
  A.rotateZone(z0, -1); A.rotateZone(z0, 1); assert.equal(JSON.stringify(z0.corners), orig);
});

test('align warp: the patterns turn with the feed too (withTile sends the segment\'s top-left where the zone does); the viewport blit refuses a turn', () => {
  const wl = ROOM.tiles.find((x) => x.name === 'WL');
  const t = { ...wl, rotate: 90, dst: { x: wl.dst.x, y: wl.dst.y, w: wl.src.h, h: wl.src.w } };   // a turned feed's dst is the other way round
  const ctx = fakeCtx();
  A.withTile(ctx, t, { k: 1, x: 0, y: 0 }, () => {});
  const tr = ctx.calls.filter((c) => ['translate', 'scale', 'transform'].includes(c[0]));
  let p = [t.src.x, t.src.y];
  for (const c of [...tr].reverse()) {
    if (c[0] === 'translate') p = [p[0] + c[1], p[1] + c[2]];
    else if (c[0] === 'scale') p = [p[0] * c[1], p[1] * c[2]];
    else if (c[0] === 'transform' && c.length === 7) p = [c[1] * p[0] + c[3] * p[1] + c[5], c[2] * p[0] + c[4] * p[1] + c[6]];
  }
  assert.deepEqual(p, A.warpPoint(A.defaultZone(t), 0, 0));
  assert.equal(A.blitPlan(ROOM).tiles.find((x) => x.name === 'FL').rotate, 180);
  assert.equal(A.blitPlan(ROOM).tiles.find((x) => x.name === 'WL').rotate, undefined, 'no rotate field when nothing turns');
  const { renderer } = fakeRenderer({ W: 3840, H: 2160, pr: 1 });
  assert.throws(() => A.createBlitter(fakeThree(), renderer)({}, ROOM), /turns a feed/);
});

test('align warp: createBlitter copies tile by tile, its viewports divided by the pixel ratio, and says once when the canvas is another size', () => {
  const M = A.computeMapping(loadLayout('led-wall-two-outputs'));
  for (const pr of [1, 2]) {
    const { renderer, log } = fakeRenderer({ W: 3840, H: 1080, pr });
    const warned = [];
    const r = A.createBlitter(fakeThree(), renderer, { onMismatch: (m) => warned.push(m) })('TEX', M);
    assert.deepEqual(r, { mismatch: false });
    assert.equal(warned.length, 0);
    const vps = log.filter((c) => c[0] === 'viewport').slice(1, -1).map((c) => c.slice(1));
    assert.deepEqual(vps, M.tiles.map((t) => [t.dst.x / pr, (1080 - t.dst.y - t.dst.h) / pr, t.dst.w / pr, t.dst.h / pr]));
    const renders = log.filter((c) => c[0] === 'render').map((c) => c[1]);
    assert.deepEqual(renders[3], [5760 / 7680, 0, 1920 / 7680, 1]);
  }
  const { renderer } = fakeRenderer({ W: 1000, H: 500, pr: 1 });
  const warned = [];
  const blit = A.createBlitter(fakeThree(), renderer, { onMismatch: (m) => warned.push(m) });
  blit('T', M); blit('T', M);
  assert.equal(warned.length, 1);
  assert.match(warned[0], /the canvas is 1000×500/);
});

test('align warp: four corners make a perspective that keeps lines straight; a folded or crossed quad is refused', () => {
  const q = [[100, 50], [900, 120], [860, 700], [140, 640]], H = A.squareToQuad(q);
  [[0, 0], [1, 0], [1, 1], [0, 1]].forEach(([u, v], i) => { const [x, y] = applyH(H, u, v); close(x, q[i][0]); close(y, q[i][1]); });
  const [ax, ay] = applyH(H, 0.2, 0), [bx, by] = applyH(H, 0.2, 0.5), [cx, cy] = applyH(H, 0.2, 1);
  close((bx - ax) * (cy - ay) - (by - ay) * (cx - ax), 0, 1e-6, 'collinear');
  assert.ok(A.quadOk(q));
  assert.ok(!A.quadOk([[0, 0], [10, 10], [10, 0], [0, 10]]), 'crossed');
  assert.ok(!A.quadOk([[0, 0], [0, 10], [10, 10], [10, 0]]), 'counter-clockwise');
  assert.equal(A.squareToQuad([[0, 0], [1, 1], [2, 2], [3, 3]]), null, 'all on one line');
  assert.deepEqual(A.warpPoint({ corners: [[0, 0], [1, 1], [2, 2], [3, 3]], mesh: { cols: 2, rows: 2, d: [[0, 0], [0, 0], [0, 0], [0, 0]] } }, 0.5, 0.5).map(Number.isNaN), [true, true]);
});

test('align warp: the mesh shifts bilinearly, keeps its field when its density changes; the feather is a cosine; handles are corners and points', () => {
  const z = A.defaultZone({ dst: { x: 0, y: 0, w: 1000, h: 500 } });
  z.mesh.d[4] = [10, -20];
  const [x, y] = A.warpPoint(z, 0.5, 0.5); close(x, 510); close(y, 230);
  const r = resampleMesh(z.mesh, 5, 5);
  for (const [u, v] of [[0.5, 0.5], [0.25, 0.25], [0.75, 0.5]]) { const a = meshAt(z.mesh, u, v), b = meshAt(r, u, v); close(a[0], b[0], 1e-9); close(a[1], b[1], 1e-9); }
  assert.deepEqual([resampleMesh(z.mesh, 1, 20).cols, resampleMesh(z.mesh, 1, 20).rows], [2, 9], 'clamped to 2–9');
  const f = { l: 0.2, r: 0, t: 0, b: 0 };
  close(A.featherAt(f, 0, 0.5), 0); close(A.featherAt(f, 0.1, 0.5), 0.5); close(A.featherAt(f, 0.5, 0.5), 1);
  close(A.featherAt({ l: 0, r: 0.1, t: 0.1, b: 0 }, 0.95, 0.05), 0.25);
  const h = handlesOf(z);
  assert.equal(h.filter((x) => x.kind === 'corner').length, 4);
  assert.equal(h.filter((x) => x.kind === 'mesh').length, 9);
  assert.deepEqual([h[4 + 4].x, h[4 + 4].y], [510, 230]);
});

test('align calibration: round trip through JSON, two variants kept apart, bad values clamped, the format written as @1', () => {
  let cal = null;
  const room = loadLayout('room-corner');
  const half = A.scaleArt(room, 0.5); half.id = 'room-corner-half';
  for (const L of [room, half]) cal = A.normalizeCalibration(cal, A.computeMapping(L), L.id);
  assert.equal(cal.format, A.CALIBRATION_FORMAT);
  assert.equal(A.CAL_CONTRACT, A.CALIBRATION_FORMAT);
  assert.deepEqual(Object.keys(cal.variants), ['room-corner', 'room-corner-half']);
  cal.variants['room-corner'].zones.WR.corners[0] = [2101.5, 77.25];
  const back = A.normalizeCalibration(JSON.parse(JSON.stringify(cal)), ROOM, 'room-corner');
  assert.deepEqual(back.variants, cal.variants);
  const bad = A.normalizeZone({ corners: 'x', feather: { l: 9 }, gain: -3, gamma: 99, mesh: { cols: 3, rows: 3, d: [1] }, masks: [{ u: 2 }] }, { dst: { x: 0, y: 0, w: 10, h: 10 } });
  assert.equal(bad.feather.l, 0.5); assert.equal(bad.gain, 0); assert.equal(bad.gamma, 4); assert.equal(bad.mesh.d.length, 9); assert.equal(bad.masks[0].u, 1);
  assert.deepEqual(A.normalizeZone(null, { dst: { x: 1, y: 2, w: 3, h: 4 } }), A.defaultZone({ dst: { x: 1, y: 2, w: 3, h: 4 } }));
});

test('align calibration: a file written as art-align-cal/v1 loads with its moved corner; anything else starts from the defaults', () => {
  const old = { contract: 'art-align-cal/v1', savedAt: '2026-01-02T03:04:05.000Z', variants: { 'room-corner': { zones: { WL: { corners: [[170, 95], [1760, 90], [1760, 990], [160, 990]], gain: 0.9 } } } } };
  const cal = A.normalizeCalibration(old, ROOM, 'room-corner');
  assert.deepEqual(cal.variants['room-corner'].zones.WL.corners[0], [170, 95]);
  assert.equal(cal.variants['room-corner'].zones.WL.gain, 0.9);
  assert.equal(cal.savedAt, old.savedAt);
  assert.equal(cal.format, A.CALIBRATION_FORMAT, 'written back under the new name');
  assert.deepEqual(cal.variants['room-corner'].zones.WR, A.defaultZone(ROOM.tiles[1]), 'a zone the file lacks: the default');
  for (const notOne of [null, { variants: { 'room-corner': old.variants['room-corner'] } }, { format: 'something/else', variants: old.variants }]) {
    assert.deepEqual(A.normalizeCalibration(notOne, ROOM).variants['room-corner'].zones.WL.corners, A.defaultZone(ROOM.tiles[0]).corners);
  }
});

test('align calibration: the layout\'s masks are the default; a saved calibration wins (a mask removed on site stays removed)', () => {
  const wr = ROOM.tiles.find((t) => t.name === 'WR');
  assert.deepEqual(A.defaultZone(wr).masks, [{ u: 1100 / 1600, v: 300 / 900, w: 300 / 1600, h: 600 / 900 }]);
  const saved = { format: A.CALIBRATION_FORMAT, variants: { 'room-corner': { zones: { WR: { masks: [] } } } } };
  assert.deepEqual(A.normalizeCalibration(saved, ROOM).variants['room-corner'].zones.WR.masks, []);
  // a mask in segment coordinates on a turned block: the segment's top-left corner, at 90° on the block's top-right
  const d = { x: 0, y: 0, w: 100, h: 200 }, m = { u: 0, v: 0, w: 0.1, h: 0.2 };
  assert.deepEqual(maskRect(m, d, 0), { x: 0, y: 0, w: 10, h: 40 });
  assert.deepEqual(maskRect(m, d, 90), { x: 80, y: 0, w: 20, h: 20 });
  assert.deepEqual(maskRect(m, d, 180), { x: 90, y: 160, w: 10, h: 40 });
  assert.deepEqual(maskRect(m, d, 270), { x: 0, y: 180, w: 20, h: 20 });
});

test('align warp-gl: createWarpRenderer builds one mesh per tile from the calibration and draws the region with additive light', () => {
  const THREE = fakeThree();
  const cal = A.normalizeCalibration(null, BLEND);
  const zones = cal.variants[BLEND.id].zones;
  zones.L.feather.r = 0.1; zones.R.feather.l = 0.1; zones.R.masks.push({ u: 0.5, v: 0.5, w: 0.1, h: 0.1 }); zones.R.gain = 0.8;
  zones.L.corners[1] = [1900, 20];
  const w = A.createWarpRenderer(THREE);
  w.build(BLEND, zones, 4);
  assert.deepEqual([...w.meshes.keys()], ['L', 'R']);
  const L = w.meshes.get('L'), R = w.meshes.get('R');
  const g = A.zoneGrid(zones.L, 4);
  const pos = L.geometry.attributes.position.array;
  for (let k = 0; k < g.pos.length / 2; k++) { assert.equal(pos[k * 3], g.pos[k * 2]); assert.equal(pos[k * 3 + 1], g.pos[k * 2 + 1]); assert.equal(pos[k * 3 + 2], 0); }
  assert.equal(L.material.blending, THREE.AdditiveBlending);
  const u = R.material.uniforms;
  assert.deepEqual({ ...u.uSrc.value }, { x: 1728 / 3648, y: 0, z: 1920 / 3648, w: 1 });
  assert.deepEqual([u.uFeather.value.x, u.uGain.value, u.uMaskN.value, u.uMasks.value.length], [0.1, 0.8, 1, 8]);
  assert.match(L.material.fragmentShader, /uniform vec4 uMasks\[8\]/);
  const { renderer, log } = fakeRenderer({ W: 3840, H: 1080, pr: 1 });
  w.draw(renderer, 'TEX', { x: 1920, y: 0, w: 1920, h: 1080 });
  assert.equal(L.material.uniforms.uTex.value, 'TEX');
  const cam = log.find((c) => c[0] === 'render')[2];
  assert.deepEqual([cam.left, cam.right, cam.top, cam.bottom], [1920, 3840, 0, 1080]);
  assert.equal(renderer.autoClear, true, 'autoClear is given back');
  w.build(BLEND, zones, 4);
  assert.ok(L.geometry.disposed && L.material.disposed, 'a rebuild disposes the old meshes');
  w.dispose();
  assert.equal(w.meshes.size, 0);
});

test('align pattern texture: every source paints the art canvas; the texture redraws only when the source changes (ident: 15 a second)', () => {
  for (const s of A.PATTERN_SOURCES.filter((x) => x !== 'live')) assert.doesNotThrow(() => A.drawSource(fakeCtx(), ROOM, s), s);
  assert.deepEqual(Object.keys(SOURCE_LABELS.en), A.PATTERN_SOURCES);
  assert.deepEqual(Object.keys(SOURCE_LABELS.zh), A.PATTERN_SOURCES);
  const white = fakeCtx(); A.drawSource(white, ROOM, 'white');
  assert.equal(white.calls.filter((c) => c[0] === 'fillRect').length, 1 + ROOM.segments.length);
  const made = [];
  const doc = { createElement: () => { const c = { width: 0, height: 0, ctx: fakeCtx(), getContext() { return this.ctx; } }; made.push(c); return c; } };
  const THREE = fakeThree();
  const pt = A.createPatternTexture(THREE, ROOM.art, doc);
  assert.deepEqual([made[0].width, made[0].height], [3200, 1700]);
  pt.texture.needsUpdate = false; pt.draw(ROOM, 'tiles'); assert.equal(pt.texture.needsUpdate, true);
  pt.texture.needsUpdate = false; pt.draw(ROOM, 'tiles'); assert.equal(pt.texture.needsUpdate, false, 'the same source: not drawn again');
  pt.draw(ROOM, 'ident', 0); pt.texture.needsUpdate = false;
  pt.draw(ROOM, 'ident', 0.03); assert.equal(pt.texture.needsUpdate, false, 'same 1/15 s');
  pt.draw(ROOM, 'ident', 0.1); assert.equal(pt.texture.needsUpdate, true, 'next 1/15 s');
  pt.dispose(); assert.equal(pt.texture.disposed, true);
});

test('align store: in the browser, a calibration and the state survive in localStorage, with the last 20 saves as backups', async () => {
  const storage = memoryStorage();
  const s = A.createCalStore({ storage });
  assert.equal(s.kind, 'browser');
  assert.deepEqual(await s.load(), { calibration: null, state: {}, paths: { calibration: 'localStorage' } });
  const cal = A.normalizeCalibration(null, ROOM);
  for (let i = 0; i < 22; i++) { cal.n = i; const r = await s.saveCalibration(cal); assert.equal(r.ok, true); }
  await s.saveState({ zone: 'WR', source: 'grid' });
  const back = await s.load();
  assert.equal(back.calibration.n, 21);
  assert.deepEqual(back.state, { zone: 'WR', source: 'grid' });
  const list = await s.listBackups();
  assert.equal(list.length, 20);
  assert.equal((await s.readBackup(list[0].name)).n, 21, 'newest first');
  assert.equal(await s.readBackup('nope'), null);
  assert.ok(storage.keys().every((k) => k.startsWith('oav-align/')), storage.keys().join());
  assert.deepEqual(await s.setAutostart(true), { ok: false, why: 'a browser page cannot start itself when the machine boots' });
});

test('align store: a calibration saved under art-align\'s default prefix still loads, read-only, until the first save under the new one', async () => {
  const oldCal = { contract: 'art-align-cal/v1', variants: {} };
  const storage = memoryStorage({ 'art-align/calibration': JSON.stringify(oldCal), 'art-align/state': '{"zone":"WL"}', 'art-align/backups': JSON.stringify([{ name: 'b1', savedAt: 'b1', cal: oldCal }]) });
  const s = A.createCalStore({ storage });
  assert.deepEqual((await s.load()).calibration, oldCal);
  assert.deepEqual((await s.load()).state, { zone: 'WL' });
  assert.deepEqual((await s.listBackups()).map((b) => b.name), ['b1']);
  await s.saveCalibration({ format: A.CALIBRATION_FORMAT, variants: { v: { zones: {} } } });
  assert.equal((await s.load()).calibration.format, A.CALIBRATION_FORMAT, 'the new key wins once written');
  assert.equal(JSON.parse(storage.getItem('art-align/calibration')).contract, 'art-align-cal/v1', 'the old key is never written');
  assert.equal((await s.listBackups()).length, 2, 'the old backups come along');
  const other = A.createCalStore({ storage, prefix: 'my-work' });
  assert.equal((await other.load()).calibration, null, 'a prefix of your own never reads the old keys');
  const bridge = { load: async () => 'L', saveCalibration: async (c) => ({ ok: true, file: 'f', c }) };
  const e = A.createCalStore({ bridge });
  assert.equal(e.kind, 'electron');
  assert.equal(await e.load(), 'L');
});

test('align chart: the room\'s 4K output, cut 2 × 2: three blocks, their pixels and corners, the cuts, the door, the turned floor', () => {
  const ctx = fakeCtx();
  assert.deepEqual(A.drawChart(ctx, ROOM, 'O'), { tiles: 3, cuts: 4 });
  const T = texts(ctx);
  for (const s of ['1', '2', '3', 'left wall', 'right wall', 'floor']) assert.ok(T.includes(s), s);
  assert.equal(T.filter((s) => s === '1600 × 900 px').length, 2);
  assert.ok(T.includes('top-left (160, 90)') && T.includes('bottom-right (1759, 989)'), 'the last pixel included');
  assert.ok(T.some((s) => s.startsWith('cut 4: (1920,1080)–(3839,2159)')));
  assert.ok(T.some((s) => s.startsWith('pixel to pixel, no scaling')));
  assert.ok(T.includes('door (black)'));
  assert.ok(T.some((s) => /bottom side, turned 180°/.test(s)), 'the floor\'s top edge is at the bottom');
  const zh = fakeCtx(); A.drawChart(zh, ROOM, 'O', { lang: 'zh' });
  assert.ok(texts(zh).includes('左上 (160, 90)') && texts(zh).includes('door（遮黑）'));
  assert.throws(() => A.drawChart(fakeCtx(), ROOM, 'Z'), /has no output Z/);
});

test('align chart: scaled blocks are said so (never "pixel to pixel"); a logo goes in a free corner, or nowhere', () => {
  const L = { format: A.ALIGN_FORMAT, id: 'scaled', art: { w: 1000, h: 500 }, segments: [{ id: 'S', x: 0, y: 0, w: 1000, h: 500 }], outputs: [{ id: 'O', x: 0, y: 0, w: 1920, h: 1080 }], feeds: [{ segment: 'S', output: 'O', x: 0, y: 0, w: 1920, h: 1080 }] };
  const T = texts((() => { const c = fakeCtx(); A.drawChart(c, A.computeMapping(L), 'O'); return c; })());
  assert.ok(T.some((s) => s.startsWith('⚠ this output has scaled blocks')) && !T.some((s) => s.startsWith('pixel to pixel')));
  assert.ok(T.some((s) => /^art scaled ×1\.9200$/.test(s)));
  const logo = { width: 400, height: 100 };
  const r = A.drawChart(fakeCtx(), ROOM, 'O', { logo });
  assert.ok(r.logo, 'the room\'s output has a free corner');
  for (const t of ROOM.tiles) assert.ok(r.logo.x >= t.dst.x + t.dst.w || r.logo.x + r.logo.w <= t.dst.x || r.logo.y >= t.dst.y + t.dst.h || r.logo.y + r.logo.h <= t.dst.y, `the logo covers ${t.name}`);
  assert.equal(A.drawChart(fakeCtx(), A.computeMapping(L), 'O', { logo }).logo, null, 'a block fills the output: no corner');
  assert.equal('logo' in A.drawChart(fakeCtx(), ROOM, 'O'), false);
});

test('align ident: every surface\'s name, its projector and part of the output, the words on its sides, a clock on each; zh too', () => {
  const ctx = fakeCtx();
  A.drawIdent(ctx, ROOM, 3.1, { now: new Date(2026, 10, 24, 12, 0, 0) });
  const t = texts(ctx);
  for (const s of ['L', 'R', 'F', 'right wall ▶', '◀ left wall', '▲ the walls']) assert.ok(t.includes(s), s);
  assert.ok(t.includes('projector 1 · output O top-left'), t.filter((x) => /projector/.test(x)).join(' | '));
  assert.ok(t.includes('projector 2 · output O top-right'));
  assert.ok(t.includes('projector 3 · output O bottom-left'));
  assert.equal(t.filter((x) => x === '12:00:00.0').length, 3);
  assert.ok(ctx.calls.some((c) => c[0] === 'gradient'), 'the band');
  const zh = fakeCtx(); A.drawIdentBase(zh, ROOM, { lang: 'zh' });
  assert.ok(texts(zh).includes('投影機 1 號・輸出 O 左上'));
  const plain = fakeCtx(); A.drawIdent(plain, A.computeMapping(loadLayout('led-wall-two-outputs')), 0);
  for (const s of ['Q1', 'Q2', 'Q3', 'Q4']) assert.ok(texts(plain).includes(s), `a layout without ident: ${s}`);
  const live = fakeCtx(); A.drawIdentLive(live, ROOM, 1.0, { per: 1 });
  assert.ok(live.calls.some((c) => c[0] === 'fillRect'), 'the band moves on its own');
});

test('align UI: the panel speaks English and Chinese with the same words; the sources have names in both', () => {
  const shape = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === 'object' && !Array.isArray(v) ? Object.keys(v) : typeof v]));
  assert.deepEqual(shape(UI_WORDS.zh), shape(UI_WORDS.en));
  for (const [k, v] of Object.entries(UI_WORDS.zh)) if (typeof v === 'string') assert.ok(!/[；]|——/.test(v), k);
});
