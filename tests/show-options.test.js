// @openav/show — the createShow options that are plain data: `loop` (who drives the frames) and `monitor` (the backstage feed).
// Turning them into what the Loop / MonitorFeed constructors take is pure, so it is tested here; tests/show-browser.test.js
// runs createShow itself in a real page (when Playwright is around) and example 01 / 13 are the smoke test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { loopOptions, monitorOptions } from '../packages/show/options.js';
import { Loop } from '../packages/core/index.js';
import { MonitorFeed } from '../packages/monitor/index.js';

test('createShow loop: nothing, null or "auto" is the page\'s own requestAnimationFrame loop, as before', () => {
  for (const v of [undefined, null, 'auto']) assert.deepEqual(loopOptions(v), {}, String(v));
  assert.equal(new Loop(() => {}, loopOptions('auto')).manual, false);
});

test('createShow loop: "manual" means nothing runs until you call show.loop.step(dt)', () => {
  assert.deepEqual(loopOptions('manual'), { manual: true });
  const frames = [];
  const loop = new Loop((dt) => frames.push(dt), loopOptions('manual'));
  loop.start();
  assert.equal(frames.length, 0, 'start() alone runs no frame');
  loop.step(1 / 60);
  assert.deepEqual(frames, [1 / 60]);
});

test('createShow loop: an object goes to the Loop as it is — a fake clock and raf for a test or a frame pump, maxDt', () => {
  const clock = () => 0, raf = () => 1;
  const o = loopOptions({ clock, raf, maxDt: 0.2 });
  assert.equal(o.clock, clock); assert.equal(o.raf, raf); assert.equal(o.maxDt, 0.2);
  const given = { manual: true };
  assert.notEqual(loopOptions(given), given, 'a copy: the show does not write into your object');
});

test('createShow loop: anything else is an error that says what is allowed', () => {
  for (const v of ['manul', 'fast', 60, true, ['manual']]) assert.throws(() => loopOptions(v), /loop.*'auto'.*'manual'/s, JSON.stringify(v));
});

test('createShow monitor: default (nothing, true) is the feed it always was — MonitorFeed picks the address itself', () => {
  assert.deepEqual(monitorOptions(undefined), {});
  assert.deepEqual(monitorOptions(null), {});
  assert.deepEqual(monitorOptions(true), {});
  assert.deepEqual(monitorOptions({}), {});
});

test('createShow monitor: false means no feed at all (null)', () => {
  assert.equal(monitorOptions(false), null);
});

test('createShow monitor: { url } is handed to the feed; { hz } with it', () => {
  assert.deepEqual(monitorOptions({ url: 'wss://stage.example/backstage' }), { url: 'wss://stage.example/backstage' });
  assert.deepEqual(monitorOptions({ url: 'ws://192.168.1.20:7457', hz: 5 }), { url: 'ws://192.168.1.20:7457', hz: 5 });
  const feed = new MonitorFeed(monitorOptions({ url: 'ws://192.168.1.20:7457', hz: 5 }));
  assert.equal(feed.url, 'ws://192.168.1.20:7457?role=stage');
  assert.equal(feed.hz, 5);
  assert.equal(new MonitorFeed(monitorOptions({ url: null })).url, null, 'url: null = a feed that never connects');
});

test('createShow monitor: a url that is not a string, or a value that is not false / true / an object, throws', () => {
  assert.throws(() => monitorOptions({ url: 7457 }), /monitor.*url/s);
  assert.throws(() => monitorOptions({ url: ['ws://x'] }), /monitor.*url/s);
  assert.throws(() => monitorOptions({ url: 'localhost:7457' }), /ws:\/\/|wss:\/\//, 'a url a WebSocket cannot open');
  for (const v of ['off', 'ws://x:7457', 0, 1, []]) assert.throws(() => monitorOptions(v), /monitor/, JSON.stringify(v));
});

test('createShow monitor: no feed → no WebSocket (the feed is the only thing that opens one)', async () => {
  const sockets = [];
  const Native = globalThis.WebSocket;
  globalThis.WebSocket = class { constructor(u) { sockets.push(u); } };
  try {
    const off = monitorOptions(false);
    const feed = off ? new MonitorFeed(off) : null;
    feed?.connect();
    assert.equal(feed, null);
    assert.deepEqual(sockets, []);
    const on = new MonitorFeed(monitorOptions({ url: 'ws://127.0.0.1:7457' }));
    on.connect();
    assert.deepEqual(sockets, ['ws://127.0.0.1:7457?role=stage']);
    clearTimeout(on._retryTimer);
  } finally { if (Native) globalThis.WebSocket = Native; else delete globalThis.WebSocket; }
});

test('createShow: the source wires loop, monitor and console options to these functions, and the M key to the console', () => {
  const src = fs.readFileSync(new URL('../packages/show/index.js', import.meta.url), 'utf8');
  assert.match(src, /new Loop\([\s\S]*loopOptions\(/, 'the Loop is built from the loop option');
  assert.match(src, /monitorOptions\(monitorCfg\)/, 'the monitor option goes through monitorOptions');
  assert.match(src, /mountConsole\(desk, app, consoleOpts\)/, 'console options reach mountConsole');
  assert.ok(!/addEventListener\('keydown'/.test(src), 'no second, hard-coded keydown listener in createShow: every shortcut lives in the console');
  assert.match(src, /midiPanel/, 'the console can toggle the MIDI panel (app.midiPanel)');
});
