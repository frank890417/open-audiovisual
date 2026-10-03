// harmonograph — the homepage's world.
//
// A harmonograph is the pendulum drawing machine that turned musical intervals
// into figures: two pendulums at a 3:2 ratio draw a fifth, a cluster of
// close ratios draws a tangle. Here every held note is one pendulum swinging at
// its pitch ratio (equal temperament, so figures precess instead of closing,
// which is what makes them breathe).
//
// It is an ordinary open-audiovisual World: it reads PARAMS for continuous
// control (hue, twist, order, energy) and subscribes to one EVENT signal
// (midi/note/on|off), exactly as AGENTS.md asks. It has no idea whether the
// notes came from the on-screen keys, QWERTY, the simulated performer or a
// MIDI keyboard; whether `order` came from the chord analyzer or a knob.

import { createCanvas } from '@openav/stage';

const TAU = Math.PI * 2;
const IDLE = [48, 55, 64];                       // C · G · E: a quiet open voicing when nobody plays

export function harmonograph({ reduced = false } = {}) {
  return {
    name: 'harmonograph',
    params: [
      { key: 'hue',    label: 'Hue',    min: 0, max: 360, def: 16 },
      { key: 'twist',  label: 'Twist',  min: 0, max: 1,   def: 0.3 },
      { key: 'order',  label: 'Order',  min: 0, max: 1,   def: 0.85 },
      { key: 'energy', label: 'Energy', min: 0, max: 1,   def: 0.35 },
    ],

    init({ container, signals }) {
      this.view = createCanvas(container, { alpha: true });
      this.voices = [];                          // { note, amp, peak, held, attack, phase }
      this.clock = 0;
      this.idle = IDLE.map((note, i) => ({ note, amp: 0.55, phase: i * 1.7 }));
      this.idleMix = 1;                          // 1 = idle figure fully visible
      this.N = 1500;                             // points per frame; adapts to the device
      this.flash = 0;
      this.s = {};
      this._unsubs = [
        signals.on('midi/note/on', ({ note, vel }) => this.strike(note, vel ?? 0.8)),
        signals.on('midi/note/off', ({ note }) => this.lift(note)),
      ];
    },

    strike(note, vel) {
      let v = this.voices.find((x) => x.note === note);
      if (!v) {
        v = { note, amp: 0, phase: Math.random() * TAU };
        this.voices.push(v);
        if (this.voices.length > 6) this.voices.shift();      // six pendulums is plenty
      }
      v.held = true; v.attack = true; v.peak = 0.35 + 0.65 * vel;
      this.flash = Math.min(1, this.flash + 0.6);
    },
    lift(note) { const v = this.voices.find((x) => x.note === note); if (v) v.held = false; },

    update(dt, state) {
      this.s = state;
      this.clock += dt;
      for (const v of this.voices) {
        if (v.attack) { v.amp += (v.peak - v.amp) * Math.min(1, dt * 28); if (v.amp >= v.peak * 0.96) v.attack = false; }
        else v.amp *= Math.exp(-dt * (v.held ? 0.22 : 1.5));   // held notes sustain, released ones swing down
      }
      this.voices = this.voices.filter((v) => v.attack || v.amp > 0.025);
      const live = this.voices.reduce((a, v) => a + v.amp, 0);
      this.idleMix += ((live > 0.05 ? 0 : 1) - this.idleMix) * Math.min(1, dt * (live > 0.05 ? 6 : 0.8));
      this.flash = Math.max(0, this.flash - dt * 2.2);
    },

    /** One figure = one polyline: Σ pendulums on x, the same pendulums rotated on y. */
    figure(ctx, voices, w, h, alpha, s) {
      if (!voices.length) return;
      const low = Math.min(...voices.map((v) => v.note));
      const tw = (s.twist ?? 0.3), order = (s.order ?? 0.85), energy = (s.energy ?? 0.35);
      const R = Math.min(w * 0.42, h * 0.56) * (0.82 + energy * 0.32 + this.flash * 0.05);
      const cx = w / 2, cy = h / 2;
      const turns = 22, T = TAU * turns, d = 2.6 / T;         // damping across the drawn span
      const precess = this.clock * (reduced ? 0.02 : 0.06 + tw * 0.75);
      const detune = (1 - order) * 0.035;
      const rough = (1 - order) * (1 - order) * 0.16;
      const n = voices.length;
      const r = voices.map((v) => Math.pow(2, (v.note - low) / 12));
      let sum = 0; for (const v of voices) sum += v.amp;
      const norm = 1 / Math.max(0.6, sum);
      const N = this.N;
      ctx.beginPath();
      for (let i = 0; i <= N; i++) {
        const t = (i / N) * T;
        let x = 0, y = 0;
        for (let k = 0; k < n; k++) {
          const v = voices[k], k2 = (k + 1) % n;
          x += v.amp * Math.sin(r[k] * t + v.phase);
          y += v.amp * Math.sin(r[k2] * t * (1 + detune * (k + 1)) + v.phase + Math.PI / 2 + precess * (1 + k * 0.5));
        }
        const e = Math.exp(-d * t) * norm;
        if (rough) { x += rough * Math.sin(t * 13.7 + this.clock * 2.1); y += rough * Math.cos(t * 11.3 - this.clock * 1.7); }
        const px = cx + x * R * e, py = cy + y * R * e;
        if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
      }
      const hue = s.hue ?? 16;
      ctx.strokeStyle = `hsla(${hue}, 92%, ${58 + this.flash * 14}%, ${alpha})`;
      ctx.stroke();
    },

    render() {
      const { ctx } = this.view, { w, h } = this.view.fit();
      const s = this.s;
      const t0 = performance.now();
      // phosphor persistence: the previous frames fade instead of vanishing
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = `rgba(0,0,0,${reduced ? 0.5 : 0.2})`;
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineWidth = 1.05;
      ctx.lineJoin = 'round';
      const energy = s.energy ?? 0.35;
      if (this.idleMix > 0.02) this.figure(ctx, this.idle, w, h, 0.16 * this.idleMix, s);
      if (this.voices.length) this.figure(ctx, this.voices, w, h, 0.28 + energy * 0.42, s);
      ctx.globalCompositeOperation = 'source-over';
      // keep a frame under ~7 ms on whatever this device is
      const ms = performance.now() - t0;
      if (ms > 7 && this.N > 500) this.N = Math.round(this.N * 0.85);
      else if (ms < 3 && this.N < 1800) this.N = Math.round(this.N * 1.05);
    },

    dispose() { this._unsubs?.forEach((u) => u()); this.view?.dispose(); },
  };
}
