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
| `map` | 網址裡的 `?map=` | 開始時載入的對應檔：同源或 https 網址。`false` = 忽略 `?map=`（[對應檔](mapping.md#map-files-export-import-and-share)） |
| `profile` | 世界的名稱 | 映射器儲存設定檔的名稱。`false` = 忽略儲存的路由（[儲存的設定檔](mapping.md#saved-profiles)） |
| `onFrame` | `null` | `(dt, show) => {}`，每個影格執行一次，在時間軸前進之前 |
| `mount` | 自動產生 | 要渲染進去的 `{ stage, side }` 元素或選擇器，取代整頁版面 |
| `telemetry` | `true` | 每次載入頁面送一筆匿名的 `oav_show_start`（見控制器章的〈使用統計〉），`false` 就不送 |
| `score` | `null` | `{ cuts, cut, modules, api, midi, … }`：把演出的結構寫成段落長度，由段落模組去演出。網址上的 `?cut=<id>` 決定用哪個版本（[總譜與導演](score.md#use-it-with-createshow)） |
| `loop` | `'auto'` | 誰來給影格：`'auto'`（頁面的 `requestAnimationFrame`）、`'manual'`（你自己呼叫 `show.loop.step(dt)`），或 `{ clock, raf, maxDt, heartbeat }`，也就是 `new Loop()` 的選項（[見下](#driving-the-frames-yourself)） |
| `monitor` | `true` | [後台推送](#backstage-monitor)：`false` = 不推送（頁面不會開任何 socket），`{ url, hz }` = 換一個中繼位址或頻率 |
| `console` | `null` | [控台](#the-console)的選項，也就是 `mountConsole` 的：`{ keys, layers, signals, learnOrder }`；`keys` 用來挪動鍵盤快捷鍵 |
| `sync` | `null` | 好幾個頁面演同一場：`{ role: 'leader' \| 'follower', channel, url, input, extra, state, follow }`。一個頁面當主控端，其餘的追它的時鐘，從屬端自己不收任何輸入（[見下](#several-pages-one-show)） |

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
| `sound` | `true`、樂器 id（`'piano'`）或 `{ instrument, remember, picker, engine, baseUrl }` | 頁面裡的樂器和選單，用 Tone.js（[聲音](#sound)） |

它回傳 `{ signals, params, stage, timeline, mapper, midi, controllers, midiPanel, keys, drums, sound, audio, hands, pose, chord, remote, score, director, sync, monitor, console, app, loop }`，你沒要的部分是 `null`。同一個物件也掛在 `window.openav`，方便在 devtools 主控台裡查看。每個影格的執行順序寫在[架構](architecture.md#the-frame-loop)。

### 自己驅動影格

預設情況下，演出跑在頁面的 `requestAnimationFrame` 上（分頁被藏起來時，由 Web Worker 心跳接手）。`loop` 讓你改由別人給影格：這樣就能一格一格精確錄影、把整場演出當一個單元測試、或讓它在沒有視窗的機器上跑一整晚，而不必換掉頁面的全域 `requestAnimationFrame` 或 `performance.now`。

```js
// 'manual': nothing runs until you say so. Thirty show seconds, the same thirty every time.
const show = await createShow({ world, loop: 'manual', monitor: false });
show.timeline.play();
for (let i = 0; i < 60 * 30; i++) show.loop.step(1 / 60);

// your own clock and frame pump (a test, a recorder): the show runs on whatever these say
const frames = [];
let now = 0;
const driven = await createShow({ world, loop: { clock: () => now, raf: (cb) => frames.push(cb) } });
now += 1000 / 60;
frames.splice(0).forEach((cb) => cb(now));              // one frame
```

- `'auto'`（或不寫 `loop`）就是演出一直以來的行為。
- `'manual'` 什麼都不排程。`show.loop.step(dt)` 會跑一個完整的影格（[執行順序](architecture.md#the-frame-loop)），長度 `dt` 秒。`dt` 不會被夾到 0.1 秒（那是你自己決定的），`0` 是原地重畫一次，負數或不是數字的 `dt` 什麼都不跑、回傳 `false`。`onFrame` 和 `show.loop.fps` 看到的時間是虛擬的：已經 step 過的 `dt` 的總和，所以步數相同的兩次執行就是同一次執行。第一次 step 之前不會畫任何東西，時間軸也只有在播放中才會前進（`show.timeline.play()`）。
- `{ clock, raf }` 維持自動迴圈，但時間由你供應。`clock()` 回傳毫秒，`raf(cb)` 要求下一格呼叫一次 `cb`，`cb(now)` 可以帶時間戳記（沒帶就讀 `clock()`）。Worker 心跳會關掉，因為真實的計時器不該去推一個假時鐘；`heartbeat: true` 可以重新打開。`maxDt` 對這些影格照樣有效。

交出去的只有影格迴圈。`Date.now`、`setTimeout`、映射器的自動存檔、Web MIDI 和音訊引擎照樣用真實時間，後台推送也是用牆上時鐘自己節流，所以錄影時要把 `loop: 'manual'` 和 `monitor: false` 一起用。自己組裝的演出用 `new Loop(fn, { manual: true })` 做同一件事（[`@openav/core`](packages.md#openav-core)）。

## 時間軸

```js
const timeline = new Timeline({
  params,
  total: 2400,                       // seconds (default 600 when used directly; createShow uses 120)
  automation: {
    growth: [[0, 0.2], [300, 1.0, 'ease'], [1200, 0.4, 'out']],   // [t, value, curve?] keyframes; no curve = linear
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
- 帶 `hold: true` 的場景，播放到它的結尾就停住，直到被放行（Space、→）：見 [Hold](score.md#hold)
- `loop: true` 播到 `total` 就繞回開頭繼續播；`loop: 'scene'` 重複播放頭所在的場景，直到你往下走：見[曲線、loop、cue、錄製](#curves-loop-cues-recording)
- `reset()` 回到 `start`（預設 0，所以 −30 的開演前待命場景要用 scrubber 才到得了。傳 `start: -30`（或 `start: 'first'`，意思是「第一個場景」），按 R 才會回到那裡）
- 帶 `score` 時，場景、總長和起點都從[總譜](score.md)來，這時自動化曲線讀的是 `score.baseTime(t)`，用 `scale: 0.5` 衍生出來的版本會把曲線一起拉伸。曲線也可以改成以段落為單位來寫，這樣換一個長度不同的 cut 也不會失準：見 [Lane](#lanes-curves-written-per-segment)

| 成員 | 作用 |
|---|---|
| `play()`, `pause()`, `toggle()` | 播放控制。停在 hold 時，`play()` 和 `toggle()` 會放行它 |
| `seek(t)` | 跳到第 `t` 秒（下限是第一個場景的負數時間，沒有的話是 0，上限是 `total`） |
| `jumpScene(d)` | 跳到往前或往後 `d` 個場景的開頭 |
| `next()`, `prev()` | → 和 ←：`next()` 在 hold 時會放行（並接著播放），其他時候就是 `jumpScene(1)` |
| `release()` | 放行 hold：下一個場景開始，播放繼續。沒有在 hold 就回傳 `false` |
| `reset()` | 停止、清掉 hold，並倒回 `start`（預設 0） |
| `advance(dt)` | 每個影格呼叫，播放中把 `t` 往前推 `dt × rate` |
| `state(t)`, `valueAt(key, t)` | 某個時間點的自動化數值（不含覆寫） |
| `sceneIndexAt(t)`, `currentScene(t)`, `sceneEnd(i)` | 查詢場景 |
| `onSceneChange(cb)` | 每當播放或 seek 進到另一個場景，就呼叫 `cb(index, scene, { cause })`。`cause` 是 `'play'`、`'release'`、`'seek'`、`'jump'`、`'reset'` 或 `'loop'` |
| `onCue(cb)`、`cues()`、`fireCue(cue)` | 播放經過時觸發的場景 cue、cue 清單，以及手動觸發 |
| `loop`、`onLoop(cb)`、`loopRange()`、`loops` | 讓整段、場景或一段範圍繞回去重播 |
| `record(key, source)`、`stopRecording()`、`onRecord(cb)`、`mergeTake(key, take)` | 把一個數值來源錄進一條 lane |
| `onSeek(cb)` | 播放頭被手動移動時呼叫 `cb(t, kind)`（`'seek'`、`'jump'`、`'reset'`），播放中不會呼叫 |
| `lanePos(t)`, `laneTime(id, p)`, `lanePlan()`, `lanes()` | automation 的秒 ↔（段落 id，段內進度 `p`）、段落表，以及把整份 automation 改寫成以段落為單位 |
| `exportAutomation(opts)`, `importAutomation(doc, opts)` | 把 automation 匯出成純 JSON（用秒或以段落為單位），以及匯入回來 |
| `anchor(epoch, opts)`, `unanchor()`, `drift()`, `onDrift(cb)` | 讀牆鐘：計算演出比牆鐘慢了多少、警告、追回來、準時開演 |
| `layer` | `(key, value, t) => value`：在覆寫之前改寫參數值（導演的 `param()` 就接在這裡） |
| `t`, `playing`, `holding`, `rate`, `total`, `start`, `scenes`, `automation`, `score` | 可讀也可寫的狀態 |

### 曲線、loop、cue、錄製

**曲線。** 關鍵影格寫成 `[t, value, curve?]`。第三項是「抵達這個影格的那一段」怎麼走：`'linear'`（預設，不寫就跟以前一樣）、`'ease'`（慢、快、慢）、`'in'`（起頭慢）、`'out'`（起頭快）、`'step'`（先守住舊值，到影格那一刻才跳），也可以放自己的 0..1 函式。`CURVES` 有匯出。帶 `step` 的參數不論寫什麼曲線都照舊守住。

```js
automation: { speed: [[0, 0.3], [16, 1.6, 'in'], [20, 3.4, 'step'], [30, 0.8, 'out']] }
```

**Loop。** `loop: true` 在 `total` 繞回 0 繼續播；`'scene'` 重複播放頭所在的場景（`next()` 會把循環帶到下一個場景）；寫場景 id 就循環那個場景；`{ from, to }` 循環一段範圍（秒數或場景 id）。它是個屬性，`timeline.loop = !timeline.loop` 就是整個 L 鍵。`onLoop(cb)` 會告訴你每一圈，繞進另一個場景時 `onSceneChange` 的 `cause` 是 `'loop'`。範圍裡的 `hold` 照樣會停住。

**Cue。** `scene.cues` 是 `[{ name, t }]`（控台的時間列本來就把它們畫成小刻度）。`onCue((cue, { cause }) => …)` 在*播放*經過時觸發，一次，而 seek、跳場景、拖時間列、reset 都不觸發：拖著看不算演出。loop 每一圈會再觸發一次。`fireCue(cue)` 可以手動觸發。用[總譜](score.md)時由導演自己觸發 cue；一般的時間軸才用 `onCue`。

```js
show.timeline.onCue((cue) => show.params.firePulse(cue.name));   // scenes: [{ …, cues: [{ name: 'flash', t: 20 }] }]
```

**錄製。** `record(key, source)` 把一條 lane 設為待錄。時間軸播放時，每個影格讀一次 `source()`：回傳數字就寫進一段 take，回傳 `null` 表示沒人在碰，這一段就收尾。

```js
timeline.record('hue', () => params.isOverridden('hue') ? params.overrides.hue : null);
timeline.onRecord(({ key }) => params.clearOverride(key));      // the curve takes over again
```

暫停、seek、reset、hold、整場結束、loop 每圈結尾，也都會收尾一段 take，錄製器本身保持待命，直到 `stop()` 或 `stopRecording()`。合併規則（`mergeTake()`）：先把 take 抽稀（數值動了超過該參數範圍的 0.6%，或隔了 0.5 秒，才留下），再用它**取代它時間範圍內的既有影格**。範圍外的影格原封不動，所以 lane 會從前一個影格滑向 take 的第一點，再從 take 的最後一點滑向下一個影格；範圍外既有的曲線種類不會變。有 score 時，影格寫的是基準版本的時間，跟你宣告的那些一樣。

cue（換場時要觸發的燈光、音效等提示）清單，寫起來就是一個換場處理函式：

```js
show.timeline.onSceneChange((i, scene) => {
  if (scene.id === 'storm') show.stage.activate('storm');   // switch worlds
  show.midi?.cc(20, i, 16);                                  // tell the lighting desk
});
```

### Lane：以段落為單位寫曲線

有[總譜](score.md)時，演出是一串長度會改變的段落，而用絕對秒數寫的曲線，只要其中一段變長就失準了。改成把曲線寫在段落上。某個 key 的 automation 可以是一個物件：key 是段落 id，值是關鍵影格 `[p, value, curve?]`，`p` 是這一段走了多少，0 到 1。

```js
const show = await createShow({
  world,
  score: { cuts, cut: 'full' },
  timeline: { automation: {
    haze: { dawn: [[0, 0.1], [1, 0.4, 'ease']],                  // dawn: 0.1 → 0.4, slow-fast-slow
            noon: [[0, 0.4], [0.6, 0.9], [1, 0.5, 'out']],
            dusk: 0.5 },                                           // a number holds the whole segment
    speed: [[0, 0.3], [30, 1.2], [120, 0.4]],                      // absolute seconds still work, in the same object
  } },
});
```

一個點 `[p, v, curve]` 就是關鍵影格 `[段首 + p × 段長, v, curve]`，沒有別的規則：時間軸在建立時就把每條 lane 編譯好，`timeline.automation` 裡放的是一般的絕對秒數影格，所以 `valueAt`、錄製、`mergeTake` 和控台的行為都跟以前一樣。

- **任何 cut。** lane 是對著總譜的*基準 cut*（衍生 cut 的來源）編譯的。長度不同的 cut 會用自己的長度讀同一條 lane，所以 `(dawn, 0.5)` 在每個 cut 裡都是 dawn 走到一半；衍生 cut（`from` + `scale`）會像絕對秒數影格一樣被拉伸。差別在結構、不只在長度的兩個 cut，也可以共用同一條 lane。
- **接縫。** 一段的最後一點和下一段的第一點之間，數值像任何兩個影格之間一樣滑過去（用抵達那一點的曲線）。要無縫，就在 `p: 1` 和下一段的 `p: 0` 寫同一個值。同一個時刻有兩個不同的值，就是跳變。
- **這個 cut 沒有的段落。** 總譜裡別的 cut 有、這個 cut 沒有的 id 會被略過，所以一條 lane 可以同時服務少一段的 cut。任何 cut 都沒有的 id（多半是打錯字）會丟錯，訊息寫明 key 和 id；`p` 超出 0…1 或順序倒退也會丟錯，寫明 key、段落和第幾個點。
- **沒有總譜時**，場景就是段落：一個場景持續到下一個場景開始。

### 存取 automation

`record()` 把一段 take 寫進記憶體裡的 `timeline.automation`。要留下來，就匯出成純 JSON，之後再匯入這條時間軸或另一條：

```js
const doc = timeline.exportAutomation({ as: 'segments' });           // lanes per segment: still right on another cut
localStorage.setItem('automation', JSON.stringify(doc));
// later:
timeline.importAutomation(localStorage.getItem('automation'));        // a string or the object
```

```json
{ "format": "openav-automation", "version": 1, "cut": "full", "as": "segments",
  "automation": { "haze": { "dawn": [[0, 0.1], [1, 0.4, "ease"]], "noon": [[0, 0.4], [1, 0.5]] } } }
```

`exportAutomation({ keys, as, precision })` 回傳一份拷貝。`as: 'seconds'`（預設）把每個 key 寫成基準 cut 秒數的影格；`as: 'segments'` 把每個 key 寫成 lane，`p` 四捨五入到 `precision` 位小數（預設 9，`null` 則保留所有位數）。兩者互為反函數：lane 編譯回來是同一條曲線。落在演出之外的影格沒有所屬的段落，只能匯出成秒數；曲線是函式的影格根本寫不進 JSON：兩種情況都會丟錯，訊息寫明是哪個 key。`cut` 是基準 cut 的 id。

`importAutomation(doc, { keys, replace, ignoreCut })` 吃這份檔案，或一張光溜溜的 `{ key: 影格 | lane }`。檔案裡有的 key 會被換掉（`keys` 可以再縮小範圍；`replace: true` 連檔案沒提到的 key 也一併清掉）。它是全有或全無：有任何一個 key 壞了，就什麼都不會變。秒數屬於它被寫下時的 cut，所以 `cut` 和這條時間軸的基準 cut 不同的檔案會被拒絕（`ignoreCut: true` 可以蓋過）；lane 不綁 cut。

底層的換算是公開的。`lanePos(t)` 回答某一秒的 `{ id, index, p }`（演出之外是 `null`；段界屬於從那裡開始的那一段），`laneTime(id, p)` 回答那一秒，`lanePlan()` 是段落表，`lanes()` 是以段落為單位寫的整份 automation。它們用的是 *automation 的秒*，也就是 `timeline.automation` 裡和 `onRecord` 的 `from`/`to` 用的那種。要換算播放頭本身的演出秒，用總譜：`score.locate(T)` 和 `score.timeAt(id, p)`（[Score](score.md#the-score)）。純函式 `compileLane`、`decompileLane`、`lanePos`、`laneTime` 也有匯出，給手上有段落表 `[{ id, start, end }]`（`score.rootSegments`）、沒有時間軸的工具用。

### 牆鐘：anchor 與 drift

影格迴圈把 `dt` 夾在 0.1 秒（[架構](architecture.md#the-frame-loop)）。頁面卡了半秒，演出只走 0.1 秒，就比牆鐘慢了 0.4 秒。短的演出沒人會發現；一整晚的裝置，卻沒有人在場看它到底漏了多少。`anchor()` 讓時間軸在每個播放中的影格讀牆鐘（`Date.now`，毫秒），比較牆鐘走了多久、演出走了多少。不呼叫就什麼都不會發生：沒有錨定的時間軸從來不讀鐘。

```js
timeline.anchor();                                                       // count only (mode 'warn')
timeline.anchor(Date.parse('2026-10-24T20:00:00+08:00'), { mode: 'catch-up' });   // start at 20:00 sharp, and stay on the clock
timeline.drift().text;   // "0.42 s behind the wall clock · 7 stalls cost 1.30 s (worst gap 0.52 s) · caught up 0.88 s"
createShow({ world, timeline: { total: 120, anchor: { mode: 'catch-up', jump: 5 } } });   // the same, from the options
```

`anchor(epoch?, opts)`：`epoch` 是演出時間 0 對應的牆鐘時刻，可以是毫秒、`Date` 或 ISO 字串。不給的話，第一個播放的影格就是時間 0：沒有什麼可以遲到，只計算那之後的停頓。

| 選項 | 預設 | 意義 |
|---|---|---|
| `mode` | `'warn'` | `'warn'` 只計數和通知，絕不動 `t`。`'catch-up'` 把漏掉的追回來，超前時則等牆鐘 |
| `warnAt` | 1 | 慢了幾秒時 `onDrift` 收到 `'behind'`（沒人聽就 `console.warn`）；降到一半以下收到 `'recovered'` |
| `tolerance` | 0.05 | `'catch-up'`：欠得比這少就不補 |
| `jump` | 10 | `'catch-up'`：欠超過這麼多秒，用一次 seek 補上（cue 不會觸發，跟 seek 從不觸發 cue 一樣），不邊播邊追 |
| `wait` | true | `'catch-up'`：`epoch` 在未來時，演出站著不動（播放中但不前進）等到那一刻 |
| `stall` | 0.02 | 牆鐘時間比 `dt` 長超過這麼多秒的影格算一次停頓（只影響計數） |
| `now` | `Date.now` | 時鐘，單位毫秒；測試或手動迴圈用的假時鐘，傳同一個進來 |
| `onDrift` | 無 | `'behind'`、`'recovered'`、`'jump'` 時呼叫 `cb({ kind, …drift() })`；`timeline.onDrift(cb)` 可以再加 |

`'catch-up'` 做的事：把差額加進那一個影格的步長，所以 cue、hold 和 loop 都跟正常播放一樣（hold 照樣會把演出停住）。過去的 `epoch` 就是晚到的開演：為了 20:00 開演的節目，在 20:07 重開機的那台機器，會直接落在第七分鐘。暫停、hold 和演出結束，都是演出刻意停下來，不算漂移：停下來那一刻欠的帳一筆勾銷（`forgiven`），從演出停住的位置重新計。超前於牆鐘（`behind` 為負）時，`'warn'` 只回報；`'catch-up'` 會把演出慢下來等牆鐘（`held`）：只會等，不會倒退，這也抵銷了卡頓之後 Loop 的心跳多補的那個 0.1 秒影格。`reset()` 讓計數重來；還在未來的 `epoch` 會留著。

`drift()` 沒有錨定時回傳 `null`，否則回傳 `behind`（比牆鐘慢幾秒，負數 = 超前）、`lost`（Loop 夾 dt 或任何停頓吃掉的）、`repaid`、`held`、`forgiven`、`stalls`、`worst`（兩個影格之間最長的牆鐘間隔）、`frames`、`jumps`、`started`、`waiting`、`startsIn`、`epoch`、`mode`，以及 `text`：給導演台或後台看的一行摘要。如果你是用手動或測試用的迴圈在推時間軸，記得把同一個假時鐘當成 `now` 傳給 `anchor()`，不然它量的是真實時間。

### 追另一條時鐘：follow

時間軸可以不自己往前走，改去追另一條時間軸的時鐘。這是[好幾個頁面演同一場](#several-pages-one-show)裡時間軸的那一半：主控端（leader）在跑，從屬端（follower）跟著。來源可以是任何能回答「主控端現在在哪」的東西：`@openav/sync` 的從屬端、一段錄下來的紀錄、測試用的假主控端。不呼叫 `follow()` 就什麼都不會發生：從來不追的時間軸，行為跟以前一模一樣。

```js
timeline.follow(follower, { jump: 0.5, lostAfter: 4 });   // follower: anything with latest() (or a function () => frame)
timeline.followStatus().text;   // "0.012 s behind the leader · worst 0.140 s · 1 jump"
timeline.unfollow();            // the timeline walks by itself again, on the rate it had before follow()
```

`follow(source, opts)`。來源回答主控端的最後一則 frame，`{ T, playing, holding, rate, at }`：`T` 是主控端送出這則 frame 那一刻的時間，`at` 是這則 frame 到達這裡的時刻（毫秒，和 `now` 同一個鐘；不給就當作此刻剛到）。還沒聽到任何人時回答 `null`。從屬端每一幀都算出主控端「現在」在哪：`T`，加上從 `at` 到現在的時間乘 `rate`（主控端暫停或停在 hold 時不外插），再加 `latency`。

| 選項 | 預設 | 意義 |
|---|---|---|
| `nudge` | 0.05 | 追趕的時候，`rate` 是主控端的 rate 乘 1 ± 這個數：落後 0.3 秒的從屬端大約六秒追上，沒有人看得到跳動 |
| `deadband` | 1/60 | 差不到一幀就不管。超過才開始推 rate，追到剩一半才放手，所以不會在邊緣上抖 |
| `jump` | 0.5 | 差超過這麼多秒，就一次 `seek(T, 'seek')`：`onSeek` 聽得到，cue 不會觸發 |
| `lostAfter` | 4 | 這麼多秒沒收到 frame，就當主控端不見了；`Infinity` 是永遠等 |
| `latency` | 0 | frame 在路上花的秒數，數字或函式。不同機器的頁面要自己設（例如來回時間的一半） |
| `now` | `source.now`，否則 `performance.now` | 時鐘，毫秒；來源蓋 `at` 用的那一個 |
| `onFollow` | 無 | `cb({ kind, …followStatus() })`，`kind` 是 `'found'`、`'lost'`、`'jump'`；`timeline.onFollow(cb)` 可以再加 |

從屬端從主控端複製的有：**rate**、**暫停**（從屬端停在主控端正確的 `T` 上）和 **hold**。主控端停在 `hold` 場景結尾時，從屬端自己走到邊界、自己停下來（路上它自己的 cue 和場景切換照常觸發）；要等主控端的 `T` 過了邊界才放手，所以邊界前一刻的舊 frame 放不掉先到的從屬端。循環的演出會跟著繞過圈尾，走比較近的那個方向。主控端才是時鐘：追的時候，從屬端自己的 `play()`、`pause()`、`seek()` 和 `rate` 都會被下一幀蓋掉，`anchor()` 也讓到一邊，直到 `unfollow()`。

超過 `lostAfter` 秒沒有 frame 進來，從屬端就**自己往前走**，用它最後拿到的 rate，跟不追的時間軸一模一樣（暫停中的從屬端就維持暫停）。`followStatus().lost` 變成 true，`onFollow` 聽到 `'lost'`（沒人接就 `console.warn`）。主控端回來，從屬端就接回去（`'found'`）。一個人都還沒聽到的時候它會等（`state: 'waiting'`），過了 `lostAfter` 秒也照樣自己走。

`followStatus()` 在時間軸沒有在追時回傳 `null`，否則回傳 `state`（`'waiting'`、`'tracking'`、`'lost'`）、`error`（主控端的 `T` 減我們的，秒；正數 = 我們落後）、`worst`（第一次追上之後最大的 `|error|`）、`jumps`（seek 的次數）、`silence`（距離上一則 frame 幾秒）、`lost`、`lostCount`、`lostAfter`、`heard`、`frames`、`nudging`（-1、0 或 1）、`rate`、`leaderRate`、`leaderT`、`leaderPlaying`、`leaderHolding`，以及 `text`：給導演台或後台看的一行摘要。數字是最後一幀的。

## 控台

`mountConsole(el, app, { layers, signals, keys })`（`@openav/console`）會做出導演控台，`createShow()` 把它掛在側邊面板。`app` 就是 `createShow()` 回傳的 `show.app`（`timeline`、`params`、`mapper`、`signals`、`stage`、`midi`、`sound`、`audio`、`hands`、`pose`…），缺了哪個部分，對應的區塊就不顯示。傳入 `{ layers: false }` 或 `{ signals: false }`，可以拿掉那些面板。控台上有播放控制，以及一條標出場景區段、可以拖曳的時間列。各層的面板有 Layers（各層總覽）、L1 Input（輸入）、L2 Mapping（映射）、L3 Params（參數，滑桿附覆寫與 learn 小按鈕）、L4 sound（聲音）。另外還有即時訊號儀表和 MIDI 紀錄。

鍵盤：**Space** 播放／暫停（停在 hold 時：放行）· **→/←** 下一個／上一個場景（停在 hold 時，**→** 放行）· **R** 重設 · **T** 演出模式 · **F** 全螢幕 · **M** 螢幕 MIDI 控制器（`midi.controllers`）· **Esc** 離開鍵盤鋼琴的捕捉，或結束對應精靈。在輸入欄位裡打字、按住不放的連發，以及 ⌘/Ctrl/Alt 組合鍵，都不會觸發這些快捷鍵。螢幕鋼琴捕捉鍵盤的時候，*字母鍵*歸鋼琴（T 和 F 本來就是琴鍵），所以 R、T、F、M 沒作用，要取消勾選或按 Esc 才恢復。Space 和方向鍵永遠有效。

### 挪動快捷鍵

把電腦鍵盤當鋼琴彈的演出，會想把字母鍵要回來。`keys` 把每個動作對應到一個鍵（或一串鍵），疊在預設值上面；某個動作設 `false` 就關掉它，`keys: false` 則關掉所有快捷鍵。

```js
// the piano owns the letters: move the desk's R, T, F and M to keys it does not use
await createShow({
  world,
  modules: { keys: { capture: true }, midi: { controllers: true } },
  console: { keys: { reset: 'F6', perf: 'F7', fullscreen: 'F8', midi: 'F9' } },
});
```

| 動作 | 預設 | 作用 |
|---|---|---|
| `play` | `Space` | 播放／暫停（停在 hold 時：放行） |
| `next`、`prev` | `ArrowRight`、`ArrowLeft` | 下一個／上一個場景（停在 hold 時，`next` 放行） |
| `reset` | `R` | 回到開頭，並讓被停用的段落模組恢復 |
| `perf` | `T` | 演出模式 |
| `fullscreen` | `F` | 全螢幕 |
| `midi` | `M` | 螢幕 MIDI 控制器面板 |
| `cancel` | `Escape` | 結束對應精靈，或離開鍵盤鋼琴的捕捉 |

鍵寫成字串。`'r'` 是字元（大小寫都算）；`'KeyR'` 是實體按鍵，不管鍵盤配置在那個位置打出什麼字（注音配置會打出 ㄐ）；`'F6'`、`'Backquote'`、`'ArrowUp'`、`'Space'` 是 `KeyboardEvent.code` 或按鍵名稱，大小寫不拘。`'Shift+T'`、`'Ctrl+K'`、`'Alt+…'`、`'Meta+…'` 可以加修飾鍵：寫法裡沒有 `Ctrl`、`Alt`、`Meta` 的時候，這三個鍵不能被按著（⌘R 和 Ctrl+F 仍然歸瀏覽器），單純的字母則不管 Shift。鋼琴捕捉鍵盤的時候，字母鍵（a–z 和 `;`）不管你把動作放在哪裡都不作用；`F6`、`Backquote` 這類鍵則照常有效。動作名稱不認得，或鍵的寫法不對，會在掛載任何東西之前丟出錯誤。控台上的提示（播放鈕的說明文字、HOLD 橫幅、提詞機）會印出你選的鍵，`show.console.keys` 也存著這份設定。自己呼叫 `mountConsole` 的時候，若傳入 `app.midiPanel`，`midi` 鍵就會切換它。

有總譜的時候，控台還多了導演台面板、scrubber 上的 cue 刻度，以及顯示操作者 acts 的提詞機（[總譜與導演](score.md#the-desk)）。L2 Mapping 面板有 **🎛 map knobs in order**，這個精靈會依序替每個參數啟動 learn（[細節](score.md#map-the-knobs-in-order)）。

覆寫的規則：一碰滑桿（或有映射的控制項），那個參數就脫離時間軸，直到你按 ✕ 清掉覆寫。標籤變黃 = 已覆寫。

## 演出模式

按 **T** 切到全螢幕的提詞畫面：目前場景的標題和備註，用站在舞台上也看得清楚的大字顯示，另外有操作者要做的事（場景的 `acts`）、下一個場景的預覽、時鐘和場景倒數、演出在等你時的 HOLD 橫幅，以及段落模組被停用時的警告。這是給*演奏者*看的。給觀眾看的，是你按 **F** 開成全螢幕的舞台。同一個頁面開兩個視窗，一個當控台，一個當舞台。

## 後台監看

```bash
node packages/monitor/server.js       # on the performance machine (npm run monitor)
# stage manager's phone/laptop: http://<performance-machine-ip>:7457/
```

每個用 `createShow()` 做的演出頁面，大約每秒 15 次把快照串流到 `ws://<the page's host>:7457`，所以監看伺服器要跑在提供演出頁面的那台電腦上。後台即時顯示時鐘、場景、世界、FPS、覆寫、所有訊號和參數。舞台 4 秒沒有傳來資料，就會跳出紅色的「stage feed lost」（舞台連線中斷）橫幅，這時候就輪到舞台監督出手。不用設定，沒有相依套件，兩端都會自己重新連線。`GET /health` 回應 `{ ok, clients }`。

監看伺服器沒在跑時，演出頁面會一直重試，間隔從大約 5 秒拉長到 30 秒。瀏覽器會記下每一次被拒絕的連線，這些訊息是預期中的。

不需要後台的機器，或是中繼架在別處，都是 `createShow()` 的選項：

```js
await createShow({ world, monitor: false });                                  // no backstage feed, no socket
await createShow({ world, monitor: { url: 'wss://stage.example.com/monitor', hz: 10 } });   // another relay
```

`monitor: false` 不會建立推送（`show.monitor` 是 `null`），頁面也不會開任何 socket。`{ url, hz }` 交給 `MonitorFeed`：一個 `ws://` 或 `wss://` 位址（`null` 會做出一個永遠不連線的推送），以及每秒送幾次快照（預設 15）。架在 TLS 後面的中繼要用 `wss://` 位址，中繼本身仍然聽在你啟動它的埠（`node packages/monitor/server.js 7460`）。

如果演出是你手動組起來的：

```js
import { MonitorFeed, snapshotOf } from '@openav/monitor';
const monitor = new MonitorFeed({ url: 'ws://192.168.1.20:7457', hz: 15 });   // both optional
monitor.connect();
// every frame:
monitor.frame(snapshotOf({ timeline, params, signals, stage, loop }, state));
```

### 作品自己的數字

作品可以把自己的健康數字送上後台頁面：模擬跑到第幾個 tick、跟牆上時鐘差了多少、攔到幾次 NaN。這些數字以 `snapshot.extra` 送過去，顯示在一個 **Work** 面板裡；什麼都沒送時，面板是隱藏的。不送的演出，送出的快照跟以前完全一樣。

```js
// 1. from the world: snapshotOf asks the active world, so a createShow() show needs no wiring
const world = { name: 'lanterns', params: [/* … */], update() { /* … */ },
  monitor() { return { 'sim/tick': sim.tick, 'sim/drift': { v: sim.drift, min: 0, max: 0.5, warn: sim.drift > 0.2 } }; } };

// 2. from a hand-assembled show: on the feed (asked only when a frame is sent) …
const off = monitor.extra(() => ({ 'sim/nan': nanCount }));          // off() takes it away again
// … or in the snapshot itself (an object, or a function answering one)
monitor.frame(snapshotOf({ timeline, params, signals, stage, loop, extra: { build: 'rehearsal-2' } }, state));
```

一個值可以是數字、字串（最長 80 字）、布林或 `null`。寫成 `{ v, min, max, warn }` 的話，有 `min` 和 `max` 就會畫量條，`warn: true` 會讓那一列變紅。名稱最長 48 字，一份快照最多 64 個欄位。JSON 帶不走的東西（`NaN`、BigInt、函式、巢狀物件）會被丟掉或變成 `null`，所以一個壞數字不會讓整幀送不出去；丟出錯誤的提供者會被略過。`monitor()` 和函式形式的 `extra` 每個影格都會被問一次，`monitor.extra(fn)` 只在真的送出一幀時才問（大約每秒 15 次），比較耗時的量測請放在那裡。同一個名稱有兩個來源時，`extra` 蓋過世界，後掛的 `monitor.extra` 蓋過先掛的。

## 好幾個頁面，一場演出

三顆輸出拼成的一面牆、舞台加大廳、排練的筆電放在演出筆電旁邊：一場演出，好幾個頁面。其中一個頁面是**主控端**（leader）：它跑時間軸、收輸入，每一幀說出自己在哪。其餘是**從屬端**（follower）：它們的時間軸追主控端的 `T`（[follow](#following-another-clock-follow)），所以每個頁面顯示的都是同一場演出的同一個瞬間。每個頁面用同一份程式碼，只有 `role` 不同：

```js
const role = location.hash === '#follow' ? 'follower' : 'leader';
const show = await createShow({
  world, score: { cuts, modules },
  sync: { role, channel: 'hall' },               // pages of one browser on one machine: a BroadcastChannel, no network
  // sync: { role, channel: 'hall', url: 'ws://leader.local:8080/relay' },   // pages on other machines: the room relay
});
```

| `sync` 的 key | 預設 | 意義 |
|---|---|---|
| `role` | 必填 | `'leader'` 或 `'follower'` |
| `channel` | 必填 | BroadcastChannel 的名稱，也是 relay 的房間名：1–32 個字母、數字、`-` 或 `_`。同一個 channel 的頁面就是同一場演出 |
| `url` | 無 | 不給：用 `BroadcastChannel`（同一個瀏覽器設定檔、同一個來源的頁面）。`true`：本頁自己的 `/relay`（`node serve.js` 會架）。`'ws://host:port/relay'`：那台機器上的 relay |
| `input` | 主控端 `true`、從屬端 `false` | 這個頁面要不要有自己的輸入。沒有的話，會產生輸入的模組都關掉：`keys`（鍵盤鋼琴）、`midi`、`drums`、`audio`、`hands`、`pose`、`leap`、`remote`。其他的由你決定 |
| `follow` | `{}` | 從屬端：[`timeline.follow()`](#following-another-clock-follow) 的選項（`jump`、`lostAfter`、`latency`、`nudge`、`onFollow`） |
| `extra`、`state` | 無 | 主控端：跟著時鐘一起走的資料（見下） |
| `info`、`accept`、`onFrame`、`onState`、`onGap` | 無 | 從屬端：掛鉤與檢查（見下） |
| `hz` | 每幀 | 主控端：每秒最多送幾幀；狀態改變（播放、暫停、hold、rate、seek）的那一幀會馬上送 |
| `id`、`now` | 隨機、`performance.now` | 對等端的 id 與時鐘 |

**傳輸。** 同一台機器上，頁面之間走 `BroadcastChannel`：不用網路，也不用另外跑任何東西。瀏覽器只會連通同一個來源、同一個設定檔的頁面，所以主控端和從屬端要從同一個網址打開。跨機器的話，它們用 `role=leader` 和 `role=follower` 加入[房間中繼](remote.md#the-relay)的房間；主控端那台機器跑 `node serve.js` 就夠了（`url: 'ws://<那台機器>:8080/relay'`）。用 https 提供的頁面要用 `wss://` 位址（瀏覽器擋掉那裡的 `ws://`）。中繼沒有身分驗證：請用封閉的網路，以及沒人猜得到的 channel 名（[安全性](remote.md#security)）。兩種傳輸送的是同一份 JSON，所以換傳輸時作品不用改。

**訊息。** 兩種傳輸都一樣；`seq` 是主控端送出的 frame 的編號。

```text
{ v:1, kind:'frame', src, seq, T, playing, holding, rate, cut?, extra? }      leader → followers, every frame
{ v:1, kind:'hello', id, role:'follower', info?, reason? }                    follower → leader: "I am here, where are we?"
{ v:1, kind:'state', src, seq, to, T, playing, holding, rate, cut?, extra? }  leader → that follower
```

從屬端一上線就說 `hello`，之後每秒再說一次，直到拿到 `state`；`seq` 出現缺口、沉默一段時間之後、以及連線重連時也會再說。主控端回一則 `state`，所以中途加入或重新載入的頁面，第一幀就落在演出的現在。`cut` 是總譜的版本 id：從屬端的版本和主控端不同（長度不同，`T` 的意思就不同）時，會拒收它的 frame，後台會顯示 `refused: cut …`。

**帶作品自己的資料。** 凡是要跟著時鐘一起走的東西（操作員設的覆寫值、一個音符、被跳過的開場）都放在 `extra`。框架把它送到、每則一次、依序，從來不讀它。

```js
sync: {
  role: 'leader', channel: 'hall',
  extra: () => ({ build: BUILD, events: takeNewEvents() }),   // asked once per frame sent; return undefined for "nothing"
  state: (hello) => ({ build: BUILD, tape: wholeTape }),       // asked when a follower says hello: all a late joiner needs
}
sync: {
  role: 'follower', channel: 'hall',
  onFrame: (msg) => appendEvents(msg.extra.events),            // every frame, in order, each one once
  onState: (msg) => loadTape(msg.extra.tape),                  // on joining, and again after anything went missing
  accept: (msg) => msg.extra?.build === BUILD || 'build differs',   // false or a string refuses this leader
  info: { build: BUILD },                                      // arrives with every hello
}
```

一則 frame 不見了（連線斷了一下），在 `seq` 上就是一個缺口：從屬端通知 `onGap`、再要一次 state，由 state 補上漏掉的東西。中繼預設會丟掉超過 256 KB 的訊息；帶著整捲磁帶的 `state` 需要 `attachRelay(server, { maxMessageChars, maxBytes })`。

| 發生什麼事 | 從屬端怎麼做 |
|---|---|
| 它重新載入，或中途加入 | `hello`，然後收到 `state`：第一幀就落在主控端的 `T` |
| 掉了一則 frame，或連線斷掉又回來 | 回報 `seq` 的缺口，再要一次 state |
| 主控端安靜了 | 過了 `lostAfter` 秒（4）就自己用最後的 rate 往前走；`followStatus().lost` 和 monitor 裡的 `sync/lost` 變紅 |
| 主控端回來，或手動把另一個頁面升成主控端 | 安靜了 1.5 秒的主控端可以被另一個取代；從屬端換過去並重新同步 |
| 同時有兩個主控端 | 它守著先聽到的那個；另一個算進 `ignored` |
| 主控端用的是別的版本（cut） | 拒收，什麼都不動 |
| 從屬端漂移 | 不會累積：每一幀都對主控端的 `T` 量，不是對從屬端自己的時鐘 |

**這一套沒做的事。** frame 帶的是主控端的 `T`，不是牆上時鐘的時刻，而且 `latency` 要你自己設：跨機器時，從屬端大約會落後一趟路程的時間，除非你告訴它。沒有選舉：要升一個從屬端，就是在舊主控端不見之後，用 `role: 'leader'` 載入它。頁面之間共用的是*時間*。會積分 `dt` 的世界（殘影、粒子系統）在 `T` 相同的兩個頁面上不會長得一樣，除非要一致的東西都寫成 `T` 的函式。在後台，有同步的頁面會在 monitor 的 Work 面板多出 `sync/…` 這幾個數字（role、error、silence、lost、jumps）。

不用 `createShow` 的話：`@openav/sync` 的 `createSync({ role, channel, url, timeline })` 組出同樣的東西；每個影格在 `timeline.advance(dt)` 之後呼叫 `sync.frame()`（[`@openav/sync`](packages.md#openav-sync)）。

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

### TouchDesigner 當接收端

OSC 照上面的方式送進 TouchDesigner。TouchDesigner 也可以用 Web Render TOP 把 open-audiovisual 的頁面當成畫面，它把網頁畫在同一台機器的 TouchDesigner 裡（[Web Render TOP](https://docs.derivative.ca/Web_Render_TOP)）。Web Render TOP 支不支援 Web MIDI 或 WebGPU，我們還沒有驗證。控制請維持走 OSC。

頁面如果來自 openaudiovisual.com，Chrome 會先問，才讓頁面連到 `127.0.0.1` 上的橋接：見[Chrome 跳出「區域網路」的詢問](troubleshooting.md#chrome-asks-about-the-local-network-or-about-apps-on-this-device)（[Chrome 部落格](https://developer.chrome.com/blog/local-network-access)）。跑 `node serve.js`、從 `http://localhost:8080` 打開頁面，就不會跳出詢問。


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

**熱插拔。** 演出中拔掉一條線，不能讓 DAW 一聲不響、什麼提示都沒有。目前的輸出被拔掉時，`Midi` 會換到次佳的可用埠：先找你用 `selectOutput()` 或 `enable(name)` 選的那個，再找 `prefer` 清單（`new Midi({ prefer: ['IAC'] })`）裡第一個符合的，最後是第一個埠。你選的那個埠重新插上，輸出就換回去。無關的裝置冒出來，永遠不會把輸出搶走。每換一次，MIDI 紀錄（Signals 面板，經由 `midi.onMessage`）和瀏覽器 console 各印一行，MIDI 控制器面板會閃一下，L1 Input 面板的 `MIDI out →` 那一列也會更新。程式裡可以用 `midi.onOutput(({ text, reason }) => …)` 接。

**回音。** 送進虛擬匯流排的訊息，不能又被當成輸入收回來。名稱符合 `filterOut`（預設 `IAC`，macOS 的那條匯流排）的輸入永遠不會被聆聽。另外，任何輸入上，在 `echoWindow` 毫秒內（預設 40，`0` 就關掉）收到一則和剛送出的完全相同的訊息，就當作回音丟掉，每送出一則只抵消一則。`midi.echoDropped` 會計數。

要讓外部程式跟著演出走，用 `ScoreMidi` 把總譜的段落切換和 cue 當成 note 與 CC 送出（[Score to MIDI](score.md#score-to-midi)）。

## 聲音

`modules: { sound: true }` 會加入 `Sound`（`@openav/sound`），用的是 Tone.js 引擎。瀏覽器要等使用者點一下才會開始播放音訊，所以控台會在 *L4 · Output — sound*（聲音輸出）面板放一個 **🔊 enable sound**（開啟聲音）按鈕，下面是選樂器的選單。開啟之後，選好的樂器就會跟著每個 `midi/note/on` 和 `midi/note/off` 彈，不管是誰送的（MIDI 鍵盤、電腦鍵盤鋼琴、模擬演奏者、手機）。Tone.js（15.0.4）要等開啟聲音時才從 jsDelivr 載入。

```js
await createShow({ world, modules: { sound: true } });       // the warm pad, as before
await createShow({ world, modules: { sound: 'piano' } });    // start on the grand piano
await createShow({ world, modules: { sound: { instrument: 'synth/pluck', remember: false, picker: false } } });
```

### 樂器

| id | 聲音 | 怎麼做的 |
|---|---|---|
| `piano` | 平台鋼琴 | Salamander Grand Piano 取樣：30 個音檔（每個八度的 A、C、D♯、F♯），共 2.0 MB，選到才載入 |
| `epiano` | 電鋼琴 | 兩組 FM 加上立體聲顫音 |
| `xylophone`、`marimba`、`vibraphone`、`glockenspiel`、`music-box` | 木琴、馬林巴、顫音琴、鐵琴、音樂盒 | 模態合成：照每種琴鍵自己的泛音比例，疊幾個會衰減的分音，再加上琴槌敲下去的那一聲 |
| `strings` | 弦樂合奏 | 幾個音高略為錯開的鋸齒波、像拉弓的起音、合唱效果、抖音 |
| `harp` | 撥弦 | Karplus–Strong |
| `organ` | 音栓風琴 | 九根音栓合成一個加法波形，再加上旋轉喇叭的顫音 |
| `choir` | 合唱襯底 | 鋸齒波穿過母音的共振峰 |
| `synth/pad` | 溫暖襯底 | 原本的音色，仍然是預設 |
| `synth/saw-lead`、`synth/square-lead`、`synth/pluck`、`synth/supersaw`、`synth/bass`、`synth/acid`、`synth/brass`、`synth/bell`、`synth/sub`、`synth/chip` | 合成器音色 | 同一台複音合成器，音色寫成資料 |

鋼琴取樣是 Alexander Holm 錄製的 *Salamander Grand Piano*，授權是 [CC-BY 3.0](https://creativecommons.org/licenses/by/3.0/)。選單會在鋼琴旁邊列出這行出處，公開演出用到它時，也要標上出處。音檔放在 `packages/sound/samples/salamander/`。萬一載不進來，鋼琴會改用電鋼琴彈，不會變成一片安靜。

### 選聲音

可以在控台上選，也可以寫在程式裡：

```js
await show.sound.setInstrument('organ');   // true once it plays
show.sound.instrument;                     // 'organ'
show.sound.onChange((e) => console.log(e.type, e.id, e.progress));   // instrument · loading · ready · error
show.timeline.onSceneChange((i, scene) => {
  if (scene.id === 'chorale') show.sound.setInstrument('organ');      // a cue may switch instruments
});
```

邊彈邊換樂器時，舊樂器上還按著的音會先放開，不會有音卡住。取樣樂器在音檔載完之前，會繼續用舊的聲音彈，選單上看得到載入進度。每換一次，也會發出一個 `sound/instrument` 脈衝訊號（`{ id, name }`）。選單上最後一次的選擇會記在這個頁面，下次打開時會沿用，就算程式裡宣告了別的樂器也一樣。不想要這樣，就設 `remember: false`。

樂器是一個離散的選擇。要連續演奏的東西仍然是參數：引擎的參數會併進演出的參數，放在 `sound/` 底下。`sound/cutoff`（100–8000 Hz，預設 2500）、`sound/space`（殘響的 wet 比例，0–1，預設 0.3）和 `sound/volume`（−36–0 dB，預設 −8）是所有樂器共用的，所以一顆旋鈕、一隻手或樂譜，演奏濾波器的方式就跟演奏畫面一樣。樂器可以建議自己的起始值（鋼琴會把濾波器開到 8000 Hz），也可以加上自己的旋鈕，它在彈的時候控台才會顯示：風琴的 `sound/drawbars` 和 `sound/rotor`，弦樂的 `sound/attack` 和 `sound/vibrato`，合唱的 `sound/vowel`，電鋼琴和顫音琴的 `sound/tremolo`。自動化和手動覆寫永遠比建議的起始值優先。延音踏板（`midi/cc/64`）對每種樂器都有效，會先留住放開的音。MIDI 第 10 頻道的音（鼓機送的）留給鼓組引擎，這裡不彈。

### 加入自己的樂器

一個可以選的聲音就是一個檔案：一些資料，加上一個 `create(Tone, ctx)`，回傳 `noteOn`、`noteOff` 和 `dispose`。在 `createShow()` 之前 import 這個檔案，每個選單就會列出它，`packages/*` 完全不用改。

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

id 重複會丟出錯誤，真的要換掉時，寫 `registerInstrument(def, { replace: true })`。可以選填的欄位有：`defaults`（`cutoff`、`space`、`volume` 的起始值）、`credit`（出處）、`gain`（dB）、`transpose`（半音）、`fallback`（載入失敗時改用的樂器 id）。回傳的物件也可以帶 `ready`（一個 Promise，載入時呼叫 `ctx.onProgress(0..1)`，選單就會顯示進度）、`set(key, value)` 和 `releaseAll(time)`。敲擊類的聲音可以完全用資料寫，交給 `modalInstrument({ id, name, partials, strike })`。

合成器音色也是資料，會變成 `synth/<id>`：

```js
import { registerSynthPreset } from '@openav/sound';

registerSynthPreset({
  id: 'glass', name: { en: 'Glass', zh: '玻璃' },
  voice: 'fm', harmonicity: 3.01, modulationIndex: 14,
  envelope: { attack: 0.002, decay: 1.4, sustain: 0, release: 1.2 },
  effects: [{ type: 'chorus', frequency: 1.5, depth: 0.4, wet: 0.3 }],
});
```

### 自己寫引擎

引擎只是一個小物件，整個換掉也可以：

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
