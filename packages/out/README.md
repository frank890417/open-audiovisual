# @openav/out

L4 output · web-page parameters → physical hardware through one local bridge: WLED light strips (DDP),
serial motor boards, OSC, and DMX lighting (Art-Net, sACN, an Enttec DMX USB Pro). A **watchdog** puts
every channel back on a safe value when the page stops talking, so a frozen tab never leaves a motor running.

```
page (lab.out / OutClient)
  → ws://127.0.0.1:6450/out    {"type":"set","ch":"light/1/r","v":0.5}  ·  batch  ·  hello
  → bridge/out-bridge.mjs      Node, zero deps, loopback only; routes each channel by glob
       ├─ ddp       WLED, UDP 4048: light/<i>/r|g|b → an RGB buffer, ≤ 60 packets a second
       ├─ serial    /dev/cu.*: "motor/1 0.5\n" lines; device missing → status "down", retried every 2 s
       ├─ artnet    DMX, UDP 6454: dmx/<universe>/<address> → ArtDmx, unicast to the node, 40 Hz + 1 s keep-alive
       │            (artnet, sacn, enttec: a flash guard per channel, on by default: no channel flashes more than 3 times a second)
       ├─ sacn      DMX, UDP 5568: the same channels → E1.31, multicast 239.255.x.y (or unicast), priority, one CID
       ├─ enttec    DMX, /dev/cu.*: one universe → Enttec DMX USB Pro frames; device missing → "down", retried
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
  { "match": "dmx/*",   "sink": "artnet", "host": "2.0.0.10", "flashGuard": { "exempt": ["dmx/1/49-52"] } },
  { "match": "*",       "sink": "log" }
], "safe": { "light/*": 0, "motor/*": 0.5, "dmx/1/49": "hold", "dmx/1/51": "hold", "dmx/*": 0 }, "timeoutMs": 500 }
```

- `channels`: the first rule whose `match` (a glob, `*` = anything) fits the channel name takes it. A channel no rule fits is counted and dropped.
- Channel names: `a-z A-Z 0-9 _ - . /`, up to 128 characters; values are finite numbers.
- `ddp`: `light/<i>/r|g|b`, values 0..1, pixel index from 0 (`"base": 1` to count from 1). `pixels` up to 10000, split into packets of 1440 bytes. WLED also falls back to its own effect ~2.5 s after the last packet.
- `serial`: `format` is `line` (`ch value\n`) or `json`. The baud rate is set with `stty -f <dev> <baud> raw -echo` before the port opens. A slow board gets the latest value per channel, never a queue.
- `safe`: channel glob → value, or `"hold"` (no safe value: the channel stays where the page left it). The first glob
  that fits wins, so `{ "dmx/1/49": "hold", "dmx/*": 0 }` darkens a rig and leaves one moving head's pan alone.
  `timeoutMs` (default 500, at least 20).
- `allowOrigins` (optional): browser origins allowed to connect, e.g. `["https://lab.cheyuwu.com"]`. Without it any page on this machine can connect, as with the Leap bridge — set it when the bridge drives anything that moves.

## DMX: artnet, sacn, enttec

The page sends one channel per DMX address: `dmx/<universe>/<address>`, address 1..512 as a patch sheet counts, value
0..1 → byte 0..255 (rounded, clamped). `@openav/dmx`'s `dmxTransport('bridge', { client })` does it for you, sending
only the channels that changed. Each DMX sink keeps one 512-byte buffer per universe and sends a universe's frame on a
fixed 40 Hz tick while its values change (never sooner than 23 ms after the last one: DMX carries about 44 frames a
second), and once a second while nothing changes, because an Art-Net node or sACN receiver that hears nothing for about
2.5 s decides the source is gone. A universe that was never sent a value sends nothing.

**Which universe is which.** `dmx/1/…` is "universe 1" as people say it, and it goes out as Art-Net **Port-Address 1**
(Net 0, Sub-Net 0, Universe 1) and as **sACN universe 1**. `dmx/N/…` is Port-Address N (up to 32767) and sACN universe
N (up to 63999). Port-Address 0 is valid but deprecated by Art-Net 4; a node still set to it is reached with `dmx/0/…`
(sACN has no universe 0, so its sink ignores those). A desk that calls its first universe "1" but sends it as
Port-Address 0 (some do) is one off from this: set the node to 1, or patch the page on universe 0.

| sink | options |
|---|---|
| `artnet` | `host` (the node's IP, or a list of them; required), `port` 6454, `broadcast` (`true` to broadcast instead, see below). Sequence 1..255 per universe, 512 channels a packet. |
| `sacn` | `host` (unicast; omitted = each universe's multicast group 239.255.<hi>.<lo>), `port` 5568, `priority` 0–200 (100), `source` (the name a console shows, `"open-audiovisual"`), `interface` (the IPv4 address of the network card multicast leaves from). One CID per bridge run. A clean stop sends three "stream terminated" packets per universe after the safe values. |
| `enttec` | `path` (`/dev/cu.usbserial-…`; required), `universe` (the one universe it carries, 1), `baud` (57600; the Pro talks USB, the baud is only for the tty), `retryMs` (2000). A missing device is state `down`, retried; a slow port skips frames and never writes half of one. The widget keeps repeating the last frame on its own. |
| all three | `flashGuard`: on when omitted; `false` switches it off; `{ "maxFlashHz": 3, "exempt": ["dmx/1/49-52"] }` (see [the flash guard](#the-flash-guard)). |

**Why Art-Net is unicast by default.** Art-Net 4 says ArtDmx goes to the nodes that subscribe to a universe and is
never broadcast: 40 broadcast packets a second per universe reach every device on the network, flood slow nodes and
Wi-Fi, and stop being yours alone on a shared network. `"broadcast": true` (with `host` a broadcast address such as
`2.255.255.255`, or `255.255.255.255` when omitted) is there for an old node that only listens to broadcast, on a
network that carries nothing else.

Not here: RDM, ArtPoll discovery, ArtSync, an Enttec Open DMX (no processor: the computer would time the DMX break).
None of the three sinks has been tried with a real node, receiver or interface yet: the tests decode every packet with
`@openav/dmx`'s own decoders on loopback, and the Enttec sink writes to a stand-in port.

## The flash guard

Flashing faster than about three times a second can bring on a seizure in people with photosensitive epilepsy. All three
DMX sinks hold every channel to `maxFlashHz` (3) flashes in any second, on by default, whatever program sent the values. A
flash is counted as WCAG 2.3.1 counts one: a pair of opposing changes of 10% of full scale or more, measured from the last
turning point. Only rises are rationed: when a channel would brighten by 10% a fourth time in one second, it stays at the
value it last sent until the second has room, then goes where it was set. A fall always passes, so dark is never held back.
The safe values (the watchdog, the last page leaving, a clean stop) go out as they are, past the guard: the frame
that carries them is the whole universe as it was set, so a channel the guard was holding at that moment goes out
unguarded once too.

```json
{ "match": "dmx/1/*", "sink": "artnet", "host": "2.0.0.10", "flashGuard": { "maxFlashHz": 3, "exempt": ["dmx/1/49-52", "dmx/1/65-68"] } }
{ "match": "dmx/2/*", "sink": "sacn", "flashGuard": false }
```

**It is coarser than the page's guard, and it can hold what should pass.** The page (`@openav/dmx`'s `dmxTransport()`
with `{ patch }`) knows which channels make one light and holds a fixture's real brightness (intensity times its brightest
colour), touching only its intensity. The bridge knows no patch, so one DMX channel is the only unit it has, and a channel
is not a light:

- **16-bit pan and tilt.** During a smooth move the fine byte runs a fast sawtooth (it wraps every coarse step), which per
  channel looks like dozens of flashes a second. Held, the beam steps by up to one coarse step: example 28's head sweep
  through this guard moves its fine byte in about half of all frames and is off by up to 0.35% of the pan range, under 2°
  on a 540° head. List a head's position channels in `exempt` (`"dmx/1/49-52"`: pan, pan fine, tilt, tilt fine). The same
  goes for 16-bit dimmers in a slow fade (the error is at most 1/256 of full, rarely visible) and for any fine byte.
- **Colour mixing.** A colour that changes at the same brightness moves its red, green and blue channels up and down; a
  fast one can be held channel by channel, which bends the colour on the way. Engine colour effects are already capped at
  3 Hz, so this needs a live colour value or another program.
- **Pixels, wheels and the rest.** A pixel chase along an LED bar flashes each pixel's channels in turn, a gobo or colour
  wheel and a control channel are values, not brightness: all are held like a dimmer if they move by 10% more than three
  times a second.

`"exempt"` takes `"dmx/<universe>/<address>"` or `"dmx/<universe>/<from>-<to>"`. `"flashGuard": false` switches the
guard off for that route: do it when the page's guard (per fixture) is the one you rely on and nothing else sends DMX
through the bridge. `/health` shows each sink's `flashGuard`: `{ on, unit: "channel", maxFlashHz, exempt, held }`, where
`held` lists the channels held back in the last frame.

## The watchdog

- A channel with a `safe` value that gets no value for `timeoutMs` receives it, once; a new value re-arms it. A `"hold"`
  channel has no safe value: it keeps the last one (what a show often wants for moving heads' position).
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
same test with the watchdog switched off) and `node --test tests/dmx-out.test.js` (the DMX scheduler on a test clock,
Art-Net and sACN decoded on loopback, safe and held values, three universes through one page, Enttec on a fake port).
