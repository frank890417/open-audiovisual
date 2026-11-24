// @openav/pose — camera-based body & hand tracking → signals.
//
// Wraps MediaPipe Tasks Vision (loaded dynamically from CDN — optional dependency:
// if you never call enable(), nothing is fetched). All inference runs on-device;
// no video ever leaves the machine.
//
// Published signals (normalized, origin top-left of camera frame; y is FLIPPED so
// 1 = hand raised high — performance semantics beat raw pixel semantics):
//   pose/present            0|1     someone visible
//   pose/hand/left/x .y     0..1    left wrist position (mirrored view: "left" = viewer's left)
//   pose/hand/right/x .y    0..1
//   pose/hand/left/v        0..1    wrist speed (normalized units/s, clamped)
//   pose/hand/right/v       0..1
//   pose/hands/spread       0..1    distance between wrists
//   pose/height             0..1    nose height (1 = top of frame)
//   pose/lean               -1..1   shoulder line tilt
//
// Landmark indexes (BlazePose 33): nose 0 · shoulders 11/12 · wrists 15/16.

import { HAND_DEFAULTS, GESTURES, HandState, handFeatures, twoHands, topGesture, assignSides, handSignals } from './hand-features.js?v=c6e958d9';

// 1.2.3 (2026-11): on the same camera frames it gave the same landmarks, gestures and body as 0.10.14,
// in about the same time (Chromium on an M4 Max, fake camera, 2026-11-24).
const MP_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.3';
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

export class PoseTracker {
  /**
   * @param {object} opts
   * @param {import('../core/src/signals.js?v=c6e958d9').Signals} [opts.signals]
   * @param {boolean} [opts.mirror=true] mirror x (webcam-as-mirror; natural for performers)
   */
  constructor({ signals = null, mirror = true } = {}) {
    this.signals = signals;
    this.mirror = mirror;
    this.video = null; this.landmarker = null;
    this.running = false;
    this.landmarks = null;          // latest raw landmarks (33 × {x,y,z,visibility})
    this._prev = { l: null, r: null, at: 0 };
    if (signals) {
      const cont = ['pose/present', 'pose/hand/left/x', 'pose/hand/left/y', 'pose/hand/right/x', 'pose/hand/right/y',
        'pose/hand/left/v', 'pose/hand/right/v', 'pose/hands/spread', 'pose/height'];
      for (const n of cont) signals.define(n, { source: 'pose' });
      signals.define('pose/lean', { min: -1, max: 1, source: 'pose' });
    }
  }

  /** Ask for camera, load the model (CDN), start the detection loop. */
  async enable({ videoEl = null } = {}) {
    const vision = await import(`${MP_URL}/vision_bundle.mjs`);
    const files = await vision.FilesetResolver.forVisionTasks(`${MP_URL}/wasm`);
    this.landmarker = await vision.PoseLandmarker.createFromOptions(files, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
      runningMode: 'VIDEO', numPoses: 1,
    });
    this.video = videoEl || document.createElement('video');
    this.video.muted = true; this.video.playsInline = true;
    const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 360 } });
    this.video.srcObject = stream;
    await this.video.play();
    this.running = true;
    this._loop();
    return true;
  }

  stop() {
    this.running = false;
    this.video?.srcObject?.getTracks().forEach(t => t.stop());
  }

  _loop() {
    const step = () => {
      if (!this.running) return;
      if (this.video.readyState >= 2) {
        const res = this.landmarker.detectForVideo(this.video, performance.now());
        this._publish(res?.landmarks?.[0] || null);
      }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /** Draw the body skeleton onto a 2D context (overlay). Coordinates follow the
   *  same mirror/flip semantics as the signals. Call per frame after update. */
  skeleton(ctx, w, h, { color = 'rgba(122,166,255,0.9)', lineWidth = 2 } = {}) {
    const lm = this.landmarks;
    if (!lm) return;
    const X = (p) => (this.mirror ? 1 - p.x : p.x) * w;
    const Y = (p) => p.y * h;                       // screen space: no flip for drawing
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = lineWidth;
    for (const [a, b] of POSE_BONES) {
      const p = lm[a], q = lm[b];
      if (!p || !q) continue;
      ctx.beginPath(); ctx.moveTo(X(p), Y(p)); ctx.lineTo(X(q), Y(q)); ctx.stroke();
    }
    for (const i of [0, 11, 12, 15, 16, 23, 24]) {
      const p = lm[i]; if (!p) continue;
      ctx.beginPath(); ctx.arc(X(p), Y(p), 4, 0, 6.2832); ctx.fill();
    }
  }

  _publish(lm) {
    const s = this.signals;
    this.landmarks = lm;
    if (!s) return;
    if (!lm) { s.set('pose/present', 0); return; }
    s.set('pose/present', 1);
    const X = (p) => this.mirror ? 1 - p.x : p.x;
    const Y = (p) => 1 - p.y;                    // flip: 1 = top (raised)
    const nose = lm[0], ls = lm[11], rs = lm[12], lw = lm[15], rw = lm[16];
    // in mirror view the performer's right hand appears on the right side
    const left = this.mirror ? rw : lw, right = this.mirror ? lw : rw;
    const now = performance.now();
    const dt = this._prev.at ? (now - this._prev.at) / 1000 : 0;
    const speed = (prev, cur) => (prev && dt > 0)
      ? Math.min(1, Math.hypot(X(cur) - prev.x, Y(cur) - prev.y) / dt / 3)
      : 0;
    s.set('pose/hand/left/x', X(left)); s.set('pose/hand/left/y', Y(left));
    s.set('pose/hand/right/x', X(right)); s.set('pose/hand/right/y', Y(right));
    s.set('pose/hand/left/v', speed(this._prev.l, left));
    s.set('pose/hand/right/v', speed(this._prev.r, right));
    s.set('pose/hands/spread', Math.min(1, Math.hypot(left.x - right.x, left.y - right.y) * 1.5));
    s.set('pose/height', Y(nose));
    s.set('pose/lean', Math.max(-1, Math.min(1, (ls.y - rs.y) * 4 * (this.mirror ? -1 : 1))));
    this._prev = { l: { x: X(left), y: Y(left) }, r: { x: X(right), y: Y(right) }, at: now };
  }
}


// BlazePose 33-landmark bone list (torso, arms, legs — face omitted for stage clarity)
const POSE_BONES = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28],
  [27, 29], [29, 31], [28, 30], [30, 32],
];

// MediaPipe hand: 21 landmarks; bones per finger
const HAND_BONES = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
];
const HAND_MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
const GESTURE_MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task';
const SIDES = ['left', 'right'];
const LABEL = { fist: 'FIST', open: 'OPEN', point: 'POINT', 'thumb-up': 'THUMB UP', 'thumb-down': 'THUMB DOWN', victory: 'VICTORY', iloveyou: 'I LOVE YOU' };

/** HandTracker — 21-landmark hands → fine-control signals, gestures and pinches.
 *
 * One MediaPipe model does it all: the GestureRecognizer finds the hands (the same hand landmarker
 * inside) and names a gesture for each. Per side (left | right):
 *
 *   hand/<side>/present  x .y              0|1 · palm position (base of the middle finger; y flipped: 1 = raised)
 *   hand/<side>/pinch/index .middle .spread 0..1 · the first measures (thumb ↔ index, thumb ↔ middle, index ↔ little,
 *                                           ÷ 2.2 hand sizes; kept as they were, example 03 plays them)
 *   hand/<side>/tip/x .y                   0..1 · index fingertip (draw with a finger)
 *   hand/<side>/thumb/index .middle .ring .pinky  0..1 · thumb tip ↔ each fingertip, 0 = touching (calibrated)
 *   hand/<side>/openness                   0..1 · 0 = fist, 1 = all fingers out
 *   hand/<side>/angle                      0..1 · wrist → middle finger, 0.5 = fingers up, 0.75 = pointing right
 *   hand/<side>/speed                      0..1 · palm speed, 1 = 3 frame heights per second
 *   hand/<side>/pinched                    0|1  · thumb on index with the other fingers open
 *   hand/<side>/gesture                    0..7 · which gesture is held (0 none, see GESTURES)
 *   hand/<side>/gesture/<name>             0|1  · fist open point thumb-up thumb-down victory iloveyou
 *   pulses  hand/<side>/pinch-start|pinch-end · hand/<side>/gesture/<name>-start
 *   hand/both/present distance x y angle   both hands: 0|1 · palm ↔ palm · midpoint · the line's tilt (0.5 = level)
 *
 * Distances are divided by the size of the hand (wrist → base of the middle finger) and measured
 * with x × aspect ratio, so neither the distance to the camera nor turning the hand sideways
 * changes a pinch. The thresholds (hand-features.js, HAND_DEFAULTS) are the TouchDesigner
 * hand_features module's, tuned on one performer's hands; pass `thresholds` to retune.
 * Landmarks are kept on .hands for drawing; .features has the raw numbers for tuning.
 */
export class HandTracker {
  /**
   * @param {object} opts
   * @param {import('../core/src/signals.js?v=c6e958d9').Signals} [opts.signals]
   * @param {boolean} [opts.mirror=true]   webcam as a mirror
   * @param {boolean} [opts.gestures=true] recognise gestures (GestureRecognizer); false = landmarks only (HandLandmarker)
   * @param {object}  [opts.thresholds]    overrides for HAND_DEFAULTS (hand-features.js)
   */
  constructor({ signals = null, mirror = true, gestures = true, thresholds = {} } = {}) {
    this.signals = signals;
    this.mirror = mirror;
    this.gestures = gestures;
    this.thresholds = { ...HAND_DEFAULTS, ...thresholds };
    this.video = null; this.landmarker = null;
    this.running = false;
    this.hands = [];               // [{handed:'left'|'right', lm: [...21]}]
    this.features = { left: null, right: null, both: null };
    this.ms = 0;                   // the last detection, in milliseconds
    this._state = { left: new HandState(this.thresholds), right: new HandState(this.thresholds) };
    if (signals) for (const [name, meta] of handSignals()) signals.define(name, meta);
  }

  async enable({ videoEl = null } = {}) {
    const vision = await import(`${MP_URL}/vision_bundle.mjs`);
    const files = await vision.FilesetResolver.forVisionTasks(`${MP_URL}/wasm`);
    this.landmarker = this.gestures
      ? await vision.GestureRecognizer.createFromOptions(files, {
        baseOptions: { modelAssetPath: GESTURE_MODEL_URL, delegate: 'GPU' },
        runningMode: 'VIDEO', numHands: 2,
      })
      : await vision.HandLandmarker.createFromOptions(files, {
        baseOptions: { modelAssetPath: HAND_MODEL_URL, delegate: 'GPU' },
        runningMode: 'VIDEO', numHands: 2,
      });
    this.video = videoEl || document.createElement('video');
    this.video.muted = true; this.video.playsInline = true;
    const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 360 } });
    this.video.srcObject = stream;
    await this.video.play();
    this.running = true;
    this._loop();
    return true;
  }

  stop() { this.running = false; this.video?.srcObject?.getTracks().forEach(t => t.stop()); this.feed(null, performance.now()); }

  _loop() {
    let last = -1;
    const step = () => {
      if (!this.running) return;
      const v = this.video;
      // one detection per camera frame: the screen may refresh at 120 Hz, the camera gives 30
      if (v.readyState >= 2 && v.currentTime !== last) {
        last = v.currentTime;
        const now = performance.now();
        const res = this.gestures ? this.landmarker.recognizeForVideo(v, now) : this.landmarker.detectForVideo(v, now);
        this.ms = performance.now() - now;
        this.feed(res, now);
      }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /** The frame's aspect ratio (width / height); 16:9 until the camera says otherwise. */
  get aspect() { const v = this.video; return v && v.videoWidth && v.videoHeight ? v.videoWidth / v.videoHeight : 16 / 9; }

  /**
   * Publish one detection result: what enable() does with every camera frame. Call it yourself to
   * play recorded landmarks, or hands from another detector, through the same features and signals.
   * @param {{ landmarks?: Array, handedness?: Array, gestures?: Array } | null} res MediaPipe's result shape
   * @param {number} [now] ms, performance.now() clock (latches and speed use it)
   */
  feed(res, now = performance.now()) {
    const s = this.signals;
    const lms = res?.landmarks || [];
    const handedness = res?.handedness || res?.handednesses || [];
    const opts = { aspect: this.aspect, mirror: this.mirror, thresholds: this.thresholds };
    this.hands = [];
    const by = { left: null, right: null };
    for (const { side, index } of assignSides(lms, handedness, { mirror: this.mirror })) {
      const lm = lms[index];
      this.hands.push({ handed: side, lm });
      by[side] = { lm, f: handFeatures(lm, opts), g: topGesture(res?.gestures?.[index]) };
    }
    for (const side of SIDES) {
      const h = by[side], st = this._state[side];
      const events = h?.f ? st.update(h.f, h.g, now) : st.release();
      this.features[side] = h?.f ? { ...h.f, pinchRaw: st.pinchRaw, pinched: st.pinched, gesture: st.gesture, speed: st.speed } : null;
      if (!s) continue;
      const p = `hand/${side}`;
      s.set(`${p}/present`, h?.f ? 1 : 0);
      if (h?.f) {
        const lm = h.lm, f = h.f;
        // the first measures, unchanged: no aspect correction, ÷ 2.2 hand sizes
        const X = (q) => this.mirror ? 1 - q.x : q.x;
        const palm = Math.hypot(lm[0].x - lm[9].x, lm[0].y - lm[9].y) || 0.1;
        const d = (a, b) => Math.hypot(lm[a].x - lm[b].x, lm[a].y - lm[b].y) / (palm * 2.2);
        s.set(`${p}/x`, X(lm[9]));
        s.set(`${p}/y`, 1 - lm[9].y);
        s.set(`${p}/pinch/index`, Math.min(1, d(4, 8)));
        s.set(`${p}/pinch/middle`, Math.min(1, d(4, 12)));
        s.set(`${p}/spread`, Math.min(1, d(8, 20)));
        s.set(`${p}/tip/x`, f.tip.x); s.set(`${p}/tip/y`, f.tip.y);
        for (const k of ['index', 'middle', 'ring', 'pinky']) s.set(`${p}/thumb/${k}`, f.thumb[k]);
        s.set(`${p}/openness`, f.openness);
        s.set(`${p}/angle`, f.angle);
      }
      s.set(`${p}/speed`, st.speed);
      s.set(`${p}/pinched`, st.pinched ? 1 : 0);
      s.set(`${p}/gesture`, st.gestureId);
      for (const g of GESTURES) s.set(`${p}/gesture/${g.name}`, st.gestures[g.name].active ? 1 : 0);
      const at = h?.f ? { side, x: h.f.tip.x, y: h.f.tip.y } : { side, x: s.get(`${p}/tip/x`) ?? 0.5, y: s.get(`${p}/tip/y`) ?? 0.5 };
      for (const e of events) {
        if (e.type === 'gesture-start') s.pulse(`${p}/gesture/${e.gesture}-start`, { ...at, gesture: e.gesture, score: st.gesture.score });
        else if (e.type.startsWith('pinch')) s.pulse(`${p}/${e.type}`, { ...at, distance: h?.f ? h.f.thumb.index : 1 });
      }
    }
    const both = twoHands(by.left?.f, by.right?.f, opts);
    this.features.both = both;
    if (s) {
      s.set('hand/both/present', both ? 1 : 0);
      if (both) { s.set('hand/both/distance', both.distance); s.set('hand/both/x', both.x); s.set('hand/both/y', both.y); s.set('hand/both/angle', both.angle); }
    }
  }

  /** Draw hand skeletons onto a 2D context (overlay). */
  skeleton(ctx, w, h, { colorLeft = 'rgba(55,201,120,0.9)', colorRight = 'rgba(255,209,102,0.9)', lineWidth = 2 } = {}) {
    for (const { handed, lm } of this.hands) {
      const col = handed === 'left' ? colorLeft : colorRight;
      ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = lineWidth;
      const X = (p) => (this.mirror ? 1 - p.x : p.x) * w;
      const Y = (p) => p.y * h;
      for (const [a, b] of HAND_BONES) {
        ctx.beginPath(); ctx.moveTo(X(lm[a]), Y(lm[a])); ctx.lineTo(X(lm[b]), Y(lm[b])); ctx.stroke();
      }
      for (const i of [4, 8, 12]) {       // thumb/index/middle tips: the control points
        ctx.beginPath(); ctx.arc(X(lm[i]), Y(lm[i]), 5, 0, 6.2832); ctx.fill();
      }
    }
  }

  /**
   * Draw what the tracker measures, for tuning and for showing an audience: the camera picture
   * (optional), each hand's skeleton, the thumb ↔ index line with its value (green while pinched),
   * the hand's angle as an arrow, the gesture's name and score, and the line between the two
   * palms with their distance. Same mirroring as the signals; screen space (no y flip).
   */
  overlay(ctx, w, h, { video = false, dim = 0.55, colorLeft = 'rgb(55,201,120)', colorRight = 'rgb(255,209,102)', pinchColor = 'rgb(80,255,120)', scale = 1 } = {}) {
    const S = scale * Math.max(0.6, Math.min(w, h * 16 / 9) / 960);   // line widths and type follow the canvas
    ctx.save();
    if (video && this.video?.readyState >= 2) {
      // the camera picture over the whole canvas, mirrored like the signals (stretched, so a
      // landmark lands where its 0..1 signal says: x × w, y × h — a 16:9 stage shows it undistorted)
      ctx.save();
      if (this.mirror) { ctx.translate(w, 0); ctx.scale(-1, 1); }
      ctx.drawImage(this.video, 0, 0, w, h);
      ctx.restore();
      if (dim > 0) { ctx.fillStyle = `rgba(0,0,0,${dim})`; ctx.fillRect(0, 0, w, h); }
    }
    const X = (p) => (this.mirror ? 1 - p.x : p.x) * w;
    const Y = (p) => p.y * h;
    const label = (text, x, y, color, size = 13) => {
      ctx.font = `600 ${Math.round(size * S)}px ui-monospace, SFMono-Regular, Menlo, monospace`;
      const tw = ctx.measureText(text).width, pad = 5 * S, th = size * S;
      ctx.fillStyle = 'rgba(0,0,0,0.66)';
      ctx.fillRect(x - tw / 2 - pad, y - th - pad, tw + pad * 2, th + pad * 2);
      ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.fillText(text, x, y);
    };
    ctx.lineCap = 'round';
    const palms = {};
    for (const { handed, lm } of this.hands) {
      const col = handed === 'left' ? colorLeft : colorRight;
      const f = this.features[handed];
      ctx.strokeStyle = col; ctx.lineWidth = 2 * S;
      for (const [a, b] of HAND_BONES) { ctx.beginPath(); ctx.moveTo(X(lm[a]), Y(lm[a])); ctx.lineTo(X(lm[b]), Y(lm[b])); ctx.stroke(); }
      ctx.fillStyle = '#fff';
      for (const p of lm) { ctx.beginPath(); ctx.arc(X(p), Y(p), 3 * S, 0, 6.2832); ctx.fill(); }
      if (!f) continue;
      // thumb ↔ index: the pinch, a ring at the midpoint as wide as the gap
      const on = f.pinched, lc = on ? pinchColor : col;
      const t = lm[4], i = lm[8], mx = (X(t) + X(i)) / 2, my = (Y(t) + Y(i)) / 2;
      ctx.strokeStyle = lc; ctx.lineWidth = 5 * S;
      ctx.beginPath(); ctx.moveTo(X(t), Y(t)); ctx.lineTo(X(i), Y(i)); ctx.stroke();
      ctx.lineWidth = 2 * S; ctx.beginPath(); ctx.arc(mx, my, (8 + 34 * f.thumb.index) * S, 0, 6.2832); ctx.stroke();
      label(`${on ? 'PINCH' : 'pinch'} ${f.thumb.index.toFixed(2)}`, mx, my - 16 * S, lc);
      // the hand's angle: an arrow from the wrist through the base of the middle finger
      const w0 = [X(lm[0]), Y(lm[0])], m9 = [X(lm[9]), Y(lm[9])];
      const dx = m9[0] - w0[0], dy = m9[1] - w0[1], L = Math.hypot(dx, dy) || 1, len = 130 * S;
      const tip = [w0[0] + dx / L * len, w0[1] + dy / L * len], ah = 12 * S, a = Math.atan2(dy, dx);
      ctx.strokeStyle = col; ctx.lineWidth = 3 * S;
      ctx.beginPath(); ctx.moveTo(w0[0], w0[1]); ctx.lineTo(tip[0], tip[1]);
      ctx.lineTo(tip[0] - ah * Math.cos(a - 0.45), tip[1] - ah * Math.sin(a - 0.45));
      ctx.moveTo(tip[0], tip[1]); ctx.lineTo(tip[0] - ah * Math.cos(a + 0.45), tip[1] - ah * Math.sin(a + 0.45));
      ctx.stroke();
      label(`angle ${f.angle.toFixed(2)}  open ${f.openness.toFixed(2)}`, w0[0], w0[1] + 34 * S, col, 12);
      const g = f.gesture;
      if (g && g.name !== 'none' && this._state[handed].gestureId) label(`${LABEL[g.name]} ${g.score.toFixed(2)}`, w0[0], w0[1] + 62 * S, '#fff', 16);
      const pc = [0, 5, 9, 13, 17].reduce((o, k) => ({ x: o.x + lm[k].x / 5, y: o.y + lm[k].y / 5 }), { x: 0, y: 0 });   // palm centre, camera space
      palms[handed] = [X(pc), Y(pc)];
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(palms[handed][0], palms[handed][1], 7 * S, 0, 6.2832); ctx.fill();
    }
    const both = this.features.both;
    if (both && palms.left && palms.right) {
      const [a, b] = [palms.left, palms.right];
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2.5 * S; ctx.setLineDash([10 * S, 8 * S]);
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); ctx.setLineDash([]);
      label(`hands ${both.distance.toFixed(2)}  tilt ${both.angle.toFixed(2)}`, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - 12 * S, '#fff', 14);
    }
    ctx.restore();
  }
}
