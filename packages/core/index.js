// @openav/core — the glue: Bus (events), Signals (named signal registry),
// Params (schema + overrides), Loop (rAF with dt clamp).
//
// Everything in open-audiovisual speaks two currencies:
//   Signals — "what is happening" (normalized, named, produced by input layers)
//   Params  — "what the world listens to" (schema'd values, driven by timeline/mapping/hand)
//
// Zero dependencies. ESM. Works from a <script type="module"> with no build step.

export { Bus } from './src/bus.js?v=8e56e1c4';
export { Signals } from './src/signals.js?v=8e56e1c4';
export { Params } from './src/params.js?v=8e56e1c4';
export { Loop } from './src/loop.js?v=8e56e1c4';
export { VERSION, sign } from './src/signature.js?v=8e56e1c4';
