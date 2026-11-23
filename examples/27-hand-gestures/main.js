// 27 · hand gestures — what a camera can tell about two hands, drawn on the hands themselves.
//
// Turn on 🖐 hands (L1 · Input) and allow the camera. Until then two simulated hands play, so the
// page works on a projector with no camera and you can see what each signal does.
//
// What the hands play (all through routes → params: the timeline, a MIDI knob or the piano can play it too):
//   right fingertip              → where the light is          hand/right/tip/x|y
//   right hand open ↔ fist       → how wide the flower opens   hand/right/openness
//   right hand's angle           → its colour                  hand/right/angle (0.5 = fingers up)
//   both hands apart ↔ together  → the ring between them       hand/both/distance, hand/both/x|y
//   pinch (either hand)          → a burst of sparks           hand/<side>/pinch-start
//   victory ✌ (right)            → the colours turn over       hand/right/gesture/victory-start
//   fist ✊ (left)                → the sparks fall              hand/left/gesture/fist-start
//   thumb up 👍 (either)          → confetti                     hand/<side>/gesture/thumb-up-start
// The camera picture, the skeleton, the pinch line and the numbers are show.hands.overlay(): the
// one place this world reads the input directly, because it draws the hands themselves.

import { createShow } from '@openav/show';
import { createCanvas } from '@openav/stage';

const world = {
  name: 'hand-gestures',
  params: [
    { key: 'tipX',   label: 'Light x (R fingertip)', min: 0, max: 1, def: 0.62 },
    { key: 'tipY',   label: 'Light y (R fingertip)', min: 0, max: 1, def: 0.55 },
    { key: 'bloom',  label: 'Flower (R open)',       min: 0, max: 1, def: 0.5 },
    { key: 'tint',   label: 'Colour (R angle)',      min: 0, max: 1, def: 0.5 },
    { key: 'span',   label: 'Ring (both apart)',     min: 0, max: 1, def: 0.4 },
    { key: 'midX',   label: 'Ring x (both)',         min: 0, max: 1, def: 0.5 },
    { key: 'midY',   label: 'Ring y (both)',         min: 0, max: 1, def: 0.5 },
    { key: 'camera', label: 'Camera picture',        min: 0, max: 1, def: 0.5 },
    { key: 'spark',  label: 'Sparks (pinch)',        pulse: true },
    { key: 'turn',   label: 'Turn colours (✌)',      pulse: true },
    { key: 'fall',   label: 'Let sparks fall (✊)',   pulse: true },
    { key: 'cheer',  label: 'Confetti (👍)',          pulse: true },
  ],
  init({ container, signals, params }) {
    this.view = createCanvas(container);
    this.t = 0; this.turned = 0; this.gravity = 0; this.s = {};
    this.sparks = [];
    this._unsubs = [
      params.onPulse('spark', () => this.burst(this.s.tipX, this.s.tipY, 70)),
      params.onPulse('turn', () => { this.turned = (this.turned + 0.5) % 1; }),
      params.onPulse('fall', () => { this.gravity = 1; }),
      params.onPulse('cheer', () => { for (let i = 0; i < 6; i++) this.burst(Math.random(), 1.02, 30, true); }),
      signals.on('midi/note/on', () => params.firePulse('spark')),     // no camera: the piano sparks too
    ];
  },
  burst(x = 0.5, y = 0.5, n = 60, confetti = false) {
    const { w, h } = this.view.fit(), hue = this.hue();
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = (confetti ? 2 : 1.5) + Math.random() * 6;
      this.sparks.push({ x: x * w, y: (1 - y) * h, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp + (confetti ? 4 : 0),
        life: 1, hue: confetti ? Math.random() * 360 : hue + Math.random() * 50, size: confetti ? 4 : 2.2 });
    }
    if (this.sparks.length > 2400) this.sparks.splice(0, this.sparks.length - 2400);
  },
  hue() { return (((this.s.tint ?? 0.5) - 0.5) * 2 * 140 + 190 + this.turned * 360) % 360; },
  update(dt, s) {
    this.s = s; this.t += dt;
    this.gravity *= Math.pow(0.4, dt);                 // the fall lasts a couple of seconds, then the sparks float again
    for (const p of this.sparks) {
      p.x += p.vx; p.y += p.vy; p.vy += (0.6 + this.gravity * 14) * dt; p.vx *= 0.98; p.vy *= 0.98; p.life -= dt * 0.45;
    }
    this.sparks = this.sparks.filter((p) => p.life > 0);
  },
  render() {
    const { ctx } = this.view, { w, h } = this.view.fit(), s = this.s;
    ctx.fillStyle = '#05060b'; ctx.fillRect(0, 0, w, h);
    // the hands first: the camera picture (as bright as the `camera` param says), the skeleton, the pinch line,
    // the angle and the numbers. The light is added on top of them.
    const hands = window.openav?.hands;
    hands?.overlay(ctx, w, h, { video: hands.running, dim: 1 - (s.camera ?? 0.5) });
    ctx.globalCompositeOperation = 'lighter';
    const hue = this.hue(), R = Math.min(w, h);
    // the flower at the right fingertip: petals open with the hand
    const fx = (s.tipX ?? 0.6) * w, fy = (1 - (s.tipY ?? 0.5)) * h, open = s.bloom ?? 0.5;
    const petals = 7, r0 = R * (0.03 + open * 0.16);
    for (let k = 0; k < petals; k++) {
      const a = this.t * 0.4 + (k / petals) * Math.PI * 2;
      const g = ctx.createRadialGradient(fx + Math.cos(a) * r0, fy + Math.sin(a) * r0, 0, fx + Math.cos(a) * r0, fy + Math.sin(a) * r0, r0 * 0.9);
      g.addColorStop(0, `hsla(${(hue + k * 9) % 360}, 90%, 62%, ${0.22 + open * 0.3})`); g.addColorStop(1, 'hsla(0,0%,0%,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(fx + Math.cos(a) * r0, fy + Math.sin(a) * r0, r0 * 0.9, 0, 6.2832); ctx.fill();
    }
    // the ring between the hands: wide when they are apart
    const span = s.span ?? 0.4, mx = (s.midX ?? 0.5) * w, my = (1 - (s.midY ?? 0.5)) * h;
    ctx.strokeStyle = `hsla(${(hue + 180) % 360}, 85%, 66%, ${0.25 + span * 0.5})`; ctx.lineWidth = 1.5 + span * 4;
    ctx.beginPath();
    for (let i = 0; i <= 160; i++) {
      const u = (i / 160) * Math.PI * 2, rr = R * (0.05 + span * 0.3) * (1 + 0.06 * Math.sin(u * 6 + this.t * 2));
      const x = mx + Math.cos(u) * rr, y = my + Math.sin(u) * rr; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke();
    for (const p of this.sparks) { ctx.fillStyle = `hsla(${p.hue % 360}, 95%, 66%, ${p.life})`; ctx.fillRect(p.x, p.y, p.size, p.size); }
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(136,146,168,.85)'; ctx.font = '12px ui-monospace, monospace';
    ctx.fillText(hands?.running ? `camera · ${hands.ms.toFixed(1)} ms per frame` : 'simulated hands · 🖐 hands in L1 · Input for the camera', 14, 22);
  },
  dispose() { this._unsubs?.forEach((u) => u()); this.view.dispose(); },
};

const show = await createShow({
  world,
  timeline: {
    total: 90,
    automation: { camera: [[0, 0.5], [60, 0.5], [75, 0.15], [90, 0.5]] },
    scenes: [
      { id: 'see',   t: 0,  title: 'See the hands', note: '🖐 hands · open and close the right hand, turn it' },
      { id: 'play',  t: 30, title: 'Play them',     note: 'pinch for sparks · ✌ turns the colours · 👍 confetti' },
      { id: 'both',  t: 60, title: 'Both hands',    note: 'hands apart and together: the ring · left ✊ lets the sparks fall' },
    ],
  },
  routes: [
    { source: 'hand/right/tip/x',    target: 'tipX',  smooth: 0.06 },
    { source: 'hand/right/tip/y',    target: 'tipY',  smooth: 0.06 },
    { source: 'hand/right/openness', target: 'bloom', curve: 'smooth', smooth: 0.12 },
    { source: 'hand/right/angle',    target: 'tint',  smooth: 0.15 },
    { source: 'hand/both/distance',  target: 'span',  curve: 'smooth', smooth: 0.12 },
    { source: 'hand/both/x',         target: 'midX',  smooth: 0.1 },
    { source: 'hand/both/y',         target: 'midY',  smooth: 0.1 },
    { source: 'hand/right/pinch-start', target: 'spark' },
    { source: 'hand/left/pinch-start',  target: 'spark' },
    { source: 'hand/right/gesture/victory-start', target: 'turn' },
    { source: 'hand/left/gesture/fist-start',     target: 'fall' },
    { source: 'hand/right/gesture/thumb-up-start', target: 'cheer' },
    { source: 'hand/left/gesture/thumb-up-start',  target: 'cheer' },
  ],
  modules: { keys: { base: 60 }, hands: true },
  hint: '🖐 hands in L1 · Input — right fingertip = light, open/close = flower, angle = colour, pinch = sparks, ✌ = turn, 👍 = confetti · both hands apart = ring · left ✊ = fall',
});

// ---------------------------------------------------------------- simulated hands (until the camera runs)
// Two made-up hands go through the same path as the camera's (hands.feed): open, pinch, fist, victory,
// thumb up, apart and together. Real hands take over the moment 🖐 hands is on.
const OPEN = [[0, 0], [-0.04, 0.04], [-0.08, 0.08], [-0.11, 0.12], [-0.13, 0.16], [-0.05, 0.19], [-0.055, 0.26], [-0.06, 0.31],
  [-0.065, 0.35], [0, 0.2], [0, 0.28], [0, 0.33], [0, 0.38], [0.045, 0.19], [0.05, 0.26], [0.055, 0.31], [0.06, 0.34],
  [0.085, 0.16], [0.095, 0.21], [0.1, 0.25], [0.105, 0.28]];
const shape = (moves) => OPEN.map((p, i) => moves[i] || p);
const CURL = { 6: [-0.06, 0.25], 7: [-0.055, 0.21], 8: [-0.045, 0.17], 10: [0, 0.26], 11: [0.005, 0.21], 12: [0.005, 0.17],
  14: [0.05, 0.245], 15: [0.05, 0.2], 16: [0.045, 0.165], 18: [0.09, 0.2], 19: [0.088, 0.17], 20: [0.08, 0.14] };
const ACROSS = { 2: [-0.07, 0.09], 3: [-0.05, 0.13], 4: [-0.015, 0.16] };          // the thumb folded over the fingers
const FIST = shape({ ...CURL, ...ACROSS });
const PINCH = shape({ 3: [-0.1, 0.17], 4: [-0.088, 0.222], 6: [-0.07, 0.25], 7: [-0.085, 0.25], 8: [-0.085, 0.228] });
const VICTORY = shape({ ...CURL, ...ACROSS, 6: [-0.07, 0.26], 7: [-0.085, 0.31], 8: [-0.1, 0.35], 10: [0.01, 0.28], 11: [0.02, 0.33], 12: [0.03, 0.37] });
const THUMB = shape({ ...CURL, 2: [-0.07, 0.1], 3: [-0.08, 0.17], 4: [-0.085, 0.23] });
const ASPECT = 16 / 9;
const lerp = (a, b, k) => a.map((p, i) => [p[0] + (b[i][0] - p[0]) * k, p[1] + (b[i][1] - p[1]) * k]);
// stage space (height 1, x × aspect, y up, mirrored) → MediaPipe landmarks
const place = (pts, x, y, size, rot, flip) => pts.map(([px, py]) => {
  const qx = (flip ? -px : px) * size, qy = py * size, c = Math.cos(rot), s = Math.sin(rot);
  return { x: 1 - (x + qx * c + qy * s) / ASPECT, y: 1 - (y - qx * s + qy * c), z: 0 };
});
// a 12-second loop for each hand: [from, to, shape, gesture MediaPipe would name]
const RIGHT = [[0, 2, OPEN, 'Open_Palm'], [2, 3, PINCH, 'None'], [3, 4.5, OPEN, 'Open_Palm'], [4.5, 6, FIST, 'Closed_Fist'],
  [6, 8, VICTORY, 'Victory'], [8, 9.5, OPEN, 'Open_Palm'], [9.5, 11, THUMB, 'Thumb_Up'], [11, 12, OPEN, 'Open_Palm']];
const LEFT = [[0, 3, OPEN, 'Open_Palm'], [3, 4.2, PINCH, 'None'], [4.2, 7, OPEN, 'Open_Palm'], [7, 9, FIST, 'Closed_Fist'], [9, 12, OPEN, 'Open_Palm']];
const pose = (track, t) => {
  const i = track.findIndex(([a, b]) => t >= a && t < b), [a, , pts, g] = track[i], prev = track[(i + track.length - 1) % track.length][2];
  return { pts: lerp(prev, pts, Math.min(1, (t - a) / 0.35)), gesture: t - a > 0.35 ? g : 'None' };
};
function simulate(now) {
  if (show.hands.running) return;                       // the camera has the hands now
  const t = (now / 1000) % 12, apart = 0.5 + 0.5 * Math.sin(now / 2600);
  const r = pose(RIGHT, t), l = pose(LEFT, t);
  const lm = [place(r.pts, ASPECT / 2 + 0.2 + apart * 0.35, 0.28 + 0.05 * Math.sin(now / 900), 0.95, 0.35 * Math.sin(now / 1700), false),
    place(l.pts, ASPECT / 2 - 0.2 - apart * 0.35, 0.3 + 0.04 * Math.cos(now / 1100), 0.9, -0.2, true)];
  show.hands.feed({ landmarks: lm, handedness: [[{ categoryName: 'Left' }], [{ categoryName: 'Right' }]],
    gestures: [[{ categoryName: r.gesture, score: 0.72 }], [{ categoryName: l.gesture, score: 0.66 }]] }, now);
  requestAnimationFrame(simulate);
}
requestAnimationFrame(simulate);
