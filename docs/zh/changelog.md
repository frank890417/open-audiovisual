# 更新紀錄

改了什麼，新的在上：每一條寫現在可以做什麼，以及手冊在哪裡講。**oav-p5** 是給 p5.js 草圖的那一行
（[p5.js 一行接上](p5.md)），有自己的版本號：載入它的草圖，按 🎹 → 🩺 就看得到。**框架與網站**依日期列。
每一條都連到它的 commit，完整的歷史在 [commit 紀錄](https://github.com/frank890417/open-audiovisual/commits/main)。

## oav-p5

### 0.8.4

2026-10-20 · [e9ad495](https://github.com/frank890417/open-audiovisual/commit/e9ad495)

- **🥁 打開的鼓機先不出聲。** 按 🎹 面板的 🥁，或重整後自動回來的鼓機，格子會出現但播放框沒勾，勾了才開始打。
  草圖自己呼叫 `startDrums()` 的照樣直接播放。[startDrums](https://openaudiovisual.com/zh/docs/reference/#startDrums)

### 0.8.3

2026-10-20 · [8a9be83](https://github.com/frank890417/open-audiovisual/commit/8a9be83)

- **幾格以前。** `lastKickFrameCount`、`lastSnareFrameCount`、`lastHatFrameCount`、`lastBeatFrameCount`、`lastNoteFrameCount`
  是看到這一下的那一格的 `frameCount`。在 `kickIsDetected` 是 true 的那一格，`frameCount - lastKickFrameCount` 是 0，接著是 1、2、3……，
  可以讓形狀在每一下之後固定留幾格。[lastKickFrameCount](https://openaudiovisual.com/zh/docs/reference/#lastKickFrameCount)

### 0.8.2

2026-10-20 · [b0ebbd7](https://github.com/frank890417/open-audiovisual/commit/b0ebbd7)

- **打擊也有像 `mouseIsPressed` 的值。** `kickIsDetected`、`snareIsDetected`、`hatIsDetected` 在大鼓、小鼓、鈸打到的那一格是
  true（鼓機的，或沒有鼓機時麥克風的）。`lag()` 把 `true` 當成 1，所以 `lag(kickIsDetected, 0, 0.3)` 就是一個閃到 1 再慢慢退的數字，
  可以拿來控制透明度或大小。[kickIsDetected](https://openaudiovisual.com/zh/docs/reference/#kickIsDetected)
- **上一下是什麼時候。** `lastKickTs`、`lastSnareTs`、`lastHatTs`、`lastBeatTs`、`lastNoteTs` 用 `millis()` 的時鐘，
  `millis() - lastKickTs` 就是幾毫秒前。第一下之前是 `-Infinity`。[lastKickTs](https://openaudiovisual.com/zh/docs/reference/#lastKickTs)

### 0.8.1

2026-10-20 · [096914f](https://github.com/frank890417/open-audiovisual/commit/096914f)

- **🎹 面板放你要的地方。** 面板上多兩個按鈕：「位置」依序切換下方、上方、浮動（浮動時拖曳上面那一列就能移動），「大小」
  依序切換小、中、大。這個瀏覽器會記住。沒有設定 `dock` 時，面板改成一開始在下方，OpenProcessing 也一樣，之前放在上方會蓋住
  草圖。只有面板和 🎹 在同一個邊時，🎹 才會讓開。[dock](https://openaudiovisual.com/zh/docs/reference/#option-dock)
- **重整之後，剛剛開著的會回來。** 在 OpenProcessing 按 Cmd+Enter（或同一個頁面重新整理），面板原本開著就自動打開，
  從面板 🥁 開的鼓機也會用你最後那一行節奏和速度再打起來。草圖自己用程式開的鼓機照草圖的。收起面板、關掉鼓機，重整後也保持關著。
- **鼓機在打的時候，一下大鼓就是一下大鼓。** 鼓機播放時，麥克風聽到的大鼓、小鼓、鈸和拍子不再叫草圖的函式。之前它聽到的
  多半是喇叭放出來的鼓聲，所以大鼓那一下也會叫 `snareDetected`。`micLevel` 和三個頻段照樣跟著麥克風。[kickDetected](https://openaudiovisual.com/zh/docs/reference/#kickDetected)
- **OpenProcessing 的 console 不再自己跳出來。** OpenProcessing 只要 console 有一行字就會蓋在草圖上，所以在那裡 oav-p5
  不再印它自己想說的話（接線、卡片上已經有的提示、聲音開了）。你的程式出錯、呼叫寫錯、🩺 體檢照樣會印，`debug` 可以全部找回來。

### 0.8.0

2026-10-16 · [9bdde95](https://github.com/frank890417/open-audiovisual/commit/9bdde95)

- **收音符號碼的地方，音名也能用。** `noteIsDown('C4')` 就是 `noteIsDown(60)`，`midi.play('C#4', 0.8)` 送出音符 61，
  新的 `midi.isDown('Eb3')` 用音名問一個鍵。`C4`、`c#4`、`Db3`、`F♯2`、`C-1`（0）到 `G9`（127）都行；C4 是 60
  （有些軟體，像 Ableton 和 Yamaha，把 60 叫 C3）。Strudel 的小寫寫法（`c4 e4 g4`）也行。寫錯的音名會停下來，
  跳出一張卡片告訴你怎麼寫。數字的行為跟以前完全一樣，`notePressed(note, velocity)` 拿到的仍然是號碼。[音名](p5.md#note-names)
- **三個換算函式：** `noteNumber('C4')` 得到 `60`，`noteName(61)` 得到 `'C#4'`（`{ flats: true }` 是 `'Db4'`，
  `{ octave: false }` 是 `'C#'`），`noteFreq('A4')` 得到 `440` 赫茲，給自己合成聲音的草圖用。
- 現成草圖：`p5/examples/note-names/`（範例 24）。

### 0.7.0

2026-10-15 · [89c05ac](https://github.com/frank890417/open-audiovisual/commit/89c05ac)

- **格子和那一行字是同一個東西。** 點鼓機的格子，那一行字跟著改寫（`bd*4`、`bd(3,8)`、`[~ sd]*2` 這種人會寫的樣子）；
  直接在樂譜行打字，停手就套用，格子跟著變。打錯的字標紅，鼓機繼續打上一個能用的版本。↶ 或 ⌘Z 回上一步，
  「複製」給你一行 `startDrums("…", 120)`，「在 Strudel 打開」把同一個節奏帶去 strudel.cc。[一行節奏](p5.md#one-line-of-rhythm)
- **`drawRhythm(x, y, w, h, 'circle')`：**把節奏畫在畫布上，三種樣子（`grid`、`circle`、`spiral`），跟著 `drumPhase` 轉，
  錄影錄得進去。[畫在畫布上的節奏](p5.md#the-rhythm-on-the-canvas)
- **像 TouchDesigner CHOP 的數值工具：**`lag(micLevel, 0.03, 0.4)`（Lag CHOP，秒數跟 TouchDesigner 一樣：大約跟上
  90% 的時間）、`env('kick', 0.01, 0.3)`（Trigger）、`speed()`、`spring()`、`trail()`、`slope()`、`count()`，
  `draw()` 裡一行一個，不用宣告；`scope(值, '標籤')` 在角落畫出數值的曲線（不會錄進影片），`drawTrail()` 畫在畫布上。
  新套件 `@openav/chop`。
- **跟 Strudel 一起用：**在 strudel.cc 載入這一行，旋鈕、手機、麥克風就能當 Strudel 的參數；Strudel 的
  `.midi('OAV Virtual MIDI')` 送來的音符照時間戳進到 `notePressed`（實測誤差最大 4.5 毫秒），它的節拍時鐘讓鼓機和
  `drumPhase` 跟著走；`link=房間名` 把音符和時鐘轉到另一個分頁或另一台電腦。新文件〈[跟 Strudel 一起用](strudel.md)〉。
- 現成草圖：`p5/examples/rhythm-visual/`、`p5/examples/lag/`、`p5/examples/with-strudel/`。

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
- **網站跟上 oav-p5（第二批）：**p5 的現成草圖變成範例，每個都有帶路卡和縮圖：16 彈出聲音、17 麥克風、18 鼓機與小節、
  19 一行節奏、20 看得見的節奏、21 錄成影片、22 lag、23 跟 Strudel 一起（[範例](https://openaudiovisual.com/examples/)）。
  首頁多三個常見問題（聲音、鼓和錄影，像 Lag CHOP 那樣讓數值變順，Strudel），/p5/ 連到[和 Strudel 一起用](strudel.md)，
  手冊的快速開始、疑難排解、路線圖和 README 都寫上 oav-p5 現在能做的事。
