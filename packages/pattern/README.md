# @openav/pattern

Spine · rhythm in one line. A string of mini-notation (the way TidalCycles and Strudel write rhythm)
goes in; what plays in each bar comes out. Pure logic, no DOM, no audio: the drum machine and
oav-p5 ask it "what happens in bar 3?" and schedule the answer. Since 0.7 it also goes the other way — a grid of steps
back to a line a person would write (`fromGrid`), so the drum card's cells and its line edit each other — and in and
out of strudel.cc (`fromStrudel`, `strudelUrl`).

> **Credit and clean room.** The mini-notation way of writing comes from TidalCycles and Strudel
> ([tidalcycles.org](https://tidalcycles.org), [strudel.cc](https://strudel.cc)). This package is an
> independent implementation written from their public user documentation, the output of the
> strudel.cc REPL, and the papers below; no Strudel or Tidal source code was read or copied.
> 依公開文件與論文獨立實作；mini-notation 的寫法來自 TidalCycles／Strudel（https://tidalcycles.org、https://strudel.cc）。
> `fromGrid`, `toGrid`, `fromStrudel`, `toStrudel` and `strudelUrl` (0.7) are OAV's own as well, written from the same public
> documentation and the strudel.cc REPL as a user sees it.
> Strudel is AGPL-3.0; this package, like the rest of open-audiovisual, is MIT.

```js
import { compile } from '@openav/pattern';
const p = compile('bd*4, [~ sd]*2, hh*8');   // never throws
if (!p.ok) console.log(p.error);             // { code, index, length, message, hint }
for (const e of p.eventsInBar(1, { seed: 1 })) {
  // { word: 'bd', voice: 'kick', n: null, pos: 0.25, dur: 0.25, vel: 1, layer: 0, token: { start: 0, end: 2 } }
}
```

## Exports

| export | signature |
|---|---|
| `compile` | `compile(src, { words = WORDS } = {})` → `{ ok, error, src, voices, layers, period, eventsInBar(bar, { seed = 0 }) }`. Never throws. `eventsInBar` counts bars from 1 and returns the hits that **start** in that bar, sorted by `pos`: `{ word, voice, n, pos, dur, vel, layer, token }`. `pos` is 0..1 inside the bar, `dur` is in bars and may run past the bar (`bd/2` lasts two), `layer` is the top-level comma part, `token` is the character range of the word in `src` (light it while it sounds), `n` is the sample number from `bd:2` (else `null`; it does not change the sound yet), `vel` is 1. `voices` lists the kit voices used, in order; `layers` counts the comma parts; `period` is how many bars until the written rhythm repeats (`?` aside). A failed compile returns `[]` for every bar |
| `parse` | `parse(src)` → `{ ok: true, tree }` or `{ ok: false, error }`. Nodes: `step` `{ word, n }` · `rest` · `seq` `{ steps: [{ node, weight }] }` · `layer` `{ layers }` · `alt` `{ steps }` · `fast` / `slow` `{ factor, node }` · `euclid` `{ pulses, slots, rotate, node }` · `maybe` `{ chance, id, node }`; every node has `start`/`end`. Fractions are `[numerator, denominator]` |
| `WORDS` | drum words → kit voices of [`@openav/drums`](../drums/README.md) (`GM` names): `bd` kick · `sd`/`sn` snare · `hh` hat · `oh` openhat · `cp` clap · `rim`/`rs` rim · `lt` lowtom · `mt` tom · `ht` hightom · `cr` crash · `rd` ride · `cb` cowbell, and each voice name itself (`kick`, `snare`, `hat`, `pedalhat`…). Any letter case |
| `euclid` | `euclid(pulses, steps, rotate = 0)` → `steps` booleans (Toussaint 2005, below) |
| `fromGrid` | `fromGrid(grid, { steps = 16, words, order })` → one line that plays exactly `grid` (rules below). `grid`: `{ lane: 'x...x...' \| [0/1 …] }`, lanes named by voice (`kick`) or word (`bd`); `words: { kick: 'kick' }` keeps someone's own spelling; `order: ['kick', …]` puts those layers first (else the grid's key order). No hit anywhere → `'~'`. Never throws |
| `toGrid` | `toGrid(srcOrCompiled, { bar = 1, steps = 16, seed = 0, bars = 16 })` → `{ ok, grid, words, voices, exact, lost: { offGrid, stacked, varies, random, samples } }`: bar `bar` on the steps (hits between steps moved to the nearest), the words the line used, and what the steps cannot hold — `offGrid` triplets, `stacked` two hits in one step, `varies` other bars differ (`< >`, `/2`), `random` a `?`, `samples` `bd:2` |
| `fromStrudel` | `fromStrudel(code)` → `{ strudel, ok, src, bpm, ignored, unsupported }`: code copied from strudel.cc → the line OAV plays (below). `strudel: false` when there is no `s(…)` / `sound(…)` in it. Never throws |
| `toStrudel` | `toStrudel(src, { bpm, comment })` → Strudel code: `// comment`, `setcpm(bpm/4)`, `s("…")` with Strudel's drum names (`kick` → `bd`, `pedalhat` → `hh`) and a rotation of n or more written as the one OAV plays |
| `strudelUrl` | `strudelUrl(src, { bpm, comment })` → `'https://strudel.cc/#' + encodeURIComponent(base64(UTF-8 code))`, the format strudel.cc's address bar shows; open it in a **new** tab (a strudel.cc tab already open does not re-read a changed `#`) |
| `SHORT` | voice → the short word: `kick` `bd` · `snare` `sd` · `hat` `hh` · `openhat` `oh` · `clap` `cp` · `rim` · `lowtom` `lt` · `tom` `mt` · `hightom` `ht` · `crash` `cr` · `ride` `rd` · `cowbell` `cb` · `pedalhat` (no short word) |

## What you can write

| writing | meaning | example → bar 1 |
|---|---|---|
| spaces | steps share the bar equally | `bd sd hh` → 0, ⅓, ⅔ |
| `~` or `-` | rest | `bd ~ sd ~` → kick 0, snare ½ |
| `[ ]` | a group takes one step and splits it again (nests) | `bd [sd sd]` → kick 0, snare ½, ¾ |
| `,` | layers at the same time (top level and inside `[ ]` / `< >`) | `bd*4, hh*8` |
| `*n` | n times faster (decimals allowed) | `hh*8`; `bd*1.5` → 0, ⅔ then ⅓ in bar 2 |
| `/n` | n times slower, across bars | `bd/2` → bar 1, bar 3, bar 5…; `bd cp/2` → clap every other bar |
| `< >` | one per bar (nests; weights count) | `<bd sd>` → kick, snare, kick…; `<bd <sd cp>>` → bd sd bd cp |
| `(k,n)`, `(k,n,r)` | Euclidean: k hits spread over n steps, starting r steps later | `bd(3,8)` → 0, ⅜, ¾; `bd(3,8,2)` → 0, ¼, ⅝ |
| `!n`, lone `!` | repeat the step, each copy takes a step | `bd!2 sd` = `bd ! sd` = `bd bd sd` |
| `@n`, `_` | make the step n times as long | `bd@3 sd` → kick 0, snare ¾; `bd _ _ sd` is the same |
| `?`, `?p` | drop each hit with chance ½ (or p), decided by `seed` and time | `hh*8?`, `hh*8?0.3` |
| `word:n` | sample number, kept in `n` | `bd:2` |

Modifiers chain in the order written (`bd(3,8)*2`, `hh*8?`), and may follow a space (`bd *2`, `bd ? sd`,
`bd ! ! sd`), as in strudel.cc. A Euclidean pulse plays whatever its group is sounding at that instant:
`[bd sd](3,8)` → bd, bd, sd.

**Not supported, with an `unsupported` error and a hint:** `.` (grouping), `|` (random choice), `{ }` (polymeter),
`%`, `..` (ranges), `^`. The `.` matters most: OAV's older lane strings use `.` as a rest (`'x...x...'`), Strudel
uses it to group, so a dot is refused rather than guessed. Rests are `~` or `-`.

## Grid → line: `fromGrid`

A click on the drum card rewrites the line, so a grid has to come back as text a person would have written. Each lane
(16 steps) becomes one layer, layers joined with `, `, by these rules in order:

| the lane | written | e.g. |
|---|---|---|
| steady hits from the downbeat | `bd`, `bd*2`, `bd*4`, `hh*8`, `hh*16` | `x...x...x...x...` → `bd*4` |
| a figure that repeats, one hit (or up to four even places) in it | `[~ sd]*2`, `[~ hh]*4`, `[hh ~ hh hh]*4` | `....x.......x...` → `[~ sd]*2` |
| a Euclidean rhythm on 8 or 16 even places (3 or more hits) | `bd(3,8)`, `bd(5,8,2)`, `bd(3,8)*2` | `x.....x.....x...` → `bd(3,8)` |
| hits only on the beats (or halves) | `~ bd`, `bd ~ ~ bd`, `~ cp ~ ~` | `x...........x...` → `bd ~ ~ bd` |
| anything else: beat by beat, each beat `~`, `bd`, `bd*2`, `[~ bd]` or four places | `bd [~ ~ ~ bd] bd*2 ~` | `x......xx.x.....` |

A rotation `r` means the rhythm starts `r` steps later, the direction strudel.cc plays (`bd(3,8,1)` → steps 1, 4, 7). The five
presets come out as `bd*4, [~ sd]*2, hh*8` (four on floor), `bd [~ ~ ~ bd] bd*2 ~, ~ sd ~ [sd ~ ~ sd], hh*8, ~ cp ~ ~`
(breakbeat), `bd ~ ~ bd, ~ sd, hh*8, ~ cp` (half time), `bd(3,8,5), [~ sd] [~ sd ~ ~] [~ sd] [~ sd ~ ~], [hh ~ hh hh]*4` (latin),
`bd ~ [~ bd] ~, [~ hh]*4, ~ cp` (sparse). Every rule is exact: `tests/pattern.test.js` writes out 1000 random 16-step grids
(and 450 of 8, 12 and 32 steps), compiles each line and checks it lands back on the same steps, the same in every bar.

## Strudel in and out

`fromStrudel` reads what someone copies out of strudel.cc: `s("…")` or `sound("…")` with `"`, `'` or `` ` `` quotes (a line
break inside becomes a space), labels (`$:`, `name:`) and several patterns (each a layer), then `.fast(n)` / `.slow(n)` (a
number, `"2"`, or `110/4`) folded into the line as `[…]*n` / `[…]/n`, and `setcps(x)` / `setcpm(x)` as `bpm` (x·240 / x·4).
`.bank(…)` goes to `ignored`; any other call in a chain or other statement (`.jux(rev)`, `.every(…)`, `.gain(…)`,
`samples(…)`, `note(…)`) goes to `unsupported`, and the rest still plays.

```js
fromStrudel('setcpm(110/4)\ns("bd*4, [~ sd]*2").bank("RolandTR909").fast(2).jux(rev)')
// → { strudel: true, ok: true, src: '[bd*4, [~ sd]*2]*2', bpm: 110, ignored: ['.bank("RolandTR909")'], unsupported: ['.jux(rev)'] }
strudelUrl('bd*4, [~ sd]*2, hh*8')   // → 'https://strudel.cc/#cygiYmQqNCwgW34gc2RdKjIsIGhoKjgiKQ%3D%3D'
```

One OAV bar is one Strudel cycle of four beats, so `b` bpm is `setcpm(b/4)` (strudel.cc's docs: "To set a specific bpm, use
`setcpm(bpm/bpc)`", bpc = beats per cycle). The link format was read off strudel.cc's address bar (2026-10-15); no Strudel
code runs in, or ships with, OAV.

## Errors

`error` is `{ code, index, length, message, hint }` (`index`/`length` mark the characters in `src`; `message` and
`hint` are English, and an app shows its own language from `code`). `unknown-word` also carries `suggestion`
(the closest word, or `null`).

| code | when | example |
|---|---|---|
| `empty` | nothing to play: empty text, `[]`, `< >`, an empty side of `,` | `""`, `"bd,"` |
| `unclosed` | `[`, `<` or `(` never closed; `index` is the opening character | `"bd [sd"`, `"bd(3,8"` |
| `unexpected` | a stray closer, a modifier with no sound before it, quotes, full-width punctuation (`＊`, `，`) | `"bd ]"`, `"! bd"` |
| `bad-number` | `*`, `/`, `@`, `!`, `?`, `:` without a usable number; `*0`, `/0`, `@0`; `?` above 1 | `"bd*"`, `"bd*0"` |
| `bad-euclid` | `( )` without two or three whole numbers, more hits than steps, zero steps | `"bd(9,8)"`, `"bd(3)"` |
| `unknown-word` | a word that is not in `words` (numbers too: `"1 0 1"`) | `"kik"` → suggestion `kick` |
| `unsupported` | `.` `|` `{ }` `%` `..` `^` | `"bd . sd"` |

## Time and randomness

Inside, time is exact fractions; a bar is computed on its own and turned into floats at the end, so bar 1 000 000
of `[bd sd sn]*3` lands on the same ninths as bar 1. `?` hashes `(seed, which ?, where in the pattern, when)`:
the same seed and bar always give the same hits, other bars and other seeds differ. It does not reproduce
Strudel's random numbers (those come from Strudel's own generator).

## Checked against strudel.cc

`tests/pattern.test.js` holds 71 strings and 39 Euclidean grids that were run in the strudel.cc REPL on
2026-10-15, with the events it printed copied in by hand (Strudel is not a test dependency). Where OAV
chooses differently, on purpose:

- **Rotation `r` of n steps or more** wraps around in OAV (`bd(3,8,10)` = `bd(3,8,2)`); strudel.cc plays those
  unrotated. Between −n and n the two agree. Direction: strudel.cc's docs call `r` "the starting position for
  distributing the beats" and its REPL starts the pattern r steps **later** (`bd(3,8,1)` → steps 1, 4, 7);
  Tidal's documentation describes the offset as moving the pattern left. OAV follows strudel.cc.
- **Refused instead of played**: `*0`, `/0`, `@0`, `(9,8)`, `(3,0)`, `(3,8,1.5)`, `.` grouping. strudel.cc
  plays silence, a guess, or groups.
- **Unknown names** are errors (`kik`); strudel.cc looks for a sample of that name. Word case is ignored (`BD`).
- Negative pulses play the gaps (`bd(-3,8)` = the five steps `bd(3,8)` leaves out), as strudel.cc does.

## Euclidean rhythms

`euclid()` follows Bjorklund's procedure as Toussaint describes it: k groups `[1]`, n − k groups `[0]`; keep
appending one remainder group to each leading group; stop when the remainder is a single group. The tests check
every rhythm listed in section 4 of the paper. Four of them, E(2,3), E(3,4), E(5,6), E(7,8), are printed there
as a rotation (`x.xx`) of what the stopping rule gives (`xxx.`); OAV plays the stopping rule's version, the
same as strudel.cc, and the test checks both are one necklace.

## Sources

- Strudel user documentation, mini-notation: https://strudel.cc/learn/mini-notation/ (and the REPL at https://strudel.cc)
- TidalCycles user documentation, mini-notation: https://tidalcycles.org/docs/reference/mini_notation
- G. Toussaint (2005). *The Euclidean Algorithm Generates Traditional Musical Rhythms.* BRIDGES 2005.
- A. McLean (2014). *Making programming languages to dance to: live coding with Tidal.* FARM 2014.
- F. Roos & A. McLean (2023). *Strudel: Live Coding Patterns on the Web.* ICLC 2023.

Full reference: [docs](https://openaudiovisual.com/docs/#packages-openav-pattern)
