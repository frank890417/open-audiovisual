# Show control

The parts that turn a sketch into a performance: the one-call assembly, the
timeline, the console, performance mode, the backstage monitor, and the ways
sound and data leave the browser.

## createShow

`createShow()` (`@openav/show`) builds a whole show around a world and returns
every part. It is `async` because it waits for the world's `init`.

```js
import { createShow } from '@openav/show';

const show = await createShow({
  world: myWorld,
  timeline: { total: 120, automation: { hue: [[0, 205], [60, 320]] }, scenes },
  routes: [{ source: 'audio/rms', target: 'energy', inMax: 0.3, smooth: 0.1 }],
  modules: { keys: { base: 48 }, chord: true, audio: true, sound: true },
  artwork: { title: 'Untitled', artist: 'You', year: 2026 },
  hint: 'play the piano · Space plays the timeline',
});
```

| option | default | meaning |
|---|---|---|
| `world` | `null` | the world to perform; it is activated first |
| `worlds` | `[]` | more worlds to register (switch with `show.stage.activate(name)`) |
| `timeline` | `{ total: 120 }` | `{ total, automation, scenes }` for the [timeline](#timeline) |
| `routes` | `[]` | routes to add to the mapper ([Mapping](mapping.md)) |
| `modules` | `{}` | inputs and outputs to switch on (below) |
| `artwork` | `null` | `{ title, artist, year, note }`: a credit line on the stage and a `<meta name="artwork">` |
| `hint` | `''` | a line of HTML at the bottom left of the stage |
| `map` | `?map=` in the page address | a map file to load on start: a same-origin or https URL; `false` ignores `?map=` ([Map files](mapping.md#map-files-export-import-and-share)) |
| `profile` | the world's name | the mapper's saved-profile name; `false` = ignore saved routes ([Saved profiles](mapping.md#saved-profiles)) |
| `onFrame` | `null` | `(dt, show) => {}` every frame, before the timeline advances |
| `mount` | generated | `{ stage, side }` elements or selectors to render into, instead of a full-page layout |
| `telemetry` | `true` | one anonymous `oav_show_start` hit per page (see the controllers chapter, Telemetry); `false` sends nothing |
| `score` | `null` | `{ cuts, cut, modules, api, midi, … }`: the show's structure as segment lengths, performed by segment modules; `?cut=<id>` in the URL picks the version ([Score & Director](score.md#use-it-with-createshow)) |
| `loop` | `'auto'` | who drives the frames: `'auto'` (the page's `requestAnimationFrame`), `'manual'` (you call `show.loop.step(dt)`) or `{ clock, raf, maxDt, heartbeat }`, the options of `new Loop()` ([below](#driving-the-frames-yourself)) |
| `monitor` | `true` | the [backstage feed](#backstage-monitor): `false` = none (no socket is opened), `{ url, hz }` = another relay address or rate |
| `console` | `null` | the options of [the console](#the-console), `mountConsole`'s: `{ keys, layers, signals, learnOrder }`; `keys` moves the keyboard shortcuts |
| `sync` | `null` | several pages, one show: `{ role: 'leader' \| 'follower', channel, url, input, extra, state, follow }`. One page leads, the others follow its clock, and a follower takes no input of its own ([below](#several-pages-one-show)) |

Without `mount`, the page body becomes a two-column grid: the stage, and a
340 px side panel with the piano and the console.

| `modules` key | values | what it adds |
|---|---|---|
| `midi` | on by default; `false` | the `Midi` engine (input and output) |
| `midi.controllers` | `true` or `{ profile, profiles, open }` | an on-screen MIDI controller docked on the stage, a 🎹 button and the <kbd>M</kbd> key; `?profile=<id>` in the URL picks the device ([controllers](controllers.md)) |
| `keys` | on by default; `false`; `{ base, octaves, sim, capture }` | the on-screen piano, QWERTY and the simulated performer |
| `drums` | `true`; `{ engine, autoEnableEngine }` | the drum machine |
| `audio` | any truthy value | the microphone analyzer (starts from 🎤 mic) |
| `chord` | `true`; `{ window }` | chord analysis of every played note |
| `hands` | `true` | the hand tracker (starts from 🖐 hands) |
| `pose` | `true` | the body tracker (starts from 🕺 body) |
| `remote` | `true`; `{ room, auto, surface, feedbackHz, url }` | phones and iPads as controllers ([Phones](remote.md#the-show-side)) |
| `sound` | `true`; an instrument id (`'piano'`); `{ instrument, remember, picker, engine, baseUrl }` | instruments in the page with a picker, Tone.js ([Sound](#sound)) |

It returns `{ signals, params, stage, timeline, mapper, midi, controllers,
midiPanel, keys, drums, sound, audio, hands, pose, chord, remote, score, director,
sync, monitor, console, app, loop }`; parts you did not ask for are `null`. The same object is
`window.openav`, for the devtools console. The frame order is in
[Architecture](architecture.md#the-frame-loop).

### Driving the frames yourself

By default a show runs on the page's `requestAnimationFrame` (with a Web Worker heartbeat for a hidden tab). `loop` changes who supplies the frames, so a show can be recorded one exact frame at a time, tested as a whole, or run for a night with no window in front of it, without replacing the page's global `requestAnimationFrame` or `performance.now`.

```js
// 'manual': nothing runs until you say so. Thirty show seconds, the same thirty every time.
const show = await createShow({ world, loop: 'manual', monitor: false });
show.timeline.play();
for (let i = 0; i < 60 * 30; i++) show.loop.step(1 / 60);

// your own clock and frame pump (a test, a recorder): the show runs on whatever these say
const frames = [];
let now = 0;
const driven = await createShow({ world, loop: { clock: () => now, raf: (cb) => frames.push(cb) } });
now += 1000 / 60;
frames.splice(0).forEach((cb) => cb(now));              // one frame
```

- `'auto'` (or leave `loop` out) is the behaviour a show always had.
- `'manual'` schedules nothing. `show.loop.step(dt)` runs one whole frame (the [frame order](architecture.md#the-frame-loop)) of `dt` seconds. `dt` is not clamped to 0.1 s (you chose it), `0` redraws in place, and a negative or non-number `dt` runs nothing and returns `false`. The time `onFrame` and `show.loop.fps` see is virtual, the sum of the `dt` stepped, so two runs with the same steps are the same run. Nothing is drawn until the first step, and the timeline moves only while it is playing (`show.timeline.play()`).
- `{ clock, raf }` keep the loop automatic but take its time from you. `clock()` returns milliseconds; `raf(cb)` asks for one callback on the next frame, and `cb(now)` may be handed the timestamp (without one, `clock()` is read). The Worker heartbeat is off, because a real timer must not step a fake clock; `heartbeat: true` turns it back on. `maxDt` still clamps these frames.

Only the frame loop is yours. `Date.now`, `setTimeout`, the mapper's auto-save, Web MIDI and the audio engine keep real time, and the backstage feed throttles itself by the wall clock, so a recording pairs `loop: 'manual'` with `monitor: false`. A show you assemble by hand does the same with `new Loop(fn, { manual: true })` ([`@openav/core`](packages.md#openav-core)).

## Timeline

```js
const timeline = new Timeline({
  params,
  total: 2400,                       // seconds (default 600 when used directly; createShow uses 120)
  automation: {
    growth: [[0, 0.2], [300, 1.0, 'ease'], [1200, 0.4, 'out']],   // [t, value, curve?] keyframes; no curve = linear
    mode:   [[0, 0], [600, 1], [1800, 2]],          // step params hold (no interp)
  },
  scenes: [
    { id: 'standby', t: -30, title: 'Standby', note: 'house lights · breathe' },
    { id: 'act1',    t: 0,   title: 'Act I',   note: 'single seeds only' },
    { id: 'act2',    t: 600, title: 'Act II',  note: 'full harmony' },
  ],
});
timeline.onSceneChange((i, scene) => { /* fire cues: sound, lights, OSC */ });
```

- negative scene times = pre-show standby (the clock shows -0:30)
- `jumpScene(±1)` (← → keys) is your emergency navigation — rehearse with it
- `timeline.rate` exists for rehearsal speed-through (`rate = 4`)
- playback stops by itself at `total`
- a scene with `hold: true` stops playback at its end until it is released (Space, →): see [Hold](score.md#hold)
- `loop: true` wraps the show at `total` and plays on; `loop: 'scene'` repeats the scene the playhead is in until you move on: see [Curves, loop, cues, recording](#curves-loop-cues-recording)
- `reset()` goes to `start` (default 0, so a pre-show standby scene at −30 is reached with the scrubber; pass `start: -30`, or `start: 'first'` for "the first scene", to make R return to it)
- with `score` the scenes, total and start come from a [score](score.md); then automation is read at `score.baseTime(t)`, so a cut derived with `scale: 0.5` stretches it. Curves can also be written per segment, so they survive a cut with other lengths: see [Lanes](#lanes-curves-written-per-segment)

| member | what it does |
|---|---|
| `play()`, `pause()`, `toggle()` | transport. At a hold, `play()` and `toggle()` release it |
| `seek(t)` | jump to `t` seconds (clamped between the first scene's negative time, or 0, and `total`) |
| `jumpScene(d)` | go to the start of the scene `d` steps away |
| `next()`, `prev()` | → and ←: `next()` releases a hold (and plays on), otherwise it is `jumpScene(1)` |
| `release()` | let a hold go: the next scene starts and playback continues. `false` when nothing was holding |
| `reset()` | stop, clear a hold and rewind to `start` (default 0) |
| `advance(dt)` | per frame; moves `t` by `dt × rate` while playing |
| `state(t)`, `valueAt(key, t)` | the automation values at a time (no overrides) |
| `sceneIndexAt(t)`, `currentScene(t)`, `sceneEnd(i)` | scene lookup |
| `onSceneChange(cb)` | `cb(index, scene, { cause })` whenever playback or a seek lands in a different scene; `cause` is `'play'`, `'release'`, `'seek'`, `'jump'`, `'reset'` or `'loop'` |
| `onCue(cb)`, `cues()`, `fireCue(cue)` | scene cues fired by playback, the list of them, and the manual trigger |
| `loop`, `onLoop(cb)`, `loopRange()`, `loops` | wrap the show, a scene or a range |
| `record(key, source)`, `stopRecording()`, `onRecord(cb)`, `mergeTake(key, take)` | write a value source into a lane |
| `onSeek(cb)` | `cb(t, kind)` when the playhead is moved by hand (`'seek'`, `'jump'`, `'reset'`), never while playing |
| `lanePos(t)`, `laneTime(id, p)`, `lanePlan()`, `lanes()` | automation seconds ↔ (segment id, progress `p`), the segment table, and the automation written per segment |
| `exportAutomation(opts)`, `importAutomation(doc, opts)` | the automation as plain JSON, in seconds or per segment, and back |
| `anchor(epoch, opts)`, `unanchor()`, `drift()`, `onDrift(cb)` | read the wall clock: count how far behind it the show runs, warn, catch up, start on schedule |
| `layer` | `(key, value, t) => value`: rewrite a param before overrides (the director's `param()` plugs in here) |
| `t`, `playing`, `holding`, `rate`, `total`, `start`, `scenes`, `automation`, `score` | state you can read (and set) |

### Curves, loop, cues, recording

**Curves.** A keyframe is `[t, value, curve?]`. The third item says how the segment that *ends* at that keyframe gets
there: `'linear'` (the default: leave it out and you get what the timeline always did), `'ease'` (slow, fast, slow),
`'in'` (starts slow), `'out'` (starts fast), `'step'` (hold the old value until the keyframe, then jump), or your own
function of 0..1. `CURVES` is exported. A param with `step` still holds, whatever the curve says.

```js
automation: { speed: [[0, 0.3], [16, 1.6, 'in'], [20, 3.4, 'step'], [30, 0.8, 'out']] }
```

**Loop.** `loop: true` wraps at `total` (back to 0) and keeps playing; `'scene'` repeats the scene the playhead is in
(`next()` moves the loop on to the next scene); a scene id loops that scene; `{ from, to }` loops a range in seconds or
scene ids. It is a property: `timeline.loop = !timeline.loop` is the whole L key. `onLoop(cb)` tells you each lap, and a
loop that wraps into another scene is an `onSceneChange` with `cause: 'loop'`. A `hold` inside the range still holds.

**Cues.** `scene.cues` is `[{ name, t }]` (the console scrubber already draws them as ticks). `onCue((cue, { cause }) => …)`
fires one when *playback* passes it, once, and never when you seek, jump, drag the scrubber or reset: a scrub is not a
performance. Each lap of a loop fires them again. `fireCue(cue)` sets one off by hand. With a [score](score.md) the director
fires its own cues; use `onCue` on plain timelines.

```js
show.timeline.onCue((cue) => show.params.firePulse(cue.name));   // scenes: [{ …, cues: [{ name: 'flash', t: 20 }] }]
```

**Recording.** `record(key, source)` arms a lane. While the timeline plays, `source()` is read every frame: a number is
written into a take, `null` means nobody is touching and closes it.

```js
timeline.record('hue', () => params.isOverridden('hue') ? params.overrides.hue : null);
timeline.onRecord(({ key }) => params.clearOverride(key));      // the curve takes over again
```

A take also closes on pause, seek, reset, a hold, the end of the show and the end of each loop lap, while the recorder
stays armed until `stop()` / `stopRecording()`. The merge rule (`mergeTake()`): the take is thinned (a point stays when
it moved more than 0.6 % of the param's range, or 0.5 s passed), and it **replaces the keyframes inside its time span**.
Keyframes outside stay, so the lane glides from the previous keyframe to the take's first point, and from its last point
to the next keyframe. Existing curves outside the take are untouched. With a score the keyframes are written in the base
cut's time, like the ones you declared.

A cue list is just a scene-change handler:

```js
show.timeline.onSceneChange((i, scene) => {
  if (scene.id === 'storm') show.stage.activate('storm');   // switch worlds
  show.midi?.cc(20, i, 16);                                  // tell the lighting desk
});
```

### Lanes: curves written per segment

With a [score](score.md) the show is a list of segments whose lengths change, and a curve written in absolute seconds
goes stale the moment one of them grows. Write the curve on the segment instead. The automation of a key may be an
object: its keys are segment ids, its values are keyframes `[p, value, curve?]` with `p` the progress through the
segment, 0 to 1.

```js
const show = await createShow({
  world,
  score: { cuts, cut: 'full' },
  timeline: { automation: {
    haze: { dawn: [[0, 0.1], [1, 0.4, 'ease']],                  // dawn: 0.1 → 0.4, slow-fast-slow
            noon: [[0, 0.4], [0.6, 0.9], [1, 0.5, 'out']],
            dusk: 0.5 },                                           // a number holds the whole segment
    speed: [[0, 0.3], [30, 1.2], [120, 0.4]],                      // absolute seconds still work, in the same object
  } },
});
```

A point `[p, v, curve]` is exactly the keyframe `[segment.start + p × segment.dur, v, curve]`, nothing more: the
timeline compiles every lane when it is built, and `timeline.automation` holds ordinary absolute keyframes, so
`valueAt`, recording, `mergeTake` and the console behave as before. The desk's [Curves panel](#the-curves-panel) draws
the lanes across the whole show with the segment ids behind them.

- **Any cut.** The lane is compiled against the *root cut* of the score (the cut a derived cut came from). A cut with
  other lengths reads the same lane with its own lengths, so `(dawn, 0.5)` is half way through dawn in every cut, and
  a derived cut (`from` + `scale`) is stretched like absolute keyframes. Two cuts that differ in structure, not only in
  length, can share one lane.
- **Seams.** Between the last point of a segment and the first point of the next, the value glides like between any two
  keyframes (the arriving point's curve applies). For a seamless seam write the same value at `p: 1` and at the next
  segment's `p: 0`. Two points at the same instant with different values are a jump.
- **Segments a cut lacks.** An id that another cut of the score has but this one does not is skipped, so one lane serves
  a cut with a segment fewer. An id that no cut has (a typo) throws, naming the key and the id; so does a `p` outside
  0…1 or out of order, naming the key, the segment and the point.
- **Without a score** the scenes are the segments: a scene lasts until the next one starts.

### Saving and loading automation

`record()` writes a take into `timeline.automation`, in memory. To keep it, export it as plain JSON and import it later,
into this timeline or another:

```js
const doc = timeline.exportAutomation({ as: 'segments' });           // lanes per segment: still right on another cut
localStorage.setItem('automation', JSON.stringify(doc));
// later:
timeline.importAutomation(localStorage.getItem('automation'));        // a string or the object
```

```json
{ "format": "openav-automation", "version": 1, "cut": "full", "as": "segments",
  "automation": { "haze": { "dawn": [[0, 0.1], [1, 0.4, "ease"]], "noon": [[0, 0.4], [1, 0.5]] } } }
```

`exportAutomation({ keys, as, precision })` returns a copy. `as: 'seconds'` (the default) writes each key as the keyframes
in the root cut's seconds; `as: 'segments'` writes each key as a lane, with `p` rounded to `precision` decimals (9; `null` keeps
every digit). The two are inverses: the lanes compile back to the same curve. A keyframe outside the show has no segment,
so it can only be exported as seconds, and a curve that is a function cannot be written to JSON at all: both throw, naming
the key. `cut` is the id of the root cut.

`importAutomation(doc, { keys, replace, ignoreCut })` takes the file, or a bare `{ key: keyframes | lane }` map. It replaces
the keys the file has (`keys` narrows them; `replace: true` also clears the ones it does not mention). It is all-or-nothing: if
one key is bad, nothing changes. Seconds belong to the cut they were written against, so a file whose `cut` is not this
timeline's root cut is refused (`ignoreCut: true` overrides); lanes are not tied to a cut.

The conversion behind it is public. `lanePos(t)` answers `{ id, index, p }` for a second (`null` outside the show; a boundary
belongs to the segment that starts there), `laneTime(id, p)` answers the second, `lanePlan()` is the segment table, and `lanes()`
is the whole automation written per segment. They work in *automation seconds*, the ones in `timeline.automation` and in
`onRecord`'s `from`/`to`. For the playhead's own show seconds use the score: `score.locate(T)` and `score.timeAt(id, p)`
([Score](score.md#the-score)). The pure functions `compileLane`, `decompileLane`, `lanePos` and `laneTime` are exported too, for
tools that have a segment table `[{ id, start, end }]` (`score.rootSegments`) and no timeline.

### Wall clock: anchor and drift

The frame loop clamps `dt` to 0.1 s ([Architecture](architecture.md#the-frame-loop)). When the page stalls for half a second,
the show moves 0.1 s and falls 0.4 s behind the wall clock. On a short show nobody notices; on a night-long installation
nobody is there to see how much it has lost. `anchor()` makes the timeline read the wall clock (`Date.now`, in milliseconds) on
every frame it plays and compare how long the clock ran with how far the show moved. Nothing happens unless you call it: an
unanchored timeline never reads a clock.

```js
timeline.anchor();                                                       // count only (mode 'warn')
timeline.anchor(Date.parse('2026-10-24T20:00:00+08:00'), { mode: 'catch-up' });   // start at 20:00 sharp, and stay on the clock
timeline.drift().text;   // "0.42 s behind the wall clock · 7 stalls cost 1.30 s (worst gap 0.52 s) · caught up 0.88 s"
createShow({ world, timeline: { total: 120, anchor: { mode: 'catch-up', jump: 5 } } });   // the same, from the options
```

`anchor(epoch?, opts)`: `epoch` is the wall-clock moment of show time 0, as milliseconds, a `Date` or an ISO string. Leave it out
and the first playing frame is time 0: there is nothing to be late for, only the stalls from then on count.

| option | default | meaning |
|---|---|---|
| `mode` | `'warn'` | `'warn'` counts and tells, and never moves `t`. `'catch-up'` gives back what was lost, and waits when it runs ahead |
| `warnAt` | 1 | seconds behind at which `onDrift` hears `'behind'` (and `console.warn` if nobody listens); it hears `'recovered'` below half of it |
| `tolerance` | 0.05 | `'catch-up'`: owing less than this is not repaid |
| `jump` | 10 | `'catch-up'`: owing more than this is closed by one seek (no cues fire, the way a seek never fires them), not by racing on |
| `wait` | true | `'catch-up'`: an `epoch` in the future keeps the show standing still, playing but not moving, until then |
| `stall` | 0.02 | a frame whose wall time exceeds `dt` by more than this counts as a stall (counting only) |
| `now` | `Date.now` | the clock, in milliseconds; pass the same fake clock you give a test or a manual loop |
| `onDrift` | none | `cb({ kind, …drift() })` for `'behind'`, `'recovered'` and `'jump'`; `timeline.onDrift(cb)` adds more |

What `'catch-up'` does: the difference is added to that frame's step, so cues, holds and loops behave as in normal playback
(a hold still stops the show). An `epoch` in the past is a late start: a machine restarted at 20:07 for a show that began at 20:00
lands seven minutes in. A pause, a hold and the end of the show are the show standing still on purpose, so they are not drift:
whatever was owed at that moment is forgiven (`forgiven`) and counting resumes from where the show stands. Running ahead
of the wall clock (a negative `behind`) is only reported in `'warn'`; `'catch-up'` holds the show back for it (`held`): it waits for the
clock and never runs backwards, which also cancels the extra 0.1 s frame the loop's heartbeat adds right after a stall.
`reset()` starts the counting over; an `epoch` still in the future survives it.

`drift()` answers `null` when there is no anchor, otherwise `behind` (seconds slower than the wall clock; negative = ahead),
`lost` (what the clamp, or any stall, cost), `repaid`, `held`, `forgiven`, `stalls`, `worst` (the longest wall-clock gap between two
frames), `frames`, `jumps`, `started`, `waiting`, `startsIn`, `epoch`, `mode`, and `text`, one line for the desk or the monitor.
If you drive the timeline from a manual or test loop, give `anchor()` the same fake clock as `now`, otherwise it measures real time.

### Following another clock: follow

A timeline can chase another timeline's clock instead of walking by itself. That is the timeline's half of [several pages performing one show](#several-pages-one-show): the leader runs, the followers follow. The source can be anything that answers "where is the leader?": the `@openav/sync` follower, a recording, a test's fake leader. Nothing happens unless you call `follow()`: a timeline that never follows runs exactly as it did before.

```js
timeline.follow(follower, { jump: 0.5, lostAfter: 4 });   // follower: anything with latest() (or a function () => frame)
timeline.followStatus().text;   // "0.012 s behind the leader · worst 0.140 s · 1 jump"
timeline.unfollow();            // the timeline walks by itself again, on the rate it had before follow()
```

`follow(source, opts)`. The source answers with the leader's last frame, `{ T, playing, holding, rate, at }`: `T` is the leader's time when it sent the frame, `at` is when the frame arrived here, in milliseconds on the same clock as `now` (leave it out and the frame counts as arriving this instant). It answers `null` before it has heard anyone. Every frame the follower works out where the leader is *now*: `T`, plus the time since `at` times `rate` (nothing is added while the leader is paused or holding), plus `latency`.

| option | default | meaning |
|---|---|---|
| `nudge` | 0.05 | while it catches up, `rate` is the leader's rate times 1 ± this: a follower 0.3 s behind closes the gap in about six seconds, and nobody sees a jump |
| `deadband` | 1/60 | a difference under one frame is left alone. Past it the nudge starts, and it stops at half of it, so it does not flutter on the edge |
| `jump` | 0.5 | a difference over this many seconds is one `seek(T, 'seek')`: `onSeek` hears it and no cue fires |
| `lostAfter` | 4 | seconds without a frame before the leader counts as gone; `Infinity` waits for ever |
| `latency` | 0 | seconds a frame spends on the way, a number or a function. Set it for pages on different machines (for example half the round trip) |
| `now` | `source.now`, else `performance.now` | the clock, in milliseconds; the one the source stamps `at` with |
| `onFollow` | none | `cb({ kind, …followStatus() })` for `'found'`, `'lost'` and `'jump'`; `timeline.onFollow(cb)` adds more |

What the follower copies from the leader: its **rate**, its **pause** (the follower stops on the leader's exact `T`) and its **hold**. When the leader parks at the end of a `hold` scene, the follower walks up to the boundary and parks there by itself (its own cues and scene changes fire on the way). It lets go only when the leader's `T` is past the boundary, so a late frame from just before it cannot release a follower that arrived first. A looping show is followed across the wrap of the loop, by the shorter way round. The leader is the clock: while following, the follower's own `play()`, `pause()`, `seek()` and `rate` are overruled by the next frame, and `anchor()` stands aside until `unfollow()`.

When no frame has come for `lostAfter` seconds the follower **runs by itself** on the last rate it was given, exactly like a timeline that does not follow (a paused follower stays paused). `followStatus().lost` turns true and `onFollow` hears `'lost'` (`console.warn` if nobody listens). When the leader is back, the follower picks it up again (`'found'`). Before it has heard anyone at all it waits (`state: 'waiting'`) and, after `lostAfter` seconds, runs on its own the same way.

`followStatus()` answers `null` when the timeline is not following, otherwise `state` (`'waiting'`, `'tracking'`, `'lost'`), `error` (the leader's `T` minus ours, in seconds; positive = we are behind), `worst` (the biggest `|error|` since it first caught up), `jumps` (seeks), `silence` (seconds since the last frame), `lost`, `lostCount`, `lostAfter`, `heard`, `frames`, `nudging` (-1, 0 or 1), `rate`, `leaderRate`, `leaderT`, `leaderPlaying`, `leaderHolding`, and `text`, one line for the desk or the monitor. The numbers are those of the last frame.

## The console

`mountConsole(el, app, { layers, signals, keys })` (`@openav/console`) builds the
director's desk; `createShow()` mounts it in the side panel. `app` is the object
`createShow()` returns as `show.app` (`timeline`, `params`, `mapper`, `signals`,
`stage`, `midi`, `sound`, `audio`, `hands`, `pose`, …); missing parts simply
hide their section. Pass `{ layers: false }` or `{ signals: false }` to leave out
those panels. It gives you transport + scrubber with scene blocks, the Layers
overview, L1 Input, L2 Mapping, L3 Params (sliders with override and learn
chips), L4 sound, live signal meters and a MIDI log.

Keyboard: **Space** play/pause (at a hold: release) · **→/←** next / previous scene (→ at a hold: release) · **R** reset · **T** performance
mode · **F** fullscreen · **M** the on-screen MIDI controller (`midi.controllers`) · **C** the [Curves panel](#the-curves-panel) · **Esc** leave keyboard-piano capture or stop the mapping wizard. Keys typed into an input field, held keys and ⌘/Ctrl/Alt combinations are ignored. While the on-screen piano captures the keyboard the *letters* belong to the piano (T and F are piano keys), so R, T, F and M do nothing until you untick it or press Esc; Space and the arrows always work.

### Moving the shortcuts

A show that plays the computer keyboard as a piano wants its letters. `keys` maps each action to a key (or a list of keys), laid over the defaults; `false` switches one action off, and `keys: false` switches every shortcut off.

```js
// the piano owns the letters: move the desk's R, T, F and M to keys it does not use
await createShow({
  world,
  modules: { keys: { capture: true }, midi: { controllers: true } },
  console: { keys: { reset: 'F6', perf: 'F7', fullscreen: 'F8', midi: 'F9' } },
});
```

| action | default | does |
|---|---|---|
| `play` | `Space` | play / pause (at a hold: release) |
| `next`, `prev` | `ArrowRight`, `ArrowLeft` | next / previous scene (`next` at a hold: release) |
| `reset` | `R` | back to the start; brings back switched-off segment modules |
| `perf` | `T` | performance mode |
| `fullscreen` | `F` | fullscreen |
| `midi` | `M` | the on-screen MIDI controller panel |
| `cancel` | `Escape` | stop the mapping wizard, or leave keyboard-piano capture |
| `curves` | `C` | open / close the [Curves panel](#the-curves-panel) (nothing happens while no param is automated) |

A key is a string. `'r'` is the character (either case); `'KeyR'` is the physical key whatever the keyboard layout types there (a Zhuyin layout types ㄐ); `'F6'`, `'Backquote'`, `'ArrowUp'`, `'Space'` are `KeyboardEvent.code` or key names, case does not matter. `'Shift+T'`, `'Ctrl+K'`, `'Alt+…'`, `'Meta+…'` add modifiers: without `Ctrl`, `Alt` or `Meta` in the spec those must not be held (⌘R and Ctrl+F stay the browser's), and a plain letter ignores Shift. Letters (a–z, `;`) stay dead while the piano captures the keyboard, wherever you put them; `F6`, `Backquote` and the like work through it. An unknown action name or a malformed key throws before anything is mounted. The hints on the desk (the play button's tooltip, the HOLD banner, the prompter) print the keys you chose; `desk.keys` (`show.console.keys`) holds them. With `mountConsole` by hand, the `midi` key toggles `app.midiPanel` when you pass one.

With a score the desk also has the Director panel, cue ticks on the scrubber and a prompter with the operator's acts ([Score & Director](score.md#the-desk)). The L2 Mapping panel has **🎛 map knobs in order**, a wizard that arms learn for each param in turn ([details](score.md#map-the-knobs-in-order)).

Override semantics: touch a slider (or a mapped control) and that param leaves
the timeline's hands until you clear it (✕). Yellow label = overridden. The [Curves panel](#the-curves-panel)
shows the same override on the param's curve and clears it with ↩.

### The curves panel

**Curves** shows what the timeline will do to every param, for the whole show at once. It is a panel on the desk,
collapsed at first: its header opens it, and so does **C**. There is one curve for each param that has automation, time
across (the same axis as the scrubber, a standby before 0 included) and the param's range up. Press or drag on a curve or
on the ruler to move the playhead, as on the scrubber. A show with nothing automated has no panel.

- **Segments.** The ruler names the segments (the score's, or the scenes of a plain timeline) and the curves have their
  boundaries behind them; a dashed gold line is where a `hold` waits. A band too narrow for its name keeps it for the
  hover tip. A derived cut shows the same curves over its own length, and a lane written per segment sits where its
  segment is.
- **The playhead.** A white column, and a ring on the curve where the show is now. The number in the head is the value
  the show is using this frame.
- **Overrides.** A param that a slider, a mapped knob or a phone has taken over is marked amber: a dot where it was taken
  to, a dashed line across the show, and **↩** in its head, which gives the param back to its curve (the same as ✕ on the
  Params panel). **↩ all** gives back every curve in the view. An override on a param with no curve is not in the view and
  stays as it is.
- **Recording.** The take that [`timeline.record`](#curves-loop-cues-recording) is writing into a lane is drawn in red
  while it plays, and the curve is redrawn when the take closes.
- **Cost.** Closed, it does nothing: it measures nothing, draws nothing and has not made a canvas. Open, each curve is
  drawn once, and again only when the automation, the cut or the width changes (an import, a take, an edited keyframe);
  every frame only the playhead and the overrides are redrawn. Rows scrolled out of the 264 px list are neither drawn nor
  cleared, so the drawing for fifty automated params is the drawing for about six.

It reads the timeline and the params and nothing else, so it works for any show without the work saying anything.

```js
const show = await createShow({
  world,
  console: { keys: { curves: 'F4' } },       // moves like any key; false switches it off, and the header still opens the panel
  // console: { curves: false }               leaves the panel out · { curves: { open: true } } starts it open
});
show.console.curves.toggle();                // .open · .info() → { keys, bands, axis, stats }
```

## Performance mode

**T** flips to a fullscreen teleprompter: current scene title + note in stage-
readable type, what the operator does (the scene's `acts`), next scene preview, clock + scene countdown, a HOLD banner while the show waits, and a warning when a segment module was switched off. This is for the
*performer*; the audience-facing window is your stage in fullscreen (**F**).
Two windows of the same page = one desk, one stage.

## Backstage monitor

```bash
node packages/monitor/server.js       # on the performance machine (npm run monitor)
# stage manager's phone/laptop: http://<performance-machine-ip>:7457/
```

Every show page made with `createShow()` streams snapshots to
`ws://<the page's host>:7457` about 15 times a second, so run the monitor
server on the machine that serves the show. Backstage shows clock, scene,
world, FPS, overrides, all signals and params live, and a red "stage feed
lost" banner if the stage stops sending for 4 s — which is exactly the moment a
stage manager earns their pay. Zero configuration, zero dependencies; both ends
reconnect by themselves. `GET /health` answers `{ ok, clients }`.

When no monitor is running, the show page keeps retrying with a growing delay
(about 5 s, growing to 30 s); the browser logs each refused connection. That message is
expected.

A machine that does not need a backstage, or a relay somewhere else, is an option of `createShow()`:

```js
await createShow({ world, monitor: false });                                  // no backstage feed, no socket
await createShow({ world, monitor: { url: 'wss://stage.example.com/monitor', hz: 10 } });   // another relay
```

`monitor: false` builds no feed (`show.monitor` is `null`) and the page never opens a socket. `{ url, hz }` goes to `MonitorFeed`: a `ws://` or `wss://` address (`null` makes a feed that never connects) and the snapshots per second (default 15). Behind TLS the relay needs a `wss://` address, and the relay itself still listens where you started it (`node packages/monitor/server.js 7460`).

For a hand-assembled show:

```js
import { MonitorFeed, snapshotOf } from '@openav/monitor';
const monitor = new MonitorFeed({ url: 'ws://192.168.1.20:7457', hz: 15 });   // both optional
monitor.connect();
// every frame:
monitor.frame(snapshotOf({ timeline, params, signals, stage, loop }, state));
```

### The work's own numbers

A work can put its own health numbers on the backstage page: the tick its simulation is on, how far it has
drifted from the wall clock, how many NaNs it has caught. They travel as `snapshot.extra` and appear in a
**Work** panel that stays hidden while nothing is sent. A show that sends nothing sends the same snapshot as before.

```js
// 1. from the world: snapshotOf asks the active world, so a createShow() show needs no wiring
const world = { name: 'lanterns', params: [/* … */], update() { /* … */ },
  monitor() { return { 'sim/tick': sim.tick, 'sim/drift': { v: sim.drift, min: 0, max: 0.5, warn: sim.drift > 0.2 } }; } };

// 2. from a hand-assembled show: on the feed (asked only when a frame is sent) …
const off = monitor.extra(() => ({ 'sim/nan': nanCount }));          // off() takes it away again
// … or in the snapshot itself (an object, or a function answering one)
monitor.frame(snapshotOf({ timeline, params, signals, stage, loop, extra: { build: 'rehearsal-2' } }, state));
```

A value is a number, a string (80 characters at most), a boolean or `null`. `{ v, min, max, warn }` draws a meter
(with `min` and `max`) and turns the row red (`warn: true`). A name is 48 characters at most and a snapshot carries
64 fields at most. What JSON cannot carry (`NaN`, a BigInt, a function, a nested object) is dropped or becomes `null`,
so one bad number never costs the frame, and a provider that throws is skipped. `monitor()` and a function `extra`
are asked every frame, `monitor.extra(fn)` only when a frame goes out (about 15 a second): keep anything
expensive there. On a name two sources share, `extra` beats the world and a later `monitor.extra` beats an earlier one.

## Several pages, one show

A wall of three outputs, a stage and a lobby, a rehearsal laptop beside the show laptop: one show, several pages. One page is the **leader**: it runs the timeline, takes the input, and says every frame where it is. The others are **followers**: their timelines chase the leader's `T` ([follow](#following-another-clock-follow)), so every page shows the same moment of the same show. Give every page the same code and a different `role`:

```js
const role = location.hash === '#follow' ? 'follower' : 'leader';
const show = await createShow({
  world, score: { cuts, modules },
  sync: { role, channel: 'hall' },               // pages of one browser on one machine: a BroadcastChannel, no network
  // sync: { role, channel: 'hall', url: 'ws://leader.local:8080/relay' },   // pages on other machines: the room relay
});
```

| `sync` key | default | meaning |
|---|---|---|
| `role` | required | `'leader'` or `'follower'` |
| `channel` | required | the name of the BroadcastChannel and of the relay room: 1–32 letters, digits, `-` or `_`. Pages on the same channel are one show |
| `url` | none | none: a `BroadcastChannel` (pages of one browser profile and one origin). `true`: this page's own `/relay` (`node serve.js` hosts it). `'ws://host:port/relay'`: the relay on that machine |
| `input` | leader `true`, follower `false` | whether this page takes input of its own. Without it the modules that make input are switched off: `keys` (the keyboard piano), `midi`, `drums`, `audio`, `hands`, `pose`, `leap`, `remote`. Everything else is yours |
| `follow` | `{}` | follower: the options of [`timeline.follow()`](#following-another-clock-follow) (`jump`, `lostAfter`, `latency`, `nudge`, `onFollow`) |
| `extra`, `state` | none | leader: data that travels with the clock (below) |
| `info`, `accept`, `onFrame`, `onState`, `onGap` | none | follower: hooks and checks (below) |
| `hz` | every frame | leader: at most this many frames a second; a change of state (play, pause, hold, rate, seek) is sent at once |
| `id`, `now` | random, `performance.now` | the peer id and the clock |

**Transports.** On one machine the pages talk through a `BroadcastChannel`: no network and nothing to run. The browser connects only pages of the same origin and profile, so open the leader and the followers from the same address. Across machines they join a room on the [room relay](remote.md#the-relay) as `role=leader` and `role=follower`; `node serve.js` on the leader's machine is enough (`url: 'ws://<that machine>:8080/relay'`). A page served over https needs a `wss://` address (the browser blocks `ws://` there). The relay has no authentication: use a closed network and a channel name nobody will guess ([Security](remote.md#security)). Both transports carry the same JSON, so a work does not change when the wire does.

**Messages.** The same on both transports; `seq` counts the leader's frames.

```text
{ v:1, kind:'frame', src, seq, T, playing, holding, rate, cut?, extra? }      leader → followers, every frame
{ v:1, kind:'hello', id, role:'follower', info?, reason? }                    follower → leader: "I am here, where are we?"
{ v:1, kind:'state', src, seq, to, T, playing, holding, rate, cut?, extra? }  leader → that follower
```

A follower says `hello` when it comes up, and again every second until it has a `state`, after a gap in `seq`, after a silence and whenever its socket reconnects. The leader answers with a `state`, so a page that joins in the middle, or reloads, is on the show's present at its first frame. `cut` is the score's cut id: a follower on another cut than the leader (another length, so `T` means something else) refuses its frames, and the monitor says `refused: cut …`.

**Carrying the work's data.** Whatever has to travel with the clock (an override the operator set, a note, a skipped intro) goes in `extra`. The framework delivers it once each and in order, and never reads it.

```js
sync: {
  role: 'leader', channel: 'hall',
  extra: () => ({ build: BUILD, events: takeNewEvents() }),   // asked once per frame sent; return undefined for "nothing"
  state: (hello) => ({ build: BUILD, tape: wholeTape }),       // asked when a follower says hello: all a late joiner needs
}
sync: {
  role: 'follower', channel: 'hall',
  onFrame: (msg) => appendEvents(msg.extra.events),            // every frame, in order, each one once
  onState: (msg) => loadTape(msg.extra.tape),                  // on joining, and again after anything went missing
  accept: (msg) => msg.extra?.build === BUILD || 'build differs',   // false or a string refuses this leader
  info: { build: BUILD },                                      // arrives with every hello
}
```

A frame that goes missing (a socket dropped for a moment) shows as a gap in `seq`: the follower tells `onGap`, asks for the state again, and the state replaces whatever was lost. The relay drops messages over 256 KB by default; a `state` that carries a whole tape needs `attachRelay(server, { maxMessageChars, maxBytes })`.

| what happens | what the follower does |
|---|---|
| it reloads, or joins late | `hello`, then `state`: on its first frame it is on the leader's `T` |
| a frame is lost, or the socket drops and returns | the gap in `seq` is reported and the state asked for again |
| the leader goes quiet | after `lostAfter` seconds (4) it runs by itself on the last rate; `followStatus().lost` and `sync/lost` in the monitor turn red |
| the leader returns, or another page is promoted by hand | a leader quiet for 1.5 s can be replaced by another one; the follower switches and resyncs |
| two leaders at once | it sticks to the first it heard; the other is counted as `ignored` |
| the leader is on another cut | refused, and nothing moves |
| the follower drifts | it cannot pile up: every frame is measured against the leader's `T`, not the follower's own clock |

**What this does not do.** Frames carry the leader's `T`, not a wall-clock time, and `latency` is yours to set: across machines a follower trails by about one trip unless told. There is no election: promoting a follower means loading it with `role: 'leader'` once the old leader is gone. The pages share *time*. A world that integrates `dt` (a feedback trail, a particle system) will not look the same on two pages at equal `T` unless what must match is written as a function of `T`. Backstage, a synced page adds `sync/…` numbers (role, error, silence, lost, jumps) to the monitor's Work panel.

Without `createShow`: `createSync({ role, channel, url, timeline })` from `@openav/sync` builds the same thing; call `sync.frame()` after `timeline.advance(dt)` every frame ([`@openav/sync`](packages.md#openav-sync)).

## OSC output

```bash
node packages/osc/bridges/osc-bridge.js 7456 192.168.1.50 3456
#                       http port ↑    target host ↑   udp port ↑
```

The defaults are `7456 127.0.0.1 3456`. The browser cannot send UDP, so
`OscOut` posts batches to the bridge over HTTP and the bridge sends them as OSC
packets.

```js
import { OscOut } from '@openav/osc';

const osc = new OscOut();          // http://127.0.0.1:7456
await osc.enable();                // probes /health, fails gracefully (false)
osc.send('/source/3/xyz', [x, y, z]);
osc.flush();                       // once per frame (batches, dedupes per address)
```

Numbers go out as OSC floats — what Spat, Reaper, and TouchDesigner expect;
anything else is sent as a string. Only the latest message per address survives
a frame. If the bridge disappears, `OscOut` reports it through `onStatus(ok,
info)` and stops trying after 30 failed flushes.

`createShow()` does not create an `OscOut`. Add one yourself (and add
`"@openav/osc": "../../packages/osc/index.js"` to the page's import map):

```js
const osc = new OscOut();
await osc.enable();
const show = await createShow({ world, onFrame: () => osc.flush() });
show.app.osc = osc;          // the Layers panel shows the OSC rate
show.stage.io.osc = osc;     // worlds can send from update(dt, state, io)
```

### TouchDesigner as the receiver

OSC goes to TouchDesigner as above. TouchDesigner can also show an open-audiovisual page as a picture with its Web Render TOP, which draws a web page inside TouchDesigner on the same machine ([Web Render TOP](https://docs.derivative.ca/Web_Render_TOP)). We have not checked whether the Web Render TOP supports Web MIDI or WebGPU. Keep the control on OSC.

If the page comes from openaudiovisual.com, Chrome asks before the page may reach the bridge on `127.0.0.1`: see [Chrome asks about the local network](troubleshooting.md#chrome-asks-about-the-local-network-or-about-apps-on-this-device) ([Chrome blog](https://developer.chrome.com/blog/local-network-access)). Running `node serve.js` and opening the page from `http://localhost:8080` avoids the prompt.


## MIDI output and panic

`midi.noteOn/noteOff/cc/send` go to the selected output port — and `midi.panic()` sends all-notes-off +
all-sound-off + sustain-off + per-note note-offs on all 16 channels, through the
same observable throat as everything else. Bind it to a pad you can find in the
dark. Every performer eventually needs it; ours is one call.

```js
show.midi.outputs.map((o) => o.name);   // available output ports
show.midi.selectOutput('IAC Driver Bus 1');
show.midi.noteOn(60, 100, 1);           // note, velocity 0..127, channel 1..16
show.midi.noteOff(60, 1);
show.midi.cc(74, 64, 1);                // controller, value 0..127, channel
show.midi.send([0xb0, 74, 64]);         // raw bytes
show.midi.panic();
```

The first output port is used until you choose another (`enable(preferredOut)`
matches a name exactly, then as a substring). Everything sent passes through
`onSend`, which feeds the per-channel MIDI OUT meter in the Layers panel.

**Hot-plug.** A cable pulled mid-show must not leave the DAW silent without a word. When the current output is unplugged, `Midi` moves to the next best live port: the one you chose with `selectOutput()` or `enable(name)`, then the first match of the `prefer` list (`new Midi({ prefer: ['IAC'] })`), then the first port. When the port you chose is plugged in again, the output goes back to it. An unrelated device appearing never steals the output. Every switch prints one line in the MIDI log (the Signals panel, via `midi.onMessage`) and one in the browser console, flashes in the MIDI controller panel, and updates the `MIDI out →` row of the L1 Input panel. In code: `midi.onOutput(({ text, reason }) => …)`.

**Echo.** What you send into a virtual bus must not come back as input. Inputs whose name matches `filterOut` (default `IAC`, the macOS bus) are never listened to, and a message identical to one just sent that arrives on any input within `echoWindow` milliseconds (default 40; `0` turns it off) is dropped as echo, once per message sent. `midi.echoDropped` counts them.

To make an external program follow the show, `ScoreMidi` sends the score's segment changes and cues as notes and CCs ([Score to MIDI](score.md#score-to-midi)).

## Sound

`modules: { sound: true }` adds `Sound` (`@openav/sound`) with the Tone.js
engine. Browsers only start audio after a click, so the console shows
**🔊 enable sound** in the *L4 · Output — sound* panel, with an instrument
picker under it. Once enabled, every `midi/note/on` and `midi/note/off` plays
the chosen instrument, whatever sent it (a keyboard, the QWERTY piano, the
simulated performer, a phone). Tone.js (15.0.4) is loaded from jsDelivr only
when sound is enabled.

```js
await createShow({ world, modules: { sound: true } });       // the warm pad, as before
await createShow({ world, modules: { sound: 'piano' } });    // start on the grand piano
await createShow({ world, modules: { sound: { instrument: 'synth/pluck', remember: false, picker: false } } });
```

### Instruments

| id | sound | made of |
|---|---|---|
| `piano` | grand piano | the Salamander Grand Piano: 30 samples (A, C, D♯, F♯ of every octave), 2.0 MB, loaded when picked |
| `epiano` | electric piano | two FM pairs and a stereo tremolo |
| `xylophone`, `marimba`, `vibraphone`, `glockenspiel`, `music-box` | mallets | modal synthesis: a few decaying partials at each bar's own ratios, plus a mallet click |
| `strings` | string ensemble | detuned saws, bowed attack, chorus, vibrato |
| `harp` | plucked string | Karplus–Strong |
| `organ` | drawbar organ | nine drawbars as one additive waveform, rotary tremolo |
| `choir` | choir pad | saws through vowel formants |
| `synth/pad` | warm pad | the original voice, still the default |
| `synth/saw-lead`, `synth/square-lead`, `synth/pluck`, `synth/supersaw`, `synth/bass`, `synth/acid`, `synth/brass`, `synth/bell`, `synth/sub`, `synth/chip` | synth presets | one poly synth, presets as data |

The piano samples are *Salamander Grand Piano* by Alexander Holm, licensed
[CC-BY 3.0](https://creativecommons.org/licenses/by/3.0/). The picker shows that
credit next to the piano, and a show that plays it in public credits it too.
They ship in `packages/sound/samples/salamander/`. If they cannot load, the
piano plays the electric piano instead of going silent.

### Choosing a sound

Pick from the console, or from code:

```js
await show.sound.setInstrument('organ');   // true once it plays
show.sound.instrument;                     // 'organ'
show.sound.onChange((e) => console.log(e.type, e.id, e.progress));   // instrument · loading · ready · error
show.timeline.onSceneChange((i, scene) => {
  if (scene.id === 'chorale') show.sound.setInstrument('organ');      // a cue may switch instruments
});
```

Switching while you play releases the notes held on the old instrument, so
nothing hangs. A sampler keeps the old sound playing until its files are in,
and the picker shows the progress. Each switch also fires the pulse signal
`sound/instrument` (`{ id, name }`). The picker's last choice is remembered per
page and wins over the declared instrument on the next visit;
`remember: false` turns that off.

The instrument is a discrete choice. What you perform continuously stays a
param: the engine's params join the show's params under `sound/`.
`sound/cutoff` (100–8000 Hz, default 2500), `sound/space` (reverb wet, 0–1,
default 0.3) and `sound/volume` (−36–0 dB, default −8) are shared by every
instrument, so a knob, a hand or the score plays the filter the way it plays
the visuals. An instrument may suggest starting values (the piano opens the
filter to 8000 Hz) and add knobs of its own, which the console shows while it
plays: the organ's `sound/drawbars` and `sound/rotor`, `sound/attack` and
`sound/vibrato` on the strings, `sound/vowel` on the choir, `sound/tremolo` on
the electric piano and the vibraphone. Automation and overrides always win over
a suggested default. The sustain pedal (`midi/cc/64`) holds every instrument's
note-offs. Notes on MIDI channel 10 (the drum machine) are left to a drum engine.

### Add your own instrument

A sound you can pick is one file: data plus a `create(Tone, ctx)` that returns
`noteOn`, `noteOff` and `dispose`. Import it before `createShow()` and every
picker lists it; nothing in `packages/*` changes.

```js
import { registerInstrument } from '@openav/sound';

registerInstrument({
  id: 'kalimba',
  name: { en: 'Kalimba', zh: '拇指琴' },
  category: 'mallets',
  params: [{ key: 'decay', label: 'Decay (s)', min: 0.2, max: 4, def: 1.2 }],   // → sound/decay
  create(Tone, { output }) {
    const synth = new Tone.PolySynth(Tone.FMSynth, { harmonicity: 5.1, modulationIndex: 2,
      envelope: { attack: 0.001, decay: 1.2, sustain: 0, release: 1 } }).connect(output);
    const hz = (n) => 440 * 2 ** ((n - 69) / 12);
    return {
      noteOn: (note, vel, time) => synth.triggerAttack(hz(note), time, vel),
      noteOff: (note, time) => synth.triggerRelease(hz(note), time),
      set: (key, v) => key === 'decay' && synth.set({ envelope: { decay: v } }),
      dispose: () => synth.dispose(),
    };
  },
});
```

A duplicate id throws unless you pass `registerInstrument(def, { replace: true })`.
Optional fields: `defaults` (starting `cutoff`, `space`, `volume`), `credit`,
`gain` (dB), `transpose` (semitones), `fallback` (an id to play if loading fails)
and, on the returned object, `ready` (a Promise: the picker shows progress while
you call `ctx.onProgress(0..1)`), `set(key, value)` and `releaseAll(time)`.
Mallet sounds can be pure data with `modalInstrument({ id, name, partials, strike })`.

A synth preset is data as well, and becomes `synth/<id>`:

```js
import { registerSynthPreset } from '@openav/sound';

registerSynthPreset({
  id: 'glass', name: { en: 'Glass', zh: '玻璃' },
  voice: 'fm', harmonicity: 3.01, modulationIndex: 14,
  envelope: { attack: 0.002, decay: 1.4, sustain: 0, release: 1.2 },
  effects: [{ type: 'chorus', frequency: 1.5, depth: 0.4, wet: 0.3 }],
});
```

### Your own engine

An engine is a small object, so you can replace the whole thing:

```js
const sineEngine = () => {
  let ctx = null, out = null;
  const voices = new Map();
  return {
    params: [{ key: 'gain', label: 'Gain', min: 0, max: 1, def: 0.3 }],   // → sound/gain
    async enable() {
      ctx = new AudioContext();
      out = ctx.createGain(); out.gain.value = 0.3; out.connect(ctx.destination);
    },
    noteOn(note, vel) {
      voices.get(note)?.stop();
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = 440 * 2 ** ((note - 69) / 12);
      g.gain.value = vel * 0.3;
      o.connect(g).connect(out); o.start();
      voices.set(note, o);
    },
    noteOff(note) { voices.get(note)?.stop(); voices.delete(note); },
    set(key, value) { if (key === 'gain' && out) out.gain.value = value; },
    dispose() { ctx?.close(); },
  };
};

await createShow({ world, modules: { sound: { engine: sineEngine() } } });
```

The drum kit from `@openav/drums` is also an engine: `drumEngine({ samples })`
maps General MIDI drum notes to synthesized drums (or to your samples,
`{ 36: 'kick.wav', … }`) and has one param, `kitVolume` (−30–0 dB).

## Without createShow

`createShow()` is a convenience. When you need your own layout or loop, assemble
the parts by hand; this is roughly what it does:

```js
import { Signals, Params, Loop } from '@openav/core';
import { Midi } from '@openav/midi';
import { Mapper } from '@openav/mapping';
import { Timeline } from '@openav/timeline';
import { Stage } from '@openav/stage';
import { mountConsole } from '@openav/console';
import { MonitorFeed, snapshotOf } from '@openav/monitor';

const signals = new Signals();
const params = new Params();
const stage = new Stage({ container: document.querySelector('#stage'), params, signals });
stage.register(myWorld);
await stage.activate(myWorld.name);

const timeline = new Timeline({ params, total: 120, automation, scenes });
const mapper = new Mapper({ signals, params, profile: myWorld.name });
if (!mapper.load()) routes.forEach((r) => mapper.addRoute(r));

const midi = new Midi({ signals });
midi.enable();

// mount the console after every world (and sound engine) is registered: it builds one row per param
const app = { timeline, params, mapper, signals, midi, stage };
const desk = mountConsole(document.querySelector('#desk'), app);
const monitor = new MonitorFeed();
monitor.connect();

const loop = app.loop = new Loop((dt) => {
  timeline.advance(dt);
  mapper.update(dt);
  const state = stage.frame(dt, timeline.state());
  desk.render(state);
  monitor.frame(snapshotOf({ timeline, params, signals, stage, loop }, state));
});
loop.start();
```

## Pre-show checklist

- [ ] Chrome, plugged in, screen-sleep off, notifications off (`chrome://settings`)
- [ ] WebMIDI permission granted for this origin (it's per-origin, per-port)
- [ ] mapping profile saved (mapper.save()) AND exported to a JSON file
- [ ] monitor server running; stage manager's device on the same network
- [ ] sound enabled with a click, and the panic pad mapped
- [ ] rehearse the failure: kill the tab, restart, be performing again in <30 s
