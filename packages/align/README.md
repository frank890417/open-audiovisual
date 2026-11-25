# @openav/align

How a wall is built and wired, written once as one JSON file (`open-audiovisual/align@1`), and three things that read it:
the **test patterns**, the **vendor's alignment chart**, and the **real output mapping** of the work. They read the same
data, so a pattern that is right on the wall means the work is right on the wall. On top of that, a **manual calibration**
(four corners, a mesh, feathered edges, masks, brightness) edited in an align mode and saved as a file
(`open-audiovisual/align-calibration@1`), and the **pattern generator for camera-in-the-loop alignment**: channel-separated
Gray code, each projector in its own colour channel so one photo measures them all.

Pure ES modules, no dependencies, browser and Node. three.js is passed in where WebGL is needed (`createBlitter`,
`createWarpRenderer`, `createPatternTexture`), never imported. The chapter is
[Projector and LED alignment](https://openaudiovisual.com/docs/align/); every export has an entry in the
[API reference](https://openaudiovisual.com/docs/reference/). Example: [examples/31-align](../../examples/31-align/).

```js
import { computeMapping, drawPattern, normalizeCalibration } from '@openav/align';

const layout = await (await fetch('layouts/room-corner.json')).json();
const M = computeMapping(layout);                            // one tile per feed: src on the art canvas, dst on the desktop
drawPattern(canvas.getContext('2d'), M, 'tiles');            // what the wall should show, tile by tile
const cal = normalizeCalibration(savedOrNull, M);            // one zone per tile: corners, mesh, feather, masks, gain
```

## What "automatic" means here

Built: the frames (`graySequence`, `grayBitAt`, `grayRuns`, `channelPlan`, `drawGrayFrame`, `frameLabel`) and the
bits → coordinate arithmetic (`decodeGrayBits`, `grayDecode`), tested for every coordinate of a 1920 × 1200 projector.
**Not built**: capturing the camera, reading the bits out of photos, the camera ↔ projector correspondence, solving a warp
mesh from it, the blend brightness field. Until those exist, alignment is done by hand with the align mode. The chapter's
roadmap lists them in order.

## The layout

| key | |
|---|---|
| `format` | `"open-audiovisual/align@1"` (a file with `"contract": "art-align/v1"` reads unchanged) |
| `id`, `aliases`, `title` | names; `findLayout()` looks up both |
| `art` | `{ w, h, meters? }`: the art canvas, the wall unrolled flat. The work draws at this size |
| `segments[]` | `{ id, x, y, w, h }` of the art canvas; optional `meters`, `color`, `cells.size`, `blend { l, r, t, b, curve, gamma }`, `masks [{ x, y, w, h, label }]`, `label`, `plan` |
| `outputs[]` | `{ id, x, y, w, h }` of the desktop (the physical pixels a fullscreen browser covers); never overlapping; optional `label`, `cuts { cols, rows }` (a splitter) |
| `feeds[]` | `{ segment, output, x, y }` inside the output; optional `w`, `h` (scaled), `rotate` (0, 90, 180, 270), `name`, `color`, `visible` |
| `vendor[]` | `{ file, output }` or `{ file, rect }`: the vendor's images, any number |
| `params` | the venue questions the layout was made from: `{ default, value?, options?, status: decided \| assumed, note, ask? }` |
| `ident` | the identification screen: `surfaces`, `sweep`, `sweepFloor` |

The schemas are [`align.schema.json`](align.schema.json) and [`align-calibration.schema.json`](align-calibration.schema.json).
Example layouts, all invented: [`layouts/`](layouts/) (one projector; two with a blend band; an LED band folded into two
outputs; a stacked double projection; a room corner with a splitter, a turned floor, a door mask, params and ident).
Before anything goes on the wall: `node tools/check-align-layout.mjs <layout.json>`.

## API

| area | exports |
|---|---|
| layout | `ALIGN_FORMAT` (= `CONTRACT`), `validateLayout`, `normalizeLayout`, `LayoutError`, `findLayout`, `identityLayout`, `scaleArt` |
| mapping | `computeMapping`, `blitPlan`, `composePlan`, `composeArtCanvas`, `artView`, `desktopToArt`, `artToDesktop`, `cellIdAt`, `analyzeOverlaps`, `blendWeight`, `vendorPlacements` |
| cells | `rowLabel`, `cellSizeFor`, `cellAt`, `cellRect`, `eachCell` |
| patterns | `ALIGN_PATTERNS`, `BAR_VARIANTS`, `drawPattern`, `withTile`, `highlightCell`, `drawOutputs` |
| Gray code | `grayEncode`, `grayDecode`, `bitsFor`, `graySequence`, `grayBitAt`, `decodeGrayBits`, `grayRuns`, `channelPlan`, `drawGrayFrame`, `frameLabel` |
| calibration | `CALIBRATION_FORMAT` (= `CAL_CONTRACT`), `defaultZone`, `normalizeZone`, `normalizeCalibration`, `squareToQuad`, `warpPoint`, `featherAt`, `zoneGrid`, `rotateZone`, `quadOk` |
| WebGL (THREE passed in) | `createBlitter(THREE, renderer)`, `createWarpRenderer(THREE)`, `createPatternTexture(THREE, size)` |
| venue | `PATTERN_SOURCES`, `drawSource`, `createCalStore`, `createAlignUI`, `drawChart`, `drawIdent`, `drawIdentBase`, `drawIdentLive`, `normalizeAlignArgs` |

The words drawn on the wall, on the chart and in the align panel are English, or Chinese with `lang: 'zh'`.

## From art-align

This package is the alignment module art-align, made public. A work that vendors art-align can switch its
import to `@openav/align`: every name in the table above keeps its name and its arguments, and its layout and calibration
files load as they are (`art-align/v1`, `art-align-cal/v1`). What changes:

- files are written with `"format"` and the new names; `computeMapping()` says `format`, not `contract`;
- messages are English, and the drawn words take `lang`;
- `createCalStore()`'s default localStorage prefix is `oav-align`; while nothing is saved there it reads art-align's
  `art-align/*` keys (never writing them), so a calibration saved by art-align is found;
- not here: the adapters to two earlier venue implementations (`toLegacyMap`, `fromLegacyMap`, `parseLegacySpec`,
  `layoutFromQuery`, `mapModeFromQuery`), the venue test page and its deploy tools, and the helpers that were not API
  (`rowIndex`, `cellName`, `paramValues`, `blendAlpha`, `MESH_MIN` …, still in their files).

## How it relates to output and tile

| | `@openav/output` | `@openav/tile` | `@openav/align` |
|---|---|---|---|
| for | one stage shown through output windows (a projector, OBS) | many screens each drawing their piece of one canvas | a wall of several outputs: projectors, LED processors, splitters |
| measures | four corners per window, by hand | marker corners in one photo, solved | corners, mesh, feather, masks by hand; Gray-code frames for a camera (camera half not built) |
| file | `open-audiovisual/output@1` | layout.json (`version: 1`) | `open-audiovisual/align@1` and `open-audiovisual/align-calibration@1` |
| draws with | a CSS `matrix3d` homography | a 2D or p5 transform per screen | Canvas 2D patterns; WebGL meshes through three.js |

For one tile that fills its output, an align zone's four corners and an output room are the same homography.
