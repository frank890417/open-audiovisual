import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { qrMatrix, qrSvg, maxBytes, MAX_VERSION } from '../packages/remote/qr.js';

// Fixtures: matrices written by an independent encoder (segno 1.6.6, byte mode, forced version) for inputs that fill their version
// exactly. (Shorter inputs differ from segno only by pad codewords after the terminator — valid either way — so they are
// covered by the decoding round trip below.) Covers versions 1–10, all four levels, one- and two-group block layouts,
// alignment patterns, version info (v7+), and the mask choice.
const fixtures = JSON.parse(fs.readFileSync(new URL('./fixtures/qr-segno.json', import.meta.url), 'utf8'));

test('qr: the matrix equals the reference encoder, module for module (v1–v10, L/M/Q/H)', () => {
  assert.ok(fixtures.length >= 6);
  for (const f of fixtures) {
    const got = qrMatrix(f.text, { ecc: f.ecc });
    assert.equal(got.version, f.version, `version for ${f.ecc} v${f.version}`);
    assert.equal(got.mask, f.mask, `mask for ${f.ecc} v${f.version}`);
    assert.deepEqual(got.rows, f.rows, `modules for ${f.ecc} v${f.version}`);
  }
});

// ---- an independent reader: format info → unmask → codewords → Reed–Solomon check → text ----
const ALIGN = [null, [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];
function decode(rows) {
  const n = rows.length, v = (n - 17) / 4, m = rows.map((r) => [...r].map((c) => c === '1'));
  const fn = Array.from({ length: n }, () => new Array(n).fill(false));
  const mark = (x, y) => { if (x >= 0 && y >= 0 && x < n && y < n) fn[y][x] = true; };
  for (let i = 0; i < n; i++) { mark(6, i); mark(i, 6); }
  for (const [cx, cy] of [[3, 3], [n - 4, 3], [3, n - 4]]) for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) mark(cx + dx, cy + dy);
  const last = ALIGN[v][ALIGN[v].length - 1];
  for (const cy of ALIGN[v]) for (const cx of ALIGN[v]) if (!((cx === 6 && cy === 6) || (cx === 6 && cy === last) || (cx === last && cy === 6))) for (let d = -2; d <= 2; d++) for (let e = -2; e <= 2; e++) mark(cx + d, cy + e);
  for (let i = 0; i < 9; i++) { mark(8, i); mark(i, 8); }
  for (let i = 0; i < 8; i++) { mark(n - 1 - i, 8); mark(8, n - 1 - i); }
  if (v >= 7) for (let a = 0; a < 6; a++) for (let b = 0; b < 3; b++) { mark(n - 11 + b, a); mark(a, n - 11 + b); }
  // format info, first copy: read it back and check it is a valid BCH codeword
  const f = []; for (let i = 0; i <= 5; i++) f.push(m[i][8]); f.push(m[7][8], m[8][8], m[8][7]); for (let i = 9; i < 15; i++) f.push(m[8][14 - i]);
  const raw = f.reduce((a, b, i) => a | (b ? 1 << i : 0), 0) ^ 0x5412;
  let r = raw >> 10; for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537);
  assert.equal(r & 0x3ff, raw & 0x3ff, 'format info BCH');
  const ecc = ['M', 'L', 'H', 'Q'][raw >> 13], mask = (raw >> 10) & 7;
  const M = [(x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, (x, y) => x % 3 === 0, (x, y) => (x + y) % 3 === 0, (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
    (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0, (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0, (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0][mask];
  const bits = [];
  for (let right = n - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < n; vert++) for (let j = 0; j < 2; j++) {
      const x = right - j, y = ((right + 1) & 2) === 0 ? n - 1 - vert : vert;
      if (!fn[y][x]) bits.push(m[y][x] !== M(x, y));
    }
  }
  const words = []; for (let i = 0; i + 8 <= bits.length; i += 8) words.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | (b ? 1 : 0), 0));
  return { v, ecc, mask, words };
}
// GF(256) syndromes of a block must all be zero
const EXP = [], LOG = []; for (let i = 0, x = 1; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 256) x ^= 0x11d; }
const gmul = (a, b) => (a && b ? EXP[(LOG[a] + LOG[b]) % 255] : 0);
const syndromesZero = (block, nEc) => { for (let i = 0; i < nEc; i++) { let s = 0; for (const c of block) s = gmul(s, EXP[i]) ^ c; if (s) return false; } return true; };
const LAYOUT = { // 'version+level': [[blocks, codewords per block, data per block]] — copied from the reference encoder, not from qr.js
  '1L': [[1,26,19]], '1M': [[1,26,16]], '1Q': [[1,26,13]], '1H': [[1,26,9]],
  '2L': [[1,44,34]], '2M': [[1,44,28]], '2Q': [[1,44,22]], '2H': [[1,44,16]],
  '3L': [[1,70,55]], '3M': [[1,70,44]], '3Q': [[2,35,17]], '3H': [[2,35,13]],
  '4L': [[1,100,80]], '4M': [[2,50,32]], '4Q': [[2,50,24]], '4H': [[4,25,9]],
  '5L': [[1,134,108]], '5M': [[2,67,43]], '5Q': [[2,33,15],[2,34,16]], '5H': [[2,33,11],[2,34,12]],
  '6L': [[2,86,68]], '6M': [[4,43,27]], '6Q': [[4,43,19]], '6H': [[4,43,15]],
  '7L': [[2,98,78]], '7M': [[4,49,31]], '7Q': [[2,32,14],[4,33,15]], '7H': [[4,39,13],[1,40,14]],
  '8L': [[2,121,97]], '8M': [[2,60,38],[2,61,39]], '8Q': [[4,40,18],[2,41,19]], '8H': [[4,40,14],[2,41,15]],
  '9L': [[2,146,116]], '9M': [[3,58,36],[2,59,37]], '9Q': [[4,36,16],[4,37,17]], '9H': [[4,36,12],[4,37,13]],
  '10L': [[2,86,68],[2,87,69]], '10M': [[4,69,43],[1,70,44]], '10Q': [[6,43,19],[2,44,20]], '10H': [[6,43,15],[2,44,16]],
};
function textOf(rows) {
  const { v, ecc, words } = decode(rows);
  const groups = LAYOUT[`${v}${ecc}`]; assert.ok(groups, `layout for ${v}${ecc}`);
  const blocks = groups.flatMap(([c, t, d]) => Array.from({ length: c }, () => ({ t, d, data: [], ec: [] })));
  let at = 0; const maxD = Math.max(...blocks.map((b) => b.d));
  for (let i = 0; i < maxD; i++) for (const b of blocks) if (i < b.d) b.data.push(words[at++]);
  for (let i = 0; i < blocks[0].t - blocks[0].d; i++) for (const b of blocks) b.ec.push(words[at++]);
  for (const b of blocks) assert.ok(syndromesZero([...b.data, ...b.ec], b.t - b.d), 'Reed–Solomon syndromes are zero');
  const data = blocks.flatMap((b) => b.data);
  const bitStr = data.map((w) => w.toString(2).padStart(8, '0')).join('');
  assert.equal(bitStr.slice(0, 4), '0100', 'byte mode');
  const lenBits = v < 10 ? 8 : 16, len = parseInt(bitStr.slice(4, 4 + lenBits), 2);
  const bytes = []; for (let i = 0; i < len; i++) bytes.push(parseInt(bitStr.slice(4 + lenBits + i * 8, 12 + lenBits + i * 8), 2));
  return new TextDecoder().decode(new Uint8Array(bytes));
}

test('qr: what goes in comes out — a decoder written separately reads the text back (any level, ASCII and UTF-8)', () => {
  const url = 'https://openaudiovisual.com/packages/remote/?room=show-k3m9x2qa7p&relay=wss%3A%2F%2Fremote.cheyuwu.com%2Frelay';
  for (const text of ['A', 'http://192.168.0.192:8080/packages/remote/?room=default', url, '你好，哲宇 🎹 phone/ipad', 'x'.repeat(100)]) {
    for (const ecc of ['L', 'M', 'Q', 'H']) {
      let q; try { q = qrMatrix(text, { ecc }); } catch (e) { assert.match(e.message, /do not fit/); continue; }
      assert.equal(textOf(q.rows), text, `${ecc}: ${text.slice(0, 30)}`);
    }
  }
});

test('qr: the real join URL (public relay) needs version 7 at level M and fits comfortably', () => {
  const q = qrMatrix('https://openaudiovisual.com/packages/remote/?room=show-k3m9x2qa7p&relay=wss%3A%2F%2Fremote.cheyuwu.com%2Frelay');
  assert.equal(q.version, 7); assert.equal(q.size, 45);
  assert.ok(maxBytes('M') >= 200);
});

test('qr: structure — finders at three corners, timing line, always-dark module, square', () => {
  const { rows, size } = qrMatrix('hello');
  assert.equal(rows.length, size); assert.ok(rows.every((r) => r.length === size));
  for (const [x, y] of [[0, 0], [size - 7, 0], [0, size - 7]]) {
    assert.equal(rows[y].slice(x, x + 7), '1111111'); assert.equal(rows[y + 1].slice(x, x + 7), '1000001'); assert.equal(rows[y + 3].slice(x, x + 7), '1011101');
  }
  for (let i = 8; i < size - 8; i++) assert.equal(rows[6][i], i % 2 === 0 ? '1' : '0');
  assert.equal(rows[size - 8][8], '1');
});

test('qr: refuses what it cannot encode, says why', () => {
  assert.throws(() => qrMatrix('x'.repeat(272), { ecc: 'L' }), /do not fit.*version 10/);
  assert.throws(() => qrMatrix('a', { ecc: 'Z' }), /unknown error-correction level/);
  assert.equal(MAX_VERSION, 10);
  assert.equal(qrMatrix('x'.repeat(271), { ecc: 'L' }).version, 10);
});

test('qr: the SVG is one path on a light background, scaled in whole pixels', () => {
  const svg = qrSvg('hi', { margin: 2, scale: 3 });
  const { size } = qrMatrix('hi');
  assert.match(svg, /^<svg [^>]*viewBox="0 0 25 25"/); assert.equal(size, 21);
  assert.match(svg, /width="75" height="75"/);
  assert.equal((svg.match(/<path/g) || []).length, 1);
  assert.ok(svg.includes('<rect width="25" height="25" fill="#fff"/>'));
});
