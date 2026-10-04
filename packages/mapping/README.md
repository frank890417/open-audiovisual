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

## Exports

`Mapper`
- `new Mapper({ signals, params, profile = 'default', onChange, onLearn(route, signalName) })`
- `addRoute(route)` → the filled-in route · `removeRoute(id)` · `routesFor(target)`
- `learn(target)` toggles learn: the next signal that moves at least 5 % of its range (or any pulse) is bound
- `update(dt)` per frame · `toJSON()` · `fromJSON(routes)` · `save()` · `load()` → boolean
  (localStorage key `openav.map.<profile>`) · `dispose()`
- `routes`, `learnTarget`

Route: `source`, `target` (required) · `inMin = 0`, `inMax = 1` · `outMin`, `outMax` (the
param's range when the route is added, else 0..1) · `curve = 'linear'` (`exp`, `log`,
`smooth`) · `invert = false` · `smooth = 0` (seconds) · `enabled` (`false` mutes) · `id`
(assigned). A pulse param fires on a pulse signal, or when a continuous source rises past 0.5.

Full reference: [docs](https://openaudiovisual.com/docs/#packages-openav-mapping) · [Mapping](https://openaudiovisual.com/docs/#mapping)
