// oav-p5 reference: the raw MIDI events. You define the function, oav-p5 calls it.
// Read by tools/build-reference.mjs (see AGENTS.md, "Documenting a public name"). Sketch examples leave out the loader line.
//
// These sit one level below notePressed() and knobMoved(): the message as it came in, with its channel, whether or not the
// controller is one OAV knows. No MIDI hardware is needed to try them: the 🎹 button opens an on-screen controller, a phone can be
// the controller, and OAVp5.input([…]) sends the bytes by hand. All of them reach these functions the same way.

const PLAY = {
  en: 'Plug in a controller, or press 🎹 (bottom right) and use the on-screen one.',
  zh: '接上控制器，或按右下角的 🎹 用螢幕上的控制器。',
};

// The order inside one message, said once.
const ORDER = {
  en: 'For one incoming message the order is: `midiMessage()`, then the specific one (`noteOn()`, `controlChange()`, `pitchBend()`), then the friendly one (`padPressed()`, `knobMoved()`, `notePressed()` and their partners).',
  zh: '同一則訊息進來時，呼叫的順序是：先 `midiMessage()`，再來是對應的那一個（`noteOn()`、`controlChange()`、`pitchBend()`），最後才是比較親切的那一個（`padPressed()`、`knobMoved()`、`notePressed()` 和它們的另一半）。',
};

// What "defining it" does and does not do, said once.
const NEEDS = {
  en: 'Defining the function is enough. oav-p5 asks the browser for Web MIDI when it loads (the default, [`?oav_hardware=auto`](#option-hardware)), and a sketch that defines it also gets a card if Web MIDI is missing or blocked. Keys from 🎹, a phone, [`OAVp5.input()`](#OAVp5.input) and other programs reach it too. `OAVp5.on(\'NAME\', fn)` does the same without defining a global function, and returns a function that stops it.',
  zh: '只要定義這個函式就夠了。oav-p5 在載入的時候就會向瀏覽器要 Web MIDI（預設，[`?oav_hardware=auto`](#option-hardware)），而草圖有定義這個函式的話，Web MIDI 不存在或被擋下時還會多跳出一張卡片。🎹、手機、[`OAVp5.input()`](#OAVp5.input) 和其他程式送來的訊息也都會呼叫它。`OAVp5.on(\'NAME\', fn)` 是不必定義全域函式的同樣功能，它會回傳一個停止監聽的函式。',
};
const needsFor = (name) => ({ en: NEEDS.en.replace('NAME', name), zh: NEEDS.zh.replace('NAME', name) });

const ERROR_NOTE = {
  en: 'An error inside it does not stop the music: the next message is still handled, and the message shows in the console and on a card beside the 🎹, with the file and line.',
  zh: '裡面出錯不會讓音樂停掉：下一則訊息還是照樣處理，錯誤訊息會出現在 console，也會在 🎹 旁邊的卡片上顯示檔案與行號。',
};

export default {
  noteOn: {
    group: 'midi',
    summary: {
      en: 'You define this function; oav-p5 calls it for every MIDI note-on, with the key, how hard and the channel.',
      zh: '你來定義這個函式。每收到一個 MIDI 的 note-on，oav-p5 就呼叫它，帶著是哪個鍵、多用力、哪個通道。',
    },
    params: [
      { name: 'note', type: 'Number', en: 'The MIDI number of the key, 0 to 127 (60 is middle C). [`noteName(note)`](#noteName) turns it into a name.', zh: '這個鍵的 MIDI 號碼，0 到 127（60 是中央 C）。[`noteName(note)`](#noteName) 可以把它轉成音名。' },
      { name: 'velocity', type: 'Number', en: 'How hard, above 0 and up to 1 (MIDI\'s 1 to 127 divided by 127).', zh: '多用力，大於 0、最大 1（MIDI 的 1 到 127 除以 127）。' },
      { name: 'channel', type: 'Number', en: 'The MIDI channel, 1 to 16. Pads on the MiniLab 3 and the LPD8 send on channel 10.', zh: 'MIDI 通道，1 到 16。MiniLab 3 和 LPD8 的打擊墊都是從通道 10 送出。' },
    ],
    description: [
      {
        en: "Declare it the way you declare `keyPressed()`:\n\n```js\nfunction noteOn(note, velocity, channel) {\n  // a key or pad went down\n}\n```\n\nIt is called once per note-on message, as it came in. It is the level below [`notePressed()`](#notePressed): the same moment, but with the channel, and for pads too, even when the sketch defines [`padPressed()`](#padPressed). A note-on with velocity 0, which some keyboards send instead of a note-off, is not a note-on here: it calls [`noteOff()`](#noteOff).",
        zh: '用宣告 `keyPressed()` 的方式宣告它：\n\n```js\nfunction noteOn(note, velocity, channel) {\n  // 有一個鍵或打擊墊按下去了\n}\n```\n\n每則 note-on 訊息進來就呼叫一次，照它進來的樣子。它比 [`notePressed()`](#notePressed) 低一層：同一個時刻，但多了通道，而且打擊墊也會呼叫，就算草圖有定義 [`padPressed()`](#padPressed) 也一樣。力道是 0 的 note-on（有些鍵盤用它來代替 note-off）在這裡不算 note-on，會去呼叫 [`noteOff()`](#noteOff)。',
      },
      { en: ORDER.en, zh: ORDER.zh },
    ],
    needs: needsFor('noteOn'),
    notes: [{ en: ERROR_NOTE.en, zh: ERROR_NOTE.zh }],
    examples: [
      {
        code: `let shown = 'play a key';

function setup() {
  createCanvas(400, 300);
  textAlign(CENTER, CENTER);
  textSize(24);
}

function noteOn(note, velocity, channel) {
  shown = noteName(note) + '  velocity ' + nf(velocity, 1, 2) + '  channel ' + channel;
}

function draw() {
  background(20);
  fill(255);
  text(shown, width / 2, height / 2);
}`,
        caption: { en: 'Shows the key you played, how hard and on which channel. ' + PLAY.en, zh: '顯示你彈的那個鍵、多用力、哪個通道。' + PLAY.zh },
      },
      {
        code: `let hits = [];

function setup() {
  createCanvas(400, 300);
  noStroke();
}

function noteOn(note, velocity, channel) {
  hits.push({ note, velocity, pad: channel === 10, born: millis() });   // channel 10: the pads
}

function draw() {
  background(20);
  hits = hits.filter((h) => millis() - h.born < 1500);
  for (const h of hits) {
    const fade = 1 - (millis() - h.born) / 1500;
    const x = map(h.note, 24, 96, 20, width - 20);
    fill(h.pad ? color(255, 90, 31, fade * 255) : color(120, 190, 255, fade * 255));
    if (h.pad) square(x - 25, 125, 50 + h.velocity * 40);
    else circle(x, 150, 20 + h.velocity * 80);
  }
}`,
        caption: { en: 'Keys leave blue circles and pads leave orange squares, placed by pitch, bigger for harder hits, fading after a moment. ' + PLAY.en, zh: '鍵留下藍色圓，打擊墊留下橘色方塊，依音高排開，打得越用力越大，過一下就淡掉。' + PLAY.zh },
      },
    ],
    claims: [{ before: "window.noteOn = (n, v, c) => { window.__noteOn = [n, Math.round(v * 127), c]; }; midi.input([0x93, 60, 100], 'screen')", expr: 'JSON.stringify(window.__noteOn)', equals: '[60,100,4]' }],
    related: ['noteOff', 'notePressed', 'padPressed', 'midiMessage', 'OAVp5.on', 'OAVp5.input'],
    keywords: {
      en: ['note on', 'midi note', 'key down', 'key pressed', 'raw midi', 'midi channel', 'callback', 'event', 'velocity'],
      zh: ['音符開始', '琴鍵按下', '原始 midi', 'midi 通道', '事件', '回呼', '力道'],
    },
  },

  noteOff: {
    group: 'midi',
    summary: {
      en: 'You define this function; oav-p5 calls it for every MIDI note-off, with the key and the channel.',
      zh: '你來定義這個函式。每收到一個 MIDI 的 note-off，oav-p5 就呼叫它，帶著是哪個鍵、哪個通道。',
    },
    params: [
      { name: 'note', type: 'Number', en: 'The MIDI number of the key that came up, 0 to 127.', zh: '放開的那個鍵的 MIDI 號碼，0 到 127。' },
      { name: 'channel', type: 'Number', en: 'The MIDI channel, 1 to 16.', zh: 'MIDI 通道，1 到 16。' },
    ],
    description: [
      {
        en: "The partner of [`noteOn()`](#noteOn):\n\n```js\nfunction noteOff(note, channel) {\n  // a key or pad came up\n}\n```\n\nIt is called for a note-off message and also for a note-on with velocity 0, which many keyboards send instead. There is no velocity: oav-p5 does not pass the release velocity.",
        zh: '[`noteOn()`](#noteOn) 的另一半：\n\n```js\nfunction noteOff(note, channel) {\n  // 有一個鍵或打擊墊放開了\n}\n```\n\nnote-off 訊息會呼叫它，力道是 0 的 note-on 也會（很多鍵盤用那個來代替 note-off）。沒有力道這個參數：oav-p5 不傳放開時的力道。',
      },
      { en: ORDER.en, zh: ORDER.zh },
    ],
    needs: needsFor('noteOff'),
    notes: [{ en: ERROR_NOTE.en, zh: ERROR_NOTE.zh }],
    examples: [
      {
        code: `const down = {};
let held = 'play a key and let it go';

function setup() {
  createCanvas(400, 300);
  textAlign(CENTER, CENTER);
  textSize(24);
}

function noteOn(note) { down[note] = millis(); }

function noteOff(note) {
  if (down[note] !== undefined) {
    held = noteName(note) + ' was held ' + round(millis() - down[note]) + ' ms';
    delete down[note];
  }
}

function draw() {
  background(20);
  fill(255);
  text(held, width / 2, height / 2);
}`,
        caption: { en: 'Pairs each noteOn() with its noteOff() and says how long the key was held. ' + PLAY.en, zh: '把每個 noteOn() 和它的 noteOff() 配成一對，說出這個鍵按了多久。' + PLAY.zh },
      },
    ],
    claims: [{ before: "window.noteOff = (n, c) => { window.__noteOff = [n, c]; }; midi.input([0x84, 60, 0], 'screen')", expr: 'JSON.stringify(window.__noteOff)', equals: '[60,5]' }],
    related: ['noteOn', 'noteReleased', 'padReleased', 'midiMessage', 'OAVp5.on'],
    keywords: {
      en: ['note off', 'key up', 'key released', 'release', 'raw midi', 'midi channel', 'callback', 'event'],
      zh: ['音符結束', '放開', '琴鍵放開', '原始 midi', 'midi 通道', '事件', '回呼'],
    },
  },

  controlChange: {
    group: 'midi',
    summary: {
      en: 'You define this function; oav-p5 calls it for every MIDI control change (a knob, a fader, the mod wheel, the sustain pedal), whether or not the controller is known.',
      zh: '你來定義這個函式。每收到一個 MIDI 控制變化（旋鈕、推桿、調變輪、延音踏板），oav-p5 就呼叫它，不管控制器認不認得。',
    },
    params: [
      { name: 'cc', type: 'Number', en: 'The controller number, 0 to 127 (1 is the mod wheel, 64 the sustain pedal, 74 the first knob on a MiniLab 3).', zh: '控制器號碼，0 到 127（1 是調變輪，64 是延音踏板，MiniLab 3 的第一顆旋鈕是 74）。' },
      { name: 'value', type: 'Number', en: 'Where the control is now, 0 to 1 (MIDI\'s 0 to 127 divided by 127).', zh: '這個控制現在的位置，0 到 1（MIDI 的 0 到 127 除以 127）。' },
      { name: 'channel', type: 'Number', en: 'The MIDI channel, 1 to 16.', zh: 'MIDI 通道，1 到 16。' },
    ],
    description: [
      {
        en: "Declare it the way you declare `keyPressed()`:\n\n```js\nfunction controlChange(cc, value, channel) {\n  // a control moved\n}\n```\n\nIt hears every control, including the ones that are not a knob or a fader, such as the mod wheel and the pedals, which [`knobMoved()`](#knobMoved) never reports. The latest value of every controller number is also in [`OAVp5.cc`](#OAVp5.cc), so a sketch that only wants to look can read `OAVp5.cc[1]` in `draw()`.",
        zh: '用宣告 `keyPressed()` 的方式宣告它：\n\n```js\nfunction controlChange(cc, value, channel) {\n  // 有一個控制動了\n}\n```\n\n每個控制它都聽得到，包括不是旋鈕也不是推桿的那些，像調變輪和踏板，[`knobMoved()`](#knobMoved) 永遠不會回報它們。每個控制器號碼的最新值也放在 [`OAVp5.cc`](#OAVp5.cc)，所以只想看一眼的草圖可以在 `draw()` 裡讀 `OAVp5.cc[1]`。',
      },
      { en: ORDER.en, zh: ORDER.zh },
    ],
    needs: needsFor('controlChange'),
    notes: [{ en: ERROR_NOTE.en, zh: ERROR_NOTE.zh }],
    examples: [
      {
        code: `let shown = 'move a knob, the mod wheel or a pedal';

function setup() {
  createCanvas(400, 300);
  textAlign(CENTER, CENTER);
  textSize(24);
}

function controlChange(cc, value, channel) {
  shown = 'CC ' + cc + ' = ' + nf(value, 1, 2) + '  (channel ' + channel + ')';
}

function draw() {
  background(20);
  fill(255);
  text(shown, width / 2, height / 2);
}`,
        caption: { en: 'Shows the controller number, its value and the channel of whatever you moved last. ' + PLAY.en, zh: '顯示你最後動的那個控制的號碼、值和通道。' + PLAY.zh },
      },
      {
        code: `let sustain = false;

function setup() {
  createCanvas(400, 300);
}

function controlChange(cc, value) {
  if (cc === 64) sustain = value >= 0.5;   // the sustain pedal: 64 and up counts as down
}

function mousePressed() {
  OAVp5.input([0xB0, 64, 127]);   // no pedal? press the mouse
}

function mouseReleased() {
  OAVp5.input([0xB0, 64, 0]);
}

function draw() {
  background(sustain ? 90 : 20);
}`,
        caption: { en: 'The background lights up while the sustain pedal is down. No pedal? Hold the mouse button: it sends the same message.', zh: '延音踏板踩著的時候背景變亮。沒有踏板的話，按住滑鼠：它送出同樣的訊息。' },
      },
    ],
    claims: [{ before: "window.controlChange = (cc, v, c) => { window.__cc = [cc, Math.round(v * 127), c]; }; midi.input([0xB2, 74, 127], 'screen')", expr: 'JSON.stringify(window.__cc)', equals: '[74,127,3]' }],
    related: ['knobMoved', 'faderMoved', 'OAVp5.cc', 'midiMessage', 'OAVp5.on', 'OAVp5.input'],
    keywords: {
      en: ['control change', 'cc', 'controller', 'mod wheel', 'sustain pedal', 'raw midi', 'knob', 'callback', 'event'],
      zh: ['控制變化', 'cc', '控制器', '調變輪', '延音踏板', '原始 midi', '旋鈕', '事件', '回呼'],
    },
  },

  pitchBend: {
    group: 'midi',
    summary: {
      en: 'You define this function; oav-p5 calls it whenever the pitch wheel moves, with its position from −1 to 1.',
      zh: '你來定義這個函式。音高輪一動，oav-p5 就呼叫它，帶著它的位置，從 −1 到 1。',
    },
    params: [
      { name: 'value', type: 'Number', en: 'The wheel\'s position: −1 all the way down, 0 in the middle, 1 all the way up.', zh: '輪子的位置：−1 是推到底往下，0 是中間，1 是推到底往上。' },
      { name: 'channel', type: 'Number', en: 'The MIDI channel, 1 to 16.', zh: 'MIDI 通道，1 到 16。' },
    ],
    description: [
      {
        en: "Declare it the way you declare `keyPressed()`:\n\n```js\nfunction pitchBend(value, channel) {\n  // the wheel moved\n}\n```\n\nA pitch wheel usually springs back to the middle when you let go, so you will hear a stream of values ending at 0. MIDI sends the position as 14 bits (0 to 16383, with 8192 in the middle). oav-p5 hands it to you as −1 to 1. The latest position is also in [`OAVp5.bend`](#OAVp5.bend).",
        zh: '用宣告 `keyPressed()` 的方式宣告它：\n\n```js\nfunction pitchBend(value, channel) {\n  // 輪子動了\n}\n```\n\n音高輪放開之後通常會自己彈回中間，所以你會收到一串值，最後停在 0。MIDI 用 14 位元送出位置（0 到 16383，中間是 8192），oav-p5 轉成 −1 到 1 給你。最新的位置也放在 [`OAVp5.bend`](#OAVp5.bend)。',
      },
      { en: ORDER.en, zh: ORDER.zh },
    ],
    needs: needsFor('pitchBend'),
    notes: [
      { en: 'Pitch bend is not mapped to anything else: there is no `bend` variable, only this function and `OAVp5.bend`.', zh: '音高輪沒有對應到別的東西：沒有叫 `bend` 的變數，只有這個函式和 `OAVp5.bend`。' },
      { en: ERROR_NOTE.en, zh: ERROR_NOTE.zh },
    ],
    examples: [
      {
        code: `let bend = 0;

function setup() {
  createCanvas(400, 300);
}

function pitchBend(value) {
  bend = value;
}

function draw() {
  background(20);
  circle(width / 2 + bend * 150, height / 2, 50);   // wheel up: right, wheel down: left
}`,
        caption: { en: 'The circle slides left and right with the pitch wheel and returns to the middle when it springs back. ' + PLAY.en, zh: '圓隨音高輪往左右滑，輪子彈回中間時它也回到中間。' + PLAY.zh },
      },
      {
        code: `let bend = 0;

function setup() {
  createCanvas(400, 300);
}

function pitchBend(value) { bend = value; }

function mouseDragged() {
  OAVp5.input([0xE0, 0, constrain(round(mouseX / width * 127), 0, 127)]);   // no wheel? drag the mouse
}

function draw() {
  background(20);
  const x = spring(width / 2 + bend * 150, 120, 8);   // a spring smooths the steps
  circle(x, height / 2, 50);
}`,
        caption: { en: 'The same wheel through spring(). No wheel? Drag the mouse across the canvas: it sends the same message.', zh: '同一個輪子，再用 spring() 處理。沒有輪子的話，在畫布上拖動滑鼠：它送出同樣的訊息。' },
      },
    ],
    claims: [{ before: "window.pitchBend = (v, c) => { window.__bend = [v, c]; }; midi.input([0xE1, 127, 127], 'screen')", expr: 'JSON.stringify(window.__bend)', equals: '[1,2]' }],
    related: ['OAVp5.bend', 'controlChange', 'midiMessage', 'OAVp5.on', 'OAVp5.input'],
    keywords: {
      en: ['pitch bend', 'pitch wheel', 'bender', 'wheel', 'raw midi', 'callback', 'event'],
      zh: ['音高輪', '彎音', '滑音輪', '輪子', '原始 midi', '事件', '回呼'],
    },
  },

  midiMessage: {
    group: 'midi',
    summary: {
      en: 'You define this function; oav-p5 calls it for every MIDI message it receives, with the raw bytes and where they came from.',
      zh: '你來定義這個函式。每收到一則 MIDI 訊息，oav-p5 就呼叫它，帶著原始的位元組和它從哪裡來。',
    },
    params: [
      { name: 'bytes', type: 'Array<Number>', en: "The message as three numbers `[status, data1, data2]`. The status byte holds the kind in its top half and the channel in its bottom half (`0x90` is a note-on on channel 1, `0x93` on channel 4). The data bytes are 0 to 127, and a byte the message does not have is 0.", zh: '這則訊息，三個數字 `[status, data1, data2]`。status 位元組的上半是種類，下半是通道（`0x90` 是通道 1 的 note-on，`0x93` 是通道 4 的）。資料位元組是 0 到 127，訊息沒有的那個位元組是 0。' },
      { name: 'source', type: 'String', en: "Where it came from: `'hardware'` (a real controller), `'screen'` (the 🎹), `'phone'`, `'virtual-out'` (a program playing into OAV Virtual MIDI), `'link'` (another page in the same room), or whatever label you gave [`OAVp5.input()`](#OAVp5.input).", zh: "它從哪裡來：`'hardware'`（真的控制器）、`'screen'`（🎹）、`'phone'`、`'virtual-out'`（某個程式送進 OAV Virtual MIDI）、`'link'`（同一個房間的另一頁），或你在 [`OAVp5.input()`](#OAVp5.input) 給的標籤。" },
    ],
    description: [
      {
        en: "Declare it the way you declare `keyPressed()`:\n\n```js\nfunction midiMessage(bytes, source) {\n  // anything that came in\n}\n```\n\nIt is the widest net: it is called first for every note, control change and pitch bend, and it is the only function that hears the messages oav-p5 has no friendlier name for, such as channel pressure (`0xD0`), polyphonic aftertouch (`0xA0`) and program change (`0xC0`). The `OAVp5.last` object keeps the latest note, control change or pitch bend, but not those.",
        zh: '用宣告 `keyPressed()` 的方式宣告它：\n\n```js\nfunction midiMessage(bytes, source) {\n  // 任何進來的訊息\n}\n```\n\n它是網子最大的一個：每個音符、控制變化、音高輪訊息都會先呼叫它，而且 oav-p5 沒有比較親切的名字可以叫的訊息，只有它聽得到，像是通道壓力（`0xD0`）、各鍵觸後（`0xA0`）、音色切換（`0xC0`）。`OAVp5.last` 只留最新的音符、控制變化或音高輪，不留這些。',
      },
      {
        en: 'It does not hear system messages: the MIDI clock, start, stop and song position go to [`OAVp5.clock`](#OAVp5.clock), and system-exclusive messages are dropped. A note-on with velocity 0 arrives here as it was sent (a note-on with 0), while [`noteOff()`](#noteOff) is the one that treats it as a release.',
        zh: '系統訊息它聽不到：MIDI 時鐘、start、stop、song position 都交給 [`OAVp5.clock`](#OAVp5.clock)，系統專用（sysex）訊息直接丟掉。力道是 0 的 note-on 在這裡照送出的樣子到達（note-on，力道 0），把它當成放開的是 [`noteOff()`](#noteOff)。',
      },
      { en: ORDER.en, zh: ORDER.zh },
    ],
    needs: needsFor('midiMessage'),
    notes: [{ en: ERROR_NOTE.en, zh: ERROR_NOTE.zh }],
    examples: [
      {
        code: `let shown = 'play something';

function setup() {
  createCanvas(400, 300);
  textAlign(CENTER, CENTER);
  textSize(20);
}

function midiMessage(bytes, source) {
  shown = bytes.map((b) => '0x' + b.toString(16).toUpperCase()).join(' ') + '  from ' + source;
}

function draw() {
  background(20);
  fill(255);
  text(shown, width / 2, height / 2);
}`,
        caption: { en: 'Prints the raw bytes of the last message and where it came from. ' + PLAY.en, zh: '印出最後一則訊息的原始位元組，和它從哪裡來。' + PLAY.zh },
      },
      {
        code: `let pressure = 0;

function setup() {
  createCanvas(400, 300);
}

function midiMessage(bytes) {
  if ((bytes[0] & 0xF0) === 0xD0) pressure = bytes[1] / 127;   // channel pressure (aftertouch)
}

function mouseMoved() {
  OAVp5.input([0xD0, constrain(round(mouseX / width * 127), 0, 127)], 'mouse');   // no aftertouch? move the mouse
}

function draw() {
  background(20);
  circle(width / 2, height / 2, 40 + pressure * 260);
}`,
        caption: { en: 'The circle follows aftertouch, which no friendlier function reports. No keyboard with aftertouch? Move the mouse across the canvas: it sends the same message.', zh: '圓跟著觸後（aftertouch）走，這個沒有比較親切的函式會回報。沒有支援觸後的鍵盤的話，在畫布上移動滑鼠：它送出同樣的訊息。' },
      },
    ],
    claims: [{ before: "window.midiMessage = (b, s) => { window.__mm = [b, s]; }; midi.input([0xD0, 100], 'screen')", expr: 'JSON.stringify(window.__mm)', equals: '[[208,100,0],"screen"]' }],
    related: ['noteOn', 'controlChange', 'pitchBend', 'OAVp5.last', 'OAVp5.on', 'OAVp5.input'],
    keywords: {
      en: ['midi message', 'raw midi', 'bytes', 'status byte', 'aftertouch', 'program change', 'any message', 'callback', 'event'],
      zh: ['midi 訊息', '原始 midi', '位元組', '觸後', '音色切換', '任何訊息', '事件', '回呼'],
    },
  },
};
