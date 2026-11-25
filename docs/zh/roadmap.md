# 路線圖

指導原則：真實演出要求過的功能，框架才長。（核心就是這樣來的：這裡的每個模組，都先撐過一場真正的演出，才整理成通用的形式。）

## v0.x — 底盤（現在）

- [x] 四層：輸入（midi/audio/chord/pose）→ 映射 → 世界 → 輸出
- [x] 時間軸：場景、負的待命時間、cue 掛鉤
- [x] 導演控台＋演出模式
- [x] 後台監看（零相依的 WS 中繼，支援區域網路裡的裝置）
- [x] OSC 橋接、MIDI 輸出（走同一個看得到的出口，附 panic）
- [x] 所有純邏輯都有測試（和弦、時間軸、映射、參數）
- [x] 映射設定檔的匯入／匯出介面（JSON 檔案、拖進頁面、`?map=<網址>`，每個世界各記一份）
- [x] 範例：由現場樂器（麥克風）驅動、隨聲音反應的世界，`06-cylinder-earth`
- [x] 鼓機，送出的訊號跟分析器的長得一樣（`@openav/drums`）
- [x] 螢幕上的 MIDI 控制器，跟著真實硬體同步動作（`@openav/midi`，範例 09）
- [x] 文件網站：[openaudiovisual.com/docs](https://openaudiovisual.com/docs/)
- [x] oav-p5：任何 p5.js 草圖加一行，就有控制器、手機、麥克風、聲音、能用一行字寫節奏的鼓機、小節與 cue、錄影，版本號自己算（[更新紀錄](https://openaudiovisual.com/zh/changelog/)）
- [x] 一行節奏：TidalCycles／Strudel 式的 mini-notation（`@openav/pattern`）
- [x] 像 TouchDesigner 的 CHOP 那樣處理隨時間變的數值：lag、包絡、速度、彈簧、trail（`@openav/chop`）
- [x] 和 Strudel 並排：程式送進 OAV Virtual MIDI 的音、外部 MIDI 時鐘、`link=房間名` 跨分頁也跨電腦（[和 Strudel 一起用](strudel.md)）
- [x] 整場的 automation 在控台上攤成曲線、以總譜的段落為單位寫曲線、automation 存成 JSON 再讀回來、時間軸錨定在牆上的時鐘（[演出控制](show-control.md)）
- [x] 會在時間軸上微調、或等你轉到位才接手的對應，用完把參數還回去（`@openav/mapping`）
- [x] 好幾個頁面演同一場：一個主控和它的從屬端，同一個瀏覽器或跨機器（`@openav/sync`）
- [x] 整個框架有版本號，和一個永遠不變的網址。一個檔就是一場演出，不用 clone（[固定一個版本](getting-started.md#pin-a-version)）
- [x] [用它做的](https://openaudiovisual.com/zh/made-with/)：跑在它上面的作品，每一筆都是作者自己加的
- [x] 把舞台送上投影機或第二個螢幕：輸出視窗、四角校正、並排投影機的裁切、黑場與亮度參數，以及給 OBS 和 TouchDesigner 的乾淨網址（`@openav/output`，[投影與影像輸出](output.md)）
- [x] 平放在桌上的幾台螢幕變成一張畫布，拍一張照片定位，用同一個時鐘（`@openav/tile`，[多螢幕拼接：一張畫布](tile.md)）。真的桌子、真的手機：還要試
- [x] 由好幾路輸出組成的牆，從一份佈局檔來：校正圖樣、廠商對位圖和輸出映射讀同一份資料，手動調四角、網格、羽化和遮罩，以及格雷碼圖樣（`@openav/align`，[投影與 LED 牆對位](align.md)）。真的投影機：還要試
- [ ] 用相機自動對位：取像、解碼、相機與投影機的對應、解出網格、量測的熔接（[還沒做的部分](align.md#what-is-not-built-yet)）

## 讓這一層不用再有人重做

目標是：在網頁上做一場演出，從這裡開始，就像架網站從一台別人已經在顧的伺服器開始。一層東西要做到這樣，得讓人不用問就能蓋在上面。需要的東西，和每一項現在的位置：

| 項目 | 現在有的 | 接下來 |
|---|---|---|
| 可以依賴的版本 | 0.9.0、固定的網址、更新紀錄 | 1.0：世界的約定、訊號名稱和設定檔格式，沒有換主版本就不再變 |
| 不用 repo 的入口 | 一個檔加一個 `import` | 控制器頁面和手機遙控也有一樣的入口 |
| 別人讀得懂的格式 | 附 JSON Schema 的控制器設定檔、匯出成 QLC+ 與 Mixxx、對應檔、總譜 | 每種格式有自己的版本號。設定檔格式成為其他工具也採用的格式 |
| 信得過的控制器 | 55 份設定檔，每個數字都有出處，還有一頁能用手驗實機 | 第一批在實機上驗過的設定檔，更多來自手上有那台的人 |
| 現場的食譜 | OSC 送到 TouchDesigner、燈光與空間音訊。畫面送上投影機，以及寫好的 OBS 和 TouchDesigner 做法和場地清單（[投影與影像輸出](output.md)） | OBS 和 TouchDesigner 的做法在各自的軟體裡跑過。展示用的 iPad |
| 證明 | 它出身的那幾場演出 | [用它做的](https://openaudiovisual.com/zh/made-with/)上有別人的作品 |
| 發問的地方 | issue、要一台控制器的表單、登記作品的表單 | 幾天內有回音 |

## v1.x — 演出長大

- **觀眾裝置輸入**：*經典控制器已經上線*（`@openav/relay`、`@openav/surface`、`@openav/remote`）：零相依的房間伺服器、`phone/{id}/*` 感測器、一組類似 TouchOSC 的控制元件、版面 JSON、`autoSurface(params)`、回饋到手機。接下來：
  - [x] 加入卡片上的 QR code（`@openav/remote/qr`，約 150 行、零相依的編碼器）：在靜態主機上，演出改用公開中繼加隨機房間，所以 openaudiovisual.com 上的範例也能接手機
  - [ ] *實驗性的*控制面板：手勢／物理控制元件、多人共用的控制面板、觀眾模式（很多支手機 → 彙整成 `crowd/tilt/mean` 這類訊號）
  - [ ] 麥克風當作手機感測器、每台裝置各自的設定檔、版面編輯器／匯入匯出介面
- **總譜與導演**：*已經上線*（`@openav/score`）：用段落長度寫成的版本、衍生版本、cue、`hold`、壞了只停自己的段落模組、提詞機上的 acts、總譜轉 MIDI 標記。接下來：
  - [x] 收 MIDI clock：`@openav/midi` 的 `MidiClock` 跟著 start、stop、song position 走，oav-p5 的鼓機和 `drumPhase` 也跟著它（0.7）
  - [ ] 總譜跟著外部時鐘走，以及送出 clock 與 transport，讓 DAW 當總譜的主時鐘，或跟著總譜走
  - [ ] cut 裡的 `clocks` 表，只有哪一場演出需要引擎跑在兩條不同的時間線上才做（見[總譜與導演](score.md#clocks-why-there-are-none)）
  - [ ] 導演台上的總譜編輯器：拖一段的長度，看每個 cue 跟著移動
- **訊號錄製與重播**：*MIDI 錄音已經上線*（`@openav/record`：`TakeRecorder`、`TakePlayer`，`.mid` 可進可出；`EventLog` 已經能在錄影時記下任何訊號）。接下來：把完整的訊號流（手、身體、聲音分析）重播給任何一個世界。演奏者不在也能排練。存下來的不只影片，還有手勢。
- **把 `@openav/*` 發布到 npm**，等 1.0 說清楚哪些東西不再變（在那之前：[固定一個版本](getting-started.md#pin-a-version)），文件頁面本身也能用這套框架來演奏。
- **WebGPU 世界轉接**，等 WebGPU compute 成熟，給粒子與群體代理類的世界用。

## v2.x — 舞台變寬

- **畫面進入影像流程**：先用現成的工具寫成食譜（OBS 的 Browser Source 加 NDI 輸出、TouchDesigner 的 Web Render TOP）。*食譜寫好了*（[投影與影像輸出](output.md)），也有給它們用的乾淨網址（`?output`）和輸出視窗。各個軟體拿到頁面後的表現，還要在軟體裡實際跑過。那些做不到、而且有演出需要的時候，才做自己的閘道（headless 瀏覽器 → NDI）。
- **分散式演出**：透過 WebRTC data channel 同步多個瀏覽器的訊號：好幾台電腦、一個訊號空間、分處各地的合奏團。時鐘的那一半已經做好了：好幾個頁面演同一場，從屬端透過 BroadcastChannel 或房間中繼追著主控端的時間軸（`@openav/sync`）。訊號則仍然留在收到它的那個頁面。
- **AI 代理演奏者**：由 LLM 驅動的代理訂閱訊號、寫入參數，在人旁邊一起即興（來歷：《The Last Input 終局之前》裡自主行動的城市代理）。

## 不做的事

- 節點式的視覺編輯器（cables.gl 已經做得很好，我們是函式庫）
- 自己的一套合成工具（Tone.js 是鄰居：`@openav/sound` 把它包在一份精簡的引擎介面約定後面，`audio.input()` 也接受它的 node）
- 變成一個平台：你的演出就是你的 repo，不是我們伺服器上的一個帳號
