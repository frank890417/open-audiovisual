// @openav/world-webtoe reference: perform a WebToe node patch as an open-audiovisual world.
// Read by tools/build-reference.mjs (see AGENTS.md, "Documenting a public name").

export default {
  webtoeWorld: {
    group: 'core',
    signature: 'webtoeWorld({ name, app, project, params, extra })',
    summary: {
      en: 'Turns a WebToe node patch into a world: the patch runs in an iframe and every changed param is posted into it.',
      zh: '把一份 WebToe 節點圖變成世界：節點圖在 iframe 裡執行，每個改變的參數都會被送進去。',
    },
    params: [
      {
        name: 'name', type: 'String', optional: true, default: '\'webtoe\'',
        en: 'The world\'s name: what [`Stage`](#Stage) registers it under and what you pass to `stage.activate()`. Give each patch its own.',
        zh: '世界的名字：[`Stage`](#Stage) 用它來登記，`stage.activate()` 也是傳它。每份節點圖請取自己的名字。',
      },
      {
        name: 'app', type: 'String', optional: true, default: '\'https://webtoe.openaudiovisual.com/\'',
        en: 'The WebToe app to embed in the iframe. Change it to run your own copy of the app.',
        zh: '要嵌進 iframe 的 WebToe 應用程式。改它就能跑你自己那一份。',
      },
      {
        name: 'project', type: 'String | null', optional: true, default: 'null',
        en: 'The address of a `.webtoe.json` patch file. It is handed to the app as `?project=<address>`, and the app fetches it, so the file\'s server must allow the app\'s origin (CORS). Make the address absolute, for example `new URL(\'./garden.webtoe.json\', location.href).href`.',
        zh: '`.webtoe.json` 節點圖檔案的網址。它會用 `?project=<網址>` 交給應用程式，由應用程式去抓，所以檔案所在的伺服器必須允許應用程式的來源（CORS）。請寫成絕對網址，例如 `new URL(\'./garden.webtoe.json\', location.href).href`。',
      },
      {
        name: 'params', type: 'Array', optional: true, default: '[]', viaArguments: true,
        en: 'The param schema of the world: `[{ key, min, max, def }, …]`. The keys are the names the patch reads with `ext(\'name\', fallback)`.',
        zh: '世界的參數 schema：`[{ key, min, max, def }, …]`。這些 key 就是節點圖用 `ext(\'name\', fallback)` 讀取的名稱。',
      },
      {
        name: 'extra', type: 'Function | null', optional: true, default: 'null', viaArguments: true,
        en: '`extra(state, out)`, called every frame: add derived values to `out` (a copy of the state) that the patch can read too, such as `out.hueRad = state.hue * Math.PI / 180`.',
        zh: '`extra(state, out)`，每個畫面呼叫：把衍生的值加進 `out`（狀態的複本），節點圖也讀得到，例如 `out.hueRad = state.hue * Math.PI / 180`。',
      },
    ],
    returns: {
      type: 'Object',
      en: 'A world `{ name, params, init, update, render, dispose }` to pass to `createShow({ world })` or `stage.register()`.',
      zh: '一個世界 `{ name, params, init, update, render, dispose }`，可以交給 `createShow({ world })` 或 `stage.register()`。',
    },
    description: [
      {
        en: '[WebToe](https://webtoe.openaudiovisual.com/) is the sister project: a web-native, node-based dataflow engine that speaks TouchDesigner. `webtoeWorld()` embeds its app in an iframe that fills the stage (with `allow="camera; microphone"`), and each frame it posts the resolved params into the iframe as `{ type: \'webtoe:ext\', values }`. Inside the patch, any parameter written as `ext(\'name\', fallback)` follows the value called `name`, and uses `fallback` until one arrives.',
        zh: '[WebToe](https://webtoe.openaudiovisual.com/) 是姊妹專案：一個網頁原生、以節點為基礎的資料流引擎，講的是 TouchDesigner 的語言。`webtoeWorld()` 把它的應用程式嵌進一個填滿舞台的 iframe（帶著 `allow="camera; microphone"`），每個畫面把解析後的參數用 `{ type: \'webtoe:ext\', values }` 送進 iframe。節點圖裡，任何寫成 `ext(\'name\', fallback)` 的參數，都會跟著名為 `name` 的值走，在值抵達之前用 `fallback`。',
      },
      {
        en: 'The contract stays pure: the world reads params and never inputs. Which knob, hand or timeline drives `speed` is the mapper\'s business, as for any world. To send less, the world posts only when at least one value differs from the last post.',
        zh: '約定維持純粹：世界讀的是參數，從不讀輸入。是哪個旋鈕、手或時間軸在驅動 `speed`，是映射的事，跟任何世界一樣。為了少送一點，世界只在至少有一個值跟上一次送出的不同時才會送。',
      },
    ],
    needs: {
      en: 'The page must be able to load the WebToe app in an iframe (the network, by default `https://webtoe.openaudiovisual.com/`), and the patch file must be reachable by the app. The world does its work when it is activated, so use it with `createShow({ world })`, or `stage.register()` and `stage.activate()`.',
      zh: '頁面必須能把 WebToe 應用程式載進 iframe（要有網路，預設是 `https://webtoe.openaudiovisual.com/`），節點圖檔案也要讓應用程式抓得到。世界在被啟用的時候才開始做事，所以請搭配 `createShow({ world })`，或 `stage.register()` 加 `stage.activate()` 使用。',
    },
    notes: [
      {
        en: 'The message goes to the iframe with the target origin `*`, so any page the iframe happens to be showing receives the values. If you point `app` at a site you do not trust, it can read your params.',
        zh: '訊息是用目標來源 `*` 送給 iframe，所以 iframe 當時顯示的任何頁面都收得到這些值。如果你把 `app` 指向你不信任的網站，它就能讀到你的參數。',
      },
    ],
    tbd: [
      {
        en: 'Not run against the real WebToe app here (the examples use a stand-in page, with no network). Because a value is only posted when it changed, a patch that finishes loading after the first frame may not receive values that never move again until one of them changes; whether that happens with the live app was not checked.',
        zh: '這裡沒有對真正的 WebToe 應用程式跑過（範例用的是一個代替的頁面，不需要網路）。因為值只有在改變時才會送出，在第一個畫面之後才載入完成的節點圖，對於之後再也不動的值，可能要等到其中一個值改變才會收到。真正的應用程式會不會發生這種情況，沒有查證。',
      },
    ],
    examples: [
      {
        code: `import { webtoeWorld } from '@openav/world-webtoe';

// a stand-in for the WebToe app, so this needs no network: it just shows what it receives
const patch = '<body style="margin:0;background:#111;color:#7ea6ff;font:14px monospace"></body>'
  + '<script>onmessage = (e) => { document.body.textContent = JSON.stringify(e.data); };<\\/script>';
const world = webtoeWorld({
  app: 'data:text/html,' + encodeURIComponent(patch),
  params: [{ key: 'speed', min: 0, max: 1, def: 0.5 }, { key: 'hue', min: 0, max: 360, def: 205 }],
  extra: (state, out) => { out.hueRad = Math.round(state.hue * Math.PI / 180 * 100) / 100; },
});
const container = document.getElementById('app');
container.style.cssText = 'position: relative; width: 400px; height: 120px;';
world.init({ container });
container.querySelector('iframe').onload = () => world.update(0.016, { speed: 0.8, hue: 180 });`,
        caption: { en: 'An iframe fills the container and, once it has loaded, shows the message the world posted: `{"type":"webtoe:ext","values":{"speed":0.8,"hue":180,"hueRad":3.14}}`.', zh: 'iframe 填滿容器，載入完成之後顯示世界送出的訊息：`{"type":"webtoe:ext","values":{"speed":0.8,"hue":180,"hueRad":3.14}}`。' },
      },
      {
        code: `import { createShow } from '@openav/show';
import { webtoeWorld } from '@openav/world-webtoe';

const world = webtoeWorld({
  name: 'garden-patch',
  project: new URL('./garden.webtoe.json', location.href).href,   // the app fetches it: CORS must allow it
  params: [
    { key: 'speed', min: 0, max: 1, def: 0.5 },
    { key: 'hue', min: 0, max: 360, def: 205 },
  ],
});
const show = await createShow({ world, routes: [{ source: 'midi/cc/1', target: 'speed' }] });`,
        caption: { en: 'The patch from `garden.webtoe.json` fills the stage, and turning MIDI knob 1 changes its `speed` through the mapper. Every `ext(\'speed\', …)` in the patch follows.', zh: '`garden.webtoe.json` 的節點圖填滿舞台，轉動 MIDI 旋鈕 1 會透過映射改變它的 `speed`。節點圖裡每個 `ext(\'speed\', …)` 都會跟著動。' },
        run: 'static',
        why: 'It loads the real WebToe app over the network and a patch file of yours, and the headless check allows no network.',
      },
    ],
    related: ['Stage', 'createShow', 'Params', 'Mapper'],
    keywords: {
      en: ['webtoe', 'touchdesigner', 'node patch', 'iframe world', 'ext', 'dataflow', 'patch', 'world', 'postMessage'],
      zh: ['webtoe', 'touchdesigner', '節點圖', 'iframe 世界', 'ext', '資料流', '世界', 'postMessage'],
    },
  },
};
