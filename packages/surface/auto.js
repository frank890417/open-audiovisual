// @openav/surface · auto — autoSurface(params): a World's params become a control panel.
//
// This is how AGENTS.md rule #1 ("continuous control goes through params") pays
// off: because a world declares what it can be performed WITH, the phone can
// grow the right controls and the mapping that drives them without anyone
// drawing a layout.
//
//   const { layout, routes, bindings } = autoSurface(world.params);
//   routes.forEach((r) => mapper.addRoute(r));        // surface/… → param
//   // layout → the phone (relay.config('surface', {layout, bindings}))
//   // bindings → feedback: send each param's current value back so faders
//   //            follow the timeline / other controllers (feedbackFor()).
//
// Param declarations are the same as docs/writing-a-world.md:
//   { key, label?, min, max, def (or default), step?, pulse?, group? }
// plus an optional `surface` hint per param: { type, color, label }.
//
// Type choice (so the panel is playable without thinking):
//   pulse                         → button        (a trigger; Mapper fires on the rising edge)
//   step 1, range 1 (0..1)        → toggle
//   step 1, 2..7 values           → radio         (modes/scenes — you want to see all options)
//   everything else               → fader (≤ 6 continuous params) or knob (more)
//   pairs: [['cx','cy']]          → one xy pad driving both

import { DEFAULT_SIZE } from './layout.js?v=32849c5';

const COLORS = ['cyan', 'amber', 'magenta', 'lime', 'violet', 'coral'];
const safeId = (key) => String(key).replace(/[^\w-]/g, '_');
const defOf = (p) => p.def ?? p.default ?? p.min ?? 0;

/** Choose a widget type for one param declaration. */
export function widgetTypeFor(p, { continuousCount = 0, style = 'auto' } = {}) {
  if (p.surface?.type) return p.surface.type;
  if (p.pulse) return 'button';
  const span = (p.max ?? 1) - (p.min ?? 0);
  if (p.step === 1 && span === 1) return 'toggle';
  if (p.step === 1 && span >= 1 && span <= 6) return 'radio';
  if (style === 'knob') return 'knob';
  if (style === 'fader') return 'fader';
  return continuousCount > 6 ? 'knob' : 'fader';
}

/**
 * @param {object[]} params     world.params
 * @param {object} [opts]
 * @param {number} [opts.perPage=8]           max widgets per page (a page that scrolls is a page that fails)
 * @param {'auto'|'fader'|'knob'} [opts.style]
 * @param {string[][]} [opts.pairs]           [['x','y']] → xy pad
 * @param {string[]} [opts.meters]            param keys to ALSO show as read-only meters
 * @param {number} [opts.smooth=0.04]         seconds; hides 30 Hz network steps (zipper noise)
 * @param {string} [opts.title]
 * @returns {{layout:object, routes:object[], bindings:object[]}}
 */
export function autoSurface(params = [], { perPage = 8, style = 'auto', pairs = [], meters = [], smooth = 0.04, title = '' } = {}) {
  const byKey = new Map(params.map((p) => [p.key, p]));
  const paired = new Set(pairs.flat());
  const continuousCount = params.filter((p) => !p.pulse && !paired.has(p.key) && widgetTypeFor(p, { style }) !== 'radio' && widgetTypeFor(p, { style }) !== 'toggle').length;

  // 1 · one spec per widget, grouped
  const groups = new Map();           // group name -> specs
  const push = (group, spec) => { if (!groups.has(group)) groups.set(group, []); groups.get(group).push(spec); };
  let ci = 0;
  const color = (p) => p.surface?.color || COLORS[ci++ % COLORS.length];
  const done = new Set();

  for (const p of params) {
    if (done.has(p.key)) continue;
    const group = p.group || 'main';
    const pair = pairs.find((pr) => pr[0] === p.key);
    if (pair && byKey.has(pair[1])) {
      const q = byKey.get(pair[1]); done.add(p.key); done.add(q.key);
      push(group, { kind: 'pair', px: p, py: q, spec: { id: safeId(p.key) + '_' + safeId(q.key), type: 'xy', label: `${p.label || p.key} / ${q.label || q.key}`, color: color(p), w: 4, h: 4 } });
      continue;
    }
    if (paired.has(p.key)) continue;            // second half handled with its first
    done.add(p.key);
    const type = widgetTypeFor(p, { continuousCount, style });
    const spec = { id: safeId(p.key), type, label: p.surface?.label || p.label || p.key, color: color(p) };
    if (type === 'radio') {
      const n = (p.max - p.min) + 1;
      spec.options = p.options || Array.from({ length: n }, (_, i) => String(p.min + i));
    } else if (type !== 'button' && type !== 'toggle') {
      Object.assign(spec, { min: p.min ?? 0, max: p.max ?? 1, def: defOf(p) });
      if (p.step) spec.step = p.step;
    } else if (type === 'toggle') spec.def = defOf(p) >= (p.min + p.max) / 2 ? 1 : 0;
    push(group, { kind: 'param', p, spec });
  }
  for (const key of meters) {
    const p = byKey.get(key); if (!p || p.pulse) continue;
    push('meters', { kind: 'meter', p, spec: { id: 'm_' + safeId(key), type: 'meter', label: p.label || key, color: 'lime', min: p.min, max: p.max } });
  }

  // 2 · chunk each group into pages
  const pages = []; const routes = []; const bindings = [];
  const multi = groups.size > 1;
  for (const [group, specs] of groups) {
    // size-weighted chunks: 8 faders or 4 knobs or 2 xy pads per page
    const cap = perPage; let cur = []; let weight = 0; const chunks = [];
    for (const s of specs) {
      const d = DEFAULT_SIZE[s.spec.type];
      const wgt = s.spec.type === 'fader' || s.spec.type === 'meter' ? 1 : s.spec.type === 'xy' ? 4 : 2;
      if (weight + wgt > cap && cur.length) { chunks.push(cur); cur = []; weight = 0; }
      cur.push(s); weight += wgt; void d;
    }
    if (cur.length) chunks.push(cur);
    chunks.forEach((chunk, ci2) => {
      const id = (group === 'main' && !multi ? 'main' : safeId(group)) + (chunks.length > 1 ? (ci2 + 1) : '');
      pages.push({
        id, title: (group === 'main' && !multi ? 'Main' : group.charAt(0).toUpperCase() + group.slice(1)) + (chunks.length > 1 ? ` ${ci2 + 1}` : ''),
        grid: { cols: 8, rows: 4 },      // base shape; the other orientation auto-reflows (layout.js)
        widgets: chunk.map((s) => s.spec),
      });
      for (const s of chunk) addRoutes(id, s);
    });
  }

  function addRoutes(pageId, s) {
    const src = `surface/${pageId}/${s.spec.id}`;
    const route = (source, p, extra = {}) => ({ source, target: p.key, inMin: 0, inMax: 1, curve: 'linear', smooth: p.pulse ? 0 : smooth, outMin: p.min ?? 0, outMax: p.max ?? 1, ...extra });
    if (s.kind === 'pair') {
      routes.push(route(src + '/x', s.px), route(src + '/y', s.py));
      bindings.push({ param: s.px.key, name: src + '/x', page: pageId, widget: s.spec.id, min: s.px.min, max: s.px.max });
      bindings.push({ param: s.py.key, name: src + '/y', page: pageId, widget: s.spec.id, min: s.py.min, max: s.py.max });
    } else if (s.kind === 'param') {
      const p = s.p;
      if (p.pulse) routes.push(route(src, p, { smooth: 0 }));
      else if (s.spec.type === 'radio' || s.spec.type === 'toggle') routes.push(route(src, p, { smooth: 0 }));
      else routes.push(route(src, p));
      if (!p.pulse) bindings.push({ param: p.key, name: src, page: pageId, widget: s.spec.id, min: p.min ?? 0, max: p.max ?? 1 });
    } else if (s.kind === 'meter') {
      bindings.push({ param: s.p.key, name: src, page: pageId, widget: s.spec.id, min: s.p.min ?? 0, max: s.p.max ?? 1, readonly: true });
    }
  }

  return { layout: { version: 1, title, pages }, routes, bindings };
}

/** The "bindings" half of autoSurface: given resolved param state, which
 *  normalized values should the phone's widgets show right now?
 *  Pure — the runner calls it ~10×/s and sends each result as `feedback`. */
export function feedbackFor(state, bindings) {
  const out = [];
  for (const b of bindings) {
    const v = state[b.param];
    if (typeof v !== 'number' || b.max === b.min) continue;
    out.push({ name: b.name, value: Math.min(1, Math.max(0, (v - b.min) / (b.max - b.min))) });
  }
  return out;
}

/** Routes for a HAND-WRITTEN layout: any widget may name its param(s) with `target`.
 *    { type:'fader', id:'size', target:'size' }
 *    { type:'xy',    id:'pos',  target:['cx','cy'] }            (x → first, y → second)
 *    { type:'bank',  id:'mix',  count:3, target:['a','b','c'] } (channel i → i-th)
 *  Same route shape as autoSurface, so a layout file alone is enough to perform a World. */
export function routesFromLayout(layout, params = [], { smooth = 0.04 } = {}) {
  const byKey = new Map(params.map((p) => [p.key, p]));
  const routes = [];
  const add = (source, key, w) => {
    const p = byKey.get(key); if (!p) return;
    routes.push({ source, target: key, inMin: 0, inMax: 1, curve: w.curve || 'linear',
      smooth: p.pulse || w.type === 'radio' || w.type === 'toggle' || w.type === 'button' ? 0 : (w.smooth ?? smooth),
      outMin: p.min ?? 0, outMax: p.max ?? 1 });
  };
  for (const page of layout.pages || []) for (const w of page.widgets || []) {
    if (!w.target) continue;
    const base = `surface/${page.id}/${w.id}`;
    const t = Array.isArray(w.target) ? w.target : [w.target];
    if (w.type === 'xy') { if (t[0]) add(base + '/x', t[0], w); if (t[1]) add(base + '/y', t[1], w); }
    else if (w.type === 'bank') t.forEach((k, i) => add(`${base}/${i + 1}`, k, w));
    else add(base, t[0], w);
  }
  return routes;
}
