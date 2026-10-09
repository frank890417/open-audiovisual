# Mapping

The mapping layer is where "what happened" becomes "what it means". The `Mapper`
(`@openav/mapping`) is the only component that connects signals to params, and
everything it knows is a list of routes.

## Routes

A route is a plain object. Only `source` and `target` are required; `addRoute()`
fills in the rest:

| field | default | meaning |
|---|---|---|
| `source` | — | signal name, e.g. `midi/cc/74`, `hand/right/pinch/index`, `phone/any/tilt/x` |
| `target` | — | param key, e.g. `bloom`, `sound/cutoff` |
| `inMin`, `inMax` | `0`, `1` | the window of the signal that is used; values outside it are clamped |
| `outMin`, `outMax` | the param's `min`, `max` | the range written into the param |
| `curve` | `'linear'` | `linear`, `exp`, `log` or `smooth` |
| `invert` | `false` | flip the normalized value (1 − x) before the curve |
| `smooth` | `0` | glide time in seconds (0 = instant) |
| `enabled` | (absent = on) | `false` mutes the route |
| `id` | assigned | a number, used to remove the route |

```js
show.mapper.addRoute({ source: 'midi/cc/74', target: 'bloom' });
show.mapper.addRoute({ source: 'phone/any/tilt/x', target: 'drift', inMin: -1, inMax: 1, smooth: 0.12 });
show.mapper.addRoute({ source: 'hand/right/pinch/index', target: 'tightness', curve: 'smooth', invert: true, smooth: 0.1 });
```

In `createShow()`, the same objects go in `routes: [...]`.

## What happens to a value

When a signal arrives, every enabled route whose `source` matches runs these
steps, in order:

1. **Window**: `x = (value − inMin) / (inMax − inMin)`, clamped to 0..1.
2. **Invert**: if `invert`, `x = 1 − x`.
3. **Curve**: `x = curve(x)`.
4. **Scale**: `out = outMin + (outMax − outMin) · x`.
5. **Write**: with `smooth: 0`, the param is overridden with `out` (and clamped
   and snapped to its `step`). With `smooth > 0`, `out` becomes a target that
   `mapper.update(dt)` glides toward every frame.

## Curves

| curve | formula | feel |
|---|---|---|
| `linear` | x | as the hand moves |
| `exp` | x² | slow start, fast end: fine control near the bottom |
| `log` | √x | fast start, slow end: fine control near the top |
| `smooth` | x²(3 − 2x) | gentle at both ends (smoothstep) |

An unknown curve name falls back to linear.

## Windows and ranges

`inMin`/`inMax` say which part of the signal matters; `outMin`/`outMax` say
where it lands. Typical uses:

- a bipolar signal: `{ source: 'midi/bend', inMin: -1, inMax: 1 }`, or a phone
  tilt `{ source: 'phone/any/tilt/x', inMin: -1, inMax: 1 }`;
- a quiet signal: `{ source: 'audio/rms', inMax: 0.3 }` uses the whole param
  range for the levels a voice actually reaches;
- a knob that only sweeps part of a param: `{ source: 'midi/cc/1', target: 'hue', outMin: 180, outMax: 270 }`;
- an inverted relation without `invert`: `outMin: 1, outMax: 0`.

> [!WARNING]
> `outMin`/`outMax` default to the target param's range *at the moment the route
> is added*. If the param does not exist yet, they default to 0..1. In
> `createShow()`, routes are added before the sound engine registers its
> `sound/*` params, so a declared route to `sound/cutoff` needs explicit
> `outMin: 100, outMax: 8000`.

## Smoothing

`smooth` is a time constant in seconds: after `smooth` seconds the param has
covered about 63% of the distance to the new value (a one-pole filter,
`k = 1 − e^(−dt/smooth)` per frame). 0.05–0.15 hides the steps of a MIDI knob or
a 30 Hz phone stream; 0.2–0.5 makes a hand feel heavy. The glide starts from the
param's current value, so the first movement never jumps.

## Pulse targets

When the target is a `pulse` param, the route fires it instead of writing a
value:

- a **pulse** source (`midi/note/on`, `audio/kick`, `drum/kick`,
  `phone/any/knock`…) fires it on every event;
- a **continuous** source fires it when the normalized value crosses 0.5 upward
  (a phone-surface button going from 0 to 1, a fader pushed past the middle).

`curve`, `invert`, `smooth` and the output range do not apply to pulse targets.

## Many-to-many

One signal may drive many params (add several routes with the same `source`),
and one param may listen to many signals. When two routes write the same param,
the last one to write wins. *Learn* adds a route; it never replaces one.

The [patch bay design](design/patchbay.md) plans per-route `combine`
(`last`, `max`, `add`, `avg`) and `label` fields; they are not implemented yet.

## Overrides and the timeline

A route writes its param as an **override**, and overrides are sticky: as soon
as a mapped signal moves, the timeline stops driving that param. Clearing the
override (✕ next to the param, or `show.params.clearOverride(key)`) hands it back
to the timeline until the signal moves again.

A *smoothed* route keeps writing its last target every frame once its signal has
arrived, so its param stays overridden even after ✕ and even when the route is
muted. Remove the route (✕ in **L2 · Mapping**) to give the param back to the
timeline for good.

## Learn

Click *learn* next to a param in **L3 · Params** (or call
`mapper.learn('bloom')`), then move something. The mapper binds the first signal
that:

- **moves** by at least 5% of its declared range from where it was when learn
  started (a knob, a fader, a hand, a phone tilt), or
- **fires**, if it is a pulse (a key, a pad, a knock).

The new route has the defaults: linear, no smoothing, the param's full range.
Edit it afterwards if it needs a curve. Clicking *learn* again cancels. Learn
*adds*: a param that already has a route keeps it and gets a second one.

To bind a whole list, the **L2 · Mapping** panel has **🎛 map knobs in order**: it
arms learn for the first param, you turn one knob, it is bound and the next param is
armed. *skip*, *back*, *stop* (or Esc) steer it. In code it is `LearnWizard`
([details](score.md#map-the-knobs-in-order)).

> [!CAUTION]
> Any pulse binds immediately. Untick *simulate performance* and stop the drum
> machine before you learn, or the next note they play becomes the route.

When one MIDI message publishes several names (`midi/cc/74`,
`midi/ch/1/cc/74`, and with two devices `midi/<slug>/cc/74`), learn binds the
first one, `midi/cc/74`, which hears every device. Change the `source` to the
per-device name if you need one device only.

## Muting and removing

The **L2 · Mapping** panel lists every route as `source → target` with a
checkbox (mute) and ✕ (remove). In code:

```js
const r = show.mapper.routesFor('bloom')[0];
r.enabled = false;                  // mute
show.mapper.removeRoute(r.id);      // remove
```

## Saved profiles

The mapper saves its routes to `localStorage` under `openav.map.<profile>`.
`createShow()` uses the world's name as the profile (or the `profile` option) and:

1. loads the saved routes if there are any, otherwise adds the declared `routes`;
2. when a saved profile exists, still adds every declared route whose
   `source → target` pair is missing, so new routes in code arrive;
3. saves every 3 seconds.

So learned routes and edits survive a reload. The flip side: if you change the
curve or smoothing of a declared route in code, the saved copy of that
`source → target` pair wins. To start clean, pass `profile: false` (routes come
from code on every load, as in example 09) or remove the saved profile:

```js
localStorage.removeItem('openav.map.particles');   // 'particles' = the world's name
```

To carry a wiring to another machine, export and import the JSON (there is no
file UI yet; it is on the [roadmap](roadmap.md)):

```js
copy(JSON.stringify(show.mapper.toJSON(), null, 2));   // devtools: copies the routes
show.mapper.fromJSON(routes); show.mapper.save();      // on the other machine (replaces all routes)
```

## Routes written for you

Several packages generate routes in this same shape:

- `autoSurface(world.params)` (`@openav/surface`) builds a phone control panel and
  the `surface/<page>/<widget> → param` routes for it, with `smooth: 0.04`;
  `routesFromLayout(layout, params)` does the same for a hand-written layout
  ([Phones, relay & surfaces](remote.md#autosurface)).
- `controllerRoutes(profile, { knob1: 'hue', pad1: 'burst' })` (`@openav/midi`)
  writes routes from an on-screen controller's controls
  ([MIDI controllers & embedding](controllers.md)).

## Mapper API

```js
import { Mapper } from '@openav/mapping';

const mapper = new Mapper({ signals, params, profile: 'default', onChange, onLearn });
mapper.addRoute(route)        // → the stored route (defaults filled in, id assigned)
mapper.removeRoute(id)
mapper.routesFor('bloom')     // → routes targeting a param
mapper.routes                 // the live array
mapper.learn('bloom')         // arm / cancel learn; mapper.learnTarget is the armed key
mapper.update(dt)             // every frame: advances smoothed routes
mapper.toJSON(); mapper.fromJSON(array)
mapper.save(); mapper.load()  // localStorage 'openav.map.<profile>'; load() → true if found
mapper.dispose()              // stop listening to signals
```

`onChange()` runs when routes change (for UIs); `onLearn(route, signalName)` runs
when learn binds.
