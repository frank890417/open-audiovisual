# 架構

open-audiovisual 是一套*資料層*框架。它全部的價值在於：四層和兩條主軸彼此乾淨地分開，所以換掉其中任何一個，都不用碰到其他部分。這一章把每一層的介面約定講清楚。

## 畫面迴圈

一個 `Loop`（`@openav/core`）驅動一切。下面是 `createShow()` 每一格的執行順序（`packages/show/index.js`）：

```js
const loop = new Loop((dt) => {
  keys?.update(dt);                              // 0. on-screen performers: SimPlayer, drum sequencer
  drums?.update(dt);
  audio?.update();                               //    microphone analysis → audio/* signals
  onFrame?.(dt, show);                           //    your assembly-level hook
  timeline.advance(dt);                          // 1. time moves
  mapper.update(dt);                             // 2. smoothed routes settle
  const state = stage.frame(dt, timeline.state()); // 3. params resolve → world updates & renders
  sound?.update(state);                          // 4. sound/* params reach the synth
  remote?.frame(dt, state);                      //    param values echo back to phones
  consoleUI.render(state);                       // 5. the desk reflects reality
  monitor.frame(snapshotOf({ timeline, params, signals, stage, loop }, state)); // 6. backstage hears about it
});
```

訊號在兩格*之間*抵達，裝置或 socket 什麼時候觸發，就什麼時候到。沒有平滑的路由會立刻寫入參數；有平滑的路由則是設定一個目標值，由 `mapper.update(dt)` 慢慢滑過去。OSC 輸出不在 `createShow()` 裡；如果要用，請在 `onFrame` 裡呼叫 flush 把它送出（見[演出控制](show-control.md#osc-output)）。

`dt` 以秒為單位，上限夾在 0.1（`new Loop(fn, { maxDt })`），所以就算卡頓，世界也不會爆掉。瀏覽器凍結 `requestAnimationFrame` 的時候（例如投影視窗被切到背景），會有一個 Web Worker 心跳讓迴圈繼續跑，大約每 66 ms 一次（約每秒 15 格）：不能因為有人切了視窗，時間軸、映射中的訊號和後台資料流就停下來。

參數解析的順序（整個設計的核心）：

```text
timeline.state(t)          — the "score": automation curves per param
  ⬑ overridden by →  params.overrides   — set by hand sliders, mapped signals
```

覆寫會*黏住*：一旦有旋鈕碰過 `bloom`，時間軸就不再推動它，直到覆寫被清除（在控台按 ✕）。這符合演出的現實：人一抓住控制，樂譜就讓位。

## L1 · 輸入：訊號（Signals）

**介面約定**：輸入套件把*有名字、經過正規化的訊號*發布到 `Signals` 登錄表，除此之外什麼都不做。它們從不碰參數或世界。

- 名稱像路徑：`midi/cc/74`、`chord/consonance`、`pose/hand/right/y`
- 連續訊號宣告 `{min, max}`，而且永遠持有一個目前值
- 脈衝訊號（`kind: 'pulse'`）觸發事件，帶的內容就是事件物件
- 誰都可以訂閱：`signals.on(name, cb)` 或 `signals.onAny(cb)`

新增一種輸入方式（呼吸感測器、遊戲手把、股票報價、天氣 API），就是寫一個呼叫 `signals.set()`／`signals.pulse()` 的 class。下游什麼都不用改。重點就在這裡。

分析器位在原始來源和映射之間：`@openav/chord` 訂閱 `midi/note/on|off`，再發布 `chord/*`。對映射器來說，它仍然是一個輸入；只是它聽的是其他訊號，而不是一台裝置。

## L2 · 映射：映射器（Mapper）

**介面約定**：唯一把訊號接到參數的元件。路由就是資料：

```js
{ source: 'pose/hand/right/y', target: 'energy',
  inMin: 0, inMax: 1, curve: 'smooth', invert: false,
  smooth: 0.15, outMin: 0, outMax: 1 }
```

- **多對多**：一個訊號可以推動好幾個參數；一個參數可以聽好幾個訊號（最後寫入的為準）。learn 只會*新增*路由，從不取代。
- **learn** 是廣義的 MIDI learn：`mapper.learn('bloom')` 會綁定下一個*動了*至少自身範圍 5% 的訊號，旋鈕和揮動的手都算數。
- 路由可以序列化成 JSON → 映射設定檔就是可以分享的檔案。

完整說明：[映射](mapping.md)。

## L3 · 世界：舞台（Stage）

**介面約定**：世界（World）是 `{ name, params, init, update(dt, state, io), render, dispose }`。它讀 `state`（已解析的參數值）。它可以*為了離散事件訂閱訊號*（一個 note-on 生出一顆粒子，是事件，不是參數），但連續控制一定要經過參數，否則你的世界就不能再被時間軸或其他輸入演奏。

舞台（Stage）負責生命週期和參數彙整，並且刻意**不**負責繪圖。p5、three.js、2D canvas、SVG、DOM 都可以，框架不干涉。

憲法級的規則（承襲自《The Last Input 終局之前》）：**外殼永遠不知道作品是什麼。** 換作品＝換掉世界＋自動化資料。外殼留著。

完整說明：[寫一個世界](writing-a-world.md)。

## L4 · 輸出：影像與聲音兩條分支，都是選用

輸出層分成兩條分支。兩條都接在同一條「訊號 → 映射 → 參數」主軸上：聲音是可以被演奏的狀態，不是附帶的效果。

**影像分支**
- **螢幕**是預設的輸出；演出模式（T）給演奏者一個提詞畫面，觀眾則看到全螢幕的舞台視窗（F）。
- 未來：NDI 閘道（見路線圖；基礎工作在姊妹專案 WebToe 裡）。

**聲音分支**
- **MIDI 輸出**（外接合成器、DAW）：`midi.send()/noteOn()/cc()`，所有訊息走同一個出口，而且可以觀察（`onSend`），讓儀表看得到每一則送出的訊息，也有真正有用的 `panic()`。
- **頁面內合成**：`@openav/sound`，一份精簡、可抽換的引擎介面約定（`params, enable, noteOn, noteOff, set, dispose`），先支援 Tone.js 引擎（從 CDN 載入，按下 enable 才載）。引擎的參數註冊成 `sound/*`：旋鈕、手或時間軸演奏濾波器截止頻率的方式，和演奏畫面完全一樣。`@openav/drums` 的鼓組是同一份介面約定後面的第二個引擎（純 WebAudio，不需要取樣音檔）。
- **OSC**：瀏覽器 → HTTP → `osc-bridge.js` → UDP（Spat、Reaper、TD、燈光）。每格批次送出；同一個位址在一格裡只留下最新的一則訊息。

## 主軸 · 時間軸

純邏輯，不碰 DOM：參數＋自動化關鍵影格＋場景 → `state(t)`。場景可以從負的 t 開始（開演前的待命）。`onSceneChange` 就是 cue 的掛鉤：聲音、燈光、提示都從這裡觸發。

## 主軸 · 後台監看

演出頁面透過 WebSocket，把 JSON 快照（有節流，約 15 Hz）串流到一個沒有相依套件的中繼（`server.js`，手寫的 RFC 6455 實作）。區域網路裡任何一支手機或一台筆電，打開後台頁面就能看到：時鐘、場景、世界、FPS、覆寫、每個訊號和參數，還有「舞台畫面斷線」警示。後台監看是一等公民，因為沒有後台的演出，只是一場彩排。

## 主軸周邊：控台與手機

- **控台**（`@openav/console`）：側邊面板裡的導演桌，依層排列（Layers → L1 → L2 → L3 → L4 → Signals），另外還有演出模式。它讀的是迴圈正在跑的同一批物件，自己什麼都不擁有。
- **手機**（`@openav/relay`、`@openav/surface`、`@openav/remote`）：手機和 iPad 透過 WebSocket 中繼加入一個房間，發布 `phone/*` 和 `surface/*` 訊號。對映射器來說，它們只是多一個輸入。見[手機、中繼與控制面板](remote.md)。
