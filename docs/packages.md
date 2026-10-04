# Package reference

Twenty packages live in `packages/<name>/`. Each is plain ES modules with no
dependencies; in a page you import them as `@openav/<name>` through an import
map (copy the one in `examples/01-hello-particles/index.html`). Nothing is on
npm yet.

| layer | packages |
|---|---|
| L1 input | `midi` · `audio` · `chord` · `pose` · `keys` · `drums` |
| L2 mapping | `mapping` |
| L3 world | `stage` · `world-webtoe` |
| L4 output | `sound` · `osc` (and MIDI out in `midi`) |
| spines | `timeline` · `console` · `monitor` |
| phones | `relay` · `surface` · `remote` |
| glue | `core` · `show` · `mcp` |

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
| `Loop` | `new Loop(onFrame(dt, now), { maxDt = 0.1 })` · `start()` · `stop()` · `fps` |
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
[Show control](show-control.md#createshow).

```js
import { createShow } from '@openav/show';
const show = await createShow({ world, modules: { keys: { base: 48 }, sound: true } });
```

## @openav/midi

L1 input and L4 output · Web MIDI in and out, many devices at once, and
on-screen controllers that mirror real hardware.

| export | signature |
|---|---|
| `Midi` | `new Midi({ signals, filterOut = 'IAC', requestAccess })` · `enable(preferredOut = '')` → `Promise<boolean>` · `devices()` → `[{ slug, name, listening }]` · `setListening(slug, on)` · `onDevices(fn)` · `listen(fn(bytes, port))` · `selectOutput(name)` · `outputFor(nameOrRegExp)` · `send(bytes)` · `noteOn(note, vel = 100, ch = 1)` · `noteOff(note, ch = 1)` · `cc(cc, val, ch = 1)` · `panic()` · `dispose()` · hooks `onCC`, `onNote`, `onMessage`, `onSend`, `onDeviceChange` |
| parsing | `parseMessage(bytes)` → event · `encodeMessage(event)` → bytes · `genericSignals(event, { device })` · `publish(signals, list)` · `describe(event)` · `relativeDelta(value, mode)`, `relativeValue(delta, mode)`, `RELATIVE_MODES` · `bendToUnit`, `unitToBend`, `BEND_CENTER` |
| controllers | `MidiController`, `MidiControllers`, `controllerRoutes(profile, bindings)`, `PROFILES`, `profileById(id)`, `ControllerView`, `mountMidiPanel(el, controllers, opts)`, `linkControllers`, profile helpers (`validateProfile`, `normalizeProfile`, `matchProfile`, …) |
| Web MIDI shim | `createVirtualMIDIAccess(opts)`, `virtualRequestMIDIAccess` |
| embedding | `createController(profile, { profiles, signals, channel, follow, midi, requestAccess, filterOut })` → `ControllerHost` (`on(event, fn)`, `set`, `press`, `release`, `values`, `mount(el)`, `learn()`, `dispose()`) · `loadProfile(idOrUrl)` · the `<oav-controller>` element in `packages/midi/element.js` · embed protocol helpers in `embed.js` |

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
| `mountDrums` | `mountDrums(container, { signals, engine, autoEnableEngine = true })` → `{ seq, engine, update(dt), dispose() }` |
| `DrumSequencer` | `new DrumSequencer({ onHit(lane, vel), bpm = 112, swing = 0.12, humanize = 0.35, pattern = 'four on floor' })` · `setPattern(name)` · `toggleCell(lane, i)` · `toggle(on)` · `update(dt)` · `grid`, `bpm` |
| `drumEngine` | `drumEngine({ samples })` → a sound engine (see [Sound](show-control.md#sound)) |
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
| `Mapper` | `new Mapper({ signals, params, profile = 'default', onChange, onLearn })` · `addRoute(route)` · `removeRoute(id)` · `routesFor(target)` · `learn(target)` · `update(dt)` · `toJSON()` · `fromJSON(routes)` · `save()` · `load()` · `dispose()` · `routes`, `learnTarget` |

```js
import { Mapper } from '@openav/mapping';
const mapper = new Mapper({ signals, params });
mapper.addRoute({ source: 'midi/cc/74', target: 'bloom', curve: 'exp', smooth: 0.1 });
// every frame: mapper.update(dt);
```

Full reference: [Mapping](mapping.md).

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

L4 output · in-page synthesis behind a small engine contract; engine params
become `sound/*` params.

| export | signature |
|---|---|
| `Sound` | `new Sound({ signals, params, engine })` · `enable()` (from a click) · `update(state)` per frame · `dispose()` · `enabled` |
| `toneEngine` | `toneEngine({ cdn })` → engine with params `cutoff`, `space`, `volume` |

Engine contract: `{ params, enable(), noteOn(note, vel01), noteOff(note), set(key, value), dispose() }`.

```js
import { Sound, toneEngine } from '@openav/sound';
const sound = new Sound({ signals, params, engine: toneEngine() });
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

## @openav/timeline

Spine · automation, scenes and transport; pure logic.

| export | signature |
|---|---|
| `Timeline` | `new Timeline({ params, automation = {}, scenes = [], total = 600 })` · `play()`, `pause()`, `toggle()`, `seek(t)`, `jumpScene(d)`, `reset()` · `advance(dt)` · `state(t)`, `valueAt(key, t)` · `sceneIndexAt(t)`, `currentScene(t)`, `sceneEnd(i)` · `onSceneChange(cb(i, scene))` · `t`, `playing`, `rate`, `total` |

See [Show control](show-control.md#timeline).

## @openav/console

Spine · the director's desk: transport, layer panels, params with learn, signal
meters, performance mode.

| export | signature |
|---|---|
| `mountConsole` | `mountConsole(el, app, { layers, signals })` → `{ render(state), perf, dispose() }`; `app` = `{ timeline, params, mapper, signals, stage, midi?, sound?, audio?, hands?, pose?, loop?, osc? }` |

See [Show control](show-control.md#the-console).

## @openav/monitor

Spine · the backstage page and the WebSocket relay that feeds it.

| export | signature |
|---|---|
| `MonitorFeed` | `new MonitorFeed({ url = 'ws://<page host>:7457', hz = 15 })` · `connect()` · `frame(snapshot)` · `connected`, `onStatus` |
| `snapshotOf` | `snapshotOf({ timeline, params, signals, stage, loop }, state)` → a JSON snapshot |
| server | `node packages/monitor/server.js [port=7457]`: backstage page at `/`, `/health` |

See [Show control](show-control.md#backstage-monitor).

## @openav/relay

Phones · room-scoped WebSocket relay (server) and its browser client.

| export | signature |
|---|---|
| `RelayClient` | `new RelayClient({ role, room, id, url, batchHz = 30, resendMs = 1000, onStatus, onSignal, onFeedback, onConfig })` · `connect()` · `close()` · `set(name, value)` · `send(name, value, pulse, extra)` · `feedback(name, value)` · `config(key, data)` · `status`, `latency`, `peers` |
| signals helpers | `bindSignals(client, signals, { alias = 'any' })` · `fileSignal(signals, name, value, { pulse })` · `signalMeta(name, { pulse })` · `aliasOf(name)` · `normalizeValue(name, value)` · `deviceId()` |
| `@openav/relay/server` | `attachRelay(httpServer, { path = '/relay', log, heartbeatMs = 20000 })` → `{ hub, close() }`; standalone `node packages/relay/server.js [port=7458]` |

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
| `@openav/remote/host` | `mountRemoteHost({ signals, params, mapper, world, room, auto, surface, feedbackHz = 10, url, controllers })` → host · `mountJoinCard(parent, host)` |

See [Phones, relay & surfaces](remote.md).

## @openav/mcp

Glue · a zero-dependency MCP server over stdio for coding agents:
`node packages/mcp/server.js`. Tools and arguments are in
[For AI agents](agents.md#the-mcp-server).
