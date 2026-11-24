// @openav/dmx reference: DMX lighting from a page (fixture profiles, a patch, an engine that renders every light at any moment,
// and the bytes of Art-Net, sACN and the Enttec DMX USB Pro). Read by tools/build-reference.mjs (see AGENTS.md, "Documenting a
// public name"). Everything here is pure and runs without a light: the examples print bytes and properties into the page.
// Nothing in this package has been tried with a real fixture, node or interface yet: each entry says so where it matters.

const RIG = `const patch = new Patch();
patch.add({ id: 'par1', profile: 'generic-rgbw', mode: '6ch', address: 1, groups: ['front'] });
patch.add({ id: 'par2', profile: 'generic-rgbw', mode: '6ch', address: 7, groups: ['front'] });`;
const HEX = `const hex = (bytes) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join(' ');`;
const UNTESTED = {
  en: 'Not yet tried with real hardware: the bytes follow the published layout and pass this project\'s tests, but no node, interface or fixture has received them for this project.',
  zh: '還沒有用真的硬體試過：位元組照公開的格式寫，也通過本專案的測試，但還沒有任何節點、介面或燈具為本專案收過這些封包。',
};

export default {
  Universe: {
    group: 'dmx',
    summary: {
      en: 'One DMX universe: 512 values of 0–255 in a Uint8Array, read and written by address 1–512, the way a fixture and a patch sheet count.',
      zh: '一個 DMX universe：512 個 0–255 的值，存在 Uint8Array 裡，用位址 1–512 讀寫，跟燈具和 patch 表的算法一樣。',
    },
    params: [
      { name: 'id', type: 'Number', optional: true, default: '1', en: 'The universe number, 0–63999: the one you patch on and send to. Universe 1 goes out as Art-Net Port-Address 1 and as sACN universe 1 (sACN has no 0; Art-Net\'s 0 is deprecated).', zh: 'universe 的編號，0–63999，就是你 patch 和送出時用的那個號碼。universe 1 送出去是 Art-Net 的 Port-Address 1，也是 sACN 的 universe 1（sACN 沒有 0，Art-Net 的 0 規格不建議再用）。' },
    ],
    description: [
      {
        en: '`data` is the 512 bytes themselves (slot 1 is `data[0]`), ready to hand to [`encodeArtDmx()`](#encodeArtDmx), [`encodeSacn()`](#encodeSacn) or [`encodeEnttecDmx()`](#encodeEnttecDmx). `get(address)` and `set(address, value)` use 1-based addresses.',
        zh: '`data` 就是那 512 個位元組（第 1 格是 `data[0]`），可以直接交給 [`encodeArtDmx()`](#encodeArtDmx)、[`encodeSacn()`](#encodeSacn) 或 [`encodeEnttecDmx()`](#encodeEnttecDmx)。`get(address)` 和 `set(address, value)` 的位址從 1 開始。',
      },
      {
        en: 'A wrong address (0, 513, 1.5) or a value outside 0–255 throws a `RangeError` instead of being clamped: a light patched one channel off still lights, only not the one you meant, so the mistake should stop you early.',
        zh: '位址錯了（0、513、1.5）或值不在 0–255 之間，會丟出 `RangeError`，不會自動夾到範圍內：位址差一格的燈還是會亮，只是亮的不是你要的那一台，所以錯誤要早一點擋下來。',
      },
    ],
    members: {
      get: { en: '`get(address)`: the value at a 1-based address.', zh: '`get(address)`：某個位址（從 1 算）的值。' },
      set: { en: '`set(address, value)`: write one byte. Returns the universe, so calls chain.', zh: '`set(address, value)`：寫入一個位元組。回傳 universe 本身，可以串接。' },
      write: { en: '`write(address, values)`: write consecutive bytes from an address. The run must end at 512 or before.', zh: '`write(address, values)`：從某個位址開始連續寫入。最後一格不能超過 512。' },
      fill: { en: '`fill(value = 0)`: every slot to one value.', zh: '`fill(value = 0)`：每一格都設成同一個值。' },
      copy: { en: '`copy()`: a new universe with the same bytes, sharing nothing.', zh: '`copy()`：一個位元組相同、但完全獨立的新 universe。' },
    },
    examples: [
      {
        code: `import { Universe } from '@openav/dmx';

const u = new Universe(1);
u.set(1, 255).set(2, 128);
u.write(510, [1, 2, 3]);
document.getElementById('app').innerHTML = [
  'address 1: ' + u.get(1) + ', address 2: ' + u.get(2),
  'the last three: ' + Array.from(u.data.slice(509)).join(' '),
  'length: ' + u.data.length,
].join('<br>');`,
        caption: { en: 'Prints address 1: 255, address 2: 128, then the last three slots 1 2 3, then length: 512.', zh: '印出位址 1 是 255、位址 2 是 128，接著最後三格 1 2 3，最後是長度 512。' },
      },
    ],
    related: ['Universes', 'encodeArtDmx'],
    keywords: { en: ['universe', 'DMX512', 'channel', 'address', 'slot'], zh: ['宇宙', '通道', '位址', '頻道'] },
  },

  Universes: {
    group: 'dmx',
    summary: {
      en: 'Several DMX universes by number, each made (all zeros) the first time it is asked for: what Patch.render() and DmxEngine.render() return.',
      zh: '依編號存放好幾個 DMX universe，第一次被要的時候才建立（全部是 0）：Patch.render() 和 DmxEngine.render() 回傳的就是它。',
    },
    description: [
      {
        en: '`get(id)` gives the [`Universe`](#Universe) with that number, creating it if needed. `bytes(id)` gives a copy of its 512 bytes, and 512 zeros for a universe nothing was patched on, so a sender can always send. `ids()` lists the numbers in use, lowest first.',
        zh: '`get(id)` 給你那個編號的 [`Universe`](#Universe)，沒有就建立。`bytes(id)` 給它那 512 個位元組的複本，沒有任何燈的 universe 就給 512 個 0，所以送出端永遠有東西可以送。`ids()` 由小到大列出用到的編號。',
      },
    ],
    members: {
      get: { en: '`get(id = 1)`: the universe with this number, created on first use.', zh: '`get(id = 1)`：這個編號的 universe，第一次用到時建立。' },
      has: { en: '`has(id)`: true when it has been made.', zh: '`has(id)`：已經建立過就是 true。' },
      ids: { en: '`ids()`: the numbers made so far, lowest first.', zh: '`ids()`：目前建立過的編號，由小到大。' },
      bytes: { en: '`bytes(id = 1)`: a copy of the 512 bytes (zeros for one never made).', zh: '`bytes(id = 1)`：512 個位元組的複本（從沒建立過的就是全部 0）。' },
      entries: { en: '`entries()`: `[[id, universe], …]`, lowest number first.', zh: '`entries()`：`[[id, universe], …]`，編號由小到大。' },
    },
    examples: [
      {
        code: `import { Universes } from '@openav/dmx';

const all = new Universes();
all.get(2).set(1, 200);
all.get(1).set(512, 7);
document.getElementById('app').innerHTML = [
  'in use: ' + all.ids().join(', '),
  'universe 2, address 1: ' + all.bytes(2)[0],
  'universe 9 (never made): ' + all.bytes(9).length + ' zeros',
].join('<br>');`,
        caption: { en: 'Prints in use: 1, 2, then universe 2, address 1: 200, then 512 zeros for universe 9.', zh: '印出用到的編號 1, 2，接著 universe 2 位址 1 是 200，最後 universe 9 是 512 個 0。' },
      },
    ],
    related: ['Universe', 'Patch', 'DmxEngine'],
  },

  validateFixture: {
    group: 'dmx',
    summary: {
      en: 'Checks a fixture profile (open-audiovisual/fixture@1) and returns every problem as one sentence; an empty list means it can be patched.',
      zh: '檢查一份燈具 profile（open-audiovisual/fixture@1），把每個問題寫成一句話回傳。清單是空的，就代表可以拿去 patch。',
    },
    params: [
      { name: 'profile', type: 'Object', en: 'A parsed fixture profile (the JSON of one fixture).', zh: '解析好的燈具 profile（一台燈的 JSON）。' },
    ],
    returns: { type: 'String[]', en: 'One sentence per problem, each starting with the profile\'s id.', zh: '每個問題一句話，開頭是 profile 的 id。' },
    description: [
      {
        en: 'A profile names its channels (`channels: { red: { type: \'color\', color: \'red\' }, … }`) and, per mode, the order the fixture reads them from its start address (`modes: [{ id: \'4ch\', channels: [\'red\', \'green\', \'blue\', \'white\'] }]`). Channel types: `intensity`, `color` (red, green, blue, white, warmWhite, coldWhite, amber, uv, cyan, magenta, yellow, lime, indigo), `pan`, `tilt`, `strobe`, `zoom`, `focus`, `gobo`, `colorWheel`, `speed`, `control` and `generic`. A 16-bit channel is two entries: the coarse one, and `{ fineOf: \'pan\' }` for its low byte.',
        zh: '一份 profile 寫出它的通道（`channels: { red: { type: \'color\', color: \'red\' }, … }`），以及每個模式下燈具從起始位址開始讀這些通道的順序（`modes: [{ id: \'4ch\', channels: [\'red\', \'green\', \'blue\', \'white\'] }]`）。通道類型有：`intensity`、`color`（red、green、blue、white、warmWhite、coldWhite、amber、uv、cyan、magenta、yellow、lime、indigo）、`pan`、`tilt`、`strobe`、`zoom`、`focus`、`gobo`、`colorWheel`、`speed`、`control` 和 `generic`。16 位元的通道寫成兩筆：粗調那一筆，再加一筆 `{ fineOf: \'pan\' }` 當它的低位元組。',
      },
      {
        en: 'It checks what a JSON Schema cannot: every mode names channels that exist, once each; a fine channel comes with its coarse one in the same mode; a strobe\'s `ranges` go up without overlapping and only a strobe range has `hz`; and `"verified": true` has a verification with `method: "hardware"`, which only a person with the fixture in front of them can make. The schema is `@openav/dmx/fixtures/fixture.schema.json`.',
        zh: '它檢查 JSON Schema 檢查不到的事：每個模式寫的通道都存在，而且只出現一次，fine 通道跟它的粗調通道在同一個模式裡，strobe 的 `ranges` 由小到大、不重疊，只有 strobe 區段可以寫 `hz`，寫了 `"verified": true` 就要有一筆 `method: "hardware"` 的驗證紀錄，那只有燈就在眼前的人才能留。Schema 在 `@openav/dmx/fixtures/fixture.schema.json`。',
      },
    ],
    examples: [
      {
        code: `import { validateFixture, fixtureById } from '@openav/dmx';

const mine = structuredClone(fixtureById('generic-rgbw'));
mine.modes[0].channels.push('amber');
mine.verified = true;
document.getElementById('app').innerHTML = [
  'generic-rgbw: ' + validateFixture(fixtureById('generic-rgbw')).length + ' problems',
  ...validateFixture(mine),
].join('<br>');`,
        caption: { en: 'Prints generic-rgbw: 0 problems, then two sentences about the copy: "amber" is not in channels, and "verified": true needs a hardware verification.', zh: '印出 generic-rgbw 沒有問題，接著兩句關於複本的問題：channels 裡沒有 "amber"，以及 "verified": true 需要一筆硬體驗證。' },
      },
    ],
    related: ['loadFixture', 'FIXTURES'],
    keywords: { en: ['fixture', 'profile', 'personality', 'mode', 'schema'], zh: ['燈具', '模式', '驗證'] },
  },

  loadFixture: {
    group: 'dmx',
    summary: {
      en: 'Checks a fixture profile and lays it out for patching: each mode gets its footprint and, slot by slot, the channel it carries. Throws when the profile is not valid.',
      zh: '檢查燈具 profile，並整理成可以 patch 的樣子：每個模式算出佔幾個通道，以及每一格放的是哪個通道。profile 不對就丟出錯誤。',
    },
    params: [
      { name: 'profile', type: 'Object', en: 'A parsed fixture profile, or one this function already returned (it comes back unchanged).', zh: '解析好的燈具 profile，或這個函式之前回傳的結果（原樣回傳）。' },
    ],
    returns: { type: 'Object', en: '`{ format, id, manufacturer, name, kind, license, verified, modes: [{ id, name, footprint, slots: [{ key, offset, type, color, default, ranges, fine, coarse, fineOffset }] }], profile }`, frozen.', zh: '`{ format, id, manufacturer, name, kind, license, verified, modes: [{ id, name, footprint, slots: [{ key, offset, type, color, default, ranges, fine, coarse, fineOffset }] }], profile }`，已凍結。' },
    description: [
      {
        en: 'You rarely need it: [`Patch.add()`](#Patch) loads a profile itself. Use it to see how many channels a mode takes before you choose start addresses. The error it throws lists every problem, and carries them as `error.problems`.',
        zh: '通常用不到：[`Patch.add()`](#Patch) 自己會載入 profile。想在決定起始位址之前先知道一個模式佔幾個通道，就用它。丟出的錯誤會列出所有問題，也放在 `error.problems` 裡。',
      },
    ],
    examples: [
      {
        code: `import { loadFixture, fixtureById } from '@openav/dmx';

const head = loadFixture(fixtureById('generic-moving-head'));
const m = head.modes.find((x) => x.id === '16ch');
document.getElementById('app').innerHTML = [
  head.name + ', modes: ' + head.modes.map((x) => x.id + ' (' + x.footprint + ')').join(', '),
  '16ch: ' + m.slots.map((s) => s.offset + 1 + ' ' + s.key).join(', '),
].join('<br>');`,
        caption: { en: 'Prints the generic moving head\'s modes, 8ch (8) and 16ch (16), then the 16 slots of the 16ch mode from 1 pan, 2 panFine to 16 reset.', zh: '印出通用搖頭燈的模式 8ch（8）和 16ch（16），再列出 16ch 模式的 16 格，從 1 pan、2 panFine 到 16 reset。' },
      },
    ],
    related: ['validateFixture', 'Patch'],
  },

  rgbToChannels: {
    group: 'dmx',
    summary: {
      en: 'Splits one RGB colour into the colour channels a fixture really has (RGB, RGBW, RGBA, RGBAW+UV, CMY), white and amber taken out first.',
      zh: '把一個 RGB 顏色拆成燈具真正有的顏色通道（RGB、RGBW、RGBA、RGBAW+UV、CMY），先取出白光和琥珀色。',
    },
    params: [
      { name: 'rgb', type: 'Number[]', en: '`[r, g, b]`, each 0..1 (clamped).', zh: '`[r, g, b]`，每個 0..1（超出會被夾住）。' },
      { name: 'colors', type: 'String[]', en: 'The colour names of the fixture\'s channels, such as `[\'red\', \'green\', \'blue\', \'white\']`.', zh: '燈具顏色通道的名稱，例如 `[\'red\', \'green\', \'blue\', \'white\']`。' },
    ],
    returns: { type: 'Object', en: 'One 0..1 value per name in `colors`.', zh: '`colors` 裡每個名稱各一個 0..1 的值。' },
    description: [
      {
        en: 'The rule, in order, each step taking its share out of what is left: white = min(r, g, b), taken out of r, g and b (a fixture with only warm or cold white uses that); amber = min(r, 2·g), read as (1, ½, 0), taken out of red and half as much green; red, green and blue get what is left. With no red, green or blue but cyan, magenta and yellow, it is subtractive: cyan = 1 − r, and so on. A fixture with one kind of emitter (a white par) gets the brightest of r, g, b. UV, lime and indigo have no place in RGB and stay 0.',
        zh: '規則依序如下，每一步都從剩下的量裡取：白光 = min(r, g, b)，從 r、g、b 扣掉（只有暖白或冷白的燈就放在那裡）。琥珀色 = min(r, 2·g)，把琥珀當成 (1, ½, 0)，從紅色扣掉、綠色扣一半。剩下的給紅、綠、藍。沒有紅綠藍、只有青、洋紅、黃的燈用減色法：青 = 1 − r，以此類推。只有一種光源的燈（例如白光 par）取 r、g、b 裡最亮的那個。UV、萊姆綠和靛色在 RGB 裡沒有位置，維持 0。',
      },
      {
        en: 'Why white first: on an RGBW par the white LED is the brightest and cleanest, and pastels made from red, green and blue alone look thin and tinted. Full extraction means (1, 1, 1) is the white LED alone. [`Patch`](#Patch) calls this for you when a scene says `color: [r, g, b]`.',
        zh: '為什麼先取白光：RGBW par 上的白光 LED 最亮也最乾淨，只用紅綠藍混出來的淡色會顯得單薄又偏色。完全取出白光的意思是 (1, 1, 1) 只會點亮白光 LED。scene 寫 `color: [r, g, b]` 的時候，[`Patch`](#Patch) 會替你呼叫它。',
      },
    ],
    examples: [
      {
        code: `import { rgbToChannels } from '@openav/dmx';

const show = (o) => Object.entries(o).map(([k, v]) => k + ' ' + v.toFixed(2)).join(', ');
document.getElementById('app').innerHTML = [
  'RGBW, orange: ' + show(rgbToChannels([1, 0.6, 0.2], ['red', 'green', 'blue', 'white'])),
  'RGBA, amber: ' + show(rgbToChannels([1, 0.5, 0], ['red', 'green', 'blue', 'amber'])),
  'CMY, red: ' + show(rgbToChannels([1, 0, 0], ['cyan', 'magenta', 'yellow'])),
].join('<br>');`,
        caption: { en: 'Prints orange on RGBW as red 0.80, green 0.40, blue 0.00, white 0.20; pure amber as the amber LED alone; red on CMY as cyan 0, magenta 1, yellow 1.', zh: '印出 RGBW 的橘色是 red 0.80、green 0.40、blue 0.00、white 0.20，純琥珀色只點亮琥珀 LED，CMY 的紅色是 cyan 0、magenta 1、yellow 1。' },
      },
    ],
    related: ['Patch'],
    keywords: { en: ['RGBW', 'RGBA', 'CMY', 'white', 'amber', 'colour mixing'], zh: ['混色', '白光', '琥珀', '顏色'] },
  },

  Patch: {
    group: 'dmx',
    summary: {
      en: 'Places fixtures on universes and addresses, with groups and per-fixture limits, and turns properties (dimmer, color, pan, tilt, strobe, zoom) into each light\'s bytes.',
      zh: '把燈具放到 universe 和位址上（可以分組、每台設上下限），並把屬性（dimmer、color、pan、tilt、strobe、zoom）換成每台燈的位元組。',
    },
    params: [
      { name: 'profiles', type: 'Object[]', optional: true, default: '[]', en: 'Fixture profiles of your own, looked up by id in `add()` and `fromJSON()` before the shipped [`FIXTURES`](#FIXTURES).', zh: '你自己的燈具 profile，`add()` 和 `fromJSON()` 會先用 id 在這裡找，找不到才找內建的 [`FIXTURES`](#FIXTURES)。' },
    ],
    description: [
      {
        en: '`add({ id, profile, mode, universe = 1, address, name, groups, limits })` places one fixture: `profile` is a profile or the id of one, `mode` one of its modes (the first by default), `address` its start address. It throws for an unknown profile or mode, an address that is not 1–512, a footprint that runs past 512 (it says the last start address that fits), an id used twice, and a group named like a fixture. Two fixtures on the same addresses are allowed, because doubling two identical pars is common; `check()` lists them.',
        zh: '`add({ id, profile, mode, universe = 1, address, name, groups, limits })` 放一台燈：`profile` 是一份 profile 或它的 id，`mode` 是它的其中一個模式（預設第一個），`address` 是起始位址。profile 或模式不存在、位址不在 1–512、佔用的通道超過 512（錯誤訊息會說最後一個放得下的起始位址）、id 重複、群組名稱跟燈的 id 一樣，都會丟出錯誤。兩台燈用同一段位址是允許的，因為把兩台一樣的 par 設成同一個位址很常見，`check()` 會把它們列出來。',
      },
      {
        en: 'A work asks for properties, never channel numbers: `dimmer`, `color: [r, g, b]`, `pan`, `tilt`, `strobe`, `zoom`, each 0..1, and any other channel by its key in the profile (`uv`, `gobo`). `render(states, { master, blackout, maxFlashHz, controls })` turns `{ id: properties }` into [`Universes`](#Universes): colour goes through [`rgbToChannels()`](#rgbToChannels); `dimmer` drives every intensity channel of the fixture, and a fixture with no dimmer channel gets the dimmer multiplied into its colour; pan and tilt with a fine channel are written as 16 bits; a fixture with no state gets its channel defaults (a moving head waits at the middle, dark).',
        zh: '作品只要屬性，不要通道號碼：`dimmer`、`color: [r, g, b]`、`pan`、`tilt`、`strobe`、`zoom`，每個 0..1，其他通道用 profile 裡的鍵名（`uv`、`gobo`）。`render(states, { master, blackout, maxFlashHz, controls })` 把 `{ id: 屬性 }` 換成 [`Universes`](#Universes)：顏色經過 [`rgbToChannels()`](#rgbToChannels)，`dimmer` 會推這台燈的每一個調光通道，沒有調光通道的燈，dimmer 會乘進顏色裡，有 fine 通道的 pan、tilt 寫成 16 位元，沒有給狀態的燈用各通道的預設值（搖頭燈停在正中間、不亮）。',
      },
      {
        en: 'The last layers live here, in this order: the fixture\'s `limits` (`{ dimmer: [0, 0.8], tilt: [0.1, 0.9] }`), then the grand master, then blackout, then the flash cap on the strobe channel. Blackout darkens intensity and colour and leaves pan, tilt, zoom and control channels alone. Every strobe channel whose profile gives Hz is held at or under `maxFlashHz` (3 by default); one whose profile gives no Hz stays on its open value, because nobody can say how fast it would flash. A second dimmer or strobe channel set by its key gets the same limits, master, blackout and cap as the first. A `control` channel (reset, lamp, built-in programs) is written only through `controls: { id: { key: byte } }`.',
        zh: '最後幾層在這裡處理，順序是：每台燈的 `limits`（`{ dimmer: [0, 0.8], tilt: [0.1, 0.9] }`），接著總控（grand master），接著 blackout，最後是 strobe 通道的閃爍上限。blackout 會讓亮度和顏色歸零，pan、tilt、zoom 和 control 通道維持原樣。profile 有寫 Hz 的每一個 strobe 通道，都會被限制在 `maxFlashHz`（預設 3）以下，沒寫 Hz 的就停在 open 的值，因為沒有人說得出它會閃多快。用鍵名設定的第二個調光或 strobe 通道，一樣套用上下限、總控、blackout 和閃爍上限。`control` 通道（重置、燈泡開關、內建程式）只能透過 `controls: { id: { key: byte } }` 寫入。',
      },
    ],
    members: {
      add: { en: 'Place a fixture (see above). Returns the placed fixture: `{ id, name, profile, mode, universe, address, footprint, groups, limits }`.', zh: '放一台燈（見上文）。回傳放好的燈：`{ id, name, profile, mode, universe, address, footprint, groups, limits }`。' },
      remove: { en: '`remove(id)`: take a fixture out; true when it was there.', zh: '`remove(id)`：把一台燈拿掉，原本有就回傳 true。' },
      get: { en: '`get(id)`: the placed fixture, or null.', zh: '`get(id)`：放好的那台燈，沒有就是 null。' },
      fixtures: { en: 'Every placed fixture, in the order they were added.', zh: '所有放好的燈，依加入的順序。' },
      ids: { en: '`ids(target)`: fixture ids for a fixture id, a group, `\'*\'` (all) or a list of these.', zh: '`ids(target)`：燈的 id、群組名稱、`\'*\'`（全部）或這些的清單，換成燈的 id 清單。' },
      check: { en: '`check()`: fixtures that share addresses, `[{ code: \'overlap\', universe, address: [from, to], ids, text }]`.', zh: '`check()`：共用位址的燈，`[{ code: \'overlap\', universe, address: [from, to], ids, text }]`。' },
      toJSON: { en: '`{ format: \'open-audiovisual/patch@1\', fixtures: [{ id, profile, mode, universe, address, name?, groups?, limits? }] }`.', zh: '`{ format: \'open-audiovisual/patch@1\', fixtures: [{ id, profile, mode, universe, address, name?, groups?, limits? }] }`。' },
      fromJSON: { en: '`Patch.fromJSON(json, { profiles })`: a patch from `toJSON()` data. Pass your own profiles again: the file keeps only their ids.', zh: '`Patch.fromJSON(json, { profiles })`：從 `toJSON()` 的資料重建 patch。自己的 profile 要再傳一次，檔案裡只記它們的 id。' },
      resolve: { en: '`resolve(id, props, { master, blackout, maxFlashHz })`: the properties the fixture will really get, after its limits, the master, blackout and the strobe cap.', zh: '`resolve(id, props, { master, blackout, maxFlashHz })`：這台燈實際會拿到的屬性，已經套上限制、總控、blackout 和 strobe 上限。' },
      render: { en: '`render(states, { master = 1, blackout = false, maxFlashHz = 3, controls, universes })`: every patched fixture\'s bytes, as [`Universes`](#Universes).', zh: '`render(states, { master = 1, blackout = false, maxFlashHz = 3, controls, universes })`：每台 patch 好的燈的位元組，以 [`Universes`](#Universes) 回傳。' },
    },
    tbd: [
      {
        en: 'A strobe range\'s Hz is read as linear from its first to its last value. Real fixtures are often not linear; with one that flashes faster than linear in the middle of its range, 3 Hz here can be more on the light. Not measured on any fixture.',
        zh: 'strobe 區段的 Hz 是從第一個值到最後一個值線性換算的。真的燈常常不是線性，如果一台燈在區段中間閃得比線性快，這裡算出的 3 Hz 在燈上可能會更快。還沒有在任何一台燈上量過。',
      },
    ],
    examples: [
      {
        code: `import { Patch } from '@openav/dmx';

${RIG}
patch.add({ id: 'head', profile: 'generic-moving-head', mode: '16ch', address: 20 });
const u = patch.render({
  par1: { dimmer: 1, color: [1, 0.6, 0.2] },
  head: { dimmer: 0.5, pan: 0.3, tilt: 0.5 },
}).bytes(1);
document.getElementById('app').innerHTML = [
  'par1 (1–6): ' + Array.from(u.slice(0, 6)).join(' '),
  'par2 (7–12), no state: ' + Array.from(u.slice(6, 12)).join(' '),
  'head pan, panFine, tilt, tiltFine (20–23): ' + Array.from(u.slice(19, 23)).join(' '),
].join('<br>');`,
        caption: { en: 'Prints par1 as 255 204 102 0 51 0 (dimmer, red, green, blue, white, strobe), par2 as six zeros, and the head\'s 16-bit pan 0.3 and tilt 0.5 as 76 205 128 0.', zh: '印出 par1 是 255 204 102 0 51 0（dimmer、紅、綠、藍、白、strobe），par2 是六個 0，搖頭燈 16 位元的 pan 0.3 和 tilt 0.5 是 76 205 128 0。' },
      },
      {
        code: `import { Patch } from '@openav/dmx';

${RIG}
patch.add({ id: 'twin', profile: 'generic-rgbw', mode: '4ch', address: 3 });
let msg = '';
try { patch.add({ id: 'late', profile: 'generic-rgbw', mode: '6ch', address: 510 }); } catch (e) { msg = e.message; }
const again = Patch.fromJSON(patch.toJSON());
document.getElementById('app').innerHTML = [
  ...patch.check().map((p) => p.text),
  msg,
  'read back: ' + again.fixtures.map((f) => f.id + '@' + f.address).join(', '),
].join('<br>');`,
        caption: { en: 'Prints that par1 and twin share addresses 3–6, the error for a 6-channel fixture at 510 (the last start address that fits is 507), and the patch read back from its JSON.', zh: '印出 par1 和 twin 共用位址 3–6、把 6 通道的燈放在 510 的錯誤訊息（最後放得下的起始位址是 507），以及從 JSON 讀回來的 patch。' },
      },
    ],
    related: ['DmxEngine', 'FIXTURES', 'rgbToChannels', 'Universes'],
    keywords: { en: ['patch', 'address', 'fixture', 'group', 'limit', 'master', 'blackout', '16-bit'], zh: ['配置', '位址', '群組', '上限', '總控', '全暗'] },
  },

  DmxEngine: {
    group: 'dmx',
    summary: {
      en: 'Renders every light of a patch at any moment, as a pure function of time: base scenes, cues with fades, chases on beats, effects, live values, master and blackout.',
      zh: '把一個 patch 裡每台燈在任何時刻的樣子算出來，結果只取決於時間：基礎 scene、有淡入淡出的 cue、跟著拍子的 chase、effect、即時值、總控與 blackout。',
    },
    params: [
      { name: 'patch', type: 'Patch', en: 'The [`Patch`](#Patch) to render. Fixtures added to it later are rendered too.', zh: '要算的 [`Patch`](#Patch)。之後才加進去的燈也會算到。' },
      { name: 'maxFlashHz', type: 'Number', optional: true, default: '3', en: 'The most flashes a second one fixture may get from the effects and chases on it together (and a strobe channel on its own), in Hz. 3 is the common photosensitive-epilepsy line. Raise it (or set `Infinity`) only on purpose. Also a property: `engine.maxFlashHz`. The transport\'s flash guard has a cap of its own.', zh: '一台燈從它身上所有 effect 和 chase 加起來（以及 strobe 通道自己）每秒最多可以閃幾次，單位 Hz。3 是光敏性癲癇常用的安全線。只有確定要的時候才調高（或設成 `Infinity`）。也是屬性：`engine.maxFlashHz`。傳送端的頻閃保護有它自己的上限。' },
      { name: 'bpm', type: 'Number', optional: true, default: '120', en: 'The tempo for beat-synced chases and effects when `render()` is not given one. Also a property: `engine.bpm`.', zh: '`render()` 沒有給拍速時，跟拍子走的 chase 和 effect 用這個拍速。也是屬性：`engine.bpm`。' },
    ],
    description: [
      {
        en: '`render(t, { beat, bpm })` returns the bytes of every universe at `t` seconds; `state(t)` returns the same moment as properties per fixture, plus `capped`, the effects and chases the flash cap slowed down. The same `t` always gives the same bytes: nothing reads a clock, nothing random is drawn (a flicker is seeded), nothing adds up frame by frame. So a look can be tested with no light, a recording can be rendered frame by frame, and scrubbing back shows what was. `beat` is a beat position (from `@openav/drums` or MIDI clock); without it, beats are `t · bpm / 60`. Give `bpm` with `beat`: the flash cap turns a rate per beat into flashes per second with the tempo, so `render(t, { beat })` alone throws.',
        zh: '`render(t, { beat, bpm })` 回傳 `t` 秒時每個 universe 的位元組，`state(t)` 回傳同一個時刻、每台燈的屬性，再加上 `capped`，也就是這一刻被閃爍上限放慢的 effect 和 chase。同一個 `t` 永遠得到同樣的位元組：不讀時鐘、不抽亂數（閃爍有種子）、不會一格一格累加。所以沒有燈也能測一個畫面，錄影可以逐格算，往回拉也看得到當時的樣子。`beat` 是拍子位置（來自 `@openav/drums` 或 MIDI clock），沒給的話拍子就是 `t · bpm / 60`。給 `beat` 的時候也要給 `bpm`：閃爍上限要靠拍速把「每拍幾次」換成「每秒幾次」，所以只給 `render(t, { beat })` 會丟出錯誤。',
      },
      {
        en: 'The layers, bottom to top: `base(...scenes)`, the look that is just on; cues, `cue(name, { scene, fadeIn, fadeOut, curve })` and `go(name, at)`, where the times belong to the cue you go to, as on a lighting desk (it rises over its fadeIn while what was on falls over its fadeOut, and a shorter fadeOut makes a dip); `chase(name, { steps, every, unit, fade, start })`, scenes in turn every n beats or seconds; `effect(name, { target, property, wave, rate, unit, depth, phase, spread, width, seed })` with waves sine, saw, square, chase, flicker and rainbow, each fixture of the target behind the one before by `spread`; then `set(target, props)`, live values from a fader or the microphone; then `submaster(target, level)`, a fader over a group that scales its dimmer; then the patch\'s limits, `engine.master`, `engine.blackout`. A target is a fixture id, a group, `\'*\'` or a list. [`dmxParams()`](#dmxParams) turns these control points into params.',
        zh: '由下往上的圖層：`base(...scenes)`，一直開著的基本畫面，cue，用 `cue(name, { scene, fadeIn, fadeOut, curve })` 定義、`go(name, at)` 觸發，時間算在你要去的那個 cue 上，跟燈光控台一樣（它照自己的 fadeIn 亮起，原本的照它的 fadeOut 暗下，fadeOut 比較短就會先暗一下），`chase(name, { steps, every, unit, fade, start })`，每隔幾拍或幾秒輪到下一個 scene，`effect(name, { target, property, wave, rate, unit, depth, phase, spread, width, seed })`，波形有 sine、saw、square、chase、flicker、rainbow，目標裡每台燈依 `spread` 比前一台晚一點，接著 `set(target, props)`，推桿或麥克風的即時值，再來是 `submaster(target, level)`，一支管一個群組的推桿，把它的 dimmer 等比例調暗，最後是 patch 的上下限、`engine.master`、`engine.blackout`。目標可以是燈的 id、群組、`\'*\'` 或清單。[`dmxParams()`](#dmxParams) 把這些控制點變成參數。',
      },
      {
        en: 'Safety, on by default, and counted per fixture: what matters is the light one fixture gives. First each effect on dimmer or colour, and each chase that changes anything but position, is held on its own to at most `maxFlashHz` flashes a second: a rate in seconds is clamped, one in beats is halved until it fits so it stays on the beat, a chase\'s step is doubled, a random flicker draws at most that many new values a second. Then, per fixture, the rates of everything that flashes it are added up; when the sum is over the cap, those sources are slowed on that fixture only (a rate in seconds by the same factor, one in beats halved, a chase\'s step doubled), and `state(t).slowed` says which fixture, from what sum to what, and every source there. It is still a pure function of time. Live values (`set()`, `submaster()`, params a microphone drives) are not slowed here: the flash guard in every [`dmxTransport()`](#dmxTransport) holds what each fixture really emits. A strobe channel follows the cap where its profile gives Hz (see [`Patch`](#Patch)). An effect on dimmer only takes light away from the look under it, never brighter. A `control` channel (reset, lamp, built-in programs) cannot be named in a scene or `set()`: only `control(id, key, byte)` writes it, and neither master nor blackout touches it. Blackout leaves pan, tilt and zoom where they are.',
        zh: '安全機制預設就開著，而且以每台燈來算：要緊的是一台燈實際發出來的光。首先，每一個作用在 dimmer 或顏色上的 effect，以及每一個改變位置以外任何東西的 chase，各自被限制在每秒最多閃 `maxFlashHz` 次：以秒為單位的速度直接夾住，以拍為單位的速度一次減半直到符合，這樣還是踩在拍子上，chase 則把每一步的長度加倍，隨機閃爍每秒最多換那麼多次值。接著對每一台燈，把會讓它閃的東西的頻率加起來，總和超過上限，就只在這台燈上把這些來源放慢（以秒為單位的照同一個比例，以拍為單位的對半降，chase 的每一步加倍），`state(t).slowed` 會說是哪台燈、總和從多少降到多少，以及那台燈上的每個來源。結果仍然只取決於時間。即時值（`set()`、`submaster()`、麥克風推的參數）在這裡不會被放慢：每個 [`dmxTransport()`](#dmxTransport) 裡的頻閃保護管住每台燈實際發出的光。profile 寫了 Hz 的 strobe 通道也遵守上限（見 [`Patch`](#Patch)）。作用在 dimmer 上的 effect 只會讓燈比底下的畫面暗，不會更亮。`control` 通道（重置、燈泡開關、內建程式）不能寫在 scene 或 `set()` 裡，只有 `control(id, key, byte)` 能寫，總控和 blackout 都不會動到它。blackout 時 pan、tilt、zoom 停在原處。',
      },
    ],
    members: {
      scene: { en: '`scene(name, { target: props })`: define or replace a scene. Checks every target and property at once.', zh: '`scene(name, { target: props })`：定義或取代一個 scene。目標和屬性當下就會檢查。' },
      base: { en: '`base(...names)`: the scenes that are on underneath everything; a later one wins where two set the same property.', zh: '`base(...names)`：墊在最底下、一直開著的 scene。兩個設了同一個屬性時，後面的優先。' },
      cue: { en: '`cue(name, { scene, fadeIn = 0, fadeOut = fadeIn, curve = \'linear\' })`: curves are `linear`, `smooth`, `in`, `out`.', zh: '`cue(name, { scene, fadeIn = 0, fadeOut = fadeIn, curve = \'linear\' })`：曲線有 `linear`、`smooth`、`in`、`out`。' },
      go: { en: '`go(name, at)`: go to a cue at `at` seconds, on the clock `render()` is given.', zh: '`go(name, at)`：在 `at` 秒（`render()` 用的那個時間）觸發一個 cue。' },
      release: { en: '`release(at, fade)`: fade the cues out over `fade` seconds (the live cue\'s fadeOut by default), back to the base.', zh: '`release(at, fade)`：在 `fade` 秒內讓 cue 淡出（預設用正在亮的 cue 的 fadeOut），回到基礎畫面。' },
      chase: { en: '`chase(name, { steps, every = 1, unit = \'beat\', fade = 0, start = 0, curve })`: runs from the moment it is defined.', zh: '`chase(name, { steps, every = 1, unit = \'beat\', fade = 0, start = 0, curve })`：定義好就開始跑。' },
      effect: { en: '`effect(name, { target, property = \'dimmer\', wave = \'sine\', rate = 1, unit = \'second\', depth = 1, phase = 0, spread, width, seed = 1 })`. On pan, tilt and zoom it swings around the value under it; rainbow runs on `color`.', zh: '`effect(name, { target, property = \'dimmer\', wave = \'sine\', rate = 1, unit = \'second\', depth = 1, phase = 0, spread, width, seed = 1 })`。在 pan、tilt、zoom 上是繞著底下的值擺動。rainbow 用在 `color` 上。' },
      remove: { en: '`remove(name)`: take a chase or an effect away.', zh: '`remove(name)`：拿掉一個 chase 或 effect。' },
      run: { en: '`run(name, on = true)`: start or stop a chase or an effect.', zh: '`run(name, on = true)`：開始或停止一個 chase 或 effect。' },
      set: { en: '`set(target, props)`: live values on top of everything, merged per fixture; the latest set wins.', zh: '`set(target, props)`：疊在最上面的即時值，每台燈各自合併，最後設的優先。' },
      clear: { en: '`clear(target, keys)`: drop live values: all, a target\'s, or some properties of a target.', zh: '`clear(target, keys)`：清掉即時值：全部、某個目標的，或某個目標的部分屬性。' },
      control: { en: '`control(id, key, byte)`: write a control channel; `null` lets it go back to its default.', zh: '`control(id, key, byte)`：寫入 control 通道，給 `null` 就回到預設值。' },
      state: { en: '`state(t, { beat, bpm })`: `{ t, beat, fixtures: { id: props }, capped: [{ kind, name, hz, to }], slowed: [{ id, hz, to, sources: [{ kind, name, hz, to }] }] }`. `capped`: the effects and chases slowed on their own; `slowed`: the fixtures where what flashes them still added up past the cap, with the sum before and after.', zh: '`state(t, { beat, bpm })`：`{ t, beat, fixtures: { id: props }, capped: [{ kind, name, hz, to }], slowed: [{ id, hz, to, sources: [{ kind, name, hz, to }] }] }`。`capped` 是各自被放慢的 effect 和 chase，`slowed` 是那些閃它的東西加起來還是超過上限的燈，附上放慢前後的總和。' },
      render: { en: '`render(t, { beat, bpm })`: the bytes of every universe at `t`, as [`Universes`](#Universes).', zh: '`render(t, { beat, bpm })`：`t` 時每個 universe 的位元組，以 [`Universes`](#Universes) 回傳。' },
      patch: { en: 'The patch this engine renders.', zh: '這個引擎在算的 patch。' },
      tune: { en: '`tune(name, { rate, depth }, at, { beat, bpm })`: change a running effect\'s rate or depth from `at` seconds on, without a jump: the wave goes on from where it is, only faster or slower (defining the effect again would restart its phase, and a knob turned on a wave 100 s along would flicker through many cycles at once). So do the other waves and chases that share a fixture with it, when the per-fixture cap changes their speed there. `at` is needed for a rate.', zh: '`tune(name, { rate, depth }, at, { beat, bpm })`：從 `at` 秒起改變正在跑的 effect 的速度或深度，不會跳：波形從它現在的位置接著走，只是變快或變慢（重新定義 effect 會讓相位重來，在已經跑了 100 秒的波形上轉旋鈕，會一下子閃過好幾個週期）。跟它共用一台燈的其他波形和 chase，如果每台燈的上限因此改了它們在那台燈上的速度，也一樣接著走。改速度一定要給 `at`。' },
      submaster: { en: '`submaster(target, level)`: a fader over a group: after every layer the dimmer of its fixtures is multiplied by `level` (0..1), so what runs under it keeps running. Two over one fixture multiply; `null` removes it.', zh: '`submaster(target, level)`：管一個群組的推桿：所有圖層算完之後，把群組裡每台燈的 dimmer 乘上 `level`（0..1），底下在跑的東西照樣跑。同一台燈有兩支就相乘，給 `null` 就拿掉。' },
      describe: { en: '`describe()`: what the engine holds, as copies: `{ scenes, cues, base, chases: { name: { steps, every, unit, fade, start, curve, running } }, effects: { name: { target, property, wave, rate, unit, depth, phase, spread, width, seed, running } }, submasters, master, blackout, maxFlashHz, bpm, slowed }` (`slowed` as in `state()`, at the engine\'s own bpm).', zh: '`describe()`：引擎裡有什麼，以複本回傳：`{ scenes, cues, base, chases: { name: { steps, every, unit, fade, start, curve, running } }, effects: { name: { target, property, wave, rate, unit, depth, phase, spread, width, seed, running } }, submasters, master, blackout, maxFlashHz, bpm, slowed }`（`slowed` 跟 `state()` 的一樣，用引擎自己的 bpm 算）。' },
    },
    notes: [
      {
        en: 'The per-fixture cap works on rates, so what it promises is the average: two waves on one light that add up to 3 Hz could still bunch their edges into one particular second. The flash guard in the transport counts the flashes in every second and holds that too, so send through [`dmxTransport()`](#dmxTransport). A fixture slowed by the cap runs its share of a row\'s wave at its own speed, out of step with the row, until what slowed it stops. An effect at depth 0 still counts while it runs: stop it with `run(name, false)` to give its share back.',
        zh: '每台燈的上限是用頻率算的，所以它保證的是平均：同一台燈上加起來 3 Hz 的兩個波形，還是可能把轉折擠在某一秒裡。傳送端的頻閃保護會數每一秒裡的閃爍次數，這種也擋得住，所以要經過 [`dmxTransport()`](#dmxTransport) 送出。被上限放慢的燈，會用自己的速度跑一排燈的波形，跟那一排錯開，直到讓它變慢的東西停下來。深度 0 的 effect 只要在跑就還是算數：用 `run(name, false)` 停掉它，才會把它那一份還回來。',
      },
    ],
    tbd: [UNTESTED],
    examples: [
      {
        code: `import { Patch, DmxEngine } from '@openav/dmx';

${RIG}
const engine = new DmxEngine(patch);
engine.scene('warm', { front: { dimmer: 1, color: [1, 0.6, 0.2] } });
engine.scene('blue', { front: { dimmer: 0.6, color: [0, 0.2, 1] } });
engine.cue('A', { scene: 'warm' }).cue('B', { scene: 'blue', fadeIn: 2 });
engine.go('A', 0).go('B', 4);
const row = (t) => t + ' s: ' + Array.from(engine.render(t).bytes(1).slice(0, 6)).join(' ');
document.getElementById('app').innerHTML = [0, 5, 6].map(row).join('<br>');`,
        caption: { en: 'Prints par1\'s six bytes at 0 s (warm: 255 204 102 0 51 0), at 5 s halfway through the 2-second fade, and at 6 s (blue: 153 0 51 255 0 0).', zh: '印出 par1 的六個位元組：0 秒是暖色（255 204 102 0 51 0），5 秒是 2 秒淡入的一半，6 秒是藍色（153 0 51 255 0 0）。' },
      },
      {
        code: `import { Patch, DmxEngine } from '@openav/dmx';

${RIG}
const engine = new DmxEngine(patch);
engine.scene('on', { front: { dimmer: 1, color: [1, 1, 1] } }).base('on');
engine.effect('run', { target: 'front', wave: 'chase', rate: 1 });
const lit = (t) => t + ' s: ' + ['par1', 'par2'].map((id) => id + ' ' + engine.state(t).fixtures[id].dimmer).join(', ');
const lines = [lit(0), lit(0.5)];
engine.remove('run').effect('strobe', { target: 'front', wave: 'square', rate: 10 });
lines.push('capped: ' + JSON.stringify(engine.state(0).capped));
document.getElementById('app').innerHTML = lines.join('<br>');`,
        caption: { en: 'Prints the chase lighting par1 at 0 s and par2 at 0.5 s, then capped: a 10 Hz square wave on the pars slowed to 3 Hz by the flash cap.', zh: '印出追光在 0 秒點亮 par1、0.5 秒點亮 par2，接著 capped：兩台 par 上 10 Hz 的方波被閃爍上限放慢到 3 Hz。' },
      },
      {
        code: `import { Patch, DmxEngine } from '@openav/dmx';

const patch = new Patch();
patch.add({ id: 'head', profile: 'generic-moving-head', mode: '16ch', address: 1 });
const engine = new DmxEngine(patch);
engine.set('head', { dimmer: 1, pan: 0.25, tilt: 0.75, color: [0, 0, 1] });
let msg = '';
try { engine.set('head', { reset: 1 }); } catch (e) { msg = e.message; }
engine.blackout = true;
const u = engine.render(0).bytes(1);
document.getElementById('app').innerHTML = [
  'blackout, pan and tilt: ' + Array.from(u.slice(0, 4)).join(' ') + ', dimmer: ' + u[5],
  msg,
].join('<br>');`,
        caption: { en: 'Prints the head in blackout: pan and tilt still 64 0 191 255, dimmer 0, then the error for setting the reset channel: only control() writes it.', zh: '印出 blackout 中的搖頭燈：pan 和 tilt 還是 64 0 191 255，dimmer 是 0，接著是設定 reset 通道的錯誤訊息：只有 control() 能寫它。' },
      },
    ],
    related: ['Patch', 'Universes', 'encodeArtDmx', 'encodeSacn'],
    keywords: { en: ['lighting', 'cue', 'fade', 'chase', 'effect', 'scene', 'strobe', 'flash', 'epilepsy', 'blackout', 'master', 'deterministic'], zh: ['燈光', '淡入', '淡出', '追光', '效果', '頻閃', '癲癇', '全暗', '總控'] },
  },

  encodeArtDmx: {
    group: 'dmx',
    summary: {
      en: 'One Art-Net ArtDmx packet (opcode 0x5000, protocol 14) for up to 512 channels, ready to send by UDP to port 6454.',
      zh: '一個 Art-Net ArtDmx 封包（opcode 0x5000、協定版本 14），最多 512 個通道，可以直接用 UDP 送到 6454 埠。',
    },
    params: [
      { name: 'data', type: 'ArrayLike<Number>', en: 'Channel values 0–255, channel 1 first. An odd count gets one 0 added, as the length must be even.', zh: '通道值 0–255，從第 1 通道開始。個數是奇數時補一個 0，因為長度必須是偶數。' },
      { name: 'universe', type: 'Number', optional: true, default: '1', en: 'The 15-bit Port-Address, 0–32767: Net (7 bits), Sub-Net (4) and Universe (4) in one number. "Universe 1" as people say it is Port-Address 1 (Net 0, Sub-Net 0, Universe 1), the default; 0 still works but the spec deprecates it.', zh: '15 位元的 Port-Address，0–32767：Net（7 位元）、Sub-Net（4）、Universe（4）合成一個數字。大家口中的「universe 1」就是 Port-Address 1（Net 0、Sub-Net 0、Universe 1），也是預設值。0 還能用，但規格不建議。' },
      { name: 'sequence', type: 'Number', optional: true, default: '0', en: '0 turns sequencing off; a sender counts 1–255 so a node can put packets back in order.', zh: '0 代表不用序號。送出端從 1 數到 255，節點才能把封包排回正確順序。' },
      { name: 'physical', type: 'Number', optional: true, default: '0', en: 'The input port the data came from (for merging at the node).', zh: '資料來自哪個輸入埠（給節點合併用）。' },
    ],
    returns: { type: 'Uint8Array', en: '18 header bytes and the data.', zh: '18 個表頭位元組加上資料。' },
    description: [
      {
        en: 'Field by field from "Art-Net 4 Specification", ArtDmx packet definition: `Art-Net\\0`, the opcode low byte first, protocol version 0 and 14, sequence, physical, SubUni (low byte of the Port-Address), Net (top 7 bits), the length high byte first, the data. A browser cannot send UDP: the out-bridge\'s `artnet` sink sends it ([`startBridge()`](#out-startBridge)).',
        zh: '照《Art-Net 4 Specification》的 ArtDmx packet definition 一欄一欄寫：`Art-Net\\0`、opcode（低位元組在前）、協定版本 0 和 14、序號、physical、SubUni（Port-Address 的低位元組）、Net（最高 7 位元）、長度（高位元組在前）、資料。瀏覽器不能送 UDP，要交給輸出橋接程式的 `artnet` 輸出送（[`startBridge()`](#out-startBridge)）。',
      },
      {
        en: 'The spec asks for ArtDmx to be unicast to the nodes that subscribe to the universe, never broadcast. Art-Net™ Designed by and Copyright Artistic Licence.',
        zh: '規格要求 ArtDmx 用單播送給訂閱這個 universe 的節點，不能廣播。Art-Net™ Designed by and Copyright Artistic Licence。',
      },
    ],
    tbd: [UNTESTED],
    examples: [
      {
        code: `import { encodeArtDmx } from '@openav/dmx';

${HEX}
const packet = encodeArtDmx([255, 128, 0], { universe: 0x0123, sequence: 1 });
document.getElementById('app').innerHTML = hex(packet) + '<br>' + packet.length + ' bytes';`,
        caption: { en: 'Prints 41 72 74 2d 4e 65 74 00 00 50 00 0e 01 00 23 01 00 04 ff 80 00 00, then 22 bytes: three channels padded to four.', zh: '印出 41 72 74 2d 4e 65 74 00 00 50 00 0e 01 00 23 01 00 04 ff 80 00 00，接著是 22 bytes：三個通道補成四個。' },
      },
    ],
    related: ['decodeArtDmx', 'encodeSacn', 'Universe'],
    keywords: { en: ['Art-Net', 'ArtDmx', 'UDP', '6454', 'node', 'Port-Address'], zh: ['網路', '節點', '封包'] },
  },

  decodeArtDmx: {
    group: 'dmx',
    summary: {
      en: 'Reads an ArtDmx packet back into its universe, sequence and channel values, or returns null for any other packet.',
      zh: '把 ArtDmx 封包讀回 universe、序號和通道值，不是 ArtDmx 的封包就回傳 null。',
    },
    params: [
      { name: 'bytes', type: 'ArrayLike<Number>', en: 'A UDP payload (a Node Buffer works: it is a Uint8Array).', zh: '一個 UDP 的內容（Node 的 Buffer 也可以，它就是 Uint8Array）。' },
    ],
    returns: { type: 'Object | null', en: '`{ universe, sequence, physical, version, data }`, data a copy of the channel values.', zh: '`{ universe, sequence, physical, version, data }`，data 是通道值的複本。' },
    description: [
      {
        en: 'For a monitor or a test receiver: an ArtPoll, another opcode, a packet cut short or a length that does not fit gives null, so a receiver can call it on everything that arrives on port 6454.',
        zh: '給監看程式或測試用的接收端：ArtPoll、其他 opcode、被截斷的封包或長度對不上的，都回傳 null，所以接收端可以對 6454 埠收到的每個封包都呼叫它。',
      },
    ],
    examples: [
      {
        code: `import { encodeArtDmx, decodeArtDmx } from '@openav/dmx';

const back = decodeArtDmx(encodeArtDmx([10, 20, 30], { universe: 300, sequence: 7 }));
document.getElementById('app').innerHTML = 'universe ' + back.universe + ', sequence ' + back.sequence + ', data ' + Array.from(back.data).join(' ')
  + '<br>not Art-Net: ' + decodeArtDmx(new Uint8Array(20));`,
        caption: { en: 'Prints universe 300, sequence 7, data 10 20 30 0 (the padding byte comes back), then not Art-Net: null.', zh: '印出 universe 300、序號 7、資料 10 20 30 0（補的那個位元組也會回來），接著 not Art-Net: null。' },
      },
    ],
    related: ['encodeArtDmx'],
  },

  encodeSacn: {
    group: 'dmx',
    summary: {
      en: 'One sACN (E1.31) data packet for 1–512 slots: root, framing and DMP layers with their lengths, priority, sequence and universe, ready for UDP port 5568.',
      zh: '一個 sACN（E1.31）資料封包，1–512 格：root、framing、DMP 三層和各自的長度欄位、優先權、序號、universe，可以直接用 UDP 送到 5568 埠。',
    },
    params: [
      { name: 'data', type: 'ArrayLike<Number>', en: 'Slot values 0–255, slot 1 first (start code 0 is added).', zh: '每格的值 0–255，從第 1 格開始（起始碼 0 會自動加上）。' },
      { name: 'universe', type: 'Number', optional: true, default: '1', en: 'The universe, 1–63999.', zh: 'universe，1–63999。' },
      { name: 'cid', type: 'ArrayLike<Number>', en: 'The sender\'s 16-byte CID (a UUID that stays the same for one sender). Required.', zh: '送出端 16 位元組的 CID（同一個送出端固定不變的 UUID）。一定要給。' },
      { name: 'source', type: 'String', optional: true, default: "'open-audiovisual'", en: 'The source name a receiver shows, UTF-8, cut at a character to 63 bytes.', zh: '接收端會顯示的來源名稱，UTF-8，超過 63 位元組時在完整的字之後截斷。' },
      { name: 'priority', type: 'Number', optional: true, default: '100', en: '0–200: a receiver takes the highest priority it hears for a universe.', zh: '0–200：接收端對同一個 universe 會採用聽到的最高優先權。' },
      { name: 'sequence', type: 'Number', optional: true, default: '0', en: '0–255, counted up by the sender.', zh: '0–255，由送出端遞增。' },
      { name: 'preview', type: 'Boolean', optional: true, default: 'false', en: 'Options bit 7: data meant for a visualiser, not for lights.', zh: '選項第 7 位元：資料是給視覺化程式看的，不是給燈的。' },
      { name: 'terminated', type: 'Boolean', optional: true, default: 'false', en: 'Options bit 6: this source stops sending this universe.', zh: '選項第 6 位元：這個來源不再送這個 universe。' },
    ],
    returns: { type: 'Uint8Array', en: '126 header bytes and the slots (638 bytes for a full universe).', zh: '126 個表頭位元組加上每格的值（完整的 universe 是 638 bytes）。' },
    description: [
      {
        en: 'A receiver either listens on the multicast group of the universe ([`sacnAddress()`](#sacnAddress)) or gets the packet unicast. Each layer\'s flags and length field is 0x7 and the length from that field to the end of the packet: for 512 slots 0x726E, 0x7258 and 0x720B.',
        zh: '接收端可以加入這個 universe 的多播群組（[`sacnAddress()`](#sacnAddress)），也可以用單播收。每一層的 flags & length 欄位是 0x7 加上從這個欄位到封包結尾的長度：512 格時分別是 0x726E、0x7258、0x720B。',
      },
    ],
    tbd: [
      {
        en: 'ESTA\'s text of ANSI E1.31 could not be read for this package (the site refuses automated downloads). Every offset and constant was checked against two independent open implementations instead: ETCLabs/sACN and libe131.',
        zh: '這個套件沒能讀到 ESTA 的 ANSI E1.31 原文（網站拒絕自動下載），所以每個位移和常數改成跟兩套獨立的開源實作對照過：ETCLabs/sACN 和 libe131。',
      },
      UNTESTED,
    ],
    examples: [
      {
        code: `import { encodeSacn } from '@openav/dmx';

${HEX}
const cid = Array.from({ length: 16 }, (_, i) => i);
const p = encodeSacn(new Uint8Array(512), { universe: 1, cid, source: 'my show', priority: 100 });
document.getElementById('app').innerHTML = [
  p.length + ' bytes',
  'root, framing, DMP flags & length: ' + [hex(p.slice(16, 18)), hex(p.slice(38, 40)), hex(p.slice(115, 117))].join(' | '),
  'universe: ' + hex(p.slice(113, 115)) + ', property count: ' + hex(p.slice(123, 125)),
].join('<br>');`,
        caption: { en: 'Prints 638 bytes, then the three length fields 72 6e | 72 58 | 72 0b, then universe 00 01 and property count 02 01 (the start code and 512 slots).', zh: '印出 638 bytes，接著三個長度欄位 72 6e | 72 58 | 72 0b，然後 universe 00 01 和 property count 02 01（起始碼加 512 格）。' },
      },
    ],
    related: ['decodeSacn', 'sacnAddress', 'encodeArtDmx'],
    keywords: { en: ['sACN', 'E1.31', 'streaming ACN', 'multicast', '5568', 'priority'], zh: ['多播', '優先權', '網路'] },
  },

  decodeSacn: {
    group: 'dmx',
    summary: {
      en: 'Reads an E1.31 data packet back into its universe, priority, sequence, source name, CID and slot values, or returns null for anything else.',
      zh: '把 E1.31 資料封包讀回 universe、優先權、序號、來源名稱、CID 和每格的值，其他的封包回傳 null。',
    },
    params: [
      { name: 'bytes', type: 'ArrayLike<Number>', en: 'A UDP payload.', zh: '一個 UDP 的內容。' },
    ],
    returns: { type: 'Object | null', en: '`{ universe, priority, sequence, source, cid, preview, terminated, startCode, data }`, data a copy of the slot values.', zh: '`{ universe, priority, sequence, source, cid, preview, terminated, startCode, data }`，data 是每格值的複本。' },
    description: [
      {
        en: 'It checks the identifier, the three vectors and that every layer\'s length matches the packet, so synchronization and discovery packets, and anything cut short, give null. A start code other than 0 is returned as `startCode` for the caller to decide.',
        zh: '它會檢查識別碼、三個 vector，以及每一層的長度跟封包相符，所以同步封包、探索封包和被截斷的封包都回傳 null。起始碼不是 0 的，放在 `startCode` 交給呼叫端決定。',
      },
    ],
    examples: [
      {
        code: `import { encodeSacn, decodeSacn } from '@openav/dmx';

const cid = Array.from({ length: 16 }, (_, i) => 255 - i);
const d = decodeSacn(encodeSacn([1, 2, 3], { universe: 7, cid, source: '舞台左側', priority: 120, sequence: 42 }));
document.getElementById('app').innerHTML = [d.universe, d.priority, d.sequence, d.source, Array.from(d.data).join(' ')].join('<br>');`,
        caption: { en: 'Prints 7, 120, 42, the Chinese source name and the slots 1 2 3, one per line.', zh: '一行一個，印出 7、120、42、來源名稱「舞台左側」和每格的值 1 2 3。' },
      },
    ],
    related: ['encodeSacn', 'sacnAddress'],
  },

  sacnAddress: {
    group: 'dmx',
    summary: {
      en: 'The multicast group a receiver joins for one sACN universe: 239.255.<universe high byte>.<universe low byte>.',
      zh: '接收端要加入的 sACN universe 多播群組：239.255.<universe 高位元組>.<universe 低位元組>。',
    },
    params: [
      { name: 'universe', type: 'Number', en: 'The universe, 1–63999.', zh: 'universe，1–63999。' },
    ],
    returns: { type: 'String', en: 'An IPv4 address such as `239.255.0.1`.', zh: '一個 IPv4 位址，例如 `239.255.0.1`。' },
    description: [
      {
        en: 'Send the packet from [`encodeSacn()`](#encodeSacn) to this address on port 5568 and every receiver that listens to the universe gets it, with no setup on the network beyond multicast working.',
        zh: '把 [`encodeSacn()`](#encodeSacn) 的封包送到這個位址的 5568 埠，所有在聽這個 universe 的接收端都會收到，網路只要支援多播就好，不用另外設定。',
      },
    ],
    examples: [
      {
        code: `import { sacnAddress } from '@openav/dmx';

document.getElementById('app').innerHTML = [1, 2, 256, 4660].map((u) => u + ' → ' + sacnAddress(u)).join('<br>');`,
        caption: { en: 'Prints 1 → 239.255.0.1, 2 → 239.255.0.2, 256 → 239.255.1.0 and 4660 → 239.255.18.52.', zh: '印出 1 → 239.255.0.1、2 → 239.255.0.2、256 → 239.255.1.0、4660 → 239.255.18.52。' },
      },
    ],
    related: ['encodeSacn'],
  },

  encodeEnttecDmx: {
    group: 'dmx',
    summary: {
      en: 'The serial frame that makes an Enttec DMX USB Pro (and interfaces that copy its protocol) send one universe: 0x7E, label 6, length, start code and channels, 0xE7.',
      zh: '讓 Enttec DMX USB Pro（以及沿用它協定的介面）送出一個 universe 的序列資料框：0x7E、label 6、長度、起始碼和通道、0xE7。',
    },
    params: [
      { name: 'data', type: 'ArrayLike<Number>', en: 'Channel values 0–255, at most 512. Fewer than 24 are padded with zeros to 24.', zh: '通道值 0–255，最多 512 個。不到 24 個會補 0 補到 24 個。' },
    ],
    returns: { type: 'Uint8Array', en: 'The frame: 5 bytes before the channels, 1 after.', zh: '整個資料框：通道前面 5 個位元組，後面 1 個。' },
    description: [
      {
        en: 'From ENTTEC\'s "DMX USB Pro – API", message 8, "Output Only Send DMX Packet Request (Label=6)": the data is the start code followed by the channels, 25 to 513 bytes, and its size also sets how many channels the widget sends, so send the same count every time. The length is written low byte first. In Chrome and Edge, Web Serial can write this frame to the interface directly, with no bridge ([`dmxTransport(\'serial\')`](#dmxTransport)); the out-bridge\'s `enttec` sink writes it from Node.',
        zh: '依照 ENTTEC《DMX USB Pro – API》第 8 則訊息「Output Only Send DMX Packet Request (Label=6)」：資料是起始碼加上通道，25 到 513 個位元組，它的長度也決定介面送出幾個通道，所以每次都送一樣多。長度是低位元組在前。在 Chrome 和 Edge 裡，Web Serial 可以直接把這個資料框寫進介面，不用橋接程式（[`dmxTransport(\'serial\')`](#dmxTransport)），輸出橋接程式的 `enttec` 輸出則是從 Node 寫。',
      },
    ],
    tbd: [UNTESTED],
    examples: [
      {
        code: `import { encodeEnttecDmx } from '@openav/dmx';

${HEX}
const f = encodeEnttecDmx([255, 0, 128]);
document.getElementById('app').innerHTML = hex(f.slice(0, 8)) + ' … ' + hex(f.slice(-1)) + '<br>' + f.length + ' bytes';`,
        caption: { en: 'Prints 7e 06 19 00 00 ff 00 80 … e7, then 30 bytes: three channels padded to the API\'s smallest packet of 24.', zh: '印出 7e 06 19 00 00 ff 00 80 … e7，接著 30 bytes：三個通道補到 API 規定最少的 24 個。' },
      },
    ],
    related: ['decodeEnttecDmx', 'Universe'],
    keywords: { en: ['Enttec', 'DMX USB Pro', 'USB', 'serial', 'Web Serial', 'label 6'], zh: ['序列埠', '介面', 'USB'] },
  },

  decodeEnttecDmx: {
    group: 'dmx',
    summary: {
      en: 'Reads an Enttec DMX USB Pro "send DMX" frame (label 6) back into its start code and channels, or returns null for another label or a broken frame.',
      zh: '把 Enttec DMX USB Pro 的「send DMX」資料框（label 6）讀回起始碼和通道，其他 label 或壞掉的資料框回傳 null。',
    },
    params: [
      { name: 'bytes', type: 'ArrayLike<Number>', en: 'One frame, from 0x7E to 0xE7.', zh: '一個資料框，從 0x7E 到 0xE7。' },
    ],
    returns: { type: 'Object | null', en: '`{ startCode, data }`, data the channels.', zh: '`{ startCode, data }`，data 是各通道的值。' },
    description: [
      {
        en: 'For tests and for a simulated interface: it checks both delimiters, the label and that the length fits the frame.',
        zh: '給測試和模擬的介面用：會檢查頭尾兩個分隔字元、label，以及長度跟資料框相符。',
      },
    ],
    examples: [
      {
        code: `import { encodeEnttecDmx, decodeEnttecDmx } from '@openav/dmx';

const d = decodeEnttecDmx(encodeEnttecDmx([9, 8, 7]));
document.getElementById('app').innerHTML = 'start code ' + d.startCode + ', ' + d.data.length + ' channels, first three ' + Array.from(d.data.slice(0, 3)).join(' ');`,
        caption: { en: 'Prints start code 0, 24 channels, first three 9 8 7.', zh: '印出 start code 0、24 個通道、前三個是 9 8 7。' },
      },
    ],
    related: ['encodeEnttecDmx'],
  },

  FIXTURES: {
    group: 'dmx',
    summary: {
      en: 'The generic fixture profiles that ship: dimmer, RGB, RGBW (4 and 6 channels), RGBA, RGBAW+UV, a one-colour strobe and a moving head (8 and 16 channels).',
      zh: '內建的通用燈具 profile：調光器、RGB、RGBW（4 與 6 通道）、RGBA、RGBAW+UV、單色頻閃燈、搖頭燈（8 與 16 通道）。',
    },
    value: { type: 'Object[]', en: 'Seven open-audiovisual/fixture@1 profiles, in this order: generic-dimmer, generic-rgb, generic-rgbw, generic-rgba, generic-rgbaw-uv, generic-strobe, generic-moving-head.', zh: '七份 open-audiovisual/fixture@1 profile，順序是 generic-dimmer、generic-rgb、generic-rgbw、generic-rgba、generic-rgbaw-uv、generic-strobe、generic-moving-head。' },
    description: [
      {
        en: 'None describes one real fixture: each is a common channel order written by hand, MIT, `"verified": false`. Read your light\'s manual; where its order or ranges differ, copy the file (`@openav/dmx/fixtures/generic-rgbw.json`), change it, and pass it to [`Patch`](#Patch) as a profile of your own.',
        zh: '沒有一份對應到某一台真的燈：每一份都是手寫的常見通道順序，MIT 授權，`"verified": false`。請讀你那台燈的說明書，順序或數值範圍不一樣的地方，就複製檔案（`@openav/dmx/fixtures/generic-rgbw.json`）修改，再當成你自己的 profile 交給 [`Patch`](#Patch)。',
      },
      {
        en: 'Their strobe channels say which values are open and which strobe, but not how fast: a generic file cannot know. Under the 3 Hz flash cap the engine therefore keeps them open, and the one-colour strobe works as a plain flood until the cap is raised on purpose.',
        zh: '它們的 strobe 通道寫了哪些值是 open、哪些是 strobe，但沒寫閃多快，通用的檔案不可能知道。所以在每秒 3 次的上限之下，引擎會讓它們停在 open，單色頻閃燈在你刻意調高上限之前，就只是一盞白光泛光燈。',
      },
    ],
    examples: [
      {
        code: `import { FIXTURES } from '@openav/dmx';

document.getElementById('app').innerHTML = FIXTURES.map((f) => f.id + ': ' + f.modes.map((m) => m.id).join(', ') + (f.verified ? '' : ' (not verified)')).join('<br>');`,
        caption: { en: 'Prints the seven profiles with their modes, each marked not verified.', zh: '印出七份 profile 和它們的模式，每一份都標示 not verified。' },
      },
    ],
    related: ['fixtureById', 'validateFixture', 'Patch'],
    keywords: { en: ['fixture library', 'generic', 'par', 'moving head', 'strobe', 'dimmer'], zh: ['燈具', '搖頭燈', '頻閃', '調光'] },
  },

  FlashGuard: {
    group: 'dmx',
    summary: {
      en: 'Holds each fixture of a patch to at most maxFlashHz flashes in any second, frame by frame, from the bytes it would emit: the guard every dmxTransport() applies.',
      zh: '一格一格地看每台燈實際要發出的光，讓 patch 裡的每台燈在任何一秒內最多閃 maxFlashHz 次：每個 dmxTransport() 用的就是這道保護。',
    },
    params: [
      { name: 'patch', type: 'Patch', en: 'The [`Patch`](#Patch) whose fixtures to read and hold. Fixtures added later are guarded too.', zh: '要讀、要管的那個 [`Patch`](#Patch)。之後才加進去的燈也會被管。' },
      { name: 'maxFlashHz', type: 'Number', optional: true, default: '3', en: 'Flashes a fixture may make in any second. A number that is not whole allows its whole part (2.5: 2 in any second); under 1, one in every 1 / maxFlashHz seconds; `Infinity`, no limit.', zh: '一台燈在任何一秒內最多可以閃幾次。不是整數的話取整數部分（2.5：任何一秒 2 次），小於 1 就是每 1 / maxFlashHz 秒一次，`Infinity` 就是不限制。' },
    ],
    description: [
      {
        en: '`apply(universes, t)` takes what [`render()`](#DmxEngine) returns (or a Map, `{ id: bytes }`, `[[id, bytes]]`) and the time in seconds, and returns `[[universe, bytes]]` to send. Call it once per frame, in time order, on a clock that runs at real speed (wall time, never a timeline that can be scrubbed). It keeps a memory of when each light last turned and rose, which is why it is not inside the engine: the engine stays a pure function of time.',
        zh: '`apply(universes, t)` 接收 [`render()`](#DmxEngine) 的結果（或 Map、`{ id: bytes }`、`[[id, bytes]]`）和以秒為單位的時間，回傳要送出的 `[[universe, bytes]]`。每一格呼叫一次，照時間順序，用照真實速度走的時鐘（真實時間，不能是會被拉來拉去的時間軸）。它記得每台燈上一次在哪裡轉折、什麼時候變亮，所以它不在引擎裡面：引擎要保持只取決於時間。',
      },
      {
        en: 'A fixture\'s brightness is its intensity (the average of its intensity channels, 1 with none) times its brightest colour channel (1 with none; CMY flags as the light that passes them), read the way the fixture reads the bytes, 16 bits where the mode has the fine byte. A flash is a pair of opposing changes of 10% of full scale or more (WCAG 2.3.1), measured from the last turning point, so a slow wave counts once it has moved that far. Only rises are rationed: the fixture whose next rise would be one too many stays at the level it last had, steady, until the second has room. Falls always pass, so a blackout is never held back and nothing is ever sent brighter than asked.',
        zh: '一台燈的亮度是它的調光（調光通道的平均，沒有調光通道就是 1）乘上最亮的顏色通道（沒有顏色通道就是 1，CMY 顏色片就看透過來的光），讀法跟燈具讀位元組一樣，模式有細調位元組的就用 16 位元。一次閃是亮度往相反方向變化兩次，每次至少滿刻度的 10%（WCAG 2.3.1），從上一個轉折點量起，所以慢慢變的波形移動到這麼多時也算。只有變亮有限額：下一次變亮會超過的燈穩穩停在上一次送出的亮度，等這一秒有空位。變暗永遠直接通過，所以 blackout 從不會被擋，送出的光也從不會比要求的亮。',
      },
      {
        en: 'What it changes: only a held fixture, and only its intensity bytes (coarse and fine), scaled down; a fixture with no intensity channel has its colour bytes scaled together, so the hue stays. Pan, tilt, zoom, gobo, strobe and control channels, channels no fixture owns, and every fixture not held come back as the very same arrays. `held` lists the fixtures held in the last `apply()`; `status(t)` is `{ on, unit: \'fixture\', maxFlashHz, held, rises }`; `reset()` forgets every light.',
        zh: '它會改的：只有被壓住的燈，而且只有它的調光位元組（粗調和細調）等比例調低，沒有調光通道的燈就把顏色位元組一起調低，色相不變。pan、tilt、zoom、gobo、strobe、control 通道、不屬於任何燈的通道，以及沒被壓住的每台燈，回傳的都是原本那個陣列。`held` 列出上一次 `apply()` 壓住的燈，`status(t)` 是 `{ on, unit: \'fixture\', maxFlashHz, held, rises }`，`reset()` 忘掉每台燈的紀錄。',
      },
    ],
    members: {
      apply: { en: '`apply(universes, t)`: the bytes to send at `t` seconds, as `[[universe, bytes]]`.', zh: '`apply(universes, t)`：`t` 秒時要送出的位元組，以 `[[universe, bytes]]` 回傳。' },
      held: { en: 'The fixture ids held back in the last `apply()`.', zh: '上一次 `apply()` 壓住的燈的 id。' },
      status: { en: '`status(t)`: `{ on: true, unit: \'fixture\', maxFlashHz, held, rises: { id: rises in the second up to t } }`.', zh: '`status(t)`：`{ on: true, unit: \'fixture\', maxFlashHz, held, rises: { id: 到 t 為止這一秒內變亮的次數 } }`。' },
      reset: { en: '`reset()`: forget every light\'s history.', zh: '`reset()`：忘掉每台燈的紀錄。' },
      maxFlashHz: { en: 'The cap it was made with.', zh: '建立時給的上限。' },
    },
    notes: [
      {
        en: 'Neither this guard nor the engine\'s cap sees many fixtures flashing together (it counts each light on its own: twenty pars at 3 Hz out of step are a room flashing much faster), a picture on a projector or screen, or a colour that alternates at the same brightness (saturated red against blue). Fast pan and tilt are not a flash and are not held.',
        zh: '這道保護和引擎的上限都看不到很多台燈一起閃（它一台一台地算，二十台 par 各自 3 Hz、彼此錯開，整個場地就閃得快很多）、投影或螢幕上的畫面，以及亮度不變、只有顏色來回換（飽和的紅和藍交替）。pan、tilt 快速移動不算閃，也不會被壓住。',
      },
    ],
    tbd: [
      {
        en: 'Not yet watched on a real light: how a fixture answers a held intensity byte (its own dimmer curve, its fade time) is not known here.',
        zh: '還沒有在真的燈上看過：燈具拿到被壓住的調光位元組會怎麼反應（它自己的調光曲線、淡入淡出時間），這裡還不知道。',
      },
    ],
    examples: [
      {
        code: `import { Patch, DmxEngine, FlashGuard } from '@openav/dmx';

const patch = new Patch();
patch.add({ id: 'par1', profile: 'generic-rgbw', mode: '6ch', address: 1 });
patch.add({ id: 'head', profile: 'generic-moving-head', mode: '16ch', address: 7 });
const engine = new DmxEngine(patch);
const guard = new FlashGuard(patch);
const rows = [];
for (let f = 0; f < 12; f++) {
  const t = f / 40, on = f % 2 === 0;                            // a 20 Hz flicker on both, the head also turning
  engine.set('par1', { dimmer: on ? 1 : 0, color: [1, 0.4, 0] });
  engine.set('head', { dimmer: on ? 1 : 0, color: [0, 0, 1], pan: f / 12 });
  const [[, bytes]] = guard.apply(engine.render(t), t);
  rows.push(t.toFixed(3) + ' s: par1 dimmer ' + bytes[0] + ', head pan ' + bytes[6] + ', head dimmer ' + bytes[11] + (guard.held.length ? '  held: ' + guard.held.join(', ') : ''));
}
document.getElementById('app').innerHTML = rows.join('<br>');`,
        caption: { en: 'Twelve frames of a 20 Hz flicker: both lights go full on and off three times, then stay dark (listed as held on each frame that asked for light), while the head\'s pan byte climbs every frame as it was asked to.', zh: '一個 20 Hz 閃爍的十二格：兩台燈全亮又全暗三次，之後一直暗著（每一格要求亮的時候都被列為壓住），搖頭燈的 pan 位元組照要求每一格往上爬。' },
      },
    ],
    related: ['dmxTransport', 'DmxEngine', 'mountDmxMonitor', 'Patch'],
    keywords: { en: ['flash', 'strobe', 'epilepsy', 'photosensitive', 'WCAG', 'safety', 'seizure', 'limit'], zh: ['頻閃', '閃爍', '癲癇', '光敏', '安全', '上限'] },
  },

  dmxTransport: {
    group: 'dmx',
    summary: {
      en: 'Where rendered DMX goes each frame, through a flash guard (3 flashes a second per fixture): \'sim\' (memory), \'bridge\' (the out-bridge) or \'serial\' (an Enttec Pro).',
      zh: '每一格算好的 DMX 要送去哪裡：\'sim\'（只留在記憶體）、\'bridge\'（經 OutClient 交給輸出橋接程式，再出 Art-Net、sACN 或 Enttec），或 \'serial\'（用 Web Serial 直送 Enttec Pro），途中經過頻閃保護，每台燈每秒最多閃 3 次。',
    },
    params: [
      { name: 'kind', type: 'String', optional: true, default: "'sim'", en: '`\'sim\'`, `\'bridge\'` or `\'serial\'`.', zh: '`\'sim\'`、`\'bridge\'` 或 `\'serial\'`。' },
      { name: 'options', type: 'Object', optional: true, default: '{}', en: 'Every kind: `{ patch, flashGuard = true, maxFlashHz = 3, now }`. `patch`: the [`Patch`](#Patch) the universes come from, so the guard reads each fixture\'s light (without it, each channel on its own). `flashGuard: false` switches the guard off, and nothing else does. `maxFlashHz`: the guard\'s cap. `now`: a function returning milliseconds, the guard\'s clock (wall time by default; tests hand in their own). bridge, also: `{ client }`, an [`OutClient`](#OutClient) (or `lab.out`), connected or simulating. serial, also: `{ universe = 1, baudRate = 57600, filters, serial }` (`filters` as `navigator.serial.requestPort()` takes them; `serial` to hand in another `navigator.serial`).', zh: '每一種都可以給：`{ patch, flashGuard = true, maxFlashHz = 3, now }`。`patch` 是這些 universe 從哪個 [`Patch`](#Patch) 算出來的，保護才讀得到每台燈的光（沒給的話，一個通道一個通道地看）。`flashGuard: false` 會關掉保護，除此之外沒有別的方法。`maxFlashHz` 是保護的上限。`now` 是回傳毫秒的函式，也就是保護用的時鐘（預設是真實時間，測試會給自己的）。bridge 另外要：`{ client }`，一個 [`OutClient`](#OutClient)（或 `lab.out`），連線中或模擬中都可以。serial 另外可以給：`{ universe = 1, baudRate = 57600, filters, serial }`（`filters` 的寫法跟 `navigator.serial.requestPort()` 一樣，`serial` 可以換成別的 `navigator.serial`）。' },
    ],
    returns: { type: 'Object', en: 'A transport: `send(universes)` (how many channels changed and left), `bytes(id)` (what it last delivered, after the guard), `universes`, `status` and `onStatus(fn)`, `flashGuard` (`{ on, unit: \'fixture\' | \'channel\' | null, maxFlashHz, held }`, `held` being what the guard held back in the last frame), `kind`, `sent`, `frames`, `close()`. A sim one also has `changed`; a serial one `connect()`, `supported` and `error`.', zh: '一個傳送端：`send(universes)`（回傳有幾個通道改變並送出）、`bytes(id)`（它最後送出的內容，經過保護之後的）、`universes`、`status` 和 `onStatus(fn)`、`flashGuard`（`{ on, unit: \'fixture\' | \'channel\' | null, maxFlashHz, held }`，`held` 是上一格被保護壓住的東西）、`kind`、`sent`、`frames`、`close()`。sim 另外有 `changed`，serial 另外有 `connect()`、`supported` 和 `error`。' },
    description: [
      {
        en: 'Call `send(engine.render(t))` every frame. Each transport keeps a copy of what it delivered and sends only the difference. `sim` records it: `changed` lists the channels of the last send, `bytes(1)` is universe 1. `bridge` calls `client.set(\'dmx/<universe>/<address>\', byte / 255)` once per changed channel, and the bridge\'s `artnet`, `sacn` or `enttec` sink turns them back into bytes, 40 frames a second while they change and once a second while they do not. A universe is the number you patched on: `dmx/1/…` leaves as Art-Net Port-Address 1 and as sACN universe 1.',
        zh: '每一格呼叫 `send(engine.render(t))`。每種傳送端都會留一份它送出過的內容，只送有變的部分。`sim` 把它記下來：`changed` 列出上一次送出改變的通道，`bytes(1)` 就是 universe 1。`bridge` 對每個有變的通道呼叫一次 `client.set(\'dmx/<universe>/<address>\', byte / 255)`，橋接程式的 `artnet`、`sacn` 或 `enttec` 輸出再把它們換回位元組，有變化時每秒 40 格，沒變時每秒補送一次。universe 就是你 patch 時用的號碼：`dmx/1/…` 送出去是 Art-Net 的 Port-Address 1，也是 sACN 的 universe 1。',
      },
      {
        en: '`serial` writes Enttec DMX USB Pro frames (label 6, all 512 channels of one universe) straight from the page, with no bridge: at most one every 25 ms, only when something changed (and once a second otherwise), and when a frame is still on its way the newest one goes next. `connect()` asks the browser which port, so it must be called from a click, and nothing calls it for you. Without Web Serial (Chrome or Edge on a computer, on https or localhost) the status is `\'unsupported\'` and `connect()` rejects with the reason.',
        zh: '`serial` 直接從頁面寫出 Enttec DMX USB Pro 的資料框（label 6，一個 universe 的全部 512 個通道），不用橋接程式：最多每 25 毫秒一格，只有內容改變時才送（沒變就每秒補送一次），前一格還在送的時候，接下來送的是最新的那一格。`connect()` 會請瀏覽器問你要用哪個連接埠，所以必須在點擊裡呼叫，也不會有人替你呼叫。瀏覽器沒有 Web Serial（要電腦上的 Chrome 或 Edge，網址是 https 或 localhost）時，狀態是 `\'unsupported\'`，`connect()` 會帶著原因失敗。',
      },
      {
        en: 'Every frame goes through a flash guard first, on every kind (a [`FlashGuard`](#FlashGuard) when you give `{ patch }`). It reads each fixture\'s brightness from the bytes (intensity times its brightest colour channel) and counts a flash as WCAG 2.3.1 does, a pair of opposing changes of 10% of full scale or more. No fixture may brighten that much more than `maxFlashHz` times in any second: the next rise waits, the light staying where it was, until the second has room. Falls always pass, so blackout lands at once. Only a held fixture\'s intensity changes; pan, tilt and every other channel, and every fixture not held, leave exactly as they came. This catches what the engine cannot: a microphone or a kick drum on a dimmer, two engines, any live value. Without `patch` it can only hold each channel on its own (`flashGuard.unit` is `\'channel\'`), which also holds the fine byte of a moving head\'s pan during a smooth move. With `{ flashGuard: false }` there is no guard, and [`mountDmxMonitor()`](#mountDmxMonitor) shows FLASH GUARD OFF for as long as it is off.',
        zh: '每一格都先經過頻閃保護，每一種傳送端都一樣（給了 `{ patch }` 就是一個 [`FlashGuard`](#FlashGuard)）。它從位元組讀出每台燈的亮度（調光乘上最亮的顏色通道），照 WCAG 2.3.1 的方式算一次閃：亮度往相反方向變化兩次，每次至少滿刻度的 10%。任何一秒內，一台燈變亮這麼多的次數不能超過 `maxFlashHz` 次：下一次變亮要等，燈停在原處，直到這一秒有空位。變暗永遠直接通過，所以 blackout 立刻就到。只有被壓住的燈的調光會變，pan、tilt 和其他每一個通道，以及沒被壓住的每台燈，都原封不動送出。引擎擋不到的它都擋得住：麥克風或大鼓推 dimmer、兩個引擎、任何即時值。沒有 `patch` 時，它只能一個通道一個通道地看（`flashGuard.unit` 是 `\'channel\'`），平順移動中的搖頭燈 pan 細調位元組也會被壓住。給 `{ flashGuard: false }` 就沒有保護，關掉的這段時間 [`mountDmxMonitor()`](#mountDmxMonitor) 會一直顯示 FLASH GUARD OFF。',
      },
      {
        en: 'When the page goes away the two differ. Through the bridge, a page that stops talking gets its channels put on the bridge\'s `safe` values (a channel set to `"hold"` stays put). An Enttec Pro on Web Serial keeps repeating the last frame on its own: to leave the rig dark, set `engine.blackout = true`, `send()` once more, then `close()`, which lets the newest frame leave before it lets go of the port. An Enttec Open DMX or a bare FTDI cable (the computer has to time the DMX break itself) is not supported.',
        zh: '頁面離開時兩者不一樣。走橋接程式時，頁面一停止說話，它的通道就會被放到橋接程式設定的 `safe` 值（設成 `"hold"` 的通道停在原處）。用 Web Serial 接的 Enttec Pro 會自己一直重送最後一格：要讓燈暗下來，先設 `engine.blackout = true`，再 `send()` 一次，然後 `close()`，它會等最新的那一格送出去，才放開連接埠。Enttec Open DMX 或沒有處理器的 FTDI 線（電腦得自己掌握 DMX break 的時序）不支援。',
      },
    ],
    needs: {
      en: 'Nothing for `sim`. `bridge`: the out-bridge running with a `dmx/*` rule (`node packages/out/bridge/out-bridge.mjs --config out.json`). `serial`: Chrome or Edge, a click, and the interface plugged in.',
      zh: '`sim` 什麼都不用。`bridge`：輸出橋接程式要開著，並且有一條 `dmx/*` 的規則（`node packages/out/bridge/out-bridge.mjs --config out.json`）。`serial`：Chrome 或 Edge、一次點擊，以及插好的介面。',
    },
    tbd: [
      {
        en: 'Not tried with a real Enttec DMX USB Pro or a real Art-Net or sACN receiver: the frames follow the published layouts, and the tests send them through the bridge to a loopback receiver and to a stand-in serial port. Whether the Pro cares about the baud rate over Web Serial (57600 here; its USB chip should ignore it) is not confirmed.',
        zh: '還沒有用真的 Enttec DMX USB Pro，或真的 Art-Net、sACN 接收端試過：資料框照公開的格式寫，測試裡經過橋接程式送到本機的接收端，以及一個代替的序列埠。Web Serial 的鮑率對 Pro 有沒有影響（這裡用 57600，它的 USB 晶片應該不理會）還沒確認。',
      },
    ],
    examples: [
      {
        code: `import { Patch, DmxEngine, dmxTransport } from '@openav/dmx';

const patch = new Patch();
patch.add({ id: 'par1', profile: 'generic-rgbw', mode: '6ch', address: 1 });
const engine = new DmxEngine(patch);
engine.set('par1', { dimmer: 1, color: [1, 0.5, 0] });
const out = dmxTransport('sim', { patch });
const first = out.send(engine.render(0));
const again = out.send(engine.render(0));
engine.master = 0.5;
const half = out.send(engine.render(0));
document.getElementById('app').innerHTML = [
  'first frame: ' + first + ' channels changed',
  'the same frame again: ' + again,
  'master at half: ' + half + ' ' + JSON.stringify(out.changed),
  'universe 1, addresses 1–6: ' + Array.from(out.bytes(1).slice(0, 6)).join(' '),
].join('<br>');`,
        caption: { en: 'Prints 3 channels for the first frame (dimmer, red, green), 0 for the same frame again, then 1 when the master halves (address 1 to 128), then 128 255 128 0 0 0.', zh: '印出第一格改了 3 個通道（dimmer、紅、綠），同一格再送一次是 0，總控減半時只有 1 個（位址 1 變成 128），最後是 128 255 128 0 0 0。' },
      },
      {
        code: `import { Patch, DmxEngine, dmxTransport } from '@openav/dmx';

const patch = new Patch();
patch.add({ id: 'par1', profile: 'generic-rgbw', mode: '6ch', address: 1 });
const engine = new DmxEngine(patch);
let ms = 0;
const out = dmxTransport('sim', { patch, now: () => ms });       // a clock of our own: one second of frames at once
let asked = 0, sent = 0, was = 0, wasAsked = 0;
for (let f = 0; f < 40; f++) {
  ms = f * 25;                                                    // 40 frames a second
  const on = Math.floor(f / 2) % 2 === 0;                         // a 10 Hz square, as a live value
  engine.set('par1', { dimmer: on ? 1 : 0, color: [1, 1, 1] });
  out.send(engine.render(ms / 1000));
  const d = out.bytes(1)[0];
  if (on && !wasAsked) asked++;
  if (d > 127 && was <= 127) sent++;
  was = d; wasAsked = on;
}
document.getElementById('app').innerHTML = 'asked for ' + asked + ' flashes in one second, sent ' + sent + ' · guard: ' + JSON.stringify(out.flashGuard);`,
        caption: { en: 'Prints asked for 10 flashes in one second, sent 3, and the guard\'s status: on, per fixture, 3 Hz, nothing held in the last frame (it was a dark one), 3 rises of par1 in the last second.', zh: '印出這一秒要求閃 10 次、送出 3 次，以及保護的狀態：開著、以每台燈算、3 Hz，上一格沒有東西被壓住（那一格是暗的），par1 在最後一秒內變亮 3 次。' },
      },
      {
        code: `import { Patch, DmxEngine, dmxTransport } from '@openav/dmx';
import { OutClient } from '@openav/out';

const patch = new Patch();
patch.add({ id: 'par1', profile: 'generic-rgbw', mode: '6ch', address: 1 });
const engine = new DmxEngine(patch);
engine.scene('blue', { par1: { dimmer: 1, color: [0.2, 0.4, 1] } }).base('blue');
engine.effect('breathe', { target: 'par1', wave: 'sine', rate: 0.5 });
const client = new OutClient({ id: 'my-lights' }).connect();      // ws://127.0.0.1:6450/out
const out = dmxTransport('bridge', { patch, client });
function frame(ms) {
  out.send(engine.render(ms / 1000));                             // only the channels that changed leave
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);`,
        caption: { en: 'With the out-bridge running and a `dmx/*` rule to an Art-Net node, par 1 breathes in blue; close the tab and the bridge puts its channels on their safe values.', zh: '輸出橋接程式開著、有一條 `dmx/*` 規則接到 Art-Net 節點時，par 1 用藍色呼吸。關掉分頁，橋接程式就把它的通道放回安全值。' },
        run: 'static',
        why: 'It needs the out-bridge running on 127.0.0.1:6450 (a Node program) and a lighting node to receive what it sends.',
      },
      {
        code: `import { Patch, DmxEngine, dmxTransport } from '@openav/dmx';

const patch = new Patch();
patch.add({ id: 'par1', profile: 'generic-rgbw', mode: '6ch', address: 1 });
const engine = new DmxEngine(patch);
engine.scene('amber', { par1: { dimmer: 1, color: [1, 0.5, 0] } }).base('amber');
const out = dmxTransport('serial', { patch, universe: 1 });
const button = document.createElement('button');
button.textContent = out.supported ? 'Connect an Enttec DMX USB Pro' : 'No Web Serial in this browser';
button.disabled = !out.supported;
button.onclick = () => out.connect().catch((e) => { button.textContent = e.message; });   // the browser asks which port
document.getElementById('app').append(button);
function frame(ms) { out.send(engine.render(ms / 1000)); requestAnimationFrame(frame); }
requestAnimationFrame(frame);`,
        caption: { en: 'A button: click it, pick the interface in the browser\'s list, and par 1 on its DMX line turns amber. In a browser without Web Serial the button says so.', zh: '一個按鈕：按下去，在瀏覽器的清單裡選介面，接在它 DMX 線上的 par 1 就亮成琥珀色。瀏覽器沒有 Web Serial 時，按鈕會直接說。' },
        run: 'static',
        why: 'Web Serial needs a person\'s click and a real interface; the browser that runs these examples is never given serial permission.',
      },
    ],
    related: ['DmxEngine', 'FlashGuard', 'mountDmxMonitor', 'OutClient', 'out-startBridge', 'encodeEnttecDmx'],
    keywords: { en: ['transport', 'send', 'Art-Net', 'sACN', 'Enttec', 'DMX USB Pro', 'Web Serial', 'out-bridge', 'simulate', 'flash guard', 'epilepsy', 'photosensitive'], zh: ['傳送', '輸出', '序列埠', '模擬', '橋接', '頻閃保護', '癲癇'] },
  },

  dmxParams: {
    group: 'dmx',
    summary: {
      en: 'Turns a DmxEngine\'s control points into params (master, blackout, group dimmer, hue, saturation, effect rate and depth, chase run) for MIDI, the timeline and the mic.',
      zh: '把 DmxEngine 的控制點變成參數（總控、blackout、每個群組的 dimmer、色相、飽和度、每個 effect 的速度與深度、每個 chase 的開關），再把參數的值交給引擎。',
    },
    params: [
      { name: 'engine', type: 'DmxEngine', en: 'The [`DmxEngine`](#DmxEngine). Define its effects and chases first: the defaults are read from it.', zh: '那個 [`DmxEngine`](#DmxEngine)。先定義好 effect 和 chase：預設值是從它讀的。' },
      { name: 'prefix', type: 'String', optional: true, default: "'dmx'", en: 'The first part of every key (letters, digits, `-`, `_`).', zh: '每個鍵名的開頭（英文字母、數字、`-`、`_`）。' },
      { name: 'groups', type: 'String[] | Object', optional: true, en: 'Group (or fixture) names, or `{ group: { hue, saturation, dimmer } }` with the values to start from.', zh: '群組（或燈）的名稱，或 `{ group: { hue, saturation, dimmer } }`，順便給起始值。' },
      { name: 'effects', type: 'String[] | Object', optional: true, en: 'Effect names, or `{ effect: { max } }`: the highest rate its param reaches (4 by default, or twice the rate).', zh: 'effect 的名稱，或 `{ effect: { max } }`：它的速度參數最高到多少（預設 4，或目前速度的兩倍）。' },
      { name: 'chases', type: 'String[]', optional: true, en: 'Chase names.', zh: 'chase 的名稱。' },
      { name: 'group', type: 'String', optional: true, default: "'lights'", en: 'The params\' `group`: the console and the phone surface group them by it.', zh: '參數的 `group`：控台和手機控制面板依它分組。' },
    ],
    returns: { type: 'Object', en: '`{ params, apply(state, t, { beat, bpm }), scene, keys }`: the declarations for a world\'s `params`, the function its `update()` calls, the name of the colour scene it keeps, and every key by what it drives.', zh: '`{ params, apply(state, t, { beat, bpm }), scene, keys }`：放進 world 的 `params` 的宣告、它的 `update()` 要呼叫的函式、它管理的顏色 scene 的名稱，以及每個鍵各自推的是什麼。' },
    description: [
      {
        en: 'The framework\'s first rule: continuous control goes through params. The engine never reads a signal; this gives it params, so whatever drives a param drives the lights: a fader in the console, a MIDI knob through the mapper (`{ source: \'midi/cc/7\', target: \'dmx/master\' }`), the timeline\'s automation, the microphone (`audio/rms` to `dmx/pars/dimmer`), a phone. Spread `params` into a world\'s own and call `apply(state, t)` in its `update()`: it hands over only what changed.',
        zh: '框架的第一條規則：連續的控制走參數。引擎自己從來不讀訊號，這支函式替它開出參數，所以任何能推參數的東西都能推燈：控台的推桿、經過 mapping 的 MIDI 旋鈕（`{ source: \'midi/cc/7\', target: \'dmx/master\' }`）、時間軸的自動化、麥克風（`audio/rms` 接到 `dmx/pars/dimmer`）、手機。把 `params` 展開放進 world 自己的參數裡，在它的 `update()` 呼叫 `apply(state, t)`：它只交出有變的部分。',
      },
      {
        en: 'The keys: `dmx/master` (`engine.master`); `dmx/blackout` (a step param, 0 or 1); `dmx/<group>/dimmer`, a submaster ([`engine.submaster()`](#DmxEngine)) that scales what every layer made, so cues, chases and effects keep running under it; `dmx/<group>/hue` and `/saturation`, the group\'s colour, kept in a base scene of its own (`rig.scene`) under cues, chases and effects, so a rainbow effect mixes over it; `dmx/<effect>/rate` and `/depth`, through `engine.tune()`, so a knob that changes the speed never makes the wave jump; `dmx/<chase>/run`. A group gets hue and saturation only when its fixtures have colour channels.',
        zh: '鍵名：`dmx/master`（`engine.master`）。`dmx/blackout`（階梯參數，0 或 1）。`dmx/<group>/dimmer`，一支群組推桿（[`engine.submaster()`](#DmxEngine)），把每一層算出的結果等比例調暗，所以底下的 cue、chase、effect 照樣在跑。`dmx/<group>/hue` 和 `/saturation`，群組的顏色，放在它自己的一個基礎 scene（`rig.scene`）裡，墊在 cue、chase、effect 底下，所以 rainbow effect 會混在它上面。`dmx/<effect>/rate` 和 `/depth`，經過 `engine.tune()`，所以轉旋鈕改速度，波形不會跳。`dmx/<chase>/run`。群組裡的燈有顏色通道，才會有色相和飽和度。',
      },
      {
        en: 'The defaults are what the engine says when you call it: the master, each effect\'s rate and depth, whether a chase runs. Declaring them changes nothing until something moves one, except a group\'s colour, which starts at the `hue` and `saturation` you pass (a warm amber by default). An unknown effect, chase or group throws. `t` is the time you render with: a new rate takes over from there.',
        zh: '預設值是呼叫當下引擎的狀態：總控、每個 effect 的速度和深度、chase 有沒有在跑。宣告這些參數不會改變任何東西，直到有人動了其中一個，只有群組的顏色例外，它從你給的 `hue` 和 `saturation` 開始（預設是溫暖的琥珀色）。不存在的 effect、chase 或群組會丟出錯誤。`t` 是你算燈用的時間：新的速度從那一刻接手。',
      },
    ],
    notes: [
      {
        en: 'The flash cap (3 Hz by default) holds effects, chases and strobe channels. A value that reaches a param from the microphone or a kick drum is a live value and goes through as it comes: give its route a `smooth` (0.1 s or more), keep what drives it at or under three flashes a second, or let the sound step something the cap does hold.',
        zh: '閃爍上限（預設 3 Hz）管的是 effect、chase 和 strobe 通道。從麥克風或大鼓經參數進來的值是即時值，照原樣送出：替它的路線加上 `smooth`（0.1 秒以上），讓推動它的東西維持在每秒閃三次以內，或讓聲音去推一個受上限管的東西。',
      },
    ],
    examples: [
      {
        code: `import { Patch, DmxEngine, dmxParams } from '@openav/dmx';

const patch = new Patch();
patch.add({ id: 'par1', profile: 'generic-rgbw', mode: '6ch', address: 1, groups: ['pars'] });
patch.add({ id: 'par2', profile: 'generic-rgbw', mode: '6ch', address: 7, groups: ['pars'] });
const engine = new DmxEngine(patch);
engine.scene('on', { pars: { dimmer: 1 } }).base('on');
engine.effect('breathe', { target: 'pars', wave: 'sine', rate: 0.25, depth: 0.5 });
const rig = dmxParams(engine, { groups: { pars: { hue: 0.6, saturation: 1 } }, effects: ['breathe'] });
const state = Object.fromEntries(rig.params.map((p) => [p.key, p.def]));   // what a world's update() is given
const bytes = () => Array.from(engine.render(2).bytes(1).slice(0, 6)).join(' ');
rig.apply(state, 2);
const lines = ['keys: ' + rig.params.map((p) => p.key).join(', '), 'defaults: ' + bytes()];
rig.apply({ ...state, 'dmx/pars/dimmer': 0.5, 'dmx/pars/hue': 0 }, 2);
lines.push('pars dimmer 0.5, hue 0: ' + bytes());
document.getElementById('app').innerHTML = lines.join('<br>');`,
        caption: { en: 'Prints the seven keys, par 1\'s bytes with the defaults (255 0 102 255 0 0: full, in blue), then the same moment at half the group dimmer and in red (128 255 0 0 0 0).', zh: '印出七個鍵名、預設值下 par 1 的位元組（255 0 102 255 0 0：全亮、藍色），然後是同一刻群組 dimmer 減半、改成紅色的結果（128 255 0 0 0 0）。' },
      },
      {
        code: `import { createShow } from '@openav/show';
import { Patch, DmxEngine, dmxParams, dmxTransport } from '@openav/dmx';

const patch = new Patch();
for (let i = 0; i < 8; i++) patch.add({ id: 'par' + (i + 1), profile: 'generic-rgbw', mode: '6ch', address: 1 + i * 6, groups: ['pars'] });
const engine = new DmxEngine(patch);
engine.scene('on', { pars: { dimmer: 1 } }).base('on');
const rig = dmxParams(engine, { groups: ['pars'] });
const out = dmxTransport('sim');
let t = 0;
const lights = {
  name: 'lights',
  params: rig.params,
  update(dt, state) { t += dt; rig.apply(state, t); out.send(engine.render(t)); },
  render() {},
};
await createShow({
  world: lights,
  routes: [
    { source: 'audio/rms', target: 'dmx/pars/dimmer', inMax: 0.3, outMin: 0.2, smooth: 0.25 },   // the room's loudness
    { source: 'midi/cc/7', target: 'dmx/master' },                                               // any controller's volume fader
  ],
  modules: { audio: 'mic', keys: false },
});`,
        caption: { en: 'A whole show: the console lists the light params, the pars swell with the room\'s loudness, a controller\'s volume fader is the master, and learn in the mapping panel binds any other knob.', zh: '一整場演出：控台列出燈光參數，八台 par 跟著房間的音量起伏，控制器的音量推桿就是總控，在 mapping 面板按 learn 可以把任何旋鈕接上去。' },
        run: 'static',
        why: 'It builds a whole show page (console, mapping, timeline) and asks for the microphone; example 28 is this, running.',
      },
    ],
    related: ['DmxEngine', 'dmxTransport', 'mountDmxMonitor', 'Mapper'],
    keywords: { en: ['params', 'mapping', 'submaster', 'group fader', 'master', 'blackout', 'hue', 'rate', 'MIDI', 'microphone', 'timeline'], zh: ['參數', '映射', '群組推桿', '總控', '全暗', '色相', '速度', '麥克風', '時間軸'] },
  },

  mountDmxMonitor: {
    group: 'dmx',
    summary: {
      en: 'Puts a DMX monitor on the page: a swatch per fixture (its colour times its dimmer, a moving head\'s pan and tilt as a mark) and a universe\'s 512 channels as a grid.',
      zh: '在頁面上放一個 DMX 監看器：每台 patch 好的燈一個色塊（顏色乘上亮度，搖頭燈的 pan、tilt 畫成一個記號），以及一個 universe 的 512 個通道表。',
    },
    params: [
      { name: 'el', type: 'HTMLElement', en: 'Where it goes (it appends itself). Lay it out as you like.', zh: '要放在哪裡（它會把自己加進去）。版面由你安排。' },
      { name: 'patch', type: 'Patch', en: 'The [`Patch`](#Patch): the fixtures to draw and to name the channels after.', zh: '那個 [`Patch`](#Patch)：要畫的燈，以及通道要用誰的名字標示。' },
      { name: 'transport', type: 'Object', optional: true, default: 'null', en: 'A [`dmxTransport()`](#dmxTransport) result: its kind, status and flash guard show in the header, a serial one gets a Connect button, and `update()` with no argument shows what it delivered.', zh: '一個 [`dmxTransport()`](#dmxTransport) 的結果：它的種類、狀態和頻閃保護顯示在標題列，serial 的會多一個 Connect 按鈕，`update()` 不帶參數時顯示它實際送出的內容。' },
      { name: 'engine', type: 'DmxEngine', optional: true, default: 'null', en: 'The [`DmxEngine`](#DmxEngine): the fixtures its per-fixture flash cap slows get a "slow" mark (hover for by how much).', zh: '那個 [`DmxEngine`](#DmxEngine)：被它每台燈的閃爍上限放慢的燈，會標上「slow」（滑鼠停上去看放慢了多少）。' },
      { name: 'universe', type: 'Number', optional: true, en: 'The universe the grid starts on (the patch\'s first by default).', zh: '通道表一開始顯示哪個 universe（預設是 patch 裡的第一個）。' },
      { name: 'title', type: 'String', optional: true, default: "'DMX'", en: 'The name in the header.', zh: '標題列上的名字。' },
    ],
    returns: { type: 'Object', en: '`{ el, update(universes), select(universe), look(id), dispose() }`: `update()` every frame, with no argument for what the transport delivered or with `engine.render(t)` (it redraws only when a byte or a mark changed); `select()` shows another universe; `look(id)` is what one fixture shows in the bytes it last got (`{ color, mixed, dimmer, pan, tilt, strobe }`); `dispose()` takes it off the page.', zh: '`{ el, update(universes), select(universe), look(id), dispose() }`：每一格呼叫 `update()`，不帶參數就顯示傳送端實際送出的內容，或帶 `engine.render(t)`（只有位元組或標記變了才重畫），`select()` 換到另一個 universe，`look(id)` 是一台燈在它最後拿到的位元組裡的樣子（`{ color, mixed, dimmer, pan, tilt, strobe }`），`dispose()` 把它從頁面上拿掉。' },
    description: [
      {
        en: 'It reads everything back from the bytes, the way a fixture would. A swatch is what its colour channels mix to (red, green, blue, white, amber, UV and the rest; colour flags as their complement) times its dimmer channel; a fixture with no dimmer channel shows its colour bytes as they are. A profile that is one channel off shows the wrong colour here too, so this is how to check a patch with no light in the room. Hover a swatch for its address and values.',
        zh: '它所有東西都從位元組讀回來，跟燈具讀的方式一樣。色塊是它的顏色通道混出來的顏色（紅、綠、藍、白、琥珀、UV 等等，CMY 顏色片就用補色）乘上調光通道，沒有調光通道的燈直接顯示顏色位元組。profile 差一個通道，這裡的顏色也會跟著錯，所以房間裡沒有燈的時候，就靠它檢查 patch。滑鼠停在色塊上，會看到它的位址和數值。',
      },
      {
        en: 'The grid is 32 by 16 cells, address 1 at the top left. Each cell\'s bar is its value (the number is printed when it is not 0), tinted with the colour it drives or its fixture\'s colour, and a yellow edge marks where each fixture starts. Point at a cell to read `universe/address = value` and which fixture and channel it is. With several universes, tabs pick one.',
        zh: '通道表是 32 乘 16 格，位址 1 在左上角。每格的長條是它的值（不是 0 時會印出數字），顏色是它推的那種光或它所屬燈具的顏色，每台燈的第一個通道左邊有一條黃線。滑鼠指著一格，就會讀到 `universe/位址 = 值`，以及它是哪台燈的哪個通道。有好幾個 universe 時，用分頁切換。',
      },
      {
        en: 'Pass the `transport` and the header shows its kind and status (`sim · no hardware`, `out-bridge · open`) and what its flash guard is doing (`flash guard · 3 Hz per fixture`, or `holding par3`, with an amber ring on each fixture held back). A transport made with `{ flashGuard: false }` gets a red FLASH GUARD OFF and a red edge around the whole monitor, for as long as it lives. A serial transport gets a Connect button, the click Web Serial needs. Dark console theme, no dependencies; its styles are added to the page once, as `#oav-dmx-css`. A moving head\'s mark is a top view: its angle is pan across the head\'s whole range, its length is tilt.',
        zh: '傳入 `transport`，標題列就會顯示它的種類和狀態（`sim · no hardware`、`out-bridge · open`），以及它的頻閃保護在做什麼（`flash guard · 3 Hz per fixture`，或 `holding par3`，被壓住的每台燈外面有一圈琥珀色的框）。用 `{ flashGuard: false }` 建立的傳送端，會有紅色的 FLASH GUARD OFF，整個監看器外框也變紅，只要它還在就一直顯示。serial 的傳送端會有一個 Connect 按鈕，就是 Web Serial 需要的那次點擊。深色控台風格、沒有任何相依套件，樣式只會加進頁面一次，叫 `#oav-dmx-css`。搖頭燈的記號是從上往下看：角度是 pan（對應燈的整個轉動範圍），長度是 tilt。',
      },
    ],
    needs: {
      en: 'A page (it builds DOM) and the patch. It shows zeros until the first `update()`.',
      zh: '一個頁面（它會建立 DOM）和 patch。第一次 `update()` 之前，全部顯示 0。',
    },
    examples: [
      {
        code: `import { Patch, DmxEngine, mountDmxMonitor } from '@openav/dmx';

const patch = new Patch();
for (let i = 0; i < 6; i++) patch.add({ id: 'par' + (i + 1), profile: 'generic-rgbw', mode: '6ch', address: 1 + i * 6, groups: ['pars'] });
patch.add({ id: 'head', profile: 'generic-moving-head', mode: '16ch', address: 37 });
const engine = new DmxEngine(patch);
engine.scene('on', { pars: { dimmer: 1 }, head: { dimmer: 1, color: [0.3, 0.5, 1], tilt: 0.6 } }).base('on');
engine.effect('rainbow', { target: 'pars', property: 'color', wave: 'rainbow', rate: 0.2, spread: 1 });
engine.effect('sweep', { target: 'head', property: 'pan', rate: 0.1, depth: 0.8 });
const monitor = mountDmxMonitor(document.getElementById('app'), { patch });
function frame(ms) {
  monitor.update(engine.render(ms / 1000));
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);`,
        caption: { en: 'Six swatches walk through the rainbow, the moving head\'s mark swings from side to side, and the grid\'s first 52 channels move with them.', zh: '六個色塊依序走過彩虹，搖頭燈的記號左右擺動，通道表前 52 格跟著一起動。' },
      },
    ],
    related: ['Patch', 'DmxEngine', 'dmxTransport', 'FlashGuard'],
    keywords: { en: ['monitor', 'visualiser', 'channel grid', 'fixture view', 'swatch', 'no hardware', 'simulate'], zh: ['監看', '通道表', '燈具視圖', '色塊', '沒有硬體', '模擬'] },
  },

  fixtureById: {
    group: 'dmx',
    summary: {
      en: 'A shipped generic fixture profile by its id, or null.',
      zh: '用 id 找一份內建的通用燈具 profile，找不到就是 null。',
    },
    params: [
      { name: 'id', type: 'String', en: 'Such as `\'generic-rgbw\'`.', zh: '例如 `\'generic-rgbw\'`。' },
    ],
    returns: { type: 'Object | null', en: 'The profile as data (the parsed JSON).', zh: 'profile 的資料（解析好的 JSON）。' },
    description: [
      {
        en: '[`Patch.add()`](#Patch) takes the id itself, so this is for reading a profile, or for copying one to change it.',
        zh: '[`Patch.add()`](#Patch) 可以直接吃 id，所以這是用來讀 profile，或複製一份來改的。',
      },
    ],
    examples: [
      {
        code: `import { fixtureById } from '@openav/dmx';

const f = fixtureById('generic-rgbw');
document.getElementById('app').innerHTML = f.name + '<br>' + f.modes.map((m) => m.id + ': ' + m.channels.join(' ')).join('<br>') + '<br>' + fixtureById('nope');`,
        caption: { en: 'Prints RGBW par, its 4ch and 6ch modes with their channels in order, then null for an id that does not exist.', zh: '印出 RGBW par、它 4ch 和 6ch 模式的通道順序，最後是不存在的 id 得到的 null。' },
      },
    ],
    related: ['FIXTURES'],
  },
};
