# Architecture

open-audiovisual is a *data-layer* framework. Its entire value is that four layers
and two spines stay cleanly separated, so any of them can be replaced without
touching the others. This page states each layer's contract precisely.

## The frame loop

One `Loop` drives everything, in this order:

```js
const loop = new Loop((dt) => {
  timeline.advance(dt);                          // 1. time moves
  mapper.update(dt);                             // 2. smoothed routes settle
  const state = stage.frame(dt, timeline.state());// 3. params resolve → world updates & renders
  consoleUI.render(state);                       // 4. desk reflects reality
  monitor.frame(snapshotOf({...}, state));       // 5. backstage hears about it
  osc?.flush();                                  // 6. batched output leaves
});
```

Param resolution order (the heart of the design):

```
timeline.state(t)          — the "score": automation curves per param
  ⬑ overridden by →  params.overrides   — set by hand sliders, mapped signals
```

An override is *sticky*: once a knob touched `bloom`, the timeline no longer moves
it until the override is cleared (✕ in the console). This matches performance
reality — when a human grabs a control, the score yields.

## L1 · Input — Signals

**Contract**: input packages publish *named, normalized signals* into a
`Signals` registry, and do nothing else. They never touch params or worlds.

- names are path-like: `midi/cc/74`, `chord/consonance`, `pose/hand/right/y`
- continuous signals declare `{min, max}` and always hold a current value
- pulse signals (`kind: 'pulse'`) fire events; their payload is the event object
- anyone can subscribe: `signals.on(name, cb)` or `signals.onAny(cb)`

Adding a new input modality (breath sensor, gamepad, stock ticker, weather API)
means writing one class that calls `signals.set()` / `signals.pulse()`.
Nothing downstream changes. That is the whole point.

## L2 · Mapping — Mapper

**Contract**: the only component that connects signals to params. Routes are data:

```js
{ source: 'pose/hand/right/y', target: 'energy',
  inMin: 0, inMax: 1, curve: 'smooth', invert: false,
  smooth: 0.15, outMin: 0, outMax: 1 }
```

- **many-to-many**: one signal may drive several params; one param may listen to
  several signals (last writer wins). Learn *adds*, it never replaces.
- **learn** is generalized MIDI-learn: `mapper.learn('bloom')` binds the next
  signal that *moves* ≥5% of its range — a knob and a waving hand both qualify.
- routes serialize to JSON → mapping profiles are shareable files.

## L3 · World — Stage

**Contract**: a World is `{ name, params, init, update(dt, state, io), render, dispose }`.
It reads `state` (resolved param values). It may *subscribe to signals for
discrete events* (a note-on spawning a particle is an event, not a parameter),
but continuous control must flow through params — otherwise your world stops
being performable by the timeline or by other inputs.

The Stage owns lifecycle and param aggregation and deliberately does **not** own
a renderer. p5, three.js, 2D canvas, SVG, DOM — the framework has no opinion.

Constitutional rule (inherited from The Last Input): **the shell never knows the
work.** Switching works = swapping World + automation data. The shell stays.

## L4 · Output — two branches, video and audio, both optional

The output layer splits in two. Both branches hang off the same
signals → mapping → params spine — sound is performable state, not a side effect.

**Video branch**
- **screen** is the default output; performance mode (T) gives the performer a
  teleprompter while the audience sees the stage window fullscreen (F).
- future: NDI gateway (see roadmap; groundwork lives in sister project WebToe).

**Audio branch**
- **MIDI out** (external synths/DAWs): `midi.send()/noteOn()/cc()` — one throat,
  observable (`onSend`) so meters can watch everything, with a real `panic()`.
- **In-browser synthesis**: `@openav/sound` — a small pluggable engine contract
  (`noteOn/noteOff/set/params`) with a Tone.js engine first (CDN, loaded only on
  enable). Engine params register as `sound/*` — a knob, a hand, or the timeline
  plays the filter cutoff exactly the way it plays the visuals. More engines
  (samplers, granular, custom WebAudio graphs) grow behind the same contract.
- **OSC**: browser → HTTP → `osc-bridge.js` → UDP (Spat, Reaper, TD, lights).
  Batched per frame; only the latest message per address survives a frame.

## Spine · Timeline

Pure logic, no DOM: params + automation keyframes + scenes → `state(t)`.
Scenes may start at negative t (pre-show standby). `onSceneChange` is the cue
hook — fire sound, lights, prompts from it.

## Spine · Monitor

The performance page streams JSON snapshots (throttled, ~15 Hz) over WebSocket
to a dependency-free relay (`server.js`, hand-rolled RFC 6455). Any phone or
laptop on the LAN opens the backstage page and sees: clock, scene, world, FPS,
overrides, every signal and param, and a "stage feed lost" alarm. The monitor
is a first-class citizen because a show without a backstage is a rehearsal.
