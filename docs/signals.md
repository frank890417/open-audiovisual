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

## Naming your own

Path-style, source-first: `breath/pressure`, `phone/{id}/gyro/x`, `weather/wind`.
Declare ranges with `signals.define(name, {min, max})` so meters and `norm()`
work; then just `signals.set(name, v)`. Anything that changes can perform.
