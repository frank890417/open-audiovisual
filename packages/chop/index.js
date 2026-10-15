// @openav/chop — values over time: lag, envelope, speed, spring, trail, slope, count.
//
// A knob, a microphone level or a drum hit is a number that jumps. What makes it look good on screen is how it
// MOVES between those jumps: a circle that opens at once when someone speaks and closes slowly (a VU meter), a
// shape that kicks on every bass drum and falls back, a rotation that runs faster the louder it is, a follower that
// overshoots and settles. TouchDesigner calls these operators CHOPs (Lag, Trigger, Speed, Spring, Trail, Slope,
// Count). The parameters here mean what Derivative's user documentation says they mean (docs.derivative.ca); the
// code is OAV's own.
//
// Pure logic: no DOM, no clock of its own. Every step is told how many seconds went by (dt), and each step is the
// exact solution over that interval for an input held at its new value, so a sketch at 30 fps and one at 144 fps
// draw the same curve (tests/chop.test.js holds them to 1%).
//
//   approach(current, target, seconds, dt)            one step of a lag (the time constant @openav/mapping's smooth uses)
//   new Lag({ up, down }).step(input, dt)              Lag CHOP: separate rise and fall times
//   envelope(times, t, attack, decay)                  Trigger CHOP: 0..1 after each event, as a function of time
//   new Speed().step(rate, dt)                         Speed CHOP: units per second → units
//   new Spring({ stiffness, damping }).step(t, dt)     Spring CHOP: a mass on a spring, pulled to the input
//   new Trail({ seconds }).step(value, dt) → values    Trail CHOP: the last few seconds, 60 values a second
//   new Slope().step(value, dt)                        Slope CHOP: change per second
//   new Count().step(on)                               Count CHOP: how many times it turned on
//
// Two kinds of seconds. `approach(…, seconds)` takes a one-pole time constant (63% of a change, 1 − 1/e), the definition
// @openav/mapping's `smooth` has always used. `Lag` takes TouchDesigner's Lag CHOP seconds: roughly the time to follow
// 90% of a change (docs.derivative.ca/Lag_CHOP), which is ln 10 ≈ 2.3 time constants, so lag(x, 0.1) here moves like a
// Lag CHOP set to 0.1 (2026-10-15, so the numbers a student learns in p5 carry over to TouchDesigner).

/** seconds a lag reaches 90% in, per second of time constant (ln 10): what a TouchDesigner Lag value corresponds to */
export const TD_LAG_RATIO = Math.LN10;

const num = (v) => (typeof v === 'boolean' ? (v ? 1 : 0) : v);
const finite = (v) => typeof v === 'number' && Number.isFinite(v);

/**
 * One step of a one-pole lag: move `current` toward `target`. `seconds` is the time constant (63% of the way after
 * `seconds`); 0 or less jumps. Exact for any dt, so the frame rate does not change the curve.
 */
export function approach(current, target, seconds, dt) {
  if (!(seconds > 0)) return target;
  if (!(dt > 0)) return current;
  return target + (current - target) * Math.exp(-dt / seconds);
}

/**
 * Lag CHOP: follows its input with one lag while the input is above the output (`up`) and another while it is below
 * (`down`), in TouchDesigner's seconds: about 90% of a change is followed after that long. up 0.03 / down 0.4 is a VU meter: it opens at once and closes slowly. The first input is taken
 * as it is (nothing glides in from zero). A boolean counts as 0 / 1: lag(mouseIsPressed) is a soft switch.
 */
export class Lag {
  constructor({ up = 0.1, down = up, value = null } = {}) {
    this.up = up; this.down = down;
    this.value = finite(value) ? value : null;
  }
  /** @returns the output after dt seconds with the input held at `input` (a non-number passes through, state untouched) */
  step(input, dt, up = this.up, down = this.down) {
    const x = num(input);
    if (!finite(x)) return x;
    if (this.value === null) return (this.value = x);
    this.value = approach(this.value, x, (x > this.value ? up : down) / TD_LAG_RATIO, dt);
    return this.value;
  }
  reset(value = null) { this.value = finite(value) ? value : null; return this; }
}

/**
 * One envelope, `elapsed` seconds after its trigger: a straight rise from `from` to `peak` (TouchDesigner measures the
 * attack from zero to the peak, so a retrigger from halfway up takes half the attack), then a fall to 0 in exactly
 * `decay` seconds along (1 − u)²: quick at first, landing softly, the way a kick drum's swell looks right.
 */
export function envelopeStage(elapsed, attack, decay, from = 0, peak = 1) {
  if (!(elapsed >= 0)) return from;
  const a = attack > 0 ? attack * Math.max(0, 1 - from / (peak || 1)) : 0;
  if (elapsed < a) return from + (peak - from) * (elapsed / a);
  if (!(decay > 0)) return 0;
  const u = (elapsed - a) / decay;
  return u >= 1 ? 0 : peak * (1 - u) * (1 - u);
}

/**
 * Trigger CHOP as a function of time: the envelope's level at time `t` (seconds) given the times its events happened
 * (ascending, same clock). A new event while the last one still sounds restarts from where the envelope is, never
 * from zero, so fast hits pile up into a plateau instead of flickering. Pure: the same events and the same `t` give the
 * same level at any frame rate, for any attack and decay (they may change every frame: a knob on the decay).
 * @param {number[]} times  event times in seconds, oldest first (only the last few matter)
 */
export function envelope(times, t, attack = 0.01, decay = 0.3, peak = 1) {
  if (!times || !times.length) return 0;
  let n = times.length - 1;
  while (n >= 0 && times[n] > t) n--;                 // events after `t` have not happened yet
  if (n < 0) return 0;
  const life = Math.max(0, attack) + Math.max(0, decay);
  let m = n;                                           // the oldest event whose envelope still sounded when the next came
  while (m > 0 && times[m] - times[m - 1] < life && n - m < 64) m--;
  let from = 0;
  for (let j = m + 1; j <= n; j++) from = envelopeStage(times[j] - times[j - 1], attack, decay, from, peak);
  return envelopeStage(t - times[n], attack, decay, from, peak);
}

/** Speed CHOP: adds `rate` per second. rate 1 → +1 every second; rotate(speed(TWO_PI)) is one turn a second. */
export class Speed {
  constructor({ value = 0 } = {}) { this.value = finite(value) ? value : 0; }
  step(rate, dt) {
    const r = num(rate);
    if (finite(r) && dt > 0) this.value += r * dt;
    return this.value;
  }
  reset(value = 0) { this.value = finite(value) ? value : 0; return this; }
}

/**
 * One step of a damped spring (mass 1) pulled toward `target`: x'' = −stiffness·(x − target) − damping·x'.
 * Solved exactly over dt for a target held still (under-, critically and over-damped), so a large dt never blows up
 * and the frame rate does not change the motion. damping = 2·√stiffness is the edge where it stops bouncing.
 * @returns {[number, number]} [position, velocity]
 */
export function springStep(x, v, target, stiffness, damping, dt) {
  if (!(dt > 0)) return [x, v];
  const k = Math.max(0, stiffness), c = Math.max(0, damping);
  if (!(k > 0)) {                                       // no spring: only the damping slows it down
    if (!(c > 0)) return [x + v * dt, v];
    const e = Math.exp(-c * dt);
    return [x + v * (1 - e) / c, v * e];
  }
  const y = x - target, w = Math.sqrt(k), z = c / (2 * w);
  let yt, vt;
  if (Math.abs(z - 1) < 1e-6) {                         // critically damped
    const e = Math.exp(-w * dt), b = v + w * y;
    yt = (y + b * dt) * e;
    vt = (b - w * (y + b * dt)) * e;
  } else if (z < 1) {                                   // under-damped: it bounces
    const wd = w * Math.sqrt(1 - z * z), e = Math.exp(-z * w * dt), cs = Math.cos(wd * dt), sn = Math.sin(wd * dt);
    const b = (v + z * w * y) / wd;
    yt = e * (y * cs + b * sn);
    vt = e * ((b * wd - z * w * y) * cs - (y * wd + z * w * b) * sn);
  } else {                                              // over-damped: it creeps
    const s = w * Math.sqrt(z * z - 1), r1 = -z * w + s, r2 = -z * w - s;
    const c2 = (v - r1 * y) / (r2 - r1), c1 = y - c2, e1 = Math.exp(r1 * dt), e2 = Math.exp(r2 * dt);
    yt = c1 * e1 + c2 * e2;
    vt = c1 * r1 * e1 + c2 * r2 * e2;
  }
  return [target + yt, vt];
}

/**
 * Spring CHOP (input = position): follows its input like a mass on a spring, overshooting and settling. stiffness is
 * how fast it swings (100: about 1.6 swings a second), damping how soon it settles (6: two or three bounces; 20 and up:
 * none). The first input is taken as it is.
 */
export class Spring {
  constructor({ stiffness = 100, damping = 6, value = null } = {}) {
    this.stiffness = stiffness; this.damping = damping;
    this.value = finite(value) ? value : null; this.velocity = 0;
  }
  step(target, dt, stiffness = this.stiffness, damping = this.damping) {
    const x = num(target);
    if (!finite(x)) return x;
    if (this.value === null) { this.value = x; this.velocity = 0; return x; }
    [this.value, this.velocity] = springStep(this.value, this.velocity, x, stiffness, damping, dt);
    return this.value;
  }
  reset(value = null) { this.value = finite(value) ? value : null; this.velocity = 0; return this; }
}

/**
 * Trail CHOP: the input over the last `seconds`, as `rate` values a second (60) plus the input of this step at the end,
 * oldest first. The length is fixed from the first step (filled with the first value), so a sketch can draw it across
 * the canvas from frame one, and the same at any frame rate: between two steps the values are interpolated.
 */
export class Trail {
  constructor({ seconds = 2, rate = 60 } = {}) {
    this.rate = rate > 0 ? rate : 60;
    this.seconds = seconds > 0 ? seconds : 2;
    this.buf = null; this.head = 0; this.acc = 0; this.last = 0;
  }
  get size() { return Math.max(2, Math.min(36000, Math.round(this.seconds * this.rate))); }
  _fill(v) { this.buf = new Array(this.size).fill(v); this.head = 0; this.acc = 0; }
  _resize() {                                           // seconds changed: keep the newest values, pad with the oldest
    const old = this.ordered(), n = this.size;
    const keep = old.slice(Math.max(0, old.length - n));
    while (keep.length < n) keep.unshift(keep[0]);
    this.buf = keep; this.head = 0;
  }
  ordered() { return this.buf ? this.buf.slice(this.head).concat(this.buf.slice(0, this.head)) : []; }
  step(value, dt, seconds = this.seconds) {
    const x = num(value);
    if (!finite(x)) return this.values();
    if (seconds > 0 && seconds !== this.seconds) { this.seconds = seconds; if (this.buf && this.buf.length !== this.size) this._resize(); }
    if (!this.buf) { this._fill(x); this.last = x; return this.values(); }
    const h = 1 / this.rate;
    if (dt > this.buf.length * h) { this._fill(x); this.acc = 0; this.last = x; return this.values(); }   // a long gap: what was there is gone
    if (dt > 0) {
      this.acc += dt;
      while (this.acc >= h - 1e-9) {                     // (the tolerance: 1/144 s added up rounds just under 1/60 s)
        this.acc -= h;
        const f = Math.min(1, Math.max(0, 1 - this.acc / dt));   // where this sample sits between the last step and this one
        this.buf[this.head] = this.last + (x - this.last) * f;
        this.head = (this.head + 1) % this.buf.length;
      }
    }
    this.last = x;
    return this.values();
  }
  /** oldest → newest, the newest being the last input */
  values() { if (!this.buf) return []; const out = this.ordered(); out.push(this.last); return out; }
  reset() { this.buf = null; this.head = 0; this.acc = 0; return this; }
}

/** Slope CHOP: how fast the input changes, per second (0 on the first step; a step of 0 s keeps the last slope). */
export class Slope {
  constructor() { this.prev = null; this.value = 0; }
  step(input, dt) {
    const x = num(input);
    if (!finite(x)) return this.value;
    if (this.prev === null) { this.prev = x; return (this.value = 0); }
    if (dt > 0) { this.value = (x - this.prev) / dt; this.prev = x; }
    return this.value;
  }
  reset() { this.prev = null; this.value = 0; return this; }
}

/**
 * Count CHOP: how many times the input turned on (true, or a number above `threshold`). With a limit it loops,
 * 0 … limit − 1: count(beat, 4) walks 0 1 2 3 0 1 …
 */
export class Count {
  constructor({ threshold = 0.5 } = {}) { this.threshold = threshold; this.on = false; this.total = 0; }
  step(input, limit = 0) {
    const x = num(input), on = finite(x) && x > this.threshold;
    if (on && !this.on) this.total++;
    this.on = on;
    return wrapCount(this.total, limit);
  }
  reset(value = 0) { this.total = value | 0; this.on = false; return this; }
}

/** a count looped to 0 … limit − 1 (limit ≤ 0 or none: as it is) */
export function wrapCount(total, limit) {
  const n = Math.floor(limit);
  return n > 0 ? ((total % n) + n) % n : total;
}

/** the defaults, for docs and UIs */
export const DEFAULTS = Object.freeze({
  lag: { up: 0.1, down: 0.1 },
  envelope: { attack: 0.01, decay: 0.3 },
  spring: { stiffness: 100, damping: 6 },
  trail: { seconds: 2, rate: 60 },
  count: { threshold: 0.5 },
});
