# Writing a world

A world is the only part of the framework you *have* to write. Everything else
is assembly.

## The interface

```js
export const myWorld = {
  name: 'my-world',

  // params: what the world can be performed WITH.
  // These appear in the console, are automatable by the timeline,
  // and are mappable to any signal.
  params: [
    { key: 'energy', label: 'Energy', min: 0, max: 1, def: 0.3 },
    { key: 'mode',   label: 'Mode',   min: 0, max: 3, def: 0, step: 1 },  // step → snaps, holds on the timeline
    { key: 'reset',  label: 'Reset',  pulse: true },                       // momentary trigger
  ],

  init(ctx) {
    // ctx = { container, signals, params }
    // build your renderer here: p5, three, or the built-in 2D helper:
    this.view = createCanvas(ctx.container);
    // discrete events may come straight from signals:
    this._unsub = ctx.signals.on('chord/event', (a) => this.onChord(a));
    this._unpulse = ctx.params.onPulse('reset', () => this.reset());
  },

  update(dt, state, io) {
    // state = resolved param values. This is your ONLY continuous input.
    // io = { signals } plus any output handles the assembly added (see "Sound output")
  },

  render() { /* draw */ },

  dispose() { this._unsub?.(); this._unpulse?.(); this.view.dispose(); },
};
```

## The contract

| member | when it runs | what it gets |
|---|---|---|
| `name` | — | a unique string; the stage registers worlds by name |
| `params` | read once, when the world is registered | an array of param declarations (below) |
| `init(ctx)` | when the world becomes active | `{ container, signals, params }`. May be `async`; `createShow()` waits for it before the loop starts |
| `update(dt, state, io)` | every frame | `dt` in seconds (≤ 0.1), `state` = `{ key: value }` for every param, `io` = `{ signals, … }` |
| `render()` | every frame, right after `update` | nothing; draw from what `update` stored |
| `dispose()` | when another world is activated | release GPU objects, DOM, subscriptions |
| `surface` | optional | a phone control-surface layout; `modules.remote` uses it instead of generating one ([Phones](remote.md#the-show-side)) |

`container` is an absolutely positioned layer that fills the stage. The stage
empties it before every `init`, so you never clean up DOM someone else left.
An exception thrown in `update` or `render` is caught and logged
(`[stage] update:` / `[stage] render:`); the show keeps running.

## Params

| field | meaning |
|---|---|
| `key` | the name routes, automation and the console use. Required. |
| `label` | what the console shows. Defaults to `key`. |
| `min`, `max` | the range. Overrides are clamped into it; routes scale into it. |
| `def` | the value when there is no automation and no override. The core reads only `def`; `autoSurface()` alone also understands `default`. |
| `step` | snap overrides to multiples of `step`; on the timeline a stepped param *holds* each keyframe instead of interpolating. |
| `pulse` | `true` makes it a trigger instead of a level: the console shows a *fire* button, a mapped pulse signal (or a continuous signal crossing 0.5 upward) fires it, and the world listens with `params.onPulse(key, cb)`. A pulse param has no value in `state`. |
| `group` | a label for grouping. Engine params use `'sound'`; `autoSurface()` makes one phone page per group. |
| `options` | names for the values of a stepped param (`['Circle', 'Petal', 'Star']`); the phone surface shows them as a radio. |
| `surface` | a hint for the phone surface: `{ type, color, label }`. |

If two registered worlds declare the same key, they share one param (the first
declaration wins).

## The one rule people break

**Continuous control goes through params. Events may use signals.**

If your world reads `signals.get('midi/cc/74')` directly in `update()`, it still
works — today, with your controller. But it can no longer be driven by the
timeline, by a dancer, or by someone else's controller profile. You've welded
the performance to one input. Route it: declare a param, let the mapper connect
`midi/cc/74 → yourParam`, and the same world works for everyone.

Events are different: "a note was struck", "a chord resolved", "an onset hit" are
moments, not levels. Subscribing to those in `init()` is correct and encouraged —
that's what makes worlds *reactive* rather than just modulated.

Useful event signals: `midi/note/on` and `midi/note/off` (any keyboard, the
on-screen piano, the simulated performer, a phone), `chord/event` (one analysis
per played gesture), `audio/onset`, `audio/kick`, `drum/kick`. The full list is
in the [Signals reference](signals.md).

## Scenes and automation

The timeline is configured next to the world, in the `createShow()` call:

```js
await createShow({
  world: gardenWorld,
  timeline: {
    total: 120,                                       // seconds
    automation: {
      growth: [[0, 0.6], [40, 1.4], [90, 0.8], [120, 0.2]],   // [t, value], linear between keyframes
      wind:   [[0, 0.05], [60, 0.3], [100, 0.7]],
    },
    scenes: [
      { id: 'dawn',  t: 0,  title: 'Dawn',       note: 'single seeds · listen' },
      { id: 'bloom', t: 40, title: 'Full bloom', note: 'triads — stack real thirds' },
      { id: 'storm', t: 90, title: 'Storm',      note: 'clusters welcome' },
    ],
  },
  modules: { keys: { base: 48 }, chord: true, sound: true },
});
```

- Keyframes are `[seconds, value]`, sorted by time. Before the first keyframe
  the value is the first value; after the last, the last value.
- Scenes are sorted by `t`. `title` and `note` are what the performer reads in
  performance mode (<kbd>T</kbd>); the next scene and a countdown show under them.
- A scene with a negative `t` is a pre-show standby: with `t: -30` the clock starts at `-0:30`.
- Try performing your world with **only** the timeline. If it is boring, a
  param is missing.

More in [Show control](show-control.md#timeline).

## Renderers

The stage does not own a renderer. Build one in `init`, destroy it in `dispose`.

### 2D canvas

`createCanvas(container, { alpha = false })` from `@openav/stage` returns
`{ canvas, ctx, fit, dispose }`. `fit()` keeps the canvas the size of its
container (device pixel ratio capped at 2) and returns `{ w, h }` in CSS pixels;
call it at the top of `render()`. Examples 01, 02, 03, 07, 08 and 09 use it.

### p5.js

Load p5 with a script tag in the example's `index.html`, then run it in
instance mode inside the container. p5 draws on its own loop, so `update` only
stores the state and `render` stays empty (examples 05 and 06):

```html
<script src="https://cdn.jsdelivr.net/npm/p5@1.9.4/lib/p5.min.js"></script>
```

```js
const world = {
  name: 'p5-world',
  params: [{ key: 'hue', min: 0, max: 360, def: 200 }],
  init({ container }) {
    const self = this;
    this.s = {};
    this.p5 = new p5((sk) => {
      sk.setup = () => { sk.createCanvas(container.clientWidth, container.clientHeight); sk.colorMode(sk.HSB); };
      sk.draw = () => { sk.background(self.s.hue ?? 200, 60, 20); };
      sk.windowResized = () => sk.resizeCanvas(container.clientWidth, container.clientHeight);
    }, container);
  },
  update(dt, state) { this.s = state; },
  render() { /* p5 runs its own loop */ },
  dispose() { this.p5?.remove(); },
};
```

### three.js

No bundled example uses three.js yet; this is the pattern. Add three to the
example's import map (`"three": "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js"`),
keep the renderer on `this`, and dispose everything:

```js
import * as THREE from 'three';

const orbit = {
  name: 'orbit',
  params: [{ key: 'spin', min: 0, max: 3, def: 1 }],
  init({ container }) {
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    container.appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    this.camera.position.z = 4;
    this.mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 2), new THREE.MeshNormalMaterial({ wireframe: true }));
    this.scene.add(this.mesh);
  },
  update(dt, s) { this.mesh.rotation.y += dt * s.spin; },
  render() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    if (w !== this.w || h !== this.h) {
      this.w = w; this.h = h;
      this.renderer.setSize(w, h); this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    }
    this.renderer.render(this.scene, this.camera);
  },
  dispose() {
    this.mesh.geometry.dispose(); this.mesh.material.dispose();
    this.renderer.dispose(); this.renderer.domElement.remove();
  },
};
```

### A WebToe patch

`webtoeWorld()` from `@openav/world-webtoe` turns a
[WebToe](https://github.com/frank890417/WebToe) node patch into a world. The
patch runs in an iframe; every frame in which a param changed, the resolved
params are posted into it, and any patch parameter written as
`ext('name', fallback)` listens (example 04):

```js
import { webtoeWorld } from '@openav/world-webtoe';

const world = webtoeWorld({
  name: 'garden-patch',
  project: new URL('./garden.webtoe.json', location.href).href,   // the app fetches it: CORS must allow it
  params: [
    { key: 'speed', min: 0, max: 1, def: 0.5 },
    { key: 'hue', min: 0, max: 360, def: 205 },
  ],
  // extra: (state, out) => { out.hueRad = state.hue * Math.PI / 180; },   // derive more ext() values
});
```

Options: `name` (default `'webtoe'`), `app` (default
`https://webtoe.openaudiovisual.com/`), `project`, `params`, `extra`.

### DOM, SVG, video

Anything you append to `container` is fine. The stage only calls your functions.

## Several worlds in one show

```js
const show = await createShow({ world: calm, worlds: [storm, after], timeline });
// switch on a cue: the old world is disposed, the new one initialized
show.timeline.onSceneChange((i, scene) => {
  if (scene.id === 'storm') show.stage.activate('storm');
});
```

All worlds' params are registered up front, so the console and the timeline can
address any of them. `stage.activate(name)` does nothing if that world is
already active.

## Sound output from a world

`update(dt, state, io)` receives `io`. With `createShow()`, `io` holds only
`signals`; add output handles once the show exists, and every world sees them:

```js
const show = await createShow({ world });
show.stage.io.midi = show.midi;          // the show's @openav/midi engine (MIDI out)
// show.stage.io.osc = osc;              // an OscOut you created (see Show control → OSC output)
```

Then, inside the world:

```js
// trigger a sampler note when something happens in the simulation
io.midi?.noteOn(48 + creature.species * 12, 90, 2);   // note, velocity 0..127, channel 2

// stream a position to a spatializer
io.osc?.send(`/source/${i}/xyz`, [x, y, z]);
```

Often it is simpler to do it at the assembly level instead, as example 05 does:
`show.signals.on('midi/note/on', ({ note, vel }) => show.midi?.noteOn(note, Math.round(vel * 127), 1))`.
For a synth inside the page, use `modules.sound` ([Show control](show-control.md#sound)).

## Checklist before a show

- [ ] every continuous control is a param (try performing your world with ONLY the timeline)
- [ ] `dispose()` releases GPU objects and event subscriptions (worlds get switched live)
- [ ] world survives `dt` spikes (the Loop clamps to 100ms, but don't assume 16ms)
- [ ] nothing in the world reads the clock directly — the timeline owns time
- [ ] the page loads with zero console errors, and works with only the on-screen piano
