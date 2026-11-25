# @openav/output

L4 output (picture) · the stage on a projector, a second screen, OBS or TouchDesigner. An output window, four-corner
correction (corner-pin) with a test pattern, crops of one canvas for projectors side by side, blackout and brightness as
params, a layout file, and a clean address (`?output`) for a kiosk browser, OBS's Browser Source or TouchDesigner's Web
Render TOP. The world never knows.

One stage, rendered once, shown through windows. Many devices each drawing their own part of one canvas, placed by a photo of
the table, is [`@openav/tile`](../tile/README.md); its `homography()` takes any number of measured points, `cornerPin()` here
is one window's four corners.

```js
import { createOutputs } from '@openav/output';

const outputs = createOutputs(show, { outputs: [{ name: 'main' }], aspect: 16 / 9 });   // params at load, an L4 · Output panel
button.onclick = () => outputs.open('main');                                            // a window opens only from a click
```

In the output window: F fullscreen, E edit the four corners (drag them, or 1–4 and the arrows), G test pattern, B blackout,
H / V flip, O turn 90°, [ ] black border, R corners back. The layout is saved per output name and travels as a file:

```json
{ "format": "open-audiovisual/output@1", "outputs": { "main": { "corners": [[0.02, 0.01], [0.97, 0.03], [0.99, 0.98], [0.01, 0.96]], "flipX": false, "flipY": false, "rotate": 0, "overscan": 0, "soft": 0 } } }
```

| export | |
|---|---|
| `createOutputs(show, { outputs, aspect, panel, via, storage, align })` | declare the outputs at load; `open(name, { mode })`, `edit`, `pattern`, `lead()`, `url(name)`, `exportLayout()`, `importLayout(doc)`; `align`: `@openav/align`'s `outputsFromAlign(layout)`, the align layout's outputs, and `importLayout()` takes an align calibration |
| `openOutput(source, { name, crop, fit, mode, … })` | one output window, from a click: mode `'mirror'` (the stage's canvas, default) or `'page'` (the same page again, following) |
| `cornerPin(corners, width, height)` · `toMatrix3d(H)` | the homography and its CSS `matrix3d` |
| `cropBox({ crop, source, box, fit })` | where a source goes so its crop fills a box |
| `OUTPUT_FORMAT` · `parseOutputLayout(doc)` | the layout file and its check |
| `outputParams(names)` | `output/<name>/blackout` and `output/<name>/brightness` |
| `outputQuery(search)` · `outputUrl(base, o)` | the clean address: `?output=front&crop=0,0,0.5,1&follow=oav-output&via=relay&play` |

Edge blending is not part of it: the four-corner part of an [`@openav/align`](../align/README.md) calibration converts into a room, its mesh, feather and masks need WebGL and stay in align. The handbook chapter, with the recipes for a projector, OBS and TouchDesigner:
[Projection and video out](https://openaudiovisual.com/docs/output/).
