# oav-p5 — one line, and a p5.js sketch plays from MIDI

> Prototype (branch `feat/p5-inject`, 2026-10-13). Not on openaudiovisual.com yet: the URLs below are where it
> would live. Until then, test with the jsDelivr URL of a pushed commit (see *Versions*).

```js
document.head.append(Object.assign(document.createElement('script'), { src: 'https://openaudiovisual.com/p5/oav-p5.js' }));
```

Put that as the first line of a p5.js sketch (OpenProcessing, the p5 editor, any page), or paste the URL into
OpenProcessing → Sketch → Libraries → **Add Custom Library**. p5 1.x and 2.x, global mode; nothing to call in `setup()`.

Three inputs, one stream of MIDI bytes — the sketch never knows which one played:

| input | how |
|---|---|
| a real controller | Web MIDI (Chrome, Edge, Firefox). The browser asks once; the answer is remembered. |
| the on-screen controller | 🎹 bottom-right → `<oav-controller>` (MiniLab 3 by default, any @openav/midi profile) |
| a phone | 📱 in that panel → QR → the OAV remote page's MIDI tab, over the public relay |

## What the sketch gets

```js
midi.note[60]   // velocity 0..1 while key 60 is held, 0 when released
midi.cc[74]     // last value of CC 74, 0..1
midi.bend       // −1..1          midi.held   // notes held now, low → high
midi.last       // { type, note | cc, value, channel, source: 'hardware' | 'screen' | 'phone' }

function noteOn(note, velocity, channel) {}     // define any of these and they are called
function noteOff(note, channel) {}
function controlChange(cc, value, channel) {}   // value 0..1
function midiMessage(bytes, source) {}

midi.on('noteOn', fn)   // → off(); for instance mode or several listeners
midi.play(60, 0.8)      // play from code (source 'screen'); midi.play(60, 0) releases
midi.panel.open()       // midi.phone() shows the QR card
```

A sketch that already speaks Web MIDI itself (`navigator.requestMIDIAccess`, WebMidi.js) also hears the screen and
the phone: they are one more input, **OAV Virtual MIDI**, after the real ports (`packages/midi/virtual-access.js`).
In Safari (no Web MIDI) that virtual port is the only one, so such a sketch still runs.

## Why one async line is enough

p5 1.x and 2.x start global mode on `window` `load`; a script inserted while the page is still loading holds `load`
back until it has run. So the file is in place before `setup()` — `p5/test/smoke.cjs` checks it with the file
served 1.5 s late. If the file cannot load at all (offline, a typo in the URL), callbacks simply never fire, but
code that reads `midi.note` in `draw()` stops with *midi is not defined*: that message means the line did not load.

## Options

`window.OAV_P5 = { … }` before the line, `?key=value` on the script URL, or `?oav_key=value` on the page
(OpenProcessing forwards its page's `?sketch_oav_key=value` to the sketch).

| key | values | default |
|---|---|---|
| `hardware` | `auto` (ask at once) · `click` (ask from the 🎹 panel) · `off` | `auto` |
| `panel` | `closed` (just 🎹) · `open` · `off` (no on-screen UI) | `closed` |
| `profile` | any @openav/midi profile id (`akai-lpd8`, …) | `arturia-minilab3` |
| `shim` | `on` · `off` (the virtual port for the sketch's own Web MIDI code) | `on` |
| `relay` / `room` | the phone relay and room | `wss://remote.cheyuwu.com/relay` / one per browser |
| `telemetry` | `off` · `on` (@openav/midi's anonymous page-load hit, README "Telemetry") | `off` |

## Size and what loads when

`oav-p5.js` is 22 KB (8 KB gzip) and needs nothing else until someone opens 🎹: then `packages/midi/element.js`
and its 37 modules (~400 KB raw, the controller profiles included) load from next to it. 📱 adds
`packages/relay/index.js` (11 KB) and a QR encoder (qrcode-generator 1.4.4 from jsDelivr).

## Versions

The file loads the rest of OAV from next to itself, so one URL pins one whole tree:

- `https://openaudiovisual.com/p5/oav-p5.js` — always the latest (the site's cache: 4 h)
- `https://cdn.jsdelivr.net/gh/frank890417/open-audiovisual@<tag or commit>/p5/oav-p5.js` — frozen

## Tests

- `node --test tests/p5-inject.test.js` — the parser, state, callbacks (part of `npm test`)
- `PW=<playwright> P5_DIR=<p5 builds> node p5/test/smoke.cjs` — headless Chromium, p5 1.11.11 and 2.0.5 × the line,
  the line 1.5 s late, the Custom Library route: the sketch runs, `midi` exists in `setup()`, keys and knobs reach the
  callbacks, the 🎹 controller plays it, `requestMIDIAccess` gets the virtual port, a phone over a local relay plays
  it, no page errors — with no MIDI hardware and no permission.

Demo: `p5/examples/particles/` — a key throws particles from its pitch, any knob turns the colour.
