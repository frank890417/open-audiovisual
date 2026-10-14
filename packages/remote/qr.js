// @openav/remote · qr — a small QR code encoder (zero dependencies, ~150 lines).
//
//   qrSvg('https://openaudiovisual.com/packages/remote/?room=show-x7k2')   → an <svg> string for the join card
//   qrMatrix(text, { ecc: 'M' }) → { version, size, mask, rows }           rows: array of strings, '1' = dark module
//
// Byte mode (UTF-8), versions 1–10 (up to 213 bytes at level M, 271 at L), the smallest version that fits is chosen,
// and the mask with the lowest penalty. Not a general-purpose library: no numeric/alphanumeric/kanji modes, no
// structured append. A URL for a phone fits easily. The test (tests/qr.test.js) holds the output to known matrices
// produced by an independent encoder (segno), so a slip in a table or a bit order shows up as a diff.

// [blocks, codewords per block, data codewords per block] — one entry per block group (ISO/IEC 18004 Table 9)
const BLOCKS = [
  null,
  { L: [[1, 26, 19]], M: [[1, 26, 16]], Q: [[1, 26, 13]], H: [[1, 26, 9]] },
  { L: [[1, 44, 34]], M: [[1, 44, 28]], Q: [[1, 44, 22]], H: [[1, 44, 16]] },
  { L: [[1, 70, 55]], M: [[1, 70, 44]], Q: [[2, 35, 17]], H: [[2, 35, 13]] },
  { L: [[1, 100, 80]], M: [[2, 50, 32]], Q: [[2, 50, 24]], H: [[4, 25, 9]] },
  { L: [[1, 134, 108]], M: [[2, 67, 43]], Q: [[2, 33, 15], [2, 34, 16]], H: [[2, 33, 11], [2, 34, 12]] },
  { L: [[2, 86, 68]], M: [[4, 43, 27]], Q: [[4, 43, 19]], H: [[4, 43, 15]] },
  { L: [[2, 98, 78]], M: [[4, 49, 31]], Q: [[2, 32, 14], [4, 33, 15]], H: [[4, 39, 13], [1, 40, 14]] },
  { L: [[2, 121, 97]], M: [[2, 60, 38], [2, 61, 39]], Q: [[4, 40, 18], [2, 41, 19]], H: [[4, 40, 14], [2, 41, 15]] },
  { L: [[2, 146, 116]], M: [[3, 58, 36], [2, 59, 37]], Q: [[4, 36, 16], [4, 37, 17]], H: [[4, 36, 12], [4, 37, 13]] },
  { L: [[2, 86, 68], [2, 87, 69]], M: [[4, 69, 43], [1, 70, 44]], Q: [[6, 43, 19], [2, 44, 20]], H: [[6, 43, 15], [2, 44, 16]] },
];
const ALIGN = [null, [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];
const FORMAT_BITS = { L: 1, M: 0, Q: 3, H: 2 };
export const MAX_VERSION = 10;

// ---- Reed–Solomon over GF(256), x^8+x^4+x^3+x^2+1 ----
const EXP = new Uint8Array(512), LOG = new Uint8Array(256);
for (let i = 0, x = 1; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 256) x ^= 0x11d; }
for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
const mul = (a, b) => (a && b ? EXP[LOG[a] + LOG[b]] : 0);

function rsRemainder(data, n) {
  let gen = [1];                                             // ∏ (x − α^i), highest degree first
  for (let i = 0; i < n; i++) {
    const next = new Array(gen.length + 1).fill(0);
    for (let j = 0; j < gen.length; j++) { next[j] ^= gen[j]; next[j + 1] ^= mul(gen[j], EXP[i]); }
    gen = next;
  }
  const rem = new Array(n).fill(0);
  for (const b of data) {
    const f = b ^ rem.shift(); rem.push(0);
    for (let i = 0; i < n; i++) rem[i] ^= mul(gen[i + 1], f);
  }
  return rem;
}

const utf8 = (s) => Array.from(new TextEncoder().encode(s));
const dataCapacity = (v, ecc) => BLOCKS[v][ecc].reduce((n, [b, , d]) => n + b * d, 0);

/** Bytes that fit at this level in the largest supported version. */
export function maxBytes(ecc = 'M') { return dataCapacity(MAX_VERSION, ecc) - 3; }   // −2 header bytes, −1 for the terminator's nibble

function codewords(bytes, version, ecc) {
  const bits = [];
  const put = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
  put(4, 4); put(bytes.length, version < 10 ? 8 : 16); for (const b of bytes) put(b, 8);
  const cap = dataCapacity(version, ecc) * 8;
  for (let i = 0; i < 4 && bits.length < cap; i++) bits.push(0);
  while (bits.length % 8) bits.push(0);
  const data = [];
  for (let i = 0; i < bits.length; i += 8) data.push(parseInt(bits.slice(i, i + 8).join(''), 2));
  for (let pad = 0xec; data.length < cap / 8; pad ^= 0xec ^ 0x11) data.push(pad);
  // split into blocks, add each block's error correction, interleave
  const blocks = []; let at = 0;
  for (const [count, total, d] of BLOCKS[version][ecc]) {
    for (let i = 0; i < count; i++) { const chunk = data.slice(at, at += d); blocks.push({ chunk, ec: rsRemainder(chunk, total - d) }); }
  }
  const out = [];
  for (let i = 0; i < Math.max(...blocks.map((b) => b.chunk.length)); i++) for (const b of blocks) if (i < b.chunk.length) out.push(b.chunk[i]);
  for (let i = 0; i < blocks[0].ec.length; i++) for (const b of blocks) out.push(b.ec[i]);
  return out;
}

const bit = (x, i) => ((x >>> i) & 1) === 1;

function draw(version, ecc, words, mask) {
  const size = version * 4 + 17;
  const m = Array.from({ length: size }, () => new Array(size).fill(false));
  const fn = Array.from({ length: size }, () => new Array(size).fill(false));   // function modules: never masked, never data
  const set = (x, y, dark) => { if (x >= 0 && y >= 0 && x < size && y < size) { m[y][x] = dark; fn[y][x] = true; } };

  for (let i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }                 // timing
  for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]]) {                                   // finders + separators
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const d = Math.max(Math.abs(dx), Math.abs(dy)); set(cx + dx, cy + dy, d !== 2 && d !== 4);
    }
  }
  const pos = ALIGN[version];
  for (const cy of pos) for (const cx of pos) {                                                       // alignment patterns
    if ((cx === 6 && cy === 6) || (cx === 6 && cy === pos[pos.length - 1]) || (cx === pos[pos.length - 1] && cy === 6)) continue;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }
  const format = (msk) => {
    let r = (FORMAT_BITS[ecc] << 3) | msk, v = r;
    for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537);
    v = ((v << 10) | r) ^ 0x5412;
    for (let i = 0; i <= 5; i++) set(8, i, bit(v, i));
    set(8, 7, bit(v, 6)); set(8, 8, bit(v, 7)); set(7, 8, bit(v, 8));
    for (let i = 9; i < 15; i++) set(14 - i, 8, bit(v, i));
    for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(v, i));
    for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(v, i));
    set(8, size - 8, true);                                                                           // the always-dark module
  };
  format(0);                                                                                           // reserve the areas now; real bits below
  if (version >= 7) {
    let r = version;
    for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1f25);
    const v = (version << 12) | r;
    for (let i = 0; i < 18; i++) { const a = size - 11 + (i % 3), b = Math.floor(i / 3); set(a, b, bit(v, i)); set(b, a, bit(v, i)); }
  }

  // data, zig-zag from the bottom right, two columns at a time, skipping the timing column
  let i = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) for (let j = 0; j < 2; j++) {
      const x = right - j, up = ((right + 1) & 2) === 0, y = up ? size - 1 - vert : vert;
      if (!fn[y][x] && i < words.length * 8) { m[y][x] = bit(words[i >>> 3], 7 - (i & 7)); i++; }
    }
  }
  const MASKS = [(x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, (x, y) => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
    (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
    (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0, (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!fn[y][x] && MASKS[mask](x, y)) m[y][x] = !m[y][x];
  format(mask);
  return m;
}

function penalty(m) {
  const n = m.length; let p = 0;
  const runs = (get) => {                                                                              // rule 1 along one direction
    for (let a = 0; a < n; a++) {
      let run = 1;
      for (let b = 1; b < n; b++) { if (get(a, b) === get(a, b - 1)) { run++; if (run === 5) p += 3; else if (run > 5) p++; } else run = 1; }
    }
  };
  runs((a, b) => m[a][b]); runs((a, b) => m[b][a]);
  const line = (get) => {                                                                              // rule 3: 1:1:3:1:1 with a light run of 4 beside it (the quiet zone counts as light)
    const P = [1, 0, 1, 1, 1, 0, 1];
    const light = (a, from, to) => { for (let k = Math.max(from, 0); k < Math.min(to, n); k++) if (get(a, k)) return false; return true; };
    for (let a = 0; a < n; a++) for (let b = 0; b + 7 <= n; b++) {
      let hit = true;
      for (let k = 0; k < 7 && hit; k++) if ((get(a, b + k) ? 1 : 0) !== P[k]) hit = false;
      if (hit && (light(a, b - 4, b) || light(a, b + 7, b + 11))) p += 40;
    }
  };
  line((a, b) => m[a][b]); line((a, b) => m[b][a]);
  for (let y = 0; y < n - 1; y++) for (let x = 0; x < n - 1; x++) if (m[y][x] === m[y][x + 1] && m[y][x] === m[y + 1][x] && m[y][x] === m[y + 1][x + 1]) p += 3;   // rule 2
  let dark = 0; for (const r of m) for (const c of r) if (c) dark++;
  p += Math.floor(Math.abs(dark * 20 - n * n * 10) / (n * n)) * 10;                                    // rule 4
  return p;
}

/**
 * @param {string} text
 * @param {{ecc?:'L'|'M'|'Q'|'H', version?:number, mask?:number}} [o]  version/mask: force them (tests); by default the smallest version and the lowest-penalty mask
 */
export function qrMatrix(text, { ecc = 'M', version = 0, mask = -1 } = {}) {
  if (!FORMAT_BITS.hasOwnProperty(ecc)) throw new Error(`qr: unknown error-correction level "${ecc}" (L, M, Q, H)`);
  const bytes = utf8(String(text));
  let v = version;
  if (!v) for (v = 1; v <= MAX_VERSION; v++) if (bytes.length <= dataCapacity(v, ecc) - (v < 10 ? 2 : 3)) break;
  if (v > MAX_VERSION || bytes.length > dataCapacity(v, ecc) - (v < 10 ? 2 : 3)) throw new Error(`qr: ${bytes.length} bytes do not fit (this encoder stops at version ${MAX_VERSION}: ${maxBytes(ecc)} bytes at level ${ecc})`);
  const words = codewords(bytes, v, ecc);
  let best = null;
  for (const k of mask >= 0 ? [mask] : [0, 1, 2, 3, 4, 5, 6, 7]) {
    const m = draw(v, ecc, words, k), p = mask >= 0 ? 0 : penalty(m);
    if (!best || p < best.p) best = { m, p, k };
  }
  return { version: v, size: v * 4 + 17, mask: best.k, ecc, rows: best.m.map((r) => r.map((c) => (c ? '1' : '0')).join('')) };
}

/** An <svg> string: dark modules as one path, a light background, a quiet zone of `margin` modules. `scale` px per module (or `size` px in all). */
export function qrSvg(text, { ecc = 'M', margin = 2, dark = '#000', light = '#fff', size = 0, scale = 0 } = {}) {
  const { rows, size: n } = qrMatrix(text, { ecc });
  const t = n + margin * 2;
  let d = '';
  rows.forEach((r, y) => { for (let x = 0; x < n; x++) if (r[x] === '1') d += `M${x + margin},${y + margin}h1v1h-1z`; });
  const px = size || (scale ? t * scale : 0);                                                           // scale: whole pixels per module, so a 1x screen stays sharp
  const wh = px ? ` width="${px}" height="${px}"` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${t} ${t}"${wh} shape-rendering="crispEdges" role="img" aria-label="QR code"><rect width="${t}" height="${t}" fill="${light}"/><path d="${d}" fill="${dark}"/></svg>`;
}
