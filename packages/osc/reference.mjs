// @openav/osc reference: OSC output from the browser, through a small local bridge.
// Read by tools/build-reference.mjs (see AGENTS.md, "Documenting a public name").

export default {
  OscOut: {
    group: 'osc',
    summary: {
      en: 'Sends OSC messages from the browser to TouchDesigner, Max, Reaper or a spatialiser, batched once per frame, through a small local bridge.',
      zh: '把 OSC 訊息從瀏覽器送到 TouchDesigner、Max、Reaper 或空間化軟體，每個畫面打包一批，透過一個本機的小橋接程式。',
    },
    params: [
      {
        name: 'url', type: 'String', optional: true, default: '\'http://127.0.0.1:7456\'',
        en: 'The address of the OSC bridge (its HTTP port, not the UDP target).',
        zh: 'OSC 橋接程式的位址（它的 HTTP 連接埠，不是 UDP 的目的地）。',
      },
    ],
    description: [
      {
        en: 'A browser cannot send UDP, so `OscOut` posts batches of messages to a ~100-line Node program, `packages/osc/bridges/osc-bridge.js`, which sends them on as OSC packets. Start it with `node packages/osc/bridges/osc-bridge.js 7456 192.168.1.50 3456` (HTTP port, target host, UDP port; the defaults are `7456 127.0.0.1 3456`). Then `send(address, args)` as often as you like and `flush()` once per frame: only the **latest message per address** survives a frame, because a position stream does not need its in-between values.',
        zh: '瀏覽器沒辦法送 UDP，所以 `OscOut` 把一批一批的訊息用 POST 送給一支大約一百行的 Node 程式 `packages/osc/bridges/osc-bridge.js`，由它再當成 OSC 封包送出去。用 `node packages/osc/bridges/osc-bridge.js 7456 192.168.1.50 3456` 啟動它（HTTP 連接埠、目標主機、UDP 連接埠，預設是 `7456 127.0.0.1 3456`）。然後想送多少次都可以 `send(address, args)`，每個畫面 `flush()` 一次：每個畫面裡，每個位址只有**最後一則訊息**會送出去，因為位置的串流不需要中間的值。',
      },
      {
        en: 'Numbers go out as OSC floats (what Spat, Reaper and TouchDesigner expect), and anything else as a string. `createShow()` does not create an `OscOut`: make one, call `enable()`, flush it from `onFrame`, and if you like hand it to the worlds as `show.stage.io.osc` and to the Layers panel as `show.app.osc` (which then shows the OSC rate).',
        zh: '數字會當成 OSC 浮點數送出（Spat、Reaper 和 TouchDesigner 期待的格式），其他東西一律當成字串。`createShow()` 不會建立 `OscOut`：你自己建一個、呼叫 `enable()`，在 `onFrame` 裡 flush，想要的話再用 `show.stage.io.osc` 交給世界，用 `show.app.osc` 交給 Layers 面板（面板就會顯示 OSC 的訊息率）。',
      },
    ],
    needs: {
      en: 'The bridge must be running, and you must `await osc.enable()` first: it probes `GET /health` and answers `false` if nobody is there. Until it succeeds `flush()` just throws the queue away. On a public https page, Chrome asks permission before the page may reach `127.0.0.1`.',
      zh: '橋接程式必須在跑，而且你要先 `await osc.enable()`：它會探測 `GET /health`，沒有人在就回答 `false`。在成功之前，`flush()` 只會把佇列丟掉。在公開的 https 頁面上，Chrome 會在頁面連到 `127.0.0.1` 之前先詢問權限。',
    },
    members: {
      enable: {
        en: 'Probe the bridge (`GET /health`) and, if it answers, switch on. Resolves `true`, or `false` when nothing is listening. Any HTTP answer counts as present. Calls `onStatus(ok, info)`; `info` is the UDP target the bridge reports.',
        zh: '探測橋接程式（`GET /health`），有回應就開啟。完成時是 `true`，沒有人在監聽就是 `false`。任何 HTTP 回應都算它在。會呼叫 `onStatus(ok, info)`，`info` 是橋接程式回報的 UDP 目的地。',
      },
      disable: {
        en: 'Switch off and throw away anything queued. Calls `onStatus(false, \'disabled\')`.',
        zh: '關掉，並把佇列裡的東西全丟掉。會呼叫 `onStatus(false, \'disabled\')`。',
      },
      send: {
        en: 'Queue one message: `send(address, args)`. `args` is an array, or a single value that is wrapped in one. Nothing leaves until `flush()`. Calls the `onMsg(address, args)` hook if you set one.',
        zh: '把一則訊息排進佇列：`send(address, args)`。`args` 是陣列，或是會被包成陣列的單一值。在 `flush()` 之前什麼都不會送出去。如果你設了 `onMsg(address, args)` 掛鉤，它也會被呼叫。',
      },
      rate: {
        en: 'Messages sent since the last call, which resets the count (so call it once a second for a rate). What the Layers panel shows.',
        zh: '自從上次呼叫以來送出的訊息數，呼叫之後會歸零（所以每秒呼叫一次就是訊息率）。Layers 面板顯示的就是它。',
      },
      flush: {
        en: 'Send the queue as one POST, the latest message per address. Call once per frame. Async; it does nothing while a previous flush is still in flight, and throws the queue away when `enabled` is false.',
        zh: '把佇列當成一個 POST 送出，每個位址只送最後一則。每個畫面呼叫一次。它是非同步的。前一次 flush 還沒完成時它什麼都不做，`enabled` 是 false 的時候則會把佇列丟掉。',
      },
    },
    notes: [
      {
        en: 'Fields and hooks: `enabled`, `udp` (the target the bridge reported), `onStatus = (ok, info) => {}` and `onMsg = (address, args) => {}` (high frequency: use sparingly).',
        zh: '欄位與掛鉤：`enabled`、`udp`（橋接程式回報的目的地）、`onStatus = (ok, info) => {}` 和 `onMsg = (address, args) => {}`（頻率很高，請節制使用）。',
      },
      {
        en: 'If the bridge disappears, the first failed flush calls `onStatus(false, \'bridge lost\')`, and after more than 30 failed flushes in a row `enabled` turns false by itself, with no further message. Call `enable()` again to resume. The messages of a failed flush are lost.',
        zh: '橋接程式消失的話，第一次失敗的 flush 會呼叫 `onStatus(false, \'bridge lost\')`，連續失敗超過 30 次之後，`enabled` 會自己變成 false，不再有任何訊息。想恢復就再呼叫一次 `enable()`。失敗那次 flush 的訊息會遺失。',
      },
      {
        en: 'Every number goes out as a 32-bit float, whole numbers included (the bridge\'s own header comment mentions integers, but its code only writes floats). If the receiver needs integers, convert there.',
        zh: '每個數字都會當成 32 位元浮點數送出，整數也一樣（橋接程式檔案開頭的註解提到整數，但它的程式碼只會寫浮點數）。接收端如果需要整數，請在那邊轉換。',
      },
    ],
    tbd: [
      {
        en: 'Not tried here against TouchDesigner, Max or Reaper: the examples use a stand-in for the bridge, and what the bridge does with the packets is read from its code (floats for numbers, strings for the rest).',
        zh: '這裡沒有對 TouchDesigner、Max 或 Reaper 實測：範例是用一個代替橋接程式的函式，橋接程式如何處理封包是從它的程式碼讀出來的（數字用浮點數，其餘用字串）。',
      },
    ],
    examples: [
      {
        code: `import { OscOut } from '@openav/osc';

const osc = new OscOut();                          // http://127.0.0.1:7456
console.log(await osc.enable());                   // true when the bridge answers
function frame(x, y, z) {
  osc.send('/source/3/xyz', [x, y, z]);            // queue as often as you like
  osc.flush();                                     // once per frame
}
frame(0.1, 0.5, 0.9);`,
        caption: { en: 'With `node packages/osc/bridges/osc-bridge.js` running, the console prints `true` and the bridge forwards `/source/3/xyz` as an OSC packet with three floats.', zh: '`node packages/osc/bridges/osc-bridge.js` 在跑的時候，主控台印出 `true`，橋接程式把 `/source/3/xyz` 當成帶三個浮點數的 OSC 封包轉送出去。' },
        run: 'static',
        why: 'It needs the OSC bridge (a Node program with a UDP socket) running on 127.0.0.1:7456.',
      },
      {
        code: `import { OscOut } from '@openav/osc';

// a stand-in for the bridge, so this runs anywhere
globalThis.fetch = async (url, options = {}) => {
  if (options.body) console.log('POST', url, options.body);
  return { json: async () => ({ ok: true, udp: '127.0.0.1:3456' }) };
};

const osc = new OscOut();
osc.onStatus = (ok, info) => console.log('status', ok, info);
await osc.enable();
osc.send('/source/1/xyz', [0.1, 0.2, 0.3]);
osc.send('/source/1/xyz', [0.4, 0.5, 0.6]);   // the same address: replaces the first
osc.send('/gain', 0.8);                       // a single value is wrapped in an array
await osc.flush();
console.log('rate', osc.rate());              // 2 messages went out`,
        caption: { en: 'Three `send()` calls become two messages: the console prints `status true 127.0.0.1:3456`, then the one `POST` with `/source/1/xyz` carrying `[0.4,0.5,0.6]` and `/gain` carrying `[0.8]`, then `rate 2`.', zh: '三次 `send()` 變成兩則訊息：主控台印出 `status true 127.0.0.1:3456`，然後是那一個 `POST`，裡面 `/source/1/xyz` 帶著 `[0.4,0.5,0.6]`、`/gain` 帶著 `[0.8]`，最後是 `rate 2`。' },
      },
      {
        code: `import { OscOut } from '@openav/osc';

const osc = new OscOut('http://127.0.0.1:7499');    // an address where no bridge runs
osc.onStatus = (ok, info) => console.log('status', ok, info);
console.log(await osc.enable());                  // false: nobody answers
osc.send('/gain', 0.5);
await osc.flush();                                // nothing is sent while disabled: the queue is dropped`,
        caption: { en: 'With no bridge, `enable()` does not throw: the console prints `status false bridge not running (node bridges/osc-bridge.js)`, then `false`. (The browser may also log one failed request.)', zh: '沒有橋接程式的時候，`enable()` 不會丟出錯誤：主控台印出 `status false bridge not running (node bridges/osc-bridge.js)`，然後是 `false`。（瀏覽器可能另外記下一次失敗的請求。）' },
      },
    ],
    related: ['OutClient', 'createShow', 'Signals'],
    keywords: {
      en: ['osc', 'open sound control', 'touchdesigner', 'max', 'reaper', 'spat', 'udp', 'bridge', 'send', 'flush', 'output', 'lighting'],
      zh: ['osc', 'open sound control', 'touchdesigner', 'max', 'reaper', '空間化', 'udp', '橋接', '送出', '輸出', '燈光'],
    },
  },
};
