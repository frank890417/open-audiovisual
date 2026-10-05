// @openav/leap — no hardware needed: the conversion LeapJS sketches depend on, the gesture
// hysteresis, normalization, the mock hands, and the bridge's real sockets (spawned --mock on a
// free port, read with Node 22's own WebSocket).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Signals } from '../packages/core/src/signals.js';
import {
  LeapInput, leapSignals, V6Converter, rawToV6, handsOf, handAngles, normalizePoint, boneBasis, v6Header, deviceEvent,
  protocolOfPath, Hysteresis, HandGestures, THRESHOLDS, mockHand, mockFrame, INTERACTION_BOX, FINGERS,
} from '../packages/leap/index.js';
import { startBridge, RESERVED_PORTS } from '../packages/leap/bridge/leap-bridge.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BRIDGE = path.join(ROOT, 'packages/leap/bridge/leap-bridge.mjs');
const det3 = (m) => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
const isVec = (v) => Array.isArray(v) && v.length === 3 && v.every(Number.isFinite);
const isBasis = (b) => Array.isArray(b) && b.length === 3 && b.every(isVec);

// ───────────── the raw (The Last Input) format ─────────────

test('mock hands speak The Last Input raw format exactly (keys, 5 fingers × 5 joints, arm)', () => {
  const f = mockFrame(1.0, 60);
  assert.deepEqual(Object.keys(f), ['t', 'id', 'fps', 'hands']);
  assert.equal(f.t, 'f'); assert.equal(f.hands.length, 2);
  for (const h of f.hands) {
    assert.deepEqual(Object.keys(h), ['id', 'side', 'conf', 'pinch', 'grab', 'palm', 'vel', 'n', 'dir', 'w', 'f', 'ext', 'arm']);
    assert.ok(['L', 'R'].includes(h.side));
    assert.equal(h.f.length, 5);
    for (const d of h.f) { assert.equal(d.length, 5); assert.ok(d.every(isVec)); }
    assert.equal(h.ext.length, 5); assert.ok(h.ext.every((e) => e === 0 || e === 1));
    assert.equal(h.arm.length, 2); assert.ok(h.arm.every(isVec));
    assert.ok(Math.abs(Math.hypot(...h.n) - 1) < 0.01 && Math.abs(Math.hypot(...h.dir) - 1) < 0.01);
  }
  assert.deepEqual(mockFrame(1.0, 60), f, 'deterministic in t');
  assert.equal(f.hands[0].f[0][0].join(), f.hands[0].f[0][1].join(), 'thumb metacarpal has zero length, as in LeapC');
});

test('mock: the right hand pinches every 3 s, both hands together every 12 s, the left fist comes and goes', () => {
  const at = (t) => handsOf(mockFrame(t));
  assert.ok(at(2.0)[0].pinch > THRESHOLDS.pinch.on, 'right pinched mid-cycle');
  assert.ok(at(0.5)[0].pinch < THRESHOLDS.pinch.off, 'right open early in the cycle');
  const both = at(8.0);
  assert.ok(both[0].pinch > 0.8 && both[1].pinch > 0.8, 'both pinch at t = 8');
  const grabs = Array.from({ length: 40 }, (_, i) => at(i)[1].grab);
  assert.ok(Math.max(...grabs) > 0.8 && Math.min(...grabs) < 0.5);
  const p = mockHand({ side: 'R', palm: [0, 200, 0], pinch: 1 }).f;
  assert.ok(Math.hypot(p[0][4][0] - p[1][4][0], p[0][4][1] - p[1][4][1], p[0][4][2] - p[1][4][2]) < 1, 'pinch = 1 → thumb and index tips meet');
});

// ───────────── raw → LeapJS v6 ─────────────

test('raw → v6: every field the LeapJS 0.6/1.x Frame, Hand, Pointable, Finger and Bone constructors read', () => {
  const v = rawToV6(mockFrame(2.0, 120), 5_000_000);
  for (const k of ['id', 'timestamp', 'currentFrameRate', 'hands', 'pointables', 'interactionBox', 'gestures', 'r', 's', 't']) assert.ok(k in v, `frame.${k}`);
  assert.equal(v.id, 120); assert.equal(v.timestamp, 5_000_000); assert.equal(v.currentFrameRate, 60);
  assert.deepEqual(v.gestures, []);
  assert.deepEqual(v.interactionBox, { center: INTERACTION_BOX.center, size: INTERACTION_BOX.size });
  assert.ok(isBasis(v.r) && v.s === 1 && isVec(v.t));
  assert.equal(v.hands.length, 2); assert.equal(v.pointables.length, 10);
  for (const h of v.hands) {
    for (const k of ['palmPosition', 'stabilizedPalmPosition', 'palmVelocity', 'palmNormal', 'direction', 'sphereCenter', 'elbow', 'wrist', 't']) assert.ok(isVec(h[k]), `hand.${k}`);
    for (const k of ['sphereRadius', 'pinchStrength', 'grabStrength', 'confidence', 'timeVisible', 'palmWidth', 'armWidth', 's']) assert.ok(Number.isFinite(h[k]), `hand.${k}`);
    assert.ok(['left', 'right'].includes(h.type));
    assert.ok(isBasis(h.armBasis) && isBasis(h.r));
    assert.deepEqual(h.t, h.palmPosition, 'hand.translation(since) = palm motion');
    assert.ok(Math.abs(Math.abs(det3(h.r)) - 1) < 0.02, 'hand.r is the palm basis (rotationAngle works)');
    assert.equal(det3(h.armBasis) < 0, h.type === 'left', 'Bone._left from the basis determinant, like the real service');
  }
  for (const p of v.pointables) {
    const hand = v.hands.find((h) => h.id === p.handId);
    assert.ok(hand, 'pointable.handId joins a hand');
    assert.equal(p.id, p.handId * 10 + p.type);
    assert.ok(p.type >= 0 && p.type <= 4);
    for (const k of ['direction', 'tipPosition', 'stabilizedTipPosition', 'tipVelocity', 'carpPosition', 'mcpPosition', 'pipPosition', 'dipPosition', 'btipPosition']) assert.ok(isVec(p[k]), `pointable.${k}`);
    for (const k of ['length', 'width', 'touchDistance', 'timeVisible']) assert.ok(Number.isFinite(p[k]), `pointable.${k}`);
    assert.equal(typeof p.extended, 'boolean'); assert.equal(p.tool, false);
    assert.ok(['none', 'hovering', 'touching'].includes(p.touchZone));
    assert.deepEqual(p.tipPosition, p.btipPosition);
    assert.equal(p.bases.length, 4, 'four bones — without bases LeapJS pops its "service out of date" dialog');
    for (const b of p.bases) { assert.ok(isBasis(b)); assert.ok(Math.abs(Math.abs(det3(b)) - 1) < 0.02, 'orthonormal'); assert.equal(det3(b) < 0, hand.type === 'left'); }
  }
});

test('raw → v6: the bone basis z runs tip → base (LeapJS Bone.direction() = -z)', () => {
  const b = boneBasis([0, 200, 0], [0, 200, -40], [0, -1, 0], false);
  assert.deepEqual(b[2], [0, 0, 1]);
  assert.deepEqual(b[1], [0, 1, 0], 'y = back of the hand');
  assert.ok(det3(b) > 0);
  assert.ok(det3(boneBasis([0, 200, 0], [0, 200, -40], [0, -1, 0], true)) < 0);
});

test('raw → v6 is stateful where the protocol is: timeVisible grows, tipVelocity is a finite difference, a lost hand resets', () => {
  const conv = new V6Converter();
  const a = mockFrame(1.0, 1), b = mockFrame(1.1, 2);
  conv.convert(a, 1_000_000);
  const v = conv.convert(b, 1_100_000);
  assert.equal(v.hands[0].timeVisible, 0.1);
  const tip0 = a.hands[0].f[1][4], tip1 = b.hands[0].f[1][4], got = v.pointables.find((p) => p.id === 11).tipVelocity;
  for (let i = 0; i < 3; i++) assert.ok(Math.abs(got[i] - (tip1[i] - tip0[i]) / 0.1) < 0.6);
  conv.convert({ t: 'f', id: 3, fps: 60, hands: [] }, 1_200_000);
  assert.equal(conv.convert(mockFrame(1.3, 4), 1_300_000).hands[0].timeVisible, 0, 'a hand that left and came back starts over');
});

test('v6 header, device events, protocol paths', () => {
  assert.deepEqual(v6Header('5.20.0'), { serviceVersion: '5.20.0', version: 6 });
  assert.equal(v6Header('x', 7).version, 6, 'LeapJS throws on > 6');
  assert.equal(v6Header('x', 3).version, 3);
  assert.deepEqual(deviceEvent({ device: 'LE51', service: true }).event, { type: 'deviceEvent', state: { attached: true, streaming: true, id: 'LE51', type: 'Peripheral', service: true } });
  assert.equal(deviceEvent({ device: null, service: false }).event.state.streaming, false);
  assert.equal(protocolOfPath('/v6.json'), 6); assert.equal(protocolOfPath('/v7.json'), 7);
  assert.equal(protocolOfPath('/raw'), null); assert.equal(protocolOfPath('/v6.jsonx'), null);
});

test('handsOf reads both formats into the same hand', () => {
  const raw = mockFrame(2.0, 1);
  const a = handsOf(raw), b = handsOf(rawToV6(raw, 1));
  assert.equal(a.length, 2); assert.equal(b.length, 2);
  for (let i = 0; i < 2; i++) {
    for (const k of ['side', 'pinch', 'grab', 'palm', 'normal', 'direction', 'width', 'elbow', 'wrist']) assert.deepEqual(b[i][k], a[i][k], k);
    assert.deepEqual(b[i].fingers, a[i].fingers);
    assert.deepEqual(b[i].extended, a[i].extended);
  }
  assert.deepEqual(handsOf({}), []); assert.deepEqual(handsOf(null), []);
});

// ───────────── normalization ─────────────

test('normalization: interaction box → 0..1 (clamped), LeapJS angles', () => {
  assert.deepEqual(normalizePoint([0, 200, 0]), [0.5, 0.5, 0.5]);
  assert.deepEqual(normalizePoint([1000, -1000, 1000]), [1, 0, 1]);
  const u = normalizePoint([1000, 0, 0], INTERACTION_BOX, false);
  assert.ok(u[0] > 1, 'unclamped on request');
  const flat = handAngles([0, 0, -1], [0, -1, 0]);
  assert.deepEqual([flat.pitch, flat.yaw, flat.roll].map((x) => Math.round(x * 1e6) / 1e6), [0, 0, 0]);
  assert.ok(Math.abs(handAngles([0, 1, 0], [0, 0, 1]).pitch - Math.PI / 2) < 1e-9, 'fingers up = pitch +π/2');
  assert.ok(handAngles([1, 0, -1], [0, -1, 0]).yaw > 0, 'fingers to the right = yaw > 0');
});

// ───────────── gestures ─────────────

test('hysteresis: starts above on, ends only below off — no chatter around a threshold', () => {
  const h = new Hysteresis(0.86, 0.5);
  const seq = [0.2, 0.85, 0.87, 0.84, 0.88, 0.6, 0.51, 0.49, 0.55, 0.9];
  assert.deepEqual(seq.map((v) => h.update(v)), [null, null, 'start', null, null, null, null, 'end', null, 'start']);
  assert.equal(h.release(), 'end'); assert.equal(h.release(), null);
  assert.throws(() => new Hysteresis(0.5, 0.6));
  assert.deepEqual(THRESHOLDS.pinch, { on: 0.86, off: 0.5 }); assert.deepEqual(THRESHOLDS.bothPinch, { on: 0.8, off: 0.5 });
});

test('gestures: per-side pinch / grab, both-hands pinch (0.8 / 0.5), a lost hand lets go', () => {
  const g = new HandGestures();
  const H = (side, pinch, grab = 0) => ({ side, pinch, grab });
  const types = (hs) => g.update(hs).map((e) => `${e.type}:${e.side}`);
  assert.deepEqual(types([H('right', 0.83), H('left', 0.82)]), ['both-pinch-start:both'], 'both > 0.8 enters, though neither single pinch has started');
  assert.deepEqual(types([H('right', 0.9), H('left', 0.82)]), ['pinch-start:right']);
  assert.deepEqual(types([H('right', 0.9), H('left', 0.6)]), [], 'both stays above the 0.5 exit');
  assert.deepEqual(types([H('right', 0.9), H('left', 0.4)]), ['both-pinch-end:both']);
  assert.deepEqual(types([H('right', 0.9, 0.85)]), ['grab-start:right']);
  assert.deepEqual(types([]), ['pinch-end:right', 'grab-end:right'], 'hand gone → its gestures end');
  assert.deepEqual(g.state, { left: { pinch: false, grab: false }, right: { pinch: false, grab: false }, both: false });
  assert.deepEqual(types([H('right', 0.81), H('left', 0.81)]), ['both-pinch-start:both']);
  assert.deepEqual(types([H('right', 0.81)]), ['both-pinch-end:both'], 'one hand leaves → both-pinch ends');
});

// ───────────── LeapInput: signals ─────────────

test('LeapInput declares every signal with a range; pulses are pulses', () => {
  const s = new Signals();
  new LeapInput({ signals: s });
  const list = leapSignals();
  assert.equal(list.length, 5 + 2 * 29, "status, hands, both ×3; per side: present, x y z, pinch grab, roll pitch yaw, speed, 15 fingertips, 4 pulses");
  for (const [name, meta] of list) {
    assert.ok(s.meta.has(name), name);
    assert.match(name, /^leap\//);
    if (meta.kind === 'pulse') continue;
    assert.ok(Number.isFinite(meta.min) && Number.isFinite(meta.max) && meta.max > meta.min, name);
  }
  assert.equal(s.meta.get('leap/hand/right/roll').min, -Math.PI);
  assert.equal(s.meta.get('leap/hand/left/pinch-start').kind, 'pulse');
  for (const f of FINGERS) assert.ok(s.meta.has(`leap/hand/left/${f}/y`));
  assert.ok(!new Signals().meta.has('x') && leapSignals({ fingers: false }).every(([n]) => !/thumb|index|middle|ring|pinky/.test(n)));
});

test('LeapInput: status from the bridge, normalized hands, pulses with payloads, letting go', () => {
  const s = new Signals();
  const leap = new LeapInput({ signals: s });
  const pulses = [];
  s.onAny((n, v, m) => { if (m.kind === 'pulse') pulses.push([n, v]); });
  leap.ingest(v6Header('5.20.0'));
  assert.equal(leap.status, 'bridge'); assert.equal(s.get('leap/status'), 1);
  leap.ingest(deviceEvent({ device: null, service: false }));
  assert.equal(leap.status, 'no-service'); assert.equal(s.get('leap/status'), 1);
  leap.ingest(deviceEvent({ device: null, service: true }));
  assert.equal(leap.status, 'no-device'); assert.equal(s.get('leap/status'), 2);
  leap.ingest(deviceEvent({ device: 'LE51', service: true }));
  assert.equal(leap.status, 'tracking'); assert.equal(s.get('leap/status'), 3); assert.equal(leap.device, 'LE51');

  const conv = new V6Converter();
  for (let i = 0; i <= 120; i++) leap.ingest(conv.convert(mockFrame(1 + i / 60, i), 1e6 + i * 16667));   // t = 1 … 3 s
  assert.equal(s.get('leap/hands'), 2);
  assert.equal(s.get('leap/hand/right/present'), 1);
  for (const n of ['x', 'y', 'z', 'pinch', 'grab', 'speed', 'index/x', 'thumb/z']) {
    const v = s.get(`leap/hand/right/${n}`); assert.ok(v >= 0 && v <= 1, `${n} = ${v}`);
  }
  assert.ok(Math.abs(s.get('leap/hand/right/roll')) < Math.PI);
  assert.ok(s.get('leap/both/distance') > 0);
  const start = pulses.find(([n]) => n === 'leap/hand/right/pinch-start');
  assert.ok(start, 'the mock right hand pinches between t = 1.5 and 2.55');
  assert.deepEqual(Object.keys(start[1]), ['side', 'x', 'y', 'z', 'strength']);
  assert.ok(start[1].strength > 0.86);
  assert.ok(pulses.some(([n]) => n === 'leap/hand/right/pinch-end'));
  assert.equal(leap.hand('left').side, 'left');
  assert.equal(leap.frames, 121);

  leap.ingest(conv.convert({ t: 'f', id: 999, fps: 60, hands: [] }));
  assert.equal(s.get('leap/hands'), 0);
  assert.equal(s.get('leap/hand/right/present'), 0);
  assert.equal(s.get('leap/hand/right/pinch'), 0, 'a lost hand lets go');
  assert.equal(leap.hand('right'), null);
});

test('LeapInput reads the raw format too (url …/raw)', () => {
  const s = new Signals();
  const leap = new LeapInput({ signals: s, url: 'ws://127.0.0.1:6437/raw' });
  leap.ingest({ t: 'status', service: true, device: 'mock' });
  assert.equal(leap.status, 'tracking');
  leap.ingest(mockFrame(2.0, 1));
  assert.equal(s.get('leap/hands'), 2);
  assert.ok(s.get('leap/hand/right/pinch') > 0.86);
});

// ───────────── the bridge, for real ─────────────

function spawnBridge(args = []) {
  const p = spawn(process.execPath, [BRIDGE, '--mock', '--port', '0', '--quiet', ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
  const ready = new Promise((resolve, reject) => {
    let buf = '';
    p.stdout.on('data', (d) => { buf += d; const i = buf.indexOf('\n'); if (i >= 0) { try { resolve(JSON.parse(buf.slice(0, i))); } catch (e) { reject(e); } } });
    p.on('exit', (c) => reject(new Error('bridge exited ' + c)));
  });
  return { p, ready };
}

function collect(url, { n = 5, send = [], timeoutMs = 4000 } = {}) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const got = [];
    const t = setTimeout(() => { ws.close(); reject(new Error(`timeout: ${got.length} messages from ${url}`)); }, timeoutMs);
    ws.onopen = () => { for (const m of send) ws.send(m); };
    ws.onmessage = (m) => { got.push(JSON.parse(m.data)); if (got.length >= n) { clearTimeout(t); ws.close(); resolve(got); } };
    ws.onerror = (e) => { clearTimeout(t); reject(new Error('ws error ' + (e.message || url))); };
  });
}

test('bridge --mock: LeapJS handshake on /v6.json, device event, frames ≤ 60 Hz; client messages never break it', async () => {
  const { p, ready } = spawnBridge();
  try {
    const { port, source } = await ready;
    assert.equal(source, 'mock');
    const send = ['{"enableGestures":true}', '{"background":true}', '{"focused":true}', '{"optimizeHMD":false}', 'not json'];
    const msgs = await collect(`ws://127.0.0.1:${port}/v6.json`, { n: 12, send });
    assert.deepEqual(msgs[0], { serviceVersion: 'mock', version: 6, bridge: 'open-audiovisual' });
    assert.equal(msgs[1].event.type, 'deviceEvent');
    assert.equal(msgs[1].event.state.streaming, true);
    const frames = msgs.slice(2);
    assert.ok(frames.every((f) => Array.isArray(f.hands) && Array.isArray(f.pointables) && f.interactionBox));
    assert.equal(frames.at(-1).hands.length, 2);
    const ids = frames.map((f) => f.id);
    assert.deepEqual(ids, [...new Set(ids)].sort((a, b) => a - b), 'each frame once, in order');
    const v7 = await collect(`ws://127.0.0.1:${port}/v7.json`, { n: 1 });
    assert.equal(v7[0].version, 6, '/v7.json is answered as v6');
    const v3 = await collect(`ws://127.0.0.1:${port}/v3.json`, { n: 2 });
    assert.equal(v3[0].version, 3); assert.ok(Array.isArray(v3[1].hands), 'no device events below v5');
  } finally { p.kill(); }
});

test('bridge --mock: /raw is The Last Input format verbatim (status line, then frames); SSE /hands; /health', async () => {
  const { p, ready } = spawnBridge();
  try {
    const { port } = await ready;
    const msgs = await collect(`ws://127.0.0.1:${port}/raw`, { n: 4 });
    assert.deepEqual(msgs[0], { t: 'status', service: true, device: 'mock' });
    for (const f of msgs.slice(1)) {
      assert.deepEqual(Object.keys(f), ['t', 'id', 'fps', 'hands']);
      assert.deepEqual(Object.keys(f.hands[0]), ['id', 'side', 'conf', 'pinch', 'grab', 'palm', 'vel', 'n', 'dir', 'w', 'f', 'ext', 'arm']);
    }
    const res = await fetch(`http://127.0.0.1:${port}/hands`);
    assert.equal(res.headers.get('content-type'), 'text/event-stream');
    const reader = res.body.getReader();
    let text = '';
    while ((text.match(/^data: /gm) || []).length < 3) text += new TextDecoder().decode((await reader.read()).value);
    await reader.cancel();
    const lines = text.split('\n').filter((l) => l.startsWith('data: ')).map((l) => JSON.parse(l.slice(6)));
    assert.equal(lines[0].t, 'status'); assert.equal(lines[1].t, 'f');
    const h = await (await fetch(`http://127.0.0.1:${port}/health`)).json();
    assert.equal(h.ok, true); assert.equal(h.source, 'mock'); assert.equal(h.service, true); assert.equal(h.device, 'mock');
    assert.equal(h.hands, 2); assert.ok(h.frames > 0); assert.equal(h.port, port);
    const pre = await fetch(`http://127.0.0.1:${port}/health`, { method: 'OPTIONS' });
    assert.equal(pre.headers.get('access-control-allow-private-network'), 'true');
    assert.equal((await fetch(`http://127.0.0.1:${port}/nope`)).status, 404);
  } finally { p.kill(); }
});

test('LeapInput ↔ bridge --mock over a real socket (Node 22 WebSocket)', async () => {
  const { p, ready } = spawnBridge();
  try {
    const { port } = await ready;
    const s = new Signals();
    const leap = new LeapInput({ signals: s, url: `ws://127.0.0.1:${port}/v6.json` }).connect();
    await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('no hands: ' + leap.status)), 4000);
      leap.onFrame(() => { if (s.get('leap/hands') === 2) { clearTimeout(t); resolve(); } });
    });
    assert.equal(leap.status, 'tracking'); assert.equal(s.get('leap/status'), 3);
    assert.equal(leap.serviceVersion, 'mock');
    leap.disconnect();
    assert.equal(leap.status, 'closed'); assert.equal(s.get('leap/status'), 0); assert.equal(s.get('leap/hands'), 0);
  } finally { p.kill(); }
});

test('bridge guards: never port 7457 (The Last Input), loopback only', async () => {
  assert.deepEqual(RESERVED_PORTS, [7457]);
  assert.throws(() => startBridge({ port: 7457, mock: true }), /The Last Input/);
  assert.throws(() => startBridge({ port: 0, host: '0.0.0.0', mock: true }), /loopback/);
  const b = await startBridge({ port: 0, mock: true });
  try { assert.ok(b.port > 0); assert.equal(b.health().source, 'mock'); } finally { await b.close(); }
});
