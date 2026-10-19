// oav-p5 reference: note names and pitch (0.8). Read by tools/build-reference.mjs (see AGENTS.md, "Documenting a public name").
// C4 is MIDI 60 here (scientific pitch notation: A4 is 69, which is 440 Hz). Some software (Ableton Live, Yamaha) calls 60 "C3":
// the number is the same, only the octave label differs, so a name copied from there is one octave off.

export default {
  noteNumber: {
    group: 'notes',
    summary: { en: 'Turns a note name like `\'C4\'` into its MIDI number, 0 to 127.', zh: '把像 `\'C4\'` 這樣的音名轉成 MIDI 號碼，0 到 127。' },
    params: [{ name: 'v', type: 'String | Number', en: 'A note name (`\'C4\'`, `\'c#4\'`, `\'Db3\'`, `\'F♯2\'`) or a number. A number comes back rounded and held to 0..127.', zh: '音名（`\'C4\'`、`\'c#4\'`、`\'Db3\'`、`\'F♯2\'`）或數字。數字會四捨五入並限制在 0..127。' }],
    returns: { type: 'Number', en: 'The MIDI number: `noteNumber(\'C4\')` is 60, `noteNumber(\'A4\')` is 69.', zh: 'MIDI 號碼：`noteNumber(\'C4\')` 是 60，`noteNumber(\'A4\')` 是 69。' },
    description: [
      {
        en: 'A name is a letter A to G (either case), an optional `#` or `b` (`♯` and `♭` too), and the octave: `C4`, `c#4`, `Db3`, `C-1` (0) up to `G9` (127). **C4 is 60.** Anything else, such as `\'H4\'` or `\'C-2\'`, throws an error, and a card beside the 🎹 says how to write a note.',
        zh: '音名由一個 A 到 G 的字母（大小寫都可以）、可有可無的 `#` 或 `b`（`♯`、`♭` 也行），加上八度數字組成：`C4`、`c#4`、`Db3`，從 `C-1`（0）到 `G9`（127）。**C4 是 60。** 其他寫法（像 `\'H4\'`、`\'C-2\'`）會丟出錯誤，🎹 旁邊也會有一張卡片告訴你音名怎麼寫。',
      },
      {
        en: 'You rarely call it yourself: every place that takes a note number also takes a name, such as [`noteIsDown()`](#noteIsDown) and [`midi.play()`](#OAVp5.play).',
        zh: '通常不用自己呼叫：凡是收音符號碼的地方也都收音名，像 [`noteIsDown()`](#noteIsDown) 和 [`midi.play()`](#OAVp5.play)。',
      },
    ],
    examples: [
      {
        code: `function setup() {
  createCanvas(400, 300);
  textAlign(CENTER, CENTER);
  textSize(40);
}

function draw() {
  background(20);
  fill(255);
  text('C4 = ' + noteNumber('C4') + '\\nA4 = ' + noteNumber('A4') + '\\nF#2 = ' + noteNumber('F#2'), width / 2, height / 2);
}`,
        caption: { en: 'Prints 60, 69 and 42.', zh: '印出 60、69、42。' },
      },
    ],
    claims: [{ expr: "noteNumber('C4')", equals: 60 }, { expr: "noteNumber('A4')", equals: 69 }, { expr: "noteNumber('Db3')", equals: 49 }],
    related: ['noteName', 'noteFreq', 'noteIsDown'],
    keywords: { en: ['note name', 'midi number', 'C4', 'convert', 'pitch', 'sharp', 'flat'], zh: ['音名', 'midi 號碼', '轉換', '音高', '升記號', '降記號'] },
  },

  noteName: {
    group: 'notes',
    summary: { en: 'Turns a MIDI number into a note name: `noteName(61)` is `\'C#4\'`.', zh: '把 MIDI 號碼轉成音名：`noteName(61)` 是 `\'C#4\'`。' },
    params: [
      { name: 'v', type: 'Number | String', en: 'A MIDI number (or a name, which is normalised).', zh: 'MIDI 號碼（給音名的話會被整理成標準寫法）。' },
      { name: 'o', type: 'Object', optional: true, en: 'Options: `{ flats: true }` writes `\'Db4\'` instead of `\'C#4\'`; `{ octave: false }` drops the octave number (`\'C#\'`).', zh: '選項：`{ flats: true }` 寫成 `\'Db4\'` 而不是 `\'C#4\'`。`{ octave: false }` 不寫八度數字（`\'C#\'`）。' },
    ],
    returns: { type: 'String', en: 'The name, sharps by default: `noteName(60)` is `\'C4\'`.', zh: '音名，預設用升記號：`noteName(60)` 是 `\'C4\'`。' },
    description: [
      {
        en: '[`notePressed(note, velocity)`](#notePressed) hands you the number; `noteName(note)` writes it back as a name for the screen or a lookup table. The same C4-is-60 convention as [`noteNumber()`](#noteNumber).',
        zh: '[`notePressed(note, velocity)`](#notePressed) 給你的是號碼。`noteName(note)` 把它寫回音名，拿去顯示在畫面上或查表。跟 [`noteNumber()`](#noteNumber) 一樣，C4 就是 60。',
      },
    ],
    examples: [
      {
        code: `let shown = 'play a key';

function setup() {
  createCanvas(400, 300);
  textAlign(CENTER, CENTER);
  textSize(64);
}

function notePressed(note) {
  shown = noteName(note) + '  ' + noteName(note, { flats: true });
}

function draw() {
  background(20);
  fill(255);
  text(shown, width / 2, height / 2);
}`,
        caption: { en: 'Shows each key twice, with sharps and with flats (they differ on black keys). Open 🎹 and play.', zh: '每個鍵用升記號和降記號各寫一次（黑鍵兩種寫法不同）。打開 🎹 彈彈看。' },
      },
    ],
    claims: [{ expr: 'noteName(61)', equals: 'C#4' }, { expr: 'noteName(61, { flats: true })', equals: 'Db4' }, { expr: 'noteName(61, { octave: false })', equals: 'C#' }],
    related: ['noteNumber', 'noteFreq', 'notePressed', 'note'],
    keywords: { en: ['note name', 'midi number', 'C4', 'convert', 'sharp', 'flat', 'display'], zh: ['音名', 'midi 號碼', '轉換', '升記號', '降記號'] },
  },

  noteFreq: {
    group: 'notes',
    summary: { en: 'Returns the frequency in Hz of a note: `noteFreq(\'A4\')` is 440.', zh: '回傳音符的頻率（赫茲）：`noteFreq(\'A4\')` 是 440。' },
    params: [{ name: 'v', type: 'Number | String', en: 'A note name or a MIDI number. A number may be fractional (69.5 is a quarter tone above A4) and is not held to 0..127.', zh: '音名或 MIDI 號碼。數字可以有小數（69.5 是比 A4 高四分之一音），而且不會被限制在 0..127。' }],
    returns: { type: 'Number', en: 'Hz, equal temperament with A4 = 69 = 440 Hz.', zh: '赫茲，十二平均律，A4 = 69 = 440 Hz。' },
    description: [
      { en: 'For a sketch that makes its own sound (p5.sound, Web Audio): `osc.freq(noteFreq(note))`. If you just want the sound, [`startSound()`](#startSound) plays every key for you.', zh: '給自己發聲的草圖用（p5.sound、Web Audio）：`osc.freq(noteFreq(note))`。如果只是想要有聲音，[`startSound()`](#startSound) 會幫你把每個鍵都彈出來。' },
    ],
    examples: [
      {
        code: `function setup() {
  createCanvas(400, 300);
  textAlign(CENTER, CENTER);
  textSize(36);
}

function draw() {
  background(20);
  fill(255);
  text('A4 = ' + noteFreq('A4') + ' Hz\\nC4 = ' + noteFreq('C4').toFixed(2) + ' Hz', width / 2, height / 2);
}`,
        caption: { en: 'Prints 440 Hz and 261.63 Hz.', zh: '印出 440 Hz 和 261.63 Hz。' },
      },
    ],
    claims: [{ expr: "noteFreq('A4')", equals: 440 }, { expr: 'noteFreq(69)', equals: 440 }, { expr: 'noteFreq(81)', equals: 880 }],
    related: ['noteNumber', 'noteName', 'startSound'],
    keywords: { en: ['frequency', 'hz', 'pitch', 'tuning', 'A440', 'oscillator'], zh: ['頻率', '赫茲', '音高', '調音', '振盪器'] },
  },

  'OAVp5.play': {
    group: 'midi',
    summary: { en: 'Plays a key as if a controller did: `midi.play(60, 0.8)` presses middle C, `midi.play(60, 0)` lets it go.', zh: '像控制器那樣彈一個鍵：`midi.play(60, 0.8)` 按下中央 C，`midi.play(60, 0)` 放開。' },
    params: [
      { name: 'note', type: 'Number | String', en: 'The key: a MIDI number or a name (`\'C#4\'`).', zh: '哪個鍵：MIDI 號碼或音名（`\'C#4\'`）。' },
      { name: 'velocity', type: 'Number', optional: true, default: '1', en: 'How hard, 0..1; 0 releases the key. Leave it out for full force.', zh: '多用力，0..1。0 表示放開。不給就是最大力道。' },
    ],
    description: [
      {
        en: 'It sends the same MIDI bytes a keyboard would, with `midi.last.source` set to `\'screen\'`, so everything reacts: [`notePressed()`](#notePressed), [`noteIsDown()`](#noteIsDown), [`note`](#note), the sound if [`startSound()`](#startSound) is on. `midi` and `OAVp5` are the same object, so `OAVp5.play` and `midi.play` are one function.',
        zh: '它送出的 MIDI 位元組跟鍵盤送出的一樣，`midi.last.source` 會是 `\'screen\'`，所以所有東西都會有反應：[`notePressed()`](#notePressed)、[`noteIsDown()`](#noteIsDown)、[`note`](#note)，還有開著 [`startSound()`](#startSound) 時的聲音。`midi` 和 `OAVp5` 是同一個物件，所以 `OAVp5.play` 和 `midi.play` 是同一個函式。',
      },
    ],
    notes: [{ en: 'The key stays down until you play it again with velocity 0.', zh: '鍵會一直按著，直到你再用力道 0 彈一次。' }],
    examples: [
      {
        code: `function setup() {
  createCanvas(400, 300);
  textAlign(CENTER, CENTER);
  textSize(32);
}

function mousePressed() { midi.play('C4', 0.8); }
function mouseReleased() { midi.play('C4', 0); }

function draw() {
  background(noteIsDown('C4') ? 90 : 20);
  fill(255);
  text('hold the mouse: C4 is ' + (noteIsDown('C4') ? 'down' : 'up'), width / 2, height / 2);
}`,
        caption: { en: 'The mouse plays middle C: the sketch hears it the same as a key.', zh: '用滑鼠彈中央 C：草圖聽到的跟按鍵一模一樣。' },
      },
    ],
    claims: [{ before: "midi.play('C4', 0.8)", expr: "noteIsDown(60)", equals: true }],
    related: ['noteIsDown', 'notePressed', 'noteNumber', 'OAVp5.input'],
    keywords: { en: ['play', 'send note', 'trigger', 'simulate', 'virtual key'], zh: ['彈', '送出音符', '觸發', '模擬', '虛擬琴鍵'] },
  },
};
