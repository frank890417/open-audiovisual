// @openav/sound: the instrument registry, the synth presets, the Salamander sample
// map, modules.sound option parsing, and the engine's note bookkeeping (held notes,
// sustain pedal, live instrument switching, loading, fallback) against a fake Tone —
// pure logic, no audio device.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  Sound, toneEngine, soundOptions, DEFAULT_INSTRUMENT, BUILTIN_INSTRUMENTS, SOUND_PARAMS,
  registerInstrument, unregisterInstrument, getInstrument, listInstruments, instrumentGroups, instrumentName,
  onInstrumentsChange, validateInstrument, SYNTH_PRESETS, synthInstrument, registerSynthPreset, validateSynthPreset,
  salamanderMap, SALAMANDER_NOTES, modalInstrument,
} from '../packages/sound/index.js';
import { noteName } from '../packages/sound/instruments/piano.js';
import { drawbarPartials } from '../packages/sound/instruments/organ.js';
import { Signals, Params } from '../packages/core/index.js';
import { drumEngine } from '../packages/drums/index.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tick = () => new Promise((r) => setTimeout(r, 0));

// ───────────── registry ─────────────

test('built-ins: every definition is valid and registered, grouped in picker order', () => {
  assert.ok(BUILTIN_INSTRUMENTS.length >= 20);
  for (const d of BUILTIN_INSTRUMENTS) {
    assert.deepEqual(validateInstrument(d), [], d.id);
    assert.equal(getInstrument(d.id), d);
  }
  for (const id of ['piano', 'epiano', 'xylophone', 'marimba', 'vibraphone', 'glockenspiel', 'music-box', 'strings', 'harp', 'organ', 'choir', 'synth/pad', 'synth/acid'])
    assert.ok(getInstrument(id), id);
  const groups = instrumentGroups('en', BUILTIN_INSTRUMENTS);
  assert.deepEqual(groups.map((g) => g.id), ['keys', 'mallets', 'strings', 'plucked', 'organ', 'voice', 'synth']);
  assert.deepEqual(groups[0].items.map((d) => d.id), ['piano', 'epiano']);
  assert.equal(instrumentGroups('zh', BUILTIN_INSTRUMENTS)[1].label, '敲擊琴');
  assert.equal(instrumentGroups('en', [...BUILTIN_INSTRUMENTS, { id: 'z', category: 'zither' }]).at(-1).label, 'zither', 'unknown categories sort last');
  assert.deepEqual(listInstruments({ category: 'mallets' }).map((d) => d.id), ['xylophone', 'marimba', 'vibraphone', 'glockenspiel', 'music-box']);
  assert.equal(instrumentName(getInstrument('glockenspiel'), 'zh'), '鐵琴');
  assert.equal(instrumentName(getInstrument('glockenspiel'), 'fr'), 'Glockenspiel', 'unknown language falls back to English');
  assert.equal(DEFAULT_INSTRUMENT, 'synth/pad');
});

test('the piano carries its CC-BY credit and a fallback; ids and names are unique', () => {
  const p = getInstrument('piano');
  assert.match(p.credit.text, /Salamander Grand Piano.*Alexander Holm.*CC-BY 3\.0/);
  assert.match(p.credit.url, /^https:\/\//);
  assert.equal(p.fallback, 'epiano');
  const ids = BUILTIN_INSTRUMENTS.map((d) => d.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const d of BUILTIN_INSTRUMENTS) assert.ok(d.name.en && d.name.zh, `${d.id} has en and zh names`);
});

test('register: duplicates are rejected unless replaced on purpose; unregister; listeners', () => {
  const seen = [];
  const off = onInstrumentsChange((e) => seen.push(e.type + ':' + e.id));
  const def = { id: 'test/kalimba', name: 'Kalimba', category: 'mallets', create: () => ({ noteOn() {}, noteOff() {} }) };
  registerInstrument(def);
  assert.equal(getInstrument('test/kalimba'), def);
  assert.throws(() => registerInstrument({ ...def }), /already registered.*replace: true/);
  const v2 = { ...def, name: 'Kalimba 2' };
  registerInstrument(v2, { replace: true });
  assert.equal(getInstrument('test/kalimba'), v2);
  assert.ok(listInstruments({ category: 'mallets' }).includes(v2));
  assert.equal(unregisterInstrument('test/kalimba'), true);
  assert.equal(unregisterInstrument('test/kalimba'), false);
  assert.equal(getInstrument('test/kalimba'), null);
  off();
  registerInstrument(def); unregisterInstrument(def.id);
  assert.deepEqual(seen, ['register:test/kalimba', 'register:test/kalimba', 'unregister:test/kalimba']);
});

test('validation explains what is wrong', () => {
  const ok = { id: 'x', name: 'X', category: 'other', create() {} };
  assert.deepEqual(validateInstrument(ok), []);
  const bad = (patch) => validateInstrument({ ...ok, ...patch }).join(' | ');
  assert.match(bad({ id: 'Piano' }), /^id/);
  assert.match(bad({ id: 'a/b/c' }), /at most one "\/"/);
  assert.match(bad({ name: '' }), /name/);
  assert.match(bad({ name: { zh: '只有中文' } }), /name/);
  assert.match(bad({ category: 3 }), /category/);
  assert.match(bad({ create: null }), /create/);
  assert.match(bad({ params: [{ key: 'cutoff', min: 0, max: 1, def: 0 }] }), /shared sound param.*defaults/);
  assert.match(bad({ params: [{ key: 'decay', min: 1, max: 0, def: 0 }] }), /min < max/);
  assert.match(bad({ params: [{ key: 'decay', min: 0, max: 1, def: 2 }] }), /def must lie within/);
  assert.match(bad({ defaults: { cutoff: 99999 } }), /defaults\.cutoff/);
  assert.match(bad({ defaults: { decay: 1 } }), /only cutoff, space, volume/);
  assert.match(bad({ credit: 42 }), /credit/);
  assert.match(bad({ gain: '6dB' }), /gain/);
  assert.match(bad({ fallback: 'x' }), /fallback/);
  assert.throws(() => registerInstrument({ ...ok, id: 'BAD' }), TypeError);
  assert.deepEqual(validateInstrument(null), ['an instrument definition is an object']);
});

// ───────────── synth presets ─────────────

test('synth presets are data: all valid, all registered as synth/<id>', () => {
  assert.ok(SYNTH_PRESETS.length >= 10);
  for (const p of SYNTH_PRESETS) {
    assert.deepEqual(validateSynthPreset(p), [], p.id);
    const d = getInstrument('synth/' + p.id);
    assert.ok(d, p.id);
    assert.equal(d.category, 'synth');
    assert.equal(d.transpose, (p.octave || 0) * 12);
  }
  for (const id of ['pad', 'saw-lead', 'square-lead', 'pluck', 'supersaw', 'bass', 'acid', 'brass', 'bell', 'sub', 'chip'])
    assert.ok(getInstrument('synth/' + id), id);
});

test('synth/pad is the original warm voice, unchanged (back-compat)', () => {
  const pad = SYNTH_PRESETS.find((p) => p.id === 'pad');
  assert.deepEqual(pad.oscillator, { type: 'fatsawtooth', count: 3, spread: 18 });
  assert.deepEqual(pad.envelope, { attack: 0.01, decay: 0.25, sustain: 0.4, release: 1.4 });
  assert.equal(pad.polyphony, 24);
  assert.ok(!pad.gain && !pad.effects && !pad.defaults, 'no extra gain, effects or defaults');
});

test('registerSynthPreset adds a selectable sound; bad presets are refused', () => {
  const d = registerSynthPreset({ id: 'test-glass', name: { en: 'Glass', zh: '玻璃' }, voice: 'fm', harmonicity: 3.01, envelope: { release: 2 } });
  assert.equal(d.id, 'synth/test-glass');
  assert.equal(getInstrument('synth/test-glass'), d);
  assert.equal(d.tail, 3.5);
  assert.throws(() => registerSynthPreset({ id: 'test-glass' }), /already registered/);
  assert.throws(() => synthInstrument({ id: 'x', voice: 'theremin' }), /voice "theremin"/);
  assert.throws(() => synthInstrument({ id: 'x', effects: [{ type: 'flanger9000' }] }), /effects\[0\]\.type/);
  assert.throws(() => synthInstrument({ id: 'X Y' }), /id/);
  unregisterInstrument('synth/test-glass');
});

// ───────────── piano samples ─────────────

test('Salamander map: 30 files, a minor third apart, A0..C8, names ↔ files', () => {
  assert.equal(SALAMANDER_NOTES.length, 30);
  assert.equal(SALAMANDER_NOTES[0], 21);
  assert.equal(SALAMANDER_NOTES.at(-1), 108);
  for (let i = 1; i < 30; i++) assert.equal(SALAMANDER_NOTES[i] - SALAMANDER_NOTES[i - 1], 3);
  const map = salamanderMap();
  const names = Object.keys(map);
  assert.equal(names.length, 30);
  assert.deepEqual(names.slice(0, 5), ['A0', 'C1', 'D#1', 'F#1', 'A1']);
  assert.equal(map['D#1'], 'Ds1.mp3');
  assert.equal(map['F#4'], 'Fs4.mp3');
  assert.equal(map.C8, 'C8.mp3');
  assert.equal(noteName(60), 'C4');
  assert.equal(noteName(61), 'C#4');
  // every key of an 88-key piano is at most a semitone and a half from a sample
  for (let n = 21; n <= 108; n++) assert.ok(Math.min(...SALAMANDER_NOTES.map((s) => Math.abs(s - n))) <= 1.5, n);
});

test('every sample the map names is in the repo, and nothing else is', () => {
  const dir = path.join(ROOT, 'packages/sound/samples/salamander');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.mp3')).sort();
  assert.deepEqual(files, Object.values(salamanderMap()).sort());
  const bytes = files.reduce((s, f) => s + fs.statSync(path.join(dir, f)).size, 0);
  assert.ok(bytes < 2.5e6, `samples stay small (${bytes} bytes)`);
  assert.match(fs.readFileSync(path.join(dir, 'ATTRIBUTION.txt'), 'utf8'), /Alexander Holm[\s\S]*CC-BY 3\.0|CC BY 3\.0/);
});

test('organ drawbars: 16\' is the fundamental, each notch is ~3 dB', () => {
  const p = drawbarPartials([0, 0, 8, 0, 0, 0, 0, 0, 0]);     // 8' alone = 2nd partial of the 16'
  assert.equal(p.length, 16);
  assert.equal(p[1], 1);
  assert.equal(p.filter(Boolean).length, 1);
  const q = drawbarPartials([0, 0, 5, 0, 0, 0, 0, 0, 8]);     // 8' at 5 (−9 dB), 1' at 8 (16th partial)
  assert.ok(Math.abs(20 * Math.log10(q[1]) + 9) < 1e-9);
  assert.equal(q[15], 1);
});

test('modalInstrument turns partial data into a valid definition', () => {
  const d = modalInstrument({ id: 'test-bar', name: 'Bar', partials: [{ ratio: 1, gain: 1, decay: 2 }, { ratio: 3, gain: 0.3, decay: 0.5 }] });
  assert.deepEqual(validateInstrument(d), []);
  assert.equal(d.category, 'mallets');
  assert.equal(d.tail, 3.2);
});

// ───────────── modules.sound ─────────────

test('soundOptions: true, an id, an object; falsy means no sound', () => {
  assert.equal(soundOptions(false), null);
  assert.equal(soundOptions(undefined), null);
  assert.deepEqual(soundOptions(true), { engine: null, instrument: null, remember: true, picker: true, engineOptions: {} });
  assert.deepEqual(soundOptions('piano'), { engine: null, instrument: 'piano', remember: true, picker: true, engineOptions: {} });
  const eng = { params: [] };
  assert.deepEqual(soundOptions({ instrument: 'organ', remember: false, picker: false, baseUrl: '/s/', engine: eng }),
    { engine: eng, instrument: 'organ', remember: false, picker: false, engineOptions: { baseUrl: '/s/' } });
  assert.throws(() => soundOptions({ instrument: 3 }), /instrument/);
  assert.throws(() => soundOptions(42), /modules\.sound/);
});

// ───────────── the engine, against a fake Tone ─────────────

const FAKE_TONE = 'data:text/javascript,' + encodeURIComponent(`
  class P { constructor() { this.value = 0; } rampTo(v) { this.value = v; } }
  class N { constructor(v) { this.input = {}; this.gain = v; this.frequency = new P(); this.wet = new P(); this.volume = new P(); }
    connect() { return this; } toDestination() { return this; } dispose() { this.disposed = true; } }
  export default { start: async () => {}, Gain: N, Limiter: N, Volume: N, Reverb: N, Filter: N,
    dbToGain: (d) => 10 ** (d / 20), immediate: () => 0, getContext: () => ({ rawContext: {} }) };`);

const made = [];                                   // every instrument instance the engine builds
const testInst = (id, extra = {}) => ({
  id, name: id, category: 'other', tail: 0, ...extra,
  create(Tone, ctx) {
    const me = { id, calls: [], ctx };
    made.push(me);
    return {
      ...(extra.ready ? { ready: extra.ready() } : {}),
      noteOn: (n, v) => me.calls.push('on ' + n),
      noteOff: (n) => me.calls.push('off ' + n),
      releaseAll: () => me.calls.push('releaseAll'),
      set: (k, v) => me.calls.push(`set ${k}=${v}`),
      dispose: () => me.calls.push('dispose'),
    };
  },
});
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const last = (id) => made.filter((m) => m.id === id).at(-1);

registerInstrument(testInst('test/a', { params: [{ key: 'decay', min: 0, max: 4, def: 1 }], defaults: { cutoff: 8000 } }));
registerInstrument(testInst('test/b', { transpose: 12 }));
registerInstrument(testInst('test/c', { params: [{ key: 'rotor', min: 0, max: 1, def: 0 }], defaults: { cutoff: 7000 } }));
const slowGate = { current: null };
registerInstrument(testInst('test/slow', { ready: () => slowGate.current.promise, fallback: 'test/a' }));

test('engine: notes reach the instrument, transposed; the pedal holds note-offs', async () => {
  const e = toneEngine({ cdn: FAKE_TONE, instrument: 'test/a' });
  assert.equal(e.instrument, 'test/a');
  await e.enable();
  const a = last('test/a');
  assert.equal(e.status.state, 'ready');
  e.noteOn(60, 0.8); e.noteOff(60);
  assert.deepEqual(a.calls, ['on 60', 'off 60']);
  e.noteOff(61);                                   // never pressed: ignored
  e.sustain(true);
  e.noteOn(62, 0.5); e.noteOff(62);
  assert.deepEqual(a.calls.slice(2), ['on 62'], 'pedal down: the note keeps sounding');
  e.noteOn(62, 0.5);                               // re-strike under the pedal: release, then strike
  assert.deepEqual(a.calls.slice(3), ['off 62', 'on 62']);
  e.noteOff(62);
  e.sustain(false);
  assert.deepEqual(a.calls.slice(5), ['off 62'], 'pedal up releases it');
  await e.setInstrument('test/b');
  const b = last('test/b');
  e.noteOn(60, 1);
  assert.deepEqual(b.calls, ['on 72'], 'test/b sounds an octave up');
  e.dispose();
});

test('engine: switching mid-note releases the old instrument and never leaves a stuck note', async () => {
  const e = toneEngine({ cdn: FAKE_TONE, instrument: 'test/a' });
  await e.enable();
  const a = last('test/a');
  e.set('decay', 2.5); e.set('cutoff', 1200);
  e.noteOn(60, 1); e.noteOn(64, 1);
  const events = [];
  e.subscribe((ev) => events.push(ev.type + ':' + ev.id));
  assert.equal(await e.setInstrument('test/b'), true);
  assert.deepEqual(a.calls.slice(-2), ['releaseAll', 'dispose'], 'old instrument released, then freed after its tail');
  const b = last('test/b');
  assert.deepEqual(b.calls, ['set decay=2.5'], 'the new one picks up the instrument params, not the shared ones');
  e.noteOff(60); e.noteOff(64);                    // the performer lifts keys pressed before the switch
  assert.deepEqual(b.calls, ['set decay=2.5'], 'no note-off reaches the new instrument for notes it never played');
  assert.deepEqual(events, ['instrument:test/b', 'ready:test/b']);
  e.dispose();
});

test('engine: a loading instrument does not interrupt the playing one; a later pick wins', async () => {
  const e = toneEngine({ cdn: FAKE_TONE, instrument: 'test/a' });
  await e.enable();
  const a = last('test/a');
  slowGate.current = deferred();
  const p = e.setInstrument('test/slow');
  assert.equal(e.status.state, 'loading');
  assert.equal(e.instrument, 'test/slow');
  e.noteOn(60, 1);
  assert.equal(a.calls.at(-1), 'on 60', 'still playing the old instrument while samples load');
  const slow = last('test/slow');
  slow.ctx.onProgress(0.5);
  assert.equal(e.status.progress, 0.5);
  assert.equal(await e.setInstrument('test/b'), true, 'the performer changed their mind');
  assert.ok(slow.calls.includes('dispose'), 'the half-loaded one is dropped');
  slowGate.current.resolve();
  assert.equal(await p, false, 'the superseded load reports false');
  await tick();
  assert.equal(e.instrument, 'test/b');
  e.dispose();
});

test('engine: a failed load falls back instead of going silent', async () => {
  const e = toneEngine({ cdn: FAKE_TONE, instrument: 'test/b' });
  await e.enable();
  const errors = [];
  e.subscribe((ev) => ev.type === 'error' && errors.push(ev));
  slowGate.current = deferred();
  const p = e.setInstrument('test/slow');
  slowGate.current.reject(new Error('404'));
  const warn = console.warn; console.warn = () => {};
  try { assert.equal(await p, true); } finally { console.warn = warn; }
  assert.equal(e.instrument, 'test/a');
  assert.equal(errors[0].fallback, 'test/a');
  e.dispose();
});

test('engine: before enable a pick is only remembered; unknown ids are refused', async () => {
  const e = toneEngine({ cdn: FAKE_TONE, instrument: 'test/a' });
  const seen = [];
  e.subscribe((ev) => seen.push(ev.type + ':' + ev.id));
  const before = made.length;
  assert.equal(await e.setInstrument('test/b'), true);
  assert.equal(made.length, before, 'nothing is built before enable');
  assert.equal(e.instrument, 'test/b');
  const warn = console.warn; console.warn = () => {};
  try { assert.equal(await e.setInstrument('nope'), false); } finally { console.warn = warn; }
  assert.deepEqual(seen, ['instrument:test/b']);
  assert.deepEqual(e.skipChannels, [10]);
  assert.deepEqual(toneEngine({ drumChannel: null }).skipChannels, []);
  assert.equal(toneEngine().instrument, DEFAULT_INSTRUMENT);
});

test('engine params: shared ones with the instrument\'s preferred defaults, then its own', () => {
  const keys = (e) => e.params.map((p) => `${p.key}=${p.def}`).join(' ');
  assert.equal(keys(toneEngine()), 'cutoff=2500 space=0.3 volume=-8', 'the default keeps the original params');
  assert.equal(keys(toneEngine({ instrument: 'test/a' })), 'cutoff=8000 space=0.3 volume=-8 decay=1');
  assert.deepEqual(toneEngine({ instrument: 'organ' }).params.map((p) => p.key), ['cutoff', 'space', 'volume', 'drawbars', 'rotor']);
  assert.deepEqual(SOUND_PARAMS.map((p) => p.key), ['cutoff', 'space', 'volume']);
});

// ───────────── the Sound shell ─────────────

const store = new Map();
globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)) };

test('Sound: plays midi/note/*, skips the drum channel, follows the pedal', async () => {
  const signals = new Signals(), params = new Params();
  const sound = new Sound({ signals, params, engine: toneEngine({ cdn: FAKE_TONE }), instrument: 'test/a', remember: false });
  await sound.enable();
  const a = last('test/a');
  signals.pulse('midi/note/on', { note: 60, vel: 0.7, ch: 1 });
  signals.pulse('midi/note/on', { note: 36, vel: 1, ch: 10 });       // the drum machine's kick
  signals.set('midi/cc/64', 1);
  signals.pulse('midi/note/off', { note: 60, ch: 1 });
  assert.deepEqual(a.calls, ['on 60']);
  signals.set('midi/cc/64', 0);
  assert.deepEqual(a.calls, ['on 60', 'off 60']);
  sound.update({ 'sound/decay': 3, 'sound/cutoff': 900, gravity: 1 });
  assert.deepEqual(a.calls.at(-1), 'set decay=3');
  sound.dispose();
});

test('Sound: params follow the instrument (own knobs shown only while it plays, its defaults applied)', async () => {
  const signals = new Signals(), params = new Params();
  const sound = new Sound({ signals, params, engine: toneEngine({ cdn: FAKE_TONE }), instrument: 'test/a', remember: false });
  assert.deepEqual(params.schema.map((p) => p.key), ['sound/cutoff', 'sound/space', 'sound/volume', 'sound/decay']);
  assert.ok(params.schema.every((p) => p.group === 'sound'));
  assert.equal(params.get('sound/cutoff').def, 8000);
  const pulses = [];
  signals.on('sound/instrument', (v) => pulses.push(v.id));
  await sound.enable();
  await sound.setInstrument('test/b');
  assert.equal(params.get('sound/decay').hidden, true, 'test/b has no decay knob');
  assert.equal(params.get('sound/cutoff').def, 2500, 'back to the shared default');
  await sound.setInstrument('test/c');
  assert.equal(params.get('sound/rotor').hidden, false, 'a knob registered on the fly');
  assert.equal(params.get('sound/decay').hidden, true);
  assert.equal(params.get('sound/cutoff').def, 7000);
  assert.deepEqual(pulses, ['test/a', 'test/b', 'test/c'], 'one sound/instrument pulse when enable brings the first one up, then one per switch');
  assert.equal(sound.instrument, 'test/c');
  sound.dispose();
});

test('Sound: the picker\'s last choice is remembered per page and wins over the declared one', async () => {
  store.clear();
  const mk = (o = {}) => new Sound({ signals: new Signals(), params: new Params(), engine: toneEngine({ cdn: FAKE_TONE }), ...o });
  const s1 = mk({ instrument: 'test/a' });
  await s1.setInstrument('test/b');                 // from code: not remembered
  assert.equal(store.size, 0);
  await s1.setInstrument('test/b', { remember: true });
  assert.equal(store.get('openav:sound:/'), 'test/b');
  assert.equal(mk({ instrument: 'test/a' }).instrument, 'test/b', 'recalled choice wins');
  assert.equal(mk({ instrument: 'test/a', remember: false }).instrument, 'test/a');
  store.set('openav:sound:/', 'gone-instrument');
  assert.equal(mk({ instrument: 'test/a' }).instrument, 'test/a', 'a stale stored id is ignored');
  assert.equal(mk({ remember: 'my-key', instrument: 'test/a' })._key, 'my-key');
});

test('Sound: engines without instruments work as before (drumEngine)', async () => {
  const params = new Params();
  const sound = new Sound({ signals: new Signals(), params, engine: drumEngine() });
  assert.equal(sound.choosable, false);
  assert.equal(sound.instrument, null);
  assert.equal(await sound.setInstrument('piano'), false);
  assert.deepEqual(params.schema.map((p) => p.key), ['sound/kitVolume']);
  assert.equal(sound.status.state, 'idle');
});
