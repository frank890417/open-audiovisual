# @openav/out

L4 output · web-page parameters → physical hardware through one local bridge: WLED light strips (DDP),
serial motor boards, OSC. A **watchdog** puts every channel back on a safe value when the page stops
talking, so a frozen tab never leaves a motor running.

```
page (lab.out / OutClient)
  → ws://127.0.0.1:6450/out    {"type":"set","ch":"light/1/r","v":0.5}  ·  batch  ·  hello
  → bridge/out-bridge.mjs      Node, zero deps, loopback only; routes each channel by glob
       ├─ ddp       WLED, UDP 4048: light/<i>/r|g|b → an RGB buffer, ≤ 60 packets a second
       ├─ serial    /dev/cu.*: "motor/1 0.5\n" lines; device missing → status "down", retried every 2 s
       ├─ osc       UDP: "/" + channel, one float32
       ├─ udp-json  UDP: {"ch","v"} (tests, debugging)
       └─ log       stdout
  → GET /health
```

## Run it

```bash
cp packages/out/bridge/out.example.json out.json     # edit hosts / device paths
node packages/out/bridge/out-bridge.mjs --config out.json
curl http://127.0.0.1:6450/health
```

Options: `--port 6450` (0 = any free port) · `--config <json>` · `--no-watchdog` · `--quiet`; env `OUT_BRIDGE_PORT`.
Port 7457 (The Last Input / the monitor) is refused; the bridge binds `127.0.0.1` only.
Without `--config` everything goes to the `log` sink.

On a Mac that should have it at login: `bash packages/out/bridge/install.sh [--config out.json]` (a launchd user agent,
`com.openaudiovisual.out-bridge`; the config lives in `~/Library/Application Support/OpenAV/out-bridge/out.json` and is
never overwritten by a re-install) and `uninstall.sh [--purge]` to take it away.

## Config

```json
{ "channels": [
  { "match": "light/*", "sink": "ddp",  "host": "192.168.1.50", "port": 4048, "pixels": 60, "map": "rgb-index" },
  { "match": "motor/*", "sink": "serial", "path": "/dev/cu.usbmodem1101", "baud": 115200, "format": "line" },
  { "match": "osc/*",   "sink": "osc",  "host": "127.0.0.1", "port": 9000 },
  { "match": "*",       "sink": "log" }
], "safe": { "light/*": 0, "motor/*": 0.5 }, "timeoutMs": 500 }
```

- `channels`: the first rule whose `match` (a glob, `*` = anything) fits the channel name takes it. A channel no rule fits is counted and dropped.
- Channel names: `a-z A-Z 0-9 _ - . /`, up to 128 characters; values are finite numbers.
- `ddp`: `light/<i>/r|g|b`, values 0..1, pixel index from 0 (`"base": 1` to count from 1). `pixels` up to 10000, split into packets of 1440 bytes. WLED also falls back to its own effect ~2.5 s after the last packet.
- `serial`: `format` is `line` (`ch value\n`) or `json`. The baud rate is set with `stty -f <dev> <baud> raw -echo` before the port opens. A slow board gets the latest value per channel, never a queue.
- `safe`: channel glob → value. `timeoutMs` (default 500, at least 20).
- `allowOrigins` (optional): browser origins allowed to connect, e.g. `["https://lab.cheyuwu.com"]`. Without it any page on this machine can connect, as with the Leap bridge — set it when the bridge drives anything that moves.

## The watchdog

- A channel with a `safe` value that gets no value for `timeoutMs` receives it, once; a new value re-arms it.
- When the last client disconnects, every channel the bridge has seen that has a `safe` value gets it at once.
- A clean stop (SIGTERM / SIGINT) does the same before the sockets close.
- The browser client re-sends held values every `timeoutMs / 3`, so a still slider is not mistaken for a dead page. A page that freezes stops the heartbeat, and the hardware goes safe.
- Not covered: channels the bridge has never heard of (it cannot enumerate a glob), and a bridge process that is killed with SIGKILL.

## In a lab work

`"modules": ["out"]` gives `lab.out`:

```js
lab.out.set('light/1/r', 0.8);            // once per animation frame per channel: the last value wins
lab.out.batch({ 'light/1/g': 0.2, 'motor/1': 0.5 });
lab.out.status;  lab.out.onStatus((s) => …);   // 'connecting' | 'open' | 'closed' | 'sim'
lab.out.last;                             // { channel: last value }
```

Bind a param declaratively in `meta.params`: `{ "key": "glow", "min": 0, "max": 255, "out": "light/1/brightness" }`
(a string or an array). The value goes out normalized to 0..1 by min–max, or untouched with `"outRaw": true`; the
starting value is sent too. `?out=sim` records values in `lab.out.last` without a bridge, `?out=0` turns it off,
`?out=ws://host:port/out` or `meta.out.url` points at another bridge. On an https page, Chrome asks for permission
to reach `127.0.0.1`; if it is not given, a note appears after 5 seconds saying how.

## Outside the lab

```js
import { OutClient } from '@openav/out';
const out = new OutClient({ url: 'ws://127.0.0.1:6450/out', id: 'my-piece' }).connect();
out.set('light/0/r', 1);
```

Tests: `node --test tests/out.test.js` (UDP receiver + the bridge on port 0; OSC and DDP bytes; the watchdog and the
same test with the watchdog switched off).
