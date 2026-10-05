// Marimba · wide rosewood bars over tube resonators, soft yarn mallets. The bar
// is carved so the second mode lands two octaves up (4×) and the third near 10×;
// the resonators make the fundamental bloom and ring longer than a xylophone.
import { modalInstrument } from './modal.js?v=a8b6135';

export const marimba = modalInstrument({
  id: 'marimba',
  name: { en: 'Marimba', zh: '馬林巴' },
  partials: [
    { ratio: 1, gain: 1, decay: 1.9 },
    { ratio: 3.93, gain: 0.22, decay: 0.5 },
    { ratio: 9.2, gain: 0.05, decay: 0.16 },
  ],
  strike: { ratio: 2.5, q: 0.8, gain: 0.12, decay: 0.02 },
  pitchDecay: 0.6,
  gain: -2,
});
