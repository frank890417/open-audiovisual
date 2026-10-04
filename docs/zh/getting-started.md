# 快速開始

## 跑起來

你需要 Node.js（目前任何一個版本都可以，CI 用 Node 22 跑測試）和一個瀏覽器。不用安裝任何東西：沒有 `npm install`，也沒有打包工具。

```bash
git clone https://github.com/frank890417/open-audiovisual.git
cd open-audiovisual
node serve.js            # → http://localhost:8080
```

`serve.js` 是關掉快取的靜態檔案伺服器（在舞台上跑到舊的程式碼，是一場惡夢），也在 `ws://<host>:8080/relay` 開好給手機用的中繼。想換連接埠，就把埠號傳進去：`node serve.js 3000`。這些指令也都寫成了 npm script：

| 指令 | 實際執行的是 |
|---|---|
| `npm start` | `node serve.js` |
| `npm run monitor` | `node packages/monitor/server.js`，後台監看，連接埠 7457 |
| `npm run bridge` | `node packages/osc/bridges/osc-bridge.js`，OSC → UDP 橋接，連接埠 7456 |
| `npm test` | `node --test tests/*.test.js` |

打開 `http://localhost:8080/examples/01-hello-particles/`。每個範例都不需要硬體就能跑。

## 用哪個瀏覽器

- 演出請用 **Chrome 或 Edge**。它們有 Web MIDI，Safari 沒有。
- **鏡頭和麥克風**只在安全環境（secure context）裡能用：`http://localhost` 或 `https://`。在跑 `serve.js` 的那台電腦上，請用 `localhost` 打開演出，不要用它的區域網路位址。
- **手機**在區域網路裡用一般的 `http://` 連進來，就能用觸控、琴鍵和控制面板。iOS 只把動作感測器和鏡頭開放給 `https://` 頁面（見[手機、中繼與控制面板](remote.md#ios-and-https)）。

## 你看到的是什麼

範例頁面分成兩部分：左邊是**舞台**（世界畫在這裡），右邊是**側邊面板**。側邊面板由上到下是：

1. **鋼琴**，附兩個核取方塊：*keyboard*（電腦鍵盤擷取）讓你用電腦鍵盤彈，*simulate performance*（模擬演奏）讓一位模擬演奏者自己彈，不用你動手。
2. **播放控制**：播放／暫停、上一個／下一個場景、重設、時鐘、目前的場景，以及一條拖曳軸，每個場景占一格。
3. **Layers**（各層狀態）：每一層現在在做什麼（每個輸入每秒幾個事件、啟用中的路由、世界和 FPS、哪些東西正從瀏覽器送出去）。
4. **L1 · Input**（輸入）：MIDI 裝置（取消勾選就把那台靜音），以及要點一下才會啟用的來源按鈕：🎤 mic（麥克風）、🖐 hands（手）、🕺 body（身體）。
5. **L2 · Mapping**（映射）：每一條路由，附一個靜音核取方塊，按 ✕ 刪除。
6. **L3 · Params**（參數）：每個參數一支推桿，按 ✕ 清除覆寫，按 *learn* 建立映射。
7. **L4 · Output — sound**（輸出：聲音），演出有聲音時才會出現：按 **🔊 enable sound**（開啟聲音）。
8. **Signals**（訊號）：每個訊號一個即時儀表。

點面板標題就能收合。

| 按鍵 | 動作 |
|---|---|
| <kbd>Space</kbd> | 播放／暫停時間軸 |
| <kbd>←</kbd> <kbd>→</kbd> | 上一個／下一個場景 |
| <kbd>R</kbd> | 停止，並把時間軸倒回 0:00 |
| <kbd>T</kbd> | 演出模式（提詞畫面） |
| <kbd>F</kbd> | 全螢幕 |
| <kbd>M</kbd> | 顯示／隱藏螢幕上的 MIDI 控制器（演出設定了 `modules.midi.controllers` 才有） |

## 不用硬體也能彈

- **螢幕鋼琴**：用滑鼠點或手指按琴鍵，在琴鍵上一路拖過去就是刮奏。
- **電腦鍵盤**：先勾選 *keyboard*（預設不擷取，免得字母鍵搶走控台的快捷鍵）。`A W S E D F T G Y H U J K O L P ;` 這幾個鍵，從鋼琴的基準音開始，依序彈出相差半音的 17 個音。<kbd>Z</kbd>／<kbd>X</kbd> 換八度，按住 <kbd>Shift</kbd> 會彈得比較大聲。
- **模擬演奏**：模擬演奏者在五聲音階裡隨興地彈，有級進、跳進、三和弦和休止，你只要看映射怎麼跟著起伏。
- **鼓機**（範例 03 和 06）：一台步進音序器，送出的訊號跟麥克風偵測鼓點時送出的長得一樣。
- **螢幕上的 MIDI 控制器**（範例 09）：畫面上是一台市售的控制器，可以用滑鼠彈（支援的裝置列在[控制器頁面](https://openaudiovisual.com/controllers/)）。接上實體的那一台，畫面就跟著你的手一起動。

這些送出的訊號都跟真實硬體一樣，所以下游分不出差別。

## 你的第一個世界

世界就是一個物件，裡面有 `params` 和四個生命週期函式。把它交給 `createShow()`，演出的其他部分就會圍著它組起來：

```js
import { createShow } from '@openav/show';
import { createCanvas } from '@openav/stage';

const pulse = {
  name: 'pulse',
  // what the piece is performed WITH: sliders, knobs, hands, the timeline
  params: [{ key: 'size', min: 10, max: 200, def: 40 }],
  init({ container, signals }) {
    this.view = createCanvas(container);
    this.r = 0;
    // a struck note is an event, so it may come straight from a signal
    signals.on('midi/note/on', ({ vel }) => { this.r = 120 * vel; });
  },
  update(dt, state) { this.r = Math.max(0, this.r - dt * 90); this.size = state.size; },
  render() {
    const { ctx } = this.view, { w, h } = this.view.fit();
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(w / 2, h / 2, this.size + this.r, 0, 7); ctx.fill();
  },
  dispose() { this.view.dispose(); },
};

await createShow({ world: pulse, modules: { sound: true } });
```

彈一個音：圓圈會跳大，再慢慢縮回去。拖動 *size* 推桿，或按旁邊的 *learn*，再轉一顆旋鈕。整個模型就是這樣：連續控制用參數，事件用訊號。

## 做一個新範例

1. 把 `examples/01-hello-particles/` 複製成 `examples/<nn>-<name>/`（用下一個還沒用的編號）。它的 `index.html` 已經替每個 `@openav/*` 套件寫好 import map。那些 `?v=` 後綴是快取戳記，部署前由 `tools/stamp-version.mjs` 寫進去。
2. 在 `main.js` 寫你的世界（[寫一個世界](writing-a-world.md)）。
3. 改掉 `index.html` 裡的 `<title>`。如果你用 p5 或其他繪圖工具，也在這裡加上 CDN 的 script 標籤。
4. 打開 `http://localhost:8080/examples/<nn>-<name>/`。

第 1–2 步，AI 代理可以用 MCP 工具 `scaffold_world` 一次做完（[給 AI 代理](agents.md)）。

## 檢查你的成果

- `npm test` 通過（測的是純邏輯：和弦、時間軸、映射、中繼、控制面板、MIDI 解析與裝置設定檔、網站頁面）。
- 頁面載入時，主控台沒有錯誤。只有一則訊息是預期中的：如果後台監看沒在跑，瀏覽器會回報 `ws://localhost:7457` 拒絕連線。頁面會自己默默重試，間隔越拉越長（最長 30 秒）。跑 `npm run monitor`，這則訊息就不會再出現。
- 按 <kbd>Space</kbd>：時間軸開始播放，畫面裡有東西隨時間改變。
- 勾選 *keyboard*，按 <kbd>A</kbd>：不接任何硬體，世界也會有反應。
- 開發者工具主控台裡的 `window.openav` 就是整場演出（signals、params、mapper、timeline…），可以自己動手戳戳看。
