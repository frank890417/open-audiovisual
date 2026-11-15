# @openav/console

Spine · the director's desk: transport and a scrubber with scene blocks, the
Curves panel (the whole show's automation), the Layers overview, L1 input (MIDI devices, 🎤 mic, 🖐 hands, 🕺 body), L2 mapping, L3
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

`mountConsole(el, app, opts = {})` → `{ render(state), perf, director, curves, wizard, keys, dispose() }`
- `app` = `{ timeline, params, mapper, signals, stage, midi?, midiPanel?, sound?, audio?, hands?, pose?, loop?, osc?, score?, director? }`;
  missing parts hide their section. `createShow()` passes `show.app`.
- `opts.layers = false` / `opts.signals = false` leave out the Layers / Signals panels
- `opts.curves = false` leaves out the Curves panel; `{ open: true }` starts it open (below)
- `opts.learnOrder = ['hue', …]` the order of **🎛 map knobs in order** (default: the declared params)
- `opts.keys = { reset: 'F6', perf: 'F7', … }` moves the keyboard shortcuts (below); `opts.keys = false` switches them all off
- with `app.score` + `app.director`: the Director panel (cut picker, segment progress, HOLD banner, next + countdown, the operator's acts,
  cues, switched-off modules), cue ticks and dashed hold ends on the scrubber
- `perf` = performance mode: `toggle()`, `active`, `render()`

Keyboard: Space play/pause (at a hold: release) · →/← next / previous scene (→ at a hold: release) · R reset · T performance mode ·
F fullscreen · M the on-screen MIDI controller (`app.midiPanel`) · C the Curves panel · Esc stops the mapping wizard / leaves keyboard-piano capture.
Input fields, held keys and ⌘/Ctrl/Alt combos are ignored. While the piano captures the keyboard the letters (R, T, F, M)
belong to the piano; Space, arrows and Esc always work.

Those are the defaults. A keyboard-piano wants its letters, so `keys` maps each action to a key or a list of keys:

```js
mountConsole(el, app, { keys: { reset: 'F6', perf: 'F7', fullscreen: 'F8', midi: 'F9', play: ['Space', 'Enter'], cancel: false } });
// createShow({ console: { keys: { … } } }) passes the same thing
```

Actions: `play` `next` `prev` `reset` `perf` `fullscreen` `midi` `cancel` `curves`. A key is `'r'` (the character, either case),
`'KeyR'` (the physical key, any layout), `'F6'` / `'Backquote'` / `'ArrowUp'` (`KeyboardEvent.code` or key name, any case), with
optional `Shift+`, `Ctrl+`, `Alt+`, `Meta+`. Without Ctrl/Alt/Meta in the spec those must not be held. `false` switches an action
off; an unknown action or a malformed key throws. Letters (a–z, `;`) stay dead while the piano captures the keyboard, wherever
you put them; F-keys and the like work through it. The hints on the desk print your keys. Also exported:
`DEFAULT_KEYS`, `resolveKeys(keys)`, `keyLabel(resolved, action)`.

**Curves panel.** One curve for every param that has automation (`timeline.automation`), across the whole show on the scrubber's
axis, with the segment ids and holds behind them, a white column and ring where the show is now, and the number the show is using.
A param that a slider, a mapped knob or a phone has taken over gets an amber dot at its value, a dashed line across the show and
**↩** in its head (give it back to its curve); **↩ all** gives back every curve in view (an override on a param with no curve stays).
Press or drag on a curve or the ruler to seek, as on the scrubber. A take being recorded (`timeline.record`) is drawn in red.
It is collapsed until you open it (the header, or **C**) and does nothing while collapsed: no measuring, no drawing, no canvas. Open, each
curve is drawn once and again only when the automation, the cut or the width changes; per frame only the playhead and the overrides
are redrawn, and rows scrolled out of view are not drawn. A show with nothing automated has no panel. `desk.curves` →
`{ toggle(force?), open, info() }`. The pure half (axis, bands, sampling, cursor, the signature that says when to redraw) is
`src/curves.js`, tested in Node.

Full reference: [docs](https://openaudiovisual.com/docs/#packages-openav-console)
