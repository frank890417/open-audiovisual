# @openav/monitor

Spine · the backstage monitor. The show page streams JSON snapshots (clock,
scene, world, FPS, overrides, params, signals) to a zero-dependency Node
WebSocket relay, which also serves the backstage page for a stage manager's
phone or laptop.

```bash
node packages/monitor/server.js       # or npm run monitor; port 7457
# backstage: http://<performance-machine-ip>:7457/
```

`createShow()` already streams to `ws://<page host>:7457` about 15 times a second.
For a hand-assembled show:

```js
import { MonitorFeed, snapshotOf } from '@openav/monitor';
const monitor = new MonitorFeed({ url: 'ws://192.168.1.20:7457', hz: 15 });   // both optional
monitor.connect();
// every frame:
monitor.frame(snapshotOf({ timeline, params, signals, stage, loop }, state));
```

## The work's own numbers

A work can put its own health numbers (simulation tick, drift from the wall clock, NaNs caught) on the backstage page, in a **Work** panel that stays hidden while nothing is sent. A show that sends nothing sends the same snapshot as before.

```js
// from the world: snapshotOf asks the active world, so a createShow() show needs no wiring
const world = { name: 'night', params, update() { /* … */ },
  monitor() { return { 'sim/tick': sim.tick, 'sim/drift': { v: sim.drift, min: 0, max: 0.5, warn: sim.drift > 0.2 } }; } };

// from a hand-assembled show: on the feed (asked only when a frame is sent) …
const off = monitor.extra(() => ({ 'sim/nan': nanCount }));
// … or in the snapshot
monitor.frame(snapshotOf({ timeline, params, signals, stage, loop, extra: { build: 'rehearsal-2' } }, state));
```

A value is a number, a string (80 characters at most), a boolean or `null`; `{ v, min, max, warn }` draws a meter and turns the row red. At most 64 fields, names 48 characters at most. What JSON cannot carry (`NaN`, BigInt, functions, nested objects) is dropped or becomes `null`, and a provider that throws is skipped, so a bad number never costs a frame. `monitor()` and a function `extra` are asked every frame; `monitor.extra(fn)` only when a frame goes out (about 15 a second).

## From an https page

`createShow()` does not try the monitor on an https page. A hand-assembled show on public https that connects to `ws://127.0.0.1:7457` meets Chrome's Local Network Access prompt, which covers WebSocket connections from Chrome 147 ([Chrome blog](https://developer.chrome.com/blog/local-network-access)). Press Allow, or open the page from `http://localhost`. Details: [Troubleshooting](https://openaudiovisual.com/docs/#troubleshooting-chrome-asks-about-the-local-network-or-about-apps-on-this-device).

## Exports

| export | signature |
|---|---|
| `MonitorFeed` | `new MonitorFeed({ url = 'ws://' + location.hostname + ':7457', hz = 15, extra })` · `connect()` (reconnects with a growing delay, up to 30 s) · `frame(snapshot)` (throttled to `hz`; does nothing while disconnected) · `extra(fn)` → `off()` (the work's numbers, merged into each frame that goes out) · `connected` · `onStatus = (ok) => {}` |
| `snapshotOf` | `snapshotOf({ timeline, params, signals, stage, loop, extra? }, state)` → `{ t, playing, holding, total, sceneIndex, scene, world, fps, state, overrides, signals }`, plus `extra` only when the work sent numbers (`extra`, or the active world's `monitor()`) |
| `cleanExtra` | `cleanExtra(x)` → the work's numbers made safe for JSON, or `null` when there are none |
| server | `node packages/monitor/server.js [port=7457]`: backstage page at `/`, `GET /health` → `{ ok, clients }`. The show joins as `?role=stage`; every other socket is a monitor. |

Full reference: [docs](https://openaudiovisual.com/docs/#packages-openav-monitor)
