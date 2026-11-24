// @openav/dmx · params — the engine's control points as params, so anything that drives a param drives the lights: a fader
// in the console, a MIDI knob through the mapper, the timeline's automation, the microphone, a phone.
//
//   const rig = dmxParams(engine, { groups: ['pars', 'heads'], effects: ['breathe'], chases: ['walk'] });
//   const world = { params: [...myParams, ...rig.params], update(dt, state) { t += dt; rig.apply(state, t); out.send(engine.render(t)); } };
//
// The engine never reads a signal: a route (audio/rms → dmx/pars/dimmer) is the mapper's business, and the world hands the
// resolved values in with apply(). That is rule 1 of the framework: continuous control goes through params.
//
//   dmx/master              grand master 0..1                     engine.master
//   dmx/blackout            0 / 1 (a step param)                  engine.blackout
//   dmx/<group>/dimmer      a submaster over the group, 0..1      engine.submaster(): scales what every layer made
//   dmx/<group>/hue         0..1 around the colour wheel          the group's colour in a base scene of its own (`rig.scene`),
//   dmx/<group>/saturation  0 (white) .. 1 (full colour)            under cues, chases and effects (a rainbow mixes over it)
//   dmx/<effect>/rate       cycles a second (or a beat)           engine.tune(): the wave speeds up from where it is, no jump
//   dmx/<effect>/depth      0..1                                  engine.tune()
//   dmx/<chase>/run         0 / 1                                 engine.run()
// Every default is what the engine says now (the master, an effect's rate and depth, whether a chase runs), so declaring the
// params changes nothing until something moves one, with one exception: a group with hue and saturation gets that colour
// from the start (a warm amber unless you pass { hue, saturation }). A group gets them only when its fixtures have colour.

const clamp01 = (v) => (v > 1 ? 1 : v > 0 ? v : 0);

/** Hue, saturation (0..1) at full value → [r, g, b] 0..1. */
export function hsv(h, s) {
  const f = (n) => { const k = (n + h * 6) % 6; return 1 - s * Math.max(0, Math.min(k, 4 - k, 1)); };
  return [f(5), f(3), f(1)];
}

/** [names] or { name: options } → [[name, options]] */
const listOf = (x, what) => {
  if (x === undefined) return [];
  if (Array.isArray(x)) return x.map((n) => [n, {}]);
  if (x && typeof x === 'object') return Object.entries(x).map(([n, o]) => [n, o || {}]);
  throw new TypeError(`dmxParams: ${what} is a list of names or { name: options }`);
};

/**
 * The params that drive an engine, and the function that hands their values to it.
 * @param {import('./engine.js?v=6b091ec6').DmxEngine} engine
 * @param {object} [options]
 * @param {string} [options.prefix='dmx']   the first part of every key
 * @param {string[]|object} [options.groups]   group names, or { group: { hue, saturation } } with the colour to start from
 * @param {string[]|object} [options.effects]  effect names, or { effect: { max } } (the highest rate the param reaches; default 4, or twice the rate)
 * @param {string[]} [options.chases]          chase names
 * @param {string} [options.group='lights']    the param group (the console and the phone surface group by it)
 * @returns {{ params: object[], apply(state: object, t?: number, clock?: { beat?: number, bpm?: number }): object, scene: string, keys: object }}
 */
export function dmxParams(engine, { prefix = 'dmx', groups, effects, chases, group = 'lights' } = {}) {
  if (!engine || typeof engine.describe !== 'function' || typeof engine.render !== 'function') throw new TypeError('dmxParams(engine): a DmxEngine');
  if (typeof prefix !== 'string' || !/^[A-Za-z0-9_-]+$/.test(prefix)) throw new TypeError('dmxParams: prefix is letters, digits, - and _');
  const info = engine.describe();
  const patch = engine.patch;
  const params = [];
  const keys = { master: `${prefix}/master`, blackout: `${prefix}/blackout`, groups: {}, effects: {}, chases: {} };
  const add = (key, label, min, max, def, extra = {}) => params.push({ key, label, min, max, def, group, ...extra });
  add(keys.master, 'Master', 0, 1, clamp01(engine.master));
  add(keys.blackout, 'Blackout', 0, 1, engine.blackout ? 1 : 0, { step: 1 });

  const colourGroups = [];
  for (const [g, o] of listOf(groups, 'groups')) {
    const ids = patch.ids(g);
    if (!ids.length) throw new Error(`dmxParams: "${g}" is not a fixture or a group of the patch`);
    const k = keys.groups[g] = { dimmer: `${prefix}/${g}/dimmer` };
    add(k.dimmer, `${g} dimmer`, 0, 1, o.dimmer === undefined ? 1 : clamp01(o.dimmer));
    if (ids.some((id) => patch.get(id).layout.colors.length)) {
      k.hue = `${prefix}/${g}/hue`; k.saturation = `${prefix}/${g}/saturation`;
      add(k.hue, `${g} hue`, 0, 1, o.hue === undefined ? 0.08 : clamp01(o.hue));
      add(k.saturation, `${g} saturation`, 0, 1, o.saturation === undefined ? 0.75 : clamp01(o.saturation));
      colourGroups.push(g);
    }
  }
  for (const [name, o] of listOf(effects, 'effects')) {
    const fx = info.effects[name];
    if (!fx) throw new Error(`dmxParams: no effect "${name}" (define it with engine.effect() first)`);
    const k = keys.effects[name] = { rate: `${prefix}/${name}/rate`, depth: `${prefix}/${name}/depth` };
    const max = o.max !== undefined ? o.max : Math.max(4, fx.rate * 2);
    if (!(max > 0)) throw new RangeError(`dmxParams: effects.${name}.max is above 0`);
    add(k.rate, `${name} rate`, 0, max, Math.min(fx.rate, max));
    add(k.depth, `${name} depth`, 0, 1, fx.depth);
  }
  for (const [name] of listOf(chases, 'chases')) {
    const ch = info.chases[name];
    if (!ch) throw new Error(`dmxParams: no chase "${name}" (define it with engine.chase() first)`);
    keys.chases[name] = { run: `${prefix}/${name}/run` };
    add(keys.chases[name].run, `${name} run`, 0, 1, ch.running ? 1 : 0, { step: 1 });
  }

  // the groups' colours live in one scene of their own, on top of the base the engine already has (later base scenes win)
  const scene = `${prefix}:colour`;
  const colours = (get) => Object.fromEntries(colourGroups.map((g) => [g, { color: hsv(clamp01(get(keys.groups[g].hue)), clamp01(get(keys.groups[g].saturation))) }]));
  const defOf = Object.fromEntries(params.map((p) => [p.key, p.def]));
  const ensureBase = () => {
    const b = engine.describe().base;
    if (b[b.length - 1] !== scene) engine.base(...b.filter((n) => n !== scene), scene);
  };
  if (colourGroups.length) { engine.scene(scene, colours((k) => defOf[k])); ensureBase(); }

  const seen = new Map();     // key → the value last handed to the engine
  const changed = (state, key) => {
    if (!(key in state)) return false;
    const v = Number(state[key]);
    if (!Number.isFinite(v) || seen.get(key) === v) return false;
    seen.set(key, v);
    return true;
  };

  /**
   * Hand the resolved params to the engine: only what changed since the last call. `t` is the time on the clock you render
   * with (an effect's new rate takes over from there); `clock` = { beat, bpm } when render() gets a beat position.
   */
  function apply(state = {}, t, clock = {}) {
    if (changed(state, keys.master)) engine.master = clamp01(seen.get(keys.master));
    if (changed(state, keys.blackout)) engine.blackout = seen.get(keys.blackout) >= 0.5;
    let colour = false;
    for (const g of Object.keys(keys.groups)) {
      const k = keys.groups[g];
      if (changed(state, k.dimmer)) engine.submaster(g, clamp01(seen.get(k.dimmer)));
      if (k.hue && changed(state, k.hue)) colour = true;
      if (k.saturation && changed(state, k.saturation)) colour = true;
    }
    if (colour) engine.scene(scene, colours((k) => (seen.has(k) ? seen.get(k) : defOf[k])));
    if (colourGroups.length) ensureBase();
    for (const [name, k] of Object.entries(keys.effects)) {
      if (changed(state, k.rate)) {
        if (typeof t !== 'number' || !Number.isFinite(t)) { seen.delete(k.rate); throw new TypeError(`apply(state, t): give t (seconds, the clock you render with) so ${name}'s new rate can take over without a jump`); }
        engine.tune(name, { rate: Math.max(0, seen.get(k.rate)) }, t, clock);
      }
      if (changed(state, k.depth)) engine.tune(name, { depth: clamp01(seen.get(k.depth)) });
    }
    for (const [name, k] of Object.entries(keys.chases)) if (changed(state, k.run)) engine.run(name, seen.get(k.run) >= 0.5);
    return engine;
  }

  return { params, apply, scene, keys };
}
