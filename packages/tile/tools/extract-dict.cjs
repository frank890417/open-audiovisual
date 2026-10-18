#!/usr/bin/env node
// extract-dict.cjs — writes the marker table in packages/tile/dict.js from OpenCV itself, or checks it.
// Not part of `npm test` (it needs opencv.js, 10 MB, which the repository does not carry):
//
//   npm pack @techstark/opencv-js@4.12.0-release.1 && tar xzf techstark-opencv-js-4.12.0-release.1.tgz
//   OPENCV=package/dist/opencv.js node packages/tile/tools/extract-dict.cjs           # prints the HEX table
//   OPENCV=package/dist/opencv.js node packages/tile/tools/extract-dict.cjs --check   # exit 1 if dict.js differs
//
// Each marker is drawn by cv.generateImageMarker at one pixel per module (7 × 7: a black border around 5 × 5 bits) and
// read back row by row, so the table is what OpenCV's own detector expects to find.
const path = require('path');
const fs = require('fs');

const file = process.env.OPENCV;
if (!file) { console.error('OPENCV=<path to opencv.js> is required'); process.exit(2); }
let cv = require(path.resolve(file));

(async () => {
  if (cv instanceof Promise) cv = await cv;
  else if (!cv.Mat) await new Promise((r) => { cv.onRuntimeInitialized = r; });
  const dict = cv.getPredefinedDictionary(cv.DICT_5X5_1000);
  let hex = '';
  for (let id = 0; id < 1000; id++) {
    const img = new cv.Mat();
    cv.generateImageMarker(dict, id, 7, img, 1);
    let v = 0;
    for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) v = v * 2 + (img.ucharAt(y + 1, x + 1) > 127 ? 1 : 0);
    img.delete();
    hex += v.toString(16).padStart(7, '0');
  }
  if (!process.argv.includes('--check')) { console.log(hex); return; }
  const src = fs.readFileSync(path.join(__dirname, '..', 'dict.js'), 'utf8');
  const have = [...src.matchAll(/'([0-9a-f]+)'/g)].map((m) => m[1]).join('');
  if (have !== hex) { console.error('packages/tile/dict.js differs from OpenCV\'s DICT_5X5_1000'); process.exit(1); }
  console.log('dict.js matches OpenCV', cv.getBuildInformation().match(/Version control:\s*(\S+)/)?.[1] || '', 'DICT_5X5_1000 (1000 markers)');
})();
