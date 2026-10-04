// Organ · a tonewheel organ's nine drawbars as one additive waveform, through a
// rotary-speaker imitation.
//
// The drawbars are harmonics of the 16' sub-octave: 16' 5⅓' 8' 4' 2⅔' 2' 1⅗' 1⅓' 1'
// = partials 1 3 2 4 6 8 10 12 16, each notch about 3 dB. So the oscillator plays
// one octave below the key and the registration IS the partial list, exact and cheap.
//   sound/drawbars  0 = 888000000 (the warm jazz setting) → 1 = all nine out (full organ)
//   sound/rotor     0 = slow "chorale" → 1 = fast "tremolo"; the speed glides like a real
//                   rotor spinning up, about a second and a half, because that IS the effect
// A short third-harmonic blip on every key (Hammond "percussion") gives the attack its click.

const FEET = [1, 3, 2, 4, 6, 8, 10, 12, 16];
const WARM = [8, 8, 8, 0, 0, 0, 0, 0, 0];
const FULL = [8, 8, 8, 8, 8, 8, 8, 8, 8];

/** Drawbar settings (0–8 each) → a 16-partial amplitude list for Tone's custom oscillator. */
export function drawbarPartials(bars) {
  const out = new Array(16).fill(0);
  bars.forEach((b, i) => { if (b > 0) out[FEET[i] - 1] += 10 ** (-(8 - b) * 3 / 20); });
  return out;
}

const registration = (x) => drawbarPartials(WARM.map((w, i) => w + (FULL[i] - w) * x));

export const organ = {
  id: 'organ',
  name: { en: 'Drawbar organ', zh: '音栓風琴' },
  category: 'organ',
  transpose: -12,                              // the 16' bar is the oscillator's fundamental
  gain: -3,
  defaults: { cutoff: 7000, space: 0.2 },
  params: [
    { key: 'drawbars', label: 'Drawbars (warm → full)', min: 0, max: 1, def: 0.15 },
    { key: 'rotor', label: 'Rotor (slow → fast)', min: 0, max: 1, def: 0 },
  ],
  tail: 1,
  create(Tone, { output }) {
    const speed = (x) => 0.75 + x * 5.9;       // chorale ≈ 0.75 Hz, tremolo ≈ 6.65 Hz
    const trem = new Tone.Tremolo({ frequency: speed(0), depth: 0.32, spread: 160 }).start().connect(output);
    const vib = new Tone.Vibrato({ frequency: speed(0), depth: 0.035 }).connect(trem);
    const poly = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'custom', partials: registration(0.15) },
      envelope: { attack: 0.006, decay: 0.05, sustain: 1, release: 0.06 },
    }).connect(vib);
    const perc = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sine' }, volume: -15,
      envelope: { attack: 0.001, decay: 0.22, sustain: 0, release: 0.05 },
    }).connect(vib);
    poly.maxPolyphony = 24; perc.maxPolyphony = 24;
    const hz = (n) => 440 * 2 ** ((n - 69) / 12);
    let bars = 0.15;
    return {
      noteOn(note, vel, time) {
        poly.triggerAttack(hz(note), time, 0.55 + 0.25 * vel);   // an organ barely cares how hard you press
        perc.triggerAttack(hz(note) * 6, time, 0.3 + 0.7 * vel); // 2⅔' above the 8': the percussion click
      },
      noteOff(note, time) { poly.triggerRelease(hz(note), time); perc.triggerRelease(hz(note) * 6, time); },
      releaseAll(time) { poly.releaseAll(time); perc.releaseAll(time); },
      set(key, value) {
        if (key === 'drawbars' && Math.abs(value - bars) > 0.02) { bars = value; poly.set({ oscillator: { partials: registration(value) } }); }
        if (key === 'rotor') { trem.frequency.rampTo(speed(value), 1.5); vib.frequency.rampTo(speed(value), 1.5); }
      },
      dispose() { poly.dispose(); perc.dispose(); vib.dispose(); trem.dispose(); },
    };
  },
};
