# With Strudel

[Strudel](https://strudel.cc) is a live-coding environment for music in the browser, a JavaScript version of
[TidalCycles](https://tidalcycles.org). OAV is a separate program. The two run side by side the way two programs on a
stage do: Strudel plays, and OAV brings what Strudel does not have — knobs on screen and on a phone, a microphone that
is analysed, Web MIDI where the browser has none — and draws what Strudel plays in a p5.js sketch, on the same page or
in another tab or on another computer. They meet through MIDI (OAV's virtual port, "OAV Virtual MIDI") and through
the page's own variables (`knob1`, `micLevel`, `drumPhase`). OAV never loads or calls any of Strudel's code.

Everything on this page was run on strudel.cc as a user runs it (its editor, Ctrl+Enter, its documented functions):
`p5/test/strudel-smoke.cjs` does it again.

## Load OAV in Strudel

Strudel → **settings** → **prebake**, add one line at the end, **save**:

```js
await import('https://openaudiovisual.com/p5/oav-p5.js')
```

- **Single quotes.** Strudel reads text in double quotes (and backticks) as mini-notation: a URL in double quotes is a
  `[mini] parse error`.
- **Why the prebake.** It runs before your code, also after a reload (about 2.5 s after the editor appears), so OAV is
  on the page before anything opens MIDI. If Strudel's `midin()` ran before OAV loaded, `midin('OAV Virtual MIDI')` gets
  nothing and says nothing: reload. 🩺 then shows "no program has asked OAV Virtual MIDI for MIDI".
- The line can also be the first line of your code. Options go on the line before it:
  `window.OAV_P5 = { link: 'my-room' }`.
- Strudel's **share** button puts the prebake into the link (with "share with patterns" ticked): whoever opens it gets
  OAV too.

On strudel.cc OAV changes its manners. It does not ask for MIDI when it loads (`hardware=click`: Strudel's `midin()`
asks). The 🎹 panel is a box in the corner, a third of the window high, so the code stays in view. One card says which
names Strudel already has — `note`, `velocity`, `beat` are Strudel's functions, OAV leaves them alone — and what to
read instead: `OAVp5.last.note`, `OAVp5.last.value`, `OAVp5.mic.on('beat', fn)`. `knob1`, `micLevel`, `drumPhase`
and the rest are free names there.

## Recipe 1: knobs, a phone and the microphone as Strudel's parameters

Strudel's `signal()` turns a function into a parameter; OAV's names are plain values a function can return.

```js
s("bd*4").gain(signal(() => knob1))
s("hh*8").lpf(signal(() => 300 + micLevel * 8000))
```

- `knob1` moves with knob 1 of the 🎹 on screen, of a MIDI controller, or of a phone (🎹 → 📱, scan the code).
  `knob(2)`, `fader1`, `pad1` are there too. Measured: knob 1 at 0, the kick is silent; at 127, it is heard (RMS 0.58).
- Strudel reads the value when it schedules, 0.2–0.3 s before the sound: a knob is heard that much later.
- `micLevel`, `bass`, `mid`, `treble` are OAV's analysis of the microphone (Strudel has none); reading one asks for the
  microphone. Wear headphones: the microphone hears the speakers, and `gain(signal(() => micLevel))` feeds back.
- Strudel's own MIDI input works on OAV's port too, also in Safari (no Web MIDI there; OAV's port is virtual):

```js
const cc = await midin('OAV Virtual MIDI')
s("bd*4").gain(cc(74))
```

Knob 1 of the on-screen MiniLab 3 is CC 74. `midikeys('OAV Virtual MIDI')` makes the 🎹 keys and the phone Strudel's
keyboard.

## Recipe 2: Strudel plays, a p5 sketch draws

**On the same page.** Send to OAV's port:

```js
note("c3 [e3 g3] <a3 b3> c4").midi('OAV Virtual MIDI')
```

Strudel hands each note over 0.21–0.32 s early with the moment it should sound; OAV waits for that moment and then
calls `notePressed(note, velocity)` (in Strudel, with no sketch: `OAVp5.on('notePressed', fn)`), moves `knob1` for a CC,
plays a pad. Measured: within 5 ms of Strudel's timestamps (median 0.1 ms). What arrives on the port is never handed
back to OAV's input, so `midikeys('OAV Virtual MIDI')` played into `.midi('OAV Virtual MIDI')` is one echo, not a loop.

**Strudel's clock.** MIDI counts 24 clocks a beat, so a cycle of one 4-beat bar sends 96:

```js
setcps(128 / 60 / 4)
$: s("bd*4, [~ sd]*2, hh*8")
$: midicmd("clock*96, <start stop>/8").midi('OAV Virtual MIDI')
```

`drumPhase`, `beatPhase`, `drumBar`, `drumStep` and `drumBpm` follow it. A drum machine started with `startDrums()`
plays at Strudel's tempo, on Strudel's downbeat, and starts and stops with it (the card says "following an external
clock · 128 BPM"). Measured at 128 bpm: `drumPhase` within 1.2 ms of Strudel's bar (median 0.04 ms), every kick within
6 ms of Strudel's beat (three runs); Strudel's start, which arrives three times with one timestamp, counts once. Without a clock
nothing changes; `clock=off` ignores one.

**In another tab, or on another computer.** Give both pages the same room. In Strudel's prebake:

```js
window.OAV_P5 = { link: 'my-room' }
await import('https://openaudiovisual.com/p5/oav-p5.js')
```

and in the p5 sketch (OpenProcessing: before the one line; or `?sketch_oav_link=my-room` on the page's address):

```js
window.OAV_P5 = { link: 'my-room' };
document.head.prepend(Object.assign(document.createElement('script'), { src: 'https://openaudiovisual.com/p5/oav-p5.js' }));
```

Everything Strudel sends to OAV's port — notes, CCs, the clock — reaches every other OAV page in the room, through the
same relay the phones use. 🎹 grows a 🔗: green when another page is there; the panel says the room, the pages and the
trip. The receiving page plays each note when Strudel plays it, not when it arrives: it lines the two clocks up from the
fastest trips it has seen and the round trips both pages measure (packages/relay/link.js explains how), and Strudel's
quarter-second head start covers the trip. Measured with two tabs on one Mac over wss://remote.cheyuwu.com (one way
≈ 61 ms): notes within −3 … +7 ms of Strudel's timestamps (two runs). Across two computers add the difference between the
two halves of a round trip (usually a few ms). Keep the default relay (`wss://`): Chrome does not let strudel.cc reach a
relay on your own machine or network (`ws://127.0.0.1…` is blocked by its local-network checks). On a network whose jitter is longer than Strudel's head start, `linkdelay=` (ms)
buffers more. A page never sends on what it received, and a program that plays a linked note back out is caught as an
echo. The room is the phones' room too: one QR code plays every page in it.

The sketch side, ready to run: `p5/examples/with-strudel/` (?room=… on its address).

## Recipe 3: Strudel, Hydra and OAV on one page

With OAV in the prebake:

```js
await initHydra()
osc(10, 0.1, () => knob1 * 2).rotate(() => drumPhase * 6.28).color(1, () => micLevel, 0.6).out()
setcps(120 / 60 / 4)
$: s("bd*4, [~ sd]*2, hh*8").gain(signal(() => 0.3 + knob1))
$: midicmd("clock*96").midi('OAV Virtual MIDI')
```

Hydra turns once a bar on Strudel's clock (through `drumPhase`), knob 1 drives Hydra and Strudel at once, and the
microphone colours the picture.

## Options for Strudel

Set before the line (`window.OAV_P5 = { … }`), or `?oav_key=value` on a p5 page's address.

| key | values | default |
|---|---|---|
| `link` | a room name (letters, digits, `-`, `_`): pages in it hear each other's programs | none |
| `linkdelay` | milliseconds of extra buffer on a linked page's notes | `0` |
| `clock` | `follow` (an external MIDI clock moves `drumPhase` and the drums) · `off` | `follow` |
| `strudel` | `auto` (strudel.cc, or Strudel's functions already on the page) · `on` · `off` | `auto` |
| `compact` | `on` (the panel as a box in the corner) · `off` | `on` in Strudel |
| `hardware` | `auto` · `click` · `off` | `click` in Strudel |

## Credits and licences

Strudel is © its contributors (begun by Felix Roos and Alex McLean), free software under the GNU Affero General
Public License v3: [strudel.cc](https://strudel.cc), source at [codeberg.org/uzu/strudel](https://codeberg.org/uzu/strudel).
TidalCycles, whose way of writing patterns Strudel carries to the browser, is Alex McLean's. Music you make with Strudel is
yours (Strudel's FAQ).

OAV is MIT-licensed and a separate program. It contains no Strudel code, does not load `@strudel/*` at run time and calls
none of Strudel's functions: it only looks at the page's address and at which names the page already has, to choose its
manners. The two meet the way two programs on a stage meet, over MIDI. OAV's own rhythm strings (`startDrums("bd*4,
hh*8")`, @openav/pattern) are an independent implementation of the TidalCycles / Strudel way of writing rhythm, from their
public documentation. Please do not ask Strudel's community for help with OAV: OAV's issues are on
[GitHub](https://github.com/frank890417/open-audiovisual/issues).
