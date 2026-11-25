// @openav/align · layout — one JSON file describes how a wall is built and wired: checked, filled in, found by name.
//
// A layout is data, not code:
//
//   art       the art canvas, the wall unrolled flat (a curved wall becomes a rectangle). The work draws at this size.
//   segments  the wall's physical pieces, each a rectangle of the art canvas, with optional metres, colour, cells, blend band.
//   outputs   the signal outputs (a 4K port, a projector) as rectangles of the desktop: the physical pixels a fullscreen
//             browser covers.
//   feeds     which segment goes into which output, and where inside it. One segment into several outputs is a stack
//             (two projectors on one picture); w/h scale it (an LED processor that scales).
//   vendor    the vendor's alignment images: any number, each filling an output or a rectangle of the desktop.
//
// Why one file: the test patterns, the vendor overlay and the real output mapping all read the same data, so a pattern
// that is right on the wall means the work is right on the wall.
//
// Errors (the layout is refused): pixels that are not integers, a segment outside the canvas, outputs that overlap, a
// feed that names nothing or lands outside its output, two feeds with one name, an unknown format.
// Warnings (accepted, listed): a segment fed nowhere, two segments that overlap without a blend band, metres whose
// horizontal and vertical pixel pitch disagree (usually one number copied wrong).
//
// The format is open-audiovisual/align@1. A file written for art-align/v1 (the module this package grew from) reads
// unchanged: "contract": "art-align/v1" is accepted wherever "format" is.

import { cellSizeFor } from './cells.js?v=7229c5d3';

export const ALIGN_FORMAT = 'open-audiovisual/align@1';
/** The format a layout is written with. Same value as ALIGN_FORMAT; the name art-align used. */
export const CONTRACT = ALIGN_FORMAT;
const READ_FORMATS = [ALIGN_FORMAT, 'art-align/v1'];
export const BLEND_CURVES = ['linear', 'cosine', 'smoothstep'];
/** A feed may turn its segment clockwise before it lands (a projector on its side, a floor seen the other way). */
export const ROTATIONS = [0, 90, 180, 270];
/** A venue parameter is decided (someone said so) or assumed (waiting for the hardware or the venue to answer). */
export const PARAM_STATUS = ['decided', 'assumed'];
/** Colours for segments that name none: a dark and a light one each, the two squares of the checkerboard. */
export const PALETTE = [
  ['#2f8b83', '#a6cbc7'], ['#3f4f80', '#9aa5c3'], ['#5d9153', '#a8c7a0'], ['#6b4f96', '#b3a3cc'],
  ['#8a5a2b', '#cdb08f'], ['#7f3f55', '#c39aa8'],
];

/** The error computeMapping() and normalizeLayout() throw for a layout that breaks the format; `errors` lists every problem. */
export class LayoutError extends Error {
  constructor(id, errors) {
    super(`[align] layout ${id ?? '(no id)'} does not follow ${ALIGN_FORMAT}:\n- ${errors.join('\n- ')}`);
    this.name = 'LayoutError';
    this.errors = errors;
  }
}

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const posInt = (v) => Number.isInteger(v) && v > 0;
const nonNegInt = (v) => Number.isInteger(v) && v >= 0;
const ID_RE = /^[A-Za-z0-9][A-Za-z0-9_.@-]{0,47}$/;
const intersects = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
export const rectOf = (o) => ({ x: o.x, y: o.y, w: o.w, h: o.h });
/** The format tag of a document: "format", or art-align's "contract". */
export const formatOf = (d) => (isObj(d) ? d.format ?? d.contract : undefined);

function checkRect(r, label, errors) {
  if (!isObj(r)) { errors.push(`${label} is not an object`); return false; }
  let ok = true;
  for (const k of ['x', 'y']) if (!nonNegInt(r[k])) { errors.push(`${label}.${k} must be an integer ≥ 0 (got ${JSON.stringify(r[k])})`); ok = false; }
  for (const k of ['w', 'h']) if (!posInt(r[k])) { errors.push(`${label}.${k} must be an integer > 0 (got ${JSON.stringify(r[k])})`); ok = false; }
  return ok;
}
function checkMeters(m, label, errors) {
  if (m == null) return;
  if (!isObj(m) || !(m.w > 0) || !(m.h > 0)) errors.push(`${label}.meters must be { w, h } in metres, > 0; leave it out when nobody measured`);
}
function checkColor(c, label, errors) {
  if (c == null) return;
  const ok = typeof c === 'string' || (Array.isArray(c) && c.length === 2 && c.every((s) => typeof s === 'string'));
  if (!ok) errors.push(`${label}.color must be '#rrggbb' or ['dark', 'light']`);
}

/** A feed's default name: its segment's id when the segment goes to one output, segment@output when it goes to several. */
function defaultFeedName(f, feeds) {
  const n = feeds.filter((g) => g.segment === f.segment).length;
  return n <= 1 ? f.segment : `${f.segment}@${f.output}`;
}

/**
 * Check a layout. Never throws.
 * @param {object} layout
 * @returns {{ok:boolean, errors:string[], warnings:string[]}}
 */
export function validateLayout(layout) {
  const errors = [], warnings = [];
  if (!isObj(layout)) return { ok: false, errors: ['a layout is an object'], warnings };
  if (layout.format != null && layout.contract != null && layout.format !== layout.contract) errors.push(`format ${JSON.stringify(layout.format)} and contract ${JSON.stringify(layout.contract)} disagree: keep one`);
  if (!READ_FORMATS.includes(formatOf(layout))) errors.push(`format must be '${ALIGN_FORMAT}' (or art-align's contract '${READ_FORMATS[1]}'), got ${JSON.stringify(formatOf(layout))}`);
  if (typeof layout.id !== 'string' || !ID_RE.test(layout.id)) errors.push(`id must be letters, digits, _ . @ - (got ${JSON.stringify(layout.id)})`);
  if (layout.aliases != null && !(Array.isArray(layout.aliases) && layout.aliases.every((a) => typeof a === 'string'))) errors.push('aliases must be an array of strings');

  const art = layout.art;
  const artOk = isObj(art) && posInt(art.w) && posInt(art.h);
  if (!artOk) errors.push('art must be { w, h } in whole pixels > 0');
  else checkMeters(art.meters, 'art', errors);
  if (layout.cells != null && !(isObj(layout.cells) && posInt(layout.cells.size))) errors.push('cells must be { size: whole pixels > 0 }');

  // segments
  const segs = Array.isArray(layout.segments) ? layout.segments : null;
  if (!segs || !segs.length) errors.push('segments needs at least one segment');
  const segById = new Map();
  for (const [i, s] of (segs || []).entries()) {
    const label = `segments[${i}]${s?.id ? ` (${s.id})` : ''}`;
    if (!isObj(s)) { errors.push(`${label} is not an object`); continue; }
    if (typeof s.id !== 'string' || !ID_RE.test(s.id)) errors.push(`${label}.id must be letters, digits, _ . @ -`);
    else if (segById.has(s.id)) errors.push(`segment id ${s.id} is used twice`);
    else segById.set(s.id, s);
    if (checkRect(s, label, errors) && artOk && (s.x + s.w > art.w || s.y + s.h > art.h)) {
      errors.push(`${label} lies outside the art canvas: x ${s.x}+${s.w}, y ${s.y}+${s.h} on ${art.w}×${art.h}`);
    }
    checkMeters(s.meters, label, errors);
    checkColor(s.color, label, errors);
    if (s.cells != null && !(isObj(s.cells) && posInt(s.cells.size))) errors.push(`${label}.cells must be { size }`);
    if (s.blend != null) {
      const b = s.blend;
      if (!isObj(b)) errors.push(`${label}.blend must be an object { l, r, t, b, curve, gamma }`);
      else {
        for (const k of ['l', 'r', 't', 'b']) if (b[k] != null && !nonNegInt(b[k])) errors.push(`${label}.blend.${k} must be whole pixels ≥ 0`);
        if (b.curve != null && !BLEND_CURVES.includes(b.curve)) errors.push(`${label}.blend.curve must be ${BLEND_CURVES.join(', ')}`);
        if (b.gamma != null && !(b.gamma > 0)) errors.push(`${label}.blend.gamma must be > 0`);
        if ((b.l || 0) + (b.r || 0) > s.w || (b.t || 0) + (b.b || 0) > s.h) errors.push(`${label}.blend: the bands add up to more than the segment`);
      }
    }
    // masks (a door, an opening): rectangles in the segment's own art pixels, origin at its top-left
    if (s.masks != null) {
      if (!Array.isArray(s.masks)) errors.push(`${label}.masks must be an array [{ x, y, w, h, label? }] in the segment's art pixels`);
      else for (const [k, m] of s.masks.entries()) {
        if (checkRect(m, `${label}.masks[${k}]`, errors) && posInt(s.w) && posInt(s.h) && (m.x + m.w > s.w || m.y + m.h > s.h)) errors.push(`${label}.masks[${k}] lies outside the segment ${s.w}×${s.h}`);
        if (m?.label != null && typeof m.label !== 'string') errors.push(`${label}.masks[${k}].label must be a string`);
      }
    }
    // metres → pixel pitch: an LED pixel is square, so a pitch that differs across and down is a number copied wrong
    if (isObj(s.meters) && s.meters.w > 0 && s.meters.h > 0 && posInt(s.w) && posInt(s.h)) {
      const px = s.w / s.meters.w, py = s.h / s.meters.h;
      if (Math.abs(px - py) / Math.max(px, py) > 0.02) warnings.push(`${label}: ${px.toFixed(1)} px/m across and ${py.toFixed(1)} px/m down differ by more than 2% (a metre or a pixel count copied wrong?)`);
    }
  }

  // outputs
  const outs = Array.isArray(layout.outputs) ? layout.outputs : null;
  if (!outs || !outs.length) errors.push('outputs needs at least one output');
  const outById = new Map();
  for (const [i, o] of (outs || []).entries()) {
    const label = `outputs[${i}]${o?.id ? ` (${o.id})` : ''}`;
    if (!isObj(o)) { errors.push(`${label} is not an object`); continue; }
    if (typeof o.id !== 'string' || !ID_RE.test(o.id)) errors.push(`${label}.id must be letters, digits, _ . @ -`);
    else if (outById.has(o.id)) errors.push(`output id ${o.id} is used twice`);
    else if (checkRect(o, label, errors)) outById.set(o.id, o);
    if (o.cuts != null && !(isObj(o.cuts) && posInt(o.cuts.cols ?? 1) && posInt(o.cuts.rows ?? 1))) errors.push(`${label}.cuts must be { cols, rows }: how a splitter cuts this output (drawn on the vendor chart)`);
  }
  const outList = [...outById.values()];
  for (let i = 0; i < outList.length; i++) for (let j = i + 1; j < outList.length; j++) {
    if (intersects(outList[i], outList[j])) errors.push(`outputs ${outList[i].id} and ${outList[j].id} overlap on the desktop`);
  }
  if (layout.desktop != null) {
    const d = layout.desktop;
    if (!isObj(d) || !posInt(d.w) || !posInt(d.h)) errors.push('desktop must be { w, h } (leave it out: the outputs\' bounding box)');
    else for (const o of outList) if (o.x + o.w > d.w || o.y + o.h > d.h) errors.push(`output ${o.id} lies outside the desktop ${d.w}×${d.h}`);
  }

  // feeds
  const feeds = Array.isArray(layout.feeds) ? layout.feeds : null;
  if (!feeds || !feeds.length) errors.push('feeds needs at least one feed (which segment goes into which output)');
  const names = new Set();
  const fed = new Set();
  for (const [i, f] of (feeds || []).entries()) {
    const label = `feeds[${i}]${f?.name ? ` (${f.name})` : ''}`;
    if (!isObj(f)) { errors.push(`${label} is not an object`); continue; }
    const s = segById.get(f.segment), o = outById.get(f.output);
    if (!s) errors.push(`${label}.segment ${JSON.stringify(f.segment)} is not a segment`);
    if (!o) errors.push(`${label}.output ${JSON.stringify(f.output)} is not an output`);
    if (f.name != null && (typeof f.name !== 'string' || !ID_RE.test(f.name))) errors.push(`${label}.name must be letters, digits, _ . @ -`);
    const name = f.name ?? (s ? defaultFeedName(f, feeds) : null);
    if (name) { if (names.has(name)) errors.push(`feed name ${name} is used twice (name each feed when one segment goes to several outputs)`); names.add(name); }
    for (const k of ['x', 'y']) if (!nonNegInt(f[k])) errors.push(`${label}.${k} must be an integer ≥ 0 (pixels inside the output)`);
    for (const k of ['w', 'h']) if (f[k] != null && !posInt(f[k])) errors.push(`${label}.${k} must be an integer > 0 (leave it out: the segment's size, 1:1)`);
    if (f.rotate != null && !ROTATIONS.includes(f.rotate)) errors.push(`${label}.rotate must be ${ROTATIONS.join(', ')} (degrees, clockwise)`);
    checkColor(f.color, label, errors);
    if (s && o && nonNegInt(f.x) && nonNegInt(f.y)) {
      fed.add(s.id);
      const turned = f.rotate === 90 || f.rotate === 270;
      const w = f.w ?? (turned ? s.h : s.w), h = f.h ?? (turned ? s.w : s.h);
      if (f.x + w > o.w || f.y + h > o.h) errors.push(`${label} lands outside ${o.id}: (${f.x},${f.y}) ${w}×${h} on ${o.w}×${o.h}`);
      if (f.visible != null) {
        const v = f.visible;
        if (!isObj(v) || !posInt(v.w ?? w) || !posInt(v.h ?? h) || !nonNegInt(v.x ?? 0) || !nonNegInt(v.y ?? 0)) errors.push(`${label}.visible must be { x?, y?, w?, h? } inside the feed's rectangle`);
        else if ((v.x ?? 0) + (v.w ?? w) > w || (v.y ?? 0) + (v.h ?? h) > h) errors.push(`${label}.visible lies outside the feed's rectangle ${w}×${h}`);
      }
    }
  }
  for (const id of segById.keys()) if (!fed.has(id)) warnings.push(`segment ${id} goes into no output (it will not be on the wall)`);

  // two different segments that overlap on the canvas should declare a blend band
  const segList = [...segById.values()].filter((s) => posInt(s.w) && posInt(s.h));
  for (let i = 0; i < segList.length; i++) for (let j = i + 1; j < segList.length; j++) {
    const a = segList[i], b = segList[j];
    if (intersects(a, b) && !a.blend && !b.blend) warnings.push(`segments ${a.id} and ${b.id} overlap on the canvas and neither declares a blend (the overlap will be twice as bright)`);
  }

  // ident: the identification screen (ident.js). Surfaces inside the canvas, ids unique; the rest is optional
  if (layout.ident != null) {
    const I = layout.ident, aw = layout.art?.w, ah = layout.art?.h;
    if (!isObj(I) || !Array.isArray(I.surfaces)) errors.push('ident must be { surfaces: […], sweep?: […], sweepFloor? }');
    else {
      const seen = new Set();
      for (const f of I.surfaces) {
        if (!f?.id || seen.has(f.id)) { errors.push(`ident.surfaces: an id is missing or used twice: ${f?.id}`); continue; }
        seen.add(f.id);
        if (!['x', 'y', 'w', 'h'].every((k) => Number.isInteger(f[k]))) errors.push(`ident surface ${f.id}: x, y, w and h must be integers`);
        else if (f.x < 0 || f.y < 0 || f.x + f.w > aw || f.y + f.h > ah) errors.push(`ident surface ${f.id} lies outside the art canvas`);
      }
      for (const id of [...(I.sweep || []), ...(I.sweepFloor ? [I.sweepFloor] : [])]) if (!seen.has(id)) errors.push(`ident.sweep names a surface that does not exist: ${id}`);
    }
  }
  // params: the venue questions this layout was made from, each with a default and a note; an assumed one says whom to ask
  if (layout.params != null) {
    if (!isObj(layout.params)) errors.push('params must be an object { name: { default, note, … } }');
    else for (const [k, p] of Object.entries(layout.params)) {
      const label = `params.${k}`;
      if (!isObj(p)) { errors.push(`${label} must be an object`); continue; }
      if (!('default' in p)) errors.push(`${label} needs a default`);
      if (typeof p.note !== 'string' || !p.note.trim()) errors.push(`${label} needs a note (what it decides, where the default comes from)`);
      if (!PARAM_STATUS.includes(p.status)) errors.push(`${label}.status must be ${PARAM_STATUS.join(' or ')}`);
      if (p.status === 'assumed' && !(typeof p.ask === 'string' && p.ask.trim())) errors.push(`${label} is assumed: write ask (whom to ask, and what)`);
      if (p.options != null) {
        if (!Array.isArray(p.options) || !p.options.length) errors.push(`${label}.options must be a non-empty array`);
        else {
          const has = (v) => p.options.some((o) => JSON.stringify(o) === JSON.stringify(v));
          if ('default' in p && !has(p.default)) errors.push(`${label}.default ${JSON.stringify(p.default)} is not one of its options`);
          if ('value' in p && !has(p.value)) errors.push(`${label}.value ${JSON.stringify(p.value)} is not one of its options`);
        }
      }
    }
  }

  // vendor images
  if (layout.vendor != null) {
    if (!Array.isArray(layout.vendor)) errors.push('vendor must be an array');
    else for (const [i, v] of layout.vendor.entries()) {
      if (!isObj(v) || typeof v.file !== 'string' || !v.file) { errors.push(`vendor[${i}].file must be a file name`); continue; }
      if (v.output != null && !outById.has(v.output)) errors.push(`vendor[${i}].output ${JSON.stringify(v.output)} is not an output`);
      if (v.output == null && v.rect == null) errors.push(`vendor[${i}] needs an output (fill that output) or a rect (on the desktop)`);
      if (v.rect != null) checkRect(v.rect, `vendor[${i}].rect`, errors);
    }
  }
  return { ok: errors.length === 0, errors, warnings };
}

/**
 * Check and fill in a layout; returns a new object (the input is not touched). Throws LayoutError when it breaks the format.
 * Fills: each feed's name, w and h; each segment's cell size; the desktop (the outputs' bounding box).
 * @param {object} layout
 * @returns {object}
 */
export function normalizeLayout(layout) {
  const v = validateLayout(layout);
  if (!v.ok) throw new LayoutError(layout?.id, v.errors);
  const L = JSON.parse(JSON.stringify(layout));
  const layoutCell = L.cells?.size ?? null;
  for (const s of L.segments) s.cell = s.cells?.size ?? layoutCell ?? cellSizeFor(s.w, s.h);
  const segById = new Map(L.segments.map((s) => [s.id, s]));
  for (const f of L.feeds) {
    const s = segById.get(f.segment);
    f.name = f.name ?? defaultFeedName(f, layout.feeds);
    const turned = f.rotate === 90 || f.rotate === 270;
    f.w = f.w ?? (turned ? s.h : s.w);
    f.h = f.h ?? (turned ? s.w : s.h);
  }
  if (!L.desktop) {
    L.desktop = { w: Math.max(...L.outputs.map((o) => o.x + o.w)), h: Math.max(...L.outputs.map((o) => o.y + o.h)) };
  }
  L.aliases = L.aliases ?? [];
  L.warnings = v.warnings;
  return L;
}

/**
 * Find a layout in a list by its id or one of its aliases, ignoring case; null when none has that name.
 * @param {object[]} layouts
 * @param {string} name
 * @returns {object|null}
 */
export function findLayout(layouts, name) {
  const k = String(name ?? '').trim().toLowerCase();
  if (!k) return null;
  return (layouts || []).find((l) => l.id.toLowerCase() === k || (l.aliases || []).some((a) => a.toLowerCase() === k)) || null;
}

/**
 * The simplest layout: one segment, one output, 1:1 (a size typed in, or "this window as it is").
 * @param {number} w
 * @param {number} h
 * @returns {object}
 */
export function identityLayout(w, h, { id = `${w}x${h}`, title = `one picture ${w}×${h}` } = {}) {
  return {
    format: ALIGN_FORMAT, id, title,
    art: { w, h },
    segments: [{ id: 'ALL', x: 0, y: 0, w, h }],
    outputs: [{ id: 'OUT', x: 0, y: 0, w, h }],
    feeds: [{ segment: 'ALL', output: 'OUT', x: 0, y: 0 }],
  };
}

/**
 * The same layout for a work that draws its art canvas at k times the density: segments, blend bands, masks and ident
 * surfaces scale with it; where each feed lands on its output, and how big, stays. Throws LayoutError when a value stops
 * being a whole pixel.
 * @param {object} layout
 * @param {number} k
 * @returns {object}
 */
export function scaleArt(layout, k) {
  if (k === 1) return layout;
  const L = JSON.parse(JSON.stringify(layout));
  const sc = (v, what) => { const r = v * k; if (Math.abs(r - Math.round(r)) > 1e-9) throw new LayoutError(layout.id, [`${what} ${v} × ${k} is not a whole pixel`]); return Math.round(r); };
  L.art.w = sc(L.art.w, 'art.w'); L.art.h = sc(L.art.h, 'art.h');
  for (const s of L.segments) {
    for (const key of ['x', 'y', 'w', 'h']) s[key] = sc(s[key], `${s.id}.${key}`);
    if (s.blend) for (const key of ['l', 'r', 't', 'b']) if (s.blend[key]) s.blend[key] = sc(s.blend[key], `${s.id}.blend.${key}`);
    if (s.masks) for (const [i, m] of s.masks.entries()) for (const key of ['x', 'y', 'w', 'h']) m[key] = sc(m[key], `${s.id}.masks[${i}].${key}`);
  }
  for (const f of L.feeds) {   // a feed with no size was the segment's size: write it down, so the output side does not shrink
    const s0 = layout.segments.find((x) => x.id === f.segment), turned = f.rotate === 90 || f.rotate === 270;
    f.w = f.w ?? (turned ? s0.h : s0.w); f.h = f.h ?? (turned ? s0.w : s0.h);
  }
  if (L.cells?.size) L.cells.size = sc(L.cells.size, 'cells.size');
  if (L.ident?.surfaces) for (const f of L.ident.surfaces) for (const key of ['x', 'y', 'w', 'h']) f[key] = sc(f[key], `ident.${f.id}.${key}`);
  return L;
}
