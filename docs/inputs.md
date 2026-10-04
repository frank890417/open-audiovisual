# Inputs

Every input does one thing: publish signals. With `createShow()` you switch
inputs on in `modules`; each one is also a plain class you can use on its own.
The exact names and ranges are in the [Signals reference](signals.md).

| input | package | `modules` key | default | publishes |
|---|---|---|---|---|
| MIDI hardware | `@openav/midi` | `midi` | on (`false` turns it off) | `midi/…` |
| on-screen MIDI controllers | `@openav/midi` | `midi: { controllers }` | off | `midi/<device>/<control>` |
| on-screen piano, QWERTY, simulated performer | `@openav/keys` | `keys` | on (`false` removes it) | `midi/note/on`, `midi/note/off` |
| drum machine | `@openav/drums` | `drums` | off | `drum/…`, `midi/note/on` on channel 10 |
| microphone | `@openav/audio` | `audio` | off | `audio/…` |
| chord analysis | `@openav/chord` | `chord` | off | `chord/…` |
| body (camera) | `@openav/pose` | `pose` | off | `pose/…` |
| hands (camera) | `@openav/pose` | `hands` | off | `hand/…` |
| phones and iPads | `@openav/remote` | `remote` | off | `phone/…`, `surface/…`, `midi/note/…` |

Sources that need permission or a user gesture (microphone, camera) are created
by `createShow()` but only start when you click their button in the console's
**L1 · Input** panel: 🎤 mic, 🖐 hands, 🕺 body.

## MIDI

`createShow()` creates a `Midi` engine and calls `enable()` on startup, so the
browser may ask for MIDI permission when the page opens. Devices can be plugged
in and out during the show; the **L1 · Input** panel lists them, and unticking
one mutes it without unplugging it.

Every incoming message publishes two families of names:

- **legacy** (what most worlds use, any channel): `midi/note/on` and
  `midi/note/off` pulses, `midi/cc/<n>` (0..1), `midi/bend` (−1..1);
- **per channel**: `midi/ch/<ch>/cc/<n>`, `midi/ch/<ch>/note/<n>` (velocity 0..1
  while held, 0 on release), `midi/ch/<ch>/bend`, `midi/ch/<ch>/pressure`,
  `midi/ch/<ch>/poly/<n>`.

A note-on payload is `{ note, vel, velocity, ch, device }`: `vel` is 0..1,
`velocity` is the raw 1..127, `ch` is 1..16, `device` is the port's slug.

With **two or more devices** connected, each also publishes under its own slug
so their controls do not collide: `midi/<slug>/cc/<n>`, `midi/<slug>/note/on`,
`midi/<slug>/note/off`, `midi/<slug>/bend`. The slug comes from the port name
(`Arturia MiniLab 3` → `arturia-minilab-3`; a second identical unit gets `-2`),
so a device that drops out and comes back keeps its routes. The legacy names
keep publishing too, so a route on `midi/cc/74` hears every device.

Clock messages are ignored. Program change, transport and SysEx are not
published (SysEx access is never requested).

Using it without `createShow()`:

```js
import { Midi } from '@openav/midi';

const midi = new Midi({ signals });     // options: signals, filterOut = 'IAC', requestAccess
await midi.enable();                    // false if the browser has no Web MIDI or permission was denied
midi.devices();                         // [{ slug, name, listening }]
midi.setListening('nanokontrol2', false);
```

`filterOut` is a case-insensitive regular expression on input port names that
are ignored. The default, `'IAC'`, keeps the macOS IAC bus out, because a show
that sends MIDI out through IAC would otherwise hear itself. See
[Troubleshooting](troubleshooting.md#a-daw-on-the-iac-bus-is-not-heard) if you
want to receive from IAC. MIDI output is described in
[Show control](show-control.md#midi-output-and-panic).

### Known controllers on screen

`modules: { midi: { controllers: { profile: '<profile id>' } } }` adds an
on-screen picture of a known controller. Plug that controller in and the picture
switches to it and moves with your hands; without one, play the picture with a
mouse or a finger. Its controls publish `midi/<device>/<control>` names, and
`controllerRoutes()` writes the routes that connect them to params. The
[MIDI controllers & embedding](controllers.md) chapter covers profiles,
learning unknown devices, LED feedback and embedding; the supported devices are
on the [controllers page](https://openaudiovisual.com/controllers/).

## On-screen piano, QWERTY and the simulated performer

`@openav/keys` is on by default. It mounts a piano above the console with two
checkboxes, *keyboard* (QWERTY capture) and *simulate performance*. Options
(`modules.keys`): `base` (lowest note, default 48), `octaves` (default 2),
`sim` (show the simulate checkbox, default `true`), `capture` (show the keyboard
checkbox, default `true`).

It publishes `midi/note/on` `{ note, vel, ch: 0 }` and `midi/note/off`
`{ note, ch: 0 }`. Note the differences from hardware: `ch` is 0 and there is
no `velocity` or `device` field. A world that only reads `note` and `vel` works
with both.

- **QWERTY** (after ticking *keyboard*): `A W S E D F T G Y H U J K O L P ;` play
  17 notes a semitone apart, starting at `base`; <kbd>Z</kbd>/<kbd>X</kbd> move an octave (base stays
  between 24 and 84); <kbd>Shift</kbd> adds 20 to the velocity. While capture is
  on, the piano claims every letter key (`preventDefault`); <kbd>Space</kbd>,
  arrows and digits pass through to the console.
- **The simulated performer** (`SimPlayer`) plays a pentatonic scale an octave
  above `base`: mostly steps, sometimes leaps and triads, real rests. From code:
  `show.keys.sim.toggle(true)`.

```js
import { mountKeys, KeysPiano, SimPlayer, PIANO_KEYMAP } from '@openav/keys';

const keys = mountKeys(el, { signals, base: 48, octaves: 2 });   // → { piano, sim, update(dt), dispose() }
// call keys.update(dt) every frame (it drives the SimPlayer)
```

## Drum machine

`modules: { drums: true }` adds a 16-step, four-lane sequencer (kick, snare, hat,
clap) with patterns (*four on floor*, *breakbeat*, *half time*, *latin*,
*sparse*), a tempo slider (60–180 BPM, default 112), swing and humanized timing.
Tick *drum machine* to start it. It plays its own synthesized kit (no samples)
and publishes:

- `drum/kick`, `drum/snare`, `drum/hat`, `drum/clap`: pulses `{ level }`;
- `drum/<lane>/env`: a 0..1 envelope per lane that decays in about 0.12 s, ready
  to map straight onto a param;
- `midi/note/on` `{ note, vel, ch: 10 }` with General MIDI notes (kick 36, snare
  38, clap 39, closed hat 42).

The shapes match what the microphone's drum detection publishes (`audio/kick`,
`audio/kick/env`…), so a world mapped to a kick cannot tell a real bass drum from
the machine. Example 06 routes both to the same params. Options
(`modules.drums`): `engine` (another sound engine), `autoEnableEngine` (default
`true`: the kit's audio engine is switched on by the first hit, no extra click).

## Microphone

`modules: { audio: true }` creates an `AudioAnalyzer`; the microphone starts when
you click 🎤 mic. (Example 06 writes `audio: 'mic'`; any truthy value works.)
Echo cancellation, noise suppression and auto gain are turned off so the
analysis hears the room as it is.

Published every frame: `audio/rms` (smoothed loudness), `audio/peak`,
`audio/band/low` (20–250 Hz), `audio/band/mid` (250 Hz–2 kHz),
`audio/band/high` (2–8 kHz), `audio/centroid` (brightness), and the pulse
`audio/onset` `{ rms }` with a 100 ms refractory time. Drum detection splits
transients by band: `audio/kick` (20–120 Hz), `audio/snare` (150–800 Hz),
`audio/hat` (6–14 kHz), each a pulse `{ level }` with a matching `…/env`
envelope.

> [!TIP]
> Real-world levels rarely reach 1. Speech often sits around 0.05–0.2 RMS and
> band energies are averages across many FFT bins. Narrow the route's window,
> for example `{ source: 'audio/rms', target: 'energy', inMax: 0.3 }`.

```js
import { AudioAnalyzer } from '@openav/audio';

const audio = new AudioAnalyzer({ signals, fftSize: 2048, smooth: 0.7 });
await audio.enableMic();            // or audio.enableElement(videoEl), or someNode.connect(audio.input())
// every frame: audio.update()      → also returns { rms, peak, low, mid, high, centroid, onset, kick, snare, hat }
```

## Chords

`modules: { chord: true }` (or `{ chord: { window: 80 } }`) adds a
`ChordDetector` and feeds it every `midi/note/on` and `midi/note/off`. It groups
notes struck within `window` milliseconds (default 80) into one gesture and
publishes, per gesture:

- `chord/consonance` (−1..1), `chord/count` (number of notes), `chord/root`
  (lowest MIDI note);
- `chord/event`, a pulse carrying the whole analysis:

| field | meaning |
|---|---|
| `notes`, `count`, `root`, `vel`, `pcs` | sorted notes, how many, the lowest, mean velocity (0..1), pitch classes |
| `consonance` | mean of pairwise interval weights, −1..1 (a single note is 1) |
| `isConsonant`, `isDissonant` | two or more notes and consonance > 0.25 / < −0.15 |
| `isTriad` | the chord type is major, minor, sus2, sus4, dim or aug |
| `thirdsFraction` | share of adjacent gaps that are 3 or 4 semitones ("genuinely stacked thirds") |
| `dissonanceLevel` | 0 none · 1 mild (a storm warning) · 2 severe (a true cluster) |
| `chordType` | `single`, `major`, `minor`, `sus2`, `sus4`, `dim`, `aug`, `maj7`, `min7`, `dom7`, `halfdim7`, `maj9`, `min9`, `dom9`, `six`, `min6`, `cluster`, or `chord` |

This is not a music-theory library; it is a performance-semantics layer built
for a piece where consonance makes a garden flourish and clusters make it decay
(example 02). `detector.analyze(notes, vels)` is a pure function you can call
yourself.

## Body and hands

`modules: { pose: true }` adds a `PoseTracker` (one body), `modules: { hands: true }`
a `HandTracker` (two hands, 21 points each). The camera starts when you click
🕺 body or 🖐 hands. Both use MediaPipe Tasks Vision (0.10.14), loaded from
jsDelivr with its model from Google's storage the first time you enable it; the
inference runs on your machine and no video leaves it. The view is mirrored by
default (`mirror: true`), like a mirror on stage, and y is flipped so 1 means
*raised*.

- **Body**: `pose/present`, `pose/hand/left/x|y`, `pose/hand/right/x|y`
  (wrists), `pose/hand/left/v`, `pose/hand/right/v` (wrist speed),
  `pose/hands/spread`, `pose/height` (nose height: crouch ↔ stand),
  `pose/lean` (−1..1).
- **Hands**: per side, `hand/<side>/present`, `hand/<side>/x|y` (palm),
  `hand/<side>/pinch/index` and `hand/<side>/pinch/middle` (thumb tip to finger
  tip), `hand/<side>/spread` (index tip to pinky tip). Distances are divided by
  palm size, so moving toward the camera does not change a pinch. A closed pinch
  reads near 0: use `invert: true` on the route when closing should raise the
  value (example 03).

Both trackers draw their skeleton on a 2D context: `tracker.skeleton(ctx, w, h)`.

## Phones and iPads

`modules: { remote: true }` lets phones join the show over the relay that
`serve.js` hosts. Their sensors publish `phone/<id>/…` (tilt, acceleration,
rotation, knocks, touch, light), mirrored to `phone/any/…`; the control surface
publishes `surface/<page>/<widget>`; the phone's piano publishes
`midi/note/on|off` like a keyboard. The show page itself can read its own motion
sensors on a phone with `localSensors()`. Everything is in
[Phones, relay & surfaces](remote.md).

## Your own input

An input is anything that calls `signals.set()` or `signals.pulse()`. Here is
the pointer as an instrument:

```js
const { signals } = show;
signals.define('pointer/x', { source: 'pointer' });     // continuous, 0..1 by default
signals.define('pointer/y', { source: 'pointer' });
signals.define('pointer/tap', { kind: 'pulse', source: 'pointer' });

addEventListener('pointermove', (e) => {
  signals.set('pointer/x', e.clientX / innerWidth);
  signals.set('pointer/y', 1 - e.clientY / innerHeight);  // 1 = top, like every other y
});
addEventListener('pointerdown', (e) => signals.pulse('pointer/tap', { x: e.clientX, y: e.clientY }));

show.mapper.addRoute({ source: 'pointer/x', target: 'hue', smooth: 0.25 });
```

Name it source first (`breath/pressure`, `weather/wind`), declare its range,
and everything downstream (meters, *learn*, routes, the phone surface) works
without changes.
