// @openav/align: the layout format (open-audiovisual/align@1, and art-align/v1 read unchanged), its checks, the mapping
// every output reads, cells, overlaps and blends, the test patterns, the Gray-code generator, the align command, the
// venue CLI, the schemas, and a check that no client, venue, exhibition or vendor name reaches the package or its pages.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as A from '../packages/align/index.js';
import { cellGrid, parseCellName, rowIndex } from '../packages/align/cells.js';
import { paramValues } from '../packages/align/mapping.js';
import { checkLayout } from '../tools/check-align-layout.mjs';
import { ROOT, ALIGN, loadLayout, clone, numericLeaves, mutate, fakeCtx, texts, forbiddenIn } from './_align.js';

const IDS = ['one-projector', 'example-edge-blend', 'led-wall-two-outputs', 'stacked-double', 'room-corner'];
const LED = loadLayout('led-wall-two-outputs');
const BLEND = loadLayout('example-edge-blend');
const STACK = loadLayout('stacked-double');
const ROOM = loadLayout('room-corner');

// ---------------------------------------------------------------- the format
test('align: every example layout follows the format with no warnings, and layouts/index.json lists exactly the folder', () => {
  for (const id of IDS) {
    const v = A.validateLayout(loadLayout(id));
    assert.deepEqual(v.errors, [], id);
    assert.deepEqual(v.warnings, [], id);
  }
  const idx = JSON.parse(fs.readFileSync(path.join(ALIGN, 'layouts/index.json'), 'utf8'));
  const files = fs.readdirSync(path.join(ALIGN, 'layouts')).filter((f) => f.endsWith('.json') && f !== 'index.json').sort();
  assert.deepEqual(idx.map((e) => e.file).sort(), files);
  for (const e of idx) assert.equal(loadLayout(e.file.replace(/\.json$/, '')).id, e.id);
  assert.equal(A.ALIGN_FORMAT, 'open-audiovisual/align@1');
  assert.equal(A.CONTRACT, A.ALIGN_FORMAT, 'CONTRACT is the old name of the same constant');
});

test('align: a layout written for art-align/v1 reads unchanged, extra keys and all, and maps exactly as the @1 file', () => {
  const old = clone(LED);
  delete old.format;
  Object.assign(old, { contract: 'art-align/v1', legacy: { name: 'old', flavor: 'led' }, private: true, example: true, notes: ['kept'], note: 'kept too' });
  const v = A.validateLayout(old);
  assert.deepEqual(v.errors, []);
  const a = A.computeMapping(old), b = A.computeMapping(LED);
  assert.deepEqual(a, b, 'same tiles, outputs, segments; the old keys change nothing');
  assert.equal(a.format, A.ALIGN_FORMAT, 'a mapping always says the new format');
  // "contract" with the new name also reads (a work that writes { contract: CONTRACT, … } with the new constant)
  const viaConst = { ...clone(LED), contract: A.CONTRACT }; delete viaConst.format;
  assert.ok(A.validateLayout(viaConst).ok);
  // two tags that disagree, or an unknown one, are refused
  assert.match(A.validateLayout({ ...clone(LED), contract: 'art-align/v1' }).errors.join(), /disagree/);
  assert.match(A.validateLayout({ ...clone(LED), format: 'art-align/v0' }).errors.join(), /format must be/);
  const none = clone(LED); delete none.format;
  assert.match(A.validateLayout(none).errors.join(), /format must be/);
});

test('align: the usual copying mistakes are refused, and the message says where', () => {
  const bad = (patch, re) => {
    const L = clone(LED);
    patch(L);
    const v = A.validateLayout(L);
    assert.equal(v.ok, false, String(re));
    assert.match(v.errors.join('\n'), re);
    assert.throws(() => A.computeMapping(L), A.LayoutError);
  };
  bad((L) => { L.segments[3].w = 1921; }, /segments\[3\] \(Q4\) lies outside the art canvas/);
  bad((L) => { L.segments[1].id = 'Q1'; }, /segment id Q1 is used twice/);
  bad((L) => { L.outputs[1].x = 1900; }, /outputs A and B overlap/);
  bad((L) => { L.feeds[1].y = 700; }, /lands outside A/);
  bad((L) => { L.feeds[2].segment = 'XX'; }, /is not a segment/);
  bad((L) => { L.feeds[2].x = 10.5; }, /integer/);
  bad((L) => { L.vendor = [{ file: 'a.png', output: 'Z' }]; }, /vendor\[0\]\.output/);
  bad((L) => { L.feeds.push({ segment: 'Q1', output: 'B', x: 0, y: 960, name: 'Q2' }); }, /feed name Q2 is used twice/);
  bad((L) => { L.feeds[0].rotate = 45; }, /rotate must be/);
  bad((L) => { L.outputs[0].cuts = { cols: 0 }; }, /cuts must be/);
  const e = new A.LayoutError('x', ['one', 'two']);
  assert.deepEqual(e.errors, ['one', 'two']);
  assert.match(e.message, /layout x does not follow open-audiovisual\/align@1/);
});

test('align: metres copied wrong give a pitch warning; two segments that overlap without a blend give another (neither refuses)', () => {
  const L = clone(LED); L.segments[3].meters.w = 5;
  const v = A.validateLayout(L);
  assert.ok(v.ok);
  assert.match(v.warnings.join('\n'), /Q4.*px\/m across/);
  const B = clone(BLEND); delete B.segments[0].blend; delete B.segments[1].blend;
  const w = A.validateLayout(B);
  assert.ok(w.ok);
  assert.match(w.warnings.join('\n'), /overlap on the canvas and neither declares a blend/);
  const lonely = clone(STACK); lonely.segments.push({ id: 'X', x: 0, y: 0, w: 10, h: 10 });
  assert.match(A.validateLayout(lonely).warnings.join(), /segment X goes into no output/);
});

test('align: every number of every example layout matters: one more or one less is refused, or the mapping changes', () => {
  // the source of truth must be tight: a number that changes nothing would be a number nobody checks
  let mutants = 0;
  for (const id of IDS) {
    const L = loadLayout(id), base = JSON.stringify(A.computeMapping(L));
    const paths = numericLeaves(L).filter((p) => /^(art\.[wh]|segments\.\d+\.(x|y|w|h|blend\.[lrtb]|masks\.\d+\.[xywh])|outputs\.\d+\.[xywh]|feeds\.\d+\.(x|y|w|h|rotate))$/.test(p));
    assert.ok(paths.length >= 6, `${id}: ${paths.length} numbers`);
    for (const p of paths) for (const d of [1, -1]) {
      mutants++;
      const M = mutate(L, p, d);
      const v = A.validateLayout(M);
      if (!v.ok) continue;
      assert.notEqual(JSON.stringify(A.computeMapping(M)), base, `${id} ${p}${d > 0 ? '+' : ''}${d} was accepted and changed nothing`);
    }
  }
  assert.ok(mutants > 150, `${mutants} mutants`);
});

test('align: normalizeLayout fills names, sizes and the desktop, and leaves its input alone', () => {
  const L = clone(STACK);
  for (const f of L.feeds) delete f.name;
  const N = A.normalizeLayout(L);
  assert.deepEqual(N.feeds.map((f) => f.name), ['S@upper', 'S@lower'], 'one segment to two outputs: segment@output');
  assert.deepEqual([N.feeds[0].w, N.feeds[0].h], [1920, 1200]);
  assert.deepEqual(N.desktop, { w: 3840, h: 1200 });
  assert.equal(L.feeds[0].w, undefined, 'the input is not touched');
  assert.equal(N.segments[0].cell, 240);
  assert.throws(() => A.normalizeLayout({ id: 'x' }), A.LayoutError);
});

test('align: a feed that scales (an LED processor): scale in the tile, desktop and art agree both ways, the blit plan divides by the pixel ratio', () => {
  const L = {
    format: A.ALIGN_FORMAT, id: 'scaled', art: { w: 5000, h: 1000 },
    segments: [{ id: 'W1', x: 0, y: 0, w: 2500, h: 1000 }, { id: 'W2', x: 2500, y: 0, w: 2500, h: 1000 }],
    outputs: [{ id: 'O', x: 0, y: 0, w: 3000, h: 2000 }],
    feeds: [{ segment: 'W1', output: 'O', x: 0, y: 0, w: 3000, h: 1000 }, { segment: 'W2', output: 'O', x: 0, y: 1000, w: 3000, h: 1000 }],
  };
  const M = A.computeMapping(L);
  assert.deepEqual(M.tiles[0].scale, { x: 1.2, y: 1 });
  const p = A.artToDesktop(M, 2500 + 100, 10)[0];
  assert.deepEqual([p.x, p.y], [120, 1010]);
  const back = A.desktopToArt(M, p.x, p.y);
  assert.deepEqual([back.x, back.y, back.segment], [2600, 10, 'W2']);
  const plan = A.blitPlan(M);
  assert.deepEqual(plan.tiles[1].uvOffset, { x: 0.5, y: 0 });
  assert.deepEqual(plan.tiles[1].viewport, { x: 0, y: 0, w: 3000, h: 1000 });
  const hi = A.blitPlan(M, { pixelRatio: 2 });
  assert.deepEqual(hi.tiles[0].viewport, { x: 0, y: 500, w: 1500, h: 500 }, 'GL origin bottom-left, CSS px');
  assert.equal(A.blitPlan(M, { buffer: { w: 100, h: 100 } }).mismatch, true);
});

test('align: a turned feed maps desktop and art the turned way, both directions', () => {
  const M = A.computeMapping(ROOM);
  const fl = M.tiles.find((t) => t.name === 'FL');
  assert.equal(fl.rotate, 180);
  // the floor turned 180°: its art top-left lands on the tile's bottom-right
  const [p] = A.artToDesktop(M, 0, 900);
  assert.deepEqual([p.tile, p.x, p.y], ['FL', 160 + 1600, 1170 + 800]);
  for (const [ax, ay] of [[10, 910], [800, 1300], [1500, 1650]]) {
    const [d] = A.artToDesktop(M, ax, ay);
    const a = A.desktopToArt(M, d.x, d.y);
    assert.deepEqual([Math.round(a.x * 1e6) / 1e6, Math.round(a.y * 1e6) / 1e6], [ax, ay]);
  }
  assert.equal(A.desktopToArt(M, 5, 5), null, 'the black border of the 4K output belongs to no tile');
});

test('align: vendor images, any number, filling an output or a rectangle; the art view shows a stacked segment once', () => {
  const L = clone(STACK);
  L.vendor = [{ file: 'up.png', output: 'upper' }, { file: 'low.png', output: 'lower' }, { file: 'all.png', rect: { x: 0, y: 0, w: 3840, h: 1200 } }];
  const M = A.computeMapping(L);
  const p = A.vendorPlacements(M, { base: '/charts/' });
  assert.deepEqual(p.map((x) => x.url), ['/charts/up.png', '/charts/low.png', '/charts/all.png']);
  assert.deepEqual(p[1].pct, { left: 50, top: 0, width: 50, height: 100 });
  assert.deepEqual(p[2].pct, { left: 0, top: 0, width: 100, height: 100 });
  const V = A.artView(A.computeMapping(STACK));
  assert.deepEqual(V.desktop, { w: 1920, h: 1200 });
  assert.deepEqual(V.tiles.map((t) => [t.name, t.dst.x, t.dst.w]), [['S', 0, 1920]]);
  assert.equal(V.view, 'art');
});

test('align: cells A1, B8 …: names, parsing, sizes, rectangles, the cell under a point', () => {
  assert.deepEqual([0, 4, 25, 26, 27, 701, 702].map(A.rowLabel), ['A', 'E', 'Z', 'AA', 'AB', 'ZZ', 'AAA']);
  for (const i of [0, 4, 25, 26, 27, 701, 702]) assert.equal(rowIndex(A.rowLabel(i)), i);
  assert.deepEqual(parseCellName('b8'), { row: 1, col: 7 });
  assert.equal(parseCellName('C0'), null);
  assert.equal(A.cellSizeFor(1920, 480), 240);
  assert.equal(A.cellSizeFor(1600, 900), 100);
  assert.equal(A.cellSizeFor(1920, 1080), 120);
  assert.equal(A.cellSizeFor(1000, 333), 67, 'nothing divides both: five rows');
  const M = A.computeMapping(LED);
  assert.deepEqual(M.segments.map((s) => [cellGrid(s, s.cell).cols, cellGrid(s, s.cell).rows]), [[8, 2], [8, 2], [8, 2], [8, 2]]);
  assert.deepEqual(A.cellRect(M.segments[1], 240, 'B8'), { x: 1920 + 7 * 240, y: 240, w: 240, h: 240 });
  assert.equal(A.cellRect(M.segments[1], 240, 'C1'), null, 'two rows only');
  assert.equal(A.cellAt(M.segments[2], 240, 3840 + 5, 5), 'A1');
  assert.equal(A.cellAt(M.segments[2], 240, 100, 5), null);
  assert.equal(A.cellIdAt(M, 5760 + 3 * 240 + 1, 241), 'Q4:B4');
  assert.equal([...A.eachCell({ x: 0, y: 0, w: 250, h: 100 }, 100)].length, 3, 'a part cell counts');
});

test('align: stacks and blend bands; in the band of the edge-blend example the two weights add up to 1', () => {
  const M = A.computeMapping(BLEND);
  const o = A.analyzeOverlaps(M);
  assert.deepEqual(o.bands, [{ a: 'L', b: 'R', rect: { x: 1728, y: 0, w: 192, h: 1080 } }]);
  assert.deepEqual(o.stacks, []);
  for (let x = 1728; x < 1920; x += 7) {
    const sum = A.blendWeight(M.tiles[0], x, 500) + A.blendWeight(M.tiles[1], x, 500);
    assert.ok(Math.abs(sum - 1) < 1e-12, `x ${x}: ${sum}`);
  }
  assert.equal(A.blendWeight(M.tiles[0], 100, 500), 1);
  assert.equal(A.blendWeight(M.tiles[1], 100, 500), 0);
  assert.deepEqual(A.analyzeOverlaps(A.computeMapping(STACK)).stacks, [{ segment: 'S', tiles: ['S1', 'S2'] }]);
});

test('align: venue params (decided or assumed, with whom to ask) and masks (a door) in the layout', () => {
  const M = A.computeMapping(ROOM);
  assert.deepEqual(M.params, { floor_turn: 180, door_mask: true });
  assert.deepEqual(paramValues({ a: { default: 1, value: 2 }, b: { default: 3 } }), { a: 2, b: 3 });
  const bad = (params) => A.validateLayout({ ...clone(ROOM), params }).errors.join('\n');
  assert.match(bad({ x: { note: 'what', status: 'decided' } }), /needs a default/);
  assert.match(bad({ x: { default: 1, status: 'decided' } }), /needs a note/);
  assert.match(bad({ x: { default: 1, note: 'what', status: 'assumed' } }), /write ask/);
  assert.match(bad({ x: { default: 'a', value: 'c', options: ['a', 'b'], note: 'what', status: 'decided' } }), /value "c" is not one of its options/);
  assert.match(bad({ x: { default: 1, note: 'what', status: 'maybe' } }), /status must be/);
  assert.ok(!('params' in A.computeMapping(STACK)), 'a layout without params: no params in its mapping');
  const wr = M.tiles.find((t) => t.name === 'WR');
  assert.deepEqual(wr.masks, [{ u: 1100 / 1600, v: 300 / 900, w: 300 / 1600, h: 600 / 900, label: 'door' }]);
  assert.match(A.validateLayout({ ...clone(ROOM), segments: ROOM.segments.map((s) => (s.id === 'WR' ? { ...s, masks: [{ x: 1500, y: 0, w: 200, h: 10 }] } : s)) }).errors.join(), /masks\[0\] lies outside the segment/);
});

test('align: the ident block is checked (surfaces inside the canvas, unique, sweep names real ones); without it the mapping has none', () => {
  const bad = (patch) => A.validateLayout({ ...clone(ROOM), ident: { ...ROOM.ident, ...patch } }).errors.join('; ');
  assert.match(bad({ surfaces: [...ROOM.ident.surfaces, { id: 'X', x: 3000, y: 0, w: 500, h: 10 }] }), /lies outside the art canvas/);
  assert.match(bad({ surfaces: [...ROOM.ident.surfaces, { ...ROOM.ident.surfaces[0] }] }), /used twice/);
  assert.match(bad({ sweep: ['L', 'Q'] }), /does not exist: Q/);
  const { ident, ...noIdent } = ROOM;
  assert.ok(ident);
  assert.equal('ident' in A.computeMapping(noIdent), false);
  assert.deepEqual(A.computeMapping(ROOM).ident.sweep, ['L', 'R']);
});

test('align: scaleArt halves the art canvas and keeps every tile where it lands on the output; a half pixel throws', () => {
  const M2 = A.computeMapping(ROOM), M1 = A.computeMapping(A.scaleArt(ROOM, 0.5));
  assert.deepEqual([M1.art.w, M1.art.h], [1600, 850]);
  for (const t of M2.tiles) {
    const u = M1.tiles.find((x) => x.name === t.name);
    assert.deepEqual(u.dst, t.dst, t.name);
    assert.deepEqual([u.src.w * 2, u.src.h * 2], [t.src.w, t.src.h]);
  }
  assert.deepEqual(M1.ident.surfaces.find((f) => f.id === 'F'), { ...M2.ident.surfaces.find((f) => f.id === 'F'), x: 0, y: 450, w: 800, h: 400 });
  assert.equal(A.scaleArt(ROOM, 1), ROOM);
  assert.throws(() => A.scaleArt(ROOM, 0.123), A.LayoutError);
});

test('align: identityLayout is one picture 1:1; findLayout finds by id or alias, any case', () => {
  const L = A.identityLayout(1280, 720);
  assert.ok(A.validateLayout(L).ok);
  assert.equal(L.format, A.ALIGN_FORMAT);
  assert.deepEqual(A.computeMapping(L).tiles[0].dst, { x: 0, y: 0, w: 1280, h: 720 });
  const all = IDS.map(loadLayout);
  assert.equal(A.findLayout(all, 'LED-BAND').id, 'led-wall-two-outputs');
  assert.equal(A.findLayout(all, ' room-corner ').id, 'room-corner');
  assert.equal(A.findLayout(all, 'nope'), null);
  assert.equal(A.findLayout(all, ''), null);
});

test('align: an align command\'s arguments: the default list, a narrower one, the optional variant and highlight', () => {
  assert.deepEqual(A.ALIGN_PATTERNS, ['tiles', 'grid', 'edges', 'crosshair', 'bars', 'vendor']);
  assert.deepEqual(A.normalizeAlignArgs({ pattern: 'tiles' }), { on: true, pattern: 'tiles' });
  assert.deepEqual(A.normalizeAlignArgs({ pattern: 'vendor' }, { patterns: ['tiles', 'grid'] }), { on: true, pattern: 'grid' });
  assert.deepEqual(A.normalizeAlignArgs({ on: false, pattern: 'bars', variant: 'steps', highlight: 'Q2:B3' }), { on: false, pattern: 'bars', variant: 'steps', highlight: 'Q2:B3' });
  assert.deepEqual(A.normalizeAlignArgs({ pattern: 'bars', variant: 'x'.repeat(40), highlight: '<script>' }), { on: true, pattern: 'bars' });
  assert.deepEqual(A.normalizeAlignArgs(null), { on: true, pattern: 'grid' });
});

// ---------------------------------------------------------------- the test patterns
test('align patterns: cells on the LED band, 8 × 2 per quarter, every name once per quarter', () => {
  const M = A.computeMapping(LED), ctx = fakeCtx();
  assert.deepEqual(A.drawPattern(ctx, M, 'tiles'), { drawn: 4 });
  const names = texts(ctx).filter((s) => /^[AB]\d$/.test(s));
  assert.equal(names.length, 64);
  assert.equal(names.filter((n) => n === 'B8').length, 4);
  for (const s of ['Q1', 'Q2', 'Q3', 'Q4', 'W 1920 X H 480', 'W 6.00(m) X H 1.50(m)', '→ A', '→ B']) assert.ok(texts(ctx).includes(s), s);
});

test('align patterns: each tile is clipped to its dst first, then drawn in art pixels (the work\'s own path)', () => {
  const M = A.computeMapping(LED), ctx = fakeCtx();
  A.drawPattern(ctx, M, 'grid');
  const rects = ctx.calls.filter((c) => c[0] === 'rect').map((c) => c.slice(1));
  assert.deepEqual(rects, M.tiles.map((t) => [t.dst.x, t.dst.y, t.dst.w, t.dst.h]));
  const tf = ctx.calls.filter((c) => c[0] === 'transform').map((c) => c.slice(1));
  assert.deepEqual(tf[3], [1, 0, 0, 1, 1920 - 5760, 480], 'Q4: art x 5760 lands on desktop x 1920, one row down');
});

test('align patterns: the two tiles of a stacked segment get two colours and say where they go; zh draws the Chinese words', () => {
  const M = A.computeMapping(STACK), ctx = fakeCtx();
  A.drawPattern(ctx, M, 'tiles');
  const fills = ctx.calls.filter((c) => c[0] === 'set' && c[1] === 'fillStyle').map((c) => c[2]);
  assert.ok(fills.includes('#2f8b83') && fills.includes('#8a3f6f'));
  assert.ok(texts(ctx).includes('segment S → lower'));
  const zh = fakeCtx(); A.drawPattern(zh, M, 'tiles', { lang: 'zh' });
  assert.ok(texts(zh).includes('段 S → lower'));
  // a feed of which the room sees only part: the edge of what is visible
  const L = clone(STACK); L.feeds[1].visible = { w: 1500 };
  const v = fakeCtx(); A.drawPattern(v, A.computeMapping(L), 'tiles');
  assert.ok(texts(v).includes('visible 1500 px ◀'));
});

test('align patterns: every pattern and every bars variant draws on every example; vendor draws nothing here; an unknown one throws', () => {
  for (const id of IDS) {
    const M = A.computeMapping(loadLayout(id));
    for (const m of [M, A.artView(M)]) {
      for (const p of A.ALIGN_PATTERNS) assert.doesNotThrow(() => A.drawPattern(fakeCtx(), m, p, { outputs: true }), `${id} ${p}`);
      for (const v of A.BAR_VARIANTS) assert.doesNotThrow(() => A.drawPattern(fakeCtx(), m, 'bars', { variant: v }), `${id} ${v}`);
    }
  }
  assert.deepEqual(A.drawPattern(fakeCtx(), A.computeMapping(LED), 'vendor'), { drawn: 0 });
  assert.throws(() => A.drawPattern(fakeCtx(), A.computeMapping(LED), 'nope'), /no pattern nope/);
});

test('align patterns: the ramp\'s gradient spans the whole art canvas, so it runs on across segments', () => {
  const ctx = fakeCtx();
  A.drawPattern(ctx, A.computeMapping(LED), 'bars', { variant: 'ramp' });
  const g = ctx.calls.filter((c) => c[0] === 'gradient');
  assert.equal(g.length, 16);
  for (const c of g) assert.deepEqual(c.slice(1), [0, 0, 7680, 0]);
});

test('align patterns: highlight one cell (on both tiles of a stacked segment); lines stay one canvas pixel wide in a small preview', () => {
  const c1 = fakeCtx();
  assert.equal(A.highlightCell(c1, A.computeMapping(LED), 'Q2:B3'), true);
  assert.deepEqual(c1.calls.find((c) => c[0] === 'strokeRect').slice(1), [1920 + 2 * 240, 240, 240, 240]);
  const c2 = fakeCtx();
  A.highlightCell(c2, A.computeMapping(STACK), 'S:B2');
  assert.equal(c2.calls.filter((c) => c[0] === 'strokeRect').length, 2);
  assert.equal(A.highlightCell(fakeCtx(), A.computeMapping(LED), 'Q2:C1'), false, 'two rows only');
  const ctx = fakeCtx();
  A.drawPattern(ctx, A.computeMapping(LED), 'tiles', { view: { k: 0.1, x: 0, y: 0 } });
  const widths = ctx.calls.filter((c) => c[0] === 'set' && c[1] === 'lineWidth').map((c) => c[2]);
  assert.ok(widths.every((w) => w >= 10 - 1e-9), `thinnest ${Math.min(...widths)}`);
  const o = fakeCtx(); A.drawOutputs(o, A.computeMapping(LED));
  assert.ok(texts(o).includes('output B  1920×1080 @ 1920,0'));
});

// ---------------------------------------------------------------- structured light
test('align gray code: 1920 × 1200 is 11 + 11 bits, with inverses and two references 46 frames', () => {
  assert.equal(A.bitsFor(1920), 11);
  assert.equal(A.bitsFor(1200), 11);
  assert.equal(A.bitsFor(3840), 12);
  assert.equal(A.bitsFor(1), 1);
  assert.equal(A.graySequence({ w: 1920, h: 1200 }).length, 46);
  assert.equal(A.graySequence({ w: 1920, h: 1200 }, { inverse: false, refs: false }).length, 22);
  assert.equal(A.graySequence({ w: 1920, h: 1080 }, { axes: ['x'] }).length, 24);
  assert.deepEqual(A.graySequence({ w: 4, h: 4 }).slice(0, 2), [{ kind: 'white' }, { kind: 'black' }]);
});

test('align gray code: encode and decode are inverse; neighbours differ in exactly one bit', () => {
  for (let n = 0; n < 5000; n++) {
    assert.equal(A.grayDecode(A.grayEncode(n)), n);
    const d = A.grayEncode(n) ^ A.grayEncode(n + 1);
    assert.equal(d & (d - 1), 0, `${n} → ${n + 1}`);
  }
});

test('align gray code: every x (0–1919) and y (0–1199) decodes back from the frames; an inverse frame is exactly the opposite', () => {
  const seq = A.graySequence({ w: 1920, h: 1200 });
  for (const [axis, size] of [['x', 1920], ['y', 1200]]) {
    const pos = seq.filter((f) => f.kind === 'gray' && f.axis === axis && !f.inverse);
    const neg = seq.filter((f) => f.kind === 'gray' && f.axis === axis && f.inverse);
    for (let c = 0; c < size; c++) {
      const bits = pos.map((f) => A.grayBitAt(f, c));
      assert.equal(A.decodeGrayBits(bits), c);
      neg.forEach((f, i) => assert.equal(A.grayBitAt(f, c), 1 - bits[i]));
    }
  }
  assert.equal(A.grayBitAt({ kind: 'white' }, 5), 1);
  assert.equal(A.grayBitAt({ kind: 'black' }, 5), 0);
});

test('align gray code: the lit runs cover exactly the lit pixels; the widest bit is one run, the finest size / 4', () => {
  const seq = A.graySequence({ w: 1920, h: 1200 }, { refs: false, inverse: false }).filter((f) => f.axis === 'x');
  for (const f of seq) {
    const lit = new Set();
    for (const [a, b] of A.grayRuns(f, 1920)) for (let i = a; i < b; i++) lit.add(i);
    for (let i = 0; i < 1920; i++) assert.equal(lit.has(i), A.grayBitAt(f, i) === 1);
  }
  assert.equal(A.grayRuns(seq[0], 1920).length, 1);
  assert.equal(A.grayRuns(seq.at(-1), 1920).length, 480);
});

test('align gray code: one channel per projector, three to a pass; each output draws only itself, in its own colour', () => {
  const M = A.computeMapping(STACK);
  assert.deepEqual(A.channelPlan(M), [{ upper: 'r', lower: 'g' }]);
  assert.equal(A.channelPlan({ outputs: [1, 2, 3, 4, 5].map((i) => ({ id: `P${i}` })) }).length, 2, 'five projectors: two passes');
  assert.deepEqual(A.channelPlan({ outputs: [1, 2, 3, 4].map((i) => ({ id: `P${i}` })) })[1], { P4: 'r' });
  const f = A.graySequence({ w: 1920, h: 1200 }).find((x) => x.kind === 'gray' && x.axis === 'x' && x.bit === 0 && !x.inverse);
  const ctx = fakeCtx();
  A.drawGrayFrame(ctx, M, f);
  const rects = []; let color = null;
  for (const c of ctx.calls) { if (c[0] === 'set' && c[1] === 'fillStyle') color = c[2]; else if (c[0] === 'fillRect') rects.push([color, ...c.slice(1)]); }
  // black, then the upper projector red where x ≥ 1024 (the highest bit), the lower one green on its own pixels
  assert.deepEqual(rects, [['#000', 0, 0, 3840, 1200], ['#ff0000', 1024, 0, 896, 1200], ['#00ff00', 2944, 0, 896, 1200]]);
  const only = fakeCtx(); A.drawGrayFrame(only, M, f, { assign: { lower: 'b' } });
  assert.equal(only.calls.filter((c) => c[0] === 'fillRect').length, 2, 'an output without a channel stays black');
  assert.equal(A.frameLabel(f), 'X bit 1 of 11');
  assert.equal(A.frameLabel({ ...f, inverse: true }, 'zh'), 'X 位元 1／11（反相）');
  assert.equal(A.frameLabel({ kind: 'white' }), 'white (the exposure reference)');
});

// ---------------------------------------------------------------- the CLI and the schemas
test('align: tools/check-align-layout.mjs reads a layout as the venue needs it: the mapping, masks, the open questions; an error fails', () => {
  const r = checkLayout(ROOM);
  assert.equal(r.ok, true);
  const out = r.lines.join('\n');
  assert.match(out, /art 3200×1700 → desktop 3840×2160: 1 output\(s\), 3 segment\(s\), 3 tile\(s\)/);
  assert.match(out, /FL .* turned 180°/);
  assert.match(out, /masks: WR: door/);
  assert.match(out, /floor_turn = 180 {3}ask: The rigger/);
  assert.match(checkLayout(BLEND).lines.join('\n'), /blend bands: L∩R x 1728–1920/);
  assert.match(checkLayout(STACK).lines.join('\n'), /stacked: S \(S1 \+ S2\)/);
  const broken = checkLayout({ ...clone(LED), art: { w: 10, h: 10 } });
  assert.equal(broken.ok, false);
  assert.match(broken.lines.join('\n'), /error: segments\[0\]/);
});

test('align: the two JSON schemas name both formats, require what validateLayout requires, and stay open at the top', () => {
  const s = JSON.parse(fs.readFileSync(path.join(ALIGN, 'align.schema.json'), 'utf8'));
  assert.deepEqual(s.properties.format.enum, ['open-audiovisual/align@1', 'art-align/v1']);
  assert.deepEqual(s.required, ['id', 'art', 'segments', 'outputs', 'feeds']);
  assert.notEqual(s.additionalProperties, false, 'a layout may carry keys of its own');
  for (const id of IDS) for (const k of s.required) assert.ok(k in loadLayout(id), `${id} has ${k}`);
  const c = JSON.parse(fs.readFileSync(path.join(ALIGN, 'align-calibration.schema.json'), 'utf8'));
  assert.deepEqual(c.properties.format.enum, ['open-audiovisual/align-calibration@1', 'art-align-cal/v1']);
  assert.deepEqual(Object.keys(c.$defs.zone.properties), ['corners', 'mesh', 'feather', 'gamma', 'gain', 'masks']);
  const z = A.defaultZone({ dst: { x: 0, y: 0, w: 10, h: 10 } });
  assert.deepEqual(Object.keys(z), Object.keys(c.$defs.zone.properties), 'a zone has what the schema says');
});

// ---------------------------------------------------------------- nothing private in public
test('align: no client, venue, exhibition, vendor or private project name in the package, its tests, its chapter or its example', () => {
  const files = [];
  const walk = (dir) => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.isDirectory()) walk(p); else if (/\.(js|mjs|cjs|json|md|html)$/.test(e.name)) files.push(p); } };
  walk(ALIGN);
  for (const rel of ['docs/align.md', 'docs/zh/align.md', 'tools/check-align-layout.mjs', 'tests/_align.js']) if (fs.existsSync(path.join(ROOT, rel))) files.push(path.join(ROOT, rel));
  for (const f of fs.readdirSync(path.join(ROOT, 'tests'))) if (/^align.*\.test\.js$/.test(f)) files.push(path.join(ROOT, 'tests', f));
  if (fs.existsSync(path.join(ROOT, 'examples/31-align'))) walk(path.join(ROOT, 'examples/31-align'));
  const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'examples/catalog.json'), 'utf8')).examples.find((e) => e.id === '31-align');
  const hits = [];
  for (const f of files) for (const [w, line] of forbiddenIn(fs.readFileSync(f, 'utf8'))) hits.push(`${path.relative(ROOT, f)}:${line}: ${w.length} characters`);
  if (catalog) for (const [w] of forbiddenIn(JSON.stringify(catalog))) hits.push(`examples/catalog.json (31-align): ${w.length} characters`);
  assert.ok(files.length > 20, `${files.length} files`);
  assert.deepEqual(hits, [], 'say where, not the word: the word itself must not be printed into a public log either');
});
