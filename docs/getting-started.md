# Quick start

## Run it

You need Node.js (any current version; CI runs the tests on Node 22) and a
browser. There is nothing to install: no `npm install`, no bundler.

```bash
git clone https://github.com/frank890417/open-audiovisual.git
cd open-audiovisual
node serve.js            # → http://localhost:8080
```

`serve.js` is a static file server with caching turned off (stale code on stage
is a nightmare) that also hosts the phone relay at `ws://<host>:8080/relay`.
Pass a port to use another one: `node serve.js 3000`. The same commands exist as
npm scripts:

| command | what it runs |
|---|---|
| `npm start` | `node serve.js` |
| `npm run monitor` | `node packages/monitor/server.js`, the backstage monitor on port 7457 |
| `npm run bridge` | `node packages/osc/bridges/osc-bridge.js`, the OSC → UDP bridge on port 7456 |
| `npm test` | `node --test tests/*.test.js` |

Open `http://localhost:8080/examples/01-hello-particles/`. Every example runs
without hardware.

## Which browser

- **Chrome or Edge** for a show. They have Web MIDI; Safari does not.
- **Camera and microphone** only work in a secure context: `http://localhost`
  or `https://`. Open the show on the machine that runs `serve.js` through
  `localhost`, not through its LAN address.
- **Phones** can join over plain `http://` on the local network for touch, keys
  and the control surface. iOS only gives motion sensors and the camera to
  `https://` pages (see [Phones, relay & surfaces](remote.md#ios-and-https)).

## What you are looking at

An example page has two parts: the **stage** on the left (the world renders
there) and the **side panel** on the right. From the top, the side panel holds:

1. **The piano**, with two checkboxes: *keyboard* turns on QWERTY playing,
   *simulate performance* starts a hands-free player.
2. **Transport**: play/pause, previous/next scene, reset, the clock, the
   current scene, and a scrubber with one block per scene.
3. **Layers**: what every layer is doing right now (events per second per input,
   active routes, world and FPS, what is leaving the browser).
4. **L1 · Input**: MIDI devices (untick to mute one) and buttons for sources that
   need a click: 🎤 mic, 🖐 hands, 🕺 body.
5. **L2 · Mapping**: every route, with a mute box and ✕ to remove it.
6. **L3 · Params**: a slider per param, ✕ to clear an override, *learn* to map.
7. **L4 · Output — sound**, when the show has sound: *enable sound*.
8. **Signals**: a live meter for every signal.

Each panel title collapses its panel.

| key | action |
|---|---|
| <kbd>Space</kbd> | play / pause the timeline |
| <kbd>←</kbd> <kbd>→</kbd> | previous / next scene |
| <kbd>R</kbd> | stop and rewind the timeline to 0:00 |
| <kbd>T</kbd> | performance mode (teleprompter) |
| <kbd>F</kbd> | fullscreen |
| <kbd>M</kbd> | show/hide the on-screen MIDI controller (only in shows that set `modules.midi.controllers`) |

## Play without hardware

- **On-screen piano**: click or touch the keys; drag across them for a glissando.
- **QWERTY**: tick *keyboard* first (capture is off by default so letters do not
  steal the console's hotkeys). The keys `A W S E D F T G Y H U J K O L P ;`
  play 17 notes a semitone apart, starting at the piano's base note; <kbd>Z</kbd>/<kbd>X</kbd>
  shift an octave; hold <kbd>Shift</kbd> for a louder note.
- **Simulate performance**: a hands-free player noodles in a pentatonic scale
  with steps, leaps, triads and rests, so you can watch the mapping breathe.
- **Drum machine** (examples 03 and 06): a step sequencer whose signals have the
  same shape as the microphone's drum detection.
- **On-screen MIDI controller** (example 09): a picture of a known controller
  you can play with the mouse (the supported devices are listed on the
  [controllers page](https://openaudiovisual.com/controllers/)); plug the real
  one in and the picture moves with your hands.

All of these publish the same signals as real hardware, so nothing downstream
can tell the difference.

## Your first world

A world is an object with `params` and four lifecycle functions. Hand it to
`createShow()` and the rest of the show is assembled around it:

```js
import { createShow } from '@openav/show';
import { createCanvas } from '@openav/stage';

const pulse = {
  name: 'pulse',
  // what the piece is performed WITH: sliders, knobs, hands, the timeline
  params: [{ key: 'size', min: 10, max: 200, def: 40 }],
  init({ container, signals }) {
    this.view = createCanvas(container);
    this.r = 0;
    // a struck note is an event, so it may come straight from a signal
    signals.on('midi/note/on', ({ vel }) => { this.r = 120 * vel; });
  },
  update(dt, state) { this.r = Math.max(0, this.r - dt * 90); this.size = state.size; },
  render() {
    const { ctx } = this.view, { w, h } = this.view.fit();
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(w / 2, h / 2, this.size + this.r, 0, 7); ctx.fill();
  },
  dispose() { this.view.dispose(); },
};

await createShow({ world: pulse, modules: { sound: true } });
```

Play a note: the circle jumps and decays. Drag the *size* slider, or click
*learn* next to it and turn a knob. That is the whole model: params for
continuous control, signals for events.

## Make a new example

1. Copy `examples/01-hello-particles/` to `examples/<nn>-<name>/` (the next free
   number). Its `index.html` already has an import map for every
   `@openav/*` package; the `?v=` suffixes are cache stamps written by
   `tools/stamp-version.mjs` before a deploy.
2. Write your world in `main.js` ([Writing a world](writing-a-world.md)).
3. Change the `<title>` in `index.html`. Add CDN script tags there if you use p5
   or another renderer.
4. Open `http://localhost:8080/examples/<nn>-<name>/`.

An AI agent can do steps 1–2 with the MCP tool `scaffold_world`
([For AI agents](agents.md)).

## Check your work

- `npm test` passes (it covers the pure logic: chords, timeline, mapping, relay,
  surfaces, MIDI parsing and profiles, the site pages).
- The page loads with no console errors. One message is expected: if the
  backstage monitor is not running, the browser reports that
  `ws://localhost:7457` refused the connection. The page retries quietly with a
  growing delay (up to 30 s). Run `npm run monitor` to make it go away.
- Press <kbd>Space</kbd>: the timeline plays and something changes over time.
- Tick *keyboard* and press <kbd>A</kbd>: the world reacts without any hardware.
- `window.openav` in the devtools console is the whole show (signals, params,
  mapper, timeline…), for poking at it by hand.
