# @openav/console

Spine · the director's desk: transport and a scrubber with scene blocks, the
Layers overview, L1 input (MIDI devices, 🎤 mic, 🖐 hands, 🕺 body), L2 mapping, L3
param sliders with override and learn, the L4 sound panel, live signal meters, a
MIDI log and a fullscreen performance mode.

```js
// createShow() mounts it in the side panel
const show = await createShow({ world });
show.console.perf.toggle();               // performance mode, same as the T key
```

```js
import { mountConsole } from '@openav/console';
const desk = mountConsole(document.querySelector('#desk'), { timeline, params, mapper, signals, stage });
// every frame, after stage.frame():
desk.render(state);
```

## Exports

`mountConsole(el, app, opts = {})` → `{ render(state), perf, director, wizard, dispose() }`
- `app` = `{ timeline, params, mapper, signals, stage, midi?, sound?, audio?, hands?, pose?, loop?, osc?, score?, director? }`;
  missing parts hide their section. `createShow()` passes `show.app`.
- `opts.layers = false` / `opts.signals = false` leave out the Layers / Signals panels
- `opts.learnOrder = ['hue', …]` the order of **🎛 map knobs in order** (default: the declared params)
- with `app.score` + `app.director`: the Director panel (cut picker, segment progress, HOLD banner, next + countdown, the operator's acts,
  cues, switched-off modules), cue ticks and dashed hold ends on the scrubber
- `perf` = performance mode: `toggle()`, `active`, `render()`

Keyboard: Space play/pause (at a hold: release) · →/← next / previous scene (→ at a hold: release) · R reset · T performance mode ·
F fullscreen · Esc stops the mapping wizard / leaves keyboard-piano capture. Input fields, held keys and ⌘/Ctrl/Alt combos are ignored.
While the piano captures the keyboard the letters (R, T, F) belong to the piano; Space, arrows and Esc always work.

Full reference: [docs](https://openaudiovisual.com/docs/#packages-openav-console)
