// String ensemble · a section, not a soloist: three detuned saws per note, a slow
// bowed attack, a gentle low-pass for the body, ensemble chorus and a little
// vibrato. sound/attack is the bow (fast détaché ↔ slow swell), sound/vibrato
// how much the section sings.

export const strings = {
  id: 'strings',
  name: { en: 'String ensemble', zh: '弦樂合奏' },
  category: 'strings',
  gain: -4,
  defaults: { cutoff: 6000, space: 0.45 },
  params: [
    { key: 'attack', label: 'Attack (s)', min: 0.01, max: 2, def: 0.35 },
    { key: 'vibrato', label: 'Vibrato', min: 0, max: 1, def: 0.35 },
  ],
  tail: 2.5,
  create(Tone, { output }) {
    const chorus = new Tone.Chorus({ frequency: 0.6, delayTime: 4, depth: 0.55, spread: 180, wet: 0.5 }).start().connect(output);
    const hp = new Tone.Filter({ frequency: 110, type: 'highpass' }).connect(chorus);
    const body = new Tone.Filter({ frequency: 2800, type: 'lowpass', rolloff: -24, Q: 0.6 }).connect(hp);
    const vib = new Tone.Vibrato({ frequency: 5.3, depth: 0.035 }).connect(body);
    const poly = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'fatsawtooth', count: 3, spread: 22 },
      envelope: { attack: 0.35, decay: 0.4, sustain: 0.85, release: 1.2, attackCurve: 'linear' },
    }).connect(vib);
    poly.maxPolyphony = 24;
    const hz = (n) => 440 * 2 ** ((n - 69) / 12);
    return {
      noteOn(note, vel, time) { poly.triggerAttack(hz(note), time, 0.3 + 0.6 * vel); },
      noteOff(note, time) { poly.triggerRelease(hz(note), time); },
      releaseAll(time) { poly.releaseAll(time); },
      set(key, value) {
        if (key === 'attack') poly.set({ envelope: { attack: value } });
        if (key === 'vibrato') vib.depth.rampTo(value * 0.1, 0.2);
      },
      dispose() { poly.dispose(); vib.dispose(); body.dispose(); hp.dispose(); chorus.dispose(); },
    };
  },
};
