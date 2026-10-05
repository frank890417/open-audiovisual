# Signals reference

Signals are the single currency of the input layer: named, normalized, source-blind.
This page lists every signal published by the built-in input packages.

Conventions:
- ranges are 0..1 unless noted
- `pulse` signals fire events; their value is the event payload
- y axes are flipped where it makes *performance* sense (1 = raised), never raw pixels
- `<n>` is a number, `<ch>` a MIDI channel 1..16, `<id>` a device id, `<slug>` a device name made URL-safe

## @openav/midi

Every hardware message publishes the legacy names and the per-channel names.

| signal | kind | range | meaning |
|---|---|---|---|
| `midi/note/on` | pulse | `{note, vel, velocity, ch, device}` | key down: `vel` 0..1, `velocity` 1..127, `ch` 1..16, `device` = port slug |
| `midi/note/off` | pulse | `{note, ch, device}` | key up |
| `midi/cc/<n>` | continuous | 0..1 | controller n (any channel) |
| `midi/bend` | continuous | -1..1 | pitch bend (any channel) |
| `midi/ch/<ch>/cc/<n>` | continuous | 0..1 | controller n on one channel |
| `midi/ch/<ch>/note/<n>` | continuous | 0..1 | velocity while note n is held, 0 on release |
| `midi/ch/<ch>/bend` | continuous | -1..1 | pitch bend on one channel |
| `midi/ch/<ch>/pressure` | continuous | 0..1 | channel aftertouch |
| `midi/ch/<ch>/poly/<n>` | continuous | 0..1 | polyphonic aftertouch on note n |

With two or more MIDI inputs connected, each device also publishes under its
slug (from the port name: `Arturia MiniLab 3` → `arturia-minilab-3`, duplicates
get `-2`, `-3`):

| signal | kind | range | meaning |
|---|---|---|---|
| `midi/<slug>/note/on` | pulse | `{note, vel, ch}` | key down on that device |
| `midi/<slug>/note/off` | pulse | `{note, ch}` | key up on that device |
| `midi/<slug>/cc/<n>` | continuous | 0..1 | controller n on that device |
| `midi/<slug>/bend` | continuous | -1..1 | pitch bend on that device |

On-screen controllers (`modules.midi.controllers`) publish one name per
control, `midi/<device>/<control>` (for example `midi/minilab3/knob1`), plus
`/hit` pulses for pads and `/raw` values. They are listed in
[MIDI controllers & embedding](controllers.md).

## @openav/keys

The on-screen piano, QWERTY playing and the simulated performer publish the
legacy note names with a smaller payload:

| signal | kind | range | meaning |
|---|---|---|---|
| `midi/note/on` | pulse | `{note, vel, ch: 0}` | key down (`vel` 0..1) |
| `midi/note/off` | pulse | `{note, ch: 0}` | key up |

## @openav/chord

| signal | kind | range | meaning |
|---|---|---|---|
| `chord/consonance` | continuous | -1..1 | harmonic consonance of last gesture |
| `chord/count` | continuous | 0..10 | notes in last gesture |
| `chord/root` | continuous | 0..127 | lowest MIDI note of last gesture |
| `chord/event` | pulse | full analysis | `{notes, count, root, vel, pcs, consonance, isConsonant, isDissonant, isTriad, thirdsFraction, dissonanceLevel, chordType}` |

`chordType`: `single` · `major` · `minor` · `sus2` · `sus4` · `dim` · `aug` · `maj7` ·
`min7` · `dom7` · `halfdim7` · `maj9` · `min9` · `dom9` · `six` · `min6` ·
`cluster` (very dissonant pile) · `chord` (anything else). Inversions resolve to
their root-position name via pitch-class rotation.

`dissonanceLevel`: `0` none · `1` mild (storm warning — foreshadow) · `2` severe
(true cluster — commit to the decay language). Born from a real audience note at
the IRCAM × C-LAB performance in Taipei: "dissonance detection wasn't strict enough."

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
| `audio/kick` | pulse | `{level}` | 20–120 Hz transient (90 ms refractory) |
| `audio/snare` | pulse | `{level}` | 150–800 Hz transient (90 ms refractory) |
| `audio/hat` | pulse | `{level}` | 6–14 kHz transient (60 ms refractory) |
| `audio/kick/env` `/snare/env` `/hat/env` | continuous | 0..1 | decay envelope per drum (map straight onto params) |

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
| `hand/left/pinch/index` | continuous | 0..1 | thumb-tip ↔ index-tip (0 = touching) |
| `hand/left/pinch/middle` | continuous | 0..1 | thumb-tip ↔ middle-tip |
| `hand/left/spread` | continuous | 0..1 | index-tip ↔ pinky-tip spread |

(`hand/right/*` mirrors the set. Both trackers expose `skeleton(ctx, w, h)` overlays.)

## @openav/leap

Leap Motion / Ultraleap through the machine's bridge. Positions are the palm or
fingertip inside the interaction box, normalized and clamped (x right, y up,
z toward the performer). `<side>` is `left` or `right`, `<finger>` one of
`thumb index middle ring pinky`.

| signal | kind | range | meaning |
|---|---|---|---|
| `leap/status` | continuous | 0..3 | 0 no bridge · 1 bridge, no tracking service · 2 no device · 3 tracking |
| `leap/hands` | continuous | 0..2 | hands in view |
| `leap/hand/<side>/present` | continuous | 0/1 | hand in view |
| `leap/hand/<side>/x` `/y` `/z` | continuous | 0..1 | palm position |
| `leap/hand/<side>/pinch` `/grab` | continuous | 0..1 | pinch and fist strength (0 when the hand is lost) |
| `leap/hand/<side>/roll` `/pitch` `/yaw` | continuous | -π..π | hand rotation in radians |
| `leap/hand/<side>/speed` | continuous | 0..1 | palm speed, 1 = 1 m/s |
| `leap/hand/<side>/<finger>/x` `/y` `/z` | continuous | 0..1 | fingertip position |
| `leap/both/distance` | continuous | 0..1 | palm to palm, 1 = 40 cm |
| `leap/hand/<side>/pinch-start` `/pinch-end` | pulse | `{side, x, y, z, strength}` | pinch above 0.86 starts, below 0.5 ends |
| `leap/hand/<side>/grab-start` `/grab-end` | pulse | `{side, x, y, z, strength}` | fist above 0.8 starts, below 0.5 ends |
| `leap/both/pinch-start` `/pinch-end` | pulse | `{x, y, z, distance}` | both pinch above 0.8 enters, either below 0.5 exits |

## @openav/drums (simulator — analyzer-shaped)

The drum machine publishes the SAME shapes the audio analyzer publishes, so a
world mapped to a kick cannot tell mic from machine (that's what a simulator
is for). Sequencer hits also travel as `midi/note/on` (ch 10, GM notes).

| signal | kind | range | meaning |
|---|---|---|---|
| `drum/kick` `/snare` `/hat` `/clap` | pulse | `{level}` | a sequencer hit |
| `drum/kick/env` `…` | continuous | 0..1 | decay envelope per lane (map straight onto params) |
| `midi/note/on` | pulse | `{note, vel, ch: 10}` | kick 36 · snare 38 · clap 39 · closed hat 42 |

## @openav/sound (output events)

The in-page instruments listen to `midi/note/on|off` and the sustain pedal
`midi/cc/64`, and announce one event of their own.

| signal | kind | range | meaning |
|---|---|---|---|
| `sound/instrument` | pulse | `{id, name}` | the instrument changed (picker, code or a cue) |

## @openav/record (take playback)

A `TakePlayer` publishes a recorded take's events under their original names
(`midi/note/on`, `midi/ch/<ch>/note/<n>`, `midi/cc/<n>`…), exactly as the
keyboard did, plus two signals of its own.

| signal | kind | range | meaning |
|---|---|---|---|
| `take/playing` | continuous | 0 / 1 | 1 while a take plays; 0 when paused, stopped, or yielded to live playing |
| `take/position` | continuous | 0..1 | how far into the take |

## @openav/remote · @openav/surface

Phone sensors (`/packages/remote/` → 感測). `<id>` is the device id; `phone/any/…` carries the value from whichever phone sent it last, so a
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
| `phone/local/…` | — | — | the same sensor names when the show page ITSELF runs on a phone (`localSensors(signals)`, no relay; also mirrored to `phone/any/…`) |

Surface widgets (normalized 0..1; `…/raw` carries the unscaled value when the range is not 0..1):

| signal | kind | meaning |
|---|---|---|
| `surface/<page>/<id>` | continuous | fader · knob · number · toggle · button (0/1) · radio (idx/(n-1)) · encoder phase |
| `surface/<page>/<id>/x` `/y` `/down` | continuous | xy pad |
| `surface/<page>/<id>/<1..N>` | continuous | bank channels |
| `surface/<page>/<id>/hit` | pulse `{pad,row,col,vel}` | pads; `…/<n>` (n from 0) holds the velocity while down |
| `surface/<page>/<id>/delta` | continuous | encoder step in turns |
| `surface/<page>/<id>` (text) | pulse | the string typed into a `text` widget |
| `midi/note/on` `/off`, `midi/cc/64` | pulse / continuous | the 琴鍵 page and the `keyboard` widget — same names and shape as `@openav/midi`: `{note, vel, velocity, ch: 1, device: 'surface'}` |

Receiving end: every relay message is filed by `fileSignal(signals, name, value, {pulse})` (`@openav/relay`; `bindSignals`
uses it, so do hosts with their own socket such as the lab's `lab.js`). It declares the name on first sight (`signalMeta`),
and fills in whichever velocity spelling a `midi/…/note/on|off` sender left out (`vel` 0..1 ⇄ `velocity` 1..127).

## Naming your own

Path-style, source-first: `breath/pressure`, `phone/{id}/gyro/x`, `weather/wind`.
Declare ranges with `signals.define(name, {min, max})` so meters and `norm()`
work; then just `signals.set(name, v)`. Anything that changes can perform.
