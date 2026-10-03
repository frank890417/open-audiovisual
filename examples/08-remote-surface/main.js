// 08 · remote surface — the phone is the instrument panel, and nobody drew it.
//
// This World declares `params` (what it can be performed WITH) and one event
// reaction. That is all. `modules: { remote: true }` does the rest:
//
//   • the show page joins the relay as the room's runner and prints a URL;
//   • a phone/iPad opens it → tabs 感測 · 琴鍵 · 控制台;
//   • the 控制台 page is autoSurface(world.params): fader/knob/radio/toggle/xy/
//     button chosen from each param's declaration — no layout file;
//   • their signals (surface/main/…) are routed to params by the Mapper, exactly
//     like a MIDI knob would be (AGENTS.md rule #1: continuous control = params);
//   • param values travel back, so the faders follow the timeline and the meter
//     shows the world breathing;
//   • the 琴鍵 page plays midi/note/on|off — the same events a hardware keyboard
//     sends — and the world reacts to those as EVENTS, not parameters;
//   • the 感測 page's tilt and knock reach params through `phone/any/…` routes.

import { createShow } from '@openav/show';
import { createCanvas } from '@openav/stage';

const SHAPES = ['Circle', 'Petal', 'Star', 'Ring'];

const bloomWorld = {
  name: 'bloom-field',
  params: [
    { key: 'hue',     label: 'Hue',     min: 0,   max: 360, def: 205 },
    { key: 'density', label: 'Density', min: 0,   max: 1,   def: 0.45 },
    { key: 'size',    label: 'Size',    min: 4,   max: 60,  def: 22 },
    { key: 'drift',   label: 'Drift',   min: 0,   max: 2,   def: 0.6 },
    { key: 'glow',    label: 'Glow',    min: 0,   max: 1,   def: 0.5 },
    { key: 'shape',   label: 'Shape',   min: 0,   max: 3,   def: 1, step: 1, options: SHAPES },
    { key: 'mirror',  label: 'Mirror',  min: 0,   max: 1,   def: 0, step: 1 },
    { key: 'cx',      label: 'Source X', min: 0,  max: 1,   def: 0.5 },
    { key: 'cy',      label: 'Source Y', min: 0,  max: 1,   def: 0.7 },
    { key: 'burst',   label: 'Burst',   pulse: true },
  ],
  init({ container, signals, params }) {
    this.view = createCanvas(container);
    this.parts = []; this.acc = 0; this.s = null;
    this._off = [
      params.onPulse('burst', () => this.spray(80, null)),
      // events, not levels: a struck note is a moment (rule #1's other half)
      signals.on('midi/note/on', ({ note, vel }) => this.spray(8 + Math.round(vel * 50), note)),
    ];
  },
  spray(n, note) {
    const s = this.s || { hue: 205, size: 22, cx: .5, cy: .7 };
    const { w, h } = this.view.fit();
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4, sp = 40 + Math.random() * 220;
      this.parts.push({
        x: (note == null ? s.cx : ((note - 36) / 60)) * w, y: s.cy * h,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, spin: (Math.random() - .5) * 4, r: Math.random() * 6,
        hs: note == null ? 0 : (note % 12) * 30,
      });
    }
    if (this.parts.length > 3000) this.parts.splice(0, this.parts.length - 3000);
  },
  update(dt, s) {
    this.s = s;
    this.acc += dt * (4 + s.density * 140);
    while (this.acc >= 1) { this.acc -= 1; this.spray(1, null); }
    for (const p of this.parts) {
      p.vy += (30 - 60 * s.drift) * dt; p.vx += Math.sin(p.life * 6 + p.r) * 20 * s.drift * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.r += p.spin * dt; p.life -= dt * 0.35;
    }
    this.parts = this.parts.filter((p) => p.life > 0);
  },
  render() {
    const { ctx } = this.view, { w, h } = this.view.fit(), s = this.s;
    if (!s) return;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(6,8,14,0.22)'; ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = s.glow > 0.05 ? 'lighter' : 'source-over';
    const draw = (p, flip) => {
      const x = flip ? w - p.x : p.x;
      ctx.save(); ctx.translate(x, p.y); ctx.rotate(p.r);
      const R = s.size * (0.4 + p.life * 0.9);
      ctx.fillStyle = `hsla(${(s.hue + p.hs) % 360},85%,${45 + p.life * 25}%,${0.08 + p.life * 0.3 * (0.3 + s.glow)})`;
      ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 2;
      ctx.beginPath();
      switch (Math.round(s.shape)) {
        case 0: ctx.arc(0, 0, R * 0.6, 0, 7); ctx.fill(); break;
        case 1: ctx.ellipse(0, 0, R * 0.35, R, 0, 0, 7); ctx.fill(); break;
        case 2: for (let k = 0; k < 10; k++) { const rr = k % 2 ? R * 0.35 : R, a = (k / 10) * 6.283; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath(); ctx.fill(); break;
        default: ctx.arc(0, 0, R * 0.7, 0, 7); ctx.stroke();
      }
      ctx.restore();
    };
    for (const p of this.parts) { draw(p, false); if (s.mirror > 0.5) draw(p, true); }
  },
  dispose() { this._off?.forEach((u) => u()); this.view.dispose(); },
};

const show = await createShow({
  world: bloomWorld,
  timeline: {
    total: 60,
    automation: { hue: [[0, 205], [30, 320], [60, 205]] },
    scenes: [{ id: 'calm', t: 0, title: 'Calm' }, { id: 'warm', t: 30, title: 'Warm' }],
  },
  // phone sensors → params, written once at author time: `phone/any/…` is "the latest phone"
  routes: [
    { source: 'phone/any/tilt/x', target: 'drift', inMin: -1, inMax: 1, outMin: 0, outMax: 2, smooth: 0.12 },
    { source: 'phone/any/knock', target: 'burst' },
  ],
  modules: {
    keys: { base: 48 },
    // pairs → one xy pad drives both; meters → also show these params read-only
    remote: { auto: { pairs: [['cx', 'cy']], meters: ['density'] } },
  },
  hint: 'open the phone URL (top-left) · 控制台 = autoSurface(params) · 琴鍵 plays notes · tilt = Drift · knock = Burst · Space plays the timeline',
});

// The show page ITSELF on a phone (no second device): localSensors puts this phone's own tilt and
// knocks into the show's signals — phone/local/…, mirrored to phone/any/… — so the two routes above
// work unchanged. iOS only asks on a tap (and only over HTTPS).
if (typeof DeviceMotionEvent !== 'undefined' && 'ontouchstart' in window) {
  const { localSensors } = await import('@openav/remote');
  const own = localSensors(show.signals);
  const b = Object.assign(document.createElement('button'), { textContent: '📱 this phone' });
  b.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:20;padding:10px 14px;border-radius:10px;border:1px solid #2a3348;background:#12151c;color:#e8ecf4;font:600 14px system-ui';
  b.onclick = async () => { await own.start(); if (!own.denied) b.remove(); };
  document.body.appendChild(b);
}
