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
    ],
    needs: {
      en: 'Call `connect()` once (a show does), then `frame(snapshot)` every frame. `frame()` does nothing while `connected` is false. The relay must be reachable from the page: on an https page the browser blocks `ws://` (mixed content), so give a `wss://` address explicitly.',
      zh: '呼叫一次 `connect()`（演出會做），之後每個畫面呼叫 `frame(snapshot)`。`connected` 是 false 的時候，`frame()` 什麼都不做。頁面必須連得到中繼站：在 https 頁面上，瀏覽器會擋住 `ws://`（混合內容），所以請明確給一個 `wss://` 位址。',
    },
    members: {
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
    related: ['snapshotOf', 'defaultMonitorUrl', 'createShow', 'mountConsole'],
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
        name: 'state', type: 'Object',
        en: 'The resolved param values of this frame (what `stage.frame()` returns). `{}` when you pass nothing.',
        zh: '這個畫面解析後的參數值（`stage.frame()` 的回傳值）。什麼都不傳的話是 `{}`。',
      },
    ],
    returns: {
      type: 'Object',
      en: '`{ t, playing, holding, total, sceneIndex, scene, world, fps, state, overrides, signals }`. `scene` is the current scene\'s title (or its id); `holding` is true while the show waits at a hold; `signals` is `[{ n, v, k }]` with numbers rounded to 3 decimals. A part you leave out gives zeros, empty strings and empty lists.',
      zh: '`{ t, playing, holding, total, sceneIndex, scene, world, fps, state, overrides, signals }`。`scene` 是目前場景的標題（沒有標題就用 id）。`holding` 在演出停在 hold 上等待的時候為 true。`signals` 是 `[{ n, v, k }]`，數字會四捨五入到小數三位。沒有給的部分，結果是 0、空字串和空清單。',
    },
    description: [
      {
        en: 'The data that [`MonitorFeed.frame()`](#MonitorFeed) sends and the backstage page draws. Each part is optional and read with a safe fallback, so a hand-assembled show can pass only what it has. The snapshot is plain JSON, so you can also log it, store it for a rehearsal recording or show it in your own page.',
        zh: '這是 [`MonitorFeed.frame()`](#MonitorFeed) 送出、後台頁面用來畫畫面的資料。每個部分都是選填的、讀取時有安全的預設值，所以手工組裝的演出只要傳它有的部分就行。快照是單純的 JSON，所以你也可以把它記下來、存成排練的錄影，或顯示在自己的頁面上。',
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
    related: ['MonitorFeed', 'Timeline', 'Params', 'Signals', 'Stage', 'Loop'],
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
};
