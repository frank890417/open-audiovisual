# 演出控制

把一張草稿變成一場演出，靠的是這一章的幾個部分：呼叫一次就組好的外殼、時間軸、控台、演出模式、後台監看，還有讓聲音和資料送出瀏覽器的幾種方式。

## createShow

`createShow()`（`@openav/show`）以一個世界為中心組好整場演出，再把每個部分交給你。它是 `async`，因為要等世界的 `init` 跑完。

```js
import { createShow } from '@openav/show';

const show = await createShow({
  world: myWorld,
  timeline: { total: 120, automation: { hue: [[0, 205], [60, 320]] }, scenes },
  routes: [{ source: 'audio/rms', target: 'energy', inMax: 0.3, smooth: 0.1 }],
  modules: { keys: { base: 48 }, chord: true, audio: true, sound: true },
  artwork: { title: 'Untitled', artist: 'You', year: 2026 },
  hint: 'play the piano · Space plays the timeline',
});
```

| 選項 | 預設 | 意義 |
|---|---|---|
| `world` | `null` | 要演出的世界，最先啟用 |
| `worlds` | `[]` | 另外要註冊的世界（用 `show.stage.activate(name)` 切換） |
| `timeline` | `{ total: 120 }` | 給[時間軸](#timeline)的 `{ total, automation, scenes }` |
| `routes` | `[]` | 要加進映射器的路由（[映射](mapping.md)） |
| `modules` | `{}` | 要打開的輸入與輸出（見下表） |
| `artwork` | `null` | `{ title, artist, year, note }`：舞台上的一行作品署名，以及一個 `<meta name="artwork">` |
| `hint` | `''` | 舞台左下角的一行 HTML |
| `profile` | 世界的名稱 | 映射器儲存設定檔的名稱。`false` = 忽略儲存的路由（[儲存的設定檔](mapping.md#saved-profiles)） |
| `onFrame` | `null` | `(dt, show) => {}`，每個影格執行一次，在時間軸前進之前 |
| `mount` | 自動產生 | 要渲染進去的 `{ stage, side }` 元素或選擇器，取代整頁版面 |
| `telemetry` | `true` | 每次載入頁面送一筆匿名的 `oav_show_start`（見控制器章的〈使用統計〉），`false` 就不送 |

沒有 `mount` 時，頁面的 body 會變成兩欄的格線：一欄是舞台，一欄是 340 px 寬、放鋼琴和控台的側邊面板。

| `modules` 的 key | 值 | 加入什麼 |
|---|---|---|
| `midi` | 預設開啟，或 `false` | `Midi` 引擎（輸入與輸出） |
| `midi.controllers` | `true` 或 `{ profile, profiles, open }` | 一台停靠在舞台上的螢幕 MIDI 控制器、一個 🎹 按鈕和 <kbd>M</kbd> 鍵。網址加上 `?profile=<id>` 可以指定裝置（[控制器](controllers.md)） |
| `keys` | 預設開啟、`false` 或 `{ base, octaves, sim, capture }` | 螢幕鋼琴、電腦鍵盤和模擬演奏者 |
| `drums` | `true` 或 `{ engine, autoEnableEngine }` | 鼓機 |
| `audio` | 任何為真（truthy）的值 | 麥克風分析器（按 🎤 mic 啟動） |
| `chord` | `true` 或 `{ window }` | 對每個彈出的音做和弦分析 |
| `hands` | `true` | 手部追蹤（按 🖐 hands 啟動） |
| `pose` | `true` | 身體追蹤（按 🕺 body 啟動） |
| `remote` | `true` 或 `{ room, auto, surface, feedbackHz, url }` | 手機和 iPad 當控制器（[手機](remote.md#the-show-side)） |
| `sound` | `true` 或 `{ engine }` | 頁面裡的合成器，預設是 Tone.js（[聲音](#sound)） |

它回傳 `{ signals, params, stage, timeline, mapper, midi, controllers, midiPanel, keys, drums, sound, audio, hands, pose, chord, remote, console, app, loop }`，你沒要的部分是 `null`。同一個物件也掛在 `window.openav`，方便在 devtools 主控台裡查看。每個影格的執行順序寫在[架構](architecture.md#the-frame-loop)。

## 時間軸

```js
const timeline = new Timeline({
  params,
  total: 2400,                       // seconds (default 600 when used directly; createShow uses 120)
  automation: {
    growth: [[0, 0.2], [300, 1.0], [1200, 0.4]],   // [t, value] keyframes, linear
    mode:   [[0, 0], [600, 1], [1800, 2]],          // step params hold (no interp)
  },
  scenes: [
    { id: 'standby', t: -30, title: 'Standby', note: 'house lights · breathe' },
    { id: 'act1',    t: 0,   title: 'Act I',   note: 'single seeds only' },
    { id: 'act2',    t: 600, title: 'Act II',  note: 'full harmony' },
  ],
});
timeline.onSceneChange((i, scene) => { /* fire cues: sound, lights, OSC */ });
```

- 場景時間是負數 = 開演前的待命（時鐘顯示 -0:30）
- `jumpScene(±1)`（← → 鍵）是你的緊急導航，排練時就要拿它練
- 排練時用 `timeline.rate` 快轉（`rate = 4`）
- 播放到 `total` 會自己停下

| 成員 | 作用 |
|---|---|
| `play()`, `pause()`, `toggle()` | 播放控制 |
| `seek(t)` | 跳到第 `t` 秒（下限是第一個場景的負數時間，沒有的話是 0，上限是 `total`） |
| `jumpScene(d)` | 跳到往前或往後 `d` 個場景的開頭 |
| `reset()` | 停止並倒回 0 |
| `advance(dt)` | 每個影格呼叫，播放中把 `t` 往前推 `dt × rate` |
| `state(t)`, `valueAt(key, t)` | 某個時間點的自動化數值（不含覆寫） |
| `sceneIndexAt(t)`, `currentScene(t)`, `sceneEnd(i)` | 查詢場景 |
| `onSceneChange(cb)` | 每當播放或 seek 進到另一個場景，就呼叫 `cb(index, scene)` |
| `t`, `playing`, `rate`, `total`, `scenes`, `automation` | 可讀也可寫的狀態 |

cue（換場時要觸發的燈光、音效等提示）清單，寫起來就是一個換場處理函式：

```js
show.timeline.onSceneChange((i, scene) => {
  if (scene.id === 'storm') show.stage.activate('storm');   // switch worlds
  show.midi?.cc(20, i, 16);                                  // tell the lighting desk
});
```

## 控台

`mountConsole(el, app, { layers, signals })`（`@openav/console`）會做出導演控台，`createShow()` 把它掛在側邊面板。`app` 就是 `createShow()` 回傳的 `show.app`（`timeline`、`params`、`mapper`、`signals`、`stage`、`midi`、`sound`、`audio`、`hands`、`pose`…），缺了哪個部分，對應的區塊就不顯示。傳入 `{ layers: false }` 或 `{ signals: false }`，可以拿掉那些面板。控台上有播放控制，以及一條標出場景區段、可以拖曳的時間列。各層的面板有 Layers（各層總覽）、L1 Input（輸入）、L2 Mapping（映射）、L3 Params（參數，滑桿附覆寫與 learn 小按鈕）、L4 sound（聲音）。另外還有即時訊號儀表和 MIDI 紀錄。

鍵盤：**Space** 播放／暫停 · **←/→** 換場景 · **R** 重設 · **T** 演出模式 · **F** 全螢幕。在輸入欄位裡打字，不會觸發這些快捷鍵。

覆寫的規則：一碰滑桿（或有映射的控制項），那個參數就脫離時間軸，直到你按 ✕ 清掉覆寫。標籤變黃 = 已覆寫。

## 演出模式

按 **T** 切到全螢幕的提詞畫面：目前場景的標題和備註，用站在舞台上也看得清楚的大字顯示，另外有下一個場景的預覽、時鐘和場景倒數。這是給*演奏者*看的。給觀眾看的，是你按 **F** 開成全螢幕的舞台。同一個頁面開兩個視窗，一個當控台，一個當舞台。

## 後台監看

```bash
node packages/monitor/server.js       # on the performance machine (npm run monitor)
# stage manager's phone/laptop: http://<performance-machine-ip>:7457/
```

每個用 `createShow()` 做的演出頁面，大約每秒 15 次把快照串流到 `ws://<the page's host>:7457`，所以監看伺服器要跑在提供演出頁面的那台電腦上。後台即時顯示時鐘、場景、世界、FPS、覆寫、所有訊號和參數。舞台 4 秒沒有傳來資料，就會跳出紅色的「stage feed lost」（舞台連線中斷）橫幅，這時候就輪到舞台監督出手。不用設定，沒有相依套件，兩端都會自己重新連線。`GET /health` 回應 `{ ok, clients }`。

監看伺服器沒在跑時，演出頁面會一直重試，間隔從大約 5 秒拉長到 30 秒。瀏覽器會記下每一次被拒絕的連線，這些訊息是預期中的。

如果演出是你手動組起來的：

```js
import { MonitorFeed, snapshotOf } from '@openav/monitor';
const monitor = new MonitorFeed({ url: 'ws://192.168.1.20:7457', hz: 15 });   // both optional
monitor.connect();
// every frame:
monitor.frame(snapshotOf({ timeline, params, signals, stage, loop }, state));
```

## OSC 輸出

```bash
node packages/osc/bridges/osc-bridge.js 7456 192.168.1.50 3456
#                       http port ↑    target host ↑   udp port ↑
```

預設值是 `7456 127.0.0.1 3456`。瀏覽器不能送 UDP，所以 `OscOut` 透過 HTTP 把一批批訊息送到橋接程式，再由橋接程式包成 OSC 封包送出去。

```js
import { OscOut } from '@openav/osc';

const osc = new OscOut();          // http://127.0.0.1:7456
await osc.enable();                // probes /health, fails gracefully (false)
osc.send('/source/3/xyz', [x, y, z]);
osc.flush();                       // once per frame (batches, dedupes per address)
```

數字以 OSC float 送出，Spat、Reaper 和 TouchDesigner 要的正是這個，其他型別一律當字串送。每個位址在一格裡只留最新的一則訊息。橋接程式不見的話，`OscOut` 會透過 `onStatus(ok, info)` 回報，連續 30 次 flush 失敗之後就不再試。

`createShow()` 不會幫你建 `OscOut`，要自己加一個（並把 `"@openav/osc": "../../packages/osc/index.js"` 加進頁面的 import map）：

```js
const osc = new OscOut();
await osc.enable();
const show = await createShow({ world, onFrame: () => osc.flush() });
show.app.osc = osc;          // the Layers panel shows the OSC rate
show.stage.io.osc = osc;     // worlds can send from update(dt, state, io)
```

## MIDI 輸出與緊急靜音

`midi.noteOn/noteOff/cc/send` 會送到選定的輸出埠。`midi.panic()` 會在全部 16 個頻道送出 all-notes-off、all-sound-off、放開延音踏板，再逐音送 note-off。它跟其他輸出走同一個出口，一樣看得到。把它綁在一個摸黑也找得到的打擊墊上。每個演奏者遲早都會用到它，在這裡只要呼叫一次。

```js
show.midi.outputs.map((o) => o.name);   // available output ports
show.midi.selectOutput('IAC Driver Bus 1');
show.midi.noteOn(60, 100, 1);           // note, velocity 0..127, channel 1..16
show.midi.noteOff(60, 1);
show.midi.cc(74, 64, 1);                // controller, value 0..127, channel
show.midi.send([0xb0, 74, 64]);         // raw bytes
show.midi.panic();
```

還沒選輸出埠之前，用的是第一個輸出埠（`enable(preferredOut)` 先找名稱完全相同的埠，找不到再找名稱包含這個字串的）。送出的每一則訊息都會經過 `onSend`，Layers 面板裡分頻道的 MIDI OUT 儀表就是靠它更新。

## 聲音

`modules: { sound: true }` 會加入 `Sound`（`@openav/sound`），用的是 Tone.js 引擎。瀏覽器要等使用者點一下才會開始播放音訊，所以控台會在 *L4 · Output — sound*（聲音輸出）面板放一個 **🔊 enable sound**（開啟聲音）按鈕。開啟之後，合成器就會跟著每個 `midi/note/on` 和 `midi/note/off` 彈，不管是誰送的（MIDI 鍵盤、電腦鍵盤鋼琴、模擬演奏者、手機）。

引擎的參數會併進演出的參數，放在 `sound/` 底下。用 Tone 引擎時，有 `sound/cutoff`（100–8000 Hz，預設 2500）、`sound/space`（殘響的 wet 比例，0–1，預設 0.3）和 `sound/volume`（−36–0 dB，預設 −8）。它們會出現在控台上，可以交給時間軸自動化，也能像其他參數一樣映射，所以一顆旋鈕、一隻手或樂譜，演奏濾波器的方式就跟演奏畫面一樣。Tone.js（15.0.4）要等開啟聲音時才從 jsDelivr 載入。

引擎只是一個小物件，你也可以自己寫一個：

```js
const sineEngine = () => {
  let ctx = null, out = null;
  const voices = new Map();
  return {
    params: [{ key: 'gain', label: 'Gain', min: 0, max: 1, def: 0.3 }],   // → sound/gain
    async enable() {
      ctx = new AudioContext();
      out = ctx.createGain(); out.gain.value = 0.3; out.connect(ctx.destination);
    },
    noteOn(note, vel) {
      voices.get(note)?.stop();
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = 440 * 2 ** ((note - 69) / 12);
      g.gain.value = vel * 0.3;
      o.connect(g).connect(out); o.start();
      voices.set(note, o);
    },
    noteOff(note) { voices.get(note)?.stop(); voices.delete(note); },
    set(key, value) { if (key === 'gain' && out) out.gain.value = value; },
    dispose() { ctx?.close(); },
  };
};

await createShow({ world, modules: { sound: { engine: sineEngine() } } });
```

`@openav/drums` 的鼓組也是一個引擎：`drumEngine({ samples })` 把 General MIDI 的鼓組音符對應到合成的鼓聲（或你的取樣，`{ 36: 'kick.wav', … }`），只有一個參數 `kitVolume`（−30–0 dB）。

## 不用 createShow

`createShow()` 只是圖個方便。需要自己的版面或迴圈時，就手動組裝各個部分。它做的事大致如下：

```js
import { Signals, Params, Loop } from '@openav/core';
import { Midi } from '@openav/midi';
import { Mapper } from '@openav/mapping';
import { Timeline } from '@openav/timeline';
import { Stage } from '@openav/stage';
import { mountConsole } from '@openav/console';
import { MonitorFeed, snapshotOf } from '@openav/monitor';

const signals = new Signals();
const params = new Params();
const stage = new Stage({ container: document.querySelector('#stage'), params, signals });
stage.register(myWorld);
await stage.activate(myWorld.name);

const timeline = new Timeline({ params, total: 120, automation, scenes });
const mapper = new Mapper({ signals, params, profile: myWorld.name });
if (!mapper.load()) routes.forEach((r) => mapper.addRoute(r));

const midi = new Midi({ signals });
midi.enable();

// mount the console after every world (and sound engine) is registered: it builds one row per param
const app = { timeline, params, mapper, signals, midi, stage };
const desk = mountConsole(document.querySelector('#desk'), app);
const monitor = new MonitorFeed();
monitor.connect();

const loop = app.loop = new Loop((dt) => {
  timeline.advance(dt);
  mapper.update(dt);
  const state = stage.frame(dt, timeline.state());
  desk.render(state);
  monitor.frame(snapshotOf({ timeline, params, signals, stage, loop }, state));
});
loop.start();
```

## 演出前檢查清單

- [ ] 用 Chrome、接上電源、關掉螢幕休眠、關掉通知（`chrome://settings`）
- [ ] 這個來源（origin）已經取得 WebMIDI 權限（權限依來源、依埠分開）
- [ ] 映射設定檔已經儲存（mapper.save()），而且也匯出成 JSON 檔
- [ ] 監看伺服器在跑，舞台監督的裝置也在同一個網路裡
- [ ] 已經點一下開啟聲音，panic 打擊墊也映射好了
- [ ] 演練一次出錯：關掉分頁、重開，30 秒內回到演出狀態
