# @openav/surface

TouchOSC-style control surface: widgets, layout JSON, one theme. Pure ESM, no
dependencies. Fingers in, named normalized signals out — the surface never
knows the work.

```js
import { Surface, autoSurface, signalSink } from '@openav/surface';
new Surface(el, { layout, sink: signalSink(signals) });           // same-page
new Surface(el, { layout, sink: (name, v, info) => relay.set(name, v) }); // phone → relay
```

## Widgets

| type | outputs (normalized 0..1 + `…/raw`) | notes |
|---|---|---|
| `fader` | `surface/<page>/<id>` | `orient: v｜h｜auto` (auto follows the cell shape) · double-tap = default |
| `knob` | same | grab the rim to turn, the middle to drag |
| `encoder` | `<id>` (phase, wraps) + `<id>/delta` | endless |
| `button` | `<id>` 1/0 | momentary — a `pulse` param fires on the rising edge |
| `toggle` | `<id>` 1/0 | |
| `xy` | `<id>/x` `/y` `/down` | `spring: true` returns to center |
| `bank` | `<id>/1…N` | `count`, `labels`; one finger paints across channels |
| `radio` | `<id>` = idx/(n-1), raw = idx | `options: []` |
| `pads` | `<id>/hit` pulse `{pad,row,col,vel}` + `<id>/<n>` | `rows`, `cols`; velocity = where you hit the pad (top soft → bottom hard) |
| `keyboard` | `midi/note/on｜off`, `midi/cc/64` | wraps `@openav/keys`' `KeysPiano`; 1 row wide / **2 stacked rows tall**; vertical velocity; octave ±; hold-to-sustain; multi-touch |
| `number` | `<id>` | − / + (hold repeats) and a numeric field |
| `text` | `<id>` string pulse | Enter or ↵ sends |
| `label`, `meter` | receive-only | `surface.feedback(name, value)` |

Every widget: `id`, `type`, `label`, `min`, `max`, `def`, `step`, `unit`, `color`
(`cyan amber magenta lime violet coral white`), optional `target` (param key → a route, see below).

## Layout JSON

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
Orientation: `portrait`/`landscape` variants if given; else the base grid if its shape
matches; else **auto-reflow** (half / double the columns, rows are a count — the grid always
fits the viewport, nothing scrolls). `routesFromLayout(layout, params)` turns `target`s into Mapper routes.

## autoSurface — a World's params become the panel

```js
const { layout, routes, bindings } = autoSurface(world.params, { pairs: [['cx','cy']], meters: ['density'] });
routes.forEach((r) => mapper.addRoute(r));   // surface/… → param  (rule #1: continuous control = params)
feedbackFor(state, bindings);                // [{name, value}] to echo back to the phone
```
pulse → button · step 1 over 0..1 → toggle · step 1 over 2..7 values → radio (`options`) ·
else fader (≤ 6) or knob; 8 widgets per page; `group` → page; `surface: {type,color,label}` hint per param.

## Theme
`THEME_VARS` are CSS custom properties on `:root` (`--oav-bg`, `--oav-accent`, `--oav-radius`, …); override
them to re-skin every control. Rules: dark, ≥ 44 px touch targets, the live number always visible, pressed =
border + glow in the widget's color, `navigator.vibrate` where it exists. `platform.js`: `lockViewport()`
(no scroll / zoom), `keepAwake()` (Wake Lock), `toggleFullscreen()`.
