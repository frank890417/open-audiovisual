// @openav/surface · layout — the layout JSON, and how it becomes a grid.
// Pure logic (no DOM) so every rule here is unit-tested.
//
// A layout is data, like a Mapper route — shareable as a file, writable by an
// agent, publishable by a World:
//
//   { "version": 1, "title": "Bloom",
//     "pages": [{
//       "id": "main", "title": "Main",
//       "grid": { "cols": 8, "rows": 4 },                    // the base arrangement
//       "widgets": [
//         { "id": "hue", "type": "knob",  "label": "Hue", "x": 0, "y": 0, "w": 2, "h": 2, "min": 0, "max": 360, "def": 205, "color": "cyan" },
//         { "id": "go",  "type": "button", "label": "Burst", "x": 2, "y": 0, "w": 2, "h": 1 }
//       ],
//       "portrait":  { "grid": { "cols": 4, "rows": 8 }, "place": { "hue": { "x": 0, "y": 0, "w": 2, "h": 2 } } },
//       "landscape": { … same shape … }                      // both optional
//     }] }
//
// Orientation rules (the phone gets turned; a layout must survive it):
//   1. page.portrait / page.landscape exist for the current orientation →
//      use their grid; widgets without an entry in `place` keep the base
//      placement, or are packed into free cells.
//   2. otherwise, if the base grid's shape matches the current orientation → base.
//   3. otherwise AUTO-REFLOW: same widgets, same sizes, repacked row by row into
//      a grid with half (portrait) or double (landscape) the columns.
// A grid always fills the viewport — rows are a count, not pixels — so nothing
// ever scrolls, which is the one thing a stage controller must never do.

/** Natural size of each widget type, in grid cells. Layouts only need to say
 *  x/y/w/h when they care; autoArrange fills in the rest. */
export const DEFAULT_SIZE = {
  fader: { w: 1, h: 4 }, knob: { w: 2, h: 2 }, encoder: { w: 2, h: 2 },
  button: { w: 2, h: 1 }, toggle: { w: 2, h: 1 }, xy: { w: 4, h: 4 },
  bank: { w: 4, h: 4 }, radio: { w: 4, h: 1 }, pads: { w: 4, h: 4 },
  keyboard: { w: 8, h: 4 }, number: { w: 2, h: 1 }, text: { w: 4, h: 1 },
  label: { w: 2, h: 1 }, meter: { w: 1, h: 4 },
};
export const WIDGET_TYPES = Object.keys(DEFAULT_SIZE);

export const orientationOf = (w, h) => (w >= h ? 'landscape' : 'portrait');
export const gridOrientation = (g) => (g.cols >= g.rows ? 'landscape' : 'portrait');

/** Check a layout (raw JSON). Returns a list of human-readable problems; [] = fine. */
export function validateLayout(layout) {
  const errs = [];
  if (!layout || typeof layout !== 'object') return ['layout must be an object'];
  if (!Array.isArray(layout.pages) || !layout.pages.length) return ['layout.pages must be a non-empty array'];
  const pageIds = new Set();
  layout.pages.forEach((p, pi) => {
    const where = `pages[${pi}]`;
    if (!p.id) errs.push(`${where}: missing id`);
    else if (pageIds.has(p.id)) errs.push(`${where}: duplicate page id "${p.id}"`);
    else pageIds.add(p.id);
    if (p.id && !/^[\w-]+$/.test(p.id)) errs.push(`${where}: page id "${p.id}" must be [A-Za-z0-9_-]`);
    const ids = new Set();
    (p.widgets || []).forEach((w, wi) => {
      const ww = `${where}.widgets[${wi}]`;
      if (!WIDGET_TYPES.includes(w.type)) errs.push(`${ww}: unknown type "${w.type}"`);
      if (!w.id) errs.push(`${ww}: missing id`);
      else if (ids.has(w.id)) errs.push(`${ww}: duplicate id "${w.id}"`);
      else ids.add(w.id);
      if (w.id && !/^[\w-]+$/.test(w.id)) errs.push(`${ww}: id "${w.id}" must be [A-Za-z0-9_-] (it becomes part of a signal name)`);
      if (w.min !== undefined && w.max !== undefined && w.min === w.max) errs.push(`${ww}: min equals max`);
    });
  });
  return errs;
}

/** Fill defaults without mutating the input: ids, grids, per-type sizes. */
export function normalizeLayout(raw) {
  const pages = (raw?.pages || []).map((p, pi) => {
    const seen = new Set();
    const widgets = (p.widgets || []).map((w, wi) => {
      let id = w.id || `${w.type}${wi + 1}`;
      while (seen.has(id)) id += '_';
      seen.add(id);
      return { ...w, id };
    });
    return { id: p.id || `page${pi + 1}`, title: p.title || p.id || `Page ${pi + 1}`, ...p, widgets,
      grid: { cols: p.grid?.cols ?? 8, rows: p.grid?.rows ?? 6 } };
  });
  return { version: 1, title: raw?.title || '', ...raw, pages };
}

const hasPlace = (w) => Number.isFinite(w.x) && Number.isFinite(w.y);
const sizeOf = (w, cols) => {
  const d = DEFAULT_SIZE[w.type] || { w: 2, h: 2 };
  return { w: Math.max(1, Math.min(cols, Math.round(w.w ?? d.w))), h: Math.max(1, Math.round(w.h ?? d.h)) };
};

/** Occupancy-grid packing: each item takes the first free spot scanning
 *  row-major — what a human would do laying out a controller left to right.
 *  `fixed` placements are respected and block their cells.
 *  @returns {{placements: {id,x,y,w,h}[], rows:number}} */
export function autoArrange(items, cols, fixed = []) {
  const occ = new Set();
  const key = (x, y) => y * 1000 + x;
  const mark = (p) => { for (let yy = p.y; yy < p.y + p.h; yy++) for (let xx = p.x; xx < p.x + p.w; xx++) occ.add(key(xx, yy)); };
  const free = (x, y, w, h) => { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) if (occ.has(key(xx, yy))) return false; return true; };
  fixed.forEach(mark);
  let rows = fixed.reduce((m, p) => Math.max(m, p.y + p.h), 0);
  const placements = [...fixed];
  for (const it of items) {
    const w = Math.min(cols, it.w), h = it.h;
    let done = false;
    for (let y = 0; !done; y++) {
      for (let x = 0; x + w <= cols; x++) {
        if (free(x, y, w, h)) { const p = { id: it.id, x, y, w, h }; mark(p); placements.push(p); rows = Math.max(rows, y + h); done = true; break; }
      }
    }
  }
  return { placements, rows };
}

/** Resolve one page for an orientation → the grid and every widget's cell. */
export function resolvePage(page, orientation) {
  const base = page.grid || { cols: 8, rows: 6 };
  const widgets = page.widgets || [];
  const variant = page[orientation];
  const withSize = (w, p = {}) => ({ id: w.id, ...sizeOf({ ...w, ...p }, 99), x: p.x ?? w.x, y: p.y ?? w.y });

  // 1. explicit variant for this orientation
  if (variant && (variant.grid || variant.place)) {
    const grid = { cols: variant.grid?.cols ?? base.cols, rows: variant.grid?.rows ?? base.rows };
    const fixed = [], loose = [];
    for (const w of widgets) {
      const p = variant.place?.[w.id] ?? (hasPlace(w) ? w : null);
      if (p && hasPlace(p)) fixed.push({ id: w.id, x: p.x, y: p.y, ...sizeOf({ ...w, ...p }, grid.cols) });
      else loose.push({ id: w.id, ...sizeOf(w, grid.cols) });
    }
    const { placements, rows } = autoArrange(loose, grid.cols, fixed);
    return { grid: { cols: grid.cols, rows: Math.max(grid.rows, rows) }, placements, source: 'explicit' };
  }

  // 2. base grid matches this orientation (and everything is placed)
  if (gridOrientation(base) === orientation && widgets.every(hasPlace)) {
    return { grid: { ...base }, placements: widgets.map((w) => ({ id: w.id, x: w.x, y: w.y, ...sizeOf(w, base.cols) })), source: 'base' };
  }

  // 3. auto-reflow: keep reading order (base y,x if placed, else array order)
  const cols = orientation === 'portrait'
    ? Math.max(2, Math.ceil(base.cols / 2))
    : Math.min(16, gridOrientation(base) === 'portrait' ? base.cols * 2 : base.cols);
  const ordered = widgets.map((w, i) => ({ w, i })).sort((a, b) =>
    (hasPlace(a.w) && hasPlace(b.w)) ? (a.w.y - b.w.y || a.w.x - b.w.x) : a.i - b.i).map((o) => o.w);
  const packed = autoArrange(ordered.map((w) => ({ id: w.id, ...sizeOf(w, cols) })), cols);
  return { grid: { cols, rows: Math.max(1, packed.rows) }, placements: stretchRows(packed.placements, cols), source: 'reflow' };
}

/** A last row that stops short (5 faders in 4 columns → one lonely fader) is
 *  stretched to the edge. Only rows that are contiguous from x=0, all the same
 *  height, with nothing else to their right — never overlaps. Extra columns are
 *  dealt out one at a time, left to right. */
export function stretchRows(placements, cols) {
  const out = placements.map((p) => ({ ...p }));
  const occupied = (x, y, h, self) => out.some((q) => !self.includes(q) && q.x <= x && x < q.x + q.w && q.y < y + h && y < q.y + q.h);
  for (const y of [...new Set(out.map((p) => p.y))]) {
    const row = out.filter((p) => p.y === y).sort((a, b) => a.x - b.x);
    const hh = row[0].h;
    if (row.some((p) => p.h !== hh) || row[0].x !== 0) continue;
    if (row.some((p, i) => i && p.x !== row[i - 1].x + row[i - 1].w)) continue;
    const end = row[row.length - 1].x + row[row.length - 1].w;
    let extra = cols - end;
    if (extra <= 0 || occupied(end, y, hh, row)) continue;
    for (let i = 0; extra > 0; i = (i + 1) % row.length, extra--) row[i].w++;
    let x = 0; for (const p of row) { p.x = x; x += p.w; }
  }
  return out;
}

/** Flatten every output name a layout can publish (for docs, tests, mapping UIs). */
export function signalNames(layout) {
  const out = [];
  for (const p of normalizeLayout(layout).pages) for (const w of p.widgets) {
    const base = `surface/${p.id}/${w.id}`;
    switch (w.type) {
      case 'xy': out.push(base + '/x', base + '/y', base + '/down'); break;
      case 'bank': for (let i = 1; i <= (w.count ?? 8); i++) out.push(`${base}/${i}`); break;
      case 'pads': out.push(base + '/hit'); for (let i = 0; i < (w.rows ?? 4) * (w.cols ?? 4); i++) out.push(`${base}/${i}`); break;
      case 'keyboard': out.push('midi/note/on', 'midi/note/off', 'midi/cc/64', 'midi/virtual'); break;
      case 'encoder': out.push(base, base + '/delta'); break;
      case 'label': case 'meter': break;
      default: out.push(base);
    }
  }
  return [...new Set(out)];
}
