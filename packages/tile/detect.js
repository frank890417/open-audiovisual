// @openav/tile · detect — find the markers in a photo. The camera page is the only page that loads this.
//
//   const cv = await loadOpenCV();                    // 10 MB, from the CDN, once; nothing else in OAV fetches it
//   const { found, ms } = detectMarkers(cv, canvasOrImageData);
//   // found: [{ id, corners: [[x, y] × 4] }] in photo pixels, OpenCV's corner order (top-left, top-right, bottom-right,
//   // bottom-left of the marker as drawn) — what correspondences() in marker.js expects
//
// Why OpenCV.js's ArUco and not an AprilTag WASM build:
//   • one pinned file on jsDelivr (the npm package @techstark/opencv-js, a plain build of OpenCV's own opencv.js),
//     loaded with a script tag, no build step — the same way @openav/pose loads MediaPipe;
//   • its ArUco detector reads AprilTag families too (DICT_APRILTAG_36h11 is in the same dictionary list), so the
//     choice of marker stays open without changing library;
//   • sub-pixel corner refinement is built in (CORNER_REFINE_SUBPIX), and the corners are what the solver lives on;
//   • the next step, a screen as a window posed in 3D, needs solvePnP — it is in the same file.
// The cost is size: ~10 MB (about 3 MB over the wire, compressed), on the camera page only, cached after the first visit.

import { DICT_NAME } from './dict.js';

export const OPENCV_VERSION = '4.12.0-release.1';
export const OPENCV_URL = `https://cdn.jsdelivr.net/npm/@techstark/opencv-js@${OPENCV_VERSION}/dist/opencv.js`;

let loading = null;

/** Load OpenCV.js once (a script tag), resolve with `cv` when its WebAssembly is ready. */
export function loadOpenCV(url = OPENCV_URL) {
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    // `cv` is an Emscripten module whose `then` calls back with the module itself. A promise resolved with such a
    // thenable unwraps it again, forever (one CPU core at 100 %, nothing settles). So wait for `cv.Mat` (the runtime
    // is up), then drop that `then`, which nothing needs any more, and only then hand `cv` over.
    const done = (cv) => { try { delete cv.then; } catch {} if (typeof cv.then === 'function') cv.then = undefined; resolve(cv); };
    const ready = (cv) => {
      if (cv && cv.Mat) return done(cv);
      if (cv && typeof cv === 'object' && !(cv instanceof Promise)) {
        let fired = false;
        const go = () => { if (!fired && cv.Mat) { fired = true; clearInterval(poll); done(cv); } };
        const prev = cv.onRuntimeInitialized;
        cv.onRuntimeInitialized = () => { try { prev?.(); } catch {} go(); };
        const poll = setInterval(go, 100);
        return;
      }
      if (cv instanceof Promise) return cv.then(ready, reject);
      reject(new Error('OpenCV loaded but `cv` is missing'));
    };
    if (globalThis.cv) return ready(globalThis.cv);
    const s = document.createElement('script');
    s.src = url; s.async = true; s.crossOrigin = 'anonymous';
    s.onload = () => ready(globalThis.cv);
    s.onerror = () => { loading = null; reject(new Error(`could not load OpenCV from ${url}`)); };
    document.head.appendChild(s);
  });
  return loading;
}

/** Grey pixels of a canvas / image / ImageData, at most `maxSide` pixels on the long side. → { data, w, h, scale } */
export function greyPixels(src, maxSide = 4096) {
  let img = src;
  if (!(typeof ImageData !== 'undefined' && src instanceof ImageData)) {
    const w0 = src.naturalWidth || src.videoWidth || src.width, h0 = src.naturalHeight || src.videoHeight || src.height;
    const k = Math.min(1, maxSide / Math.max(w0, h0));
    const c = document.createElement('canvas');
    c.width = Math.round(w0 * k); c.height = Math.round(h0 * k);
    c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
    img = c.getContext('2d').getImageData(0, 0, c.width, c.height);
    img.scale = k;
  }
  const n = img.width * img.height, g = new Uint8Array(n), d = img.data;
  for (let i = 0; i < n; i++) g[i] = (d[i * 4] * 77 + d[i * 4 + 1] * 150 + d[i * 4 + 2] * 29) >> 8;
  return { data: g, w: img.width, h: img.height, scale: img.scale || 1 };
}

/**
 * Detect the DICT_5X5_1000 markers in a photo.
 * @param {object} cv                       from loadOpenCV()
 * @param {HTMLCanvasElement|HTMLImageElement|ImageBitmap|ImageData|{data:Uint8Array,w:number,h:number}} src
 *                                          an image, or grey pixels already
 * @param {object} [o]
 * @param {number} [o.maxSide=4096]         larger photos are scaled down first (a 48 MP photo is slow and buys nothing)
 * @param {object} [o.params]               extra aruco_DetectorParameters fields
 * @returns {{ found: {id:number, corners:number[][]}[], rejected: number, ms: number, w: number, h: number }}
 *   corners in the photo's own pixels, in canvas convention (a pixel's edges on whole numbers; OpenCV puts its
 *   centres there, hence + 0.5)
 */
export function detectMarkers(cv, src, { maxSide = 4096, params = {} } = {}) {
  const g = src && src.data && src.w ? src : greyPixels(src, maxSide);
  const t0 = performance.now();
  const gray = new cv.Mat(g.h, g.w, cv.CV_8UC1);
  gray.data.set(g.data);
  const p = new cv.aruco_DetectorParameters();
  p.cornerRefinementMethod = cv.CORNER_REFINE_SUBPIX;
  Object.assign(p, params);
  const dict = cv.getPredefinedDictionary(cv[DICT_NAME]);
  const refine = new cv.aruco_RefineParameters(10, 3, true);
  const det = new cv.aruco_ArucoDetector(dict, p, refine);
  const corners = new cv.MatVector(), ids = new cv.Mat(), rej = new cv.MatVector();
  const found = [];
  let rejected = 0;
  try {
    det.detectMarkers(gray, corners, ids, rej);
    const k = 1 / (g.scale || 1);
    for (let i = 0; i < corners.size(); i++) {
      const c = corners.get(i), d = c.data32F;
      found.push({ id: ids.data32S[i], corners: [0, 1, 2, 3].map((j) => [(d[2 * j] + 0.5) * k, (d[2 * j + 1] + 0.5) * k]) });
      c.delete();
    }
    rejected = rej.size();
  } finally {
    for (const m of [gray, corners, ids, rej, det, refine, p, dict]) { try { m.delete(); } catch { /* already gone */ } }
  }
  return { found, rejected, ms: Math.round(performance.now() - t0), w: Math.round(g.w / (g.scale || 1)), h: Math.round(g.h / (g.scale || 1)) };
}
