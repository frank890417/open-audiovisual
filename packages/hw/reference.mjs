// @openav/hw reference: electronics for works that leave the screen. Read by tools/build-reference.mjs (see AGENTS.md,
// "Documenting a public name"). Everything here is pure and runs headless on a small hand-written spec: a Feather HUZZAH
// ESP8266 with an accelerometer on I²C and a ring of 12 LEDs. The report's sentences are written in Chinese: the examples print
// the codes and the numbers, not the sentences.

const BOX = `const spec = {
  board: 'mcu',
  parts: {
    mcu: { part: 'feather-huzzah-esp8266', have: true },
    acc: { part: 'lis3dh-breakout' },
    ring: { part: 'neopixel-ring-12' },
  },
  wires: [
    ['mcu.3V', 'acc.VIN'], ['mcu.GND', 'acc.GND'], ['mcu.SDA', 'acc.SDA'], ['mcu.SCL', 'acc.SCL'],
    ['mcu.USB', 'ring.5V'], ['mcu.GND', 'ring.GND'], ['mcu.2', 'ring.DIN'],
  ],
};`;

export default {
  Hw: {
    group: 'hw',
    summary: {
      en: 'Checks how the electronics of a physical work are wired (logic levels, boot pins, I²C addresses, current, battery hours) and draws the wiring diagram and the parts list.',
      zh: '檢查實體作品裡的電子怎麼接（邏輯電壓、開機腳、I²C 位址、電流、電池撐多久），並畫出接線圖、列出零件清單。',
    },
    description: [
      {
        en: 'A spec says which parts a work uses and how they are wired: `{ board, parts: { id: { part, have? } }, wires: [[\'mcu.4\', \'acc.SDA\'], …] }`. A pin is written `part.pin`, by its name or an alias (`mcu.SDA` is `mcu.4` on a Feather HUZZAH). `part` is a key of the parts library, [`HW_PARTS`](#HW_PARTS). Wires that touch are one net: the board pin and every part on it.',
        zh: '一份規格寫作品用了哪些零件、怎麼接：`{ board, parts: { id: { part, have? } }, wires: [[\'mcu.4\', \'acc.SDA\'], …] }`。腳位寫成 `零件.腳`，用名字或別名都可以（在 Feather HUZZAH 上 `mcu.SDA` 就是 `mcu.4`）。`part` 是零件庫 [`HW_PARTS`](#HW_PARTS) 的鍵。碰在一起的線是同一個網路，板子的腳和接在上面的每個零件都在裡面。',
      },
      {
        en: '`Hw.check(spec)` returns `{ ok, board, nets, power: { rails, battery }, i2c, issues, warnings, notes }`. Each issue is `{ level, code, text, at }`: `error` (it will not work or it breaks something), `warn` (it may not work), `note` (worth knowing) or `unknown` (a datasheet value is missing, so the check cannot tell). It looks for: a 3.3 V signal into a part that needs more (a 5 V LED strip), a voltage above what a pin takes, a supply out of a part\'s range or one that is only there on the charger, ESP8266 boot pins (GPIO0, 2, 15) and the serial pins, one pin wired to two jobs, SDA and SCL swapped, two I²C devices at one address, current beyond a regulator or a wireless receiver, and how many hours the battery lasts. `warnings` is the `error` and `warn` sentences, `notes` the rest.',
        zh: '`Hw.check(spec)` 回傳 `{ ok, board, nets, power: { rails, battery }, i2c, issues, warnings, notes }`。每個問題是 `{ level, code, text, at }`：`error`（不會動或會燒壞東西）、`warn`（可能不會動）、`note`（值得知道）或 `unknown`（規格書少一個數字，判斷不了）。它會找：3.3 V 訊號接到需要更高電壓的零件（5 V 燈條）、超過腳位能吃的電壓、供電超出零件的範圍或只有放在充電座上才有電、ESP8266 的開機腳（GPIO0、2、15）和序列埠腳、一支腳接了兩種用途、SDA 和 SCL 接反、兩個 I²C 裝置同一個位址、電流超過穩壓器或無線充電接收器，以及電池能撐幾小時。`warnings` 是 `error` 和 `warn` 的句子，`notes` 是其他的。',
      },
      {
        en: '`Hw.diagram(spec)` returns an SVG string: the board in the middle, power parts on the left, the rest on the right, power red, ground grey, I²C blue, data green, SPI purple, analog orange, and a wire the check complains about dashed. `Hw.bom(spec)` returns `{ have, buy, unknown, count }`, the parts split by `have: true`, with sizes, connectors and the notes to read before buying. It has no prices and no shop links.',
        zh: '`Hw.diagram(spec)` 回傳一段 SVG 字串：板子在中間，電源零件在左邊，其他在右邊，電源紅色、地線灰色、I²C 藍色、資料綠色、SPI 紫色、類比橘色，檢查有意見的線畫成虛線。`Hw.bom(spec)` 回傳 `{ have, buy, unknown, count }`，依 `have: true` 把零件分開，附尺寸、接頭和買之前要先看的提醒。它沒有價格，也沒有購買連結。',
      },
    ],
    members: {
      check: { en: '`check(spec, { parts }?)`: the report described above. `parts` replaces the library (for tests or your own parts).', zh: '`check(spec, { parts }?)`：上面說的報告。`parts` 可以換掉零件庫（測試或自己的零件用）。' },
      diagram: { en: '`diagram(spec, { report, parts, width }?)`: the wiring diagram as an SVG string. Pass a `report` you already have to skip checking again. Every text from the spec is escaped.', zh: '`diagram(spec, { report, parts, width }?)`：接線圖的 SVG 字串。已經有 `report` 就傳進來，不用再檢查一次。規格裡的文字都會跳脫。' },
      bom: { en: '`bom(spec, { parts }?)`: `{ have, buy, unknown, count }`. A row is `{ id, part, name, zh, qty, kind, size, connector, notes, tbd }`.', zh: '`bom(spec, { parts }?)`：`{ have, buy, unknown, count }`。每一列是 `{ id, part, name, zh, qty, kind, size, connector, notes, tbd }`。' },
      parts: { en: '`parts`: the library, the same object as [`HW_PARTS`](#HW_PARTS).', zh: '`parts`：零件庫，跟 [`HW_PARTS`](#HW_PARTS) 是同一個物件。' },
      part: { en: '`part(key)`: one part of the library, or `null`.', zh: '`part(key)`：零件庫裡的一個零件，沒有就是 `null`。' },
      resolvePin: { en: '`resolvePin(spec, ref)`: `\'mcu.SDA\'` → `{ id, part, pin, def, ref: \'mcu.4\' }`, or `{ why }` saying what is wrong.', zh: '`resolvePin(spec, ref)`：`\'mcu.SDA\'` → `{ id, part, pin, def, ref: \'mcu.4\' }`，或是說明哪裡不對的 `{ why }`。' },
      nets: { en: '`nets(spec)`: the nets alone, `[{ id, kind, v, conditional, i2c, pins, label }]`.', zh: '`nets(spec)`：只有網路，`[{ id, kind, v, conditional, i2c, pins, label }]`。' },
    },
    notes: [
      {
        en: 'The check is as good as the library. A value the datasheets did not settle is `null` and listed in the part\'s `tbd`, and a check that needs it reports `unknown` instead of passing.',
        zh: '檢查只會跟零件庫一樣準。規格書沒有說清楚的值是 `null`，列在零件的 `tbd` 裡，需要它的檢查會回報 `unknown`，不會當作通過。',
      },
    ],
    examples: [
      {
        code: `import { Hw } from '@openav/hw';

${BOX}
const r = Hw.check(spec);
document.getElementById('app').innerHTML = [
  'ok: ' + r.ok,
  'issues: ' + r.issues.map((i) => i.level + ' ' + i.code).join(', '),
  'I²C: ' + r.i2c[0].devices.map((d) => d.id + ' ' + d.addr).join(', '),
].join('<br>');`,
        caption: { en: 'Prints ok: true, then four issues: warn conditional-rail (the ring sits on the USB pin, dark without USB), warn level-low (3.3 V data into the ring at 5 V), unknown limit-tbd (how much the USB pin can give is not in the datasheet) and note boot-pin (GPIO2), then I²C: acc 0x18.', zh: '印出 ok: true，接著四個問題：warn conditional-rail（燈環接在 USB 腳，沒插 USB 就沒電）、warn level-low（3.3 V 資料推 5 V 燈環）、unknown limit-tbd（USB 腳能供多少電流規格書沒寫）和 note boot-pin（GPIO2），最後是 I²C: acc 0x18。' },
      },
      {
        code: `import { Hw } from '@openav/hw';

${BOX}
document.getElementById('app').innerHTML = Hw.diagram(spec);`,
        caption: { en: 'Draws the wiring diagram: the Feather in the middle, the accelerometer and the ring on the right, the data wire to the ring dashed.', zh: '畫出接線圖：Feather 在中間，加速度計和燈環在右邊，接到燈環的資料線是虛線。' },
      },
    ],
  },
  HW_PARTS: {
    group: 'hw',
    summary: {
      en: 'The parts library of @openav/hw: boards, sensors, LEDs and power parts, with pins, voltages, currents, I²C addresses and sizes taken from their datasheets.',
      zh: '@openav/hw 的零件庫：板子、感測器、燈和電源零件，腳位、電壓、電流、I²C 位址和尺寸都取自規格書。',
    },
    description: [
      {
        en: 'An object keyed by part id: `feather-huzzah-esp8266`, `arduino-leonardo`, `arduino-uno-r3`, `rc522`, `pir-hc-sr501`, `pot-10k`, `lis3dh-breakout`, `mpu6050-gy521`, `ws2812b`, `sk6812`, `neopixel-ring-12`, `neopixel-ring-16`, `lipo-1s`, `tp4056-usbc`, `microlipo-usbc` and `qi-receiver`. A part has `name`, `zh`, `kind`, `sources` (the datasheets and maker pages it was read from), `supply`, `logic`, `current` or `perLed`, `pins`, `i2c`, `size`, `connector`, `notes` and `tbd`.',
        zh: '以零件 id 為鍵的物件：`feather-huzzah-esp8266`、`arduino-leonardo`、`arduino-uno-r3`、`rc522`、`pir-hc-sr501`、`pot-10k`、`lis3dh-breakout`、`mpu6050-gy521`、`ws2812b`、`sk6812`、`neopixel-ring-12`、`neopixel-ring-16`、`lipo-1s`、`tp4056-usbc`、`microlipo-usbc` 和 `qi-receiver`。每個零件有 `name`、`zh`、`kind`、`sources`（讀過的規格書和原廠頁面）、`supply`、`logic`、`current` 或 `perLed`、`pins`、`i2c`、`size`、`connector`、`notes` 和 `tbd`。',
      },
      {
        en: 'Where two revisions of a datasheet disagree (the WS2812B input threshold is 0.7 × VDD in one and 2.7 V in the other), the stricter value is used and `notes` says so. A value nobody could confirm is `null` and named in `tbd`.',
        zh: '同一份規格書兩個版本說法不同時（WS2812B 的輸入門檻一版是 0.7 × VDD，另一版是 2.7 V），取比較嚴的，並在 `notes` 寫明。沒有人能確認的值是 `null`，寫在 `tbd` 裡。',
      },
    ],
    examples: [
      {
        code: `import { HW_PARTS } from '@openav/hw';

const f = HW_PARTS['feather-huzzah-esp8266'];
document.getElementById('app').innerHTML = [
  f.name,
  'logic: ' + f.logic.v + ' V, 5 V safe: ' + f.logic.fiveVoltSafe,
  'A0 max: ' + f.pins.A0.vmax + ' V',
  'parts in the library: ' + Object.keys(HW_PARTS).length,
].join('<br>');`,
        caption: { en: 'Prints the Feather HUZZAH: 3.3 V logic, not 5 V safe, A0 up to 1 V, and the number of parts in the library.', zh: '印出 Feather HUZZAH：3.3 V 邏輯、不耐 5 V、A0 最多 1 V，以及零件庫有幾個零件。' },
      },
    ],
  },
};
