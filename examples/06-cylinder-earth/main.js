// 06 · cylinder earth — "200412 3D Cylinder Earth" (Che-Yu Wu, 2020),
// a voice-controlled WEBGL daily sketch, integrated as a demo.
//
// The 2020 original read one number from the mic (overall volume) and pushed
// cylinder towers outward. The framework version keeps the drawing verbatim in
// spirit and upgrades the LISTENING: the audio analyzer (L1) publishes bands
// and drum onsets — lows pump the towers, highs shimmer the spin, and a kick
// rotates the palette. Same artwork, richer ears.
//
// artwork © Che-Yu Wu 吳哲宇, 2020 — demo purpose, all rights reserved.

import { createShow } from '@openav/show';

const COLOR_SETS = [
  'ff8360-e8e288-7dce82-3cdbd3-00fff5',
  'cc5803-e2711d-ff9505-ffb627-ffc971',
  '000000-fffffc-beb7a4-ff7f11-ff3f00',
  'ffffff-00a7e1-00171f-003459-007ea7',
  'eabfcb-c191a1-a4508b-5f0a87-2f004f',
].map(s => s.split('-').map(a => '#' + a));

const earthWorld = {
  name: 'cylinder-earth',
  params: [
    { key: 'pump',    label: 'Pump (voice)', min: 0, max: 1,  def: 0 },
    { key: 'spin',    label: 'Spin',         min: 0, max: 3,  def: 1 },
    { key: 'shimmer', label: 'Shimmer',      min: 0, max: 1,  def: 0.2 },
    { key: 'density', label: 'Density',      min: 3, max: 40, def: 20, step: 1 },
    { key: 'palette', label: 'Palette',      min: 0, max: 4,  def: 0, step: 1 },
    { key: 'nextPalette', label: 'Next palette', pulse: true },
  ],
  init({ container, signals, params }) {
    this.s = {};
    this.volume = 0;
    const world = this;
    this._unsub = params.onPulse('nextPalette', () => {
      params.override('palette', ((world.s.palette ?? 0) + 1) % COLOR_SETS.length);
    });
    this.p5 = new p5((sk) => {
      sk.setup = () => {
        sk.createCanvas(container.clientWidth, container.clientHeight, sk.WEBGL);
        sk.frameRate(30);
      };
      sk.draw = () => {
        const s = world.s;
        // pump follows the mapped param with the original's lerp feel
        world.volume = sk.lerp(world.volume, s.pump ?? 0, 0.3);
        const colors = COLOR_SETS[Math.trunc(s.palette ?? 0) % COLOR_SETS.length];
        const cirSpan = Math.trunc(s.density ?? 20);
        sk.background(0);
        sk.strokeWeight(0.5);
        sk.ambientLight(150);
        // — the 2020 tri-light rig, verbatim —
        sk.directionalLight(50, 255, 50, 25, -5, -10);
        sk.directionalLight(255, 50, 50, 5, -25, -10);
        sk.directionalLight(255, 25, 255, -25, -305, 10);
        sk.translate(0, 0, 350);
        sk.rotateY(sk.frameCount / 100 * (s.spin ?? 1));
        const span = 50;
        for (let i = 0; i < cirSpan; i += 1) {
          for (let o = 0; o < cirSpan; o += 1) {
            sk.push();
            const sR = Math.min(sk.width, sk.height) / 5.5;
            const angle1 = i * (2 * sk.PI / cirSpan);
            const angle2 = o * (2 * sk.PI / cirSpan) + i / 10;
            sk.rotateX(angle2);
            sk.rotateY(angle1);
            sk.rotateX(sk.PI / 2);
            sk.translate(sR, 0, 0);
            sk.rotateZ(sk.PI / 2);
            sk.fill(colors[Math.trunc(i + o * sk.width / span) % 5]);
            for (let z = span; z > 0; z -= 10) {
              const wob = sk.sin(i + o + z / (30 + i / 10 + o / 10) + sk.frameCount / 30 * (1 + (s.shimmer ?? 0) * 3));
              sk.cylinder(z * 0.5 + wob * (10 + 50 / Math.sqrt(cirSpan)), 5);
              sk.translate(0, -5 - sk.random(5) + world.volume * -800, 0);
            }
            sk.pop();
          }
        }
      };
    }, container);
  },
  update(dt, state) { this.s = state; },
  render() { /* p5 runs its own loop */ },
  dispose() { this._unsub?.(); this.p5?.remove(); },
};

await createShow({
  world: earthWorld,
  timeline: {
    total: 90,
    automation: { spin: [[0, 0.6], [45, 1.6], [90, 0.8]] },
    scenes: [
      { id: 'listen', t: 0,  title: 'Listen', note: 'enable 🎤 mic in L1 · Input, then speak / sing' },
      { id: 'pulse',  t: 30, title: 'Pulse',  note: 'play music — kicks rotate the palette' },
      { id: 'orbit',  t: 60, title: 'Orbit',  note: 'let it spin' },
    ],
  },
  // the analyzer's semantic signals ARE the instrument: lows pump, highs shimmer,
  // a kick flips the palette — the 2020 sketch heard one number; this hears a band
  routes: [
    { source: 'audio/rms',       target: 'pump',    curve: 'smooth', smooth: 0.08 },
    { source: 'audio/band/high', target: 'shimmer', smooth: 0.2 },
    { source: 'audio/kick/env',  target: 'pump',    curve: 'exp',    smooth: 0.05 },
    { source: 'audio/kick',      target: 'nextPalette' },
  ],
  modules: { keys: false, audio: 'mic', sound: false },
  artwork: { title: '200412 3D Cylinder Earth', artist: 'Che-Yu Wu 吳哲宇', year: 2020,
             note: 'voice-controlled daily sketch, integrated as a demo — all rights reserved for the artwork' },
  hint: 'enable 🎤 mic in L1 · Input — voice pumps the towers, highs shimmer,<br>each kick drum rotates the palette (audio/kick · /snare · /hat are signals now)',
});
