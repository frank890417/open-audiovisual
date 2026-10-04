# 手機、中繼與控制面板

手機和 iPad 可以當控制器，能用的有動作感測器、一台鋼琴，還有一個照世界的參數自動長出來、類似 TouchOSC 的控制面板。負責的是三個套件，每個都能單獨使用：

| 套件 | 角色 |
|---|---|
| `@openav/relay` | 零相依、分房間（room）的 WebSocket 中繼，以及它的瀏覽器端用戶端 |
| `@openav/surface` | 控制面板元件、版面 JSON、`autoSurface(params)` |
| `@openav/remote` | 手機 app（分頁：感測 · 琴鍵 · 控制台 · MIDI），以及演出端的轉接器 |

對映射器來說，手機只是多一種輸入：它發出訊號，路由再把訊號接到參數。

## 架設

1. 在演出電腦上執行 `node serve.js`。它提供頁面，*同時*在 `/relay` 架起中繼，不需要其他東西。
2. 打開一個宣告了 `modules: { remote: true }` 的演出，例如 `http://localhost:8080/examples/08-remote-surface/`。
3. 舞台左上角的加入卡片會顯示手機該打開的網址，裡面已經填好演出電腦的區域網路位址（頁面會到 `/__info` 向 `serve.js` 詢問）和房間：`http://<lan-ip>:8080/packages/remote/?room=default`。
4. 用同一個網路裡的手機打開那個網址。卡片會顯示目前連上幾支手機。

有跑 `serve.js` 的地方才有中繼。在 openaudiovisual.com 這類靜態主機上，卡片會顯示 *relay offline*（中繼離線）。

## 手機 app

`/packages/remote/` 是單一頁面，上方是狀態列（連線、延遲、房間、這支手機的 id），下面是幾個分頁：

- **感測**：一顆跟著傾斜滾動的球、加速度與旋轉的讀數、多點觸控板、敲擊（手機被猛地一震），以及前鏡頭讀到的亮度。iOS 要先點一下「開始」，才會給動作資料。
- **琴鍵**：一台鋼琴。橫拿時是一排，大約三個八度，直拿時是上下兩排，上排接著下排往高音延伸。手指按在琴鍵的哪個高度，決定力度。另外有按住就延音的按鈕和換八度按鈕。
- **控制台**：一個控制面板。它的版面依序從這些地方找：`?surface=<layout.json url>` 查詢字串、`?meta=<json url>` 查詢字串（裡面的 `params` 會交給 `autoSurface`）、演出透過中繼發布的版面。都沒有的話，就用一個小小的通用面板，頁面永遠不會空白。
- **MIDI**：一台虛擬 MIDI 控制器，和演出畫面上顯示的是同一台（[MIDI 控制器與嵌入](controllers.md)）。

| 查詢字串 | 意思 |
|---|---|
| `room=<name>` | 要加入的房間（1 到 32 個字元，只能用 `A–Z a–z 0–9 _ -`，其他值一律當成 `default`） |
| `tab=sense\|keys\|control\|midi` | 一開始打開哪個分頁 |
| `surface=<url>` | 控制台分頁用的版面 JSON |
| `meta=<url>` | 一個含有 `params` 陣列的 JSON 檔，控制台分頁會變成 `autoSurface(params)` |
| `relay=ws://…` | 改連別處的中繼，不用頁面所在伺服器上的那一個 |

每支手機會在 `localStorage` 存一個短短的隨機 id，也就是 `phone/<id>/…` 裡的 `<id>`。

## iOS 與 HTTPS

iOS Safari 只把動作感測器和鏡頭開放給透過 `https://` 提供的頁面。觸控、琴鍵和控制面板，在區域網路上用一般的 `http://` 就能用。要在 iPhone 上用傾斜和敲擊，請透過 HTTPS 通道（tunnel，把本機的服務開成一個 https 網址）連到 `serve.js`，在手機上打開通道的網址。中繼會跟著頁面的來源（origin）走，HTTPS 頁面就用 `wss://`。鏡頭的部分，Android Chrome 也一樣。

## 演出端

在 `createShow()` 裡設 `modules: { remote: true }`（或用 `@openav/remote/host` 的 `mountRemoteHost()`），演出端會做五件事，世界完全不必知道手機在不在：

1. 以房間的 **runner**（演出端）身分加入中繼。
2. 把每一個手機訊號放進 `signals`，並把 `phone/<id>/…` 複製一份到 `phone/any/…`。`phone/any` 的值永遠來自最後送出數值的那支手機。
3. 建立控制面板：世界有附版面就用 `world.surface`，沒有就用 `autoSurface(world.params)`，再發布給每一支手機，之後才加入的也收得到。
4. 把 `surface/… → param` 路由加進映射器（已經有的配對會跳過）。
5. 每秒大約 10 次把參數值送回手機，讓推桿跟著時間軸和其他控制器一起動。

| `modules.remote` 選項 | 預設 | 意思 |
|---|---|---|
| `room` | 頁面網址裡的 `?room=`，沒有就是 `'default'` | 房間名稱 |
| `auto` | `{}` | 傳給 `autoSurface` 的選項（`pairs`、`meters`、`style`、`perPage`、`smooth`、`title`） |
| `surface` | `world.surface` | 指定的版面（比世界自帶的版面優先） |
| `feedbackHz` | `10` | 每秒回送幾次參數值 |
| `url` | 同源的 `/relay` | 中繼的 WebSocket 網址 |

感測器的路由在寫作品時就寫好，用 `phone/any/…` 這個別名，因為沒人能事先知道別人手機的裝置 id（範例 08）：

```js
await createShow({
  world: bloomWorld,
  routes: [
    { source: 'phone/any/tilt/x', target: 'drift', inMin: -1, inMax: 1, outMin: 0, outMax: 2, smooth: 0.12 },
    { source: 'phone/any/knock', target: 'burst' },
  ],
  modules: { keys: { base: 48 }, remote: { auto: { pairs: [['cx', 'cy']], meters: ['density'] } } },
});
```

`show.remote` 就是這個演出端主機：`{ relay, layout, routes, bindings, room, publish(), frame(dt, state), connect(), dispose() }`。

## 控制面板元件

控制面板把手指的動作變成有名字、正規化的訊號。每個元件都發布在 `surface/<page>/<id>` 底下。元件的範圍不是 0..1 時，另外會用 `…/raw` 送出未縮放的原始值。

| 類型 | 發布 | 說明 |
|---|---|---|
| `fader` | `<id>` | `orient: v`、`h` 或 `auto`（跟著格子的形狀）· 點兩下回到 `def` |
| `knob` | `<id>` | 抓外圈是轉動，抓中間是拖曳 |
| `encoder` | `<id>`（相位，轉滿一圈會繞回）和 `<id>/delta`（這一下轉了幾圈） | 可以無限轉 |
| `button` | `<id>` 1 / 0 | 按住才有作用，`pulse` 參數在按下的瞬間（上升緣）觸發 |
| `toggle` | `<id>` 1 / 0 | |
| `xy` | `<id>/x`、`<id>/y`、`<id>/down` | `spring: true` 放手後回到中心 |
| `bank` | `<id>/1` … `<id>/N` | `count`、`labels`。一根手指劃過去，就能一路畫過好幾個通道 |
| `radio` | `<id>` = 索引 / (n − 1)，`raw` = 索引 | `options: [...]` |
| `pads` | `<id>/hit` 脈衝 `{ pad, row, col, vel }`，按住時 `<id>/<n>` 是力度 | `rows`、`cols`（預設 4 × 4）、`labels`。`n` 從 0 起算，力度看你打在哪裡（上輕下重） |
| `keyboard` | `midi/note/on`、`midi/note/off`、`midi/cc/64` | 和硬體鍵盤用的名字一樣 |
| `number` | `<id>` | − / + 按鈕（按住會連續變動）和一個輸入欄 |
| `text` | `<id>`，一個字串脈衝 | 按 Enter 或 ↵ 送出 |
| `label`、`meter` | 無 | 只負責顯示，數值由 `surface.feedback(name, value)` 餵進來 |

共用欄位：`id`、`type`、`label`、`min`、`max`、`def`、`step`、`unit`、`color`（`cyan amber magenta lime violet coral white`），以及給[手寫版面](#hand-written-layouts)用的 `target`（一個參數的 key，`xy` 和 `bank` 則是陣列）。

手機鍵盤送出的音符是 `{ note, vel, velocity, ch: 1, device: 'surface' }`。

## 版面 JSON

版面跟路由一樣是資料：可以存成檔案分享，可以交給 AI 代理寫，也可以由世界發布。

```json
{ "version": 1, "title": "Bloom",
  "pages": [{
    "id": "main", "title": "Main", "grid": { "cols": 8, "rows": 4 },
    "widgets": [
      { "id": "hue",  "type": "knob",   "label": "Hue", "x": 0, "y": 0, "w": 2, "h": 2, "min": 0, "max": 360, "def": 205, "color": "cyan", "target": "hue" },
      { "id": "pos",  "type": "xy",     "x": 2, "y": 0, "w": 4, "h": 4, "target": ["cx", "cy"] },
      { "id": "go",   "type": "button", "label": "Burst", "x": 6, "y": 0, "w": 2, "h": 1, "target": "burst" }
    ],
    "portrait": { "grid": { "cols": 4, "rows": 8 }, "place": { "pos": { "x": 0, "y": 2, "w": 4, "h": 4 } } }
  }] }
```

手機會轉來轉去，所以每個頁面照這個順序決定怎麼排：

1. 如果頁面有對應目前方向的 `portrait` 或 `landscape` 變體，就用它的格線（沒寫在它 `place` 裡的元件，留在原本的位置，或填進空格）。
2. 沒有變體，但基本格線的形狀本來就對，就直接用。
3. 都不符合，就**自動重排**：同樣的元件，一列一列重新排進一半（直向）或兩倍（橫向）的欄數。

列數是個數目，不是像素，所以格線永遠填滿螢幕，畫面永遠不會捲動。沒有 `x`/`y` 的元件，會依類型給一個預設大小，排進空格。`validateLayout(layout)` 回傳一份問題清單（空的就是沒問題）。遇到有問題的版面，`new Surface()` 會帶著這份清單丟出錯誤。

## autoSurface

`autoSurface(params, options)` 把世界的參數變成三樣東西：一份版面、驅動這些參數的路由，以及回送數值用的綁定：

```js
import { autoSurface, feedbackFor } from '@openav/surface';

const { layout, routes, bindings } = autoSurface(world.params, { pairs: [['cx', 'cy']], meters: ['density'] });
routes.forEach((r) => mapper.addRoute(r));   // surface/main/hue → hue, …
feedbackFor(state, bindings);                // [{ name, value }] to echo back to the phone
```

每個參數會變成哪種元件：

| 參數 | 元件 |
|---|---|
| `pulse: true` | 按鈕 |
| `step: 1`，範圍是 1（兩個值） | 開關（toggle） |
| `step: 1`，有三到七個值 | 單選（radio，標籤取自 `options`，沒有就用數字） |
| 列在 `pairs` 裡的一對 | 一個 xy 觸控板，同時驅動兩個參數 |
| 其他 | 連續參數在六個以內用推桿，超過六個就用旋鈕 |
| 參數上寫了 `surface: { type, color, label }` | 照它寫的 |

選項：`pairs`、`meters`（另外以唯讀方式顯示的參數）、`style`（`'auto'`、`'fader'`、`'knob'`）、`perPage`（預設 8，要捲動的頁面就算失敗）、`smooth`（連續路由預設 0.04 秒，用來抹平網路每秒 30 次更新的階梯感）、`title`。每個參數 `group` 各自一頁。

## 手寫版面

給元件一個 `target`，`routesFromLayout(layout, params)` 就會寫出它的路由（形狀和 `autoSurface` 產生的一樣）：`xy` 把 x 接到第一個目標、y 接到第二個，`bank` 把第 *i* 個通道接到第 *i* 個目標。世界可以把版面放在 `world.surface` 一起帶著走，這時演出端就用它，不再自動產生。

## 主題與手機輔助函式

每個控制元件都讀 `:root` 上的 CSS 自訂屬性（`THEME_VARS`：`--oav-bg`、`--oav-surface`、`--oav-accent`、`--oav-radius`、`--oav-touch-min`（44 px）…）。覆寫它們，整個控制面板就換了外觀。設計規則是：深色底、觸控目標 ≥ 44 px、即時數值永遠看得到、按下時用元件自己的顏色亮出邊框和光暈、支援 `navigator.vibrate` 的裝置就震動。

`@openav/surface` 也匯出幾個手機輔助函式：`lockViewport()`（禁止捲動和縮放）、`keepAwake()`（Wake Lock）、`toggleFullscreen()`、`canFullscreen()`、`haptic(ms)`。

## 中繼

用戶端連到 `ws://<host>/relay?role=controller|runner|monitor&room=<name>&id=<device>`。房間就是一個名字，不同房間的連線彼此聽不到。

| 發送端 | 接收端 | 內容 |
|---|---|---|
| controller（手機） | runner + monitor | `signal` 和 `batch` |
| runner（演出） | monitor | `signal` 和 `batch` |
| runner | controllers + monitors | `feedback`（儀表、推桿回送）、`config`（控制面板版面，之後加入的手機也會補收到一份） |
| monitor | 不送給任何人 | |

訊息是 JSON：`{"type":"signal","name":"phone/ab12/tilt/x","value":0.3,"t":…,"pulse"?:true}`、`{"type":"batch","items":[…]}`、`ping`/`pong`、`status`（各角色的連線數）、`feedback`、`config`。用戶端遇到不認得的類型就略過。runner 離開時，房間會清掉它的 config。超過 256 KB 的訊息直接略過，超過 1 MB 的 frame 會讓連線直接關閉。不再回應 ping 的手機（螢幕鎖定、Wi-Fi 斷了），大約 40 秒內會被移除。

```js
import { RelayClient, bindSignals } from '@openav/relay';

const show = new RelayClient({ role: 'runner', room: 'main' }).connect();
bindSignals(show, signals);                        // phone signals → Signals, + phone/any/… alias
show.feedback('surface/main/level', 0.4);          // runner → phones
show.config('surface', { layout });                // runner → phones, kept for late joiners

const phone = new RelayClient({ role: 'controller', room: 'main' }).connect();
phone.set('phone/me/tilt/x', 0.3);                 // continuous: batched at 30 Hz, re-sent every second
phone.send('midi/note/on', { note: 60 }, true);    // pulse: immediate, never coalesced
```

連續值每秒重送一次，所以晚加入的手機，或演出中途重新載入的演出頁面，都不會卡在過時的預設值上。脈衝永遠不批次、不重送：一個 note-on 送到兩次就是 bug。用戶端會自己重新連線（從 0.5 秒開始，每次加倍，最長 5 秒）。

`fileSignal(signals, name, value, { pulse })` 是這套傳輸格式的接收端：一個名字第一次出現時，先宣告它（`signalMeta()` 知道 `phone/…`、`surface/…`、`midi/…` 這些名字的範圍），音符訊息缺哪一種力度寫法就補上哪一種（`vel` 0..1 或 `velocity` 1..127），然後觸發脈衝或設定數值。

不靠 `serve.js`，單獨跑中繼：`node packages/relay/server.js [port]`（預設 7458，健康檢查在 `/health`），或用 `@openav/relay/server` 的 `attachRelay(server, { path: '/relay' })` 掛到你自己的 Node 伺服器上。

## 演出頁面跑在手機上

演出本身跑在手機上時，不用中繼，就能讀這支手機自己的動作感測器。`localSensors(signals)` 用同樣的名字發布在 `phone/local/…` 底下，也複製一份到 `phone/any/…`，所以替「最新的那支手機」寫的路由，兩種情況都能用。`.start()` 要在使用者點擊時呼叫（iOS 的權限規定）：

```js
import { localSensors } from '@openav/remote';

const own = localSensors(show.signals);
button.onclick = async () => { await own.start(); if (own.denied) alert('motion access denied'); };
```

## 安全性

中繼沒有身分驗證。同一個網路裡，任何知道房間名稱的人，都能以 controller 身分加入，動你的參數。正式演出時，請用封閉的網路，或取一個沒人猜得到的房間名稱。
