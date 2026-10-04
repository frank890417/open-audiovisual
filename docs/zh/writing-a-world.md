# 寫一個世界

世界是整套框架裡，唯一*一定*要自己寫的部分。其他都是組裝。

## 介面

```js
export const myWorld = {
  name: 'my-world',

  // params: what the world can be performed WITH.
  // These appear in the console, are automatable by the timeline,
  // and are mappable to any signal.
  params: [
    { key: 'energy', label: 'Energy', min: 0, max: 1, def: 0.3 },
    { key: 'mode',   label: 'Mode',   min: 0, max: 3, def: 0, step: 1 },  // step → snaps, holds on the timeline
    { key: 'reset',  label: 'Reset',  pulse: true },                       // momentary trigger
  ],

  init(ctx) {
    // ctx = { container, signals, params }
    // build your renderer here: p5, three, or the built-in 2D helper:
    this.view = createCanvas(ctx.container);
    // discrete events may come straight from signals:
    this._unsub = ctx.signals.on('chord/event', (a) => this.onChord(a));
    this._unpulse = ctx.params.onPulse('reset', () => this.reset());
  },

  update(dt, state, io) {
    // state = resolved param values. This is your ONLY continuous input.
    // io = { signals } plus any output handles the assembly added (see "Sound output")
  },

  render() { /* draw */ },

  dispose() { this._unsub?.(); this._unpulse?.(); this.view.dispose(); },
};
```

## 約定

| 成員 | 什麼時候執行 | 拿到什麼 |
|---|---|---|
| `name` | — | 一個不重複的字串，舞台用這個名字註冊世界 |
| `params` | 註冊世界時讀一次 | 參數宣告組成的陣列（見下方） |
| `init(ctx)` | 世界啟用時 | `{ container, signals, params }`。可以是 `async`，`createShow()` 會等它跑完才啟動迴圈 |
| `update(dt, state, io)` | 每一影格 | `dt` 以秒為單位（≤ 0.1），`state` 是每個參數的 `{ key: value }`，`io` 是 `{ signals, … }` |
| `render()` | 每一影格，緊接在 `update` 之後 | 不帶參數，用 `update` 存下來的東西來畫 |
| `dispose()` | 換成另一個世界時 | 釋放 GPU 物件、DOM、訂閱 |
| `surface` | 選用 | 手機控制面板的版面。有它的話，`modules.remote` 直接用它，不再自動產生（[手機](remote.md#the-show-side)） |

`container` 是一個絕對定位、鋪滿整個舞台的元素。舞台在每次 `init` 之前都會把它清空，所以你不用收拾別人留下的 DOM。`update` 或 `render` 丟出的例外，舞台會接住並記下來（`[stage] update:`／`[stage] render:`），演出照常進行。

## 參數

| 欄位 | 意義 |
|---|---|
| `key` | 路由、自動化和控台用的名字。必填。 |
| `label` | 控台上顯示的文字。預設是 `key`。 |
| `min`, `max` | 範圍。覆寫的值會限制在範圍內，路由也會把訊號縮放到這個範圍。 |
| `def` | 沒有自動化、也沒有覆寫時的值。核心只讀 `def`，只有 `autoSurface()` 另外看得懂 `default`。 |
| `step` | 覆寫的值會對齊到 `step` 的倍數。在時間軸上，有 `step` 的參數會在每個關鍵影格*停住*，不做內插。 |
| `pulse` | 設成 `true`，它就變成一次性的觸發：控台會顯示 *fire*（觸發）按鈕，映射過來的脈衝訊號（或一個往上越過 0.5 的連續訊號）會觸發它，世界用 `params.onPulse(key, cb)` 來聽。脈衝參數在 `state` 裡沒有值。 |
| `group` | 分組用的標籤。聲音引擎的參數用 `'sound'`。`autoSurface()` 會替每一組做一頁手機頁面。 |
| `options` | 有 `step` 的參數，每個值各叫什麼名字（`['Circle', 'Petal', 'Star']`），手機控制面板會把它們顯示成單選按鈕。 |
| `surface` | 給手機控制面板的提示：`{ type, color, label }`。 |

兩個註冊過的世界如果宣告了同一個 key，就共用同一個參數（以先宣告的為準）。

## 大家最常違反的那條規則

**連續控制一律走參數。事件可以直接用訊號。**

如果你的世界在 `update()` 裡直接讀 `signals.get('midi/cc/74')`，它還是會動，至少今天、接你的控制器時會動。但時間軸、舞者、別人的控制器設定檔，就再也推不動它了。你把這場演出焊死在一個輸入上了。改用路由：宣告一個參數，讓映射器接上 `midi/cc/74 → yourParam`，同一個世界誰來都能演奏。

事件不一樣：「按下一個音」「一個和弦解決了」「打到一次起音」是瞬間，不是持續的量。在 `init()` 裡訂閱這些事件是對的，我們也鼓勵這樣做。有了這些事件，世界才會*回應*你，不然它只是被參數推著走。

常用的事件訊號：`midi/note/on` 和 `midi/note/off`（任何鍵盤、螢幕鋼琴、模擬演奏者、手機都會發）、`chord/event`（每一次彈奏做一次分析）、`audio/onset`、`audio/kick`、`drum/kick`。完整清單在[訊號一覽](signals.md)。

## 場景與自動化

時間軸跟世界寫在一起，在呼叫 `createShow()` 時設定：

```js
await createShow({
  world: gardenWorld,
  timeline: {
    total: 120,                                       // seconds
    automation: {
      growth: [[0, 0.6], [40, 1.4], [90, 0.8], [120, 0.2]],   // [t, value], linear between keyframes
      wind:   [[0, 0.05], [60, 0.3], [100, 0.7]],
    },
    scenes: [
      { id: 'dawn',  t: 0,  title: 'Dawn',       note: 'single seeds · listen' },
      { id: 'bloom', t: 40, title: 'Full bloom', note: 'triads — stack real thirds' },
      { id: 'storm', t: 90, title: 'Storm',      note: 'clusters welcome' },
    ],
  },
  modules: { keys: { base: 48 }, chord: true, sound: true },
});
```

- 關鍵影格寫成 `[seconds, value]`，依時間排序。第一個關鍵影格之前取第一個值，最後一個之後取最後一個值。
- 場景依 `t` 排序。`title` 和 `note` 是演奏者在演出模式（<kbd>T</kbd>）裡讀到的文字，下方還會顯示下一個場景和倒數。
- `t` 為負數的場景，是演出開始前的待命段落：設成 `t: -30`，時鐘就從 `-0:30` 開始走。
- 試著**只用**時間軸演出你的世界。如果很無聊，就是少了一個參數。

細節見[演出控制](show-control.md#timeline)。

## 渲染器

舞台本身不帶渲染器。在 `init` 裡建一個，在 `dispose` 裡銷毀。

### 2D canvas

`@openav/stage` 的 `createCanvas(container, { alpha = false })` 回傳 `{ canvas, ctx, fit, dispose }`。`fit()` 讓 canvas 跟容器一樣大（裝置像素比最高到 2），回傳以 CSS 像素計的 `{ w, h }`。在 `render()` 一開頭呼叫它。範例 01、02、03、07、08 和 09 都用它。

### p5.js

在範例的 `index.html` 用 script 標籤載入 p5，再用 instance mode 跑在容器裡。p5 有自己的繪圖迴圈，所以 `update` 只負責存下 state，`render` 留空（範例 05 和 06）：

```html
<script src="https://cdn.jsdelivr.net/npm/p5@1.9.4/lib/p5.min.js"></script>
```

```js
const world = {
  name: 'p5-world',
  params: [{ key: 'hue', min: 0, max: 360, def: 200 }],
  init({ container }) {
    const self = this;
    this.s = {};
    this.p5 = new p5((sk) => {
      sk.setup = () => { sk.createCanvas(container.clientWidth, container.clientHeight); sk.colorMode(sk.HSB); };
      sk.draw = () => { sk.background(self.s.hue ?? 200, 60, 20); };
      sk.windowResized = () => sk.resizeCanvas(container.clientWidth, container.clientHeight);
    }, container);
  },
  update(dt, state) { this.s = state; },
  render() { /* p5 runs its own loop */ },
  dispose() { this.p5?.remove(); },
};
```

### three.js

內附的範例目前都沒用 three.js，寫法如下。把 three 加進範例的 import map（`"three": "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js"`），渲染器存在 `this` 上，所有東西都要 dispose：

```js
import * as THREE from 'three';

const orbit = {
  name: 'orbit',
  params: [{ key: 'spin', min: 0, max: 3, def: 1 }],
  init({ container }) {
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    container.appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    this.camera.position.z = 4;
    this.mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 2), new THREE.MeshNormalMaterial({ wireframe: true }));
    this.scene.add(this.mesh);
  },
  update(dt, s) { this.mesh.rotation.y += dt * s.spin; },
  render() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    if (w !== this.w || h !== this.h) {
      this.w = w; this.h = h;
      this.renderer.setSize(w, h); this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    }
    this.renderer.render(this.scene, this.camera);
  },
  dispose() {
    this.mesh.geometry.dispose(); this.mesh.material.dispose();
    this.renderer.dispose(); this.renderer.domElement.remove();
  },
};
```

### WebToe 節點網路

`@openav/world-webtoe` 的 `webtoeWorld()` 把一張 [WebToe](https://github.com/frank890417/WebToe) 節點網路變成一個世界。節點網路跑在 iframe 裡。哪一格有參數改變，就把算好的參數值傳進 iframe，節點網路裡寫成 `ext('name', fallback)` 的參數都會收到（範例 04）：

```js
import { webtoeWorld } from '@openav/world-webtoe';

const world = webtoeWorld({
  name: 'garden-patch',
  project: new URL('./garden.webtoe.json', location.href).href,   // the app fetches it: CORS must allow it
  params: [
    { key: 'speed', min: 0, max: 1, def: 0.5 },
    { key: 'hue', min: 0, max: 360, def: 205 },
  ],
  // extra: (state, out) => { out.hueRad = state.hue * Math.PI / 180; },   // derive more ext() values
});
```

選項：`name`（預設 `'webtoe'`）、`app`（預設 `https://webtoe.openaudiovisual.com/`）、`project`、`params`、`extra`。

### DOM、SVG、影片

任何東西加進 `container` 都可以。舞台只負責呼叫你的函式。

## 一場演出裡的多個世界

```js
const show = await createShow({ world: calm, worlds: [storm, after], timeline });
// switch on a cue: the old world is disposed, the new one initialized
show.timeline.onSceneChange((i, scene) => {
  if (scene.id === 'storm') show.stage.activate('storm');
});
```

所有世界的參數一開始就會註冊，所以控台和時間軸碰得到每一個世界的參數。那個世界已經啟用的話，`stage.activate(name)` 什麼都不做。

## 從世界輸出聲音

`update(dt, state, io)` 會收到 `io`。用 `createShow()` 時，`io` 裡只有 `signals`。演出建好之後，再把輸出用的物件加上去，每個世界都看得到：

```js
const show = await createShow({ world });
show.stage.io.midi = show.midi;          // the show's @openav/midi engine (MIDI out)
// show.stage.io.osc = osc;              // an OscOut you created (see Show control → OSC output)
```

接著在世界裡：

```js
// trigger a sampler note when something happens in the simulation
io.midi?.noteOn(48 + creature.species * 12, 90, 2);   // note, velocity 0..127, channel 2

// stream a position to a spatializer
io.osc?.send(`/source/${i}/xyz`, [x, y, z]);
```

很多時候，直接在組裝演出的程式裡處理會更簡單，範例 05 就是這樣：`show.signals.on('midi/note/on', ({ note, vel }) => show.midi?.noteOn(note, Math.round(vel * 127), 1))`。要用頁面裡的樂器（平台鋼琴、敲擊琴、弦樂、風琴、合成器音色），請用 `modules.sound`（[演出控制](show-control.md#sound)）。

## 演出前檢查清單

- [ ] 每一個連續控制都是參數（試著**只用**時間軸演出你的世界）
- [ ] `dispose()` 會釋放 GPU 物件和事件訂閱（世界會在演出中即時切換）
- [ ] `dt` 突然變大時，世界撐得住（Loop 會把它限制在 100 ms 以內，但別假設它是 16 ms）
- [ ] 世界裡沒有任何地方直接讀時鐘：時間歸時間軸管
- [ ] 頁面載入時瀏覽器主控台零錯誤，只用螢幕鋼琴也跑得動
