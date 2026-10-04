// Grand piano · the Salamander Grand Piano (Yamaha C5), sampled by Alexander Holm, CC-BY 3.0.
//
// The same 30-file set Soulfish and Terrain Weaving play: one sample every minor
// third from A0 to C8 (A, C, D♯, F♯ in each octave), the sampler pitch-shifts the
// two notes in between by at most a semitone and a half — inaudible on a piano.
// About 2 MB of mp3 in packages/sound/samples/salamander/, loaded only when the
// piano is picked; the picker shows progress while it loads.
//
// One velocity layer only, so loud vs soft is a gain curve (vel^1.5, loudness is
// a power law to the ear), not a different hammer. If the files cannot load, the
// engine switches to the electric piano: a performance never goes silent because
// of one failed fetch.

const PCS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/** MIDI note → Tone note name ('D#1'). */
export function noteName(midi) { return PCS[midi % 12] + (Math.floor(midi / 12) - 1); }

/** The set's notes: every minor third from A0 (21) to C8 (108) — 30 notes. */
export const SALAMANDER_NOTES = Array.from({ length: 30 }, (_, i) => 21 + i * 3);

/** Sample map for Tone.Sampler: { 'A0': 'A0.mp3', 'D#1': 'Ds1.mp3', … } (files spell ♯ as "s"). */
export function salamanderMap(notes = SALAMANDER_NOTES) {
  const map = {};
  for (const n of notes) { const name = noteName(n); map[name] = name.replace('#', 's') + '.mp3'; }
  return map;
}

// decoded samples outlive the sampler: picking the piano again is instant and needs no network
const decoded = new Map();          // url → Promise<AudioBuffer>
const fetchBuffer = (Tone, url) => {
  if (!decoded.has(url)) decoded.set(url, Tone.ToneAudioBuffer.fromUrl(url).then((b) => b.get()).catch((e) => { decoded.delete(url); throw e; }));
  return decoded.get(url);
};

const SALAMANDER_CREDIT = {
  text: 'Salamander Grand Piano · Alexander Holm · CC-BY 3.0',
  url: 'https://archive.org/details/SalamanderGrandPianoV3',
};

export const piano = {
  id: 'piano',
  name: { en: 'Grand piano (Salamander)', zh: '平台鋼琴（Salamander）' },
  category: 'keys',
  credit: SALAMANDER_CREDIT,
  defaults: { cutoff: 8000, space: 0.25 },   // a piano wants the filter open
  fallback: 'epiano',
  gain: 6,
  tail: 3,
  create(Tone, { output, baseUrl, options = {}, onProgress }) {
    const url = options.baseUrl || baseUrl + 'salamander/';
    const map = salamanderMap();
    const names = Object.keys(map);
    let sampler = null, done = 0, gone = false;
    const ready = Promise.all(names.map((n) => fetchBuffer(Tone, url + map[n]).then((buf) => {
      onProgress?.(++done / names.length);
      return [n, buf];
    }))).then((entries) => {
      if (gone) return;
      sampler = new Tone.Sampler({ urls: Object.fromEntries(entries), release: 1.1, curve: 'exponential' }).connect(output);
    });
    const hz = (n) => 440 * 2 ** ((n - 69) / 12);
    return {
      ready,
      noteOn(note, vel, time) { sampler?.triggerAttack(hz(note), time, 0.04 + 0.96 * vel ** 1.5); },
      noteOff(note, time) { sampler?.triggerRelease(hz(note), time); },
      releaseAll(time) { sampler?.releaseAll(time); },
      dispose() { gone = true; sampler?.dispose(); sampler = null; },
    };
  },
};
