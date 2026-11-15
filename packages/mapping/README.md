# @openav/mapping

L2 mapping · the `Mapper` routes any signal to any param, with an input window, a
curve, invert, smoothing, learn (the next signal that moves becomes the source)
and profiles saved in localStorage. Many-to-many: one knob can drive three
params, one param can listen to a knob and a hand.

```js
// in a show: declare routes; show.mapper is the Mapper
const show = await createShow({ world, routes: [
  { source: 'midi/cc/74', target: 'bloom', curve: 'exp', smooth: 0.1 },
  { source: 'audio/rms', target: 'energy', inMax: 0.3 },
] });
```

```js
import { Mapper } from '@openav/mapping';
const mapper = new Mapper({ signals, params });
mapper.addRoute({ source: 'midi/cc/74', target: 'bloom', curve: 'exp', smooth: 0.1 });
// every frame (advances smoothed routes):
mapper.update(dt);
```

A knob that nudges the timeline instead of replacing it, and hands the param back when you let go:

```js
mapper.base = () => timeline.state();        // the timeline's value now (createShow wires this for you)
mapper.addRoute({ source: 'midi/cc/74', target: 'hue', mode: 'trim', outMin: -30, outMax: 30, smooth: 0.1 });   // timeline + offset, ±30°
mapper.addRoute({ source: 'midi/cc/71', target: 'bloom', mode: 'pickup', release: 4, smooth: 0.15 });                // meets the value first; gives it back after 4 s
```

## Exports

`Mapper`
- `new Mapper({ signals, params, profile = 'default', onChange, onLearn(route, signalName), base })` · `base() → { key: value }` is the timeline's value now (`mapper.base = fn` works too): `trim`, `pickup` and the start of a smooth glide use it, without it the param's `def` stands in
- `addRoute(route)` → the filled-in route · `removeRoute(id)` · `routesFor(target)`
- `learn(target)` toggles learn: the next signal that moves at least 5 % of its range (or any pulse) is bound
- `update(dt)` per frame (glides smoothed routes, keeps trims on the timeline, applies `release`) · `toJSON()` · `fromJSON(routes)` · `save()` · `load()` → boolean
- `exportMap()` / `importMap(text|object, { mode })` — the portable `openav.map` file; skipped routes come back in the report · `clear()` · `report`

Also exported: `loadMapUrl(mapper, url)` (what `?map=` calls), `parseMap`, `serializeMap`, `parseMapUrl`, `MAP_FORMAT`, `MAP_VERSION`.
  (localStorage key `openav.map.<profile>`) · `dispose()`
- `routes`, `learnTarget`

`LearnWizard` ("map the knobs in order")
- `new LearnWizard({ mapper, keys, onChange })` · `keys`: param keys in order, or a function returning them (read at `start()`)
- `start()` arms the first param; turning a knob binds it (learn *adds* routes) and arms the next · `skip()` · `back()` · `stop()` ·
  `sync()` per frame (keeps learn armed while it runs)
- `active`, `current`, `index`, `total`, `done`, `added` (`[{ key, source }]`)

Route: `source`, `target` (required) · `inMin = 0`, `inMax = 1` · `outMin`, `outMax` (the
param's range when the route is added, else 0..1) · `curve = 'linear'` (`exp`, `log`,
`smooth`) · `invert = false` · `smooth = 0` (seconds) · `mode = 'override'` (`'trim'`, `'pickup'`) ·
`release = 0` (seconds) · `enabled` (`false` mutes) · `id` (assigned). A pulse param fires on a pulse signal,
or when a continuous source rises past 0.5; `mode` and `release` do not apply to it.

- `mode: 'override'` replaces the timeline's value, until ✕ (as ever).
- `mode: 'trim'` adds the knob to the timeline's value: `outMin`/`outMax` are an *offset* range (default: half the param's range each way, the knob in the middle = no change). Two trims on a param add up.
- `mode: 'pickup'` takes over only once the knob has met the param's current value (within 2 % of the route's output range, or crossed over it).
- `release: 4` lets go when the signal has not moved for 4 seconds: the param goes back to the timeline at once (`smooth: 0`) or fades into it over about 3 × `smooth` (a trim fades its offset to 0).
- A smoothed route writes only while it glides; ✕ or a slider takes the param back and it stays back until the knob moves again.
- The portable `openav.map` file carries `mode` and `release` as optional route keys, written only when used.

Full reference: [docs](https://openaudiovisual.com/docs/#packages-openav-mapping) · [Mapping](https://openaudiovisual.com/docs/#mapping)
