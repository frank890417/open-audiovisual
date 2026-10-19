// @openav/surface reference: the TouchOSC-style control surface. Read by tools/build-reference.mjs (see AGENTS.md,
// "Documenting a public name"). The layout helpers are pure and their examples run headless; the Surface itself runs on the
// smoke page (it needs only a DOM); the phone helpers that need a screen, a gesture or hardware have stand-ins or are static.
// Entry points: '@openav/surface' (everything), '@openav/surface/layout' (the pure layout helpers), '@openav/surface/auto'.

export default {
  Surface: {
    group: 'remote',
    summary: {
      en: 'A TouchOSC-style control panel: draws the pages and widgets of a layout in a container, and sends each touch out as a named signal.',
      zh: '像 TouchOSC 的控制面板：把版面裡的頁面和元件畫在容器裡，每一次觸碰都變成一個有名字的訊號送出去。',
    },
    params: [
      { name: 'container', type: 'HTMLElement', en: 'Where the panel goes. The panel is `position: absolute` and fills it, so the container needs a position (`position: relative`) and a size, or the panel has none.', zh: '面板要放的地方。面板是 `position: absolute`，會填滿它，所以容器要有定位（`position: relative`）和大小，不然面板就沒有大小。' },
      { name: 'layout', type: 'Object', en: 'The layout JSON (see [`validateLayout()`](#validateLayout)): pages, a grid, widgets. A bad layout throws an error that lists every problem.', zh: '版面 JSON（見 [`validateLayout()`](#validateLayout)）：頁面、格線、元件。版面有問題會丟出錯誤，列出每一個問題。' },
      { name: 'sink', type: 'Function', en: '`(name, value, info) => {}`, called for every signal a touch makes. `name` is like `surface/main/hue`, `value` is normalized 0..1 (an event is `info.pulse`, a string for a text box). When a widget\'s range is not 0..1, `info.raw` holds the unscaled value, and a second call follows with the name `…/raw`. [`signalSink()`](#signalSink) writes into a `Signals`; a phone passes one that calls `relay.set`.', zh: '`(name, value, info) => {}`，每一次觸碰產生訊號都會呼叫。`name` 像 `surface/main/hue`，`value` 是正規化的 0..1（事件是 `info.pulse`，文字框則是字串）。元件的範圍不是 0..1 的時候，`info.raw` 帶著沒縮放的值，接著還會再呼叫一次，名稱是 `…/raw`。[`signalSink()`](#signalSink) 會寫進 `Signals`，手機上則傳一個呼叫 `relay.set` 的函式。' },
      { name: 'haptics', type: 'Boolean', en: 'Buzz the phone briefly on a button, a toggle, a radio choice or a double-tap reset, where the browser can (Android Chrome). `false` turns it off.', zh: '在按下按鈕、切換開關、選了單選項目、雙擊重設的時候讓手機震一下，瀏覽器做得到的話（Android Chrome）。`false` 就關掉。' },
      { name: 'tabs', type: 'Boolean', en: 'Show a tab strip when the layout has more than one page. `false` hides it, and you switch with `setPage()`.', zh: '版面有一頁以上的時候，顯示分頁列。`false` 就隱藏，改用 `setPage()` 切換。' },
      { name: 'orientation', type: "'portrait' | 'landscape'", en: 'Force the orientation. Left out, it follows the container\'s shape (wider than tall is landscape) and changes when the container does.', zh: '強制指定方向。不給的話，它跟著容器的形狀走（寬大於高是橫向），容器改變它也會跟著改。' },
      { name: 'onPage', type: 'Function', en: '`(pageId) => {}`, when the page changes, and once at the start with the first page.', zh: '`(pageId) => {}`，換頁的時候呼叫，一開始也會用第一頁呼叫一次。' },
    ],
    description: [
      {
        en: 'Pass `new Surface(container, { layout, sink })` and a panel appears: faders, knobs, an XY pad, pads, a keyboard, whatever the layout names, each with its live number. Widgets are dumb on purpose. Fingers go in, named normalized signals come out of `sink`, and the surface never knows what the work is. Run it on the show page with [`signalSink()`](#signalSink), or on a phone with a sink that sends to the relay: the same layout works for both. A world\'s params can grow the whole layout by themselves with [`autoSurface()`](#autoSurface).',
        zh: '呼叫 `new Surface(container, { layout, sink })`，面板就出現了：推桿、旋鈕、XY 板、打擊墊、琴鍵，版面裡寫什麼就有什麼，每個都顯示即時的數字。元件刻意做得很笨：手指進去，有名字的正規化訊號從 `sink` 出來，面板完全不知道作品是什麼。在演出頁面上搭配 [`signalSink()`](#signalSink) 用，或在手機上搭配送去中繼的 sink 用：同一份版面兩邊都行。世界的參數也能用 [`autoSurface()`](#autoSurface) 自己長出整份版面。',
      },
      {
        en: 'The grid always fills the container and nothing scrolls. When the container is turned, the page is laid out again for the new orientation by [`resolvePage()`](#resolvePage): a `portrait` or `landscape` variant in the layout if there is one, else the base grid, else the same widgets packed again into half or double the columns. Touching a widget outlines it in its colour, and a double-tap on a fader or knob returns it to its default.',
        zh: '格線一定填滿容器，不會有任何捲動。容器轉向的時候，頁面會由 [`resolvePage()`](#resolvePage) 依新的方向重新排：版面裡有 `portrait` 或 `landscape` 的版本就用它，沒有就用基本格線，再不行就把同樣的元件重新擺進一半或兩倍的欄數。碰到元件時，它會用自己的顏色描邊，在推桿或旋鈕上連點兩下就回到預設值。',
      },
      {
        en: 'Runner to widget goes the other way: [`feedback(name, value)`](#Surface) moves a fader to follow the timeline, or fills a meter. A widget under a finger ignores feedback while it is touched and for about half a second after, so it does not fight the hand (a button only while it is held).',
        zh: '從演出端到元件是另一條路：`feedback(name, value)` 讓推桿跟著時間軸動，或把音量表填起來。手指碰著的元件，在被碰著的時候和放開後大約半秒內，會忽略 feedback，不跟手搶（按鈕則只有按住的時候）。',
      },
    ],
    needs: {
      en: 'A browser page (it builds DOM) and a container with a size. The panel injects its look once with [`injectTheme()`](#injectTheme). Nothing else to start: it works on the first touch. On a phone page, [`lockViewport()`](#lockViewport) stops the page from scrolling and zooming under the fingers.',
      zh: '要有瀏覽器頁面（它會建立 DOM），而且容器要有大小。面板會用 [`injectTheme()`](#injectTheme) 把它的外觀注入一次。不用另外啟動：第一次觸碰就能用。在手機頁面上，用 [`lockViewport()`](#lockViewport) 讓頁面不會在手指底下捲動或縮放。',
    },
    members: {
      setLayout: { en: '`setLayout(raw)`: rebuild the panel from a layout. Throws an `Error` that begins `invalid surface layout:` and lists every problem if [`validateLayout()`](#validateLayout) finds any. Keeps the current page when the new layout has one with the same id. Returns the surface.', zh: '`setLayout(raw)`：依版面重建面板。[`validateLayout()`](#validateLayout) 找得到問題的話，會丟出以 `invalid surface layout:` 開頭、列出每個問題的 `Error`。新版面有相同 id 的頁面時，會停留在目前那一頁。回傳面板本身。' },
      setPage: { en: '`setPage(id)`: show the page with this id, and call `onPage`.', zh: '`setPage(id)`：顯示這個 id 的頁面，並呼叫 `onPage`。' },
      feedback: { en: '`feedback(name, value)`: runner to widget. `name` is the full signal name such as `surface/main/level`, `value` is normalized 0..1. A name that no widget listens to is ignored.', zh: '`feedback(name, value)`：演出端對元件。`name` 是完整的訊號名稱，像 `surface/main/level`，`value` 是正規化的 0..1。沒有任何元件在聽的名稱會被忽略。' },
      widget: { en: '`widget(page, id)`: the widget object for a page id and a widget id, or `undefined`. Its element is `.el`.', zh: '`widget(page, id)`：某個頁面 id 與元件 id 對應的元件物件，找不到是 `undefined`。它的元素是 `.el`。' },
      disposeWidgets: { en: '`disposeWidgets()`: remove every widget and its listeners but keep the panel. `setLayout()` calls it first.', zh: '`disposeWidgets()`：移除所有元件和它們的監聽，但保留面板。`setLayout()` 會先呼叫它。' },
      dispose: { en: '`dispose()`: stop watching the container\'s size, remove the widgets and take the panel out of the page.', zh: '`dispose()`：不再監看容器的大小，移除元件，並把面板從頁面上拿掉。' },
    },
    notes: [
      {
        en: 'Public fields: `layout` (the normalized layout), `root` (the panel\'s element), `orientation`, `pageId`, `widgets` (a `Map` of `"page/id"` to widget), `sink`, `haptics`.',
        zh: '公開的欄位有 `layout`（正規化之後的版面）、`root`（面板的元素）、`orientation`、`pageId`、`widgets`（`"page/id"` 對應元件的 `Map`）、`sink`、`haptics`。',
      },
      {
        en: 'The constructor appends the panel to the container before it checks the layout, so a layout that throws there leaves an empty panel behind. Run [`validateLayout()`](#validateLayout) first if the layout comes from a file or a person.',
        zh: '建構函式在檢查版面之前就把面板加進容器了，所以版面在那裡丟出錯誤的話，會留下一個空的面板。版面來自檔案或使用者的話，請先跑 [`validateLayout()`](#validateLayout)。',
      },
    ],
    examples: [
      {
        code: `import { Surface } from '@openav/surface';

const box = document.getElementById('app');
box.style.cssText = 'position:relative;width:360px;height:220px';   // the panel fills its container

const out = document.createElement('pre');
box.after(out);
new Surface(box, {
  layout: { pages: [{ id: 'main', grid: { cols: 4, rows: 2 }, widgets: [
    { id: 'size', type: 'fader', label: 'Size', x: 0, y: 0, w: 1, h: 2, min: 1, max: 10, def: 4 },
    { id: 'pad', type: 'xy', x: 1, y: 0, w: 2, h: 2 },
    { id: 'go', type: 'button', label: 'Go', x: 3, y: 0, w: 1, h: 2 },
  ] }] },
  sink: (name, value, info) => {
    out.textContent = name + ' = ' + value + (info.raw !== undefined ? '  (raw ' + info.raw + ')' : '');
  },
});`,
        caption: { en: 'A dark panel with a fader, an XY pad and a button. Touch one and the line under it shows the signal it sent, for example surface/main/size = 0.75 (raw 7.75).', zh: '一個深色面板，有一支推桿、一塊 XY 板和一顆按鈕。碰其中一個，下面那行就顯示它送出的訊號，例如 surface/main/size = 0.75 (raw 7.75)。' },
      },
      {
        code: `import { Surface } from '@openav/surface';

const box = document.getElementById('app');
box.style.cssText = 'position:relative;width:360px;height:220px';

const surface = new Surface(box, {
  layout: { pages: [{ id: 'main', grid: { cols: 4, rows: 2 }, widgets: [
    { id: 'level', type: 'meter', label: 'Level', x: 0, y: 0, w: 1, h: 2 },
    { id: 'echo', type: 'fader', label: 'Echo', x: 1, y: 0, w: 1, h: 2 },
  ] }] },
  sink() {},
});

function frame(ms) {
  const v = 0.5 + 0.5 * Math.sin(ms / 500);
  surface.feedback('surface/main/level', v);       // the meter fills
  surface.feedback('surface/main/echo', 1 - v);    // the fader follows
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);`,
        caption: { en: 'The meter rises and falls with a sine wave and the fader moves the opposite way: the show sending values back to the phone with feedback().', zh: '音量表隨著正弦波起落，推桿朝相反方向動：這是演出端用 feedback() 把數值送回手機。' },
      },
      {
        code: `import { Surface } from '@openav/surface';

const box = document.getElementById('app');
box.style.cssText = 'position:relative;width:360px;height:220px';
const surface = new Surface(box, {
  layout: { pages: [{ id: 'a', widgets: [{ id: 'x', type: 'fader' }] }] },
  sink() {},
});

try {
  surface.setLayout({ pages: [{ id: 'a', widgets: [{ id: 'x', type: 'dial' }, { id: 'x', type: 'knob' }] }] });
} catch (e) {
  document.getElementById('app').after(Object.assign(document.createElement('pre'), { textContent: e.message }));
}`,
        caption: { en: 'A bad layout throws and lists every problem (an unknown type "dial", a duplicate id "x"); the panel that was already there stays as it was.', zh: '有問題的版面會丟出錯誤，並列出每個問題（不認得的類型「dial」、重複的 id「x」），原本的面板維持不變。' },
      },
    ],
    related: ['signalSink', 'validateLayout', 'autoSurface', 'resolvePage', 'injectTheme', 'lockViewport', 'WIDGET_TYPES', 'mountRemote'],
    keywords: {
      en: ['surface', 'control surface', 'touchosc', 'widgets', 'fader', 'knob', 'xy pad', 'pads', 'layout', 'phone controller', 'panel', 'touch', 'feedback'],
      zh: ['控制面板', 'touchosc', '元件', '推桿', '旋鈕', 'xy 板', '打擊墊', '版面', '手機控制器', '面板', '觸控', '回饋'],
    },
  },

  signalSink: {
    group: 'remote',
    summary: {
      en: 'Makes a `sink` for a `Surface` that writes straight into a `Signals` registry: for a panel on the same page as the show, with no phone and no relay.',
      zh: '做一個給 `Surface` 用的 `sink`，直接寫進 `Signals`：給跟演出在同一頁上的面板用，不需要手機，也不需要中繼。',
    },
    params: [
      { name: 'signals', type: 'Signals', en: 'The registry to write into (from `@openav/core`).', zh: '要寫進去的註冊表（來自 `@openav/core`）。' },
    ],
    returns: { type: 'Function', en: 'A `(name, value, info) => {}` to pass as `Surface`\'s `sink`.', zh: '一個 `(name, value, info) => {}`，傳給 `Surface` 的 `sink`。' },
    description: [
      {
        en: 'A name it has not met is declared first: `{ kind: \'pulse\' }` when `info.pulse` is set, otherwise `{ min: 0, max: 1 }`. Then a pulse fires with `signals.pulse()` and anything else is `signals.set()`. So a route in the mapper, `{ source: \'surface/main/hue\', target: \'hue\' }`, works whether the finger is on this page or on a phone.',
        zh: '還沒見過的名稱會先宣告：`info.pulse` 有設的話是 `{ kind: \'pulse\' }`，不然是 `{ min: 0, max: 1 }`。然後脈衝用 `signals.pulse()` 觸發，其他都是 `signals.set()`。所以映射器裡的路由 `{ source: \'surface/main/hue\', target: \'hue\' }`，不論手指在這個頁面上還是在手機上，都能運作。',
      },
      {
        en: 'It does no scaling: the `…/raw` signal that a widget with a range sends is filed like any other name, with the range 0..1 it was declared with, so ignore those or give them their own declaration.',
        zh: '它不做任何縮放：有範圍的元件送出的 `…/raw` 訊號，會跟其他名稱一樣歸檔，宣告的範圍是 0..1，所以請忽略它們，或自己另外宣告。',
      },
    ],
    examples: [
      {
        code: `import { signalSink } from '@openav/surface';
import { Signals } from '@openav/core';

const signals = new Signals();
const sink = signalSink(signals);

sink('surface/main/level', 0.4, {});               // a continuous value
sink('surface/main/go', 1, { pulse: true });       // an event

document.getElementById('app').innerHTML = [
  'level = ' + signals.get('surface/main/level') + ', kind ' + signals.meta.get('surface/main/level').kind,
  'go = ' + signals.get('surface/main/go') + ', kind ' + signals.meta.get('surface/main/go').kind,
].join('<br>');`,
        caption: { en: 'Prints "level = 0.4, kind continuous" and "go = 1, kind pulse": the sink declared each name the first time it saw it.', zh: '印出「level = 0.4, kind continuous」和「go = 1, kind pulse」：sink 第一次看到每個名稱時就替它宣告了。' },
      },
    ],
    related: ['Surface', 'bindSignals', 'fileSignal'],
    keywords: {
      en: ['sink', 'signals', 'same page', 'local surface', 'no relay', 'write signals'],
      zh: ['sink', '訊號', '同一頁', '本機面板', '不用中繼', '寫入訊號'],
    },
  },

  WIDGET_TYPES: {
    group: 'remote',
    summary: {
      en: 'The names of the 14 widget types a layout may use: fader, knob, encoder, button, toggle, xy, bank, radio, pads, keyboard, number, text, label, meter.',
      zh: '版面可以用的 14 種元件類型名稱：fader、knob、encoder、button、toggle、xy、bank、radio、pads、keyboard、number、text、label、meter。',
    },
    value: {
      type: 'string[]',
      en: 'The keys of [`DEFAULT_SIZE`](#DEFAULT_SIZE), in that order. [`validateLayout()`](#validateLayout) rejects any `type` that is not in it.',
      zh: '[`DEFAULT_SIZE`](#DEFAULT_SIZE) 的鍵，順序也一樣。[`validateLayout()`](#validateLayout) 會拒絕不在裡面的 `type`。',
    },
    description: [
      {
        en: 'Each widget publishes under `surface/<page>/<id>`, normalized 0..1; when its range is not 0..1 the unscaled value also goes out as `…/raw`. What each type sends:',
        zh: '每個元件都發布在 `surface/<page>/<id>` 底下，正規化成 0..1。範圍不是 0..1 的話，沒縮放的值也會以 `…/raw` 送出。各類型送出的東西：',
      },
      {
        en: '```text\nfader, knob, number   <id>\nbutton                 <id>  1 while held, 0 on release\ntoggle                 <id>  1 or 0\nencoder                <id> (phase 0..1, wraps) and <id>/delta (turns)\nxy                     <id>/x  <id>/y  <id>/down\nbank                   <id>/1 … <id>/N        (count, default 8)\nradio                  <id> = index / (n - 1), raw = index\npads                   <id>/hit {pad,row,col,vel}  and  <id>/<n> while held\nkeyboard               midi/note/on  midi/note/off  midi/cc/64\ntext                   <id>  a string, as a pulse\nlabel, meter           nothing: they only receive feedback\n```',
        zh: '```text\nfader, knob, number   <id>\nbutton                 <id>  1 while held, 0 on release\ntoggle                 <id>  1 or 0\nencoder                <id> (phase 0..1, wraps) and <id>/delta (turns)\nxy                     <id>/x  <id>/y  <id>/down\nbank                   <id>/1 … <id>/N        (count, default 8)\nradio                  <id> = index / (n - 1), raw = index\npads                   <id>/hit {pad,row,col,vel}  and  <id>/<n> while held\nkeyboard               midi/note/on  midi/note/off  midi/cc/64\ntext                   <id>  a string, as a pulse\nlabel, meter           nothing: they only receive feedback\n```\n\n[`signalNames()`](#signalNames) 可以替你的版面列出這些名稱。',
      },
      {
        en: 'Fields every widget accepts: `id`, `type`, `label`, `min`, `max`, `def`, `step`, `unit`, `color` (one of [`COLOR_NAMES`](#COLOR_NAMES)) and, for hand-written layouts, `target`, the param key that [`routesFromLayout()`](#routesFromLayout) turns into a route. Others by type: `orient` (`v`, `h` or `auto`) on a fader, `spring: true` on an XY pad, `count` and `labels` on a bank, `options` on a radio, `rows`, `cols` and `labels` on pads, `pulse` on a button.',
        zh: '每個元件都接受的欄位：`id`、`type`、`label`、`min`、`max`、`def`、`step`、`unit`、`color`（[`COLOR_NAMES`](#COLOR_NAMES) 其中之一），手寫版面還可以加 `target`，也就是 [`routesFromLayout()`](#routesFromLayout) 要變成路由的參數鍵。各類型另有：推桿的 `orient`（`v`、`h` 或 `auto`）、XY 板的 `spring: true`、bank 的 `count` 和 `labels`、radio 的 `options`、pads 的 `rows`、`cols` 和 `labels`。',
      },
    ],
    examples: [
      {
        code: `import { WIDGET_TYPES, DEFAULT_SIZE } from '@openav/surface';

document.getElementById('app').innerHTML = WIDGET_TYPES
  .map((t) => t + ' ' + DEFAULT_SIZE[t].w + '×' + DEFAULT_SIZE[t].h)
  .join('<br>');`,
        caption: { en: 'Lists the 14 types with their natural size in grid cells, from fader 1×4 to meter 1×4.', zh: '列出 14 種類型和它們在格線上的預設大小，從 fader 1×4 到 meter 1×4。' },
      },
    ],
    related: ['DEFAULT_SIZE', 'WIDGET_CLASSES', 'validateLayout', 'signalNames', 'COLOR_NAMES'],
    keywords: {
      en: ['widget types', 'fader', 'knob', 'encoder', 'button', 'toggle', 'xy', 'bank', 'radio', 'pads', 'keyboard', 'number', 'text', 'label', 'meter'],
      zh: ['元件類型', '推桿', '旋鈕', '無限旋鈕', '按鈕', '開關', 'xy', '推桿組', '單選', '打擊墊', '琴鍵', '數字框', '文字框', '標籤', '音量表'],
    },
  },

  DEFAULT_SIZE: {
    group: 'remote',
    summary: {
      en: 'The natural size of each widget type, in grid cells, as `{ w, h }`: a layout only has to give `x`, `y`, `w`, `h` when it cares.',
      zh: '每種元件類型在格線上的預設大小，格式是 `{ w, h }`（以格為單位）：版面只有在在意的時候才需要寫 `x`、`y`、`w`、`h`。',
    },
    value: {
      type: 'Object',
      en: 'Fourteen keys, one per type: fader 1×4, knob 2×2, encoder 2×2, button 2×1, toggle 2×1, xy 4×4, bank 4×4, radio 4×1, pads 4×4, keyboard 8×4, number 2×1, text 4×1, label 2×1, meter 1×4 (width × height).',
      zh: '十四個鍵，每種類型一個：fader 1×4、knob 2×2、encoder 2×2、button 2×1、toggle 2×1、xy 4×4、bank 4×4、radio 4×1、pads 4×4、keyboard 8×4、number 2×1、text 4×1、label 2×1、meter 1×4（寬 × 高）。',
    },
    description: [
      {
        en: 'A widget without a `w` or `h` takes the size of its type, held to the number of columns of the grid. [`autoArrange()`](#autoArrange) and [`resolvePage()`](#resolvePage) use it, and so does [`autoSurface()`](#autoSurface) when it counts how many widgets fit on a page. A type it does not know counts as 2×2.',
        zh: '沒寫 `w` 或 `h` 的元件，會用它的類型的大小，並限制在格線的欄數以內。[`autoArrange()`](#autoArrange) 和 [`resolvePage()`](#resolvePage) 會用到它，[`autoSurface()`](#autoSurface) 計算一頁放得下幾個元件的時候也是。不認得的類型當作 2×2。',
      },
    ],
    examples: [
      {
        code: `import { DEFAULT_SIZE } from '@openav/surface';

const { w, h } = DEFAULT_SIZE.knob;
document.getElementById('app').textContent = 'a knob is ' + w + ' cells wide and ' + h + ' tall; a fader is ' +
  DEFAULT_SIZE.fader.w + ' by ' + DEFAULT_SIZE.fader.h;`,
        caption: { en: 'Prints "a knob is 2 cells wide and 2 tall; a fader is 1 by 4".', zh: '印出「a knob is 2 cells wide and 2 tall; a fader is 1 by 4」。' },
      },
    ],
    related: ['WIDGET_TYPES', 'autoArrange', 'resolvePage'],
    keywords: {
      en: ['default size', 'widget size', 'grid cells', 'width height', 'w h'],
      zh: ['預設大小', '元件大小', '格', '寬高', 'w h'],
    },
  },

  WIDGET_CLASSES: {
    group: 'remote',
    summary: {
      en: 'The widget classes, one per type, that `Surface` builds from a layout: `WIDGET_CLASSES.fader`, `.knob`, `.xy` and so on (advanced).',
      zh: '`Surface` 依版面建立的元件類別，每種類型一個：`WIDGET_CLASSES.fader`、`.knob`、`.xy` 等等（進階）。',
    },
    value: {
      type: 'Object',
      en: 'An object with the same 14 keys as [`WIDGET_TYPES`](#WIDGET_TYPES), each a class: `new WIDGET_CLASSES[type](spec, ctx)`.',
      zh: '一個物件，鍵跟 [`WIDGET_TYPES`](#WIDGET_TYPES) 一樣有 14 個，每個值是一個類別：`new WIDGET_CLASSES[type](spec, ctx)`。',
    },
    description: [
      {
        en: 'Most pages never touch it: [`Surface`](#Surface) looks each `spec.type` up here. It is exported for code that wants a single widget without a whole panel. `spec` is the widget\'s entry of the layout (`{ id, type, label, min, max, … }`) and `ctx` is `{ page, out(name, value, info), haptic(ms) }`, where `out` is where the widget\'s signals go and `page` is the page id used in their names. A widget\'s element is `.el`; put it in the page yourself.',
        zh: '大部分頁面用不到它：[`Surface`](#Surface) 會在這裡查每個 `spec.type`。把它匯出來，是給只想要單一元件、不要整個面板的程式用的。`spec` 是元件在版面裡的那一項（`{ id, type, label, min, max, … }`），`ctx` 是 `{ page, out(name, value, info), haptic(ms) }`，`out` 就是元件的訊號送去的地方，`page` 是用在訊號名稱裡的頁面 id。元件的元素是 `.el`，要自己把它放進頁面。',
      },
      {
        en: 'Adding your own key here does not make a new layout type: [`validateLayout()`](#validateLayout) only accepts the names in [`WIDGET_TYPES`](#WIDGET_TYPES).',
        zh: '在這裡加你自己的鍵，並不會多出一種新的版面類型：[`validateLayout()`](#validateLayout) 只接受 [`WIDGET_TYPES`](#WIDGET_TYPES) 裡的名稱。',
      },
    ],
    notes: [
      {
        en: 'Advanced. The `keyboard` widget wraps `KeysPiano` from `@openav/keys`.',
        zh: '進階用法。`keyboard` 元件包著 `@openav/keys` 的 `KeysPiano`。',
      },
    ],
    examples: [
      {
        code: `import { WIDGET_CLASSES } from '@openav/surface';

const sent = [];
const ctx = { page: 'solo', out: (name, value) => sent.push(name + ' = ' + value), haptic() {} };
const toggle = new WIDGET_CLASSES.toggle({ id: 'mute', type: 'toggle', label: 'Mute' }, ctx);
document.getElementById('app').append(toggle.el);

toggle.set(true);    // what a tap does
toggle.set(false);
document.getElementById('app').append(Object.assign(document.createElement('pre'), { textContent: sent.join('\\n') }));`,
        caption: { en: 'A lone toggle on the page, and under it what it sent when it was switched on and off: surface/solo/mute = 1, then 0.', zh: '頁面上有一個單獨的開關，下面是它被打開、關掉時送出的訊號：surface/solo/mute = 1，然後是 0。' },
      },
    ],
    related: ['Surface', 'WIDGET_TYPES'],
    keywords: {
      en: ['widget classes', 'single widget', 'fader class', 'knob class', 'build a widget', 'component'],
      zh: ['元件類別', '單一元件', '推桿類別', '旋鈕類別', '建立元件', '元件'],
    },
  },

  validateLayout: {
    group: 'remote',
    summary: {
      en: 'Checks a layout and returns a list of readable problems; an empty list means it is fine.',
      zh: '檢查一份版面，回傳一串看得懂的問題清單，清單是空的就表示沒問題。',
    },
    params: [
      { name: 'layout', type: 'Object', en: 'The raw layout JSON.', zh: '原始的版面 JSON。' },
    ],
    returns: { type: 'string[]', en: 'One sentence per problem, with where it is (`pages[0].widgets[2]: unknown type "dial"`). `[]` when the layout is fine.', zh: '每個問題一句話，附上位置（`pages[0].widgets[2]: unknown type "dial"`）。版面沒問題就是 `[]`。' },
    description: [
      {
        en: 'It looks for: no object, or no non-empty `pages` array (it stops there); a page without an `id`, with a duplicate id or an id outside `A–Z a–z 0–9 _ -`; a widget whose `type` is not in [`WIDGET_TYPES`](#WIDGET_TYPES), without an `id`, with a duplicate id on its page or an id outside those characters (the id becomes part of a signal name); and a `min` equal to its `max`. It reports every problem it finds, not only the first.',
        zh: '它會檢查：不是物件、或沒有非空的 `pages` 陣列（到這裡就停），頁面沒有 `id`、id 重複、或 id 用了 `A–Z a–z 0–9 _ -` 以外的字元，元件的 `type` 不在 [`WIDGET_TYPES`](#WIDGET_TYPES) 裡、沒有 `id`、在同一頁 id 重複、或 id 用了那些以外的字元（id 會變成訊號名稱的一部分），還有 `min` 等於 `max`。它會報告找得到的每一個問題，不只是第一個。',
      },
      {
        en: 'It does not look at positions, grids or `target`s: a widget that overlaps another, or a `target` that is not a param, is not a problem here. [`Surface`](#Surface)\'s `setLayout()` runs it and throws with the list when it is not empty.',
        zh: '它不看位置、格線或 `target`：元件互相重疊、或 `target` 不是任何參數，在這裡都不算問題。[`Surface`](#Surface) 的 `setLayout()` 會跑它，清單不是空的就丟出錯誤。',
      },
    ],
    examples: [
      {
        code: `import { validateLayout } from '@openav/surface';

const good = validateLayout({ pages: [{ id: 'main', widgets: [{ id: 'size', type: 'fader' }] }] });
const bad = validateLayout({ pages: [{ id: 'main page', widgets: [
  { id: 'a', type: 'dial' }, { id: 'a', type: 'fader' }, { type: 'knob', min: 1, max: 1 },
] }] });
document.getElementById('app').innerHTML = ['good: ' + JSON.stringify(good), ...bad].join('<br>');`,
        caption: { en: 'Prints "good: []", then five problems for the bad layout: the page id, the unknown type, the duplicate id, the missing id and min equal to max.', zh: '印出「good: []」，然後是有問題的版面的五個問題：頁面 id、不認得的類型、重複的 id、缺少的 id、以及 min 等於 max。' },
      },
    ],
    related: ['normalizeLayout', 'Surface', 'WIDGET_TYPES'],
    keywords: {
      en: ['validate', 'layout', 'check layout', 'errors', 'problems', 'lint', 'layout json'],
      zh: ['驗證', '版面', '檢查版面', '錯誤', '問題', '版面 json'],
    },
  },

  normalizeLayout: {
    group: 'remote',
    summary: {
      en: 'Returns a copy of a layout with the defaults filled in: ids, titles, grids and the version. The input is not changed.',
      zh: '回傳一份補上預設值的版面複本：id、標題、格線和版本。原本的輸入不會被改動。',
    },
    params: [
      { name: 'raw', type: 'Object', en: 'The layout JSON. `undefined` or an object without pages gives a layout with no pages.', zh: '版面 JSON。`undefined` 或沒有 pages 的物件，會得到沒有任何頁面的版面。' },
    ],
    returns: { type: 'Object', en: '`{ version: 1, title, pages }` with every page and widget complete.', zh: '`{ version: 1, title, pages }`，每個頁面和元件都是完整的。' },
    description: [
      {
        en: 'A page without an `id` becomes `page1`, `page2` …; without a `title` it gets its id (or `Page 1`); without a `grid` it gets `{ cols: 8, rows: 6 }`. A widget without an `id` becomes its type and its position in the list, `fader1`; an id already used on the page gets `_` added until it is unique. Every other field is kept as it is. [`Surface`](#Surface) normalizes the layout it is given, and so do [`signalNames()`](#signalNames) and the show side of the remote.',
        zh: '沒有 `id` 的頁面會變成 `page1`、`page2` …，沒有 `title` 就用它的 id（或 `Page 1`），沒有 `grid` 就是 `{ cols: 8, rows: 6 }`。沒有 `id` 的元件會變成「類型加在清單中的位置」，像 `fader1`。在同一頁已經用過的 id 會一直加上 `_` 直到不重複。其他欄位原樣保留。[`Surface`](#Surface) 會把拿到的版面正規化，[`signalNames()`](#signalNames) 和遙控的演出端也一樣。',
      },
    ],
    notes: [
      {
        en: 'The default grid has 6 rows. [`autoSurface()`](#autoSurface) writes its own grids of 8 by 4, so this default only matters for layouts that leave the grid out.',
        zh: '預設格線是 6 列。[`autoSurface()`](#autoSurface) 自己寫的格線是 8 乘 4，所以這個預設值只對沒寫格線的版面有意義。',
      },
    ],
    examples: [
      {
        code: `import { normalizeLayout } from '@openav/surface';

const layout = normalizeLayout({ pages: [{ widgets: [{ type: 'fader' }, { type: 'fader', id: 'fader1' }, { type: 'knob' }] }] });
const page = layout.pages[0];
document.getElementById('app').innerHTML = [
  'page: ' + page.id + ' "' + page.title + '", grid ' + page.grid.cols + 'x' + page.grid.rows,
  'widgets: ' + page.widgets.map((w) => w.id).join(', '),
].join('<br>');`,
        caption: { en: 'Prints "page: page1 "Page 1", grid 8x6" and the widget ids fader1, fader1_ (the second fader1 was already taken), knob3.', zh: '印出「page: page1 "Page 1", grid 8x6」和元件 id：fader1、fader1_（第二個 fader1 已經被用了）、knob3。' },
      },
    ],
    related: ['validateLayout', 'signalNames', 'resolvePage', 'Surface'],
    keywords: {
      en: ['normalize', 'defaults', 'fill in', 'layout', 'ids', 'grid default', 'copy'],
      zh: ['正規化', '預設值', '補齊', '版面', 'id', '預設格線', '複本'],
    },
  },

  autoArrange: {
    group: 'remote',
    summary: {
      en: 'Packs widgets into a grid first-fit, row by row, and never overlaps; `fixed` placements are kept and block their cells. Returns the placements and the rows used.',
      zh: '把元件依序排進格線，一列一列找第一個放得下的位置，絕不重疊，`fixed` 的位置會保留，並擋住它們的格子。回傳各元件的位置和用掉的列數。',
    },
    params: [
      { name: 'items', type: '{ id, w, h }[]', en: 'What to place, in order. Every item needs a numeric `w` and `h` in cells, at least 1. A `w` wider than the grid is cut to `cols`.', zh: '要擺的東西，依序排。每一項都要有數字的 `w` 和 `h`（單位是格，至少 1）。`w` 比格線寬的話會被截成 `cols`。' },
      { name: 'cols', type: 'Number', en: 'How many columns the grid has.', zh: '格線有幾欄。' },
      { name: 'fixed', type: '{ id, x, y, w, h }[]', optional: true, en: 'Placements that are already decided. They come first in the result and the other items go around them.', zh: '已經決定的位置。它們會排在結果的最前面，其他項目繞著它們擺。' },
    ],
    returns: { type: '{ placements, rows }', en: '`placements` is a list of `{ id, x, y, w, h }` (the fixed ones first), `rows` is how many rows they fill.', zh: '`placements` 是 `{ id, x, y, w, h }` 的清單（固定的排前面），`rows` 是它們佔了幾列。' },
    description: [
      {
        en: 'Each item takes the first free spot found by scanning left to right, then top to bottom: what a person does laying out a controller. The grid grows downward as far as it must, so `rows` is a result, not a limit. [`resolvePage()`](#resolvePage) uses it for widgets without a position and for the automatic reflow.',
        zh: '每個項目都從左到右、再從上到下找第一個空位放進去：就是人在排控制器時的做法。格線需要多長就往下長多長，所以 `rows` 是結果，不是上限。[`resolvePage()`](#resolvePage) 用它來排沒有位置的元件，也用在自動重排。',
      },
    ],
    notes: [
      {
        en: 'An item with no `w` (or a `w` that is not a number) never finds a spot and the function never returns. Give every item a `w` and an `h`; [`DEFAULT_SIZE`](#DEFAULT_SIZE) has the natural size of each widget type.',
        zh: '沒有 `w`（或 `w` 不是數字）的項目永遠找不到位置，函式也就永遠不會結束。每個項目都要給 `w` 和 `h`。[`DEFAULT_SIZE`](#DEFAULT_SIZE) 有每種元件類型的預設大小。',
      },
    ],
    examples: [
      {
        code: `import { autoArrange } from '@openav/surface/layout';

const { placements, rows } = autoArrange([
  { id: 'a', w: 4, h: 2 }, { id: 'b', w: 4, h: 2 }, { id: 'c', w: 8, h: 1 }, { id: 'd', w: 2, h: 2 },
], 8);
document.getElementById('app').innerHTML = placements
  .map((p) => p.id + ': x ' + p.x + ', y ' + p.y + ', ' + p.w + '×' + p.h).join('<br>') + '<br>rows: ' + rows;`,
        caption: { en: 'a and b share the first row, c takes a full row, d goes below: rows is 5.', zh: 'a 和 b 共用第一列，c 佔滿一整列，d 排在下面：rows 是 5。' },
      },
      {
        code: `import { autoArrange } from '@openav/surface/layout';

// a button that must stay at the top left; the new knob goes around it
const { placements } = autoArrange(
  [{ id: 'knob', w: 2, h: 1 }],
  4,
  [{ id: 'go', x: 0, y: 0, w: 2, h: 1 }],
);
document.getElementById('app').textContent = placements.map((p) => p.id + ' at ' + p.x + ',' + p.y).join('   ');`,
        caption: { en: 'Prints "go at 0,0   knob at 2,0": the fixed placement comes first and the knob takes the first free cells.', zh: '印出「go at 0,0   knob at 2,0」：固定的位置排在最前面，旋鈕拿第一組空的格子。' },
      },
    ],
    related: ['resolvePage', 'stretchRows', 'DEFAULT_SIZE'],
    keywords: {
      en: ['auto arrange', 'pack', 'grid', 'first fit', 'layout algorithm', 'place widgets', 'no overlap'],
      zh: ['自動排列', '打包', '格線', '第一個放得下', '排版演算法', '擺放元件', '不重疊'],
    },
  },

  resolvePage: {
    group: 'remote',
    summary: {
      en: 'Works out where every widget of one page goes for one orientation: the grid and a cell for each widget, and which rule produced it.',
      zh: '算出某一頁在某個方向下每個元件要放哪裡：格線，以及每個元件的格子，還有是哪一條規則排出來的。',
    },
    params: [
      { name: 'page', type: 'Object', en: 'One page of a layout: `{ grid, widgets, portrait?, landscape? }`.', zh: '版面中的一頁：`{ grid, widgets, portrait?, landscape? }`。' },
      { name: 'orientation', type: "'portrait' | 'landscape'", en: 'Which way the screen is held.', zh: '螢幕怎麼拿。' },
    ],
    returns: { type: '{ grid, placements, source }', en: '`grid` is `{ cols, rows }`, `placements` a list of `{ id, x, y, w, h }`, `source` is `\'explicit\'`, `\'base\'` or `\'reflow\'`.', zh: '`grid` 是 `{ cols, rows }`，`placements` 是 `{ id, x, y, w, h }` 的清單，`source` 是 `\'explicit\'`、`\'base\'` 或 `\'reflow\'`。' },
    description: [
      {
        en: 'A phone gets turned, so a layout has to survive it. The rules, in order: 1. If the page has a `portrait` or `landscape` entry for this orientation, use its `grid` and its `place` (`{ widgetId: { x, y, w, h } }`); widgets it does not mention keep their own position, or are packed into free cells (`source` is `\'explicit\'`). 2. Else, if the base grid has the right shape (more columns than rows is landscape) and every widget has an `x` and a `y`, use the base (`\'base\'`). 3. Else reflow: the same widgets in reading order, packed again into half the columns (portrait, at least 2) or twice as many (landscape, up to 16), with a lone last row stretched to the edge by [`stretchRows()`](#stretchRows) (`\'reflow\'`).',
        zh: '手機會被轉來轉去，所以版面一定要撐得住。規則依序是：1. 頁面針對這個方向有 `portrait` 或 `landscape` 的項目，就用它的 `grid` 和 `place`（`{ 元件 id: { x, y, w, h } }`）。它沒提到的元件保留自己的位置，或被打包進空的格子（`source` 是 `\'explicit\'`）。2. 否則，基本格線的形狀對（欄數多於列數是橫向）、而且每個元件都有 `x` 和 `y`，就用基本格線（`\'base\'`）。3. 否則重排：同樣的元件依閱讀順序，重新打包進一半的欄數（直向，至少 2 欄）或兩倍的欄數（橫向，最多 16 欄），最後孤零零的一列由 [`stretchRows()`](#stretchRows) 拉到邊緣（`\'reflow\'`）。',
      },
      {
        en: 'Rows are a count, not pixels, so the result always fills the screen and nothing scrolls. A widget without `w` and `h` takes the size of its type from [`DEFAULT_SIZE`](#DEFAULT_SIZE). [`Surface`](#Surface) calls this for every page each time the orientation changes.',
        zh: '列數是個數，不是像素，所以結果永遠填滿螢幕，不會捲動。沒有 `w` 和 `h` 的元件，會用 [`DEFAULT_SIZE`](#DEFAULT_SIZE) 裡它的類型的大小。每次方向改變，[`Surface`](#Surface) 都會對每一頁呼叫它。',
      },
    ],
    examples: [
      {
        code: `import { resolvePage } from '@openav/surface/layout';

// eight faders in a row: right for a landscape screen, too wide for a portrait one
const page = {
  grid: { cols: 8, rows: 4 },
  widgets: Array.from({ length: 8 }, (_, i) => ({ id: 'f' + i, type: 'fader', x: i, y: 0, w: 1, h: 4 })),
};
const out = ['landscape', 'portrait'].map((o) => {
  const r = resolvePage(page, o);
  return o + ': ' + r.source + ', ' + r.grid.cols + ' columns x ' + r.grid.rows + ' rows';
});
document.getElementById('app').innerHTML = out.join('<br>');`,
        caption: { en: 'Prints "landscape: base, 8 columns x 4 rows" and "portrait: reflow, 4 columns x 8 rows": turned upright, the eight faders become two rows of four.', zh: '印出「landscape: base, 8 columns x 4 rows」和「portrait: reflow, 4 columns x 8 rows」：轉成直的之後，八支推桿變成兩列、每列四支。' },
      },
      {
        code: `import { resolvePage } from '@openav/surface/layout';

// a page that says where things go when the phone is upright
const page = {
  grid: { cols: 8, rows: 4 },
  widgets: [
    { id: 'a', type: 'fader', x: 0, y: 0, w: 1, h: 4 },
    { id: 'b', type: 'knob', x: 1, y: 0 },
    { id: 'c', type: 'button' },
  ],
  portrait: { grid: { cols: 4, rows: 6 }, place: { a: { x: 3, y: 0, w: 1, h: 6 } } },
};
const r = resolvePage(page, 'portrait');
document.getElementById('app').innerHTML = [r.source, ...r.placements.map((p) => p.id + ': ' + p.x + ',' + p.y + ' ' + p.w + '×' + p.h)].join('<br>');`,
        caption: { en: 'Prints "explicit": a goes where the portrait entry says, the knob and the button (which have no place) fill the free cells.', zh: '印出「explicit」：a 照 portrait 項目寫的位置放，旋鈕和按鈕（沒有位置）填進空的格子。' },
      },
    ],
    related: ['autoArrange', 'stretchRows', 'orientationOf', 'gridOrientation', 'normalizeLayout', 'Surface'],
    keywords: {
      en: ['resolve page', 'orientation', 'portrait', 'landscape', 'reflow', 'responsive', 'grid', 'placements', 'rotate phone'],
      zh: ['解析頁面', '方向', '直向', '橫向', '重排', '響應式', '格線', '位置', '轉手機'],
    },
  },

  stretchRows: {
    group: 'remote',
    summary: {
      en: 'Stretches a last row that stops short to the edge of the grid: five faders in four columns leave one lonely fader, and this makes it four columns wide.',
      zh: '把停在半途的最後一列拉到格線邊緣：四欄裡放五支推桿會剩下一支孤零零的，這個函式把它拉成四欄寬。',
    },
    params: [
      { name: 'placements', type: '{ id, x, y, w, h }[]', en: 'Placements, for example from [`autoArrange()`](#autoArrange). Not changed: copies come back.', zh: '位置清單，例如來自 [`autoArrange()`](#autoArrange)。不會被改動，回傳的是複本。' },
      { name: 'cols', type: 'Number', en: 'How many columns the grid has.', zh: '格線有幾欄。' },
    ],
    returns: { type: 'Object[]', en: 'The placements, with the short rows widened.', zh: '位置清單，短的列已經加寬。' },
    description: [
      {
        en: 'A row is stretched only when it is safe: its widgets are all the same height, side by side with no gaps from the left edge, and nothing else sits to their right. The extra columns are dealt out one at a time from left to right, so a short row of three in four columns gives the first widget two columns. A row that does not qualify is left alone, and nothing ever overlaps. [`resolvePage()`](#resolvePage) calls it at the end of a reflow.',
        zh: '只有安全的時候才會拉長一列：它的元件高度都一樣、從左邊緣開始一個接一個沒有空隙、右邊也沒有別的東西。多出來的欄數從左到右一欄一欄分下去，所以四欄裡只有三個元件的短列，第一個元件會拿到兩欄。不符合條件的列就不動，也絕不會重疊。[`resolvePage()`](#resolvePage) 在重排的最後會呼叫它。',
      },
    ],
    notes: [
      { en: 'Advanced. You rarely call it yourself.', zh: '進階用法。通常不用自己呼叫。' },
    ],
    examples: [
      {
        code: `import { autoArrange, stretchRows } from '@openav/surface/layout';

const five = autoArrange(Array.from({ length: 5 }, (_, i) => ({ id: 'f' + i, w: 1, h: 4 })), 4).placements;
const stretched = stretchRows(five, 4);
const show = (list) => list.map((p) => p.id + ' w' + p.w).join(', ');
document.getElementById('app').innerHTML = 'before: ' + show(five) + '<br>after: ' + show(stretched);`,
        caption: { en: 'Prints f0 to f3 at width 1 both times, and f4 going from width 1 to width 4.', zh: '印出 f0 到 f3 的寬度前後都是 1，而 f4 的寬度從 1 變成 4。' },
      },
    ],
    related: ['autoArrange', 'resolvePage'],
    keywords: {
      en: ['stretch', 'last row', 'fill row', 'lonely widget', 'reflow', 'grid'],
      zh: ['拉長', '最後一列', '填滿一列', '孤單的元件', '重排', '格線'],
    },
  },

  orientationOf: {
    group: 'remote',
    summary: {
      en: 'Says whether a box is `\'landscape\'` or `\'portrait\'` from its width and height; a square counts as landscape.',
      zh: '從寬和高判斷一個框是 `\'landscape\'`（橫向）還是 `\'portrait\'`（直向），正方形算橫向。',
    },
    params: [
      { name: 'w', type: 'Number', en: 'The width, in any unit.', zh: '寬，什麼單位都可以。' },
      { name: 'h', type: 'Number', en: 'The height, in the same unit.', zh: '高，單位跟寬一樣。' },
    ],
    returns: { type: "'landscape' | 'portrait'", en: '`\'landscape\'` when `w >= h`, else `\'portrait\'`.', zh: '`w >= h` 是 `\'landscape\'`，否則是 `\'portrait\'`。' },
    description: [
      {
        en: '[`Surface`](#Surface) calls it with the size of its container, not the size of the screen, so a panel in a half-width pane can be portrait while the phone is landscape. Use [`gridOrientation()`](#gridOrientation) for the shape of a grid.',
        zh: '[`Surface`](#Surface) 傳給它的是容器的大小，不是螢幕的大小，所以放在半寬窗格裡的面板可以是直向，而手機本身是橫向。要判斷格線的形狀，用 [`gridOrientation()`](#gridOrientation)。',
      },
    ],
    examples: [
      {
        code: `import { orientationOf } from '@openav/surface/layout';

document.getElementById('app').innerHTML = [[844, 390], [390, 844], [500, 500]]
  .map(([w, h]) => w + ' x ' + h + ': ' + orientationOf(w, h)).join('<br>');`,
        caption: { en: 'Prints landscape for 844 x 390, portrait for 390 x 844, and landscape for the square.', zh: '印出 844 x 390 是 landscape、390 x 844 是 portrait，正方形是 landscape。' },
      },
    ],
    related: ['gridOrientation', 'resolvePage', 'Surface'],
    keywords: {
      en: ['orientation', 'portrait', 'landscape', 'width height', 'aspect', 'phone rotation'],
      zh: ['方向', '直向', '橫向', '寬高', '長寬比', '手機轉向'],
    },
  },

  gridOrientation: {
    group: 'remote',
    summary: {
      en: 'Says whether a grid `{ cols, rows }` is `\'landscape\'` (at least as many columns as rows) or `\'portrait\'`.',
      zh: '判斷格線 `{ cols, rows }` 是 `\'landscape\'`（欄數不少於列數）還是 `\'portrait\'`。',
    },
    params: [
      { name: 'g', type: '{ cols, rows }', en: 'The grid.', zh: '格線。' },
    ],
    returns: { type: "'landscape' | 'portrait'", en: '`\'landscape\'` when `g.cols >= g.rows`, else `\'portrait\'`.', zh: '`g.cols >= g.rows` 是 `\'landscape\'`，否則是 `\'portrait\'`。' },
    description: [
      {
        en: '[`resolvePage()`](#resolvePage) compares it with the orientation of the screen: a base grid of 8 by 4 is used as it is on a landscape screen and reflowed on a portrait one.',
        zh: '[`resolvePage()`](#resolvePage) 會拿它跟螢幕的方向比：8 乘 4 的基本格線在橫向螢幕上直接用，在直向螢幕上就重排。',
      },
    ],
    examples: [
      {
        code: `import { gridOrientation } from '@openav/surface/layout';

document.getElementById('app').innerHTML = [{ cols: 8, rows: 4 }, { cols: 4, rows: 8 }, { cols: 4, rows: 4 }]
  .map((g) => g.cols + ' x ' + g.rows + ': ' + gridOrientation(g)).join('<br>');`,
        caption: { en: 'Prints landscape for 8 x 4, portrait for 4 x 8, and landscape for 4 x 4.', zh: '印出 8 x 4 是 landscape、4 x 8 是 portrait、4 x 4 是 landscape。' },
      },
    ],
    related: ['orientationOf', 'resolvePage'],
    keywords: {
      en: ['grid orientation', 'portrait', 'landscape', 'cols rows', 'grid shape'],
      zh: ['格線方向', '直向', '橫向', '欄 列', '格線形狀'],
    },
  },

  signalNames: {
    group: 'remote',
    summary: {
      en: 'Lists every signal name a layout can publish, so a mapping screen, a doc or a test can show them without touching the panel.',
      zh: '列出一份版面能發布的每一個訊號名稱，讓映射畫面、文件或測試不用碰面板就能列出它們。',
    },
    params: [
      { name: 'layout', type: 'Object', en: 'The layout JSON (it is normalized first).', zh: '版面 JSON（會先正規化）。' },
    ],
    returns: { type: 'string[]', en: 'Unique names such as `surface/main/hue`, `surface/main/pad/x`, `midi/note/on`, in page and widget order.', zh: '不重複的名稱，像 `surface/main/hue`、`surface/main/pad/x`、`midi/note/on`，依頁面和元件的順序。' },
    description: [
      {
        en: 'It follows the table in [`WIDGET_TYPES`](#WIDGET_TYPES): an XY pad gives `/x`, `/y`, `/down`; a bank gives `/1` to `/count`; pads give `/hit` and `/0` to `/<rows × cols − 1>`; an encoder gives its name and `/delta`; a keyboard gives `midi/note/on`, `midi/note/off`, `midi/cc/64` and `midi/virtual`; a label or a meter gives nothing. The `…/raw` names that a widget with a range also sends are not in the list.',
        zh: '它依照 [`WIDGET_TYPES`](#WIDGET_TYPES) 裡的表：XY 板給 `/x`、`/y`、`/down`，bank 給 `/1` 到 `/count`，pads 給 `/hit` 和 `/0` 到 `/<列數 × 欄數 − 1>`，encoder 給它自己的名稱和 `/delta`，keyboard 給 `midi/note/on`、`midi/note/off`、`midi/cc/64` 和 `midi/virtual`，label 和 meter 什麼都不給。有範圍的元件另外送的 `…/raw` 名稱不在清單裡。',
      },
    ],
    examples: [
      {
        code: `import { signalNames } from '@openav/surface/layout';

const names = signalNames({ pages: [{ id: 'main', widgets: [
  { id: 'hue', type: 'knob' },
  { id: 'pos', type: 'xy' },
  { id: 'mix', type: 'bank', count: 2 },
  { id: 'title', type: 'label' },
] }] });
document.getElementById('app').innerHTML = names.join('<br>');`,
        caption: { en: 'Prints surface/main/hue, then pos/x, pos/y, pos/down, then mix/1 and mix/2: the label gives nothing.', zh: '印出 surface/main/hue，然後是 pos/x、pos/y、pos/down，再來是 mix/1 和 mix/2：label 什麼都不給。' },
      },
    ],
    related: ['WIDGET_TYPES', 'normalizeLayout', 'routesFromLayout'],
    keywords: {
      en: ['signal names', 'list signals', 'layout signals', 'outputs', 'what does it publish'],
      zh: ['訊號名稱', '列出訊號', '版面訊號', '輸出', '會發布什麼'],
    },
  },

  widgetTypeFor: {
    group: 'remote',
    summary: {
      en: 'Picks the widget type for one param declaration: a button for a pulse, a toggle, a radio, a fader or a knob.',
      zh: '替一個參數宣告挑元件類型：脈衝是按鈕，其他是開關、單選、推桿或旋鈕。',
    },
    params: [
      { name: 'p', type: 'Object', en: 'A param: `{ key, min?, max?, step?, pulse?, surface? }`.', zh: '一個參數：`{ key, min?, max?, step?, pulse?, surface? }`。' },
      { name: 'continuousCount', type: 'Number', optional: true, en: 'How many continuous params the panel has in all. More than 6 turns faders into knobs.', zh: '整個面板一共有幾個連續參數。超過 6 個，推桿就改成旋鈕。' },
      { name: 'style', type: "'auto' | 'fader' | 'knob'", optional: true, en: 'Force faders or knobs for the continuous params.', zh: '連續參數強制用推桿或旋鈕。' },
    ],
    returns: { type: 'String', en: 'One of the names in [`WIDGET_TYPES`](#WIDGET_TYPES).', zh: '[`WIDGET_TYPES`](#WIDGET_TYPES) 裡的其中一個名稱。' },
    description: [
      {
        en: 'The rules, first match wins: a `surface: { type }` hint on the param; `pulse` is a `button`; `step: 1` over a range of 1 (two values) is a `toggle`; `step: 1` over a range of 2 to 6 (three to seven values) is a `radio`; `style` `\'knob\'` or `\'fader\'` as asked; otherwise a `fader`, or a `knob` when `continuousCount` is above 6. A missing `min` is 0 and a missing `max` is 1. [`autoSurface()`](#autoSurface) calls it for every param.',
        zh: '規則依序比對，第一個符合的就用：參數上有 `surface: { type }` 提示就照它，`pulse` 是 `button`，`step: 1` 而範圍是 1（兩個值）是 `toggle`，`step: 1` 而範圍是 2 到 6（三到七個值）是 `radio`，`style` 要求 `\'knob\'` 或 `\'fader\'` 就照辦，其他是 `fader`，`continuousCount` 超過 6 時是 `knob`。沒寫 `min` 當 0，沒寫 `max` 當 1。[`autoSurface()`](#autoSurface) 會對每個參數呼叫它。',
      },
    ],
    examples: [
      {
        code: `import { widgetTypeFor } from '@openav/surface/auto';

const params = [
  { key: 'hue', min: 0, max: 360 },
  { key: 'mode', min: 0, max: 3, step: 1 },
  { key: 'mirror', min: 0, max: 1, step: 1 },
  { key: 'burst', pulse: true },
];
const rows = params.map((p) => p.key + ' → ' + widgetTypeFor(p));
rows.push('hue with 9 continuous params → ' + widgetTypeFor(params[0], { continuousCount: 9 }));
document.getElementById('app').innerHTML = rows.join('<br>');`,
        caption: { en: 'Prints hue → fader, mode → radio, mirror → toggle, burst → button, and a knob for hue once the panel has nine continuous params.', zh: '印出 hue → fader、mode → radio、mirror → toggle、burst → button，以及面板有九個連續參數時，hue 變成旋鈕。' },
      },
    ],
    related: ['autoSurface', 'WIDGET_TYPES'],
    keywords: {
      en: ['widget type', 'param to widget', 'fader or knob', 'toggle', 'radio', 'button', 'auto choose'],
      zh: ['元件類型', '參數轉元件', '推桿或旋鈕', '開關', '單選', '按鈕', '自動選擇'],
    },
  },

  autoSurface: {
    group: 'remote',
    summary: {
      en: 'Turns a world\'s params into a control panel: a layout, the routes that drive the params, and the bindings for echoing values back.',
      zh: '把世界的參數變成控制面板：一份版面、驅動參數的路由，以及把數值回送用的綁定。',
    },
    params: [
      { name: 'params', type: 'Object[]', en: 'The param declarations: `{ key, label?, min, max, def, step?, pulse?, group?, options?, surface? }`. `surface: { type, color, label }` on a param overrides the choice.', zh: '參數宣告：`{ key, label?, min, max, def, step?, pulse?, group?, options?, surface? }`。參數上的 `surface: { type, color, label }` 可以蓋過自動的選擇。' },
      { name: 'perPage', type: 'Number', optional: true, en: 'How much fits on a page, counted in weights: a fader or a meter weighs 1, an XY pad 4, anything else 2. The default 8 is eight faders, four knobs or two XY pads. A page that scrolls is a page that fails, so a full page starts the next.', zh: '一頁放得下多少，以權重計算：推桿或音量表算 1，XY 板算 4，其他都算 2。預設的 8 就是八支推桿、四個旋鈕或兩塊 XY 板。要捲動的頁面就是失敗的頁面，所以滿了就開下一頁。' },
      { name: 'style', type: "'auto' | 'fader' | 'knob'", optional: true, en: 'Faders or knobs for the continuous params. `\'auto\'` picks faders up to six, knobs beyond.', zh: '連續參數用推桿還是旋鈕。`\'auto\'` 六個以內用推桿，超過就用旋鈕。' },
      { name: 'pairs', type: 'string[][]', optional: true, en: 'Pairs of param keys to drive with one XY pad: `[[\'cx\', \'cy\']]`. The first key is x and the second is y.', zh: '要用同一塊 XY 板驅動的參數鍵配對：`[[\'cx\', \'cy\']]`。第一個鍵是 x，第二個是 y。' },
      { name: 'meters', type: 'string[]', optional: true, en: 'Param keys to also show as read-only meters, on a page called Meters.', zh: '另外要顯示成唯讀音量表的參數鍵，放在一頁叫 Meters 的頁面。' },
      { name: 'smooth', type: 'Number', optional: true, en: 'Seconds of smoothing on the continuous routes, to hide the steps of a 30 Hz network (zipper noise). Pulses, toggles and radios are never smoothed.', zh: '連續路由的平滑秒數，用來遮住 30 Hz 網路造成的階梯感（拉鍊雜訊）。脈衝、開關和單選不會被平滑。' },
      { name: 'title', type: 'String', optional: true, en: 'The layout\'s title.', zh: '版面的標題。' },
    ],
    returns: { type: '{ layout, routes, bindings }', en: '`layout` is a layout JSON for [`Surface`](#Surface). `routes` is a list of mapper routes `{ source, target, inMin, inMax, curve, smooth, outMin, outMax }`, from `surface/<page>/<id>` to each param. `bindings` is `{ param, name, page, widget, min, max, readonly? }` for [`feedbackFor()`](#feedbackFor).', zh: '`layout` 是給 [`Surface`](#Surface) 用的版面 JSON。`routes` 是映射器路由的清單 `{ source, target, inMin, inMax, curve, smooth, outMin, outMax }`，從 `surface/<page>/<id>` 到各個參數。`bindings` 是給 [`feedbackFor()`](#feedbackFor) 用的 `{ param, name, page, widget, min, max, readonly? }`。' },
    description: [
      {
        en: 'This is how a world that declares what it can be performed with gets a phone panel for free: `const { layout, routes, bindings } = autoSurface(world.params)`, then `routes.forEach((r) => mapper.addRoute(r))` and `new Surface(el, { layout, sink })`. Each param becomes the widget [`widgetTypeFor()`](#widgetTypeFor) picks. Each `group` of params gets its own page (a param without a group goes on `main`), long groups continue on `main2`, `main3` …, and a pair from `pairs` becomes one XY pad with two routes, `…/x` and `…/y`.',
        zh: '一個宣告了「可以拿什麼來演奏」的世界，就這樣免費得到手機面板：`const { layout, routes, bindings } = autoSurface(world.params)`，再 `routes.forEach((r) => mapper.addRoute(r))` 和 `new Surface(el, { layout, sink })`。每個參數變成 [`widgetTypeFor()`](#widgetTypeFor) 挑的元件。每個 `group` 各有一頁（沒有 group 的參數放在 `main`），太長的群組接著放到 `main2`、`main3` …，`pairs` 裡的一對會變成一塊有兩條路由（`…/x` 和 `…/y`）的 XY 板。',
      },
      {
        en: 'Widget ids are the param keys (anything outside `A–Z a–z 0–9 _ -` becomes `_`), colours go round cyan, amber, magenta, lime, violet, coral, and a radio\'s `options` come from the param or are the numbers. A pulse param gets no binding, since there is no value to show. The routes already scale the normalized signal to the param\'s `min` and `max`. A world that comes with its own layout uses [`routesFromLayout()`](#routesFromLayout) instead.',
        zh: '元件的 id 就是參數鍵（`A–Z a–z 0–9 _ -` 以外的字元會變成 `_`），顏色依序輪流用 cyan、amber、magenta、lime、violet、coral，radio 的 `options` 來自參數，沒有就用數字。脈衝參數沒有 binding，因為沒有值可以顯示。路由已經把正規化的訊號換算成參數的 `min` 和 `max`。自己帶版面的世界，改用 [`routesFromLayout()`](#routesFromLayout)。',
      },
    ],
    examples: [
      {
        code: `import { autoSurface } from '@openav/surface/auto';

const params = [
  { key: 'hue', min: 0, max: 360, def: 200 },
  { key: 'size', min: 1, max: 10, def: 4 },
  { key: 'mode', min: 0, max: 3, step: 1, def: 1 },
  { key: 'burst', pulse: true },
];
const { layout, routes } = autoSurface(params, { title: 'Bloom' });
document.getElementById('app').innerHTML = [
  layout.pages.map((p) => p.id + ': ' + p.widgets.map((w) => w.id + ' ' + w.type).join(', ')).join('<br>'),
  routes.map((r) => r.source + ' → ' + r.target + (r.smooth ? ' (smooth ' + r.smooth + ')' : '')).join('<br>'),
].join('<br><br>');`,
        caption: { en: 'Prints the one page main with a fader for hue and size, a radio for mode and a button for burst, then the four routes, smoothed by 0.04 s except the radio and the button.', zh: '印出一頁 main，有 hue 和 size 的推桿、mode 的單選、burst 的按鈕，然後是四條路由，除了單選和按鈕之外都平滑 0.04 秒。' },
      },
      {
        code: `import { autoSurface } from '@openav/surface/auto';

const params = [
  { key: 'cx', min: 0, max: 1, def: 0.5 }, { key: 'cy', min: 0, max: 1, def: 0.5 },
  { key: 'density', min: 0, max: 100, def: 20 },
  { key: 'glow', min: 0, max: 1, def: 0.3, group: 'look' },
];
const { layout, bindings } = autoSurface(params, { pairs: [['cx', 'cy']], meters: ['density'] });
document.getElementById('app').innerHTML = [
  layout.pages.map((p) => p.id + ' (' + p.title + '): ' + p.widgets.map((w) => w.id + ' ' + w.type).join(', ')).join('<br>'),
  'bindings: ' + bindings.map((b) => b.param + (b.readonly ? ' (read-only)' : '')).join(', '),
].join('<br><br>');`,
        caption: { en: 'cx and cy share one XY pad, density is a fader and also a read-only meter on its own page, and glow, in group look, gets a page of its own.', zh: 'cx 和 cy 共用一塊 XY 板，density 是推桿、同時也是自己那一頁上的唯讀音量表，group 是 look 的 glow 另外有一頁。' },
      },
      {
        code: `import { autoSurface } from '@openav/surface/auto';

// twenty params do not fit on one page: more than six continuous ones become knobs, four to a page
const params = Array.from({ length: 20 }, (_, i) => ({ key: 'p' + i, min: 0, max: 1, def: 0 }));
const { layout } = autoSurface(params);
document.getElementById('app').textContent = layout.pages
  .map((p) => p.id + ': ' + p.widgets.length + ' ' + p.widgets[0].type + 's').join('   ');`,
        caption: { en: 'Prints "main1: 4 knobs   main2: 4 knobs …" up to main5: the page limit counts a knob as 2, so four fit in the default 8.', zh: '印出「main1: 4 knobs   main2: 4 knobs …」一直到 main5：頁面上限把旋鈕算成 2，所以預設的 8 放得下四個。' },
      },
    ],
    related: ['widgetTypeFor', 'feedbackFor', 'routesFromLayout', 'Surface', 'mountRemoteHost', 'DEFAULT_SIZE'],
    keywords: {
      en: ['auto surface', 'params to panel', 'generate layout', 'control panel from params', 'routes', 'bindings', 'xy pairs', 'meters', 'phone panel'],
      zh: ['自動面板', '參數變面板', '產生版面', '依參數建立面板', '路由', '綁定', 'xy 配對', '音量表', '手機面板'],
    },
  },

  feedbackFor: {
    group: 'remote',
    summary: {
      en: 'Turns the resolved param state into the normalized values the phone\'s widgets should show right now: `[{ name, value }]`.',
      zh: '把算好的參數狀態，換成手機上的元件現在該顯示的正規化數值：`[{ name, value }]`。',
    },
    params: [
      { name: 'state', type: 'Object', en: 'The resolved param values, such as `params.resolve(…)`: `{ hue: 90, size: 5.5 }`.', zh: '算好的參數值，例如 `params.resolve(…)` 的結果：`{ hue: 90, size: 5.5 }`。' },
      { name: 'bindings', type: 'Object[]', en: 'The `bindings` that [`autoSurface()`](#autoSurface) returned.', zh: '[`autoSurface()`](#autoSurface) 回傳的 `bindings`。' },
    ],
    returns: { type: '{ name, value }[]', en: 'One entry per binding that has a number in `state`: `name` is the widget\'s signal, `value` is the param scaled to 0..1 and held in range. A param that is missing, not a number, or with `min` equal to `max` is skipped.', zh: '`state` 裡有數字的每個 binding 各一項：`name` 是元件的訊號，`value` 是縮放到 0..1 並限制在範圍內的參數值。缺少、不是數字、或 `min` 等於 `max` 的參數會跳過。' },
    description: [
      {
        en: 'It is pure and cheap, so the show calls it about ten times a second and sends each result to the phones with `relay.feedback(name, value)`; `host.frame()` of [`mountRemoteHost()`](#mountRemoteHost) does exactly that. On the phone, [`Surface`](#Surface)\'s `feedback()` moves the widget, so a fader follows the timeline and other controllers.',
        zh: '它是純函式、成本很低，所以演出端大約每秒呼叫十次，並用 `relay.feedback(name, value)` 把每一項送給手機，[`mountRemoteHost()`](#mountRemoteHost) 的 `host.frame()` 做的就是這件事。在手機上，[`Surface`](#Surface) 的 `feedback()` 會移動元件，所以推桿會跟著時間軸和其他控制器動。',
      },
    ],
    examples: [
      {
        code: `import { autoSurface, feedbackFor } from '@openav/surface/auto';

const params = [{ key: 'hue', min: 0, max: 360, def: 200 }, { key: 'size', min: 1, max: 10, def: 4 }];
const { bindings } = autoSurface(params);
const echo = feedbackFor({ hue: 90, size: 5.5 }, bindings);
document.getElementById('app').innerHTML = echo.map((f) => f.name + ' = ' + f.value).join('<br>');`,
        caption: { en: 'Prints surface/main/hue = 0.25 (90 of 0 to 360) and surface/main/size = 0.5 (5.5 of 1 to 10).', zh: '印出 surface/main/hue = 0.25（0 到 360 裡的 90）和 surface/main/size = 0.5（1 到 10 裡的 5.5）。' },
      },
    ],
    related: ['autoSurface', 'Surface', 'mountRemoteHost', 'RelayClient'],
    keywords: {
      en: ['feedback', 'echo values', 'fader follows', 'bindings', 'normalize', 'send back to phone'],
      zh: ['回饋', '回送數值', '推桿跟著動', '綁定', '正規化', '送回手機'],
    },
  },

  routesFromLayout: {
    group: 'remote',
    summary: {
      en: 'Writes the mapper routes for a hand-written layout: every widget that names a param in `target` gets a route from its signal to that param.',
      zh: '替手寫的版面產生映射器路由：每個用 `target` 指定參數的元件，都會得到一條從它的訊號到那個參數的路由。',
    },
    params: [
      { name: 'layout', type: 'Object', en: 'The layout JSON, whose widgets may have a `target`.', zh: '版面 JSON，裡面的元件可以有 `target`。' },
      { name: 'params', type: 'Object[]', optional: true, en: 'The param declarations. A `target` that is not among them is skipped without a warning.', zh: '參數宣告。`target` 不在裡面的話，會不吭一聲地跳過。' },
      { name: 'smooth', type: 'Number', optional: true, en: 'Seconds of smoothing on continuous routes. A widget\'s own `smooth` wins. Pulse params and button, toggle and radio widgets are never smoothed.', zh: '連續路由的平滑秒數。元件自己的 `smooth` 優先。脈衝參數，以及 button、toggle、radio 元件不會被平滑。' },
    ],
    returns: { type: 'Object[]', en: 'Routes in the same shape [`autoSurface()`](#autoSurface) makes: `{ source, target, inMin, inMax, curve, smooth, outMin, outMax }`, with `curve` taken from the widget (`linear` if it has none).', zh: '格式跟 [`autoSurface()`](#autoSurface) 做出來的一樣的路由：`{ source, target, inMin, inMax, curve, smooth, outMin, outMax }`，`curve` 取自元件（沒有就是 `linear`）。' },
    description: [
      {
        en: 'Give a widget a `target` and the layout file is enough to perform a world. `target` is a param key, or an array for the widgets with several signals: an `xy` sends x to the first and y to the second, a `bank` sends channel *i* to the *i*-th. Every other widget uses its first (or only) target. The routes already scale the 0..1 signal to the param\'s `min` and `max`. [`mountRemoteHost()`](#mountRemoteHost) uses this for a layout from `world.surface` or from its `surface` option.',
        zh: '給元件一個 `target`，光靠版面檔案就能演奏一個世界。`target` 是參數鍵，訊號不只一個的元件可以給陣列：`xy` 把 x 送給第一個、y 送給第二個，`bank` 把第 *i* 個頻道送給第 *i* 個。其他元件都用第一個（或唯一的）target。路由已經把 0..1 的訊號換算成參數的 `min` 和 `max`。[`mountRemoteHost()`](#mountRemoteHost) 遇到來自 `world.surface` 或 `surface` 選項的版面，就是用它。',
      },
    ],
    examples: [
      {
        code: `import { routesFromLayout } from '@openav/surface/auto';

const params = [
  { key: 'size', min: 1, max: 10 }, { key: 'cx', min: 0, max: 1 }, { key: 'cy', min: 0, max: 1 }, { key: 'burst', pulse: true },
];
const layout = { pages: [{ id: 'p', widgets: [
  { id: 'size', type: 'fader', target: 'size' },
  { id: 'pos', type: 'xy', target: ['cx', 'cy'] },
  { id: 'go', type: 'button', target: 'burst' },
  { id: 'note', type: 'label' },
] }] };
document.getElementById('app').innerHTML = routesFromLayout(layout, params)
  .map((r) => r.source + ' → ' + r.target).join('<br>');`,
        caption: { en: 'Prints surface/p/size → size, surface/p/pos/x → cx, surface/p/pos/y → cy, surface/p/go → burst: the label has no target, so no route.', zh: '印出 surface/p/size → size、surface/p/pos/x → cx、surface/p/pos/y → cy、surface/p/go → burst：label 沒有 target，所以沒有路由。' },
      },
    ],
    related: ['autoSurface', 'signalNames', 'mountRemoteHost', 'Surface'],
    keywords: {
      en: ['routes from layout', 'target', 'hand-written layout', 'widget target', 'mapper routes', 'xy target', 'bank target'],
      zh: ['由版面產生路由', 'target', '手寫版面', '元件 target', '映射器路由', 'xy target', 'bank target'],
    },
  },

  planKeyboard: {
    group: 'remote',
    summary: {
      en: 'Decides how many piano keys, in how many rows, fit a box: one wide row, or two stacked rows when the box is tall, so keys stay a playable size.',
      zh: '決定一個框裡放得下多少琴鍵、排成幾列：框很寬就一排，框很高就上下兩排，讓琴鍵維持好彈的大小。',
    },
    params: [
      { name: 'width', type: 'Number', en: 'The width of the box, in pixels.', zh: '框的寬，單位像素。' },
      { name: 'height', type: 'Number', en: 'The height of the box, in pixels.', zh: '框的高，單位像素。' },
      { name: 'base', type: 'Number', optional: true, en: 'The MIDI note of the lowest key. 48 is C3 (C4 is 60).', zh: '最低音那個鍵的 MIDI 音符號碼。48 是 C3（C4 是 60）。' },
      { name: 'minKeyPx', type: 'Number', optional: true, en: 'The narrowest a white key may be, in pixels. At least 3 white keys are kept.', zh: '白鍵最窄可以多寬，單位像素。至少會保留 3 個白鍵。' },
      { name: 'maxWhites', type: 'Number', optional: true, en: 'The most white keys in a row. Two stacked rows are limited to 14 each.', zh: '一排最多幾個白鍵。上下兩排的話，每排最多 14 個。' },
      { name: 'stackBelow', type: 'Number', optional: true, en: 'Stack into two rows when width ÷ height is below this.', zh: '寬 ÷ 高低於這個值就改成上下兩排。' },
      { name: 'forceRows', type: '1 | 2', optional: true, en: '`1` or `2` to decide yourself; `0` lets the shape of the box decide.', zh: '`1` 或 `2` 自己決定，`0` 由框的形狀決定。' },
    ],
    returns: { type: '{ stacked, whites, keyPx, rows }', en: '`stacked` is true for two rows, `whites` the white keys in a row, `keyPx` the width of a white key. `rows` is a list of `{ base, semitones, whites }`, **the top row first** (the higher notes), the way two keyboards are read: `base` is the MIDI note of the first key and `semitones` how many notes the row spans.', zh: '`stacked` 為 true 就是兩排，`whites` 是每排的白鍵數，`keyPx` 是白鍵的寬度。`rows` 是 `{ base, semitones, whites }` 的清單，**上面那一排在最前面**（音比較高），就像兩層鍵盤的讀法：`base` 是第一個鍵的 MIDI 音符號碼，`semitones` 是那一排涵蓋幾個半音。' },
    description: [
      {
        en: 'A piano is two and a half metres wide and a phone held upright is six centimetres, so shrinking the keys makes a toy. Instead the keyboard changes shape with its box. A wide box gets one row with as many octaves as fit at `minKeyPx` or wider. A tall box gets two rows, the upper one continuing the pitch range where the lower stops, within reach of a thumb. The rows end on E or B and the next one starts on the next white key, so no black key is left alone at the seam. Notes stop at 127. The `keyboard` widget of [`Surface`](#Surface) calls this every time its box changes size.',
        zh: '一台鋼琴有兩公尺半寬，直拿的手機只有六公分，把琴鍵縮小只會變成玩具。所以改成讓鍵盤隨著框的形狀變形。很寬的框得到一排，放得下幾個八度就放幾個（白鍵不窄於 `minKeyPx`）。很高的框得到兩排，上排接著下排停下來的地方往高音延伸，拇指搆得到。每一排都結束在 E 或 B，下一排從下一個白鍵開始，所以接縫處不會留下孤單的黑鍵。音符最高到 127。[`Surface`](#Surface) 的 `keyboard` 元件在框的大小改變時，每次都會呼叫它。',
      },
    ],
    examples: [
      {
        code: `import { planKeyboard } from '@openav/surface';

const show = (label, plan) => label + ': ' + (plan.stacked ? 'two rows' : 'one row') + ', ' + plan.whites + ' white keys of ' +
  Math.round(plan.keyPx) + ' px, ' + plan.rows.map((r) => 'notes ' + r.base + '–' + (r.base + r.semitones - 1)).join(' / ');
document.getElementById('app').innerHTML = [
  show('phone on its side (844 x 330)', planKeyboard({ width: 844, height: 330 })),
  show('phone upright (390 x 640)', planKeyboard({ width: 390, height: 640 })),
].join('<br>');`,
        caption: { en: 'Prints one row of 21 white keys (notes 48 to 83) for the wide box, and two rows of 10 (notes 65 to 81 on top, 48 to 64 below) for the tall one.', zh: '寬的框印出一排 21 個白鍵（音符 48 到 83），高的框印出兩排各 10 個（上排 65 到 81、下排 48 到 64）。' },
      },
    ],
    related: ['Surface', 'WIDGET_TYPES'],
    keywords: {
      en: ['keyboard', 'piano keys', 'octaves', 'stacked rows', 'two rows', 'key width', 'phone piano', 'layout of keys'],
      zh: ['鍵盤', '琴鍵', '八度', '上下兩排', '兩排', '琴鍵寬度', '手機鋼琴', '琴鍵排列'],
    },
  },

  THEME_VARS: {
    group: 'remote',
    summary: {
      en: 'The look of every control as 15 CSS custom properties on `:root` (`--oav-bg`, `--oav-accent` …): override them to re-skin the whole surface.',
      zh: '每個控制元件的外觀，收成 `:root` 上的 15 個 CSS 自訂屬性（`--oav-bg`、`--oav-accent` …）：覆寫它們就能替整個面板換皮膚。',
    },
    value: {
      type: 'Object',
      en: 'Property name to its default value: `--oav-bg` #0a0c11, `--oav-surface` #141922, `--oav-surface-2` #1b2230, `--oav-line` #283044, `--oav-text` #e8ecf5, `--oav-dim` #8691a8, `--oav-accent` #7ea6ff, `--oav-ok` #3ddc84, `--oav-warn` #f5a524, `--oav-bad` #e5484d, `--oav-radius` 14px, `--oav-gap` 8px, `--oav-touch-min` 44px, `--oav-font` (the system font) and `--oav-mono` (a monospace font).',
      zh: '屬性名稱對應它的預設值：`--oav-bg` #0a0c11、`--oav-surface` #141922、`--oav-surface-2` #1b2230、`--oav-line` #283044、`--oav-text` #e8ecf5、`--oav-dim` #8691a8、`--oav-accent` #7ea6ff、`--oav-ok` #3ddc84、`--oav-warn` #f5a524、`--oav-bad` #e5484d、`--oav-radius` 14px、`--oav-gap` 8px、`--oav-touch-min` 44px、`--oav-font`（系統字型）和 `--oav-mono`（等寬字型）。',
    },
    description: [
      {
        en: 'The design is a set of rules rather than decoration, because a controller is used in the dark, fast and half-looking: dark cards on near-black, the only saturated thing on screen is a value, every touch target at least 44 px (`--oav-touch-min`), the number you are changing always visible, and a pressed widget outlines itself in its colour. Everything is a CSS variable, so a work re-skins the surface by overriding a few of them, never by editing widget code.',
        zh: '設計是一組規則，不是裝飾，因為控制器是在黑暗中、很快、只用眼角餘光看的：近黑底上的深色卡片、畫面上唯一飽和的東西是數值、每個觸碰目標至少 44 像素（`--oav-touch-min`）、正在調的數字一定看得到、被按住的元件用自己的顏色描邊。所有東西都是 CSS 變數，所以作品只要覆寫其中幾個就能換皮膚，不必改元件的程式碼。',
      },
      {
        en: '[`injectTheme()`](#injectTheme) writes these values into the page once. Override after that, on `document.documentElement` or in your own stylesheet, with a rule that comes later on `:root`.',
        zh: '[`injectTheme()`](#injectTheme) 會把這些值寫進頁面一次。要覆寫的話，在那之後，對 `document.documentElement` 設，或在你自己的樣式表裡用排在後面的 `:root` 規則。',
      },
    ],
    examples: [
      {
        code: `import { THEME_VARS } from '@openav/surface';

document.getElementById('app').innerHTML = ['--oav-bg', '--oav-accent', '--oav-radius', '--oav-touch-min']
  .map((k) => k + ': ' + THEME_VARS[k]).join('<br>');`,
        caption: { en: 'Prints the background #0a0c11, the accent #7ea6ff, the corner radius 14px and the 44px minimum touch size.', zh: '印出背景 #0a0c11、強調色 #7ea6ff、圓角 14px 和最小觸碰尺寸 44px。' },
      },
    ],
    related: ['injectTheme', 'COLOR_NAMES', 'Surface'],
    keywords: {
      en: ['theme', 'css variables', 'custom properties', 'skin', 'colors', 'accent', 'dark', 'touch size', 're-skin'],
      zh: ['主題', 'css 變數', '自訂屬性', '換皮膚', '顏色', '強調色', '深色', '觸碰尺寸'],
    },
  },

  COLOR_NAMES: {
    group: 'remote',
    summary: {
      en: 'The seven colour names a widget\'s `color` may be: cyan, amber, magenta, lime, violet, coral, white.',
      zh: '元件的 `color` 可以用的七個顏色名稱：cyan、amber、magenta、lime、violet、coral、white。',
    },
    value: {
      type: 'string[]',
      en: '`[\'cyan\', \'amber\', \'magenta\', \'lime\', \'violet\', \'coral\', \'white\']`.',
      zh: '七個字串：`[\'cyan\', \'amber\', \'magenta\', \'lime\', \'violet\', \'coral\', \'white\']`。',
    },
    description: [
      {
        en: '`{ id: \'hue\', type: \'knob\', color: \'amber\' }` makes the widget\'s fill, its value readout and its pressed outline amber. A widget without a colour uses `--oav-accent` of [`THEME_VARS`](#THEME_VARS). [`autoSurface()`](#autoSurface) hands out the first six in turn (white is left for you). A name that is not in the list gets no colour of its own and falls back to the accent; [`validateLayout()`](#validateLayout) does not check it.',
        zh: '`{ id: \'hue\', type: \'knob\', color: \'amber\' }` 會讓元件的填色、數值讀數和按下時的描邊都變成琥珀色。沒有顏色的元件用 [`THEME_VARS`](#THEME_VARS) 的 `--oav-accent`。[`autoSurface()`](#autoSurface) 會輪流發前六個（white 留給你用）。不在清單裡的名稱沒有自己的顏色，會退回強調色。[`validateLayout()`](#validateLayout) 不檢查它。',
      },
    ],
    examples: [
      {
        code: `import { COLOR_NAMES } from '@openav/surface';

document.getElementById('app').textContent = COLOR_NAMES.join(', ');`,
        caption: { en: 'Prints cyan, amber, magenta, lime, violet, coral, white.', zh: '印出 cyan、amber、magenta、lime、violet、coral、white。' },
      },
    ],
    related: ['THEME_VARS', 'autoSurface', 'WIDGET_TYPES'],
    keywords: {
      en: ['color', 'colour', 'color names', 'widget color', 'cyan', 'amber', 'magenta', 'palette'],
      zh: ['顏色', '色名', '元件顏色', '青色', '琥珀', '洋紅', '調色盤'],
    },
  },

  injectTheme: {
    group: 'remote',
    summary: {
      en: 'Writes the surface\'s stylesheet into the page, once: the 15 theme variables on `:root` and the rules for every widget. Safe to call again.',
      zh: '把面板的樣式表寫進頁面，只寫一次：`:root` 上的 15 個主題變數，以及每個元件的樣式規則。重複呼叫也沒問題。',
    },
    description: [
      {
        en: '[`Surface`](#Surface) and `mountRemote()` call it for you, so you need it only when you build a [widget](#WIDGET_CLASSES) by yourself, or when you want the variables (`var(--oav-accent)`) for your own elements. It adds one `<style id="openav-surface-css">` to the head, and does nothing if that already exists, or if there is no `document`. To change the look, set a variable after that: `document.documentElement.style.setProperty(\'--oav-accent\', \'#ff5fb3\')`.',
        zh: '[`Surface`](#Surface) 和 `mountRemote()` 會替你呼叫它，所以只有自己建立 [元件](#WIDGET_CLASSES) 的時候，或想在自己的元素上用這些變數（`var(--oav-accent)`）的時候才需要它。它會在 head 裡加一個 `<style id="openav-surface-css">`，這個已經存在、或根本沒有 `document` 的話，就什麼都不做。要改外觀，在那之後設變數：`document.documentElement.style.setProperty(\'--oav-accent\', \'#ff5fb3\')`。',
      },
    ],
    examples: [
      {
        code: `import { injectTheme } from '@openav/surface';

const read = () => getComputedStyle(document.documentElement).getPropertyValue('--oav-accent').trim() || '(not set)';
const before = read();
injectTheme();
injectTheme();   // the second call does nothing
document.getElementById('app').innerHTML = [
  'accent before: ' + before,
  'accent after: ' + read(),
  'style tags: ' + document.querySelectorAll('#openav-surface-css').length,
].join('<br>');`,
        caption: { en: 'Prints "(not set)" before, #7ea6ff after, and exactly one style tag even though it was called twice.', zh: '印出之前是「(not set)」、之後是 #7ea6ff，而且就算呼叫了兩次，style 標籤也只有一個。' },
      },
      {
        code: `import { Surface, injectTheme } from '@openav/surface';

injectTheme();
document.documentElement.style.setProperty('--oav-accent', '#ff5fb3');   // re-skin: pink instead of blue

const box = document.getElementById('app');
box.style.cssText = 'position:relative;width:260px;height:160px';
new Surface(box, {
  layout: { pages: [{ id: 'main', grid: { cols: 3, rows: 2 }, widgets: [
    { id: 'a', type: 'fader', x: 0, y: 0, w: 1, h: 2, def: 0.7 }, { id: 'b', type: 'knob', x: 1, y: 0, w: 2, h: 2, def: 0.4 },
  ] }] },
  sink() {},
});`,
        caption: { en: 'A fader and a knob drawn in pink: they have no colour of their own, so they take the accent that was overridden.', zh: '一支推桿和一個旋鈕畫成粉紅色：它們沒有自己的顏色，所以用了被覆寫過的強調色。' },
      },
    ],
    related: ['THEME_VARS', 'Surface', 'WIDGET_CLASSES', 'mountRemote'],
    keywords: {
      en: ['inject theme', 'stylesheet', 'css', 'style tag', 'theme', 'skin', 'oav-accent'],
      zh: ['注入主題', '樣式表', 'css', 'style 標籤', '主題', '換皮膚', 'oav-accent'],
    },
  },

  lockViewport: {
    group: 'remote',
    summary: {
      en: 'Makes a page behave like an instrument panel instead of a web page: no scrolling, no pinch zoom, no rubber-banding. Returns a function that undoes most of it.',
      zh: '讓頁面像儀器面板，而不是網頁：不能捲動、不能雙指縮放、不會有橡皮筋回彈。回傳一個函式，可以復原其中大部分。',
    },
    returns: { type: 'Function', en: 'Call it to remove the stylesheet and the listeners. The viewport `<meta>` stays as it was set.', zh: '呼叫它會移除樣式表和監聽。viewport 的 `<meta>` 維持設好的樣子，不會還原。' },
    description: [
      {
        en: 'It sets `<meta name="viewport">` to `width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover` (making the tag if there is none) and adds a style that gives `html` and `body` no margin, the full height, `overflow: hidden`, `overscroll-behavior: none` and `touch-action: none`. iOS ignores `user-scalable=no`, so it also cancels `gesturestart` and `gesturechange` (pinch zoom) and the default of every `touchmove`, except one that starts in an `input` or `textarea`, so a text box still works.',
        zh: '它把 `<meta name="viewport">` 設成 `width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover`（沒有這個標籤就先做一個），並加一段樣式，讓 `html` 和 `body` 沒有邊界、高度填滿、`overflow: hidden`、`overscroll-behavior: none`、`touch-action: none`。iOS 會忽略 `user-scalable=no`，所以它也取消 `gesturestart` 和 `gesturechange`（雙指縮放），以及每個 `touchmove` 的預設行為，只有從 `input` 或 `textarea` 開始的例外，所以文字框還是能用。',
      },
      {
        en: 'This is for a page that is a control panel, such as `mountRemote()`, which calls it. Do not call it on a page that has to scroll. Without a `document` (in Node) it returns a function that does nothing.',
        zh: '這是給整個頁面就是控制面板的情況用的，例如 `mountRemote()` 就會呼叫它。要捲動的頁面不要呼叫它。沒有 `document`（在 Node 裡）的話，它回傳一個什麼都不做的函式。',
      },
    ],
    examples: [
      {
        code: `import { lockViewport } from '@openav/surface';

const unlock = lockViewport();
const meta = document.querySelector('meta[name=viewport]');
const locked = getComputedStyle(document.body).overflow;
unlock();
document.getElementById('app').innerHTML = [
  'viewport: ' + meta.content,
  'body overflow while locked: ' + locked,
  'body overflow after unlock: ' + getComputedStyle(document.body).overflow,
].join('<br>');`,
        caption: { en: 'Prints the viewport string, "hidden" while locked, and "visible" after unlock(): the stylesheet goes away, the meta tag stays.', zh: '印出 viewport 字串、鎖定時的「hidden」、unlock() 之後的「visible」：樣式表消失了，meta 標籤還在。' },
      },
    ],
    related: ['keepAwake', 'mountRemote', 'Surface'],
    keywords: {
      en: ['lock viewport', 'no scroll', 'no zoom', 'pinch zoom', 'overscroll', 'ios', 'instrument panel', 'user-scalable'],
      zh: ['鎖定視窗', '不捲動', '不縮放', '雙指縮放', '橡皮筋', 'ios', '儀器面板', 'user-scalable'],
    },
  },

  keepAwake: {
    group: 'remote',
    summary: {
      en: 'Asks the browser to keep the screen on (a screen wake lock) and asks again when the tab comes back. Returns `{ release() }`.',
      zh: '請瀏覽器讓螢幕保持亮著（螢幕喚醒鎖），分頁回來時再要求一次。回傳 `{ release() }`。',
    },
    returns: { type: '{ release }', en: '`release()` stops asking and lets go of the lock.', zh: '`release()` 停止再要求，並放掉喚醒鎖。' },
    description: [
      {
        en: 'A phone that is a controller dims and locks within a minute unless something holds the screen on. `keepAwake()` requests `navigator.wakeLock.request(\'screen\')` right away if the page is visible. The operating system drops the lock whenever the page is hidden, so it asks again each time the page becomes visible. It is best effort and silent: a browser with no wake lock, or one that says no, just means the screen may still dim, and it never throws.',
        zh: '當控制器用的手機，一分鐘內就會暗掉、鎖定，除非有東西讓螢幕保持亮著。如果頁面看得到，`keepAwake()` 馬上要求 `navigator.wakeLock.request(\'screen\')`。頁面一被藏起來，作業系統就會放掉這把鎖，所以每次頁面再變成可見，它都會再要求一次。它是盡力而為、而且不出聲：瀏覽器沒有喚醒鎖、或回答不行的話，就只是螢幕可能還是會暗掉，它絕不會丟出錯誤。',
      },
    ],
    needs: {
      en: 'A page that is visible, on `https` or `localhost` (the wake lock only exists on secure pages). `mountRemote()` calls it for you.',
      zh: '頁面要看得到，而且在 `https` 或 `localhost` 底下（喚醒鎖只存在於安全的頁面）。`mountRemote()` 會替你呼叫它。',
    },
    tbd: [
      {
        en: 'Not tried on a real iPhone or iPad: Safari may refuse a wake-lock request that is not made inside a tap, in which case the screen can still dim. The second example only shows the calls, with a stand-in for `navigator.wakeLock`.',
        zh: '沒有在真正的 iPhone 或 iPad 上試過：Safari 可能會拒絕不在點擊裡發出的喚醒鎖要求，這時螢幕還是會暗掉。第二個範例只示範呼叫的順序，用了一個代替 `navigator.wakeLock` 的替身。',
      },
    ],
    examples: [
      {
        code: `import { keepAwake } from '@openav/surface';

const awake = keepAwake();            // the screen stays on while this page is visible

// when the show is over:
// awake.release();`,
        caption: { en: 'On a phone or a laptop the screen stops dimming while the page is open and visible.', zh: '在手機或筆電上，頁面開著而且看得到的時候，螢幕不會再暗掉。' },
        run: 'static',
        why: 'The effect is the screen not dimming, which a page cannot show, and a headless browser has no screen to keep on. The next example runs the same calls against a stand-in.',
      },
      {
        code: `import { keepAwake } from '@openav/surface';

const log = [];
// a stand-in for the browser's wake lock, so there is something to see on any machine
Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: {
  request: async (type) => { log.push('request ' + type); return { release() { log.push('lock released'); } }; },
} });

const awake = keepAwake();
await new Promise((r) => setTimeout(r, 50));
awake.release();
log.push('release() called');
document.getElementById('app').innerHTML = log.join('<br>');`,
        caption: { en: 'Prints "request screen", then "lock released" and "release() called": one request when the page is visible, and release() lets the lock go.', zh: '印出「request screen」，然後是「lock released」和「release() called」：頁面看得到時要求一次，release() 把鎖放掉。' },
      },
    ],
    related: ['lockViewport', 'mountRemote'],
    keywords: {
      en: ['wake lock', 'keep awake', 'screen on', 'no sleep', 'dim', 'phone screen', 'navigator.wakeLock'],
      zh: ['喚醒鎖', '保持亮著', '螢幕常亮', '不休眠', '變暗', '手機螢幕', 'navigator.wakeLock'],
    },
  },

  canFullscreen: {
    group: 'remote',
    summary: {
      en: 'True when the page can ask for fullscreen: the browser has `requestFullscreen` (or the WebKit one). The code treats iPhone Safari as not having it.',
      zh: '頁面可以要求全螢幕的時候是 true：瀏覽器有 `requestFullscreen`（或 WebKit 版的）。程式碼把 iPhone 的 Safari 當成沒有。',
    },
    returns: { type: 'Boolean', en: '`true` or `false`. `false` without a `document`.', zh: '`true` 或 `false`。沒有 `document` 的話是 `false`。' },
    description: [
      {
        en: 'Use it to decide whether to show a fullscreen button: `if (canFullscreen()) button.hidden = false`. It only checks that the function exists; whether a request succeeds is up to the browser, which wants it to come from a tap ([`toggleFullscreen()`](#toggleFullscreen)).',
        zh: '用來決定要不要顯示全螢幕按鈕：`if (canFullscreen()) button.hidden = false`。它只檢查那個函式存不存在。要求會不會成功由瀏覽器決定，瀏覽器要求它必須來自一次點擊（[`toggleFullscreen()`](#toggleFullscreen)）。',
      },
    ],
    tbd: [
      {
        en: 'Not checked on an iPhone or iPad: that iPhone Safari has no fullscreen function is what the code\'s own comment says, not something measured here.',
        zh: '沒有在 iPhone 或 iPad 上檢查過：iPhone 的 Safari 沒有全螢幕函式，這是程式碼自己的註解說的，不是在這裡量到的。',
      },
    ],
    examples: [
      {
        code: `import { canFullscreen } from '@openav/surface';

document.getElementById('app').textContent = 'this browser can ask for fullscreen: ' + canFullscreen();`,
        caption: { en: 'Prints "true" in desktop Chrome, Firefox and Safari, and in Android Chrome.', zh: '在桌面的 Chrome、Firefox、Safari 和 Android 的 Chrome 上印出「true」。' },
      },
    ],
    related: ['toggleFullscreen', 'mountRemote'],
    keywords: {
      en: ['fullscreen', 'can fullscreen', 'requestFullscreen', 'full screen button', 'ios safari'],
      zh: ['全螢幕', '能不能全螢幕', 'requestFullscreen', '全螢幕按鈕', 'ios safari'],
    },
  },

  toggleFullscreen: {
    group: 'remote',
    summary: {
      en: 'Enters fullscreen if the page is not in it, and leaves it if it is. Call it from a tap, because browsers refuse otherwise.',
      zh: '頁面不在全螢幕就進入，已經在就離開。要在點擊裡呼叫，不然瀏覽器會拒絕。',
    },
    description: [
      {
        en: 'It asks for the whole page (`document.documentElement`) with the browser\'s navigation bar hidden, and quietly does nothing on a browser without fullscreen (see [`canFullscreen()`](#canFullscreen)). The phone app puts it on a ⛶ button in the status bar.',
        zh: '它要求整個頁面（`document.documentElement`）進入全螢幕，並把瀏覽器的導覽列藏起來，瀏覽器沒有全螢幕功能（見 [`canFullscreen()`](#canFullscreen)）的話就安靜地什麼都不做。手機 app 把它放在狀態列的 ⛶ 按鈕上。',
      },
    ],
    needs: {
      en: 'A user gesture: call it from a `click` or `pointerdown` handler. Called on page load it is refused by the browser.',
      zh: '需要使用者手勢：在 `click` 或 `pointerdown` 的處理函式裡呼叫。在頁面載入時呼叫，瀏覽器會拒絕。',
    },
    examples: [
      {
        code: `import { toggleFullscreen, canFullscreen } from '@openav/surface';

const button = document.createElement('button');
button.textContent = '⛶ fullscreen';
button.hidden = !canFullscreen();
button.onclick = toggleFullscreen;
document.body.append(button);`,
        caption: { en: 'A button that puts the page into fullscreen and out again, and is hidden where the browser has no fullscreen.', zh: '一顆讓頁面進入、再離開全螢幕的按鈕，瀏覽器沒有全螢幕的地方就隱藏。' },
        run: 'static',
        why: 'Fullscreen can only start from a real tap or click, and a headless page has no screen to fill, so there is nothing for the smoke to run.',
      },
    ],
    related: ['canFullscreen', 'mountRemote'],
    keywords: {
      en: ['fullscreen', 'toggle fullscreen', 'full screen', 'exit fullscreen', 'button'],
      zh: ['全螢幕', '切換全螢幕', '離開全螢幕', '按鈕'],
    },
  },

  haptic: {
    group: 'remote',
    summary: {
      en: 'Vibrates the phone for `ms` milliseconds where the browser can (Android Chrome); silent everywhere else, and `enabled` false turns it off.',
      zh: '瀏覽器做得到的地方（Android 的 Chrome）讓手機震動 `ms` 毫秒，其他地方什麼都不會發生，`enabled` 為 false 就關掉。',
    },
    params: [
      { name: 'ms', type: 'Number', en: 'How long to vibrate, in milliseconds. A button press in the surface uses 10 to 14.', zh: '震動多久，單位毫秒。面板裡按一下按鈕用的是 10 到 14。' },
      { name: 'enabled', type: 'Boolean', optional: true, en: 'Pass `false` to do nothing: a page can offer a "haptics" switch and hand it here.', zh: '傳 `false` 就什麼都不做：頁面可以提供一個「觸覺回饋」開關，把它的值交給這裡。' },
    ],
    description: [
      {
        en: 'It calls `navigator.vibrate(ms)` when that exists and swallows any error. Browsers without it, such as Safari on iPhone, simply do nothing, and Chrome only vibrates after the person has touched the page. [`Surface`](#Surface) calls it for buttons, toggles and radios, and its `haptics: false` option turns that off.',
        zh: '它在 `navigator.vibrate(ms)` 存在的時候呼叫它，並吞掉任何錯誤。沒有它的瀏覽器，例如 iPhone 上的 Safari，就單純什麼都不做，而 Chrome 要等使用者碰過頁面之後才會震動。[`Surface`](#Surface) 會在按鈕、開關和單選時呼叫它，它的 `haptics: false` 選項可以把這個關掉。',
      },
    ],
    tbd: [
      {
        en: 'Not felt on a real Android phone for this entry. The example uses a stand-in for `navigator.vibrate` to show when it is called.',
        zh: '這一條沒有在真正的 Android 手機上感受過。範例用了一個代替 `navigator.vibrate` 的替身，來示範什麼時候會被呼叫。',
      },
    ],
    examples: [
      {
        code: `import { haptic } from '@openav/surface';

document.querySelector('button').addEventListener('pointerdown', () => haptic(20));   // a short buzz on every press`,
        caption: { en: 'On an Android phone the button buzzes for 20 ms each time it is pressed; elsewhere nothing happens.', zh: '在 Android 手機上，按一下按鈕就震 20 毫秒，其他地方什麼都不會發生。' },
        run: 'static',
        why: 'It vibrates a phone, and there is nothing to see or feel on a desktop page. The next example runs the same calls against a stand-in for navigator.vibrate.',
      },
      {
        code: `import { haptic } from '@openav/surface';

const log = [];
navigator.vibrate = (ms) => { log.push('vibrate ' + ms + ' ms'); return true; };   // a stand-in, so there is something to see

haptic(20);
haptic(12, false);    // switched off: nothing is called
haptic(30, true);
document.getElementById('app').innerHTML = log.join('<br>');`,
        caption: { en: 'Prints "vibrate 20 ms" and "vibrate 30 ms": the call with enabled false made no vibration.', zh: '印出「vibrate 20 ms」和「vibrate 30 ms」：enabled 為 false 的那一次沒有震動。' },
      },
    ],
    related: ['Surface', 'keepAwake', 'lockViewport'],
    keywords: {
      en: ['haptic', 'vibrate', 'vibration', 'navigator.vibrate', 'buzz', 'feedback', 'android'],
      zh: ['觸覺回饋', '震動', '振動', 'navigator.vibrate', '嗡嗡', '回饋', 'android'],
    },
  },
};
