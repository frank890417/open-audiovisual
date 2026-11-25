// 29 · Projector output — a world for a projector, and the window that puts it there.
//
// The world draws rings that follow the shape of its canvas and a frame on the canvas's edge (so the picture's edge can be
// found on the wall). It knows nothing about projectors (rule 2): @openav/output takes its canvas as it is.
//
//   Open output window   a window with the stage in it: drag it onto the projector, press F there (or pick the screen)
//   E (in that window)   drag the four corners onto the screen's corners: the picture bends to fit (corner-pin)
//   G                    a test pattern, bent the same way          B   blackout (the param output/main/blackout)
//   ?pair                one 32:9 canvas over two projectors side by side: outputs "left" and "right", each a half
//   ?output              this page as a clean output: the address for a kiosk browser, OBS or TouchDesigner
//   ?lead                with node serve.js: lead the pages at ?output&follow=oav-output&via=relay (OBS, TouchDesigner)
//
// Blackout and brightness are params (rule 1): the console's sliders, a MIDI fader (CC 7 below) and the timeline (the
// projector fades out over the last 8 seconds) reach them the same way they reach the rings.

import { createShow } from '@openav/show';
import { createCanvas } from '@openav/stage';
import { createOutputs } from '@openav/output';

const query = new URLSearchParams(location.search);
const pair = query.has('pair');
const lead = query.has('lead');                        // ?lead: pages elsewhere (OBS, TouchDesigner) follow this one over node serve.js's /relay
const names = pair ? ['left', 'right'] : ['main'];

const rings = {
  name: 'projector-rings',
  params: [
    { key: 'hue',   label: 'Hue',   min: 0, max: 360, def: 200 },
    { key: 'speed', label: 'Speed', min: 0, max: 2,   def: 0.35 },
    { key: 'rings', label: 'Rings', min: 3, max: 24,  def: 10, step: 1 },
    { key: 'frame', label: 'Frame', min: 0, max: 1,   def: 0.6 },
  ],
  init({ container, signals }) {
    this.view = createCanvas(container);
    this.phase = 0; this.ripples = []; this.s = null;
    // a struck note is an event: a ripple from the centre (a signal may drive it directly)
    this.off = signals.on('midi/note/on', ({ note, vel }) => this.ripples.push({ r: 0, hue: (note % 12) * 30, a: 0.35 + 0.65 * (vel ?? 0.8) }));
  },
  update(dt, state) {
    this.s = state;
    this.phase = (this.phase + dt * state.speed) % 1;
    for (const r of this.ripples) { r.r += dt * 0.55; r.a *= Math.pow(0.3, dt); }
    this.ripples = this.ripples.filter((r) => r.a > 0.02 && r.r < 1.6);
  },
  render() {
    const s = this.s;
    if (!s) return;
    const { ctx } = this.view, { w, h } = this.view.fit(), cx = w / 2, cy = h / 2, m = Math.min(w, h);
    ctx.fillStyle = '#04060b'; ctx.fillRect(0, 0, w, h);
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, m * 0.45);
    glow.addColorStop(0, `hsla(${(s.hue + 180) % 360}, 90%, 62%, 0.35)`); glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h);
    // rings that grow from the centre to the edge, in the canvas's own shape: on a wall, a wrong corner shows at once
    const n = Math.round(s.rings);
    ctx.lineWidth = Math.max(1.5, m / 200);
    for (let i = 0; i < n; i++) {
      const f = (i / n + this.phase) % 1, k = 0.03 + 0.97 * Math.pow(f, 1.5);
      const rw = (w / 2) * k, rh = (h / 2) * k, rad = Math.min(rw, rh) * 0.3;
      ctx.strokeStyle = `hsla(${(s.hue + i * (240 / n)) % 360}, 85%, ${68 - 22 * f}%, ${0.2 + 0.8 * f})`;
      ctx.beginPath(); ctx.roundRect(cx - rw, cy - rh, rw * 2, rh * 2, rad); ctx.stroke();
    }
    for (const r of this.ripples) {
      ctx.strokeStyle = `hsla(${(s.hue + r.hue) % 360}, 95%, 72%, ${r.a})`;
      ctx.lineWidth = Math.max(2, m / 120);
      ctx.beginPath(); ctx.ellipse(cx, cy, r.r * w / 2, r.r * h / 2, 0, 0, Math.PI * 2); ctx.stroke();
    }
    // the canvas's edge and its centre: what to line up with the screen
    if (s.frame > 0.01) {
      const a = s.frame, t = Math.max(2, m / 300), arm = m / 12;
      ctx.strokeStyle = `rgba(255,255,255,${a})`; ctx.lineWidth = t;
      ctx.strokeRect(t / 2, t / 2, w - t, h - t);
      ctx.beginPath(); ctx.moveTo(cx - arm, cy); ctx.lineTo(cx + arm, cy); ctx.moveTo(cx, cy - arm); ctx.lineTo(cx, cy + arm); ctx.stroke();
    }
  },
  dispose() { this.off?.(); this.view.dispose(); },
};

const fadeOut = Object.fromEntries(names.map((n) => [`output/${n}/brightness`, [[0, 1], [40, 1], [48, 0]]]));
const show = await createShow({
  world: rings,
  profile: false,                                       // the routes come from this file on every load
  routes: [
    { source: 'midi/cc/1', target: 'speed', outMax: 1.5 },
    ...names.map((n) => ({ source: 'midi/cc/7', target: `output/${n}/brightness` })),   // any controller's volume fader: the projector
  ],
  timeline: {
    total: 48, loop: true,
    automation: {
      hue:   [[0, 200], [16, 260], [32, 30], [48, 200]],
      speed: [[0, 0.3], [16, 0.8], [32, 0.35]],
      rings: [[0, 8], [16, 14], [32, 6], [48, 8]],
      frame: [[0, 0.6], [32, 0.6], [34, 1], [40, 0.3], [48, 0.6]],
      ...fadeOut,                                       // the timeline reaches the projector the way it reaches the rings
    },
    scenes: [
      { id: 'rings', t: 0,  title: 'Rings', note: 'open the output window, put it on the projector, E to pin the corners' },
      { id: 'drift', t: 16, title: 'Drift', note: 'faster, more rings · play the piano: ripples' },
      { id: 'edges', t: 32, title: 'Edges', note: 'the frame flares: is the picture\'s edge on the screen\'s edge?' },
      { id: 'fade',  t: 40, title: 'Fade',  note: 'the timeline fades the projector out (output/…/brightness)' },
    ],
  },
  modules: { keys: { base: 48 } },
  hint: 'Open output window, then in it: E corners · G test pattern · F fullscreen · B blackout · ?pair: two projectors · ?output: this page clean',
});

// the outputs: declared at load, so their params are there for the timeline, a MIDI fader and the console before any window opens
const outputs = createOutputs(show, pair
  ? { outputs: [{ name: 'left', crop: { x: 0, y: 0, w: 0.5, h: 1 } }, { name: 'right', crop: { x: 0.5, y: 0, w: 0.5, h: 1 } }], aspect: 32 / 9, via: lead || null }
  : { outputs: [{ name: 'main' }], aspect: 16 / 9, via: lead || null });
if (lead && !show.output) outputs.lead();

// the button for the person at the desk (.oav-operator: a clean output page never shows it); a window opens only from a click
const bar = document.createElement('div');
bar.className = 'oav-operator';
bar.style.cssText = 'position:absolute;left:12px;top:12px;z-index:6;display:flex;gap:8px';
for (const name of names) {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = pair ? `Open ${name}` : 'Open output window';
  b.style.cssText = 'padding:7px 14px;border-radius:9px;border:1px solid #8a6d1f;background:rgba(10,12,17,.85);color:#ffd166;font:700 13px system-ui;cursor:pointer';
  b.onclick = () => { try { outputs.open(name); } catch (e) { b.textContent = e.message.replace('[output] ', ''); } };
  bar.appendChild(b);
}
show.stage.container.appendChild(bar);
