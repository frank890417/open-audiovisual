// Harp · Karplus–Strong plucked strings: a burst of noise circulating in a tuned,
// slightly lossy delay line IS a vibrating string, physically. Tone's PluckSynth
// is one string, so this keeps a ring of twelve and lets each one ring out —
// a harpist does not damp every note, and neither does this.

export const harp = {
  id: 'harp',
  name: { en: 'Harp (plucked string)', zh: '豎琴（撥弦）' },
  category: 'plucked',
  defaults: { cutoff: 8000, space: 0.4 },
  gain: 3,
  tail: 3,
  create(Tone, { output }) {
    const tone = new Tone.Filter({ frequency: 4200, type: 'lowpass', rolloff: -12 }).connect(output);
    const pool = Array.from({ length: 12 }, () => new Tone.PluckSynth({ attackNoise: 1.4, dampening: 3600, resonance: 0.985, release: 1.5 }).connect(tone));
    let next = 0;
    const hz = (n) => 440 * 2 ** ((n - 69) / 12);
    return {
      noteOn(note, vel, time) {
        const s = pool[next++ % pool.length];
        s.volume.value = Tone.gainToDb(0.2 + 0.8 * vel);
        s.triggerAttack(hz(note), time);
      },
      noteOff() {},                            // strings ring free
      dispose() { for (const s of pool) s.dispose(); tone.dispose(); },
    };
  },
};
