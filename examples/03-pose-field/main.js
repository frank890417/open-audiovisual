// 03 · pose field — the body as a controller, now with FINGERS.
//
// Two camera analyzers, both optional, both in the L1 panel:
//   🕺 body  (BlazePose 33) — hand height/spread/speed drive the field
//   🖐 hands (21 landmarks) — per-hand PINCH distances: thumb↔index and
//        thumb↔middle, left and right = four precise continuous controllers
//
// The skeleton overlay draws what the camera sees, so the audience (and you)
// can read the instrument. The world still only reads params — swap the body
// for a knob and nothing inside it changes.

import { createShow } from '@openav/show';
import { createCanvas } from '@openav/stage';

const fieldWorld = {
  name: 'field',
  params: [
    { key: 'energy',  label: 'Energy',      min: 0,   max: 1,   def: 0.2 },
    { key: 'width',   label: 'Field width', min: 0.1, max: 1,   def: 0.5 },
    { key: 'turb',    label: 'Turbulence',  min: 0,   max: 1,   def: 0.1 },
    { key: 'hue',     label: 'Hue',         min: 0,   max: 360, def: 190 },
    { key: 'centerX', label: 'Center X',    min: 0,   max: 1,   def: 0.5 },
    { key: 'glow',    label: 'Glow',        min: 0,   max: 1,   def: 0.3 },
  ],
  init({ container }) {
    this.view = createCanvas(container);
    const { w, h } = this.view.fit();
    this.pts = Array.from({ length: 2200 }, () => ({ x: Math.random() * w, y: Math.random() * h, a: Math.random() * Math.PI * 2 }));
    this.t = 0;
  },
  update(dt, s) {
    this.s = s; this.t += dt;
    const { w, h } = this.view.fit();
    const cx = s.centerX * w;
    for (const p of this.pts) {
      const n = Math.sin(p.x * 0.004 + this.t * (0.3 + s.turb * 2)) + Math.cos(p.y * 0.004 - this.t * 0.2);
      p.a += n * 0.04 * (1 + s.turb * 5) * 60 * dt;
      const sp = (0.4 + s.energy * 3.6) * 60 * dt;
      p.x += Math.cos(p.a) * sp;
      p.y += Math.sin(p.a) * sp;
      const band = s.width * w * 0.5;
      if (Math.abs(p.x - cx) > band) p.a += (p.x > cx ? Math.PI : 0) * 0.02;
      if (p.x < -10) p.x = w + 10; if (p.x > w + 10) p.x = -10;
      if (p.y < -10) p.y = h + 10; if (p.y > h + 10) p.y = -10;
    }
  },
  render() {
    const { ctx } = this.view, { w, h } = this.view.fit(), s = this.s || {};
    ctx.fillStyle = 'rgba(0,0,2,0.14)';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = `hsla(${s.hue}, 85%, ${45 + s.energy * 25}%, ${0.5 + (s.glow ?? 0.3) * 0.5})`;
    for (const p of this.pts) ctx.fillRect(p.x, p.y, 1.6, 1.6);
    // skeleton overlay — draw whichever trackers are running (the instrument, visible)
    const { hands, pose } = window.openav || {};
    if (pose?.running) pose.skeleton(ctx, w, h);
    if (hands?.running) hands.skeleton(ctx, w, h);
  },
  dispose() { this.view.dispose(); },
};

await createShow({
  world: fieldWorld,
  timeline: {
    total: 90,
    automation: { hue: [[0, 190], [45, 290], [90, 30]] },
    scenes: [
      { id: 'enter', t: 0,  title: 'Enter', note: 'enable 🖐 hands (or 🕺 body) in L1 · Input' },
      { id: 'open',  t: 30, title: 'Open',  note: 'arms wide · pinch to shape' },
      { id: 'burn',  t: 60, title: 'Burn',  note: 'move — fast' },
    ],
  },
  // the mapping IS the instrument design — pinches are precise, positions are broad:
  routes: [
    { source: 'hand/right/pinch/index',  target: 'energy',  curve: 'smooth', smooth: 0.12, invert: true },
    { source: 'hand/right/pinch/middle', target: 'turb',    curve: 'exp',    smooth: 0.2,  invert: true },
    { source: 'hand/left/pinch/index',   target: 'glow',    curve: 'smooth', smooth: 0.15, invert: true },
    { source: 'hand/left/pinch/middle',  target: 'width',   curve: 'linear', smooth: 0.25, invert: true },
    { source: 'hand/left/x',             target: 'centerX', smooth: 0.2 },
    // body fallback (enable 🕺 instead of / alongside 🖐):
    { source: 'pose/hand/right/y', target: 'energy', curve: 'smooth', smooth: 0.15 },
    { source: 'pose/hands/spread', target: 'width',  smooth: 0.25 },
  ],
  modules: { keys: false, hands: true, pose: true, sound: true },
  hint: 'enable 🖐 hands in L1 · Input — pinch thumb↔index / thumb↔middle, left & right =<br>four precise controllers · skeleton overlay shows what the camera reads',
});
