# @openav/chord

L1 input (an analyzer) · groups notes struck close together into one gesture and
publishes its consonance, chord type, triad and cluster flags as `chord/*`
signals. It reads `midi/note/on|off`, so a MIDI keyboard, the on-screen piano and
phones all feed it.

```js
// in a show: every played note is analyzed ({ chord: { window: 120 } } to tune it)
const show = await createShow({ world, modules: { chord: true } });
show.signals.on('chord/event', (a) => console.log(a.chordType, a.dissonanceLevel));
```

```js
import { ChordDetector } from '@openav/chord';
const chord = new ChordDetector({ signals });
signals.on('midi/note/on', ({ note, vel }) => chord.noteOn(note, vel));
signals.on('midi/note/off', ({ note }) => chord.noteOff(note));
chord.analyze([60, 64, 67]).chordType;   // 'major'
```

## Exports

`ChordDetector`
- `new ChordDetector({ window = 80, onChord = null, signals = null })` · `window` = ms after
  the last note-on before the gesture is analyzed
- `noteOn(note, vel = 0.8)` · `noteOff(note)`
- `analyze(notes, vels = [])` → `{ notes, count, root, vel, pcs, consonance, isConsonant,
  isDissonant, isTriad, thirdsFraction, dissonanceLevel, chordType }` (pure; `onChord` gets the same)

`chordType`: `single` `major` `minor` `sus2` `sus4` `dim` `aug` `maj7` `min7` `dom7`
`halfdim7` `maj9` `min9` `dom9` `six` `min6` `cluster` `chord`; inversions resolve to the
root-position name. `dissonanceLevel`: 0 none · 1 mild · 2 severe (cluster).

Signals: `chord/consonance` (-1..1), `chord/count`, `chord/root`, `chord/event` (pulse, the
full analysis) · [Signals reference](https://openaudiovisual.com/docs/#signals-openav-chord).

Full reference: [docs](https://openaudiovisual.com/docs/#packages-openav-chord)
