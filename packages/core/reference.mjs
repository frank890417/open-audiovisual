// @openav/core reference: the shared vocabulary. Read by tools/build-reference.mjs (see AGENTS.md, "Documenting a public name").
// The keys are the public names the code has (tools/reference/scan.mjs reads them); a key the code does not have is a red test.
// Module examples use the import map the page gives them (`@openav/core` and friends) and print to the console or into #app.

export default {
  Signals: {
    group: 'core',
    summary: {
      en: 'The registry every input writes into and everything else reads from: named values that are either a level (continuous) or an event (pulse).',
      zh: '所有輸入都寫進去、其他東西都從這裡讀的登錄表：一個個有名字的值，不是持續的數值（continuous），就是一次性的事件（pulse）。',
    },
    description: [
      {
        en: '`new Signals()` makes an empty registry. In a show you rarely build it yourself: [`createShow()`](#createShow) creates one and returns it as `show.signals`. A signal is a name plus a value. Input packages publish with `set()` and `pulse()`; everything else reads with `get()` and `norm()`, or subscribes with `on()` and `onAny()`.',
        zh: '`new Signals()` 會做出一個空的登錄表。做演出的時候通常不用自己建：[`createShow()`](#createShow) 會建好一個，用 `show.signals` 回傳給你。一個訊號就是一個名字加一個值。輸入套件用 `set()` 和 `pulse()` 發布。其他東西用 `get()` 和 `norm()` 讀，或用 `on()` 和 `onAny()` 訂閱。',
      },
      {
        en: 'There are two kinds. A **continuous** signal (the default) always holds a current value, usually between 0 and 1: a knob, the loudness of the room, the height of a wrist. A **pulse** signal (`kind: \'pulse\'`) is an event: its value is the payload of the last firing and it is `null` until the first one: a key struck, a kick heard, a pinch started. Read a level whenever you like; subscribe to an event with `on()`.',
        zh: '訊號分兩種。**連續**（continuous，預設）的訊號隨時都有一個目前的值，通常在 0 到 1 之間：旋鈕的位置、房間的音量、手腕的高度。**脈衝**（pulse，寫成 `kind: \'pulse\'`）是事件：它的值是最近一次觸發帶的內容，在第一次觸發之前是 `null`：按下一個鍵、聽到一下大鼓、開始一次捏合。水準值想讀就讀。事件用 `on()` 訂閱。',
      },
      {
        en: 'Names are paths with the source first: `midi/cc/74`, `audio/rms`, `pose/hand/right/y`, `breath/pressure`. Declare a signal with its range before you publish it: `signals.define(\'breath/pressure\', { min: 0, max: 1 })`. `set()` on a name nobody declared defines it on the spot as a continuous signal from 0 to 1, so declare first whenever your numbers are in degrees, MIDI notes or any other range.',
        zh: '名字是「來源在前」的路徑：`midi/cc/74`、`audio/rms`、`pose/hand/right/y`、`breath/pressure`。發布之前先用範圍宣告它：`signals.define(\'breath/pressure\', { min: 0, max: 1 })`。對一個沒人宣告過的名字呼叫 `set()`，會當場把它宣告成 0 到 1 的連續訊號，所以你的數字如果是角度、MIDI 音符號碼或別的範圍，請先宣告。',
      },
      {
        en: 'A knob, a raised hand and a chord are equal citizens here. Whoever reads a signal (the [`Mapper`](#Mapper), a world that listens for events, the monitor) does not know and does not care what produced it.',
        zh: '旋鈕、舉起的手、一個和弦，在這裡地位相同。讀訊號的一方（[`Mapper`](#Mapper)、聽事件的世界、後台監看）不知道也不在乎是什麼產生它。',
      },
    ],
    members: {
      define: {
        en: 'Declare a signal and its range: `define(name, { kind, min, max, unit, description, source })`. Safe to call again: later declarations merge into earlier ones. A continuous signal starts at `min`, a pulse at `null`. Returns the registry.',
        zh: '宣告一個訊號和它的範圍：`define(name, { kind, min, max, unit, description, source })`。可以重複呼叫：後面的宣告會合併進前面的。連續訊號一開始是 `min`，脈衝一開始是 `null`。回傳這個登錄表本身。',
      },
      set: {
        en: 'Publish a value: `set(name, value)`. Subscribers run every time, even when the value did not change. An undeclared name is defined on the spot as continuous 0..1.',
        zh: '發布一個值：`set(name, value)`。每次呼叫訂閱者都會執行，就算值沒變。沒宣告過的名字會當場宣告成 0..1 的連續訊號。',
      },
      pulse: {
        en: 'Fire an event: `pulse(name, payload = 1)`. It is `set()` under another name; declare the signal with `kind: \'pulse\'` first, or it is registered as continuous.',
        zh: '觸發一個事件：`pulse(name, payload = 1)`。它就是換個名字的 `set()`。請先用 `kind: \'pulse\'` 宣告，否則它會被登記成連續訊號。',
      },
      get: {
        en: 'The last value of a signal, or `undefined` for a name that was never declared or set. A pulse that has not fired yet is `null`.',
        zh: '訊號最近的值，沒宣告也沒設定過的名字是 `undefined`。還沒觸發過的脈衝是 `null`。',
      },
      norm: {
        en: 'The value as 0..1 inside the declared `min` and `max`, clamped. An unknown name, or a signal whose `min` equals its `max`, gives 0.',
        zh: '把值換算成宣告的 `min` 到 `max` 之間的 0..1，超出範圍會被夾住。不認識的名字，或 `min` 等於 `max` 的訊號，回傳 0。',
      },
      on: {
        en: 'Subscribe to one signal: `on(name, cb)`, where `cb(value, name)` runs on every `set()` or `pulse()`. Returns a function that unsubscribes.',
        zh: '訂閱單一訊號：`on(name, cb)`，每次 `set()` 或 `pulse()` 都會呼叫 `cb(value, name)`。回傳一個取消訂閱的函式。',
      },
      onAny: {
        en: 'Subscribe to every signal: `cb(name, value, meta)` runs for each one. The mapper\'s learn mode and the monitor use it. Returns a function that unsubscribes.',
        zh: '訂閱所有訊號：每一個訊號都會呼叫 `cb(name, value, meta)`。映射的 learn 模式和後台監看都靠它。回傳一個取消訂閱的函式。',
      },
      list: {
        en: 'Every signal as `[{ name, value, at, kind, min, max, unit, description, source }]`; `at` is the time of the last `set()` (`performance.now()`, 0 if never). What the monitor and meters read.',
        zh: '所有訊號組成的陣列 `[{ name, value, at, kind, min, max, unit, description, source }]`。`at` 是最近一次 `set()` 的時間（`performance.now()`，從沒設定過就是 0）。監看和音量表讀的就是這個。',
      },
    },
    notes: [
      {
        en: '`signals.meta` is a `Map` of name → declaration and `signals.values` a `Map` of name → last value. Read them if you must; write through `define()` and `set()` so subscribers hear about it.',
        zh: '`signals.meta` 是「名字 → 宣告」的 `Map`，`signals.values` 是「名字 → 最近的值」的 `Map`。需要的話可以讀，要寫請透過 `define()` 和 `set()`，訂閱者才聽得到。',
      },
      {
        en: 'A subscriber that throws is caught and logged as `[signals] <name>`; the other subscribers still run and `set()` does not throw.',
        zh: '訂閱者丟出錯誤會被接住、記成 `[signals] <名字>`，其他訂閱者照常執行，`set()` 也不會丟錯。',
      },
      {
        en: 'The names every built-in package publishes are listed in [the signals reference](https://openaudiovisual.com/docs/#signals).',
        zh: '每個內建套件發布的訊號名稱，都列在[訊號參考](https://openaudiovisual.com/zh/docs/#signals)。',
      },
    ],
    examples: [
      {
        code: `import { Signals } from '@openav/core';

const signals = new Signals();
signals.define('breath/pressure', { min: 0, max: 1 });
signals.on('breath/pressure', (v) => console.log('pressure', v));
signals.set('breath/pressure', 0.4);   // logs: pressure 0.4`,
        caption: { en: 'Open the console: it prints `pressure 0.4`, because the subscriber ran as soon as the value was set.', zh: '打開主控台：會印出 `pressure 0.4`，因為值一設定，訂閱者就跟著執行。' },
      },
      {
        code: `import { Signals } from '@openav/core';

const signals = new Signals();
signals.define('temp/room', { min: 10, max: 30, unit: '°C' });
signals.set('temp/room', 25);
console.log(signals.get('temp/room'), signals.norm('temp/room'));   // 25 0.75

signals.define('breath/sigh', { kind: 'pulse' });
signals.on('breath/sigh', (payload) => console.log('sigh', payload));
signals.pulse('breath/sigh', { depth: 0.8 });                       // sigh { depth: 0.8 }`,
        caption: { en: 'A level and an event side by side: the console shows `25 0.75`, then `sigh { depth: 0.8 }`.', zh: '一個水準值和一個事件並排：主控台先印出 `25 0.75`，再印出 `sigh { depth: 0.8 }`。' },
      },
      {
        code: `import { Signals } from '@openav/core';

const signals = new Signals();
signals.set('wind/speed', 12);              // never declared, so it is 0..1
console.log(signals.norm('wind/speed'));    // 1  (12 is far past the range)
signals.define('wind/speed', { min: 0, max: 20 });
console.log(signals.norm('wind/speed'));    // 0.6`,
        caption: { en: 'The gotcha: an undeclared signal is 0..1, so 12 reads as 1. Declare the range and the same value reads 0.6 (the console shows `1`, then `0.6`).', zh: '陷阱：沒宣告的訊號範圍是 0..1，所以 12 會讀成 1。把範圍宣告好，同一個值就讀成 0.6（主控台先印 `1`，再印 `0.6`）。' },
      },
    ],
    related: ['Params', 'Loop', 'Mapper', 'createShow', 'Bus', 'ChordDetector'],
    keywords: {
      en: ['signal', 'signals', 'registry', 'define', 'set', 'pulse', 'event', 'continuous', 'publish', 'subscribe', 'normalized', 'input', 'osc'],
      zh: ['訊號', '信號', '登錄表', '輸入', '脈衝', '事件', '連續', '發布', '訂閱', '正規化', '範圍'],
    },
  },

  Params: {
    group: 'core',
    summary: {
      en: 'The values a world listens to: a list of declared params, each resolved every frame from the timeline, unless a hand, a knob or a route has overridden it.',
      zh: '世界所聽的那些值：一份宣告好的參數清單，每個參數每個畫面都解析成一個數字，除非有手、旋鈕或路由把它蓋掉。',
    },
    params: [
      {
        name: 'schema', type: 'Array', optional: true, default: '[]',
        en: 'The param declarations: `{ key, label?, min, max, def, step?, pulse?, group? }`. `key` is required; `min`, `max` and `def` give the range and the value when nothing else sets it. The array is kept, not copied.',
        zh: '參數的宣告：`{ key, label?, min, max, def, step?, pulse?, group? }`。`key` 一定要有。`min`、`max`、`def` 給出範圍，以及沒人設定時的值。這個陣列是直接拿來用，不會複製。',
      },
    ],
    description: [
      {
        en: 'A param is the way a world takes continuous control: `{ key: \'bloom\', min: 0, max: 1, def: 0.5 }`. The world never asks who set it. Every frame each param resolves to one number: the **override** if there is one, otherwise the **base** value (usually the [`Timeline`](#Timeline)\'s automation at the current time), otherwise `def`. `resolve()` does exactly that and hands the world a `{ key: value }` object.',
        zh: '參數是世界取得連續控制的方式：`{ key: \'bloom\', min: 0, max: 1, def: 0.5 }`。世界從來不問是誰設定的。每個畫面，每個參數都會解析成一個數字：有**覆寫值**（override）就用覆寫值，否則用**基準值**（通常是 [`Timeline`](#Timeline) 在目前時間的自動化曲線），再不然就用 `def`。`resolve()` 做的就是這件事，把 `{ key: value }` 物件交給世界。',
      },
      {
        en: 'An override is sticky. After `params.override(\'bloom\', 0.8)` (what a slider, a MIDI knob or a mapped route does) the timeline stops moving `bloom` until `clearOverride(\'bloom\')`. That matches the stage: when a person grabs a control, the score gives way. Overrides are clamped into `min`..`max` and snapped to `step` when they are written.',
        zh: '覆寫是黏住的。`params.override(\'bloom\', 0.8)` 之後（滑桿、MIDI 旋鈕或映射的路由做的就是這個），時間軸就不再動 `bloom`，直到你呼叫 `clearOverride(\'bloom\')`。這跟舞台上的情形一樣：有人抓住控制的時候，樂譜讓路。覆寫值在寫入的時候就會被夾進 `min`..`max`，並對齊 `step`。',
      },
      {
        en: 'A param with `pulse: true` is a trigger, not a level: nobody reads a value from it. Fire it with `firePulse(key)` (a pad, a route from a pulse signal, a console button) and listen with `onPulse(key, cb)`.',
        zh: '`pulse: true` 的參數是觸發器，不是水準值：沒有人從它讀值。用 `firePulse(key)` 觸發它（打擊墊、脈衝訊號的路由、主控台的按鈕），用 `onPulse(key, cb)` 聽它。',
      },
      {
        en: 'In a show, [`createShow()`](#createShow) builds one `Params` and registers every world\'s schema into it with `add()`, then returns it as `show.params`.',
        zh: '在演出裡，[`createShow()`](#createShow) 會建好一個 `Params`，用 `add()` 把每個世界的 schema 登記進去，再用 `show.params` 回傳。',
      },
    ],
    members: {
      add: {
        en: 'Register more params: `add(entries)`. A key that already exists is skipped, so the first declaration wins. Returns the `Params` itself.',
        zh: '再登記一些參數：`add(entries)`。已經存在的 key 會被略過，所以先宣告的算數。回傳 `Params` 本身。',
      },
      get: {
        en: 'The declaration of a param (`{ key, min, max, def, … }`), or `undefined`. It is not the current value: read that from `resolve()`.',
        zh: '一個參數的宣告（`{ key, min, max, def, … }`），沒有這個 key 就是 `undefined`。它不是目前的值：目前的值要從 `resolve()` 讀。',
      },
      clamp: {
        en: '`clamp(key, v)` holds `v` inside the param\'s `min`..`max` and rounds it to a multiple of `step`. An unknown key returns `v` unchanged.',
        zh: '`clamp(key, v)` 把 `v` 夾進參數的 `min`..`max`，並四捨五入到 `step` 的倍數。不認識的 key 會原樣回傳 `v`。',
      },
      override: {
        en: '`override(key, v)` sets a sticky override, clamped like `clamp()`. A key that was never declared is ignored without a word.',
        zh: '`override(key, v)` 設定一個黏住的覆寫值，會像 `clamp()` 那樣夾住。沒宣告過的 key 會被默默忽略。',
      },
      clearOverride: {
        en: 'Give one param back to the timeline.',
        zh: '把一個參數還給時間軸。',
      },
      clearAllOverrides: {
        en: 'Give every param back to the timeline.',
        zh: '把所有參數都還給時間軸。',
      },
      isOverridden: {
        en: 'Whether a param currently has an override (the console shows these labels in yellow).',
        zh: '這個參數目前有沒有被覆寫（主控台會把這些標籤顯示成黃色）。',
      },
      firePulse: {
        en: 'Fire a pulse param: every callback registered with `onPulse(key, …)` runs with the key.',
        zh: '觸發一個脈衝參數：所有用 `onPulse(key, …)` 登記的函式都會以 key 為參數執行。',
      },
      onPulse: {
        en: '`onPulse(key, cb)` runs `cb(key)` each time that pulse param fires. Returns a function that stops listening.',
        zh: '`onPulse(key, cb)` 在該脈衝參數每次觸發時呼叫 `cb(key)`。回傳一個停止監聽的函式。',
      },
      resolve: {
        en: '`resolve(base = {})` gives `{ key: value }` for every declared param: the override, else `base[key]` (for example `timeline.state()`), else `def`. A pulse param has no `def`, so its value is `undefined`.',
        zh: '`resolve(base = {})` 回傳每個已宣告參數的 `{ key: value }`：有覆寫值用覆寫值，否則用 `base[key]`（例如 `timeline.state()`），再不然用 `def`。脈衝參數沒有 `def`，所以它的值是 `undefined`。',
      },
    },
    notes: [
      {
        en: '`step` snaps with ordinary floating-point arithmetic: with `step: 0.1`, an override of 0.3 reads back as `0.30000000000000004`. On a timeline a stepped param also holds each keyframe instead of interpolating.',
        zh: '`step` 用一般的浮點數運算對齊：`step: 0.1` 時，覆寫值 0.3 讀回來是 `0.30000000000000004`。在時間軸上，有 `step` 的參數還會停在每個關鍵影格，而不是做內插。',
      },
      {
        en: '`resolve()` does not clamp the base value, only overrides are clamped when written. Keep your automation inside `min`..`max`.',
        zh: '`resolve()` 不會夾基準值，只有覆寫值在寫入時會被夾住。自動化曲線請自己保持在 `min`..`max` 之內。',
      },
      {
        en: 'The fields a world may declare (`label`, `options`, `surface`, `group` …) are listed in [Writing a world](https://openaudiovisual.com/docs/#writing-a-world-params).',
        zh: '世界可以宣告的欄位（`label`、`options`、`surface`、`group` ……）列在[寫一個世界](https://openaudiovisual.com/zh/docs/#writing-a-world-params)。',
      },
    ],
    examples: [
      {
        code: `import { Params } from '@openav/core';

const params = new Params([{ key: 'bloom', min: 0, max: 1, def: 0.5 }]);
console.log(params.resolve().bloom);          // 0.5  (no automation, no override: def)
params.override('bloom', 0.8);                // what a slider or a mapped knob does
console.log(params.resolve({ bloom: 0.1 }).bloom);   // 0.8  (the override beats the base)
params.clearOverride('bloom');
console.log(params.resolve({ bloom: 0.1 }).bloom);   // 0.1  (the base is back)`,
        caption: { en: 'The console prints `0.5`, `0.8`, `0.1`: def, then an override that beats the timeline, then the timeline again.', zh: '主控台印出 `0.5`、`0.8`、`0.1`：先是 def，接著是蓋過時間軸的覆寫值，最後時間軸回來了。' },
      },
      {
        code: `import { Params } from '@openav/core';

const params = new Params([
  { key: 'mode', min: 0, max: 3, def: 0, step: 1 },
  { key: 'burst', pulse: true },
]);
params.override('mode', 1.6);
console.log(params.resolve().mode);            // 2  (clamped and snapped to the step)
params.onPulse('burst', (key) => console.log('fired', key));
params.firePulse('burst');                     // fired burst`,
        caption: { en: 'A stepped param snaps (the console shows `2`) and a pulse param fires its listener (`fired burst`).', zh: '有 `step` 的參數會對齊（主控台顯示 `2`），脈衝參數會觸發它的監聽函式（`fired burst`）。' },
      },
      {
        code: `import { Params } from '@openav/core';

const params = new Params([{ key: 'bloom', min: 0, max: 1, def: 0.5 }]);
console.log(params.get('bloom'));                       // the declaration, not a value
params.override('bloom', 5);
console.log(params.resolve().bloom);                    // 1  (clamped to max)
params.override('typo', 0.3);                           // unknown key: ignored
console.log(params.isOverridden('typo'));               // false`,
        caption: { en: 'The gotchas: `get()` returns the declaration `{ key, min, max, def }`, an override is clamped to the range (`1`), and an unknown key is silently ignored (`false`).', zh: '幾個陷阱：`get()` 回傳的是宣告 `{ key, min, max, def }`，覆寫值會被夾進範圍（`1`），不認識的 key 會被默默忽略（`false`）。' },
      },
    ],
    related: ['Signals', 'Timeline', 'Mapper', 'Stage', 'createShow'],
    keywords: {
      en: ['param', 'params', 'parameter', 'schema', 'override', 'resolve', 'clamp', 'step', 'pulse param', 'slider', 'min max def'],
      zh: ['參數', '覆寫', '解析', '滑桿', '範圍', '預設值', '步進', '脈衝參數', '宣告'],
    },
  },

  Loop: {
    group: 'core',
    summary: {
      en: 'The frame clock: calls your function every animation frame with the seconds since the last one, and keeps ticking when the tab is hidden.',
      zh: '畫面的時鐘：每個動畫畫面呼叫你的函式一次，並告訴你距離上一次過了幾秒，分頁被藏起來時它也繼續跳。',
    },
    params: [
      {
        name: 'onFrame', type: 'Function',
        en: 'Called as `onFrame(dt, now)`: `dt` is the seconds since the previous frame (never more than `maxDt`), `now` the time in milliseconds. An error thrown inside is caught and logged as `[loop]`; the clock keeps going.',
        zh: '以 `onFrame(dt, now)` 呼叫：`dt` 是距離上一個畫面的秒數（不會超過 `maxDt`），`now` 是以毫秒計的時間。裡面丟出的錯誤會被接住、記成 `[loop]`，時鐘繼續跑。',
      },
      {
        name: 'maxDt', type: 'Number', optional: true, default: '0.1',
        en: 'The longest `dt` you will ever be handed, in seconds. A stall (a long garbage collection, a dragged window) is cut to this, so a world never has to cope with a one-second jump.',
        zh: '你拿到的 `dt` 最大值，單位是秒。卡頓（長時間的記憶體回收、被拖動的視窗）會被截成這個值，世界不用處理一秒鐘的跳動。',
      },
    ],
    description: [
      {
        en: '`new Loop((dt) => { … }).start()` runs your function once per `requestAnimationFrame`, with `dt` in seconds. It is the one clock a show has: the timeline advances, mapped signals settle, the world draws and the backstage feed is sent from inside it, in the order [the architecture page](https://openaudiovisual.com/docs/#architecture-the-frame-loop) lists. [`createShow()`](#createShow) builds and starts one for you and returns it as `show.loop`.',
        zh: '`new Loop((dt) => { … }).start()` 每個 `requestAnimationFrame` 呼叫你的函式一次，`dt` 的單位是秒。這是一場演出唯一的時鐘：時間軸往前走、映射的訊號安頓下來、世界繪圖、後台資料送出，都在它裡面做，順序見[架構頁](https://openaudiovisual.com/zh/docs/#architecture-the-frame-loop)。[`createShow()`](#createShow) 會替你建好並啟動一個，用 `show.loop` 回傳。',
      },
      {
        en: 'Browsers freeze `requestAnimationFrame` in a hidden tab, but a performance must not stop because someone switched windows. So while the loop runs, a Web Worker beats every 33 ms; whenever no animation frame has arrived for 50 ms, the loop steps itself. A hidden tab therefore ticks at roughly 15 frames a second with a normal-sized `dt`, and show time stays real time. Where the page forbids workers (a strict content security policy) that fallback is simply absent.',
        zh: '瀏覽器會在分頁被藏起來的時候凍結 `requestAnimationFrame`，但演出不能因為有人切換視窗就停下來。所以迴圈在跑的時候，會有一個 Web Worker 每 33 毫秒跳一下。只要 50 毫秒內沒有收到動畫畫面，迴圈就自己往前走一步。被藏起來的分頁因此大約每秒 15 個畫面，`dt` 大小正常，演出時間仍是真實時間。如果頁面禁止 Worker（嚴格的內容安全政策），這個備援就不存在。',
      },
      {
        en: '`loop.fps` is the frame rate, rounded, refreshed about every half second (the very first value comes from the first frame alone); it is 0 before the first frame. `loop.running` says whether it is going.',
        zh: '`loop.fps` 是四捨五入後的影格率，大約每半秒更新一次（第一個值只由第一個畫面算出來），在第一個畫面之前是 0。`loop.running` 告訴你它有沒有在跑。',
      },
    ],
    needs: {
      en: 'Call `start()`: nothing ticks until you do. It needs a browser (`requestAnimationFrame`, `performance`); in Node there is no clock to run it.',
      zh: '要呼叫 `start()`，在那之前什麼都不會跳。它需要瀏覽器（`requestAnimationFrame`、`performance`），在 Node 裡沒有時鐘可以讓它跑。',
    },
    members: {
      start: {
        en: 'Start the clock. Calling it while it already runs does nothing.',
        zh: '啟動時鐘。在它已經在跑的時候呼叫，什麼都不會發生。',
      },
      stop: {
        en: 'Stop the clock and shut the hidden-tab worker down. `start()` begins again.',
        zh: '停掉時鐘，並關掉分頁被藏起來時用的 Worker。可以再 `start()` 一次。',
      },
    },
    notes: [
      {
        en: 'Do not read the real clock inside a world: take time from `dt` (or from the timeline), so a show at 30 fps and one at 144 fps do the same thing.',
        zh: '不要在世界裡讀真實時間，時間請從 `dt`（或時間軸）來，這樣 30 fps 和 144 fps 的演出才會做一樣的事。',
      },
    ],
    examples: [
      {
        code: `import { Loop } from '@openav/core';

let elapsed = 0;
const loop = new Loop((dt) => {
  elapsed += dt;
  document.getElementById('app').textContent = elapsed.toFixed(1) + ' s  ·  ' + loop.fps + ' fps';
  if (elapsed > 3) loop.stop();
});
loop.start();`,
        caption: { en: 'A clock counts up in the page and stops itself after three seconds.', zh: '頁面上有一個時鐘一直往上數，三秒後自己停下來。' },
      },
      {
        code: `import { Loop } from '@openav/core';

const ctx = document.getElementById('c').getContext('2d');
let x = 0;
const loop = new Loop((dt) => {
  x = (x + 120 * dt) % 400;          // 120 pixels a second, whatever the frame rate
  ctx.fillStyle = '#111'; ctx.fillRect(0, 0, 400, 300);
  ctx.fillStyle = '#7ea6ff'; ctx.fillRect(x, 130, 40, 40);
}, { maxDt: 0.05 });
loop.start();`,
        caption: { en: 'A square crosses the canvas at 120 pixels a second, the same speed at any frame rate because it moves by `dt`.', zh: '一個方塊以每秒 120 像素的速度橫過畫布，它是按 `dt` 移動的，所以不管畫面更新率多少，速度都一樣。' },
      },
    ],
    related: ['createShow', 'Timeline', 'Signals', 'Params'],
    keywords: {
      en: ['loop', 'frame', 'clock', 'requestAnimationFrame', 'raf', 'dt', 'delta time', 'fps', 'tick', 'hidden tab', 'animation'],
      zh: ['迴圈', '畫面', '時鐘', '影格', '更新率', 'fps', '動畫', '分頁', '背景', '時間差'],
    },
  },

  Bus: {
    group: 'core',
    summary: {
      en: 'A minimal event emitter: `on(event, cb)`, `emit(event, payload)`, `off(event, cb)`. No wildcards, no async.',
      zh: '最陽春的事件發射器：`on(event, cb)`、`emit(event, payload)`、`off(event, cb)`。沒有萬用字元，也不是非同步。',
    },
    description: [
      {
        en: '`new Bus()` is a tiny publish and subscribe helper for your own code: subscribe to an event name with `on()`, fire it with `emit()`, and every callback gets the one payload you pass. Callbacks run in the order they subscribed, synchronously, inside `emit()`.',
        zh: '`new Bus()` 是給你自己的程式用的小型發布與訂閱工具：用 `on()` 訂閱一個事件名稱，用 `emit()` 觸發，每個函式都會收到你傳的那一個內容。函式依訂閱順序同步執行，都在 `emit()` 裡面跑完。',
      },
      {
        en: 'It is not the thing shows talk through. Inputs and worlds talk through [`Signals`](#Signals) (named values with a range) and [`Params`](#Params); nothing else in the framework uses a `Bus`, and `createShow()` does not create one.',
        zh: '演出裡各部分溝通靠的不是它。輸入和世界是透過 [`Signals`](#Signals)（有範圍的具名值）和 [`Params`](#Params) 溝通，框架裡沒有別的東西用到 `Bus`，`createShow()` 也不會建立一個。',
      },
    ],
    members: {
      on: {
        en: 'Subscribe: `on(event, cb)`. Returns a function that unsubscribes.',
        zh: '訂閱：`on(event, cb)`。回傳一個取消訂閱的函式。',
      },
      off: {
        en: 'Unsubscribe the callback you passed to `on()`.',
        zh: '取消你傳給 `on()` 的那個函式。',
      },
      emit: {
        en: 'Fire an event with one payload: `emit(event, payload)`. A callback that throws is caught and logged as `[bus] <event> handler:`; the rest still run.',
        zh: '用一個內容觸發事件：`emit(event, payload)`。丟出錯誤的函式會被接住、記成 `[bus] <event> handler:`，其他函式照常執行。',
      },
    },
    examples: [
      {
        code: `import { Bus } from '@openav/core';

const bus = new Bus();
const off = bus.on('hit', (strength) => console.log('hit', strength));
bus.emit('hit', 0.8);   // hit 0.8
off();                  // unsubscribe
bus.emit('hit', 0.9);   // nothing: nobody is listening`,
        caption: { en: 'The console prints `hit 0.8` once; after unsubscribing, the second `emit` is silent.', zh: '主控台只印出一次 `hit 0.8`，取消訂閱之後，第二次 `emit` 沒有任何反應。' },
      },
    ],
    related: ['Signals', 'Params'],
    keywords: {
      en: ['bus', 'event emitter', 'events', 'on', 'emit', 'off', 'publish', 'subscribe', 'pubsub', 'listener'],
      zh: ['事件', '發射器', '匯流排', '訂閱', '發布', '監聽', '回呼'],
    },
  },
};
