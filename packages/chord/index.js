// @openav/chord — realtime chord detection & performance semantics.
//
// Lineage: The Last Input core/input-analyzer.js ("Cache Pool"), refined on stage
// after real audience feedback ("dissonance detection wasn't strict enough").
//
// This is NOT a music-theory library (see tonal.js for that). It is a *performance
// semantics* layer: raw held notes → one analyzed chord event per gesture, with
// features designed to drive worlds:
//
//   consonance   -1..1   harmonic consonance (interval-weight average)
//   isTriad      bool    genuinely stacked thirds (not just "some consonant notes")
//   dissonanceLevel 0/1/2  1 = mild storm warning · 2 = true cluster (decay fuel)
//   chordType    'major'|'minor'|'sus4'|…|'cluster'|'chord'|'single'
//
// The metaphor it was born under: single note = seed · chord = colony ·
// consonant = flourish · dissonant = decay. Rename freely in your own world.

const TEMPLATES = {
  major: [0, 4, 7], minor: [0, 3, 7], sus4: [0, 5, 7], sus2: [0, 2, 7],
  dim: [0, 3, 6], aug: [0, 4, 8],
  maj7: [0, 4, 7, 11], min7: [0, 3, 7, 10], dom7: [0, 4, 7, 10], halfdim7: [0, 3, 6, 10],
  maj9: [0, 2, 4, 7, 11], min9: [0, 2, 3, 7, 10], dom9: [0, 2, 4, 7, 10],
  six: [0, 4, 7, 9], min6: [0, 3, 7, 9],
};
const TRIAD_NAMES = new Set(['major', 'minor', 'sus4', 'sus2', 'dim', 'aug']);

// interval consonance weights by semitone distance 0–11
const IV = { 0: 1.0, 1: -1.0, 2: -0.45, 3: 0.6, 4: 0.7, 5: 0.55, 6: -0.85, 7: 0.95, 8: 0.5, 9: 0.6, 10: -0.5, 11: -0.75 };

export class ChordDetector {
  /**
   * @param {object} opts
   * @param {number} [opts.window=80] ms after the last note before the gesture is flushed as one chord
   * @param {(a: object) => void} [opts.onChord]
   * @param {import('../core/src/signals.js').Signals} [opts.signals] publish chord/* signals here
   */
  constructor({ window = 80, onChord = null, signals = null } = {}) {
    this.window = window;
    this.onChord = onChord;
    this.signals = signals;
    this.pending = [];
    this.held = new Map();
    this._timer = null;
    if (signals) {
      signals.define('chord/consonance', { min: -1, max: 1, source: 'chord', description: 'harmonic consonance of last gesture' });
      signals.define('chord/count', { min: 0, max: 10, source: 'chord' });
      signals.define('chord/root', { min: 0, max: 127, source: 'chord' });
      signals.define('chord/event', { kind: 'pulse', source: 'chord', description: 'full analysis object per gesture' });
    }
  }

  /** Feed from MIDI or an on-screen keyboard. */
  noteOn(note, vel = 0.8) {
    this.held.set(note, vel);
    this.pending.push({ note, vel });
    if (this._timer) clearTimeout(this._timer);
    this._timer = setTimeout(() => this._flush(), this.window);
  }
  noteOff(note) { this.held.delete(note); }

  _flush() {
    this._timer = null;
    if (!this.pending.length) return;
    const byNote = new Map();
    for (const p of this.pending) byNote.set(p.note, Math.max(byNote.get(p.note) || 0, p.vel));
    this.pending = [];
    const notes = [...byNote.keys()].sort((a, b) => a - b);
    const vels = notes.map(n => byNote.get(n));
    const a = this.analyze(notes, vels);
    if (this.signals) {
      this.signals.set('chord/consonance', a.consonance);
      this.signals.set('chord/count', a.count);
      this.signals.set('chord/root', a.root);
      this.signals.pulse('chord/event', a);
    }
    this.onChord?.(a);
  }

  /** Pure function: MIDI note numbers → analysis. Unit-testable in isolation. */
  analyze(notes, vels = []) {
    const count = notes.length;
    const root = notes[0];
    const vel = vels.length ? vels.reduce((s, v) => s + v, 0) / vels.length : 0.8;
    const pcs = [...new Set(notes.map(n => ((n % 12) + 12) % 12))].sort((a, b) => a - b);

    // consonance = mean pairwise interval weight (−1..1)
    let sum = 0, pairs = 0;
    for (let i = 0; i < notes.length; i++)
      for (let j = i + 1; j < notes.length; j++) { sum += IV[Math.abs(notes[i] - notes[j]) % 12] ?? 0; pairs++; }
    const consonance = pairs ? sum / pairs : 1;

    // chord type: pitch classes normalized to lowest = 0, matched against templates
    // (root-position match; inversions resolve via rotation pass below)
    const rel = pcs.map(p => (p - pcs[0] + 12) % 12).sort((a, b) => a - b);
    let chordType = count === 1 ? 'single' : (pairs && consonance < -0.3 ? 'cluster' : 'chord');
    let matched = false;
    for (const [name, tmpl] of Object.entries(TEMPLATES))
      if (tmpl.length === rel.length && tmpl.every((v, i) => v === rel[i])) { chordType = name; matched = true; break; }
    if (!matched && pcs.length >= 3 && pcs.length <= 5) {
      // try inversions: rotate pitch-class set
      outer: for (let r = 1; r < pcs.length; r++) {
        const rot = pcs.map(p => (p - pcs[r] + 12) % 12).sort((a, b) => a - b);
        for (const [name, tmpl] of Object.entries(TEMPLATES))
          if (tmpl.length === rot.length && tmpl.every((v, i) => v === rot[i])) { chordType = name; break outer; }
      }
    }

    // stacked-thirds fraction: adjacent gaps of 3–4 semitones — "genuinely stacked
    // thirds", not just any consonant cloud (post-performance fix, 2026-07-01)
    let thirds = 0;
    for (let i = 0; i < notes.length - 1; i++) { const gap = notes[i + 1] - notes[i]; if (gap === 3 || gap === 4) thirds++; }
    const thirdsFraction = notes.length > 1 ? thirds / (notes.length - 1) : 0;

    const isTriad = TRIAD_NAMES.has(chordType);
    const severe = count >= 3 && (consonance < -0.4 || chordType === 'cluster');
    const dissonanceLevel = count < 2 ? 0 : (severe ? 2 : (consonance < -0.15 ? 1 : 0));

    return {
      notes, count, root, vel, pcs, consonance,
      isConsonant: count >= 2 && consonance > 0.25,
      isDissonant: count >= 2 && consonance < -0.15,
      isTriad, thirdsFraction, dissonanceLevel, chordType,
    };
  }
}
