// @openav/dmx · fixtures/index — the generic fixture profiles that ship, as data.
// The JSON files are the source of truth (a profile is a file you copy, change to match your light's manual, and pass to a
// Patch); this file only lists them. None of them describes one real fixture, so none is verified.
// (JSON import attributes, as packages/midi/profiles/index.js: Chrome 123+, Safari 17.2+, Firefox 138+, Node 22.)

import dimmer from './generic-dimmer.json' with { type: 'json' };
import rgb from './generic-rgb.json' with { type: 'json' };
import rgbw from './generic-rgbw.json' with { type: 'json' };
import rgba from './generic-rgba.json' with { type: 'json' };
import rgbawUv from './generic-rgbaw-uv.json' with { type: 'json' };
import strobe from './generic-strobe.json' with { type: 'json' };
import movingHead from './generic-moving-head.json' with { type: 'json' };

/** Every shipped fixture profile (open-audiovisual/fixture@1), generic ones only. */
export const FIXTURES = [dimmer, rgb, rgbw, rgba, rgbawUv, strobe, movingHead];

/** A shipped fixture profile by id, or null. */
export function fixtureById(id) {
  return FIXTURES.find((f) => f.id === id) || null;
}
