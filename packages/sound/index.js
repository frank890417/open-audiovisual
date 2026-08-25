// @openav/sound — the audio half of the output layer (L4).
//
// L4 splits into two branches, both optional, both driven by the same
// signals → mapping → params spine:
//
//   video : screen (worlds render) · future NDI
//   audio : MIDI out (external synths — see @openav/midi) · in-browser
//           synthesis — THIS package, with pluggable engines
//
// The engine contract is deliberately small so more engines can grow here
// (samplers, granular, custom WebAudio graphs):
//
//   engine = { params: [...schema], enable(), noteOn(note, vel01), noteOff(note),
//              set(key, value), dispose() }
//
// The Sound shell wires an engine into an app: it subscribes to the standard
// midi/note/* signals (so a QWERTY piano, a MIDI keyboard, a SimPlayer, or a
// sequencer all just make sound), and exposes the engine's params under
// 'sound/…' — meaning a knob, a hand, or the timeline can play the FILTER the
// same way they play the visuals. Sound is performable state, not a side effect.
//
// First engine: Tone.js (https://tonejs.github.io), loaded from CDN only when
// enabled — zero cost if unused, and Tone stays a neighbor, not a dependency.

export class Sound {
  /**
   * @param {object} deps
   * @param {import('../core/src/signals.js?v=0c76e80').Signals} deps.signals
   * @param {import('../core/src/params.js?v=0c76e80').Params} [deps.params] register engine params (prefixed sound/)
   * @param {object} deps.engine engine implementing the contract above
   */
  constructor({ signals, params = null, engine }) {
    this.signals = signals;
    this.engine = engine;
    this.enabled = false;
    this._unsubs = [];
    if (params && engine.params) {
      params.add(engine.params.map(p => ({ ...p, key: 'sound/' + p.key, group: 'sound' })));
    }
  }

  /** Start the engine (must be called from a user gesture — browser audio policy). */
  async enable() {
    await this.engine.enable();
    this.enabled = true;
    this._unsubs.push(
      this.signals.on('midi/note/on', ({ note, vel }) => this.engine.noteOn(note, vel ?? 0.8)),
      this.signals.on('midi/note/off', ({ note }) => this.engine.noteOff(note)),
    );
    return true;
  }

  /** Per frame: push resolved sound/* params into the engine. */
  update(state) {
    if (!this.enabled) return;
    for (const k of Object.keys(state)) {
      if (k.startsWith('sound/')) this.engine.set(k.slice(6), state[k]);
    }
  }

  dispose() { this._unsubs.forEach(u => u()); this._unsubs = []; this.engine.dispose?.(); this.enabled = false; }
}

/** Tone.js engine — a warm poly synth + filter + space, performable via params. */
export function toneEngine({ cdn = 'https://cdn.jsdelivr.net/npm/tone@15.0.4/+esm' } = {}) {
  let Tone = null, synth = null, filter = null, reverb = null, vol = null;
  let lastSet = {};
  return {
    params: [
      { key: 'cutoff',  label: 'Filter cutoff', min: 100, max: 8000, def: 2500 },
      { key: 'space',   label: 'Space (wet)',   min: 0,   max: 1,    def: 0.3 },
      { key: 'volume',  label: 'Volume (dB)',   min: -36, max: 0,    def: -8 },
    ],
    async enable() {
      Tone = (await import(cdn)).default ?? (await import(cdn));
      await Tone.start();
      vol = new Tone.Volume(-8).toDestination();
      reverb = new Tone.Reverb({ decay: 4, wet: 0.3 }).connect(vol);
      filter = new Tone.Filter(2500, 'lowpass').connect(reverb);
      synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'fatsawtooth', count: 3, spread: 18 },
        envelope: { attack: 0.01, decay: 0.25, sustain: 0.4, release: 1.4 },
      }).connect(filter);
      synth.maxPolyphony = 24;
    },
    noteOn(note, vel01) {
      if (!synth) return;
      try { synth.triggerAttack(Tone.Frequency(note, 'midi'), Tone.now(), Math.max(0.05, vel01)); } catch (e) {}
    },
    noteOff(note) {
      if (!synth) return;
      try { synth.triggerRelease(Tone.Frequency(note, 'midi'), Tone.now()); } catch (e) {}
    },
    set(key, value) {
      if (!synth || lastSet[key] === value) return;
      lastSet[key] = value;
      try {
        if (key === 'cutoff') filter.frequency.rampTo(value, 0.05);
        else if (key === 'space') reverb.wet.rampTo(value, 0.1);
        else if (key === 'volume') vol.volume.rampTo(value, 0.05);
      } catch (e) {}
    },
    dispose() { try { synth?.dispose(); filter?.dispose(); reverb?.dispose(); vol?.dispose(); } catch (e) {} synth = null; },
  };
}
