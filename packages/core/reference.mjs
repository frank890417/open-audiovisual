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
        en: 'The names every built-in package publishes are listed in [the signals reference](https://openaudiovisual.com/docs/signals/).',
        zh: '每個內建套件發布的訊號名稱，都列在[訊號參考](https://openaudiovisual.com/zh/docs/signals/)。',
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
        en: 'The fields a world may declare (`label`, `options`, `surface`, `group` …) are listed in [Writing a world](https://openaudiovisual.com/docs/writing-a-world/#writing-a-world-params).',
        zh: '世界可以宣告的欄位（`label`、`options`、`surface`、`group` ……）列在[寫一個世界](https://openaudiovisual.com/zh/docs/writing-a-world/#writing-a-world-params)。',
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
        en: 'Called as `onFrame(dt, now)`: `dt` is the seconds since the previous frame (never more than `maxDt` on an automatic frame), `now` the time in milliseconds on the same clock as `clock` (in a manual loop: the loop\'s own time, which starts at 0). An error thrown inside is caught and logged as `[loop]`; the clock keeps going.',
        zh: '以 `onFrame(dt, now)` 呼叫：`dt` 是距離上一個畫面的秒數（自動的畫面不會超過 `maxDt`），`now` 是以毫秒計的時間，跟 `clock` 是同一個鐘（手動迴圈則是迴圈自己的時間，從 0 開始）。裡面丟出的錯誤會被接住、記成 `[loop]`，時鐘繼續跑。',
      },
      {
        name: 'maxDt', type: 'Number', optional: true, default: '0.1',
        en: 'In the options object, like the ones below. The longest `dt` an automatic frame hands you, in seconds. A stall (a long garbage collection, a dragged window) is cut to this, so a world never has to cope with a one-second jump. `step(dt)` is not clamped.',
        zh: '放在選項物件裡，下面幾個也是。自動的畫面交給你的 `dt` 最大值，單位是秒。卡頓（長時間的記憶體回收、被拖動的視窗）會被截成這個值，世界不用處理一秒鐘的跳動。`step(dt)` 不受這個限制。',
      },
      {
        name: 'clock', type: 'Function', optional: true, default: 'performance.now',
        en: 'Your own clock: a function that returns milliseconds and never goes backwards. A test passes a fake one.',
        zh: '你自己的時鐘：一個回傳毫秒、而且不會倒退的函式。測試可以傳一個假的。',
      },
      {
        name: 'raf', type: 'Function', optional: true, default: 'requestAnimationFrame',
        en: 'Your own scheduler: `raf(cb)` arranges for `cb` to be called once, for the next frame. `cb` may be given a timestamp in milliseconds; when it is not, `clock()` is read.',
        zh: '你自己的排程器：`raf(cb)` 安排在下一個畫面呼叫一次 `cb`。`cb` 可以收到一個毫秒的時間戳，沒給的話就讀 `clock()`。',
      },
      {
        name: 'manual', type: 'Boolean', optional: true, default: 'false',
        en: '`true` schedules nothing at all: every frame comes from your own call to `loop.step(dt)`.',
        zh: '`true` 表示完全不排程：每個畫面都來自你自己呼叫的 `loop.step(dt)`。',
      },
      {
        name: 'heartbeat', type: 'Boolean', optional: true,
        en: 'The hidden-tab Worker. By default it is on with the page\'s own `requestAnimationFrame` and off with an injected `raf` or with `manual`, because a real timer must not step a fake clock. `true` turns it back on.',
        zh: '分頁被藏起來時用的 Worker。預設是：用頁面自己的 `requestAnimationFrame` 就開著，給了自己的 `raf` 或 `manual` 就關掉，因為真的計時器不該去推一個假時鐘。`true` 可以把它再打開。',
      },
    ],
    description: [
      {
        en: '`new Loop((dt) => { … }).start()` runs your function once per `requestAnimationFrame`, with `dt` in seconds. It is the one clock a show has: the timeline advances, mapped signals settle, the world draws and the backstage feed is sent from inside it, in the order [the architecture page](https://openaudiovisual.com/docs/architecture/#architecture-the-frame-loop) lists. [`createShow()`](#createShow) builds and starts one for you and returns it as `show.loop`.',
        zh: '`new Loop((dt) => { … }).start()` 每個 `requestAnimationFrame` 呼叫你的函式一次，`dt` 的單位是秒。這是一場演出唯一的時鐘：時間軸往前走、映射的訊號安頓下來、世界繪圖、後台資料送出，都在它裡面做，順序見[架構頁](https://openaudiovisual.com/zh/docs/architecture/#architecture-the-frame-loop)。[`createShow()`](#createShow) 會替你建好並啟動一個，用 `show.loop` 回傳。',
      },
      {
        en: 'Browsers freeze `requestAnimationFrame` in a hidden tab, but a performance must not stop because someone switched windows. So while the loop runs, a Web Worker beats every 33 ms; whenever no animation frame has arrived for 50 ms, the loop steps itself. A hidden tab therefore ticks at roughly 15 frames a second with a normal-sized `dt`, and show time stays real time. Where the page forbids workers (a strict content security policy) that fallback is simply absent.',
        zh: '瀏覽器會在分頁被藏起來的時候凍結 `requestAnimationFrame`，但演出不能因為有人切換視窗就停下來。所以迴圈在跑的時候，會有一個 Web Worker 每 33 毫秒跳一下。只要 50 毫秒內沒有收到動畫畫面，迴圈就自己往前走一步。被藏起來的分頁因此大約每秒 15 個畫面，`dt` 大小正常，演出時間仍是真實時間。如果頁面禁止 Worker（嚴格的內容安全政策），這個備援就不存在。',
      },
      {
        en: '`loop.fps` is the frame rate, rounded, refreshed about every half second (the very first value comes from the first frame alone); it is 0 before the first frame. `loop.running` says whether it is going.',
        zh: '`loop.fps` 是四捨五入後的影格率，大約每半秒更新一次（第一個值只由第一個畫面算出來），在第一個畫面之前是 0。`loop.running` 告訴你它有沒有在跑。',
      },
      {
        en: 'Who supplies the time is a choice. `new Loop(fn)` uses the page: `requestAnimationFrame`, `performance.now` and the hidden-tab Worker. `new Loop(fn, { clock, raf })` runs on your sources, such as a test\'s fake timer or a recorder\'s frame pump. `new Loop(fn, { manual: true })` schedules nothing: you call `loop.step(dt)` and each call is one frame. That is how a show is recorded frame by frame, unit-tested, or run headless, without replacing the global `requestAnimationFrame`. In a show, `createShow({ loop: \'manual\' })` or `{ loop: { clock, raf } }` passes these on.',
        zh: '時間由誰提供是可以選的。`new Loop(fn)` 用的是頁面的：`requestAnimationFrame`、`performance.now`，加上分頁被藏起來時的 Worker。`new Loop(fn, { clock, raf })` 用你給的來源跑，例如測試的假計時器，或錄影程式的逐格推進。`new Loop(fn, { manual: true })` 什麼都不排程：由你呼叫 `loop.step(dt)`，每呼叫一次就是一個畫面。逐格錄下一場演出、寫單元測試、或無頭執行，就是這樣做的，不必換掉全域的 `requestAnimationFrame`。在演出裡，`createShow({ loop: \'manual\' })` 或 `{ loop: { clock, raf } }` 會把這些選項傳下來。',
      },
    ],
    needs: {
      en: 'Call `start()`: nothing ticks until you do. By default it needs a browser (`requestAnimationFrame`, `performance`). Where there is no `requestAnimationFrame`, `start()` throws unless you passed `{ raf }` or `{ manual: true }`; `step(dt)` works anywhere.',
      zh: '要呼叫 `start()`，在那之前什麼都不會跳。預設它需要瀏覽器（`requestAnimationFrame`、`performance`）。環境裡沒有 `requestAnimationFrame` 的時候，除非你傳了 `{ raf }` 或 `{ manual: true }`，否則 `start()` 會丟出錯誤。`step(dt)` 在哪裡都能用。',
    },
    members: {
      step: {
        en: '`step(dt)`: run one frame of `dt` seconds now, on any loop, started or not. It is not clamped to `maxDt`, and `dt = 0` is a frame too (a redraw in place). The `now` handed to `onFrame` moves on by `dt` from where the loop\'s time stood (0 for a loop that has not run). Returns `false`, running nothing, when `dt` is not a finite number of 0 or more. On an automatic loop it adds a frame, and the loop\'s time jumps with it.',
        zh: '`step(dt)`：現在就跑一個 `dt` 秒的畫面，任何迴圈都能用，不管有沒有啟動。它不受 `maxDt` 限制，`dt = 0` 也算一個畫面（原地重畫）。交給 `onFrame` 的 `now` 會從迴圈目前的時間往前走 `dt`（沒跑過的迴圈從 0 開始）。`dt` 不是大於等於 0 的有限數字的時候，什麼都不跑，回傳 `false`。在自動迴圈上，它會多加一個畫面，迴圈的時間也跟著跳。',
      },
      start: {
        en: 'Start the clock. Calling it while it already runs does nothing. On a manual loop it only sets `running`.',
        zh: '啟動時鐘。在它已經在跑的時候呼叫，什麼都不會發生。在手動迴圈上，它只會把 `running` 設成 true。',
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
      {
        code: `import { Loop } from '@openav/core';

const loop = new Loop((dt, now) => console.log(dt, now), { manual: true });   // nothing is scheduled
loop.step(0.5);                  // one frame of half a second
loop.step(0.25);
console.log(loop.step(-1));      // not a frame`,
        caption: { en: 'A loop you drive yourself: the console prints `0.5 500`, `0.25 750`, then `false`. Each `step(dt)` is one frame, and `now` is the loop\'s own time in milliseconds.', zh: '一個由你自己推的迴圈：主控台印出 `0.5 500`、`0.25 750`，接著是 `false`。每次 `step(dt)` 就是一個畫面，`now` 是迴圈自己的時間，單位是毫秒。' },
      },
    ],
    related: ['createShow', 'Timeline', 'Signals', 'Params'],
    keywords: {
      en: ['loop', 'frame', 'clock', 'requestAnimationFrame', 'raf', 'dt', 'delta time', 'fps', 'tick', 'hidden tab', 'animation', 'manual', 'step', 'headless', 'fake clock', 'record frame by frame'],
      zh: ['迴圈', '畫面', '時鐘', '影格', '更新率', 'fps', '動畫', '分頁', '背景', '時間差', '手動', '逐格', '無頭', '假時鐘'],
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
  VERSION: {
    group: 'core',
    summary: {
      en: 'The version of the framework as a string, the same number as the tag in a pinned address.',
      zh: '框架的版本，是一個字串，跟固定版本網址裡的 tag 是同一個數字。',
    },
    description: [
      {
        en: 'One version covers every package: `package.json`, this constant and the address `…/open-audiovisual@v0.9.0/packages/openav.js` carry the same number. A show started with `createShow()` also has it as `window.openav.version`, so you can ask a running page which framework it is on.',
        zh: '一個版本涵蓋所有套件：`package.json`、這個常數和網址 `…/open-audiovisual@v0.9.0/packages/openav.js` 帶的是同一個數字。用 `createShow()` 開演的頁面上也有 `window.openav.version`，所以可以問一個正在跑的頁面它用的是哪一版。',
      },
      {
        en: 'oav-p5, the one line for p5.js, counts its own versions: `OAVp5.version`.',
        zh: 'p5.js 的那一行 oav-p5 有自己的版本號：`OAVp5.version`。',
      },
    ],
    value: { type: 'String', en: 'Three numbers with dots, for example `0.9.0`.', zh: '用點隔開的三個數字，例如 `0.9.0`。' },
    examples: [
      {
        code: `import { VERSION } from '@openav/core';

console.log('open-audiovisual', VERSION);   // open-audiovisual 0.9.0`,
        caption: { en: 'The console prints the framework version.', zh: '主控台印出框架的版本。' },
      },
    ],
    related: ['sign', 'createShow'],
    keywords: { en: ['version', 'semver', 'pin', 'tag', 'release'], zh: ['版本', '版號', '固定版本'] },
  },
  sign: {
    group: 'core',
    summary: {
      en: 'Marks a page as made with open-audiovisual by adding one `<meta name="generator">` tag, without sending anything.',
      zh: '在頁面加一個 `<meta name="generator">` 標籤，標明它是用 open-audiovisual 做的，不送出任何東西。',
    },
    description: [
      {
        en: 'It adds `<meta name="generator" content="open-audiovisual 0.9.0">` to the document\'s head, the tag WordPress and Hugo leave. No request is made, no cookie is set and there is no id: the tag is for a person who views the source, and for searches and censuses of the public web. `createShow()` calls it for you, and `createShow({ signature: false })` does not.',
        zh: '它在文件的 head 裡加上 `<meta name="generator" content="open-audiovisual 0.9.0">`，WordPress 和 Hugo 留的也是這種標籤。不發出請求、不寫 cookie、沒有任何識別碼。這個標籤是給檢視原始碼的人看的，也讓公開網頁的搜尋與普查認得出來。`createShow()` 會替你呼叫，`createShow({ signature: false })` 就不會。',
      },
      {
        en: 'Calling it again changes nothing: there is one tag per product. A generator tag another tool left stays where it is. Where there is no document (Node, a worker) it returns `null`.',
        zh: '再呼叫一次不會有變化：一個產品只有一個標籤。別的工具留下的 generator 標籤會留在原地。沒有文件的地方（Node、worker）會回傳 `null`。',
      },
    ],
    params: [
      {
        name: 'doc', type: 'Document', optional: true, default: 'globalThis.document',
        en: 'The document to mark.',
        zh: '要標記的文件。',
      },
      {
        name: 'product', type: 'String', optional: true, default: "'open-audiovisual'",
        en: 'Read from the second argument, an object: `sign(document, { product, version })`. Another product of the project, for a tag of its own beside the framework\'s.',
        zh: '從第二個引數（一個物件）讀：`sign(document, { product, version })`。這個專案的另一個產品，會在框架的標籤旁邊多一個自己的標籤。',
      },
      {
        name: 'version', type: 'String', optional: true, default: 'VERSION',
        en: 'In the same object: the version that goes after the product\'s name.',
        zh: '同一個物件裡：接在產品名稱後面的版本。',
      },
    ],
    returns: { type: 'HTMLMetaElement | null', en: 'The tag, new or already there. `null` without a document.', zh: '那個標籤，新加的或原本就有的。沒有文件時是 `null`。' },
    examples: [
      {
        code: `import { sign } from '@openav/core';

const meta = sign();                 // a page that does not use createShow()
console.log(meta.content);           // open-audiovisual 0.9.0`,
        caption: { en: 'The page\'s head gains one generator tag, and the console prints its content.', zh: '頁面的 head 多了一個 generator 標籤，主控台印出它的內容。' },
      },
    ],
    related: ['VERSION', 'createShow'],
    keywords: { en: ['generator', 'meta', 'signature', 'made with', 'built with', 'telemetry'], zh: ['簽名', '標籤', '用它做的', '使用統計'] },
  },
};
