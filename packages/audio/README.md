# @openav/audio

L1 input · realtime analysis of the microphone, an `<audio>`/`<video>` element or
any Web Audio node: loudness, three bands, brightness, onsets, and kick / snare /
hat detection with decay envelopes, published as `audio/*` signals.

```js
// in a show: the console's L1 panel gets a 🎤 mic button that calls enableMic()
const show = await createShow({ world, modules: { audio: true },
  routes: [{ source: 'audio/kick/env', target: 'pump' }] });
```

```js
import { AudioAnalyzer } from '@openav/audio';
const audio = new AudioAnalyzer({ signals });
button.onclick = () => audio.enableMic();    // browsers need a user gesture
// every frame:
const f = audio.update();                    // null until a source is enabled
```

## Exports

`AudioAnalyzer`
- `new AudioAnalyzer({ signals = null, fftSize = 2048, smooth = 0.7 })` · `smooth` = RMS smoothing 0..1
- `enableMic()` → Promise<true> (echo cancellation, noise suppression and AGC off)
- `enableElement(mediaEl)` → true · the element keeps playing to the speakers
- `input()` → the `AnalyserNode`: `node.connect(audio.input())` for Tone.js or your own graph
- `update()` once per frame → `{ rms, peak, low, mid, high, centroid, onset, kick, snare, hat }`,
  where `kick` / `snare` / `hat` are `{ hit, level, env }`

Signals: `audio/rms`, `audio/peak`, `audio/band/low`, `audio/band/mid`, `audio/band/high`,
`audio/centroid`, `audio/onset` (pulse `{rms}`), `audio/kick`, `audio/snare`, `audio/hat`
(pulse `{level}`), `audio/kick/env`, `audio/snare/env`, `audio/hat/env` (0..1) ·
[Signals reference](https://openaudiovisual.com/docs/#signals-openav-audio).

Full reference: [docs](https://openaudiovisual.com/docs/#packages-openav-audio)
