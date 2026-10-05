// Music box · a steel comb plucked by pins. Each tine is a bar clamped at one end,
// so its overtones sit far apart (6.27×, 17.55×); a second, slightly detuned
// fundamental gives the slow shimmer of a comb ringing against its neighbours.
import { modalInstrument } from './modal.js?v=e353777';

export const musicBox = modalInstrument({
  id: 'music-box',
  name: { en: 'Music box', zh: '音樂盒' },
  transpose: 24,
  gain: -3,
  partials: [
    { ratio: 1, gain: 1, decay: 2.6 },
    { ratio: 1.0025, gain: 0.35, decay: 2.2 },
    { ratio: 6.27, gain: 0.22, decay: 0.35 },
    { ratio: 17.55, gain: 0.05, decay: 0.07 },
  ],
  strike: { ratio: 10, q: 1.5, gain: 0.1, decay: 0.004 },
  pitchDecay: 0.4,
});
