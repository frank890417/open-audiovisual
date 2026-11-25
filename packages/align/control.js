// @openav/align · control — the arguments of an "align" command, as a control page sends it through a relay to the page
// that draws the wall: { on, pattern, variant?, highlight? }. The same check on both ends, so an old page and a new one
// still understand each other: what changes is the list of patterns, not the shape.
import { ALIGN_PATTERNS } from './patterns.js?v=cedb93fa';

/** A name kept for the camera half of the roadmap: 'gray' would step through the Gray-code frames with a frame index. */
export const RESERVED_ALIGN_PATTERNS = ['gray'];

/**
 * Make an align command's arguments safe: on unless it is exactly false; a pattern not in the list becomes the fallback;
 * variant (bars' kind) and highlight ('L:C8') only when they look right.
 * @param {object} a
 * @returns {{on:boolean, pattern:string, variant?:string, highlight?:string}}
 */
export function normalizeAlignArgs(a, { patterns = ALIGN_PATTERNS, fallback = 'grid' } = {}) {
  const x = a && typeof a === 'object' && !Array.isArray(a) ? a : {};
  const out = { on: x.on !== false, pattern: patterns.includes(x.pattern) ? x.pattern : fallback };
  if (typeof x.variant === 'string' && /^[a-z]{1,16}$/.test(x.variant)) out.variant = x.variant;
  if (typeof x.highlight === 'string' && /^[A-Za-z0-9_.@-]{1,48}:[A-Za-z]{1,3}\d{1,4}$/.test(x.highlight)) out.highlight = x.highlight;
  return out;
}
