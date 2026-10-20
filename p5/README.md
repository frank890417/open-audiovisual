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

## Note names (0.8)

Wherever a note number goes, a name goes too: `noteIsDown('C4')` is `noteIsDown(60)`, `midi.play('C#4', 0.8)` sends
note 61, `midi.isDown('Eb3')` asks the key. Three small converters: `noteNumber('C4')` → `60`, `noteName(61)` → `'C#4'`
(`{ flats: true }` → `'Db4'`, `{ octave: false }` → `'C#'`), `noteFreq('A4')` → `440` Hz (`noteFreq(69)` too; for a sketch that
makes its own sound; not `midiToFreq`, which is p5.sound's).
A name is A–G in either case, an optional `#` or `b` (`♯`, `♭`), and the octave: `C4`, `c#4`, `Db3`, `C-1` … `G9`.
**C4 = 60** (scientific pitch notation); some software (Ableton, Yamaha) calls 60 "C3". Strudel's spelling (`c4 e4 g4`) works.
A name that is not one stops with a card: letter A–G + optional # or b + octave, like C4, F#3, Bb2. Numbers behave as
before (`& 127`), and `notePressed(note, velocity)` still hands you a number. Example: `examples/note-names/`.

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
| `drumsAreOn` | | `drumHit(lane, velocity)` | every hit, every drum (a rhythm line's `crash`, `ride`, toms too) |
| `drumStep` | 0..15, the step that just played | `kickDetected(level)` | kick |
| `drumBar` | 1, 2, 3 … since `startDrums()` | `snareDetected(level)` | snare and clap (and rim) |
| `drumBpm` | the tempo (the grid's slider moves it too) | `hatDetected(level)` | hat (and open / pedal hat) |
| `drumPhase` | 0..1 through the bar, smoothly, as heard | `beatDetected(level)` | a kick or a snare, once per step (`beat` too) |
| `beatPhase` | 0..1 through the beat (a quarter note), as heard | `rhythmChanged(src, how)` | the line changed (0.7: a click, a key, ↶, `startDrums()`) |
| `startDrums(pattern, bpm)`, `stopDrums()` | | | |
| `drawRhythm(x, y, w, h, style)` | the rhythm on the canvas (0.7, below) | | |

`rotate(drumPhase * TWO_PI)` turns a shape once a bar; `1 - beatPhase` swells on every beat and shrinks until the next one.
Both are read at the moment of the read from the time the sound reaches the speakers, so they move smoothly between frames
and never run ahead of what is heard.

Patterns: `'four on floor'`, `breakbeat`, `'half time'`, `latin`, `sparse`, or your own:
`startDrums({ kick: 'x...x...x...x...', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.' })` (a lane left out is silent),
or one line of rhythm (next section). Calling it again while it plays changes the pattern or the tempo without restarting.
The grid names its lanes in the page's language (大鼓 小鼓 鈸 拍手 in a Chinese browser), shows the bar it is in, and marks the
step that sounds (a yellow column, 13:1 against the card). The kit is @openav/drums' synthesized
one (no samples); like sound it is heard from the first click, while the callbacks run from the start. A sketch that started
the machine and defines `kickDetected()` no longer opens the microphone on the first click (one that reads `micLevel` still
does, and then both call it). The grid sits at the top centre: on OpenProcessing between the 🎹 and OPC's icon, below the 🎹
panel while that is open, clear of the console. – folds it, × stops the machine, and 🥁 in the 🎹 panel opens and closes it
with no code (🥁 opens it stopped: tick its play box to hear it; a sketch's `startDrums()` plays at once). `OAVp5.drums` (`state`, `step`, `bar`, `bpm`, `pattern`, `cues`, `machine` = the `mountDrums` handle,
`on('hit' | 'step' | 'bar' | 'cue', fn)` → `off()`, `phase`, `beatPhase`, `now` = `{ bar, step, phase, beatPhase, tokens, mode,
text }`, `clock` = which clock moves it).

**On time, even when the sketch is heavy or hidden (0.6).** The hits are handed to the kit ahead of time on its audio clock:
a heartbeat in a Web Worker wakes every 25 ms and schedules what falls in the next 0.1 s at its exact time (Chris Wilson's
[A tale of two clocks](https://web.dev/articles/audio-scheduling)). Measured on the kit's output with a `draw()` that keeps the
page busy 30 ms a frame (`p5/test/timing-probe.cjs`): the spread of the kick-to-kick interval is 0.000 ms, where 0.5 had 15 ms
(a hit waited for the next frame). The callbacks still come in a frame: the one in which each hit is **heard** (its time plus
the output latency the browser reports, `drumlatency=` to set your own), right before your `draw()`, in the same order as
before. A tab in the background keeps playing and counting (`drumBar` follows the clock on the wall, cues fire, one
`barStarted` a bar), but the hits and `stepStarted` are not told while nobody can see them, and nothing is told twice when
the tab comes back. If a `draw()` ever holds the page longer than 0.1 s, the machine looks 0.3 s ahead from then on (🩺 says
so; a click on a cell is then heard up to 0.3 s later). `drums=frame` brings back 0.5's frame-driven machine, as a safety net.

### One line of rhythm

```js
function setup() {
  startDrums("bd*4, [~ sd]*2, hh*8", 110);   // kick on every beat, snare on 2 and 4, eight hats
}
```

Any text that is not a pattern name is a line of rhythm. The line shows over the grid and the word that sounds lights up
and fades. The writing, in short: words are drums (`bd` kick · `sd` snare · `hh` hat · `oh` open hat · `cp` clap · `rim` ·
`lt` `mt` `ht` toms · `cr` crash · `rd` ride · `cb` cowbell), `~` is a rest, words share the bar evenly, `[ ]` shares one place,
`*4` plays it four times there, `,` lays lines on top of each other, `<a b>` takes one a bar, `bd(3,8)` spreads 3 hits over 8
steps; the full list is [@openav/pattern](../packages/pattern/README.md)'s, loaded from next to this file with the drums.
Drums with no lane on the grid (crash, ride, toms, open hat) get a row of their own and call `drumHit()`; hits off the 16 steps
(a triplet) are drawn where they fall inside their step. A mistake in `startDrums("…")` shows a card, in the page's language,
with the character it is at, why and how to fix it (`節奏字串第 4 個字有問題` · `"bd ⟦[⟧sd"` · `補上 ]`), and the machine plays
`'four on floor'` meanwhile; `'x...x...'` alone (the grid's lane text) says to put it inside `{ kick: … }`.

A line copied from strudel.cc plays too (0.7): `startDrums('s("bd*4, [~ sd]*2").fast(2)')` is `[bd*4, [~ sd]*2]*2`. Read:
`s("…")` / `sound("…")` with `"`, `'` or `` ` ``, several `$: s(…)` as layers, `.fast(n)`, `.slow(n)`, and `setcpm(x)` /
`setcps(x)` as the tempo when `startDrums()` gives none. `.bank(…)` is left out with a card (OAV's kit is its own); any other
call (`.jux(rev)`, `.every(…)`, `.gain(…)`, `note(…)`) gets a card that says OAV does not do it yet and points at
"Open in Strudel"; the rest plays.

The way of writing one line of rhythm comes from TidalCycles / Strudel ([strudel.cc](https://strudel.cc)); OAV implements it
independently from their public documentation.

### The cells and the line edit each other (0.7)

The line over the grid is always there (a preset shows its grid as a line: `'four on floor'` is `bd*4, [~ sd]*2, hh*8`).

| do | what happens |
|---|---|
| click a cell | the line is rewritten (`@openav/pattern`'s `fromGrid`) and plays at once: steady hits `bd*4`, one per group `[~ sd]*2`, a Euclidean rhythm `bd(3,8,2)` (r = starts r steps later, as strudel.cc plays it), else beat by beat `bd [~ ~ ~ bd] bd*2 ~`. A line the 16 steps cannot hold (triplets, `< >`, `/2`, `?`, `bd:2`): the first click shows a card saying what would go, the next one rewrites it |
| type in the line | Enter, or 400 ms without a key, plays it and the cells follow; a mistake is marked red with a card, and the last line that worked keeps playing (not `'four on floor'`); Escape drops what is not played yet; the keys never reach `keyPressed()` |
| ↶, or ⌘Z / Ctrl+Z after touching the card | back one line (`OAVp5.drums.history`, oldest first; `OAVp5.drums.undo()`) |
| Copy | `startDrums("…", bpm)` on the clipboard |
| Open in Strudel | a new tab at `https://strudel.cc/#<base64 of the code>`: `// from the OAV drum machine`, `setcpm(bpm/4)` (an OAV bar is a Strudel cycle of four beats), `s("…")` with Strudel's drum names (`kick` → `bd`). `OAVp5.drums.strudelUrl` |

`function rhythmChanged(src, how) {}` hears every new line (`how`: `'code'` · `'cell'` · `'type'` · `'undo'` · `'menu'`), and so
does `OAVp5.drums.on('rhythm', fn)`. `OAVp5.drums.src` is the line playing, `OAVp5.drums.edit("…")` plays one as if typed.

### The rhythm on the canvas: drawRhythm (0.7)

The card is DOM, so a recording (the canvas alone) never has it; `drawRhythm()` draws on the canvas:

```js
drawRhythm(20, 20, 360, 90, 'grid');        // 16 steps, a row per drum that plays, a playhead
drawRhythm(20, 130, 300, 300, 'circle');    // a ring of 16 per drum, a hand turned by drumPhase
drawRhythm(340, 130, 300, 300, 'spiral', { bars: 4, colors: { kick: '#ff7b54' } });   // the last bars wound outwards, now at the tip
```

A hit lights up the moment it is heard (the clock `drumPhase` reads); triplets sit where they fall. Options: `colors`
(`{ voice: color }`), `color` (all), `off` (empty steps), `playhead` (a color or `false`), `bg`, `bars` (spiral, default 4). It
draws inside `push()` / `pop()` with p5's own shapes (rect, beginShape, line, circle), so 2D and WEBGL, p5 1.x and 2.x; in
WEBGL (0, 0) is the middle of the canvas: `drawRhythm(-width / 2, -height / 2, width, height)`. No box: a strip along the
bottom (`'grid'`) or a square in the middle. `OAVp5.drums.draw(…)` is the same. Example: `p5/examples/rhythm-visual/`.

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

## Values over time: lag, env, speed, spring, trail

A knob or `micLevel` jumps; what looks good is how it moves between the jumps. TouchDesigner does this with CHOPs; the
same operators are here, one call each in `draw()`, nothing to declare, and seconds are seconds (the same curve at 30 and
at 144 fps):

```js
circle(width / 2, height / 2, 50 + lag(micLevel, 0.03, 0.4) * 300);   // a VU meter: opens at once, closes slowly
scale(1 + env('kick', 0.01, 0.3));                                     // the drum machine: every kick swells it, gone in 0.3 s
rotate(spring(knob1, 100, 6) * TWO_PI);                                // flick a knob: it overshoots and settles
```

| TouchDesigner | oav-p5 | |
|---|---|---|
| Lag CHOP (Lag 1 / Lag 2) | `lag(value, up, down)` | follows `value`: `up` seconds while it rises, `down` while it falls (`down` = `up` if left out; 0.1) |
| Trigger CHOP (attack, decay) | `env('kick', attack, decay)`, `trigger('boom')` | 0..1: up to 1 in `attack` seconds after each event, back to 0 in `decay` (0.01, 0.3). Events: `'kick'` `'snare'` `'hat'` `'beat'` (the microphone or the drum machine, the hits `kickDetected` hears), `'note'` (any key), `'bar'` `'step'` (the drums), a cue's name, `trigger('boom')`; or a switch: `env(mouseIsPressed, …)` |
| Speed CHOP | `speed(rate)` | adds `rate` every second: `rotate(speed(TWO_PI))` turns once a second |
| Spring CHOP | `spring(value, stiffness, damping)` | follows like a mass on a spring (100, 6: two or three bounces; damping 20: none) |
| Trail CHOP | `trail(value, seconds)` | the last `seconds` (2) as an array, 60 values a second, oldest first, the newest last |
| Slope CHOP | `slope(value)` | how fast it changes, per second |
| Count CHOP | `count(beat)`, `count(beat, 4)`, `count('kick')` | how many times it turned on; with 4: 0 1 2 3 0 …; a name: how many of those events so far |
| a CHOP's viewer | `scope(value, 'label')` | a small plot in the corner of the page (below) |
| | `drawTrail(values, x, y, w, h)` | the same plot on the canvas, in the work and in a recording |

**Seconds, the same as in TouchDesigner.** A lag's seconds mean what a Lag CHOP's do: about the time the value takes to
follow 90% of a jump, so `lag(x, 0.1)` here moves like a Lag CHOP set to 0.1 ([Lag CHOP](https://docs.derivative.ca/Lag_CHOP)).
Underneath it is a one-pole lag with a time constant of seconds ÷ 2.3 (ln 10); `@openav/mapping`'s `smooth` keeps its
own 63% time constant. Attack and decay are lengths in both.

**Nothing to declare.** The first `lag()` in `draw()` keeps the first lag's memory, the second the second, every frame;
`spring()`, `speed()`, `trail()` … are counted each on their own. Put one inside an `if`, or in a loop whose length
changes, and the order slips: a card says so, and from then on oav-p5 matches each call by the line it is written on. The
sure way is a name, a string at the end: `lag(p.size, 0.1, 0.5, 'p' + p.id)`. A named one is the same wherever it is called,
`draw()`, `setup()` or `mousePressed()`; an unnamed one outside `draw()` has nothing to remember by and returns its input
(`speed` 0, `trail` `[]`), and a card says that too. `env()`, `trigger()` and `count('kick')` are about events and work
anywhere. A sketch with its own `speed` or `count` keeps it; `OAVp5.chop.speed(…)` is the same function under another name.

**Seeing the values.** `scope(value, 'label')` returns `value`, so it can wrap an expression:
`circle(x, y, scope(lag(micLevel, 0.03, 0.4), 'lag') * 300)`. Each label is one line in a small oscilloscope across the
page from the 🎹: the last 4 seconds and the value now; `scope(micLevel, 'mic')` beside it shows what the lag did. It lives
on the page, not on the canvas: never in a recording or a 📷, never in the way of a click; `hints=off` or `scope=off` hides
it. To draw it in the work: `stroke(255); drawTrail(trail(micLevel, 3), 0, height - 100, width, 100)` (or
`drawTrail(micLevel, …)`, which keeps its own 2 seconds): 0 at the bottom of the box, 1 at the top (`lo`, `hi` after `h`),
the sketch's `stroke()` (white under `noStroke()`).

The math is [@openav/chop](../packages/chop/README.md), loaded from next to this file the first time one of these is called;
until it arrives (a few frames) each returns its input as it is. What each parameter means follows Derivative's
TouchDesigner documentation; the code is OAV's own. Raw against lagged, side by side, with the scope: `p5/examples/lag/`.

## Recording: the canvas and its sound, one file

```js
function keyPressed() {
  if (key === 'r') recordingIsOn ? stopRecording() : startRecording();   // startRecording(10): ten seconds, then it stops
}
function recordingSaved(info) {}   // { name, blob, url, format: 'mp4' | 'webm', type, seconds, bytes, width, height, fps, audio, heard, sources, warnings }
```

| call / read / define | |
|---|---|
| `startRecording()`, `startRecording(seconds)`, `startRecording({ seconds, fps, mic, name, canvas, bitrate })` | a promise: `true` once it records |
| `stopRecording()` | a promise of the `info` above, once the file is saved and checked (`null` when nothing ran) |
| `recordingIsOn` | |
| `recordingSaved(info)` | the file is saved; `OAVp5.record.on('start' \| 'saved', fn)` → `off()` hears the same |

**⏺** in the 🎹 panel does it with no code: the button turns into ⏹ and the time, and the 🎹 button itself grows a red dot and
the time, so a closed panel still shows a take is running (a click on the dot stops it). **📷** saves the canvas as a PNG
(`OAVp5.record.shot()`), named `oav-<date>-<time>.png`: the canvas alone, which a screenshot is not (p5's own
`saveCanvas('name', 'png')` is the same from code). For the course's
audiovisual assignment (ten stills and one video): 📷 for the stills while it plays, ⏺ for the video.

- **Picture.** The p5 canvas, found as the largest visible `.p5Canvas` (not by id: p5 2.3.4's main canvas can be
  `#defaultCanvas1`, and 2.x gives hidden `createGraphics()` buffers the same class), 2D or WEBGL, at its pixel size
  (`pixelDensity` included), 30 fps (`recfps=60`). Only the canvas is captured, so the 🎹, the drum grid, the cards and OPC's
  panel never show. Bitrate 0.16 bit per pixel per frame, at least 4 and at most 16 Mb/s (24 at 60 fps): 1080p30 ≈ 10 Mb/s.
  H.264 is even-sized: a 641×361 canvas is a 640×360 MP4 (and `info` says so).
- **Sound.** Everything this file makes: `startSound()`'s Tone.js, the drum kit (the machine and the pads), the microphone
  while it is on, p5.sound 1.x (`p5.soundOut`). Each plays in an `AudioContext` of its own, and Chrome's MediaRecorder keeps
  only the first audio track of a stream, so each is bridged (`createMediaStreamDestination` in its context →
  `createMediaStreamSource` in one more) into a single mix, with a limiter above −2 dBFS so several at once never clip; the
  speakers are untouched. A source that comes on during a take (🔊 halfway, `startMic()`) joins it within a quarter second.
  The mix's context is made inside the click that started the take; started from `setup()`, it resumes on the first click.
- **Not recorded.** The p5.sound made for p5 2.x (0.x, on its own Tone.js) connects every node straight to its context's
  speakers and has no master output: what it plays cannot be tapped (only nodes connected after a hook is installed could
  be, and a hook on `AudioNode.prototype.connect` from the page's first line would change every sketch), so a card says so
  (`recP5sound`) and points at p5 1.11 or `startSound()`. A sketch's own Tone.js or Web Audio is not tapped either.
- **The file.** MP4 (`video/mp4;codecs=avc1.640033,mp4a.40.2` first: @openav/record's `VIDEO_MIMES`, MP4 first) where the
  browser writes it (Chrome 126+, Edge, Safari), else WebM; an MP4 the browser accepts and then refuses at `start()` (no
  encoder on that machine) falls back to WebM. The recorder is [@openav/record](../packages/record/README.md)'s `Recorder`
  (`packages/record/recorder.js`, loaded the first time; it timestamps picture and sound from one clock). A take stops by
  itself at `reclimit` (300 s). On a computer the file downloads at once; on a phone (`pointer: coarse` and
  `navigator.canShare({ files })`) the card carries **Share** and **Download**, because Web Share needs the tap itself.
- **Checks** (the 水裡學 lessons): the saved card (format, length, size, size in pixels, sound or silent), then `recEmpty`
  (under 4 KB), `recWebm` (Instagram will not take it), `recNoAudio` / `recSilent` (a source was on but nothing reached the
  mix: its analyser peak stayed under −80 dBFS), `recBlack` (three frames of the file itself, at 30, 60 and 90 %, all black
  while the canvas was not: WebKit 229611, Safari recording a WebGL canvas), `recTainted` (a cross-origin image on the canvas),
  `recNone` / `recNoCanvas`, `recLimit`, `recError`. `info.warnings` lists them.
- A sketch that never records builds no `MediaRecorder` and no `AudioContext` and loads nothing: the only new thing it sees
  is ⏺ and 📷 in the panel. A sketch's own `startRecording` or `recordingIsOn` is left alone (⏺ still works).

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
| recording: started · saved (format, length, size, sound) · no sound reached it · WebM · black · almost empty · another site's image · no recorder | how to stop · the file is in Downloads / Share · click, play, again · Chrome 126+ or Safari · Chrome on a computer · reload · upload the image · another browser |

MIDI troubles are said only to a sketch that plays from MIDI (it defines a MIDI callback or reads a knob); a sketch that uses
none of this never sees a card. `hints=off` keeps them in the console. `OAVp5.hints` lists what was said.

**🩺 Check-up.** 🩺 in the 🎹 panel, or `OAVp5.check()`, opens a card with the version, the page (framed or not, https),
the browser, the microphone (state, error, level), MIDI (Web MIDI, hardware, devices, the last message), sound, drums,
recording (MP4 or WebM here, fps, the limit, the last take), the wiring, the sketch's own names and the hints shown: one screenshot for Discord, a *copy* button, and a link to the site's
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
`pitchBend`, `midiMessage(bytes, source)`; `midi.on(event, fn)` → `off()`; `midi.play(60, 0.8)` (or `midi.play('C4', 0.8)`), `midi.isDown('C4')`; `midi.wiring()`.
A sketch with its own Web MIDI code (`navigator.requestMIDIAccess`, WebMidi.js) also hears the screen and the phone
as one more input, **OAV Virtual MIDI**, after the real ports.

## Other programs: Strudel, a clock, a linked page (0.7)

- **What a program plays into "OAV Virtual MIDI" is heard.** Strudel's `note("c3 e3 g3").midi('OAV Virtual MIDI')`, a
  WebMidi.js sketch's `output.send(bytes, timestamp)`: `notePressed()`, `knob1`, the pads, `startSound()`'s instrument, as from a
  keyboard, at the timestamp it gave (Strudel sends 0.21–0.32 s ahead; measured on strudel.cc: 10 notes, none later than 4.5 ms, `p5/test/strudel-smoke.cjs`; `drumPhase` follows Strudel's clock to 0.1 ms).
  `midi.last.source` is `'virtual-out'`. What came in on the output never goes back out of the virtual input (Strudel's
  `midin` ↔ `.midi` would play each other forever); `output.clear()` drops what waits, a waiting note-off lands at once.
- **An external clock is followed.** 0xF8 ×24 a beat, start / continue / stop, song position (`midicmd("clock*96, <start
  stop>/8")` in Strudel, a DAW over IAC, a drum machine on a cable) → `drumPhase`, `beatPhase`, `drumBar`, `drumStep`, `drumBpm`;
  a drum machine that is up (`startDrums()`) plays at its tempo on its downbeat and starts / stops with it (its card says
  "following an external clock · 128 BPM"); a start sent three times with one timestamp counts once. `OAVp5.clock.info`
  `{ state, bpm, running, following, source, clocks, dupes, … }`, `OAVp5.clock.phase`. Measured at 128 bpm on strudel.cc:
  `drumPhase` within 1.2 ms of Strudel's bar, kicks within 6 ms of its beat (three runs). `clock=off` ignores it; with no clock nothing changes.
  The counting is @openav/midi's `MidiClock` (`packages/midi/clock.js`), the steering `DrumTransport.follow()`.
- **`link=<room>`: pages hear each other's programs.** Every OAV page with the same room — another tab, another computer —
  gets what this page's programs play into the virtual output (notes, CCs, the clock), over the phone relay, played there
  when it sounds here (`midi.last.source` `'link'`; @openav/relay's `MidiLink`, `packages/relay/link.js`, says how two
  clocks are lined up). Measured, two tabs over wss://remote.cheyuwu.com (one way ≈ 61 ms): within −3 … +7 ms of Strudel's
  timestamps (two runs). From strudel.cc keep a `wss://` relay: Chrome blocks its way to `ws://127.0.0.1` (local-network checks). Nothing received is sent on; a linked note a program plays back out within 600 ms is held back as an echo.
  `linkdelay=` (ms) buffers more. The room is the phones' room too. 🎹 grows a 🔗 (green: another page is there) and the
  panel says room, pages and trip; `OAVp5.link.info`. `p5/examples/with-strudel/` is the sketch side.
- **In Strudel** (strudel.cc, or `note()` and `s()` with `stack()` / `samples()` already on the page; `strudel=on|off`):
  one card says which names Strudel owns (`note`, `velocity`, `beat`: left alone) and what to read instead; MIDI is asked
  for by Strudel's `midin()`, not at load (`hardware=click`); the 🎹 panel is a box in the corner a third of the window high
  (`compact`), the 🎹 sits above Strudel's side-panel buttons; the wiring line says "(your code)".
- **🩺 "Other programs":** whether anything asked for OAV Virtual MIDI (no ⇒ "this page opened MIDI before oav-p5 loaded:
  reload", Strudel's silent failure), how many listen on its input, what came out of its output and when, the clock, the
  echoes held back, the link (room, pages, one-way trip, late notes).
- The whole chapter, with three recipes run on strudel.cc and the credits: [docs → With Strudel](https://openaudiovisual.com/docs/#strudel).
  OAV contains no Strudel code and calls none of it; they meet over MIDI.

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
| `hardware` | `auto` (ask at once) · `click` (ask from the 🎹 panel) · `off` | `auto` (`click` in Strudel) |
| `panel` | `closed` (just 🎹) · `open` · `off` | `closed` |
| `profile` | any @openav/midi profile id (`akai-lpd8`, …) | follows the plugged-in device, else `arturia-minilab3` |
| `opc` | `on` · `off` | `on` |
| `mic` | `auto` (the first read asks for the microphone) · `click` (only 🎤 / `startMic()`) · `off` | `auto` |
| `hints` | `on` (cards beside the 🎹) · `off` (the console only) | `on` |
| `scope` | `on` (`scope()` draws in the corner across from the 🎹) · `off` (`scope()` only returns its value); `hints=off` turns it off too | `on` |
| `sound` | `click` (`startSound()` or 🔊) · `off` · an instrument id (`piano`, `organ`, …: heard from the first click, no code) | `click` |
| `tone` | where Tone.js 15 comes from (an ES module URL) | `https://cdn.jsdelivr.net/npm/tone@15.0.4/+esm` |
| `dock` / `corner` | `bottom`·`top` / `right`·`left` | top-left on OpenProcessing, bottom-right elsewhere |
| `shim` | `on` · `off` (the virtual port) | `on` |
| `relay` / `room` | the phone relay and room | `wss://remote.cheyuwu.com/relay` / one per browser |
| `telemetry` | `off` · `on` (@openav/midi's anonymous page-load hit) | `off` |
| `record` | `on` · `nomic` (the microphone stays out of recordings) · `off` (no ⏺ / 📷, `startRecording()` does nothing) | `on` |
| `recfps` / `reclimit` | frames a second (1–60) / seconds a take lasts at most | `30` / `300` |
| `title` | a name in the recorded files: `oav-<title>-<date>-<time>.mp4` | none |
| `drums` | `lookahead` (scheduled ahead on the audio clock) · `frame` (0.5's machine, moved by the frames: a safety net) | `lookahead` |
| `drumlatency` | `auto` (the output latency the browser reports) · milliseconds (a Bluetooth speaker: try `200`) | `auto` |
| `link` | a room: OAV pages with the same one hear each other's programs, over the `relay` (0.7) | none |
| `linkdelay` | milliseconds of extra buffer on a linked page's notes | `0` |
| `clock` | `follow` (an external MIDI clock moves `drumPhase` & co. and a drum machine that is up) · `off` | `follow` |
| `strudel` | `auto` (strudel.cc, or Strudel's functions on the page) · `on` · `off` | `auto` |
| `compact` | `on` (the 🎹 panel as a box in the corner, a third of the height) · `off` | `on` in Strudel |
| `debug` | `1`: trace clicks and loading in the console | off |

## Size, versions

`oav-p5.js` is about 229 KB (79 KB gzip; its hints are in two languages) and loads nothing else until 🎹 is opened (then `packages/midi/element.js` and
its modules, ~130 KB transferred, from next to it), the microphone is read (`packages/audio`, ~7 KB), a phone is asked for (`packages/relay`, a QR encoder),
an unknown controller is plugged in (`packages/midi/profiles`), sound is turned on (`packages/sound`, ~21 KB gzip, Tone.js ~230 KB
from jsDelivr, and the piano's 2 MB of samples when the piano is picked), the drums are (`packages/drums`, ~22 KB gzip, and `packages/pattern`, ~15 KB gzip, beside it), a take is
recorded (`packages/record/recorder.js` with its `mime.js` and `layout.js`, ~9 KB gzip), an external clock arrives (`packages/midi/clock.js`, ~4 KB gzip)
`link=` is set (`packages/relay/link.js` with the relay client, ~6 KB gzip), or `lag()` and its family are first called (`packages/chop`, ~5 KB gzip). Because it loads the rest of OAV from next to itself,
one URL pins one tree: `openaudiovisual.com/p5/oav-p5.js` is the latest; `cdn.jsdelivr.net/gh/frank890417/open-audiovisual@<tag>/p5/oav-p5.js` is frozen.

## Tests

- `node --test tests/p5-inject.test.js` (part of `npm test`): parsing, the p5-style names, device numbering checked
  against the profiles, pads, unknown devices, OPC wiring and the OpenProcessing hand-over, names a sketch already owns;
  the microphone; sound through the real `@openav/sound` with a stand-in Tone.js (the click, the pads, the pedal, a sampler's
  fallback first), the drum callbacks, `beat`, cues, and a microphone sketch moved to the drums; the hints (which ones, when,
  in which language, the file and line of a callback's error, a sketch's own `let note`), `micLevel` for a quiet voice and a shout,
  a room that hums, `micSensitivity()`, a knob read under OPC, and `OAVp5.check()`; 0.6: `drumPhase` / `beatPhase`, a step told
  quietly, the order of the callbacks on the real lookahead clock, `startDrums(arg)` sorting names, grids and lines of rhythm,
  the mistake cards (zh / en), @openav/pattern missing; 0.7: a line copied from strudel.cc (quotes, `.fast`, `setcpm`, the
  `.bank` / `.jux` cards), `rhythmChanged` and `drums.on('rhythm')`, the lossy-click and typing cards, `OAVp5.drums.src` & co.,
  `drawRhythm` grid / circle / spiral against a recording fake p5 (cells, hits, the lit one, the playhead, push/pop, WEBGL's
  centred box). `tests/pattern.test.js` has `fromGrid` (the presets, each rule, 1000 random grids round-tripped), `toGrid`,
  `fromStrudel`, `toStrudel` / `strudelUrl` (against the links strudel.cc's address bar showed). `tests/drums-clock.test.js` has the clock itself under a fake clock and a
  fake AudioContext: 1000 bars with no drift (< 1 µs), the heartbeat alone (no frames), a tempo change mid-bar (nothing twice,
  nothing missing), nothing heard before the click and no backlog after it, the order, a hidden tab, a stalled frame loop, the
  lookahead growing, a pattern change heard at once, triplets and a crash, the phases, the output latency.
- `node --test tests/strudel-link.test.js tests/external-clock.test.js` (part of `npm test`; 0.7): a program's output heard at its
  timestamps and in order, no loop between the virtual output and input, `output.clear()`; Strudel's clock (start ×3, 0.25 s
  ahead) moving `drumPhase` & co. and a drum machine (start, tempo, stop), `clock=off`; `link=` sending with times, receiving
  on time, an echo held back; `MidiLink` over a real local relay (on time, not its own, once each, late ones at once) and its
  clock-difference estimate; Strudel's names, `hardware=click`, compact; 🩺's row. `MidiClock` (tempo, dedupe, the downbeat
  either way round, stop / continue / song position, a clock with no start) and `DrumTransport.follow()` under a fake audio clock.
- `PW=<playwright> CHROME=<binary> [RELAY=live|local] [ONLY=page,link,recipes] node p5/test/strudel-smoke.cjs`: on the real
  strudel.cc, oav-p5 served from this checkout: `.midi('OAV Virtual MIDI')` → `notePressed` (ms against Strudel's timestamps),
  `midikeys` → `.midi` with no loop, Strudel's clock → the drum machine and `drumPhase` (ms), the stop, the compact panel and 🩺,
  two tabs in one room (ms), the docs' three recipes as written (prebake, knob1 heard, micLevel, Hydra on Strudel's clock).
- `node --test tests/chop.test.js` (part of `npm test`): `@openav/chop` under a fake clock — a lag of 0.1 at 90% after 0.1 s (TouchDesigner seconds),
  30 fps against 144 fps (a knob moved in steps: equal; a 1 Hz sine: within 3%), the envelope's attack, decay and retrigger,
  springs (bounce, critical, a 10 s step), the trail's fixed length; then 0.7's `lag()` family in `oav-p5.js`: passing through
  until the module arrives, the Nth call is the Nth slot, a name is its own, outside `draw()`, a call inside an `if` (the card,
  matching by line, the borrowed frame undone), `env('kick')` from the drums and the microphone, `env(gate)`, a name nobody
  triggers, `drawTrail()`'s line.
- `p5/test/chop-smoke.cjs` (same arguments; a fake microphone): p5 1.11.11 and 2.x — none of the new names is a p5 / p5.sound
  name; an old sketch loads no `packages/chop` and shows no scope; `lag(micLevel, …)` rising quickly and falling on its own time;
  `env('kick')` jumping to 1 on each kick of the drum machine and falling; the scope in its corner, missing from a recorded frame
  while `drawTrail()` is in it; `p5/examples/lag/`.
- `p5/test/timing-probe.cjs` (same arguments; `OAV_OLD=<a 0.5.0 checkout>` adds it side by side; `BACKGROUND=1 CHROME=<Chrome
  for Testing>` adds a headed hidden-tab run over the DevTools protocol): four on floor at 120 bpm, a `draw()` busy 30 ms a frame,
  10 s of the kit's output through an AudioWorklet that notes each onset's sample frame; the spread of the intervals. Then 30 s
  behind another tab: onsets heard, `drumBar` against the wall clock, the callbacks told while hidden and in the first 100 ms back.
- `p5/test/rhythm-smoke.cjs` (same arguments; `DEMOS=<course demos/02-drums>` adds lesson 4's Demo 2): a line of rhythm on the
  card, the word lit in `kickDetected()` / `snareDetected()` / `hatDetected()`, Chinese lanes and the bar number, contrast on
  the card, `drumPhase`, a click handing over to the cells, triplets and a crash row, a mistake's card, `drums=frame`, an English
  page. Until `packages/pattern` is merged it uses `p5/test/pattern-stub.js` (`STUB_PATTERN=0`: the package itself).
- `p5/test/rhythm-sync-smoke.cjs` (same arguments; ffmpeg on the path, `REC=0` skips the recording): 0.7 — a click on a cell
  rewrites the line and the machine plays it (kicks heard where the new line puts them), ↶ and ⌘Z (only after the card was
  touched), Copy (the clipboard read back), the strudel.cc link decoded, typing (a pause plays it, the cells follow, a mistake
  marked red with a card while the last line keeps playing, Enter, Escape, no key reaches the sketch), a line the grid cannot hold
  (card first, then rewritten, ↶ back), a line copied from strudel.cc (`setcpm`, `.bank`, `.fast`, `.jux`), a preset shown as its
  line; `drawRhythm` grid / circle / spiral in 2D and WEBGL on p5 1.11.11 and 2.3.4 read back pixel by pixel, and a frame of a
  `startRecording(2)` take (ffmpeg) with it in; `p5/examples/rhythm-visual`.
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
- `p5/test/rec-smoke.cjs` (same arguments plus `CHROME=<Google Chrome>`, `CHROMIUM=<Playwright's Chromium>`, ffmpeg on the path;
  a fake microphone; the sound check needs jsDelivr): every take is the file the browser downloaded, read back with ffprobe
  (streams, codecs, length) and ffmpeg (`volumedetect`, `signalstats`). Per p5 version: none of the new names is a p5 / p5.sound
  name; an old sketch builds no MediaRecorder, loads no `packages/record`, shows nothing new but ⏺ and 📷; `examples/record`
  records 3 s of picture and sound (startSound + drums); the fake microphone is in the take, and out of it with `record=nomic`;
  a WEBGL canvas; p5.sound 1.x in the take, 2.x's p5.sound said not to be; a sound that was on but silent; a 641×361 canvas;
  a browser without MP4 (WebM + the Instagram card); a black take (simulated); ⏺, the red dot, the saved card, 📷, `record=off`, 🩺.
  `node --test tests/p5-inject.test.js` has the logic: the real `Recorder` over a stand-in MediaRecorder (MP4 first, the bitrate,
  even sizes, the file name, `recordingSaved`), the mix (the microphone joining mid-take, `record=nomic`), the WebM fallback after
  a refused MP4, and which cards a take earns.

Examples: `p5/examples/particles/` (`knob1`, `notePressed`), `p5/examples/opc/` (OPC sliders on knobs), `p5/examples/mic/` (`micLevel`, `bass`, `beat`),
`p5/examples/keys/` (`startSound('piano')`, particles from every key, the 🎹 open), `p5/examples/drums/` (`startDrums`, `kickDetected`, `cue`, `cueFired`),
`p5/examples/rhythm/` (one line of rhythm, `drumPhase` turning a hand once a bar, `beatPhase` breathing on every beat),
`p5/examples/rhythm-visual/` (`drawRhythm` in its three styles and the line drawn on the canvas, `rhythmChanged`, R records 8 s),
`p5/examples/record/` (drums and a synth, R records, P saves a still, `recordingSaved`),
`p5/examples/with-strudel/` (the picture side of Strudel in another tab: `link`, `notePressed`, `drumPhase` on Strudel's clock)
`p5/examples/lag/` (the microphone raw and lagged side by side, `scope()`, `drawTrail()`, `trail()`),
`p5/examples/chop/` (a disc a bass drum opens: `env`, `spring`, `speed`, `count`, `slope`, `trigger`; `startDrums()` is the only input),
`p5/examples/rhythm-lab/` (keys 1–4 `OAVp5.drums.edit`, Z `undo`, S `strudelUrl`, `rhythmChanged`, `drawRhythm`)
and `p5/examples/note-names/` (`noteIsDown('C4')`, `noteNumber`, `noteName`, `noteFreq`).
