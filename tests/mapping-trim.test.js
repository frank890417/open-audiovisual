// Mapper 的相對模式與接管／放開（G2）：
//   mode 'trim'    旋鈕疊加在時間軸「當下的值」上，而不是取代它
//   mode 'pickup'  旋鈕要先「碰到」參數現在的值才接管（不會一轉就跳）
//   release        訊號靜止這麼多秒後放手，時間軸接回去
//   還有兩個老毛病：平滑從 def 起跳（該從時間軸當下的值）、平滑 route 每幀重新 override（✕ 無效）。
// 時間軸的值由 Mapper 的 `base` 提供（createShow 之外就是自己給的函式）。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Signals } from '../packages/core/src/signals.js';
import { Params } from '../packages/core/src/params.js';
import { Mapper, serializeMap, parseMap } from '../packages/mapping/index.js';
import { approach } from '../packages/chop/index.js';

globalThis.performance ??= { now: () => Date.now() };

const close = (a, b, eps = 1e-9, what = '') => assert.ok(Math.abs(a - b) <= eps, `${what} 應為 ${b}，實得 ${a}`);

/** bloom 0..100 (def 10)，hue 0..360。`axis` 是「時間軸現在的值」，測試裡直接改它。 */
function rig({ axis = { bloom: 40 }, withBase = true } = {}) {
  const signals = new Signals();
  const params = new Params([{ key: 'bloom', min: 0, max: 100, def: 10 }, { key: 'hue', min: 0, max: 360, def: 0 }]);
  const mapper = new Mapper(withBase ? { signals, params, base: () => axis } : { signals, params });
  const out = (key = 'bloom') => params.resolve(axis)[key];                        // 這一幀世界實際看到的值
  const frames = (seconds, dt = 0.05) => { for (let n = Math.round(seconds / dt); n > 0; n--) mapper.update(dt); };
  return { signals, params, mapper, axis, out, frames };
}

// ───────────── trim：疊加，不是取代 ─────────────

test('trim: the knob adds to the time axis instead of replacing it', () => {
  const { signals, mapper, axis, out } = rig();
  mapper.addRoute({ source: 'k', target: 'bloom', mode: 'trim', outMin: -20, outMax: 20 });
  signals.set('k', 0.5); close(out(), 40, 1e-9, '旋鈕在中間＝不動');
  signals.set('k', 1); close(out(), 60);
  signals.set('k', 0); close(out(), 20);
  axis.bloom = 70; mapper.update(0.016);                       // 時間軸往前走，疊加的量跟著走
  close(out(), 50, 1e-9, '70 − 20');
  axis.bloom = 95; signals.set('k', 1);
  close(out(), 100, 1e-9, '95 + 20 夾在參數範圍內');
});

test('trim: with no outMin/outMax the knob spans half the param range each way, centre is "no change"', () => {
  const { signals, mapper, out } = rig();
  const r = mapper.addRoute({ source: 'k', target: 'bloom', mode: 'trim' });
  assert.equal(r.outMin, -50);
  assert.equal(r.outMax, 50);
  signals.set('k', 0.5); close(out(), 40);
  signals.set('k', 1); close(out(), 90);
  const plain = mapper.addRoute({ source: 'j', target: 'hue' });
  assert.equal(plain.outMax, 360, '取代模式的預設範圍不變：參數的 min..max');
});

test('trim: without a time axis it trims around the param default', () => {
  const { signals, mapper, out } = rig({ withBase: false });
  mapper.addRoute({ source: 'k', target: 'bloom', mode: 'trim' });
  signals.set('k', 1);
  close(out(), 60, 1e-9, 'def 10 + 50');
});

test('trim: two trim routes on one param add (a coarse and a fine knob)', () => {
  const { signals, mapper, out } = rig();
  mapper.addRoute({ source: 'coarse', target: 'bloom', mode: 'trim', outMin: -20, outMax: 20 });
  mapper.addRoute({ source: 'fine', target: 'bloom', mode: 'trim', outMin: -5, outMax: 5 });
  signals.set('coarse', 1); signals.set('fine', 1);
  close(out(), 65);
  signals.set('fine', 0.5);
  close(out(), 60);
});

test('trim: a smoothed trim glides the OFFSET from zero (never from the param default or a jump)', () => {
  const { signals, params, mapper } = rig();
  mapper.addRoute({ source: 'k', target: 'bloom', mode: 'trim', outMin: -20, outMax: 20, smooth: 0.5 });
  signals.set('k', 1);
  mapper.update(0.1);
  close(params.overrides.bloom, 40 + approach(0, 20, 0.5, 0.1), 1e-9, '第一幀');
  mapper.update(0.1);
  close(params.overrides.bloom, 40 + approach(approach(0, 20, 0.5, 0.1), 20, 0.5, 0.1), 1e-9, '第二幀');
});

test('trim: ✕ hands the param back to the time axis, and it stays back until the knob moves again', () => {
  const { signals, params, mapper, axis, out, frames } = rig();
  mapper.addRoute({ source: 'k', target: 'bloom', mode: 'trim', outMin: -20, outMax: 20 });
  signals.set('k', 1);
  assert.equal(params.isOverridden('bloom'), true);
  params.clearOverride('bloom');                               // 主控台的 ✕
  frames(0.5);
  assert.equal(params.isOverridden('bloom'), false, '下一幀不能又被蓋回去');
  close(out(), 40);
  axis.bloom = 45; frames(0.2);
  close(out(), 45, 1e-9, '時間軸接手');
  signals.set('k', 0.9);                                       // 旋鈕又動了：重新疊加
  close(out(), 45 + 16);
});

test('trim: muting or removing a trim route gives the param back at once', () => {
  const { signals, params, mapper, out, frames } = rig();
  const r = mapper.addRoute({ source: 'k', target: 'bloom', mode: 'trim', outMin: -20, outMax: 20 });
  signals.set('k', 1); close(out(), 60);
  r.enabled = false; frames(0.1);
  assert.equal(params.isOverridden('bloom'), false);
  close(out(), 40);
  r.enabled = true; signals.set('k', 1); close(out(), 60);
  mapper.removeRoute(r.id);
  assert.equal(params.isOverridden('bloom'), false, '移除一條還在疊加的 route');
  close(out(), 40);
});

test('trim on top of an override route on the same param: the override sets the base, the trim goes on it', () => {
  const { signals, mapper, axis, out, frames } = rig();
  mapper.addRoute({ source: 'knob', target: 'bloom' });
  mapper.addRoute({ source: 'fine', target: 'bloom', mode: 'trim', outMin: -10, outMax: 10 });
  signals.set('knob', 0.5); close(out(), 50);
  signals.set('fine', 1); close(out(), 60);
  axis.bloom = 90; frames(0.2);
  close(out(), 60, 1e-9, '被旋鈕接管了，時間軸不管');
  signals.set('knob', 0.2); close(out(), 30);
});

test('a base that throws or answers nonsense counts as "no time axis" and never stops the show', () => {
  for (const base of [() => { throw new Error('boom'); }, () => null, () => 'x', () => ({ bloom: NaN })]) {
    const signals = new Signals(), params = new Params([{ key: 'bloom', min: 0, max: 100, def: 10 }]);
    const mapper = new Mapper({ signals, params, base });
    mapper.addRoute({ source: 'k', target: 'bloom', mode: 'trim' });
    assert.doesNotThrow(() => { signals.set('k', 1); mapper.update(0.016); });
    close(params.resolve({}).bloom, 60);
  }
});

// ───────────── pickup：先碰到再接管 ─────────────

test('pickup: the knob does not take the param until it meets the value, then it follows', () => {
  const { signals, params, mapper, out } = rig();
  mapper.addRoute({ source: 'k', target: 'bloom', mode: 'pickup' });
  for (const k of [0.9, 0.7, 0.5]) { signals.set('k', k); close(out(), 40, 1e-9, `旋鈕 ${k} 還沒碰到`); }
  assert.equal(params.isOverridden('bloom'), false);
  signals.set('k', 0.41);                                      // 離 40 不到範圍的 2%：碰到了
  close(out(), 41);
  signals.set('k', 0.1); close(out(), 10);
  signals.set('k', 0.8); close(out(), 80);
});

test('pickup: a knob that jumps over the value is caught on the way', () => {
  const { signals, mapper, out } = rig();
  mapper.addRoute({ source: 'k', target: 'bloom', mode: 'pickup' });
  signals.set('k', 0.9); close(out(), 40);
  signals.set('k', 0.1);                                       // 一步越過 40
  close(out(), 10);
});

test('pickup: with smoothing the first caught reading glides from where the param was', () => {
  const { signals, params, mapper } = rig();
  mapper.addRoute({ source: 'k', target: 'bloom', mode: 'pickup', smooth: 0.5 });
  signals.set('k', 0.9); signals.set('k', 0.1);                // 越過，接管，目標 10
  mapper.update(0.1);
  close(params.overrides.bloom, approach(40, 10, 0.5, 0.1), 1e-9, '從 40 滑向 10，不是跳');
});

// ───────────── release：放手後回到時間軸 ─────────────

test('release: when the knob has stood still for `release` seconds the time axis plays again', () => {
  const { signals, params, mapper, axis, out, frames } = rig();
  mapper.addRoute({ source: 'k', target: 'bloom', release: 2 });
  signals.set('k', 0.8); close(out(), 80);
  frames(1.5);
  assert.equal(params.isOverridden('bloom'), true, '還沒到');
  signals.set('k', 0.8);                                       // 同一個值再送一次：不算動
  frames(0.6);
  assert.equal(params.isOverridden('bloom'), false, '靜止超過 2 秒：放手');
  close(out(), 40);
  axis.bloom = 55; frames(0.1);
  close(out(), 55, 1e-9, '時間軸接手');
});

test('release: moving the knob restarts the clock', () => {
  const { signals, params, mapper, frames } = rig();
  mapper.addRoute({ source: 'k', target: 'bloom', release: 2 });
  signals.set('k', 0.8); frames(1.5);
  signals.set('k', 0.7); frames(1.5);
  assert.equal(params.isOverridden('bloom'), true, '動過，從頭算');
  frames(0.8);
  assert.equal(params.isOverridden('bloom'), false);
});

test('release with smoothing fades the param back over ~3× smooth seconds instead of jumping', () => {
  const { signals, params, mapper, out, frames } = rig();
  mapper.addRoute({ source: 'k', target: 'bloom', release: 2, smooth: 0.2 });
  signals.set('k', 1); frames(1.6);
  close(out(), 100, 1e-6, '已經滑到');
  frames(0.6);                                                 // 約 2.2 s：放手已開始，淡出約 0.2 s
  const mid = out();
  assert.ok(mid < 100 && mid > 40, `淡出中，實得 ${mid}`);
  assert.equal(params.isOverridden('bloom'), true);
  frames(0.2);
  assert.ok(out() < mid, '一路往時間軸走');
  frames(1);
  assert.equal(params.isOverridden('bloom'), false, '淡完就清掉覆寫');
  close(out(), 40);
});

test('release: a source that keeps repeating the same value does not take the param back; moving it does', () => {
  const { signals, params, mapper, out, frames } = rig();
  mapper.addRoute({ source: 'k', target: 'bloom', release: 1 });
  signals.set('k', 0.8); frames(1.2);
  assert.equal(params.isOverridden('bloom'), false, '放手了');
  for (let i = 0; i < 8; i++) { signals.set('k', 0.8); mapper.update(0.05); }       // 一直重送 0.8（沒在動），0.4 秒，短於 release
  assert.equal(params.isOverridden('bloom'), false, '同一個值重送不算「又動了」');
  signals.set('k', 0.6);
  close(out(), 60, 1e-9, '真的動了才再接管');
});

test('release: a slow drift still counts as movement (it is measured from where the knob last counted as moved)', () => {
  const { signals, params, mapper } = rig();
  mapper.addRoute({ source: 'k', target: 'bloom', release: 1 });
  for (let i = 0; i < 300; i++) { signals.set('k', 0.2 + i * 0.0004); mapper.update(0.01); }     // 每步 0.04%，三秒共 12%
  assert.equal(params.isOverridden('bloom'), true, '手還在慢慢轉，不放手');
});

test('release only gives back what the route itself wrote: a slider that took over meanwhile is left alone', () => {
  const { signals, params, mapper, frames } = rig();
  mapper.addRoute({ source: 'k', target: 'bloom', release: 1 });
  signals.set('k', 0.8);
  params.override('bloom', 5);                                 // 滑桿接手
  frames(3);
  assert.equal(params.overrides.bloom, 5);
});

test('a time axis given after construction (mapper.base = fn) is used from then on', () => {
  const signals = new Signals(), params = new Params([{ key: 'bloom', min: 0, max: 100, def: 10 }]);
  const mapper = new Mapper({ signals, params });
  mapper.addRoute({ source: 'k', target: 'bloom', mode: 'trim', outMin: -10, outMax: 10 });
  signals.set('k', 1); close(params.overrides.bloom, 20, 1e-9, '還沒有時間軸：以 def 為準');
  mapper.base = () => ({ bloom: 70 });
  mapper.update(0.016);
  close(params.overrides.bloom, 80);
});

test('replacing or clearing the routes hands back what a trim was holding', () => {
  for (const how of ['clear', 'fromJSON', 'importMap']) {
    const { signals, params, mapper } = rig();
    mapper.addRoute({ source: 'k', target: 'bloom', mode: 'trim', outMin: -20, outMax: 20 });
    signals.set('k', 1);
    assert.equal(params.isOverridden('bloom'), true, how);
    if (how === 'clear') mapper.clear();
    else if (how === 'fromJSON') mapper.fromJSON([]);
    else mapper.importMap(serializeMap([{ source: 'x', target: 'hue' }]));
    assert.equal(params.isOverridden('bloom'), false, `${how}: 偏移收掉，不留在最後一個 base＋偏移上`);
  }
});

test('trim + release: the offset fades back to zero and the param is the time axis again', () => {
  const { signals, params, mapper, out, frames } = rig();
  mapper.addRoute({ source: 'k', target: 'bloom', mode: 'trim', outMin: -20, outMax: 20, release: 1, smooth: 0.1 });
  signals.set('k', 1); frames(0.9);
  close(out(), 60, 0.2, '疊加中');
  frames(1.5);
  assert.equal(params.isOverridden('bloom'), false);
  close(out(), 40);
});

test('pickup + release: after letting go the knob has to meet the time axis again', () => {
  const { signals, params, mapper, out, frames } = rig();
  mapper.addRoute({ source: 'k', target: 'bloom', mode: 'pickup', release: 1 });
  signals.set('k', 0.41); close(out(), 41);
  frames(1.2);
  assert.equal(params.isOverridden('bloom'), false, '放手了');
  signals.set('k', 0.9); close(out(), 40, 1e-9, '旋鈕還在遠處：不接管');
  signals.set('k', 0.2); close(out(), 20, 1e-9, '越過 40：重新接管');
});

// ───────────── 平滑的起點 ─────────────

test('smooth: the glide starts from the time axis value, not from the param default', () => {
  const { signals, params, mapper } = rig();                   // 時間軸 40，def 10
  mapper.addRoute({ source: 'k', target: 'bloom', smooth: 0.5 });
  signals.set('k', 1);
  mapper.update(0.1);
  close(params.overrides.bloom, approach(40, 100, 0.5, 0.1), 1e-9, '第一幀從 40 起跳');
});

test('smooth: a value already overridden by hand is still the start; with no time axis, def is', () => {
  const a = rig();
  a.mapper.addRoute({ source: 'k', target: 'bloom', smooth: 0.5 });
  a.params.override('bloom', 70);
  a.signals.set('k', 1); a.mapper.update(0.1);
  close(a.params.overrides.bloom, approach(70, 100, 0.5, 0.1));
  const b = rig({ withBase: false });
  b.mapper.addRoute({ source: 'k', target: 'bloom', smooth: 0.5 });
  b.signals.set('k', 1); b.mapper.update(0.1);
  close(b.params.overrides.bloom, approach(10, 100, 0.5, 0.1));
});

test('smooth: grabbing the param again after it was given back starts from the time axis again', () => {
  const { signals, params, mapper, axis, frames } = rig();
  mapper.addRoute({ source: 'k', target: 'bloom', smooth: 0.1 });
  signals.set('k', 1); frames(2);
  params.clearOverride('bloom');
  axis.bloom = 25; frames(0.1);
  signals.set('k', 0.6); mapper.update(0.05);
  close(params.overrides.bloom, approach(25, 60, 0.1, 0.05), 1e-9, '從 25 起跳，不是 100');
});

// ───────────── 平滑 route 不再每幀重新 override ─────────────

test('smooth: a settled route stops writing — ✕ gives the param back and it stays back', () => {
  const { signals, params, mapper, out, frames } = rig();
  mapper.addRoute({ source: 'k', target: 'bloom', smooth: 0.1 });
  signals.set('k', 1); frames(2);
  close(params.overrides.bloom, 100, 1e-6);
  params.clearOverride('bloom');                               // ✕
  frames(0.5);
  assert.equal(params.isOverridden('bloom'), false, '舊版：下一幀就被蓋回 100');
  close(out(), 40);
});

test('smooth: ✕ in the middle of a glide stops the glide', () => {
  const { signals, params, mapper, frames } = rig();
  mapper.addRoute({ source: 'k', target: 'bloom', smooth: 1 });
  signals.set('k', 1); mapper.update(0.1);
  assert.equal(params.isOverridden('bloom'), true);
  params.clearOverride('bloom');
  frames(0.5);
  assert.equal(params.isOverridden('bloom'), false);
});

test('smooth: a slider dragged by hand is not fought by a route that already arrived', () => {
  const { signals, params, mapper, frames } = rig();
  mapper.addRoute({ source: 'k', target: 'bloom', smooth: 0.1 });
  signals.set('k', 1); frames(2);
  params.override('bloom', 5);                                 // 主控台的滑桿
  frames(0.5);
  assert.equal(params.overrides.bloom, 5);
  signals.set('k', 0.5); frames(2);                            // 旋鈕再動：旋鈕又接手
  close(params.overrides.bloom, 50, 1e-3);
});

test('smooth: a route that has already arrived does not outvote a newer move of another knob', () => {
  const { signals, params, mapper, frames } = rig();
  mapper.addRoute({ source: 'a', target: 'bloom', smooth: 0.1 });
  mapper.addRoute({ source: 'b', target: 'bloom', smooth: 0.1 });
  signals.set('b', 0.8); frames(2);
  close(params.overrides.bloom, 80);
  signals.set('a', 0.2); frames(2);                            // a 後來才動；b 早就到了，不能每幀再把 80 蓋回去
  close(params.overrides.bloom, 20, 1e-3);
});

test('smooth: two smoothed routes streaming into one param do not cancel each other', () => {
  const { signals, params, mapper } = rig();
  mapper.addRoute({ source: 'a', target: 'bloom', smooth: 0.1 });
  mapper.addRoute({ source: 'b', target: 'bloom', smooth: 0.1 });
  for (let i = 0; i < 100; i++) { signals.set('a', 0.2 + 0.001 * i); signals.set('b', 0.8); mapper.update(0.016); }
  assert.equal(params.isOverridden('bloom'), true, '兩個來源都還在動：誰都沒被當成外人');
  close(params.overrides.bloom, 80, 1, '後面那條贏（和以前一樣）');
});

// ───────────── 取代模式不變 ─────────────

test('override mode (the default) behaves as before: immediate write, last signal wins, mute keeps the value, never lets go', () => {
  const { signals, params, mapper, out, frames } = rig();
  const a = mapper.addRoute({ source: 's1', target: 'bloom' });
  mapper.addRoute({ source: 's2', target: 'bloom' });
  assert.equal('mode' in a, false, '預設的 route 不多出欄位');
  assert.equal('release' in a, false);
  signals.set('s1', 1); close(out(), 100);
  signals.set('s2', 0.25); close(out(), 25);
  a.enabled = false; signals.set('s1', 0.9); close(out(), 25, 1e-9, '靜音的 route 不寫');
  frames(120);
  assert.equal(params.isOverridden('bloom'), true, '沒有 release：兩分鐘後還在');
  close(out(), 25);
});

test('toJSON never leaks the runtime state of a route that is mid-glide', () => {
  const { signals, mapper } = rig();
  mapper.addRoute({ source: 'k', target: 'bloom', mode: 'pickup', smooth: 0.3, release: 2 });
  signals.set('k', 0.9); signals.set('k', 0.1); mapper.update(0.1);
  const json = mapper.toJSON();
  assert.deepEqual(Object.keys(json[0]).filter((k) => k.startsWith('_')), []);
  assert.equal(json[0].mode, 'pickup');
  assert.equal(json[0].release, 2);
  assert.doesNotThrow(() => JSON.stringify(json));
});

// ───────────── 地圖檔帶 mode / release ─────────────

test('map file: mode and release travel with the route; a default route writes neither', () => {
  const a = rig();
  a.mapper.addRoute({ source: 'k', target: 'bloom', mode: 'trim', outMin: -20, outMax: 20, release: 3, smooth: 0.1 });
  a.mapper.addRoute({ source: 'j', target: 'hue' });
  a.mapper.addRoute({ source: 'p', target: 'bloom', mode: 'pickup' });
  const file = JSON.parse(JSON.stringify(a.mapper.exportMap()));
  assert.equal(file.routes[0].mode, 'trim');
  assert.equal(file.routes[0].release, 3);
  assert.deepEqual(Object.keys(file.routes[1]).sort(), ['curve', 'invert', 'param', 'range', 'signal', 'smooth']);
  assert.equal(file.routes[2].mode, 'pickup');
  assert.equal('release' in file.routes[2], false);

  const b = rig();
  b.signals.define('k'); b.signals.define('j'); b.signals.define('p');
  const rep = b.mapper.importMap(file);
  assert.equal(rep.added, 3);
  assert.equal(b.mapper.routes[0].mode, 'trim');
  assert.equal(b.mapper.routes[0].release, 3);
  assert.equal(b.mapper.routes[0].outMin, -20);
  assert.equal('mode' in b.mapper.routes[1], false);
  b.signals.set('k', 1); b.frames(1);                          // smooth 0.1：滑 1 秒就到
  close(b.out(), 60, 0.01, '匯入的 trim 照樣疊加');
});

test('map file: a trim route imported from another world keeps its mode and takes this world\'s own offset range', () => {
  const { mapper } = rig();
  mapper.importMap({ format: 'openav.map', version: 1, world: 'elsewhere', routes: [
    { signal: 'midi/cc/1', param: 'bloom', mode: 'trim', range: { in: [0, 1], out: [-3, 3] } }] });
  assert.equal(mapper.routes[0].mode, 'trim');
  assert.equal(mapper.routes[0].outMin, -50);
  assert.equal(mapper.routes[0].outMax, 50);
});

test('map file: an unknown mode or a nonsense release is cleaned, never trusted', () => {
  const p = parseMap({ format: 'openav.map', version: 1, routes: [
    { signal: 'a', param: 'b', mode: 'constructor', release: -4 },
    { signal: 'a', param: 'c', mode: 'override', release: 'soon' },
    { signal: 'a', param: 'd', mode: 'trim', release: 1e9 },
  ] });
  assert.equal(p.routes.length, 3);
  assert.equal('mode' in p.routes[0], false);
  assert.equal('release' in p.routes[0], false);
  assert.equal('mode' in p.routes[1], false, '"override" 是預設，不必寫');
  assert.equal(p.routes[2].mode, 'trim');
  assert.equal(p.routes[2].release, 600, '上限 600 秒');
  const f = serializeMap([{ source: 'a', target: 'b', mode: 'weird', release: 0 }]);
  assert.equal('mode' in f.routes[0], false);
  assert.equal('release' in f.routes[0], false);
});
