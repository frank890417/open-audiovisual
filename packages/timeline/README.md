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
- `new Timeline({ params, automation = {}, scenes = [], total = 600 })` · `params` is a `Params`
  or a schema array (`createShow()` defaults `total` to 120)
- `automation`: `{ key: [[t, value], …] }`, linear between keyframes; params with `step` hold
- `scenes`: `[{ id, t, title?, note?, act? }]`; `t` may be negative (standby before 0)
- `play()` · `pause()` · `toggle()` → playing · `seek(t)` · `jumpScene(d)` · `reset()`
- `advance(dt)` → still playing (stops at `total`) · `state(t = this.t)` · `valueAt(key, t = this.t)`
- `sceneIndexAt(t)` · `currentScene(t)` · `sceneEnd(i)` · `onSceneChange(cb(i, scene))`
- `t`, `playing`, `rate` (default 1), `total`

Full reference: [docs](https://openaudiovisual.com/docs/#packages-openav-timeline)
