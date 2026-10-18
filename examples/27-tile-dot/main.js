// 27 · tile dot — one dot and its sparks, flowing across every screen on the table.
//
// Open this page on three to five screens with the same ?room=, lay them flat, open the camera page
// (packages/tile/?room=…) on a phone, press Markers, take one photo from above. Each screen learns where it lies, and
// from then on draws only its own piece of one shared canvas: the dot leaves one screen, travels behind the bezel and
// comes out on the next, at the same size, on time.
//
// Nothing is streamed. Every screen computes the same frame from the same two things: the shared clock
// (io.tile.time(), synced with the relay) and the shared seed (io.tile.seed). So every position below is a function
// of time, never a sum of this screen's frames: a phone that joined late or dropped a frame still draws the same instant.
// Without ?room= the page is one screen on its own, with the console, running on its own time.

import { createShow } from '@openav/show';
import { createCanvas } from '@openav/stage';
import { lockViewport } from '@openav/surface';
import { joinTile, tileWorld, soloView, TILE_ROUTES } from '@openav/tile';

const TAU = Math.PI * 2;
// one number in [0, 1) from integers: the same on every screen (that is what a seed is for)
function hash(a, b = 0, c = 0) {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35) ^ Math.imul(c + 0x27d4eb2f, 0x165667b1);
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; h = Math.imul(h, 0x297a2d39); h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

// The dot's path: two slow sines a side, so it wanders the whole table and crosses a screen in a few seconds.
// A pure function of (time, seed, canvas): the whole world rests on that.
function dotAt(t, seed, W, H) {
  const m = 0.1 * Math.min(W, H), ax = W / 2 - m, ay = H / 2 - m;
  const wx = 0.42 + 0.12 * hash(seed, 1), wy = 0.57 + 0.12 * hash(seed, 2);
  return [
    W / 2 + ax * (0.82 * Math.sin(wx * t + TAU * hash(seed, 3)) + 0.18 * Math.sin(2.3 * wx * t + TAU * hash(seed, 4))),
    H / 2 + ay * (0.82 * Math.sin(wy * t + TAU * hash(seed, 5)) + 0.18 * Math.sin(1.7 * wy * t + TAU * hash(seed, 6))),
  ];
}

const SPARK_LIFE = 3;   // seconds

const dotWorld = {
  name: 'tile-dot',
  params: [
    { key: 'hue',    label: 'Hue',    min: 0,     max: 360,  def: 200 },
    { key: 'size',   label: 'Size',   min: 0.005, max: 0.08, def: 0.03 },   // the dot's radius, a share of the canvas's short side
    { key: 'sparks', label: 'Sparks', min: 0,     max: 400,  def: 180, step: 1 },
    { key: 'spread', label: 'Spread', min: 0,     max: 1,    def: 0.5 },
    { key: 'tail',   label: 'Tail',   min: 0,     max: 1,    def: 0.6 },
    { key: 'grid',   label: 'Grid',   min: 0,     max: 1,    def: 0.22 },   // faint lines on the canvas: they must run straight across the bezels
  ],
  init({ container }) {
    this.cv = createCanvas(container);
    this.T = 0; this.seed = 1; this.s = null; this.tile = null;
  },
  update(dt, s, io) {
    this.s = s;
    this.tile = io.tile || null;
    // the shared clock when tiled; alone, this screen's own time
    this.T = this.tile ? this.tile.time() : this.T + dt;
    this.seed = this.tile ? this.tile.seed : 1;
  },
  render() {
    const { canvas, ctx } = this.cv, s = this.s;
    this.cv.fit();
    if (!s) return;
    // which piece of the canvas this screen shows, and how many canvas pixels per device pixel it draws with
    const v = this.tile ? this.tile.view : soloView(canvas.width, canvas.height);
    const pr = this.tile ? canvas.width / v.device.w : 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    v.apply2d(ctx, pr);                                   // from here on: canvas units
    const { w: W, h: H } = v.canvas, D = Math.min(W, H), T = this.T, seed = this.seed;
    const lw = 1.5 / (v.scale * pr);                      // a line one and a half backing pixels wide, on any screen

    if (s.grid > 0) {
      const g = D / 6, b = v.bounds;
      ctx.strokeStyle = `hsla(${s.hue}, 30%, 60%, ${s.grid})`; ctx.lineWidth = lw;
      ctx.beginPath();
      for (let x = Math.ceil(b.x0 / g) * g; x <= b.x1; x += g) { ctx.moveTo(x, b.y0); ctx.lineTo(x, b.y1); }
      for (let y = Math.ceil(b.y0 / g) * g; y <= b.y1; y += g) { ctx.moveTo(b.x0, y); ctx.lineTo(b.x1, y); }
      ctx.stroke();
      ctx.strokeStyle = `hsla(${s.hue}, 40%, 70%, ${Math.min(1, s.grid * 2)})`;
      ctx.strokeRect(0, 0, W, H);                         // the edge of the shared canvas
    }

    // sparks: each one is born on the dot's path at its own moment, flies off, fades; born again every SPARK_LIFE s
    const n = Math.round(s.sparks), r0 = s.size * D;
    for (let i = 0; i < n; i++) {
      const off = hash(seed, 100, i) * SPARK_LIFE;
      const k = Math.floor((T - off) / SPARK_LIFE), born = k * SPARK_LIFE + off, age = (T - born) / SPARK_LIFE;
      const a = TAU * hash(seed + k, i, 7), sp = (0.05 + 0.25 * s.spread * hash(seed + k, i, 8)) * D;
      const [bx, by] = dotAt(born, seed, W, H);
      const d = sp * SPARK_LIFE * age * (1 - 0.5 * age);  // decelerating
      const x = bx + Math.cos(a) * d, y = by + Math.sin(a) * d, r = r0 * 0.28 * (1 - age);
      if (!v.visible(x, y, r)) continue;
      ctx.fillStyle = `hsla(${(s.hue + 40 * hash(seed, i, 9)) % 360}, 90%, ${55 + 30 * (1 - age)}%, ${1 - age})`;
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    }

    // the tail: where the dot was, sampled back in time (no memory of past frames, so every screen agrees)
    const steps = Math.round(40 * s.tail);
    for (let j = steps; j > 0; j--) {
      const [x, y] = dotAt(T - j * 0.035, seed, W, H), f = 1 - j / (steps + 1);
      if (!v.visible(x, y, r0)) continue;
      ctx.fillStyle = `hsla(${s.hue}, 85%, 60%, ${0.25 * f})`;
      ctx.beginPath(); ctx.arc(x, y, r0 * (0.35 + 0.6 * f), 0, TAU); ctx.fill();
    }
    const [x, y] = dotAt(T, seed, W, H);
    if (v.visible(x, y, r0 * 2)) {
      const glow = ctx.createRadialGradient(x, y, 0, x, y, r0 * 2);
      glow.addColorStop(0, `hsla(${s.hue}, 100%, 85%, 1)`);
      glow.addColorStop(0.45, `hsla(${s.hue}, 95%, 60%, 0.9)`);
      glow.addColorStop(1, `hsla(${s.hue}, 95%, 50%, 0)`);
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(x, y, r0 * 2, 0, TAU); ctx.fill();
    }
  },
  dispose() { this.cv.dispose(); },
};

// ?room=<name>: this screen is a tile. Join before the show, so the world can be wrapped.
const room = new URLSearchParams(location.search).get('room');
const tile = room ? joinTile({ room }) : null;
if (tile) {
  document.body.classList.add('tiled');                  // the stage fills the screen; no console, no guide card
  lockViewport();
}

const show = await createShow({
  world: tile ? tileWorld(dotWorld, tile) : dotWorld,
  timeline: {
    total: 60, loop: true,
    automation: { hue: [[0, 200], [20, 300], [40, 40], [60, 200]] },
    scenes: [{ id: 'flow', t: 0, title: 'Flow', note: 'one dot across every screen' }],
  },
  routes: tile ? [...TILE_ROUTES] : [],                  // the camera page's Markers / Play → the tileMarkers param
  modules: { keys: false, midi: false },
  // tiled: the timeline runs on the shared clock, so the hue automation is the same on every screen
  onFrame: tile ? (dt, s) => tile.syncTimeline(s.timeline, dt) : null,
  hint: tile ? '' : 'one screen on its own · add ?room=<name> on several screens, then open packages/tile/?room=<name> to place them · Space plays',
});
tile?.attach(show.signals);
window.oavTile = tile;
