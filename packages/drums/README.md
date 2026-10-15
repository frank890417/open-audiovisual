# @openav/drums

L1 input and L4 output · a 16-step, 4-lane drum sequencer with a TR-style grid UI
and a synthesized kit. Hits publish `drum/*` in the same shapes the microphone
analyzer publishes `audio/*`, so a world mapped to a kick cannot tell the machine
from a drummer.

```js
// in a show: the grid sits under the piano in the side panel
const show = await createShow({ world, modules: { drums: true },
  routes: [{ source: 'drum/kick/env', target: 'pump' }] });
```

```js
import { mountDrums } from '@openav/drums';
const drums = mountDrums(document.querySelector('#drums'), { signals });
// every frame:
drums.update(dt);
```

```js
// on the audio clock (what oav-p5 0.6 uses): steady under a heavy frame and in a hidden tab
const drums = mountDrums(el, { signals, clock: 'lookahead', lang: 'zh', onHit: (voice, vel, ev) => {}, onStep: (i, n, ev) => {} });
drums.setPattern(compile('bd*4, [~ sd]*2, hh*8'), { text: 'bd*4, [~ sd]*2, hh*8' });   // compile: @openav/pattern
drums.update(dt);                   // every frame: hears what is due, paints the grid and the score line
drums.phase();                      // { bar: 0..1 through the bar, beat: 0..1 through the beat }, as heard
```

## Two clocks

- **`clock: 'frame'`** (the default; a show's loop drives it): `update(dt)` moves the `DrumSequencer` and each hit sounds in
  the frame it is due — late by up to a frame, and stopped while a tab is hidden.
- **`clock: 'lookahead'`**: a `DrumTransport` hands every hit to the kit ahead of time on the kit's own AudioContext clock
  (a Web Worker heartbeat every 25 ms, 0.1 s ahead; `setInterval` where a worker cannot start), the way Chris Wilson's
  [A tale of two clocks](https://web.dev/articles/audio-scheduling) teaches. Positions are bars since the start, turned into
  seconds by multiplication from the last tempo anchor, so a thousand bars later nothing has drifted (`tests/drums-clock.test.js`
  checks < 1 µs). A tempo or pattern change takes back what was already handed over after *now* (`noteOn` returns a
  `cancel()`) and makes it again, so nothing doubles or goes missing. Steps and hits are told to the page (`onStep`, `onHit`,
  the `drum/*` signals) in the frame they are **heard**: their time plus the output latency the browser reports
  (`getOutputTimestamp()`, `outputLatency`; `latency: <seconds>` to set it). While the page is hidden — or when a stalled frame
  loop catches up more than 0.25 s late — steps are told quietly (`ev.quiet`: the clock moves, no hit is told; of several bar
  starts only the last has `ev.announce`), so nothing floods the page when it comes back. If the page ever holds the main
  thread longer than the lookahead, it grows to 0.3 s (`info().extended`). Before the kit's AudioContext runs (no click yet)
  the clock runs on `performance.now()` and nothing sounds; once it runs, hits from then on sound and none from before.

A **compiled rhythm line** (anything with `eventsInBar(bar, { seed })`: @openav/pattern's `compile(text)`) plays as written —
hits anywhere in the bar (triplets), any GM voice (crash, ride, toms get a row of their own on the grid), the line over the
grid with the word that sounds lit (`ev.token`). A click on a cell turns the line into the grid it plays in that bar
(`onTakeover({ text, bar, offGrid, dropped })`). The frame clock plays a line's first bar on the grid. The way of writing one
line of rhythm comes from TidalCycles / Strudel ([strudel.cc](https://strudel.cc)); OAV implements it independently from
their public documentation.

## Exports

| export | signature |
|---|---|
| `mountDrums` | `mountDrums(container, { signals, engine = null, autoEnableEngine = true, onStep = null, onHit = null, onTakeover = null, bpm = 112, pattern = 'four on floor', clock = 'frame', lang = 'en', heartbeat = 'auto', latency = 'auto' })` → `{ seq, engine, root, clock, play(on), setPattern(p, { text }), setBpm(bpm), update(dt), deliver(), phase(), now(), info(), dispose() }`; no `engine` = `drumEngine()`, enabled on the first hit. `play` / `setPattern` / `setBpm` do what the checkbox, the menu and the slider do, and the grid follows. `onHit(voice, vel, ev)` / `onStep(i, n, ev)`: told when heard. `deliver()`: tell what is heard by now without painting (call it right before drawing). `now()` → `{ bar, step, phase, beatPhase, tokens, mode, text }`; `info()` → `{ clock, heartbeat, lookahead, late, extended, latency, … }`. `lang: 'zh'`: 大鼓 小鼓 鈸 拍手 |
| `DrumScheduler` | pure logic: `new DrumScheduler({ bpm, swing = 0, humanize = 0.35, lookahead = 0.1, pattern, seed, random })` · `start(t)` · `stop()` → dropped · `advance(now)` → the new events up to now + lookahead · `due(t)` → those heard by t · `rewind(t)` · `setBpm(bpm, t)` · `posAt(t)` / `timeAt(pos)` / `phaseAt(t)` · `setPattern(p, { text })` · `toggleCell` · `gridOf(bar)` · `takeover(bar)` · `barEvents(bar)`. Events: `{ kind: 'step', i, n, bar, pos, time }`, `{ kind: 'hit', voice, vel, pos, n, bar, token, word, layer, time }` |
| `DrumTransport` | `new DrumTransport({ scheduler, engine, onStep, onHit, heartbeat = 'auto' \| 'interval' \| false, tick = 0.025, latency = 'auto', stale = 0.25, now, hidden })` · `start()` · `stop()` · `toggle(on)` · `setPattern` · `toggleCell` · `takeover` · `setBpm` · `pump()` (the heartbeat) · `frame()` (once a frame) · `times()` → `{ sched, heard, live }` · `phase()` · `info()`; it has `DrumSequencer`'s `playing`, `pattern`, `grid`, `bpm`, `swing`, `humanize` |
| `drumName` | `drumName('kick', 'zh')` → `'大鼓'`: the name a person reads for a voice |
| `DrumSequencer` | `new DrumSequencer({ onHit(lane, vel), onStep(i, n), bpm = 112, swing = 0.12, humanize = 0.35, pattern = 'four on floor' })` · `setPattern(nameOrGrid)` · `toggleCell(lane, i)` · `toggle(on = !playing)` · `update(dt)` · `grid`, `bpm`, `playing`, `pattern`. `onStep(i, n)`: every 16th, `i` 0..15 and `n` steps since the start, before that step's hits (the clock a timeline counts bars on). `setPattern` takes a preset name or your own grid `{ kick: 'x...x...x...x...', snare, hat, clap }` (`pattern` becomes `'custom'`; an unknown name plays `'four on floor'`) |
| `laneSteps` | `laneSteps('x... x... x... x...')` → 16 × 0/1 (`x`, `X`, `1` are hits, spaces and `\|` are for the eye; arrays of 0/1/true work too) |
| `drumEngine` | `drumEngine({ samples = null })` → a [sound engine](https://openaudiovisual.com/docs/#show-control-sound): GM notes in, synthesized drums out (`engine.hit('crash', 0.9)` plays a voice by name); `noteOn(note, vel, time)` plays at `time` on `engine.context`'s clock (now if left out or past) and returns `{ time, cancel() }` (silences a hit that has not started); `samples: { 36: 'kick.wav' }` plays files instead; one param `kitVolume` (-30..0 dB, default -6); `engine.context` (its own `AudioContext`) and `engine.output` (the node that goes to the speakers, for a recorder to tap) once enabled |
| `PATTERNS` | `'four on floor'`, `breakbeat`, `'half time'`, `latin`, `sparse` |
| `GM` | `{ kick: 36, rim: 37, snare: 38, clap: 39, lowtom: 41, hat: 42, pedalhat: 44, tom: 45, openhat: 46, hightom: 48, crash: 49, ride: 51, cowbell: 56 }` |
| `voiceForNote` | `voiceForNote(note)` → the kit voice a General MIDI drum note plays (`35`/`36` kick, `49`/`57` crash, `51`/`59` ride…), or `null` |

Signals: `drum/kick`, `drum/snare`, `drum/hat`, `drum/clap` (pulse `{level}`),
`drum/<lane>/env` (0..1), and `midi/note/on` `{note, vel, ch: 10}` per hit (a rhythm line's other voices: `drum/crash`,
`drum/ride`, … defined on their first hit) ·
[Signals reference](https://openaudiovisual.com/docs/#signals-openav-drums-simulator-analyzer-shaped).

Full reference: [docs](https://openaudiovisual.com/docs/#packages-openav-drums)

## In the cheyuwu-lab

Declared with a `"lab"` field (module `drums`): `lab.drums` plays every note that arrives on MIDI channel 10 — the
General MIDI drum channel keyboard pads and drum machines use — so a pad hit is never silent. From code:
`lab.drums.hit('kick', 0.9)`, `lab.drums.voices`, `lab.drums.set('kitVolume', -12)`. Audio starts on the first gesture.
