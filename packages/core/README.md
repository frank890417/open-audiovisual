# @openav/core

Glue · the shared language every other package speaks: `Signals` (what is
happening, published by inputs), `Params` (what a world listens to), `Loop`
(the frame clock) and `Bus` (plain events). `createShow()` builds these for you
as `show.signals`, `show.params` and `show.loop`.

```js
import { Signals, Params, Loop } from '@openav/core';
const signals = new Signals();
const params = new Params([{ key: 'bloom', min: 0, max: 1, def: 0.5 }]);
signals.define('breath/pressure', { min: 0, max: 1 });
signals.on('breath/pressure', (v) => console.log(v));
signals.set('breath/pressure', 0.4);      // logs 0.4
params.override('bloom', 0.8);            // what a slider or a mapped route does
new Loop((dt) => { const state = params.resolve(); /* state.bloom === 0.8 */ }).start();
```

## Exports

| export | signature |
|---|---|
| `Signals` | `new Signals()` · `define(name, { kind = 'continuous', min = 0, max = 1, unit, description, source })` · `set(name, value)` (auto-defines unknown names) · `pulse(name, payload = 1)` · `get(name)` · `norm(name)` → 0..1 · `on(name, cb(value, name))` → unsubscribe · `onAny(cb(name, value, meta))` → unsubscribe · `list()` → `[{ name, value, at, kind, min, max, … }]` |
| `Params` | `new Params(schema = [])`, entries `{ key, min, max, def, step, pulse, label, group }` · `add(entries)` · `get(key)` · `clamp(key, v)` · `override(key, v)` · `clearOverride(key)` · `clearAllOverrides()` · `isOverridden(key)` · `firePulse(key)` · `onPulse(key, cb)` → unsubscribe · `resolve(base = {})` → state (override, else base, else `def`) · `schema`, `overrides` |
| `Loop` | `new Loop(onFrame(dt, now), { maxDt = 0.1, clock, raf, manual = false, heartbeat })` · `start()` · `stop()` · `step(dt)` → `boolean` · `fps`, `running`, `manual`; keeps ticking from a Worker when the tab is hidden |
| `Bus` | `new Bus()` · `on(event, cb)` → unsubscribe · `off(event, cb)` · `emit(event, payload)` |

### Who supplies the frames

`Loop` runs on the page's `requestAnimationFrame` and `performance.now` unless you hand it others. That is how a show is
recorded frame by frame, a whole show is unit-tested, or a night runs headless, without replacing the page's globals:

```js
// your own clock and frame pump (a test, a recorder): ms from clock(), one callback per raf(cb)
const q = []; let now = 0;
const loop = new Loop((dt) => { /* … */ }, { clock: () => now, raf: (cb) => q.push(cb) });
loop.start();
now += 1000 / 60; q.splice(0).forEach((cb) => cb(now));   // one frame, dt = 1/60

// manual: nothing is scheduled, each step is one frame (works without start())
const m = new Loop((dt, now) => { /* … */ }, { manual: true });
m.step(1 / 60);       // → true. dt is not clamped; 0 redraws in place; a negative or non-number dt runs nothing → false
```

- `clock` is `() => milliseconds` (default `performance.now`); `raf` is `(cb) => handle` (default `requestAnimationFrame`) and
  may call `cb(timestamp)` or `cb()` (then `clock()` is read). `maxDt` still clamps automatic frames.
- With an injected `raf`, or `manual`, the hidden-tab Worker heartbeat is off (a real timer must not step a fake clock);
  `heartbeat: true` turns it back on.
- In a manual loop the `now` that `onFrame` and `fps` see is virtual: the sum of the `dt` stepped, from 0. Two runs with the
  same steps are the same run.
- No `requestAnimationFrame` and not manual: `start()` throws and says what to pass.
- `createShow({ loop: 'manual' })` does this for a whole show: [Show control](https://openaudiovisual.com/docs/#show-control-driving-the-frames-yourself).

Signal naming and every built-in signal: [Signals reference](https://openaudiovisual.com/docs/#signals).

Full reference: [docs](https://openaudiovisual.com/docs/#packages-openav-core)
