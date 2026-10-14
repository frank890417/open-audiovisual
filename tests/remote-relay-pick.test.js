import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { pickRelay, isLocalHost, randomRoom, cleanRoom, relayUrlFor, phoneUrl, PUBLIC_RELAY, ROOM_KEY } from '../packages/remote/relay-pick.js';

const mem = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v), m }; };
const fixed = (n) => Array.from({ length: n }, (_, i) => i * 7 + 3);

test('local: a machine running node serve.js keeps its own relay, and the declared room', () => {
  for (const hostname of ['localhost', '127.0.0.1', '[::1]', '192.168.0.192', '10.0.0.4', '172.20.1.2', 'macbook.local']) {
    const p = pickRelay({ hostname, search: '', declared: { room: 'main' }, storage: mem() });
    assert.deepEqual([p.mode, p.url, p.room, p.shared], ['local', null, 'main', false], hostname);
  }
  assert.equal(pickRelay({ hostname: 'localhost', search: '' }).room, 'default', 'no declared room: default, as before');
  assert.equal(pickRelay({ hostname: 'localhost', search: '?room=band-2', declared: { room: 'main' } }).room, 'band-2', '?room= wins');
});

test('public: a static host gets the public relay and a random room that stays the same in this browser', () => {
  const storage = mem();
  const a = pickRelay({ hostname: 'openaudiovisual.com', search: '', declared: { room: 'main' }, storage, random: fixed });
  assert.equal(a.mode, 'public'); assert.equal(a.url, PUBLIC_RELAY); assert.equal(a.shared, true);
  assert.match(a.room, /^show-[a-z0-9]{10}$/); assert.notEqual(a.room, 'main', 'a declared room name would put every visitor in one room');
  assert.equal(storage.m.get(ROOM_KEY), a.room);
  const b = pickRelay({ hostname: 'openaudiovisual.com', search: '', storage, random: () => fixed(10).reverse() });
  assert.equal(b.room, a.room, 'the same browser keeps its room across reloads');
  const c = pickRelay({ hostname: 'frank890417.github.io', search: '', storage: mem(), random: () => fixed(10).reverse() });
  assert.notEqual(c.room, a.room, 'another browser, another room');
  assert.equal(pickRelay({ hostname: 'openaudiovisual.com', search: '?room=class-7', storage }).room, 'class-7', '?room= wins (a classroom shares one)');
  assert.equal(storage.m.get(ROOM_KEY), a.room, '…and does not overwrite the remembered one');
});

test('public: storage that throws (private window) still gives a room', () => {
  const bad = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  const p = pickRelay({ hostname: 'openaudiovisual.com', search: '', storage: bad, random: fixed });
  assert.match(p.room, /^show-/); assert.equal(pickRelay({ hostname: 'openaudiovisual.com', search: '' , random: fixed }).mode, 'public');
});

test('overrides: ?relay=wss://… is custom, ?relay=off turns it off, declared relay/url work too, junk is ignored', () => {
  assert.deepEqual(pickRelay({ hostname: 'openaudiovisual.com', search: '?relay=wss://relay.example.org/r&room=abc' }).url, 'wss://relay.example.org/r');
  const c = pickRelay({ hostname: 'openaudiovisual.com', search: '?relay=wss://relay.example.org/r', declared: { room: 'main' } });
  assert.deepEqual([c.mode, c.room, c.shared], ['custom', 'main', false], 'your own relay: your declared room');
  assert.equal(pickRelay({ hostname: 'localhost', search: '?relay=ws://192.168.1.5:7458/relay' }).mode, 'custom');
  assert.equal(pickRelay({ hostname: 'openaudiovisual.com', search: '?relay=off' }).mode, 'off');
  assert.equal(pickRelay({ hostname: 'openaudiovisual.com', search: '?relay=OFF' }).mode, 'off');
  assert.equal(pickRelay({ hostname: 'localhost', search: '', declared: { relay: false } }).mode, 'off');
  assert.equal(pickRelay({ hostname: 'openaudiovisual.com', search: '', declared: { relay: 'wss://mine.example/relay' } }).url, 'wss://mine.example/relay');
  assert.equal(pickRelay({ hostname: 'openaudiovisual.com', search: '?relay=javascript:alert(1)', random: fixed }).url, PUBLIC_RELAY, 'only ws:// and wss:// are taken');
  const own = pickRelay({ hostname: 'x.example', search: `?relay=${encodeURIComponent(PUBLIC_RELAY)}`, declared: { room: 'main' }, random: fixed });
  assert.equal(own.shared, true); assert.match(own.room, /^show-/, 'naming the public relay by hand is still the public relay: random room');
});

test('rooms are what the relay accepts (1–32 of [A-Za-z0-9_-])', () => {
  assert.equal(cleanRoom('my room!'), 'myroom'); assert.equal(cleanRoom(''), ''); assert.equal(cleanRoom('x'.repeat(40)).length, 32);
  assert.match(randomRoom(), /^show-[a-z0-9]{10}$/);
  assert.notEqual(randomRoom(), randomRoom());
  assert.equal(pickRelay({ hostname: 'localhost', search: '?room=%3Cb%3E' }).room, 'b', 'bad characters are stripped');
});

test('isLocalHost: LAN and loopback are local; a real domain and a public IP are not', () => {
  for (const h of ['localhost', 'app.localhost', '127.0.0.1', '10.1.2.3', '192.168.1.9', '172.16.0.1', '172.31.255.1', '169.254.1.1', '[::1]', 'fd12:3456::1', 'fe80::1', 'mac.local', '']) assert.equal(isLocalHost(h), true, h);
  for (const h of ['openaudiovisual.com', 'frank890417.github.io', '8.8.8.8', '172.32.0.1', '172.15.0.1', '192.169.0.1', 'localhost.example.com']) assert.equal(isLocalHost(h), false, h);
});

test('relayUrlFor appends what the relay needs; phoneUrl is the join link', () => {
  assert.equal(relayUrlFor(PUBLIC_RELAY, { role: 'runner', room: 'show-ab', id: 'show-1' }), 'wss://remote.cheyuwu.com/relay?role=runner&room=show-ab&id=show-1');
  assert.equal(relayUrlFor('wss://h/relay?k=1', { role: 'runner', room: 'a b', id: 'x' }), 'wss://h/relay?k=1&role=runner&room=a%20b&id=x');
  assert.equal(phoneUrl({ base: 'https://openaudiovisual.com/packages/remote/', room: 'show-ab', relay: PUBLIC_RELAY }),
    'https://openaudiovisual.com/packages/remote/?room=show-ab&relay=wss%3A%2F%2Fremote.cheyuwu.com%2Frelay');
  assert.equal(phoneUrl({ base: 'http://192.168.0.2:8080/packages/remote/', room: 'default' }), 'http://192.168.0.2:8080/packages/remote/?room=default');
});

test('wiring: createShow asks pickRelay, the join card draws a QR, the phone page accepts ?relay=', () => {
  const show = fs.readFileSync(new URL('../packages/show/index.js', import.meta.url), 'utf8');
  const host = fs.readFileSync(new URL('../packages/remote/host.js', import.meta.url), 'utf8');
  const app = fs.readFileSync(new URL('../packages/remote/app.js', import.meta.url), 'utf8');
  assert.match(show, /pickRelay\(/); assert.match(show, /pick\.mode !== 'off'/);
  assert.match(host, /qrSvg\(/); assert.match(host, /phoneUrl\(/); assert.match(host, /relayUrlFor\(/);
  assert.match(app, /q\.get\('relay'\)/);
});
