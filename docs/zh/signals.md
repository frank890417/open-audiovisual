# 訊號一覽

訊號是輸入層唯一的通用貨幣：有名字、經過正規化、不分來源。這一頁列出內建輸入套件發布的每一個訊號。

慣例：
- 除非另外註明，範圍都是 0..1
- `pulse`（脈衝）訊號觸發的是事件，它的值就是事件帶的資料（payload）
- 只要對演出來說比較直覺，y 軸就會反轉（1 = 舉高）；數值從來不是原始像素
- `<n>` 是數字，`<ch>` 是 MIDI 頻道 1..16，`<id>` 是裝置 id，`<slug>` 是轉成網址安全格式的裝置名稱

## @openav/midi

每一則硬體訊息，都會同時發布舊式名稱和分頻道的名稱。

| 訊號 | 種類 | 範圍 | 意義 |
|---|---|---|---|
| `midi/note/on` | 脈衝 | `{note, vel, velocity, ch, device}` | 按下琴鍵：`vel` 0..1，`velocity` 1..127，`ch` 1..16，`device` = 連接埠的 slug |
| `midi/note/off` | 脈衝 | `{note, ch, device}` | 放開琴鍵 |
| `midi/cc/<n>` | 連續 | 0..1 | 第 n 號控制器（任何頻道） |
| `midi/bend` | 連續 | -1..1 | 彎音（任何頻道） |
| `midi/ch/<ch>/cc/<n>` | 連續 | 0..1 | 單一頻道上的第 n 號控制器 |
| `midi/ch/<ch>/note/<n>` | 連續 | 0..1 | 按住音 n 時是它的力度，放開時為 0 |
| `midi/ch/<ch>/bend` | 連續 | -1..1 | 單一頻道上的彎音 |
| `midi/ch/<ch>/pressure` | 連續 | 0..1 | 頻道觸後（channel aftertouch） |
| `midi/ch/<ch>/poly/<n>` | 連續 | 0..1 | 音 n 的複音觸後（polyphonic aftertouch） |

接了兩個以上的 MIDI 輸入時，每台裝置也會用自己的 slug 再發布一份（slug 取自連接埠名稱：`Arturia MiniLab 3` → `arturia-minilab-3`，名稱重複的依序加上 `-2`、`-3`）：

| 訊號 | 種類 | 範圍 | 意義 |
|---|---|---|---|
| `midi/<slug>/note/on` | 脈衝 | `{note, vel, ch}` | 在那台裝置上按下琴鍵 |
| `midi/<slug>/note/off` | 脈衝 | `{note, ch}` | 在那台裝置上放開琴鍵 |
| `midi/<slug>/cc/<n>` | 連續 | 0..1 | 那台裝置的第 n 號控制器 |
| `midi/<slug>/bend` | 連續 | -1..1 | 那台裝置的彎音 |

螢幕上的控制器（`modules.midi.controllers`）每個控制元件發布一個名稱 `midi/<device>/<control>`（例如 `midi/minilab3/knob1`），打擊墊另外發 `/hit` 脈衝，也有 `/raw` 原始值。完整列表在 [MIDI 控制器與嵌入](controllers.md)。

## @openav/keys

螢幕鋼琴、電腦鍵盤演奏和模擬演奏者，發布的是舊式的音符名稱，帶的資料比較少：

| 訊號 | 種類 | 範圍 | 意義 |
|---|---|---|---|
| `midi/note/on` | 脈衝 | `{note, vel, ch: 0}` | 按下琴鍵（`vel` 0..1） |
| `midi/note/off` | 脈衝 | `{note, ch: 0}` | 放開琴鍵 |

## @openav/chord

| 訊號 | 種類 | 範圍 | 意義 |
|---|---|---|---|
| `chord/consonance` | 連續 | -1..1 | 最近一次彈奏的和聲協和度 |
| `chord/count` | 連續 | 0..10 | 最近一次彈奏有幾個音 |
| `chord/root` | 連續 | 0..127 | 最近一次彈奏裡最低的 MIDI 音 |
| `chord/event` | 脈衝 | 完整分析結果 | `{notes, count, root, vel, pcs, consonance, isConsonant, isDissonant, isTriad, thirdsFraction, dissonanceLevel, chordType}` |

`chordType`：`single` · `major` · `minor` · `sus2` · `sus4` · `dim` · `aug` · `maj7` · `min7` · `dom7` · `halfdim7` · `maj9` · `min9` · `dom9` · `six` · `min6` · `cluster`（非常不協和的一堆音）· `chord`（其他所有情況）。轉位和弦會經過音級（pitch class）輪轉，歸回原位和弦的名稱。

`dissonanceLevel`：`0` 沒有 · `1` 輕微（暴風雨警報，用來預示）· `2` 嚴重（真正的音堆，全面轉入衰敗的語彙）。這個分級來自台北 IRCAM × C-LAB 演出時一則真實的觀眾回饋：「不協和的偵測不夠嚴格。」

## @openav/audio

| 訊號 | 種類 | 範圍 | 意義 |
|---|---|---|---|
| `audio/rms` | 連續 | 0..1 | 音量（經過平滑） |
| `audio/peak` | 連續 | 0..1 | 瞬間峰值 |
| `audio/band/low` | 連續 | 0..1 | 20–250 Hz 的能量 |
| `audio/band/mid` | 連續 | 0..1 | 250 Hz–2 kHz 的能量 |
| `audio/band/high` | 連續 | 0..1 | 2–8 kHz 的能量 |
| `audio/centroid` | 連續 | 0..1 | 頻譜亮度 |
| `audio/onset` | 脈衝 | `{rms}` | 高過自適應底線的瞬態（冷卻 100 ms） |
| `audio/kick` | 脈衝 | `{level}` | 20–120 Hz 的瞬態（冷卻 90 ms） |
| `audio/snare` | 脈衝 | `{level}` | 150–800 Hz 的瞬態（冷卻 90 ms） |
| `audio/hat` | 脈衝 | `{level}` | 6–14 kHz 的瞬態（冷卻 60 ms） |
| `audio/kick/env` `/snare/env` `/hat/env` | 連續 | 0..1 | 每種鼓各自的衰減包絡（可以直接映射到參數） |

## @openav/pose

預設左右鏡像（把鏡頭當成鏡子）。y 軸反轉：**1 = 舉高**。

| 訊號 | 種類 | 範圍 | 意義 |
|---|---|---|---|
| `pose/present` | 連續 | 0/1 | 畫面裡有人 |
| `pose/hand/left/x` `/y` | 連續 | 0..1 | 左手腕（觀看者的左邊） |
| `pose/hand/right/x` `/y` | 連續 | 0..1 | 右手腕 |
| `pose/hand/left/v` `right/v` | 連續 | 0..1 | 手腕移動速度 |
| `pose/hands/spread` | 連續 | 0..1 | 兩手腕之間的距離 |
| `pose/height` | 連續 | 0..1 | 鼻子的高度（蹲下 ↔ 站起） |
| `pose/lean` | 連續 | -1..1 | 肩線傾斜 |

## @openav/pose — HandTracker（21 個關鍵點的精細控制）

每隻手的捏合距離，兩隻手加起來就是四個精準的連續控制器。數值依手掌大小正規化，所以離鏡頭遠近不會改變捏合的值。

| 訊號 | 種類 | 範圍 | 意義 |
|---|---|---|---|
| `hand/left/present` `right/…` | 連續 | 0/1 | 看得到這隻手 |
| `hand/left/x` `/y` | 連續 | 0..1 | 手掌位置（y：1 = 舉高） |
| `hand/left/pinch/index` | 連續 | 0..1 | 拇指指尖 ↔ 食指指尖（0 = 碰在一起） |
| `hand/left/pinch/middle` | 連續 | 0..1 | 拇指指尖 ↔ 中指指尖 |
| `hand/left/spread` | 連續 | 0..1 | 食指指尖 ↔ 小指指尖張開的距離 |

（`hand/right/*` 是同樣的一組。兩種追蹤器都提供 `skeleton(ctx, w, h)` 骨架疊圖。）

## @openav/drums（模擬器，訊號形狀和分析器相同）

鼓機發布的訊號，形狀和音訊分析器發布的完全一樣，所以接到大鼓的世界分不出那是麥克風還是鼓機（模擬器本來就是為了這個）。音序器的每一擊也會以 `midi/note/on` 送出（頻道 10，GM 音符編號）。

| 訊號 | 種類 | 範圍 | 意義 |
|---|---|---|---|
| `drum/kick` `/snare` `/hat` `/clap` | 脈衝 | `{level}` | 音序器打了一下 |
| `drum/kick/env` `…` | 連續 | 0..1 | 每一軌的衰減包絡（可以直接映射到參數） |
| `midi/note/on` | 脈衝 | `{note, vel, ch: 10}` | 大鼓 36 · 小鼓 38 · 拍手 39 · 閉合 hi-hat 42 |

## @openav/remote · @openav/surface

手機感測器（`/packages/remote/` → 感測）。`<id>` 是裝置 id；`phone/any/…` 永遠是最後一支送出數值的手機的值，所以還沒有任何手機連上，就能先寫好世界的路由。

| 訊號 | 種類 | 範圍 | 意義 |
|---|---|---|---|
| `phone/<id>/tilt/x` `/y` | 連續 | -1..1 | 從校正過的靜止姿勢算起 ±45°，以螢幕座標為準（x 向右，y 朝向你） |
| `phone/<id>/accel/x\|y\|z` | 連續 | m/s² | 含重力 |
| `phone/<id>/rot/alpha\|beta\|gamma` | 連續 | deg/s | 旋轉速率 |
| `phone/<id>/orient/alpha\|beta\|gamma` | 連續 | deg | 原始的 deviceorientation |
| `phone/<id>/knock` | 脈衝 | `{strength, delta, t}` | 加速度突然一震、超過門檻（冷卻 130 ms） |
| `phone/<id>/light` | 連續 | 0..1 | 前鏡頭畫面的平均亮度（luma） |
| `phone/<id>/touch/x` `/y` `/down` | 連續 | 0..1 | 第 0 根手指；n ≥ 1 用 `touch/<n>/…`，另有 `touch/count` |
| `phone/local/…` | — | — | 演出頁面**本身**跑在手機上時，同一套感測器名稱（`localSensors(signals)`，不經過中繼；也會鏡像到 `phone/any/…`） |

控制面板元件（正規化到 0..1；範圍不是 0..1 時，`…/raw` 帶著未縮放的原始值）：

| 訊號 | 種類 | 意義 |
|---|---|---|
| `surface/<page>/<id>` | 連續 | fader · knob · number · toggle · button（0/1）· radio（idx/(n-1)）· encoder 的相位 |
| `surface/<page>/<id>/x` `/y` `/down` | 連續 | xy pad |
| `surface/<page>/<id>/<1..N>` | 連續 | bank 的各個通道 |
| `surface/<page>/<id>/hit` | 脈衝 `{pad,row,col,vel}` | pads；按住時 `…/<n>`（n 從 0 起算）保持力度值 |
| `surface/<page>/<id>/delta` | 連續 | encoder 每一步的轉動量，單位是圈 |
| `surface/<page>/<id>`（text） | 脈衝 | 在 `text` 元件裡輸入的字串 |
| `midi/note/on` `/off`、`midi/cc/64` | 脈衝／連續 | 琴鍵分頁和 `keyboard` 元件，名稱和形狀都跟 `@openav/midi` 一樣：`{note, vel, velocity, ch: 1, device: 'surface'}` |

接收端：每一則中繼訊息都經過 `fileSignal(signals, name, value, {pulse})` 寫進訊號（`@openav/relay`；`bindSignals` 用的就是它，自己開 socket 的宿主頁面也是，例如 lab 的 `lab.js`）。一個名稱第一次出現時，它會先宣告（`signalMeta`）；`midi/…/note/on|off` 的發送端少給了哪一種力度寫法，它就補上哪一種（`vel` 0..1 ⇄ `velocity` 1..127）。

## 自己命名訊號

用路徑式的寫法，來源放最前面：`breath/pressure`、`phone/{id}/gyro/x`、`weather/wind`。先用 `signals.define(name, {min, max})` 宣告範圍，儀表和 `norm()` 才算得對；之後只要 `signals.set(name, v)`。任何會變動的東西，都能拿來演出。
