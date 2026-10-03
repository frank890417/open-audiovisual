import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateLayout, normalizeLayout, resolvePage, autoArrange, stretchRows, signalNames } from '../packages/surface/layout.js';
import { autoSurface, feedbackFor, widgetTypeFor, routesFromLayout } from '../packages/surface/auto.js';
import { planKeyboard, whiteSpan, seamSpan } from '../packages/surface/kbplan.js';
import { Signals } from '../packages/core/src/signals.js';
import { Params } from '../packages/core/src/params.js';
import { Mapper } from '../packages/mapping/index.js';
globalThis.performance ??= { now: () => Date.now() };

const overlap = (ps) => { for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) { const a = ps[i], b = ps[j];
  if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) return [a.id, b.id]; } return null; };
const faders = (n) => Array.from({ length: n }, (_, i) => ({ id: 'f' + i, type: 'fader' }));

test('validateLayout reports every problem', () => {
  assert.deepEqual(validateLayout({ pages: [{ id: 'a', widgets: [{ id: 'x', type: 'fader' }] }] }), []);
  const errs = validateLayout({ pages: [{ id: 'a', widgets: [{ id: 'x', type: 'nope' }, { id: 'x', type: 'fader' }, { id: 'bad id', type: 'knob' }] }] });
  assert.equal(errs.length, 3);
  assert.ok(validateLayout({}).length);
});

test('normalizeLayout fills ids, grid, de-duplicates', () => {
  const l = normalizeLayout({ pages: [{ widgets: [{ type: 'fader' }, { type: 'fader', id: 'fader1' }] }] });
  assert.equal(l.pages[0].id, 'page1'); assert.deepEqual(l.pages[0].grid, { cols: 8, rows: 6 });
  assert.equal(new Set(l.pages[0].widgets.map((w) => w.id)).size, 2);
});

test('autoArrange packs first-fit, never overlaps, respects fixed cells', () => {
  const items = [{ id: 'a', w: 4, h: 2 }, { id: 'b', w: 4, h: 2 }, { id: 'c', w: 8, h: 1 }, { id: 'd', w: 2, h: 2 }];
  const { placements, rows } = autoArrange(items, 8);
  assert.equal(overlap(placements), null); assert.equal(rows, 5);
  assert.deepEqual(placements.find((p) => p.id === 'b'), { id: 'b', x: 4, y: 0, w: 4, h: 2 });
  const r2 = autoArrange([{ id: 'n', w: 2, h: 1 }], 4, [{ id: 'f', x: 0, y: 0, w: 2, h: 1 }]);
  assert.deepEqual(r2.placements.find((p) => p.id === 'n'), { id: 'n', x: 2, y: 0, w: 2, h: 1 });
});

test('resolvePage: base when shape matches, reflow when it does not', () => {
  const page = { grid: { cols: 8, rows: 4 }, widgets: faders(8).map((w, i) => ({ ...w, x: i, y: 0, w: 1, h: 4 })) };
  const land = resolvePage(page, 'landscape');
  assert.equal(land.source, 'base'); assert.equal(land.grid.cols, 8);
  const port = resolvePage(page, 'portrait');
  assert.equal(port.source, 'reflow'); assert.equal(port.grid.cols, 4); assert.equal(port.grid.rows, 8);
  assert.equal(port.placements.length, 8); assert.equal(overlap(port.placements), null);
  for (const p of port.placements) assert.ok(p.x >= 0 && p.x + p.w <= port.grid.cols);
});

test('resolvePage: explicit portrait variant wins; unplaced widgets fill free cells', () => {
  const page = { grid: { cols: 8, rows: 4 }, widgets: [
    { id: 'a', type: 'fader', x: 0, y: 0, w: 1, h: 4 }, { id: 'b', type: 'knob', x: 1, y: 0 }, { id: 'c', type: 'button' }],
    portrait: { grid: { cols: 4, rows: 6 }, place: { a: { x: 3, y: 0, w: 1, h: 6 } } } };
  const r = resolvePage(page, 'portrait');
  assert.equal(r.source, 'explicit'); assert.equal(r.grid.cols, 4);
  assert.deepEqual(r.placements.find((p) => p.id === 'a'), { id: 'a', x: 3, y: 0, w: 1, h: 6 });
  assert.equal(overlap(r.placements), null); assert.equal(r.placements.length, 3);
});

test('reflow of a portrait base into landscape doubles columns; stretchRows fills the lonely last row', () => {
  const page = { grid: { cols: 4, rows: 8 }, widgets: faders(5).map((w, i) => ({ ...w, x: i % 4, y: i < 4 ? 0 : 4, w: 1, h: 4 })) };
  const land = resolvePage(page, 'landscape');
  assert.equal(land.grid.cols, 8);
  const port = resolvePage({ grid: { cols: 8, rows: 4 }, widgets: faders(5) }, 'portrait');
  const last = port.placements.find((p) => p.id === 'f4');
  assert.equal(last.w, 4, 'lone fader stretched to the full 4 columns');
  assert.equal(overlap(port.placements), null);
  assert.equal(overlap(stretchRows(autoArrange(faders(6).map((f) => ({ id: f.id, w: 1, h: 4 })), 4).placements, 4)), null);
});

test('signalNames lists what a layout can publish', () => {
  const n = signalNames({ pages: [{ id: 'm', widgets: [{ id: 'a', type: 'xy' }, { id: 'b', type: 'bank', count: 2 }, { id: 'k', type: 'keyboard' }, { id: 'f', type: 'fader' }] }] });
  for (const s of ['surface/m/a/x', 'surface/m/a/y', 'surface/m/b/1', 'surface/m/b/2', 'midi/note/on', 'midi/cc/64', 'surface/m/f']) assert.ok(n.includes(s), s);
});

const PARAMS = [
  { key: 'hue', min: 0, max: 360, def: 200 }, { key: 'size', min: 1, max: 10, def: 4 },
  { key: 'mode', min: 0, max: 3, step: 1, def: 1 }, { key: 'mirror', min: 0, max: 1, step: 1, def: 0 },
  { key: 'x', min: 0, max: 1, def: .5 }, { key: 'y', min: 0, max: 1, def: .5 }, { key: 'go', pulse: true },
];

test('widgetTypeFor picks the control from the declaration', () => {
  assert.equal(widgetTypeFor(PARAMS[0]), 'fader'); assert.equal(widgetTypeFor(PARAMS[0], { continuousCount: 9 }), 'knob');
  assert.equal(widgetTypeFor(PARAMS[2]), 'radio'); assert.equal(widgetTypeFor(PARAMS[3]), 'toggle');
  assert.equal(widgetTypeFor(PARAMS[6]), 'button'); assert.equal(widgetTypeFor({ key: 'q', min: 0, max: 1, surface: { type: 'knob' } }), 'knob');
});

test('autoSurface: valid layout, one route per control, xy pairs, meters, pagination', () => {
  const { layout, routes, bindings } = autoSurface(PARAMS, { pairs: [['x', 'y']], meters: ['hue'] });
  assert.deepEqual(validateLayout(layout), []);
  const byTarget = Object.fromEntries(routes.map((r) => [r.target, r]));
  assert.equal(byTarget.hue.source, 'surface/main1/hue'.replace('main1', layout.pages.find((p) => p.widgets.some((w) => w.id === 'hue')).id));
  assert.ok(byTarget.x.source.endsWith('/x') && byTarget.y.source.endsWith('/y'));
  assert.equal(byTarget.go.smooth, 0); assert.ok(byTarget.hue.smooth > 0);
  assert.equal(routes.length, PARAMS.length);
  assert.ok(bindings.some((b) => b.readonly), 'meter binding');
  const wide = autoSurface(Array.from({ length: 20 }, (_, i) => ({ key: 'p' + i, min: 0, max: 1, def: 0 })));
  assert.ok(wide.layout.pages.length >= 2); for (const p of wide.layout.pages) assert.ok(p.widgets.length <= 8);
  assert.ok(wide.layout.pages[0].widgets.every((w) => w.type === 'knob'), '>6 continuous params become knobs');
});

test('autoSurface routes actually drive params through a real Mapper (end to end)', () => {
  const signals = new Signals(); const params = new Params(PARAMS.map((p) => ({ ...p })));
  const mapper = new Mapper({ signals, params });
  const { routes } = autoSurface(PARAMS, { pairs: [['x', 'y']], smooth: 0 });
  routes.forEach((r) => mapper.addRoute(r));
  const src = (t) => routes.find((r) => r.target === t).source;
  signals.set(src('hue'), 0.5); assert.equal(params.resolve({}).hue, 180);
  signals.set(src('mode'), 2 / 3); assert.equal(params.resolve({}).mode, 2);
  signals.set(src('mirror'), 1); assert.equal(params.resolve({}).mirror, 1);
  signals.set(src('y'), 0.25); assert.equal(params.resolve({}).y, 0.25);
  let fired = 0; params.onPulse('go', () => fired++);
  signals.set(src('go'), 1); signals.set(src('go'), 0); signals.set(src('go'), 1);
  assert.equal(fired, 2, 'button press = rising edge fires the pulse param');
});

test('feedbackFor normalizes resolved state; routesFromLayout reads widget targets', () => {
  const { bindings } = autoSurface(PARAMS);
  const fb = feedbackFor({ hue: 90, size: 5.5 }, bindings);
  assert.equal(fb.find((f) => f.name.endsWith('/hue')).value, 0.25);
  const routes = routesFromLayout({ pages: [{ id: 'p', widgets: [
    { id: 'a', type: 'fader', target: 'hue' }, { id: 'pos', type: 'xy', target: ['x', 'y'] }, { id: 'm', type: 'bank', count: 2, target: ['size', 'hue'] }, { id: 'n', type: 'fader' }] }] }, PARAMS);
  assert.deepEqual(routes.map((r) => r.source + '>' + r.target), ['surface/p/a>hue', 'surface/p/pos/x>x', 'surface/p/pos/y>y', 'surface/p/m/1>size', 'surface/p/m/2>hue']);
});

test('planKeyboard: wide → one row; tall → two stacked rows that continue the range without orphan black keys', () => {
  const wide = planKeyboard({ width: 844, height: 330 });
  assert.equal(wide.stacked, false); assert.equal(wide.rows.length, 1); assert.ok(wide.keyPx >= 38);
  const tall = planKeyboard({ width: 390, height: 640 });
  assert.equal(tall.stacked, true); assert.equal(tall.rows.length, 2);
  const [upper, lower] = tall.rows;
  assert.equal(upper.base, lower.base + lower.semitones, 'upper row starts at the key right above the lower row');
  assert.ok([0, 2, 4, 5, 7, 9, 11].includes(upper.base % 12), 'upper row starts on a white key');
  assert.ok([4, 11].includes((lower.base + lower.semitones - 1) % 12), 'lower row ends on E or B');
  assert.ok(tall.keyPx >= 38);
  assert.ok(planKeyboard({ width: 1024, height: 1100 }).whites <= 14);
  assert.equal(whiteSpan(48, 7), 12); assert.equal(seamSpan(48, 10).whites, 10);
  for (const [w, h] of [[300, 300], [2000, 200], [390, 100]]) for (const r of planKeyboard({ width: w, height: h }).rows) assert.ok(r.base + r.semitones <= 128);
});
