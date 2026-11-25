// @openav/align ↔ @openav/output: an align zone and an output room are one homography when a tile fills its output.
// The test that decides it: for every turn and flip, the room's CSS homography (pinnedBox) puts every picture point
// exactly where the zone's warp puts it, minus the output's place on the desktop. Then the outputs an align layout
// gives @openav/output, the two files converted both ways, what a room cannot carry, and createOutputs({ align }).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as A from '../packages/align/index.js';
import { pinnedBox, projectPoint } from '../packages/output/pin.js';
import { parseOutputLayout, OUTPUT_FORMAT } from '../packages/output/layout.js';
import { createOutputs } from '../packages/output/index.js';
import { Params } from '../packages/core/index.js';
import { Timeline } from '../packages/timeline/index.js';
import { withGlobals } from './_fakepage.js';
import { loadLayout, clone, memoryStorage } from './_align.js';

const close = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg}: ${a} ≠ ${b}`);
/** One segment on the right of two 1920 × 1080 outputs, fed at a turn. */
function turned(rotate) {
  const side = rotate === 90 || rotate === 270;
  const s = side ? { w: 1080, h: 1920 } : { w: 1920, h: 1080 };
  return A.computeMapping({
    format: A.ALIGN_FORMAT, id: `t${rotate}`, art: { w: s.w * 2, h: s.h },
    segments: [{ id: 'A', x: 0, y: 0, ...s }, { id: 'B', x: s.w, y: 0, ...s }],
    outputs: [{ id: 'left', x: 0, y: 0, w: 1920, h: 1080 }, { id: 'right', x: 1920, y: 0, w: 1920, h: 1080 }],
    feeds: [{ segment: 'A', output: 'left', x: 0, y: 0, rotate }, { segment: 'B', output: 'right', x: 0, y: 0, rotate }],
  });
}
/** The zone of tile B with its corners pushed about, still a good quad */
function moved(M) {
  const t = M.tiles[1], z = A.defaultZone(t);
  const push = [[37, 21], [-55, 14], [-12, -40], [44, -9]];
  z.corners = z.corners.map(([x, y], i) => [x + push[i][0], y + push[i][1]]);
  assert.ok(A.quadOk(z.corners));
  return { t, o: M.outputs[1], z };
}
const SAMPLES = [[0, 0], [1, 0], [1, 1], [0, 1], [0.5, 0.5], [0.13, 0.71], [0.9, 0.2]];

test('align ↔ output: for each turn, the room\'s CSS homography lands every picture point where the zone\'s warp does', () => {
  for (const rotate of [0, 90, 180, 270]) {
    const M = turned(rotate), { t, o, z } = moved(M);
    const { room, dropped } = A.zoneToRoom(z, t, o);
    assert.equal(room.rotate, rotate);
    assert.deepEqual(dropped, []);
    assert.deepEqual(parseOutputLayout({ format: OUTPUT_FORMAT, outputs: { right: room } }).outputs.right, room, 'a room the output package accepts as it is');
    const box = pinnedBox(room, o.w, o.h);
    for (const [u, v] of SAMPLES) {
      const [px, py] = projectPoint(box.matrix, u * box.width, v * box.height);
      const [wx, wy] = A.warpPoint(z, u, v);
      close(px, wx - o.x, 1e-6, `rotate ${rotate} (${u},${v}) x`); close(py, wy - o.y, 1e-6, `rotate ${rotate} (${u},${v}) y`);
    }
  }
});

test('align ↔ output: a room back to a zone gives the same corners; flips come across as the corner order, and say mirrored', () => {
  for (const rotate of [0, 90, 180, 270]) {
    const M = turned(rotate), { t, o, z } = moved(M);
    const back = A.roomToZone(A.zoneToRoom(z, t, o).room, t, o);
    back.zone.corners.forEach((p, i) => { close(p[0], z.corners[i][0], 1e-6, `rotate ${rotate} corner ${i}`); close(p[1], z.corners[i][1], 1e-6, `rotate ${rotate} corner ${i}`); });
    assert.equal(back.mirrored, false);
  }
  const M = turned(0), t = M.tiles[1], o = M.outputs[1];
  for (const [flipX, flipY, mirrored] of [[true, false, true], [false, true, true], [true, true, false]]) {
    const room = { corners: [[0.02, 0.01], [0.97, 0.03], [0.99, 0.98], [0.01, 0.96]], flipX, flipY, rotate: 90, overscan: 0.1, soft: 0.2 };
    const { zone, dropped, mirrored: m } = A.roomToZone(room, t, o);
    assert.equal(m, mirrored, `flipX ${flipX} flipY ${flipY}`);
    assert.deepEqual(dropped, ['overscan', 'soft']);
    const box = pinnedBox(room, o.w, o.h);
    for (const [u, v] of SAMPLES) {
      const [px, py] = projectPoint(box.matrix, u * box.width, v * box.height), [wx, wy] = A.warpPoint(zone, u, v);
      close(px, wx - o.x, 1e-6, `flips ${flipX},${flipY} x`); close(py, wy - o.y, 1e-6, `flips ${flipX},${flipY} y`);
    }
  }
});

test('align ↔ output: what a room cannot carry is listed, never dropped quietly; a base zone keeps it on the way back', () => {
  const M = turned(0), { t, o, z } = moved(M);
  z.mesh.d[4] = [3, -2]; z.feather.l = 0.1; z.masks.push({ u: 0.1, v: 0.1, w: 0.2, h: 0.2 }); z.gain = 0.8;
  assert.deepEqual(A.zoneToRoom(z, t, o).dropped, ['mesh', 'feather', 'masks', 'gain']);
  const back = A.roomToZone(A.zoneToRoom(z, t, o).room, t, o, z).zone;
  assert.deepEqual([back.mesh, back.feather, back.masks, back.gain], [z.mesh, z.feather, z.masks, z.gain]);
  assert.deepEqual(A.roomToZone(A.zoneToRoom(z, t, o).room, t, o).zone.mesh, A.defaultZone(t).mesh, 'no base: the defaults');
  const R = A.computeMapping(loadLayout('room-corner'));
  assert.throws(() => A.zoneToRoom(A.defaultZone(R.tiles[0]), R.tiles[0], R.outputs[0]), /does not fill output O/);
  assert.throws(() => A.zoneToRoom(z, t, M.outputs[0]), /goes to output right, not left/);
});

test('align → output: the outputs each example layout gives @openav/output, and why the others cannot be one window', () => {
  const of = (id) => A.outputsFromAlign(loadLayout(id));
  assert.deepEqual(of('one-projector').outputs, [{ name: 'main', crop: { x: 0, y: 0, w: 1, h: 1 }, fit: 'stretch' }]);
  const blend = of('example-edge-blend');
  assert.deepEqual(blend.outputs.map((o) => o.name), ['left', 'right']);
  assert.deepEqual(blend.outputs[1].crop, { x: 1728 / 3648, y: 0, w: 1920 / 3648, h: 1 });
  assert.equal(blend.aspect, 3648 / 1080);
  assert.deepEqual(of('stacked-double').outputs.map((o) => [o.name, o.crop.w]), [['upper', 1], ['lower', 1]], 'a stack: two windows of one picture');
  assert.deepEqual(of('led-wall-two-outputs').skipped.map((s) => s.output), ['A', 'B']);
  assert.match(of('led-wall-two-outputs').skipped[0].why, /2 tiles go to it/);
  assert.match(of('room-corner').skipped[0].why, /3 tiles go to it/);
  const dotted = clone(loadLayout('one-projector')); dotted.outputs[0].id = 'main.1'; dotted.feeds[0].output = 'main.1';
  assert.match(A.outputsFromAlign(dotted).skipped[0].why, /an output name is/);
  assert.equal(A.outputsFromAlign(A.computeMapping(loadLayout('one-projector'))).id, 'one-projector', 'a mapping works too');
});

test('align → output: a calibration (either format name) becomes an output layout file and comes back; the rest of the calibration stays', () => {
  const layout = loadLayout('example-edge-blend'), M = A.computeMapping(layout), bridge = A.outputsFromAlign(layout);
  const cal = A.normalizeCalibration(null, M);
  const R = cal.variants['example-edge-blend'].zones.R;
  R.corners[0] = [2016, 54]; R.corners[2] = [3800, 1050]; R.feather.l = 0.1;
  cal.savedAt = '2026-12-01T09:00:00.000Z';
  const doc = bridge.toOutputLayout(cal);
  assert.equal(doc.format, OUTPUT_FORMAT);
  assert.equal(doc.saved, cal.savedAt);
  assert.deepEqual(parseOutputLayout(doc).outputs, doc.outputs, 'what parseOutputLayout accepts as it is');
  assert.deepEqual(doc.outputs.right.corners[0], [0.05, 0.05]);
  assert.deepEqual(bridge.lost(cal), { right: ['feather'] });
  const back = bridge.fromOutputLayout(JSON.stringify(doc), cal);
  assert.deepEqual(back.variants['example-edge-blend'].zones.R.corners, R.corners);
  assert.equal(back.variants['example-edge-blend'].zones.R.feather.l, 0.1, 'the base calibration keeps its feather');
  assert.equal(back.format, A.CALIBRATION_FORMAT);
  const old = { contract: 'art-align-cal/v1', variants: { 'example-edge-blend': { zones: { L: { corners: [[10, 0], [1920, 0], [1920, 1080], [0, 1080]] } } } } };
  const c0 = bridge.toOutputLayout(old).outputs.left.corners[0];
  close(c0[0], 10 / 1920, 1e-12, 'an art-align-cal/v1 file converts'); assert.equal(c0[1], 0);
  assert.throws(() => bridge.toOutputLayout({ format: OUTPUT_FORMAT, outputs: {} }), /not a calibration/);
});

function fakeShow() {
  const params = new Params([]);
  return { params, timeline: new Timeline({ params, total: 10 }), stage: { container: { clientWidth: 800, clientHeight: 450 }, layer: { style: {} } } };
}

test('output: parseOutputLayout refuses an align calibration and says how to bring it in', () => {
  assert.throws(() => parseOutputLayout({ format: A.CALIBRATION_FORMAT, variants: {} }), /align calibration.*outputsFromAlign/s);
  assert.throws(() => parseOutputLayout(JSON.stringify({ contract: 'art-align-cal/v1', variants: {} })), /align calibration/);
});

test('output: createOutputs({ align }) declares the align layout\'s outputs and imports an align calibration; without align nothing changes', async () => {
  await withGlobals({ ResizeObserver: class { observe() {} disconnect() {} } }, async () => {
    const layout = loadLayout('example-edge-blend'), M = A.computeMapping(layout);
    const storage = memoryStorage();
    const rig = createOutputs(fakeShow(), { align: A.outputsFromAlign(layout), panel: false, storage });
    assert.deepEqual(rig.names, ['left', 'right']);
    assert.equal(rig.aspect, 3648 / 1080);
    const cal = A.normalizeCalibration(null, M);
    cal.variants['example-edge-blend'].zones.R.corners[0] = [2016, 54];
    assert.deepEqual(rig.importLayout(cal), ['left', 'right']);
    assert.deepEqual(JSON.parse(storage.getItem('oav-output:right')).corners[0], [0.05, 0.05]);
    assert.deepEqual(rig.importLayout({ format: OUTPUT_FORMAT, outputs: { left: { soft: 0.1 } } }), ['left'], 'an output layout file still works');
    assert.equal(rig.exportLayout().outputs.right.corners[0][0], 0.05);
    const explicit = createOutputs(fakeShow(), { align: A.outputsFromAlign(layout), outputs: [{ name: 'solo' }], aspect: 2, panel: false, storage });
    assert.deepEqual([explicit.names, explicit.aspect], [['solo'], 2], 'what the code says wins');
    const plain = createOutputs(fakeShow(), { panel: false, storage });
    assert.deepEqual([plain.names, plain.aspect], [['main'], null], 'the defaults are what they were');
    assert.throws(() => plain.importLayout(cal), /align calibration/);
    assert.throws(() => createOutputs(fakeShow(), { align: { outputs: 'x' }, panel: false }), /outputsFromAlign/);
  });
});
