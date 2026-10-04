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
5. **寫入**：`smooth: 0` 時，直接用 `out` 覆寫參數（並限制在參數的範圍內、對齊它的 `step`）。`smooth > 0` 時，`out` 變成一個目標值，`mapper.update(dt)` 每個影格把參數往它推近一點。

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

`smooth` 是時間常數，單位是秒：過了 `smooth` 秒，參數大約走完到新值 63% 的距離（單極點濾波器，每個影格 `k = 1 − e^(−dt/smooth)`）。0.05–0.15 可以藏住 MIDI 旋鈕或 30 Hz 手機資料流的階梯感，0.2–0.5 會讓手的動作變得沉重。滑行從參數目前的值出發，所以第一下動作絕不會跳。

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

*有平滑*的路由，只要訊號來過一次，之後每個影格都會繼續寫入最後的目標值，所以就算按了 ✕、就算路由已經靜音，參數還是維持覆寫。要把參數永遠交還給時間軸，就移除那條路由（**L2 · Mapping**（映射）面板裡的 ✕）。

## Learn

在 **L3 · Params**（參數）面板裡，點參數旁的 *learn*（或呼叫 `mapper.learn('bloom')`），然後動一樣東西。映射器會綁定第一個符合下列條件的訊號：

- 從 learn 開始時的位置**移動**了至少宣告範圍的 5%（旋鈕、推桿、手、手機傾斜），或
- 它是脈衝，而且**觸發**了一次（琴鍵、打擊墊、敲擊）。

新路由用的是預設值：線性、不平滑、參數的完整範圍。需要曲線的話，事後再改。再點一次 *learn* 就取消。

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

要把一套接線帶到另一台電腦，就匯出再匯入 JSON（目前還沒有檔案介面，已經列在[路線圖](roadmap.md)上）：

```js
copy(JSON.stringify(show.mapper.toJSON(), null, 2));   // devtools: copies the routes
show.mapper.fromJSON(routes); show.mapper.save();      // on the other machine (replaces all routes)
```

## 替你寫好的路由

有幾個套件會產生同樣格式的路由：

- `autoSurface(world.params)`（`@openav/surface`）會做出一個手機控制面板，以及它需要的 `surface/<page>/<widget> → param` 路由，帶 `smooth: 0.04`。`routesFromLayout(layout, params)` 對手寫的版面做一樣的事（[手機、中繼與控制面板](remote.md#autosurface)）。
- `controllerRoutes(profile, { knob1: 'hue', pad1: 'burst' })`（`@openav/midi`）依螢幕上控制器的各個控制項寫出路由（[MIDI 控制器與嵌入](controllers.md)）。

## Mapper API

```js
import { Mapper } from '@openav/mapping';

const mapper = new Mapper({ signals, params, profile: 'default', onChange, onLearn });
mapper.addRoute(route)        // → the stored route (defaults filled in, id assigned)
mapper.removeRoute(id)
mapper.routesFor('bloom')     // → routes targeting a param
mapper.routes                 // the live array
mapper.learn('bloom')         // arm / cancel learn; mapper.learnTarget is the armed key
mapper.update(dt)             // every frame: advances smoothed routes
mapper.toJSON(); mapper.fromJSON(array)
mapper.save(); mapper.load()  // localStorage 'openav.map.<profile>'; load() → true if found
mapper.dispose()              // stop listening to signals
```

`onChange()` 在路由變動時執行（給介面用），`onLearn(route, signalName)` 在 learn 綁定完成時執行。
