# 設備

一場演出插上的東西種類很多：MIDI 控制器、PAR 燈、LED 燈條、鏡頭、音訊介面、手部感測器、接在板子上的感測器。OAV 已經能跟其中大多數溝通，各自透過自己的套件和自己的檔案格式。`@openav/devices` 把它們收成一個集合、一種外層紀錄，讓網頁、工具或代理可以列出、搜尋，並用 id 要任何一台，拿回來就能交給驅動它的套件。

```js
import { devices, device } from '@openav/devices';

devices({ q: 'minilab' });                       // rows: id, kind, manufacturer, name, aliases, connections, protocols, verified
const mini = await device('arturia-minilab3');   // its profile, mapper routes, a MidiController in your MidiControllers
const par = await device('generic-rgbw');        // a DMX fixture that patches itself
const cam = await device('logitech-mx-brio');    // a camera found by its name, opened only when you call open()
```


## 裡面有什麼

| 種類 | 紀錄從哪裡讀 | `device()` 給你什麼 |
|---|---|---|
| `midi-controller` | `packages/midi/profiles/` 裡的每一份 profile，手寫的和從 QLC+ 轉入的 | `profile`、`routes()`、`addTo(controllers)` |
| `dmx-fixture` | `packages/dmx/fixtures/` 裡的每一台燈具（還有 `tools/import-ofl.mjs` 寫入的 `fixtures/imported/`） | `profile`、`patch(patch, { address })` |
| `part` | 電子零件庫 `packages/hw/parts.js` 的每一個零件 | `part` |
| `camera`、`audio-interface` | `packages/devices/records/` 裡的一份手寫紀錄 | `constraints()`、`find()`、`open()` |
| `sensor`、`led-controller`、`dmx-interface`、`printer`、`projector`、`display` | 一份手寫紀錄 | 紀錄本身，它的 `use` 寫著哪個套件接得到它 |

沒有任何東西是複製的。profile、燈具和零件都留在自己的檔案裡，那是它們的事實唯一寫下的地方，集合裡每一台的紀錄都是從那個檔案讀出來的：建置套件時讀一次（`node tools/build-devices.mjs` 寫出 `packages/devices/catalog.js`，也就是 `devices()` 回答時用的清單），`device()` 載入它時再讀一次。有 profile、燈具或零件存在、清單卻沒有它，或清單寫的跟檔案現在說的不一樣，測試就會失敗。

列清單很便宜。`devices()` 只讀一個產生出來的檔案，所以網頁不用抓每一份 profile 就能顯示和搜尋整個集合。`device()` 只匯入這台設備所在的那一個檔案。

第一批手寫紀錄是專案桌上就有的器材，每一台都能拿真機驗證：Yamaha AG06、Logitech MX Brio、Audinate Dante Virtual Soundcard、Ultraleap Leap Motion Controller 2、WLED、ENTTEC DMX USB Pro 和 Brother QL-810W。

這個集合在網站上：[/zh/devices/](https://openaudiovisual.com/zh/devices/) 依種類列出每一台設備，能篩選、能搜尋。控制器的頁面留在 `/controllers/<id>/`。每台 DMX 燈具在 `/fixtures/<id>/` 有一頁（各模式的通道表、虛擬燈具、patch 程式碼、檔案），紀錄和零件在 `/devices/<id>/`（附出處的事實、設定、問題、程式碼、檔案，鏡頭和音訊輸入可以在頁面上按按鈕找找看）。一台設備要提供下面三樣中至少兩樣，才有自己的頁面：能在畫面上操作的東西、接到它的程式碼、能帶走的檔案。Brother QL-810W 只有紀錄，所以在 OAV 有它的程式之前，它只是清單上的一列。

## 紀錄

每台設備都有同一種外層紀錄 `open-audiovisual/device@1`，[`device.schema.json`](../../packages/devices/device.schema.json) 描述它，讓不跑這個套件的軟體也讀得懂。

| 欄位 | |
|---|---|
| `id`、`kind`、`manufacturer`、`name` | 它是誰。讀它的那個檔案沒寫製造商時（零件庫、通用版面），`manufacturer` 是 `null` |
| `aliases` | 大家搜尋時會打的字：短名、中文名、型號 |
| `connections`、`protocols` | 怎麼接（`usb`、`din-midi`、`ethernet`、`wifi`、`dmx-xlr5`……）和說什麼協定（`midi`、`dmx512`、`art-net`……）。profile、燈具和零件都沒寫怎麼接，所以它們的 `connections` 是空的，目前 `devices({ connection })` 只找得到手寫紀錄 |
| `data` | `ref`：更深一層的紀錄（`{ type: 'midi-profile', id, file }`），以及／或 `facts`：`[{ key, value, unit, note, source }]`，每一筆都引用一個來源 |
| `media` | 只有鏡頭和音訊介面有：在瀏覽器的裝置裡找到它的名稱比對式、建議的限制條件，以及它們從哪裡來 |
| `setup`、`problems` | 設定步驟和已知問題，`{ en, zh, source }` |
| `use` | OAV 今天怎麼接到它：`[{ package, entry, sink?, call, en, zh }]`，沒有任何路時是 `null` |
| `sources` | 每一筆事實、步驟、問題出自的頁面：`{ title, url, read }` |
| `license`、`verified`、`verifications` | 紀錄資料的授權，以及它有多確定 |
| `notes`、`tbd` | 值得知道的事，以及無法確認的事 |

只有在真機上檢查過，`verified` 才是 true，沒有一筆 `method` 是 `hardware` 的驗證紀錄，紀錄會拒絕 `verified: true`。MIDI 控制器要每一個控制項都檢查過才算：M-VAVE SMC-Mixer 的紀錄裡有一次真機檢查，59 個控制項確認了 52 個，所以不算。

## device()，一種一種看

每段程式碼都以 module 執行，網頁的 import map 用範例那一份，再加一行 `"@openav/devices": "../../packages/devices/index.js"`。只有鏡頭那段的按鈕會要權限，而且要按下去才會。

### MIDI 控制器

`routes()` 就是 `@openav/midi` 的 `controllerRoutes`：從控制器有名字的訊號連到你的參數的路由。`addTo()` 把 profile 放進一個 `MidiControllers`，回傳它即時的控制器。管理器拿到硬體引擎時（`controllers.attach(midi)`），以及每次裝置有變化時，都會依連接埠名稱認出實機，所以請先呼叫 `addTo()`：不然已經插著的實機要等下一次有裝置插拔才會被認出。

```js
import { device } from '@openav/devices';
import { MidiControllers } from '@openav/midi';
import { Signals } from '@openav/core';

const signals = new Signals();
const mini = await device('arturia-minilab3');
const controllers = new MidiControllers({ profiles: [mini.profile], signals });
const live = mini.addTo(controllers);
live.setValue('knob1', 0.5);                        // the on-screen knob; the hardware sends the same message
console.log(signals.get('midi/minilab3/knob1'));    // 0.504: 64 of 127, the MIDI value the knob sends
console.log(mini.routes({ knob1: 'hue' }));         // [{ source: 'midi/minilab3/knob1', target: 'hue' }]
```


### DMX 燈具

`patch()` 把燈具放進 `@openav/dmx` 的 `Patch`。id 預設是 `<設備>-<universe>-<位址>`，universe 預設 1，模式預設是 profile 的第一個。

```js
import { device } from '@openav/devices';
import { Patch, DmxEngine } from '@openav/dmx';

const par = await device('generic-rgbw');
const patch = new Patch();
par.patch(patch, { id: 'par1', address: 1, mode: '6ch' });
const engine = new DmxEngine(patch);
engine.set('par1', { dimmer: 1, color: [1, 0.5, 0] });
console.log(engine.render(0).bytes(1).slice(0, 6));   // 255 255 128 0 0 0: dimmer, red, green, blue, white, strobe
```


### 零件

```js
import { device } from '@openav/devices';

const ring = await device('neopixel-ring-12');
console.log(ring.part.leds, ring.part.supply);   // the @openav/hw library entry, as Hw.check() reads it
```


### 鏡頭或音訊介面

依名稱在瀏覽器的媒體裝置裡找到它。`constraints()` 是純函式。`find()` 呼叫 `enumerateDevices()`，回傳那台裝置或 `null`。`open()` 是唯一會要權限的呼叫，所以要在點擊裡呼叫。

```js
import { device } from '@openav/devices';

const cam = await device('logitech-mx-brio');
console.log(cam.constraints());       // { video: { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 60 } }, audio: false }
const video = document.body.appendChild(Object.assign(document.createElement('video'), { autoplay: true, muted: true }));
const button = document.body.appendChild(Object.assign(document.createElement('button'), { textContent: 'Camera' }));
button.onclick = async () => {
  video.srcObject = await cam.open();   // asks once; finds the MX Brio by name; opens it by its id
};
```


頁面拿到一次權限之前，瀏覽器不給名稱，所以那之前 `find()` 回傳 `null`。這時 `open()` 會先要權限、再找一次，如果瀏覽器先開的是別的鏡頭，就關掉它改開這一台。名稱看得到卻沒有符合的，它會丟出錯誤並列出找到的名稱，不要任何權限。音訊介面打開時關掉回音消除、降噪和自動增益，跟 `@openav/audio` 要麥克風時一樣。要送進分析器，用 `analyzer.input().context.createMediaStreamSource(stream).connect(analyzer.input())`。`@openav/pose` 會自己打開預設的鏡頭，所以找到的鏡頭目前還送不進姿態追蹤。

### 其他種類

感測器、LED 控制器、DMX 介面或印表機回來的是它的紀錄。它的 `use` 寫著接得到它的套件和呼叫：

```js
import { device } from '@openav/devices';

const wled = await device('wled');
for (const u of wled.record.use) console.log(u.package, u.sink || '', u.call);
// @openav/out ddp new OutClient({ url: 'ws://127.0.0.1:6450/out' }).connect().set('light/0/r', 1)
// @openav/dmx artnet dmxTransport('bridge', { patch, client })
const printer = await device('brother-ql-810w');
console.log(printer.record.use);      // null: OAV has no code that talks to it, and the record says so
```


## 加一台設備

1. 有更深一層格式的設備就放那裡：MIDI 控制器是 profile（[MIDI 控制器](controllers.md)），燈是燈具（[DMX 燈光](dmx.md)），零件放進 `packages/hw/parts.js`。集合會自己收進來。
2. 其他的寫成一份紀錄：`packages/devices/records/<id>.json`，檔名就是 id。複製一份同種類的來改。
3. 執行 `node tools/build-devices.mjs`：它會檢查每一份紀錄，重寫 `catalog.js`。再跑 `node --test tests/devices.test.js`。
4. `verified` 留 false，`verifications` 留空。只有手上有那台的人能把它變成 true。

## 事實與授權

- **每一筆事實都引用讀到它的頁面。** 數字、連接埠、協定名稱、取樣率、解析度都來自原廠自己的頁面或手冊，網址和讀的日期寫在 `sources`。在這種頁面上讀不到的就不寫，或寫進 `tbd`，絕不猜。一份短而老實的紀錄勝過一份填滿卻用猜的。
- **只取事實和連結。** 不抄手冊的文字，不用產品照：原廠的頁面有著作權，事實沒有。
- **設定步驟和已知問題** 來自原廠的文件或這本手冊（疑難排解、套件說明），每一筆都寫出處。
- **名稱比對式**（依名稱找鏡頭或音訊輸入）在有人從實機讀到瀏覽器顯示的名稱之前，是照型號寫的，每份紀錄都在 `tbd` 裡寫明。
- **授權。** 紀錄是 MIT，跟專案一樣。從 profile、燈具或零件讀出來的紀錄，跟著那個檔案的授權：從 QLC+ 轉入的控制器是 Apache-2.0（見 `NOTICE`）。Mixxx（GPL）和 midi.guide（CC-BY-SA）的資料不收。
