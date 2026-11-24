// @openav/dmx · color — one RGB colour, split into the emitters a fixture really has.
//
// The rule, in order (each step takes its share out of what is left, so no light is counted twice):
//   1. white    = min(r, g, b): the part all three have in common goes to the white LED, and comes out of r, g and b.
//                 A fixture with warm or cold white and no plain white puts it there instead.
//   2. amber    = min(r, 2·g): amber is read as (1, ½, 0), so it takes red and half as much green.
//   3. red, green, blue: what is left.
//   CMY (a moving head's colour flags): cyan = 1 − r, magenta = 1 − g, yellow = 1 − b, used when there is no red, green or blue.
//   A fixture with one kind of emitter only (a white par, an amber par): it gets the brightest of r, g, b.
//   UV, lime and indigo have no place in RGB: they stay 0 unless a scene names that channel.
// Why white first: on an RGBW par, white is the brightest and cleanest LED, and pastels look washed and green-tinged when made
// from RGB alone. Full white extraction means (1, 1, 1) is the white LED alone, which is what a lighting person expects.

const clamp01 = (v) => (v > 1 ? 1 : v > 0 ? v : 0);
const WHITES = ['white', 'warmWhite', 'coldWhite'];

/**
 * Split an RGB colour into the colour channels a fixture has.
 * @param {number[]} rgb  [r, g, b], each 0..1
 * @param {string[]} colors  the colour names of the fixture's channels, e.g. ['red', 'green', 'blue', 'white']
 * @returns {Record<string, number>}  one 0..1 value per name in `colors`
 */
export function rgbToChannels(rgb, colors) {
  let r = clamp01(Number(rgb && rgb[0]) || 0), g = clamp01(Number(rgb && rgb[1]) || 0), b = clamp01(Number(rgb && rgb[2]) || 0);
  const has = new Set(colors);
  const out = {};
  for (const c of has) out[c] = 0;
  const additive = has.has('red') || has.has('green') || has.has('blue');
  const cmy = !additive && (has.has('cyan') || has.has('magenta') || has.has('yellow'));
  if (!additive && !cmy) {
    // one kind of emitter: brightness only
    const v = Math.max(r, g, b);
    for (const c of has) if (c !== 'uv') out[c] = v;
    return out;
  }
  if (cmy) {
    if (has.has('cyan')) out.cyan = 1 - r;
    if (has.has('magenta')) out.magenta = 1 - g;
    if (has.has('yellow')) out.yellow = 1 - b;
    return out;
  }
  const whites = has.has('white') ? ['white'] : WHITES.filter((c) => has.has(c));
  if (whites.length) {
    const w = Math.min(r, g, b);
    for (const c of whites) out[c] = w;
    r -= w; g -= w; b -= w;
  }
  if (has.has('amber')) {
    const a = Math.min(r, 2 * g, 1);
    out.amber = a;
    r -= a; g -= a / 2;
  }
  if (has.has('red')) out.red = clamp01(r);
  if (has.has('green')) out.green = clamp01(g);
  if (has.has('blue')) out.blue = clamp01(b);
  return out;
}
