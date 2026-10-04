# @openav/keys

L1 input · the on-screen piano (mouse and touch, glissando), QWERTY playing and a
simulated performer. All of them publish `midi/note/on|off`, the names the
hardware MIDI engine uses, so nothing downstream can tell them apart.

```js
// in a show it is on by default; pass options, or false to leave it out
const show = await createShow({ world, modules: { keys: { base: 48, octaves: 2 } } });
```

```js
import { mountKeys } from '@openav/keys';
const keys = mountKeys(document.querySelector('#keys'), { signals, base: 48 });
// every frame (drives the simulated performer):
keys.update(dt);
```

The bar above the piano has two checkboxes, both off at start: **keyboard** (QWERTY:
A-row whites, W-row blacks, Z/X octave, Shift accent) and **simulate performance**.

## Exports

| export | signature |
|---|---|
| `mountKeys` | `mountKeys(container, { signals, chord = null, base = 48, octaves = 2, sim = true, capture = true })` → `{ piano, sim, update(dt), dispose(), captureBox }`; `sim` / `capture` show the two checkboxes; a `chord` detector is fed directly |
| `KeysPiano` | `new KeysPiano(container, { base = 48, octaves = 2, semitones, fill, keyWidth = 27, velocity = 100, minBase = 24, maxBase = 84, onNote(note, vel01, on), onOctave(base) })` · `press(note, vel01)` · `release(note)` · `releaseAll()` · `setBase(n)` · `handleKeyDown(e)`, `handleKeyUp(e)` → consumed · `noteName(n)` · `captureEnabled` |
| `SimPlayer` | `new SimPlayer({ press, release, base = 60, scale = [0, 2, 4, 7, 9], density = 1 })` · `toggle(on = !enabled)` · `update(dt)` |
| `PIANO_KEYMAP` | `{ a: 0, w: 1, s: 2, e: 3, … p: 15, ';': 16 }` · key → semitones above `base` |

Signals: `midi/note/on` `{note, vel, ch: 0}` (`vel` 0..1), `midi/note/off` `{note, ch: 0}` ·
[Signals reference](https://openaudiovisual.com/docs/#signals-openav-keys).

Full reference: [docs](https://openaudiovisual.com/docs/#packages-openav-keys)
