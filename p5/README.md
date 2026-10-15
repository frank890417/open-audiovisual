# oav-p5 — one line, and a p5.js sketch plays from MIDI

```js
document.head.prepend(Object.assign(document.createElement('script'), { src: 'https://openaudiovisual.com/p5/oav-p5.js' }));
```

Put it as the first line of a p5.js sketch (OpenProcessing, the p5 editor, any page), or paste the URL into
OpenProcessing → Sketch → Libraries → **+** (custom library). p5 1.x and 2.x, global mode; nothing to call in `setup()`.

Then read the controller the way p5 reads the mouse:

```js
function draw() {
  background(knob1 * 255);                 // knob 1, 0..1 — like mouseX, no setup
  circle(width / 2, height / 2, 50 + knob2 * 300);
}
function notePressed(note, velocity) {     // like keyPressed(): any key (or pad)
  circle(random(width), random(height), velocity * 100);
}
```

| read | | define | |
|---|---|---|---|
| `knob1` … `knob8`, `knob(n)` | 0..1, numbered as printed on the device | `notePressed(note, velocity)` | a key went down (velocity 0..1) |
| `fader1` … `fader8`, `fader(n)` | 0..1 | `noteReleased(note)` | |
| `pad1` … `pad16`, `pad(n)` | velocity while held, 0 when released | `knobMoved(n, value)`, `faderMoved(n, value)` | |
| `note`, `velocity` | the last key and how hard | `padPressed(n, velocity)`, `padReleased(n)` | a pad also calls `notePressed` unless you define `padPressed` |
| `noteIsPressed`, `noteIsDown(60)` | like `keyIsPressed`, `keyIsDown()` | | |

Knob 1 means knob 1 on the controller that played: MiniLab 3 (CC 74) and LPD8 (CC 70) are built in, the other
OAV profiles (nanoKONTROL2, Launch Control, APC mini, …) load when one is plugged in, and on a controller OAV does
not know, the first knob you turn becomes `knob1`. A sketch's own `note`, `velocity` or `knob1` is never written over.

## With OP Configurator (OPC)

[OPC](https://github.com/msawired/OPC) names a variable and its range; this file wires the controller to it, in order.

```js
OPC.slider('radius', 60, 10, 300);   // knob 1
OPC.slider('speed', 1, 0, 5, 0.1);   // knob 2
OPC.toggle('trails', true);          // pad 1 (flips on each hit)
```

Knobs drive the sliders in declaration order, the faders continue after the knobs, pads drive toggles and buttons;
OPC's own panel moves with the knob. On OpenProcessing, whose OPC panel can also learn hardware itself (its MIDI
switch), hardware is left to that mapping as soon as it is seen working, and OAV keeps wiring the on-screen
controller and the phone. Don't name an OPC variable after a p5 function (`hue`, `fill`, …): p5 1.x will clash with it.

**One knob, one job.** A sketch that also reads `knob1` itself (gravity, say) gets knob 1: the first OPC slider stops
following it (drag it on OPC's panel), knob 2 still drives the second slider, and a hint says so once. The panel's first
line is the wiring: `接線：旋鈕1 → knob1（草圖；radius 改用滑桿） · 旋鈕2 → speed（OPC）` (in English: `Wiring: knob1 → knob1
(sketch; radius by its slider) · knob2 → speed (OPC)`); `midi.wiring()` marks such a control `sketch: true`.

## Microphone

The same line reads the microphone, as variables (off until a sketch reads one, calls `startMic()`, or 🎹 → 🎤 is pressed):

```js
function draw() {
  fill(200 + bass * 160, 70, 100);                      // 0..1
  circle(width / 2, height / 2, 50 + micLevel * 300);   // 0..1
}
function beatDetected(level) { /* a beat */ }
```

| read | | define | |
|---|---|---|---|
| `micLevel` | 0..1, how loud it sounds (see below) | `beatDetected(level)` | a jump in loudness |
| `bass`, `mid`, `treble` | 0..1, 20–250 · 250–2000 · 2000–8000 Hz | `kickDetected(level)`, `snareDetected`, `hatDetected` | a hit in that band |
| `beat` | true for one frame per beat | | |
| `micIsOn`, `startMic()`, `stopMic()` | | | |
| `micSensitivity(2)` | twice as sensitive (+6 dB on `micLevel`, ×2 on the bands); `micSensitivity()` says what it is | | |

`micLevel` is a loudness, not a raw signal: decibels, with the room itself at 0. The bottom of the scale follows the room's
own noise (it settles within a second or two and climbs at most 1.5 dB a second, so a voice does not become the floor);
−10 dBFS (shouting into a laptop) is 1. So `50 + micLevel * 300` grows visibly when someone talks (a quiet voice ≈ 0.3–0.45,
talking ≈ 0.4–0.6) and a humming classroom rests near 0. The raw values are in `OAVp5.mic`: `rms` (0..1, smoothed),
`db` (dBFS), `floor` (the room, dBFS). (0.3.0 used a fixed −60…−10 dB window over 8-bit samples: below about −42 dB it read
0 or jumped a whole step; @openav/audio now reads float samples.)

Nothing is requested when the page loads; the first read asks the browser, and every value is `0` until it answers. The
first click or key starts it again if the browser held it back, so there is no `userStartAudio()`. The analysis is
`@openav/audio`, loaded from next to this file, on its own `AudioContext`: `p5.sound` can run on the same page. A sketch's own
`bass` / `mid` / … is left alone. `OAVp5.mic` (`state`, `sensitivity`, `rms`, `db`, `floor`, `on('beat' | 'kick' | 'snare' | 'hat', fn)`,
`start()`, `stop()`, `analyzer`); the option `mic=click` (only 🎤 / `startMic()`) or `mic=off` (nothing can start it). Embedded in an iframe: `allow="microphone"`.

## Sound: what is played is heard

```js
function setup() {
  createCanvas(windowWidth, windowHeight);
  startSound('piano');          // every key is heard: a keyboard, the 🎹 on screen, a phone, midi.play()
}
```

| call / read | |
|---|---|
| `startSound(instrument = 'piano')` | turn it on, or switch instruments while it plays; returns a promise (`true` once it sounds) |
| `stopSound()`, `soundIsOn` | |

The instruments are [@openav/sound](../packages/sound/README.md)'s: `piano` (the Salamander grand, 2 MB of samples: the
electric piano plays while they load, and stays if they cannot), `epiano`, `organ`, `strings`, `choir`, `harp`, `marimba`,
`vibraphone`, `xylophone`, `glockenspiel`, `music-box`, `synth/pad`, `synth/pluck` … (🎹 → 🔊 lists them all, with the
loading progress and the piano's CC-BY credit). Nothing loads until `startSound()` or 🔊: then `packages/sound` from next to
this file and Tone.js 15 from jsDelivr (`tone=<url>` loads it from elsewhere).

Browsers play audio only after a click on the page, and a key on a MIDI keyboard is not a click: a sketch that calls
`startSound()` in `setup()` is heard from the first click or key (the 🔊 on the 🎹 stays yellow until then, and the console
says so). Pads on MIDI channel 10 (MiniLab 3, LPD8: the General MIDI drum channel) play the drum kit, not the piano; the
sustain pedal (CC 64) holds notes. `OAVp5.sound` (`state`: off · waiting · loading · on · error, `instrument`, `status`,
`engine`); the option `sound=piano` (any instrument id) turns it on with no code, `sound=off` keeps it off.

## Drum machine

```js
function setup() {
  startDrums('breakbeat', 110);   // a 16-step × 4-lane grid on screen: click a cell to change the beat
}
function kickDetected(level) {}   // the microphone's own callbacks: a sketch written for the microphone moves over unchanged
function drumHit(lane, velocity) {}   // every hit: 'kick' · 'snare' · 'hat' · 'clap'
```

| read | | define | called on |
|---|---|---|---|
| `drumsAreOn` | | `drumHit(lane, velocity)` | every hit, all four lanes |
| `drumStep` | 0..15, the step that just played | `kickDetected(level)` | kick |
| `drumBar` | 1, 2, 3 … since `startDrums()` | `snareDetected(level)` | snare and clap |
| `drumBpm` | the tempo (the grid's slider moves it too) | `hatDetected(level)` | hat |
| `startDrums(pattern, bpm)`, `stopDrums()` | | `beatDetected(level)` | a kick or a snare, once per step (`beat` too) |

Patterns: `'four on floor'`, `breakbeat`, `'half time'`, `latin`, `sparse`, or your own:
`startDrums({ kick: 'x...x...x...x...', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.' })` (a lane left out is silent).
Calling it again while it plays changes the pattern or the tempo without restarting. The kit is @openav/drums' synthesized
one (no samples); like sound it is heard from the first click, while the callbacks run from the start. A sketch that started
the machine and defines `kickDetected()` no longer opens the microphone on the first click (one that reads `micLevel` still
does, and then both call it). The grid sits at the top centre: on OpenProcessing between the 🎹 and OPC's icon, below the 🎹
panel while that is open, clear of the console. – folds it, × stops the machine, and 🥁 in the 🎹 panel starts and stops it
with no code. `OAVp5.drums` (`state`, `step`, `bar`, `bpm`, `pattern`, `cues`, `machine` = the `mountDrums` handle,
`on('hit' | 'step' | 'bar' | 'cue', fn)` → `off()`).

## Timeline: bars and cues

The drum machine is the clock: 16 steps a bar, counted from `startDrums()`.

```js
function setup() {
  startDrums('breakbeat', 110);
  cue(1, 'calm', 12);             // bar 1, and again every 12 bars
  cue(5, 'bloom', 12);
  cue(9, 'storm', 12);
}
function cueFired(name, bar) {}   // or read cueName in draw()
function barStarted(bar) {}       // the first step of every bar
function stepStarted(step, bar) {}   // every 16th
```

`cue(bar, name, every)`: bar 1 is the first, `4.5` is halfway through bar 4, `every` (in bars) repeats it; the same call twice
adds nothing, so it may sit in `draw()`. `cueName` is the last cue that fired (`''` before one). On one step the cues fire
in the order they were declared, then `barStarted`, `stepStarted`, then that step's hits. A silent clock: `startDrums({})`.

## When something is wrong: hints on the page

Students look at the canvas, not at OpenProcessing's console under it, so what goes wrong is said on the page: a small
card beside the 🎹 (never over the middle of the canvas), in the browser's language (Chinese or English), once per page,
with a ×. Each says what happened, why, and what to press. The console gets the same sentence.

| situation | the card says |
|---|---|
| the microphone is refused | 麥克風被擋下了 → the lock left of the address → allow → click the canvas |
| …by the computer's settings (macOS) | System Settings → Privacy & Security → Microphone |
| …by an embed without `allow="microphone"` | open the sketch's own page; the embedder adds `allow="microphone"` |
| no microphone, another app holds it, an `http:` page | plug one in · quit Zoom/OBS · open it from `https://` |
| the browser is still asking (3.5 s) | look for the box under the address bar |
| Safari / iPad: no Web MIDI; MIDI permission refused | 🎹 on screen or 📱 a phone; Chrome or Edge for a keyboard · the lock → allow → reload |
| an error inside `notePressed()`, `kickDetected()`, `drumHit()`, … | 你的 notePressed() 出錯了：<message>, with the file and line; the sketch keeps running |
| the sketch has its own `note`, `knob1`, … (`let`, `var`, `function`) | it keeps it; read `midi.last.note` / `knob(1)` … for the controller |
| one knob, two jobs (OPC) | knob 1 is now the sketch's; drag the OPC slider |
| sound: waiting for a click · a sampler loading (the electric piano meanwhile) · it failed (epiano instead) · Tone.js unreachable | click the canvas · wait · keep playing · another network or `tone=` |
| the drum machine plays but silently | click the canvas |

MIDI troubles are said only to a sketch that plays from MIDI (it defines a MIDI callback or reads a knob); a sketch that uses
none of this never sees a card. `hints=off` keeps them in the console. `OAVp5.hints` lists what was said.

**🩺 Check-up.** 🩺 in the 🎹 panel, or `OAVp5.check()`, opens a card with the version, the page (framed or not, https),
the browser, the microphone (state, error, level), MIDI (Web MIDI, hardware, devices, the last message), sound, drums, the
wiring, the sketch's own names and the hints shown: one screenshot for Discord, a *copy* button, and a link to the site's
full device check (`/check/`). `OAVp5.check({ show: false })` returns the same as an object (`text` included).

## In Hydra

```js
await loadScript('https://openaudiovisual.com/p5/oav-p5.js')
osc(10, 0.1, () => knob1 * 2).out()
```

`knob1`, `note`, `micLevel`, `drumStep`, … are there; subscribe with `midi.on('notePressed', fn)` and `OAVp5.drums.on('hit', fn)`
(Hydra is not p5, so no callbacks to define). `startSound()` and `startDrums()` work there too.

## Three inputs, one stream of bytes

| input | how |
|---|---|
| a real controller | Web MIDI (Chrome, Edge, Firefox). The browser asks once; the answer is remembered. |
| the on-screen controller | 🎹 → `<oav-controller>` (MiniLab 3 by default; follows the controller you plug in) |
| a phone | 📱 in that panel → QR → the OAV remote page's MIDI tab, over the public relay |

The sketch can't tell them apart (`midi.last.source` can). Safari and iPad have no Web MIDI: the screen and the phone
still work. On OpenProcessing the 🎹 and its panel sit at the top-left: its console floats over the bottom and OPC's
icon owns the top-right.

## MIDI-level access

`midi.note[60]`, `midi.cc[74]` (0..1), `midi.bend` (−1..1), `midi.held`, `midi.last` (`{ type, note | cc, value,
channel, source, control }`); `noteOn(note, velocity, channel)`, `noteOff`, `controlChange(cc, value, channel)`,
`pitchBend`, `midiMessage(bytes, source)`; `midi.on(event, fn)` → `off()`; `midi.play(60, 0.8)`; `midi.wiring()`.
A sketch with its own Web MIDI code (`navigator.requestMIDIAccess`, WebMidi.js) also hears the screen and the phone
as one more input, **OAV Virtual MIDI**, after the real ports.

## Why `prepend`, and why one async line is enough

p5's friendly errors read the page's last `<script>` as the sketch: first in `<head>`, this file is never mistaken
for the student's code. p5 1.x and 2.x start global mode on `window` `load`, and a script inserted while the page is
still loading holds `load` back until it has run, so `knob1` and `midi` exist in `setup()` (checked with the file
served 1.5 s late). If the file cannot load at all, code that reads `knob1` stops with *knob1 is not defined*: that
message means the line did not load.

## Options

`window.OAV_P5 = { … }` before the line, `?key=value` on the script URL, or `?oav_key=value` on the page
(OpenProcessing forwards its page's `?sketch_oav_key=value`).

| key | values | default |
|---|---|---|
| `hardware` | `auto` (ask at once) · `click` (ask from the 🎹 panel) · `off` | `auto` |
| `panel` | `closed` (just 🎹) · `open` · `off` | `closed` |
| `profile` | any @openav/midi profile id (`akai-lpd8`, …) | follows the plugged-in device, else `arturia-minilab3` |
| `opc` | `on` · `off` | `on` |
| `mic` | `auto` (the first read asks for the microphone) · `click` (only 🎤 / `startMic()`) · `off` | `auto` |
| `hints` | `on` (cards beside the 🎹) · `off` (the console only) | `on` |
| `sound` | `click` (`startSound()` or 🔊) · `off` · an instrument id (`piano`, `organ`, …: heard from the first click, no code) | `click` |
| `tone` | where Tone.js 15 comes from (an ES module URL) | `https://cdn.jsdelivr.net/npm/tone@15.0.4/+esm` |
| `dock` / `corner` | `bottom`·`top` / `right`·`left` | top-left on OpenProcessing, bottom-right elsewhere |
| `shim` | `on` · `off` (the virtual port) | `on` |
| `relay` / `room` | the phone relay and room | `wss://remote.cheyuwu.com/relay` / one per browser |
| `telemetry` | `off` · `on` (@openav/midi's anonymous page-load hit) | `off` |
| `debug` | `1`: trace clicks and loading in the console | off |

## Size, versions

`oav-p5.js` is about 105 KB (35 KB gzip; its hints are in two languages) and loads nothing else until 🎹 is opened (then `packages/midi/element.js` and
its modules, ~130 KB transferred, from next to it), the microphone is read (`packages/audio`, ~7 KB), a phone is asked for (`packages/relay`, a QR encoder),
an unknown controller is plugged in (`packages/midi/profiles`), sound is turned on (`packages/sound`, ~21 KB gzip, Tone.js ~230 KB
from jsDelivr, and the piano's 2 MB of samples when the piano is picked), or the drums are (`packages/drums`, ~6 KB gzip). Because it loads the rest of OAV from next to itself,
one URL pins one tree: `openaudiovisual.com/p5/oav-p5.js` is the latest; `cdn.jsdelivr.net/gh/frank890417/open-audiovisual@<tag>/p5/oav-p5.js` is frozen.

## Tests

- `node --test tests/p5-inject.test.js` (part of `npm test`): parsing, the p5-style names, device numbering checked
  against the profiles, pads, unknown devices, OPC wiring and the OpenProcessing hand-over, names a sketch already owns;
  the microphone; sound through the real `@openav/sound` with a stand-in Tone.js (the click, the pads, the pedal, a sampler's
  fallback first), the drum callbacks, `beat`, cues, and a microphone sketch moved to the drums; the hints (which ones, when,
  in which language, the file and line of a callback's error, a sketch's own `let note`), `micLevel` for a quiet voice and a shout,
  a room that hums, `micSensitivity()`, a knob read under OPC, and `OAVp5.check()`.
- `PW=<playwright> P5_DIR=<p5 builds> BROWSER=chromium|webkit|firefox node p5/test/smoke.cjs`: p5 1.11.11 and 2.x ×
  the line, the line 1.5 s late, the custom-library route and OPC — the sketch runs, `midi` exists in `setup()`, keys,
  knobs and pads reach it, the 🎹 controller plays it, `requestMIDIAccess` gets the virtual port, a phone over a local
  relay plays it, no page errors; with no MIDI hardware and no permission. (`CHROME=<binary>` picks the browser.)
- `p5/test/mic-smoke.cjs` (same arguments, plus `P5_DIR` files `p5sound-1.11.11.min.js`, `p5sound-0.4.1.min.js`; Chromium with a
  fake microphone): a sketch that reads nothing never asks; `micLevel`, the bands, `beat` and `beatDetected()` on p5 1.x and
  2.x, next to p5.sound; the 🎤 button; a refused microphone; none of our names is a p5 / p5.sound name.
- `p5/test/hydra-smoke.cjs`: hydra-synth 1.4.0 (CDN, or `HYDRA_JS=<file>`) loads the line with `loadScript`; `knob1`, `note`, the
  🎹, pixels, and `micLevel` in an arrow function.
- `p5/test/hints-smoke.cjs` (same arguments; a Chinese browser): a sketch that uses nothing shows no card; a refused microphone, a
  `notePressed()` that throws (file and line; the sketch keeps going), `hints=off`, "click to hear" before and after the click, a
  knob read under an OPC slider and the panel's wiring line, 🩺.
- `p5/test/kit-smoke.cjs` (same arguments; the last check needs jsDelivr, `REAL_TONE=0` skips it): none of the new names is a p5 /
  p5.sound name; an old sketch loads no sound, no drums, no Tone.js and shows no grid; `examples/drums` in OpenProcessing's layout
  (the grid clear of the 🎹, OPC's corner and the console, below an open 🎹 panel), its steps, bars, cue and hits, the kit from the
  first click, the microphone left alone; `examples/keys` with a stubbed Tone.js (nothing before the click, then `midi.play(60, 0.8)`
  reaches the engine and `Sampler.triggerAttack` at 261.6 Hz, a pad does not; the 🔊 picker) and once with the real Tone.js and piano.

Examples: `p5/examples/particles/` (`knob1`, `notePressed`), `p5/examples/opc/` (OPC sliders on knobs), `p5/examples/mic/` (`micLevel`, `bass`, `beat`),
`p5/examples/keys/` (`startSound('piano')`, particles from every key, the 🎹 open) and `p5/examples/drums/` (`startDrums`, `kickDetected`, `cue`, `cueFired`).
