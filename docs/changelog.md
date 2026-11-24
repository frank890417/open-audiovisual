# Changelog

What changed, newest first: what you can do now, and where the handbook explains it. **oav-p5**, the one line
for p5.js sketches ([p5.js in one line](p5.md)), has its own version: 🎹 → 🩺 shows it on any sketch that loads
it. **The framework and the site** are listed by day. Every entry links its commit; the whole history is the
[commit log](https://github.com/frank890417/open-audiovisual/commits/main).

## oav-p5

### 0.8.5

2026-11-06 · [a330b30](https://github.com/frank890417/open-audiovisual/commit/a330b30)

- **The controllers imported from QLC+ work here too.** Plug in a BCF2000 or a nanoPAD2, or set `profile` to one of their ids, and `knob1`, `fader1` and `pad1` follow that device: its one file is fetched when it is needed. [profile](https://openaudiovisual.com/docs/reference/#option-profile)

### 0.8.4

2026-10-20 · [e9ad495](https://github.com/frank890417/open-audiovisual/commit/e9ad495)

- **🥁 opens the drums quiet.** 🥁 in the 🎹 panel, and the drums it brings back after a reload, show the grid with its play box
  unticked: nothing sounds until someone ticks it. A sketch that calls `startDrums()` itself still plays at once. [startDrums](https://openaudiovisual.com/docs/reference/#startDrums)

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

### 2026-11-25

- **A next step at the end of the pages people land on.** Each device page ends with that controller in a p5.js sketch, `window.OAV_P5 = { profile: '<id>', panel: 'open' }`, the loader line and a sketch, with a Copy button, a link to the p5.js page and one example for what the device has (keys: 16, pads: 18, knobs and faders: 09). The cheat sheet and the API reference end with the examples whose code uses each group of names, read from the examples themselves, and Made with. An example's guide card names the next example on its route, or the next route at the end of one, and example 15 lists its chapter. The homepage ends with Made with. [AKAI LPD8](https://openaudiovisual.com/controllers/akai-lpd8/#next-step)
- **What visitors do on the site, counted.** Besides page views, the site's own pages now send eight Google Analytics events: a copy (the loader line, other code, an import map), a link off the site (GitHub, a maker's manual, a work, OpenProcessing), the first move on an on-screen controller, a QLC+, Mixxx or JSON download, the first click or key in an example, a next-step link, a search and the language switch. Each param is a short word or an id: never what was copied or typed, never a link's path or query. The script, `assets/track.js`, runs only on openaudiovisual.com, and `p5/oav-p5.js`, `packages/` and `embed/` do not load it, so a page built with the framework sends nothing new. [The site's own pages](https://openaudiovisual.com/docs/#controllers-the-site-s-own-pages)
- **DMX lighting from a page: 0.10.0.** A new package, `@openav/dmx`: fixture profiles (`open-audiovisual/fixture@1`, eight generic ones and a schema, and `tools/import-ofl.mjs` to convert a fixture from the Open Fixture Library), a patch that turns dimmer, colour, pan and tilt into each light's bytes, and an engine that renders every light at any moment as a function of time: scenes, cues with fades, chases on beats, effects, live values, submasters, master and blackout. It writes the bytes of Art-Net, sACN (E1.31) and the Enttec DMX USB Pro. `dmxTransport()` sends them to memory, through the out-bridge or by Web Serial, `dmxParams()` lets MIDI, the timeline and the microphone drive the lights like any param, and `mountDmxMonitor()` shows the rig with no hardware. The handbook has a new chapter for it: the three ways out of the computer, which universe is which, fixtures and the patch, the looks, driving lights from sound and a controller, safety, and a check with TouchDesigner. [DMX lighting](https://openaudiovisual.com/docs/#dmx)
- **No light flashes more than 3 times a second.** The cap is held per fixture, in two layers. The engine slows the effects and chases that flash one light until they add up to 3 Hz there (`state(t).slowed` says which). Every `dmxTransport()` then puts each frame through a flash guard that holds what each fixture really emits, live values included: a kick drum on a dimmer at 180 bpm sixteenths, 12 flashes a second, leaves as 3. Blackout is never held back. Switching the guard off takes `{ flashGuard: false }`, and the monitor then shows FLASH GUARD OFF. [Safety](https://openaudiovisual.com/docs/#dmx-safety)
- **Three DMX sinks in the out-bridge.** `artnet` (unicast to the node by default, as Art-Net 4 asks), `sacn` (multicast or unicast, a priority, "stream terminated" on a clean stop) and `enttec` (an Enttec DMX USB Pro on a serial device): 40 frames a second while values change, a keep-alive each second, safe values when the page goes away (`"hold"` keeps a moving head where it points). Each holds every channel to 3 flashes a second, on by default; `"flashGuard": false` or an `exempt` list on the route for a head's pan and tilt, which a per-channel guard would otherwise make step.
- **Example 28, DMX lights.** One world draws a stage and drives 8 pars and 2 moving heads from the same params, with the monitor under it, on a simulated rig unless you ask for the bridge or an Enttec. [DMX lights](https://openaudiovisual.com/examples/28-dmx-lights/)
- **Fixed in `@openav/out`.** The page's heartbeat was skipped while values were queued, so a light that kept changing was put back on its safe value after half a second. The bridge read only the first 1024 items of a batch (now 4096). `install.sh` did not copy the DMX encoders, so an installed bridge with a DMX route did not start.
- **Not tested on real hardware.** No real fixture, Art-Net node, sACN receiver or Enttec interface has received any of this yet. The bytes follow the published layouts, and the tests decode every packet on this machine.
- **The first check on a unit from outside the project: the M-VAVE SMC-Mixer.** jcguevarap went through the verification page with one (firmware V012) and reported it in [#7](https://github.com/frank890417/open-audiovisual/issues/7). Every fader, strip button, transport button and arrow sent what the QLC+ profile lists, and the encoders count relative with a sign bit (1 one way, 65 the other), where the file had encoder 1 as absolute and encoders 2–8 as buttons. All eight are relative encoders now, and 52 of the 59 controls are marked checked on hardware, with that run in the file's `verifications`. Encoders 2–8 stay unverified until a run turns them. The file moved from `profiles/imported/` to `profiles/`, so a new import from QLC+ cannot undo the correction. [M-VAVE SMC-Mixer](https://openaudiovisual.com/controllers/m-vave-smc-mixer/)
- **The site's generators run on Windows.** There `node tools/build-home.mjs`, `node tools/build-docs.mjs` and `tools/export-controller.mjs` exited 0 having written nothing: their "was I run directly" check compared a file URL with a Windows path. Every command in `tools/` now asks one function, `isMain()` in `tools/site/is-main.mjs`, which also copes with a space in a folder's name and a symlinked checkout. Reported in [#8](https://github.com/frank890417/open-audiovisual/issues/8). The tests read Windows paths on macOS: nobody has run it on a Windows machine yet.
- **The out-bridge's tests no longer depend on how busy the machine is.** `tests/out.test.js` had stopped a release at least four times: the bridge, the page and the test share one event loop, so a pause longer than the watchdog's `timeoutMs` let the watchdog look before a heartbeat already on its way was read. `startBridge()` now takes a `now` clock and its result has `tick()`, one look of the watchdog, so the tests move the bridge's time by hand (one test keeps the real clock and timer), and `OutClient` says how often it beats in `beatMs`. With the test process frozen at random for 0.3 to 1.5 s at a time, the old file failed 10 runs of 10 and the new one none. [startBridge](https://openaudiovisual.com/docs/reference/#out-startBridge)

### 2026-11-24

- **Hands, read the way a performer plays them.** `HandTracker` now names seven gestures per hand (fist, open, point, thumb up, thumb down, victory, I love you) and turns a pinch into an event: `hand/<side>/pinch-start` and `pinch-end`, only with the other three fingers out, so a fist is not a pinch. Each hand also gives its index fingertip, thumb to every fingertip, how open it is and its angle, and both hands their distance, midpoint and tilt. Every state starts once and ends once (two thresholds and an 80 ms hold). The numbers are the TouchDesigner `hand_features` module's, tuned on real hands. [Body and hands](https://openaudiovisual.com/docs/#inputs-body-and-hands)
- **See what the camera sees.** `hands.overlay(ctx, w, h, { video: true })` draws the camera picture, the skeleton, the pinch line and its value, the angle, the gesture and the distance between the hands. `hands.feed(result)` plays recorded or made-up hands through the same signals. Example 27, Hand gestures, shows all of it, with two simulated hands until the camera is on.
- **MediaPipe 1.2.3.** Hands and body load MediaPipe Tasks Vision 1.2.3 instead of 0.10.14: on the same frames it gave the same landmarks, gestures and body, in about the same time. `hand/<side>/pinch/index`, `pinch/middle` and `spread` keep their old values.

### 2026-11-15

- **The framework has a version, and an address that stays put: 0.9.0.** A page of your own imports one file, `packages/openav.js`, from an address with the version in it, and that address never changes. No clone, no build. [Pin a version](https://openaudiovisual.com/docs/#quick-start-pin-a-version)
- **A show in one file.** Save `show.html`, serve the folder, open it: a World, a timeline, the console and the piano, from one `import`. [One file, no clone](https://openaudiovisual.com/docs/#quick-start-one-file-no-clone)
- **Made with.** A page of the works, tools and classes that run on open-audiovisual, each added by the person who made it, with a badge and a form to add yours. [Made with](https://openaudiovisual.com/made-with/)
- **A page says what it runs on, and sends nothing to say it.** `createShow()` leaves `<meta name="generator" content="open-audiovisual 0.9.0">` in the page and `window.openav.version` on the show; `signature: false` leaves the tag out. [Telemetry](https://openaudiovisual.com/docs/#controllers-telemetry)
- **The curves panel.** `C` on the desk opens the whole show's automation as curves: the segments along the top, a cursor at now, the values you have overridden by hand and a way back for each. Click to seek. [The curves panel](https://openaudiovisual.com/docs/#show-control-the-curves-panel)
- **Several pages, one show.** One page leads and the others follow its clock, in one browser or across machines over the relay: `createShow({ sync: { role: 'leader', channel: 'hall' } })`. New package `@openav/sync`. [Several pages, one show](https://openaudiovisual.com/docs/#show-control-several-pages-one-show)
- **Curves written per segment.** Automation can be written against a segment of the score (`p` from 0 to 1 inside it), so a shorter cut moves every curve with it; automation saves and loads as JSON; a timeline can be anchored to the wall clock and reports its drift. [Lanes](https://openaudiovisual.com/docs/#show-control-lanes-curves-written-per-segment)
- **A knob that nudges, and one that waits.** A route can `trim` the timeline's value instead of replacing it, or `pickup` only once the knob reaches the value on screen, and `release` hands the param back. [Trim, pickup and release](https://openaudiovisual.com/docs/#mapping-trim-pickup-and-release)
- **Frames you drive yourself, keys you choose.** `createShow({ loop: 'manual' })` steps the show frame by frame (recording, tests, headless); `console: { keys }` moves the desk's letters off the piano's; `monitor: false` or `{ url }` chooses the backstage feed, which can now carry the work's own numbers.
- **`keepAwake()` on an iPad.** It asks for the wake lock again on the first tap, because Safari only grants it after a touch. Not yet checked on a real iPad.

### 2026-11-06

- **Imported controllers are recognised when plugged in.** The library fetches that one file and shows the device, after the shipped profiles have had their say. Port patterns are whole model names, so a near name stays unmatched. [Library](https://openaudiovisual.com/controllers/#imported)
- **The verification page checks the lights and keeps your place.** After the controls it lights every LED it can reach, then goes one at a time if something stayed dark, and a run comes back after a reload. [Verify](https://openaudiovisual.com/controllers/verify/)

### 2026-11-05

- **Check a controller with your own hands.** [Verify](https://openaudiovisual.com/controllers/verify/) lights one control at a time, compares what your unit
  sends with the file, and hands back the updated JSON with your name, date and firmware beside each result. Nothing but a real unit
  can mark a control as verified: a profile refuses `verified: true` without a hardware entry in its new `verifications` log.
- **SysEx, when you ask for it.** Seven controllers now list their mode switches, templates and LED messages as data, each with the page of the manual it comes from, and
  a device's page shows them with a Send button. `<oav-controller sysex>` adds a button that switches SysEx on, sets the unit up on every connect, and makes `setLedColor()` work. Nothing asks for the permission by itself. [Launchpad Pro MK3](https://openaudiovisual.com/controllers/novation-launchpad-pro-mk3/#sysex)
- **The same controller, in other software.** Each device page has a QLC+ input profile and a Mixxx mapping to download, and `tools/export-controller.mjs` writes them from any profile. [Launchpad Pro MK3](https://openaudiovisual.com/controllers/novation-launchpad-pro-mk3/#other-software)
- **28 more controllers, from QLC+.** Its input profiles (Apache-2.0) are converted with their source and commit in each file, with generated layouts and every control marked unverified until someone checks one. [Library](https://openaudiovisual.com/controllers/#imported)
- **Room in the format for more.** A profile can now carry `sysex` (mode switches, templates, LED colours, each message citing its source) and `palette`
  (the LED colour table), and [`profile.schema.json`](https://openaudiovisual.com/packages/midi/profile.schema.json) describes the format for software that does not run this package.

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
