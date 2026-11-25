// @openav/output · params — each output's blackout and brightness as params. Pure: no DOM.
//
// Rule 1 of the framework: what is performed continuously goes through params. So the projector's blackout is not a
// button wired to one window: it is `output/<name>/blackout`, and the console's slider, a MIDI fader learned onto it, the
// timeline's automation (a fade to black at the end of the show) and a phone all reach it the same way.
//
//   output/<name>/blackout     0 or 1 (a step param): 1 = this output is black, whatever it shows
//   output/<name>/brightness   0..1, default 1: a black veil over the picture (1 - brightness of it); not the projector's lamp

/** The two keys of an output. */
export function outputKeys(name) {
  return { blackout: `output/${name}/blackout`, brightness: `output/${name}/brightness` };
}

/**
 * The param entries for one or more outputs, to hand to `params.add()` (createOutputs and openOutput do it for you).
 * @param {string|string[]} names
 * @returns {object[]}  two entries per output: `output/<name>/blackout` (0 or 1) and `output/<name>/brightness` (0..1, default 1)
 */
export function outputParams(names) {
  const list = Array.isArray(names) ? names : [names];
  const out = [];
  for (const name of list) {
    if (typeof name !== 'string' || !/^[\w-]{1,32}$/.test(name)) throw new Error(`[output] outputParams: a name is 1–32 letters, digits, - or _, got ${JSON.stringify(name)}`);
    const k = outputKeys(name);
    out.push(
      { key: k.blackout, label: `${name} · blackout`, min: 0, max: 1, step: 1, def: 0, group: 'output' },
      { key: k.brightness, label: `${name} · brightness`, min: 0, max: 1, def: 1, group: 'output' },
    );
  }
  return out;
}

/**
 * How to read a param's value right now, outside the show's frame: the override (a hand, a route) if there is one, else
 * the timeline's value (with what segment modules make of it), else the default. Same answer as `params.resolve(timeline.state())`
 * for that one key, without computing every other key.
 */
export function paramReader(params, timeline = null) {
  return (key) => {
    if (!params || !params.get?.(key)) return undefined;
    if (params.isOverridden(key)) return params.overrides[key];
    if (timeline && typeof timeline.valueAt === 'function') {
      const v = timeline.valueAt(key);
      return typeof timeline.layer === 'function' ? timeline.layer(key, v, timeline.t) : v;
    }
    return params.get(key).def;
  };
}

/** The opacity of the black veil over an output: 1 when blacked out, else 1 - brightness (clamped 0..1). */
export function veilOf(blackout, brightness) {
  if (blackout >= 0.5) return 1;
  const b = Number.isFinite(brightness) ? brightness : 1;
  return 1 - Math.min(1, Math.max(0, b));
}
