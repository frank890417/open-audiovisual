// @openav/audio reference: the analysis under the microphone. Read by tools/build-reference.mjs (see AGENTS.md, "Documenting a public name").
// The keys are the public names the code has (tools/reference/scan.mjs reads them); a key the code does not have is a red test.

export default {
  AudioAnalyzer: {
    group: 'mic',
    summary: {
      en: 'Listens to the microphone, an audio element or any Web Audio node, and turns it into loudness, three bands, onsets and kick, snare and hat hits.',
      zh: '聽麥克風、audio 元素或任何 Web Audio 節點，把它變成音量、三個頻段、起音，以及大鼓、小鼓、鈸的打點。',
    },
    params: [
      { name: 'signals', type: 'Signals', optional: true, default: 'null', en: 'A [`Signals`](#Signals) bus to publish into. With one, the `audio/*` signals are defined when you construct the analyzer and set on every `update()`. Without one, `update()` only returns the numbers.', zh: '要發布訊號的 [`Signals`](#Signals) 匯流排。有給的話，建構分析器時就會定義 `audio/*` 訊號，每次 `update()` 都會更新它們。沒給的話，`update()` 只回傳數字。' },
      { name: 'fftSize', type: 'Number', optional: true, default: '2048', en: 'The size of the analyser\'s FFT, a power of two from 32 to 32768. The spectrum has half as many bins.', zh: '分析器 FFT 的大小，32 到 32768 之間的 2 的次方。頻譜的格數是它的一半。' },
      { name: 'smooth', type: 'Number', optional: true, default: '0.7', en: 'How much of the previous `rms` is kept each update, 0..1. Higher is smoother and slower: `rms = rms × smooth + now × (1 − smooth)`.', zh: '每次更新要留下多少上一次的 `rms`，0..1。越高越平滑也越慢：`rms = rms × smooth + 現在的值 × (1 − smooth)`。' },
    ],
    description: [
      {
        en: "An `AudioAnalyzer` wraps one Web Audio `AnalyserNode`. You give it a sound (`enableMic()`, `enableElement(el)`, or connect your own node into `input()`), call `update()` once per frame, and it returns a plain object of numbers, which it also publishes as `audio/*` signals if you gave it a `signals` bus. This is the analysis under the microphone of a p5 sketch: [`micLevel`](#micLevel) is its `rms` turned into decibels, [`bass`](#bass), `mid` and `treble` are its `low`, `mid` and `high`, and [`beat`](#beat) and [`kickDetected()`](#kickDetected) come from its `onset` and `kick`.",
        zh: "`AudioAnalyzer` 包著一個 Web Audio 的 `AnalyserNode`。你給它一個聲音來源（`enableMic()`、`enableElement(el)`，或把自己的節點接到 `input()`），每個畫面呼叫一次 `update()`，它就回傳一個只有數字的物件，如果你給了 `signals` 匯流排，也會同時發布成 `audio/*` 訊號。這就是 p5 草圖的麥克風底下的分析：[`micLevel`](#micLevel) 是它的 `rms` 換成分貝，[`bass`](#bass)、`mid`、`treble` 是它的 `low`、`mid`、`high`，[`beat`](#beat) 和 [`kickDetected()`](#kickDetected) 來自它的 `onset` 和 `kick`。",
      },
      {
        en: "`update()` returns `null` until a source is enabled. After that it returns `{ rms, peak, low, mid, high, centroid, onset, kick, snare, hat }`. `rms` is the smoothed loudness and `peak` the loudest sample of the moment, both 0..1 of full scale (from float samples where the browser has them, so a quiet room is measured, not rounded to one 8-bit step). A voice is a small `rms`: scale it, or map it through a window. `low`, `mid` and `high` are the average strength of the spectrum in 20–250 Hz, 250–2000 Hz and 2000–8000 Hz, 0..1, taken from the analyser's byte spectrum, so they are not decibels and a faint band stays near 0. `centroid` is the spectrum's centre of mass, 0..1 of the way from 0 Hz to half the sample rate (the brightness). `onset` is true for the one `update()` in which the loudness jumped over its adaptive floor, with at least 100 ms between two onsets.",
        zh: "來源開起來之前，`update()` 回傳 `null`。開起來之後，它回傳 `{ rms, peak, low, mid, high, centroid, onset, kick, snare, hat }`。`rms` 是平滑後的音量，`peak` 是這一刻最大的取樣，兩個都是滿刻度的 0..1（瀏覽器有浮點取樣的話就用浮點，所以安靜的房間也量得到，不會被四捨五入到 8 位元的一格）。人聲的 `rms` 很小，要乘上倍數，或用範圍視窗對應。`low`、`mid`、`high` 是頻譜在 20–250 Hz、250–2000 Hz、2000–8000 Hz 的平均強度，0..1，取自分析器的位元組頻譜，所以不是分貝，微弱的頻段會貼近 0。`centroid` 是頻譜的重心，從 0 Hz 到取樣率的一半，0..1（亮度）。`onset` 只在音量跳過它自己適應的底線的那一次 `update()` 是 true，兩個起音之間至少隔 100 毫秒。",
      },
      {
        en: "`kick`, `snare` and `hat` are `{ hit, level, env }`, found by looking for a sudden rise in one band of the spectrum, with no machine learning: kick 20–120 Hz, snare 150–800 Hz, hat 6000–14000 Hz. `hit` is true on the update that found one (at least 90, 90 and 60 ms apart), `level` is the band's strength now, and `env` is 0..1: it jumps to `min(1, level × 2)` on a hit and then shrinks by 12% every `update()`, about 120 ms at 60 frames a second. Because it decays per update, it falls faster if you call `update()` less often.",
        zh: "`kick`、`snare`、`hat` 是 `{ hit, level, env }`，做法是在頻譜的某一段找突然的上升，沒有用機器學習：大鼓 20–120 Hz、小鼓 150–800 Hz、鈸 6000–14000 Hz。`hit` 在找到一下的那次 `update()` 是 true（互相至少隔 90、90、60 毫秒），`level` 是那一段現在的強度，`env` 是 0..1：打到的時候跳到 `min(1, level × 2)`，之後每次 `update()` 縮小 12%，每秒 60 個畫面的話大約 120 毫秒。因為它是每次 `update()` 衰減，所以你呼叫 `update()` 的頻率越低，它掉得越快。",
      },
      {
        en: "With a `signals` bus, these are published: `audio/rms`, `audio/peak`, `audio/band/low`, `audio/band/mid`, `audio/band/high`, `audio/centroid`, `audio/kick/env`, `audio/snare/env` and `audio/hat/env` (continuous, 0..1), and the pulses `audio/onset` `{ rms }`, `audio/kick` `{ level }`, `audio/snare` `{ level }` and `audio/hat` `{ level }`. Pulses fire only when something was found.",
        zh: "有 `signals` 匯流排的話，會發布這些：`audio/rms`、`audio/peak`、`audio/band/low`、`audio/band/mid`、`audio/band/high`、`audio/centroid`、`audio/kick/env`、`audio/snare/env`、`audio/hat/env`（連續值，0..1），以及脈衝 `audio/onset` `{ rms }`、`audio/kick` `{ level }`、`audio/snare` `{ level }`、`audio/hat` `{ level }`。脈衝只在找到東西的時候才觸發。",
      },
    ],
    needs: {
      en: "Browsers start audio only after a user gesture. `enableMic()` asks for the microphone, and the analyser's `AudioContext` stays suspended until the page has had a click or a key: `update()` calls `resume()` on every frame, so the numbers start by themselves after the first click. Until then they are all 0. The page needs `https` or `localhost` for the microphone.",
      zh: "瀏覽器要使用者做過一個動作之後才讓聲音開始。`enableMic()` 會去要麥克風，而分析器的 `AudioContext` 在頁面被點一下或按過鍵之前都是暫停的：`update()` 每個畫面都會呼叫 `resume()`，所以第一次點擊之後數字會自己開始動。在那之前全部都是 0。麥克風要求網頁在 `https` 或 `localhost` 底下。",
    },
    notes: [
      {
        en: "It makes its own `AudioContext`, so p5.sound or Tone.js can run beside it. To analyse a sound that lives in another context, connect a node of `audio.ctx` into `input()`, or use `enableElement()`.",
        zh: "它自己建一個 `AudioContext`，所以 p5.sound 或 Tone.js 可以在旁邊照常跑。要分析在別的 context 裡的聲音，就把 `audio.ctx` 的節點接到 `input()`，或用 `enableElement()`。",
      },
      {
        en: "`enableMic()` turns off echo cancellation, noise suppression and automatic gain, because they change the loudness you want to measure. On a laptop that plays the sound it listens to, expect the speakers to leak into the microphone.",
        zh: "`enableMic()` 會關掉回音消除、噪音抑制和自動增益，因為它們會改變你想量的音量。筆電如果一邊播放一邊聽，喇叭的聲音會漏進麥克風。",
      },
    ],
    tbd: [
      {
        en: "Typical `rms` values for speech differ between the notes of this project: the handbook (docs/inputs.md) says speech often sits around 0.05 to 0.2, a comment in oav-p5 says 0.01 to 0.05. They depend on the microphone and the room, and have not been measured here, so no typical number is given.",
        zh: "這個專案的各處對說話的 `rms` 典型值說法不一：手冊（docs/inputs.md）說說話常在 0.05 到 0.2 附近，oav-p5 裡的註解說是 0.01 到 0.05。它要看麥克風和房間，這裡沒有實際量過，所以不給典型數字。",
      },
    ],
    members: {
      enableMic: {
        en: 'Asks the browser for the microphone, with echo cancellation, noise suppression and auto gain off, and connects it. Returns a promise that resolves to `true`. It rejects when the permission is refused or there is no microphone, with the browser\'s error (`NotAllowedError`, `NotFoundError`…).',
        zh: '向瀏覽器要麥克風（回音消除、噪音抑制、自動增益都關掉）並接起來。回傳一個 promise，成功時 resolve 成 `true`。權限被拒或沒有麥克風的時候會 reject，錯誤是瀏覽器給的（`NotAllowedError`、`NotFoundError`…）。',
      },
      enableElement: {
        en: 'Analyses an `<audio>` or `<video>` element: `enableElement(el)` returns `true`. The element keeps playing to the speakers. Web Audio takes an element in only once, so a second `enableElement()` for the same element throws a browser error.',
        zh: '分析一個 `<audio>` 或 `<video>` 元素：`enableElement(el)` 回傳 `true`。元素照常從喇叭播出來。Web Audio 對同一個元素只收一次，所以對同一個元素第二次呼叫 `enableElement()`，瀏覽器會丟出錯誤。',
      },
      input: {
        en: 'Returns the `AnalyserNode` (creating the context first), so you can bring your own sound: `node.connect(audio.input())`. Any node of `audio.ctx` works; for Tone.js, connect its raw node. Nothing is routed to the speakers by this.',
        zh: '回傳 `AnalyserNode`（必要時先建好 context），讓你接自己的聲音：`node.connect(audio.input())`。`audio.ctx` 裡的任何節點都行。Tone.js 的話接它的原生節點。這樣接不會把聲音送到喇叭。',
      },
      update: {
        en: 'Call it once per frame. Reads the analyser, works out the numbers, publishes the signals if there is a bus, and returns the object `{ rms, peak, low, mid, high, centroid, onset, kick, snare, hat }`, or `null` when no source is enabled yet. It also resumes a suspended context.',
        zh: '每個畫面呼叫一次。讀分析器、算出數字，有匯流排的話就發布訊號，並回傳 `{ rms, peak, low, mid, high, centroid, onset, kick, snare, hat }` 這個物件，還沒開任何來源的話回傳 `null`。它也會把暫停的 context 叫醒。',
      },
    },
    examples: [
      {
        code: `import { AudioAnalyzer } from '@openav/audio';

const audio = new AudioAnalyzer();
await audio.enableMic();                      // the browser asks for the microphone
const g = document.getElementById('c').getContext('2d');

(function frame() {
  const f = audio.update();                   // { rms, peak, low, mid, high, ... }
  g.fillStyle = '#111'; g.fillRect(0, 0, 400, 300);
  g.fillStyle = '#ffd166';
  g.fillRect(20, 130, Math.min(1, f.rms * 6) * 360, 40);   // a voice is a small rms: scale it
  requestAnimationFrame(frame);
})();`,
        caption: { en: 'Allow the microphone, click the page once, and talk: a bar grows with the loudness.', zh: '允許麥克風、在頁面上點一下，然後說話：一條橫條跟著音量變長。' },
        needs: 'mic',
      },
      {
        code: `import { AudioAnalyzer } from '@openav/audio';

const audio = new AudioAnalyzer();             // no signals bus: update() just returns the numbers
const input = audio.input();                    // makes the AudioContext (audio.ctx) and the AnalyserNode
const osc = new OscillatorNode(audio.ctx, { frequency: 100 });
osc.connect(input);                             // any node of audio.ctx can feed the analyser
osc.start();

let frames = 0;
(function frame() {
  const f = audio.update();                     // also resumes the context once the page has had a click
  if (++frames < 40) return requestAnimationFrame(frame);
  console.log(audio.ctx.state, f.low > f.high);  // running true: a 100 Hz tone sits in the low band
  console.log(f.rms > 0.1, f.centroid < 0.1);    // true true
})();`,
        caption: { en: 'No microphone needed: a 100 Hz tone is fed into the analyser through `input()`. After 40 frames the log says the low band is louder than the high one.', zh: '不需要麥克風：一個 100 Hz 的音從 `input()` 送進分析器。40 個畫面之後，log 會告訴你低頻段比高頻段大。' },
      },
      {
        code: `import { AudioAnalyzer } from '@openav/audio';
import { Signals } from '@openav/core';

const signals = new Signals();
const audio = new AudioAnalyzer({ signals });         // defines the audio/* signals at once
console.log(signals.list().length);                    // 13
signals.on('audio/onset', ({ rms }) => console.log('onset', rms.toFixed(2)));
signals.on('audio/kick', ({ level }) => console.log('kick', level.toFixed(2)));
console.log(signals.get('audio/rms'));                 // 0, nothing heard yet
console.log(audio.update());                           // null until a source is enabled`,
        caption: { en: 'With a signals bus the analyzer defines thirteen `audio/*` signals up front. Listen to a pulse with `signals.on`; the handlers run once a source is enabled and a hit is found.', zh: '有匯流排的話，分析器一開始就定義好十三個 `audio/*` 訊號。用 `signals.on` 聽脈衝。來源開起來、找到打點的時候，處理函式就會被呼叫。' },
      },
    ],
    related: ['micLevel', 'bass', 'beat', 'kickDetected', 'micSensitivity', 'Signals'],
    keywords: {
      en: ['audio', 'microphone', 'analysis', 'fft', 'loudness', 'rms', 'bands', 'onset', 'snare', 'hat'],
      zh: ['音訊', '麥克風', '分析', '頻譜', '音量', '低中高音', '起音', '大鼓', '小鼓', '鈸'],
    },
  },
};
