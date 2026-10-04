// Glockenspiel 鐵琴 · small steel bars, brass mallets. A free steel bar's modes are
// inharmonic (2.76×, 5.40×, 8.93×), which is the "bell" in the sound; they ring
// long and nothing damps them. Sounds two octaves above the written note.
import { modalInstrument } from './modal.js?v=062bc76';

export const glockenspiel = modalInstrument({
  id: 'glockenspiel',
  name: { en: 'Glockenspiel', zh: '鐵琴' },
  transpose: 24,
  partials: [
    { ratio: 1, gain: 1, decay: 3.2 },
    { ratio: 2.76, gain: 0.42, decay: 1.3 },
    { ratio: 5.4, gain: 0.2, decay: 0.55 },
    { ratio: 8.93, gain: 0.08, decay: 0.22 },
  ],
  strike: { ratio: 7, q: 0.7, gain: 0.2, decay: 0.005 },
  pitchDecay: 0.45,
});
