# 疑難排解

這些都是排練和寫程式時真的遇過的問題，附上解法。

## 瀏覽器主控台出現 ws://…:7457 錯誤

每個用 `createShow()` 做的演出，都會試著把資料串流到 `ws://<the page's host>:7457` 的後台監看。監看伺服器沒在跑時，瀏覽器會記下被拒絕的連線。這是預期中的，也無害：頁面會重試，間隔從大約 5 秒拉長到 30 秒，不會一直洗版。想讓它消失，就把監看伺服器跑起來：

```bash
npm run monitor          # node packages/monitor/server.js
```

用 https 開的頁面（openaudiovisual.com、https 通道）不會去連：瀏覽器在 https 頁面上會擋掉 `ws://`，公開的網站旁邊也沒有監看伺服器。如果你的監看伺服器架在 TLS 後面，就自己把位址傳進去：`new MonitorFeed({ url: 'wss://…' })`。

## Chrome 跳出「區域網路」或「這台裝置上的應用程式」的詢問

Chrome 的 Local Network Access（區域網路存取）檢查，會在**公開的** https 頁面要連你自己的電腦或網路時，先跳出權限詢問；從你自己這台機器提供的頁面不在範圍內（[Chrome 部落格](https://developer.chrome.com/blog/local-network-access)）。依 Chrome 版本，它管的範圍是（查證於 2026-10-15）：

- Chrome 142：`fetch` 請求（[Chrome 部落格](https://developer.chrome.com/blog/local-network-access)）。
- Chrome 145：分成兩種權限，一種管區域網路，一種管這台裝置本身，也就是 loopback（[Chrome Platform Status](https://chromestatus.com/feature/5197681148428288)）。
- Chrome 147：WebSocket 和 WebTransport 連線也管了（[Chrome Platform Status](https://chromestatus.com/feature/5197681148428288)）。
- Chrome 154：`new WebSocket(url, { targetAddressSpace })` 讓頁面說明它預期連的是哪一種位址（[Chrome Platform Status](https://chromestatus.com/feature/5197681148428288)）。

演出跑在 openaudiovisual.com 或別的 https 網站上時，我們有三樣東西會去連你的電腦：OSC 橋接（`OscOut` 送到 `http://127.0.0.1:7456`）、後台監看（`ws://127.0.0.1:7457`）和 Leap 橋接。第一次 Chrome 會問。選了「封鎖」，連線就失敗，主控台會出現 `net::ERR_BLOCKED_BY_LOCAL_NETWORK_ACCESS_CHECKS`（在 Chrome 154 上看到的，見 [Leap 套件說明](https://github.com/frank890417/open-audiovisual/blob/main/packages/leap/README.md)）。

怎麼辦：

- 按**允許**。如果已經封鎖了，打開這個頁面的網站設定（網址列左邊的圖示），重新允許，再重新載入。
- 或者從你自己的電腦打開頁面：`node serve.js`，然後開 `http://localhost:8080/…`。那個頁面不是公開網站，Chrome 不會問。排練或教 OAV → OSC → TouchDesigner 這條路，這是最穩的做法。
- 在 `<iframe>` 裡，跨網域的框架要加 `allow="loopback-network"`；同網域的框架會繼承；加了 `sandbox` 的框架拿不到（在 Chrome 154 上驗證過，見 [Leap 套件說明](https://github.com/frank890417/open-audiovisual/blob/main/packages/leap/README.md)）。
- [裝置體檢](https://openaudiovisual.com/zh/check/)有一顆按鈕，會試連橋接和後台監看，告訴你哪一個有回應。你按了才會連。

## 手機加入卡片顯示「relay offline」

在你自己的電腦上，手機中繼住在 `serve.js` 裡（`/relay`）。所以頁面如果是從檔案、或從不是 `node serve.js` 的伺服器打開的，卡片就會寫「relay offline」：請用 `node serve.js` 跑，再從那裡打開。

在靜態主機（openaudiovisual.com、GitHub Pages）上，演出改用**公開中繼**，卡片會寫 `relay ok · … · public relay`，並附 QR code。如果寫的是 `can't reach the relay (wss://remote.cheyuwu.com/relay) — retrying`：

- 網路擋了 WebSocket（有些學校和辦公室的 Wi-Fi 會）：換成手機熱點，或在跟手機同一個網路的筆電上跑 `node serve.js`；
- 公開中繼忙線或停了：它限制每個位址同時 24 條連線、每分鐘 30 次新連線，一整間教室躲在同一台路由器後面可能就撞到。自己跑一個（`node packages/relay/server.js`），打開演出時加上 `?relay=wss://your.host/relay`；
- 網址裡有 `?relay=off`，遙控被關掉了（這時不會畫卡片）。

手機要開的是 QR code 裡的連結，它帶著房間和中繼。手機顯示已連線卻沒反應的話，檢查兩邊的 `#room` 是不是同一個，以及電腦上的頁面有沒有重新載入成新房間（房間是每個瀏覽器各記一個，換瀏覽器或用無痕視窗會得到另一間）。

## 看不到任何 MIDI 裝置

先跑一次[裝置體檢](https://openaudiovisual.com/zh/check/)，它會告訴你這個瀏覽器到底有沒有 Web MIDI。

- 請用 Chrome 或 Edge。Safari 沒有 Web MIDI（[WebKit bug 107250](https://bugs.webkit.org/show_bug.cgi?id=107250)，至今還開著），Firefox 要先裝它的網站權限附加元件才有（[Firefox 108](https://developer.mozilla.org/en-US/docs/Mozilla/Firefox/Releases/108)）。詳見[用哪個瀏覽器](getting-started.md#which-browser)。
- 瀏覽器詢問時，允許 MIDI。從 Chrome 124 起，任何 MIDI 的使用都會問（[Chrome 部落格](https://developer.chrome.com/blog/web-midi-permission-prompt)）。權限依網站分開：在 `localhost:8080` 允許了，不代表 `localhost:3000` 也允許。
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

另外有第二道防線，不用設定：任何輸入上，在 40 毫秒內收到一則和引擎剛*送出*的完全相同的訊息，就當作回音丟掉（`new Midi({ echoWindow })`，`0` 就關掉，`midi.echoDropped` 會計數）。

## 線被拔掉之後，DAW 就沒聲音了

現在不會了。輸出埠被拔掉時，`Midi` 會換到次佳的可用埠，在 MIDI 紀錄和瀏覽器 console 各印一行（`MIDI out: switched to "…" ("…" was unplugged)`），L1 · Input 面板的 `MIDI out →` 那一列也會跟著變。你選的那個埠重新插上，輸出就換回去。如果那一行寫的是 `no output left`，就是現在什麼都沒插：訊息會被丟掉，直到有埠出現。用 `midi.selectOutput(name)`（或 `enable(name)`）選好你的埠，換回來的就是它。再加上 `new Midi({ prefer: ['IAC'] })` 指定誰先頂替。

## 接兩台控制器時，一條路由對兩台都有反應

接兩個以上的 MIDI 輸入時，每台裝置會用自己的名稱（`midi/<slug>/cc/74`）發出訊號，*同時*也用共用的舊名稱（`midi/cc/74`）發出。接在 `midi/cc/74` 上的路由聽得到每一台裝置，把它的 source 改成那台裝置專屬的名稱就好。各裝置的 slug 會顯示在 **L1 · Input** 面板。

## 電腦鍵盤按了沒反應

先勾選鋼琴上方的 *keyboard*（電腦鍵盤擷取）。擷取預設是關的，這樣打字才不會跟控台的快捷鍵打架。勾選之後，`A W S E D F T G Y H U J K O L P ;` 可以彈奏，<kbd>Z</kbd>/<kbd>X</kbd> 切換八度。

*keyboard* 勾著的時候，字母鍵歸鋼琴，所以控台的 R（重設）、T（提詞機）、F（全螢幕）都沒作用：T 和 F 本來就是琴鍵，而且你正在彈的時候，不小心按到 R 不該把整場演出倒帶。Space、方向鍵和 <kbd>Esc</kbd> 仍然有效，按 Esc 就離開擷取。

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

瀏覽器要點一下才會開始播放音訊。在 *L4 · Output — sound*（聲音輸出）面板按 **🔊 enable sound**（開啟聲音）。Tone.js 引擎在那一刻才從 jsDelivr 載入，所以第一次需要網路連線。第一次選鋼琴時，要載入大約 2 MB 的取樣，選單會顯示進度，鋼琴準備好之前，會繼續用前一個樂器彈。鼓機的鼓組，是勾選 *drum machine*（鼓機）之後、打下第一拍時才啟動。

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
