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
- `new Timeline({ params, automation = {}, scenes = [], total = 600, score = null, start = null })` · `params` is a `Params`
  or a schema array (`createShow()` defaults `total` to 120). With a `score` (`@openav/score`) the scenes, total and
  start come from it, and automation is read at `score.baseTime(t)` so a derived cut stretches it.
  `start`: where `reset()` goes: a number, or `'first'` (the first scene); default 0
- `automation`: `{ key: [[t, value], …] }`, linear between keyframes; params with `step` hold
- `scenes`: `[{ id, t, title?, note?, act?, acts?, hold?, cues? }]`; `t` may be negative (standby before 0).
  `hold: true` stops playback at the end of that scene until released
- `play()` (releases a hold) · `pause()` · `toggle()` → playing · `seek(t)` · `jumpScene(d)` · `next()` (releases a hold, else
  a scene on) · `prev()` · `release()` · `reset()` (to `start`, default 0)
- `advance(dt)` → still playing (stops at `total`) · `state(t = this.t)` · `valueAt(key, t = this.t)`
- `sceneIndexAt(t)` · `currentScene(t)` · `sceneEnd(i)` · `onSceneChange(cb(i, scene, { cause }))` ·
  `onSeek(cb(t, kind))` · `layer(key, value, t)` (rewrite a param before overrides: the director's `param()`)
- `t`, `playing`, `holding`, `rate` (default 1), `total`, `start`

Full reference: [docs](https://openaudiovisual.com/docs/#packages-openav-timeline)
