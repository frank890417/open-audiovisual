# @openav/leap

L1 input · Leap Motion / Ultraleap hands → normalized signals, plus the one local bridge
that every browser page on the machine (new OAV works, lab works, and old `leap.js`
sketches from 2014–2021) reads the sensor through.

```
Leap Motion Controller 2 → Ultraleap tracking service (LeapC)
  → bridge/leap-stream      C, one JSON line per frame (mm)          ← lineage: The Last Input, feat/hand-input
  → bridge/leap-bridge.mjs  Node, zero deps, 127.0.0.1:6437, ≤ 60 Hz, latest frame only
       ├─ ws://127.0.0.1:6437/v6.json   LeapJS protocol → old leap.js sketches, LeapInput
       ├─ ws://127.0.0.1:6437/raw       raw lines (The Last Input format), also SSE GET /raw, /hands
       └─ GET /health
  → LeapInput (browser)     leap/* signals · hands for drawing · ✋ panel · mouse simulator
```

## Setup (macOS)

1. Install **Ultraleap Hand Tracking** (Gemini 5.x, https://leap2.ultraleap.com/downloads/) and
   plug the sensor in. `"/Applications/Ultraleap Hand Tracking.app/Contents/bin/leapctl" devices`
   should list it with `Tracking: true`. The LeapC SDK ships inside the app; nothing else to download.
2. Xcode command line tools (`clang`). The bridge compiles its C reader on first start and caches
   the binary outside git (`~/Library/Caches/OpenAV/leap/leap-stream-<hash>`; `node bridge/build.mjs` does it by hand).
3. Run the bridge:

```bash
node packages/leap/bridge/leap-bridge.mjs          # the sensor
node packages/leap/bridge/leap-bridge.mjs --mock   # two animated hands, no sensor (pinch every 3 s, fist, both-hands pinch every 12 s)
curl http://127.0.0.1:6437/health
```

   Or keep it running at login (launchd, KeepAlive, logs in `~/Library/Logs/OpenAV/leap-bridge.log`):

```bash
bash packages/leap/bridge/install.sh      # copies the bridge to ~/Library/Application Support/OpenAV/leap-bridge, loads the agent
bash packages/leap/bridge/install.sh --mock
bash packages/leap/bridge/uninstall.sh    # stop and remove the agent
launchctl kickstart -k gui/$(id -u)/com.openaudiovisual.leap-bridge   # restart
```

   The installed copy does not follow the repo: after pulling a newer bridge, run `install.sh` again.

## Ports

| port | who |
|---|---|
| **6437** | this bridge (the port the original Leap service used, so `leap.js` finds it unchanged) |
| 6436 | not served. LeapJS 0.6.4–1.x on an `https://` page tries `wss://127.0.0.1:6436` first, fails, and falls back to `ws://…:6437` by itself |
| 7457 | **never** — The Last Input's own hand bridge and OAV's monitor. The bridge refuses it |

The bridge binds `127.0.0.1` only (hand data never leaves the machine) and accepts any page origin,
like the original Leap service did. Options: `--port`, `--hz` (default 60), `--bin <leap-stream>`, `--quiet`,
env `LEAP_BRIDGE_PORT`, `LEAP_SDK`.

## In a show

```js
const show = await createShow({ world, modules: { leap: true },        // { url, simulate, fingers, box }
  routes: [{ source: 'leap/hand/right/y', target: 'energy', smooth: 0.12 },
           { source: 'leap/hand/right/pinch-start', target: 'burst' }] });
show.leap.hands;                     // joints in mm, for drawing the hand
show.leap.skeleton(ctx, w, h);       // or let it draw (front view; { view: 'top' })
```

The console's **L1 · Input** panel shows which link is missing (bridge → tracking service → device),
draws the hands, and has a **simulate** button: mouse = right palm, press = pinch, right-click or Alt =
fist, Shift = left hand, wheel = depth, a second finger on a touch screen = left hand. `?leap=sim` starts it.
Example: [`examples/12-leap-hands`](../../examples/12-leap-hands/).

```js
import { LeapInput } from '@openav/leap';
const leap = new LeapInput({ signals }).connect();     // default ws://127.0.0.1:6437/v6.json
leap.onStatus((s) => console.log(s));                  // connecting · bridge · no-service · no-device · tracking · simulated · closed
```

## Signals

`<side>` = `left` | `right`; `<finger>` = `thumb` `index` `middle` `ring` `pinky`. Positions are the
classic interaction box (center `[0, 200, 0]` mm, size `235 × 235 × 148` mm) normalized and clamped:
x right, y up, z toward the performer.

| signal | range | meaning |
|---|---|---|
| `leap/status` | 0..3 | 0 no bridge · 1 bridge, no tracking service · 2 service, no device · 3 tracking (or simulated) |
| `leap/hands` | 0..2 | hands in view |
| `leap/hand/<side>/present` | 0/1 | |
| `leap/hand/<side>/x` `y` `z` | 0..1 | palm |
| `leap/hand/<side>/pinch` `grab` | 0..1 | strengths; 0 when the hand is lost (a lost hand lets go) |
| `leap/hand/<side>/roll` `pitch` `yaw` | -π..π | radians, LeapJS conventions |
| `leap/hand/<side>/speed` | 0..1 | palm speed, 1 = 1 m/s |
| `leap/hand/<side>/<finger>/x` `y` `z` | 0..1 | fingertips (`fingers: false` turns these 30 off) |
| `leap/both/distance` | 0..1 | palm to palm, 1 = 40 cm |
| `leap/hand/<side>/pinch-start` `pinch-end` | pulse | `{ side, x, y, z, strength }` |
| `leap/hand/<side>/grab-start` `grab-end` | pulse | `{ side, x, y, z, strength }` |
| `leap/both/pinch-start` `pinch-end` | pulse | `{ x, y, z, distance }` at the midpoint |

### Hysteresis

Each gesture is a Schmitt trigger, so a pinch hovering at the threshold fires once, not sixty times
a second. Numbers from The Last Input (tuned on a Leap Motion Controller 2, 2026-10-05):

| gesture | starts | ends |
|---|---|---|
| one-hand pinch | > 0.86 | < 0.5 |
| both-hands pinch | both > 0.8 | either < 0.5, or a hand lost |
| grab (fist) | > 0.8 | < 0.5 |

A hand that leaves the view ends all its gestures. Override with `new LeapInput({ thresholds: { pinch: { on, off } } })`.

## Formats

**raw** (`/raw`, The Last Input's `leap-stream` line format, byte for byte; mm, +y up, +z toward the player):

```json
{"t":"status","service":true,"device":"LE51000020000097C7-6710-0000000000"}
{"t":"f","id":171366,"fps":119,"hands":[{"id":1,"side":"R","conf":1,"pinch":0.02,"grab":0,
  "palm":[x,y,z],"vel":[x,y,z],"n":[normal],"dir":[direction],"w":85,
  "f":[[metacarpal start, metacarpal end, proximal end, intermediate end, tip] × thumb→pinky],
  "ext":[1,1,1,1,1],"arm":[[elbow],[wrist]]}]}
```

**v6** (`/v6.json`; `/v7.json` answers as 6, `/v1`–`/v5.json` as asked): the LeapJS protocol. First message
`{"serviceVersion":"5.20.0","version":6,"bridge":"open-audiovisual"}`, then (v ≥ 5)
`{"event":{"type":"deviceEvent","state":{"attached","streaming","id","type","service"}}}` on every
status change, then frames with `id, timestamp (µs), currentFrameRate, hands[], pointables[],
interactionBox, gestures: [], r, s, t`. Hands carry `palmPosition, stabilizedPalmPosition, palmVelocity,
palmNormal, direction, sphereCenter, sphereRadius, pinchStrength, grabStrength, confidence, timeVisible,
palmWidth, armBasis, armWidth, elbow, wrist, r, s, t`; pointables (id = hand id × 10 + type) carry
`type 0–4, direction, tipPosition, stabilizedTipPosition, tipVelocity, length, width, extended,
touchZone, touchDistance, timeVisible, carpPosition, mcpPosition, pipPosition, dipPosition, btipPosition,
bases`. Checked against leapjs 0.6.1, 0.6.4 and 1.1.1 (Frame / Hand / Finger / Bone constructors,
`interactionBox.normalizePoint`, `hand.roll()`, `frame.translation()`, no "service out of date" dialog).
LeapC gives joints, not rotations, so bases are rebuilt from the joints and the palm normal,
`stabilized*` is a light low-pass and `tipVelocity` a finite difference. Client messages
(`enableGestures`, `background`, `focused`, `optimizeHMD`) are accepted and ignored; gestures are not
synthesized (`gestures: []`).

## In the lab (lab.cheyuwu.com)

`"modules": ["leap"]` in a work's `meta.json` → `lab.leap` (this `LeapInput`), `leap/*` in
`lab.signals`, a ✋ toolbar button (status + skeleton), `meta.params[].leap: "hand/right/y"` binds a
signal to a param (a `leap/…` ref in `meta.params[].midi` — what the workbench's learn saves — works too),
`?leap=sim` for the mouse simulator. Old lab works that load `leap.js` need nothing: they connect to
6437 themselves.

## Troubleshooting

| symptom | fix |
|---|---|
| panel says *no bridge* | start it (`node packages/leap/bridge/leap-bridge.mjs`) or `install.sh`; `curl 127.0.0.1:6437/health` |
| `/health` → `"service": false` | the Ultraleap tracking service is not running (a LaunchDaemon, KeepAlive): `sudo launchctl kickstart -k system/com.ultraleap.tracking.service`, or reinstall Ultraleap Hand Tracking |
| `"service": true, "device": null` | sensor unplugged or busy; `leapctl devices` |
| `"reader": {"error": …}` | the SDK or clang is missing; `node packages/leap/bridge/build.mjs` shows why |
| `port 6437 is already in use` | another bridge (launchd copy?) or the old Leap V2 service is running: `curl 127.0.0.1:6437/health`, `uninstall.sh` |
| hands = 0 although tracking | nothing above the sensor (it reports `hands: []` at ~120 fps); hands work best 10–40 cm above it |
| an `https://` page (lab.cheyuwu.com) gets nothing; console says `net::ERR_BLOCKED_BY_LOCAL_NETWORK_ACCESS_CHECKS` | Chrome's Local Network Access: a public site opening `127.0.0.1` needs the **`loopback-network`** permission ("apps and services on this device"). Chrome asks once per site — click *Allow*; a denied site is re-enabled in the page's site settings. Verified on Chrome 154: without it the socket is blocked, with it legacy `leap.js` works and LeapInput tracks. Mixed content is not the problem (`ws://127.0.0.1` counts as secure). A cross-origin `<iframe>` must also be given `allow="loopback-network"`; a same-origin one inherits it; a `sandbox`ed (opaque-origin) one cannot be granted it |
| a sketch moves the wrong way | LeapJS coordinates are mm with +z toward you; the signals are already normalized (y = 1 is up) |
