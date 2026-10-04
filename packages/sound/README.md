# @openav/sound

L4 output (audio branch) · in-page synthesis behind a small engine contract.
`Sound` plays every `midi/note/on|off` through the engine, whatever sent it, and
adds the engine's params to the show as `sound/*`, so the timeline, a knob or a
hand can play the filter the way they play the visuals.

```js
// in a show: the console's L4 panel gets a 🔊 enable sound button
const show = await createShow({ world, modules: { sound: true } });   // or { sound: { engine } }
```

```js
import { Sound, toneEngine } from '@openav/sound';
const sound = new Sound({ signals, params, engine: toneEngine() });
button.onclick = () => sound.enable();      // browsers start audio only from a gesture
// every frame, with the resolved state:
sound.update(state);
```

## Exports

| export | signature |
|---|---|
| `Sound` | `new Sound({ signals, params = null, engine })` · `enable()` → Promise<true> · `update(state)` pushes `sound/*` values into the engine · `dispose()` · `enabled`, `engine` |
| `toneEngine` | `toneEngine({ cdn = 'https://cdn.jsdelivr.net/npm/tone@15.0.4/+esm' })` → poly synth, filter and reverb; Tone.js is loaded on `enable()`. Params `cutoff` (100–8000 Hz, default 2500), `space` (0–1, 0.3), `volume` (-36–0 dB, -8) |

Engine contract: `{ params, enable(), noteOn(note, vel01), noteOff(note), set(key, value), dispose() }`.
`drumEngine()` from `@openav/drums` is another engine.

In `createShow()`, routes are added before the engine's params exist, so a declared
route to `sound/cutoff` needs explicit `outMin` / `outMax`.

Full reference: [docs](https://openaudiovisual.com/docs/#packages-openav-sound)
