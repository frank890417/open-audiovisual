# Changelog

What changed, newest first: what you can do now, and where the handbook explains it. **oav-p5**, the one line
for p5.js sketches ([p5.js in one line](p5.md)), has its own version: 🎹 → 🩺 shows it on any sketch that loads
it. **The framework and the site** are listed by day. Every entry links its commit; the whole history is the
[commit log](https://github.com/frank890417/open-audiovisual/commits/main).

## oav-p5

### 0.8.3

2026-10-20 · [8a9be83](https://github.com/frank890417/open-audiovisual/commit/8a9be83)

- **How many frames ago.** `lastKickFrameCount`, `lastSnareFrameCount`, `lastHatFrameCount`, `lastBeatFrameCount` and
  `lastNoteFrameCount` are the `frameCount` of the frame that saw the hit: `frameCount - lastKickFrameCount` is 0 in the
  frame where `kickIsDetected` is true, then 1, 2, 3 …, for a shape that lasts a fixed number of frames. [lastKickFrameCount](https://openaudiovisual.com/docs/reference/#lastKickFrameCount)

### 0.8.2

2026-10-20 · [b0ebbd7](https://github.com/frank890417/open-audiovisual/commit/b0ebbd7)

- **A hit as a value, like `mouseIsPressed`.** `kickIsDetected`, `snareIsDetected` and `hatIsDetected` are true in the one
  frame after a kick, a snare or a hat (the drum machine's, or the microphone's when no drums play). `lag()` takes `true` as 1,
  so `lag(kickIsDetected, 0, 0.3)` is a number that flashes to 1 and fades: an alpha, a size. [kickIsDetected](https://openaudiovisual.com/docs/reference/#kickIsDetected)
- **When the last one came.** `lastKickTs`, `lastSnareTs`, `lastHatTs`, `lastBeatTs` and `lastNoteTs` are on the `millis()`
  clock, so `millis() - lastKickTs` is how many ms ago; `-Infinity` until the first. [lastKickTs](https://openaudiovisual.com/docs/reference/#lastKickTs)

### 0.8.1

2026-10-20 · [096914f](https://github.com/frank890417/open-audiovisual/commit/096914f)

- **The 🎹 panel goes where you want it.** Two buttons on the panel: **Dock** cycles bottom → top → floating (drag a
  floating panel by its bar), **Size** cycles small → medium → large. This browser remembers both. With no `dock` option
  the panel now opens at the bottom, OpenProcessing included: at the top it covered the sketch. The 🎹 moves out of the
  panel's way only when they share an edge. [dock](https://openaudiovisual.com/docs/reference/#option-dock)
- **A reload brings back what you had on.** Cmd+Enter on OpenProcessing (or any reload of the same page) opens the panel
  again if it was open, and restarts drums you started from its 🥁 on the line and tempo you ended on. A sketch that
  starts its own drums keeps its own; close the panel or stop the drums and they stay off.
- **With the drums playing, a kick is one kick.** The microphone's kick, snare, hat and beat no longer reach the sketch
  while the drum machine plays: it mostly heard the drums out of the speakers, so `snareDetected` fired on kicks.
  `micLevel` and the three bands still follow the microphone. [kickDetected](https://openaudiovisual.com/docs/reference/#kickDetected)
- **OpenProcessing's console stays shut.** It opens over the sketch for every console line, so there oav-p5 no longer
  prints what it says on its own (the wiring, a hint that is on a card, "sound on"). An error in your code, a call made
  wrong and 🩺 still print; `debug` brings the rest back.

### 0.8.0

2026-10-16 · [9bdde95](https://github.com/frank890417/open-audiovisual/commit/9bdde95)

- **Note names wherever a note number goes.** `noteIsDown('C4')` is `noteIsDown(60)`, `midi.play('C#4', 0.8)` sends note 61,
  and the new `midi.isDown('Eb3')` asks a key by name. `C4`, `c#4`, `Db3`, `F♯2`, `C-1` (0) up to `G9` (127); C4 is 60
  (some software, Ableton and Yamaha among them, calls 60 "C3"). Strudel's lower-case spelling (`c4 e4 g4`) works. A name
  that is not one stops with a card saying how to write it. Numbers behave exactly as before, and `notePressed(note, velocity)`
  still gets a number. [Note names](p5.md#note-names)
- **Three converters:** `noteNumber('C4')` gives `60`, `noteName(61)` gives `'C#4'` (`{ flats: true }` for `'Db4'`,
  `{ octave: false }` for `'C#'`), `noteFreq('A4')` gives `440` Hz for a sketch that makes its own sound.
- Ready-made sketch: `p5/examples/note-names/` (example 24).

### 0.7.0

2026-10-15 · [89c05ac](https://github.com/frank890417/open-audiovisual/commit/89c05ac)

- **The grid and the line of rhythm are one thing.** Click a cell and the line is rewritten the way a person would write
  it (`bd*4`, `bd(3,8)`, `[~ sd]*2`); type in the line and the grid follows once you pause. A typo is marked red and the
  drums keep playing the last line that worked. ↶ or ⌘Z steps back, Copy gives you `startDrums("…", 120)`, and Open in
  Strudel takes the same rhythm to strudel.cc. [One line of rhythm](p5.md#one-line-of-rhythm)
- **`drawRhythm(x, y, w, h, 'circle')`:** the rhythm drawn on the canvas in three styles (`grid`, `circle`, `spiral`),
  turning with `drumPhase`, so a recording has it. [The rhythm on the canvas](p5.md#the-rhythm-on-the-canvas)
- **Values over time, like TouchDesigner's CHOPs:** `lag(micLevel, 0.03, 0.4)` (Lag CHOP, in TouchDesigner's seconds:
  about the time to follow 90%), `env('kick', 0.01, 0.3)` (Trigger), `speed()`, `spring()`, `trail()`, `slope()`,
  `count()`, one call each in `draw()`, nothing to declare; `scope(value, 'label')` plots a value in a corner (never
  recorded) and `drawTrail()` plots it on the canvas. New package `@openav/chop`.
- **With Strudel:** load the line in strudel.cc and the knobs, a phone and the microphone become Strudel's parameters;
  notes Strudel sends with `.midi('OAV Virtual MIDI')` reach `notePressed` at their timestamps (4.5 ms at most, measured),
  its clock leads the drum machine and `drumPhase`, and `link=<room>` carries notes and clock to another tab or computer.
  New page: [With Strudel](strudel.md).
- Ready-made sketches: `p5/examples/rhythm-visual/`, `p5/examples/lag/`, `p5/examples/with-strudel/`.

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
- **The site catches up with oav-p5**: this page (the changelog), "oav-p5 version · framework version" on the home page and the handbook headers, a fourth door on the home page ("I use p5.js / OpenProcessing"), the ready-made sketches listed on /p5/, and example paths in the handbook that you can click. The entry script (`/p5/oav-p5.js`) reaches every sketch about a minute after a release.
- **The site catches up with oav-p5, part two:** the ready-made p5 sketches are examples now, each with a guide card
  and a thumbnail: 16 keys with sound, 17 microphone, 18 drums and bars, 19 one line of rhythm, 20 rhythm you can see,
  21 record a video, 22 lag, 23 with Strudel ([Examples](https://openaudiovisual.com/examples/)). Three more questions
  on the home page (sound, drums and video; smoothing like a Lag CHOP; Strudel), a link from /p5/ to
  [With Strudel](strudel.md), and the quick start, troubleshooting, roadmap and README now say what oav-p5 does.
