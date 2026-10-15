# 更新紀錄

改了什麼，新的在上：每一條寫現在可以做什麼，以及手冊在哪裡講。**oav-p5** 是給 p5.js 草圖的那一行
（[p5.js 一行接上](p5.md)），有自己的版本號：載入它的草圖，按 🎹 → 🩺 就看得到。**框架與網站**依日期列。
每一條都連到它的 commit，完整的歷史在 [commit 紀錄](https://github.com/frank890417/open-audiovisual/commits/main)。

## oav-p5

### 0.6.0

2026-10-15 · [5e75007](https://github.com/frank890417/open-audiovisual/commit/5e75007)

- **畫面再重，鼓都不歪。** 鼓機照音訊時鐘提前排好：`draw()` 每一格故意忙 30 毫秒，大鼓到大鼓的間隔差異是 0.000 毫秒
  （0.5.0 是 15 毫秒）。切到別的分頁，鼓照打、小節照算。`?oav_drums=frame` 可以退回 0.5 版的鼓機。[鼓機](p5.md#drum-machine)
- **一行字寫節奏：**`startDrums("bd*4, [~ sd]*2, hh*8")`。寫法來自 TidalCycles 與 Strudel，OAV 依公開文件獨立實作
  （`@openav/pattern`）。打錯字，卡片會說是第幾個字、為什麼。[一行節奏](p5.md#one-line-of-rhythm)
- **鼓機卡**的軌道名照瀏覽器語言（大鼓、小鼓、鈸、拍手），顯示第幾小節，那一行字裡正在響的字會亮。
- **`drumPhase`、`beatPhase`：**這一小節、這一拍走到哪，0 到 1，連續的。`rotate(drumPhase * TWO_PI)` 一小節轉一圈。
- 現成草圖：`p5/examples/rhythm/`。

### 0.5.0

2026-10-15 · [02aa19c](https://github.com/frank890417/open-audiovisual/commit/02aa19c)

- **錄影，連聲音一起：**`startRecording()`、`stopRecording()`、`recordingSaved(info)`。🎹 面板上的 ⏺ 和 📷 不寫程式也能用。
  [錄影](p5.md#recording-a-video-with-its-sound)
- 畫布和這一行發出的所有聲音（`startSound()`、鼓機、開著的麥克風、p5.sound 1.x）錄成同一個檔：瀏覽器能錄 MP4 就錄 MP4，
  不能就錄 WebM。手機上，卡片的**分享**按鈕可以存進相簿。
- 每錄完一段都會檢查：沒有聲音、錄成 WebM、整段黑、檔案幾乎是空的，卡片會說發生什麼、為什麼。
- 📷 把畫布存成一張 PNG。
- 現成草圖：`p5/examples/record/`。

### 0.4.0

2026-10-15 · [e629115](https://github.com/frank890417/open-audiovisual/commit/e629115)

- **聲音：**`startSound('piano')`。鍵盤、螢幕上的 🎹、手機彈的每個音都聽得到，面板上的 🔊 可以換樂器。
  [聲音](p5.md#sound-what-is-played-is-heard)
- **鼓機：**`startDrums()`，16 格、四軌、五種節奏。每打一下，叫的就是麥克風的 `kickDetected()`、`snareDetected()`、
  `hatDetected()`，所以寫給麥克風的草圖不用改，就跟著鼓機動。[鼓機](p5.md#drum-machine)
- **小節時間軸：**`cue(5, 'bloom')` → `cueFired()`、`barStarted()`、`stepStarted()`。[時間軸](p5.md#timeline-bars-and-cues)
- **出狀況直接寫在畫面上：**🎹 旁邊一張卡片，用瀏覽器的語言寫發生什麼、為什麼、下一步按哪裡。
  [出狀況的時候](p5.md#when-something-goes-wrong)
- **🩺 體檢：**面板上的 🩺（或 `OAVp5.check()`）把版本、麥克風、MIDI、聲音、鼓機、接線整理成一張卡，截圖就能問人。
- `micLevel` 改成照聽起來的大小，房間本身的底噪是 0，`micSensitivity()` 調靈敏度。草圖自己讀的旋鈕，
  不再同時接到 OPC 的拉桿：一顆旋鈕只做一件事。
- 現成草圖：`p5/examples/keys/`、`p5/examples/drums/`。

### 0.3.0

2026-10-15 · [d874044](https://github.com/frank890417/open-audiovisual/commit/d874044)

- **同一行也聽麥克風：**`micLevel`、`bass`／`mid`／`treble`、`beatDetected()`。不用 p5.sound，p5 1.x、2.x 都能用。
  草圖讀到這些名字之前，不會去要麥克風。[麥克風](p5.md#the-microphone)
- **Hydra 裡也能用：**用 `loadScript()` 載同一個檔，再寫 `osc(10, 0.1, () => knob1 * 2).out()`。[在 Hydra 裡用](p5.md#in-hydra)
- 現成草圖：`p5/examples/mic/`。

### 0.2.4

2026-10-14 · [d2572c3](https://github.com/frank890417/open-audiovisual/commit/d2572c3) · tag `p5-v0.2.4`

第一個打上 tag 的版本，包含 0.1 到 0.2.4（從 2026-10-13 開始）。

- **像讀滑鼠一樣讀控制器：**`knob1` … `knob8`、`fader1` …、`pad1` …、`notePressed()`。MIDI 控制器、螢幕上的控制器（🎹）
  和手機，進來都是同一串 MIDI。[像讀滑鼠一樣讀它](p5.md#read-it-like-the-mouse)
- **OpenProcessing：**OP Configurator 的變數照宣告順序接上旋鈕。[搭配 OP Configurator](p5.md#with-op-configurator)
- 手冊有了這一章，中英兩版。在 openprocessing.org 用 p5 2.3.4 實測過。
- 現成草圖：`p5/examples/particles/`、`p5/examples/opc/`。

## 框架與網站

### 2026-10-15

- **MIDI 控制器圖鑑：**每一台都有自己的頁，附完整的 MIDI 對照表，中英兩版。新增 Novation Launchkey 25、37 MK4、
  Launchpad Pro MK3、DJ TechTools Midi Fighter Twister、AKAI APC40 mkII，以及 teenage engineering OP-1 field
  （Miffy Chen 貢獻，pull request #2）。怎麼挑控制器、LED 回饋、許願表單。[控制器](https://openaudiovisual.com/controllers/)
- **範例：**十五個範例分成五條路線，每一頁都有帶路卡。新增 14 時間軸、15 p5.js 一行指令。02 和弦花園改長
  《The Last Input》的 L-system 樹枝。[範例](https://openaudiovisual.com/examples/)
- **新頁面：**[/p5/](https://openaudiovisual.com/zh/p5/)，以及檢查這台裝置能用什麼的 [/check/](https://openaudiovisual.com/zh/check/)。
  手冊寫進各瀏覽器能做什麼，裝置沒有 Web MIDI 時首頁會說。
- **映射與時間軸：**映射可以匯出、匯入、用 `?map=` 載入。時間軸套件有曲線、循環、會觸發的 cue、錄製。
- **手機：**線上範例可以用手機遙控（公開中繼，掃 QR code）。手機直拿時，舞台留在上方。
- **新套件：**`@openav/pattern`（一行節奏）、`@openav/fab`（做不做得出來：3D 列印檢查，匯出 STL、OBJ、GLB、STEP）、
  `@openav/out`（把頁面參數送到 WLED 燈、序列埠馬達板和 OSC，附看門狗）。[套件](packages.md)
- **給 AI 代理和搜尋引擎：**中英兩版 llms.txt、一份 sitemap，以及處理控制器設定檔的 MCP 工具：`list_controllers`、
  `read_profile`、`validate_profile`、`scaffold_profile`。
- 新的 README，以及 `tools/release.sh`：每次更新都照同一個固定順序發佈。
- **網站跟上 oav-p5**：這一頁（更新紀錄）、首頁與手冊頁首並列「oav-p5 版本 · 框架版本」、首頁第四扇門「我用 p5.js／OpenProcessing」、/p5/ 列出現成草圖、手冊裡的範例路徑可以點。入口檔（`/p5/oav-p5.js`）發佈後約一分鐘就換新版。
