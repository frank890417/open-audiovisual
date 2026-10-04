# 疑難排解

這些都是排練和寫程式時真的遇過的問題，附上解法。

## 瀏覽器主控台出現 ws://…:7457 錯誤

每個用 `createShow()` 做的演出，都會試著把資料串流到 `ws://<the page's host>:7457` 的後台監看。監看伺服器沒在跑時，瀏覽器會記下被拒絕的連線。這是預期中的，也無害：頁面會重試，間隔從大約 5 秒拉長到 30 秒，不會一直洗版。想讓它消失，就把監看伺服器跑起來：

```bash
npm run monitor          # node packages/monitor/server.js
```

## 手機加入卡片顯示「relay offline」

手機中繼住在 `serve.js` 裡（`/relay`）。靜態主機（GitHub Pages、openaudiovisual.com）沒有中繼，所以範例 08 和 09 在那裡連不到手機。請在跟手機同一個網路的電腦上，用 `node serve.js` 跑演出。

## 看不到任何 MIDI 裝置

- 請用 Chrome 或 Edge。Safari 沒有 Web MIDI。
- 瀏覽器詢問時，允許 MIDI。權限依網站分開：在 `localhost:8080` 允許了，不代表 `localhost:3000` 也允許。
- 裝置在頁面載入之後才接上：它應該會自己出現。沒出現的話，重新載入頁面。
- 檢查 **L1 · Input**（輸入）面板：沒勾選的裝置是靜音的。
- 可能有別的程式獨占了這個埠（Windows 上有些 DAW 和驅動程式會這樣）。把它關掉。

## 聽不到 IAC 匯流排上的 DAW

`Midi` 引擎預設略過名稱含有 `IAC` 的所有輸入（`filterOut: 'IAC'`），不然演出透過 macOS 的 IAC 匯流排送出 MIDI，又會聽到自己的輸出，繞成迴圈。`createShow()` 用的就是這個預設。要透過 IAC 接收 DAW 送來的訊息，就關掉內建的引擎，自己建一個：

```js
import { Midi } from '@openav/midi';

const show = await createShow({ world, modules: { midi: false } });
const midi = new Midi({ signals: show.signals, filterOut: null });   // or a narrower regex
await midi.enable();
```

你的引擎發出的是同一組訊號，所以路由和世界都不用改。（控台的裝置清單和 MIDI 儀表，只跟著 `createShow()` 建立的那個引擎走。）不要把 MIDI 送到你正在聽的同一條 IAC 匯流排。

## 接兩台控制器時，一條路由對兩台都有反應

接兩個以上的 MIDI 輸入時，每台裝置會用自己的名稱（`midi/<slug>/cc/74`）發出訊號，*同時*也用共用的舊名稱（`midi/cc/74`）發出。接在 `midi/cc/74` 上的路由聽得到每一台裝置，把它的 source 改成那台裝置專屬的名稱就好。各裝置的 slug 會顯示在 **L1 · Input** 面板。

## 電腦鍵盤按了沒反應

先勾選鋼琴上方的 *keyboard*（電腦鍵盤擷取）。擷取預設是關的，這樣打字才不會跟控台的快捷鍵打架。勾選之後，`A W S E D F T G Y H U J K O L P ;` 可以彈奏，<kbd>Z</kbd>/<kbd>X</kbd> 切換八度。

## Learn 綁錯了訊號

Learn 綁定的是第一個移動超過自身範圍 5% 的訊號，或第一個出現的脈衝（不分種類）。模擬演奏者和鼓機一直在送脈衝。先取消勾選 *simulate performance*（模擬演奏），停掉鼓機，再點一次 *learn*。用 **L2 · Mapping**（映射）面板裡的 ✕ 移除綁錯的路由。

## 時間軸不再推動某個參數

碰過的滑桿或有映射的訊號會*覆寫*參數，而覆寫會黏住：樂譜讓位給人。用參數旁的 ✕ 清掉（或呼叫 `show.params.clearOverride(key)`，要全部清掉就用 `clearAllOverrides()`）。*有平滑*的路由只要訊號來過，就會一直寫入，就算已經靜音也一樣。要把參數交還給時間軸，就移除那條路由。詳見[覆寫與時間軸](mapping.md#overrides-and-the-timeline)。

## 在程式碼裡改了路由，卻什麼都沒變

映射器把昨天的路由存在 `localStorage`，而儲存的 `source → target` 組合會蓋過程式碼裡宣告的那一條（新的組合仍然會加進來）。清掉設定檔，或在開發期間傳入 `profile: false`：

```js
localStorage.removeItem('openav.map.<world name>');
```

## 接到 sound/cutoff 的路由只在 0 和 1 之間動

`outMin`/`outMax` 的預設值，是路由加入當下目標參數的範圍。在 `createShow()` 裡，宣告的路由加入得比聲音引擎註冊 `sound/*` 參數還早，所以要明確給出範圍：`{ source: 'midi/cc/74', target: 'sound/cutoff', outMin: 100, outMax: 8000 }`。

## 鏡頭或麥克風啟動不了

- 頁面必須是安全環境（secure context）：`http://localhost` 或 `https://`。用一般 `http://` 連區域網路位址（`http://192.168.1.20:8080`）會被擋下來。
- 🎤 mic、🖐 hands 和 🕺 body 按鈕要自己點，它們都不會自動啟動。按鈕顯示 *✗ retry* 代表啟動失敗，原因印在瀏覽器的主控台。
- 在 macOS 上，瀏覽器本身要在「系統設定 → 隱私權與安全性」裡取得相機和麥克風的權限。
- 手部和身體追蹤第一次啟動時，會從 jsDelivr 和 Google 的儲存空間載入 MediaPipe 和它的模型。離線時無法啟動。

## 沒有聲音

瀏覽器要點一下才會開始播放音訊。在 *L4 · Output — sound*（聲音輸出）面板按 **🔊 enable sound**（開啟聲音）。Tone.js 引擎在那一刻才從 jsDelivr 載入，所以第一次需要網路連線。鼓機的鼓組，是勾選 *drum machine*（鼓機）之後、打下第一拍時才啟動。

## 在 iPhone 上，手機的傾斜和敲擊都沒作用

iOS 只把動作感測器開放給 `https://` 頁面，而且要先點一下「開始」。在區域網路上用一般 `http://` 連線時，觸控、琴鍵和控制面板仍然能用。要用感測器，就透過 HTTPS 通道連到 `serve.js`。如果曾經拒絕過權限，iOS 會記住，要到「設定 → Safari → 動作與方向取用」改回來，再重新載入。

## 部署之後，網站還在跑舊的程式碼

GitHub Pages 讓瀏覽器把 JavaScript 快取好幾個小時，HTML 卻幾分鐘就過期，所以訪客可能拿到新的 HTML，配上舊的模組。部署前執行 `node tools/stamp-version.mjs`：它會在範例、套件和首頁的模組網址後面加上 `?v=<commit>`。在本機不會發生這種事：`serve.js` 會送出 `Cache-Control: no-store`。

## 視窗退到背景時，演出變慢

瀏覽器會在隱藏的分頁暫停 `requestAnimationFrame`。這時 `Loop` 改由 Web Worker 帶著，以大約每秒 15 格繼續跑，所以時間軸、映射的訊號和後台資料流都不會停，只是畫面更新變慢。投影視窗要一直留在畫面上，放在它自己的螢幕，開全螢幕（<kbd>F</kbd>）。

## 用到 CDN 的範例，連網時能跑，離線就不行

p5（範例 05、06）、Tone.js（聲音）、MediaPipe（手、身體）和 WebToe app（範例 04）都從網路載入。到離線的場地演出，先把它們下載下來，再把 script 標籤、import map 或模組選項（`toneEngine({ cdn })`、`webtoeWorld({ app })`）指到本機的副本。

## 連接埠已經被佔用

`node serve.js 8081` 會改用另一個埠，OSC 橋接也接受埠號參數：`node packages/osc/bridges/osc-bridge.js 7470`（再用 `new OscOut('http://127.0.0.1:7470')`）。後台監看是例外：用 `createShow()` 做的頁面，永遠串流到自己主機的 7457 埠，所以要把這個埠空出來。只有自己組裝的演出可以改指別的位置：`new MonitorFeed({ url: 'ws://host:7460' })` 搭配 `node packages/monitor/server.js 7460`。
