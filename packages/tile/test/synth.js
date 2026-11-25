// A photo that was never taken: screens showing their markers, lying on a table, seen by a tilted camera.
// Pure JavaScript over typed arrays (grey levels 0…255), so the same scene is built in Node and in a browser.
// Used by test/detect.html (the browser end-to-end test) and to write the fixture photo.
//
//   const scene = sceneThree();                         // screens on the table (mm), a camera, the truth
//   const photo = renderPhoto(scene, { screenImage });  // { w, h, data: Uint8ClampedArray (grey) }
//
// screenImage(screen) → { w, h, data } is how a screen's markers become pixels: in a browser the tile's own
// drawMarkers on a real canvas; in Node the same function on a buffer.

import { similarityMatrix, mul3, inv3, apply3 } from '../solve.js';

export const deg = Math.PI / 180;
export const SCREENS = {
  laptop: { w: 2560, h: 1600, pitch: 25.4 / 227, bezel: 9 },     // mm per pixel; bezel in mm
  tablet: { w: 2048, h: 2732, pitch: 25.4 / 264, bezel: 8 },
  phone: { w: 1170, h: 2532, pitch: 25.4 / 460, bezel: 4 },
};
export const place = (s, x, y, a) => similarityMatrix({ a: s.pitch * Math.cos(a), b: s.pitch * Math.sin(a), tx: x, ty: y });

/** A pinhole camera H mm above (cx, cy), tilted and turned: table mm → photo px. */
export function camera({ cx = 0, cy = 0, H = 600, f = 3000, W = 4032, Hpx = 3024, tiltX = 0, tiltY = 0, roll = 0 }) {
  const Rx = [1, 0, 0, 0, Math.cos(tiltX), -Math.sin(tiltX), 0, Math.sin(tiltX), Math.cos(tiltX)];
  const Ry = [Math.cos(tiltY), 0, Math.sin(tiltY), 0, 1, 0, -Math.sin(tiltY), 0, Math.cos(tiltY)];
  const Rz = [Math.cos(roll), -Math.sin(roll), 0, Math.sin(roll), Math.cos(roll), 0, 0, 0, 1];
  const K = [f, 0, W / 2, 0, f, Hpx / 2, 0, 0, 1];
  return mul3(K, mul3(mul3(Rz, mul3(Ry, Rx)), [1, 0, -cx, 0, 1, -cy, 0, 0, H]));
}

/**
 * Three screens of three densities, each turned its own way, the phone lying across a corner of the laptop (stacked
 * last = on top), under a camera tilted by ~20°: the case the solver is for. Indices are the screens' numbers in the room.
 */
export function sceneThree({ W = 3200, H = 2400, fill = 0.86 } = {}) {
  const screens = [
    { id: 'laptop', index: 0, ...SCREENS.laptop, T: place(SCREENS.laptop, -175, -140, 4 * deg) },
    { id: 'tablet', index: 1, ...SCREENS.tablet, T: place(SCREENS.tablet, 150, -170, -14 * deg) },
    { id: 'phone', index: 2, ...SCREENS.phone, T: place(SCREENS.phone, 85, 20, 38 * deg) },
  ];
  return { W, H, screens, P: frame(screens, camera({ cx: 40, cy: -20, H: 640, f: 2400, W, Hpx: H, tiltX: 17 * deg, tiltY: -11 * deg, roll: 8 * deg }), W, H, fill) };
}

/** Zoom and shift in the image plane so the screens fill `fill` of the photo (still one perspective homography). */
export function frame(screens, P, W, H, fill) {
  const pts = screens.flatMap((s) => [[0, 0], [s.w, 0], [s.w, s.h], [0, s.h]].map((c) => apply3(mul3(P, s.T), c)));
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const k = fill * Math.min(W / (x1 - x0), H / (y1 - y0));
  return mul3([k, 0, W / 2 - k * (x0 + x1) / 2, 0, k, H / 2 - k * (y0 + y1) / 2, 0, 0, 1], P);
}

function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/**
 * Render the photo. For every photo pixel, the topmost screen (or its bezel, or the table) under it is sampled
 * through the inverse of camera · placement, with bilinear filtering and 2×2 supersampling; then a little sensor
 * noise. Screens are a touch less than white (no screen is paper) and the table is wood-grey with a grain.
 */
export function renderPhoto({ W, H, screens, P }, { screenImage, noise = 3, seed = 7, white = 235, black = 22 } = {}) {
  const out = new Uint8ClampedArray(W * H);
  const imgs = screens.map((s) => screenImage(s));
  const inv = screens.map((s) => inv3(mul3(P, s.T)));                 // photo px → screen px
  const toTable = inv3(P);                                            // photo px → table mm
  const bez = screens.map((s) => ({ x: s.bezel / s.pitch, y: s.bezel / s.pitch }));
  const rand = rng(seed);
  const sample = (img, x, y) => {
    const x0 = Math.floor(x - 0.5), y0 = Math.floor(y - 0.5), fx = x - 0.5 - x0, fy = y - 0.5 - y0;
    const at = (i, j) => img.data[Math.min(img.h - 1, Math.max(0, j)) * img.w + Math.min(img.w - 1, Math.max(0, i))];
    return (at(x0, y0) * (1 - fx) + at(x0 + 1, y0) * fx) * (1 - fy) + (at(x0, y0 + 1) * (1 - fx) + at(x0 + 1, y0 + 1) * fx) * fy;
  };
  const sub = [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]];
  for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
    let acc = 0;
    for (const [ox, oy] of sub) {
      const X = px + ox, Y = py + oy;
      let v = null;
      for (let k = screens.length - 1; k >= 0 && v == null; k--) {      // last screen is on top
        const s = screens[k], M = inv[k];
        const w = M[6] * X + M[7] * Y + M[8];
        const u = (M[0] * X + M[1] * Y + M[2]) / w, t = (M[3] * X + M[4] * Y + M[5]) / w;
        if (u >= 0 && t >= 0 && u < s.w && t < s.h) v = black + (white - black) * sample(imgs[k], u, t) / 255;
        else if (u >= -bez[k].x && t >= -bez[k].y && u < s.w + bez[k].x && t < s.h + bez[k].y) v = 34;   // the dark frame around the glass
      }
      if (v == null) {                                                // the table: light wood with a grain
        const [tx, ty] = apply3(toTable, [X, Y]);
        v = 150 + 9 * Math.sin(tx * 0.21 + Math.sin(ty * 0.013) * 6) + 4 * Math.sin(ty * 0.9 + tx * 0.05);
      }
      acc += v;
    }
    out[py * W + px] = acc / 4 + noise * (rand() + rand() + rand() - 1.5) * 2;
  }
  return { w: W, h: H, data: out };
}

/** The truth the solver should find: each screen's pixels → the reference screen's pixels. */
export function truthLayout({ screens }, reference = screens[0].id) {
  const ref = screens.find((s) => s.id === reference);
  return Object.fromEntries(screens.map((s) => [s.id, mul3(inv3(ref.T), s.T)]));
}

/** A grey buffer standing in for a 2D context, enough for drawMarkers (fillRect with '#fff' / '#000'). */
export function bufferContext(w, h) {
  const data = new Uint8ClampedArray(w * h).fill(255);
  return {
    data, w, h, fillStyle: '#000', font: '', textAlign: '', textBaseline: '',
    save() {}, restore() {}, setTransform() {}, fillText() {},
    fillRect(x, y, rw, rh) {
      const v = this.fillStyle === '#fff' ? 255 : this.fillStyle === '#000' ? 0 : 160;
      for (let j = Math.max(0, y); j < Math.min(h, y + rh); j++) data.fill(v, j * w + Math.max(0, x), j * w + Math.min(w, x + rw));
    },
  };
}
