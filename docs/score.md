# Score & Director

A show that outgrows one afternoon needs a structure that can grow. The **score** (`@openav/score`) writes a show down as segments with *lengths*, and the **director** runs the code that performs each segment. They are pure logic with no DOM, and `createShow()` wires them to the [timeline](show-control.md#timeline), the console and the prompter for you.

## The idea: lengths, never seconds

A timeline written as a table of absolute seconds cannot grow. Make the second scene longer and every later scene, cue, curve and `if (t > 466)` in your code is now wrong, and you find them one rehearsal at a time. In a score you write only how *long* each segment is:

```js
const cuts = [
  { id: 'full', title: 'A day', segments: [
    { id: 'standby', title: 'Standby', dur: 6, hold: true, acts: ['Check sound', 'Press Space when the room is ready'] },
    { id: 'dawn',    title: 'Dawn',    dur: 24, cues: { birds: 0.3 } },
    { id: 'noon',    title: 'Noon',    dur: 30, cues: { flare: { s: 8 }, peak: 0.5 }, acts: ['Open the haze slowly'] },
    { id: 'dusk',    title: 'Dusk',    dur: 24, linger: 8 },
    { id: 'night',   title: 'Night',   dur: 36 },
  ] },
  { id: 'short', from: 'full', scale: 0.5 },          // the same show at half the length
];
```

Every start, end, cue time, countdown and scene is computed from those lengths. Change `noon` to `dur: 40` and everything after it moves by ten seconds while everything before it stays put. A second version of the show is a few lines of data, not a second timeline to keep in step.

## A cut

A cut is one version of the show. It has an `id`, an optional `title`, and either segments or a base cut and a scale.

| cut field | meaning |
|---|---|
| `id` | unique among the cuts; no `.` |
| `title` | shown in the cut picker |
| `segments` | the list below, in playing order |
| `from`, `scale` | a derived cut: the cut named `from` with every length times `scale` (`scale` > 0). It can be derived again; the scales multiply |
| `start` | the id of the segment the show opens on and `reset` returns to (default: the first) |

| segment field | meaning |
|---|---|
| `id` | unique within the cut; no `.`. It is also the id of the module that performs it |
| `title`, `note` | what the desk and the prompter show |
| `dur` | length in seconds, greater than 0. The only time a segment has |
| `cues` | named moments inside the segment: a ratio `0 ≤ r < 1` (a fraction of the segment) or `{ s: seconds }` (seconds into it) |
| `acts` | what the human operator does in this segment: an array of strings, shown on the desk and, large, on the prompter |
| `linger` | seconds the segment's module keeps running after the segment ends (a decay, a tail). Default 0 |
| `hold` | playback stops at the end of this segment and waits for the operator ([Hold](#hold)) |
| `module` | the name of the module that performs it, when that is not the segment's own id |

A derived cut scales `dur`, `linger` and `{ s }` cues, so a cue stays in the same place in the music. The ratio cues did not need to move.

A cut is checked when the score is built. Duplicate ids, a `dur` of 0 or below, a `from` that is not a cut, a `scale` of 0 or below, a cut derived from itself, a cue outside its segment, `acts` that are not strings: each throws a `ScoreError` that names the cut, the segment and the reason, and lists every problem at once. Nothing half-valid can reach the stage.

## The Score

```js
import { Score } from '@openav/score';
const score = new Score({ cuts, cut: 'full' });      // cut defaults to the first
```

| member | what it gives |
|---|---|
| `table()` | one row per segment: `{ index, id, title, start, end, dur, linger, hold }` |
| `total` | the show's length: the sum of the segment lengths |
| `segmentAt(T)`, `indexAt(T)` | the segment playing at show time `T`. A segment owns `[start, end)`; before 0 answers the first, after the end the last |
| `cueTime('dusk')` | a moment in show seconds: `'dusk'` is the segment's start, `'dusk.end'` its end, `'dusk.glow'` a cue. `NaN` for anything unknown |
| `cuesBetween(T0, T1)` | the cues a playhead passed from `T0` to `T1`: those with `T0 < time ≤ T1`, in time order. Nothing when `T1 ≤ T0` |
| `cues()` | every cue of the cut in time order, each with its number `n` |
| `scenes()` | the segments as a `scenes` array for the [timeline](show-control.md#timeline) (with `acts`, `hold` and `cues`) |
| `validate()` | throws a `ScoreError` when anything is wrong; returns `true` otherwise (the constructor already calls it) |
| `cut`, `title`, `segments`, `startT` | the active cut, and where `reset` goes |
| `cuts` | every cut as `{ id, title, total, from, scale, base }`, for a version picker |
| `scale`, `base`, `baseTime(T)` | the cut's total scale against the cut it was derived from, that cut's id, and `T` expressed on it |

### Automation on a derived cut

Automation curves are written once, against the cut they were derived from, and a derived cut stretches them. `timeline.valueAt(key, t)` reads the curve at `score.baseTime(t)`, which is `t / scale`. On the short cut above, `t = 20` reads the curve at 40. A cut that is not derived has scale 1 and nothing changes.

If two cuts differ in structure and not just in length, do not share automation between them. Drive the params from the segment modules instead ([`param()`](#segment-modules)), where `ctx.p` already scales for free.

## Cues

A cue is a named moment: `cues: { peak: 0.5 }` in segment `noon` makes `noon.peak`, half way through. Three places see it:

- the scrubber draws a tick for it, and a click on the tick jumps there;
- the director calls `onCue({ name, cue, T, n, segment })` once each time the playhead *passes* it while playing, and calls the active module's `cue(name, ctx)` hook;
- `ctx.cue('peak')` inside a module tells you where it sits, as a progress you can compare with `ctx.p` (`'noon.peak'` works for another segment's cue, `ctx.cueT(name)` answers in show seconds).

A seek does not pass the cues it jumps over, and playing back over a cue fires it again. A cue sitting exactly on the first instant of the show fires on the first frame.

## Hold

`hold: true` means: *when playback reaches the end of this segment, stop and wait.* A standby that waits for the room to be ready is the typical use. Exactly what happens:

- The timeline stops a microsecond before the boundary, so the show is still *inside* the held segment, and sets `timeline.holding = true` and `timeline.playing = false`. The clock freezes there for as long as you like.
- The held segment's module keeps getting `update()` every frame, with `ctx.p === 1`, `ctx.holding === true` and `ctx.held`, the number of seconds waited so far. Use `ctx.held` as the clock for anything that should keep breathing while the show is frozen. (This is the choice made: the show *stops* at the end of the segment rather than looping inside it. Looping would send `p` back to 0, fire the cues again and break "every module enters once, exits once".)
- **Space**, **→**, the ▶ button, `timeline.play()` and `timeline.next()` all release it: the next segment starts at once and playback continues. `timeline.release()` does the same in code.
- A seek (scrubber, `goto`, ←) or a reset clears the hold, and a seek never *stops* at a hold: only playback does. The last segment never holds (the show ends there).
- The backstage monitor shows `⏸ HOLD`; the desk and the prompter show a pulsing banner.

## Segment modules

A segment module is the code that performs one segment. Its `id` is the id of the segment (or the segment's `module` name):

```js
const dusk = {
  id: 'dusk',
  enter(api, ctx)  { api.sky.caption = 'dusk'; },        // the segment began, or a seek landed inside it
  update(api, ctx) { /* every frame, playing or not */ },
  exit(api, ctx)   { api.sky.caption = ''; },            // it ended (after its linger) or a seek left it: give back what you took
  param(key, value, ctx) { return key === 'sun' ? 1 - ctx.p : value; },   // optional: bend a timeline param while this segment is current
  cue(name, ctx)   { /* optional: one of this segment's cues was just passed */ },
  reset(api)       { /* optional: R was pressed; forget everything */ },
};
```

`enter`, `update` and `exit` get the `api` object first (yours, see below). Every hook gets a `ctx`:

| `ctx` | meaning |
|---|---|
| `p` | progress through the segment, 0 to 1. Above 1 during `linger`; exactly 1 while holding |
| `t` | seconds into the segment (`p × dur`) |
| `dt` | seconds since the previous frame |
| `dur` | the segment's length in seconds |
| `T` | show time in seconds |
| `segment` | the segment: `id`, `title`, `start`, `end`, `dur`, `cues`, `acts`, `hold`, `linger`, `index` |
| `cue(name)`, `cueT(name)` | where a cue sits, as a progress and in show seconds (`NaN` when unknown) |
| `phase` | `'active'`, `'linger'`, or `'failed'` (only inside `exit()` after a crash) |
| `holding`, `held` | waiting at a hold, and for how many seconds |
| `playing` | whether the timeline is running (`update` is called every frame regardless) |
| `api` | the same `api` object, so `param()` and `cue()` can reach the show too |

- **Enter once, exit once.** The module of a segment is entered when the show enters it and exited when it leaves it, however it got there. A seek into the middle of a segment calls `enter` with the right `p`, so the module must be able to start from the middle.
- **`linger`.** After the segment ends its module keeps getting `update()` (with `p > 1` and `phase: 'linger'`) until the linger is over, and only then `exit()`. The next segment's module is already running meanwhile.
- **`param()`.** While a segment (or its linger) is current its module may rewrite any timeline param. Return a number to replace the value, anything else leaves it. The performer's hand still wins: an override is applied *after* this layer.
- **A module that throws is switched off, alone.** Each hook runs inside its own `try/catch`. If one throws, the director calls that module's `exit()` once (with `phase: 'failed'`), prints one `console.error`, and never calls it again. The other modules and the show carry on. The desk shows a red warning with the module's name and the error; **R** (reset) switches it back on. A frame loop is not allowed to stop because the youngest code in the room failed.

## The Director

```js
import { Director } from '@openav/score';
const director = new Director({ score, modules: [dawn, noon, dusk], api: { sky } });
// every frame, after the timeline advanced:
director.update(timeline.t, dt, { holding: timeline.holding, playing: timeline.playing });
timeline.layer = (key, value, t) => director.param(key, value, t);
timeline.onSeek((t, kind) => (kind === 'reset' ? director.reset() : director.seek(t)));
```

| option | meaning |
|---|---|
| `score` | the `Score` |
| `modules` | an array of modules (matched by `id`) or an object keyed by segment id |
| `api` | the first argument of `enter`/`update`/`exit` (also `ctx.api`). A function is called once, the first time it is needed |
| `onStatus(status)` | called when the segment, the holding state or the list of switched-off modules changes, not every frame |
| `onCue(cue)` | called for every cue the playhead passes |
| `maxStep` | a jump bigger than this many seconds between two `update()` calls counts as a seek, so cues in between are not fired (default 2). Raise it if you rehearse at a very high `timeline.rate` |

| member | what it does |
|---|---|
| `update(T, dt, { holding, playing })` | once per frame: enter, update and exit the modules, fire the cues passed |
| `param(key, value, T)` | the timeline's param layer |
| `seek(T)` | the playhead jumped: modules whose segment no longer covers `T` exit now, the next `update()` enters the new ones with the right `p` |
| `reset()` | every active module exits, every module hears `reset(api)`, switched-off modules come back |
| `status()` | `{ cut, T, total, segment: { index, id, title, note, start, end, dur, t, p, remaining, hold, acts, cues }, next: { id, title, start, in } or null, holding, held, active, failed, errors, missing }` |
| `register(module)`, `holding`, `failed` | add a module later; read the state |

## Use it with createShow

```js
const show = await createShow({
  world,
  score: { cuts, cut: 'full', modules: [dawn, noon, dusk],
           api: (show) => ({ sky: show.stage.active }),       // what the modules may touch (default: the whole show)
           midi: false },                                      // see "Score to MIDI"
  timeline: { automation: { haze: [[0, 0.1], [60, 0.5]] } },   // optional: written against the base cut
});
```

| `score` option | meaning |
|---|---|
| `cuts`, `cut` | the cuts, and the default one. **`?cut=<id>` in the URL wins** over `cut`; an unknown id is warned about and ignored |
| `modules` | the segment modules |
| `api` | an object, or a function of the show; default is the show itself |
| `onStatus`, `onCue`, `maxStep` | passed to the director |
| `midi` | `false` (default), `true` or `{ channel, segment, cue, … }`: [Score to MIDI](#score-to-midi) |

With a score, the timeline's scenes, total and start come from it (anything you pass as `timeline.scenes` or `timeline.total` is ignored), and the frame loop gains one step after the timeline advances, `director.update(...)`. `createShow` also returns `show.score`, `show.director` and, for rehearsal and scripts, `show.show` (so `window.openav.show`):

| `window.openav.show` | |
|---|---|
| `table()` | prints the segment table with `console.table` and returns the rows |
| `goto('dusk')`, `goto('dusk.glow')`, `goto(2)` | jump to a segment, a cue or a segment by number |
| `seek(T)` | jump to show seconds |
| `cue('dusk.glow')` | the cue's show seconds (it jumps nowhere) |
| `status()` | the director's status |
| `next()`, `prev()` | the same as → and ← |
| `cuts` | the list of cuts |

## The desk

With a score the console adds:

- **Scrubber.** Segment blocks, a tick for every cue (click to jump) and a dashed end on a segment that holds.
- **Director panel.** A cut picker (choosing one reloads the page with `?cut=<id>`, so nothing is half-switched), the current segment with a progress bar and the time left, the HOLD banner, the next segment and the countdown, the operator's **acts**, this segment's cues (ticked as they pass), and the red warning for modules that were switched off.
- **Prompter** (**T**). Fullscreen, large, high-contrast: the segment title, what you do (`acts`), seconds left, the next segment, a HOLD banner while the show waits, and a red line for switched-off modules. Click it or press **T** again to leave. It also works for plain timeline scenes that carry `acts`.

### Keys

| key | does |
|---|---|
| <kbd>Space</kbd> | play / pause. At a HOLD: release it |
| <kbd>→</kbd> | next segment. At a HOLD: release it |
| <kbd>←</kbd> | previous segment |
| <kbd>R</kbd> | back to the start; stopped; switched-off modules come back |
| <kbd>T</kbd> | prompter |
| <kbd>F</kbd> | fullscreen |
| <kbd>Esc</kbd> | stop the knob-mapping wizard, or leave keyboard-piano capture |

Typing in a field, a held key (auto-repeat) and any key with ⌘, Ctrl or Alt are ignored. **While the on-screen piano captures the keyboard** (the *keyboard* box ticked in the piano bar) the *letters* belong to the piano: R, T and F do nothing, because T and F are piano keys, and an accidental R must not rewind a show you are playing. Space, the arrows and Esc always work, so you can play and run the show from one keyboard. The MIDI-controller key **M** follows the same rule.

### Map the knobs in order

The L2 Mapping panel has **🎛 map knobs in order**. It arms learn for the first param, you turn one knob, it is bound and the next param is armed; *skip*, *back* and *stop* (or Esc) steer it. Learn only ever **adds** routes (`Mapper.learn`), so running it again puts a second knob on a param and keeps the first. The order is the declared order of the params, skipping hidden ones; pass `mountConsole(el, app, { learnOrder: ['hue', 'size'] })` for your own. The logic is `LearnWizard` in `@openav/mapping`:

```js
import { LearnWizard } from '@openav/mapping';
const wiz = new LearnWizard({ mapper, keys: () => params.schema.map((p) => p.key), onChange: (w) => draw(w) });
wiz.start(); wiz.current; wiz.skip(); wiz.back(); wiz.stop();
```

## Score to MIDI

Software that should follow the show (a DAW launching a clip per segment, a lighting desk jumping scenes) cannot read the score, but it can read MIDI. `ScoreMidi` (`@openav/midi`) turns segment changes and cues into notes and CCs. It is **off** unless you ask:

```js
score: { cuts, midi: { channel: 15,
                       segment: { note: 36, cc: 20 },                       // segment i → note 36 + i, and CC 20 = i
                       cue: { note: 84, notes: { 'dusk.glow': 90 }, cc: 21 } } }  // a cue → note 84 (or its own note), CC 21 = its number
```

| option | default | meaning |
|---|---|---|
| `channel` | 15 | MIDI channel 1 to 16 |
| `segment` | `{ note: 36 }` | `note`: base note, the note sent is `note + index`. `cc`: a CC whose value is the index. `velocity`. `false` turns segment markers off |
| `cue` | `{ note: 84 }` | `note` for every cue, `notes: { 'seg.name': note }` for particular ones, `cc` whose value is the cue's number in the cut. `false` turns cue markers off |
| `length` | 0.15 | seconds before a marker note's note-off |
| `scrub` | `false` | also mark when the playhead is moved by hand. By default markers go out only while the show *plays* (or a hold is released), so dragging the scrubber does not launch clips |

A reset never sends. Everything goes through the `Midi` engine's own `noteOn`/`cc`, so the MIDI OUT meter shows it and `panic()` silences it. In code: `new ScoreMidi({ midi, channel, segment, cue })`, then `.segment({ index, cause })` and `.cue({ name, n })`.

## Clocks: why there are none

A show that keeps two time lines (a *story* time that old logic reads and a *show* time the audience lives) needs a way to say which engine follows which: weather that never stops, a city that pauses while an inserted segment plays. That is a clock per engine. This framework has one time line, the show's `T`, so there is nothing for a clock to choose between, and a segment module that wants to pause an engine simply stops advancing it (`ctx.t` is its own clock, `ctx.held` another). If a real show brings back the two-time-line case, a `clocks` table belongs in the cut next to `segments`. Until then it would be machinery with no user.

## Without createShow

```js
import { Score, Director } from '@openav/score';
import { Timeline } from '@openav/timeline';

const score = new Score({ cuts, cut: new URLSearchParams(location.search).get('cut') || 'full' });
const timeline = new Timeline({ params, score });                 // scenes, total and start come from the score
const director = new Director({ score, modules, api: { world } });
timeline.layer = (key, value, t) => director.param(key, value, t);
timeline.onSeek((t, kind) => (kind === 'reset' ? director.reset() : director.seek(t)));
const desk = mountConsole(deskEl, { timeline, params, mapper, signals, stage, score, director });

const loop = new Loop((dt) => {
  timeline.advance(dt);
  director.update(timeline.t, dt, { holding: timeline.holding, playing: timeline.playing });
  mapper.update(dt);
  desk.render(stage.frame(dt, timeline.state()));
});
```

## Rehearsal checklist

- [ ] `show.show.table()` reads like the running order you meant
- [ ] play it once start to finish at `timeline.rate = 4`; every cue fired, no module switched off
- [ ] open `?cut=` for every version and check the desk shows the right total
- [ ] press Space on every hold, press → on every hold, press R during a segment
- [ ] break a module on purpose (throw in `update`) and watch the show carry on
- [ ] the prompter (T) reads from the position you will stand in
