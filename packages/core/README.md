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
| `Loop` | `new Loop(onFrame(dt, now), { maxDt = 0.1 })` · `start()` · `stop()` · `fps`, `running`; keeps ticking from a Worker when the tab is hidden |
| `Bus` | `new Bus()` · `on(event, cb)` → unsubscribe · `off(event, cb)` · `emit(event, payload)` |

Signal naming and every built-in signal: [Signals reference](https://openaudiovisual.com/docs/#signals).

Full reference: [docs](https://openaudiovisual.com/docs/#packages-openav-core)
