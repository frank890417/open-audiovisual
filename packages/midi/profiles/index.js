// @openav/midi · profiles/index — every shipped profile, as data.
// The JSON files are the source of truth (a profile is a file you can copy,
// edit and load with registerProfile / MidiControllers({ profiles })); this
// file only lists them. Order = the order a profile picker shows them.
// (JSON import attributes: Chrome 123+, Safari 17.2+, Firefox 138+, Node 22.)

import minilab3 from './arturia-minilab3.json' with { type: 'json' };
import lpd8 from './akai-lpd8.json' with { type: 'json' };
import launchpadMini from './novation-launchpad-mini-mk3.json' with { type: 'json' };
import nanoKontrol2 from './korg-nanokontrol2.json' with { type: 'json' };
import keystep37 from './arturia-keystep37.json' with { type: 'json' };
import oddBall from './odd-ball.json' with { type: 'json' };
import generic8k8p from './generic-8k8p.json' with { type: 'json' };
import generic8f from './generic-8f.json' with { type: 'json' };
import generic16p from './generic-16p.json' with { type: 'json' };
import genericKeys25 from './generic-keys25.json' with { type: 'json' };
import genericKeys49 from './generic-keys49.json' with { type: 'json' };
import genericKeys61 from './generic-keys61.json' with { type: 'json' };

export const PROFILES = [minilab3, lpd8, launchpadMini, nanoKontrol2, keystep37, oddBall,
  generic8k8p, generic8f, generic16p, genericKeys25, genericKeys49, genericKeys61];

/** Look a profile up by id or by its signal namespace (`short`). */
export function profileById(id) { return PROFILES.find((p) => p.id === id || p.short === id) || null; }
