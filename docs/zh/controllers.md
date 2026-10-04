# MIDI 控制器與嵌入

open-audiovisual 把 MIDI 控制器寫成資料：每台裝置一個 JSON 檔，記下面板配置、每個控制項送出的
MIDI 訊息、LED 回饋、怎麼認出它的埠，以及每個數字出自哪一份文件。同一個檔案可以變成螢幕上能彈的
控制器，接上實體裝置時跟著動，也能放進任何網頁。所有裝置都在[控制器頁面](https://openaudiovisual.com/zh/controllers/)。

## 放進網頁

```html
<script type="module" src="https://openaudiovisual.com/packages/midi/element.js"></script>
<oav-controller profile="akai-lpd8" readout></oav-controller>
```

這樣就接好了。沒有 Web MIDI 的瀏覽器（Safari、iPad）一樣能彈、一樣送出事件，只有硬體和 MIDI
輸出會顯示無法使用。除非打開 `hardware`、`midi-out` 或學習模式，它不會要求 MIDI 權限。

| 屬性 | 作用 |
|---|---|
| `profile` | 哪一台：id、短名稱，或你自己的設定檔 JSON 網址 |
| `layout` | `auto`、`face`（照實物的樣子）或 `stack`（為直拿的手機重新排） |
| `hardware` | `on`，或 `ask` 顯示一個按鈕：實體裝置會帶動螢幕上那一台 |
| `midi-out` | 埠名稱（`IAC`、`loopMIDI`）、`/正規表示式/` 或 `ask`：彈的內容送到那裡 |
| `channel` | 1–16，你的機器設在別的頻道時用 |
| `picker`、`readout`、`learn`、`follow` | 裝置選單、最後一則訊息、學習按鈕、接上哪台認得的裝置就切到哪台 |

## 聽它

```js
const el = document.querySelector('oav-controller');
el.addEventListener('control', (e) => {
  const { id, value, signal, message, source } = e.detail;
  // 'k1'  0..1  'midi/lpd8/k1'  { type: 'cc', ch: 1, cc: 70, value: 53 }  'ui' | 'hardware'
});
await el.ready;
el.set('k1', 0.5);           // 像手一樣動一個控制項
el.ingest([0xb0, 70, 64]);   // 從任何地方來的 MIDI：面板會跟著動
```

其他事件：`noteon`、`noteoff`、`connect`、`disconnect`、`status`、`profilechange`、`ready`、
`error`。全部都會冒泡，也會穿過 shadow root。每個事件的每個欄位，寫在
[packages/midi/README.md](../../packages/midi/README.md)。

## 不用元素

```js
import { createController } from 'https://openaudiovisual.com/packages/midi/index.js';

const ctl = createController('akai-lpd8', { signals });   // signals：發進一場演出
ctl.mount(document.querySelector('#pads'));                // 可省略
ctl.on('control', (e) => console.log(e.signal, e.value));
```

在演出裡，不要在 `update()` 裡讀 `midi/lpd8/k1`：用 `controllerRoutes(profile, { k1: 'hue' })`
把它接到參數（[AGENTS.md](../../AGENTS.md) 的第一條規則）。範例 09 一次替六台裝置這樣接。

## 用 iframe

給只能放 iframe 的地方：

```html
<iframe src="https://openaudiovisual.com/embed/controller/?profile=akai-lpd8&readout&frame=pads"
        width="720" height="220" style="border:0" allow="midi" title="AKAI LPD8"></iframe>
```

每個事件都會以 `{ source: 'openav', type, frame, detail }` 傳給上層網頁；它也接受
`{ target: 'openav', type: 'set' | 'ingest' | 'press' | 'release' | 'reset' | 'profile' |
'layout' | 'get', … }`。加上 `origin=https://你的網站`，就只和你的網頁溝通。

## 拿它彈你的 DAW

1. macOS：音訊 MIDI 設定 → 視窗 → 顯示 MIDI 工作室 → IAC 驅動程式 → 勾選「裝置已上線」。
   Windows：安裝 loopMIDI，新增一個埠。
2. `<oav-controller profile="akai-lpd8" midi-out="IAC">`（Windows：`midi-out="loopMIDI"`）。
3. Ableton Live 把那個輸入的 Track 和 Remote 打開；TouchDesigner 放一個 MIDI In CHOP；
   Resolume 到 Preferences → MIDI。

螢幕上彈的會送出去；實體硬體的動作不會轉送（DAW 本來就聽得到它）。引擎從不聽 IAC 輸入，元素也會
把和輸出同名的輸入靜音，所以不會形成迴圈。

## 加入一台控制器

1. 從 `packages/midi/profiles/` 複製最接近的檔案，或一個通用版面。
2. 照說明書的 MIDI 實作表，寫下每個控制項的類型和訊息。
3. 每個出處都要引用；沒確認的標上 `"verified": false` 並寫一句說明。
4. `validateProfile(profile)` 會列出每個問題；`npm test` 會檢查每個內建設定檔。
5. 用 `<oav-controller profile="./my-device.json">` 試彈，再登記到 `profiles/index.js`，開一個
   pull request。

沒有說明書：選一個通用版面，按「學習」，依序動你的控制項，把 `controller.exportMapping()` 的結果
留下來，當作設定檔的起點。
