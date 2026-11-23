// @openav/pose · hands: features, latches, sides and what HandTracker publishes, with made-up hands.
//
// The hands are drawn in "stage space" (height of the frame = 1, x × aspect, y up, see
// packages/pose/hand-features.js) and turned into MediaPipe's normalized landmarks, so a test can
// move, scale and turn one hand and check that the numbers that should not change do not.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  HAND_DEFAULTS, GESTURES, handFeatures, twoHands, topGesture, Latch, HandState, assignSides, handSignals,
} from '../packages/pose/hand-features.js';
import { HandTracker } from '../packages/pose/index.js';
import { Signals } from '../packages/core/index.js';

// an upright right-ish hand, wrist at the origin, wrist → base of the middle finger = 0.2
const OPEN = [[0, 0],
  [-0.04, 0.04], [-0.08, 0.08], [-0.11, 0.12], [-0.13, 0.16],          // thumb 1–4
  [-0.05, 0.19], [-0.055, 0.26], [-0.06, 0.31], [-0.065, 0.35],        // index 5–8
  [0, 0.2], [0, 0.28], [0, 0.33], [0, 0.38],                           // middle 9–12
  [0.045, 0.19], [0.05, 0.26], [0.055, 0.31], [0.06, 0.34],            // ring 13–16
  [0.085, 0.16], [0.095, 0.21], [0.1, 0.25], [0.105, 0.28]];           // little 17–20
const FIST = OPEN.map((p) => p.slice());
Object.assign(FIST, { 4: [0, 0.14], 7: [-0.045, 0.15], 8: [-0.04, 0.12], 11: [0, 0.15], 12: [0, 0.12], 15: [0.04, 0.14], 16: [0.04, 0.11], 19: [0.07, 0.13], 20: [0.07, 0.1] });
const OK = OPEN.map((p) => p.slice());                                 // thumb on index, three fingers out
Object.assign(OK, { 3: [-0.1, 0.17], 4: [-0.095, 0.215], 7: [-0.08, 0.26], 8: [-0.085, 0.225] });

/** stage-space hand → MediaPipe landmarks. rot: radians, positive turns the fingers toward the viewer's right. */
function hand(shape, { at = [0.9, 0.3], scale = 1, rot = 0, aspect = 16 / 9, mirror = true } = {}) {
  const c = Math.cos(rot), s = Math.sin(rot);
  return shape.map(([x, y]) => {
    const X = at[0] + (x * c + y * s) * scale, Y = at[1] + (-x * s + y * c) * scale;
    const nx = X / aspect;
    return { x: mirror ? 1 - nx : nx, y: 1 - Y, z: 0 };
  });
}
const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} ≈ ${b}`);

test('hand features: an open hand, a fist and a pinch read like the TD module measured on real hands', () => {
  const open = handFeatures(hand(OPEN)), fist = handFeatures(hand(FIST)), ok = handFeatures(hand(OK));
  near(open.size, 0.2, 1e-9);
  assert.ok(open.thumbRaw.index > 0.95 && open.thumbRaw.index < 1.2, `open thumb ↔ index ${open.thumbRaw.index}`);
  assert.ok(open.opennessRaw > 0.9 && open.opennessRaw < 1.1, `open openness ${open.opennessRaw}`);
  assert.ok(open.openness > 0.6 && open.thumb.index > 0.6);
  assert.ok(fist.opennessRaw > 0.12 && fist.opennessRaw < 0.5, `fist openness ${fist.opennessRaw}`);
  assert.equal(fist.openness, 0, 'a fist reads 0 open');
  assert.ok(ok.thumbRaw.index < HAND_DEFAULTS.pinchOn && ok.thumb.index === 0, `pinch ${ok.thumbRaw.index}`);
  assert.ok(ok.opennessRaw > HAND_DEFAULTS.openMin, 'the other three fingers stay out');
  for (const f of [open, fist, ok]) for (const k of ['openness', 'angle']) assert.ok(f[k] >= 0 && f[k] <= 1);
});

test('hand features: distance to the camera, position, mirror and turning the hand sideways change no pinch', () => {
  const base = handFeatures(hand(OPEN));
  for (const o of [{ scale: 0.5 }, { scale: 1.6, at: [0.5, 0.2] }, { rot: Math.PI / 2, at: [0.4, 0.5] }, { mirror: false }, { aspect: 4 / 3, at: [0.6, 0.3] }]) {
    const f = handFeatures(hand(OPEN, o), { aspect: o.aspect ?? 16 / 9, mirror: o.mirror ?? true });
    for (const k of ['index', 'middle', 'ring', 'pinky']) near(f.thumbRaw[k], base.thumbRaw[k], 1e-9);
    near(f.opennessRaw, base.opennessRaw, 1e-9);
  }
  // without the aspect correction a hand turned sideways would read differently: that is why it is there
  const side = hand(OPEN, { rot: Math.PI / 2, at: [0.4, 0.5] });
  const wrong = handFeatures(side, { aspect: 1 });
  assert.ok(Math.abs(wrong.thumbRaw.index - base.thumbRaw.index) > 0.05, 'aspect matters');
});

test('hand angle: 0.5 = fingers up, 0.75 = pointing to the viewer\'s right, 0.25 = left; no jump near up', () => {
  near(handFeatures(hand(OPEN)).angle, 0.5, 1e-9);
  near(handFeatures(hand(OPEN, { rot: Math.PI / 2 })).angle, 0.75, 1e-9);
  near(handFeatures(hand(OPEN, { rot: -Math.PI / 2 })).angle, 0.25, 1e-9);
  near(handFeatures(hand(OPEN, { rot: 0.3 })).angle, 0.5 + 0.3 / (2 * Math.PI), 1e-9);
  // mirrored and unmirrored agree, because the angle is taken after the mirror
  near(handFeatures(hand(OPEN, { rot: 0.3, mirror: false }), { mirror: false }).angle, handFeatures(hand(OPEN, { rot: 0.3 })).angle, 1e-9);
  const tip = handFeatures(hand(OPEN, { at: [0.9, 0.3] })).tip;
  near(tip.x, (0.9 - 0.065) / (16 / 9), 1e-9); near(tip.y, 0.3 + 0.35, 1e-9);
});

test('two hands: palm ↔ palm in frame heights, midpoint, a level line reads 0.5', () => {
  const l = handFeatures(hand(OPEN, { at: [0.5, 0.3] })), r = handFeatures(hand(OPEN, { at: [1.1, 0.3] }));
  const b = twoHands(l, r);
  near(b.distanceRaw, 0.6, 1e-9);
  near(b.distance, (0.6 - HAND_DEFAULTS.bothMin) / (HAND_DEFAULTS.bothMax - HAND_DEFAULTS.bothMin), 1e-9);
  near(b.angle, 0.5, 1e-9);
  near(b.x, (l.palm.x + r.palm.x) / 2, 1e-9);
  const up = twoHands(l, handFeatures(hand(OPEN, { at: [1.1, 0.6] })));
  assert.ok(up.angle > 0.5 && up.angle < 0.75, 'right hand higher → above 0.5');
  assert.equal(twoHands(l, null), null);
});

test('latch: a new state counts after the hold, and the two thresholds stop the flicker', () => {
  const l = new Latch(80);
  assert.equal(l.update(true, false, 0), null);
  assert.equal(l.update(true, false, 50), null);
  assert.equal(l.update(true, false, 80), 'start');
  assert.equal(l.update(false, false, 100), null, 'between the thresholds it stays on');
  assert.equal(l.update(false, true, 120), null);
  assert.equal(l.update(false, false, 150), null, 'a blip back resets the hold');
  assert.equal(l.update(false, true, 160), null);
  assert.equal(l.update(false, true, 240), 'end');
  const k = new Latch(80); k.update(true, false, 0); k.update(true, false, 80);
  assert.equal(k.release(), 'end', 'a lost hand ends at once'); assert.equal(k.release(), null);
});

test('hand state: pinch starts below 0.35 with the fingers out, ends above 0.56; a fist is not a pinch', () => {
  const st = new HandState();
  const ok = handFeatures(hand(OK)), open = handFeatures(hand(OPEN)), fist = handFeatures(hand(FIST));
  const run = (f, t0, t1) => { const ev = []; for (let t = t0; t <= t1; t += 33) ev.push(...st.update(f, null, t)); return ev.map((e) => e.type); };
  assert.deepEqual(run(open, 0, 200), []);
  assert.deepEqual(run(ok, 233, 433), ['pinch-start']);
  assert.ok(st.pinched);
  // halfway open: 0.45 is between the thresholds, still pinched
  const half = { ...ok, thumbRaw: { ...ok.thumbRaw, index: 0.45 } };
  assert.deepEqual(run(half, 466, 700), []);
  assert.deepEqual(run(open, 733, 933), ['pinch-end']);
  const fresh = new HandState();
  for (let t = 0; t < 500; t += 33) assert.deepEqual(fresh.update(fist, null, t), [], 'thumb on index inside a fist');
  assert.ok(fist.thumbRaw.index < HAND_DEFAULTS.pinchOn, 'the thumb does touch the index in this fist');
});

test('hand state: a gesture starts above 0.5, holds down to 0.35, and a lost hand ends everything', () => {
  const st = new HandState();
  const f = handFeatures(hand(FIST));
  const g = (score, name = 'Closed_Fist') => topGesture([{ categoryName: name, score }]);
  const run = (gest, t0, t1) => { const ev = []; for (let t = t0; t <= t1; t += 33) ev.push(...st.update(f, gest, t)); return ev; };
  assert.deepEqual(run(g(0.48), 0, 200), [], '0.48 is under the default 0.5');
  assert.deepEqual(run(g(0.55), 233, 400).map((e) => e.type + ':' + e.gesture), ['gesture-start:fist']);
  assert.equal(st.gestureId, 1);
  assert.deepEqual(run(g(0.4), 433, 700), [], 'between 0.35 and 0.5 it holds');
  const sw = run(g(0.7, 'Victory'), 733, 950).map((e) => e.type + ':' + e.gesture);
  assert.deepEqual(sw, ['gesture-end:fist', 'gesture-start:victory'], 'a new top gesture ends the old one');
  assert.equal(st.gestureId, GESTURES.findIndex((x) => x.name === 'victory') + 1);
  assert.deepEqual(st.update(null, null, 1000).map((e) => e.type), ['gesture-end']);
  assert.equal(st.gestureId, 0); assert.equal(st.speed, 0);
  assert.deepEqual(topGesture([{ categoryName: 'None', score: 0.9 }]), { name: 'none', id: 0, score: 0.9 });
  assert.equal(topGesture(undefined).id, 0);
});

test('sides: mirror swaps MediaPipe\'s labels; two hands with the same label are told apart by position', () => {
  const a = hand(OPEN, { at: [0.4, 0.3] }), b = hand(OPEN, { at: [1.3, 0.3] });
  const R = [{ categoryName: 'Right', score: 0.9 }], L = [{ categoryName: 'Left', score: 0.9 }];
  assert.deepEqual(assignSides([a], [R]), [{ side: 'left', index: 0 }], 'mirror: the camera\'s right is the performer\'s left');
  assert.deepEqual(assignSides([a], [R], { mirror: false }), [{ side: 'right', index: 0 }]);
  assert.deepEqual(assignSides([b, a], [R, R]), [{ side: 'right', index: 0 }, { side: 'left', index: 1 }]);
  assert.deepEqual(assignSides([a, b], [L, L]), [{ side: 'left', index: 0 }, { side: 'right', index: 1 }]);
  assert.deepEqual(assignSides([a, b], [L, R]), [{ side: 'right', index: 0 }, { side: 'left', index: 1 }], 'different labels are trusted');
});

test('HandTracker: the first measures are unchanged, the new signals are defined and published, pulses fire', () => {
  const signals = new Signals();
  const tr = new HandTracker({ signals });
  for (const [name, meta] of handSignals()) assert.ok(signals.meta.has(name), name), assert.equal(signals.meta.get(name).source, 'hand');
  assert.equal(new Set(handSignals().map(([n]) => n)).size, handSignals().length, 'names are unique');
  const pulses = [];
  for (const n of ['hand/left/pinch-start', 'hand/left/pinch-end', 'hand/left/gesture/fist-start', 'hand/right/gesture/victory-start']) signals.on(n, (v) => pulses.push([n, v]));
  const ok = hand(OK, { at: [0.5, 0.3] }), fist = hand(FIST, { at: [1.3, 0.3] });
  const res = (lm1, lm2, g2) => ({
    landmarks: [lm1, lm2], handedness: [[{ categoryName: 'Right' }], [{ categoryName: 'Left' }]],
    gestures: [[{ categoryName: 'None', score: 0.6 }], [{ categoryName: g2, score: 0.8 }]],
  });
  for (let t = 0; t <= 200; t += 33) tr.feed(res(ok, fist, 'Victory'), t);
  // the first measures, exactly the old formulas
  const lm = ok, palm = Math.hypot(lm[0].x - lm[9].x, lm[0].y - lm[9].y);
  const d = (a, b) => Math.min(1, Math.hypot(lm[a].x - lm[b].x, lm[a].y - lm[b].y) / (palm * 2.2));
  near(signals.get('hand/left/x'), 1 - lm[9].x, 1e-12); near(signals.get('hand/left/y'), 1 - lm[9].y, 1e-12);
  near(signals.get('hand/left/pinch/index'), d(4, 8), 1e-12);
  near(signals.get('hand/left/pinch/middle'), d(4, 12), 1e-12);
  near(signals.get('hand/left/spread'), d(8, 20), 1e-12);
  assert.equal(signals.get('hand/left/present'), 1); assert.equal(signals.get('hand/right/present'), 1);
  assert.equal(signals.get('hand/left/pinched'), 1);
  assert.equal(signals.get('hand/left/thumb/index'), 0);
  assert.equal(signals.get('hand/right/gesture/victory'), 1);
  assert.equal(signals.get('hand/right/gesture'), 6);
  assert.equal(signals.get('hand/left/gesture'), 0);
  assert.equal(signals.get('hand/both/present'), 1);
  near(signals.get('hand/both/angle'), 0.5, 1e-9);
  assert.ok(signals.get('hand/both/distance') > 0.5);
  assert.deepEqual(pulses.map(([n]) => n), ['hand/left/pinch-start', 'hand/right/gesture/victory-start']);
  assert.equal(pulses[0][1].side, 'left'); assert.ok(pulses[0][1].x > 0 && pulses[0][1].x < 1);
  assert.ok(tr.features.left.pinched && tr.features.right.gesture.name === 'victory');
  // the hands leave: present 0, pinch ends, gestures drop, both hands gone
  tr.feed({ landmarks: [], handedness: [], gestures: [] }, 300);
  assert.equal(signals.get('hand/left/present'), 0); assert.equal(signals.get('hand/both/present'), 0);
  assert.equal(signals.get('hand/left/pinched'), 0); assert.equal(signals.get('hand/right/gesture/victory'), 0);
  assert.equal(pulses.at(-1)[0], 'hand/left/pinch-end');
  assert.equal(tr.hands.length, 0);
});

test('HandTracker: thresholds can be retuned per show; landmarks-only mode has no gestures', () => {
  const signals = new Signals();
  const tr = new HandTracker({ signals, thresholds: { gestureOn: 0.9 }, gestures: false });
  assert.equal(tr.thresholds.gestureOn, 0.9); assert.equal(tr.thresholds.pinchOn, HAND_DEFAULTS.pinchOn);
  const fist = hand(FIST);
  for (let t = 0; t <= 300; t += 33) tr.feed({ landmarks: [fist], handedness: [[{ categoryName: 'Left' }]] }, t);
  assert.equal(signals.get('hand/right/present'), 1);
  assert.equal(signals.get('hand/right/gesture'), 0);
  assert.ok(signals.get('hand/right/openness') === 0, 'a fist');
});

test('HandTracker: retuning thresholds on a running tracker takes effect at once; createShow passes them', async () => {
  const signals = new Signals();
  const tr = new HandTracker({ signals });
  const fist = hand(FIST);
  const res = (score) => ({ landmarks: [fist], handedness: [[{ categoryName: 'Left' }]], gestures: [[{ categoryName: 'Closed_Fist', score }]] });
  for (let t = 0; t <= 200; t += 33) tr.feed(res(0.45), t);
  assert.equal(signals.get('hand/right/gesture/fist'), 0, '0.45 is under 0.5');
  tr.thresholds.gestureOn = 0.4; tr.thresholds.hold = 0;
  tr.feed(res(0.45), 250);
  assert.equal(signals.get('hand/right/gesture/fist'), 1, 'the latch reads the tracker\'s thresholds');
  const src = (await import('node:fs')).readFileSync(new URL('../packages/show/index.js', import.meta.url), 'utf8');
  assert.match(src, /new HandTracker\(\{ \.\.\.\(typeof modules\.hands === 'object' \? modules\.hands : \{\}\), signals \}\)/, 'modules.hands: { thresholds, gestures, mirror }');
});
