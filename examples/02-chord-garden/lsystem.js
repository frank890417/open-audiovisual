// lsystem.js — the branch language of The Last Input, ported for the browser's 2D canvas.
//
// Source:   art-the-last-input/runner/system/plant.js  (Che-Yu Wu, 2026, ARCHETYPES + makeGene + 3D turtle)
// Ported:   2026-10-15. Not imported from the TLI repo; copied and cut down to the pure part.
//
// What is kept verbatim: the 14 species table (axiom / rules / iter / angle / len / ratio / hue /
// light / scale / speed / leaf / flower / fruit), the Gaussian "velocity picks the size class"
// species draw, the gene jitter, the string expansion, and the 3D turtle (H/L/U frame, the
// + - & ^ / \ [ ] alphabet, segments sorted by branch order so the trunk grows before the twigs).
// What is dropped: three.js (meshes, materials, scene), earthquake toppling, the OSC bridge.
// What is added: a species lookup by name, a seedable-friendly interface and expansion caching,
// so a garden can plant dozens without re-expanding strings.
//
// Artwork language © Che-Yu Wu 吳哲宇, 2026 (The Last Input). Framework MIT.

// leaf: 'none' | 'blade' | 'broad' | 'frond'  ·  flower / fruit: null or [h, s, l]
export const ARCHETYPES = [
  { name: 'grass',    axiom: 'X', rules: { X: 'F[+X][-X]', F: 'F' },             iter: 3, angle: 11, len: 0.10, ratio: 0.84, hue: 0.24, light: 0.60, scale: 0.75, speed: 0.016, leaf: 'blade', flower: null },
  { name: 'fern',     axiom: 'X', rules: { X: 'F[+X]F[-X]+X', F: 'FF' },         iter: 4, angle: 20, len: 0.11, ratio: 0.70, hue: 0.34, light: 0.60, scale: 1.00, speed: 0.010, leaf: 'frond', flower: null },
  { name: 'bush',     axiom: 'F', rules: { F: 'F[+F]F[-F][&F]F' },               iter: 3, angle: 28, len: 0.12, ratio: 0.66, hue: 0.30, light: 0.58, scale: 0.95, speed: 0.012, leaf: 'blade', flower: null },
  { name: 'tree',     axiom: 'X', rules: { X: 'F[&+X][&-X][/X]FX', F: 'FF' },     iter: 5, angle: 22, len: 0.15, ratio: 0.66, hue: 0.33, light: 0.66, scale: 1.40, speed: 0.007, leaf: 'broad', flower: null },
  { name: 'spiral',   axiom: 'X', rules: { X: 'F[&X]/[&X]/[&X]', F: 'FF' },       iter: 4, angle: 25, len: 0.12, ratio: 0.68, hue: 0.45, light: 0.70, scale: 1.05, speed: 0.011, leaf: 'blade', flower: null },
  { name: 'glower',   axiom: 'X', rules: { X: 'F[+X][&X][-X]', F: 'FF' },         iter: 4, angle: 18, len: 0.13, ratio: 0.70, hue: 0.13, light: 0.82, scale: 1.10, speed: 0.009, leaf: 'none',  flower: [0.13, 0.9, 0.7] },
  { name: 'palm',     axiom: 'X', rules: { X: 'FFF[&X][/&X][\\&X]', F: 'F' },     iter: 3, angle: 36, len: 0.20, ratio: 0.9,  hue: 0.30, light: 0.64, scale: 1.35, speed: 0.008, leaf: 'frond', flower: null },
  { name: 'monstera', axiom: 'X', rules: { X: 'F[+X][-X][&X]', F: 'F' },          iter: 3, angle: 40, len: 0.16, ratio: 0.82, hue: 0.36, light: 0.60, scale: 1.05, speed: 0.010, leaf: 'broad', flower: null },
  { name: 'vine',     axiom: 'X', rules: { X: 'F[+X]F[/X]-X', F: 'FF' },          iter: 5, angle: 32, len: 0.10, ratio: 0.78, hue: 0.28, light: 0.58, scale: 0.9,  speed: 0.013, leaf: 'blade', flower: null },
  { name: 'anthurium',axiom: 'X', rules: { X: 'F[+X][-X]', F: 'F' },              iter: 3, angle: 16, len: 0.12, ratio: 0.8,  hue: 0.35, light: 0.6,  scale: 0.85, speed: 0.012, leaf: 'broad', flower: [0.99, 0.85, 0.6] },
  { name: 'rafflesia',axiom: 'X', rules: { X: 'F[+F][-F][&F]', F: 'F' },          iter: 2, angle: 46, len: 0.10, ratio: 0.7,  hue: 0.05, light: 0.55, scale: 0.7,  speed: 0.016, leaf: 'none',  flower: [0.03, 0.7, 0.5] },
  { name: 'reed',     axiom: 'X', rules: { X: 'F[+X]', F: 'FF' },                 iter: 5, angle: 8,  len: 0.14, ratio: 0.92, hue: 0.22, light: 0.62, scale: 1.15, speed: 0.011, leaf: 'blade', flower: [0.14, 0.5, 0.6] },
  { name: 'blossom',  axiom: 'X', rules: { X: 'F[++X][--X][+/X][-\\X]', F: 'FF' }, iter: 4, angle: 34, len: 0.12, ratio: 0.72, hue: 0.31, light: 0.60, scale: 1.2,  speed: 0.009, leaf: 'blade', flower: [0.93, 0.72, 0.75], fruit: [0.93, 0.70, 0.76], pink: true },
  { name: 'berry',    axiom: 'X', rules: { X: 'F[+X][-X][&X][^X]X', F: 'F' },      iter: 3, angle: 28, len: 0.11, ratio: 0.66, hue: 0.34, light: 0.58, scale: 0.85, speed: 0.012, leaf: 'broad',  flower: null, fruit: [0.96, 0.75, 0.72], pink: true },
];

export const PLANT_SPECIES = ARCHETYPES.map(a => a.name);
const SMIN = 0.75, SMAX = 1.40;   // archetype scale range (grass → tree)

/** A gene from an archetype plus jitter. vel 0..1 = preferred size class (Gaussian-weighted, not a
 *  hard switch: a soft note occasionally plants a tree). `species` forces an archetype by name.
 *  rand: () => [0,1). */
export function makeGene(rand, vel = 0.7, pinkBias = 0, species = null) {
  const sigma = 0.4;
  const w = ARCHETYPES.map(a => {
    const norm = (a.scale - SMIN) / (SMAX - SMIN);
    let wt = Math.exp(-((norm - vel) ** 2) / (2 * sigma * sigma));
    if (a.name === 'tree' || a.name === 'palm') wt *= 1.9;   // tall trees are the forest's skeleton
    if (a.pink) wt *= 0.02 + pinkBias * 3.4;
    else if (a.flower) wt *= 0.12 + pinkBias * 2.0;
    return wt;
  });
  let r = rand() * w.reduce((s, x) => s + x, 0), idx = w.length - 1;
  for (let i = 0; i < w.length; i++) { r -= w[i]; if (r <= 0) { idx = i; break; } }
  if (species) { const f = ARCHETYPES.findIndex(x => x.name === species); if (f >= 0) idx = f; }
  const a = ARCHETYPES[idx];
  return {
    species: a.name, axiom: a.axiom, rules: a.rules, iter: a.iter,
    angle: a.angle + (rand() - 0.5) * 12,
    len: a.len * (0.75 + rand() * 0.5),
    ratio: a.ratio + (rand() - 0.5) * 0.07,
    hue: a.hue + (rand() - 0.5) * 0.05,
    light: a.light + (rand() - 0.5) * 0.08,
    scale: a.scale * (0.8 + rand() * 0.5) * (0.65 + vel * 0.7) * 0.6,
    roll: rand() * Math.PI * 2,
    speed: a.speed * (0.7 + rand() * 0.6),
    leaf: a.leaf || 'none',
    flower: a.flower ? a.flower.slice() : null,
    fruit: a.fruit ? a.fruit.slice() : null,
  };
}

const _expanded = new Map();   // axiom+rules+iter → string (strings repeat per species, expand once)
function expand(axiom, rules, iter) {
  const key = axiom + '|' + JSON.stringify(rules) + '|' + iter;
  let s = _expanded.get(key);
  if (s) return s;
  s = axiom;
  for (let i = 0; i < iter; i++) { let o = ''; for (const ch of s) o += (rules[ch] ?? ch); s = o; if (s.length > 9000) break; }
  _expanded.set(key, s);
  return s;
}

// small vector helpers on plain arrays (the turtle runs once per planting, not per frame)
const add = (a, b, k) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
function rodrigues(v, axis, ang) {   // axis is unit
  const c = Math.cos(ang), s = Math.sin(ang), d = v[0] * axis[0] + v[1] * axis[1] + v[2] * axis[2];
  const cx = [axis[1] * v[2] - axis[2] * v[1], axis[2] * v[0] - axis[0] * v[2], axis[0] * v[1] - axis[1] * v[0]];
  return [v[0] * c + cx[0] * s + axis[0] * d * (1 - c), v[1] * c + cx[1] * s + axis[1] * d * (1 - c), v[2] * c + cx[2] * s + axis[2] * d * (1 - c)];
}

/** 3D turtle → a skeleton in plant units (y up, trunk at the origin).
 *  Returns { n, seg: Float32Array(n*6) [ax,ay,az,bx,by,bz], depth: Uint8Array(n),
 *            tips: [{p:[x,y,z], h:[x,y,z], depth}], top: [x,y,z], height }
 *  Segments are sorted by branch order: reveal them in index order and the trunk
 *  grows first, twigs after (the "apical" feel). maxSegs is TLI's safety cap (600). */
export function growSkeleton(g, maxSegs = 600) {
  const str = expand(g.axiom, g.rules, g.iter);
  const segs = [], tips = [];
  const ang = g.angle * Math.PI / 180;
  let pos = [0, 0, 0], H = [0, 1, 0], L = [-1, 0, 0], U = [0, 0, 1];
  let len = g.len, depth = 0, top = [0, 0, 0];
  const stack = [];
  const rot = (axis, a) => { H = rodrigues(H, axis, a); L = rodrigues(L, axis, a); U = rodrigues(U, axis, a); };
  for (const ch of str) {
    switch (ch) {
      case 'F': { const np = add(pos, H, len); segs.push({ a: pos, b: np, depth }); pos = np; if (np[1] > top[1]) top = np; break; }
      case '+': rot(U.slice(), ang); break;
      case '-': rot(U.slice(), -ang); break;
      case '&': rot(L.slice(), ang); break;
      case '^': rot(L.slice(), -ang); break;
      case '/': rot(H.slice(), ang); break;
      case '\\': rot(H.slice(), -ang); break;
      case '[': stack.push({ pos, H, L, U, len, depth }); len *= g.ratio; depth++; break;
      case ']': { tips.push({ p: pos, h: H, depth }); const s = stack.pop(); if (s) ({ pos, H, L, U, len, depth } = s); break; }
    }
    if (segs.length > maxSegs) break;
  }
  tips.push({ p: pos, h: H, depth });
  segs.sort((a, b) => a.depth - b.depth);
  const n = segs.length, seg = new Float32Array(n * 6), dep = new Uint8Array(n);
  let height = 1e-6;
  for (let i = 0; i < n; i++) {
    const s = segs[i];
    seg.set([...s.a, ...s.b], i * 6);
    dep[i] = Math.min(255, s.depth);
    if (s.b[1] > height) height = s.b[1];
  }
  return { n, seg, depth: dep, tips, top, height };
}
