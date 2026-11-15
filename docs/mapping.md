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
| `mode` | (absent = `'override'`) | `'override'` replaces the timeline's value, `'trim'` adds to it, `'pickup'` takes over only once the knob has met the value: [Trim, pickup and release](#trim-pickup-and-release) |
| `release` | (absent = never) | seconds the signal must stand still before the route lets go and the timeline plays again |
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
   `mapper.update(dt)` glides toward every frame. A `trim` route writes the timeline's
   value plus `out`; a `pickup` route writes nothing until the knob has met the param.

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
param's current value (a value set by hand, else what the timeline says right now, see
[`base`](#telling-the-mapper-where-the-timeline-is)), so the first movement never jumps,
and it stops writing once it has arrived.

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

A *smoothed* route writes only while it is gliding. Once it has arrived it stops, so ✕
(or a slider you drag) takes the param back and it stays back until the knob moves
again; ✕ in the middle of a glide stops the glide. The mapper notices when
something else has written the param since its own last write, and stands down.
Muting a route stops it writing; the param keeps the value it had (a muted `trim` gives
its offset back).

A replacing route throws the timeline's curve away for as long as it holds the param. For a
knob that should *nudge* the timeline, or *hand it back* when you let go, read on.

## Trim, pickup and release

Three route fields change who wins when a knob meets a timeline. All three are off unless
you write them: a route without `mode` and `release` is the replacing route described above.

| field | what the knob does |
|---|---|
| `mode: 'override'` | the default: the knob's value *replaces* the timeline's, until ✕ |
| `mode: 'trim'` | the knob's value is an *offset* added to the timeline's value, which keeps moving underneath |
| `mode: 'pickup'` | like `override`, but the knob only takes over once it has *met* the param's current value |
| `release: 4` | with any mode: when the knob has stood still for 4 seconds, let go and let the timeline play |

`mode` and `release` do not apply to pulse targets.

### Telling the mapper where the timeline is

`trim`, `pickup` and the start of a smooth glide all need the timeline's value for the param
*right now*. The mapper takes it from `base`, a function that answers `{ key: value }`:

```js
const mapper = new Mapper({ signals, params, base: () => timeline.state() });
// a show made with createShow() already does this for you
```

`timeline.state()` is the value *before* overrides, with a score's segment modules already applied,
which is what the param would be if nobody touched it. Without `base` the mapper uses the
param's `def`: right for a param nothing automates, wrong for one the timeline draws. A `base`
that throws or answers something else is treated as absent; it never stops the show. Keep it cheap:
it is asked every frame while a trim holds a param, and at each reading of a trim or pickup knob.

### Trim: nudge the timeline

For a work whose timeline already draws the whole show, turning a knob to 0.9 should not throw
the curve away. A `trim` route's `outMin`/`outMax` are an *offset* range, and the param is
`timeline value + offset`, clamped to the param's range. Without them the knob spans half the param's
range each way (knob in the middle = no change):

```js
// ±30° around whatever the timeline says, smoothed
show.mapper.addRoute({ source: 'midi/cc/74', target: 'hue', mode: 'trim', outMin: -30, outMax: 30, smooth: 0.1 });
```

- The offset rides on the timeline: when the curve moves, the param moves with it, every frame.
- `smooth` smooths the offset (it starts from 0, never from a jump).
- Two trim routes on one param add up, so a coarse and a fine knob work together. A `trim` on a param
  that also has a replacing route sits on top of the replacing route's value.
- While a trim holds a param, the param is overridden: the console shows it with a ✕, and a
  `timeline.record` source that reads the override gets the sum, what the audience saw. ✕ clears the offset;
  the knob's next move brings it back. Removing or muting the route gives the param back at once.

### Pickup: take over only when you arrive

A knob and a parameter rarely start in the same place. With `mode: 'pickup'` the route writes
nothing until the knob's value has *met* the param's current value: within 2% of the route's
output range, or crossed over it between two readings. From then on it behaves like a replacing
route, gliding from where the param was (no jump). The comparison uses the value the param
has right now, so it works while the timeline moves. A `release` or ✕ puts the route back to
"not met yet".

### Release: give it back

`release: 4` means: when the signal has not moved for 4 seconds, the route lets go. Movement is a change of
more than 0.1% of the input window, measured from where it last counted as moved, so a slow drift counts and a source that keeps sending the
same value does not. Then:

- with `smooth: 0` the param goes back to the timeline at once;
- with `smooth > 0` it fades into the timeline over about three times `smooth` seconds, then the override
  is cleared (a `trim` fades its offset to zero);
- the route waits until the source *moves* again before it takes anything: a source that keeps repeating
  the same value does not take the param back;
- it only clears what it wrote itself. If a slider took the param over in the meantime, that stays.

```js
// a main knob: meets the value first, glides, and gives the param back 4 s after the hand leaves
show.mapper.addRoute({ source: 'midi/cc/71', target: 'bloom', mode: 'pickup', release: 4, smooth: 0.15 });
```

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

To carry a wiring to another machine or another world, use a map file
([next section](#map-files-export-import-and-share)).

## Map files: export, import and share

The **L2 · Mapping** panel has three buttons under *map knobs in order*:

- **⬇ export** downloads the routes as `oav-map-<world>.json`.
- **⬆ import** picks a map file. You can also **drop a `.json` anywhere on the page**.
  Import *replaces* the routes; the new set is remembered at once.
- **clear** removes every route (click twice). On the next load the world's declared
  routes come back, as on a first visit.

Below the buttons the panel says what the last import did: how many routes came in, and
every route it **skipped** and why. A file that cannot be read says so and changes nothing.

### The format

```json
{
  "format": "openav.map",
  "version": 1,
  "world": "particles",
  "exported": "2026-10-15T08:30:00.000Z",
  "routes": [
    { "signal": "midi/cc/74", "param": "bloom", "curve": "exp",
      "range": { "in": [0, 1], "out": [0, 100] }, "smooth": 0.1, "invert": false },
    { "signal": "audio/rms", "param": "energy", "curve": "linear",
      "range": { "in": [0, 0.3], "out": [0, 1] }, "smooth": 0, "invert": false, "enabled": false }
  ]
}
```

Routes are named by `signal` and `param`, never by id, so a file travels between worlds:

- a route whose **param** this world does not have is skipped and listed;
- a route whose **signal** nothing in this show can produce (say `leap/palm/x` without a
  Leap Motion module) is skipped and listed. Signals that only appear when the first message
  arrives (`midi/…`, `surface/…`, `phone/…`, `osc/…`, `key…`, `take/…`) are kept and counted as
  *waiting*;
- when the file's `world` is a different one, the `range.out` is dropped so each param keeps its
  own range (the `in` window, curve, smoothing and invert come along);
- `version` newer than this build reads is refused with a message. A bare array from
  `mapper.toJSON()` (the old way) still imports, as version 0.
- `mode` (`"trim"` or `"pickup"`) and `release` (seconds) are optional route keys in version 1, written only when
  a route uses them. A build from before they existed ignores them and reads the route as a replacing route.
  For a `trim` route, `range.out` is the offset range.
- Files over 256 KB or with over 500 routes are refused.

### Load on open: `?map=`

```
https://openaudiovisual.com/examples/01-hello-particles/?map=https://example.com/my-map.json
https://openaudiovisual.com/examples/01-hello-particles/?map=maps/stage-left.json
```

`?map=<url>` fetches the file when the page opens and loads it like an import. It accepts a
**same-origin** address (relative paths included) or an absolute **https** one; `http:` to another
host, `data:`, `javascript:`, `file:` and addresses with a login are refused. A cross-site file
must be served with CORS (`Access-Control-Allow-Origin: *`; raw GitHub and gists do this).
The show starts regardless: if the address is refused, the fetch fails or the file is bad, the
panel shows the reason and the routes stay as they were. An explicit `?map=` beats the remembered
wiring, and what it loads is remembered like any import. In code, `createShow({ map: 'maps/a.json' })`
does the same and `map: false` ignores `?map=`.

### Remembered for you

The mapper saves its routes to `localStorage` (`openav.map.<world>`) every 3 seconds and right
after an import or clear, one slot per world name, so the next visit starts where you stopped.
Every read and write is wrapped: in a private window or with storage blocked nothing breaks,
the wiring just is not remembered.

In code:

```js
import { loadMapUrl, parseMap } from '@openav/mapping';

const file = show.mapper.exportMap();                    // the object above
const report = show.mapper.importMap(text);              // text or object; { mode: 'add' } keeps current routes
// → { ok, added, skipped: [{ signal, param, reason: 'param' | 'signal' }], waiting, dropped, crossWorld }
await loadMapUrl(show.mapper, 'maps/a.json');            // what ?map= calls; never throws
parseMap(text);                                          // validate without touching a mapper
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

const mapper = new Mapper({ signals, params, profile: 'default', onChange, onLearn, base });
mapper.addRoute(route)        // → the stored route (defaults filled in, id assigned)
mapper.removeRoute(id)
mapper.routesFor('bloom')     // → routes targeting a param
mapper.routes                 // the live array
mapper.learn('bloom')         // arm / cancel learn; mapper.learnTarget is the armed key
mapper.base = () => timeline.state()   // the timeline's value now (trim, pickup, smooth start); optional
mapper.update(dt)             // every frame: glides smoothed routes, keeps trims on the timeline, applies release
mapper.toJSON(); mapper.fromJSON(array)
mapper.exportMap(); mapper.importMap(text|object, { mode })   // the portable file, see above
mapper.clear()                // remove every route (and forget them)
mapper.report                 // what the last import / ?map= said
mapper.save(); mapper.load()  // localStorage 'openav.map.<profile>'; load() → true if found
mapper.dispose()              // stop listening to signals
```

`onChange()` runs when routes change (for UIs); `onLearn(route, signalName)` runs
when learn binds.
