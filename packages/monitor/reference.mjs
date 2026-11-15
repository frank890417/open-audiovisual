// @openav/monitor reference: the backstage feed. The show page streams JSON snapshots to a relay that a stage manager's phone can watch.
// Read by tools/build-reference.mjs (see AGENTS.md, "Documenting a public name").

export default {
  MonitorFeed: {
    group: 'backstage',
    summary: {
      en: 'Streams snapshots of the running show to the backstage relay over a WebSocket, at most `hz` times a second, and quietly keeps trying when there is no relay.',
      zh: '把正在進行的演出的快照透過 WebSocket 串流到後台中繼站，每秒最多 `hz` 次，沒有中繼站的時候安靜地持續嘗試。',
    },
    params: [
      {
        name: 'url', type: 'String | null', optional: true, default: 'defaultMonitorUrl()',
        en: 'The relay address, such as `\'ws://192.168.1.20:7457\'` (`?role=stage` is added for you). The default comes from [`defaultMonitorUrl()`](#defaultMonitorUrl): the page\'s own host on port 7457, and `null` on an https page. With `null`, `connect()` does nothing.',
        zh: '中繼站的位址，例如 `\'ws://192.168.1.20:7457\'`（`?role=stage` 會替你加上去）。預設值來自 [`defaultMonitorUrl()`](#defaultMonitorUrl)：頁面自己的主機加上 7457 連接埠，https 頁面則是 `null`。是 `null` 的時候，`connect()` 什麼都不做。',
      },
      {
        name: 'hz', type: 'Number', optional: true, default: '15',
        en: 'The most snapshots sent per second.',
        zh: '每秒最多送出幾個快照。',
      },
      {
        name: 'extra', type: 'Function | null', optional: true, default: 'null',
        en: 'The same as calling `feed.extra(fn)` once: a function that returns the work\'s own numbers, `{ field: value }`, for the backstage **Work** panel.',
        zh: '等於呼叫一次 `feed.extra(fn)`：一個回傳作品自己的數字 `{ 欄位: 值 }` 的函式，顯示在後台的 **Work** 面板。',
      },
    ],
    description: [
      {
        en: 'A show without a backstage is a rehearsal. Run the relay on the machine that serves the show (`node packages/monitor/server.js`, port 7457, which also serves the backstage page at `/` and `GET /health`), and a stage manager\'s phone or laptop on the same network opens `http://<that machine>:7457/` to see the clock, the scene, the world, the frame rate, the overrides and every signal and param live, with a red "stage feed lost" banner when the stage stops sending for 4 seconds. The show page joins as `?role=stage`; every other socket is a monitor. [`createShow()`](#createShow) already creates and connects one, so you only build a `MonitorFeed` for a show you assembled by hand.',
        zh: '沒有後台的演出只是排練。在提供演出頁面的那台機器上跑中繼站（`node packages/monitor/server.js`，連接埠 7457，它同時在 `/` 提供後台頁面，並有 `GET /health`），同一個網路上舞台監督的手機或筆電打開 `http://<那台機器>:7457/`，就能即時看到時鐘、場景、世界、影格率、覆寫，以及每個訊號和參數。舞台超過 4 秒沒有送資料，就會出現紅色的「stage feed lost」橫幅。演出頁面是以 `?role=stage` 加入的，其他所有 socket 都是監看端。[`createShow()`](#createShow) 已經會建好並連上一個，所以只有手工組裝的演出才需要自己建 `MonitorFeed`。',
      },
      {
        en: 'It is made to cost nothing when left on: with no relay it reconnects with a growing delay (about 5 seconds, growing by 1.6 each time up to 30), though the browser logs each refused connection, and that message is expected. `frame()` throttles itself, so call it every frame with a snapshot (see [`snapshotOf()`](#snapshotOf)).',
        zh: '它的設計是一直開著也不花什麼成本：沒有中繼站的時候，它用愈來愈長的間隔重連（大約 5 秒，每次乘以 1.6，最長 30 秒），不過瀏覽器會把每次被拒絕的連線記下來，那個訊息是預期中的。`frame()` 自己會節流，所以每個畫面都可以用一份快照呼叫它（見 [`snapshotOf()`](#snapshotOf)）。',
      },
      {
        en: 'A work can send numbers of its own (a simulation tick, a drift, a count of bad values), and the backstage shows them in a **Work** panel. There are three ways in, and a show that uses none sends not one byte more: `feed.extra(fn)`, the `extra` field of [`snapshotOf()`](#snapshotOf), and a `monitor()` method on the active world. A value is a number, a string, a boolean or `null`, or `{ v, min, max, warn }`: with `min` and `max` the backstage draws a bar, and `warn: true` turns it red. [`cleanExtra()`](#cleanExtra) is the filter they all pass through.',
        zh: '作品可以送自己的數字（模擬的 tick、漂移、壞值的次數），後台會把它們顯示在 **Work** 面板。送的方式有三種，都不用的演出一個位元組都不會多送：`feed.extra(fn)`、[`snapshotOf()`](#snapshotOf) 的 `extra` 欄位，以及目前世界上的 `monitor()` 方法。值可以是數字、字串、布林或 `null`，也可以是 `{ v, min, max, warn }`：有 `min` 和 `max` 後台就畫量條，`warn: true` 會讓它變紅。它們全都會經過 [`cleanExtra()`](#cleanExtra) 這道過濾。',
      },
    ],
    needs: {
      en: 'Call `connect()` once (a show does), then `frame(snapshot)` every frame. `frame()` does nothing while `connected` is false. The relay must be reachable from the page: on an https page the browser blocks `ws://` (mixed content), so give a `wss://` address explicitly.',
      zh: '呼叫一次 `connect()`（演出會做），之後每個畫面呼叫 `frame(snapshot)`。`connected` 是 false 的時候，`frame()` 什麼都不做。頁面必須連得到中繼站：在 https 頁面上，瀏覽器會擋住 `ws://`（混合內容），所以請明確給一個 `wss://` 位址。',
    },
    members: {
      extra: {
        en: '`extra(fn)`: add a provider, `fn() → { field: value }`. It is asked only when a frame is really sent (a throttled call does not ask), so a costly measurement is cheaper here than in `snapshotOf()`. Its fields are laid over `snapshot.extra`; with several providers, the one added later wins a shared name. Returns a function that removes it. Anything that is not a function is ignored.',
        zh: '`extra(fn)`：掛上一個提供者，`fn() → { 欄位: 值 }`。只有真的要送出一幀的時候才會問它（被節流掉的呼叫不問），所以貴一點的量測放這裡比放 `snapshotOf()` 划算。它的欄位會疊在 `snapshot.extra` 上面。有好幾個提供者的時候，同名的欄位以後掛的為準。回傳一個用來取消的函式。傳進來的不是函式就忽略。',
      },
      connect: {
        en: 'Open the socket. Does nothing without a `url`. If the connection drops or cannot be made, it tries again after a growing delay. The `onStatus(ok)` hook is called when it connects and when it drops.',
        zh: '開啟 socket。沒有 `url` 的時候什麼都不做。連線中斷或連不上，會在一段愈來愈長的間隔之後重試。連上和中斷的時候都會呼叫 `onStatus(ok)` 掛鉤。',
      },
      frame: {
        en: 'Send a snapshot (anything that survives `JSON.stringify`; `snapshotOf()` builds the usual one). The message is `{ at: Date.now(), ...snapshot }`. Throttled to `hz`: calls closer together than that are dropped, and nothing is sent while disconnected.',
        zh: '送出一份快照（任何能通過 `JSON.stringify` 的東西，一般的快照由 `snapshotOf()` 建出來）。訊息是 `{ at: Date.now(), ...snapshot }`。依 `hz` 節流：間隔比它更近的呼叫會被丟掉，沒有連線的時候什麼都不送。',
      },
    },
    notes: [
      {
        en: 'Fields to read and set: `url` (with `?role=stage` appended, or `null`), `hz`, `connected`, `ws`, and the hook `onStatus = (ok) => {}`.',
        zh: '可以讀、可以設的欄位：`url`（附上 `?role=stage`，或是 `null`）、`hz`、`connected`、`ws`，以及掛鉤 `onStatus = (ok) => {}`。',
      },
      {
        en: 'On a public https page a hand-assembled show that connects to `ws://127.0.0.1:7457` meets Chrome\'s Local Network Access prompt (from Chrome 147 for WebSockets, per the package README): press Allow, or open the page from `http://localhost`.',
        zh: '在公開的 https 頁面上，手工組裝的演出如果連 `ws://127.0.0.1:7457`，會遇到 Chrome 的區域網路存取詢問（依套件 README，WebSocket 從 Chrome 147 開始）：按允許，或從 `http://localhost` 開啟頁面。',
      },
    ],
    tbd: [
      {
        en: 'The relay itself (`packages/monitor/server.js`) and the backstage page were not run here; the examples use a stand-in socket.',
        zh: '中繼站本身（`packages/monitor/server.js`）和後台頁面沒有在這裡跑過。範例用的是代替的 socket。',
      },
    ],
    examples: [
      {
        code: `import { MonitorFeed } from '@openav/monitor';

class FakeSocket {                                   // stands in for the relay, so this runs anywhere
  constructor(url) { console.log('connecting', url); setTimeout(() => this.onopen(), 0); }
  send(text) { console.log('sent', Object.keys(JSON.parse(text)).join(' ')); }
}
globalThis.WebSocket = FakeSocket;

const monitor = new MonitorFeed({ url: 'ws://192.168.1.20:7457', hz: 15 });
monitor.onStatus = (ok) => console.log('connected', ok);
monitor.connect();
setTimeout(() => {
  for (let i = 0; i < 5; i++) monitor.frame({ t: i, scene: 'Dawn' });     // five calls in the same instant
}, 20);`,
        caption: { en: 'The console prints `connecting ws://192.168.1.20:7457?role=stage`, `connected true`, and then only one `sent at t scene`: the other four calls came inside one throttle interval and were dropped.', zh: '主控台印出 `connecting ws://192.168.1.20:7457?role=stage`、`connected true`，然後只有一行 `sent at t scene`：其他四次呼叫都落在同一個節流間隔裡，被丟掉了。' },
      },
      {
        code: `import { Loop } from '@openav/core';
import { MonitorFeed, snapshotOf } from '@openav/monitor';

// a hand-assembled show: timeline, params, signals, stage and loop are yours
const monitor = new MonitorFeed({ url: 'ws://192.168.1.20:7457' });
monitor.connect();
const loop = new Loop((dt) => {
  timeline.advance(dt);
  const state = stage.frame(dt, timeline.state());
  monitor.frame(snapshotOf({ timeline, params, signals, stage, loop }, state));   // throttled for you
});
loop.start();`,
        caption: { en: 'With the relay running (`node packages/monitor/server.js`), a phone on the same network that opens `http://<this machine>:7457/` sees the clock, the scene, the frame rate and every signal and param move.', zh: '中繼站開著的時候（`node packages/monitor/server.js`），同一個網路上的手機打開 `http://<這台機器>:7457/`，就會看到時鐘、場景、影格率，以及每個訊號和參數在動。' },
        run: 'static',
        why: 'It is an outline of a hand-assembled show (`timeline`, `stage` and the rest are yours) and needs the relay running.',
      },
    ],
    related: ['snapshotOf', 'cleanExtra', 'defaultMonitorUrl', 'createShow', 'mountConsole'],
    keywords: {
      en: ['monitor', 'backstage', 'stage manager', 'relay', 'websocket', 'snapshot', 'feed', 'stage feed lost', '7457', 'remote view'],
      zh: ['監看', '後台', '舞台監督', '中繼', 'websocket', '快照', '資料流', 'stage feed lost', '7457', '遠端檢視'],
    },
  },

  snapshotOf: {
    group: 'backstage',
    summary: {
      en: 'Builds the usual snapshot of a show from its parts: clock, scene, world, frame rate, resolved params, overrides and every signal.',
      zh: '從演出的各部分建出一般的快照：時鐘、場景、世界、影格率、解析後的參數、覆寫，以及每個訊號。',
    },
    params: [
      {
        name: 'timeline', type: 'Timeline', optional: true,
        en: 'The [`Timeline`](#Timeline): gives `t`, `playing`, `holding`, `total`, `sceneIndex` and `scene`.',
        zh: '[`Timeline`](#Timeline)：提供 `t`、`playing`、`holding`、`total`、`sceneIndex` 和 `scene`。',
      },
      {
        name: 'params', type: 'Params', optional: true,
        en: 'The [`Params`](#Params): gives the list of keys that are overridden.',
        zh: '[`Params`](#Params)：提供被覆寫的參數 key 清單。',
      },
      {
        name: 'signals', type: 'Signals', optional: true,
        en: 'The [`Signals`](#Signals): every signal as `{ n, v, k }` (name, value, kind).',
        zh: '[`Signals`](#Signals)：每個訊號整理成 `{ n, v, k }`（名字、值、類型）。',
      },
      {
        name: 'stage', type: 'Stage', optional: true,
        en: 'The [`Stage`](#Stage): gives the active world\'s name.',
        zh: '[`Stage`](#Stage)：提供目前世界的名字。',
      },
      {
        name: 'loop', type: 'Loop', optional: true,
        en: 'The [`Loop`](#Loop): gives the frame rate.',
        zh: '[`Loop`](#Loop)：提供影格率。',
      },
      {
        name: 'extra', type: 'Object | Function', optional: true,
        en: 'The work\'s own numbers, `{ field: value }`, or a function that returns them (asked on every call). They land under `snapshot.extra`, after [`cleanExtra()`](#cleanExtra) has tidied them.',
        zh: '作品自己的數字 `{ 欄位: 值 }`，或一個回傳它們的函式（每次呼叫都問一次）。它們經過 [`cleanExtra()`](#cleanExtra) 整理之後，放在 `snapshot.extra` 底下。',
      },
      {
        name: 'state', type: 'Object',
        en: 'The resolved param values of this frame (what `stage.frame()` returns). `{}` when you pass nothing.',
        zh: '這個畫面解析後的參數值（`stage.frame()` 的回傳值）。什麼都不傳的話是 `{}`。',
      },
    ],
    returns: {
      type: 'Object',
      en: '`{ t, playing, holding, total, sceneIndex, scene, world, fps, state, overrides, signals }`. `scene` is the current scene\'s title (or its id); `holding` is true while the show waits at a hold; `signals` is `[{ n, v, k }]` with numbers rounded to 3 decimals. A part you leave out gives zeros, empty strings and empty lists. There is an `extra` field only when the work sent numbers of its own.',
      zh: '`{ t, playing, holding, total, sceneIndex, scene, world, fps, state, overrides, signals }`。`scene` 是目前場景的標題（沒有標題就用 id）。`holding` 在演出停在 hold 上等待的時候為 true。`signals` 是 `[{ n, v, k }]`，數字會四捨五入到小數三位。沒有給的部分，結果是 0、空字串和空清單。只有作品送了自己的數字，才會有 `extra` 欄位。',
    },
    description: [
      {
        en: 'The data that [`MonitorFeed.frame()`](#MonitorFeed) sends and the backstage page draws. Each part is optional and read with a safe fallback, so a hand-assembled show can pass only what it has. The snapshot is plain JSON, so you can also log it, store it for a rehearsal recording or show it in your own page.',
        zh: '這是 [`MonitorFeed.frame()`](#MonitorFeed) 送出、後台頁面用來畫畫面的資料。每個部分都是選填的、讀取時有安全的預設值，所以手工組裝的演出只要傳它有的部分就行。快照是單純的 JSON，所以你也可以把它記下來、存成排練的錄影，或顯示在自己的頁面上。',
      },
      {
        en: '`snapshot.extra` is filled from two places: the `extra` you pass, and the active world\'s optional `monitor()` method (`stage.active.monitor()`), so a world can report its own health without any wiring. Where both use the same name, `extra` wins. With neither, or with nothing in them, the snapshot has no `extra` at all.',
        zh: '`snapshot.extra` 有兩個來源：你傳的 `extra`，以及目前世界上選填的 `monitor()` 方法（`stage.active.monitor()`），所以世界不用接任何線就能回報自己的健康狀況。兩邊用了同一個名字的時候，以 `extra` 為準。兩邊都沒有，或裡面什麼都沒有，快照就完全不帶 `extra`。',
      },
    ],
    examples: [
      {
        code: `import { Signals, Params } from '@openav/core';
import { Timeline } from '@openav/timeline';
import { snapshotOf } from '@openav/monitor';

const signals = new Signals();
const params = new Params([{ key: 'hue', min: 0, max: 360, def: 200 }]);
const timeline = new Timeline({ params, total: 60, scenes: [{ id: 'dawn', t: 0, title: 'Dawn' }, { id: 'noon', t: 30 }] });
signals.set('midi/cc/74', 0.4567);
params.override('hue', 90);
timeline.seek(35);

const snapshot = snapshotOf({ timeline, params, signals, stage: { activeName: 'garden' }, loop: { fps: 60 } }, params.resolve(timeline.state()));
console.log(snapshot);`,
        caption: { en: 'The console prints the snapshot: `t: 35`, `scene: \'noon\'` (a scene without a title shows its id), `world: \'garden\'`, `fps: 60`, `state: { hue: 90 }`, `overrides: [ \'hue\' ]` and `signals: [ { n: \'midi/cc/74\', v: 0.457, k: \'continuous\' } ]`.', zh: '主控台印出快照：`t: 35`、`scene: \'noon\'`（沒有標題的場景會顯示它的 id）、`world: \'garden\'`、`fps: 60`、`state: { hue: 90 }`、`overrides: [ \'hue\' ]`，以及 `signals: [ { n: \'midi/cc/74\', v: 0.457, k: \'continuous\' } ]`。' },
      },
    ],
    related: ['MonitorFeed', 'cleanExtra', 'Timeline', 'Params', 'Signals', 'Stage', 'Loop'],
    keywords: {
      en: ['snapshot', 'monitor snapshot', 'state', 'backstage data', 'overrides', 'signals list', 'serialize show'],
      zh: ['快照', '監看快照', '狀態', '後台資料', '覆寫', '訊號清單', '序列化演出'],
    },
  },

  defaultMonitorUrl: {
    group: 'backstage',
    summary: {
      en: 'Where the backstage relay is unless told otherwise: the page\'s own host on port 7457 as a `ws://` address, and `null` on an https page or where there is no page.',
      zh: '沒有指定的時候後台中繼站在哪裡：頁面自己的主機加上 7457 連接埠，寫成 `ws://` 位址，在 https 頁面或沒有頁面的地方是 `null`。',
    },
    params: [
      {
        name: 'loc', type: 'Object', optional: true, default: 'globalThis.location',
        en: 'Anything with `protocol` and `hostname`, like `location`. Pass a fake one to test.',
        zh: '任何有 `protocol` 和 `hostname` 的東西，像 `location`。測試的時候可以傳一個假的。',
      },
    ],
    returns: {
      type: 'String | null',
      en: '`\'ws://<hostname>:7457\'`, or `null` when `loc` is missing or its protocol is `https:`.',
      zh: '`\'ws://<hostname>:7457\'`，`loc` 不存在、或它的 protocol 是 `https:` 的時候是 `null`。',
    },
    description: [
      {
        en: 'It is the default `url` of [`MonitorFeed`](#MonitorFeed). Not on an https page: the browser blocks `ws://` there (mixed content, logged as an error), and a page published over https (openaudiovisual.com, a tunnel) has no relay beside it. A show that runs one behind TLS passes `{ url: \'wss://…\' }` explicitly.',
        zh: '它是 [`MonitorFeed`](#MonitorFeed) 預設的 `url`。https 頁面上不用：瀏覽器在那裡會擋住 `ws://`（混合內容，會被記成錯誤），而且用 https 發布的頁面（openaudiovisual.com、通道）旁邊沒有中繼站。在 TLS 後面跑了一個中繼站的演出，要明確傳 `{ url: \'wss://…\' }`。',
      },
    ],
    examples: [
      {
        code: `import { defaultMonitorUrl } from '@openav/monitor';

console.log(defaultMonitorUrl({ protocol: 'http:', hostname: '192.168.1.20' }));        // ws://192.168.1.20:7457
console.log(defaultMonitorUrl({ protocol: 'https:', hostname: 'openaudiovisual.com' })); // null
console.log(defaultMonitorUrl(null));                                                    // null: no page`,
        caption: { en: 'The console prints `ws://192.168.1.20:7457`, then `null` twice.', zh: '主控台印出 `ws://192.168.1.20:7457`，然後兩個 `null`。' },
      },
    ],
    related: ['MonitorFeed', 'snapshotOf'],
    keywords: {
      en: ['default url', 'monitor url', 'ws://', '7457', 'https', 'mixed content', 'relay address'],
      zh: ['預設網址', '監看網址', 'ws://', '7457', 'https', '混合內容', '中繼站位址'],
    },
  },

  cleanExtra: {
    group: 'backstage',
    summary: {
      en: 'Tidies the numbers a work sends backstage into something that always survives JSON and has a size limit. Returns `null` when nothing is left.',
      zh: '把作品送進後台的數字，整理成一定能轉成 JSON、大小有上限的樣子。什麼都不剩的時候回傳 `null`。',
    },
    params: [
      {
        name: 'x', type: 'Object | Function',
        en: '`{ field: value }`, or a function that returns it. A value is a number, a string, a boolean, `null` or `undefined`, or `{ v, min, max, warn }`.',
        zh: '`{ 欄位: 值 }`，或一個回傳它的函式。值可以是數字、字串、布林、`null` 或 `undefined`，也可以是 `{ v, min, max, warn }`。',
      },
    ],
    returns: {
      type: 'Object | null',
      en: 'A new plain object with the fields that were kept, or `null` when `x` is not an object (an array counts as not one), when the function throws, or when no field is left.',
      zh: '一個新的普通物件，裡面是留下來的欄位。`x` 不是物件（陣列也不算）、函式丟出錯誤，或沒有任何欄位留下來，就回傳 `null`。',
    },
    description: [
      {
        en: 'One bad value must not stop a whole snapshot from being sent, so every field is checked. A number that is not finite (`NaN`, `Infinity`) becomes `null`. A string is cut to 80 characters. Booleans and `null` pass, and `undefined` becomes `null`. Anything else (a function, a nested object, an array, a BigInt) is dropped. A `{ v, min, max, warn }` value keeps `v` (by the same rules, `null` when it cannot be kept), `min` and `max` only when they are finite numbers, and `warn` only when it is exactly `true`.',
        zh: '一個壞值不能讓整個快照送不出去，所以每個欄位都會檢查。不是有限的數字（`NaN`、`Infinity`）會變成 `null`。字串會截到 80 個字元。布林和 `null` 照樣通過，`undefined` 變成 `null`。其他的東西（函式、巢狀物件、陣列、BigInt）會被丟掉。`{ v, min, max, warn }` 這種值會留下 `v`（規則相同，留不住就是 `null`），`min` 和 `max` 只在是有限數字的時候才留，`warn` 只在剛好是 `true` 的時候才留。',
      },
      {
        en: 'At most 64 fields are kept, in the object\'s own order, and a field name is cut to 48 characters. A getter that throws loses only its own field. [`snapshotOf()`](#snapshotOf) and [`MonitorFeed`](#MonitorFeed) call it for you; call it yourself when you build a snapshot by hand.',
        zh: '最多留 64 個欄位，照物件自己的順序，欄位名稱會截到 48 個字元。會丟出錯誤的 getter 只會讓它自己那個欄位不見。[`snapshotOf()`](#snapshotOf) 和 [`MonitorFeed`](#MonitorFeed) 會替你呼叫它。自己手工組快照的時候，可以自己呼叫。',
      },
    ],
    examples: [
      {
        code: `import { cleanExtra } from '@openav/monitor';

console.log(JSON.stringify(cleanExtra({
  'sim/tick': 1200,
  'sim/drift': { v: 0.004, min: 0, max: 0.1, warn: false },   // a bar from 0 to 0.1
  world: 'garden',
  broken: NaN,                                                  // becomes null
  nested: { a: 1 },                                             // dropped
})));
console.log(cleanExtra(() => { throw new Error('no numbers today'); }), cleanExtra({}));`,
        caption: { en: 'The console prints `{"sim/tick":1200,"sim/drift":{"v":0.004,"min":0,"max":0.1},"world":"garden","broken":null}`, then `null null`: a provider that throws and an empty object both give nothing.', zh: '主控台印出 `{"sim/tick":1200,"sim/drift":{"v":0.004,"min":0,"max":0.1},"world":"garden","broken":null}`，接著是 `null null`：丟出錯誤的提供者和空物件，結果都是沒有東西。' },
      },
    ],
    related: ['snapshotOf', 'MonitorFeed'],
    keywords: {
      en: ['extra', 'work panel', 'health', 'metrics', 'sanitize', 'backstage numbers', 'warn'],
      zh: ['extra', 'Work 面板', '健康指標', '數字', '清理', '後台數字', '警告'],
    },
  },
};
