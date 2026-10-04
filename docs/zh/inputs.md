# 輸入

每一種輸入只做一件事：發出訊號。用 `createShow()` 時，在 `modules` 裡打開需要的輸入；每一種輸入也都是普通的類別，可以單獨拿來用。確切的名稱和範圍在[訊號一覽](signals.md)。

| 輸入 | 套件 | `modules` 的 key | 預設 | 發出的訊號 |
|---|---|---|---|---|
| MIDI 硬體 | `@openav/midi` | `midi` | 開（設成 `false` 就關掉） | `midi/…` |
| 螢幕上的 MIDI 控制器 | `@openav/midi` | `midi: { controllers }` | 關 | `midi/<device>/<control>` |
| 螢幕鋼琴、電腦鍵盤、模擬演奏者 | `@openav/keys` | `keys` | 開（設成 `false` 就移除） | `midi/note/on`、`midi/note/off` |
| 鼓機 | `@openav/drums` | `drums` | 關 | `drum/…`，以及第 10 通道的 `midi/note/on` |
| 麥克風 | `@openav/audio` | `audio` | 關 | `audio/…` |
| 和弦分析 | `@openav/chord` | `chord` | 關 | `chord/…` |
| 身體（鏡頭） | `@openav/pose` | `pose` | 關 | `pose/…` |
| 手（鏡頭） | `@openav/pose` | `hands` | 關 | `hand/…` |
| 手機與 iPad | `@openav/remote` | `remote` | 關 | `phone/…`、`surface/…`、`midi/note/…` |

需要權限、或要使用者先點一下才能開的來源（麥克風、鏡頭），會由 `createShow()` 建立，但要等你在控台的 **L1 · Input**（輸入）面板按下對應的按鈕才會開始：🎤 mic（麥克風）、🖐 hands（手）、🕺 body（身體）。

## MIDI

`createShow()` 啟動時會建立一個 `Midi` 引擎並呼叫 `enable()`，所以頁面一打開，瀏覽器可能就會詢問 MIDI 權限。演出中可以隨時插拔裝置；**L1 · Input** 面板會列出它們，取消勾選某一台就能讓它靜音，不用拔線。

每一則收到的訊息都會發出兩組名稱：

- **舊式名稱**（legacy，大多數世界用的就是這組，不分通道）：`midi/note/on` 和 `midi/note/off` 脈衝、`midi/cc/<n>`（0..1）、`midi/bend`（−1..1）；
- **分通道**：`midi/ch/<ch>/cc/<n>`、`midi/ch/<ch>/note/<n>`（按住時是 0..1 的力度，放開時為 0）、`midi/ch/<ch>/bend`、`midi/ch/<ch>/pressure`、`midi/ch/<ch>/poly/<n>`。

note-on 帶的內容是 `{ note, vel, velocity, ch, device }`：`vel` 是 0..1，`velocity` 是原始的 1..127，`ch` 是 1..16，`device` 是連接埠的 slug。

接了**兩台以上的裝置**時，每一台還會用自己的 slug 另外發一份，控制項才不會撞名：`midi/<slug>/cc/<n>`、`midi/<slug>/note/on`、`midi/<slug>/note/off`、`midi/<slug>/bend`。slug 取自連接埠名稱（`Arturia MiniLab 3` → `arturia-minilab-3`；同型號的第二台會加上 `-2`），所以裝置斷線再接回來，路由還在。舊式名稱也照常發出，所以接在 `midi/cc/74` 上的路由聽得到每一台裝置。

Clock 訊息會被忽略。Program change、transport 和 SysEx 不會發出（框架從不要求 SysEx 權限）。

不透過 `createShow()`，單獨使用：

```js
import { Midi } from '@openav/midi';

const midi = new Midi({ signals });     // options: signals, filterOut = 'IAC', requestAccess
await midi.enable();                    // false if the browser has no Web MIDI or permission was denied
midi.devices();                         // [{ slug, name, listening }]
midi.setListening('nanokontrol2', false);
```

`filterOut` 是一個不分大小寫的正規表示式，名稱符合的輸入連接埠會被忽略。預設值 `'IAC'` 會把 macOS 的 IAC bus 擋在外面，不然一場透過 IAC 送出 MIDI 的演出，會聽到自己送出的訊息。想從 IAC 接收，請看[疑難排解](troubleshooting.md#a-daw-on-the-iac-bus-is-not-heard)。MIDI 輸出的說明在[演出控制](show-control.md#midi-output-and-panic)。

### 螢幕上的已知控制器

`modules: { midi: { controllers: { profile: '<profile id>' } } }` 會在螢幕上放一張已知控制器的圖。接上那台控制器，圖就改由實體裝置帶動，跟著你的手一起動；沒接的話，用滑鼠或手指直接彈這張圖。它的控制項會發出 `midi/<device>/<control>` 這類名稱，`controllerRoutes()` 會寫好把它們接到參數的路由。[MIDI 控制器與嵌入](controllers.md)這一章說明設定檔（profile）、怎麼 learn 不認識的裝置、LED 回饋和嵌入；支援的裝置列在[控制器頁面](https://openaudiovisual.com/controllers/)。

## 螢幕鋼琴、電腦鍵盤與模擬演奏者

`@openav/keys` 預設開啟。它會在控台上方放一台鋼琴，附兩個核取方塊：*keyboard*（電腦鍵盤擷取）和 *simulate performance*（模擬演奏）。選項（`modules.keys`）：`base`（最低音，預設 48）、`octaves`（預設 2）、`sim`（是否顯示模擬演奏的核取方塊，預設 `true`）、`capture`（是否顯示 keyboard 核取方塊，預設 `true`）。

它發出 `midi/note/on` `{ note, vel, ch: 0 }` 和 `midi/note/off` `{ note, ch: 0 }`。注意和硬體的差別：`ch` 是 0，而且沒有 `velocity` 和 `device` 欄位。只讀 `note` 和 `vel` 的世界，兩種都能用。

- **電腦鍵盤**（勾選 *keyboard* 之後）：`A W S E D F T G Y H U J K O L P ;` 從 `base` 開始，依序彈出相差半音的 17 個音；<kbd>Z</kbd>／<kbd>X</kbd> 移動一個八度（base 維持在 24 到 84 之間）；按住 <kbd>Shift</kbd> 力度加 20。擷取開著的時候，鋼琴會接管所有字母鍵（`preventDefault`）；<kbd>Space</kbd>、方向鍵和數字鍵會照常交給控台。
- **模擬演奏者**（`SimPlayer`）在比 `base` 高一個八度的地方彈五聲音階：大多是級進，偶爾跳進或彈三和弦，中間會有真正的休止。從程式碼控制：`show.keys.sim.toggle(true)`。

```js
import { mountKeys, KeysPiano, SimPlayer, PIANO_KEYMAP } from '@openav/keys';

const keys = mountKeys(el, { signals, base: 48, octaves: 2 });   // → { piano, sim, update(dt), dispose() }
// call keys.update(dt) every frame (it drives the SimPlayer)
```

## 鼓機

`modules: { drums: true }` 會加上一台 16 步、四軌（kick、snare、hat、clap）的音序器，附節奏型（*four on floor*、*breakbeat*、*half time*、*latin*、*sparse*）、速度滑桿（60–180 BPM，預設 112）、swing，以及模擬真人手感的時間偏移。勾選 *drum machine*（鼓機）就會開始。它用自己合成的鼓組發聲（不用取樣音色），並發出：

- `drum/kick`、`drum/snare`、`drum/hat`、`drum/clap`：脈衝 `{ level }`；
- `drum/<lane>/env`：每一軌一條 0..1 的波封，大約 0.12 秒衰減完，可以直接映射到參數；
- `midi/note/on` `{ note, vel, ch: 10 }`，用 General MIDI 的音高（kick 36、snare 38、clap 39、closed hat 42）。

這些訊號的形狀和麥克風的鼓點偵測發出的一樣（`audio/kick`、`audio/kick/env`…），所以映射到 kick 的世界分不出真的大鼓和鼓機。範例 06 把兩者都接到同一組參數。選項（`modules.drums`）：`engine`（改用另一個聲音引擎）、`autoEnableEngine`（預設 `true`：第一下打擊就會啟動鼓組的音訊引擎，不必另外點一下）。

## 麥克風

`modules: { audio: true }` 會建立一個 `AudioAnalyzer`；按下 🎤 mic 之後，麥克風才會開始。（範例 06 寫的是 `audio: 'mic'`，任何 truthy 的值都可以。）回音消除、降噪和自動增益都是關掉的，分析聽到的就是現場原本的聲音。

每一影格發出：`audio/rms`（平滑過的音量）、`audio/peak`、`audio/band/low`（20–250 Hz）、`audio/band/mid`（250 Hz–2 kHz）、`audio/band/high`（2–8 kHz）、`audio/centroid`（亮度），以及脈衝 `audio/onset` `{ rms }`，每次觸發後有 100 ms 的冷卻時間。鼓點偵測依頻段拆開暫態：`audio/kick`（20–120 Hz）、`audio/snare`（150–800 Hz）、`audio/hat`（6–14 kHz），每個都是脈衝 `{ level }`，並附一條對應的 `…/env` 波封。

> [!TIP]
> 真實環境的數值很少到 1。說話的 RMS 通常落在 0.05–0.2 左右，頻段能量則是許多 FFT bin 的平均。把路由的輸入範圍收窄，例如 `{ source: 'audio/rms', target: 'energy', inMax: 0.3 }`。

```js
import { AudioAnalyzer } from '@openav/audio';

const audio = new AudioAnalyzer({ signals, fftSize: 2048, smooth: 0.7 });
await audio.enableMic();            // or audio.enableElement(videoEl), or someNode.connect(audio.input())
// every frame: audio.update()      → also returns { rms, peak, low, mid, high, centroid, onset, kick, snare, hat }
```

## 和弦

`modules: { chord: true }`（或 `{ chord: { window: 80 } }`）會加上一個 `ChordDetector`，把每一個 `midi/note/on` 和 `midi/note/off` 餵給它。它把 `window` 毫秒內（預設 80）按下的音歸成一次彈奏，每次彈奏發出：

- `chord/consonance`（−1..1）、`chord/count`（音的數量）、`chord/root`（最低的 MIDI 音）；
- `chord/event`，一個帶著完整分析結果的脈衝：

| 欄位 | 意義 |
|---|---|
| `notes`, `count`, `root`, `vel`, `pcs` | 排序後的音、音的數量、最低音、平均力度（0..1）、音級（pitch class） |
| `consonance` | 兩兩音程權重的平均，−1..1（單音為 1） |
| `isConsonant`, `isDissonant` | 有兩個以上的音，而且協和度 > 0.25／< −0.15 |
| `isTriad` | 和弦類型是大三、小三、sus2、sus4、減三或增三和弦 |
| `thirdsFraction` | 相鄰音程中，3 或 4 個半音所占的比例（「真正一層層疊上去的三度」） |
| `dissonanceLevel` | 0 無 · 1 輕微（暴風雨的預兆）· 2 嚴重（真正的音堆） |
| `chordType` | `single`、`major`、`minor`、`sus2`、`sus4`、`dim`、`aug`、`maj7`、`min7`、`dom7`、`halfdim7`、`maj9`、`min9`、`dom9`、`six`、`min6`、`cluster` 或 `chord` |

這不是樂理函式庫，而是為演出設計的語意層，原本是為一件作品做的：協和讓花園開花，音堆讓花園凋零（範例 02）。`detector.analyze(notes, vels)` 是純函式，你也可以自己呼叫。

## 身體與手

`modules: { pose: true }` 加上一個 `PoseTracker`（一個身體），`modules: { hands: true }` 加上一個 `HandTracker`（兩隻手，每隻 21 個點）。按下 🕺 body 或 🖐 hands，鏡頭才會開始。兩者都用 MediaPipe Tasks Vision（0.10.14），第一次啟用時從 jsDelivr 載入，模型則從 Google 的儲存空間下載；推論在你的電腦上執行，影像不會離開這台機器。畫面預設左右鏡像（`mirror: true`），就像舞台上的一面鏡子；y 軸是反過來的，1 代表*舉高*。

- **身體**：`pose/present`、`pose/hand/left/x|y`、`pose/hand/right/x|y`（手腕）、`pose/hand/left/v`、`pose/hand/right/v`（手腕速度）、`pose/hands/spread`、`pose/height`（鼻子高度：蹲下 ↔ 站起）、`pose/lean`（−1..1）。
- **手**：每一側各有 `hand/<side>/present`、`hand/<side>/x|y`（手掌）、`hand/<side>/pinch/index` 和 `hand/<side>/pinch/middle`（拇指尖到手指尖）、`hand/<side>/spread`（食指尖到小指尖）。距離都除以手掌大小，所以手往鏡頭靠近，捏合的值不會變。捏緊時數值接近 0：如果希望越捏越大，在路由上設 `invert: true`（範例 03）。

兩種追蹤器都能把骨架畫在 2D context 上：`tracker.skeleton(ctx, w, h)`。

## 手機與 iPad

`modules: { remote: true }` 讓手機透過 `serve.js` 架起的中繼加入演出。手機的感測器發出 `phone/<id>/…`（傾斜、加速度、旋轉、敲擊、觸控、光線），同時複製一份到 `phone/any/…`；控制面板發出 `surface/<page>/<widget>`；手機上的琴鍵像一般鍵盤一樣發出 `midi/note/on|off`。演出頁面如果是在手機上打開，也能用 `localSensors()` 讀這支手機自己的動作感測器。完整說明在[手機、中繼與控制面板](remote.md)。

## 自己做一個輸入

任何呼叫 `signals.set()` 或 `signals.pulse()` 的東西，都是輸入。下面把滑鼠／觸控指標當成樂器：

```js
const { signals } = show;
signals.define('pointer/x', { source: 'pointer' });     // continuous, 0..1 by default
signals.define('pointer/y', { source: 'pointer' });
signals.define('pointer/tap', { kind: 'pulse', source: 'pointer' });

addEventListener('pointermove', (e) => {
  signals.set('pointer/x', e.clientX / innerWidth);
  signals.set('pointer/y', 1 - e.clientY / innerHeight);  // 1 = top, like every other y
});
addEventListener('pointerdown', (e) => signals.pulse('pointer/tap', { x: e.clientX, y: e.clientY }));

show.mapper.addRoute({ source: 'pointer/x', target: 'hue', smooth: 0.25 });
```

命名時把來源放在最前面（`breath/pressure`、`weather/wind`），宣告它的範圍，下游的一切（儀表、*learn*、路由、手機控制面板）都不用改就能用。
