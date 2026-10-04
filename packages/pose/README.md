# @openav/pose

L1 input · body and hand tracking from the camera with MediaPipe Tasks Vision,
on the device; no video leaves the machine. The library and models load from a
CDN only when `enable()` is called.

```js
// in a show: the console's L1 panel gets 🖐 hands and 🕺 body buttons that call enable()
const show = await createShow({ world, modules: { hands: true, pose: true },
  routes: [{ source: 'hand/right/pinch/index', target: 'tightness', invert: true, smooth: 0.1 }] });
```

```js
import { HandTracker } from '@openav/pose';
const hands = new HandTracker({ signals });
button.onclick = () => hands.enable();      // the camera prompt needs a user gesture
// overlay, every frame: hands.skeleton(ctx, w, h);
```

## Exports

| export | signature |
|---|---|
| `PoseTracker` | `new PoseTracker({ signals = null, mirror = true })` · `enable({ videoEl } = {})` → Promise<true> · `stop()` · `skeleton(ctx, w, h, { color, lineWidth = 2 })` · `landmarks` (33 BlazePose points), `running` |
| `HandTracker` | `new HandTracker({ signals = null, mirror = true })` · `enable({ videoEl } = {})` → Promise<true> · `stop()` · `skeleton(ctx, w, h, { colorLeft, colorRight, lineWidth = 2 })` · `hands` (`[{ handed, lm }]`, 21 points each), `running` |

Without `videoEl` an off-screen `<video>` is used. `mirror` treats the webcam as a
mirror; y is flipped so 1 = raised.

Signals: `pose/present`, `pose/hand/left/x` `/y` `/v` (and `right`), `pose/hands/spread`,
`pose/height`, `pose/lean` (-1..1); `hand/left/present`, `hand/left/x` `/y`,
`hand/left/pinch/index`, `hand/left/pinch/middle`, `hand/left/spread` (and `right`; pinch
0 = touching, normalized by palm size) · [Signals reference](https://openaudiovisual.com/docs/#signals-openav-pose).

Full reference: [docs](https://openaudiovisual.com/docs/#packages-openav-pose)
