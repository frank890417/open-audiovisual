// 28 · DMX lights — one world draws a stage AND drives a lighting rig, from the same params.
//
// The rig: 8 RGBW pars and 2 moving heads on universe 1 (generic profiles, @openav/dmx). The engine renders every light
// at any moment from scenes, a chase and three effects; dmxParams() turns its control points into params, so the console,
// the mapper (sound, chords, any MIDI controller) and the timeline all drive the lights the way they drive any
// world (rule 1: the engine never reads a signal). The monitor under the stage shows what the lights are getting.
//
//   no query        sim: nothing leaves the page, the monitor is the rig
//   ?out=bridge     → the out-bridge on this machine (ws://127.0.0.1:6450/out): Art-Net, sACN or an Enttec, per its config
//   ?out=ws://…     → another bridge
//   ?out=serial     → an Enttec DMX USB Pro by Web Serial (Chrome / Edge): press Connect in the monitor
//
// Not tried with real fixtures or interfaces yet: docs/dmx.md says what was and was not checked.

import { createShow } from '@openav/show';
import { createCanvas } from '@openav/stage';
import { profileById, controllerRoutes } from '@openav/midi';
import { OutClient } from '@openav/out';
import { Patch, DmxEngine, dmxParams, dmxTransport, mountDmxMonitor } from '@openav/dmx';

// ---------- the rig: what is hung where ----------
const patch = new Patch();
for (let i = 0; i < 8; i++) patch.add({ id: `par${i + 1}`, profile: 'generic-rgbw', mode: '6ch', address: 1 + i * 6, groups: ['pars', i % 2 ? 'even' : 'odd'] });
patch.add({ id: 'head1', profile: 'generic-moving-head', mode: '16ch', address: 49, groups: ['heads'], limits: { tilt: [0.1, 0.9] } });
patch.add({ id: 'head2', profile: 'generic-moving-head', mode: '16ch', address: 65, groups: ['heads'], limits: { tilt: [0.1, 0.9] } });

// ---------- the looks: a base, a chase, three effects ----------
const engine = new DmxEngine(patch);
engine.scene('on', { pars: { dimmer: 1 }, heads: { dimmer: 1, tilt: 0.4, zoom: 0.3 } }).base('on');
engine.scene('odd', { odd: { dimmer: 1 }, even: { dimmer: 0.12 } }).scene('even', { odd: { dimmer: 0.12 }, even: { dimmer: 1 } });
engine.chase('walk', { steps: ['odd', 'even'], every: 0.5, unit: 'second', fade: 0.4 }).run('walk', false);   // 1 Hz: well under the 3 Hz cap
engine.effect('breathe', { target: 'pars', wave: 'sine', rate: 0.2, depth: 0.35, spread: 1 });                 // a slow wave along the row
engine.effect('rainbow', { target: 'pars', property: 'color', wave: 'rainbow', rate: 0.08, depth: 0, spread: 1 });
engine.effect('sweep', { target: 'heads', property: 'pan', wave: 'sine', rate: 0.12, depth: 0.5, spread: 0.5 });

// ---------- its control points as params ----------
const rig = dmxParams(engine, {
  groups: { pars: { hue: 0.07, saturation: 0.85 }, heads: { hue: 0.6, saturation: 0.45 } },
  effects: { breathe: { max: 1 }, rainbow: { max: 0.5 }, sweep: { max: 1 } },
  chases: ['walk'],
});

// ---------- where the bytes go ----------
const q = new URLSearchParams(location.search).get('out') || 'sim';
const out = q === 'serial' ? dmxTransport('serial', { universe: 1 })
  : q === 'bridge' || /^wss?:\/\//.test(q) ? dmxTransport('bridge', { client: new OutClient({ id: '28-dmx-lights', url: q === 'bridge' ? undefined : q }).connect() })
  : dmxTransport('sim');

const lights = {
  name: 'dmx-lights',
  params: [{ key: 'haze', label: 'Haze', min: 0, max: 1, def: 0.55 }, ...rig.params],
  init({ container, params }) {
    this.view = createCanvas(container);
    this.t = 0;
    this.dock = document.createElement('div');
    this.dock.style.cssText = 'position:absolute;left:0;right:0;bottom:0;z-index:3';
    container.appendChild(this.dock);
    this.monitor = mountDmxMonitor(this.dock, { patch, transport: out, title: 'DMX · 8 pars, 2 heads' });
    // the one button a lighting desk always has within reach
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = 'Blackout';
    b.style.cssText = 'position:absolute;left:12px;top:12px;z-index:4;padding:6px 14px;border-radius:8px;border:1px solid #8a6d1f;background:rgba(10,12,17,.85);color:#ffd166;font:700 12px system-ui;cursor:pointer';
    b.onclick = () => { const on = !params.isOverridden(rig.keys.blackout) || params.overrides[rig.keys.blackout] < 0.5; params.override(rig.keys.blackout, on ? 1 : 0); };
    container.appendChild(b);
    this.button = b;
  },
  update(dt, state) {
    this.t += dt;
    rig.apply(state, this.t);                // the params → the engine (only what changed)
    const U = engine.render(this.t);         // every light, now
    out.send(U);                             // only the channels that changed leave
    this.monitor.update(U);
    this.look = engine.state(this.t).fixtures;
    this.haze = state.haze;
    const dark = state[rig.keys.blackout] >= 0.5;
    this.button.setAttribute('aria-pressed', String(dark));
    this.button.style.background = dark ? '#ffd166' : 'rgba(10,12,17,.85)';
    this.button.style.color = dark ? '#0b0e15' : '#ffd166';
  },
  render() {
    const { ctx } = this.view, { w, h } = this.view.fit(), look = this.look;
    const H = Math.max(140, h - (this.dock.offsetHeight || 0));
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#05060a'; ctx.fillRect(0, 0, w, h);
    if (!look) return;
    const top = H * 0.14, floor = H * 0.94, haze = this.haze ?? 0.5;
    const rgb = (f) => (f.color || [0, 0, 0]).map((c) => c * (f.dimmer ?? 0));
    const css = (c, a) => `rgba(${c.map((x) => Math.round(Math.min(1, x) * 255)).join(',')},${a})`;
    ctx.fillStyle = '#0b0e15'; ctx.fillRect(0, floor, w, h - floor);
    ctx.fillStyle = '#1c2334'; ctx.fillRect(w * 0.05, top - 5, w * 0.9, 6);                        // the truss
    ctx.globalCompositeOperation = 'lighter';
    // pars: a wash cone each, a pool of light on the floor
    for (let i = 0; i < 8; i++) {
      const f = look[`par${i + 1}`], c = rgb(f), x = w * (0.1 + (i * 0.8) / 7), spread = w * 0.075;
      const g = ctx.createLinearGradient(0, top, 0, floor);
      g.addColorStop(0, css(c, 0.75 * haze)); g.addColorStop(1, css(c, 0.04 * haze));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(x - 7, top + 6); ctx.lineTo(x + 7, top + 6); ctx.lineTo(x + spread, floor); ctx.lineTo(x - spread, floor); ctx.fill();
      const pool = ctx.createRadialGradient(x, floor, 0, x, floor, spread * 1.3);
      pool.addColorStop(0, css(c, 0.9)); pool.addColorStop(1, css(c, 0));
      ctx.fillStyle = pool; ctx.beginPath(); ctx.ellipse(x, floor, spread * 1.3, H * 0.035, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = css(c.map((v) => v * 0.6 + (Math.max(...c) > 0.02 ? 0.4 : 0.05)), 1);
      ctx.beginPath(); ctx.arc(x, top + 6, 6, 0, Math.PI * 2); ctx.fill();
    }
    // moving heads: a narrow beam, its angle the pan, its reach the tilt
    for (const [id, fx] of [['head1', 0.3], ['head2', 0.7]]) {
      const f = look[id], c = rgb(f), x = w * fx, y = top + 16;
      const a = ((f.pan ?? 0.5) - 0.5) * 2.2, len = H * (0.5 + 0.55 * (f.tilt ?? 0.5)), half = w * (0.012 + 0.03 * (f.zoom ?? 0));
      const ex = x + Math.sin(a) * len, ey = y + Math.cos(a) * len, nx = Math.cos(a) * half, ny = -Math.sin(a) * half;
      const g = ctx.createLinearGradient(x, y, ex, ey);
      g.addColorStop(0, css(c, 0.95 * Math.max(0.25, haze))); g.addColorStop(1, css(c, 0.02));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(x - 2, y); ctx.lineTo(x + 2, y); ctx.lineTo(ex + nx, ey + ny); ctx.lineTo(ex - nx, ey - ny); ctx.fill();
      ctx.fillStyle = css(c.map((v) => v * 0.7 + 0.3), 1);
      ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  },
  dispose() { this.monitor.dispose(); this.button.remove(); this.view.dispose(); },
};

// ---------- what drives what: the mapping layer (rule 1), all of it editable in L2 · Mapping ----------
const routes = [
  // sound: the room's loudness, or the drum machine's kick when there is no microphone, swells the pars (smoothed: no flicker)
  { source: 'audio/rms', target: 'dmx/pars/dimmer', inMax: 0.25, outMin: 0.25, curve: 'smooth', smooth: 0.25 },
  { source: 'drum/kick/env', target: 'dmx/pars/dimmer', outMin: 0.3, smooth: 0.12, release: 2 },
  // the piano and the QWERTY keys: what you play colours the pars (consonant warm, dissonant cold); more notes, more rainbow
  { source: 'chord/consonance', target: 'dmx/pars/hue', inMin: -1, inMax: 1, outMin: 0.62, outMax: 0.06, smooth: 0.4, release: 8 },
  { source: 'chord/count', target: 'dmx/rainbow/depth', inMin: 1, inMax: 6, smooth: 0.5, release: 8 },
  // any MIDI controller: the mod wheel swings the heads, the volume fader is the master
  { source: 'midi/cc/1', target: 'dmx/sweep/depth' },
  { source: 'midi/cc/7', target: 'dmx/master' },
  // a MiniLab 3 (or the one on screen, M): eight knobs, four faders, a pad held = the pars walk
  ...controllerRoutes(profileById('arturia-minilab3'), {
    knob1: 'dmx/master', knob2: 'dmx/pars/dimmer', knob3: 'dmx/pars/hue', knob4: 'dmx/pars/saturation',
    knob5: 'dmx/heads/dimmer', knob6: 'dmx/heads/hue', knob7: 'dmx/sweep/rate', knob8: 'dmx/rainbow/depth',
    s1: 'dmx/breathe/depth', s2: 'dmx/sweep/depth', s3: 'dmx/rainbow/rate', s4: 'haze',
    pad1: { target: 'dmx/walk/run', inMax: 0.01 },
  }),
];

await createShow({
  world: lights,
  routes,
  profile: false,                          // routes come from this file on every load
  timeline: {
    total: 64,
    automation: {
      'dmx/pars/hue':        [[0, 0.07], [16, 0.07], [24, 0.58], [46, 0.58], [52, 0.9], [64, 0.07]],
      'dmx/pars/saturation': [[0, 0.85], [40, 0.85], [44, 0.4], [64, 0.85]],
      'dmx/sweep/depth':     [[0, 0.15], [16, 0.15], [20, 0.8], [56, 0.8], [64, 0.15]],
      'dmx/rainbow/depth':   [[0, 0], [32, 0], [36, 1], [46, 1], [48, 0]],
      'dmx/walk/run':        [[0, 0], [48, 1], [63, 1], [64, 0]],
      haze:                  [[0, 0.55], [32, 0.75], [64, 0.55]],
    },
    scenes: [
      { id: 'warm',    t: 0,  title: 'Warm',    note: 'amber wash, the row breathes · play a chord' },
      { id: 'sweep',   t: 16, title: 'Sweep',   note: 'the heads open up and swing' },
      { id: 'rainbow', t: 32, title: 'Rainbow', note: 'the pars walk through the colours' },
      { id: 'walk',    t: 48, title: 'Walk',    note: 'odd and even trade, once a second' },
    ],
  },
  modules: { keys: { base: 48 }, chord: true, drums: true, audio: 'mic', sound: true, midi: { controllers: { profile: 'arturia-minilab3', open: false } } },
  hint: 'tick "keyboard" and play A–L: chords colour the pars · ▶ the drum machine: the kick lifts them · Space plays the cues · ?out=bridge sends DMX to the out-bridge',
});
