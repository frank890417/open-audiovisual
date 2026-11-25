# Several screens, one canvas

Phones, tablets and laptops lying flat on a table, of any size, turned any way, partly on top of each other, become one
canvas. `@openav/tile` covers each screen with small markers, finds them all in one photo taken from above, and from then
on every screen draws only its own piece of one shared picture. A dot that leaves one screen travels behind the bezel and
comes out on the next one where it would really be, at the same size. Nothing is streamed: every screen computes its own
frame from the same two things, one clock shared through the relay and one seed. Example
[30, Tile dot](https://openaudiovisual.com/examples/30-tile-dot/) is one dot and its sparks flowing across every screen.

This is not the projector chapter. [Projection and video out](output.md) is one stage, rendered once, shown through
output windows on projectors and second screens. Here many devices each render their own part of one canvas, placed by a
photo. The two can meet in one show, but neither needs the other.

## Run it with three screens

You need a computer on the same wifi as the phones (it runs the relay), three screens to tile and one more phone to take
the photo (it can be one of the three, in a second tab, before you lay it down).

1. On the computer, in the repository: `node serve.js`. It prints the address phones can reach, for example
   `http://192.168.1.20:8080`.
2. On each screen open `http://192.168.1.20:8080/examples/30-tile-dot/?room=desk` and tap **Tap to join** (fullscreen,
   and keep the screen awake). Lay the screens flat: any angle, any spacing, overlapping is fine.
3. On the camera phone open `http://192.168.1.20:8080/packages/tile/?room=desk`. Every screen appears in the list within a
   second, with its number, its pixels, and whether it is fullscreen and awake.
4. Press **Markers**: every screen turns white with black markers.
5. Press **Take photo** and photograph the table from above with every screen in the frame. Each screen needs at least four
   markers in view; a hand or another phone over the rest is fine. Straight down is best, up to about 45° works.
6. The camera page outlines what it found on the photo and draws a plan of the canvas. When every screen was placed it sends
   the layout and presses **Play**: the dot starts flowing. A screen that was missed says why in the list
   (`too-few-markers`, …): take the photo again, or press Play anyway.

Moved a screen? Markers, then a photo again. A screen that reloads keeps its place (its layout is kept on the device and
replayed by the relay) as long as its size did not change. No screens at hand: `packages/tile/?demo=1` runs the same
detection and solve on a synthetic photo of three screens under a tilted camera and compares the result with the truth.
The page of example 30 without `?room=` is one screen on its own, with the console, on its own time.

## The camera page

`packages/tile/?room=<name>` joins the room as its `runner`. It hears every screen's hello, gives each a number (its
markers, 0 to 19, remembered for that room), and answers with standing config the relay replays to a screen that joins
later: the numbers, Markers or Play, the layout, and the show's seed and start. **New start + seed** starts every screen
again together, and **layout.json** downloads the last layout.

**Take photo** (`<input capture>`) opens the phone's camera app at its full resolution and works on any address.
**Live camera** (`getUserMedia`, one frame) needs a secure context, so it works on `localhost` or `https://`, not on
`http://192.168…`. A photo larger than 4096 pixels on its long side is scaled down before detection.

The markers are found by OpenCV.js's ArUco detector (`@techstark/opencv-js@4.12.0-release.1`, a plain build of OpenCV
4.12.0, from jsDelivr, pinned). It is about 10 MB (3 MB over the wire), loaded by the camera page only and only when the
first photo comes in, then cached. The screens never load it: the bits of their markers are in `dict.js`, extracted from
OpenCV (see NOTICE), and no other page or package of the framework refers to it (`tests/tile.test.js` checks). A venue
without the internet can serve its own copy of that file and pass it to `loadOpenCV(url)`.

## In your own world

Wrap the world, route the camera page's mode to the marker param, keep the timeline on the shared clock, and draw in
canvas units through the view:

```js
import { createShow } from '@openav/show';
import { createCanvas } from '@openav/stage';
import { joinTile, tileWorld, TILE_ROUTES } from '@openav/tile';   // "@openav/tile": "../../packages/tile/index.js"

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
    const x = w / 2 + (w / 3) * Math.sin(this.t);    // a function of the shared time, never a sum of dt
    ctx.beginPath(); ctx.arc(x, h / 2, this.s.size * Math.min(w, h), 0, Math.PI * 2); ctx.fill();
  },
};
const show = await createShow({
  world: tileWorld(world, tile),
  routes: [...TILE_ROUTES],                           // tile/markers → tileMarkers
  onFrame: (dt, s) => tile.syncTimeline(s.timeline, dt),
});
tile.attach(show.signals);                            // tile/markers, tile/synced, tile/layout
```

- **Time.** Read `io.tile.time()` (shared seconds) and `io.tile.seed`. Two screens that started a second apart, or one that
  dropped a frame, must still draw the same instant, so positions are functions of time and seed, never sums of `dt`
  (example 30 samples its dot's tail back in time instead of remembering past frames). This is the one place a tiled world
  reads a clock, and it is the shared one.
- **Params** stay the world's continuous controls ([rule 1](agents.md)). `tileMarkers` is a param like any other: the camera
  page drives it through `tile/markers`, and the timeline or a knob can too. It follows the rule for
  [who holds a value](mapping.md#who-holds-a-value): a slider moved by hand on one screen's console holds that screen until
  the camera page really changes mode.
- **The view.** `view.apply2d(ctx, pixelRatio)` for a 2D canvas, `view.applyP5(sk)` at the top of a p5 `draw()`,
  `transform: view.css(devicePixelRatio)` with `transform-origin: 0 0` for an element. `view.visible(x, y, r)` skips what
  is not on this screen, `view.scale` is device pixels per canvas unit. The canvas is measured in the reference screen's
  pixels and includes the gaps and bezels.

## The shared clock

Every screen pings the relay ten times when it connects and then every 2 s. The relay already answers every ping with its
own time; `ClockSync` keeps the offset of the quickest round trip of the last minute (NTP, simplified: the error is at most
half that round trip, a few ms on home wifi). `tile.now()` is the relay's clock read on this screen, and `tile.time()` the
seconds since the camera page pressed Play. Screens refresh on their own vsync, so two of them can still be a frame apart.

`syncTimeline(timeline, dt)`, called before `timeline.advance(dt)` (createShow's `onFrame` is), puts the playhead where the
shared clock was one frame ago, so the frame lands on the shared time and fires the scenes and cues it passes; the
automation then reads the same values on every screen. The shared clock never waits, so neither does a tiled timeline: a
pause or a seek on one screen is undone on the next frame, and a `hold` scene parks it for one frame and is then released
(the next scene starts and its boundary cue fires).

This is not [`@openav/sync`](show-control.md#several-pages-one-show), and the two are kept apart on purpose:

| | `@openav/sync` | the tile clock |
|---|---|---|
| who keeps time | one leader page runs the timeline and says every frame where it is | nobody: every screen asks the relay what time it is |
| what travels | the leader's playhead (`T`, playing, holding, rate, cut) every frame, and `extra` data | nothing per frame: each screen's hello once a second and a ping every 2 s; the layout and the start once, as config |
| pause, hold, seek | copied by every follower | not shared: undone on the next frame, a hold released |
| when a page drops out | a follower that loses the leader runs on by itself (`timeline.follow()`) | the camera page can close: the screens play on |
| for | several pages of one show at their own sizes: a wall of outputs, a lobby, a rehearsal laptop | one canvas cut into pieces, every piece drawn from (time, seed) |

Nothing in the framework joins the two, and they have not been tried together on one page.

## How a photo becomes a layout

Every screen lies in one plane, the table, and its pixels are evenly spaced on it, so "screen pixels → table" is a
similarity (a turn, a uniform scale, a shift) for every screen, whatever its pixel density. The camera adds one perspective,
"table → photo", the same for all of them. So each screen's homography `H_i` (screen pixels → photo) is `G · S_i`, and
`H_ref⁻¹ · H_i = S_ref⁻¹ · S_i` is a similarity: the camera's perspective cancels, and a phone's 460 ppi against a laptop's
227 ppi ends up in the scale. `solveLayout()`:

1. per screen, a normalized DLT homography from all its marker corners. A marker whose corners land far from it is dropped
   once (a misread id). Fewer than 4 markers: the screen is reported as `too-few-markers`, not solved, and nothing throws;
2. the reference is the screen that covers the most of the photo; each other screen's similarity is a least-squares fit of
   its own corners to its photo corners taken back through `H_ref⁻¹`;
3. one plane `G` and every `S_i` are refined together by Levenberg–Marquardt, so the perspective is measured by every
   marker on the table (it keeps a screen far from the reference right);
4. the canvas is moved so the union of the screens starts at (0, 0).

Each screen carries 50 markers of DICT_5X5_1000 (id = screen × 50 + cell, so up to 20 screens), four across its short side.
Five by five, not four by four: two of these markers differ in at least 5 bits under rotation, and a misread id puts four
corners on the wrong screen. The result, `layout.json`:

```json
{ "version": 1, "kind": "planar", "units": "reference-px", "reference": "laptop",
  "canvas": { "w": 5280.0505, "h": 3638.0105 }, "photo": { "w": 3200, "h": 2400 },
  "plane": { "matrix3x3": [0.7079, -0.0529, 398.39, 0.2351, 0.7367, -418.12, 0.0000477, 0.0000618, 1] },
  "devices": [ { "id": "phone", "index": 2, "w": 1170, "h": 2532, "kind": "planar",
    "similarity": { "a": 0.409166122, "b": 0.275927653, "tx": 2417.846331, "ty": 2279.166552 },
    "matrix3x3": [0.409166122, -0.275927653, 2417.846331, 0.275927653, 0.409166122, 2279.166552, 0, 0, 1],
    "rms": 0.1388, "markers": 36, "pose": null } ] }
```

`similarity` maps a screen's pixel to the canvas, `matrix3x3` is the same matrix row by row, `rms` the reprojection error in
photo pixels; `validateLayout()` lists every problem of a file, one message each. A device of `"kind": "window"` with a
`"pose"` is the room kept for the next step, a screen posed in 3D (a laptop standing up, a screen on a wall, a projector):
this version validates it and its view says it cannot draw it yet.

## The relay messages

A tile is a `controller` in a relay room and the camera page is its `runner`; the hub in `packages/relay` is unchanged.

| from | name | what |
|---|---|---|
| tile | signal `tile/<id>/hello` | `{ id, w, h, dpr, screen, css, fullscreen, wake }`, re-sent every second |
| camera | config `tile/roster` | `{ grid, devices: [{ id, index, w, h }] }`: each screen's number |
| camera | config `tile/mode` | `'markers'` or `'show'` |
| camera | config `tile/layout` | layout.json |
| camera | config `tile/show` | `{ seed, start }`: the start on the shared clock |

Into the show's signals: `tile/markers` (0 or 1, the camera page's mode), `tile/synced` (0 or 1) and the pulse `tile/layout`.
On a static host (openaudiovisual.com) there is no relay: run `node serve.js`, or point every page at one with
`?relay=wss://…`. The relay has no authentication: use a closed network and a room name nobody will guess
([Security](remote.md#security)).

## Known limits

- **iPhone Safari cannot make a page fullscreen.** Add the page to the home screen and open it from there. Without
  fullscreen it still works, but the browser bars become part of the bezel and change size when they hide, which unplaces
  the screen until the next photo.
- **Keeping the screen on is the system setting's job** (iPhone: Auto-Lock, Never; Android: Screen timeout). The wake lock
  is a backup: it needs the tap, the system drops it when the page is hidden (the ⛶ button asks again), and browsers offer
  it only on `https://` or `localhost` (on `http://192.168…` the camera page lists it as `n/a`).
- **Flat screens only.** A laptop standing up does not lie in the table's plane: lay it flat or wait for the 3D model.
- Overlapping screens: which one is on top is not known, so the one underneath also draws the part that is covered.
- A screen that changes size (a rotation, the address bar) draws on its own until the next photo.
- A param moved by hand on one screen's console changes that screen only; what is shared is the timeline, the clock and the
  seed. The timeline cannot be paused or held on a tile: it follows the shared clock.
- Up to 20 screens. Glossy screens reflect lamps: turn the brightness up and avoid a light right above the table.
- Two tabs of one browser share an id (it is kept in `localStorage`): add `&id=a`, `&id=b` when trying it on one computer.

## What was checked

On one machine, with no screens but browser contexts and no hardware at all:

- `tests/tile.test.js` (in `npm test`): the DLT and the similarity fit against known transforms with 0.5 px of noise; the
  solve on synthetic photos (a pinhole camera, real screen sizes and densities) for two and three screens, with 4 markers and
  with fewer, a misread marker, with and without the refinement; a dot crossing screens stays continuous; layout.json
  validation; marker ids, the grid and the dictionary; the view's matrices; the clock; `syncTimeline` through scenes, a cue,
  a hold scene, a pause and a seek; the `tileMarkers` route under the rule for who holds a value; and that only the camera
  page can reach OpenCV.
- `packages/tile/test/tile-smoke.cjs`, by hand, in headless Chromium with the pinned OpenCV.js from jsDelivr: example 30
  alone with no console errors; the camera page's `?demo=1` placing its three synthetic screens within 0.2°, 0.5 % and 2 px
  of the truth; then a live room over `node serve.js` of three tile pages the size of a laptop, a tablet and a phone, whose own
  screenshots make the photo the camera page detects and solves: every tile placed within 1 mm of where it lies, the dot
  continuous across them, their clocks and their timelines agreeing.

Never tried yet: phones and tablets on a real table, a real photo (reflections, light, the angle, a phone small in the
frame), fullscreen and the wake lock on an iPhone or an Android phone, the clock over a real wifi, and a 12 MP photo's
detection time on a phone. The README of the package lists what to look at when it is.
