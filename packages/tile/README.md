# @openav/tile

Several screens lying on a table become one canvas. Phones, tablets and laptops, of any size, turned any way, partly
on top of each other: each one shows a page of small markers, one photo from above finds them all, and from then on
every screen draws only its own piece of one shared picture. Something that crosses from one screen to the next keeps
its position and its size; it travels behind the bezels and the gaps as if they were part of the picture.

Nothing is streamed. Every screen computes its own frame from the same two things: one clock, shared through the relay,
and one seed.

| part | file | what it does |
|---|---|---|
| tile/join | `join.js` | a screen joins a relay room (`?room=<name>`); one tap asks for fullscreen and the screen wake lock; reports its id and its real pixels (CSS size × `devicePixelRatio`) |
| tile/marker | `marker.js`, `dict.js` | covers the screen in ArUco markers (DICT_5X5_1000), each one saying "screen #n, cell #k"; the param `tileMarkers` switches markers / show |
| camera page | `index.html`, `camera.js` | `packages/tile/?room=<name>`: the list of screens, Markers / Play, take the photo, detect, solve, send the layout |
| tile/detect | `detect.js` | OpenCV.js 4.12.0 ArUco, loaded from jsDelivr on the camera page only |
| tile/solve | `solve.js` | marker corners (screen pixels ↔ photo pixels) → one similarity per screen on a shared canvas → `layout.json` (pure, tested) |
| tile/clock | `clock.js` | ping / pong with the relay; the offset of the quickest round trip (pure, tested) |
| tile/view | `view.js` | which piece of the canvas this screen draws: `setTransform` for a 2D canvas, `applyMatrix` for p5 (pure, tested) |
| tileWorld | `world.js` | any world, tiled: adds the `tileMarkers` param and hands the world `io.tile` |

Example: [examples/27-tile-dot](../../examples/27-tile-dot/) — one dot and its sparks flowing across every screen.

## Run it with three phones

You need one computer on the same wifi as the phones (it runs the relay), three screens to tile (phones, tablets, a
laptop laid flat), and one more phone to take the photo (it can be one of the three, before you lay it down: open the
camera page in a second tab).

1. On the computer, in this folder's repository:

   ```bash
   node serve.js
   ```

   It prints the address phones can reach, for example `http://192.168.1.20:8080`.

2. On each screen to tile, open

   ```
   http://192.168.1.20:8080/examples/27-tile-dot/?room=desk
   ```

   and tap **Tap to join** (fullscreen, and keep the screen awake). On an iPhone add the page to the home screen first
   and open it from there (see the limits below). Lay the screens flat on the table: any angle, any spacing, overlapping
   is fine.

3. On the camera phone, open

   ```
   http://192.168.1.20:8080/packages/tile/?room=desk
   ```

   Every screen appears in the list within a second, with its number, its pixels, and whether it is fullscreen and awake.

4. Press **Markers 標記**. Every screen turns white with black markers.

5. Press **Take photo 拍照** and photograph the table from above, every screen in the frame. Each screen needs at least
   four markers in view (a hand or another phone over the rest is fine). Straight down is best; up to about 45° works.

6. The camera page draws what it found on the photo (dashed outline = where it thinks each screen is) and a plan of the
   canvas. When every screen was placed it sends the layout and presses **Play 演出**: the dot starts flowing across
   the screens. If one was missed, the list says why (`too-few-markers`, …); retake the photo, or press Play anyway.

Moved a screen? Markers, photo again. A screen that reloads keeps its place (the layout is kept on the device and
replayed by the relay), as long as its size did not change.

No screens at hand: **`packages/tile/?demo=1`** runs the same detection and solve on a synthetic photo (three screens
under a tilted camera, drawn by the tiles' own marker code) and compares the result with the truth.

The camera page also offers **Live camera** (getUserMedia, one frame): that one needs a secure context, so it works on
`localhost` or `https://`, not on `http://192.168…`. **Take photo** works everywhere and uses the full resolution of the
phone's camera.

## In your own world

Wrap the world, route the camera page's mode to the marker param, keep the timeline on the shared clock, and draw in
canvas units through the view:

```js
import { createShow } from '@openav/show';
import { createCanvas } from '@openav/stage';
import { joinTile, tileWorld, soloView, TILE_ROUTES } from '@openav/tile';

const tile = joinTile({ room: 'desk' });            // or ?room=desk in the address
const world = {
  name: 'mine',
  params: [{ key: 'size', min: 0.01, max: 0.1, def: 0.03 }],
  init({ container }) { this.cv = createCanvas(container); },
  update(dt, state, io) { this.s = state; this.t = io.tile.time(); this.seed = io.tile.seed; },
  render() {
    const { canvas, ctx } = this.cv; this.cv.fit();
    const v = tile.view;                              // soloView(w, h) until a photo placed this screen
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height);
    v.apply2d(ctx, canvas.width / v.device.w);        // from here: canvas units (the reference screen's pixels)
    const { w, h } = v.canvas;
    const x = w / 2 + w / 3 * Math.sin(this.t), y = h / 2;   // a function of the shared time, never a sum of dt
    ctx.beginPath(); ctx.arc(x, y, this.s.size * Math.min(w, h), 0, Math.PI * 2); ctx.fill();
  },
};
const show = await createShow({
  world: tileWorld(world, tile),
  routes: [...TILE_ROUTES],                           // tile/markers → tileMarkers
  onFrame: (dt, s) => tile.syncTimeline(s.timeline, dt),
});
tile.attach(show.signals);
```

- **Time.** Read `io.tile.time()` (shared seconds) and `io.tile.seed`. Two screens that started a second apart, or one
  that dropped a frame, must still draw the same instant, so positions are functions of time, not sums of `dt`. This is
  the one place a tiled world reads a clock, and it is the shared one; `syncTimeline` puts the timeline on it too, so
  automation and scenes agree across screens.
- **Params** stay the world's continuous controls (AGENTS.md rule 1). `tileMarkers` is a param like any other: the
  camera page drives it through `tile/markers`, the timeline or a knob can too.
- **p5:** `view.applyP5(sk)` at the top of `draw()` (p5 draws in CSS pixels; the view divides by the density).
- **DOM / SVG:** an element laid out in canvas units at the top-left of the screen, with `transform-origin: 0 0` and
  `transform: view.css(devicePixelRatio)`.
- `view.visible(x, y, r)` skips what is not on this screen. `view.scale` is device pixels per canvas unit.

## The model

All screens lie in one plane, the table. A screen's pixels are evenly spaced on it, so "screen pixels → table" is a
**similarity** (a turn, a uniform scale, a shift) for every screen, whatever its pixel density. The camera adds one
perspective, "table → photo", the same for all of them. So each screen's homography `H_i` (screen pixels → photo) is
`G · S_i`, and

```
H_ref⁻¹ · H_i = S_ref⁻¹ · S_i      a similarity: the camera's perspective cancels,
                                   and a phone's 460 ppi against a laptop's 227 ppi ends up in the scale
```

`solveLayout` (solve.js):

1. per screen, a **normalized DLT** homography from all its marker corners (Hartley: centre and scale the points first;
   with pixel coordinates in the thousands the 9 × 9 system is hopeless in double precision without it). A marker whose
   corners land far from that homography is dropped once (a misread id). Fewer than 4 markers: the screen is reported
   (`too-few-markers`), not solved, and nothing throws.
2. the **reference** is the screen that covers the most of the photo; each other screen's similarity is a closed-form
   least-squares fit of its own corners to its photo corners taken back through `H_ref⁻¹`.
3. **refine:** one plane homography `G` and every `S_i` (the reference's fixed) by Levenberg–Marquardt on the
   reprojection error in the photo, so the perspective is measured by every marker on the table, not by the reference's
   alone (it matters for a screen far from the reference: `tests/tile.test.js` shows the difference).
4. the canvas is moved so the union of the screens starts at (0, 0).

### layout.json

What `packages/tile/?demo=1` sends (the phone of the three screens shown; numbers as they come out):

```json
{
  "version": 1,
  "kind": "planar",
  "units": "reference-px",
  "reference": "laptop",
  "canvas": { "w": 5280.0505, "h": 3638.0105 },
  "photo": { "w": 3200, "h": 2400 },
  "plane": { "matrix3x3": [0.707864235973, -0.052867215832, 398.390945456967, 0.235074474193, 0.736701912318, -418.116461083765, 0.000047663182, 0.000061783906, 1] },
  "devices": [
    { "id": "phone", "index": 2, "w": 1170, "h": 2532, "kind": "planar",
      "similarity": { "a": 0.409166122, "b": 0.275927653, "tx": 2417.846331, "ty": 2279.166552 },
      "matrix3x3": [0.409166122, -0.275927653, 2417.846331, 0.275927653, 0.409166122, 2279.166552, 0, 0, 1],
      "rms": 0.1388, "markers": 36, "pose": null }
  ],
  "created": 1792302787225,
  "room": "demo"
}
```

`similarity` maps a screen's pixel `(x, y)` to the canvas: `x' = a·x − b·y + tx`, `y' = b·x + a·y + ty`
(turn `atan2(b, a)`, scale `hypot(a, b)`: the phone's 0.4936 is the laptop's 227 ppi over the phone's 460); `matrix3x3` is the same, row-major, so a later kind of device can carry a
general matrix. `rms` is the reprojection error in photo pixels. `validateLayout(layout)` lists every problem, one
message each.

### Next: a screen as a window in 3D

The general model, and the same one as projection mapping: each screen is a **window posed in space** (six degrees of
freedom from PnP on its marker corners, its physical size from the pixel pitch), and each screen renders a 3D scene
with an off-axis projection through its own window. A laptop standing up, a screen on the wall and a projector all fit
it. The format is ready for it: a device with `"kind": "window"` carries `"pose"` instead of relying on the shared
plane; this version validates such a device and its view says it cannot draw it yet, without throwing. OpenCV.js,
already loaded by the camera page, has `solvePnP`.

## The relay messages

A tile is a `controller` in a relay room; the camera page is the room's `runner` (the hub in `packages/relay` is
unchanged).

| from | name | what |
|---|---|---|
| tile | signal `tile/<id>/hello` | `{ id, w, h, dpr, screen, css, fullscreen, wake }`, re-sent every second |
| camera | config `tile/roster` | `{ grid, devices: [{ id, index, w, h }] }`: each screen's number (its markers) |
| camera | config `tile/mode` | `'markers'` or `'show'` |
| camera | config `tile/layout` | layout.json |
| camera | config `tile/show` | `{ seed, start }`: the start on the shared clock |

Config is replayed by the relay to every screen that joins later. The clock: the relay already answers every ping with
its own time (`{ type: 'pong', t, server }`); `TileLink` pings ten times on connect and then every 2 s, and `ClockSync`
keeps the offset of the quickest round trip of the last minute (the error is at most half of that round trip).

## Why OpenCV.js ArUco (and not an AprilTag WASM build)

- one pinned file on jsDelivr (`@techstark/opencv-js@4.12.0-release.1`, a plain build of OpenCV's own opencv.js),
  loaded with a script tag on the camera page only, the way `@openav/pose` loads MediaPipe;
- its ArUco detector reads AprilTag families too (`DICT_APRILTAG_36h11` is in the same list), so the marker family can
  change without changing library;
- sub-pixel corner refinement is built in, and the corners are what the solver lives on;
- the next step needs `solvePnP`, which is in the same file.

The cost is size: about 10 MB (3 MB compressed), on the camera page only, cached after the first visit. The tiles never
load it: the marker bits are in `dict.js` (extracted from OpenCV by `tools/extract-dict.cjs`, checked by the tests).
DICT_5X5_1000 rather than 4×4: two 5×5 markers differ in at least 5 bits under rotation, two 4×4_1000 markers can differ
in 2, and a misread id puts four corners on the wrong screen.

## Known limits

- **iPhone Safari cannot make a web page fullscreen.** Add the page to the home screen (Share → Add to Home Screen) and
  open it from there: it then runs without the browser bars. Android Chrome and desktop browsers go fullscreen on the tap.
  Without fullscreen it still works (the screen reports the size it really has), but the browser bars become part of
  the bezel and change size when they hide, which unplaces the screen until the next photo.
- **Keeping the screen on is the system setting's job** (iPhone: Settings → Display & Brightness → Auto-Lock → Never;
  Android: Display → Screen timeout). The Screen Wake Lock is a backup: it needs the tap, the system drops it when the
  page is hidden (the ⛶ button asks again), and browsers only offer it on `https://` or `localhost` — on
  `http://192.168…` it does not exist, and the list on the camera page says `n/a`.
- **Flat screens only.** A laptop standing up (its screen vertical) does not lie in the table's plane and cannot be
  placed by this version; lay it flat (screen folded back) or wait for the 3D window model.
- Overlapping screens: the order is not known, so the screen underneath also draws the part that is covered (harmless).
- A screen that changes size (rotation, the address bar) draws on its own until the next photo; the camera page sees
  the new size within a second.
- Timing: each screen is within half its quickest round trip to the relay of the shared clock (a few ms on home wifi);
  screens refresh on their own vsync, so two screens can still be up to one frame apart.
- Params changed by hand (a console slider) change one screen only; what is shared is the timeline, the clock and the
  seed. A shared performer's desk is a next step.
- Up to 20 screens (50 markers each). Glossy screens reflect lamps: turn the brightness up and avoid a light right above.
- Two tabs of one browser share an id (it is kept in localStorage): add `&id=a`, `&id=b` when testing on one computer.
- On a static host (openaudiovisual.com) there is no relay: run `node serve.js`, or point every page at one with
  `?relay=wss://…`.

## Tests

- `npm test` runs `tests/tile.test.js`: the DLT and the similarity fit against known transforms with 0.5 px of noise;
  solveLayout on synthetic photos (pinhole camera, real screen sizes and densities) for two and three screens, with 4
  markers and with fewer, a misread marker, the refinement against no refinement; continuity of a dot across screens;
  layout.json validation; marker ids, grid and dictionary; the view's matrices; the clock.
- `packages/tile/test/tile-smoke.cjs`: end to end in headless Chromium — the camera page's demo, then a live room of
  three tile pages (laptop, tablet and phone sizes) whose own screenshots make the photo the camera page detects and
  solves; checks every tile's placement, the shared clock, and the console. Instructions at the top of the file.
- `packages/tile/tools/extract-dict.cjs --check`: `dict.js` against OpenCV's own DICT_5X5_1000.

## 中文速記

在電腦跑 `node serve.js`；每台要拼接的螢幕開 `http://<電腦 IP>:8080/examples/27-tile-dot/?room=desk`，點 **Tap to join**，平放在桌上；拍照的手機開 `http://<電腦 IP>:8080/packages/tile/?room=desk`，按「標記」，從上方拍一張每台都入鏡、每台至少露出 4 個標記的照片。全部定位成功就自動「演出」。沒有裝置時開 `packages/tile/?demo=1`。iPhone 要「加入主畫面」才能全螢幕；螢幕常亮靠系統設定（自動鎖定：永不），Wake Lock 只是保險，而且只在 https 或 localhost 有；立起來的筆電這版不支援。
