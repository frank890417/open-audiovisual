// The backstage feed only auto-connects where a relay can actually be reached:
// an http page (localhost or the LAN). On https the browser blocks ws:// and a
// published site has no relay, so it stays quiet unless given a wss:// url.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultMonitorUrl, MonitorFeed } from '../packages/monitor/index.js';

test('http page → ws://<host>:7457', () => {
  assert.equal(defaultMonitorUrl({ protocol: 'http:', hostname: '192.168.1.20' }), 'ws://192.168.1.20:7457');
});

test('https page → no default (no mixed-content error, no relay on a public site)', () => {
  assert.equal(defaultMonitorUrl({ protocol: 'https:', hostname: 'openaudiovisual.com' }), null);
});

test('no url → connect() is a no-op; an explicit wss url is kept', () => {
  const quiet = new MonitorFeed({ url: null });
  assert.equal(quiet.url, null);
  quiet.connect();
  assert.equal(quiet.ws, null);
  assert.equal(new MonitorFeed({ url: 'wss://show.example:7457' }).url, 'wss://show.example:7457?role=stage');
});

// ───────────── the work's own numbers (extra) ─────────────
// A work can put its own health numbers into the backstage feed: snapshotOf({ …, extra }) or monitor.extra(fn).
// Without them the snapshot is exactly what it always was.

import fs from 'node:fs';
import vm from 'node:vm';
import * as MON from '../packages/monitor/index.js';
const { snapshotOf } = MON;
const cleanExtra = (...a) => MON.cleanExtra(...a);

const SNAPSHOT_KEYS = ['t', 'playing', 'holding', 'total', 'sceneIndex', 'scene', 'world', 'fps', 'state', 'overrides', 'signals'];

/** 一個「已連線」的 feed：不開 socket，送出去的 JSON 收進 sent。 */
function liveFeed(opts = {}) {
  const sent = [];
  const feed = new MonitorFeed({ url: null, ...opts });
  feed.connected = true;
  feed.ws = { send: (s) => sent.push(JSON.parse(s)) };
  feed._lastSend = -Infinity;
  return { feed, sent };
}

test('extra: without it the snapshot has exactly the keys it always had', () => {
  assert.deepEqual(Object.keys(snapshotOf({}, {})), SNAPSHOT_KEYS);
  assert.deepEqual(Object.keys(snapshotOf({ extra: null }, {})), SNAPSHOT_KEYS);
  assert.deepEqual(Object.keys(snapshotOf({ extra: {} }, {})), SNAPSHOT_KEYS, '空的也不留 extra 這個鍵');
  assert.deepEqual(Object.keys(snapshotOf({ extra: () => ({}) }, {})), SNAPSHOT_KEYS);
});

test('extra: an object (or a function called each time) lands under snapshot.extra, the rest is untouched', () => {
  const base = snapshotOf({}, { bloom: 1 });
  const a = snapshotOf({ extra: { 'sim/tick': 1200, 'sim/drift': 0.004 } }, { bloom: 1 });
  assert.deepEqual(a.extra, { 'sim/tick': 1200, 'sim/drift': 0.004 });
  const { extra, ...rest } = a;
  assert.deepEqual(rest, base);
  let n = 0;
  const get = () => ({ frames: ++n });
  assert.equal(snapshotOf({ extra: get }, {}).extra.frames, 1);
  assert.equal(snapshotOf({ extra: get }, {}).extra.frames, 2, '函式每次都重新問');
});

test('extra: a value is a number, string, boolean, null — or { v, min, max, warn } for a meter and a warning', () => {
  const x = cleanExtra({ n: 3, s: 'ok', b: true, z: null, u: undefined, drift: { v: 0.2, min: 0, max: 1, warn: true, junk: 9 } });
  assert.deepEqual(x, { n: 3, s: 'ok', b: true, z: null, u: null, drift: { v: 0.2, min: 0, max: 1, warn: true } });
});

test('extra: anything JSON cannot carry is cleaned, so one bad number never costs the whole frame', () => {
  const circular = {}; circular.me = circular;
  const x = cleanExtra({ nan: NaN, inf: Infinity, big: 10n, fn: () => 1, sym: Symbol('s'), arr: [1, 2], nest: { a: { b: 1 } }, circular,
    long: 'x'.repeat(500), [`k${'y'.repeat(100)}`]: 1, ok: 1 });
  assert.equal(x.nan, null);
  assert.equal(x.inf, null);
  assert.equal(x.ok, 1);
  for (const dropped of ['big', 'fn', 'sym', 'arr', 'nest', 'circular']) assert.equal(dropped in x, false, dropped);
  assert.equal(x.long.length, 80);
  assert.ok(Object.keys(x).every((k) => k.length <= 48));
  assert.doesNotThrow(() => JSON.stringify(x));
  const many = cleanExtra(Object.fromEntries(Array.from({ length: 200 }, (_, i) => [`k${i}`, i])));
  assert.equal(Object.keys(many).length, 64, '最多 64 個欄位');
  assert.equal(cleanExtra(JSON.parse('{"__proto__":{"evil":1},"a":1}')).evil, undefined);
  assert.deepEqual(cleanExtra({ v: { v: 'text', min: 'a', max: NaN } }), { v: { v: 'text' } });
  for (const nothing of [null, undefined, 5, 'x', [1], {}, () => 1]) assert.equal(cleanExtra(nothing), null);
});

test('extra: a provider that throws or answers nonsense is skipped; the snapshot still goes out', () => {
  assert.deepEqual(Object.keys(snapshotOf({ extra: () => { throw new Error('boom'); } }, {})), SNAPSHOT_KEYS);
  assert.deepEqual(Object.keys(snapshotOf({ extra: () => 42 }, {})), SNAPSHOT_KEYS);
});

test('extra from the world: the active world\'s monitor() is asked by snapshotOf, so a createShow() show needs no wiring', () => {
  const world = { name: 'w', monitor() { return { 'sim/tick': this.tick }; }, tick: 77 };
  const stage = { activeName: 'w', active: world };
  assert.deepEqual(snapshotOf({ stage }, {}).extra, { 'sim/tick': 77 }, '呼叫時 this 是 world 本身');
  assert.equal(snapshotOf({ stage }, {}).world, 'w');
  assert.deepEqual(snapshotOf({ stage, extra: { 'sim/tick': 1, other: 2 } }, {}).extra, { 'sim/tick': 1, other: 2 }, '呼叫端給的同名欄位贏');
  const broken = { active: { monitor() { throw new Error('boom'); } } };
  assert.deepEqual(Object.keys(snapshotOf({ stage: broken }, {})), SNAPSHOT_KEYS);
  for (const stage2 of [{ active: null }, { active: {} }, { active: { monitor: 5 } }, undefined]) {
    assert.deepEqual(Object.keys(snapshotOf({ stage: stage2 }, {})), SNAPSHOT_KEYS);
  }
});

test('MonitorFeed({ extra }) is the same as feed.extra(fn)', () => {
  const { feed, sent } = liveFeed({ hz: 1000, extra: () => ({ a: 1 }) });
  feed.frame({});
  assert.deepEqual(sent[0].extra, { a: 1 });
});

test('MonitorFeed.extra(fn): merged into every frame that goes out, asked only when one does; off() removes it', () => {
  const { feed, sent } = liveFeed({ hz: 1000 });
  let asked = 0;
  const off = feed.extra(() => { asked++; return { 'sim/tick': 7 }; });
  feed.frame({ t: 1 });
  assert.deepEqual(sent[0].extra, { 'sim/tick': 7 });
  assert.equal(sent[0].t, 1);
  assert.equal(asked, 1);
  feed.extra(() => ({ 'sim/nan': NaN, 'sim/tick': 8 }));                  // 第二個提供者：同名的後來者贏
  feed._lastSend = -Infinity; feed.frame({ t: 2 });
  assert.deepEqual(sent[1].extra, { 'sim/tick': 8, 'sim/nan': null });
  off();
  feed._lastSend = -Infinity; feed.frame({ t: 3 });
  assert.deepEqual(sent[2].extra, { 'sim/nan': null, 'sim/tick': 8 });
  const slow = liveFeed({ hz: 1 });                                       // 節流住的幀不去問提供者
  let calls = 0;
  slow.feed.extra(() => { calls++; return { a: 1 }; });
  slow.feed.frame({}); slow.feed.frame({}); slow.feed.frame({});
  assert.equal(calls, 1);
  assert.equal(slow.sent.length, 1);
});

test('MonitorFeed.extra: it adds to what snapshotOf already put under extra, and one that throws costs nothing', () => {
  const { feed, sent } = liveFeed({ hz: 1000 });
  feed.extra(() => { throw new Error('boom'); });
  feed.extra(() => ({ fromFeed: 2 }));
  feed.frame(snapshotOf({ extra: { fromSnapshot: 1 } }, {}));
  assert.deepEqual(sent[0].extra, { fromSnapshot: 1, fromFeed: 2 });
});

test('MonitorFeed without providers sends the snapshot as it is — no extra key, no cost', () => {
  const { feed, sent } = liveFeed({ hz: 1000 });
  feed.frame(snapshotOf({}, {}));
  assert.deepEqual(Object.keys(sent[0]).sort(), ['at', ...SNAPSHOT_KEYS].sort());
});

test('backstage page: a "Work" panel that stays hidden until a snapshot carries extra; the script still compiles', () => {
  const html = fs.readFileSync(new URL('../packages/monitor/backstage.html', import.meta.url), 'utf8');
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  assert.doesNotThrow(() => new vm.Script(script), 'backstage 的內嵌 script 語法正確');
  assert.match(html, /<div class="panel" id="work" hidden>/);
  const src = script.match(/function extraItems\([\s\S]*?\n}\n/)?.[0];
  assert.ok(src, 'extraItems 是個獨立的純函式');
  const extraItems = vm.runInNewContext(`${src}; extraItems`);
  const plain = (v) => JSON.parse(JSON.stringify(v));
  assert.deepEqual(plain(extraItems(undefined)), []);
  assert.deepEqual(plain(extraItems({})), []);
  assert.deepEqual(plain(extraItems({ tick: 1200, state: 'live' })), [
    { key: 'tick', val: 1200, norm: null, warn: false }, { key: 'state', val: 'live', norm: null, warn: false }]);
  assert.deepEqual(plain(extraItems({ drift: { v: 0.25, min: 0, max: 1, warn: true }, lag: { v: 5, min: 0, max: 4 }, flat: { v: 1, min: 2, max: 2 } })), [
    { key: 'drift', val: 0.25, norm: 0.25, warn: true }, { key: 'lag', val: 5, norm: 1, warn: false }, { key: 'flat', val: 1, norm: null, warn: false }]);
});
