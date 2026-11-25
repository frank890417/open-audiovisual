# Package reference

Thirty-four packages live in `packages/<name>/`. Each is plain ES modules with no
dependencies; in a page you import them as `@openav/<name>` through an import
map (copy the one in `examples/01-hello-particles/index.html`). Nothing is on
npm yet.

| layer | packages |
|---|---|
| L1 input | `midi` · `audio` · `chord` · `pose` · `leap` · `keys` · `drums` |
| L2 mapping | `mapping` · `chop` |
| L3 world | `stage` · `world-webtoe` |
| L4 output | `sound` · `osc` · `out` · `dmx` · `output` · `align` · `record` · `fab` (and MIDI out in `midi`) |
| spines | `timeline` · `score` · `pattern` · `console` · `monitor` · `sync` |
| phones | `relay` · `surface` · `remote` · `tile` |
| glue | `core` · `show` · `devices` · `mcp` |

Subpath entries (`@openav/remote/host`, `@openav/relay/server`,
`@openav/surface/layout`, `@openav/surface/auto`) need their own import-map line
in a browser, for example
`"@openav/remote/host": "../../packages/remote/host.js"`.

## @openav/core

Glue · the shared language: `Signals`, `Params`, `Loop`, `Bus`.

| export | signature |
|---|---|
| `Signals` | `new Signals()` · `define(name, { kind, min, max, unit, description, source })` · `set(name, value)` · `pulse(name, payload = 1)` · `get(name)` · `norm(name)` → 0..1 · `on(name, cb(value, name))` → unsubscribe · `onAny(cb(name, value, meta))` → unsubscribe · `list()` → `[{ name, value, at, kind, min, max, … }]` |
| `Params` | `new Params(schema = [])` · `add(entries)` · `get(key)` · `clamp(key, v)` · `override(key, v)` · `clearOverride(key)` · `clearAllOverrides()` · `isOverridden(key)` · `firePulse(key)` · `onPulse(key, cb)` → unsubscribe · `resolve(base)` → state · `schema`, `overrides` |
| `Loop` | `new Loop(onFrame(dt, now), { maxDt = 0.1, clock, raf, manual = false, heartbeat })` · `start()` · `stop()` · `step(dt)` → `boolean` (one frame of `dt` seconds, unclamped) · `fps`, `running`, `manual`. `clock()` → ms (default `performance.now`), `raf(cb)` → the next frame (default `requestAnimationFrame`); an injected `raf` or `manual` turns the hidden-tab Worker off (`heartbeat: true` turns it on). See [Driving the frames yourself](show-control.md#driving-the-frames-yourself) |
| `Bus` | `new Bus()` · `on(event, cb)` → unsubscribe · `off(event, cb)` · `emit(event, payload)` |

```js
import { Signals, Params, Loop } from '@openav/core';
const signals = new Signals();
signals.define('breath/pressure', { min: 0, max: 1 });
signals.on('breath/pressure', (v) => console.log(v));
signals.set('breath/pressure', 0.4);
```

## @openav/show

Glue · `createShow(options)`: one call that assembles a whole show around a
world and returns every part. Options, modules and the return value are in
[Show control](show-control.md#createshow); `loop`, `monitor` and `console` (the desk's `keys`) choose who drives the frames, where the backstage feed goes and which keys run the desk; `sync` makes the page one of several that perform the same show (leader or follower, [`@openav/sync`](#openav-sync)). The same page at `?output` is a clean output: the stage alone on black, no desk ([`@openav/output`](#openav-output)).

```js
import { createShow } from '@openav/show';
const show = await createShow({ world, modules: { keys: { base: 48 }, sound: true } });
```

## @openav/midi

L1 input and L4 output · Web MIDI in and out, many devices at once, and
on-screen controllers that mirror real hardware.

| export | signature |
|---|---|
| `Midi` | `new Midi({ signals, filterOut = 'IAC', requestAccess, echoWindow = 40, prefer = [] })` · `enable(preferredOut = '')` → `Promise<boolean>` · `devices()` → `[{ slug, name, listening }]` · `setListening(slug, on)` · `onDevices(fn)` · `onOutput(fn({ text, reason, next }))` · `listen(fn(bytes, port))` · `selectOutput(name)` → `boolean` (and remembered as your choice) · `outputFor(nameOrRegExp)` · `send(bytes)` · `noteOn(note, vel = 100, ch = 1)` · `noteOff(note, ch = 1)` · `cc(cc, val, ch = 1)` · `panic()` · `dispose()` · hooks `onCC`, `onNote`, `onMessage`, `onSend`, `onDeviceChange` · `out`, `outputs`, `preferredOut`, `echoDropped` |
| output hot-plug, echo | `pickOutput(outputs, { preferred, prefer })` · `reselectOutput({ current, outputs, preferred, prefer })` → `{ next, changed, reason, text }` · `EchoGuard({ window })` (`sent(bytes)`, `isEcho(bytes)`): the pure logic behind `Midi`, see [Show control](show-control.md#midi-output-and-panic) |
| score to MIDI | `new ScoreMidi({ midi, channel = 15, segment = { note: 36 }, cue = { note: 84 }, length, scrub, enabled })` · `segment({ index, cause })` · `cue({ name, n })`: segment changes and cues as notes and CCs, see [Score & Director](score.md#score-to-midi) |
| parsing | `parseMessage(bytes)` → event · `encodeMessage(event)` → bytes · `genericSignals(event, { device })` · `publish(signals, list)` · `describe(event)` · `relativeDelta(value, mode)`, `relativeValue(delta, mode)`, `RELATIVE_MODES` · `bendToUnit`, `unitToBend`, `BEND_CENTER` |
| controllers | `MidiController`, `MidiControllers`, `controllerRoutes(profile, bindings)`, `PROFILES`, `profileById(id)`, `ControllerView`, `mountMidiPanel(el, controllers, opts)`, `linkControllers`, profile helpers (`validateProfile`, `normalizeProfile`, `matchProfile`, …) |
| Web MIDI shim | `createVirtualMIDIAccess({ name, onOutput(bytes, timestamp), onClear })`, `virtualRequestMIDIAccess`, `splitMidi(bytes)`: its output is heard with each send's timestamp |
| `MidiClock` (`clock.js`) | `new MidiClock({ ppq = 24, beatsPerBar = 4 })` · `feed(bytes, t)` → `'clock'·'start'·'continue'·'stop'·'spp'·'dupe'` · `bpm` · `phaseAt(t)` → `{ pos, bar, beat, bpm, running }` · `anchor()` · `state(t)`: follow an external MIDI clock ([With Strudel](strudel.md)) |
| embedding | `createController(profile, { profiles, signals, channel, follow, midi, requestAccess, filterOut, telemetry })` → `ControllerHost` (`on(event, fn)`, `set`, `press`, `release`, `values`, `mount(el)`, `learn()`, `dispose()`) · `loadProfile(idOrUrl)` · the `<oav-controller>` element in `packages/midi/element.js` · embed protocol helpers in `embed.js` |

```js
import { Midi } from '@openav/midi';
const midi = new Midi({ signals });
await midi.enable();
midi.noteOn(60, 100, 1);
```

Signals: [Signals reference](signals.md#openavmidi). Controllers, profiles and
the shim: [MIDI controllers & embedding](controllers.md).

## @openav/audio

L1 input · microphone (or any audio node) analysis.

| export | signature |
|---|---|
| `AudioAnalyzer` | `new AudioAnalyzer({ signals, fftSize = 2048, smooth = 0.7 })` · `enableMic()` · `enableElement(mediaEl)` · `input()` → an `AnalyserNode` to connect into · `update()` per frame → `{ rms, peak, low, mid, high, centroid, onset, kick, snare, hat }` |

```js
import { AudioAnalyzer } from '@openav/audio';
const audio = new AudioAnalyzer({ signals });
await audio.enableMic();          // from a click
// every frame: audio.update();
```

## @openav/chord

L1 input (an analyzer) · groups struck notes into gestures and publishes
consonance, triads and clusters.

| export | signature |
|---|---|
| `ChordDetector` | `new ChordDetector({ window = 80, onChord, signals })` · `noteOn(note, vel = 0.8)` · `noteOff(note)` · `analyze(notes, vels)` → analysis (pure) |

```js
import { ChordDetector } from '@openav/chord';
const chord = new ChordDetector({ signals });
signals.on('midi/note/on', ({ note, vel }) => chord.noteOn(note, vel));
signals.on('midi/note/off', ({ note }) => chord.noteOff(note));
chord.analyze([60, 64, 67]).chordType;   // 'major'
```

## @openav/pose

L1 input · body and hand tracking from the camera with MediaPipe, on the device.

| export | signature |
|---|---|
| `PoseTracker` | `new PoseTracker({ signals, mirror = true })` · `enable({ videoEl })` (from a click) · `stop()` · `skeleton(ctx, w, h, { color, lineWidth })` · `landmarks`, `running` |
| `HandTracker` | `new HandTracker({ signals, mirror = true })` · `enable({ videoEl })` · `stop()` · `skeleton(ctx, w, h, { colorLeft, colorRight, lineWidth })` · `hands`, `running` |

```js
import { HandTracker } from '@openav/pose';
const hands = new HandTracker({ signals });
button.onclick = () => hands.enable();
```

## @openav/leap

L1 input · Leap Motion / Ultraleap hands through the machine's bridge
(`node packages/leap/bridge/leap-bridge.mjs`, `ws://127.0.0.1:6437`). The same
bridge speaks the old LeapJS protocol, so 2014–2021 `leap.js` sketches run unchanged.

| export | signature |
|---|---|
| `LeapInput` | `new LeapInput({ signals, url, reconnect = true, fingers = true, box, thresholds })` · `connect()` · `disconnect()` · `simulate({ target })` → `stop()` · `skeleton(ctx, w, h, { view, colorLeft, colorRight, lineWidth })` · `mountPanel(el)` · `onFrame(fn)` · `onStatus(fn)` · `ingest(msg)` · `hands`, `frame`, `status`, `device` |
| frames | `V6Converter` (raw → LeapJS v6) · `handsOf(msg)` · `normalizePoint(p, box)` · `handAngles(direction, normal)` · `mockHand(o)` · `mockFrame(t)` |
| gestures | `HandGestures` · `Hysteresis(on, off)` · `THRESHOLDS` (pinch 0.86 / 0.5, both hands 0.8 / 0.5, grab 0.8 / 0.5) |

```js
import { LeapInput } from '@openav/leap';
const leap = new LeapInput({ signals }).connect();   // ws://127.0.0.1:6437/v6.json
leap.onFrame(() => leap.skeleton(ctx, w, h));          // joints in mm: leap.hands
// no sensor: leap.simulate() — mouse = right palm, press = pinch
```

## @openav/keys

L1 input · the on-screen piano, QWERTY playing and a simulated performer, all
publishing `midi/note/on|off`.

| export | signature |
|---|---|
| `mountKeys` | `mountKeys(container, { signals, chord, base = 48, octaves = 2, sim = true, capture = true })` → `{ piano, sim, update(dt), dispose(), captureBox }` |
| `KeysPiano` | `new KeysPiano(container, { base, octaves, semitones, fill, keyWidth, velocity, minBase, maxBase, onNote, onOctave })` · `press(note, vel01)` · `release(note)` · `releaseAll()` · `setBase(n)` · `handleKeyDown(e)`, `handleKeyUp(e)` · `captureEnabled` |
| `SimPlayer` | `new SimPlayer({ press, release, base = 60, scale = [0, 2, 4, 7, 9], density = 1 })` · `toggle(on)` · `update(dt)` |
| `PIANO_KEYMAP` | `{ a: 0, w: 1, s: 2, … ';': 16 }` |

```js
import { mountKeys } from '@openav/keys';
const keys = mountKeys(document.querySelector('#keys'), { signals, base: 48 });
// every frame: keys.update(dt);
```

## @openav/drums

L1 input and L4 output · a synthesized drum kit, a 16-step sequencer, and its
grid UI; publishes `drum/*` in the same shapes as the microphone's drum
detection.

| export | signature |
|---|---|
| `mountDrums` | `mountDrums(container, { signals, engine, autoEnableEngine = true, onStep, onHit, onTakeover, bpm = 112, pattern, clock = 'frame', lang })` → `{ seq, engine, root, clock, play(on), setPattern(p, { text }), setBpm(bpm), update(dt), deliver(), phase(), now(), info(), dispose() }`; `clock: 'lookahead'` schedules the hits ahead on the kit's audio clock (oav-p5 0.6 uses it) and plays a compiled rhythm line as written; `lang: 'zh'` names the lanes in Chinese; `rhythm: <@openav/pattern>` (or `useRhythm(mod)`) makes the line over the grid editable and the cells rewrite it, with `history` / `undo()`, Copy and Open in Strudel (0.7) |
| `DrumSequencer` | `new DrumSequencer({ onHit(lane, vel), onStep(i, n), bpm = 112, swing = 0.12, humanize = 0.35, pattern = 'four on floor' })` · `setPattern(nameOrGrid)` · `toggleCell(lane, i)` · `toggle(on)` · `update(dt)` · `grid`, `bpm` (the frame clock) |
| `DrumScheduler`, `DrumTransport` | the lookahead clock: a grid or a compiled line → timed events, positions in bars turned into seconds by a tempo map (no drift); the runtime with a Web Worker heartbeat, the audio clock, and steps / hits told when heard; `follow({ pos, at, bpm })` plays on an external clock (a small error pulled in by tempo, a large one a jump onto its grid), `followInfo()`, `unfollow()` |
| `drumEngine` | `drumEngine({ samples })` → a sound engine (see [Sound](show-control.md#sound)); `noteOn(note, vel, time)` plays at `time` on its own AudioContext and returns `{ time, cancel() }` |
| `PATTERNS`, `GM` | pattern presets; General MIDI drum notes `{ kick: 36, snare: 38, clap: 39, tom: 45, hat: 42, openhat: 46 }` |

```js
import { mountDrums } from '@openav/drums';
const drums = mountDrums(document.querySelector('#drums'), { signals });
// every frame: drums.update(dt);
```

## @openav/mapping

L2 mapping · routes from signals to params, with curves, smoothing, learn and
saved profiles.

| export | signature |
|---|---|
| `Mapper` | `new Mapper({ signals, params, profile = 'default', onChange, onLearn, base })` · `addRoute(route)` · `removeRoute(id)` · `routesFor(target)` · `learn(target)` · `update(dt)` · `toJSON()` · `fromJSON(routes)` · `save()` · `load()` · `dispose()` · `routes`, `learnTarget` |
| `LearnWizard` | `new LearnWizard({ mapper, keys, onChange })` · `start()` · `skip()` · `back()` · `stop()` · `sync()` · `active`, `current`, `index`, `total`, `done`, `added`: "map the knobs in order", see [Score & Director](score.md#map-the-knobs-in-order) |

```js
import { Mapper } from '@openav/mapping';
const mapper = new Mapper({ signals, params });
mapper.addRoute({ source: 'midi/cc/74', target: 'bloom', curve: 'exp', smooth: 0.1 });
// every frame: mapper.update(dt);
// a knob that nudges the timeline instead of replacing it, and gives the param back when you let go:
// mapper.base = () => timeline.state();
// mapper.addRoute({ source: 'midi/cc/71', target: 'bloom', mode: 'trim', outMin: -0.3, outMax: 0.3, release: 4 });
```

Full reference: [Mapping](mapping.md).

## @openav/chop

L2 mapping · values over time, the way TouchDesigner's CHOPs shape them: Lag, Trigger (`envelope`), Speed, Spring, Trail, Slope, Count. Pure logic, no clock of its own: every step is told the seconds that went by and is solved exactly over them, so 30 fps and 144 fps draw the same curve. What the parameters mean follows Derivative's TouchDesigner documentation; the code is OAV's own. In a p5 sketch, oav-p5 gives these one call each: [p5 one line](p5.md#values-over-time-lag-env-speed-spring-trail).

| export | signature |
|---|---|
| `approach` | `approach(current, target, seconds, dt)` → one step of a one-pole lag; `seconds` = time to 63% of a change (the `smooth` of `@openav/mapping`, which steps with it) |
| `Lag` | `new Lag({ up = 0.1, down = up })` · `step(input, dt, up?, down?)` → output · `reset(v?)`: `up` while rising, `down` while falling (Lag CHOP's Lag 1 / Lag 2), in TouchDesigner's seconds (about 90% of a change) |
| `envelope` | `envelope(times, t, attack = 0.01, decay = 0.3, peak = 1)` → the Trigger CHOP's level at `t` for events at `times` (seconds, oldest first): a straight attack (0 → peak), then 0 after exactly `decay`; a retrigger starts where it is · `envelopeStage(elapsed, attack, decay, from, peak)` |
| `Speed` | `new Speed()` · `step(rate, dt)` → position: `rate` per second |
| `Spring` | `new Spring({ stiffness = 100, damping = 6 })` · `step(target, dt)` → position (`velocity` alongside): a mass on a spring pulled to the input, solved exactly · `springStep(x, v, target, k, c, dt)` → `[x, v]` |
| `Trail` | `new Trail({ seconds = 2, rate = 60 })` · `step(value, dt)` → the last `seconds`, 60 values a second plus the newest, oldest first, fixed length |
| `Slope` | `new Slope()` · `step(value, dt)` → change per second |
| `Count` | `new Count({ threshold = 0.5 })` · `step(on, limit = 0)` → times it turned on, looped to 0 … limit − 1 with a limit · `wrapCount(total, limit)` |
| `TD_LAG_RATIO`, `DEFAULTS` | `Math.LN10`: two kinds of seconds. `Lag` and `lag()` take TouchDesigner's Lag CHOP seconds (about the time to follow 90% of a change), so `lag(x, 0.1)` moves like a Lag CHOP set to 0.1; underneath, `Lag` divides by `TD_LAG_RATIO` (2.3) to get its time constant. `approach(…, seconds)` takes that time constant itself (63% of a change, what `@openav/mapping`'s `smooth` always meant); the defaults above |

```js
import { Lag, envelope } from '@openav/chop';
const vu = new Lag({ up: 0.03, down: 0.4 });       // opens at once, closes slowly
// every frame: r = 50 + vu.step(level, dt) * 300; pump = envelope(kickTimes, now, 0.01, 0.3);
```

## @openav/stage

L3 world · the world shell: lifecycle and param aggregation, no renderer.

| export | signature |
|---|---|
| `Stage` | `new Stage({ container, params, signals, io = {} })` · `register(world)` · `activate(name)` (async) · `frame(dt, baseState)` → state · `active`, `activeName`, `worlds`, `io` |
| `createCanvas` | `createCanvas(container, { alpha = false })` → `{ canvas, ctx, fit() → { w, h }, dispose() }` |

```js
import { Stage, createCanvas } from '@openav/stage';
const stage = new Stage({ container, params, signals });
stage.register(world);
await stage.activate(world.name);
// every frame: const state = stage.frame(dt, timeline.state());
```

## @openav/world-webtoe

L3 world · performs a [WebToe](https://github.com/frank890417/WebToe) node patch
as a world; params reach the patch's `ext('name', fallback)` bindings.

| export | signature |
|---|---|
| `webtoeWorld` | `webtoeWorld({ name = 'webtoe', app = 'https://webtoe.openaudiovisual.com/', project, params = [], extra })` → a world |

See [Writing a world](writing-a-world.md#a-webtoe-patch).

## @openav/sound

L4 output · instruments in the page behind a small engine contract: a Salamander
grand piano, mallets, strings, organ, choir, harp and synth presets, chosen from a
picker; engine params become `sound/*` params.

| export | signature |
|---|---|
| `Sound` | `new Sound({ signals, params, engine, instrument, remember, picker })` · `enable()` (from a click) · `update(state)` per frame · `setInstrument(id)` · `instrument` · `status` · `onChange(cb)` · `dispose()` · `enabled` |
| `toneEngine` | `toneEngine({ instrument = 'synth/pad', baseUrl, instruments, cdn, drumChannel = 10 })` → engine with params `cutoff`, `space`, `volume` plus the instrument's own |
| `registerInstrument` | `registerInstrument({ id, name, category, params, defaults, credit, create(Tone, ctx) }, { replace })`; also `getInstrument`, `listInstruments`, `instrumentGroups`, `onInstrumentsChange` |
| `registerSynthPreset` | `registerSynthPreset({ id, name, voice, oscillator, envelope, filter, effects, … })` → `synth/<id>` |
| `modalInstrument` | `modalInstrument({ id, name, partials, strike, damp })` → a mallet-style instrument from data |
| `mountSoundPicker` | `mountSoundPicker(el, sound, { lang, className })` → the picker the console uses |

Engine contract: `{ params, enable(), noteOn(note, vel01), noteOff(note), set(key, value), dispose() }`.
The instrument list and how to add one: [Sound](show-control.md#sound).

```js
import { Sound, toneEngine } from '@openav/sound';
const sound = new Sound({ signals, params, engine: toneEngine({ instrument: 'piano' }) });
button.onclick = () => sound.enable();
// every frame: sound.update(state);
```

## @openav/osc

L4 output · OSC from the browser through a small Node bridge to UDP.

| export | signature |
|---|---|
| `OscOut` | `new OscOut(url = 'http://127.0.0.1:7456')` · `enable()` → `Promise<boolean>` · `disable()` · `send(addr, args)` · `flush()` per frame · `rate()` → messages sent since the last call · hooks `onStatus(ok, info)`, `onMsg(addr, args)` |
| bridge | `node packages/osc/bridges/osc-bridge.js [httpPort=7456] [targetHost=127.0.0.1] [targetPort=3456]` |

See [Show control](show-control.md#osc-output).

## @openav/out

L4 output · page parameters to physical hardware through one local bridge
(`node packages/out/bridge/out-bridge.mjs --config out.json`, `ws://127.0.0.1:6450/out`): WLED light strips (DDP),
serial motor boards, OSC, and DMX lighting (Art-Net, sACN, an Enttec DMX USB Pro). A watchdog sends every channel its configured
safe value (or leaves a `"hold"` channel where it is) when the page goes quiet or the last client leaves.

| export | signature |
|---|---|
| `OutClient` | `new OutClient({ url, id, schedule })` · `connect()` · `simulate()` · `close()` · `set(ch, v)` · `batch({ ch: v })` · `onStatus(fn)` · `status`, `last`, `bridge`, `beatMs` — one value per channel per frame, reconnects with backoff, heartbeat |
| bridge | `node packages/out/bridge/out-bridge.mjs [--port 6450] [--config out.json] [--no-watchdog]` · sinks `ddp` `serial` `osc` `udp-json` `log`, and for DMX on `dmx/<universe>/<address>`: `artnet` (unicast `host`), `sacn` (multicast or `host`, `priority`, `source`), `enttec` (`path`, `universe`), 40 Hz + a keep-alive each second, a flash guard per channel (`"flashGuard": false` \| `{ maxFlashHz, exempt }`) |
| lab | `meta.params[i].out: "light/1/r"` binds a param (0..1 by min–max, `outRaw` for the raw value); `?out=sim` · `?out=0` · `?out=ws://…` |

See the package README for the config file and the watchdog rules.

## @openav/dmx

L4 output (lighting) · DMX from a page, as pure logic: fixture profiles (`open-audiovisual/fixture@1`), a patch that turns
properties (dimmer, color, pan, tilt, strobe, zoom, 0..1) into each light's bytes, and an engine that renders every light at
any moment as a function of time: base scenes → cues with fades → chases on beats → effects → live values → per-fixture limits →
grand master → blackout. Safety is on by default, and the flash cap (3 a second) is held per fixture, twice: the engine slows
the effects and chases that flash one fixture until their rates there add up to at most the cap (`state(t).slowed`), and every
`dmxTransport()` puts each frame through a flash guard that holds what a fixture really emits, live values included (rises are
rationed, falls always pass; `{ flashGuard: false }` to switch it off, and the monitor then says so). A strobe channel whose
profile gives Hz is held to the cap, one with no Hz stays open; `render(t, { beat })` needs `bpm` with it, since the cap reads the tempo; `control` channels (reset, lamp, built-in
programs) are written only by `control()`; blackout leaves pan and tilt where they are. The bytes of Art-Net, sACN and the Enttec
DMX USB Pro come out of pure encoders; `dmxTransport()` sends what changed each frame (to memory, through the out-bridge, or by
Web Serial), `dmxParams()` makes the engine's control points params, and `mountDmxMonitor()` shows the rig on the page.
Nothing has been tried on a real fixture, node or interface. The chapter is [DMX lighting](dmx.md).

| export | signature |
|---|---|
| `Patch` | `new Patch({ profiles })` · `add({ id, profile, mode, universe = 1, address, name, groups, limits })` (throws past 512, unknown mode) · `check()` → overlaps · `ids(target)` · `render(states, { master, blackout, maxFlashHz = 3, controls })` → `Universes` · `resolve(id, props)` · `toJSON()` · `Patch.fromJSON(json, { profiles })` |
| `DmxEngine` | `new DmxEngine(patch, { maxFlashHz = 3, bpm = 120 })` · `scene(name, { target: props })` · `base(...names)` · `cue(name, { scene, fadeIn, fadeOut, curve })` · `go(name, at)` · `release(at, fade)` · `chase(name, { steps, every, unit: 'beat' \| 'second', fade, start })` · `effect(name, { target, property, wave: sine \| saw \| square \| chase \| flicker \| rainbow, rate, unit, depth, phase, spread, width, seed })` · `run(name, on)` · `remove(name)` · `set(target, props)` · `clear(target, keys)` · `control(id, key, byte)` · `master`, `blackout`, `maxFlashHz` · `render(t, { beat, bpm })` → `Universes` · `state(t)` → `{ fixtures, capped, slowed }` |
| live | `dmxTransport('sim' \| 'bridge' \| 'serial', { patch, flashGuard = true, maxFlashHz = 3, now, client \| universe })` · `send(universes)` → channels changed · `bytes(id)` · `status` · `flashGuard` → `{ on, unit, maxFlashHz, held }` · `connect()` (serial, from a click) · `close()` · `new FlashGuard(patch, { maxFlashHz })` · `apply(universes, t)` · `held` · `dmxParams(engine, { groups, effects, chases })` → `{ params, apply(state, t) }` · `mountDmxMonitor(el, { patch, transport, engine })` → `{ update(universes?), look(id), dispose() }` · engine `tune(name, { rate, depth }, at)` · `submaster(target, level)` · `describe()` |
| `Universe` · `Universes` | `new Universe(id)` · `get(address)` · `set(address, value)` · `write(address, values)` · `fill(v)` · `copy()` · `data` (Uint8Array, 512) · `Universes`: `get(id)` · `bytes(id)` · `ids()` · `entries()` |
| fixtures | `FIXTURES` (generic: dimmer, RGB, RGBW 4/6 ch, RGBA, RGBAW+UV 6/8 ch, one-colour strobe, moving head 8/16 ch, all `"verified": false`) · `fixtureById(id)` · `validateFixture(profile)` → problems · `loadFixture(profile)` · `rgbToChannels([r, g, b], colors)` · schema `@openav/dmx/fixtures/fixture.schema.json` |
| protocols | `encodeArtDmx(data, { universe, sequence, physical })` / `decodeArtDmx(bytes)` (ArtDmx, UDP 6454) · `encodeSacn(data, { universe, cid, source, priority, sequence })` / `decodeSacn(bytes)` · `sacnAddress(universe)` (E1.31, UDP 5568) · `encodeEnttecDmx(data)` / `decodeEnttecDmx(bytes)` (DMX USB Pro, label 6) |

`node tools/import-ofl.mjs <OFL checkout> --list tools/ofl/batch-1.json` converts fixtures from the Open Fixture Library (MIT)
into this format (or name them: `… fixtures/<maker>/<fixture>.json`), and refuses one the engine would get wrong on a real light.
Forty-two are in `fixtures/imported/`, all `"verified": false`; they stay out of `FIXTURES`, and
`loadImportedFixture(id)` from `@openav/dmx/fixtures/imported.js` (or `device(id)` of `@openav/devices`) imports the one you ask for.
Art-Net™ Designed by and Copyright Artistic Licence.

## @openav/output

L4 output (picture) · the stage on a projector, a second screen, OBS or TouchDesigner. An output window that mirrors the
stage's canvas (`captureStream()` into a `<video>`: one render, the same frames) or opens the same page again at its clean
address as a sync follower; fullscreen on a chosen screen where the Window Management API allows it (asked only from a click in
the output window); four-corner correction as one CSS `matrix3d` homography, with flip, a quarter turn, a black border and a soft
edge, edited with four handles and a test pattern and saved per output name; crops of one canvas for projectors side by side
(no edge blending); `output/<name>/blackout` and `output/<name>/brightness` as params. Any `createShow()` page at `?output` is a
clean output (`&follow=oav-output` to follow, `&play` to start). The chapter is [Projection and video out](output.md). Several
devices each drawing their own part of one canvas, placed by a photo, is [`@openav/tile`](#openav-tile); a wall of several
outputs aligned from one layout file is [`@openav/align`](#openav-align), whose calibration `createOutputs(show, { align })` imports.

| export | signature |
|---|---|
| `createOutputs` | `createOutputs(show, { outputs = [{ name: 'main' }], aspect = null, panel = true, via = null, storage, align = null })` → `{ names, open(name, { mode }), close(name), get(name), edit(name, on), pattern(name, on), lead({ channel, via }), url(name, o), exportLayout(), importLayout(doc), keys(name) }`, also on `show.outputs`; the params at load, the stage boxed to `aspect`, an L4 · Output panel |
| `openOutput` | `openOutput(source, { name = 'main', crop, fit = 'contain', mode = 'mirror', params, timeline, features, aspect, via, channel = 'oav-output', storage })` → `{ name, mode, window, closed, edit(on), pattern(on), room, set(partial), reset(), close() }`; from a click |
| corner-pin | `cornerPin(corners, width = 1, height = 1)` → 9 numbers (throws on a quad that is not convex) · `toMatrix3d(H)` → `'matrix3d(…)'` |
| crop | `cropBox({ crop, source, box, fit = 'contain' })` → `{ clip, source }` |
| layout file | `OUTPUT_FORMAT` (`'open-audiovisual/output@1'`) · `parseOutputLayout(doc)` → `{ format, outputs }` (one error listing every problem) |
| params | `outputParams(names)` → the entries of `output/<name>/blackout` (0 or 1) and `output/<name>/brightness` (0..1, default 1) |
| clean address | `outputQuery(search)` → `null` or `{ name, crop, aspect, fit, follow, via, play }` · `outputUrl(base, { name, crop, aspect, fit, follow, via, play })` |

## @openav/align

L4 output (picture) · a wall of several outputs from one layout file (`open-audiovisual/align@1`; art-align's
`art-align/v1` reads unchanged): the test patterns, the vendor's 1:1 alignment chart and the work's output mapping read the
same table of tiles, so a pattern right on the wall means the work is right. A manual calibration on top
(`open-audiovisual/align-calibration@1`: four corners, a mesh, feathered edges, masks, gain per tile) with an align mode
and a store, the identification screen, and the Gray-code frames for camera-in-the-loop alignment (each projector in its
own colour channel; capturing and decoding photos is not built). No dependencies; three.js is passed in. The chapter is
[Projector and LED alignment](align.md); example 31. Its `validateLayout` and `normalizeLayout` are not
[`@openav/tile`](#openav-tile)'s nor [`@openav/surface`](#openav-surface)'s.

| export | signature |
|---|---|
| layout | `ALIGN_FORMAT` (= `CONTRACT`) · `validateLayout(layout)` → `{ ok, errors, warnings }` · `normalizeLayout(layout)` · `LayoutError` · `findLayout(layouts, name)` · `identityLayout(w, h, { id, title })` · `scaleArt(layout, k)` |
| mapping | `computeMapping(layout)` → `{ format, id, art, desktop, outputs, segments, tiles, vendor, warnings }` · `blitPlan(mapping, { pixelRatio, buffer })` · `composePlan` · `composeArtCanvas` · `artView` · `desktopToArt(mapping, x, y)` · `artToDesktop(mapping, ax, ay)` · `cellIdAt` · `analyzeOverlaps` · `blendWeight(tile, ax, ay)` · `vendorPlacements(mapping, { base })` |
| cells | `rowLabel(i)` · `cellSizeFor(w, h)` · `cellAt(seg, size, ax, ay)` · `cellRect(seg, size, name)` · `eachCell(seg, size)` |
| patterns | `ALIGN_PATTERNS` · `BAR_VARIANTS` · `drawPattern(ctx, mapping, pattern, { view, overlay, variant, highlight, outputs, lang })` · `withTile` · `highlightCell` · `drawOutputs` |
| Gray code | `graySequence(size, { inverse, refs, axes })` · `grayBitAt` · `grayRuns` · `channelPlan(mapping)` · `drawGrayFrame(ctx, mapping, frame, { assign, view })` · `decodeGrayBits(bits)` · `grayEncode` · `grayDecode` · `bitsFor` · `frameLabel(frame, lang)` |
| calibration | `CALIBRATION_FORMAT` (= `CAL_CONTRACT`) · `normalizeCalibration(cal, mapping, variant)` · `defaultZone(tile)` · `normalizeZone` · `warpPoint(zone, u, v)` · `squareToQuad(q)` · `featherAt(f, u, v)` · `zoneGrid(zone, n)` · `rotateZone(zone, dir)` · `quadOk(q)` |
| WebGL | `createBlitter(THREE, renderer)` · `createWarpRenderer(THREE)` → `{ build(mapping, zones, n), draw(renderer, texture, region), dispose() }` · `createPatternTexture(THREE, size)` |
| venue | `PATTERN_SOURCES` · `drawSource(g, mapping, source)` · `createCalStore({ bridge, prefix, storage })` · `createAlignUI(o)` · `drawChart(ctx, mapping, outputId, opts)` · `drawIdent` · `drawIdentBase` · `drawIdentLive` · `normalizeAlignArgs(a, { patterns, fallback })` |
| with `@openav/output` | `zoneToRoom(zone, tile, output)` → `{ room, dropped }` · `roomToZone(room, tile, output, base)` → `{ zone, dropped, mirrored }` · `outputsFromAlign(layout, { variant })` → for `createOutputs(show, { align })` |

## @openav/record

L4 output (video branch) · the performance video: the work and the performer's
camera composited into one canvas of an exact size (vertical 1080×1920, 4:5,
2.7K, 4K, landscape, square) and recorded with the work's own sound by one
`MediaRecorder`, so picture and sound are in sync by construction; plus the
sound as its own file, an event log, and MIDI takes (record what you play, play
it back into the show, `.mid` in and out).

| export | signature |
|---|---|
| `Compositor` | `new Compositor({ size = 'vertical-1080p', layout = 'stack', layoutOptions, getWorkCanvas, background, mirrorCam = true, maxFps = 60, onDraw(ctx, rects, comp) })` · `start()` · `stop()` · `draw()` · `setSize(size)` · `setLayout(layout, options)` · `setCamera(stream \| video \| null)` · `drawOnCamera(fn(ctx, w, h))` · `canvas`, `rects`, `video` |
| `Recorder` | `new Recorder({ canvas, fps = 60, audioTracks = [], audioOnly = false, videoBitsPerSecond, mimeType })` · `start({ timeslice = 1000, ondata(blob, seq), keep })` · `stop()` → `Promise<{ mimeType, ext, bytes, durationMs, width, height, blob, … }>` · `t0` |
| `AudioTap` | `new AudioTap({ context, sources, captureDestination })` · `add(node \| stream \| track, { bus })` · `captureDestination()` · `addMicrophone()` · `level()` · `tracks` (work + mic), `workTracks` (work only) |
| `EventLog` | `new EventLog({ now, filter, throttleMs })` · `start(at)` · `stop()` · `add(name, value)` · `attach(signals)` · `toJSON()` · `toTake()` |
| `TakeRecorder` · `TakePlayer` | `new TakeRecorder({ signals, filter = /^midi\//, overdub })` · `start()` · `stop()` → take · `new TakePlayer({ signals, take, loop = true, speed = 1, yieldToLive, resumeAfter, clock })` · `play()` · `pause()` · `stop()` · `seek(ms)` · `update(dt)` |
| pure helpers | `layoutRects(layout, out, src, opts)` · `PRESETS` · `presetById` · `resolveSize` · `recommendedFps(w, h)` · `recommendedBitrate(w, h, fps)` · `pickMime(isTypeSupported, { audioOnly })` · `extFor(mime)` · `normalizeTake` · `validateTake` · `trimSilence` · `quantizeTake` · `toMidiFile(take)` → `Uint8Array` · `fromMidiFile(bytes)` → take |
| cameras | `openCamera({ deviceId, width = 1920, height = 1080, fps = 30 })` → `MediaStream` · `listCameras()` · `listMicrophones()` |

Layouts: `stack` (work on top at full width, camera below), `pip` (camera inset
in a corner), `side` (work left, camera right), `work`. 60 fps up to about
1080×1920, 30 fps for 2.7K and 4K; webcams stop at 1080p, so a 4K frame
enlarges the camera.

```js
import { Compositor, AudioTap, Recorder, openCamera } from '@openav/record';
const comp = new Compositor({ size: 'vertical-1080p', layout: 'stack', getWorkCanvas: () => canvas });
comp.start();
await comp.setCamera(await openCamera());
const tap = new AudioTap({ context, sources: [workOutput] });
const rec = new Recorder({ canvas: comp.canvas, fps: 60, audioTracks: tap.tracks }).start();
// later: const { blob, mimeType } = await rec.stop();
```

Package README with the MIDI takes: [packages/record](../packages/record/README.md).
Example: [10-record](../examples/10-record/main.js).

## @openav/fab

L4 output (physical branch) · can it be made? A manufacturability report for any mesh (watertight, volume, overhang, thinnest wall, grams of PETG / PLA, one Chinese warning per problem) and STL / OBJ / GLB files; STEP and DXF when the shape is a smlibwasm Part or Shape. smlibwasm and manifold-3d are not bundled: `smlib()` / `manifold()` `import()` them from a URL on first use.

| export | signature |
|---|---|
| `Fab` | `new Fab({ urls: { smlib, manifold }, scale, importer, download, context })` · `check(x, opts)` → report · `export(x, fmt, opts)` → `Promise<{ bytes, mime, ext, report }>` (`stl` `obj` `glb` `step` `dxf`) · `save(x, fmt, { name, params, note })` through `saver(bytes, info)` or a browser download · `smlib()` · `manifold()` · `meshOf(x)` |
| pure functions | `checkMesh(mesh, { angle = 45, minWall = 1.2, bed = [320, 320, 325], wallSamples = 2000 })` · `weldMesh(mesh)` · `meshOf(x, { scale })` (TriMesh, smlibwasm Part, three.js Mesh/Object3D, Y up becomes Z up) · `toStlBytes` · `toObjText` · `toGlbBytes` |

## @openav/hw

L4 output (physical branch) · what goes inside. `fab` checks the shell, `hw` checks the electronics. A spec lists the parts and the wires (`{ board, parts: { id: { part, have } }, wires: [['mcu.4', 'acc.SDA'], …] }`), and `hw` finds the nets and reports, one Chinese sentence per problem: a 3.3 V signal into a 5 V LED strip, a voltage above what a pin takes, a supply out of range or only there on the charger, ESP8266 boot pins, one pin wired to two jobs, I²C address clashes, current beyond a regulator, battery hours. The parts library takes every number from a datasheet; what could not be confirmed is `null` (待查) and the check says it cannot tell.

| export | signature |
|---|---|
| `Hw` | `check(spec)` → `{ ok, issues: [{ level, code, text, at }], warnings, notes, nets, power: { rails, battery }, i2c }` · `diagram(spec)` → SVG string · `bom(spec)` → `{ have, buy, unknown }` (no prices, no shop links) · `parts` · `part(key)` · `resolvePin(spec, ref)` · `nets(spec)` |
| `HW_PARTS` | the library: Feather HUZZAH ESP8266, Arduino Leonardo and UNO R3, RC522, HC-SR501, 10 kΩ pot, LIS3DH, MPU-6050 (GY-521), WS2812B, SK6812, NeoPixel rings 12 and 16, 1-cell LiPo (JST-PH), TP4056 and Micro-Lipo USB-C chargers, Qi receiver |

## @openav/timeline

Spine · automation, scenes and transport; pure logic.

| export | signature |
|---|---|
| `Timeline` | `new Timeline({ params, automation = {}, scenes = [], total = 600, score = null, start = null, loop = false, onCue = null, anchor = null })` · `play()` (releases a hold), `pause()`, `toggle()`, `seek(t)`, `jumpScene(d)`, `next()` (releases a hold, else a scene on), `prev()`, `release()`, `reset()` (to `start`, default 0) · `advance(dt)` · `state(t)`, `valueAt(key, t)` · `sceneIndexAt(t)`, `currentScene(t)`, `sceneEnd(i)` · `onSceneChange(cb(i, scene, { cause }))`, `onSeek(cb(t, kind))` · `layer(key, value, t)` · keyframes `[t, value, curve?]` (`'linear'` · `'ease'` · `'in'` · `'out'` · `'step'`) · `loop` (`true`, `'scene'`, a scene id, `{ from, to }`), `onLoop(cb)` · `cues()`, `onCue(cb(cue, { cause }))`, `fireCue(cue)` · `record(key, source)`, `stopRecording()`, `onRecord(cb)`, `mergeTake(key, take, opts)` · per-segment automation `{ key: { segmentId: [[p, value, curve?], …] } }`, `lanePos(t)`, `laneTime(id, p)`, `lanePlan()`, `lanes()` · `exportAutomation({ keys, as, precision })`, `importAutomation(doc, { keys, replace, ignoreCut })` · `anchor(epoch, opts)`, `unanchor()`, `drift()`, `onDrift(cb)` · `follow(source, opts)`, `unfollow()`, `following`, `followStatus()`, `onFollow(cb)` · `t`, `playing`, `holding`, `rate`, `total`, `start`, `score` |
| `compileLane`, `decompileLane`, `lanePos`, `laneTime`, `isLane`, `AUTOMATION_FORMAT` | the segment-lane conversions as pure functions over a segment table `[{ id, start, end }]` (`score.rootSegments`), for tools that have no timeline |

A keyframe's third item is the curve of the segment that ends at it; a keyframe without one is linear, exactly as before. A scene's `cues` fire when playback passes them, never on a seek. `record()` writes a value source (a knob override) into a lane while the timeline plays. `CURVES` is exported too. Curves can be written per segment, saved as JSON and read back, and the timeline can watch the wall clock: [Lanes](show-control.md#lanes-curves-written-per-segment), [Saving and loading automation](show-control.md#saving-and-loading-automation), [Wall clock](show-control.md#wall-clock-anchor-and-drift), or follow another timeline's clock: [Following another clock](show-control.md#following-another-clock-follow).

See [Show control](show-control.md#timeline).

## @openav/score

Spine · the score and the director: a show written as segment lengths, and the modules that perform the segments. Pure logic, no DOM.

| export | signature |
|---|---|
| `Score` | `new Score({ cuts, cut })` · `table()` · `total` · `segmentAt(T)`, `indexAt(T)` · `locate(T)`, `timeAt(id, p)` · `cueTime('seg.name')` · `cuesBetween(T0, T1)` · `cues()` · `scenes()` · `validate()` · `cuts`, `cut`, `segments` (each with its `meta`), `startT`, `scale`, `baseTime(T)`, `rootSegments`, `allSegmentIds()` |
| `ScoreError` | thrown by an invalid score; `problems` lists every reason |
| `Director` | `new Director({ score, modules, api, onStatus, onCue, maxStep })` · `update(T, dt, { holding, playing })` · `param(key, value, T)` · `seek(T)` · `reset()` · `status()` · `register(module)` |

```js
import { Score, Director } from '@openav/score';
const score = new Score({ cuts, cut: 'full' });
const director = new Director({ score, modules, api });
// every frame, after timeline.advance(dt):
director.update(timeline.t, dt, { holding: timeline.holding, playing: timeline.playing });
```

Full reference: [Score & Director](score.md).

## @openav/pattern

Spine · rhythm in one line: mini-notation, the way TidalCycles and Strudel write rhythm, read into the hits of each bar. Pure logic. An independent implementation from their public documentation (the writing comes from [TidalCycles](https://tidalcycles.org) and [Strudel](https://strudel.cc)).

| export | signature |
|---|---|
| `compile` | `compile(src, { words = WORDS })` → `{ ok, error, src, voices, layers, period, eventsInBar(bar, { seed = 0 }) }`, never throws · `eventsInBar` (bars from 1) → `[{ word, voice, n, pos, dur, vel, layer, token: { start, end } }]` sorted by `pos` (0..1 in the bar) · `error` → `{ code, index, length, message, hint }`, `code` one of `empty` `unclosed` `unexpected` `bad-number` `bad-euclid` `unknown-word` `unsupported` |
| `parse` | `parse(src)` → `{ ok, tree }` or `{ ok: false, error }`: nodes `step` `rest` `seq` `layer` `alt` `fast` `slow` `euclid` `maybe`, each with its character range |
| `WORDS` | `bd` kick · `sd` snare · `hh` hat · `oh` openhat · `cp` clap · `rim`/`rs` · `lt` `mt` `ht` toms · `cr` crash · `rd` ride · `cb` cowbell, and the kit's own names |
| `euclid` | `euclid(pulses, steps, rotate = 0)` → booleans (Toussaint 2005) |
| `fromGrid` | `fromGrid(grid, { steps = 16, words, order })` → a line that plays exactly the grid, written the way a person would: `bd*4`, `[~ sd]*2`, `bd(3,8,2)`, else beat by beat `bd [~ ~ ~ bd] bd*2 ~` (0.7) |
| `toGrid` | `toGrid(srcOrCompiled, { bar = 1, steps = 16, seed = 0, bars = 16 })` → `{ ok, grid, words, voices, exact, lost: { offGrid, stacked, varies, random, samples } }`: bar `bar` on the steps and what they cannot hold; `seed` decides each `?` (as in `eventsInBar`), `bars` is how many bars it looks through to tell whether the others differ (`lost.varies`) (0.7) |
| `fromStrudel` | `fromStrudel(code)` → `{ strudel, ok, src, bpm, ignored, unsupported }`: `s("…")` / `sound("…")` copied from strudel.cc, `.fast` / `.slow` folded in, `setcpm` / `setcps` as `bpm` (0.7) |
| `toStrudel`, `strudelUrl` | `strudelUrl(src, { bpm, comment })` → `https://strudel.cc/#…` (the line as `s("…")` with `setcpm(bpm/4)`, base64 in the `#`); open it in a new tab (0.7) |

Writing: spaces (steps share the bar) · `~` `-` rest · `[ ]` group · `,` layers · `*n` faster · `/n` slower, across bars · `< >` one per bar · `(k,n,r)` Euclidean · `!n` and `!` repeat · `@n` and `_` longer · `?` `?0.3` drop by chance (seeded) · `bd:2` sample number. `.` `|` `{ }` are refused with a hint (rests are `~` or `-`).

```js
import { compile } from '@openav/pattern';
const p = compile('bd*4, [~ sd]*2, hh*8');
p.eventsInBar(1);   // kick 0 .25 .5 .75 · snare .25 .75 · hat every 1/8
```

## @openav/console

Spine · the director's desk: transport, layer panels, params with learn, signal
meters, performance mode.

| export | signature |
|---|---|
| `mountConsole` | `mountConsole(el, app, { layers, signals, learnOrder, keys, curves })` → `{ render(state), perf, director, curves, wizard, keys, dispose() }`; `app` = `{ timeline, params, mapper, signals, stage, midi?, midiPanel?, sound?, audio?, hands?, pose?, loop?, osc?, score?, director? }` |
| Curves panel | `curves`: `false` leaves it out, `{ open: true }` starts it open; `desk.curves` → `{ toggle(force?), open, info() }` (`null` with `curves: false`). One curve per automated param across the whole show, the playhead, overrides with ↩ and ↩ all, click to seek: [The curves panel](show-control.md#the-curves-panel) |
| keyboard | `keys`: `{ play, next, prev, reset, perf, fullscreen, midi, cancel, curves }` → a key or a list (`'F6'`, `'KeyR'`, `'Shift+T'`), `false` = off; `keys: false` = no shortcuts · `DEFAULT_KEYS` · `resolveKeys(keys)` · `keyLabel(keys, action)`: [Moving the shortcuts](show-control.md#moving-the-shortcuts) |

See [Show control](show-control.md#the-console).

## @openav/monitor

Spine · the backstage page and the WebSocket relay that feeds it.

| export | signature |
|---|---|
| `MonitorFeed` | `new MonitorFeed({ url = 'ws://<page host>:7457', hz = 15, extra })` · `connect()` · `frame(snapshot)` · `extra(fn)` → `off()` · `connected`, `onStatus` |
| `snapshotOf` | `snapshotOf({ timeline, params, signals, stage, loop, extra? }, state)` → a JSON snapshot; the work's own numbers (`extra`, the active world's `monitor()`) land under `extra` |
| `cleanExtra` | `cleanExtra(x)` → the work's numbers made safe for JSON (a number, string, boolean, null or `{ v, min, max, warn }` per field), or `null` when there are none |
| server | `node packages/monitor/server.js [port=7457]`: backstage page at `/`, `/health` |

See [Show control](show-control.md#backstage-monitor).

## @openav/sync

Spine · several pages, one show: the wire between a leader and its followers, over a BroadcastChannel or the room relay. A follower's timeline chases the leader with [`timeline.follow()`](show-control.md#following-another-clock-follow).

| export | signature |
|---|---|
| `createSync` | `createSync({ role, channel, url, timeline, score, follow, extra, state, hz, info, accept, onFrame, onState, onGap, id, now, transport })` → a `SyncLeader` or a `SyncFollower`; a follower's timeline is made to follow it. Call `sync.frame()` after `timeline.advance(dt)` every frame; `sync.close()` lets go |
| `SyncLeader` | `new SyncLeader({ timeline, transport, id, cut, extra, state, hz, now, onHello })` · `frame()` · `sendState(to?)` · `status()` · `monitor()` · `close()` |
| `SyncFollower` | `new SyncFollower({ transport, id, now, timeline, info, accept, onFrame, onState, onGap, resync = true, helloEvery = 1000, takeoverAfter = 1500, resyncAfter = 1000 })` · `latest()` (a `timeline.follow()` source) · `hello(reason)` · `frame()` · `status()` · `monitor()` · `close()` |
| transports | `BroadcastTransport({ channel })` · `RelayTransport({ url, room, role, id })` · `createTransport({ role, channel, url, id })`: each is `{ send(msg), onMessage(cb), onOpen(cb), open, close() }` and carries JSON |
| `SYNC_VERSION` | `1`, the `v` of every message |

Messages are `frame` (leader to followers, every frame), `hello` (follower to leader) and `state` (leader to one follower); work-specific data rides in `extra`. See [Show control](show-control.md#several-pages-one-show). [`@openav/tile`](#openav-tile) keeps a clock of its own: no leader, every screen asks the relay what time it is and draws from that ([the difference](tile.md#the-shared-clock)).

## @openav/relay

Phones · room-scoped WebSocket relay (server) and its browser client.

| export | signature |
|---|---|
| `RelayClient` | `new RelayClient({ role, room, id, url, batchHz = 30, resendMs = 1000, onStatus, onSignal, onFeedback, onConfig, onSync })` · `connect()` · `close()` · `set(name, value)` · `send(name, value, pulse, extra)` · `feedback(name, value)` · `config(key, data)` · `sync(msg)` · `status`, `latency`, `peers`; `role` is `controller`, `runner`, `monitor`, `leader` or `follower` |
| signals helpers | `bindSignals(client, signals, { alias = 'any' })` · `fileSignal(signals, name, value, { pulse })` · `signalMeta(name, { pulse })` · `aliasOf(name)` · `normalizeValue(name, value)` · `deviceId()` |
| `@openav/relay/server` | `attachRelay(httpServer, { path = '/relay', log, heartbeatMs = 20000, maxMessageChars = 262144, maxBytes = 1048576 })` → `{ hub, close() }`; standalone `node packages/relay/server.js [port=7458]` |
| `MidiLink` (`link.js`) | `new MidiLink({ url, room, delay = 0, onMessages(list, from), onStatus })` · `connect()` · `send(bytes, whenMs)` · `info()` → `{ state, peers, rtt, trip, diff, lead, late, sent, received }` · `close()`; `LinkTiming`: MIDI between pages in one room, played when it sounds at the sender ([With Strudel](strudel.md)) |

See [Phones, relay & surfaces](remote.md#the-relay).

## @openav/surface

Phones · TouchOSC-style widgets, layout JSON, theme, and `autoSurface(params)`.

| export | signature |
|---|---|
| `Surface` | `new Surface(el, { layout, sink(name, value, info), haptics = true, tabs = true, orientation, onPage })` · `setLayout(layout)` · `setPage(id)` · `feedback(name, value)` · `widget(page, id)` · `dispose()` |
| `signalSink` | `signalSink(signals)` → a sink that writes into a local `Signals` |
| auto | `autoSurface(params, { perPage, style, pairs, meters, smooth, title })` → `{ layout, routes, bindings }` · `feedbackFor(state, bindings)` · `routesFromLayout(layout, params)` · `widgetTypeFor(param)` |
| layout | `validateLayout`, `normalizeLayout`, `resolvePage`, `autoArrange`, `signalNames`, `DEFAULT_SIZE`, `WIDGET_TYPES`, `planKeyboard` |
| platform & theme | `lockViewport`, `keepAwake`, `toggleFullscreen`, `canFullscreen`, `haptic`, `injectTheme`, `THEME_VARS`, `COLOR_NAMES`, `WIDGET_CLASSES` |

```js
import { Surface, autoSurface, signalSink } from '@openav/surface';
const { layout, routes } = autoSurface(world.params);
new Surface(document.querySelector('#panel'), { layout, sink: signalSink(signals) });
routes.forEach((r) => mapper.addRoute(r));
```

See [Phones, relay & surfaces](remote.md#surface-widgets).

## @openav/remote

Phones · the phone/iPad app and the show-side adapter.

| export | signature |
|---|---|
| `mountRemote` | `mountRemote(el, { room, relayUrl, surfaceUrl, metaUrl })` → the phone app (`/packages/remote/index.html` calls it) |
| `PhoneSensors` | `new PhoneSensors({ set, send }, { onKnock, onSample, notify })` · `start()` (from a tap) · `stop()` · `calibrate()` · `setCamera(on)` · `denied` |
| `localSensors` | `localSensors(signals, { prefix = 'phone/local/', alias = 'any' })` → `PhoneSensors` |
| `attachTouchPad` | `attachTouchPad(el, io, { onMove, onEnd })` |
| `@openav/remote/host` | `mountRemoteHost({ signals, params, mapper, world, room, auto, surface, feedbackHz = 10, url, mode, controllers })` → host · `mountJoinCard(parent, host)` (URL, QR code, status) |
| `@openav/remote/relay-pick` | `pickRelay({ hostname, search, declared, storage })` → `{ mode: 'local'\|'public'\|'custom'\|'off', url, room, shared }` · `isLocalHost(h)` · `PUBLIC_RELAY` · `phoneUrl({ base, room, relay })` |
| `@openav/remote/qr` | `qrSvg(text, { ecc = 'M', margin = 2, scale })` → an `<svg>` string · `qrMatrix(text, { ecc })` → `{ version, size, mask, rows }` (byte mode, versions 1–10) |

See [Phones, relay & surfaces](remote.md).

## @openav/tile

Phones · several screens lying on a table become one canvas: one photo of their markers places every screen, one clock shared
over the relay and one seed keep them together, and each screen draws only its own piece. Not `@openav/output`, which shows
one stage, rendered once, through projector windows: here many devices each render their part of one canvas, placed by a
photo. Its clock is not `@openav/sync` either: no leader page streams a playhead, every screen asks the relay what time it is
(the difference is in the chapter). The chapter is [Several screens, one canvas](tile.md); example 30; the camera page is
`packages/tile/?room=<name>` (`?demo=1`: a synthetic photo, no hardware).

| export | signature |
|---|---|
| `joinTile` | `joinTile({ room, url, id, signals, container, ui = true, storage, Link })` → tile · `view` · `time()` (shared seconds) · `now()` · `seed` · `size()` · `markers(on)` · `attach(signals)` · `syncTimeline(timeline, dt)` · `on('layout' \| 'roster' \| 'mode' \| 'show' \| 'view' \| 'resize', cb)` · `status()` · `close()`; publishes `tile/markers`, `tile/synced`, `tile/layout` (pulse) · `tileId(storage)` · `helloName(id)` · `HELLO_RE` · `TILE_KEYS` |
| `tileWorld` | `tileWorld(world, tile)` → the world plus the param `tileMarkers` (0 show · 1 markers) and `io.tile` / `ctx.tile`; `TILE_PARAMS`, `TILE_ROUTES` (`tile/markers` → `tileMarkers`) |
| `tileView` | `tileView(layout, id)` → `{ ok, canvas, device, toCanvas, toDevice, scale, angle, bounds, polygon, point(x, y), fromDevice(x, y), matrix(pixelRatio), apply2d(ctx, pixelRatio), applyP5(sk), css(dpr), visible(x, y, r) }` or `{ ok: false, reason }` · `soloView(w, h, id)` |
| `solveLayout` | `solveLayout({ devices: [{ id, w, h, index, markers: [{ device, photo }] }], photo, minMarkers = 4, reference, refine = true, rejectPx = 6 })` → `{ ok, layout, report, reason }`, never throws · `validateLayout(layout)` → `{ ok, errors }` (a tile layout, not `@openav/surface`'s) · `LAYOUT_VERSION` |
| geometry | `homography(src, dst, { normalize = true })` (normalized DLT, ≥ 4 points, never throws; `@openav/output`'s `cornerPin` is the four-corner case for CSS) · `fitSimilarity(src, dst)` · `similarityMatrix`, `similarityOf`, `similarityScale`, `similarityAngle` · `mul3`, `inv3`, `apply3`, `det3`, `rmsError`; `@openav/tile/solve` also has `I3` and `normalizer` |
| markers | `markerGrid(w, h, { short = 4, fill = 0.72 })` · `markerId(device, cell)` · `decodeMarkerId(id)` · `correspondences(found, roster, grid)` · `drawMarkers(ctx, { w, h, index, grid, label })` · `GRID_DEFAULTS` · `PER_DEVICE` (50) · `MAX_DEVICES` (20) · `DICT_NAME` (`DICT_5X5_1000`), `markerCode(id)`, `markerBits(id)` |
| clock | `new ClockSync({ now, window = 60000, keep = 40 })` · `add(t0, server, t1)` · `offset` · `rtt` · `now()` · `ready` · `clockSample(t0, server, t1)` · `estimateOffset(samples)` (the quickest round trip) · `TileLink` (a `RelayClient` that pings the relay and keeps the clock) |
| `@openav/tile/detect` | `loadOpenCV(url = OPENCV_URL)` (OpenCV.js 4.12.0 from jsDelivr, the camera page only) · `detectMarkers(cv, image, { maxSide = 4096, params })` → `{ found: [{ id, corners }], rejected, ms, w, h }` · `greyPixels(src, maxSide)` · `OPENCV_VERSION`, `OPENCV_URL` |

Subpath entries `@openav/tile/solve`, `/clock`, `/marker`, `/view` and `/detect` need their own import-map line. `layout.json`:
`{ version: 1, reference, canvas: { w, h }, plane: { matrix3x3 }, devices: [{ id, w, h, kind: 'planar', similarity: { a, b, tx, ty }, matrix3x3, rms, pose: null }] }`;
`pose` is kept for a screen posed in 3D.

## @openav/devices

Glue · one collection of show devices: every MIDI controller profile (hand-written and imported), every DMX fixture, every part
of the electronics library, and hand-written records for cameras, audio interfaces, sensors, LED and DMX interfaces and printers,
under one outer record (`open-audiovisual/device@1`, `@openav/devices/device.schema.json`) with a source for every fact. Nothing is
copied: each profile, fixture and part stays in its own file and its record is read off it (`node tools/build-devices.mjs` writes the
list, `catalog.js`), so listing loads no profile. The chapter is [Devices](devices.md).

| export | signature |
|---|---|
| `devices` | `devices({ kind, q, connection })` → frozen rows `{ id, kind, manufacturer, name, aliases, connections, protocols, verified, from, file }`; `q` matches every word in the name, aliases, maker or id |
| `device` | `await device(id, options)` → `{ id, kind, name, record }` and, by kind: midi-controller `profile` · `routes(bindings, options)` · `addTo(controllers)`; dmx-fixture `profile` · `patch(patch, { id, universe, address, mode })`; part `part`; camera, audio-interface `constraints(deviceId)` · `find()` · `open()` (the only call that asks for a permission) |
| `deviceKinds` | `midi-controller` · `dmx-fixture` · `dmx-interface` · `led-controller` · `sensor` · `camera` · `audio-interface` · `projector` · `display` · `printer` · `part` |

## @openav/mcp

Glue · a zero-dependency MCP server over stdio for coding agents:
`node packages/mcp/server.js`. Tools and arguments are in
[For AI agents](agents.md#the-mcp-server).
