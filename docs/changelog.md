# Changelog

What changed, newest first: what you can do now, and where the handbook explains it. **oav-p5**, the one line
for p5.js sketches ([p5.js in one line](p5.md)), has its own version: 🎹 → 🩺 shows it on any sketch that loads
it. **The framework and the site** are listed by day. Every entry links its commit; the whole history is the
[commit log](https://github.com/frank890417/open-audiovisual/commits/main).

## oav-p5

### 0.6.0

2026-10-15 · [5e75007](https://github.com/frank890417/open-audiovisual/commit/5e75007)

- **The drums keep time when the picture is heavy.** The drum machine is scheduled ahead on the audio clock: with a
  `draw()` that keeps the page busy 30 ms a frame, the kick-to-kick interval varies by 0.000 ms (0.5.0: 15 ms).
  In a background tab the drums keep playing and the bars keep counting. `?oav_drums=frame` brings back the 0.5
  drum machine. [Drum machine](p5.md#drum-machine)
- **One line of rhythm:** `startDrums("bd*4, [~ sd]*2, hh*8")`. The notation comes from TidalCycles and Strudel;
  OAV implements it independently, from the public documentation (`@openav/pattern`). A typo gets a card that says
  which word and why. [One line of rhythm](p5.md#one-line-of-rhythm)
- **The drum card** names its tracks in the browser's language, shows the bar number, and lights the word of the
  line that is playing.
- **`drumPhase` and `beatPhase`:** how far into the bar and into the beat, 0 to 1, continuous.
  `rotate(drumPhase * TWO_PI)` turns once a bar.
- Ready-made sketch: `p5/examples/rhythm/`.

### 0.5.0

2026-10-15 · [02aa19c](https://github.com/frank890417/open-audiovisual/commit/02aa19c)

- **Record a video with its sound:** `startRecording()`, `stopRecording()`, `recordingSaved(info)`. ⏺ and 📷 in the
  🎹 panel need no code. [Recording](p5.md#recording-a-video-with-its-sound)
- The canvas and every sound the line makes (`startSound()`, the drums, an open microphone, p5.sound 1.x) go into
  one file: MP4 where the browser can record it, WebM elsewhere. On a phone, the card's **Share** button saves it
  to the photo library.
- Every take is checked: no sound, WebM, an all-black video, a nearly empty file. The card says what happened and why.
- 📷 saves the canvas as a PNG.
- Ready-made sketch: `p5/examples/record/`.

### 0.4.0

2026-10-15 · [e629115](https://github.com/frank890417/open-audiovisual/commit/e629115)

- **Sound:** `startSound('piano')`. Every note from a keyboard, the 🎹 on screen or a phone is heard; 🔊 in the
  panel switches instruments. [Sound](p5.md#sound-what-is-played-is-heard)
- **A drum machine:** `startDrums()`, a 16-step grid with four tracks and five patterns. Each hit calls the
  microphone's own `kickDetected()`, `snareDetected()` and `hatDetected()`, so a microphone sketch follows the
  drums unchanged. [Drum machine](p5.md#drum-machine)
- **A timeline of bars:** `cue(5, 'bloom')` → `cueFired()`, `barStarted()`, `stepStarted()`.
  [Timeline](p5.md#timeline-bars-and-cues)
- **What went wrong, said on the page:** a card beside the 🎹, in the browser's language: what happened, why, what
  to press. [When something goes wrong](p5.md#when-something-goes-wrong)
- **🩺 Check-up:** 🩺 in the panel (or `OAVp5.check()`) puts the version, the microphone, MIDI, sound, drums and
  the wiring on one card to screenshot.
- `micLevel` follows how loud it sounds, with the room's own noise as 0; `micSensitivity()` sets how sensitive.
  A knob the sketch reads itself is no longer also wired to an OPC slider: one knob, one job.
- Ready-made sketches: `p5/examples/keys/`, `p5/examples/drums/`.

### 0.3.0

2026-10-15 · [d874044](https://github.com/frank890417/open-audiovisual/commit/d874044)

- **The microphone, in the same line:** `micLevel`, `bass` / `mid` / `treble`, `beatDetected()`. No p5.sound, p5
  1.x and 2.x. Nothing asks for the microphone until the sketch reads one of these names.
  [The microphone](p5.md#the-microphone)
- **In Hydra too:** load the same file with `loadScript()`, then `osc(10, 0.1, () => knob1 * 2).out()`.
  [In Hydra](p5.md#in-hydra)
- Ready-made sketch: `p5/examples/mic/`.

### 0.2.4

2026-10-14 · [d2572c3](https://github.com/frank890417/open-audiovisual/commit/d2572c3) · tag `p5-v0.2.4`

The first tagged version; it gathers 0.1 to 0.2.4 (from 2026-10-13).

- **Read a controller the way p5 reads the mouse:** `knob1` … `knob8`, `fader1` …, `pad1` …, `notePressed()`.
  A MIDI controller, the controller on screen (🎹) and a phone all come in as the same MIDI.
  [Read it like the mouse](p5.md#read-it-like-the-mouse)
- **OpenProcessing:** OP Configurator variables follow the knobs, in the order they are declared.
  [With OP Configurator](p5.md#with-op-configurator)
- The handbook chapter, in English and Chinese. Tested on openprocessing.org with p5 2.3.4.
- Ready-made sketches: `p5/examples/particles/`, `p5/examples/opc/`.

## Framework and site

### 2026-10-15

- **MIDI controller library:** every controller has its own page with its full MIDI map, in English and Chinese.
  New: Novation Launchkey 25 and 37 MK4, Launchpad Pro MK3, DJ TechTools Midi Fighter Twister, AKAI APC40 mkII,
  and the teenage engineering OP-1 field (contributed by Miffy Chen, pull request #2). How to choose a controller,
  LED feedback, a request form. [Controllers](https://openaudiovisual.com/controllers/)
- **Examples:** fifteen examples in five routes, each with a guide card. New: 14 timeline and 15 p5.js in one
  line; 02 chord garden now grows The Last Input's L-system branches. [Examples](https://openaudiovisual.com/examples/)
- **New pages:** [/p5/](https://openaudiovisual.com/p5/) and [/check/](https://openaudiovisual.com/check/), what
  this device supports. The handbook says what each browser can do, and the homepage says so when a device has
  no Web MIDI.
- **Mapping and timeline:** mappings export, import and load from `?map=`. The timeline package has curves, loops,
  cues that fire and recording.
- **Phones:** the live examples take a phone remote over the public relay, with a QR code; in portrait the stage
  stays on top.
- **New packages:** `@openav/pattern` (one line of rhythm), `@openav/fab` (can it be 3D-printed: a check, and STL,
  OBJ, GLB, STEP files), `@openav/out` (page parameters to WLED lights, serial motor boards and OSC, with a
  watchdog). [Packages](packages.md)
- **For agents and search engines:** llms.txt in English and Chinese, one sitemap, and MCP tools for controller
  profiles: `list_controllers`, `read_profile`, `validate_profile`, `scaffold_profile`.
- A new README, and `tools/release.sh`: every change ships in one fixed order.
