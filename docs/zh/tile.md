# 多螢幕拼接：一張畫布

平放在桌上的手機、平板、筆電，不管大小、轉成什麼角度、有沒有疊在一起，都能變成一張畫布。`@openav/tile` 讓每台螢幕鋪滿小小的標記，從上方拍一張照片把它們全部找出來，之後每台螢幕只畫共同畫面裡屬於自己的那一塊。一顆圓點離開一台螢幕，會在邊框後面繼續走，從下一台它真正該出現的位置出來，大小也一樣。畫面完全不串流：每台螢幕用同樣的兩樣東西自己算畫面，一個經過中繼共用的時鐘，和一個種子。範例 [30 跨螢幕圓點](https://openaudiovisual.com/examples/30-tile-dot/) 是一顆圓點帶著火花流過每一台螢幕。

這不是投影那一章。[投影與影像輸出](output.md) 是一個舞台，只算一次，透過輸出視窗送到投影機和第二個螢幕上。這裡是很多台裝置各自算一張畫布裡自己的那一塊，位置由一張照片決定。兩者可以出現在同一場演出裡，但誰都不需要誰。從一份佈局檔手動對位的投影或 LED 牆，又是第三件事：[投影與 LED 牆對位](align.md)。

## 用三台螢幕跑起來

你需要一台跟手機連同一個 wifi 的電腦（它跑中繼）、三台要拼接的螢幕，再加一支拍照的手機（也可以是三台裡的其中一台，在放平之前用第二個分頁開）。

1. 在電腦上、repo 裡跑 `node serve.js`。它會印出手機連得到的位址，例如 `http://192.168.1.20:8080`。
2. 每台螢幕打開 `http://192.168.1.20:8080/examples/30-tile-dot/?room=desk`，點 **Tap to join**（全螢幕，並保持螢幕喚醒）。把螢幕平放：任何角度、任何間距都可以，疊在一起也沒關係。
3. 拍照的手機打開 `http://192.168.1.20:8080/packages/tile/?room=desk`。每台螢幕一秒內就會出現在清單裡，附上它的編號、像素，以及是否全螢幕、是否保持喚醒。
4. 按 **Markers**（標記）：每台螢幕變成白底黑色標記。
5. 按 **Take photo**（拍照），從上方拍一張每台螢幕都入鏡的照片。每台至少要露出四個標記，其他被手或另一支手機蓋住沒關係。正上方最好，大約 45° 以內都可以。
6. 拍照頁會在照片上框出找到的東西，並畫一張畫布的平面圖。每台都定位成功時，它會送出版面並按下 **Play**（演出）：圓點開始流動。漏掉的螢幕會在清單裡說明原因（`too-few-markers` 等）：再拍一次，或直接按 Play。

移動了螢幕？按標記，再拍一次。重新整理的螢幕只要尺寸沒變，就會留在原位（版面存在裝置上，中繼也會重播）。手邊沒有螢幕時，`packages/tile/?demo=1` 會在一張合成照片（三台螢幕、傾斜的相機）上跑同樣的偵測和求解，再跟真值比較。範例 30 的頁面不加 `?room=` 時，就是有控台、用自己時間的一台螢幕。

## 拍照頁

`packages/tile/?room=<name>` 以 `runner` 身分加入房間。它聽每台螢幕的報到，給每台一個編號（它的標記，0 到 19，同一個房間會記住），並用常駐的設定回答，中繼會把這些重播給晚到的螢幕：編號、標記或演出、版面，以及演出的種子和起點。**New start + seed** 讓每台螢幕一起從頭開始，**layout.json** 下載最後一份版面。

**Take photo**（`<input capture>`）會開手機的相機 app，用完整解析度拍，任何位址都能用。**Live camera**（`getUserMedia`，取一格）需要安全來源，所以只在 `localhost` 或 `https://` 能用，`http://192.168…` 不行。長邊超過 4096 像素的照片會先縮小再偵測。

標記由 OpenCV.js 的 ArUco 偵測器找出來（`@techstark/opencv-js@4.12.0-release.1`，OpenCV 4.12.0 的一般版本，從 jsDelivr 載，版本寫死）。它大約 10 MB（傳輸時 3 MB），只有拍照頁會載，而且是第一張照片進來時才載，之後就快取。螢幕從來不載它：標記的位元在 `dict.js` 裡，是從 OpenCV 抽出來的（見 NOTICE），框架的其他頁面和套件也都沒有提到它（`tests/tile.test.js` 會檢查）。沒有網路的場地可以自己放一份同樣的檔案，交給 `loadOpenCV(url)`。

## 用在你自己的世界

把世界包起來、把拍照頁的模式接到標記參數、讓時間軸跟著共同時鐘，再透過 view 用畫布單位畫：

```js
import { createShow } from '@openav/show';
import { createCanvas } from '@openav/stage';
import { joinTile, tileWorld, TILE_ROUTES } from '@openav/tile';   // "@openav/tile": "../../packages/tile/index.js"

const tile = joinTile({ room: 'desk' });            // or ?room=desk in the address
const world = {
  name: 'mine',
  params: [{ key: 'size', min: 0.01, max: 0.1, def: 0.03 }],
  init({ container }) { this.cv = createCanvas(container); },
  update(dt, state, io) { this.s = state; this.t = io.tile.time(); this.seed = io.tile.seed; },
  render() {
    const { canvas, ctx } = this.cv; this.cv.fit();
    const v = tile.view;                              // soloView(w, h) until a photo placed this screen
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height);
    v.apply2d(ctx, canvas.width / v.device.w);        // from here: canvas units (the reference screen's pixels)
    const { w, h } = v.canvas;
    const x = w / 2 + (w / 3) * Math.sin(this.t);    // a function of the shared time, never a sum of dt
    ctx.beginPath(); ctx.arc(x, h / 2, this.s.size * Math.min(w, h), 0, Math.PI * 2); ctx.fill();
  },
};
const show = await createShow({
  world: tileWorld(world, tile),
  routes: [...TILE_ROUTES],                           // tile/markers → tileMarkers
  onFrame: (dt, s) => tile.syncTimeline(s.timeline, dt),
});
tile.attach(show.signals);                            // tile/markers, tile/synced, tile/layout
```

- **時間。** 讀 `io.tile.time()`（共同的秒數）和 `io.tile.seed`。晚一秒開的兩台螢幕、或掉了一格的那台，還是要畫同一瞬間，所以位置是時間和種子的函式，從不累加 `dt`（範例 30 的圓點拖尾是往回取樣時間，而不是記住前幾格）。這是拼接的世界唯一讀時鐘的地方，而且讀的是共同的那個。
- **參數**仍然是世界的連續控制（[規則一](agents.md)）。`tileMarkers` 跟其他參數一樣：拍照頁透過 `tile/markers` 推它，時間軸或旋鈕也可以。它照[誰握住數值](mapping.md#who-holds-a-value)的規則走：在某台螢幕的控台上用手推過的滑桿會握住那一台，直到拍照頁真的換了模式。
- **view。** 2D 畫布用 `view.apply2d(ctx, pixelRatio)`，p5 在 `draw()` 最前面 `view.applyP5(sk)`，HTML 元素用 `transform: view.css(devicePixelRatio)` 加上 `transform-origin: 0 0`。`view.visible(x, y, r)` 跳過不在這台螢幕上的東西，`view.scale` 是每個畫布單位多少裝置像素。畫布用基準螢幕的像素量，而且包含空隙和邊框。

## 共同時鐘

每台螢幕連上時 ping 中繼十次，之後每 2 秒一次。中繼本來就會用自己的時間回答每個 ping，`ClockSync` 留下最近一分鐘裡來回最快那次的偏移（簡化版的 NTP：誤差最多是那次來回的一半，家裡的 wifi 大約幾毫秒）。`tile.now()` 是在這台螢幕上讀到的中繼時鐘，`tile.time()` 是拍照頁按下演出之後過了幾秒。螢幕照自己的垂直同步更新，所以兩台之間還是可能差一格。

`syncTimeline(timeline, dt)` 在 `timeline.advance(dt)` 之前呼叫（createShow 的 `onFrame` 就是），把播放頭放在共同時鐘一格之前的位置，這一格就落在共同時間上，並觸發它經過的場景和 cue。自動化在每台螢幕上就讀到一樣的值。共同時鐘從不等待，拼接的時間軸也一樣：某一台的暫停或跳轉在下一格就被拉回來，`hold` 場景只停一格，接著就放開（下一個場景開始，邊界上的 cue 照樣觸發）。

這不是 [`@openav/sync`](show-control.md#several-pages-one-show)，兩者是刻意分開的：

| | `@openav/sync` | 拼接的時鐘 |
|---|---|---|
| 誰掌管時間 | 一個主控頁面跑時間軸，每一格都說它在哪裡 | 沒有人：每台螢幕問中繼現在幾點 |
| 傳什麼 | 每一格傳主控端的播放頭（`T`、播放中、hold、速率、版本），還有 `extra` 資料 | 不是每一格都傳：每台螢幕每秒報到一次、每 2 秒一個 ping。版面和起點只用設定傳一次 |
| 暫停、hold、跳轉 | 每個從屬端照抄 | 不共用：下一格就被拉回來，hold 會被放開 |
| 有頁面掉線時 | 失去主控端的從屬端自己繼續跑（`timeline.follow()`） | 拍照頁可以關掉，螢幕照樣演 |
| 用在 | 同一場演出的好幾個頁面，各自用自己的尺寸：一面輸出牆、大廳、排練用的筆電 | 一張畫布切成好幾塊，每一塊都由（時間、種子）畫出來 |

框架沒有把兩者接在一起，也還沒有在同一個頁面上一起試過。

## 一張照片怎麼變成版面

每台螢幕都躺在同一個平面（桌面）上，而且它的像素在上面是均勻排的，所以不管像素密度多少，「螢幕像素 → 桌面」對每台都是一個相似轉換（旋轉、等比縮放、位移）。相機再加上一個透視「桌面 → 照片」，對所有螢幕都一樣。所以每台螢幕的單應矩陣 `H_i`（螢幕像素 → 照片）是 `G · S_i`，而 `H_ref⁻¹ · H_i = S_ref⁻¹ · S_i` 是一個相似轉換：相機的透視互相抵消，手機的 460 ppi 對筆電的 227 ppi 就落在縮放裡。`solveLayout()`：

1. 每台螢幕用它所有標記的角，算一個正規化 DLT 單應矩陣。角離它很遠的標記丟掉一次（讀錯的 id）。少於 4 個標記：這台螢幕回報 `too-few-markers`，不求解，也不丟出錯誤。
2. 基準是在照片裡佔最大面積的螢幕。其他每台螢幕的相似轉換，是把它自己的角和經過 `H_ref⁻¹` 帶回來的照片角做最小平方擬合。
3. 用 Levenberg–Marquardt 把一個平面 `G` 和所有 `S_i` 一起精修，讓透視由桌上每個標記一起量（離基準很遠的螢幕才會準）。
4. 把畫布移到所有螢幕的聯集從 (0, 0) 開始。

每台螢幕有 50 個 DICT_5X5_1000 的標記（id = 螢幕 × 50 + 格子，所以最多 20 台），短邊排四個。用 5×5 而不是 4×4：算上旋轉，這些標記任兩個至少差 5 個位元，而讀錯一個 id 會把四個角放到錯的螢幕上。結果是 `layout.json`：

```json
{ "version": 1, "kind": "planar", "units": "reference-px", "reference": "laptop",
  "canvas": { "w": 5280.0505, "h": 3638.0105 }, "photo": { "w": 3200, "h": 2400 },
  "plane": { "matrix3x3": [0.7079, -0.0529, 398.39, 0.2351, 0.7367, -418.12, 0.0000477, 0.0000618, 1] },
  "devices": [ { "id": "phone", "index": 2, "w": 1170, "h": 2532, "kind": "planar",
    "similarity": { "a": 0.409166122, "b": 0.275927653, "tx": 2417.846331, "ty": 2279.166552 },
    "matrix3x3": [0.409166122, -0.275927653, 2417.846331, 0.275927653, 0.409166122, 2279.166552, 0, 0, 1],
    "rms": 0.1388, "markers": 36, "pose": null } ] }
```

`similarity` 把螢幕的像素對到畫布上，`matrix3x3` 是同一個矩陣一列一列寫出來，`rms` 是重投影誤差，單位是照片像素。`validateLayout()` 列出一份檔案的每一個問題，一個問題一則訊息。帶著 `"pose"` 的 `"kind": "window"` 裝置，是留給下一步的位置：在 3D 空間擺放的螢幕（立起來的筆電、牆上的螢幕、投影機）。這一版會檢查它，它的 view 會說還畫不了。

## 中繼的訊息

螢幕在中繼房間裡是 `controller`，拍照頁是它的 `runner`。`packages/relay` 的 hub 完全沒改。

| 誰送 | 名稱 | 內容 |
|---|---|---|
| 螢幕 | 訊號 `tile/<id>/hello` | `{ id, w, h, dpr, screen, css, fullscreen, wake }`，每秒重送 |
| 拍照頁 | 設定 `tile/roster` | `{ grid, devices: [{ id, index, w, h }] }`：每台螢幕的編號 |
| 拍照頁 | 設定 `tile/mode` | `'markers'` 或 `'show'` |
| 拍照頁 | 設定 `tile/layout` | layout.json |
| 拍照頁 | 設定 `tile/show` | `{ seed, start }`：在共同時鐘上的起點 |

寫進演出的訊號：`tile/markers`（0 或 1，拍照頁的模式）、`tile/synced`（0 或 1），以及脈衝 `tile/layout`。靜態主機（openaudiovisual.com）上沒有中繼：跑 `node serve.js`，或用 `?relay=wss://…` 讓每個頁面連到同一個中繼。中繼沒有驗證：請用封閉的網路，房間名字取一個別人猜不到的（[安全](remote.md#security)）。

## 已知限制

- **iPhone 的 Safari 不能讓網頁全螢幕。** 把頁面加入主畫面，再從主畫面打開。沒有全螢幕也能用，但瀏覽器的工具列會變成邊框的一部分，而且收起來時尺寸會變，這台螢幕就會失去定位，直到下一張照片。
- **螢幕常亮靠系統設定**（iPhone：自動鎖定，永不。Android：螢幕逾時）。喚醒鎖只是保險：它要等那一下點擊，頁面被藏起來時系統會收回（⛶ 按鈕會再要一次），而且瀏覽器只在 `https://` 或 `localhost` 提供（在 `http://192.168…` 拍照頁會顯示 `n/a`）。
- **只能是平放的螢幕。** 立起來的筆電不在桌面那個平面上：把它放平，或等 3D 模型。
- 疊在一起的螢幕：不知道哪一台在上面，所以下面那台也會畫被蓋住的部分。
- 尺寸改變的螢幕（旋轉、網址列）會自己單獨畫，直到下一張照片。
- 在某台螢幕的控台上用手推的參數只改那一台。共用的是時間軸、時鐘和種子。拼接螢幕上的時間軸不能暫停或 hold：它跟著共同時鐘走。
- 最多 20 台螢幕。亮面螢幕會反射燈光：把亮度調高，避免燈就在桌子正上方。
- 同一個瀏覽器的兩個分頁會共用一個 id（存在 `localStorage`）：在一台電腦上試的時候，加上 `&id=a`、`&id=b`。

## 檢查過什麼

在一台機器上，沒有實體螢幕，只有瀏覽器的分頁，也沒有任何硬體：

- `tests/tile.test.js`（在 `npm test` 裡）：DLT 和相似轉換擬合，對照加了 0.5 px 雜訊的已知轉換。在合成照片上（針孔相機、真實的螢幕尺寸和密度）求解兩台和三台螢幕，包括 4 個標記和更少的情況、讀錯的標記、有精修和沒有精修。圓點跨過螢幕時保持連續。layout.json 驗證、標記 id、格子和字典、view 的矩陣、時鐘、`syncTimeline` 經過場景、cue、hold 場景、暫停和跳轉、`tileMarkers` 路由在「誰握住數值」規則下的行為，以及只有拍照頁碰得到 OpenCV。
- `packages/tile/test/tile-smoke.cjs`，手動跑，在無頭 Chromium 裡用 jsDelivr 上固定版本的 OpenCV.js：範例 30 單獨開沒有 console 錯誤。拍照頁的 `?demo=1` 把三台合成螢幕定位在真值的 0.2°、0.5 %、2 px 以內。接著在 `node serve.js` 上開一個真的房間，三個螢幕頁面分別是筆電、平板和手機的大小，用它們自己的截圖合成拍照頁要偵測和求解的照片：每台都定位在實際位置的 1 mm 以內，圓點跨過它們時連續，時鐘和時間軸都一致。

還沒試過：真的桌上放手機和平板、真的照片（反光、光線、角度、手機在畫面裡太小）、iPhone 和 Android 手機上的全螢幕和喚醒鎖、真實 wifi 上的時鐘，以及手機偵測一張 1200 萬像素照片要多久。套件的 README 列出到時候要看什麼。
