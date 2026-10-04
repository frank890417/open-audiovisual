# Troubleshooting

Real problems, found in rehearsals and in the code, with what to do about them.

## The console shows a ws://…:7457 error

Every show made with `createShow()` tries to stream to the backstage monitor at
`ws://<the page's host>:7457`. When no monitor is running, the browser logs the
refused connection. This is expected and harmless: the page retries with a
growing delay (about 5 s, rising to 30 s) instead of spamming. To make it go away, run
the monitor:

```bash
npm run monitor          # node packages/monitor/server.js
```

## The phone join card says "relay offline"

The phone relay lives inside `serve.js` (`/relay`). Static hosting (GitHub Pages,
openaudiovisual.com) has no relay, so examples 08 and 09 cannot reach phones
there. Run the show from `node serve.js` on a machine on the same network as the
phones.

## No MIDI devices appear

- Use Chrome or Edge. Safari has no Web MIDI.
- Allow MIDI when the browser asks. The permission is per site: allowing it on
  `localhost:8080` does not allow it on `localhost:3000`.
- The device was plugged in after the page loaded: it should appear by itself.
  If it does not, reload.
- Check the **L1 · Input** panel: a device with its box unticked is muted.
- Another program may hold the port exclusively (some DAWs and drivers on
  Windows do). Close it.

## A DAW on the IAC bus is not heard

By default the `Midi` engine ignores every input whose name contains `IAC`
(`filterOut: 'IAC'`). A show that sends MIDI out through the macOS IAC bus would
otherwise hear its own output and loop. `createShow()` uses that default. To
receive from a DAW over IAC, turn the built-in engine off and make your own:

```js
import { Midi } from '@openav/midi';

const show = await createShow({ world, modules: { midi: false } });
const midi = new Midi({ signals: show.signals, filterOut: null });   // or a narrower regex
await midi.enable();
```

Your engine publishes into the same signals, so routes and worlds work
unchanged. (The console's device list and MIDI meter only follow the engine
`createShow()` made.) Do not send MIDI out to the same IAC bus you listen to.

## With two controllers, a route reacts to both

With two or more MIDI inputs, each device publishes under its own name
(`midi/<slug>/cc/74`) *and* under the shared legacy name (`midi/cc/74`). A route
on `midi/cc/74` hears every device; change its source to the per-device name.
The slugs are shown in the **L1 · Input** panel.

## QWERTY keys do not play

Tick *keyboard* above the piano first. Capture is off by default so that typing
never fights the console's hotkeys. Then `A W S E D F T G Y H U J K O L P ;`
play, <kbd>Z</kbd>/<kbd>X</kbd> change octave.

## Learn bound the wrong signal

Learn binds the first signal that moves by 5% of its range, or the first pulse
of any kind. The simulated performer and the drum machine send pulses all the
time. Untick *simulate performance*, stop the drum machine, then click *learn*
again. Remove the wrong route with ✕ in **L2 · Mapping**.

## The timeline no longer moves a param

A touched slider or a mapped signal *overrides* the param, and overrides are
sticky: the score yields to the human. Clear it with ✕ next to the param (or
`show.params.clearOverride(key)`; `clearAllOverrides()` for all). A *smoothed*
route keeps writing after its signal arrived, even when muted; remove the route
to give the param back to the timeline. See
[Overrides and the timeline](mapping.md#overrides-and-the-timeline).

## I changed a route in code and nothing changed

The mapper saved yesterday's routes in `localStorage`, and a saved
`source → target` pair wins over the declared one (new pairs are still added).
Clear the profile, or pass `profile: false` while you develop:

```js
localStorage.removeItem('openav.map.<world name>');
```

## A route to sound/cutoff only moves between 0 and 1

`outMin`/`outMax` default to the target's range when the route is added, and in
`createShow()` declared routes are added before the sound engine registers its
`sound/*` params. Give the range explicitly:
`{ source: 'midi/cc/74', target: 'sound/cutoff', outMin: 100, outMax: 8000 }`.

## The camera or microphone does not start

- The page must be a secure context: `http://localhost` or `https://`. A LAN
  address over plain `http://` (`http://192.168.1.20:8080`) is blocked.
- The 🎤 mic, 🖐 hands and 🕺 body buttons must be clicked; nothing starts on its
  own. A button that reads *✗ retry* failed: the reason is in the browser's devtools console.
- On macOS, the browser itself needs camera and microphone access in System
  Settings → Privacy & Security.
- Hands and body load MediaPipe and its model from jsDelivr and Google's storage
  the first time. Offline, they cannot start.

## There is no sound

Browsers start audio only after a click. Press **🔊 enable sound** in the
*L4 · Output — sound* panel. The Tone.js engine is loaded from jsDelivr at that
moment, so the first time needs a network connection. The drum machine's kit
starts on the first hit after you tick *drum machine*.

## The phone's tilt and knocks do nothing on an iPhone

iOS only gives motion sensors to `https://` pages, and only after a tap on
開始 (start). Over plain `http://` on the LAN, touch, keys and the control
surface still work. Reach `serve.js` through an HTTPS tunnel for sensors. If the
permission was denied once, iOS keeps saying no until you change it in
Settings → Safari → Motion & Orientation Access, then reload.

## After a deploy, the site still runs old code

GitHub Pages lets browsers cache JavaScript for hours while HTML expires in
minutes, so a visitor can get new HTML with old modules. Before deploying, run
`node tools/stamp-version.mjs`: it appends `?v=<commit>` to module URLs in the
examples, packages and homepage. Locally this never happens: `serve.js` sends
`Cache-Control: no-store`.

## The show slows down when the window is in the background

Browsers pause `requestAnimationFrame` in hidden tabs. The `Loop` then keeps
running from a Web Worker at about 15 frames per second, so the timeline, mapped
signals and the backstage feed continue, but rendering is slower. Keep the
projection window visible, on its own screen, in fullscreen (<kbd>F</kbd>).

## An example from a CDN works online but not offline

p5 (examples 05, 06), Tone.js (sound), MediaPipe (hands, body) and the WebToe app
(example 04) come from the network. For an offline venue, download them and
point the script tags, the import map or the module options (`toneEngine({ cdn })`,
`webtoeWorld({ app })`) at local copies.

## The port is already in use

`node serve.js 8081` serves on another port, and the OSC bridge takes one too:
`node packages/osc/bridges/osc-bridge.js 7470` (then `new OscOut('http://127.0.0.1:7470')`).
The backstage monitor is the exception: a `createShow()` page always streams to
port 7457 on its own host, so free that port. Only a hand-assembled show can
point elsewhere, with `new MonitorFeed({ url: 'ws://host:7460' })` and
`node packages/monitor/server.js 7460`.
