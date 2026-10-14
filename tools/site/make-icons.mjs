#!/usr/bin/env node
// make-icons — rasterize the mark (chrome.mjs ICON_SVG) into the icon files the pages link.
//
//   node tools/site/make-icons.mjs          # favicon.svg, favicon.ico, apple-touch-icon.png, assets/icons/icon-{192,512}.png
//
// Run once, commit the files (they only change when the mark does). Needs `rsvg-convert` (brew install librsvg);
// the .ico is assembled here, from PNGs, with no other dependency (ICO may carry PNG images since Windows Vista).

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ICON_SVG, ICON_FILES } from './chrome.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'oav-icons-'));

function png(svg, size) {
  const src = path.join(tmp, `i${size}-${Math.random().toString(36).slice(2)}.svg`);
  fs.writeFileSync(src, svg);
  return execFileSync('rsvg-convert', ['-w', String(size), '-h', String(size), src]);
}

/** An .ico holding PNG images: 6-byte header, 16-byte entry per image, then the images. */
function ico(images) {
  const head = Buffer.alloc(6); head.writeUInt16LE(1, 2); head.writeUInt16LE(images.length, 4);
  let offset = 6 + 16 * images.length;
  const entries = images.map(({ size, data }) => {
    const e = Buffer.alloc(16);
    e[0] = size >= 256 ? 0 : size; e[1] = size >= 256 ? 0 : size;
    e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6); e.writeUInt32LE(data.length, 8); e.writeUInt32LE(offset, 12);
    offset += data.length;
    return e;
  });
  return Buffer.concat([head, ...entries, ...images.map((i) => i.data)]);
}

const write = (rel, data) => { const f = path.join(ROOT, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, data); console.log('wrote', rel, `(${data.length} bytes)`); };

write(ICON_FILES.svg, ICON_SVG(6) + '\n');
write(ICON_FILES.ico, ico([16, 32, 48].map((size) => ({ size, data: png(ICON_SVG(6), size) }))));
write(ICON_FILES.apple, png(ICON_SVG(0), 180));            // full-bleed: iOS rounds the corners itself
write(ICON_FILES.png192, png(ICON_SVG(6), 192));
write(ICON_FILES.png512, png(ICON_SVG(6), 512));
fs.rmSync(tmp, { recursive: true, force: true });
