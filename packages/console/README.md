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

`mountConsole(el, app, opts = {})` → `{ render(state), perf, dispose() }`
- `app` = `{ timeline, params, mapper, signals, stage, midi?, sound?, audio?, hands?, pose?, loop?, osc? }`;
  missing parts hide their section. `createShow()` passes `show.app`.
- `opts.layers = false` / `opts.signals = false` leave out the Layers / Signals panels
- `perf` = performance mode: `toggle()`, `active`, `render()`

Keyboard: Space play/pause · ←/→ scenes · R reset · T performance mode · F fullscreen.
Keys typed into an input field are ignored.

Full reference: [docs](https://openaudiovisual.com/docs/#packages-openav-console)
