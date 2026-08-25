// 01 · hello particles — the smallest complete open-audiovisual app.
//
// A World (the only part you write) + one createShow() call. The factory
// assembles the whole shell — inputs, mapping, timeline, layer-aligned side
// panel, sound module, backstage feed — so every show evolves together.

import { createShow } from '@openav/show';
import { createCanvas } from '@openav/stage';

const particlesWorld = {
  name: 'particles',
  params: [
    { key: 'gravity',  label: 'Gravity',  min: -0.5, max: 1.5, def: 0.35 },
    { key: 'drag',     label: 'Drag',     min: 0.85, max: 1.0, def: 0.985 },
    { key: 'hue',      label: 'Hue',      min: 0,    max: 360, def: 205 },
    { key: 'size',     label: 'Size',     min: 1,    max: 14,  def: 4 },
    { key: 'trail',    label: 'Trail',    min: 0.02, max: 0.5, def: 0.12 },
    { key: 'burst',    label: 'Burst!',   pulse: true },
  ],
  init({ container, signals, params }) {
    this.view = createCanvas(container);
    this.parts = [];
    this._unsubs = [
      params.onPulse('burst', () => this.spawn(innerWidth / 3, innerHeight / 3, 60, 60)),
      signals.on('midi/note/on', ({ note, vel }) => {
        const { w, h } = this.view.fit();
        const x = ((note - 36) / 48) * w;
        this.spawn(Math.max(0, Math.min(w, x)), h * 0.65, 6 + Math.round(vel * 40), (note % 12) * 30);
      }),
    ];
  },
  spawn(x, y, n, hueShift = 0) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = 2 + Math.random() * 7;
      this.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 3, life: 1, hs: hueShift });
    }
    if (this.parts.length > 6000) this.parts.splice(0, this.parts.length - 6000);
  },
  update(dt, s) {
    this.s = s;
    for (const p of this.parts) {
      p.vy += s.gravity * 60 * dt * 0.15;
      p.vx *= s.drag; p.vy *= s.drag;
      p.x += p.vx; p.y += p.vy;
      p.life -= dt * 0.4;
    }
    this.parts = this.parts.filter(p => p.life > 0);
  },
  render() {
    const { ctx } = this.view, { w, h } = this.view.fit(), s = this.s || {};
    ctx.fillStyle = `rgba(0,0,0,${s.trail ?? 0.12})`;
    ctx.fillRect(0, 0, w, h);
    for (const p of this.parts) {
      ctx.fillStyle = `hsla(${(s.hue + p.hs) % 360}, 90%, ${40 + p.life * 40}%, ${p.life})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, (s.size ?? 4) * p.life, 0, Math.PI * 2);
      ctx.fill();
    }
  },
  dispose() { this._unsubs?.forEach(u => u()); this.view.dispose(); },
};

await createShow({
  world: particlesWorld,
  timeline: {
    total: 60,
    automation: {
      gravity: [[0, 0.35], [20, 0.35], [30, -0.2], [45, 1.2], [60, 0.35]],
      hue:     [[0, 205], [30, 320], [60, 40]],
    },
    scenes: [
      { id: 'calm',  t: 0,  title: 'Calm',   note: 'sparse single notes' },
      { id: 'rise',  t: 20, title: 'Rising', note: 'build clusters' },
      { id: 'zerog', t: 30, title: 'Zero G', note: 'gravity flips — float' },
      { id: 'storm', t: 45, title: 'Storm',  note: 'heavy — full keyboard' },
    ],
  },
  modules: { keys: { base: 48 }, sound: true },
  hint: 'play the piano (tick "keyboard" for QWERTY, or "simulate performance") · Space play · T performance mode',
});
