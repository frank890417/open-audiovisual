// @openav/output reference: the stage on a projector or a second screen. An output window, four-corner correction, crops for
// several projectors, blackout and brightness as params, a layout file, and a clean address for a kiosk browser, OBS or TouchDesigner.
// Read by tools/build-reference.mjs (see AGENTS.md, "Documenting a public name").

const WHY_CLICK = 'It opens a window, which a browser allows only from a click, and it needs a running show: example 29 runs it.';

export default {
  openOutput: {
    group: 'output',
    summary: {
      en: 'Opens a clean output window for a projector or a second screen and shows the stage in it, with corner-pin, a test pattern and blackout. Call it from a click.',
      zh: '開一個給投影機或第二個螢幕的乾淨輸出視窗，把舞台放進去，附四角校正、測試圖和黑場。要在點擊時呼叫。',
    },
    params: [
      { name: 'source', type: 'Object | HTMLCanvasElement | HTMLElement', en: 'What `createShow()` returned (its world\'s canvas is mirrored), a canvas, or an element with a canvas inside (the largest one is taken).', zh: '`createShow()` 回傳的東西（鏡像它的世界的畫布）、一個畫布，或裡面有畫布的元素（取最大的那個）。' },
      { name: 'name', type: 'String', optional: true, default: "'main'", en: 'The output\'s name, 1 to 32 letters, digits, `-` or `_`. It names its params (`output/<name>/blackout`, `output/<name>/brightness`), its saved corners and its window.', zh: '輸出的名字，1 到 32 個字母、數字、`-` 或 `_`。它決定這個輸出的參數名（`output/<name>/blackout`、`output/<name>/brightness`）、存下來的四個角，以及視窗。' },
      { name: 'crop', type: 'Object | null', optional: true, default: 'null', en: 'The part of the stage this output shows, `{ x, y, w, h }` from 0 to 1. `null` is the whole stage.', zh: '這個輸出顯示舞台的哪一塊，`{ x, y, w, h }`，0 到 1。`null` 是整個舞台。' },
      { name: 'fit', type: "'contain' | 'cover' | 'stretch'", optional: true, default: "'contain'", en: 'How the crop fills the window: whole with black bars, filled and cut, or pulled to the window\'s shape.', zh: '裁切的畫面怎麼放進視窗：完整放進去留黑邊、塞滿並切掉多的，或拉成視窗的形狀。' },
      { name: 'mode', type: "'mirror' | 'page'", optional: true, default: "'mirror'", en: '`\'mirror\'`: the window shows the stage\'s canvas through `captureStream()`, one render, the same frames. `\'page\'`: the window is this page again at its clean address, following this page\'s clock and held values.', zh: '`\'mirror\'`：視窗用 `captureStream()` 顯示舞台的畫布，只算一次，畫面完全一樣。`\'page\'`：視窗是這個頁面的乾淨網址，跟著這個頁面的時鐘和被握住的值。' },
      { name: 'params', type: 'Params | null', optional: true, default: 'null', en: 'When the source is not a show: a `Params` that gets this output\'s blackout and brightness.', zh: '來源不是演出時：一個 `Params`，這個輸出的黑場和亮度會加進去。' },
      { name: 'timeline', type: 'Timeline | null', optional: true, default: 'null', en: 'When the source is not a show: a `Timeline` whose automation the blackout and brightness follow.', zh: '來源不是演出時：一個 `Timeline`，黑場和亮度跟著它的自動化。' },
      { name: 'features', type: 'String', optional: true, default: "'popup,width=960,height=540'", en: 'The `window.open()` features of the window.', zh: '開視窗時 `window.open()` 的 features。' },
      { name: 'aspect', type: 'Number | null', optional: true, default: 'null', en: "Mode `'page'`: the stage's shape, written into the address so the page draws it.", zh: "`'page'` 模式：舞台的形狀，寫進網址讓那個頁面照著畫。" },
      { name: 'via', type: 'true | String | null', optional: true, default: 'null', en: "Mode `'page'`: `null` is a BroadcastChannel (this browser, this machine), `true` this server's `/relay`, a `ws://` address another relay.", zh: "`'page'` 模式：`null` 是 BroadcastChannel（同一個瀏覽器、同一台機器），`true` 是這台伺服器的 `/relay`，`ws://` 位址是別台的中繼。" },
      { name: 'channel', type: 'String', optional: true, default: "'oav-output'", en: "Mode `'page'`: the sync channel the page follows.", zh: "`'page'` 模式：那個頁面跟隨的同步頻道。" },
      { name: 'storage', type: 'Storage | null', optional: true, default: 'localStorage', en: 'Where the corners are saved, under `oav-output:<name>`.', zh: '四個角存在哪裡，鍵是 `oav-output:<name>`。' },
    ],
    returns: {
      type: 'Object',
      en: 'The output: `{ name, mode, window, closed, edit(on), pattern(on), room, set(partial), reset(), close() }`. `room` is what the venue did to it (corners, flips, turn, border, soft edge).',
      zh: '這個輸出：`{ name, mode, window, closed, edit(on), pattern(on), room, set(partial), reset(), close() }`。`room` 是場地對它做的事（四個角、翻轉、旋轉、黑邊、柔邊）。',
    },
    description: [
      {
        en: 'Call it from a click: a browser opens a window only after a gesture, and when it refuses, `openOutput` throws. Drag the window onto the projector and press F in it, or let it find the screens: with the Window Management API and its permission it lists them and goes fullscreen on the one you click. The permission is only ever asked from a click in the output window.',
        zh: '要在點擊時呼叫：瀏覽器只在使用者有動作之後才開視窗，被擋下時 `openOutput` 會丟出錯誤。把視窗拖到投影機上，在視窗裡按 F，或讓它找螢幕：瀏覽器有 Window Management API 而且允許時，它會列出每個螢幕，點哪個就在哪個全螢幕。權限只會在輸出視窗裡點擊時才詢問。',
      },
      {
        en: "In the window: E edits the corners (drag the four handles, or pick one with 1 to 4 and move it with the arrows, Shift for 10 px), G shows a test pattern bent the same way, B toggles the blackout param, F goes fullscreen, H and V flip, O turns 90°, [ and ] add a black border, R puts the corners back. Every change is saved for that output name, so a venue's setup survives a reload.",
        zh: '在視窗裡：E 編輯四個角（拖四個把手，或用 1 到 4 選一個，再用方向鍵移動，按住 Shift 一次 10 px），G 顯示跟著彎的測試圖，B 切換黑場參數，F 全螢幕，H 和 V 翻轉，O 轉 90°，[ 和 ] 加黑邊，R 把四個角放回去。每個改動都依輸出名字存下來，所以場地的設定重新整理後還在。',
      },
      {
        en: "Mode `'mirror'` shows exactly what the stage shows, at the size the stage's canvas has on this page, about a frame later, and only while this page stays open. Mode `'page'` renders the world again at the window's own size, on any machine, but shares only the clock and the held values: a world that reacts to a note or integrates `dt` draws something else there.",
        zh: "`'mirror'` 模式顯示的跟舞台完全一樣，大小是舞台畫布在這個頁面上的大小，大約晚一幀，而且只有這個頁面開著時才有畫面。`'page'` 模式在視窗自己的大小重新算一次世界，任何一台機器都行，但只共用時鐘和被握住的值：對音符起反應、或把 `dt` 累加起來的世界，在那裡會畫出不一樣的東西。",
      },
    ],
    notes: [
      {
        en: 'A DOM or SVG world has no canvas to mirror: the window says so, and mode `\'page\'` works for it.',
        zh: 'DOM 或 SVG 的世界沒有畫布可以鏡像：視窗會說明，改用 `\'page\'` 模式就行。',
      },
    ],
    examples: [
      {
        code: `import { openOutput } from '@openav/output';

const show = window.openav;                       // what createShow() returned
document.querySelector('#open').onclick = () => {
  const out = openOutput(show, { name: 'front' });
  out.pattern(true);                              // the test pattern, to line up the projector
};`,
        caption: { en: 'A click opens a window called "front" with the stage and its test pattern in it.', zh: '點一下就開一個叫 front 的視窗，裡面是舞台和測試圖。' },
        run: 'static', why: WHY_CLICK,
      },
    ],
    related: ['createOutputs', 'outputUrl', 'cornerPin', 'outputParams'],
    keywords: {
      en: ['projector', 'second screen', 'output window', 'fullscreen', 'corner pin', 'keystone', 'mirror', 'captureStream'],
      zh: ['投影機', '第二個螢幕', '輸出視窗', '全螢幕', '四角校正', '梯形校正', '鏡像'],
    },
  },

  createOutputs: {
    group: 'output',
    summary: {
      en: 'Declares a show\'s outputs once, at load: their params exist from the start, the stage takes their shape, and the desk gets a panel to open, edit and test them.',
      zh: '在載入時一次宣告演出的所有輸出：它們的參數一開始就在，舞台照它們的形狀畫，控台多一個面板可以開視窗、編輯和測試。',
    },
    params: [
      { name: 'show', type: 'Object', en: 'What `createShow()` returned.', zh: '`createShow()` 回傳的東西。' },
      { name: 'outputs', type: 'Array', optional: true, default: "[{ name: 'main' }]", en: 'One entry per output: `{ name, crop, fit }` (a name alone also works).', zh: '每個輸出一筆：`{ name, crop, fit }`（只寫名字也可以）。' },
      { name: 'aspect', type: 'Number | null', optional: true, default: 'null', en: 'The stage\'s shape on this page, `16 / 9` or `32 / 9` for two projectors side by side: the world\'s layer is boxed to it, centred, black around. `null` leaves the stage as it is.', zh: '舞台在這個頁面上的形狀，`16 / 9`，或兩台投影機並排時的 `32 / 9`：世界那一層會被框成這個形狀，置中，四周黑色。`null` 不改舞台。' },
      { name: 'panel', type: 'Boolean | HTMLElement', optional: true, default: 'true', en: 'The "L4 · Output" panel: `true` puts it in the console, an element puts it there, `false` leaves it out.', zh: '「L4 · Output」面板：`true` 放在控台裡，給一個元素就放在那裡，`false` 不要。' },
      { name: 'via', type: 'true | String | null', optional: true, default: 'null', en: "For mode `'page'` across browsers or machines: `true` is this server's `/relay`, or a `ws://` address.", zh: "跨瀏覽器或跨機器使用 `'page'` 模式時：`true` 是這台伺服器的 `/relay`，或一個 `ws://` 位址。" },
      { name: 'storage', type: 'Storage | null', optional: true, default: 'localStorage', en: 'Where the corners are saved.', zh: '四個角存在哪裡。' },
    ],
    returns: {
      type: 'Object',
      en: 'The outputs, also on `show.outputs`: `{ names, open(name, o), close(name), get(name), edit(name, on), pattern(name, on), url(name, o), exportLayout(), importLayout(doc), keys(name) }`.',
      zh: '所有輸出，也放在 `show.outputs`：`{ names, open(name, o), close(name), get(name), edit(name, on), pattern(name, on), url(name, o), exportLayout(), importLayout(doc), keys(name) }`。',
    },
    description: [
      {
        en: 'Rule 1 says what is performed goes through params, so each output\'s blackout and brightness must exist before any window opens: the timeline can fade the projector, a MIDI fader learned onto `output/front/brightness` works at once, and a saved mapping finds its target. `createOutputs` adds them at load; `open(name)`, from a click, opens the window with what was declared for that name.',
        zh: '規則一說：被演奏的東西都經過參數，所以每個輸出的黑場和亮度必須在任何視窗打開之前就存在：時間軸才能把投影機淡出，learn 到 `output/front/brightness` 的 MIDI 推桿馬上就能用，存下來的對應也找得到目標。`createOutputs` 在載入時就把它們加進去，在點擊時呼叫 `open(name)`，就照那個名字宣告的設定開視窗。',
      },
      {
        en: '`exportLayout()` gives every output\'s corners, flips, turn, border and soft edge as one `open-audiovisual/output@1` document, and `importLayout(doc)` checks a file, saves it and applies it to open windows. On a clean page of one of these outputs (`?output=left`), what the code declares for `left` applies where the address says nothing.',
        zh: '`exportLayout()` 把每個輸出的四個角、翻轉、旋轉、黑邊和柔邊寫成一份 `open-audiovisual/output@1` 文件，`importLayout(doc)` 先檢查檔案，再存下來，套用到開著的視窗。在其中一個輸出的乾淨頁面上（`?output=left`），網址沒說的部分，就用程式碼替 `left` 宣告的設定。',
      },
    ],
    examples: [
      {
        code: `import { createOutputs } from '@openav/output';

const show = window.openav;                       // what createShow() returned
const outputs = createOutputs(show, {
  outputs: [{ name: 'left', crop: { x: 0, y: 0, w: 0.5, h: 1 } }, { name: 'right', crop: { x: 0.5, y: 0, w: 0.5, h: 1 } }],
  aspect: 32 / 9,                                 // one canvas over two 16:9 projectors
});
document.querySelector('#left').onclick = () => outputs.open('left');
document.querySelector('#right').onclick = () => outputs.open('right');`,
        caption: { en: 'One 32:9 stage, two buttons: each opens a window with its half, for two projectors side by side.', zh: '一個 32:9 的舞台、兩個按鈕：各開一個視窗放一半，給並排的兩台投影機。' },
        run: 'static', why: WHY_CLICK,
      },
    ],
    related: ['openOutput', 'outputParams', 'parseOutputLayout', 'cropBox'],
    keywords: {
      en: ['outputs', 'two projectors', 'side by side', 'crop', 'aspect', 'layout', 'export', 'import', 'desk panel'],
      zh: ['輸出', '兩台投影機', '並排', '裁切', '比例', '設定檔', '匯出', '匯入', '控台面板'],
    },
  },

  cornerPin: {
    group: 'output',
    summary: {
      en: 'The homography that moves the four corners of a rectangle to four points: the math of corner-pin, as 9 numbers. Throws when the quad folds or collapses.',
      zh: '把一個矩形的四個角移到四個點的單應矩陣（homography）：四角校正背後的數學，回傳 9 個數字。四邊形會翻折或塌掉時丟出錯誤。',
    },
    params: [
      { name: 'corners', type: 'Array', en: 'Four points `[[x, y] × 4]`: where the top-left, top-right, bottom-right and bottom-left corners go. They must make a convex quad.', zh: '四個點 `[[x, y] × 4]`：左上、右上、右下、左下四個角要去的位置。它們必須圍成一個凸四邊形。' },
      { name: 'width', type: 'Number', optional: true, default: '1', en: 'The rectangle\'s width (the element\'s, in px).', zh: '矩形的寬（元素的寬，單位 px）。' },
      { name: 'height', type: 'Number', optional: true, default: '1', en: 'The rectangle\'s height.', zh: '矩形的高。' },
    ],
    returns: {
      type: 'Number[]',
      en: 'Nine numbers, row by row: `[a, b, c, d, e, f, g, h, i]` maps `(x, y)` to `((a·x + b·y + c) / w, (d·x + e·y + f) / w)` with `w = g·x + h·y + i`.',
      zh: '九個數字，一列一列：`[a, b, c, d, e, f, g, h, i]` 把 `(x, y)` 變成 `((a·x + b·y + c) / w, (d·x + e·y + f) / w)`，其中 `w = g·x + h·y + i`。',
    },
    description: [
      {
        en: 'A projector that is not square to the wall throws a trapezoid. Moving each corner of the picture to where the screen\'s corner really is undoes it, and four points decide exactly one projective transform. Hand the result to [`toMatrix3d()`](#toMatrix3d) and the browser bends a whole element with it, on the GPU.',
        zh: '投影機沒有正對牆面，投出來就是梯形。把畫面的每個角移到螢幕真正的角上，就能抵消它，而四個點剛好決定一個投影轉換。把結果交給 [`toMatrix3d()`](#toMatrix3d)，瀏覽器就用 GPU 把整個元素照著彎過去。',
      },
      {
        en: 'A quad that is not convex (a corner pushed inside, two edges crossed), whose corners lie on one line or enclose no area, is refused with the reason: no projector throws it, and the matrix for it would turn the picture inside out.',
        zh: '不是凸的四邊形（一個角被推進去、兩條邊交叉）、三個角在同一條線上，或圍不出面積的，會被拒絕並說明原因：沒有投影機投得出這種形狀，而它的矩陣會把畫面整個翻過來。',
      },
    ],
    examples: [
      {
        code: `import { cornerPin, toMatrix3d } from '@openav/output';

const H = cornerPin([[40, 10], [380, 0], [400, 300], [0, 280]], 400, 300);
const at = (x, y) => { const w = H[6] * x + H[7] * y + H[8]; return [(H[0] * x + H[1] * y + H[2]) / w, (H[3] * x + H[4] * y + H[5]) / w].map((v) => v.toFixed(1)); };
document.getElementById('app').innerHTML = 'top-left → ' + at(0, 0) + '<br>bottom-right → ' + at(400, 300) + '<br>' + toMatrix3d(H);`,
        caption: { en: 'The rectangle\'s top-left lands on 40,10 and its bottom-right on 400,300, then the CSS transform that does it.', zh: '矩形的左上角落在 40,10，右下角落在 400,300，接著是做到這件事的 CSS transform。' },
      },
      {
        code: `import { cornerPin } from '@openav/output';

try { cornerPin([[0, 0], [1, 0], [0, 1], [1, 1]]); }
catch (e) { document.getElementById('app').textContent = e.message; }`,
        caption: { en: 'Two corners swapped make a bow tie: refused, "the quad is not convex".', zh: '兩個角對調變成蝴蝶結：被拒絕，訊息是 the quad is not convex。' },
      },
    ],
    related: ['toMatrix3d', 'openOutput', 'parseOutputLayout'],
    keywords: {
      en: ['homography', 'corner pin', 'keystone', 'perspective', 'quad', 'projective transform', 'projection mapping'],
      zh: ['單應矩陣', '四角校正', '梯形校正', '透視', '四邊形', '投影轉換', '投影映射'],
    },
  },

  toMatrix3d: {
    group: 'output',
    summary: {
      en: 'The CSS `matrix3d(…)` for a homography, so a browser bends a whole element with it. Use it with `transform-origin: 0 0`.',
      zh: '把單應矩陣寫成 CSS 的 `matrix3d(…)`，讓瀏覽器照著彎整個元素。要搭配 `transform-origin: 0 0`。',
    },
    params: [
      { name: 'H', type: 'Number[]', en: 'Nine numbers row by row, what [`cornerPin()`](#cornerPin) returns.', zh: '一列一列的九個數字，也就是 [`cornerPin()`](#cornerPin) 回傳的東西。' },
    ],
    returns: { type: 'String', en: '`matrix3d(…)` with 16 numbers in fixed notation (no exponent).', zh: '有 16 個數字的 `matrix3d(…)`，用一般小數寫法（沒有指數）。' },
    description: [
      {
        en: 'CSS lists a 4×4 matrix column by column; the homography\'s third row becomes the perspective column, and z passes through. The element\'s box must be the rectangle the homography was made for, and its `transform-origin` `0 0`.',
        zh: 'CSS 的 4×4 矩陣是一行一行（column）列出來的。單應矩陣的第三列變成透視的那一行，z 原封不動。元素的大小必須是當初算單應矩陣用的那個矩形，`transform-origin` 要是 `0 0`。',
      },
    ],
    examples: [
      {
        code: `import { cornerPin, toMatrix3d } from '@openav/output';

const box = document.getElementById('app');
box.style.cssText = 'width:300px;height:200px;background:#2e6df6;transform-origin:0 0;color:#fff;font:20px system-ui;padding:0';
box.textContent = 'pinned';
box.style.transform = toMatrix3d(cornerPin([[30, 20], [290, 0], [300, 200], [0, 170]], 300, 200));`,
        caption: { en: 'A blue box bent so that its corners sit on four chosen points, its text bent with it.', zh: '一個藍色方塊被彎過去，四個角落在選好的四個點上，裡面的字也跟著彎。' },
      },
    ],
    related: ['cornerPin', 'openOutput'],
    keywords: { en: ['matrix3d', 'css transform', 'perspective', 'homography'], zh: ['matrix3d', 'CSS transform', '透視', '單應矩陣'] },
  },

  cropBox: {
    group: 'output',
    summary: {
      en: 'Where a source goes so that one region of it fills a box: the crop math behind two projectors from one canvas, with contain, cover or stretch.',
      zh: '來源要放在哪裡，才能讓它的某一塊填滿一個框：一張畫布分給兩台投影機背後的裁切數學，可以 contain、cover 或 stretch。',
    },
    params: [
      { name: 'crop', type: 'Object | null', optional: true, default: 'null', en: 'The region, `{ x, y, w, h }` from 0 to 1 of the source (or `[x, y, w, h]`). `null` is all of it.', zh: '那一塊，來源的 0 到 1，`{ x, y, w, h }`（或 `[x, y, w, h]`）。`null` 是整個來源。' },
      { name: 'source', type: 'Object', en: 'The source\'s size, `{ w, h }` in px.', zh: '來源的大小，`{ w, h }`，單位 px。' },
      { name: 'box', type: 'Object', en: 'The box\'s size, `{ w, h }` in px.', zh: '框的大小，`{ w, h }`，單位 px。' },
      { name: 'fit', type: "'contain' | 'cover' | 'stretch'", optional: true, default: "'contain'", en: 'The whole region with bars, the box filled and the rest cut, or the region pulled to the box\'s shape.', zh: '整塊放進去留黑邊、填滿框把多的切掉，或把那一塊拉成框的形狀。' },
    ],
    returns: {
      type: 'Object',
      en: '`{ clip, source }`, each `{ left, top, width, height }` in the box\'s px: the part of the box the picture covers, and where the whole source sits (it may reach far outside the box).',
      zh: '`{ clip, source }`，兩者都是框的 px 座標 `{ left, top, width, height }`：畫面蓋住框的哪一部分，以及整個來源放在哪裡（可能遠遠超出框）。',
    },
    description: [
      {
        en: 'Place the source at `source` inside an element at `clip` with `overflow: hidden`, and only the crop shows. A crop is normalized, so it holds whatever size the stage is drawn at. Where two crops meet there is no blend: edge blending is not part of this package.',
        zh: '把來源放在 `source` 的位置，外面包一個在 `clip` 位置、`overflow: hidden` 的元素，就只看得到裁切的那一塊。裁切是正規化的數值，所以舞台用什麼大小畫都適用。兩塊裁切接起來的地方沒有融合：邊緣融合（edge blending）不在這個套件裡。',
      },
    ],
    examples: [
      {
        code: `import { cropBox } from '@openav/output';

const src = { w: 3840, h: 1080 }, box = { w: 1920, h: 1080 };
const left = cropBox({ crop: { x: 0, y: 0, w: 0.5, h: 1 }, source: src, box });
const right = cropBox({ crop: { x: 0.5, y: 0, w: 0.5, h: 1 }, source: src, box });
document.getElementById('app').textContent = 'left: source at ' + left.source.left + ' · right: source at ' + right.source.left;`,
        caption: { en: 'A 32:9 canvas on two 16:9 projectors: the left one shows it from 0, the right one from -1920.', zh: '32:9 的畫布放在兩台 16:9 投影機上：左邊那台從 0 開始，右邊那台從 -1920 開始。' },
      },
    ],
    related: ['createOutputs', 'openOutput'],
    keywords: { en: ['crop', 'region', 'letterbox', 'contain', 'cover', 'two projectors', 'split'], zh: ['裁切', '區域', '黑邊', 'contain', 'cover', '兩台投影機', '分割'] },
  },

  OUTPUT_FORMAT: {
    group: 'output',
    summary: {
      en: 'The format of a layout file: `open-audiovisual/output@1`, the `format` field of what `exportLayout()` writes and `parseOutputLayout()` reads.',
      zh: '輸出設定檔的格式：`open-audiovisual/output@1`，也就是 `exportLayout()` 寫出、`parseOutputLayout()` 讀進來的那份文件的 `format` 欄位。',
    },
    description: [
      {
        en: 'The file is the room, the code is the show: a layout file holds what the venue did to each output (four corners as 0..1 of the window, `flipX`, `flipY`, `rotate` 0/90/180/270, `overscan` up to 0.45, `soft` up to 0.5), never what it shows. A file with another format is refused.',
        zh: '檔案記的是場地，程式碼記的是演出：設定檔只存場地對每個輸出做了什麼（四個角，是視窗的 0 到 1、`flipX`、`flipY`、`rotate` 0/90/180/270、`overscan` 最多 0.45、`soft` 最多 0.5），從來不存它顯示什麼。格式不同的檔案會被拒絕。',
      },
    ],
    examples: [
      {
        code: `import { OUTPUT_FORMAT } from '@openav/output';

const doc = { format: OUTPUT_FORMAT, outputs: { front: { corners: [[0.02, 0.01], [0.97, 0.03], [0.99, 0.98], [0.01, 0.96]], flipX: true } } };
document.getElementById('app').textContent = JSON.stringify(doc);`,
        caption: { en: 'A layout file for one output called "front", mirrored for rear projection, written by hand.', zh: '手寫一份設定檔，只有一個叫 front 的輸出，為了背投而左右鏡像。' },
      },
    ],
    related: ['parseOutputLayout', 'createOutputs'],
    keywords: { en: ['layout file', 'format', 'json', 'venue'], zh: ['設定檔', '格式', 'JSON', '場地'] },
  },

  parseOutputLayout: {
    group: 'output',
    summary: {
      en: 'Reads an `open-audiovisual/output@1` layout file (text or object), fills in the defaults and checks it, throwing one error that lists every problem.',
      zh: '讀一份 `open-audiovisual/output@1` 輸出設定檔（文字或物件），補上預設值並檢查，有問題時丟出一個列出所有問題的錯誤。',
    },
    params: [
      { name: 'doc', type: 'String | Object', en: 'The file\'s text, or the object it holds.', zh: '檔案的文字，或它裝的物件。' },
    ],
    returns: {
      type: 'Object',
      en: '`{ format, outputs }`, every output with all six keys: `corners`, `flipX`, `flipY`, `rotate`, `overscan`, `soft`.',
      zh: '`{ format, outputs }`，每個輸出都有六個鍵：`corners`、`flipX`、`flipY`、`rotate`、`overscan`、`soft`。',
    },
    description: [
      {
        en: 'A file from the venue is fixed in one go: an unknown key, a corner outside -0.5 to 1.5, a quad that is not convex, a turn of 45° and a bad name are all listed in the one error, each with its place (`outputs.front.rotate`). Missing keys take the defaults (the picture fills the window).',
        zh: '從場地帶回來的檔案可以一次改好：不認得的鍵、超出 -0.5 到 1.5 的角、不是凸的四邊形、轉 45° 和不合格的名字，全都列在同一個錯誤裡，每一項都標出位置（`outputs.front.rotate`）。沒寫的鍵用預設值（畫面填滿視窗）。',
      },
    ],
    examples: [
      {
        code: `import { parseOutputLayout } from '@openav/output';

try {
  parseOutputLayout({ format: 'open-audiovisual/output@1', outputs: { front: { rotate: 45, overscan: 0.9 } } });
} catch (e) { document.getElementById('app').innerText = e.message; }`,
        caption: { en: 'Both problems in one message: rotate must be 0, 90, 180 or 270, overscan from 0 to 0.45.', zh: '兩個問題在同一則訊息裡：rotate 要是 0、90、180 或 270，overscan 要在 0 到 0.45 之間。' },
      },
    ],
    related: ['OUTPUT_FORMAT', 'createOutputs', 'cornerPin'],
    keywords: { en: ['layout file', 'validate', 'import', 'json'], zh: ['設定檔', '檢查', '匯入', 'JSON'] },
  },

  outputParams: {
    group: 'output',
    summary: {
      en: 'The param entries of one or more outputs: `output/<name>/blackout` (0 or 1) and `output/<name>/brightness` (0..1, default 1), for `params.add()`.',
      zh: '一個或多個輸出的參數：`output/<name>/blackout`（0 或 1）和 `output/<name>/brightness`（0 到 1，預設 1），給 `params.add()` 用。',
    },
    params: [
      { name: 'names', type: 'String | String[]', en: 'One output\'s name, or several.', zh: '一個輸出的名字，或好幾個。' },
    ],
    returns: { type: 'Object[]', en: 'Two entries per output, each with `key`, `label`, `min`, `max`, `def` (blackout also `step: 1`) and `group: \'output\'`.', zh: '每個輸出兩筆，都有 `key`、`label`、`min`、`max`、`def`（blackout 另有 `step: 1`），以及 `group: \'output\'`。' },
    description: [
      {
        en: 'Rule 1: the projector\'s blackout is not a button wired to one window, it is a param, so the console\'s slider, a MIDI fader, the timeline\'s automation and a phone all reach it the same way. Brightness is a black veil over the picture (`1 - brightness` of it), not the projector\'s lamp. [`createOutputs()`](#createOutputs) and [`openOutput()`](#openOutput) add these for you.',
        zh: '規則一：投影機的黑場不是接在某個視窗上的按鈕，而是一個參數，所以控台的滑桿、MIDI 推桿、時間軸的自動化和手機，都用同一種方式推它。亮度是蓋在畫面上的一層黑紗（蓋 `1 - brightness`），不是投影機的燈泡。[`createOutputs()`](#createOutputs) 和 [`openOutput()`](#openOutput) 會替你加好。',
      },
    ],
    examples: [
      {
        code: `import { outputParams } from '@openav/output';

document.getElementById('app').innerText = outputParams(['front', 'floor']).map((p) => p.key + ' ' + p.min + '..' + p.max + ' default ' + p.def).join('\\n');`,
        caption: { en: 'Four params: blackout and brightness for "front" and for "floor".', zh: '四個參數：front 和 floor 各有黑場和亮度。' },
      },
    ],
    related: ['createOutputs', 'openOutput'],
    keywords: { en: ['blackout', 'brightness', 'params', 'fade to black', 'master'], zh: ['黑場', '亮度', '參數', '淡出到黑', '總亮度'] },
  },

  outputQuery: {
    group: 'output',
    summary: {
      en: 'What a page address asks of a clean output: `null` without `?output`, else `{ name, crop, aspect, fit, follow, via, play }`. createShow() reads it.',
      zh: '頁面網址要求乾淨輸出做什麼：沒有 `?output` 就是 `null`，有的話是 `{ name, crop, aspect, fit, follow, via, play }`。createShow() 會讀它。',
    },
    params: [
      { name: 'search', type: 'String | URLSearchParams', en: '`location.search`, or a `URLSearchParams`.', zh: '`location.search`，或一個 `URLSearchParams`。' },
    ],
    returns: { type: 'Object | null', en: 'The output\'s name (`main` when empty), its crop, the stage\'s shape, the fit, the channel to follow, the relay (`true` or an address) and whether to play at once. A bad value is dropped with a warning.', zh: '輸出的名字（空的就是 `main`）、裁切、舞台形狀、fit、要跟隨的頻道、中繼（`true` 或一個位址），以及要不要一載入就播放。不合格的值會被丟掉並警告。' },
    description: [
      {
        en: 'Any page built with `createShow()` becomes a clean output when its address has `?output`: no console, no piano, no overlays, the stage alone on black with the corners this browser saved for that name. `&follow=<channel>` makes it follow the show page\'s clock (`&via=relay` across browsers or machines), `&play` starts the timeline where nobody can press Space (OBS, TouchDesigner).',
        zh: '任何用 `createShow()` 做的頁面，網址加上 `?output` 就變成乾淨的輸出：沒有控台、沒有鋼琴、沒有疊在上面的東西，只有黑底上的舞台，加上這個瀏覽器替那個名字存下的四個角。`&follow=<channel>` 讓它跟著演出頁面的時鐘（跨瀏覽器或跨機器時加 `&via=relay`），`&play` 讓時間軸在沒人能按空白鍵的地方（OBS、TouchDesigner）一載入就播放。',
      },
    ],
    examples: [
      {
        code: `import { outputQuery } from '@openav/output';

document.getElementById('app').innerText = JSON.stringify(outputQuery('?output=left&crop=0,0,0.5,1&aspect=32:9&follow=oav-output&via=relay&play'), null, 1);`,
        caption: { en: 'The left half of a 32:9 stage, following the show page over the relay, playing at once.', zh: '32:9 舞台的左半邊，經過中繼跟著演出頁面，一載入就播放。' },
      },
    ],
    related: ['outputUrl', 'openOutput'],
    keywords: { en: ['clean url', 'output url', 'kiosk', 'obs', 'touchdesigner', 'query'], zh: ['乾淨網址', '輸出網址', 'kiosk', 'OBS', 'TouchDesigner', '查詢參數'] },
  },

  outputUrl: {
    group: 'output',
    summary: {
      en: 'The clean output address of a page, to type into a kiosk browser, OBS\'s Browser Source or TouchDesigner\'s Web Render TOP.',
      zh: '一個頁面的乾淨輸出網址，用來填進 kiosk 瀏覽器、OBS 的瀏覽器來源，或 TouchDesigner 的 Web Render TOP。',
    },
    params: [
      { name: 'base', type: 'String', en: 'The show page\'s address (`location.href`). Its other keys are kept, the output\'s are replaced.', zh: '演出頁面的網址（`location.href`）。其他的查詢參數保留，輸出相關的會被換掉。' },
      { name: 'name', type: 'String', optional: true, default: "'main'", en: 'The output\'s name.', zh: '輸出的名字。' },
      { name: 'crop', type: 'Object | null', optional: true, default: 'null', en: 'The region of the stage, `{ x, y, w, h }`.', zh: '舞台的哪一塊，`{ x, y, w, h }`。' },
      { name: 'aspect', type: 'Number | String | null', optional: true, default: 'null', en: 'The stage\'s shape, `16 / 9` or `\'16:9\'`.', zh: '舞台的形狀，`16 / 9` 或 `\'16:9\'`。' },
      { name: 'fit', type: 'String', optional: true, default: "'contain'", en: '`contain`, `cover` or `stretch`.', zh: '`contain`、`cover` 或 `stretch`。' },
      { name: 'follow', type: 'String | null', optional: true, default: 'null', en: 'The sync channel of the show page to follow.', zh: '要跟隨的演出頁面的同步頻道。' },
      { name: 'via', type: 'true | String | null', optional: true, default: 'null', en: '`true` for this server\'s `/relay`, or a `ws://` address.', zh: '`true` 是這台伺服器的 `/relay`，或一個 `ws://` 位址。' },
      { name: 'play', type: 'Boolean', optional: true, default: 'false', en: 'Start the timeline on load.', zh: '一載入就讓時間軸開始播放。' },
    ],
    returns: { type: 'String', en: 'The address, short: `?output=left&crop=0,0,0.5,1&play`.', zh: '網址，寫成短的樣子：`?output=left&crop=0,0,0.5,1&play`。' },
    description: [
      {
        en: 'What it writes, [`outputQuery()`](#outputQuery) reads back the same. The rig\'s `outputs.url(name)` fills in the crop and shape declared for that output.',
        zh: '它寫出來的，[`outputQuery()`](#outputQuery) 讀回去一模一樣。`outputs.url(name)` 會替你填好那個輸出宣告的裁切和形狀。',
      },
    ],
    examples: [
      {
        code: `import { outputUrl } from '@openav/output';

document.getElementById('app').textContent = outputUrl('http://localhost:8080/examples/29-projector-output/', { name: 'front', follow: 'oav-output', via: true, play: true });`,
        caption: { en: 'It prints http://localhost:8080/examples/29-projector-output/?output=front&follow=oav-output&via=relay&play', zh: '印出 http://localhost:8080/examples/29-projector-output/?output=front&follow=oav-output&via=relay&play' },
      },
    ],
    related: ['outputQuery', 'createOutputs'],
    keywords: { en: ['clean url', 'kiosk', 'obs browser source', 'web render top'], zh: ['乾淨網址', 'kiosk', 'OBS 瀏覽器來源', 'Web Render TOP'] },
  },
};
