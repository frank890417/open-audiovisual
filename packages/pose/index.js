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

const MP_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

export class PoseTracker {
  /**
   * @param {object} opts
   * @param {import('../core/src/signals.js?v=3ef3261').Signals} [opts.signals]
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

/** HandTracker — 21-landmark hands → fine-control signals.
 *
 * Per-hand PINCH distances give each
 * hand two precise continuous controllers (four total across both hands):
 *
 *   hand/left/pinch/index    0..1  thumb-tip ↔ index-tip distance
 *   hand/left/pinch/middle   0..1  thumb-tip ↔ middle-tip distance
 *   hand/right/pinch/index .middle  (same, right hand)
 *   hand/left/x .y  hand/right/x .y  palm position (y flipped: 1 = raised)
 *   hand/left/present  hand/right/present  0|1
 *
 * Distances are normalized by palm size (wrist→middle-MCP), so moving toward
 * or away from the camera doesn't change your pinch value — stage-robust.
 * Landmarks kept on .hands for skeleton drawing.
 */
export class HandTracker {
  constructor({ signals = null, mirror = true } = {}) {
    this.signals = signals;
    this.mirror = mirror;
    this.video = null; this.landmarker = null;
    this.running = false;
    this.hands = [];               // [{handed:'left'|'right', lm: [...21]}]
    if (signals) {
      for (const h of ['left', 'right']) {
        for (const n of [`hand/${h}/present`, `hand/${h}/x`, `hand/${h}/y`, `hand/${h}/pinch/index`, `hand/${h}/pinch/middle`, `hand/${h}/spread`])
          signals.define(n, { source: 'hand' });
      }
    }
  }

  async enable({ videoEl = null } = {}) {
    const vision = await import(`${MP_URL}/vision_bundle.mjs`);
    const files = await vision.FilesetResolver.forVisionTasks(`${MP_URL}/wasm`);
    this.landmarker = await vision.HandLandmarker.createFromOptions(files, {
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

  stop() { this.running = false; this.video?.srcObject?.getTracks().forEach(t => t.stop()); }

  _loop() {
    const step = () => {
      if (!this.running) return;
      if (this.video.readyState >= 2) {
        const res = this.landmarker.detectForVideo(this.video, performance.now());
        this._publish(res);
      }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  _publish(res) {
    const s = this.signals;
    this.hands = [];
    const seen = { left: false, right: false };
    const lms = res?.landmarks || [];
    const handedness = res?.handednesses || res?.handedness || [];
    for (let i = 0; i < lms.length; i++) {
      const lm = lms[i];
      // MediaPipe labels handedness from the CAMERA's view; in mirror view the
      // performer's left hand appears on the left — swap so signals match the body
      let label = (handedness[i]?.[0]?.categoryName || 'Right').toLowerCase();
      if (this.mirror) label = label === 'left' ? 'right' : 'left';
      this.hands.push({ handed: label, lm });
      seen[label] = true;
      if (!s) continue;
      const X = (p) => this.mirror ? 1 - p.x : p.x;
      const palm = Math.hypot(lm[0].x - lm[9].x, lm[0].y - lm[9].y) || 0.1;   // wrist→middle-MCP
      const d = (a, b) => Math.hypot(lm[a].x - lm[b].x, lm[a].y - lm[b].y) / (palm * 2.2);
      s.set(`hand/${label}/present`, 1);
      s.set(`hand/${label}/x`, X(lm[9]));
      s.set(`hand/${label}/y`, 1 - lm[9].y);
      s.set(`hand/${label}/pinch/index`, Math.min(1, d(4, 8)));
      s.set(`hand/${label}/pinch/middle`, Math.min(1, d(4, 12)));
      s.set(`hand/${label}/spread`, Math.min(1, d(8, 20)));
    }
    if (s) for (const h of ['left', 'right']) if (!seen[h]) s.set(`hand/${h}/present`, 0);
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
}
