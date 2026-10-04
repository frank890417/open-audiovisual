# MIDI controllers & embedding

open-audiovisual models MIDI controllers as data: one JSON file per device, with the
faceplate layout, every control's exact MIDI message, LED feedback, how to recognise its
port, and the document each number came from. The same file drives an on-screen controller
you can play, follows the real device when you plug it in, and can be dropped into any web
page. Every device is on the [controllers page](https://openaudiovisual.com/controllers/).

## Play one in a page

```html
<script type="module" src="https://openaudiovisual.com/packages/midi/element.js"></script>
<oav-controller profile="akai-lpd8" readout></oav-controller>
```

That is the whole integration. The element works without Web MIDI (Safari, iPad): it plays
and fires events; only hardware and MIDI out report that they are unavailable. It never asks
for MIDI permission unless you turn on `hardware`, `midi-out` or learn.

| Attribute | What it does |
|---|---|
| `profile` | which device: an id, a short name, or a URL to your own profile JSON |
| `layout` | `auto`, `face` (as it looks) or `stack` (re-gridded for a phone held upright) |
| `hardware` | `on`, or `ask` for a button: the real device moves the on-screen one |
| `midi-out` | a port name (`IAC`, `loopMIDI`), `/regex/`, or `ask`: what you play is sent there |
| `channel` | 1–16, when your unit is set to another channel |
| `picker`, `readout`, `learn`, `follow` | device picker, last-message line, learn button, show whatever known device you plug in |

## Listen to it

```js
const el = document.querySelector('oav-controller');
el.addEventListener('control', (e) => {
  const { id, value, signal, message, source } = e.detail;
  // 'k1'  0..1  'midi/lpd8/k1'  { type: 'cc', ch: 1, cc: 70, value: 53 }  'ui' | 'hardware'
});
await el.ready;
el.set('k1', 0.5);           // move a control as a hand would
el.ingest([0xb0, 70, 64]);   // MIDI from anywhere: the faceplate follows
```

Other events: `noteon`, `noteoff`, `connect`, `disconnect`, `status`, `profilechange`,
`ready`, `error`. All bubble and cross the shadow root. Every field of every payload is in
[packages/midi/README.md](../packages/midi/README.md).

## Without the element

```js
import { createController } from 'https://openaudiovisual.com/packages/midi/index.js';

const ctl = createController('akai-lpd8', { signals });   // signals: publish into a show
ctl.mount(document.querySelector('#pads'));                // optional
ctl.on('control', (e) => console.log(e.signal, e.value));
```

Inside a show, do not read `midi/lpd8/k1` in `update()`: route it to a param with
`controllerRoutes(profile, { k1: 'hue' })` (rule 1 in [AGENTS.md](../AGENTS.md)).
Example 09 does this for six devices at once.

## In an iframe

For places that only take an iframe:

```html
<iframe src="https://openaudiovisual.com/embed/controller/?profile=akai-lpd8&readout&frame=pads"
        width="720" height="220" style="border:0" allow="midi" title="AKAI LPD8"></iframe>
```

The frame posts `{ source: 'openav', type, frame, detail }` to its parent for every event,
and accepts `{ target: 'openav', type: 'set' | 'ingest' | 'press' | 'release' | 'reset' |
'profile' | 'layout' | 'get', … }`. Add `origin=https://your.site` to talk to your page only.

## Play your DAW with it

1. macOS: Audio MIDI Setup → Window → Show MIDI Studio → IAC Driver → “Device is online”.
   Windows: install loopMIDI and add a port.
2. `<oav-controller profile="akai-lpd8" midi-out="IAC">` (Windows: `midi-out="loopMIDI"`).
3. In Ableton Live, turn on Track and Remote for that input; in TouchDesigner, a MIDI In CHOP
   on it; in Resolume, Preferences → MIDI.

Hands on the screen are sent; your real hardware is not forwarded (the DAW already hears it).
The engine never listens to IAC inputs, and the element mutes an input named like its
output, so nothing loops.

## Telemetry

So the project can see where its controllers and shows end up, the packages send **one anonymous hit per page load** to Google Analytics 4 (the openaudiovisual.com property, `G-1YG2JHK2WT`):

| event | when | params |
|---|---|---|
| `oav_embed_load` | an `<oav-controller>`, `createController()` or the iframe starts | `oav_kind` (element · headless · iframe), `oav_profile`, `oav_host`, `oav_version` |
| `oav_hardware_connect` | a real controller is plugged in and matched | `oav_kind`, `oav_profile`, `oav_host`, `oav_version` |
| `oav_show_start` | `createShow()` starts | `oav_kind` (show), `oav_host`, `oav_version` |

`oav_host` is the **origin** of the page it runs on (for the iframe, the page that holds it), never the path, query or title. Nothing anyone plays is sent, no cookies are set, and the client id is random for every page load, so visitors can't be followed. No gtag.js is loaded: a page with its own Google Analytics keeps its dataLayer untouched. Nothing is sent from localhost, LAN addresses, `file://` or openaudiovisual.com itself, or when the browser sends Do Not Track / Global Privacy Control.

Turn it off: `<oav-controller telemetry="off">` · `createController(p, { telemetry: false })` · `createShow({ telemetry: false })` · the iframe's `?telemetry=0` · or `globalThis.OPENAV_TELEMETRY = false` before anything loads. Source: `packages/midi/telemetry.js`.

## Add a controller

1. Copy the closest file in `packages/midi/profiles/`, or a generic layout.
2. Write each control's type and message from the manual's MIDI implementation chart.
3. Cite every source; mark anything unconfirmed `"verified": false` with a note.
4. `validateProfile(profile)` lists every problem; `npm test` checks every shipped profile.
5. Try it with `<oav-controller profile="./my-device.json">`, then register it in
   `profiles/index.js` and open a pull request.

No manual: choose a generic layout, press Learn, move your controls in order, and keep
`controller.exportMapping()` as the start of a profile.
