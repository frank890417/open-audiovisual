# @openav/stage

L3 world · the world shell. `Stage` registers worlds, absorbs their param
schemas, runs one world's lifecycle and resolves params every frame. It owns no
renderer: a world draws with whatever it likes (2D canvas, p5, three, DOM).

```js
// in a show: createShow() builds the Stage from world + worlds
const show = await createShow({ world: calm, worlds: [storm] });
await show.stage.activate('storm');         // disposes calm, initializes storm
```

```js
import { Stage, createCanvas } from '@openav/stage';
const stage = new Stage({ container: document.querySelector('#stage'), params, signals });
stage.register(world);
await stage.activate(world.name);
// every frame:
const state = stage.frame(dt, timeline.state());
```

A world: `{ name, params: [{ key, min, max, def, step?, pulse?, label?, group? }],
init({ container, signals, params }), update(dt, state, io), render(), dispose() }`;
every method is optional.

## Exports

| export | signature |
|---|---|
| `Stage` | `new Stage({ container, params, signals, io = {} })` · `register(world)` · `activate(name)` (async; disposes the previous world, awaits `init`) · `frame(dt, baseState)` → resolved state (`null` with no active world) · `active`, `activeName`, `worlds` (a Map), `io` (`{ signals, ...io }`, passed to `update`) |
| `createCanvas` | `createCanvas(container, { alpha = false })` → `{ canvas, ctx, fit() → { w, h }, dispose() }`; follows the container size, device pixel ratio capped at 2 |

Full reference: [docs](https://openaudiovisual.com/docs/#packages-openav-stage)
