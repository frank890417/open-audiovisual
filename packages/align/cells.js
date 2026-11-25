// @openav/align · cells — names for square cells of a segment: rows A, B, C … (top to bottom), columns 1, 2, 3 … (left to right).
//
// A vendor's alignment chart cuts each piece of a wall into square cells named like this, so the same names work three
// ways: a person on a ladder can say "segment L, C8 is off down-right", a note can describe a fault in words, and a camera
// could look the name up. Coordinates are absolute art-canvas pixels; cells start at the segment's top-left. When a
// segment is not a whole number of cells, the last column or row is a part cell (named all the same, cut to the segment).

/** Row label: 0 → A, 25 → Z, 26 → AA (only past 26 rows). */
export function rowLabel(i) {
  let s = '';
  for (let n = i; ; n = Math.floor(n / 26) - 1) {
    s = String.fromCharCode(65 + (n % 26)) + s;
    if (n < 26) break;
  }
  return s;
}

/** Row label → row number from 0 ('A' → 0, 'AA' → 26); -1 when it is not a label. */
export function rowIndex(label) {
  if (!/^[A-Z]+$/.test(label)) return -1;
  let n = 0;
  for (const ch of label) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

/** (row, col) from 0 → 'C8'. */
export const cellName = (row, col) => `${rowLabel(row)}${col + 1}`;

/** 'C8' → { row: 2, col: 7 }; null when it is not a cell name. */
export function parseCellName(name) {
  const m = /^([A-Z]+)([1-9]\d*)$/.exec(String(name ?? '').trim().toUpperCase());
  if (!m) return null;
  return { row: rowIndex(m[1]), col: Number(m[2]) - 1 };
}

/** A cell's full name, segment and cell: 'L:C8'. A segment may itself be called A1, so the segment always comes first. */
export const cellId = (segmentId, name) => `${segmentId}:${name}`;

/** 'L:C8' → { segment: 'L', row: 2, col: 7 }; null when it is not a cell id. */
export function parseCellId(id) {
  const i = String(id ?? '').lastIndexOf(':');
  if (i <= 0) return null;
  const rc = parseCellName(id.slice(i + 1));
  return rc ? { segment: id.slice(0, i), ...rc } : null;
}

/**
 * The default cell size for a segment w × h: of the sizes that divide both sides, the one nearest 220 px
 * (1920 × 1200 → 240); when none divides both, five rows.
 * @param {number} w
 * @param {number} h
 * @returns {number}
 */
export function cellSizeFor(w, h) {
  const cands = [240, 200, 192, 160, 150, 120, 100, 96, 80, 60, 50, 40];
  const fits = cands.filter((c) => w % c === 0 && h % c === 0);
  if (!fits.length) return Math.max(40, Math.round(h / 5));
  return fits.reduce((best, c) => (Math.abs(c - 220) < Math.abs(best - 220) ? c : best));
}

/** A segment's grid: { size, cols, rows } (a part cell counts as one). */
export function cellGrid(seg, size) {
  return { size, cols: Math.ceil(seg.w / size), rows: Math.ceil(seg.h / size) };
}

/**
 * The cell of a segment that the art-canvas point (ax, ay) falls in, as 'C8'; null outside the segment.
 * @param {{x:number,y:number,w:number,h:number}} seg
 * @param {number} size
 * @param {number} ax
 * @param {number} ay
 * @returns {string|null}
 */
export function cellAt(seg, size, ax, ay) {
  if (ax < seg.x || ay < seg.y || ax >= seg.x + seg.w || ay >= seg.y + seg.h) return null;
  return cellName(Math.floor((ay - seg.y) / size), Math.floor((ax - seg.x) / size));
}

/**
 * A cell's rectangle on the art canvas, cut to the segment; null for a name that is not a cell of it.
 * @param {{x:number,y:number,w:number,h:number}} seg
 * @param {number} size
 * @param {string} name
 * @returns {{x:number,y:number,w:number,h:number}|null}
 */
export function cellRect(seg, size, name) {
  const rc = parseCellName(name);
  if (!rc) return null;
  const { cols, rows } = cellGrid(seg, size);
  if (rc.row >= rows || rc.col >= cols) return null;
  const x = seg.x + rc.col * size, y = seg.y + rc.row * size;
  return { x, y, w: Math.min(size, seg.x + seg.w - x), h: Math.min(size, seg.y + seg.h - y) };
}

/**
 * Every cell of a segment, top-left to bottom-right, row by row: { row, col, name, x, y, w, h }.
 * @param {{x:number,y:number,w:number,h:number}} seg
 * @param {number} size
 */
export function* eachCell(seg, size) {
  const { cols, rows } = cellGrid(seg, size);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = seg.x + c * size, y = seg.y + r * size;
      yield { row: r, col: c, name: cellName(r, c), x, y, w: Math.min(size, seg.x + seg.w - x), h: Math.min(size, seg.y + seg.h - y) };
    }
  }
}
