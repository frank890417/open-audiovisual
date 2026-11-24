// DMX out of the bridge: the frame scheduler on a clock of the test's own (40 Hz, ≤ 44 a second, keep-alive, quiet
// universes stay quiet), then the artnet and sacn sinks over real loopback UDP, every packet decoded with @openav/dmx's own
// decoders (universe, bytes, rate, keep-alive, safe values when the page goes away, "hold"), and the enttec sink on a fake
// serial port. Timing over real sockets is checked with wide bounds only: the exact numbers are proved on the fake clock.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import dgram from 'node:dgram';
import fsModule from 'node:fs';   // the install.sh check reads files
import { startBridge } from '../packages/out/bridge/out-bridge.mjs';
import { DmxFrames, parseDmxChannel, toByte } from '../packages/out/bridge/sinks/dmx-frames.js';
import * as enttec from '../packages/out/bridge/sinks/enttec.js';
import { targetOf, CID } from '../packages/out/bridge/sinks/sacn.js';
import { OutClient } from '../packages/out/client.js';
import { decodeArtDmx, decodeSacn, decodeEnttecDmx, sacnAddress } from '../packages/dmx/index.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(pred, ms = 2000, what = 'condition') {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { const r = pred(); if (r) return r; await sleep(10); }
  throw new Error(`timed out after ${ms} ms waiting for ${what}`);
}

/** A UDP receiver on a free loopback port, decoding every packet with `decode`. */
async function receiver(decode) {
  const sock = dgram.createSocket('udp4');
  const got = [];
  sock.on('message', (m) => { const d = decode(m); if (d) got.push({ at: Date.now(), ...d }); });
  await new Promise((r) => sock.bind(0, '127.0.0.1', r));
  return { port: sock.address().port, got, close: () => new Promise((r) => sock.close(r)) };
}
const open = async (bridge) => {
  const ws = new WebSocket(`ws://127.0.0.1:${bridge.port}/out`);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws error')); });
  return ws;
};
const batch = (ws, obj) => ws.send(JSON.stringify({ type: 'batch', items: Object.entries(obj).map(([ch, v]) => ({ ch, v })) }));
const of = (got, u) => got.filter((p) => p.universe === u);

// ───────────── the scheduler, on the test's clock ─────────────

function clocked(o = {}) {
  let now = 0;
  const out = [];
  const f = new DmxFrames({ now: () => now, emit: (u, data, n) => out.push({ t: now, u, n, data: data.slice() }), ...o });
  return { f, out, at: (t) => { now = t; return f.tick(); } };
}

test('dmx channels: dmx/<universe>/<address>, address 1..512, value 0..1 → 0..255', () => {
  assert.deepEqual(parseDmxChannel('dmx/1/49'), { universe: 1, address: 49 });
  assert.deepEqual(parseDmxChannel('dmx/0/512'), { universe: 0, address: 512 });
  for (const bad of ['dmx/1/0', 'dmx/1/513', 'dmx/64000/1', 'dmx/1', 'dmx/a/1', 'light/1/r', 'dmx/1/1/2']) assert.equal(parseDmxChannel(bad), null, bad);
  assert.deepEqual([0, 0.5, 1, 1.7, -1, NaN, 128 / 255].map(toByte), [0, 128, 255, 255, 0, 0, 128]);
});

test('scheduler: a change leaves on the next tick, never sooner than 23 ms after the last frame, as one frame per universe', () => {
  const { f, out, at } = clocked();
  f.set('dmx/1/1', 1); f.set('dmx/1/2', 0.5); f.set('dmx/2/3', 1);
  assert.equal(out.length, 0, 'set() only writes the buffer');
  assert.equal(at(0), 2, 'one frame for each universe');
  assert.deepEqual([out[0].u, out[0].data[0], out[0].data[1], out[1].u, out[1].data[2]], [1, 255, 128, 2, 255]);
  f.set('dmx/1/1', 0);
  assert.equal(at(10), 0, '10 ms after the last frame: wait');
  assert.equal(at(25), 1, 'the next tick carries it');
  assert.equal(out.at(-1).data[0], 0);
  f.set('dmx/1/1', 0);
  assert.equal(at(50), 0, 'the same value again is no change');
});

test('scheduler: values changing every millisecond give about 40 frames a second on a late timer and never more than 44 on a fast one', () => {
  const most = (out) => { const ts = out.map((o) => o.t); return Math.max(...ts.map((t0) => ts.filter((x) => x >= t0 && x < t0 + 1000).length)); };
  // the 25 ms timer, firing up to 6 ms late (a busy machine): close to 40 Hz
  const late = clocked();
  let next = 0, seed = 7;
  for (let t = 0, i = 0; t < 3000; t++) {
    late.f.set('dmx/1/1', (i++ % 2) ? 1 : 0);
    if (t >= next) { late.at(t); seed = (seed * 1103515245 + 12345) >>> 0; next = t + 25 + (seed % 7); }
  }
  assert.ok(late.out.length >= 3 * 34 && most(late.out) <= 44, `${late.out.length} frames in 3 s, at most ${most(late.out)} in a second`);
  // a timer that fires every millisecond (it never does, but nothing else holds the rate): the 23 ms gap does
  const fast = clocked();
  for (let t = 0, i = 0; t < 3000; t++) { fast.f.set('dmx/1/1', (i++ % 2) ? 1 : 0); fast.at(t); }
  assert.ok(most(fast.out) <= 44, `${most(fast.out)} frames in one second`);
  for (let k = 1; k < fast.out.length; k++) assert.ok(fast.out[k].t - fast.out[k - 1].t >= 23);
});

test('scheduler: a quiet universe is sent again once a second (keep-alive); one never sent a value sends nothing', () => {
  const { f, out, at } = clocked();
  assert.equal(at(0), 0, 'nothing known: nothing sent');
  f.set('dmx/3/10', 0.2);
  at(0);
  assert.equal(at(500), 0); assert.equal(at(999), 0);
  assert.equal(at(1000), 1, 'keep-alive after 1 s');
  assert.equal(f.keepAlives, 1);
  assert.equal(out.at(-1).data[9], 51, 'the keep-alive carries the same bytes');
  assert.equal(at(1500), 0); assert.equal(at(2000), 1);
  assert.deepEqual(f.universes, [3]);
  assert.deepEqual(out.map((o) => o.n), [1, 2, 3], 'frames are counted per universe (the sinks turn that into sequence numbers)');
});

test('scheduler: flush() sends changed universes at once, gap or not (the bridge flushes right after safe values)', () => {
  const { f, out, at } = clocked();
  f.set('dmx/1/1', 1); at(0);
  f.set('dmx/1/1', 0);
  assert.equal(f.flush(), 1);
  assert.equal(out.length, 2); assert.equal(out[1].t, 0);
  assert.equal(f.flush(), 0, 'nothing changed since');
});

test('scheduler: universes a sink cannot carry are counted, and an emit that throws never escapes the timer', () => {
  const errors = [];
  const f = new DmxFrames({ accept: (u) => u >= 1, emit: () => { throw new Error('socket gone'); }, onError: (e) => errors.push(e.message) });
  assert.equal(f.set('dmx/0/1', 1), false);
  assert.equal(f.set('nope', 1), false);
  assert.equal(f.ignored, 2);
  assert.equal(f.set('dmx/1/1', 1), true);
  assert.doesNotThrow(() => f.tick());
  assert.deepEqual(errors, ['socket gone']); assert.equal(f.errors, 1);
});

// ───────────── artnet over loopback UDP ─────────────

async function artnetRig({ safe = { 'dmx/*': 0 }, timeoutMs = 5000, extra = {} } = {}) {
  const rx = await receiver(decodeArtDmx);
  const bridge = await startBridge({ port: 0, config: { channels: [{ match: 'dmx/*', sink: 'artnet', host: '127.0.0.1', port: rx.port, ...extra }], safe, timeoutMs } });
  return { rx, bridge, async close() { await bridge.close(); await rx.close(); } };
}

test('artnet: dmx/1/… arrives as Port-Address 1 with the right bytes, 512 of them, sequence from 1; dmx/2/512 as Port-Address 2', async () => {
  const r = await artnetRig();
  try {
    const ws = await open(r.bridge);
    batch(ws, { 'dmx/1/1': 1, 'dmx/1/2': 0.5, 'dmx/2/512': 1, 'dmx/0/7': 1, 'dmx/40000/1': 1 });
    await until(() => of(r.rx.got, 1).length && of(r.rx.got, 2).length && of(r.rx.got, 0).length, 1500, 'universes 0, 1 and 2');
    const [a] = of(r.rx.got, 1), [b] = of(r.rx.got, 2), [z] = of(r.rx.got, 0);
    assert.deepEqual([a.data.length, a.data[0], a.data[1], a.data[2], a.sequence, a.version], [512, 255, 128, 0, 1, 14]);
    assert.deepEqual([b.data[511], b.data[0]], [255, 0]);
    assert.equal(z.data[6], 255, 'dmx/0/… reaches a node still on the deprecated Port-Address 0');
    const st = r.bridge.health().sinks['0:artnet'];
    assert.equal(st.state, 'up'); assert.ok(st.ignored >= 1, 'universe 40000 is past the 15-bit Port-Address: counted, not sent');
    assert.ok(!r.rx.got.some((p) => p.universe > 0x7fff));
    ws.close();
  } finally { await r.close(); }
});

test('artnet: values changing every 5 ms leave at about 40 Hz and never more than 44 packets a second', async () => {
  const r = await artnetRig();
  try {
    const ws = await open(r.bridge);
    const t0 = Date.now();
    let i = 0;
    while (Date.now() - t0 < 1100) { batch(ws, { 'dmx/1/1': (i++ % 50) / 50 }); await sleep(5); }
    await sleep(60);
    const at = of(r.rx.got, 1).map((p) => p.at);
    let most = 0;
    for (const s of at) most = Math.max(most, at.filter((x) => x >= s && x < s + 1000).length);
    assert.ok(most <= 44, `${most} packets in one second`);
    assert.ok(at.length >= 10, `it does keep sending (${at.length} packets)`);
    ws.close();
  } finally { await r.close(); }
});

test('artnet: a still universe is resent about once a second (keep-alive) with the same bytes', async () => {
  const r = await artnetRig();
  try {
    const ws = await open(r.bridge);
    batch(ws, { 'dmx/1/5': 0.2 });
    await until(() => of(r.rx.got, 1).length, 1000, 'first packet');
    const first = of(r.rx.got, 1)[0].at;
    await until(() => of(r.rx.got, 1).length >= 3, 3500, 'two keep-alives');
    const p = of(r.rx.got, 1);
    assert.ok(p[1].at - first >= 800, `the keep-alive waited (${p[1].at - first} ms)`);
    assert.ok(p.every((x) => x.data[4] === 51));
    ws.close();
  } finally { await r.close(); }
});

test('artnet: the page goes away → safe values arrive at once; a "hold" channel keeps its value; a clean stop sends them too', async () => {
  const r = await artnetRig({ safe: { 'dmx/1/2': 'hold', 'dmx/*': 0 } });
  try {
    const ws = await open(r.bridge);
    batch(ws, { 'dmx/1/1': 1, 'dmx/1/2': 0.5, 'dmx/1/3': 1 });
    await until(() => of(r.rx.got, 1).some((p) => p.data[0] === 255 && p.data[2] === 255), 1000, 'live values');
    const t0 = Date.now();
    ws.close();
    const dark = await until(() => of(r.rx.got, 1).find((p) => p.at >= t0 && p.data[0] === 0), 1000, 'safe values');
    assert.ok(dark.at - t0 < 500, `within 500 ms (${dark.at - t0})`);
    assert.deepEqual([dark.data[0], dark.data[1], dark.data[2]], [0, 128, 0], 'channels 1 and 3 safe, channel 2 held');
  } finally { await r.close(); }
  // a clean stop: the safe frame leaves before the socket closes
  const s = await artnetRig({ safe: { 'dmx/*': 0 } });
  try {
    const ws = await open(s.bridge);
    batch(ws, { 'dmx/1/9': 1 });
    await until(() => of(s.rx.got, 1).some((p) => p.data[8] === 255), 1000, 'live value');
    await s.bridge.close();
    await until(() => of(s.rx.got, 1).some((p) => p.data[8] === 0), 1000, 'safe frame on close');
  } finally { await s.bridge.close().catch(() => {}); await s.rx.close(); }
});

test('artnet: no host is refused (unicast is the rule), broadcast only when asked; safe values are numbers or "hold"', () => {
  assert.throws(() => startBridge({ port: 0, config: { channels: [{ match: 'dmx/*', sink: 'artnet' }] } }), /host/);
  assert.throws(() => startBridge({ port: 0, config: { channels: [{ match: '*', sink: 'log' }], safe: { 'dmx/*': 'off' } } }), /hold/);
});

test('three universes through one page: one batch of 1536 values is taken whole (a heartbeat carries every held value)', async () => {
  // OutClient re-sends every held value as ONE batch each timeoutMs / 3; the bridge used to read only the first 1024 items,
  // so past two full universes the rest were never refreshed and the watchdog took them for a dead page. No timing here:
  // one batch, then count what the bridge took and what reached the wire.
  const r = await artnetRig({ timeoutMs: 60000 });
  try {
    const ws = await open(r.bridge);
    const items = [];
    for (const u of [1, 2, 3]) for (let a = 1; a <= 512; a++) items.push({ ch: `dmx/${u}/${a}`, v: 1 });
    ws.send(JSON.stringify({ type: 'batch', items }));
    await until(() => r.bridge.state.received === 1536, 2000, 'all 1536 values taken');
    await until(() => [1, 2, 3].every((u) => of(r.rx.got, u).some((p) => p.data.every((x) => x === 255))), 2000, 'three full universes on the wire');
    assert.equal(r.bridge.state.rejected, 0);
    ws.close();
    await until(() => r.bridge.state.safeSent === 1536, 2000, 'all safe once the page is gone');
  } finally { await r.close(); }
});

// ───────────── sacn over loopback UDP ─────────────

test('sacn: unicast packets decode to the universe, the bytes, the priority and source asked for, one CID per run', async () => {
  const rx = await receiver(decodeSacn);
  const bridge = await startBridge({ port: 0, config: { channels: [{ match: 'dmx/*', sink: 'sacn', host: '127.0.0.1', port: rx.port, priority: 150, source: 'oav test' }], safe: { 'dmx/*': 0 }, timeoutMs: 5000 } });
  try { await sacnScenario(rx, bridge); } finally { await bridge.close().catch(() => {}); }
  try {
    await until(() => of(rx.got, 1).filter((p) => p.terminated).length === 3, 1000, 'three stream-terminated packets on stop');
    const last = of(rx.got, 1);
    assert.ok(last.findIndex((p) => p.terminated) > last.findIndex((p) => p.data[0] === 0), 'the safe frame comes before the goodbye');
  } finally { await rx.close(); }
});
async function sacnScenario(rx, bridge) {
  const ws = await open(bridge);
  batch(ws, { 'dmx/1/1': 1, 'dmx/300/2': 0.5, 'dmx/0/1': 1 });
  await until(() => of(rx.got, 1).length && of(rx.got, 300).length, 1500, 'universes 1 and 300');
  const [a] = of(rx.got, 1), [b] = of(rx.got, 300);
  assert.deepEqual([a.data.length, a.data[0], a.priority, a.source, a.startCode, a.terminated], [512, 255, 150, 'oav test', 0, false]);
  assert.equal(b.data[1], 128);
  assert.equal(a.cid.length, 16);
  assert.ok(rx.got.every((p) => p.cid.every((x, i) => x === a.cid[i])), 'every packet, every universe: one CID');
  assert.ok(!rx.got.some((p) => p.universe === 0), 'sACN has no universe 0');
  batch(ws, { 'dmx/1/1': 0.2 });
  await until(() => of(rx.got, 1).length >= 2, 1000, 'a second packet');
  assert.equal(of(rx.got, 1)[1].sequence, (of(rx.got, 1)[0].sequence + 1) & 0xff, 'sequence counts up per universe');
  await until(() => of(rx.got, 300).length >= 2, 2500, 'a keep-alive on the still universe');
  ws.close();
  await until(() => of(rx.got, 1).some((p) => p.data[0] === 0 && !p.terminated), 1000, 'safe values');
}

test('sacn: without a host each universe goes to its multicast group 239.255.<hi>.<lo>; priority is checked', () => {
  assert.equal(targetOf(1), sacnAddress(1)); assert.equal(targetOf(1), '239.255.0.1');
  assert.equal(targetOf(300), '239.255.1.44');
  assert.equal(targetOf(300, '10.0.0.9'), '10.0.0.9');
  assert.equal(CID.length, 16);
  assert.throws(() => startBridge({ port: 0, config: { channels: [{ match: 'dmx/*', sink: 'sacn', host: '127.0.0.1', priority: 201 }] } }), /priority/);
});

// ───────────── the installed bridge ─────────────

test('install.sh copies every file the bridge imports from outside packages/out (and its package.json, so Node reads it as ESM)', () => {
  const fs = fsModule;
  const sinks = fs.readdirSync(new URL('../packages/out/bridge/sinks/', import.meta.url)).filter((f) => f.endsWith('.js'));
  const install = fs.readFileSync(new URL('../packages/out/bridge/install.sh', import.meta.url), 'utf8');
  const outside = new Set();
  for (const f of sinks) {
    const src = fs.readFileSync(new URL(`../packages/out/bridge/sinks/${f}`, import.meta.url), 'utf8');
    // every file outside packages/out, at any depth (packages/dmx/flash-guard.js as well as packages/dmx/protocol/artnet.js)
    for (const m of src.matchAll(/from\s+'\.\.\/\.\.\/\.\.\/([\w/.-]+\.js)(?:\?[^']*)?'/g)) outside.add(m[1]);
  }
  assert.ok(outside.has('dmx/protocol/artnet.js'), 'the DMX sinks import the encoders of @openav/dmx');
  assert.ok(outside.has('dmx/flash-guard.js'), 'and its flash guard');
  for (const file of outside) {
    const pkg = file.split('/')[0], dir = file.split('/').slice(0, -1).join('/');
    assert.ok(install.includes(`"$PKGS"/${dir}/*.js`) || install.includes(`"$PKGS/${file}"`), `install.sh copies packages/${file}`);
    assert.ok(install.includes(`"$PKGS/${pkg}/package.json"`), `install.sh copies packages/${pkg}/package.json`);
  }
  // and what it copies imports nothing it does not copy: flash-guard.js stands alone
  const guard = fs.readFileSync(new URL('../packages/dmx/flash-guard.js', import.meta.url), 'utf8');
  assert.doesNotMatch(guard, /^\s*import\s/m, 'packages/dmx/flash-guard.js has no imports (the installed bridge has only it and protocol/)');
});

// ───────────── enttec on a fake serial port ─────────────

/** A serial port that records whole writes; `hold` keeps each write pending until release() (a slow port). */
function fakePort({ fail = 0, hold = false } = {}) {
  const P = { opens: 0, writes: [], waiting: [], closed: 0, fail };
  P.open = (path, baud, cb) => {
    P.opens++;
    if (P.fail > 0) { P.fail--; return setImmediate(() => cb(new Error(`${path}: ENOENT`))); }
    setImmediate(() => cb(null, {
      write(buf, done) { P.writes.push(Uint8Array.from(buf)); if (hold) P.waiting.push(done); else setImmediate(() => done(null)); },
      close() { P.closed++; },
    }));
  };
  P.release = () => { const w = P.waiting.splice(0); for (const d of w) d(null); };
  return P;
}
const ctx = { log: () => {} };

test('enttec: one universe as "send DMX" frames (label 6, start code 0, 512 channels); other universes are not its business', async () => {
  const P = fakePort();
  const s = enttec.create({ path: '/dev/cu.fake', universe: 2 }, ctx, { openPort: P.open });
  try {
    await until(() => s.status().state === 'up', 1000, 'open');
    await sleep(60);
    assert.equal(P.writes.length, 0, 'nothing is written before the page has sent anything (no dark frame at start)');
    s.send('dmx/2/1', 1); s.send('dmx/2/512', 0.5); s.send('dmx/1/1', 1);
    await until(() => P.writes.some((w) => decodeEnttecDmx(w)?.data[0] === 255), 1000, 'a frame with channel 1');
    const f = decodeEnttecDmx(P.writes.at(-1));
    assert.deepEqual([P.writes.at(-1)[0], P.writes.at(-1)[1], f.startCode, f.data.length, f.data[511]], [0x7e, 6, 0, 512, 128]);
    assert.equal(s.status().ignored, 1, 'dmx/1/1 is another universe');
  } finally { s.close(); }
});

test('enttec: a slow port gets whole frames only, the newest next (never a queue, never half a frame)', async () => {
  const P = fakePort({ hold: true });
  const s = enttec.create({ path: '/dev/cu.fake' }, ctx, { openPort: P.open });
  try {
    await until(() => s.status().state === 'up', 1000, 'open');
    s.send('dmx/1/1', 0.05);
    await until(() => P.writes.length === 1, 1000, 'first frame (held by the port)');
    for (let i = 1; i <= 10; i++) { s.send('dmx/1/1', i / 10); await sleep(30); }
    assert.equal(P.writes.length, 1, 'nothing else written while the port is busy');
    P.release();
    await until(() => P.writes.length === 2, 1000, 'one more frame');
    assert.equal(decodeEnttecDmx(P.writes[1]).data[0], 255, 'the newest value, not the second one');
    assert.ok(P.writes.every((w) => w.length === 518 && decodeEnttecDmx(w)), 'every write is a whole frame');
    P.release();
  } finally { s.close(); }
});

test('enttec: no device → state "down", no throw, frames dropped, retried until it appears', async () => {
  const P = fakePort({ fail: 3 });
  const s = enttec.create({ path: '/dev/cu.missing', retryMs: 20 }, ctx, { openPort: P.open });
  try {
    await until(() => s.status().error, 500, 'down, with the reason');
    assert.equal(s.status().state, 'down'); assert.match(s.status().error, /ENOENT/);
    s.send('dmx/1/1', 1);
    await sleep(40);
    assert.ok(s.status().dropped >= 1, 'a frame for a missing device is dropped, not queued');
    await until(() => s.status().state === 'up', 1500, 'up after the retries');
    assert.equal(P.opens, 4);
    await until(() => P.writes.some((w) => decodeEnttecDmx(w).data[0] === 255), 1000, 'the held value goes out once it is there');
  } finally { s.close(); }
  await until(() => P.closed === 1, 1000, 'close() lets the port go');
});

test('enttec sink through the bridge: a missing device path does not stop the bridge from starting', async () => {
  const bridge = await startBridge({ port: 0, config: { channels: [{ match: 'dmx/*', sink: 'enttec', path: '/dev/cu.does-not-exist-9999', retryMs: 50 }] } });
  try {
    await until(() => bridge.health().sinks['0:enttec'].error, 1000, 'down, with the reason');
    assert.equal(bridge.health().sinks['0:enttec'].state, 'down');
    assert.match(bridge.health().sinks['0:enttec'].error, /does-not-exist/);
  } finally { await bridge.close(); }
});
