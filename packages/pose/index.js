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
   * @param {import('../core/src/signals.js').Signals} [opts.signals]
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
