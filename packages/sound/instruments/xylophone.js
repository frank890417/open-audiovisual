// Xylophone · rosewood bars, hard mallets. The bar is tuned so its second mode
// sits at 3× (a twelfth above); the third is untuned and dies almost at once.
// Sounds an octave above the written note, like the real instrument.
import { modalInstrument } from './modal.js?v=2cd2e50';

export const xylophone = modalInstrument({
  id: 'xylophone',
  name: { en: 'Xylophone', zh: '木琴' },
  transpose: 12,
  partials: [
    { ratio: 1, gain: 1, decay: 0.9 },
    { ratio: 3, gain: 0.32, decay: 0.32 },
    { ratio: 6.1, gain: 0.1, decay: 0.1 },
  ],
  strike: { ratio: 5, q: 1.1, gain: 0.35, decay: 0.012 },
  pitchDecay: 0.75,
});
