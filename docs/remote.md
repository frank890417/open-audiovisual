# Phones, relay & surfaces

Phones and iPads can be controllers: their motion sensors, a piano, and a
TouchOSC-style control panel that grows from the world's params. Three packages
do it, each usable alone:

| package | role |
|---|---|
| `@openav/relay` | a zero-dependency WebSocket relay with rooms, and its browser client |
| `@openav/surface` | the control-surface widgets, the layout JSON, `autoSurface(params)` |
| `@openav/remote` | the phone app (tabs 感測 sensors · 琴鍵 keys · 控制台 control · MIDI) and the show-side adapter |

To the mapper, a phone is one more input: it publishes signals, and routes
connect them to params.

## Set it up

1. Run `node serve.js` on the show machine. It serves the pages *and* hosts the
   relay at `/relay`; nothing else is needed.
2. Open a show that declares `modules: { remote: true }`, for example
   `http://localhost:8080/examples/08-remote-surface/`.
3. The join card at the top left of the stage shows the URL a phone should open,
   with the show machine's LAN address filled in (the page asks `serve.js` for it
   at `/__info`) and the room: `http://<lan-ip>:8080/packages/remote/?room=default`.
4. Open that URL on a phone on the same network. The card counts connected
   phones.

The relay only exists where `serve.js` runs. On a static host such as
openaudiovisual.com the card says *relay offline*.

## The phone app

`/packages/remote/` is a single page with a status header (connection, latency,
room, the phone's id) and tabs:

- **感測 (sensors)**: a tilt ball, acceleration and rotation readouts, a
  multi-touch pad, knocks (a sharp jolt of the phone), and light from the front
  camera. iOS needs a tap on 開始 (start) before it gives motion data.
- **琴鍵 (keys)**: a piano that is one row of about three octaves in landscape,
  and two stacked rows in portrait (the upper row continues the range). Vertical
  position on a key sets velocity; hold-to-sustain and octave buttons included.
- **控制台 (control)**: a control surface. Its layout comes from, in order: the
  `?surface=<layout.json url>` query, the `?meta=<json url>` query (its `params`
  go through `autoSurface`), whatever the show publishes over the relay, and
  finally a small generic panel so the page is never blank.
- **MIDI**: a virtual MIDI controller, the same one the show displays
  ([MIDI controllers & embedding](controllers.md)).

| query | meaning |
|---|---|
| `room=<name>` | the room to join (1–32 characters of `A–Z a–z 0–9 _ -`; anything else means `default`) |
| `tab=sense\|keys\|control\|midi` | the tab to open first |
| `surface=<url>` | a layout JSON for the control tab |
| `meta=<url>` | a JSON file with a `params` array; the control tab becomes `autoSurface(params)` |
| `relay=ws://…` | a relay somewhere else than the page's own server |

Each phone keeps a short random id in `localStorage`; it is the `<id>` in
`phone/<id>/…`.

## iOS and HTTPS

iOS Safari only gives motion sensors and the camera to pages served over
`https://`. Touch, keys and the control surface work over plain `http://` on the
LAN. For tilt and knocks on an iPhone, reach `serve.js` through an HTTPS tunnel
and open the tunnel's address on the phone; the relay follows the page's origin
(`wss://` on HTTPS pages). Android Chrome behaves the same for the camera.

## The show side

`modules: { remote: true }` in `createShow()` (or `mountRemoteHost()` from
`@openav/remote/host`) does five things, so the world stays ignorant of phones:

1. joins the relay as the room's **runner** (the show);
2. files every phone signal into `signals`, and mirrors `phone/<id>/…` to
   `phone/any/…`, which always holds the value from whichever phone sent it last;
3. builds the control surface: `world.surface` if the world ships a layout,
   otherwise `autoSurface(world.params)`; and publishes it to every phone,
   including phones that join later;
4. adds the `surface/… → param` routes to the mapper (skipping pairs that are
   already there);
5. sends param values back to the phones about 10 times a second, so faders
   follow the timeline and other controllers.

| `modules.remote` option | default | meaning |
|---|---|---|
| `room` | `?room=` in the page URL, else `'default'` | the room name |
| `auto` | `{}` | options for `autoSurface` (`pairs`, `meters`, `style`, `perPage`, `smooth`, `title`) |
| `surface` | `world.surface` | an explicit layout (wins over the world's) |
| `feedbackHz` | `10` | how often param values are echoed |
| `url` | same-origin `/relay` | the relay's WebSocket URL |

Routes for sensors are written at author time with the `phone/any/…` alias,
because nobody knows a stranger's device id in advance (example 08):

```js
await createShow({
  world: bloomWorld,
  routes: [
    { source: 'phone/any/tilt/x', target: 'drift', inMin: -1, inMax: 1, outMin: 0, outMax: 2, smooth: 0.12 },
    { source: 'phone/any/knock', target: 'burst' },
  ],
  modules: { keys: { base: 48 }, remote: { auto: { pairs: [['cx', 'cy']], meters: ['density'] } } },
});
```

`show.remote` is the host: `{ relay, layout, routes, bindings, room, publish(),
frame(dt, state), connect(), dispose() }`.

## Surface widgets

A surface turns fingers into named, normalized signals. Every widget publishes
under `surface/<page>/<id>`; when the widget's range is not 0..1, the unscaled
value also goes out as `…/raw`.

| type | publishes | notes |
|---|---|---|
| `fader` | `<id>` | `orient: v`, `h` or `auto` (follows the cell's shape) · double-tap resets to `def` |
| `knob` | `<id>` | grab the rim to turn, the middle to drag |
| `encoder` | `<id>` (phase, wraps) and `<id>/delta` (turns) | endless |
| `button` | `<id>` 1 / 0 | momentary; a `pulse` param fires on the rising edge |
| `toggle` | `<id>` 1 / 0 | |
| `xy` | `<id>/x`, `<id>/y`, `<id>/down` | `spring: true` returns to the centre |
| `bank` | `<id>/1` … `<id>/N` | `count`, `labels`; one finger paints across channels |
| `radio` | `<id>` = index / (n − 1), `raw` = index | `options: [...]` |
| `pads` | `<id>/hit` pulse `{ pad, row, col, vel }`, `<id>/<n>` velocity while held | `rows`, `cols` (default 4 × 4), `labels`; `n` counts from 0; velocity = where you hit (top soft, bottom hard) |
| `keyboard` | `midi/note/on`, `midi/note/off`, `midi/cc/64` | the same names a hardware keyboard uses |
| `number` | `<id>` | − / + buttons (hold repeats) and a field |
| `text` | `<id>`, a string pulse | Enter or ↵ sends |
| `label`, `meter` | nothing | display only; fed by `surface.feedback(name, value)` |

Common fields: `id`, `type`, `label`, `min`, `max`, `def`, `step`, `unit`,
`color` (`cyan amber magenta lime violet coral white`), and `target` (a param key,
or an array for `xy` and `bank`) for [hand-written layouts](#hand-written-layouts).

The phone keyboard's notes are `{ note, vel, velocity, ch: 1, device: 'surface' }`.

## Layout JSON

A layout is data, like a route: shareable as a file, writable by an agent,
publishable by a world.

```json
{ "version": 1, "title": "Bloom",
  "pages": [{
    "id": "main", "title": "Main", "grid": { "cols": 8, "rows": 4 },
    "widgets": [
      { "id": "hue",  "type": "knob",   "label": "Hue", "x": 0, "y": 0, "w": 2, "h": 2, "min": 0, "max": 360, "def": 205, "color": "cyan", "target": "hue" },
      { "id": "pos",  "type": "xy",     "x": 2, "y": 0, "w": 4, "h": 4, "target": ["cx", "cy"] },
      { "id": "go",   "type": "button", "label": "Burst", "x": 6, "y": 0, "w": 2, "h": 1, "target": "burst" }
    ],
    "portrait": { "grid": { "cols": 4, "rows": 8 }, "place": { "pos": { "x": 0, "y": 2, "w": 4, "h": 4 } } }
  }] }
```

Phones get turned, so a page decides its arrangement like this:

1. if the page has a `portrait` or `landscape` variant for the current
   orientation, use its grid (widgets missing from its `place` keep their base
   spot or fill free cells);
2. otherwise, if the base grid already has the right shape, use it;
3. otherwise **auto-reflow**: the same widgets, repacked row by row into half
   (portrait) or double (landscape) the columns.

Rows are a count, not pixels, so the grid always fills the screen and nothing
ever scrolls. Widgets without `x`/`y` are packed into free cells with a default
size per type. `validateLayout(layout)` returns a list of problems (empty =
fine); `new Surface()` throws with that list on a bad layout.

## autoSurface

`autoSurface(params, options)` turns a world's params into a layout, the routes
that drive the params, and the bindings for feedback:

```js
import { autoSurface, feedbackFor } from '@openav/surface';

const { layout, routes, bindings } = autoSurface(world.params, { pairs: [['cx', 'cy']], meters: ['density'] });
routes.forEach((r) => mapper.addRoute(r));   // surface/main/hue → hue, …
feedbackFor(state, bindings);                // [{ name, value }] to echo back to the phone
```

How each param becomes a widget:

| param | widget |
|---|---|
| `pulse: true` | button |
| `step: 1` and a range of 1 (two values) | toggle |
| `step: 1` and three to seven values | radio (labels from `options`, else the numbers) |
| a pair listed in `pairs` | one xy pad driving both |
| anything else | a fader when there are six continuous params or fewer, knobs when there are more |
| `surface: { type, color, label }` on the param | whatever it says |

Options: `pairs`, `meters` (params to also show read-only), `style` (`'auto'`,
`'fader'`, `'knob'`), `perPage` (default 8; a page that scrolls is a page that
fails), `smooth` (default 0.04 s on continuous routes, to hide 30 Hz network
steps), `title`. Each param `group` gets its own page.

## Hand-written layouts

Give a widget a `target` and `routesFromLayout(layout, params)` writes its route
(the same shape `autoSurface` produces): `xy` maps x to the first target and y to
the second, `bank` maps channel *i* to the *i*-th target. A world can carry its
layout as `world.surface`; the show side then uses it instead of generating one.

## Theme and phone helpers

Every control reads CSS custom properties on `:root` (`THEME_VARS`:
`--oav-bg`, `--oav-surface`, `--oav-accent`, `--oav-radius`, `--oav-touch-min`
(44 px) …). Override them to re-skin the whole surface. The rules: dark,
≥ 44 px touch targets, the live number always visible, pressed = border and glow
in the widget's color, `navigator.vibrate` where it exists.

`@openav/surface` also exports phone helpers: `lockViewport()` (no scrolling or
zooming), `keepAwake()` (Wake Lock), `toggleFullscreen()`, `canFullscreen()`,
`haptic(ms)`.

## The relay

Clients connect to `ws://<host>/relay?role=controller|runner|monitor&room=<name>&id=<device>`.
A room is a name; peers in different rooms never hear each other.

| from | to | what |
|---|---|---|
| controller (a phone) | runner + monitor | `signal` and `batch` |
| runner (the show) | monitor | `signal` and `batch` |
| runner | controllers + monitors | `feedback` (meters, fader echo), `config` (the surface layout; replayed to phones that join later) |
| monitor | nobody | |

Messages are JSON: `{"type":"signal","name":"phone/ab12/tilt/x","value":0.3,"t":…,"pulse"?:true}`,
`{"type":"batch","items":[…]}`, `ping`/`pong`, `status` (peer counts),
`feedback`, `config`. Clients ignore types they do not know. When the runner
leaves, the room forgets its config. Messages over 256 KB are ignored, frames
over 1 MB close the connection, and a phone that stops answering pings (screen
locked, Wi-Fi gone) is dropped within about 40 s.

```js
import { RelayClient, bindSignals } from '@openav/relay';

const show = new RelayClient({ role: 'runner', room: 'main' }).connect();
bindSignals(show, signals);                        // phone signals → Signals, + phone/any/… alias
show.feedback('surface/main/level', 0.4);          // runner → phones
show.config('surface', { layout });                // runner → phones, kept for late joiners

const phone = new RelayClient({ role: 'controller', room: 'main' }).connect();
phone.set('phone/me/tilt/x', 0.3);                 // continuous: batched at 30 Hz, re-sent every second
phone.send('midi/note/on', { note: 60 }, true);    // pulse: immediate, never coalesced
```

Continuous values are re-sent once a second so a phone that joins late, or a
show page reloaded mid-performance, is never stuck on stale defaults. Pulses are
never batched or repeated: a note-on delivered twice is a bug. The client
reconnects by itself (0.5 s, doubling up to 5 s).

`fileSignal(signals, name, value, { pulse })` is the receiving half of the wire
format: it declares a name the first time it is heard (`signalMeta()` knows the
ranges of `phone/…`, `surface/…` and `midi/…` names), fills in whichever velocity
spelling a note message lacks (`vel` 0..1 or `velocity` 1..127), then pulses or
sets.

To run the relay without `serve.js`: `node packages/relay/server.js [port]`
(default 7458, health at `/health`), or attach it to your own Node server with
`attachRelay(server, { path: '/relay' })` from `@openav/relay/server`.

## The show page on a phone

When the show itself runs on a phone, it can read the phone's own motion
sensors without a relay. `localSensors(signals)` publishes the same names under
`phone/local/…`, mirrored to `phone/any/…`, so routes written for "the latest
phone" work either way. Call `.start()` from a tap (iOS permission rules):

```js
import { localSensors } from '@openav/remote';

const own = localSensors(show.signals);
button.onclick = async () => { await own.start(); if (own.denied) alert('motion access denied'); };
```

## Security

The relay has no authentication. Anyone on the same network who knows the room
name can join as a controller and move your params. For a show, use a closed
network or a room name nobody will guess.
