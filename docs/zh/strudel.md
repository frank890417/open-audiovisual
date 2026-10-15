# 和 Strudel 一起用

[Strudel](https://strudel.cc) 是在瀏覽器裡即興寫音樂的 live coding 環境，[TidalCycles](https://tidalcycles.org) 的
JavaScript 版。OAV 是另一個獨立的程式。兩個並排跑，像舞台上兩台機器那樣合作：Strudel 負責演奏，OAV 補上 Strudel
沒有的東西——螢幕上和手機上的旋鈕、會分析的麥克風、瀏覽器沒有 Web MIDI 時的 MIDI——並且把 Strudel 演奏的東西，
在同一頁、另一個分頁或另一台電腦的 p5.js 草圖裡畫出來。兩邊只透過 MIDI（OAV 的虛擬埠「OAV Virtual MIDI」）和網頁
上的變數（`knob1`、`micLevel`、`drumPhase`）碰面。OAV 不載入、也不呼叫 Strudel 的任何程式。

這一頁每個寫法，都在 strudel.cc 上用一般使用者的方式跑過（它的編輯器、Ctrl+Enter、文件寫的函式）：
`p5/test/strudel-smoke.cjs` 會再跑一次。

## 在 Strudel 載入 OAV

Strudel → **settings** → **prebake**，最後加一行，按 **save**：

```js
await import('https://openaudiovisual.com/p5/oav-p5.js')
```

- **網址用單引號。** Strudel 把雙引號（和反引號）裡的字當成 mini-notation：網址寫雙引號會出現
  `[mini] parse error`。
- **為什麼放 prebake。** 它在你的程式之前跑，重新整理後也會跑（編輯器出現後約 2.5 秒），所以 OAV 一定比任何開
  MIDI 的東西早到。要是 Strudel 的 `midin()` 比 OAV 先跑，`midin('OAV Virtual MIDI')` 會收不到東西、也不報錯：重新
  整理就好。這種時候 🩺 會寫「沒有程式向 OAV Virtual MIDI 要過 MIDI」。
- 這一行也可以放在程式第一行。選項寫在它前一行：`window.OAV_P5 = { link: 'my-room' }`。
- Strudel 的 **share** 會把 prebake 一起放進連結（勾著 share with patterns 時）：打開連結的人也會載入 OAV。

在 strudel.cc 上 OAV 會換一套禮貌。載入時不要 MIDI 權限（`hardware=click`：交給 Strudel 的 `midin()` 去問）。🎹 面板
變成角落的一個小框，高度是視窗的三分之一，程式碼不會被蓋住。一張卡片說明哪些名字 Strudel 已經有了——`note`、
`velocity`、`beat` 是 Strudel 的函式，OAV 不動它們——以及改讀什麼：`OAVp5.last.note`、`OAVp5.last.value`、
`OAVp5.mic.on('beat', fn)`。`knob1`、`micLevel`、`drumPhase` 這些名字在那裡都沒人用，照常可讀。

## 配方一：旋鈕、手機、麥克風變成 Strudel 的參數

Strudel 的 `signal()` 把一個函式變成參數；OAV 的名字就是函式可以回傳的數值。

```js
s("bd*4").gain(signal(() => knob1))
s("hh*8").lpf(signal(() => 300 + micLevel * 8000))
```

- `knob1` 跟著螢幕上 🎹 的旋鈕 1、MIDI 控制器的旋鈕 1，或手機（🎹 → 📱 掃碼）。`knob(2)`、`fader1`、`pad1` 也都在。
  實測：旋鈕 1 轉到 0，大鼓沒有聲音；轉到 127，聽得到（RMS 0.58）。
- Strudel 是在排程時讀值，比聲音早 0.2–0.3 秒：轉旋鈕大約晚這麼多才聽到。
- `micLevel`、`bass`、`mid`、`treble` 是 OAV 對麥克風的分析（Strudel 沒有）；讀到其中一個就會要麥克風。請戴耳機：
  麥克風會聽到喇叭，`gain(signal(() => micLevel))` 會越來越大聲。
- Strudel 自己的 MIDI 輸入也能接 OAV 的埠，連 Safari 都可以（Safari 沒有 Web MIDI，OAV 的埠是虛擬的）：

```js
const cc = await midin('OAV Virtual MIDI')
s("bd*4").gain(cc(74))
```

螢幕上 MiniLab 3 的旋鈕 1 是 CC 74。`midikeys('OAV Virtual MIDI')` 讓 🎹 的琴鍵和手機變成 Strudel 的鍵盤。

## 配方二：Strudel 演奏，p5 草圖畫畫面

**同一頁。** 送到 OAV 的埠：

```js
note("c3 [e3 g3] <a3 b3> c4").midi('OAV Virtual MIDI')
```

Strudel 每個音都提早 0.21–0.32 秒交出來，附上它應該響的時刻；OAV 等到那一刻才呼叫 `notePressed(note, velocity)`（在
Strudel 裡沒有草圖：用 `OAVp5.on('notePressed', fn)`），CC 推動 `knob1`，打擊墊照樣打。實測：和 Strudel 的時間戳差
5 ms 以內（中位數 0.1 ms）。從這個埠進來的東西，絕不會再從 OAV 的輸入送回去，所以 `midikeys('OAV Virtual MIDI')` 接到
`.midi('OAV Virtual MIDI')` 只會有一次回音，不會無限循環。

**Strudel 的時鐘。** MIDI 一拍 24 個 clock，一個 cycle 是四拍一小節時就送 96 個：

```js
setcps(128 / 60 / 4)
$: s("bd*4, [~ sd]*2, hh*8")
$: midicmd("clock*96, <start stop>/8").midi('OAV Virtual MIDI')
```

`drumPhase`、`beatPhase`、`drumBar`、`drumStep`、`drumBpm` 都跟著它走。用 `startDrums()` 開的鼓機會照 Strudel 的速度、
在 Strudel 的小節起點上打，跟著它開始和停止（鼓機卡上寫「跟著外部時鐘 · 128 BPM」）。128 bpm 實測：`drumPhase` 和
Strudel 的小節差 1.2 ms 以內（中位數 0.04 ms），每一下大鼓和 Strudel 的拍點差 5 ms 以內；Strudel 的 start 會用同一個
時間戳送三次，只算一次。沒有時鐘時什麼都不變；`clock=off` 會忽略時鐘。

**另一個分頁，或另一台電腦。** 兩邊設同一個房間。Strudel 的 prebake：

```js
window.OAV_P5 = { link: 'my-room' }
await import('https://openaudiovisual.com/p5/oav-p5.js')
```

p5 草圖（OpenProcessing：寫在那一行之前；或在作品網址加 `?sketch_oav_link=my-room`）：

```js
window.OAV_P5 = { link: 'my-room' };
document.head.prepend(Object.assign(document.createElement('script'), { src: 'https://openaudiovisual.com/p5/oav-p5.js' }));
```

Strudel 送進 OAV 埠的一切——音符、CC、時鐘——都會經由手機用的同一個 relay，送到房間裡其他每一個 OAV 頁面。🎹 會多一
個 🔗：有另一頁在時是綠色；面板上寫著房間、頁數和單程時間。收的那一頁在 Strudel 演奏的那一刻才演奏，不是收到就演：
它用看過最快的那幾趟、加上兩頁各自量到的來回時間，把兩邊的時鐘對齊（做法寫在 packages/relay/link.js），Strudel 提早
四分之一秒的量剛好吃掉路上的時間。一台 Mac 兩個分頁、經由 wss://remote.cheyuwu.com（單程約 61 ms）實測：音符和
Strudel 的時間戳差 −3 到 +7 ms（跑兩次）。兩台電腦時再加上「來回兩段不一樣長」的誤差（通常幾 ms）。relay 請用預設的
（`wss://`）：Chrome 不讓 strudel.cc 連到你自己電腦或區網裡的 relay（`ws://127.0.0.1…` 會被它的區網存取檢查擋下）。網路抖得比 Strudel 的提早量
還兇時，用 `linkdelay=`（毫秒）多留一點緩衝。收到的東西不會再轉出去；有程式把房間傳來的音又彈回去，會被當成回音擋下。
這個房間同時也是手機的房間：一張 QR 碼能彈房間裡每一頁。

畫畫面那一邊的現成例子：`p5/examples/with-strudel/`（網址加 ?room=…）。

## 配方三：Strudel、Hydra、OAV 同一頁

OAV 放在 prebake：

```js
await initHydra()
osc(10, 0.1, () => knob1 * 2).rotate(() => drumPhase * 6.28).color(1, () => micLevel, 0.6).out()
setcps(120 / 60 / 4)
$: s("bd*4, [~ sd]*2, hh*8").gain(signal(() => 0.3 + knob1))
$: midicmd("clock*96").midi('OAV Virtual MIDI')
```

Hydra 照 Strudel 的時鐘一小節轉一圈（經由 `drumPhase`），旋鈕 1 同時推 Hydra 和 Strudel，麥克風給畫面上色。

## 和 Strudel 有關的選項

寫在那一行之前（`window.OAV_P5 = { … }`），或在 p5 頁面網址加 `?oav_key=value`。

| 選項 | 值 | 預設 |
|---|---|---|
| `link` | 房間名（英數、`-`、`_`）：同房間的頁面互相聽得到對方的程式 | 無 |
| `linkdelay` | 連線頁面的音符多留幾毫秒緩衝 | `0` |
| `clock` | `follow`（外部 MIDI 時鐘推動 `drumPhase` 和鼓機）· `off` | `follow` |
| `strudel` | `auto`（strudel.cc，或頁面上已經有 Strudel 的函式）· `on` · `off` | `auto` |
| `compact` | `on`（面板是角落的小框）· `off` | Strudel 裡 `on` |
| `hardware` | `auto` · `click` · `off` | Strudel 裡 `click` |

## 致謝與授權

Strudel 的著作權屬於它的貢獻者（由 Felix Roos 和 Alex McLean 開始），以 GNU Affero General Public License v3 授權的
自由軟體：[strudel.cc](https://strudel.cc)，原始碼在 [codeberg.org/uzu/strudel](https://codeberg.org/uzu/strudel)。
Strudel 帶到瀏覽器裡的那套寫節奏的方式，來自 Alex McLean 的 TidalCycles。用 Strudel 做出來的音樂是你自己的（Strudel 的
FAQ）。

OAV 以 MIT 授權，是另一個獨立的程式。它不含 Strudel 的任何程式碼、執行時不載入 `@strudel/*`、也不呼叫 Strudel 的任何
函式：它只看網頁的網址、看頁面上已經有哪些名字，來決定自己的禮貌。兩邊像舞台上的兩台機器一樣，透過 MIDI 碰面。OAV 自己
的節奏字串（`startDrums("bd*4, hh*8")`，@openav/pattern）是依公開文件獨立實作的 TidalCycles／Strudel 式寫法。OAV 的
問題請不要到 Strudel 的社群問：請到 [GitHub](https://github.com/frank890417/open-audiovisual/issues)。
