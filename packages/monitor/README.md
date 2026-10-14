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

## From an https page

`createShow()` does not try the monitor on an https page. A hand-assembled show on public https that connects to `ws://127.0.0.1:7457` meets Chrome's Local Network Access prompt, which covers WebSocket connections from Chrome 147 ([Chrome blog](https://developer.chrome.com/blog/local-network-access)). Press Allow, or open the page from `http://localhost`. Details: [Troubleshooting](https://openaudiovisual.com/docs/#troubleshooting-chrome-asks-about-the-local-network-or-about-apps-on-this-device).

## Exports

| export | signature |
|---|---|
| `MonitorFeed` | `new MonitorFeed({ url = 'ws://' + location.hostname + ':7457', hz = 15 })` · `connect()` (reconnects with a growing delay, up to 30 s) · `frame(snapshot)` (throttled to `hz`; does nothing while disconnected) · `connected` · `onStatus = (ok) => {}` |
| `snapshotOf` | `snapshotOf({ timeline, params, signals, stage, loop }, state)` → `{ t, playing, total, sceneIndex, scene, world, fps, state, overrides, signals }` |
| server | `node packages/monitor/server.js [port=7457]`: backstage page at `/`, `GET /health` → `{ ok, clients }`. The show joins as `?role=stage`; every other socket is a monitor. |

Full reference: [docs](https://openaudiovisual.com/docs/#packages-openav-monitor)
