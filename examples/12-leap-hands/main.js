// 12 · leap hands — a Leap Motion Controller as an instrument, and the hands drawn in the work.
//
// Needs the machine's Leap bridge (one per laptop; it also revives the old leap.js sketches):
//   node packages/leap/bridge/leap-bridge.mjs          a real Leap Motion / Ultraleap sensor
//   node packages/leap/bridge/leap-bridge.mjs --mock   two animated hands, no sensor
// No bridge at all? The page falls back to the simulator after two seconds: move the mouse over
// the stage = right palm, press = pinch, right-click = fist, Shift = left hand, wheel = depth.
//
// The gesture vocabulary (all through params — the timeline and a MIDI knob can play it too):
//   right palm height        → energy      (how fast the ink rises)
//   right palm across        → hue
//   left fist (grab)         → gravity     (close the left hand: the ink falls)
//   right pinch (a moment)   → a ring of ink at the index fingertip   (pinch > 0.86 starts, < 0.5 ends)
//   both hands pinch         → wash        (the canvas clears in a slow wipe)
// The skeleton itself is drawn from show.leap.hands (joints in mm) — drawing the hand is the one
// place a world reads the input directly.

import { createShow } from '@openav/show';
import { createCanvas } from '@openav/stage';
import { INTERACTION_BOX } from '@openav/leap';

// the hands are drawn in a view 1.7× the interaction box, so a whole hand fits on screen
const VIEW = { center: INTERACTION_BOX.center, size: INTERACTION_BOX.size.map((v) => v * 1.7) };

const inkWorld = {
  name: 'leap-ink',
  params: [
    { key: 'energy',  label: 'Energy (R height)', min: 0, max: 1, def: 0.4 },
    { key: 'hue',     label: 'Hue (R across)',    min: 0, max: 360, def: 200 },
    { key: 'gravity', label: 'Gravity (L fist)',  min: -0.4, max: 1, def: -0.15 },
    { key: 'trail',   label: 'Trail',             min: 0.02, max: 0.4, def: 0.08 },
    { key: 'ring',    label: 'Ring!',             pulse: true },
    { key: 'wash',    label: 'Wash!',             pulse: true },
  ],
  init({ container, params, signals }) {
    this.view = createCanvas(container);
    this.ink = document.createElement('canvas');      // the ink keeps its trails; the hands are redrawn clean on top
    this.drops = [];
    this.washT = 0;
    this._unsubs = [
      params.onPulse('ring', () => this.ringAtFingertip()),
      params.onPulse('wash', () => { this.washT = 1; }),
      signals.on('midi/note/on', ({ note }) => { const { w, h } = this.view.fit(); this.ring((((note - 36) / 48) % 1) * w, (0.3 + Math.random() * 0.4) * h); }),
    ];
  },
  // where a ring blooms is a moment's position, read at the moment (an event, not a level)
  ringAtFingertip() {
    const { w, h } = this.view.fit();
    const hand = this.leap?.hand('right');
    const tip = hand?.fingers[1]?.[4];
    if (tip) this.ring(...this.leap.project(tip, w, h, { box: VIEW }));
    else this.ring(w / 2, h / 2);
  },
  ring(x, y) {
    const s = this.s || {};
    for (let i = 0; i < 70; i++) {
      const a = (i / 70) * Math.PI * 2, sp = 2.5 + Math.random() * 1.5;
      this.drops.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, hue: (s.hue ?? 200) + Math.random() * 40 });
    }
    if (this.drops.length > 5000) this.drops.splice(0, this.drops.length - 5000);
  },
  update(dt, s) {
    this.s = s;
    const lift = 0.2 + s.energy * 2.2;
    for (const d of this.drops) {
      d.vy += (s.gravity * 0.25 - lift * 0.02) * 60 * dt;
      d.vx *= 0.985; d.vy *= 0.985;
      d.x += d.vx; d.y += d.vy;
      d.life -= dt * 0.3;
    }
    this.drops = this.drops.filter((d) => d.life > 0);
    this.washT = Math.max(0, this.washT - dt * 0.8);
  },
  render() {
    const { ctx } = this.view, { w, h } = this.view.fit(), s = this.s || {};
    const ink = this.ink, k = ink.getContext('2d');
    if (ink.width !== ctx.canvas.width || ink.height !== ctx.canvas.height) { ink.width = ctx.canvas.width; ink.height = ctx.canvas.height; }
    k.setTransform(ctx.getTransform());
    k.fillStyle = `rgba(4,6,12,${Math.max(s.trail ?? 0.08, this.washT * 0.5)})`;
    k.fillRect(0, 0, w, h);
    for (const d of this.drops) {
      k.fillStyle = `hsla(${d.hue % 360}, 85%, ${45 + d.life * 30}%, ${d.life})`;
      k.beginPath(); k.arc(d.x, d.y, 1.5 + d.life * 3, 0, Math.PI * 2); k.fill();
    }
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(ink, 0, 0); ctx.restore();
    // the hands themselves, as the performer sees them (oblique view of the interaction box)
    this.leap?.skeleton(ctx, w, h, { box: VIEW, lineWidth: 3, colorRight: `hsla(${s.hue ?? 200}, 90%, 72%, 0.95)`, colorLeft: 'rgba(160,235,190,0.9)' });
  },
  dispose() { this._unsubs?.forEach((u) => u()); this.view.dispose(); },
};

const show = await createShow({
  world: inkWorld,
  timeline: {
    total: 90,
    automation: { trail: [[0, 0.08], [60, 0.2], [90, 0.08]] },
    scenes: [
      { id: 'meet',  t: 0,  title: 'Meet it',  note: 'raise the right hand — the ink rises; pinch for a ring' },
      { id: 'fall',  t: 30, title: 'Let it fall', note: 'close the left fist — gravity takes the ink' },
      { id: 'wash',  t: 60, title: 'Wash',     note: 'pinch with both hands — the page clears' },
    ],
  },
  routes: [
    { source: 'leap/hand/right/y',    target: 'energy',  curve: 'smooth', smooth: 0.12 },
    { source: 'leap/hand/right/x',    target: 'hue',     smooth: 0.2 },
    { source: 'leap/hand/left/grab',  target: 'gravity', curve: 'smooth', smooth: 0.15 },
    { source: 'leap/hand/right/pinch-start', target: 'ring' },
    { source: 'leap/both/pinch-start',       target: 'wash' },
  ],
  modules: { keys: { base: 48 }, leap: true },
  hint: '✋ Leap: <code>node packages/leap/bridge/leap-bridge.mjs</code> (or <code>--mock</code>) · no bridge → simulator: mouse = right palm, press = pinch, right-click = fist, Shift = left hand',
});
inkWorld.leap = show.leap;

// no bridge after two seconds → simulate with the mouse (the L1 panel's "simulate" button toggles it back)
setTimeout(() => {
  const st = show.leap.status;
  if ((st === 'connecting' || st === 'closed') && new URLSearchParams(location.search).get('leap') !== 'bridge') show.leap.simulate({ target: show.leap.simTarget });
}, 2000);
