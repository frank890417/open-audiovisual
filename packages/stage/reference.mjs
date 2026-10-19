// @openav/stage reference: the world shell. A world is any system with init, update, render and dispose; the stage runs its lifecycle.
// Read by tools/build-reference.mjs (see AGENTS.md, "Documenting a public name").

export default {
  Stage: {
    group: 'core',
    summary: {
      en: 'Runs one world at a time: registers worlds and their params, switches between them, and each frame resolves the params and calls the world\'s `update` and `render`.',
      zh: '一次執行一個世界：登記世界和它們的參數、在世界之間切換，並在每個畫面解析參數、呼叫世界的 `update` 和 `render`。',
    },
    params: [
      {
        name: 'container', type: 'HTMLElement',
        en: 'The element the worlds draw into. It becomes `position: relative` if it was static. The stage adds its own layer inside it, so overlays you put in the container (hints, start buttons) are not wiped when a world is switched.',
        zh: '世界要畫進去的元素。如果它原本是 static，會被改成 `position: relative`。舞台會在裡面加一個自己的圖層，所以你放在容器裡的覆蓋物（提示、開始按鈕）在切換世界的時候不會被清掉。',
      },
      {
        name: 'params', type: 'Params',
        en: 'The [`Params`](#Params) the worlds\' schemas are absorbed into, and that `frame()` resolves.',
        zh: '世界的 schema 要併進去、也是 `frame()` 要解析的 [`Params`](#Params)。',
      },
      {
        name: 'signals', type: 'Signals',
        en: 'The [`Signals`](#Signals) registry handed to every world, so it can subscribe to events.',
        zh: '交給每個世界的 [`Signals`](#Signals) 登錄表，讓世界可以訂閱事件。',
      },
      {
        name: 'io', type: 'Object', optional: true, default: '{}',
        en: 'Extra output handles for the worlds\' `update(dt, state, io)`, such as `{ midi, osc }`. `signals` is always there.',
        zh: '給世界的 `update(dt, state, io)` 用的額外輸出把手，例如 `{ midi, osc }`。`signals` 一定在裡面。',
      },
    ],
    description: [
      {
        en: 'A **world** is any system with this shape, and every method is optional:\n\n```js\n{\n  name: \'garden\',                                   // unique: the stage registers worlds by name\n  params: [{ key: \'growth\', min: 0, max: 1, def: 0.5 }],   // what it can be performed with\n  init({ container, signals, params }) {},           // when it becomes active (may be async)\n  update(dt, state, io) {},                          // every frame: state = the resolved params\n  render() {},                                       // every frame, right after update\n  dispose() {},                                      // when another world is activated\n}\n```\n\nThe stage owns the lifecycle and the param aggregation and deliberately **not** a renderer: draw with a 2D canvas, p5, three.js, SVG, the DOM, whatever you like. The shell never knows the work: switching works means swapping the world and its data, and the shell stays.',
        zh: '**世界**就是任何符合這個形狀的系統，每個方法都是選填的：\n\n```js\n{\n  name: \'garden\',                                   // unique: the stage registers worlds by name\n  params: [{ key: \'growth\', min: 0, max: 1, def: 0.5 }],   // what it can be performed with\n  init({ container, signals, params }) {},           // when it becomes active (may be async)\n  update(dt, state, io) {},                          // every frame: state = the resolved params\n  render() {},                                       // every frame, right after update\n  dispose() {},                                      // when another world is activated\n}\n```\n\n舞台負責生命週期和參數的彙整，而刻意**不**負責繪圖：用 2D 畫布、p5、three.js、SVG、DOM，隨你高興。外殼永遠不知道作品是什麼：換作品就是換掉世界和它的資料，外殼不動。',
      },
      {
        en: 'A world takes continuous control from `state` (the params) and may subscribe to `signals` for discrete events (a note struck, a chord resolved). If it reads `signals.get(\'midi/cc/74\')` inside `update()`, it works with your controller today, but the timeline, a hand or another controller can no longer drive it. In a show, [`createShow()`](#createShow) builds the stage from its `world` and `worlds` options and returns it as `show.stage`.',
        zh: '世界從 `state`（參數）取得連續控制，可以訂閱 `signals` 來接離散事件（按下一個音、一個和弦解決）。如果它在 `update()` 裡讀 `signals.get(\'midi/cc/74\')`，今天用你的控制器是行的，但時間軸、手或別的控制器就再也驅動不了它。在演出裡，[`createShow()`](#createShow) 依 `world` 和 `worlds` 選項建好舞台，用 `show.stage` 回傳。',
      },
    ],
    needs: {
      en: 'Register your worlds, then `await stage.activate(name)` once; until a world is active, `frame()` returns `null` and does nothing. Then call `stage.frame(dt, baseState)` every frame (a show\'s loop does).',
      zh: '先登記你的世界，再 `await stage.activate(name)` 一次。在有世界啟用之前，`frame()` 會回傳 `null`，什麼都不做。之後每個畫面呼叫 `stage.frame(dt, baseState)`（演出的迴圈會做）。',
    },
    members: {
      register: {
        en: 'Register a world by its `name` and add its `params` to the shared [`Params`](#Params) (a key that already exists keeps its first declaration). Returns the stage.',
        zh: '依 `name` 登記一個世界，並把它的 `params` 加進共用的 [`Params`](#Params)（已經存在的 key 保留最先的宣告）。回傳舞台本身。',
      },
      activate: {
        en: 'Switch to the world with this name. Async: it disposes the previous world (an error in its `dispose()` is logged, not thrown), empties the stage layer, then awaits the new world\'s `init({ container, signals, params })`. Does nothing if that world is already active; rejects with "unknown world" for a name that was never registered.',
        zh: '切換到這個名字的世界。它是非同步的：先讓前一個世界 dispose（它的 `dispose()` 出錯只會記錄，不會丟出），清空舞台圖層，再等新世界的 `init({ container, signals, params })` 完成。那個世界已經啟用的話就什麼都不做。名字從沒登記過，則以 "unknown world" 被拒絕（reject）。',
      },
      frame: {
        en: 'Per frame: `frame(dt, baseState)` resolves `params.resolve(baseState)` (override, else the base, else `def`), calls the active world\'s `update(dt, state, io)` and then `render()`, and returns the resolved state, or `null` with no active world. An exception in either call is caught and logged as `[stage] update:` or `[stage] render:`; the show keeps running.',
        zh: '每個畫面：`frame(dt, baseState)` 先做 `params.resolve(baseState)`（有覆寫用覆寫，否則用基準值，再不然用 `def`），呼叫目前世界的 `update(dt, state, io)`，接著呼叫 `render()`，並回傳解析後的狀態。沒有世界啟用就回傳 `null`。兩個呼叫裡任何一個丟出例外，都會被接住、記成 `[stage] update:` 或 `[stage] render:`，演出繼續進行。',
      },
    },
    notes: [
      {
        en: 'Check the name before you activate: `activate(\'nope\')` disposes the current world **first** and only then rejects, and the stage keeps pointing at the disposed world (`active` and `activeName` do not change), so the next `frame()` still calls its `update()` and `render()`.',
        zh: '啟用之前請先確認名字：`activate(\'nope\')` 會**先**讓目前的世界 dispose，之後才被拒絕，而舞台仍然指著那個已經 dispose 的世界（`active` 和 `activeName` 沒有改變），所以下一次 `frame()` 還是會呼叫它的 `update()` 和 `render()`。',
      },
      {
        en: 'Fields to read: `active` (the active world object), `activeName`, `worlds` (a `Map` of name → world), `container`, `layer` (the element worlds are placed in) and `io` (`{ signals, ...io }`, what `update` receives; add handles later with `stage.io.osc = osc`).',
        zh: '可以讀的欄位：`active`（目前啟用的世界物件）、`activeName`、`worlds`（名字對應世界的 `Map`）、`container`、`layer`（世界被放進去的元素），以及 `io`（`{ signals, ...io }`，也就是 `update` 收到的東西，之後可以用 `stage.io.osc = osc` 補上把手）。',
      },
      {
        en: 'An exception in `init()` is not caught: `activate()` rejects. Exceptions in `update()` and `render()` are caught. A world must release what it takes (GPU objects, DOM, subscriptions) in `dispose()`, because worlds get switched live.',
        zh: '`init()` 裡的例外不會被接住：`activate()` 會被拒絕。`update()` 和 `render()` 裡的例外會被接住。世界必須在 `dispose()` 裡釋放它拿走的東西（GPU 物件、DOM、訂閱），因為世界是可以現場切換的。',
      },
    ],
    examples: [
      {
        code: `import { Signals, Params } from '@openav/core';
import { Stage } from '@openav/stage';

const container = document.getElementById('app');
container.style.cssText = 'width: 400px; height: 120px;';          // give the stage some room

const stage = new Stage({ container, params: new Params(), signals: new Signals() });
stage.register({
  name: 'label',
  params: [{ key: 'size', min: 10, max: 60, def: 20 }],
  init({ container }) { this.el = document.createElement('div'); container.appendChild(this.el); },
  update(dt, state) { this.size = state.size; },
  render() { this.el.style.cssText = 'color: #7ea6ff; font: ' + this.size + 'px monospace'; this.el.textContent = 'size ' + this.size; },
  dispose() { this.el.remove(); },
});
await stage.activate('label');                      // init runs now
console.log(stage.frame(0.016, { size: 40 }));      // { size: 40 }: the base state, since nothing overrides it
console.log(stage.frame(0.016, {}));                // { size: 20 }: no base either, so def`,
        caption: { en: 'The console prints `{ size: 40 }`, then `{ size: 20 }`, and the page shows the text `size 20` in blue: the world drew itself from the resolved params.', zh: '主控台印出 `{ size: 40 }`，然後是 `{ size: 20 }`，頁面上用藍色顯示文字 `size 20`：世界依解析後的參數畫出了自己。' },
      },
      {
        code: `import { Signals, Params } from '@openav/core';
import { Stage } from '@openav/stage';

const signals = new Signals();
const stage = new Stage({ container: document.getElementById('app'), params: new Params(), signals });
const world = (name) => ({
  name, params: [{ key: 'calm', min: 0, max: 1, def: 0.5 }],
  init() { console.log(name, 'init'); },
  dispose() { console.log(name, 'dispose'); },
});
stage.register(world('calm')).register(world('storm'));
await stage.activate('calm');                  // calm init
await stage.activate('storm');                 // calm dispose, then storm init
await stage.activate('storm');                 // already active: nothing happens
console.log(stage.activeName, stage.params.schema.length);     // storm 1: both worlds share the one 'calm' param
await stage.activate('nope').catch((error) => console.log(error.message));   // unknown world: storm is disposed first, then this rejects`,
        caption: { en: 'The console prints `calm init`, `calm dispose`, `storm init`, then `storm 1` (the shared param is registered once), then `storm dispose` and the error message for an unknown world: the failed switch has already disposed the world that was playing.', zh: '主控台印出 `calm init`、`calm dispose`、`storm init`，然後是 `storm 1`（共用的參數只登記一次），接著是 `storm dispose` 和未知世界的錯誤訊息：失敗的切換已經先讓正在跑的世界 dispose 了。' },
      },
    ],
    related: ['createCanvas', 'createShow', 'Params', 'Signals', 'webtoeWorld', 'Timeline'],
    keywords: {
      en: ['stage', 'world', 'worlds', 'lifecycle', 'init', 'update', 'render', 'dispose', 'activate', 'register', 'frame', 'renderer'],
      zh: ['舞台', '世界', '生命週期', '初始化', '更新', '繪製', '釋放', '啟用', '登記', '影格', '繪圖器'],
    },
  },

  createCanvas: {
    group: 'core',
    summary: {
      en: 'Makes a 2D canvas that fills its container and keeps its size in step with it, at up to 2 times the device pixel ratio.',
      zh: '做出一個填滿容器、並隨容器大小調整的 2D 畫布，解析度最高到裝置像素比的 2 倍。',
    },
    params: [
      {
        name: 'container', type: 'HTMLElement',
        en: 'The element to put the canvas in (a world\'s `container`, usually).',
        zh: '要放畫布的元素（通常是世界的 `container`）。',
      },
      {
        name: 'alpha', type: 'Boolean', optional: true, default: 'false',
        en: 'Whether the canvas may be transparent. The default `false` is faster and gives an opaque canvas.',
        zh: '畫布可不可以是透明的。預設 `false` 比較快，畫布是不透明的。',
      },
    ],
    returns: {
      type: 'Object',
      en: '`{ canvas, ctx, fit, dispose }`: the `<canvas>`, its 2D context, `fit()` and `dispose()`. `fit()` returns `{ w, h }`, the container size in CSS pixels.',
      zh: '`{ canvas, ctx, fit, dispose }`：`<canvas>`、它的 2D context、`fit()` 和 `dispose()`。`fit()` 回傳 `{ w, h }`，也就是容器以 CSS 像素計的大小。',
    },
    description: [
      {
        en: 'A convenience for worlds that draw with the 2D canvas API; a world may use it or ignore it. The canvas is `display: block` and as big as the container. `fit()` sets its pixel size to the container size times the device pixel ratio (never more than 2) and scales the context so you keep drawing in CSS pixels. Call `fit()` at the top of `render()`: it only does work when the size changed, and it returns `{ w, h }` to draw with. A `ResizeObserver` also calls it when the container is resized.',
        zh: '給用 2D 畫布 API 繪圖的世界的小幫手。世界可以用，也可以不用。畫布是 `display: block`，跟容器一樣大。`fit()` 把它的像素大小設成容器大小乘以裝置像素比（最多 2），並縮放 context，讓你繼續用 CSS 像素繪圖。在 `render()` 開頭呼叫 `fit()`：只有大小改變時它才會做事，而且會回傳畫圖要用的 `{ w, h }`。容器改變大小時，`ResizeObserver` 也會呼叫它。',
      },
      {
        en: 'Call `dispose()` in the world\'s `dispose()`: it stops the observer and removes the canvas.',
        zh: '在世界的 `dispose()` 裡呼叫 `dispose()`：它會停掉觀察器並移除畫布。',
      },
    ],
    notes: [
      {
        en: 'If the container has no height (an empty `<div>` in normal flow is 0 pixels tall), the canvas is 0 × 0 and nothing shows. Give the container a size, or use it inside a [`Stage`](#Stage), whose layer fills the stage.',
        zh: '如果容器沒有高度（一般排版流程裡的空 `<div>` 高度是 0 像素），畫布就是 0 × 0，什麼都看不到。請給容器一個大小，或是用在 [`Stage`](#Stage) 裡，它的圖層會填滿舞台。',
      },
    ],
    examples: [
      {
        code: `import { createCanvas } from '@openav/stage';

const container = document.getElementById('app');
container.style.cssText = 'width: 100%; height: 200px; background: #111;';
const view = createCanvas(container);

function render(time) {
  const { w, h } = view.fit();                         // the size in CSS pixels; cheap when nothing changed
  view.ctx.clearRect(0, 0, w, h);
  view.ctx.fillStyle = '#7ea6ff';
  view.ctx.fillRect(w / 2 - 30 + Math.sin(time / 500) * (w / 3), h / 2 - 30, 60, 60);
  requestAnimationFrame(render);
}
requestAnimationFrame(render);`,
        caption: { en: 'A blue square slides left and right across a canvas that fills a 200-pixel-high strip of the page, and stays sharp when the window is resized.', zh: '一個藍色方塊在填滿頁面 200 像素高橫條的畫布上左右滑動，視窗大小改變時依然清晰。' },
      },
    ],
    related: ['Stage', 'createShow'],
    keywords: {
      en: ['canvas', '2d canvas', 'createCanvas', 'fit', 'resize', 'device pixel ratio', 'retina', 'dpr', 'renderer helper'],
      zh: ['畫布', '2d 畫布', 'createCanvas', '調整大小', '縮放', '裝置像素比', 'retina', '繪圖小幫手'],
    },
  },
};
