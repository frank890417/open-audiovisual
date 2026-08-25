// 02 · chord garden — performance semantics in action.
//
// Lineage: The Last Input (IRCAM 2026) — "harmony as fertility":
//   single note      → a seed falls
//   consonant triad  → the garden BLOOMS (stacked thirds = genuine blessing)
//   mild dissonance  → wind and unrest
//   cluster          → DECAY spreads (dissonance is fuel, not failure)
//
// The world listens to chord/* signals — it has no idea whether a pianist,
// a sequencer, or a QWERTY keyboard is playing. That's the layer contract.

import { createShow } from '@openav/show';
import { createCanvas } from '@openav/stage';

// ---------- world ----------
const gardenWorld = {
  name: 'garden',
  params: [
    { key: 'growth',   label: 'Growth rate', min: 0,   max: 2,   def: 1 },
    { key: 'wind',     label: 'Wind',        min: 0,   max: 1,   def: 0.1 },
    { key: 'decay',    label: 'Decay press', min: 0,   max: 1,   def: 0 },
    { key: 'paletteShift', label: 'Palette', min: 0,   max: 360, def: 110 },
  ],
  init({ container, signals }) {
    this.view = createCanvas(container);
    this.plants = [];   // {x, h, maxH, sway, hue, decay 0..1}
    this.spores = [];   // decay particles
    this._unsub = signals.on('chord/event', (a) => this.onChord(a));
  },
  onChord(a) {
    const { w, h } = this.view.fit();
    if (a.count === 1) {
      this.sow(Math.random() * w, 30 + Math.random() * 60, a.root);
    } else if (a.isTriad && a.thirdsFraction > 0.5) {
      // genuine stacked thirds → bloom: many strong plants
      for (let i = 0; i < 8; i++) this.sow(Math.random() * w, 90 + Math.random() * 160, a.root, true);
    } else if (a.dissonanceLevel === 2) {
      // cluster → decay wave
      for (const p of this.plants) p.decay = Math.min(1, p.decay + 0.5 + Math.random() * 0.4);
      for (let i = 0; i < 90; i++)
        this.spores.push({ x: Math.random() * w, y: h - Math.random() * 200, vx: (Math.random() - .5) * 2, vy: -Math.random() * 1.5, life: 1 });
    } else if (a.dissonanceLevel === 1) {
      this._gust = 1;   // storm warning: wind gust
    } else if (a.isConsonant) {
      for (let i = 0; i < 3; i++) this.sow(Math.random() * w, 60 + Math.random() * 90, a.root);
    }
  },
  sow(x, maxH, root = 60, blessed = false) {
    this.plants.push({ x, h: 2, maxH, sway: Math.random() * Math.PI * 2, root, decay: 0, blessed });
    if (this.plants.length > 400) this.plants.splice(0, this.plants.length - 400);
  },
  update(dt, s) {
    this.s = s;
    this._gust = Math.max(0, (this._gust || 0) - dt * 0.5);
    for (const p of this.plants) {
      if (p.decay > 0) { p.h -= 30 * dt * p.decay; p.decay = Math.min(1, p.decay + dt * 0.1); }
      else p.h = Math.min(p.maxH, p.h + (10 + p.maxH * 0.25) * dt * s.growth);
      p.sway += dt * (1 + (s.wind + this._gust) * 6);
    }
    this.plants = this.plants.filter(p => p.h > 1);
    for (const sp of this.spores) { sp.x += sp.vx; sp.y += sp.vy; sp.life -= dt * 0.5; }
    this.spores = this.spores.filter(sp => sp.life > 0);
    // param-driven decay pressure (mappable to a knob / hand / timeline)
    if (s.decay > 0.02) for (const p of this.plants) if (Math.random() < s.decay * dt) p.decay = Math.max(p.decay, 0.2);
  },
  render() {
    const { ctx } = this.view, { w, h } = this.view.fit(), s = this.s || {};
    ctx.fillStyle = 'rgba(2,4,8,0.25)';
    ctx.fillRect(0, 0, w, h);
    const windAmp = (s.wind + (this._gust || 0)) * 18;
    for (const p of this.plants) {
      const hue = (s.paletteShift + (p.root % 12) * 12) % 360;
      const sway = Math.sin(p.sway) * windAmp * (p.h / p.maxH);
      const alive = 1 - p.decay;
      ctx.strokeStyle = p.decay > 0
        ? `hsla(30, 40%, ${25 * alive + 8}%, ${0.5 + alive * 0.4})`
        : `hsla(${hue}, ${p.blessed ? 90 : 60}%, ${p.blessed ? 62 : 45}%, 0.9)`;
      ctx.lineWidth = p.blessed ? 2.4 : 1.4;
      ctx.beginPath();
      ctx.moveTo(p.x, h);
      ctx.quadraticCurveTo(p.x + sway * 0.4, h - p.h * 0.6, p.x + sway, h - p.h);
      ctx.stroke();
      if (p.blessed && p.decay === 0 && p.h > p.maxH * 0.9) {
        ctx.fillStyle = `hsla(${(hue + 40) % 360}, 95%, 70%, 0.9)`;
        ctx.beginPath(); ctx.arc(p.x + sway, h - p.h, 3.2, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.fillStyle = 'rgba(180,140,90,0.5)';
    for (const sp of this.spores) { ctx.fillRect(sp.x, sp.y, 2, 2); }
  },
  dispose() { this._unsub?.(); this.view.dispose(); },
};

// ---------- assembly ----------
await createShow({
  world: gardenWorld,
  timeline: {
    total: 120,
    automation: {
      growth: [[0, 0.6], [40, 1.4], [90, 0.8], [120, 0.2]],
      wind:   [[0, 0.05], [60, 0.3], [100, 0.7], [120, 0.1]],
    },
    scenes: [
      { id: 'dawn',  t: 0,   title: 'Dawn',       note: 'single seeds · listen' },
      { id: 'bloom', t: 40,  title: 'Full bloom', note: 'triads — stack real thirds' },
      { id: 'storm', t: 90,  title: 'Storm',      note: 'clusters welcome · decay is material' },
      { id: 'after', t: 110, title: 'After',      note: 'let it settle' },
    ],
  },
  modules: { keys: { base: 48 }, chord: true, sound: true },
  hint: 'play a TRIAD → bloom · a CLUSTER (adjacent keys) → decay<br>use the piano, tick "keyboard" for QWERTY (Z/X octave), or let it simulate a performance',
});
