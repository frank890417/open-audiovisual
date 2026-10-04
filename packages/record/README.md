# @openav/record

L4 output (video branch) · the performance video. The work and the performer's camera are
composited into **one canvas of an exact size** (vertical 1080×1920, 4:5, 2.7K, 4K, landscape,
square), recorded together with **the work's own sound** by one `MediaRecorder`. Picture and sound
enter the same recorder, which timestamps both from one clock, so they are in sync by
construction: there is nothing to line up afterwards. Beside the video: the work's sound as its
own file, an event log of everything that was played, and **MIDI takes**: record what you play,
play it back into the show, save it as `.mid`.

```js
import { Compositor, AudioTap, Recorder, EventLog, openCamera, recommendedFps } from '@openav/record';

const comp = new Compositor({ size: 'vertical-1080p', layout: 'stack', getWorkCanvas: () => workCanvas });
comp.start();                                         // redraws every frame; show comp.canvas scaled with CSS
await comp.setCamera(await openCamera());             // ideal 1920×1080

const tap = new AudioTap({ context: audioContext, sources: [workOutputNode] });   // from a click
const video = new Recorder({ canvas: comp.canvas, fps: recommendedFps(1080, 1920), audioTracks: tap.tracks });
const sound = new Recorder({ audioOnly: true, audioTracks: tap.workTracks });
const log = new EventLog({ throttleMs: 33 });

video.start({ timeslice: 1000 }); sound.start(); log.start(video.t0); log.attach(signals);
// … perform …
const [v, a] = await Promise.all([video.stop(), sound.stop()]); log.stop();
// v.blob: video/mp4 (H.264 + AAC) 1080×1920 @ 60 fps · a.blob: audio/mp4 (.m4a) · log.toJSON()
```

[`examples/10-record`](../../examples/10-record/) is all of it on one page: a small world on top,
the webcam below, size and layout pickers, record, and the three downloads, plus MIDI takes.

## The controller instead of the camera

The camera's area can show a **panel** instead: anything with `draw(ctx, rect, now)`. `@openav/midi`'s
`ControllerCanvas` draws the controller being played (Arturia MiniLab 3 or any profile) from the
generic MIDI signals on the bus: keys, pads, knobs, faders and strips as they move, the device's
screen showing the last touch, the held notes written large under it. It is vector, drawn at the
output size (a 4K frame gets a 2160 px wide panel, not an enlarged one), and costs well under a
millisecond of script a frame. A take played back by a `TakePlayer` publishes the same signals, so a
replayed clip animates the panel exactly as the hands did.

```js
import { ControllerCanvas } from '@openav/midi';

const panel = new ControllerCanvas({ profile: 'arturia-minilab3', signals });
comp.setPanel(panel);          // stack: the work on top, the MiniLab below · pip: a corner of the panel's shape
comp.setPanel(null);           // the camera again (it stayed attached)
panel.dispose();               // the host disposes the panel, not the compositor
```

[`examples/11-controller-video`](../../examples/11-controller-video/): a work above a MiniLab 3, a demo
take, any profile, Web MIDI hardware, record.

## Layouts

| layout | what goes where | for |
|---|---|---|
| `stack` | the work across the full width at the top (a square for a 1:1 work), the camera fills the rest below, cover-cropped. If the frame is too short to leave the camera 20 % of the height (square, landscape), the work gets 60 % and is letterboxed in it | vertical: Reels, Shorts, TikTok |
| `pip` | the work fills the frame (letterboxed), the camera is a rounded inset in a corner (`pip.corner` `br`·`bl`·`tr`·`tl`, `pip.size` = its width as a share of the frame) | square, or a work that needs all of the frame |
| `side` | the work at full height on the left, the camera fills the right | landscape |
| `work` | the work alone | |

1080×1920 + a square work + `stack` = a 1080×1080 work and a 1080×840 camera strip, no seam. The
camera's area is reserved before the camera arrives, so the frame never jumps. `layoutOptions`:
`fit` (`contain` · `cover`, for the work), `camFit` (`cover` · `contain`), `camAnchor` (`{ x, y }` 0..1,
which part a cover-crop keeps, in what you see), `minCam` (0.2), `split` (0.6), `pip`.

## Sizes, frame rates, cameras

| preset id | size | fps |
|---|---|---|
| `vertical-1080p` · `vertical-4x5` | 1080×1920 · 1440×1800 | 60 |
| `vertical-2.7k` · `vertical-4k` | 1520×2704 · 2160×3840 | 30 |
| `landscape-1080p` · `landscape-16x10` | 1920×1080 · 1920×1200 | 60 |
| `landscape-2.7k` · `landscape-4k` | 2704×1520 · 3840×2160 | 30 |
| `square-1080` · `square-2048` · `square-2160` | 1080 · 2048 · 2160 square | 60 · 30 · 30 |

60 fps up to about 1080×1920 (2.6 megapixels), 30 for 2.7K and 4K: a 4K canvas at 60 means
500 Mpx/s through the compositor and the encoder, which drops frames on a laptop in the middle of a
performance. Bitrate defaults to `recommendedBitrate()`, 0.12 bit per pixel per frame (1080×1920@60
≈ 15 Mb/s, 4K@30 ≈ 30 Mb/s): a master to edit, not a stream.

Webcams usually stop at 1080p30, so a 4K `stack` enlarges the camera about 1.6×; the work above it
stays sharp because it is drawn at the output size. Keep the work's canvas at least as large as its
area (a 1080 px work in a 2160 px frame is enlarged too).

## The work's sound: `AudioTap`

`AudioTap` mixes everything into **one** track, because Chrome's `MediaRecorder` records only the
first audio track of a stream. Two outputs: `tap.stream` / `tap.tracks` = the work + extras (the
microphone) for the video; `tap.workStream` / `tap.workTracks` = the work alone for the sound file.
The tap never routes anything to the speakers, so adding a microphone cannot feed back.

- `add(source, { bus, gain })`: an `AudioNode` of the tap's context, a node of another context
  (bridged through a MediaStream), a `MediaStream` or a `MediaStreamTrack`. `bus: 'extra'` reaches
  the video only.
- `captureDestination()`: from now on, every node that connects to a speaker destination is
  tapped too (a hook on `AudioNode.prototype.connect`): the way to record a sketch you did not
  write (p5.sound, Tone.js, `@openav/sound`). Install it before the work starts its sound.
- `addMicrophone({ deviceId })`: echo cancellation, noise suppression and AGC are off, because
  they eat piano attacks.

## MIDI takes

A take is what an `EventLog` filtered to `midi/*` records, as plain JSON:

```json
{ "v": 1, "name": "take-1", "createdAt": "2026-10-04T15:42:00.000Z", "durationMs": 8400,
  "events": [{ "t": 250, "name": "midi/note/on", "value": { "note": 60, "vel": 0.62, "ch": 1 } }],
  "meta": { "bpm": 96, "device": "minilab3", "notes": "warm-up" } }
```

```js
import { TakeRecorder, TakePlayer, toMidiFile, fromMidiFile, trimSilence } from '@openav/record';

const rec = new TakeRecorder({ signals });          // every midi/* signal, timed from start()
rec.start();
// … play …
const take = trimSilence(rec.stop(), { keep: 250 });   // keys still held are released in the take

const player = new TakePlayer({ signals, take, loop: true, yieldToLive: true, resumeAfter: 8 });
player.play();     // the work, its sound and its chord detector cannot tell the take from you
// play a key yourself → the take falls silent; 8 s after you stop, it comes back

const mid = toMidiFile(take);                       // Uint8Array, type 0: opens in any DAW
const again = fromMidiFile(await file.arrayBuffer());
```

- **Faithful**: the events are the signals as published, so a hardware take holds both naming
  families (`midi/note/on` and `midi/ch/1/note/60`) and device names; playback publishes all of them.
  Conversions to MIDI pick one family, so nothing doubles. Channel 10 stays the drums.
- **No stuck notes**: the player tracks every key it pressed, in the spelling it pressed it
  (`midi/note/*`, `midi/ch/*`, `midi/<device>/note/*`, raw `midi/virtual` bytes), and the sustain
  pedal; pause, stop, seek and every loop wrap release them.
- **Timing**: `clock: 'raf'` (default in a page), `'timer'` (10 ms, tighter for sound) or `'manual'`
  (call `update(dt)` from your loop, or `tick()`). A gap longer than `maxStepMs` (a frozen tab)
  slows the take instead of firing a burst of notes.
- **Live wins** with `yieldToLive`: a key-down the player did not send (hardware, the on-screen piano,
  a phone) pauses the take and releases its notes. Knobs do not count; pass `isLive(name, value)`
  to change that. A `TakeRecorder` ignores playback unless `overdub: true`.
- Signals: `take/playing` (0/1) and `take/position` (0..1).

## Exports

| export | signature |
|---|---|
| `Compositor` | `new Compositor({ size = 'vertical-1080p', layout = 'stack', layoutOptions, getWorkCanvas, background = '#000', mirrorCam = true, maxFps = 60, onDraw(ctx, rects, comp), canvas })` · `start()` · `stop()` · `draw()` → rects · `setSize(size)` · `setLayout(layout, options)` · `setCamera(MediaStream \| video \| canvas \| null)` → `Promise<{w, h} \| null>` · `setPanel({ draw(ctx, rect, now), aspect } \| null)` (drawn in the camera's area) · `drawOnCamera(fn(ctx, w, h))` · `dispose()` · `canvas`, `size`, `rects`, `video`, `cameraSize`, `panel`, `fps` |
| `Recorder` | `new Recorder({ canvas, stream, fps = 60, audioTracks = [], audioOnly = false, videoBitsPerSecond, audioBitsPerSecond = 192000, mimeType, prefer })` · `start({ timeslice = 1000, ondata(blob, seq), keep })` · `stop()` → `Promise<{ mimeType, ext, bytes, chunks, durationMs, width, height, fps, audio, blob, error }>` · `t0`, `state`, `elapsed`, `bytes` · `Recorder.supported` |
| `AudioTap` | `new AudioTap({ context, sources = [], captureDestination = false })` · `add(source, { bus = 'work', gain = 1 })` → remove · `captureDestination()` → uninstall · `addMicrophone({ deviceId, gain })` · `removeMicrophone()` · `level()` → 0..1 · `resume()` · `dispose()` · `stream`, `tracks`, `workStream`, `workTracks`, `context` |
| `EventLog` | `new EventLog({ now, filter(name, value, meta), throttleMs = 0 })` · `start(at)` · `stop(at)` · `add(name, value, { at, pulse })` · `mark(label, data)` · `attach(signals)` → detach · `detach()` · `between(a, b)` · `toJSON()` · `toTake({ name, meta })` · `EventLog.fromJSON(json)` · `events`, `running`, `durationMs` |
| `TakeRecorder` | `new TakeRecorder({ signals, filter = /^midi\//, name, meta, overdub = false, throttleMs, now })` (an `EventLog`) · `start(at)` · `stop(at)` → take |
| `TakePlayer` | `new TakePlayer({ signals, take, loop = true, speed = 1, yieldToLive = false, resumeAfter = 0, isLive, chase = true, clock, maxStepMs = 250, onEvent, onState, now })` · `load(take)` · `play({ from })` → boolean · `pause()` · `stop()` · `seek(ms)` · `update(dt)` · `tick(now)` · `dispose()` · `position`, `duration`, `progress`, `state`, `playing`, `loops` |
| layout | `layoutRects(layout, { w, h }, { workW, workH, camW, camH }, opts)` → `{ work, cam }` (rects `{ x, y, w, h, crop, frame, box }`, `cam.radius`) · `framePoint(rects.cam, u, v)` · `LAYOUTS` · `PRESETS` · `presetById(id)` · `resolveSize(size)` · `recommendedFps(w, h)` · `recommendedBitrate(w, h, fps)` |
| file types | `pickMime(isTypeSupported, { audioOnly, prefer, candidates })` · `extFor(mime)` · `VIDEO_MIMES` · `AUDIO_MIMES` |
| takes | `normalizeTake(take)` · `validateTake(take)` → problems · `trimSilence(take, { keep })` · `quantizeTake(take, { bpm, grid = 4, strength = 1 })` · `takeStats(take)` · `midiEventsOf(take)` · `signalsOfMidi(ev, { families })` · `noteOf(ev)` · `noteOffFor(note)` · `toMidiFile(take, { ppq = 960, bpm })` → `Uint8Array` · `fromMidiFile(bytes, { name, families = 'both' })` → take |
| cameras | `openCamera({ deviceId, width = 1920, height = 1080, fps = 30 })` → `MediaStream` · `listCameras()` · `listMicrophones()` · `cameraConstraints(opts)` · `mixTracks(tracks)` |

File types: MP4 (H.264 + AAC) first, then WebM (VP9 or VP8 + Opus). Chrome 154 accepts
`video/mp4;codecs=avc1.640033,mp4a.40.2` but not the generic `avc1,mp4a`, so both are in the list.
A WebM from Chrome has no duration in its header; players cope, editors may want
`ffmpeg -i in.webm -c copy out.webm`.

A WebGL work: the compositor copies its canvas in the same animation frame it was drawn in, which
works in Chrome; if you see black, create the context with `preserveDrawingBuffer: true` or call
`comp.draw()` right after your render (and do not `start()` the compositor).

Hand skeleton over the camera: `HandTracker` from `@openav/pose` with the same `mirror` as the
compositor, drawn from `onDraw`: `(ctx, rects, comp) => comp.drawOnCamera((g, w, h) => hands.skeleton(g, w, h))`.

## In the lab

`package.json` → `"lab"` builds the module `record`; its wire only exposes the kits,
`lab.recordKit` and `lab.takes`. The lab host decides when to record, where to save, and when a
preview plays a take.

Full reference: [docs](https://openaudiovisual.com/docs/#packages-openav-record)
