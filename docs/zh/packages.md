# 套件一覽

二十個套件放在 `packages/<name>/`。每一個都是純 ES module，沒有任何相依套件。在網頁裡透過 import map，用 `@openav/<name>` 引入（照抄 `examples/01-hello-particles/index.html` 裡那份就好）。目前還沒有發布到 npm。

| 層 | 套件 |
|---|---|
| L1 輸入 | `midi` · `audio` · `chord` · `pose` · `keys` · `drums` |
| L2 映射 | `mapping` |
| L3 世界 | `stage` · `world-webtoe` |
| L4 輸出 | `sound` · `osc`（MIDI 輸出在 `midi` 裡） |
| 主軸 | `timeline` · `console` · `monitor` |
| 手機 | `relay` · `surface` · `remote` |
| 膠水 | `core` · `show` · `mcp` |

子路徑入口（`@openav/remote/host`、`@openav/relay/server`、`@openav/surface/layout`、`@openav/surface/auto`）在瀏覽器裡要各自在 import map 加一行，例如 `"@openav/remote/host": "../../packages/remote/host.js"`。

## @openav/core

膠水 · 共用的語言：`Signals`、`Params`、`Loop`、`Bus`。

| 匯出 | 簽章 |
|---|---|
| `Signals` | `new Signals()` · `define(name, { kind, min, max, unit, description, source })` · `set(name, value)` · `pulse(name, payload = 1)` · `get(name)` · `norm(name)` → 0..1 · `on(name, cb(value, name))` → 取消訂閱函式 · `onAny(cb(name, value, meta))` → 取消訂閱函式 · `list()` → `[{ name, value, at, kind, min, max, … }]` |
| `Params` | `new Params(schema = [])` · `add(entries)` · `get(key)` · `clamp(key, v)` · `override(key, v)` · `clearOverride(key)` · `clearAllOverrides()` · `isOverridden(key)` · `firePulse(key)` · `onPulse(key, cb)` → 取消訂閱函式 · `resolve(base)` → 狀態 · `schema`、`overrides` |
| `Loop` | `new Loop(onFrame(dt, now), { maxDt = 0.1 })` · `start()` · `stop()` · `fps` |
| `Bus` | `new Bus()` · `on(event, cb)` → 取消訂閱函式 · `off(event, cb)` · `emit(event, payload)` |

```js
import { Signals, Params, Loop } from '@openav/core';
const signals = new Signals();
signals.define('breath/pressure', { min: 0, max: 1 });
signals.on('breath/pressure', (v) => console.log(v));
signals.set('breath/pressure', 0.4);
```

## @openav/show

膠水 · `createShow(options)`：呼叫一次，以一個世界為中心組好整場演出，再把每個部分交給你。選項、模組和回傳值見[演出控制](show-control.md#createshow)。

```js
import { createShow } from '@openav/show';
const show = await createShow({ world, modules: { keys: { base: 48 }, sound: true } });
```

## @openav/midi

L1 輸入與 L4 輸出 · Web MIDI 的輸入與輸出，可以同時接很多台裝置，還有照實體硬體做的螢幕控制器。

| 匯出 | 簽章 |
|---|---|
| `Midi` | `new Midi({ signals, filterOut = 'IAC', requestAccess })` · `enable(preferredOut = '')` → `Promise<boolean>` · `devices()` → `[{ slug, name, listening }]` · `setListening(slug, on)` · `onDevices(fn)` · `listen(fn(bytes, port))` · `selectOutput(name)` · `outputFor(nameOrRegExp)` · `send(bytes)` · `noteOn(note, vel = 100, ch = 1)` · `noteOff(note, ch = 1)` · `cc(cc, val, ch = 1)` · `panic()` · `dispose()` · hook：`onCC`、`onNote`、`onMessage`、`onSend`、`onDeviceChange` |
| 解析 | `parseMessage(bytes)` → 事件 · `encodeMessage(event)` → 位元組 · `genericSignals(event, { device })` · `publish(signals, list)` · `describe(event)` · `relativeDelta(value, mode)`、`relativeValue(delta, mode)`、`RELATIVE_MODES` · `bendToUnit`、`unitToBend`、`BEND_CENTER` |
| 控制器 | `MidiController`、`MidiControllers`、`controllerRoutes(profile, bindings)`、`PROFILES`、`profileById(id)`、`ControllerView`、`mountMidiPanel(el, controllers, opts)`、`linkControllers`，以及 profile 輔助函式（`validateProfile`、`normalizeProfile`、`matchProfile`…） |
| Web MIDI shim | `createVirtualMIDIAccess(opts)`、`virtualRequestMIDIAccess` |
| 嵌入 | `createController(profile, { profiles, signals, channel, follow, midi, requestAccess, filterOut, telemetry })` → `ControllerHost`（`on(event, fn)`、`set`、`press`、`release`、`values`、`mount(el)`、`learn()`、`dispose()`）· `loadProfile(idOrUrl)` · `packages/midi/element.js` 裡的 `<oav-controller>` 元素 · `embed.js` 裡的嵌入協定輔助函式 |

```js
import { Midi } from '@openav/midi';
const midi = new Midi({ signals });
await midi.enable();
midi.noteOn(60, 100, 1);
```

訊號：見[訊號一覽](signals.md#openavmidi)。控制器、profile 和 shim：見 [MIDI 控制器與嵌入](controllers.md)。

## @openav/audio

L1 輸入 · 麥克風（或任何音訊節點）的分析。

| 匯出 | 簽章 |
|---|---|
| `AudioAnalyzer` | `new AudioAnalyzer({ signals, fftSize = 2048, smooth = 0.7 })` · `enableMic()` · `enableElement(mediaEl)` · `input()` → 一個可以接進去的 `AnalyserNode` · 每個影格呼叫 `update()` → `{ rms, peak, low, mid, high, centroid, onset, kick, snare, hat }` |

```js
import { AudioAnalyzer } from '@openav/audio';
const audio = new AudioAnalyzer({ signals });
await audio.enableMic();          // from a click
// every frame: audio.update();
```

## @openav/chord

L1 輸入（一種分析器）· 把彈下的音歸成一次一次的彈奏（gesture），發布協和度、三和弦和音堆。

| 匯出 | 簽章 |
|---|---|
| `ChordDetector` | `new ChordDetector({ window = 80, onChord, signals })` · `noteOn(note, vel = 0.8)` · `noteOff(note)` · `analyze(notes, vels)` → 分析結果（純函式） |

```js
import { ChordDetector } from '@openav/chord';
const chord = new ChordDetector({ signals });
signals.on('midi/note/on', ({ note, vel }) => chord.noteOn(note, vel));
signals.on('midi/note/off', ({ note }) => chord.noteOff(note));
chord.analyze([60, 64, 67]).chordType;   // 'major'
```

## @openav/pose

L1 輸入 · 用 MediaPipe 從鏡頭追蹤身體和手，全部在本機運算。

| 匯出 | 簽章 |
|---|---|
| `PoseTracker` | `new PoseTracker({ signals, mirror = true })` · `enable({ videoEl })`（要從點擊事件呼叫）· `stop()` · `skeleton(ctx, w, h, { color, lineWidth })` · `landmarks`、`running` |
| `HandTracker` | `new HandTracker({ signals, mirror = true })` · `enable({ videoEl })` · `stop()` · `skeleton(ctx, w, h, { colorLeft, colorRight, lineWidth })` · `hands`、`running` |

```js
import { HandTracker } from '@openav/pose';
const hands = new HandTracker({ signals });
button.onclick = () => hands.enable();
```

## @openav/keys

L1 輸入 · 螢幕鋼琴、電腦鍵盤演奏和一位模擬演奏者，全都發布 `midi/note/on|off`。

| 匯出 | 簽章 |
|---|---|
| `mountKeys` | `mountKeys(container, { signals, chord, base = 48, octaves = 2, sim = true, capture = true })` → `{ piano, sim, update(dt), dispose(), captureBox }` |
| `KeysPiano` | `new KeysPiano(container, { base, octaves, semitones, fill, keyWidth, velocity, minBase, maxBase, onNote, onOctave })` · `press(note, vel01)` · `release(note)` · `releaseAll()` · `setBase(n)` · `handleKeyDown(e)`、`handleKeyUp(e)` · `captureEnabled` |
| `SimPlayer` | `new SimPlayer({ press, release, base = 60, scale = [0, 2, 4, 7, 9], density = 1 })` · `toggle(on)` · `update(dt)` |
| `PIANO_KEYMAP` | `{ a: 0, w: 1, s: 2, … ';': 16 }` |

```js
import { mountKeys } from '@openav/keys';
const keys = mountKeys(document.querySelector('#keys'), { signals, base: 48 });
// every frame: keys.update(dt);
```

## @openav/drums

L1 輸入與 L4 輸出 · 合成鼓組、16 步音序器和它的格狀介面。發布的 `drum/*` 跟麥克風偵測鼓點時的長得一樣。

| 匯出 | 簽章 |
|---|---|
| `mountDrums` | `mountDrums(container, { signals, engine, autoEnableEngine = true })` → `{ seq, engine, update(dt), dispose() }` |
| `DrumSequencer` | `new DrumSequencer({ onHit(lane, vel), bpm = 112, swing = 0.12, humanize = 0.35, pattern = 'four on floor' })` · `setPattern(name)` · `toggleCell(lane, i)` · `toggle(on)` · `update(dt)` · `grid`、`bpm` |
| `drumEngine` | `drumEngine({ samples })` → 一個聲音引擎（見[聲音](show-control.md#sound)） |
| `PATTERNS`、`GM` | 節奏型預設，以及 General MIDI 鼓的音符編號 `{ kick: 36, snare: 38, clap: 39, tom: 45, hat: 42, openhat: 46 }` |

```js
import { mountDrums } from '@openav/drums';
const drums = mountDrums(document.querySelector('#drums'), { signals });
// every frame: drums.update(dt);
```

## @openav/mapping

L2 映射 · 從訊號接到參數的路由，含曲線、平滑、learn，以及可以存檔的設定組（profile）。

| 匯出 | 簽章 |
|---|---|
| `Mapper` | `new Mapper({ signals, params, profile = 'default', onChange, onLearn })` · `addRoute(route)` · `removeRoute(id)` · `routesFor(target)` · `learn(target)` · `update(dt)` · `toJSON()` · `fromJSON(routes)` · `save()` · `load()` · `dispose()` · `routes`、`learnTarget` |

```js
import { Mapper } from '@openav/mapping';
const mapper = new Mapper({ signals, params });
mapper.addRoute({ source: 'midi/cc/74', target: 'bloom', curve: 'exp', smooth: 0.1 });
// every frame: mapper.update(dt);
```

完整說明：見[映射](mapping.md)。

## @openav/stage

L3 世界 · 世界的外殼：管生命週期、彙整參數，本身不負責繪圖。

| 匯出 | 簽章 |
|---|---|
| `Stage` | `new Stage({ container, params, signals, io = {} })` · `register(world)` · `activate(name)`（非同步）· `frame(dt, baseState)` → 狀態 · `active`、`activeName`、`worlds`、`io` |
| `createCanvas` | `createCanvas(container, { alpha = false })` → `{ canvas, ctx, fit() → { w, h }, dispose() }` |

```js
import { Stage, createCanvas } from '@openav/stage';
const stage = new Stage({ container, params, signals });
stage.register(world);
await stage.activate(world.name);
// every frame: const state = stage.frame(dt, timeline.state());
```

## @openav/world-webtoe

L3 世界 · 把一張 [WebToe](https://github.com/frank890417/WebToe) 節點網路當成世界來演奏，參數會送進網路裡的 `ext('name', fallback)` 綁定。

| 匯出 | 簽章 |
|---|---|
| `webtoeWorld` | `webtoeWorld({ name = 'webtoe', app = 'https://webtoe.openaudiovisual.com/', project, params = [], extra })` → 一個世界 |

見[寫一個世界](writing-a-world.md#a-webtoe-patch)。

## @openav/sound

L4 輸出 · 頁面裡的合成器，背後是一份精簡的引擎介面約定，引擎的參數會變成 `sound/*` 參數。

| 匯出 | 簽章 |
|---|---|
| `Sound` | `new Sound({ signals, params, engine })` · `enable()`（要從點擊事件呼叫）· 每個影格呼叫 `update(state)` · `dispose()` · `enabled` |
| `toneEngine` | `toneEngine({ cdn })` → 帶有 `cutoff`、`space`、`volume` 參數的引擎 |

引擎介面約定：`{ params, enable(), noteOn(note, vel01), noteOff(note), set(key, value), dispose() }`。

```js
import { Sound, toneEngine } from '@openav/sound';
const sound = new Sound({ signals, params, engine: toneEngine() });
button.onclick = () => sound.enable();
// every frame: sound.update(state);
```

## @openav/osc

L4 輸出 · 透過一個小小的 Node 橋接程式，把 OSC 從瀏覽器送到 UDP。

| 匯出 | 簽章 |
|---|---|
| `OscOut` | `new OscOut(url = 'http://127.0.0.1:7456')` · `enable()` → `Promise<boolean>` · `disable()` · `send(addr, args)` · 每個影格呼叫 `flush()` · `rate()` → 上次呼叫之後送出的訊息數 · hook：`onStatus(ok, info)`、`onMsg(addr, args)` |
| 橋接 | `node packages/osc/bridges/osc-bridge.js [httpPort=7456] [targetHost=127.0.0.1] [targetPort=3456]` |

見[演出控制](show-control.md#osc-output)。

## @openav/timeline

主軸 · 自動化、場景和播放控制（transport），純邏輯。

| 匯出 | 簽章 |
|---|---|
| `Timeline` | `new Timeline({ params, automation = {}, scenes = [], total = 600 })` · `play()`、`pause()`、`toggle()`、`seek(t)`、`jumpScene(d)`、`reset()` · `advance(dt)` · `state(t)`、`valueAt(key, t)` · `sceneIndexAt(t)`、`currentScene(t)`、`sceneEnd(i)` · `onSceneChange(cb(i, scene))` · `t`、`playing`、`rate`、`total` |

見[演出控制](show-control.md#timeline)。

## @openav/console

主軸 · 導演控台：播放控制、各層面板、可以 learn 的參數、訊號儀表、演出模式。

| 匯出 | 簽章 |
|---|---|
| `mountConsole` | `mountConsole(el, app, { layers, signals })` → `{ render(state), perf, dispose() }`。`app` = `{ timeline, params, mapper, signals, stage, midi?, sound?, audio?, hands?, pose?, loop?, osc? }` |

見[演出控制](show-control.md#the-console)。

## @openav/monitor

主軸 · 後台頁面，以及餵資料給它的 WebSocket 中繼。

| 匯出 | 簽章 |
|---|---|
| `MonitorFeed` | `new MonitorFeed({ url = 'ws://<page host>:7457', hz = 15 })` · `connect()` · `frame(snapshot)` · `connected`、`onStatus` |
| `snapshotOf` | `snapshotOf({ timeline, params, signals, stage, loop }, state)` → 一份 JSON 快照 |
| 伺服器 | `node packages/monitor/server.js [port=7457]`：後台頁面在 `/`，另有 `/health` |

見[演出控制](show-control.md#backstage-monitor)。

## @openav/relay

手機 · 以房間為範圍的 WebSocket 中繼（伺服器），以及它的瀏覽器用戶端。

| 匯出 | 簽章 |
|---|---|
| `RelayClient` | `new RelayClient({ role, room, id, url, batchHz = 30, resendMs = 1000, onStatus, onSignal, onFeedback, onConfig })` · `connect()` · `close()` · `set(name, value)` · `send(name, value, pulse, extra)` · `feedback(name, value)` · `config(key, data)` · `status`、`latency`、`peers` |
| 訊號輔助函式 | `bindSignals(client, signals, { alias = 'any' })` · `fileSignal(signals, name, value, { pulse })` · `signalMeta(name, { pulse })` · `aliasOf(name)` · `normalizeValue(name, value)` · `deviceId()` |
| `@openav/relay/server` | `attachRelay(httpServer, { path = '/relay', log, heartbeatMs = 20000 })` → `{ hub, close() }`。單獨執行用 `node packages/relay/server.js [port=7458]` |

見[手機、中繼與控制面板](remote.md#the-relay)。

## @openav/surface

手機 · 類似 TouchOSC 的控制元件、版面 JSON、主題，以及 `autoSurface(params)`。

| 匯出 | 簽章 |
|---|---|
| `Surface` | `new Surface(el, { layout, sink(name, value, info), haptics = true, tabs = true, orientation, onPage })` · `setLayout(layout)` · `setPage(id)` · `feedback(name, value)` · `widget(page, id)` · `dispose()` |
| `signalSink` | `signalSink(signals)` → 一個寫進本機 `Signals` 的 sink |
| auto（自動產生） | `autoSurface(params, { perPage, style, pairs, meters, smooth, title })` → `{ layout, routes, bindings }` · `feedbackFor(state, bindings)` · `routesFromLayout(layout, params)` · `widgetTypeFor(param)` |
| layout（版面） | `validateLayout`、`normalizeLayout`、`resolvePage`、`autoArrange`、`signalNames`、`DEFAULT_SIZE`、`WIDGET_TYPES`、`planKeyboard` |
| 平台與主題 | `lockViewport`、`keepAwake`、`toggleFullscreen`、`canFullscreen`、`haptic`、`injectTheme`、`THEME_VARS`、`COLOR_NAMES`、`WIDGET_CLASSES` |

```js
import { Surface, autoSurface, signalSink } from '@openav/surface';
const { layout, routes } = autoSurface(world.params);
new Surface(document.querySelector('#panel'), { layout, sink: signalSink(signals) });
routes.forEach((r) => mapper.addRoute(r));
```

見[手機、中繼與控制面板](remote.md#surface-widgets)。

## @openav/remote

手機 · 手機／iPad 上的 app，以及演出端的轉接器。

| 匯出 | 簽章 |
|---|---|
| `mountRemote` | `mountRemote(el, { room, relayUrl, surfaceUrl, metaUrl })` → 手機 app（`/packages/remote/index.html` 呼叫的就是它） |
| `PhoneSensors` | `new PhoneSensors({ set, send }, { onKnock, onSample, notify })` · `start()`（要從觸控事件呼叫）· `stop()` · `calibrate()` · `setCamera(on)` · `denied` |
| `localSensors` | `localSensors(signals, { prefix = 'phone/local/', alias = 'any' })` → `PhoneSensors` |
| `attachTouchPad` | `attachTouchPad(el, io, { onMove, onEnd })` |
| `@openav/remote/host` | `mountRemoteHost({ signals, params, mapper, world, room, auto, surface, feedbackHz = 10, url, controllers })` → host 物件 · `mountJoinCard(parent, host)` |

見[手機、中繼與控制面板](remote.md)。

## @openav/mcp

膠水 · 給 AI 代理用的零相依 MCP 伺服器，走 stdio：`node packages/mcp/server.js`。工具和引數見[給 AI 代理](agents.md#the-mcp-server)。
