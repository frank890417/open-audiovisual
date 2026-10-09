// 13 · score & director — a show with structure.
//
// "A day of sky": five segments, written once as LENGTHS (no absolute seconds anywhere):
//   standby · dawn · noon · dusk · night
// and performed by segment modules. What this example shows, one thing per line:
//
//   · two cuts: `full` (2:00) and `short`, which is `full` × 0.5 — ?cut=short, or the picker on the desk
//   · a `hold`: the standby waits at its end until you release it (Space or →), however long that takes
//   · cues: named moments inside a segment ('noon.flare', 'night.moon'); they tick on the scrubber and fire once
//   · ACTS: what the operator does in this segment — on the desk, and big on the prompter (T)
//   · segment modules: enter / update / exit, `param()` bending a timeline param inside the segment, `linger`
//   · a module that crashes: open ?break=dusk — the dusk module throws on purpose, the desk shows a warning,
//     the show carries on, R brings the module back
//   · automation written against the full cut (haze) stretches with the short cut
//   · ?scoremidi: segment changes and cues also leave as MIDI notes on channel 15 (needs a MIDI output)
//
// Open the console: Space plays (at the HOLD, Space releases it) · ← → previous / next segment ·
// R back to the start · T prompter · F fullscreen.   window.openav.show.table() / .goto('night.moon') / .status()

import { createShow } from '@openav/show';
import { createCanvas } from '@openav/stage';

const q = new URLSearchParams(location.search);
const BREAK = q.get('break');          // ?break=dusk  — make that segment's module throw, to see the director cope

// ── the world: a sky. It only reads params, and has a few handles the modules may pull ──────────
const mix = (a, b, k) => a + (b - a) * k;
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const sky = {
  name: 'sky',
  params: [
    { key: 'sun',    label: 'Sun height', min: -1, max: 1, def: -0.9 },
    { key: 'warmth', label: 'Warmth',     min: 0,  max: 1, def: 0.2 },
    { key: 'stars',  label: 'Stars',      min: 0,  max: 1, def: 0.6 },
    { key: 'haze',   label: 'Haze',       min: 0,  max: 1, def: 0.1 },
    { key: 'flare',  label: 'Flare!',     pulse: true },
  ],
  init({ container, params }) {
    this.view = createCanvas(container);
    this.birds = false; this.caption = ''; this.glow = 0; this.meteor = null; this.t = 0;
    let s = 7; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    this.starPts = Array.from({ length: 160 }, () => ({ x: rnd(), y: rnd() * 0.75, r: 0.5 + rnd() * 1.4, ph: rnd() * 6.28 }));
    this._off = params.onPulse('flare', () => { this.glow = 1; });
  },
  update(dt, s) { this.s = s; this.t += dt; this.glow = Math.max(0, this.glow - dt * 0.8); if (this.meteor && (this.meteor.age += dt) > 1.2) this.meteor = null; },
  render() {
    const { ctx } = this.view, { w, h } = this.view.fit(), s = this.s || {};
    const day = clamp01((s.sun + 0.2) / 0.9);                         // 0 night … 1 full day
    const warm = clamp01(s.warmth) * (1 - Math.abs(day - 0.5) * 0.6);
    const top = `hsl(${mix(228, 205, day)} ${mix(45, 70, day)}% ${mix(5, 52, day)}%)`;
    const low = `hsl(${mix(250, mix(28, 195, 1 - warm), day)} ${mix(40, 85, Math.max(warm, day))}% ${mix(10, 72, day) + this.glow * 10}%)`;
    const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, top); g.addColorStop(1, low);
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    // stars
    const a = clamp01(s.stars) * (1 - day);
    if (a > 0.01) for (const p of this.starPts) { ctx.globalAlpha = a * (0.5 + 0.5 * Math.sin(this.t * 1.3 + p.ph)); ctx.fillStyle = '#fff'; ctx.fillRect(p.x * w, p.y * h, p.r, p.r); }
    ctx.globalAlpha = 1;
    // sun, then moon on the other side of the sky
    const sx = w * 0.5, sy = h * (0.95 - 0.8 * clamp01((s.sun + 0.35) / 1.35));
    const r = Math.min(w, h) * (0.06 + 0.02 * warm);
    const rg = ctx.createRadialGradient(sx, sy, r * 0.2, sx, sy, r * 5);
    rg.addColorStop(0, `hsla(${mix(42, 22, warm)} 100% 80% / ${0.55 * clamp01(s.sun + 0.5)})`); rg.addColorStop(1, 'hsla(30 100% 70% / 0)');
    ctx.fillStyle = rg; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = `hsl(${mix(48, 24, warm)} 100% 88%)`; ctx.globalAlpha = clamp01(s.sun + 0.6);
    ctx.beginPath(); ctx.arc(sx, sy, r, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
    if (day < 0.35) { ctx.fillStyle = `rgba(235,240,255,${1 - day / 0.35})`; ctx.beginPath(); ctx.arc(w * 0.78, h * 0.22, r * 0.55, 0, 7); ctx.fill(); }
    // haze
    if (s.haze > 0.01) { const hg = ctx.createLinearGradient(0, h * 0.3, 0, h); hg.addColorStop(0, 'rgba(210,220,235,0)'); hg.addColorStop(1, `rgba(210,220,235,${s.haze * 0.4})`); ctx.fillStyle = hg; ctx.fillRect(0, h * 0.3, w, h * 0.7); }
    // a meteor, when a module asks for one
    if (this.meteor) { const k = this.meteor.age / 1.2; ctx.strokeStyle = `rgba(255,255,255,${1 - k})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(w * (0.2 + 0.5 * k), h * (0.1 + 0.3 * k)); ctx.lineTo(w * (0.2 + 0.5 * k) - 70, h * (0.1 + 0.3 * k) - 24); ctx.stroke(); }
    // birds, while the dawn module has them out
    if (this.birds) { ctx.strokeStyle = 'rgba(20,25,40,.7)'; ctx.lineWidth = 1.6; for (let i = 0; i < 6; i++) { const x = ((this.t * 40 + i * 90) % (w + 80)) - 40, y = h * 0.3 + Math.sin(this.t + i) * 24 + i * 9, f = Math.sin(this.t * 6 + i) * 5; ctx.beginPath(); ctx.moveTo(x - 9, y + f); ctx.quadraticCurveTo(x, y - 6, x + 9, y + f); ctx.stroke(); } }
    // the caption a module sets in enter() and clears in exit()
    ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.font = '600 28px ui-monospace, monospace'; ctx.fillText(this.caption, 28, 54);
  },
  dispose() { this._off?.(); this.view.dispose(); },
};

// ── the score: lengths in seconds, and what the operator does. No absolute times. ───────────────
const cuts = [
  {
    id: 'full', title: 'A day',
    segments: [
      { id: 'standby', title: 'Standby', dur: 6, hold: true,
        note: 'house dark, stars breathing',
        acts: ['Check sound and projector', 'Press Space (or →) when the room is ready'] },
      { id: 'dawn', title: 'Dawn', dur: 24, cues: { birds: 0.3 },
        acts: ['Play single low notes', 'Keep the Haze knob closed'] },
      { id: 'noon', title: 'Noon', dur: 30, cues: { flare: { s: 8 }, peak: 0.5 },
        note: 'full light',
        acts: ['Open the Haze slowly', 'Fire Flare! on the downbeat'] },
      { id: 'dusk', title: 'Dusk', dur: 24, linger: 8, cues: { glow: 0.4 },
        note: 'the warmth outlasts the segment (linger 8 s)',
        acts: ['Chords, long and warm'] },
      { id: 'night', title: 'Night', dur: 36, cues: { stars: 0.2, moon: 0.7 },
        acts: ['Let the last chord ring', 'Hands off'] },
    ],
  },
  // the half-length version is not a second score to keep in step: it IS the first, times 0.5
  { id: 'short', title: 'A day, half length', from: 'full', scale: 0.5 },
];

// ── segment modules: enter / update / exit, and param() to bend a timeline param inside the segment ──
const smooth = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };
const modules = [
  {
    id: 'standby',
    enter: (api) => { api.sky.caption = 'standby'; },
    exit: (api) => { api.sky.caption = ''; },
    // while the show waits at the hold, T is frozen: ctx.held is the clock that keeps the stars breathing
    param: (key, v, ctx) => (key === 'stars' ? 0.55 + 0.2 * Math.sin((ctx.holding ? ctx.held : ctx.t) * 2) : v),
  },
  {
    id: 'dawn',
    enter: (api) => { api.sky.caption = 'dawn'; },
    update: (api, ctx) => { api.sky.birds = ctx.p > ctx.cue('birds') && ctx.p < 1.0; },     // compare p with the cue's progress
    exit: (api) => { api.sky.birds = false; },
    param: (key, v, ctx) => key === 'sun' ? mix(-0.45, 0.2, smooth(ctx.p)) : key === 'warmth' ? mix(0.4, 0.95, smooth(ctx.p)) : key === 'stars' ? v * (1 - smooth(ctx.p)) : v,
  },
  {
    id: 'noon',
    enter: (api) => { api.sky.caption = 'noon'; },
    cue: (name, ctx) => { if (name === 'flare') ctx.api.params.firePulse('flare'); },
    param: (key, v, ctx) => key === 'sun' ? mix(0.2, 1, smooth(ctx.p * 2)) * (ctx.p > 0.5 ? mix(1, 0.7, smooth((ctx.p - 0.5) * 2)) : 1) : key === 'warmth' ? mix(0.95, 0.15, smooth(ctx.p * 1.4)) : v,
  },
  {
    id: 'dusk',
    enter: (api) => { api.sky.caption = 'dusk'; },
    update: (api, ctx) => { if (BREAK === 'dusk' && ctx.p > 0.3) throw new Error('dusk crashed on purpose (?break=dusk): the show goes on without it'); },
    exit: (api) => { api.sky.caption = ''; },
    // p runs past 1 during the 8 s linger: the sun is down but the warmth fades slowly instead of cutting
    param: (key, v, ctx) => key === 'sun' ? mix(0.55, -0.55, smooth(ctx.p)) : key === 'warmth' ? mix(0.2, 1, smooth(ctx.p * 1.5)) * (ctx.p > 1 ? 1 - smooth((ctx.p - 1) / 0.34) * 0.5 : 1) : v,
  },
  {
    id: 'night',
    enter: (api) => { api.sky.caption = 'night'; },
    cue: (name, ctx) => { if (name === 'moon') ctx.api.sky.meteor = { age: 0 }; },
    exit: (api) => { api.sky.caption = ''; },
    param: (key, v, ctx) => key === 'sun' ? -0.9 : key === 'warmth' ? mix(0.6, 0.15, smooth(ctx.p * 3)) : key === 'stars' ? mix(0.3, 1, smooth(ctx.p * 3)) : v,
  },
];

await createShow({
  world: sky,
  score: {
    cuts, cut: 'full', modules,
    api: (show) => ({ sky: show.stage.active, params: show.params }),           // what the modules may touch
    midi: q.has('scoremidi') ? { channel: 15, segment: { note: 36, cc: 20 }, cue: { note: 84, cc: 21 } } : false,   // ?scoremidi: follow the show in Ableton etc.
  },
  // automation is written once, against the full cut; on the short cut it stretches with it
  timeline: { automation: { haze: [[0, 0.1], [60, 0.55], [100, 0.2], [120, 0.1]] } },
  modules: { keys: { base: 48 } },
  hint: 'Space plays; at the standby HOLD, Space releases it · ← → segments · T prompter · ?cut=short · ?break=dusk',
});
