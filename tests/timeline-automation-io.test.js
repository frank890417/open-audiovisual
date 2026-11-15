// @openav/timeline · automation 的匯出／匯入（JSON）與「絕對秒 ↔ (段落 id, p)」換算。
//
// record() 錄下的關鍵點在記憶體裡、是 root cut 的絕對秒。exportAutomation() 把它寫成可以存檔的 JSON（秒，或以段落為單位的 lane），
// importAutomation() 讀回來；lanePos / laneTime 是底下那組換算，compileLane / decompileLane 是同一組換算的純函式版。
// 固定資料同 timeline-lanes.test.js：兩個結構不同的 root cut（long、brief）與一個從 long 衍生的 half，虛構的。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Score } from '../packages/score/index.js';
import * as TL from '../packages/timeline/index.js';

const { Timeline, CURVES, compileLane, decompileLane, lanePos, laneTime, isLane, AUTOMATION_FORMAT } = TL;   // 名稱缺了就在用到的那條測試單獨紅，不是整份檔案 import 失敗

const near = (a, b, e = 1e-9) => assert.ok(Math.abs(a - b) <= e, `${a} ≉ ${b}`);
const P = [{ key: 'lvl', min: 0, max: 1, def: 0.5 }, { key: 'mode', min: 0, max: 3, def: 0, step: 1 }];
const CUTS = [
  { id: 'long', segments: [{ id: 'intro', dur: 10 }, { id: 'rise', dur: 60 }, { id: 'peak', dur: 30 }, { id: 'coda', dur: 20 }] },
  { id: 'brief', segments: [{ id: 'intro', dur: 4 }, { id: 'rise', dur: 12 }, { id: 'peak', dur: 8 }] },
  { id: 'half', from: 'long', scale: 0.5 },
];
const score = (cut) => new Score({ cuts: CUTS, cut });
const tl = (cut, automation, extra = {}) => new Timeline({ params: P, score: score(cut), automation, ...extra });
const LANES = {
  lvl: {
    intro: [[0, 0.2]],
    rise: [[0, 0.2], [1, 0.8, 'ease']],
    peak: [[0, 0.8], [1, 0.8]],
    coda: [[0, 0.8], [1, 0.1, 'out']],
  },
};

// ───────────── G10 · 換算 ─────────────

const PLAN = [{ id: 'a', start: 0, end: 10, dur: 10 }, { id: 'b', start: 10, end: 40, dur: 30 }, { id: 'c', start: 40, end: 60, dur: 20 }];

test('lanePos / laneTime: seconds ↔ (segment id, p); a boundary belongs to the segment that starts there; the end of the show is p=1 of the last', () => {
  assert.deepEqual(lanePos(PLAN, 25), { id: 'b', index: 1, p: 0.5 });
  assert.deepEqual(lanePos(PLAN, 10), { id: 'b', index: 1, p: 0 });
  assert.deepEqual(lanePos(PLAN, 0), { id: 'a', index: 0, p: 0 });
  assert.deepEqual(lanePos(PLAN, 60), { id: 'c', index: 2, p: 1 });
  assert.equal(lanePos(PLAN, -1), null, 'outside the show there is no (segment, p)');
  assert.equal(lanePos(PLAN, 61), null);
  assert.equal(laneTime(PLAN, 'b', 0.5), 25);
  assert.equal(laneTime(PLAN, 'c', 1), 60);
  assert.equal(laneTime(PLAN, 'b'), 10, 'p defaults to 0');
  assert.ok(Number.isNaN(laneTime(PLAN, 'zz', 0.5)));
  for (const t of [0, 0.7, 9.999, 10, 33.3, 59.99, 60]) { const q = lanePos(PLAN, t); near(laneTime(PLAN, q.id, q.p), t, 1e-9); }
});

test('timeline.lanePos / laneTime work in the automation\'s seconds (the root cut\'s), even on a derived cut', () => {
  const half = tl('half', LANES);
  assert.deepEqual(half.lanePos(40), { id: 'rise', index: 1, p: 0.5 });          // root seconds: rise = 10 … 70
  near(half.laneTime('rise', 0.5), 40);
  assert.deepEqual(half.lanePlan().map((s) => s.id), ['intro', 'rise', 'peak', 'coda']);
  near(half.lanePlan()[1].dur, 60);
});

test('compileLane / decompileLane: a lane survives the trip to keyframes and back unchanged', () => {
  const lane = { a: [[0, 0.1], [0.5, 0.4, 'in'], [1, 0.9]], b: [[0, 0.9], [1, 0.2, 'ease']], c: [[0, 0.2]] };
  const kf = compileLane(PLAN, lane, { key: 'x' });
  assert.deepEqual(kf, [[0, 0.1], [5, 0.4, 'in'], [10, 0.9], [10, 0.9], [40, 0.2, 'ease'], [40, 0.2]]);
  assert.deepEqual(decompileLane(PLAN, kf, { key: 'x' }), lane);
});

test('decompileLane: a jump is kept as a pair at the boundary (end of one segment, start of the next)', () => {
  const kf = [[0, 0], [10, 0.3], [10, 0.7], [40, 0.7]];
  assert.deepEqual(decompileLane(PLAN, kf), { a: [[0, 0], [1, 0.3]], b: [[0, 0.7]], c: [[0, 0.7]] });
  assert.deepEqual(compileLane(PLAN, decompileLane(PLAN, kf)).slice(0, 4), kf);
});

test('decompileLane: a keyframe outside the show cannot be a (segment, p) and says so', () => {
  assert.throws(() => decompileLane(PLAN, [[0, 0], [61, 1]], { key: 'x' }), /x.*61/);
  assert.throws(() => decompileLane(PLAN, [[-3, 0]], { key: 'x' }), /x.*-3/);
});

test('isLane: an object is a lane, an array is keyframes', () => {
  assert.equal(isLane({ a: [[0, 0]] }), true);
  assert.equal(isLane([[0, 0]]), false);
  assert.equal(isLane(null), false);
});

// ───────────── G10 · 匯出／匯入 ─────────────

const grid = (tl2, key, n = 400) => Array.from({ length: n + 1 }, (_, i) => tl2.valueAt(key, (tl2.total * i) / n));

test('exportAutomation(): plain JSON in the automation\'s seconds, with a header that says what it is and which cut it was written against', () => {
  const t = tl('half', { lvl: [[0, 0], [60, 1, 'ease']] });
  const doc = t.exportAutomation();
  assert.equal(doc.format, AUTOMATION_FORMAT);
  assert.equal(doc.version, 1);
  assert.equal(doc.cut, 'long', 'the root cut, not the derived one');
  assert.equal(doc.as, 'seconds');
  assert.deepEqual(doc.automation, { lvl: [[0, 0], [60, 1, 'ease']] });
  assert.deepEqual(JSON.parse(JSON.stringify(doc)), doc, 'survives JSON');
  doc.automation.lvl[0][1] = 99;
  assert.equal(t.automation.lvl[0][1], 0, 'a copy, not the live keyframes');
});

test('exportAutomation({ keys }) picks keys; a curve function cannot be written to JSON and says which keyframe', () => {
  const t = tl('long', { lvl: [[0, 0], [60, 1]], mode: [[0, 0], [60, 3]] });
  assert.deepEqual(Object.keys(t.exportAutomation({ keys: ['mode'] }).automation), ['mode']);
  const f = tl('long', { lvl: [[0, 0], [60, 1, (x) => x]] });
  assert.throws(() => f.exportAutomation(), /lvl.*\[1\].*function|function.*lvl.*\[1\]/);
});

test('export → JSON → import into a fresh timeline gives the same curve everywhere (seconds)', () => {
  const src = tl('long', { lvl: [[0, 0.1], [20, 0.9, 'ease'], [50, 0.3, 'in'], [80, 0.6, 'step'], [120, 0.2, 'out']], mode: [[0, 0], [60, 3]] });
  const file = JSON.stringify(src.exportAutomation());
  const dst = tl('long', {});
  assert.deepEqual(dst.importAutomation(file).sort(), ['lvl', 'mode']);
  for (const key of ['lvl', 'mode']) assert.deepEqual(grid(dst, key), grid(src, key));
});

test('export as segments: the lanes recompile to the same curve (also with curves cut by a segment boundary)', () => {
  const src = tl('long', { lvl: [[0, 0.1], [35, 0.9, 'ease'], [90, 0.3, 'in'], [120, 0.6, 'out']] });
  const doc = src.exportAutomation({ as: 'segments' });
  assert.equal(doc.as, 'segments');
  assert.ok(isLane(doc.automation.lvl) && Object.keys(doc.automation.lvl).every((id) => ['intro', 'rise', 'peak', 'coda'].includes(id)));
  const dst = tl('long', {});
  dst.importAutomation(JSON.parse(JSON.stringify(doc)));
  assert.equal(dst.automation.lvl.length, src.automation.lvl.length);
  dst.automation.lvl.forEach((k, i) => { near(k[0], src.automation.lvl[i][0], 1e-6); near(k[1], src.automation.lvl[i][1], 1e-9); assert.equal(k[2], src.automation.lvl[i][2]); });
  const a = grid(src, 'lvl'), b = grid(dst, 'lvl');
  a.forEach((v, i) => near(v, b[i], 1e-6));
});

test('lanes written on one cut are read on another: export as segments from long, import into brief and half', () => {
  const src = tl('long', LANES);
  const doc = src.exportAutomation({ as: 'segments' });
  for (const cut of ['brief', 'half']) {
    const dst = tl(cut, {});
    dst.importAutomation(doc);
    for (const p of [0, 0.25, 0.5, 0.9]) near(dst.valueAt('lvl', dst.score.timeAt('rise', p)), 0.2 + 0.6 * CURVES.ease(p), 1e-5);
  }
});

test('record → export as segments → import: a take played in by hand comes back as data', () => {
  const t = tl('long', { lvl: [[0, 0.5], [120, 0.5]] });
  let v = 0.2;
  t.record('lvl', () => (t.t >= 5 && t.t < 75 ? (v += 0.01) : null), { epsilon: 0 });   // 一段跨越 intro / rise 邊界的演奏
  t.play(); for (let i = 0; i < 160; i++) t.advance(0.5);
  t.stopRecording();
  const doc = t.exportAutomation({ as: 'segments' });
  const dst = tl('long', {});
  dst.importAutomation(doc);
  for (let s = 0; s <= 120; s += 0.25) near(dst.valueAt('lvl', s), t.valueAt('lvl', s), 1e-4);
});

test('importAutomation: a string, a bare { key: keyframes } map and a lane map all work; keys not named stay; replace: true clears them', () => {
  const t = tl('long', { lvl: [[0, 0], [60, 1]], mode: [[0, 0], [60, 3]] });
  t.importAutomation(JSON.stringify({ lvl: [[0, 1], [60, 0]] }));
  assert.equal(t.valueAt('lvl', 0), 1);
  assert.equal(t.valueAt('mode', 60), 3, 'mode was not in the file: it stays');
  t.importAutomation({ lvl: { rise: [[0, 0.5], [1, 0.5]] } });
  near(t.valueAt('lvl', 40), 0.5);
  t.importAutomation({ lvl: [[0, 0.25]] }, { replace: true });
  assert.equal(t.automation.mode, undefined, 'replace: true drops what the file does not mention');
  assert.equal(t.valueAt('mode', 60), 0, 'back to the param\'s default');
  t.importAutomation({ lvl: [[0, 0.1]], mode: [[0, 2]] }, { keys: ['mode'] });
  assert.equal(t.valueAt('mode', 5), 2); near(t.valueAt('lvl', 5), 0.25);
});

test('importAutomation refuses what it cannot trust: another format, a newer version, bad keyframes, seconds from another cut', () => {
  const t = tl('long', {});
  assert.throws(() => t.importAutomation({ format: 'something-else', automation: {} }), /format/);
  assert.throws(() => t.importAutomation({ format: AUTOMATION_FORMAT, version: 99, automation: {} }), /version/);
  assert.throws(() => t.importAutomation('{ not json'), /JSON/i);
  assert.throws(() => t.importAutomation({ lvl: [[0, 0], [10, NaN]] }), /lvl.*\[1\]/);
  assert.throws(() => t.importAutomation({ lvl: [[0, 0], ['x', 1]] }), /lvl.*\[1\]/);
  const brief = tl('brief', { lvl: [[0, 0], [24, 1]] });
  const doc = brief.exportAutomation();
  assert.throws(() => t.importAutomation(doc), /brief.*long|long.*brief/);
  assert.doesNotThrow(() => t.importAutomation(doc, { ignoreCut: true }));
  assert.doesNotThrow(() => t.importAutomation(brief.exportAutomation({ as: 'segments' })), 'segments are not tied to a cut\'s seconds');
});

test('importAutomation is all-or-nothing: one bad key leaves every key as it was', () => {
  const t = tl('long', { lvl: [[0, 0], [60, 1]] });
  assert.throws(() => t.importAutomation({ lvl: [[0, 0.5]], mode: { nosuchsegment: [[0, 1]] } }), /mode.*nosuchsegment|nosuchsegment.*mode/);
  assert.deepEqual(t.automation.lvl, [[0, 0], [60, 1]]);
  assert.equal(t.automation.mode, undefined);
  t.importAutomation({ lvl: [[0, 0.5]] });                     // 對照：沒有壞鍵的同一份就進得去
  assert.deepEqual(t.automation.lvl, [[0, 0.5]]);
});

test('lanes(): the whole automation written per segment — what exportAutomation({ as: "segments" }) holds, without the wrapper', () => {
  const t = tl('long', { lvl: { intro: 0.1, rise: [[0, 0.1], [0.5, 0.9, 'in'], [1, 0.4]], peak: [[0, 0.4]], coda: [[0, 0.4], [1, 0.2, 'out']] }, mode: [[0, 0], [60, 3]] });
  const lanes = t.lanes();
  assert.deepEqual(Object.keys(lanes).sort(), ['lvl', 'mode']);
  assert.deepEqual(lanes.lvl.intro, [[0, 0.1], [1, 0.1]]);
  assert.deepEqual(lanes.lvl.rise, [[0, 0.1], [0.5, 0.9, 'in'], [1, 0.4]]);
  assert.deepEqual(t.lanes(['mode']).mode.intro, [[0, 0]]);
  assert.deepEqual(t.exportAutomation({ as: 'segments' }).automation, lanes);
});

test('without a score the scenes are the segments for export too: cut is null, and a scene-based timeline round-trips', () => {
  const mk2 = (automation) => new Timeline({ params: P, total: 60, scenes: [{ id: 'a', t: 0 }, { id: 'b', t: 20 }, { id: 'c', t: 45 }], automation });
  const src = mk2({ lvl: [[0, 0.1], [30, 0.9, 'ease'], [45, 0.4], [60, 0.2, 'in']] });
  const doc = src.exportAutomation({ as: 'segments' });
  assert.equal(doc.cut, null);
  assert.deepEqual(Object.keys(doc.automation.lvl), ['a', 'b', 'c']);
  near(doc.automation.lvl.b[0][0], 0.4);                                              // 30 s 在 b（20 … 45）的 40 %
  const dst = mk2({});
  dst.importAutomation(doc);
  for (let s = 0; s <= 60; s += 0.5) near(dst.valueAt('lvl', s), src.valueAt('lvl', s), 1e-6);
});

test('decompileLane refuses a segment table where two segments share an id (a lane could not say which)', () => {
  const dup = [{ id: 'a', start: 0, end: 5 }, { id: 'a', start: 5, end: 10 }];
  assert.throws(() => decompileLane(dup, [[1, 0]], { key: 'x' }), /x.*share an id|share an id.*x/);
});

function rng(seed) { let a = seed; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

test('property: random keyframes (with jumps on the boundaries) → lane → keyframes comes back the same, and compile ∘ decompile never changes the curve', () => {
  const CURVE_NAMES = [undefined, undefined, 'ease', 'in', 'out', 'step', 'linear'];
  for (let seed = 1; seed <= 40; seed++) {
    const r = rng(seed);
    let at = r() < 0.5 ? 0 : -30 + Math.floor(r() * 10);                              // 有的演出從負的時間（開演前待命）開始
    const plan = Array.from({ length: 2 + Math.floor(r() * 6) }, (_, i) => { const dur = r() < 0.15 ? 0.001 + r() : 1 + r() * 300; const s = { id: `s${i}`, start: at, end: at + dur, dur }; at += dur; return s; });
    const kf = [];
    for (const s of plan) {
      const n = Math.floor(r() * 4);
      if (r() < 0.5) kf.push([s.start, r(), CURVE_NAMES[Math.floor(r() * CURVE_NAMES.length)]]);                 // 恰在段首
      if (r() < 0.3) kf.push([s.start, r(), undefined]);                                                          // 同一秒第二點：跳變
      for (let k = 0; k < n; k++) kf.push([s.start + (0.02 + r() * 0.96) * s.dur, r(), CURVE_NAMES[Math.floor(r() * CURVE_NAMES.length)]]);
    }
    if (r() < 0.6) kf.push([plan.at(-1).end, r(), undefined]);                                                    // 恰在整場的最後一秒
    const clean = kf.map((k) => (k[2] === undefined ? [k[0], k[1]] : k)).sort((a, b) => a[0] - b[0]);
    const lane = decompileLane(plan, clean, { key: `k${seed}` });
    for (const [id, pts] of Object.entries(lane)) {
      pts.forEach((pt, i) => { assert.ok(pt[0] >= 0 && pt[0] <= 1, `seed ${seed} ${id} p=${pt[0]}`); if (i) assert.ok(pt[0] >= pts[i - 1][0], `seed ${seed} ${id}: p goes backwards`); });
    }
    const back = compileLane(plan, lane, { key: `k${seed}` });
    assert.equal(back.length, clean.length, `seed ${seed}: same number of keyframes`);
    back.forEach((k, i) => {
      near(k[0], clean[i][0], 2e-6 * Math.max(1, ...plan.map((s) => s.dur)) / 300 + 1e-6);
      assert.equal(k[1], clean[i][1], `seed ${seed} #${i} value`);
      assert.equal(k[2], clean[i][2], `seed ${seed} #${i} curve`);
    });
  }
});
