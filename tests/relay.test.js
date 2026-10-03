import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { encodeFrame, readFrame, FrameParser, acceptKey, OP } from '../packages/relay/frames.js';
import { RoomHub, cleanRoom, cleanRole } from '../packages/relay/hub.js';
import { attachRelay } from '../packages/relay/server.js';
import { signalMeta, aliasOf, bindSignals, fileSignal, normalizeValue } from '../packages/relay/signals.js';
import { Signals } from '../packages/core/src/signals.js';

test('acceptKey matches the RFC 6455 example', () => {
  assert.equal(acceptKey('dGhlIHNhbXBsZSBub25jZQ=='), 's3pPLMBiTxaQ9kYGzzhZRbK+xOo=');
});

test('frame codec round-trips (small, 16-bit, 64-bit lengths; masked and unmasked)', () => {
  for (const n of [0, 5, 125, 126, 300, 70000]) {
    for (const mask of [false, true]) {
      const payload = Buffer.alloc(n, 'x');
      const f = readFrame(encodeFrame(payload, OP.TEXT, { mask }));
      assert.equal(f.opcode, OP.TEXT); assert.equal(f.payload.length, n); assert.ok(f.payload.equals(payload));
    }
  }
  assert.equal(readFrame(encodeFrame('hello').subarray(0, 3)), null, 'partial frame waits');
});

test('FrameParser: split chunks, coalesced frames, fragmentation, interleaved ping, size cap', () => {
  const p = new FrameParser({ maxBytes: 100 });
  const a = encodeFrame('{"a":1}', OP.TEXT, { mask: true }), b = encodeFrame('{"b":2}', OP.TEXT, { mask: true });
  const all = Buffer.concat([a, b]);
  assert.equal(p.push(all.subarray(0, 4)).length, 0);
  const got = p.push(all.subarray(4));
  assert.deepEqual(got.map((m) => m.payload.toString()), ['{"a":1}', '{"b":2}']);
  const out = [
    ...p.push(encodeFrame('hel', OP.TEXT, { fin: false })),
    ...p.push(encodeFrame('', OP.PING)),
    ...p.push(encodeFrame('lo', OP.CONT)),
  ];
  assert.deepEqual(out.map((m) => [m.opcode, m.payload.toString()]), [[OP.PING, ''], [OP.TEXT, 'hello']]);
  assert.throws(() => p.push(encodeFrame(Buffer.alloc(200))));
});

const peer = (hub, o) => { const inbox = []; const p = hub.join({ ...o, send: (s) => inbox.push(JSON.parse(s)) }); return { p, inbox, got: (t) => inbox.filter((m) => m.type === t) }; };
const sig = (name, value) => JSON.stringify({ type: 'signal', name, value, t: 1 });

test('hub: controller → runner; rooms are isolated', () => {
  const hub = new RoomHub();
  const run = peer(hub, { room: 'a', role: 'runner' });
  const ctl = peer(hub, { room: 'a', role: 'controller', id: 'p1' });
  const other = peer(hub, { room: 'b', role: 'runner' });
  hub.message(ctl.p, sig('phone/p1/tilt/x', 0.5));
  assert.equal(run.got('signal').length, 1);
  assert.equal(run.got('signal')[0].value, 0.5);
  assert.equal(other.got('signal').length, 0, 'other room hears nothing');
  assert.equal(hub.counts('a').controllers, 1);
  assert.equal(hub.counts('b').controllers, 0);
});

test('hub: runner signals reach monitors only; feedback reaches controllers; monitors are mute', () => {
  const hub = new RoomHub();
  const run = peer(hub, { role: 'runner' }), ctl = peer(hub, { role: 'controller' }), mon = peer(hub, { role: 'monitor' });
  hub.message(run.p, sig('x', 1));
  assert.equal(ctl.got('signal').length, 0); assert.equal(mon.got('signal').length, 1);
  hub.message(run.p, JSON.stringify({ type: 'feedback', name: 'surface/main/a', value: 0.2 }));
  assert.equal(ctl.got('feedback').length, 1);
  hub.message(mon.p, sig('y', 1)); hub.message(ctl.p, JSON.stringify({ type: 'feedback', name: 'z', value: 1 }));
  assert.equal(run.got('signal').length, 0, 'monitor cannot talk'); assert.equal(ctl.got('feedback').length, 1, 'controller cannot fake feedback');
});

test('hub: runner config is replayed to late joiners and forgotten when the runner leaves', () => {
  const hub = new RoomHub();
  const run = peer(hub, { role: 'runner' });
  hub.message(run.p, JSON.stringify({ type: 'config', key: 'surface', data: { layout: 1 } }));
  const late = peer(hub, { role: 'controller' });
  assert.equal(late.got('config').length, 1);
  hub.leave(run.p);
  assert.equal(peer(hub, { role: 'controller' }).got('config').length, 0);
});

test('hub: ping → pong, bad input ignored, names sanitized', () => {
  const hub = new RoomHub();
  const c = peer(hub, { role: 'controller' });
  hub.message(c.p, JSON.stringify({ type: 'ping', t: 42 }));
  assert.equal(c.got('pong')[0].t, 42);
  assert.equal(hub.message(c.p, 'not json'), null);
  assert.equal(cleanRoom('../x'), 'default'); assert.equal(cleanRoom('show-1'), 'show-1'); assert.equal(cleanRole('admin'), 'controller');
});

test('server: two real WebSocket clients, same room talk; other room isolated; ping/pong', async () => {
  const server = http.createServer(); const relay = attachRelay(server);
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;
  const open = (q) => new Promise((res) => { const ws = new WebSocket(`ws://127.0.0.1:${port}/relay?${q}`); ws.msgs = []; ws.onmessage = (e) => ws.msgs.push(JSON.parse(e.data)); ws.onopen = () => res(ws); });
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const run = await open('role=runner&room=r1'), ctl = await open('role=controller&room=r1&id=p'), far = await open('role=runner&room=r2');
  ctl.send(sig('phone/p/tilt/x', 0.25));
  ctl.send(JSON.stringify({ type: 'ping', t: 7 }));
  run.send(JSON.stringify({ type: 'feedback', name: 'surface/main/a', value: 0.9 }));
  await wait(150);
  assert.equal(run.msgs.find((m) => m.type === 'signal')?.value, 0.25);
  assert.equal(far.msgs.filter((m) => m.type === 'signal' || m.type === 'feedback').length, 0);
  assert.equal(ctl.msgs.find((m) => m.type === 'pong')?.t, 7);
  assert.equal(ctl.msgs.find((m) => m.type === 'feedback')?.value, 0.9);
  for (const w of [run, ctl, far]) w.close();
  await wait(50); relay.close(); server.close();
});

test('signals: meta table, alias, bindSignals defines pulses and aliases phone/any', () => {
  assert.deepEqual(signalMeta('phone/a/tilt/x'), { min: -1, max: 1 });
  assert.equal(signalMeta('phone/a/knock').kind, 'pulse');
  assert.equal(aliasOf('phone/ab12/tilt/x'), 'phone/any/tilt/x'); assert.equal(aliasOf('phone/any/tilt/x'), null); assert.equal(aliasOf('midi/note/on'), null);
  const signals = new Signals(); const client = {};
  bindSignals(client, signals);
  client.onSignal('phone/ab12/tilt/x', 0.4, {});
  client.onSignal('phone/ab12/knock', { strength: 1 }, { pulse: true });
  client.onSignal('midi/note/on', { note: 60 }, { pulse: true });
  assert.equal(signals.get('phone/any/tilt/x'), 0.4);
  assert.equal(signals.meta.get('phone/any/knock').kind, 'pulse');
  assert.equal(signals.get('midi/note/on').note, 60);
});

test('signals: a struck note carries both velocity spellings, whichever the sender gave', () => {
  assert.deepEqual(normalizeValue('midi/note/on', { note: 60, velocity: 127 }), { note: 60, velocity: 127, vel: 1 });
  assert.deepEqual(normalizeValue('midi/note/on', { note: 60, vel: 0.5 }), { note: 60, vel: 0.5, velocity: 64 });
  assert.deepEqual(normalizeValue('midi/minilab3/note/on', { note: 1, vel: 1 }), { note: 1, vel: 1, velocity: 127 });
  const both = { note: 60, vel: 0.2, velocity: 99 };
  assert.equal(normalizeValue('midi/note/on', both), both, 'both present: untouched (the sender knows best)');
  assert.deepEqual(normalizeValue('midi/note/off', { note: 60 }), { note: 60 });
  assert.deepEqual(normalizeValue('surface/main/pad/hit', { velocity: 3 }), { velocity: 3 }, 'other names pass through');
  assert.equal(normalizeValue('midi/note/on', 1), 1);
});

test('signals: fileSignal declares on first sight, normalizes, pulses or sets (what every receiver does)', () => {
  const s = new Signals(); const seen = [];
  s.onAny((n, v) => seen.push([n, v]));
  assert.equal(fileSignal(s, 'midi/note/on', { note: 64, velocity: 100 }), true);
  assert.equal(s.meta.get('midi/note/on').kind, 'pulse', 'known pulse name, even without msg.pulse');
  assert.equal(s.get('midi/note/on').vel, 100 / 127);
  fileSignal(s, 'phone/ab/tilt/x', 0.3, { source: 'relay' });
  assert.deepEqual([s.meta.get('phone/ab/tilt/x').min, s.meta.get('phone/ab/tilt/x').source], [-1, 'relay']);
  fileSignal(s, 'my/own/thing', 7, { pulse: true });
  assert.equal(s.meta.get('my/own/thing').kind, 'pulse');
  fileSignal(s, 'unknown/cont', 3);
  assert.equal(s.get('unknown/cont'), 3);
  assert.equal(fileSignal(s, '', 1), false); assert.equal(fileSignal(s, 'x'.repeat(129), 1), false); assert.equal(fileSignal(s, null, 1), false);
  assert.deepEqual(seen.map(([n]) => n), ['midi/note/on', 'phone/ab/tilt/x', 'my/own/thing', 'unknown/cont']);
  // bindSignals goes through the same door: a relay note with only `velocity` reaches the show with `vel`
  const t = new Signals(); const client = {};
  bindSignals(client, t);
  client.onSignal('midi/note/on', { note: 60, velocity: 64 }, { pulse: true });
  assert.equal(t.get('midi/note/on').vel, 64 / 127);
});
