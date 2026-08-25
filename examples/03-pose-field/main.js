// 03 · hand instrument — fingers as a visible instrument.
//
// Each hand is a MODE and a SHAPE at once:
//   thumb↔index   pinch → tightness   (open = loose & sprawling, closed = tight & sharp)
//   thumb↔middle  pinch → complexity  (petal / arm / ring count — the figure grows limbs)
//   palm x/y            → position     (the figure follows your hand)
//   both hands close    → BLOOM        (a shockwave of the current pattern)
//   hands far apart     → a bridge of particles strings between them
//
// Four pattern families cycle with a closed left fist: mandala · lissajous ·
// spirograph · web. Each reads the same params, so the instrument stays the
// same while the picture changes completely — that's the point of a mapping
// layer: one gesture vocabulary, many worlds.

import { createShow } from '@openav/show';
import { createCanvas } from '@openav/stage';

const PATTERNS = ['mandala', 'lissajous', 'spirograph', 'web'];

const handInstrument = {
  name: 'hand-instrument',
  params: [
    { key: 'tightness',  label: 'Tightness (R pinch)',  min: 0, max: 1, def: 0.5 },
    { key: 'complexity', label: 'Complexity (R middle)', min: 3, max: 24, def: 8 },
    { key: 'posX',       label: 'Position X',  min: 0, max: 1, def: 0.5 },
    { key: 'posY',       label: 'Position Y',  min: 0, max: 1, def: 0.5 },
    { key: 'scale',      label: 'Scale (L pinch)', min: 0.2, max: 2.2, def: 1 },
    { key: 'hue',        label: 'Hue',         min: 0, max: 360, def: 190 },
    { key: 'trail',      label: 'Trail',       min: 0.02, max: 0.5, def: 0.1 },
    { key: 'spin',       label: 'Spin',        min: -3, max: 3, def: 0.6 },
    { key: 'pattern',    label: 'Pattern',     min: 0, max: 3, def: 0, step: 1 },
    { key: 'bloom',      label: 'Bloom!',      pulse: true },
    { key: 'nextPattern',label: 'Next pattern', pulse: true },
  ],
  init({ container, signals, params }) {
    this.view = createCanvas(container);
    this.t = 0;
    this.rings = [];        // bloom shockwaves
    this.sparks = [];       // particles for bridges/blooms
    this.s = {};
    this._unsubs = [
      params.onPulse('bloom', () => this.bloom()),
      params.onPulse('nextPattern', () => {
        params.override('pattern', (Math.round(this.s.pattern ?? 0) + 1) % PATTERNS.length);
      }),
      signals.on('midi/note/on', ({ note }) => {          // piano works without a camera
        params.override('complexity', 3 + (note % 12) * 1.8);
        this.bloom();
      }),
    ];
  },
  bloom() {
    const { w, h } = this.view.fit(), s = this.s || {};
    const x = (s.posX ?? 0.5) * w, y = (1 - (s.posY ?? 0.5)) * h;
    this.rings.push({ x, y, r: 8, life: 1, hue: s.hue ?? 190, arms: Math.round(s.complexity ?? 8) });
    for (let i = 0; i < 90; i++) {
      const a = Math.random() * Math.PI * 2, sp = 2 + Math.random() * 7;
      this.sparks.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, hue: (s.hue ?? 190) + Math.random() * 60 });
    }
    if (this.sparks.length > 1500) this.sparks.splice(0, this.sparks.length - 1500);
  },
  update(dt, s) {
    this.s = s; this.t += dt * (1 + (1 - s.tightness) * 0.5);
    for (const r of this.rings) { r.r += (120 + r.arms * 12) * dt; r.life -= dt * 0.55; }
    this.rings = this.rings.filter(r => r.life > 0);
    for (const p of this.sparks) { p.x += p.vx; p.y += p.vy; p.vy += 12 * dt; p.vx *= 0.985; p.vy *= 0.985; p.life -= dt * 0.7; }
    this.sparks = this.sparks.filter(p => p.life > 0);
    // a bridge of sparks when both hands are present and far apart
    const sig = window.openav?.signals;
    if (sig && sig.get('hand/left/present') && sig.get('hand/right/present')) {
      const { w, h } = this.view.fit();
      const lx = sig.get('hand/left/x') * w, ly = (1 - sig.get('hand/left/y')) * h;
      const rx = sig.get('hand/right/x') * w, ry = (1 - sig.get('hand/right/y')) * h;
      const d = Math.hypot(rx - lx, ry - ly);
      if (d > w * 0.25 && Math.random() < 0.6) {
        const k = Math.random();
        this.sparks.push({ x: lx + (rx - lx) * k, y: ly + (ry - ly) * k,
          vx: (Math.random() - 0.5) * 1.5, vy: (Math.random() - 0.5) * 1.5,
          life: 0.8, hue: (s.hue + 120 + k * 80) % 360 });
      }
    }
  },
  render() {
    const { ctx } = this.view, { w, h } = this.view.fit(), s = this.s || {};
    ctx.fillStyle = `rgba(2,3,10,${s.trail ?? 0.1})`;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'lighter';

    const cx = (s.posX ?? 0.5) * w, cy = (1 - (s.posY ?? 0.5)) * h;
    const R = Math.min(w, h) * 0.28 * (s.scale ?? 1);
    const n = Math.max(3, Math.round(s.complexity ?? 8));
    const tight = s.tightness ?? 0.5;                 // 0 = open/loose, 1 = closed/tight
    const hue = s.hue ?? 190;
    const rot = this.t * (s.spin ?? 0.6);
    const pat = PATTERNS[Math.round(s.pattern ?? 0) % PATTERNS.length];

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    ctx.lineWidth = 1 + (1 - tight) * 2.5;

    if (pat === 'mandala') {
      // petals: tight = thin sharp spikes, open = fat overlapping blooms
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        ctx.strokeStyle = `hsla(${(hue + i * (360 / n)) % 360}, 90%, ${55 + tight * 20}%, ${0.35 + tight * 0.5})`;
        ctx.beginPath();
        for (let k = 0; k <= 40; k++) {
          const u = k / 40;
          const spread = (1 - tight) * 0.9 + 0.08;
          const rr = R * Math.sin(u * Math.PI) * (0.6 + 0.6 * Math.sin(this.t * 1.5 + i));
          const aa = a + Math.sin(u * Math.PI) * spread;
          const x = Math.cos(aa) * rr * u, y = Math.sin(aa) * rr * u;
          k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.stroke();
      }
    } else if (pat === 'lissajous') {
      // ratio driven by complexity, phase by tightness — a shape that morphs live
      const a1 = 1 + Math.round(n / 4), b1 = 2 + Math.round(n / 3);
      for (let layer = 0; layer < 3; layer++) {
        ctx.strokeStyle = `hsla(${(hue + layer * 45) % 360}, 95%, ${50 + layer * 12}%, ${0.7 - layer * 0.18})`;
        ctx.beginPath();
        for (let k = 0; k <= 260; k++) {
          const u = (k / 260) * Math.PI * 2;
          const ph = tight * Math.PI + layer * 0.4 + this.t * 0.3;
          const x = Math.sin(a1 * u + ph) * R * (1 - layer * 0.12);
          const y = Math.sin(b1 * u) * R * (1 - layer * 0.12);
          k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.stroke();
      }
    } else if (pat === 'spirograph') {
      // classic hypotrochoid: inner radius from complexity, pen offset from pinch
      const Rr = R, r = R * (0.15 + (n % 9) * 0.07), d = R * (0.15 + (1 - tight) * 0.75);
      ctx.strokeStyle = `hsla(${hue}, 95%, 62%, 0.85)`;
      ctx.beginPath();
      for (let k = 0; k <= 900; k++) {
        const u = (k / 900) * Math.PI * 12;
        const x = (Rr - r) * Math.cos(u) + d * Math.cos((Rr - r) / r * u);
        const y = (Rr - r) * Math.sin(u) - d * Math.sin((Rr - r) / r * u);
        k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
    } else {
      // web: n nodes on a ring, chords skipping by a factor that tightness sweeps
      const skip = 1 + Math.floor(tight * (n - 2));
      const pts = Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2;
        const wob = 1 + Math.sin(this.t * 2 + i) * 0.12 * (1 - tight);
        return [Math.cos(a) * R * wob, Math.sin(a) * R * wob];
      });
      for (let i = 0; i < n; i++) {
        const j = (i + skip) % n;
        ctx.strokeStyle = `hsla(${(hue + i * (240 / n)) % 360}, 92%, 60%, 0.5)`;
        ctx.beginPath(); ctx.moveTo(pts[i][0], pts[i][1]); ctx.lineTo(pts[j][0], pts[j][1]); ctx.stroke();
      }
      for (const [x, y] of pts) {
        ctx.fillStyle = `hsla(${hue}, 95%, 70%, 0.9)`;
        ctx.beginPath(); ctx.arc(x, y, 2 + tight * 3, 0, 6.2832); ctx.fill();
      }
    }
    ctx.restore();

    // bloom shockwaves: an n-pointed star ring that flies outward
    for (const r of this.rings) {
      ctx.strokeStyle = `hsla(${r.hue}, 95%, 65%, ${r.life * 0.8})`;
      ctx.lineWidth = 1 + r.life * 3;
      ctx.beginPath();
      for (let k = 0; k <= 120; k++) {
        const u = (k / 120) * Math.PI * 2;
        const rr = r.r * (1 + 0.18 * Math.sin(u * r.arms));
        const x = r.x + Math.cos(u) * rr, y = r.y + Math.sin(u) * rr;
        k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
    for (const p of this.sparks) {
      ctx.fillStyle = `hsla(${p.hue % 360}, 95%, 68%, ${p.life})`;
      ctx.fillRect(p.x, p.y, 2.2, 2.2);
    }
    ctx.globalCompositeOperation = 'source-over';

    // the instrument, visible: hand skeletons + a pinch gauge per hand
    const { hands, pose, signals } = window.openav || {};
    if (pose?.running) pose.skeleton(ctx, w, h);
    if (hands?.running) {
      hands.skeleton(ctx, w, h, { lineWidth: 2 });
      for (const side of ['left', 'right']) {
        if (!signals.get(`hand/${side}/present`)) continue;
        const hx = signals.get(`hand/${side}/x`) * w, hy = (1 - signals.get(`hand/${side}/y`)) * h;
        const pi = signals.get(`hand/${side}/pinch/index`) ?? 1;
        const pm = signals.get(`hand/${side}/pinch/middle`) ?? 1;
        ctx.font = '10px ui-monospace, monospace';
        ctx.fillStyle = side === 'left' ? 'rgba(55,201,120,.9)' : 'rgba(255,209,102,.9)';
        ctx.fillText(`${side}  index ${'▮'.repeat(Math.round((1 - pi) * 8)).padEnd(8, '·')}`, hx + 14, hy - 6);
        ctx.fillText(`      middle ${'▮'.repeat(Math.round((1 - pm) * 8)).padEnd(8, '·')}`, hx + 14, hy + 8);
      }
    }
    ctx.fillStyle = 'rgba(136,146,168,.8)';
    ctx.font = '12px ui-monospace, monospace';
    ctx.fillText(`pattern: ${pat}   arms: ${n}   tight: ${tight.toFixed(2)}`, 14, 22);
  },
  dispose() { this._unsubs?.forEach(u => u()); this.view.dispose(); },
};

await createShow({
  world: handInstrument,
  timeline: {
    total: 120,
    automation: { hue: [[0, 190], [40, 320], [80, 45], [120, 190]] },
    scenes: [
      { id: 'meet',  t: 0,  title: 'Meet it',  note: 'enable 🖐 hands · pinch right index — watch it tighten' },
      { id: 'shape', t: 40, title: 'Shape it', note: 'right middle grows arms · left pinch scales' },
      { id: 'break', t: 80, title: 'Break it', note: 'close BOTH hands → bloom · left fist → next pattern' },
    ],
  },
  // the gesture vocabulary — invert:true means CLOSING the pinch raises the value
  routes: [
    { source: 'hand/right/pinch/index',  target: 'tightness',  curve: 'smooth', smooth: 0.1,  invert: true },
    { source: 'hand/right/pinch/middle', target: 'complexity', curve: 'linear', smooth: 0.15, invert: true },
    { source: 'hand/right/x',            target: 'posX',       smooth: 0.12 },
    { source: 'hand/right/y',            target: 'posY',       smooth: 0.12 },
    { source: 'hand/left/pinch/index',   target: 'scale',      curve: 'smooth', smooth: 0.15, invert: true },
    { source: 'hand/left/pinch/middle',  target: 'spin',       curve: 'smooth', smooth: 0.2,  invert: true },
    { source: 'hand/left/spread',        target: 'trail',      smooth: 0.2 },
    // body fallback (no hands? enable 🕺 instead)
    { source: 'pose/hand/right/y', target: 'tightness', curve: 'smooth', smooth: 0.15 },
    { source: 'pose/hands/spread', target: 'scale',     smooth: 0.2 },
  ],
  modules: { keys: { base: 60 }, hands: true, pose: true, sound: true, drums: true },
  hint: '🖐 hands in L1 · Input — RIGHT: index pinch = tightness, middle pinch = arms, palm = position<br>LEFT: index = scale, middle = spin, spread = trails · piano/drums also bloom it',
});

// gesture events that are moments, not levels: both-closed = bloom, left fist = next pattern
{
  const { signals, params } = window.openav;
  const st = { l: 1, r: 1, lastBloom: 0, lastPat: 0 };
  const closed = (v) => v <= 0.3;
  const watch = (side) => (v) => {
    const prev = st[side === 'left' ? 'l' : 'r'];
    st[side === 'left' ? 'l' : 'r'] = v;
    const now = performance.now();
    const other = side === 'left' ? st.r : st.l;
    if (closed(v) && !closed(prev) && closed(other) && now - st.lastBloom > 400) {
      st.lastBloom = now; params.firePulse('bloom');
    }
  };
  signals.on('hand/left/pinch/index', watch('left'));
  signals.on('hand/right/pinch/index', watch('right'));
  // left fist = index AND middle both closed → cycle the pattern family
  signals.on('hand/left/pinch/middle', (v) => {
    const now = performance.now();
    if (v <= 0.25 && closed(st.l) && now - st.lastPat > 900) { st.lastPat = now; params.firePulse('nextPattern'); }
  });
}
