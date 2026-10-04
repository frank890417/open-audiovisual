// Electric piano · the DX7 "E.Piano" recipe in two FM pairs: a 1:1 pair for the
// round body whose brightness falls away after the attack, and a quiet 14:1 pair
// for the metallic tine you hear in the first tenth of a second. A slow stereo
// tremolo stands in for the suitcase amp (sound/tremolo, 0 = off).
// Also the piano's stand-in when its samples cannot load.

export const epiano = {
  id: 'epiano',
  name: { en: 'Electric piano', zh: '電鋼琴' },
  category: 'keys',
  defaults: { cutoff: 7000, space: 0.25 },
  params: [{ key: 'tremolo', label: 'Tremolo depth', min: 0, max: 1, def: 0.3 }],
  gain: 6,
  tail: 2,
  create(Tone, { output }) {
    const trem = new Tone.Tremolo({ frequency: 4.2, depth: 0.3, spread: 140 }).start().connect(output);
    const body = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 1, modulationIndex: 3.4,
      oscillator: { type: 'sine' }, modulation: { type: 'sine' },
      envelope: { attack: 0.002, decay: 2.4, sustain: 0.16, release: 0.6 },
      modulationEnvelope: { attack: 0.002, decay: 0.5, sustain: 0.1, release: 0.4 },
    }).connect(trem);
    const tine = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 14, modulationIndex: 1.6, volume: -16,
      oscillator: { type: 'sine' }, modulation: { type: 'sine' },
      envelope: { attack: 0.001, decay: 0.3, sustain: 0, release: 0.2 },
      modulationEnvelope: { attack: 0.001, decay: 0.09, sustain: 0, release: 0.1 },
    }).connect(trem);
    body.maxPolyphony = tine.maxPolyphony = 24;
    const hz = (n) => 440 * 2 ** ((n - 69) / 12);
    return {
      noteOn(note, vel, time) {
        body.triggerAttack(hz(note), time, 0.15 + 0.85 * vel);
        tine.triggerAttack(hz(note), time, vel * vel);     // the bark only shows when you dig in
      },
      noteOff(note, time) { body.triggerRelease(hz(note), time); tine.triggerRelease(hz(note), time); },
      releaseAll(time) { body.releaseAll(time); tine.releaseAll(time); },
      set(key, value) { if (key === 'tremolo') trem.depth.rampTo(value, 0.1); },
      dispose() { body.dispose(); tine.dispose(); trem.dispose(); },
    };
  },
};
