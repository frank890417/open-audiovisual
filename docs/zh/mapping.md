# 映射

在映射層，「發生了什麼」變成「它代表什麼」。把訊號接到參數的，只有 `Mapper`（`@openav/mapping`）這一個元件，它手上就只有一份路由清單。

## 路由

一條路由就是一個普通物件。只有 `source` 和 `target` 是必填，其餘由 `addRoute()` 補上：

| 欄位 | 預設 | 意義 |
|---|---|---|
| `source` | — | 訊號名稱，例如 `midi/cc/74`、`hand/right/pinch/index`、`phone/any/tilt/x` |
| `target` | — | 參數的 key，例如 `bloom`、`sound/cutoff` |
| `inMin`, `inMax` | `0`, `1` | 取用訊號的哪一段，超出的值會壓在邊界上 |
| `outMin`, `outMax` | 參數的 `min`、`max` | 寫進參數的範圍 |
| `curve` | `'linear'` | `linear`、`exp`、`log` 或 `smooth` |
| `invert` | `false` | 在套用曲線之前，把正規化後的值翻過來（1 − x） |
| `smooth` | `0` | 滑到新值所需的時間，單位是秒（0 = 立即到位） |
| `mode` | （沒寫 = `'override'`） | `'override'` 取代時間軸的值，`'trim'` 疊加在它上面，`'pickup'` 要旋鈕先碰到參數的值才接管：見[微調、接管與放手](#trim-pickup-and-release) |
| `release` | （沒寫 = 不放手） | 訊號靜止這麼多秒之後，路由放手、時間軸接回去 |
| `enabled` | （沒寫 = 開啟） | 設成 `false` 就把這條路由靜音 |
| `id` | 自動指定 | 一個數字，移除路由時用 |

```js
show.mapper.addRoute({ source: 'midi/cc/74', target: 'bloom' });
show.mapper.addRoute({ source: 'phone/any/tilt/x', target: 'drift', inMin: -1, inMax: 1, smooth: 0.12 });
show.mapper.addRoute({ source: 'hand/right/pinch/index', target: 'tightness', curve: 'smooth', invert: true, smooth: 0.1 });
```

在 `createShow()` 裡，同樣的物件放進 `routes: [...]`。

## 一個數值經過哪些步驟

訊號一到，每一條啟用中、`source` 相符的路由，都會依序跑這幾步：

1. **輸入窗**：`x = (value − inMin) / (inMax − inMin)`，限制在 0..1 之間。
2. **反轉**：如果有 `invert`，`x = 1 − x`。
3. **曲線**：`x = curve(x)`。
4. **縮放**：`out = outMin + (outMax − outMin) · x`。
5. **寫入**：`smooth: 0` 時，直接用 `out` 覆寫參數（並限制在參數的範圍內、對齊它的 `step`）。`smooth > 0` 時，`out` 變成一個目標值，`mapper.update(dt)` 每個影格把參數往它推近一點。`trim` 路由寫的是時間軸的值加上 `out`；`pickup` 路由在旋鈕碰到參數之前什麼都不寫。

## 曲線

| 曲線 | 公式 | 手感 |
|---|---|---|
| `linear` | x | 手怎麼動，值就怎麼動 |
| `exp` | x² | 起步慢、尾端快：低段可以細調 |
| `log` | √x | 起步快、尾端慢：高段可以細調 |
| `smooth` | x²(3 − 2x) | 兩端都平緩（smoothstep） |

不認得的曲線名稱，會退回 linear。

## 輸入窗與輸出範圍

`inMin`/`inMax` 決定取訊號的哪一段，`outMin`/`outMax` 決定它落在參數的哪裡。常見用法：

- 雙極訊號：`{ source: 'midi/bend', inMin: -1, inMax: 1 }`，或手機傾斜 `{ source: 'phone/any/tilt/x', inMin: -1, inMax: 1 }`。
- 很小聲的訊號：`{ source: 'audio/rms', inMax: 0.3 }`，讓人聲實際到得了的音量，就能推滿整個參數範圍。
- 讓旋鈕只推動參數範圍的一段：`{ source: 'midi/cc/1', target: 'hue', outMin: 180, outMax: 270 }`。
- 不用 `invert` 的反向關係：`outMin: 1, outMax: 0`。

> [!WARNING]
> `outMin`/`outMax` 的預設值，是*加入路由那一刻*目標參數的範圍。如果參數那時還不存在，預設就是 0..1。在 `createShow()` 裡，路由加入得比聲音引擎註冊 `sound/*` 參數還早，所以宣告接到 `sound/cutoff` 的路由時，要明確寫上 `outMin: 100, outMax: 8000`。

## 平滑

`smooth` 是時間常數，單位是秒：過了 `smooth` 秒，參數大約走完到新值 63% 的距離（單極點濾波器，每個影格 `k = 1 − e^(−dt/smooth)`）。0.05–0.15 可以藏住 MIDI 旋鈕或 30 Hz 手機資料流的階梯感，0.2–0.5 會讓手的動作變得沉重。滑行從參數目前的值出發（手動設的值，否則就是時間軸現在說的，見 [`base`](#telling-the-mapper-where-the-timeline-is)），所以第一下動作絕不會跳，而且滑到了就停筆。

## 脈衝目標

目標是 `pulse` 參數時，路由不寫數值，改成觸發它：

- **脈衝**來源（`midi/note/on`、`audio/kick`、`drum/kick`、`phone/any/knock`…）每來一個事件就觸發一次。
- **連續**來源在正規化後的值往上越過 0.5 時觸發（手機控制面板上的按鈕從 0 變成 1、推桿推過中間）。

`curve`、`invert`、`smooth` 和輸出範圍，對脈衝目標都不起作用。

## 多對多

一個訊號可以推動很多個參數（加幾條 `source` 相同的路由），一個參數也可以聽很多個訊號。兩條路由寫同一個參數時，最後寫入的那條算數。*Learn* 只會新增路由，從不取代既有的路由。

[跳線盤設計](../design/patchbay.md)規劃了每條路由的 `combine`（`last`、`max`、`add`、`avg`）和 `label` 欄位，目前還沒做。

## 覆寫與時間軸

路由用**覆寫**的方式寫入參數，而覆寫會黏住：映射過來的訊號一動，時間軸就不再推那個參數。清掉覆寫（按參數旁的 ✕，或 `show.params.clearOverride(key)`），參數就交還給時間軸，直到訊號再動一次。

*有平滑*的路由只在滑行的時候寫入。滑到了就停筆，所以按 ✕（或你拖動滑桿）就能把參數拿回來，而且在旋鈕再動之前它都會留在手上；滑到一半按 ✕，滑行就停下。映射器會發現參數在它上一次寫入之後被別人寫過，然後退讓。路由靜音之後就不再寫入，參數維持原本的值（靜音的 `trim` 會把偏移還回去）。

取代式的路由握著參數的時候，時間軸的曲線就被丟在一邊。如果旋鈕只該*微調*時間軸，或是放開手就該*還給它*，請看下一節。

## 微調、接管與放手

有三個路由欄位決定旋鈕碰上時間軸時誰說了算。沒寫就全部不起作用：沒有 `mode` 也沒有 `release` 的路由，就是上面說的取代式路由。

| 欄位 | 旋鈕做什麼 |
|---|---|
| `mode: 'override'` | 預設：旋鈕的值*取代*時間軸的值，直到按 ✕ |
| `mode: 'trim'` | 旋鈕的值是一個*偏移*，加在時間軸的值上，時間軸在底下照樣往前走 |
| `mode: 'pickup'` | 跟 `override` 一樣，但旋鈕要先*碰到*參數現在的值，才接管 |
| `release: 4` | 任何模式都能用：旋鈕靜止 4 秒就放手，讓時間軸接回去 |

`mode` 和 `release` 對脈衝目標不起作用。

### 告訴映射器時間軸在哪裡

`trim`、`pickup`，還有平滑滑行的起點，都需要知道參數*此刻*在時間軸上的值。映射器從 `base` 取得，它是一個回傳 `{ key: value }` 的函式：

```js
const mapper = new Mapper({ signals, params, base: () => timeline.state() });
// a show made with createShow(): hand it the timeline once
show.mapper.base = () => show.timeline.state();
```

`timeline.state()` 是*還沒套用覆寫*的值，而且總譜的段落模組已經套用過了，也就是沒有人碰它時參數會有的值。沒有 `base` 的話，映射器用參數的 `def`：對沒有任何自動化的參數是對的，對時間軸畫著曲線的參數就不對。`base` 丟出錯誤或回傳別的東西，就當作沒有，絕不會擋住演出。它要輕：trim 握著參數的每個影格都會問一次，trim 或 pickup 的旋鈕每次讀數也會再問。

### trim：在時間軸上微調

時間軸已經把整晚畫好的作品，不該因為旋鈕轉到 0.9 就把曲線整條丟掉。`trim` 路由的 `outMin`/`outMax` 是*偏移量*的範圍，參數等於 `時間軸的值 + 偏移`，再夾在參數的範圍內。沒寫的話，旋鈕往兩邊各走參數範圍的一半（旋鈕在中間 = 不動）：

```js
// ±0.3 around whatever the timeline says, smoothed
show.mapper.addRoute({ source: 'midi/cc/74', target: 'reality', mode: 'trim', outMin: -0.3, outMax: 0.3, smooth: 0.1 });
```

- 偏移騎在時間軸上：曲線動，參數每個影格都跟著動。
- `smooth` 平滑的是偏移量（從 0 開始，不會跳）。
- 同一個參數上的兩條 trim 路由會相加，所以粗調和細調兩顆旋鈕可以一起用。參數上若同時有取代式路由，`trim` 疊在取代式路由的值上面。
- trim 握著參數的時候，參數是被覆寫的狀態：控台會在它旁邊顯示 ✕，讀覆寫值的 `timeline.record` 來源拿到的是加總後、觀眾看到的值。✕ 清掉偏移，旋鈕下次再動它就回來。移除或靜音路由，參數馬上交還。

### pickup：到了才接管

旋鈕和參數很少一開始就在同一個位置。用 `mode: 'pickup'` 時，旋鈕的值要先*碰到*參數現在的值，路由才開始寫入：離得不到路由輸出範圍的 2%，或是兩次讀數之間越過了它。之後它就像取代式路由，從參數原本的位置滑過去（不跳）。比較用的是參數此刻的值，所以時間軸在動的時候也成立。`release` 或 ✕ 會把路由放回「還沒碰到」。

### release：還回去

`release: 4` 的意思是：訊號 4 秒沒有動，路由就放手。「動」指的是變化超過輸入窗的 0.1%，從上次算動過的位置開始量，所以慢慢飄也算動，而一直重送同一個值的來源不算。放手時：

- `smooth: 0`：參數當場回到時間軸；
- `smooth > 0`：用大約三倍 `smooth` 秒淡進時間軸，然後清掉覆寫（`trim` 是把偏移淡到 0）；
- 放手之後，路由要等來源*再動*才會接管：一直重送同一個值的來源拿不回參數；
- 它只清自己寫的。如果這段時間滑桿已經接手，就讓它留著。

```js
// a main knob: meets the value first, glides, and gives the param back 4 s after the hand leaves
show.mapper.addRoute({ source: 'midi/cc/71', target: 'bloom', mode: 'pickup', release: 4, smooth: 0.15 });
```

## Learn

在 **L3 · Params**（參數）面板裡，點參數旁的 *learn*（或呼叫 `mapper.learn('bloom')`），然後動一樣東西。映射器會綁定第一個符合下列條件的訊號：

- 從 learn 開始時的位置**移動**了至少宣告範圍的 5%（旋鈕、推桿、手、手機傾斜），或
- 它是脈衝，而且**觸發**了一次（琴鍵、打擊墊、敲擊）。

新路由用的是預設值：線性、不平滑、參數的完整範圍。需要曲線的話，事後再改。再點一次 *learn* 就取消。learn 是「加入」：已經有路由的參數會保留原本那條，再多一條。

要一口氣綁一整串，**L2 · Mapping**（映射）面板有 **🎛 map knobs in order**：它先替第一個參數啟動 learn，你轉一顆旋鈕就綁上，接著自動換下一個參數。*skip*、*back*、*stop*（或按 Esc）可以操控它。程式裡用 `LearnWizard`（[細節](score.md#map-the-knobs-in-order)）。

> [!CAUTION]
> 任何脈衝都會馬上綁上去。learn 之前，先取消勾選 *simulate performance*（模擬演奏），並停掉鼓機，不然它們彈出的下一個音就會變成這條路由。

一則 MIDI 訊息同時發出好幾個名稱時（`midi/cc/74`、`midi/ch/1/cc/74`，接兩台裝置時還有 `midi/<slug>/cc/74`），learn 綁定的是第一個，也就是聽得到每一台裝置的 `midi/cc/74`。如果只想聽其中一台，把 `source` 改成那台裝置的專屬名稱。

## 靜音與移除

**L2 · Mapping** 面板把每條路由列成 `source → target`，各附一個核取方塊（靜音）和 ✕（移除）。用程式碼的話：

```js
const r = show.mapper.routesFor('bloom')[0];
r.enabled = false;                  // mute
show.mapper.removeRoute(r.id);      // remove
```

## 儲存的設定檔

映射器把路由存在 `localStorage` 的 `openav.map.<profile>` 底下。`createShow()` 用世界的名稱當設定檔名稱（或用 `profile` 選項），並且：

1. 有儲存的路由就載入，沒有的話就加入宣告的 `routes`。
2. 已經有儲存的設定檔時，宣告的路由裡 `source → target` 組合還沒出現過的，也會補進去，所以程式碼裡新加的路由一定會出現。
3. 每 3 秒存一次。

所以 learn 來的路由和你做的修改，重新載入之後都還在。反過來說：如果你在程式碼裡改了某條宣告路由的曲線或平滑，同一組 `source → target` 以儲存的版本為準。要從乾淨的狀態開始，就傳入 `profile: false`（每次載入都從程式碼讀路由，像範例 09 那樣），或刪掉儲存的設定檔：

```js
localStorage.removeItem('openav.map.particles');   // 'particles' = the world's name
```

要把一套接線帶到另一台電腦、或另一個世界，用對應檔（[下一節](#map-files-export-import-and-share)）。

## 對應檔：匯出、匯入與分享

**L2 · Mapping** 面板在「map knobs in order」下面有三個按鈕：

- **⬇ export**：把目前的路由下載成 `oav-map-<世界名>.json`。
- **⬆ import**：選一個對應檔。也可以**把 `.json` 拖進頁面任何地方**。匯入會*取代*現有路由，新的這組馬上被記住。
- **clear**：移除全部路由（要點兩下）。下次載入時，世界宣告的路由會回來，跟第一次來一樣。

按鈕下面會寫最近一次匯入的結果：進來幾條、**略過**哪幾條、為什麼。讀不了的檔案會說明原因，而且不動任何路由。

### 格式

```json
{
  "format": "openav.map",
  "version": 1,
  "world": "particles",
  "exported": "2026-10-15T08:30:00.000Z",
  "routes": [
    { "signal": "midi/cc/74", "param": "bloom", "curve": "exp",
      "range": { "in": [0, 1], "out": [0, 100] }, "smooth": 0.1, "invert": false },
    { "signal": "audio/rms", "param": "energy", "curve": "linear",
      "range": { "in": [0, 0.3], "out": [0, 1] }, "smooth": 0, "invert": false, "enabled": false }
  ]
}
```

路由用 `signal` 和 `param` 的名字指認，不用 id，所以檔案可以在不同世界之間搬：

- 這個世界沒有的 **param**：略過並列出來。
- 這場演出裡沒有東西能產生的 **signal**（例如沒有 Leap Motion 模組卻有 `leap/palm/x`）：略過並列出來。要等第一則訊息才會出現的訊號（`midi/…`、`surface/…`、`phone/…`、`osc/…`、`key…`、`take/…`）會留下，算作「等待中」。
- 檔案的 `world` 跟現在不同時，`range.out` 會丟掉，讓每個 param 用自己的範圍（`in` 窗、曲線、平滑、反相照樣帶過來）。
- `version` 比這個版本讀得懂的新，會拒絕並說明。`mapper.toJSON()` 的純陣列（舊作法）仍然可以匯入，當作版本 0。
- `mode`（`"trim"` 或 `"pickup"`）和 `release`（秒）是版本 1 裡選填的路由欄位，路由有用到才會寫出來。還沒有這兩個欄位的舊版會直接忽略，把那條路由當成取代式路由讀。`trim` 路由的 `range.out` 是偏移量的範圍。
- 超過 256 KB 或超過 500 條路由的檔案會被拒絕。

### 開頁就載入：`?map=`

```
https://openaudiovisual.com/examples/01-hello-particles/?map=https://example.com/my-map.json
https://openaudiovisual.com/examples/01-hello-particles/?map=maps/stage-left.json
```

`?map=<網址>` 在頁面打開時抓檔案，像匯入一樣載入。只接受**同源**位址（含相對路徑）或絕對的 **https** 位址；指向其他主機的 `http:`、`data:`、`javascript:`、`file:`，以及帶帳號密碼的位址都會被拒絕。跨站的檔案要有 CORS（`Access-Control-Allow-Origin: *`；raw GitHub 和 gist 都有）。演出照常開始：位址被拒、抓取失敗或檔案有問題時，面板會顯示原因，路由維持原樣。明確寫的 `?map=` 優先於被記住的接線，載入的內容也會像匯入一樣被記住。程式裡 `createShow({ map: 'maps/a.json' })` 效果相同，`map: false` 則忽略 `?map=`。

### 自動記住

映射器每 3 秒、以及每次匯入或清除之後，把路由存進 `localStorage`（`openav.map.<世界名>`），每個世界一格，下次打開從你停下的地方繼續。每次讀寫都包了 try/catch：私密視窗或儲存被擋時什麼都不會壞，只是不會被記住。

程式裡：

```js
import { loadMapUrl, parseMap } from '@openav/mapping';

const file = show.mapper.exportMap();                    // the object above
const report = show.mapper.importMap(text);              // text or object; { mode: 'add' } keeps current routes
// → { ok, added, skipped: [{ signal, param, reason: 'param' | 'signal' }], waiting, dropped, crossWorld }
await loadMapUrl(show.mapper, 'maps/a.json');            // what ?map= calls; never throws
parseMap(text);                                          // validate without touching a mapper
```

## 替你寫好的路由

有幾個套件會產生同樣格式的路由：

- `autoSurface(world.params)`（`@openav/surface`）會做出一個手機控制面板，以及它需要的 `surface/<page>/<widget> → param` 路由，帶 `smooth: 0.04`。`routesFromLayout(layout, params)` 對手寫的版面做一樣的事（[手機、中繼與控制面板](remote.md#autosurface)）。
- `controllerRoutes(profile, { knob1: 'hue', pad1: 'burst' })`（`@openav/midi`）依螢幕上控制器的各個控制項寫出路由（[MIDI 控制器與嵌入](controllers.md)）。

## Mapper API

```js
import { Mapper } from '@openav/mapping';

const mapper = new Mapper({ signals, params, profile: 'default', onChange, onLearn, base });
mapper.addRoute(route)        // → the stored route (defaults filled in, id assigned)
mapper.removeRoute(id)
mapper.routesFor('bloom')     // → routes targeting a param
mapper.routes                 // the live array
mapper.learn('bloom')         // arm / cancel learn; mapper.learnTarget is the armed key
mapper.base = () => timeline.state()   // the timeline's value now (trim, pickup, smooth start); optional
mapper.update(dt)             // every frame: glides smoothed routes, keeps trims on the timeline, applies release
mapper.toJSON(); mapper.fromJSON(array)
mapper.exportMap(); mapper.importMap(text|object, { mode })   // the portable file, see above
mapper.clear()                // remove every route (and forget them)
mapper.report                 // what the last import / ?map= said
mapper.save(); mapper.load()  // localStorage 'openav.map.<profile>'; load() → true if found
mapper.dispose()              // stop listening to signals
```

`onChange()` 在路由變動時執行（給介面用），`onLearn(route, signalName)` 在 learn 綁定完成時執行。
