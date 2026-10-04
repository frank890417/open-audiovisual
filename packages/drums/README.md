# @openav/drums

L1 input and L4 output · a 16-step, 4-lane drum sequencer with a TR-style grid UI
and a synthesized kit. Hits publish `drum/*` in the same shapes the microphone
analyzer publishes `audio/*`, so a world mapped to a kick cannot tell the machine
from a drummer.

```js
// in a show: the grid sits under the piano in the side panel
const show = await createShow({ world, modules: { drums: true },
  routes: [{ source: 'drum/kick/env', target: 'pump' }] });
```

```js
import { mountDrums } from '@openav/drums';
const drums = mountDrums(document.querySelector('#drums'), { signals });
// every frame:
drums.update(dt);
```

## Exports

| export | signature |
|---|---|
| `mountDrums` | `mountDrums(container, { signals, engine = null, autoEnableEngine = true })` → `{ seq, engine, update(dt), dispose() }`; no `engine` = `drumEngine()`, enabled on the first hit |
| `DrumSequencer` | `new DrumSequencer({ onHit(lane, vel), bpm = 112, swing = 0.12, humanize = 0.35, pattern = 'four on floor' })` · `setPattern(name)` · `toggleCell(lane, i)` · `toggle(on = !playing)` · `update(dt)` · `grid`, `bpm`, `playing`, `pattern` |
| `drumEngine` | `drumEngine({ samples = null })` → a [sound engine](https://openaudiovisual.com/docs/#show-control-sound): GM notes in, synthesized drums out; `samples: { 36: 'kick.wav' }` plays files instead; one param `kitVolume` (-30..0 dB, default -6) |
| `PATTERNS` | `'four on floor'`, `breakbeat`, `'half time'`, `latin`, `sparse` |
| `GM` | `{ kick: 36, snare: 38, clap: 39, tom: 45, hat: 42, openhat: 46 }` |

Signals: `drum/kick`, `drum/snare`, `drum/hat`, `drum/clap` (pulse `{level}`),
`drum/<lane>/env` (0..1), and `midi/note/on` `{note, vel, ch: 10}` per hit ·
[Signals reference](https://openaudiovisual.com/docs/#signals-openav-drums-simulator-analyzer-shaped).

Full reference: [docs](https://openaudiovisual.com/docs/#packages-openav-drums)
