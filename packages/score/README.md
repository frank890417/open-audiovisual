# @openav/score

Spine · a show's structure written as segment **lengths**, and the director that runs the
module of each segment. Pure logic, no DOM, no dependencies.

```js
import { Score, Director } from '@openav/score';

const cuts = [
  { id: 'full', title: 'A day', segments: [
    { id: 'standby', title: 'Standby', dur: 6, hold: true, acts: ['Press Space when the room is ready'] },
    { id: 'dawn',    title: 'Dawn',    dur: 24, cues: { birds: 0.3 } },
    { id: 'noon',    title: 'Noon',    dur: 30, cues: { peak: 0.5, flare: { s: 8 } } },
    { id: 'dusk',    title: 'Dusk',    dur: 24, linger: 8 },
  ] },
  { id: 'short', from: 'full', scale: 0.5 },                 // the same show, half the length
];

const score = new Score({ cuts, cut: 'full' });
score.table();                  // [{ id, title, start, end, dur, … }]
score.total;                    // 84
score.segmentAt(40).id;         // 'noon'
score.cueTime('noon.peak');     // 45
score.cuesBetween(44, 46);      // [{ name: 'noon.peak', T: 45, … }]
```

In a show, `createShow({ score: { cuts, modules } })` wires all of it (the timeline reads its scenes
from the score, the console draws the director panel and the prompter, `?cut=short` picks the version).

## Exports

`Score`
- `new Score({ cuts, cut })` · `cuts`: an array of cuts (or an object keyed by id); `cut` defaults to the first.
  Throws a `ScoreError` listing every problem: duplicate ids, `dur ≤ 0`, `from` that is not a cut, `scale ≤ 0`,
  a cut derived from itself, a cue outside its segment, bad `acts`.
- cut: `{ id, title?, start?, segments: [{ id, title?, note?, dur, cues?, acts?, linger?, hold?, module? }] }`
  or derived `{ id, title?, from, scale }`. `cues`: `{ name: ratio (0 ≤ r < 1) | { s: seconds } }`.
- `table()` · `total` · `segmentAt(T)` · `indexAt(T)` · `cueTime('seg' | 'seg.end' | 'seg.cue')` (NaN if unknown) ·
  `cuesBetween(T0, T1)` (T0 < time ≤ T1) · `cues()` · `scenes()` (for `@openav/timeline`) · `validate()`
- `cut`, `title`, `segments`, `startT`, `cuts` (for a picker), `scale`, `base`, `baseTime(T)`

`ScoreError`: `problems` lists each reason.

`Director`
- `new Director({ score, modules, api, onStatus, onCue, maxStep })`: modules `{ id, enter(api, ctx), update(api, ctx), exit(api, ctx), param?(key, value, ctx), cue?(name, ctx), reset?(api) }`
- `update(T, dt, { holding, playing })` · `param(key, value, T)` · `seek(T)` · `reset()` · `status()` · `register(module)`
- `ctx = { p, t, dt, dur, T, segment, cue(name), cueT(name), phase, holding, held, playing, api }`
- A module that throws is switched off alone (one `console.error`, one `exit()`); `reset()` brings it back.

`hold: true` stops playback at the end of the segment until released (Space, →): the show waits
*inside* the segment with `ctx.p === 1` and `ctx.held` counting seconds. See the docs for exactly what happens.

There is deliberately no engine-clock table: one time line, nothing for a clock to choose between
(docs → "Clocks: why there are none").

Full reference: [docs](https://openaudiovisual.com/docs/#score) · example `examples/13-score-director/`
