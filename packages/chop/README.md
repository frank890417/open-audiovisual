# @openav/chop

Mapping · values over time. A knob, a microphone level or a drum hit is a number that jumps; what makes it look
good is how it moves between the jumps. A circle that opens at once when someone speaks and closes slowly, a
shape that swells on every kick, a rotation that runs faster the louder it is, a follower that overshoots and
settles. TouchDesigner calls these operators CHOPs; this package has the ones a visual needs most, under the
names a student will meet there: Lag, Trigger (here `envelope`), Speed, Spring, Trail, Slope, Count.

> **Credit.** What each parameter means follows Derivative's TouchDesigner user documentation
> ([Lag](https://docs.derivative.ca/Lag_CHOP), [Trigger](https://docs.derivative.ca/Trigger_CHOP),
> [Speed](https://docs.derivative.ca/Speed_CHOP), [Spring](https://docs.derivative.ca/Spring_CHOP),
> [Trail](https://docs.derivative.ca/Trail_CHOP), [Slope](https://docs.derivative.ca/Slope_CHOP),
> [Count](https://docs.derivative.ca/Count_CHOP)). The code is OAV's own. 參數意義參考 TouchDesigner 官方文件，OAV 自行實作。

Pure logic: no DOM, no clock of its own. Every step is told how many seconds went by, and each step is the exact
solution over that interval with the input held at its new value, so 30 fps and 144 fps draw the same curve
(`tests/chop.test.js` holds them to 1%). In a p5 sketch you do not import it: [oav-p5](../../p5/README.md) gives
`lag()`, `env()`, `speed()`, `spring()`, `trail()`, `slope()`, `count()` one line each, and keeps their memory per call.

```js
import { Lag, envelope, Spring } from '@openav/chop';
const vu = new Lag({ up: 0.03, down: 0.4 });            // opens at once, closes slowly
function frame(dt, t) {
  const r = 50 + vu.step(micLevel, dt) * 300;
  const pump = envelope(kickTimes, t, 0.01, 0.3);        // 0..1: 1 just after each kick, 0 after 0.31 s
}
```

## Exports

| export | signature |
|---|---|
| `approach` | `approach(current, target, seconds, dt)` → the next value of a one-pole lag. `seconds` is the time constant: 63% of a change after `seconds`. `@openav/mapping`'s `smooth` steps with this function |
| `Lag` | `new Lag({ up = 0.1, down = up, value })` · `step(input, dt, up?, down?)` → output · `reset(value?)`. `up` while the input is above the output, `down` while below (Lag CHOP's Lag 1 / Lag 2). The first input is taken as it is; a boolean is 0 / 1; a non-number passes through untouched |
| `envelope` | `envelope(times, t, attack = 0.01, decay = 0.3, peak = 1)` → 0..peak: the Trigger CHOP's level at time `t` for events at `times` (seconds, oldest first). A straight attack (measured 0 → peak, so a retrigger from halfway takes half), then a fall to 0 in exactly `decay` seconds along (1 − u)². A new event while the last still sounds starts from where it is. Pure: any frame rate, attack and decay may change every frame |
| `envelopeStage` | `envelopeStage(elapsed, attack, decay, from = 0, peak = 1)` → one envelope `elapsed` seconds after its trigger |
| `Speed` | `new Speed({ value = 0 })` · `step(rate, dt)` → position · `reset(value?)`. Adds `rate` per second (Speed CHOP) |
| `Spring` | `new Spring({ stiffness = 100, damping = 6 })` · `step(target, dt, stiffness?, damping?)` → position (`velocity` alongside) · `reset(value?)`. A mass of 1 on a spring pulled to the input (Spring CHOP, input = position). `damping = 2·√stiffness` is where it stops bouncing |
| `springStep` | `springStep(x, v, target, stiffness, damping, dt)` → `[x, v]`, solved exactly (under-, critically, over-damped): a large dt never blows up |
| `Trail` | `new Trail({ seconds = 2, rate = 60 })` · `step(value, dt, seconds?)` → array, oldest first: `rate` values a second (interpolated between steps) plus this step's input last; fixed length from the first step, filled with the first value (Trail CHOP) · `values()` · `reset()` |
| `Slope` | `new Slope()` · `step(value, dt)` → change per second (Slope CHOP); 0 on the first step |
| `Count` | `new Count({ threshold = 0.5 })` · `step(on, limit = 0)` → how many times it turned on (true, or a number above the threshold); with `limit` it loops 0 … limit − 1 (Count CHOP) |
| `wrapCount` | `wrapCount(total, limit)` → `total` looped to 0 … limit − 1 |
| `TD_LAG_RATIO` | `Math.LN10` (≈ 2.30): see below |
| `DEFAULTS` | the defaults above, frozen |

## The time constant, and TouchDesigner's

`seconds` in `approach` and `Lag` is a time constant: after `seconds` the output has covered 63% (1 − 1/e) of a
change, after 2.3 × `seconds` 90%, after 4.6 × 99%. `@openav/mapping`'s `smooth` has always meant this, and both now
step with the same function. TouchDesigner's Lag CHOP documents its lag as roughly the time the output takes to
follow 90% of a change, which is 2.3 time constants: a lag of 0.1 here moves like a Lag CHOP set to about 0.23
(`TD_LAG_RATIO`). Trigger lengths (attack, decay) are lengths in both: the envelope is at 0 after `decay` seconds.
