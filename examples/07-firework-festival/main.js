// 07 · firework festival — "210807 Firework 花火大會" (Che-Yu Wu, 2021),
// integrated as a demo.
//
// The 2021 original used ml5 PoseNet wrists to launch fireworks on a timer.
// Five years later the pipeline is a framework: the hand tracker (L1) reads
// 21 landmarks — CLOSE a pinch to launch a firework AT that hand, pinch
// distance sets the shell size. The particle system and its curves are the
// 2021 code, ported; the firework sample is the artist's original asset.
//
// artwork © Che-Yu Wu 吳哲宇, 2021 — demo purpose, all rights reserved.

import { createShow } from '@openav/show';
import { createCanvas } from '@openav/stage';

// — the 2021 particle, ported from p5 global mode to plain canvas —
class Particle {
  constructor(args) {
    Object.assign(this, {
      x: 0, y: 0, vx: 0, vy: 0, ax: 0, ay: 0.08,
      hue: 0, endHue: 60, r: 10,
      curve: Math.random() * 5, curveFreq: 2 + Math.random() * 38,
      rFadeRatio: 0.88 + Math.random() * 0.11,
      life: 0,
    }, args);
  }
  update(dt) {
    this.vx += this.ax; this.vy += this.ay;
    this.x += this.vx + Math.sin(this.life * this.curveFreq) * this.curve * 0.3;
    this.y += this.vy;
    this.r *= this.rFadeRatio;
    this.life += dt;
  }
  draw(ctx) {
    const k = Math.min(1, this.life * 1.5);
    const hue = this.hue + (this.endHue - this.hue) * k;
    ctx.fillStyle = `hsla(${hue % 360}, 95%, ${65 - k * 25}%, ${Math.min(1, this.r / 4)})`;
    ctx.beginPath(); ctx.arc(this.x, this.y, Math.max(0.4, this.r), 0, 6.2832); ctx.fill();
  }
}

const fireworkWorld = {
  name: 'firework-festival',
  params: [
    { key: 'size',    label: 'Shell size', min: 0.5, max: 10,  def: 4 },
    { key: 'richness',label: 'Richness',   min: 30,  max: 220, def: 110, step: 1 },
    { key: 'gravity', label: 'Gravity',    min: 0.02,max: 0.2, def: 0.08 },
    { key: 'launch',  label: 'Launch!',    pulse: true },
  ],
  init({ container, signals, params }) {
    this.view = createCanvas(container);
    this.parts = [];
    this.sound = new Audio('./firework.mp3');       // the artist's 2021 sample
    const world = this;
    this.fire = (x, y, sizeMul = 1) => {
      const { w, h } = world.view.fit();
      try { world.sound.currentTime = 0; world.sound.volume = 0.2 + Math.random() * 0.3; world.sound.play().catch(() => {}); } catch (e) {}
      const s = world.s || {};
      const baseHue = Math.random() * 300;
      const count = (s.richness ?? 110) * (0.6 + Math.random() * 0.7);
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = (Math.random() * 2 + Math.random() * (s.size ?? 4) * sizeMul);
        world.parts.push(new Particle({
          x: x ?? w / 2, y: y ?? h / 2,
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          ay: s.gravity ?? 0.08,
          r: 2 + Math.random() * 20,
          hue: (baseHue + Math.random() * 120) % 360,
          endHue: (baseHue + 120 + Math.random() * 120) % 360,
        }));
      }
      if (world.parts.length > 9000) world.parts.splice(0, world.parts.length - 9000);
    };
    this._unsubs = [
      params.onPulse('launch', () => this.fire()),
      // pinch-close = a launch AT that hand; pinch value rides through as size
      signals.on('hand/left/pinch/index', (v) => this._pinchEdge('l', v, signals)),
      signals.on('hand/right/pinch/index', (v) => this._pinchEdge('r', v, signals)),
      signals.on('midi/note/on', ({ vel }) => {           // piano also launches (no camera needed)
        const { w, h } = this.view.fit();
        this.fire(Math.random() * w, h * (0.2 + Math.random() * 0.4), 0.5 + (vel ?? 0.8));
      }),
    ];
    this._pinch = { l: 1, r: 1 };
  },
  _pinchEdge(side, v, signals) {
    const prev = this._pinch[side];
    this._pinch[side] = v;
    if (prev > 0.35 && v <= 0.35) {                       // closing edge = launch
      const { w, h } = this.view.fit();
      const hand = side === 'l' ? 'left' : 'right';
      const x = (signals.get(`hand/${hand}/x`) ?? 0.5) * w;
      const y = (1 - (signals.get(`hand/${hand}/y`) ?? 0.5)) * h;
      this.fire(x, y, 0.6 + (signals.get(`hand/${hand}/pinch/middle`) ?? 0.5) * 2);
    }
  },
  update(dt, s) {
    this.s = s;
    for (const p of this.parts) { p.ay = s.gravity ?? 0.08; p.update(dt); }
    const { h } = this.view.fit();
    this.parts = this.parts.filter(p => p.y < h + 20 && p.r > 0.01);
  },
  render() {
    const { ctx } = this.view, { w, h } = this.view.fit();
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'screen';
    for (const p of this.parts) p.draw(ctx);
    ctx.globalCompositeOperation = 'source-over';
    const { hands } = window.openav || {};
    if (hands?.running) hands.skeleton(ctx, w, h, { lineWidth: 1.5 });
  },
  dispose() { this._unsubs?.forEach(u => u()); this.view.dispose(); },
};

await createShow({
  world: fireworkWorld,
  timeline: {
    total: 120,
    automation: { gravity: [[0, 0.08], [60, 0.05], [120, 0.12]] },
    scenes: [
      { id: 'dusk',   t: 0,  title: 'Dusk',    note: 'enable 🖐 hands · pinch to launch' },
      { id: 'peak',   t: 45, title: 'Peak',    note: 'both hands · full sky' },
      { id: 'finale', t: 90, title: 'Finale',  note: 'everything at once' },
    ],
  },
  modules: { keys: { base: 48 }, hands: true, sound: false },
  artwork: { title: '210807 Firework 花火大會', artist: 'Che-Yu Wu 吳哲宇', year: 2021,
             note: 'PoseNet-era interactive sketch (incl. the firework sample), integrated as a demo — all rights reserved' },
  hint: 'enable 🖐 hands in L1 · Input — CLOSE thumb↔index to launch at that hand,<br>thumb↔middle sets the shell size · the piano launches too (no camera needed)',
});
