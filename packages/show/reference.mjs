// @openav/show reference: createShow(), the one-call assembly, and the layout rule of its page shell.
// Read by tools/build-reference.mjs (see AGENTS.md, "Documenting a public name").
// createShow takes over the page it runs in (document.body becomes the shell), so its examples are best read as whole programs.

export default {
  createShow: {
    group: 'core',
    signature: 'await createShow({ world, worlds, timeline, routes, modules, artwork, hint, profile, map, onFrame, mount, telemetry, score })',
    summary: {
      en: 'Builds a whole show around a world in one call: signals, params, stage, timeline, mapper, the modules you switch on, the console, the backstage feed and the frame loop.',
      zh: '一個呼叫就替世界組好整場演出：訊號、參數、舞台、時間軸、映射、你開啟的模組、控台、後台資料和影格迴圈。',
    },
    params: [
      {
        name: 'world', type: 'Object | null', optional: true, default: 'null', viaArguments: true,
        en: 'The world to perform: `{ name, params, init, update, render, dispose }` (see [`Stage`](#Stage)). It is activated first, and `createShow` waits for its `init()`.',
        zh: '要表演的世界：`{ name, params, init, update, render, dispose }`（見 [`Stage`](#Stage)）。它會最先被啟用，`createShow` 會等它的 `init()` 完成。',
      },
      {
        name: 'worlds', type: 'Array', optional: true, default: '[]', viaArguments: true,
        en: 'More worlds to register, after `world`. All of their params are registered up front; switch with `show.stage.activate(name)`.',
        zh: '`world` 之外要登記的更多世界。它們的參數會全部先登記好。用 `show.stage.activate(name)` 切換。',
      },
      {
        name: 'timeline', type: 'Object', optional: true, default: '{ total: 120 }', viaArguments: true,
        en: 'The options of the [`Timeline`](#Timeline): `{ total, automation, scenes, start, loop, onCue }`. With a `score`, its scenes and total win.',
        zh: '[`Timeline`](#Timeline) 的選項：`{ total, automation, scenes, start, loop, onCue }`。有 `score` 的時候，以它的場景和總長為準。',
      },
      {
        name: 'routes', type: 'Array', optional: true, default: '[]', viaArguments: true,
        en: 'Routes for the [`Mapper`](#Mapper). If a saved profile exists it is loaded, and any declared route whose `source → target` pair is missing from it is still added.',
        zh: '給 [`Mapper`](#Mapper) 的路由。如果有存起來的 profile 就會載入，其中沒有的 `source → target` 組合，仍然會把你宣告的路由補進去。',
      },
      {
        name: 'modules', type: 'Object', optional: true, default: '{}', viaArguments: true,
        en: 'The inputs and outputs to switch on, by key (see the description): `midi`, `keys`, `drums`, `audio`, `chord`, `hands`, `pose`, `leap`, `remote`, `sound`.',
        zh: '要開啟的輸入與輸出，用鍵名指定（見說明）：`midi`、`keys`、`drums`、`audio`、`chord`、`hands`、`pose`、`leap`、`remote`、`sound`。',
      },
      {
        name: 'artwork', type: 'Object | null', optional: true, default: 'null', viaArguments: true,
        en: '`{ title, artist, year, note }`: a credit line at the bottom right of the stage and a `<meta name="artwork">` tag in the head.',
        zh: '`{ title, artist, year, note }`：舞台右下角的一行作品署名，以及 `<head>` 裡的 `<meta name="artwork">` 標籤。',
      },
      {
        name: 'hint', type: 'String', optional: true, default: '\'\'', viaArguments: true,
        en: 'A line of **HTML** at the bottom left of the stage, for example `\'play the piano · Space plays the timeline\'`. It is inserted as HTML, so never put untrusted text in it.',
        zh: '舞台左下角的一行 **HTML**，例如 `\'play the piano · Space plays the timeline\'`。它是當成 HTML 插入的，所以千萬別放來路不明的文字。',
      },
      {
        name: 'profile', type: 'String | false | null', optional: true, default: 'null', viaArguments: true,
        en: 'The name the mapper saves its routes under in `localStorage` (default: the first world\'s name, else `\'show\'`). `false` ignores the saved routes when the show starts, so the routes come from your code on every load.',
        zh: '映射在 `localStorage` 儲存路由時用的名字（預設是第一個世界的名字，再不然是 `\'show\'`）。`false` 會在演出開始時忽略存起來的路由，所以每次載入路由都來自你的程式。',
      },
      {
        name: 'map', type: 'String | false | null', optional: true, default: 'null', viaArguments: true,
        en: 'A map file to load on start: a same-origin or https address (see [`loadMapUrl()`](#loadMapUrl)). Left out, `?map=<url>` in the page address is used; `false` ignores `?map=`.',
        zh: '開始時要載入的映射檔：同源或 https 的網址（見 [`loadMapUrl()`](#loadMapUrl)）。沒寫的話，使用頁面網址上的 `?map=<url>`。`false` 會忽略 `?map=`。',
      },
      {
        name: 'onFrame', type: 'Function | null', optional: true, default: 'null', viaArguments: true,
        en: 'Called as `onFrame(dt, show)` every frame, after the on-screen performers and the microphone update and **before** the timeline advances. The place for assembly-level logic such as envelopes, or `osc.flush()`.',
        zh: '每個畫面以 `onFrame(dt, show)` 呼叫，在螢幕上的演奏者和麥克風更新之後、時間軸前進**之前**。適合放組裝層級的邏輯，例如包絡，或 `osc.flush()`。',
      },
      {
        name: 'mount', type: 'Object | null', optional: true, default: 'null', viaArguments: true,
        en: '`{ stage, side }`: elements or selectors to render into instead of the generated full-page layout.',
        zh: '`{ stage, side }`：要渲染進去的元素或選擇器，取代自動產生的全頁面版面。',
      },
      {
        name: 'telemetry', type: 'Boolean', optional: true, default: 'true', viaArguments: true,
        en: 'Allow one anonymous `oav_show_start` hit per page load. `false` sends nothing.',
        zh: '是否允許每次載入頁面送出一次匿名的 `oav_show_start`。`false` 什麼都不送。',
      },
      {
        name: 'score', type: 'Object | null', optional: true, default: 'null', viaArguments: true,
        en: '`{ cuts, cut, modules, api, onStatus, onCue, maxStep, midi }`: the show\'s structure as segment lengths, performed by segment modules (see [`Score`](#Score) and [`Director`](#Director)). `?cut=<id>` in the page address picks the version.',
        zh: '`{ cuts, cut, modules, api, onStatus, onCue, maxStep, midi }`：以段落長度寫成的演出結構，由段落模組表演（見 [`Score`](#Score) 和 [`Director`](#Director)）。頁面網址上的 `?cut=<id>` 可以選版本。',
      },
    ],
    returns: {
      type: 'Promise<Object>',
      en: 'The show: `{ signals, params, stage, timeline, mapper, midi, controllers, midiPanel, keys, drums, sound, audio, hands, pose, leap, chord, remote, score, director, scoreMidi, console, app, loop }`. A part you did not ask for is `null`. With a `score` there is also `show.show`, the rehearsal controls. The same object is `window.openav`.',
      zh: '演出物件：`{ signals, params, stage, timeline, mapper, midi, controllers, midiPanel, keys, drums, sound, audio, hands, pose, leap, chord, remote, score, director, scoreMidi, console, app, loop }`。沒有要求的部分是 `null`。有 `score` 的時候還有 `show.show`，也就是排練用的控制。同一個物件也是 `window.openav`。',
    },
    description: [
      {
        en: 'Every example is a world plus one `createShow()` call. It builds the [`Signals`](#Signals) registry, the [`Params`](#Params), the [`Stage`](#Stage) with your world, the [`Timeline`](#Timeline), the [`Mapper`](#Mapper) (with your `routes`), the inputs and outputs you declare in `modules`, the director\'s desk ([`mountConsole()`](#mountConsole)), the backstage feed ([`MonitorFeed`](#MonitorFeed)) and the frame [`Loop`](#Loop), starts the loop, and hands you every part. Nothing is hidden: `show.signals`, `show.params`, `show.timeline`, `show.mapper`, `show.stage` and the rest are the very objects the frame loop runs. When the framework grows a module, every show can have it just by declaring it.',
        zh: '每個範例都是一個世界加上一次 `createShow()` 呼叫。它建好 [`Signals`](#Signals) 登錄表、[`Params`](#Params)、放著你的世界的 [`Stage`](#Stage)、[`Timeline`](#Timeline)、[`Mapper`](#Mapper)（帶著你的 `routes`）、你在 `modules` 宣告的輸入與輸出、導演控台（[`mountConsole()`](#mountConsole)）、後台資料（[`MonitorFeed`](#MonitorFeed)）和影格 [`Loop`](#Loop)，啟動迴圈，再把每個部分交給你。什麼都沒有藏起來：`show.signals`、`show.params`、`show.timeline`、`show.mapper`、`show.stage` 這些，就是影格迴圈實際在跑的那些物件。框架多了一個模組的時候，每場演出只要宣告就能用上。',
      },
      {
        en: 'The `modules` keys: `midi` (on by default, `false` turns it off, `{ controllers: true }` or `{ controllers: { profile, profiles, open } }` docks an on-screen MIDI controller), `keys` (the on-screen piano, QWERTY and the simulated performer: on by default, `false` turns them off, `{ base, octaves, sim, capture }` tunes them), `drums` (`true` or `{ engine, autoEnableEngine }`), `audio` (any truthy value: the microphone analyser, started from the 🎤 button), `chord` (`true` or `{ window }`: a [`ChordDetector`](#ChordDetector) wired to every played note), `hands` (`true`: [`HandTracker`](#HandTracker)), `pose` (`true`: [`PoseTracker`](#PoseTracker)), `leap` (`true` or `{ url, simulate, fingers, box }`: [`LeapInput`](#LeapInput); `?leap=sim` or `?leap=ws://…` in the address overrides), `remote` (`true` or `{ room, … }`: phones as controllers) and `sound` (`true`, an instrument id such as `\'piano\'`, or `{ instrument, remember, picker, engine }`: instruments in the page, loaded only when declared). Parts that fetch things load lazily, so a show that does not declare them pays nothing.',
        zh: '`modules` 的鍵：`midi`（預設開啟，`false` 關掉，`{ controllers: true }` 或 `{ controllers: { profile, profiles, open } }` 會在舞台上停靠一個螢幕上的 MIDI 控制器）、`keys`（螢幕鋼琴、電腦鍵盤和模擬演奏者：預設開啟，`false` 關掉，`{ base, octaves, sim, capture }` 可調整）、`drums`（`true` 或 `{ engine, autoEnableEngine }`）、`audio`（任何真值：麥克風分析器，從 🎤 按鈕啟動）、`chord`（`true` 或 `{ window }`：接上每個被彈奏的音的 [`ChordDetector`](#ChordDetector)）、`hands`（`true`：[`HandTracker`](#HandTracker)）、`pose`（`true`：[`PoseTracker`](#PoseTracker)）、`leap`（`true` 或 `{ url, simulate, fingers, box }`：[`LeapInput`](#LeapInput)，網址上的 `?leap=sim` 或 `?leap=ws://…` 可以覆寫）、`remote`（`true` 或 `{ room, … }`：把手機當控制器）和 `sound`（`true`、像 `\'piano\'` 這樣的樂器 id，或 `{ instrument, remember, picker, engine }`：頁面內的樂器，宣告了才會載入）。需要下載東西的部分都是延遲載入，所以沒宣告的演出不會付出任何代價。',
      },
      {
        en: 'The page shell is fixed once so every show is the same. Without `mount`, the page body becomes a two-column grid: the stage, and a 340 px side panel holding the piano and the console (an upright phone gets the stage on top and the panel below: see [`isStacked()`](#isStacked)). Every frame, in this order:\n\n```text\nkeys, drums, audio update   on-screen performers and the microphone\nonFrame(dt, show)           your hook\ntimeline.advance(dt)        time moves\ndirector.update(...)        with a score: segment modules enter, update, exit\nmapper.update(dt)           smoothed routes settle\nstage.frame(dt, state)      params resolve, world updates and renders\nsound, remote               sound params reach the synth, values echo to phones\nconsole.render(state)       the desk reflects reality\nmonitor.frame(snapshot)     the backstage hears about it\n```',
        zh: '頁面外殼只固定一次，所以每場演出都一樣。沒有 `mount` 的話，頁面的 body 會變成兩欄的格線：舞台，以及放著鋼琴和控台的 340 像素側邊面板（直立的手機則是舞台在上、面板在下：見 [`isStacked()`](#isStacked)）。每個畫面依這個順序做事：\n\n```text\nkeys, drums, audio update   on-screen performers and the microphone\nonFrame(dt, show)           your hook\ntimeline.advance(dt)        time moves\ndirector.update(...)        with a score: segment modules enter, update, exit\nmapper.update(dt)           smoothed routes settle\nstage.frame(dt, state)      params resolve, world updates and renders\nsound, remote               sound params reach the synth, values echo to phones\nconsole.render(state)       the desk reflects reality\nmonitor.frame(snapshot)     the backstage hears about it\n```',
      },
    ],
    needs: {
      en: '`await` it: it is async because it waits for the world\'s `init()` (and for lazily loaded modules). It needs a page (`document`, `location`, `localStorage`), and an import map or bundler that resolves every `@openav/*` package it imports (copy the one from `examples/01-hello-particles/index.html`). Browsers start audio only after a click, so sound and the microphone start from the console\'s buttons.',
      zh: '要 `await` 它：它是非同步的，因為要等世界的 `init()`（和延遲載入的模組）完成。它需要一個頁面（`document`、`location`、`localStorage`），還要有能解析它所匯入的每個 `@openav/*` 套件的 import map 或打包工具（可以複製 `examples/01-hello-particles/index.html` 裡的那份）。瀏覽器要等點擊之後才會啟動聲音，所以聲音和麥克風要從控台的按鈕啟動。',
    },
    notes: [
      {
        en: 'The mapper saves its routes under the profile name every 3 seconds, so a learned or edited route survives a reload and **wins over a changed declaration in your code** (the same `source → target` pair keeps its saved curve and smoothing). `profile: false` makes the routes come from code on every load, but the mapper still saves under the world\'s name from then on. To start clean, `localStorage.removeItem(\'openav.map.<world name>\')`.',
        zh: '映射每 3 秒把路由存在 profile 名稱底下，所以學來的或改過的路由，重新載入之後還在，而且**會贏過你在程式裡改過的宣告**（同一個 `source → target` 組合會保留存起來的曲線和平滑）。`profile: false` 讓路由每次載入都來自程式，但映射之後仍然會用世界的名字存檔。要從頭開始，執行 `localStorage.removeItem(\'openav.map.<世界名稱>\')`。',
      },
      {
        en: 'Routes are added before the sound engine registers its `sound/*` params, so a declared route to `sound/cutoff` needs an explicit `outMin: 100, outMax: 8000`.',
        zh: '路由加進去的時間比聲音引擎登記 `sound/*` 參數還早，所以宣告接到 `sound/cutoff` 的路由要明確寫上 `outMin: 100, outMax: 8000`。',
      },
      {
        en: '`show.params.resolve()` without an argument gives the `def` of every param. To read what the world sees this frame, pass the timeline\'s base state: `show.params.resolve(show.timeline.state())`.',
        zh: '`show.params.resolve()` 不給參數的話，回傳的是每個參數的 `def`。想讀世界這個畫面看到的值，要傳入時間軸的基準狀態：`show.params.resolve(show.timeline.state())`。',
      },
      {
        en: 'Unless `telemetry: false`, one anonymous `oav_show_start` hit goes to Google Analytics per page load. Per the code it is silent on localhost, LAN addresses, `file://` and openaudiovisual.com itself, and it honours Do Not Track and Global Privacy Control. Nothing played, no path, no cookie and no stable id is sent.',
        zh: '除非 `telemetry: false`，每次載入頁面會有一次匿名的 `oav_show_start` 送到 Google Analytics。依程式碼，在 localhost、區域網路位址、`file://` 和 openaudiovisual.com 本身都不會送，也尊重 Do Not Track 和 Global Privacy Control。彈了什麼、頁面路徑、cookie 和固定的識別碼都不會送。',
      },
      {
        en: 'With a `score`, `window.openav.show` has `table()`, `goto(\'dusk\')`, `goto(\'dusk.glow\')`, `goto(2)`, `seek(T)`, `cue(name)`, `status()`, `next()`, `prev()` and `cuts`, for rehearsal from the devtools console.',
        zh: '有 `score` 的時候，`window.openav.show` 有 `table()`、`goto(\'dusk\')`、`goto(\'dusk.glow\')`、`goto(2)`、`seek(T)`、`cue(name)`、`status()`、`next()`、`prev()` 和 `cuts`，可以在開發者工具的主控台排練。',
      },
    ],
    tbd: [
      {
        en: 'The modules that need hardware, a permission or a download (microphone, camera, Leap, phones, the Tone.js sound engine, a MIDI device) were not run here; they are described from the code and the package docs. The examples switch `midi` and `keys` off so that they run anywhere.',
        zh: '需要硬體、權限或下載的模組（麥克風、鏡頭、Leap、手機、Tone.js 聲音引擎、MIDI 裝置）沒有在這裡跑過，說明是根據程式碼和套件文件寫的。範例把 `midi` 和 `keys` 關掉，這樣在哪裡都能跑。',
      },
    ],
    examples: [
      {
        code: `import { createShow } from '@openav/show';
import { createCanvas } from '@openav/stage';

const world = {
  name: 'dot',
  params: [{ key: 'size', label: 'Size', min: 0, max: 1, def: 0.3 }],
  init({ container }) { this.view = createCanvas(container); },
  update(dt, state) { this.size = state.size; },
  render() {
    const { ctx } = this.view, { w, h } = this.view.fit();
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#7ea6ff'; ctx.beginPath(); ctx.arc(w / 2, h / 2, this.size * h / 2, 0, Math.PI * 2); ctx.fill();
  },
  dispose() { this.view.dispose(); },
};

const show = await createShow({
  world,
  timeline: { total: 60, automation: { size: [[0, 0.1], [60, 0.9]] } },
  modules: { midi: false, keys: false },     // nothing to plug in
  telemetry: false,
});
show.timeline.play();                        // the dot grows over a minute
console.log(Object.keys(show).length, show.timeline.playing);`,
        caption: { en: 'A blue dot on the stage grows slowly while the timeline plays, with the desk (transport, layers, the `size` slider) on the right. The console prints `23 true`: twenty-three parts, and the timeline is playing.', zh: '舞台上的藍色圓點隨時間軸播放慢慢變大，右邊是控台（播放控制、圖層、`size` 推桿）。主控台印出 `23 true`：二十三個部分，時間軸正在播放。' },
      },
      {
        code: `import { createShow } from '@openav/show';

const world = {
  name: 'glow',
  params: [{ key: 'size', min: 0, max: 1, def: 0.3 }, { key: 'burst', pulse: true }],
  init() {},
  update(dt, state) { this.last = state; },
};
const show = await createShow({
  world,
  routes: [{ source: 'midi/cc/1', target: 'size' }, { source: 'pad/1', target: 'burst' }],
  modules: { midi: false, keys: false },
  profile: false,                            // routes come from this code on every load
  telemetry: false,
});

show.params.onPulse('burst', () => console.log('burst!'));
show.signals.set('midi/cc/1', 0.9);          // what a knob would do
console.log(show.params.isOverridden('size'), show.params.resolve(show.timeline.state()).size);   // true 0.9
show.signals.set('pad/1', 0);
show.signals.set('pad/1', 1);                // a continuous source rising past 0.5 fires a pulse param
setTimeout(() => console.log('the world heard', world.last.size), 200);`,
        caption: { en: 'A signal drives a param through a route: the console prints `true 0.9`, then `burst!` as the pad crosses 0.5, then `the world heard 0.9`.', zh: '一個訊號透過路由驅動一個參數：主控台印出 `true 0.9`，接著是墊子越過 0.5 時的 `burst!`，最後是 `the world heard 0.9`。' },
      },
      {
        code: `import { createShow } from '@openav/show';

const world = { name: 'sky', params: [{ key: 'sun', min: 0, max: 1, def: 0 }], init() {}, update() {} };
const dusk = {
  id: 'dusk',
  enter() { console.log('dusk enters'); },
  param: (key, value, ctx) => (key === 'sun' ? 1 - ctx.p : value),     // the segment bends the sun param
};
const show = await createShow({
  world,
  modules: { midi: false, keys: false },
  telemetry: false,
  profile: false,
  score: { cuts: [{ id: 'full', segments: [{ id: 'dawn', dur: 10 }, { id: 'dusk', dur: 10 }] }], modules: [dusk] },
});
console.log(show.score.total, show.timeline.total);     // 20 20: the timeline takes its length from the score
show.show.goto('dusk');                                  // rehearsal control: jump to a segment
setTimeout(() => console.log(show.show.status().segment.id, show.timeline.t), 300);`,
        caption: { en: 'With a score the timeline takes its length from it: the console prints `20 20`, then `dusk enters` after the jump, and `dusk 10`.', zh: '有總譜的時候，時間軸的長度由它決定：主控台印出 `20 20`，跳轉之後印出 `dusk enters`，最後是 `dusk 10`。' },
      },
      {
        code: `import { createShow } from '@openav/show';

const show = await createShow({
  world,                                         // your world
  timeline: { total: 120, automation, scenes },
  routes: [{ source: 'audio/rms', target: 'energy', inMax: 0.3, smooth: 0.1 }],
  modules: { keys: { base: 48 }, chord: true, audio: true, sound: 'piano' },
  artwork: { title: 'Untitled', artist: 'You', year: 2026 },
  hint: 'play the piano · Space plays the timeline',
});
show.signals.on('chord/event', (a) => console.log(a.chordType));`,
        caption: { en: 'The whole set: an on-screen piano, chord analysis, the microphone and a grand piano that sounds after a click on the console\'s sound button. Play a chord and the console prints its type (`major`).', zh: '完整的一套：螢幕鋼琴、和弦分析、麥克風，以及在控台上按一下聲音按鈕之後就會發聲的平台鋼琴。彈一個和弦，主控台就印出它的類型（`major`）。' },
        run: 'static',
        why: 'It is an outline, not a runnable program (`world`, `automation` and `scenes` are yours), and it needs a click, the microphone permission and a download of piano samples.',
      },
    ],
    related: ['Signals', 'Params', 'Loop', 'Stage', 'Timeline', 'Mapper', 'mountConsole', 'MonitorFeed', 'Score', 'Director', 'ChordDetector', 'LeapInput', 'isStacked'],
    keywords: {
      en: ['createShow', 'show', 'assembly', 'factory', 'one call', 'setup', 'modules', 'world', 'routes', 'timeline', 'console', 'window.openav', 'boot', 'start'],
      zh: ['createShow', '演出', '組裝', '一個呼叫', '設定', '模組', '世界', '路由', '時間軸', '控台', 'window.openav', '啟動'],
    },
  },

  isStacked: {
    group: 'core',
    summary: {
      en: 'Whether a window of this size gets the stacked layout (stage on top, panel below): upright and no wider than 820 pixels.',
      zh: '這個大小的視窗會不會用堆疊版面（舞台在上、面板在下）：直立的、而且寬度不超過 820 像素。',
    },
    params: [
      { name: 'width', type: 'Number', en: 'The window width in pixels.', zh: '視窗寬度，單位是像素。' },
      { name: 'height', type: 'Number', en: 'The window height in pixels.', zh: '視窗高度，單位是像素。' },
    ],
    returns: {
      type: 'Boolean',
      en: '`true` when `width <= 820` and `height > width`.',
      zh: '`width <= 820` 而且 `height > width` 的時候是 `true`。',
    },
    description: [
      {
        en: 'The shell of [`createShow()`](#createShow) has one layout rule: wide windows get the stage and a 340 px side panel next to each other, and an upright phone or small tablet gets the stage on top and the panel below it, scrolling. The rule is the media query [`STACK_QUERY`](#STACK_QUERY), and `isStacked()` is the very same decision as a plain function, so a test (or your own layout code) can use it without a browser. A phone on its side is never taller than wide, so it stays in the wide layout.',
        zh: '[`createShow()`](#createShow) 的外殼只有一條版面規則：寬的視窗是舞台和 340 像素的側邊面板並排，直立的手機或小平板則是舞台在上、面板在下並可以捲動。規則就是媒體查詢 [`STACK_QUERY`](#STACK_QUERY)，而 `isStacked()` 是同一個判斷的純函式版本，所以測試（或你自己的版面程式）不用瀏覽器也能用。橫放的手機高度不會比寬度大，所以仍然是寬版面。',
      },
    ],
    examples: [
      {
        code: `import { isStacked, stageHeight } from '@openav/show/layout';

console.log(isStacked(390, 844));     // true: a phone held upright
console.log(isStacked(844, 390));     // false: the same phone on its side
console.log(isStacked(820, 1180));    // true: a small tablet held upright
console.log(isStacked(1024, 1366));   // false: wider than 820, even though it is upright
console.log(stageHeight(844));        // 490: the stage keeps 58% of the window height`,
        caption: { en: 'The console prints `true`, `false`, `true`, `false`, then `490`.', zh: '主控台印出 `true`、`false`、`true`、`false`，然後是 `490`。' },
      },
    ],
    related: ['stageHeight', 'STACK_QUERY', 'STACK_MAX_WIDTH', 'STAGE_SHARE', 'SHELL_CSS', 'createShow'],
    keywords: {
      en: ['stacked layout', 'responsive', 'phone layout', 'portrait', 'breakpoint', 'layout rule', '820'],
      zh: ['堆疊版面', '響應式', '手機版面', '直式', '斷點', '版面規則', '820'],
    },
  },

  stageHeight: {
    group: 'core',
    summary: {
      en: 'The stage height in pixels for a window of this height when the layout is stacked: 58% of it, rounded.',
      zh: '版面堆疊的時候，這個高度的視窗裡舞台的高度（像素）：它的 58%，四捨五入。',
    },
    params: [
      { name: 'height', type: 'Number', en: 'The window height in pixels.', zh: '視窗高度，單位是像素。' },
    ],
    returns: {
      type: 'Number',
      en: 'A number: `Math.round(height * 58 / 100)`.',
      zh: '一個數字：`Math.round(height * 58 / 100)`。',
    },
    description: [
      {
        en: 'When the shell stacks, the stage must stay the main thing, so it takes [`STAGE_SHARE`](#STAGE_SHARE) percent of the window height (the CSS uses `58vh`, and `58dvh` where the browser has it) and the panel gets the rest. This is the same number as a function, for tests and your own layout code.',
        zh: '外殼堆疊的時候，舞台必須仍然是主角，所以它佔視窗高度的 [`STAGE_SHARE`](#STAGE_SHARE) 百分比（CSS 用 `58vh`，瀏覽器支援的話用 `58dvh`），面板拿剩下的。這是同一個數字的函式版本，給測試和你自己的版面程式用。',
      },
    ],
    examples: [
      {
        code: `import { stageHeight } from '@openav/show/layout';

for (const height of [667, 844, 1180]) console.log(height, stageHeight(height));   // 667 387, 844 490, 1180 684`,
        caption: { en: 'The console prints `667 387`, `844 490` and `1180 684`.', zh: '主控台印出 `667 387`、`844 490` 和 `1180 684`。' },
      },
    ],
    related: ['isStacked', 'STAGE_SHARE', 'STACK_QUERY', 'createShow'],
    keywords: {
      en: ['stage height', 'stacked', 'layout', '58%', 'vh'],
      zh: ['舞台高度', '堆疊', '版面', '58%', 'vh'],
    },
  },

  STACK_MAX_WIDTH: {
    group: 'core',
    summary: {
      en: 'The widest window that can get the stacked layout: 820 pixels (a small tablet held upright).',
      zh: '能用堆疊版面的最寬視窗：820 像素（直立的小平板）。',
    },
    description: [
      {
        en: 'Used inside [`STACK_QUERY`](#STACK_QUERY) and [`isStacked()`](#isStacked), so the CSS rule and the function cannot drift apart. Above 820 pixels the stage and the 340 px panel always sit side by side.',
        zh: '用在 [`STACK_QUERY`](#STACK_QUERY) 和 [`isStacked()`](#isStacked) 裡面，所以 CSS 規則和函式不會彼此走樣。超過 820 像素，舞台和 340 像素的面板一律是並排的。',
      },
    ],
    related: ['STACK_QUERY', 'isStacked', 'STAGE_SHARE'],
    keywords: {
      en: ['820', 'breakpoint', 'max width', 'stacked layout', 'tablet'],
      zh: ['820', '斷點', '最大寬度', '堆疊版面', '平板'],
    },
  },

  STACK_QUERY: {
    group: 'core',
    summary: {
      en: 'The media query behind the stacked layout: `(max-width: 820px) and (orientation: portrait)`.',
      zh: '堆疊版面背後的媒體查詢：`(max-width: 820px) and (orientation: portrait)`。',
    },
    description: [
      {
        en: 'It is a string you can hand to `matchMedia()` to ask the browser the same question the shell\'s CSS asks: `matchMedia(STACK_QUERY).matches`. [`isStacked(width, height)`](#isStacked) is the same decision from numbers.',
        zh: '這是一個字串，可以交給 `matchMedia()`，問瀏覽器跟外殼的 CSS 同一個問題：`matchMedia(STACK_QUERY).matches`。[`isStacked(width, height)`](#isStacked) 是用數字做的同一個判斷。',
      },
    ],
    examples: [
      {
        code: `import { STACK_QUERY } from '@openav/show/layout';

const query = matchMedia(STACK_QUERY);
console.log(STACK_QUERY, query.matches);          // the window this runs in is not an upright phone: false
query.addEventListener('change', (e) => console.log('stacked now?', e.matches));`,
        caption: { en: 'The console prints the query and whether this window matches it (usually `false` on a desktop); the last line logs again whenever the window is resized across the rule.', zh: '主控台印出這個查詢，以及目前的視窗符不符合（在桌機上通常是 `false`）。最後一行在視窗大小跨過這條規則的時候會再印一次。' },
      },
    ],
    related: ['isStacked', 'STACK_MAX_WIDTH', 'STAGE_SHARE', 'SHELL_CSS'],
    keywords: {
      en: ['media query', 'matchMedia', 'portrait', 'stacked layout', 'responsive'],
      zh: ['媒體查詢', 'matchMedia', '直式', '堆疊版面', '響應式'],
    },
  },

  STAGE_SHARE: {
    group: 'core',
    summary: {
      en: 'How much of the window height the stage keeps when the layout is stacked: 58 (percent).',
      zh: '版面堆疊的時候，舞台保有視窗高度的多少：58（百分比）。',
    },
    description: [
      {
        en: 'The stage must stay the main thing on a phone, so it keeps 58% of the height and the console below it scrolls. [`stageHeight()`](#stageHeight) turns this number into pixels.',
        zh: '在手機上，舞台必須仍然是主角，所以它保有 58% 的高度，下方的控台可以捲動。[`stageHeight()`](#stageHeight) 把這個數字換算成像素。',
      },
    ],
    related: ['stageHeight', 'isStacked', 'STACK_QUERY'],
    keywords: {
      en: ['58', 'stage share', 'stage height', 'percent', 'stacked layout'],
      zh: ['58', '舞台比例', '舞台高度', '百分比', '堆疊版面'],
    },
  },

  SHELL_CSS: {
    group: 'core',
    summary: {
      en: 'The CSS text `createShow()` puts in the page: the two-column grid, the 340 px side panel, the hint and credit styles, and the stacked layout.',
      zh: '`createShow()` 放進頁面的 CSS 文字：兩欄格線、340 像素的側邊面板、提示與署名的樣式，以及堆疊版面。',
    },
    description: [
      {
        en: 'A string. `createShow()` adds it once as `<style id="openav-shell-css">` (unless one with that id is already there). It sets the page body to a grid of the stage and a 340 px side panel, with the classes `.oav-stage`, `.oav-side`, `.oav-keys-slot`, `.oav-desk`, `.oav-hint` and `.oav-credit`, and the stacked layout from [`STACK_QUERY`](#STACK_QUERY). Read it to see what the shell does to your page, or add a `<style id="openav-shell-css">` of your own before calling `createShow()` to replace it entirely.',
        zh: '一個字串。`createShow()` 會把它用 `<style id="openav-shell-css">` 加進頁面一次（除非已經有同 id 的）。它把頁面 body 設成舞台加上 340 像素側邊面板的格線，用到 `.oav-stage`、`.oav-side`、`.oav-keys-slot`、`.oav-desk`、`.oav-hint` 和 `.oav-credit` 這些 class，以及來自 [`STACK_QUERY`](#STACK_QUERY) 的堆疊版面。想知道外殼對你的頁面做了什麼就讀它。或在呼叫 `createShow()` 之前，自己先放一個 `<style id="openav-shell-css">`，就能整個取代它。',
      },
    ],
    examples: [
      {
        code: `import { SHELL_CSS } from '@openav/show/layout';

console.log(SHELL_CSS.includes('.oav-stage'), SHELL_CSS.includes('340px'), SHELL_CSS.length > 500);   // true true true
console.log(SHELL_CSS.split('\\n').slice(1, 4).join('\\n'));      // the first rules: body is a grid`,
        caption: { en: 'The console prints `true true true`, then the first lines of the stylesheet (the body grid).', zh: '主控台印出 `true true true`，接著是樣式表最前面的幾行（body 的格線）。' },
      },
    ],
    related: ['createShow', 'STACK_QUERY', 'isStacked'],
    keywords: {
      en: ['shell css', 'stylesheet', 'layout css', 'oav-stage', 'oav-side', 'grid', 'openav-shell-css'],
      zh: ['外殼 css', '樣式表', '版面 css', 'oav-stage', 'oav-side', '格線', 'openav-shell-css'],
    },
  },
};
