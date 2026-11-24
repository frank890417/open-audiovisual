# OAV 的 DMX 系統：研究與設計

> 2026-11-24 深夜。哲宇原話：「也幫 oav 完整打造 dmx 系統，寫研究報告後完整打造」。
> 這份是動工前的研究與設計。寫完就開工（他已授權），合進 main 之前給他看預覽。
> 沒有用真燈測過的地方，全文用「未實測」標出來。目前手上沒有 DMX 燈具與 DMX 介面。

## 1. 現況：repo 裡已經有什麼

| 已有 | 在哪 | 對 DMX 的意義 |
|---|---|---|
| 本機輸出橋接器 | `packages/out/bridge/out-bridge.mjs`（Node、零相依、只綁 127.0.0.1:6450） | 瀏覽器不能送 UDP，DMX 的網路協定要從這裡出去。加 sink 就好，不用另起一支程式 |
| 看門狗與安全值 | 同上，`safe`＋`timeoutMs`：頁面停止說話就把每個通道放回安全值 | DMX 的「斷線回安全狀態」直接沿用 |
| 瀏覽器端 `OutClient` | `packages/out/client.js`：`set(ch, v)`、每格每通道只送最後一個值、心跳 | DMX 走 `dmx/<universe>/<address>` 這種通道名就能用 |
| WLED（DDP）sink | `packages/out/bridge/sinks/ddp.js` | 寫 Art-Net、sACN sink 的樣板 |
| QLC+ 匯入匯出 | `tools/import-qlc.mjs`、`packages/midi/export.js` | 已經處理過「別人的資料進來要標授權」這件事（`NOTICE`） |
| 控制器 profile 與一台一頁 | `packages/midi/profiles/`、`tools/build-controllers.mjs` | 燈具 profile 與燈具頁照同一套做法（之後的設備大集合共用） |

repo 裡目前沒有任何 DMX 程式碼（grep `dmx|art-net|sacn` 只出現在 QLC+ 相關的三個檔）。

## 2. 傳輸層：一個 universe 的 512 個位元組怎麼離開電腦

DMX512 本身是 RS-485 上的序列訊號：一個 break、一個起始碼（0）、最多 512 個 0–255 的值，每秒最多約 44 次。電腦送 DMX 有三條路：

| 路 | 做法 | 瀏覽器 | Node | TouchDesigner | 這次做不做 |
|---|---|---|---|---|---|
| **Art-Net**（UDP 6454） | `Art-Net\0`＋OpDmx `0x5000`＋版本 14＋序號＋15 位元 universe＋長度（偶數，2–512）＋資料。廣播或單播到節點 | 不能直接送，走 out-bridge | `dgram` | DMX Out CHOP 選 Art-Net；DMX In CHOP 可以收 | ✅ 第一優先（最普及，免費監看工具最多） |
| **sACN／E1.31**（UDP 5568） | Root＋Framing＋DMP 三層，126 位元組表頭，多播位址 `239.255.<universe 高位>.<低位>`，有優先權（0–200，預設 100）與來源名稱、CID | 同上 | `dgram`（多播或單播） | DMX Out CHOP 選 sACN | ✅ |
| **USB-DMX：Enttec DMX USB Pro 相容** | 序列封包 `0x7E`、label `6`、長度低位、高位、起始碼＋資料、`0xE7` | ✅ Chrome／Edge 的 Web Serial 可以直接送，**不用橋接器** | 用現有 serial sink 的開埠方式 | DMX Out CHOP 選 Enttec | ✅（瀏覽器直送＋橋接器兩條都做） |
| USB-DMX：Enttec Open DMX（FTDI 裸晶片） | 電腦自己用序列埠做 break 與時序 | Web Serial 的 `setSignals({break})` 做得到，但時序抖動大 | 零相依做不到可靠的 break | 支援 | ⚠️ 只做瀏覽器版並標「實驗性」；零相依的 Node 版不做 |
| WLED | DDP（已有）、也收 Art-Net 與 sACN | — | 已有 | — | 已有，不動 |

- 取捨：瀏覽器直送（Web Serial）適合一個人帶一台介面的小場；網路協定（Art-Net、sACN）適合場館既有的節點與多 universe。兩條都要，因為課堂學員多半只有便宜的 USB 介面，場館多半是 Art-Net 節點。
- 更新率：橋接器固定 40 Hz 送出（DMX 上限約 44 Hz），值沒變也每秒至少補送一次（Art-Net 節點與 sACN 接收端收不到資料約 2.5 秒會判定來源消失）。
- 不做：RDM（遠端設定燈具位址）、Art-Net 的節點探索（ArtPoll）先不做，列在第 8 節。

## 3. 燈具層：profile、patch、模式

**profile 格式**：`open-audiovisual/fixture@1`，一台一個 JSON，放 `packages/dmx/fixtures/`，附 JSON Schema。欄位對齊 Open Fixture Library（OFL）的概念，轉得過來也轉得回去：

```json
{
  "format": "open-audiovisual/fixture@1",
  "id": "generic-rgbw",
  "manufacturer": "Generic", "name": "RGBW par",
  "kind": "par",
  "modes": [
    { "id": "4ch", "name": "4 channel", "channels": ["red", "green", "blue", "white"] },
    { "id": "6ch", "name": "6 channel", "channels": ["dimmer", "red", "green", "blue", "white", "strobe"] }
  ],
  "channels": {
    "dimmer": { "type": "intensity", "default": 0 },
    "red": { "type": "color", "color": "red" },
    "strobe": { "type": "strobe", "default": 0, "ranges": [{ "from": 0, "to": 9, "is": "open" }, { "from": 10, "to": 255, "is": "strobe", "hz": [1, 20] }] }
  },
  "sources": [], "license": "MIT", "verified": false, "verifications": []
}
```

- 通道類型（先收這些）：`intensity`、`color`（red／green／blue／white／amber／uv／cyan／magenta／yellow）、`pan`、`tilt`（含 16 位元的 fine 通道）、`strobe`、`zoom`、`focus`、`gobo`、`colorWheel`、`speed`、`control`（重置、燈泡開關這類危險通道）、`generic`。
- `verified` 與 `verifications` 跟控制器 profile 同一條規矩：沒有人拿真機驗過就不能寫 `true`。
- **資料來源與授權**：
  - 通用燈具（調光器、RGB、RGBW、RGBA、RGBAW+UV、單色頻閃、通用搖頭燈 8／16 通道）自己寫，MIT。
  - Open Fixture Library：repo 授權 MIT（2026-11-24 用 GitHub API 讀到 `MIT`，274 顆星，當天還有更新）。寫 `tools/import-ofl.mjs` 把 OFL 的 JSON 轉成我們的格式，轉出來的檔放 `packages/dmx/fixtures/imported/`，每檔標 `"license": "MIT"`、來源檔與 commit，`NOTICE` 加一段。**這次只做轉換器與少量樣本**，整批匯入是設備大集合那一題的範圍。
  - QLC+ 的燈具定義（Apache-2.0）可以比照控制器的做法，之後再說。
  - 不收：有著作權的手冊內文、GPL 的資料。
- **patch**：把燈具放到 universe 與起始位址上。檢查位址超出 512、兩台重疊、模式不存在。可以存成 JSON、讀回來。
- **高階屬性**：寫作品的人不該記「第 37 通道是紅」。patch 之後每台燈有 `dimmer`、`color`（給 RGB，系統自動換成這台燈有的顏色通道：RGB、RGBW、RGBA、CMY）、`pan`、`tilt`（0–1，自動拆成粗細兩個通道）、`strobe`、`zoom`。沒有調光通道的 RGB 燈，`dimmer` 會乘進顏色裡。

## 4. 控制層：scene、cue、chase、fade、effect

一個純函式的引擎：給它時間，回傳每個 universe 的 512 個位元組。同樣的時間永遠得到同樣的結果，所以可以沒有硬體就測，也可以錄影時逐格重現。

合成順序（由下往上）：

1. **scene**：一組「哪台燈的哪個屬性是多少」。
2. **cue**：切到某個 scene，帶 fade 時間（進、出可以不同）與曲線。cue 列表可以由 `@openav/score` 的段落觸發。
3. **chase**：幾個 scene 輪流，每步的長度用秒或拍（跟 `@openav/drums`、MIDI clock 的拍子走）。
4. **effect**：對一群燈做隨時間變化的東西：正弦、鋸齒、方波、彩虹、追光（每台燈之間錯開相位）、隨機閃爍（有種子，可重現）。作用在 dimmer、顏色、pan、tilt 上。
5. **即時覆寫**：參數直接推的值（推桿、音訊）。
6. **限幅**：每台燈可以設上限（例如 dimmer 最多 0.8）、pan 與 tilt 的可動範圍。
7. **總控（grand master）** 與 **blackout**。

**跟 OAV 既有輸入串起來**（守「連續控制走參數」那條鐵則）：DMX 引擎不自己讀 MIDI 或音訊。它把自己的控制點登記成參數（`dmx/master`、`dmx/blackout`、每個群組的 `dimmer`、`hue`、`saturation`、每個 effect 的 `rate` 與 `depth`、每個 chase 的 `run`），mapping 層就能把任何訊號接上去：

- 音樂驅動燈光：`audio/level` → 群組 dimmer、`audio/onset` → 觸發 chase 下一步、`chord/consonance` → 色相。
- MIDI 控制器操作：推桿 → 群組 dimmer，pad → cue，旋鈕 → effect 速度。學過的對應存在 map 檔裡。
- 時間軸與樂譜：cue 掛在 score 的段落上。
- 一個作品同時畫畫面又打燈：world 的顏色參數可以同時餵畫面與燈具。

## 5. 安全

| 項目 | 做法 |
|---|---|
| blackout | 一個參數、一個方法，蓋過所有東西（除了標為「不受 blackout 影響」的通道，例如搖頭燈的位置） |
| 限幅 | 每台燈、每個屬性的上下限；總控 |
| 頻閃上限 | effect 產生的明暗閃爍預設不超過每秒 3 次（光敏性癲癇的通用安全線），要更快必須在設定裡明確打開。燈具自己的 strobe 通道同樣受這個上限管 |
| 危險通道 | `control` 類型（重置、燈泡開關）預設不能被 effect 或 mapping 碰到，只能明確呼叫 |
| 斷線 | 頁面停止說話 → 橋接器看門狗把 universe 放到安全值。可選 `hold`（停在最後的樣子，演出中常要這個）或 `safe`（預設：全暗，位置通道不動） |
| 橋接器結束 | 收到 SIGTERM／SIGINT 先送一格安全值再關（現有行為） |
| 測試用瀏覽器 | 沿用鐵則：驗收用的瀏覽器不授予序列埠與 MIDI 權限，全部走模擬 universe |

## 6. 沒有硬體時怎麼看、怎麼測

- **模擬 universe**：transport 選 `sim`，值只留在記憶體。
- **頁面上的監看器**：512 格的通道表（數值與亮度條）＋一張「燈具視圖」，把 patch 好的燈畫成色塊（顏色、亮度、搖頭燈的指向），不用真燈就看得出一個 cue 長什麼樣。
- **Node 端的接收器**：測試裡開一個 UDP 埠收 Art-Net 與 sACN，把封包解回 512 個值比對。封包位元組另外對規格寫死比對（表頭、opcode、長度、universe 編碼、sACN 三層的長度欄位）。
- **未實測（要有硬體才能確認）**：真實 Art-Net 節點與 sACN 接收端的相容性、Enttec DMX USB Pro 實機、Open DMX 的時序、任何一台真燈的通道對照。可以用免費的 Art-Net 監看軟體或 TouchDesigner 的 DMX In CHOP 當第二個接收端驗一次，這步需要人操作，列在驗收清單。

## 7. 要做出來的東西

```
packages/dmx/
  index.js            出口
  universe.js         512 個位元組的 universe、多 universe
  fixture.js          讀 profile、檢查、屬性 → 通道
  patch.js            放燈、查重疊、存讀 JSON
  engine.js           scene／cue／chase／effect／限幅／總控／blackout，純函式
  color.js            RGB → RGBW／RGBA／CMY
  protocol/artnet.js  編碼與解碼（純函式，瀏覽器與 Node 共用）
  protocol/sacn.js
  protocol/enttec.js
  transport.js        sim、OutClient（走橋接器）、Web Serial（Enttec Pro，Open DMX 實驗性）
  monitor.js          頁面上的監看器（通道表＋燈具視圖）
  params.js           把控制點登記成參數
  fixtures/*.json     通用燈具 profile＋fixture.schema.json
  lab.wire.js         lab.cheyuwu.com 用（lab.dmx）
  reference.mjs       API 參考條目（中英）
packages/out/bridge/sinks/artnet.js、sacn.js、enttec.js   橋接器的三個新 sink
tools/import-ofl.mjs  Open Fixture Library → 我們的格式
examples/28-dmx-lights/   沒有硬體也能玩：畫面＋監看器，音訊與 MIDI 推燈
docs/dmx.md、docs/zh/dmx.md   手冊一章
tests/dmx*.test.js
```

分兩段做，每段一個 commit、測試全綠：

1. **核心**：universe、fixture、patch、color、engine、三個協定的編解碼、通用燈具 profile、OFL 轉換器、測試。全部純邏輯，不碰瀏覽器。
2. **接出去與給人用**：橋接器三個 sink（含安全值）、transport、監看器、參數登記、範例 28、手冊一章、API 參考條目、lab 宣告。

API 都是新增的，沒有不相容變更。`@openav/out` 只加 sink，既有設定檔不用改。

## 8. 這次不做（之後看需要）

- RDM、ArtPoll 節點探索、Art-Net 的同步封包（ArtSync）。
- 像素映射（把畫面取樣到燈條矩陣）。WLED 的 DDP 已經能做基本的，之後跟 DMX 的像素燈一起想。
- oav-p5 的全域函式（例如 `dmx()`）。每個公開名字都要有參考條目與可跑的範例，等核心穩了再開。
- 整批匯入 OFL 的燈具與一台一頁的燈具頁：屬於「設備大集合」那一題，等哲宇對整體方向點頭。

## 9. 驗收清單

- [ ] `npm test` 全綠，含新測試；`tools/release.sh --dry-run` 過。
- [ ] 範例 28 本機開起來零 console 錯誤，沒有硬體時監看器看得到燈在動（截圖）。
- [ ] 橋接器開著，本機 UDP 接收器收到正確的 Art-Net 與 sACN 封包。
- [ ] 關掉頁面，接收端 500 ms 內看到安全值。
- [ ] 回報裡寫清楚哪些未用真燈實測。

## 合進 main 之前第一優先：每台燈的頻閃總和上限（光敏安全）

**現在的洞。** 每秒 3 次的上限是「每個 effect、每個 chase 各自」算的，而且即時值（麥克風、鼓、推桿）完全不受管。所以：

- 兩個各 3 Hz 的 effect 疊在同一台燈上，那台燈可能每秒閃到 6 次。
- 一條 `drum/kick/env → dimmer` 的對應在 180 bpm 的十六分音符下是每秒 12 次，沒有任何東西攔它。
- 上限保護的是「每一個來源」，但會傷到人的是「一台燈實際發出來的光」。這兩件事現在不是同一件。

這是預設值該擋住的事，所以排在看預覽、合 main 之前。

**修法：兩層，都以「一台燈」為單位。**

1. **引擎裡（算得出來的部分，保持可重現）**。合成每台燈的時候，把作用在它的亮度或顏色上、會閃的來源（effect、chase）的頻率加起來。總和超過上限，就把這幾個來源在這台燈上的速度等比例放慢到總和等於上限（以拍為單位的照現有做法對半降，留在拍子上）。純函式，同樣的時間還是同樣的結果，錄影逐格重現不受影響。`state()` 列出哪台燈被放慢、放慢多少，監看器上看得到。
2. **輸出前的最後一道（什麼來源都擋）**。在 `dmxTransport` 送出去之前，對每台燈看「實際要送出的亮度」（調光 × 最亮的顏色通道）：一次閃＝亮度往上再往下、變化超過滿刻度的 10%（WCAG 2.3.1 對「閃」的定義）。任何一秒內已經閃了 3 次，就不讓第 4 次發生，亮度停在原處慢慢跟上（限制變化速度，不是切黑）。這層有記憶，所以放在引擎外面；它擋得住即時值、兩個引擎疊加、以及第 1 層算不到的組合。
   - 預設開。要關必須在設定裡寫明（例如 `flashGuard: false`），而且監看器上要一直顯示「頻閃保護已關閉」。
   - 橋接器的三個 sink 也放同一道（設定檔可關），這樣別的程式經由橋接器送 DMX 時一樣受保護。
   - 燈具自己的 strobe 通道照現有規則：profile 沒寫 Hz 的一律不閃，有寫的不超過上限。

**驗收。**
- 測試：兩個 3 Hz effect 疊一台燈 → 那台燈一秒內的亮暗轉換不超過 3 次；180 bpm 的鼓推調光 → 同上；關掉保護時才會超過；錄影路徑（只有第 1 層）同一時間兩次算出來一樣。
- 手冊安全那一節改寫：上限是「每台燈」，並說明兩層各擋什麼。
- 範例 28 的鼓與麥克風對應不再靠平滑來守，平滑留著是為了好看。

**沒擋到的要講清楚。** 整個場地的總閃爍面積（很多台燈同時閃）、畫面本身的閃爍（投影與螢幕）不在這兩層的範圍；pan／tilt 的快速移動不算閃。這些寫進手冊，不假裝有擋。

等哲宇回第 2 題（DMX 預覽）時一起做，做完再給他看。

## 實作紀錄

### 2026-11-25 02:1x 兩段都做完，在分支上，還沒進 main

| commit | 內容 |
|---|---|
| `fd0ea7c1` | 核心：`@openav/dmx`（universe、燈具 profile 與 schema、patch、顏色換算、引擎、Art-Net／sACN／Enttec 編解碼、8 個通用燈具、OFL 轉換器） |
| `f1ade536` | 接出去：橋接器的 `artnet`、`sacn`、`enttec` 三個 sink，`dmxTransport`（sim／橋接器／Web Serial）、`dmxParams`、`mountDmxMonitor` |
| `7b4cb00e` | 範例 28（8 顆 par＋2 顆搖頭燈，畫面與燈吃同一組參數）、手冊一章（中英）、`lab.dmx` |

驗收（親驗的標「親」）：
- 測試 1,516 條、1,470 過、0 失敗、46 略過；`tools/release.sh --dry-run` 過。DMX 與 out 相關 96 條我重跑過（親）。
- 封包位元組：Art-Net 表頭與 opcode、sACN 638 位元組與長度欄位、Enttec 框，抽查與規格相符（親）。
- 範例 28 的截圖看過：舞台、燈具色塊、512 格通道表、六條對應都在（親）。零 console 錯誤、沒有授予 MIDI 與序列埠權限，是實作的分身用無頭 Chromium 跑的。
- 橋接器送 Art-Net 到本機接收器約每秒 39 包，關掉分頁後 5 毫秒內收到安全值（分身實測）。

跟設計不一樣的地方：
- Art-Net **預設單播**到設定的 `host`。Art-Net 4 不允許廣播 DMX 封包，第 2 節原本寫「廣播或單播」，以這裡為準；要廣播得在設定裡明確打開。
- 「universe 1」在 Art-Net 是 Port-Address 1、在 sACN 是 universe 1，全系統一致。
- 斷線時要停在原樣的通道，在 `safe` 裡寫 `"hold"`（先符合的規則贏），不是另一個 `onLoss` 設定。搖頭燈的位置可以停住、其他全暗。
- 兩台燈位址重疊只列在 `check()` 裡，不擋（兩顆一樣的 par 共用位址是常見做法）。
- 頻閃上限每個 effect、每個 chase **各自**算。兩個疊在同一台燈上，加起來可能超過每秒 3 次。即時值（麥克風、鼓）不受上限管，範例裡那幾條對應有加平滑。
- 通用燈具的 strobe 通道沒有寫 Hz，在上限開著的時候一律保持不閃。

順手修掉的三個既有問題（都在 `@openav/out`，有測試）：
- 瀏覽器端的心跳在有值排隊時會跳過，一直在變的燈 500 毫秒後被看門狗打回安全值。
- 橋接器一批只讀前 1,024 個值，超過兩個滿的 universe 後面的會被看門狗重設。現在讀到 4,096。
- `install.sh` 沒有複製 DMX 編碼器，裝好的橋接器會起不來。

**未實測**：任何真的 Art-Net 節點、sACN 接收端、Enttec DMX USB Pro、Web Serial 埠、任何一台燈；真實網路上的多播；TouchDesigner DMX In CHOP 對收（TD 沒連上）；Linux 的序列埠路徑。E1.31 的位元組排列是對照兩套開源實作確認的，官方規格書抓不到。

還沒做：changelog 沒有條目；`sinks/serial.js` 只支援 macOS；沒有從 patch 自動產生 `safe` 表的工具；1440 寬時導覽卡會蓋到監看器左邊。
