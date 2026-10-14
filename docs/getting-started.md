# Quick start

## Three ways in

Pick the one that matches what you already have. They get bigger as you go down.

1. **One line in a p5.js sketch.** Any p5.js sketch (OpenProcessing, the p5 editor, your own page) can be played from a
   MIDI controller, from a controller drawn on screen, or from a phone, by adding one line at the top. Read
   [p5.js in one line](p5.md), and play the sketch that carries it: [example 15](https://openaudiovisual.com/examples/15-p5-one-line/).
2. **One controller in a page.** `<oav-controller profile="akai-lpd8">` puts a controller you can play into any web
   page. Read [MIDI controllers & embedding](controllers.md), and pick yours in the
   [controller library](https://openaudiovisual.com/controllers/).
3. **A whole show.** A World plus one `createShow()` call assembles inputs, mapping, timeline, console, sound and
   backstage. Start from [example 01](https://openaudiovisual.com/examples/01-hello-particles/) and keep reading below.

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

Not sure what your device can do? Open the [device check](https://openaudiovisual.com/check/). It looks at your browser, Web MIDI, microphone, camera and graphics, and says what to do about each. Nothing runs until you press a button, and nothing leaves your device.

Web MIDI is the one that differs most between browsers (sources checked 2026-10-15):

- **Chrome and Edge** have it. Use them for a show. Since Chrome 124 any use of MIDI asks for permission, where before only system-exclusive access did ([Chrome blog](https://developer.chrome.com/blog/web-midi-permission-prompt)).
- **Firefox** has Web MIDI on desktop from version 108, after you install Firefox's site-permission add-on ([Firefox 108 release notes](https://developer.mozilla.org/en-US/docs/Mozilla/Firefox/Releases/108)).
- **Safari** on Mac, iPhone and iPad has no Web MIDI ([caniuse](https://caniuse.com/midi)). WebKit lists it as not implemented because of fingerprinting concerns ([WebKit](https://webkit.org/tracking-prevention/)), and [bug 107250](https://bugs.webkit.org/show_bug.cgi?id=107250) is still open and unassigned. Chrome on an iPhone or iPad is WebKit underneath, so it has none either. On a Mac there is a third-party Safari extension, [Safari-WebMIDI](https://github.com/triglav-modular/Safari-WebMIDI); we have not tested it.

Where the browser has no Web MIDI, there are three routes:

- **Play on screen.** Every controller in the [library](https://openaudiovisual.com/controllers/) plays with a finger, and every event still fires.
- **Use a phone as the controller.** See [Phones, relay & surfaces](remote.md).
- **A browser app for the iPad.** [MIDIWeb Browser](https://apps.apple.com/app/midiweb-browser/id6757226617) is a third-party app for iOS 17.6 and later that gives pages Web MIDI. We have not tested it with open-audiovisual.

On Windows 11 the built-in Windows MIDI Services (released 2026-02-17) give apps shared MIDI ports and a loopback, so loopMIDI is no longer needed to send MIDI from the browser to a DAW ([Windows blog](https://blogs.windows.com/windowsexperience/2026/02/17/making-music-with-midi-just-got-a-real-boost-in-windows-11/)); see [Play your DAW with it](controllers.md#play-your-daw-with-it).

Two more rules apply to every browser:

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
