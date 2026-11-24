// @openav/devices reference: one collection of show devices and one way in. Read by tools/build-reference.mjs (see
// AGENTS.md, "Documenting a public name"). Every example runs headless with no hardware and asks for no permission: a
// camera example builds constraints and reads facts, it never calls find() or open().

export default {
  devices: {
    group: 'devices',
    summary: {
      en: 'Lists the devices in the collection, or the ones that match a search: MIDI controllers, DMX fixtures, parts, cameras, audio interfaces and the rest.',
      zh: '列出設備大集合裡的設備，或符合搜尋的那些：MIDI 控制器、DMX 燈具、零件、鏡頭、音訊介面和其他。',
    },
    params: [
      { name: 'kind', type: 'String | String[]', optional: true, en: 'Only devices of this kind (or these kinds), one of [`deviceKinds`](#deviceKinds). Any other word throws.', zh: '只要這一種（或這幾種）設備，值是 [`deviceKinds`](#deviceKinds) 其中之一。其他的字會丟出錯誤。' },
      { name: 'q', type: 'String', optional: true, en: 'Words to search for. Each word must appear in the name, an alias, the manufacturer or the id, ignoring case, spaces and punctuation, so `minilab3` and `MiniLab 3` find the same device. Results start with the names that equal the query, then the names that start with it.', zh: '要搜尋的字。每個字都要出現在名稱、別名、製造商或 id 裡，不分大小寫、空格和標點，所以 `minilab3` 和 `MiniLab 3` 找到同一台。結果先列名稱等於查詢的，再列名稱以它開頭的。' },
      { name: 'connection', type: 'String', optional: true, en: 'Only devices that plug in this way: `usb`, `din-midi`, `trs-midi`, `ethernet`, `wifi`, `bluetooth`, `hdmi`, `displayport`, `sdi`, `dmx-xlr3`, `dmx-xlr5`, `audio-xlr` or `audio-jack`.', zh: '只要用這種方式連接的設備：`usb`、`din-midi`、`trs-midi`、`ethernet`、`wifi`、`bluetooth`、`hdmi`、`displayport`、`sdi`、`dmx-xlr3`、`dmx-xlr5`、`audio-xlr` 或 `audio-jack`。' },
    ],
    returns: {
      type: 'Object[]',
      en: 'Frozen rows `{ id, kind, manufacturer, name, aliases, connections, protocols, verified, from, file }`. `from` is where the record is read from (`midi-profile`, `dmx-fixture`, `hw-part` or `device-record`) and `file` is that file inside `packages/`. Pass `id` to [`device()`](#device) for the whole record and a handle.',
      zh: '凍結的列 `{ id, kind, manufacturer, name, aliases, connections, protocols, verified, from, file }`。`from` 是紀錄從哪裡讀來（`midi-profile`、`dmx-fixture`、`hw-part` 或 `device-record`），`file` 是那個檔案在 `packages/` 裡的路徑。把 `id` 交給 [`device()`](#device) 就拿到完整的紀錄和可以用的物件。',
    },
    description: [
      {
        en: 'The collection holds every MIDI controller profile of `@openav/midi` (the hand-written ones and the ones imported from QLC+), every fixture of `@openav/dmx`, every part of `@openav/hw`, and hand-written records for devices that have no deeper format: cameras, audio interfaces, sensors, LED and DMX interfaces, printers. None of them is copied: a profile, a fixture or a part stays in its own file, and its row is read off that file when the package is built.',
        zh: '設備大集合包含 `@openav/midi` 的每一份 MIDI 控制器 profile（手寫的，以及從 QLC+ 轉入的）、`@openav/dmx` 的每一台燈具、`@openav/hw` 的每一個零件，以及沒有更深一層格式的設備的手寫紀錄：鏡頭、音訊介面、感測器、LED 與 DMX 介面、印表機。沒有任何一份是複製的：profile、燈具和零件都留在自己的檔案裡，它的那一列是建置套件時從那個檔案讀出來的。',
      },
      {
        en: 'Listing loads no profile: the rows come from one generated file, `catalog.js`, so a page can show and search the whole collection without fetching 56 JSON files. With no argument it returns everything, grouped by kind in the order of [`deviceKinds`](#deviceKinds), then by name.',
        zh: '列清單不會載入任何 profile：每一列來自一個產生出來的檔案 `catalog.js`，所以網頁不用抓 56 個 JSON 檔就能顯示和搜尋整個集合。不給參數時回傳全部，依 [`deviceKinds`](#deviceKinds) 的順序按種類分組，再依名稱排序。',
      },
    ],
    notes: [
      {
        en: '`verified` is true only when the device was checked on a real unit. A MIDI profile counts as verified only when every one of its controls was; most of the collection is not, yet.',
        zh: '只有在真機上檢查過，`verified` 才是 true。MIDI profile 要每一個控制項都檢查過才算。目前集合裡大多數都還沒有。',
      },
    ],
    related: ['device', 'deviceKinds'],
    keywords: { en: ['device list', 'search', 'controller', 'fixture', 'camera', 'audio interface'], zh: ['設備清單', '搜尋', '控制器', '燈具', '鏡頭', '音訊介面'] },
    examples: [
      {
        code: `import { devices } from '@openav/devices';

const all = devices();
const minilab = devices({ kind: 'midi-controller', q: 'minilab' });
const lights = devices({ kind: 'dmx-fixture' });
document.getElementById('app').innerHTML = [
  'devices in the collection: ' + all.length,
  'minilab: ' + minilab.map((d) => d.id).join(', '),
  'DMX fixtures: ' + lights.map((d) => d.name).join(', '),
].join('<br>');`,
        caption: { en: 'Prints how many devices the collection holds, then arturia-minilab3, then the names of the seven generic DMX fixtures.', zh: '印出集合裡有幾台設備，接著是 arturia-minilab3，然後是七台通用 DMX 燈具的名稱。' },
      },
      {
        code: `import { devices } from '@openav/devices';

const wifi = devices({ connection: 'wifi' });
const printer = devices({ q: '標籤機' });
document.getElementById('app').innerHTML = [
  'on Wi-Fi: ' + wifi.map((d) => d.name).join(', '),
  'a search in Chinese: ' + printer.map((d) => d.id + ' (' + d.kind + ')').join(', '),
].join('<br>');`,
        caption: { en: 'Prints WLED and Brother QL-810W as the devices on Wi-Fi, then brother-ql-810w (printer), found by its Chinese alias.', zh: '印出用 Wi-Fi 的設備 WLED 和 Brother QL-810W，然後是用中文別名找到的 brother-ql-810w（printer）。' },
      },
    ],
  },

  device: {
    group: 'devices',
    summary: {
      en: 'Loads one device by id, ready for OAV: a MIDI controller with its profile and routes, a fixture that patches itself, a part, a camera or audio input found by name.',
      zh: '依 id 載入一台設備，交給你可以直接在 OAV 用的樣子：帶 profile 和路由的 MIDI 控制器、會自己 patch 的燈具、零件、依名稱找到的鏡頭或音訊輸入。',
    },
    params: [
      { name: 'id', type: 'String', en: 'The device\'s id, as [`devices()`](#devices) lists it (`arturia-minilab3`, `generic-rgbw`, `logitech-mx-brio`). A MIDI short name such as `minilab3` is not an id: the error suggests the ids it was near.', zh: '設備的 id，跟 [`devices()`](#devices) 列出來的一樣（`arturia-minilab3`、`generic-rgbw`、`logitech-mx-brio`）。`minilab3` 這種 MIDI 短名不是 id，錯誤訊息會建議接近的 id。' },
      { name: 'options', type: 'Object', optional: true, default: '{}', en: 'For a DMX fixture, the defaults of `patch()`: `{ id, universe, address, mode, groups, name, limits }`. For a camera or an audio interface, `mediaDevices` replaces `navigator.mediaDevices` (tests hand in a stand-in).', zh: 'DMX 燈具：`patch()` 的預設值 `{ id, universe, address, mode, groups, name, limits }`。鏡頭或音訊介面：`mediaDevices` 會取代 `navigator.mediaDevices`（測試用替身）。' },
    ],
    returns: {
      type: 'Promise<Object>',
      en: 'A handle: always `{ id, kind, name, record }`, `record` being the device\'s whole `open-audiovisual/device@1` record. Then by kind: midi-controller `profile`, `routes(bindings, options)`, `addTo(controllers)`; dmx-fixture `profile`, `patch(patch, options)`; part `part`; camera and audio-interface `constraints(deviceId?)`, `find()`, `open()`. Other kinds have the record alone.',
      zh: '一個物件：一定有 `{ id, kind, name, record }`，`record` 是這台設備完整的 `open-audiovisual/device@1` 紀錄。接著依種類：midi-controller 有 `profile`、`routes(bindings, options)`、`addTo(controllers)`。dmx-fixture 有 `profile`、`patch(patch, options)`。part 有 `part`。camera 和 audio-interface 有 `constraints(deviceId?)`、`find()`、`open()`。其他種類只有紀錄。',
    },
    description: [
      {
        en: 'It imports the one file the device lives in and nothing else: a profile JSON, a fixture JSON, the parts library or a hand-written record. The record of a profile, a fixture or a part is read off that file each time, so it always says what the file says.',
        zh: '它只匯入這台設備所在的那一個檔案：一份 profile JSON、一份燈具 JSON、零件庫，或一份手寫紀錄。profile、燈具和零件的紀錄每次都從那個檔案讀出來，所以檔案寫什麼它就是什麼。',
      },
      {
        en: 'A MIDI controller hands over what `@openav/midi` already does with a profile. `routes({ knob1: \'hue\' })` is [`controllerRoutes`](#controllerRoutes): mapper routes from its named signals (`midi/<short>/<control>`) to your params. `addTo(controllers)` puts the profile into a [`MidiControllers`](#MidiControllers), yours or a show\'s, and returns its live [`MidiController`](#MidiController): plug the unit in and it is recognised by its port name.',
        zh: 'MIDI 控制器交出的是 `@openav/midi` 拿到 profile 本來就會做的事。`routes({ knob1: \'hue\' })` 就是 [`controllerRoutes`](#controllerRoutes)：從它有名字的訊號（`midi/<short>/<控制項>`）連到你的參數的路由。`addTo(controllers)` 把 profile 放進一個 [`MidiControllers`](#MidiControllers)（你的或演出的），回傳即時的 [`MidiController`](#MidiController)：插上實機，就會依連接埠名稱認出它。',
      },
      {
        en: 'A DMX fixture places itself in a [`Patch`](#Patch): `patch(p, { address: 1, mode: \'6ch\' })` calls `p.add()` with the fixture\'s profile and returns the placed fixture. The id defaults to `<device>-<universe>-<address>`, the universe to 1, the mode to the profile\'s first.',
        zh: 'DMX 燈具會把自己放進一個 [`Patch`](#Patch)：`patch(p, { address: 1, mode: \'6ch\' })` 用這台燈的 profile 呼叫 `p.add()`，回傳放好的燈具。id 預設是 `<設備>-<universe>-<位址>`，universe 預設 1，模式預設是 profile 的第一個。',
      },
      {
        en: 'A camera or an audio interface is found among the browser\'s media devices by its label. `constraints(deviceId?)` is pure: the recommended settings (a camera\'s size and frame rate as ideal values, an audio input with echo cancellation, noise suppression and auto gain off). `find()` calls `enumerateDevices()` and returns the matching device, or null. `open()` is the only call that asks for a permission: it opens the device by its id and returns the stream, which you stop when done.',
        zh: '鏡頭或音訊介面依名稱在瀏覽器的媒體裝置裡找到。`constraints(deviceId?)` 是純函式：建議的設定（鏡頭的尺寸與畫面更新率是理想值，音訊輸入關掉回音消除、降噪和自動增益）。`find()` 呼叫 `enumerateDevices()`，回傳符合的裝置或 null。`open()` 是唯一會要權限的呼叫：依 id 打開裝置，回傳串流，用完由你停止。',
      },
    ],
    needs: {
      en: 'Nothing to load a device. For `open()`: a browser page on https or localhost, a click, and the permission; for `addTo()` hardware: Web MIDI (Chrome or Edge).',
      zh: '載入設備什麼都不用。`open()` 要：https 或 localhost 上的網頁、一次點擊和權限。`addTo()` 要接實機時需要 Web MIDI（Chrome 或 Edge）。',
    },
    notes: [
      {
        en: 'Browsers hide device labels until the page has had camera or microphone permission once, so before that `find()` returns null. `open()` then asks once, looks again, and if the browser opened another camera first, closes it and opens this one. When labels are visible and none matches, it throws with the names it found and asks for nothing.',
        zh: '頁面拿到一次相機或麥克風權限之前，瀏覽器不給裝置名稱，所以那之前 `find()` 回傳 null。這時 `open()` 會先要一次權限、再找一次，如果瀏覽器先開的是別的鏡頭，就關掉它改開這一台。名稱看得到卻沒有符合的，它會丟出錯誤並列出找到的名稱，不要任何權限。',
      },
      {
        en: '`@openav/pose` opens the default camera itself, so a found camera does not reach the pose trackers yet. It does reach `@openav/record` (`comp.setCamera(stream)`) and, through `analyzer.input()`, `@openav/audio`.',
        zh: '`@openav/pose` 會自己打開預設的鏡頭，所以找到的鏡頭目前還送不進姿態追蹤。它可以送進 `@openav/record`（`comp.setCamera(stream)`），也可以經 `analyzer.input()` 送進 `@openav/audio`。',
      },
    ],
    related: ['devices', 'deviceKinds', 'controllerRoutes', 'MidiControllers', 'Patch'],
    keywords: { en: ['load a device', 'midi profile', 'patch a fixture', 'pick a camera', 'getUserMedia'], zh: ['載入設備', 'MIDI profile', 'patch 燈具', '選鏡頭', '選音訊介面'] },
    examples: [
      {
        code: `import { device } from '@openav/devices';

const mini = await device('arturia-minilab3');
const routes = mini.routes({ knob1: 'hue', pad1: { target: 'burst', on: 'hit' } });
document.getElementById('app').innerHTML = [
  mini.name + ' (' + mini.kind + '), ' + mini.profile.controls.length + ' controls',
  ...routes.map((r) => r.source + ' → ' + r.target),
].join('<br>');`,
        caption: { en: 'Prints Arturia MiniLab 3 (midi-controller), 24 controls, then midi/minilab3/knob1 → hue and midi/minilab3/pad1/hit → burst, with no MIDI device and no permission.', zh: '印出 Arturia MiniLab 3（midi-controller）有 24 個控制項，接著是 midi/minilab3/knob1 → hue 與 midi/minilab3/pad1/hit → burst，不需要 MIDI 裝置，也不要權限。' },
      },
      {
        code: `import { device } from '@openav/devices';
import { Patch, DmxEngine } from '@openav/dmx';

const par = await device('generic-rgbw');
const patch = new Patch();
const placed = par.patch(patch, { id: 'par1', address: 1, mode: '6ch' });
const engine = new DmxEngine(patch);
engine.set('par1', { dimmer: 1, color: [1, 0.5, 0] });
document.getElementById('app').innerHTML = [
  placed.id + ' at address ' + placed.address + ', ' + placed.footprint + ' channels',
  'addresses 1–6: ' + Array.from(engine.render(0).bytes(1).slice(0, 6)).join(' '),
].join('<br>');`,
        caption: { en: 'Prints par1 at address 1, 6 channels, then 255 255 128 0 0 0: dimmer, red, green, blue, white and strobe of an orange par.', zh: '印出 par1 在位址 1、6 個通道，接著是 255 255 128 0 0 0：一台橘色 par 的 dimmer、紅、綠、藍、白和頻閃。' },
      },
      {
        code: `import { device } from '@openav/devices';

const cam = await device('logitech-mx-brio');
const rate = cam.record.data.facts.find((f) => f.key === 'maxFrameRate');
document.getElementById('app').innerHTML = [
  cam.name + ': ' + rate.value,
  'source: ' + cam.record.sources[rate.source].title,
  'asks for: ' + JSON.stringify(cam.constraints().video),
  'verified on a unit: ' + cam.record.verified,
].join('<br>');`,
        caption: { en: 'Prints the MX Brio\'s frame rates with the Logitech page they come from, the camera constraints open() would use, and verified on a unit: false. Nothing asks for the camera.', zh: '印出 MX Brio 的畫面更新率和它出自的羅技頁面、open() 會用的鏡頭限制條件，以及 verified on a unit: false。沒有任何東西要求鏡頭。' },
      },
    ],
  },

  deviceKinds: {
    group: 'devices',
    summary: {
      en: 'The kinds a device in the collection can be, in the order devices() lists them: midi-controller, dmx-fixture, dmx-interface, led-controller, sensor, camera and the rest.',
      zh: '設備大集合裡設備可以是的種類，順序跟 devices() 列出來的一樣：midi-controller、dmx-fixture、dmx-interface、led-controller、sensor、camera 等等。',
    },
    value: { type: 'String[]', en: 'A frozen array: `midi-controller`, `dmx-fixture`, `dmx-interface`, `led-controller`, `sensor`, `camera`, `audio-interface`, `projector`, `display`, `printer`, `part`.', zh: '凍結的陣列：`midi-controller`、`dmx-fixture`、`dmx-interface`、`led-controller`、`sensor`、`camera`、`audio-interface`、`projector`、`display`、`printer`、`part`。' },
    description: [
      {
        en: 'Use it to build a filter or to check a value before passing it as `kind` to [`devices()`](#devices). A kind can have no device yet (projector, display): the format has room for them before the collection does.',
        zh: '用來做篩選器，或在把值當作 `kind` 傳給 [`devices()`](#devices) 之前先檢查。某些種類可能還沒有設備（projector、display）：格式先替它們留了位置。',
      },
    ],
    related: ['devices'],
    examples: [
      {
        code: `import { deviceKinds, devices } from '@openav/devices';

document.getElementById('app').innerHTML = deviceKinds
  .map((kind) => kind + ': ' + devices({ kind }).length)
  .join('<br>');`,
        caption: { en: 'Prints each kind with how many devices it has: most are MIDI controllers, projector and display have none yet.', zh: '印出每一種和它有幾台設備：大多數是 MIDI 控制器，projector 和 display 目前還是 0。' },
      },
    ],
  },
};
