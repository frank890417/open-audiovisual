// Choir pad · voices singing a vowel. A buzzy source (detuned saws, like vocal
// folds) through three band-pass filters at the vowel's formants is how speech
// synthesis has made vowels since the 1950s. sound/vowel slides oo → oh → ah → eh → ee,
// so a hand or a knob can make the choir change its mouth shape.

// soprano-ish formant table: [F1, F2, F3] in Hz and their levels in dB
const VOWELS = [
  [[350, 0], [800, -12], [2700, -30]],   // oo
  [[450, 0], [850, -8], [2800, -22]],    // oh
  [[800, 0], [1150, -5], [2900, -20]],   // ah
  [[500, 0], [1750, -14], [2600, -18]],  // eh
  [[330, 0], [2200, -14], [3000, -18]],  // ee
];
const vowelAt = (x) => {
  const p = Math.min(0.9999, Math.max(0, x)) * (VOWELS.length - 1), i = Math.floor(p), f = p - i;
  return VOWELS[i].map(([hz, db], k) => [hz + (VOWELS[i + 1][k][0] - hz) * f, db + (VOWELS[i + 1][k][1] - db) * f]);
};

export const choir = {
  id: 'choir',
  name: { en: 'Choir pad (aah)', zh: '合唱襯底（啊）' },
  category: 'voice',
  gain: 10,
  defaults: { cutoff: 7000, space: 0.55 },
  params: [
    { key: 'vowel', label: 'Vowel (oo → ee)', min: 0, max: 1, def: 0.5 },
    { key: 'attack', label: 'Attack (s)', min: 0.01, max: 2, def: 0.35 },
  ],
  tail: 2.5,
  create(Tone, { output }) {
    const chorus = new Tone.Chorus({ frequency: 0.4, delayTime: 5, depth: 0.6, spread: 180, wet: 0.6 }).start().connect(output);
    const sum = new Tone.Gain(1).connect(chorus);
    const start = vowelAt(0.5);
    const bands = start.map(([hz, db], k) => {
      const g = new Tone.Gain(Tone.dbToGain(db)).connect(sum);
      const f = new Tone.Filter({ type: 'bandpass', frequency: hz, Q: [6, 9, 12][k] }).connect(g);
      return { f, g };
    });
    const vib = new Tone.Vibrato({ frequency: 5, depth: 0.04 });
    for (const b of bands) vib.connect(b.f);
    const poly = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'fatsawtooth', count: 3, spread: 26 },
      envelope: { attack: 0.35, decay: 0.3, sustain: 0.9, release: 1.3, attackCurve: 'linear' },
    }).connect(vib);
    poly.maxPolyphony = 24;
    const hz = (n) => 440 * 2 ** ((n - 69) / 12);
    return {
      noteOn(note, vel, time) { poly.triggerAttack(hz(note), time, 0.35 + 0.55 * vel); },
      noteOff(note, time) { poly.triggerRelease(hz(note), time); },
      releaseAll(time) { poly.releaseAll(time); },
      set(key, value) {
        if (key === 'vowel') vowelAt(value).forEach(([f, db], k) => { bands[k].f.frequency.rampTo(f, 0.12); bands[k].g.gain.rampTo(Tone.dbToGain(db), 0.12); });
        if (key === 'attack') poly.set({ envelope: { attack: value } });
      },
      dispose() { poly.dispose(); vib.dispose(); for (const b of bands) { b.f.dispose(); b.g.dispose(); } sum.dispose(); chorus.dispose(); },
    };
  },
};
