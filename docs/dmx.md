# DMX lighting

DMX512 is how stage lights are told what to do: one cable carries a **universe** of 512 channels, each a number from 0 to 255, sent about 40 times a second. A light listens to a few channels starting at its **address** (a par might read dimmer, red, green, blue, white, strobe from address 1 to 6), and what each channel means is in its manual, its **profile**. Networks carry many universes at once (Art-Net, sACN), and a USB interface turns a computer's numbers into the cable's signal.

`@openav/dmx` puts a lighting rig inside a work: fixture profiles, a patch, an engine that renders every light at any moment from scenes, cues, chases and effects, and three ways to get the bytes out. It runs with no light and no interface: the monitor on the page shows what the rig is getting. [Example 28](https://openaudiovisual.com/examples/28-dmx-lights/) is all of it in one page.

> [!WARNING]
> Nothing here has been tried with a real fixture, node or interface yet. The bytes follow the published layouts of Art-Net 4, ANSI E1.31 and the Enttec DMX USB Pro API, and the tests decode every packet on this machine, but no light has received them for this project. Before a show, check your rig with the section [Check it in TouchDesigner](#dmx-check-it-in-touchdesigner) and with the lights themselves, and keep a hand on blackout.

## Three ways out of the computer

| way | from | what you need | good for |
|---|---|---|---|
| **out-bridge + Art-Net** | the page → `ws://127.0.0.1:6450/out` → UDP 6454 | `node packages/out/bridge/out-bridge.mjs --config out.json`, an Art-Net node | venues, most network nodes, many universes |
| **out-bridge + sACN** | the page → the bridge → UDP 5568 (multicast or unicast) | the same bridge, an sACN (E1.31) receiver | consoles and newer nodes, priority between sources |
| **Web Serial + Enttec DMX USB Pro** | the page → USB, no bridge | Chrome or Edge on a computer, a DMX USB Pro or an interface that speaks its protocol | one interface, one universe, a classroom |

A browser cannot send UDP, so the network protocols leave through the **out-bridge**, the same local program that drives WLED strips and motor boards ([`@openav/out`](packages.md)). The page sends one value per DMX address on channels named `dmx/<universe>/<address>`, and the bridge's `artnet`, `sacn` or `enttec` sink keeps a 512-byte buffer per universe and sends it at a fixed 40 Hz while it changes, and once a second while it does not (a node that hears nothing for about 2.5 s decides the source is gone).

```json
{ "channels": [
  { "match": "dmx/1/*", "sink": "artnet", "host": "2.0.0.10" },
  { "match": "dmx/2/*", "sink": "sacn", "priority": 100, "source": "my show" },
  { "match": "dmx/3/*", "sink": "enttec", "path": "/dev/cu.usbserial-EN000000", "universe": 3 }
], "safe": { "dmx/1/49": "hold", "dmx/1/51": "hold", "dmx/*": 0 }, "timeoutMs": 500 }
```

- **Art-Net** goes to the node's address (`host`, or a list of them). Art-Net 4 says ArtDmx is never broadcast: 40 packets a second per universe would reach every device on the network and flood slow nodes and Wi-Fi. `"broadcast": true` is there for an old node that only listens to broadcast, on a network that carries nothing else.
- **sACN** goes to each universe's multicast group `239.255.<high byte>.<low byte>` (receivers join the groups they want), or to `host` when you give one. `priority` is 0–200 (100 by default: a receiver takes the highest it hears), `source` is the name a console shows, `interface` picks the network card multicast leaves from. A clean stop sends three "stream terminated" packets after the safe values.
- **Enttec** writes one `universe` to a DMX USB Pro on a serial device. A missing device is a status, retried every 2 s, never a crash.
- **Web Serial** needs no bridge: `dmxTransport('serial')` and a **Connect** button (the browser asks which port, only from a click). Chrome and Edge on a computer only, on https or localhost.
- Not here: an Enttec Open DMX or any bare FTDI cable (the computer would have to time the DMX break itself, which a page cannot do reliably), RDM, Art-Net discovery (ArtPoll), ArtSync.

### Which universe is which

"Universe 1" is the number you patch on and the number in the channel name, `dmx/1/…`. It leaves as **Art-Net Port-Address 1** (Net 0, Sub-Net 0, Universe 1) and as **sACN universe 1**. `dmx/N/…` is Port-Address N (up to 32767, Net · Sub-Net · Universe in one 15-bit number) and sACN universe N (up to 63999).

Some software calls its first universe "1" but sends it as Art-Net Port-Address 0, which Art-Net 4 deprecates. If a node is set to 0, patch the page on universe 0 (`dmx/0/…` reaches it through Art-Net; sACN has no universe 0) or, better, set the node to 1. `encodeArtDmx()` takes the Port-Address itself and defaults to 1.

## Fixtures and the patch

A **profile** says which channels a light has and in which order each mode sends them. The generic ones ship with the package (`FIXTURES`: a dimmer, RGB, RGBW, RGBA and RGBAW+UV pars, a strobe, a moving head in 8 and 16 channels); a real fixture's profile is a JSON file you copy and change to match its manual. None of them is marked verified, because only a person with the light in front of them can say a profile is right.

The **patch** puts fixtures on universes and addresses, in groups, with limits:

```js
import { Patch } from '@openav/dmx';

const patch = new Patch();
for (let i = 0; i < 8; i++) patch.add({ id: `par${i + 1}`, profile: 'generic-rgbw', mode: '6ch', address: 1 + i * 6, groups: ['pars'] });
patch.add({ id: 'head1', profile: 'generic-moving-head', mode: '16ch', address: 49, groups: ['heads'], limits: { tilt: [0.1, 0.9] } });
patch.check();   // fixtures that share addresses, if any
```

A work never names channel numbers. It asks for properties, each 0..1: `dimmer`, `color: [r, g, b]`, `pan`, `tilt`, `strobe`, `zoom`. The patch turns them into each light's bytes: the colour is split into the emitters the fixture has (white first on an RGBW par), pan and tilt become two bytes where the mode has a fine channel, and a fixture with no dimmer channel gets the dimmer in its colour.

## Scenes, cues, chases and effects

`DmxEngine` renders every light at any moment as a pure function of time: the same `t` always gives the same bytes, so a look can be checked with no light and a recording can be rendered frame by frame. The layers, bottom to top:

| layer | call | what it is |
|---|---|---|
| base | `scene(name, { target: props })`, `base(...names)` | the look that is just on |
| cues | `cue(name, { scene, fadeIn, fadeOut, curve })`, `go(name, at)`, `release(at)` | go to a scene with a fade, as on a lighting desk |
| chases | `chase(name, { steps, every, unit, fade })`, `run(name, on)` | scenes in turn, every n beats or seconds |
| effects | `effect(name, { target, property, wave, rate, depth, spread })`, `tune(name, { rate, depth }, at)` | sine, saw, square, chase, flicker or rainbow over a group, each fixture a little behind the one before |
| live values | `set(target, props)` | a fader, the microphone: on top of everything |
| submasters | `submaster(target, level)` | a fader over a group: scales the dimmer of what every layer made |
| last | `engine.master`, `engine.blackout`, the patch's limits | grand master, blackout, per-fixture limits |

A target is a fixture id, a group, `'*'` or a list of them. `tune()` changes a running effect's rate without a jump: the wave goes on from where it is, only faster or slower. (Defining the effect again would restart its phase, and a knob turned on a wave that is 100 seconds along would sweep it through many cycles at once.)

```js
const engine = new DmxEngine(patch);
engine.scene('on', { pars: { dimmer: 1 }, heads: { dimmer: 1, tilt: 0.4 } }).base('on');
engine.effect('breathe', { target: 'pars', wave: 'sine', rate: 0.2, depth: 0.35, spread: 1 });
engine.effect('sweep', { target: 'heads', property: 'pan', rate: 0.12, depth: 0.5 });
const universes = engine.render(t);      // every light at t seconds
```

## Where the bytes go each frame

`dmxTransport()` takes what `render()` returns, every frame, and delivers only what changed:

```js
import { dmxTransport } from '@openav/dmx';
import { OutClient } from '@openav/out';

const out = dmxTransport('sim', { patch });                                       // memory only: out.bytes(1)
// const out = dmxTransport('bridge', { patch, client: new OutClient({ id: 'my-show' }).connect() });   // the out-bridge
// const out = dmxTransport('serial', { patch, universe: 1 });  button.onclick = () => out.connect();  // an Enttec Pro
out.send(engine.render(t));
```

Every transport puts the frame through the flash guard before anything leaves (see [Safety](#safety)); `{ patch }` lets it read each fixture's light. The bridge transport calls `client.set('dmx/<universe>/<address>', byte / 255)` once per changed channel. The serial one writes a whole Enttec frame (all 512 channels) when anything in its universe changed, at most one every 25 ms, and once a second otherwise.

In a [lab](lab-integration.md) work, `"modules": ["out", "dmx"]` gives `lab.dmx`: a patch from `meta.dmx.patch`, its engine, the transport with the flash guard on (`?dmx=bridge` goes through `lab.out`, `?dmx=serial` to an Enttec Pro), `lab.dmx.frame(t)` to render and send, `lab.dmx.monitor(el)` and `lab.dmx.params(options)`.

## Driving the lights from sound and from a controller

The engine never reads a signal (the framework's first rule: continuous control goes through params). `dmxParams()` turns its control points into params, and from then on the lights are performed like any world:

```js
const rig = dmxParams(engine, { groups: ['pars', 'heads'], effects: ['breathe', 'sweep'], chases: ['walk'] });
const lights = {
  name: 'lights',
  params: rig.params,                       // dmx/master, dmx/blackout, dmx/pars/dimmer, dmx/pars/hue, dmx/sweep/rate, …
  update(dt, state) { t += dt; rig.apply(state, t); out.send(engine.render(t)); },
  render() {},
};
```

| key | drives |
|---|---|
| `dmx/master` | the grand master |
| `dmx/blackout` | blackout (a step param, 0 or 1) |
| `dmx/<group>/dimmer` | a submaster over the group: cues, chases and effects keep running under it |
| `dmx/<group>/hue`, `/saturation` | the group's colour, in a base scene of its own (a rainbow effect mixes over it) |
| `dmx/<effect>/rate`, `/depth` | the effect, through `tune()`: no jump when a knob moves |
| `dmx/<chase>/run` | a chase on or off |

Now the mapper connects anything to them, in `routes` or with learn in the L2 · Mapping panel:

```js
routes: [
  { source: 'audio/rms', target: 'dmx/pars/dimmer', inMax: 0.25, outMin: 0.25, smooth: 0.25 },   // the room's loudness (smoothed for the look)
  { source: 'drum/kick/env', target: 'dmx/pars/dimmer', outMin: 0.3, smooth: 0.12 },             // the drum machine, when there is no mic
  { source: 'chord/consonance', target: 'dmx/pars/hue', inMin: -1, inMax: 1, outMin: 0.62, outMax: 0.06, smooth: 0.4 },
  { source: 'midi/cc/7', target: 'dmx/master' },                                                   // any controller's volume fader
],
```

The timeline automates the same keys (`automation: { 'dmx/pars/hue': [[0, 0.07], [24, 0.58]] }`), a phone surface shows them as faders (their `group` is `lights`), and a world's own params can feed both the picture and the lights.

## Safety

- **Blackout.** `engine.blackout = true` (or the `dmx/blackout` param, or the Blackout button in example 28) takes every dimmer to 0 at once (and the colour of a fixture that has no dimmer channel, since its dimmer is in its colour), and leaves pan, tilt, zoom and control channels where they are, so a moving head does not swing when the room goes dark.
- **Limits.** Each placed fixture can have `limits` (`{ dimmer: [0, 0.8], tilt: [0.1, 0.9] }`), applied after every layer, before the grand master.
- **Flashing, per fixture.** Flashing faster than about three times a second can bring on a seizure in people with photosensitive epilepsy. What matters is the light one fixture really gives, so the cap, `maxFlashHz` (3 by default), is held per fixture, in two layers.
  1. **In the engine.** Each effect and each chase is first held to the cap on its own: a rate in seconds is clamped, a rate in beats is halved until it fits (so it stays on the beat), a chase's step is doubled, a random flicker draws no more new values than that. Then, for each fixture, the rates of everything that flashes it (effects on its dimmer or colour, chases that change it with anything but position) are added up. When the sum is over the cap, those sources are slowed on that fixture until it is not: a rate in seconds by the same factor, a rate in beats halved, a chase's step doubled. Two 3 Hz effects on one par run at 1.5 Hz each there, and on the pars that carry only one of them they keep their speed. `engine.state(t).slowed` (and `describe().slowed`) lists the fixtures slowed, with their sum before and after and each source. This layer is still a pure function of time: the same `t` gives the same bytes, so a recording renders frame by frame as before. `tune()` keeps every wave on a shared fixture going from where it is when a knob changes one of them.
  2. **At the output.** Every `dmxTransport()` (sim, bridge and serial) puts the frame through a flash guard before it leaves. It reads each fixture's brightness from the bytes (its intensity times its brightest colour channel) and counts a flash the way WCAG 2.3.1 does: a pair of opposing changes of 10% of full scale or more, measured from the last turning point. No fixture may brighten by that much more than 3 times in any second: when the next rise would be one too many, the light stays at the level it last had, steady, until the second has room. Falls always pass, so blackout and a cue to dark land on the next frame, and the guard never sends more light than was asked. It holds only the intensity bytes (the colour bytes, scaled together, on a fixture with no dimmer channel); pan, tilt, zoom, gobo, strobe and control channels, and every fixture it is not holding, leave exactly as they came. This layer catches what the engine cannot see: live values (a fader, the microphone, `drum/kick/env` on a dimmer at 180 bpm sixteenths is 12 flashes a second), two engines on one rig, and a combination of waves that lands more edges in one second than their rates add up to. It keeps a memory, so it lives in the transport, outside the engine, and counts wall-clock seconds, never the time a timeline is scrubbed to.
  - Give the transport the patch: `dmxTransport('sim', { patch })`. Without it the guard holds each DMX channel on its own, which is coarser (see the bridge below), and its status says `unit: 'channel'`.
  - `out.flashGuard` is `{ on, unit, maxFlashHz, held }`: the fixtures held back in the last frame. The monitor rings them in amber.
  - Switching it off takes `dmxTransport(kind, { flashGuard: false })`, in so many words. The monitor then shows a red **FLASH GUARD OFF** for as long as it is off. Raising the engine's `maxFlashHz` does not raise the guard's: that is `{ maxFlashHz }` on the transport.
  - The out-bridge's three DMX sinks carry the same guard, on by default, so another program sending DMX through the bridge is held too. A bridge knows no patch, so there the unit is one DMX channel, which is coarser: it also holds channels that flash nothing. The case that matters is a 16-bit pan or tilt: during a smooth move its fine byte runs a fast sawtooth, and holding it makes the beam step by up to one coarse step (example 28's sweep through it: under 2° on a 540° head). List those channels in the route's `"flashGuard": { "exempt": ["dmx/1/49-52"] }`, or switch the bridge's guard off with `"flashGuard": false` when the page's guard is the one you rely on. See the [out package README](https://github.com/frank890417/open-audiovisual/blob/main/packages/out/README.md#the-flash-guard).
  - A strobe channel follows its own rule: one whose profile gives its Hz is held to the cap, one whose profile does not stays on its open value.
  - Raise the cap (or set `Infinity`) only on purpose.
- **What neither layer catches.** Many fixtures flashing together: the guard counts each light on its own, so twenty pars each at 3 Hz but out of step are a room flashing far faster, and the total flashing area in the audience's view is yours to judge. The picture on a projector, a screen or LED wall: the guard sees DMX only (example 28 draws its stage from the guarded bytes, but a world's own canvas is not guarded). A colour that alternates at the same brightness (saturated red against blue, WCAG's "red flash"): brightness here is intensity times the brightest channel, which does not move. Fast pan and tilt are not a flash and are not held.
- **Control channels.** A `control` channel (reset, lamp on and off, built-in programs) cannot be set by a scene, an effect, a param or a route: only `engine.control(id, key, byte)` writes it.
- **The watchdog.** Through the bridge, a page that stops talking (a closed tab, a frozen page) gets each channel put on its `safe` value after `timeoutMs` (500 ms by default), and at once when the last page disconnects or the bridge stops cleanly. The first glob that fits wins, and `"hold"` means no safe value: `{ "dmx/1/49": "hold", "dmx/*": 0 }` darkens the rig and leaves one head's pan alone. On Web Serial there is no watchdog: the Pro keeps repeating the last frame, so send a blackout before `close()`.

## Watch it without hardware

- `dmxTransport('sim', { patch })` keeps the bytes in memory, after the flash guard; `out.bytes(1)` is universe 1, `out.changed` the channels of the last send.
- `mountDmxMonitor(el, { patch, transport, engine })` draws the rig on the page: one swatch per fixture (its colour times its dimmer, a moving head's pan and tilt as a small mark) and the 512 channels of a universe as a grid, each cell its value as a bar, tinted by what it drives. Point at a cell to read its address, value, fixture and channel. Everything is read back from the bytes, so a profile one channel off shows the wrong colour here too. `monitor.update()` with no argument shows what the transport delivered, after the flash guard; the header says what the guard is doing, held fixtures get an amber ring, and with the engine the fixtures its per-fixture cap slows are marked "slow".
- [Example 28](https://openaudiovisual.com/examples/28-dmx-lights/) draws a stage with the same lights and the monitor under it, on the `sim` transport by default: `?out=bridge` sends to the out-bridge, `?out=serial` adds a Connect button for an Enttec Pro.
- `tests/dmx-out.test.js` runs the bridge on this machine and decodes every Art-Net and sACN packet it sends with the package's own decoders.

## Check it in TouchDesigner

TouchDesigner's **DMX In CHOP** is a second receiver that has nothing to do with this code, which makes it a good check before a rig is in the room.

1. In `out.json`, send universe 1 to this machine: `{ "match": "dmx/1/*", "sink": "artnet", "host": "127.0.0.1" }` (or `"sink": "sacn", "host": "127.0.0.1"`). Start the bridge.
2. In TouchDesigner, add a DMX In CHOP. For Art-Net, pick the Art-Net interface and set Net 0, Subnet 0, Universe 1 (Port-Address 1). For sACN, pick sACN and universe 1.
3. Open example 28 with `?out=bridge`. The CHOP shows 512 channels moving: par 1 is channels 1 to 6 (dimmer, red, green, blue, white, strobe), head 1 starts at 49.
4. Close the tab: within half a second the channels go to their safe values.

This check has not been run for this project yet, and the CHOP's parameter names may read a little differently in your version of TouchDesigner.

## Not yet tested on real hardware

What was checked: the byte layouts against the specifications, every packet decoded on this machine (universe, bytes, at most 44 packets a second, the keep-alive, safe values when the page goes away), the Enttec sink and the Web Serial transport against stand-in ports, the engine's caps and fades and both flash layers in `npm test` (flashes counted at 40 frames a second on injected clocks, by a counter written apart from the guard), and example 28 in a headless browser with no permission for serial or MIDI. The flash guard has not been watched on a real light: what a fixture does with a held intensity byte (its own dimmer curve, its fade time) is not known here. What was not: a real Art-Net node, an sACN receiver or console, an Enttec DMX USB Pro, any real fixture's channels, and TouchDesigner as a receiver. If you have any of them, try it and tell us what you saw.
