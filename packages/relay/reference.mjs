// @openav/relay reference: the room relay, its browser client and the signal helpers. Read by tools/build-reference.mjs
// (see AGENTS.md, "Documenting a public name"). The pure helpers have module examples that run headless. A real WebSocket
// server cannot run on a page, so RelayClient also has an example against a stand-in socket, and attachRelay is static.

export default {
  RelayClient: {
    group: 'remote',
    summary: {
      en: 'The browser end of the room relay: sends signals to the other pages in a room and receives theirs, as a phone (controller), the show (runner) or a backstage monitor.',
      zh: '房間中繼的瀏覽器端：把訊號送給同一個房間裡的其他頁面，也接收它們的訊號，身分可以是手機（controller）、演出本身（runner）或後台監看（monitor）。',
    },
    params: [
      { name: 'role', type: "'controller' | 'runner' | 'monitor'", en: 'Who this page is. A controller (a phone) sends signals to the runner and the monitors. A runner (the show) hears the controllers, and can send feedback and config back. A monitor only listens. The server treats any other word as `controller`.', zh: '這個頁面的身分。控制端（controller，也就是手機）把訊號送給演出端和監看端。演出端（runner，也就是演出本身）聽得到控制端，也能把 feedback 和 config 送回去。監看端（monitor）只聽不說。伺服器遇到其他字一律當成 `controller`。' },
      { name: 'room', type: 'String', en: 'The room name. Pages in different rooms never hear each other. 1 to 32 characters of `A–Z a–z 0–9 _ -`; the server turns anything else into `default`.', zh: '房間名稱。不同房間的頁面彼此聽不到。1 到 32 個字元，只能用 `A–Z a–z 0–9 _ -`，其他的伺服器會換成 `default`。' },
      { name: 'id', type: 'String', en: 'This device\'s id, the `<id>` in `phone/<id>/…`. The default is [`deviceId()`](#deviceId), which is kept in `localStorage`. The server keeps its first 64 characters.', zh: '這個裝置的 id，也就是 `phone/<id>/…` 裡的 `<id>`。預設是 [`deviceId()`](#deviceId)，存在 `localStorage` 裡。伺服器只留前 64 個字元。' },
      { name: 'url', type: 'String', en: 'The full WebSocket address, with the query already on it: `wss://host/relay?role=controller&room=main&id=ab12`. Nothing is added to it. Leave it out and the client uses `?relay=ws://…` from the page\'s address, or else the page\'s own `/relay` (`wss:` on an https page), and adds `role`, `room` and `id` itself.', zh: '完整的 WebSocket 位址，查詢字串要自己帶好：`wss://host/relay?role=controller&room=main&id=ab12`。它不會再補任何東西。不給的話，用頁面網址裡的 `?relay=ws://…`，再沒有就用頁面自己的 `/relay`（https 頁面用 `wss:`），並自動補上 `role`、`room`、`id`。' },
      { name: 'batchHz', type: 'Number', en: 'How many times a second the values you `set()` are flushed to the relay, as one `batch` message.', zh: '每秒把你 `set()` 的數值送出幾次，打包成一則 `batch` 訊息。' },
      { name: 'resendMs', type: 'Number', en: 'Every this many milliseconds, send every stored value again, not only the changed ones. This is what lets a phone that joins late, or a show page that reloads, catch up.', zh: '每隔這麼多毫秒，把存起來的每一個值再送一次，不只是有變動的。晚進來的手機、重新載入的演出頁面，就靠這個趕上現況。' },
      { name: 'onStatus', type: 'Function', optional: true, en: '`(client) => {}`, called when the connection opens or closes, when a `pong` gives a new `latency`, and when the peer counts change. Read `client.status`, `client.latency` and `client.peers` inside it.', zh: '`(client) => {}`，連線打開或關閉、`pong` 帶來新的 `latency`、連線數改變的時候呼叫。在裡面讀 `client.status`、`client.latency`、`client.peers`。' },
      { name: 'onSignal', type: 'Function', optional: true, en: '`(name, value, msg) => {}`, for every signal that arrives (a runner or monitor hears the controllers; a monitor also hears the runner). A `batch` calls it once per item. `msg.pulse` is true for a pulse. [`bindSignals()`](#bindSignals) fills this in for you.', zh: '`(name, value, msg) => {}`，每收到一個訊號就呼叫（演出端和監看端聽得到控制端，監看端也聽得到演出端）。一則 `batch` 會每個項目各呼叫一次。脈衝訊號的 `msg.pulse` 是 true。[`bindSignals()`](#bindSignals) 會替你填這一項。' },
      { name: 'onFeedback', type: 'Function', optional: true, en: '`(name, value) => {}`, on a controller: a value the runner sent with `feedback()`, to show in a meter or to move a fader.', zh: '`(name, value) => {}`，在控制端：演出端用 `feedback()` 送來的數值，拿去顯示在音量表或移動推桿。' },
      { name: 'onConfig', type: 'Function', optional: true, en: '`(key, data) => {}`, on a controller: a standing config the runner sent with `config()`, such as the surface layout. A phone that joins late gets the stored ones right away.', zh: '`(key, data) => {}`，在控制端：演出端用 `config()` 送來的常駐設定，例如控制面板的版面。晚進來的手機會立刻收到已儲存的那些。' },
    ],
    description: [
      {
        en: 'Make one client per page, give it a role and a room, and call `connect()`. A phone calls `phone.set(\'phone/me/tilt/x\', 0.3)` for values that change continuously and `phone.send(\'midi/note/on\', { note: 60 }, true)` for events. The show passes its client to [`bindSignals()`](#bindSignals), and every phone signal lands in its `Signals`. The relay itself is [`attachRelay()`](#attachRelay) on a Node server.',
        zh: '每個頁面做一個用戶端，給它身分和房間，然後呼叫 `connect()`。手機用 `phone.set(\'phone/me/tilt/x\', 0.3)` 送連續變化的數值，用 `phone.send(\'midi/note/on\', { note: 60 }, true)` 送事件。演出端把自己的用戶端交給 [`bindSignals()`](#bindSignals)，每個手機訊號就會進到它的 `Signals`。中繼本身是 Node 伺服器上的 [`attachRelay()`](#attachRelay)。',
      },
      {
        en: 'Continuous values are cheap on purpose: `set()` only stores the value (and does nothing if it is the same as the last), then every `1 / batchHz` seconds the changed ones leave in one `batch`, and every `resendMs` all of them leave again. Events are the opposite: `send()` leaves at once and is never batched or repeated, because a note-on delivered twice is a bug.',
        zh: '連續的數值刻意做得很省：`set()` 只是把值存起來（跟上一次一樣就什麼都不做），之後每 `1 / batchHz` 秒，有變動的值打包成一則 `batch` 送出，每 `resendMs` 毫秒，全部的值再送一遍。事件則相反：`send()` 馬上送出，不打包也不重送，因為一個 note-on 收到兩次就是錯。',
      },
      {
        en: 'It looks after the connection itself. When the socket closes it reconnects after 0.5 s, then 1 s, 2 s, 4 s and every 5 s, until you call `close()`. A ping goes out every 2 s and the answer becomes `latency` in milliseconds. `status` is `\'connecting\'`, `\'open\'` or `\'closed\'`, and `peers` is how many `controllers`, `runners` and `monitors` the room has.',
        zh: '連線它自己照顧。socket 關掉之後，它會在 0.5 秒、1 秒、2 秒、4 秒，之後每 5 秒重連一次，直到你呼叫 `close()`。每 2 秒送一個 ping，回應的時間差就是 `latency`（毫秒）。`status` 是 `\'connecting\'`、`\'open\'` 或 `\'closed\'`，`peers` 是房間裡有幾個 `controllers`、`runners`、`monitors`。',
      },
    ],
    needs: {
      en: 'A relay server for it to reach, such as `node serve.js` (it hosts one at `/relay`) or `node packages/relay/server.js`. Until the socket is open, `set()` keeps the latest values and sends them when it opens, but `send()`, `feedback()` and `config()` messages are dropped, not queued.',
      zh: '要有一台中繼伺服器可以連，例如 `node serve.js`（它在 `/relay` 架了一個）或 `node packages/relay/server.js`。socket 還沒打開之前，`set()` 會記住最新的值，打開時送出，但 `send()`、`feedback()`、`config()` 的訊息會直接丟掉，不會排隊。',
    },
    members: {
      open: { en: 'True while the socket is open (a getter). `send()` and `config()` do nothing when it is false.', zh: 'socket 開著的時候是 true（getter）。它是 false 的時候，`send()` 和 `config()` 什麼都不做。' },
      connect: { en: '`connect()`: open the socket and start the timers (flush, re-send, ping). Returns the client, so `new RelayClient({…}).connect()` works. Calling it again after `close()` starts over.', zh: '`connect()`：打開 socket，啟動計時器（送出、重送、ping）。回傳用戶端本身，所以 `new RelayClient({…}).connect()` 可以直接寫。`close()` 之後再呼叫一次就會重新開始。' },
      close: { en: '`close()`: stop the timers and close the socket for good. It does not reconnect until you call `connect()` again.', zh: '`close()`：停掉計時器並把 socket 關掉。在你再次呼叫 `connect()` 之前不會重連。' },
      send: { en: '`send(name, value, pulse?, extra?)`: send one signal now. `pulse` true marks it as an event. `extra` is an object whose keys are added to the message. Dropped if the socket is not open.', zh: '`send(name, value, pulse?, extra?)`：現在就送出一個訊號。`pulse` 為 true 表示它是事件。`extra` 是物件，裡面的鍵會加進訊息裡。socket 沒開的話就丟掉。' },
      set: { en: '`set(name, value)`: a value that changes continuously. Only the latest value per name is kept; it goes out with the next flush and again every `resendMs`.', zh: '`set(name, value)`：連續變化的數值。每個名字只留最新的值，隨下一次送出一起出去，之後每 `resendMs` 再送一次。' },
      feedback: { en: '`feedback(name, value)`: runner only. A value for the controllers to display or to echo, flushed like `set()` and re-sent every `resendMs`. Nothing happens on a controller or a monitor.', zh: '`feedback(name, value)`：只有演出端有用。給控制端顯示或回應的數值，送出的方式跟 `set()` 一樣，每 `resendMs` 再送一次。在控制端或監看端上什麼都不會發生。' },
      config: { en: '`config(key, data)`: runner only. Send a standing config at once, for example `config(\'surface\', { layout })`. The relay keeps it per key for controllers that join later, and forgets it when the runner leaves.', zh: '`config(key, data)`：只有演出端有用。馬上送出一份常駐設定，例如 `config(\'surface\', { layout })`。中繼會依 key 留著，給之後才加入的控制端，演出端離開時就忘掉。' },
    },
    notes: [
      {
        en: 'Public fields: `role`, `room`, `id`, `url`, `batchHz`, `resendMs`, the callbacks, `status`, `latency` (milliseconds, `null` until the first pong), `peers` and `sent` (how many messages have gone out).',
        zh: '公開的欄位有 `role`、`room`、`id`、`url`、`batchHz`、`resendMs`、各個回呼、`status`、`latency`（毫秒，第一個 pong 回來之前是 `null`）、`peers` 和 `sent`（已經送出幾則訊息）。',
      },
      {
        en: 'After a reconnect the runner has to send its `config()` again: the client does not remember it. `mountRemoteHost()` does that for you.',
        zh: '重連之後，演出端要再送一次 `config()`：用戶端不會記得它。`mountRemoteHost()` 會替你做這件事。',
      },
    ],
    examples: [
      {
        code: `import { RelayClient, bindSignals } from '@openav/relay';
import { Signals } from '@openav/core';

// the show page: every phone signal lands in a Signals registry
const signals = new Signals();
const show = new RelayClient({ role: 'runner', room: 'main' }).connect();
bindSignals(show, signals);

// the phone page: a continuous value and an event
const phone = new RelayClient({ role: 'controller', room: 'main' }).connect();
phone.set('phone/me/tilt/x', 0.3);
phone.send('midi/note/on', { note: 60 }, true);`,
        caption: { en: 'The two ends of one room, as they would sit on two pages (the show and a phone): once the socket is open, the show\'s signals hold `phone/me/tilt/x` and, as an alias, `phone/any/tilt/x`.', zh: '一個房間的兩端，實際上會放在兩個頁面（演出和手機）：socket 打開之後，演出端的 signals 裡就有 `phone/me/tilt/x`，以及別名 `phone/any/tilt/x`。' },
        run: 'static',
        why: 'It needs a relay server to connect to (node serve.js, or node packages/relay/server.js) and two pages, one for the show and one for the phone. The next example runs the same flow against a stand-in socket.',
      },
      {
        code: `import { RelayClient, bindSignals } from '@openav/relay';
import { Signals } from '@openav/core';

// A stand-in for the relay so this runs without a server: a controller's messages reach the runner,
// and the runner's feedback and config reach the controller (the same routing the real relay does).
const sockets = [];
globalThis.WebSocket = class {
  constructor(url) {
    this.role = new URL(url).searchParams.get('role');
    this.readyState = 1;
    sockets.push(this);
    setTimeout(() => this.onopen?.());
  }
  send(text) {
    const type = JSON.parse(text).type;
    const to = this.role === 'controller' ? 'runner' : (type === 'feedback' || type === 'config') ? 'controller' : null;
    for (const s of sockets) if (s.role === to) s.onmessage?.({ data: text });
  }
  close() {}
};

const signals = new Signals();
const show = new RelayClient({ role: 'runner', url: 'ws://relay/x?role=runner&room=demo&id=show' }).connect();
bindSignals(show, signals);
const got = [];
const phone = new RelayClient({
  role: 'controller', url: 'ws://relay/x?role=controller&room=demo&id=ab12',
  onFeedback: (name, value) => got.push('feedback ' + name + ' = ' + value),
  onConfig: (key, data) => got.push('config ' + key + ' = ' + JSON.stringify(data)),
}).connect();

phone.set('phone/ab12/tilt/x', 0.3);
show.feedback('surface/main/level', 0.4);
show.config('surface', { title: 'demo' });

setTimeout(() => {
  got.push('tilt in the show: ' + signals.get('phone/any/tilt/x'));
  document.getElementById('app').innerHTML = got.join('<br>');
  phone.close(); show.close();
}, 200);`,
        caption: { en: 'Prints the config and the feedback the phone got back from the show, then the phone\'s tilt as the show hears it (under its alias `phone/any/tilt/x`). Same calls as against a real relay.', zh: '印出手機從演出端收到的 config 和 feedback，再印出演出端聽到的手機傾斜（在別名 `phone/any/tilt/x` 底下）。呼叫的方式跟連真正的中繼完全一樣。' },
      },
    ],
    related: ['bindSignals', 'attachRelay', 'deviceId', 'mountRemoteHost', 'mountRemote', 'Signals'],
    keywords: {
      en: ['relay', 'websocket', 'room', 'phone', 'controller', 'runner', 'monitor', 'client', 'connect', 'send signal', 'feedback', 'config', 'reconnect', 'latency'],
      zh: ['中繼', 'websocket', '房間', '手機', '控制端', '演出端', '監看端', '連線', '傳送訊號', '回饋', '設定', '重連', '延遲'],
    },
  },

  deviceId: {
    group: 'remote',
    summary: {
      en: 'The short random id of this browser, kept in `localStorage`: the `<id>` in `phone/<id>/…`.',
      zh: '這個瀏覽器的隨機短 id，存在 `localStorage` 裡：就是 `phone/<id>/…` 裡的 `<id>`。',
    },
    params: [
      { name: 'key', type: 'String', en: 'The `localStorage` key. The default is the one the lab uses, so `/control` and `/remote` on one phone count as one device.', zh: '`localStorage` 的 key。預設是實驗室用的那一個，所以同一支手機上的 `/control` 和 `/remote` 算是同一個裝置。' },
    ],
    returns: { type: 'String', en: 'A short id of about five letters and digits, such as `k3x9a`. The same one on every call, in the same browser.', zh: '大約五個字母和數字的短 id，例如 `k3x9a`。同一個瀏覽器裡，每次呼叫都一樣。' },
    description: [
      {
        en: 'The first call makes an id and stores it under `key`; later calls read it back. [`RelayClient`](#RelayClient) uses it as its default `id`, so a phone keeps the same name across reloads and its signals stay `phone/<same id>/…`.',
        zh: '第一次呼叫會做一個 id 並存在 `key` 底下，之後的呼叫就把它讀回來。[`RelayClient`](#RelayClient) 把它當作預設的 `id`，所以手機重新載入之後名字不變，訊號也一直是 `phone/<同一個 id>/…`。',
      },
      {
        en: 'If `localStorage` is blocked (some private windows), nothing can be stored and every call makes a new id.',
        zh: '如果 `localStorage` 被擋掉（有些無痕視窗），就存不下來，每次呼叫都會做一個新的 id。',
      },
    ],
    examples: [
      {
        code: `import { deviceId } from '@openav/relay';

const first = deviceId();
const again = deviceId();
document.getElementById('app').textContent =
  \`id \${first}, the same on the next call: \${first === again}\`;`,
        caption: { en: 'Prints a short id and "true": the second call reads back what the first one stored.', zh: '印出一個短 id 和「true」：第二次呼叫讀回第一次存下的值。' },
      },
    ],
    related: ['RelayClient', 'PhoneSensors'],
    keywords: {
      en: ['device id', 'phone id', 'localStorage', 'identity', 'unique id', 'random id'],
      zh: ['裝置 id', '手機 id', 'localStorage', '識別', '隨機 id'],
    },
  },

  signalMeta: {
    group: 'remote',
    summary: {
      en: 'What the relay knows about a signal name: its range and unit, or that it is a pulse. Returns `null` for names it does not know.',
      zh: '中繼對一個訊號名稱知道什麼：它的範圍和單位，或者它是脈衝。不認得的名稱回傳 `null`。',
    },
    params: [
      { name: 'name', type: 'String', en: 'A signal name such as `phone/ab12/tilt/x`, `surface/main/hue` or `midi/note/on`.', zh: '訊號名稱，例如 `phone/ab12/tilt/x`、`surface/main/hue` 或 `midi/note/on`。' },
      { name: 'pulse', type: 'Boolean', optional: true, en: 'Pass `{ pulse: true }` when the message was sent as an event: the answer is then always `{ kind: \'pulse\' }`.', zh: '訊息是當作事件送來的話，傳 `{ pulse: true }`：答案一律是 `{ kind: \'pulse\' }`。' },
    ],
    returns: { type: 'Object | null', en: 'Metadata for `signals.define()`: `{ min, max, unit? }`, `{ kind: \'pulse\' }`, or `{}` for raw values. `null` when the name is not one it knows.', zh: '給 `signals.define()` 用的資料：`{ min, max, unit? }`、`{ kind: \'pulse\' }`，原始值則是 `{}`。名稱不在它認得的範圍內時是 `null`。' },
    description: [
      {
        en: 'A `Signals` registry needs to know a name\'s range before a meter can scale it or a mapping can tell a knob from an event. [`fileSignal()`](#fileSignal) calls this the first time it hears a name. What it knows: `phone/<id>/tilt/*` is −1..1, `accel/*` is −20..20 m/s², `rot/*` is −360..360 °/s, `orient/*` is 0..360 °, `touch/count` is 0..10, `knock` is a pulse, and every other `phone/…` name (touch, light) is 0..1. `surface/…` names are 0..1 (`…/raw` and `…/delta` are unscaled, `{}`). `midi/note/on`, `midi/note/off`, `midi/virtual` and the `hit`, `on`, `off`, `last` names of a controller are pulses, and `midi/cc/*` is 0..1.',
        zh: '`Signals` 要先知道一個名稱的範圍，音量表才能縮放、映射才分得出旋鈕和事件。[`fileSignal()`](#fileSignal) 第一次聽到一個名稱就會呼叫它。它認得的有：`phone/<id>/tilt/*` 是 −1..1，`accel/*` 是 −20..20 m/s²，`rot/*` 是 −360..360 °/s，`orient/*` 是 0..360 °，`touch/count` 是 0..10，`knock` 是脈衝，其他的 `phone/…` 名稱（觸控、光線）是 0..1。`surface/…` 的名稱是 0..1（`…/raw` 和 `…/delta` 沒有縮放，回傳 `{}`）。`midi/note/on`、`midi/note/off`、`midi/virtual`，以及控制器的 `hit`、`on`、`off`、`last` 名稱是脈衝，`midi/cc/*` 是 0..1。',
      },
    ],
    examples: [
      {
        code: `import { signalMeta } from '@openav/relay';

const names = ['phone/ab12/tilt/x', 'phone/ab12/accel/z', 'phone/ab12/knock', 'surface/main/hue', 'surface/main/hue/raw', 'midi/note/on', 'my/own/thing'];
document.getElementById('app').innerHTML = names
  .map((n) => \`\${n}: \${JSON.stringify(signalMeta(n))}\`)
  .join('<br>');`,
        caption: { en: 'Prints what the relay knows about seven names, from `{"min":-1,"max":1}` for tilt to `null` for a name it has never heard of.', zh: '印出中繼對七個名稱的認識，從傾斜的 `{"min":-1,"max":1}`，到完全不認得的名稱的 `null`。' },
      },
    ],
    related: ['fileSignal', 'bindSignals', 'aliasOf'],
    keywords: {
      en: ['signal meta', 'range', 'min max', 'pulse', 'declare', 'unit', 'signal names', 'phone signals'],
      zh: ['訊號資料', '範圍', '最小最大', '脈衝', '宣告', '單位', '訊號名稱', '手機訊號'],
    },
  },

  aliasOf: {
    group: 'remote',
    summary: {
      en: 'The "latest phone" name of a phone signal: `aliasOf(\'phone/ab12/tilt/x\')` is `\'phone/any/tilt/x\'`. `null` for anything else.',
      zh: '手機訊號的「最新那支手機」名稱：`aliasOf(\'phone/ab12/tilt/x\')` 是 `\'phone/any/tilt/x\'`。其他的名稱回傳 `null`。',
    },
    params: [
      { name: 'name', type: 'String', en: 'A signal name. Only `phone/<id>/…` has an alias.', zh: '訊號名稱。只有 `phone/<id>/…` 有別名。' },
      { name: 'alias', type: 'String', optional: true, en: 'The word that replaces the id. Leave it out for `any`.', zh: '用來取代 id 的字。不給就是 `any`。' },
    ],
    returns: { type: 'String | null', en: 'The alias name, or `null` when `name` is not a phone signal or already uses the alias.', zh: '別名。`name` 不是手機訊號、或本來就用別名的時候是 `null`。' },
    description: [
      {
        en: 'A route written in a World file cannot know the id of a stranger\'s phone. The alias fixes that: every phone signal is also filed under `phone/any/…`, which always holds the value from whichever phone sent last, so `{ source: \'phone/any/tilt/x\', target: \'hue\' }` can be written before anyone has joined. [`bindSignals()`](#bindSignals) and [`localSensors()`](#localSensors) both file the alias for you.',
        zh: '寫在世界檔案裡的路由，不可能知道陌生人手機的 id。別名就是用來解決這件事：每個手機訊號也會歸一份到 `phone/any/…`，它永遠是最後送出數值的那支手機的值，所以 `{ source: \'phone/any/tilt/x\', target: \'hue\' }` 在還沒有人加入之前就能寫好。[`bindSignals()`](#bindSignals) 和 [`localSensors()`](#localSensors) 都會替你歸這份別名。',
      },
    ],
    examples: [
      {
        code: `import { aliasOf } from '@openav/relay';

document.getElementById('app').innerHTML = [
  aliasOf('phone/ab12/tilt/x'),
  aliasOf('phone/any/tilt/x'),
  aliasOf('midi/note/on'),
  aliasOf('phone/ab12/knock', 'latest'),
].map(String).join('<br>');`,
        caption: { en: 'Prints phone/any/tilt/x, then null twice (already an alias; not a phone signal), then phone/latest/knock.', zh: '印出 phone/any/tilt/x，然後兩個 null（已經是別名、不是手機訊號），最後是 phone/latest/knock。' },
      },
    ],
    related: ['bindSignals', 'localSensors', 'fileSignal'],
    keywords: {
      en: ['alias', 'phone/any', 'latest phone', 'device id', 'route', 'stranger'],
      zh: ['別名', 'phone/any', '最新的手機', '裝置 id', '路由', '陌生人'],
    },
  },

  normalizeValue: {
    group: 'remote',
    summary: {
      en: 'Fills in the missing velocity spelling of a note message: `vel` (0..1) or `velocity` (1..127). Every other message passes through unchanged.',
      zh: '補上音符訊息缺的那一種力度寫法：`vel`（0..1）或 `velocity`（1..127）。其他訊息原樣通過。',
    },
    params: [
      { name: 'name', type: 'String', en: 'The signal name. Only `midi/note/on`, `midi/note/off` and the same with a device in the middle (`midi/<device>/note/on`) are touched.', zh: '訊號名稱。只有 `midi/note/on`、`midi/note/off`，以及中間多一個裝置名的寫法（`midi/<device>/note/on`）會被處理。' },
      { name: 'value', type: 'any', en: 'The payload. Only an object with `vel` or `velocity` is changed (a copy, never the original).', zh: '訊號的內容。只有帶 `vel` 或 `velocity` 的物件會被改（改的是複本，不動原件）。' },
    ],
    returns: { type: 'any', en: 'The payload with both `vel` and `velocity`. If both were there already, the same object comes back untouched.', zh: '同時帶 `vel` 和 `velocity` 的內容。兩個本來就都有的話，原物件原樣傳回。' },
    description: [
      {
        en: '`@openav/midi` publishes `vel` as 0..1, a hardware keyboard talks in `velocity` 1..127, and senders (an old phone page, a TouchOSC bridge, a sequencer) give one or the other. A sketch is written against one spelling, so the receiving end fills in the other: `velocity` becomes `vel = velocity / 127`, and `vel` becomes `velocity = Math.round(vel * 127)`.',
        zh: '`@openav/midi` 發布的 `vel` 是 0..1，硬體鍵盤說的是 1..127 的 `velocity`，而送訊號的人（舊的手機頁面、TouchOSC 橋接、編曲軟體）只會給其中一種。草圖通常只照一種寫法寫，所以接收端把另一種補上：`velocity` 會變成 `vel = velocity / 127`，`vel` 會變成 `velocity = Math.round(vel * 127)`。',
      },
      {
        en: 'You rarely call it yourself: [`fileSignal()`](#fileSignal) does it for every message it files.',
        zh: '通常不用自己呼叫：[`fileSignal()`](#fileSignal) 歸檔每一則訊息時都會做這件事。',
      },
    ],
    examples: [
      {
        code: `import { normalizeValue } from '@openav/relay';

const rows = [
  normalizeValue('midi/note/on', { note: 60, velocity: 127 }),
  normalizeValue('midi/note/on', { note: 60, vel: 0.5 }),
  normalizeValue('midi/minilab3/note/off', { note: 61, vel: 1 }),
  normalizeValue('surface/main/pad/hit', { velocity: 3 }),
];
document.getElementById('app').innerHTML = rows.map((r) => JSON.stringify(r)).join('<br>');`,
        caption: { en: 'The first two gain the spelling they lacked (`vel` 1 and `velocity` 64); the third works with a device in the name; the fourth is not a note and stays as it is.', zh: '前兩個補上缺的寫法（`vel` 是 1、`velocity` 是 64）。第三個名稱中間有裝置名也照樣處理。第四個不是音符，保持原樣。' },
      },
    ],
    related: ['fileSignal', 'bindSignals'],
    keywords: {
      en: ['velocity', 'vel', 'note on', 'midi', '127', 'normalize', 'touchosc', 'keyboard'],
      zh: ['力度', 'vel', 'velocity', '音符', 'midi', '正規化', '鍵盤'],
    },
  },

  fileSignal: {
    group: 'remote',
    summary: {
      en: 'Files one incoming signal into a `Signals` registry: declares the name the first time, fills in the velocity, then sets it or pulses it.',
      zh: '把一個收到的訊號歸進 `Signals`：第一次聽到名稱就先宣告，補上力度，再設值或觸發脈衝。',
    },
    params: [
      { name: 'signals', type: 'Signals', en: 'The registry to file it in (from `@openav/core`).', zh: '要歸進去的註冊表（來自 `@openav/core`）。' },
      { name: 'name', type: 'String', en: 'The signal name. It must be a non-empty string of at most 128 characters, or nothing is filed.', zh: '訊號名稱。必須是非空字串，最長 128 個字元，否則什麼都不歸。' },
      { name: 'value', type: 'any', en: 'The payload.', zh: '訊號的內容。' },
      { name: 'pulse', type: 'Boolean', optional: true, en: 'True when the message was sent as an event. A name that [`signalMeta()`](#signalMeta) knows to be a pulse (or was declared as one) is a pulse either way.', zh: '訊息是當作事件送來的話為 true。名稱若是 [`signalMeta()`](#signalMeta) 認得的脈衝（或之前就宣告成脈衝），不管這一項是什麼，都當作脈衝。' },
      { name: 'meta', type: 'Function', optional: true, en: 'Replace [`signalMeta`](#signalMeta) with your own `(name, { pulse }) => metadata | null`, to declare names the relay does not know.', zh: '用你自己的 `(name, { pulse }) => 資料 | null` 取代 [`signalMeta`](#signalMeta)，用來宣告中繼不認得的名稱。' },
      { name: 'source', type: 'String', optional: true, en: 'A label stored in the declared metadata (`signals.meta.get(name).source`), such as `\'relay\'` or `\'local\'`.', zh: '存進宣告資料裡的標籤（`signals.meta.get(name).source`），例如 `\'relay\'` 或 `\'local\'`。' },
    ],
    returns: { type: 'Boolean', en: '`true` when it was filed, `false` for a bad name.', zh: '歸好了是 `true`，名稱不合格是 `false`。' },
    description: [
      {
        en: 'This is the receiving half of the wire format, and every receiver files a message the same way through it: [`bindSignals()`](#bindSignals) for a show that has a relay, [`localSensors()`](#localSensors) for a show on a phone, and a host that runs its own socket. In order: if the registry has never heard the name, declare it with what [`signalMeta()`](#signalMeta) says (a pulse is never mistaken for a knob, and meters get their range); fill in the missing velocity spelling with [`normalizeValue()`](#normalizeValue); then `signals.pulse(name, value)` for a pulse or `signals.set(name, value)` for the rest.',
        zh: '這是傳輸格式的接收那一半，每個接收端都靠它用同樣的方式歸檔訊息：有中繼的演出用 [`bindSignals()`](#bindSignals)，跑在手機上的演出用 [`localSensors()`](#localSensors)，自己開 socket 的主機也一樣。順序是：註冊表沒聽過這個名稱的話，就照 [`signalMeta()`](#signalMeta) 的說法宣告（脈衝不會被當成旋鈕，音量表也拿得到範圍），用 [`normalizeValue()`](#normalizeValue) 補上缺的力度寫法，然後脈衝就 `signals.pulse(name, value)`，其他就 `signals.set(name, value)`。',
      },
    ],
    examples: [
      {
        code: `import { fileSignal } from '@openav/relay';
import { Signals } from '@openav/core';

const signals = new Signals();
fileSignal(signals, 'midi/note/on', { note: 64, velocity: 100 });   // a known pulse name
fileSignal(signals, 'phone/ab12/tilt/x', 0.3, { source: 'relay' });
const bad = fileSignal(signals, '', 1);

document.getElementById('app').innerHTML = [
  'note vel: ' + signals.get('midi/note/on').vel.toFixed(2),
  'note kind: ' + signals.meta.get('midi/note/on').kind,
  'tilt range: ' + signals.meta.get('phone/ab12/tilt/x').min + '..' + signals.meta.get('phone/ab12/tilt/x').max,
  'empty name filed: ' + bad,
].join('<br>');`,
        caption: { en: 'Prints a velocity of 0.79 (100 / 127) that the sender never wrote, the kind "pulse", the range -1..1 for tilt, and "false" for the empty name.', zh: '印出送訊號的人沒寫過的力度 0.79（100 / 127）、種類「pulse」、傾斜的範圍 -1..1，以及空名稱的「false」。' },
      },
    ],
    related: ['bindSignals', 'signalMeta', 'normalizeValue', 'localSensors', 'aliasOf'],
    keywords: {
      en: ['file signal', 'receive', 'declare', 'signals', 'incoming', 'pulse', 'set', 'wire format'],
      zh: ['歸檔訊號', '接收', '宣告', 'signals', '收到的訊號', '脈衝', '設值', '傳輸格式'],
    },
  },

  bindSignals: {
    group: 'remote',
    summary: {
      en: 'Connects a runner\'s `RelayClient` to a `Signals` registry: every signal a phone sends is filed there, plus a `phone/any/…` copy. Returns an undo function.',
      zh: '把演出端的 `RelayClient` 接到 `Signals`：手機送來的每個訊號都歸進去，並多一份 `phone/any/…` 的複本。回傳一個復原函式。',
    },
    params: [
      { name: 'client', type: 'RelayClient', en: 'The runner\'s client (any object with an `onSignal` field works).', zh: '演出端的用戶端（任何有 `onSignal` 欄位的物件都行）。' },
      { name: 'signals', type: 'Signals', en: 'The registry to fill (from `@openav/core`).', zh: '要填的註冊表（來自 `@openav/core`）。' },
      { name: 'alias', type: 'String | null', optional: true, en: 'The word used in the copy, `phone/<alias>/…`. `null` or an empty string turns the copy off.', zh: '複本用的字，`phone/<alias>/…`。`null` 或空字串表示不做複本。' },
      { name: 'meta', type: 'Function', optional: true, en: 'Replace [`signalMeta`](#signalMeta) with your own declarations, as in [`fileSignal()`](#fileSignal).', zh: '像 [`fileSignal()`](#fileSignal) 一樣，用你自己的宣告取代 [`signalMeta`](#signalMeta)。' },
    ],
    returns: { type: 'Function', en: 'Call it to unbind: `client.onSignal` goes back to what it was before.', zh: '呼叫它就解除綁定：`client.onSignal` 回到綁定之前的樣子。' },
    description: [
      {
        en: 'Call it once on the show page, after making the runner\'s client: `bindSignals(show, signals)`. It sets `client.onSignal` so that each signal that arrives goes through [`fileSignal()`](#fileSignal), and a phone signal is filed twice, under its own name (`phone/ab12/tilt/x`) and under the alias (`phone/any/tilt/x`). Routes written at author time use the alias.',
        zh: '在演出頁面上，做好演出端的用戶端之後呼叫一次：`bindSignals(show, signals)`。它會設定 `client.onSignal`，讓每個收到的訊號都經過 [`fileSignal()`](#fileSignal)，手機訊號會歸兩份：自己的名稱（`phone/ab12/tilt/x`）和別名（`phone/any/tilt/x`）。寫作品時寫的路由用的是別名。',
      },
      {
        en: 'A callback that was already in `client.onSignal` keeps running after the filing, so you can still watch the raw messages.',
        zh: '`client.onSignal` 裡原本就有的回呼，會在歸檔之後繼續執行，所以你還是看得到原始訊息。',
      },
    ],
    examples: [
      {
        code: `import { bindSignals } from '@openav/relay';
import { Signals } from '@openav/core';

const signals = new Signals();
const client = {};                               // anything with an onSignal field; a RelayClient in real use
const unbind = bindSignals(client, signals);

// what the relay calls when a phone's message arrives
client.onSignal('phone/ab12/tilt/x', 0.4, {});
client.onSignal('phone/ab12/knock', { strength: 1 }, { pulse: true });
unbind();                                        // client.onSignal is back to what it was

document.getElementById('app').innerHTML = [
  'phone/any/tilt/x = ' + signals.get('phone/any/tilt/x'),
  'knock kind: ' + signals.meta.get('phone/any/knock').kind,
  'unbound: ' + (client.onSignal === undefined),
].join('<br>');`,
        caption: { en: 'Prints the tilt under the alias (0.4), the knock declared as a pulse, and "true" once `unbind()` has put `onSignal` back.', zh: '印出別名底下的傾斜值（0.4）、被宣告成脈衝的 knock，以及 `unbind()` 把 `onSignal` 放回去之後的「true」。' },
      },
      {
        code: `import { RelayClient, bindSignals } from '@openav/relay';
import { Signals } from '@openav/core';

const signals = new Signals();
const show = new RelayClient({ role: 'runner', room: 'main' });
const seen = [];
show.onSignal = (name) => seen.push(name);       // our own listener first
bindSignals(show, signals);                      // it still runs after the filing
show.onSignal('phone/ab12/tilt/y', 0.2, {});

document.getElementById('app').textContent = seen.join(', ') + ' | ' + signals.get('phone/any/tilt/y');`,
        caption: { en: 'A listener that was there before `bindSignals()` still hears every message: prints "phone/ab12/tilt/y | 0.2".', zh: '`bindSignals()` 之前就有的監聽函式，照樣聽得到每一則訊息：印出「phone/ab12/tilt/y | 0.2」。' },
      },
    ],
    related: ['RelayClient', 'fileSignal', 'aliasOf', 'signalMeta', 'mountRemoteHost'],
    keywords: {
      en: ['bind signals', 'connect relay to signals', 'phone/any', 'runner', 'show', 'receive phone', 'onSignal'],
      zh: ['綁定訊號', '接中繼', 'phone/any', '演出端', '接收手機', 'onSignal'],
    },
  },

  attachRelay: {
    group: 'remote',
    summary: {
      en: 'Attaches the room relay to a Node `http.Server`: WebSocket clients that connect to `path` are put in rooms and routed by role. Returns `{ hub, close() }`.',
      zh: '把房間中繼掛到 Node 的 `http.Server` 上：連到 `path` 的 WebSocket 用戶端會被放進房間，並依身分轉送訊息。回傳 `{ hub, close() }`。',
    },
    params: [
      { name: 'server', type: 'http.Server', en: 'A Node `http.Server` (or anything with the same `upgrade` event, such as an https server). The relay listens for its `upgrade` events.', zh: 'Node 的 `http.Server`（或任何有同樣 `upgrade` 事件的東西，例如 https 伺服器）。中繼會聽它的 `upgrade` 事件。' },
      { name: 'path', type: 'String', optional: true, en: 'The URL path clients connect to. Any other path is refused.', zh: '用戶端要連的網址路徑。其他路徑一律拒絕。' },
      { name: 'log', type: 'Function', optional: true, en: '`(line) => {}`, called with a line such as `+ controller ab12 @main` when a client joins and `- controller ab12 @main` when it leaves. The default says nothing.', zh: '`(line) => {}`，用戶端加入時以 `+ controller ab12 @main` 這樣的一行呼叫，離開時是 `- controller ab12 @main`。預設什麼都不說。' },
      { name: 'heartbeatMs', type: 'Number', optional: true, en: 'How often to ping every client, in milliseconds. A client that has not answered by the next ping is dropped, so a dead phone goes within one to two periods.', zh: '多久對每個用戶端 ping 一次，單位毫秒。到下一次 ping 還沒回應的用戶端會被移除，所以斷線的手機會在一到兩個週期內消失。' },
    ],
    returns: { type: '{ hub, close }', en: '`hub` is the `RoomHub` (`hub.rooms` is a `Map` of the rooms; `hub.counts(room)` gives `{ controllers, runners, monitors }`). `close()` drops every connected client; it does not close your server.', zh: '`hub` 是 `RoomHub`（`hub.rooms` 是房間的 `Map`，`hub.counts(room)` 回傳 `{ controllers, runners, monitors }`）。`close()` 把所有連線中的用戶端斷開，不會關掉你的伺服器。' },
    description: [
      {
        en: 'This is the server half, in Node, with no dependencies (the WebSocket codec is in the package). `node serve.js` already does it for you at `/relay`. To use it in your own server: `attachRelay(server)` before or after `server.listen()`. Clients connect to `ws://host/relay?role=controller|runner|monitor&room=<name>&id=<device>`: a bad role becomes `controller`, a bad room name becomes `default`, and the id is cut to 64 characters.',
        zh: '這是伺服器那一半，跑在 Node 裡，沒有任何相依套件（WebSocket 編解碼器就在套件裡）。`node serve.js` 已經在 `/relay` 替你做好了。要用在你自己的伺服器上：在 `server.listen()` 之前或之後呼叫 `attachRelay(server)` 都行。用戶端連到 `ws://host/relay?role=controller|runner|monitor&room=<name>&id=<device>`：身分不合格會變成 `controller`，房間名不合格會變成 `default`，id 會被截成 64 個字元。',
      },
      {
        en: 'Who may talk to whom: a controller\'s `signal` and `batch` go to the runner and the monitors; a runner\'s go to the monitors only; a runner\'s `feedback` and `config` go to the controllers and monitors; a monitor says nothing. A `config` is kept per key and replayed to controllers that join later, and the room forgets it when its runner leaves. Rooms never hear each other. A message over 256 KB is ignored and a frame over 1 MB closes the connection.',
        zh: '誰能對誰說話：控制端的 `signal` 和 `batch` 送給演出端和監看端。演出端的只送給監看端。演出端的 `feedback` 和 `config` 送給控制端和監看端。監看端什麼都不能說。`config` 依 key 留著，重播給之後才加入的控制端，演出端離開時房間就忘掉它。房間之間互相聽不到。超過 256 KB 的訊息會被忽略，超過 1 MB 的 frame 會讓連線關閉。',
      },
      {
        en: 'There is no authentication: anyone who can reach the server and knows a room name can join as a controller. Use a closed network, or a room name nobody will guess.',
        zh: '沒有任何身分驗證：任何連得到伺服器、又知道房間名稱的人，都能以控制端身分加入。請用封閉的網路，或一個沒人猜得到的房間名稱。',
      },
    ],
    needs: {
      en: 'A Node program, imported from `@openav/relay/server` (a different entry point from `@openav/relay`, which is the browser side). Standalone: `node packages/relay/server.js [port]` (default 7458; `/health` answers with the room names; `RELAY_HOST=127.0.0.1` binds to localhost behind a reverse proxy).',
      zh: '一支 Node 程式，從 `@openav/relay/server` 匯入（它跟 `@openav/relay` 是不同的進入點，後者是瀏覽器端）。單獨執行：`node packages/relay/server.js [port]`（預設 7458，`/health` 會回傳房間名稱，用 `RELAY_HOST=127.0.0.1` 可以綁在 localhost，後面接反向代理）。',
    },
    examples: [
      {
        code: `import http from 'node:http';
import { attachRelay } from '@openav/relay/server';

const server = http.createServer((req, res) => { res.writeHead(404); res.end(); });
const relay = attachRelay(server, { log: (line) => console.log('[relay]', line) });
server.listen(7458, () => console.log('relay at ws://localhost:7458/relay'));

// later: relay.hub.counts('main') → { controllers: 1, runners: 1, monitors: 0 }`,
        caption: { en: 'A relay on port 7458 in about five lines. Open a show page with `?relay=ws://localhost:7458/relay` and the terminal logs a line such as `[relay] + runner show-k3x9 @default` when it connects.', zh: '五行左右就有一個跑在 7458 埠的中繼。打開演出頁面時加上 `?relay=ws://localhost:7458/relay`，頁面連上去的時候，終端機會印出像 `[relay] + runner show-k3x9 @default` 這樣的一行。' },
        run: 'static',
        why: 'It is a Node program that opens a TCP port and needs a real WebSocket client. A web page cannot start a server.',
      },
    ],
    related: ['RelayClient', 'bindSignals', 'mountRemoteHost'],
    keywords: {
      en: ['relay server', 'websocket server', 'http server', 'rooms', 'node', 'attach', 'serve.js', 'heartbeat', 'hub'],
      zh: ['中繼伺服器', 'websocket 伺服器', 'http 伺服器', '房間', 'node', '掛上', 'serve.js', '心跳', 'hub'],
    },
  },
};
