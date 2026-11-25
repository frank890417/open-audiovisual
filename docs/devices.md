# Devices

The things a show plugs in are many kinds of thing: a MIDI controller, a par can, an LED strip, a camera, an audio interface, a hand sensor, a sensor wired to a board. OAV already speaks to most of them, each through its own package and its own file format. `@openav/devices` puts them in one collection with one outer record, so a page, a tool or an agent can list them, search them, and ask for any one of them by id, and get it back ready for the package that drives it.

```js
import { devices, device } from '@openav/devices';

devices({ q: 'minilab' });                       // rows: id, kind, manufacturer, name, aliases, connections, protocols, verified
const mini = await device('arturia-minilab3');   // its profile, mapper routes, a MidiController in your MidiControllers
const par = await device('generic-rgbw');        // a DMX fixture that patches itself
const cam = await device('logitech-mx-brio');    // a camera found by its name, opened only when you call open()
```

## What is in it

| kind | where the record is read from | what `device()` gives |
|---|---|---|
| `midi-controller` | every profile in `packages/midi/profiles/`, hand-written and imported from QLC+ | `profile`, `routes()`, `addTo(controllers)` |
| `dmx-fixture` | every fixture in `packages/dmx/fixtures/` (and `fixtures/imported/`, where `tools/import-ofl.mjs` writes) | `profile`, `patch(patch, { address })` |
| `part` | every part of the electronics library, `packages/hw/parts.js` | `part` |
| `camera`, `audio-interface` | a hand-written record in `packages/devices/records/` | `constraints()`, `find()`, `open()` |
| `sensor`, `led-controller`, `dmx-interface`, `printer`, `projector`, `display` | a hand-written record | the record, whose `use` says which package reaches it |

Nothing is copied. A profile, a fixture and a part stay in their own files, the only place their facts are written, and the collection's record of each one is read off that file: when the package is built (`node tools/build-devices.mjs` writes `packages/devices/catalog.js`, the list `devices()` answers from) and again when `device()` loads it. A test fails when a profile, a fixture or a part exists that the list does not have, and when the list says something its file no longer does.

Listing is cheap. `devices()` reads one generated file, so a page can show and search the whole collection without fetching every profile; `device()` imports the one file the device lives in.

The first hand-written records are gear the project has on the desk, so each can be checked on the unit: the Yamaha AG06, the Logitech MX Brio, the Audinate Dante Virtual Soundcard, the Ultraleap Leap Motion Controller 2, WLED, the ENTTEC DMX USB Pro and the Brother QL-810W.

The collection is on the site: [/devices/](https://openaudiovisual.com/devices/) lists every device by kind, with a filter and a search. A controller's page stays at `/controllers/<id>/`; each DMX fixture has one at `/fixtures/<id>/` (every mode's channel table, a virtual fixture, the patch code, the file), and a record or a part at `/devices/<id>/` (the facts with their sources, setup, problems, the code, the file; a camera or an audio input can be looked for from the page, behind a button). A device gets a page of its own when it offers at least two of: something to try on screen, code that reaches it, a file to take. The Brother QL-810W has only its record, so it stays a row of the list until OAV has code for it.

## The record

Every device has the same outer record, `open-audiovisual/device@1`, described by [`device.schema.json`](../packages/devices/device.schema.json) for software that does not run this package.

| field | |
|---|---|
| `id`, `kind`, `manufacturer`, `name` | who it is. `manufacturer` is `null` when the file it is read from names no maker (the parts library, the generic layouts) |
| `aliases` | what people type when they search for it: a short name, the Chinese name, a model number |
| `connections`, `protocols` | how it plugs in (`usb`, `din-midi`, `ethernet`, `wifi`, `dmx-xlr5`, …) and what it speaks (`midi`, `dmx512`, `art-net`, …). A profile, a fixture or a part says nothing about how it plugs in, so its `connections` is empty and `devices({ connection })` finds hand-written records only, for now |
| `data` | `ref`: the deeper record (`{ type: 'midi-profile', id, file }`), and/or `facts`: `[{ key, value, unit, note, source }]`, each citing a source |
| `media` | a camera or an audio interface only: the label patterns that find it among the browser's devices, the recommended constraints, and where they come from |
| `setup`, `problems` | steps and known problems, `{ en, zh, source }` |
| `use` | how OAV reaches it today: `[{ package, entry, sink?, call, en, zh }]`, or `null` when nothing does |
| `sources` | every page a fact, a step or a problem comes from: `{ title, url, read }` |
| `license`, `verified`, `verifications` | the licence of the record's data, and how sure it is |
| `notes`, `tbd` | what is worth knowing, and what could not be confirmed |

`verified` is true only when the device was checked on a real unit, and a record refuses `verified: true` without a verification whose `method` is `hardware`. A MIDI controller counts as verified only when every one of its controls was: the M-VAVE SMC-Mixer has two hardware sittings in its log and 52 of its 59 controls marked confirmed, so it is not.

## device(), kind by kind

Each snippet runs as a module in a page whose import map is the examples' one plus `"@openav/devices": "../../packages/devices/index.js"`. Only the camera's button asks for a permission, and only when it is clicked.

### A MIDI controller

`routes()` is `@openav/midi`'s `controllerRoutes`: mapper routes from the controller's named signals to your params. `addTo()` puts the profile into a `MidiControllers` and returns its live controller. The unit is recognised by its port name when the manager gets its hardware engine (`controllers.attach(midi)`) and at each device change, so call `addTo()` first: a unit already plugged in is otherwise matched the next time a device comes or goes.

```js
import { device } from '@openav/devices';
import { MidiControllers } from '@openav/midi';
import { Signals } from '@openav/core';

const signals = new Signals();
const mini = await device('arturia-minilab3');
const controllers = new MidiControllers({ profiles: [mini.profile], signals });
const live = mini.addTo(controllers);
live.setValue('knob1', 0.5);                        // the on-screen knob; the hardware sends the same message
console.log(signals.get('midi/minilab3/knob1'));    // 0.504: 64 of 127, the MIDI value the knob sends
console.log(mini.routes({ knob1: 'hue' }));         // [{ source: 'midi/minilab3/knob1', target: 'hue' }]
```

### A DMX fixture

`patch()` places the fixture in a `@openav/dmx` `Patch`. The id defaults to `<device>-<universe>-<address>`, the universe to 1, the mode to the profile's first.

```js
import { device } from '@openav/devices';
import { Patch, DmxEngine } from '@openav/dmx';

const par = await device('generic-rgbw');
const patch = new Patch();
par.patch(patch, { id: 'par1', address: 1, mode: '6ch' });
const engine = new DmxEngine(patch);
engine.set('par1', { dimmer: 1, color: [1, 0.5, 0] });
console.log(engine.render(0).bytes(1).slice(0, 6));   // 255 255 128 0 0 0: dimmer, red, green, blue, white, strobe
```

### A part

```js
import { device } from '@openav/devices';

const ring = await device('neopixel-ring-12');
console.log(ring.part.leds, ring.part.supply);   // the @openav/hw library entry, as Hw.check() reads it
```

### A camera or an audio interface

The device is found among the browser's media devices by its label. `constraints()` is pure. `find()` calls `enumerateDevices()` and returns the device or `null`. `open()` is the only call that asks for a permission, so call it from a click.

```js
import { device } from '@openav/devices';

const cam = await device('logitech-mx-brio');
console.log(cam.constraints());       // { video: { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 60 } }, audio: false }
const video = document.body.appendChild(Object.assign(document.createElement('video'), { autoplay: true, muted: true }));
const button = document.body.appendChild(Object.assign(document.createElement('button'), { textContent: 'Camera' }));
button.onclick = async () => {
  video.srcObject = await cam.open();   // asks once; finds the MX Brio by name; opens it by its id
};
```

Browsers hide the labels until the page has had the permission once, so before that `find()` returns `null`; `open()` then asks, looks again, and if the browser opened another camera first, closes it and opens this one. With the labels visible and no match, it throws with the names it found and asks for nothing. An audio interface opens with echo cancellation, noise suppression and auto gain off, as `@openav/audio` asks a microphone; feed it to an analyzer with `analyzer.input().context.createMediaStreamSource(stream).connect(analyzer.input())`. `@openav/pose` opens the default camera itself, so a found camera does not reach the pose trackers yet.

### Everything else

A sensor, an LED controller, a DMX interface or a printer comes back as its record. Its `use` names the package and the call that reach it:

```js
import { device } from '@openav/devices';

const wled = await device('wled');
for (const u of wled.record.use) console.log(u.package, u.sink || '', u.call);
// @openav/out ddp new OutClient({ url: 'ws://127.0.0.1:6450/out' }).connect().set('light/0/r', 1)
// @openav/dmx artnet dmxTransport('bridge', { patch, client })
const printer = await device('brother-ql-810w');
console.log(printer.record.use);      // null: OAV has no code that talks to it, and the record says so
```

## Add a device

1. A device that has a deeper format goes there: a MIDI controller is a profile ([MIDI controllers](controllers.md)), a light is a fixture ([DMX lighting](dmx.md)), a part goes into `packages/hw/parts.js`. The collection picks it up.
2. Anything else is a record: `packages/devices/records/<id>.json`, the file name being the id. Copy one of the same kind.
3. Run `node tools/build-devices.mjs`: it validates every record and rewrites `catalog.js`. Then `node --test tests/devices.test.js`.
4. Leave `verified` false and `verifications` empty. Only a person with the unit can make it true.

## Facts and licences

- **Every fact cites the page it was read from.** A number, a port, a protocol name, a sample rate, a resolution comes from the manufacturer's own page or manual, with its URL in `sources` and the day it was read. What could not be read on such a page is left out, or written in `tbd`, never guessed. A short honest record beats a full guessed one.
- **Facts and links only.** No manual prose, no product photos: a manufacturer's page is under copyright, its facts are not.
- **Setup steps and known problems** come from the manufacturer's documents or from this handbook (troubleshooting, the package notes), each citing which.
- **Label patterns** (how a camera or an audio input is found by name) are written from the model name until someone reads the label a browser shows on a unit; each record says so in `tbd`.
- **Licences.** A record is MIT, like the project. A record read off a profile, a fixture or a part takes that file's licence: the controllers imported from QLC+ are Apache-2.0 (see `NOTICE`). Data from Mixxx (GPL) and midi.guide (CC-BY-SA) does not come in.
