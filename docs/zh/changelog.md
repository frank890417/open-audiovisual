# 更新紀錄

改了什麼，新的在上：每一條寫現在可以做什麼，以及手冊在哪裡講。**oav-p5** 是給 p5.js 草圖的那一行
（[p5.js 一行接上](p5.md)），有自己的版本號：載入它的草圖，按 🎹 → 🩺 就看得到。**框架與網站**依日期列。
每一條都連到它的 commit，完整的歷史在 [commit 紀錄](https://github.com/frank890417/open-audiovisual/commits/main)。

## oav-p5

### 0.8.5

2026-11-06 · [a330b30](https://github.com/frank890417/open-audiovisual/commit/a330b30)

- **從 QLC+ 匯入的控制器這裡也能用。** 插上 BCF2000 或 nanoPAD2，或把 `profile` 設成它們的 id，`knob1`、`fader1`、`pad1` 就會跟著那台機器，需要時才抓它的檔案。[profile](https://openaudiovisual.com/docs/reference/#option-profile)

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

### 2026-11-25

- **把舞台送上投影機：0.12.0。** 新的套件 `@openav/output`。`createOutputs(show, { outputs, aspect })` 在載入時宣告演出的輸出，在點擊時呼叫 `outputs.open('main')` 就開出輸出視窗：黑底、沒有控台、游標兩秒後消失，按 F 全螢幕，電腦接了好幾個螢幕時還會列出每個螢幕，點哪個就在哪個全螢幕（Window Management API，只在那個視窗裡點擊時才詢問）。預設是鏡像舞台的畫布（只算一次，畫面完全一樣：量過，大小一樣，顏色一樣）。`{ mode: 'page' }` 則用乾淨網址把同一個頁面再開一次，跟著這個頁面的時鐘和被握住的值。[投影與影像輸出](https://openaudiovisual.com/zh/docs/output/)
- **四角校正，以及跟著場地走的設定。** 在輸出視窗按 E 會出現四個把手：拖到螢幕的四個角（或用 1 到 4 加方向鍵），畫面就彎過去貼合，背後是一個 CSS `matrix3d` 單應矩陣（`cornerPin()`、`toMatrix3d()`）。H 和 V 為背投翻轉，O 轉 90°，[ ] 加黑邊，還有柔邊，按 G 顯示跟著彎的測試圖。設定依輸出名字存在瀏覽器裡，**Export layout**／**Import layout** 把它變成可以帶著走的檔案（`open-audiovisual/output@1`）。[四角校正](https://openaudiovisual.com/zh/docs/output/#output-corner-pin)
- **黑場和亮度是參數，一張畫布可以分給兩台投影機。** 每個輸出都有 `output/<name>/blackout` 和 `output/<name>/brightness`，所以控台、MIDI 推桿和時間軸都推得到投影機。裁切（`{ x, y, w, h }`）把一個 32:9 的舞台分給兩台 16:9 的投影機（沒有邊緣融合）。[一張畫布給兩台投影機](https://openaudiovisual.com/zh/docs/output/#output-two-projectors-from-one-canvas)
- **每場演出都有乾淨網址。** 任何 `createShow()` 的頁面加上 `?output`，就只剩黑底上的舞台和存下來的四個角，沒有控台、鋼琴、提示和導覽卡。`&follow=oav-output`（跨瀏覽器再加 `&via=relay`）讓它跟著演出頁面，`&play` 讓它的時間軸開始播。這就是給 kiosk 瀏覽器、OBS 的瀏覽器來源和 TouchDesigner 的 Web Render TOP 用的網址，章節裡有三種做法和場地清單。OBS 和 TouchDesigner 的步驟是照它們的文件和安裝好的軟體自己的介面文字寫的，標成待確認：兩個軟體都還沒實際跑過，也還沒上過真的投影機。[乾淨網址](https://openaudiovisual.com/zh/docs/output/#output-the-clean-address)
- **範例 29，投影輸出。** 一個照畫布形狀畫圓環的世界、Open output window 按鈕、編輯模式和測試圖，時間軸結尾淡到黑，`?pair` 給兩台投影機。[投影輸出](https://openaudiovisual.com/examples/29-projector-output/)
- **用手設定的值會留著：0.11.0。** 好幾個寫入者碰到同一個參數或同一個引擎的值時，現在由一條規則決定誰說了算，框架裡的每一個寫入者都照它走：最後一個刻意的改變算數，重複不算改變。手（控台的滑桿、`params.override()`、新的 `params.hold()` 和 `sound.set()`、✕）設定的值會一直留著，直到被放開，或有來源真的動了。再送一次同一個讀數的來源（relay 每秒替每支手機的控制項重送一次）、平滑路由的滑行，還有把 `sound/*` 送進聲音引擎的那一步，都不能再把它推掉。`sound.update()` 在值變了的時候才交給引擎，不再每個影格送每一個值（一件裝置作品在 3 秒裡數到 181 次沒變過的音量寫入），trim 也只在加總變了的時候才寫。`params.holder(key)` 說得出是誰握著一個參數，參數面板也會顯示：手握著的名稱是黃色加 ✋，路由握著的是藍色加 ⇄，提示文字裡有來源。[誰握著一個值](https://openaudiovisual.com/zh/docs/mapping/#mapping-who-holds-a-value)
- **升級到 0.11.0。** 作品可能看得出來的不同：自訂的聲音引擎（`modules.sound: { engine }`）在值變了的時候才收到 `set(key, value)`，`enable()` 之後和換樂器之後每個值各收一次，不再每個影格都收，所以寫進引擎的值會留到它的參數動了為止。✕、滑桿或 `params.override()` 之後，路由要等來源改變超過輸入窗的 0.1% 才再接管參數，再送一次同一個讀數不會再把它拿回去。手握著參數的時候才加進來的路由（學來的、匯入的、載入的），從第二個讀數起才接管。別人的任何寫入都會讓滑行停下，寫的是它正經過的那個數字也一樣。沒有手介入的時候，每個影格的值都跟以前一樣。一件作品如果靠著舊的做法，會是這幾種：引擎的 `set()` 必須每個影格都跑，✕ 之後指望手機、OSC 或 relay 的重送把參數放回去，或者程式在開場覆寫了一個參數，指望路由的第一個讀數把它換掉。一行就能原封不動找回 0.10.0，會印出「已不建議使用」的警告：`createShow({ writes: 'legacy' })`（或在 `new Mapper()` 和 `new Sound()` 上寫 `writes: 'legacy'`）。沒有任何名稱被拿掉或改名。新的有：`params.hold()`、`params.holder()`、`sound.set()`、`sound.release()` 和 `writes` 選項。[0.10.0 的規則](https://openaudiovisual.com/zh/docs/mapping/#mapping-the-0-10-0-rule)
- **修正，來自 2026-11-15 的一次審查。** `new Timeline({ anchor: 0 })`（epoch 是 0 毫秒）被當成沒有錨定。`SyncLeader` 的 `cut` 函式丟出錯誤時，每個影格剩下的部分（段落模組、映射器、舞台）都停了，現在那一幀照樣送出、不帶 cut，錯誤只記一次。`SyncLeader.status().followers` 只會變多，所以重新載入的從屬頁面會被算兩次：從屬端現在每 2 秒說一聲還在（`aliveEvery`），`close()` 時說再見，主控端 6 秒沒聽到就把它忘掉（`forgetAfter`）。0.10.0 的從屬端兩樣都不說，照以前那樣算。
- **在手機上：把這一頁傳到電腦，先找控制器。** 首頁、/zh/p5/、範例頁、/zh/controllers/ 和每台控制器的頁面，在窄的觸控螢幕上會出現一小條「把這一頁傳到電腦」：按下去會打開手機的分享選單，沒有分享選單就複製連結，按 × 這次瀏覽就不再出現，按下時記成 `oav_send_to_desktop`（share 或 copy）。[/zh/controllers/](https://openaudiovisual.com/zh/controllers/) 最上面是搜尋框和廠牌篩選，涵蓋每一台控制器的頁面，在手機上，控制器面板要捲到螢幕附近才畫（HTML 不變）。螢幕上的控制器本來就能用手指彈（pointer 事件），這次用觸控螢幕確認過。
- **每一個 oav-p5 名稱都有自己的一頁。** `oav-p5.js` 的 174 個名稱（變數、函式、事件、`OAVp5.*` 成員和載入選項）各有一頁 `/zh/docs/reference/<名稱>/`（`micLevel` 是 [/zh/docs/reference/mic-level/](https://openaudiovisual.com/zh/docs/reference/mic-level/)），有完整的說明、每個範例照樣能直接跑、相關名稱的連結、用到它的範例，以及自己的標題和描述。[API 參考](https://openaudiovisual.com/zh/docs/reference/)仍是所有名稱的索引，搜尋照舊：oav-p5 的名稱在上面是一張短卡片（寫法和一句話說明），標題連到它的頁面，原本的 `#名稱` 連結也都還會到這張卡片。套件的匯出仍在索引頁保留完整說明。速查表、/zh/p5/ 和站內搜尋都連到這些頁面。
- **手冊每一章都有自己的網頁。** 21 章各有自己的網址 `/docs/<章>/`（p5 那一章在 [/zh/p5/](https://openaudiovisual.com/zh/p5/)，原本就有一頁），各有自己的標題、取自第一段的描述、上一章與下一章，目錄和複製按鈕和以前一樣。[/zh/docs/](https://openaudiovisual.com/zh/docs/) 現在是目錄：每一章附第一句話和各節連結。原本連到單頁手冊的連結（`/docs/#mapping-curves`）都還會到同一個標題：站內的頁面直接連到各章的頁面，從別處來的舊連結由 /docs/ 上的一小段程式轉過去。
- **每一台設備都在同一頁，每台燈具也有自己的一頁。** [/zh/devices/](https://openaudiovisual.com/zh/devices/) 依種類列出整個集合，127 台設備，能依種類和廠牌篩選，也能搜尋名稱和別名，搜尋不需要任何網路請求。每一列都連到它的頁面，控制器的網址不變。49 台 DMX 燈具各有一頁：每個模式的通道表、一台虛擬燈具（滑桿走真正的 patch 和顏色拆解，逐通道顯示位元組）、從 `device('<id>')` patch 它並印出頁面上那串位元組的程式碼，以及燈具檔。另外 22 台設備（AG06、MX Brio、Dante Virtual Soundcard、Leap Motion Controller 2、WLED、ENTTEC DMX USB Pro，以及電子零件庫的 16 個零件）也有自己的一頁：附出處的事實、設定、已知問題、程式碼，以及可以帶走的紀錄、零件 JSON 或輸出橋接程式的設定檔。鏡頭和音訊輸入可以在它的頁面上找找看、打開來，只有按下按鈕時才會做。一台設備要在「能試的東西、程式碼、檔案」三樣裡提供兩樣才有自己的頁面，Brother QL-810W 只有紀錄，所以仍是清單上的一列。[設備](https://openaudiovisual.com/zh/devices/)
- **四十二台來自 Open Fixture Library 的 DMX 燈具。** LED PAR 燈和燈條、小搖頭燈、染色燈與圖案燈、兩台頻閃燈，沒有煙機，來自 Chauvet DJ、ADJ、Eurolite、Showtec、Stairville、Cameo、Varytec 等廠牌，從 OFL commit 849343f6 轉換（MIT，每一頁都標明出處），全部是未驗證。匯入程式現在會擋下引擎在真燈上會弄錯的燈具（亮度反過來的 dimmer、屬性接不到的通道、靜止時不亮或遮光片關著的模式、沒有說明書可以對照），矩陣與切換通道也照樣擋下，色輪和圖案輪的每一格保留名稱。它們一次載入一台：`loadImportedFixture(id)` 或 `device(id)`。[SlimPAR T12 BT](https://openaudiovisual.com/zh/fixtures/chauvet-dj-slimpar-t12-bt/)
- **演出設備收成一個集合，一個入口。** 新套件 `@openav/devices`：每一份 MIDI 控制器 profile（手寫的，以及從 QLC+ 轉入的）、每一台 DMX 燈具和電子零件庫的每一個零件，加上 Yamaha AG06、Logitech MX Brio、Dante Virtual Soundcard、Leap Motion Controller 2、WLED、ENTTEC DMX USB Pro 和 Brother QL-810W 的手寫紀錄，收在同一種紀錄格式裡（`open-audiovisual/device@1`，附 schema），每一筆事實都寫出讀到它的原廠頁面。沒有任何東西是複製的：每份紀錄都從它描述的 profile、燈具或零件讀出來，列清單不會載入任何 profile。`devices({ kind, q })` 依名稱、別名、製造商或 id 搜尋，`device(id)` 把一台交給它的套件：控制器的路由、會自己 patch 的燈具、依名稱找到的鏡頭或音訊輸入，你要求時才打開。新的紀錄都還沒有在真機上驗證。[設備](https://openaudiovisual.com/zh/docs/devices/)
- **大家常進來的頁面，最後多了「下一步」。** 每台設備的頁面最後，是那台控制器在 p5.js 草圖裡的用法：`window.OAV_P5 = { profile: '<id>', panel: 'open' }`、載入的那一行和一份草圖，附「複製」按鈕、p5.js 頁面的連結，以及依設備有什麼挑出的一個範例（琴鍵：16，打擊墊：18，旋鈕和推桿：09）。小抄和 API 參考的最後，列出程式裡用到每一組名稱的範例（從範例本身讀出來），以及「用它做的」。範例的帶路卡會寫出同一條路線的下一個範例，路線走完時寫下一條路線，範例 15 也列出它的章節。首頁最後是「用它做的」。[AKAI LPD8](https://openaudiovisual.com/zh/controllers/akai-lpd8/#next-step)
- **網站上的操作開始有紀錄。** 除了瀏覽次數，網站自己的頁面現在另外送出八種 Google Analytics 事件：複製（載入的那一行、其他程式碼、import map）、點連結離開網站（GitHub、廠商的說明書、作品、OpenProcessing）、第一次動螢幕控制器、下載 QLC+、Mixxx 或 JSON 檔、在範例裡第一次點擊或按鍵、點「下一步」的連結、搜尋，以及切換語言。每個內容都只是一個短字或 id，不會有複製或打進去的文字，也不會有連結的路徑或查詢字串。這支程式 `assets/track.js` 只在 openaudiovisual.com 上跑，`p5/oav-p5.js`、`packages/`、`embed/` 都不會載入它，所以用框架做的網頁不會多送任何東西。[網站自己的頁面](https://openaudiovisual.com/zh/docs/controllers/#controllers-the-site-s-own-pages)
- **從網頁打 DMX 燈光：0.10.0。** 新套件 `@openav/dmx`：燈具 profile（`open-audiovisual/fixture@1`，八個通用燈具和一份 schema，另外有 `tools/import-ofl.mjs`，把 Open Fixture Library 的燈具轉過來）、把 dimmer、顏色、pan、tilt 換成每台燈位元組的 patch，以及依時間算出每台燈任何時刻樣子的引擎：scene、有淡入淡出的 cue、跟著拍子的 chase、effect、即時值、submaster、總控和 blackout。它寫出 Art-Net、sACN（E1.31）和 Enttec DMX USB Pro 的位元組。`dmxTransport()` 把它們留在記憶體、交給輸出橋接程式，或用 Web Serial 送出，`dmxParams()` 讓 MIDI、時間軸和麥克風像推任何參數一樣推燈，`mountDmxMonitor()` 沒有硬體也看得到整套燈。手冊為它多了一章：離開電腦的三種方式、哪個 universe 是哪個、燈具與 patch、各種畫面、用聲音和控制器推燈、安全，以及用 TouchDesigner 確認。[DMX 燈光](https://openaudiovisual.com/zh/docs/dmx/)
- **沒有一台燈每秒閃超過 3 次。** 上限以每台燈來算，分兩層。引擎把會讓同一台燈閃的 effect 和 chase 放慢，直到它們在那台燈上加起來是 3 Hz（`state(t).slowed` 會說是哪幾台）。每個 `dmxTransport()` 再讓每一格經過頻閃保護，管住每台燈實際發出的光，即時值也算在內：180 bpm 十六分音符的大鼓推 dimmer，每秒 12 次，送出去是 3 次。blackout 從不會被擋。要關掉保護必須寫 `{ flashGuard: false }`，監看器那時會一直顯示 FLASH GUARD OFF。[安全](https://openaudiovisual.com/zh/docs/dmx/#dmx-safety)
- **輸出橋接程式多了三個 DMX 輸出。** `artnet`（預設單播給節點，照 Art-Net 4 的規定）、`sacn`（多播或單播、優先權，正常關閉時送出 stream terminated）和 `enttec`（接在序列埠上的 Enttec DMX USB Pro）：值在變時每秒 40 格，沒變時每秒補送一次，頁面離開時送安全值（`"hold"` 讓搖頭燈停在原本指的地方）。三個都讓每個通道每秒最多閃 3 次，預設開著。在路線上寫 `"flashGuard": false`，或用 `exempt` 列出搖頭燈的 pan 和 tilt，不然以通道為單位的保護會讓它們一格一格跳。
- **範例 28〈DMX 燈光〉。** 一個 world 畫出舞台，同時用同一組參數推 8 台 par 和 2 台搖頭燈，監看器放在下面。預設是模擬的燈，要送到橋接程式或 Enttec 才另外指定。[DMX 燈光](https://openaudiovisual.com/examples/28-dmx-lights/)
- **`@openav/out` 修好的地方。** 有值在排隊時，頁面的心跳會被跳過，所以一直在變的燈半秒後就被放回安全值。橋接程式一批只讀前 1024 個值（現在是 4096）。`install.sh` 沒有複製 DMX 的編碼器，所以裝好的橋接程式只要有 DMX 路線就起不來。
- **還沒有用真的硬體測過。** 到現在還沒有任何一台真燈、Art-Net 節點、sACN 接收端或 Enttec 介面收過這些東西。位元組照公開的格式寫，測試在這台機器上把每個封包都解回來。
- **第一筆來自專案外的實機驗證：M-VAVE SMC-Mixer。** jcguevarap 拿一台（韌體 V012）走完驗證頁，回報在 [#7](https://github.com/frank890417/open-audiovisual/issues/7)。每支推桿、每顆通道按鈕、播放控制鍵和方向鍵送出的，都是 QLC+ 設定檔寫的訊息，而無段旋鈕是相對式，用正負號位元計數（往一邊轉是 1，另一邊是 65）。原本的檔案把旋鈕 1 寫成絕對值，旋鈕 2–8 寫成按鈕。現在八顆都是相對式的無段旋鈕，59 個控制項裡有 52 個標成已在實機確認，那次驗證記在檔案的 `verifications`。旋鈕 2–8 要等下一次驗證轉過才算確認。這個檔案從 `profiles/imported/` 搬到 `profiles/`，之後再從 QLC+ 匯入也不會把修正蓋掉。[M-VAVE SMC-Mixer](https://openaudiovisual.com/zh/controllers/m-vave-smc-mixer/)
- **網站的產生器在 Windows 上會跑了。** 在那裡，`node tools/build-home.mjs`、`node tools/build-docs.mjs` 和 `tools/export-controller.mjs` 什麼都沒寫就以 0 結束：它們判斷「是不是被直接執行」時，拿檔案網址去比 Windows 的路徑。現在 `tools/` 裡每個指令都問同一個函式，`tools/site/is-main.mjs` 的 `isMain()`，資料夾名稱有空格、或是透過符號連結的 checkout 也認得。回報在 [#8](https://github.com/frank890417/open-audiovisual/issues/8)。測試是在 macOS 上讀 Windows 格式的路徑，還沒有人在真的 Windows 上跑過。
- **輸出橋接程式的測試不再看機器忙不忙。** `tests/out.test.js` 至少擋過四次發布：橋接程式、頁面和測試共用一個事件迴圈，只要停頓比看門狗的 `timeoutMs` 長，看門狗就會在已經送出的心跳被讀到之前先看一次。`startBridge()` 現在收一個 `now` 時鐘，回傳的結果多了 `tick()`，也就是看門狗看一次，所以測試自己推進橋接程式的時間（另留一個測試用真的時鐘和計時器），`OutClient` 也用 `beatMs` 說出它多久送一次心跳。讓測試的行程隨機凍結 0.3 到 1.5 秒，舊的檔案 10 次全紅，新的一次都沒紅。[startBridge](https://openaudiovisual.com/zh/docs/reference/#out-startBridge)

### 2026-11-24

- **用演出者的方式讀手。** `HandTracker` 現在會替每隻手判斷七種手勢（握拳、張開、指上、讚、倒讚、YA、I love you），也把捏一下變成事件：`hand/<side>/pinch-start` 和 `pinch-end`，而且其他三指要張開才算，握拳不會被當成捏。每隻手還有食指指尖、拇指到每根指尖的距離、張開程度和角度，兩隻手有距離、中點和傾斜。每個狀態只開始一次、結束一次（兩個門檻加上 80 毫秒的維持）。數字來自 TouchDesigner 的 `hand_features` 模組，用真人的手調過。[身體與手](https://openaudiovisual.com/zh/docs/inputs/#inputs-body-and-hands)
- **看見鏡頭看見的。** `hands.overlay(ctx, w, h, { video: true })` 畫出鏡頭畫面、骨架、捏合的線和數值、手的角度、手勢，以及兩手之間的距離。`hands.feed(result)` 讓錄下來或編出來的手走同一套訊號。範例 27〈手勢〉把這些全部示範一遍，鏡頭打開之前有兩隻模擬的手在演。
- **MediaPipe 1.2.3。** 手和身體改載 MediaPipe Tasks Vision 1.2.3（原本是 0.10.14）：同樣的畫面，關節點、手勢和身體都一樣，花的時間也差不多。`hand/<side>/pinch/index`、`pinch/middle` 和 `spread` 維持原本的值。

### 2026-11-15

- **框架有版本號了，也有一個不會變的網址：0.9.0。** 你自己的頁面從一個帶版本號的網址匯入一個檔 `packages/openav.js`，這個網址永遠不變。不用 clone，不用建置。[固定一個版本](https://openaudiovisual.com/zh/docs/quick-start/#quick-start-pin-a-version)
- **一個檔就是一場演出。** 把 `show.html` 存下來、用靜態伺服器開、打開它：一個世界、一條時間軸、控台和鋼琴，全部來自一個 `import`。[一個檔，不用 clone](https://openaudiovisual.com/zh/docs/quick-start/#quick-start-one-file-no-clone)
- **用它做的。** 一頁列出跑在 open-audiovisual 上的作品、工具與課程，每一筆都是作者自己加的，附徽章和登記表單。[用它做的](https://openaudiovisual.com/zh/made-with/)
- **頁面會說出自己用了什麼，而且不送出任何東西。** `createShow()` 在頁面裡留下 `<meta name="generator" content="open-audiovisual 0.9.0">`，演出上有 `window.openav.version`。`signature: false` 就不放標籤。[使用統計](https://openaudiovisual.com/zh/docs/controllers/#controllers-telemetry)
- **曲線面板。** 在控台按 `C`，整場的 automation 攤開成曲線：上面是段落，游標在現在，手動蓋過的值看得到，每一個都能還原。點一下就跳過去。[曲線面板](https://openaudiovisual.com/zh/docs/show-control/#show-control-the-curves-panel)
- **好幾個頁面演同一場。** 一頁當主控，其他頁跟它的時鐘走，同一個瀏覽器或透過 relay 跨機器都行：`createShow({ sync: { role: 'leader', channel: 'hall' } })`。新套件 `@openav/sync`。[好幾個頁面演同一場](https://openaudiovisual.com/zh/docs/show-control/#show-control-several-pages-one-show)
- **以段落為單位寫曲線。** automation 可以對著總譜的一個段落寫（`p` 在段落裡從 0 到 1），剪短的版本會帶著每條曲線一起動。automation 能存成 JSON 再讀回來。時間軸能錨定在牆上的時鐘，並回報漂移了多少。[Lane](https://openaudiovisual.com/zh/docs/show-control/#show-control-lanes-curves-written-per-segment)
- **會微調的旋鈕，和會等你的旋鈕。** 一條對應可以用 `trim` 在時間軸的值上加減而不是取代，或用 `pickup` 等旋鈕轉到畫面上的值才接手，`release` 把參數還回去。[trim、pickup 與 release](https://openaudiovisual.com/zh/docs/mapping/#mapping-trim-pickup-and-release)
- **自己推進的影格，自己選的按鍵。** `createShow({ loop: 'manual' })` 一格一格推進演出（錄影、測試、無畫面執行）。`console: { keys }` 把控台的字母鍵從鋼琴的鍵上挪開。`monitor: false` 或 `{ url }` 決定後台的資料送去哪，現在後台也收得到作品自己的數字。
- **iPad 上的 `keepAwake()`。** 第一次點擊時會再要一次螢幕常亮，因為 Safari 只在觸碰之後才給。還沒在真的 iPad 上驗過。

### 2026-11-06

- **插上匯入的控制器也認得。** 內建設定檔都沒認領時，函式庫會抓那一個檔案並顯示機器。埠名比對用完整的型號名稱，名字相近的不會被認錯。[資料庫](https://openaudiovisual.com/zh/controllers/#imported)
- **驗證站能驗燈，也記得進度。** 控制項驗完後，會把碰得到的 LED 全部點亮，有沒亮的再一顆一顆確認；重新整理也接得回來。[驗證頁](https://openaudiovisual.com/zh/controllers/verify/)

### 2026-11-05

- **用自己的手驗控制器。** [驗證頁](https://openaudiovisual.com/zh/controllers/verify/)會一格一格亮起，比對機器送出的訊息和檔案，再交回更新過的 JSON，每筆結果都附上你的名字、日期和韌體。只有實機能把控制項標成已驗證：沒有 `verifications` 裡的實機紀錄，設定檔不接受 `verified: true`。
- **SysEx，等你開口才動。** 七台控制器把切模式、換模板、LED 訊息寫成資料，每則都附說明書頁碼，機器頁面列得出來，也有送出按鈕。`<oav-controller sysex>` 會加一顆開啟 SysEx 的按鈕，開了之後機器每次連上都會設定好，`setLedColor()` 也能用。權限絕不自己跳出來。[Launchpad Pro MK3](https://openaudiovisual.com/zh/controllers/novation-launchpad-pro-mk3/#sysex)
- **同一台控制器，用在別的軟體。** 每台機器的頁面都能下載 QLC+ 輸入設定檔和 Mixxx mapping，`tools/export-controller.mjs` 也能從任何設定檔產生。[Launchpad Pro MK3](https://openaudiovisual.com/zh/controllers/novation-launchpad-pro-mk3/#other-software)
- **多 28 台控制器，來自 QLC+。** 轉換它的輸入設定檔（Apache-2.0），每個檔案都寫明出處和 commit，版面自動產生，每個控制項都標成未確認，等人來驗。[資料庫](https://openaudiovisual.com/zh/controllers/#imported)
- **格式放得下更多東西。** 設定檔現在可以寫 `sysex`（切模式、換模板、LED 顏色，每則訊息都附出處）和 `palette`（LED 色票）。[`profile.schema.json`](https://openaudiovisual.com/packages/midi/profile.schema.json) 用 JSON Schema 描述這個格式，沒有跑這個套件的軟體也讀得懂。

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
