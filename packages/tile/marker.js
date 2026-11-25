// @openav/tile · marker — a screen covered edge to edge in small ArUco markers, so one photo finds it.
//
//   markerGrid(w, h)                  where each marker sits on a w×h-pixel screen (pure)
//   markerId(device, cell)            the marker that says "screen #device, cell #cell"; decodeMarkerId(id) the reverse
//   correspondences(found, roster)    markers found in a photo → each screen's corners, in its pixels and in the photo
//   drawMarkers(ctx, { w, h, index }) paint the markers on a 2D canvas (the only part that needs a browser)
//
// Why many small markers and not one big one (the ChArUco idea): screens overlap, hands and phones cover corners, and
// a phone lies at any angle. Each marker carries its own screen and cell number and four corners, so any four that stay
// in view place the whole screen. Marker ids come from DICT_5X5_1000 (dict.js): 50 per screen, so up to 20 screens.
//
// The grid is the same function on both ends: the tile draws markerGrid(w, h) and the camera page recomputes it from
// the w, h the tile reported. Corners are whole device pixels (the edge of a pixel, canvas convention), so what is
// drawn and what the solver is told are the same numbers.

import { markerBits, DICT_BITS, DICT_SIZE } from './dict.js';

export const PER_DEVICE = 50;
export const MAX_DEVICES = Math.floor(DICT_SIZE / PER_DEVICE);
/** short: markers across the short side · fill: share of a cell the marker takes (the rest is its white quiet zone) */
export const GRID_DEFAULTS = Object.freeze({ short: 4, fill: 0.72 });

export function markerId(device, cell) {
  if (!(Number.isInteger(device) && device >= 0 && device < MAX_DEVICES)) throw new RangeError(`screen number ${device} is not 0…${MAX_DEVICES - 1}`);
  if (!(Number.isInteger(cell) && cell >= 0 && cell < PER_DEVICE)) throw new RangeError(`cell ${cell} is not 0…${PER_DEVICE - 1}`);
  return device * PER_DEVICE + cell;
}

/** { device, cell } for a marker id, or null for an id outside the dictionary. */
export function decodeMarkerId(id) {
  if (!(Number.isInteger(id) && id >= 0 && id < MAX_DEVICES * PER_DEVICE)) return null;
  return { device: Math.floor(id / PER_DEVICE), cell: id % PER_DEVICE };
}

/**
 * The markers of a w×h-pixel screen. Cells are square; `short` of them span the short side (with a fifth of a cell
 * left at each end), as many as fit along the long side, at most PER_DEVICE in all. Each marker is a whole number
 * of modules (bits + 2 for the black border) of whole pixels, centred in its cell.
 * @returns {{ cell:number, nx:number, ny:number, module:number, size:number, markers:{cell:number, corners:number[][]}[] }}
 */
export function markerGrid(w, h, { short = GRID_DEFAULTS.short, fill = GRID_DEFAULTS.fill } = {}) {
  w = Math.floor(w); h = Math.floor(h);
  if (!(w > 0 && h > 0)) return { cell: 0, nx: 0, ny: 0, module: 0, size: 0, markers: [] };
  let c = Math.min(w, h) / (short + 0.4), nx, ny;
  for (;;) {
    nx = Math.max(1, Math.floor((w - 0.4 * c) / c));
    ny = Math.max(1, Math.floor((h - 0.4 * c) / c));
    if (nx * ny <= PER_DEVICE) break;
    c *= 1.05;                                            // a very long, thin screen: fewer, bigger cells
  }
  const mods = DICT_BITS + 2;
  const module = Math.max(1, Math.floor((fill * c) / mods));
  const size = module * mods;
  const ox = (w - nx * c) / 2, oy = (h - ny * c) / 2;
  const markers = [];
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const x0 = Math.round(ox + (i + 0.5) * c - size / 2), y0 = Math.round(oy + (j + 0.5) * c - size / 2);
    // OpenCV's corner order: top-left, top-right, bottom-right, bottom-left of the marker as drawn
    markers.push({ cell: j * nx + i, corners: [[x0, y0], [x0 + size, y0], [x0 + size, y0 + size], [x0, y0 + size]] });
  }
  return { cell: c, nx, ny, module, size, markers };
}

/**
 * Markers found in a photo, sorted onto the screens they belong to.
 * @param {{id:number, corners:number[][]}[]} found     marker id + its 4 corners in the photo (OpenCV's order)
 * @param {{id:string, index:number, w:number, h:number}[]} roster   the screens in the room and their numbers
 * @param {object} [grid]   the grid options the tiles drew with
 * @returns {{ devices: {id, index, w, h, markers: {marker, cell, device, photo}[]}[], unknown: number[], duplicate: number[] }}
 *   unknown: ids of no screen in the roster (or a cell that screen does not have); duplicate: a cell seen twice
 *   (a reflection, or two screens showing one number) — dropped, since either copy may be the wrong one.
 */
export function correspondences(found, roster, grid = {}) {
  const byIndex = new Map(roster.filter((d) => d && Number.isInteger(d.index)).map((d) => [d.index, d]));
  const grids = new Map(), hits = new Map(), unknown = [], duplicate = [];
  for (const f of found || []) {
    const dec = decodeMarkerId(f?.id);
    const dev = dec && byIndex.get(dec.device);
    if (!dev || !Array.isArray(f.corners) || f.corners.length !== 4) { unknown.push(f?.id); continue; }
    if (!grids.has(dev.id)) grids.set(dev.id, markerGrid(dev.w, dev.h, grid));
    const m = grids.get(dev.id).markers[dec.cell];
    if (!m) { unknown.push(f.id); continue; }
    const key = dev.id + '#' + dec.cell;
    if (hits.has(key)) { hits.get(key).dupe = true; duplicate.push(f.id); continue; }
    hits.set(key, { dev, marker: f.id, cell: dec.cell, device: m.corners, photo: f.corners.map((p) => [p[0], p[1]]) });
  }
  const devices = roster.filter((d) => d && Number.isInteger(d.index)).map((d) => ({ id: d.id, index: d.index, w: d.w, h: d.h, markers: [] }));
  const at = new Map(devices.map((d) => [d.id, d]));
  for (const h of hits.values()) if (!h.dupe) at.get(h.dev.id).markers.push({ marker: h.marker, cell: h.cell, device: h.device, photo: h.photo });
  return { devices, unknown, duplicate };
}

/**
 * Paint screen #index's markers: white page, black markers. `ctx` draws in device pixels (a canvas of w×h).
 * `label` (optional) is written small in the bottom margin, where it cannot touch a marker.
 */
export function drawMarkers(ctx, { w, h, index, grid = {}, label = '' }) {
  const g = markerGrid(w, h, grid);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  for (const m of g.markers) {
    const [x0, y0] = m.corners[0];
    ctx.fillStyle = '#000';
    ctx.fillRect(x0, y0, g.size, g.size);
    ctx.fillStyle = '#fff';
    const bits = markerBits(markerId(index, m.cell));
    for (let y = 0; y < DICT_BITS; y++) for (let x = 0; x < DICT_BITS; x++)
      if (bits[y][x]) ctx.fillRect(x0 + (x + 1) * g.module, y0 + (y + 1) * g.module, g.module, g.module);
  }
  const bottom = Math.max(...g.markers.map((m) => m.corners[2][1]));
  const room = h - bottom;
  if (label && room > 14) {
    ctx.fillStyle = '#9aa0a8';
    ctx.font = `${Math.min(28, Math.floor(room * 0.45))}px ui-monospace, monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(label, w / 2, bottom + room / 2);
  }
  ctx.restore();
  return g;
}
