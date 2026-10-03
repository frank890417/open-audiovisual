# Signals reference

Signals are the single currency of the input layer: named, normalized, source-blind.
This page lists every signal published by the built-in input packages.

Conventions:
- ranges are 0..1 unless noted
- `pulse` signals fire events; their value is the event payload
- y axes are flipped where it makes *performance* sense (1 = raised), never raw pixels

## @openav/midi

| signal | kind | range | meaning |
|---|---|---|---|
| `midi/cc/{n}` | continuous | 0..1 | controller n (any channel) |
| `midi/note/on` | pulse | `{note, vel, ch}` | key down |
| `midi/note/off` | pulse | `{note, ch}` | key up |
| `midi/bend` | continuous | -1..1 | pitch bend |

## @openav/chord

| signal | kind | range | meaning |
|---|---|---|---|
| `chord/consonance` | continuous | -1..1 | harmonic consonance of last gesture |
| `chord/count` | continuous | 0..10 | notes in last gesture |
| `chord/root` | continuous | 0..127 | lowest MIDI note of last gesture |
| `chord/event` | pulse | full analysis | `{notes, count, root, vel, pcs, consonance, isConsonant, isDissonant, isTriad, thirdsFraction, dissonanceLevel, chordType}` |

`chordType`: `single` · `major` · `minor` · `sus2/4` · `dim` · `aug` · `maj7` ·
`min7` · `dom7` · `halfdim7` · `maj9` · `min9` · `dom9` · `six` · `min6` ·
`cluster` (very dissonant pile) · `chord` (anything else). Inversions resolve to
their root-position name via pitch-class rotation.

`dissonanceLevel`: `0` none · `1` mild (storm warning — foreshadow) · `2` severe
(true cluster — commit to the decay language). Born from a real audience note at
IRCAM: "dissonance detection wasn't strict enough."

## @openav/audio

| signal | kind | range | meaning |
|---|---|---|---|
| `audio/rms` | continuous | 0..1 | loudness (smoothed) |
| `audio/peak` | continuous | 0..1 | instantaneous peak |
| `audio/band/low` | continuous | 0..1 | 20–250 Hz energy |
| `audio/band/mid` | continuous | 0..1 | 250 Hz–2 kHz energy |
| `audio/band/high` | continuous | 0..1 | 2–8 kHz energy |
| `audio/centroid` | continuous | 0..1 | spectral brightness |
| `audio/onset` | pulse | `{rms}` | transient over adaptive floor (100 ms refractory) |

## @openav/pose

Mirrored by default (webcam-as-mirror). y flipped: **1 = raised**.

| signal | kind | range | meaning |
|---|---|---|---|
| `pose/present` | continuous | 0/1 | someone visible |
| `pose/hand/left/x` `/y` | continuous | 0..1 | left wrist (viewer's left) |
| `pose/hand/right/x` `/y` | continuous | 0..1 | right wrist |
| `pose/hand/left/v` `right/v` | continuous | 0..1 | wrist speed |
| `pose/hands/spread` | continuous | 0..1 | wrist-to-wrist distance |
| `pose/height` | continuous | 0..1 | nose height (crouch ↔ stand) |
| `pose/lean` | continuous | -1..1 | shoulder-line tilt |

## @openav/pose — HandTracker (21-landmark fine control)

Per-hand pinch distances = four precise continuous controllers across two hands.
Normalized by palm size, so distance to the camera doesn't change your pinch.

| signal | kind | range | meaning |
|---|---|---|---|
| `hand/left/present` `right/…` | continuous | 0/1 | hand visible |
| `hand/left/x` `/y` | continuous | 0..1 | palm position (y: 1 = raised) |
| `hand/left/pinch/index` | continuous | 0..1 | thumb-tip ↔ index-tip |
| `hand/left/pinch/middle` | continuous | 0..1 | thumb-tip ↔ middle-tip |
| `hand/left/spread` | continuous | 0..1 | index ↔ pinky spread |

(`hand/right/*` mirrors the set. Both trackers expose `skeleton(ctx, w, h)` overlays.)

## @openav/drums (simulator — analyzer-shaped)

The drum machine publishes the SAME shapes the audio analyzer publishes, so a
world mapped to a kick cannot tell mic from machine (that's what a simulator
is for). Sequencer hits also travel as `midi/note/on` (ch 10, GM notes).

| signal | kind | range | meaning |
|---|---|---|---|
| `drum/kick` `/snare` `/hat` `/clap` | pulse | `{level}` | a sequencer hit |
| `drum/kick/env` `…` | continuous | 0..1 | decay envelope per lane (map straight onto params) |

## @openav/remote · @openav/surface

Phone sensors (`/packages/remote/` → 感測). `<id>` is the device id; `phone/any/…` mirrors the latest phone, so a
World's routes can be written before any phone exists.

| signal | kind | range | meaning |
|---|---|---|---|
| `phone/<id>/tilt/x` `/y` | continuous | -1..1 | ±45° from the calibrated rest pose, in SCREEN axes (x right, y toward you) |
| `phone/<id>/accel/x\|y\|z` | continuous | m/s² | including gravity |
| `phone/<id>/rot/alpha\|beta\|gamma` | continuous | deg/s | rotation rate |
| `phone/<id>/orient/alpha\|beta\|gamma` | continuous | deg | raw deviceorientation |
| `phone/<id>/knock` | pulse | `{strength, delta, t}` | acceleration jolt over a threshold (130 ms cooldown) |
| `phone/<id>/light` | continuous | 0..1 | front-camera mean luma |
| `phone/<id>/touch/x` `/y` `/down` | continuous | 0..1 | finger 0; `touch/<n>/…` for n ≥ 1, `touch/count` |

Surface widgets (normalized 0..1; `…/raw` carries the unscaled value when the range is not 0..1):

| signal | kind | meaning |
|---|---|---|
| `surface/<page>/<id>` | continuous | fader · knob · number · toggle · button (0/1) · radio (idx/(n-1)) · encoder phase |
| `surface/<page>/<id>/x` `/y` `/down` | continuous | xy pad |
| `surface/<page>/<id>/<1..N>` | continuous | bank channels |
| `surface/<page>/<id>/hit` | pulse `{pad,row,col,vel}` | pads; `…/<n>` holds the velocity while down |
| `surface/<page>/<id>/delta` | continuous | encoder step in turns |
| `midi/note/on` `/off`, `midi/cc/64` | pulse / continuous | the 琴鍵 page and the `keyboard` widget — same names and shape as `@openav/midi`, plus `velocity` (1..127) and `device` |

## Naming your own

Path-style, source-first: `breath/pressure`, `phone/{id}/gyro/x`, `weather/wind`.
Declare ranges with `signals.define(name, {min, max})` so meters and `norm()`
work; then just `signals.set(name, v)`. Anything that changes can perform.
