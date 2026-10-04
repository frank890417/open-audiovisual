# Show control

The parts that turn a sketch into a performance: the one-call assembly, the
timeline, the console, performance mode, the backstage monitor, and the ways
sound and data leave the browser.

## createShow

`createShow()` (`@openav/show`) builds a whole show around a world and returns
every part. It is `async` because it waits for the world's `init`.

```js
import { createShow } from '@openav/show';

const show = await createShow({
  world: myWorld,
  timeline: { total: 120, automation: { hue: [[0, 205], [60, 320]] }, scenes },
  routes: [{ source: 'audio/rms', target: 'energy', inMax: 0.3, smooth: 0.1 }],
  modules: { keys: { base: 48 }, chord: true, audio: true, sound: true },
  artwork: { title: 'Untitled', artist: 'You', year: 2026 },
  hint: 'play the piano · Space plays the timeline',
});
```

| option | default | meaning |
|---|---|---|
| `world` | `null` | the world to perform; it is activated first |
| `worlds` | `[]` | more worlds to register (switch with `show.stage.activate(name)`) |
| `timeline` | `{ total: 120 }` | `{ total, automation, scenes }` for the [timeline](#timeline) |
| `routes` | `[]` | routes to add to the mapper ([Mapping](mapping.md)) |
| `modules` | `{}` | inputs and outputs to switch on (below) |
| `artwork` | `null` | `{ title, artist, year, note }`: a credit line on the stage and a `<meta name="artwork">` |
| `hint` | `''` | a line of HTML at the bottom left of the stage |
| `profile` | the world's name | the mapper's saved-profile name; `false` = ignore saved routes ([Saved profiles](mapping.md#saved-profiles)) |
| `onFrame` | `null` | `(dt, show) => {}` every frame, before the timeline advances |
| `mount` | generated | `{ stage, side }` elements or selectors to render into, instead of a full-page layout |

Without `mount`, the page body becomes a two-column grid: the stage, and a
340 px side panel with the piano and the console.

| `modules` key | values | what it adds |
|---|---|---|
| `midi` | on by default; `false` | the `Midi` engine (input and output) |
| `midi.controllers` | `true` or `{ profile, profiles, open }` | an on-screen MIDI controller docked on the stage, a 🎹 button and the <kbd>M</kbd> key; `?profile=<id>` in the URL picks the device ([controllers](controllers.md)) |
| `keys` | on by default; `false`; `{ base, octaves, sim, capture }` | the on-screen piano, QWERTY and the simulated performer |
| `drums` | `true`; `{ engine, autoEnableEngine }` | the drum machine |
| `audio` | any truthy value | the microphone analyzer (starts from 🎤 mic) |
| `chord` | `true`; `{ window }` | chord analysis of every played note |
| `hands` | `true` | the hand tracker (starts from 🖐 hands) |
| `pose` | `true` | the body tracker (starts from 🕺 body) |
| `remote` | `true`; `{ room, auto, surface, feedbackHz, url }` | phones and iPads as controllers ([Phones](remote.md#the-show-side)) |
| `sound` | `true`; `{ engine }` | an in-page synth, Tone.js by default ([Sound](#sound)) |

It returns `{ signals, params, stage, timeline, mapper, midi, controllers,
midiPanel, keys, drums, sound, audio, hands, pose, chord, remote, console, app,
loop }`; parts you did not ask for are `null`. The same object is
`window.openav`, for the devtools console. The frame order is in
[Architecture](architecture.md#the-frame-loop).

## Timeline

```js
const timeline = new Timeline({
  params,
  total: 2400,                       // seconds (default 600 when used directly; createShow uses 120)
  automation: {
    growth: [[0, 0.2], [300, 1.0], [1200, 0.4]],   // [t, value] keyframes, linear
    mode:   [[0, 0], [600, 1], [1800, 2]],          // step params hold (no interp)
  },
  scenes: [
    { id: 'standby', t: -30, title: 'Standby', note: 'house lights · breathe' },
    { id: 'act1',    t: 0,   title: 'Act I',   note: 'single seeds only' },
    { id: 'act2',    t: 600, title: 'Act II',  note: 'full harmony' },
  ],
});
timeline.onSceneChange((i, scene) => { /* fire cues: sound, lights, OSC */ });
```

- negative scene times = pre-show standby (the clock shows -0:30)
- `jumpScene(±1)` (← → keys) is your emergency navigation — rehearse with it
- `timeline.rate` exists for rehearsal speed-through (`rate = 4`)
- playback stops by itself at `total`

| member | what it does |
|---|---|
| `play()`, `pause()`, `toggle()` | transport |
| `seek(t)` | jump to `t` seconds (clamped between the first scene's negative time, or 0, and `total`) |
| `jumpScene(d)` | go to the start of the scene `d` steps away |
| `reset()` | stop and rewind to 0 |
| `advance(dt)` | per frame; moves `t` by `dt × rate` while playing |
| `state(t)`, `valueAt(key, t)` | the automation values at a time (no overrides) |
| `sceneIndexAt(t)`, `currentScene(t)`, `sceneEnd(i)` | scene lookup |
| `onSceneChange(cb)` | `cb(index, scene)` whenever playback or a seek lands in a different scene |
| `t`, `playing`, `rate`, `total`, `scenes`, `automation` | state you can read (and set) |

A cue list is just a scene-change handler:

```js
show.timeline.onSceneChange((i, scene) => {
  if (scene.id === 'storm') show.stage.activate('storm');   // switch worlds
  show.midi?.cc(20, i, 16);                                  // tell the lighting desk
});
```

## The console

`mountConsole(el, app, { layers, signals })` (`@openav/console`) builds the
director's desk; `createShow()` mounts it in the side panel. `app` is the object
`createShow()` returns as `show.app` (`timeline`, `params`, `mapper`, `signals`,
`stage`, `midi`, `sound`, `audio`, `hands`, `pose`, …); missing parts simply
hide their section. Pass `{ layers: false }` or `{ signals: false }` to leave out
those panels. It gives you transport + scrubber with scene blocks, the Layers
overview, L1 Input, L2 Mapping, L3 Params (sliders with override and learn
chips), L4 sound, live signal meters and a MIDI log.

Keyboard: **Space** play/pause · **←/→** scenes · **R** reset · **T** performance
mode · **F** fullscreen. Keys typed into an input field are ignored.

Override semantics: touch a slider (or a mapped control) and that param leaves
the timeline's hands until you clear it (✕). Yellow label = overridden.

## Performance mode

**T** flips to a fullscreen teleprompter: current scene title + note in stage-
readable type, next scene preview, clock + scene countdown. This is for the
*performer*; the audience-facing window is your stage in fullscreen (**F**).
Two windows of the same page = one desk, one stage.

## Backstage monitor

```bash
node packages/monitor/server.js       # on the performance machine (npm run monitor)
# stage manager's phone/laptop: http://<performance-machine-ip>:7457/
```

Every show page made with `createShow()` streams snapshots to
`ws://<the page's host>:7457` about 15 times a second, so run the monitor
server on the machine that serves the show. Backstage shows clock, scene,
world, FPS, overrides, all signals and params live, and a red "stage feed
lost" banner if the stage stops sending for 4 s — which is exactly the moment a
stage manager earns their pay. Zero configuration, zero dependencies; both ends
reconnect by themselves. `GET /health` answers `{ ok, clients }`.

When no monitor is running, the show page keeps retrying with a growing delay
(about 5 s, growing to 30 s); the browser logs each refused connection. That message is
expected.

For a hand-assembled show:

```js
import { MonitorFeed, snapshotOf } from '@openav/monitor';
const monitor = new MonitorFeed({ url: 'ws://192.168.1.20:7457', hz: 15 });   // both optional
monitor.connect();
// every frame:
monitor.frame(snapshotOf({ timeline, params, signals, stage, loop }, state));
```

## OSC output

```bash
node packages/osc/bridges/osc-bridge.js 7456 192.168.1.50 3456
#                       http port ↑    target host ↑   udp port ↑
```

The defaults are `7456 127.0.0.1 3456`. The browser cannot send UDP, so
`OscOut` posts batches to the bridge over HTTP and the bridge sends them as OSC
packets.

```js
import { OscOut } from '@openav/osc';

const osc = new OscOut();          // http://127.0.0.1:7456
await osc.enable();                // probes /health, fails gracefully (false)
osc.send('/source/3/xyz', [x, y, z]);
osc.flush();                       // once per frame (batches, dedupes per address)
```

Numbers go out as OSC floats — what Spat, Reaper, and TouchDesigner expect;
anything else is sent as a string. Only the latest message per address survives
a frame. If the bridge disappears, `OscOut` reports it through `onStatus(ok,
info)` and stops trying after 30 failed flushes.

`createShow()` does not create an `OscOut`. Add one yourself (and add
`"@openav/osc": "../../packages/osc/index.js"` to the page's import map):

```js
const osc = new OscOut();
await osc.enable();
const show = await createShow({ world, onFrame: () => osc.flush() });
show.app.osc = osc;          // the Layers panel shows the OSC rate
show.stage.io.osc = osc;     // worlds can send from update(dt, state, io)
```

## MIDI output and panic

`midi.noteOn/noteOff/cc/send` go to the selected output port — and `midi.panic()` sends all-notes-off +
all-sound-off + sustain-off + per-note note-offs on all 16 channels, through the
same observable throat as everything else. Bind it to a pad you can find in the
dark. Every performer eventually needs it; ours is one call.

```js
show.midi.outputs.map((o) => o.name);   // available output ports
show.midi.selectOutput('IAC Driver Bus 1');
show.midi.noteOn(60, 100, 1);           // note, velocity 0..127, channel 1..16
show.midi.noteOff(60, 1);
show.midi.cc(74, 64, 1);                // controller, value 0..127, channel
show.midi.send([0xb0, 74, 64]);         // raw bytes
show.midi.panic();
```

The first output port is used until you choose another (`enable(preferredOut)`
matches a name exactly, then as a substring). Everything sent passes through
`onSend`, which feeds the per-channel MIDI OUT meter in the Layers panel.

## Sound

`modules: { sound: true }` adds `Sound` (`@openav/sound`) with the Tone.js
engine. Browsers only start audio after a click, so the console shows
**🔊 enable sound** in the *L4 · Output — sound* panel. Once enabled, every
`midi/note/on` and `midi/note/off` plays the synth, whatever sent it (a keyboard,
the QWERTY piano, the simulated performer, a phone).

The engine's params join the show's params under `sound/`: with the Tone engine,
`sound/cutoff` (100–8000 Hz, default 2500), `sound/space` (reverb wet, 0–1,
default 0.3) and `sound/volume` (−36–0 dB, default −8). They appear in the
console, can be automated by the timeline and mapped like any param, so a knob,
a hand or the score plays the filter the way it plays the visuals. Tone.js
(15.0.4) is loaded from jsDelivr only when sound is enabled.

An engine is a small object, so you can bring your own:

```js
const sineEngine = () => {
  let ctx = null, out = null;
  const voices = new Map();
  return {
    params: [{ key: 'gain', label: 'Gain', min: 0, max: 1, def: 0.3 }],   // → sound/gain
    async enable() {
      ctx = new AudioContext();
      out = ctx.createGain(); out.gain.value = 0.3; out.connect(ctx.destination);
    },
    noteOn(note, vel) {
      voices.get(note)?.stop();
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = 440 * 2 ** ((note - 69) / 12);
      g.gain.value = vel * 0.3;
      o.connect(g).connect(out); o.start();
      voices.set(note, o);
    },
    noteOff(note) { voices.get(note)?.stop(); voices.delete(note); },
    set(key, value) { if (key === 'gain' && out) out.gain.value = value; },
    dispose() { ctx?.close(); },
  };
};

await createShow({ world, modules: { sound: { engine: sineEngine() } } });
```

The drum kit from `@openav/drums` is also an engine: `drumEngine({ samples })`
maps General MIDI drum notes to synthesized drums (or to your samples,
`{ 36: 'kick.wav', … }`) and has one param, `kitVolume` (−30–0 dB).

## Without createShow

`createShow()` is a convenience. When you need your own layout or loop, assemble
the parts by hand; this is roughly what it does:

```js
import { Signals, Params, Loop } from '@openav/core';
import { Midi } from '@openav/midi';
import { Mapper } from '@openav/mapping';
import { Timeline } from '@openav/timeline';
import { Stage } from '@openav/stage';
import { mountConsole } from '@openav/console';
import { MonitorFeed, snapshotOf } from '@openav/monitor';

const signals = new Signals();
const params = new Params();
const stage = new Stage({ container: document.querySelector('#stage'), params, signals });
stage.register(myWorld);
await stage.activate(myWorld.name);

const timeline = new Timeline({ params, total: 120, automation, scenes });
const mapper = new Mapper({ signals, params, profile: myWorld.name });
if (!mapper.load()) routes.forEach((r) => mapper.addRoute(r));

const midi = new Midi({ signals });
midi.enable();

// mount the console after every world (and sound engine) is registered: it builds one row per param
const app = { timeline, params, mapper, signals, midi, stage };
const desk = mountConsole(document.querySelector('#desk'), app);
const monitor = new MonitorFeed();
monitor.connect();

const loop = app.loop = new Loop((dt) => {
  timeline.advance(dt);
  mapper.update(dt);
  const state = stage.frame(dt, timeline.state());
  desk.render(state);
  monitor.frame(snapshotOf({ timeline, params, signals, stage, loop }, state));
});
loop.start();
```

## Pre-show checklist

- [ ] Chrome, plugged in, screen-sleep off, notifications off (`chrome://settings`)
- [ ] WebMIDI permission granted for this origin (it's per-origin, per-port)
- [ ] mapping profile saved (mapper.save()) AND exported to a JSON file
- [ ] monitor server running; stage manager's device on the same network
- [ ] sound enabled with a click, and the panic pad mapped
- [ ] rehearse the failure: kill the tab, restart, be performing again in <30 s
