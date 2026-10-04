# 核心概念

六個詞撐起整套框架：訊號、參數、路由、世界、時間軸、演出。這一章逐一定義它們，再說明把它們綁在一起的兩條規則。

## 訊號

**訊號**（signal）是一個有名字的數值，說明正在發生什麼：一顆旋鈕的位置、房間裡的音量、手腕的高度、上一個和弦的協和度。每個輸入套件都把訊號發布到同一個登錄表（`@openav/core` 的 `Signals`），除此之外什麼都不做。訊號是輸入唯一的通用貨幣。

訊號有兩種：

| 種類 | 存放的是 | 範例 | 讀取方式 |
|---|---|---|---|
| 連續 | 目前的值，通常在 0..1 之間 | `midi/cc/74` = 0.42 | `signals.get(name)`、`signals.norm(name)` |
| 脈衝 | 最近一次事件帶的內容 | `midi/note/on` → `{ note: 60, vel: 0.8, … }` | `signals.on(name, cb)` |

名稱是路徑，來源放最前面：`midi/cc/74`、`audio/band/low`、`pose/hand/right/y`、`phone/ab12/tilt/x`、`surface/main/hue`。只要在演出上說得通，範圍都會正規化；y 軸也會翻轉，讓 1 代表*舉高*，絕不會是原始的像素值。

宣告訊號時要帶上範圍，儀表和 *learn* 才知道怎麼縮放它：

```js
signals.define('breath/pressure', { min: 0, max: 1, source: 'breath' });
signals.set('breath/pressure', 0.37);               // continuous
signals.define('breath/sigh', { kind: 'pulse' });
signals.pulse('breath/sigh', { depth: 0.8 });       // pulse
```

對一個沒人宣告過的名稱呼叫 `set()`，會當場把它定義成 0..1 的連續訊號。如果你的數值落在別的範圍（角度、MIDI 音高編號），請先宣告範圍。

一顆旋鈕、一隻舉起的手、一個和弦的協和度，在這個登錄表裡地位相同。正因為平等，你才能把它們混著用：旋鈕做得到的，手也做得到。

## 參數

**參數**（param）是世界在聽的數值：`hue`、`bloom`、`gravity`。參數由世界自己宣告，每個參數是一行 schema：

```js
{ key: 'energy', label: 'Energy', min: 0, max: 1, def: 0.3 }
{ key: 'mode', label: 'Mode', min: 0, max: 3, def: 0, step: 1 }   // stepped: snaps, holds on the timeline
{ key: 'burst', label: 'Burst!', pulse: true }                      // a trigger, not a level
```

每一格畫面，每個參數都會解析成一個數字：

```text
timeline automation at time t      (the score; def if the param has no automation)
  ⬑ overridden by → the latest override   (a slider, a mapped knob, a phone fader)
```

覆寫會*黏住*（sticky）。一旦有手或路由碰過 `bloom`，時間軸就不再推動它，直到覆寫被清除（在控台按 ✕，或呼叫 `params.clearOverride('bloom')`）。這和舞台上的情況一致：人一抓住控制，樂譜就讓位。

完整的欄位列表在[寫一個世界](writing-a-world.md#params)。

## 路由與映射

**路由**（route）把一個訊號接到一個參數。路由就是單純的資料：

```js
{ source: 'pose/hand/right/y', target: 'energy', curve: 'smooth', smooth: 0.15 }
```

**映射器**（mapper，`@openav/mapping`）保存所有路由，並負責套用：讀取訊號，夾進一個範圍（`inMin`..`inMax`），需要的話反轉，用曲線彎折，縮放到參數的範圍；如果有指定，再隨時間做平滑。一個訊號可以推動好幾個參數，一個參數也可以聽好幾個訊號。*learn* 會綁定下一個動起來的訊號，旋鈕和揮動的手都適用。路由可以序列化成 JSON，所以一套接線就是一個檔案，可以帶到下一個場地。細節：[映射](mapping.md)。

## 世界

**世界**（world）就是作品：一個物件，帶有名稱、它的參數，以及 `init`、`update`、`render`、`dispose`。它每一格讀取已解析的參數，也可以為了離散事件訂閱訊號。繪圖方式由它自己帶：2D canvas、p5、three.js、WebToe 節點網路、DOM，什麼都可以，框架不干涉。細節：[寫一個世界](writing-a-world.md)。

## 時間軸與場景

**時間軸**（timeline，`@openav/timeline`）就是樂譜：每個參數的關鍵影格自動化，加上一串場景，每個場景附標題和給演奏者的備註。時間歸它管，世界從來不讀時鐘。場景可以從零之前開始，當作開演前的待命。細節：[演出控制](show-control.md#timeline)。

## 演出

**演出**（show）是一個世界，加上一次 `createShow()` 呼叫（`@openav/show`）。這次呼叫會建好訊號登錄表、參數、舞台、時間軸、映射器、你要的輸入、聲音、控台、後台資料流和畫面迴圈，然後全部回傳給你。每個範例都是一個世界加上這次呼叫，所以框架長出新模組時，每場演出只要宣告一下就能用。

```js
const show = await createShow({
  world,
  timeline: { total: 120, automation, scenes },
  routes: [{ source: 'audio/rms', target: 'energy', smooth: 0.1 }],
  modules: { keys: { base: 48 }, chord: true, audio: true, sound: true },
});
```

## 兩條規則

這兩條規則讓框架的每個部分可以自由組合。每條都有兩種說法：一種講系統怎麼設計，另一種講這對替它寫程式的人有什麼要求。

**1. 訊號是輸入唯一的通用貨幣。所以：連續控制走參數；離散事件可以直接用訊號。**

一個在 `update()` 裡讀 `signals.get('midi/cc/74')` 的世界，今天配上你的控制器還是能跑。但它再也不能被時間軸、舞者的手腕、手機或別人的控制器演奏。你等於把這場演出焊死在一個輸入上。改成宣告一個參數，讓一條路由接上 `midi/cc/74 → yourParam`。這樣同一個世界誰都能用，控台、手機控制面板和 *learn* 也都看得到這個參數。

事件就不一樣了。「一個音被按下」「一個和弦解決了」「大鼓打了一下」都是瞬間，不是持續的數值。在 `init()` 裡訂閱它們是對的，也鼓勵這麼做；世界會*反應*、而不只是自己飄著，靠的就是這個。

**2. 世界永遠不知道誰在演奏它。所以：外殼永遠不知道作品是什麼。**

世界讀的是參數，數值來自時間軸、MIDI 旋鈕、舞者還是推桿，它看不見。框架也是一樣：不要為了讓某個範例好看去改 `packages/*`。框架的修改，必須讓每件作品都變好。換作品，就是換掉世界和它的資料；外殼留著。
