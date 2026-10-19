// @openav/mapping reference: routes from signals to params, learn, and the portable map file.
// Read by tools/build-reference.mjs (see AGENTS.md, "Documenting a public name").

export default {
  Mapper: {
    group: 'mapping',
    summary: {
      en: 'Connects signals to params: it holds a list of routes (a window, a curve, smoothing) and writes the matching param whenever a signal arrives.',
      zh: '把訊號接到參數：它手上有一份路由清單（輸入窗、曲線、平滑），每當訊號到來，就寫入對應的參數。',
    },
    params: [
      {
        name: 'signals', type: 'Signals', optional: false,
        en: 'The [`Signals`](#Signals) registry to listen to. The mapper subscribes to every signal at once, so a route works the moment it is added.',
        zh: '要監聽的 [`Signals`](#Signals) 登錄表。映射一建立就訂閱所有訊號，所以路由一加進去就生效。',
      },
      {
        name: 'params', type: 'Params', optional: false,
        en: 'The [`Params`](#Params) to write into. A route writes its target as an override.',
        zh: '要寫入的 [`Params`](#Params)。路由會把目標參數寫成覆寫值。',
      },
      {
        name: 'profile', type: 'String', optional: true, default: '\'default\'',
        en: 'The name this mapper saves its routes under in `localStorage` (`openav.map.<profile>`), and the `world` name in an exported map file. `createShow()` uses the world\'s name.',
        zh: '這個映射在 `localStorage` 儲存路由時用的名字（`openav.map.<profile>`），也是匯出的映射檔裡的 `world` 名稱。`createShow()` 用的是世界的名字。',
      },
      {
        name: 'onChange', type: 'Function | null', optional: true, default: 'null',
        en: 'Called with no arguments whenever the routes change or the import report changes (for a UI to redraw).',
        zh: '路由改變或匯入報告改變的時候呼叫，不帶參數（讓介面重畫用）。',
      },
      {
        name: 'onLearn', type: 'Function | null', optional: true, default: 'null',
        en: 'Called as `onLearn(route, signalName)` when learn mode binds a signal.',
        zh: 'learn 模式綁定了一個訊號的時候，以 `onLearn(route, signalName)` 呼叫。',
      },
    ],
    description: [
      {
        en: 'The mapper is the only component that connects signals to params, and everything it knows is a list of **routes**, plain objects. `mapper.addRoute({ source: \'midi/cc/74\', target: \'bloom\' })` makes the param `bloom` follow the signal `midi/cc/74`. One signal may drive several params, one param may listen to several signals (the last writer wins), and learn adds routes, it never replaces them. In a show, [`createShow()`](#createShow) builds one, loads the saved routes (or adds the ones you declared in `routes`) and returns it as `show.mapper`.',
        zh: '映射是唯一把訊號接到參數的元件，它知道的一切就是一份**路由**清單，每條路由是個普通物件。`mapper.addRoute({ source: \'midi/cc/74\', target: \'bloom\' })` 讓參數 `bloom` 跟著訊號 `midi/cc/74` 走。一個訊號可以驅動好幾個參數，一個參數也可以聽好幾個訊號（最後寫入的算數），learn 只會新增路由，不會取代。在演出裡，[`createShow()`](#createShow) 會建好一個，載入存起來的路由（或加入你在 `routes` 宣告的），用 `show.mapper` 回傳。',
      },
      {
        en: 'A route needs only `source` and `target`; `addRoute()` fills in the rest and returns the stored route:\n\n```text\nsource, target      the signal name and the param key (required)\ninMin, inMax        0, 1   the part of the signal that counts; outside it is clamped\noutMin, outMax      the param\'s min and max AT THE MOMENT THE ROUTE IS ADDED (0 and 1 if the param does not exist yet)\ncurve               \'linear\' | \'exp\' (x squared) | \'log\' (square root) | \'smooth\' (smoothstep); an unknown name is linear\ninvert              false   flip the value (1 - x) before the curve\nsmooth              0       glide time in seconds; 0 = instant\nenabled             absent = on; false mutes the route\nid                  assigned; used by removeRoute()\n```',
        zh: '一條路由只需要 `source` 和 `target`，其餘由 `addRoute()` 補上，並回傳存下來的路由：\n\n```text\nsource, target      the signal name and the param key (required)\ninMin, inMax        0, 1   the part of the signal that counts; outside it is clamped\noutMin, outMax      the param\'s min and max AT THE MOMENT THE ROUTE IS ADDED (0 and 1 if the param does not exist yet)\ncurve               \'linear\' | \'exp\' (x squared) | \'log\' (square root) | \'smooth\' (smoothstep); an unknown name is linear\ninvert              false   flip the value (1 - x) before the curve\nsmooth              0       glide time in seconds; 0 = instant\nenabled             absent = on; false mutes the route\nid                  assigned; used by removeRoute()\n```',
      },
      {
        en: 'When a signal arrives, each enabled route with that `source` does five things in order: take the **window** (`(value - inMin) / (inMax - inMin)`, clamped to 0..1), **invert** if asked, apply the **curve**, **scale** into `outMin`..`outMax`, and **write**. With `smooth: 0` the param is overridden at once. With `smooth > 0` the result becomes a target that `update(dt)` glides toward: after `smooth` seconds the param has covered about 63% of the way. If the target param is a pulse param, the route fires it instead: on every event of a pulse signal, or when a continuous source rises past 0.5.',
        zh: '訊號到來的時候，每一條啟用中、`source` 相符的路由會依序做五件事：取**輸入窗**（`(value - inMin) / (inMax - inMin)`，限制在 0..1）、需要的話**反轉**、套用**曲線**、**縮放**到 `outMin`..`outMax`、然後**寫入**。`smooth: 0` 時參數立刻被覆寫。`smooth > 0` 時，結果變成一個目標值，由 `update(dt)` 慢慢滑過去：經過 `smooth` 秒，參數走完大約 63% 的距離。如果目標是脈衝參數，路由改成觸發它：脈衝訊號每來一次就觸發，連續訊號則是往上越過 0.5 的那一刻觸發。',
      },
      {
        en: '**Learn** is generalised MIDI-learn: `mapper.learn(\'bloom\')`, then move something. The first signal that moves by at least 5% of its declared range (a knob, a hand, a phone tilt), or the first pulse that fires (a key, a pad), becomes the source of a new route with the default settings. Calling `learn(\'bloom\')` again cancels it. Because any pulse binds at once, stop the drum machine before you learn.',
        zh: '**Learn** 是通用版的 MIDI-learn：呼叫 `mapper.learn(\'bloom\')`，然後動一個東西。第一個移動超過其宣告範圍 5% 的訊號（旋鈕、手、手機傾斜），或第一個觸發的脈衝（按鍵、打擊墊），就會成為一條使用預設值的新路由的來源。再呼叫一次 `learn(\'bloom\')` 就取消。因為任何脈衝都會立刻被綁定，learn 之前請先把鼓機停掉。',
      },
    ],
    needs: {
      en: 'Create the signals and the params first, then the mapper. A smoothed route (`smooth > 0`) writes its param only inside `update(dt)`, so call `mapper.update(dt)` every frame (`createShow()` does).',
      zh: '先建好訊號和參數，再建映射。平滑的路由（`smooth > 0`）只會在 `update(dt)` 裡寫入參數，所以每個畫面都要呼叫 `mapper.update(dt)`（`createShow()` 會做）。',
    },
    members: {
      addRoute: {
        en: 'Add a route and return it, with the defaults filled in and an `id` assigned. `outMin` and `outMax` default to the param\'s range as it is right now.',
        zh: '加入一條路由並回傳，預設值補齊、`id` 也指定好了。`outMin` 和 `outMax` 預設是參數「此刻」的範圍。',
      },
      removeRoute: {
        en: 'Remove the route with this `id`.',
        zh: '移除這個 `id` 的路由。',
      },
      routesFor: {
        en: 'The routes that write this param.',
        zh: '寫入這個參數的所有路由。',
      },
      learn: {
        en: 'Toggle learn mode for a param: the next signal that moves (or the next pulse) becomes a new route to it. `mapper.learnTarget` is the armed key, or `null`.',
        zh: '切換某個參數的 learn 模式：下一個移動的訊號（或下一個脈衝）會成為指向它的新路由。`mapper.learnTarget` 是目前備好的 key，沒有就是 `null`。',
      },
      update: {
        en: 'Call every frame with the seconds that passed: it advances the smoothed routes toward their targets.',
        zh: '每個畫面呼叫一次，傳入經過的秒數：讓平滑的路由往它們的目標靠近一點。',
      },
      toJSON: {
        en: 'The routes as a plain array (without the internal `_last` and `_target`), ready for `JSON.stringify`.',
        zh: '把路由變成單純的陣列（不含內部用的 `_last` 和 `_target`），可以直接 `JSON.stringify`。',
      },
      fromJSON: {
        en: 'Replace all routes with this array (the shape `toJSON()` returns). Defaults are not filled in; use `importMap()` for a file.',
        zh: '用這個陣列（`toJSON()` 回傳的格式）取代所有路由。不會補預設值，要匯入檔案請用 `importMap()`。',
      },
      exportMap: {
        en: 'The portable map file for the current routes: `{ format, version, world, exported, routes }`. `world` defaults to the profile name.',
        zh: '目前路由的可攜映射檔：`{ format, version, world, exported, routes }`。`world` 預設是 profile 的名字。',
      },
      importMap: {
        en: 'Put a map file on this mapper: the JSON text or an already parsed value, `mode` `\'replace\'` (default) or `\'add\'`. Routes whose param is missing, or whose signal this show cannot produce, are skipped and listed. An unreadable file changes nothing. Returns the report (also kept in `mapper.report`) and saves at once.',
        zh: '把映射檔放到這個映射上：可以是 JSON 文字或已經解析好的值，`mode` 是 `\'replace\'`（預設）或 `\'add\'`。參數不存在、或這場演出產生不出來的訊號，對應的路由會被略過並列出來。讀不了的檔案不會改動任何東西。回傳報告（也存在 `mapper.report`），並立刻儲存。',
      },
      clear: {
        en: 'Remove every route, and forget them: the saved profile is emptied too.',
        zh: '移除所有路由，而且忘掉它們：存起來的 profile 也會清空。',
      },
      setReport: {
        en: 'Remember what the last import said and tell the UI (`onChange`). A failure shows up here, never as an exception.',
        zh: '記住最近一次匯入的結果並通知介面（`onChange`）。失敗會出現在這裡，不會變成例外。',
      },
      save: {
        en: 'Save the routes to `localStorage` under `openav.map.<profile>`. Every access is wrapped: blocked storage silently saves nothing.',
        zh: '把路由存到 `localStorage` 的 `openav.map.<profile>`。每次存取都有包起來，儲存被封鎖時就默默不存。',
      },
      load: {
        en: 'Load the saved routes; `true` when something was found.',
        zh: '載入存起來的路由，找到東西就回傳 `true`。',
      },
      dispose: {
        en: 'Stop listening to the signals.',
        zh: '停止監聽訊號。',
      },
    },
    notes: [
      {
        en: 'A route writes its param as an **override**, and overrides are sticky: as soon as a mapped signal moves, the timeline stops driving that param until `params.clearOverride(key)`.',
        zh: '路由把參數寫成**覆寫值**，而覆寫是黏住的：映射的訊號一動，時間軸就不再驅動那個參數，直到你呼叫 `params.clearOverride(key)`。',
      },
      {
        en: 'A smoothed route keeps writing its last target every frame once its signal has arrived, so its param stays overridden even after `clearOverride` and even when the route is muted with `enabled = false`. Remove the route to give the param back to the timeline.',
        zh: '平滑的路由只要訊號來過一次，之後每個畫面都會繼續寫入它最後的目標值，所以就算 `clearOverride`、甚至用 `enabled = false` 靜音，參數仍然是被覆寫的。要把參數還給時間軸，請移除那條路由。',
      },
      {
        en: 'With `createShow()`, routes are added before the sound engine registers its `sound/*` params, so a route to `sound/cutoff` needs an explicit `outMin: 100, outMax: 8000`.',
        zh: '在 `createShow()` 裡，路由加進去的時間比聲音引擎登記 `sound/*` 參數還早，所以接到 `sound/cutoff` 的路由要明確寫上 `outMin: 100, outMax: 8000`。',
      },
      {
        en: 'More, with the saved-profile rules: [Mapping](https://openaudiovisual.com/docs/#mapping).',
        zh: '更多內容與存檔規則：[映射](https://openaudiovisual.com/zh/docs/#mapping)。',
      },
    ],
    examples: [
      {
        code: `import { Signals, Params } from '@openav/core';
import { Mapper } from '@openav/mapping';

const signals = new Signals();
const params = new Params([{ key: 'bloom', min: 0, max: 100, def: 10 }]);
const mapper = new Mapper({ signals, params });

mapper.addRoute({ source: 'midi/cc/74', target: 'bloom', curve: 'exp' });
signals.set('midi/cc/74', 0.5);
console.log(params.resolve().bloom);   // 25: 0.5 through the exp curve is 0.25 of the range 0..100`,
        caption: { en: 'The console prints `25`: the knob is halfway, the `exp` curve squares it to 0.25, and that is a quarter of the way along 0..100.', zh: '主控台印出 `25`：旋鈕在一半，`exp` 曲線把它平方成 0.25，也就是 0..100 的四分之一。' },
      },
      {
        code: `import { Signals, Params } from '@openav/core';
import { Mapper } from '@openav/mapping';

const signals = new Signals();
const params = new Params([{ key: 'hue', min: 0, max: 360, def: 0 }]);
const mapper = new Mapper({ signals, params });

mapper.addRoute({ source: 'audio/rms', target: 'hue', inMax: 0.3, smooth: 0.5 });
signals.set('audio/rms', 0.3);                       // a voice at 0.3 is the whole range
console.log(params.resolve().hue);                   // 0: nothing moved yet
mapper.update(0.5);                                  // half a second = one time constant
console.log(params.resolve().hue.toFixed(1));        // 227.6: about 63% of 360`,
        caption: { en: 'A smoothed route only moves inside `update(dt)`: the console prints `0`, then `227.6` after half a second (63% of the way to 360).', zh: '平滑的路由只會在 `update(dt)` 裡動：主控台先印出 `0`，半秒之後印出 `227.6`（走了 360 的 63%）。' },
      },
      {
        code: `import { Signals, Params } from '@openav/core';
import { Mapper } from '@openav/mapping';

const signals = new Signals();
const params = new Params([{ key: 'bloom', min: 0, max: 100, def: 10 }]);
const mapper = new Mapper({ signals, params, onLearn: (route, name) => console.log('bound', name) });

signals.define('knob/a');
signals.set('knob/a', 0.5);
mapper.learn('bloom');                  // arm learn for the param
signals.set('knob/a', 0.51);            // moved 1%: not enough
signals.set('knob/a', 0.8);             // moved 30%: bound
console.log(mapper.routesFor('bloom').map((r) => r.source), mapper.learnTarget);`,
        caption: { en: 'Learn waits for a real movement: the console prints `bound knob/a`, then `[ \'knob/a\' ] null` (learn disarms itself once it has bound a signal).', zh: 'learn 會等到真正的移動：主控台印出 `bound knob/a`，然後是 `[ \'knob/a\' ] null`（綁定一個訊號之後，learn 會自己解除）。' },
      },
      {
        code: `import { Signals, Params } from '@openav/core';
import { Mapper } from '@openav/mapping';

function rig(profile) {
  const signals = new Signals();
  signals.define('audio/rms');
  const params = new Params([{ key: 'bloom', min: 0, max: 100, def: 0 }]);
  return { signals, params, mapper: new Mapper({ signals, params, profile }) };
}
const a = rig('garden');
a.mapper.addRoute({ source: 'audio/rms', target: 'bloom', curve: 'log', inMax: 0.3 });
const file = a.mapper.exportMap();                    // the portable file
const report = rig('garden').mapper.importMap(file);  // on another machine or in another page
console.log(file.format, file.version, report.ok, report.added, report.skipped);`,
        caption: { en: 'A wiring travels as a file: the console prints `openav.map 1 true 1 []`.', zh: '一份接線可以變成檔案帶著走：主控台印出 `openav.map 1 true 1 []`。' },
      },
    ],
    related: ['Signals', 'Params', 'LearnWizard', 'parseMap', 'serializeMap', 'loadMapUrl', 'createShow', 'approach'],
    keywords: {
      en: ['mapper', 'mapping', 'route', 'routes', 'learn', 'midi learn', 'curve', 'smooth', 'invert', 'window', 'inMin', 'outMin', 'source target', 'bind', 'connect signal to param'],
      zh: ['映射', '路由', '接線', '綁定', '曲線', '平滑', '反轉', '輸入窗', '學習', '訊號接參數', '覆寫'],
    },
  },

  LearnWizard: {
    group: 'mapping',
    summary: {
      en: 'Binds a list of params one after another: it arms learn for the first, you turn a knob, it binds it and arms the next. Skip, back and stop steer it.',
      zh: '依序綁定一整串參數：先替第一個備好 learn，你轉一個旋鈕，它就綁上去，再備好下一個。skip、back、stop 可以操控它。',
    },
    params: [
      {
        name: 'mapper', type: 'Mapper', optional: false,
        en: 'The [`Mapper`](#Mapper) to bind through.',
        zh: '要透過它綁定的 [`Mapper`](#Mapper)。',
      },
      {
        name: 'keys', type: 'Array<String> | Function', optional: false,
        en: 'The param keys to bind, in order, or a function that returns them (it is called when `start()` runs).',
        zh: '要綁定的參數 key，依序排列。也可以是回傳它們的函式（在 `start()` 執行時呼叫）。',
      },
      {
        name: 'onChange', type: 'Function | null', optional: true, default: 'null',
        en: 'Called with the wizard whenever what a banner would show changes: the current param, the position, finished or not.',
        zh: '只要橫幅會顯示的內容改變（目前的參數、位置、有沒有結束），就以這個精靈本身呼叫。',
      },
    ],
    description: [
      {
        en: 'Binding twelve params one by one with the learn chip means twelve clicks and twelve guesses about what to touch next. The wizard walks the list for you: `start()` arms learn for `keys[0]`, `wizard.current` says which param it is waiting for (\'Turn a knob for: hue (1/12)\'), you move a control, it is bound and the next one is armed. At the end learn is disarmed. The console\'s **🎛 map knobs in order** button is this class.',
        zh: '用 learn 標籤一個一個綁十二個參數，就是點十二次，還要猜十二次下一個該碰哪裡。精靈替你走完整份清單：`start()` 替 `keys[0]` 備好 learn，`wizard.current` 告訴你它在等哪個參數（「Turn a knob for: hue (1/12)」），你動一個控制項，它就綁上去，然後備好下一個。全部結束後，learn 會解除。主控台的 **🎛 map knobs in order** 按鈕就是這個類別。',
      },
      {
        en: 'It is pure logic on top of the mapper, with no screen of its own. Learn only ever adds routes, so running the wizard twice puts a second control on a param instead of losing the first. While it runs, it owns learn mode: call `sync()` every frame so that a click on some other learn chip cannot leave it waiting for nothing.',
        zh: '它是建在映射上面的純邏輯，沒有自己的畫面。learn 只會新增路由，所以跑兩次精靈，是替參數多加一個控制項，不會弄丟第一個。它在跑的時候擁有 learn 模式：請每個畫面呼叫 `sync()`，這樣有人點了別的 learn 標籤，也不會讓它空等。',
      },
    ],
    members: {
      total: {
        en: 'How many params are in this run.',
        zh: '這一輪總共有幾個參數。',
      },
      current: {
        en: 'The param key being waited for, or `null` when the wizard is not running.',
        zh: '正在等待綁定的參數 key，精靈沒在跑的時候是 `null`。',
      },
      start: {
        en: 'Read the keys, arm the first one and begin. Returns `false` (and does nothing) when the list is empty.',
        zh: '讀取 keys、備好第一個然後開始。清單是空的就回傳 `false`，什麼也不做。',
      },
      skip: {
        en: 'Leave the current param unbound and wait for the next one. Skipping the last one finishes the run.',
        zh: '不綁目前的參數，改等下一個。略過最後一個就結束這一輪。',
      },
      back: {
        en: 'Go back to the previous param. It keeps what it already has; a turned knob adds one more.',
        zh: '回到上一個參數。它原有的路由保留，再轉旋鈕就多加一條。',
      },
      stop: {
        en: 'End the run now and disarm learn. `done` stays `false`.',
        zh: '現在就結束這一輪並解除 learn。`done` 維持 `false`。',
      },
      sync: {
        en: 'Call every frame: if learn mode was switched off or pointed elsewhere while the wizard runs, it re-arms the current param.',
        zh: '每個畫面呼叫：如果精靈在跑的時候 learn 模式被關掉或指到別處，它會重新替目前的參數備好。',
      },
    },
    notes: [
      {
        en: 'Fields to read: `active`, `done` (the run reached the end), `index`, `total`, `order`, and `added` (`[{ key, source }]`, what was bound in this run).',
        zh: '可以讀的欄位：`active`、`done`（這一輪走到了最後）、`index`、`total`、`order`，以及 `added`（`[{ key, source }]`，這一輪綁了什麼）。',
      },
      {
        en: 'While it runs the wizard wraps the mapper\'s `onLearn` and puts yours back when it ends, so your own `onLearn` keeps being called.',
        zh: '精靈在跑的時候會包住映射的 `onLearn`，結束時再還給你，所以你自己的 `onLearn` 照樣會被呼叫。',
      },
    ],
    examples: [
      {
        code: `import { Signals, Params } from '@openav/core';
import { Mapper, LearnWizard } from '@openav/mapping';

const signals = new Signals();
for (const name of ['knob/1', 'knob/2']) signals.define(name, { min: 0, max: 1 });
const params = new Params([{ key: 'hue', min: 0, max: 360, def: 0 }, { key: 'size', min: 0, max: 1, def: 0.2 }]);
const mapper = new Mapper({ signals, params });
const wizard = new LearnWizard({ mapper, keys: () => params.schema.map((p) => p.key) });

wizard.start();
console.log('waiting for', wizard.current);                       // hue
const turn = (name) => { signals.set(name, 0); signals.set(name, 0.9); };   // a knob that moves a lot
turn('knob/1'); console.log('waiting for', wizard.current);       // size
turn('knob/2'); console.log(wizard.done, wizard.added);`,
        caption: { en: 'The console prints `waiting for hue`, `waiting for size`, then `true` and the two bindings `[ { key: \'hue\', source: \'knob/1\' }, { key: \'size\', source: \'knob/2\' } ]`.', zh: '主控台印出 `waiting for hue`、`waiting for size`，然後是 `true` 和兩個綁定 `[ { key: \'hue\', source: \'knob/1\' }, { key: \'size\', source: \'knob/2\' } ]`。' },
      },
    ],
    related: ['Mapper', 'Params', 'mountConsole'],
    keywords: {
      en: ['learn wizard', 'wizard', 'map knobs in order', 'learn', 'bind', 'midi learn', 'skip', 'back', 'stop'],
      zh: ['精靈', '依序綁定', 'learn', '學習', '綁定', '旋鈕', '略過', '上一個'],
    },
  },

  MAP_FORMAT: {
    group: 'mapping',
    summary: {
      en: 'The text `"openav.map"`: the value of `format` in every map file. A file with another format is refused.',
      zh: '文字 `"openav.map"`：每個映射檔裡 `format` 的值。格式不同的檔案會被拒絕。',
    },
    description: [
      {
        en: 'A map file is JSON with `"format": "openav.map"`, a `version`, a `world` name and a list of `routes`. [`parseMap()`](#parseMap) refuses anything whose `format` is not this string, so you cannot import some other tool\'s JSON by accident. The one exception is a bare array (what `mapper.toJSON()` returns), which is read as version 0.',
        zh: '映射檔是 JSON，裡面有 `"format": "openav.map"`、`version`、`world` 名稱和一份 `routes` 清單。[`parseMap()`](#parseMap) 會拒絕 `format` 不是這個字串的東西，所以不會誤把別的工具的 JSON 匯進來。唯一的例外是單純的陣列（`mapper.toJSON()` 回傳的那種），會被當成版本 0 來讀。',
      },
    ],
    related: ['MAP_VERSION', 'MAP_MAX_BYTES', 'parseMap', 'serializeMap'],
    keywords: {
      en: ['map format', 'openav.map', 'map file', 'format', 'json'],
      zh: ['映射檔', '格式', 'openav.map', 'json'],
    },
  },

  MAP_VERSION: {
    group: 'mapping',
    summary: {
      en: 'The newest map file version this build reads and writes: 1. A file with a higher version is refused with a message.',
      zh: '這個版本能讀也能寫的映射檔最新版本：1。版本更高的檔案會被拒絕並給出訊息。',
    },
    description: [
      {
        en: '[`serializeMap()`](#serializeMap) writes this number and [`parseMap()`](#parseMap) accepts any version from 1 up to it. A newer file gets the message "this build of OAV reads up to version 1. Update OAV or re-export it." A file with no valid `version` is refused too. Only a bare array of routes counts as version 0.',
        zh: '[`serializeMap()`](#serializeMap) 寫入這個數字，[`parseMap()`](#parseMap) 接受從 1 到它之間的任何版本。更新的檔案會得到這句訊息：`this build of OAV reads up to version 1. Update OAV or re-export it.` 沒有合法 `version` 的檔案也會被拒絕。只有單純的路由陣列會被當成版本 0。',
      },
    ],
    related: ['MAP_FORMAT', 'MAP_MAX_BYTES', 'parseMap'],
    keywords: {
      en: ['map version', 'version', 'map file', 'compatibility'],
      zh: ['映射檔版本', '版本', '相容'],
    },
  },

  MAP_MAX_BYTES: {
    group: 'mapping',
    summary: {
      en: 'The longest map text `parseMap()` will read: 262144, which is 256 KB. Longer text is refused without being parsed.',
      zh: '`parseMap()` 願意讀的映射文字長度上限：262144，也就是 256 KB。更長的文字不會解析，直接拒絕。',
    },
    description: [
      {
        en: 'The limit is compared with the length of the text (characters), before any parsing, so a huge file cannot freeze the page. A map with more than 500 routes is refused as well, whatever its size.',
        zh: '這個上限是拿文字的長度（字元數）來比，在任何解析之前就比，所以很大的檔案不會讓頁面卡住。路由超過 500 條的映射檔也會被拒絕，不管大小。',
      },
    ],
    related: ['parseMap', 'MAP_FORMAT', 'MAP_VERSION'],
    keywords: {
      en: ['map size', 'limit', '256 KB', 'max routes', 'map file'],
      zh: ['映射檔大小', '上限', '256 KB', '路由數量'],
    },
  },

  serializeMap: {
    group: 'mapping',
    summary: {
      en: 'Builds the portable map file object from a list of routes: `{ format, version, world, exported, routes }`.',
      zh: '把一份路由清單做成可攜的映射檔物件：`{ format, version, world, exported, routes }`。',
    },
    params: [
      {
        name: 'routes', type: 'Array',
        en: 'Routes in the mapper\'s own shape (what `mapper.toJSON()` returns: `source`, `target`, `inMin`, `outMax` …).',
        zh: '映射本身格式的路由（`mapper.toJSON()` 回傳的那種：`source`、`target`、`inMin`、`outMax` ……）。',
      },
      {
        name: 'world', type: 'String', optional: true, default: '\'default\'',
        en: 'The world name written into the file. Importing into another world drops the output ranges.',
        zh: '寫進檔案的世界名稱。匯入到別的世界時，輸出範圍會被丟掉。',
      },
      {
        name: 'now', type: 'Date | String', optional: true, default: 'new Date()',
        en: 'The time written as `exported` (an ISO string). Pass a fixed date to get the same file twice.',
        zh: '寫成 `exported` 的時間（ISO 字串）。傳一個固定的日期，就能得到兩次相同的檔案。',
      },
    ],
    returns: {
      type: 'Object',
      en: '`{ format: \'openav.map\', version: 1, world, exported, routes: [{ signal, param, curve, range: { in: [inMin, inMax], out: [outMin, outMax] }, smooth, invert }] }`. A muted route also carries `enabled: false`.',
      zh: '`{ format: \'openav.map\', version: 1, world, exported, routes: [{ signal, param, curve, range: { in: [inMin, inMax], out: [outMin, outMax] }, smooth, invert }] }`。被靜音的路由會多一個 `enabled: false`。',
    },
    description: [
      {
        en: 'Routes in a map file are named by **signal** and **param**, never by id, so the file can travel between worlds. `mapper.exportMap()` calls this for you; use `serializeMap()` directly when you build routes by hand or want a fixed date. Missing `inMin`/`inMax` become 0 and 1, missing `curve` is `\'linear\'`, and the output range is 0..1 unless the route has `outMin`/`outMax`.',
        zh: '映射檔裡的路由是用**訊號**和**參數**的名字來指，不用 id，所以檔案可以在不同世界之間搬運。`mapper.exportMap()` 會替你呼叫它。自己手寫路由、或想要固定日期時，才需要直接用 `serializeMap()`。沒寫的 `inMin`/`inMax` 會變成 0 和 1，沒寫的 `curve` 是 `\'linear\'`，沒有 `outMin`/`outMax` 的話輸出範圍是 0..1。',
      },
    ],
    examples: [
      {
        code: `import { serializeMap } from '@openav/mapping';

const file = serializeMap(
  [{ source: 'midi/cc/74', target: 'bloom', curve: 'exp', outMax: 100 }],
  { world: 'garden', now: new Date('2026-10-19T00:00:00Z') },
);
console.log(JSON.stringify(file));`,
        caption: { en: 'The console prints the whole file as one line of JSON, starting `{"format":"openav.map","version":1,"world":"garden","exported":"2026-10-19T00:00:00.000Z","routes":[{"signal":"midi/cc/74","param":"bloom","curve":"exp","range":{"in":[0,1],"out":[0,100]} …`.', zh: '主控台把整個檔案印成一行 JSON，開頭是 `{"format":"openav.map","version":1,"world":"garden","exported":"2026-10-19T00:00:00.000Z","routes":[{"signal":"midi/cc/74","param":"bloom","curve":"exp","range":{"in":[0,1],"out":[0,100]} …`。' },
      },
    ],
    related: ['parseMap', 'Mapper', 'MAP_FORMAT', 'MAP_VERSION'],
    keywords: {
      en: ['serialize map', 'export map', 'save map', 'map file', 'json', 'export routes'],
      zh: ['匯出映射', '儲存映射', '映射檔', '序列化', 'json', '匯出路由'],
    },
  },

  parseMap: {
    group: 'mapping',
    summary: {
      en: 'Reads and cleans a map file (JSON text or a parsed value) without touching any mapper; it never throws.',
      zh: '讀取並整理一份映射檔（JSON 文字或已解析的值），不會動到任何映射，也絕不丟出例外。',
    },
    params: [
      {
        name: 'input', type: 'String | Object | Array',
        en: 'The JSON text of a map file, an already parsed map object, or a bare array of routes (version 0).',
        zh: '映射檔的 JSON 文字、已經解析好的映射物件，或單純的路由陣列（版本 0）。',
      },
    ],
    returns: {
      type: 'Object',
      en: '`{ ok: true, version, world, routes, dropped }` or `{ ok: false, error }`. Each route is `{ signal, param, curve, inMin, inMax, outMin?, outMax?, smooth, invert, enabled }`; `dropped` counts the entries that were not routes.',
      zh: '`{ ok: true, version, world, routes, dropped }` 或 `{ ok: false, error }`。每條路由是 `{ signal, param, curve, inMin, inMax, outMin?, outMax?, smooth, invert, enabled }`。`dropped` 是不算路由而被丟掉的項目數。',
    },
    description: [
      {
        en: 'Use it to validate a file before you import it, or to show what is inside one. It refuses, with a plain-language `error`, text that is not JSON, text longer than [`MAP_MAX_BYTES`](#MAP_MAX_BYTES), an object whose `format` is not [`MAP_FORMAT`](#MAP_FORMAT), a missing or newer `version`, no `routes` list, and more than 500 routes.',
        zh: '用它在匯入之前檢查檔案，或看看檔案裡有什麼。下列情形它會用白話的 `error` 拒絕：文字不是 JSON、文字比 [`MAP_MAX_BYTES`](#MAP_MAX_BYTES) 長、物件的 `format` 不是 [`MAP_FORMAT`](#MAP_FORMAT)、`version` 缺少或比較新、沒有 `routes` 清單，以及超過 500 條路由。',
      },
      {
        en: 'What it accepts is cleaned: a route without a string `signal` and `param` is dropped (and counted in `dropped`), unknown keys disappear, numbers must be finite, an unknown `curve` becomes `\'linear\'`, `smooth` is held to 0..60 seconds, and only `invert: true` inverts. A route is on unless it says `enabled: false`.',
        zh: '接受的內容都會被整理過：沒有字串 `signal` 和 `param` 的路由會被丟掉（並算進 `dropped`），不認得的欄位會消失，數字必須有限，不認得的 `curve` 變成 `\'linear\'`，`smooth` 限制在 0 到 60 秒，只有 `invert: true` 才會反轉。路由除非寫了 `enabled: false`，否則是開著的。',
      },
    ],
    examples: [
      {
        code: `import { parseMap } from '@openav/mapping';

const good = parseMap('{"format":"openav.map","version":1,"routes":[{"signal":"audio/rms","param":"bloom","curve":"wobble"},{"signal":7}]}');
console.log(good.ok, good.routes[0].curve, good.dropped);   // true linear 1
console.log(parseMap('not json'));                          // { ok: false, error: 'not valid JSON' }
console.log(parseMap('{"format":"other","version":1}'));   // refused: not an OAV map`,
        caption: { en: 'The console prints `true linear 1` (the unknown curve became linear, the broken route was dropped), then the two refusals with their reasons.', zh: '主控台印出 `true linear 1`（不認得的曲線變成 linear，壞掉的路由被丟掉），然後是兩個被拒絕的情形與原因。' },
      },
    ],
    related: ['serializeMap', 'Mapper', 'MAP_FORMAT', 'MAP_VERSION', 'MAP_MAX_BYTES', 'loadMapUrl'],
    keywords: {
      en: ['parse map', 'read map', 'validate map', 'import map', 'map file', 'json', 'check map'],
      zh: ['讀取映射', '解析映射', '檢查映射', '匯入映射', '映射檔', '驗證'],
    },
  },

  parseMapUrl: {
    group: 'mapping',
    summary: {
      en: 'Decides whether a `?map=` address may be fetched: same origin, or an absolute https URL, and nothing else.',
      zh: '判斷一個 `?map=` 的網址能不能去抓：同源的，或絕對的 https 網址，其他一律不行。',
    },
    params: [
      {
        name: 'value', type: 'String',
        en: 'The address as typed: absolute, or relative to `base`.',
        zh: '輸入的網址：絕對網址，或相對於 `base` 的網址。',
      },
      {
        name: 'base', type: 'String',
        en: 'The page address that relative addresses resolve against, and that "same origin" is judged by. Usually `location.href`.',
        zh: '相對網址據以解析、「同源」據以判斷的頁面網址。通常是 `location.href`。',
      },
    ],
    returns: {
      type: 'Object',
      en: '`{ ok: true, url }` with the resolved address, or `{ ok: false, error }`.',
      zh: '`{ ok: true, url }`（解析後的網址），或 `{ ok: false, error }`。',
    },
    description: [
      {
        en: 'A map file named in the page address is somebody else\'s data, so the rules are strict. Accepted: an address on the same origin as `base` (any scheme, so plain `http://localhost` works for a page served from there), or an absolute `https:` address. Refused: an empty address, one longer than 2048 characters, one that is not a URL, one carrying a user name or password, `http:` to another host, and `data:`, `javascript:`, `file:`, `blob:` and every other scheme. [`loadMapUrl()`](#loadMapUrl) runs this check before it fetches anything.',
        zh: '網址列上指定的映射檔是別人的資料，所以規則很嚴。接受：跟 `base` 同源的網址（任何通訊協定，所以從 `http://localhost` 提供的頁面用 `http://localhost` 也行），或絕對的 `https:` 網址。拒絕：空網址、超過 2048 個字元、不是網址、帶有帳號或密碼、指向別的主機的 `http:`，以及 `data:`、`javascript:`、`file:`、`blob:` 和其他所有通訊協定。[`loadMapUrl()`](#loadMapUrl) 在抓任何東西之前都會先跑這個檢查。',
      },
    ],
    examples: [
      {
        code: `import { parseMapUrl } from '@openav/mapping';

const base = 'https://openaudiovisual.com/examples/01-hello-particles/';
console.log(parseMapUrl('maps/stage-left.json', base));            // ok: same origin, resolved
console.log(parseMapUrl('https://example.com/my-map.json', base));  // ok: https
console.log(parseMapUrl('http://example.com/my-map.json', base));   // refused: http to another site
console.log(parseMapUrl('javascript:alert(1)', base));              // refused: not http or https`,
        caption: { en: 'The console prints two accepted results (the first with the full resolved address `https://openaudiovisual.com/examples/01-hello-particles/maps/stage-left.json`) and two refusals with their reasons.', zh: '主控台印出兩個接受的結果（第一個是完整解析後的網址 `https://openaudiovisual.com/examples/01-hello-particles/maps/stage-left.json`）和兩個被拒絕的情形與原因。' },
      },
    ],
    related: ['loadMapUrl', 'parseMap', 'Mapper'],
    keywords: {
      en: ['map url', '?map=', 'url check', 'https', 'same origin', 'cors', 'load map from address'],
      zh: ['映射網址', '?map=', '網址檢查', 'https', '同源', '從網址載入'],
    },
  },

  loadMapUrl: {
    group: 'mapping',
    summary: {
      en: 'Fetches a map file from an address (what `?map=` calls) and puts it on the mapper; it never throws and never blocks the show.',
      zh: '從一個網址抓映射檔（`?map=` 呼叫的就是它）並放到映射上，絕不丟出例外，也不會卡住演出。',
    },
    params: [
      {
        name: 'mapper', type: 'Mapper',
        en: 'The [`Mapper`](#Mapper) to import into.',
        zh: '要匯入的 [`Mapper`](#Mapper)。',
      },
      {
        name: 'value', type: 'String',
        en: 'The address of the map file, checked by [`parseMapUrl()`](#parseMapUrl) first.',
        zh: '映射檔的網址，會先經過 [`parseMapUrl()`](#parseMapUrl) 檢查。',
      },
      {
        name: 'base', type: 'String', optional: true, default: 'location.href',
        en: 'The page address that relative addresses resolve against.',
        zh: '相對網址據以解析的頁面網址。',
      },
      {
        name: 'fetchImpl', type: 'Function', optional: true, default: 'fetch',
        en: 'The function that does the request. Replace it to test without a network.',
        zh: '真正發出請求的函式。換掉它，就能在沒有網路的情況下測試。',
      },
      {
        name: 'timeoutMs', type: 'Number', optional: true, default: '8000',
        en: 'Give up after this many milliseconds.',
        zh: '超過這麼多毫秒就放棄。',
      },
    ],
    returns: {
      type: 'Promise<Object>',
      en: 'The report: what `mapper.importMap()` returned (`source: \'url\'`, `address`, `added`, `skipped` …), or `{ ok: false, source: \'url\', address, error }`. The same report is kept in `mapper.report`.',
      zh: '報告：`mapper.importMap()` 的回傳值（`source: \'url\'`、`address`、`added`、`skipped` ……），或 `{ ok: false, source: \'url\', address, error }`。同一份報告也存在 `mapper.report`。',
    },
    description: [
      {
        en: 'Fetches the address with `credentials: \'omit\'`, and `importMap()`s the text. Any failure (refused address, no `fetch`, the server answered 404, offline, a site that blocks cross-origin reads, a timeout, a file that is not a map) lands in the report and in `mapper.report`, where the console shows it, and the routes stay as they were. It is async, so `createShow()` does not wait for it and the show starts regardless.',
        zh: '用 `credentials: \'omit\'` 去抓這個網址，再把文字交給 `importMap()`。任何失敗（網址被拒絕、沒有 `fetch`、伺服器回 404、離線、擋住跨來源讀取的網站、逾時、檔案不是映射檔）都會寫進報告和 `mapper.report`，主控台會顯示出來，路由維持原樣。它是非同步的，所以 `createShow()` 不會等它，演出照常開始。',
      },
      {
        en: 'A map on another site must be served with CORS (`Access-Control-Allow-Origin: *`); raw GitHub files and gists are. In a show you rarely call it: open the page with `?map=<url>`, or pass `map: \'maps/a.json\'` to `createShow()`.',
        zh: '別的網站上的映射檔必須用 CORS 提供（`Access-Control-Allow-Origin: *`），raw GitHub 檔案和 gist 都可以。做演出的時候很少直接呼叫它：開頁面時加上 `?map=<url>`，或在 `createShow()` 傳 `map: \'maps/a.json\'` 就行了。',
      },
    ],
    examples: [
      {
        code: `import { Signals, Params } from '@openav/core';
import { Mapper, loadMapUrl } from '@openav/mapping';

const signals = new Signals();
signals.define('audio/rms');
const params = new Params([{ key: 'bloom', min: 0, max: 100, def: 0 }]);
const mapper = new Mapper({ signals, params, profile: 'garden' });

const file = { format: 'openav.map', version: 1, world: 'garden', routes: [{ signal: 'audio/rms', param: 'bloom' }] };
const fetchImpl = async () => ({ ok: true, status: 200, text: async () => JSON.stringify(file) });   // no network needed
const report = await loadMapUrl(mapper, 'maps/stage-left.json', { base: 'https://openaudiovisual.com/x/', fetchImpl });
console.log(report.ok, report.address, report.added);`,
        caption: { en: 'With a stand-in for the network, the console prints `true https://openaudiovisual.com/x/maps/stage-left.json 1`: the route came in.', zh: '用一個代替網路的函式，主控台印出 `true https://openaudiovisual.com/x/maps/stage-left.json 1`：路由進來了。' },
      },
      {
        code: `import { Signals, Params } from '@openav/core';
import { Mapper, loadMapUrl } from '@openav/mapping';

const mapper = new Mapper({ signals: new Signals(), params: new Params([]) });
const report = await loadMapUrl(mapper, 'http://example.com/map.json', { base: 'https://openaudiovisual.com/' });
console.log(report.ok, report.error);        // false 'a map from another site must be served over https'
console.log(mapper.report === report);       // true: the console would show it too`,
        caption: { en: 'A refused address is a report, not an exception: the console prints `false a map from another site must be served over https`, then `true`.', zh: '被拒絕的網址是一份報告，不是例外：主控台印出 `false a map from another site must be served over https`，然後是 `true`。' },
      },
    ],
    related: ['parseMapUrl', 'parseMap', 'Mapper', 'createShow'],
    keywords: {
      en: ['load map', '?map=', 'fetch map', 'map url', 'import from url', 'share mapping', 'load mapping file'],
      zh: ['載入映射', '?map=', '抓映射檔', '從網址匯入', '分享映射', '映射網址'],
    },
  },
};
