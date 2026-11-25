# 投影與 LED 牆對位

由好幾路輸出組成的一面牆，例如兩台並排、中間有熔接帶的投影機，一條摺進兩個 4K 輸出的 LED 帶，或是接在分割器上的
一個房間角落，只要寫一次，寫成一份 JSON 檔：佈局。`@openav/align`（0.13.0 起）用三種方式讀這份檔：校正圖樣、廠商
的對位圖，以及作品真正的輸出映射。三者讀的是同一份資料，所以圖樣在牆上對了，作品在牆上就對。佈局之上是現場那天
手動做的校正：每台投影機的四角、網格、羽化邊、遮罩和亮度。至於有一天能自己完成這些事的相機閉環對位，這個套件目前
有的是圖樣產生器，也就是通道分離的格雷碼。讀相機的部分還沒有做。範例
[31，投影對位](https://openaudiovisual.com/examples/31-align/) 在一個螢幕上、不需要任何硬體，把這些全部跑一遍。

這一章不是投影視窗，也不是螢幕拼接。[投影與影像輸出](output.md) 是一個舞台透過輸出視窗送出去，每個視窗四個角。
[多螢幕拼接：一張畫布](tile.md) 是很多台裝置各畫自己的那一塊，用一張照片定位。
[output、tile 與 align](#output-tile-and-align) 說明三者的差別，以及 align 的校正檔怎麼送進輸出視窗。

## 佈局

**作品畫布**是攤平的牆：彎曲的牆，或一個房間並排的幾面牆，都變成一個矩形，作品就畫這個大小。**段**是作品畫布上的
一個矩形，也就是牆實際的一塊。**輸出**是**桌面**上的一個矩形，桌面是全螢幕瀏覽器蓋住的實體像素（兩個並排的 4K
輸出，桌面就是 7680 × 2160）。**feed** 說哪一段送進哪一路輸出、貼在裡面的哪裡。下面是 `packages/align/layouts/`
裡的房間角落範例，兩面牆和牆前的地面，接在一路 4K 輸出上，由分割器切成四格：

```json
{
  "format": "open-audiovisual/align@1",
  "id": "room-corner",
  "title": "Two walls meeting in a corner and the floor in front of them, three projectors on one 4K output cut 2 × 2",
  "art": { "w": 3200, "h": 1700 },
  "segments": [
    { "id": "WL", "x": 0,    "y": 0,   "w": 1600, "h": 900, "meters": { "w": 4, "h": 2.25 }, "label": "left wall",  "plan": 1 },
    { "id": "WR", "x": 1600, "y": 0,   "w": 1600, "h": 900, "meters": { "w": 4, "h": 2.25 }, "label": "right wall", "plan": 2,
      "masks": [{ "x": 1100, "y": 300, "w": 300, "h": 600, "label": "door" }] },
    { "id": "FL", "x": 0,    "y": 900, "w": 1600, "h": 800, "meters": { "w": 4, "h": 2 },    "label": "floor",      "plan": 3 }
  ],
  "outputs": [
    { "id": "O", "x": 0, "y": 0, "w": 3840, "h": 2160, "label": "4K output", "cuts": { "cols": 2, "rows": 2 } }
  ],
  "feeds": [
    { "segment": "WL", "output": "O", "x": 160,  "y": 90 },
    { "segment": "WR", "output": "O", "x": 2080, "y": 90 },
    { "segment": "FL", "output": "O", "x": 160,  "y": 1170, "rotate": 180 }
  ],
  "params": {
    "floor_turn": {
      "default": 180, "options": [0, 180], "status": "assumed",
      "note": "Which way the floor projector faces: 180 when it hangs over the open side of the room looking back at the corner.",
      "ask": "The rigger: does the floor projector face the corner or the open side?"
    }
  }
}
```

| 鍵 | |
|---|---|
| `art` | `{ w, h }`，整數像素。`meters` 只在有人量過時才寫（沒量過的數字不上牆） |
| `segments[]` | `{ id, x, y, w, h }`。選填 `meters`、`color`（`'#hex'` 或一深一淺兩色）、`cells.size`、`blend { l, r, t, b, curve, gamma }`（熔接帶，作品 px）、`masks`（門洞、開口，用段自己的 px）、`label`、`plan`（平面圖上的編號） |
| `outputs[]` | 桌面上的 `{ id, x, y, w, h }`，彼此不重疊。分割器有切的話寫 `cuts { cols, rows }` |
| `feeds[]` | `{ segment, output, x, y }`。輸出有縮放（LED 處理器）時寫 `w`、`h`。`rotate` 是順時針 0、90、180、270。一段送進兩路是疊投（兩台投影機打同一張畫面），每條 feed 各有自己的 `name` 和 `color`。現場只看得到一部分時寫 `visible` |
| `vendor[]` | 廠商自己的對位圖，`{ file, output }` 或 `{ file, rect }`，張數不限 |
| `params` | 這份佈局是依照哪些現場問題做出來的，每個都有 `default` 和 `note`。`status: "assumed"` 一定要寫 `ask`：要問誰、問什麼 |
| `ident` | 認機畫面的各個面、名字、每一邊是什麼、光帶走的順序 |

`validateLayout()` 會拒絕這些佈局：像素不是整數、段超出畫布、輸出互相重疊、feed 指不到東西或貼出輸出之外，而且一次
列出所有問題和位置。它也會提醒（收，但要看一眼）：沒送進任何一路的段、兩段重疊卻沒有熔接帶，以及公尺換算的每公尺
像素橫向和縱向差超過 2%，在 LED 牆上這幾乎都是某個數字抄錯了。上牆之前先跑：

```bash
node tools/check-align-layout.mjs packages/align/layouts/room-corner.json
```

它會印出一樣的內容，再加上每一塊落在哪裡、疊投和熔接帶、遮罩，以及還在推測中的參數和要問的問題。給這個套件前身
寫的 `"contract": "art-align/v1"` 檔案，不用改就讀得進來。

## 一份佈局，三件輸出

`computeMapping(layout)` 把佈局變成一張表，一條 feed 一塊：`src` 在作品畫布上，`dst` 在桌面上。有三件事只讀這張表：

1. **校正圖樣。** `drawPattern(ctx, mapping, pattern)` 會畫 `tiles`（每段一組深淺棋盤，有 A1、B8 這樣的格名、段名、尺寸
   和公尺、對角線、中心十字和圓）、`grid`（每 100 作品 px 一條線，每 500 一條粗線並標上作品的絕對座標）、`edges`、
   `crosshair`（變成橢圓就是比例錯了），以及 `bars`（`smpte`、`steps`，還有跨整張畫布的 `ramp`，兩段亮度不同時會看到
   斷層）。每一塊都先裁到它在桌面上的位置，再用作品像素畫：走的是作品本身的路。
2. **廠商對位圖。** `drawChart(ctx, mapping, outputId)` 為硬體或分割器廠商畫每路輸出一張 1:1 的圖：有座標的格線、分割器
   的切線和每一格的範圍、每一塊的尺寸與第一個和最後一個像素、遮罩、作品的上緣在哪一邊，頁頭寫「pixel to pixel，
   不縮放」（有縮放的塊時改成警告）。`vendorPlacements()` 把廠商自己的圖，照佈局說的位置疊到輸出上。
3. **輸出本身。** `blitPlan()` 和 `createBlitter(THREE, renderer)` 把作品的 render target 一塊一塊貼到桌面上，1:1 或縮放。
   `createWarpRenderer(THREE)` 透過校正檔來貼，也轉得了 feed。

為什麼這是保證而不是期望：圖樣不是一張「牆應該長這樣」的圖，它就是透過作品送出去的那些塊畫出來的，也走同一條 warp
（對位模式把圖樣畫在作品畫布上，用 `drawSource()`，再交給跟作品同一個 renderer）。逐格圖樣在牆上對了，作品就對。
廠商自己的圖跟逐格圖樣對不上時，錯的是佈局，不是牆：改那份檔案，圖樣、對位圖和作品會一起跟著動。

## 校正檔

校正檔（`open-audiovisual/align-calibration@1`）為每一塊存一區：四個 `corners` 在桌面上的位置（段的左上、右上、右下、
左下，單位 px），疊在這個透視之上、每邊 2 到 9 個點的 `mesh`（彎曲或不平的表面），每一邊的 `feather`（佔這區的比例，
給兩台投影機的重疊處），一個 `gamma`、一個 `gain`，以及黑色的 `masks`。沒校正過的區跟佈局的映射一模一樣。作品佈局的
每一種擺法，在同一個檔案裡各存各的區，寫成 `art-align-cal/v1` 的檔案也不用改就讀得進來。
`normalizeCalibration(file, mapping)` 會為一份映射把任何檔案補完整：讀不懂的部分就用預設值。

```js
import { computeMapping, normalizeCalibration, createWarpRenderer } from '@openav/align';

const M = computeMapping(layout);
const cal = normalizeCalibration(savedFileOrNull, M);
const warp = createWarpRenderer(THREE);                   // three.js is passed in, never imported
warp.build(M, cal.variants[M.id].zones);                  // again whenever the calibration changes
warp.draw(renderer, artTexture, { x: 0, y: 0, w: M.desktop.w, h: M.desktop.h });
```

## 到場那天手動校正

1. **出發之前。** 寫好佈局，跑一次 `node tools/check-align-layout.mjs`，能回答的推測參數先回答，再把每路輸出的對位圖寄給
   負責的廠商（用 `drawChart` 畫成輸出原尺寸，存成 PNG：縮小過的就不算對位圖）。請 LED 處理器和分割器都不要縮放。
2. **到場。** 把電腦的顯示器排列設成佈局的桌面，大小和順序都一樣，作品全螢幕橫跨所有螢幕。先放認機畫面（`ident`）：
   每一面一個顏色和名字，標出是哪台投影機、哪路輸出的哪一格，每一邊是什麼，還有一條照順序沿著牆走的光帶。順序錯了
   或方向錯了，在這裡就會先看出來。
3. **像素。** 放 `tiles`。每段的格子要在廠商圖說的位置，格名讀得清楚，疊投的兩種顏色混得均勻。格名出現在錯的位置，
   問題在佈局或處理器的設定，不是校正。
4. **四角。** 進入對位模式，放 `grid` 或 `crosshair`。一區一區來（Tab 或點一下），把四個角拖到表面的四個角上，或用
   `[ ]` 選一個角、方向鍵移動：1 px，Shift 是 10，Alt 是 0.25。會讓四邊形翻面的角不會動。
5. **網格。** 不平的表面：按 G，再拖網格點（+ − 增減點數）。
6. **熔接。** 兩台投影機重疊的地方，放灰 50%，用羽化（E）調兩邊重疊的那一側，調到看不出帶子為止，gamma 2.2 是常見的
   起點。一區的亮度用 `,` 和 `.` 拉平。
7. **遮罩。** 按 K，N 新增一塊，方向鍵放位置，Shift 改大小。佈局有列出的門洞已經遮好了。
8. **用作品檢查。** 按 P 回到作品，再看色條的黑位（看得到 4%、看不到 2%）、全白看均勻度、全黑看不該有光的地方有沒有
   漏光。
9. **存起來。** 每次改動一秒後自動存檔（在瀏覽器裡，留最近 20 次當備份，在 app 裡則透過 bridge 寫成檔案）。X 匯出檔案
   跟演出放在一起，I 匯入，L 列出備份。

| 按鍵（對位模式） | |
|---|---|
| C、G、E、K | 調四角、網格、羽化、遮罩 |
| Tab、1–9、點一下 | 選一區 |
| `[` `]` | 換把手（四角、網格點、羽化的邊、遮罩） |
| 方向鍵 | 移 1 px，Shift ×10，Alt ×0.25。遮罩：Shift 改大小 |
| 拖、Shift＋拖 | 一個把手、整區 |
| + − · Q · N · , . | 網格密度 · 整區轉 90° · 新增遮罩 · 亮度 |
| P、Shift+P · V | 下一個畫面 · 下一種擺法 |
| O · J · Backspace | 隱藏外框 · 面板換角落 · 把手回原位（Shift：整區） |
| ⌘S · ⌘Z · L · X · I · A | 存檔 · 復原 · 備份 · 匯出 · 匯入 · 離開 |

面板說英文，`lang: 'zh'` 時說中文。牆上、對位圖上和認機畫面上畫的字也吃同一個選項。

## 格雷碼序列

格雷碼讓相機找出投影機的哪個像素落在哪裡。投影機的每一個軸，座標有幾個位元就要幾張黑白條紋圖，也就是
`ceil(log2 size)`，每張後面接它的反相（這樣不管光怎麼打，每個相機像素都有自己的閾值），最前面再加一張全白和一張全黑：
1920 × 1200 的投影機是 11 + 11 個位元，共 46 張。用格雷碼的原因是，落在條紋邊上的相機像素讀錯一個位元時，誤差只有
一個投影機像素，不是半張畫面。**通道分離**：每台投影機只畫在自己的色通道 R、G 或 B，所以三台同時投，每張只要拍一張
照片就同時量完三台。第四台要第二輪（`channelPlan`）。

`graySequence()` 列出所有圖，`drawGrayFrame()` 在桌面上畫其中一張。它們畫在輸出像素上，從不經過校正檔：要量的是
投影機本身。範例 31 的 Gray code 按鈕可以用 `[` 和 `]` 一張一張看，旁邊寫著每張的名字。

拍法：相機放腳架，擺在看得到每一面的位置，曝光、對焦、白平衡都手動鎖定，場地關燈，所有投影機打開。照序列的順序
一張圖拍一張，照片用圖的名字命名（`frameLabel()`）。拍攝中間不要動到相機。

## 還沒做的部分

相機那一半。自動對位還需要這些，照順序：

| 階段 | 做什麼 | 這裡 |
|---|---|---|
| 0 | 相機的內參與畸變、色通道之間的串擾 | 還沒做 |
| 1 | 圖樣（通道分離的格雷碼），然後是取像、每個相機像素的閾值、相機與投影機的對應 | 圖樣和位元轉座標的數學（`decodeGrayBits`）做好了，其他還沒做 |
| 2 | 從對應換到作品畫布：「對」是什麼意思，是站在這裡的觀眾看起來對，還是均勻地鋪在表面上（這是藝術上的選擇） | 還沒做 |
| 3 | 熔接：權重、量出來的亮度場、黑位 | 佈局的熔接帶（`blendWeight`）和手動羽化做好了，量測的亮度場和黑位還沒做 |
| 4 | 收斂：用相機像素的殘差當停止條件 | 還沒做 |
| 5 | 存檔與重讀：把量出來的結果寫進同一份校正檔 | 手動校正檔做好了，量測的還沒做 |

在那之前，上面那一天的手動校正就是對位本身。

## output、tile 與 align

| | `@openav/output` | `@openav/tile` | `@openav/align` |
|---|---|---|---|
| 用來 | 一個舞台透過輸出視窗送出去：投影機、第二個螢幕、OBS | 平放在桌上的很多台螢幕，各畫一張畫布的一塊 | 由好幾路輸出組成的牆：投影機、LED 處理器、分割器、熔接帶 |
| 量什麼 | 每個視窗四個角，手動 | 一張照片裡的標記角，用解的 | 每台投影機的四角、網格、羽化、遮罩，手動。給相機用的格雷碼圖樣（相機那一半還沒做） |
| 寫出 | `open-audiovisual/output@1` | layout.json（`version: 1`） | `open-audiovisual/align@1`（佈局）和 `open-audiovisual/align-calibration@1` |
| 怎麼畫 | 在鏡像的畫布上套一個 CSS `matrix3d` homography | 每台螢幕一個 2D 或 p5 的變換 | 圖樣和對位圖用 Canvas 2D，網格透過 three.js 用 WebGL |

一塊剛好填滿它的輸出時，align 一區的四個角和 output 的一個 room 是同一個 homography。`zoneToRoom()` 和 `roomToZone()`
把一個換成另一個，並說出另一邊帶不走的東西：區的網格、羽化、遮罩和亮度，room 的 overscan 和柔邊。
`outputsFromAlign(layout)` 把佈局的輸出交給 `@openav/output`，一台投影機一個視窗，各顯示那台投影機在作品畫布上的部分，
之後 `createOutputs(show, { align })` 除了自己的設定檔，也能匯入對位模式的校正檔：

```js
import { createOutputs } from '@openav/output';
import { outputsFromAlign } from '@openav/align';

const outputs = createOutputs(show, { align: outputsFromAlign(layout) });
outputs.importLayout(calibration);                        // the four corners of each projector
```

輸出視窗是一個 CSS homography：網格、羽化和遮罩需要 WebGL（`createWarpRenderer`）。在 `@openav/output` 的視窗裡畫這些
是下一步，還沒做。範例 31 是用 three.js 在自己的畫布上畫的。

有三個套件都匯出 `validateLayout`（surface 的檢查手機控制面板，tile 的檢查 layout.json，align 的檢查這裡的佈局），兩個
匯出 `normalizeLayout`（surface、align）。一個頁面用到兩個時，換個名字匯入：
`import { validateLayout as validateAlignLayout } from '@openav/align'`。

## 從 art-align 來

`@openav/align` 就是對位模組 art-align 公開出來的版本。把 art-align 複製進自己資料夾的作品，可以把匯入改成
`@openav/align`：有文件的名字，名字和參數都不變，佈局檔和校正檔不用改就讀得進來，存回去時用新的格式名稱。牆上的字和
訊息是英文，`lang: 'zh'` 時是中文。`createCalStore()` 把檔案存在 `oav-align` 這個前綴底下，那裡還沒有存過東西時，它會
讀 art-align 的 `art-align/*` 鍵，所以 art-align 存過的校正檔還找得到。這裡沒有的：接兩個舊場地實作的轉接程式
（`toLegacyMap`、`layoutFromQuery` 這一類）、場地測試頁和它的部署工具。

## 檢查過什麼

- `tests/align.test.js`、`tests/align-warp.test.js`、`tests/align-bridge.test.js`（在 `npm test` 裡）：每份範例佈局都有效、
  沒有提醒，而且每個數字各加減一之後，不是被拒絕就是映射跟著變。art-align 格式、帶著額外鍵的檔案，映射跟新格式完全
  一樣。圖樣一塊一塊畫，格名，熔接帶上權重加起來是 1。1920 × 1200 的每一個座標都能從格雷碼圖解回來。warp 的四角、網格
  和羽化，兩種格式的校正檔。用假的 three.js 測 createWarpRenderer 和 createBlitter。用記憶體裡的 storage 測存放，包括
  art-align 的鍵。對位圖、認機畫面。align 的一區對照 `@openav/output` 自己的 `pinnedBox()`，每種旋轉和翻轉都測。還有
  套件、測試、這一章和範例裡都沒有任何客戶、場地或廠商的名字。
- 範例 31 在無頭 Chromium 151（Playwright 1.62）上，一台電腦，`node serve.js`，沒有授予任何權限，three.js 0.170.0 從 jsDelivr
  載入（`packages/align/test/align-smoke.cjs`）：每份範例佈局載入時都沒有 console 錯誤，認機畫面和對位圖都畫得出來，每塊一片
  warp 網格。畫面清單一換，warp 之後的畫布就跟著變。在對位模式用滑鼠拖一個角，那一區的角移動的距離跟拖的一樣，畫出來的畫面
  也變了。重新整理之後，角還在原來放的位置。導覽設成中文時，對位面板是中文。格雷碼圖樣在輸出像素上一張一張走（第 5／46 張，
  X 位元 2／11）。那裡的 WebGL 是瀏覽器的軟體算繪。

沒檢查過：真的投影機、真的 LED 處理器或分割器、由好幾個實體輸出組成的桌面、場地電腦顯示卡上的 WebGL warp、
`createCalStore` 的 Electron bridge，以及任何相機。
