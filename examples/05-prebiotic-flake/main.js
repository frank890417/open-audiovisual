// 05 · prebiotic flake — a 2023 MIDI daily sketch (Che-Yu Wu, "230616
// Prebiotic Flake"), integrated as a World with its soul intact.
//
// The original was p5 global mode + raw WebMIDI + a hardcoded autoMode that
// fired random notes every 25 frames. The port shows what the framework
// absorbs: WebMIDI plumbing → @openav/midi · autoMode → the SimPlayer in
// @openav/keys · hardcoded feel numbers → performable params · and the new
// L4 audio branch (@openav/sound + Tone.js) gives the flakes a voice.
// The drawing code itself is ~verbatim 2023 — history preserved, chassis new.

import { createShow } from '@openav/show';

// ---------- the world: 2023 sketch, instance-mode, params instead of magic numbers ----------
const flakeWorld = {
  name: 'prebiotic-flake',
  params: [
    { key: 'zoomRate', label: 'Zoom breathe', min: 1.0, max: 4,   def: 2 },
    { key: 'wobble',   label: 'Wobble',       min: 0,   max: 0.01, def: 0.001 },
    { key: 'hueShift', label: 'Hue shift',    min: 0,   max: 360, def: 300 },
    { key: 'grain',    label: 'Grain',        min: 0,   max: 1,   def: 1 },
  ],
  init({ container, signals }) {
    this.s = {};
    const world = this;
    this._unsub = signals.on('midi/note/on', ({ note, vel }) => {
      world._pending = { note, vel: Math.round((vel ?? 0.8) * 127) };
    });
    this.p5 = new p5((sk) => {
      let graphics, overAllTexture, shrinkFactor = 1.2;

      // — 2023 flake painter, verbatim in spirit: one note = one radial flake —
      const drawFlake = (note, vel) => {
        shrinkFactor = 10;
        graphics.push();
        if (sk.random() < 0.3) graphics.drawingContext.setLineDash([5, 100 - vel + note]);
        graphics.translate(sk.width / 2, sk.height / 2);
        graphics.noFill();
        graphics.colorMode(sk.HSB);
        const hs = world.s.hueShift ?? 300;
        graphics.stroke((note * 2 + hs) % 360, sk.random(100), sk.random(100));
        graphics.strokeWeight(sk.sqrt(vel) / 10);
        const r = sk.map(note, 50, 90, 10, sk.height / 3);
        graphics.beginShape();
        const points = [];
        const isRandomShape = sk.random() < 0.5;
        const drawCenterLine = note % 5 === 0;
        for (let ang = sk.frameCount / 10; ang < 6 * sk.PI + sk.frameCount / 10; ang += 0.05) {
          const _r = r + sk.noise(r, ang * 10, sk.frameCount) * 200 * sk.map(vel, 40, 100, -1, 1)
            + sk.random(-10, 10) + sk.sin(ang * vel / 2) * sk.height / 20;
          if (sk.random() < 0.3) {
            for (let i = 0; i < 20; i++) {
              if (isRandomShape && sk.random() < 0.3) continue;
              graphics.strokeWeight(sk.random(3) + 1);
              graphics.stroke((note * 2 - 50 + sk.frameCount / 3 + sk.random(-50, 50)) % 360, sk.random(100), sk.random(100));
              graphics.point(_r * sk.cos(ang) + sk.random(-50, 50), _r * sk.sin(ang) + sk.random(-50, 50));
              if (sk.random() < 0.3) {
                graphics.push();
                if (sk.random() < 0.3) graphics.fill((note * 2 - 50 + sk.random(-50, 50)) % 360, sk.random(100), sk.random(100));
                graphics.circle(_r * sk.cos(ang) + sk.random(-50, 50), _r * sk.sin(ang) + sk.random(-50, 50), sk.random(sk.random(50)));
                graphics.pop();
              }
            }
            const px = _r * sk.cos(ang) + sk.random(-50, 50), py = _r * sk.sin(ang) + sk.random(-50, 50);
            points.push({ x: px, y: py });
            if (drawCenterLine && Math.trunc(ang * 100) % 5 === 0) {
              graphics.strokeWeight(sk.random(2));
              graphics.line(px, py, 0, 0);
            }
          }
          graphics.vertex(_r * sk.cos(ang), _r * sk.sin(ang));
        }
        graphics.endShape();
        graphics.drawingContext.setLineDash([10, 0]);
        if (note % 5 === 0) {
          graphics.beginShape();
          for (let i = 0; i < points.length; i += 50) graphics.vertex(points[i].x, points[i].y);
          graphics.endShape();
        }
        graphics.strokeWeight(5);
        graphics.arc(0, 0, r, r, sk.random(0, 5), sk.random(0, 5));
        graphics.pop();
      };

      sk.setup = () => {
        const w = container.clientWidth, h = container.clientHeight;
        sk.createCanvas(w, h);
        graphics = sk.createGraphics(w, h);
        graphics.background(0);
        sk.background(0);
        overAllTexture = sk.createGraphics(w, h);
        overAllTexture.loadPixels();
        for (let i = 0; i < w + 50; i++)
          for (let o = 0; o < h + 50; o++)
            overAllTexture.set(i, o, sk.color(200, sk.noise(i / 10, i * o / 300) * sk.random([0, 0, 0, 10, 20])));
        overAllTexture.updatePixels();
      };

      sk.draw = () => {
        if (world._pending) { drawFlake(world._pending.note, world._pending.vel); world._pending = null; }
        const s = world.s;
        graphics.push();
        graphics.background(0, 1);
        graphics.blendMode(sk.MULTIPLY);
        shrinkFactor = sk.lerp(shrinkFactor, s.zoomRate ?? 2, 0.01);
        graphics.image(graphics, -shrinkFactor, -shrinkFactor, sk.width + 2 * shrinkFactor, sk.height + 2 * shrinkFactor);
        graphics.blendMode(sk.SCREEN);
        graphics.translate(sk.width / 2, sk.height / 2);
        graphics.rotate((s.wobble ?? 0.001) * sk.sin(sk.frameCount / 50));
        graphics.translate(-sk.width / 2, -sk.height / 2);
        graphics.drawingContext.filter = 'blur(4px)';
        graphics.drawingContext.globalAlpha = 0.5;
        graphics.image(graphics, -shrinkFactor, -shrinkFactor, sk.width + 2 * shrinkFactor, sk.height + 2 * shrinkFactor);
        graphics.pop();

        sk.background(0, 10);
        sk.push();
        sk.blendMode(sk.SCREEN);
        sk.translate(sk.width / 2, sk.height / 2);
        sk.rotate(0.1); sk.scale(1.5);
        sk.translate(-sk.width / 2, -sk.height / 2);
        sk.image(graphics, -shrinkFactor, -shrinkFactor, sk.width + 2 * shrinkFactor, sk.height + 2 * shrinkFactor);
        sk.drawingContext.filter = 'blur(10px)';
        sk.image(graphics, -shrinkFactor, -shrinkFactor, sk.width + 2 * shrinkFactor, sk.height + 2 * shrinkFactor);
        sk.drawingContext.filter = 'blur(30px)';
        sk.image(graphics, -shrinkFactor, -shrinkFactor, sk.width + 2 * shrinkFactor, sk.height + 2 * shrinkFactor);
        sk.pop();
        sk.blendMode(sk.MULTIPLY);
        sk.drawingContext.globalAlpha = s.grain ?? 1;
        sk.image(overAllTexture, sk.random(-10, 10), sk.random(-10, 10));
        sk.drawingContext.globalAlpha = 1;
      };
    }, container);
  },
  update(dt, state) { this.s = state; },
  render() { /* p5 runs its own loop */ },
  dispose() { this._unsub?.(); this.p5?.remove(); },
};

// ---------- assembly ----------
const show = await createShow({
  world: flakeWorld,
  timeline: {
    total: 120,
    automation: {
      zoomRate: [[0, 1.6], [40, 2.4], [90, 3.4], [120, 1.4]],
      hueShift: [[0, 300], [60, 80], [120, 220]],
    },
    scenes: [
      { id: 'seed',   t: 0,  title: 'Seed',   note: 'single flakes · low register' },
      { id: 'bloom',  t: 40, title: 'Bloom',  note: 'chords · the zoom breathes' },
      { id: 'escape', t: 90, title: 'Escape', note: 'high notes · let it fly' },
    ],
  },
  modules: { keys: { base: 48 }, sound: true },
  artwork: { title: '230616 Prebiotic Flake', artist: 'Che-Yu Wu 吳哲宇', year: 2023,
             note: 'a MIDI daily sketch, integrated as a demo — all rights reserved for the artwork' },
  hint: 'each note = one flake · the feedback zoom breathes · enable sound in L4 · Output',
});

// echo performed notes to MIDI OUT ch1 — feeds external synths AND the
// per-channel OUT meter in the Layers panel (lineage: TLI's stage panel)
show.signals.on('midi/note/on', ({ note, vel }) => show.midi?.noteOn(note, Math.round((vel ?? 0.8) * 127), 1));
show.signals.on('midi/note/off', ({ note }) => show.midi?.noteOff(note, 1));
