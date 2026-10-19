// @openav/out reference: web-page values to physical hardware through one local bridge (WLED lights, serial motor boards, OSC),
// with a watchdog that puts everything back on a safe value when the page stops talking.
// Read by tools/build-reference.mjs (see AGENTS.md, "Documenting a public name").
// The bridge half (./bridge) runs in Node; its examples are static.

export default {
  OutClient: {
    group: 'osc',
    summary: {
      en: 'The page side of the out-bridge: `set(channel, value)` sends a number to a named hardware channel, at most once per frame, and keeps the connection alive.',
      zh: '輸出橋接程式在頁面這一側的部分：`set(channel, value)` 把一個數字送到有名字的硬體頻道，每個畫面最多送一次，並且維持連線。',
    },
    params: [
      {
        name: 'url', type: 'String', optional: true, default: 'OUT_DEFAULT_URL',
        en: 'The bridge\'s WebSocket address. The default is [`OUT_DEFAULT_URL`](#OUT_DEFAULT_URL), `ws://127.0.0.1:6450/out`.',
        zh: '橋接程式的 WebSocket 位址。預設是 [`OUT_DEFAULT_URL`](#OUT_DEFAULT_URL)，也就是 `ws://127.0.0.1:6450/out`。',
      },
      {
        name: 'id', type: 'String | null', optional: true, default: 'null',
        en: 'A name for this page (the work\'s id), sent to the bridge in its "hello" and shown in its log.',
        zh: '這個頁面的名字（作品的 id），會在 "hello" 訊息裡送給橋接程式，並顯示在它的紀錄裡。',
      },
      {
        name: 'WebSocket', type: 'Function', optional: true,
        en: 'The WebSocket constructor to use. Defaults to the global one (also in Node 22). Pass your own to test without a network.',
        zh: '要用的 WebSocket 建構函式。預設是全域的那個（Node 22 也有）。傳你自己的，就能在沒有網路的情況下測試。',
      },
      {
        name: 'schedule', type: 'Function', optional: true,
        en: 'A function that runs a callback once, on the next frame. The default is `requestAnimationFrame` (or a 16 ms timer when the tab is hidden or there is no `requestAnimationFrame`).',
        zh: '一個在下一個畫面執行一次回呼的函式。預設是 `requestAnimationFrame`（分頁被藏起來或沒有 `requestAnimationFrame` 時，改用 16 毫秒的計時器）。',
      },
      {
        name: 'maxBackoffMs', type: 'Number', optional: true, default: '5000',
        en: 'The longest wait between reconnection attempts, in milliseconds.',
        zh: '重新連線之間最長的等待時間，單位是毫秒。',
      },
      {
        name: 'minBackoffMs', type: 'Number', optional: true, default: '250',
        en: 'The first wait between reconnection attempts. It doubles each time up to `maxBackoffMs`.',
        zh: '重新連線之間第一次的等待時間。每次加倍，直到 `maxBackoffMs`。',
      },
    ],
    description: [
      {
        en: 'Hardware needs a number, and a page has a number: `out.set(\'light/0/r\', 0.8)`. The channel name is yours (`a-z A-Z 0-9 _ - . /`, up to 128 characters) and the **bridge** ([`startBridge()`](#out-startBridge)) decides from its config where that channel goes: a WLED strip, a serial motor board, an OSC address. Values are plain numbers; the convention is 0..1. Several `set()` calls on one channel inside one frame leave as one value, the last. In a lab work `lab.out` is this class.',
        zh: '硬體需要的是數字，而頁面有數字：`out.set(\'light/0/r\', 0.8)`。頻道名稱由你決定（`a-z A-Z 0-9 _ - . /`，最長 128 個字元），這個頻道要送去哪裡，由**橋接程式**（[`startBridge()`](#out-startBridge)）依它的設定決定：WLED 燈條、序列埠馬達板、OSC 位址。值就是普通的數字，慣例是 0..1。同一個畫面裡對同一個頻道呼叫好幾次 `set()`，只會送出最後一個值。在實驗室的作品裡，`lab.out` 就是這個類別。',
      },
      {
        en: 'It keeps the connection alive on its own: it reconnects with a growing delay (250 ms doubling up to 5 s), resends everything it knows after a reconnect (a restarted bridge has forgotten it all), and while the socket is open it re-sends the held values every `timeoutMs / 3` of the bridge\'s watchdog, so a slider that stands still is not mistaken for a frozen page. If the page really freezes, that heartbeat stops and the bridge puts the hardware on its safe values.',
        zh: '它自己會維持連線：用愈來愈長的間隔重連（250 毫秒起，加倍到 5 秒），重連之後把它知道的值全部重送一遍（重新啟動的橋接程式什麼都忘了），而且在 socket 開著的時候，每隔橋接程式的看門狗時間的三分之一就重送一次目前的值，所以停著不動的滑桿不會被誤認為當掉的頁面。如果頁面真的凍結，這個心跳就會停，橋接程式就讓硬體回到安全值。',
      },
    ],
    needs: {
      en: 'Call `connect()` (the bridge must be running: `node packages/out/bridge/out-bridge.mjs --config out.json`), or `simulate()` for no hardware at all. `set()` before the socket is open is not lost: it waits in `last` and goes out on open.',
      zh: '要呼叫 `connect()`（橋接程式必須在跑：`node packages/out/bridge/out-bridge.mjs --config out.json`），或呼叫 `simulate()` 完全不接硬體。在 socket 開啟之前呼叫 `set()` 不會遺失：它會先放在 `last`，等開啟之後送出。',
    },
    members: {
      onStatus: {
        en: 'Call `fn(status)` when the status changes. Returns a function that unsubscribes.',
        zh: '狀態一改變就呼叫 `fn(status)`。回傳一個取消訂閱的函式。',
      },
      connect: {
        en: 'Open the socket and keep it open (reconnects with a capped, doubling delay). Returns the client, so `new OutClient(…).connect()` chains. Does nothing in simulate mode, or when there is no WebSocket constructor.',
        zh: '開啟 socket 並維持開啟（用有上限、逐次加倍的間隔重連）。回傳客戶端本身，所以 `new OutClient(…).connect()` 可以串接。在模擬模式，或沒有 WebSocket 建構函式的時候什麼都不做。',
      },
      simulate: {
        en: 'No socket: values are only recorded in `last` (for sketches without hardware; the lab does this for `?out=sim`). The status becomes `\'sim\'`.',
        zh: '不接 socket：值只會記在 `last`（給沒有硬體的草圖用。實驗室的 `?out=sim` 就是這樣做）。狀態變成 `\'sim\'`。',
      },
      close: {
        en: 'Close the socket and stop reconnecting. The status becomes `\'closed\'`. The bridge sees the last client leave and puts every channel with a safe value back on it.',
        zh: '關閉 socket 並停止重連。狀態變成 `\'closed\'`。橋接程式發現最後一個用戶端離開，就讓每個有安全值的頻道回到安全值。',
      },
      set: {
        en: '`set(channel, value)`: send one number. The value goes through `Number()`; a channel that is not a string or a value that is not finite is ignored. Recorded in `last` at once, sent on the next frame.',
        zh: '`set(channel, value)`：送出一個數字。值會先經過 `Number()`。頻道不是字串、或值不是有限數字，就會被忽略。立刻記在 `last`，下一個畫面送出。',
      },
      batch: {
        en: '`batch({ channel: value, … })`: the same as one `set()` per entry.',
        zh: '`batch({ channel: value, … })`：等於每一項各呼叫一次 `set()`。',
      },
    },
    notes: [
      {
        en: 'Fields to read: `status` (`\'closed\'`, `\'connecting\'`, `\'open\'`, `\'sim\'`), `last` (`{ channel: last value given to set() }`, also in simulate mode), `sent` (values actually put on the wire: less than the number of `set()` calls because of coalescing) and `bridge` (the bridge\'s last status message).',
        zh: '可以讀的欄位：`status`（`\'closed\'`、`\'connecting\'`、`\'open\'`、`\'sim\'`）、`last`（`{ 頻道: 最後給 set() 的值 }`，模擬模式下也有）、`sent`（真正送上線路的值：因為合併，會比 `set()` 呼叫次數少），以及 `bridge`（橋接程式最近的狀態訊息）。',
      },
      {
        en: 'On the wire a single value is `{ "type": "set", "ch", "v" }` and several are `{ "type": "batch", "items": [{ "ch", "v" }, …] }`, after a `{ "type": "hello", "id" }`.',
        zh: '在線路上，單一個值是 `{ "type": "set", "ch", "v" }`，多個值是 `{ "type": "batch", "items": [{ "ch", "v" }, …] }`，前面先有一則 `{ "type": "hello", "id" }`。',
      },
      {
        en: 'On a public https page, Chrome asks permission before the page may reach `127.0.0.1`; if it is refused, the status stays `\'connecting\'`.',
        zh: '在公開的 https 頁面上，Chrome 會在頁面連到 `127.0.0.1` 之前詢問權限，被拒絕的話，狀態會一直停在 `\'connecting\'`。',
      },
    ],
    tbd: [
      {
        en: 'Not tried here with real hardware (a WLED strip, a motor board): the examples use a stand-in socket and the bridge\'s `log` sink.',
        zh: '這裡沒有用真正的硬體（WLED 燈條、馬達板）試過：範例用的是代替的 socket 和橋接程式的 `log` 輸出。',
      },
    ],
    examples: [
      {
        code: `import { OutClient } from '@openav/out';

const out = new OutClient({ id: 'my-work' });       // ws://127.0.0.1:6450/out
out.onStatus((status) => console.log('out', status));   // connecting, open
out.connect();
out.set('light/0/r', 0.8);                          // waits for the socket, then goes out
function frame(t) {
  out.set('light/0/g', 0.5 + 0.5 * Math.sin(t / 1000));   // call as often as you like: one value a frame leaves
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);`,
        caption: { en: 'With the out-bridge running, the console prints `out connecting`, then `out open`, and the green channel breathes between 0 and 1.', zh: '輸出橋接程式開著的時候，主控台印出 `out connecting`，然後是 `out open`，綠色那個頻道在 0 和 1 之間起伏。' },
        run: 'static',
        why: 'It needs the out-bridge running on 127.0.0.1:6450 (a Node program), and it never stops.',
      },
      {
        code: `import { OutClient } from '@openav/out';

class FakeSocket {                                  // stands in for the bridge's socket, so this runs anywhere
  constructor() { this.readyState = 1; setTimeout(() => this.onopen(), 0); }
  send(text) { console.log('wire:', text); }
  close() {}
}
const out = new OutClient({ id: 'demo', WebSocket: FakeSocket, schedule: (fn) => setTimeout(fn, 0) });
out.connect();
setTimeout(() => {
  out.set('light/0/r', 0.8);
  out.set('light/0/r', 0.9);                        // same channel, same frame: only 0.9 leaves
  out.batch({ 'light/0/g': 0.2, 'motor/1': 0.5 });
  setTimeout(() => { console.log('sent', out.sent, out.status); out.close(); }, 50);
}, 20);`,
        caption: { en: 'The console prints the `hello`, then one `batch` of three values (`light/0/r` is 0.9, not 0.8), then `sent 3 open`.', zh: '主控台先印出 `hello`，然後是一個含三個值的 `batch`（`light/0/r` 是 0.9，不是 0.8），最後是 `sent 3 open`。' },
      },
      {
        code: `import { OutClient } from '@openav/out';

const out = new OutClient().simulate();              // no bridge, no hardware
out.set('light/0/r', 1);
out.set('light/0/r', 0.25);
out.set('typo', 'not a number');                     // ignored: not finite
console.log(out.status, out.last);                   // sim { 'light/0/r': 0.25 }`,
        caption: { en: 'Simulate mode records instead of sending: the console prints `sim { \'light/0/r\': 0.25 }`; the bad value was ignored.', zh: '模擬模式只記錄不送出：主控台印出 `sim { \'light/0/r\': 0.25 }`，壞的值被忽略了。' },
      },
    ],
    related: ['OUT_DEFAULT_URL', 'OscOut', 'LeapInput'],
    keywords: {
      en: ['out', 'output', 'hardware', 'wled', 'led strip', 'motor', 'serial', 'dmx', 'ddp', 'channel', 'watchdog', 'bridge', 'websocket', 'lights', 'set'],
      zh: ['輸出', '硬體', 'wled', '燈條', '馬達', '序列埠', 'ddp', '頻道', '看門狗', '橋接', 'websocket', '燈光'],
    },
  },

  OUT_DEFAULT_URL: {
    group: 'osc',
    summary: {
      en: 'The address `OutClient` connects to by default: `ws://127.0.0.1:6450/out`, the out-bridge on this machine.',
      zh: '`OutClient` 預設連的位址：`ws://127.0.0.1:6450/out`，也就是這台機器上的輸出橋接程式。',
    },
    description: [
      {
        en: 'Port 6450 is the bridge\'s [`DEFAULT_PORT`](#out-DEFAULT_PORT) and `/out` is the only WebSocket path it serves. In the lab, `?out=ws://host:port/out` points a page at another bridge, `?out=sim` records values without one and `?out=0` turns it off.',
        zh: '6450 是橋接程式的 [`DEFAULT_PORT`](#out-DEFAULT_PORT)，`/out` 是它唯一提供的 WebSocket 路徑。在實驗室裡，`?out=ws://host:port/out` 可以讓頁面改連別的橋接程式，`?out=sim` 只記錄不連線，`?out=0` 則是關掉。',
      },
    ],
    related: ['OutClient'],
    keywords: {
      en: ['default url', 'ws://127.0.0.1:6450/out', 'bridge address', '6450', 'out url'],
      zh: ['預設網址', 'ws://127.0.0.1:6450/out', '橋接位址', '6450', '輸出網址'],
    },
  },

  startBridge: {
    group: 'osc',
    summary: {
      en: 'Starts the out-bridge: a loopback WebSocket server that routes channel values from the page to hardware sinks, with a watchdog that falls back to safe values (Node only).',
      zh: '啟動輸出橋接程式：一個只綁 loopback 的 WebSocket 伺服器，把頁面傳來的頻道值導向硬體輸出，並有看門狗在頁面沒聲音時退回安全值（只能在 Node 執行）。',
    },
    params: [
      { name: 'port', type: 'Number', optional: true, default: 'DEFAULT_PORT', en: 'The port to listen on, [`DEFAULT_PORT`](#out-DEFAULT_PORT) unless you say otherwise. 0 picks any free one. The ports in [`RESERVED_PORTS`](#out-RESERVED_PORTS) (7457) are refused.', zh: '要監聽的連接埠，沒特別指定就是 [`DEFAULT_PORT`](#out-DEFAULT_PORT)。0 表示隨便挑一個空的。[`RESERVED_PORTS`](#out-RESERVED_PORTS) 裡的連接埠（7457）會被拒絕。' },
      { name: 'host', type: 'String', optional: true, default: '\'127.0.0.1\'', en: 'The address to bind. Only loopback is allowed.', zh: '要綁定的位址。只允許 loopback。' },
      {
        name: 'config', type: 'Object | null', optional: true, default: 'null',
        en: 'The routing: `{ channels: [{ match, sink, … }], safe: { glob: value }, timeoutMs, allowOrigins }` (see the description). `null` sends every channel to the `log` sink. [`loadConfig(file)`](#loadConfig) reads it from a JSON file.',
        zh: '路由設定：`{ channels: [{ match, sink, … }], safe: { glob: value }, timeoutMs, allowOrigins }`（見說明）。`null` 的話，所有頻道都送到 `log` 輸出。[`loadConfig(file)`](#loadConfig) 可以從 JSON 檔讀取。',
      },
      { name: 'watchdog', type: 'Boolean', optional: true, default: 'true', en: '`false` switches the watchdog off: no safe values are ever sent (the tests use it to prove the watchdog is what does the work).', zh: '`false` 會關掉看門狗：永遠不送安全值（測試用它來證明做事的是看門狗）。' },
      { name: 'log', type: 'Function', optional: true, default: '() => {}', en: 'Called with a line of text for diagnostics: clients coming and going, safe values sent.', zh: '以一行文字呼叫，給診斷用：用戶端進出、送出了安全值。' },
      { name: 'print', type: 'Function', optional: true, default: '(s) => console.log(s)', en: 'What the `log` sink prints each value with (`"channel value"`). The default is stdout.', zh: '`log` 輸出用來印每個值的函式（`"channel value"`）。預設是標準輸出。' },
    ],
    returns: {
      type: 'Promise<Object>',
      en: 'Resolves once listening, with `{ port, state, health(), close() }`: the real port, the counters (`received`, `rejected`, `unrouted`, `safeSent` …), a function returning the `/health` object, and a function that puts every known channel on its safe value, stops the server and returns a Promise.',
      zh: '開始監聽之後才完成，結果是 `{ port, state, health(), close() }`：實際的連接埠、計數器（`received`、`rejected`、`unrouted`、`safeSent` ……）、回傳 `/health` 物件的函式，以及會讓每個已知頻道回到安全值、停掉伺服器並回傳 Promise 的函式。',
    },
    description: [
      {
        en: 'This is what `node packages/out/bridge/out-bridge.mjs --config out.json` runs (also `--port`, `--no-watchdog`, `--quiet`; the environment variable `OUT_BRIDGE_PORT`). It serves `ws://127.0.0.1:6450/out`, which understands `{ type: \'hello\', id }`, `{ type: \'set\', ch, v }`, `{ type: \'batch\', items }` and `{ type: \'status\' }`, and answers with `{ type: \'status\', … }`; `GET /health` reports the sinks, the channel count, the clients and the time since the last value. Channel names are `a-z A-Z 0-9 _ - . /` up to 128 characters, values must be finite numbers, and there is room for 4096 channels.',
        zh: '`node packages/out/bridge/out-bridge.mjs --config out.json` 執行的就是它（另有 `--port`、`--no-watchdog`、`--quiet`，以及環境變數 `OUT_BRIDGE_PORT`）。它提供 `ws://127.0.0.1:6450/out`，聽得懂 `{ type: \'hello\', id }`、`{ type: \'set\', ch, v }`、`{ type: \'batch\', items }` 和 `{ type: \'status\' }`，並以 `{ type: \'status\', … }` 回應。`GET /health` 回報輸出、頻道數、用戶端和距離上一個值的時間。頻道名稱是 `a-z A-Z 0-9 _ - . /`，最長 128 個字元，值必須是有限數，最多容納 4096 個頻道。',
      },
      {
        en: 'The config routes channels: `channels` is a list of `{ match, sink, … }` and the **first** rule whose `match` glob fits the channel name takes it (`*` means anything, slashes included); a channel no rule fits is counted and dropped. The sinks are `log` (stdout), `udp-json` (UDP, `{"ch","v"}`), `osc` (UDP, address `"/" + channel`, one float32), `ddp` (WLED over UDP 4048: `light/<i>/r|g|b`, 0..1, pixel index from 0, up to 10000 pixels) and `serial` (a device path, `ch value` lines or JSON, latest value only). `safe` maps a channel glob to its safe value, `timeoutMs` (default 500, at least 20) is the watchdog time, and `allowOrigins` lists the page origins that may connect (without it any page on this machine can).',
        zh: '設定檔負責把頻道導向各處：`channels` 是 `{ match, sink, … }` 的清單，**第一條** `match` 萬用字元符合頻道名稱的規則就接手它（`*` 代表任何東西，包含斜線）。沒有規則符合的頻道會被計數然後丟掉。輸出（sink）有 `log`（標準輸出）、`udp-json`（UDP，`{"ch","v"}`）、`osc`（UDP，位址是 `"/" + 頻道`，一個 float32）、`ddp`（用 UDP 4048 控制 WLED：`light/<i>/r|g|b`，0..1，像素索引從 0 開始，最多 10000 個像素）和 `serial`（裝置路徑，`ch value` 的行或 JSON，只送最新的值）。`safe` 把頻道萬用字元對應到它的安全值，`timeoutMs`（預設 500，至少 20）是看門狗的時間，`allowOrigins` 列出允許連線的頁面來源（沒寫的話，這台機器上的任何頁面都能連）。',
      },
      {
        en: 'The **watchdog**: a channel that has a safe value and gets no new value for `timeoutMs` is sent its safe value once (a new value re-arms it). When the last client disconnects, every channel the bridge has seen that has a safe value gets it at once, and so does a clean shutdown. It does not cover channels the bridge has never heard of, nor a bridge killed with SIGKILL.',
        zh: '**看門狗**：有安全值的頻道，如果 `timeoutMs` 內沒有收到新的值，就會被送出一次安全值（新的值進來會重新啟動它）。最後一個用戶端斷線的時候，橋接程式見過的每個有安全值的頻道會立刻得到它的安全值，正常關閉時也一樣。它不涵蓋橋接程式從沒聽過的頻道，也不涵蓋被 SIGKILL 殺掉的橋接程式。',
      },
      {
        en: 'It throws at once for port 7457 (it belongs to The Last Input and the monitor), for a `host` that is not loopback, and for a bad config (no `channels`, an unknown sink, a `safe` value that is not a number, a `timeoutMs` under 20). A port already in use rejects the returned promise.',
        zh: '連接埠是 7457（那是 The Last Input 和後台監看用的）、`host` 不是 loopback、設定有問題（沒有 `channels`、不認得的 sink、`safe` 的值不是數字、`timeoutMs` 小於 20），它都會立刻丟出錯誤。連接埠已被占用，回傳的 promise 會被拒絕。',
      },
    ],
    needs: {
      en: 'Node 22 or later. The sinks need what they talk to: a WLED device for `ddp`, the device file for `serial`, a listener for `osc`.',
      zh: 'Node 22 以上。各個輸出需要它要連的對象：`ddp` 要有 WLED 裝置，`serial` 要有裝置檔，`osc` 要有人在聽。',
    },
    notes: [
      {
        en: 'The error messages the bridge throws and sends back to a page are written in Chinese in the code, so a page may show them in Chinese whatever its language.',
        zh: '橋接程式丟出的、以及回傳給頁面的錯誤訊息，在程式碼裡是用中文寫的，所以不管頁面是什麼語言，頁面上看到的可能是中文。',
      },
    ],
    tbd: [
      {
        en: 'The `ddp` (WLED) and `serial` sinks were not tried here with real hardware; what the description says about them comes from the package README and the code. The `log` sink and the watchdog were run.',
        zh: '`ddp`（WLED）和 `serial` 輸出沒有用真正的硬體試過。說明裡講到它們的部分來自套件的 README 和程式碼。`log` 輸出和看門狗是實際跑過的。',
      },
    ],
    examples: [
      {
        code: `import { startBridge } from '@openav/out/bridge';
import { OutClient } from '@openav/out';

const bridge = await startBridge({
  port: 0,                                                       // any free port
  config: { channels: [{ match: '*', sink: 'log' }], safe: { 'light/*': 0 }, timeoutMs: 2000 },
  print: (line) => console.log('sink:', line),
});
const out = new OutClient({ url: 'ws://127.0.0.1:' + bridge.port + '/out', id: 'demo' }).connect();
setTimeout(() => out.set('light/0/r', 0.8), 100);                // reaches the sink
setTimeout(() => out.close(), 300);                              // the last client leaves: safe values go out
setTimeout(() => bridge.close(), 600);`,
        caption: { en: 'In Node: the console prints `sink: light/0/r 0.8`, then `sink: light/0/r 0`: when the page goes away the bridge puts the light channel on its safe value.', zh: '在 Node 裡：主控台印出 `sink: light/0/r 0.8`，然後是 `sink: light/0/r 0`：頁面一離開，橋接程式就讓燈的頻道回到安全值。' },
        run: 'static',
        why: 'It starts a server and runs in Node (it imports node:http); a browser page cannot run it.',
      },
    ],
    related: ['OutClient', 'loadConfig', 'globToRegExp', 'DEFAULT_TIMEOUT_MS'],
    keywords: {
      en: ['out bridge', 'bridge', 'wled', 'ddp', 'serial', 'osc sink', 'watchdog', 'safe value', 'hardware', 'config', 'channels', 'node server'],
      zh: ['輸出橋接', '橋接程式', 'wled', 'ddp', '序列埠', 'osc', '看門狗', '安全值', '硬體', '設定檔', '頻道', 'node 伺服器'],
    },
  },

  loadConfig: {
    group: 'osc',
    summary: {
      en: 'Reads the out-bridge config from a JSON file and returns it as an object (Node only); throws when the file cannot be read.',
      zh: '從 JSON 檔讀取輸出橋接程式的設定並回傳成物件（只能在 Node 執行），讀不到檔案就丟出錯誤。',
    },
    params: [
      { name: 'file', type: 'String', en: 'The path of the JSON file, such as `out.json` (copy `packages/out/bridge/out.example.json` to start).', zh: 'JSON 檔的路徑，例如 `out.json`（可以從複製 `packages/out/bridge/out.example.json` 開始）。' },
    ],
    returns: {
      type: 'Object',
      en: 'The parsed config, unchecked: [`startBridge()`](#out-startBridge) is what validates it.',
      zh: '解析後的設定，沒有檢查：驗證它的是 [`startBridge()`](#out-startBridge)。',
    },
    description: [
      {
        en: 'A thin helper around `fs.readFileSync` and `JSON.parse`. A missing file or invalid JSON throws one error that names the file (its text is written in Chinese in the code). The command line uses it for `--config out.json`; in your own program you may just as well pass an object to `startBridge({ config })`.',
        zh: '包著 `fs.readFileSync` 和 `JSON.parse` 的薄薄一層。找不到檔案或 JSON 不合法，會丟出一個指出檔名的錯誤（訊息在程式碼裡是用中文寫的）。命令列的 `--config out.json` 就是用它。在你自己的程式裡，直接把物件傳給 `startBridge({ config })` 也一樣。',
      },
    ],
    examples: [
      {
        code: `import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadConfig } from '@openav/out/bridge';

const file = path.join(os.tmpdir(), 'oav-example-out.json');          // a scratch file, not your real config
fs.writeFileSync(file, JSON.stringify({ channels: [{ match: '*', sink: 'log' }], safe: { 'light/*': 0 } }));
const config = loadConfig(file);
console.log(config.channels.length, config.safe);      // 1 { 'light/*': 0 }
try { loadConfig('missing.json'); } catch (error) { console.log('cannot load:', error.message.includes('missing.json')); }   // true`,
        caption: { en: 'In Node: the console prints `1 { \'light/*\': 0 }`, then `cannot load: true`: the error names the missing file.', zh: '在 Node 裡：主控台印出 `1 { \'light/*\': 0 }`，然後是 `cannot load: true`：錯誤訊息裡有那個找不到的檔名。' },
        run: 'static',
        why: 'It reads a file with node:fs, which a browser page cannot do.',
      },
    ],
    related: ['globToRegExp'],
    keywords: {
      en: ['load config', 'config file', 'out.json', 'json', 'read config', 'bridge config'],
      zh: ['讀取設定', '設定檔', 'out.json', 'json', '橋接設定'],
    },
  },

  globToRegExp: {
    group: 'osc',
    summary: {
      en: 'Turns a channel glob like `light/*` into the regular expression the bridge matches channel names with: only `*` is special, and it crosses slashes.',
      zh: '把像 `light/*` 這樣的頻道萬用字元，轉成橋接程式用來比對頻道名稱的正規表示式：只有 `*` 有特殊意義，而且它可以跨過斜線。',
    },
    params: [
      { name: 'glob', type: 'String', en: 'The pattern. `*` matches any run of characters, slashes included. Everything else, including `.`, `?` and `+`, matches itself.', zh: '樣式。`*` 符合任何一串字元，包含斜線。其他一切，包括 `.`、`?` 和 `+`，都只符合它自己。' },
    ],
    returns: {
      type: 'RegExp',
      en: 'An anchored expression: `globToRegExp(\'light/*\')` is `/^light\\/.*$/`.',
      zh: '一個固定頭尾的正規表示式：`globToRegExp(\'light/*\')` 是 `/^light\\/.*$/`。',
    },
    description: [
      {
        en: 'The `match` of a channel rule and the keys of `safe` in the bridge config are globs, and this is how both are read. Remember that `*` also crosses slashes: `light/*` fits `light/0/r`, and `*` alone fits every channel.',
        zh: '橋接設定裡，頻道規則的 `match` 和 `safe` 的鍵都是萬用字元，兩者都是用它來解讀。請記得 `*` 也能跨過斜線：`light/*` 符合 `light/0/r`，只寫 `*` 就符合每一個頻道。',
      },
    ],
    examples: [
      {
        code: `import { globToRegExp } from '@openav/out/bridge';

const lights = globToRegExp('light/*');
console.log(lights.test('light/0/r'), lights.test('motor/1'));   // true false
console.log(globToRegExp('*').test('any/channel/at/all'));       // true
console.log(globToRegExp('a.b').test('axb'));                    // false: the dot is only a dot`,
        caption: { en: 'In Node: the console prints `true false`, then `true`, then `false`.', zh: '在 Node 裡：主控台印出 `true false`，然後是 `true`，再來是 `false`。' },
        run: 'static',
        why: 'It lives in the bridge entry point, which imports Node\'s http module and cannot load in a browser page.',
      },
    ],
    related: ['loadConfig'],
    keywords: {
      en: ['glob', 'wildcard', 'pattern', 'match', 'channel match', 'regular expression', 'light/*'],
      zh: ['萬用字元', '樣式', '比對', '頻道比對', '正規表示式', 'light/*'],
    },
  },

  DEFAULT_PORT: {
    group: 'osc',
    summary: {
      en: 'The out-bridge\'s default port: 6450.',
      zh: '輸出橋接程式預設的連接埠：6450。',
    },
    description: [
      {
        en: 'The default of `startBridge({ port })` and of `--port`; the environment variable `OUT_BRIDGE_PORT` changes it for the command line. It is the **out**-bridge\'s port: the Leap bridge has its own ([`DEFAULT_PORT` of `@openav/leap`](#leap-DEFAULT_PORT), 6437).',
        zh: '`startBridge({ port })` 和 `--port` 的預設值。環境變數 `OUT_BRIDGE_PORT` 可以改命令列用的值。這是**輸出**橋接程式的連接埠：Leap 橋接程式有自己的（[`@openav/leap` 的 `DEFAULT_PORT`](#leap-DEFAULT_PORT)，6437）。',
      },
    ],
    related: ['OUT_DEFAULT_URL'],
    keywords: {
      en: ['port', '6450', 'default port', 'out bridge port'],
      zh: ['連接埠', '6450', '預設連接埠', '輸出橋接連接埠'],
    },
  },

  DEFAULT_TIMEOUT_MS: {
    group: 'osc',
    summary: {
      en: 'The watchdog time when the config does not say: 500 milliseconds without a value, and a channel is put on its safe value.',
      zh: '設定檔沒寫的時候，看門狗的時間：500 毫秒沒有收到值，頻道就會被放到它的安全值。',
    },
    description: [
      {
        en: 'It is the default of `timeoutMs` in the bridge config (the minimum allowed is 20). [`OutClient`](#OutClient) re-sends held values every third of whatever the bridge reports, so a still slider is not mistaken for a dead page. Lower it for hardware that must stop quickly, but keep it above the slowest frame your page may have.',
        zh: '這是橋接設定裡 `timeoutMs` 的預設值（允許的最小值是 20）。[`OutClient`](#OutClient) 每隔橋接程式回報的時間的三分之一就重送目前的值，所以停著不動的滑桿不會被誤認為當掉的頁面。需要硬體很快停下來的話可以調低它，但要比你的頁面可能出現的最慢畫面更長。',
      },
    ],
    related: ['OutClient'],
    keywords: {
      en: ['timeout', 'watchdog', '500 ms', 'safe value', 'timeoutMs'],
      zh: ['逾時', '看門狗', '500 毫秒', '安全值', 'timeoutMs'],
    },
  },

  RESERVED_PORTS: {
    group: 'osc',
    summary: {
      en: 'The ports the out-bridge refuses to use: `[7457]`, which belongs to The Last Input and the backstage monitor.',
      zh: '輸出橋接程式拒絕使用的連接埠：`[7457]`，那是 The Last Input 和後台監看用的。',
    },
    description: [
      {
        en: '`startBridge({ port: 7457 })` throws at once, so the bridge can never take the port the monitor listens on. The Leap bridge refuses the same one ([`RESERVED_PORTS` of `@openav/leap`](#leap-RESERVED_PORTS)).',
        zh: '`startBridge({ port: 7457 })` 會立刻丟出錯誤，所以橋接程式絕不會占走後台監看監聽的連接埠。Leap 橋接程式也拒絕同一個（[`@openav/leap` 的 `RESERVED_PORTS`](#leap-RESERVED_PORTS)）。',
      },
    ],
    related: ['MonitorFeed'],
    keywords: {
      en: ['reserved ports', '7457', 'refused port', 'monitor port'],
      zh: ['保留連接埠', '7457', '拒絕的連接埠', '監看連接埠'],
    },
  },
};
