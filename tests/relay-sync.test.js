// @openav/relay：leader／follower 角色與 `sync` 訊息（多執行個體同步的跨機器傳輸）。
// hub 是純邏輯（不開 socket）；後半起真的伺服器、用瀏覽器端的 RelayClient 連上去。傳輸層和 Timeline 的部分在 sync.test.js。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { RoomHub, cleanRole, ROLES } from '../packages/relay/hub.js';
import { attachRelay } from '../packages/relay/server.js';
import { RelayClient } from '../packages/relay/index.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 3000, what = 'condition') {
  const t0 = Date.now();
  while (!fn()) { if (Date.now() - t0 > ms) assert.fail(`timed out waiting for ${what}`); await wait(4); }
}
async function relayServer(opts) {
  const server = http.createServer();
  const relay = attachRelay(server, opts);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return { url: `ws://127.0.0.1:${server.address().port}/relay`, relay, async close() { relay.close(); await new Promise((r) => server.close(r)); } };
}

// ───────────── relay hub：leader／follower 角色 ─────────────

const peer = (hub, o) => { const inbox = []; const p = hub.join({ ...o, send: (s) => inbox.push(JSON.parse(s)) }); return { p, inbox, got: (t) => inbox.filter((m) => m.type === t) }; };
const syncMsg = (o) => JSON.stringify({ type: 'sync', v: 1, ...o });

test('hub: leader and follower are roles; anything else is still a controller', () => {
  assert.ok(ROLES.includes('leader') && ROLES.includes('follower'));
  assert.equal(cleanRole('leader'), 'leader'); assert.equal(cleanRole('follower'), 'follower');
  assert.equal(cleanRole('boss'), 'controller');
  for (const r of ['controller', 'runner', 'monitor']) assert.ok(ROLES.includes(r), r);
});

test('hub: a leader\'s sync reaches the followers of its room — not the leader itself, controllers, runners, monitors or other rooms', () => {
  const hub = new RoomHub();
  const L = peer(hub, { room: 'a', role: 'leader', id: 'L' });
  const F1 = peer(hub, { room: 'a', role: 'follower', id: 'f1' }), F2 = peer(hub, { room: 'a', role: 'follower', id: 'f2' });
  const C = peer(hub, { room: 'a', role: 'controller' }), R = peer(hub, { room: 'a', role: 'runner' }), M = peer(hub, { room: 'a', role: 'monitor' });
  const X = peer(hub, { room: 'b', role: 'follower', id: 'x' }), XL = peer(hub, { room: 'b', role: 'leader', id: 'XL' });
  const msg = syncMsg({ kind: 'frame', seq: 1, T: 3 });
  assert.ok(hub.message(L.p, msg));
  assert.equal(F1.got('sync')[0].T, 3); assert.equal(F2.got('sync')[0].T, 3);
  for (const o of [L, C, R, M, X, XL]) assert.equal(o.got('sync').length, 0);
});

test('hub: a follower\'s sync (hello) reaches the leaders of its room only', () => {
  const hub = new RoomHub();
  const L = peer(hub, { room: 'a', role: 'leader', id: 'L' }), F1 = peer(hub, { room: 'a', role: 'follower', id: 'f1' }), F2 = peer(hub, { room: 'a', role: 'follower', id: 'f2' });
  const C = peer(hub, { room: 'a', role: 'controller' }), M = peer(hub, { room: 'a', role: 'monitor' });
  const XL = peer(hub, { room: 'b', role: 'leader', id: 'XL' });
  hub.message(F1.p, syncMsg({ kind: 'hello', id: 'f1' }));
  assert.equal(L.got('sync').length, 1); assert.equal(L.got('sync')[0].kind, 'hello');
  for (const o of [F1, F2, C, M, XL]) assert.equal(o.got('sync').length, 0);
});

test('hub: a message with "to" goes to that peer id alone (a state reply to a late joiner)', () => {
  const hub = new RoomHub();
  const L = peer(hub, { room: 'a', role: 'leader', id: 'L' }), F1 = peer(hub, { room: 'a', role: 'follower', id: 'f1' }), F2 = peer(hub, { room: 'a', role: 'follower', id: 'f2' });
  hub.message(L.p, syncMsg({ kind: 'state', to: 'f2', seq: 4, T: 9 }));
  assert.equal(F2.got('sync').length, 1); assert.equal(F1.got('sync').length, 0);
});

test('hub: only a leader can send frames — controllers, runners, monitors and followers cannot speak to followers or leaders', () => {
  const hub = new RoomHub();
  const L = peer(hub, { room: 'a', role: 'leader', id: 'L' }), F = peer(hub, { room: 'a', role: 'follower', id: 'f' });
  const C = peer(hub, { room: 'a', role: 'controller' }), R = peer(hub, { room: 'a', role: 'runner' }), M = peer(hub, { room: 'a', role: 'monitor' });
  for (const imposter of [C, R, M]) hub.message(imposter.p, syncMsg({ kind: 'frame', seq: 1, T: 99 }));
  assert.equal(F.got('sync').length, 0); assert.equal(L.got('sync').length, 0);
  // 從屬端的訊息不會送到別的從屬端（沒有從屬端對從屬端）
  const F2 = peer(hub, { room: 'a', role: 'follower', id: 'f2' });
  hub.message(F.p, syncMsg({ kind: 'frame', seq: 1, T: 99 }));
  assert.equal(F2.got('sync').length, 0);
  // 對照組：真的主控端說話，從屬端聽得到（沒有它，上面的「沒聽到」在沒有這個角色的舊 hub 上也會過）
  hub.message(L.p, syncMsg({ kind: 'frame', seq: 2, T: 1 }));
  assert.deepEqual([F.got('sync').map((m) => m.T), F2.got('sync').map((m) => m.T)], [[1], [1]]);
});

test('hub: a leader\'s ordinary signals still go nowhere, and the old roles route exactly as before', () => {
  const hub = new RoomHub();
  const L = peer(hub, { role: 'leader', id: 'L' }), run = peer(hub, { role: 'runner' }), ctl = peer(hub, { role: 'controller' }), mon = peer(hub, { role: 'monitor' });
  hub.message(L.p, JSON.stringify({ type: 'signal', name: 'x', value: 1 }));
  assert.equal(run.got('signal').length + ctl.got('signal').length + mon.got('signal').length, 0);
  hub.message(ctl.p, JSON.stringify({ type: 'signal', name: 'y', value: 1 }));
  assert.equal(run.got('signal').length, 1); assert.equal(mon.got('signal').length, 1); assert.equal(L.got('signal').length, 0);
  // sync 不是 signal：控制器的 sync 不被 runner 聽到
  hub.message(ctl.p, syncMsg({ kind: 'frame' }));
  assert.equal(run.got('sync').length, 0);
});

test('hub: counts and status carry leaders and followers next to the old three', () => {
  const hub = new RoomHub();
  peer(hub, { room: 'a', role: 'leader', id: 'L' }); const F = peer(hub, { room: 'a', role: 'follower', id: 'f' }); peer(hub, { room: 'a', role: 'follower', id: 'g' });
  peer(hub, { room: 'a', role: 'controller' });
  assert.deepEqual(hub.counts('a'), { controllers: 1, runners: 0, monitors: 0, leaders: 1, followers: 2 });
  const last = F.got('status').at(-1);
  assert.equal(last.leaders, 1); assert.equal(last.followers, 2); assert.equal(last.controllers, 1);
  assert.deepEqual(hub.counts('nowhere'), { controllers: 0, runners: 0, monitors: 0, leaders: 0, followers: 0 });
});

test('hub: a bad sync message (not an object, no kind) is ignored', () => {
  const hub = new RoomHub();
  const L = peer(hub, { room: 'a', role: 'leader', id: 'L' }), F = peer(hub, { room: 'a', role: 'follower', id: 'f' });
  assert.equal(hub.message(L.p, 'nope'), null);
  hub.message(L.p, JSON.stringify({ type: 'sync' }));
  assert.equal(F.got('sync').length, 1, 'routing does not interpret the message; the follower ignores what it does not know');
});

test('RelayClient: sync(msg) goes out as { type:"sync" }, and onSync hears the others', async () => {
  const srv = await relayServer();
  const got = [];
  const q = (role, id) => `${srv.url}?role=${role}&room=rc&id=${id}`;
  const L = new RelayClient({ role: 'leader', room: 'rc', id: 'L', url: q('leader', 'L') });
  const F = new RelayClient({ role: 'follower', room: 'rc', id: 'F', url: q('follower', 'F'), onSync: (m) => got.push(m) });
  try {
    L.connect(); F.connect();
    await until(() => L.open && F.open, 3000, 'both open');
    L.sync({ v: 1, kind: 'frame', seq: 1, T: 2 });
    await until(() => got.length === 1, 3000, 'the frame');
    assert.deepEqual(got[0], { type: 'sync', v: 1, kind: 'frame', seq: 1, T: 2 });
  } finally { L.close(); F.close(); await srv.close(); }
});

test('relay: a message over the cap is dropped by default, and attachRelay({ maxMessageChars, maxBytes }) lets a big state through', async () => {
  const big = { type: 'sync', v: 1, kind: 'state', src: 'L', seq: 1, to: 'f', T: 1, extra: { tape: 'x'.repeat(300_000) } };
  for (const [opts, expected] of [[undefined, 0], [{ maxMessageChars: 1_000_000, maxBytes: 2_000_000 }, 1]]) {
    const srv = await relayServer(opts);
    const got = [];
    const L = new RelayClient({ role: 'leader', room: 'big', id: 'L', url: `${srv.url}?role=leader&room=big&id=L` });
    const F = new RelayClient({ role: 'follower', room: 'big', id: 'f', url: `${srv.url}?role=follower&room=big&id=f`, onSync: (m) => got.push(m) });
    try {
      L.connect(); F.connect();
      await until(() => L.open && F.open, 3000, 'open');
      L.sync({ v: big.v, kind: big.kind, src: big.src, seq: big.seq, to: big.to, T: big.T, extra: big.extra });
      await wait(300);
      assert.equal(got.length, expected, JSON.stringify(opts));
    } finally { L.close(); F.close(); await wait(30); await srv.close(); }
  }
});

