// @openav/output — the projection module, the parts that run in node: the corner-pin homography, the layout file, the crop
// math, the params, the clean output address, and createShow at that address (a follower that holds the leader's values).
// The window, the edit mode and the test pattern are checked in a real Chromium (docs/output.md says how).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cornerPin, toMatrix3d, projectPoint, checkQuad, cornerOrder, pinnedBox } from '../packages/output/pin.js';
import { cropBox, normalizeCrop } from '../packages/output/crop.js';
import { OUTPUT_FORMAT, parseOutputLayout, layoutDoc, defaultRoom, loadRoom, saveRoom, checkRoom } from '../packages/output/layout.js';
import { outputParams, outputKeys, paramReader, veilOf } from '../packages/output/params.js';
import { outputQuery, outputUrl, parseAspect } from '../packages/output/url.js';
import { adoptOverrides, PARAMS_EXTRA } from '../packages/output/follow.js';
import * as pkg from '../packages/output/index.js';
import { Params } from '../packages/core/index.js';
import { Timeline } from '../packages/timeline/index.js';
import { withGlobals, anything } from './_fakepage.js';

const near = (a, b, eps = 1e-9, msg = '') => assert.ok(Math.abs(a - b) <= eps, `${msg} ${a} ≉ ${b}`);
const nearPt = (p, q, eps = 1e-7, msg = '') => { near(p[0], q[0], eps, msg + ' x'); near(p[1], q[1], eps, msg + ' y'); };
const RECT = (w, h) => [[0, 0], [w, 0], [w, h], [0, h]];

// ───────────── the homography ─────────────

test('cornerPin: the rectangle onto itself is the identity, and so is its CSS', () => {
  const H = cornerPin(RECT(1920, 1080), 1920, 1080);
  [1, 0, 0, 0, 1, 0, 0, 0, 1].forEach((v, i) => near(H[i], v, 1e-12, `H[${i}]`));
  assert.equal(toMatrix3d(H), 'matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1)');
  for (const [x, y] of [[0, 0], [100, 900], [1919.5, 3]]) nearPt(projectPoint(H, x, y), [x, y]);
});

test('cornerPin: a keystoned quad — the four corners land where they were put, the centre on the crossing of the diagonals, edges stay straight', () => {
  const quad = [[120, 40], [1800, 0], [1920, 1080], [0, 1010]];      // a projector off-axis: every corner somewhere else
  const W = 1920, H = 1080;
  const M = cornerPin(quad, W, H);
  RECT(W, H).forEach((p, i) => nearPt(projectPoint(M, p[0], p[1]), quad[i], 1e-6, `corner ${i + 1}`));
  // a projective map keeps lines: the rectangle's centre goes to where the quad's diagonals cross
  const [[x0, y0], , [x2, y2]] = quad, [, [x1, y1], , [x3, y3]] = quad;
  const d = (x0 - x2) * (y1 - y3) - (y0 - y2) * (x1 - x3);
  const t = ((x0 - x1) * (y1 - y3) - (y0 - y1) * (x1 - x3)) / d;
  nearPt(projectPoint(M, W / 2, H / 2), [x0 + t * (x2 - x0), y0 + t * (y2 - y0)], 1e-6, 'centre');
  // a point a third along the top edge stays on the quad's top edge (collinear with its two ends)
  const [px, py] = projectPoint(M, W / 3, 0);
  near((x1 - x0) * (py - y0) - (y1 - y0) * (px - x0), 0, 1e-6, 'on the top edge');
  assert.ok(Math.abs(M[6]) > 0 || Math.abs(M[7]) > 0, 'a true perspective (not affine)');
});

test('cornerPin: a parallelogram is affine (no perspective row), a known case computed by hand', () => {
  const M = cornerPin([[10, 20], [110, 20], [130, 70], [30, 70]], 100, 50);   // a shear of 20 px over the height
  [1, 0.4, 10, 0, 1, 20, 0, 0, 1].forEach((v, i) => near(M[i], v, 1e-12, `M[${i}]`));
});

test('cornerPin: the CSS matrix3d is the same transform, column by column, with no exponent in it', () => {
  const quad = [[30, 10], [900, 60], [870, 500], [5, 530]];
  const M = cornerPin(quad, 960, 540);
  const css = toMatrix3d(M);
  assert.doesNotMatch(css, /e[-+]?\d/i, 'fixed notation');
  const m = css.slice(9, -1).split(',').map(Number);                         // 16 numbers, column-major
  assert.equal(m.length, 16);
  for (const [x, y] of [[0, 0], [960, 0], [960, 540], [0, 540], [480, 270], [100, 400]]) {
    const X = m[0] * x + m[4] * y + m[12], Y = m[1] * x + m[5] * y + m[13], Wh = m[3] * x + m[7] * y + m[15];
    nearPt([X / Wh, Y / Wh], projectPoint(M, x, y), 1e-4, `(${x}, ${y})`);
  }
  assert.throws(() => toMatrix3d([1, 2, 3]), /9 numbers/);
});

test('cornerPin: quads no projector throws are refused, each with its reason', () => {
  const cases = [
    [[[0, 0], [1, 0], [1, 1]], /four corners/],
    [[[0, 0], [1, 0], [NaN, 1], [0, 1]], /corner 3/],
    [[[0, 0], [0, 0], [0, 0], [0, 0]], /no area/],
    [[[0, 0], [1, 0], [2, 0], [3, 0]], /no area/],                                   // all on one line
    [[[0, 0], [0.5, 0], [1, 0], [0, 1]], /one line/],                                 // three on one line
    [[[0, 0], [1, 0], [0, 1], [1, 1]], /not convex/],                                 // a bow tie: two edges cross
    [[[0, 0], [1, 0], [0.3, 0.3], [0, 1]], /not convex/],                             // a corner pushed inside
  ];
  for (const [q, why] of cases) {
    assert.match(String(checkQuad(q)), why, JSON.stringify(q));
    assert.throws(() => cornerPin(q, 10, 10), why, JSON.stringify(q));
  }
  assert.equal(checkQuad(RECT(1, 1)), null);
  assert.equal(checkQuad([[1, 0], [0, 0], [0, 1], [1, 1]]), null, 'a mirrored quad is convex too (flip done by hand)');
  assert.throws(() => cornerPin(RECT(1, 1), 0, 10), /above 0/);
});

test('cornerOrder / pinnedBox: a quarter turn, a flip, both — the picture\'s corners go to the right physical corners', () => {
  assert.deepEqual(cornerOrder({}), [0, 1, 2, 3]);
  assert.deepEqual(cornerOrder({ rotate: 90 }), [1, 2, 3, 0], 'turned clockwise: the picture\'s top-left is at the top-right');
  assert.deepEqual(cornerOrder({ rotate: 180 }), [2, 3, 0, 1]);
  assert.deepEqual(cornerOrder({ flipX: true }), [1, 0, 3, 2], 'rear projection: left and right swap');
  assert.deepEqual(cornerOrder({ flipY: true }), [3, 2, 1, 0]);
  assert.deepEqual(cornerOrder({ flipX: true, flipY: true }), cornerOrder({ rotate: 180 }), 'both flips are half a turn');
  const room = { ...defaultRoom(), rotate: 90 };
  const b = pinnedBox(room, 1920, 1080);
  assert.deepEqual([b.width, b.height], [1080, 1920], 'after a quarter turn the picture is portrait');
  nearPt(projectPoint(b.matrix, 0, 0), [1920, 0], 1e-6, 'picture top-left → window top-right');
  nearPt(projectPoint(b.matrix, 1080, 1920), [0, 1080], 1e-6, 'picture bottom-right → window bottom-left');
  const f = pinnedBox({ ...defaultRoom(), flipX: true }, 800, 600);
  nearPt(projectPoint(f.matrix, 0, 300), [800, 300], 1e-6, 'mirrored: the left edge is on the right');
});

// ───────────── the layout file ─────────────

test('layout: an open-audiovisual/output@1 file survives JSON both ways, defaults filled in', () => {
  const rooms = {
    front: { corners: [[0.02, 0.01], [0.97, 0.03], [0.99, 0.98], [0.01, 0.96]], flipX: true, rotate: 180, overscan: 0.02, soft: 0.05 },
    floor: {},
  };
  const doc = layoutDoc(rooms, '2026-12-01T10:00:00.000Z');
  assert.equal(doc.format, OUTPUT_FORMAT);
  assert.equal(OUTPUT_FORMAT, 'open-audiovisual/output@1');
  const back = parseOutputLayout(JSON.stringify(doc));
  assert.deepEqual(back.outputs.front, { ...defaultRoom(), ...rooms.front });
  assert.deepEqual(back.outputs.floor, defaultRoom());
  assert.deepEqual(parseOutputLayout(back), back, 'parsing what parse gave changes nothing');
  assert.equal(pkg.OUTPUT_FORMAT, OUTPUT_FORMAT);
});

test('layout: a bad file is refused with every problem listed at once', () => {
  const bad = {
    format: 'open-audiovisual/output@2', extra: 1,
    outputs: {
      front: { corners: [[0, 0], [1, 0], [0.3, 0.3], [0, 1]], rotate: 45, overscan: 0.6, flipX: 'yes', colour: 'red' },
      'not a name': {},
      far: { corners: [[0, 0], [3, 0], [3, 1], [0, 1]] },
    },
  };
  let msg = '';
  try { parseOutputLayout(bad); } catch (e) { msg = e.message; }
  for (const part of ['format', 'extra', 'front.corners: the quad is not convex', 'front.rotate', 'front.overscan', 'front.flipX', 'front.colour', 'not a name', 'far.corners: every x and y']) {
    assert.ok(msg.includes(part), `the message names ${part}:\n${msg}`);
  }
  assert.match(msg, /9 problems/);
  assert.throws(() => parseOutputLayout('{ not json'), /not JSON/);
  assert.throws(() => parseOutputLayout([]), /an object/);
  assert.throws(() => parseOutputLayout({ format: OUTPUT_FORMAT, outputs: [] }), /outputs: must be an object/);
});

test('layout: saved per output name in a storage; nothing saved, or something unreadable, is the default', () => {
  const store = {}, storage = { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); } };
  assert.deepEqual(loadRoom('front', storage), defaultRoom());
  const room = { ...defaultRoom(), corners: [[0.1, 0], [1, 0], [1, 1], [0, 0.9]], flipY: true };
  assert.equal(saveRoom('front', room, storage), true);
  assert.ok('oav-output:front' in store);
  assert.deepEqual(loadRoom('front', storage), room);
  assert.deepEqual(loadRoom('floor', storage), defaultRoom(), 'another name, its own room');
  store['oav-output:front'] = '{broken';
  assert.deepEqual(loadRoom('front', storage), defaultRoom());
  assert.equal(saveRoom('x', room, null), false, 'no storage: nothing saved, nothing thrown');
  assert.deepEqual(loadRoom('x', { getItem() { throw new Error('blocked'); } }), defaultRoom());
  assert.deepEqual(checkRoom({ rotate: 90 })[1], []);
});

// ───────────── crop ─────────────

test('cropBox: the whole stage into a box of the same shape fills it exactly', () => {
  const p = cropBox({ source: { w: 1600, h: 900 }, box: { w: 1920, h: 1080 } });
  assert.deepEqual(p.clip, { left: 0, top: 0, width: 1920, height: 1080 });
  assert.deepEqual(p.source, { left: 0, top: 0, width: 1920, height: 1080 });
});

test('cropBox: contain letterboxes, cover crops, stretch pulls — a 4:3 stage on a 16:9 projector', () => {
  const src = { w: 1200, h: 900 }, box = { w: 1920, h: 1080 };
  const c = cropBox({ source: src, box, fit: 'contain' });
  assert.deepEqual(c.clip, { left: 240, top: 0, width: 1440, height: 1080 }, 'black bars left and right');
  const v = cropBox({ source: src, box, fit: 'cover' });
  assert.deepEqual(v.clip, { left: 0, top: 0, width: 1920, height: 1080 });
  assert.equal(v.source.width, 1920); assert.equal(v.source.height, 1440); assert.equal(v.source.top, -180);
  const s = cropBox({ source: src, box, fit: 'stretch' });
  assert.deepEqual(s.source, { left: 0, top: 0, width: 1920, height: 1080 });
});

test('cropBox: one 32:9 canvas, two 16:9 projectors side by side — each half fills its projector, and they meet at the seam', () => {
  const src = { w: 3840, h: 1080 }, box = { w: 1920, h: 1080 };
  const L = cropBox({ crop: { x: 0, y: 0, w: 0.5, h: 1 }, source: src, box });
  const R = cropBox({ crop: { x: 0.5, y: 0, w: 0.5, h: 1 }, source: src, box });
  for (const p of [L, R]) assert.deepEqual(p.clip, { left: 0, top: 0, width: 1920, height: 1080 });
  assert.deepEqual(L.source, { left: 0, top: 0, width: 3840, height: 1080 });
  assert.deepEqual(R.source, { left: -1920, top: 0, width: 3840, height: 1080 });
  // the stage's x = 1920 (the seam) is the right edge of the left output and the left edge of the right one
  assert.equal(L.source.left + 1920 * (L.source.width / src.w), box.w);
  assert.equal(R.source.left + 1920 * (R.source.width / src.w), 0);
  // a quarter of a 2:1 stage, stretched into a box of another shape: the quarter's corners are the box's corners
  const q = cropBox({ crop: [0.25, 0.5, 0.25, 0.5], source: { w: 2000, h: 1000 }, box: { w: 600, h: 300 }, fit: 'stretch' });
  near(q.source.left + 0.25 * q.source.width, 0); near(q.source.top + 0.5 * q.source.height, 0);
  near(q.source.left + 0.5 * q.source.width, 600); near(q.source.top + 1 * q.source.height, 300);
});

test('crop: what is not a region of the stage is refused', () => {
  assert.deepEqual(normalizeCrop(null), { x: 0, y: 0, w: 1, h: 1 });
  assert.deepEqual(normalizeCrop([0.5, 0, 0.5, 1]), { x: 0.5, y: 0, w: 0.5, h: 1 });
  for (const c of [{ x: 0.6, w: 0.5 }, { w: 0 }, { y: -0.1 }, { h: NaN }, 'left']) assert.throws(() => normalizeCrop(c), /crop/, JSON.stringify(c));
  assert.throws(() => cropBox({ source: { w: 0, h: 1 }, box: { w: 1, h: 1 } }), /source/);
  assert.throws(() => cropBox({ source: { w: 1, h: 1 }, box: { w: 1, h: 1 }, fit: 'zoom' }), /fit/);
});

// ───────────── params (rule 1: blackout and brightness are params) ─────────────

test('params: blackout and brightness per output, from the console, the timeline or a route — read the same way the stage resolves them', () => {
  assert.deepEqual(outputKeys('front'), { blackout: 'output/front/blackout', brightness: 'output/front/brightness' });
  const entries = outputParams(['front', 'floor']);
  assert.deepEqual(entries.map((e) => e.key), ['output/front/blackout', 'output/front/brightness', 'output/floor/blackout', 'output/floor/brightness']);
  assert.deepEqual(entries.map((e) => [e.min, e.max, e.def]), [[0, 1, 0], [0, 1, 1], [0, 1, 0], [0, 1, 1]]);
  assert.equal(entries[0].step, 1, 'blackout is a step param: 0 or 1');
  assert.throws(() => outputParams('a b'), /name/);

  const params = new Params([{ key: 'hue', min: 0, max: 1, def: 0.5 }]).add(outputParams('front'));
  // the timeline fades the front projector to black over the last 10 s and cuts it at the end
  const timeline = new Timeline({ params, total: 60, automation: { 'output/front/brightness': [[50, 1], [60, 0]], 'output/front/blackout': [[0, 0], [59, 0], [59.5, 1]] } });
  const read = paramReader(params, timeline);
  const same = (t) => { timeline.seek(t); const s = params.resolve(timeline.state()); for (const k of ['output/front/blackout', 'output/front/brightness']) assert.equal(read(k), s[k], `${k} at ${t}`); };
  for (const t of [0, 50, 55, 59.2, 59.7]) same(t);
  timeline.seek(55); near(read('output/front/brightness'), 0.5, 1e-9);
  timeline.seek(59.7); assert.equal(read('output/front/blackout'), 1);
  params.override('output/front/blackout', 0);                     // a hand on the console wins over the curve
  assert.equal(read('output/front/blackout'), 0); same(59.7);
  params.hold('output/front/brightness', 0.25, { kind: 'route', label: 'midi/cc/7', source: 'midi/cc/7' });   // a MIDI fader through the mapper
  assert.equal(read('output/front/brightness'), 0.25);
  assert.equal(read('nope'), undefined);
  assert.equal(paramReader(params)('output/front/brightness'), 0.25, 'no timeline: the override or the default');
  // what the window does with the two values
  assert.equal(veilOf(0, 1), 0); assert.equal(veilOf(0, 0.25), 0.75); assert.equal(veilOf(1, 1), 1); assert.equal(veilOf(0, 7), 0); assert.equal(veilOf(0, undefined), 0);
});

test('follow: a page following the show page holds what the show page holds, and lets go of what it let go', () => {
  const params = new Params().add(outputParams('front')).add([{ key: 'hue', min: 0, max: 1, def: 0.5 }]);
  const mine = new Set();
  adoptOverrides(params, { 'output/front/blackout': 1, hue: 0.8, unknown: 3, 'output/front/brightness': NaN }, mine);
  assert.deepEqual(params.overrides, { 'output/front/blackout': 1, hue: 0.8 });
  assert.equal(params.holder('hue').label, 'leader');
  adoptOverrides(params, { hue: 0.8 }, mine);
  assert.deepEqual(params.overrides, { hue: 0.8 }, 'blackout released on the show page: released here');
  adoptOverrides(params, undefined, mine);
  assert.deepEqual(params.overrides, { hue: 0.8 }, 'a frame without the values changes nothing');
  assert.equal(PARAMS_EXTRA, 'oav/params');
});

// ───────────── the clean output address ─────────────

test('outputQuery: no ?output, no clean page; ?output alone is "main"; every key read, bad values dropped', () => {
  assert.equal(outputQuery(''), null);
  assert.equal(outputQuery('?map=x.json'), null);
  assert.deepEqual(outputQuery('?output'), { name: 'main', crop: null, aspect: null, fit: 'contain', follow: null, via: null, play: false });
  assert.equal(outputQuery('?output=').name, 'main');
  const q = outputQuery('?output=left&crop=0,0,0.5,1&aspect=32:9&fit=cover&follow=oav-output&via=relay&play');
  assert.deepEqual(q, { name: 'left', crop: { x: 0, y: 0, w: 0.5, h: 1 }, aspect: 32 / 9, fit: 'cover', follow: 'oav-output', via: true, play: true });
  assert.equal(outputQuery('?output&via=ws://10.0.0.5:8080/relay').via, 'ws://10.0.0.5:8080/relay');
  assert.equal(outputQuery(new URLSearchParams('output=x')).name, 'x');
  const warn = console.warn; console.warn = () => {};
  try {
    const b = outputQuery('?output=no%20spaces&crop=0.7,0,0.5,1&aspect=wide&fit=zoom&follow=a%20b&via=http://x');
    assert.deepEqual(b, { name: 'main', crop: null, aspect: null, fit: 'contain', follow: null, via: null, play: false });
  } finally { console.warn = warn; }
  assert.equal(parseAspect('16:9'), 16 / 9); assert.equal(parseAspect('1.5'), 1.5); assert.equal(parseAspect(2), 2); assert.equal(parseAspect('0'), null);
});

test('outputUrl: the address to type into OBS or TouchDesigner — short, other keys kept, and read back the same', () => {
  const base = 'http://localhost:8080/examples/29-projector-output/?map=a.json&output=old#x';
  assert.equal(outputUrl(base), 'http://localhost:8080/examples/29-projector-output/?map=a.json&output=main');
  const u = outputUrl(base, { name: 'left', crop: { x: 0, y: 0, w: 0.5, h: 1 }, aspect: 32 / 9, follow: 'oav-output', via: true, play: true });
  assert.equal(u, 'http://localhost:8080/examples/29-projector-output/?map=a.json&output=left&crop=0,0,0.5,1&aspect=3.5556&follow=oav-output&via=relay&play');
  const q = outputQuery(new URL(u).search);
  assert.deepEqual([q.name, q.crop, q.follow, q.via, q.play], ['left', { x: 0, y: 0, w: 0.5, h: 1 }, 'oav-output', true, true]);
  near(q.aspect, 3.5556, 1e-9);
  assert.throws(() => outputUrl(base, { name: 'a b' }), /name/);
  assert.throws(() => outputUrl(base, { follow: 'x y' }), /channel/);
});

// ───────────── createShow at the clean address ─────────────

async function onCleanShow(search, options, fn) {
  const store = {};
  const body = anything();
  const added = [];
  body.classList = { add: (c) => added.push(c), remove() {}, contains: (c) => added.includes(c), toggle() {} };
  const doc = anything();
  doc.body = body;
  const fakes = {
    document: doc, window: anything(),
    localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } },
    location: { search, href: 'http://localhost:8080/examples/x/' + search, pathname: '/examples/x/', hostname: 'localhost', host: 'localhost:8080', protocol: 'http:', origin: 'http://localhost:8080' },
    getComputedStyle: () => ({ position: 'relative' }),
    requestAnimationFrame: () => 1, cancelAnimationFrame: () => {},
    setInterval: () => 0, clearInterval: () => {},
    addEventListener: () => {}, removeEventListener: () => {},
    ResizeObserver: class { observe() {} disconnect() {} },
  };
  return withGlobals(fakes, async () => {
    const { createShow } = await import('../packages/show/index.js');
    const show = await createShow({
      telemetry: false, signature: false, monitor: false, loop: 'manual', map: false, profile: false,
      mount: { stage: anything(), side: anything() }, world: { name: 'w', params: [{ key: 'hue', min: 0, max: 1, def: 0.5 }] },
      ...options, modules: { midi: false, ...options.modules },
    });
    try { return await fn(show, added); } finally { show.sync?.close(); }
  });
}

test('createShow ?output: a clean page — the body says so, the desk keys are off, the output is mounted with its params', async () => {
  await onCleanShow('?output=front&play', { modules: { keys: false } }, async (show, classes) => {
    assert.ok(classes.includes('oav-clean'));
    assert.equal(show.output.name, 'front');
    assert.ok(show.params.get('output/front/blackout') && show.params.get('output/front/brightness'));
    assert.deepEqual(show.console.keys.play, [], 'Space means nothing on a projector');
    assert.equal(show.timeline.playing, true, '&play: nobody can press Space inside OBS or TouchDesigner');
    assert.equal(show.sync, null, 'not following: alone');
  });
  await onCleanShow('', { modules: { keys: false } }, async (show, classes) => {
    assert.ok(!classes.includes('oav-clean')); assert.equal(show.output, undefined);
    assert.ok(show.console.keys.play.length, 'the normal page keeps its keys');
  });
});

test('createShow ?output&follow: a follower of the show page, no input of its own, holding the values the leader holds', async () => {
  await onCleanShow('?output=front&follow=hall-out', { modules: { keys: { base: 48 } }, sync: { role: 'leader', channel: 'other' } }, async (show) => {
    assert.equal(show.sync.role, 'follower', 'the address wins over the code\'s own sync');
    assert.equal(show.keys, null, 'a follower takes no input: no keyboard piano');
    assert.equal(show.timeline.following, true);
    // a frame from the leader that openOutput() makes (packages/output/follow.js): its clock, and its held values
    show.sync._take({ v: 1, kind: 'frame', src: 'L-test', seq: 1, T: 3, playing: true, holding: false, rate: 1, extra: { [PARAMS_EXTRA]: { 'output/front/blackout': 1, hue: 0.9 } } }, false);
    assert.equal(show.params.overrides['output/front/blackout'], 1);
    assert.equal(show.params.overrides.hue, 0.9);
    show.sync._take({ v: 1, kind: 'frame', src: 'L-test', seq: 2, T: 3.1, playing: true, holding: false, rate: 1, extra: { [PARAMS_EXTRA]: { hue: 0.9 } } }, false);
    assert.equal(show.params.isOverridden('output/front/blackout'), false, 'released on the leader, released here');
  });
});
