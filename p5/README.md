# oav-p5 — one line, and a p5.js sketch plays from MIDI

```js
document.head.prepend(Object.assign(document.createElement('script'), { src: 'https://openaudiovisual.com/p5/oav-p5.js' }));
```

Put it as the first line of a p5.js sketch (OpenProcessing, the p5 editor, any page), or paste the URL into
OpenProcessing → Sketch → Libraries → **+** (custom library). p5 1.x and 2.x, global mode; nothing to call in `setup()`.

Then read the controller the way p5 reads the mouse:

```js
function draw() {
  background(knob1 * 255);                 // knob 1, 0..1 — like mouseX, no setup
  circle(width / 2, height / 2, 50 + knob2 * 300);
}
function notePressed(note, velocity) {     // like keyPressed(): any key (or pad)
  circle(random(width), random(height), velocity * 100);
}
```

| read | | define | |
|---|---|---|---|
| `knob1` … `knob8`, `knob(n)` | 0..1, numbered as printed on the device | `notePressed(note, velocity)` | a key went down (velocity 0..1) |
| `fader1` … `fader8`, `fader(n)` | 0..1 | `noteReleased(note)` | |
| `pad1` … `pad16`, `pad(n)` | velocity while held, 0 when released | `knobMoved(n, value)`, `faderMoved(n, value)` | |
| `note`, `velocity` | the last key and how hard | `padPressed(n, velocity)`, `padReleased(n)` | a pad also calls `notePressed` unless you define `padPressed` |
| `noteIsPressed`, `noteIsDown(60)` | like `keyIsPressed`, `keyIsDown()` | | |

Knob 1 means knob 1 on the controller that played: MiniLab 3 (CC 74) and LPD8 (CC 70) are built in, the other
OAV profiles (nanoKONTROL2, Launch Control, APC mini, …) load when one is plugged in, and on a controller OAV does
not know, the first knob you turn becomes `knob1`. A sketch's own `note`, `velocity` or `knob1` is never written over.

## With OP Configurator (OPC)

[OPC](https://github.com/msawired/OPC) names a variable and its range; this file wires the controller to it, in order.

```js
OPC.slider('radius', 60, 10, 300);   // knob 1
OPC.slider('speed', 1, 0, 5, 0.1);   // knob 2
OPC.toggle('trails', true);          // pad 1 (flips on each hit)
```

Knobs drive the sliders in declaration order, the faders continue after the knobs, pads drive toggles and buttons;
OPC's own panel moves with the knob. On OpenProcessing, whose OPC panel can also learn hardware itself (its MIDI
switch), hardware is left to that mapping as soon as it is seen working, and OAV keeps wiring the on-screen
controller and the phone. Don't name an OPC variable after a p5 function (`hue`, `fill`, …): p5 1.x will clash with it.

## Three inputs, one stream of bytes

| input | how |
|---|---|
| a real controller | Web MIDI (Chrome, Edge, Firefox). The browser asks once; the answer is remembered. |
| the on-screen controller | 🎹 → `<oav-controller>` (MiniLab 3 by default; follows the controller you plug in) |
| a phone | 📱 in that panel → QR → the OAV remote page's MIDI tab, over the public relay |

The sketch can't tell them apart (`midi.last.source` can). Safari and iPad have no Web MIDI: the screen and the phone
still work. On OpenProcessing the 🎹 and its panel sit at the top-left: its console floats over the bottom and OPC's
icon owns the top-right.

## MIDI-level access

`midi.note[60]`, `midi.cc[74]` (0..1), `midi.bend` (−1..1), `midi.held`, `midi.last` (`{ type, note | cc, value,
channel, source, control }`); `noteOn(note, velocity, channel)`, `noteOff`, `controlChange(cc, value, channel)`,
`pitchBend`, `midiMessage(bytes, source)`; `midi.on(event, fn)` → `off()`; `midi.play(60, 0.8)`; `midi.wiring()`.
A sketch with its own Web MIDI code (`navigator.requestMIDIAccess`, WebMidi.js) also hears the screen and the phone
as one more input, **OAV Virtual MIDI**, after the real ports.

## Why `prepend`, and why one async line is enough

p5's friendly errors read the page's last `<script>` as the sketch: first in `<head>`, this file is never mistaken
for the student's code. p5 1.x and 2.x start global mode on `window` `load`, and a script inserted while the page is
still loading holds `load` back until it has run, so `knob1` and `midi` exist in `setup()` (checked with the file
served 1.5 s late). If the file cannot load at all, code that reads `knob1` stops with *knob1 is not defined*: that
message means the line did not load.

## Options

`window.OAV_P5 = { … }` before the line, `?key=value` on the script URL, or `?oav_key=value` on the page
(OpenProcessing forwards its page's `?sketch_oav_key=value`).

| key | values | default |
|---|---|---|
| `hardware` | `auto` (ask at once) · `click` (ask from the 🎹 panel) · `off` | `auto` |
| `panel` | `closed` (just 🎹) · `open` · `off` | `closed` |
| `profile` | any @openav/midi profile id (`akai-lpd8`, …) | follows the plugged-in device, else `arturia-minilab3` |
| `opc` | `on` · `off` | `on` |
| `dock` / `corner` | `bottom`·`top` / `right`·`left` | top-left on OpenProcessing, bottom-right elsewhere |
| `shim` | `on` · `off` (the virtual port) | `on` |
| `relay` / `room` | the phone relay and room | `wss://remote.cheyuwu.com/relay` / one per browser |
| `telemetry` | `off` · `on` (@openav/midi's anonymous page-load hit) | `off` |
| `debug` | `1`: trace clicks and loading in the console | off |

## Size, versions

`oav-p5.js` is about 40 KB (13 KB gzip) and loads nothing else until 🎹 is opened (then `packages/midi/element.js` and
its modules, ~130 KB transferred, from next to it), a phone is asked for (`packages/relay`, a QR encoder), or an
unknown controller is plugged in (`packages/midi/profiles`). Because it loads the rest of OAV from next to itself,
one URL pins one tree: `openaudiovisual.com/p5/oav-p5.js` is the latest; `cdn.jsdelivr.net/gh/frank890417/open-audiovisual@<tag>/p5/oav-p5.js` is frozen.

## Tests

- `node --test tests/p5-inject.test.js` (part of `npm test`): parsing, the p5-style names, device numbering checked
  against the profiles, pads, unknown devices, OPC wiring and the OpenProcessing hand-over, names a sketch already owns.
- `PW=<playwright> P5_DIR=<p5 builds> BROWSER=chromium|webkit|firefox node p5/test/smoke.cjs`: p5 1.11.11 and 2.x ×
  the line, the line 1.5 s late, the custom-library route and OPC — the sketch runs, `midi` exists in `setup()`, keys,
  knobs and pads reach it, the 🎹 controller plays it, `requestMIDIAccess` gets the virtual port, a phone over a local
  relay plays it, no page errors; with no MIDI hardware and no permission.

Examples: `p5/examples/particles/` (`knob1`, `notePressed`) and `p5/examples/opc/` (OPC sliders on knobs).
