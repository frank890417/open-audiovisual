# Projection and video out

The stage on a projector, a second screen, OBS or TouchDesigner. `@openav/output` (since 0.12.0) opens an output window
that shows the stage, bends it so a projector that is not square to the wall still lands as a rectangle (corner-pin),
crops one canvas for several projectors side by side, and gives each output a blackout and a brightness that are params.
Any show also has a clean address, `?output`: the same page with the stage alone on black, for a kiosk browser, OBS's
Browser Source or TouchDesigner's Web Render TOP. The world never knows any of this happened. Example
[29, Projector output](https://openaudiovisual.com/examples/29-projector-output/) runs all of it on one screen.

## The output window

Declare the outputs once, at load, and open one from a click (a browser opens a window only after a gesture):

```js
import { createShow } from '@openav/show';
import { createOutputs } from '@openav/output';      // in the import map: "@openav/output": "../../packages/output/index.js"

const show = await createShow({ world });
const outputs = createOutputs(show, { outputs: [{ name: 'main' }], aspect: 16 / 9 });
button.onclick = () => outputs.open('main');
```

`createOutputs` adds the params `output/main/blackout` and `output/main/brightness` at once, boxes the stage on this page to
16:9 (centred, black around it) so the world draws the shape the projector has, and puts an **L4 · Output** panel on the desk:
per output **Open** (a mirror window), **Page** (a second page, below), **Edit** and **Grid**, whether it is open and how large,
and **Export layout**, **Import layout** and **Lead**. `openOutput(show, { name })` does the same for one output without the
declaration (its params appear when it opens).

The window is black, has no console, and hides the cursor after two seconds. Its keys:

| key | what it does |
|---|---|
| F | fullscreen (again: leave it) |
| E | edit the corners (below); E or Esc again when done |
| G | the test pattern: a grid, a crosshair, circles, the four edges in colour (top red, right green, bottom blue, left yellow) |
| B | blackout on or off: it writes the param `output/<name>/blackout`, so the desk shows it and ✕ clears it |
| I | the help card |

These keys belong to the output window. The show's own keys (Space, the arrows, R) do not see them, and the output window's
keys never move the show.

### Mirror or page

There are two ways to fill an output, and a world needs neither to know.

| | mirror (default) | page |
|---|---|---|
| how | the stage's canvas, `canvas.captureStream()`, into a `<video>` in a window this page opens | this page again at its clean address, `?output=<name>&follow=oav-output`, as a [sync](show-control.md#several-pages-one-show) follower |
| what you see | exactly what the stage shows: every slider, note, random particle | the same world drawn again: the same clock and the same held values (sliders, MIDI knobs, blackout), not signals, not randomness, not anything integrated over `dt` |
| resolution | the stage canvas's size on the operator's page | the output window's own size, its own GPU work |
| timing | about a frame behind (not measured on a projector) | follows the clock: its own measure of the error (`timeline.followStatus().error`) stayed under 3 ms over a BroadcastChannel and under 8 ms over the relay to another browser, on one machine; across machines add a network trip |
| machines | the same machine, the same browser | any page of the same origin; another browser or machine over `node serve.js`'s relay |
| when the show page reloads | the window keeps its last picture: open it again from the page (it comes back in the same window) | the page keeps running alone on the last rate until the leader returns |
| when the show page is hidden | it slows to the Loop's hidden-tab rate: on one screen, a fullscreen output over the show page hides it | not affected |
| a DOM or SVG world | cannot be mirrored (the window says so) | works |

Mirror is the default because it is the one that is always right about the picture: one render, and a performer who plays
sees what the audience sees. Measured in headless Chromium 151 (software rendering): the video has the canvas's exact size, and
the centres of eight flat colour blocks read back exactly as drawn. Fine detail (where a stream with less colour resolution
would show) and a GPU-backed Chrome were not measured. Page is the one for a second machine, for an output larger than the operator's
canvas, or for a world that is not a canvas. `outputs.open('main', { mode: 'page' })`, or the **Page** button.

## Fullscreen on the projector

On one screen the output is just a window: press F in it. With a projector or a second screen, drag the window onto it and
press F. Where the browser has the Window Management API (`window.getScreenDetails`, Chromium) and the computer reports more
than one screen, the window's card also offers **Find the screens…**: the browser asks once whether this site may place
windows on all your screens, then lists them (`label · width×height`), and a click on one goes fullscreen on that screen with
`requestFullscreen({ screen })`. The permission is only ever asked from a click inside the output window, never on its own,
and when it was granted before, the screens are listed without asking. When it is refused, or the API is not there (Safari,
Firefox), the card says what always works: drag the window, press F.
([MDN: Window Management API](https://developer.mozilla.org/en-US/docs/Web/API/Window_Management_API/Using),
[Element.requestFullscreen](https://developer.mozilla.org/en-US/docs/Web/API/Element/requestFullscreen): fullscreen needs a
user gesture, which is why every fullscreen here is a key or a click in the output window itself.)

## Corner pin

A projector that is not square to the wall throws a trapezoid. Press E in the output window and drag its four numbered
handles onto the corners of the screen (or of the wall area you want): the picture bends so that it lands as a rectangle.
Pick a corner with 1 to 4 (or Tab) and move it with the arrows, 1 px at a time, Shift for 10 px. Turn the test pattern on (G)
while you do it: its grid shows straight lines and even cells when the corners are right.

| key (editing) | |
|---|---|
| drag a handle, or 1–4 / Tab and the arrows | move a corner (Shift ×10) |
| H, V | mirror left–right (rear projection), top–bottom (a projector hung upside down that cannot flip itself) |
| O, Shift+O | turn the picture 90° clockwise, back (a projector on its side) |
| [ ] | a black border, 0.5 % of each side at a time, up to 45 % (overscan: bring back edges that fall off the screen) |
| R, Shift+R | the corners back to the window's; everything back |

Four points decide one projective transform (a homography). `cornerPin(corners, width, height)` computes it and
`toMatrix3d()` writes it as a CSS `matrix3d(…)`, so the browser bends the whole output, picture and test pattern together,
on the GPU, with nothing redrawn. A quad no projector can throw (a corner pushed inside, two edges crossed, three corners on
a line) is refused: the corner stays where it was. A soft edge (`soft`, from 0 to 0.5) fades the picture's edges to black
over that share of each side; it is a fade, not edge blending.

### The layout file

Every change is saved in this browser under `oav-output:<name>`, so the venue's setup survives a reload, and a clean page of
the same name in the same browser uses it too. **Export layout** writes every output's room to a file you can carry to the next
rehearsal, and **Import layout** checks one, saves it and applies it to open windows:

```json
{ "format": "open-audiovisual/output@1",
  "saved": "2026-12-01T09:30:00.000Z",
  "outputs": {
    "main": { "corners": [[0.02, 0.01], [0.97, 0.03], [0.99, 0.98], [0.01, 0.96]],
              "flipX": false, "flipY": false, "rotate": 0, "overscan": 0, "soft": 0 } } }
```

The file is the room, the code is the show: it holds what the venue did to each output (corners as 0..1 of the output window,
flips, turn, border, soft edge), never what the output shows. Crops live in the code. `parseOutputLayout()` refuses a file with
one message that lists every problem (`outputs.main.rotate: must be 0, 90, 180 or 270`), so a file is fixed in one go.

## Blackout and brightness

Rule 1: what is performed goes through params. Each output has two, declared before any window opens:

| param | range | |
|---|---|---|
| `output/<name>/blackout` | 0 or 1 | 1: this output is black, whatever it shows |
| `output/<name>/brightness` | 0 to 1, default 1 | a black veil over the picture (`1 - brightness` of it); not the projector's lamp |

So the console's sliders, a MIDI fader, the timeline and a phone all reach the projector the same way they reach the world.
Example 29 fades the projector out over the last 8 seconds of its timeline and gives it to any controller's volume fader:

```js
timeline: { total: 48, automation: { 'output/main/brightness': [[0, 1], [40, 1], [48, 0]] } },
routes: [{ source: 'midi/cc/7', target: 'output/main/brightness' }],
```

## Two projectors from one canvas

One wide canvas, two projectors side by side: declare two outputs, each with its crop of the stage (`{ x, y, w, h }`, 0 to 1),
and give the stage the shape of both together.

```js
const outputs = createOutputs(show, {
  outputs: [{ name: 'left', crop: { x: 0, y: 0, w: 0.5, h: 1 } }, { name: 'right', crop: { x: 0.5, y: 0, w: 0.5, h: 1 } }],
  aspect: 32 / 9,                 // two 16:9 projectors
});
```

Each output has its own corners, its own params and its own window (open each from its own click: a browser opens one window
per gesture). `fit` says how a crop fills its window when the shapes differ: `contain` (default, black bars), `cover` (filled,
cut) or `stretch`. Example 29 does this with `?pair`. Where the two pictures meet there is a hard seam: edge blending (two
projectors overlapping with a matched soft ramp and brightness) is not part of this package.

## The clean address

Every page built with `createShow()` becomes a clean output when its address says so. The desk, the piano, the hints, the MIDI
button, the phone card, the example guide, and anything a show marks with the class `oav-operator`, are not shown, and the
desk's keys are off. The stage fills the window on black, with the corners this browser saved for that output name and the
same keys as an output window (E, G, F, B, I). The world's artwork credit stays: an attribution is never hidden.

| key | example | |
|---|---|---|
| `output` | `?output`, `?output=front` | this page is a clean output, called `main` or `front` |
| `crop` | `&crop=0,0,0.5,1` | x, y, w, h of the stage, 0 to 1; without it, the crop the code declares for that name |
| `aspect` | `&aspect=32:9` | the stage's shape; without it, the code's `aspect` |
| `fit` | `&fit=cover` | `contain` (default), `cover`, `stretch` |
| `follow` | `&follow=oav-output` | follow the show page's clock and held values; no input of its own |
| `via` | `&via=relay`, `&via=ws://10.0.0.5:8080/relay` | follow over this server's `/relay` (another browser or machine) instead of a BroadcastChannel |
| `play` | `&play` | start the timeline on load: nobody can press Space inside OBS or TouchDesigner |

`outputs.url('main', { follow: 'oav-output', via: true })` writes the address for you, and so does **Lead** on the panel.
For a page to follow, the show page has to lead: **Lead** on the panel, `outputs.lead()` in code, or example 29 opened with
`?lead`. Across browsers (OBS and TouchDesigner each run their own) or machines that needs the relay: run `node serve.js`
on the show machine and use `via=relay`.

A clean page that does not follow runs the show by itself: its timeline plays only with `&play`, and its inputs are whatever
the show declares, with nobody at them. A clean page that follows takes no input (keyboard piano, MIDI, microphone, camera,
phones are off) and shows what the show page's clock and held values say; a note played on the show page does not reach it.
To carry live playing exactly, mirror (above) or capture the show page's window (OBS, below).

## Recipe: a plain projector

What was checked: the output window, its keys, the corner-pin, the layout surviving a reload, the clean address, in headless
Chromium 151 on one machine. Not yet: a real projector, a second physical screen, and the screen picker's permission prompt.

1. Run the show from this machine: `node serve.js`, then open `http://localhost:8080/examples/29-projector-output/` (or your show) in Chrome.
2. Connect the projector and set the computer to extend the desktop onto it (not mirror the display).
3. Click **Open output window**. Drag the window onto the projector and press F in it (or **Find the screens…** and click the projector).
4. Press G, then E. Drag the four corners onto the screen's corners until the grid's cells look even. Press E to finish.
5. Press G again to see the show. The layout is saved: a reload, and the window opened again, land in the same place.
6. **Export layout** and keep the file with the show: the next rehearsal in this room imports it.
7. Before the audience comes in: try B (blackout) and its fader, and the end of the timeline.

For a machine that only shows the picture (a kiosk), open the clean address in Chrome's kiosk mode. `--kiosk` is
"Enable kiosk mode" (not Chrome OS kiosk mode), `--autoplay-policy=no-user-gesture-required` lets the page's sound start without
a click, and `--user-data-dir` is the folder where the browser keeps all of its state, so a folder of its own keeps the kiosk's
saved corners and permissions apart from your everyday profile:

```bash
# macOS; the Chrome path differs on Windows and Linux. To be confirmed on the venue machine.
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --kiosk --autoplay-policy=no-user-gesture-required \
  --user-data-dir="$HOME/oav-kiosk" "http://localhost:8080/examples/29-projector-output/?output&play"
```

The switches come from the Chromium switch list ([peter.sh](https://peter.sh/experiments/chromium-command-line-switches/)) and the
autoplay flag from [Chrome's autoplay policy](https://developer.chrome.com/blog/autoplay) ("Muted autoplay is always allowed"; the
flag lifts the gesture rule for sound). A kiosk window opens on the screen Chrome chooses: which one, and whether `--start-fullscreen`
or `--window-position` move it to the projector, is to be confirmed on the venue machine. Corners for a kiosk profile are set in that
profile: open the clean address there once without `--kiosk`, press E, or import the layout file on a normal page of that profile.

The venue checklist, beyond the [pre-show checklist](show-control.md#pre-show-checklist):

- [ ] the display is extended, the projector's own keystone is off or at zero (correct in one place only), its resolution is native
- [ ] the computer does not sleep, dim or show notifications; the projector's own sleep is off
- [ ] the show runs from this machine (`node serve.js`), not from the internet: no network needed during the show
- [ ] the layout file exported, and tried on a reload
- [ ] blackout tested from the desk, from its fader, and with B in the output window
- [ ] what happens when the show page reloads: open the output again (mirror), or nothing to do (page)
- [ ] a kiosk iPad or a phone as a remote: see [Phones](remote.md); on a closed network, the relay of this machine

## Recipe: TouchDesigner

What was checked: the parameter names below, from Derivative's Web Render TOP page
([docs.derivative.ca/Web_Render_TOP](https://docs.derivative.ca/Web_Render_TOP), and the same page in the offline help of
TouchDesigner 2025.33230); the clean address in headless Chromium. Not run in TouchDesigner: every step here is to be confirmed in
the app. TouchDesigner 2025.33230 ships Chromium Embedded Framework 132.3.1 with Chromium 132.0.6834.83 (read from the installed
app); the Info DAT of a Web Render TOP reports the versions it runs.

1. On the show machine run `node serve.js` and open the show page with a leader on the relay: example 29 at
   `http://localhost:8080/examples/29-projector-output/?lead` (or **Lead** on the desk, or `outputs.lead()` with `via: true`).
2. In TouchDesigner add a **Web Render TOP**. On its Web Render page set **URL or File** to the clean address that follows:
   `http://localhost:8080/examples/29-projector-output/?output&follow=oav-output&via=relay`. Keep **Active** on.
3. On its Common page set **Output Resolution** to **Custom Resolution** and **Resolution** to the size you need (1920 × 1080).
   The page draws at that size: with `?output` the stage fills it.
4. **Audio Options**: leave it **Off** for the picture alone (the show's sound stays on the show machine), or route it to
   **Audio Web Render CHOPs** to have it in TouchDesigner. Changing it restarts the browser process (the docs say so).
5. **Maximum Render Frame Rate**: the page's frame rate in TouchDesigner (the docs: it can be set above 60, without a guarantee).
   **Cook Always** keeps it cooking every frame.

What does not work inside it, as far as the framework can tell:

- **Web MIDI.** Derivative's page does not mention it. Whether `navigator.requestMIDIAccess` exists or prompts in the Web Render
  TOP is to be confirmed; with `&follow` the page does not ask for MIDI at all (a follower's input is off). Bring MIDI into
  TouchDesigner itself, or play it on the show page.
- **Camera and microphone.** The Web Render TOP has **Enable Media Stream** ("Allows the web render instance to use the mic and the
  camera"). Whether a permission prompt appears, and whether it can be answered, is to be confirmed. A follower page asks for neither.
- **Clicks and keys.** Nothing is clicked in there: the corners saved in your own Chrome do not exist in TouchDesigner's browser (it
  keeps its own storage, **User Cache Directory**, by default a temporary one). Correct the picture in TouchDesigner instead: the
  **Corner Pin TOP** moves the corner points of an image ([Corner Pin TOP](https://docs.derivative.ca/Corner_Pin_TOP)), and the
  palette has **stoner** for mapping. Start the timeline from the show page (or add `&play` to a page that does not follow).
- **Popups.** A page's popups are ignored, or followed in place with **Redirect Popups**: an output window cannot be opened from there.

The other direction already exists: the show's signals as OSC into TouchDesigner, through the bridge
([OSC output](show-control.md#osc-output), [TouchDesigner as the receiver](show-control.md#touchdesigner-as-the-receiver)).
Picture by Web Render TOP and control by OSC can run side by side.

## Recipe: OBS

What was checked: the property and button names below, from the installed OBS Studio 33.0.2 (its own English and Traditional
Chinese labels) and from OBS's pages on the [Browser Source](https://obsproject.com/kb/browser-source) and the
[virtual camera](https://obsproject.com/kb/virtual-camera-guide); NDI from [DistroAV](https://github.com/DistroAV/DistroAV).
Not run in OBS: every step here is to be confirmed in the app. OBS 33.0.2 ships Chromium 150.0.7871.287 for its browser source
(read from the installed app). DistroAV is not installed on the machine this was written on.

**Browser Source.** On the show machine run `node serve.js` and open the show page as the leader
(`…/29-projector-output/?lead`). In OBS add a source **Browser**:

1. **URL**: `http://localhost:8080/examples/29-projector-output/?output&follow=oav-output&via=relay`.
2. **Width** and **Height**: the size of the picture, 1920 × 1080 (OBS's defaults are 800 × 600). With `?output` the stage fills it.
3. **Use custom frame rate** and **FPS**: 60 for a 60 fps canvas (OBS's default is 30).
4. **Control audio via OBS**: the switch for the page's sound in OBS. What it does with a show is to be confirmed: a show's sound
   starts on a click, and a follower page makes none of its own, so for the picture alone it does not matter.
5. **Custom CSS**: OBS's default makes the background transparent; the clean page paints its own black, so leave it.
6. **Shutdown source when not visible**: off, so the page keeps following while another scene is on air.

**Out of OBS.** **Start Virtual Camera** (Controls dock) gives OBS's program, a scene or a source as a camera to Zoom, a browser or
TouchDesigner (the gear next to it chooses which). For NDI, the DistroAV plugin (OBS 31.1.1 or newer, NDI Runtime 6.3 or newer;
on macOS `brew install --cask distroav/tap/distroav`) adds an **NDI Output** for the program and an **NDI Filter** for one
source. Where they sit in OBS's menus is to be confirmed with the plugin installed.

**Window capture instead.** To send exactly what the performer plays (notes, particles, the mirror), capture the window rather than
load the page again: **macOS Screen Capture** (or **Window Capture**), pointed at the output window. The output window has no
console and hides its cursor, so the capture is clean; keep it on a screen (a hidden window may not be drawn), and crop with the
source's **Crop** if needed.

## What was checked

Headless Chromium 151 (Playwright 1.62), one machine, `node serve.js`, no permissions granted (no MIDI, serial, camera,
microphone or window management):

- example 29 loads with no console errors (the `ws://…7457` monitor warning is expected), its stage boxed to 16:9
- **Open output window** opens the window; the video has the canvas's exact size and its frames advance; the centres of eight flat
  colour blocks read back as drawn. A mirror of example 06 (a p5.js WEBGL canvas) shows its picture too: the world needed nothing
- E shows four handles; dragging two corners and nudging a third with the keys changes the window's `matrix3d` and saves exactly
  those corners; G shows the test pattern; B writes `output/main/blackout` and the veil goes black; brightness 0.4 from the desk
  gives a veil of 0.6; the output window's keys never moved the show
- after a reload of the show page, the output opens again in the same window with the same corners, and plays
- **Page** opens the clean address as a follower over a BroadcastChannel; a page in a second, separate browser context at
  `?output&follow=oav-output&via=relay` follows example 29 opened with `?lead` over `node serve.js`'s relay. Both hold the show page's
  blackout and a slider it moved, and their own measure of the error (`timeline.followStatus().error`) stayed under 3 ms and under
  8 ms over a second
- the clean address shows no desk, piano, hint, guide or operator button, and uses the saved corners; `?pair&output=left` draws the
  32:9 stage at twice the window's width and shows its left half
- every example built with `createShow()` (01 to 09, 12 to 14, 27 to 29) still starts with no console errors, and 01, 05, 06, 07, 13
  and 14 at `?output` show the stage alone filling the window, with no errors, the artwork credit of 05, 06 and 07 still on it

Not checked: a real projector, a second physical screen, the Window Management permission prompt and fullscreen on a chosen
screen, a browser's popup blocker (the test browser runs without one; a window opens from a click by the browsers' rule),
Chrome's kiosk mode, TouchDesigner, OBS, NDI.
