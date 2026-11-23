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
// overlay, every frame: hands.skeleton(ctx, w, h), or hands.overlay(ctx, w, h, { video: true })
signals.on('hand/right/gesture/victory-start', () => nextScene());
```

## Exports

| export | signature |
|---|---|
| `PoseTracker` | `new PoseTracker({ signals = null, mirror = true })` · `enable({ videoEl } = {})` → Promise<true> · `stop()` · `skeleton(ctx, w, h, { color, lineWidth = 2 })` · `landmarks` (33 BlazePose points), `running` |
| `HandTracker` | `new HandTracker({ signals = null, mirror = true, gestures = true, thresholds = {} })` · `enable({ videoEl } = {})` → Promise<true> · `stop()` · `skeleton(ctx, w, h, { colorLeft, colorRight, lineWidth = 2 })` · `overlay(ctx, w, h, { video, dim, … })` · `feed(result, now)` · `hands` (`[{ handed, lm }]`, 21 points each), `features` (`{ left, right, both }`, with the raw values), `ms`, `aspect`, `thresholds`, `running` |

Without `videoEl` an off-screen `<video>` is used. `mirror` treats the webcam as a
mirror; y is flipped so 1 = raised.

Signals: `pose/present`, `pose/hand/left/x` `/y` `/v` (and `right`), `pose/hands/spread`,
`pose/height`, `pose/lean` (-1..1). Per hand (`left`, `right`): `present`, `x` `/y`, `tip/x` `/y`,
`pinch/index` `/middle`, `spread`, `thumb/index` `/middle` `/ring` `/pinky`, `openness`, `angle`,
`speed`, `pinched`, `gesture` (0–7) and `gesture/<name>` (0/1) under `hand/<side>/`; pulses
`hand/<side>/pinch-start` `/pinch-end` and `hand/<side>/gesture/<name>-start`; both hands
`hand/both/present` `/distance` `/x` `/y` `/angle` · [Signals reference](https://openaudiovisual.com/docs/#signals-openav-pose).

The hand maths and thresholds (`hand-features.js`, `HAND_DEFAULTS`) are the ones of the
TouchDesigner `hand_features` module built on torinmb/mediapipe-touchdesigner for the same course,
tuned on one performer's hands: pinch below 0.35 hand sizes (with the other fingers out), release
above 0.56; a gesture from a score of 0.5, released below 0.35; 80 ms before a new state counts.
Example 27 shows every signal and draws them on the hands.

Full reference: [docs](https://openaudiovisual.com/docs/#packages-openav-pose)
