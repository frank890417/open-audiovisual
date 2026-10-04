# @openav/sound

L4 output (audio branch) · instruments in the page, behind a small engine contract.
`Sound` plays every `midi/note/on|off` through the engine, whatever sent it, and
adds the engine's params to the show as `sound/*`, so the timeline, a knob or a
hand can play the filter the way they play the visuals.

```js
// in a show: the console's L4 panel gets 🔊 enable sound and an instrument picker
const show = await createShow({ world, modules: { sound: true } });       // the warm pad, as always
await createShow({ world, modules: { sound: 'piano' } });                 // start on the grand piano
await createShow({ world, modules: { sound: { instrument: 'organ', remember: false, picker: false } } });
```

```js
import { Sound, toneEngine } from '@openav/sound';
const sound = new Sound({ signals, params, engine: toneEngine({ instrument: 'strings' }) });
button.onclick = () => sound.enable();      // browsers start audio only from a gesture
// every frame, with the resolved state:
sound.update(state);
```

## Instruments

Tone.js 15 (loaded from jsDelivr on `enable()`) plays them. Each is one small file in
[`instruments/`](instruments/).

| id | name | how it is made |
|---|---|---|
| `piano` | Grand piano (Salamander) | `Tone.Sampler` over 30 mp3 samples (A, C, D♯, F♯ of every octave, A0–C8), 2.0 MB, loaded when picked, with progress. If the files cannot load it plays `epiano` instead. **Credit: Salamander Grand Piano · Alexander Holm · [CC-BY 3.0](https://creativecommons.org/licenses/by/3.0/)** |
| `epiano` | Electric piano | two FM pairs (1:1 body, 14:1 tine) and a stereo tremolo, the DX7 recipe |
| `xylophone` | Xylophone | modal synthesis: partials at 1×, 3×, 6.1×, short decay, a hard mallet click; sounds an octave up |
| `marimba` | Marimba | partials at 1×, 3.93×, 9.2×, longer bloom, soft mallet |
| `vibraphone` | Vibraphone | partials at 1×, 4×, 10×, motor tremolo, key-up damps (hold CC 64 to let it ring) |
| `glockenspiel` | Glockenspiel 鐵琴 | steel-bar partials at 1×, 2.76×, 5.40×, 8.93×, long ring; sounds two octaves up |
| `music-box` | Music box | tine partials at 1×, 6.27×, 17.55× and a detuned twin for shimmer; two octaves up |
| `strings` | String ensemble | three detuned saws per note, bowed attack, body filter, ensemble chorus, vibrato |
| `harp` | Harp (plucked string) | Karplus–Strong (`Tone.PluckSynth`), twelve strings that ring free |
| `organ` | Drawbar organ | the nine drawbars as one additive waveform on the 16′ fundamental, percussion click, rotary tremolo |
| `choir` | Choir pad (aah) | saws through three formant band-passes; `vowel` slides oo → ee |
| `synth/pad` | Warm pad | the framework's original voice, unchanged, and still the default |
| `synth/saw-lead` · `synth/square-lead` · `synth/pluck` · `synth/supersaw` · `synth/bass` · `synth/acid` · `synth/brass` · `synth/bell` · `synth/sub` · `synth/chip` | synth presets | one `Tone.PolySynth`, presets as data ([`instruments/synth.js`](instruments/synth.js)) |

The Salamander samples are in [`samples/salamander/`](samples/salamander/) (byte-identical to
the Tone.js mirror, [ATTRIBUTION.txt](samples/salamander/ATTRIBUTION.txt) beside them). The
picker shows the credit next to the piano; a show that plays it in public credits it too.

## Params

Shared by every instrument, after it on the output chain (filter → reverb → volume → limiter):
`sound/cutoff` (100–8000 Hz), `sound/space` (reverb wet, 0–1), `sound/volume` (−36–0 dB).
An instrument may suggest their starting values (`defaults: { cutoff: 8000 }`: a piano wants the
filter open) and may add its own, which the console shows only while it plays:

| instrument | own params |
|---|---|
| `organ` | `drawbars` (0 warm 888000000 → 1 full), `rotor` (0 slow → 1 fast, glides like a real rotor) |
| `strings` | `attack` (s), `vibrato` |
| `choir` | `vowel` (oo → ee), `attack` (s) |
| `epiano`, `vibraphone` | `tremolo` (depth) |

Automation and overrides always win over a suggested default. The sustain pedal (`midi/cc/64`)
holds note-offs for every instrument. Notes on MIDI channel 10 (the drum machine, GM drums) are
left to a drum engine: `toneEngine({ drumChannel: null })` plays them too.

## Choosing a sound

- **Console**: the *L4 · Output — sound* panel has a picker under the enable button, one group per
  category. Picking also turns sound on. Switching while you play releases held notes on the old
  instrument; a sampler keeps the old sound playing until its files are in.
- **Code**: `await show.sound.setInstrument('piano')` (true once it plays), `show.sound.instrument`,
  `show.sound.status` (`{ id, state: 'idle'|'loading'|'ready'|'error', progress }`),
  `show.sound.onChange(cb)`, and the pulse signal `sound/instrument` `{ id, name }`.
- **Remembered**: the picker's last choice is stored per page (localStorage) and wins over the
  declared instrument on the next visit. `remember: false` turns that off; code calls are not
  remembered unless you pass `setInstrument(id, { remember: true })`.
- **Your own page**: `mountSoundPicker(el, sound, { lang: 'zh', className })` is the same picker.

Rule #1 still holds: the instrument is a discrete choice (a scene cue may switch it); everything
you perform continuously stays a param.

```js
show.timeline.onSceneChange((i, scene) => {
  if (scene.id === 'chorale') show.sound.setInstrument('organ');
});
```

## Add your own instrument (one file)

```js
import { registerInstrument } from '@openav/sound';

registerInstrument({
  id: 'kalimba',
  name: { en: 'Kalimba', zh: '拇指琴' },
  category: 'mallets',
  params: [{ key: 'decay', label: 'Decay (s)', min: 0.2, max: 4, def: 1.2 }],   // → sound/decay
  create(Tone, { output }) {
    const synth = new Tone.PolySynth(Tone.FMSynth, { harmonicity: 5.1, modulationIndex: 2,
      envelope: { attack: 0.001, decay: 1.2, sustain: 0, release: 1 } }).connect(output);
    const hz = (n) => 440 * 2 ** ((n - 69) / 12);
    return {
      noteOn: (note, vel, time) => synth.triggerAttack(hz(note), time, vel),
      noteOff: (note, time) => synth.triggerRelease(hz(note), time),
      set: (key, v) => key === 'decay' && synth.set({ envelope: { decay: v } }),
      dispose: () => synth.dispose(),
    };
  },
});
```

Import that file before `createShow()` and every picker lists *Kalimba* under Mallets. Nothing in
`packages/*` changes. The definition:

| field | |
|---|---|
| `id` | lowercase, digits, `-`, at most one `/` (`'kalimba'`, `'me/kalimba'`); a duplicate throws unless `registerInstrument(def, { replace: true })` |
| `name` | a string or `{ en, zh }` |
| `category` | `keys` · `mallets` · `strings` · `plucked` · `organ` · `voice` · `synth` · `drums` · `other` (or your own) |
| `create(Tone, ctx)` | called on enable or on switch. `ctx` = `{ output, baseUrl, options, onProgress, rawContext, rawOutput }`: connect Tone nodes to `output` (raw WebAudio nodes to `rawOutput`), `baseUrl` is where sample folders live, `options` is `toneEngine({ instruments: { kalimba: {…} } })`. Returns `{ noteOn(note, vel01, time), noteOff(note, time), set?(key, v), releaseAll?(time), ready?: Promise, dispose() }` |
| `params` | your own knobs `[{ key, label, min, max, def }]`, shown as `sound/<key>` while the instrument plays |
| `defaults` | starting values for `cutoff`, `space`, `volume` |
| `credit` | a string or `{ text, url }`, shown in the picker |
| `gain` · `transpose` · `tail` · `fallback` | level in dB · semitones · seconds the old one may ring after a switch · an id to play if `ready` rejects |

`ready` (a Promise) makes the picker show progress: call `ctx.onProgress(0..1)` while you load.
Mallet-like sounds are only data with `modalInstrument({ id, name, partials: [{ ratio, gain, decay }], strike })`
([`instruments/xylophone.js`](instruments/xylophone.js) is 15 lines).

## Add a synth preset

```js
import { registerSynthPreset } from '@openav/sound';

registerSynthPreset({
  id: 'glass', name: { en: 'Glass', zh: '玻璃' },
  voice: 'fm', harmonicity: 3.01, modulationIndex: 14,
  envelope: { attack: 0.002, decay: 1.4, sustain: 0, release: 1.2 },
  effects: [{ type: 'chorus', frequency: 1.5, depth: 0.4, wet: 0.3 }],
});                                                      // → picker: Synth → Glass ('synth/glass')
```

`voice`: `synth` · `mono` (adds a resonant filter with its own envelope) · `fm` · `am`. The rest is
Tone's own vocabulary (`oscillator`, `envelope`, `filter`, `filterEnvelope`, `harmonicity`,
`modulationIndex`, …) plus `octave`, `gain` (dB), `polyphony`, `defaults` and `effects`
(`chorus` · `delay` · `pingpong` · `distortion` · `vibrato` · `tremolo` · `phaser` · `autofilter` ·
`filter` · `eq` · `compressor` · `chebyshev` · `widener`).

## Exports

| export | signature |
|---|---|
| `Sound` | `new Sound({ signals, params = null, engine, instrument, remember = true, picker = true })` · `enable()` → Promise<true> · `update(state)` · `setInstrument(id, { remember })` · `instrument` · `status` · `choosable` · `onChange(cb)` · `dispose()` · `enabled`, `engine` |
| `toneEngine` | `toneEngine({ instrument = 'synth/pad', baseUrl, instruments = {}, cdn, drumChannel = 10 })` → the engine; Tone.js is loaded on `enable()` |
| `registerInstrument` · `unregisterInstrument` · `getInstrument` · `listInstruments({ category })` · `instrumentGroups(lang)` · `instrumentName(def, lang)` · `onInstrumentsChange(cb)` · `validateInstrument(def)` | the registry |
| `registerSynthPreset` · `synthInstrument` · `SYNTH_PRESETS` · `validateSynthPreset` | the synth module |
| `modalInstrument` | partial data → a mallet-style instrument |
| `mountSoundPicker(el, sound, { lang, className, label, enableOnPick = true })` | the picker → `{ el, select, refresh(), dispose() }` |
| `soundOptions(value)` | how `createShow()` reads `modules.sound` |
| `salamanderMap()` · `SALAMANDER_NOTES` · `SAMPLES_URL` · `TONE_CDN` · `DEFAULT_INSTRUMENT` · `SOUND_PARAMS` · `CATEGORIES` · `BUILTIN_INSTRUMENTS` | data |

`baseUrl` defaults to `https://openaudiovisual.com/packages/sound/samples/` (CORS-enabled);
`createShow()` uses the copy next to the page instead.

Engine contract: `{ params, enable(), noteOn(note, vel01), noteOff(note), set(key, value), dispose() }`,
optionally `setInstrument`, `instrument`, `status`, `subscribe`, `sustain(down)`, `skipChannels`.
`drumEngine()` from `@openav/drums` is another engine.

In `createShow()`, routes are added before the engine's params exist, so a declared
route to `sound/cutoff` needs explicit `outMin` / `outMax`.

Full reference: [docs](https://openaudiovisual.com/docs/#show-control-sound)
