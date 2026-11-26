// 03b · palm bloom — an extension of 03 (hand instrument).
//
// Open your hand and a flower opens on your palm; close it and the flower folds
// back into a bud. Two hands, two flowers.
//
//   hand → (this file, onFrame) → hand/<side>/open, hand/<side>/palm/x .y .size .angle
//        → routes → params bloomL / bloomR → the world draws the flowers
//
// The tracker gives 21 landmarks per hand but only publishes pinches. "How open is
// this hand" is one line of geometry more, so the assembly computes it and publishes
// it as ordinary signals. From there it is the same as 03: a route reaches a param,
// and the world never reads the hand for the bloom itself.

import { createShow } from '@openav/show';
import { createCanvas } from '@openav/stage';

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (v) => { v = clamp(v); return v * v * (3 - 2 * v); };
const lerp = (a, b, k) => a + (b - a) * k;
const angDiff = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));   // shortest turn a → b

const CHIME = { left: [67, 71, 74, 79, 83], right: [72, 76, 79, 84, 88] };

const palmBloom = {
  name: 'palm-bloom',
  params: [
    { key: 'bloomL',  label: 'Bloom left (L open)',   min: 0, max: 1, def: 0 },
    { key: 'bloomR',  label: 'Bloom right (R open)',  min: 0, max: 1, def: 0 },
    { key: 'petals',  label: 'Petals',     min: 4, max: 13, def: 6, step: 1 },
    { key: 'size',    label: 'Flower size', min: 0.5, max: 3, def: 1.25 },
    { key: 'hueL',    label: 'Hue left',   min: 0, max: 360, def: 330 },
    { key: 'hueR',    label: 'Hue right',  min: 0, max: 360, def: 38 },
    { key: 'video',   label: 'Camera',     min: 0, max: 1, def: 0.45 },
    { key: 'pollen',  label: 'Pollen',     min: 0, max: 1, def: 0.6 },
    { key: 'burst',   label: 'Burst!',     pulse: true },
  ],
  init({ container, signals, params }) {
    this.view = createCanvas(container);
    this.t = 0;
    this.s = {};
    this.flowers = {
      left:  { x: 0.3, y: 0.5, size: 0.12, angle: -Math.PI / 2, alpha: 0, armed: true, lastB: 0 },
      right: { x: 0.7, y: 0.5, size: 0.12, angle: -Math.PI / 2, alpha: 0, armed: true, lastB: 0 },
    };
    this.bits = [];          // pollen + flying petals
    this.mouse = { x: 0.5, y: 0.5, down: 0, b: 0, kick: 0 };
    const el = this.view.canvas || container;
    const move = (e) => { const r = el.getBoundingClientRect(); this.mouse.x = (e.clientX - r.left) / r.width; this.mouse.y = (e.clientY - r.top) / r.height; };
    const down = (e) => { move(e); this.mouse.down = 1; };
    const up = () => { this.mouse.down = 0; };
    el.addEventListener('pointermove', move); el.addEventListener('pointerdown', down); window.addEventListener('pointerup', up);
    this._unsubs = [
      () => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerdown', down); window.removeEventListener('pointerup', up); },
      params.onPulse('burst', () => { for (const side of ['left', 'right']) this.burst(side, 1); }),
      signals.on('midi/note/on', ({ note }) => {         // piano without a camera: each note changes the species and pops the flower open
        if (this._selfNote) return;
        params.override('petals', 4 + (note % 10));
        this.mouse.kick = 1;
      }),
    ];
  },

  // a flower that has just opened throws petals and pollen, and rings a note
  burst(side, strength = 1) {
    const f = this.flowers[side], s = this.s, { w, h } = this.view.fit();
    const x = f.x * w, y = f.y * h, R = f.size * h * (s.size ?? 1.6);
    const hue = side === 'left' ? s.hueL ?? 330 : s.hueR ?? 38;
    for (let i = 0; i < 26 * strength; i++) {
      const a = Math.random() * Math.PI * 2, sp = 60 + Math.random() * 220;
      this.bits.push({ kind: 'petal', x: x + Math.cos(a) * R * 0.4, y: y + Math.sin(a) * R * 0.4, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60,
        rot: a, vr: (Math.random() - 0.5) * 6, size: R * (0.12 + Math.random() * 0.12), life: 1, hue: hue + (Math.random() - 0.5) * 30 });
    }
    for (let i = 0; i < 40 * strength; i++) {
      const a = Math.random() * Math.PI * 2, sp = 20 + Math.random() * 120;
      this.bits.push({ kind: 'pollen', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, hue: 48 + Math.random() * 20, size: 1.5 + Math.random() * 2 });
    }
    if (this.bits.length > 1400) this.bits.splice(0, this.bits.length - 1400);
    const sig = window.openav?.signals;
    if (sig) {
      const notes = CHIME[side], note = notes[Math.floor(Math.random() * notes.length)];
      this._selfNote = true; sig.pulse('midi/note/on', { note, vel: 0.55, ch: 0 }); this._selfNote = false;
      setTimeout(() => sig.pulse('midi/note/off', { note, ch: 0 }), 600);
    }
  },

  update(dt, s) {
    this.s = s; this.t += dt;
    const sig = window.openav?.signals, hands = window.openav?.hands;
    const k = 1 - Math.exp(-dt * 16);
    const m = this.mouse;
    m.b = lerp(m.b, m.down, 1 - Math.exp(-dt * 4));
    m.kick = Math.max(0, m.kick - dt * 0.8);

    for (const side of ['left', 'right']) {
      const f = this.flowers[side];
      const present = hands?.running && sig?.get(`hand/${side}/present`);
      if (present) {
        f.x = lerp(f.x, sig.get(`hand/${side}/palm/x`) ?? f.x, k);
        f.y = lerp(f.y, 1 - (sig.get(`hand/${side}/palm/y`) ?? 1 - f.y), k);
        f.size = lerp(f.size, sig.get(`hand/${side}/palm/size`) ?? f.size, k);
        f.angle += angDiff(f.angle, sig.get(`hand/${side}/palm/angle`) ?? f.angle) * k;
      } else if (side === 'right' && !hands?.running) {   // no camera: the flower follows the pointer, press to open
        f.x = lerp(f.x, m.x, k); f.y = lerp(f.y, m.y, k);
        f.size = lerp(f.size, 0.16, k); f.angle += angDiff(f.angle, -Math.PI / 2) * k;
      }
      const show = present || (side === 'right' && !hands?.running);
      f.alpha = lerp(f.alpha, show ? 1 : 0, 1 - Math.exp(-dt * 6));
      f.b = this.bloomOf(side);
      // a moment, not a level: closed (< .3) then open (> .8) = it just bloomed
      if (f.b < 0.3) f.armed = true;
      if (f.armed && f.b > 0.8 && f.alpha > 0.5) { f.armed = false; this.burst(side, 1); }
      // a fully open flower breathes pollen
      if (f.alpha > 0.5 && f.b > 0.6 && Math.random() < (s.pollen ?? 0.6) * f.b * 0.9) {
        const { h } = this.view.fit(), R = f.size * h * (s.size ?? 1.6);
        const a = Math.random() * Math.PI * 2;
        this.bits.push({ kind: 'pollen', x: f.x * this.view.fit().w + Math.cos(a) * R * 0.12, y: f.y * h + Math.sin(a) * R * 0.12,
          vx: (Math.random() - 0.5) * 30, vy: -20 - Math.random() * 50, life: 1, hue: 45 + Math.random() * 25, size: 1 + Math.random() * 2 });
      }
    }
    for (const p of this.bits) {
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.kind === 'petal') { p.vy += 140 * dt; p.vx *= 0.97; p.vy *= 0.97; p.rot += p.vr * dt; p.life -= dt * 0.45; }
      else { p.vx += Math.sin(this.t * 2 + p.y * 0.02) * 10 * dt; p.vx *= 0.98; p.vy *= 0.985; p.life -= dt * 0.5; }
    }
    this.bits = this.bits.filter((p) => p.life > 0);
  },

  bloomOf(side) {
    const s = this.s, m = this.mouse;
    const b = side === 'left' ? s.bloomL ?? 0 : s.bloomR ?? 0;
    if (side === 'right' && !window.openav?.hands?.running) return clamp(Math.max(b, m.b, smooth(m.kick)));
    return clamp(b);
  },

  render() {
    const { ctx } = this.view, { w, h } = this.view.fit(), s = this.s || {};
    ctx.fillStyle = '#05060c';
    ctx.fillRect(0, 0, w, h);

    // your hand, so the flower is ON it: the camera, mirrored, stretched the way the skeleton is
    const hands = window.openav?.hands;
    if (hands?.running && hands.video?.readyState >= 2 && (s.video ?? 0) > 0.01) {
      ctx.save();
      ctx.globalAlpha = s.video;
      if (hands.mirror) { ctx.translate(w, 0); ctx.scale(-1, 1); }
      ctx.drawImage(hands.video, 0, 0, w, h);
      ctx.restore();
      ctx.fillStyle = `rgba(5,6,12,${0.25 * s.video})`; ctx.fillRect(0, 0, w, h);
    }

    // flowers sit under the falling petals
    for (const side of ['left', 'right']) {
      const f = this.flowers[side];
      if (f.alpha < 0.01) continue;
      const R = f.size * h * (s.size ?? 1.6);
      drawFlower(ctx, f.x * w, f.y * h, R, f.angle, f.b ?? 0, side === 'left' ? s.hueL ?? 330 : s.hueR ?? 38,
        this.t, Math.round(s.petals ?? 6), f.alpha);
    }

    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.bits) {
      if (p.kind === 'pollen') {
        ctx.fillStyle = `hsla(${p.hue}, 95%, 70%, ${p.life * 0.9})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, 6.2832); ctx.fill();
      }
    }
    ctx.globalCompositeOperation = 'source-over';
    for (const p of this.bits) {
      if (p.kind !== 'petal') continue;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.globalAlpha = Math.min(1, p.life * 1.4);
      petalPath(ctx, p.size, p.size * 0.45);
      ctx.fillStyle = `hsl(${p.hue}, 80%, 66%)`; ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;

    if (hands?.running) hands.skeleton(ctx, w, h, { lineWidth: 1, colorLeft: 'rgba(255,255,255,.18)', colorRight: 'rgba(255,255,255,.18)' });

    // the instrument, visible: how open each hand is
    const sig = window.openav?.signals;
    ctx.font = '12px ui-monospace, monospace';
    ctx.fillStyle = 'rgba(160,170,190,.85)';
    ctx.fillText(hands?.running ? '張開手 → 花開 · 握拳 → 收成花苞' : '開 🖐 hands，或按住滑鼠讓花打開', 14, 22);
    if (hands?.running) {
      ['left', 'right'].forEach((side, i) => {
        if (!sig.get(`hand/${side}/present`)) return;
        const o = sig.get(`hand/${side}/open`) ?? 0;
        ctx.fillText(`${side.padEnd(5)} open ${'▮'.repeat(Math.round(o * 10)).padEnd(10, '·')} ${o.toFixed(2)}`, 14, 42 + i * 16);
      });
    }
  },
  dispose() { this._unsubs?.forEach((u) => u()); this.view.dispose(); },
};

// one petal pointing along +x, base at the origin
function petalPath(ctx, L, W) {
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(L * 0.25, -W * 1.1, L * 0.8, -W * 0.9, L, 0);
  ctx.bezierCurveTo(L * 0.8, W * 0.9, L * 0.25, W * 1.1, 0, 0);
  ctx.closePath();
}

// b = 0: a closed bud pointing the way the fingers point; b = 1: a flower open flat on the palm.
// Outer petals open first, inner ones later, the way a real bloom does.
function drawFlower(ctx, x, y, R, up, b, hue, t, n, alpha) {
  const layers = [
    { n,     len: 1.0,  wid: 0.40, off: 0,             dh: 0,   light: 60, delay: 0.00, fan: 0.55 },
    { n,     len: 0.78, wid: 0.36, off: Math.PI / n,   dh: -14, light: 68, delay: 0.15, fan: 0.40 },
    { n: n + 2, len: 0.52, wid: 0.30, off: 0.3,        dh: -28, light: 78, delay: 0.32, fan: 0.25 },
  ];
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha = alpha;
  const scale = 0.7 + 0.3 * smooth(b);

  // a soft glow under the open flower
  if (b > 0.05) {
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 1.4);
    g.addColorStop(0, `hsla(${hue}, 90%, 65%, ${0.28 * b})`);
    g.addColorStop(1, `hsla(${hue}, 90%, 50%, 0)`);
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R * 1.4, 0, 6.2832); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }

  for (const L of layers) {
    const e = smooth((b - L.delay) / (1 - L.delay - 0.08));
    for (let i = 0; i < L.n; i++) {
      const closedA = up + (L.n > 1 ? (i / (L.n - 1) - 0.5) : 0) * L.fan;
      const openA = up + L.off + (i / L.n) * Math.PI * 2 + Math.sin(t * 0.9 + i * 1.7) * 0.04 * e;
      const a = closedA + angDiff(closedA, openA) * e;
      const len = R * L.len * scale * (0.6 + 0.4 * e) * (1 + Math.sin(t * 1.3 + i) * 0.02);
      const wid = R * L.wid * scale * (0.42 + 0.58 * e);
      ctx.save();
      ctx.rotate(a);
      petalPath(ctx, len, wid);
      const g = ctx.createLinearGradient(0, 0, len, 0);
      g.addColorStop(0, `hsla(${hue + L.dh - 20}, 70%, ${22 + 10 * e}%, 0.96)`);
      g.addColorStop(0.55, `hsla(${hue + L.dh}, 82%, ${L.light - 8}%, 0.96)`);
      g.addColorStop(1, `hsla(${hue + L.dh + 12}, 95%, ${L.light + 10}%, 0.96)`);
      ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = `hsla(${hue + L.dh + 10}, 90%, 88%, ${0.25 + 0.35 * e})`;
      ctx.lineWidth = 1; ctx.stroke();
      ctx.strokeStyle = `hsla(${hue + L.dh}, 60%, 92%, ${0.18 * e})`;   // the vein
      ctx.beginPath(); ctx.moveTo(len * 0.08, 0); ctx.lineTo(len * 0.85, 0); ctx.stroke();
      ctx.restore();
    }
  }

  // the heart: stamens come out last
  const e = smooth((b - 0.45) / 0.5);
  if (e > 0.01) {
    const m = 14;
    for (let i = 0; i < m; i++) {
      const a = (i / m) * Math.PI * 2 + t * 0.2;
      const l = R * 0.24 * e * (0.8 + 0.2 * Math.sin(i * 2.3));
      ctx.strokeStyle = `hsla(${hue + 30}, 70%, 80%, ${0.7 * e})`; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * l, Math.sin(a) * l); ctx.stroke();
      ctx.fillStyle = `hsla(48, 100%, 70%, ${e})`;
      ctx.beginPath(); ctx.arc(Math.cos(a) * l, Math.sin(a) * l, 1.6 + R * 0.012, 0, 6.2832); ctx.fill();
    }
  }
  const c = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 0.12);
  c.addColorStop(0, `hsla(50, 100%, 78%, ${0.4 + 0.6 * e})`);
  c.addColorStop(1, `hsla(${hue}, 80%, 35%, ${0.2 + 0.6 * e})`);
  ctx.fillStyle = c; ctx.beginPath(); ctx.arc(0, 0, R * 0.12 * (0.5 + 0.5 * smooth(b)), 0, 6.2832); ctx.fill();
  ctx.restore();
}

// how open is a hand: fingertips' distance from the wrist, in palm lengths.
// A fist sits near 1, a hand spread wide near 2. Aspect-corrected (the camera is 16:9).
const ASPECT = 16 / 9;
function handOpenness(lm) {
  const d = (a, b) => Math.hypot((lm[a].x - lm[b].x) * ASPECT, lm[a].y - lm[b].y);
  const palm = d(0, 9) || 0.1;
  const tips = [8, 12, 16, 20].map((i) => d(i, 0) / palm);
  const r = tips.reduce((a, v) => a + v, 0) / tips.length;
  return clamp((r - 1.15) / 0.7);
}

const show = await createShow({
  world: palmBloom,
  timeline: {
    total: 90,
    automation: { hueR: [[0, 38], [30, 12], [60, 200], [90, 38]], hueL: [[0, 330], [30, 280], [60, 150], [90, 330]] },
    scenes: [
      { id: 'bud',   t: 0,  title: 'Bud',   note: 'enable 🖐 hands · make a fist: a bud sits on your palm' },
      { id: 'bloom', t: 30, title: 'Bloom', note: 'open your hand slowly: outer petals first, then the heart' },
      { id: 'pair',  t: 60, title: 'Pair',  note: 'two hands, two flowers · snap them open together' },
    ],
  },
  // the same idea as 03: a gesture reaches a param through a route
  routes: [
    { source: 'hand/left/open',  target: 'bloomL', curve: 'smooth', smooth: 0.25 },
    { source: 'hand/right/open', target: 'bloomR', curve: 'smooth', smooth: 0.25 },
  ],
  modules: { keys: { base: 60 }, hands: true, sound: true },
  // assembly-layer logic: derive "open" and the palm's place from the 21 landmarks, publish as signals
  onFrame(dt, show) {
    const { hands, signals } = show;
    if (!hands?.running) return;
    for (const { handed, lm } of hands.hands) {
      const X = (p) => (hands.mirror ? 1 - p.x : p.x);
      const ids = [0, 5, 9, 13, 17];
      const cx = ids.reduce((a, i) => a + X(lm[i]), 0) / ids.length;
      const cy = ids.reduce((a, i) => a + lm[i].y, 0) / ids.length;
      const size = Math.hypot((lm[0].x - lm[9].x) * ASPECT, lm[0].y - lm[9].y);
      // wrist → middle knuckle, in screen space (x mirrored, aspect restored)
      const angle = Math.atan2(lm[9].y - lm[0].y, (X(lm[9]) - X(lm[0])) * ASPECT);
      signals.set(`hand/${handed}/open`, handOpenness(lm));
      signals.set(`hand/${handed}/palm/x`, cx);
      signals.set(`hand/${handed}/palm/y`, 1 - cy);
      signals.set(`hand/${handed}/palm/size`, size);
      signals.set(`hand/${handed}/palm/angle`, angle);
    }
  },
  hint: '🖐 hands in L1 · Input — open a hand: the flower on it opens · close it: back to a bud<br>two hands, two flowers · no camera? hold the mouse down · piano changes the species',
});

for (const side of ['left', 'right']) {
  show.signals.define(`hand/${side}/open`, { source: 'hand', description: 'how open the hand is: 0 fist, 1 spread wide' });
  for (const k of ['x', 'y', 'size']) show.signals.define(`hand/${side}/palm/${k}`, { source: 'hand' });
  show.signals.define(`hand/${side}/palm/angle`, { source: 'hand', min: -Math.PI, max: Math.PI, unit: 'rad' });
}
