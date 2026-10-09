# @openav/show

Glue · `createShow(options)` assembles a whole show around a world in one call:
signals, params, stage, timeline, mapper, the modules you switch on, the console
side panel, the backstage feed and the frame loop. It returns every part.

```js
import { createShow } from '@openav/show';
import { createCanvas } from '@openav/stage';

const world = {
  name: 'dot',
  params: [{ key: 'size', label: 'Size', min: 0, max: 1, def: 0.3 }],
  init({ container }) { this.view = createCanvas(container); },
  update(dt, state) { this.size = state.size; },
  render() {
    const { ctx } = this.view, { w, h } = this.view.fit();
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#7ea6ff'; ctx.beginPath(); ctx.arc(w / 2, h / 2, this.size * h / 2, 0, Math.PI * 2); ctx.fill();
  },
  dispose() { this.view.dispose(); },
};

const show = await createShow({
  world,
  timeline: { total: 60, automation: { size: [[0, 0.1], [60, 0.9]] } },
  routes: [{ source: 'midi/cc/1', target: 'size', smooth: 0.1 }],
  modules: { keys: { base: 48 }, chord: true, sound: true },
});
```

| option | default · meaning |
|---|---|
| `world`, `worlds` | `null`, `[]` · the first world is activated (`init` is awaited) |
| `timeline` | `{ total: 120 }` · `{ total, automation, scenes }` |
| `routes` | `[]` · Mapper routes; added on top of a saved profile |
| `modules` | `{}` · `midi` (on; `false`; `{ controllers }`), `keys` (on; `false`; `{ base, octaves, sim, capture }`), `drums`, `audio`, `chord`, `hands`, `pose`, `remote`, `sound` |
| `artwork`, `hint` | `null`, `''` · credit line `{ title, artist, year, note }`; an HTML hint on the stage |
| `profile` | the world's name · mapper profile; `false` ignores saved routes |
| `score` | `null` · `{ cuts, cut, modules, api, onStatus, onCue, maxStep, midi }`: the show's structure (`@openav/score`); `?cut=<id>` picks the version. The timeline's scenes/total come from it; returns `show.score`, `show.director`, `show.show` (`table()`, `goto()`, `seek()`, `cue()`, `status()`, `next()`, `prev()`) |
| `onFrame`, `mount` | `null`, generated · `(dt, show)` each frame before the timeline advances; `{ stage, side }` elements or selectors |

Returns `{ signals, params, stage, timeline, mapper, midi, controllers, midiPanel, keys, drums, sound, audio, hands, pose, chord, remote, score, director, scoreMidi, console, app, loop }`
(parts you did not ask for are `null`), also set as `window.openav`. Import map: copy `examples/01-hello-particles/index.html`.

Full reference: [docs](https://openaudiovisual.com/docs/#packages-openav-show) · [createShow](https://openaudiovisual.com/docs/#show-control-createshow)
