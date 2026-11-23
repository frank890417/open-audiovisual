// @openav/hw — hardware design for works that leave the screen: say which parts and how they are wired, get a check
// (logic levels, ESP8266 boot pins, a pin used twice, I²C address clashes, current against the board and the battery,
// how many hours a battery lasts), a wiring diagram (SVG) and a parts list. Pure functions, no DOM, no dependencies.
//   Hw.check(spec)    → report { ok, issues, warnings, notes, nets, power, i2c }
//   Hw.diagram(spec)  → '<svg …>'
//   Hw.bom(spec)      → { have, buy, unknown }
//   Hw.parts / Hw.part(key)   the parts library (every value from a datasheet; null = 待查)
import { PARTS } from './parts.js?v=e62939c4';
import { check, partOf, resolvePin, netsOf } from './check.js?v=e62939c4';
import { diagram } from './diagram.js?v=e62939c4';
import { bom } from './bom.js?v=e62939c4';

/** The parts library, keyed by part id (the same object as Hw.parts). */
export const HW_PARTS = PARTS;

export const Hw = {
  parts: PARTS,
  part: (key) => partOf(key, PARTS),
  check: (spec, opts) => check(spec, opts),
  diagram: (spec, opts) => diagram(spec, opts),
  bom: (spec, opts) => bom(spec, opts),
  resolvePin: (spec, ref) => resolvePin(spec, ref, PARTS),
  nets: (spec) => netsOf(spec, PARTS).nets,
};
