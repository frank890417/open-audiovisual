// @openav/out — the out-bridge over real loopback sockets (UDP catcher + Node 22's global WebSocket,
// every port 0), the OSC / DDP encoders byte for byte, the watchdog (and proof the test goes red without it),
// the serial sink on a missing device, the browser OutClient, and the lab wire.
//
// Bridge, page and test share one event loop, so a busy machine used to decide some of these: a stall longer than
// timeoutMs let the watchdog look before a queued heartbeat was read (red at least four times before a release). The
// rig's bridge reads a clock only the test moves, and bridge.tick() is one look of its watchdog, the same function its
// timer runs; one test keeps the real clock and timer. Waits for something to happen are generous (10 s); a wait that
// proves nothing happened looks at the bridge's own counters instead of the clock.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import dgram from 'node:dgram';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startBridge, RESERVED_PORTS, globToRegExp } from '../packages/out/bridge/out-bridge.mjs';
import { encodeOsc } from '../packages/out/bridge/sinks/osc.js';
import { encodeDdp, ddpFrame } from '../packages/out/bridge/sinks/ddp.js';
import { OutClient } from '../packages/out/client.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BRIDGE = path.join(ROOT, 'packages/out/bridge/out-bridge.mjs');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const hex = (b) => Buffer.from(b).toString('hex');

/** wait until pred() is truthy (polling), or fail after ms: long, because a loaded machine is slow, not wrong */
async function until(pred, ms = 10000, what = 'condition') {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { const r = pred(); if (r) return r; await sleep(10); }
  throw new Error(`timed out after ${ms} ms waiting for ${what}`);
}

/** A UDP receiver on a free port. */
async function catcher() {
  const sock = dgram.createSocket('udp4');
  const got = [];
  sock.on('message', (m) => got.push({ at: Date.now(), buf: m }));
  await new Promise((r) => sock.bind(0, '127.0.0.1', r));
  return {
    port: sock.address().port, got,
    json: () => got.map((g) => JSON.parse(g.buf.toString())),
    close: () => new Promise((r) => sock.close(r)),
  };
}

/** The bridge's clock, moved only by hand. Not 0: a channel whose time is 0 has never had a value. */
function handClock(t = 1e6) { const c = { t, now: () => c.t, add: (ms) => (c.t += ms) }; return c; }

const live = [];   // everything a test opened; closed in cleanup so no port or timer outlives the suite
async function rig(configFor, bridgeOpts = {}) {
  const udp = await catcher();
  const clock = handClock();
  const bridge = await startBridge({ port: 0, config: configFor(udp.port), now: clock.now, ...bridgeOpts });
  const sockets = [];
  const r = {
    udp, bridge, clock,
    async ws() {
      const ws = new WebSocket(`ws://127.0.0.1:${bridge.port}/out`);
      ws.inbox = [];
      ws.addEventListener('message', (e) => ws.inbox.push(JSON.parse(e.data)));
      await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws error')); });
      sockets.push(ws);
      return ws;
    },
    async close() { for (const s of sockets) try { s.close(); } catch {} await bridge.close(); await udp.close(); },
  };
  live.push(r);
  return r;
}
const udpJson = (safe = { 'light/*': 0, 'motor/*': 0.5 }, timeoutMs = 150) => (port) => ({
  channels: [{ match: '*', sink: 'udp-json', host: '127.0.0.1', port }], safe, timeoutMs,
});
const send = (ws, o) => ws.send(JSON.stringify(o));

// ───────────── set → sink ─────────────

test('a WebSocket set arrives at the sink (udp-json), batch and hello too', async () => {
  const r = await rig(udpJson());
  const ws = await r.ws();
  send(ws, { type: 'hello', id: 'demo' });
  send(ws, { type: 'set', ch: 'light/1/r', v: 0.5 });
  send(ws, { type: 'batch', items: [{ ch: 'light/1/g', v: 0.25 }, { ch: 'motor/1', v: 0.75 }] });
  await until(() => r.udp.got.length >= 3, undefined, '3 datagrams');
  assert.deepEqual(r.udp.json(), [{ ch: 'light/1/r', v: 0.5 }, { ch: 'light/1/g', v: 0.25 }, { ch: 'motor/1', v: 0.75 }]);
  await until(() => ws.inbox.filter((m) => m.type === 'status').length >= 2, undefined, 'status replies');
  const st = ws.inbox.at(-1);
  assert.equal(st.type, 'status'); assert.equal(st.timeoutMs, 150); assert.equal(st.watchdog, true);
});

test('bad messages are refused with an error, never routed (non-number, bad channel name, not JSON)', async () => {
  const r = await rig(udpJson({}));
  const ws = await r.ws();
  send(ws, { type: 'set', ch: 'light/1/r', v: 'high' });
  send(ws, { type: 'set', ch: '../etc/passwd x', v: 1 });
  ws.send('not json');
  await until(() => ws.inbox.filter((m) => m.type === 'error').length >= 3, undefined, 'three errors');
  await sleep(60);
  assert.equal(r.udp.got.length, 0);
  assert.equal(r.bridge.state.rejected, 2);
});

test('/health reports sinks, channels, clients and the last value time', async () => {
  const r = await rig(udpJson());
  const ws = await r.ws();
  send(ws, { type: 'set', ch: 'light/1/r', v: 1 });
  await until(() => r.udp.got.length, undefined, 'datagram');
  const h = await (await fetch(`http://127.0.0.1:${r.bridge.port}/health`)).json();
  assert.equal(h.ok, true); assert.equal(h.channels, 1); assert.equal(h.clients, 1);
  assert.equal(h.sinks['0:udp-json'].state, 'up'); assert.equal(h.lastReceivedAgoMs, 0, 'on the bridge\'s clock, which has not moved');
  r.clock.add(250);
  assert.equal(r.bridge.health().lastReceivedAgoMs, 250);
});

test('routing: first matching glob wins; unmatched channels are counted, not sent', async () => {
  const a = await catcher(), b = await catcher();
  const bridge = await startBridge({ port: 0, config: { channels: [
    { match: 'light/*', sink: 'udp-json', port: a.port }, { match: 'osc/*', sink: 'udp-json', port: b.port }] } });
  const ws = new WebSocket(`ws://127.0.0.1:${bridge.port}/out`);
  await new Promise((res) => { ws.onopen = res; });
  ws.send(JSON.stringify({ type: 'batch', items: [{ ch: 'light/1/r', v: 1 }, { ch: 'osc/x', v: 2 }, { ch: 'other', v: 3 }] }));
  await until(() => a.got.length && b.got.length, undefined, 'both sinks');
  await sleep(40);
  assert.equal(a.got.length, 1); assert.equal(b.got.length, 1); assert.equal(bridge.state.unrouted, 1);
  ws.close(); await bridge.close(); await a.close(); await b.close();
  assert.ok(globToRegExp('light/*').test('light/1/r') && !globToRegExp('light/*').test('xlight/1'));
});

// ───────────── watchdog ─────────────

/**
 * The scenario every watchdog claim rests on: values stop → once more than timeoutMs (150) has passed the safe value goes,
 * exactly once. Time is the rig's clock; bridge.tick() is one look of the watchdog. `waitMs`: how long to wait for the safe
 * datagrams (short only where they are expected never to come).
 */
async function watchdogScenario(bridgeOpts = {}, waitMs = undefined) {
  const r = await rig(udpJson(), bridgeOpts);
  const ws = await r.ws();
  send(ws, { type: 'batch', items: [{ ch: 'light/1/r', v: 0.9 }, { ch: 'motor/1', v: 0.2 }, { ch: 'free/x', v: 7 }] });
  await until(() => r.udp.got.length >= 3, undefined, 'the live values');
  // …and now the page goes quiet (socket stays open)
  r.clock.add(150);
  assert.equal(r.bridge.tick(), 0, 'at exactly timeoutMs nothing is quiet yet: the safe value never comes before the timeout');
  r.clock.add(1);
  r.bridge.tick();
  await until(() => r.udp.json().some((m) => m.ch === 'light/1/r' && m.v === 0), waitMs, 'safe value for light/1/r');
  await until(() => r.udp.json().some((m) => m.ch === 'motor/1' && m.v === 0.5), waitMs, 'safe value for motor/1');
  r.clock.add(3 * 150);                                                  // three more timeouts: still only once
  assert.equal(r.bridge.tick(), 0, 'each channel gets its safe value once');
  assert.equal(r.bridge.state.safeSent, 2, 'light/1/r and motor/1, and nothing for "free/x" (no safe value set)');
  const safes = r.udp.json().filter((m) => (m.ch === 'light/1/r' && m.v === 0) || (m.ch === 'motor/1' && m.v === 0.5));
  assert.equal(safes.length, 2, 'each channel gets its safe value once');
  assert.equal(r.udp.json().filter((m) => m.ch === 'free/x').length, 1, 'a channel without a safe value is left alone');
}

test('watchdog: values stop → safe value after timeoutMs, once, only where a safe value is set',
  () => watchdogScenario(process.env.OUT_TEST_WATCHDOG_OFF ? { watchdog: false } : {}));

test('watchdog: the same scenario with the watchdog switched off goes red (this is what the old, watchdog-less bridge did)', async () => {
  await assert.rejects(() => watchdogScenario({ watchdog: false }, 300), /timed out after \d+ ms waiting for safe value for light\/1\/r/);
});

test('watchdog on its own timer and the real clock: a quiet channel gets its safe value after timeoutMs, once', async () => {
  const logs = [];
  const r = await rig(udpJson({ 'light/*': 0 }, 150), { now: Date.now, log: (line) => logs.push({ at: Date.now(), line }) });
  const ws = await r.ws();
  const sentAt = Date.now();                                             // before the bridge can have the value
  send(ws, { type: 'set', ch: 'light/1/r', v: 0.9 });
  await until(() => r.udp.json().some((m) => m.v === 0), undefined, 'the safe value, from the timer');
  const safe = logs.find((l) => l.line.startsWith('[out] safe light/1/r=0 '));
  assert.ok(safe, 'the bridge says why'); assert.match(safe.line, /150 ms/);
  assert.ok(safe.at - sentAt > 150, `sent ${safe.at - sentAt} ms after the value left the page: after timeoutMs, never before`);
  await sleep(100);                                                      // a few more looks of the timer
  assert.equal(r.bridge.state.safeSent, 1, 'once');
});

test('client disconnect → every known channel with a safe value gets it at once (not after timeoutMs)', async () => {
  const logs = [];
  const r = await rig(udpJson({ 'light/*': 0, 'motor/*': 0.5 }, 5000), { log: (line) => logs.push(line) });
  const ws = await r.ws();
  send(ws, { type: 'batch', items: [{ ch: 'light/2/b', v: 1 }, { ch: 'motor/3', v: 0.9 }, { ch: 'free/x', v: 4 }] });
  await until(() => r.udp.got.length >= 3, undefined, 'live values');
  ws.close();
  await until(() => r.udp.json().filter((m) => (m.ch === 'light/2/b' && m.v === 0) || (m.ch === 'motor/3' && m.v === 0.5)).length === 2, undefined, 'safe on disconnect');
  // the bridge's clock has not moved, so no timeout can have sent them: the disconnect did
  assert.equal(r.bridge.state.safeSent, 2);
  assert.equal(logs.filter((l) => l.startsWith('[out] safe ')).length, 2);
  assert.ok(logs.filter((l) => l.startsWith('[out] safe ')).every((l) => l.endsWith('(最後一個 client 斷線)')), 'sent because the last client left');
  assert.equal(r.udp.json().filter((m) => m.ch === 'free/x').length, 1);
});

test('one of two clients leaving is not a disconnect: no safe value while someone is still connected', async () => {
  const r = await rig(udpJson({ 'light/*': 0 }, 5000));
  const a = await r.ws(), b = await r.ws();
  send(a, { type: 'set', ch: 'light/1/r', v: 1 });
  await until(() => r.udp.got.length, undefined, 'value');
  a.close();
  await until(() => r.bridge.health().clients === 1, undefined, 'the bridge saw one leave');   // its safe values, had it sent any, go in that same step
  assert.equal(r.bridge.state.safeSent, 0);
  assert.equal(r.udp.got.length, 1);
  b.close();
  await until(() => r.udp.got.length === 2, undefined, 'safe after the last client');
});

test('a clean shutdown leaves the hardware safe', async () => {
  const r = await rig(udpJson({ 'light/*': 0 }, 5000));
  const ws = await r.ws();
  send(ws, { type: 'set', ch: 'light/1/r', v: 1 });
  await until(() => r.udp.got.length, undefined, 'value');
  await r.bridge.close();
  await until(() => r.udp.json().some((m) => m.v === 0), undefined, 'safe on close');
});

// ───────────── encoders, byte for byte ─────────────

test('OSC: "/light/1/r" 0.5 → exact bytes (padded address, ",f", big-endian float32)', () => {
  assert.equal(hex(encodeOsc('/light/1/r', 0.5)), '2f6c696768742f312f72' + '0000' + '2c660000' + '3f000000');
  // "/light/1/r" is 10 chars → 12 bytes with NULs; ",f" → 4; float 0.5 = 3f000000
  assert.equal(encodeOsc('/light/1/r', 0.5).length, 20);
  assert.equal(hex(encodeOsc('/a', 1)), '2f610000' + '2c660000' + '3f800000');       // 2 chars + NUL → 4
  assert.equal(hex(encodeOsc('/abc', -2)), '2f616263' + '00000000' + '2c660000' + 'c0000000');   // 4 chars still needs a NUL → 8
  assert.equal(hex(encodeOsc('/n')), '2f6e0000' + '2c000000');                          // no args → ",\0\0\0"
  assert.throws(() => encodeOsc('nope', 1), /\//);
});

test('DDP: header bytes for known RGB data, offset and sequence; large frames split at 1440 bytes', () => {
  const p = encodeDdp([255, 0, 0, 0, 255, 0], { seq: 1 });
  assert.equal(hex(p), '4101' + '01' + '01' + '00000000' + '0006' + 'ff0000' + '00ff00');
  assert.equal(hex(encodeDdp([1, 2, 3], { offset: 1440, seq: 17, push: false })), '4001' + '01' + '01' + '000005a0' + '0003' + '010203');
  assert.equal(encodeDdp(Buffer.alloc(0), { seq: 0 }).length, 10);
  const frame = ddpFrame(Buffer.alloc(1500 * 3), 2);                                    // 4500 bytes → 1440 + 1440 + 1440 + 180
  assert.deepEqual(frame.map((x) => x.length - 10), [1440, 1440, 1440, 180]);
  assert.deepEqual(frame.map((x) => x[0]), [0x40, 0x40, 0x40, 0x41], 'only the last packet pushes');
  assert.deepEqual(frame.map((x) => x.readUInt32BE(4)), [0, 1440, 2880, 4320]);
});

test('ddp sink end to end: light/<i>/r|g|b fill the buffer, one packet per frame (coalesced), 60 Hz at most', async () => {
  const r = await rig((port) => ({ channels: [{ match: 'light/*', sink: 'ddp', host: '127.0.0.1', port, pixels: 4 }], safe: { 'light/*': 0 }, timeoutMs: 5000 }));
  const ws = await r.ws();
  send(ws, { type: 'batch', items: [{ ch: 'light/0/r', v: 1 }, { ch: 'light/1/g', v: 0.5 }, { ch: 'light/3/b', v: 1 }, { ch: 'light/9/r', v: 1 }] });
  await until(() => r.udp.got.length, undefined, 'a ddp packet');
  await sleep(60);
  assert.equal(r.udp.got.length, 1, 'four values in one burst = one packet');
  assert.equal(hex(r.udp.got[0].buf), '4101' + '01' + '01' + '00000000' + '000c' + 'ff0000' + '008000' + '000000' + '0000ff');
  // 30 sets, one every ~2 ms. How long that really takes depends on the machine (Windows' timers tick every 15.6 ms), so the
  // cap is checked against the time it took: frames at least 1/60 s apart, plus the one that may leave at once
  const t0 = Date.now();
  for (let i = 0; i < 30; i++) { send(ws, { type: 'set', ch: 'light/0/r', v: i % 2 }); await sleep(2); }
  await sleep(100);
  const elapsed = Date.now() - t0, burst = r.udp.got.length - 1;
  assert.ok(burst >= 1 && burst <= Math.ceil(elapsed * 60 / 1000) + 1, `30 sets in ${elapsed} ms went out as ${burst} packets (≤ 60 Hz)`);
  ws.close();
  await until(() => r.udp.got.at(-1).buf.subarray(10).every((x) => x === 0), undefined, 'all-dark frame on disconnect');
  assert.ok(r.udp.got.at(-1).buf.subarray(10).every((x) => x === 0), 'the pixels that were lit are back to the safe value');
});

test('osc sink end to end: the datagram is the encoded message', async () => {
  const r = await rig((port) => ({ channels: [{ match: 'osc/*', sink: 'osc', host: '127.0.0.1', port }] }));
  const ws = await r.ws();
  send(ws, { type: 'set', ch: 'osc/fader/1', v: 0.5 });
  await until(() => r.udp.got.length, undefined, 'osc packet');
  assert.deepEqual(r.udp.got[0].buf, encodeOsc('/osc/fader/1', 0.5));
});

// ───────────── refusals ─────────────

test('port 7457 (The Last Input) and non-loopback hosts are refused', () => {
  assert.deepEqual(RESERVED_PORTS, [7457]);
  assert.throws(() => startBridge({ port: 7457 }), /7457/);
  assert.throws(() => startBridge({ port: 0, host: '0.0.0.0' }), /loopback/);
  assert.throws(() => startBridge({ port: 0, host: '192.168.1.5' }), /loopback/);
  assert.throws(() => startBridge({ port: 0, config: { channels: [{ match: '*', sink: 'nope' }] } }), /sink/);
});

test('a browser Origin outside allowOrigins is refused at the handshake', async () => {
  const r = await rig((port) => ({ channels: [{ match: '*', sink: 'udp-json', port }], allowOrigins: ['https://lab.cheyuwu.com'] }));
  const raw = (origin) => new Promise((resolve) => rawHandshake(r.bridge.port, origin, resolve));
  assert.match(await raw('https://evil.example'), /^HTTP\/1\.1 403/);
  assert.match(await raw('https://lab.cheyuwu.com'), /^HTTP\/1\.1 101/);
});
function rawHandshake(port, origin, done) {
  const s = net.connect(port, '127.0.0.1', () => s.write(`GET /out HTTP/1.1\r\nHost: x\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\nSec-WebSocket-Version: 13\r\nOrigin: ${origin}\r\n\r\n`));
  s.once('data', (d) => { done(d.toString()); s.destroy(); });
  return s;
}

// ───────────── serial ─────────────

test('serial sink on a device that is not there: state "down", no throw, values dropped, bridge keeps serving', async () => {
  const r = await rig((port) => ({ channels: [
    { match: 'motor/*', sink: 'serial', path: '/dev/cu.does-not-exist-9999', baud: 115200, retryMs: 50 },
    { match: '*', sink: 'udp-json', port }], safe: {}, timeoutMs: 5000 }));
  const ws = await r.ws();
  await until(() => r.bridge.health().sinks['0:serial'].state === 'down', undefined, 'down');
  send(ws, { type: 'batch', items: [{ ch: 'motor/1', v: 0.3 }, { ch: 'light/1/r', v: 1 }] });
  await until(() => r.udp.got.length, undefined, 'the other sink still works');
  const s = r.bridge.health().sinks['0:serial'];
  assert.equal(s.state, 'down'); assert.match(s.error, /does-not-exist/); assert.equal(s.dropped, 1);
  await sleep(150);                                                                       // a few retries later: still fine
  assert.equal(r.bridge.health().sinks['0:serial'].state, 'down');
});

// ───────────── browser client ─────────────

const frameTimer = (fn) => setTimeout(fn, 5);
/** A rig whose bridge sends everything to the log sink and notes each value with the bridge's time: the sink prints in the same
 *  step as the bridge takes the value, so `at(line, t)` says the bridge took it at time t, not when a datagram happened to be read. */
async function logRig(safe, timeoutMs) {
  const puts = [];
  const r = await rig(() => ({ channels: [{ match: '*', sink: 'log' }], safe, timeoutMs }), { print: (line) => puts.push({ t: r.clock.t, line }) });
  return Object.assign(r, { puts, at: (line, t) => puts.some((p) => p.line === line && p.t === t) });
}

test('OutClient: set() twice on a channel in one frame leaves once (the last); several channels leave as one batch', async () => {
  // a watchdog of ten minutes: its heartbeat (a third of it) never lands among the datagrams this test counts, however slow the machine
  const r = await rig(udpJson({}, 600000));
  const c = new OutClient({ url: `ws://127.0.0.1:${r.bridge.port}/out`, id: 'w', schedule: frameTimer });
  const states = []; c.onStatus((s) => states.push(s));
  c.connect();
  await until(() => c.status === 'open' && c.bridge, undefined, 'open + bridge status');   // before it, the beat is a third of a 500 ms guess
  assert.equal(c.beatMs, 200000);
  for (let i = 1; i <= 10; i++) c.set('light/1/r', i / 10);
  c.set('light/1/g', 0.5);
  await until(() => r.udp.got.length >= 2, undefined, 'datagrams');
  await sleep(40);
  assert.deepEqual(r.udp.json(), [{ ch: 'light/1/r', v: 1 }, { ch: 'light/1/g', v: 0.5 }]);
  assert.equal(c.sent, 2); assert.equal(c.last['light/1/r'], 1); assert.equal(r.bridge.state.received, 2, 'one batch of two');
  assert.deepEqual(states, ['connecting', 'open']);
  assert.ok(c.bridge && c.bridge.type === 'status', 'the bridge status is kept');
  c.set('light/1/r', NaN); c.set(7, 1);                                                   // ignored
  c.close();
  assert.equal(c.status, 'closed');
});

test('OutClient: heartbeat keeps a held value alive past the watchdog (still slider ≠ dead page)', async () => {
  const r = await logRig({ 'light/*': 0 }, 150);
  const c = new OutClient({ url: `ws://127.0.0.1:${r.bridge.port}/out`, schedule: frameTimer });
  c.connect();
  await until(() => c.status === 'open' && c.bridge, undefined, 'open + bridge status');
  assert.equal(c.beatMs, 50, 'a third of the bridge\'s 150 ms once it has said so (a third of the 500 ms guess, 167 ms, let the watchdog in)');
  c.set('light/1/r', 0.8);
  await until(() => r.at('light/1/r 0.8', r.clock.t), undefined, 'the value');
  // the bridge's clock moves to just inside timeoutMs and the watchdog looks; then the value has to come again at the new
  // time, with no set() since: a heartbeat. Four times 149 ms is four timeouts, kept alive by the heartbeats alone.
  for (let i = 1; i <= 4; i++) {
    r.clock.add(149);
    assert.equal(r.bridge.tick(), 0, `${i * 149} ms of bridge time since the set(): still alive`);
    await until(() => r.at('light/1/r 0.8', r.clock.t), undefined, `heartbeat ${i}`);
  }
  assert.ok(r.puts.every((p) => p.line === 'light/1/r 0.8'), 'only 0.8 was ever sent, never the safe 0');
  c.close();
  await until(() => r.puts.some((p) => p.line === 'light/1/r 0'), undefined, 'safe once the client is gone');
});

test('OutClient: a channel that moves every frame does not starve the still ones of their heartbeat', async () => {
  // between two frames the queue is never empty while one channel animates; the held ones must still be resent
  const r = await logRig({ 'light/*': 0 }, 600);                     // heartbeat every 200 ms
  const queued = [];
  const c = new OutClient({ url: `ws://127.0.0.1:${r.bridge.port}/out`, schedule: (fn) => queued.push(fn) });
  c.connect();
  await until(() => c.status === 'open' && c.bridge, undefined, 'open + bridge status');
  c.set('light/2/r', 0.7);                                            // set once, then held
  // a page's frame, as requestAnimationFrame runs it: last frame's flush, then the work sets this frame's value, which waits
  // for the next frame. Between two frames the queue is never empty.
  let i = 0;
  const anim = setInterval(() => { for (const f of queued.splice(0)) f(); c.set('light/1/r', (i++ % 100) / 100); }, 16);
  try {
    // both channels taken at the bridge's current time: the still one by its heartbeat, the moving one by its next frame
    const both = () => r.at('light/2/r 0.7', r.clock.t) && r.puts.some((p) => p.t === r.clock.t && p.line.startsWith('light/1/r '));
    await until(both, undefined, 'the held value and the moving one');
    // as above: the clock moves to just inside timeoutMs, the watchdog looks, and the still channel must come again at the new
    // time while the other one moves every frame. Four times 599 ms is four timeouts.
    for (let k = 1; k <= 4; k++) {
      r.clock.add(599);
      assert.equal(r.bridge.tick(), 0, 'the held channel was never taken for a dead page');
      await until(both, undefined, `heartbeat ${k} of the still channel, while the other one moves every frame`);
    }
    assert.equal(r.bridge.state.safeSent, 0);
    assert.ok(r.puts.filter((p) => p.line.startsWith('light/1/r ')).length >= 3, 'and the moving one kept moving');
  } finally { clearInterval(anim); c.close(); }
});

test('OutClient: reconnects with backoff after the bridge restarts, resends the held values, and says so through onStatus', async () => {
  const udp = await catcher();
  const cfg = { channels: [{ match: '*', sink: 'udp-json', port: udp.port }], timeoutMs: 5000 };
  let bridge = await startBridge({ port: 0, config: cfg });
  const port = bridge.port;
  const c = new OutClient({ url: `ws://127.0.0.1:${port}/out`, schedule: frameTimer, minBackoffMs: 20, maxBackoffMs: 80 });
  const states = []; c.onStatus((s) => states.push(s));
  c.connect();
  await until(() => c.status === 'open', undefined, 'open');
  c.set('motor/1', 0.4);
  await until(() => udp.got.length === 1, undefined, 'first value');
  await bridge.close();
  await until(() => c.status === 'connecting', undefined, 'noticed the loss');
  await sleep(150);                                                                       // a couple of failed attempts, backoff capped at 80
  bridge = await startBridge({ port, config: cfg });
  await until(() => c.status === 'open', undefined, 'reconnected');
  await until(() => udp.json().filter((m) => m.ch === 'motor/1' && m.v === 0.4).length >= 2, undefined, 'held value resent');
  assert.ok(states.includes('connecting') && states.filter((s) => s === 'open').length === 2);
  c.close(); await bridge.close(); await udp.close();
});

test('OutClient: simulate() has no socket; values only land in .last', () => {
  const c = new OutClient({ WebSocket: function () { throw new Error('no socket in sim'); } });
  c.simulate();
  c.set('light/1/r', 0.3); c.batch({ 'motor/1': 1 });
  assert.equal(c.status, 'sim'); assert.deepEqual(c.last, { 'light/1/r': 0.3, 'motor/1': 1 }); assert.equal(c.sent, 0);
  c.connect(); assert.equal(c.status, 'sim');
});

// ───────────── the lab wire ─────────────

const WIRE = fs.readFileSync(path.join(ROOT, 'packages/out/lab.wire.js'), 'utf8');
function runWire({ search = '', meta = {}, params = {}, WS } = {}) {
  const handlers = {};
  const lab = { id: 'w1', meta, params, on: (n, f) => { (handlers[n] ||= []).push(f); } };
  const saved = { location: globalThis.location, WebSocket: globalThis.WebSocket };
  globalThis.location = { search, protocol: 'http:' };
  if (WS) globalThis.WebSocket = WS;
  try { new Function('lab', 'OutClient', WIRE)(lab, OutClient); } finally { globalThis.location = saved.location; globalThis.WebSocket = saved.WebSocket; }
  return { lab, fire: (n, v) => (handlers[n] || []).forEach((f) => f(v)) };
}

test('wire: ?out=sim, meta.out.simulate, ?out=0, ?out=ws://… and meta.out.url pick the mode and the address', () => {
  const opened = [];
  const WS = function (u) { opened.push(u); this.readyState = 0; this.close = () => {}; };
  assert.equal(runWire({ search: '?out=sim', WS }).lab.out.status, 'sim');
  assert.equal(runWire({ meta: { out: { simulate: true } }, WS }).lab.out.status, 'sim');
  assert.equal(runWire({ search: '?out=0', WS }).lab.out.status, 'closed');
  assert.deepEqual(opened, []);
  const a = runWire({ search: '?out=ws://10.0.0.5:7000/out', WS }); a.lab.out.close();
  const b = runWire({ meta: { out: { url: 'ws://127.0.0.1:6999/out' } }, WS }); b.lab.out.close();
  const c = runWire({ WS }); c.lab.out.close();
  assert.deepEqual(opened, ['ws://10.0.0.5:7000/out', 'ws://127.0.0.1:6999/out', 'ws://127.0.0.1:6450/out']);
});

test('wire: meta.params[i].out binds a param to channel(s): 0..1 by min–max, outRaw as is, starting value sent', () => {
  const meta = { params: [
    { key: 'glow', type: 'number', min: 10, max: 30, out: 'light/1/brightness' },
    { key: 'speed', type: 'number', min: 0, max: 10, out: ['motor/1', 'osc/speed'], outRaw: true },
    { key: 'on', type: 'bool', out: 'light/1/on' },
    { key: 'mode', type: 'enum', options: ['a', 'b', 'c'], out: 'osc/mode' },
    { key: 'plain', type: 'number' },
  ] };
  const w = runWire({ search: '?out=sim', meta, params: { glow: 20, speed: 3, on: true, mode: 'b', plain: 1 } });
  assert.deepEqual(w.lab.out.last, { 'light/1/brightness': 0.5, 'motor/1': 3, 'osc/speed': 3, 'light/1/on': 1, 'osc/mode': 0.5 });
  w.fire('param/glow', 30); w.fire('param/glow', 99); w.fire('param/speed', 7.5); w.fire('param/on', false); w.fire('param/mode', 'c');
  assert.equal(w.lab.out.last['light/1/brightness'], 1, 'clamped to 0..1');
  assert.equal(w.lab.out.last['motor/1'], 7.5); assert.equal(w.lab.out.last['light/1/on'], 0); assert.equal(w.lab.out.last['osc/mode'], 1);
});

// ───────────── the real process ─────────────

test('CLI: --port 0 --config prints ready JSON, serves /health, SIGTERM exits 0 (and leaves safe values); port 7457 exits 1', async () => {
  const udp = await catcher();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oav-out-'));
  const cfgFile = path.join(dir, 'out.json');
  fs.writeFileSync(cfgFile, JSON.stringify({ channels: [{ match: '*', sink: 'udp-json', port: udp.port }], safe: { '*': 0 }, timeoutMs: 5000 }));
  const child = spawn(process.execPath, [BRIDGE, '--port', '0', '--config', cfgFile, '--quiet'], { stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    const ready = await new Promise((res, rej) => {
      let buf = ''; child.stdout.on('data', (d) => { buf += d; if (buf.includes('\n')) res(JSON.parse(buf.split('\n')[0])); });
      child.once('exit', () => rej(new Error('exited early'))); setTimeout(() => rej(new Error('no ready line')), 15000).unref();   // unref: it must not hold the run open once the line came
    });
    assert.equal(ready.ready, true); assert.ok(ready.port > 0 && ready.port !== 6450);
    const ws = new WebSocket(`ws://127.0.0.1:${ready.port}/out`);
    await new Promise((res) => { ws.onopen = res; });
    ws.send(JSON.stringify({ type: 'set', ch: 'a/b', v: 1 }));
    await until(() => udp.got.length === 1, undefined, 'value through the process');
    const exited = new Promise((res) => child.once('exit', (code) => res(code)));
    child.kill('SIGTERM');
    assert.equal(await exited, 0);
    await until(() => udp.json().some((m) => m.ch === 'a/b' && m.v === 0), undefined, 'safe value on SIGTERM');
  } finally { child.kill('SIGKILL'); fs.rmSync(dir, { recursive: true, force: true }); await udp.close(); }
  const bad = spawn(process.execPath, [BRIDGE, '--port', '7457'], { stdio: 'ignore' });
  assert.equal(await new Promise((res) => bad.once('exit', res)), 1);
});

test('cleanup: every bridge, socket and UDP receiver the suite opened is closed', async () => {
  for (const r of live) await r.close().catch(() => {});
  assert.ok(true);
});
