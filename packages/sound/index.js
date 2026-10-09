// @openav/sound — the audio half of the output layer (L4).
//
// L4 splits into two branches, both optional, both driven by the same
// signals → mapping → params spine:
//
//   video : screen (worlds render) · future NDI
//   audio : MIDI out (external synths — see @openav/midi) · in-browser
//           synthesis — THIS package, with pluggable engines
//
// The engine contract is deliberately small so more engines can grow here:
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
// toneEngine() is the in-page synth: Tone.js (https://tonejs.github.io), loaded
// from a CDN only when enabled — zero cost if unused, Tone stays a neighbour,
// not a dependency. It plays INSTRUMENTS from a registry (./registry.js): a
// Salamander grand piano, mallets, strings, organ, choir, harp, and a synth
// module whose presets are plain data. Adding a sound = one file that calls
// registerInstrument(); every picker on the page shows it.
//
// The instrument is a discrete choice (sound.setInstrument, the picker); what
// you PERFORM — cutoff, space, volume, an instrument's own knobs — stays params.

import { SOUND_PARAMS, registerInstrument, getInstrument } from './registry.js?v=0cfcfd4';
import { piano } from './instruments/piano.js?v=0cfcfd4';
import { epiano } from './instruments/epiano.js?v=0cfcfd4';
import { organ } from './instruments/organ.js?v=0cfcfd4';
import { strings } from './instruments/strings.js?v=0cfcfd4';
import { choir } from './instruments/choir.js?v=0cfcfd4';
import { harp } from './instruments/harp.js?v=0cfcfd4';
import { xylophone } from './instruments/xylophone.js?v=0cfcfd4';
import { marimba } from './instruments/marimba.js?v=0cfcfd4';
import { vibraphone } from './instruments/vibraphone.js?v=0cfcfd4';
import { glockenspiel } from './instruments/glockenspiel.js?v=0cfcfd4';
import { musicBox } from './instruments/musicbox.js?v=0cfcfd4';
import { SYNTH_PRESETS, synthInstrument } from './instruments/synth.js?v=0cfcfd4';

export {
  SOUND_PARAMS, CATEGORIES, registerInstrument, unregisterInstrument, getInstrument, listInstruments,
  instrumentName, instrumentGroups, onInstrumentsChange, validateInstrument,
} from './registry.js?v=0cfcfd4';
export { SYNTH_PRESETS, synthInstrument, registerSynthPreset, validateSynthPreset } from './instruments/synth.js?v=0cfcfd4';
export { modalInstrument } from './instruments/modal.js?v=0cfcfd4';
export { salamanderMap, SALAMANDER_NOTES } from './instruments/piano.js?v=0cfcfd4';
export { mountSoundPicker } from './picker.js?v=0cfcfd4';

export const TONE_CDN = 'https://cdn.jsdelivr.net/npm/tone@15.0.4/+esm';
/** Where the built-in sample sets live when nobody says otherwise (GitHub Pages sends CORS headers).
 *  createShow() points this at the copy next to the page instead. */
export const SAMPLES_URL = 'https://openaudiovisual.com/packages/sound/samples/';
/** The framework's original voice (three detuned saws), still the default. */
export const DEFAULT_INSTRUMENT = 'synth/pad';

export const BUILTIN_INSTRUMENTS = [
  piano, epiano, xylophone, marimba, vibraphone, glockenspiel, musicBox,
  strings, harp, organ, choir, ...SYNTH_PRESETS.map(synthInstrument),
];
// built-ins only fill empty slots: a piece that registered its own 'piano' first keeps it
for (const def of BUILTIN_INSTRUMENTS) if (!getInstrument(def.id)) registerInstrument(def);

/**
 * modules.sound in createShow(), normalized.
 *   true                     → defaults (the warm pad, or the last pick on this page)
 *   'piano'                  → start on that instrument
 *   { instrument, remember, picker, engine, …toneEngine options }
 */
export function soundOptions(value) {
  if (!value) return null;
  if (value === true) return { engine: null, instrument: null, remember: true, picker: true, engineOptions: {} };
  if (typeof value === 'string') return { engine: null, instrument: value, remember: true, picker: true, engineOptions: {} };
  if (typeof value === 'object' && !Array.isArray(value)) {
    const { engine = null, instrument = null, remember = true, picker = true, ...engineOptions } = value;
    if (instrument != null && typeof instrument !== 'string') throw new TypeError('modules.sound.instrument: an instrument id such as "piano" or "synth/pluck"');
    return { engine, instrument, remember, picker, engineOptions };
  }
  throw new TypeError('modules.sound: true, an instrument id, or { instrument, remember, picker, engine, baseUrl, cdn, instruments }');
}

const pageKey = () => {
  try { return 'openav:sound:' + (globalThis.location?.pathname || '/'); } catch (e) { return 'openav:sound:/'; }
};

export class Sound {
  /**
   * @param {object} deps
   * @param {import('../core/src/signals.js?v=0cfcfd4').Signals} deps.signals
   * @param {import('../core/src/params.js?v=0cfcfd4').Params} [deps.params] register engine params (prefixed sound/)
   * @param {object} deps.engine engine implementing the contract above
   * @param {string} [deps.instrument] starting instrument (engines that have instruments)
   * @param {boolean|string} [deps.remember] keep the picker's last choice per page in localStorage (a string = your own key)
   * @param {boolean} [deps.picker] show the instrument picker in the console (default true)
   */
  constructor({ signals, params = null, engine, instrument = null, remember = true, picker = true }) {
    this.signals = signals;
    this.params = params;
    this.engine = engine;
    this.enabled = false;
    this.picker = picker;
    this._unsubs = [];
    this._subs = new Set();
    this._instKeys = new Set();
    this._key = remember ? (typeof remember === 'string' ? remember : pageKey()) : null;
    if (engine.setInstrument) {
      const recalled = this._recall();
      const known = (id) => id && (engine.hasInstrument ? engine.hasInstrument(id) : !!getInstrument(id));
      const start = known(recalled) ? recalled : instrument;
      if (start && !known(start)) console.warn(`[sound] unknown instrument "${start}"; keeping ${engine.instrument}`);
      else if (start) engine.setInstrument(start);
    }
    signals?.define?.('sound/instrument', { kind: 'pulse', source: 'sound', description: 'the instrument changed: {id, name}' });
    this._syncParams();
    this._offEngine = engine.subscribe?.((ev) => this._onEngine(ev)) || null;
  }

  /** Start the engine (must be called from a user gesture — browser audio policy). */
  async enable() {
    if (this.enabled) return true;
    if (!this._enabling) {
      this._enabling = (async () => {
        await this.engine.enable();
        this.enabled = true;
        const skip = (ch) => ch != null && this.engine.skipChannels?.includes(ch);
        this._unsubs.push(
          this.signals.on('midi/note/on', ({ note, vel, ch }) => { if (!skip(ch)) this.engine.noteOn(note, vel ?? 0.8); }),
          this.signals.on('midi/note/off', ({ note, ch }) => { if (!skip(ch)) this.engine.noteOff(note); }),
          // the sustain pedal is an event (down/up), so it may travel as a signal
          this.signals.on('midi/cc/64', (v) => this.engine.sustain?.(v >= 0.5)),
        );
        this._emit({ type: 'enabled', id: this.instrument });
        return true;
      })();
      this._enabling.catch(() => { this._enabling = null; });
    }
    return this._enabling;
  }

  /** Per frame: push resolved sound/* params into the engine. */
  update(state) {
    if (!this.enabled) return;
    for (const k of Object.keys(state)) {
      if (k.startsWith('sound/')) this.engine.set(k.slice(6), state[k]);
    }
  }

  /** Current instrument id (null for engines without instruments, e.g. drumEngine). */
  get instrument() { return this.engine.instrument ?? null; }
  /** { id, state: 'idle'|'loading'|'ready'|'error', progress 0..1, error } */
  get status() { return this.engine.status ?? { id: null, state: this.enabled ? 'ready' : 'idle', progress: 1, error: null }; }
  /** Whether this engine has instruments to choose from. */
  get choosable() { return typeof this.engine.setInstrument === 'function'; }

  /**
   * Switch instruments, live. Held notes are released on the old one, the new one
   * takes over once it is ready (a sampler keeps the old sound playing while it loads).
   * { remember: true } stores the choice for this page (the picker does that).
   * Resolves true once the instrument plays, false if it was unknown or superseded.
   */
  async setInstrument(id, { remember = false } = {}) {
    if (!this.choosable) return false;
    if (remember) this._remember(id);
    return this.engine.setInstrument(id);
  }

  /** Listen to { type: 'instrument' | 'loading' | 'ready' | 'error' | 'enabled', id, progress, error }. */
  onChange(cb) { this._subs.add(cb); return () => this._subs.delete(cb); }

  dispose() {
    this._unsubs.forEach(u => u()); this._unsubs = [];
    this._offEngine?.(); this._subs.clear();
    this.engine.dispose?.(); this.enabled = false; this._enabling = null;
  }

  _onEngine(ev) {
    if (ev.type === 'instrument') {
      this._syncParams();
      this.signals?.pulse?.('sound/instrument', { id: ev.id, name: ev.name });
    }
    this._emit(ev);
  }
  _emit(ev) { for (const cb of this._subs) { try { cb(ev); } catch (e) { console.error('[sound] listener', e); } } }

  // Register the engine's params as sound/*; an instrument's own params show only while it plays,
  // and its preferred starting values become the defaults (automation and overrides still win).
  _syncParams() {
    if (!this.params || !this.engine.params) return;
    const list = this.engine.params;
    this.params.add(list.map(p => ({ ...p, key: 'sound/' + p.key, group: 'sound' })));
    if (!this.choosable) return;
    const shared = new Set((this.engine.sharedParams || []).map(p => p.key));
    for (const p of list) if (!shared.has(p.key)) this._instKeys.add(p.key);
    for (const k of this._instKeys) {
      const sp = this.params.get('sound/' + k);
      if (sp) sp.hidden = !list.some(p => p.key === k);
    }
    for (const p of list) {
      const sp = this.params.get('sound/' + p.key);
      if (sp && Number.isFinite(p.def)) sp.def = Math.min(sp.max, Math.max(sp.min, p.def));
    }
  }
  _recall() {
    if (!this._key) return null;
    try { return globalThis.localStorage?.getItem(this._key) || null; } catch (e) { return null; }
  }
  _remember(id) {
    if (!this._key) return;
    try { globalThis.localStorage?.setItem(this._key, id); } catch (e) {}
  }
}

/**
 * Tone.js engine — registry instruments → filter → reverb ("space") → volume → limiter.
 *
 *   toneEngine({ instrument = 'synth/pad', baseUrl, instruments: { piano: { baseUrl } }, cdn, drumChannel = 10 })
 *
 * baseUrl: folder holding the built-in sample sets (salamander/…). instruments: per-instrument
 * options handed to create(). drumChannel: notes on this MIDI channel belong to a drum engine
 * (the drum machine sends GM channel 10) and are not played here; null plays everything.
 */
export function toneEngine({
  cdn = TONE_CDN, instrument = DEFAULT_INSTRUMENT, baseUrl = SAMPLES_URL,
  instruments: perInstrument = {}, drumChannel = 10,
} = {}) {
  let Tone = null, chain = null;
  let cur = null;          // { def, inst, slot } — the one that plays
  let pending = null;      // the one loading (samples); notes keep going to `cur` meanwhile
  let wanted = getInstrument(instrument) ? instrument : DEFAULT_INSTRUMENT;
  if (wanted !== instrument) console.warn(`[sound] unknown instrument "${instrument}"; using ${DEFAULT_INSTRUMENT}`);
  let status = { id: wanted, state: 'idle', progress: 0, error: null };
  const held = new Set(), sustained = new Set();
  let pedal = false;
  const lastSet = {};
  const subs = new Set();
  const shared = new Set(SOUND_PARAMS.map(p => p.key));
  const emit = (ev) => { for (const cb of subs) { try { cb(ev); } catch (e) { console.error('[sound] engine listener', e); } } };
  const setStatus = (s) => { status = { ...status, ...s }; };
  const nameOf = (def) => (typeof def.name === 'string' ? def.name : def.name.en);
  const now = () => Tone.immediate();     // live input: no Tone lookAhead (that is 100 ms of latency)

  function build(def) {
    const slot = new Tone.Gain(Tone.dbToGain(def.gain || 0)).connect(chain.input);
    let inst;
    try {
      inst = def.create(Tone, {
        output: slot, rawOutput: slot.input, rawContext: Tone.getContext().rawContext,
        baseUrl, options: perInstrument[def.id] || {},
        onProgress: (p) => { if (pending?.slot === slot) { setStatus({ progress: p }); emit({ type: 'loading', id: def.id, progress: p }); } },
      });
      if (!inst || typeof inst.noteOn !== 'function' || typeof inst.noteOff !== 'function') throw new TypeError(`instrument "${def.id}": create() must return { noteOn, noteOff, dispose }`);
    } catch (e) { slot.dispose(); throw e; }
    return { def, inst, slot };
  }
  const drop = (v, after = 0) => {
    const kill = () => { try { v.inst.dispose?.(); } catch (e) {} try { v.slot.dispose(); } catch (e) {} };
    after > 0 ? setTimeout(kill, after * 1000) : kill();
  };
  // release everything the old instrument holds, let its tail ring, then free it
  const retire = (v) => {
    const t = now(), tr = v.def.transpose || 0;
    try { v.inst.releaseAll ? v.inst.releaseAll(t) : [...held, ...sustained].forEach(n => v.inst.noteOff(n + tr, t)); } catch (e) {}
    drop(v, v.def.tail ?? 3);
  };
  const swapIn = (v) => {
    const old = cur;
    cur = v;
    if (old) retire(old);
    held.clear(); sustained.clear();
    // the new instrument picks up the current values of the params it understands
    for (const [k, val] of Object.entries(lastSet)) if (!shared.has(k)) { try { v.inst.set?.(k, val); } catch (e) {} }
    wanted = v.def.id;
    setStatus({ id: v.def.id, state: 'ready', progress: 1, error: null });
    emit({ type: 'instrument', id: v.def.id, name: nameOf(v.def), def: v.def });
    emit({ type: 'ready', id: v.def.id });
  };

  async function load(id) {
    const def = getInstrument(id);
    if (!def) { console.warn(`[sound] unknown instrument "${id}"`); return false; }
    if (!Tone) {                                   // not enabled yet: just remember the choice
      wanted = id;
      setStatus({ id, state: 'idle', progress: 0, error: null });
      emit({ type: 'instrument', id, name: nameOf(def), def });
      return true;
    }
    if (pending?.def.id === id) return pending.wait;  // already on its way
    if (pending) { drop(pending); pending = null; }
    if (cur?.def.id === id) {                         // back to the one already playing
      setStatus({ id, state: 'ready', progress: 1, error: null });
      emit({ type: 'instrument', id, name: nameOf(def), def });
      return true;
    }
    let v;
    try { v = build(def); } catch (e) {
      console.error('[sound]', e);
      setStatus({ state: 'error', error: String(e.message || e) });
      emit({ type: 'error', id, error: e });
      return false;
    }
    if (!v.inst.ready || typeof v.inst.ready.then !== 'function') { swapIn(v); return true; }
    pending = v;
    wanted = id;
    setStatus({ id, state: 'loading', progress: 0, error: null });
    emit({ type: 'loading', id, progress: 0 });
    v.wait = settle(v, def);
    return v.wait;
  }

  async function settle(v, def) {
    const id = def.id;
    try {
      await v.inst.ready;
    } catch (e) {
      if (pending !== v) return false;
      pending = null; drop(v);
      if (cur) wanted = cur.def.id;
      console.warn(`[sound] ${id} could not load (${e?.message || e})` + (def.fallback ? `; playing ${def.fallback} instead` : ''));
      setStatus({ state: 'error', error: String(e?.message || e) });
      emit({ type: 'error', id, error: e, fallback: def.fallback || null });
      if (def.fallback && getInstrument(def.fallback)) return load(def.fallback);
      return false;
    }
    if (pending !== v) return false;               // the performer already picked something else
    pending = null;
    swapIn(v);
    return true;
  }

  const engine = {
    sharedParams: SOUND_PARAMS,
    /** shared params with this instrument's preferred defaults, then the instrument's own */
    get params() {
      const def = getInstrument(wanted);
      const d = def?.defaults || {};
      return [...SOUND_PARAMS.map(p => (p.key in d ? { ...p, def: d[p.key] } : { ...p })), ...(def?.params || [])];
    },
    get instrument() { return wanted; },
    get status() { return { ...status }; },
    skipChannels: drumChannel == null ? [] : [drumChannel],
    hasInstrument: (id) => !!getInstrument(id),
    subscribe(cb) { subs.add(cb); return () => subs.delete(cb); },
    setInstrument: (id) => load(id),
    async enable() {
      if (Tone) return;
      const mod = await import(cdn);
      const T = mod.default ?? mod;
      await T.start();
      Tone = T;
      const limiter = new Tone.Limiter(-1).toDestination();          // switching to a loud organ never clips the room
      const vol = new Tone.Volume(-8).connect(limiter);
      const reverb = new Tone.Reverb({ decay: 4, wet: 0.3 }).connect(vol);
      const filter = new Tone.Filter(2500, 'lowpass').connect(reverb);
      chain = { input: filter, filter, reverb, vol, limiter };
      for (const [k, v] of Object.entries(lastSet)) { delete lastSet[k]; engine.set(k, v); }
      load(wanted);                                // a sampler loads in the background; enable() does not wait for it
    },
    noteOn(note, vel01, time) {
      if (!cur) return;
      const t = time ?? now(), tr = cur.def.transpose || 0;
      try {
        if (held.has(note) || sustained.has(note)) { cur.inst.noteOff(note + tr, t); sustained.delete(note); }
        held.add(note);
        cur.inst.noteOn(note + tr, Math.max(0.05, Math.min(1, vel01)), t);
      } catch (e) { console.warn('[sound] noteOn', e); }
    },
    noteOff(note, time) {
      if (!held.delete(note) || !cur) return;      // not ours: it was held before an instrument switch
      if (pedal) { sustained.add(note); return; }
      try { cur.inst.noteOff(note + (cur.def.transpose || 0), time ?? now()); } catch (e) { console.warn('[sound] noteOff', e); }
    },
    /** sustain pedal (CC 64): note-offs wait until the pedal comes up */
    sustain(down) {
      pedal = !!down;
      if (pedal || !cur) return;
      const t = now(), tr = cur.def.transpose || 0;
      for (const n of sustained) if (!held.has(n)) { try { cur.inst.noteOff(n + tr, t); } catch (e) {} }
      sustained.clear();
    },
    /** release every note (panic) */
    releaseAll() {
      if (!cur) return;
      const t = now(), tr = cur.def.transpose || 0;
      try { cur.inst.releaseAll ? cur.inst.releaseAll(t) : [...held, ...sustained].forEach(n => cur.inst.noteOff(n + tr, t)); } catch (e) {}
      held.clear(); sustained.clear();
    },
    set(key, value) {
      if (lastSet[key] === value) return;
      lastSet[key] = value;
      if (!chain) return;
      try {
        if (key === 'cutoff') chain.filter.frequency.rampTo(value, 0.05);
        else if (key === 'space') chain.reverb.wet.rampTo(value, 0.1);
        else if (key === 'volume') chain.vol.volume.rampTo(value, 0.05);
        else cur?.inst.set?.(key, value);
      } catch (e) {}
    },
    dispose() {
      if (pending) { drop(pending); pending = null; }
      if (cur) { drop(cur); cur = null; }
      if (chain) for (const n of [chain.filter, chain.reverb, chain.vol, chain.limiter]) { try { n.dispose(); } catch (e) {} }
      chain = null; Tone = null;
      held.clear(); sustained.clear(); subs.clear();
      setStatus({ state: 'idle', progress: 0 });
    },
  };
  return engine;
}
