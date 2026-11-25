# Projector and LED alignment

A wall made of several outputs, two projectors side by side with a blend band, an LED band folded into two 4K ports, a
room corner on a splitter, is written once, as one JSON file: the layout. `@openav/align` (since 0.13.0) reads that file
three ways: the test patterns, the vendor's alignment chart, and the real output mapping of the work. All three read the
same data, so a pattern that is right on the wall means the work is right on the wall. On top of the layout goes a
calibration made by hand on the venue day: four corners, a mesh, feathered edges, masks and brightness, for each
projector. For the camera-in-the-loop alignment that will one day do this by itself, the package has the pattern
generator, channel-separated Gray code. Nothing that reads a camera is built yet. Example
[31, Align](https://openaudiovisual.com/examples/31-align/) runs all of it on one screen with no hardware.

This is not the projector window and not the tiling. [Projection and video out](output.md) is one stage shown through
output windows, four corners each. [Several screens, one canvas](tile.md) is many devices each drawing their own piece,
placed by a photo. [Output, tile and align](#output-tile-and-align) says how the three differ and how align's
calibration reaches an output window.

## The layout

The **art canvas** is the wall unrolled flat: a curved wall or a room's walls side by side become one rectangle, and the
work draws at that size. A **segment** is a rectangle of the art canvas, one physical piece of the wall. An **output** is a
rectangle of the **desktop**, the physical pixels a fullscreen browser covers (two 4K ports side by side are a desktop of
7680 × 2160). A **feed** says which segment goes into which output, and where inside it. This is the room-corner example
from `packages/align/layouts/`, two walls and the floor in front of them on one 4K output that a splitter cuts in four:

```json
{
  "format": "open-audiovisual/align@1",
  "id": "room-corner",
  "title": "Two walls meeting in a corner and the floor in front of them, three projectors on one 4K output cut 2 × 2",
  "art": { "w": 3200, "h": 1700 },
  "segments": [
    { "id": "WL", "x": 0,    "y": 0,   "w": 1600, "h": 900, "meters": { "w": 4, "h": 2.25 }, "label": "left wall",  "plan": 1 },
    { "id": "WR", "x": 1600, "y": 0,   "w": 1600, "h": 900, "meters": { "w": 4, "h": 2.25 }, "label": "right wall", "plan": 2,
      "masks": [{ "x": 1100, "y": 300, "w": 300, "h": 600, "label": "door" }] },
    { "id": "FL", "x": 0,    "y": 900, "w": 1600, "h": 800, "meters": { "w": 4, "h": 2 },    "label": "floor",      "plan": 3 }
  ],
  "outputs": [
    { "id": "O", "x": 0, "y": 0, "w": 3840, "h": 2160, "label": "4K output", "cuts": { "cols": 2, "rows": 2 } }
  ],
  "feeds": [
    { "segment": "WL", "output": "O", "x": 160,  "y": 90 },
    { "segment": "WR", "output": "O", "x": 2080, "y": 90 },
    { "segment": "FL", "output": "O", "x": 160,  "y": 1170, "rotate": 180 }
  ],
  "params": {
    "floor_turn": {
      "default": 180, "options": [0, 180], "status": "assumed",
      "note": "Which way the floor projector faces: 180 when it hangs over the open side of the room looking back at the corner.",
      "ask": "The rigger: does the floor projector face the corner or the open side?"
    }
  }
}
```

| key | |
|---|---|
| `art` | `{ w, h }` in whole pixels; `meters` only when somebody measured (a number nobody measured does not go on the wall) |
| `segments[]` | `{ id, x, y, w, h }`; optional `meters`, `color` (`'#hex'` or a dark and a light one), `cells.size`, `blend { l, r, t, b, curve, gamma }` (a blend band, art px), `masks` (a door, an opening, in the segment's own px), `label`, `plan` (the number on a floor plan) |
| `outputs[]` | `{ id, x, y, w, h }` on the desktop, never overlapping; `cuts { cols, rows }` when a splitter cuts it |
| `feeds[]` | `{ segment, output, x, y }`; `w`, `h` when the output scales (an LED processor); `rotate` 0, 90, 180, 270 clockwise; one segment into two outputs is a stack (two projectors on one picture), each feed with its own `name` and `color`; `visible` when the room sees only part of it |
| `vendor[]` | the vendor's own alignment images, `{ file, output }` or `{ file, rect }`, any number |
| `params` | the venue questions the layout was made from, each with a `default` and a `note`; `status: "assumed"` needs an `ask`: whom to ask, and what |
| `ident` | the identification screen's surfaces, their names, what is on each side, the order the band of light runs |

`validateLayout()` refuses a layout whose pixels are not whole numbers, whose segment leaves the canvas, whose outputs
overlap, whose feed names nothing or lands outside its output, with every problem at once and where it is. It warns
(accepts, but look) about a segment fed nowhere, two segments that overlap without a blend band, and metres whose pixels
per metre across and down differ by more than 2 %, which on an LED wall is nearly always one number copied wrong. Before
anything goes on the wall:

```bash
node tools/check-align-layout.mjs packages/align/layouts/room-corner.json
```

It prints the same, then where every tile lands, the stacks and blend bands, the masks, and the params still assumed with
the question to ask. A file written as `"contract": "art-align/v1"`, for the module this package grew from, loads as it is.

## One layout, three outputs

`computeMapping(layout)` turns the layout into one table of tiles, one per feed: `src` on the art canvas, `dst` on the
desktop. Three things read only that table:

1. **The test patterns.** `drawPattern(ctx, mapping, pattern)` draws `tiles` (a two-tone checkerboard per segment with
   cell names A1, B8 …, its name, size and metres, diagonals, a centre cross and circle), `grid` (a line every 100 art px,
   a heavy one every 500 with the absolute art coordinate), `edges`, `crosshair` (an ellipse means the proportions are
   wrong) and `bars` (`smpte`, `steps`, and a `ramp` across the whole canvas that shows a step between two segments of
   different brightness). Each tile is clipped to its place on the desktop and drawn in art pixels: the work's own path.
2. **The vendor's chart.** `drawChart(ctx, mapping, outputId)` draws one 1:1 image per output for the hardware or
   splitter vendor: a grid with coordinates, the splitter's cuts and the range of each, every block's size and its first
   and last pixel, its masks, which side is the art's top, and "pixel to pixel, no scaling" in the header (or a warning
   when a block scales). `vendorPlacements()` lays the vendor's own images over the outputs where the layout says they are.
3. **The output.** `blitPlan()` and `createBlitter(THREE, renderer)` copy the work's render target onto the desktop
   tile by tile, 1:1 or scaled; `createWarpRenderer(THREE)` does it through a calibration and can turn a feed.

Why that is a guarantee and not a hope: a pattern is not a picture of what the wall should look like, it is drawn through
the very tiles the work goes out through, and through the same warp (the align mode paints its patterns on the art
canvas, `drawSource()`, and hands them to the same renderer as the work). If the cells pattern sits right on the wall, the
work does. If the vendor's own image and the cells pattern disagree, the layout is wrong, not the wall: fix the file, and
the patterns, the chart and the work move together.

## The calibration

A calibration (`open-audiovisual/align-calibration@1`) holds, for each tile, a zone: its four `corners` on the desktop
(the segment's top-left, top-right, bottom-right, bottom-left, in px), a `mesh` of 2 to 9 points a side that shifts the
picture on top of that perspective (a curved or uneven surface), a `feather` on each edge (a share of the zone, for the
overlap of two projectors), a `gamma`, a `gain` and black `masks`. An uncalibrated zone is exactly the layout's mapping.
Each variant of a work's layout keeps its own zones in the same file, and a file written as `art-align-cal/v1` loads as it
is. `normalizeCalibration(file, mapping)` makes any file whole for a mapping: what cannot be read takes the default.

```js
import { computeMapping, normalizeCalibration, createWarpRenderer } from '@openav/align';

const M = computeMapping(layout);
const cal = normalizeCalibration(savedFileOrNull, M);
const warp = createWarpRenderer(THREE);                   // three.js is passed in, never imported
warp.build(M, cal.variants[M.id].zones);                  // again whenever the calibration changes
warp.draw(renderer, artTexture, { x: 0, y: 0, w: M.desktop.w, h: M.desktop.h });
```

## Calibrate by hand on the venue day

1. **Before you go.** Write the layout, run `node tools/check-align-layout.mjs` on it, answer the assumed params you can,
   and send each vendor the chart of their output (`drawChart` at the output's full size, saved as a PNG: a scaled copy is
   not a chart). Ask the LED processor and the splitter to scale nothing.
2. **Arrive.** Set the machine's displays to the layout's desktop, the same size and order, and open the work fullscreen
   across them. Show the identification screen (`ident`): every surface in its own colour with its name, which projector
   and which part of which output feeds it, what is on each side, and a band of light that runs along the walls in order.
   A wrong order or a wrong side shows here, before anything else.
3. **Pixels.** Show `tiles`. Each segment's cells must be where the vendor's chart says, the cell names readable, a stack's
   two colours mixing evenly. A cell name in the wrong place is a layout or a processor setting, not a calibration.
4. **Corners.** Enter the align mode and show `grid` or `crosshair`. For each zone (Tab, or a click), drag its four
   corners onto the surface's corners, or pick one with `[ ]` and move it with the arrows: 1 px, Shift 10, Alt 0.25. A
   corner that would fold the quad does not move.
5. **Mesh.** A surface that is not flat: G, then drag the mesh points (+ − for more or fewer).
6. **Blend.** Where two projectors overlap, show grey 50 % and feather (E) the overlapping side of each until the band
   is gone; gamma 2.2 is the usual start. Even out the brightness of a zone with `,` and `.`.
7. **Masks.** K, then N adds one, the arrows place it and Shift resizes it. A door the layout lists is already masked.
8. **Check with the work.** P back to the work, then the bars for black level (see 4 % and not 2 %), white for evenness,
   black for light leaking where nothing should be.
9. **Keep it.** Every change is saved a second later (in the browser, with the last 20 saves as backups; in an app, files
   through a bridge). X exports the file to keep with the show, I imports one, L lists the backups.

| key (align mode) | |
|---|---|
| C, G, E, K | edit corners, mesh, feather, masks |
| Tab, 1–9, click | pick a zone |
| `[` `]` | next handle (corners, mesh points, feather sides, masks) |
| arrows | move 1 px; Shift ×10, Alt ×0.25; masks: Shift resizes |
| drag, Shift+drag | a handle; the whole zone |
| + − · Q · N · , . | mesh density · turn the zone 90° · add a mask · brightness |
| P, Shift+P · V | the next picture · the next layout variant |
| O · J · Backspace | hide the frames · move the panel · the handle home (Shift: the whole zone) |
| ⌘S · ⌘Z · L · X · I · A | save · undo · backups · export · import · leave |

The panel speaks English, or Chinese with `lang: 'zh'`. The words drawn on the wall, on the chart and on the
identification screen take the same option.

## The Gray-code sequence

Gray code is how a camera can find which projector pixel lands where. Each axis of a projector needs one black-and-white
stripe frame per bit of its coordinates, `ceil(log2 size)`, each followed by its inverse (so every camera pixel gets its
own threshold, whatever the light), after one white and one black frame: a 1920 × 1200 projector is 11 + 11 bits, 46
frames. Gray code, because a camera pixel on a stripe's edge that reads one bit wrong is then one projector pixel off,
not half the picture. **Channel separation**: each projector draws only in its own colour channel, R, G or B, so three
projectors run at once and one photo of each frame measures all three. A fourth projector takes a second pass
(`channelPlan`).

`graySequence()` lists the frames, `drawGrayFrame()` draws one over the desktop. They are drawn in output pixels, never
through the calibration: what is measured is the projector itself. Example 31's Gray code button steps through them, `[`
and `]`, with each frame's name, on a scaled preview of the desktop: to shoot, draw them with `drawGrayFrame(ctx, mapping,
frame, { view: { k: 1, x: 0, y: 0 } })` on a canvas the desktop's size, fullscreen across the outputs, so every stripe is
whole projector pixels.

To shoot them: the camera on a tripod where it sees every surface, exposure, focus and white balance fixed by hand, the
room dark, every projector on; one photo per frame, in the sequence's order, named after the frame (`frameLabel()`). Do
not move the camera between frames.

## What is not built yet

The camera half. In order, what an automatic alignment would still need:

| stage | what | here |
|---|---|---|
| 0 | the camera's intrinsics and distortion, the crosstalk between colour channels | not built |
| 1 | the frames (channel-separated Gray code); then capture, a threshold per camera pixel, the camera ↔ projector correspondence | the frames and the bits → coordinate arithmetic (`decodeGrayBits`) are built; the rest is not |
| 2 | from the correspondence into the art canvas: what "right" means, right for a viewer standing here, or evenly spread on the surface (an artistic choice) | not built |
| 3 | blending: weights, a measured brightness field, black level | the layout's blend bands (`blendWeight`) and the hand-set feather are built; a measured field and black level are not |
| 4 | convergence: the residual in camera pixels as the stop condition | not built |
| 5 | save and reload: a measured result written into the same calibration file | the manual calibration file is built; a measured one is not |

Until then, the venue day above is the alignment.

## Output, tile and align

| | `@openav/output` | `@openav/tile` | `@openav/align` |
|---|---|---|---|
| for | one stage shown through output windows: a projector, a second screen, OBS | many screens lying on a table, each drawing its piece of one canvas | a wall of several outputs: projectors, LED processors, splitters, blend bands |
| measures | four corners per window, by hand | marker corners in one photo, solved | corners, mesh, feather, masks per projector, by hand; Gray-code frames for a camera (the camera half is not built) |
| writes | `open-audiovisual/output@1` | layout.json (`version: 1`) | `open-audiovisual/align@1` (the layout) and `open-audiovisual/align-calibration@1` |
| draws with | a CSS `matrix3d` homography over the mirrored canvas | a 2D or p5 transform on each screen | Canvas 2D for patterns and charts; WebGL meshes through three.js |

When one tile fills its output, an align zone's four corners and an output room are the same homography.
`zoneToRoom()` and `roomToZone()` convert one into the other, and say what the other side cannot carry: a zone's mesh,
feather, masks and gain, a room's overscan and soft edge. `outputsFromAlign(layout)` gives `@openav/output` the layout's
outputs, one window per projector showing that projector's part of the art canvas, and `createOutputs(show, { align })`
then imports the align mode's calibration file as well as its own:

```js
import { createOutputs } from '@openav/output';
import { outputsFromAlign } from '@openav/align';

const outputs = createOutputs(show, { align: outputsFromAlign(layout) });
outputs.importLayout(calibration);                        // the four corners of each projector
```

An output window is a CSS homography: a mesh, a feather or a mask needs WebGL (`createWarpRenderer`). Drawing those in
`@openav/output`'s window is the next step, not done; example 31 draws them with three.js on its own canvas.

Three packages export a `validateLayout` (surface's checks a phone control surface, tile's a layout.json, align's this
layout) and two a `normalizeLayout` (surface, align). A page that uses two imports one under another name:
`import { validateLayout as validateAlignLayout } from '@openav/align'`.

## From art-align

`@openav/align` is the alignment module art-align, made public. A work that copies art-align into its own folder can
switch its import to `@openav/align`: the documented names keep their names and arguments, its layout and calibration
files load as they are, and they are written back with the new format names. The words on the wall and the messages are
English, Chinese with `lang: 'zh'`. `createCalStore()` keeps its files under the prefix `oav-align`; while nothing is
saved there it reads art-align's `art-align/*` keys, so a calibration art-align saved is still found. Not here: the
adapters to two earlier venue implementations (`toLegacyMap`, `layoutFromQuery` and their kin), the venue test page and
its deploy tools.

## What was checked

- `tests/align.test.js`, `tests/align-warp.test.js` and `tests/align-bridge.test.js` (in `npm test`): every example
  layout valid with no warnings, and every number of each changed by one either refused or changing the mapping; a file
  in the art-align format with its extra keys mapping exactly as the new one; the patterns tile by tile, the cells, the
  blend weights adding up to 1 across a band; every coordinate of 1920 × 1200 decoded back from the Gray-code frames; the
  warp's corners, mesh and feather; the calibration file both formats; createWarpRenderer and createBlitter with a fake
  three.js; the store with a storage in memory, art-align's keys included; the chart, the identification screen; an
  align zone against `@openav/output`'s own `pinnedBox()` for every turn and flip; and that no client, venue or vendor
  name is in the package, its tests, this chapter or the example.
- Example 31 in headless Chromium 151 (Playwright 1.62), one machine, `node serve.js`, no permissions granted, three.js
  0.170.0 from jsDelivr (`packages/align/test/align-smoke.cjs`): every example layout loads with no console error, its
  identification screen and its charts drawn, one warp mesh per tile; the picture list changes the warped canvas; a corner
  dragged with the mouse in the align mode moves the zone's corner by the distance dragged and changes the rendered
  picture; after a reload the corner is where it was left; the panel reads in Chinese when the guide is set to 中文; the
  Gray-code frames step in output pixels (frame 5 of 46, X bit 2 of 11). The WebGL there is the browser's software renderer.

Not checked: a real projector, a real LED processor or splitter, a desktop of several physical outputs, the WebGL warp on
a venue machine's graphics card, the Electron bridge of `createCalStore`, and any camera.
