// @openav/core — the glue: Bus (events), Signals (named signal registry),
// Params (schema + overrides), Loop (rAF with dt clamp).
//
// Everything in open-audiovisual speaks two currencies:
//   Signals — "what is happening" (normalized, named, produced by input layers)
//   Params  — "what the world listens to" (schema'd values, driven by timeline/mapping/hand)
//
// Zero dependencies. ESM. Works from a <script type="module"> with no build step.

export { Bus } from './src/bus.js?v=dcdb1a44';
export { Signals } from './src/signals.js?v=dcdb1a44';
export { Params } from './src/params.js?v=dcdb1a44';
export { Loop } from './src/loop.js?v=dcdb1a44';
export { VERSION, sign } from './src/signature.js?v=dcdb1a44';
