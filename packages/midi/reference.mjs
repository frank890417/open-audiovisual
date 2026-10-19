// @openav/midi reference: MIDI messages (bytes, events, signal names), the Midi engine and ports, profiles as data, the controller model,
// virtual Web MIDI, and the faceplate: the playable <oav-controller>, the iframe embed, the view and the canvas drawing.
// Read by tools/build-reference.mjs (see AGENTS.md, "Documenting a public name"). The keys are the export names the code has
// (tools/reference/scan.mjs reads them); a key the code does not have is a red test.
//
// Channels are 1..16 everywhere (what a person reads on the device), data bytes 0..127, pitch bend 14-bit (0..16383, centre 8192).
// Examples never touch real MIDI hardware: where a port is needed they hand the library a small stand-in for navigator.requestMIDIAccess.

export default {
  // ================================================================== messages: bytes, events, signal names

  parseMessage: {
    group: 'midi-io',
    summary: {
      en: 'Turns the bytes of one MIDI message into an event object such as `{ type: \'noteon\', ch: 1, note: 60, vel: 100 }`, or `null` for bytes it does not know.',
      zh: '把一則 MIDI 訊息的位元組轉成事件物件，例如 `{ type: \'noteon\', ch: 1, note: 60, vel: 100 }`，不認得的位元組就回傳 `null`。',
    },
    params: [
      { name: 'data', type: 'Array | Uint8Array', en: 'The bytes of ONE message, the way Web MIDI hands them over (`event.data`): a status byte first, then up to two data bytes.', zh: '「一則」訊息的位元組，格式跟 Web MIDI 給你的一樣（`event.data`）：先是狀態位元組，後面最多兩個資料位元組。' },
    ],
    returns: { type: 'Object | null', en: 'The event, or `null` when the input is empty, starts with a data byte (below 0x80) or is a channel status it has no case for.', zh: '事件物件。輸入是空的、以資料位元組（小於 0x80）開頭，或是它沒處理的頻道狀態時，回傳 `null`。' },
    description: [
      {
        en: '`parseMessage([0x90, 60, 100])` is `{ type: \'noteon\', ch: 1, note: 60, vel: 100 }`. Channels are numbered 1 to 16, the way they are printed on a device (the status byte stores 0 to 15), and data bytes are cut to 0..127. Every other function in this package that handles MIDI speaks these event objects.',
        zh: '`parseMessage([0x90, 60, 100])` 會得到 `{ type: \'noteon\', ch: 1, note: 60, vel: 100 }`。頻道編號是 1 到 16，跟機器上印的一樣（狀態位元組裡存的是 0 到 15），資料位元組會被限制在 0..127。這個套件裡其他處理 MIDI 的函式，講的都是這種事件物件。',
      },
      {
        en: 'The `type` is `noteon` and `noteoff` (`note`, `vel`), `polyat` (polyphonic aftertouch: `note`, `value`), `cc` (`cc`, `value`), `program` (`value`), `chanat` (channel pressure: `value`) or `pitchbend` (`value` 0..16383, centre 8192). System messages come back as `clock`, `start`, `continue`, `stop`, `sysex` (with `data`, the whole message) or `system` (with the `status` byte).',
        zh: '`type` 可能是 `noteon`、`noteoff`（有 `note`、`vel`）、`polyat`（複音觸後：`note`、`value`）、`cc`（`cc`、`value`）、`program`（`value`）、`chanat`（頻道壓力：`value`）、`pitchbend`（`value` 為 0..16383，中心是 8192）。系統訊息則是 `clock`、`start`、`continue`、`stop`、`sysex`（附 `data`，整則訊息）或 `system`（附 `status` 位元組）。',
      },
      {
        en: 'A note-on with velocity 0 comes back as `noteoff`, because that is how many devices say "released". Bytes that start with a data byte give `null`: the browser has already resolved running status before it hands you the message.',
        zh: '力度為 0 的 note-on 會回傳成 `noteoff`，因為很多機器就是這樣表示「放開」。位元組開頭是資料位元組時回傳 `null`：瀏覽器在把訊息交給你之前，已經處理過 running status。',
      },
    ],
    notes: [
      {
        en: 'It is pure: no DOM, no Web MIDI, no state. [`encodeMessage()`](#encodeMessage) is its inverse, and [`describe()`](#describe) turns the result into a line of text.',
        zh: '它是純函式：沒有 DOM、沒有 Web MIDI、沒有狀態。[`encodeMessage()`](#encodeMessage) 是它的反向，[`describe()`](#describe) 則把結果變成一行文字。',
      },
    ],
    examples: [
      {
        code: `import { parseMessage } from '@openav/midi';

console.log(parseMessage([0x90, 60, 100]));   // note on, middle C
console.log(parseMessage([0x90, 60, 0]));     // velocity 0 reads as note off
console.log(parseMessage([0xe0, 0, 64]));     // pitch bend, centre`,
        caption: { en: 'Open the console: three event objects, a `noteon`, a `noteoff` and a `pitchbend` with `value: 8192`.', zh: '打開主控台：印出三個事件物件，分別是 `noteon`、`noteoff`，以及 `value: 8192` 的 `pitchbend`。' },
      },
      {
        code: `import { parseMessage } from '@openav/midi';

// what a Web MIDI port gives you: event.data is a Uint8Array
const ev = parseMessage(Uint8Array.of(0xb0, 74, 100));
if (ev && ev.type === 'cc') {
  console.log('CC', ev.cc, 'on channel', ev.ch, '=', (ev.value / 127).toFixed(2));
}`,
        caption: { en: 'Prints `CC 74 on channel 1 = 0.79`: a control-change value turned into the 0 to 1 range a sketch wants.', zh: '印出 `CC 74 on channel 1 = 0.79`：把控制變更的值換成草圖想要的 0 到 1。' },
      },
    ],
    related: ['encodeMessage', 'describe', 'genericSignals', 'MidiController'],
    keywords: {
      en: ['midi message', 'parse', 'decode', 'bytes', 'status byte', 'note on', 'control change', 'pitch bend', 'event'],
      zh: ['midi 訊息', '解析', '解碼', '位元組', '狀態位元組', '音符開', '控制變更', '彎音輪', '事件'],
    },
  },

  encodeMessage: {
    group: 'midi-io',
    summary: {
      en: 'Turns an event object back into MIDI bytes, the inverse of `parseMessage()`: `{ type: \'cc\', ch: 1, cc: 74, value: 64 }` becomes `[0xb0, 74, 64]`.',
      zh: '把事件物件轉回 MIDI 位元組，是 `parseMessage()` 的反向：`{ type: \'cc\', ch: 1, cc: 74, value: 64 }` 會變成 `[0xb0, 74, 64]`。',
    },
    params: [
      { name: 'ev', type: 'Object', en: 'An event: `type` is `noteon`, `noteoff`, `polyat`, `cc`, `program`, `chanat` or `pitchbend`, with the fields [`parseMessage()`](#parseMessage) uses for that type. `ch` defaults to 1.', zh: '事件物件：`type` 是 `noteon`、`noteoff`、`polyat`、`cc`、`program`、`chanat` 或 `pitchbend`，欄位跟 [`parseMessage()`](#parseMessage) 對該類型用的一樣。`ch` 預設是 1。' },
    ],
    returns: { type: 'number[] | null', en: 'The bytes, ready for `output.send()`. `null` for a type it cannot make (`clock`, `sysex`, anything unknown).', zh: '位元組陣列，可以直接給 `output.send()`。做不出來的類型（`clock`、`sysex`、不認得的）回傳 `null`。' },
    description: [
      {
        en: '`encodeMessage({ type: \'noteon\', ch: 10, note: 36, vel: 127 })` is `[0x99, 36, 127]`. The channel is held to 1..16 and every data byte is rounded and held to 0..127, so a bad value cannot produce an invalid message. A missing `vel` is 100 for `noteon` and 0 for `noteoff`.',
        zh: '`encodeMessage({ type: \'noteon\', ch: 10, note: 36, vel: 127 })` 得到 `[0x99, 36, 127]`。頻道會限制在 1..16，每個資料位元組都會四捨五入並限制在 0..127，所以錯誤的數值做不出不合法的訊息。沒給 `vel` 的話，`noteon` 是 100，`noteoff` 是 0。',
      },
      {
        en: 'A `pitchbend` `value` (0..16383) is split into two 7-bit bytes, low byte first, as MIDI requires. The package uses this for the on-screen controller and for LED feedback.',
        zh: '`pitchbend` 的 `value`（0..16383）會照 MIDI 規定拆成兩個 7 位元的位元組，低位在前。套件用它來做螢幕上的控制器和 LED 回饋。',
      },
    ],
    examples: [
      {
        code: `import { encodeMessage, parseMessage } from '@openav/midi';

const bytes = encodeMessage({ type: 'noteon', ch: 10, note: 36, vel: 127 });
console.log(bytes);                // [153, 36, 127]
console.log(parseMessage(bytes));  // back to the same event`,
        caption: { en: 'Prints `[153, 36, 127]` (0x99, 0x24, 0x7f), then the event it came from.', zh: '印出 `[153, 36, 127]`（0x99、0x24、0x7f），再印出它原本的事件。' },
      },
      {
        code: `import { encodeMessage } from '@openav/midi';

console.log(encodeMessage({ type: 'pitchbend', ch: 1, value: 8192 }));  // centre: [224, 0, 64]
console.log(encodeMessage({ type: 'cc', ch: 1, cc: 74, value: 300 }));  // value held to 127
console.log(encodeMessage({ type: 'clock' }));                          // null`,
        caption: { en: 'Three results: the pitch-bend centre, a value held to 127, and `null` for a message type it cannot make.', zh: '三個結果：彎音輪的中心、被限制在 127 的數值，以及做不出來的訊息類型回傳 `null`。' },
      },
    ],
    related: ['parseMessage', 'describe', 'unitToBend', 'Midi'],
    keywords: {
      en: ['encode', 'midi bytes', 'build message', 'note on bytes', 'send', 'inverse of parse'],
      zh: ['編碼', 'midi 位元組', '組訊息', '送出', 'parse 的反向'],
    },
  },

  describe: {
    group: 'midi-io',
    summary: {
      en: 'Returns a short readable line for a parsed MIDI event, for logs and learn screens: `CC ch1 #74=64`, `Bend ch1 0.50`.',
      zh: '把解析過的 MIDI 事件變成一行好讀的文字，給記錄和學習畫面用：`CC ch1 #74=64`、`Bend ch1 0.50`。',
    },
    params: [
      { name: 'ev', type: 'Object', en: 'An event from [`parseMessage()`](#parseMessage).', zh: '[`parseMessage()`](#parseMessage) 回傳的事件。' },
    ],
    returns: { type: 'String', en: 'The line. `null` gives `?`, and a type without a format (`clock`, `sysex`) gives its type name.', zh: '那一行文字。給 `null` 回傳 `?`，沒有格式的類型（`clock`、`sysex`）則回傳類型名稱。' },
    description: [
      {
        en: 'The formats are `Note On  ch1 n60 v100` (two spaces after "On"), `Note Off ch1 n60`, `CC ch1 #74=64`, `Bend ch1 0.50` (the bend as −1..1 with two decimals), `Pressure ch1 50`, `Poly AT ch1 n60 33` and `Program ch1 5`. The [`Midi`](#Midi) engine writes one of these to its log for each message it parses (clock is left out).',
        zh: '格式是 `Note On  ch1 n60 v100`（On 後面兩個空格）、`Note Off ch1 n60`、`CC ch1 #74=64`、`Bend ch1 0.50`（彎音換成 −1..1，兩位小數）、`Pressure ch1 50`、`Poly AT ch1 n60 33`、`Program ch1 5`。[`Midi`](#Midi) 引擎解析的每則訊息（時鐘除外），都會把這樣的一行寫進它的記錄。',
      },
    ],
    notes: [
      {
        en: 'Easily confused with `describeMessage()` and `describeDetail()`, which write the shorter lines the `<oav-controller>` readout shows (`CC 70 = 53`). This one takes an event and is meant for logs.',
        zh: '容易跟 `describeMessage()`、`describeDetail()` 搞混：那兩個寫的是 `<oav-controller>` 讀數列用的較短文字（`CC 70 = 53`）。這一個吃事件物件，是給記錄用的。',
      },
    ],
    examples: [
      {
        code: `import { parseMessage, describe } from '@openav/midi';

for (const bytes of [[0x90, 60, 100], [0xb0, 74, 64], [0xe0, 0, 96]]) {
  console.log(describe(parseMessage(bytes)));
}`,
        caption: { en: 'Prints `Note On  ch1 n60 v100`, `CC ch1 #74=64` and `Bend ch1 0.50`.', zh: '印出 `Note On  ch1 n60 v100`、`CC ch1 #74=64` 和 `Bend ch1 0.50`。' },
      },
    ],
    related: ['parseMessage', 'describeMessage', 'describeDetail'],
    keywords: {
      en: ['describe', 'log line', 'readable', 'midi monitor', 'text'],
      zh: ['描述', '記錄文字', '好讀', 'midi 監看', '文字'],
    },
  },

  relativeDelta: {
    group: 'midi-io',
    summary: {
      en: 'Turns the CC value an endless encoder sends into signed steps: with `offset64`, 65 is +1, 63 is −1 and 64 is no move.',
      zh: '把無限旋鈕送來的 CC 值轉成有正負號的步數：用 `offset64` 時，65 是 +1，63 是 −1，64 是沒動。',
    },
    params: [
      { name: 'value', type: 'Number', en: 'The CC value, 0..127 (only the low 7 bits are read).', zh: 'CC 的值，0..127（只讀低 7 位元）。' },
      { name: 'mode', type: 'String', en: 'How the device writes a turn: one of [`RELATIVE_MODES`](#RELATIVE_MODES). A profile names it in the control\'s `relative` field.', zh: '機器怎麼表示一次轉動：[`RELATIVE_MODES`](#RELATIVE_MODES) 其中之一。設定檔在控制項的 `relative` 欄位裡寫明。' },
    ],
    returns: { type: 'Number', en: 'The signed step count, positive for clockwise.', zh: '有正負號的步數，順時針為正。' },
    description: [
      {
        en: 'An endless encoder has no position, so it sends how far it moved, and devices disagree on how to write it. `offset64`: 64 is no move, 65 is +1, 63 is −1. `offset16`: 16 is no move, 17 is +1, 15 is −1. `twos`: 1..63 are +1..+63 and 127..65 are −1..−63 (two\'s complement). `signbit`: 1..63 are positive, 65..127 are −1..−63 (sign and magnitude).',
        zh: '無限旋鈕沒有位置，它送出的是「轉了多少」，而各家機器的寫法不一樣。`offset64`：64 是沒動，65 是 +1，63 是 −1。`offset16`：16 是沒動，17 是 +1，15 是 −1。`twos`：1..63 是 +1..+63，127..65 是 −1..−63（二的補數）。`signbit`：1..63 是正的，65..127 是 −1..−63（符號加大小）。',
      },
      {
        en: 'An unknown `mode` throws `unknown relative mode "x"`. [`MidiController`](#MidiController) uses this for every `encoder` control whose profile says `relative`, and publishes the result as `midi/<short>/<id>/delta`.',
        zh: '不認得的 `mode` 會丟出 `unknown relative mode "x"`。[`MidiController`](#MidiController) 對每個設定檔有寫 `relative` 的 `encoder` 控制項都用它，並把結果發佈成 `midi/<short>/<id>/delta`。',
      },
    ],
    examples: [
      {
        code: `import { relativeDelta } from '@openav/midi';

console.log(relativeDelta(65));            // 1  (offset64, the default)
console.log(relativeDelta(63));            // -1
console.log(relativeDelta(127, 'twos'));   // -1
console.log(relativeDelta(67, 'signbit')); // -3`,
        caption: { en: 'Prints 1, −1, −1 and −3: the same kind of turn written four ways.', zh: '印出 1、−1、−1、−3：同一種轉動的四種寫法。' },
      },
    ],
    related: ['relativeValue', 'RELATIVE_MODES', 'MidiController'],
    keywords: {
      en: ['encoder', 'endless', 'relative', 'delta', 'offset64', 'twos complement', 'steps', 'knob'],
      zh: ['編碼器', '無限旋鈕', '相對值', '增量', '步數', '二的補數', '旋鈕'],
    },
  },

  relativeValue: {
    group: 'midi-io',
    summary: {
      en: 'The inverse of `relativeDelta()`: the CC value that says "turned by this many steps" in a given encoder encoding.',
      zh: '`relativeDelta()` 的反向：在指定的旋鈕編碼下，代表「轉了這麼多步」的 CC 值。',
    },
    params: [
      { name: 'delta', type: 'Number', en: 'Signed steps. Rounded and held to −63..63.', zh: '有正負號的步數，會四捨五入並限制在 −63..63。' },
      { name: 'mode', type: 'String', en: 'One of [`RELATIVE_MODES`](#RELATIVE_MODES).', zh: '[`RELATIVE_MODES`](#RELATIVE_MODES) 其中之一。' },
    ],
    returns: { type: 'Number', en: 'The CC value, 0..127.', zh: 'CC 的值，0..127。' },
    description: [
      {
        en: 'A virtual encoder sends the same encoding a hardware one does, so the on-screen controller and the real device look identical to everything downstream. `relativeValue(-1)` is 63 and `relativeValue(3, \'twos\')` is 3. With `offset16` the result is held at 0, so it can only go down to −16.',
        zh: '虛擬的旋鈕送出跟實體旋鈕一樣的編碼，所以螢幕上的控制器和真實機器，在下游看起來完全一樣。`relativeValue(-1)` 是 63，`relativeValue(3, \'twos\')` 是 3。`offset16` 的結果會停在 0，所以最多只能往下到 −16。',
      },
      {
        en: 'An unknown `mode` throws `unknown relative mode "x"`.',
        zh: '不認得的 `mode` 會丟出 `unknown relative mode "x"`。',
      },
    ],
    examples: [
      {
        code: `import { relativeValue, relativeDelta, RELATIVE_MODES } from '@openav/midi';

for (const mode of RELATIVE_MODES) {
  const cc = relativeValue(-3, mode);
  console.log(mode, 'sends', cc, 'which reads back as', relativeDelta(cc, mode));
}`,
        caption: { en: 'Four lines: turning −3 steps is sent as 61, 13, 125 and 67, and each reads back as −3.', zh: '四行輸出：轉 −3 步在四種編碼下分別送出 61、13、125、67，讀回來都是 −3。' },
      },
    ],
    related: ['relativeDelta', 'RELATIVE_MODES'],
    keywords: {
      en: ['encoder', 'relative', 'encode steps', 'virtual encoder', 'offset64'],
      zh: ['編碼器', '相對值', '步數轉 CC', '虛擬旋鈕'],
    },
  },

  RELATIVE_MODES: {
    group: 'midi-io',
    summary: {
      en: 'The four ways an endless encoder can write a turn as a CC value: `offset64`, `offset16`, `twos` and `signbit`.',
      zh: '無限旋鈕把一次轉動寫成 CC 值的四種方式：`offset64`、`offset16`、`twos`、`signbit`。',
    },
    value: {
      type: 'string[]', range: '[\'offset64\', \'offset16\', \'twos\', \'signbit\']',
      en: 'A plain array. [`relativeDelta()`](#relativeDelta) and [`relativeValue()`](#relativeValue) take one of these as `mode`, and a profile\'s `relative` field must be one of them (or `false` for an absolute encoder).',
      zh: '一個普通陣列。[`relativeDelta()`](#relativeDelta) 和 [`relativeValue()`](#relativeValue) 的 `mode` 要從裡面挑一個，設定檔的 `relative` 欄位也必須是其中之一（絕對值旋鈕寫 `false`）。',
    },
    description: [
      {
        en: 'Use it to check or list the encodings, for example when you build a profile editor. `validateProfile()` reports an encoder whose `relative` is not in this list.',
        zh: '用來檢查或列出編碼方式，例如做設定檔編輯器的時候。`validateProfile()` 會回報 `relative` 不在這個清單裡的旋鈕。',
      },
    ],
    examples: [
      {
        code: `import { RELATIVE_MODES } from '@openav/midi';

console.log(RELATIVE_MODES);`,
        caption: { en: 'Prints the four mode names.', zh: '印出四個模式名稱。' },
      },
    ],
    related: ['relativeDelta', 'relativeValue', 'validateProfile'],
    keywords: { en: ['relative modes', 'encoder encodings', 'offset64', 'twos', 'signbit'], zh: ['相對模式', '編碼方式', '旋鈕編碼'] },
  },

  bendToUnit: {
    group: 'midi-io',
    summary: {
      en: 'Turns a 14-bit pitch-bend value (0..16383) into −1..1, with the centre (8192) exactly 0.',
      zh: '把 14 位元的彎音輪數值（0..16383）轉成 −1..1，中心（8192）剛好是 0。',
    },
    params: [
      { name: 'v', type: 'Number', en: 'A pitch-bend value, 0..16383 (what `parseMessage()` puts in `value`).', zh: '彎音輪的數值，0..16383（`parseMessage()` 放在 `value` 裡的那個）。' },
    ],
    returns: { type: 'Number', en: '−1 at 0, 0 at 8192, +1 at 16383.', zh: '0 時是 −1，8192 時是 0，16383 時是 +1。' },
    description: [
      {
        en: 'MIDI centres pitch bend at 8192, so there are 8192 steps below the centre and 8191 above. Below the centre it divides by 8192 and above by 8191, so the bottom reaches exactly −1, the top exactly +1 and the rest position exactly 0. This is the number published as `midi/bend` and `midi/ch/<ch>/bend`.',
        zh: 'MIDI 把彎音輪的中心定在 8192，所以中心以下有 8192 級，以上有 8191 級。它在中心以下除以 8192，以上除以 8191，因此最低剛好是 −1，最高剛好是 +1，休息位置剛好是 0。發佈成 `midi/bend` 和 `midi/ch/<ch>/bend` 的就是這個數字。',
      },
    ],
    examples: [
      {
        code: `import { bendToUnit, unitToBend } from '@openav/midi';

console.log(bendToUnit(0), bendToUnit(8192), bendToUnit(16383));   // -1 0 1
console.log(bendToUnit(12288));                                    // about 0.5
console.log(unitToBend(bendToUnit(5000)));                         // 5000`,
        caption: { en: 'Prints −1, 0, 1, then about 0.5, then 5000: the round trip is exact.', zh: '印出 −1、0、1，接著約 0.5，最後 5000：來回轉換不會失真。' },
      },
    ],
    related: ['unitToBend', 'BEND_CENTER', 'genericSignals'],
    keywords: { en: ['pitch bend', 'bend', 'wheel', '14-bit', 'normalize', 'midi/bend'], zh: ['彎音輪', '彎音', '14 位元', '正規化', 'midi/bend'] },
  },

  unitToBend: {
    group: 'midi-io',
    summary: {
      en: 'Turns a −1..1 number into a 14-bit pitch-bend value (0..16383), the inverse of `bendToUnit()`.',
      zh: '把 −1..1 的數字轉成 14 位元的彎音輪數值（0..16383），是 `bendToUnit()` 的反向。',
    },
    params: [
      { name: 'u', type: 'Number', en: 'A position from −1 (fully down) to 1 (fully up). 0 is the centre.', zh: '位置，從 −1（最下）到 1（最上），0 是中心。' },
    ],
    returns: { type: 'Number', en: 'The rounded 14-bit value: `unitToBend(0)` is 8192, `unitToBend(1)` is 16383.', zh: '四捨五入後的 14 位元數值：`unitToBend(0)` 是 8192，`unitToBend(1)` 是 16383。' },
    description: [
      {
        en: 'It does not hold `u` to −1..1, so clamp it first if it can overshoot. [`encodeMessage()`](#encodeMessage) clamps the final value into 0..16383 anyway, so a pitch-bend message built from an overshoot stays valid.',
        zh: '它不會把 `u` 限制在 −1..1，可能超出範圍的話請先自己限制。不過 [`encodeMessage()`](#encodeMessage) 最後會把數值限制在 0..16383，所以用超出範圍的數字組成的彎音訊息仍然是合法的。',
      },
    ],
    examples: [
      {
        code: `import { unitToBend, encodeMessage } from '@openav/midi';

console.log(unitToBend(-1), unitToBend(0), unitToBend(1));   // 0 8192 16383
console.log(encodeMessage({ type: 'pitchbend', ch: 1, value: unitToBend(0.5) }));`,
        caption: { en: 'Prints `0 8192 16383`, then the three bytes of a half-up pitch bend.', zh: '印出 `0 8192 16383`，再印出「推到一半」的彎音訊息的三個位元組。' },
      },
    ],
    related: ['bendToUnit', 'BEND_CENTER', 'encodeMessage'],
    keywords: { en: ['pitch bend', 'bend', 'unit to bend', '14-bit', 'wheel'], zh: ['彎音輪', '彎音', '14 位元', '轉換'] },
  },

  BEND_CENTER: {
    group: 'midi-io',
    summary: {
      en: 'The resting value of a pitch-bend wheel: 8192, the middle of the 14-bit range 0..16383.',
      zh: '彎音輪休息時的數值：8192，也就是 14 位元範圍 0..16383 的中間。',
    },
    value: {
      type: 'Number', range: '8192',
      en: 'A constant. A pitch-bend `value` equal to it means "not bent" and becomes 0 in [`bendToUnit()`](#bendToUnit).',
      zh: '常數。彎音輪的 `value` 等於它就表示「沒有彎」，在 [`bendToUnit()`](#bendToUnit) 裡會變成 0。',
    },
    description: [
      {
        en: 'Use it when you build a pitch-bend message by hand: `{ type: \'pitchbend\', ch: 1, value: BEND_CENTER }` is a wheel at rest. Spring-loaded wheels in a profile (`spring`) go back to this value when released.',
        zh: '手動組彎音訊息時用得到：`{ type: \'pitchbend\', ch: 1, value: BEND_CENTER }` 就是休息中的彎音輪。設定檔裡帶彈簧的彎音輪（`spring`）放開後會回到這個值。',
      },
    ],
    examples: [
      {
        code: `import { BEND_CENTER, encodeMessage } from '@openav/midi';

console.log(BEND_CENTER);                                          // 8192
console.log(encodeMessage({ type: 'pitchbend', ch: 1, value: BEND_CENTER }));`,
        caption: { en: 'Prints 8192, then the bytes of a pitch bend at rest.', zh: '印出 8192，再印出休息位置彎音訊息的位元組。' },
      },
    ],
    related: ['bendToUnit', 'unitToBend'],
    keywords: { en: ['pitch bend centre', '8192', 'rest', 'wheel'], zh: ['彎音輪中心', '8192', '休息位置'] },
  },

  genericSignals: {
    group: 'midi-io',
    summary: {
      en: 'Lists the device-independent signals one MIDI event becomes: `midi/cc/74`, `midi/note/on`, `midi/bend`, and their per-channel twins such as `midi/ch/2/cc/74`.',
      zh: '列出一則 MIDI 事件會變成哪些跟裝置無關的訊號：`midi/cc/74`、`midi/note/on`、`midi/bend`，以及各頻道版本，例如 `midi/ch/2/cc/74`。',
    },
    params: [
      { name: 'ev', type: 'Object', en: 'An event from [`parseMessage()`](#parseMessage). `null` gives an empty list.', zh: '[`parseMessage()`](#parseMessage) 回傳的事件。給 `null` 會得到空陣列。' },
      { name: 'device', type: 'String | null', en: 'Written into the `device` field of the `midi/note/on` and `midi/note/off` pulses (the port slug).', zh: '寫進 `midi/note/on`、`midi/note/off` 脈衝的 `device` 欄位（連接埠的 slug）。' },
      { name: 'legacy', type: 'Boolean', en: 'Include the short names that ignore the channel (`midi/note/on`, `midi/cc/<n>`, `midi/bend`).', zh: '是否包含不分頻道的短名稱（`midi/note/on`、`midi/cc/<n>`、`midi/bend`）。' },
      { name: 'channel', type: 'Boolean', en: 'Include the per-channel names (`midi/ch/<ch>/…`).', zh: '是否包含分頻道的名稱（`midi/ch/<ch>/…`）。' },
    ],
    returns: { type: '{ name, value, pulse?, min?, max? }[]', en: 'One item per signal. Hand the list to [`publish()`](#publish).', zh: '每個訊號一項。把整個陣列交給 [`publish()`](#publish) 即可。' },
    description: [
      {
        en: 'Two families, both published for every hardware port and every virtual controller. The short ones are what most worlds read: a `noteon` becomes the pulse `midi/note/on` with `{ note, vel (0..1), velocity (1..127), ch, device }`, a `noteoff` becomes `midi/note/off` with `{ note, ch, device }`, a `cc` becomes `midi/cc/<n>` (0..1), and a `pitchbend` becomes `midi/bend` (−1..1).',
        zh: '兩組名稱，每個硬體連接埠和每個虛擬控制器都會發佈。短名稱是大多數世界讀的：`noteon` 變成脈衝 `midi/note/on`，內容是 `{ note, vel（0..1）, velocity（1..127）, ch, device }`。`noteoff` 變成 `midi/note/off`，內容是 `{ note, ch, device }`。`cc` 變成 `midi/cc/<n>`（0..1），`pitchbend` 變成 `midi/bend`（−1..1）。',
      },
      {
        en: 'The per-channel ones are for two devices that share a CC number, or a work that cares about the channel: `midi/ch/<ch>/note/<n>` (velocity 0..1 while held, 0 on release), `midi/ch/<ch>/cc/<n>`, `midi/ch/<ch>/bend`, `midi/ch/<ch>/pressure` (channel aftertouch) and `midi/ch/<ch>/poly/<n>` (polyphonic aftertouch). Pressure and poly exist only in this family. `program`, `clock` and the other system messages produce nothing.',
        zh: '分頻道的那組給「兩台機器共用同一個 CC 編號」或「作品在意頻道」的時候用：`midi/ch/<ch>/note/<n>`（按著時是力度 0..1，放開是 0）、`midi/ch/<ch>/cc/<n>`、`midi/ch/<ch>/bend`、`midi/ch/<ch>/pressure`（頻道觸後）、`midi/ch/<ch>/poly/<n>`（複音觸後）。壓力和 poly 只存在於這一組。`program`、`clock` 和其他系統訊息不會產生訊號。',
      },
      {
        en: 'There is deliberately no `midi/cc/<ch>/<n>`: under prefix subscriptions it would collide with "CC 1 on any channel".',
        zh: '刻意沒有 `midi/cc/<ch>/<n>` 這種名稱：用前綴訂閱時，它會跟「任何頻道的 CC 1」搞混。',
      },
    ],
    examples: [
      {
        code: `import { genericSignals } from '@openav/midi';

const names = (ev) => genericSignals(ev).map((s) => s.name);
console.log(names({ type: 'cc', ch: 2, cc: 74, value: 64 }));
console.log(names({ type: 'noteon', ch: 10, note: 36, vel: 127 }));
console.log(names({ type: 'chanat', ch: 1, value: 80 }));`,
        caption: { en: 'Prints `[\'midi/cc/74\', \'midi/ch/2/cc/74\']`, then the two note-on names, then the single per-channel pressure name.', zh: '印出 `[\'midi/cc/74\', \'midi/ch/2/cc/74\']`，接著是 note-on 的兩個名稱，最後是只有分頻道版本的壓力名稱。' },
      },
      {
        code: `import { genericSignals } from '@openav/midi';

const ev = { type: 'noteon', ch: 1, note: 60, vel: 100 };
console.log(genericSignals(ev, { device: 'my-keys' })[0].value);
console.log(genericSignals(ev, { legacy: false }).map((s) => s.name));`,
        caption: { en: 'The first prints the pulse payload `{ note: 60, vel: 0.787…, velocity: 100, ch: 1, device: \'my-keys\' }`, the second only the per-channel name.', zh: '第一行印出脈衝內容 `{ note: 60, vel: 0.787…, velocity: 100, ch: 1, device: \'my-keys\' }`，第二行只剩分頻道的名稱。' },
      },
    ],
    related: ['eventOfSignal', 'publish', 'parseMessage', 'followMidiSignals'],
    keywords: {
      en: ['signal names', 'midi/cc', 'midi/note/on', 'midi/bend', 'midi/ch', 'per channel', 'pulse', 'publish midi'],
      zh: ['訊號名稱', 'midi/cc', 'midi/note/on', 'midi/bend', '分頻道', '脈衝', '發佈 midi'],
    },
  },

  eventOfSignal: {
    group: 'midi-io',
    summary: {
      en: 'The inverse of `genericSignals()`: turns one generic MIDI signal (`midi/ch/10/note/36`, `midi/cc/74`) back into the MIDI event it came from.',
      zh: '`genericSignals()` 的反向：把一個通用的 MIDI 訊號（`midi/ch/10/note/36`、`midi/cc/74`）轉回它原本的 MIDI 事件。',
    },
    params: [
      { name: 'name', type: 'String', en: 'A signal name. Only the generic names starting with `midi/` are understood.', zh: '訊號名稱。只認得 `midi/` 開頭的通用名稱。' },
      { name: 'value', type: 'any', en: 'The signal\'s value: a number 0..1 (−1..1 for bend), or the `{ note, vel, velocity, ch }` payload of `midi/note/on` and `midi/note/off`.', zh: '訊號的值：0..1 的數字（彎音是 −1..1），或 `midi/note/on`、`midi/note/off` 那個 `{ note, vel, velocity, ch }` 內容。' },
      { name: 'channel', type: 'Number', en: 'The channel to use for the legacy names that carry none (`midi/cc/<n>`, `midi/bend`).', zh: '沒有頻道資訊的短名稱（`midi/cc/<n>`、`midi/bend`）要用哪個頻道。' },
    ],
    returns: { type: '{ family, ev } | null', en: '`family` is `\'channel\'` or `\'legacy\'`, and `ev` is the event. `null` for a device name (`midi/minilab3/…`), `midi/virtual` and anything else.', zh: '`family` 是 `\'channel\'` 或 `\'legacy\'`，`ev` 是事件。裝置名稱（`midi/minilab3/…`）、`midi/virtual` 和其他名稱都回傳 `null`。' },
    description: [
      {
        en: 'It lets anything that only hears a [`Signals`](/docs/#signals-openav-midi) bus (a recorded take playing back, the on-screen piano, a phone) drive a controller model as if the bytes had arrived. Values come back on the 0..127 scale they were published from (value × 127, rounded), so the round trip through `genericSignals()` is exact.',
        zh: '有了它，只聽得到 [`Signals`](/zh/docs/#signals-openav-midi) 匯流排的東西（正在回放的錄音、螢幕上的鋼琴、手機），也能像收到原始位元組一樣去推動控制器模型。數值會還原成當初發佈時的 0..127 尺度（值 × 127 再四捨五入），所以跟 `genericSignals()` 來回轉換不會失真。',
      },
      {
        en: 'A note signal with a value above 0 is a `noteon` (velocity at least 1), and 0 is a `noteoff`. The on-screen piano publishes channel 0, which is read as `channel`. A hardware message is published under both families, so a listener that wants each message once should use [`followMidiSignals()`](#followMidiSignals) instead of calling this on every name.',
        zh: '音符訊號的值大於 0 是 `noteon`（力度至少 1），等於 0 是 `noteoff`。螢幕上的鋼琴發佈的頻道是 0，會被當成 `channel` 參數。硬體的一則訊息會用兩組名稱各發佈一次，所以想「每則訊息只處理一次」的話，請用 [`followMidiSignals()`](#followMidiSignals)，不要對每個名稱都呼叫這個函式。',
      },
    ],
    examples: [
      {
        code: `import { eventOfSignal } from '@openav/midi';

console.log(JSON.stringify(eventOfSignal('midi/ch/10/note/36', 0.5)));
console.log(JSON.stringify(eventOfSignal('midi/cc/74', 1, { channel: 4 })));
console.log(eventOfSignal('midi/minilab3/knob1', 1));   // a device name: null`,
        caption: { en: 'Prints a `noteon` on channel 10 with velocity 64, a CC 74 on channel 4 with value 127, then `null`.', zh: '印出頻道 10、力度 64 的 `noteon`，頻道 4、值 127 的 CC 74，最後是 `null`。' },
      },
    ],
    related: ['genericSignals', 'followMidiSignals', 'ControllerCanvas'],
    keywords: {
      en: ['signal to midi', 'reverse', 'inverse', 'signals to events', 'take playback', 'bus'],
      zh: ['訊號轉 midi', '反向', '訊號轉事件', '回放', '匯流排'],
    },
  },

  publish: {
    group: 'midi-io',
    summary: {
      en: 'Publishes a list of `{ name, value, pulse?, min?, max? }` into a `Signals` registry, declaring each signal the first time it is seen.',
      zh: '把一串 `{ name, value, pulse?, min?, max? }` 發佈到 `Signals` 登錄表，每個訊號第一次出現時會先宣告。',
    },
    params: [
      { name: 'signals', type: 'Signals', en: 'The registry from `@openav/core`. `null` makes the call do nothing.', zh: '`@openav/core` 的登錄表。給 `null` 就什麼都不做。' },
      { name: 'list', type: 'Object[]', en: 'Usually the result of [`genericSignals()`](#genericSignals). `pulse: true` fires a pulse, anything else sets a value.', zh: '通常是 [`genericSignals()`](#genericSignals) 的結果。`pulse: true` 會觸發脈衝，其他的會設定數值。' },
    ],
    description: [
      {
        en: 'For a new continuous signal it defines the range from `min` and `max` (0 and 1 when missing) and `source: \'midi\'`. A pulse is defined as `kind: \'pulse\'`. Then it calls `signals.pulse(name, value)` or `signals.set(name, value)`.',
        zh: '遇到新的連續訊號，會用 `min`、`max`（沒寫就是 0 和 1）和 `source: \'midi\'` 來宣告範圍。脈衝則宣告成 `kind: \'pulse\'`。接著呼叫 `signals.pulse(name, value)` 或 `signals.set(name, value)`。',
      },
      {
        en: 'The [`Midi`](#Midi) engine and [`MidiController`](#MidiController) already do this for you. Call it yourself when you read MIDI some other way, for example from a WebSocket, and want the same names in your show.',
        zh: '[`Midi`](#Midi) 引擎和 [`MidiController`](#MidiController) 已經替你做了這件事。只有在你用別的方式讀 MIDI（例如從 WebSocket）、又想在作品裡得到同樣名稱的時候，才需要自己呼叫。',
      },
    ],
    examples: [
      {
        code: `import { Signals } from '@openav/core';
import { parseMessage, genericSignals, publish } from '@openav/midi';

const signals = new Signals();
signals.on('midi/cc/74', (v) => console.log('cc 74 is now', v.toFixed(2)));

// bytes from anywhere: a WebSocket, a file, a test
publish(signals, genericSignals(parseMessage([0xb0, 74, 100])));
console.log(signals.get('midi/ch/1/cc/74'));`,
        caption: { en: 'Prints `cc 74 is now 0.79`, then the same value read from the per-channel name.', zh: '印出 `cc 74 is now 0.79`，再印出從分頻道名稱讀到的同一個值。' },
      },
    ],
    related: ['genericSignals', 'parseMessage', 'Midi', 'MidiController'],
    keywords: {
      en: ['publish', 'signals', 'define signal', 'midi to signals', 'pulse'],
      zh: ['發佈', '訊號', '宣告訊號', 'midi 轉訊號', '脈衝'],
    },
  },

  // ================================================================== the Midi engine, ports, echo, score markers

  Midi: {
    group: 'midi-io',
    summary: {
      en: 'The Web MIDI engine: asks the browser for access, listens to every input, publishes what arrives as signals, and sends to one output port.',
      zh: 'Web MIDI 引擎：向瀏覽器要存取權，聽每一個輸入埠，把收到的訊息發佈成訊號，並送到一個輸出埠。',
    },
    params: [
      { name: 'signals', type: 'Signals | null', en: 'Publish every input message here as `midi/…` signals (see [`genericSignals()`](#genericSignals)). Without it the engine still calls `listen()` callbacks and the `on…` hooks.', zh: '把每則輸入訊息發佈成 `midi/…` 訊號（見 [`genericSignals()`](#genericSignals)）。不給的話，引擎仍然會呼叫 `listen()` 的函式和 `on…` 掛鉤。' },
      { name: 'filterOut', type: 'String | RegExp | null', en: 'Input port NAMES never to listen to, as a regular expression (a string is read as its source, case-insensitive). The default `\'IAC\'` is the macOS bus you send into Ableton or TouchDesigner, so what you send never comes back as input. `null` listens to everything.', zh: '永遠不聽的輸入埠「名稱」，寫成正規表示式（字串會當成它的內容，不分大小寫）。預設 `\'IAC\'` 是 macOS 上你用來送進 Ableton 或 TouchDesigner 的匯流排，這樣你送出去的東西不會又從輸入回來。給 `null` 就是全部都聽。' },
      { name: 'requestAccess', type: 'Function | null', en: 'Where the `MIDIAccess` comes from, called as `requestAccess({ sysex: false })` and returning a promise. The default is `navigator.requestMIDIAccess`. Pass your own for a test, a shim, or a host that wraps Web MIDI for old sketches and hands the REAL one here.', zh: '`MIDIAccess` 從哪裡來，會以 `requestAccess({ sysex: false })` 呼叫，要回傳 promise。預設是 `navigator.requestMIDIAccess`。測試、轉接層，或是替舊草圖包裝了 Web MIDI 的環境，可以傳自己的函式，並把「真的」那個交到這裡。' },
      { name: 'echoWindow', type: 'Number', en: 'Milliseconds. An input message identical to one just SENT within this window is our own echo and is dropped (counted in `echoDropped`). `0` turns it off.', zh: '毫秒。輸入的訊息如果跟這個時間內剛「送出」的某一則完全相同，就視為自己的回音而丟掉（計入 `echoDropped`）。`0` 表示關閉。' },
      { name: 'prefer', type: 'Array<String | RegExp>', en: 'Output priority after the port you chose by name: the first entry that matches a live port wins (a string matches as a substring), else the first port. Example: `[\'IAC\']`.', zh: '你用名稱指定的埠之後的輸出優先順序：第一個對得上存活埠的項目勝出（字串以子字串比對），都沒有就用第一個埠。例如 `[\'IAC\']`。' },
    ],
    description: [
      {
        en: 'Create it, then `await midi.enable()`. It resolves `true` once the browser has given access and `false` when there is no Web MIDI (Safari, iPad) or the permission was refused; the reason is written to the log (`onMessage`). Nothing is listened to or sent before that.',
        zh: '建立之後，`await midi.enable()`。瀏覽器給了存取權就回傳 `true`，沒有 Web MIDI（Safari、iPad）或權限被拒絕就回傳 `false`，原因會寫進記錄（`onMessage`）。在那之前不會聽也不會送任何東西。',
      },
      {
        en: 'In: every message from every listened input goes to the callbacks you added with `listen(fn)` (raw bytes, including clock), then is parsed and published as [`genericSignals()`](#genericSignals) names. With two or more inputs it also publishes `midi/<slug>/note/on`, `midi/<slug>/note/off`, `midi/<slug>/cc/<n>` and `midi/<slug>/bend`, so devices do not collide. The slug comes from the port name (`Minilab3 MIDI` becomes `minilab3-midi`), so a device that drops and reconnects keeps its identity. Clock messages are not logged and publish nothing.',
        zh: '輸入：每個被聆聽的輸入埠送來的每一則訊息，會先交給你用 `listen(fn)` 加的函式（原始位元組，包含時鐘），再被解析並發佈成 [`genericSignals()`](#genericSignals) 的名稱。有兩個以上輸入埠時，另外會發佈 `midi/<slug>/note/on`、`midi/<slug>/note/off`、`midi/<slug>/cc/<n>` 和 `midi/<slug>/bend`，讓不同機器不會互相打架。slug 由埠名產生（`Minilab3 MIDI` 變成 `minilab3-midi`），所以機器斷線再接回來，身分不變。時鐘訊息不寫記錄，也不發佈訊號。',
      },
      {
        en: 'Out: `send(bytes)`, `noteOn()`, `noteOff()` and `cc()` go to `midi.out`, the chosen output port, and are remembered for echo filtering. If that port is unplugged the engine moves to the next best live port (your choice by name, then `prefer`, then the first), moves back when your choice returns, and never lets an unrelated device steal the output. Every switch writes one line to the log and one `console.warn`, and calls the `onOutput` subscribers.',
        zh: '輸出：`send(bytes)`、`noteOn()`、`noteOff()`、`cc()` 都會送到 `midi.out`（選定的輸出埠），並記下來做回音過濾。那個埠被拔掉時，引擎會換到下一個最好的存活埠（先你用名稱指定的，再 `prefer`，最後第一個），你指定的埠回來就換回去，而且不相干的新裝置不會搶走輸出。每次切換都會寫一行記錄、一個 `console.warn`，並通知 `onOutput` 的訂閱者。',
      },
      {
        en: 'Hooks you can assign: `onCC(cc, value01, ch)`, `onNote(note, velocity01, on, ch)`, `onMessage({ dir, text })` (the log), `onSend(bytes)` (sees everything sent, for a meter) and `onDeviceChange(devices)`. Fields: `enabled`, `inputs`, `outputs`, `out`, `access`, `echoDropped`.',
        zh: '可以指定的掛鉤：`onCC(cc, value01, ch)`、`onNote(note, velocity01, on, ch)`、`onMessage({ dir, text })`（記錄）、`onSend(bytes)`（看得到所有送出的訊息，做音量表用）、`onDeviceChange(devices)`。欄位有：`enabled`、`inputs`、`outputs`、`out`、`access`、`echoDropped`。',
      },
    ],
    needs: {
      en: 'Call `await midi.enable()` first. Browsers with Web MIDI (Chrome, Edge, Firefox) ask the visitor for permission at that moment, so call it from a click when you can. Safari and iPad have no Web MIDI: `enable()` gives `false`.',
      zh: '要先呼叫 `await midi.enable()`。有 Web MIDI 的瀏覽器（Chrome、Edge、Firefox）會在這個時候向訪客要權限，所以可以的話請在點擊裡呼叫。Safari 和 iPad 沒有 Web MIDI，`enable()` 會回傳 `false`。',
    },
    notes: [
      {
        en: '`createShow()` creates one and enables it for you. `createController()` and `<oav-controller>` share one engine per page, so a page with five controllers asks for MIDI once.',
        zh: '`createShow()` 會替你建立一個並啟用它。`createController()` 和 `<oav-controller>` 在同一個頁面上共用一個引擎，所以一頁放五個控制器也只會要一次 MIDI。',
      },
      {
        en: 'The engine sends MIDI data only and plays no audio. To hear the notes you need a synth on the other end (a DAW on the IAC bus, a hardware synth), or `@openav/sound`.',
        zh: '引擎只送 MIDI 資料，自己不發聲。想聽到音符，另一端要有合成器（接在 IAC 匯流排上的 DAW、硬體合成器），或是用 `@openav/sound`。',
      },
    ],
    members: {
      devices: { en: 'The inputs being listened to, for a picker: `[{ slug, name, listening }]`. Duplicate names get `-2`, `-3` after the slug.', zh: '正在聆聽的輸入埠，給選單用：`[{ slug, name, listening }]`。名稱重複時，slug 後面會加上 `-2`、`-3`。' },
      setListening: { en: 'Mutes or unmutes one device without unplugging it, and tells the `onDevices` subscribers.', zh: '讓某一台裝置靜音或取消靜音，不用拔掉，並通知 `onDevices` 的訂閱者。' },
      onDevices: { en: 'Subscribe to device-list changes (plug, unplug, mute): `fn(devices)`. Returns a function that unsubscribes.', zh: '訂閱裝置清單的變化（插上、拔掉、靜音）：`fn(devices)`。回傳一個取消訂閱的函式。' },
      log: { en: 'Writes one line to the log by calling `onMessage({ dir, text })`. The engine uses `dir` `\'in\'` and `\'out\'`.', zh: '寫一行記錄，做法是呼叫 `onMessage({ dir, text })`。引擎用的 `dir` 是 `\'in\'` 和 `\'out\'`。' },
      enable: { en: 'Asks the browser for Web MIDI and wires the inputs. `preferredOut` is the output you want, by exact name and then by substring. Resolves `true`, or `false` when Web MIDI is missing or refused.', zh: '向瀏覽器要 Web MIDI 並接上輸入埠。`preferredOut` 是你想用的輸出埠，先比對完整名稱，再比對子字串。成功回傳 `true`，沒有 Web MIDI 或被拒絕則回傳 `false`。' },
      onOutput: { en: 'Subscribe to output changes (hot-plug, switch back, your own `selectOutput`): `fn({ text, reason, next, out })`. `reason` is `found`, `fallback`, `back`, `none` or `select`. Returns an unsubscribe function.', zh: '訂閱輸出埠的變化（熱插拔、換回來、你自己呼叫 `selectOutput`）：`fn({ text, reason, next, out })`。`reason` 是 `found`、`fallback`、`back`、`none` 或 `select`。回傳取消訂閱的函式。' },
      selectOutput: { en: 'Sends to the output with exactly this name from now on, and remembers it as YOUR choice: if it is unplugged and plugged in again, the output returns to it. Gives `false` when no output has that name.', zh: '從現在起送到「名稱完全相同」的輸出埠，並記成「你的選擇」：它被拔掉又插回來時，輸出會回到它。找不到那個名稱就回傳 `false`。' },
      outputFor: { en: 'The output port a device answers on (for LED feedback): the one with the same name as its input, or the first whose name matches a RegExp. `null` when there is none.', zh: '某台裝置接收回應用的輸出埠（做 LED 回饋）：名稱跟輸入埠相同的那個，或是名稱符合正規表示式的第一個。沒有就回傳 `null`。' },
      listen: { en: 'Subscribe to the raw bytes of every listened input: `fn(bytes, { slug, name, input })`. Called before parsing, clock included. Returns an unsubscribe function.', zh: '訂閱每個被聆聽的輸入埠的原始位元組：`fn(bytes, { slug, name, input })`。在解析之前呼叫，時鐘也包含在內。回傳取消訂閱的函式。' },
      send: { en: 'Sends raw bytes to the output port, and to the `onSend` hook. Unless `echo` is `false` they are also remembered, so the same bytes coming back within `echoWindow` ms are dropped. Does nothing when there is no output.', zh: '把原始位元組送到輸出埠和 `onSend` 掛鉤。除非 `echo` 是 `false`，它們也會被記下來，在 `echoWindow` 毫秒內又原樣回來的訊息會被丟掉。沒有輸出埠時什麼都不做。' },
      noteOn: { en: 'Sends a note-on. `note` and `vel` are 0..127 and `ch` is 1..16.', zh: '送出 note-on。`note`、`vel` 是 0..127，`ch` 是 1..16。' },
      noteOff: { en: 'Sends a note-off (velocity 0).', zh: '送出 note-off（力度 0）。' },
      cc: { en: 'Sends a control change.', zh: '送出控制變更。' },
      dispose: { en: 'Lets go of every port and listener (an embed removed from the page). The `MIDIAccess` itself belongs to the browser and stays.', zh: '放掉所有的埠和監聽函式（例如頁面上移除了一個嵌入）。`MIDIAccess` 本身屬於瀏覽器，會留著。' },
      panic: { en: 'Silences everything: all-notes-off, all-sound-off and sustain-off on all 16 channels, plus a note-off for every note. It goes through `send()`, so meters see the sweep.', zh: '讓所有聲音停下來：對 16 個頻道各送一次全部音符關閉、全部聲音關閉、延音踏板關閉，再對每個音送 note-off。它走 `send()`，所以音量表看得到這一輪清除。' },
    },
    tbd: [
      {
        en: 'Not tried for this page: the real permission prompt and real MIDI hardware in each browser. The examples run against a stand-in for `MIDIAccess`, and the browser behaviour (Chrome, Edge and Firefox ask for permission, Safari and iPad have no Web MIDI) is as the package README describes it.',
        zh: '這一頁沒有實測：各個瀏覽器真實的權限詢問，以及真實的 MIDI 硬體。範例是用假的 `MIDIAccess` 跑的，瀏覽器的行為（Chrome、Edge、Firefox 會詢問權限，Safari 和 iPad 沒有 Web MIDI）是照套件 README 的說法寫的。',
      },
    ],
    examples: [
      {
        code: `import { Midi } from '@openav/midi';

// a stand-in for navigator.requestMIDIAccess, so this runs without a device
const output = { name: 'Demo out', state: 'connected', send: (bytes) => console.log('out', bytes) };
const access = { inputs: new Map(), outputs: new Map([['o', output]]) };

const midi = new Midi({ requestAccess: async () => access });
console.log(await midi.enable());   // true
midi.noteOn(60, 100);               // out [144, 60, 100]
midi.noteOff(60);                   // out [128, 60, 0]`,
        caption: { en: 'Prints `true`, then the two messages that reach the output port: note-on and note-off for middle C.', zh: '印出 `true`，再印出送到輸出埠的兩則訊息：中央 C 的 note-on 和 note-off。' },
      },
      {
        code: `import { Signals } from '@openav/core';
import { Midi } from '@openav/midi';

const keys = { name: 'Demo Keys', state: 'connected', onmidimessage: null };
const access = { inputs: new Map([['k', keys]]), outputs: new Map() };

const signals = new Signals();
const midi = new Midi({ signals, requestAccess: async () => access });
await midi.enable();

signals.on('midi/cc/74', (v) => console.log('knob', v.toFixed(2)));
keys.onmidimessage({ data: Uint8Array.of(0xb0, 74, 127) });   // the keyboard "plays" CC 74 = 127`,
        caption: { en: 'Prints `knob 1.00`: a message arriving on the input port became the signal `midi/cc/74`.', zh: '印出 `knob 1.00`：輸入埠收到的訊息變成了訊號 `midi/cc/74`。' },
      },
      {
        code: `import { Midi } from '@openav/midi';

const port = (name) => ({ name, state: 'connected', send: () => {} });
const iac = port('IAC Driver Bus 1'), synth = port('Synth');
const access = { inputs: new Map(), outputs: new Map([['a', iac], ['b', synth]]) };

const midi = new Midi({ requestAccess: async () => access });
midi.onOutput(({ reason, text }) => console.log(reason, '-', text));
await midi.enable('IAC');
console.log(midi.out.name);          // IAC Driver Bus 1

access.outputs.delete('a'); iac.state = 'disconnected';
access.onstatechange();              // what the browser does when a port is unplugged
console.log(midi.out.name);          // Synth`,
        caption: { en: 'Prints the chosen port, then a `fallback` line saying the output moved to "Synth" (the engine also writes it with `console.warn`), then `Synth`.', zh: '印出選定的埠，接著一行 `fallback`，說明輸出換到了「Synth」（引擎也會用 `console.warn` 印一次），最後印出 `Synth`。' },
      },
      {
        code: `import { Midi } from '@openav/midi';

const midi = new Midi();
if (await midi.enable()) {
  console.log('inputs:', midi.devices().map((d) => d.name));
} else {
  console.log('no Web MIDI here, or the permission was refused');
}`,
        caption: { en: 'The real thing: the browser asks for MIDI permission, then the console lists your input devices (or says there is no Web MIDI).', zh: '真正的用法：瀏覽器會詢問 MIDI 權限，接著主控台列出你的輸入裝置（或告訴你沒有 Web MIDI）。' },
        run: 'static',
        why: 'It calls the real navigator.requestMIDIAccess, which needs a browser with Web MIDI and a permission prompt that headless Chromium cannot answer.',
      },
    ],
    related: ['EchoGuard', 'pickOutput', 'reselectOutput', 'genericSignals', 'createController', 'MidiControllers', 'ScoreMidi'],
    keywords: {
      en: ['web midi', 'midi engine', 'requestMIDIAccess', 'midi in', 'midi out', 'send', 'panic', 'iac', 'hot-plug', 'permission', 'enable'],
      zh: ['web midi', 'midi 引擎', '輸入', '輸出', '送出', '全部關閉', 'iac', '熱插拔', '權限', '啟用'],
    },
  },

  isLive: {
    group: 'midi-io',
    summary: {
      en: 'Says whether a MIDI port can still be sent to: it exists and its `state` is not `\'disconnected\'`.',
      zh: '判斷一個 MIDI 埠還能不能送資料：它存在，而且 `state` 不是 `\'disconnected\'`。',
    },
    params: [
      { name: 'p', type: 'MIDIPort | null', en: 'A port shaped like a `MIDIOutput`: it only needs a `state`.', zh: '長得像 `MIDIOutput` 的埠，只需要有 `state`。' },
    ],
    returns: { type: 'Boolean', en: '`false` for `null` and for a disconnected port.', zh: '給 `null` 或已斷線的埠回傳 `false`。' },
    description: [
      {
        en: 'A port that was unplugged can still be an object in your hands. Sending to it gets nowhere, and the engine\'s try/catch swallows the error, so nothing on screen says why. The output rules ([`pickOutput()`](#pickOutput), [`reselectOutput()`](#reselectOutput)) therefore skip every port that is not live.',
        zh: '被拔掉的埠，在你手上仍然是個物件。對它送資料到不了任何地方，引擎的 try/catch 又會把錯誤吞掉，畫面上看不出原因。所以輸出的挑選規則（[`pickOutput()`](#pickOutput)、[`reselectOutput()`](#reselectOutput)）會跳過所有不存活的埠。',
      },
    ],
    examples: [
      {
        code: `import { isLive } from '@openav/midi';

console.log(isLive({ name: 'A', state: 'connected' }));      // true
console.log(isLive({ name: 'B', state: 'disconnected' }));   // false
console.log(isLive(null));                                   // false`,
        caption: { en: 'Prints `true`, `false`, `false`.', zh: '印出 `true`、`false`、`false`。' },
      },
    ],
    related: ['pickOutput', 'reselectOutput'],
    keywords: { en: ['port alive', 'disconnected', 'port state', 'unplugged'], zh: ['埠存活', '斷線', '埠狀態', '被拔掉'] },
  },

  pickOutput: {
    group: 'midi-io',
    summary: {
      en: 'Chooses which MIDI output to send to from a list: the port you named, else the first match of a preference list, else the first live port.',
      zh: '從清單裡挑要送到哪個 MIDI 輸出埠：先是你指定的名稱，其次是偏好清單的第一個符合者，最後才是第一個存活的埠。',
    },
    params: [
      { name: 'outputs', type: 'MIDIOutput[]', en: 'The candidate ports (objects with a `name` and a `state`).', zh: '候選的埠（有 `name` 和 `state` 的物件）。' },
      { name: 'preferred', type: 'String', en: 'The port you asked for: tried by exact name, then as a substring.', zh: '你指定的埠：先比對完整名稱，再比對子字串。' },
      { name: 'prefer', type: 'Array<String | RegExp>', en: 'Fallback order. The first entry that matches a live port wins (a string is a substring).', zh: '備用順序。第一個對得上存活埠的項目勝出（字串以子字串比對）。' },
    ],
    returns: { type: 'MIDIOutput | null', en: 'The chosen port, or `null` when no port is live.', zh: '選到的埠。沒有任何存活的埠時回傳 `null`。' },
    description: [
      {
        en: 'The order is: 1) the port named `preferred`, 2) the first port that matches each entry of `prefer`, in order, 3) the first port. Only live ports (see [`isLive()`](#isLive)) are considered, so a disconnected port is never picked.',
        zh: '順序是：1）名稱符合 `preferred` 的埠，2）依序比對 `prefer` 每一項，取第一個符合的埠，3）第一個埠。只考慮存活的埠（見 [`isLive()`](#isLive)），所以斷線的埠不會被選到。',
      },
      {
        en: 'It is a pure function over plain objects, so you can test the rules without any hardware. The [`Midi`](#Midi) engine applies them through [`reselectOutput()`](#reselectOutput).',
        zh: '它是處理普通物件的純函式，所以不用任何硬體就能測這些規則。[`Midi`](#Midi) 引擎是透過 [`reselectOutput()`](#reselectOutput) 來套用它們。',
      },
    ],
    examples: [
      {
        code: `import { pickOutput } from '@openav/midi';

const port = (name, state = 'connected') => ({ name, state });
const outs = [port('Synth A'), port('IAC Driver Bus 1'), port('Synth B')];

console.log(pickOutput(outs).name);                              // Synth A
console.log(pickOutput(outs, { preferred: 'IAC' }).name);        // IAC Driver Bus 1
console.log(pickOutput(outs, { prefer: [/synth b/i] }).name);    // Synth B
console.log(pickOutput([port('X', 'disconnected')]));            // null`,
        caption: { en: 'Prints `Synth A`, `IAC Driver Bus 1`, `Synth B` and `null`: the first port, your choice, the preference list, and nothing live.', zh: '印出 `Synth A`、`IAC Driver Bus 1`、`Synth B` 和 `null`：分別是第一個埠、你指定的埠、偏好清單，以及沒有任何存活埠。' },
      },
    ],
    related: ['reselectOutput', 'isLive', 'Midi'],
    keywords: { en: ['choose output', 'output port', 'prefer', 'iac', 'select port'], zh: ['挑輸出埠', '輸出埠', '偏好', 'iac', '選埠'] },
  },

  reselectOutput: {
    group: 'midi-io',
    summary: {
      en: 'Decides what to send to after the port list changed or the current port died, and returns the one line to print about it.',
      zh: '埠清單改變、或目前的埠斷線之後，決定現在該送到哪裡，並回傳一行要印出來的說明。',
    },
    params: [
      { name: 'current', type: 'MIDIOutput | null', en: 'The port in use now.', zh: '現在正在用的埠。' },
      { name: 'outputs', type: 'MIDIOutput[]', en: 'The ports there are now.', zh: '現在有的埠。' },
      { name: 'preferred', type: 'String', en: 'The port you chose by name (the one to go back to).', zh: '你用名稱選的埠（要回去的那一個）。' },
      { name: 'prefer', type: 'Array<String | RegExp>', en: 'Fallback order, as in [`pickOutput()`](#pickOutput).', zh: '備用順序，跟 [`pickOutput()`](#pickOutput) 一樣。' },
    ],
    returns: { type: '{ next, changed, reason, text }', en: '`next` is the port to use. `changed` says whether it differs from `current`. `reason` is `same`, `found`, `fallback`, `back` or `none`. `text` is the line to log (an empty string when nothing changed).', zh: '`next` 是該用的埠，`changed` 表示是否跟 `current` 不同，`reason` 是 `same`、`found`、`fallback`、`back` 或 `none`，`text` 是要記錄的一行（沒變時是空字串）。' },
    description: [
      {
        en: 'It switches only when the current port is gone or disconnected (to the best live one, or to none), or when the port you named is back while a stand-in is in use (back to it). In every other case it stays: plugging in an unrelated device never steals the output. The text is plain ASCII, such as `MIDI out: switched to "Synth" ("IAC Driver Bus 1" was unplugged)`.',
        zh: '只有兩種情況會換：目前的埠不見了或斷線（換到最好的存活埠，或是變成沒有），或是你指定的埠回來了而現在用的是替代品（換回去）。其他情況一律不動：插上不相干的新裝置，不會搶走輸出。說明文字是純 ASCII，例如 `MIDI out: switched to "Synth" ("IAC Driver Bus 1" was unplugged)`。',
      },
      {
        en: 'This is the rule behind the [`Midi`](#Midi) engine\'s output hot-plug. It never touches Web MIDI, so a test can call it with plain objects.',
        zh: '[`Midi`](#Midi) 引擎處理輸出熱插拔，靠的就是這條規則。它完全不碰 Web MIDI，所以測試時用普通物件呼叫就行。',
      },
    ],
    examples: [
      {
        code: `import { reselectOutput } from '@openav/midi';

const iac = { name: 'IAC Driver Bus 1', state: 'connected' };
const synth = { name: 'Synth', state: 'connected' };

// the IAC bus is unplugged: only the synth is left
const r = reselectOutput({ current: iac, outputs: [synth], preferred: 'IAC Driver Bus 1' });
console.log(r.reason, r.changed, r.next.name);
console.log(r.text);

// the IAC bus comes back while the synth stands in: go back to your choice
const back = reselectOutput({ current: synth, outputs: [synth, iac], preferred: 'IAC Driver Bus 1' });
console.log(back.reason, back.next.name);`,
        caption: { en: 'Prints `fallback true Synth` and its sentence, then `back IAC Driver Bus 1`.', zh: '印出 `fallback true Synth` 和它的說明句，再印出 `back IAC Driver Bus 1`。' },
      },
    ],
    related: ['pickOutput', 'isLive', 'Midi'],
    keywords: { en: ['hot-plug', 'unplugged', 'fallback output', 'switch back', 'output changed'], zh: ['熱插拔', '被拔掉', '備用輸出', '換回來', '輸出改變'] },
  },

  EchoGuard: {
    group: 'midi-io',
    summary: {
      en: 'Recognises our own MIDI messages coming back: remember what was sent, and an identical message arriving within a short window is an echo, not a performer.',
      zh: '認出「自己送出的 MIDI 又回來了」：記住送出過什麼，短時間內抵達的相同訊息就是回音，不是演奏者彈的。',
    },
    params: [
      { name: 'window', type: 'Number', en: 'Milliseconds an echo may take to come back. `0` turns the guard off.', zh: '回音可以晚多久回來（毫秒）。`0` 表示關閉。' },
      { name: 'max', type: 'Number', en: 'How many sent messages to remember. Only the newest `max` are kept.', zh: '要記住幾則送出的訊息，只留最新的 `max` 則。' },
    ],
    description: [
      {
        en: 'A virtual cable or a DAW can send your message straight back on an input, and the engine would treat it as a performer. `sent(bytes)` records a message and `isEcho(bytes)` asks whether an arriving one is that message returning. Each sent message cancels at most ONE echo, so two real identical messages are not both eaten.',
        zh: '虛擬線路或 DAW 可能把你送出的訊息原樣從輸入送回來，引擎會把它當成演奏者。`sent(bytes)` 記下一則訊息，`isEcho(bytes)` 問「剛到的這則是不是那一則回來了」。每則送出的訊息最多只抵銷「一個」回音，所以兩則真正相同的訊息不會被一起吃掉。',
      },
      {
        en: 'A note-on with velocity 0 counts as a note-off, in both directions, because a DAW may rewrite one as the other. System messages (clock and the like) are never recorded. [`Midi`](#Midi) has one (`midi.echo`, with the `echoWindow` option) and drops the echoes it finds, counted in `midi.echoDropped`.',
        zh: '力度 0 的 note-on 當成 note-off，雙向都算，因為 DAW 可能把其中一種改寫成另一種。系統訊息（時鐘之類）不會被記錄。[`Midi`](#Midi) 內建一個（`midi.echo`，由 `echoWindow` 選項設定），並把找到的回音丟掉，數量記在 `midi.echoDropped`。',
      },
    ],
    members: {
      sent: { en: 'Records a message we just sent. Messages of 0xF0 and above are ignored, and nothing is recorded when `window` is 0.', zh: '記下剛送出的訊息。0xF0 以上的訊息會被忽略，`window` 是 0 時什麼都不記。' },
      isEcho: { en: 'Gives `true` when this arriving message is a recorded one coming back within `window` ms, and uses that memory up. Older records are forgotten.', zh: '在這則剛到的訊息是「記錄過的那則、在 `window` 毫秒內回來」時回傳 `true`，並把那筆記憶用掉。更舊的記錄會被忘掉。' },
      clear: { en: 'Forgets everything recorded.', zh: '忘掉所有記錄。' },
    },
    examples: [
      {
        code: `import { EchoGuard } from '@openav/midi';

const guard = new EchoGuard({ window: 40 });
guard.sent([0x90, 60, 100], 1000);                 // we sent note-on 60 at t = 1000 ms

console.log(guard.isEcho([0x90, 60, 100], 1010));  // true: it came back 10 ms later
console.log(guard.isEcho([0x90, 60, 100], 1011));  // false: one send explains one echo
guard.sent([0x90, 62, 100], 2000);
console.log(guard.isEcho([0x90, 62, 100], 2100));  // false: 100 ms later is a performer`,
        caption: { en: 'Prints `true`, `false`, `false`: an echo is used up once, and a message that arrives too late is a real note.', zh: '印出 `true`、`false`、`false`：回音只抵銷一次，太晚到的訊息是真的音符。' },
      },
    ],
    related: ['Midi', 'isLive'],
    keywords: { en: ['echo', 'feedback loop', 'loopback', 'duplicate', 'own messages', 'loopMIDI'], zh: ['回音', '回授迴圈', '迴路', '重複', '自己的訊息', 'loopMIDI'] },
  },

  ScoreMidi: {
    group: 'midi-io',
    summary: {
      en: 'Turns a show\'s segment changes and cues into MIDI notes and CCs on one channel, so a DAW or lighting desk can follow the show.',
      zh: '把演出的段落切換和 cue 變成某個頻道上的 MIDI 音符與 CC，讓 DAW 或燈光台能跟著演出走。',
    },
    params: [
      { name: 'midi', type: 'Midi', en: 'What to send through: a [`Midi`](#Midi) (anything with `noteOn`, `noteOff` and `cc`). Required: without it the constructor throws.', zh: '要透過誰送出：一個 [`Midi`](#Midi)（任何有 `noteOn`、`noteOff`、`cc` 的東西都行）。必填，沒給建構時會丟出錯誤。' },
      { name: 'channel', type: 'Number', en: 'The MIDI channel, 1..16 (anything else throws).', zh: 'MIDI 頻道，1..16（其他值會丟出錯誤）。' },
      { name: 'segment', type: 'false | Object', en: '`{ note, cc, velocity }`: segment number i sends note `note + i` and/or CC `cc` with value i. `velocity` defaults to 100, `note` to 36 (give `note: null` to send only the CC). `false` sends no segment markers.', zh: '`{ note, cc, velocity }`：第 i 段會送出音符 `note + i` 和（或）CC `cc`（值為 i）。`velocity` 預設 100，`note` 預設 36（只想送 CC 的話，給 `note: null`）。`false` 表示不送段落標記。' },
      { name: 'cue', type: 'false | Object', en: '`{ note, notes, cc, velocity }`: every cue sends `note` (or its own note from the map `notes`, by cue name) and/or CC `cc` with the cue\'s number as value. `note` defaults to 84 (give `note: null` to send only the CC). `false` sends no cue markers.', zh: '`{ note, notes, cc, velocity }`：每個 cue 會送出 `note`（或在 `notes` 對照表裡依 cue 名稱查到的專屬音符）和（或）CC `cc`，值是 cue 的編號。`note` 預設 84（只想送 CC 的話，給 `note: null`）。`false` 表示不送 cue 標記。' },
      { name: 'length', type: 'Number', en: 'Seconds before a marker note\'s note-off. A marker note is a trigger, not a held note.', zh: '標記音符送出後，隔幾秒才送 note-off。標記音符是觸發用的，不是按著的音。' },
      { name: 'scrub', type: 'Boolean', en: 'Also mark jumps the playhead made by hand (`seek`, `jump`). Off by default, so dragging the scrubber does not launch clips in the DAW.', zh: '手動拖動播放頭造成的跳轉（`seek`、`jump`）也要送標記。預設關閉，這樣拖動時間軸不會在 DAW 裡誤觸發片段。' },
      { name: 'enabled', type: 'Boolean', en: 'Set to `false` (or later, `out.enabled = false`) to send nothing.', zh: '設成 `false`（或之後改 `out.enabled = false`）就什麼都不送。' },
      { name: 'timer', type: 'Function', en: '`(fn, ms) => …` used to schedule the note-offs. It is `setTimeout`; pass your own in a test.', zh: '排程 note-off 用的 `(fn, ms) => …`，預設是 `setTimeout`，測試時可以傳自己的。' },
    ],
    description: [
      {
        en: 'The score knows when a segment starts and when a cue passes. An outside program cannot read the score, but it can read MIDI: launch a clip on a note, jump a scene on a CC. Create a `ScoreMidi`, then call `out.segment({ index, cause })` and `out.cue({ name, n })` (`createShow({ score: { …, midi: { channel: 15 } } })` does this for you).',
        zh: '樂譜知道每個段落什麼時候開始、cue 什麼時候經過。外部程式讀不到樂譜，但讀得到 MIDI：用某個音符啟動片段，用某個 CC 切換場景。建立一個 `ScoreMidi`，然後呼叫 `out.segment({ index, cause })` 和 `out.cue({ name, n })`（`createShow({ score: { …, midi: { channel: 15 } } })` 會替你做這件事）。',
      },
      {
        en: 'Markers go out only while the show plays (`cause` is `play` or `release`). A `reset` never sends, and `seek` and `jump` send only with `scrub: true`. Everything goes through the engine\'s own `noteOn`, `noteOff` and `cc`, so the MIDI OUT meter shows it and `panic()` can silence it. Off unless you create it.',
        zh: '只有演出在播放時才送標記（`cause` 是 `play` 或 `release`）。`reset` 永遠不送，`seek` 和 `jump` 只有在 `scrub: true` 時才送。所有訊息都走引擎自己的 `noteOn`、`noteOff`、`cc`，所以 MIDI OUT 音量表看得到，`panic()` 也關得掉。你不建立它就不會送。',
      },
    ],
    members: {
      segmentMessages: { en: 'Returns what a segment change would send, `[{ type: \'note\' | \'cc\', number, value }]`, without sending it. An empty list when markers are off for this cause.', zh: '回傳段落切換「會」送出什麼，`[{ type: \'note\' | \'cc\', number, value }]`，但不實際送出。這個 `cause` 不送標記時是空陣列。' },
      cueMessages: { en: 'Returns what a cue would send, in the same shape. `evt` is `{ name, n }`.', zh: '回傳 cue「會」送出什麼，格式相同。`evt` 是 `{ name, n }`。' },
      segment: { en: 'Sends the markers for a segment that began. `evt` is `{ index, cause }`, `cause` being `play`, `release`, `seek`, `jump` or `reset`. Returns the messages it sent.', zh: '送出「某段落開始」的標記。`evt` 是 `{ index, cause }`，`cause` 為 `play`、`release`、`seek`、`jump` 或 `reset`。回傳實際送出的訊息。' },
      cue: { en: 'Sends the markers for a cue that was passed. `evt` is `{ name, n }`: the cue\'s name and its order in the cut. Returns the messages it sent.', zh: '送出「某個 cue 經過」的標記。`evt` 是 `{ name, n }`：cue 的名稱和它在剪輯裡的順序。回傳實際送出的訊息。' },
    },
    examples: [
      {
        code: `import { ScoreMidi } from '@openav/midi';

// anything with noteOn / noteOff / cc will do; here it just prints
const midi = {
  noteOn: (note, vel, ch) => console.log('note on ', note, vel, 'ch', ch),
  noteOff: (note, ch) => console.log('note off', note, 'ch', ch),
  cc: (cc, val, ch) => console.log('cc', cc, '=', val, 'ch', ch),
};

const out = new ScoreMidi({
  midi, channel: 15,
  segment: { note: 36, cc: 20 },
  cue: { note: 84, notes: { 'dusk.glow': 90 }, cc: 21 },
});

out.segment({ index: 2, cause: 'play' });   // note 38 and CC 20 = 2
out.cue({ name: 'dusk.glow', n: 4 });       // note 90 and CC 21 = 4
out.segment({ index: 1, cause: 'seek' });   // nothing: scrub is off`,
        caption: { en: 'Prints note 38 and CC 20 = 2 for segment 2, note 90 and CC 21 = 4 for the cue, nothing for the seek, and the note-offs 0.15 s later.', zh: '印出第 2 段的音符 38 和 CC 20 = 2，cue 的音符 90 和 CC 21 = 4，跳轉不會有任何輸出，0.15 秒後再印出 note-off。' },
      },
    ],
    related: ['Midi', 'createController'],
    keywords: {
      en: ['score to midi', 'cue', 'segment', 'daw sync', 'follow the show', 'markers', 'trigger clips', 'lighting desk'],
      zh: ['樂譜轉 midi', 'cue', '段落', 'daw 同步', '跟著演出', '標記', '觸發片段', '燈光台'],
    },
  },

  // ================================================================== profiles: a controller described as data

  PROFILES: {
    group: 'midi-io',
    summary: {
      en: 'Every controller profile that ships with the package, as an array of plain JSON objects: real devices first, then the generic layouts.',
      zh: '套件內建的所有控制器設定檔，是一個由普通 JSON 物件組成的陣列：先是真實的機器，再來是通用版面。',
    },
    value: {
      type: 'Object[]',
      en: 'The order is the order a device picker shows. Each item is a raw profile (see [`normalizeProfile()`](#normalizeProfile) for the filled-in form): `id`, `short`, `name`, `kind` (`\'device\'` or `\'generic\'`), `face`, `sections`, `controls` and, for a device, `match` and `sources`.',
      zh: '順序就是裝置選單顯示的順序。每一項是原始設定檔（填好預設值的版本見 [`normalizeProfile()`](#normalizeProfile)）：有 `id`、`short`、`name`、`kind`（`\'device\'` 或 `\'generic\'`）、`face`、`sections`、`controls`，真實機器還有 `match` 和 `sources`。',
    },
    description: [
      {
        en: 'A profile describes one controller as data: what it looks like (the faceplate sections), every control on it (type and the exact MIDI message it sends), LED feedback where the device accepts it, how to recognise its port name, and the document each number came from. Each one is a JSON file in `packages/midi/profiles/`; the full field list is in the package README and the [controllers page](/controllers/) shows them all.',
        zh: '設定檔把一台控制器寫成資料：長什麼樣子（面板的各個區塊）、上面每個控制項（類型，以及它送出的確切 MIDI 訊息）、機器有支援的 LED 回饋、怎麼認出它的埠名，以及每個數字的出處文件。每個設定檔是 `packages/midi/profiles/` 裡的一個 JSON 檔，完整欄位在套件的 README 裡，[控制器頁面](/zh/controllers/)則列出全部。',
      },
      {
        en: 'A `device` profile cites its sources and is matched to ports by name, so plugging the device in picks it automatically. A `generic` layout (`generic-8k8p`, `generic-keys49` …) never auto-matches: you assign a device to it and it learns the controls in the order you move them.',
        zh: '`device` 設定檔要註明資料來源，並且用名稱跟埠配對，所以接上機器就會自動選到它。`generic`（通用）版面（`generic-8k8p`、`generic-keys49` …）永遠不會自動配對：你把某台機器指定給它，它會照你轉動的順序學習控制項。',
      },
      {
        en: 'Pick one with [`profileById()`](#profileById) (by `id` or by the short name), and hand it to [`createController()`](#createController), [`MidiController`](#MidiController) or [`MidiControllers`](#MidiControllers). Do not edit these objects in place: copy first (`structuredClone`), as [`withChannel()`](#withChannel) does.',
        zh: '用 [`profileById()`](#profileById) 挑一個（用 `id` 或短名稱），再交給 [`createController()`](#createController)、[`MidiController`](#MidiController) 或 [`MidiControllers`](#MidiControllers)。不要直接修改這些物件，要先複製（`structuredClone`），[`withChannel()`](#withChannel) 就是這樣做的。',
      },
    ],
    notes: [
      {
        en: 'A control marked `verified: false` (with a `note` saying why) has a message that comes from the manual or a guess and has not been confirmed on a real unit. The faceplate shows a small orange `?` on its label, and Learn rebinds it in one move.',
        zh: '標著 `verified: false` 的控制項（並附上 `note` 說明原因），它的訊息來自說明書或推測，還沒有在真實的機器上確認過。面板上它的標籤旁會有一個橘色的 `?`，用學習一下就能重新綁定。',
      },
    ],
    examples: [
      {
        code: `import { PROFILES } from '@openav/midi';

for (const p of PROFILES.slice(0, 4)) {
  console.log(p.id, '|', p.short, '|', p.kind, '|', p.controls.length, 'controls');
}
console.log(PROFILES.filter((p) => p.kind === 'generic').map((p) => p.id));`,
        caption: { en: 'Prints the first four devices (id, short name, kind, control count), then the ids of the generic layouts.', zh: '印出前四台機器（id、短名稱、類型、控制項數量），再印出通用版面的 id。' },
      },
    ],
    related: ['profileById', 'normalizeProfile', 'validateProfile', 'matchProfile'],
    keywords: {
      en: ['profiles', 'controllers list', 'devices', 'minilab3', 'lpd8', 'launchpad', 'generic layout', 'midi controller data'],
      zh: ['設定檔', '控制器清單', '機器', '通用版面', 'midi 控制器資料', 'minilab3', 'lpd8', 'launchpad'],
    },
  },

  profileById: {
    group: 'midi-io',
    summary: {
      en: 'Looks up a shipped controller profile by its id (`\'akai-lpd8\'`) or its short signal name (`\'lpd8\'`), or returns `null`.',
      zh: '用 id（`\'akai-lpd8\'`）或訊號用的短名稱（`\'lpd8\'`）找一個內建的控制器設定檔，找不到回傳 `null`。',
    },
    params: [
      { name: 'id', type: 'String', en: 'A profile `id` or its `short` name (the part in `midi/<short>/…`).', zh: '設定檔的 `id` 或 `short` 短名稱（`midi/<short>/…` 裡的那一段）。' },
    ],
    returns: { type: 'Object | null', en: 'The raw profile from [`PROFILES`](#PROFILES), the same object each time, or `null`.', zh: '[`PROFILES`](#PROFILES) 裡的原始設定檔，每次回傳同一個物件，找不到則是 `null`。' },
    description: [
      {
        en: 'Only profiles from `PROFILES` are searched. A profile you loaded from a URL is not in there: use [`resolveProfile()`](#resolveProfile), which also accepts ids. It does not normalize or validate: pass the result to [`normalizeProfile()`](#normalizeProfile) when you need the filled-in form.',
        zh: '只會在 `PROFILES` 裡找。從網址載入的設定檔不在裡面，請用 [`resolveProfile()`](#resolveProfile)，它也收 id。它不會整理也不會驗證，需要填好預設值的版本時，請把結果交給 [`normalizeProfile()`](#normalizeProfile)。',
      },
    ],
    examples: [
      {
        code: `import { profileById } from '@openav/midi';

const lpd8 = profileById('lpd8');                    // short name
console.log(lpd8.id, '|', lpd8.name, '|', lpd8.controls.length, 'controls');
console.log(profileById('akai-lpd8') === lpd8);      // true: the same profile by its id
console.log(profileById('no-such-box'));             // null`,
        caption: { en: 'Prints the LPD8\'s id, name and 16 controls, then `true`, then `null`.', zh: '印出 LPD8 的 id、名稱和 16 個控制項，接著 `true`，最後 `null`。' },
      },
    ],
    related: ['PROFILES', 'resolveProfile', 'normalizeProfile', 'findProfile'],
    keywords: { en: ['find profile', 'lookup', 'profile by id', 'short name', 'lpd8', 'minilab3'], zh: ['找設定檔', '查詢', '依 id 找', '短名稱', 'lpd8', 'minilab3'] },
  },

  validateProfile: {
    group: 'midi-io',
    summary: {
      en: 'Checks a controller profile and returns every problem as a sentence; an empty array means it is valid.',
      zh: '檢查一個控制器設定檔，把每個問題都寫成一句話回傳。空陣列表示沒問題。',
    },
    params: [
      { name: 'p', type: 'Object', en: 'A raw profile object (for example parsed from your JSON file).', zh: '原始的設定檔物件（例如從你的 JSON 檔解析出來的）。' },
    ],
    returns: { type: 'string[]', en: 'The problems, in plain words. `[]` is valid.', zh: '用白話寫的問題清單。`[]` 表示合法。' },
    description: [
      {
        en: 'It reports all problems at once, not just the first. It checks: `id` and `short` are lower-case `[a-z0-9_-]` and `short` is not a reserved family name (`cc`, `note`, `bend`, `ch`, `virtual`, `raw`, `clock`), `name` and `kind` exist, a `device` cites at least one source, `match` regexes compile, `face` has a size, every control has a unique non-reserved `id` (see [`RESERVED_IDS`](#RESERVED_IDS)), a known `type` and `msg`, numbers in range and no two controls listening to the same message, encoders name their `relative` mode, and the `sections` (and `portrait`, if given) show every control exactly once, inside the faceplate and within their grid.',
        zh: '它會一次回報所有問題，不是只講第一個。檢查的項目有：`id` 和 `short` 是小寫的 `[a-z0-9_-]`，而且 `short` 不是保留的家族名稱（`cc`、`note`、`bend`、`ch`、`virtual`、`raw`、`clock`）。有 `name` 和 `kind`。`device` 至少註明一個來源。`match` 的正規表示式能編譯。`face` 有尺寸。每個控制項的 `id` 不重複也不是保留字（見 [`RESERVED_IDS`](#RESERVED_IDS)），有認得的 `type` 和 `msg`，數字在範圍內，且沒有兩個控制項聽同一則訊息。旋鈕要寫明 `relative` 模式。`sections`（和有給的話 `portrait`）要讓每個控制項剛好出現一次，位在面板內，並且塞得進它的格子。',
      },
      {
        en: 'This is the check behind `normalizeProfile()` (it throws with this list), `resolveProfile()` and the test that validates every shipped profile. Run it on your own file before you try it in a page.',
        zh: '`normalizeProfile()`（用這份清單丟出錯誤）、`resolveProfile()`，以及驗證所有內建設定檔的測試，背後都是這個檢查。把自己的檔案放進網頁之前，先跑一次。',
      },
    ],
    examples: [
      {
        code: `import { validateProfile, profileById } from '@openav/midi';

console.log(validateProfile(profileById('lpd8')));   // [] : valid

const mine = {
  id: 'My Box', short: 'cc', name: 'My box', kind: 'device', face: { w: 10, h: 10 },
  controls: [{ id: 'k1', type: 'knob', msg: 'cc', cc: 200 }], sections: [],
};
for (const problem of validateProfile(mine)) console.log('-', problem);`,
        caption: { en: 'Prints `[]` for a shipped profile, then a list of what is wrong with the made-up one (bad id, reserved short name, no source, CC out of range, control not shown).', zh: '內建設定檔印出 `[]`，接著列出自己亂寫的那個有什麼問題（id 不合法、短名稱是保留字、沒有來源、CC 超出範圍、控制項沒有被顯示）。' },
      },
    ],
    related: ['normalizeProfile', 'resolveProfile', 'CONTROL_TYPES', 'RESERVED_IDS'],
    keywords: { en: ['validate', 'check profile', 'lint', 'errors', 'profile schema', 'my own controller'], zh: ['驗證', '檢查設定檔', '錯誤', '設定檔格式', '自己的控制器'] },
  },

  normalizeProfile: {
    group: 'midi-io',
    summary: {
      en: 'Validates a profile and returns a filled-in copy with defaults for channel, labels, groups, encoder mode and portrait layout; the input is not changed.',
      zh: '驗證設定檔，回傳一份補好預設值的副本，包含頻道、標籤、分組、旋鈕模式和直立版面，傳進去的物件不會被改動。',
    },
    params: [
      { name: 'raw', type: 'Object', en: 'A raw profile. It must pass [`validateProfile()`](#validateProfile).', zh: '原始設定檔，必須通過 [`validateProfile()`](#validateProfile)。' },
    ],
    returns: { type: 'Object', en: 'A new profile object.', zh: '一個新的設定檔物件。' },
    description: [
      {
        en: 'It throws `invalid MIDI profile "<id>":` followed by every problem when the profile is not valid. Otherwise it fills in: `channel` (1), `learn` (true for a generic layout), `stack` (true), `sources` and `match` (empty lists), and per control `label` (its id), `group` (its type), `ch` (the profile\'s channel), an encoder\'s `relative` (`offset64`), a button\'s `mode` (`momentary`) and a pitch-bend wheel\'s `bipolar` and `spring` (both true). Sections get `label`, `flow` (`row`) and `spans`, and `portrait` is built from the sections, top to bottom, with each section\'s height as its weight when you did not write one.',
        zh: '設定檔不合法時，它會丟出 `invalid MIDI profile "<id>":`，後面接上每一個問題。合法的話會補上：`channel`（1）、`learn`（通用版面為 true）、`stack`（true）、`sources` 和 `match`（空清單），每個控制項的 `label`（用它的 id）、`group`（用它的類型）、`ch`（設定檔的頻道）、旋鈕的 `relative`（`offset64`）、按鈕的 `mode`（`momentary`）、彎音輪的 `bipolar` 和 `spring`（都是 true）。區塊會補上 `label`、`flow`（`row`）和 `spans`，沒寫 `portrait` 的話，會由各區塊從上到下排出來，高度當作權重。',
      },
      {
        en: '[`MidiController`](#MidiController), [`ControllerCanvas`](#ControllerCanvas) and the view all work on the normalized form, which is what `controller.profile` gives you.',
        zh: '[`MidiController`](#MidiController)、[`ControllerCanvas`](#ControllerCanvas) 和畫面元件用的都是整理後的版本，也就是 `controller.profile` 給你的那份。',
      },
    ],
    examples: [
      {
        code: `import { normalizeProfile, profileById } from '@openav/midi';

const raw = profileById('lpd8');
const p = normalizeProfile(raw);

console.log(raw.channel, '->', p.channel);                          // undefined -> 1
console.log(p.controls[0].id, p.controls[0].label, p.controls[0].group);
console.log('learn:', p.learn, '| portrait bands:', p.portrait.length);

try { normalizeProfile({ id: 'X' }); } catch (e) { console.log(e.message); }`,
        caption: { en: 'Prints the defaults it filled in, then the error message listing what is wrong with `{ id: \'X\' }`.', zh: '印出它補上的預設值，再印出 `{ id: \'X\' }` 有哪些問題的錯誤訊息。' },
      },
    ],
    related: ['validateProfile', 'PROFILES', 'MidiController', 'indexProfile'],
    keywords: { en: ['normalize', 'defaults', 'fill in profile', 'portrait', 'prepare profile'], zh: ['整理', '預設值', '補齊設定檔', '直立版面', '準備設定檔'] },
  },

  matchProfile: {
    group: 'midi-io',
    summary: {
      en: 'Finds the device profile that owns a MIDI port name, such as `\'Minilab3 MIDI\'`, by testing each profile\'s `match` patterns.',
      zh: '用各個設定檔的 `match` 規則，找出「這個 MIDI 埠名」屬於哪一台機器，例如 `\'Minilab3 MIDI\'`。',
    },
    params: [
      { name: 'portName', type: 'String', en: 'The name of a MIDI input port.', zh: 'MIDI 輸入埠的名稱。' },
      { name: 'profiles', type: 'Object[]', en: 'The profiles to search, usually [`PROFILES`](#PROFILES).', zh: '要搜尋的設定檔，通常是 [`PROFILES`](#PROFILES)。' },
    ],
    returns: { type: '{ profile, score } | null', en: 'The best match, or `null` when no `device` profile fits.', zh: '最佳的符合者。沒有任何 `device` 設定檔符合時回傳 `null`。' },
    description: [
      {
        en: 'Only `device` profiles are considered (a generic layout never matches by name). A profile matches when one of its `match.ports` regular expressions (case-insensitive) hits the name. The score starts at 1, gains 1 when a `match.prefer` pattern also hits, and loses 2 when a `match.avoid` pattern hits. The highest positive score wins, so a port a device only exposes for something else (`Minilab3 DIN THRU`, `Minilab3 MCU/HUI`) does not match.',
        zh: '只考慮 `device` 設定檔（通用版面永遠不會靠名稱配對）。設定檔的某個 `match.ports` 正規表示式（不分大小寫）對得上名稱，就算符合。分數從 1 開始，`match.prefer` 也對上就加 1，`match.avoid` 對上就扣 2。取最高的正分，所以機器為了別的用途開出來的埠（`Minilab3 DIN THRU`、`Minilab3 MCU/HUI`）不會被配對。',
      },
      {
        en: 'This is how [`MidiControllers`](#MidiControllers) turns a plugged-in device into the right on-screen controller. When a device exposes several ports, [`pickPort()`](#pickPort) chooses which one to listen to.',
        zh: '[`MidiControllers`](#MidiControllers) 就是靠它把接上的機器變成正確的螢幕控制器。一台機器開出好幾個埠時，由 [`pickPort()`](#pickPort) 決定聽哪一個。',
      },
    ],
    examples: [
      {
        code: `import { matchProfile, PROFILES } from '@openav/midi';

for (const name of ['LPD8 mk2', 'Minilab3 MIDI', 'Minilab3 DIN THRU', 'Some Unknown Synth']) {
  const m = matchProfile(name, PROFILES);
  console.log(name, '->', m ? m.profile.id + ' (score ' + m.score + ')' : null);
}`,
        caption: { en: 'Prints `akai-lpd8 (score 1)`, `arturia-minilab3 (score 2)`, then `null` for the DIN THRU port and for an unknown synth.', zh: '印出 `akai-lpd8 (score 1)`、`arturia-minilab3 (score 2)`，DIN THRU 埠和不認識的合成器則是 `null`。' },
      },
    ],
    related: ['pickPort', 'MidiControllers', 'PROFILES'],
    keywords: { en: ['match port', 'device detection', 'auto detect', 'port name', 'recognise controller'], zh: ['配對埠', '偵測裝置', '自動辨識', '埠名', '認出控制器'] },
  },

  pickPort: {
    group: 'midi-io',
    summary: {
      en: 'Of several ports one device exposes ("Minilab3 MIDI", "Minilab3 DIN THRU", "Minilab3 MCU/HUI"), picks the one to listen to.',
      zh: '一台機器開出好幾個埠（「Minilab3 MIDI」、「Minilab3 DIN THRU」、「Minilab3 MCU/HUI」）時，挑出要聽的那一個。',
    },
    params: [
      { name: 'ports', type: 'Object[]', en: 'Candidate ports: objects with a `name`.', zh: '候選的埠：有 `name` 的物件。' },
      { name: 'profile', type: 'Object', en: 'The device\'s profile (its `match.ports`, `prefer` and `avoid`).', zh: '那台機器的設定檔（用它的 `match.ports`、`prefer`、`avoid`）。' },
    ],
    returns: { type: 'Object | null', en: 'The best port, or `null` when none of them fits the profile.', zh: '最合適的埠。沒有任何一個符合設定檔時回傳 `null`。' },
    description: [
      {
        en: 'A port scores 1 when its name matches one of the profile\'s `match.ports` (otherwise it is out), plus 1 for a `prefer` match and minus 2 for an `avoid` match. Only positive scores count and the highest wins. It is the second half of device detection after [`matchProfile()`](#matchProfile).',
        zh: '埠名符合設定檔的某個 `match.ports` 得 1 分（不符合就出局），符合 `prefer` 加 1 分，符合 `avoid` 扣 2 分。只算正分，最高分勝出。它是 [`matchProfile()`](#matchProfile) 之後裝置偵測的第二步。',
      },
    ],
    examples: [
      {
        code: `import { pickPort, profileById } from '@openav/midi';

const ports = [{ name: 'Minilab3 DIN THRU' }, { name: 'Minilab3 MIDI' }, { name: 'Minilab3 MCU/HUI' }];
console.log(pickPort(ports, profileById('minilab3')).name);   // Minilab3 MIDI
console.log(pickPort([{ name: 'Other' }], profileById('minilab3')));   // null`,
        caption: { en: 'Prints `Minilab3 MIDI`, then `null` when no port belongs to the device.', zh: '印出 `Minilab3 MIDI`，埠都不屬於那台機器時印出 `null`。' },
      },
    ],
    related: ['matchProfile', 'MidiControllers'],
    keywords: { en: ['pick port', 'multiple ports', 'din thru', 'mcu', 'which port'], zh: ['挑埠', '多個埠', 'din thru', 'mcu', '聽哪個埠'] },
  },

  profileSignals: {
    group: 'midi-io',
    summary: {
      en: 'Lists every signal name a profile can publish under its own namespace (`midi/lpd8/…` for the LPD8), for docs, tests and mapping screens.',
      zh: '列出一份設定檔會發佈在它自己命名空間底下的所有訊號名稱（LPD8 是 `midi/lpd8/…`），給文件、測試和映射畫面用。',
    },
    params: [
      { name: 'p', type: 'Object', en: 'A profile (its `short` and `controls` are read).', zh: '設定檔（會讀它的 `short` 和 `controls`）。' },
    ],
    returns: { type: 'string[]', en: 'Signal names, starting with `midi/<short>/last`.', zh: '訊號名稱，第一個是 `midi/<short>/last`。' },
    description: [
      {
        en: 'For each control: `midi/<short>/<id>` and `/raw`; an encoder adds `/delta`; a pad adds `/hit` (and `/pressure` when it has aftertouch). A keys control has only `/on`, `/off` and one `midi/<short>/n<note>` per key. These are the names a [`MidiController`](#MidiController) publishes, so a route from `controllerRoutes()` or a `signals.on()` can use them.',
        zh: '每個控制項有 `midi/<short>/<id>` 和 `/raw`。旋鈕多一個 `/delta`，打擊墊多一個 `/hit`（有觸後的話再加 `/pressure`）。琴鍵控制項只有 `/on`、`/off`，以及每個琴鍵一個 `midi/<short>/n<note>`。這些就是 [`MidiController`](#MidiController) 發佈的名稱，所以 `controllerRoutes()` 的路由或 `signals.on()` 都能用。',
      },
    ],
    examples: [
      {
        code: `import { profileSignals, profileById } from '@openav/midi';

const names = profileSignals(profileById('lpd8'));
console.log(names.length, 'signals');
console.log(names.slice(0, 5));`,
        caption: { en: 'Prints how many signals the LPD8 can publish and the first five: `midi/lpd8/last`, then pad 1\'s value, raw value and hit, then pad 2.', zh: '印出 LPD8 能發佈幾個訊號和前五個：`midi/lpd8/last`，然後是 pad 1 的值、原始值、hit，接著是 pad 2。' },
      },
    ],
    related: ['controllerRoutes', 'MidiController', 'groupsOf'],
    keywords: { en: ['signal names', 'midi/lpd8', 'list signals', 'what does it publish'], zh: ['訊號名稱', '列出訊號', '會發佈什麼'] },
  },

  groupsOf: {
    group: 'midi-io',
    summary: {
      en: 'Groups a profile\'s controls by their `group` (`knob`, `pad`, `fader` …), returning `{ group: [control ids] }`.',
      zh: '依 `group`（`knob`、`pad`、`fader` …）把設定檔的控制項分組，回傳 `{ group: [控制項 id] }`。',
    },
    params: [
      { name: 'p', type: 'Object', en: 'A normalized profile, so every control has its `group` filled in.', zh: '整理過的設定檔，這樣每個控制項才有 `group`。' },
    ],
    returns: { type: 'Object', en: 'An object of arrays of control ids.', zh: '由控制項 id 陣列組成的物件。' },
    description: [
      {
        en: 'The groups follow the TouchDesigner tool\'s out CHOPs (`out_knob`, `out_slider`, `out_pad` …). A control gets its type as group unless the profile gives another. [`MidiController`](#MidiController) has a method of the same name that returns the current values instead of the ids.',
        zh: '分組方式跟 TouchDesigner 工具的輸出 CHOP（`out_knob`、`out_slider`、`out_pad` …）一致。控制項沒特別指定的話，就用它的類型當分組。[`MidiController`](#MidiController) 有個同名的方法，回傳的是目前的數值，不是 id。',
      },
    ],
    examples: [
      {
        code: `import { groupsOf, normalizeProfile, profileById } from '@openav/midi';

const groups = groupsOf(normalizeProfile(profileById('lpd8')));
console.log(Object.keys(groups));   // [ 'pad', 'knob' ]
console.log(groups.knob);           // [ 'k1', 'k2', ... 'k8' ]`,
        caption: { en: 'Prints the group names and then the eight knob ids.', zh: '印出分組名稱，再印出八個旋鈕的 id。' },
      },
    ],
    related: ['profileSignals', 'normalizeProfile', 'MidiController'],
    keywords: { en: ['group controls', 'knobs list', 'touchdesigner chop', 'out_knob'], zh: ['控制項分組', '旋鈕清單', 'touchdesigner chop', 'out_knob'] },
  },

  indexProfile: {
    group: 'midi-io',
    summary: {
      en: 'Builds the lookup from a MIDI message to the control it moves: `"cc:1:74"` maps to the knob listening for CC 74 on channel 1.',
      zh: '建立「MIDI 訊息 → 它會推動的控制項」的查詢表：`"cc:1:74"` 對應到聽頻道 1 的 CC 74 的那顆旋鈕。',
    },
    params: [
      { name: 'p', type: 'Object', en: 'A normalized profile (each control needs its `ch`).', zh: '整理過的設定檔（每個控制項都要有 `ch`）。' },
    ],
    returns: { type: 'Map<string, { control, note? }[]>', en: 'The keys are `cc:<ch>:<cc>`, `note:<ch>:<note>`, `polyat:<ch>:<note>`, `pitchbend:<ch>`, `chanat:<ch>`, `program:<ch>`. A keys control gets one entry per note of its range.', zh: '鍵的格式是 `cc:<ch>:<cc>`、`note:<ch>:<note>`、`polyat:<ch>:<note>`、`pitchbend:<ch>`、`chanat:<ch>`、`program:<ch>`。琴鍵控制項的音域裡每個音都有一筆。' },
    description: [
      {
        en: 'This is how [`MidiController`](#MidiController) decides which control a message belongs to. Use it to build your own router. Each value is a list because a message can move more than one control.',
        zh: '[`MidiController`](#MidiController) 就是用它判斷一則訊息屬於哪個控制項。要自己做路由時可以拿來用。每個值都是清單，因為一則訊息可能推動不只一個控制項。',
      },
    ],
    examples: [
      {
        code: `import { indexProfile, normalizeProfile, profileById } from '@openav/midi';

const index = indexProfile(normalizeProfile(profileById('lpd8')));
console.log(index.get('cc:1:70').map((hit) => hit.control.id));     // [ 'k1' ]
console.log(index.get('note:10:36').map((hit) => hit.control.id));  // [ 'pad1' ]
console.log(index.get('cc:1:99'));                                  // undefined`,
        caption: { en: 'Prints `[\'k1\']` for CC 70, `[\'pad1\']` for note 36 on channel 10, and `undefined` for a message the device does not send.', zh: '印出 CC 70 對應的 `[\'k1\']`、頻道 10 音符 36 對應的 `[\'pad1\']`，以及這台機器不會送的訊息所對應的 `undefined`。' },
      },
    ],
    related: ['normalizeProfile', 'MidiController'],
    keywords: { en: ['index', 'lookup', 'message to control', 'route message', 'cc:1:74'], zh: ['索引', '查詢表', '訊息對應控制項', '路由', 'cc:1:74'] },
  },

  CONTROL_TYPES: {
    group: 'midi-io',
    summary: {
      en: 'The kinds of control a profile may contain: `knob`, `encoder`, `fader`, `pad`, `button`, `keys`, `wheel`, `strip`.',
      zh: '設定檔裡可以出現的控制項種類：`knob`、`encoder`、`fader`、`pad`、`button`、`keys`、`wheel`、`strip`。',
    },
    value: {
      type: 'string[]', range: '[\'knob\', \'encoder\', \'fader\', \'pad\', \'button\', \'keys\', \'wheel\', \'strip\']',
      en: 'A plain array. A control\'s `type` must be one of these or [`validateProfile()`](#validateProfile) reports it.',
      zh: '一個普通陣列。控制項的 `type` 必須是其中之一，否則 [`validateProfile()`](#validateProfile) 會回報。',
    },
    description: [
      {
        en: 'What each sends: `knob` and `fader` a CC (0..1); `encoder` a CC that is either relative (position plus a `/delta` signal) or absolute; `pad` a note (velocity while held, with a `/hit` pulse) or a CC; `button` a note or CC, momentary or toggle; `keys` a range of notes; `wheel` and `strip` a CC or pitch bend, optionally bipolar and spring-loaded.',
        zh: '各自送什麼：`knob` 和 `fader` 送 CC（0..1）。`encoder` 送 CC，可以是相對（位置加上 `/delta` 訊號）或絕對。`pad` 送音符（按著時是力度，並有 `/hit` 脈衝）或 CC。`button` 送音符或 CC，可以是瞬間或切換。`keys` 是一段音域的音符。`wheel` 和 `strip` 送 CC 或彎音，可以是雙向，也可以帶彈簧。',
      },
    ],
    examples: [
      {
        code: `import { CONTROL_TYPES, PROFILES } from '@openav/midi';

const count = {};
for (const p of PROFILES) for (const c of p.controls) count[c.type] = (count[c.type] || 0) + 1;
console.log(CONTROL_TYPES.map((t) => t + ': ' + (count[t] || 0)).join(', '));`,
        caption: { en: 'Prints how many controls of each type the shipped profiles hold, in the order of the list.', zh: '依清單順序，印出內建設定檔裡每種控制項各有幾個。' },
      },
    ],
    related: ['validateProfile', 'RESERVED_IDS', 'normalizeProfile'],
    keywords: { en: ['control types', 'knob', 'fader', 'pad', 'encoder', 'strip', 'wheel', 'button', 'keys'], zh: ['控制項類型', '旋鈕', '推桿', '打擊墊', '編碼器', '觸控條', '彎音輪', '按鈕', '琴鍵'] },
  },

  RESERVED_IDS: {
    group: 'midi-io',
    summary: {
      en: 'Control ids a profile may not use, because they are signal suffixes: `last`, `raw`, `delta`, `hit`, `on`, `off`, `pressure`.',
      zh: '設定檔裡不能拿來當控制項 id 的名字，因為它們是訊號的後綴：`last`、`raw`、`delta`、`hit`、`on`、`off`、`pressure`。',
    },
    value: {
      type: 'string[]', range: '[\'last\', \'raw\', \'delta\', \'hit\', \'on\', \'off\', \'pressure\']',
      en: 'A plain array. `last` is the signal `midi/<short>/last`, and the others are the suffixes a control\'s signals use (`/raw`, `/delta`, `/hit`, `/on`, `/off`, `/pressure`), so [`validateProfile()`](#validateProfile) rejects them as control ids.',
      zh: '一個普通陣列。`last` 是訊號 `midi/<short>/last` 的名字，其他的是控制項訊號會用的後綴（`/raw`、`/delta`、`/hit`、`/on`、`/off`、`/pressure`），所以 [`validateProfile()`](#validateProfile) 不接受它們當控制項 id。',
    },
    description: [
      {
        en: 'A profile\'s `short` has a separate reserved list (`cc`, `note`, `bend`, `ch`, `virtual`, `raw`, `clock`) because those are the generic `midi/…` families. Both are checked by `validateProfile()`.',
        zh: '設定檔的 `short` 另有一份保留字清單（`cc`、`note`、`bend`、`ch`、`virtual`、`raw`、`clock`），因為它們是通用的 `midi/…` 家族名稱。兩份都由 `validateProfile()` 檢查。',
      },
    ],
    examples: [
      {
        code: `import { RESERVED_IDS, validateProfile, profileById } from '@openav/midi';

console.log(RESERVED_IDS);
const bad = structuredClone(profileById('lpd8'));
bad.controls[0].id = 'hit';
console.log(validateProfile(bad).filter((p) => p.includes('reserved')));`,
        caption: { en: 'Prints the list, then the problem raised when a control is renamed to `hit`.', zh: '印出清單，再印出把某個控制項改名為 `hit` 時回報的問題。' },
      },
    ],
    related: ['validateProfile', 'CONTROL_TYPES'],
    keywords: { en: ['reserved names', 'forbidden id', 'signal suffix'], zh: ['保留字', '不能用的 id', '訊號後綴'] },
  },

  loadProfile: {
    group: 'midi-io',
    summary: {
      en: 'Loads a controller profile by id, short name or URL (a JSON file anywhere CORS allows), checking any file or object you give it; returns a promise.',
      zh: '用 id、短名稱或網址（任何 CORS 允許的 JSON 檔）載入控制器設定檔，你給的檔案或物件會先檢查，回傳 promise。',
    },
    params: [
      { name: 'ref', type: 'String | Object', en: 'An id (`\'akai-lpd8\'`), a short name (`\'lpd8\'`), a URL or path to a profile JSON, or a profile object.', zh: 'id（`\'akai-lpd8\'`）、短名稱（`\'lpd8\'`）、設定檔 JSON 的網址或路徑，或是設定檔物件。' },
      { name: 'o', type: 'Object', en: 'Options passed on to [`resolveProfile()`](#resolveProfile): `fetch`, `base`, and `profiles` (default: every shipped profile). `base` defaults to the page\'s `document.baseURI`, so a relative path is read from the page.', zh: '轉交給 [`resolveProfile()`](#resolveProfile) 的選項：`fetch`、`base`，以及 `profiles`（預設是所有內建設定檔）。`base` 預設是頁面的 `document.baseURI`，所以相對路徑會以頁面為準。' },
    ],
    returns: { type: 'Promise<Object>', en: 'The raw profile. Rejects with every problem listed when a file or object is invalid, or with `unknown MIDI profile "x" (known: …)` when an id does not exist.', zh: '原始的設定檔。檔案或物件不合法時 reject，並列出所有問題。id 不存在則 reject 為 `unknown MIDI profile "x" (known: …)`。' },
    description: [
      {
        en: 'It is [`resolveProfile()`](#resolveProfile) with the shipped profiles and the page\'s base URL filled in. `<oav-controller profile="./my-device.json">` calls it to read your file. A bad file says why instead of drawing nothing.',
        zh: '它就是 [`resolveProfile()`](#resolveProfile)，只是已經幫你帶入內建設定檔和頁面的基底網址。`<oav-controller profile="./my-device.json">` 就是呼叫它來讀你的檔案。檔案有問題時會說明原因，而不是什麼都不畫。',
      },
    ],
    examples: [
      {
        code: `import { loadProfile } from '@openav/midi';

const lpd8 = await loadProfile('lpd8');
console.log(lpd8.id, lpd8.controls.length);

try { await loadProfile('no-such-box'); } catch (e) { console.log(e.message.slice(0, 70) + ' …'); }`,
        caption: { en: 'Prints `akai-lpd8 16`, then the beginning of the error for an id that does not exist (it goes on to list every known id).', zh: '印出 `akai-lpd8 16`，再印出不存在的 id 所產生的錯誤訊息開頭（後面還會列出所有認得的 id）。' },
      },
      {
        code: `import { loadProfile, profileById } from '@openav/midi';

// a profile file of your own; here a fake fetch stands in for the network
const mine = { ...structuredClone(profileById('lpd8')), id: 'my-lpd8', short: 'mylpd8', name: 'My LPD8' };
const fetch = async (url) => { console.log('fetching', url); return { ok: true, json: async () => mine }; };

const p = await loadProfile('./profiles/my-lpd8.json', { fetch, base: 'https://example.com/show/' });
console.log(p.name);`,
        caption: { en: 'Prints the full URL it fetched (`https://example.com/show/profiles/my-lpd8.json`), then `My LPD8`.', zh: '印出它抓取的完整網址（`https://example.com/show/profiles/my-lpd8.json`），再印出 `My LPD8`。' },
      },
    ],
    related: ['resolveProfile', 'profileById', 'validateProfile', 'createController'],
    keywords: { en: ['load profile', 'profile url', 'custom controller', 'fetch json', 'my device'], zh: ['載入設定檔', '設定檔網址', '自訂控制器', '抓取 json', '我的機器'] },
  },

  resolveProfile: {
    group: 'midi-io',
    summary: {
      en: 'Turns a profile object, an id or short name, or a URL to a profile JSON into a profile; an object or a file that is not valid is rejected with every problem listed.',
      zh: '把設定檔物件、id 或短名稱，或指向設定檔 JSON 的網址，變成一份設定檔，物件或檔案不合法就 reject，並列出所有問題。',
    },
    params: [
      { name: 'ref', type: 'String | Object', en: 'A profile object (checked and returned), an id or short name (looked up in `profiles`), or a URL (fetched). A URL is a string starting with `http:`, `https:`, `blob:`, `data:`, `/`, `./` or `../`, or ending in `.json`.', zh: '設定檔物件（檢查後直接回傳）、id 或短名稱（在 `profiles` 裡查），或網址（會去抓）。網址指的是以 `http:`、`https:`、`blob:`、`data:`、`/`、`./`、`../` 開頭，或以 `.json` 結尾的字串。' },
      { name: 'profiles', type: 'Object[]', en: 'Where ids are looked up. The default is an empty list, so pass [`PROFILES`](#PROFILES) (or use [`loadProfile()`](#loadProfile), which does).', zh: '用來查 id 的清單。預設是空的，所以要傳入 [`PROFILES`](#PROFILES)（或改用已經幫你傳好的 [`loadProfile()`](#loadProfile)）。' },
      { name: 'fetch', type: 'Function', en: 'Replaces `fetch`, for tests or special loading. It must return `{ ok, status?, json() }`.', zh: '取代 `fetch`，給測試或特殊的載入方式用。必須回傳 `{ ok, status?, json() }`。' },
      { name: 'base', type: 'String', en: 'A base URL that a relative path is resolved against.', zh: '解析相對路徑用的基底網址。' },
    ],
    returns: { type: 'Promise<Object>', en: 'The raw profile (not normalized).', zh: '原始的設定檔（沒有整理過）。' },
    description: [
      {
        en: 'Errors are written for a person: `no MIDI profile given`, `unknown MIDI profile "x" (known: …)`, `could not load MIDI profile <url> (404)` and `invalid MIDI profile (<where>):` followed by the list from [`validateProfile()`](#validateProfile).',
        zh: '錯誤訊息是寫給人看的：`no MIDI profile given`、`unknown MIDI profile "x" (known: …)`、`could not load MIDI profile <url> (404)`，以及 `invalid MIDI profile (<where>):` 後面接上 [`validateProfile()`](#validateProfile) 的清單。',
      },
    ],
    examples: [
      {
        code: `import { resolveProfile, PROFILES, profileById } from '@openav/midi';

console.log((await resolveProfile('nano2', { profiles: PROFILES })).id);   // korg-nanokontrol2
console.log((await resolveProfile(profileById('lpd8'))).id);                 // an object is checked and returned

try { await resolveProfile({ id: 'Bad' }); } catch (e) { console.log(e.message.split('\\n').slice(0, 3).join(' | ')); }`,
        caption: { en: 'Prints `korg-nanokontrol2`, `akai-lpd8`, then the error header and the first two problems of an invalid object.', zh: '印出 `korg-nanokontrol2`、`akai-lpd8`，再印出一個不合法物件的錯誤標題和前兩個問題。' },
      },
    ],
    related: ['loadProfile', 'findProfile', 'isProfileUrl', 'validateProfile'],
    keywords: { en: ['resolve profile', 'profile from url', 'profile json', 'fetch profile', 'async'], zh: ['解析設定檔', '從網址取得設定檔', '設定檔 json', '抓取設定檔', '非同步'] },
  },

  findProfile: {
    group: 'midi-io',
    summary: {
      en: 'Finds a profile in a list by id or short name, or returns `null`; no validation, no loading.',
      zh: '在清單裡用 id 或短名稱找設定檔，找不到回傳 `null`，不驗證也不載入。',
    },
    params: [
      { name: 'ref', type: 'String', en: 'A profile `id` or `short` name.', zh: '設定檔的 `id` 或 `short` 短名稱。' },
      { name: 'profiles', type: 'Object[]', en: 'The list to search (required here, unlike [`profileById()`](#profileById), which uses the shipped ones).', zh: '要搜尋的清單（這裡一定要給，不像 [`profileById()`](#profileById) 固定用內建的）。' },
    ],
    returns: { type: 'Object | null', en: 'The profile in the list.', zh: '清單裡的那份設定檔。' },
    description: [
      {
        en: 'Use it when you hold your own list, for example the profiles a picker offers (`controller.controllers.profiles`), and want the same id-or-short lookup the element uses.',
        zh: '手上有自己的清單時用，例如選單提供的設定檔（`controller.controllers.profiles`），而你想用跟元素相同的「id 或短名稱」查法。',
      },
    ],
    examples: [
      {
        code: `import { PROFILES } from '@openav/midi';
import { findProfile } from '@openav/midi/embed';

console.log(findProfile('lpd8', PROFILES).id);         // akai-lpd8
console.log(findProfile('akai-lpd8', PROFILES).short); // lpd8
console.log(findProfile('nope', PROFILES));            // null`,
        caption: { en: 'Prints `akai-lpd8`, `lpd8` and `null`.', zh: '印出 `akai-lpd8`、`lpd8` 和 `null`。' },
      },
    ],
    related: ['profileById', 'resolveProfile'],
    keywords: { en: ['find profile', 'lookup in list', 'short name'], zh: ['找設定檔', '清單查詢', '短名稱'] },
  },

  isProfileUrl: {
    group: 'midi-io',
    summary: {
      en: 'Tells a URL to a profile file apart from a profile id: `true` for `./pads.json`, `https://…`, `/p/x`, `false` for `\'akai-lpd8\'`.',
      zh: '分辨「指向設定檔的網址」和「設定檔 id」：`./pads.json`、`https://…`、`/p/x` 回傳 `true`，`\'akai-lpd8\'` 回傳 `false`。',
    },
    params: [
      { name: 'ref', type: 'any', en: 'What the page or attribute gave. Anything that is not a string is `false`.', zh: '頁面或屬性給的內容。不是字串一律是 `false`。' },
    ],
    returns: { type: 'Boolean', en: '`true` when the string starts with `http:`, `https:`, `blob:` or `data:`, starts with `/`, `./` or `../`, or ends in `.json` (optionally followed by `?…` or `#…`).', zh: '字串以 `http:`、`https:`、`blob:`、`data:` 開頭，或以 `/`、`./`、`../` 開頭，或以 `.json` 結尾（後面可接 `?…` 或 `#…`）時為 `true`。' },
    description: [
      {
        en: 'It is the test [`resolveProfile()`](#resolveProfile) uses to decide between looking an id up and fetching a file. A bare name that happens to end in `.json` also counts as a URL.',
        zh: '[`resolveProfile()`](#resolveProfile) 就是用它決定要「查 id」還是「抓檔案」。剛好以 `.json` 結尾的單純名稱也會被當成網址。',
      },
    ],
    examples: [
      {
        code: `import { isProfileUrl } from '@openav/midi/embed';

for (const ref of ['akai-lpd8', './pads.json', 'https://x.org/my.json', '/p/x', 'my.json']) {
  console.log(ref, isProfileUrl(ref));
}`,
        caption: { en: 'Prints `false` for the id and `true` for the other four.', zh: 'id 印出 `false`，其他四個印出 `true`。' },
      },
    ],
    related: ['resolveProfile', 'loadProfile'],
    keywords: { en: ['url or id', 'profile reference', 'is url'], zh: ['網址或 id', '設定檔參照', '是不是網址'] },
  },

  withChannel: {
    group: 'midi-io',
    summary: {
      en: 'Returns a copy of a profile with every control moved to another MIDI channel, for a unit that is set to a channel other than the profile\'s.',
      zh: '回傳一份設定檔的副本，所有控制項都改到另一個 MIDI 頻道，給「機器設定的頻道跟設定檔不同」的情況用。',
    },
    params: [
      { name: 'profile', type: 'Object', en: 'A profile.', zh: '設定檔。' },
      { name: 'ch', type: 'Number', en: 'The channel, 1..16. A falsy value (`0`, `null`) returns the same profile object untouched.', zh: '頻道，1..16。給假值（`0`、`null`）就原封不動回傳同一個設定檔物件。' },
    ],
    returns: { type: 'Object', en: 'A deep copy, validated, with `channel` and every control\'s `ch` set. The original is not changed.', zh: '深層複製的副本，已通過驗證，`channel` 和每個控制項的 `ch` 都改好了。原本的不會被改動。' },
    description: [
      {
        en: 'Explicit LED channels (`led.ch`) stay as they are, since LED feedback may use a different channel from the control. This is what the `channel` option of [`createController()`](#createController) and the `channel` attribute of `<oav-controller>` call.',
        zh: '明確寫出的 LED 頻道（`led.ch`）會維持原樣，因為 LED 回饋用的頻道可能跟控制項不同。[`createController()`](#createController) 的 `channel` 選項和 `<oav-controller>` 的 `channel` 屬性，呼叫的就是它。',
      },
    ],
    examples: [
      {
        code: `import { profileById } from '@openav/midi';
import { withChannel } from '@openav/midi/embed';

const lpd8 = profileById('lpd8');
const moved = withChannel(lpd8, 3);

console.log(lpd8.controls[0].ch, '->', moved.controls[0].ch);          // 10 -> 3
console.log(moved.controls.every((c) => c.ch === 3), moved.channel);   // true 3`,
        caption: { en: 'Prints `10 -> 3`: the shipped profile keeps its channel, the copy has every control on channel 3.', zh: '印出 `10 -> 3`：內建的設定檔頻道不變，副本的每個控制項都在頻道 3。' },
      },
    ],
    related: ['createController', 'OavController', 'normalizeProfile'],
    keywords: { en: ['channel', 'change channel', 'midi channel override', 'copy profile'], zh: ['頻道', '改頻道', '覆寫頻道', '複製設定檔'] },
  },

  DEFAULT_PROFILE: {
    group: 'midi-io',
    summary: {
      en: 'The profile id used when none is given: `\'arturia-minilab3\'`.',
      zh: '沒有指定時使用的設定檔 id：`\'arturia-minilab3\'`。',
    },
    value: {
      type: 'String', range: '\'arturia-minilab3\'',
      en: 'A constant. `<oav-controller>` without a `profile` attribute and the iframe embed without `?profile=` show this device.',
      zh: '常數。沒有 `profile` 屬性的 `<oav-controller>`，和沒有 `?profile=` 的 iframe 嵌入，都會顯示這台機器。',
    },
    description: [
      {
        en: '[`parseEmbedOptions()`](#parseEmbedOptions) fills `profile` with it. [`createController()`](#createController) and [`ControllerCanvas`](#ControllerCanvas) have the same id as their own default.',
        zh: '[`parseEmbedOptions()`](#parseEmbedOptions) 會用它填入 `profile`。[`createController()`](#createController) 和 [`ControllerCanvas`](#ControllerCanvas) 自己的預設值也是同一個 id。',
      },
    ],
    examples: [
      {
        code: `import { DEFAULT_PROFILE, parseEmbedOptions } from '@openav/midi/embed';

console.log(DEFAULT_PROFILE);
console.log(parseEmbedOptions({}).profile === DEFAULT_PROFILE);   // true`,
        caption: { en: 'Prints `arturia-minilab3`, then `true`.', zh: '印出 `arturia-minilab3`，再印出 `true`。' },
      },
    ],
    related: ['parseEmbedOptions', 'createController'],
    keywords: { en: ['default profile', 'minilab3', 'default controller'], zh: ['預設設定檔', 'minilab3', '預設控制器'] },
  },

  findPort: {
    group: 'midi-io',
    summary: {
      en: 'Finds a MIDI port by name: a `/regex/flags`, then the exact name, then a case-insensitive substring; `null` when nothing matches.',
      zh: '用名稱找 MIDI 埠：先試 `/regex/flags`，再試完整名稱，最後試不分大小寫的子字串，都找不到就回傳 `null`。',
    },
    params: [
      { name: 'ports', type: 'Object[]', en: 'Ports with a `name` (an array, such as `midi.outputs`).', zh: '有 `name` 的埠（陣列，例如 `midi.outputs`）。' },
      { name: 'query', type: 'String', en: 'A name, a part of a name (`\'IAC\'`, `\'loopMIDI\'`), or `\'/^mini/\'`. Flags after the closing slash are used; without flags the regex is case-insensitive.', zh: '名稱、名稱的一部分（`\'IAC\'`、`\'loopMIDI\'`），或 `\'/^mini/\'`。結尾斜線後面的旗標會被採用，沒寫旗標的話正規表示式不分大小寫。' },
    ],
    returns: { type: 'Object | null', en: 'The first matching port. A broken regex finds nothing instead of throwing.', zh: '第一個符合的埠。壞掉的正規表示式只會找不到，不會丟出錯誤。' },
    description: [
      {
        en: 'This is how the `midi-out` attribute, the `hardware` attribute\'s port name and [`createController()`](#createController)\'s `setOutput(query)` read what you typed.',
        zh: '`midi-out` 屬性、`hardware` 屬性裡的埠名，以及 [`createController()`](#createController) 的 `setOutput(query)`，都是用它來理解你打的字。',
      },
    ],
    examples: [
      {
        code: `import { findPort } from '@openav/midi';

const ports = [{ name: 'IAC Driver Bus 1' }, { name: 'loopMIDI Port' }, { name: 'Minilab3 MIDI' }];
console.log(findPort(ports, 'iac').name);        // IAC Driver Bus 1  (substring, any case)
console.log(findPort(ports, '/^mini/').name);    // Minilab3 MIDI
console.log(findPort(ports, 'nanoKONTROL'));     // null
console.log(findPort(ports, '/[/'));             // null: a broken regex finds nothing`,
        caption: { en: 'Prints `IAC Driver Bus 1`, `Minilab3 MIDI`, `null`, `null`.', zh: '印出 `IAC Driver Bus 1`、`Minilab3 MIDI`、`null`、`null`。' },
      },
    ],
    related: ['pickOutput', 'Midi', 'createController'],
    keywords: { en: ['find port', 'port by name', 'regex', 'iac', 'loopmidi', 'midi-out'], zh: ['找埠', '依名稱找埠', '正規表示式', 'iac', 'loopmidi', 'midi-out'] },
  },

  // ================================================================== the controller model, ports <-> profiles, virtual Web MIDI

  MidiController: {
    group: 'midi-io',
    summary: {
      en: 'One MIDI controller (a profile) as a live model: MIDI bytes go in, control values and signals come out, and a hand on screen sends the bytes the device would.',
      zh: '把一台 MIDI 控制器（一份設定檔）做成活的模型：MIDI 位元組進去，控制項的值和訊號出來，而螢幕上的手會送出跟實體機器一樣的位元組。',
    },
    params: [
      { name: 'profile', type: 'Object', en: 'A raw or normalized profile (see [`PROFILES`](#PROFILES)). It is copied, so changing the object later does nothing.', zh: '原始或整理過的設定檔（見 [`PROFILES`](#PROFILES)）。會被複製一份，之後改動原物件不會有影響。' },
      { name: 'signals', type: 'Signals | null', en: 'Publish the controller\'s signals here.', zh: '把控制器的訊號發佈到這裡。' },
      { name: 'sink', type: 'Function | null', en: '`(name, value, { pulse, min, max }) => …` called for each signal instead of `signals` (a relay, a phone). When both are given, `sink` wins.', zh: '每個訊號改成呼叫 `(name, value, { pulse, min, max }) => …`，不走 `signals`（例如中繼、手機）。兩個都給的話以 `sink` 為準。' },
      { name: 'short', type: 'String | null', en: 'Overrides the signal namespace, so two controllers of the same device publish under different names.', zh: '覆寫訊號的命名空間，這樣兩台同型號的控制器就能用不同名稱發佈。' },
      { name: 'onLed', type: 'Function | null', en: '`(bytes) => …` called with the MIDI that lights or dims a control\'s LED on the hardware, whenever its state changes.', zh: '控制項狀態改變時，用「讓硬體上 LED 亮起或變暗的 MIDI」呼叫 `(bytes) => …`。' },
    ],
    description: [
      {
        en: 'The one idea: the on-screen controller and the hardware speak the SAME language, MIDI bytes. `setValue()`, `press()` and the other virtual hands encode the exact message the real control would send and feed it through `ingest()`, the same door the hardware uses. So a virtual knob and a real one can never drift apart, and what your work receives is identical whichever hand moved it. Pass the bytes of a real device to `ingest(bytes, { source: \'hw\' })`.',
        zh: '核心想法：螢幕上的控制器和硬體說的是「同一種語言」，MIDI 位元組。`setValue()`、`press()` 等虛擬的手，會編出真實控制項會送的那則訊息，再從 `ingest()` 送進去，也就是硬體走的同一個入口。所以虛擬旋鈕和真的旋鈕不會漂開，作品收到的東西也一樣，不論是哪隻手動的。真實機器的位元組請用 `ingest(bytes, { source: \'hw\' })` 餵進去。',
      },
      {
        en: 'The `source` of a message decides what is published, so every event is published exactly once. `\'hw\'`: the device lives here, and [`Midi`](#Midi) already published the generic `midi/…` names, so only `midi/<short>/…` is added. `\'ui\'`: a virtual hand, so it publishes `midi/<short>/…`, the generic names, and `midi/virtual` (the raw bytes, for Web MIDI shims). `\'mirror\'`: someone else published it (a phone, feedback), so only the state and the views move.',
        zh: '訊息的 `source` 決定發佈什麼，讓每個事件只發佈一次。`\'hw\'`：機器就在這裡，[`Midi`](#Midi) 已經發佈過通用的 `midi/…` 名稱，所以只多發佈 `midi/<short>/…`。`\'ui\'`：虛擬的手，所以會發佈 `midi/<short>/…`、通用名稱，以及 `midi/virtual`（原始位元組，給 Web MIDI 轉接用）。`\'mirror\'`：別人已經發佈過了（手機、回饋），所以只更新狀態和畫面。',
      },
      {
        en: 'Signals per control (values are normalised, `raw` keeps the MIDI number): `midi/<short>/<id>` (0..1, −1..1 for a bipolar wheel) and `/raw`; an encoder\'s `/delta`; a pad\'s `/hit` pulse `{ vel, velocity, note, ch }` and `/pressure`; a keys control\'s `/on` and `/off` pulses and `midi/<short>/n<note>` while a key is held; and `midi/<short>/last`, a pulse saying what was touched last. [`profileSignals()`](#profileSignals) lists them for a profile.',
        zh: '每個控制項的訊號（數值已正規化，`raw` 保留 MIDI 的號碼）：`midi/<short>/<id>`（0..1，雙向彎音輪是 −1..1）和 `/raw`。旋鈕有 `/delta`，打擊墊有 `/hit` 脈衝 `{ vel, velocity, note, ch }` 和 `/pressure`，琴鍵控制項有 `/on`、`/off` 脈衝，按著某個鍵時有 `midi/<short>/n<note>`，另外還有 `midi/<short>/last`，這個脈衝說明最後碰了哪個控制項。[`profileSignals()`](#profileSignals) 能列出某份設定檔的全部名稱。',
      },
      {
        en: 'Each control keeps a state `{ value, raw, held, pressure, pos }` in `controller.state` (read it with `get(id)`). `controller.keys` maps each held key\'s note to its velocity. `controller.profile` is the working copy (learning changes it), `controller.base` the normalized profile before any learning, `controller.lastEvent` the last message with its text, and `controller.learning` and `controller.learned` track learn mode.',
        zh: '每個控制項的狀態是 `{ value, raw, held, pressure, pos }`，存在 `controller.state`（用 `get(id)` 讀）。`controller.keys` 把每個按著的琴鍵音符對應到力度。`controller.profile` 是正在使用的副本（學習會改動它），`controller.base` 是還沒學習之前整理過的設定檔，`controller.lastEvent` 是最後一則訊息和它的文字，`controller.learning` 與 `controller.learned` 記錄學習模式。',
      },
    ],
    notes: [
      {
        en: 'Inside a show, do not read `midi/lpd8/k1` in `update()`: route it to a param with [`controllerRoutes()`](#controllerRoutes). You rarely create a `MidiController` yourself: [`MidiControllers`](#MidiControllers) makes one per profile, and [`createController()`](#createController) wraps all of it.',
        zh: '在演出裡不要在 `update()` 讀 `midi/lpd8/k1`，要用 [`controllerRoutes()`](#controllerRoutes) 把它接到參數上。你很少需要自己建立 `MidiController`：[`MidiControllers`](#MidiControllers) 會替每份設定檔建立一個，[`createController()`](#createController) 則把這一切包起來。',
      },
    ],
    members: {
      id: { en: 'The profile\'s id, such as `\'akai-lpd8\'`.', zh: '設定檔的 id，例如 `\'akai-lpd8\'`。' },
      control: { en: 'Returns the control\'s definition from the profile (`type`, `msg`, `ch`, `cc`/`note` …), or `null` when there is no such id.', zh: '回傳設定檔裡該控制項的定義（`type`、`msg`、`ch`、`cc`/`note` …），沒有這個 id 時回傳 `null`。' },
      get: { en: 'Returns the control\'s state `{ value, raw, held, pressure, pos }`, or `undefined` for an unknown id.', zh: '回傳該控制項的狀態 `{ value, raw, held, pressure, pos }`，id 不存在則是 `undefined`。' },
      groups: { en: 'The current values grouped like the TouchDesigner tool\'s out CHOPs: `{ knob: [v1, v2 …], pad: […] }`. Keys controls are left out. (Unlike [`groupsOf()`](#groupsOf), which lists ids.)', zh: '依 TouchDesigner 工具的輸出 CHOP 分組的目前數值：`{ knob: [v1, v2 …], pad: […] }`，琴鍵控制項不在其中。（不同於回傳 id 的 [`groupsOf()`](#groupsOf)。）' },
      onChange: { en: 'Subscribe to changes: `fn(id, state, info)` with `info` `{ source, ev, note, bytes }`. When the mapping or learn state changes instead, it is called as `fn(null, null, { meta: true })`. Returns an unsubscribe function.', zh: '訂閱變化：`fn(id, state, info)`，`info` 是 `{ source, ev, note, bytes }`。對應或學習狀態改變時，改以 `fn(null, null, { meta: true })` 呼叫。回傳取消訂閱的函式。' },
      onMessage: { en: 'Subscribe to every message that passes through, once, after the state has moved: `fn({ bytes, ev, source, ids })`, where `ids` are the controls it moved (none for a message the profile does not know). An embed forwards `source: \'ui\'` messages to a MIDI output here. Returns an unsubscribe function.', zh: '訂閱每一則經過的訊息，狀態更新之後只通知一次：`fn({ bytes, ev, source, ids })`，`ids` 是它推動的控制項（設定檔不認得的訊息則為空）。嵌入元件在這裡把 `source: \'ui\'` 的訊息轉送到 MIDI 輸出。回傳取消訂閱的函式。' },
      ingest: { en: 'Feeds MIDI bytes in. `source` is `\'hw\'` (default), `\'ui\'` or `\'mirror\'`. Returns the parsed event, or `null`. Clock, sysex and system messages are returned without touching any control.', zh: '把 MIDI 位元組餵進來。`source` 是 `\'hw\'`（預設）、`\'ui\'` 或 `\'mirror\'`。回傳解析後的事件或 `null`。時鐘、sysex 和系統訊息會直接回傳，不會動到任何控制項。' },
      setValue: { en: 'Moves an absolute control (knob, fader, wheel, strip, absolute encoder) to `v`: 0..1, or −1..1 for a bipolar one. Returns the bytes it sent, or `null` when the value did not change. For a relative encoder it turns by the matching steps.', zh: '把絕對值控制項（旋鈕、推桿、彎音輪、觸控條、絕對值編碼器）移到 `v`：0..1，雙向的是 −1..1。回傳送出的位元組，數值沒變則回傳 `null`。相對編碼器則會轉出對應的步數。' },
      turn: { en: 'Turns an endless encoder by signed `steps`, sent in the encoding its profile names. Returns the last bytes sent.', zh: '讓無限旋鈕轉動有正負號的 `steps` 步，用它設定檔指定的編碼送出。回傳最後送出的位元組。' },
      press: { en: 'Presses a pad, button or key with a velocity from 0 to 1 (a pad or key velocity is held to 1..127; a button always sends 127). A key needs its `note`. A toggle button flips. Returns the bytes.', zh: '用 0 到 1 的力度按下打擊墊、按鈕或琴鍵（打擊墊和琴鍵的力度會限制在 1..127，按鈕一律送 127）。琴鍵要給 `note`。切換式按鈕會翻轉。回傳位元組。' },
      release: { en: 'Lets go of a pad, button or key (a key needs its `note`). A toggle button ignores it. Returns the bytes.', zh: '放開打擊墊、按鈕或琴鍵（琴鍵要給 `note`）。切換式按鈕不理會它。回傳位元組。' },
      pressure: { en: 'Sets a pad\'s or key\'s pressure, 0..1, as polyphonic or channel aftertouch, whichever its profile says. Does nothing for a control without `aftertouch`.', zh: '設定打擊墊或琴鍵的壓力（0..1），用複音觸後或頻道觸後，看設定檔怎麼寫。沒有 `aftertouch` 的控制項不會有動作。' },
      rest: { en: 'Sends a spring-loaded wheel or strip home: pitch bend back to the centre.', zh: '讓帶彈簧的彎音輪或觸控條回到休息位置：彎音輪回到中心。' },
      releaseAll: { en: 'Lets go of every key, pad and momentary button the virtual hands hold. Call it on blur, page hide or an octave change so no note hangs.', zh: '放開虛擬的手按著的所有琴鍵、打擊墊和瞬間按鈕。視窗失焦、頁面隱藏或切換八度時呼叫，音就不會卡住。' },
      mirror: { en: 'Applies a value that arrived from elsewhere (relay feedback) to the state and the views, without publishing anything.', zh: '把別處傳來的值（中繼的回饋）套用到狀態和畫面上，不發佈任何東西。' },
      ledBytes: { en: 'Returns the MIDI bytes that light (or dim) that control\'s LED on the hardware, from its state, or `null` when the profile has no `led` for it.', zh: '回傳讓該控制項在硬體上的 LED 亮起（或變暗）的 MIDI 位元組，依它的狀態而定。設定檔沒有寫 `led` 時回傳 `null`。' },
      ledSnapshot: { en: 'The bytes for every LED at its current state, to send once when the hardware connects (the idle colours).', zh: '每顆 LED 在目前狀態下的位元組，在硬體連上的時候送一次（待機時的顏色）。' },
      learn: { en: 'Arms learn mode for one control: the next compatible hardware message is bound to it. Calling it again for the same id cancels. Returns the armed id or `null`.', zh: '讓某個控制項進入學習：下一則相容的硬體訊息會綁到它身上。對同一個 id 再呼叫一次就取消。回傳被準備好的 id 或 `null`。' },
      bindMessage: { en: 'Rebinds a control to the message `ev`, swapping with whichever control had it before.', zh: '把控制項重新綁到訊息 `ev`，原本佔用那則訊息的控制項會跟它對調。' },
      exportMapping: { en: 'The learned bindings as JSON, `{ controlId: { msg, ch, cc, note, from, to } }`, containing only what differs from the profile. Persist it per device (localStorage, a file).', zh: '學到的對應，以 JSON 輸出，格式 `{ 控制項 id: { msg, ch, cc, note, from, to } }`，只包含跟設定檔不同的部分。可以依裝置存起來（localStorage、檔案）。' },
      applyMapping: { en: 'Applies a mapping from `exportMapping()` and marks those controls as learned.', zh: '套用 `exportMapping()` 匯出的對應，並把那些控制項標成已學習。' },
      resetMapping: { en: 'Goes back to the profile\'s own bindings and forgets what was learned.', zh: '回到設定檔原本的綁定，忘掉學過的內容。' },
    },
    examples: [
      {
        code: `import { MidiController, profileById } from '@openav/midi';

const lpd8 = new MidiController(profileById('lpd8'));
lpd8.onChange((id, st, info) => id && console.log(info.source, id, st.value.toFixed(2), st.raw));

lpd8.ingest([0xb0, 70, 127], { source: 'hw' });   // the real knob 1 moved to the top
lpd8.setValue('k2', 0.5);                          // a finger on the on-screen knob 2
lpd8.press('pad1', 0.8);                           // a finger on pad 1`,
        caption: { en: 'Prints three lines: `hw k1 1.00 127`, `ui k2 0.50 64`, `ui pad1 0.80 102`. The same model, three hands.', zh: '印出三行：`hw k1 1.00 127`、`ui k2 0.50 64`、`ui pad1 0.80 102`。同一個模型，三隻手。' },
      },
      {
        code: `import { Signals } from '@openav/core';
import { MidiController, profileById } from '@openav/midi';

const signals = new Signals();
const mc = new MidiController(profileById('minilab3'), { signals });
signals.on('midi/minilab3/pad3/hit', (hit) => console.log('pad 3 hit', hit));

mc.press('pad3', 0.5);
console.log(signals.get('midi/minilab3/pad3'));       // 0.50...: velocity while held
mc.release('pad3');
console.log(signals.get('midi/minilab3/pad3'));       // 0`,
        caption: { en: 'Prints the `/hit` pulse `{ vel: 0.50…, velocity: 64, note: 38, ch: 10 }`, then the pad\'s value while held and after release.', zh: '印出 `/hit` 脈衝 `{ vel: 0.50…, velocity: 64, note: 38, ch: 10 }`，再印出打擊墊按著時與放開後的值。' },
      },
      {
        code: `import { MidiController, profileById } from '@openav/midi';

// a generic layout learns whatever you move
const mc = new MidiController(profileById('generic-8k8p'));
mc.learn('k3');                                       // arm control k3
mc.ingest([0xb0, 50, 99], { source: 'hw' });          // the next CC from the hardware is bound to it
console.log(JSON.stringify(mc.exportMapping()));       // {"k3":{"msg":"cc","ch":1,"cc":50}}

const again = new MidiController(profileById('generic-8k8p'));
again.applyMapping(mc.exportMapping());
again.ingest([0xb0, 50, 10], { source: 'hw' });
console.log(again.get('k3').raw);                     // 10`,
        caption: { en: 'Prints the learned binding of k3, then `10`: a second controller with the saved mapping reacts to the same CC.', zh: '印出 k3 學到的綁定，再印出 `10`：套用了存起來的對應的第二個控制器，對同一個 CC 會有反應。' },
      },
    ],
    related: ['MidiControllers', 'createController', 'controllerRoutes', 'profileSignals', 'parseMessage'],
    keywords: {
      en: ['controller model', 'midi controller', 'ingest', 'learn mode', 'mapping', 'led feedback', 'virtual knob', 'press', 'set value'],
      zh: ['控制器模型', 'midi 控制器', '餵入訊息', '學習模式', '對應', 'led 回饋', '虛擬旋鈕', '按下', '設定數值'],
    },
  },

  MidiControllers: {
    group: 'midi-io',
    summary: {
      en: 'Ties hardware ports to controller profiles: plug in a MiniLab 3 and the on-screen one appears and moves with your hands; unplug it and it stays playable.',
      zh: '把硬體埠跟控制器設定檔接起來：接上 MiniLab 3，螢幕上的 MiniLab 3 就出現並跟著你的手動，拔掉它，虛擬的那台仍然可以玩。',
    },
    params: [
      { name: 'profiles', type: 'Object[]', en: 'The profiles to manage, usually [`PROFILES`](#PROFILES). Required: the first one is shown when `initial` is not given.', zh: '要管理的設定檔，通常是 [`PROFILES`](#PROFILES)。必填，沒給 `initial` 時會先顯示第一個。' },
      { name: 'signals', type: 'Signals | null', en: 'Passed to every [`MidiController`](#MidiController) it creates.', zh: '交給它建立的每個 [`MidiController`](#MidiController)。' },
      { name: 'sink', type: 'Function | null', en: 'Passed on to every controller, as in `MidiController`.', zh: '交給每個控制器，用法同 `MidiController`。' },
      { name: 'midi', type: 'Midi | null', en: 'An enabled (or about-to-be-enabled) [`Midi`](#Midi) to follow. Leave it out for no hardware, and call `attach(midi)` later.', zh: '要跟隨的 [`Midi`](#Midi)（已啟用或即將啟用）。不給就是沒有硬體，之後再呼叫 `attach(midi)`。' },
      { name: 'initial', type: 'String | null', en: 'The profile id shown before any hardware arrives.', zh: '硬體出現之前先顯示的設定檔 id。' },
      { name: 'storage', type: 'Storage | null', en: 'Where learned mappings and manual port assignments are remembered: anything with `getItem` and `setItem`. The default is `localStorage` when the page has it, otherwise nothing is remembered.', zh: '用來記住學到的對應和手動指定的埠：任何有 `getItem`、`setItem` 的東西。預設是頁面有的話就用 `localStorage`，沒有的話就不記。' },
    ],
    description: [
      {
        en: 'There is one [`MidiController`](#MidiController) per profile, created the first time it is asked for (`get(id)`), so a virtual MiniLab and a real MiniLab are the SAME object: whichever hand moves it, the work receives the same `midi/minilab3/…` signals. `current` is the controller the panel shows.',
        zh: '每份設定檔只有一個 [`MidiController`](#MidiController)，第一次被要求時才建立（`get(id)`），所以虛擬的 MiniLab 和真的 MiniLab 是「同一個物件」：不論哪隻手在動，作品收到的都是同樣的 `midi/minilab3/…` 訊號。`current` 是面板正在顯示的那個控制器。',
      },
      {
        en: 'With a `midi` attached it matches every input port to a profile by name ([`matchProfile()`](#matchProfile), one port per device through [`pickPort()`](#pickPort)), switches `current` to the first device it recognises, sends the LED colours to its output port, and routes each port\'s messages to that profile\'s controller. A port nobody recognises can be given to a profile by hand with `assign(slug, profileId)`; that choice is remembered per port name.',
        zh: '接上 `midi` 之後，它會用名稱把每個輸入埠對到設定檔（[`matchProfile()`](#matchProfile)，一台機器只取一個埠，由 [`pickPort()`](#pickPort) 決定），把 `current` 切到第一台認得的機器，把 LED 顏色送到它的輸出埠，並把每個埠的訊息導向該設定檔的控制器。沒有人認得的埠，可以用 `assign(slug, profileId)` 手動指定給某份設定檔，這個選擇會依埠名記起來。',
      },
      {
        en: 'It remembers in `storage` under `openav.midi.map.<profile id>` (learned mappings, restored when the controller is created) and `openav.midi.assign` (manual port assignments).',
        zh: '它會把資料記在 `storage` 的 `openav.midi.map.<設定檔 id>`（學到的對應，建立控制器時還原）和 `openav.midi.assign`（手動指定的埠）。',
      },
    ],
    members: {
      attach: { en: 'Starts following a hardware [`Midi`](#Midi) (now, or later: an embed connects only when asked). Switching to another engine detaches the first. Returns the manager.', zh: '開始跟隨某個硬體 [`Midi`](#Midi)（現在，或之後：嵌入元件只在被要求時才連）。換成另一個引擎時，會先中斷前一個。回傳管理器本身。' },
      detach: { en: 'Stops following the hardware. The on-screen controllers stay and are still playable.', zh: '停止跟隨硬體。螢幕上的控制器還在，仍然可以玩。' },
      register: { en: 'Adds (or replaces) a profile at runtime, for example one loaded from a URL or one moved to another channel with [`withChannel()`](#withChannel).', zh: '在執行中新增（或取代）一份設定檔，例如從網址載入的，或用 [`withChannel()`](#withChannel) 改了頻道的。' },
      get: { en: 'The [`MidiController`](#MidiController) for a profile id, created on first use with any learned mapping restored. Throws `unknown MIDI profile "x"` for an id that was never registered.', zh: '某個設定檔 id 的 [`MidiController`](#MidiController)，第一次使用時建立，並還原學過的對應。id 沒有註冊過會丟出 `unknown MIDI profile "x"`。' },
      select: { en: 'Makes a profile the `current` one (the on-screen device) and tells the `onChange` subscribers with `{ type: \'select\' }`. Returns its controller.', zh: '把某份設定檔設為 `current`（螢幕上的裝置），並用 `{ type: \'select\' }` 通知 `onChange` 的訂閱者。回傳它的控制器。' },
      onChange: { en: 'Subscribe to `{ type: \'select\' }` (the device on screen changed) and `{ type: \'ports\' }` (ports or their assignments changed): `fn(event, manager)`. Returns an unsubscribe function.', zh: '訂閱 `{ type: \'select\' }`（螢幕上的裝置換了）和 `{ type: \'ports\' }`（埠或它們的指派改變）：`fn(event, manager)`。回傳取消訂閱的函式。' },
      devices: { en: 'The hardware ports and who they drive: `[{ slug, name, listening, profileId, auto }]`. `auto` is `true` when the match was made by name, `false` when you assigned it.', zh: '硬體埠以及它們驅動誰：`[{ slug, name, listening, profileId, auto }]`。`auto` 為 `true` 表示是用名稱配對的，`false` 表示是你指定的。' },
      hardwareFor: { en: 'The name of the port feeding this profile right now, or `null` when no hardware drives it.', zh: '現在正在驅動這份設定檔的埠名，沒有硬體在驅動時為 `null`。' },
      assign: { en: 'Routes a port to a profile by hand (an unknown device to a generic layout), or un-routes it with `null`. It then selects that profile. `persist` (default `true`) remembers the choice for this port name.', zh: '手動把某個埠指派給某份設定檔（不認識的機器指派給通用版面），給 `null` 則取消指派。接著會選到那份設定檔。`persist`（預設 `true`）會依這個埠名記住選擇。' },
      dispose: { en: 'Detaches from the hardware and forgets the subscribers.', zh: '中斷跟硬體的連線，並清掉所有訂閱者。' },
    },
    tbd: [
      {
        en: 'LED feedback (the colours sent back to a device when it is recognised) was not tried on real hardware. Some controls in the shipped profiles are marked `verified: false`: their messages come from the manual but nobody has confirmed them on a real unit yet, and Learn rebinds them.',
        zh: 'LED 回饋（機器被認出時送回去的顏色）沒有在真實的硬體上實測。內建設定檔裡有些控制項標著 `verified: false`：它們的訊息來自說明書，但還沒有人在真實的機器上確認過，可以用學習重新綁定。',
      },
    ],
    examples: [
      {
        code: `import { Signals } from '@openav/core';
import { MidiControllers, PROFILES } from '@openav/midi';

const signals = new Signals();
const mcs = new MidiControllers({ profiles: PROFILES, signals, initial: 'akai-lpd8' });

mcs.current.setValue('k1', 1);
console.log(signals.get('midi/lpd8/k1'));    // 1
mcs.select('korg-nanokontrol2');
console.log(mcs.current.id);                  // korg-nanokontrol2`,
        caption: { en: 'Prints `1` (a finger on the on-screen LPD8 knob became a signal), then `korg-nanokontrol2` after switching the device on screen.', zh: '印出 `1`（螢幕上 LPD8 旋鈕被手指推動，變成了訊號），切換螢幕裝置之後再印出 `korg-nanokontrol2`。' },
      },
      {
        code: `import { Signals } from '@openav/core';
import { Midi, MidiControllers, PROFILES } from '@openav/midi';

// a fake Minilab3 on a fake MIDIAccess
const keys = { name: 'Minilab3 MIDI', state: 'connected', onmidimessage: null };
const access = { inputs: new Map([['k', keys]]), outputs: new Map() };

const signals = new Signals();
const midi = new Midi({ signals, requestAccess: async () => access });
await midi.enable();

const mcs = new MidiControllers({ profiles: PROFILES, signals, midi });
console.log(mcs.current.id, '<-', mcs.hardwareFor('arturia-minilab3'));
keys.onmidimessage({ data: Uint8Array.of(0xb0, 74, 127) });         // the real knob 1
console.log(signals.get('midi/minilab3/knob1'));                     // 1`,
        caption: { en: 'Prints `arturia-minilab3 <- Minilab3 MIDI` (the port was recognised by name), then `1`: a message from the port moved knob 1 of the on-screen MiniLab 3.', zh: '印出 `arturia-minilab3 <- Minilab3 MIDI`（埠名被認出來了），再印出 `1`：埠送來的訊息推動了螢幕上 MiniLab 3 的旋鈕 1。' },
      },
    ],
    related: ['MidiController', 'Midi', 'matchProfile', 'pickPort', 'createController', 'mountMidiPanel'],
    keywords: {
      en: ['plug in controller', 'hardware to profile', 'auto detect', 'assign port', 'on-screen controller', 'manager', 'hot-plug', 'devices'],
      zh: ['接上控制器', '硬體對設定檔', '自動偵測', '指派埠', '螢幕控制器', '管理器', '熱插拔', '裝置'],
    },
  },

  controllerRoutes: {
    group: 'midi-io',
    summary: {
      en: 'Builds mapper routes for "this control drives that param": `controllerRoutes(profile, { knob1: \'hue\' })` routes the knob\'s signal to the param `hue`.',
      zh: '建立「這個控制項推動那個參數」的 Mapper 路由：`controllerRoutes(profile, { knob1: \'hue\' })` 會把旋鈕的訊號接到參數 `hue`。',
    },
    params: [
      { name: 'profile', type: 'Object', en: 'The device\'s profile (raw or normalized): used to check the ids and to know which controls are bipolar.', zh: '那台機器的設定檔（原始或整理過的都行）：用來檢查 id，並判斷哪些控制項是雙向的。' },
      { name: 'bindings', type: 'Object', en: '`{ controlId: target }`, where `target` is a param name or a route object (`{ target, inMin, inMax, … }`). A pad written as `{ target: \'burst\', on: \'hit\' }` listens to the `/hit` pulse instead of its velocity.', zh: '`{ 控制項 id: target }`，`target` 是參數名稱，或路由物件（`{ target, inMin, inMax, … }`）。打擊墊寫成 `{ target: \'burst\', on: \'hit\' }` 時，聽的是 `/hit` 脈衝而不是力度。' },
      { name: 'short', type: 'String', en: 'The signal namespace. The default is the profile\'s `short`; give another when you run the device under a different one.', zh: '訊號的命名空間，預設是設定檔的 `short`。同一台機器用了別的命名空間時才需要改。' },
    ],
    returns: { type: 'Object[]', en: '`[{ source, target, … }]`, ready for `mapper.addRoute(route)`. A bipolar control (a pitch wheel) gets `inMin: -1, inMax: 1`. Any other key in the third argument is copied onto every route.', zh: '`[{ source, target, … }]`，可以直接用 `mapper.addRoute(route)`。雙向的控制項（彎音輪）會自動加上 `inMin: -1, inMax: 1`。第三個參數裡的其他鍵，會複製到每一條路由上。' },
    description: [
      {
        en: 'This is rule 1 of the project (continuous control goes through params): a world does not read `midi/lpd8/k1` in `update()`, it declares a param and lets a route drive it. An id the profile does not have throws `profile akai-lpd8 has no control "x"`, so a typo is loud.',
        zh: '這是專案的第一條規則（連續控制要經過參數）：世界不在 `update()` 裡讀 `midi/lpd8/k1`，而是宣告一個參數，由路由來推動它。設定檔沒有的 id 會丟出 `profile akai-lpd8 has no control "x"`，打錯字一定看得見。',
      },
    ],
    examples: [
      {
        code: `import { controllerRoutes, profileById } from '@openav/midi';

const routes = controllerRoutes(profileById('lpd8'), {
  k1: 'hue',                                   // knob 1 drives the param "hue"
  k2: { target: 'size', inMin: 0, inMax: 1 },  // a route object, extra keys are kept
  pad1: { target: 'burst', on: 'hit' },        // fire on the hit, not on the velocity
});
for (const r of routes) console.log(r.source, '->', r.target);`,
        caption: { en: 'Prints `midi/lpd8/k1 -> hue`, `midi/lpd8/k2 -> size` and `midi/lpd8/pad1/hit -> burst`: the signal each control drives its param from.', zh: '印出 `midi/lpd8/k1 -> hue`、`midi/lpd8/k2 -> size` 和 `midi/lpd8/pad1/hit -> burst`：每個控制項用哪個訊號去推動它的參數。' },
      },
    ],
    related: ['MidiController', 'profileSignals', 'linkControllers'],
    keywords: { en: ['map knob to param', 'route', 'mapper', 'bind control', 'continuous control', 'knob to hue'], zh: ['旋鈕對應參數', '路由', 'mapper', '綁定控制項', '連續控制', '旋鈕控制色相'] },
  },

  linkControllers: {
    group: 'midi-io',
    summary: {
      en: 'Links the on-screen controllers to phones over the room relay: tells phones which device is on screen, echoes this machine\'s moves to them, and mirrors theirs here.',
      zh: '透過房間中繼把螢幕上的控制器和手機連起來：告訴手機現在螢幕上是哪台機器，把這台電腦上的動作回傳給手機，也把手機的動作鏡射到這裡。',
    },
    params: [
      { name: 'relay', type: 'Object', en: 'A relay client with `config(name, value)` and `feedback(signalName, value)` (the show runner\'s `RelayClient`).', zh: '中繼客戶端，要有 `config(name, value)` 和 `feedback(signalName, value)`（演出執行器的 `RelayClient`）。' },
      { name: 'signals', type: 'Signals', en: 'The bus the phones\' `midi/virtual` messages arrive on.', zh: '手機的 `midi/virtual` 訊息抵達的匯流排。' },
      { name: 'controllers', type: 'MidiControllers', en: 'The manager whose controllers are linked.', zh: '要連起來的控制器所屬的管理器。' },
    ],
    returns: { type: '{ flush(), dispose() }', en: '`flush()` sends the queued feedback to the relay (call it at a steady pace, for example once per frame). `dispose()` stops listening.', zh: '`flush()` 把佇列中的回饋送給中繼（以穩定的節奏呼叫，例如每個畫面一次）。`dispose()` 停止監聽。' },
    description: [
      {
        en: 'A phone\'s MIDI tab publishes the device\'s signals itself (the controller lives there), so this side only does three things. When you `select` another device it tells the phones with `relay.config(\'midi\', { profile })`. When a knob, fader, encoder, wheel, strip or toggle button on THIS machine moves from hardware or the screen, it queues `relay.feedback(\'midi/<short>/<id>\', value)` so the phone\'s knobs follow. When a phone plays (`midi/virtual`) it mirrors that on this screen, state and view only, because the phone already published the signals.',
        zh: '手機的 MIDI 分頁自己會發佈機器的訊號（控制器就住在那裡），所以這一端只做三件事。你用 `select` 換了機器，就用 `relay.config(\'midi\', { profile })` 告訴手機。這台電腦上的旋鈕、推桿、編碼器、彎音輪、觸控條或切換按鈕被硬體或螢幕動了，就把 `relay.feedback(\'midi/<short>/<id>\', value)` 排進佇列，讓手機上的旋鈕跟著動。手機彈了（`midi/virtual`），就鏡射在這個螢幕上，只更新狀態和畫面，因為手機已經發佈過訊號了。',
      },
      {
        en: 'This is what `@openav/remote`\'s show-side host and the lab\'s midi module call. You need it only when you wire phones into a page yourself.',
        zh: '`@openav/remote` 在演出端的主機，和實驗室的 midi 模組，用的就是它。只有在你自己把手機接進頁面時才需要。',
      },
    ],
    examples: [
      {
        code: `import { Signals } from '@openav/core';
import { MidiControllers, PROFILES, linkControllers } from '@openav/midi';

const signals = new Signals();
const mcs = new MidiControllers({ profiles: PROFILES, signals, initial: 'akai-lpd8' });

// a stand-in for the relay client: it prints what would go to the phones
const relay = {
  config: (name, value) => console.log('config', name, value),
  feedback: (name, value) => console.log('feedback', name, value.toFixed(2)),
};
const link = linkControllers(relay, signals, mcs);

mcs.current.setValue('k1', 0.5);   // a knob moves on this machine
link.flush();                       // feedback midi/lpd8/k1 0.50
mcs.select('korg-nanokontrol2');   // config midi { profile: 'korg-nanokontrol2' }
link.dispose();`,
        caption: { en: 'Prints `feedback midi/lpd8/k1 0.50` after the flush, then `config midi { profile: \'korg-nanokontrol2\' }` when the device on screen changes.', zh: 'flush 之後印出 `feedback midi/lpd8/k1 0.50`，螢幕上的裝置換掉時再印出 `config midi { profile: \'korg-nanokontrol2\' }`。' },
      },
    ],
    related: ['MidiControllers', 'controllerRoutes', 'MidiController'],
    keywords: { en: ['phone', 'remote', 'relay', 'ipad controller', 'feedback to phone', 'mirror'], zh: ['手機', '遙控', '中繼', 'ipad 控制器', '回饋給手機', '鏡射'] },
  },

  // ================================================================== virtual Web MIDI (for sketches written against navigator.requestMIDIAccess)

  createVirtualMIDIAccess: {
    group: 'midi-io',
    summary: {
      en: 'Builds a Web MIDI `MIDIAccess` that always has one more input and output of its own, so a sketch written for a MIDI keyboard works with none plugged in.',
      zh: '建立一個 Web MIDI 的 `MIDIAccess`，它永遠多出一組自己的輸入和輸出，讓寫給 MIDI 鍵盤的草圖在沒有接任何機器時也能動。',
    },
    params: [
      { name: 'name', type: 'String', en: 'The name of the virtual port, as the sketch sees it.', zh: '虛擬埠的名稱，也就是草圖看到的名字。' },
      { name: 'manufacturer', type: 'String', en: 'The `manufacturer` the virtual ports report.', zh: '虛擬埠回報的 `manufacturer`。' },
      { name: 'id', type: 'String', en: 'The port id prefix: the ports are `<id>-in` and `<id>-out`.', zh: '埠 id 的前綴：埠的 id 是 `<id>-in` 和 `<id>-out`。' },
      { name: 'sysex', type: 'Boolean', en: 'What `access.sysexEnabled` reports.', zh: '`access.sysexEnabled` 回報的值。' },
      { name: 'onOutput', type: 'Function | null', en: '`(bytes, timestamp) => …` called when a program sends to the virtual OUTPUT. `timestamp` is when the bytes should sound (`performance.now()` milliseconds), or `undefined` for "now".', zh: '程式送到虛擬「輸出」時呼叫的 `(bytes, timestamp) => …`。`timestamp` 是這些位元組該發聲的時間（`performance.now()` 毫秒），`undefined` 表示「現在」。' },
      { name: 'onClear', type: 'Function | null', en: 'Called when the program calls `output.clear()` (Web MIDI: drop what is still waiting).', zh: '程式呼叫 `output.clear()` 時被呼叫（Web MIDI 的意思是：丟掉還在排隊的）。' },
    ],
    returns: { type: 'Object', en: '`{ access, input, output, emit(bytes), addReal(realAccess), real, requests, dispose() }`. Give `access` to the program. `emit()` plays bytes into the virtual input.', zh: '`{ access, input, output, emit(bytes), addReal(realAccess), real, requests, dispose() }`。把 `access` 交給程式。`emit()` 把位元組彈進虛擬輸入。' },
    description: [
      {
        en: 'A 2018 sketch that calls `navigator.requestMIDIAccess()` (or WebMidi.js) and waits for a keyboard shows nothing on a laptop without one, and on an iPad has no Web MIDI at all. Hand it this access instead and the on-screen controller becomes a real-looking MIDI input: the sketch\'s own unmodified code receives `midimessage` events with the same bytes a keyboard sends.',
        zh: '2018 年寫的草圖呼叫 `navigator.requestMIDIAccess()`（或 WebMidi.js）然後等鍵盤，在沒有鍵盤的筆電上什麼都不會出現，在 iPad 上更是完全沒有 Web MIDI。改成交給它這個 access，螢幕上的控制器就變成一個看起來像真的 MIDI 輸入：草圖原封不動的程式碼，會收到跟鍵盤送出的位元組一模一樣的 `midimessage` 事件。',
      },
      {
        en: 'The virtual OUTPUT is a real-looking port too: a program that plays out to it (Strudel\'s `.midi(\'OAV Virtual MIDI\')`, a WebMidi.js sketch) calls `send(bytes, timestamp)`, and `onOutput` hears both. Real ports can be merged in with `addReal(realAccess)`: they come FIRST in `inputs`, the virtual one last, so a sketch that only listens to `inputs[0]` takes the hardware when it is there and the virtual controller when it is not. Real ports pass through untouched, so nothing is delivered twice.',
        zh: '虛擬「輸出」也長得像真的埠：對它輸出的程式（Strudel 的 `.midi(\'OAV Virtual MIDI\')`、WebMidi.js 草圖）會呼叫 `send(bytes, timestamp)`，`onOutput` 會同時收到位元組和時間戳。可以用 `addReal(realAccess)` 併入真實的埠：它們排在 `inputs` 的「前面」，虛擬的排最後，所以只聽 `inputs[0]` 的草圖，有硬體時用硬體，沒有時用虛擬控制器。真實的埠原封不動地穿過，所以不會重複送達。',
      },
    ],
    notes: [
      {
        en: '`access.inputs` and `access.outputs` are `Map`s, as in Web MIDI. `input.listening` counts the listeners a program put on the port, and `requests` counts how often [`virtualRequestMIDIAccess()`](#virtualRequestMIDIAccess) handed the access out.',
        zh: '跟 Web MIDI 一樣，`access.inputs` 和 `access.outputs` 都是 `Map`。`input.listening` 是程式在這個埠上掛了幾個監聽，`requests` 是 [`virtualRequestMIDIAccess()`](#virtualRequestMIDIAccess) 把這個 access 交出去幾次。',
      },
    ],
    tbd: [
      {
        en: 'Not tried for this page: a real WebMidi.js or Strudel sketch talking to the virtual ports, and how the `onOutput` timestamps line up with a hardware port. The example calls the ports directly.',
        zh: '這一頁沒有實測：真正的 WebMidi.js 或 Strudel 草圖跟虛擬埠對話，以及 `onOutput` 的時間戳跟硬體埠比起來對不對得上。範例是直接呼叫那些埠。',
      },
    ],
    examples: [
      {
        code: `import { createVirtualMIDIAccess } from '@openav/midi';

const v = createVirtualMIDIAccess({
  name: 'Demo MIDI',
  onOutput: (bytes, timestamp) => console.log('program played', bytes, timestamp),
});

const input = [...v.access.inputs.values()][0];
const output = [...v.access.outputs.values()][0];
console.log(input.name, '|', input.listening, 'listeners');

input.onmidimessage = (e) => console.log('program heard', [...e.data]);   // what a 2018 sketch does
v.emit([0x90, 60, 100]);              // the on-screen keyboard plays: program heard [144, 60, 100]
output.send([0x90, 62, 80]);          // the program plays out:      program played [144, 62, 80] undefined`,
        caption: { en: 'Prints the port name with 0 listeners, then `program heard [144, 60, 100]`, then `program played [144, 62, 80] undefined` (no timestamp means "now").', zh: '印出埠名與 0 個監聽，接著是 `program heard [144, 60, 100]`，再來是 `program played [144, 62, 80] undefined`（沒有時間戳就是「現在」）。' },
      },
    ],
    related: ['virtualRequestMIDIAccess', 'Midi', 'MidiController'],
    keywords: {
      en: ['virtual midi', 'web midi shim', 'requestMIDIAccess', 'webmidi.js', 'fake midi input', 'no hardware', 'ipad', 'strudel'],
      zh: ['虛擬 midi', 'web midi 轉接', 'requestMIDIAccess', 'webmidi.js', '假的 midi 輸入', '沒有硬體', 'ipad', 'strudel'],
    },
  },

  virtualRequestMIDIAccess: {
    group: 'midi-io',
    summary: {
      en: 'Wraps `navigator.requestMIDIAccess` so every caller gets the virtual access: real ports join if they answer in time, and the virtual input stays without Web MIDI.',
      zh: '包裝 `navigator.requestMIDIAccess`，讓每個呼叫者都拿到虛擬的 access：真實的埠有及時回應就併進來，就算沒有 Web MIDI 或被拒絕，虛擬輸入也還在。',
    },
    params: [
      { name: 'real', type: 'Function | null', en: 'The original `requestMIDIAccess`, already bound (`navigator.requestMIDIAccess.bind(navigator)`), or `null` when there is none. The real request still happens, permission prompt and all.', zh: '原本的 `requestMIDIAccess`，要先綁好 `this`（`navigator.requestMIDIAccess.bind(navigator)`），沒有的話給 `null`。真實的請求仍然會進行，權限詢問也一樣。' },
      { name: 'make', type: 'Function', en: '`(opts) => …` returning the object of [`createVirtualMIDIAccess()`](#createVirtualMIDIAccess). Required. Return the same one each time to share it.', zh: '`(opts) => …`，回傳 [`createVirtualMIDIAccess()`](#createVirtualMIDIAccess) 的物件。必填。每次回傳同一個就能共用。' },
      { name: 'waitMs', type: 'Number', en: 'How long to wait for the real request before answering anyway.', zh: '最多等真實請求多久，時間到就先回覆。' },
    ],
    returns: { type: 'Function', en: 'A function `(opts?) => Promise<MIDIAccess>` to put where `navigator.requestMIDIAccess` was.', zh: '一個函式 `(opts?) => Promise<MIDIAccess>`，放到原本 `navigator.requestMIDIAccess` 的位置。' },
    description: [
      {
        en: 'If the real request answers within `waitMs` (1200 ms by default), its ports are there from the start. If it answers later they hot-plug in as `statechange` events. If it is refused or missing (Safari, iPad), the virtual input is still there. A permission prompt nobody answers cannot hang the sketch: it gets the access after `waitMs` anyway.',
        zh: '真實請求在 `waitMs`（預設 1200 毫秒）內回應的話，它的埠一開始就在。晚一點回應，就以 `statechange` 事件熱插拔進來。被拒絕或不存在（Safari、iPad）時，虛擬輸入還是在。沒有人回答的權限詢問不會卡死草圖：`waitMs` 一到它就會拿到 access。',
      },
    ],
    examples: [
      {
        code: `import { createVirtualMIDIAccess, virtualRequestMIDIAccess } from '@openav/midi';

const virtual = createVirtualMIDIAccess({ name: 'Demo MIDI' });
const requestMIDIAccess = virtualRequestMIDIAccess({ real: null, make: () => virtual });

// this is what an old sketch does, unchanged
const access = await requestMIDIAccess();
console.log([...access.inputs.values()].map((p) => p.name));   // [ 'Demo MIDI' ]
console.log(access === virtual.access, virtual.requests);      // true 1`,
        caption: { en: 'Prints `[\'Demo MIDI\']`, then `true 1`: the caller got the virtual access, and it was asked for once.', zh: '印出 `[\'Demo MIDI\']`，再印出 `true 1`：呼叫者拿到的是虛擬的 access，而且只被要求過一次。' },
      },
      {
        code: `import { createVirtualMIDIAccess, virtualRequestMIDIAccess } from '@openav/midi';

const virtual = createVirtualMIDIAccess();
navigator.requestMIDIAccess = virtualRequestMIDIAccess({
  real: navigator.requestMIDIAccess ? navigator.requestMIDIAccess.bind(navigator) : null,
  make: () => virtual,
});
// from now on every sketch on the page that asks for MIDI gets the virtual input too`,
        caption: { en: 'The real wiring: put it before the sketch runs and its old MIDI code needs no change.', zh: '真正的接法：放在草圖執行之前，它舊的 MIDI 程式碼就不用改。' },
        run: 'static',
        why: 'It replaces navigator.requestMIDIAccess for the whole page and asks the real Web MIDI, which needs a permission prompt that headless Chromium cannot answer.',
      },
    ],
    related: ['createVirtualMIDIAccess', 'Midi'],
    keywords: {
      en: ['shim', 'navigator.requestMIDIAccess', 'old sketch', 'wrap web midi', 'virtual input', 'safari'],
      zh: ['轉接', 'navigator.requestMIDIAccess', '舊草圖', '包裝 web midi', '虛擬輸入', 'safari'],
    },
  },

  // ================================================================== controllers: createController, the view, the panel, the canvas

  createController: {
    group: 'controllers',
    summary: {
      en: 'Makes one MIDI controller you can play, listen to, and point at hardware or a DAW, with no element and no framework: `createController(\'akai-lpd8\')`.',
      zh: '做出一台可以彈、可以聽、可以接硬體或 DAW 的 MIDI 控制器，不需要元素也不需要框架：`createController(\'akai-lpd8\')`。',
    },
    params: [
      { name: 'profile', type: 'String | Object', en: 'A profile id (`\'akai-lpd8\'`), a short name (`\'lpd8\'`) or a profile object. For a URL, load it first with [`loadProfile()`](#loadProfile). An unknown id throws `unknown MIDI profile "x" (known: …)`.', zh: '設定檔 id（`\'akai-lpd8\'`）、短名稱（`\'lpd8\'`）或設定檔物件。要用網址的話，先用 [`loadProfile()`](#loadProfile) 載入。不認得的 id 會丟出 `unknown MIDI profile "x" (known: …)`。' },
      { name: 'o', type: 'Object', en: 'Options, the same as the second argument of [`ControllerHost`](#ControllerHost): `profiles`, `signals`, `sink`, `channel`, `follow`, `midi`, `requestAccess`, `filterOut`, `storage`, `telemetry`, `embedKind`.', zh: '選項，跟 [`ControllerHost`](#ControllerHost) 的第二個參數一樣：`profiles`、`signals`、`sink`、`channel`、`follow`、`midi`、`requestAccess`、`filterOut`、`storage`、`telemetry`、`embedKind`。' },
    ],
    returns: { type: 'ControllerHost', en: 'The controller. Its methods are listed under [`ControllerHost`](#ControllerHost).', zh: '控制器本身。它的方法列在 [`ControllerHost`](#ControllerHost) 底下。' },
    description: [
      {
        en: 'Four lines are enough: `const ctl = createController(\'akai-lpd8\')`, `ctl.mount(el)` for the playable faceplate (optional, it works headless too), `ctl.on(\'control\', fn)` to hear every knob, pad and key whether it came from the screen or the hardware, and `ctl.connectHardware()` to follow the real device. `ctl.set(id, value)` moves a control the way a hand would.',
        zh: '四行就夠：`const ctl = createController(\'akai-lpd8\')`，`ctl.mount(el)` 畫出可以彈的面板（可有可無，沒有畫面也能用），`ctl.on(\'control\', fn)` 聽每一個旋鈕、打擊墊、琴鍵，不論來自螢幕還是硬體，`ctl.connectHardware()` 跟隨真實的機器。`ctl.set(id, value)` 則像一隻手一樣去動某個控制項。',
      },
      {
        en: 'Controllers on one page share one [`Midi`](#Midi) engine, so the browser asks for MIDI permission once. Nothing asks until you call `connectHardware()`, `setOutput()` or `requestMidi()`. Pass `signals` to publish `midi/<short>/…` into a show.',
        zh: '同一個頁面上的控制器共用一個 [`Midi`](#Midi) 引擎，所以瀏覽器只會詢問一次 MIDI 權限。在你呼叫 `connectHardware()`、`setOutput()` 或 `requestMidi()` 之前，什麼都不會詢問。傳入 `signals` 就能把 `midi/<short>/…` 發佈進演出。',
      },
    ],
    notes: [
      {
        en: 'Like `<oav-controller>`, it sends one anonymous hit per page load (which kind of embed and which device; nothing anyone plays) to the project\'s analytics, and nothing from localhost or the LAN. Turn it off with `createController(profile, { telemetry: false })`. The README\'s Telemetry section has the details.',
        zh: '跟 `<oav-controller>` 一樣，每次載入頁面會對專案的分析送出一筆匿名資料（哪一種嵌入、哪一台機器，不含任何人彈的內容），從 localhost 或區域網路則不送。用 `createController(profile, { telemetry: false })` 可以關掉。細節在 README 的 Telemetry 一節。',
      },
    ],
    examples: [
      {
        code: `import { createController } from '@openav/midi';

const ctl = createController('akai-lpd8');
ctl.on('control', (e) => console.log(e.signal, e.value.toFixed(2), '<-', e.source));

ctl.set('k1', 0.5);        // a hand on knob 1
ctl.set('pad1', 1);        // press pad 1
ctl.set('pad1', 0);        // let go
console.log(ctl.values().k1, ctl.get('nope'));`,
        caption: { en: 'Prints three `control` events (knob 0.50, pad 1.00, pad 0.00, each from \'ui\'), then the knob\'s value and `null` for an id that does not exist.', zh: '印出三個 `control` 事件（旋鈕 0.50、打擊墊 1.00、打擊墊 0.00，來源都是 \'ui\'），再印出旋鈕的值，以及不存在的 id 回傳的 `null`。' },
      },
      {
        code: `import { createController } from '@openav/midi';

// MIDI out to a DAW: a stand-in for the browser's Web MIDI shows what would be sent
const iac = { name: 'IAC Driver Bus 1', state: 'connected', send: (bytes) => console.log('to the DAW', bytes) };
const requestAccess = async () => ({ inputs: new Map(), outputs: new Map([['o', iac]]) });

const ctl = createController('akai-lpd8', { requestAccess });
console.log(await ctl.setOutput('IAC'));   // IAC Driver Bus 1
ctl.set('pad1', 1);                        // to the DAW [153, 36, 127]
ctl.set('pad1', 0);                        // to the DAW [137, 36, 0]
ctl.ingest([0x99, 37, 90]);                // hardware-style input: the faceplate follows, nothing is sent out`,
        caption: { en: 'Prints the port name, then the two messages a hand on the screen sends. The last line prints nothing: what arrives from hardware is not forwarded.', zh: '印出埠名，再印出螢幕上的手送出的兩則訊息。最後一行不會有輸出：從硬體進來的東西不會被轉送。' },
      },
      {
        code: `import { Signals } from '@openav/core';
import { createController } from '@openav/midi';

const signals = new Signals();
const ctl = createController('minilab3', { signals });

const app = document.getElementById('app');
app.style.height = '240px';
ctl.mount(app);                            // the playable faceplate fills #app

ctl.set('knob1', 0.8);                     // the knob on screen turns
console.log(signals.get('midi/minilab3/knob1'));`,
        caption: { en: 'The MiniLab 3 appears in the page with knob 1 turned up, and the console prints its signal value (0.80…). Play it with the mouse.', zh: '頁面上出現 MiniLab 3，旋鈕 1 被轉大了，主控台印出它的訊號值（0.80…）。可以用滑鼠玩。' },
      },
    ],
    related: ['ControllerHost', 'OavController', 'MidiController', 'loadProfile', 'Midi', 'ControllerView'],
    keywords: {
      en: ['create controller', 'embed controller', 'headless controller', 'on-screen controller', 'react', 'vue', 'midi out', 'connect hardware', 'play controller'],
      zh: ['建立控制器', '嵌入控制器', '無畫面控制器', '螢幕控制器', 'react', 'vue', 'midi 輸出', '連接硬體', '彈控制器'],
    },
  },

  ControllerHost: {
    group: 'controllers',
    summary: {
      en: 'The object `createController()` returns: one controller with its events, its playable faceplate, its hardware connection and its MIDI output.',
      zh: '`createController()` 回傳的物件：一台控制器，包含事件、可以彈的面板、硬體連線和 MIDI 輸出。',
    },
    params: [
      { name: 'profile', type: 'String | Object', en: 'Profile id, short name or object.', zh: '設定檔 id、短名稱或物件。' },
      { name: 'profiles', type: 'Object[]', en: 'The profiles a picker or `follow` may switch to. Default: every shipped one.', zh: '選單或 `follow` 可以切換到的設定檔。預設是所有內建的。' },
      { name: 'signals', type: 'Signals | null', en: 'Also publish `midi/<short>/…` into a show.', zh: '同時把 `midi/<short>/…` 發佈進演出。' },
      { name: 'sink', type: 'Function | null', en: 'Publish through this function instead (a relay), as in [`MidiController`](#MidiController).', zh: '改由這個函式發佈（中繼），用法同 [`MidiController`](#MidiController)。' },
      { name: 'channel', type: 'Number | null', en: 'Move every control to this MIDI channel (your unit is set to another one). See [`withChannel()`](#withChannel).', zh: '把所有控制項移到這個 MIDI 頻道（你的機器設定在別的頻道時）。見 [`withChannel()`](#withChannel)。' },
      { name: 'follow', type: 'Boolean', en: 'When a different known device is plugged in, show that one.', zh: '接上另一台認得的機器時，就改顯示那一台。' },
      { name: 'midi', type: 'Midi | null', en: 'Use this engine (a show\'s) instead of the page-shared one.', zh: '改用這個引擎（演出的），不用頁面共用的。' },
      { name: 'requestAccess', type: 'Function | null', en: 'Where the `MIDIAccess` comes from, as in [`Midi`](#Midi). Giving it makes the controller use its own engine.', zh: '`MIDIAccess` 從哪裡來，用法同 [`Midi`](#Midi)。給了它，控制器就會用自己的引擎。' },
      { name: 'filterOut', type: 'String | RegExp', en: 'The input-port filter of [`Midi`](#Midi). Anything but the default `\'IAC\'` also gives the controller its own engine.', zh: '[`Midi`](#Midi) 的輸入埠過濾。任何不是預設 `\'IAC\'` 的值，也會讓控制器用自己的引擎。' },
      { name: 'storage', type: 'Storage | null', en: 'Where learned mappings are kept, as in [`MidiControllers`](#MidiControllers). Default: `localStorage` when available.', zh: '學到的對應存在哪裡，用法同 [`MidiControllers`](#MidiControllers)。預設是有 `localStorage` 就用它。' },
      { name: 'telemetry', type: 'Boolean', en: '`false` sends no anonymous page-load hit.', zh: '`false` 就不送匿名的頁面載入資料。' },
      { name: 'embedKind', type: 'String', en: 'Which kind of embed this is for the hit: `\'headless\'` (default), `\'element\'` or `\'iframe\'`.', zh: '這次嵌入屬於哪一種，供那筆資料用：`\'headless\'`（預設）、`\'element\'` 或 `\'iframe\'`。' },
    ],
    description: [
      {
        en: 'Events, with `ctl.on(name, fn)` (returns an unsubscribe function): `control` (every knob, pad, key or button change), `noteon` and `noteoff` (the same payload, for pads, keys and note buttons), `connect` and `disconnect` (`{ port, profile }`: a hardware port started or stopped driving it), `status`, `profilechange` (`{ profile, name }`) and `\'*\'`, which gets `(name, detail)` for all of them. The `control` payload is the one described under [`controlDetail()`](#controlDetail). `ready` and `error` exist only on the `<oav-controller>` element.',
        zh: '事件用 `ctl.on(name, fn)` 訂閱（回傳取消訂閱的函式）：`control`（任何旋鈕、打擊墊、琴鍵、按鈕的變化）、`noteon` 和 `noteoff`（內容相同，給打擊墊、琴鍵和音符按鈕）、`connect` 和 `disconnect`（`{ port, profile }`：某個硬體埠開始或停止驅動它）、`status`、`profilechange`（`{ profile, name }`），以及 `\'*\'`，所有事件都會以 `(name, detail)` 通知它。`control` 的內容見 [`controlDetail()`](#controlDetail)。`ready` 和 `error` 只有 `<oav-controller>` 元素才有。',
      },
      {
        en: '`ctl.status` is `{ hardware, input, output, outputState }`. `hardware` is `off`, `asking`, `waiting` (listening, but the device is not plugged in), `connected`, `unavailable` (the browser has no Web MIDI) or `denied` (permission refused). `outputState` is `off`, `asking`, `open`, `missing` (no port matches), `unavailable` or `denied`. `ctl.profileId`, `ctl.controller` and `ctl.profile` say which device is on screen; `ctl.controllers`, `ctl.view`, `ctl.midi` and `ctl.output` are the objects underneath.',
        zh: '`ctl.status` 是 `{ hardware, input, output, outputState }`。`hardware` 可能是 `off`、`asking`、`waiting`（在聽，但機器沒接上）、`connected`、`unavailable`（瀏覽器沒有 Web MIDI）或 `denied`（權限被拒絕）。`outputState` 可能是 `off`、`asking`、`open`、`missing`（沒有符合的埠）、`unavailable` 或 `denied`。`ctl.profileId`、`ctl.controller`、`ctl.profile` 告訴你螢幕上是哪台機器，`ctl.controllers`、`ctl.view`、`ctl.midi`、`ctl.output` 則是底下的物件。',
      },
      {
        en: 'What a hand plays on the screen leaves through the output port as real MIDI; moves of your real hardware are not forwarded (your software already hears the device), and input with the same name as the chosen output (the loopMIDI echo) is muted.',
        zh: '螢幕上的手彈出來的，會從輸出埠以真正的 MIDI 送出。真實硬體的動作不會被轉送（你的軟體本來就聽得到那台機器），名稱跟所選輸出埠相同的輸入（loopMIDI 的回音）會被靜音。',
      },
    ],
    needs: {
      en: '`connectHardware()`, `setOutput()` and `requestMidi()` are the only calls that ask the browser for MIDI. Chrome, Edge and Firefox show a permission prompt, so call them from a click when you can. Without Web MIDI (Safari, iPad) the controller still plays and fires events, and `status` says `unavailable`.',
      zh: '只有 `connectHardware()`、`setOutput()`、`requestMidi()` 會向瀏覽器要 MIDI。Chrome、Edge、Firefox 會跳出權限詢問，所以可以的話請在點擊裡呼叫。沒有 Web MIDI（Safari、iPad）時，控制器仍然能彈、能觸發事件，`status` 會顯示 `unavailable`。',
    },
    members: {
      controller: { en: 'The live model ([`MidiController`](#MidiController)) of the device on screen.', zh: '螢幕上那台機器的活模型（[`MidiController`](#MidiController)）。' },
      profile: { en: 'Its normalized profile: controls, faceplate, sources.', zh: '它整理過的設定檔：控制項、面板、資料來源。' },
      on: { en: 'Subscribes to `control`, `noteon`, `noteoff`, `connect`, `disconnect`, `status`, `profilechange` or `\'*\'`. `fn(detail)` (for `\'*\'`, `fn(name, detail)`). Returns an unsubscribe function.', zh: '訂閱 `control`、`noteon`、`noteoff`、`connect`、`disconnect`、`status`、`profilechange` 或 `\'*\'`。`fn(detail)`（`\'*\'` 則是 `fn(name, detail)`）。回傳取消訂閱的函式。' },
      set: { en: 'Moves a control like a hand: knobs and faders 0..1, bipolar wheels −1..1, pads and buttons above 0 press (with that velocity) and 0 release, keys `set(\'keys\', velocity, { note: 60 })`. With `quiet: true` only the faceplate moves: no event and no MIDI out (two-way binding). Returns the bytes sent, or `null` when nothing changed. See [`setControl()`](#setControl).', zh: '像一隻手去動控制項：旋鈕和推桿 0..1，雙向彎音輪 −1..1，打擊墊和按鈕大於 0 就按下（用那個力度），0 就放開，琴鍵用 `set(\'keys\', velocity, { note: 60 })`。`quiet: true` 時只有面板會動：沒有事件，也不送 MIDI（雙向綁定用）。回傳送出的位元組，沒有變化則回傳 `null`。見 [`setControl()`](#setControl)。' },
      press: { en: 'Presses a pad, button or key.', zh: '按下打擊墊、按鈕或琴鍵。' },
      release: { en: 'Lets go of it.', zh: '放開它。' },
      get: { en: 'The current value of one control (0..1, −1..1 for bipolar), or `null` for an unknown id.', zh: '某個控制項目前的值（0..1，雙向是 −1..1），id 不存在則回傳 `null`。' },
      values: { en: '`{ id: value }` for every control (keys: 1 while any key is held). See [`valuesOf()`](#valuesOf).', zh: '每個控制項的 `{ id: value }`（琴鍵：任何一個鍵按著就是 1）。見 [`valuesOf()`](#valuesOf)。' },
      reset: { en: 'Lets go of everything and brings every control home (knobs and faders to 0, bipolar wheels to the centre), sending what a hand would. With `quiet: true` it only moves the faceplate.', zh: '放開所有東西，讓每個控制項回到原位（旋鈕和推桿回到 0，雙向彎音輪回到中心），並送出一隻手會送出的訊息。`quiet: true` 時只動面板。' },
      releaseAll: { en: 'Lets go of every held pad and key, for blur or page hide, so the DAW gets its note-offs.', zh: '放開所有按著的打擊墊和琴鍵，用在視窗失焦或頁面隱藏時，這樣 DAW 才收得到 note-off。' },
      ingest: { en: 'MIDI arriving from anywhere (a WebSocket, another page, a port you manage): the faceplate follows. One message (`[0xb0, 74, 64]`) or a list of them. `source` is `\'hardware\'` (default), `\'ui\'` or `\'quiet\'`. Returns the parsed event, or a list of them.', zh: '從任何地方來的 MIDI（WebSocket、另一個頁面、你自己管理的埠）：面板會跟著動。可以是一則訊息（`[0xb0, 74, 64]`）或一串訊息。`source` 是 `\'hardware\'`（預設）、`\'ui\'` 或 `\'quiet\'`。回傳解析後的事件，或事件的陣列。' },
      send: { en: 'Sends raw bytes out of the MIDI output port, if one is open. Returns `true` when sent, `false` otherwise.', zh: '把原始位元組送出 MIDI 輸出埠（有開的話）。送出了回傳 `true`，否則 `false`。' },
      mount: { en: 'Draws the playable faceplate into `el`; it fills `el` and follows its size, so give `el` a height. Returns the [`ControllerView`](#ControllerView). `layout` is `auto`, `face` or `stack`.', zh: '把可以彈的面板畫進 `el`，它會填滿 `el` 並跟著它的大小走，所以 `el` 要有高度。回傳 [`ControllerView`](#ControllerView)。`layout` 是 `auto`、`face` 或 `stack`。' },
      setLayout: { en: 'Changes the layout of the mounted view: `auto`, `face` or `stack`.', zh: '改變已掛載畫面的版面：`auto`、`face` 或 `stack`。' },
      learn: { en: 'Learn mode: tap a control on the screen, then move the one on your hardware (or `ingest()` it). Toggles by default; `learn(true)` and `learn(false)` set it. Returns the new state.', zh: '學習模式：點畫面上的一個控制項，再動硬體上對應的那一個（或用 `ingest()` 餵）。預設是切換，`learn(true)`、`learn(false)` 則直接設定。回傳新的狀態。' },
      setProfile: { en: 'Shows another device: an id, short name, URL or profile object. Held notes are released first. Resolves with the new controller and fires `profilechange`. Rejects with the reason when the profile is unknown or invalid.', zh: '改顯示另一台機器：id、短名稱、網址或設定檔物件。按著的音會先被放開。完成時回傳新的控制器並觸發 `profilechange`。設定檔不存在或不合法時 reject 並附上原因。' },
      connectHardware: { en: 'Follows the real device: its port drives the on-screen one (asks the browser for Web MIDI). `port` is a name or `/regex/` for routing a renamed or unknown device by hand. Resolves `true` when MIDI is available, `false` otherwise; check `status.hardware` for `connected` or `waiting`.', zh: '跟隨真實的機器：它的埠會驅動螢幕上那一台（向瀏覽器要 Web MIDI）。`port` 是名稱或 `/regex/`，用來手動指定改過名字或不認得的機器。有 MIDI 就回傳 `true`，否則 `false`，再看 `status.hardware` 是 `connected` 還是 `waiting`。' },
      disconnectHardware: { en: 'Stops following the hardware (`status.hardware` becomes `off`). The page-shared MIDI engine is let go when nothing else on the page needs it.', zh: '停止跟隨硬體（`status.hardware` 變成 `off`）。頁面共用的 MIDI 引擎，在頁面上沒有別的東西需要它時會被放掉。' },
      requestMidi: { en: 'Asks for Web MIDI without connecting anything, because an output picker needs the port list. Resolves with the output names.', zh: '向瀏覽器要 Web MIDI 但不連接任何東西，因為輸出選單需要埠的清單。完成時回傳輸出埠名稱。' },
      outputs: { en: 'The output port names, once Web MIDI is on; an empty list before that.', zh: 'Web MIDI 開啟之後的輸出埠名稱，之前是空陣列。' },
      setOutput: { en: 'Sends what is played here to a MIDI output: a name, a substring (`\'IAC\'`, `\'loopMIDI\'`) or a `/regex/`, matched as in [`findPort()`](#findPort). `null` turns it off. Resolves with the port name, or `null` when there is none (`status.outputState` says why).', zh: '把這裡彈的內容送到某個 MIDI 輸出埠：名稱、子字串（`\'IAC\'`、`\'loopMIDI\'`）或 `/regex/`，比對方式同 [`findPort()`](#findPort)。給 `null` 就關閉。完成時回傳埠名，找不到則為 `null`（`status.outputState` 會說明原因）。' },
      dispose: { en: 'Removes everything this controller added: listeners, the view, its share of the MIDI engine. Held notes are released first.', zh: '移除這個控制器加上去的所有東西：監聽、畫面、它在 MIDI 引擎中的份。按著的音會先被放開。' },
    },
    examples: [
      {
        code: `import { ControllerHost } from '@openav/midi';

// same as createController('lpd8'); the class is exported for instanceof and subclassing
const ctl = new ControllerHost('lpd8', { channel: 3 });
console.log(ctl instanceof ControllerHost, ctl.profileId, ctl.status.hardware);

console.log(ctl.set('k1', 1));                      // [178, 70, 127]: channel 3 is status byte 0xb2
await ctl.setProfile('nano2');                       // show another device
console.log(ctl.profileId, ctl.profile.controls.every((c) => c.ch === 3));`,
        caption: { en: 'Prints `true akai-lpd8 off`, then the bytes of knob 1 on channel 3, then the new device with the channel override kept.', zh: '印出 `true akai-lpd8 off`，再印出旋鈕 1 在頻道 3 的位元組，最後是換過的新機器，頻道覆寫仍然有效。' },
      },
    ],
    related: ['createController', 'MidiController', 'ControllerView', 'OavController', 'controlDetail'],
    keywords: {
      en: ['controller host', 'events', 'status', 'connect hardware', 'set output', 'learn', 'mount', 'ingest'],
      zh: ['控制器主機', '事件', '狀態', '連接硬體', '設定輸出', '學習', '掛載', '餵入訊息'],
    },
  },

  ControllerView: {
    group: 'controllers',
    summary: {
      en: 'The playable on-screen faceplate of a controller: knobs, faders, pads and keys you drive with a mouse, a finger or the keyboard, repainted from the controller\'s state.',
      zh: '控制器在螢幕上可以彈的面板：旋鈕、推桿、打擊墊、琴鍵，可以用滑鼠、手指或鍵盤操作，畫面隨著控制器的狀態重畫。',
    },
    params: [
      { name: 'container', type: 'HTMLElement', en: 'The element to fill. It needs a size: the view is 100% wide and tall, so give it a height. It can be inside a shadow root: the view\'s CSS goes into that root, not the page.', zh: '要填滿的元素。它要有大小：畫面是 100% 寬、100% 高，所以要給高度。可以放在 shadow root 裡，畫面的 CSS 會放進那個 root，不會碰到頁面。' },
      { name: 'controller', type: 'MidiController', en: 'The model to show and drive.', zh: '要顯示並驅動的模型。' },
      { name: 'mode', type: 'String', en: '`\'auto\'`, `\'face\'` or `\'stack\'` (below).', zh: '`\'auto\'`、`\'face\'` 或 `\'stack\'`（見下）。' },
      { name: 'minTouch', type: 'Number', en: 'Pixels a control needs before `face` gives way to `stack`.', zh: '控制項至少要有幾個像素大，`face` 才不會被換成 `stack`。' },
    ],
    description: [
      {
        en: 'Two shapes, chosen from the box it lives in. `face`: the device as it looks, sections where they sit on the real faceplate, scaled to fit (desktop, iPad, a phone held sideways). `stack`: the same controls re-gridded top to bottom for a tall box (a phone held upright), as the profile\'s `portrait` says. Nothing scrolls and nothing shrinks below a thumb. Square grid devices (Launchpad) stay `face`. `mode` fixes one; `\'auto\'` follows the box.',
        zh: '兩種形狀，依它所在的盒子大小決定。`face`：機器原本的樣子，各區塊在真實面板上的位置，縮放到剛好放進去（桌機、iPad、橫拿的手機）。`stack`：同樣的控制項，照設定檔的 `portrait` 重新由上到下排列，給高的盒子用（直拿的手機）。不會捲動，也不會縮到比手指小。方形格子的機器（Launchpad）一律維持 `face`。`mode` 可以固定其中一種，`\'auto\'` 則跟著盒子走。',
      },
      {
        en: 'Every control repaints from the controller\'s state, so a finger here and a knob on the desk look the same, and a move from hardware gets a brief glow ring so you can see your hand arrive. Touch: drag a knob (right or up raises it), drag or click a fader or strip, strike a pad (higher on the pad is softer, lower is harder), hold a button, play the keys (multi-touch works). The mouse wheel turns knobs and faders.',
        zh: '每個控制項都從控制器的狀態重畫，所以螢幕上的手指和桌上的旋鈕看起來一樣，硬體動作則會有一圈短暫的光環，讓你看見自己的手「抵達」螢幕。操作：拖曳旋鈕（往右或往上是增加）、拖曳或點推桿與觸控條、敲打擊墊（敲在上半部較輕，下半部較重）、按住按鈕、彈琴鍵（支援多點觸控）。滑鼠滾輪可以轉旋鈕和推桿。',
      },
      {
        en: 'Keyboard: Tab reaches every control except the piano keys; the arrow keys, Page Up/Down, Home and End move knobs, faders and strips (Shift for fine steps); Space or Enter strikes pads and buttons, held while the key is held. Learn mode (`setLearning(true)`) turns every tap into "bind this control", and `view.onLearnTap = (id) => …` tells you which.',
        zh: '鍵盤：Tab 可以走到每個控制項（琴鍵除外），方向鍵、Page Up/Down、Home、End 移動旋鈕、推桿和觸控條（加 Shift 是微調），空白鍵或 Enter 敲打擊墊和按鈕，按著鍵就一直按著。學習模式（`setLearning(true)`）會讓每一次點擊都變成「綁定這個控制項」，`view.onLearnTap = (id) => …` 會告訴你是哪一個。',
      },
    ],
    needs: {
      en: 'A browser DOM and a container with a height. `createController(…).mount(el)` is the usual way to get one.',
      zh: '要有瀏覽器的 DOM，而且容器要有高度。平常用 `createController(…).mount(el)` 取得它。',
    },
    members: {
      setController: { en: 'Switches the view to another [`MidiController`](#MidiController) and rebuilds it.', zh: '把畫面切換到另一個 [`MidiController`](#MidiController) 並重建。' },
      setLearning: { en: 'Turns learn mode on or off: dashed outlines on every control, an orange outline on the armed one, orange labels on those already learned.', zh: '開啟或關閉學習模式：每個控制項有虛線外框，準備中的有橘色外框，已學過的標籤是橘色。' },
      setMode: { en: '`\'auto\'` (choose from the box), `\'face\'` or `\'stack\'`. Anything else means `\'auto\'`.', zh: '`\'auto\'`（依盒子選）、`\'face\'` 或 `\'stack\'`。其他值視同 `\'auto\'`。' },
      dispose: { en: 'Stops listening, disconnects the resize observer and removes the view from the page.', zh: '停止監聽、中斷尺寸觀察，並把畫面從頁面移除。' },
    },
    examples: [
      {
        code: `import { ControllerView, MidiController, profileById } from '@openav/midi';

const app = document.getElementById('app');
app.style.height = '240px';

const lpd8 = new MidiController(profileById('lpd8'));
const view = new ControllerView(app, lpd8);   // fills #app

lpd8.press('pad1');                            // pad 1 lights up
setTimeout(() => lpd8.release('pad1'), 600);`,
        caption: { en: 'The AKAI LPD8 appears in the page and pad 1 lights for a moment. Try dragging a knob or tapping the pads.', zh: '頁面上出現 AKAI LPD8，pad 1 亮了一下。可以試著拖曳旋鈕或敲打擊墊。' },
      },
      {
        code: `import { ControllerView, MidiController, profileById } from '@openav/midi';

const app = document.getElementById('app');
app.style.height = '360px';
app.style.width = '220px';                    // a tall, narrow box

const view = new ControllerView(app, new MidiController(profileById('lpd8')));
console.log(view.mode);                        // 'stack': re-gridded for a tall box
view.setMode('face');
console.log(view.mode);                        // 'face': the device as it looks`,
        caption: { en: 'Prints `stack`, then `face` after forcing the layout: the same controls in the two shapes.', zh: '印出 `stack`，強制指定版面之後印出 `face`：同樣的控制項，兩種形狀。' },
      },
    ],
    related: ['createController', 'MidiController', 'ControllerCanvas', 'mountMidiPanel', 'OavController', 'VIEW_CSS'],
    keywords: {
      en: ['faceplate', 'on-screen controller', 'view', 'touch', 'knobs and pads', 'face stack layout', 'accessibility', 'learn'],
      zh: ['面板', '螢幕控制器', '畫面', '觸控', '旋鈕與打擊墊', '版面', '無障礙', '學習'],
    },
  },

  VIEW_CSS: {
    group: 'controllers',
    summary: {
      en: 'The stylesheet text of the on-screen controller (`ControllerView`), as a string.',
      zh: '螢幕控制器（`ControllerView`）的樣式表文字，是一個字串。',
    },
    value: {
      type: 'String',
      en: 'CSS for the `.mcv…` classes. The view injects it by itself, once per document, or once per shadow root when it lives inside one (a `<style id="openav-midi-view-css">`).',
      zh: '`.mcv…` 那些 class 的 CSS。畫面會自己注入，每個文件注入一次，放在 shadow root 裡時則是每個 root 一次（一個 `<style id="openav-midi-view-css">`）。',
    },
    description: [
      {
        en: 'Advanced. You never need it to show a controller. It is exported for pages that build their own shadow DOM, a server-rendered preview or a theme that wants to read the rules. Colours use the CSS variables `--oav-focus`, `--body`, `--c` and `--cap` that the view sets per control.',
        zh: '進階用途。要顯示控制器的話完全用不到它。它是匯出給「自己建 shadow DOM 的頁面、伺服器端渲染的預覽、想讀規則的佈景」用的。顏色用的 CSS 變數有 `--oav-focus`、`--body`、`--c` 和 `--cap`，其中後三個由畫面針對每個控制項設定。',
      },
    ],
    examples: [
      {
        code: `import { VIEW_CSS } from '@openav/midi';

console.log(typeof VIEW_CSS, VIEW_CSS.length > 1000);
console.log(VIEW_CSS.includes('.mcv-pad'));   // the rules for pads`,
        caption: { en: 'Prints `string true`, then `true`: it is plain CSS text you can read or inject yourself.', zh: '印出 `string true`，再印出 `true`：它就是純 CSS 文字，可以自己讀或自己注入。' },
      },
    ],
    related: ['ControllerView', 'PANEL_CSS'],
    keywords: { en: ['css', 'stylesheet', 'shadow dom', 'view style'], zh: ['css', '樣式表', 'shadow dom', '畫面樣式'] },
  },

  mountMidiPanel: {
    group: 'controllers',
    summary: {
      en: 'Mounts a controller panel: a toolbar (device picker, hardware status, port picker, Learn, last message) above a playable faceplate, docked at the bottom or full size.',
      zh: '掛上一個控制器面板：上面一條工具列，有機器選單、硬體狀態、埠選單、學習按鈕和最後一則訊息的監看，下面是可以彈的面板，可以停靠在底部或填滿。',
    },
    params: [
      { name: 'parent', type: 'HTMLElement', en: 'The element to add the panel to. In `full` mode the panel is `position: absolute; inset: 0`, so give `parent` a position (`relative`) and a size.', zh: '要加進面板的元素。`full` 模式的面板是 `position: absolute; inset: 0`，所以 `parent` 要設 position（`relative`）並有大小。' },
      { name: 'mcs', type: 'MidiControllers', en: 'The manager that holds the devices and the hardware.', zh: '管理裝置與硬體的管理器。' },
      { name: 'mode', type: 'String', en: '`\'full\'` fills `parent`. `\'dock\'` is a drawer fixed to the bottom of the window, 40% of the window height by default, with a grip to drag its height (remembered in `localStorage`).', zh: '`\'full\'` 填滿 `parent`。`\'dock\'` 是固定在視窗底部的抽屜，預設佔視窗高度的 40%，有把手可以拖曳調整高度（記在 `localStorage`）。' },
      { name: 'open', type: 'Boolean', en: 'Whether it starts open. A closed dock builds its view only when opened.', zh: '一開始是否打開。關著的停靠面板要到打開時才建立畫面。' },
      { name: 'id', type: 'String | null', en: 'An element id for the panel.', zh: '面板的元素 id。' },
      { name: 'onToggle', type: 'Function | null', en: '`(open) => …` called when the panel opens or closes.', zh: '面板打開或關閉時呼叫 `(open) => …`。' },
      { name: 'closeButton', type: 'Boolean', en: 'Show a ✕ button. The default is on in `dock` mode only.', zh: '是否顯示 ✕ 按鈕。預設只有 `dock` 模式會顯示。' },
      { name: 'profiles', type: 'String[] | null', en: 'Limit the device picker to these profile ids.', zh: '把機器選單限制在這些設定檔 id。' },
      { name: 'contained', type: 'Boolean', en: 'Dock inside `parent` (absolute) instead of the window (fixed).', zh: '停靠在 `parent` 裡面（absolute），不是停靠在視窗（fixed）。' },
    ],
    returns: { type: '{ el, view, isOpen, open(), close(), toggle(), dispose() }', en: '`el` is the panel element, `view` the [`ControllerView`](#ControllerView) (once it exists), `isOpen` a boolean. `open()`, `close()` and `toggle()` return the same object; `close()` also releases held notes.', zh: '`el` 是面板元素，`view` 是 [`ControllerView`](#ControllerView)（建立之後才有），`isOpen` 是布林值。`open()`、`close()`、`toggle()` 回傳同一個物件，`close()` 還會放開按著的音。' },
    description: [
      {
        en: 'The bar shows which device is on screen (the picker switches it), a chip saying whether a hardware port drives it, a port picker when hardware is attached, a Learn button (click a control, then move the one on the hardware; a second button resets the mapping), and a tiny monitor that prints the last message, so you see the hardware talking before you see what it moves. Plugging in a known device switches the picker and the faceplate.',
        zh: '工具列顯示螢幕上是哪台機器（可以用選單切換）、一個說明有沒有硬體埠在驅動它的標籤、接了硬體時的埠選單、學習按鈕（點一個控制項，再動硬體上對應的那一個，另一個按鈕可以還原對應），以及一個小監看視窗印出最後一則訊息，讓你在看到它推動什麼之前，先看到硬體在說話。接上認得的機器時，選單和面板都會跟著切換。',
      },
    ],
    notes: [
      {
        en: 'The labels on the toolbar (Learn, Reset, the hardware chip) are written in Chinese only, whatever the page language is. `<oav-controller>` has an English and a Chinese toolbar; this panel is the one the lab and the phone tab use.',
        zh: '工具列上的文字是中文（學習、還原、硬體 …），不隨頁面語言改變。`<oav-controller>` 的工具列有英文和中文版，這個面板則是實驗室和手機分頁在用的那個。',
      },
    ],
    examples: [
      {
        code: `import { MidiControllers, PROFILES, mountMidiPanel } from '@openav/midi';

const app = document.getElementById('app');
app.style.cssText = 'position: relative; height: 320px';

const mcs = new MidiControllers({ profiles: PROFILES, initial: 'akai-lpd8' });
const panel = mountMidiPanel(app, mcs, { mode: 'full' });

console.log(panel.isOpen, panel.view.constructor.name);   // true ControllerView
mcs.current.press('pad2');                                  // the pad lights up in the panel
setTimeout(() => mcs.current.release('pad2'), 500);`,
        caption: { en: 'A panel with the toolbar and the AKAI LPD8 appears in the page; pad 2 lights for half a second. Switch the device in the picker.', zh: '頁面上出現帶工具列的面板和 AKAI LPD8，pad 2 亮了半秒。可以在選單裡切換機器。' },
      },
    ],
    related: ['MidiControllers', 'ControllerView', 'PANEL_CSS', 'createController'],
    keywords: {
      en: ['panel', 'dock', 'controller panel', 'device picker', 'learn button', 'monitor', 'drawer'],
      zh: ['面板', '停靠', '控制器面板', '機器選單', '學習按鈕', '監看', '抽屜'],
    },
  },

  PANEL_CSS: {
    group: 'controllers',
    summary: {
      en: 'The stylesheet text of the controller panel (`mountMidiPanel`), as a string.',
      zh: '控制器面板（`mountMidiPanel`）的樣式表文字，是一個字串。',
    },
    value: {
      type: 'String',
      en: 'CSS for the `.mcp…` classes. `mountMidiPanel()` injects it by itself, once per document (a `<style id="openav-midi-panel-css">` in the head).',
      zh: '`.mcp…` 那些 class 的 CSS。`mountMidiPanel()` 會自己注入，每個文件一次（放在 head 的 `<style id="openav-midi-panel-css">`）。',
    },
    description: [
      {
        en: 'Advanced: it is exported for pages that want to read or override the rules. You never need it to mount a panel.',
        zh: '進階用途：匯出給想讀或覆寫規則的頁面。掛上面板時完全用不到它。',
      },
    ],
    examples: [
      {
        code: `import { PANEL_CSS } from '@openav/midi';

console.log(PANEL_CSS.includes('.mcp.dock'));   // the drawer rules`,
        caption: { en: 'Prints `true`: the panel\'s rules are readable CSS text.', zh: '印出 `true`：面板的規則是看得懂的 CSS 文字。' },
      },
    ],
    related: ['mountMidiPanel', 'VIEW_CSS'],
    keywords: { en: ['css', 'panel style', 'dock style'], zh: ['css', '面板樣式', '停靠樣式'] },
  },

  // ---------------------------------------------------------------- drawing a controller into a 2D canvas (for video)

  ControllerCanvas: {
    group: 'controllers',
    summary: {
      en: 'Draws a controller\'s faceplate into any 2D canvas context, every frame, at any size: the bottom of a performance video, an overlay, a thumbnail.',
      zh: '把控制器的面板畫進任何 2D 畫布，每個畫面都畫，任何大小都行：演出影片的下半部、疊圖、縮圖。',
    },
    params: [
      { name: 'profile', type: 'String | Object', en: 'Profile id, short name or object. An unknown id throws `ControllerCanvas: unknown profile "x"`.', zh: '設定檔 id、短名稱或物件。不認得的 id 會丟出 `ControllerCanvas: unknown profile "x"`。' },
      { name: 'signals', type: 'Signals | null', en: 'Follow the generic MIDI names on this bus (`midi/ch/<ch>/…`, `midi/note/on|off`, `midi/cc/<n>`, `midi/bend`): live hardware, the on-screen controller, the QWERTY piano, phones and a recorded take playing back all move the panel. Each message counts once, though hardware publishes it under two names.', zh: '跟隨這條匯流排上的通用 MIDI 名稱（`midi/ch/<ch>/…`、`midi/note/on|off`、`midi/cc/<n>`、`midi/bend`）：實際的硬體、螢幕控制器、電腦鍵盤鋼琴、手機，以及正在回放的錄音，都會讓面板動起來。硬體的一則訊息雖然用兩個名稱發佈，也只會算一次。' },
      { name: 'controller', type: 'MidiController | null', en: 'Follow this existing controller instead of the bus: exactly that device, with its learned mapping. A recorded take does not reach it. When given, `signals` is ignored.', zh: '改為跟隨這個現有的控制器，不聽匯流排：正好就是那一台，連同它學到的對應。錄音回放不會傳到它。有給的話會忽略 `signals`。' },
      { name: 'mapping', type: 'Object | null', en: 'Learned bindings to apply to the panel\'s own controller: the `exportMapping()` of the live device.', zh: '要套用到面板自己的控制器上的學習結果：就是實機控制器的 `exportMapping()`。' },
      { name: 'theme', type: 'Object', en: 'Any subset of [`CANVAS_THEME`](#CANVAS_THEME): colours, `glow`, fonts.', zh: '[`CANVAS_THEME`](#CANVAS_THEME) 的任何子集：顏色、`glow`、字型。' },
      { name: 'notes', type: 'Boolean | \'auto\'', en: 'Write the held notes large under the faceplate. `\'auto\'` does it when the area has room, `true` makes room, `false` never.', zh: '把按著的音大大地寫在面板下面。`\'auto\'` 是區域有空間時才寫，`true` 會擠出空間，`false` 永遠不寫。' },
      { name: 'screen', type: 'Boolean', en: 'The device\'s own screen (MiniLab 3, KeyStep) shows the last touch, as the hardware\'s does: `Knob 3 · 87`, `C4 · 100`.', zh: '機器自己的螢幕（MiniLab 3、KeyStep）顯示最後一次碰了什麼，跟實機一樣：`Knob 3 · 87`、`C4 · 100`。' },
      { name: 'padding', type: 'Number', en: 'Space around the faceplate, as a share of the area\'s short side.', zh: '面板周圍的留白，以區域短邊的比例表示。' },
      { name: 'now', type: 'Function', en: 'The clock in milliseconds that the fades use; default `performance.now()`. The `now` you pass to `draw()` must be on the same clock.', zh: '淡出效果用的時鐘（毫秒），預設是 `performance.now()`。傳給 `draw()` 的 `now` 要用同一個時鐘。' },
    ],
    description: [
      {
        en: 'The on-screen controller is DOM: perfect to play, impossible to record, because a page cannot capture its own DOM into a video. This draws the same faceplate, every section where it sits on the device and in the same colours, straight into a 2D context. It is vector and drawn at the output size, so a 4K frame is as sharp as a 1080 one, and it costs a few hundred path calls a frame. `@openav/record`\'s `Compositor#setPanel` takes one.',
        zh: '螢幕上的控制器是 DOM：很適合彈，卻沒辦法錄，因為網頁不能把自己的 DOM 錄進影片。這個類別把同一個面板直接畫進 2D 畫布，每個區塊都在機器上原本的位置，用同樣的顏色。它是向量，直接以輸出的大小繪製，所以 4K 畫面跟 1080 一樣清楚，每個畫面約花幾百次路徑呼叫。`@openav/record` 的 `Compositor#setPanel` 就是接收它。',
      },
      {
        en: 'Call `panel.draw(ctx, { x, y, w, h })` every frame, or `panel.renderTo(canvas)` to fill a canvas of its own. What a video needs that a screen does not: a touch has to stay visible for a few frames (30 fps is 33 ms; a staccato note can be shorter), so released keys and pads fade out instead of switching off, the control a hand just moved glows, and the keyboard follows the device\'s octave buttons. `panel.aspect` is the faceplate\'s width ÷ height, for reserving an area of that shape. With neither `signals` nor `controller` the panel just stays at rest.',
        zh: '每個畫面呼叫 `panel.draw(ctx, { x, y, w, h })`，或用 `panel.renderTo(canvas)` 畫滿一張自己的畫布。影片需要而螢幕不需要的東西：一次觸碰要在畫面上留幾格（30 fps 是 33 毫秒，很短的斷音可能比這還短），所以放開的琴鍵和打擊墊會淡出而不是直接熄掉，剛被手動過的控制項會發光，鍵盤也會跟著機器的八度按鈕移動。`panel.aspect` 是面板的寬除以高，可用來預留相同形狀的區域。`signals` 和 `controller` 都沒給時，面板就只是靜止不動。',
      },
    ],
    notes: [
      {
        en: 'It is a silent model: it publishes nothing back to the bus. `panel.dispose()` stops listening to the bus or controller (a controller you passed in is left as it was).',
        zh: '它是個安靜的模型：不會往匯流排發佈任何東西。`panel.dispose()` 會停止聽匯流排或控制器（你傳進來的控制器不會被動到）。',
      },
    ],
    members: {
      profile: { en: 'The profile being drawn (normalized).', zh: '正在畫的設定檔（整理過的）。' },
      aspect: { en: 'Width ÷ height of the faceplate. Layouts use it to reserve an area of this shape (a picture-in-picture corner).', zh: '面板的寬除以高。版面可以用它預留這種形狀的區域（子母畫面的角落）。' },
      geometry: { en: 'Returns [`controllerGeometry()`](#controllerGeometry) for that rect with this panel\'s `padding` and `notes`, cached while the rect stays the same.', zh: '回傳該區域的 [`controllerGeometry()`](#controllerGeometry)，使用這個面板的 `padding` 和 `notes`，區域沒變時會使用快取。' },
      reset: { en: 'Releases every held key and pad, as insurance against a stuck key between takes. Nothing is published.', zh: '放開所有按著的琴鍵和打擊墊，在兩段錄音之間預防卡住的音。不發佈任何東西。' },
      draw: { en: 'Draws into `rect` (`{ x, y, w, h }` in pixels) of a 2D context. Call it every frame. It saves and restores the context. `now` is on the same clock as the `now` option, in milliseconds.', zh: '畫進 2D 畫布的 `rect`（`{ x, y, w, h }`，單位是像素）。每個畫面都呼叫。它會儲存並還原畫布狀態。`now` 跟 `now` 選項用同一個時鐘，單位是毫秒。' },
      renderTo: { en: 'Draws into a canvas of its own, filling the whole canvas (an overlay, a thumbnail). Returns the canvas.', zh: '畫進一張自己的畫布，畫滿整張（疊圖、縮圖）。回傳那張畫布。' },
      dispose: { en: 'Stops listening to the bus or controller.', zh: '停止聽匯流排或控制器。' },
    },
    examples: [
      {
        code: `import { Signals } from '@openav/core';
import { ControllerCanvas, genericSignals, publish } from '@openav/midi';

const signals = new Signals();
const panel = new ControllerCanvas({ profile: 'minilab3', signals });

// a chord, a pad and a knob, published as the hardware would
const play = (ev) => publish(signals, genericSignals(ev));
play({ type: 'noteon', ch: 1, note: 60, vel: 100 });
play({ type: 'noteon', ch: 1, note: 64, vel: 100 });
play({ type: 'noteon', ch: 10, note: 36, vel: 127 });
play({ type: 'cc', ch: 1, cc: 74, value: 100 });

panel.renderTo(document.getElementById('c'));   // fills the 400 x 300 canvas`,
        caption: { en: 'The Arturia MiniLab 3 is drawn into the canvas with C4 and E4 lit, pad 1 lit, and knob 1 turned up. The device screen reads `Knob 1 · 100`.', zh: 'Arturia MiniLab 3 被畫進畫布，C4 和 E4 亮著，pad 1 亮著，旋鈕 1 轉大了。機器的螢幕寫著 `Knob 1 · 100`。' },
      },
      {
        code: `import { Signals } from '@openav/core';
import { ControllerCanvas, genericSignals, publish } from '@openav/midi';

const signals = new Signals();
const panel = new ControllerCanvas({ profile: 'lpd8', signals, theme: { accent: '#7ea6ff' } });
const ctx = document.getElementById('c').getContext('2d');
const send = (ev) => publish(signals, genericSignals(ev));

let frame = 0;
function tick() {
  const pad = 36 + Math.floor(frame / 20) % 8;
  if (frame % 20 === 0) send({ type: 'noteon', ch: 10, note: pad, vel: 110 });   // hit a pad
  if (frame % 20 === 8) send({ type: 'noteoff', ch: 10, note: pad });             // let go: it fades out
  panel.draw(ctx, { x: 0, y: 0, w: 400, h: 300 });
  if (++frame < 120) requestAnimationFrame(tick);
}
tick();`,
        caption: { en: 'A different pad of the LPD8 lights every third of a second and then fades, all in one accent colour, as it would in a recorded video.', zh: 'LPD8 的打擊墊每三分之一秒換一個亮起，然後淡出，全部是同一個強調色，就像錄進影片時的樣子。' },
      },
    ],
    related: ['controllerGeometry', 'CANVAS_THEME', 'followMidiSignals', 'ControllerView', 'eventOfSignal', 'MidiController'],
    keywords: {
      en: ['draw controller', 'canvas', 'video overlay', 'record controller', 'compositor', 'picture in picture', 'faceplate on canvas', 'thumbnail'],
      zh: ['畫控制器', '畫布', '影片疊圖', '錄製控制器', '合成', '子母畫面', '畫布上的面板', '縮圖'],
    },
  },

  CANVAS_THEME: {
    group: 'controllers',
    summary: {
      en: 'The default look of `ControllerCanvas`: background, body, text, idle colours, `accent`, `glow` and fonts. Pass any subset as the `theme` option.',
      zh: '`ControllerCanvas` 的預設外觀：背景、機身、文字、待機顏色、`accent`、`glow` 和字型。把任何子集當作 `theme` 選項傳入即可。',
    },
    value: {
      type: 'Object',
      en: 'A frozen object (you cannot change it; pass `theme` instead). Keys: `bg` (the area around the device; `null` leaves what is underneath), `body` (the faceplate; `null` uses the profile\'s `face.body`), `ink` (big text), `label` (control labels), `dim` (faceplate and section lettering), `idle` (a pad at rest), `button`, `cap` (knob caps), `well` (fader slots and strip wells), `screen`, `screenInk`, `screenDim`, `accent` (one colour for everything that moves; `null` keeps each control\'s own), `glow` (0 flat to 1 like the on-screen controller) and the fonts `font` and `mono`.',
      zh: '凍結的物件（不能修改，要用 `theme` 選項覆寫）。鍵有：`bg`（機器周圍的區域，`null` 表示保留底下原本的畫面）、`body`（面板，`null` 用設定檔的 `face.body`）、`ink`（大字）、`label`（控制項標籤）、`dim`（面板與區塊的文字）、`idle`（待機的打擊墊）、`button`、`cap`（旋鈕蓋）、`well`（推桿溝槽和觸控條底）、`screen`、`screenInk`、`screenDim`、`accent`（所有會動的東西用同一個顏色，`null` 保留各控制項自己的顏色）、`glow`（0 是平面，1 是跟螢幕控制器一樣的光暈），以及字型 `font` 和 `mono`。',
    },
    description: [
      {
        en: 'Colours are CSS colour strings. `bg: null` lets the video or page underneath show through, and `accent: \'#7ea6ff\'` makes the panel monochrome-with-one-colour, which suits a branded video.',
        zh: '顏色都是 CSS 顏色字串。`bg: null` 讓底下的影片或頁面透出來，`accent: \'#7ea6ff\'` 則讓整個面板只用一個顏色，很適合有品牌色的影片。',
      },
    ],
    examples: [
      {
        code: `import { CANVAS_THEME, ControllerCanvas } from '@openav/midi';

console.log(CANVAS_THEME.bg, CANVAS_THEME.accent, CANVAS_THEME.glow);

// a transparent, one-colour, flat panel
const panel = new ControllerCanvas({ profile: 'lpd8', theme: { bg: null, accent: '#ffb547', glow: 0 } });
console.log(panel.theme.bg, panel.theme.accent, panel.theme.glow, panel.theme.ink);`,
        caption: { en: 'Prints the defaults (`#060709 null 1`), then the panel\'s theme with your three keys replaced and everything else (such as `ink`) kept.', zh: '印出預設值（`#060709 null 1`），再印出面板的外觀：你指定的三個鍵被取代，其他（例如 `ink`）維持原樣。' },
      },
    ],
    related: ['ControllerCanvas', 'controllerGeometry'],
    keywords: { en: ['theme', 'colors', 'accent', 'glow', 'transparent background', 'branding'], zh: ['外觀', '顏色', '強調色', '光暈', '透明背景', '品牌色'] },
  },

  controllerGeometry: {
    group: 'controllers',
    summary: {
      en: 'Computes where everything goes when a profile\'s faceplate is drawn into a pixel rectangle: the face, every section, every control cell, and the notes strip.',
      zh: '算出設定檔的面板畫進某個像素矩形時，每樣東西的位置：面板、每個區塊、每個控制項的格子，以及音名條。',
    },
    params: [
      { name: 'profile', type: 'Object', en: 'A normalized profile (`MidiController#profile`).', zh: '整理過的設定檔（`MidiController#profile`）。' },
      { name: 'rect', type: '{ x, y, w, h }', en: 'The area, in pixels.', zh: '區域，單位是像素。' },
      { name: 'padding', type: 'Number', en: 'Space around the faceplate, as a share of the rect\'s short side (0..1).', zh: '面板周圍的留白，以矩形短邊的比例表示（0..1）。' },
      { name: 'notes', type: 'Boolean | \'auto\'', en: 'Reserve a strip under the faceplate for the held notes: `true` always, `false` never, `\'auto\'` when the rect has room.', zh: '在面板下面預留一條放按著的音的位置：`true` 一定有，`false` 一定沒有，`\'auto\'` 是矩形有空間時才有。' },
    ],
    returns: { type: '{ u, face, notes, sections, controls, deco }', en: '`u` is the pixel size of one face unit. `face` is `{ x, y, w, h }`. `notes` is the strip or `null`. `sections` is a list with `id`, `label`, the box and its `grid`. `controls` is a `Map` from control id to `{ id, type, section, x, y, w, h }`. `deco` lists the decorations (screen, logo, lettering) in pixels.', zh: '`u` 是一個面板單位的像素大小。`face` 是 `{ x, y, w, h }`。`notes` 是那一條或 `null`。`sections` 是帶有 `id`、`label`、外框和 `grid` 的清單。`controls` 是從控制項 id 對到 `{ id, type, section, x, y, w, h }` 的 `Map`。`deco` 列出以像素表示的裝飾（螢幕、標誌、文字）。' },
    description: [
      {
        en: 'The faceplate keeps its own proportions, centred in the rect. The sections are laid out the way the on-screen controller\'s CSS grid does (row or column flow, spans), so the canvas drawing and the DOM agree. It is pure, so it is the part to test, and the part to use when you want to draw something of your own on top of a control.',
        zh: '面板維持自己的比例，置中在矩形裡。區塊的排法跟螢幕控制器的 CSS grid 一致（橫向或直向排列、跨格），所以畫布上的繪製和 DOM 版本一致。它是純函式，適合拿來測試，也適合在你想在某個控制項上疊自己畫的東西時使用。',
      },
    ],
    examples: [
      {
        code: `import { controllerGeometry, normalizeProfile, profileById } from '@openav/midi';

const profile = normalizeProfile(profileById('lpd8'));
const g = controllerGeometry(profile, { x: 0, y: 0, w: 400, h: 300 });

console.log(g.face);                    // the faceplate, centred, in pixels
console.log(g.controls.get('pad1'));    // where pad 1 is
console.log(g.controls.size, 'controls', g.notes ? 'with a notes strip' : 'without a notes strip');`,
        caption: { en: 'Prints the faceplate rectangle (370 wide, centred), pad 1\'s cell in pixels, then `16 controls with a notes strip`.', zh: '印出面板的矩形（寬 370，置中）、pad 1 的格子位置（像素），再印出 `16 controls with a notes strip`。' },
      },
    ],
    related: ['ControllerCanvas', 'keyboardGeometry', 'normalizeProfile'],
    keywords: { en: ['layout', 'geometry', 'rect', 'cell positions', 'where is the knob', 'faceplate size'], zh: ['版面', '幾何', '矩形', '格子位置', '旋鈕在哪', '面板大小'] },
  },

  keyboardGeometry: {
    group: 'controllers',
    summary: {
      en: 'Computes the rectangles of piano keys from one note to another inside a rect: white keys side by side, black keys over the seams at 60% of the height.',
      zh: '算出從某個音到另一個音的琴鍵在矩形裡的位置：白鍵並排，黑鍵蓋在縫上，高度是 60%。',
    },
    params: [
      { name: 'from', type: 'Number', en: 'The first MIDI note.', zh: '第一個 MIDI 音符。' },
      { name: 'to', type: 'Number', en: 'The last MIDI note.', zh: '最後一個 MIDI 音符。' },
      { name: 'rect', type: '{ x, y, w, h }', en: 'The area the keys fill.', zh: '琴鍵要填滿的區域。' },
    ],
    returns: { type: '{ note, white, x, y, w, h }[]', en: 'One item per key, the white keys first and then the black ones (the draw order, so the black keys end up on top).', zh: '每個琴鍵一項，先是白鍵再是黑鍵（也就是繪製順序，這樣黑鍵會疊在上面）。' },
    description: [
      {
        en: 'A range never starts on a black key: a black key with no white key before it is left out, the way the on-screen keyboard does. White keys share the width equally, so 48 to 72 is 15 white keys and 10 black ones.',
        zh: '音域不會從黑鍵開始：前面沒有白鍵的黑鍵會被省略，螢幕上的鍵盤也是這樣。白鍵平分寬度，所以 48 到 72 是 15 個白鍵加 10 個黑鍵。',
      },
    ],
    examples: [
      {
        code: `import { keyboardGeometry } from '@openav/midi';

const keys = keyboardGeometry(60, 72, { x: 0, y: 0, w: 400, h: 100 });
console.log(keys.filter((k) => k.white).length, 'white,', keys.filter((k) => !k.white).length, 'black');
console.log(keys[0].note, keys[0].x, keys[0].w);   // 60 (C4) is the first white key`,
        caption: { en: 'Prints `8 white, 5 black` (one octave and the next C), then the first key\'s note and its position.', zh: '印出 `8 white, 5 black`（一個八度加上下一個 C），再印出第一個鍵的音符和位置。' },
      },
    ],
    related: ['ControllerCanvas', 'keyWindow', 'controllerGeometry'],
    keywords: { en: ['piano keys', 'keyboard layout', 'white keys', 'black keys', 'draw keyboard'], zh: ['琴鍵', '鍵盤版面', '白鍵', '黑鍵', '畫鍵盤'] },
  },

  keyWindow: {
    group: 'controllers',
    summary: {
      en: 'Tells which note a drawn keyboard should start at after a note outside its printed range arrives, so it follows the device\'s octave buttons.',
      zh: '一個超出印刷音域的音符到來之後，算出畫出來的鍵盤該從哪個音開始，這樣它就能跟著機器的八度按鈕走。',
    },
    params: [
      { name: 'from', type: 'Number', en: 'The first note of the printed range.', zh: '印刷音域的第一個音。' },
      { name: 'to', type: 'Number', en: 'The last note of the printed range.', zh: '印刷音域的最後一個音。' },
      { name: 'base', type: 'Number', en: 'The first note shown now.', zh: '目前顯示的第一個音。' },
      { name: 'note', type: 'Number', en: 'A note that just went down.', zh: '剛剛按下的音。' },
    ],
    returns: { type: 'Number', en: 'The new first note: `base` when the note fits, otherwise `base` moved by the fewest octaves that reach it, held to the MIDI range.', zh: '新的第一個音：音符放得進去就回傳 `base`，否則是把 `base` 移動剛好夠的最少八度，並限制在 MIDI 範圍內。' },
    description: [
      {
        en: 'A keyboard control catches notes outside its printed range, because the device\'s Oct+/Oct− buttons shift what the keys send. When one arrives, the drawing moves and stays there, as the device does. A 48 to 72 MiniLab with Oct+ pressed (a note of 76) shows 60 to 84. A range narrower than an octave just moves to reach the note.',
        zh: '琴鍵控制項會接住超出印刷音域的音，因為機器的 Oct+/Oct− 按鈕會改變琴鍵送出的音。這種音到來時，畫面會移動並停在那裡，就像實機一樣。48 到 72 的 MiniLab 按下 Oct+（音符 76）後，畫面會顯示 60 到 84。窄於一個八度的音域，則是直接移動到夠到那個音為止。',
      },
    ],
    examples: [
      {
        code: `import { keyWindow } from '@openav/midi';

console.log(keyWindow(48, 72, 48, 60));    // 48: inside the window, unchanged
console.log(keyWindow(48, 72, 48, 76));    // 60: Oct+ on the MiniLab
console.log(keyWindow(48, 72, 48, 40));    // 36: Oct-
console.log(keyWindow(48, 72, 48, 127));   // 103: held to the MIDI range`,
        caption: { en: 'Prints 48, 60, 36 and 103.', zh: '印出 48、60、36、103。' },
      },
    ],
    related: ['keyboardGeometry', 'ControllerCanvas'],
    keywords: { en: ['octave shift', 'oct+', 'keyboard window', 'follow octave'], zh: ['八度移位', 'oct+', '鍵盤視窗', '跟著八度'] },
  },

  followMidiSignals: {
    group: 'controllers',
    summary: {
      en: 'Listens to a `Signals` bus and hands you each MIDI message back exactly once, as an event, although hardware publishes it under two names.',
      zh: '監聽 `Signals` 匯流排，並把每則 MIDI 訊息「剛好一次」以事件的形式還給你，雖然硬體會用兩個名稱發佈同一則訊息。',
    },
    params: [
      { name: 'signals', type: 'Signals', en: 'The bus. It needs `onAny(cb)`.', zh: '匯流排，需要有 `onAny(cb)`。' },
      { name: 'onEvent', type: 'Function', en: '`(ev) => …` called with an event of [`parseMessage()`](#parseMessage) for each message.', zh: '每則訊息都以 [`parseMessage()`](#parseMessage) 的事件格式呼叫 `(ev) => …`。' },
      { name: 'channel', type: 'Number', en: 'The channel given to legacy CC and bend names, which carry none.', zh: '指定給短名稱 CC 和彎音用的頻道，因為它們本身沒有頻道資訊。' },
      { name: 'defer', type: 'Function', en: '`(fn) => …` that schedules the flush of legacy-only names. Default `queueMicrotask`; replaceable in tests.', zh: '排程「只有短名稱」那批訊息的 flush 用的 `(fn) => …`。預設是 `queueMicrotask`，測試時可以換掉。' },
    ],
    returns: { type: '{ flush(), dispose() }', en: '`flush()` delivers legacy-only messages that are still waiting. `dispose()` stops listening and drops them.', zh: '`flush()` 送出還在等待的「只有短名稱」訊息。`dispose()` 停止監聽並丟掉它們。' },
    description: [
      {
        en: 'Hardware and the on-screen controllers publish every message twice: the legacy name (`midi/note/on`) and then the per-channel one (`midi/ch/1/note/60`) in one call. The QWERTY piano and some takes publish only the legacy name. A per-channel name counts at once; a legacy name waits for a microtask and is dropped if its per-channel twin shows up first. So a relative encoder never turns twice, a legacy CC (which has no channel) never lands on the wrong channel, and order is kept.',
        zh: '硬體和螢幕控制器對每則訊息都會發佈兩次：先是短名稱（`midi/note/on`），緊接著在同一次呼叫裡是分頻道的名稱（`midi/ch/1/note/60`）。電腦鍵盤鋼琴和某些錄音只發佈短名稱。分頻道的名稱會立刻算數，短名稱則等一個 microtask，如果它分頻道的孿生兄弟先到了就丟掉。所以相對旋鈕不會轉兩次，沒有頻道的短名稱 CC 也不會落到錯誤的頻道，順序也會保持。',
      },
      {
        en: '[`ControllerCanvas`](#ControllerCanvas) uses it. Use it yourself to turn a bus back into MIDI events, for example to drive your own visual from a recorded take.',
        zh: '[`ControllerCanvas`](#ControllerCanvas) 用的就是它。想把匯流排變回 MIDI 事件時可以自己用，例如用錄下的演奏去驅動你自己的畫面。',
      },
    ],
    examples: [
      {
        code: `import { Signals } from '@openav/core';
import { followMidiSignals, genericSignals, publish } from '@openav/midi';

const signals = new Signals();
const follower = followMidiSignals(signals, (ev) => console.log(ev.type, ev.note ?? ev.cc, ev.ch));

// the hardware publishes a message under both names; the follower reports it once
publish(signals, genericSignals({ type: 'noteon', ch: 2, note: 60, vel: 100 }));
publish(signals, genericSignals({ type: 'cc', ch: 2, cc: 74, value: 64 }));

// the QWERTY piano publishes only the short name: it arrives after a microtask, or at flush()
signals.pulse('midi/note/on', { note: 64, vel: 0.8, ch: 0 });
follower.flush();
follower.dispose();`,
        caption: { en: 'Prints three lines: `noteon 60 2`, `cc 74 2`, then `noteon 64 1` for the piano (channel 0 becomes the default channel 1).', zh: '印出三行：`noteon 60 2`、`cc 74 2`，然後是鍵盤鋼琴的 `noteon 64 1`（頻道 0 變成預設的頻道 1）。' },
      },
    ],
    related: ['eventOfSignal', 'genericSignals', 'ControllerCanvas'],
    keywords: { en: ['signals to midi events', 'dedupe', 'each message once', 'bus listener', 'take playback'], zh: ['訊號轉 midi 事件', '去重複', '每則一次', '匯流排監聽', '回放'] },
  },

  touchText: {
    group: 'controllers',
    summary: {
      en: 'Writes what a device\'s screen says about a touch: `Knob 1 · 87`, `C4 · 100`, `Pad 3 · 96`, `Pitch +0.42`.',
      zh: '寫出機器的螢幕會怎麼描述一次觸碰：`Knob 1 · 87`、`C4 · 100`、`Pad 3 · 96`、`Pitch +0.42`。',
    },
    params: [
      { name: 'c', type: 'Object', en: 'The control\'s definition (from the normalized profile). `null` gives an empty string.', zh: '控制項的定義（來自整理過的設定檔）。給 `null` 會回傳空字串。' },
      { name: 'st', type: 'Object', en: 'Its state: `{ raw, value, held, pos }`.', zh: '它的狀態：`{ raw, value, held, pos }`。' },
      { name: 'note', type: 'Number | null', en: 'For a keys control, the note that was touched.', zh: '琴鍵控制項要給：被碰到的音符。' },
    ],
    returns: { type: 'String', en: 'The line. A control whose label is only a number is named after its type (`Knob 1`). A pad shows its velocity only while held, a button shows `on` or `off`, a relative encoder shows its position as a percentage, and a bipolar wheel shows a signed value.', zh: '那一行文字。標籤只是數字的控制項，會用類型來命名（`Knob 1`）。打擊墊只有按著時才顯示力度，按鈕顯示 `on` 或 `off`，相對旋鈕以百分比顯示位置，雙向彎音輪則顯示有正負號的值。' },
    description: [
      {
        en: '[`ControllerCanvas`](#ControllerCanvas) draws this text on the device\'s screen (MiniLab 3, KeyStep) so a video shows what the hardware\'s own screen would. It is pure, so it is easy to reuse for a caption or a log.',
        zh: '[`ControllerCanvas`](#ControllerCanvas) 把這段文字畫在機器的螢幕上（MiniLab 3、KeyStep），讓影片裡看得到實機螢幕會顯示的內容。它是純函式，拿去當字幕或記錄也很方便。',
      },
    ],
    examples: [
      {
        code: `import { touchText, normalizeProfile, profileById } from '@openav/midi';

const p = normalizeProfile(profileById('minilab3'));
const c = (id) => p.controls.find((x) => x.id === id);

console.log(touchText(c('knob1'), { raw: 87 }));                // Knob 1 · 87
console.log(touchText(c('keys'), { raw: 100 }, 60));            // C4 · 100
console.log(touchText(c('pad3'), { held: true, raw: 96 }));     // Pad 3 · 96
console.log(touchText(c('pitch'), { value: -0.5 }));            // Pitch −0.50`,
        caption: { en: 'Prints the four lines shown in the comments.', zh: '印出註解裡的那四行。' },
      },
    ],
    related: ['ControllerCanvas', 'midiNoteName'],
    keywords: { en: ['device screen text', 'last touched', 'caption', 'knob 1 87'], zh: ['機器螢幕文字', '最後碰觸', '字幕', 'knob 1 87'] },
  },

  midiNoteName: {
    group: 'controllers',
    summary: {
      en: 'Turns a MIDI note number into its name with the octave, middle C being C4: `midiNoteName(60)` is `\'C4\'`, `midiNoteName(61)` is `\'C#4\'`.',
      zh: '把 MIDI 音符號碼轉成帶八度的音名，中央 C 是 C4：`midiNoteName(60)` 是 `\'C4\'`，`midiNoteName(61)` 是 `\'C#4\'`。',
    },
    params: [
      { name: 'n', type: 'Number', en: 'A MIDI note number, 0..127.', zh: 'MIDI 音符號碼，0..127。' },
    ],
    returns: { type: 'String', en: 'Sharps only (`\'C#4\'`, never `\'Db4\'`). 0 is `\'C-1\'` and 127 is `\'G9\'`.', zh: '只用升記號（`\'C#4\'`，不會是 `\'Db4\'`）。0 是 `\'C-1\'`，127 是 `\'G9\'`。' },
    description: [
      {
        en: 'This is the on-screen keyboard\'s convention. Some software (Ableton Live, Yamaha) calls 60 "C3": the number is the same, only the octave label differs. In a p5 sketch, [`noteName()`](#noteName) does the same and also writes flats when you ask.',
        zh: '這是螢幕鍵盤採用的寫法。有些軟體（Ableton Live、Yamaha）把 60 叫做「C3」：號碼是一樣的，只有八度的標示不同。在 p5 草圖裡，[`noteName()`](#noteName) 做同樣的事，而且需要時可以寫成降記號。',
      },
    ],
    examples: [
      {
        code: `import { midiNoteName } from '@openav/midi';

console.log([60, 61, 69, 0, 127].map(midiNoteName));   // [ 'C4', 'C#4', 'A4', 'C-1', 'G9' ]`,
        caption: { en: 'Prints the five note names.', zh: '印出五個音名。' },
      },
    ],
    related: ['noteName', 'noteNumber', 'touchText'],
    keywords: { en: ['note name', 'midi note', 'C4', 'middle C', 'convert'], zh: ['音名', 'midi 音符', 'C4', '中央 C', '轉換'] },
  },

  fadeLevel: {
    group: 'controllers',
    summary: {
      en: 'The brightness of a fading touch: 1 at the moment it happened, 0 after `ms`, eased so it still reads on a 30 fps frame.',
      zh: '一次淡出中的觸碰目前有多亮：發生的那一刻是 1，經過 `ms` 之後是 0，並做了緩和，所以在 30 fps 的畫面上仍然看得出來。',
    },
    params: [
      { name: 'now', type: 'Number', en: 'The current time in milliseconds.', zh: '目前的時間（毫秒）。' },
      { name: 'at', type: 'Number | null', en: 'When the touch happened, on the same clock. `null` or `undefined` gives 0.', zh: '觸碰發生的時間，用同一個時鐘。`null` 或 `undefined` 會得到 0。' },
      { name: 'ms', type: 'Number', en: 'How long the fade lasts. Not above 0 gives 0.', zh: '淡出持續多久。不大於 0 會得到 0。' },
    ],
    returns: { type: 'Number', en: 'From 1 down to 0. The curve is the square of the remaining time, so it falls quickly at first.', zh: '從 1 降到 0。曲線是剩餘時間的平方，所以一開始掉得比較快。' },
    description: [
      {
        en: '[`ControllerCanvas`](#ControllerCanvas) fades released keys (180 ms), pads (450 ms), the glow of a touched control (650 ms), the last-touch text under the faceplate (1600 ms) and on the device screen (3200 ms) with it. A video frame is 33 ms at 30 fps, so a staccato note that was 20 ms long would be gone before the next frame without a fade.',
        zh: '[`ControllerCanvas`](#ControllerCanvas) 用它讓放開的琴鍵（180 毫秒）、打擊墊（450 毫秒）、被碰到的控制項光暈（650 毫秒）、面板下方的最後觸碰文字（1600 毫秒）和機器螢幕上的文字（3200 毫秒）淡出。30 fps 的影片一格是 33 毫秒，沒有淡出的話，20 毫秒長的斷音在下一格之前就消失了。',
      },
    ],
    examples: [
      {
        code: `import { fadeLevel } from '@openav/midi';

for (const now of [100, 200, 300, 400, 500]) console.log(now, fadeLevel(now, 100, 400));`,
        caption: { en: 'Prints 1 at the moment of the touch, then 0.5625, 0.25, 0.0625 and 0 at the end of the fade.', zh: '觸碰當下印出 1，之後是 0.5625、0.25、0.0625，淡出結束時是 0。' },
      },
    ],
    related: ['ControllerCanvas'],
    keywords: { en: ['fade', 'ease', 'decay', 'video frame', 'staccato'], zh: ['淡出', '緩和', '衰減', '影片畫格', '斷音'] },
  },

  // ================================================================== the embed: <oav-controller>, the iframe page, their pure helpers

  OavController: {
    group: 'controllers',
    summary: {
      en: 'The `oav-controller` custom element: a playable MIDI controller you paste into any page with one line, with no import map and no build.',
      zh: '`<oav-controller>` 自訂元素：用一行就能貼進任何頁面的、可以彈的 MIDI 控制器，不需要 import map，也不需要建置。',
    },
    description: [
      {
        en: 'Load `@openav/midi/element` (`https://openaudiovisual.com/packages/midi/element.js`) once and write `<oav-controller profile="akai-lpd8" readout></oav-controller>`. Importing the file registers the tag by itself. It is a shadow-DOM element, so the page\'s CSS cannot bend it and it cannot bend the page. It plays with a mouse, a finger, a pen and the keyboard, with or without Web MIDI: on Safari and iPad it still plays and fires events, and only the hardware and MIDI-out parts say they are unavailable.',
        zh: '載入一次 `@openav/midi/element`（`https://openaudiovisual.com/packages/midi/element.js`），然後寫 `<oav-controller profile="akai-lpd8" readout></oav-controller>`。匯入這個檔案時會自動註冊標籤。它是 shadow DOM 元素，所以頁面的 CSS 影響不到它，它也不會影響頁面。滑鼠、手指、觸控筆和鍵盤都能彈，有沒有 Web MIDI 都行：在 Safari 和 iPad 上仍然能彈、能觸發事件，只有硬體和 MIDI 輸出的部分會說「不能用」。',
      },
      {
        en: 'Attributes, each also a property of the same name (`midi-out` is `el.midiOut`): `profile` (an id, a short name or a URL to a profile JSON; default `arturia-minilab3`), `layout` (`auto`, `face` as it looks, `stack` re-gridded for a tall box), `hardware` (off by default; bare or `on` follows the real device, `ask` shows a button so the permission prompt waits for a click, or a port name or `/regex/`), `midi-out` (off by default; bare or `ask` lets the visitor pick, or a port name, substring or `/regex/` such as `IAC` or `loopMIDI`), `channel` (1 to 16: move every control to that channel), `picker`, `readout` (the last message under the faceplate), `learn` (a Learn button), `follow` (show whatever known device is plugged in), `theme` (`dark` or `light`: the toolbar only, the device stays the device), `telemetry` (`off` sends no anonymous hit) and `lang` (the toolbar language: `zh…` is Chinese, anything else English; it reads the nearest `lang` on the page).',
        zh: '屬性，每一個也是同名的屬性（property）（`midi-out` 對應 `el.midiOut`）：`profile`（id、短名稱，或指向設定檔 JSON 的網址，預設 `arturia-minilab3`）、`layout`（`auto`，`face` 是原本的樣子，`stack` 是為高的盒子重新排列）、`hardware`（預設關閉，只寫屬性或 `on` 是跟隨真實機器，`ask` 會顯示按鈕，讓權限詢問等到點擊才跳出，也可以寫埠名或 `/regex/`）、`midi-out`（預設關閉，只寫屬性或 `ask` 讓訪客自己挑，也可以寫埠名、子字串或 `/regex/`，例如 `IAC`、`loopMIDI`）、`channel`（1 到 16：把所有控制項移到那個頻道）、`picker`、`readout`（面板下面顯示最後一則訊息）、`learn`（學習按鈕）、`follow`（接上哪台認得的機器就顯示哪一台）、`theme`（`dark` 或 `light`：只影響工具列，機器還是機器的樣子）、`telemetry`（`off` 就不送匿名資料）和 `lang`（工具列語言：`zh…` 是中文，其他是英文，會讀頁面上最近的 `lang`）。',
      },
      {
        en: 'Events are `CustomEvent`s that bubble and cross the shadow root, so `el.addEventListener(\'control\', e => e.detail)` works anywhere above it: `ready` `{ profile, name, controls }`, `control` (see [`controlDetail()`](#controlDetail)), `noteon`, `noteoff`, `connect`, `disconnect`, `status`, `profilechange` and `error` `{ message }`. [`EMBED_EVENTS`](#EMBED_EVENTS) lists them. Methods: `set()`, `get()`, `values()`, `reset()`, `press()`, `release()`, `ingest()`, `send()`, `on()`, `connectHardware()`, `disconnectHardware()`, `setOutput()` and `toggleLearn()`.',
        zh: '事件是會冒泡、也會穿過 shadow root 的 `CustomEvent`，所以在它上面任何一層用 `el.addEventListener(\'control\', e => e.detail)` 都收得到：`ready` `{ profile, name, controls }`、`control`（見 [`controlDetail()`](#controlDetail)）、`noteon`、`noteoff`、`connect`、`disconnect`、`status`、`profilechange` 和 `error` `{ message }`。[`EMBED_EVENTS`](#EMBED_EVENTS) 列出了它們。方法有：`set()`、`get()`、`values()`、`reset()`、`press()`、`release()`、`ingest()`、`send()`、`on()`、`connectHardware()`、`disconnectHardware()`、`setOutput()`、`toggleLearn()`。',
      },
      {
        en: 'It fills its width, and its height follows the faceplate (a taller stack on a phone) unless you set one. CSS variables: `--oav-bg`, `--oav-fg`, `--oav-accent`, `--oav-line`, `--oav-font`, and `--oav-ratio` (width ÷ height). Parts: `::part(toolbar)`, `::part(body)`, `::part(readout)`.',
        zh: '它的寬度填滿容器，高度則跟著面板走（手機上會用比較高的直排），除非你自己設高度。CSS 變數：`--oav-bg`、`--oav-fg`、`--oav-accent`、`--oav-line`、`--oav-font`，以及 `--oav-ratio`（寬除以高）。可用的 part：`::part(toolbar)`、`::part(body)`、`::part(readout)`。',
      },
    ],
    needs: {
      en: 'Wait for the controller to exist: `await el.ready` (a promise that resolves with the element), or listen for the `ready` event. Before that, `set()`, `press()`, `release()` and `ingest()` return `null` and print one console warning, and `get()` also returns `null`. It never asks for MIDI permission unless `hardware`, `midi-out` or Learn is used.',
      zh: '要等控制器建好：`await el.ready`（會以元素本身完成的 promise），或是監聽 `ready` 事件。在那之前，`set()`、`press()`、`release()`、`ingest()` 會回傳 `null` 並在主控台印出一次警告，`get()` 也回傳 `null`。除非用了 `hardware`、`midi-out` 或學習，否則它不會要 MIDI 權限。',
    },
    notes: [
      {
        en: 'For a place that only takes an iframe, the same element is served at `/embed/controller/` (query parameters mirror the attributes). Hardware and MIDI out inside the frame need `allow="midi"` on the `<iframe>`. See [`parseEmbedOptions()`](#parseEmbedOptions) and [`toParent()`](#toParent).',
        zh: '只能放 iframe 的地方，同一個元素也放在 `/embed/controller/`（查詢參數對應到屬性）。要在 frame 裡用硬體和 MIDI 輸出，`<iframe>` 要加上 `allow="midi"`。見 [`parseEmbedOptions()`](#parseEmbedOptions) 和 [`toParent()`](#toParent)。',
      },
      {
        en: 'If a page imports both `@openav/midi` and `@openav/midi/element`, the browser loads `index.js` twice, because the element imports its own copy under a `?v=` stamp. Checks across the two copies fail: `el.core instanceof ControllerHost` is `false`. Talk to the element through its methods and events instead.',
        zh: '如果頁面同時匯入 `@openav/midi` 和 `@openav/midi/element`，瀏覽器會把 `index.js` 載入兩次，因為元素匯入的是自己那份、網址帶著 `?v=` 版本戳記。跨這兩份的檢查會失敗：`el.core instanceof ControllerHost` 是 `false`。請改用元素的方法和事件跟它溝通。',
      },
      {
        en: 'Like [`createController()`](#createController), it sends one anonymous hit per page load, never from localhost or the LAN. `telemetry="off"` stops it.',
        zh: '跟 [`createController()`](#createController) 一樣，每次載入頁面會送一筆匿名資料，從 localhost 或區域網路則不送。`telemetry="off"` 可以關掉。',
      },
    ],
    members: {
      connectedCallback: { en: 'Standard custom-element callback: when the element joins the page it builds its controller (in a microtask).', zh: '自訂元素的標準回呼：元素加進頁面時，會建立它的控制器（在 microtask 裡）。' },
      disconnectedCallback: { en: 'Standard custom-element callback: when the element leaves the page it disposes its controller and releases held notes.', zh: '自訂元素的標準回呼：元素離開頁面時，會銷毀它的控制器並放開按著的音。' },
      attributeChangedCallback: { en: 'Standard custom-element callback. Changing `profile`, `layout`, `hardware`, `midi-out`, `follow`, `readout` or `theme` updates the live element. Changing `channel` or `lang` rebuilds it.', zh: '自訂元素的標準回呼。改變 `profile`、`layout`、`hardware`、`midi-out`、`follow`、`readout` 或 `theme`，會直接更新正在跑的元素。改變 `channel` 或 `lang` 則會重建。' },
      set: { en: 'Moves a control like a hand: knobs and faders 0..1, pads and buttons above 0 press and 0 release, keys `set(\'keys\', velocity, { note: 60 })`. `quiet: true` moves only the faceplate: no event, no MIDI out. A number as the third argument is taken as `note`. Returns the bytes sent, or `null`.', zh: '像一隻手去動控制項：旋鈕和推桿 0..1，打擊墊和按鈕大於 0 是按下，0 是放開，琴鍵用 `set(\'keys\', velocity, { note: 60 })`。`quiet: true` 只動面板：不觸發事件，也不送 MIDI。第三個參數給數字會被當成 `note`。回傳送出的位元組或 `null`。' },
      get: { en: 'The current value of one control, or `null` when not ready or the id does not exist.', zh: '某個控制項目前的值，還沒準備好或 id 不存在時為 `null`。' },
      values: { en: '`{ id: value }` for every control; `{}` before the element is ready.', zh: '每個控制項的 `{ id: value }`，元素還沒準備好時是 `{}`。' },
      reset: { en: 'Lets go of everything and brings every control home. `reset({ quiet: true })` moves only the faceplate.', zh: '放開所有東西，讓每個控制項回到原位。`reset({ quiet: true })` 只動面板。' },
      press: { en: 'Presses a pad, button or key.', zh: '按下打擊墊、按鈕或琴鍵。' },
      release: { en: 'Lets go of it.', zh: '放開它。' },
      ingest: { en: 'MIDI in from anywhere (a WebSocket, another tab): the faceplate follows and `control` fires with `source: \'hardware\'`. One message or a list of messages.', zh: '從任何地方進來的 MIDI（WebSocket、另一個分頁）：面板會跟著動，`control` 事件以 `source: \'hardware\'` 觸發。可以是一則訊息或一串訊息。' },
      send: { en: 'Raw bytes to the MIDI output port, when `midi-out` is open. Returns `true` when sent.', zh: '把原始位元組送到 MIDI 輸出埠（`midi-out` 開著的時候）。送出了回傳 `true`。' },
      on: { en: 'Subscribes to an event by name; `fn(detail, event)`. Returns an unsubscribe function. Same as `addEventListener`, but you get the payload directly.', zh: '依名稱訂閱事件，`fn(detail, event)`。回傳取消訂閱的函式。跟 `addEventListener` 一樣，只是直接給你內容。' },
      connectHardware: { en: 'Follows the real device (asks the browser for Web MIDI), using the `hardware` attribute\'s port name if it has one. Resolves `true` or `false`.', zh: '跟隨真實的機器（向瀏覽器要 Web MIDI），如果 `hardware` 屬性寫了埠名就用它。完成時回傳 `true` 或 `false`。' },
      disconnectHardware: { en: 'Stops following the hardware.', zh: '停止跟隨硬體。' },
      setOutput: { en: 'Sends what is played to a MIDI output: a name, substring or `/regex/`; `null` turns it off. Resolves with the port name or `null`.', zh: '把彈出來的內容送到某個 MIDI 輸出埠：名稱、子字串或 `/regex/`，`null` 是關閉。完成時回傳埠名或 `null`。' },
      toggleLearn: { en: 'Turns Learn mode on or off (no argument toggles) and shows a hint in the readout. Turning it on also starts listening to hardware. Returns the new state.', zh: '開啟或關閉學習模式（不給參數就是切換），並在讀數列顯示提示。開啟時也會開始聽硬體。回傳新的狀態。' },
      core: { en: 'The headless controller underneath: the same API as [`createController()`](#createController) (`null` before ready).', zh: '底下的無畫面控制器：跟 [`createController()`](#createController) 同一套 API（準備好之前是 `null`）。' },
      controller: { en: 'The live model of the device on screen ([`MidiController`](#MidiController)).', zh: '螢幕上那台機器的活模型（[`MidiController`](#MidiController)）。' },
      controllers: { en: 'Every device this element can show ([`MidiControllers`](#MidiControllers)).', zh: '這個元素能顯示的所有機器（[`MidiControllers`](#MidiControllers)）。' },
      view: { en: 'The faceplate ([`ControllerView`](#ControllerView)).', zh: '面板（[`ControllerView`](#ControllerView)）。' },
      midi: { en: 'The Web MIDI engine ([`Midi`](#Midi)), once hardware or MIDI out is on.', zh: 'Web MIDI 引擎（[`Midi`](#Midi)），在硬體或 MIDI 輸出開啟之後才有。' },
      status: { en: '`{ hardware, input, output, outputState, profile }`: see [`ControllerHost`](#ControllerHost) for the values.', zh: '`{ hardware, input, output, outputState, profile }`，可能的值見 [`ControllerHost`](#ControllerHost)。' },
      profileData: { en: 'The normalized profile on screen.', zh: '螢幕上那份整理過的設定檔。' },
      learn: { en: 'Boolean property for the `learn` attribute.', zh: '對應 `learn` 屬性的布林值。' },
      picker: { en: 'Boolean property for the `picker` attribute.', zh: '對應 `picker` 屬性的布林值。' },
      readout: { en: 'Boolean property for the `readout` attribute.', zh: '對應 `readout` 屬性的布林值。' },
      follow: { en: 'Boolean property for the `follow` attribute.', zh: '對應 `follow` 屬性的布林值。' },
      profile: { en: 'String property for the `profile` attribute. Setting it switches the device on screen.', zh: '對應 `profile` 屬性的字串。設定它就會切換螢幕上的機器。' },
      layout: { en: 'String property for the `layout` attribute: `auto`, `face` or `stack`.', zh: '對應 `layout` 屬性的字串：`auto`、`face` 或 `stack`。' },
      theme: { en: 'String property for the `theme` attribute: `dark` or `light`.', zh: '對應 `theme` 屬性的字串：`dark` 或 `light`。' },
      hardware: { en: 'String property for the `hardware` attribute.', zh: '對應 `hardware` 屬性的字串。' },
      midiOut: { en: 'String property for the `midi-out` attribute.', zh: '對應 `midi-out` 屬性的字串。' },
      channel: { en: 'Number property for the `channel` attribute: 1 to 16, or `null` when the attribute is missing or out of range.', zh: '對應 `channel` 屬性的數字：1 到 16，屬性沒寫或超出範圍時是 `null`。' },
      observedAttributes: { en: 'The attributes the element reacts to: [`EMBED_ATTRS`](#EMBED_ATTRS) plus `lang`.', zh: '元素會回應的屬性：[`EMBED_ATTRS`](#EMBED_ATTRS) 再加上 `lang`。' },
    },
    tbd: [
      {
        en: 'Not tried for this page: `hardware` and `midi-out` inside an iframe in each browser, and a real MIDI device behind the element. The `allow="midi"` requirement is as the package README states it.',
        zh: '這一頁沒有實測：各個瀏覽器的 iframe 裡的 `hardware` 和 `midi-out`，以及元素背後接真實的 MIDI 機器。`allow="midi"` 的要求是照套件 README 的說法寫的。',
      },
    ],
    examples: [
      {
        code: `// importing the file registers <oav-controller>
import '@openav/midi/element';

const app = document.getElementById('app');
app.innerHTML = '<oav-controller profile="akai-lpd8" readout></oav-controller>';
const el = app.firstElementChild;

await el.ready;                                    // the controller exists now
el.on('control', (d) => console.log(d.signal, d.value.toFixed(2), d.source));
el.set('k1', 0.5);                                 // turns knob 1 on the screen
el.ingest([0xb0, 71, 127]);                        // MIDI from "elsewhere": knob 2 follows`,
        caption: { en: 'An LPD8 appears with a message line under it. The console prints `midi/lpd8/k1 0.50 ui`, then `midi/lpd8/k2 1.00 hardware`. Drag the knobs or tap the pads.', zh: '出現一台 LPD8，下面有一行訊息列。主控台印出 `midi/lpd8/k1 0.50 ui`，接著是 `midi/lpd8/k2 1.00 hardware`。可以拖曳旋鈕或敲打擊墊。' },
      },
      {
        code: `import '@openav/midi/element';

const app = document.getElementById('app');
app.innerHTML = '<oav-controller profile="lpd8" picker style="max-width: 420px"></oav-controller>';
const el = app.firstElementChild;
await el.ready;

el.addEventListener('profilechange', (e) => console.log('now showing', e.detail.name));
el.profile = 'nano2';                              // the same as setAttribute('profile', 'nano2')
console.log(el.status.hardware, el.channel);       // off null`,
        caption: { en: 'The toolbar has a device picker. Setting `el.profile` switches the faceplate to the Korg nanoKONTROL2 and the console prints its name, then `off null`.', zh: '工具列上有機器選單。設定 `el.profile` 會把面板換成 KORG nanoKONTROL2，主控台印出它的名稱，再印出 `off null`。' },
      },
      {
        code: `<script type="module" src="https://openaudiovisual.com/packages/midi/element.js"></script>

<!-- plays on its own; the real device and MIDI out stay off until you ask -->
<oav-controller profile="akai-lpd8" readout></oav-controller>

<!-- a button asks for the real device on click; a MIDI output named like IAC receives what you play -->
<oav-controller profile="arturia-minilab3" hardware="ask" midi-out="IAC" picker learn></oav-controller>`,
        caption: { en: 'The two lines you paste into any page. The first plays with the mouse; the second shows a Connect button and a Learn button.', zh: '貼進任何頁面的就是這幾行。第一台用滑鼠就能彈，第二台會顯示連接按鈕和學習按鈕。' },
        lang: 'html',
        run: 'static',
        why: 'It is HTML for a web page that loads the script from the live site, not code to run in a module.',
      },
    ],
    related: ['defineController', 'createController', 'ControllerHost', 'parseEmbedOptions', 'EMBED_ATTRS', 'EMBED_EVENTS', 'controlDetail'],
    keywords: {
      en: ['oav-controller', 'custom element', 'web component', 'embed controller', 'html tag', 'attributes', 'midi-out', 'hardware', 'shadow dom'],
      zh: ['oav-controller', '自訂元素', 'web component', '嵌入控制器', 'html 標籤', '屬性', 'midi-out', '硬體', 'shadow dom'],
    },
  },

  defineController: {
    group: 'controllers',
    summary: {
      en: 'Registers the controller element under another tag name (importing `@openav/midi/element` already registers it as `oav-controller`).',
      zh: '把 `<oav-controller>` 元素註冊成另一個標籤名稱（匯入 `@openav/midi/element` 時已經註冊好 `<oav-controller>` 了）。',
    },
    params: [
      { name: 'tag', type: 'String', en: 'The new tag name. It must contain a hyphen, as every custom element does.', zh: '新的標籤名稱，必須包含連字號，所有自訂元素都是如此。' },
    ],
    returns: { type: 'Function | null', en: 'The element class registered for that tag (an already-registered tag returns what is there). `null` when the page has no `customElements`.', zh: '註冊在該標籤上的元素類別（標籤已經註冊過就回傳現有的）。頁面沒有 `customElements` 時回傳 `null`。' },
    description: [
      {
        en: 'A tag name can be registered only once per page, so use this when `oav-controller` clashes with another library, or when you want two differently-named copies. The default tag registers the exported [`OavController`](#OavController) class itself; any other name registers a subclass of it.',
        zh: '一個標籤名稱在同一個頁面只能註冊一次，所以當 `oav-controller` 跟別的函式庫衝突，或你想要兩個不同名字的副本時，就用它。預設標籤註冊的是匯出的 [`OavController`](#OavController) 類別本身，其他名稱註冊的是它的子類別。',
      },
    ],
    examples: [
      {
        code: `import { defineController } from '@openav/midi/element';

defineController('my-pads');                          // now <my-pads> works too

const app = document.getElementById('app');
app.innerHTML = '<my-pads profile="generic-16p"></my-pads>';
const el = app.firstElementChild;
await el.ready;
console.log(el.tagName, el.profileData.id);           // MY-PADS generic-16p`,
        caption: { en: 'A 16-pad generic controller appears from a tag you named yourself; the console prints `MY-PADS generic-16p`.', zh: '一台 16 個打擊墊的通用控制器，從你自己取名的標籤出現，主控台印出 `MY-PADS generic-16p`。' },
      },
    ],
    related: ['OavController'],
    keywords: { en: ['register', 'custom element name', 'tag name', 'customElements.define'], zh: ['註冊', '自訂元素名稱', '標籤名稱', 'customElements.define'] },
  },

  EMBED_ATTRS: {
    group: 'controllers',
    summary: {
      en: 'The attributes the `oav-controller` element reads, which are also the query parameters of the iframe page: `profile`, `layout`, `hardware`, `midi-out` and more.',
      zh: '`<oav-controller>` 讀取的屬性，也同時是 iframe 頁面的查詢參數：`profile`、`layout`、`hardware`、`midi-out`、`channel` 等等。',
    },
    value: {
      type: 'string[]', range: '[\'profile\', \'layout\', \'hardware\', \'midi-out\', \'channel\', \'learn\', \'picker\', \'readout\', \'follow\', \'theme\', \'telemetry\']',
      en: 'A plain array, in this order. The element watches these (and `lang`) for changes.',
      zh: '一個普通陣列，順序如上。元素會監看這些屬性（加上 `lang`）有沒有改變。',
    },
    description: [
      {
        en: 'The iframe page copies every one of these from its URL onto the element. The extra parameters `bg`, `pad`, `frame`, `origin` and `lang` belong to the iframe page and are read by [`parseEmbedOptions()`](#parseEmbedOptions). What each attribute means is under [`OavController`](#OavController).',
        zh: 'iframe 頁面會把網址裡的這些參數逐一複製到元素上。另外的 `bg`、`pad`、`frame`、`origin`、`lang` 是 iframe 頁面專用的，由 [`parseEmbedOptions()`](#parseEmbedOptions) 讀取。每個屬性的意思寫在 [`OavController`](#OavController) 底下。',
      },
    ],
    examples: [
      {
        code: `import { EMBED_ATTRS } from '@openav/midi/embed';

console.log(EMBED_ATTRS.join(' '));`,
        caption: { en: 'Prints the eleven attribute names.', zh: '印出十一個屬性名稱。' },
      },
    ],
    related: ['OavController', 'parseEmbedOptions', 'EMBED_EVENTS'],
    keywords: { en: ['attributes', 'query parameters', 'iframe parameters', 'embed options'], zh: ['屬性', '查詢參數', 'iframe 參數', '嵌入選項'] },
  },

  EMBED_EVENTS: {
    group: 'controllers',
    summary: {
      en: 'The nine events the `oav-controller` element dispatches and the iframe posts to its page, from `ready` and `control` to `profilechange` and `error`.',
      zh: '`<oav-controller>` 會觸發、iframe 也會送給外層頁面的事件：`ready`、`control`、`noteon`、`noteoff`、`connect`、`disconnect`、`status`、`profilechange`、`error`。',
    },
    value: {
      type: 'string[]', range: '[\'ready\', \'control\', \'noteon\', \'noteoff\', \'connect\', \'disconnect\', \'status\', \'profilechange\', \'error\']',
      en: 'A plain array, in this order. The element dispatches each as a `CustomEvent` that bubbles and is composed; the iframe page forwards each to `window.parent` with [`toParent()`](#toParent).',
      zh: '一個普通陣列，順序如上。元素把每一個都當成會冒泡、可穿過 shadow root 的 `CustomEvent` 觸發，iframe 頁面則用 [`toParent()`](#toParent) 把每一個轉送給 `window.parent`。',
    },
    description: [
      {
        en: 'The iframe also posts a tenth type, `values`, as the answer to the `get` command; it is not an element event, so it is not in this list. The payloads are described under [`OavController`](#OavController) and [`controlDetail()`](#controlDetail).',
        zh: 'iframe 還會送出第十種類型 `values`，那是對 `get` 指令的回答，不是元素事件，所以不在這份清單裡。各事件的內容寫在 [`OavController`](#OavController) 和 [`controlDetail()`](#controlDetail) 底下。',
      },
    ],
    examples: [
      {
        code: `import { EMBED_EVENTS } from '@openav/midi/embed';

console.log(EMBED_EVENTS.join(' '));`,
        caption: { en: 'Prints the nine event names.', zh: '印出九個事件名稱。' },
      },
    ],
    related: ['OavController', 'toParent', 'controlDetail', 'EMBED_ATTRS'],
    keywords: { en: ['events', 'control event', 'noteon', 'ready', 'status', 'custom events'], zh: ['事件', 'control 事件', 'noteon', 'ready', 'status', '自訂事件'] },
  },

  EMBED_LAYOUTS: {
    group: 'controllers',
    summary: {
      en: 'The three layouts a controller can have: `auto`, `face` (the device as it looks) and `stack` (re-gridded for a tall box).',
      zh: '控制器的三種版面：`auto`、`face`（機器原本的樣子）和 `stack`（為高的盒子重新排列）。',
    },
    value: {
      type: 'string[]', range: '[\'auto\', \'face\', \'stack\']',
      en: 'A plain array. [`parseEmbedOptions()`](#parseEmbedOptions) turns any other `layout` value into `\'auto\'`, and the `layout` command of the iframe accepts only these.',
      zh: '一個普通陣列。[`parseEmbedOptions()`](#parseEmbedOptions) 會把其他的 `layout` 值變成 `\'auto\'`，iframe 的 `layout` 指令也只接受這三個。',
    },
    description: [
      {
        en: 'A profile can opt out of `stack` (`stack: false`); square grid devices such as the Launchpad always stay `face`. See [`preferredAspect()`](#preferredAspect).',
        zh: '設定檔可以不要 `stack`（`stack: false`），像 Launchpad 這種方形的格子機器永遠維持 `face`。見 [`preferredAspect()`](#preferredAspect)。',
      },
    ],
    examples: [
      {
        code: `import { EMBED_LAYOUTS, parseEmbedOptions } from '@openav/midi/embed';

console.log(EMBED_LAYOUTS);
console.log(parseEmbedOptions({ layout: 'stack' }).layout);      // stack
console.log(parseEmbedOptions({ layout: 'sideways' }).layout);   // auto: not in the list`,
        caption: { en: 'Prints the three names, then `stack`, then `auto`.', zh: '印出三個名稱，再印出 `stack`，最後印出 `auto`。' },
      },
    ],
    related: ['parseEmbedOptions', 'preferredAspect', 'OavController'],
    keywords: { en: ['layout', 'face', 'stack', 'auto', 'phone layout'], zh: ['版面', 'face', 'stack', 'auto', '手機版面'] },
  },

  parseEmbedOptions: {
    group: 'controllers',
    summary: {
      en: 'Reads the options of one embed from an element, a query string, an object or a getter function, and returns them cleaned up with defaults.',
      zh: '從元素、查詢字串、物件或取值函式讀出一個嵌入的選項，整理過並補上預設值後回傳。',
    },
    params: [
      { name: 'src', type: 'Element | URLSearchParams | Object | Function', en: 'Where the options live: an element (read with `getAttribute`), a `URLSearchParams` (the iframe page passes its own), a plain object `{ profile: \'lpd8\' }`, or a function `(name) => value | null`.', zh: '選項放在哪裡：元素（用 `getAttribute` 讀）、`URLSearchParams`（iframe 頁面傳自己的）、普通物件 `{ profile: \'lpd8\' }`，或是函式 `(name) => value | null`。' },
    ],
    returns: { type: 'Object', en: '`{ profile, layout, hardware, midiOut, channel, learn, picker, readout, follow, telemetry, theme, bg, frame, origin, lang }`. `hardware` and `midiOut` are `{ mode, port }` as in [`embedMode()`](#embedMode).', zh: '`{ profile, layout, hardware, midiOut, channel, learn, picker, readout, follow, telemetry, theme, bg, frame, origin, lang }`。`hardware` 和 `midiOut` 的格式是 [`embedMode()`](#embedMode) 那樣的 `{ mode, port }`。' },
    description: [
      {
        en: 'It is the one place that decides what the attributes and the iframe\'s query string mean, so the element and the iframe always agree. Defaults: `profile` is `arturia-minilab3`, `layout` `auto`, `theme` `dark`, `hardware` and `midiOut` off (so embedding never asks for MIDI permission), the booleans false, `telemetry` true, and `channel`, `bg`, `frame`, `origin`, `lang` are `null`.',
        zh: '元素和 iframe 的查詢字串各代表什麼意思，都由它一個地方決定，所以兩邊一定一致。預設值：`profile` 是 `arturia-minilab3`，`layout` 是 `auto`，`theme` 是 `dark`，`hardware` 和 `midiOut` 是關閉（所以嵌入不會要 MIDI 權限），布林值都是 false，`telemetry` 是 true，`channel`、`bg`、`frame`、`origin`、`lang` 是 `null`。',
      },
      {
        en: 'Rules worth knowing: an unknown `layout` becomes `auto`; `theme` is `light` or `dark`; `midi-out` may also be written `midiout` or `midiOut`, and alone it means `ask`; `frame` may also be written `id` and is cut to 64 characters; `origin` is kept only as `https://host` or `http://host` with no path (anything else, such as `javascript:`, becomes `null`), `lang` is cut to 16 characters, and `bg` goes through [`embedColor()`](#embedColor).',
        zh: '值得知道的規則：不認得的 `layout` 變成 `auto`。`theme` 只有 `light` 或 `dark`。`midi-out` 也可以寫成 `midiout` 或 `midiOut`，單獨寫表示 `ask`。`frame` 也可以寫成 `id`，並且截成 64 個字元。`origin` 只接受沒有路徑的 `https://host` 或 `http://host`（其他的，像 `javascript:`，會變成 `null`）。`lang` 截成 16 個字元。`bg` 會經過 [`embedColor()`](#embedColor)。',
      },
    ],
    examples: [
      {
        code: `import { parseEmbedOptions } from '@openav/midi/embed';

const q = new URLSearchParams('profile=lpd8&layout=stack&hardware&midi-out=IAC&readout&bg=transparent&origin=https://example.com');
const o = parseEmbedOptions(q);
console.log(o.profile, o.layout, o.hardware, o.midiOut);
console.log(o.readout, o.bg, o.origin, o.channel);`,
        caption: { en: 'Prints `lpd8 stack`, `hardware` as `{ mode: \'on\', port: null }`, `midiOut` as `{ mode: \'on\', port: \'IAC\' }`, then `true transparent https://example.com null`.', zh: '印出 `lpd8 stack`、`hardware` 的 `{ mode: \'on\', port: null }`、`midiOut` 的 `{ mode: \'on\', port: \'IAC\' }`，再印出 `true transparent https://example.com null`。' },
      },
      {
        code: `import { parseEmbedOptions } from '@openav/midi/embed';

console.log(JSON.stringify(parseEmbedOptions({})));                       // every default
const o = parseEmbedOptions({ 'midi-out': '', hardware: 'off' });
console.log(JSON.stringify(o.midiOut), JSON.stringify(o.hardware));      // midiOut asks, hardware stays off
console.log(parseEmbedOptions({ origin: 'javascript:alert(1)' }).origin);   // null`,
        caption: { en: 'Prints every default as JSON, then `midiOut` as `{"mode":"ask","port":null}` next to `hardware` as off, then `null`.', zh: '以 JSON 印出所有預設值，再印出 `{"mode":"ask","port":null}` 的 `midiOut`（旁邊是關閉的 `hardware`），最後是 `null`。' },
      },
    ],
    related: ['embedMode', 'embedFlag', 'embedChannel', 'embedColor', 'EMBED_ATTRS', 'OavController'],
    keywords: { en: ['embed options', 'query string', 'attributes to options', 'iframe params', 'defaults'], zh: ['嵌入選項', '查詢字串', '屬性轉選項', 'iframe 參數', '預設值'] },
  },

  embedFlag: {
    group: 'controllers',
    summary: {
      en: 'Reads a boolean attribute: present means on, unless it says `false`, `0`, `off` or `no`.',
      zh: '讀取布林屬性：有寫就是開，除非內容是 `false`、`0`、`off` 或 `no`。',
    },
    params: [
      { name: 'v', type: 'any', en: 'The attribute value: `null`/`undefined`/`false` (absent) or a string. A bare attribute is the empty string.', zh: '屬性的值：`null`、`undefined`、`false`（沒寫）或字串。只寫屬性名稱時是空字串。' },
    ],
    returns: { type: 'Boolean', en: 'Absent is `false`; `true` is `true`; a string is `true` unless it is (case-insensitively, trimmed) `false`, `0`, `off` or `no`.', zh: '沒寫是 `false`，`true` 是 `true`，字串除了（不分大小寫、去掉空白後）`false`、`0`、`off`、`no` 之外都是 `true`。' },
    description: [
      {
        en: 'This is why `<oav-controller readout>` and `readout="true"` both turn the readout on and `readout="off"` turns it off. Any other word counts as on, so `readout="ask"` is `true`.',
        zh: '所以 `<oav-controller readout>` 和 `readout="true"` 都會開啟讀數列，`readout="off"` 則會關掉。其他任何字都算開，所以 `readout="ask"` 也是 `true`。',
      },
    ],
    examples: [
      {
        code: `import { embedFlag } from '@openav/midi/embed';

console.log(embedFlag(''), embedFlag('true'), embedFlag('ask'));    // true true true
console.log(embedFlag(null), embedFlag('off'), embedFlag('No'));    // false false false`,
        caption: { en: 'Prints three `true`s, then three `false`s.', zh: '印出三個 `true`，再印出三個 `false`。' },
      },
    ],
    related: ['parseEmbedOptions', 'embedMode'],
    keywords: { en: ['boolean attribute', 'flag', 'on off', 'true false'], zh: ['布林屬性', '旗標', '開關', 'true false'] },
  },

  embedMode: {
    group: 'controllers',
    summary: {
      en: 'Reads `hardware` and `midi-out`: off, `ask` (a button, so the permission prompt waits for a click) or on, plus which port.',
      zh: '讀取 `hardware` 和 `midi-out`：關閉、`ask`（顯示按鈕，讓權限詢問等到點擊）或開啟，以及指定哪個埠。',
    },
    params: [
      { name: 'v', type: 'any', en: 'The attribute value.', zh: '屬性的值。' },
      { name: 'bare', type: 'String', en: 'What a bare attribute (no value) means: `\'on\'` for `hardware` (the default), `\'ask\'` for `midi-out`, because there is no sensible default port to send to.', zh: '只寫屬性、沒有值時的意思：`hardware` 是 `\'on\'`（預設），`midi-out` 是 `\'ask\'`，因為送出去沒有合理的預設埠。' },
    ],
    returns: { type: '{ mode, port }', en: '`mode` is `\'off\'`, `\'ask\'` or `\'on\'`. `port` is a string only when the value names one.', zh: '`mode` 是 `\'off\'`、`\'ask\'` 或 `\'on\'`。只有值裡有指定埠時，`port` 才是字串。' },
    description: [
      {
        en: 'Absent or `false`/`0`/`off`/`no` is off. `ask` is ask. `on`, `true`, `yes`, `auto` is on without a port. Any other text is on, and the text is the port name or `/regex/` to look for (see [`findPort()`](#findPort)): `embedMode(\'IAC\')` is `{ mode: \'on\', port: \'IAC\' }`.',
        zh: '沒寫或是 `false`/`0`/`off`/`no` 就是關閉。`ask` 就是 ask。`on`、`true`、`yes`、`auto` 是開啟但不指定埠。其他任何文字都是開啟，而那段文字就是要找的埠名或 `/regex/`（見 [`findPort()`](#findPort)）：`embedMode(\'IAC\')` 是 `{ mode: \'on\', port: \'IAC\' }`。',
      },
    ],
    examples: [
      {
        code: `import { embedMode } from '@openav/midi/embed';

console.log(embedMode(null));                    // { mode: 'off', port: null }
console.log(embedMode(''));                      // { mode: 'on', port: null }  (a bare hardware attribute)
console.log(embedMode('', { bare: 'ask' }));     // { mode: 'ask', port: null } (a bare midi-out attribute)
console.log(embedMode('loopMIDI'));              // { mode: 'on', port: 'loopMIDI' }`,
        caption: { en: 'Prints four `{ mode, port }` objects: off, on, ask, and on with a named port.', zh: '印出四個 `{ mode, port }` 物件：關閉、開啟、ask，以及指定了埠名的開啟。' },
      },
    ],
    related: ['parseEmbedOptions', 'embedFlag', 'findPort'],
    keywords: { en: ['hardware attribute', 'midi-out attribute', 'ask', 'port name', 'permission'], zh: ['hardware 屬性', 'midi-out 屬性', 'ask', '埠名', '權限'] },
  },

  embedChannel: {
    group: 'controllers',
    summary: {
      en: 'Reads the `channel` attribute: a whole number from 1 to 16, or `null` for anything else.',
      zh: '讀取 `channel` 屬性：1 到 16 的整數，其他任何值都是 `null`。',
    },
    params: [
      { name: 'v', type: 'any', en: 'The attribute value, a number or a string.', zh: '屬性的值，數字或字串。' },
    ],
    returns: { type: 'Number | null', en: 'The channel, or `null` when it is missing, empty, not a whole number or outside 1..16.', zh: '頻道，沒寫、空字串、不是整數或不在 1..16 時是 `null`。' },
    description: [
      {
        en: 'A `null` means "keep the profile\'s own channels". A number makes [`withChannel()`](#withChannel) move every control there.',
        zh: '`null` 代表「維持設定檔本來的頻道」。有數字的話，[`withChannel()`](#withChannel) 會把所有控制項移到那個頻道。',
      },
    ],
    examples: [
      {
        code: `import { embedChannel } from '@openav/midi/embed';

console.log(embedChannel('10'), embedChannel(3));                     // 10 3
console.log(embedChannel('0'), embedChannel('17'), embedChannel('x'), embedChannel(''));   // null null null null`,
        caption: { en: 'Prints `10 3`, then four `null`s.', zh: '印出 `10 3`，再印出四個 `null`。' },
      },
    ],
    related: ['withChannel', 'parseEmbedOptions'],
    keywords: { en: ['midi channel', 'channel attribute', 'validate channel'], zh: ['midi 頻道', 'channel 屬性', '檢查頻道'] },
  },

  embedColor: {
    group: 'controllers',
    summary: {
      en: 'Checks the `bg` colour of the iframe page and returns a safe value: `transparent`, a hex colour, or a plain colour name; anything else is `null`.',
      zh: '檢查 iframe 頁面的 `bg` 顏色，回傳安全的值：`transparent`、十六進位顏色或單純的顏色名稱，其他一律是 `null`。',
    },
    params: [
      { name: 'v', type: 'String', en: 'The value from the query string.', zh: '來自查詢字串的值。' },
    ],
    returns: { type: 'String | null', en: '`\'transparent\'`; `\'#\'` plus 3, 4, 6 or 8 hex digits (the `#` is optional in the input, so `abc` becomes `#abc`); or 3 to 20 letters, lower-cased (`\'RED\'` becomes `\'red\'`); otherwise `null`.', zh: '`\'transparent\'`，或 `\'#\'` 加上 3、4、6 或 8 個十六進位數字（輸入裡的 `#` 可有可無，所以 `abc` 會變成 `#abc`），或 3 到 20 個英文字母（轉成小寫，`\'RED\'` 變成 `\'red\'`），其他是 `null`。' },
    description: [
      {
        en: 'The iframe page puts the result into a CSS variable, so a value that could break out of CSS (`red;}body{`) is refused. It does not check that a name is a real colour: any 3 to 20 letters pass, and CSS ignores the ones it does not know.',
        zh: 'iframe 頁面會把結果放進一個 CSS 變數，所以可能跳出 CSS 的值（`red;}body{`）會被拒絕。它不檢查名稱是不是真的顏色：任何 3 到 20 個字母都會通過，CSS 不認得的就會被忽略。',
      },
    ],
    examples: [
      {
        code: `import { embedColor } from '@openav/midi/embed';

console.log(embedColor('transparent'), embedColor('#0b0b0c'), embedColor('000'), embedColor('RED'));
console.log(embedColor('red;}body{'), embedColor('#12345'), embedColor(''));   // null null null`,
        caption: { en: 'Prints `transparent #0b0b0c #000 red`, then three `null`s.', zh: '印出 `transparent #0b0b0c #000 red`，再印出三個 `null`。' },
      },
    ],
    related: ['parseEmbedOptions'],
    keywords: { en: ['background colour', 'bg parameter', 'transparent', 'hex', 'safe css'], zh: ['背景顏色', 'bg 參數', '透明', '十六進位', '安全的 css'] },
  },

  preferredAspect: {
    group: 'controllers',
    summary: {
      en: 'Works out the width ÷ height a controller wants in a box of a given width: its faceplate when every control stays finger-sized, a taller stack otherwise.',
      zh: '算出控制器在某個寬度的盒子裡想要的寬高比：每個控制項都夠手指按的話用面板本身的比例，否則用比較高的直排。',
    },
    params: [
      { name: 'profile', type: 'Object', en: 'A normalized profile (`face`, `sections`, `portrait`, `stack`).', zh: '整理過的設定檔（`face`、`sections`、`portrait`、`stack`）。' },
      { name: 'width', type: 'Number', en: 'The box width in pixels.', zh: '盒子的寬度（像素）。' },
      { name: 'layout', type: 'String', en: '`\'auto\'`, `\'face\'` or `\'stack\'`.', zh: '`\'auto\'`、`\'face\'` 或 `\'stack\'`。' },
      { name: 'minTouch', type: 'Number', en: 'The smallest control size in pixels that still counts as finger-sized.', zh: '還算夠手指按的最小控制項尺寸（像素）。' },
    ],
    returns: { type: '{ mode, aspect }', en: '`mode` is `\'face\'` or `\'stack\'`, and `aspect` is the width ÷ height to give the box.', zh: '`mode` 是 `\'face\'` 或 `\'stack\'`，`aspect` 是要給盒子的寬高比。' },
    description: [
      {
        en: '`<oav-controller>` uses it to set its height, so a controller sizes itself from its width. In `auto`, the faceplate\'s own proportions are used while the smallest control stays at least `minTouch` pixels at that width; otherwise it becomes a stack, about 0.8 to 1.5 times as tall as it is wide depending on how many bands the profile\'s `portrait` has. Square grid devices (the Launchpad, `stack: false`) always keep their face.',
        zh: '`<oav-controller>` 用它來決定自己的高度，所以控制器會依寬度自己決定大小。在 `auto` 下，只要在那個寬度時最小的控制項仍有至少 `minTouch` 像素，就用面板本身的比例，否則改成直排，高度大約是寬度的 0.8 到 1.5 倍，視設定檔 `portrait` 有幾條而定。方形格子的機器（Launchpad，`stack: false`）永遠維持 `face`。',
      },
    ],
    examples: [
      {
        code: `import { normalizeProfile, profileById } from '@openav/midi';
import { preferredAspect } from '@openav/midi/embed';

const lpd8 = normalizeProfile(profileById('lpd8'));
console.log(preferredAspect(lpd8, 1200));                      // { mode: 'face', aspect: 3.70... }
console.log(preferredAspect(lpd8, 340));                       // { mode: 'stack', aspect: 0.92... } : a phone
console.log(preferredAspect(lpd8, 340, { layout: 'face' }));   // forced back to the face

const launchpad = normalizeProfile(profileById('lpmini'));
console.log(preferredAspect(launchpad, 300));                  // { mode: 'face', aspect: 1 } : always square`,
        caption: { en: 'Prints four results: a wide face, a tall stack for a narrow box, the face when forced, and the square Launchpad.', zh: '印出四個結果：寬的面板、窄盒子用的高直排、強制指定時的面板，以及方形的 Launchpad。' },
      },
    ],
    related: ['OavController', 'EMBED_LAYOUTS', 'ControllerView'],
    keywords: { en: ['aspect ratio', 'height from width', 'responsive', 'phone layout', 'size'], zh: ['寬高比', '由寬度算高度', '響應式', '手機版面', '大小'] },
  },

  controlDetail: {
    group: 'controllers',
    summary: {
      en: 'Builds the `control` event payload for one control change: `id`, `value`, `raw`, `signal`, the parsed `message`, its `bytes` and where it came from.',
      zh: '為一次控制項變化組出 `control` 事件的內容：`id`、`value`、`raw`、`signal`、解析後的 `message`、`bytes`，以及它從哪裡來。',
    },
    params: [
      { name: 'mc', type: 'MidiController', en: 'The controller the change happened on.', zh: '發生變化的控制器。' },
      { name: 'id', type: 'String', en: 'The control id.', zh: '控制項 id。' },
      { name: 'st', type: 'Object', en: 'Its state after the change (`mc.get(id)`).', zh: '變化之後的狀態（`mc.get(id)`）。' },
      { name: 'info', type: 'Object', en: 'What `onChange` gave: `{ source, ev, note, bytes }`.', zh: '`onChange` 給的內容：`{ source, ev, note, bytes }`。' },
    ],
    returns: { type: 'Object', en: 'The payload, plain JSON that is safe to `postMessage`.', zh: '事件內容，是可以安全 `postMessage` 的純 JSON。' },
    description: [
      {
        en: 'Always there: `profile` (the profile id), `id`, `type`, `label`, `value`, `raw`, `signal`, `message`, `bytes`, `source` and `time` (`performance.now()`, rounded). `value` is 0..1 (−1..1 for a bipolar wheel); a pad is its velocity while held and 0 on release; a button is 0 or 1; for keys it is that note\'s velocity. `raw` is the MIDI number (0..127, pitch bend 0..16383). `signal` is the name the rest of open-audiovisual uses (`midi/lpd8/k1`; for a key `midi/minilab3/n60`). `message` is the parsed MIDI (`{ type: \'cc\', ch: 1, cc: 70, value: 53 }`) and `bytes` the raw bytes. `source` is `\'ui\'` (a finger, a mouse, `set()`), `\'hardware\'` (a real port, or bytes you `ingest()`) or `\'mirror\'`.',
        zh: '一定會有的欄位：`profile`（設定檔 id）、`id`、`type`、`label`、`value`、`raw`、`signal`、`message`、`bytes`、`source`、`time`（`performance.now()`，取整數）。`value` 是 0..1（雙向彎音輪是 −1..1），打擊墊在按著時是力度、放開是 0，按鈕是 0 或 1，琴鍵則是那個音的力度。`raw` 是 MIDI 的號碼（0..127，彎音是 0..16383）。`signal` 是 open-audiovisual 其他部分用的名稱（`midi/lpd8/k1`，琴鍵是 `midi/minilab3/n60`）。`message` 是解析後的 MIDI（`{ type: \'cc\', ch: 1, cc: 70, value: 53 }`），`bytes` 是原始位元組。`source` 是 `\'ui\'`（手指、滑鼠、`set()`）、`\'hardware\'`（真實的埠，或你 `ingest()` 的位元組）或 `\'mirror\'`。',
      },
      {
        en: 'Sometimes there: `note` and `velocity` (note messages, `velocity` 0 for a release), `delta` (a relative encoder: the signed steps), `held` (a pad or button), and `pressure` (a pad, when it is above 0). The `control`, `noteon` and `noteoff` events carry it as their `detail`.',
        zh: '有時才有的欄位：`note` 和 `velocity`（音符訊息，放開時 `velocity` 為 0）、`delta`（相對旋鈕：有正負號的步數）、`held`（打擊墊或按鈕）、`pressure`（打擊墊，大於 0 時才有）。`control`、`noteon`、`noteoff` 事件把它當作 `detail`。',
      },
    ],
    examples: [
      {
        code: `import { MidiController, profileById } from '@openav/midi';
import { controlDetail, describeDetail } from '@openav/midi/embed';

const mc = new MidiController(profileById('minilab3'));
mc.onChange((id, st, info) => {
  if (!id) return;
  const detail = controlDetail(mc, id, st, info);
  console.log(describeDetail(detail));
  console.log(detail.bytes, detail.source, detail.signal);
});

mc.setValue('knob1', 0.42);`,
        caption: { en: 'Prints the readout line `midi/minilab3/knob1 = 0.42 ← CC 74 = 53 · ch 1`, then the bytes `[176, 74, 53]`, `ui` and the signal name.', zh: '印出讀數列的文字 `midi/minilab3/knob1 = 0.42 ← CC 74 = 53 · ch 1`，再印出位元組 `[176, 74, 53]`、`ui` 和訊號名稱。' },
      },
    ],
    related: ['describeDetail', 'describeMessage', 'OavController', 'ControllerHost', 'toParent'],
    keywords: { en: ['control event', 'event payload', 'detail', 'value raw signal', 'bytes', 'source'], zh: ['control 事件', '事件內容', 'detail', 'value raw signal', '位元組', '來源'] },
  },

  describeMessage: {
    group: 'controllers',
    summary: {
      en: 'Writes one parsed MIDI message the way a person reads it: `CC 70 = 53`, `Note 36 · vel 90`, `Bend 12288`.',
      zh: '把一則解析過的 MIDI 訊息寫成人讀得懂的樣子：`CC 70 = 53`、`Note 36 · vel 90`、`Bend 12288`。',
    },
    params: [
      { name: 'm', type: 'Object | null', en: 'An event from [`parseMessage()`](#parseMessage). `null` gives an empty string.', zh: '[`parseMessage()`](#parseMessage) 的事件。給 `null` 回傳空字串。' },
    ],
    returns: { type: 'String', en: '`CC 70 = 53`, `Note 36 · vel 90`, `Note 36 off`, `Bend 12288` (the raw 14-bit value), `Pressure 50`, `Poly AT 36 = 12`, `Program 5`; any other type gives its name.', zh: '`CC 70 = 53`、`Note 36 · vel 90`、`Note 36 off`、`Bend 12288`（原始的 14 位元數值）、`Pressure 50`、`Poly AT 36 = 12`、`Program 5`，其他類型則回傳類型名稱。' },
    description: [
      {
        en: 'These are the shorter lines of the `<oav-controller>` readout. [`describe()`](#describe) writes the longer log lines (`CC ch1 #70=53`).',
        zh: '這是 `<oav-controller>` 讀數列用的較短文字。[`describe()`](#describe) 寫的是較長的記錄文字（`CC ch1 #70=53`）。',
      },
    ],
    examples: [
      {
        code: `import { parseMessage } from '@openav/midi';
import { describeMessage } from '@openav/midi/embed';

for (const bytes of [[0xb0, 70, 53], [0x99, 36, 90], [0x89, 36, 0], [0xe0, 0, 96]]) {
  console.log(describeMessage(parseMessage(bytes)));
}`,
        caption: { en: 'Prints `CC 70 = 53`, `Note 36 · vel 90`, `Note 36 off` and `Bend 12288`.', zh: '印出 `CC 70 = 53`、`Note 36 · vel 90`、`Note 36 off` 和 `Bend 12288`。' },
      },
    ],
    related: ['describeDetail', 'describe', 'parseMessage'],
    keywords: { en: ['readout', 'message text', 'cc 70', 'readable midi'], zh: ['讀數列', '訊息文字', 'cc 70', '好讀的 midi'] },
  },

  describeDetail: {
    group: 'controllers',
    summary: {
      en: 'Writes the readout line for a `control` event payload: `midi/minilab3/knob1 = 0.42 ← CC 74 = 53 · ch 1`.',
      zh: '為 `control` 事件的內容寫出讀數列的文字：`midi/minilab3/knob1 = 0.42 ← CC 74 = 53 · ch 1`。',
    },
    params: [
      { name: 'd', type: 'Object | null', en: 'A payload from [`controlDetail()`](#controlDetail) (or a `control` event\'s `detail`). `null` gives an empty string.', zh: '[`controlDetail()`](#controlDetail) 的內容（或 `control` 事件的 `detail`）。給 `null` 回傳空字串。' },
    ],
    returns: { type: 'String', en: 'The signal name, the value (two decimals, or a whole number from 100 up), then `←`, the message as [`describeMessage()`](#describeMessage) writes it and the channel.', zh: '訊號名稱、數值（兩位小數，100 以上則是整數），接著是 `←`、用 [`describeMessage()`](#describeMessage) 寫的訊息，和頻道。' },
    description: [
      {
        en: 'This is the text `<oav-controller readout>` shows under the faceplate. Use it for your own log or caption. A payload without a `message` shows only the signal and the value.',
        zh: '`<oav-controller readout>` 在面板下面顯示的就是這段文字。拿去做你自己的記錄或字幕也很方便。沒有 `message` 的內容只會顯示訊號和數值。',
      },
    ],
    examples: [
      {
        code: `import { createController } from '@openav/midi';
import { describeDetail } from '@openav/midi/embed';

const ctl = createController('minilab3');
ctl.on('control', (d) => console.log(describeDetail(d)));

ctl.set('knob1', 0.42);
ctl.set('pitch', 1);
ctl.set('pad1', 1);`,
        caption: { en: 'Prints `midi/minilab3/knob1 = 0.42 ← CC 74 = 53 · ch 1`, then the same kind of line for the pitch bend and pad 1.', zh: '印出 `midi/minilab3/knob1 = 0.42 ← CC 74 = 53 · ch 1`，接著是彎音輪和 pad 1 的同類文字。' },
      },
    ],
    related: ['controlDetail', 'describeMessage', 'OavController'],
    keywords: { en: ['readout line', 'event text', 'knob = 0.42', 'caption'], zh: ['讀數列', '事件文字', '旋鈕 = 0.42', '字幕'] },
  },

  setControl: {
    group: 'controllers',
    summary: {
      en: 'Moves one control the way a hand would, whatever its type, and returns the MIDI bytes it sent: `setControl(mc, \'k1\', 0.5)`.',
      zh: '像一隻手一樣去動某個控制項，不論它是什麼類型，並回傳它送出的 MIDI 位元組：`setControl(mc, \'k1\', 0.5)`。',
    },
    params: [
      { name: 'mc', type: 'MidiController', en: 'The controller.', zh: '控制器。' },
      { name: 'id', type: 'String', en: 'The control id. An unknown id throws `<profile> has no control "x" (controls: …)`.', zh: '控制項 id。不存在的 id 會丟出 `<profile> has no control "x" (controls: …)`。' },
      { name: 'value', type: 'Number', en: 'The value (below). Anything that is not a finite number throws `set("id"): value must be a number`.', zh: '數值（見下）。不是有限數字的值會丟出 `set("id"): value must be a number`。' },
      { name: 'note', type: 'Number | null', en: 'For a keys control: which note. The default is the first key of its range.', zh: '琴鍵控制項要給：哪個音。預設是音域的第一個鍵。' },
      { name: 'source', type: 'String', en: '`\'ui\'` (default) publishes and reaches MIDI out. `\'mirror\'` moves only the faceplate (two-way binding).', zh: '`\'ui\'`（預設）會發佈並送到 MIDI 輸出。`\'mirror\'` 只動面板（雙向綁定用）。' },
    ],
    returns: { type: 'number[] | null', en: 'The bytes sent, or `null` when nothing changed (for example releasing a pad that is not held).', zh: '送出的位元組，沒有變化時（例如放開一個沒按著的打擊墊）回傳 `null`。' },
    description: [
      {
        en: 'What `value` means depends on the type. Knob, fader, wheel, strip and encoder: 0..1 (−1..1 for a bipolar one). Pad and momentary button: above 0 presses (with that velocity, held to 1) and 0 releases. Toggle button: 0.5 or more is on. Keys: `value` is the velocity, above 0 presses that `note` and 0 releases it. This is what `set()` on [`ControllerHost`](#ControllerHost) and `<oav-controller>` call.',
        zh: '`value` 的意思依類型而定。旋鈕、推桿、彎音輪、觸控條、編碼器：0..1（雙向的是 −1..1）。打擊墊和瞬間按鈕：大於 0 是按下（用那個力度，上限 1），0 是放開。切換按鈕：0.5 以上是開。琴鍵：`value` 是力度，大於 0 按下那個 `note`，0 放開它。`ControllerHost` 和 `<oav-controller>` 的 `set()` 呼叫的就是它。',
      },
    ],
    examples: [
      {
        code: `import { MidiController, profileById } from '@openav/midi';
import { setControl } from '@openav/midi/embed';

const mc = new MidiController(profileById('lpd8'));
console.log(setControl(mc, 'k1', 0.5));      // [176, 70, 64]  : a knob
console.log(setControl(mc, 'pad1', 1));      // [153, 36, 127] : a pad pressed
console.log(setControl(mc, 'pad1', 0));      // [137, 36, 0]   : released
console.log(setControl(mc, 'pad1', 0));      // null           : nothing to release`,
        caption: { en: 'Prints the three messages the control types send, then `null`.', zh: '印出幾種控制項送出的三則訊息，最後是 `null`。' },
      },
    ],
    related: ['valuesOf', 'MidiController', 'ControllerHost', 'restValue'],
    keywords: { en: ['set control', 'move a knob', 'press a pad', 'simulate hand', 'send value'], zh: ['設定控制項', '轉旋鈕', '按打擊墊', '模擬手', '送出數值'] },
  },

  valuesOf: {
    group: 'controllers',
    summary: {
      en: 'Reads every control\'s current value from a controller as `{ id: number }`; for keys it is 1 while any key is held.',
      zh: '從控制器讀出每個控制項目前的值，格式是 `{ id: number }`，琴鍵控制項在有任何一個鍵按著時是 1。',
    },
    params: [
      { name: 'mc', type: 'MidiController', en: 'The controller.', zh: '控制器。' },
    ],
    returns: { type: 'Object', en: 'One number per control id, in the profile\'s order.', zh: '每個控制項 id 一個數字，順序跟設定檔一致。' },
    description: [
      {
        en: 'This is what `values()` returns on [`ControllerHost`](#ControllerHost) and `<oav-controller>`, and what the iframe answers to the `get` command.',
        zh: '[`ControllerHost`](#ControllerHost) 和 `<oav-controller>` 的 `values()` 回傳的就是它，iframe 對 `get` 指令的回答也是它。',
      },
    ],
    examples: [
      {
        code: `import { MidiController, profileById } from '@openav/midi';
import { valuesOf } from '@openav/midi/embed';

const mc = new MidiController(profileById('lpd8'));
mc.setValue('k1', 1);
mc.press('pad2', 0.5);
const values = valuesOf(mc);
console.log(Object.keys(values).length, 'controls');
console.log('k1 =', values.k1, '| pad2 =', values.pad2.toFixed(2), '| pad1 =', values.pad1);`,
        caption: { en: 'Prints `16 controls`, then `k1 = 1 | pad2 = 0.50 | pad1 = 0`: one number for every control of the LPD8.', zh: '印出 `16 controls`，再印出 `k1 = 1 | pad2 = 0.50 | pad1 = 0`：LPD8 的每個控制項各有一個數字。' },
      },
    ],
    related: ['setControl', 'ControllerHost'],
    keywords: { en: ['all values', 'snapshot', 'current state', 'values object'], zh: ['所有數值', '快照', '目前狀態', '數值物件'] },
  },

  restValue: {
    group: 'controllers',
    summary: {
      en: 'Says where a control rests: knobs and faders at their default (0), bipolar wheels at the centre, pads, buttons and keys at 0.',
      zh: '說明控制項休息時在哪裡：旋鈕和推桿在預設值（0），雙向彎音輪在中心，打擊墊、按鈕和琴鍵在 0。',
    },
    params: [
      { name: 'c', type: 'Object', en: 'A control definition from a normalized profile.', zh: '整理過的設定檔中的控制項定義。' },
    ],
    returns: { type: 'Number', en: '0 for keys, pads, buttons and bipolar controls; otherwise the control\'s `def`, else 0.5 for an endless encoder and 0 for the rest.', zh: '琴鍵、打擊墊、按鈕和雙向控制項是 0。其他用控制項的 `def`，沒有的話無限旋鈕是 0.5，其餘是 0。' },
    description: [
      {
        en: '`reset()` on [`ControllerHost`](#ControllerHost) uses it to bring every control home. An endless encoder has no real position, so only its drawn position goes to the middle and no MIDI is sent for it.',
        zh: '[`ControllerHost`](#ControllerHost) 的 `reset()` 用它讓每個控制項回到原位。無限旋鈕沒有真正的位置，所以只有畫面上的位置會回到中間，而且不會送出 MIDI。',
      },
    ],
    examples: [
      {
        code: `import { normalizeProfile, profileById } from '@openav/midi';
import { restValue } from '@openav/midi/embed';

const p = normalizeProfile(profileById('minilab3'));
for (const id of ['knob1', 'pitch', 'enc', 'pad1', 'keys']) {
  console.log(id, restValue(p.controls.find((c) => c.id === id)));
}`,
        caption: { en: 'Prints 0 for the knob, the pitch strip (centre), the pad and the keys, and 0.5 for the endless encoder.', zh: '旋鈕、音高觸控條（中心）、打擊墊和琴鍵印出 0，無限旋鈕印出 0.5。' },
      },
    ],
    related: ['setControl', 'ControllerHost'],
    keywords: { en: ['rest position', 'home', 'reset controls', 'default value'], zh: ['休息位置', '歸位', '重設控制項', '預設值'] },
  },

  // ---------------------------------------------------------------- the postMessage protocol between an iframe and its page

  POST_SOURCE: {
    group: 'controllers',
    summary: {
      en: 'The word that marks a message as an open-audiovisual embed message: `\'openav\'`, sent as `source` by the iframe and as `target` by the page.',
      zh: '標記一則訊息屬於 open-audiovisual 嵌入的字：`\'openav\'`，iframe 送出時放在 `source`，外層頁面送進去時放在 `target`。',
    },
    value: {
      type: 'String', range: '\'openav\'',
      en: 'A constant. A message from the iframe has `source: \'openav\'`, and a command to the iframe has `target: \'openav\'`. Anything else is ignored on both sides.',
      zh: '常數。iframe 送出的訊息有 `source: \'openav\'`，送進 iframe 的指令有 `target: \'openav\'`。兩邊都會忽略其他任何訊息。',
    },
    description: [
      {
        en: '[`toParent()`](#toParent) and [`toFrame()`](#toFrame) write it for you, and [`fromFrame()`](#fromFrame) and [`fromParent()`](#fromParent) check it.',
        zh: '[`toParent()`](#toParent) 和 [`toFrame()`](#toFrame) 會替你寫入，[`fromFrame()`](#fromFrame) 和 [`fromParent()`](#fromParent) 負責檢查。',
      },
    ],
    examples: [
      {
        code: `import { POST_SOURCE, toParent, toFrame } from '@openav/midi/embed';

console.log(POST_SOURCE);                              // openav
console.log(toParent('ready').source, toFrame('get').target);   // openav openav`,
        caption: { en: 'Prints `openav`, then `openav openav`.', zh: '印出 `openav`，再印出 `openav openav`。' },
      },
    ],
    related: ['POST_VERSION', 'toParent', 'toFrame', 'fromFrame', 'fromParent'],
    keywords: { en: ['postMessage', 'openav', 'message source', 'iframe protocol'], zh: ['postMessage', 'openav', '訊息來源', 'iframe 協定'] },
  },

  POST_VERSION: {
    group: 'controllers',
    summary: {
      en: 'The version of the iframe message format, `1`, written as `v` in every message.',
      zh: 'iframe 訊息格式的版本，`1`，會寫成每則訊息裡的 `v`。',
    },
    value: {
      type: 'Number', range: '1',
      en: 'A constant, so a page can tell when the format changes. [`fromFrame()`](#fromFrame) gives `v` back (1 when a message lacks it).',
      zh: '常數，讓頁面在格式改變時能分辨。[`fromFrame()`](#fromFrame) 會把 `v` 還給你（訊息沒有時是 1）。',
    },
    description: [
      {
        en: 'Messages from [`toParent()`](#toParent) and [`toFrame()`](#toFrame) carry it as `v: 1`.',
        zh: '[`toParent()`](#toParent) 和 [`toFrame()`](#toFrame) 的訊息都會帶著 `v: 1`。',
      },
    ],
    examples: [
      {
        code: `import { POST_VERSION, toParent } from '@openav/midi/embed';

console.log(POST_VERSION, toParent('ready').v);   // 1 1`,
        caption: { en: 'Prints `1 1`.', zh: '印出 `1 1`。' },
      },
    ],
    related: ['POST_SOURCE', 'toParent', 'fromFrame'],
    keywords: { en: ['protocol version', 'message format version'], zh: ['協定版本', '訊息格式版本'] },
  },

  FRAME_COMMANDS: {
    group: 'controllers',
    summary: {
      en: 'The commands a page may send into an embed iframe: `set`, `ingest`, `reset`, `profile`, `layout`, `get`, `press`, `release`.',
      zh: '外層頁面可以送進嵌入 iframe 的指令：`set`、`ingest`、`reset`、`profile`、`layout`、`get`、`press`、`release`。',
    },
    value: {
      type: 'string[]', range: '[\'set\', \'ingest\', \'reset\', \'profile\', \'layout\', \'get\', \'press\', \'release\']',
      en: 'A plain array. [`fromParent()`](#fromParent) ignores a message whose `type` is not one of these.',
      zh: '一個普通陣列。[`fromParent()`](#fromParent) 會忽略 `type` 不在這份清單裡的訊息。',
    },
    description: [
      {
        en: 'What each does: `set` `{ id, value, note?, quiet? }` moves a control, `press` `{ id, velocity?, note? }` and `release` `{ id, note? }` hold and let go, `ingest` `{ bytes }` feeds MIDI (one message or a list), `reset` brings everything home, `profile` `{ profile }` switches the device, `layout` `{ layout }` changes the layout, and `get` asks for every value (the iframe answers with a `values` message).',
        zh: '各指令的作用：`set` `{ id, value, note?, quiet? }` 移動控制項，`press` `{ id, velocity?, note? }` 與 `release` `{ id, note? }` 按住與放開，`ingest` `{ bytes }` 餵入 MIDI（一則或一串），`reset` 讓所有東西回到原位，`profile` `{ profile }` 切換機器，`layout` `{ layout }` 改變版面，`get` 要求所有數值（iframe 會用一則 `values` 訊息回答）。',
      },
    ],
    examples: [
      {
        code: `import { FRAME_COMMANDS, toFrame } from '@openav/midi/embed';

console.log(FRAME_COMMANDS.join(' '));
console.log(toFrame('set', { id: 'k1', value: 0.5 }));   // the message you post to the iframe`,
        caption: { en: 'Prints the eight commands, then the message `{ target: \'openav\', v: 1, type: \'set\', id: \'k1\', value: 0.5 }`.', zh: '印出八個指令，再印出訊息 `{ target: \'openav\', v: 1, type: \'set\', id: \'k1\', value: 0.5 }`。' },
      },
    ],
    related: ['fromParent', 'toFrame', 'EMBED_EVENTS'],
    keywords: { en: ['iframe commands', 'control the iframe', 'postMessage commands'], zh: ['iframe 指令', '控制 iframe', 'postMessage 指令'] },
  },

  toParent: {
    group: 'controllers',
    summary: {
      en: 'Frame side: builds the message the iframe posts to its page for an event: `{ source: \'openav\', v: 1, type, frame, detail }`.',
      zh: 'iframe 這一側：為一個事件組出 iframe 要送給外層頁面的訊息：`{ source: \'openav\', v: 1, type, frame, detail }`。',
    },
    params: [
      { name: 'type', type: 'String', en: 'The event name (see [`EMBED_EVENTS`](#EMBED_EVENTS)), or `values`.', zh: '事件名稱（見 [`EMBED_EVENTS`](#EMBED_EVENTS)），或 `values`。' },
      { name: 'detail', type: 'any', en: 'The event payload. It is copied through JSON, so the message is always `postMessage`-safe (`undefined` becomes `null`).', zh: '事件內容。會經過 JSON 複製，所以訊息一定能安全地 `postMessage`（`undefined` 變成 `null`）。' },
      { name: 'frame', type: 'String | null', en: 'A name for this iframe (the `?frame=` parameter), echoed in every message so a page with several frames can tell them apart.', zh: '這個 iframe 的名字（`?frame=` 參數），每則訊息都會帶著，這樣頁面上有好幾個 frame 時才分得出來。' },
    ],
    returns: { type: 'Object', en: 'The message `{ source: \'openav\', v: 1, type, frame, detail }`.', zh: '訊息物件 `{ source: \'openav\', v: 1, type, frame, detail }`。' },
    description: [
      {
        en: 'The iframe page calls `parent.postMessage(toParent(name, detail, { frame }), target)` for every event, where `target` is the `?origin=` parameter or `*`. With `?origin=https://your.site` the frame posts only to that origin and accepts commands only from it.',
        zh: 'iframe 頁面對每個事件都呼叫 `parent.postMessage(toParent(name, detail, { frame }), target)`，`target` 是 `?origin=` 參數，沒有就是 `*`。加上 `?origin=https://your.site` 之後，frame 只會送給那個來源，也只接受從它來的指令。',
      },
    ],
    examples: [
      {
        code: `import { toParent } from '@openav/midi/embed';

const msg = toParent('control', { id: 'k1', value: 0.5 }, { frame: 'pads' });
console.log(JSON.stringify(msg));               // {"source":"openav","v":1,"type":"control","frame":"pads","detail":{"id":"k1","value":0.5}}
console.log(JSON.stringify(toParent('ready')));  // frame and detail are null`,
        caption: { en: 'Prints the full message for a `control` event, then a bare `ready` message with `frame` and `detail` as `null`.', zh: '印出 `control` 事件的完整訊息，再印出沒有 `frame` 和 `detail` 的單純 `ready` 訊息（兩者都是 `null`）。' },
      },
    ],
    related: ['fromFrame', 'toFrame', 'fromParent', 'POST_SOURCE', 'EMBED_EVENTS'],
    keywords: { en: ['postMessage', 'iframe to page', 'embed message', 'frame name'], zh: ['postMessage', 'iframe 傳給頁面', '嵌入訊息', 'frame 名稱'] },
  },

  fromFrame: {
    group: 'controllers',
    summary: {
      en: 'Page side: reads a message that came from an embed iframe, returns `{ type, frame, detail, v }`, or `null` when it is not one of ours.',
      zh: '外層頁面這一側：讀取從嵌入 iframe 來的訊息，回傳 `{ type, frame, detail, v }`，不是我們的訊息就回傳 `null`。',
    },
    params: [
      { name: 'data', type: 'any', en: 'The `event.data` of a `message` event.', zh: '`message` 事件的 `event.data`。' },
    ],
    returns: { type: '{ type, frame, detail, v } | null', en: '`null` unless `data` is an object with `source: \'openav\'` and a string `type`.', zh: '除非 `data` 是帶有 `source: \'openav\'` 和字串 `type` 的物件，否則回傳 `null`。' },
    description: [
      {
        en: 'Other scripts and extensions post to a page all the time, so always filter. Check `event.origin` too when the page cares who sent it: this function checks the shape, not the sender.',
        zh: '別的腳本和瀏覽器擴充功能隨時都在對頁面送訊息，所以一定要過濾。頁面在意是誰送的話，也要檢查 `event.origin`：這個函式檢查的是格式，不是寄件者。',
      },
    ],
    examples: [
      {
        code: `import { fromFrame, toParent } from '@openav/midi/embed';

// what a page does with every 'message' event; here the message is made by hand
const data = toParent('control', { id: 'k1', signal: 'midi/lpd8/k1', value: 1 }, { frame: 'pads' });
const msg = fromFrame(data);
if (msg && msg.type === 'control') console.log(msg.frame, msg.detail.signal, msg.detail.value);

console.log(fromFrame({ type: 'control' }), fromFrame('hello'));   // null null`,
        caption: { en: 'Prints `pads midi/lpd8/k1 1`, then `null null` for messages that are not ours.', zh: '印出 `pads midi/lpd8/k1 1`，再對不是我們的訊息印出 `null null`。' },
      },
      {
        code: `window.addEventListener('message', (e) => {
  const msg = fromFrame(e.data);
  if (!msg) return;                                        // not from an openav iframe
  if (msg.frame === 'pads' && msg.type === 'control') {
    console.log(msg.detail.id, msg.detail.value);
  }
});`,
        caption: { en: 'The listener to put on the page that holds the iframe.', zh: '放在包著 iframe 的那個頁面上的監聽程式。' },
        run: 'static',
        why: 'It needs a page that holds a real iframe of /embed/controller/ to receive messages from.',
      },
    ],
    related: ['toParent', 'toFrame', 'fromParent', 'POST_SOURCE'],
    keywords: { en: ['postMessage listener', 'message from iframe', 'read embed message'], zh: ['postMessage 監聽', '來自 iframe 的訊息', '讀取嵌入訊息'] },
  },

  toFrame: {
    group: 'controllers',
    summary: {
      en: 'Page side: builds a command to post into an embed iframe: `{ target: \'openav\', v: 1, type, ...args }`.',
      zh: '外層頁面這一側：組出要送進嵌入 iframe 的指令：`{ target: \'openav\', v: 1, type, ...args }`。',
    },
    params: [
      { name: 'type', type: 'String', en: 'The command: one of [`FRAME_COMMANDS`](#FRAME_COMMANDS).', zh: '指令：[`FRAME_COMMANDS`](#FRAME_COMMANDS) 其中之一。' },
      { name: 'args', type: 'Object', en: 'The command\'s fields (`{ id, value }` for `set`). Copied through JSON.', zh: '指令的欄位（`set` 是 `{ id, value }`）。會經過 JSON 複製。' },
    ],
    returns: { type: 'Object', en: 'A message ready for `iframe.contentWindow.postMessage(msg, origin)`.', zh: '可以直接給 `iframe.contentWindow.postMessage(msg, origin)` 的訊息。' },
    description: [
      {
        en: 'It does not check the command: the iframe does, with [`fromParent()`](#fromParent), and ignores what it does not understand. Post to the frame\'s real origin, not `*`, when you can.',
        zh: '它不檢查指令內容：iframe 會用 [`fromParent()`](#fromParent) 檢查，不懂的就忽略。可以的話請送給 frame 真正的來源，不要用 `*`。',
      },
    ],
    examples: [
      {
        code: `import { toFrame } from '@openav/midi/embed';

console.log(JSON.stringify(toFrame('set', { id: 'k1', value: 0.5 })));
console.log(JSON.stringify(toFrame('ingest', { bytes: [0xb0, 70, 64] })));
console.log(JSON.stringify(toFrame('profile', { profile: 'korg-nanokontrol2' })));
// iframe.contentWindow.postMessage(toFrame('get'), 'https://openaudiovisual.com');`,
        caption: { en: 'Prints three command messages; the last line (commented out) is how you would send one.', zh: '印出三則指令訊息，最後一行（被註解掉的）是實際送出一則的做法。' },
      },
    ],
    related: ['fromParent', 'toParent', 'FRAME_COMMANDS', 'POST_SOURCE'],
    keywords: { en: ['postMessage command', 'control the iframe', 'page to iframe', 'send command'], zh: ['postMessage 指令', '控制 iframe', '頁面傳給 iframe', '送出指令'] },
  },

  fromParent: {
    group: 'controllers',
    summary: {
      en: 'Frame side: validates a command from the page and returns a clean command, or `null` (the message is ignored).',
      zh: 'iframe 這一側：驗證外層頁面送來的指令，回傳整理乾淨的指令，不合格就回傳 `null`（訊息被忽略）。',
    },
    params: [
      { name: 'data', type: 'any', en: 'The `event.data` of a `message` event.', zh: '`message` 事件的 `event.data`。' },
    ],
    returns: { type: 'Object | null', en: 'A command such as `{ type: \'set\', id: \'k1\', value: 0.5, note: null, quiet: false }`, or `null`.', zh: '像 `{ type: \'set\', id: \'k1\', value: 0.5, note: null, quiet: false }` 這樣的指令，或 `null`。' },
    description: [
      {
        en: 'It is strict, because anything on the web can post to an iframe. The message needs `target: \'openav\'` and a `type` from [`FRAME_COMMANDS`](#FRAME_COMMANDS). Control ids must be lower-case `[a-z0-9_-]`. `value` must be a finite number. `note` must be an integer 0..127 (else `null`). A `press` velocity is held to 0..1. `ingest` takes one message of 1 to 3 bytes whose first byte is a status byte (128 or more), or up to 256 such messages. `profile` takes an id or an `https://` URL (not `http://`). `layout` must be in [`EMBED_LAYOUTS`](#EMBED_LAYOUTS).',
        zh: '它很嚴格，因為網路上任何東西都能對 iframe 送訊息。訊息必須有 `target: \'openav\'`，`type` 要在 [`FRAME_COMMANDS`](#FRAME_COMMANDS) 裡。控制項 id 必須是小寫的 `[a-z0-9_-]`。`value` 必須是有限的數字。`note` 必須是 0..127 的整數（否則是 `null`）。`press` 的力度會限制在 0..1。`ingest` 接受一則 1 到 3 個位元組、第一個位元組是狀態位元組（128 以上）的訊息，或最多 256 則這樣的訊息。`profile` 接受 id 或 `https://` 網址（不接受 `http://`）。`layout` 必須在 [`EMBED_LAYOUTS`](#EMBED_LAYOUTS) 裡。',
      },
    ],
    examples: [
      {
        code: `import { fromParent, toFrame } from '@openav/midi/embed';

const show = (data) => console.log(JSON.stringify(fromParent(data)));

show(toFrame('set', { id: 'k1', value: '0.5' }));    // value is read as a number
show(toFrame('press', { id: 'pad1', velocity: 2 })); // velocity held to 1
show(toFrame('ingest', { bytes: [0xb0, 70, 64] }));

// all of these are ignored: null
show({ source: 'openav', type: 'set', id: 'k1', value: 1 });    // wrong key: source, not target
show(toFrame('set', { id: '<img>', value: 1 }));                // bad id
show(toFrame('profile', { profile: 'http://x.org/p.json' }));   // http, not https
show(toFrame('eval', { code: 'alert(1)' }));                    // not a command`,
        caption: { en: 'Prints three clean commands, then four `null`s for messages the frame would ignore.', zh: '印出三個整理乾淨的指令，再對 frame 會忽略的四則訊息印出四個 `null`。' },
      },
    ],
    related: ['toFrame', 'fromFrame', 'toParent', 'FRAME_COMMANDS'],
    keywords: { en: ['validate command', 'iframe security', 'postMessage validation', 'ignore bad messages'], zh: ['驗證指令', 'iframe 安全', 'postMessage 驗證', '忽略不合法訊息'] },
  },
};
