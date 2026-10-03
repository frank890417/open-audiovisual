// @openav/surface · kbplan — how many keys, in how many rows, for a given box.
// Pure geometry so the "portrait keyboard" decision is unit-tested.
//
// The problem: a piano is ~2.4 m wide; a phone held upright is 6 cm. Shrinking
// the keys makes a toy; so the keyboard changes SHAPE with its box:
//   wide box  (aspect ≥ stackBelow) → one row, as many octaves as fit at a
//                                      comfortable key width (≥ minKeyPx)
//   tall box                         → TWO rows stacked, the upper row continuing
//                                      the pitch range where the lower stops — a
//                                      thumb-reachable two-manual layout
// Row boundaries land so no black key is orphaned at a seam: the lower row ends
// on E or B (no black key above them), the upper row starts on the next white.

const BLACK_PC = new Set([1, 3, 6, 8, 10]);
const isWhite = (n) => !BLACK_PC.has(((n % 12) + 12) % 12);

/** Semitone count (inclusive) from `start` to the `n`-th white key. */
export function whiteSpan(start, n) {
  let whites = 0, i = 0;
  for (;; i++) { if (isWhite(start + i)) { whites++; if (whites === n) return i + 1; } if (i > 400) return i + 1; }
}

/** Largest white-key count ≤ maxWhites whose last key is E or B (nothing black above it). */
export function seamSpan(start, maxWhites) {
  let best = null, whites = 0;
  for (let i = 0; whites < maxWhites; i++) {
    if (isWhite(start + i)) {
      whites++;
      const pc = (((start + i) % 12) + 12) % 12;
      if (pc === 4 || pc === 11) best = { whites, semitones: i + 1 };
    }
  }
  return best || { whites: Math.max(1, maxWhites), semitones: whiteSpan(start, Math.max(1, maxWhites)) };
}

/**
 * @param {{width:number, height:number, base?:number, minKeyPx?:number, maxWhites?:number, stackBelow?:number, forceRows?:1|2}} o
 * @returns {{stacked:boolean, whites:number, keyPx:number, rows:{base:number, semitones:number, whites:number}[]}}
 *          rows[0] is the TOP row (higher pitches), the way two manuals are read.
 */
export function planKeyboard({ width, height, base = 48, minKeyPx = 38, maxWhites = 22, stackBelow = 2.2, forceRows = 0 }) {
  const stacked = forceRows ? forceRows === 2 : (width / Math.max(1, height)) < stackBelow;
  // two rows already double the range; cap each at 2 octaves so an iPad doesn't span C3..C8
  const W = Math.max(3, Math.min(stacked ? Math.min(maxWhites, 14) : maxWhites, Math.floor(width / minKeyPx)));
  const lowSpan = seamSpan(base, W);
  const cap = (b, span) => Math.min(span, 128 - b);            // MIDI tops out at 127
  const lower = { base, semitones: cap(base, lowSpan.semitones), whites: lowSpan.whites };
  if (!stacked) return { stacked, whites: lower.whites, keyPx: width / lower.whites, rows: [lower] };
  const upBase = base + lowSpan.semitones;                     // the next white key
  const upper = { base: upBase, semitones: cap(upBase, whiteSpan(upBase, lower.whites)), whites: lower.whites };
  return { stacked, whites: lower.whites, keyPx: width / lower.whites, rows: [upper, lower] };
}
