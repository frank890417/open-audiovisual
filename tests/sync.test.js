// @openav/sync + the relay's leader/follower roles：讓多個 OAV 頁面演出同一場。
//
// 訊息格式（通用，兩種傳輸一樣）：
//   { v:1, kind:'frame', src, seq, T, playing, holding, rate, cut?, extra? }   主控端每幀廣播
//   { v:1, kind:'hello', id, role:'follower', info?, reason? }                 從屬端上線
//   { v:1, kind:'state', src, seq, to, T, playing, holding, rate, cut?, extra? } 主控端回給中途加入者
// 傳輸：BroadcastChannel（同一台機器，零網路）和 relay 的 WebSocket（leader／follower 角色）。
// 這支測試：訊息與順序（純邏輯，記憶體匯流排）、relay hub 的路由、真的 BroadcastChannel、真的 WebSocket 伺服器、兩端 Timeline 實際同步。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { Timeline } from '../packages/timeline/index.js';
import { attachRelay } from '../packages/relay/server.js';
import {
  SYNC_VERSION, SyncLeader, SyncFollower, BroadcastTransport, RelayTransport, createTransport, createSync,
} from '../packages/sync/index.js';

const P = [{ key: 'x', min: 0, max: 1, def: 0 }];
const DT = 1 / 60;
const near = (a, b, e = 1e-9, msg = '') => assert.ok(Math.abs(a - b) <= e, `${msg} ${a} ≉ ${b} (±${e})`);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 3000, what = 'condition') {
  const t0 = Date.now();
  while (!fn()) { if (Date.now() - t0 > ms) assert.fail(`timed out waiting for ${what}`); await wait(4); }
}
const clock = (ms = 5_000_000) => { const now = () => ms; now.tick = (s) => { ms += s * 1000; }; return now; };

/** 記憶體裡的匯流排：每個端點的 send 送給其他端點（JSON 往返，和真的傳輸一樣只剩 JSON 能表達的東西）；可以丟特定訊息。 */
function memoryBus() {
  const ends = [];
  const bus = {
    dropIf: null, log: [],
    end() {
      const e = { cbs: [], opens: [], open: true, sent: [],
        send(msg) { const m = JSON.parse(JSON.stringify(msg)); e.sent.push(m); bus.log.push(m); if (bus.dropIf?.(m)) return; for (const o of ends) if (o !== e) o.cbs.forEach((cb) => cb(JSON.parse(JSON.stringify(m)))); },
        onMessage(cb) { e.cbs.push(cb); }, onOpen(cb) { e.opens.push(cb); }, close() { e.open = false; } };
      ends.push(e); return e;
    },
  };
  return bus;
}
const mkTl = (o = {}) => new Timeline({ params: P, total: 1000, ...o });

// ───────────── 領導端：訊息格式 ─────────────

test('SyncLeader: frame() sends { v, kind:"frame", src, seq, T, playing, holding, rate } and seq counts up', () => {
  const bus = memoryBus(), now = clock(), tl = mkTl();
  const L = new SyncLeader({ timeline: tl, transport: bus.end(), id: 'L1', now });
  tl.play(); tl.advance(0.5); L.frame();
  tl.advance(0.25); L.frame();
  assert.equal(SYNC_VERSION, 1);
  assert.deepEqual(bus.log[0], { v: 1, kind: 'frame', src: 'L1', seq: 1, T: 0.5, playing: true, holding: false, rate: 1 });
  assert.deepEqual(bus.log[1], { v: 1, kind: 'frame', src: 'L1', seq: 2, T: 0.75, playing: true, holding: false, rate: 1 });
});

test('SyncLeader: cut (a score\'s cut id) rides along when given; extra() is asked once per frame sent and rides along unless undefined', () => {
  const bus = memoryBus(), now = clock(), tl = mkTl();
  let n = 0;
  const L = new SyncLeader({ timeline: tl, transport: bus.end(), id: 'L', now, cut: () => 'short', extra: () => (n++ % 2 ? undefined : { n }) });
  L.frame(); L.frame(); L.frame();
  assert.equal(bus.log[0].cut, 'short');
  assert.deepEqual(bus.log.map((m) => m.extra), [{ n: 1 }, undefined, { n: 3 }]);
  assert.ok(!('extra' in bus.log[1]), 'no extra key when there is nothing to say');
  const plain = memoryBus(); new SyncLeader({ timeline: tl, transport: plain.end(), id: 'P', now }).frame();
  assert.ok(!('cut' in plain.log[0]) && !('extra' in plain.log[0]));
});

test('SyncLeader: hello → state to that follower — T, rate, play state, cut, and whatever state(hello) answers', () => {
  const bus = memoryBus(), now = clock(), tl = mkTl();
  const seen = [];
  const L = new SyncLeader({ timeline: tl, transport: bus.end(), id: 'L', now, cut: 'full', state: (h) => { seen.push(h.info); return { tape: [1, 2, 3] }; }, onHello: (h) => seen.push('hello ' + h.id) });
  const f = bus.end();
  tl.play(); tl.advance(2); L.frame(); L.frame();
  f.send({ v: 1, kind: 'hello', id: 'F9', role: 'follower', info: { build: 'abc' } });
  const st = bus.log.find((m) => m.kind === 'state');
  assert.deepEqual(st, { v: 1, kind: 'state', src: 'L', seq: 2, to: 'F9', T: 2, playing: true, holding: false, rate: 1, cut: 'full', extra: { tape: [1, 2, 3] } });
  assert.deepEqual(seen, ['hello F9', { build: 'abc' }]);
  assert.equal(L.status().followers, 1);
  f.send({ v: 1, kind: 'hello', id: 'F9', role: 'follower' });
  assert.equal(L.status().followers, 1, 'the same follower asking again is one follower'); assert.equal(L.status().hellos, 2);
});

test('SyncLeader: hz throttles frames, but a change of state or a seek goes out at once', () => {
  const bus = memoryBus(), now = clock(), tl = mkTl();
  const L = new SyncLeader({ timeline: tl, transport: bus.end(), id: 'L', now, hz: 10 });
  tl.play();
  for (let i = 0; i < 60; i++) { now.tick(DT); tl.advance(DT); L.frame(); }
  assert.ok(bus.log.length >= 9 && bus.log.length <= 12, `10 Hz for one second: ${bus.log.length}`);
  const before = bus.log.length;
  tl.pause(); now.tick(DT); L.frame();
  assert.equal(bus.log.length, before + 1, 'pause is sent at once');
  assert.equal(bus.log.at(-1).playing, false);
  tl.seek(40); now.tick(DT); L.frame();
  assert.equal(bus.log.length, before + 2, 'a seek is sent at once');
  assert.equal(bus.log.at(-1).T, 40);
  tl.rate = 2; now.tick(DT); L.frame();
  assert.equal(bus.log.length, before + 3, 'so is a rate change');
});

test('SyncLeader: a hold is sent as holding: true, playing: false', () => {
  const bus = memoryBus(), now = clock(), tl = mkTl({ scenes: [{ id: 'a', t: 0, hold: true }, { id: 'b', t: 2 }] });
  const L = new SyncLeader({ timeline: tl, transport: bus.end(), id: 'L', now });
  tl.play(); for (let i = 0; i < 200; i++) tl.advance(DT);
  L.frame();
  assert.equal(bus.log[0].holding, true); assert.equal(bus.log[0].playing, false);
  assert.ok(bus.log[0].T < 2 && bus.log[0].T > 1.99);
});

// ───────────── 從屬端 ─────────────

const frameMsg = (o) => ({ v: 1, kind: 'frame', src: 'L', seq: 1, T: 1, playing: true, holding: false, rate: 1, ...o });

function follower(o = {}) {
  const bus = memoryBus(), now = o.now || clock();
  const lead = bus.end(), tr = bus.end();
  const got = { frames: [], states: [], gaps: [] };
  const F = new SyncFollower({ transport: tr, id: 'F', now, onFrame: (m) => got.frames.push(m), onState: (m) => got.states.push(m), onGap: (g) => got.gaps.push(g), ...o });
  return { bus, now, lead, F, got, hellos: () => bus.log.filter((m) => m.kind === 'hello') };
}

test('SyncFollower: latest() is null until a frame, then { T, playing, holding, rate, at, seq } where at is when it arrived', () => {
  const { F, lead, now } = follower();
  assert.equal(F.latest(), null);
  now.tick(1);
  lead.send(frameMsg({ seq: 7, T: 12.5, rate: 2, cut: 'full' }));
  assert.deepEqual(F.latest(), { T: 12.5, playing: true, holding: false, rate: 2, at: now(), seq: 7, cut: 'full' });
  assert.equal(F.now, now);
});

test('SyncFollower: says hello when it comes up, and again every helloEvery until a state arrives; a state ends it', () => {
  const { F, lead, hellos, now, got } = follower({ helloEvery: 1000, info: { build: 'b1' } });
  assert.equal(hellos().length, 1);
  assert.deepEqual(hellos()[0], { v: 1, kind: 'hello', id: 'F', role: 'follower', info: { build: 'b1' } });
  for (let i = 0; i < 125; i++) { now.tick(DT); F.frame(); }      // 約 2 s 過去，沒有主控端
  assert.equal(hellos().length, 3, 'one at once, one per second');
  lead.send({ v: 1, kind: 'state', src: 'L', seq: 5, to: 'F', T: 30, playing: false, holding: false, rate: 1, extra: { tape: [1] } });
  assert.equal(got.states.length, 1); assert.deepEqual(got.states[0].extra, { tape: [1] });
  assert.equal(F.status().haveState, true);
  for (let i = 0; i < 300; i++) { now.tick(DT); F.frame(); }
  assert.equal(hellos().length, 3, 'no more hellos once it has the state');
  assert.equal(F.latest().T, 30);
});

test('SyncFollower: a state meant for another follower (to) is ignored; one for everybody (no to) is taken', () => {
  const { F, lead, got } = follower();
  lead.send({ v: 1, kind: 'state', src: 'L', seq: 1, to: 'other', T: 5, playing: false, holding: false, rate: 1 });
  assert.equal(got.states.length, 0); assert.equal(F.latest(), null);
  lead.send({ v: 1, kind: 'state', src: 'L', seq: 1, T: 6, playing: false, holding: false, rate: 1 });
  assert.equal(got.states.length, 1);
});

test('SyncFollower: a frame older than the newest (or twice) is dropped — the order is the leader\'s order', () => {
  const { F, lead, got } = follower();
  for (const seq of [1, 2, 3, 3, 2, 4]) lead.send(frameMsg({ seq, T: seq }));
  assert.deepEqual(got.frames.map((m) => m.seq), [1, 2, 3, 4]);
  assert.equal(F.status().dropped, 2); assert.equal(F.latest().T, 4);
});

test('SyncFollower: a gap in seq is reported (onGap), counted, and asks for the state again (the lost frame may have carried extra)', () => {
  const { F, lead, got, hellos, now } = follower();
  lead.send({ v: 1, kind: 'state', src: 'L', seq: 1, to: 'F', T: 0, playing: true, holding: false, rate: 1 });
  const h0 = hellos().length;
  lead.send(frameMsg({ seq: 2 })); now.tick(1);
  lead.send(frameMsg({ seq: 5 }));
  assert.deepEqual(got.gaps, [{ from: 3, to: 4 }]);
  assert.equal(F.status().gaps, 1);
  assert.equal(F.status().haveState, false);
  assert.equal(hellos().length, h0 + 1); assert.equal(hellos().at(-1).reason, 'gap');
  assert.deepEqual(got.frames.map((m) => m.seq), [2, 5], 'the frame after the gap is still delivered');
});

test('SyncFollower: resync: false never asks again after a gap', () => {
  const { lead, hellos, now } = follower({ resync: false });
  lead.send(frameMsg({ seq: 1 })); now.tick(5); lead.send(frameMsg({ seq: 9 }));
  assert.equal(hellos().length, 1, 'only the first hello');
});

test('SyncFollower: after a long silence the first frame back makes it ask for the state again', () => {
  const { F, lead, hellos, now } = follower();
  lead.send({ v: 1, kind: 'state', src: 'L', seq: 1, to: 'F', T: 0, playing: true, holding: false, rate: 1 });
  const h0 = hellos().length;
  lead.send(frameMsg({ seq: 2 }));
  now.tick(0.5); lead.send(frameMsg({ seq: 3 }));
  assert.equal(hellos().length, h0, 'half a second is not a silence');
  now.tick(5); lead.send(frameMsg({ seq: 4 }));
  assert.equal(hellos().length, h0 + 1); assert.equal(hellos().at(-1).reason, 'resumed');
});

test('SyncFollower: it follows one leader — a second one is ignored until the first has been quiet for takeoverAfter; then it switches and starts the count over', () => {
  const { F, lead, now, got } = follower({ takeoverAfter: 1500 });
  lead.send(frameMsg({ src: 'A', seq: 10, T: 1 }));
  now.tick(0.5); lead.send(frameMsg({ src: 'B', seq: 1, T: 99 }));
  assert.equal(F.latest().T, 1); assert.equal(F.status().ignored, 1);
  now.tick(2); lead.send(frameMsg({ src: 'B', seq: 2, T: 100 }));
  assert.equal(F.latest().T, 100); assert.equal(F.status().leader, 'B');
  lead.send(frameMsg({ src: 'B', seq: 3, T: 101 }));
  assert.deepEqual(got.frames.map((m) => m.src + m.seq), ['A10', 'B2', 'B3']);
});

test('SyncFollower: accept(msg) can refuse a leader (a different build, a different cut) — nothing is delivered and latest() stays null', () => {
  const { F, lead, got } = follower({ accept: (m) => m.cut === 'full' });
  lead.send(frameMsg({ seq: 1, cut: 'short' }));
  lead.send({ v: 1, kind: 'state', src: 'L', seq: 1, to: 'F', T: 3, cut: 'short', playing: false, holding: false, rate: 1 });
  assert.equal(F.latest(), null); assert.equal(got.frames.length + got.states.length, 0);
  assert.equal(F.status().rejected, 2);
  lead.send(frameMsg({ seq: 2, cut: 'full' }));
  assert.equal(F.latest().seq, 2);
});

test('SyncFollower: unknown kinds, other versions and junk are ignored without a sound; a throwing hook does not stop the next frame', () => {
  const { F, lead, got } = follower({ onFrame: () => { throw new Error('work bug'); } });
  const err = console.error; console.error = () => {};
  try {
    lead.send({ v: 2, kind: 'frame', src: 'L', seq: 1, T: 1, playing: true, holding: false, rate: 1 });
    lead.send({ v: 1, kind: 'telepathy' });
    lead.send({ v: 1, kind: 'frame', src: 'L', seq: 1, T: 'nan', playing: true });
    lead.send({ kind: 'frame', seq: 1 });
    lead.send(null);
    assert.equal(F.latest(), null);
    lead.send(frameMsg({ seq: 1, T: 4 })); lead.send(frameMsg({ seq: 2, T: 5 }));
  } finally { console.error = err; }
  assert.equal(F.latest().T, 5);
  assert.equal(got.frames.length, 0);
});

test('SyncFollower: extra arrives once each, in order, from frames and the state alike (the framework does not read it)', () => {
  const { lead, got } = follower();
  lead.send({ v: 1, kind: 'state', src: 'L', seq: 0, to: 'F', T: 0, playing: true, holding: false, rate: 1, extra: { all: [0] } });
  for (let i = 1; i <= 5; i++) lead.send(frameMsg({ seq: i, extra: { events: [i], when: 'x'.repeat(i) } }));
  assert.deepEqual(got.states.map((m) => m.extra), [{ all: [0] }]);
  assert.deepEqual(got.frames.map((m) => m.extra.events[0]), [1, 2, 3, 4, 5]);
});

// ───────────── 傳輸：真的 BroadcastChannel ─────────────

test('BroadcastTransport: two ends on one channel hear each other (JSON), never themselves; a third on another channel hears nothing', async () => {
  const a = new BroadcastTransport({ channel: 'oav-t-bc1' }), b = new BroadcastTransport({ channel: 'oav-t-bc1' }), c = new BroadcastTransport({ channel: 'oav-t-bc2' });
  const ha = [], hb = [], hc = [];
  a.onMessage((m) => ha.push(m)); b.onMessage((m) => hb.push(m)); c.onMessage((m) => hc.push(m));
  assert.equal(a.open, true);
  a.send({ v: 1, kind: 'frame', seq: 1, T: 1.25, extra: { when: undefined, n: 1 } });
  await until(() => hb.length === 1, 2000, 'b to hear a');
  await wait(30);
  assert.deepEqual(hb[0], { v: 1, kind: 'frame', seq: 1, T: 1.25, extra: { n: 1 } }, 'JSON, like the relay: undefined is gone on both transports');
  assert.equal(ha.length, 0); assert.equal(hc.length, 0);
  a.close(); b.close(); c.close();
  assert.equal(a.open, false);
});

test('createTransport: no url is a BroadcastChannel, a url is the relay; a bad channel name is refused', () => {
  const t = createTransport({ role: 'leader', channel: 'oav-t-ct' });
  assert.ok(t instanceof BroadcastTransport); t.close();
  for (const bad of ['', 'a b', 'x'.repeat(33), null, undefined]) assert.throws(() => createTransport({ role: 'leader', channel: bad }), /channel/, String(bad));
  assert.throws(() => createTransport({ role: 'boss', channel: 'ok' }), /role/);
});

// ───────────── 兩端 Timeline 實際同步（BroadcastChannel） ─────────────

/** 主控端 + 從屬端，各一條 Timeline，中間是真的傳輸。一幀 = 主控端走、廣播、等送達、從屬端走。 */
function duo({ url = null, channel, leaderOpts = {}, followerOpts = {}, scenes = [], loop = false } = {}) {
  const now = clock();
  const tlL = mkTl({ scenes, loop }), tlF = mkTl({ scenes, loop });
  const L = createSync({ role: 'leader', channel, url, timeline: tlL, now, ...leaderOpts });
  const F = createSync({ role: 'follower', channel, url, timeline: tlF, now, ...followerOpts });
  const d = {
    now, tlL, tlF, L, F,
    async frame(o = {}) {
      now.tick(DT); tlL.advance(DT); L.frame();
      if (o.deliver !== false) { const want = L.status().seq; await until(() => F.status().seq >= want, 3000, `frame ${want} to arrive`); }
      F.frame(); tlF.advance(DT);
    },
    async run(n) { for (let i = 0; i < n; i++) await d.frame(); },
    close() { L.close(); F.close(); },
  };
  return d;
}

test('BroadcastChannel: leader and follower timelines stay together — play, run, pause, seek, resume', async () => {
  const d = duo({ channel: 'oav-t-duo1' });
  try {
    d.tlL.play();
    await d.run(120);
    assert.equal(d.tlF.playing, true);
    near(d.tlF.t, d.tlL.t, 1e-9);
    assert.equal(d.tlF.followStatus().state, 'tracking');
    d.tlL.pause(); await d.run(2);
    assert.equal(d.tlF.playing, false); assert.equal(d.tlF.t, d.tlL.t);
    d.tlL.seek(321); await d.run(1);
    assert.equal(d.tlF.t, 321);
    d.tlL.play(); await d.run(60);
    near(d.tlF.t, d.tlL.t, 1e-9);
    assert.equal(d.tlF.followStatus().lost, false);
    assert.equal(d.F.status().gaps, 0); assert.equal(d.F.status().dropped, 0);
  } finally { d.close(); }
});

test('BroadcastChannel: a follower that joins in the middle says hello, gets the state, and is on the leader\'s T at its first frame', async () => {
  const now = clock(), channel = 'oav-t-late';
  const tlL = mkTl();
  const L = createSync({ role: 'leader', channel, timeline: tlL, now, state: (h) => ({ tape: ['a', 'b'], asked: h.info }) });
  let F;
  try {
    tlL.play();
    for (let i = 0; i < 300; i++) { now.tick(DT); tlL.advance(DT); L.frame(); }
    await wait(20);
    const tlF = mkTl(), states = [];
    F = createSync({ role: 'follower', channel, timeline: tlF, now, info: { build: 'z' }, onState: (m) => states.push(m) });
    await until(() => states.length === 1, 3000, 'the state reply');
    assert.deepEqual(states[0].extra, { tape: ['a', 'b'], asked: { build: 'z' } });
    near(states[0].T, tlL.t, 1e-9);
    F.frame(); tlF.advance(DT);
    near(tlF.t, tlL.t, 1e-9, 'landed on the leader');
    assert.equal(tlF.playing, true);
    assert.equal(tlF.followStatus().jumps, 1);
  } finally { L.close(); F?.close(); }
});

test('BroadcastChannel: a follower that starts before the leader keeps saying hello and gets its state when the leader appears', async () => {
  const now = clock(), channel = 'oav-t-early';
  const tlF = mkTl(), tlL = mkTl(), states = [];
  const F = createSync({ role: 'follower', channel, timeline: tlF, now, helloEvery: 1000, onState: (m) => states.push(m) });
  let L;
  try {
    for (let i = 0; i < 100; i++) { now.tick(DT); F.frame(); tlF.advance(DT); }
    L = createSync({ role: 'leader', channel, timeline: tlL, now });
    tlL.seek(77); tlL.play();
    for (let i = 0; i < 90; i++) { now.tick(DT); tlL.advance(DT); L.frame(); await wait(1); F.frame(); tlF.advance(DT); }
    await until(() => states.length >= 1, 3000, 'a state after the retry');
    assert.ok(F.status().hellos >= 2, 'it kept asking');
    near(tlF.t, tlL.t, 0.05);
  } finally { L?.close(); F.close(); }
});

test('BroadcastChannel: extra rides every frame in order, and the follower sees each exactly once', async () => {
  let n = 0; const seen = [];
  const d = duo({ channel: 'oav-t-extra', leaderOpts: { extra: () => ({ n: n++ }) }, followerOpts: { onFrame: (m) => seen.push(m.extra.n) } });
  try {
    d.tlL.play(); await d.run(80);
    assert.deepEqual(seen, Array.from({ length: 80 }, (_, i) => i));
  } finally { d.close(); }
});

test('BroadcastChannel: leaders and followers on different channels do not meet', async () => {
  const now = clock();
  const tlL = mkTl(), tlF = mkTl();
  const L = createSync({ role: 'leader', channel: 'oav-t-sepA', timeline: tlL, now }), F = createSync({ role: 'follower', channel: 'oav-t-sepB', timeline: tlF, now });
  try {
    tlL.play();
    for (let i = 0; i < 30; i++) { now.tick(DT); tlL.advance(DT); L.frame(); }
    await wait(40);
    assert.equal(F.latest(), null); assert.equal(tlF.followStatus().heard, false);
  } finally { L.close(); F.close(); }
});

test('createSync: the follower\'s timeline is following; close() lets it go (rate back); the leader leaves the timeline alone', () => {
  const now = clock(), tl = mkTl(), tl2 = mkTl();
  tl.rate = 0.9;
  const F = createSync({ role: 'follower', channel: 'oav-t-cs', timeline: tl, now });
  const L = createSync({ role: 'leader', channel: 'oav-t-cs2', timeline: tl2, now });
  assert.equal(tl.following, true); assert.equal(tl2.following, false);
  assert.equal(F.role, 'follower'); assert.equal(L.role, 'leader');
  F.close(); L.close();
  assert.equal(tl.following, false); assert.equal(tl.rate, 0.9);
});

test('createSync: a follower refuses a leader on another cut (score) and says so in the report', async () => {
  const now = clock(), channel = 'oav-t-cut';
  const tlL = mkTl(), tlF = mkTl();
  const L = createSync({ role: 'leader', channel, timeline: tlL, now, score: { cut: 'short' } });
  const F = createSync({ role: 'follower', channel, timeline: tlF, now, score: { cut: 'full' } });
  try {
    tlL.play(); for (let i = 0; i < 10; i++) { now.tick(DT); tlL.advance(DT); L.frame(); }
    await until(() => F.status().rejected >= 1, 2000, 'a rejection');
    assert.equal(F.latest(), null);
    assert.equal(F.status().rejected >= 1, true);
    assert.match(F.monitor()['sync/state'], /cut/);
  } finally { L.close(); F.close(); }
});

test('createSync: monitor() is flat numbers and strings (the monitor\'s extra), leader and follower', async () => {
  const d = duo({ channel: 'oav-t-mon' });
  try {
    d.tlL.play(); await d.run(10);
    const lm = d.L.monitor(), fm = d.F.monitor();
    assert.equal(lm['sync/role'], 'leader'); assert.equal(lm['sync/followers'], 1);
    assert.equal(fm['sync/role'], 'follower');
    assert.ok(fm['sync/error'] && typeof fm['sync/error'].v === 'number');
    assert.equal(fm['sync/lost'].warn ?? false, false);
    for (const v of [...Object.values(lm), ...Object.values(fm)]) assert.ok(['number', 'string', 'boolean', 'object'].includes(typeof v));
    JSON.stringify([lm, fm]);
  } finally { d.close(); }
});

// ───────────── 傳輸：relay 的 WebSocket ─────────────

async function relayServer(opts) {
  const server = http.createServer();
  const relay = attachRelay(server, opts);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  return { url: `ws://127.0.0.1:${port}/relay`, port, relay, async close() { relay.close(); await new Promise((r) => server.close(r)); } };
}

test('RelayTransport: leader and follower in one relay room — frame, hello, state(to) — and a controller in the same room hears none of it', async () => {
  const srv = await relayServer();
  const mk = (role, id) => new RelayTransport({ url: srv.url, room: 'rt1', role, id });
  const L = mk('leader', 'L'), F1 = mk('follower', 'f1'), F2 = mk('follower', 'f2');
  const spy = new WebSocket(`${srv.url}?role=controller&room=rt1&id=spy`); const spied = []; spy.onmessage = (e) => spied.push(JSON.parse(e.data));
  const hl = [], h1 = [], h2 = [];
  L.onMessage((m) => hl.push(m)); F1.onMessage((m) => h1.push(m)); F2.onMessage((m) => h2.push(m));
  try {
    await until(() => L.open && F1.open && F2.open && spy.readyState === 1, 3000, 'all open');
    L.send({ v: 1, kind: 'frame', src: 'L', seq: 1, T: 5, playing: true, holding: false, rate: 1 });
    await until(() => h1.length === 1 && h2.length === 1, 3000, 'frame to both followers');
    assert.deepEqual(h1[0], { v: 1, kind: 'frame', src: 'L', seq: 1, T: 5, playing: true, holding: false, rate: 1 }, 'the wire envelope is gone');
    F1.send({ v: 1, kind: 'hello', id: 'f1', role: 'follower' });
    await until(() => hl.length === 1, 3000, 'hello to the leader');
    assert.equal(hl[0].id, 'f1'); assert.equal(h2.length, 1, 'the other follower did not hear the hello');
    L.send({ v: 1, kind: 'state', src: 'L', seq: 1, to: 'f1', T: 5 });
    await until(() => h1.length === 2, 3000, 'state to f1');
    await wait(60);
    assert.equal(h2.length, 1, 'state is for f1 only');
    assert.equal(spied.filter((m) => m.type === 'sync').length, 0, 'a controller hears no sync');
  } finally { L.close(); F1.close(); F2.close(); spy.close(); await wait(30); await srv.close(); }
});

test('RelayTransport: onOpen fires on connect, and again after the socket is cut and comes back (the follower says hello again)', async () => {
  const srv = await relayServer();
  const F = new RelayTransport({ url: srv.url, room: 'rt2', role: 'follower', id: 'f' });
  let opens = 0; F.onOpen(() => opens++);
  try {
    await until(() => opens === 1, 3000, 'first open');
    F.client._ws.close();
    await until(() => opens === 2, 5000, 'reopen after the cut');
    assert.equal(F.open, true);
  } finally { F.close(); await srv.close(); }
});

test('WebSocket: leader and follower timelines stay together through a real relay, and a late joiner gets the state', async () => {
  const srv = await relayServer();
  const room = 'ws-duo';
  const d = duo({ url: srv.url, channel: room, leaderOpts: { state: () => ({ tape: [1] }) } });
  let F2, tlF2;
  try {
    await until(() => d.L.transport.open && d.F.transport.open, 3000, 'both sockets');
    d.tlL.play();
    await d.run(120);
    near(d.tlF.t, d.tlL.t, 1e-9);
    assert.equal(d.tlF.followStatus().lost, false);
    d.tlL.pause(); await d.run(2);
    assert.equal(d.tlF.playing, false); assert.equal(d.tlF.t, d.tlL.t);
    d.tlL.play(); await d.run(30);
    // 中途加入
    tlF2 = mkTl(); const states = [];
    F2 = createSync({ role: 'follower', channel: room, url: srv.url, timeline: tlF2, now: d.now, onState: (m) => states.push(m) });
    await until(() => states.length === 1, 3000, 'state for the late joiner');
    assert.deepEqual(states[0].extra, { tape: [1] });
    F2.frame(); tlF2.advance(DT);
    near(tlF2.t, d.tlL.t, 0.05);
    assert.equal(tlF2.playing, true);
    assert.equal(d.L.status().followers, 2);
  } finally { d.close(); F2?.close(); await wait(30); await srv.close(); }
});

test('WebSocket: the leader\'s socket drops — the follower keeps going on its own after lostAfter and says so; the leader comes back and it follows again', async () => {
  const srv = await relayServer();
  const room = 'ws-lost';
  const d = duo({ url: srv.url, channel: room, followerOpts: { follow: { lostAfter: 1 } } });
  try {
    await until(() => d.L.transport.open && d.F.transport.open, 3000, 'both sockets');
    d.tlL.play(); await d.run(60);
    assert.equal(d.tlF.followStatus().lost, false);
    for (let i = 0; i < 120; i++) { d.now.tick(DT); d.tlL.advance(DT); d.F.frame(); d.tlF.advance(DT); }      // 主控端的幀送不出去（沒呼叫 L.frame）
    const s = d.tlF.followStatus();
    assert.equal(s.lost, true);
    assert.ok(d.tlF.playing && d.tlF.t > 2.5, 'kept running by itself: ' + d.tlF.t);
    await d.run(5);
    assert.equal(d.tlF.followStatus().lost, false);
    near(d.tlF.t, d.tlL.t, 0.02);
  } finally { d.close(); await wait(30); await srv.close(); }
});
