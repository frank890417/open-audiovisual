# @openav/pattern

Spine · rhythm in one line. A string of mini-notation (the way TidalCycles and Strudel write rhythm)
goes in; what plays in each bar comes out. Pure logic, no DOM, no audio: the drum machine and
oav-p5 ask it "what happens in bar 3?" and schedule the answer.

> **Credit and clean room.** The mini-notation way of writing comes from TidalCycles and Strudel
> ([tidalcycles.org](https://tidalcycles.org), [strudel.cc](https://strudel.cc)). This package is an
> independent implementation written from their public user documentation, the output of the
> strudel.cc REPL, and the papers below; no Strudel or Tidal source code was read or copied.
> 依公開文件與論文獨立實作；mini-notation 的寫法來自 TidalCycles／Strudel（https://tidalcycles.org、https://strudel.cc）。
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
