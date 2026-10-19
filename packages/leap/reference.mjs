// @openav/leap reference: Leap Motion / Ultraleap hands as signals, the frame formats, gestures, mock hands and the local bridge.
// Read by tools/build-reference.mjs (see AGENTS.md, "Documenting a public name").
// Every example feeds made-up hands (mockFrame / mockHand) through the same path a real sensor takes, so they run with no hardware.

export default {
  LeapInput: {
    group: 'leap',
    summary: {
      en: 'Reads Leap Motion hands from the local bridge and publishes them as `leap/*` signals, plus the joints (`leap.hands`) for drawing the hand itself.',
      zh: '從本機的橋接程式讀取 Leap Motion 的手，發布成 `leap/*` 訊號，並在 `leap.hands` 提供關節資料，讓你把手本身畫出來。',
    },
    params: [
      {
        name: 'signals', type: 'Signals', optional: true, default: 'null',
        en: 'The [`Signals`](#Signals) registry to publish into. Without one the input still works (`hands`, `onFrame`) but publishes nothing.',
        zh: '要發布進去的 [`Signals`](#Signals) 登錄表。沒有的話，這個輸入仍然能用（`hands`、`onFrame`），只是不發布任何訊號。',
      },
      {
        name: 'url', type: 'String', optional: true, default: 'ws://127.0.0.1:6437/v6.json',
        en: 'The bridge address: the LeapJS protocol (the default, [`DEFAULT_URL`](#DEFAULT_URL)) or `…/raw` for the raw line format. Any service that still speaks the LeapJS v6 protocol works too.',
        zh: '橋接程式的位址：LeapJS 通訊協定（預設，[`DEFAULT_URL`](#DEFAULT_URL)），或 `…/raw` 的原始行格式。任何還在講 LeapJS v6 通訊協定的服務也行。',
      },
      {
        name: 'reconnect', type: 'Boolean', optional: true, default: 'true',
        en: 'Whether to try again after the connection drops, waiting 0.5 s, then 1 s, 2 s … up to 5 s between tries.',
        zh: '連線中斷之後要不要重試：每次等待 0.5 秒、1 秒、2 秒……最長 5 秒。',
      },
      {
        name: 'fingers', type: 'Boolean', optional: true, default: 'true',
        en: 'Publish the fingertip signals (3 per finger, 30 across two hands). `false` leaves them out and keeps the signal list short.',
        zh: '要不要發布指尖訊號（每根手指 3 個，兩隻手共 30 個）。`false` 會省略它們，訊號清單比較短。',
      },
      {
        name: 'box', type: 'Object', optional: true, default: 'INTERACTION_BOX',
        en: 'The interaction box `{ center, size }` in millimetres that positions are normalised against. The default is [`INTERACTION_BOX`](#INTERACTION_BOX).',
        zh: '位置據以正規化的互動範圍盒 `{ center, size }`，單位是公釐。預設是 [`INTERACTION_BOX`](#INTERACTION_BOX)。',
      },
      {
        name: 'thresholds', type: 'Object', optional: true, default: 'THRESHOLDS',
        en: 'Overrides for the gesture hysteresis, such as `{ pinch: { on: 0.9, off: 0.6 } }` (see [`THRESHOLDS`](#THRESHOLDS)). Keys you leave out keep their defaults.',
        zh: '手勢遲滯值的覆寫，例如 `{ pinch: { on: 0.9, off: 0.6 } }`（見 [`THRESHOLDS`](#THRESHOLDS)）。沒寫的鍵維持預設。',
      },
      {
        name: 'WebSocket', type: 'Function', optional: true, default: 'globalThis.WebSocket',
        en: 'The WebSocket constructor to use. Pass your own to test without a network.',
        zh: '要用的 WebSocket 建構函式。傳你自己的，就能在沒有網路的情況下測試。',
      },
    ],
    description: [
      {
        en: 'Browsers cannot talk to the Leap Motion sensor directly, so a small program on the same machine, the **bridge** ([`startBridge()`](#leap-startBridge), `ws://127.0.0.1:6437`), reads it and serves the hands over a WebSocket. `LeapInput` connects to that bridge and does one job: it turns hands into **normalised signals** and never touches params or worlds. In a show, `createShow({ modules: { leap: true } })` builds one and returns it as `show.leap`; the console\'s L1 panel shows which link is missing.',
        zh: '瀏覽器沒辦法直接跟 Leap Motion 感測器溝通，所以同一台機器上有個小程式，也就是**橋接程式**（[`startBridge()`](#leap-startBridge)，`ws://127.0.0.1:6437`），負責讀取它，再用 WebSocket 把手送出來。`LeapInput` 連到那個橋接程式，只做一件事：把手變成**正規化的訊號**，絕不碰參數或世界。在演出裡，`createShow({ modules: { leap: true } })` 會建好一個，用 `show.leap` 回傳。主控台的 L1 面板會告訴你哪一段連線不通。',
      },
      {
        en: 'It publishes, for each side (`left`, `right`): `leap/hand/<side>/present` (0 or 1), `x`, `y`, `z` (the palm in the interaction box, 0..1, y up, z toward the player), `pinch` and `grab` (0..1), `roll`, `pitch`, `yaw` (−π..π radians), `speed` (0..1, 1 = 1 m/s), and `<finger>/x|y|z` for the five fingertips. Shared: `leap/status` (0 no bridge, 1 bridge but no tracking service, 2 service but no device, 3 tracking), `leap/hands` (0..2) and `leap/both/distance` (palm to palm, 1 = 40 cm). The full list with its ranges is what [`leapSignals()`](#leapSignals) returns.',
        zh: '每一邊（`left`、`right`）它會發布：`leap/hand/<side>/present`（0 或 1）、`x`、`y`、`z`（掌心在互動範圍盒裡的位置，0..1，y 向上，z 朝向玩家）、`pinch` 和 `grab`（0..1）、`roll`、`pitch`、`yaw`（−π..π 弧度）、`speed`（0..1，1 = 每秒 1 公尺），還有五個指尖的 `<finger>/x|y|z`。共用的有：`leap/status`（0 沒有橋接、1 有橋接但追蹤服務沒開、2 服務在但沒有裝置、3 追蹤中）、`leap/hands`（0..2）和 `leap/both/distance`（兩掌之間的距離，1 = 40 公分）。完整的清單和範圍就是 [`leapSignals()`](#leapSignals) 的回傳值。',
      },
      {
        en: 'Gestures are pulses with a payload `{ side, x, y, z, strength }`: `leap/hand/<side>/pinch-start|pinch-end` and `grab-start|grab-end`, and `leap/both/pinch-start|pinch-end` (payload `{ x, y, z, distance }` at the midpoint). They use hysteresis, so a pinch hovering near the threshold fires once and not sixty times a second (see [`HandGestures`](#HandGestures)). A hand that leaves the view lets go: its `present`, `pinch`, `grab` and `speed` go to 0 and its gestures end.',
        zh: '手勢是帶有 `{ side, x, y, z, strength }` 的脈衝：`leap/hand/<side>/pinch-start|pinch-end` 和 `grab-start|grab-end`，以及 `leap/both/pinch-start|pinch-end`（內容是中點的 `{ x, y, z, distance }`）。它們有遲滯，所以在門檻附近徘徊的捏合只會觸發一次，不會一秒鐘觸發六十次（見 [`HandGestures`](#HandGestures)）。手離開畫面就會放開：它的 `present`、`pinch`、`grab` 和 `speed` 歸零，手勢也跟著結束。',
      },
      {
        en: 'For continuous control, map a signal to a param (`{ source: \'leap/hand/right/y\', target: \'energy\' }`) so the timeline, a knob and a hand are interchangeable. Use `leap.hands` (joints in millimetres) only to draw the hand itself.',
        zh: '連續控制請把訊號映射到參數（`{ source: \'leap/hand/right/y\', target: \'energy\' }`），這樣時間軸、旋鈕和手就可以互換。`leap.hands`（以公釐計的關節）只用來把手本身畫出來。',
      },
    ],
    needs: {
      en: 'For real hands: the bridge must be running (`node packages/leap/bridge/leap-bridge.mjs`, or `--mock` for animated made-up hands) and you must call `connect()`. Nothing is published until the first frame arrives. No sensor and no bridge: feed it hands with `ingest()`, or call `simulate()` to turn the mouse into hands.',
      zh: '要接真的手：橋接程式必須在跑（`node packages/leap/bridge/leap-bridge.mjs`，或加 `--mock` 得到會動的假手），而且你要呼叫 `connect()`。第一個影格到達之前不會發布任何東西。沒有感測器也沒有橋接程式：用 `ingest()` 餵手給它，或呼叫 `simulate()` 把滑鼠變成手。',
    },
    members: {
      connect: {
        en: 'Open the bridge connection; it keeps trying (with a growing delay) until `disconnect()`. Returns the input.',
        zh: '開啟跟橋接程式的連線，會一直重試（間隔愈來愈長），直到 `disconnect()`。回傳這個輸入本身。',
      },
      disconnect: {
        en: 'Close the connection and stop retrying. The status becomes `\'closed\'` and every hand is let go.',
        zh: '關閉連線並停止重試。狀態變成 `\'closed\'`，所有的手都放開。',
      },
      connected: {
        en: 'Whether the socket to the bridge is open right now.',
        zh: '跟橋接程式的 socket 現在是不是開著。',
      },
      hand: {
        en: '`hand(\'left\')` or `hand(\'right\')`: that side\'s hand object, or `null` when it is not in view.',
        zh: '`hand(\'left\')` 或 `hand(\'right\')`：該邊的手物件，不在畫面裡就是 `null`。',
      },
      normalize: {
        en: 'A point in millimetres to 0..1 inside this input\'s interaction box (clamped unless `clamp` is `false`).',
        zh: '把一個以公釐計的點換算成這個輸入的互動範圍盒裡的 0..1（除非 `clamp` 是 `false`，否則會被夾住）。',
      },
      onFrame: {
        en: 'Call `cb(message, hands)` for every frame with hands data. Returns a function that unsubscribes.',
        zh: '每收到一個有手資料的影格，就呼叫 `cb(message, hands)`。回傳一個取消訂閱的函式。',
      },
      onStatus: {
        en: 'Call `cb(status, leap)` whenever the status changes. Returns a function that unsubscribes.',
        zh: '狀態一改變就呼叫 `cb(status, leap)`。回傳一個取消訂閱的函式。',
      },
      ingest: {
        en: 'Feed one parsed message, exactly what the socket would deliver: a v6 header, a v6 frame, a device event, or a raw status or frame line. Public so that tests, recordings and the simulator take the very path real frames take.',
        zh: '餵進一則解析好的訊息，就是 socket 會送來的東西：v6 的標頭、v6 的影格、裝置事件，或原始的狀態或影格行。它是公開的，讓測試、錄影和模擬器走的路徑跟真實影格一模一樣。',
      },
      simulate: {
        en: 'No sensor? Mouse and touch become hands: move = right palm (x across, y up the screen), wheel = depth, press = pinch, right button or Alt+press = grab, hold Shift to drive the left hand, a second finger on a touch screen = left hand. `{ target = window, hz = 60 }`. Returns `stop()`. Throws when there is no target to listen on.',
        zh: '沒有感測器？滑鼠和觸控會變成手：移動 = 右手掌心（x 橫向、y 往螢幕上方）、滾輪 = 深度、按下 = 捏合、右鍵或 Alt+按下 = 握拳、按住 Shift 控制左手、觸控螢幕上第二根手指 = 左手。`{ target = window, hz = 60 }`。回傳 `stop()`。沒有可以監聽的目標時會丟出錯誤。',
      },
      simulating: {
        en: 'Whether the simulator is running.',
        zh: '模擬器是否正在執行。',
      },
      stopSimulation: {
        en: 'Stop the simulator. The bridge\'s hands come back if it is connected.',
        zh: '停止模擬器。如果橋接程式有連著，它的手就會回來。',
      },
      project: {
        en: 'A point in millimetres to canvas pixels: `project(p, w, h, { view, box })`. `view` is `\'oblique\'` (default: the performer\'s eye, up the canvas = higher and farther, so a flat hand shows its fingers), `\'front\'` (x across, y up) or `\'top\'` (z down the canvas). Returns `[x, y]`.',
        zh: '把以公釐計的點換算成畫布像素：`project(p, w, h, { view, box })`。`view` 是 `\'oblique\'`（預設：表演者的視角，畫布往上 = 更高且更遠，所以平放的手看得到手指）、`\'front\'`（x 橫向、y 向上）或 `\'top\'`（z 往畫布下方）。回傳 `[x, y]`。',
      },
      skeleton: {
        en: 'Draw the hands onto a 2D canvas context: `skeleton(ctx, w, h, { view, box, colorLeft, colorRight, lineWidth, hands })`. The palm and fingertips are dots and a pinch gets a ring. Points outside the box still draw.',
        zh: '把手畫到 2D 畫布的 context 上：`skeleton(ctx, w, h, { view, box, colorLeft, colorRight, lineWidth, hands })`。掌心和指尖是圓點，捏合時會多一個圈。在盒子外面的點照樣會畫。',
      },
      mountPanel: {
        en: 'Mount the status and skeleton panel into an element; the same as [`mountLeapPanel(el, leap, opts)`](#mountLeapPanel).',
        zh: '把狀態與骨架面板掛到一個元素裡，等同 [`mountLeapPanel(el, leap, opts)`](#mountLeapPanel)。',
      },
    },
    notes: [
      {
        en: 'Fields to read: `status` (`\'idle\'`, `\'connecting\'`, `\'bridge\'`, `\'no-service\'`, `\'no-device\'`, `\'tracking\'`, `\'simulated\'`, `\'closed\'`), `hands` (an array; each hand has `id`, `side`, `palm`, `fingers` (5 × 5 joints), `pinch`, `grab`, `velocity`, `normal`, `direction` … in millimetres), `frame` (the latest message as it came), `frames`, `fps`, `device`, `serviceVersion`, `gestures` and `box`.',
        zh: '可以讀的欄位：`status`（`\'idle\'`、`\'connecting\'`、`\'bridge\'`、`\'no-service\'`、`\'no-device\'`、`\'tracking\'`、`\'simulated\'`、`\'closed\'`）、`hands`（陣列，每隻手有 `id`、`side`、`palm`、`fingers`（5 × 5 個關節）、`pinch`、`grab`、`velocity`、`normal`、`direction` ……，單位是公釐）、`frame`（最近收到的原始訊息）、`frames`、`fps`、`device`、`serviceVersion`、`gestures` 和 `box`。',
      },
      {
        en: 'While the simulator runs it owns the hands: real frames from the bridge are ignored, and what the bridge says is remembered and restored when the simulator stops.',
        zh: '模擬器在跑的時候，手由它掌管：橋接程式來的真實影格會被忽略，橋接程式的狀態會被記住，等模擬器停止再恢復。',
      },
      {
        en: 'The signals are normalised (y = 1 is up). `leap.hands` and the LeapJS frames keep the sensor\'s own millimetre units, with +z toward the player.',
        zh: '訊號是正規化的（y = 1 代表向上）。`leap.hands` 和 LeapJS 的影格則保留感測器自己的公釐單位，+z 朝向玩家。',
      },
      {
        en: 'How the bridge talks, the formats and the troubleshooting table are in the [package README](https://github.com/frank890417/open-audiovisual/blob/main/packages/leap/README.md).',
        zh: '橋接程式怎麼溝通、各種格式和疑難排解表，都在[套件的 README](https://github.com/frank890417/open-audiovisual/blob/main/packages/leap/README.md)。',
      },
    ],
    tbd: [
      {
        en: 'Not tried with a real Leap Motion sensor here: the examples feed made-up hands (`mockFrame`) through the same `ingest()` path.',
        zh: '這裡沒有用真正的 Leap Motion 感測器試過：範例是把假手（`mockFrame`）餵進同一條 `ingest()` 路徑。',
      },
      {
        en: 'On a public https page, whether Chrome asks for permission before the page may reach `127.0.0.1` (the package README says it needs the "loopback-network" permission) was not tried here.',
        zh: '在公開的 https 頁面上，Chrome 是否會在頁面連到 `127.0.0.1` 之前詢問權限（套件 README 說需要「loopback-network」權限），這裡沒有實測。',
      },
    ],
    examples: [
      {
        code: `import { Signals } from '@openav/core';
import { LeapInput, mockFrame } from '@openav/leap';

const signals = new Signals();
const leap = new LeapInput({ signals });
leap.ingest(mockFrame(2.0));                       // a made-up frame: the same path real frames take
console.log(leap.status, leap.hands.length);       // tracking 2
console.log(signals.get('leap/hand/right/pinch')); // 1
leap.skeleton(document.getElementById('c').getContext('2d'), 400, 300);`,
        caption: { en: 'The console prints `tracking 2` and `1` (the mock right hand is pinching at second 2), and both hands are drawn on the canvas.', zh: '主控台印出 `tracking 2` 和 `1`（假的右手在第 2 秒正在捏合），兩隻手也畫在畫布上。' },
      },
      {
        code: `import { Signals } from '@openav/core';
import { LeapInput, mockFrame } from '@openav/leap';

const signals = new Signals();
const leap = new LeapInput({ signals });
signals.onAny((name, value, meta) => {
  if (meta.kind === 'pulse') console.log(name, value.strength.toFixed(2));
});
for (let i = 0; i <= 360; i++) leap.ingest(mockFrame(i / 60));   // six seconds of mock hands at 60 frames a second
console.log(signals.get('leap/hands'), signals.get('leap/status'));`,
        caption: { en: 'Six seconds of mock hands, with the pulses listed as they fire: the right hand pinches twice (`leap/hand/right/pinch-start 0.86`, then `pinch-end 0.50`, again) and the left fist closes once (`leap/hand/left/grab-start 0.80`). It ends with `2 3` (two hands, status 3 = tracking).', zh: '六秒鐘的假手，脈衝在觸發時一一列出：右手捏合兩次（`leap/hand/right/pinch-start 0.86`，然後 `pinch-end 0.50`，再來一次），左手握拳一次（`leap/hand/left/grab-start 0.80`）。最後印出 `2 3`（兩隻手，狀態 3 = 追蹤中）。' },
      },
      {
        code: `import { Signals } from '@openav/core';
import { LeapInput } from '@openav/leap';

const signals = new Signals();
const leap = new LeapInput({ signals });
const ctx = document.getElementById('c').getContext('2d');

leap.simulate({ target: window });                  // mouse and touch become hands
leap.onFrame(() => {
  ctx.clearRect(0, 0, 400, 300);
  leap.skeleton(ctx, 400, 300);
  document.getElementById('app').textContent = 'y ' + signals.get('leap/hand/right/y').toFixed(2) + '  pinch ' + signals.get('leap/hand/right/pinch').toFixed(2);
});`,
        caption: { en: 'Move the mouse over the page: a right hand follows it, and the text shows its height (`y`). Press the button to pinch, right-click to make a fist.', zh: '在頁面上移動滑鼠：右手會跟著動，文字顯示它的高度（`y`）。按下按鍵是捏合，按右鍵是握拳。' },
      },
      {
        code: `import { Signals } from '@openav/core';
import { LeapInput } from '@openav/leap';

const signals = new Signals();
const leap = new LeapInput({ signals }).connect();       // ws://127.0.0.1:6437/v6.json
leap.onStatus((status) => console.log('leap', status));  // connecting, bridge, tracking …
signals.on('leap/hand/right/pinch-start', ({ x, y }) => console.log('pinch at', x, y));`,
        caption: { en: 'With the bridge running and a hand over the sensor, the console follows the link (`leap connecting`, `leap bridge`, `leap tracking`) and prints a line for every pinch.', zh: '橋接程式開著、手放在感測器上方，主控台會跟著連線的進展（`leap connecting`、`leap bridge`、`leap tracking`），每次捏合印出一行。' },
        run: 'static',
        why: 'It needs the Leap bridge on 127.0.0.1:6437 and a sensor; the headless check has neither, and the failed socket would be a console error.',
      },
    ],
    related: ['leapSignals', 'mockFrame', 'HandGestures', 'mountLeapPanel', 'normalizePoint', 'handsOf', 'Signals', 'createShow'],
    keywords: {
      en: ['leap', 'leap motion', 'ultraleap', 'hand tracking', 'hands', 'pinch', 'grab', 'fist', 'palm', 'fingertip', 'bridge', 'gesture', 'simulate'],
      zh: ['leap', 'leap motion', '手部追蹤', '手', '捏合', '握拳', '掌心', '指尖', '橋接', '手勢', '模擬'],
    },
  },

  leapSignals: {
    group: 'leap',
    summary: {
      en: 'The list of every signal `LeapInput` publishes, with its range, as `[[name, meta], …]`, ready to hand to `signals.define()`.',
      zh: '`LeapInput` 發布的所有訊號清單，連同範圍，格式是 `[[name, meta], …]`，可以直接交給 `signals.define()`。',
    },
    params: [
      {
        name: 'fingers', type: 'Boolean', optional: true, default: 'true',
        en: 'Include the fingertip signals. `false` leaves out the 30 of them.',
        zh: '要不要包含指尖訊號。`false` 會少掉那 30 個。',
      },
    ],
    returns: {
      type: 'Array',
      en: 'The pairs `[name, meta]`: 63 with fingers, 33 without. Each `meta` has `source: \'leap\'`, and `min` and `max` (the roll, pitch and yaw ones in radians, −π..π) or `kind: \'pulse\'`.',
      zh: '`[name, meta]` 的成對清單：有指尖是 63 個，沒有是 33 個。每個 `meta` 都有 `source: \'leap\'`，以及 `min` 和 `max`（roll、pitch、yaw 是弧度，−π..π），脈衝則是 `kind: \'pulse\'`。',
    },
    description: [
      {
        en: '`new LeapInput({ signals })` already declares all of these, so you rarely call this yourself. It is useful when you want the list: to build a signal picker, to check that a route\'s source exists, or to declare the signals before the sensor is connected. The names it returns are the vocabulary of the [Signals reference](https://openaudiovisual.com/docs/#signals) for Leap.',
        zh: '`new LeapInput({ signals })` 已經把這些全部宣告好了，所以很少需要自己呼叫。想要這份清單的時候它就很有用：做訊號選單、檢查某條路由的來源存不存在、或在感測器還沒接上之前先宣告訊號。它回傳的名稱就是[訊號參考](https://openaudiovisual.com/zh/docs/#signals)裡 Leap 的那一批詞彙。',
      },
    ],
    examples: [
      {
        code: `import { Signals } from '@openav/core';
import { leapSignals } from '@openav/leap';

console.log(leapSignals().length, leapSignals({ fingers: false }).length);   // 63 33
const signals = new Signals();
for (const [name, meta] of leapSignals({ fingers: false })) signals.define(name, meta);
console.log(signals.meta.get('leap/hand/right/roll').min);                   // -3.14159…
console.log(signals.meta.get('leap/hand/left/pinch-start').kind);            // pulse`,
        caption: { en: 'The console prints `63 33`, then the roll range\'s lower end (−π) and `pulse`.', zh: '主控台印出 `63 33`，然後是 roll 範圍的下限（−π）和 `pulse`。' },
      },
    ],
    related: ['LeapInput', 'Signals', 'mockFrame'],
    keywords: {
      en: ['leap signals', 'signal list', 'leap/hand', 'define signals', 'declarations'],
      zh: ['leap 訊號', '訊號清單', '宣告訊號', '訊號名稱'],
    },
  },

  mountLeapPanel: {
    group: 'leap',
    summary: {
      en: 'Mounts a small panel that shows whether the Leap is alive (bridge, service, device, hands) and draws what it sees, with a button to simulate hands.',
      zh: '掛上一個小面板，顯示 Leap 有沒有活著（橋接、服務、裝置、手）並畫出它看到的東西，還有一個模擬手的按鈕。',
    },
    params: [
      {
        name: 'el', type: 'HTMLElement',
        en: 'Where to put the panel.',
        zh: '面板要放在哪個元素裡。',
      },
      {
        name: 'leap', type: 'LeapInput',
        en: 'The [`LeapInput`](#LeapInput) to show.',
        zh: '要顯示的 [`LeapInput`](#LeapInput)。',
      },
      {
        name: 'width', type: 'Number', optional: true, default: '300',
        en: 'The width of the drawing in CSS pixels; the height follows (about 0.62 of the width).',
        zh: '繪圖區的寬度（CSS 像素），高度跟著決定（約為寬度的 0.62 倍）。',
      },
      {
        name: 'simulate', type: 'Boolean', optional: true, default: 'true',
        en: 'Show the "simulate" button (mouse and touch become hands).',
        zh: '要不要顯示「simulate」按鈕（滑鼠和觸控變成手）。',
      },
      {
        name: 'simTarget', type: 'HTMLElement | Window', optional: true,
        en: 'What the simulator listens on. Defaults to `leap.simTarget`, then the window.',
        zh: '模擬器監聽哪個目標。預設是 `leap.simTarget`，再不然是 window。',
      },
    ],
    returns: {
      type: 'Object',
      en: '`{ el, render(), destroy() }`: the panel\'s root element, a function that redraws it, and one that removes it and unsubscribes.',
      zh: '`{ el, render(), destroy() }`：面板的根元素、重畫它的函式，以及移除它並取消訂閱的函式。',
    },
    description: [
      {
        en: 'One status line says which link is the broken one, in order: no bridge, bridge but no tracking service, service but no device, tracking (with the number of hands and the frame rate). Under it, a small front view draws the interaction box (a hand outside it is visibly outside, its signals sitting clamped at the edge) and the hand skeletons. It redraws only on frames and status changes, so nothing runs while the sensor is idle.',
        zh: '一行狀態列會告訴你是哪一段連線壞了，依序是：沒有橋接、有橋接但追蹤服務沒開、有服務但沒有裝置、追蹤中（附上手的數量和影格率）。下面是個小小的正視圖，畫出互動範圍盒（手在盒子外面一眼就看得出來，它的訊號會被夾在邊緣）和手的骨架。它只在有影格或狀態改變時重畫，感測器閒置時什麼都不會跑。',
      },
      {
        en: 'In a show you do not call it: the console\'s **L1 · Input** panel mounts it when you declare `modules: { leap: true }`.',
        zh: '在演出裡不用自己呼叫：宣告 `modules: { leap: true }` 之後，主控台的 **L1 · Input** 面板會掛上它。',
      },
    ],
    examples: [
      {
        code: `import { LeapInput, mockFrame, mountLeapPanel } from '@openav/leap';

const leap = new LeapInput();
const panel = mountLeapPanel(document.getElementById('app'), leap, { width: 360 });
leap.ingest(mockFrame(2.0));          // a made-up frame stands in for the sensor
panel.render();`,
        caption: { en: 'A panel appears in the page: a green dot, the status line `tracking · 2 hands · 60 fps · R:pinch` (the right hand is pinching), a "simulate" button, and the two mock hands drawn in a small box.', zh: '頁面上出現一個面板：綠色圓點、狀態列 `tracking · 2 hands · 60 fps · R:pinch`（右手正在捏合）、一個「simulate」按鈕，以及畫在小方框裡的兩隻假手。' },
      },
    ],
    related: ['LeapInput', 'createShow', 'mountConsole'],
    keywords: {
      en: ['leap panel', 'status panel', 'skeleton', 'hands view', 'simulate button', 'leap status'],
      zh: ['leap 面板', '狀態面板', '骨架', '手的畫面', '模擬按鈕', 'leap 狀態'],
    },
  },

  HandGestures: {
    group: 'leap',
    summary: {
      en: 'Turns pinch and grab strengths into clean start and end events, per hand plus a both-hands pinch, using hysteresis so a wobbling value fires once.',
      zh: '把捏合和握拳的力度變成乾淨的開始與結束事件，每隻手各一組，另外還有雙手捏合，用遲滯處理，所以抖動的值只會觸發一次。',
    },
    params: [
      {
        name: 'thresholds', type: 'Object', optional: true, default: 'THRESHOLDS',
        en: 'Overrides for the defaults in [`THRESHOLDS`](#THRESHOLDS): `{ pinch: { on, off }, bothPinch: { on, off }, grab: { on, off } }`. Keys you leave out keep their defaults.',
        zh: '覆寫 [`THRESHOLDS`](#THRESHOLDS) 的預設值：`{ pinch: { on, off }, bothPinch: { on, off }, grab: { on, off } }`。沒寫的鍵維持預設。',
      },
    ],
    description: [
      {
        en: 'A pinch strength hovers around any single threshold while the fingers are "almost touching", and one threshold then fires start, end, start, end sixty times a second. So every gesture is a trigger with two thresholds: it **starts** above `on` and only **ends** below `off`. The defaults are a pinch starting above 0.86 and ending below 0.5, a both-hands pinch entering when both hands are above 0.8 and leaving when either drops below 0.5, and a grab (fist) above 0.8 and below 0.5. A hand that disappears ends all of its gestures.',
        zh: '手指「快要碰到」的時候，捏合力度會在任何單一門檻附近晃來晃去，只有一個門檻的話，就會每秒六十次地開始、結束、開始、結束。所以每個手勢都有兩個門檻：高過 `on` 才**開始**，低於 `off` 才**結束**。預設值是：捏合高於 0.86 開始、低於 0.5 結束。雙手捏合在兩隻手都高於 0.8 時進入，任何一隻低於 0.5 就離開。握拳高於 0.8 開始、低於 0.5 結束。手消失的時候，它所有的手勢都會結束。',
      },
      {
        en: '`LeapInput` already runs one (`leap.gestures`) and turns its events into the `leap/…/pinch-start` pulses. Use `HandGestures` on its own when you have hands from somewhere else.',
        zh: '`LeapInput` 已經內建一個（`leap.gestures`），並把它的事件變成 `leap/…/pinch-start` 這些脈衝。你的手資料如果是從別的地方來，才需要單獨使用 `HandGestures`。',
      },
    ],
    members: {
      update: {
        en: '`update(hands)` takes `[{ side: \'left\' | \'right\', pinch, grab, … }]` and returns the events that just happened, in a stable order: `{ type: \'pinch-start\' | \'pinch-end\' | \'grab-start\' | \'grab-end\', side, hand }`, then `{ type: \'both-pinch-start\' | \'both-pinch-end\', side: \'both\', hands }`. Call it once per frame.',
        zh: '`update(hands)` 接收 `[{ side: \'left\' | \'right\', pinch, grab, … }]`，回傳剛剛發生的事件，順序固定：`{ type: \'pinch-start\' | \'pinch-end\' | \'grab-start\' | \'grab-end\', side, hand }`，接著是 `{ type: \'both-pinch-start\' | \'both-pinch-end\', side: \'both\', hands }`。每個畫面呼叫一次。',
      },
      state: {
        en: 'What is held right now: `{ left: { pinch, grab }, right: { pinch, grab }, both }`, all booleans.',
        zh: '現在被按住的是什麼：`{ left: { pinch, grab }, right: { pinch, grab }, both }`，全都是布林值。',
      },
    },
    examples: [
      {
        code: `import { HandGestures } from '@openav/leap';

const gestures = new HandGestures();
const frame = (pinch) => gestures.update([{ side: 'right', pinch, grab: 0 }]).map((e) => e.type);
console.log(frame(0.85));   // []               below 0.86: not yet
console.log(frame(0.9));    // [ 'pinch-start' ]
console.log(frame(0.6));    // []               still held: only below 0.5 ends it
console.log(frame(0.4));    // [ 'pinch-end' ]`,
        caption: { en: 'The console prints `[]`, `[ \'pinch-start\' ]`, `[]`, `[ \'pinch-end\' ]`: the pinch starts above 0.86 and holds until it drops under 0.5.', zh: '主控台印出 `[]`、`[ \'pinch-start\' ]`、`[]`、`[ \'pinch-end\' ]`：捏合高於 0.86 才開始，一直撐到低於 0.5。' },
      },
      {
        code: `import { HandGestures } from '@openav/leap';

const gestures = new HandGestures({ pinch: { on: 0.7, off: 0.3 } });   // easier to start, harder to let go
const hand = (side, pinch) => ({ side, pinch, grab: 0 });
const names = (events) => events.map((e) => e.type + ':' + e.side);
console.log(names(gestures.update([hand('right', 0.75), hand('left', 0.82)])));   // single pinches only: both need 0.8
console.log(names(gestures.update([hand('right', 0.9), hand('left', 0.9)])));     // now both hands pinch
console.log(names(gestures.update([])));                                          // both hands leave: everything ends`,
        caption: { en: 'The console prints `[ \'pinch-start:left\', \'pinch-start:right\' ]`, then `[ \'both-pinch-start:both\' ]`, then the three ends when the hands leave.', zh: '主控台先印出 `[ \'pinch-start:left\', \'pinch-start:right\' ]`，接著是 `[ \'both-pinch-start:both\' ]`，兩隻手離開時則印出三個結束事件。' },
      },
    ],
    related: ['Hysteresis', 'THRESHOLDS', 'LeapInput', 'mockFrame'],
    keywords: {
      en: ['gesture', 'gestures', 'pinch', 'grab', 'fist', 'hysteresis', 'schmitt trigger', 'start end', 'both hands'],
      zh: ['手勢', '捏合', '握拳', '遲滯', '施密特觸發', '開始結束', '雙手'],
    },
  },

  Hysteresis: {
    group: 'leap',
    summary: {
      en: 'One Schmitt trigger: `update(v)` says `\'start\'` when the value rises above `on`, and `\'end\'` only when it falls below `off`.',
      zh: '一個施密特觸發器：數值升到 `on` 以上，`update(v)` 回報 `\'start\'`，要降到 `off` 以下才會回報 `\'end\'`。',
    },
    params: [
      {
        name: 'on', type: 'Number',
        en: 'The level the value must rise **above** to start.',
        zh: '數值要**高過**它才會開始。',
      },
      {
        name: 'off', type: 'Number',
        en: 'The level the value must fall **below** to end. It must be lower than `on`, or the constructor throws "Hysteresis: off must be below on".',
        zh: '數值要**低於**它才會結束。必須比 `on` 低，否則建構函式會丟出 "Hysteresis: off must be below on"。',
      },
    ],
    description: [
      {
        en: 'The gap between `on` and `off` is what stops a value that hovers near one threshold from flickering. Each call to `update()` returns `\'start\'` (it just became active), `\'end\'` (it just stopped) or `null` (nothing changed). A missing or `NaN` value while active counts as an end, so a lost sensor lets go. `active` tells you whether it is on now.',
        zh: '`on` 和 `off` 之間的空隙，就是讓在某個門檻附近徘徊的數值不會閃爍的原因。每次呼叫 `update()` 會回傳 `\'start\'`（剛變成啟動）、`\'end\'`（剛停止）或 `null`（沒有變化）。啟動中遇到缺值或 `NaN` 會當作結束，所以感測器掉了就會放開。`active` 告訴你它現在是不是開著。',
      },
    ],
    members: {
      update: {
        en: '`update(v)` returns `\'start\'`, `\'end\'` or `null`.',
        zh: '`update(v)` 回傳 `\'start\'`、`\'end\'` 或 `null`。',
      },
      release: {
        en: 'Force the end, for example when the hand is lost. Returns `\'end\'` only if it was active, otherwise `null`.',
        zh: '強制結束，例如手不見的時候。只有它原本是啟動的才回傳 `\'end\'`，否則是 `null`。',
      },
    },
    examples: [
      {
        code: `import { Hysteresis } from '@openav/leap';

const trigger = new Hysteresis(0.8, 0.4);
const values = [0.5, 0.9, 0.6, 0.3, 0.5];
console.log(values.map((v) => trigger.update(v)));   // [ null, 'start', null, 'end', null ]`,
        caption: { en: 'The console prints `[ null, \'start\', null, \'end\', null ]`: 0.6 is below 0.8 but above 0.4, so it is still held.', zh: '主控台印出 `[ null, \'start\', null, \'end\', null ]`：0.6 低於 0.8，但高於 0.4，所以還是按住的狀態。' },
      },
    ],
    related: ['HandGestures', 'THRESHOLDS'],
    keywords: {
      en: ['hysteresis', 'schmitt trigger', 'threshold', 'debounce', 'flicker', 'start end'],
      zh: ['遲滯', '施密特觸發', '門檻', '防抖動', '閃爍'],
    },
  },

  THRESHOLDS: {
    group: 'leap',
    summary: {
      en: 'The default hysteresis levels for the gestures: pinch 0.86 / 0.5, both-hands pinch 0.8 / 0.5, grab 0.8 / 0.5 (start above `on`, end below `off`).',
      zh: '手勢預設的遲滯門檻：捏合 0.86 / 0.5、雙手捏合 0.8 / 0.5、握拳 0.8 / 0.5（高於 `on` 開始，低於 `off` 結束）。',
    },
    description: [
      {
        en: 'A frozen object `{ pinch: { on, off }, bothPinch: { on, off }, grab: { on, off } }`. The numbers come from The Last Input, tuned on a Leap Motion Controller 2, so one bridge means one feel. Change them per input with `new LeapInput({ thresholds: { pinch: { on: 0.9, off: 0.6 } } })` or `new HandGestures(...)`; you cannot change this object itself.',
        zh: '一個凍結的物件 `{ pinch: { on, off }, bothPinch: { on, off }, grab: { on, off } }`。數字來自 The Last Input，在 Leap Motion Controller 2 上調過，這樣一個橋接程式就是一種手感。要改的話，在每個輸入上設定：`new LeapInput({ thresholds: { pinch: { on: 0.9, off: 0.6 } } })` 或 `new HandGestures(...)`，這個物件本身改不了。',
      },
    ],
    related: ['HandGestures', 'Hysteresis', 'LeapInput'],
    keywords: {
      en: ['thresholds', 'pinch threshold', 'grab threshold', 'hysteresis levels', '0.86', 'defaults'],
      zh: ['門檻', '捏合門檻', '握拳門檻', '遲滯值', '預設值'],
    },
  },

  mockFrame: {
    group: 'leap',
    summary: {
      en: 'One frame of made-up, animated hands at time `t`: a right hand circling and pinching every 3 seconds, a left hand rising, falling and slowly making a fist.',
      zh: '時間 `t` 的一個影格的假手，會動：右手繞圈、每 3 秒捏合一次，左手升降，並且慢慢握拳。',
    },
    params: [
      {
        name: 't', type: 'Number',
        en: 'Time in seconds. The result depends only on `t`, so it is the same every time.',
        zh: '時間，單位是秒。結果只跟 `t` 有關，所以每次都一樣。',
      },
      {
        name: 'id', type: 'Number', optional: true, default: 'Math.round(t * 60)',
        en: 'The frame number written into the frame.',
        zh: '寫進影格裡的影格編號。',
      },
      {
        name: 'hands', type: 'Number', optional: true, default: '2',
        en: 'How many hands: 2 (right and left), 1 (the right only) or 0.',
        zh: '手的數量：2（右手和左手）、1（只有右手）或 0。',
      },
    ],
    returns: {
      type: 'Object',
      en: 'A frame in the raw line format: `{ t: \'f\', id, fps: 60, hands: [hand, …] }`, the right hand (`side: \'R\'`) first. Feed it to [`LeapInput.ingest()`](#LeapInput) or [`handsOf()`](#handsOf).',
      zh: '原始行格式的影格：`{ t: \'f\', id, fps: 60, hands: [hand, …] }`，右手（`side: \'R\'`）在前面。可以餵給 [`LeapInput.ingest()`](#LeapInput) 或 [`handsOf()`](#handsOf)。',
    },
    description: [
      {
        en: 'This is the bridge\'s `--mock` stream and the way to try Leap code without a sensor. The right hand pinches for about a second out of every 3, the left hand pinches once every 12 seconds, and at those moments (for example second 8) both are pinched, so the both-hands pinch fires too. The left fist comes and goes slowly. The output goes through exactly the same conversion and publishing as a real Leap Motion Controller.',
        zh: '這就是橋接程式 `--mock` 模式送出的串流，也是沒有感測器時試 Leap 程式的辦法。右手每 3 秒有大約 1 秒在捏合，左手每 12 秒捏合一次，兩者重疊的時刻（例如第 8 秒），兩隻手同時捏合，所以雙手捏合也會觸發。左手的拳頭則慢慢地出現又消失。輸出走的轉換與發布路徑，跟真正的 Leap Motion Controller 完全一樣。',
      },
    ],
    examples: [
      {
        code: `import { mockFrame } from '@openav/leap';

for (const t of [0.5, 2.0, 8.0]) {
  const frame = mockFrame(t);
  console.log(t, frame.hands.map((h) => h.side + ' pinch ' + h.pinch).join(' · '));
}`,
        caption: { en: 'The console prints `0.5 R pinch 0 · L pinch 0`, `2 R pinch 1 · L pinch 0` and `8 R pinch 1 · L pinch 1` (the both-hands pinch).', zh: '主控台印出 `0.5 R pinch 0 · L pinch 0`、`2 R pinch 1 · L pinch 0` 和 `8 R pinch 1 · L pinch 1`（雙手捏合）。' },
      },
    ],
    related: ['mockHand', 'LeapInput', 'handsOf'],
    keywords: {
      en: ['mock', 'fake hands', 'test frame', 'demo hands', 'no sensor', 'leap simulation', 'mock frame'],
      zh: ['假手', '模擬', '測試影格', '沒有感測器', '示範用的手', 'mock'],
    },
  },

  mockHand: {
    group: 'leap',
    summary: {
      en: 'Builds one made-up hand, with all five fingers and the arm, from a palm position plus pinch, grab, roll, yaw and pitch.',
      zh: '用掌心位置加上捏合、握拳、roll、yaw、pitch，做出一隻假手，五根手指和手臂都有。',
    },
    params: [
      { name: 'id', type: 'Number', optional: true, default: '1', en: 'The hand\'s id.', zh: '這隻手的 id。' },
      { name: 'side', type: '\'L\' | \'R\'', optional: true, default: '\'R\'', en: '`\'R\'` for a right hand, `\'L\'` for a left.', zh: '右手用 `\'R\'`，左手用 `\'L\'`。' },
      { name: 'palm', type: 'Array<Number>', optional: true, default: '[0, 200, 0]', en: 'The palm position `[x, y, z]` in millimetres (+x right, +y up, +z toward the player).', zh: '掌心位置 `[x, y, z]`，單位是公釐（+x 向右、+y 向上、+z 朝向玩家）。' },
      { name: 'pinch', type: 'Number', optional: true, default: '0', en: 'Thumb to index, 0..1. At 1 the two fingertips meet.', zh: '拇指到食指，0..1。到 1 的時候兩個指尖碰在一起。' },
      { name: 'grab', type: 'Number', optional: true, default: '0', en: 'How closed the fist is, 0..1.', zh: '拳頭握得多緊，0..1。' },
      { name: 'roll', type: 'Number', optional: true, default: '0', en: 'Radians; positive rolls toward the thumb side.', zh: '弧度，正值是往拇指那一側翻。' },
      { name: 'yaw', type: 'Number', optional: true, default: '0', en: 'Radians; positive turns the fingers toward +x.', zh: '弧度，正值是讓手指轉向 +x。' },
      { name: 'pitch', type: 'Number', optional: true, default: '0', en: 'Radians; positive tips the fingers up.', zh: '弧度，正值是讓手指往上翹。' },
      { name: 'vel', type: 'Array<Number>', optional: true, default: '[0, 0, 0]', en: 'Palm velocity in millimetres per second.', zh: '掌心速度，單位是公釐每秒。' },
      { name: 'conf', type: 'Number', optional: true, default: '1', en: 'Tracking confidence, 0..1.', zh: '追蹤的信心程度，0..1。' },
      { name: 'width', type: 'Number', optional: true, default: '85', en: 'Palm width in millimetres.', zh: '手掌寬度，單位是公釐。' },
    ],
    returns: {
      type: 'Object',
      en: 'A hand in the raw line format: `{ id, side, conf, pinch, grab, palm, vel, n, dir, w, f, ext, arm }`, where `f` is 5 fingers × 5 joints (thumb to pinky; the last joint of each is the tip). Wrap hands in `{ t: \'f\', id, fps, hands: [...] }` to make a frame.',
      zh: '原始行格式的手：`{ id, side, conf, pinch, grab, palm, vel, n, dir, w, f, ext, arm }`，其中 `f` 是 5 根手指 × 5 個關節（從拇指到小指，每根的最後一個關節是指尖）。把手包進 `{ t: \'f\', id, fps, hands: [...] }` 就成了一個影格。',
    },
    description: [
      {
        en: 'It places a plausible hand in space: palm, knuckles, fingers curled by `grab`, thumb and index meeting as `pinch` goes to 1, wrist and elbow. [`LeapInput.simulate()`](#LeapInput) builds its hands from the mouse with it, and [`mockFrame()`](#mockFrame) with the animated ones. Use it to put a hand exactly where a test needs it.',
        zh: '它在空間裡放一隻合理的手：掌心、指節、隨 `grab` 彎起來的手指、`pinch` 到 1 時碰在一起的拇指和食指、手腕和手肘。[`LeapInput.simulate()`](#LeapInput) 用它把滑鼠變成手，[`mockFrame()`](#mockFrame) 用它做出會動的手。需要把手剛好放在某個位置來測試時，就用它。',
      },
    ],
    examples: [
      {
        code: `import { mockHand } from '@openav/leap';

const open = mockHand({ palm: [0, 200, 0] });
const pinched = mockHand({ palm: [0, 200, 0], pinch: 1 });
const gap = (hand) => Math.hypot(...hand.f[0][4].map((v, i) => v - hand.f[1][4][i])).toFixed(0);
console.log('thumb to index tip, open:', gap(open), 'mm  pinched:', gap(pinched), 'mm');`,
        caption: { en: 'The console measures the distance between the thumb tip and the index tip: `100 mm` for the open hand and `0 mm` when pinched.', zh: '主控台量出拇指指尖和食指指尖的距離：手張開時是 `100 mm`，捏合時是 `0 mm`。' },
      },
    ],
    related: ['mockFrame', 'LeapInput', 'handsOf', 'handBones'],
    keywords: {
      en: ['mock hand', 'fake hand', 'hand model', 'test hand', 'pinch', 'grab', 'palm position'],
      zh: ['假手', '手的模型', '測試用的手', '捏合', '握拳', '掌心位置'],
    },
  },

  handsOf: {
    group: 'leap',
    summary: {
      en: 'Reads either wire format (raw line or LeapJS v6 frame) into the one hand shape the rest of the package uses; anything else gives `[]`.',
      zh: '把兩種傳輸格式（原始行或 LeapJS v6 影格）都讀成套件其他部分共用的同一種手的形狀，其他任何東西都回傳 `[]`。',
    },
    params: [
      {
        name: 'msg', type: 'Object',
        en: 'A parsed message: a raw frame (`t: \'f\'`) or a v6 frame (with `hands` and `pointables`).',
        zh: '一則解析好的訊息：原始影格（`t: \'f\'`）或 v6 影格（有 `hands` 和 `pointables`）。',
      },
    ],
    returns: {
      type: 'Array',
      en: 'The hands, each `{ id, side: \'left\' | \'right\', confidence, pinch, grab, palm, velocity, normal, direction, width, fingers, extended, elbow, wrist, timeVisible }`. Positions are in millimetres; `fingers` is 5 arrays of joints (the last is the tip), `extended` 5 booleans.',
      zh: '手的陣列，每隻是 `{ id, side: \'left\' | \'right\', confidence, pinch, grab, palm, velocity, normal, direction, width, fingers, extended, elbow, wrist, timeVisible }`。位置單位是公釐。`fingers` 是 5 個關節陣列（最後一個是指尖），`extended` 是 5 個布林值。',
    },
    description: [
      {
        en: 'This is the hand shape worlds draw from (`leap.hands`). A raw frame carries the fingers inline; a v6 frame carries them as `pointables` joined to their hand by `handId`, and `handsOf()` does that join. Both give the same hand, so code written against `leap.hands` does not care which URL the bridge was reached on.',
        zh: '這就是世界用來畫手的形狀（`leap.hands`）。原始影格把手指放在手的裡面。v6 影格把手指放成 `pointables`，用 `handId` 接到它們的手，`handsOf()` 負責做這個合併。兩者給出同一隻手，所以針對 `leap.hands` 寫的程式不在乎橋接程式是從哪個網址連的。',
      },
    ],
    examples: [
      {
        code: `import { mockFrame, rawToV6, handsOf } from '@openav/leap';

const raw = mockFrame(2.0);
const fromRaw = handsOf(raw)[0];
const fromV6 = handsOf(rawToV6(raw))[0];                 // the same frame as LeapJS would send it
console.log(fromRaw.side, fromRaw.palm, fromRaw.pinch);   // right [43.6, 233.2, 53.6] 1
console.log(fromV6.side, fromV6.palm, fromV6.pinch);      // the same hand
console.log(handsOf(null), handsOf({}));                  // [] []`,
        caption: { en: 'Both formats give the same hand: the console prints `right [ 43.6, 233.2, 53.6 ] 1` twice, then `[] []`.', zh: '兩種格式給出同一隻手：主控台兩次印出 `right [ 43.6, 233.2, 53.6 ] 1`，然後是 `[] []`。' },
      },
    ],
    related: ['handBones', 'rawToV6', 'mockFrame', 'LeapInput'],
    keywords: {
      en: ['hands of', 'parse hands', 'hand shape', 'fingers', 'joints', 'v6 frame', 'raw frame', 'convert'],
      zh: ['解析手', '手的形狀', '手指', '關節', 'v6 影格', '原始影格'],
    },
  },

  handBones: {
    group: 'leap',
    summary: {
      en: 'The bones to draw for a hand, as pairs of points: each finger\'s joints in turn, the line across the knuckles, and the forearm.',
      zh: '一隻手要畫的骨頭，用成對的點表示：每根手指的關節依序相連、橫過指節的那條線，以及前臂。',
    },
    params: [
      {
        name: 'hand', type: 'Object',
        en: 'A hand from [`handsOf()`](#handsOf) or `leap.hands`.',
        zh: '來自 [`handsOf()`](#handsOf) 或 `leap.hands` 的一隻手。',
      },
    ],
    returns: {
      type: 'Array',
      en: 'An array of `[pointA, pointB]` pairs, each point `[x, y, z]` in millimetres. A hand with five 5-joint fingers, a wrist and an elbow gives 25.',
      zh: '`[pointA, pointB]` 成對的陣列，每個點是 `[x, y, z]`，單位是公釐。一隻有五根各 5 個關節的手指、手腕和手肘的手，會得到 25 條。',
    },
    description: [
      {
        en: 'It only lists the pairs; you choose how to draw them. [`LeapInput.skeleton()`](#LeapInput) calls it for you. Use it directly when you draw with p5, three.js or your own projection.',
        zh: '它只列出成對的點，怎麼畫由你決定。[`LeapInput.skeleton()`](#LeapInput) 會替你呼叫它。用 p5、three.js 或自己的投影來畫的時候，就直接用它。',
      },
    ],
    examples: [
      {
        code: `import { INTERACTION_BOX, handBones, handsOf, mockFrame, normalizePoint } from '@openav/leap';

const ctx = document.getElementById('c').getContext('2d');
ctx.fillStyle = '#111'; ctx.fillRect(0, 0, 400, 300);
ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 2;
const at = (p) => { const n = normalizePoint(p, INTERACTION_BOX, false); return [n[0] * 400, (1 - n[1]) * 300]; };   // front view
for (const hand of handsOf(mockFrame(2.0))) {
  for (const [a, b] of handBones(hand)) {
    ctx.beginPath(); ctx.moveTo(...at(a)); ctx.lineTo(...at(b)); ctx.stroke();
  }
}`,
        caption: { en: 'Both mock hands are drawn on the canvas in a front view, bone by bone.', zh: '兩隻假手用正視圖畫在畫布上，一根骨頭一根骨頭地畫。' },
      },
    ],
    related: ['handsOf', 'LeapInput', 'normalizePoint'],
    keywords: {
      en: ['bones', 'skeleton', 'draw hand', 'joints', 'hand lines'],
      zh: ['骨頭', '骨架', '畫手', '關節', '手的線條'],
    },
  },

  normalizePoint: {
    group: 'leap',
    summary: {
      en: 'Maps a point in millimetres to 0..1 inside the interaction box, clamped by default: the same normalisation the `leap/*` signals use.',
      zh: '把一個以公釐計的點，換算成互動範圍盒裡的 0..1，預設會夾住：`leap/*` 訊號用的就是這個正規化。',
    },
    params: [
      { name: 'p', type: 'Array<Number>', en: 'The point `[x, y, z]` in millimetres.', zh: '點 `[x, y, z]`，單位是公釐。' },
      { name: 'box', type: 'Object', optional: true, default: 'INTERACTION_BOX', en: 'The box `{ center, size }` in millimetres.', zh: '範圍盒 `{ center, size }`，單位是公釐。' },
      { name: 'clamp', type: 'Boolean', optional: true, default: 'true', en: 'Hold each value to 0..1. `false` lets a point outside the box go beyond.', zh: '把每個值限制在 0..1。`false` 的話，盒子外面的點可以超出範圍。' },
    ],
    returns: {
      type: 'Array<Number>',
      en: '`[x, y, z]`, each `(p − center) / size + 0.5`: 0.5 is the centre of the box, x grows to the right, y upward, z toward the player.',
      zh: '`[x, y, z]`，每個都是 `(p − center) / size + 0.5`：0.5 是盒子的中心，x 往右增加、y 往上增加、z 朝向玩家。',
    },
    description: [
      {
        en: 'The classic box is centred 200 mm above the sensor and about 235 × 235 × 148 mm ([`INTERACTION_BOX`](#INTERACTION_BOX)). A palm at the centre reads `[0.5, 0.5, 0.5]`; a palm far outside it reads 0 or 1 on that axis, which is why the signals "sit clamped at the edge" when a hand leaves the box. Pass `clamp = false` when you want to know how far outside it is.',
        zh: '經典的盒子中心在感測器上方 200 公釐，大小約 235 × 235 × 148 公釐（[`INTERACTION_BOX`](#INTERACTION_BOX)）。掌心在中心讀到 `[0.5, 0.5, 0.5]`，掌心遠在盒子外面，那個軸就讀到 0 或 1，這就是手離開盒子時訊號會「夾在邊緣」的原因。想知道超出多遠，就傳 `clamp = false`。',
      },
    ],
    examples: [
      {
        code: `import { normalizePoint } from '@openav/leap';

console.log(normalizePoint([0, 200, 0]));                          // [ 0.5, 0.5, 0.5 ]: the centre
console.log(normalizePoint([500, 0, -500]));                       // [ 1, 0, 0 ]: far outside, clamped
console.log(normalizePoint([100, 320, 0]).map((v) => +v.toFixed(2)));   // [ 0.93, 1, 0.5 ]`,
        caption: { en: 'The console prints `[ 0.5, 0.5, 0.5 ]`, `[ 1, 0, 0 ]` and `[ 0.93, 1, 0.5 ]`.', zh: '主控台印出 `[ 0.5, 0.5, 0.5 ]`、`[ 1, 0, 0 ]` 和 `[ 0.93, 1, 0.5 ]`。' },
      },
    ],
    related: ['INTERACTION_BOX', 'LeapInput', 'handAngles'],
    keywords: {
      en: ['normalize', 'interaction box', 'millimetres', '0..1', 'clamp', 'palm position', 'scale hand'],
      zh: ['正規化', '互動範圍盒', '公釐', '0..1', '夾住', '掌心位置'],
    },
  },

  handAngles: {
    group: 'leap',
    summary: {
      en: 'Turns a hand\'s direction and palm normal into `{ pitch, yaw, roll }` in radians, with the LeapJS conventions.',
      zh: '把手的方向和掌心法線轉成以弧度計的 `{ pitch, yaw, roll }`，沿用 LeapJS 的慣例。',
    },
    params: [
      { name: 'direction', type: 'Array<Number>', en: 'The direction the fingers point, `[x, y, z]` (a unit vector).', zh: '手指指的方向 `[x, y, z]`（單位向量）。' },
      { name: 'normal', type: 'Array<Number>', en: 'The palm normal `[x, y, z]`, pointing out of the palm (down when the palm faces the sensor).', zh: '掌心法線 `[x, y, z]`，從手掌往外指（掌心朝向感測器時是向下）。' },
    ],
    returns: {
      type: 'Object',
      en: '`{ pitch, yaw, roll }`, each −π..π: `pitch` is the fingers tipping up, `yaw` turning toward +x (the right), `roll` the palm turning over.',
      zh: '`{ pitch, yaw, roll }`，各自在 −π..π：`pitch` 是手指往上翹，`yaw` 是轉向 +x（右邊），`roll` 是手掌翻轉。',
    },
    notes: [
      {
        en: 'When the fingers point straight up there is no yaw or roll to measure, and the function answers π (3.14) for them. Expect that at the top of a gesture, and do not map those two signals when the hand is vertical.',
        zh: '手指正對著天花板的時候，沒有 yaw 或 roll 可量，函式會回答 π（3.14）。手勢做到最高的時候會遇到，手垂直時請不要去映射那兩個訊號。',
      },
    ],
    description: [
      {
        en: 'A flat hand, palm down, fingers away from you, is `{ pitch: 0, yaw: 0, roll: 0 }`. The three angles are the `leap/hand/<side>/pitch|yaw|roll` signals, which `LeapInput` computes with this function from each hand.',
        zh: '手平放、掌心朝下、手指朝向遠離你的方向，就是 `{ pitch: 0, yaw: 0, roll: 0 }`。這三個角度就是 `leap/hand/<side>/pitch|yaw|roll` 這幾個訊號，`LeapInput` 對每隻手都是用這個函式算出來的。',
      },
    ],
    examples: [
      {
        code: `import { handAngles } from '@openav/leap';

const round = (a) => ({ pitch: +a.pitch.toFixed(2), yaw: +a.yaw.toFixed(2), roll: +a.roll.toFixed(2) });
console.log(round(handAngles([0, 0, -1], [0, -1, 0])));           // flat, palm down: all 0
console.log(round(handAngles([0, 0.5, -0.866], [0, -0.866, -0.5])));   // fingers tipped up 30 degrees: pitch 0.52
console.log(round(handAngles([0.707, 0, -0.707], [0, -1, 0])));    // fingers turned 45 degrees to the right: yaw 0.79
console.log(round(handAngles([0, 0, -1], [0.5, -0.866, 0])));      // palm turned over 30 degrees: roll 0.52`,
        caption: { en: 'The console prints the angles for four hands: all zeros, then `pitch: 0.52`, `yaw: 0.79` and `roll: 0.52`, one angle changing each time.', zh: '主控台印出四隻手的角度：全是 0，然後是 `pitch: 0.52`、`yaw: 0.79` 和 `roll: 0.52`，每次只有一個角度在變。' },
      },
    ],
    related: ['normalizePoint', 'LeapInput', 'palmBasis'],
    keywords: {
      en: ['pitch', 'yaw', 'roll', 'angles', 'hand rotation', 'orientation', 'radians', 'palm normal'],
      zh: ['俯仰', '偏航', '翻滾', '角度', '手的旋轉', '方向', '弧度', '掌心法線'],
    },
  },

  boneBasis: {
    group: 'leap',
    summary: {
      en: 'An advanced helper: the orthonormal basis `[x, y, z]` of a bone, rebuilt from two joints and the palm normal the way LeapJS expects.',
      zh: '進階用的輔助函式：用兩個關節和掌心法線重建一根骨頭的正交基底 `[x, y, z]`，做法符合 LeapJS 的期待。',
    },
    params: [
      { name: 'prev', type: 'Array<Number>', en: 'The joint at the base of the bone, `[x, y, z]` in millimetres.', zh: '骨頭根部的關節 `[x, y, z]`，單位是公釐。' },
      { name: 'next', type: 'Array<Number>', en: 'The joint at the tip end of the bone.', zh: '骨頭前端的關節。' },
      { name: 'palmNormal', type: 'Array<Number>', en: 'The palm normal; `-palmNormal` becomes the "back of the hand" axis (y).', zh: '掌心法線，`-palmNormal` 會成為「手背」那一軸（y）。' },
      { name: 'left', type: 'Boolean', en: '`true` for a left hand: the x axis is negated, so the determinant is negative, which is how LeapJS tells left from right.', zh: '左手就傳 `true`：x 軸會反向，行列式變成負的，LeapJS 就是靠這個分辨左右手。' },
    ],
    returns: {
      type: 'Array',
      en: 'Three rows `[x, y, z]`, each a unit vector rounded to 3 decimals. z runs from the tip back to the base (LeapJS\'s `Bone.direction()` is `-z`).',
      zh: '三列 `[x, y, z]`，各是四捨五入到小數三位的單位向量。z 從前端指回根部（LeapJS 的 `Bone.direction()` 是 `-z`）。',
    },
    description: [
      {
        en: 'The sensor gives joints, not rotations, but LeapJS sketches read a rotation basis for every bone, so [`V6Converter`](#V6Converter) uses this to fill in `bases`. You only need it if you write your own converter.',
        zh: '感測器給的是關節，不是旋轉，但 LeapJS 的草圖會對每根骨頭讀一個旋轉基底，所以 [`V6Converter`](#V6Converter) 用它來填 `bases`。只有自己寫轉換器的時候才會需要它。',
      },
    ],
    examples: [
      {
        code: `import { boneBasis } from '@openav/leap';

// a bone pointing straight ahead (-z), palm facing down: the basis is the identity
console.log(boneBasis([0, 200, 0], [0, 200, -40], [0, -1, 0], false));
// the same bone on a left hand: x flips
console.log(boneBasis([0, 200, 0], [0, 200, -40], [0, -1, 0], true)[0]);`,
        caption: { en: 'The console prints the identity `[ [ 1, 0, 0 ], [ 0, 1, 0 ], [ 0, 0, 1 ] ]`, then `[ -1, 0, 0 ]` for the left hand.', zh: '主控台印出單位矩陣 `[ [ 1, 0, 0 ], [ 0, 1, 0 ], [ 0, 0, 1 ] ]`，然後左手的 `[ -1, 0, 0 ]`。' },
      },
    ],
    related: ['palmBasis', 'V6Converter', 'rawToV6'],
    keywords: {
      en: ['bone basis', 'rotation', 'leapjs', 'orthonormal', 'bone', 'basis matrix'],
      zh: ['骨頭基底', '旋轉', 'leapjs', '正交', '骨頭', '基底矩陣'],
    },
  },

  palmBasis: {
    group: 'leap',
    summary: {
      en: 'An advanced helper: the orthonormal basis `[x, y, z]` of the palm, from its direction and normal, in the rows LeapJS reads as `hand.r`.',
      zh: '進階用的輔助函式：由手的方向和法線算出掌心的正交基底 `[x, y, z]`，列的排法就是 LeapJS 當作 `hand.r` 來讀的那種。',
    },
    params: [
      { name: 'direction', type: 'Array<Number>', en: 'The direction the fingers point.', zh: '手指指的方向。' },
      { name: 'normal', type: 'Array<Number>', en: 'The palm normal.', zh: '掌心法線。' },
      { name: 'left', type: 'Boolean', en: '`true` for a left hand: x is negated.', zh: '左手傳 `true`：x 會反向。' },
    ],
    returns: {
      type: 'Array',
      en: 'Three rows `[x, y, z]` (x sideways, y the back of the hand, z toward the wrist), rounded to 3 decimals.',
      zh: '三列 `[x, y, z]`（x 是橫向、y 是手背、z 朝向手腕），四捨五入到小數三位。',
    },
    description: [
      {
        en: 'Like [`boneBasis()`](#boneBasis), it exists so that the LeapJS frames [`V6Converter`](#V6Converter) writes have a `r` that `hand.rotationAngle()` can use. Worlds that draw hands read `leap.hands` and [`handAngles()`](#handAngles) instead.',
        zh: '和 [`boneBasis()`](#boneBasis) 一樣，它的存在是為了讓 [`V6Converter`](#V6Converter) 寫出的 LeapJS 影格有 `hand.rotationAngle()` 能用的 `r`。要畫手的世界讀的是 `leap.hands` 和 [`handAngles()`](#handAngles)。',
      },
    ],
    examples: [
      {
        code: `import { palmBasis } from '@openav/leap';

console.log(palmBasis([0, 0, -1], [0, -1, 0], false));   // flat hand, palm down, fingers forward: the identity`,
        caption: { en: 'The console prints the identity `[ [ 1, 0, 0 ], [ 0, 1, 0 ], [ 0, 0, 1 ] ]`.', zh: '主控台印出單位矩陣 `[ [ 1, 0, 0 ], [ 0, 1, 0 ], [ 0, 0, 1 ] ]`。' },
      },
    ],
    related: ['boneBasis', 'handAngles', 'V6Converter'],
    keywords: {
      en: ['palm basis', 'rotation', 'leapjs', 'hand.r', 'orthonormal'],
      zh: ['掌心基底', '旋轉', 'leapjs', 'hand.r', '正交'],
    },
  },

  V6Converter: {
    group: 'leap',
    summary: {
      en: 'Converts raw hand lines into LeapJS v6 frames, keeping the little state the protocol needs: time visible, smoothed positions and fingertip velocities.',
      zh: '把原始的手資料行轉成 LeapJS v6 影格，並保存通訊協定需要的少量狀態：可見時間、平滑過的位置和指尖速度。',
    },
    params: [
      {
        name: 'box', type: 'Object', optional: true, default: 'INTERACTION_BOX',
        en: 'The interaction box written into every frame\'s `interactionBox`.',
        zh: '寫進每個影格 `interactionBox` 的互動範圍盒。',
      },
      {
        name: 'smoothing', type: 'Number', optional: true, default: '0.5',
        en: '0..1: how strongly `stabilizedPalmPosition` and `stabilizedTipPosition` lag behind (0 follows exactly, close to 1 barely moves).',
        zh: '0..1：`stabilizedPalmPosition` 和 `stabilizedTipPosition` 落後的程度（0 完全跟隨，接近 1 幾乎不動）。',
      },
    ],
    description: [
      {
        en: 'Every browser sketch written for the old Leap service (LeapJS, 2014 to 2021) speaks the v6 protocol, so the bridge serves it on `/v6.json`. This class does the conversion: one converter per stream. It is stateful where the protocol is: a hand\'s `timeVisible` grows while it stays in view and starts over when it leaves, `stabilized…` positions are a light low-pass, and `tipVelocity` is a finite difference between two frames.',
        zh: '所有為舊版 Leap 服務寫的瀏覽器草圖（LeapJS，2014 到 2021 年）講的都是 v6 通訊協定，所以橋接程式在 `/v6.json` 提供這個格式。這個類別負責轉換：一條串流用一個轉換器。它在通訊協定要求有狀態的地方才有狀態：手在畫面裡時 `timeVisible` 會增加，離開再回來就重新開始，`stabilized…` 位置是輕微的低通濾波，`tipVelocity` 是兩個影格之間的差分。',
      },
      {
        en: 'LeapC gives joints, not bone rotations, so the bone bases are rebuilt from the joints and the palm normal ([`boneBasis()`](#boneBasis)). Gestures are not synthesised: `gestures` is always `[]`.',
        zh: 'LeapC 給的是關節，不是骨頭的旋轉，所以骨頭的基底是從關節和掌心法線重建的（[`boneBasis()`](#boneBasis)）。手勢不會被合成：`gestures` 永遠是 `[]`。',
      },
    ],
    members: {
      convert: {
        en: '`convert(raw, tUs = now)`: a raw frame `{ t: \'f\', id, fps, hands }` and its time in microseconds, to a v6 frame `{ id, timestamp, currentFrameRate, hands, pointables, interactionBox, gestures: [], r, s, t }`. Pointable ids are `handId × 10 + finger`.',
        zh: '`convert(raw, tUs = 現在)`：把原始影格 `{ t: \'f\', id, fps, hands }` 和它的時間（微秒）轉成 v6 影格 `{ id, timestamp, currentFrameRate, hands, pointables, interactionBox, gestures: [], r, s, t }`。pointable 的 id 是 `handId × 10 + 手指編號`。',
      },
    },
    examples: [
      {
        code: `import { V6Converter, mockFrame } from '@openav/leap';

const converter = new V6Converter();
converter.convert(mockFrame(1.0), 1_000_000);                    // microseconds
const frame = converter.convert(mockFrame(1.1), 1_100_000);
console.log(frame.hands[0].timeVisible);                          // 0.1: seen for a tenth of a second
console.log(frame.pointables.length, frame.pointables[1].tipVelocity);   // 10 [ -21, 17, 28 ]  mm per second`,
        caption: { en: 'The console prints `0.1`, then `10` pointables and the index fingertip\'s velocity `[ -21, 17, 28 ]` (millimetres per second between the two frames).', zh: '主控台印出 `0.1`，接著是 `10` 個 pointable，以及食指指尖的速度 `[ -21, 17, 28 ]`（兩個影格之間，每秒幾公釐）。' },
      },
    ],
    related: ['rawToV6', 'v6Header', 'deviceEvent', 'handsOf'],
    keywords: {
      en: ['v6', 'leapjs', 'convert', 'protocol', 'frame converter', 'raw to v6', 'legacy leap sketches'],
      zh: ['v6', 'leapjs', '轉換', '通訊協定', '影格轉換', '舊版 leap 草圖'],
    },
  },

  rawToV6: {
    group: 'leap',
    summary: {
      en: 'One-off conversion of a raw frame to a LeapJS v6 frame, with a fresh converter each time (no history, so no velocities).',
      zh: '把一個原始影格一次轉成 LeapJS v6 影格，每次都用全新的轉換器（沒有歷史，所以沒有速度）。',
    },
    params: [
      { name: 'raw', type: 'Object', en: 'A raw frame `{ t: \'f\', id, fps, hands }`.', zh: '原始影格 `{ t: \'f\', id, fps, hands }`。' },
      { name: 'tUs', type: 'Number', optional: true, en: 'The time in microseconds. Defaults to now.', zh: '時間，單位是微秒。預設是現在。' },
      { name: 'opts', type: 'Object', optional: true, en: 'Options for the [`V6Converter`](#V6Converter): `{ box, smoothing }`.', zh: '給 [`V6Converter`](#V6Converter) 的選項：`{ box, smoothing }`。' },
    ],
    returns: {
      type: 'Object',
      en: 'The v6 frame. Every field the LeapJS `Frame`, `Hand`, `Pointable`, `Finger` and `Bone` constructors read is there.',
      zh: 'v6 影格。LeapJS 的 `Frame`、`Hand`、`Pointable`、`Finger` 和 `Bone` 建構函式會讀的每個欄位都有。',
    },
    description: [
      {
        en: 'Handy for tests and for looking at what a legacy sketch would receive. For a stream, keep one [`V6Converter`](#V6Converter) instead, so that `timeVisible` and `tipVelocity` can accumulate.',
        zh: '用在測試，以及查看舊版草圖會收到什麼的時候很方便。處理一條串流的話，請改為保留一個 [`V6Converter`](#V6Converter)，`timeVisible` 和 `tipVelocity` 才能累積。',
      },
    ],
    examples: [
      {
        code: `import { mockFrame, rawToV6 } from '@openav/leap';

const frame = rawToV6(mockFrame(2.0, 120), 5_000_000);
console.log(Object.keys(frame).join(' '));
console.log(frame.hands.length, frame.pointables.length, frame.hands[0].type, frame.hands[0].pinchStrength);`,
        caption: { en: 'The console prints the frame\'s keys (`id timestamp currentFrameRate hands pointables interactionBox gestures r s t`), then `2 10 right 1`.', zh: '主控台印出影格的欄位（`id timestamp currentFrameRate hands pointables interactionBox gestures r s t`），然後是 `2 10 right 1`。' },
      },
    ],
    related: ['V6Converter', 'handsOf', 'v6Header', 'mockFrame'],
    keywords: {
      en: ['raw to v6', 'convert frame', 'leapjs frame', 'one-off conversion'],
      zh: ['原始轉 v6', '轉換影格', 'leapjs 影格', '一次性轉換'],
    },
  },

  v6Header: {
    group: 'leap',
    summary: {
      en: 'The first message of a LeapJS v6 connection: `{ serviceVersion, version }`, with `version` held to 1..6 because LeapJS throws above 6.',
      zh: 'LeapJS v6 連線的第一則訊息：`{ serviceVersion, version }`，`version` 被限制在 1..6，因為 LeapJS 超過 6 會丟出錯誤。',
    },
    params: [
      { name: 'serviceVersion', type: 'String', optional: true, default: '\'unknown\'', en: 'The tracking service version to report, such as `\'5.20.0\'`.', zh: '要回報的追蹤服務版本，例如 `\'5.20.0\'`。' },
      { name: 'version', type: 'Number', optional: true, default: 'PROTOCOL_VERSION', en: 'The protocol version the client asked for. Held to 1..6.', zh: '用戶端要求的通訊協定版本。限制在 1..6。' },
    ],
    returns: {
      type: 'Object',
      en: '`{ serviceVersion: String, version: Number }`.',
      zh: '物件 `{ serviceVersion: String, version: Number }`。',
    },
    description: [
      {
        en: 'The bridge sends this (plus `bridge: \'open-audiovisual\'`) as soon as a client connects to `/v6.json`, and [`LeapInput`](#LeapInput) turns it into the status `\'bridge\'`. Ask for 7 and you get 6.',
        zh: '用戶端一連到 `/v6.json`，橋接程式就會送出這則訊息（外加 `bridge: \'open-audiovisual\'`），[`LeapInput`](#LeapInput) 收到後會把狀態變成 `\'bridge\'`。要求 7 會得到 6。',
      },
    ],
    examples: [
      {
        code: `import { v6Header } from '@openav/leap';

console.log(v6Header('5.20.0'));        // { serviceVersion: '5.20.0', version: 6 }
console.log(v6Header('x', 3));          // { serviceVersion: 'x', version: 3 }
console.log(v6Header('x', 9).version);  // 6: never above what LeapJS accepts`,
        caption: { en: 'The console prints the header for version 6, version 3, and `6` for a request of 9.', zh: '主控台印出版本 6 的標頭、版本 3 的標頭，以及要求 9 時得到的 `6`。' },
      },
    ],
    related: ['deviceEvent', 'PROTOCOL_VERSION', 'protocolOfPath', 'LeapInput'],
    keywords: {
      en: ['v6 header', 'handshake', 'service version', 'leapjs protocol'],
      zh: ['v6 標頭', '交握', '服務版本', 'leapjs 通訊協定'],
    },
  },

  deviceEvent: {
    group: 'leap',
    summary: {
      en: 'A LeapJS device event telling the client whether a device is attached and streaming, plus our own `service` flag.',
      zh: '一則 LeapJS 裝置事件，告訴用戶端裝置有沒有接上、有沒有在串流，另外附上我們自己加的 `service` 旗標。',
    },
    params: [
      { name: 'device', type: 'String | null', optional: true, default: 'null', en: 'The device id, or `null` for no device.', zh: '裝置 id，沒有裝置就是 `null`。' },
      { name: 'service', type: 'Boolean', optional: true, default: 'true', en: 'Whether the tracking service is running. LeapJS ignores this; [`LeapInput`](#LeapInput) uses it to tell "no tracking service" from "no device".', zh: '追蹤服務有沒有在跑。LeapJS 會忽略它。[`LeapInput`](#LeapInput) 用它區分「沒有追蹤服務」和「沒有裝置」。' },
    ],
    returns: {
      type: 'Object',
      en: '`{ event: { type: \'deviceEvent\', state: { attached, streaming, id, type: \'Peripheral\', service } } }`; `id` is `\'none\'` without a device.',
      zh: '`{ event: { type: \'deviceEvent\', state: { attached, streaming, id, type: \'Peripheral\', service } } }`，沒有裝置時 `id` 是 `\'none\'`。',
    },
    description: [
      {
        en: 'LeapJS (protocol 5 and up) turns it into `deviceAttached`, `deviceStreaming` and `streamingStarted`. The bridge sends one on connect and on every status change. `LeapInput` maps it to its status: no service is `\'no-service\'`, a service without a device is `\'no-device\'`, and a streaming device is `\'tracking\'`.',
        zh: 'LeapJS（通訊協定 5 以上）會把它轉成 `deviceAttached`、`deviceStreaming` 和 `streamingStarted`。橋接程式在連線時，以及每次狀態改變時都會送一則。`LeapInput` 把它對應成自己的狀態：沒有服務是 `\'no-service\'`，有服務沒裝置是 `\'no-device\'`，裝置在串流就是 `\'tracking\'`。',
      },
    ],
    examples: [
      {
        code: `import { Signals } from '@openav/core';
import { LeapInput, deviceEvent } from '@openav/leap';

const signals = new Signals();
const leap = new LeapInput({ signals });
for (const event of [deviceEvent({ device: null, service: false }), deviceEvent({ device: null }), deviceEvent({ device: 'LE51' })]) {
  leap.ingest(event);
  console.log(leap.status, signals.get('leap/status'));
}`,
        caption: { en: 'Feeding three device events through a `LeapInput`: the console prints `no-service 1`, `no-device 2`, `tracking 3`.', zh: '把三則裝置事件餵給 `LeapInput`：主控台印出 `no-service 1`、`no-device 2`、`tracking 3`。' },
      },
    ],
    related: ['v6Header', 'LeapInput', 'STATUS'],
    keywords: {
      en: ['device event', 'device attached', 'streaming', 'no device', 'no service', 'status'],
      zh: ['裝置事件', '裝置接上', '串流', '沒有裝置', '沒有服務', '狀態'],
    },
  },

  protocolOfPath: {
    group: 'leap',
    summary: {
      en: 'Which protocol version a `/vN.json` path asks for, as a number, or `null` when the path is not one.',
      zh: '`/vN.json` 這種路徑要求的是哪個通訊協定版本，回傳數字，路徑不是這種格式就回傳 `null`。',
    },
    params: [
      { name: 'pathname', type: 'String', en: 'The URL path, such as `\'/v6.json\'`.', zh: '網址的路徑，例如 `\'/v6.json\'`。' },
    ],
    returns: {
      type: 'Number | null',
      en: 'The number in `/v<number>.json`, or `null`. It does not clip to 6: `/v7.json` gives 7 (the bridge then answers it as version 6).',
      zh: '`/v<數字>.json` 裡的數字，或 `null`。它不會截到 6：`/v7.json` 得到 7（橋接程式再以版本 6 回應）。',
    },
    description: [
      {
        en: 'The bridge uses it to decide whether a WebSocket upgrade is a LeapJS client at all: `/v6.json` yes, `/raw` is handled separately, anything else is refused with a 404.',
        zh: '橋接程式用它判斷一個 WebSocket 升級請求是不是 LeapJS 的用戶端：`/v6.json` 是，`/raw` 另外處理，其他的一律回 404 拒絕。',
      },
    ],
    examples: [
      {
        code: `import { protocolOfPath } from '@openav/leap';

console.log(protocolOfPath('/v6.json'), protocolOfPath('/v3.json'), protocolOfPath('/v7.json'));   // 6 3 7
console.log(protocolOfPath('/raw'), protocolOfPath('/v6.jsonx'), protocolOfPath(undefined));        // null null null`,
        caption: { en: 'The console prints `6 3 7`, then `null null null`.', zh: '主控台印出 `6 3 7`，然後是 `null null null`。' },
      },
    ],
    related: ['v6Header', 'PROTOCOL_VERSION'],
    keywords: {
      en: ['protocol path', 'v6.json', 'protocol version', 'bridge endpoint'],
      zh: ['通訊協定路徑', 'v6.json', '通訊協定版本', '橋接端點'],
    },
  },

  FINGERS: {
    group: 'leap',
    summary: {
      en: 'The five finger names in order, `thumb index middle ring pinky`: the order of `hand.fingers` and the names in the fingertip signals.',
      zh: '依序排好的五個手指名稱 `thumb index middle ring pinky`：`hand.fingers` 的順序，也是指尖訊號用的名字。',
    },
    description: [
      {
        en: '`hand.fingers[0]` is the thumb and `hand.fingers[4]` the pinky, so `FINGERS[i]` names `hand.fingers[i]`. The fingertip signals are `leap/hand/<side>/<finger>/x|y|z` with these names, for example `leap/hand/right/index/y`.',
        zh: '`hand.fingers[0]` 是拇指，`hand.fingers[4]` 是小指，所以 `FINGERS[i]` 就是 `hand.fingers[i]` 的名字。指尖訊號是 `leap/hand/<side>/<finger>/x|y|z`，用的就是這些名字，例如 `leap/hand/right/index/y`。',
      },
    ],
    related: ['LeapInput', 'handsOf', 'leapSignals'],
    keywords: {
      en: ['fingers', 'finger names', 'thumb', 'index', 'middle', 'ring', 'pinky', 'fingertip'],
      zh: ['手指', '手指名稱', '拇指', '食指', '中指', '無名指', '小指', '指尖'],
    },
  },

  INTERACTION_BOX: {
    group: 'leap',
    summary: {
      en: 'The classic Leap interaction box, `{ center: [0, 200, 0], size: [235.247, 235.247, 147.751] }` in millimetres, that positions are normalised against.',
      zh: '經典的 Leap 互動範圍盒，`{ center: [0, 200, 0], size: [235.247, 235.247, 147.751] }`，單位是公釐，位置就是對它做正規化。',
    },
    description: [
      {
        en: 'A frozen object: the centre sits 200 mm above the sensor, and the box measures 235.247 mm along x, 235.247 mm along y and 147.751 mm along z (the sensor\'s own axes: x across, y up, z toward the player). [`normalizePoint()`](#normalizePoint) maps it to 0..1, and the console panel draws it as an outline so you can see when a hand leaves it. Pass your own box to `new LeapInput({ box })` to change where 0 and 1 are.',
        zh: '一個凍結的物件：中心在感測器上方 200 公釐，三個軸的尺寸是感測器自己的座標軸：x 是 235 公釐、y 是 235 公釐、z 是 148 公釐。[`normalizePoint()`](#normalizePoint) 把它對應到 0..1，主控台面板把它畫成外框，這樣你就看得到手什麼時候離開。要改 0 和 1 在哪裡，就傳自己的盒子給 `new LeapInput({ box })`。',
      },
    ],
    related: ['normalizePoint', 'LeapInput', 'mountLeapPanel'],
    keywords: {
      en: ['interaction box', 'tracking volume', 'box', 'center', 'size', 'millimetres'],
      zh: ['互動範圍盒', '追蹤範圍', '範圍盒', '中心', '尺寸', '公釐'],
    },
  },

  PROTOCOL_VERSION: {
    group: 'leap',
    summary: {
      en: 'The highest LeapJS protocol version we speak: 6. LeapJS 1.1.1 and earlier throw "unrecognized version" above that.',
      zh: '我們支援的 LeapJS 通訊協定最高版本：6。LeapJS 1.1.1 和更早的版本遇到更高的版本會丟出 "unrecognized version"。',
    },
    description: [
      {
        en: '[`v6Header()`](#v6Header) never reports more than this, and the bridge answers `/v7.json` as version 6. It is the default of the `version` argument there.',
        zh: '[`v6Header()`](#v6Header) 不會回報比這更高的版本，橋接程式也把 `/v7.json` 當成版本 6 回應。它是那裡 `version` 參數的預設值。',
      },
    ],
    related: ['v6Header', 'protocolOfPath', 'DEFAULT_URL'],
    keywords: {
      en: ['protocol version', 'leapjs version', 'v6', 'version 6'],
      zh: ['通訊協定版本', 'leapjs 版本', 'v6', '版本 6'],
    },
  },

  DEFAULT_URL: {
    group: 'leap',
    summary: {
      en: 'The default address `LeapInput` connects to: `ws://127.0.0.1:6437/v6.json`, the bridge on this machine speaking the LeapJS protocol.',
      zh: '`LeapInput` 預設連的位址：`ws://127.0.0.1:6437/v6.json`，也就是這台機器上、講 LeapJS 通訊協定的橋接程式。',
    },
    description: [
      {
        en: 'Port 6437 is the port the original Leap service used, so old `leap.js` sketches find the bridge without changing anything. `…/raw` on the same port serves the raw lines instead. In a show, `?leap=ws://host:port/v6.json` in the page address points a page at another bridge, and `?leap=sim` starts the simulator.',
        zh: '6437 是原本的 Leap 服務用的連接埠，所以舊的 `leap.js` 草圖不用改任何東西就找得到橋接程式。同一個連接埠的 `…/raw` 提供的是原始行格式。在演出裡，網址加上 `?leap=ws://host:port/v6.json` 可以讓頁面改連別的橋接程式，`?leap=sim` 則會啟動模擬器。',
      },
    ],
    related: ['LeapInput'],
    keywords: {
      en: ['default url', 'bridge address', 'ws://127.0.0.1:6437', 'websocket url', '6437'],
      zh: ['預設網址', '橋接位址', 'ws://127.0.0.1:6437', 'websocket 位址', '6437'],
    },
  },

  STATUS: {
    group: 'leap',
    summary: {
      en: 'The four levels of the `leap/status` signal by name: `off` 0, `bridge` 1, `service` 2, `tracking` 3.',
      zh: '`leap/status` 訊號的四個等級，用名字表示：`off` 0、`bridge` 1、`service` 2、`tracking` 3。',
    },
    description: [
      {
        en: 'A frozen object `{ off: 0, bridge: 1, service: 2, tracking: 3 }`: 0 no bridge, 1 the bridge is there but the tracking service is not, 2 the service is there but no device, 3 tracking. Use it to read the signal without magic numbers: `signals.get(\'leap/status\') === STATUS.tracking`. Note it is the **number** published as `leap/status`; `leap.status` is a different thing, a string (`\'tracking\'`, `\'no-device\'` …), and the simulator counts as 3.',
        zh: '一個凍結的物件 `{ off: 0, bridge: 1, service: 2, tracking: 3 }`：0 沒有橋接、1 有橋接但追蹤服務沒開、2 有服務但沒有裝置、3 追蹤中。讀訊號時可以不用神祕數字：`signals.get(\'leap/status\') === STATUS.tracking`。注意，發布成 `leap/status` 的是這個**數字**。`leap.status` 是另一回事，它是字串（`\'tracking\'`、`\'no-device\'` ……），而模擬器算 3。',
      },
    ],
    notes: [
      {
        en: 'The code in `LeapInput` writes the numbers itself and does not read this object, so `STATUS` is a convenience for your own code. The strings map as: `tracking` and `simulated` to 3, `no-device` to 2, `bridge` and `no-service` to 1, the rest to 0.',
        zh: '`LeapInput` 裡的程式是自己寫入數字，並不讀這個物件，所以 `STATUS` 只是方便你自己的程式用。字串的對應是：`tracking` 和 `simulated` 是 3，`no-device` 是 2，`bridge` 和 `no-service` 是 1，其餘是 0。',
      },
    ],
    related: ['LeapInput', 'deviceEvent', 'mountLeapPanel'],
    keywords: {
      en: ['status', 'leap status', 'tracking', 'no bridge', 'no device', 'connection state'],
      zh: ['狀態', 'leap 狀態', '追蹤中', '沒有橋接', '沒有裝置', '連線狀態'],
    },
  },

  startBridge: {
    group: 'leap',
    summary: {
      en: 'Starts the Leap bridge on this machine: a loopback WebSocket and HTTP server that serves the sensor\'s hands to every page (Node only).',
      zh: '在這台機器上啟動 Leap 橋接程式：一個只綁 loopback 的 WebSocket 與 HTTP 伺服器，把感測器的手送給每一個頁面（只能在 Node 執行）。',
    },
    params: [
      { name: 'port', type: 'Number', optional: true, default: 'DEFAULT_PORT', en: 'The port to listen on, [`DEFAULT_PORT`](#leap-DEFAULT_PORT) unless you say otherwise. 0 picks any free one. The ports in [`RESERVED_PORTS`](#leap-RESERVED_PORTS) (7457) are refused.', zh: '要監聽的連接埠，沒特別指定就是 [`DEFAULT_PORT`](#leap-DEFAULT_PORT)。0 表示隨便挑一個空的。[`RESERVED_PORTS`](#leap-RESERVED_PORTS) 裡的連接埠（7457）會被拒絕。' },
      { name: 'host', type: 'String', optional: true, default: '\'127.0.0.1\'', en: 'The address to bind. Only loopback (`127.0.0.1`, `::1`, `localhost`) is allowed: hand data never leaves the machine.', zh: '要綁定的位址。只允許 loopback（`127.0.0.1`、`::1`、`localhost`）：手的資料絕不會離開這台機器。' },
      { name: 'mock', type: 'Boolean', optional: true, default: 'false', en: '`true` serves two animated made-up hands ([`mockFrame()`](#mockFrame)) instead of reading a sensor.', zh: '`true` 的話，送出兩隻會動的假手（[`mockFrame()`](#mockFrame)），不讀感測器。' },
      { name: 'hz', type: 'Number', optional: true, default: '60', en: 'The most frames per second sent to each client (held to 1..120). A slow client skips frames; it never queues them.', zh: '每個用戶端每秒最多收到幾個影格（限制在 1..120）。慢的用戶端會跳過影格，不會排隊。' },
      { name: 'bin', type: 'String | null', optional: true, default: 'null', en: 'The path to the `leap-stream` reader program. By default the bridge compiles its C reader on first start (needs the Xcode command line tools) and caches it.', zh: '`leap-stream` 讀取程式的路徑。預設是橋接程式第一次啟動時編譯它的 C 讀取程式（需要 Xcode 命令列工具）並快取起來。' },
      { name: 'log', type: 'Function', optional: true, default: '() => {}', en: 'Called with a line of text for each event worth knowing (clients coming and going, status changes).', zh: '每一件值得知道的事（用戶端進出、狀態改變）都會以一行文字呼叫它。' },
    ],
    returns: {
      type: 'Promise<Object>',
      en: 'Resolves once listening, with `{ port, state, health(), close() }`: the real port (useful with `port: 0`), the live state, a function returning the `/health` object, and a function that stops everything and returns a Promise.',
      zh: '開始監聽之後才完成，結果是 `{ port, state, health(), close() }`：實際的連接埠（`port: 0` 時有用）、即時狀態、回傳 `/health` 物件的函式，以及停止一切並回傳 Promise 的函式。',
    },
    description: [
      {
        en: 'This is what `node packages/leap/bridge/leap-bridge.mjs` runs (add `--mock` for made-up hands, `--port`, `--hz`, `--bin`, `--quiet`). It serves `ws://127.0.0.1:6437/v6.json` (the LeapJS protocol, which every 2014 to 2021 browser sketch speaks), `ws://…/raw` (the raw lines), the same lines as server-sent events on `GET /raw` and `/hands`, and `GET /health` (source, service, device, fps, hands, clients). Any page origin may read it, as the original Leap service allowed.',
        zh: '`node packages/leap/bridge/leap-bridge.mjs` 執行的就是它（加 `--mock` 得到假手，另有 `--port`、`--hz`、`--bin`、`--quiet`）。它提供 `ws://127.0.0.1:6437/v6.json`（LeapJS 通訊協定，2014 到 2021 年所有的瀏覽器草圖講的都是它）、`ws://…/raw`（原始行）、`GET /raw` 和 `/hands` 上以 server-sent events 送的同樣內容，以及 `GET /health`（來源、服務、裝置、fps、手、用戶端）。任何頁面來源都可以讀取，跟原本的 Leap 服務一樣。',
      },
      {
        en: 'Call it from your own Node program when you want the bridge inside it, for example in a test. `startBridge()` throws at once for port 7457 (it belongs to The Last Input and the monitor) and for a non-loopback `host`; a port already in use rejects the returned promise with a message that suggests `curl http://127.0.0.1:6437/health`.',
        zh: '想把橋接程式放進你自己的 Node 程式裡（例如測試）時，就自己呼叫它。連接埠是 7457（那是 The Last Input 和後台監看用的）或 `host` 不是 loopback，`startBridge()` 會立刻丟出錯誤。連接埠已被占用，回傳的 promise 會被拒絕，訊息會建議你執行 `curl http://127.0.0.1:6437/health`。',
      },
    ],
    needs: {
      en: 'Node 22 or later, and for real hands the Ultraleap Hand Tracking service plus Xcode\'s `clang` to build the reader on first start. With `mock: true` neither is needed.',
      zh: 'Node 22 以上，要接真的手，還需要 Ultraleap Hand Tracking 服務，以及第一次啟動時用來編譯讀取程式的 Xcode `clang`。`mock: true` 的話兩者都不需要。',
    },
    examples: [
      {
        code: `import { startBridge } from '@openav/leap/bridge';

const bridge = await startBridge({ mock: true, port: 0 });          // made-up hands, any free port
const socket = new WebSocket('ws://127.0.0.1:' + bridge.port + '/v6.json');
socket.onmessage = async ({ data }) => {
  const message = JSON.parse(data);
  if (message.serviceVersion) console.log('handshake:', message);    // { serviceVersion: 'mock', version: 6, bridge: 'open-audiovisual' }
  if (message.hands) {                                               // a frame
    console.log('hands in the frame:', message.hands.length);        // 2
    socket.close();
    await bridge.close();
  }
};`,
        caption: { en: 'In Node: the first message is the handshake, `handshake: { serviceVersion: \'mock\', version: 6, bridge: \'open-audiovisual\' }`, then a frame arrives and the program prints `hands in the frame: 2` and stops the bridge.', zh: '在 Node 裡：第一則訊息是交握 `handshake: { serviceVersion: \'mock\', version: 6, bridge: \'open-audiovisual\' }`，接著收到一個影格，程式印出 `hands in the frame: 2`，並把橋接程式停掉。' },
        run: 'static',
        why: 'It starts a server and runs in Node (it imports node:http); a browser page cannot run it.',
      },
    ],
    related: ['LeapInput', 'mockFrame', 'V6Converter', 'DEFAULT_URL'],
    keywords: {
      en: ['leap bridge', 'bridge', 'server', 'websocket server', 'node', '6437', 'mock', 'leap-bridge', 'ultraleap service'],
      zh: ['leap 橋接', '橋接程式', '伺服器', 'websocket 伺服器', 'node', '6437', '假手', 'ultraleap 服務'],
    },
  },

  DEFAULT_PORT: {
    group: 'leap',
    summary: {
      en: 'The Leap bridge\'s default port: 6437, the port the original Leap service used, so old `leap.js` sketches find it unchanged.',
      zh: 'Leap 橋接程式預設的連接埠：6437，是原本的 Leap 服務用的連接埠，舊的 `leap.js` 草圖不用改就找得到。',
    },
    description: [
      {
        en: 'The default of `startBridge({ port })` and of `--port`. The environment variable `LEAP_BRIDGE_PORT` changes it for the command line. This is the port of the **Leap** bridge; the out-bridge has its own ([`DEFAULT_PORT` of `@openav/out`](#out-DEFAULT_PORT), 6450).',
        zh: '`startBridge({ port })` 和 `--port` 的預設值。環境變數 `LEAP_BRIDGE_PORT` 可以改命令列用的值。這是 **Leap** 橋接程式的連接埠。輸出橋接有自己的（[`@openav/out` 的 `DEFAULT_PORT`](#out-DEFAULT_PORT)，6450）。',
      },
    ],
    related: ['DEFAULT_URL'],
    keywords: {
      en: ['port', '6437', 'default port', 'bridge port'],
      zh: ['連接埠', '6437', '預設連接埠', '橋接連接埠'],
    },
  },

  RESERVED_PORTS: {
    group: 'leap',
    summary: {
      en: 'The ports the Leap bridge refuses to use: `[7457]`, which belongs to The Last Input and the backstage monitor.',
      zh: 'Leap 橋接程式拒絕使用的連接埠：`[7457]`，那是 The Last Input 和後台監看用的。',
    },
    description: [
      {
        en: '`startBridge({ port: 7457 })` throws "port 7457 belongs to The Last Input" immediately, so the bridge can never take the port the monitor listens on (`node packages/monitor/server.js`). The out-bridge refuses the same one.',
        zh: '`startBridge({ port: 7457 })` 會立刻丟出 "port 7457 belongs to The Last Input"，所以橋接程式絕不會占走後台監看監聽的連接埠（`node packages/monitor/server.js`）。輸出橋接也一樣拒絕這一個。',
      },
    ],
    related: ['MonitorFeed'],
    keywords: {
      en: ['reserved ports', '7457', 'port', 'refused port', 'monitor port'],
      zh: ['保留連接埠', '7457', '連接埠', '拒絕的連接埠', '監看連接埠'],
    },
  },
};
