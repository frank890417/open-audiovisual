// @openav/pose · hand-features — 21 hand landmarks → the numbers a performer plays with.
//
// Pure functions, no DOM: HandTracker (browser) calls them every frame, the tests call them
// with made-up hands. The maths and the default thresholds come from the hand_features module
// Che-Yu Wu built on torinmb/mediapipe-touchdesigner v0.6.1 for TouchDesigner (2026-11-24), tuned
// on his own hands with an M4 Max and a Logitech MX Brio at a desk (hands 50–80 cm from the
// lens). One set of numbers, so a gesture feels the same in TD and in the browser.
//
// Units. Every distance is measured in "stage space": x mirrored like the signals, x multiplied
// by the frame's aspect ratio and y flipped so +y is up. Height of the frame = 1, so a 16:9
// picture is 1.78 wide. Without the aspect a hand turned sideways would read shorter than the
// same hand upright. Distances on one hand are then divided by the size of that hand
// (wrist → base of the middle finger), so walking toward the camera does not change a pinch.
//
// What was measured on his hands (TD, same units):
//   thumb ↔ index / hand size   pinched 0.11–0.28 · open 0.95–1.2
//   openness (middle, ring, little tips → palm centre / hand size)   fist 0.12–0.5 · open ≈ 1.0
//   palm centre ↔ palm centre   0.25–0.78
//   gesture scores               0.5–0.82 (MediaPipe's own demos use 0.7–0.8: too high for him)

export const FINGERS = ['thumb', 'index', 'middle', 'ring', 'pinky'];

// MediaPipe hand landmark indexes
const WRIST = 0, THUMB_TIP = 4, INDEX_MCP = 5, INDEX_TIP = 8, MIDDLE_MCP = 9, MIDDLE_TIP = 12,
  RING_MCP = 13, RING_TIP = 16, PINKY_MCP = 17, PINKY_TIP = 20;
const TIP = { thumb: THUMB_TIP, index: INDEX_TIP, middle: MIDDLE_TIP, ring: RING_TIP, pinky: PINKY_TIP };

/** MediaPipe's canned gestures, as the short names the signals use. Index + 1 = `hand/<side>/gesture`. */
export const GESTURES = Object.freeze([
  ['Closed_Fist', 'fist'], ['Open_Palm', 'open'], ['Pointing_Up', 'point'], ['Thumb_Up', 'thumb-up'],
  ['Thumb_Down', 'thumb-down'], ['Victory', 'victory'], ['ILoveYou', 'iloveyou'],
].map(([mp, name]) => Object.freeze({ mp, name })));
const BY_MP = new Map(GESTURES.map((g, i) => [g.mp, { ...g, id: i + 1 }]));

/**
 * The defaults are the TD module's (hand_features.tox, 2026-11-24). Change them per show:
 * new HandTracker({ thresholds: { gestureOn: 0.6 } }).
 */
export const HAND_DEFAULTS = Object.freeze({
  pinchMin: 0.2,      // thumb ↔ finger / hand size that reads 0 (touching)
  pinchMax: 1.2,      // … that reads 1 (wide open)
  pinchOn: 0.35,      // a pinch starts below this (raw, thumb ↔ index / hand size) …
  pinchOff: 0.56,     // … and ends above this (0.35 × 1.6, the TD module's ratio)
  openMin: 0.6,       // openness raw that reads 0 (fist); a pinch also needs the other three fingers above it
  openMax: 1.1,       // openness raw that reads 1 (all fingers out)
  gestureOn: 0.5,     // a gesture starts when MediaPipe's score goes above this …
  gestureOff: 0.35,   // … and ends below this
  bothMin: 0.2,       // palm ↔ palm that reads 0 (hands together)
  bothMax: 1.0,       // … that reads 1 (arms apart)
  hold: 80,           // ms a new state must last before it counts (the TD module's debounce, 0.08 s)
  speedFull: 3,       // palm speed that reads 1, in frame heights per second
});

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const remap = (v, lo, hi) => (hi === lo ? 0 : clamp01((v - lo) / (hi - lo)));
const TAU = Math.PI * 2;

/** A landmark in stage space (see the header): [x × aspect, y up]. */
export function stagePoint(p, { aspect = 16 / 9, mirror = true } = {}) {
  return [(mirror ? 1 - p.x : p.x) * aspect, 1 - p.y];
}

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/**
 * Everything one hand gives, from its 21 landmarks (MediaPipe normalized: 0..1, y down, not mirrored).
 * Continuous values are 0..1; *Raw values are the unmapped measures (for tuning thresholds).
 * @returns {{ size:number, tip:{x:number,y:number}, palm:{x:number,y:number}, palmStage:number[],
 *   thumb:{index:number,middle:number,ring:number,pinky:number}, thumbRaw:object,
 *   openness:number, opennessRaw:number, angle:number } | null}
 */
export function handFeatures(lm, { aspect = 16 / 9, mirror = true, thresholds = HAND_DEFAULTS } = {}) {
  if (!lm || lm.length < 21) return null;
  const t = { ...HAND_DEFAULTS, ...thresholds };
  const P = lm.map((p) => stagePoint(p, { aspect, mirror }));
  const size = dist(P[WRIST], P[MIDDLE_MCP]);
  if (!(size > 1e-4)) return null;
  const palmIdx = [WRIST, INDEX_MCP, MIDDLE_MCP, RING_MCP, PINKY_MCP];
  const palmStage = [0, 1].map((k) => palmIdx.reduce((s, i) => s + P[i][k], 0) / palmIdx.length);
  const thumbRaw = {}, thumb = {};
  for (const f of FINGERS.slice(1)) {
    thumbRaw[f] = dist(P[THUMB_TIP], P[TIP[f]]) / size;
    thumb[f] = remap(thumbRaw[f], t.pinchMin, t.pinchMax);
  }
  const opennessRaw = [MIDDLE_TIP, RING_TIP, PINKY_TIP].reduce((s, i) => s + dist(P[i], palmStage), 0) / 3 / size;
  // wrist → base of the middle finger. 0.5 = fingers straight up, 0.75 = pointing to the viewer's
  // right, 0.25 = to the left; the jump between 0 and 1 is at "fingers down", where a hand rarely goes,
  // so a smoothed route never sweeps across the whole range.
  const dx = P[MIDDLE_MCP][0] - P[WRIST][0], dy = P[MIDDLE_MCP][1] - P[WRIST][1];
  const angle = 0.5 + Math.atan2(dx, dy) / TAU;
  return {
    size,
    tip: { x: P[INDEX_TIP][0] / aspect, y: P[INDEX_TIP][1] },
    palm: { x: palmStage[0] / aspect, y: palmStage[1] },
    palmStage,
    thumb, thumbRaw,
    openness: remap(opennessRaw, t.openMin, t.openMax),
    opennessRaw,
    angle: angle >= 1 ? 0 : angle,
  };
}

/**
 * The two hands together, from two handFeatures() results (left, right).
 * angle: the line from the left palm to the right one; 0.5 = level, above 0.5 = right hand higher.
 */
export function twoHands(left, right, { aspect = 16 / 9, thresholds = HAND_DEFAULTS } = {}) {
  if (!left || !right) return null;
  const t = { ...HAND_DEFAULTS, ...thresholds };
  const a = left.palmStage, b = right.palmStage;
  const raw = dist(a, b);
  const ang = 0.5 + Math.atan2(b[1] - a[1], b[0] - a[0]) / TAU;
  return {
    distanceRaw: raw,
    distance: remap(raw, t.bothMin, t.bothMax),
    x: (a[0] + b[0]) / 2 / aspect,
    y: (a[1] + b[1]) / 2,
    angle: ang >= 1 ? 0 : ang,
  };
}

/** The top gesture MediaPipe gave for one hand (it returns one category per hand), as { name, id, score }. */
export function topGesture(categories) {
  const c = categories?.[0];
  const g = c && BY_MP.get(c.categoryName);
  return g ? { name: g.name, id: g.id, score: c.score } : { name: 'none', id: 0, score: c?.score ?? 0 };
}

/**
 * A Schmitt trigger with a hold time: it turns on when `on` has been true for `hold` ms, off when
 * `off` has been true for `hold` ms. Near a single threshold a pinch would flicker at 30 Hz;
 * two thresholds and a short hold make it one clean start and one clean end.
 */
export class Latch {
  constructor(hold = HAND_DEFAULTS.hold) { this.hold = hold; this.active = false; this.since = null; }
  /** update(onCond, offCond, nowMs) → 'start' | 'end' | null */
  update(on, off, now) {
    const want = this.active ? !off : on;
    if (want === this.active) { this.since = null; return null; }
    if (this.since == null) this.since = now;
    if (now - this.since < this.hold) return null;
    this.active = want; this.since = null;
    return want ? 'start' : 'end';
  }
  /** The hand is gone: end now, no hold (a lost hand must not stay pinched). */
  release() { this.since = null; if (!this.active) return null; this.active = false; return 'end'; }
}

/**
 * Per-hand state across frames: pinch and the seven gestures as latches, and palm speed.
 * update(features, gesture, nowMs) → events [{ type: 'pinch-start'|'pinch-end'|'gesture-start'|'gesture-end', gesture? }]
 */
export class HandState {
  /** @param {object} [thresholds] read on every update (HandTracker passes its own, so retuning it takes effect at once) */
  constructor(thresholds = { ...HAND_DEFAULTS }) {
    this.t = thresholds;
    this.pinch = new Latch(this.t.hold ?? HAND_DEFAULTS.hold);
    this.gestures = Object.fromEntries(GESTURES.map((g) => [g.name, new Latch(this.t.hold ?? HAND_DEFAULTS.hold)]));
    this.speed = 0; this._prev = null;
    this.pinchRaw = null; this.gesture = { name: 'none', id: 0, score: 0 };
  }

  update(f, gesture, now) {
    const out = [];
    if (!f) return this.release();
    const t = { ...HAND_DEFAULTS, ...this.t };
    this.pinch.hold = t.hold;
    for (const g of GESTURES) this.gestures[g.name].hold = t.hold;
    this.pinchRaw = f.thumbRaw.index;
    const e = this.pinch.update(f.thumbRaw.index < t.pinchOn && f.opennessRaw > t.openMin, f.thumbRaw.index > t.pinchOff, now);
    if (e) out.push({ type: `pinch-${e}` });
    this.gesture = gesture || { name: 'none', id: 0, score: 0 };
    for (const g of GESTURES) {
      const s = this.gesture.name === g.name ? this.gesture.score : 0;
      const ge = this.gestures[g.name].update(s > t.gestureOn, s < t.gestureOff, now);
      if (ge) out.push({ type: `gesture-${ge}`, gesture: g.name });
    }
    // palm speed in frame heights per second, lightly smoothed (a finite difference at 30 fps is jumpy)
    if (this._prev && now > this._prev.at) {
      const v = dist(f.palmStage, this._prev.p) / ((now - this._prev.at) / 1000) / t.speedFull;
      this.speed += (Math.min(1, v) - this.speed) * 0.5;
    }
    this._prev = { p: f.palmStage, at: now };
    return out;
  }

  release() {
    const out = [];
    if (this.pinch.release()) out.push({ type: 'pinch-end' });
    for (const g of GESTURES) if (this.gestures[g.name].release()) out.push({ type: 'gesture-end', gesture: g.name });
    this.speed = 0; this._prev = null; this.pinchRaw = null; this.gesture = { name: 'none', id: 0, score: 0 };
    return out;
  }

  get pinched() { return this.pinch.active; }
  /** The id (1–7, GESTURES order) of the held gesture, 0 for none. */
  get gestureId() {
    let id = 0, best = -1;
    GESTURES.forEach((g, i) => {
      if (!this.gestures[g.name].active) return;
      const s = this.gesture.name === g.name ? this.gesture.score : 0;
      if (s > best) { best = s; id = i + 1; }
    });
    return id;
  }
}

/**
 * Which detected hand is which side. MediaPipe labels handedness from the camera's view, so in a
 * mirror the labels swap. Two hands with the same label (it happens: both read "Right") are told
 * apart by position: the one further to the viewer's left is `left`.
 * @param {Array} landmarks  result.landmarks
 * @param {Array} handedness result.handedness (or handednesses)
 * @returns {Array<{ side: 'left'|'right', index: number }>}
 */
export function assignSides(landmarks = [], handedness = [], { mirror = true } = {}) {
  const hands = landmarks.slice(0, 2).map((lm, index) => {
    let side = (handedness[index]?.[0]?.categoryName || 'Right').toLowerCase();
    if (mirror) side = side === 'left' ? 'right' : 'left';
    const x = mirror ? 1 - lm[WRIST].x : lm[WRIST].x;
    return { side, index, x };
  });
  if (hands.length === 2 && hands[0].side === hands[1].side) {
    const [a, b] = hands[0].x <= hands[1].x ? [hands[0], hands[1]] : [hands[1], hands[0]];
    a.side = 'left'; b.side = 'right';
  }
  return hands.map(({ side, index }) => ({ side, index }));
}

/** Every signal HandTracker publishes, with its declaration (tests and docs read this list). */
export function handSignals() {
  const out = [];
  for (const s of ['left', 'right']) {
    const p = `hand/${s}`;
    for (const n of ['present', 'x', 'y', 'pinch/index', 'pinch/middle', 'spread']) out.push([`${p}/${n}`, {}]);
    for (const n of ['tip/x', 'tip/y', 'thumb/index', 'thumb/middle', 'thumb/ring', 'thumb/pinky', 'openness', 'angle', 'speed', 'pinched'])
      out.push([`${p}/${n}`, {}]);
    out.push([`${p}/pinch-start`, { kind: 'pulse' }], [`${p}/pinch-end`, { kind: 'pulse' }]);
    out.push([`${p}/gesture`, { min: 0, max: GESTURES.length, description: '0 none · 1 fist · 2 open · 3 point · 4 thumb-up · 5 thumb-down · 6 victory · 7 iloveyou' }]);
    for (const g of GESTURES) out.push([`${p}/gesture/${g.name}`, {}], [`${p}/gesture/${g.name}-start`, { kind: 'pulse' }]);
  }
  for (const n of ['present', 'distance', 'x', 'y', 'angle']) out.push([`hand/both/${n}`, {}]);
  return out.map(([name, meta]) => [name, { source: 'hand', ...meta }]);
}
