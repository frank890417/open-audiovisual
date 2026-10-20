// 02 · chord garden — performance semantics in action, now with the branches of The Last Input.
//
// Lineage: The Last Input (Che-Yu Wu, IRCAM × C-LAB 2026) — "harmony as fertility".
// The plants are its plants: lsystem.js is a port of the L-system gene bank and 3D turtle from
// TLI's plant.js (14 species: grass, fern, bush, tree, vine, palm, blossom…), projected onto a
// 2D canvas so the example stays zero-dependency and light. The performance semantics:
//
//   single note      → a seed falls where the pitch sits; the note's pitch class picks the
//                      species, its velocity picks the size class
//   consonant triad  → BLOOM: every plant stretches upward, flowers open on the branch tips in
//                      the chord root's colour, fertility surges, a few new seeds fall
//   mild dissonance  → WIND: a gust runs through the branches, leaves tear loose
//   cluster          → DECAY: branches droop and brown, leaves and petals fall, spores rise;
//                      dissonance is fuel, not failure — what rots makes room
//
// The world listens to chord/* signals — it has no idea whether a pianist, a sequencer, or a
// QWERTY keyboard is playing. That's the layer contract. (The self-playing gardener at the bottom
// is just another performer: it presses the on-screen piano, the world cannot tell.)
//
// Branch language © Che-Yu Wu 吳哲宇, The Last Input, 2026 — demo purpose, all rights reserved.
// The framework is MIT.

import { createShow } from '@openav/show';
import { createCanvas } from '@openav/stage';
import { growSkeleton, makeGene } from './lsystem.js?v=cfa5659';

const TAU = Math.PI * 2;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const smooth = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const hsl = (h, s, l, a = 1) => `hsla(${((h % 360) + 360) % 360},${s.toFixed(0)}%,${l.toFixed(0)}%,${a.toFixed(3)})`;

// pitch class → species (C = the tree, D = grass …): same note, same plant, so a melody reads as a skyline
const SPECIES_BY_PC = ['tree', 'grass', 'fern', 'bush', 'vine', 'reed', 'palm', 'spiral', 'monstera', 'glower', 'blossom', 'anthurium'];
// how woody a species is (trunk drawn bark-brown fading to the leaf hue at the twig tips)
const WOODY = { tree: 0.9, blossom: 0.8, bush: 0.6, palm: 0.6, berry: 0.5, vine: 0.3, monstera: 0.25, spiral: 0.3 };
const SIZE_TWEAK = { rafflesia: 0.5, grass: 0.85, anthurium: 0.9 };

const LITE = Math.min(innerWidth, innerHeight) < 560 || matchMedia('(pointer:coarse)').matches;
const MAX_PLANTS = LITE ? 12 : 26;

// ---------- one plant: a gene, a skeleton, a growth clock ----------
class Plant {
  constructor({ gene, x, baseY, depth, size, pc, lush }) {
    this.gene = gene; this.x = x; this.baseY = baseY; this.depth = depth; this.pc = pc;
    const sk = growSkeleton(gene);
    const c = Math.cos(gene.roll), s = Math.sin(gene.roll);
    // roll about the vertical axis and scale to pixels; y up. pts = [ax, ay, bx, by] per segment
    let wid = 1e-6;
    const raw = new Float32Array(sk.n * 4);
    for (let i = 0; i < sk.n; i++) {
      const o = i * 6;
      raw[i * 4] = sk.seg[o] * c - sk.seg[o + 2] * s; raw[i * 4 + 1] = sk.seg[o + 1];
      raw[i * 4 + 2] = sk.seg[o + 3] * c - sk.seg[o + 5] * s; raw[i * 4 + 3] = sk.seg[o + 4];
      wid = Math.max(wid, Math.abs(raw[i * 4 + 2]));
    }
    const k = Math.min(size / sk.height, size * 0.85 / wid);   // fit the pixel size; never wider than tall
    this.k = k; this.Hn = sk.height * k;
    this.n = sk.n; this.dep = sk.depth;
    this.pts = raw.map(v => v * k);
    this.maxD = Math.min(5, sk.depth[sk.n - 1] || 0);
    this.bucket = new Int32Array(this.maxD + 2);   // first segment index of each branch-order bucket
    for (let b = 0, i = 0; b <= this.maxD; b++) { this.bucket[b] = i; while (i < sk.n && Math.min(5, sk.depth[i]) === b) i++; }
    this.bucket[this.maxD + 1] = sk.n;
    this.scr = new Float32Array(sk.n * 4);
    const proj = (p, h) => ({
      x: (p[0] * c - p[2] * s) * k, y: p[1] * k,
      hx: h ? h[0] * c - h[2] * s : 0, hy: h ? h[1] : 1,
    });
    const rnd = () => Math.random();
    // leaf tips (TLI: every 2nd tip, last 8 for broad / 14 otherwise), thresholds stagger the unfurling
    this.leaves = [];
    if (gene.leaf !== 'none') {
      const stride = gene.leaf === 'frond' ? 1 : 2, cap = gene.leaf === 'broad' ? 8 : 14;
      for (const t of sk.tips.filter((_, i) => i % stride === 0).slice(-cap))
        this.leaves.push({ ...proj(t.p, t.h), on: 0.4 + rnd() * 0.3, drop: 0.2 + rnd() * 0.7, gone: false, a: (rnd() - 0.5) * 0.9, side: rnd() < 0.5 ? 1 : -1 });
    }
    // flower spots: the crown, then branch tips (natural flowers use them all, a bloom uses `lush` of them)
    this.spots = [{ ...proj(sk.top, null), drop: 0.15 + rnd() * 0.5, gone: false, r0: rnd() * TAU }];
    for (const t of sk.tips.filter((_, i) => i % 2 === 0).slice(-6)) this.spots.push({ ...proj(t.p, t.h), drop: 0.15 + rnd() * 0.6, gone: false, r0: rnd() * TAU });
    this.fruits = gene.fruit ? sk.tips.filter((_, i) => i % 2 === 1).slice(-6).map(t => ({ ...proj(t.p, t.h), gone: false, drop: 0.2 + rnd() * 0.5 })) : [];
    this.nSpots = this.gene.flower ? this.spots.length : 0;
    this.wood = WOODY[gene.species] ?? 0.15;
    // clocks
    this.age = 0; this.maturity = 0; this.rot = 0; this.bloom = 0; this.pulse = 0;
    this.life = 70 + Math.random() * 50;   // seconds
    this.fade = 1; this.dying = false; this.dead = false;
    this.ph = this.x * 0.7 + this.baseY * 0.5;
    this.droop = Math.random() < 0.5 ? -1 : 1;
    this.bloomHue = 0; this.lush = lush;
    this.seedT = 0.55;   // seed fall time before germination
  }

  update(dt, w) {
    this.age += dt;
    if (this.age < this.seedT) return;
    const g = this.gene;
    if (this.maturity < 1 && !this.dying) this.maturity = Math.min(1, this.maturity + g.speed * 60 * 0.35 * w.growth * (0.55 + 1.7 * w.fert) * (1 - this.rot * 0.7) * dt);
    this.pulse = Math.max(0, this.pulse - dt * 0.2);
    this.bloom = Math.max(0, this.bloom - dt * 0.042);
    this.rot = this.dying ? Math.min(1, this.rot + dt * 0.4) : Math.max(0, this.rot - dt * 0.02);
    this.life -= dt;
    if (!this.dying && (this.life <= 0 || this.rot >= 0.999)) this.dying = true;
    if (this.dying) { this.fade = Math.max(0, this.fade - dt / 5.5); if (this.fade <= 0) this.dead = true; }
  }

  /** screen position of a point in plant space (also what draw() does per vertex) */
  at(px, py, w, out) {
    const u = py / this.Hn, uq = u * (0.35 + 0.65 * u);
    const shr = 1 - this.rot * 0.22 - (this.dying ? 0.2 * (1 - this.fade) : 0);
    out.x = this.x + px * shr + w.sway * this.Hn * 1.3 * uq + this.droop * this.rot * 0.5 * this.Hn * u * u;
    out.y = this.baseY - py * w.lift * shr * this.grow + this.rot * 0.22 * this.Hn * u * u;
  }

  draw(ctx, w, T) {
    if (this.age < this.seedT) return this.drawSeed(ctx, T);
    const em = smooth(this.maturity), vis = em * this.n;
    this.grow = 1;
    const full = Math.min(this.n, Math.floor(vis)), frac = vis - full;
    const hueDeg = this.gene.hue * 360 + (w.palette - 110) + (this.pc - 5.5) * 3;
    const L = this.gene.light * 100, depthA = 0.5 + 0.5 * this.depth, A = this.fade * depthA;
    const lift = w.lift = 1 + 0.17 * smooth(this.bloom * 2.2) + 0.05 * this.pulse;
    // shadow on the ground
    ctx.globalAlpha = 0.35 * A * Math.min(1, this.maturity * 3 + 0.2);
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(this.x, this.baseY + 2, this.Hn * 0.2 * (0.3 + em), this.Hn * 0.035, 0, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
    // sway, TLI's three-wave mix (fast ripple, fine tremor, slow breath), per-plant phase; tall = slow
    const fq = 1.5 / (0.55 + this.gene.scale * 0.6);
    const amp = 0.03 + 0.11 * Math.min(w.wind, 1.7);
    w.sway = (Math.sin(T * fq + this.ph) * 0.6 + Math.sin(T * fq * 2.6 + this.ph * 1.7) * 0.22 + Math.sin(T * 0.31 + this.ph * 0.4) * 0.35) * amp;
    const flut = this.Hn * 0.018 * w.wind * w.wind, Hn = this.Hn, bx = this.x, by = this.baseY;
    const shr = 1 - this.rot * 0.22 - (this.dying ? 0.2 * (1 - this.fade) : 0);
    const swayK = w.sway * Hn * 1.3, dX = this.droop * this.rot * 0.5 * Hn, dY = this.rot * 0.22 * Hn, ly = lift * shr;
    const p = this.pts, o = this.scr, hn = 1 / Hn, nn = Math.min(this.n, full + 1);
    for (let i = 0; i < nn; i++) {
      let ax = p[i * 4], ay = p[i * 4 + 1], cx = p[i * 4 + 2], cy = p[i * 4 + 3];
      if (i === full) { cx = ax + (cx - ax) * frac; cy = ay + (cy - ay) * frac; }   // the growing tip
      const ua = ay * hn, ub = cy * hn;
      const fl = flut * Math.sin(T * 3.1 + (ay + this.ph) * 0.045);
      o[i * 4] = bx + ax * shr + (swayK + dX * ua) * ua * (0.35 + 0.65 * ua) + (ua > 0 ? fl * ua : 0);
      o[i * 4 + 1] = by - ay * ly + dY * ua * ua;
      o[i * 4 + 2] = bx + cx * shr + (swayK + dX * ub) * ub * (0.35 + 0.65 * ub) + fl * ub;
      o[i * 4 + 3] = by - cy * ly + dY * ub * ub;
    }
    // branches: one stroked path per branch order, bark → twig colour
    const rot = this.rot, bw = Math.max(0.9, Hn * 0.0125) * (this.wood > 0.5 ? 1.6 : 1);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (let b = 0; b <= this.maxD; b++) {
      const s0 = this.bucket[b], s1 = Math.min(this.bucket[b + 1], nn);
      if (s1 <= s0) continue;
      const t = this.maxD ? b / this.maxD : 1;
      const dh = (((hueDeg - 36 + 540) % 360) - 180) * t;
      const bark = this.wood * (1 - t);
      let h = 36 + dh, sat = 30 + 42 * (1 - bark) * (0.6 + 0.4 * t), lt = L * (0.38 + 0.62 * t) + 2;
      h = h * (1 - rot) + 26 * rot; sat *= 1 - 0.6 * rot; lt *= 1 - 0.32 * rot;
      ctx.strokeStyle = hsl(h, sat, lt, A * (1 - 0.3 * rot));
      ctx.lineWidth = Math.max(0.7, bw * Math.pow(0.66, b));
      ctx.beginPath();
      for (let i = s0; i < s1; i++) { ctx.moveTo(o[i * 4], o[i * 4 + 1]); ctx.lineTo(o[i * 4 + 2], o[i * 4 + 3]); }
      ctx.stroke();
    }
    // leaves, flowers, fruit — unfurl with maturity, fall with rot
    const leafH = (hueDeg - rot * 80) , leafS = 58 * (1 - 0.5 * rot), leafL = L * 0.78 * (1 - 0.3 * rot);
    this.drawLeaves(ctx, w, A, leafH, leafS, leafL);
    this.drawBlooms(ctx, w, A, hueDeg, T);
  }

  drawSeed(ctx, T) {
    const u = this.age / this.seedT, y = -12 + (this.baseY + 4 + 12) * u * u;
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = hsl(this.gene.hue * 360 + 40, 90, 70, 0.25);
    ctx.beginPath(); ctx.arc(this.x, y, 9, 0, TAU); ctx.fill();
    ctx.fillStyle = hsl(this.gene.hue * 360 + 40, 90, 85, 0.95);
    ctx.beginPath(); ctx.arc(this.x, y, 2.4, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }

  drawLeaves(ctx, w, A, h, s, l) {
    if (!this.leaves.length) return;
    const kind = this.gene.leaf;
    // TLI leaf sizes are in plant units; our skeletons are fitted to pixels, so cap a leaf by the plant's own height
    // (a monstera stays a monstera instead of one 600 px leaf)
    const ls = Math.min(this.k * (kind === 'broad' ? 0.34 : 0.2), this.Hn * (kind === 'broad' ? 0.17 : kind === 'frond' ? 0.08 : 0.065)) * (0.8 + this.lush * 0.5);
    const wid = kind === 'broad' ? 0.62 : kind === 'frond' ? 0.32 : 0.34;
    const out = { x: 0, y: 0 };
    ctx.fillStyle = hsl(h, s, l, A * 0.82); ctx.strokeStyle = hsl(h, s, l + 8, A * 0.8); ctx.lineWidth = 1;
    ctx.beginPath();
    for (const lf of this.leaves) {
      const open = smooth((this.maturity - lf.on) * 4) * (lf.gone ? 0 : 1);
      if (this.rot > lf.drop && !lf.gone) { lf.gone = true; w.shed(this, lf, 'leaf', h, s, l); }
      if (this.rot < 0.08 && lf.gone) lf.gone = false;
      if (open <= 0.01) continue;
      this.at(lf.x, lf.y, w, out);
      const hx = lf.hx, hy = -lf.hy;   // heading on screen (y down)
      const sw = w.sway * 3 + lf.a + lf.side * 0.35 + this.rot * 0.9 * this.droop;
      const cs = Math.cos(sw), sn = Math.sin(sw);
      const dx = hx * cs - hy * sn, dy = hx * sn + hy * cs, px = -dy, py = dx, len = ls * open;
      if (kind === 'frond') {   // pinnate: a spine with paired leaflets
        const ex = out.x + dx * len * 3.2, ey = out.y + dy * len * 3.2;
        ctx.moveTo(out.x, out.y); ctx.lineTo(ex, ey);
        for (let j = 1; j <= 4; j++) {
          const f = j / 4.6, cx = out.x + dx * len * 3.2 * f, cy = out.y + dy * len * 3.2 * f, ll = len * (1.1 - f * 0.5);
          ctx.moveTo(cx, cy); ctx.lineTo(cx + (px * 0.9 + dx * 0.5) * ll, cy + (py * 0.9 + dy * 0.5) * ll);
          ctx.moveTo(cx, cy); ctx.lineTo(cx + (-px * 0.9 + dx * 0.5) * ll, cy + (-py * 0.9 + dy * 0.5) * ll);
        }
      } else {
        const L2 = len * 2, mx = out.x + dx * L2 * 0.42, my = out.y + dy * L2 * 0.42, wd = L2 * wid;
        ctx.moveTo(out.x, out.y);
        ctx.quadraticCurveTo(mx + px * wd * 1.15, my + py * wd * 1.15, out.x + dx * L2, out.y + dy * L2);
        ctx.quadraticCurveTo(mx - px * wd * 1.15, my - py * wd * 1.15, out.x, out.y);
      }
    }
    kind === 'frond' ? ctx.stroke() : ctx.fill();
  }

  drawBlooms(ctx, w, A, hueDeg, T) {
    const out = { x: 0, y: 0 }, rot = this.rot;
    // natural flowers/fruit (species gene) and chord-driven bloom (any species, root-coloured)
    const natural = this.gene.flower ? smooth((this.maturity - 0.8) * 5) : 0;
    const bloom = smooth(this.bloom * 3) * smooth((this.maturity - 0.3) * 4);
    const open = Math.max(natural, bloom);
    if (open > 0.02) {
      const nb = this.gene.flower ? this.spots.length : Math.max(1, Math.round(1 + this.lush * (this.spots.length - 2)));
      const fh = this.gene.flower && natural >= bloom ? this.gene.flower[0] * 360 + (w.palette - 110) : this.bloomHue;
      const R = Math.max(4, Math.min(13, this.k * 0.13)) * (0.7 + this.lush * 0.5) * open * (1 - rot * 0.5);
      for (let i = 0; i < Math.min(nb, this.spots.length); i++) {
        const sp = this.spots[i];
        if (rot > sp.drop && !sp.gone) { sp.gone = true; w.shed(this, sp, 'petal', fh, 80, 70); }
        if (rot < 0.08 && sp.gone) sp.gone = false;
        if (sp.gone) continue;
        this.at(sp.x, sp.y, w, out);
        const r = R * (i === 0 ? 1.2 : 0.85), a0 = sp.r0 + T * 0.15 + w.sway * 2;
        if (!w.lite) {   // soft halo: additive, cheap enough for a few dozen
          ctx.globalCompositeOperation = 'lighter';
          ctx.fillStyle = hsl(fh, 90, 60, 0.07 * A * open);
          ctx.beginPath(); ctx.arc(out.x, out.y, r * 1.9, 0, TAU); ctx.fill();
          ctx.globalCompositeOperation = 'source-over';
        }
        ctx.fillStyle = hsl(fh, 88 * (1 - 0.5 * rot), 64 - 22 * rot, A * 0.95);
        ctx.beginPath();
        for (let q = 0; q < 5; q++) {
          const a = a0 + q * TAU / 5, ca = Math.cos(a), sa = Math.sin(a), tx = out.x + ca * r, ty = out.y + sa * r;
          const c1x = out.x + ca * r * 0.35 - sa * r * 0.62, c1y = out.y + sa * r * 0.35 + ca * r * 0.62;
          const c2x = out.x + ca * r * 0.35 + sa * r * 0.62, c2y = out.y + sa * r * 0.35 - ca * r * 0.62;
          ctx.moveTo(out.x, out.y); ctx.bezierCurveTo(c1x, c1y, c1x + ca * r * 0.5, c1y + sa * r * 0.5, tx, ty);
          ctx.bezierCurveTo(c2x + ca * r * 0.5, c2y + sa * r * 0.5, c2x, c2y, out.x, out.y);
        }
        ctx.fill();
        ctx.fillStyle = hsl(48, 90, 70, A);
        ctx.beginPath(); ctx.arc(out.x, out.y, Math.max(1.2, r * 0.18), 0, TAU); ctx.fill();
        if (Math.random() < 0.0016 * open * (w.lite ? 0.5 : 1)) w.shed(this, sp, 'petal', fh, 80, 72, true);   // ambient petal fall
      }
    }
    if (this.fruits.length) {
      const f = smooth((this.maturity - 0.72) * 4);
      if (f > 0.02) {
        const fh = this.gene.fruit[0] * 360 + (w.palette - 110), r = Math.max(2.5, Math.min(this.k * 0.07, this.Hn * 0.03)) * f;
        ctx.fillStyle = hsl(fh, 80 * (1 - 0.5 * rot), 58 - 20 * rot, A * 0.95);
        ctx.beginPath();
        for (const fr of this.fruits) {
          if (rot > fr.drop && !fr.gone) { fr.gone = true; w.shed(this, fr, 'fruit', fh, 80, 58); }
          if (rot < 0.08 && fr.gone) fr.gone = false;
          if (fr.gone) continue;
          this.at(fr.x, fr.y - 0.04 * this.k, w, out);
          ctx.moveTo(out.x + r, out.y); ctx.arc(out.x, out.y, r, 0, TAU);
        }
        ctx.fill();
      }
    }
  }
}

// ---------- world ----------
const gardenWorld = {
  name: 'garden',
  params: [
    { key: 'growth',   label: 'Growth rate', min: 0,   max: 2,   def: 1 },
    { key: 'wind',     label: 'Wind',        min: 0,   max: 1,   def: 0.1 },
    { key: 'decay',    label: 'Decay press', min: 0,   max: 1,   def: 0 },
    { key: 'paletteShift', label: 'Palette', min: 0,   max: 360, def: 110 },
    { key: 'lush',     label: 'Lushness',    min: 0,   max: 1,   def: 0.65 },   // leaf size and how many tips flower in a bloom
    { key: 'density',  label: 'Seed density', min: 0.3, max: 1.6, def: 1 },     // how many plants one gesture sows
  ],
  init({ container, signals }) {
    this.view = createCanvas(container);
    this.plants = [];
    this.bits = [];            // falling leaves/petals/spores/pollen
    this.fert = 0;             // fertility surge from blooms (decays)
    this.gust = 0;
    this.T = 0; this.s = {};
    this.cost = 0; this.lite = LITE;
    this.W = { shed: (p, o, kind, h, s, l, soft) => this.shed(p, o, kind, h, s, l, soft), lite: this.lite };
    this.motes = Array.from({ length: LITE ? 14 : 30 }, () => ({ x: Math.random(), y: Math.random(), p: Math.random() * TAU, v: 0.2 + Math.random() * 0.5 }));
    this._unsub = signals.on('chord/event', (a) => this.onChord(a));
  },

  // ---- sowing ----
  sow(note, vel = 0.7, { blessed = false, delay = 0, bloomHue = null } = {}) {
    const { w, h } = this.view.fit();
    const pc = ((note % 12) + 12) % 12;
    const u = clamp((note - 50) / 32, 0, 1);
    // best-of-five jitter: the candidate farthest from its neighbours, so the bed doesn't clump
    let x = 0, best = -1;
    for (let c = 0; c < 5; c++) {
      const cx = clamp(w * (0.06 + 0.88 * u) + (Math.random() - 0.5) * w * 0.22, w * 0.04, w * 0.96);
      let d = 1e9; for (const p of this.plants) if (!p.dying) d = Math.min(d, Math.abs(p.x - cx));
      if (d > best) { best = d; x = cx; }
    }
    const depth = Math.random();
    const baseY = h * (0.66 + 0.27 * depth);
    const seed = Math.random() * 1e6; let sd = seed;
    const rand = () => (sd = (sd * 9301 + 49297) % 233280) / 233280;
    const named = Math.random() < 0.55 ? SPECIES_BY_PC[pc] : null;
    const gene = makeGene(rand, clamp(vel, 0, 1), 0.3, named);
    const ref = Math.min(h, w * 1.1);
    const size = clamp(ref * 0.46 * Math.pow(gene.scale, 0.8) * (0.6 + 0.4 * depth) * (SIZE_TWEAK[gene.species] ?? 1), ref * 0.09, ref * 0.66);
    const plant = new Plant({ gene, x, baseY, depth, size, pc, lush: this.s.lush ?? 0.65 });
    plant.bloomHue = bloomHue ?? (this.s.paletteShift ?? 110) + 180 + pc * 28;
    plant.age = -delay;
    plant.seedT = 0.55;
    if (blessed) { plant.bloom = 1; plant.bloomHue = bloomHue ?? plant.bloomHue; }
    this.plants.push(plant);
    // cap: elders step aside gracefully (they wither, not pop)
    const alive = this.plants.filter(p => !p.dying);
    if (alive.length > MAX_PLANTS) { const o = alive.reduce((m, p) => (p.age > m.age ? p : m), alive[0]); o.dying = true; }
    return plant;
  },

  shed(p, o, kind, h, s, l, soft = false) {
    if (this.bits.length > (LITE ? 160 : 360)) return;
    const out = { x: 0, y: 0 }; p.at(o.x, o.y, { sway: this.W.sway ?? 0, lift: 1 + 0.17 * smooth(p.bloom * 2.2) }, out);
    p.grow = 1;
    this.bits.push({ kind, x: out.x, y: out.y, vx: (Math.random() - 0.5) * 14, vy: soft ? 4 : -4 + Math.random() * 6, rot: Math.random() * TAU, vr: (Math.random() - 0.5) * 4,
      life: 1, size: kind === 'leaf' ? 3.5 + Math.random() * 3 : kind === 'fruit' ? 3 : 3 + Math.random() * 2, h, s, l, ph: Math.random() * TAU, ground: p.baseY + Math.random() * 6 });
  },

  onChord(a) {
    const { w, h } = this.view.fit();
    const d = this.s.density ?? 1, vel = a.vel ?? 0.7;
    const notes = a.notes?.length ? a.notes : [a.root];
    if (a.count === 1) {
      this.sow(a.root, vel);
    } else if (a.isTriad && a.thirdsFraction > 0.5) {
      // genuine stacked thirds → bloom. Every standing plant stretches and opens in the root's colour;
      // the chord's own notes fall as fresh seeds that arrive already blessed.
      const hue = ((this.s.paletteShift ?? 110) + 180 + (a.root % 12) * 28) % 360;
      for (const p of this.plants) if (!p.dying) { p.bloom = 1; p.pulse = 1; p.bloomHue = (hue + (Math.random() - 0.5) * 36 + 360) % 360; p.rot = Math.max(0, p.rot - 0.25); }
      this.fert = Math.min(1.4, this.fert + 1);
      notes.slice(0, 3).forEach((n, i) => this.sow(n + 12 * (i % 2), 0.6 + vel * 0.4, { blessed: true, delay: i * 0.12, bloomHue: hue }));
      for (let i = 1; i < Math.round(d * 2); i++) this.sow(notes[0] + (Math.random() * 14 - 4), vel, { delay: 0.3 + i * 0.2 });
      for (let i = 0; i < (LITE ? 18 : 40); i++) this.bits.push({ kind: 'pollen', x: Math.random() * w, y: h * (0.4 + Math.random() * 0.5), vx: (Math.random() - 0.5) * 12, vy: -10 - Math.random() * 18, life: 1, rot: 0, vr: 0, size: 1 + Math.random() * 1.6, h: hue, s: 90, l: 72, ph: Math.random() * TAU });
    } else if (a.dissonanceLevel === 2) {
      // cluster → decay wave: branches droop and brown; some plants will not recover
      for (const p of this.plants) if (!p.dying) p.rot = Math.min(1, p.rot + 0.3 + Math.random() * 0.4 * (0.6 + vel * 0.6));
      this.fert *= 0.3;
      for (let i = 0; i < (LITE ? 40 : 90); i++)
        this.bits.push({ kind: 'spore', x: Math.random() * w, y: h - Math.random() * h * 0.35, vx: (Math.random() - 0.5) * 20, vy: -6 - Math.random() * 22, life: 1, rot: 0, vr: 0, size: 1 + Math.random() * 1.6, h: 32, s: 45, l: 55, ph: Math.random() * TAU });
    } else if (a.dissonanceLevel === 1) {
      this.gust = 1;   // storm warning: wind gust, a few leaves tear loose
      for (const p of this.plants) if (!p.dying && p.leaves.length && Math.random() < 0.5) { const lf = p.leaves[(Math.random() * p.leaves.length) | 0]; if (!lf.gone) this.shed(p, lf, 'leaf', p.gene.hue * 360 + (this.s.paletteShift - 110), 50, 38); }
    } else if (a.isConsonant) {
      // a softer harmony (7ths, 6ths…): two seeds and a small lift
      for (const p of this.plants) if (!p.dying) { p.bloom = Math.max(p.bloom, 0.45); p.pulse = Math.max(p.pulse, 0.5); }
      this.fert = Math.min(1.4, this.fert + 0.4);
      for (let i = 0; i < Math.max(1, Math.round(d * 2)); i++) this.sow(notes[i % notes.length], vel, { delay: i * 0.15 });
    }
  },

  update(dt, s) {
    dt = Math.min(dt, 0.1);
    this.s = s; this.T += dt;
    this.gust = Math.max(0, this.gust - dt * 0.4);
    this.fert = Math.max(0, this.fert - dt * 0.12);
    const wind = s.wind + this.gust;
    // param-driven decay pressure (mappable to a knob / hand / timeline)
    if (s.decay > 0.02) for (const p of this.plants) if (!p.dying && Math.random() < s.decay * dt * 2) p.rot = Math.min(1, p.rot + 0.12 + 0.2 * s.decay);
    const W = this.W;
    W.growth = s.growth ?? 1; W.fert = this.fert; W.wind = wind; W.palette = s.paletteShift ?? 110; W.lite = this.lite; W.lift = 1; W.sway = 0;
    for (const p of this.plants) { p.lush = s.lush ?? 0.65; p.update(dt, W); }
    this.plants = this.plants.filter(p => !p.dead);
    for (const b of this.bits) {
      b.life -= dt * (b.kind === 'pollen' ? 0.14 : b.kind === 'spore' ? 0.2 : 0.16);
      if (b.kind === 'leaf' || b.kind === 'petal' || b.kind === 'fruit') {
        b.vy = Math.min(b.vy + 26 * dt, 38); b.vx += (wind * 34 - b.vx) * dt * 0.8; b.rot += b.vr * dt;
        b.x += (b.vx + Math.sin(this.T * 1.8 + b.ph) * 9) * dt; b.y += b.vy * dt;
        if (b.y >= b.ground) { b.y = b.ground; b.vx *= 0.9; b.vy = 0; b.vr = 0; b.life -= dt * 0.35; }
      } else { b.x += (b.vx + Math.sin(this.T + b.ph) * 8 + wind * 14) * dt; b.y += b.vy * dt; b.vy *= 1 - dt * 0.15; }
    }
    this.bits = this.bits.filter(b => b.life > 0);
  },

  background(w, h) {
    if (this._bg && this._bg.w === w && this._bg.h === h) return this._bg.c;
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d');
    const sky = x.createLinearGradient(0, 0, 0, h * 0.68);
    sky.addColorStop(0, '#04060d'); sky.addColorStop(0.55, '#081322'); sky.addColorStop(1, '#10272a');
    x.fillStyle = sky; x.fillRect(0, 0, w, h);
    let seed = 7; const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 90; i++) { x.fillStyle = `rgba(200,220,255,${(0.1 + r() * 0.5).toFixed(2)})`; const sz = r() < 0.1 ? 1.6 : 0.9; x.fillRect(r() * w, r() * h * 0.5, sz, sz); }
    const moon = x.createRadialGradient(w * 0.8, h * 0.17, 0, w * 0.8, h * 0.17, h * 0.34);
    moon.addColorStop(0, 'rgba(190,225,230,0.20)'); moon.addColorStop(0.2, 'rgba(120,170,190,0.08)'); moon.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = moon; x.fillRect(0, 0, w, h);
    x.fillStyle = 'rgba(210,235,240,0.55)'; x.beginPath(); x.arc(w * 0.8, h * 0.17, Math.max(5, h * 0.016), 0, TAU); x.fill();
    for (const [base, amp, col, f] of [[0.6, 0.05, '#0b1c1f', 3.1], [0.64, 0.035, '#08161a', 5.3]]) {
      x.fillStyle = col; x.beginPath(); x.moveTo(0, h);
      for (let i = 0; i <= 40; i++) { const px = (i / 40) * w; x.lineTo(px, h * base - Math.sin(i / 40 * f + 1) * h * amp * 0.5 - Math.sin(i / 40 * f * 2.7) * h * amp * 0.3); }
      x.lineTo(w, h); x.fill();
    }
    const gr = x.createLinearGradient(0, h * 0.64, 0, h);
    gr.addColorStop(0, '#0d211f'); gr.addColorStop(0.25, '#0a1a17'); gr.addColorStop(1, '#030706');
    x.fillStyle = gr; x.fillRect(0, h * 0.64, w, h * 0.36);
    const vg = x.createRadialGradient(w / 2, h * 0.55, h * 0.3, w / 2, h * 0.55, Math.max(w, h) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.55)');
    x.fillStyle = vg; x.fillRect(0, 0, w, h);
    this._bg = { w, h, c };
    return c;
  },

  render() {
    const t0 = performance.now();
    const { ctx } = this.view, { w, h } = this.view.fit(), s = this.s || {};
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(this.background(w, h), 0, 0, w, h);
    // fertility glows from the soil
    if (this.fert > 0.02) {
      const g = ctx.createLinearGradient(0, h * 0.6, 0, h);
      const hue = ((s.paletteShift ?? 110) + 10) % 360;
      g.addColorStop(0, hsl(hue, 70, 45, 0)); g.addColorStop(0.5, hsl(hue, 70, 45, 0.10 * Math.min(1, this.fert))); g.addColorStop(1, hsl(hue, 70, 45, 0));
      ctx.fillStyle = g; ctx.fillRect(0, h * 0.6, w, h * 0.4);
    }
    // fireflies — more of them when the soil is rich
    ctx.globalCompositeOperation = 'lighter';
    const nm = Math.round(this.motes.length * (0.35 + 0.65 * Math.min(1, this.fert)));
    for (let i = 0; i < nm; i++) {
      const m = this.motes[i], tt = this.T * 0.3 * m.v + m.p;
      const x = (m.x + Math.sin(tt) * 0.04) * w, y = (0.3 + m.y * 0.6 + Math.cos(tt * 1.3) * 0.03) * h, a = 0.25 + 0.35 * Math.sin(this.T * m.v * 2 + m.p);
      ctx.fillStyle = `rgba(210,255,170,${(a * 0.5).toFixed(3)})`; ctx.beginPath(); ctx.arc(x, y, 2.4, 0, TAU); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    // far to near
    const order = this.plants.slice().sort((a, b) => a.depth - b.depth);
    for (const p of order) p.draw(ctx, this.W, this.T);
    // falling things
    for (const b of this.bits) {
      const a = Math.min(1, b.life * 2);
      if (b.kind === 'spore' || b.kind === 'pollen') {
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = hsl(b.h, b.s, b.l, (b.kind === 'pollen' ? 0.7 : 0.5) * a);
        ctx.fillRect(b.x, b.y, b.size, b.size);
        ctx.globalCompositeOperation = 'source-over';
      } else {
        ctx.fillStyle = hsl(b.h, b.s, b.l, 0.9 * a);
        ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.rot);
        ctx.beginPath(); ctx.ellipse(0, 0, b.size, b.size * 0.55, 0, 0, TAU); ctx.fill(); ctx.restore();
      }
    }
    // quality guard: if drawing ever costs > 11 ms for a couple of seconds, drop the halos
    this.cost = this.cost * 0.97 + (performance.now() - t0) * 0.03;
    if (!this.lite && this.cost > 11) this.lite = true;
  },
  dispose() { this._unsub?.(); this.view.dispose(); },
};

// ---------- assembly ----------
const show = await createShow({
  world: gardenWorld,
  timeline: {
    total: 120,
    automation: {
      growth: [[0, 0.6], [40, 1.4], [90, 0.8], [120, 0.2]],
      wind:   [[0, 0.05], [60, 0.3], [100, 0.7], [120, 0.1]],
    },
    scenes: [
      { id: 'dawn',  t: 0,   title: 'Dawn',       note: 'single seeds · listen' },
      { id: 'bloom', t: 40,  title: 'Full bloom', note: 'triads — stack real thirds' },
      { id: 'storm', t: 90,  title: 'Storm',      note: 'clusters welcome · decay is material' },
      { id: 'after', t: 110, title: 'After',      note: 'let it settle' },
    ],
  },
  modules: { keys: { base: 48 }, chord: true, sound: true },
  hint: 'play a TRIAD → bloom · a CLUSTER (adjacent keys) → decay · two notes a tritone apart → wind<br>use the piano, tick "keyboard" for QWERTY (Z/X octave), or just watch: the gardener plays itself until you do',
});

// ---------- the gardener: a performer, like any other ----------
// Opens with nobody at the keys, so the page grows a garden on its own. It uses the on-screen piano
// (the same path a hand takes), plays a slow loop — seeds, a bloom, a gust, a cluster, a rest —
// and steps aside for 20 s whenever a human (mouse, QWERTY, MIDI) plays. ?auto=0 keeps it silent.
{
  const piano = show.keys?.piano, sim = show.keys?.sim;
  const auto = new URLSearchParams(location.search).get('auto') !== '0';
  if (piano && sim && auto) {
    let mine = false, humanUntil = -1, userOff = false, t = 0, step = 0, nextAt = 0.8;
    const q = [];   // scheduled releases
    const box = [...document.querySelectorAll('.oav-keysbar label')].find(l => /simulate/i.test(l.textContent))?.querySelector('input');
    const press = (notes, vel, hold = 0.5) => {
      mine = true; for (const n of notes) { piano.press(n, vel); q.push({ n, at: t + hold }); } mine = false;
    };
    // tell a human hand from the gardener/SimPlayer: both come through piano.press, so flag our own
    const sp = sim.press; sim.press = (n, v) => { mine = true; sp(n, v); mine = false; };
    show.signals.on('midi/note/on', () => { if (!mine) humanUntil = t + 20; });
    box?.addEventListener('change', (e) => { if (e.isTrusted) userOff = !box.checked; });
    const setSim = (on) => { if (userOff && on) return; if (sim.enabled !== on) { sim.toggle(on); if (box) box.checked = on; } };
    const PENT = [0, 2, 4, 7, 9];
    const triad = (r, minor) => [r, r + (minor ? 3 : 4), r + 7];
    // a loop of 8 beats of ~3.2 s: [seed seed seed], bloom, bloom, gust, [seed], cluster, rest
    const score = [
      () => press([60 + PENT[(Math.random() * 5) | 0]], 0.5), () => press([67], 0.6), () => press([64 + 12 * (Math.random() < .5 ? 0 : 1)], 0.7),
      () => press(triad(55 + PENT[(Math.random() * 5) | 0], Math.random() < 0.25), 0.8, 0.7),
      () => press([72], 0.45), () => press(triad(60 + PENT[(Math.random() * 5) | 0], false), 0.85, 0.7),
      () => press([62, 68, 69], 0.7, 0.5),   // a tritone-and-a-second gust (mild dissonance)
      () => press([65], 0.55), () => press([69], 0.5),
      () => press(triad(57, true), 0.8, 0.7),
      () => press([60, 61, 62, 63], 0.9, 0.35),   // cluster
      () => press([71], 0.4), () => press([64], 0.5), () => press([60], 0.4),
    ];
    const tick = (now) => {
      const dt = Math.min(0.1, (now - (tick.last ?? now)) / 1000); tick.last = now; t += dt;
      for (let i = q.length - 1; i >= 0; i--) if (t >= q[i].at) { mine = true; piano.release(q[i].n); mine = false; q.splice(i, 1); }
      const human = t < humanUntil;
      setSim(!human);
      if (!human && !userOff && t >= nextAt) { score[step % score.length](); step++; nextAt = t + 1.6 + Math.random() * 2.2; }
      requestAnimationFrame(tick);
    };
    sim.density = LITE ? 0.7 : 0.9;
    requestAnimationFrame(tick);
  }
}
