// @openav/dmx · engine — what every light does at a given moment, as a pure function of time.
//
// Give it a time (and, for beat-synced chases and effects, a beat position or a tempo); it returns the bytes of every universe.
// The same time always gives the same bytes: no clock is read, no random number drawn, nothing accumulates frame by frame.
// So a look can be tested without a light, a recording can be rendered frame by frame, and scrubbing back shows what was.
//
// The layers, bottom to top (each one sees what the layers below made):
//   1 base scenes   the look that is just on                    4 effects     waves over a group (sine, saw, square, rainbow, chase, flicker)
//   2 cues          go to a scene, with fade in/out and a curve   5 overrides   live values (a fader, the microphone)
//   3 chases        scenes in turn, every n seconds or beats      6 submasters  a fader over a group: scales its dimmer
//                                                                 7 patch       per-fixture limits → grand master → blackout → bytes
//
// Safety (docs/evolve/2026-11-24-dmx-system.md §5): the flash cap, maxFlashHz (3 by default, the common photosensitive-epilepsy
// line), is held PER FIXTURE. First each effect and each chase on its own: a faster one is slowed to the cap (the floor, as
// before). Then each fixture: the rates of the sources that flash it (effects on its dimmer or colour, chases that change it
// with anything but position) are added up, and when the sum is over the cap those sources are slowed ON THAT FIXTURE until it
// is not: a rate in seconds by the same factor, one in beats halved so it stays on the beat, a chase's step doubled.
// state(t).slowed and describe().slowed say which fixtures and by how much. This is the part that can be computed, so it
// stays a pure function of time. Live values (set(), submaster(), params driven by a microphone) are not slowed here: the
// transport's flash guard (flash-guard.js) holds what each fixture really emits, whatever made it.
// Every strobe channel is held to the cap where its profile gives Hz, and kept open where it does not. A control channel
// (reset, lamp) is written by control() and nothing else.
// Blackout darkens intensity and colour and leaves position (pan, tilt), zoom and control channels where they are.

import { PROPS, defaultOf, checkCap } from './patch.js?v=2b72f18a';

const CURVES = { linear: (x) => x, smooth: (x) => x * x * (3 - 2 * x), in: (x) => x * x, out: (x) => 1 - (1 - x) * (1 - x) };
const WAVES = ['sine', 'saw', 'square', 'chase', 'flicker', 'rainbow'];
const EFFECT_PROPS = ['dimmer', 'pan', 'tilt', 'zoom', 'color'];
const FLASHY = new Set(['dimmer', 'color']);        // what a person sees flash: brightness and colour, not where the beam points
const MOVES = new Set(['pan', 'tilt', 'zoom']);
const MAX_LOG = 1000;                                // go() calls remembered (older ones have long finished fading)
const clamp01 = (v) => (v > 1 ? 1 : v > 0 ? v : 0);
const frac = (x) => x - Math.floor(x);
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const copyProps = (p) => Object.fromEntries(Object.entries(p).map(([k, v]) => [k, Array.isArray(v) ? [...v] : v]));   // a colour array changed later by the caller does not reach in

function lerp(a, b, w) {
  if (Array.isArray(a) || Array.isArray(b)) {
    const A = Array.isArray(a) ? a : [a, a, a], Bv = Array.isArray(b) ? b : [b, b, b];
    return [0, 1, 2].map((i) => A[i] * (1 - w) + Bv[i] * w);
  }
  return a * (1 - w) + b * w;
}
const scale = (v, w) => (Array.isArray(v) ? v.map((x) => x * w) : v * w);
const add = (a, b) => (a === null ? b : Array.isArray(a) ? a.map((x, i) => x + b[i]) : a + b);

/** A number in [0, 1) from (seed, fixture, step): the same three always give the same number. */
function hash01(seed, i, step) {
  let h = (seed | 0) ^ Math.imul(i + 1, 0x9e3779b1) ^ Math.imul(step | 0, 0x85ebca77);
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Hue 0..1 at full saturation and value, as [r, g, b]. */
function hue(h) {
  const k = (n) => (n + h * 6) % 6;
  const f = (n) => 1 - Math.max(0, Math.min(k(n), 4 - k(n), 1));
  return [f(5), f(3), f(1)];
}

function waveAt(wave, x, width, seed, i) {
  switch (wave) {
    case 'sine': return 0.5 - 0.5 * Math.cos(2 * Math.PI * x);   // starts dark, so a sine on a dimmer fades in
    case 'saw': return frac(x);
    case 'square': case 'chase': return frac(x) < width ? 1 : 0;
    case 'flicker': return hash01(seed, i, Math.floor(x));
    default: return 0;
  }
}

/**
 * The rate an effect really runs at under the flash cap: a rate in seconds is clamped to the cap, one in beats is halved
 * until it fits (so it stays on the beat). Position effects (pan, tilt, zoom) do not flash and keep their rate.
 */
function effectiveRate(fx, bpm, cap) {
  const toHz = (r) => (fx.unit === 'beat' ? (r * bpm) / 60 : r);
  let rate = fx.rate;
  if (FLASHY.has(fx.property) && Number.isFinite(cap) && toHz(rate) > cap) {
    if (fx.unit === 'beat') while (toHz(rate) > cap + 1e-9) rate /= 2;
    else rate = cap;
  }
  return { rate, hz: toHz(fx.rate), to: toHz(rate) };
}

/** The step length that keeps a chase at or under maxFlashHz: on/off takes two steps, so a step lasts at least 1 / (2 · cap). */
function chaseEvery(every, stepSeconds, cap) {
  if (!Number.isFinite(cap)) return every;
  let k = 1;
  while (stepSeconds * k < 1 / (2 * cap) - 1e-9) k *= 2;   // doubling keeps a beat-synced chase on the beat
  return every * k;
}

/** Flashes a second a chase makes with this step length: on and off take two steps. */
const chaseHz = (ch, every, bpm) => 1 / (2 * (ch.unit === 'beat' ? (every * 60) / bpm : every));

/**
 * How much each source is slowed on each fixture so the fixture stays at or under the cap. `list` holds the sources that
 * flash one fixture: { unit, hz (at the tempo it renders with, after its own cap), nom (the same at the engine's own bpm) }.
 * Each gets a share of the cap in proportion to its rate at the engine's own tempo (so a tempo that wobbles from a MIDI clock
 * never moves a rate in seconds, which would jump its wave), then a rate in seconds takes its share and one in beats is halved
 * until it fits it. Returns the factors (1 = not slowed), or null when the sum is within the cap.
 */
function share(list, cap) {
  const sum = list.reduce((a, s) => a + s.hz, 0);
  if (!(sum > cap + 1e-9)) return null;
  const k = cap / list.reduce((a, s) => a + s.nom, 0);
  return list.map((s) => {
    if (s.unit !== 'beat') return Math.min(1, k);
    let f = 1;
    while (s.hz * f > s.nom * k + 1e-9) f /= 2;
    return f;
  });
}

/** Scenes, cues, chases, effects and live values for a patch, rendered for any moment. */
export class DmxEngine {
  #patch;
  #scenes = new Map();
  #cues = new Map();
  #log = [];
  #n = 0;
  #base = [];
  #chases = new Map();
  #effects = new Map();
  #running = new Map();
  #overrides = new Map();
  #controls = new Map();
  #submasters = new Map();

  constructor(patch, { maxFlashHz = 3, bpm = 120 } = {}) {
    if (!patch || typeof patch.render !== 'function' || typeof patch.ids !== 'function') throw new TypeError('DmxEngine needs a Patch');
    checkCap(maxFlashHz);
    if (!(bpm > 0)) throw new RangeError('bpm is a number above 0');
    this.#patch = patch;
    /** Fastest flashing (Hz) an effect, a chase or a strobe channel may make. Raise it only on purpose. */
    this.maxFlashHz = maxFlashHz;
    /** Tempo for beat-synced chases and effects when render() is not given one. */
    this.bpm = bpm;
    /** Grand master, 0..1: scales every fixture's dimmer. */
    this.master = 1;
    /** True: every intensity and colour at 0; position, zoom and control channels stay. */
    this.blackout = false;
  }

  /** The patch this engine renders. */
  get patch() {
    return this.#patch;
  }

  #checkProps(props, ids, where) {
    if (!isObj(props)) throw new TypeError(`${where}: properties are an object such as { dimmer: 1, color: [1, 0.5, 0] }`);
    for (const [k, v] of Object.entries(props)) {
      if (k === 'color') { if (!(Array.isArray(v) && v.length === 3 && v.every(isNum))) throw new TypeError(`${where}: color is [r, g, b], each 0..1`); }
      else if (!isNum(v)) throw new TypeError(`${where}: ${k} is a number 0..1 (got ${JSON.stringify(v)})`);
      if (PROPS.includes(k)) continue;
      const slots = ids.map((id) => this.#patch.get(id).layout.byKey.get(k)).filter(Boolean);
      if (!slots.length) throw new Error(`${where}: "${k}" is not a property (${PROPS.join(', ')}) or a channel of these fixtures`);
      if (slots.some((s) => s.type === 'control')) throw new Error(`${where}: "${k}" is a control channel (reset, lamp): only control(id, key, byte) writes it`);
    }
  }

  #targets(target, where) {
    const ids = this.#patch.ids(target);
    if (!ids.length) throw new Error(`${where}: ${JSON.stringify(target)} is not a fixture or a group of the patch`);
    return ids;
  }

  /** Define (or replace) a scene: { target: properties }, a target being a fixture id, a group, '*' or a list of these. */
  scene(name, values) {
    if (typeof name !== 'string' || !name) throw new TypeError('a scene has a name');
    if (!isObj(values)) throw new TypeError(`scene ${name}: values are { target: { dimmer, color, … } }`);
    const entries = Object.entries(values).map(([target, props]) => {
      this.#checkProps(props, this.#targets(target, `scene ${name}`), `scene ${name} → ${target}`);
      return [target, copyProps(props)];
    });
    this.#scenes.set(name, entries);
    return this;
  }

  #sceneMap(name) {
    const m = new Map();
    for (const [target, props] of this.#scenes.get(name) || []) for (const id of this.#patch.ids(target)) Object.assign(m.get(id) || m.set(id, {}).get(id), props);
    return m;
  }

  #need(map, name, what) {
    if (!map.has(name)) throw new Error(`no ${what} "${name}"`);
  }

  /** The scenes that are on underneath everything (later names win where they set the same property). */
  base(...names) {
    for (const n of names) this.#need(this.#scenes, n, 'scene');
    this.#base = names;
    return this;
  }

  /**
   * Define a cue: go to `scene`. The times belong to the cue you go to, as on a lighting desk: it rises over its fadeIn while
   * whatever was on falls over its fadeOut (a shorter fadeOut than fadeIn makes a dip, where the look underneath shows).
   */
  cue(name, { scene, fadeIn = 0, fadeOut = fadeIn, curve = 'linear' } = {}) {
    if (typeof name !== 'string' || !name) throw new TypeError('a cue has a name');
    this.#need(this.#scenes, scene, 'scene');
    if (!(isNum(fadeIn) && fadeIn >= 0 && isNum(fadeOut) && fadeOut >= 0)) throw new RangeError(`cue ${name}: fadeIn and fadeOut are seconds ≥ 0`);
    if (!CURVES[curve]) throw new RangeError(`cue ${name}: curve is one of ${Object.keys(CURVES).join(', ')}`);
    this.#cues.set(name, { scene, fadeIn, fadeOut, curve: CURVES[curve], curveName: curve });
    return this;
  }

  /** Go to a cue at time `at` (seconds, on the clock render() is given). */
  go(name, at) {
    this.#need(this.#cues, name, 'cue');
    if (!isNum(at)) throw new TypeError(`go(${name}, at): at is a time in seconds`);
    this.#push({ cue: name, at });
    return this;
  }

  /** Fade the cues out at time `at`, over `fade` seconds (by default the live cue's own fadeOut), leaving what is under them. */
  release(at, fade) {
    if (!isNum(at)) throw new TypeError('release(at): at is a time in seconds');
    if (fade !== undefined && !(isNum(fade) && fade >= 0)) throw new RangeError('release(at, fade): fade is seconds ≥ 0');
    this.#push({ cue: null, at, fade });
    return this;
  }

  #push(e) {
    this.#log.push({ ...e, n: this.#n++ });
    this.#log.sort((a, b) => a.at - b.at || a.n - b.n);
    if (this.#log.length > MAX_LOG) this.#log.splice(0, this.#log.length - MAX_LOG);
  }

  /**
   * Define (or replace) a chase: the scenes in `steps` in turn, each lasting `every` beats or seconds (`unit`), the last
   * `fade` of each step (0..1) crossfading into the next. It runs from `start` (a beat or a second).
   */
  chase(name, { steps, every = 1, unit = 'beat', fade = 0, start = 0, curve = 'linear' } = {}) {
    if (typeof name !== 'string' || !name) throw new TypeError('a chase has a name');
    if (this.#effects.has(name)) throw new Error(`"${name}" is already an effect`);
    if (!Array.isArray(steps) || !steps.length) throw new TypeError(`chase ${name}: steps is a list of scene names`);
    for (const s of steps) this.#need(this.#scenes, s, 'scene');
    if (!(isNum(every) && every > 0)) throw new RangeError(`chase ${name}: every is a step length above 0`);
    if (unit !== 'beat' && unit !== 'second') throw new RangeError(`chase ${name}: unit is 'beat' or 'second'`);
    if (!(isNum(fade) && fade >= 0 && fade <= 1)) throw new RangeError(`chase ${name}: fade is 0..1 of a step`);
    if (!isNum(start)) throw new TypeError(`chase ${name}: start is a number`);
    if (!CURVES[curve]) throw new RangeError(`chase ${name}: curve is one of ${Object.keys(CURVES).join(', ')}`);
    this.#chases.set(name, { steps: [...steps], every, unit, fade, start, curve: CURVES[curve], curveName: curve, local: new Map() });
    if (!this.#running.has(name)) this.#running.set(name, true);
    this.#tidy();
    return this;
  }

  /**
   * Define (or replace) an effect over a target. `rate` is cycles per second or per beat (`unit`);
   * `depth` 0..1 is how far it moves the value under it; `spread` puts fixture i of n behind the first by spread · i / n of a cycle.
   * On dimmer it only takes light away (never brighter than the look under it); on pan, tilt, zoom it swings around the
   * value under it; rainbow runs on color and mixes over it by depth. `seed` makes a flicker repeatable.
   */
  effect(name, { target, property = 'dimmer', wave = 'sine', rate = 1, unit = 'second', depth = 1, phase = 0, spread, width, seed = 1 } = {}) {
    if (typeof name !== 'string' || !name) throw new TypeError('an effect has a name');
    if (this.#chases.has(name)) throw new Error(`"${name}" is already a chase`);
    this.#targets(target, `effect ${name}`);
    if (!WAVES.includes(wave)) throw new RangeError(`effect ${name}: wave is one of ${WAVES.join(', ')}`);
    if (!EFFECT_PROPS.includes(property)) throw new RangeError(`effect ${name}: property is one of ${EFFECT_PROPS.join(', ')}`);
    if ((wave === 'rainbow') !== (property === 'color')) throw new RangeError(`effect ${name}: rainbow runs on color, and color takes only rainbow`);
    if (!(isNum(rate) && rate >= 0)) throw new RangeError(`effect ${name}: rate is ≥ 0`);
    if (unit !== 'beat' && unit !== 'second') throw new RangeError(`effect ${name}: unit is 'beat' or 'second'`);
    for (const [k, v] of Object.entries({ depth, phase, seed })) if (!isNum(v)) throw new TypeError(`effect ${name}: ${k} is a number`);
    if (spread !== undefined && !isNum(spread)) throw new TypeError(`effect ${name}: spread is a number`);
    if (width !== undefined && !(isNum(width) && width > 0 && width <= 1)) throw new RangeError(`effect ${name}: width is 0..1 of a cycle`);
    // `local`: a phase of its own on a fixture where the per-fixture cap runs it slower (tune() keeps that wave going, too)
    this.#effects.set(name, { target, property, wave, rate, unit, depth: clamp01(depth), phase, spread: spread ?? (wave === 'chase' ? 1 : 0), width, seed, local: new Map() });
    if (!this.#running.has(name)) this.#running.set(name, true);
    this.#tidy();
    return this;
  }

  /**
   * Change a running effect's rate or depth from time `at` on (seconds, on the clock render() is given) without a jump:
   * the wave goes on from where it is at `at`, only faster or slower. Redefining it with effect() would restart its phase,
   * and a knob turned slowly on a wave that is 100 s along would sweep it through many cycles in a moment: a flicker
   * faster than any cap. `beat` (and `bpm`) when render() is given a beat position, as render() takes them.
   */
  tune(name, { rate, depth } = {}, at, { beat, bpm } = {}) {
    const fx = this.#effects.get(name);
    if (!fx) throw new Error(`no effect "${name}"${this.#chases.has(name) ? ' (that is a chase: run() starts and stops it)' : ''}`);
    if (rate !== undefined) {
      if (!(isNum(rate) && rate >= 0)) throw new RangeError(`tune ${name}: rate is ≥ 0`);
      if (!isNum(at)) throw new TypeError(`tune(${name}, { rate }, at): at is the time (seconds) the new rate takes over, so the wave can go on from where it is`);
      if (beat !== undefined && !isNum(beat)) throw new TypeError('beat is a number (a beat position)');
      const B = bpm === undefined ? this.bpm : bpm;
      if (!(B > 0)) throw new RangeError('bpm is a number above 0');
      const cap = checkCap(this.maxFlashHz);
      const u = fx.unit === 'beat' ? (beat === undefined ? (at * B) / 60 : beat) : at;
      const before = this.#where(at, beat, B);                     // every wave and chase on every fixture, before
      const x = u * effectiveRate(fx, B, cap).rate + fx.phase;     // where the wave is at `at`
      fx.rate = rate;
      fx.phase = x - u * effectiveRate(fx, B, cap).rate;           // …and the same place with the new rate
      // a new rate changes the sum on the fixtures it shares, so the per-fixture cap can run another wave or chase there at a
      // new speed too: each of those goes on from where it is as well (else a knob turned on one would jump the other at every step)
      this.#anchor(before, at, beat, B);
    }
    if (depth !== undefined) {
      if (!isNum(depth)) throw new TypeError(`tune ${name}: depth is a number 0..1`);
      fx.depth = clamp01(depth);
    }
    return this;
  }

  /**
   * A fader over a group (a submaster): after every layer, the dimmer of each fixture in `target` is multiplied by `level`
   * (0..1), so the cues, chases and effects under it keep running, only brighter or dimmer. Two submasters over one fixture
   * multiply. `null` takes it away.
   */
  submaster(target, level) {
    const key = JSON.stringify(target);
    if (level === null) { this.#submasters.delete(key); return this; }
    this.#targets(target, 'submaster');
    if (!isNum(level)) throw new TypeError(`submaster(${key}, level): level is a number 0..1 (or null)`);
    this.#submasters.set(key, { target, level: clamp01(level) });
    return this;
  }

  /**
   * What this engine holds, as plain data (copies): the names of its scenes and cues, the base, every chase and effect with
   * its settings and whether it runs, the submasters, master, blackout, maxFlashHz and bpm, and `slowed`: the fixtures the
   * per-fixture flash cap slows at the engine's own bpm (as state(t).slowed). For a panel, a test, a log.
   */
  describe() {
    const chases = {}, effects = {};
    for (const [n, c] of this.#chases) chases[n] = { steps: [...c.steps], every: c.every, unit: c.unit, fade: c.fade, start: c.start, curve: c.curveName, running: !!this.#running.get(n) };
    for (const [n, f] of this.#effects) {
      const { target, property, wave, rate, unit, depth, phase, spread, width, seed } = f;
      effects[n] = { target: Array.isArray(target) ? [...target] : target, property, wave, rate, unit, depth, phase, spread, width, seed, running: !!this.#running.get(n) };
    }
    return {
      scenes: [...this.#scenes.keys()], cues: [...this.#cues.keys()], base: [...this.#base], chases, effects,
      submasters: [...this.#submasters.values()].map((s) => ({ target: Array.isArray(s.target) ? [...s.target] : s.target, level: s.level })),
      master: this.master, blackout: !!this.blackout, maxFlashHz: this.maxFlashHz, bpm: this.bpm,
      slowed: this.#budget(this.bpm).slowed,
    };
  }

  /** Take a chase or an effect away. */
  remove(name) {
    this.#chases.delete(name);
    this.#effects.delete(name);
    this.#running.delete(name);
    this.#tidy();
    return this;
  }

  /** Start (true) or stop (false) a chase or an effect by name. Both run from the moment they are defined. */
  run(name, on = true) {
    if (!this.#chases.has(name) && !this.#effects.has(name)) throw new Error(`no chase or effect "${name}"`);
    this.#running.set(name, !!on);
    this.#tidy();
    return this;
  }

  /** Live values on top of everything (a fader, the microphone): merged per fixture, the latest set wins. */
  set(target, props) {
    const ids = this.#targets(target, 'set');
    this.#checkProps(props, ids, 'set');
    for (const id of ids) Object.assign(this.#overrides.get(id) || this.#overrides.set(id, {}).get(id), copyProps(props));
    return this;
  }

  /** Drop live values: all of them, a target's, or only some properties of a target. */
  clear(target, keys) {
    if (target === undefined) { this.#overrides.clear(); return this; }
    for (const id of this.#patch.ids(target)) {
      if (keys === undefined) this.#overrides.delete(id);
      else { const o = this.#overrides.get(id); if (o) for (const k of [].concat(keys)) delete o[k]; }
    }
    return this;
  }

  /** Write a control channel (reset, lamp on/off) with a byte, or null to let it go back to its default. The only way to reach one. */
  control(id, key, value) {
    const rec = this.#patch.get(id);
    if (!rec) throw new Error(`no fixture "${id}" in the patch`);
    const s = rec.layout.byKey.get(key);
    if (!s || s.type !== 'control') throw new Error(`${id}: "${key}" is not a control channel of ${rec.profile.id} ${rec.mode.id}`);
    const c = this.#controls.get(id) || this.#controls.set(id, {}).get(id);
    if (value === null) delete c[key];
    else if (Number.isInteger(value) && value >= 0 && value <= 255) c[key] = value;
    else throw new RangeError(`${id}: control ${key} is a byte 0–255 (or null)`);
    return this;
  }

  /** The fixtures a chase changes with anything but position (pan, tilt, zoom): the ones it can flash. */
  #lit(ch) {
    const ids = new Set();
    for (const step of ch.steps) for (const [id, props] of this.#sceneMap(step)) if (Object.keys(props).some((k) => !MOVES.has(k))) ids.add(id);
    return ids;
  }

  /**
   * The flash cap at tempo B, per source and per fixture. Depends on what is defined and running and on the tempo, never on
   * the time, so describe() can report it and the same t still gives the same bytes.
   * → { effects: name → { rate, hz, to }, chases: name → { every, stepSeconds }, factor: "kind\0name" → (id → 0..1), slowed }
   */
  #budget(B) {
    const cap = this.maxFlashHz, P = this.#patch, N = this.bpm;
    const per = new Map();                              // fixture id → the sources that flash it
    const add = (id, src) => (per.get(id) || per.set(id, []).get(id)).push(src);
    const effects = new Map(), chases = new Map();
    for (const [name, fx] of this.#effects) {
      const own = effectiveRate(fx, B, cap);            // the floor: this effect on its own, at or under the cap
      effects.set(name, own);
      if (!this.#running.get(name) || !FLASHY.has(fx.property)) continue;
      const nom = effectiveRate(fx, N, cap).to;
      for (const id of P.ids(fx.target)) {
        const rec = P.get(id);
        if (!rec || (fx.property === 'color' && !rec.layout.colors.length)) continue;   // a rainbow on a light with no colour does nothing to it
        add(id, { kind: 'effect', name, unit: fx.unit, hz: own.to, nom });
      }
    }
    for (const [name, ch] of this.#chases) {
      const stepSeconds = ch.unit === 'beat' ? (ch.every * 60) / B : ch.every;
      const lit = this.#lit(ch);
      // a chase that only moves heads does not flash; anything else is held to the cap on its own first (the floor)
      const every = lit.size ? chaseEvery(ch.every, stepSeconds, cap) : ch.every;
      chases.set(name, { every, stepSeconds });
      if (!this.#running.get(name) || !lit.size) continue;
      const nom = chaseHz(ch, chaseEvery(ch.every, ch.unit === 'beat' ? (ch.every * 60) / N : ch.every, cap), N);
      for (const id of lit) add(id, { kind: 'chase', name, unit: ch.unit, hz: chaseHz(ch, every, B), nom });
    }
    const factor = new Map(), slowed = [];
    for (const [id, list] of per) {
      const f = share(list, cap);
      if (!f) continue;
      const sources = list.map((src, i) => {
        const key = `${src.kind}\0${src.name}`;
        (factor.get(key) || factor.set(key, new Map()).get(key)).set(id, f[i]);
        return { kind: src.kind, name: src.name, hz: src.hz, to: src.hz * f[i] };
      });
      slowed.push({ id, hz: list.reduce((a, x) => a + x.hz, 0), to: sources.reduce((a, x) => a + x.to, 0), sources });
    }
    return { effects, chases, factor, slowed };
  }

  /** Where every wave and chase is on every fixture at time `at` (and at what speed), for tune() to carry on from. */
  #where(at, beat, B) {
    const plan = this.#budget(B), beatPos = beat === undefined ? (at * B) / 60 : beat;
    const fx = new Map(), ch = new Map();
    for (const [name, e] of this.#effects) {
      const u = e.unit === 'beat' ? beatPos : at, { rate } = plan.effects.get(name), fac = plan.factor.get(`effect\0${name}`);
      const m = new Map();
      for (const id of this.#patch.ids(e.target)) { const r = rate * (fac?.get(id) ?? 1); m.set(id, { r, x: u * r + (e.local.get(id) ?? e.phase) }); }
      fx.set(name, m);
    }
    for (const [name, c] of this.#chases) {
      const u = c.unit === 'beat' ? beatPos : at, { every } = plan.chases.get(name), fac = plan.factor.get(`chase\0${name}`);
      const m = new Map();
      for (const id of fac?.keys() || []) { const ev = every / fac.get(id); m.set(id, { ev, pos: (u - (c.local.get(id) ?? c.start)) / ev }); }
      for (const id of c.local.keys()) if (!m.has(id)) m.set(id, { ev: every, pos: (u - c.local.get(id)) / every });
      ch.set(name, m);
    }
    return { fx, ch, plan };
  }

  /** After a change at `at`: every wave and chase whose speed changed on a fixture goes on from where it was there. */
  #anchor(before, at, beat, B) {
    const plan = this.#budget(B), beatPos = beat === undefined ? (at * B) / 60 : beat;
    for (const [name, e] of this.#effects) {
      const u = e.unit === 'beat' ? beatPos : at, { rate } = plan.effects.get(name), fac = plan.factor.get(`effect\0${name}`);
      for (const [id, was] of before.fx.get(name) || []) {
        const r = rate * (fac?.get(id) ?? 1);
        if (r === was.r && !e.local.has(id)) continue;   // same speed, shared phase: nothing to carry
        const p = was.x - u * r;
        if (p === e.phase) e.local.delete(id); else e.local.set(id, p);
      }
    }
    for (const [name, c] of this.#chases) {
      const u = c.unit === 'beat' ? beatPos : at, { every } = plan.chases.get(name), fac = plan.factor.get(`chase\0${name}`);
      const was = before.ch.get(name) || new Map();
      const ids = new Set([...(fac?.keys() || []), ...was.keys()]);
      for (const id of ids) {
        const ev = every / (fac?.get(id) ?? 1);
        const w = was.get(id) || { ev: before.plan.chases.get(name)?.every ?? every, pos: (u - c.start) / (before.plan.chases.get(name)?.every ?? every) };
        if (ev === w.ev && !c.local.has(id)) continue;
        const start = u - w.pos * ev;
        if (start === c.start) c.local.delete(id); else c.local.set(id, start);
      }
    }
  }

  /**
   * After a change that has no time (run, effect, chase, remove): a fixture that is no longer slowed by a wave or a chase
   * rejoins its shared phase (one jump, as the change itself makes), so a row does not stay out of step for good.
   */
  #tidy() {
    const plan = this.#budget(this.bpm);
    for (const [name, e] of this.#effects) { const fac = plan.factor.get(`effect\0${name}`); for (const id of [...e.local.keys()]) if (!fac?.has(id)) e.local.delete(id); }
    for (const [name, c] of this.#chases) { const fac = plan.factor.get(`chase\0${name}`); for (const id of [...c.local.keys()]) if (!fac?.has(id)) c.local.delete(id); }
  }

  #compose(t, { beat, bpm } = {}) {
    if (!isNum(t)) throw new TypeError('render(t): t is a time in seconds');
    // the cap turns a rate per beat into flashes per second with the tempo, so a beat position must come with the tempo it runs at
    if (beat !== undefined && bpm === undefined) throw new TypeError('render(t, { beat }): give bpm with beat (the flash cap needs the tempo the beats come at)');
    if (beat !== undefined && !isNum(beat)) throw new TypeError('beat is a number (a beat position)');
    const B = bpm === undefined ? this.bpm : bpm;
    if (!(B > 0)) throw new RangeError('bpm is a number above 0');
    checkCap(this.maxFlashHz);
    const beatPos = beat === undefined ? (t * B) / 60 : beat;
    const P = this.#patch, recs = P.fixtures, plan = this.#budget(B);
    const S = new Map(recs.map((r) => [r.id, {}]));
    const capped = [];
    const below = (rec, k) => { const v = S.get(rec.id)[k]; return v === undefined ? defaultOf(rec, k) : v; };

    // 1 base scenes
    for (const name of this.#base) for (const [id, props] of this.#sceneMap(name)) if (S.has(id)) Object.assign(S.get(id), props);

    // 2 cues: each go() rises over its cue's fadeIn; the next go() makes it fall over that next cue's fadeOut (a release: its own)
    const ev = this.#log.filter((e) => e.at <= t);
    const layers = [];
    ev.forEach((e, i) => {
      if (!e.cue) return;
      const c = this.#cues.get(e.cue);
      if (!c) return;
      const rise = (dt) => (c.fadeIn > 0 ? c.curve(clamp01(dt / c.fadeIn)) : 1);
      const next = ev[i + 1];
      let w = rise(t - e.at);
      if (next) {
        const by = next.cue ? this.#cues.get(next.cue) : null;
        const fall = by ? by.fadeOut : next.fade !== undefined ? next.fade : c.fadeOut, curve = by ? by.curve : c.curve;
        w = fall > 0 ? rise(next.at - e.at) * (1 - curve(clamp01((t - next.at) / fall))) : 0;
      }
      if (w > 0) layers.push({ values: this.#sceneMap(c.scene), w });
    });
    if (layers.length) for (const rec of recs) {
      const own = S.get(rec.id);
      const keys = new Set(layers.flatMap((l) => Object.keys(l.values.get(rec.id) || {})));
      for (const k of keys) {
        let W = 0, acc = null;
        for (const l of layers) { const v = (l.values.get(rec.id) || {})[k]; if (v === undefined) continue; W += l.w; acc = add(acc, scale(v, l.w)); }
        const b = below(rec, k);
        own[k] = W >= 1 || b === undefined ? scale(acc, 1 / W) : add(acc, scale(b, 1 - W));   // a dip between two cues shows what is under them
      }
    }

    // 3 chases: each fixture at its own step when the per-fixture cap slows the chase there
    for (const [name, ch] of this.#chases) {
      if (!this.#running.get(name)) continue;
      const { every, stepSeconds } = plan.chases.get(name);
      if (every !== ch.every) capped.push({ kind: 'chase', name, hz: 1 / (2 * stepSeconds), to: 1 / (2 * stepSeconds * (every / ch.every)) });
      const u = ch.unit === 'beat' ? beatPos : t, fac = plan.factor.get(`chase\0${name}`), n = ch.steps.length;
      const maps = new Map(), step = (i) => maps.get(i) || maps.set(i, this.#sceneMap(ch.steps[i])).get(i);
      for (const rec of recs) {
        const pos = (u - (ch.local.get(rec.id) ?? ch.start)) / (every / (fac?.get(rec.id) ?? 1));
        if (pos < 0) continue;
        const i = Math.floor(pos) % n, f = pos - Math.floor(pos);
        const w = ch.fade > 0 && f > 1 - ch.fade ? ch.curve((f - (1 - ch.fade)) / ch.fade) : 0;
        const a = step(i).get(rec.id) || {}, b = step((i + 1) % n).get(rec.id) || {}, own = S.get(rec.id);
        const keys = new Set([...Object.keys(a), ...(w > 0 ? Object.keys(b) : [])]);
        for (const k of keys) {
          const va = a[k] !== undefined ? a[k] : below(rec, k), vb = b[k] !== undefined ? b[k] : below(rec, k);
          own[k] = w > 0 && va !== undefined && vb !== undefined ? lerp(va, vb, w) : a[k] !== undefined ? a[k] : own[k];
        }
      }
    }

    // 4 effects
    for (const [name, fx] of this.#effects) {
      if (!this.#running.get(name)) continue;
      const ids = P.ids(fx.target).filter((id) => S.has(id));
      const n = ids.length;
      if (!n) continue;
      const { rate, hz, to } = plan.effects.get(name);                    // halving a rate in beats keeps it on the beat
      if (rate !== fx.rate) capped.push({ kind: 'effect', name, hz, to });
      const u = fx.unit === 'beat' ? beatPos : t, fac = plan.factor.get(`effect\0${name}`);
      const width = fx.width ?? (fx.wave === 'chase' ? 1 / n : 0.5);
      ids.forEach((id, i) => {
        const rec = P.get(id), own = S.get(id);
        // each fixture a little behind the one before (a chase walks 1 → 2 → 3); slower, from a phase of its own, where its sum is over the cap
        const x = u * rate * (fac?.get(id) ?? 1) + (fx.local.get(id) ?? fx.phase) - (fx.spread * i) / n;
        if (fx.property === 'color') {
          if (!rec.layout.colors.length) return;
          own.color = lerp(below(rec, 'color'), hue(frac(x)), fx.depth);
          return;
        }
        const b = below(rec, fx.property);
        if (b === undefined) return;
        const v = waveAt(fx.wave, x, width, fx.seed, i);
        own[fx.property] = fx.property === 'dimmer' ? b * (1 - fx.depth * (1 - v)) : clamp01(b + fx.depth * (v - 0.5));
      });
    }

    // 5 live overrides
    for (const [id, props] of this.#overrides) if (S.has(id)) Object.assign(S.get(id), props);

    // 6 submasters: scale the dimmer of what every layer made (levels over one fixture multiply)
    for (const { target, level } of this.#submasters.values()) for (const id of P.ids(target)) {
      const own = S.get(id);
      if (!own) continue;
      const d = own.dimmer === undefined ? defaultOf(P.get(id), 'dimmer') : own.dimmer;
      own.dimmer = clamp01(d) * level;
    }
    return { S, capped, slowed: plan.slowed, beat: beatPos };
  }

  #opts() {
    return { master: this.master, blackout: !!this.blackout, maxFlashHz: this.maxFlashHz };
  }

  /**
   * What every fixture gets at time t, as properties after every layer, its limits, the master and blackout:
   * { t, beat, fixtures: { id: { dimmer, color, pan, … } }, capped: [{ kind, name, hz, to }], slowed: [{ id, hz, to, sources }] }.
   * `capped` lists the effects and chases the cap slowed on their own; `slowed` the fixtures where the flashing sources
   * still added up past it, each with its sum before and after (Hz) and every source there: { kind, name, hz, to }.
   */
  state(t, { beat, bpm } = {}) {
    const { S, capped, slowed, beat: b } = this.#compose(t, { beat, bpm });
    const fixtures = {};
    for (const [id, props] of S) fixtures[id] = this.#patch.resolve(id, props, this.#opts());
    return { t, beat: b, fixtures, capped, slowed };
  }

  /** The bytes of every universe at time t (seconds). `beat` (a beat position) or `bpm` drive beat-synced chases and effects. */
  render(t, { beat, bpm } = {}) {
    const { S } = this.#compose(t, { beat, bpm });
    return this.#patch.render(Object.fromEntries(S), { ...this.#opts(), controls: Object.fromEntries(this.#controls) });
  }
}
