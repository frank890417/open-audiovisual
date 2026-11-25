// @openav/tile reference: several screens lying on a table become one canvas. One photo of their markers places every screen,
// one clock shared over the relay and one seed keep them together, and each screen draws only its own piece.
// Read by tools/build-reference.mjs (see AGENTS.md, "Documenting a public name").

const WHY_ROOM = 'It joins a relay room, which needs `node serve.js` (or another relay) and a page with a screen to cover: example 30 runs it.';
const WHY_CV = 'It loads OpenCV.js, about 10 MB, from jsDelivr: only the camera page (`packages/tile/?demo=1` shows it with no hardware) is meant to pay for that, and CI never fetches it.';
const SIM = 'A similarity is four numbers `{ a, b, tx, ty }`: `x\' = a·x − b·y + tx`, `y\' = b·x + a·y + ty`, a turn of `atan2(b, a)`, a uniform scale of `hypot(a, b)` and a shift.';
const SIM_ZH = '相似轉換是四個數字 `{ a, b, tx, ty }`：`x\' = a·x − b·y + tx`、`y\' = b·x + a·y + ty`，旋轉 `atan2(b, a)`、等比縮放 `hypot(a, b)`，再加一個位移。';
const MAT = 'Nine numbers, row by row: `[a, b, c, d, e, f, g, h, i]` takes `(x, y)` to `((a·x + b·y + c) / w, (d·x + e·y + f) / w)` with `w = g·x + h·y + i`.';
const MAT_ZH = '九個數字，一列一列：`[a, b, c, d, e, f, g, h, i]` 把 `(x, y)` 變成 `((a·x + b·y + c) / w, (d·x + e·y + f) / w)`，其中 `w = g·x + h·y + i`。';

export default {
  // ------------------------------------------------------------------------------------------------ a screen joins the table
  joinTile: {
    group: 'tile',
    summary: {
      en: 'Makes this page one screen of the table: it joins a relay room, keeps the shared clock, paints its markers when asked and knows which piece of the canvas it draws.',
      zh: '讓這個頁面成為桌上的一台螢幕：加入中繼的房間、維持共同時鐘、被要求時畫出標記，並知道自己要畫畫布的哪一塊。',
    },
    params: [
      { name: 'room', type: 'String', optional: true, default: "?room=, else 'tile'", en: 'The relay room. Every screen of one table and its camera page use the same name (letters, digits, `-` and `_`, up to 32).', zh: '中繼的房間。同一張桌子的每台螢幕和它的拍照頁用同一個名字（字母、數字、`-` 和 `_`，最多 32 個字）。' },
      { name: 'url', type: 'String | null', optional: true, default: 'null', en: 'The relay\'s `ws://` address. `null` is this server\'s `/relay` (what `node serve.js` runs), or `?relay=` in the address.', zh: '中繼的 `ws://` 位址。`null` 是這台伺服器的 `/relay`（`node serve.js` 跑的那個），或網址裡的 `?relay=`。' },
      { name: 'id', type: 'String', optional: true, default: 'tileId()', en: 'This screen\'s id: `?id=` in the address, else one kept in `localStorage`, so a reload keeps its place on the table.', zh: '這台螢幕的 id：網址裡的 `?id=`，不然就是存在 `localStorage` 的那個，所以重新整理後還在桌上原來的位置。' },
      { name: 'signals', type: 'Signals | null', optional: true, default: 'null', en: 'A show\'s `Signals`: `tile/markers`, `tile/synced` and `tile/layout` go into it. A page usually joins before `createShow()`, so `tile.attach(show.signals)` does the same later.', zh: '演出的 `Signals`：`tile/markers`、`tile/synced`、`tile/layout` 會寫進去。頁面通常在 `createShow()` 之前就加入，所以之後用 `tile.attach(show.signals)` 也一樣。' },
      { name: 'container', type: 'HTMLElement | null', optional: true, default: 'document.body', en: 'Where the join card, the marker layer and the status chip go.', zh: '加入卡片、標記圖層和狀態小標放在哪裡。' },
      { name: 'ui', type: 'Boolean', optional: true, default: 'true', en: 'The "Tap to join" card, the status chip and the ⛶ button. `false` leaves only the marker layer.', zh: '「Tap to join」卡片、狀態小標和 ⛶ 按鈕。`false` 只留下標記圖層。' },
      { name: 'storage', type: 'Storage | null', optional: true, default: 'localStorage', en: 'Where the last layout and show start are kept, under `oav.tile.<room>`.', zh: '最後一份版面和演出起點存在哪裡，鍵是 `oav.tile.<room>`。' },
      { name: 'Link', type: 'Function', optional: true, default: 'TileLink', en: 'The relay client class, for a test that replaces the socket.', zh: '中繼用戶端的類別，給要換掉 socket 的測試用。' },
    ],
    returns: {
      type: 'Object',
      en: 'The tile: `id`, `room`, `index` (its number from the camera page), `view`, `layout`, `calibrated`, `mode`, `seed`, `synced`, `time()` (shared seconds), `now()` (shared ms), `size()`, `markers(on)`, `attach(signals)`, `syncTimeline(timeline, dt)`, `on(event, cb)`, `status()`, `close()`, `link`, `clock`.',
      zh: '這台螢幕：`id`、`room`、`index`（拍照頁給的編號）、`view`、`layout`、`calibrated`、`mode`、`seed`、`synced`、`time()`（共同的秒數）、`now()`（共同的毫秒）、`size()`、`markers(on)`、`attach(signals)`、`syncTimeline(timeline, dt)`、`on(event, cb)`、`status()`、`close()`、`link`、`clock`。',
    },
    description: [
      {
        en: 'A tile is a `controller` in a relay room and tells the room who it is once a second with the signal `tile/<id>/hello`: its id and its drawing area in device pixels (CSS size × `devicePixelRatio`). The camera page answers with standing config the relay replays to a screen that joins later: each screen\'s number, Markers or Play, the layout, and the show\'s seed and start.',
        zh: '一台螢幕在中繼房間裡是 `controller`，每秒用 `tile/<id>/hello` 這個訊號告訴房間它是誰：它的 id 和繪圖區的裝置像素（CSS 尺寸 × `devicePixelRatio`）。拍照頁用常駐的設定回答，中繼會把這些設定重播給晚到的螢幕：每台螢幕的編號、標記或演出、版面，以及演出的種子和起點。',
      },
      {
        en: 'The page opens on a "Tap to join" card: that tap is the one gesture a browser accepts for fullscreen and the screen wake lock, so both are asked for inside it. Until a photo placed this screen, `tile.view` is `soloView()` of its own size, and the work draws as one screen on its own. When the screen changes size (a rotation, the address bar) it goes back to that until the next photo.',
        zh: '頁面一開始是一張「Tap to join」卡片：這一下是瀏覽器唯一接受用來全螢幕和螢幕喚醒鎖的動作，所以兩個都在這一下裡要。拍照定位之前，`tile.view` 是自己尺寸的 `soloView()`，作品就當一台單獨的螢幕畫。螢幕尺寸一變（旋轉、網址列），它就退回這樣，直到下一張照片。',
      },
      {
        en: '`tile.time()` is the shared show clock in seconds: every screen reads the same number at the same moment, within half of its quickest round trip to the relay. A tiled world draws from it and from `tile.seed`, never from a sum of its own `dt`, so a screen that joined late or dropped a frame still draws the same instant. `syncTimeline(timeline, dt)`, called before `timeline.advance(dt)` (createShow\'s `onFrame` is), puts the timeline on that clock too.',
        zh: '`tile.time()` 是共同的演出時鐘，單位秒：每台螢幕在同一刻讀到同一個數字，誤差在它到中繼最快那次來回的一半以內。拼接的世界從它和 `tile.seed` 算畫面，從不累加自己的 `dt`，所以晚加入或掉了一格的螢幕，畫的還是同一瞬間。`syncTimeline(timeline, dt)` 在 `timeline.advance(dt)` 之前呼叫（createShow 的 `onFrame` 就是），讓時間軸也跟著這個時鐘。',
      },
    ],
    needs: {
      en: 'A browser page, a relay (`node serve.js` serves one at `/relay`; a static host such as openaudiovisual.com has none) and the camera page `packages/tile/?room=<name>` on a phone. Fullscreen and the wake lock wait for the tap; the wake lock exists only on `https://` or `localhost`.',
      zh: '要有瀏覽器頁面、一個中繼（`node serve.js` 在 `/relay` 提供一個，openaudiovisual.com 這種靜態主機沒有），以及在手機上開的拍照頁 `packages/tile/?room=<name>`。全螢幕和喚醒鎖要等那一下點擊，喚醒鎖只在 `https://` 或 `localhost` 才有。',
    },
    notes: [
      {
        en: 'iPhone Safari cannot make a page fullscreen: add it to the home screen and open it from there. Keeping the screen on is the system setting\'s job (Auto-Lock: Never); the wake lock is a backup.',
        zh: 'iPhone 的 Safari 不能讓網頁全螢幕：把它加入主畫面，再從主畫面打開。螢幕常亮靠系統設定（自動鎖定：永不），喚醒鎖只是保險。',
      },
      {
        en: 'Two tabs of one browser share an id (it is kept in `localStorage`): add `&id=a`, `&id=b` when trying it on one computer.',
        zh: '同一個瀏覽器的兩個分頁會共用一個 id（存在 `localStorage`）：在一台電腦上試的時候，加上 `&id=a`、`&id=b`。',
      },
    ],
    examples: [
      {
        code: `import { createShow } from '@openav/show';
import { joinTile, tileWorld, TILE_ROUTES } from '@openav/tile';

const tile = joinTile({ room: 'desk' });            // before the show: the world is wrapped with it
const show = await createShow({
  world: tileWorld(myWorld, tile),                  // adds the tileMarkers param and io.tile
  routes: [...TILE_ROUTES],                         // the camera page's Markers / Play → tileMarkers
  onFrame: (dt, s) => tile.syncTimeline(s.timeline, dt),
});
tile.attach(show.signals);                          // tile/markers, tile/synced, tile/layout`,
        caption: { en: 'A show whose world plays across every screen of the room "desk", its timeline on the shared clock.', zh: '一場演出，世界在房間 desk 的每台螢幕上一起演，時間軸跟著共同時鐘。' },
        run: 'static', why: WHY_ROOM,
      },
    ],
    related: ['tileWorld', 'tileView', 'TileLink', 'TILE_ROUTES', 'solveLayout'],
    keywords: {
      en: ['tile', 'tiling', 'several screens', 'multi-screen', 'video wall', 'phones on a table', 'join', 'relay room', 'shared clock', 'fullscreen', 'wake lock'],
      zh: ['拼接', '多螢幕', '螢幕牆', '桌上的手機', '加入', '中繼房間', '共同時鐘', '全螢幕', '喚醒鎖'],
    },
  },

  TileLink: {
    group: 'tile',
    summary: {
      en: 'A relay client that also keeps the shared clock: it pings the relay on connect and every 2 s and files each answer into a ClockSync.',
      zh: '同時維持共同時鐘的中繼用戶端：連上時和之後每 2 秒 ping 中繼一次，把每個回應交給 ClockSync。',
    },
    params: [
      { name: 'clock', type: 'ClockSync', optional: true, default: 'new ClockSync()', en: 'The clock the pongs go into.', zh: '回應要放進去的時鐘。' },
      { name: 'onClock', type: 'Function | null', optional: true, default: 'null', en: '`(clock) => {}` after every pong that counted.', zh: '每個算數的回應之後呼叫 `(clock) => {}`。' },
      { name: 'o', type: 'Object', optional: true, en: 'Everything a `RelayClient` takes: `role`, `room`, `id`, `url`, `onStatus`, `onSignal`, `onConfig` ….', zh: '`RelayClient` 接受的所有選項：`role`、`room`、`id`、`url`、`onStatus`、`onSignal`、`onConfig` ⋯。' },
    ],
    description: [
      {
        en: 'The relay already answers every ping with its own time (`{ type: \'pong\', t, server }`); `TileLink` keeps that `server` time instead of only the latency. Ten quick pings on connect find a short round trip early, then one every 2 s follows the drift. The relay itself is unchanged: a tile is a `controller`, the camera page a `runner`.',
        zh: '中繼本來就會用自己的時間回答每一個 ping（`{ type: \'pong\', t, server }`），`TileLink` 把那個 `server` 時間留下來，而不只是延遲。連上時快速 ping 十次，早點找到短的來回，之後每 2 秒一次追蹤漂移。中繼本身完全沒改：螢幕是 `controller`，拍照頁是 `runner`。',
      },
    ],
    examples: [
      {
        code: `import { TileLink, ClockSync } from '@openav/tile';

const link = new TileLink({ role: 'runner', room: 'desk', clock: new ClockSync(),
  onClock: (c) => console.log('shared clock', c.now(), '±', c.rtt / 2, 'ms') });
link.connect();`,
        caption: { en: 'A page in the room "desk" that logs the relay\'s clock and how far it can be trusted, after every pong.', zh: '房間 desk 裡的一個頁面，每次回應之後印出中繼的時鐘和它能信到多準。' },
        run: 'static', why: WHY_ROOM,
      },
    ],
    related: ['ClockSync', 'joinTile', 'RelayClient'],
    keywords: { en: ['relay client', 'ping', 'pong', 'clock sync', 'ntp'], zh: ['中繼用戶端', 'ping', 'pong', '對時', 'NTP'] },
  },

  tileId: {
    group: 'tile',
    summary: {
      en: 'This screen\'s id: `?id=` in the address, else one made up once and kept in localStorage, so a reload keeps its place on the table.',
      zh: '這台螢幕的 id：網址裡的 `?id=`，不然就是第一次編一個存在 localStorage，所以重新整理後還在桌上原來的位置。',
    },
    params: [
      { name: 'storage', type: 'Storage | null', optional: true, default: 'localStorage', en: 'Where the id is kept, under `oav.tile.id`.', zh: 'id 存在哪裡，鍵是 `oav.tile.id`。' },
    ],
    returns: { type: 'String', en: 'Up to 24 letters, digits, `-` or `_`; a made-up one is `t` and five more.', zh: '最多 24 個字母、數字、`-` 或 `_`。編出來的是 `t` 加五個字。' },
    description: [
      {
        en: 'The id names the screen in the room (`tile/<id>/hello`) and in the layout, so it must stay the same across a reload: that is how a screen that reloads finds its place again without a new photo.',
        zh: 'id 是這台螢幕在房間裡（`tile/<id>/hello`）和版面裡的名字，所以重新整理之後必須一樣：重新整理的螢幕就是這樣不用重拍就找回自己的位置。',
      },
    ],
    examples: [
      {
        code: `import { tileId } from '@openav/tile';

const kept = new Map();
const storage = { getItem: (k) => kept.get(k) ?? null, setItem: (k, v) => kept.set(k, v) };
document.getElementById('app').textContent = tileId(storage) + ' then ' + tileId(storage);`,
        caption: { en: 'The same made-up id twice, for example "tx3k9a then tx3k9a": the second call reads the one the first kept.', zh: '兩次是同一個編出來的 id，例如「tx3k9a then tx3k9a」：第二次讀到第一次存下來的那個。' },
      },
    ],
    related: ['joinTile', 'helloName'],
    keywords: { en: ['id', 'screen id', 'device id', 'localStorage'], zh: ['id', '螢幕 id', '裝置 id', 'localStorage'] },
  },

  helloName: {
    group: 'tile',
    summary: {
      en: 'The name of the signal a screen announces itself with: `tile/<id>/hello`.',
      zh: '螢幕用來報到的訊號名稱：`tile/<id>/hello`。',
    },
    params: [{ name: 'id', type: 'String', en: 'The screen\'s id.', zh: '螢幕的 id。' }],
    returns: { type: 'String', en: 'The name, `tile/<id>/hello`.', zh: '訊號名稱 `tile/<id>/hello`。' },
    description: [
      {
        en: 'Its value is `{ v: 1, id, w, h, dpr, screen, css, fullscreen, wake }`: the drawing area in device pixels (what the markers are drawn in and the layout measures), the screen in device pixels, the CSS size, and whether it is fullscreen and awake. It is re-sent every second, so a camera page that opens late still hears every screen.',
        zh: '它的值是 `{ v: 1, id, w, h, dpr, screen, css, fullscreen, wake }`：繪圖區的裝置像素（標記畫在這裡，版面也量這個）、螢幕的裝置像素、CSS 尺寸，以及是否全螢幕、是否保持喚醒。每秒重送一次，所以晚開的拍照頁也聽得到每台螢幕。',
      },
    ],
    examples: [
      {
        code: `import { helloName, HELLO_RE } from '@openav/tile';

const name = helloName('phone');
document.getElementById('app').textContent = name + ' → ' + HELLO_RE.exec(name)[1];`,
        caption: { en: 'Prints tile/phone/hello → phone: the name and the id read back out of it.', zh: '印出 tile/phone/hello → phone：名稱，以及從名稱讀回來的 id。' },
      },
    ],
    related: ['HELLO_RE', 'joinTile', 'TILE_KEYS'],
    keywords: { en: ['hello', 'announce', 'roster', 'signal name'], zh: ['報到', '名單', '訊號名稱'] },
  },

  HELLO_RE: {
    group: 'tile',
    summary: {
      en: 'The pattern of a screen\'s hello signal, `/^tile\\/([\\w-]{1,64})\\/hello$/`: its first group is the screen\'s id.',
      zh: '螢幕報到訊號的樣式 `/^tile\\/([\\w-]{1,64})\\/hello$/`：第一個群組就是螢幕的 id。',
    },
    description: [
      {
        en: 'The camera page reads every signal of the room through it and keeps those that match as the list of screens.',
        zh: '拍照頁用它讀房間裡的每個訊號，符合的就留下來當作螢幕清單。',
      },
    ],
    examples: [
      {
        code: `import { HELLO_RE } from '@openav/tile';

document.getElementById('app').textContent = ['tile/laptop/hello', 'tile/markers', 'surface/main/hue']
  .map((n) => n + ': ' + (HELLO_RE.exec(n)?.[1] ?? 'not a screen')).join(' · ');`,
        caption: { en: 'Only the first name is a screen (laptop); the other two are not.', zh: '只有第一個名稱是螢幕（laptop），另外兩個不是。' },
      },
    ],
    related: ['helloName'],
    keywords: { en: ['regular expression', 'hello', 'match'], zh: ['正規表示式', '報到', '比對'] },
  },

  TILE_KEYS: {
    group: 'tile',
    summary: {
      en: 'The relay config keys the camera page answers with: `tile/roster`, `tile/mode`, `tile/layout` and `tile/show`.',
      zh: '拍照頁用來回答的中繼設定鍵：`tile/roster`、`tile/mode`、`tile/layout`、`tile/show`。',
    },
    description: [
      {
        en: '`tile/roster` is `{ grid, devices: [{ id, index, w, h }] }`, each screen\'s number (its markers) and the grid they use; `tile/mode` is `\'markers\'` or `\'show\'`; `tile/layout` is the layout; `tile/show` is `{ seed, start }`, the seed and the start on the shared clock. Config is replayed by the relay to every screen that joins later, so a reloaded screen gets all four at once.',
        zh: '`tile/roster` 是 `{ grid, devices: [{ id, index, w, h }] }`，每台螢幕的編號（它的標記）和用的格子。`tile/mode` 是 `\'markers\'` 或 `\'show\'`。`tile/layout` 是版面。`tile/show` 是 `{ seed, start }`，種子和在共同時鐘上的起點。中繼會把設定重播給每台晚到的螢幕，所以重新整理的螢幕一次就拿到這四個。',
      },
    ],
    examples: [
      {
        code: `import { TILE_KEYS } from '@openav/tile';

document.getElementById('app').textContent = Object.values(TILE_KEYS).join(', ');`,
        caption: { en: 'Prints tile/roster, tile/mode, tile/layout, tile/show.', zh: '印出 tile/roster、tile/mode、tile/layout、tile/show。' },
      },
    ],
    related: ['joinTile', 'helloName'],
    keywords: { en: ['config', 'roster', 'mode', 'layout', 'relay'], zh: ['設定', '名單', '模式', '版面', '中繼'] },
  },

  TILE_PARAMS: {
    group: 'tile',
    summary: {
      en: 'The one param a tiled world gets: `tileMarkers`, 0 to play, 1 to paint the markers for the photo.',
      zh: '拼接的世界會多出的唯一一個參數：`tileMarkers`，0 是演出，1 是畫出拍照用的標記。',
    },
    description: [
      {
        en: 'The marker layer follows the param, not the camera page directly, so the timeline, a mapped signal or the console can call for markers like for any other param (AGENTS.md rule 1). [`tileWorld()`](#tileWorld) adds it to the world\'s params unless the world already has one with that key.',
        zh: '標記圖層跟著這個參數，而不是直接跟著拍照頁，所以時間軸、對應過來的訊號或控台都能像對其他參數一樣叫出標記（AGENTS.md 規則一）。[`tileWorld()`](#tileWorld) 會把它加進世界的參數，除非世界已經有同一個鍵。',
      },
    ],
    examples: [
      {
        code: `import { TILE_PARAMS } from '@openav/tile';

const p = TILE_PARAMS[0];
document.getElementById('app').textContent = p.key + ': ' + p.min + '..' + p.max + ', ' + p.options.join(' / ');`,
        caption: { en: 'Prints tileMarkers: 0..1, show / markers.', zh: '印出 tileMarkers: 0..1, show / markers。' },
      },
    ],
    related: ['TILE_ROUTES', 'tileWorld'],
    keywords: { en: ['param', 'markers', 'tileMarkers'], zh: ['參數', '標記', 'tileMarkers'] },
  },

  TILE_ROUTES: {
    group: 'tile',
    summary: {
      en: 'The route from the camera page\'s mode to the marker param: `tile/markers` → `tileMarkers`. Spread it into `createShow({ routes })`.',
      zh: '從拍照頁的模式到標記參數的路由：`tile/markers` → `tileMarkers`。展開放進 `createShow({ routes })`。',
    },
    description: [
      {
        en: 'When the camera page presses Markers the signal `tile/markers` goes to 1 and the route takes `tileMarkers`; Play puts both back to 0. It follows the framework\'s rule for who holds a value: a slider moved by hand on one screen\'s console holds that screen until the camera page really changes mode, and the same mode said again does not take it back.',
        zh: '拍照頁按下「標記」時，訊號 `tile/markers` 變成 1，路由接手 `tileMarkers`。按「演出」兩個都回到 0。它照框架「誰握住數值」的規則走：在某台螢幕的控台上用手推過的滑桿，會握住那一台，直到拍照頁真的換了模式，同一個模式再說一次並不會把它搶回來。',
      },
    ],
    examples: [
      {
        code: `import { Signals, Params } from '@openav/core';
import { Mapper } from '@openav/mapping';
import { TILE_PARAMS, TILE_ROUTES } from '@openav/tile';

const signals = new Signals(), params = new Params([...TILE_PARAMS]);
signals.define('tile/markers', { min: 0, max: 1 });
const mapper = new Mapper({ signals, params, base: () => ({ tileMarkers: 0 }) });
for (const r of TILE_ROUTES) mapper.addRoute(r);
signals.set('tile/markers', 1); mapper.update(1 / 60);
document.getElementById('app').textContent = 'tileMarkers = ' + params.resolve({ tileMarkers: 0 }).tileMarkers;`,
        caption: { en: 'The camera page\'s "markers" (tile/markers = 1) reaches the param: prints tileMarkers = 1.', zh: '拍照頁的「標記」（tile/markers = 1）到了參數：印出 tileMarkers = 1。' },
      },
    ],
    related: ['TILE_PARAMS', 'tileWorld', 'joinTile'],
    keywords: { en: ['route', 'mapping', 'markers', 'camera page'], zh: ['路由', '映射', '標記', '拍照頁'] },
  },

  // ------------------------------------------------------------------------------------------------ the world
  tileWorld: {
    group: 'tile',
    summary: {
      en: 'Wraps any world so it plays across the screens: adds the `tileMarkers` param and hands the world `io.tile`, with the view, the shared time and the seed.',
      zh: '把任何一個世界包起來，讓它在多台螢幕上一起演：加上 `tileMarkers` 參數，並把 `io.tile` 交給世界，裡面有 view、共同時間和種子。',
    },
    params: [
      { name: 'world', type: 'Object', en: 'The world to wrap (`{ name, params, init, update, render, dispose }`). It is not changed.', zh: '要包的世界（`{ name, params, init, update, render, dispose }`）。它本身不會被改動。' },
      { name: 'tile', type: 'Object', en: 'What [`joinTile()`](#joinTile) returned.', zh: '[`joinTile()`](#joinTile) 回傳的東西。' },
    ],
    returns: {
      type: 'Object',
      en: 'A world: the same name and params plus `tileMarkers`; `init(ctx)` gets `ctx.tile` and `update(dt, state, io)` gets `io.tile`; `inner` is the world you gave.',
      zh: '一個世界：名字和參數一樣，多了 `tileMarkers`。`init(ctx)` 拿到 `ctx.tile`，`update(dt, state, io)` 拿到 `io.tile`。`inner` 是你給的那個世界。',
    },
    description: [
      {
        en: 'Every frame the wrapper shows or hides the marker layer from `state.tileMarkers`, then calls the world. The world draws in canvas units through `io.tile.view` (`view.apply2d(ctx, pixelRatio)` or `view.applyP5(sk)`), and computes from `io.tile.time()` and `io.tile.seed`: that is the one place a tiled world reads a clock, and it is the shared one.',
        zh: '每一幀，包裝先依 `state.tileMarkers` 顯示或隱藏標記圖層，再呼叫世界。世界透過 `io.tile.view` 用畫布單位畫（`view.apply2d(ctx, pixelRatio)` 或 `view.applyP5(sk)`），並從 `io.tile.time()` 和 `io.tile.seed` 算：這是拼接的世界唯一讀時鐘的地方，而且讀的是共同的那個。',
      },
    ],
    examples: [
      {
        code: `import { tileWorld } from '@openav/tile';

const shown = [];
const tile = { mode: 'show', markers: (on) => shown.push(on) };      // what joinTile() returns, reduced to what the wrapper calls
const world = { name: 'dot', params: [{ key: 'size', min: 0, max: 1, def: 0.3 }], update(dt, s, io) { this.t = io.tile.mode; } };
const tiled = tileWorld(world, tile);
tiled.update(1 / 60, { size: 0.3, tileMarkers: 1 }, {});
document.getElementById('app').textContent = tiled.params.map((p) => p.key).join(', ') + ' · markers shown: ' + shown[0];`,
        caption: { en: 'Prints size, tileMarkers · markers shown: true: the param was added, and a state of 1 calls for the markers.', zh: '印出 size, tileMarkers · markers shown: true：參數加上去了，狀態是 1 時就叫出標記。' },
      },
    ],
    related: ['joinTile', 'TILE_PARAMS', 'TILE_ROUTES', 'tileView'],
    keywords: { en: ['world', 'wrap', 'tiled world', 'io.tile', 'shared time', 'seed'], zh: ['世界', '包裝', '拼接的世界', 'io.tile', '共同時間', '種子'] },
  },

  // ------------------------------------------------------------------------------------------------ the view
  tileView: {
    group: 'tile',
    summary: {
      en: 'Which piece of the shared canvas one screen draws: the transform from canvas units to its pixels, for a 2D canvas, p5 or CSS.',
      zh: '某一台螢幕要畫共同畫布的哪一塊：從畫布單位到它的像素的轉換，可以給 2D 畫布、p5 或 CSS 用。',
    },
    params: [
      { name: 'layout', type: 'Object', en: 'A layout from [`solveLayout()`](#solveLayout).', zh: '[`solveLayout()`](#solveLayout) 算出來的版面。' },
      { name: 'id', type: 'String', en: 'The screen\'s id in it.', zh: '螢幕在版面裡的 id。' },
    ],
    returns: {
      type: 'Object',
      en: '`{ ok: true, id, device: { w, h }, canvas: { w, h }, toCanvas, toDevice, scale, angle, polygon, bounds, point(x, y), fromDevice(x, y), matrix(pixelRatio), apply2d(ctx, pixelRatio), applyP5(sk), css(dpr), visible(x, y, r) }`, or `{ ok: false, reason }` when the screen is not in the layout or is of a kind this version cannot draw.',
      zh: '`{ ok: true, id, device: { w, h }, canvas: { w, h }, toCanvas, toDevice, scale, angle, polygon, bounds, point(x, y), fromDevice(x, y), matrix(pixelRatio), apply2d(ctx, pixelRatio), applyP5(sk), css(dpr), visible(x, y, r) }`，或是螢幕不在版面裡、或是這一版還畫不了的種類時，`{ ok: false, reason }`。',
    },
    description: [
      {
        en: 'The canvas is measured in the pixels of the reference screen and includes the gaps and bezels between screens, so something that leaves one screen travels behind the bezel and comes out on the next one where it would really be, at the same physical size. `scale` is device pixels per canvas unit, `angle` how far the screen is turned (radians), `bounds` the part of the canvas it covers.',
        zh: '畫布用基準螢幕的像素來量，而且包含螢幕之間的空隙和邊框，所以離開一台螢幕的東西會在邊框後面走，從下一台它真正該出現的位置出來，實際大小也一樣。`scale` 是每個畫布單位多少裝置像素，`angle` 是螢幕轉了多少（弧度），`bounds` 是它蓋住畫布的哪一塊。',
      },
      {
        en: 'A 2D canvas: `view.apply2d(ctx, canvas.width / view.device.w)` and draw in canvas units. p5: `view.applyP5(sk)` at the top of `draw()`. An element: `transform: view.css(devicePixelRatio)` with `transform-origin: 0 0`. `view.visible(x, y, r)` is a cheap test to skip what is not on this screen. It never throws.',
        zh: '2D 畫布：`view.apply2d(ctx, canvas.width / view.device.w)`，之後用畫布單位畫。p5：在 `draw()` 最前面 `view.applyP5(sk)`。HTML 元素：`transform: view.css(devicePixelRatio)` 加上 `transform-origin: 0 0`。`view.visible(x, y, r)` 是個便宜的測試，用來跳過不在這台螢幕上的東西。它從不丟出錯誤。',
      },
    ],
    examples: [
      {
        code: `import { tileView } from '@openav/tile';

// two screens of 400×300: "left" at the origin, "right" turned 90° and 500 units to the right
const layout = { version: 1, reference: 'left', canvas: { w: 800, h: 400 }, devices: [
  { id: 'left', w: 400, h: 300, kind: 'planar', similarity: { a: 1, b: 0, tx: 0, ty: 0 }, matrix3x3: [1, 0, 0, 0, 1, 0, 0, 0, 1] },
  { id: 'right', w: 400, h: 300, kind: 'planar', similarity: { a: 0, b: 1, tx: 800, ty: 0 }, matrix3x3: [0, -1, 800, 1, 0, 0, 0, 0, 1] },
] };
const v = tileView(layout, 'right');
const ctx = document.getElementById('c').getContext('2d');
v.apply2d(ctx);                                         // from here on, canvas units
ctx.fillStyle = '#7ea6ff'; ctx.fillRect(0, 0, 800, 400);
ctx.fillStyle = '#ff7a59'; ctx.beginPath(); ctx.arc(650, 100, 40, 0, Math.PI * 2); ctx.fill();
document.getElementById('app').textContent = 'angle ' + (v.angle * 180 / Math.PI) + '°, the dot at ' + v.point(650, 100).join(', ') + ' on this screen';`,
        caption: { en: 'The "right" screen\'s piece: blue, with the orange dot at canvas 650,100 drawn at 100,150 of its own pixels, turned with it.', zh: '「right」那台螢幕的那一塊：藍色，畫布 650,100 的橘色圓點畫在它自己像素的 100,150，跟著它一起轉。' },
      },
    ],
    related: ['soloView', 'solveLayout', 'tileWorld'],
    keywords: { en: ['view', 'viewport', 'transform', 'setTransform', 'applyMatrix', 'canvas units', 'bezel'], zh: ['視窗', '轉換', 'setTransform', 'applyMatrix', '畫布單位', '邊框'] },
  },

  soloView: {
    group: 'tile',
    summary: {
      en: 'A screen on its own: the view where the canvas is this screen, one canvas unit per device pixel. What a tile draws with before a photo placed it.',
      zh: '單獨一台螢幕：畫布就是這台螢幕、一個畫布單位等於一個裝置像素的 view。螢幕被照片定位之前就用它畫。',
    },
    params: [
      { name: 'w', type: 'Number', en: 'The screen\'s width in device pixels.', zh: '螢幕的寬，裝置像素。' },
      { name: 'h', type: 'Number', en: 'Its height.', zh: '它的高。' },
      { name: 'id', type: 'String', optional: true, default: "'solo'", en: 'The id the view carries.', zh: 'view 帶著的 id。' },
    ],
    returns: { type: 'Object', en: 'The same shape as a [`tileView()`](#tileView), with an identity transform.', zh: '跟 [`tileView()`](#tileView) 一樣的形狀，轉換是單位矩陣。' },
    description: [
      {
        en: 'A world written for tiles runs unchanged on one screen with it: the page of example 30 without `?room=` is one screen with the console, on its own time.',
        zh: '為拼接寫的世界，有了它就能原封不動地在一台螢幕上跑：範例 30 的頁面沒有 `?room=` 時，就是有控台、用自己時間的一台螢幕。',
      },
    ],
    examples: [
      {
        code: `import { soloView } from '@openav/tile';

const v = soloView(400, 300);
document.getElementById('app').textContent = 'canvas ' + v.canvas.w + '×' + v.canvas.h + ', scale ' + v.scale + ', visible(390, 10, 20): ' + v.visible(390, 10, 20);`,
        caption: { en: 'Prints canvas 400×300, scale 1, visible(390, 10, 20): true.', zh: '印出 canvas 400×300, scale 1, visible(390, 10, 20): true。' },
      },
    ],
    related: ['tileView'],
    keywords: { en: ['solo', 'single screen', 'fallback', 'identity'], zh: ['單機', '單一螢幕', '退回', '單位矩陣'] },
  },

  // ------------------------------------------------------------------------------------------------ the clock
  ClockSync: {
    group: 'tile',
    summary: {
      en: 'One time for every screen from a few pings: keeps the offset of the quickest round trip of the last minute, NTP simplified.',
      zh: '用幾次 ping 讓每台螢幕有同一個時間：留下最近一分鐘裡來回最快那次的偏移，簡化版的 NTP。',
    },
    params: [
      { name: 'now', type: 'Function', optional: true, default: 'performance.timeOrigin + performance.now()', en: 'This device\'s clock in ms. The default never jumps when the system clock is set.', zh: '這台裝置的時鐘，毫秒。預設值在系統時間被調整時不會跳。' },
      { name: 'window', type: 'Number', optional: true, default: '60000', en: 'Only samples this recent count, ms: clocks drift apart by a few ms a minute.', zh: '只算這麼近的樣本，毫秒：時鐘每分鐘會互相漂開幾毫秒。' },
      { name: 'keep', type: 'Number', optional: true, default: '40', en: 'At most this many samples.', zh: '最多留這麼多個樣本。' },
    ],
    description: [
      {
        en: '`add(t0, server, t1)` files one ping: it left at `t0` (this clock), the relay read its clock as `server`, the pong came back at `t1`. If the trips out and back took as long as each other, the relay read its clock at the midpoint, so the offset is `server − (t0 + t1) / 2`, and the error is at most half the round trip. A phone busy drawing answers late and a crowded wifi queues, but neither ever makes a trip shorter than it was, so the shortest one is trusted.',
        zh: '`add(t0, server, t1)` 記下一次 ping：它在 `t0`（這邊的時鐘）出發，中繼讀到自己的時鐘是 `server`，回應在 `t1` 回來。如果去和回花的時間一樣，中繼就是在中點讀時鐘，所以偏移是 `server − (t0 + t1) / 2`，誤差最多是來回的一半。忙著畫圖的手機會晚回答、擠的 wifi 會排隊，但它們都不會讓一趟變得比實際更短，所以信任最短的那次。',
      },
      {
        en: '`now()` is the shared clock in ms, `offset` the relay\'s clock minus this one, `rtt` the round trip of the trusted sample (the offset is good to half of it), `ready` true after the first pong, `local()` this device\'s own clock.',
        zh: '`now()` 是共同的時鐘（毫秒），`offset` 是中繼的時鐘減掉這邊的，`rtt` 是被信任那個樣本的來回時間（偏移準到它的一半），`ready` 在第一個回應之後是 true，`local()` 是這台裝置自己的時鐘。',
      },
    ],
    notes: [
      {
        en: 'It is not `@openav/sync`. Sync makes a follower page chase a leader\'s timeline frame by frame; ClockSync only agrees on what time it is, and each screen computes its own frame from it.',
        zh: '它不是 `@openav/sync`。sync 讓從屬頁面一幀一幀追著主控端的時間軸，ClockSync 只是對齊現在幾點，每台螢幕再各自用它算自己的畫面。',
      },
    ],
    examples: [
      {
        code: `import { ClockSync } from '@openav/tile';

let mine = 1000;                                        // this device's clock, by hand
const clock = new ClockSync({ now: () => mine });
clock.add(1000, 5060, 1100);                            // a slow trip: 100 ms round trip
clock.add(1200, 5205, 1210);                            // a quick one: 10 ms, the relay is 4000 ms ahead
mine = 1300;
document.getElementById('app').textContent = 'offset ' + clock.offset + ' ms, ±' + clock.rtt / 2 + ' ms, now ' + clock.now();`,
        caption: { en: 'Prints offset 4000 ms, ±5 ms, now 5300: the quick round trip is the one trusted.', zh: '印出 offset 4000 ms, ±5 ms, now 5300：被信任的是快的那次來回。' },
      },
    ],
    related: ['clockSample', 'estimateOffset', 'TileLink'],
    keywords: { en: ['clock', 'time sync', 'ntp', 'offset', 'round trip', 'latency'], zh: ['時鐘', '對時', 'NTP', '偏移', '來回', '延遲'] },
  },

  clockSample: {
    group: 'tile',
    summary: {
      en: 'One ping as a sample: `{ rtt, offset, at }`, or null when the numbers cannot be one (a pong from before it was sent).',
      zh: '把一次 ping 變成一個樣本：`{ rtt, offset, at }`，數字不可能是一次 ping 時（回應比送出還早）回傳 null。',
    },
    params: [
      { name: 't0', type: 'Number', en: 'When the ping left, this device\'s ms.', zh: 'ping 出發的時間，這台裝置的毫秒。' },
      { name: 'server', type: 'Number', en: 'The relay\'s clock in the pong, ms.', zh: '回應裡中繼的時鐘，毫秒。' },
      { name: 't1', type: 'Number', en: 'When the pong came back, this device\'s ms.', zh: '回應回來的時間，這台裝置的毫秒。' },
    ],
    returns: { type: 'Object | null', en: '`rtt = t1 − t0`, `offset = server − (t0 + t1) / 2`, `at = t1`.', zh: '來回 `rtt = t1 − t0`、偏移 `offset = server − (t0 + t1) / 2`、時間 `at = t1`。' },
    description: [{ en: 'What [`ClockSync`](#ClockSync) adds for each pong.', zh: '[`ClockSync`](#ClockSync) 每收到一個回應就加進去的東西。' }],
    examples: [
      {
        code: `import { clockSample } from '@openav/tile';

document.getElementById('app').textContent = JSON.stringify(clockSample(100, 5130, 140)) + ' · ' + clockSample(140, 5130, 100);`,
        caption: { en: 'Prints {"rtt":40,"offset":5010,"at":140} · null: the second pong would have come back before it left.', zh: '印出 {"rtt":40,"offset":5010,"at":140} · null：第二個回應會比它出發還早回來。' },
      },
    ],
    related: ['ClockSync', 'estimateOffset'],
    keywords: { en: ['sample', 'ping', 'round trip'], zh: ['樣本', 'ping', '來回'] },
  },

  estimateOffset: {
    group: 'tile',
    summary: {
      en: 'The offset of the sample with the shortest round trip: `{ offset, rtt, n }`, or null with no usable sample.',
      zh: '來回最短那個樣本的偏移：`{ offset, rtt, n }`，沒有能用的樣本時是 null。',
    },
    params: [{ name: 'samples', type: 'Object[]', en: 'Samples from [`clockSample()`](#clockSample); anything else is skipped.', zh: '[`clockSample()`](#clockSample) 做出來的樣本，其他的會被略過。' }],
    returns: { type: 'Object | null', en: '`n` is how many samples counted.', zh: '`n` 是算進去的樣本數。' },
    description: [{ en: 'A trip is never shorter than it really was, so the shortest one is the closest to the truth.', zh: '一趟從來不會比實際更短，所以最短的那趟最接近真相。' }],
    examples: [
      {
        code: `import { estimateOffset } from '@openav/tile';

const best = estimateOffset([{ rtt: 90, offset: 3955 }, { rtt: 8, offset: 4001 }, { rtt: 30, offset: 3990 }, null]);
document.getElementById('app').textContent = JSON.stringify(best);`,
        caption: { en: 'Prints {"offset":4001,"rtt":8,"n":3}: the 8 ms trip wins, and the null was skipped.', zh: '印出 {"offset":4001,"rtt":8,"n":3}：8 ms 那趟勝出，null 被略過。' },
      },
    ],
    related: ['ClockSync', 'clockSample'],
    keywords: { en: ['offset', 'shortest round trip', 'ntp'], zh: ['偏移', '最短來回', 'NTP'] },
  },

  // ------------------------------------------------------------------------------------------------ the markers
  markerGrid: {
    group: 'tile',
    summary: {
      en: 'Where each marker sits on a screen of w × h pixels: square cells, `short` of them across the short side, at most 50, every corner on a whole pixel.',
      zh: '在 w × h 像素的螢幕上每個標記放在哪裡：正方形的格子，短邊排 `short` 個，最多 50 個，每個角都在整數像素上。',
    },
    params: [
      { name: 'w', type: 'Number', en: 'The screen\'s width in device pixels.', zh: '螢幕的寬，裝置像素。' },
      { name: 'h', type: 'Number', en: 'Its height.', zh: '它的高。' },
      { name: 'short', type: 'Number', optional: true, default: '4', en: 'Markers across the short side.', zh: '短邊排幾個標記。' },
      { name: 'fill', type: 'Number', optional: true, default: '0.72', en: 'The share of a cell the marker takes; the rest is its white quiet zone.', zh: '標記佔一格的比例，剩下的是它周圍的白邊。' },
    ],
    returns: {
      type: 'Object',
      en: '`{ cell, nx, ny, module, size, markers: [{ cell, corners: [[x, y] × 4] }] }`: the cell size, the grid, a module\'s pixels, a marker\'s pixels, and each marker\'s corners in OpenCV\'s order (top-left, top-right, bottom-right, bottom-left).',
      zh: '`{ cell, nx, ny, module, size, markers: [{ cell, corners: [[x, y] × 4] }] }`：格子的大小、格子的排法、一個模組幾像素、一個標記幾像素，以及每個標記照 OpenCV 順序（左上、右上、右下、左下）排的四個角。',
    },
    description: [
      {
        en: 'Many small markers rather than one big one: screens overlap, hands and phones cover corners, and a phone lies at any angle. Each marker carries its screen and cell number and four corners, so any four in view place the whole screen. The grid is the same function on both ends: the tile draws `markerGrid(w, h)` and the camera page computes it again from the w and h the tile reported.',
        zh: '用很多小標記而不是一個大的：螢幕會疊在一起、手和手機會蓋住角落、手機可能用任何角度放。每個標記都帶著它的螢幕編號、格子編號和四個角，所以畫面裡任何四個就能定位整台螢幕。兩邊用的是同一個函式：螢幕畫 `markerGrid(w, h)`，拍照頁再用螢幕回報的 w、h 算一次。',
      },
    ],
    examples: [
      {
        code: `import { markerGrid } from '@openav/tile';

const phone = markerGrid(1170, 2532), laptop = markerGrid(2560, 1600);
document.getElementById('app').textContent =
  'phone ' + phone.nx + '×' + phone.ny + ' markers of ' + phone.size + ' px · laptop ' + laptop.nx + '×' + laptop.ny + ' of ' + laptop.size + ' px';`,
        caption: { en: 'Prints phone 4×9 markers of 189 px · laptop 6×4 of 259 px: four across the short side, at most 50, a whole number of pixels each.', zh: '印出 phone 4×9 markers of 189 px · laptop 6×4 of 259 px：短邊排四個，最多 50 個，每個都是整數像素。' },
      },
    ],
    related: ['drawMarkers', 'markerId', 'correspondences', 'GRID_DEFAULTS'],
    keywords: { en: ['marker grid', 'aruco', 'charuco', 'layout of markers', 'cells'], zh: ['標記格子', 'ArUco', 'ChArUco', '標記排列', '格子'] },
  },

  markerId: {
    group: 'tile',
    summary: {
      en: 'The marker that says "screen #device, cell #cell": `device × 50 + cell`. Throws a RangeError outside 0…19 and 0…49.',
      zh: '代表「第 device 號螢幕、第 cell 格」的標記：`device × 50 + cell`。超出 0…19 和 0…49 會丟出 RangeError。',
    },
    params: [
      { name: 'device', type: 'Number', en: 'The screen\'s number, 0 to 19 (the camera page hands them out).', zh: '螢幕的編號，0 到 19（拍照頁發的）。' },
      { name: 'cell', type: 'Number', en: 'The cell, 0 to 49.', zh: '格子，0 到 49。' },
    ],
    returns: { type: 'Number', en: 'A DICT_5X5_1000 id, 0 to 999.', zh: 'DICT_5X5_1000 的 id，0 到 999。' },
    description: [{ en: 'One dictionary, split into 20 screens of 50 markers: the id alone says whose corner it is.', zh: '一本字典分給 20 台螢幕、每台 50 個標記：光看 id 就知道是誰的角。' }],
    examples: [
      {
        code: `import { markerId, decodeMarkerId } from '@openav/tile';

const id = markerId(2, 7);
document.getElementById('app').textContent = id + ' → ' + JSON.stringify(decodeMarkerId(id));`,
        caption: { en: 'Prints 107 → {"device":2,"cell":7}.', zh: '印出 107 → {"device":2,"cell":7}。' },
      },
    ],
    related: ['decodeMarkerId', 'PER_DEVICE', 'MAX_DEVICES'],
    keywords: { en: ['marker id', 'aruco id', 'encode'], zh: ['標記 id', 'ArUco id', '編碼'] },
  },

  decodeMarkerId: {
    group: 'tile',
    summary: {
      en: 'The screen and cell a marker id stands for, `{ device, cell }`, or null for an id outside the dictionary.',
      zh: '一個標記 id 代表哪台螢幕、哪一格，`{ device, cell }`，字典以外的 id 回傳 null。',
    },
    params: [{ name: 'id', type: 'Number', en: 'A marker id from the detector.', zh: '偵測器找到的標記 id。' }],
    returns: { type: 'Object | null', en: 'The screen\'s number and the cell, `{ device, cell }`.', zh: '螢幕編號和格子，`{ device, cell }`。' },
    description: [{ en: 'The reverse of [`markerId()`](#markerId).', zh: '[`markerId()`](#markerId) 的反向。' }],
    examples: [
      {
        code: `import { decodeMarkerId } from '@openav/tile';

document.getElementById('app').textContent = [0, 999, 1000, 2.5].map((id) => id + ': ' + JSON.stringify(decodeMarkerId(id))).join(' · ');`,
        caption: { en: 'Prints 0 and 999 as screens 0 and 19; 1000 and 2.5 are null.', zh: '0 和 999 印成第 0 和第 19 台螢幕，1000 和 2.5 是 null。' },
      },
    ],
    related: ['markerId', 'correspondences'],
    keywords: { en: ['decode', 'marker id'], zh: ['解碼', '標記 id'] },
  },

  correspondences: {
    group: 'tile',
    summary: {
      en: 'Sorts the markers found in a photo onto their screens: each marker\'s corners in the screen\'s own pixels next to the same corners in the photo.',
      zh: '把照片裡找到的標記分給各自的螢幕：每個標記在螢幕自己像素裡的四個角，旁邊是同樣四個角在照片裡的位置。',
    },
    params: [
      { name: 'found', type: 'Object[]', en: 'What the detector found: `[{ id, corners: [[x, y] × 4] }]` in photo pixels, OpenCV\'s corner order.', zh: '偵測器找到的：`[{ id, corners: [[x, y] × 4] }]`，照片像素，OpenCV 的角順序。' },
      { name: 'roster', type: 'Object[]', en: 'The screens and their numbers: `[{ id, index, w, h }]`.', zh: '螢幕和它們的編號：`[{ id, index, w, h }]`。' },
      { name: 'grid', type: 'Object', optional: true, default: '{}', en: 'The grid options the screens drew with (`{ short, fill }`).', zh: '螢幕畫標記時用的格子選項（`{ short, fill }`）。' },
    ],
    returns: {
      type: 'Object',
      en: '`{ devices: [{ id, index, w, h, markers: [{ marker, cell, device, photo }] }], unknown, duplicate }`, ready for [`solveLayout()`](#solveLayout).',
      zh: '`{ devices: [{ id, index, w, h, markers: [{ marker, cell, device, photo }] }], unknown, duplicate }`，可以直接交給 [`solveLayout()`](#solveLayout)。',
    },
    description: [
      {
        en: '`unknown` lists ids of no screen in the roster, or of a cell that screen does not have. `duplicate` lists a cell seen twice (a reflection, or two screens showing one number): both copies are dropped, since either may be the wrong one.',
        zh: '`unknown` 列出不屬於名單上任何螢幕的 id，或那台螢幕沒有的格子。`duplicate` 列出被看到兩次的格子（反光，或兩台螢幕顯示同一個編號）：兩個都丟掉，因為哪一個都可能是錯的。',
      },
    ],
    examples: [
      {
        code: `import { correspondences, markerGrid, markerId } from '@openav/tile';

const roster = [{ id: 'phone', index: 0, w: 1170, h: 2532 }];
const m = markerGrid(1170, 2532).markers[3];
const found = [{ id: markerId(0, 3), corners: m.corners.map(([x, y]) => [x / 2 + 100, y / 2 + 50]) }, { id: 900, corners: m.corners }];
const r = correspondences(found, roster);
document.getElementById('app').textContent = r.devices[0].markers.length + ' marker on phone, unknown ' + JSON.stringify(r.unknown);`,
        caption: { en: 'Prints 1 marker on phone, unknown [900]: id 900 belongs to screen #18, which is not in the room.', zh: '印出 1 marker on phone, unknown [900]：id 900 屬於第 18 號螢幕，它不在房間裡。' },
      },
    ],
    related: ['solveLayout', 'markerGrid', 'detectMarkers'],
    keywords: { en: ['correspondences', 'matching', 'corners', 'photo'], zh: ['對應點', '配對', '角', '照片'] },
  },

  drawMarkers: {
    group: 'tile',
    summary: {
      en: 'Paints screen #index\'s markers on a 2D canvas the size of the screen: a white page, black markers, an optional label in the bottom margin.',
      zh: '在跟螢幕一樣大的 2D 畫布上畫出第 index 號螢幕的標記：白色的底、黑色的標記，可以在下方空白加一行小字。',
    },
    params: [
      { name: 'ctx', type: 'CanvasRenderingContext2D', en: 'A context that draws in device pixels.', zh: '用裝置像素畫的 context。' },
      { name: 'w', type: 'Number', en: 'The width in device pixels.', zh: '寬，裝置像素。' },
      { name: 'h', type: 'Number', en: 'The height.', zh: '高。' },
      { name: 'index', type: 'Number', en: 'The screen\'s number, 0 to 19.', zh: '螢幕的編號，0 到 19。' },
      { name: 'grid', type: 'Object', optional: true, default: '{}', en: 'Grid options (`{ short, fill }`), the same the camera page is told.', zh: '格子選項（`{ short, fill }`），要跟拍照頁拿到的一樣。' },
      { name: 'label', type: 'String', optional: true, default: "''", en: 'Small text in the bottom margin, where it cannot touch a marker.', zh: '下方空白的小字，碰不到任何標記的地方。' },
    ],
    returns: { type: 'Object', en: 'The grid it drew ([`markerGrid()`](#markerGrid)).', zh: '它畫的格子（[`markerGrid()`](#markerGrid)）。' },
    description: [
      {
        en: 'The only part of the markers that needs a browser. The bits come from `dict.js`, extracted from OpenCV, so the screens never load OpenCV: only the camera page does, to find them again.',
        zh: '標記裡唯一需要瀏覽器的部分。位元來自從 OpenCV 抽出來的 `dict.js`，所以螢幕從來不載 OpenCV：只有拍照頁載，用來把它們找回來。',
      },
    ],
    examples: [
      {
        code: `import { drawMarkers } from '@openav/tile';

const ctx = document.getElementById('c').getContext('2d');   // 400×300
const g = drawMarkers(ctx, { w: 400, h: 300, index: 1, label: '#1 · demo' });
document.getElementById('app').textContent = g.markers.length + ' markers of ' + g.size + ' px';`,
        caption: { en: 'Screen #1\'s markers fill the canvas, black on white, with "#1 · demo" under them.', zh: '第 1 號螢幕的標記鋪滿畫布，白底黑標記，下面寫著「#1 · demo」。' },
      },
    ],
    related: ['markerGrid', 'markerBits', 'joinTile'],
    keywords: { en: ['draw markers', 'aruco', 'calibration pattern', 'canvas'], zh: ['畫標記', 'ArUco', '校正圖', '畫布'] },
  },

  GRID_DEFAULTS: {
    group: 'tile',
    summary: {
      en: 'The marker grid\'s defaults: `{ short: 4, fill: 0.72 }`, four markers across the short side, each taking 72% of its cell.',
      zh: '標記格子的預設值：`{ short: 4, fill: 0.72 }`，短邊排四個標記，每個佔它那一格的 72%。',
    },
    description: [
      {
        en: 'Four across keeps a marker large enough to read on a phone lying among a laptop and a tablet in one photo. The camera page sends the grid it uses in `tile/roster`, so a tile and the camera page always agree.',
        zh: '短邊四個，讓一支手機跟筆電、平板一起入鏡時，標記還是大到讀得出來。拍照頁會在 `tile/roster` 裡送出它用的格子，所以螢幕和拍照頁永遠一致。',
      },
    ],
    examples: [
      {
        code: `import { GRID_DEFAULTS } from '@openav/tile';

document.getElementById('app').textContent = JSON.stringify(GRID_DEFAULTS);`,
        caption: { en: 'Prints {"short":4,"fill":0.72}.', zh: '印出 {"short":4,"fill":0.72}。' },
      },
    ],
    related: ['markerGrid'],
    keywords: { en: ['defaults', 'grid'], zh: ['預設值', '格子'] },
  },

  PER_DEVICE: {
    group: 'tile',
    summary: { en: 'Markers a screen can have: 50.', zh: '一台螢幕最多幾個標記：50。' },
    description: [{ en: 'Marker ids run `index × 50` to `index × 50 + 49`.', zh: '標記 id 從 `index × 50` 到 `index × 50 + 49`。' }],
    examples: [{ code: `import { PER_DEVICE } from '@openav/tile';

document.getElementById('app').textContent = PER_DEVICE;`, caption: { en: 'Prints 50.', zh: '印出 50。' } }],
    related: ['MAX_DEVICES', 'markerId'],
    keywords: { en: ['markers per screen'], zh: ['每台螢幕的標記數'] },
  },

  MAX_DEVICES: {
    group: 'tile',
    summary: { en: 'Screens one table can have: 20, the 1000 markers of DICT_5X5_1000 over 50 a screen.', zh: '一張桌子最多幾台螢幕：20，DICT_5X5_1000 的 1000 個標記、每台 50 個。' },
    description: [{ en: 'A 21st screen gets the number of the screen the camera page heard from longest ago.', zh: '第 21 台螢幕會拿到拍照頁最久沒聽到的那台的編號。' }],
    examples: [{ code: `import { MAX_DEVICES } from '@openav/tile';

document.getElementById('app').textContent = MAX_DEVICES;`, caption: { en: 'Prints 20.', zh: '印出 20。' } }],
    related: ['PER_DEVICE', 'markerId'],
    keywords: { en: ['maximum screens', 'limit'], zh: ['最多螢幕數', '上限'] },
  },

  DICT_NAME: {
    group: 'tile',
    summary: { en: 'The ArUco dictionary the markers come from: `DICT_5X5_1000`, the name OpenCV knows it by.', zh: '標記來自哪一本 ArUco 字典：`DICT_5X5_1000`，也就是 OpenCV 認得的名字。' },
    description: [
      {
        en: 'Five by five rather than four by four: with rotations counted, two of its markers differ in at least 5 bits (tests/tile.test.js recomputes it from the table), where two DICT_4X4_1000 markers can differ in 2, and a misread id puts four corners on the wrong screen.',
        zh: '用 5×5 而不是 4×4：算上旋轉，它的任兩個標記至少差 5 個位元（tests/tile.test.js 從表格重新算過），DICT_4X4_1000 的兩個標記卻可能只差 2 個，而讀錯一個 id 就會把四個角放到錯的螢幕上。',
      },
    ],
    examples: [{ code: `import { DICT_NAME } from '@openav/tile';

document.getElementById('app').textContent = DICT_NAME;`, caption: { en: 'Prints DICT_5X5_1000.', zh: '印出 DICT_5X5_1000。' } }],
    related: ['markerBits', 'markerCode', 'detectMarkers'],
    keywords: { en: ['aruco dictionary', 'opencv', '5x5'], zh: ['ArUco 字典', 'OpenCV', '5x5'] },
  },

  markerCode: {
    group: 'tile',
    summary: { en: 'The 25 bits of marker `id` as one number, the top-left bit the most significant. Throws a RangeError outside 0…999.', zh: '標記 `id` 的 25 個位元合成一個數字，左上那個位元最高位。超出 0…999 會丟出 RangeError。' },
    params: [{ name: 'id', type: 'Number', en: 'A marker id, 0 to 999.', zh: '標記 id，0 到 999。' }],
    returns: { type: 'Number', en: '0 to 2²⁵ − 1; 1 is a white module.', zh: '0 到 2²⁵ − 1，1 是白色的模組。' },
    description: [
      {
        en: 'The table in `dict.js` was drawn out of OpenCV 4.12.0 with `cv.generateImageMarker` at one pixel per module, so it is what OpenCV\'s own detector expects to find.',
        zh: '`dict.js` 裡的表格是用 OpenCV 4.12.0 的 `cv.generateImageMarker` 以一個模組一像素畫出來再讀回來的，所以就是 OpenCV 自己的偵測器預期找到的樣子。',
      },
    ],
    examples: [{ code: `import { markerCode } from '@openav/tile';

document.getElementById('app').textContent = markerCode(0).toString(2).padStart(25, '0');`, caption: { en: 'Prints marker 0\'s 25 bits as ones and zeros.', zh: '把第 0 號標記的 25 個位元印成 1 和 0。' } }],
    related: ['markerBits', 'DICT_NAME'],
    keywords: { en: ['bits', 'marker code'], zh: ['位元', '標記碼'] },
  },

  markerBits: {
    group: 'tile',
    summary: { en: 'The bits of marker `id` as five rows of five 0s and 1s, top row first: what to paint inside the black border.', zh: '標記 `id` 的位元，五列、每列五個 0 和 1，從最上面一列開始：黑框裡面要畫的東西。' },
    params: [{ name: 'id', type: 'Number', en: 'A marker id, 0 to 999.', zh: '標記 id，0 到 999。' }],
    returns: { type: 'number[][]', en: '1 is white.', zh: '1 是白色。' },
    description: [{ en: 'A marker is 7 × 7 modules: a black border around these 5 × 5. [`drawMarkers()`](#drawMarkers) paints them.', zh: '一個標記是 7 × 7 個模組：黑框圍著這 5 × 5。[`drawMarkers()`](#drawMarkers) 用它畫。' }],
    examples: [
      {
        code: `import { markerBits } from '@openav/tile';

const ctx = document.getElementById('c').getContext('2d'), m = 30;
ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 7 * m, 7 * m);
ctx.fillStyle = '#fff';
markerBits(42).forEach((row, y) => row.forEach((bit, x) => { if (bit) ctx.fillRect((x + 1) * m, (y + 1) * m, m, m); }));`,
        caption: { en: 'Marker 42, drawn large: a black border and its white modules.', zh: '把第 42 號標記畫大：黑框和它的白色模組。' },
      },
    ],
    related: ['markerCode', 'drawMarkers'],
    keywords: { en: ['bits', 'marker image', 'aruco'], zh: ['位元', '標記圖', 'ArUco'] },
  },

  // ------------------------------------------------------------------------------------------------ the solve
  solveLayout: {
    group: 'tile',
    summary: {
      en: 'Where every screen lies on the table, from the corners of their markers in one photo: one similarity per screen on a shared canvas, as layout.json. Never throws.',
      zh: '用一張照片裡標記的角，算出每台螢幕在桌上的位置：每台螢幕在共同畫布上一個相似轉換，寫成 layout.json。從不丟出錯誤。',
    },
    params: [
      { name: 'devices', type: 'Object[]', optional: true, default: '[]', en: '`[{ id, w, h, index, markers: [{ device, photo }] }]`: each screen\'s size in device pixels and its markers\' corners in its pixels and in the photo ([`correspondences()`](#correspondences) makes it).', zh: '`[{ id, w, h, index, markers: [{ device, photo }] }]`：每台螢幕的裝置像素大小，以及它的標記在螢幕像素和照片裡的角（[`correspondences()`](#correspondences) 做得出來）。' },
      { name: 'photo', type: 'Object | null', optional: true, default: 'null', en: '`{ w, h }` of the photo, written into the layout.', zh: '照片的 `{ w, h }`，寫進版面。' },
      { name: 'minMarkers', type: 'Number', optional: true, default: '4', en: 'A screen with fewer markers in view is reported (`too-few-markers`), not solved.', zh: '露出的標記比這少的螢幕會被回報（`too-few-markers`），不會被解。' },
      { name: 'reference', type: 'String | null', optional: true, default: 'null', en: 'The id of the screen whose pixels measure the canvas. Default: the one that covers the most of the photo.', zh: '用哪台螢幕的像素量畫布。預設：在照片裡佔最大面積的那台。' },
      { name: 'refine', type: 'Boolean', optional: true, default: 'true', en: 'The joint refinement of the table\'s perspective and every screen\'s similarity.', zh: '把桌面的透視和每台螢幕的相似轉換一起精修。' },
      { name: 'rejectPx', type: 'Number', optional: true, default: '6', en: 'A marker whose corners land further than this from the screen\'s fit (and 4 × the median) is dropped once: a misread id.', zh: '角離這台螢幕的擬合比這遠（而且超過中位數 4 倍）的標記會被丟掉一次：讀錯的 id。' },
    ],
    returns: {
      type: 'Object',
      en: '`{ ok, layout, report, reason }`. `report` has one row per screen: `{ id, status, markers, rejected, rms }`, status `ok`, `too-few-markers`, `degenerate` or `bad-device`. `layout` is `{ version: 1, kind: \'planar\', units: \'reference-px\', reference, canvas: { w, h }, photo, plane: { matrix3x3 }, devices: [{ id, index, w, h, kind: \'planar\', similarity, matrix3x3, rms, markers, pose: null }] }`.',
      zh: '`{ ok, layout, report, reason }`。`report` 每台螢幕一列：`{ id, status, markers, rejected, rms }`，status 是 `ok`、`too-few-markers`、`degenerate` 或 `bad-device`。`layout` 是 `{ version: 1, kind: \'planar\', units: \'reference-px\', reference, canvas: { w, h }, photo, plane: { matrix3x3 }, devices: [{ id, index, w, h, kind: \'planar\', similarity, matrix3x3, rms, markers, pose: null }] }`。',
    },
    description: [
      {
        en: 'Every screen lies in one plane, the table, and its pixels are evenly spaced on it, so "screen pixels → table" is a similarity for every screen, whatever its pixel density. The camera adds one perspective, "table → photo", the same for all of them. So the homography of a screen, divided by the reference\'s, is a similarity: the perspective cancels, and a phone\'s 460 ppi against a laptop\'s 227 ppi ends up in the scale.',
        zh: '每台螢幕都躺在同一個平面（桌面）上，而且它的像素在上面是均勻排的，所以不管像素密度多少，「螢幕像素 → 桌面」對每台都是一個相似轉換。相機再加上一個透視「桌面 → 照片」，對所有螢幕都一樣。所以一台螢幕的單應矩陣除以基準螢幕的，就是一個相似轉換：透視互相抵消，手機的 460 ppi 對筆電的 227 ppi 就落在縮放裡。',
      },
      {
        en: 'The steps: a normalized DLT [`homography()`](#homography) per screen (a misread marker dropped once), each screen\'s similarity by a least-squares fit through the reference\'s inverse, then Levenberg–Marquardt on one plane and every similarity at once, so the perspective is measured by every marker on the table (it keeps a screen far from the reference right), and the canvas moved to start at (0, 0).',
        zh: '步驟：每台螢幕用正規化 DLT 算 [`homography()`](#homography)（讀錯的標記丟一次），用基準螢幕的反矩陣做最小平方擬合得到每台的相似轉換，再用 Levenberg–Marquardt 一起精修一個平面和所有相似轉換，讓透視由桌上每個標記一起量（離基準很遠的螢幕才會準），最後把畫布移到從 (0, 0) 開始。',
      },
    ],
    notes: [
      {
        en: 'Flat screens only: a laptop standing up does not lie in the table\'s plane. Each device has `kind: \'planar\'` and `pose: null`; a `kind: \'window\'` device with a `pose` is the room kept for a screen posed in 3D, which this version validates but cannot draw.',
        zh: '只能是平放的螢幕：立起來的筆電不在桌面那個平面上。每台裝置都是 `kind: \'planar\'`、`pose: null`。帶著 `pose` 的 `kind: \'window\'` 是留給在 3D 空間擺放的螢幕用的位置，這一版會檢查它，但還畫不了。',
      },
    ],
    examples: [
      {
        code: `import { solveLayout, markerGrid, similarityMatrix, mul3, apply3 } from '@openav/tile';

// a laptop and a phone (turned 30°, smaller pixels) on a table, seen by a tilted camera G
const G = [0.8, 0.05, 300, -0.03, 0.75, 200, 0.00004, 0.00006, 1];
const truth = { laptop: { a: 1, b: 0, tx: 0, ty: 0 }, phone: { a: Math.sqrt(3) / 4, b: 0.25, tx: 2900, ty: 300 } };   // 30°, scale 0.5
const screens = [{ id: 'laptop', w: 2560, h: 1600 }, { id: 'phone', w: 1170, h: 2532 }];
const devices = screens.map((s) => {
  const H = mul3(G, similarityMatrix(truth[s.id]));
  return { ...s, markers: markerGrid(s.w, s.h).markers.map((m) => ({ device: m.corners, photo: m.corners.map((c) => apply3(H, c)) })) };
});
const { ok, layout, report } = solveLayout({ devices });
const phone = layout.devices.find((d) => d.id === 'phone').similarity;
document.getElementById('app').innerHTML = 'ok ' + ok + ', reference ' + layout.reference + '<br>phone turned ' +
  (Math.atan2(phone.b, phone.a) * 180 / Math.PI).toFixed(3) + '°, scale ' + Math.hypot(phone.a, phone.b).toFixed(4) + '<br>' +
  report.map((r) => r.id + ' ' + r.status + ' ' + r.markers + ' markers').join(' · ');`,
        caption: { en: 'The phone comes back turned 30.000° at scale 0.5000, as it was put down, measured in the laptop\'s pixels; both screens ok.', zh: '手機算回來是轉 30.000°、縮放 0.5000，跟放下去時一樣，用筆電的像素量。兩台都是 ok。' },
      },
      {
        code: `import { solveLayout, markerGrid } from '@openav/tile';

const corners = markerGrid(1170, 2532).markers.slice(0, 3).map((m) => ({ device: m.corners, photo: m.corners }));
const r = solveLayout({ devices: [{ id: 'phone', w: 1170, h: 2532, markers: corners }] });
document.getElementById('app').textContent = r.ok + ' · ' + r.reason + ' · ' + JSON.stringify(r.report[0]);`,
        caption: { en: 'With 3 markers in view the phone is reported, not placed: false · no screen shows 4 markers · too-few-markers.', zh: '只露出 3 個標記時，手機被回報而不是被定位：false · no screen shows 4 markers · too-few-markers。' },
      },
    ],
    related: ['correspondences', 'tile-validateLayout', 'tileView', 'homography', 'fitSimilarity'],
    keywords: {
      en: ['solve', 'calibration', 'layout', 'layout.json', 'homography', 'similarity', 'levenberg-marquardt', 'one photo', 'screens on a table'],
      zh: ['求解', '校正', '版面', 'layout.json', '單應矩陣', '相似轉換', 'Levenberg-Marquardt', '一張照片', '桌上的螢幕'],
    },
  },

  validateLayout: {
    group: 'tile',
    summary: {
      en: 'Checks a tile layout and lists every problem, one message each: `{ ok, errors }`. Never throws.',
      zh: '檢查一份拼接版面，列出每一個問題，一個問題一則訊息：`{ ok, errors }`。從不丟出錯誤。',
    },
    params: [{ name: 'L', type: 'Object', en: 'A layout, for example parsed from a layout.json file.', zh: '一份版面，例如從 layout.json 讀進來的。' }],
    returns: { type: 'Object', en: '`{ ok: boolean, errors: string[] }`: `ok` when `errors` is empty.', zh: '`{ ok: boolean, errors: string[] }`：`errors` 是空的時候 `ok`。' },
    description: [
      {
        en: 'It checks the version, the reference (one of the devices), the canvas, the plane, and for every device its id (once), whole pixels, a similarity with a scale whose `matrix3x3` matches it, or for `kind: \'window\'` a pose. A tile refuses a layout that does not pass and keeps the one it had.',
        zh: '它檢查版本、基準（必須是其中一台裝置）、畫布、平面，以及每台裝置的 id（不能重複）、整數像素、有縮放的相似轉換而且 `matrix3x3` 跟它一致，或是 `kind: \'window\'` 時要有 pose。螢幕會拒絕沒通過的版面，保留原本那份。',
      },
    ],
    notes: [
      {
        en: 'Not the same function as `@openav/surface`\'s [`validateLayout()`](#surface-validateLayout), which checks a phone control-surface layout: import one under another name (`import { validateLayout as validateTileLayout } from \'@openav/tile\'`) when a page needs both. `@openav/output` has its own file and its own check, [`parseOutputLayout()`](#parseOutputLayout).',
        zh: '跟 `@openav/surface` 的 [`validateLayout()`](#surface-validateLayout) 不是同一個函式，那個檢查的是手機控制面板的版面：頁面兩個都要用時，把其中一個換個名字引入（`import { validateLayout as validateTileLayout } from \'@openav/tile\'`）。`@openav/output` 有它自己的檔案和檢查，[`parseOutputLayout()`](#parseOutputLayout)。',
      },
    ],
    examples: [
      {
        code: `import { validateLayout } from '@openav/tile';

const r = validateLayout({ version: 1, reference: 'tv', canvas: { w: 100, h: 0 }, devices: [
  { id: 'phone', w: 1170, h: 2532, kind: 'planar', similarity: { a: 0.5, b: 0, tx: 0, ty: 0 }, matrix3x3: [1, 0, 0, 0, 1, 0, 0, 0, 1] },
] });
document.getElementById('app').innerHTML = r.ok + '<br>' + r.errors.join('<br>');`,
        caption: { en: 'false, and three problems: the canvas has no height, the phone\'s matrix does not match its similarity, the reference "tv" is not a device.', zh: 'false，以及三個問題：畫布沒有高度、手機的矩陣跟它的相似轉換對不上、基準「tv」不是其中一台裝置。' },
      },
    ],
    related: ['solveLayout', 'LAYOUT_VERSION', 'tileView'],
    keywords: { en: ['validate', 'layout.json', 'schema', 'check'], zh: ['驗證', 'layout.json', '格式', '檢查'] },
  },

  LAYOUT_VERSION: {
    group: 'tile',
    summary: { en: 'The version of layout.json this package writes and reads: 1.', zh: '這個套件寫出和讀進的 layout.json 版本：1。' },
    description: [{ en: '[`validateLayout()`](#tile-validateLayout) refuses any other.', zh: '[`validateLayout()`](#tile-validateLayout) 會拒絕其他版本。' }],
    examples: [{ code: `import { LAYOUT_VERSION } from '@openav/tile';

document.getElementById('app').textContent = LAYOUT_VERSION;`, caption: { en: 'Prints 1.', zh: '印出 1。' } }],
    related: ['tile-validateLayout', 'solveLayout'],
    keywords: { en: ['version', 'layout.json'], zh: ['版本', 'layout.json'] },
  },

  homography: {
    group: 'tile',
    summary: {
      en: 'The homography that carries 4 or more points onto theirs, by the normalized direct linear transform: `{ ok: true, H }` or `{ ok: false, reason }`. Never throws.',
      zh: '把 4 個以上的點送到對應點的單應矩陣，用正規化的直接線性轉換（DLT）算：`{ ok: true, H }` 或 `{ ok: false, reason }`。從不丟出錯誤。',
    },
    params: [
      { name: 'src', type: 'number[][]', en: 'The points `[[x, y], …]`.', zh: '點 `[[x, y], …]`。' },
      { name: 'dst', type: 'number[][]', en: 'Where they go, in the same order.', zh: '它們要去的位置，順序一樣。' },
      { name: 'normalize', type: 'Boolean', optional: true, default: 'true', en: '`false` skips Hartley\'s normalization: kept only so a test can show why it is there.', zh: '`false` 跳過 Hartley 正規化：留著只是為了讓測試證明它為什麼需要。' },
    ],
    returns: { type: 'Object', en: `\`H\`: ${MAT} \`H[8]\` is 1. \`reason\` is \`too-few-points\` or \`degenerate\` (collinear or repeated points).`, zh: `\`H\`：${MAT_ZH}\`H[8]\` 是 1。\`reason\` 是 \`too-few-points\` 或 \`degenerate\`（點共線或重複）。` },
    description: [
      {
        en: 'With more than four points it is the least-squares fit. Without the normalization (centre the points, scale their mean distance to √2) a 9 × 9 system built from pixel coordinates in the thousands is hopeless in double precision: every screen came out degenerate in the test that turns it off.',
        zh: '超過四個點時就是最小平方擬合。沒有正規化（把點移到中心、平均距離縮放到 √2）的話，用上千像素的座標組成的 9 × 9 方程組，在雙精度下根本解不了：在把它關掉的測試裡，每台螢幕都被判成退化。',
      },
    ],
    notes: [
      {
        en: '`@openav/output` has [`cornerPin()`](#cornerPin) for the one case of four corners of a rectangle onto a projector\'s quad (it throws on a quad that is not convex, for a CSS `matrix3d`); this one takes any number of measured points and never throws.',
        zh: '`@openav/output` 有 [`cornerPin()`](#cornerPin)，處理矩形四個角送到投影四邊形那一種情況（四邊形不是凸的會丟出錯誤，給 CSS `matrix3d` 用）。這一個接受任何數量的量測點，而且從不丟出錯誤。',
      },
    ],
    examples: [
      {
        code: `import { homography, apply3 } from '@openav/tile';

const src = [[0, 0], [100, 0], [100, 100], [0, 100]], dst = [[10, 20], [210, 30], [190, 230], [0, 200]];
const { ok, H } = homography(src, dst);
document.getElementById('app').textContent = ok + ' · (100, 100) → ' + apply3(H, [100, 100]).map((v) => v.toFixed(3)) + ' · ' + homography(src.slice(0, 3), dst.slice(0, 3)).reason;`,
        caption: { en: 'Prints true · (100, 100) → 190.000,230.000 · too-few-points.', zh: '印出 true · (100, 100) → 190.000,230.000 · too-few-points。' },
      },
    ],
    related: ['apply3', 'normalizer', 'solveLayout', 'cornerPin'],
    keywords: { en: ['homography', 'dlt', 'direct linear transform', 'perspective', 'hartley normalization', 'projective'], zh: ['單應矩陣', 'DLT', '直接線性轉換', '透視', 'Hartley 正規化', '投影轉換'] },
  },

  normalizer: {
    group: 'tile',
    summary: { en: 'Hartley\'s normalization: the similarity that moves the points\' centroid to 0 and their mean distance to √2, as 9 numbers.', zh: 'Hartley 正規化：把點的重心移到 0、平均距離縮放到 √2 的相似轉換，9 個數字。' },
    params: [{ name: 'pts', type: 'number[][]', en: 'The points.', zh: '點。' }],
    returns: { type: 'Number[]', en: 'A 3 × 3 matrix, row by row.', zh: '3 × 3 矩陣，一列一列。' },
    description: [{ en: 'What [`homography()`](#homography) applies to both point sets before it solves. Exported from `@openav/tile/solve`.', zh: '[`homography()`](#homography) 在求解之前套用到兩組點上的東西。從 `@openav/tile/solve` 匯出。' }],
    examples: [{ code: `import { normalizer, apply3 } from '@openav/tile/solve';

const pts = [[1000, 1000], [3000, 1000], [3000, 3000], [1000, 3000]], T = normalizer(pts);
document.getElementById('app').textContent = pts.map((p) => apply3(T, p).map((v) => v.toFixed(2))).join(' · ');`, caption: { en: 'The four points come out at ±1, ±1: centred, mean distance √2.', zh: '四個點變成 ±1, ±1：在中心，平均距離 √2。' } }],
    related: ['homography'],
    keywords: { en: ['normalization', 'hartley', 'conditioning'], zh: ['正規化', 'Hartley', '條件數'] },
  },

  fitSimilarity: {
    group: 'tile',
    summary: { en: 'The similarity that best carries one set of points onto another, by least squares in closed form, with its RMS residual. null with fewer than 2 points.', zh: '把一組點送到另一組點的最佳相似轉換，用封閉解的最小平方，附上 RMS 殘差。少於 2 個點時是 null。' },
    params: [
      { name: 'src', type: 'number[][]', en: 'The points.', zh: '點。' },
      { name: 'dst', type: 'number[][]', en: 'Where they should go.', zh: '它們應該去的位置。' },
    ],
    returns: { type: 'Object | null', en: `\`{ a, b, tx, ty, rms }\`. ${SIM}`, zh: `\`{ a, b, tx, ty, rms }\`。${SIM_ZH}` },
    description: [{ en: 'No iteration and no starting guess: the turn, scale and shift fall out of four sums. It is how each screen is first placed against the reference.', zh: '不用迭代、不用初始猜測：旋轉、縮放和位移從四個總和直接算出來。每台螢幕一開始就是這樣對著基準螢幕擺上去的。' }],
    examples: [
      {
        code: `import { fitSimilarity, similarityMatrix, apply3, similarityAngle, similarityScale } from '@openav/tile';

const S = similarityMatrix({ a: 0.5, b: 0.866, tx: 40, ty: -10 });        // 60°, scale 1
const src = [[0, 0], [100, 0], [100, 50], [0, 50]], dst = src.map((p) => apply3(S, p));
const f = fitSimilarity(src, dst);
document.getElementById('app').textContent = (similarityAngle(f) * 180 / Math.PI).toFixed(2) + '° · scale ' + similarityScale(f).toFixed(3) + ' · rms ' + f.rms.toFixed(6);`,
        caption: { en: 'Prints 60.00° · scale 1.000 · rms 0.000000: the turn and scale it was made with.', zh: '印出 60.00° · scale 1.000 · rms 0.000000：就是做出它時的旋轉和縮放。' },
      },
    ],
    related: ['similarityMatrix', 'rmsError', 'solveLayout'],
    keywords: { en: ['similarity', 'procrustes', 'least squares', 'fit', 'rotation scale translation'], zh: ['相似轉換', 'Procrustes', '最小平方', '擬合', '旋轉縮放位移'] },
  },

  similarityMatrix: {
    group: 'tile',
    summary: { en: 'A similarity `{ a, b, tx, ty }` as a 3 × 3 matrix: `[a, −b, tx, b, a, ty, 0, 0, 1]`.', zh: '把相似轉換 `{ a, b, tx, ty }` 寫成 3 × 3 矩陣：`[a, −b, tx, b, a, ty, 0, 0, 1]`。' },
    params: [
      { name: 'a', type: 'Number', en: 'Scale × cos(turn).', zh: '縮放 × cos(旋轉角)。' },
      { name: 'b', type: 'Number', en: 'Scale × sin(turn).', zh: '縮放 × sin(旋轉角)。' },
      { name: 'tx', type: 'Number', en: 'Shift in x.', zh: 'x 方向的位移。' },
      { name: 'ty', type: 'Number', en: 'Shift in y.', zh: 'y 方向的位移。' },
    ],
    returns: { type: 'Number[]', en: 'Nine numbers, row by row: what a layout keeps as `matrix3x3`.', zh: '九個數字，一列一列：版面裡存成 `matrix3x3` 的就是它。' },
    description: [{ en: SIM, zh: SIM_ZH }],
    examples: [{ code: `import { similarityMatrix } from '@openav/tile';

document.getElementById('app').textContent = similarityMatrix({ a: 0, b: 2, tx: 5, ty: 6 }).join(', ');`, caption: { en: 'A quarter turn at twice the size: 0, -2, 5, 2, 0, 6, 0, 0, 1.', zh: '轉四分之一圈、放大兩倍：0, -2, 5, 2, 0, 6, 0, 0, 1。' } }],
    related: ['similarityOf', 'similarityScale', 'similarityAngle', 'fitSimilarity'],
    keywords: { en: ['similarity', 'matrix'], zh: ['相似轉換', '矩陣'] },
  },

  similarityOf: {
    group: 'tile',
    summary: { en: 'The similarity `{ a, b, tx, ty }` read back out of a 3 × 3 matrix (its first column and its shift).', zh: '從 3 × 3 矩陣讀回相似轉換 `{ a, b, tx, ty }`（它的第一欄和位移）。' },
    params: [{ name: 'M', type: 'Number[]', en: 'Nine numbers, row by row.', zh: '九個數字，一列一列。' }],
    returns: { type: 'Object', en: '`{ a: M[0], b: M[3], tx: M[2], ty: M[5] }`.', zh: '四個數字 `{ a: M[0], b: M[3], tx: M[2], ty: M[5] }`。' },
    description: [{ en: 'It does not check that the matrix is a similarity: it reads the four numbers.', zh: '它不檢查矩陣是不是相似轉換，只讀那四個數字。' }],
    examples: [{ code: `import { similarityOf, similarityMatrix } from '@openav/tile';

document.getElementById('app').textContent = JSON.stringify(similarityOf(similarityMatrix({ a: 0.6, b: 0.8, tx: 1, ty: 2 })));`, caption: { en: 'Prints {"a":0.6,"b":0.8,"tx":1,"ty":2}: the round trip.', zh: '印出 {"a":0.6,"b":0.8,"tx":1,"ty":2}：轉過去再轉回來。' } }],
    related: ['similarityMatrix'],
    keywords: { en: ['similarity', 'decompose'], zh: ['相似轉換', '拆解'] },
  },

  similarityScale: {
    group: 'tile',
    summary: { en: 'The uniform scale of a similarity: `hypot(a, b)`.', zh: '相似轉換的等比縮放：`hypot(a, b)`。' },
    params: [
      { name: 'a', type: 'Number', en: 'From `{ a, b }`.', zh: '來自 `{ a, b }`。' },
      { name: 'b', type: 'Number', en: 'From `{ a, b }`.', zh: '來自 `{ a, b }`。' },
    ],
    returns: { type: 'Number', en: 'Canvas units per screen pixel in a layout; a phone\'s is about the laptop\'s ppi over its own.', zh: '在版面裡是每個螢幕像素幾個畫布單位。手機的大約是筆電的 ppi 除以手機自己的。' },
    description: [{ en: 'In the demo layout the phone\'s 0.4935 is the laptop\'s 227 ppi over the phone\'s 460.', zh: '在示範版面裡，手機的 0.4935 就是筆電的 227 ppi 除以手機的 460。' }],
    examples: [{ code: `import { similarityScale } from '@openav/tile';

document.getElementById('app').textContent = similarityScale({ a: 0.409166122, b: 0.275927653 }).toFixed(4);`, caption: { en: 'Prints 0.4935, the demo phone\'s scale.', zh: '印出 0.4935，示範裡那支手機的縮放。' } }],
    related: ['similarityAngle', 'similarityMatrix'],
    keywords: { en: ['scale', 'ppi', 'pixel density'], zh: ['縮放', 'ppi', '像素密度'] },
  },

  similarityAngle: {
    group: 'tile',
    summary: { en: 'How far a similarity turns, in radians: `atan2(b, a)`.', zh: '相似轉換轉了多少，弧度：`atan2(b, a)`。' },
    params: [
      { name: 'a', type: 'Number', en: 'From `{ a, b }`.', zh: '來自 `{ a, b }`。' },
      { name: 'b', type: 'Number', en: 'From `{ a, b }`.', zh: '來自 `{ a, b }`。' },
    ],
    returns: { type: 'Number', en: '−π to π.', zh: '−π 到 π。' },
    description: [{ en: 'A screen\'s turn on the table; y points down, so a positive angle turns clockwise as you look at it.', zh: '螢幕在桌上轉了多少。y 朝下，所以正的角度看起來是順時針。' }],
    examples: [{ code: `import { similarityAngle } from '@openav/tile';

document.getElementById('app').textContent = (similarityAngle({ a: 0, b: 1 }) * 180 / Math.PI) + '°';`, caption: { en: 'Prints 90°.', zh: '印出 90°。' } }],
    related: ['similarityScale', 'similarityMatrix'],
    keywords: { en: ['angle', 'rotation'], zh: ['角度', '旋轉'] },
  },

  rmsError: {
    group: 'tile',
    summary: { en: 'The RMS distance between the points carried by a matrix and where they should be, in the pixels of the target.', zh: '用矩陣送過去的點和它們應該在的位置之間的 RMS 距離，單位是目標的像素。' },
    params: [
      { name: 'M', type: 'Number[]', en: 'A 3 × 3 matrix.', zh: '3 × 3 矩陣。' },
      { name: 'src', type: 'number[][]', en: 'The points.', zh: '點。' },
      { name: 'dst', type: 'number[][]', en: 'Where they should go.', zh: '它們應該去的位置。' },
    ],
    returns: { type: 'Number', en: '0 for no points.', zh: '沒有點時是 0。' },
    description: [{ en: 'A layout\'s `rms` for each screen is this, in photo pixels: how far its markers\' corners land from where the layout says they are.', zh: '版面裡每台螢幕的 `rms` 就是這個，單位是照片像素：它的標記的角，離版面說的位置多遠。' }],
    examples: [{ code: `import { rmsError, I3 } from '@openav/tile/solve';

document.getElementById('app').textContent = rmsError(I3, [[0, 0], [10, 0]], [[3, 4], [10, 0]]).toFixed(3);`, caption: { en: 'One point off by 5, one exact: prints 3.536 (the square root of 25 / 2).', zh: '一個點差 5、一個完全對上：印出 3.536（25 / 2 的平方根）。' } }],
    related: ['fitSimilarity', 'apply3'],
    keywords: { en: ['rms', 'reprojection error', 'residual'], zh: ['RMS', '重投影誤差', '殘差'] },
  },

  mul3: {
    group: 'tile',
    summary: { en: 'The product of two 3 × 3 matrices, row by row: `mul3(A, B)` applies B first, then A.', zh: '兩個 3 × 3 矩陣相乘，一列一列：`mul3(A, B)` 先套 B，再套 A。' },
    params: [
      { name: 'A', type: 'Number[]', en: 'Nine numbers.', zh: '九個數字。' },
      { name: 'B', type: 'Number[]', en: 'Nine numbers.', zh: '九個數字。' },
    ],
    returns: { type: 'Number[]', en: 'Nine numbers.', zh: '九個數字。' },
    description: [{ en: 'A screen\'s homography in the photo is `mul3(plane, similarityMatrix(similarity))`: the table\'s perspective after the screen\'s place on the table.', zh: '一台螢幕在照片裡的單應矩陣是 `mul3(plane, similarityMatrix(similarity))`：先放到桌上的位置，再加上桌面的透視。' }],
    examples: [{ code: `import { mul3, similarityMatrix } from '@openav/tile';

const turn = similarityMatrix({ a: 0, b: 1, tx: 0, ty: 0 });
document.getElementById('app').textContent = mul3(turn, turn).map((v) => Math.round(v)).join(', ');`, caption: { en: 'Two quarter turns make a half turn: -1, 0, 0, 0, -1, 0, 0, 0, 1.', zh: '兩個四分之一圈變成半圈：-1, 0, 0, 0, -1, 0, 0, 0, 1。' } }],
    related: ['inv3', 'apply3', 'det3'],
    keywords: { en: ['matrix multiply', '3x3'], zh: ['矩陣相乘', '3x3'] },
  },

  inv3: {
    group: 'tile',
    summary: { en: 'The inverse of a 3 × 3 matrix, or null when it is singular.', zh: '3 × 3 矩陣的反矩陣，奇異矩陣時是 null。' },
    params: [{ name: 'M', type: 'Number[]', en: 'Nine numbers, row by row.', zh: '九個數字，一列一列。' }],
    returns: { type: 'Number[] | null', en: 'Nine numbers.', zh: '九個數字。' },
    description: [{ en: 'A view\'s `toDevice` is the inverse of its `toCanvas`: canvas units back to the screen\'s pixels.', zh: 'view 的 `toDevice` 就是它的 `toCanvas` 的反矩陣：從畫布單位回到螢幕像素。' }],
    examples: [{ code: `import { inv3, apply3 } from '@openav/tile';

const M = [2, 0, 10, 0, 2, 20, 0, 0, 1];
document.getElementById('app').textContent = apply3(inv3(M), apply3(M, [3, 4])) + ' · ' + inv3([1, 2, 3, 2, 4, 6, 0, 0, 1]);`, caption: { en: 'Prints 3,4 · null: there and back, and a matrix with two rows in proportion has no inverse.', zh: '印出 3,4 · null：轉過去再轉回來，以及兩列成比例的矩陣沒有反矩陣。' } }],
    related: ['mul3', 'det3', 'apply3'],
    keywords: { en: ['inverse', 'matrix', '3x3'], zh: ['反矩陣', '矩陣', '3x3'] },
  },

  apply3: {
    group: 'tile',
    summary: { en: 'Where the point (x, y) lands under a 3 × 3 matrix: the projective divide included.', zh: '點 (x, y) 經過 3 × 3 矩陣之後落在哪裡：含投影除法。' },
    params: [
      { name: 'M', type: 'Number[]', en: 'Nine numbers, row by row.', zh: '九個數字，一列一列。' },
      { name: 'array', type: 'number[]', en: 'The point `[x, y]`.', zh: '點 `[x, y]`。' },
    ],
    returns: { type: 'number[]', en: 'The point it lands on, `[x\', y\']`.', zh: '落點 `[x\', y\']`。' },
    description: [{ en: MAT, zh: MAT_ZH }],
    examples: [{ code: `import { apply3 } from '@openav/tile';

document.getElementById('app').textContent = apply3([1, 0, 0, 0, 1, 0, 0.01, 0, 1], [100, 50]).join(', ');`, caption: { en: 'A perspective row halves the point: 50, 25.', zh: '有透視的那一列把點縮成一半：50, 25。' } }],
    related: ['mul3', 'inv3', 'homography'],
    keywords: { en: ['transform point', 'projective', 'homogeneous'], zh: ['轉換點', '投影', '齊次座標'] },
  },

  det3: {
    group: 'tile',
    summary: { en: 'The determinant of a 3 × 3 matrix.', zh: '3 × 3 矩陣的行列式。' },
    params: [{ name: 'M', type: 'Number[]', en: 'Nine numbers, row by row.', zh: '九個數字，一列一列。' }],
    returns: { type: 'Number', en: '0 for a singular matrix.', zh: '奇異矩陣是 0。' },
    description: [{ en: 'For a similarity it is the scale squared.', zh: '相似轉換的行列式是縮放的平方。' }],
    examples: [{ code: `import { det3, similarityMatrix } from '@openav/tile';

document.getElementById('app').textContent = det3(similarityMatrix({ a: 0.6, b: 0.8, tx: 9, ty: 9 })).toFixed(6);`, caption: { en: 'A similarity of scale 1: prints 1.000000.', zh: '縮放為 1 的相似轉換：印出 1.000000。' } }],
    related: ['inv3', 'mul3'],
    keywords: { en: ['determinant', 'matrix'], zh: ['行列式', '矩陣'] },
  },

  I3: {
    group: 'tile',
    summary: { en: 'The 3 × 3 identity, `[1, 0, 0, 0, 1, 0, 0, 0, 1]`. Exported from `@openav/tile/solve`.', zh: '3 × 3 單位矩陣，`[1, 0, 0, 0, 1, 0, 0, 0, 1]`。從 `@openav/tile/solve` 匯出。' },
    description: [{ en: 'The reference screen\'s similarity before the canvas is moved to start at (0, 0). Copy it (`I3.slice()`) before changing it.', zh: '畫布移到從 (0, 0) 開始之前，基準螢幕的相似轉換。要改之前先複製（`I3.slice()`）。' }],
    examples: [{ code: `import { I3 } from '@openav/tile/solve';

document.getElementById('app').textContent = I3.join(', ');`, caption: { en: 'Prints 1, 0, 0, 0, 1, 0, 0, 0, 1.', zh: '印出 1, 0, 0, 0, 1, 0, 0, 0, 1。' } }],
    related: ['mul3'],
    keywords: { en: ['identity', 'matrix'], zh: ['單位矩陣', '矩陣'] },
  },

  // ------------------------------------------------------------------------------------------------ detect (the camera page)
  loadOpenCV: {
    group: 'tile',
    summary: {
      en: 'Loads OpenCV.js once, with a script tag, and resolves with `cv` when its WebAssembly is ready. Only the camera page calls it.',
      zh: '用 script 標籤載入 OpenCV.js 一次，等它的 WebAssembly 準備好之後回傳 `cv`。只有拍照頁會呼叫它。',
    },
    params: [{ name: 'url', type: 'String', optional: true, default: 'OPENCV_URL', en: 'Where to load it from: the pinned file on jsDelivr, or your own copy of the same file.', zh: '從哪裡載：jsDelivr 上固定版本的檔案，或你自己放的同一個檔案。' }],
    returns: { type: 'Promise<Object>', en: 'OpenCV\'s `cv`. The same promise on every call.', zh: 'OpenCV 的 `cv`。每次呼叫都是同一個 promise。' },
    description: [
      {
        en: 'About 10 MB (3 MB over the wire), cached by the browser after the first visit. The screens never load it: their marker bits are in `dict.js`. A failed load rejects and lets the next call try again.',
        zh: '大約 10 MB（傳輸時壓縮成 3 MB），第一次之後瀏覽器會快取。螢幕從來不載它：它們的標記位元在 `dict.js` 裡。載入失敗時 reject，下一次呼叫會再試。',
      },
      {
        en: 'OpenCV.js\'s `cv` is an Emscripten module whose `then` calls back with the module itself, so a promise resolved with it unwraps it again, forever (one core at 100%, nothing settles). `loadOpenCV` waits for `cv.Mat`, drops that `then`, and only then resolves.',
        zh: 'OpenCV.js 的 `cv` 是一個 Emscripten 模組，它的 `then` 會用模組自己回呼，所以用它 resolve 的 promise 會一直展開下去（一顆 CPU 100%，永遠不結束）。`loadOpenCV` 等 `cv.Mat` 出現，拿掉那個 `then`，才 resolve。',
      },
    ],
    needs: { en: 'A browser page and the network (jsDelivr), unless `url` points at a copy.', zh: '要有瀏覽器頁面和網路（jsDelivr），除非 `url` 指到一份副本。' },
    examples: [
      {
        code: `import { loadOpenCV, detectMarkers } from '@openav/tile/detect';

const cv = await loadOpenCV();
const { found, ms } = detectMarkers(cv, document.querySelector('img'));
console.log(found.length + ' markers in ' + ms + ' ms');`,
        caption: { en: 'Loads OpenCV.js and finds the markers in the photo on the page.', zh: '載入 OpenCV.js，找出頁面上那張照片裡的標記。' },
        run: 'static', why: WHY_CV,
      },
    ],
    related: ['detectMarkers', 'OPENCV_URL', 'OPENCV_VERSION'],
    keywords: { en: ['opencv', 'opencv.js', 'load', 'wasm', 'cdn', 'jsdelivr'], zh: ['OpenCV', 'opencv.js', '載入', 'WebAssembly', 'CDN', 'jsDelivr'] },
  },

  detectMarkers: {
    group: 'tile',
    summary: {
      en: 'Finds the DICT_5X5_1000 markers in a photo with OpenCV\'s ArUco detector: each marker\'s id and four corners in the photo\'s own pixels.',
      zh: '用 OpenCV 的 ArUco 偵測器找出照片裡的 DICT_5X5_1000 標記：每個標記的 id 和它在照片自己像素裡的四個角。',
    },
    params: [
      { name: 'cv', type: 'Object', en: 'What [`loadOpenCV()`](#loadOpenCV) resolved with.', zh: '[`loadOpenCV()`](#loadOpenCV) 回傳的東西。' },
      { name: 'src', type: 'HTMLImageElement | HTMLCanvasElement | ImageBitmap | ImageData | Object', en: 'The photo, or grey pixels already (`{ data, w, h }`, as [`greyPixels()`](#greyPixels) gives).', zh: '照片，或已經轉好的灰階像素（`{ data, w, h }`，[`greyPixels()`](#greyPixels) 給的那種）。' },
      { name: 'maxSide', type: 'Number', optional: true, default: '4096', en: 'A larger photo is scaled down first: a 48 MP photo is slow and buys nothing.', zh: '比這大的照片先縮小：4800 萬像素的照片很慢，也沒有比較好。' },
      { name: 'params', type: 'Object', optional: true, default: '{}', en: 'Extra fields for OpenCV\'s `aruco_DetectorParameters`.', zh: 'OpenCV `aruco_DetectorParameters` 的額外欄位。' },
    ],
    returns: {
      type: 'Object',
      en: '`{ found: [{ id, corners: [[x, y] × 4] }], rejected, ms, w, h }`: corners in OpenCV\'s order (top-left, top-right, bottom-right, bottom-left of the marker as drawn), in canvas convention (+ 0.5 on OpenCV\'s pixel centres), what [`correspondences()`](#correspondences) expects.',
      zh: '`{ found: [{ id, corners: [[x, y] × 4] }], rejected, ms, w, h }`：角照 OpenCV 的順序（畫出來的標記的左上、右上、右下、左下），用畫布的慣例（OpenCV 的像素中心再加 0.5），正是 [`correspondences()`](#correspondences) 要的。',
    },
    description: [
      {
        en: 'Sub-pixel corner refinement is on (`CORNER_REFINE_SUBPIX`): the corners are what the solver lives on. Every OpenCV object it makes is deleted before it returns. Why OpenCV.js: one pinned file loaded with a script tag, no build step; its ArUco detector also reads AprilTag families, so the marker family can change without changing library; and the next step, a screen posed in 3D, needs `solvePnP`, which is in the same file.',
        zh: '開了次像素角點精修（`CORNER_REFINE_SUBPIX`）：求解靠的就是這些角。它建的每個 OpenCV 物件在回傳之前都會刪掉。為什麼用 OpenCV.js：一個固定版本的檔案，用 script 標籤載入，不用建置。它的 ArUco 偵測器也讀 AprilTag 家族，換標記家族不必換函式庫。下一步（在 3D 空間擺放的螢幕）要的 `solvePnP` 也在同一個檔案裡。',
      },
    ],
    examples: [
      {
        code: `import { loadOpenCV, detectMarkers } from '@openav/tile/detect';
import { correspondences, solveLayout } from '@openav/tile';

const cv = await loadOpenCV();
const shot = detectMarkers(cv, photo);                       // photo: an <img> of the table
const { devices } = correspondences(shot.found, roster);     // roster: [{ id, index, w, h }]
const { ok, layout, report } = solveLayout({ devices, photo: { w: shot.w, h: shot.h } });`,
        caption: { en: 'What the camera page does with one photo: find the markers, sort them onto screens, solve the layout.', zh: '拍照頁拿到一張照片做的事：找標記、分給螢幕、算出版面。' },
        run: 'static', why: WHY_CV,
      },
    ],
    related: ['loadOpenCV', 'correspondences', 'greyPixels', 'DICT_NAME'],
    keywords: { en: ['detect', 'aruco', 'opencv', 'marker detection', 'corners', 'subpixel'], zh: ['偵測', 'ArUco', 'OpenCV', '標記偵測', '角點', '次像素'] },
  },

  greyPixels: {
    group: 'tile',
    summary: {
      en: 'The grey pixels of an image, a canvas or ImageData, scaled down to at most `maxSide` on the long side: `{ data, w, h, scale }`.',
      zh: '影像、畫布或 ImageData 的灰階像素，長邊最多縮到 `maxSide`：`{ data, w, h, scale }`。',
    },
    params: [
      { name: 'src', type: 'HTMLImageElement | HTMLCanvasElement | HTMLVideoElement | ImageData', en: 'The picture.', zh: '圖片。' },
      { name: 'maxSide', type: 'Number', optional: true, default: '4096', en: 'The longest side kept, in pixels. ImageData is taken as it is.', zh: '保留的最長邊，像素。ImageData 照原樣用。' },
    ],
    returns: { type: 'Object', en: '`data` is a `Uint8Array` of luma (0.30 R + 0.59 G + 0.11 B), `scale` what the picture was multiplied by.', zh: '`data` 是亮度的 `Uint8Array`（0.30 R + 0.59 G + 0.11 B），`scale` 是圖片被乘上的倍率。' },
    description: [{ en: 'What [`detectMarkers()`](#detectMarkers) feeds OpenCV; it needs no OpenCV itself, so importing `@openav/tile/detect` for it loads nothing from the network.', zh: '[`detectMarkers()`](#detectMarkers) 餵給 OpenCV 的東西。它本身不需要 OpenCV，所以為了它引入 `@openav/tile/detect` 不會從網路載任何東西。' }],
    examples: [
      {
        code: `import { greyPixels } from '@openav/tile/detect';

const c = document.getElementById('c'), ctx = c.getContext('2d');   // 400×300
ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 200, 300); ctx.fillStyle = '#000'; ctx.fillRect(200, 0, 200, 300);
const g = greyPixels(c, 200);
document.getElementById('app').textContent = g.w + '×' + g.h + ' at ' + g.scale + ', left ' + g.data[10] + ', right ' + g.data[g.w - 10];`,
        caption: { en: 'Half white, half black, at half size: prints 200×150 at 0.5, left 255, right 0.', zh: '一半白一半黑，縮成一半：印出 200×150 at 0.5, left 255, right 0。' },
      },
    ],
    related: ['detectMarkers'],
    keywords: { en: ['grayscale', 'luma', 'downscale', 'pixels'], zh: ['灰階', '亮度', '縮小', '像素'] },
  },

  OPENCV_VERSION: {
    group: 'tile',
    summary: { en: 'The OpenCV.js build the camera page loads: `4.12.0-release.1` of the npm package `@techstark/opencv-js` (OpenCV 4.12.0).', zh: '拍照頁載入的 OpenCV.js 版本：npm 套件 `@techstark/opencv-js` 的 `4.12.0-release.1`（OpenCV 4.12.0）。' },
    description: [
      {
        en: 'Pinned, so the page runs the build the tests ran and `dict.js` was extracted from. The package and OpenCV are Apache-2.0 (see NOTICE).',
        zh: '版本寫死，所以頁面跑的就是測試跑過、`dict.js` 抽出來的那個版本。這個套件和 OpenCV 都是 Apache-2.0（見 NOTICE）。',
      },
    ],
    examples: [{ code: `import { OPENCV_VERSION } from '@openav/tile/detect';

document.getElementById('app').textContent = OPENCV_VERSION;`, caption: { en: 'Prints 4.12.0-release.1.', zh: '印出 4.12.0-release.1。' } }],
    related: ['OPENCV_URL', 'loadOpenCV'],
    keywords: { en: ['opencv version', 'pinned'], zh: ['OpenCV 版本', '固定版本'] },
  },

  OPENCV_URL: {
    group: 'tile',
    summary: { en: 'Where the camera page loads OpenCV.js from: the pinned `dist/opencv.js` of `@techstark/opencv-js` on jsDelivr.', zh: '拍照頁從哪裡載 OpenCV.js：jsDelivr 上固定版本的 `@techstark/opencv-js` 的 `dist/opencv.js`。' },
    description: [
      {
        en: 'No other page or package of the framework refers to it (tests/tile.test.js checks): a work that uses tile loads OpenCV only on its camera page. A venue without the internet can serve its own copy of the same file and pass it to [`loadOpenCV(url)`](#loadOpenCV).',
        zh: '框架的其他頁面和套件都沒有提到它（tests/tile.test.js 會檢查）：用 tile 的作品只在它的拍照頁載 OpenCV。沒有網路的場地可以自己放一份同樣的檔案，交給 [`loadOpenCV(url)`](#loadOpenCV)。',
      },
    ],
    examples: [{ code: `import { OPENCV_URL } from '@openav/tile/detect';

document.getElementById('app').textContent = OPENCV_URL;`, caption: { en: 'Prints the jsDelivr address, which this example does not fetch.', zh: '印出 jsDelivr 的位址，這個範例不會去抓它。' } }],
    related: ['OPENCV_VERSION', 'loadOpenCV'],
    keywords: { en: ['cdn', 'jsdelivr', 'opencv.js url'], zh: ['CDN', 'jsDelivr', 'opencv.js 位址'] },
  },
};
