// @openav/align reference: projector and LED alignment from one layout file. The test patterns, the vendor chart and
// the real output mapping read the same layout; a manual calibration (corners, mesh, feather, masks, gain) goes on top;
// the Gray-code frames are the pattern generator for camera-in-the-loop alignment (the camera half is not built).
// Read by tools/build-reference.mjs (see AGENTS.md, "Documenting a public name").

const WHY_THREE = 'It needs three.js, which the package never imports (it is passed in): example 31 loads three.js from jsDelivr and runs it.';
const TWO = `const layout = {
  format: 'open-audiovisual/align@1', id: 'two',
  art: { w: 3840, h: 1080 },
  segments: [{ id: 'L', x: 0, y: 0, w: 1920, h: 1080 }, { id: 'R', x: 1920, y: 0, w: 1920, h: 1080 }],
  outputs: [{ id: 'left', x: 0, y: 0, w: 1920, h: 1080 }, { id: 'right', x: 1920, y: 0, w: 1920, h: 1080 }],
  feeds: [{ segment: 'L', output: 'left', x: 0, y: 0 }, { segment: 'R', output: 'right', x: 0, y: 0 }],
};`;
const BAND = `const layout = {
  format: 'open-audiovisual/align@1', id: 'band',
  art: { w: 7680, h: 480 },
  segments: [0, 1, 2, 3].map((i) => ({ id: 'Q' + (i + 1), x: i * 1920, y: 0, w: 1920, h: 480 })),
  outputs: [{ id: 'A', x: 0, y: 0, w: 1920, h: 1080 }, { id: 'B', x: 1920, y: 0, w: 1920, h: 1080 }],
  feeds: [['Q1', 'A', 0], ['Q2', 'A', 480], ['Q3', 'B', 0], ['Q4', 'B', 480]].map(([segment, output, y]) => ({ segment, output, x: 0, y })),
};`;
const ROOM = "const layout = await (await fetch('/packages/align/layouts/room-corner.json')).json();";
const LAYOUT_EN = 'A layout (`open-audiovisual/align@1`) is one JSON object: `art` (the canvas the work draws, the wall unrolled flat), `segments` (rectangles of it, the wall\'s pieces), `outputs` (rectangles of the desktop, one per signal), `feeds` (which segment goes into which output, and where).';
const LAYOUT_ZH = '一份佈局（`open-audiovisual/align@1`）是一個 JSON 物件：`art`（作品畫的畫布，牆攤平之後的樣子）、`segments`（畫布上的矩形，牆的一塊一塊）、`outputs`（桌面上的矩形，一路訊號一個）、`feeds`（哪一塊送進哪一路、貼在哪裡）。';
const MAP_EN = 'A mapping is what [`computeMapping()`](#computeMapping) returns: `tiles` (one per feed, each with `src` on the art canvas and `dst` on the desktop), `outputs`, `segments`, `art`, `desktop`.';
const MAP_ZH = '映射是 [`computeMapping()`](#computeMapping) 回傳的東西：`tiles`（一條 feed 一塊，各有作品畫布上的 `src` 和桌面上的 `dst`）、`outputs`、`segments`、`art`、`desktop`。';
const P_MAPPING = { name: 'mapping', type: 'Object', en: 'What `computeMapping(layout)` returned.', zh: '`computeMapping(layout)` 的回傳值。' };
const P_CTX = { name: 'ctx', type: 'CanvasRenderingContext2D', en: 'Any 2D context: a canvas on the page, an OffscreenCanvas.', zh: '任何 2D context：頁面上的 canvas、OffscreenCanvas 都可以。' };
const P_VIEW = { name: 'view', type: 'Object', optional: true, default: '{ k: 1, x: 0, y: 0 }', en: 'Desktop px → canvas px: scale `k`, then shift `x`, `y`. `k: 0.25` draws a quarter-size preview.', zh: '桌面 px → 畫布 px：先乘 `k`，再平移 `x`、`y`。`k: 0.25` 畫四分之一大小的預覽。' };
const P_ZONE = { name: 'zone', type: 'Object', en: 'A zone: `{ corners, mesh, feather, gamma, gain, masks }` (see [`defaultZone()`](#defaultZone)).', zh: '一區：`{ corners, mesh, feather, gamma, gain, masks }`（見 [`defaultZone()`](#defaultZone)）。' };
const P_TILE = { name: 'tile', type: 'Object', en: 'One of `mapping.tiles`.', zh: '`mapping.tiles` 其中一塊。' };
const P_FRAME = { name: 'frame', type: 'Object', en: 'One frame of [`graySequence()`](#graySequence): `{ kind: \'white\' | \'black\' }` or `{ kind: \'gray\', axis, bit, nbits, inverse }`.', zh: '[`graySequence()`](#graySequence) 的其中一張：`{ kind: \'white\' | \'black\' }` 或 `{ kind: \'gray\', axis, bit, nbits, inverse }`。' };
const P_LANG = { name: 'lang', type: "'en' | 'zh'", optional: true, default: "'en'", en: 'The language of the words drawn.', zh: '畫出來的字用哪種語言。' };
const KW_EN = ['projection mapping', 'alignment', 'projector', 'LED wall'];
const KW_ZH = ['投影對位', '對位', '投影機', 'LED 牆'];

export default {
  // ------------------------------------------------------------------------------------------------ the layout
  ALIGN_FORMAT: {
    group: 'align',
    aliases: ['CONTRACT'],
    summary: { en: 'The format name a layout is written with: `\'open-audiovisual/align@1\'`. `CONTRACT` is the same constant under the name art-align gave it.', zh: '佈局檔的格式名稱：`\'open-audiovisual/align@1\'`。`CONTRACT` 是同一個常數，用的是 art-align 取的名字。' },
    value: { type: 'String', en: '`\'open-audiovisual/align@1\'`.', zh: '字串 `\'open-audiovisual/align@1\'`。' },
    description: [
      { en: 'A layout says it with `"format"`. A file written for art-align, the module this package grew from, says `"contract": "art-align/v1"`: [`validateLayout()`](#align-validateLayout) accepts both keys and both names, so such a file loads unchanged. A mapping always says the new name in its `format`.', zh: '佈局用 `"format"` 寫出格式。給 art-align（這個套件的前身）寫的檔案是 `"contract": "art-align/v1"`：[`validateLayout()`](#align-validateLayout) 兩個鍵、兩個名字都收，所以那種檔案不用改就讀得進來。映射的 `format` 一律寫新的名字。' },
      { en: 'The schema is `packages/align/align.schema.json`. It is open at the top level: a layout may carry keys of its own (a note, a title), which every function ignores.', zh: '結構描述在 `packages/align/align.schema.json`。最上層是開放的：佈局可以帶自己的鍵（附註、標題），每個函式都會略過。' },
    ],
    examples: [{
      code: `import { ALIGN_FORMAT, CONTRACT, identityLayout } from '@openav/align';

document.getElementById('app').textContent = [ALIGN_FORMAT, CONTRACT === ALIGN_FORMAT, identityLayout(1920, 1080).format].join(' | ');`,
      caption: { en: 'Prints open-audiovisual/align@1 | true | open-audiovisual/align@1.', zh: '印出 open-audiovisual/align@1 | true | open-audiovisual/align@1。' },
    }],
    related: ['align-validateLayout', 'CALIBRATION_FORMAT', 'identityLayout'],
    keywords: { en: ['format', 'contract', 'layout file', 'art-align', 'schema'], zh: ['格式', '佈局檔', '契約', '結構描述'] },
  },

  validateLayout: {
    group: 'align',
    summary: { en: 'Checks an align layout and lists every error (the layout is refused) and every warning (accepted, but look); never throws.', zh: '檢查一份對位佈局，列出每個錯誤（不收）和每個提醒（收，但要看一眼），永遠不丟例外。' },
    params: [{ name: 'layout', type: 'Object', en: 'The layout, parsed from its JSON.', zh: '解析過的佈局 JSON。' }],
    returns: { type: 'Object', en: '`{ ok, errors, warnings }`: `ok` is true when `errors` is empty. Each message names the place: `segments[3] (Q4) lies outside the art canvas: …`.', zh: '`{ ok, errors, warnings }`：`errors` 是空的時候 `ok` 為 true。每則訊息都講得出位置：`segments[3] (Q4) lies outside the art canvas: …`。' },
    description: [
      { en: LAYOUT_EN, zh: LAYOUT_ZH },
      { en: 'Errors: pixels that are not whole numbers, a segment outside the art canvas, two outputs that overlap on the desktop, a feed that names no segment or output or lands outside its output, two feeds with one name, a turn other than 0, 90, 180 or 270, a format it does not know. Warnings: a segment that goes into no output, two segments that overlap without a blend band (the overlap is twice as bright), and metres whose pixels per metre across and down differ by more than 2 % (on an LED wall, usually one number copied wrong).', zh: '錯誤：px 不是整數、段超出作品畫布、兩路輸出在桌面上重疊、feed 指不到段或輸出或貼出那一路之外、兩條 feed 同名、旋轉不是 0、90、180、270、不認得的格式。提醒：沒有送進任何一路的段、兩段重疊卻沒有熔接帶（重疊處會兩倍亮），以及公尺換算的橫向與縱向每公尺像素差超過 2%（在 LED 牆上，多半是抄錯一個數字）。' },
      { en: 'Run it on a new layout before anything goes on the wall; `node tools/check-align-layout.mjs <file>` prints the same with the mapping it comes to.', zh: '新的佈局在上牆之前先跑一次。`node tools/check-align-layout.mjs <檔案>` 會印出一樣的內容，再加上算出來的映射。' },
    ],
    notes: [{ en: 'Not the same function as `@openav/tile`\'s [`validateLayout()`](#tile-validateLayout) (a layout.json of screens on a table) or `@openav/surface`\'s [`validateLayout()`](#surface-validateLayout) (a phone control surface): import it under another name when a page uses two (`import { validateLayout as validateAlignLayout } from \'@openav/align\'`).', zh: '跟 `@openav/tile` 的 [`validateLayout()`](#tile-validateLayout)（桌上螢幕的 layout.json）、`@openav/surface` 的 [`validateLayout()`](#surface-validateLayout)（手機控制面板）都不是同一個函式：一個頁面用到兩個時，換個名字匯入（`import { validateLayout as validateAlignLayout } from \'@openav/align\'`）。' }],
    examples: [{
      code: `import { validateLayout } from '@openav/align';
${TWO}
const ok = validateLayout(layout);
layout.outputs[1].x = 1900;                 // the right projector now overlaps the left one
const bad = validateLayout(layout);
document.getElementById('app').textContent = ok.ok + ' | ' + bad.ok + ' | ' + bad.errors[0];`,
      caption: { en: 'Prints true | false | outputs left and right overlap on the desktop.', zh: '印出 true | false | outputs left and right overlap on the desktop。' },
    }],
    related: ['align-normalizeLayout', 'computeMapping', 'LayoutError', 'ALIGN_FORMAT'],
    keywords: { en: ['validate', 'check', 'layout', 'errors', 'warnings', 'pixel pitch', ...KW_EN], zh: ['驗證', '檢查', '佈局', '錯誤', '提醒', '燈距', ...KW_ZH] },
  },

  normalizeLayout: {
    group: 'align',
    summary: { en: 'Checks an align layout and returns a filled-in copy: each feed\'s name and size, each segment\'s cell size, the desktop; throws LayoutError when it breaks the format.', zh: '檢查一份對位佈局，回傳補齊的複本：每條 feed 的名字和大小、每段的格子大小、桌面大小，不合格式時丟 LayoutError。' },
    params: [{ name: 'layout', type: 'Object', en: 'The layout.', zh: '佈局。' }],
    returns: { type: 'Object', en: 'A new object; the input is not touched. It also carries `warnings` from [`validateLayout()`](#align-validateLayout).', zh: '一個新的物件，原物件不動。它也帶著 [`validateLayout()`](#align-validateLayout) 的 `warnings`。' },
    description: [
      { en: 'What it fills: a feed with no `w`/`h` is the segment\'s size (1:1, or turned for a 90° feed); a feed with no `name` is its segment\'s id, or `segment@output` when the segment goes into several outputs; a segment gets `cell`, its cell size ([`cellSizeFor()`](#cellSizeFor) unless `cells.size` says); and `desktop`, when the layout has none, is the outputs\' bounding box. [`computeMapping()`](#computeMapping) calls it first.', zh: '補的東西：沒寫 `w`/`h` 的 feed 等於段的大小（1:1，轉 90° 的 feed 會對調）。沒有 `name` 的 feed 用段的 id，段送進好幾路時用 `段@輸出`。每段多一個 `cell`，也就是格子大小（除非 `cells.size` 有寫，否則用 [`cellSizeFor()`](#cellSizeFor)）。佈局沒寫 `desktop` 時，用所有輸出的外框。[`computeMapping()`](#computeMapping) 會先呼叫它。' },
    ],
    notes: [{ en: '`@openav/surface` has a [`normalizeLayout()`](#surface-normalizeLayout) too, for phone control surfaces: a different function.', zh: '`@openav/surface` 也有一個 [`normalizeLayout()`](#surface-normalizeLayout)，給手機控制面板用，是不同的函式。' }],
    examples: [{
      code: `import { normalizeLayout } from '@openav/align';

const layout = {
  format: 'open-audiovisual/align@1', id: 'stack', art: { w: 1920, h: 1200 },
  segments: [{ id: 'S', x: 0, y: 0, w: 1920, h: 1200 }],
  outputs: [{ id: 'up', x: 0, y: 0, w: 1920, h: 1200 }, { id: 'down', x: 1920, y: 0, w: 1920, h: 1200 }],
  feeds: [{ segment: 'S', output: 'up', x: 0, y: 0 }, { segment: 'S', output: 'down', x: 0, y: 0 }],
};
const N = normalizeLayout(layout);
document.getElementById('app').textContent = N.feeds.map((f) => f.name + ' ' + f.w + 'x' + f.h).join(', ') + ' | desktop ' + N.desktop.w + 'x' + N.desktop.h + ' | cell ' + N.segments[0].cell;`,
      caption: { en: 'Prints S@up 1920x1200, S@down 1920x1200 | desktop 3840x1200 | cell 240: one segment on two projectors gets two names.', zh: '印出 S@up 1920x1200, S@down 1920x1200 | desktop 3840x1200 | cell 240：一段送兩台投影機，得到兩個名字。' },
    }],
    related: ['align-validateLayout', 'computeMapping', 'LayoutError', 'cellSizeFor'],
    keywords: { en: ['normalize', 'defaults', 'fill in', 'layout'], zh: ['正規化', '預設值', '補齊', '佈局'] },
  },

  LayoutError: {
    group: 'align',
    summary: { en: 'The error computeMapping() and normalizeLayout() throw for a layout that breaks the format; its `errors` lists every problem.', zh: 'computeMapping() 和 normalizeLayout() 遇到不合格式的佈局時丟的錯誤，`errors` 列出每一個問題。' },
    params: [
      { name: 'id', type: 'String', en: 'The layout\'s id, for the message.', zh: '佈局的 id，寫進訊息用。' },
      { name: 'errors', type: 'String[]', en: 'The problems, as validateLayout() writes them.', zh: '問題清單，跟 validateLayout() 寫的一樣。' },
    ],
    description: [{ en: 'Its message starts `[align] layout <id> does not follow open-audiovisual/align@1:` and lists each error on its own line, so a file from the venue is fixed in one go. [`scaleArt()`](#scaleArt) throws it too, when a value would stop being a whole pixel.', zh: '訊息開頭是 `[align] layout <id> does not follow open-audiovisual/align@1:`，每個錯誤一行，現場來的檔案一次就能改完。[`scaleArt()`](#scaleArt) 在某個值不再是整數像素時也丟它。' }],
    examples: [{
      code: `import { computeMapping, LayoutError } from '@openav/align';

try { computeMapping({ format: 'open-audiovisual/align@1', id: 'empty' }); }
catch (e) { document.getElementById('app').textContent = (e instanceof LayoutError) + ' | ' + e.errors.length + ' problems | ' + e.errors[0]; }`,
      caption: { en: 'Prints true | 4 problems | art must be { w, h } in whole pixels > 0.', zh: '印出 true | 4 problems | art must be { w, h } in whole pixels > 0。' },
    }],
    related: ['align-validateLayout', 'computeMapping', 'scaleArt'],
    keywords: { en: ['error', 'exception', 'invalid layout'], zh: ['錯誤', '例外', '不合格的佈局'] },
  },

  findLayout: {
    group: 'align',
    summary: { en: 'Finds a layout in a list by its id or one of its aliases, ignoring case and spaces around; null when none has that name.', zh: '在一組佈局裡用 id 或別名找一份，不分大小寫、忽略前後空白，找不到回傳 null。' },
    params: [
      { name: 'layouts', type: 'Object[]', en: 'The layouts to look in.', zh: '要找的那一組佈局。' },
      { name: 'name', type: 'String', en: 'What was asked, for example `?layout=` in the address.', zh: '要找的名字，例如網址裡的 `?layout=`。' },
    ],
    returns: { type: 'Object | null', en: 'The layout object itself (not a copy), or null.', zh: '佈局物件本身（不是複本），或 null。' },
    description: [{ en: 'A layout may list `aliases`, other names it answers to (an old address keeps working after a rename).', zh: '佈局可以列出 `aliases`，也就是它也認的其他名字（改名之後舊網址照樣能用）。' }],
    examples: [{
      code: `import { findLayout, identityLayout } from '@openav/align';

const layouts = [identityLayout(1920, 1080, { id: 'hall' }), { ...identityLayout(3840, 2160, { id: 'stage-4k' }), aliases: ['big'] }];
const name = new URLSearchParams(location.search).get('layout') ?? 'BIG';
document.getElementById('app').textContent = findLayout(layouts, name)?.id + ' | ' + findLayout(layouts, 'nope');`,
      caption: { en: 'Prints stage-4k | null: the alias, in any case, finds the layout.', zh: '印出 stage-4k | null：別名不分大小寫都找得到。' },
    }],
    related: ['identityLayout', 'align-validateLayout'],
    keywords: { en: ['find', 'alias', 'by name', 'address'], zh: ['尋找', '別名', '用名字找', '網址'] },
  },

  identityLayout: {
    group: 'align',
    summary: { en: 'The simplest layout: one segment, one output, 1:1, w × h (a size typed in, or "this window as it is").', zh: '最簡單的佈局：一段、一路、1:1、w × h（打進來的尺寸，或者「就是這個視窗」）。' },
    params: [
      { name: 'w', type: 'Number', en: 'Width, whole pixels.', zh: '寬，整數像素。' },
      { name: 'h', type: 'Number', en: 'Height, whole pixels.', zh: '高，整數像素。' },
      { name: 'id', type: 'String', optional: true, default: "'<w>x<h>'", en: 'Its id.', zh: '它的 id。' },
      { name: 'title', type: 'String', optional: true, default: "'one picture <w>×<h>'", en: 'Its title.', zh: '它的標題。' },
    ],
    returns: { type: 'Object', en: 'A layout in `open-audiovisual/align@1`: segment `ALL`, output `OUT`, one feed.', zh: '一份 `open-audiovisual/align@1` 的佈局：段 `ALL`、輸出 `OUT`、一條 feed。' },
    description: [{ en: 'Useful as the fallback when no layout is given: the test patterns and the align mode then work on a laptop screen as they do on a wall.', zh: '沒給佈局時拿來當預設：校正圖樣和對位模式在筆電螢幕上，就跟在牆上一樣能用。' }],
    examples: [{
      code: `import { identityLayout, computeMapping } from '@openav/align';

const M = computeMapping(identityLayout(innerWidth, innerHeight));
document.getElementById('app').textContent = M.id + ' → ' + JSON.stringify(M.tiles[0].dst);`,
      caption: { en: 'Prints this window\'s size as a layout id and its one tile covering all of it, for example 1280x720 → {"x":0,"y":0,"w":1280,"h":720}.', zh: '印出以這個視窗大小命名的佈局 id，和蓋滿整個視窗的那一塊，例如 1280x720 → {"x":0,"y":0,"w":1280,"h":720}。' },
    }],
    related: ['computeMapping', 'findLayout', 'ALIGN_FORMAT'],
    keywords: { en: ['one screen', 'default layout', 'single output', 'fallback'], zh: ['單一畫面', '預設佈局', '一路輸出', '備用'] },
  },

  scaleArt: {
    group: 'align',
    summary: { en: 'The same layout for a work that draws its art canvas at k times the density: segments, blend bands, masks and ident surfaces scale, the outputs stay.', zh: '給畫布密度是 k 倍的作品用的同一份佈局：段、熔接帶、遮罩、認機面跟著縮放，輸出不動。' },
    params: [
      { name: 'layout', type: 'Object', en: 'The layout as written.', zh: '原本寫好的佈局。' },
      { name: 'k', type: 'Number', en: 'The factor: 0.5 for a work that draws at half the pixels per metre.', zh: '倍數：作品每公尺只畫一半像素時是 0.5。' },
    ],
    returns: { type: 'Object', en: 'A new layout (the same object when k is 1). Each feed\'s place and size on its output is written out, so nothing moves on the wall.', zh: '一份新的佈局（k 是 1 時回傳原物件）。每條 feed 在輸出上的位置和大小會寫死，牆上什麼都不會動。' },
    description: [{ en: 'A layout is written once at one density; a lighter version of the work (a laptop, a rehearsal) draws fewer pixels and is stretched onto the same outputs. Throws [`LayoutError`](#LayoutError) when a value stops being a whole pixel.', zh: '佈局用一種密度寫一次。比較輕的作品版本（筆電、排練）畫比較少的像素，再拉伸到同樣的輸出上。某個值不再是整數像素時丟 [`LayoutError`](#LayoutError)。' }],
    examples: [{
      code: `import { scaleArt, computeMapping } from '@openav/align';
${TWO}
const half = computeMapping(scaleArt(layout, 0.5));
document.getElementById('app').textContent = half.art.w + 'x' + half.art.h + ' | ' + JSON.stringify(half.tiles[1].src) + ' → ' + JSON.stringify(half.tiles[1].dst);`,
      caption: { en: 'Prints 1920x540 | {"x":960,"y":0,"w":960,"h":540} → {"x":1920,"y":0,"w":1920,"h":1080}: half the art, the same place on the right projector.', zh: '印出 1920x540 | {"x":960,"y":0,"w":960,"h":540} → {"x":1920,"y":0,"w":1920,"h":1080}：作品減半，右邊投影機上的位置一樣。' },
    }],
    related: ['computeMapping', 'LayoutError'],
    keywords: { en: ['scale', 'density', 'resolution', 'pixels per metre'], zh: ['縮放', '密度', '解析度', '每公尺像素'] },
  },

  // ------------------------------------------------------------------------------------------------ the mapping
  computeMapping: {
    group: 'align',
    summary: { en: 'Turns an align layout into its mapping: one tile per feed, each with its rectangle on the art canvas and on the desktop, which every output reads.', zh: '把對位佈局變成映射：一條 feed 一塊，各有它在作品畫布和桌面上的矩形，所有輸出都讀這一份。' },
    params: [{ name: 'layout', type: 'Object', en: 'The layout (`open-audiovisual/align@1`, or `art-align/v1`).', zh: '佈局（`open-audiovisual/align@1`，或 `art-align/v1`）。' }],
    returns: { type: 'Object', en: '`{ format, id, title, art, desktop, outputs, segments, tiles, vendor, warnings }`, plus `params` and `ident` when the layout has them. A tile: `{ name, segment, output, src, dst, scale, visible, color, meters, cell, blend }`, plus `rotate`, `label`, `plan`, `masks` when written.', zh: '`{ format, id, title, art, desktop, outputs, segments, tiles, vendor, warnings }`，佈局有寫時多 `params` 和 `ident`。一塊 tile：`{ name, segment, output, src, dst, scale, visible, color, meters, cell, blend }`，有寫時多 `rotate`、`label`、`plan`、`masks`。' },
    description: [
      { en: LAYOUT_EN, zh: LAYOUT_ZH },
      { en: 'This one table is what makes the promise of the package hold: [`drawPattern()`](#drawPattern) draws the test patterns tile by tile from it, [`vendorPlacements()`](#vendorPlacements) places the vendor\'s images from it, and [`blitPlan()`](#blitPlan), [`createBlitter()`](#createBlitter) and [`createWarpRenderer()`](#createWarpRenderer) put the work on the outputs from it. So a pattern that is right on the wall means the work is right on the wall.', zh: '整個套件的保證就靠這一張表：[`drawPattern()`](#drawPattern) 照它一塊一塊畫校正圖樣，[`vendorPlacements()`](#vendorPlacements) 照它擺廠商的圖，[`blitPlan()`](#blitPlan)、[`createBlitter()`](#createBlitter)、[`createWarpRenderer()`](#createWarpRenderer) 照它把作品送上輸出。所以圖樣在牆上對了，作品在牆上就對。' },
      { en: '`src` is in art-canvas pixels, `dst` in desktop pixels (the physical pixels a fullscreen browser covers, origin top-left). `scale` is dst over src (both 1 at 1:1). A stacked segment (one segment into two outputs) has two tiles.', zh: '`src` 是作品畫布的像素，`dst` 是桌面的像素（全螢幕瀏覽器蓋住的實體像素，原點在左上）。`scale` 是 dst 除以 src（1:1 時兩個都是 1）。疊投的段（一段送進兩路）會有兩塊。' },
    ],
    examples: [{
      code: `import { computeMapping } from '@openav/align';
${BAND}
const M = computeMapping(layout);
document.getElementById('app').textContent = M.tiles.map((t) => t.name + ' art ' + t.src.x + ' → ' + t.output + ' (' + t.dst.x + ',' + t.dst.y + ')').join(' · ');`,
      caption: { en: 'Prints Q1 art 0 → A (0,0) · Q2 art 1920 → A (0,480) · Q3 art 3840 → B (1920,0) · Q4 art 5760 → B (1920,480): a long LED band folded into two outputs.', zh: '印出 Q1 art 0 → A (0,0) · Q2 art 1920 → A (0,480) · Q3 art 3840 → B (1920,0) · Q4 art 5760 → B (1920,480)：一條長 LED 帶摺進兩路輸出。' },
    }],
    related: ['align-validateLayout', 'drawPattern', 'blitPlan', 'createWarpRenderer', 'normalizeCalibration'],
    keywords: { en: ['mapping', 'tiles', 'layout', 'outputs', 'segments', 'feeds', 'desktop', ...KW_EN], zh: ['映射', '佈局', '輸出', '分段', '桌面', ...KW_ZH] },
  },

  blitPlan: {
    group: 'align',
    summary: { en: 'The numbers WebGL needs to copy each tile from the art render target to the canvas: viewport, scissor and UV offset and scale, already divided by the pixel ratio.', zh: 'WebGL 把每一塊從作品 render target 貼到畫布所需的數字：viewport、scissor、UV 位移與縮放，已經除過 pixel ratio。' },
    params: [
      P_MAPPING,
      { name: 'pixelRatio', type: 'Number', optional: true, default: '1', en: 'The renderer\'s pixel ratio (three\'s `setViewport` takes CSS pixels).', zh: 'renderer 的 pixel ratio（three 的 `setViewport` 吃 CSS 像素）。' },
      { name: 'buffer', type: 'Object', optional: true, default: 'mapping.desktop', en: 'The canvas\'s drawing buffer, physical px `{ w, h }`.', zh: '畫布的繪圖緩衝區，實體像素 `{ w, h }`。' },
    ],
    returns: { type: 'Object', en: '`{ full, mismatch, tiles: [{ name, viewport, scissor, uvOffset, uvScale, rotate? }] }`. `mismatch` is true when the buffer is not the desktop\'s size.', zh: '`{ full, mismatch, tiles: [{ name, viewport, scissor, uvOffset, uvScale, rotate? }] }`。緩衝區跟桌面大小不同時 `mismatch` 為 true。' },
    description: [
      { en: 'GL\'s origin is bottom-left, so a tile\'s viewport is `(dst.x, H − dst.y − dst.h, dst.w, dst.h)`; then everything is divided by the pixel ratio. Forgetting that division draws every tile twice as big over its neighbours: it is done here, once. A turned tile carries `rotate`: a viewport cannot turn it ([`createWarpRenderer()`](#createWarpRenderer) can).', zh: 'GL 的原點在左下，所以一塊的 viewport 是 `(dst.x, H − dst.y − dst.h, dst.w, dst.h)`，再全部除以 pixel ratio。忘了除，每一塊都會畫成兩倍大蓋到隔壁：這件事在這裡做一次就好。轉過的塊帶 `rotate`：viewport 轉不了（[`createWarpRenderer()`](#createWarpRenderer) 轉得了）。' },
    ],
    examples: [{
      code: `import { computeMapping, blitPlan } from '@openav/align';
${TWO}
const plan = blitPlan(computeMapping(layout), { pixelRatio: 2 });
document.getElementById('app').textContent = JSON.stringify(plan.tiles[1].viewport) + ' uv ' + JSON.stringify(plan.tiles[1].uvOffset);`,
      caption: { en: 'Prints {"x":960,"y":0,"w":960,"h":540} uv {"x":0.5,"y":0}: the right projector\'s viewport in CSS pixels at a pixel ratio of 2.', zh: '印出 {"x":960,"y":0,"w":960,"h":540} uv {"x":0.5,"y":0}：pixel ratio 2 時右邊投影機的 viewport，單位是 CSS 像素。' },
    }],
    related: ['createBlitter', 'computeMapping', 'createWarpRenderer'],
    keywords: { en: ['blit', 'viewport', 'scissor', 'webgl', 'pixel ratio', 'render target'], zh: ['貼圖', 'viewport', 'scissor', 'WebGL', '像素比'] },
  },

  composePlan: {
    group: 'align',
    summary: { en: 'How to put a desktop frame back together as the art canvas: one set of drawImage arguments per tile.', zh: '把桌面那一幀拼回作品畫布的方法：一塊一組 drawImage 參數。' },
    params: [P_MAPPING],
    returns: { type: 'Array', en: '`[[sx, sy, sw, sh, dx, dy, dw, dh], …]`: from the desktop (`dst`) to the art canvas (`src`).', zh: '`[[sx, sy, sw, sh, dx, dy, dw, dh], …]`：從桌面（`dst`）到作品畫布（`src`）。' },
    description: [{ en: 'For a thumbnail or a recording of what the work looked like, from a capture of the outputs. A stacked segment is drawn twice with the same content.', zh: '從輸出的擷取畫面做縮圖，或錄下作品的樣子時用。疊投的段會用同樣的內容畫兩次。' }],
    examples: [{
      code: `import { computeMapping, composePlan } from '@openav/align';
${BAND}
document.getElementById('app').textContent = JSON.stringify(composePlan(computeMapping(layout))[1]);`,
      caption: { en: 'Prints [0,480,1920,480,1920,0,1920,480]: the second quarter is read from output A\'s lower half.', zh: '印出 [0,480,1920,480,1920,0,1920,480]：第二段從輸出 A 的下半部讀回來。' },
    }],
    related: ['composeArtCanvas', 'computeMapping'],
    keywords: { en: ['compose', 'thumbnail', 'unfold', 'drawImage'], zh: ['拼回', '縮圖', '攤開'] },
  },

  composeArtCanvas: {
    group: 'align',
    summary: { en: 'Puts a desktop frame (a canvas, an image, a video) back together as a new art-canvas canvas, using composePlan.', zh: '用 composePlan 把桌面那一幀（canvas、圖片、影片）拼回成一張新的作品畫布 canvas。' },
    params: [
      { name: 'source', type: 'CanvasImageSource', en: 'The desktop frame.', zh: '桌面那一幀。' },
      P_MAPPING,
      { name: 'doc', type: 'Document', optional: true, default: 'document', en: 'Where the new canvas is made (a test passes its own).', zh: '在哪裡建立新的 canvas（測試可以傳自己的）。' },
    ],
    returns: { type: 'HTMLCanvasElement', en: 'A canvas of `art.w × art.h`, black where no tile reads.', zh: '一張 `art.w × art.h` 的 canvas，沒有塊讀到的地方是黑的。' },
    description: [{ en: 'In the browser only (it makes a canvas).', zh: '只能在瀏覽器裡用（它要建立 canvas）。' }],
    examples: [{
      code: `import { computeMapping, composeArtCanvas, drawPattern } from '@openav/align';
${BAND}
const M = computeMapping(layout);
const desk = document.createElement('canvas'); desk.width = 3840; desk.height = 1080;
drawPattern(desk.getContext('2d'), M, 'tiles');                 // what the two outputs show
const art = composeArtCanvas(desk, M);
const c = document.getElementById('c');
c.getContext('2d').drawImage(art, 0, 0, c.width, c.width * art.height / art.width);`,
      caption: { en: 'The two outputs\' cells pattern, put back together: one long band of four coloured quarters across the top of the canvas.', zh: '兩路輸出的逐格圖樣拼回去：畫布上方一條長帶，四段不同顏色。' },
    }],
    related: ['composePlan', 'drawPattern'],
    keywords: { en: ['compose', 'thumbnail', 'capture'], zh: ['拼回', '縮圖', '擷取'] },
  },

  artView: {
    group: 'align',
    summary: { en: 'The art canvas as it is, uncut: a mapping with one tile per segment and dst equal to src, for a preview of what the wall will look like.', zh: '作品畫布原樣、不切段：每段一塊、dst 等於 src 的映射，用來預覽牆上會長什麼樣。' },
    params: [P_MAPPING],
    returns: { type: 'Object', en: 'A mapping with `view: \'art\'`, its desktop the art canvas, its one output `ART`; a stacked segment appears once.', zh: '一份 `view: \'art\'` 的映射，桌面就是作品畫布，唯一的輸出叫 `ART`，疊投的段只出現一次。' },
    description: [{ en: 'Every pattern drawn through it runs on as one continuous band: the right picture of the wall, before it is cut into outputs. [`drawSource()`](#drawSource) draws the patterns this way, so they can go through the same warp as the work.', zh: '透過它畫的圖樣都是連續的一整條：切成輸出之前，牆的樣子。[`drawSource()`](#drawSource) 就是這樣畫圖樣的，所以圖樣能跟作品走同一條 warp。' }],
    examples: [{
      code: `import { computeMapping, artView, drawPattern } from '@openav/align';
${BAND}
const V = artView(computeMapping(layout));
const c = document.getElementById('c'), k = c.width / V.desktop.w;
drawPattern(c.getContext('2d'), V, 'grid', { view: { k, x: 0, y: 0 } });
document.getElementById('app').textContent = V.tiles.map((t) => t.name).join(' ') + ' on ' + V.desktop.w + 'x' + V.desktop.h;`,
      caption: { en: 'Prints Q1 Q2 Q3 Q4 on 7680x480 and draws the grid along the whole band, its coordinates running from 0 to 7680.', zh: '印出 Q1 Q2 Q3 Q4 on 7680x480，並沿著整條帶畫出格線，座標從 0 到 7680。' },
    }],
    related: ['drawSource', 'drawPattern', 'computeMapping'],
    keywords: { en: ['preview', 'art view', 'unrolled', 'continuous'], zh: ['預覽', '作品畫布視角', '攤平', '連續'] },
  },

  desktopToArt: {
    group: 'align',
    summary: { en: 'A desktop point → the art-canvas point under it, its tile, segment, output and cell; null over no tile.', zh: '桌面上一點 → 它底下的作品畫布座標，以及塊、段、輸出和格名，不在任何一塊上時回傳 null。' },
    params: [P_MAPPING, { name: 'x', type: 'Number', en: 'Desktop px.', zh: '桌面 px。' }, { name: 'y', type: 'Number', en: 'Desktop px.', zh: '桌面 px。' }],
    returns: { type: 'Object | null', en: '`{ tile, segment, output, x, y, cell }`, in the tile drawn last there. A turned feed is turned back.', zh: '`{ tile, segment, output, x, y, cell }`，取那裡最後畫的那一塊。轉過的 feed 會轉回來。' },
    description: [{ en: 'For "where is the point I am pointing at": a click on a preview, a cell name to say over the radio.', zh: '回答「我指的這裡是哪裡」：在預覽上點一下，或者在對講機裡報一個格名。' }],
    examples: [{
      code: `import { computeMapping, desktopToArt } from '@openav/align';
${BAND}
document.getElementById('app').textContent = JSON.stringify(desktopToArt(computeMapping(layout), 1930, 500));`,
      caption: { en: 'Prints {"tile":"Q4","segment":"Q4","output":"B","x":5770,"y":20,"cell":"A1"}: a point near the top-left of output B\'s lower half.', zh: '印出 {"tile":"Q4","segment":"Q4","output":"B","x":5770,"y":20,"cell":"A1"}：輸出 B 下半部左上角附近的一點。' },
    }],
    related: ['artToDesktop', 'cellIdAt'],
    keywords: { en: ['hit test', 'where', 'desktop to art', 'click'], zh: ['點擊', '在哪裡', '桌面轉作品座標'] },
  },

  artToDesktop: {
    group: 'align',
    summary: { en: 'An art-canvas point → every desktop point it lands on (a stacked segment lands on several outputs).', zh: '作品畫布上一點 → 它落在桌面上的所有位置（疊投的段會落在好幾路輸出上）。' },
    params: [P_MAPPING, { name: 'ax', type: 'Number', en: 'Art px.', zh: '作品 px。' }, { name: 'ay', type: 'Number', en: 'Art px.', zh: '作品 px。' }],
    returns: { type: 'Array', en: '`[{ tile, output, x, y }, …]`, empty when the point is in no segment.', zh: '`[{ tile, output, x, y }, …]`，這一點不在任何段裡時是空陣列。' },
    description: [{ en: 'Scaled and turned feeds included: it is the inverse of [`desktopToArt()`](#desktopToArt).', zh: '縮放和轉過的 feed 都算進去：它是 [`desktopToArt()`](#desktopToArt) 的反向。' }],
    examples: [{
      code: `import { computeMapping, artToDesktop } from '@openav/align';

const layout = {
  format: 'open-audiovisual/align@1', id: 'stack', art: { w: 1920, h: 1200 },
  segments: [{ id: 'S', x: 0, y: 0, w: 1920, h: 1200 }],
  outputs: [{ id: 'up', x: 0, y: 0, w: 1920, h: 1200 }, { id: 'down', x: 1920, y: 0, w: 1920, h: 1200 }],
  feeds: [{ name: 'S1', segment: 'S', output: 'up', x: 0, y: 0 }, { name: 'S2', segment: 'S', output: 'down', x: 0, y: 0 }],
};
document.getElementById('app').textContent = JSON.stringify(artToDesktop(computeMapping(layout), 100, 50));`,
      caption: { en: 'Prints two points, one per projector: [{"tile":"S1","output":"up","x":100,"y":50},{"tile":"S2","output":"down","x":2020,"y":50}].', zh: '印出兩個點，一台投影機一個：[{"tile":"S1","output":"up","x":100,"y":50},{"tile":"S2","output":"down","x":2020,"y":50}]。' },
    }],
    related: ['desktopToArt', 'analyzeOverlaps'],
    keywords: { en: ['art to desktop', 'where does it land', 'stack'], zh: ['作品轉桌面座標', '落在哪裡', '疊投'] },
  },

  cellIdAt: {
    group: 'align',
    summary: { en: 'The cell an art-canvas point falls in, with its segment, as \'Q4:B4\'; null outside every segment.', zh: '作品畫布上一點落在哪一格，連同段名，例如 \'Q4:B4\'，不在任何段裡時回傳 null。' },
    params: [P_MAPPING, { name: 'ax', type: 'Number', en: 'Art px.', zh: '作品 px。' }, { name: 'ay', type: 'Number', en: 'Art px.', zh: '作品 px。' }],
    returns: { type: 'String | null', en: '`<segment>:<cell>`. The segment always comes first: a segment may itself be called A1.', zh: '`<段>:<格>`。段名一定在前面：段本身也可能叫 A1。' },
    description: [{ en: 'Cells are named as on a vendor\'s chart: rows A, B, C … top to bottom, columns 1, 2, 3 … left to right, starting at each segment\'s top-left. The same name is what [`highlightCell()`](#highlightCell) outlines.', zh: '格名跟廠商對位圖一樣：列 A、B、C⋯ 由上往下，欄 1、2、3⋯ 由左往右，每段從自己的左上角算起。[`highlightCell()`](#highlightCell) 框的也是這個名字。' }],
    examples: [{
      code: `import { computeMapping, cellIdAt } from '@openav/align';
${BAND}
document.getElementById('app').textContent = cellIdAt(computeMapping(layout), 5760 + 3 * 240 + 1, 241);`,
      caption: { en: 'Prints Q4:B4: second row, fourth column of the last quarter (240 px cells).', zh: '印出 Q4:B4：最後一段的第二列、第四欄（240 px 的格子）。' },
    }],
    related: ['cellAt', 'highlightCell', 'desktopToArt'],
    keywords: { en: ['cell', 'cell name', 'grid reference', 'A1'], zh: ['格名', '格子', '座標格', 'A1'] },
  },

  analyzeOverlaps: {
    group: 'align',
    summary: { en: 'Where light adds up: stacks (one segment into several outputs) and blend bands (two segments that share part of the canvas).', zh: '光在哪裡疊加：疊投（一段送進好幾路）和熔接帶（兩段共用畫布的一部分）。' },
    params: [P_MAPPING],
    returns: { type: 'Object', en: '`{ stacks: [{ segment, tiles }], bands: [{ a, b, rect }] }`, rect in art px.', zh: '`{ stacks: [{ segment, tiles }], bands: [{ a, b, rect }] }`，rect 是作品 px。' },
    description: [{ en: 'A stack aligned is evenly brighter; misaligned it shows double edges (the cells pattern colours the two tiles differently so it shows). A band needs a blend on both sides, or it is twice as bright: [`blendWeight()`](#blendWeight).', zh: '疊投對準了是均勻加亮，沒對準會看到雙邊（逐格圖樣把兩塊塗成不同顏色，一看就知道）。熔接帶兩邊都要有熔接，不然會兩倍亮：見 [`blendWeight()`](#blendWeight)。' }],
    examples: [{
      code: `import { computeMapping, analyzeOverlaps } from '@openav/align';

const layout = await (await fetch('/packages/align/layouts/example-edge-blend.json')).json();
document.getElementById('app').textContent = JSON.stringify(analyzeOverlaps(computeMapping(layout)));`,
      caption: { en: 'Prints {"stacks":[],"bands":[{"a":"L","b":"R","rect":{"x":1728,"y":0,"w":192,"h":1080}}]}: two projectors overlapping by 192 px.', zh: '印出 {"stacks":[],"bands":[{"a":"L","b":"R","rect":{"x":1728,"y":0,"w":192,"h":1080}}]}：兩台投影機重疊 192 px。' },
    }],
    related: ['blendWeight', 'artToDesktop', 'featherAt'],
    keywords: { en: ['overlap', 'stack', 'edge blend', 'blend band', 'double projection'], zh: ['重疊', '疊投', '邊緣融接', '熔接帶'] },
  },

  blendWeight: {
    group: 'align',
    summary: { en: 'A tile\'s blend weight at an art-canvas point, 0 to 1 in linear light: two segments with the same band width add up to 1 everywhere in their overlap.', zh: '一塊在作品畫布某點的熔接權重，0 到 1 的線性光：兩段帶寬相同時，重疊處兩邊加起來處處為 1。' },
    params: [P_TILE, { name: 'ax', type: 'Number', en: 'Art px.', zh: '作品 px。' }, { name: 'ay', type: 'Number', en: 'Art px.', zh: '作品 px。' }],
    returns: { type: 'Number', en: '0 outside the tile, 1 inside away from its bands, a ramp across each band.', zh: '塊外是 0，塊內離帶子遠的地方是 1，帶子裡是一段斜坡。' },
    description: [
      { en: 'The bands come from the segment\'s `blend: { l, r, t, b, curve, gamma }` (art px; curve `cosine` by default, `linear` or `smoothstep`). The weight is light, not a pixel value: a projector is sent `weight ** (1 / gamma)` (gamma 2.2 by default).', zh: '帶子來自段的 `blend: { l, r, t, b, curve, gamma }`（作品 px，曲線預設 `cosine`，也可以是 `linear` 或 `smoothstep`）。權重是光量，不是像素值：送進投影機的是 `weight ** (1 / gamma)`（gamma 預設 2.2）。' },
      { en: 'This is the layout\'s blend, worked out from numbers. The calibration\'s feather ([`featherAt()`](#featherAt)) is the one set by eye in the venue. A brightness field measured by a camera is on the roadmap, not here.', zh: '這是佈局寫的熔接，從數字算出來。校正檔的羽化（[`featherAt()`](#featherAt)）是現場用眼睛調的那一種。用相機量出來的亮度場在路線圖上，這裡沒有。' },
    ],
    examples: [{
      code: `import { computeMapping, blendWeight } from '@openav/align';

const layout = await (await fetch('/packages/align/layouts/example-edge-blend.json')).json();
const [L, R] = computeMapping(layout).tiles;
const at = (x) => (blendWeight(L, x, 500) + blendWeight(R, x, 500)).toFixed(3);
document.getElementById('app').textContent = [1728, 1780, 1824, 1900].map(at).join(' ') + ' | middle of L: ' + blendWeight(L, 1824, 500).toFixed(3);`,
      caption: { en: 'Prints 1.000 1.000 1.000 1.000 | middle of L: 0.500: across the band the two weights always add up to 1.', zh: '印出 1.000 1.000 1.000 1.000 | middle of L: 0.500：整條熔接帶上，兩邊權重加起來都是 1。' },
    }],
    related: ['analyzeOverlaps', 'featherAt', 'computeMapping'],
    keywords: { en: ['blend', 'edge blending', 'weight', 'gamma', 'linear light', 'soft edge'], zh: ['熔接', '邊緣融接', '權重', 'gamma', '線性光'] },
  },

  vendorPlacements: {
    group: 'align',
    summary: { en: 'Where the vendor\'s alignment images go: any number, each filling an output or a rectangle of the desktop, with percentages ready for CSS.', zh: '廠商對位圖要貼在哪裡：張數不限，每張貼滿一路輸出或桌面上的一塊矩形，附上可以直接當 CSS 用的百分比。' },
    params: [
      P_MAPPING,
      { name: 'base', type: 'String', optional: true, default: "''", en: 'A prefix for each file\'s address.', zh: '每個檔案網址的前綴。' },
      { name: 'vendor', type: 'Object[]', optional: true, default: 'mapping.vendor', en: 'The images, `[{ file, output }]` or `[{ file, rect }]` (the layout\'s `vendor` by default).', zh: '圖檔清單，`[{ file, output }]` 或 `[{ file, rect }]`（預設是佈局的 `vendor`）。' },
    ],
    returns: { type: 'Array', en: '`[{ file, url, output, rect, pct: { left, top, width, height } }]`: pct is the share of the desktop, in %.', zh: '`[{ file, url, output, rect, pct: { left, top, width, height } }]`：pct 是佔桌面的百分比。' },
    description: [{ en: 'One of the three things a layout drives: the vendor\'s own chart, laid over the outputs exactly where the layout says they are. If the vendor\'s chart and the cells pattern disagree, the layout is wrong, not the wall. The images belong to a project and stay out of a public repository.', zh: '佈局驅動的三件事之一：廠商自己的對位圖，照佈局說的位置疊在輸出上。廠商的圖和逐格圖樣對不上時，錯的是佈局，不是牆。這些圖屬於案子本身，不放進公開的 repository。' }],
    examples: [{
      code: `import { computeMapping, vendorPlacements } from '@openav/align';
${TWO}
layout.vendor = [{ file: 'left.png', output: 'left' }, { file: 'right.png', output: 'right' }];
const p = vendorPlacements(computeMapping(layout), { base: '/charts/' });
document.getElementById('app').textContent = p.map((v) => v.url + ' left ' + v.pct.left + '% width ' + v.pct.width + '%').join(' · ');`,
      caption: { en: 'Prints /charts/left.png left 0% width 50% · /charts/right.png left 50% width 50%.', zh: '印出 /charts/left.png left 0% width 50% · /charts/right.png left 50% width 50%。' },
    }],
    related: ['drawPattern', 'drawChart', 'computeMapping'],
    keywords: { en: ['vendor', 'alignment chart', 'overlay', 'image'], zh: ['廠商圖', '對位圖', '疊圖'] },
  },

  // ------------------------------------------------------------------------------------------------ cells
  rowLabel: {
    group: 'align',
    summary: { en: 'The letter of a cell row: 0 → A, 25 → Z, 26 → AA.', zh: '格子列的字母：0 → A、25 → Z、26 → AA。' },
    params: [{ name: 'i', type: 'Number', en: 'The row, from 0.', zh: '列號，從 0 起算。' }],
    returns: { type: 'String', en: 'One or more capital letters.', zh: '一個或多個大寫字母。' },
    description: [{ en: 'Rows are letters and columns numbers, so C8 reads at once on a ladder: row C, column 8.', zh: '列用字母、欄用數字，所以爬在梯子上也能一眼讀出 C8：第 C 列、第 8 欄。' }],
    examples: [{
      code: `import { rowLabel } from '@openav/align';

document.getElementById('app').textContent = [0, 4, 25, 26, 701].map(rowLabel).join(' ');`,
      caption: { en: 'Prints A E Z AA ZZ.', zh: '印出 A E Z AA ZZ。' },
    }],
    related: ['cellAt', 'cellRect', 'eachCell'],
    keywords: { en: ['row', 'letter', 'cell name'], zh: ['列', '字母', '格名'] },
  },

  cellSizeFor: {
    group: 'align',
    summary: { en: 'The default cell size for a segment: of the sizes that divide both its sides, the one nearest 220 px; five rows when none does.', zh: '一段的預設格子大小：能同時整除寬和高的候選裡最接近 220 px 的那個，都整除不了就分五列。' },
    params: [{ name: 'w', type: 'Number', en: 'Segment width, px.', zh: '段寬，px。' }, { name: 'h', type: 'Number', en: 'Segment height, px.', zh: '段高，px。' }],
    returns: { type: 'Number', en: 'Pixels: one of 240, 200, 192, 160, 150, 120, 100, 96, 80, 60, 50, 40, or round(h / 5).', zh: '像素：240、200、192、160、150、120、100、96、80、60、50、40 其中之一，或 round(h / 5)。' },
    description: [{ en: 'A layout can set its own with `cells: { size }`, for the whole layout or one segment.', zh: '佈局可以用 `cells: { size }` 自己指定，整份或單一段都行。' }],
    examples: [{
      code: `import { cellSizeFor } from '@openav/align';

document.getElementById('app').textContent = [[1920, 1200], [1920, 480], [1600, 900], [1000, 333]].map(([w, h]) => w + 'x' + h + ' → ' + cellSizeFor(w, h)).join(', ');`,
      caption: { en: 'Prints 1920x1200 → 240, 1920x480 → 240, 1600x900 → 100, 1000x333 → 67.', zh: '印出 1920x1200 → 240, 1920x480 → 240, 1600x900 → 100, 1000x333 → 67。' },
    }],
    related: ['cellAt', 'eachCell'],
    keywords: { en: ['cell size', 'grid size'], zh: ['格子大小'] },
  },

  cellAt: {
    group: 'align',
    summary: { en: 'The name of the cell of a segment that an art-canvas point falls in, like \'C8\'; null outside the segment.', zh: '作品畫布上一點落在某段的哪一格，例如 \'C8\'，不在段裡時回傳 null。' },
    params: [
      { name: 'seg', type: 'Object', en: 'A segment `{ x, y, w, h }` (art px).', zh: '一段 `{ x, y, w, h }`（作品 px）。' },
      { name: 'size', type: 'Number', en: 'Cell size, px.', zh: '格子大小，px。' },
      { name: 'ax', type: 'Number', en: 'Art px.', zh: '作品 px。' },
      { name: 'ay', type: 'Number', en: 'Art px.', zh: '作品 px。' },
    ],
    returns: { type: 'String | null', en: 'Row letters and column number.', zh: '列字母加欄號。' },
    examples: [{
      code: `import { cellAt } from '@openav/align';

const seg = { x: 1920, y: 0, w: 1920, h: 480 };
document.getElementById('app').textContent = cellAt(seg, 240, 1920 + 5, 5) + ' ' + cellAt(seg, 240, 3839, 479) + ' ' + cellAt(seg, 240, 10, 10);`,
      caption: { en: 'Prints A1 B8 null.', zh: '印出 A1 B8 null。' },
    }],
    description: [{ en: 'A segment that is not a whole number of cells ends with part cells, named like the others.', zh: '段不是格子的整數倍時，最後一欄或一列是殘格，照樣命名。' }],
    related: ['cellRect', 'cellIdAt', 'rowLabel'],
    keywords: { en: ['cell', 'which cell'], zh: ['格名', '哪一格'] },
  },

  cellRect: {
    group: 'align',
    summary: { en: 'A cell\'s rectangle on the art canvas, cut to its segment; null for a name that is not a cell of it.', zh: '一格在作品畫布上的矩形，裁到段內為止，不是這段的格名時回傳 null。' },
    params: [
      { name: 'seg', type: 'Object', en: 'A segment `{ x, y, w, h }`.', zh: '一段 `{ x, y, w, h }`。' },
      { name: 'size', type: 'Number', en: 'Cell size, px.', zh: '格子大小，px。' },
      { name: 'name', type: 'String', en: 'A cell name, any case (`c8`).', zh: '格名，大小寫都行（`c8`）。' },
    ],
    returns: { type: 'Object | null', en: '`{ x, y, w, h }`, art px.', zh: '`{ x, y, w, h }`，作品 px。' },
    description: [{ en: 'The inverse of [`cellAt()`](#cellAt): from a name said in the venue to where it is.', zh: '[`cellAt()`](#cellAt) 的反向：從現場報的格名找出它在哪裡。' }],
    examples: [{
      code: `import { cellRect } from '@openav/align';

const seg = { x: 1920, y: 0, w: 1920, h: 480 };
document.getElementById('app').textContent = JSON.stringify(cellRect(seg, 240, 'b8')) + ' ' + cellRect(seg, 240, 'C1');`,
      caption: { en: 'Prints {"x":3600,"y":240,"w":240,"h":240} null: there is no third row.', zh: '印出 {"x":3600,"y":240,"w":240,"h":240} null：沒有第三列。' },
    }],
    related: ['cellAt', 'highlightCell'],
    keywords: { en: ['cell', 'rectangle', 'where is'], zh: ['格子', '矩形', '在哪裡'] },
  },

  eachCell: {
    group: 'align',
    summary: { en: 'Every cell of a segment, top-left to bottom-right, row by row, as { row, col, name, x, y, w, h }: a generator.', zh: '一段的每一格，從左上到右下、一列一列，產出 { row, col, name, x, y, w, h }：一個 generator。' },
    params: [{ name: 'seg', type: 'Object', en: 'A segment `{ x, y, w, h }`.', zh: '一段 `{ x, y, w, h }`。' }, { name: 'size', type: 'Number', en: 'Cell size, px.', zh: '格子大小，px。' }],
    returns: { type: 'Generator', en: 'One object per cell; part cells are cut to the segment.', zh: '一格一個物件，殘格會裁到段內。' },
    description: [{ en: 'What the cells pattern draws from: use it for a pattern of your own.', zh: '逐格圖樣就是用它畫的，自己做圖樣時也可以用。' }],
    examples: [{
      code: `import { eachCell } from '@openav/align';

const cells = [...eachCell({ x: 0, y: 0, w: 500, h: 200 }, 200)];
document.getElementById('app').textContent = cells.map((c) => c.name + ':' + c.w).join(' ');`,
      caption: { en: 'Prints A1:200 A2:200 A3:100: the third column is a part cell.', zh: '印出 A1:200 A2:200 A3:100：第三欄是殘格。' },
    }],
    related: ['cellAt', 'cellSizeFor', 'drawPattern'],
    keywords: { en: ['cells', 'iterate', 'grid'], zh: ['逐格', '列舉', '格子'] },
  },

  // ------------------------------------------------------------------------------------------------ patterns
  ALIGN_PATTERNS: {
    group: 'align',
    summary: { en: 'The test patterns by name: tiles (cells), grid, edges, crosshair, bars, and vendor (the vendor\'s own images), in that order.', zh: '校正圖樣的名字：tiles（逐格）、grid、edges、crosshair、bars，以及 vendor（廠商自己的圖），照這個順序。' },
    value: { type: 'String[]', en: '`[\'tiles\', \'grid\', \'edges\', \'crosshair\', \'bars\', \'vendor\']`; vendor is last on purpose, a page cycling with the arrow keys can treat it apart.', zh: '`[\'tiles\', \'grid\', \'edges\', \'crosshair\', \'bars\', \'vendor\']`。vendor 刻意放最後，用方向鍵輪播的頁面可以另外處理它。' },
    description: [
      { en: 'tiles: a two-tone checkerboard per segment with cell names, its name, size and metres, diagonals, a centre cross and circle (the look of a vendor\'s chart). grid: a line every 100 art px and every 500 with the absolute art coordinate. edges: frames, corners, the middle of each side. crosshair: a cross, thirds, three circles (an ellipse means the proportions are wrong). bars: colour bars ([`BAR_VARIANTS`](#BAR_VARIANTS)).', zh: 'tiles：每段一組深淺棋盤，有格名、段名、尺寸和公尺、對角線、中心十字和圓（廠商對位圖的樣子）。grid：每 100 作品 px 一條線，每 500 一條粗線並寫上作品的絕對座標。edges：外框、四角、每邊的中點。crosshair：十字、三分線、三個圓（變成橢圓就是比例錯了）。bars：色條（[`BAR_VARIANTS`](#BAR_VARIANTS)）。' },
      { en: 'The list an align command accepts ([`normalizeAlignArgs()`](#normalizeAlignArgs)); a work without vendor images passes a narrower list.', zh: '對位指令接受的清單（[`normalizeAlignArgs()`](#normalizeAlignArgs)）。沒有廠商圖的作品可以給一份比較短的清單。' },
    ],
    examples: [{
      code: `import { ALIGN_PATTERNS } from '@openav/align';

document.getElementById('app').textContent = ALIGN_PATTERNS.join(', ');`,
      caption: { en: 'Prints tiles, grid, edges, crosshair, bars, vendor.', zh: '印出 tiles, grid, edges, crosshair, bars, vendor。' },
    }],
    related: ['drawPattern', 'BAR_VARIANTS', 'normalizeAlignArgs', 'PATTERN_SOURCES'],
    keywords: { en: ['test pattern', 'patterns', 'cells', 'grid', 'crosshair', 'color bars'], zh: ['校正圖樣', '測試圖', '格線', '十字', '色條'] },
  },

  BAR_VARIANTS: {
    group: 'align',
    summary: { en: 'The three kinds of colour bars: smpte, steps and ramp.', zh: '三種色條：smpte、steps、ramp。' },
    value: { type: 'String[]', en: '`[\'smpte\', \'steps\', \'ramp\']`.', zh: '三個字串 `[\'smpte\', \'steps\', \'ramp\']`。' },
    description: [
      { en: 'smpte: SMPTE-style bars in full-range RGB, with near-black steps of 0, 2 and 4 %: see 4 % and not 2 % and black is right. steps: grey in tens, then 1 % steps near black and near white (crushed blacks, clipped whites). ramp: one gradient across the whole art canvas, so it runs on across segments: two segments of different brightness or colour show a step on the wall.', zh: 'smpte：全幅 RGB 的 SMPTE 類色條，近黑三格是 0、2、4%：看得到 4%、分不出 2%，黑位就對了。steps：每 10% 一階的灰，再加近黑和近白每格 1%（看黑有沒有被吃掉、白有沒有被削掉）。ramp：跨整張作品畫布的一條漸層，所以跨段是連續的：兩段亮度或色偏不同，牆上會看到一個斷層。' },
    ],
    examples: [{
      code: `import { computeMapping, drawPattern, identityLayout, BAR_VARIANTS } from '@openav/align';

const c = document.getElementById('c');
const M = computeMapping(identityLayout(c.width, c.height));
let i = 0;
setInterval(() => drawPattern(c.getContext('2d'), M, 'bars', { variant: BAR_VARIANTS[i++ % 3] }), 1000);
drawPattern(c.getContext('2d'), M, 'bars', { variant: 'smpte' });`,
      caption: { en: 'The canvas shows SMPTE bars, then grey steps, then the ramp, one a second, round and round.', zh: '畫布輪流顯示 SMPTE 色條、灰階階梯、連續漸層，每秒換一種。' },
    }],
    related: ['ALIGN_PATTERNS', 'drawPattern'],
    keywords: { en: ['color bars', 'SMPTE', 'grey steps', 'ramp', 'black level', 'PLUGE'], zh: ['色條', 'SMPTE', '灰階', '漸層', '黑位'] },
  },

  drawPattern: {
    group: 'align',
    summary: { en: 'Draws one test pattern over a mapping, tile by tile: clipped to each tile on the desktop and drawn in art pixels, the way the work itself goes out.', zh: '在映射上畫一種校正圖樣，一塊一塊畫：先裁到每塊在桌面上的範圍，再用作品像素畫，跟作品本身送出去的方式一樣。' },
    params: [
      P_CTX, P_MAPPING,
      { name: 'pattern', type: 'String', en: 'One of [`ALIGN_PATTERNS`](#ALIGN_PATTERNS). `\'vendor\'` draws nothing (a page places those images itself).', zh: '[`ALIGN_PATTERNS`](#ALIGN_PATTERNS) 其中之一。`\'vendor\'` 什麼都不畫（那些圖由頁面自己擺）。' },
      { name: 'opts', type: 'Object', optional: true, default: '{}', en: '`view` (desktop → canvas, as for [`withTile()`](#withTile)), `overlay` (a see-through background over the work), `clear` (false: keep what is there), `variant` (the bars\' kind), `highlight` (`\'Q2:B3\'`), `outputs` (also the outputs\' frames), `lang` (`\'zh\'` for the words).', zh: '`view`（桌面 → 畫布，同 [`withTile()`](#withTile)）、`overlay`（疊在作品上的半透明底）、`clear`（false：保留原本的畫面）、`variant`（色條種類）、`highlight`（`\'Q2:B3\'`）、`outputs`（順便畫每路輸出的外框）、`lang`（`\'zh\'` 時字用中文）。' },
    ],
    returns: { type: 'Object', en: '`{ drawn }`: the number of tiles drawn.', zh: '`{ drawn }`：畫了幾塊。' },
    description: [
      { en: 'This is the first of the three things one layout drives, and the reason to trust the other two: every pattern takes the same tiles as the work, so a pattern that is right on the wall means the work is right. Line widths, circles and cells are in target pixels, so on an output whose processor scales a circle stays round.', zh: '這是一份佈局驅動的三件事的第一件，也是相信另外兩件的理由：每種圖樣都走跟作品一樣的那些塊，所以圖樣在牆上對了，作品就對。線寬、圓和格子都以目標像素為單位，所以處理器有縮放的輸出上，圓還是圓的。' },
      { en: 'A preview: pass `view: { k }` with k the canvas width over the desktop width. Lines never get thinner than one canvas pixel.', zh: '預覽：傳 `view: { k }`，k 是畫布寬除以桌面寬。線再細也不會小於一個畫布像素。' },
    ],
    examples: [{
      code: `import { computeMapping, drawPattern } from '@openav/align';
${BAND}
const M = computeMapping(layout), c = document.getElementById('c');
drawPattern(c.getContext('2d'), M, 'tiles', { view: { k: c.width / M.desktop.w, x: 0, y: 0 }, outputs: true });`,
      caption: { en: 'The two outputs of the LED band side by side: each holds two coloured checkerboards with their cell names, the outputs framed in magenta.', zh: 'LED 帶的兩路輸出並排：每路有兩組不同顏色的棋盤和格名，輸出外框是洋紅色。' },
    }],
    related: ['ALIGN_PATTERNS', 'computeMapping', 'withTile', 'highlightCell', 'drawSource'],
    keywords: { en: ['test pattern', 'draw', 'alignment pattern', 'cells', 'grid', 'overlay', ...KW_EN], zh: ['校正圖樣', '畫', '對位圖樣', '格線', '疊圖', ...KW_ZH] },
  },

  withTile: {
    group: 'align',
    summary: { en: 'Draws inside one tile in art pixels: clipped to the tile\'s place on the desktop, scaled and turned as its feed says, then restored.', zh: '在一塊裡用作品像素作畫：裁到這塊在桌面上的位置，照 feed 縮放和旋轉，畫完還原。' },
    params: [
      P_CTX, P_TILE,
      { name: 'view', type: 'Object', en: 'Desktop px → canvas px, `{ k, x, y }`.', zh: '桌面 px → 畫布 px，`{ k, x, y }`。' },
      { name: 'fn', type: 'Function', en: '`(env) => {}`, drawing in art px; `env.px` is how many art px one canvas pixel is, `env.lw(n)` a line width never under one canvas pixel.', zh: '`(env) => {}`，用作品 px 作畫。`env.px` 是一個畫布像素等於幾個作品 px，`env.lw(n)` 是不會小於一個畫布像素的線寬。' },
    ],
    returns: { type: 'any', en: 'What fn returns.', zh: 'fn 的回傳值。' },
    description: [{ en: 'For a pattern of your own that must take the work\'s path. The clip is on whole canvas pixels, so two neighbouring tiles share one edge in a scaled preview, with no dark seam.', zh: '自己做的圖樣要走作品的路時用它。裁切對齊到整數畫布像素，所以縮小預覽時相鄰兩塊共用同一條邊，不會留一條暗縫。' }],
    examples: [{
      code: `import { computeMapping, withTile } from '@openav/align';
${TWO}
const M = computeMapping(layout), c = document.getElementById('c'), g = c.getContext('2d');
const view = { k: c.width / M.desktop.w, x: 0, y: 0 };
for (const t of M.tiles) withTile(g, t, view, (env) => {
  g.fillStyle = t.name === 'L' ? '#246' : '#462'; g.fillRect(t.src.x, t.src.y, t.src.w, t.src.h);
  g.strokeStyle = '#fff'; g.lineWidth = env.lw(1); g.beginPath(); g.arc(1920, 540, 400, 0, Math.PI * 2); g.stroke();
});`,
      caption: { en: 'One circle at the seam of the art canvas, drawn in each projector\'s tile: its two halves meet exactly at the boundary.', zh: '在作品畫布接縫上畫一個圓，每台投影機的塊各畫一次：兩個半圓剛好在邊界接起來。' },
    }],
    related: ['drawPattern', 'highlightCell'],
    keywords: { en: ['clip', 'transform', 'custom pattern', 'draw in tile'], zh: ['裁切', '變換', '自訂圖樣'] },
  },

  highlightCell: {
    group: 'align',
    summary: { en: 'Outlines one cell (\'Q2:B3\') in yellow on every tile its segment is fed to; false when the cell does not exist.', zh: '用黃框標出一格（\'Q2:B3\'），那段送到的每一塊上都畫，格子不存在時回傳 false。' },
    params: [
      P_CTX, P_MAPPING,
      { name: 'id', type: 'String', en: '`<segment>:<cell>`.', zh: '`<段>:<格>`。' },
      P_VIEW,
    ],
    returns: { type: 'Boolean', en: 'Whether it drew anything.', zh: '有沒有畫。' },
    description: [{ en: 'For "it is this one": the operator names a cell, everyone on site sees which. A stacked segment gets it on both projectors.', zh: '用來說「就是這一格」：控台報一個格名，現場每個人都看得到是哪一格。疊投的段兩台投影機上都會標。' }],
    examples: [{
      code: `import { computeMapping, drawPattern, highlightCell } from '@openav/align';
${BAND}
const M = computeMapping(layout), c = document.getElementById('c'), g = c.getContext('2d');
const view = { k: c.width / M.desktop.w, x: 0, y: 0 };
drawPattern(g, M, 'tiles', { view });
document.getElementById('app').textContent = highlightCell(g, M, 'Q2:B3', view) + ' ' + highlightCell(g, M, 'Q2:C1', view);`,
      caption: { en: 'Prints true false, with cell B3 of the second quarter outlined in yellow on output A\'s lower half (there is no row C).', zh: '印出 true false，輸出 A 下半部第二段的 B3 格框上黃框（沒有 C 列）。' },
    }],
    related: ['cellIdAt', 'drawPattern', 'normalizeAlignArgs'],
    keywords: { en: ['highlight', 'mark cell', 'point out'], zh: ['標出', '報位', '標記格子'] },
  },

  drawOutputs: {
    group: 'align',
    summary: { en: 'Draws each output\'s frame and its name, size and place on the desktop, in dashed magenta: a preview\'s map of the signals.', zh: '用洋紅虛線畫出每路輸出的外框，寫上名字、尺寸和在桌面上的位置：預覽時的訊號地圖。' },
    params: [P_CTX, P_MAPPING, P_VIEW],
    description: [{ en: 'On the wall the frame is that output\'s signal edge: a frame that is not where the wall\'s edge is, is a splitter or display setting, not the layout.', zh: '在牆上，這個框就是那一路訊號的邊界：框跟牆邊對不上時，問題在分割器或顯示設定，不在佈局。' }],
    examples: [{
      code: `import { computeMapping, drawOutputs } from '@openav/align';
${BAND}
const M = computeMapping(layout), c = document.getElementById('c'), g = c.getContext('2d');
g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height);
drawOutputs(g, M, { k: c.width / M.desktop.w, x: 0, y: 0 });`,
      caption: { en: 'Two dashed magenta rectangles side by side, labelled output A 1920×1080 @ 0,0 and output B 1920×1080 @ 1920,0.', zh: '兩個並排的洋紅虛線框，標著 output A 1920×1080 @ 0,0 和 output B 1920×1080 @ 1920,0。' },
    }],
    related: ['drawPattern', 'computeMapping'],
    keywords: { en: ['outputs', 'frame', 'preview', 'signal edge'], zh: ['輸出外框', '預覽', '訊號邊界'] },
  },

  // ------------------------------------------------------------------------------------------------ structured light
  grayEncode: {
    group: 'align',
    summary: { en: 'Binary to Gray code: neighbouring numbers differ in exactly one bit.', zh: '二進位轉格雷碼：相鄰的數字只差一個位元。' },
    params: [{ name: 'n', type: 'Number', en: 'An integer ≥ 0.', zh: '≥ 0 的整數。' }],
    returns: { type: 'Number', en: '`n ^ (n >>> 1)`.', zh: '等於 `n ^ (n >>> 1)`。' },
    description: [{ en: 'Why Gray code for structured light: a camera pixel on the border between two stripes can read one bit wrong, and in Gray code that is an error of one projector pixel, not half the picture.', zh: '結構光為什麼用格雷碼：落在兩條條紋交界的相機像素可能讀錯一個位元，用格雷碼的話誤差只有一個投影機像素，不是半張畫面。' }],
    examples: [{
      code: `import { grayEncode } from '@openav/align';

document.getElementById('app').textContent = [0, 1, 2, 3, 4, 5, 6, 7].map((n) => grayEncode(n).toString(2).padStart(3, '0')).join(' ');`,
      caption: { en: 'Prints 000 001 011 010 110 111 101 100: one bit changes at each step.', zh: '印出 000 001 011 010 110 111 101 100：每一步只變一個位元。' },
    }],
    related: ['grayDecode', 'graySequence', 'decodeGrayBits'],
    keywords: { en: ['gray code', 'reflected binary', 'structured light'], zh: ['格雷碼', '結構光'] },
  },

  grayDecode: {
    group: 'align',
    summary: { en: 'Gray code to binary: the inverse of grayEncode.', zh: '格雷碼轉二進位：grayEncode 的反向。' },
    params: [{ name: 'g', type: 'Number', en: 'A Gray-coded integer.', zh: '格雷碼的整數。' }],
    returns: { type: 'Number', en: 'The number it codes.', zh: '它代表的數字。' },
    examples: [{
      code: `import { grayEncode, grayDecode } from '@openav/align';

const ok = Array.from({ length: 1920 }, (_, x) => grayDecode(grayEncode(x)) === x).every(Boolean);
document.getElementById('app').textContent = ok + ' ' + grayDecode(0b101);`,
      caption: { en: 'Prints true 6: every x of a 1920-wide projector comes back, and 101 is 6.', zh: '印出 true 6：1920 寬投影機的每一個 x 都解得回來，101 是 6。' },
    }],
    description: [{ en: 'Used by [`decodeGrayBits()`](#decodeGrayBits) once the bits are read.', zh: '讀到位元之後，[`decodeGrayBits()`](#decodeGrayBits) 用它解碼。' }],
    related: ['grayEncode', 'decodeGrayBits'],
    keywords: { en: ['gray code', 'decode'], zh: ['格雷碼', '解碼'] },
  },

  bitsFor: {
    group: 'align',
    summary: { en: 'How many bits the coordinates 0 … size − 1 need: one Gray-code frame (and its inverse) per bit.', zh: '座標 0 … size − 1 需要幾個位元：每個位元一張格雷碼圖（加它的反相）。' },
    params: [{ name: 'size', type: 'Number', en: 'Pixels along one axis.', zh: '一個軸向的像素數。' }],
    returns: { type: 'Number', en: '`ceil(log2(size))`, at least 1.', zh: '`ceil(log2(size))`，至少 1。' },
    examples: [{
      code: `import { bitsFor } from '@openav/align';

document.getElementById('app').textContent = [1080, 1200, 1920, 3840].map((s) => s + ': ' + bitsFor(s)).join(', ');`,
      caption: { en: 'Prints 1080: 11, 1200: 11, 1920: 11, 3840: 12.', zh: '印出 1080: 11, 1200: 11, 1920: 11, 3840: 12。' },
    }],
    description: [{ en: 'So a 1920 × 1200 projector takes 11 + 11 bits: with inverses and the white and black references, 46 frames ([`graySequence()`](#graySequence)).', zh: '所以 1920 × 1200 的投影機要 11 + 11 個位元，加上反相和全白、全黑兩張基準，共 46 張（[`graySequence()`](#graySequence)）。' }],
    related: ['graySequence'],
    keywords: { en: ['bits', 'frame count'], zh: ['位元數', '張數'] },
  },

  graySequence: {
    group: 'align',
    summary: { en: 'Every Gray-code frame of one structured-light run, in shooting order: white, black, then each bit of x and of y with its inverse.', zh: '一輪結構光的每一張格雷碼圖，照拍攝順序：全白、全黑，再來是 x 和 y 的每個位元與它的反相。' },
    params: [
      { name: 'size', type: 'Object', en: 'The projectors\' resolution `{ w, h }` (several sizes: give the largest).', zh: '投影機解析度 `{ w, h }`（解析度不同時給最大的）。' },
      { name: 'inverse', type: 'Boolean', optional: true, default: 'true', en: 'Each frame followed by its inverse: a per-pixel threshold that copes with uneven light.', zh: '每張後面接它的反相：逐像素的閾值，不怕光不均勻。' },
      { name: 'refs', type: 'Boolean', optional: true, default: 'true', en: 'An all-white and an all-black frame first (exposure, and the room\'s own light).', zh: '最前面先投全白和全黑（曝光基準，以及場地本身的光）。' },
      { name: 'axes', type: 'String[]', optional: true, default: "['x', 'y']", en: 'Which axes.', zh: '哪幾個軸。' },
    ],
    returns: { type: 'Object[]', en: 'Frames `{ kind: \'white\' | \'black\' }` and `{ kind: \'gray\', axis, bit, nbits, inverse }`; bit 0 is the widest stripes.', zh: '圖的清單：`{ kind: \'white\' | \'black\' }` 和 `{ kind: \'gray\', axis, bit, nbits, inverse }`，bit 0 是最寬的條紋。' },
    description: [
      { en: 'This, with [`drawGrayFrame()`](#drawGrayFrame), is the automatic-alignment part that exists: the pattern generator for camera-in-the-loop alignment. Each projector draws in its own colour channel, so three run at once and one photo per frame measures all three. Capturing the camera, reading the bits out of the photos, the camera ↔ projector correspondence, solving a warp mesh from it and the blend brightness field are not built: they are the roadmap in the chapter.', zh: '這個加上 [`drawGrayFrame()`](#drawGrayFrame)，就是自動對位已經有的部分：相機閉環對位的圖樣產生器。每台投影機只畫在自己的色通道，所以三台同時投，每張一張照片就同時量完三台。相機取像、從照片讀出位元、相機與投影機的對應、從對應解出 warp 網格、熔接的亮度場，這些都還沒做：它們是手冊章節裡的路線圖。' },
    ],
    examples: [{
      code: `import { graySequence, frameLabel } from '@openav/align';

const seq = graySequence({ w: 1920, h: 1200 });
document.getElementById('app').textContent = seq.length + ' frames: ' + seq.slice(0, 4).map((f) => frameLabel(f)).join(', ') + ' …';`,
      caption: { en: 'Prints 46 frames: white (the exposure reference), black (the room\'s own light), X bit 1 of 11, X bit 1 of 11 (inverse) …', zh: '印出 46 frames: white (the exposure reference), black (the room\'s own light), X bit 1 of 11, X bit 1 of 11 (inverse) …' },
    }],
    related: ['drawGrayFrame', 'grayBitAt', 'channelPlan', 'decodeGrayBits', 'bitsFor'],
    keywords: { en: ['structured light', 'gray code', 'camera calibration', 'automatic alignment', 'projector calibration', 'sequence'], zh: ['結構光', '格雷碼', '相機校正', '自動對位', '投影校正'] },
  },

  grayBitAt: {
    group: 'align',
    summary: { en: 'Whether a Gray-code frame is lit (1) or dark (0) at one projector coordinate along its axis.', zh: '一張格雷碼圖在某個投影機座標（沿它的軸）是亮（1）還是暗（0）。' },
    params: [P_FRAME, { name: 'coord', type: 'Number', en: 'Projector px along the frame\'s axis.', zh: '沿這張圖軸向的投影機 px。' }],
    returns: { type: 'Number', en: '0 or 1; a white frame is always 1, a black one 0, an inverse frame the opposite of its pair.', zh: '0 或 1。全白永遠是 1，全黑是 0，反相圖跟它那一張相反。' },
    examples: [{
      code: `import { graySequence, grayBitAt } from '@openav/align';

const top = graySequence({ w: 1920, h: 1080 }, { refs: false, axes: ['x'] })[0];   // the widest stripes
document.getElementById('app').textContent = [0, 1023, 1024, 1919].map((x) => x + ':' + grayBitAt(top, x)).join(' ');`,
      caption: { en: 'Prints 0:0 1023:0 1024:1 1919:1: the highest bit splits the picture at 1024.', zh: '印出 0:0 1023:0 1024:1 1919:1：最高位元在 1024 把畫面分成兩半。' },
    }],
    description: [{ en: 'The truth a decoder is tested against: every coordinate\'s bits, frame by frame.', zh: '解碼器要對照的答案：每個座標在每一張圖上的位元。' }],
    related: ['graySequence', 'decodeGrayBits', 'grayRuns'],
    keywords: { en: ['bit', 'stripe', 'lit'], zh: ['位元', '條紋', '亮暗'] },
  },

  decodeGrayBits: {
    group: 'align',
    summary: { en: 'Bits read at one camera pixel, highest first, already 0 or 1 → the projector coordinate they code.', zh: '一個相機像素讀到的位元（最高位在前、已經二值化）→ 它們代表的投影機座標。' },
    params: [{ name: 'bits', type: 'Array', en: '0/1 or false/true, one per frame of an axis, highest bit first.', zh: '0/1 或 false/true，一軸的每張圖一個，最高位在前。' }],
    returns: { type: 'Number', en: 'The projector coordinate.', zh: '投影機座標。' },
    description: [{ en: 'Only the arithmetic. Reading those bits out of photos (thresholding each camera pixel against the frame and its inverse) is the camera half, which is not built.', zh: '只有數學那一步。從照片讀出這些位元（每個相機像素用那張圖和它的反相比出閾值）是相機那一半，還沒做。' }],
    examples: [{
      code: `import { graySequence, grayBitAt, decodeGrayBits } from '@openav/align';

const frames = graySequence({ w: 1920, h: 1080 }, { refs: false, inverse: false, axes: ['x'] });
const seen = frames.map((f) => grayBitAt(f, 1234));                // what a perfect camera would read at x = 1234
document.getElementById('app').textContent = seen.join('') + ' → ' + decodeGrayBits(seen);`,
      caption: { en: 'Prints 11010111011 → 1234: the eleven bits a perfect camera would read come back as the coordinate.', zh: '印出 11010111011 → 1234：完美的相機會讀到的十一個位元，解回原本的座標。' },
    }],
    related: ['graySequence', 'grayBitAt', 'grayDecode'],
    keywords: { en: ['decode', 'gray code', 'correspondence', 'camera'], zh: ['解碼', '格雷碼', '對應', '相機'] },
  },

  grayRuns: {
    group: 'align',
    summary: { en: 'A Gray-code frame\'s lit runs along its axis, [[start, end), …]: one fillRect each.', zh: '一張格雷碼圖沿軸向的亮段 [[start, end), …]：一段一個 fillRect。' },
    params: [P_FRAME, { name: 'size', type: 'Number', en: 'Projector px along the axis.', zh: '軸向的投影機 px。' }],
    returns: { type: 'Array', en: 'Half-open ranges; the widest bit is one run, the finest size / 4.', zh: '半開區間。最寬的位元一段，最細的是 size / 4 段。' },
    examples: [{
      code: `import { graySequence, grayRuns } from '@openav/align';

const f = graySequence({ w: 16, h: 16 }, { refs: false, inverse: false, axes: ['x'] });
document.getElementById('app').textContent = f.map((x) => JSON.stringify(grayRuns(x, 16))).join(' ');`,
      caption: { en: 'Prints [[8,16]] [[4,12]] [[2,6],[10,14]] [[1,3],[5,7],[9,11],[13,15]]: the four frames of a 16-pixel axis.', zh: '印出 [[8,16]] [[4,12]] [[2,6],[10,14]] [[1,3],[5,7],[9,11],[13,15]]：16 像素軸的四張圖。' },
    }],
    description: [{ en: 'What [`drawGrayFrame()`](#drawGrayFrame) draws with, so even the finest frame of a 4K output is a few hundred rectangles.', zh: '[`drawGrayFrame()`](#drawGrayFrame) 就是用它畫的，所以 4K 輸出最細的那張也只有幾百個矩形。' }],
    related: ['drawGrayFrame', 'grayBitAt'],
    keywords: { en: ['runs', 'stripes'], zh: ['亮段', '條紋'] },
  },

  channelPlan: {
    group: 'align',
    summary: { en: 'Gives each output (projector) its own colour channel, three to a pass (R, G, B); more than three outputs take more passes.', zh: '每路輸出（投影機）分一個色通道，三台一輪（R、G、B），超過三台就分好幾輪。' },
    params: [P_MAPPING, { name: 'channels', type: 'String[]', optional: true, default: "['r', 'g', 'b']", en: 'The channels to hand out.', zh: '要分配的通道。' }],
    returns: { type: 'Object[]', en: 'One `{ <output id>: \'r\' | \'g\' | \'b\' }` per pass, in the layout\'s order of outputs.', zh: '每一輪一個 `{ <輸出 id>: \'r\' | \'g\' | \'b\' }`，照佈局裡輸出的順序。' },
    description: [{ en: 'Channel separation is what lets one photo measure three projectors at once, and makes a camera bumped between shots impossible for those three. A colour camera still mixes the channels a little: the crosstalk matrix to correct that is part of the camera half (not built).', zh: '通道分離讓一張照片同時量三台投影機，這三台之間「拍攝中間相機被碰到」這件事就不可能發生。彩色相機還是會讓通道互相滲一點：修正它的串擾矩陣屬於相機那一半（還沒做）。' }],
    examples: [{
      code: `import { channelPlan } from '@openav/align';

const five = { outputs: ['P1', 'P2', 'P3', 'P4', 'P5'].map((id) => ({ id })) };
document.getElementById('app').textContent = JSON.stringify(channelPlan(five));`,
      caption: { en: 'Prints [{"P1":"r","P2":"g","P3":"b"},{"P4":"r","P5":"g"}]: five projectors in two passes.', zh: '印出 [{"P1":"r","P2":"g","P3":"b"},{"P4":"r","P5":"g"}]：五台投影機分兩輪。' },
    }],
    related: ['drawGrayFrame', 'graySequence'],
    keywords: { en: ['channel separation', 'RGB', 'passes', 'several projectors'], zh: ['通道分離', 'RGB', '分輪', '多台投影機'] },
  },

  drawGrayFrame: {
    group: 'align',
    summary: { en: 'Draws one Gray-code frame over the desktop: each output in its own projector pixels and its own colour channel, never warped.', zh: '在桌面上畫一張格雷碼圖：每路輸出用自己的投影機像素、自己的色通道，從不經過 warp。' },
    params: [
      P_CTX, P_MAPPING, P_FRAME,
      { name: 'assign', type: 'Object', optional: true, default: 'channelPlan(mapping)[0]', en: '`{ <output id>: channel }`; an output without one stays black. The default is the first pass only.', zh: '`{ <輸出 id>: 通道 }`，沒分到通道的輸出全黑。預設只有第一輪。' },
      P_VIEW,
    ],
    description: [
      { en: 'Gray-code frames measure which projector pixel lands where, so they are drawn in output pixels, on the desktop, not on the art canvas and not through the calibration\'s warp. With more than three projectors, run [`channelPlan()`](#channelPlan)\'s passes one after another.', zh: '格雷碼圖量的是「投影機的哪個像素落在哪裡」，所以畫在輸出像素、也就是桌面上，不畫在作品畫布上，也不經過校正的 warp。超過三台投影機時，把 [`channelPlan()`](#channelPlan) 的每一輪依序跑完。' },
      { en: 'To shoot: camera on a tripod, fixed exposure, focus and white balance, the room dark, one photo per frame in the order of [`graySequence()`](#graySequence). What would read those photos is not built.', zh: '拍法：相機上腳架，曝光、對焦、白平衡都鎖定，場地關燈，照 [`graySequence()`](#graySequence) 的順序一張圖拍一張。讀這些照片的程式還沒做。' },
    ],
    examples: [{
      code: `import { computeMapping, graySequence, drawGrayFrame, frameLabel } from '@openav/align';
${TWO}
const M = computeMapping(layout), seq = graySequence({ w: 1920, h: 1080 });
const c = document.getElementById('c'), g = c.getContext('2d'), view = { k: c.width / M.desktop.w, x: 0, y: 0 };
let i = 0;
const step = () => { drawGrayFrame(g, M, seq[i], { view }); document.getElementById('app').textContent = (i + 1) + '/' + seq.length + ' ' + frameLabel(seq[i]); i = (i + 1) % seq.length; };
step(); setInterval(step, 500);`,
      caption: { en: 'The two projectors step through all 46 frames, two a second: the left one in red, the right one in green, each its own stripes, with the frame\'s name above.', zh: '兩台投影機每秒兩張跑完 46 張：左邊紅色、右邊綠色，各自的條紋，上方寫著這一張的名字。' },
    }],
    related: ['graySequence', 'channelPlan', 'grayRuns', 'frameLabel'],
    keywords: { en: ['structured light', 'gray code', 'draw frame', 'camera calibration', 'automatic alignment'], zh: ['結構光', '格雷碼', '自動對位', '相機校正'] },
  },

  frameLabel: {
    group: 'align',
    summary: { en: 'A Gray-code frame\'s name for a person, in English (\'X bit 3 of 11 (inverse)\') or in Chinese.', zh: '格雷碼圖給人看的名字：\'X bit 3 of 11 (inverse)\'，中文是 \'X 位元 3／11（反相）\'。' },
    params: [P_FRAME, P_LANG],
    returns: { type: 'String', en: 'The name.', zh: '名字。' },
    examples: [{
      code: `import { graySequence, frameLabel } from '@openav/align';

const f = graySequence({ w: 1920, h: 1080 })[5];
document.getElementById('app').textContent = frameLabel(f) + ' | ' + frameLabel(f, 'zh');`,
      caption: { en: 'Prints X bit 2 of 11 (inverse), then the same name in Chinese.', zh: '印出 X bit 2 of 11 (inverse) | X 位元 2／11（反相）。' },
    }],
    description: [{ en: 'For the screen of the person shooting: which frame is on now, so the photo can be named after it.', zh: '給拍攝的人看：現在投的是哪一張，照片可以照它命名。' }],
    related: ['graySequence', 'drawGrayFrame'],
    keywords: { en: ['label', 'frame name'], zh: ['名稱', '標籤'] },
  },

  normalizeAlignArgs: {
    group: 'align',
    summary: { en: 'Makes an "align" command\'s arguments safe, the same check on the control page and on the page that draws the wall: { on, pattern, variant?, highlight? }.', zh: '讓「align」指令的參數變安全，控制頁和畫牆的頁面用同一個檢查：{ on, pattern, variant?, highlight? }。' },
    params: [
      { name: 'a', type: 'Object', en: 'The arguments as they arrived (anything).', zh: '收到的參數（什麼都可能）。' },
      { name: 'patterns', type: 'String[]', optional: true, default: 'ALIGN_PATTERNS', en: 'The patterns this work accepts.', zh: '這件作品接受的圖樣。' },
      { name: 'fallback', type: 'String', optional: true, default: "'grid'", en: 'What an unknown pattern becomes.', zh: '不認得的圖樣換成什麼。' },
    ],
    returns: { type: 'Object', en: '`{ on, pattern }`, plus `variant` and `highlight` only when they look right.', zh: '`{ on, pattern }`，`variant` 和 `highlight` 看起來正確時才會有。' },
    description: [{ en: '`on` is true unless it is exactly false. The shape stays the same as the list of patterns grows, so an old control page and a new wall page still understand each other. Send it through a relay (`@openav/relay`) or any channel you have.', zh: '`on` 除非明確是 false，否則就是 true。圖樣清單變長，形狀也不會變，所以舊的控制頁和新的牆頁還是講得通。透過中繼（`@openav/relay`）或任何現成的通道送都可以。' }],
    examples: [{
      code: `import { normalizeAlignArgs } from '@openav/align';

const a = normalizeAlignArgs({ pattern: 'bars', variant: 'steps', highlight: 'Q2:B3' });
const b = normalizeAlignArgs({ pattern: 'vendor', highlight: '<b>' }, { patterns: ['tiles', 'grid'] });
document.getElementById('app').textContent = JSON.stringify(a) + ' ' + JSON.stringify(b);`,
      caption: { en: 'Prints {"on":true,"pattern":"bars","variant":"steps","highlight":"Q2:B3"} {"on":true,"pattern":"grid"}.', zh: '印出 {"on":true,"pattern":"bars","variant":"steps","highlight":"Q2:B3"} {"on":true,"pattern":"grid"}。' },
    }],
    related: ['ALIGN_PATTERNS', 'highlightCell', 'RelayClient'],
    keywords: { en: ['command', 'control', 'remote', 'sanitize', 'relay'], zh: ['指令', '遠端控制', '參數檢查', '中繼'] },
  },

  // ------------------------------------------------------------------------------------------------ WebGL
  createBlitter: {
    group: 'align',
    summary: { en: 'A function that copies a texture onto a three.js canvas through an align mapping, tile by tile, 1:1 or scaled; THREE is passed in.', zh: '一個函式，用 three.js 照對位映射把貼圖一塊一塊貼到畫布上，1:1 或縮放，THREE 由呼叫端傳入。' },
    params: [
      { name: 'THREE', type: 'Object', en: 'The three.js module.', zh: 'three.js 模組。' },
      { name: 'renderer', type: 'THREE.WebGLRenderer', en: 'The renderer of the desktop canvas.', zh: '桌面畫布的 renderer。' },
      { name: 'onMismatch', type: 'Function', optional: true, default: 'console.warn', en: 'Called once when the canvas is not the desktop\'s size.', zh: '畫布跟桌面大小不同時呼叫一次。' },
    ],
    returns: { type: 'Function', en: '`blit(texture, mapping)` → `{ mismatch }`: clears the canvas and copies each tile from the texture (an art.w × art.h render target).', zh: '`blit(texture, mapping)` → `{ mismatch }`：清空畫布，再把每一塊從貼圖（art.w × art.h 的 render target）貼過來。' },
    description: [
      { en: 'The plain output: the work renders once into a render target the size of the art canvas, and this copies it with [`blitPlan()`](#blitPlan)\'s viewports and scissors. It asks the renderer for the canvas\'s size (not the window\'s) and divides by its pixel ratio.', zh: '最基本的輸出：作品先畫進一張作品畫布大小的 render target，這個函式再用 [`blitPlan()`](#blitPlan) 的 viewport 和 scissor 貼出去。畫布大小問 renderer 本人（不是視窗），並除以它的 pixel ratio。' },
      { en: 'It cannot turn a tile (throws for a turned feed) nor apply a calibration: [`createWarpRenderer()`](#createWarpRenderer) does both.', zh: '它轉不了塊（遇到轉過的 feed 會丟錯），也套不了校正：這兩件事 [`createWarpRenderer()`](#createWarpRenderer) 都做得到。' },
    ],
    examples: [{
      code: `import * as THREE from 'three';
import { computeMapping, createBlitter } from '@openav/align';

const renderer = new THREE.WebGLRenderer({ canvas });            // the desktop canvas, fullscreen
const rt = new THREE.WebGLRenderTarget(mapping.art.w, mapping.art.h);
const blit = createBlitter(THREE, renderer);
function frame() {
  renderer.setRenderTarget(rt); renderer.render(scene, camera);   // the work, once, at art size
  blit(rt.texture, mapping);                                       // then tile by tile onto the outputs
  requestAnimationFrame(frame);
}`,
      caption: { en: 'A three.js work drawn once into a render target, then copied onto every output as the layout says.', zh: '一件 three.js 作品先畫進 render target 一次，再照佈局貼到每一路輸出。' },
      run: 'static', why: WHY_THREE,
    }],
    related: ['blitPlan', 'createWarpRenderer', 'computeMapping'],
    keywords: { en: ['three.js', 'webgl', 'blit', 'render target', 'output'], zh: ['three.js', 'WebGL', '貼圖', '輸出'] },
  },

  createWarpRenderer: {
    group: 'align',
    summary: { en: 'A three.js renderer for a calibrated output: each tile one fine mesh placed by its zone (corners and mesh), with feather, gain and masks, stacks adding up.', zh: '校正後輸出的 three.js renderer：每塊一片細分網格，照它那一區的四角和網格擺放，套上羽化、亮度和遮罩，疊投處光相加。' },
    params: [{ name: 'THREE', type: 'Object', en: 'The three.js module.', zh: 'three.js 模組。' }],
    returns: { type: 'Object', en: '`{ meshes, build(mapping, zones, n = 32), draw(renderer, texture, region), dispose() }`.', zh: '一個物件 `{ meshes, build(mapping, zones, n = 32), draw(renderer, texture, region), dispose() }`。' },
    description: [
      { en: '`build()` again whenever the calibration changes (it is cheap: (n + 1)² vertices a tile); `zones` is `normalizeCalibration(…).variants[variant].zones`. `draw()` renders the texture through every mesh onto the region of the desktop this canvas shows, `{ x, y, w, h }`: the whole desktop for one window across every output, or one output for one window per output.', zh: '校正一變就重新 `build()`（很便宜：一塊 (n + 1)² 個頂點）。`zones` 是 `normalizeCalibration(…).variants[variant].zones`。`draw()` 把貼圖透過每片網格畫到這張畫布負責的那一塊桌面 `{ x, y, w, h }`：一個視窗橫跨所有輸出時是整個桌面，每路輸出一個視窗時是那一路。' },
      { en: 'Uncalibrated, it puts every pixel where [`createBlitter()`](#createBlitter) does, and it can turn a feed. The texture can be the work\'s render target or a pattern ([`createPatternTexture()`](#createPatternTexture)): both go through the same warp.', zh: '沒校正過時，每個像素的位置跟 [`createBlitter()`](#createBlitter) 一樣，而且它轉得了 feed。貼圖可以是作品的 render target，也可以是圖樣（[`createPatternTexture()`](#createPatternTexture)）：兩者走同一條 warp。' },
    ],
    notes: [{ en: '`@openav/output`\'s windows use a CSS homography and cannot show a mesh, a feather or a mask: this is the WebGL path for those (see the chapter, "Output, tile and align").', zh: '`@openav/output` 的視窗用的是 CSS homography，顯示不了網格、羽化和遮罩：這是那些功能的 WebGL 路線（見手冊章節的「output、tile 與 align」）。' }],
    examples: [{
      code: `import * as THREE from 'three';
import { computeMapping, normalizeCalibration, createWarpRenderer } from '@openav/align';

const M = computeMapping(layout);
const cal = normalizeCalibration(saved, M);                      // saved: the file, or null for none yet
const warp = createWarpRenderer(THREE);
warp.build(M, cal.variants[M.id].zones);
const renderer = new THREE.WebGLRenderer({ canvas });
const region = { x: 0, y: 0, w: M.desktop.w, h: M.desktop.h };
renderer.setViewport(0, 0, canvas.clientWidth, canvas.clientHeight);
warp.draw(renderer, artTexture, region);                         // artTexture: a CanvasTexture of the work`,
      caption: { en: 'The work\'s texture drawn through the calibration onto a canvas that shows the whole desktop.', zh: '作品的貼圖透過校正檔畫到一張顯示整個桌面的畫布上。' },
      run: 'static', why: WHY_THREE,
    }],
    related: ['normalizeCalibration', 'zoneGrid', 'createBlitter', 'createPatternTexture', 'createAlignUI'],
    keywords: { en: ['warp', 'mesh warp', 'keystone', 'corner pin', 'edge blending', 'feather', 'mask', 'three.js', 'webgl', ...KW_EN], zh: ['warp', '網格變形', '梯形校正', '四角校正', '邊緣融接', '羽化', '遮罩', ...KW_ZH] },
  },

  // ------------------------------------------------------------------------------------------------ calibration
  CALIBRATION_FORMAT: {
    group: 'align',
    aliases: ['CAL_CONTRACT'],
    summary: { en: 'The format name a calibration file is written with: `\'open-audiovisual/align-calibration@1\'`. `CAL_CONTRACT` is the same constant, art-align\'s name.', zh: '校正檔的格式名稱：`\'open-audiovisual/align-calibration@1\'`。`CAL_CONTRACT` 是同一個常數，用的是 art-align 取的名字。' },
    value: { type: 'String', en: '`\'open-audiovisual/align-calibration@1\'`.', zh: '字串 `\'open-audiovisual/align-calibration@1\'`。' },
    description: [
      { en: 'A calibration is `{ format, savedAt, variants: { <variant>: { zones: { <tile name>: zone } } } }`: one zone per tile (corners, mesh, feather, gamma, gain, masks) for each variant of the work\'s layout. A file written as `"contract": "art-align-cal/v1"` loads unchanged ([`normalizeCalibration()`](#normalizeCalibration)) and is written back with the new name. The schema is `packages/align/align-calibration.schema.json`.', zh: '校正檔是 `{ format, savedAt, variants: { <擺法>: { zones: { <塊名>: 區 } } } }`：作品佈局的每一種擺法、每一塊各一區（四角、網格、羽化、gamma、亮度、遮罩）。寫成 `"contract": "art-align-cal/v1"` 的檔案不用改就讀得進來（[`normalizeCalibration()`](#normalizeCalibration)），存回去時用新的名字。結構描述在 `packages/align/align-calibration.schema.json`。' },
    ],
    examples: [{
      code: `import { CALIBRATION_FORMAT, CAL_CONTRACT } from '@openav/align';

document.getElementById('app').textContent = CALIBRATION_FORMAT + ' ' + (CAL_CONTRACT === CALIBRATION_FORMAT);`,
      caption: { en: 'Prints open-audiovisual/align-calibration@1 true.', zh: '印出 open-audiovisual/align-calibration@1 true。' },
    }],
    related: ['normalizeCalibration', 'ALIGN_FORMAT', 'createCalStore'],
    keywords: { en: ['calibration file', 'format', 'art-align'], zh: ['校正檔', '格式'] },
  },

  defaultZone: {
    group: 'align',
    summary: { en: 'A tile\'s zone before anyone calibrated it: its four corners on its dst (turned with the feed), a flat 3 × 3 mesh, no feather, gamma 2.2, gain 1, the layout\'s masks.', zh: '一塊還沒人校正過的區：四角就在它的 dst 上（跟著 feed 轉）、平的 3 × 3 網格、沒有羽化、gamma 2.2、亮度 1、佈局的遮罩。' },
    params: [P_TILE],
    returns: { type: 'Object', en: '`{ corners, mesh: { cols, rows, d }, feather: { l, r, t, b }, gamma, gain, masks }`.', zh: '一區 `{ corners, mesh: { cols, rows, d }, feather: { l, r, t, b }, gamma, gain, masks }`。' },
    description: [
      { en: 'A zone, in zone coordinates (u, v) from 0 to 1 over the tile\'s segment: the desktop position is the perspective of the four `corners` (segment top-left, top-right, bottom-right, bottom-left, desktop px) plus the `mesh`\'s shift there (cols × rows points, desktop px, bilinear between). The brightness is `gain × feather ** (1 / gamma)`, black inside `masks` (`{ u, v, w, h }`). The feather is a share of the zone on each side, 0 to 0.5.', zh: '一區用區內座標 (u, v)，0 到 1，蓋住這塊的段：桌面位置是四個 `corners`（段的左上、右上、右下、左下，桌面 px）決定的透視，加上 `mesh` 在那裡的位移（cols × rows 個點，桌面 px，中間雙線性內插）。亮度是 `gain × feather ** (1 / gamma)`，`masks`（`{ u, v, w, h }`）裡面是黑的。羽化是每一邊佔這區的比例，0 到 0.5。' },
      { en: 'Uncalibrated is exactly the plain mapping: every point lands where the 1:1 or scaled copy puts it.', zh: '沒校正過就跟原本的映射一模一樣：每一點都落在 1:1 或縮放貼法放的位置。' },
    ],
    examples: [{
      code: `import { computeMapping, defaultZone } from '@openav/align';
${TWO}
const z = defaultZone(computeMapping(layout).tiles[1]);
document.getElementById('app').textContent = JSON.stringify(z.corners) + ' gain ' + z.gain + ' mesh ' + z.mesh.cols + 'x' + z.mesh.rows;`,
      caption: { en: 'Prints [[1920,0],[3840,0],[3840,1080],[1920,1080]] gain 1 mesh 3x3: the right projector\'s corners, untouched.', zh: '印出 [[1920,0],[3840,0],[3840,1080],[1920,1080]] gain 1 mesh 3x3：右邊投影機的四角，原封不動。' },
    }],
    related: ['normalizeZone', 'normalizeCalibration', 'warpPoint', 'featherAt'],
    keywords: { en: ['zone', 'default', 'corners', 'mesh', 'feather', 'mask', 'gain'], zh: ['區', '預設', '四角', '網格', '羽化', '遮罩', '亮度'] },
  },

  normalizeZone: {
    group: 'align',
    summary: { en: 'One zone made whole: missing parts from the tile\'s default zone, numbers clamped to a sane range, a mesh of the wrong size reset to flat.', zh: '把一區補完整：缺的從這塊的預設區補，數字夾在合理範圍內，點數不對的網格重設成平的。' },
    params: [{ name: 'z', type: 'Object', en: 'A zone from a file (anything).', zh: '檔案裡的一區（什麼都可能）。' }, P_TILE],
    returns: { type: 'Object', en: 'A zone: mesh 2–9 points a side, feather 0–0.5 each, gamma 0.5–4, gain 0–1.5, mask values 0–1.', zh: '一區：網格每邊 2 到 9 個點，羽化各 0 到 0.5，gamma 0.5 到 4，亮度 0 到 1.5，遮罩數值 0 到 1。' },
    description: [{ en: 'A file edited by hand, or from an older version, never breaks the output: what cannot be read takes the default.', zh: '手改過或舊版的檔案永遠不會讓輸出壞掉：讀不懂的部分就用預設值。' }],
    examples: [{
      code: `import { normalizeZone } from '@openav/align';

const z = normalizeZone({ gain: 7, feather: { l: 0.9 }, mesh: { cols: 3, rows: 3, d: [1] } }, { dst: { x: 0, y: 0, w: 100, h: 50 } });
document.getElementById('app').textContent = 'gain ' + z.gain + ' feather.l ' + z.feather.l + ' mesh points ' + z.mesh.d.length + ' corner ' + JSON.stringify(z.corners[2]);`,
      caption: { en: 'Prints gain 1.5 feather.l 0.5 mesh points 9 corner [100,50].', zh: '印出 gain 1.5 feather.l 0.5 mesh points 9 corner [100,50]。' },
    }],
    related: ['defaultZone', 'normalizeCalibration'],
    keywords: { en: ['zone', 'clamp', 'repair'], zh: ['區', '夾值', '修復'] },
  },

  normalizeCalibration: {
    group: 'align',
    summary: { en: 'A calibration made whole for one mapping: one zone per tile under variants[variant], other variants kept; reads art-align-cal/v1 too, anything else starts empty.', zh: '為一份映射補完整的校正檔：variants[variant] 底下每塊一區，其他擺法保留，也讀 art-align-cal/v1，其他東西就從空的開始。' },
    params: [
      { name: 'cal', type: 'Object | null', en: 'A calibration from a file, a store or nowhere (null).', zh: '從檔案、存放處或什麼都沒有（null）來的校正檔。' },
      P_MAPPING,
      { name: 'variant', type: 'String', optional: true, default: 'mapping.id', en: 'Which layout of the work this is: each variant keeps its own zones.', zh: '這是作品的哪一種擺法：每種擺法各存各的區。' },
    ],
    returns: { type: 'Object', en: '`{ format: \'open-audiovisual/align-calibration@1\', savedAt, variants }`.', zh: '補完整的校正檔 `{ format: \'open-audiovisual/align-calibration@1\', savedAt, variants }`。' },
    description: [
      { en: 'What the align mode edits and saves. A zone the file lacks (a tile added to the layout) is the default; a mask removed on site stays removed, because a saved zone wins over the layout\'s masks.', zh: '對位模式改的、存的就是它。檔案裡沒有的區（佈局新加的塊）用預設值。現場刪掉的遮罩會維持刪掉，因為存下來的區優先於佈局的遮罩。' },
    ],
    examples: [{
      code: `import { computeMapping, normalizeCalibration } from '@openav/align';
${TWO}
const M = computeMapping(layout);
const old = { contract: 'art-align-cal/v1', variants: { two: { zones: { R: { corners: [[1930, 12], [3840, 0], [3830, 1080], [1920, 1075]] } } } } };
const cal = normalizeCalibration(old, M);
document.getElementById('app').textContent = cal.format + ' | R ' + JSON.stringify(cal.variants.two.zones.R.corners[0]) + ' | L ' + JSON.stringify(cal.variants.two.zones.L.corners[0]);`,
      caption: { en: 'Prints open-audiovisual/align-calibration@1 | R [1930,12] | L [0,0]: the old file\'s moved corner is kept, the missing zone is the default.', zh: '印出 open-audiovisual/align-calibration@1 | R [1930,12] | L [0,0]：舊檔案移過的角保留，缺的那一區用預設值。' },
    }],
    related: ['CALIBRATION_FORMAT', 'defaultZone', 'createWarpRenderer', 'createCalStore', 'createAlignUI'],
    keywords: { en: ['calibration', 'load', 'variants', 'art-align', 'compatibility'], zh: ['校正檔', '讀取', '擺法', '相容'] },
  },

  squareToQuad: {
    group: 'align',
    summary: { en: 'The 3 × 3 perspective matrix from the unit square to four corners, row by row; null for a degenerate quad.', zh: '從單位正方形到四個角的 3 × 3 透視矩陣，一列一列排，四邊形退化時回傳 null。' },
    params: [{ name: 'q', type: 'Array', en: '`[[x, y] × 4]`: top-left, top-right, bottom-right, bottom-left.', zh: '`[[x, y] × 4]`：左上、右上、右下、左下。' }],
    returns: { type: 'Number[] | null', en: '`[a, b, c, d, e, f, g, h, 1]`: (u, v) → ((a·u + b·v + c) / w, (d·u + e·v + f) / w), w = g·u + h·v + 1.', zh: '`[a, b, c, d, e, f, g, h, 1]`：(u, v) → ((a·u + b·v + c) / w, (d·u + e·v + f) / w)，w = g·u + h·v + 1。' },
    description: [{ en: 'The four-corner part of a zone. `@openav/output`\'s [`cornerPin()`](#cornerPin) is the same transform scaled to a box of width × height (and it refuses a quad that is not convex); `@openav/tile`\'s [`homography()`](#homography) fits one to any number of measured points.', zh: '一區的四角那部分。`@openav/output` 的 [`cornerPin()`](#cornerPin) 是同一個變換，只是縮放到 width × height 的方框（而且不收非凸的四邊形）。`@openav/tile` 的 [`homography()`](#homography) 則是從任意多個量到的點擬合出一個。' }],
    examples: [{
      code: `import { squareToQuad } from '@openav/align';

const H = squareToQuad([[100, 50], [900, 120], [860, 700], [140, 640]]);
const at = (u, v) => { const w = H[6] * u + H[7] * v + H[8]; return [(H[0] * u + H[1] * v + H[2]) / w, (H[3] * u + H[4] * v + H[5]) / w].map((n) => n.toFixed(1)); };
document.getElementById('app').textContent = at(1, 1).join(',') + ' | ' + at(0.5, 0.5).join(',');`,
      caption: { en: 'Prints 860.0,700.0 | 501.0,393.0: the corner lands on its corner, the centre where the perspective puts it.', zh: '印出 860.0,700.0 | 501.0,393.0：角落在它的角上，中心落在透視算出來的位置。' },
    }],
    related: ['warpPoint', 'quadOk', 'cornerPin', 'homography'],
    keywords: { en: ['homography', 'perspective', 'corner pin', 'keystone', 'matrix'], zh: ['單應性', '透視', '四角校正', '梯形校正', '矩陣'] },
  },

  warpPoint: {
    group: 'align',
    summary: { en: 'A zone point (u, v) → desktop px: the perspective of the zone\'s four corners, plus its mesh\'s shift there.', zh: '區內一點 (u, v) → 桌面 px：這區四角的透視，加上網格在那裡的位移。' },
    params: [
      P_ZONE,
      { name: 'u', type: 'Number', en: '0 to 1, across the segment.', zh: '0 到 1，橫跨整段。' },
      { name: 'v', type: 'Number', en: '0 to 1, down the segment.', zh: '0 到 1，由上到下。' },
      { name: 'H', type: 'Number[]', optional: true, default: 'squareToQuad(zone.corners)', en: 'The corners\' matrix, when you have it already (many points).', zh: '四角的矩陣，已經算好時傳進來（算很多點時）。' },
    ],
    returns: { type: 'Number[]', en: '`[x, y]`; `[NaN, NaN]` for a degenerate quad.', zh: '`[x, y]`，四邊形退化時是 `[NaN, NaN]`。' },
    description: [{ en: 'What the GL mesh, the handles and the outlines are all made of: one formula for where the picture goes.', zh: 'GL 網格、把手、外框全都用它算：畫面要去哪裡，只有一條公式。' }],
    examples: [{
      code: `import { defaultZone, warpPoint } from '@openav/align';

const z = defaultZone({ dst: { x: 0, y: 0, w: 1000, h: 500 } });
z.mesh.d[4] = [10, -20];                                         // the middle control point of the 3 × 3 mesh
document.getElementById('app').textContent = warpPoint(z, 0.5, 0.5).join(',') + ' | ' + warpPoint(z, 0, 0).join(',');`,
      caption: { en: 'Prints 510,230 | 0,0: the middle moved by the mesh, the corner where it was.', zh: '印出 510,230 | 0,0：中間被網格移動了，角還在原位。' },
    }],
    related: ['squareToQuad', 'zoneGrid', 'defaultZone'],
    keywords: { en: ['warp', 'mesh', 'bilinear', 'point'], zh: ['變形', '網格', '雙線性'] },
  },

  featherAt: {
    group: 'align',
    summary: { en: 'A zone\'s feather weight at (u, v), 0 to 1: a cosine ramp over each edge\'s share of the zone.', zh: '一區在 (u, v) 的羽化權重，0 到 1：每一邊在它佔的比例內是一段餘弦斜坡。' },
    params: [
      { name: 'f', type: 'Object', en: '`{ l, r, t, b }`: each edge\'s share of the zone, 0 to 0.5.', zh: '`{ l, r, t, b }`：每一邊佔這區的比例，0 到 0.5。' },
      { name: 'u', type: 'Number', en: '0 to 1.', zh: '0 到 1。' },
      { name: 'v', type: 'Number', en: '0 to 1.', zh: '0 到 1。' },
    ],
    returns: { type: 'Number', en: 'The product of the four edges\' ramps; the shader raises it to 1 / gamma.', zh: '四邊斜坡的乘積，shader 再取 1 / gamma 次方。' },
    description: [{ en: 'The same curve as a layout\'s cosine blend ([`blendWeight()`](#blendWeight)), set by eye on site where two projectors overlap: grey 50 % shows the band best.', zh: '跟佈局的餘弦熔接（[`blendWeight()`](#blendWeight)）同一條曲線，在現場兩台投影機重疊的地方用眼睛調：灰 50% 最看得出帶子。' }],
    examples: [{
      code: `import { featherAt } from '@openav/align';

const f = { l: 0.2, r: 0, t: 0, b: 0 };
document.getElementById('app').textContent = [0, 0.05, 0.1, 0.2, 0.5].map((u) => featherAt(f, u, 0.5).toFixed(3)).join(' ');`,
      caption: { en: 'Prints 0.000 0.146 0.500 1.000 1.000: the left fifth fades in.', zh: '印出 0.000 0.146 0.500 1.000 1.000：左邊五分之一漸漸亮起來。' },
    }],
    related: ['blendWeight', 'defaultZone', 'createWarpRenderer'],
    keywords: { en: ['feather', 'edge blending', 'soft edge', 'cosine'], zh: ['羽化', '邊緣融接', '軟邊'] },
  },

  zoneGrid: {
    group: 'align',
    summary: { en: 'The calibrated zone as a triangle grid for WebGL: n × n cells of desktop positions, zone coordinates and indices.', zh: '把校正後的區變成給 WebGL 用的三角網格：n × n 格的桌面位置、區內座標和索引。' },
    params: [P_ZONE, { name: 'n', type: 'Number', optional: true, default: '32', en: 'Cells a side.', zh: '每邊幾格。' }],
    returns: { type: 'Object', en: '`{ pos: Float32Array (x, y), uv: Float32Array (u, v), index: Uint32Array }`: (n + 1)² vertices, 2n² triangles.', zh: '`{ pos: Float32Array (x, y), uv: Float32Array (u, v), index: Uint32Array }`：(n + 1)² 個頂點、2n² 個三角形。' },
    description: [{ en: 'What [`createWarpRenderer()`](#createWarpRenderer) builds its meshes from; use it to draw a warp with another engine.', zh: '[`createWarpRenderer()`](#createWarpRenderer) 用它建網格，換別的引擎畫 warp 時也可以用。' }],
    examples: [{
      code: `import { defaultZone, zoneGrid } from '@openav/align';

const g = zoneGrid(defaultZone({ dst: { x: 100, y: 0, w: 400, h: 200 } }), 4);
document.getElementById('app').textContent = (g.pos.length / 2) + ' vertices, ' + (g.index.length / 3) + ' triangles, last vertex ' + g.pos[g.pos.length - 2] + ',' + g.pos[g.pos.length - 1];`,
      caption: { en: 'Prints 25 vertices, 32 triangles, last vertex 500,200.', zh: '印出 25 vertices, 32 triangles, last vertex 500,200。' },
    }],
    related: ['createWarpRenderer', 'warpPoint'],
    keywords: { en: ['mesh', 'triangles', 'webgl', 'geometry'], zh: ['網格', '三角形', '幾何'] },
  },

  rotateZone: {
    group: 'align',
    summary: { en: 'Turns a whole zone a quarter clockwise (or back with −1) by moving its corners round one place: a projector hung the other way.', zh: '把整區順時針轉 90°（−1 是轉回去），做法是四角輪一格：投影機裝反時用。' },
    params: [P_ZONE, { name: 'dir', type: 'Number', optional: true, default: '1', en: 'Quarter turns, clockwise; negative turns back.', zh: '轉幾個 90°，順時針，負的往回轉。' }],
    returns: { type: 'Object', en: 'The same zone, changed.', zh: '同一個區，已經改過。' },
    description: [{ en: 'The same direction as a feed\'s `rotate` in the layout: four turns bring it home.', zh: '方向跟佈局裡 feed 的 `rotate` 一樣：轉四次回到原位。' }],
    examples: [{
      code: `import { defaultZone, rotateZone } from '@openav/align';

const z = defaultZone({ dst: { x: 0, y: 0, w: 300, h: 100 } });
rotateZone(z);
document.getElementById('app').textContent = JSON.stringify(z.corners[0]);`,
      caption: { en: 'Prints [300,0]: after a quarter turn the segment\'s top-left is on the top-right.', zh: '印出 [300,0]：轉 90° 之後，段的左上在右上角。' },
    }],
    related: ['defaultZone', 'quadOk'],
    keywords: { en: ['rotate', 'turn', 'upside down'], zh: ['旋轉', '轉向', '裝反'] },
  },

  quadOk: {
    group: 'align',
    summary: { en: 'Whether four corners make a convex quad that runs clockwise on the screen; a folded or crossed one would draw the picture inside out.', zh: '四個角是不是在螢幕上順時針排的凸四邊形，翻面或打結的四邊形會把畫面畫反。' },
    params: [{ name: 'q', type: 'Array', en: '`[[x, y] × 4]`: top-left, top-right, bottom-right, bottom-left.', zh: '`[[x, y] × 4]`：左上、右上、右下、左下。' }],
    returns: { type: 'Boolean', en: 'true when the quad can be used.', zh: '可以用時為 true。' },
    description: [{ en: 'The align mode refuses a drag or a nudge that would make it false.', zh: '對位模式會拒絕會讓它變成 false 的拖曳或微調。' }],
    examples: [{
      code: `import { quadOk } from '@openav/align';

document.getElementById('app').textContent = [
  [[0, 0], [10, 0], [10, 10], [0, 10]],
  [[0, 0], [10, 10], [10, 0], [0, 10]],
  [[0, 0], [0, 10], [10, 10], [10, 0]],
].map(quadOk).join(' ');`,
      caption: { en: 'Prints true false false: a square, a crossed one, a mirrored one.', zh: '印出 true false false：正方形、打結的、鏡像的。' },
    }],
    related: ['squareToQuad', 'rotateZone', 'cornerPin'],
    keywords: { en: ['convex', 'valid quad', 'folded'], zh: ['凸四邊形', '翻面', '打結'] },
  },

  // ------------------------------------------------------------------------------------------------ sources, store, UI
  PATTERN_SOURCES: {
    group: 'align',
    summary: { en: 'What the align mode can show, in the order P cycles through: the work, the identification screen, the patterns, the bars, white, grey and black.', zh: '對位模式可以顯示的畫面，照按 P 輪播的順序：作品、認機畫面、各種圖樣、色條、全白、灰、全黑。' },
    value: { type: 'String[]', en: "`['live', 'ident', 'tiles', 'grid', 'edges', 'crosshair', 'bars:smpte', 'bars:steps', 'bars:ramp', 'white', 'gray50', 'black']`.", zh: "十二個字串 `['live', 'ident', 'tiles', 'grid', 'edges', 'crosshair', 'bars:smpte', 'bars:steps', 'bars:ramp', 'white', 'gray50', 'black']`。" },
    description: [{ en: "`live` is the work itself (the caller draws it); the rest [`drawSource()`](#drawSource) paints on the art canvas. White shows even brightness, grey 50 % the blend bands, black light leaks.", zh: '`live` 是作品本身（由呼叫端畫），其他的由 [`drawSource()`](#drawSource) 畫在作品畫布上。全白看亮度均不均勻，灰 50% 看熔接帶，全黑看漏光。' }],
    examples: [{
      code: `import { PATTERN_SOURCES } from '@openav/align';

document.getElementById('app').textContent = PATTERN_SOURCES.length + ': ' + PATTERN_SOURCES.join(' → ');`,
      caption: { en: 'Prints 12: live → ident → tiles → grid → edges → crosshair → bars:smpte → bars:steps → bars:ramp → white → gray50 → black.', zh: '印出 12: live → ident → tiles → grid → edges → crosshair → bars:smpte → bars:steps → bars:ramp → white → gray50 → black。' },
    }],
    related: ['drawSource', 'createPatternTexture', 'createAlignUI', 'ALIGN_PATTERNS'],
    keywords: { en: ['sources', 'what to show', 'flat colour'], zh: ['畫面來源', '純色'] },
  },

  drawSource: {
    group: 'align',
    summary: { en: 'Paints one source of the align mode on an art-canvas context: a pattern with its variant (\'bars:steps\'), the identification screen, white, grey 50 % or black.', zh: '在作品畫布的 context 上畫一種對位模式的畫面：圖樣加變體（\'bars:steps\'）、認機畫面、全白、灰 50% 或全黑。' },
    params: [
      { name: 'g', type: 'CanvasRenderingContext2D', en: 'A context of the art canvas\'s size (art.w × art.h).', zh: '作品畫布大小（art.w × art.h）的 context。' },
      P_MAPPING,
      { name: 'source', type: 'String', en: 'One of [`PATTERN_SOURCES`](#PATTERN_SOURCES) except `live`.', zh: '[`PATTERN_SOURCES`](#PATTERN_SOURCES) 其中之一，`live` 除外。' },
      P_LANG,
    ],
    description: [{ en: 'Drawn on the art canvas (through [`artView()`](#artView)), so the picture goes through the same warp as the work: a pattern that is right on the wall means the work is right, one warp later.', zh: '畫在作品畫布上（透過 [`artView()`](#artView)），所以這張畫面跟作品走同一條 warp：圖樣在牆上對了，作品也對，多一層 warp 也一樣。' }],
    examples: [{
      code: `import { computeMapping, drawSource } from '@openav/align';

const layout = await (await fetch('/packages/align/layouts/room-corner.json')).json();
const M = computeMapping(layout);
const art = document.createElement('canvas'); art.width = M.art.w; art.height = M.art.h;
drawSource(art.getContext('2d'), M, 'grid');
const c = document.getElementById('c');
c.getContext('2d').drawImage(art, 0, 0, c.width, c.width * M.art.h / M.art.w);`,
      caption: { en: 'The room\'s art canvas with the grid: the two walls side by side on top, the floor under the left one, coordinates continuous across the walls.', zh: '房間的作品畫布畫上格線：上面兩面牆並排，左邊那面底下是地面，座標跨牆連續。' },
    }],
    related: ['PATTERN_SOURCES', 'createPatternTexture', 'artView', 'drawPattern'],
    keywords: { en: ['source', 'pattern on art canvas', 'flat colour'], zh: ['畫面來源', '作品畫布上的圖樣'] },
  },

  createPatternTexture: {
    group: 'align',
    summary: { en: 'A three.js CanvasTexture of the art canvas\'s size that a source is painted into, redrawn only when the source changes (the ident screen 15 times a second).', zh: '一張作品畫布大小的 three.js CanvasTexture，把畫面來源畫進去，只在來源改變時重畫（認機畫面每秒 15 次）。' },
    params: [
      { name: 'THREE', type: 'Object', en: 'The three.js module.', zh: 'three.js 模組。' },
      { name: 'size', type: 'Object', en: 'The art canvas `{ w, h }`.', zh: '作品畫布 `{ w, h }`。' },
      { name: 'doc', type: 'Document', optional: true, default: 'document', en: 'Where its canvas is made.', zh: '在哪裡建立它的 canvas。' },
      P_LANG,
    ],
    returns: { type: 'Object', en: '`{ canvas, texture, draw(mapping, source, t = 0) → texture, dispose() }`; `t` (seconds) moves the ident screen\'s sweep and clock.', zh: '`{ canvas, texture, draw(mapping, source, t = 0) → texture, dispose() }`。`t`（秒）讓認機畫面的光帶和時鐘動起來。' },
    description: [{ en: 'Hand its texture to [`createWarpRenderer()`](#createWarpRenderer) instead of the work\'s: the pattern goes out through the calibration. The ident screen\'s still part is drawn once and kept; only the moving part is drawn again.', zh: '把它的貼圖交給 [`createWarpRenderer()`](#createWarpRenderer) 取代作品的貼圖：圖樣就透過校正檔送出去。認機畫面靜止的部分只畫一次存起來，只重畫會動的部分。' }],
    examples: [{
      code: `import * as THREE from 'three';
import { createPatternTexture } from '@openav/align';

const patterns = createPatternTexture(THREE, mapping.art);
function frame(ms) {
  const tex = state.source === 'live' ? artTexture : patterns.draw(mapping, state.source, ms / 1000);
  warp.draw(renderer, tex, region);
  requestAnimationFrame(frame);
}`,
      caption: { en: 'The align mode\'s picture: the work, or the chosen pattern, through the same warp.', zh: '對位模式的畫面：作品或選到的圖樣，走同一條 warp。' },
      run: 'static', why: WHY_THREE,
    }],
    related: ['drawSource', 'createWarpRenderer', 'PATTERN_SOURCES', 'drawIdentLive'],
    keywords: { en: ['texture', 'three.js', 'pattern texture'], zh: ['貼圖', 'three.js', '圖樣貼圖'] },
  },

  createCalStore: {
    group: 'align',
    summary: { en: 'Where a calibration and the align mode\'s state are kept: an app\'s files through a bridge, or the browser\'s localStorage with the last 20 saves as backups.', zh: '校正檔和對位模式狀態存在哪裡：透過 bridge 寫成 app 的檔案，或者存在瀏覽器的 localStorage，留最近 20 次存檔當備份。' },
    params: [
      { name: 'bridge', type: 'Object | null', optional: true, default: 'null', en: 'An object an app\'s preload exposes: `load`, `saveCalibration`, `saveState`, `listBackups`, `readBackup`, `exportCalibration`, `importCalibration`, `displays`, `nextDisplay`, `setAutostart`.', zh: 'app 的 preload 提供的物件：`load`、`saveCalibration`、`saveState`、`listBackups`、`readBackup`、`exportCalibration`、`importCalibration`、`displays`、`nextDisplay`、`setAutostart`。' },
      { name: 'prefix', type: 'String', optional: true, default: "'oav-align'", en: 'The localStorage keys: `<prefix>/calibration`, `<prefix>/state`, `<prefix>/backups`.', zh: 'localStorage 的鍵：`<prefix>/calibration`、`<prefix>/state`、`<prefix>/backups`。' },
      { name: 'storage', type: 'Storage | null', optional: true, default: 'localStorage', en: 'Where to keep them (a test passes one in memory).', zh: '存在哪裡（測試可以傳一個記憶體裡的）。' },
    ],
    returns: { type: 'Object', en: '`{ kind, load(), saveCalibration(cal), saveState(st), listBackups(), readBackup(name), exportTo(cal), importFrom(), displays(), nextDisplay(), setAutostart(on) }`, every method a Promise. `kind` is `\'browser\'` or `\'electron\'`.', zh: '`{ kind, load(), saveCalibration(cal), saveState(st), listBackups(), readBackup(name), exportTo(cal), importFrom(), displays(), nextDisplay(), setAutostart(on) }`，每個方法都回傳 Promise。`kind` 是 `\'browser\'` 或 `\'electron\'`。' },
    description: [
      { en: 'The prefix is the address of your saved work: change it and the old calibration is not found. A page that used art-align\'s default (`art-align`) keeps its calibration: with the default prefix, `load()`, `listBackups()` and `readBackup()` read the old keys while the new ones are empty (never writing them), and the first save writes the new keys, the old backups included.', zh: 'prefix 就是存檔的位址：改了它，舊的校正檔就找不到了。用過 art-align 預設值（`art-align`）的頁面，校正檔還在：用預設 prefix 時，新的鍵還是空的，`load()`、`listBackups()`、`readBackup()` 就讀舊的鍵（從不寫入），第一次存檔才寫進新的鍵，舊的備份也一起帶過去。' },
      { en: '`exportTo()` downloads the file and `importFrom()` opens a file picker (in a page, from a click). A browser page cannot start itself at boot nor pick a display: those need an app with a bridge.', zh: '`exportTo()` 會下載檔案，`importFrom()` 會開檔案選擇器（在網頁裡要從點擊觸發）。瀏覽器頁面不能開機自動啟動，也不能選螢幕：那些要有 bridge 的 app。' },
    ],
    examples: [{
      code: `import { createCalStore } from '@openav/align';

const kept = new Map();
const storage = { getItem: (k) => kept.get(k) ?? null, setItem: (k, v) => kept.set(k, v) };
const store = createCalStore({ storage });
await store.saveCalibration({ format: 'open-audiovisual/align-calibration@1', variants: {} });
await store.saveCalibration({ format: 'open-audiovisual/align-calibration@1', variants: { a: { zones: {} } } });
const { calibration } = await store.load();
document.getElementById('app').textContent = Object.keys(calibration.variants) + ' | ' + (await store.listBackups()).length + ' backups | ' + [...kept.keys()].join(' ');`,
      caption: { en: 'Prints a | 2 backups | oav-align/backups oav-align/calibration.', zh: '印出 a | 2 backups | oav-align/backups oav-align/calibration。' },
    }],
    related: ['createAlignUI', 'normalizeCalibration', 'CALIBRATION_FORMAT'],
    keywords: { en: ['save', 'load', 'backups', 'localStorage', 'electron', 'persist'], zh: ['存檔', '讀取', '備份', '持久化'] },
  },

  createAlignUI: {
    group: 'align',
    summary: { en: 'The align mode for the venue: handles over the picture to drag corners and mesh points, feather, masks and gain, and a panel; saved a second after each change.', zh: '現場用的對位模式：畫面上的把手可以拖四角和網格點、調羽化、遮罩和亮度，加上一個面板，每次改動一秒後自動存檔。' },
    params: [{ name: 'o', type: 'Object', en: '`canvas` (the picture, object-fit: contain in its parent), `region` (the part of the desktop it shows), `getMapping()`, `store` ([`createCalStore()`](#createCalStore)), `state` (`{ mode, source, variant, zone }`), `cal` (normalized), `onChange(why)` (`\'cal\'` or `\'source\'`: rebuild the warp), `setMode(mode)` (`\'play\'` to leave: the caller removes `body.align`), and optionally `setVariant(v)`, `replaceCalibration(cal)` (a backup or an imported file: normalize it and call `setCalibration`), `variants`, `sources`, `sourceNames`, `lang`.', zh: '`canvas`（畫面，在父元素裡 object-fit: contain）、`region`（它顯示的那一塊桌面）、`getMapping()`、`store`（[`createCalStore()`](#createCalStore)）、`state`（`{ mode, source, variant, zone }`）、`cal`（正規化過的）、`onChange(why)`（`\'cal\'` 或 `\'source\'`：重建 warp）、`setMode(mode)`（`\'play\'` 表示離開：由呼叫端拿掉 `body.align`），以及選填的 `setVariant(v)`、`replaceCalibration(cal)`（備份或匯入的檔案：正規化之後呼叫 `setCalibration`）、`variants`、`sources`、`sourceNames`、`lang`。' }],
    returns: { type: 'Object', en: '`{ draw(), setCalibration(cal), setState(s), save(), ui }`.', zh: '一個物件 `{ draw(), setCalibration(cal), setState(s), save(), ui }`。' },
    description: [
      { en: 'It is on while `document.body` has the class `align`, which the work adds (its own key or button). Then every key belongs to it, caught in the capture phase: C corners, G mesh, E feather, K masks; Tab or a digit picks a zone, [ ] a handle; the arrows move 1 px (Shift ×10, Alt ×0.25); + − mesh density; Q turns the zone 90°; N adds a mask; , . brightness; P the next source; V the next variant; O hides the frames; Backspace puts a handle back; ⌘S saves, ⌘Z undoes, L lists the backups, X exports, I imports; A leaves.', zh: '`document.body` 有 `align` 這個 class 時就開著，這個 class 由作品自己加（用它自己的鍵或按鈕）。開著的時候每個鍵都歸它，在 capture 階段攔下：C 四角、G 網格、E 羽化、K 遮罩。Tab 或數字選區，[ ] 換把手。方向鍵移 1 px（Shift ×10、Alt ×0.25）。+ − 網格密度，Q 整區轉 90°，N 新增遮罩，, . 調亮度，P 換畫面，V 換擺法，O 隱藏外框，Backspace 把手回原位。⌘S 存檔、⌘Z 復原、L 備份清單、X 匯出、I 匯入，A 離開。' },
      { en: 'The panel speaks English, or Chinese with `lang: \'zh\'` (by default it follows the page\'s `lang`). A corner that would fold the quad does not move, and says so.', zh: '面板說英文，`lang: \'zh\'` 時說中文（預設跟著頁面的 `lang`）。會讓四邊形翻面的角不會動，並且會說明。' },
    ],
    examples: [{
      code: `import { computeMapping, identityLayout, normalizeCalibration, createCalStore, createAlignUI } from '@openav/align';

const c = document.getElementById('c');
const M = computeMapping(identityLayout(c.width, c.height, { id: 'demo' }));
let cal = normalizeCalibration(null, M);
const state = { mode: 'align', source: 'tiles', variant: 'demo', zone: 'ALL' };
const kept = new Map(), store = createCalStore({ storage: { getItem: (k) => kept.get(k) ?? null, setItem: (k, v) => kept.set(k, v) } });
const ui = createAlignUI({
  canvas: c, region: { x: 0, y: 0, w: M.desktop.w, h: M.desktop.h }, getMapping: () => M, store, state, cal,
  onChange: () => {}, setMode: (m) => document.body.classList.toggle('align', m === 'align'),
});
document.body.classList.add('align');
ui.draw();`,
      caption: { en: 'The align panel opens top-left, and the canvas gets a yellow outline with four corner handles: drag one, or press ] and the arrows.', zh: '對位面板在左上角打開，畫布上出現黃色外框和四個角的把手：拖一個，或按 ] 再用方向鍵。' },
    }],
    notes: [{ en: 'It edits the calibration; it does not draw the picture. The page draws it through the calibration (with [`createWarpRenderer()`](#createWarpRenderer)) on each `onChange(\'cal\')`: example 31 does all of it on one screen.', zh: '它改的是校正檔，不畫畫面。頁面在每次 `onChange(\'cal\')` 時透過校正檔把畫面畫出來（用 [`createWarpRenderer()`](#createWarpRenderer)）：範例 31 在一個螢幕上把這些全部做完。' }],
    related: ['createCalStore', 'normalizeCalibration', 'createWarpRenderer', 'PATTERN_SOURCES', 'quadOk'],
    keywords: { en: ['align mode', 'calibration UI', 'drag corners', 'mesh warp', 'feather', 'mask', 'venue', 'keystone', ...KW_EN], zh: ['對位模式', '校正介面', '拖曳四角', '網格變形', '羽化', '遮罩', '現場', ...KW_ZH] },
  },

  // ------------------------------------------------------------------------------------------------ chart and ident
  drawChart: {
    group: 'align',
    summary: { en: 'Draws the vendor\'s alignment chart of one output at 1:1: grid and coordinates, the splitter\'s cuts, every block\'s size and first and last pixel, masks, which side is up.', zh: '畫一路輸出給廠商的 1:1 對位圖：格線和座標、分割器切線、每一塊的尺寸與第一個和最後一個像素、遮罩、哪一邊朝上。' },
    params: [
      { name: 'ctx', type: 'CanvasRenderingContext2D', en: 'A context of the output\'s size (output.w × output.h).', zh: '跟這路輸出一樣大（output.w × output.h）的 context。' },
      P_MAPPING,
      { name: 'outputId', type: 'String', en: 'Which output.', zh: '哪一路輸出。' },
      { name: 'opts', type: 'Object', optional: true, default: '{}', en: '`title`, `note`, `date`, `version` (the footer), `logo` (an image: placed in a corner that covers nothing, or left out), `lang` (`\'zh\'`).', zh: '`title`、`note`、`date`、`version`（頁尾）、`logo`（圖片：放在不壓到任何東西的角落，放不下就不畫）、`lang`（`\'zh\'`）。' },
    ],
    returns: { type: 'Object', en: '`{ tiles, cuts }`, plus `logo` (its rectangle, or null when no corner was free) when a logo was given.', zh: '`{ tiles, cuts }`，有給 logo 時多一個 `logo`（它的矩形，沒有空角落時是 null）。' },
    description: [
      { en: 'The second thing a layout drives: the image a hardware or splitter vendor sets their side up with, read from the same layout as the patterns and the output, so the three cannot disagree. The header says "pixel to pixel, no scaling" when every block is 1:1, and warns when one is scaled.', zh: '佈局驅動的第二件事：硬體或分割器廠商照著設定他們那一端的圖，跟圖樣和輸出讀同一份佈局，所以三者不可能對不上。每一塊都是 1:1 時頁頭寫「pixel to pixel，不縮放」，有縮放的塊時會警告。' },
      { en: 'Save it as a PNG at the output\'s full size (`canvas.toBlob`) and send that: a scaled copy is not a chart.', zh: '用這路輸出的原尺寸存成 PNG（`canvas.toBlob`）再寄出去：縮小過的就不算對位圖了。' },
    ],
    examples: [{
      code: `import { computeMapping, drawChart } from '@openav/align';

const layout = await (await fetch('/packages/align/layouts/room-corner.json')).json();
const M = computeMapping(layout), o = M.outputs[0];
const full = document.createElement('canvas'); full.width = o.w; full.height = o.h;
const r = drawChart(full.getContext('2d'), M, o.id, { date: '2026-12-01' });
const c = document.getElementById('c');
c.getContext('2d').drawImage(full, 0, 0, c.width, c.width * o.h / o.w);
document.getElementById('app').textContent = r.tiles + ' blocks, ' + r.cuts + ' cuts';`,
      caption: { en: 'Prints 3 blocks, 4 cuts and shows the room\'s 4K chart scaled down: two walls and the turned floor in the splitter\'s four cells, the door hatched red.', zh: '印出 3 blocks, 4 cuts，並顯示縮小的房間 4K 對位圖：分割器四格裡的兩面牆和轉過的地面，門洞畫成紅色斜線。' },
    }],
    related: ['vendorPlacements', 'drawPattern', 'computeMapping'],
    keywords: { en: ['vendor chart', 'alignment chart', 'splitter', 'pixel map', 'LED processor', 'cuts'], zh: ['對位圖', '廠商', '分割器', '像素圖', 'LED 處理器'] },
  },

  drawIdent: {
    group: 'align',
    summary: { en: 'Draws the whole identification screen in one call: drawIdentBase, then drawIdentLive at time t.', zh: '一次畫完整個認機畫面：先 drawIdentBase，再畫 t 秒時的 drawIdentLive。' },
    params: [
      { name: 'g', type: 'CanvasRenderingContext2D', en: 'An art-canvas context.', zh: '作品畫布的 context。' },
      P_MAPPING,
      { name: 't', type: 'Number', optional: true, default: '0', en: 'Seconds, for the sweep.', zh: '秒，給光帶用。' },
      { name: 'o', type: 'Object', optional: true, default: '{}', en: '`{ per, now, lang }`, as for the two parts.', zh: '`{ per, now, lang }`，跟兩個部分一樣。' },
    ],
    description: [{ en: 'The first thing to show on arrival: which surface is which, which way is up, whether the corners join. For a still, a test or a chart; a live page draws the base once and the live part every frame ([`createPatternTexture()`](#createPatternTexture) does).', zh: '到場第一個要放的畫面：哪一面是哪一面、哪邊朝上、牆角有沒有接起來。拿來截圖、測試或附在對位圖上。即時的頁面把底圖畫一次，會動的部分每格重畫（[`createPatternTexture()`](#createPatternTexture) 就是這樣做的）。' }],
    examples: [{
      code: `import { computeMapping, drawIdent } from '@openav/align';

const layout = await (await fetch('/packages/align/layouts/room-corner.json')).json();
const M = computeMapping(layout);
const art = document.createElement('canvas'); art.width = M.art.w; art.height = M.art.h;
drawIdent(art.getContext('2d'), M, 1.2);
const c = document.getElementById('c');
c.getContext('2d').drawImage(art, 0, 0, c.width, c.width * M.art.h / M.art.w);`,
      caption: { en: 'The room\'s identification screen: L and R in large letters on blue and orange walls, F on the green floor, each with its projector and part of the output, the band of light on the left wall.', zh: '房間的認機畫面：藍色和橘色的牆上寫著大大的 L、R，綠色的地面寫著 F，各自標出投影機和輸出的哪一格，光帶在左牆上。' },
    }],
    related: ['drawIdentBase', 'drawIdentLive', 'PATTERN_SOURCES'],
    keywords: { en: ['identification', 'ident', 'which wall', 'orientation', 'arrival'], zh: ['認機', '哪一面', '方位', '進場'] },
  },

  drawIdentBase: {
    group: 'align',
    summary: { en: 'Draws the still part of the identification screen on the art canvas: each surface\'s hue, metre grid, circle, name, projector and the words on its sides.', zh: '在作品畫布上畫認機畫面靜止的部分：每一面一個色相、公尺格線、一個圓、名字和尺寸、投影機和輸出的哪一格、四邊的字。' },
    params: [
      { name: 'g', type: 'CanvasRenderingContext2D', en: 'An art-canvas context.', zh: '作品畫布的 context。' },
      P_MAPPING, P_LANG,
    ],
    description: [
      { en: 'The surfaces come from the layout\'s `ident.surfaces` (`{ id, x, y, w, h, meters, name, big, hue, edges: { left, right, top, bottom }, arrow }`); without an ident block each segment is a surface named after itself. With metres, every surface of a room gets the same size of letters at any density, and the circle is a whole number of metres (an ellipse on the wall means the proportions are wrong).', zh: '面來自佈局的 `ident.surfaces`（`{ id, x, y, w, h, meters, name, big, hue, edges: { left, right, top, bottom }, arrow }`）。沒有 ident 區塊時，每一段就是一面，用段名命名。有寫公尺時，同一個房間的每一面不論密度都用同樣大小的字，圓的直徑是整數公尺（在牆上變成橢圓就是比例錯了）。' },
    ],
    examples: [{
      code: `import { computeMapping, drawIdentBase } from '@openav/align';

const layout = {
  format: 'open-audiovisual/align@1', id: 'two-walls', art: { w: 3200, h: 900 },
  segments: [{ id: 'A', x: 0, y: 0, w: 1600, h: 900, meters: { w: 4, h: 2.25 } }, { id: 'B', x: 1600, y: 0, w: 1600, h: 900, meters: { w: 4, h: 2.25 } }],
  outputs: [{ id: 'O', x: 0, y: 0, w: 3200, h: 900 }],
  feeds: [{ segment: 'A', output: 'O', x: 0, y: 0 }, { segment: 'B', output: 'O', x: 1600, y: 0 }],
};
const M = computeMapping(layout), c = document.getElementById('c'), g = c.getContext('2d');
g.scale(c.width / 3200, c.width / 3200);
drawIdentBase(g, M);`,
      caption: { en: 'Two surfaces without an ident block: A and B in large letters, each in its own hue with a metre grid and a 1 m circle.', zh: '沒有 ident 區塊的兩面：大大的 A 和 B，各自一個色相，有公尺格線和 1 公尺的圓。' },
    }],
    related: ['drawIdent', 'drawIdentLive'],
    keywords: { en: ['identification', 'surfaces', 'metres grid'], zh: ['認機', '面', '公尺格線'] },
  },

  drawIdentLive: {
    group: 'align',
    summary: { en: 'Draws the moving part of the identification screen over the still one: a band of light along ident.sweep, a dot round ident.sweepFloor, a clock on every surface.', zh: '在靜止的認機畫面上畫會動的部分：沿 ident.sweep 走的光帶、繞 ident.sweepFloor 的光點、每一面上的時鐘。' },
    params: [
      { name: 'g', type: 'CanvasRenderingContext2D', en: 'An art-canvas context, the base already drawn.', zh: '已經畫好底圖的作品畫布 context。' },
      P_MAPPING,
      { name: 't', type: 'Number', en: 'Seconds.', zh: '秒。' },
      { name: 'per', type: 'Number', optional: true, default: '2.5', en: 'Seconds the band takes over one surface.', zh: '光帶走過一面要幾秒。' },
      { name: 'now', type: 'Date', optional: true, default: 'new Date()', en: 'The clock\'s time.', zh: '時鐘顯示的時間。' },
    ],
    description: [{ en: 'The band runs along the surfaces of `ident.sweep` one after another as one strip, so the order of the walls and every corner show at a glance; the clock shows whether a picture is late or frozen. 15 frames a second are plenty.', zh: '光帶沿著 `ident.sweep` 的那幾面接成一條連續地走，牆的順序和每個牆角一眼就看得出來。時鐘看畫面有沒有延遲、有沒有凍住。每秒 15 格就夠了。' }],
    examples: [{
      code: `import { computeMapping, drawIdentBase, drawIdentLive } from '@openav/align';

const layout = await (await fetch('/packages/align/layouts/room-corner.json')).json();
const M = computeMapping(layout);
const base = document.createElement('canvas'); base.width = M.art.w; base.height = M.art.h;
drawIdentBase(base.getContext('2d'), M);
const art = document.createElement('canvas'); art.width = M.art.w; art.height = M.art.h;
const c = document.getElementById('c'), g = art.getContext('2d');
const tick = (ms) => { g.drawImage(base, 0, 0); drawIdentLive(g, M, ms / 1000); c.getContext('2d').drawImage(art, 0, 0, c.width, c.width * M.art.h / M.art.w); requestAnimationFrame(tick); };
requestAnimationFrame(tick);`,
      caption: { en: 'The band of light runs across the left wall, then the right one, while a dot follows the floor\'s edge and the clocks tick.', zh: '光帶先走過左牆再走右牆，同時有一個光點沿著地面的邊走，時鐘一直在跳。' },
    }],
    related: ['drawIdent', 'drawIdentBase', 'createPatternTexture'],
    keywords: { en: ['sweep', 'band of light', 'clock', 'latency'], zh: ['光帶', '時鐘', '延遲'] },
  },
};
