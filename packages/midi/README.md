# @openav/midi

Web MIDI in and out for performance, and a library of MIDI controllers modeled as data:
every knob, pad and key with its exact MIDI message, LED feedback, port matching and the
document each number came from. Play them on screen, plug the real one in and watch it
move, embed one anywhere with one line. Gallery: <https://openaudiovisual.com/controllers/>

Zero build, zero dependencies. Web MIDI: Chrome, Edge, Firefox (after a site permission).
Safari / iPad have none: controllers still play and fire every event; hardware and MIDI
out report `unavailable`.

## Quick start

### One line, any page

```html
<script type="module" src="https://openaudiovisual.com/packages/midi/element.js"></script>
<oav-controller profile="akai-lpd8" readout></oav-controller>
```

No import map, no build. Shadow DOM keeps the page's CSS out and the controller's CSS in.

### An iframe (Notion, CMSs)

```html
<iframe src="https://openaudiovisual.com/embed/controller/?profile=akai-lpd8&readout"
        width="720" height="220" style="border:0" allow="midi" title="AKAI LPD8"></iframe>
```

Query params mirror the element's attributes, plus `bg=transparent|#hex`, `pad=<px>`,
`frame=<name>` (echoed in every message), `origin=https://your.site`, `lang=zh`.
`allow="midi"` lets hardware and MIDI out work inside the frame.

### JavaScript (React, Vue, Svelte, plain)

```js
import { createController } from 'https://openaudiovisual.com/packages/midi/index.js';

const ctl = createController('akai-lpd8');                  // id, short name or a profile object
ctl.mount(document.querySelector('#pads'));                  // optional: headless works too
ctl.on('control', (e) => console.log(e.signal, e.value));
ctl.connectHardware();                                       // follow the real LPD8 (asks for Web MIDI)
```

In a framework, render `<oav-controller>` and listen with `addEventListener` on a ref, or
call `createController()` in an effect and `ctl.dispose()` in its cleanup.

### MIDI out to Ableton, TouchDesigner, Resolume

```html
<oav-controller profile="akai-lpd8" midi-out="IAC"></oav-controller>
```

- macOS: Audio MIDI Setup → Window → Show MIDI Studio → IAC Driver → “Device is online”.
- Windows: install loopMIDI, add a port, use `midi-out="loopMIDI"`.
- Or `midi-out="ask"`: the visitor picks a port.

What a hand plays on screen (and `set()`) leaves as real MIDI; moves of your real hardware
are not forwarded (your software already hears the device). No feedback loops: the `Midi`
engine's input filter (`filterOut`, default `'IAC'`) never listens to the IAC bus you send
into, and an input with the same name as the chosen output (the loopMIDI echo) is muted.

### Output hot-plug, echo, and score markers

The `Midi` engine keeps the output you chose, and tells you when it moves:

- **Hot-plug.** The output is unplugged → `Midi` switches to the next best live port (your choice by name, then the
  `prefer` list, e.g. `new Midi({ prefer: ['IAC'] })`, then the first port); the port you chose is plugged in again → it
  switches back; an unrelated device never steals the output. Each switch is one line in the MIDI log (`onMessage`) and one
  `console.warn`, shown in the console's `MIDI out →` row and the controller panel's monitor. `midi.onOutput(({ text, reason, next }) => …)`
  (`reason`: `found`, `fallback`, `back`, `none`, `select`) and `midi.selectOutput(name)` (remembers it as your choice).
- **Echo.** Inputs named like `filterOut` (default `IAC`) are never listened to, and an input message identical to one just
  sent (within `echoWindow` ms, default 40, `0` = off) is our own echo and is dropped (`midi.echoDropped` counts them).
- **Score markers.** `new ScoreMidi({ midi, channel: 15, segment: { note: 36, cc: 20 }, cue: { note: 84, notes: { 'dusk.glow': 90 }, cc: 21 } })`
  sends a note (and/or CC) for each segment change and cue so a DAW can follow the show; `createShow({ score: { …, midi: { channel: 15 } } })`
  wires it. Off unless asked; only while the show plays (`scrub: true` also marks hand-made jumps). Pure logic for all three is
  in `ports.js` and `score-out.js`; docs: [Score & Director](https://openaudiovisual.com/docs/#score-score-to-midi).

## `<oav-controller>`

### Attributes (each reflected as a property)

| Attribute | Values | Default |
|---|---|---|
| `profile` | id (`akai-lpd8`), short (`lpd8`) or a URL to a profile JSON | `arturia-minilab3` |
| `layout` | `auto` · `face` (as it looks) · `stack` (re-gridded for a tall box) | `auto` |
| `hardware` | off · `on` (bare attribute) · `ask` (a button; the permission prompt waits for a click) · a port name / `/regex/` | off |
| `midi-out` | off · `ask` (bare attribute) · a port name, substring or `/regex/` | off |
| `channel` | 1–16: move every control to this channel | the profile's |
| `picker` | show a device picker | off |
| `readout` | show the last message (`midi/lpd8/k1 = 0.42 ← CC 70 = 53 · ch 1`) | off |
| `learn` | show a Learn button (tap a control, move the hardware one) | off |
| `follow` | plug a different known device in → show that one | off |
| `theme` | `dark` · `light` (the toolbar; the device stays the device) | `dark` |

Embedding never asks for MIDI permission unless `hardware`, `midi-out` or Learn is used.
Size: fills its width; height follows the faceplate (a taller stack on phones) unless you
set one. CSS: `--oav-bg`, `--oav-fg`, `--oav-accent`, `--oav-line`, `--oav-font`,
`--oav-ratio` (width ÷ height); parts: `::part(toolbar)`, `::part(body)`, `::part(readout)`.

### Events (CustomEvent, bubbling, composed)

| Event | `detail` |
|---|---|
| `ready` | `{ profile, name, controls: [ids] }` |
| `control` | `{ profile, id, type, label, value, raw, signal, message, bytes, source, time, note?, velocity?, delta?, held?, pressure? }` |
| `noteon` / `noteoff` | the same payload, for pads, keys and note buttons |
| `connect` / `disconnect` | `{ port, profile }` — a hardware port started / stopped driving it |
| `status` | `{ hardware, input, output, outputState, profile }` |
| `profilechange` | `{ profile, name }` |
| `error` | `{ message }` (e.g. a profile URL that does not load or validate) |

`control` fields: `value` 0..1 (−1..1 for bipolar wheels; pads = velocity while held, 0 on
release; buttons 0/1; keys = that note's velocity), `raw` the MIDI number (0..127, pitch
bend 0..16383), `signal` the name the rest of open-audiovisual uses (`midi/lpd8/k1`, keys:
`midi/minilab3/n60`), `message` the parsed MIDI (`{ type: 'cc', ch: 1, cc: 70, value: 53 }`),
`bytes` the raw bytes, `source` `'ui'` (screen, `set()`) or `'hardware'` (a port, `ingest()`).
`hardware` / `outputState`: `off` · `asking` · `waiting` · `connected` / `open` · `missing` ·
`unavailable` (no Web MIDI) · `denied`.

### Methods

| Method | |
|---|---|
| `ready` | Promise, resolves with the element once its controller is live |
| `set(id, value, { note, quiet })` | move a control like a hand: knobs/faders 0..1; pads/buttons > 0 press, 0 release; keys `set('keys', vel, { note: 60 })`. `quiet`: only the faceplate moves (two-way binding) |
| `get(id)` · `values()` | one value · `{ id: value }` |
| `reset()` | release everything, bring every control home |
| `press(id, vel, note)` · `release(id, note)` | |
| `ingest(bytes)` | MIDI from anywhere (WebSocket, another tab): the faceplate follows, `control` fires with `source: 'hardware'`. One message or a list |
| `send(bytes)` | raw bytes to the MIDI output port |
| `on(name, fn)` | subscribe; `fn(detail, event)`; returns unsubscribe |
| `connectHardware()` · `disconnectHardware()` · `setOutput(query)` · `toggleLearn(on)` | |
| `core` · `controller` · `controllers` · `view` · `midi` · `status` · `profileData` | the objects underneath, for power users |

`defineController('my-tag')` registers the element under another name.

## postMessage protocol (`/embed/controller/`)

iframe → page, for every event:

```js
{ source: 'openav', v: 1, type: 'control', frame: 'pads', detail: { /* the event payload */ } }
// type: ready · control · noteon · noteoff · connect · disconnect · status · profilechange · error · values
```

page → iframe (anything else is ignored):

```js
win.postMessage({ target: 'openav', type: 'set', id: 'k1', value: 0.5 }, '*');      // + note, quiet
win.postMessage({ target: 'openav', type: 'ingest', bytes: [0xb0, 70, 64] }, '*');   // or a list of messages
win.postMessage({ target: 'openav', type: 'press', id: 'pad1', velocity: 0.8 }, '*'); // release · reset
win.postMessage({ target: 'openav', type: 'profile', profile: 'korg-nanokontrol2' }, '*');
win.postMessage({ target: 'openav', type: 'layout', layout: 'stack' }, '*');
win.postMessage({ target: 'openav', type: 'get' }, '*');   // answers { type: 'values', detail: { profile, values } }
```

With `?origin=https://your.site` the frame only posts to and accepts from that origin.
Helpers: `toParent` / `fromParent` (frame side), `toFrame` / `fromFrame` (page side) in `embed.js`.

## Headless API

```js
import { createController, Midi, MidiControllers, MidiController, controllerRoutes, PROFILES } from '…/packages/midi/index.js';
```

- `createController(profile, { signals, channel, follow, midi, profiles })` → `ControllerHost`:
  `on`, `set`, `get`, `values`, `reset`, `press`, `release`, `ingest`, `send`, `mount(el, { layout })`,
  `setProfile(ref)`, `connectHardware(port?)`, `disconnectHardware()`, `setOutput(query)`,
  `requestMidi()`, `outputs()`, `learn(on)`, `dispose()`; `.controller`, `.profile`, `.controllers`,
  `.view`, `.midi`, `.status`. Pass `signals` to publish `midi/<short>/…` into a show.
  Embeds share one `Midi` engine per page (one permission prompt).
- `loadProfile(idOrUrl)` → a validated profile.
- `MidiController` — one profile as a live model (`ingest`, `setValue`, `press`, `turn`, `learn`,
  `onChange`, `onMessage`, LED feedback). `MidiControllers` — ports ⇄ profiles (`attach(midi)`,
  `select`, `assign`). `ControllerView` — the faceplate. `controllerRoutes(profile, { knob1: 'hue' })`
  — mapper routes (continuous control goes through params, AGENTS.md rule 1).
- `Midi` — the engine: `enable()`, `listen(fn)`, `onDevices(fn)`, `send()`, `panic()`, `dispose()`.

## Drawn into a canvas (video)

The on-screen controller is DOM, and a page cannot record its own DOM. `ControllerCanvas` draws the
same faceplate into any 2D context, every frame, at any size: the bottom of a performance video
(`@openav/record`'s `Compositor#setPanel`), an overlay, a thumbnail.

```js
import { ControllerCanvas } from '…/packages/midi/index.js';

const panel = new ControllerCanvas({ profile: 'arturia-minilab3', signals });   // follows the bus
panel.draw(ctx, { x: 0, y: 1080, w: 1080, h: 840 });                          // each frame
panel.renderTo(canvas);                                                        // or fill a canvas of its own
```

- **State**: with `signals`, the generic names (`midi/ch/<ch>/…`, `midi/note/on|off`, `midi/cc/<n>`,
  `midi/bend`) are turned back into bytes (`eventOfSignal`, the inverse of `genericSignals`) for a
  private, silent `MidiController`: hardware, the on-screen controller, the QWERTY piano, phones and a
  `TakePlayer` replaying a clip all move it. Each message counts once although hardware publishes it
  under two names (`followMidiSignals`). With `controller` it follows that controller instead (one
  device exactly, its learned mapping; a replayed take does not reach it). `mapping` applies
  `exportMapping()` of the live device to the private one.
- **For video**: released keys and pads fade (a 20 ms staccato is still on a 30 fps frame), the control
  a hand just moved glows, the device's screen shows the last touch (`Knob 3 · 87`, `C4 · 100`), and
  when the area has room the held notes are written large under the faceplate (`notes: 'auto'`).
  The keyboard follows the device's octave buttons (`keyWindow`).
- **Options**: `theme` (`bg`, `body`, `accent` = one colour for everything, `glow` 0..1, fonts — see
  `CANVAS_THEME`), `notes` (`'auto'` · `true` · `false`), `screen`, `padding`. `aspect` = the
  faceplate's width ÷ height. `dispose()` stops listening.
- **Pure helpers** (tested): `controllerGeometry(profile, rect)`, `keyboardGeometry(from, to, rect)`,
  `keyWindow(from, to, base, note)`, `touchText(control, state, note)`, `midiNoteName`, `fadeLevel`.

Signals a controller publishes: `midi/<short>/<id>` (0..1) and `/raw`; pads `/hit`
(+ `/pressure`), encoders `/delta`, keys `/on` `/off` and `midi/<short>/n<note>`;
`midi/<short>/last`. Generic names (`midi/cc/74`, `midi/note/on`, `midi/ch/<ch>/…`) come
from the engine (hardware) or the controller itself (on-screen playing). See `docs/signals.md`.

## Profiles

A profile is one JSON file in `profiles/` (registered in `profiles/index.js`):

```json
{
  "id": "akai-lpd8", "short": "lpd8", "name": "AKAI LPD8 (mk2)", "maker": "AKAI Professional", "kind": "device",
  "match": { "ports": ["lpd\\s*8"], "prefer": [], "avoid": [] },
  "sources": [{ "title": "…", "url": "https://…", "note": "what it confirmed" }],
  "face": { "w": 100, "h": 27, "label": "AKAI LPD8" },
  "sections": [{ "id": "pads", "x": 2, "y": 4.5, "w": 58, "h": 21, "cols": 4, "rows": 2, "controls": ["pad5", "…"] }],
  "portrait": [{ "id": "pads", "cols": 2, "rows": 4, "weight": 3.4, "controls": ["…"] }],
  "controls": [{ "id": "pad1", "type": "pad", "msg": "note", "ch": 10, "note": 36, "label": "Pad 1", "verified": false }]
}
```

| Type | `msg` | Signal value |
|---|---|---|
| `knob`, `fader` | `cc` (absolute) | 0..1 |
| `encoder` | `cc` + `relative`: `offset64` · `offset16` · `twos` · `signbit` (or `false`) | position 0..1, `/delta` |
| `pad` | `note` (velocity) or `cc`; `aftertouch`: `poly` · `channel` | velocity while held, `/hit` |
| `button` | `note` or `cc`; `mode`: `momentary` · `toggle`; `shape`: `round` | 0 / 1 |
| `keys` | `note`, `from`..`to` (catch any note on their channel) | `/on` `/off`, `n<note>` |
| `wheel`, `strip` | `cc` or `pitchbend`; `bipolar`, `spring` | 0..1 or −1..1 |

Other fields: `channel` (profile default), per-control `ch`, `label`, `color`
(`cyan amber magenta lime violet coral white`) or `tint` (any CSS colour), `led`
(`{ msg: 'note'|'cc', on, off, ch?, velocity? }`), `verified: false` with a `note` (text)
explaining why, `group`; `face.body`, `face.deco` (`screen`, `logo`, `buttons`, `label`);
sections `label`, `flow: 'column'`, `spans: { id: [cols, rows] }`; `stack: false` keeps the
face on tall screens; `origin` (where the profile came from); `notes`. Careful: on note
controls `note` is the MIDI note number; elsewhere it is a remark.

`kind: "device"` must cite at least one source and is matched to ports by `match`;
`kind: "generic"` layouts never auto-match and auto-learn whatever device you assign.

### Model a new controller

1. Copy the closest device, or a generic layout (`generic-8k8p`, `generic-8f`, `generic-16p`,
   `generic-keys25/49/61`).
2. Write each control's message from the manual's MIDI implementation chart.
3. Cite every source (`title`, `url`, what it confirmed). Mark anything unconfirmed
   `"verified": false` with a note — learn mode rebinds it in one move.
4. Validate: `validateProfile(profile)` returns every problem in words (`[]` = valid).
5. Try it: `<oav-controller profile="./my-device.json">` loads a profile by URL.
6. Add it to `profiles/index.js` and open a pull request; `npm test` validates every shipped
   profile and checks MIDI out for every control.

No manual? Pick a generic layout, press Learn, move your controls in order;
`controller.exportMapping()` gives the result as JSON.

## Telemetry

So the project can see where its controllers and shows end up, the packages send **one anonymous hit per page load** to Google Analytics 4 (the openaudiovisual.com property, `G-1YG2JHK2WT`):

| event | when | params |
|---|---|---|
| `oav_embed_load` | an `<oav-controller>`, `createController()` or the iframe starts | `oav_kind` (element · headless · iframe), `oav_profile`, `oav_host`, `oav_version` |
| `oav_hardware_connect` | a real controller is plugged in and matched | `oav_kind`, `oav_profile`, `oav_host`, `oav_version` |
| `oav_show_start` | `createShow()` starts | `oav_kind` (show), `oav_host`, `oav_version` |

`oav_host` is the **origin** of the page it runs on (for the iframe, the page that holds it), never the path, query or title. Nothing anyone plays is sent, no cookies are set, and the client id is random for every page load, so visitors can't be followed. No gtag.js is loaded: a page with its own Google Analytics keeps its dataLayer untouched. Nothing is sent from localhost, LAN addresses, `file://` or openaudiovisual.com itself, or when the browser sends Do Not Track / Global Privacy Control.

Turn it off: `<oav-controller telemetry="off">` · `createController(p, { telemetry: false })` · `createShow({ telemetry: false })` · the iframe's `?telemetry=0` · or `globalThis.OPENAV_TELEMETRY = false` before anything loads. Source: `packages/midi/telemetry.js`.

## Files

`parse.js` bytes ⇄ events ⇄ signal names · `profiles.js` validate / match · `controller.js`
MidiController · `manager.js` MidiControllers · `view.js` ControllerView · `canvas.js`
ControllerCanvas (for video) · `panel.js` docked panel · `embed.js` options, payloads, postMessage (pure, tested) · `element.js` `<oav-controller>`
· `index.js` Midi engine + `createController` · `virtual-access.js` Web MIDI shim ·
`link.js` / `remote-tab.js` phones over the relay · `profiles/` the data.
