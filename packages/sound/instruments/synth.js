// The synth module · one Tone.PolySynth, many presets, every preset is plain data.
//
// A preset names a voice (Tone's own synth classes), its oscillator/envelope/filter
// settings in Tone's vocabulary, and an optional effects chain — nothing else:
//
//   registerSynthPreset({
//     id: 'glass', name: { en: 'Glass', zh: '玻璃' },
//     voice: 'fm', harmonicity: 3.01, modulationIndex: 14,
//     envelope: { attack: 0.002, decay: 1.4, sustain: 0, release: 1.2 },
//     effects: [{ type: 'chorus', frequency: 1.5, depth: 0.4, wet: 0.3 }],
//   });                                            // → selectable as 'synth/glass'
//
// voice: 'synth' (oscillator + amp envelope) · 'mono' (adds a resonant filter
// with its own envelope, Tone.MonoSynth) · 'fm' · 'am'. octave shifts the whole
// preset (a bass plays an octave down), gain levels it against the others (dB).
// effect types: chorus · delay · pingpong · distortion · vibrato · tremolo ·
// phaser · autofilter · filter · eq · compressor · chebyshev · widener.

import { registerInstrument } from '../registry.js?v=0cfcfd4';

const VOICES = { synth: 'Synth', mono: 'MonoSynth', fm: 'FMSynth', am: 'AMSynth' };
const EFFECTS = {
  chorus: 'Chorus', delay: 'FeedbackDelay', pingpong: 'PingPongDelay', distortion: 'Distortion',
  vibrato: 'Vibrato', tremolo: 'Tremolo', phaser: 'Phaser', autofilter: 'AutoFilter', filter: 'Filter',
  eq: 'EQ3', compressor: 'Compressor', chebyshev: 'Chebyshev', widener: 'StereoWidener',
};
const VOICE_KEYS = ['oscillator', 'envelope', 'filter', 'filterEnvelope', 'harmonicity', 'modulationIndex',
  'modulation', 'modulationEnvelope', 'detune', 'portamento'];

export const SYNTH_PRESETS = [
  { // the framework's original voice, unchanged: three detuned saws, quick attack, long release
    id: 'pad', name: { en: 'Warm pad', zh: '溫暖襯底' },
    voice: 'synth', polyphony: 24,
    oscillator: { type: 'fatsawtooth', count: 3, spread: 18 },
    envelope: { attack: 0.01, decay: 0.25, sustain: 0.4, release: 1.4 },
  },
  {
    id: 'saw-lead', name: { en: 'Saw lead', zh: '鋸齒波主奏' },
    voice: 'mono', polyphony: 8, gain: -6,
    oscillator: { type: 'sawtooth' },
    envelope: { attack: 0.005, decay: 0.2, sustain: 0.75, release: 0.25 },
    filter: { type: 'lowpass', Q: 2, rolloff: -24 },
    filterEnvelope: { attack: 0.01, decay: 0.3, sustain: 0.5, release: 0.3, baseFrequency: 500, octaves: 3.5 },
    effects: [{ type: 'delay', delayTime: 0.28, feedback: 0.25, wet: 0.15 }],
    defaults: { cutoff: 6000 },
  },
  {
    id: 'square-lead', name: { en: 'Square lead', zh: '方波主奏' },
    voice: 'synth', polyphony: 8, gain: -11,
    oscillator: { type: 'pulse', width: 0.42 },
    envelope: { attack: 0.004, decay: 0.12, sustain: 0.8, release: 0.22 },
    effects: [{ type: 'vibrato', frequency: 5.5, depth: 0.06 }, { type: 'delay', delayTime: 0.21, feedback: 0.2, wet: 0.12 }],
    defaults: { cutoff: 5000 },
  },
  {
    id: 'pluck', name: { en: 'Pluck', zh: '撥奏' },
    voice: 'mono', polyphony: 16, gain: -4,
    oscillator: { type: 'sawtooth' },
    envelope: { attack: 0.002, decay: 0.35, sustain: 0, release: 0.3 },
    filter: { type: 'lowpass', Q: 3, rolloff: -24 },
    filterEnvelope: { attack: 0.001, decay: 0.18, sustain: 0, release: 0.2, baseFrequency: 280, octaves: 4.5 },
    effects: [{ type: 'pingpong', delayTime: 0.19, feedback: 0.3, wet: 0.2 }],
    defaults: { cutoff: 8000 },
  },
  {
    id: 'supersaw', name: { en: 'Supersaw', zh: '超級鋸齒波' },
    voice: 'synth', polyphony: 16, gain: -6,
    oscillator: { type: 'fatsawtooth', count: 7, spread: 42 },
    envelope: { attack: 0.02, decay: 0.3, sustain: 0.8, release: 0.9 },
    effects: [{ type: 'chorus', frequency: 0.8, delayTime: 3, depth: 0.5, spread: 180, wet: 0.35 }],
    defaults: { cutoff: 6500 },
  },
  {
    id: 'bass', name: { en: 'Analog bass', zh: '類比貝斯' },
    voice: 'mono', polyphony: 6, octave: -1,
    oscillator: { type: 'fatsawtooth', count: 2, spread: 10 },
    envelope: { attack: 0.004, decay: 0.3, sustain: 0.55, release: 0.15 },
    filter: { type: 'lowpass', Q: 2, rolloff: -24 },
    filterEnvelope: { attack: 0.002, decay: 0.25, sustain: 0.3, release: 0.2, baseFrequency: 110, octaves: 3 },
    defaults: { cutoff: 4000, space: 0.08 },
  },
  {
    id: 'acid', name: { en: 'Acid', zh: '酸性 303' },
    voice: 'mono', polyphony: 4, octave: -1, gain: -20,
    oscillator: { type: 'sawtooth' },
    envelope: { attack: 0.002, decay: 0.25, sustain: 0.55, release: 0.08 },
    filter: { type: 'lowpass', Q: 14, rolloff: -24 },
    filterEnvelope: { attack: 0.001, decay: 0.22, sustain: 0.06, release: 0.15, baseFrequency: 150, octaves: 4.2 },
    effects: [{ type: 'distortion', distortion: 0.35, wet: 0.35 }],
    defaults: { cutoff: 6000, space: 0.12 },
  },
  {
    id: 'brass', name: { en: 'Synth brass', zh: '合成銅管' },
    voice: 'mono', polyphony: 12, gain: -3,
    oscillator: { type: 'fatsawtooth', count: 2, spread: 12 },
    envelope: { attack: 0.05, decay: 0.25, sustain: 0.8, release: 0.3 },
    filter: { type: 'lowpass', Q: 1, rolloff: -24 },
    filterEnvelope: { attack: 0.08, decay: 0.4, sustain: 0.6, release: 0.3, baseFrequency: 320, octaves: 3 },
    effects: [{ type: 'chorus', frequency: 1.2, delayTime: 2.5, depth: 0.3, wet: 0.25 }],
    defaults: { cutoff: 7000 },
  },
  { // DX-style FM bell: an inharmonic modulator ratio is what makes it ring like metal
    id: 'bell', name: { en: 'FM bell', zh: 'FM 鐘聲' },
    voice: 'fm', polyphony: 16, gain: 1,
    harmonicity: 3.5, modulationIndex: 10,
    oscillator: { type: 'sine' }, modulation: { type: 'sine' },
    envelope: { attack: 0.001, decay: 2.6, sustain: 0, release: 2.4 },
    modulationEnvelope: { attack: 0.001, decay: 1.4, sustain: 0.05, release: 1.8 },
    defaults: { cutoff: 8000, space: 0.4 },
  },
  {
    id: 'sub', name: { en: 'Sub bass', zh: '超低音' },
    voice: 'synth', polyphony: 4, octave: -1, gain: -11,
    oscillator: { type: 'sine' },
    envelope: { attack: 0.006, decay: 0.1, sustain: 0.95, release: 0.2 },
    defaults: { space: 0 },
  },
  { // 8-bit: a narrow pulse and a hard envelope, the sound of a game console's square channel
    id: 'chip', name: { en: 'Chip (8-bit)', zh: '晶片音（8-bit）' },
    voice: 'synth', polyphony: 8, gain: -11,
    oscillator: { type: 'pulse', width: 0.25 },
    envelope: { attack: 0.001, decay: 0.08, sustain: 0.65, release: 0.04 },
    defaults: { cutoff: 8000, space: 0.1 },
  },
];

/** Everything wrong with a preset ([] = valid). */
export function validateSynthPreset(p) {
  const errs = [];
  if (!p || typeof p !== 'object') return ['a preset is an object'];
  if (typeof p.id !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(p.id)) errs.push(`id ${JSON.stringify(p.id)}: lowercase letters, digits and "-" (it becomes "synth/<id>")`);
  if (p.voice != null && !VOICES[p.voice]) errs.push(`voice "${p.voice}": one of ${Object.keys(VOICES).join(', ')}`);
  for (const [i, fx] of (p.effects || []).entries()) if (!fx || !EFFECTS[fx.type]) errs.push(`effects[${i}].type "${fx?.type}": one of ${Object.keys(EFFECTS).join(', ')}`);
  if (p.octave != null && !Number.isInteger(p.octave)) errs.push('octave: a whole number');
  return errs;
}

const copy = (v) => (v && typeof v === 'object' ? JSON.parse(JSON.stringify(v)) : v);

/** A preset → an instrument definition (id 'synth/<preset id>'). */
export function synthInstrument(preset) {
  const errs = validateSynthPreset(preset);
  if (errs.length) throw new TypeError(`[sound] synth preset ${JSON.stringify(preset?.id)}: ${errs.join(' · ')}`);
  const release = preset.envelope?.release ?? 1;
  return {
    id: 'synth/' + preset.id,
    name: preset.name || preset.id,
    category: preset.category || 'synth',
    credit: preset.credit,
    gain: preset.gain || 0,
    transpose: (preset.octave || 0) * 12,
    defaults: preset.defaults,
    params: preset.params,
    tail: Math.min(8, release * 1.5 + 0.5),
    preset,
    create(Tone, { output }) {
      const opts = {};
      for (const k of VOICE_KEYS) if (preset[k] !== undefined) opts[k] = copy(preset[k]);
      const poly = new Tone.PolySynth(Tone[VOICES[preset.voice || 'synth']], opts);
      poly.maxPolyphony = preset.polyphony || 16;
      const fx = (preset.effects || []).map(({ type, ...o }) => {
        const node = new Tone[EFFECTS[type]](copy(o));
        node.start?.();                          // LFO effects (chorus, tremolo, autofilter) need a start
        return node;
      });
      poly.chain(...fx, output);
      const hz = (n) => 440 * 2 ** ((n - 69) / 12);
      return {
        noteOn(note, vel, time) { poly.triggerAttack(hz(note), time, vel); },
        noteOff(note, time) { poly.triggerRelease(hz(note), time); },
        releaseAll(time) { poly.releaseAll(time); },
        set(key, value) { preset.set?.({ key, value, poly, effects: fx, Tone }); },
        dispose() { poly.dispose(); for (const n of fx) n.dispose(); },
      };
    },
  };
}

/** Add a preset to every picker as 'synth/<id>'. { replace: true } swaps an existing one. */
export function registerSynthPreset(preset, opts) { return registerInstrument(synthInstrument(preset), opts); }
