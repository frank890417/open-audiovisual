// Vibraphone · aluminium bars, a motor-driven tremolo and a damper. Bars ring for
// seconds; releasing a key damps it (hold the sustain pedal, CC 64, to let it ring).
// sound/tremolo sets how deep the motor fans pulse the sound.
import { modalInstrument } from './modal.js?v=114e448';

export const vibraphone = modalInstrument({
  id: 'vibraphone',
  name: { en: 'Vibraphone', zh: '顫音琴' },
  partials: [
    { ratio: 1, gain: 1, decay: 5 },
    { ratio: 4, gain: 0.16, decay: 1.4 },
    { ratio: 10, gain: 0.035, decay: 0.4 },
  ],
  strike: { ratio: 6, q: 1, gain: 0.07, decay: 0.008 },
  damp: 0.18,
  gain: 4,
  pitchDecay: 0.5,
  tremolo: { frequency: 5.2, depth: 0.35, spread: 40 },
  params: [{ key: 'tremolo', label: 'Tremolo depth', min: 0, max: 1, def: 0.35 }],
  set({ key, value, tremolo }) { if (key === 'tremolo' && tremolo) tremolo.depth.rampTo(value, 0.1); },
});
