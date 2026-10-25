// @openav/core — the glue: Bus (events), Signals (named signal registry),
// Params (schema + overrides), Loop (rAF with dt clamp).
//
// Everything in open-audiovisual speaks two currencies:
//   Signals — "what is happening" (normalized, named, produced by input layers)
//   Params  — "what the world listens to" (schema'd values, driven by timeline/mapping/hand)
//
// Zero dependencies. ESM. Works from a <script type="module"> with no build step.

export { Bus } from './src/bus.js?v=dd4a4d59';
export { Signals } from './src/signals.js?v=dd4a4d59';
export { Params } from './src/params.js?v=dd4a4d59';
export { Loop } from './src/loop.js?v=dd4a4d59';
