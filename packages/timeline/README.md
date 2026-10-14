# @openav/timeline

Spine · param automation, scenes and transport. Pure logic, no DOM: it answers
"what is the base value of every param at time t?". Overrides (sliders, mapped
controls) are applied on top by `Params.resolve()`.

```js
const show = await createShow({ world, timeline: {
  total: 60,
  automation: { hue: [[0, 205], [30, 320], [60, 40]] },
  scenes: [{ id: 'calm', t: 0, title: 'Calm' }, { id: 'storm', t: 45, title: 'Storm', note: 'full keyboard' }],
} });
show.timeline.onSceneChange((i, scene) => console.log('cue', scene.id));
```

Curves, a loop, cues and recording are written the same way, all optional:

```js
const show = await createShow({ world, timeline: {
  total: 40, loop: true,                                    // wrap the show; 'scene' wraps the scene you are in
  automation: { hue: [[0, 200], [12, 262, 'ease'], [20, 330, 'in'], [24, 40, 'step']] },   // [t, value, curve]
  scenes: [{ id: 'drop', t: 20, cues: [{ name: 'flash', t: 20 }, { name: 'flash', t: 25 }] }],
} });
show.timeline.onCue((cue) => show.params.firePulse(cue.name));   // fired when PLAYBACK passes a cue, never by a seek
show.timeline.record('hue', () => show.params.isOverridden('hue') ? show.params.overrides.hue : null);
```

```js
import { Timeline } from '@openav/timeline';
const timeline = new Timeline({ params, automation, scenes, total: 60 });
timeline.play();
// every frame:
timeline.advance(dt);
const base = timeline.state();
```

## Exports

`Timeline`
- `new Timeline({ params, automation = {}, scenes = [], total = 600, score = null, start = null, loop = false, onCue = null })` · `params` is a `Params`
  or a schema array (`createShow()` defaults `total` to 120). With a `score` (`@openav/score`) the scenes, total and
  start come from it, and automation is read at `score.baseTime(t)` so a derived cut stretches it.
  `start`: where `reset()` goes: a number, or `'first'` (the first scene); default 0
- `automation`: `{ key: [[t, value, curve?], …] }`; params with `step` hold. `curve` is the way the segment that
  **ends** at that keyframe arrives there: `'linear'` (default, and what a keyframe without a third item has always
  done), `'ease'` (smoothstep), `'in'` (starts slow), `'out'` (starts fast), `'step'` (holds the old value until the keyframe,
  then jumps), or a function `f ∈ [0,1] → [0,1]`. An unknown name is linear. The first keyframe's curve is unused
- `loop` (option, and a property you can change any time): `false` · `true` (the whole show, from 0 to `total`) ·
  `'scene'` (the scene the playhead is in) · a scene id · `{ from, to }` (seconds, or scene ids: a `from` id is that scene's
  start, a `to` id its end). The playhead wraps when it reaches the end (the overshoot carries over, a huge `dt` wraps by
  modulo) and playback goes on. A `hold` inside the range still holds; a loop that ends on a hold keeps looping until you
  leave the scene. `onLoop(cb({ t, from, to, count }))` · `loopRange()` → `{ a, b }` or `null` · `loops` (laps since `reset()`).
  Wrapping into another scene is an `onSceneChange` with `cause: 'loop'`; a scene loop is not a scene change
- `cues()` → every `scene.cues` item in time order, `{ …cue, scene, sceneIndex }` · `onCue(cb(cue, { cause }))` (also the
  `onCue` option) fires when playback passes a cue: once, `from < t ≤ to` per frame. **Seek, jump, a drag across the scrubber
  and reset never fire a cue.** A cue exactly at the start fires on the first play after construction or `reset()`; each
  lap of a loop fires its cues again; a cue on a hold boundary fires when the hold is released. `fireCue(cue)` sets
  one off by hand (`cause: 'manual'`: the scrubber's ◆ click). With a score the director has its own cue system, so use
  `onCue` for plain timelines and the director's `onCue` for scores
- `record(key, source, opts?)` → a recorder `{ key, take, active, commit(), stop() }`. While the timeline **plays**,
  `source()` is read once per frame: a number is written into the take (at the automation time), `null`/`undefined`
  means nobody is touching and closes the take. A take also closes on pause, seek/jump, reset, a hold, the end of the show
  and every lap of a loop; the recorder stays armed until `stop()`. Closing runs `mergeTake()`, then `onRecord(cb({ key, from, to,
  count, cause, keyframes }))` (`count: 0` = too short to keep; `cause`: `'release'` · `'stop'` · `'pause'` · `'seek'` ·
  `'jump'` · `'reset'` · `'hold'` · `'loop'` · `'end'` · `'manual'`). `recording` → any armed · `recorders` (a `Map`) · `stopRecording()`.
  Arming the same key again replaces the recorder; an unknown key throws
- `mergeTake(key, [[t, value], …], { epsilon, maxGap, curve })` → `{ from, to, count }` or `null`: the merge rule behind
  recording, public so you can feed it takes from anywhere. The take is thinned (first and last stay; a point in between stays
  when it moved more than `epsilon`, default 0.6 % of the param's range, or `maxGap` seconds, 0.5, passed), then **replaces
  the existing keyframes inside its time span**; keyframes outside stay as they were, so the segment arriving at the take's
  first point glides from the previous keyframe and the segment after the take starts from its last value. Written as
  `[t, value]` (or `[t, value, curve]` when `curve` is not `'linear'`), t to 3 decimals, value to 4. Fewer than two points writes nothing
- `scenes`: `[{ id, t, title?, note?, act?, acts?, hold?, cues? }]`; `t` may be negative (standby before 0).
  `hold: true` stops playback at the end of that scene until released
- `CURVES` (export): `{ linear, ease, in, out, step }`, the functions behind the names
- `play()` (releases a hold) · `pause()` · `toggle()` → playing · `seek(t)` · `jumpScene(d)` · `next()` (releases a hold, else
  a scene on) · `prev()` · `release()` · `reset()` (to `start`, default 0)
- `advance(dt)` → still playing (stops at `total`) · `state(t = this.t)` · `valueAt(key, t = this.t)`
- `sceneIndexAt(t)` · `currentScene(t)` · `sceneEnd(i)` · `onSceneChange(cb(i, scene, { cause }))` ·
  `onSeek(cb(t, kind))` · `layer(key, value, t)` (rewrite a param before overrides: the director's `param()`)
- `t`, `playing`, `holding`, `rate` (default 1), `total`, `start`, `loop`, `loops`

Full reference: [docs](https://openaudiovisual.com/docs/#packages-openav-timeline)
