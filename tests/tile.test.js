// @openav/tile: one photo of screens lying on a table → where each one is → one canvas across all of them.
// The scenes are synthetic and exact: real screen sizes and pixel densities placed on a table in millimetres, a pinhole
// camera above it (tilted, so the photo has perspective), marker corners projected into the photo with Gaussian noise.
// Every scene is seeded, so a failure reproduces.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  homography, fitSimilarity, solveLayout, validateLayout, similarityMatrix, similarityOf, mul3, inv3, apply3, LAYOUT_VERSION,
} from '../packages/tile/solve.js';
import { ClockSync, clockSample, estimateOffset } from '../packages/tile/clock.js';
import { markerGrid, markerId, decodeMarkerId, correspondences, drawMarkers, PER_DEVICE, MAX_DEVICES } from '../packages/tile/marker.js';
import { markerCode, markerBits, DICT_SIZE } from '../packages/tile/dict.js';
import { tileView, soloView } from '../packages/tile/view.js';

// ---------------------------------------------------------------------------------------------- the synthetic world
function rng(seed) {                                        // mulberry32
  let a = seed >>> 0;
  const next = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  return { next, range: (lo, hi) => lo + (hi - lo) * next(), gauss: () => Math.sqrt(-2 * Math.log(1 - next())) * Math.cos(2 * Math.PI * next()) };
}
const deg = Math.PI / 180;
// screens: pixels and millimetres per pixel (ppi from the makers' sheets)
const LAPTOP = { w: 2560, h: 1600, pitch: 25.4 / 227 };    // 13" laptop, 227 ppi, laid flat
const TABLET = { w: 2048, h: 2732, pitch: 25.4 / 264 };    // 12.9" tablet, 264 ppi
const PHONE = { w: 1170, h: 2532, pitch: 25.4 / 460 };     // 6.1" phone, 460 ppi
/** a screen on the table: its pixels → table mm (a similarity) */
const place = (s, x, y, a) => similarityMatrix({ a: s.pitch * Math.cos(a), b: s.pitch * Math.sin(a), tx: x, ty: y });
/** a pinhole camera H mm above (cx, cy), tilted and turned: table mm → photo px */
function camera({ cx = 0, cy = 0, H = 600, f = 3000, W = 4032, Hpx = 3024, tiltX = 0, tiltY = 0, roll = 0 }) {
  const Rx = [1, 0, 0, 0, Math.cos(tiltX), -Math.sin(tiltX), 0, Math.sin(tiltX), Math.cos(tiltX)];
  const Ry = [Math.cos(tiltY), 0, Math.sin(tiltY), 0, 1, 0, -Math.sin(tiltY), 0, Math.cos(tiltY)];
  const Rz = [Math.cos(roll), -Math.sin(roll), 0, Math.sin(roll), Math.cos(roll), 0, 0, 0, 1];
  const K = [f, 0, W / 2, 0, f, Hpx / 2, 0, 0, 1];
  return mul3(K, mul3(mul3(Rz, mul3(Ry, Rx)), [1, 0, -cx, 0, 1, -cy, 0, 0, H]));
}
/** what a photo would show: each marker's corners in the screen's pixels and (noisy) in the photo */
function observe(screens, P, { noise = 0.5, seed = 1, cells = null } = {}) {
  const r = rng(seed);
  return screens.map((s) => {
    const g = markerGrid(s.w, s.h);
    const keep = cells?.[s.id];
    const markers = g.markers.filter((m) => !keep || keep.includes(m.cell)).map((m) => ({
      cell: m.cell,
      device: m.corners,
      photo: m.corners.map((u) => { const p = apply3(mul3(P, s.T), u); return [p[0] + noise * r.gauss(), p[1] + noise * r.gauss()]; }),
    }));
    return { id: s.id, w: s.w, h: s.h, markers };
  });
}
const byId = (layout, id) => layout.devices.find((d) => d.id === id);
const M = (d) => d.matrix3x3;
/** the solved transform from screen i's pixels to screen j's pixels, against the truth: angle (°), scale (%), offset (mm) */
function compare(layout, screens, i, j) {
  const si = screens.find((s) => s.id === i), sj = screens.find((s) => s.id === j);
  const got = mul3(inv3(M(byId(layout, j))), M(byId(layout, i)));
  const truth = mul3(inv3(sj.T), si.T);
  const g = similarityOf(got), t = similarityOf(truth);
  let dAngle = (Math.atan2(g.b, g.a) - Math.atan2(t.b, t.a)) / deg;
  dAngle = ((dAngle + 540) % 360) - 180;
  const dScale = (Math.hypot(g.a, g.b) / Math.hypot(t.a, t.b) - 1) * 100;
  // where screen i's corners and centre land on screen j, compared in millimetres
  let dPos = 0;
  for (const c of [[0, 0], [si.w, 0], [si.w, si.h], [0, si.h], [si.w / 2, si.h / 2]]) {
    const a = apply3(got, c), b = apply3(truth, c);
    dPos = Math.max(dPos, Math.hypot(a[0] - b[0], a[1] - b[1]) * sj.pitch);
  }
  return { dAngle: Math.abs(dAngle), dScale: Math.abs(dScale), dPos };
}

// ---------------------------------------------------------------------------------------------- homography + similarity
test('homography (normalized DLT): exact correspondences give back the homography; <4 points or collinear ones are refused, not thrown', () => {
  const H = camera({ cx: 40, cy: -30, tiltX: 18 * deg, tiltY: -9 * deg, roll: 30 * deg });
  const src = [], r = rng(7);
  for (let k = 0; k < 40; k++) src.push([r.range(-300, 300), r.range(-200, 200)]);
  const fit = homography(src, src.map((p) => apply3(H, p)));
  assert.ok(fit.ok);
  const Hn = H.map((v) => v / H[8]);
  for (let k = 0; k < 9; k++) assert.ok(Math.abs(fit.H[k] - Hn[k]) <= 1e-7 * (1 + Math.abs(Hn[k])), `H[${k}] ${fit.H[k]} vs ${Hn[k]}`);
  assert.deepEqual(homography(src.slice(0, 3), src.slice(0, 3)), { ok: false, reason: 'too-few-points' });
  const line = [[0, 0], [1, 1], [2, 2], [3, 3], [4, 4]];
  assert.equal(homography(line, line).ok, false, 'collinear points pin nothing down');
});

test('fitSimilarity: a known similarity from noisy points (0.5 px): angle < 0.2°, scale < 0.5 %, rms < 1 px', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const r = rng(seed);
    const truth = { a: 0, b: 0, tx: r.range(-2000, 2000), ty: r.range(-2000, 2000) };
    const ang = r.range(-Math.PI, Math.PI), sc = r.range(0.3, 3);
    truth.a = sc * Math.cos(ang); truth.b = sc * Math.sin(ang);
    const src = [], dst = [];
    for (let k = 0; k < 64; k++) {
      const u = [r.range(0, 1170), r.range(0, 2532)], p = apply3(similarityMatrix(truth), u);
      src.push(u); dst.push([p[0] + 0.5 * r.gauss(), p[1] + 0.5 * r.gauss()]);
    }
    const f = fitSimilarity(src, dst);
    const dA = Math.abs(((Math.atan2(f.b, f.a) - ang) / deg + 540) % 360 - 180);
    const dS = Math.abs(Math.hypot(f.a, f.b) / sc - 1) * 100;
    assert.ok(dA < 0.2 && dS < 0.5 && f.rms < 1, `seed ${seed}: angle ${dA.toFixed(4)}°, scale ${dS.toFixed(4)} %, rms ${f.rms.toFixed(3)} px`);
  }
  assert.equal(fitSimilarity([[1, 1]], [[2, 2]]), null, 'one point: no similarity');
});

// ---------------------------------------------------------------------------------------------- solveLayout
test('solveLayout: a phone next to a laptop under a tilted camera, 0.5 px noise, 20 scenes: angle < 0.2°, scale < 0.5 %, rms < 1 px', () => {
  const worst = { dAngle: 0, dScale: 0, rms: 0 };
  for (let seed = 1; seed <= 20; seed++) {
    const r = rng(1000 + seed);
    const screens = [
      { id: 'laptop', ...LAPTOP, T: place(LAPTOP, -150, -90, r.range(-10, 10) * deg) },
      { id: 'phone', ...PHONE, T: place(PHONE, r.range(160, 200), r.range(-120, 0), r.range(-180, 180) * deg) },
    ];
    const P = camera({ cx: 60, cy: 0, tiltX: r.range(-20, 20) * deg, tiltY: r.range(-20, 20) * deg, roll: r.range(-180, 180) * deg });
    const { ok, layout, report } = solveLayout({ devices: observe(screens, P, { seed }), photo: { w: 4032, h: 3024 } });
    assert.ok(ok, JSON.stringify(report));
    assert.equal(layout.reference, 'laptop', 'the reference is the screen that covers the most of the photo');
    const c = compare(layout, screens, 'phone', 'laptop');
    for (const d of layout.devices) worst.rms = Math.max(worst.rms, d.rms);
    worst.dAngle = Math.max(worst.dAngle, c.dAngle); worst.dScale = Math.max(worst.dScale, c.dScale);
    assert.ok(c.dAngle < 0.2 && c.dScale < 0.5, `seed ${seed}: ${JSON.stringify(c)}`);
    for (const d of layout.devices) assert.ok(d.rms < 1, `seed ${seed} ${d.id}: rms ${d.rms} px`);
  }
  console.log(`# worst of 20 scenes: angle ${worst.dAngle.toFixed(4)}°, scale ${worst.dScale.toFixed(4)} %, rms ${worst.rms.toFixed(3)} px`);
});

test('solveLayout: three screens (laptop, tablet, phone; each turned and scaled differently) under a perspective camera: the relative layout is the truth, and a moving dot stays continuous across the borders', () => {
  const screens = [
    { id: 'laptop', ...LAPTOP, T: place(LAPTOP, -170, -150, 4 * deg) },
    { id: 'tablet', ...TABLET, T: place(TABLET, 140, -170, -14 * deg) },
    { id: 'phone', ...PHONE, T: place(PHONE, -40, 60, 52 * deg) },
  ];
  const P = camera({ cx: 20, cy: -10, H: 650, tiltX: 22 * deg, tiltY: -12 * deg, roll: 75 * deg });
  const { ok, layout, report } = solveLayout({ devices: observe(screens, P, { seed: 3 }), photo: { w: 4032, h: 3024 } });
  assert.ok(ok, JSON.stringify(report));
  assert.equal(layout.reference, 'laptop');
  assert.deepEqual(validateLayout(layout), { ok: true, errors: [] });
  const rows = [];
  for (const [i, j] of [['tablet', 'laptop'], ['phone', 'laptop'], ['phone', 'tablet']]) {
    const c = compare(layout, screens, i, j);
    rows.push(`${i}→${j}: angle ${c.dAngle.toFixed(4)}°, scale ${c.dScale.toFixed(4)} %, corners ${c.dPos.toFixed(3)} mm`);
    assert.ok(c.dAngle < 0.2 && c.dScale < 0.5 && c.dPos < 1, rows[rows.length - 1]);
  }
  console.log('# ' + rows.join('\n# '));
  // the canvas starts at the screens: every corner of every screen is inside [0, w] × [0, h], one touches each edge
  const pts = layout.devices.flatMap((d) => [[0, 0], [d.w, 0], [d.w, d.h], [0, d.h]].map((c) => apply3(d.matrix3x3, c)));
  assert.ok(pts.every(([x, y]) => x > -1e-3 && y > -1e-3 && x < layout.canvas.w + 1e-3 && y < layout.canvas.h + 1e-3));
  // continuity: a dot crossing the table, drawn by each screen through its view, lands on the same millimetre, at the same size
  const views = Object.fromEntries(screens.map((s) => [s.id, tileView(layout, s.id)]));
  let worstPos = 0, worstSize = 0;
  for (let k = 0; k <= 200; k++) {
    const x = (k / 200) * layout.canvas.w, y = layout.canvas.h * (0.5 + 0.35 * Math.sin(k / 15)), r = 40;
    // every screen works out where the dot is in its own pixels (also the screens it is not on, behind a bezel):
    // taken back to the table with the TRUE placement, they must all name the same millimetre and the same size
    const seen = screens.map((s) => ({ mm: apply3(s.T, views[s.id].point(x, y)), size: r * views[s.id].scale * s.pitch }));
    for (let a = 1; a < seen.length; a++) {
      worstPos = Math.max(worstPos, Math.hypot(seen[a].mm[0] - seen[0].mm[0], seen[a].mm[1] - seen[0].mm[1]));
      worstSize = Math.max(worstSize, Math.abs(seen[a].size / seen[0].size - 1) * 100);
    }
  }
  assert.ok(worstPos < 1 && worstSize < 0.5, `dot: ${worstPos.toFixed(3)} mm apart, size ${worstSize.toFixed(3)} % apart`);
  console.log(`# a dot across the canvas: screens agree within ${worstPos.toFixed(3)} mm, size within ${worstSize.toFixed(4)} %`);
});

test('solveLayout: a screen with only 4 markers in view is still placed; with 3, 1 or 0 it is reported as unsolvable — never an exception', () => {
  const screens = [
    { id: 'laptop', ...LAPTOP, T: place(LAPTOP, -150, -100, 2 * deg) },
    { id: 'tablet', ...TABLET, T: place(TABLET, 150, -110, -20 * deg) },
  ];
  const P = camera({ cx: 40, tiltX: 15 * deg, tiltY: 10 * deg, roll: 10 * deg });
  // the tablet mostly under the laptop's lid, a phone and a hand: four markers in one corner region are left
  const four = solveLayout({ devices: observe(screens, P, { seed: 5, cells: { tablet: [0, 1, 4, 5] } }) });
  assert.ok(four.ok);
  assert.equal(four.report.find((r) => r.id === 'tablet').status, 'ok');
  const c = compare(four.layout, screens, 'tablet', 'laptop');
  assert.ok(c.dAngle < 0.2 && c.dScale < 0.5, `4 markers: ${JSON.stringify(c)}`);

  for (const cells of [[0, 1, 4], [7], []]) {
    let res;
    assert.doesNotThrow(() => { res = solveLayout({ devices: observe(screens, P, { seed: 5, cells: { tablet: cells } }) }); });
    assert.ok(res.ok, 'the laptop is still placed');
    assert.deepEqual(res.layout.devices.map((d) => d.id), ['laptop']);
    assert.deepEqual(res.report.find((r) => r.id === 'tablet'), { id: 'tablet', status: 'too-few-markers', markers: cells.length, rejected: 0 });
  }
  // nobody shows enough: ok false, a reason, no layout
  let none;
  assert.doesNotThrow(() => { none = solveLayout({ devices: observe(screens, P, { cells: { laptop: [0, 1, 2], tablet: [] } }) }); });
  assert.deepEqual([none.ok, none.layout, none.reason], [false, null, 'no screen shows 4 markers']);
  assert.deepEqual(solveLayout({ devices: [] }), { ok: false, layout: null, report: [], reason: 'no markers found' });
  assert.equal(solveLayout().ok, false);
  assert.equal(solveLayout({ devices: [{ id: 'x', w: 0, h: 10, markers: [] }] }).report[0].status, 'bad-device');
});

test('solveLayout: a misread marker (its id names the wrong cell) is dropped and the layout stays right', () => {
  const screens = [
    { id: 'laptop', ...LAPTOP, T: place(LAPTOP, -150, -100, 0) },
    { id: 'phone', ...PHONE, T: place(PHONE, 170, -60, 25 * deg) },
  ];
  const P = camera({ tiltX: 12 * deg, roll: 5 * deg });
  const obs = observe(screens, P, { seed: 9 });
  const phone = obs.find((d) => d.id === 'phone');
  phone.markers[3] = { ...phone.markers[3], device: phone.markers[17].device };     // the photo of cell 3, read as cell 17
  const { ok, layout, report } = solveLayout({ devices: obs });
  assert.ok(ok);
  assert.equal(report.find((r) => r.id === 'phone').rejected, 1);
  const c = compare(layout, screens, 'phone', 'laptop');
  assert.ok(c.dAngle < 0.2 && c.dScale < 0.5 && c.dPos < 1, JSON.stringify(c));
});

test('solveLayout: `reference` picks the base screen; the refinement is what keeps a far screen right', () => {
  const screens = [
    { id: 'phone', ...PHONE, T: place(PHONE, -260, -40, 10 * deg) },
    { id: 'laptop', ...LAPTOP, T: place(LAPTOP, 0, -100, -6 * deg) },
    { id: 'far', ...PHONE, T: place(PHONE, 380, 60, -70 * deg) },
  ];
  const P = camera({ cx: 60, H: 700, tiltX: 25 * deg, tiltY: 15 * deg, roll: 40 * deg });
  const devices = observe(screens, P, { seed: 11, noise: 0.8 });
  const fixed = solveLayout({ devices, reference: 'phone' });
  assert.equal(fixed.layout.reference, 'phone');
  const refined = compare(fixed.layout, screens, 'far', 'laptop');
  const plain = compare(solveLayout({ devices, reference: 'phone', refine: false }).layout, screens, 'far', 'laptop');
  assert.ok(refined.dPos < 1 && refined.dAngle < 0.2, `refined: ${JSON.stringify(refined)}`);
  assert.ok(refined.dPos < plain.dPos, `the joint fit beats extrapolating the phone's homography (${refined.dPos.toFixed(3)} vs ${plain.dPos.toFixed(3)} mm)`);
});

// ---------------------------------------------------------------------------------------------- layout.json
test('layout.json: the shape is checked field by field, survives JSON, and keeps room for the 3D window model', () => {
  const screens = [{ id: 'a', ...LAPTOP, T: place(LAPTOP, 0, 0, 0) }, { id: 'b', ...PHONE, T: place(PHONE, 320, 10, 90 * deg) }];
  const { layout } = solveLayout({ devices: observe(screens, camera({ cx: 150, cy: 80 }), { seed: 2 }), photo: { w: 4032, h: 3024 } });
  const copy = JSON.parse(JSON.stringify(layout));
  assert.deepEqual(validateLayout(copy), { ok: true, errors: [] });
  assert.equal(copy.version, LAYOUT_VERSION);
  assert.deepEqual(Object.keys(copy.devices[0]).sort(), ['h', 'id', 'kind', 'markers', 'matrix3x3', 'pose', 'rms', 'similarity', 'w']);
  assert.equal(copy.devices[0].pose, null, 'pose: reserved for the 3D model');
  assert.deepEqual(copy.photo, { w: 4032, h: 3024 });
  const bad = (fn) => { const L = JSON.parse(JSON.stringify(layout)); fn(L); return validateLayout(L).errors; };
  assert.deepEqual(bad((L) => { L.version = 2; }), ['version must be 1 (got 2)']);
  assert.deepEqual(bad((L) => { L.reference = 'zz'; }), ['reference "zz" is not one of the devices']);
  assert.deepEqual(bad((L) => { L.devices[1].id = 'a'; }), ['devices[1].id "a" appears twice']);
  assert.deepEqual(bad((L) => { L.devices[0].matrix3x3[2] += 5; }), ['devices[0].matrix3x3 does not match its similarity']);
  assert.deepEqual(bad((L) => { L.devices[0].w = 12.5; }), ['devices[0]: w and h must be positive whole pixels']);
  assert.deepEqual(bad((L) => { L.devices[0].similarity = { a: 0, b: 0, tx: 0, ty: 0 }; L.devices[0].matrix3x3 = [0, 0, 0, 0, 0, 0, 0, 0, 1]; }), ['devices[0].similarity has no scale']);
  assert.deepEqual(bad((L) => { L.devices[0].kind = 'curved'; }), ['devices[0].kind must be "planar" or "window"']);
  assert.deepEqual(bad((L) => { L.devices[1].kind = 'window'; }), ['devices[1]: kind "window" needs a pose']);
  assert.deepEqual(bad((L) => { L.canvas = { w: 0, h: 1 }; }), ['canvas must be { w > 0, h > 0 }']);
  assert.deepEqual(bad((L) => { L.devices = []; }), ['devices must be a non-empty array']);
  assert.deepEqual(validateLayout(null), { ok: false, errors: ['layout is not an object'] });
  // a later version's window, posed in space: valid as data; this version's view says it cannot draw it, without throwing
  const win = JSON.parse(JSON.stringify(layout));
  win.devices[1] = { id: 'b', w: PHONE.w, h: PHONE.h, kind: 'window', pose: { R: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: [0, 0, 0], pitchMm: PHONE.pitch }, rms: 0.4 };
  assert.deepEqual(validateLayout(win), { ok: true, errors: [] });
  assert.equal(tileView(win, 'b').ok, false);
  assert.match(tileView(win, 'b').reason, /3D window model/);
});

// ---------------------------------------------------------------------------------------------- markers
test('markers: 50 ids a screen, decoded back; the grid fills common screens, stays inside them, never overlaps', () => {
  assert.equal(MAX_DEVICES, 20);
  for (const [d, c] of [[0, 0], [3, 17], [19, 49]]) assert.deepEqual(decodeMarkerId(markerId(d, c)), { device: d, cell: c });
  assert.throws(() => markerId(20, 0), RangeError); assert.throws(() => markerId(0, 50), RangeError);
  assert.equal(decodeMarkerId(1000), null); assert.equal(decodeMarkerId(-1), null); assert.equal(decodeMarkerId(1.5), null);
  for (const [w, h] of [[1170, 2532], [2532, 1170], [2048, 2732], [2560, 1600], [1920, 1080], [750, 1334], [3840, 400], [390, 844]]) {
    const g = markerGrid(w, h);
    assert.ok(g.markers.length >= 4 && g.markers.length <= PER_DEVICE, `${w}×${h}: ${g.markers.length} markers`);
    assert.ok(g.module >= 1);
    for (const m of g.markers) for (const [x, y] of m.corners) assert.ok(x >= 0 && y >= 0 && x <= w && y <= h, `${w}×${h}: corner inside`);
    // neighbours keep at least one module of white between them (the detector needs the quiet zone)
    const s = g.size + g.module;
    for (const a of g.markers) for (const b of g.markers) if (a !== b) {
      const dx = Math.abs(a.corners[0][0] - b.corners[0][0]), dy = Math.abs(a.corners[0][1] - b.corners[0][1]);
      assert.ok(dx >= s || dy >= s, `${w}×${h}: markers ${a.cell} and ${b.cell} too close`);
    }
  }
  assert.equal(markerGrid(1170, 2532).nx, 4, 'four across a phone held upright');
  assert.deepEqual(markerGrid(0, 100).markers, []);
});

test('markers: the embedded DICT_5X5_1000 is 1000 distinct codes, any two at least 5 bits apart under rotation', () => {
  const n = 5, codes = Array.from({ length: DICT_SIZE }, (_, id) => markerCode(id));
  const rot = (c) => { let r = 0; for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const bit = (c >> (24 - ((n - 1 - x) * n + y))) & 1; r = r * 2 + bit; } return r; };
  const pop = (v) => { let k = 0; while (v) { v &= v - 1; k++; } return k; };
  let min = 25;
  const all = codes.map((c) => { const r1 = rot(c), r2 = rot(r1), r3 = rot(r2); return [c, r1, r2, r3]; });
  for (let i = 0; i < DICT_SIZE; i++) {
    for (const r of all[i].slice(1)) min = Math.min(min, pop(codes[i] ^ r));
    for (let j = i + 1; j < DICT_SIZE; j++) for (const r of all[j]) min = Math.min(min, pop(codes[i] ^ r));
  }
  assert.equal(min, 5);
  assert.deepEqual(markerBits(0)[0], [1, 0, 1, 0, 0]);
  assert.throws(() => markerCode(1000), RangeError);
});

test('markers: drawMarkers paints white page, black borders, and each marker\'s own bits', () => {
  const W = 390, H = 844, px = new Uint8Array(W * H).fill(128);
  const ctx = { fillStyle: '#000', save() {}, restore() {}, setTransform() {}, fillText() {},
    fillRect(x, y, w, h) { const v = this.fillStyle === '#fff' ? 255 : 0; for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) px[j * W + i] = v; } };
  const g = drawMarkers(ctx, { w: W, h: H, index: 2 });
  for (const m of g.markers) {
    const [x0, y0] = m.corners[0], mod = g.module, bits = markerBits(markerId(2, m.cell));
    for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) {
      const border = x === 0 || y === 0 || x === 6 || y === 6;
      const want = border ? 0 : bits[y - 1][x - 1] * 255;
      assert.equal(px[(y0 + y * mod + (mod >> 1)) * W + x0 + x * mod + (mod >> 1)], want, `cell ${m.cell} module ${x},${y}`);
    }
    assert.equal(px[(y0 - 1) * W + x0 - 1], 255, 'quiet zone is white');
  }
});

test('correspondences: found markers go to their screens\' own corners; strangers and doubles are set aside', () => {
  const roster = [{ id: 'p', index: 0, w: 1170, h: 2532 }, { id: 'q', index: 3, w: 2560, h: 1600 }];
  const gp = markerGrid(1170, 2532), gq = markerGrid(2560, 1600);
  const at = (k) => [[k, k], [k + 1, k], [k + 1, k + 1], [k, k + 1]];
  const found = [
    { id: markerId(0, 5), corners: at(1) }, { id: markerId(3, 2), corners: at(2) }, { id: markerId(3, 9), corners: at(3) },
    { id: markerId(1, 0), corners: at(4) },                                        // screen 1 is not in the room
    { id: markerId(3, 49), corners: at(5) },                                       // a laptop has no cell 49
    { id: markerId(0, 6), corners: at(6) }, { id: markerId(0, 6), corners: at(7) }, // cell 6 twice: neither is trusted
  ];
  const { devices, unknown, duplicate } = correspondences(found, roster);
  assert.deepEqual(devices.map((d) => [d.id, d.markers.map((m) => m.cell)]), [['p', [5]], ['q', [2, 9]]]);
  assert.deepEqual(devices[0].markers[0].device, gp.markers[5].corners);
  assert.deepEqual(devices[1].markers[1].device, gq.markers[9].corners);
  assert.deepEqual(devices[1].markers[1].photo, at(3));
  assert.deepEqual(unknown, [markerId(1, 0), markerId(3, 49)]);
  assert.deepEqual(duplicate, [markerId(0, 6)]);
});

// ---------------------------------------------------------------------------------------------- view
test('view: a screen\'s corners come back to its own pixels; the 2D, p5 and CSS forms are the same matrix', () => {
  const layout = {
    version: 1, reference: 'a', canvas: { w: 3000, h: 2000 },
    devices: [
      { id: 'a', w: 2560, h: 1600, kind: 'planar', similarity: { a: 1, b: 0, tx: 0, ty: 100 }, matrix3x3: similarityMatrix({ a: 1, b: 0, tx: 0, ty: 100 }), rms: 0.3, pose: null },
      { id: 'b', w: 1170, h: 2532, kind: 'planar', similarity: { a: 0, b: 0.5, tx: 2900, ty: 0 }, matrix3x3: similarityMatrix({ a: 0, b: 0.5, tx: 2900, ty: 0 }), rms: 0.4, pose: null },
    ],
  };
  const v = tileView(layout, 'b');
  assert.ok(v.ok);
  assert.equal(v.scale, 2, 'two device pixels per canvas unit');
  assert.ok(Math.abs(v.angle - Math.PI / 2) < 1e-12);
  for (const c of [[0, 0], [1170, 0], [1170, 2532], [0, 2532]]) {
    const back = v.point(...v.fromDevice(...c));
    assert.ok(Math.hypot(back[0] - c[0], back[1] - c[1]) < 1e-9);
  }
  assert.deepEqual(v.bounds, { x0: 2900 - 1266, y0: 0, x1: 2900, y1: 585 });
  assert.equal(v.visible(2000, 300), true); assert.equal(v.visible(100, 100), false); assert.equal(v.visible(1600, 300, 40), true);
  const calls = [];
  v.apply2d({ setTransform: (...a) => calls.push(['2d', ...a]) }, 2 / 3);   // a 3× phone drawing on a 2× canvas
  v.applyP5({ width: 390, applyMatrix: (...a) => calls.push(['p5', ...a]) });  // p5 in CSS px: 1170 / 390 = 3
  const m = v.toDevice, k = 2 / 3;
  const want = [m[0] * k, m[3] * k, m[1] * k, m[4] * k, m[2] * k, m[5] * k];
  for (const c of calls) c.slice(1).forEach((x, i) => assert.ok(Math.abs(x * (c[0] === 'p5' ? 2 : 1) - want[i]) < 1e-9, `${c[0]}[${i}]`));
  assert.match(v.css(3), /^matrix\(/);
  assert.deepEqual(tileView(layout, 'zz'), { ok: false, reason: 'not-in-layout' });
  const solo = soloView(800, 600);
  assert.deepEqual([solo.scale, solo.canvas, solo.point(10, 20)], [1, { w: 800, h: 600 }, [10, 20]]);
});

// ---------------------------------------------------------------------------------------------- clock
test('clock: the offset of the shortest round trip, within half of it of the truth; bad samples are ignored', () => {
  const r = rng(42), TRUE = 123456.789;              // the relay's clock is ahead of this device by TRUE ms
  let local = 1000;
  const clock = new ClockSync({ now: () => local });
  assert.equal(clock.ready, false); assert.equal(clock.offset, 0); assert.equal(clock.now(), 1000);
  const trips = [];
  for (let k = 0; k < 12; k++) {
    const up = 8 + 60 * r.next() ** 3, down = 8 + 60 * r.next() ** 3;      // wifi: mostly quick, sometimes slow, never symmetric
    const t0 = local, server = t0 + up + TRUE, t1 = t0 + up + down;
    clock.add(t0, server, t1); trips.push(up + down);
    local = t1 + 200;
  }
  const best = Math.min(...trips);
  assert.ok(Math.abs(clock.rtt - best) < 1e-9, 'the trusted sample is the quickest round trip');
  assert.ok(Math.abs(clock.offset - TRUE) <= best / 2, `offset ${clock.offset - TRUE} ms off, bound ${best / 2}`);
  assert.ok(Math.abs(clock.now() - (local + TRUE)) <= best / 2);
  assert.equal(clock.add(10, 5, 9), null, 'a pong before its ping');
  assert.equal(clock.add(NaN, 1, 2), null);
  // symmetric trips: exact
  assert.equal(clockSample(100, 1050, 120).offset, 940);
  assert.deepEqual(estimateOffset([]), null);
  assert.deepEqual(estimateOffset([{ rtt: 30, offset: 5 }, { rtt: 12, offset: 7 }, { rtt: -1, offset: 99 }, null]), { offset: 7, rtt: 12, n: 2 });
});

test('clock: old samples age out, so a drifting clock is followed', () => {
  let local = 0;
  const c = new ClockSync({ now: () => local, window: 10000 });
  c.add(0, 500 + 5, 10);                          // quick trip, offset 500
  for (let t = 1000; t <= 20000; t += 1000) c.add(t, t + 15 + 520, t + 30);   // slower trips; the clock has drifted to 520
  assert.equal(c.offset, 520, 'the quick-but-old sample left the window');
  assert.ok(c.samples.length <= 11);
});
