// 09 · MIDI controllers — the controller on the desk and the one on the screen are the same object.
//
//   • no hardware: play the on-screen MiniLab 3 (or LPD8, Launchpad, nanoKONTROL2, KeyStep 37,
//     generic layouts) with a mouse, a finger, a pen;
//   • plug a MiniLab 3 in (Chrome/Edge): the on-screen one switches to it and MOVES with your
//     hands — every knob, fader, pad, key and strip, in real time; unknown devices → pick a
//     generic layout and 學習 (learn) fills it in the order you touch your controls;
//   • the work never sees which: controls reach params through `routes` (AGENTS.md rule #1),
//     written by controllerRoutes() — one table per device, all into the SAME params, so a
//     MiniLab knob 1, an LPD8 K1 and a nanoKONTROL2 knob 1 all turn the hue;
//   • `modules.remote` adds a MIDI tab on the phone: the phone becomes the controller for this
//     screen, and the phone's knobs follow the hardware here.
//
// ?view=controller → just the controller, full screen (a virtual MIDI controller page).
// ?profile=<id>    → which device to show first (arturia-minilab3, akai-lpd8, novation-launchpad-mini-mk3,
//                    korg-nanokontrol2, arturia-keystep37, odd-ball, generic-8k8p, generic-8f, generic-16p,
//                    generic-keys25|49|61).

import { createShow } from '@openav/show';
import { createCanvas } from '@openav/stage';
import { Signals } from '@openav/core';
import { Midi, MidiControllers, mountMidiPanel, controllerRoutes, PROFILES, profileById } from '@openav/midi';

const q = new URLSearchParams(location.search);

if (q.get('view') === 'controller') {
  // a page that IS the controller: hardware moves it, fingers play it; signals stay on this page
  // (open the console: window.openav.signals.list())
  document.body.style.cssText = 'margin:0;height:100vh;height:100dvh;background:#0b0d12;overflow:hidden';
  const signals = new Signals();
  const midi = new Midi({ signals }); midi.enable();
  const controllers = new MidiControllers({ profiles: PROFILES, signals, midi, initial: q.get('profile') || 'arturia-minilab3' });
  const panel = mountMidiPanel(document.body, controllers, { mode: 'full' });
  window.openav = { signals, midi, controllers, panel };
} else {
  await main();
}

async function main() {
  // one World, performed by any of the devices
  const garden = {
    name: 'knob-garden',
    params: [
      { key: 'hue',    label: 'Hue',     min: 0,   max: 360, def: 200 },
      { key: 'spread', label: 'Spread',  min: 0.1, max: 1,   def: 0.55 },
      { key: 'spin',   label: 'Spin',    min: -2,  max: 2,   def: 0.3 },
      { key: 'petals', label: 'Petals',  min: 3,   max: 12,  def: 6, step: 1 },
      { key: 'trail',  label: 'Trail',   min: 0,   max: 0.95, def: 0.75 },
      { key: 'size',   label: 'Size',    min: 2,   max: 26,  def: 9 },
      { key: 'wobble', label: 'Wobble',  min: 0,   max: 1,   def: 0.25 },
      { key: 'glow',   label: 'Glow',    min: 0,   max: 1,   def: 0.6 },
      { key: 'density', label: 'Density', min: 1,  max: 24,  def: 10, step: 1 },
      { key: 'speed',  label: 'Speed',   min: 0,   max: 3,   def: 1 },
      { key: 'sat',    label: 'Saturation', min: 0, max: 100, def: 80 },
      { key: 'light',  label: 'Light',   min: 20,  max: 80,  def: 58 },
      { key: 'bend',   label: 'Bend',    min: -1,  max: 1,   def: 0 },
    ],
    init({ container, signals }) {
      this.view = createCanvas(container);
      this.t = 0; this.flashes = [];
      // struck notes and pads are EVENTS (rule #1's other half): a flash where the note sits
      this._off = [signals.on('midi/note/on', ({ note, vel, ch }) => this.flashes.push({ note, vel, ch, life: 1 }))];
    },
    update(dt, s) { this.s = s; this.t += dt * s.speed; for (const f of this.flashes) f.life -= dt * 1.4; this.flashes = this.flashes.filter((f) => f.life > 0); },
    render() {
      const { ctx } = this.view, { w, h } = this.view.fit(), s = this.s; if (!s) return;
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = `rgba(6,8,14,${1 - s.trail})`; ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = s.glow > 0.05 ? 'lighter' : 'source-over';
      const cx = w / 2, cy = h * 0.42, R = Math.min(w, h) * 0.38 * s.spread;
      for (let ring = 0; ring < s.density; ring++) {
        const k = ring / Math.max(1, s.density - 1);
        for (let i = 0; i < s.petals; i++) {
          const a = (i / s.petals) * Math.PI * 2 + this.t * s.spin * (0.4 + k) + s.bend * k * 2;
          const r = R * (0.25 + k * 0.75) * (1 + s.wobble * 0.35 * Math.sin(this.t * 3 + i + ring));
          ctx.fillStyle = `hsla(${(s.hue + k * 90) % 360},${s.sat}%,${s.light}%,${0.12 + s.glow * 0.4})`;
          ctx.beginPath(); ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, s.size * (0.5 + k), 0, 7); ctx.fill();
        }
      }
      for (const f of this.flashes) {
        const x = f.ch === 10 ? w * (0.15 + ((f.note - 36) % 8) * 0.1) : w * ((f.note - 36) / 48);
        ctx.fillStyle = `hsla(${(s.hue + (f.note % 12) * 30) % 360},90%,65%,${f.life * 0.55})`;
        ctx.beginPath(); ctx.arc(x, h * (f.ch === 10 ? 0.86 : 0.78), 10 + f.vel * 60 * (1.4 - f.life), 0, 7); ctx.fill();
      }
    },
    dispose() { this._off.forEach((f) => f()); this.view.dispose(); },
  };

  // every device's controls → the same params (inMin/inMax come from the profile for bipolar strips)
  const eight = ['hue', 'spread', 'spin', 'petals', 'trail', 'size', 'wobble', 'glow'];
  const four = ['density', 'speed', 'sat', 'light'];
  const routes = [
    ...controllerRoutes(profileById('arturia-minilab3'), { ...obj(eight, (i) => 'knob' + i), ...obj(four, (i) => 's' + i), pitch: 'bend' }),
    ...controllerRoutes(profileById('akai-lpd8'), obj(eight, (i) => 'k' + i)),
    ...controllerRoutes(profileById('korg-nanokontrol2'), { ...obj(eight, (i) => 'k' + i), ...obj(four, (i) => 'f' + i) }),
    ...controllerRoutes(profileById('arturia-keystep37'), { ...obj(eight.slice(0, 4), (i) => 'k' + i), pitch: 'bend' }),
    ...controllerRoutes(profileById('generic-8k8p'), obj(eight, (i) => 'k' + i)),
    ...controllerRoutes(profileById('generic-8f'), obj([...four, ...eight.slice(0, 4)], (i) => 'f' + i)),
  ];
  await createShow({
    world: garden,
    timeline: { total: 120 },
    routes,
    profile: false,                      // routes come from code every load (no saved mapper profile)
    modules: { keys: false, midi: { controllers: { profile: q.get('profile') || 'arturia-minilab3' } }, remote: true },
    hint: 'turn the on-screen knobs · plug a controller in · M = show/hide the controller',
  });
}

function obj(params, idOf) { const o = {}; params.forEach((p, i) => { o[idOf(i + 1)] = p; }); return o; }
