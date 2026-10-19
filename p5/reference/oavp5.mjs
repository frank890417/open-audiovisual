// oav-p5 reference: the OAVp5 object (also `midi` and `oavMidi`): MIDI state and helpers, the panel, the check-up, the clock, the link,
// and the microphone's raw numbers. Read by tools/build-reference.mjs (see AGENTS.md, "Documenting a public name"). Sketch examples
// leave out the loader line.
//
// Where each member is filed (so a reader finds it where they would look):
//   group 'midi'   what a controller says: note, cc, bend, held, last, on, isDown, input, hardware, devices, connectHardware,
//                  panel, phone, wiring
//   group 'mic'    OAVp5.mic and everything under it
//   group 'chop'   OAVp5.chop (in chop.mjs)
//   group 'oavp5'  the object itself, version, hints, check, clock, link
//
// No MIDI hardware is needed to try any of this: the 🎹 button opens an on-screen controller, a phone can be the controller,
// and OAVp5.input([…]) sends the bytes by hand.

const PLAY = {
  en: 'Plug in a controller, or press 🎹 (bottom right) and use the on-screen one.',
  zh: '接上控制器，或按右下角的 🎹 用螢幕上的控制器。',
};

// The names the object goes by, said once.
const SAME = {
  en: '`midi` and `oavMidi` are the same object under other names.',
  zh: '`midi` 和 `oavMidi` 是同一個物件的其他名字。',
};

// The fake external clock the clock examples send to themselves: a start, then ticks every 20 ms (24 a beat = 125 BPM).
const FAKE_CLOCK = `  OAVp5.input([0xFA]);                          // MIDI start
  setInterval(() => OAVp5.input([0xF8]), 20);   // clock ticks: 24 a beat, here 50 a second (125 BPM)`;

export default {
  // ───────────────────────────────────────────────────────────────────────── the object
  OAVp5: {
    group: 'oavp5',
    aliases: ['midi', 'oavMidi'],
    summary: {
      en: 'The object oav-p5 hangs everything on: MIDI state, the panel, the microphone, the clock, the check-up. `midi` and `oavMidi` are the same object.',
      zh: 'oav-p5 把所有東西掛在上面的那個物件：MIDI 狀態、面板、麥克風、時鐘、體檢。`midi` 和 `oavMidi` 是同一個物件。',
    },
    description: [
      {
        en: "It is there as soon as oav-p5 has loaded, in setup() and draw() alike. The plain names of the p5 style (`knob1`, `note`, `micLevel`) are the easy way in. `OAVp5` is the way in when you want more: the raw MIDI state ([`OAVp5.note`](#OAVp5.note), [`OAVp5.cc`](#OAVp5.cc), [`OAVp5.bend`](#OAVp5.bend), [`OAVp5.held`](#OAVp5.held), [`OAVp5.last`](#OAVp5.last)), subscriptions ([`OAVp5.on()`](#OAVp5.on)), a way to send bytes ([`OAVp5.input()`](#OAVp5.input)), the microphone's numbers ([`OAVp5.mic`](#OAVp5.mic)), the external clock ([`OAVp5.clock`](#OAVp5.clock)), the link ([`OAVp5.link`](#OAVp5.link)), the values over time ([`OAVp5.chop`](#OAVp5.chop)) and the check-up ([`OAVp5.check()`](#OAVp5.check)).",
        zh: '只要 oav-p5 載入了，它就在那裡，setup() 和 draw() 裡都一樣。p5 風格的簡單名稱（`knob1`、`note`、`micLevel`）是輕鬆的入口。想要更多的時候就用 `OAVp5`：原始的 MIDI 狀態（[`OAVp5.note`](#OAVp5.note)、[`OAVp5.cc`](#OAVp5.cc)、[`OAVp5.bend`](#OAVp5.bend)、[`OAVp5.held`](#OAVp5.held)、[`OAVp5.last`](#OAVp5.last)）、訂閱（[`OAVp5.on()`](#OAVp5.on)）、自己送位元組進去的方法（[`OAVp5.input()`](#OAVp5.input)）、麥克風的數字（[`OAVp5.mic`](#OAVp5.mic)）、外部時鐘（[`OAVp5.clock`](#OAVp5.clock)）、連結（[`OAVp5.link`](#OAVp5.link)）、數值隨時間變化（[`OAVp5.chop`](#OAVp5.chop)），還有體檢（[`OAVp5.check()`](#OAVp5.check)）。',
      },
      {
        en: "Three names, one object. `OAVp5` is always there. `oavMidi` is always there too. `midi` is there unless the page already had a `midi` of its own, in which case it is left alone and the console says to read `OAVp5` instead. `OAVp5.options` holds the loading options as oav-p5 read them: `OAVp5.options.mic`, and so on for each of the loading options (for example [`mic`](#option-mic)).",
        zh: '三個名字，同一個物件。`OAVp5` 一定在，`oavMidi` 也一定在。`midi` 則是頁面本來沒有自己的 `midi` 時才有，如果頁面已經有了，就不去動它，console 會說要改讀 `OAVp5`。`OAVp5.options` 放的是 oav-p5 讀到的載入選項：`OAVp5.options.mic`，其他每個載入選項（例如 [`mic`](#option-mic)）也一樣。',
      },
    ],
    needs: {
      en: 'Only the loader line. If it has not loaded, `OAVp5` is not defined, and a sketch that reads it stops with "OAVp5 is not defined".',
      zh: '只需要載入那一行。如果它沒載入，`OAVp5` 就沒有定義，讀它的草圖會停在「OAVp5 is not defined」。',
    },
    notes: [{ en: SAME.en, zh: SAME.zh }],
    examples: [
      {
        code: `function setup() {
  createCanvas(400, 300);
}

function draw() {
  background(20);
  fill(255);
  text('same object: ' + (OAVp5 === midi && OAVp5 === oavMidi), 20, 30);
  text('version: ' + OAVp5.version, 20, 60);
  text('MIDI hardware: ' + OAVp5.hardware, 20, 90);
  text('microphone: ' + OAVp5.mic.state, 20, 120);   // reading the state does not start it
  text('external clock: ' + OAVp5.clock.info.state, 20, 150);
}`,
        caption: { en: 'A small status board: the three names are one object, then the version and the state of MIDI, the microphone and the clock.', zh: '一塊小小的狀態板：三個名字是同一個物件，然後是版本，以及 MIDI、麥克風和時鐘的狀態。' },
      },
    ],
    claims: [{ expr: 'OAVp5 === midi && OAVp5 === oavMidi', equals: true }],
    related: ['OAVp5.version', 'OAVp5.on', 'OAVp5.input', 'OAVp5.check', 'OAVp5.mic', 'OAVp5.clock', 'OAVp5.chop'],
    keywords: { en: ['OAVp5', 'midi object', 'oavMidi', 'namespace', 'advanced', 'state', 'api object'], zh: ['OAVp5', 'midi 物件', 'oavMidi', '命名空間', '進階', '狀態', 'api 物件'] },
  },

  'OAVp5.version': {
    group: 'oavp5',
    summary: {
      en: 'The version of oav-p5 that loaded, as text such as `\'0.8.0\'`.',
      zh: '載入的 oav-p5 的版本，是像 `\'0.8.0\'` 這樣的文字。',
    },
    value: {
      type: 'String',
      en: 'Set when oav-p5 loads and never changes.',
      zh: 'oav-p5 載入時設定，之後不會變。',
    },
    description: [
      {
        en: 'Useful in a bug report or to check which build a page got: `openaudiovisual.com/p5/oav-p5.js` is always the latest, while a jsDelivr address with a tag is frozen. The same number is on the first line of the 🩺 check-up.',
        zh: '回報問題或確認頁面拿到哪個版本時有用：`openaudiovisual.com/p5/oav-p5.js` 永遠是最新版，帶版本標籤的 jsDelivr 網址則是固定的。同一個數字也在 🩺 體檢的第一行。',
      },
    ],
    notes: [
      { en: 'If the file loads twice (the loader line and the OpenProcessing library list), the first one wins and the second does nothing.', zh: '如果這個檔案載入了兩次（載入那一行和 OpenProcessing 的函式庫清單各一次），先載入的那一個生效，第二個什麼都不做。' },
    ],
    examples: [
      {
        code: `function setup() {
  createCanvas(400, 300);
  textAlign(CENTER, CENTER);
  textSize(32);
}

function draw() {
  background(20);
  fill(255);
  text('oav-p5 ' + OAVp5.version, width / 2, height / 2);
}`,
        caption: { en: 'Shows the version of oav-p5 this page loaded.', zh: '顯示這個頁面載入的 oav-p5 版本。' },
      },
    ],
    claims: [{ expr: 'typeof OAVp5.version', equals: 'string' }],
    related: ['OAVp5', 'OAVp5.check'],
    keywords: { en: ['version', 'build', 'which version', 'release'], zh: ['版本', '版次', '哪個版本', '發行'] },
  },

  'OAVp5.hints': {
    group: 'oavp5',
    summary: {
      en: 'The list of cards oav-p5 has shown or would have shown so far (a blocked microphone, no Web MIDI, an error in your callback), each with what, why and what to press.',
      zh: 'oav-p5 到現在顯示過（或本來會顯示）的卡片清單（麥克風被擋、沒有 Web MIDI、你的回呼出錯），每張都寫著發生什麼、為什麼、要按什麼。',
    },
    value: {
      type: 'Array<Object>',
      en: 'Starts empty and only grows. Each item is `{ id, kind, what, why, next }`: `id` names the situation (`\'micDenied\'`, `\'chopOut:lag\'`), `kind` is `\'error\'`, `\'warn\'` or `\'info\'`, and `what`, `why`, `next` are the three lines of the card in the browser\'s language.',
      zh: '一開始是空的，只會變長。每一項是 `{ id, kind, what, why, next }`：`id` 是這個狀況的名字（`\'micDenied\'`、`\'chopOut:lag\'`），`kind` 是 `\'error\'`、`\'warn\'` 或 `\'info\'`，`what`、`why`、`next` 是卡片上的三行字，用瀏覽器的語言寫。',
    },
    description: [
      {
        en: "Each situation is said once per page. The list holds them all, including the ones the page did not show because [`hints=off`](#option-hints) is set, so it is the place to look when a sketch does something odd and nothing is on screen: `console.log(OAVp5.hints)`.",
        zh: "每種狀況在一個頁面只說一次。這個清單把它們全都記著，包括因為設了 [`hints=off`](#option-hints) 而沒有顯示在頁面上的，所以草圖行為怪怪的、螢幕上又什麼都沒有的時候，就看這裡：`console.log(OAVp5.hints)`。",
      },
    ],
    notes: [
      { en: 'A card that went away because the situation ended (the microphone came on) stays in the list.', zh: '因為狀況結束（麥克風開起來了）而收掉的卡片，還是會留在清單裡。' },
    ],
    examples: [
      {
        code: `function setup() {
  createCanvas(400, 300);
  lag(1);   // an unnamed lag() outside draw(): oav-p5 has something to say
}

function draw() {
  background(20);
  fill(255);
  text(OAVp5.hints.length + ' card(s) so far', 20, 30);
  text(OAVp5.hints.map((h) => h.kind + ': ' + h.what).join('\\n'), 20, 60);
}`,
        caption: { en: 'Lists what oav-p5 has said so far: here, that lag() was called outside draw(). The same sentence is in the console.', zh: '列出 oav-p5 到現在說過的話：這裡是 lag() 在 draw() 外面被呼叫。同樣的句子也在 console 裡。' },
      },
    ],
    claims: [{ before: 'lag(1)', expr: "OAVp5.hints.map((h) => h.id).join()", equals: 'chopOut:lag' }],
    related: ['option:hints', 'OAVp5.check', 'option:debug'],
    keywords: { en: ['hints', 'cards', 'messages', 'warnings', 'what went wrong', 'errors list'], zh: ['提示', '卡片', '訊息', '警告', '哪裡出錯', '錯誤清單'] },
  },

  'OAVp5.check': {
    group: 'oavp5',
    summary: {
      en: 'Runs the 🩺 check-up: the version, page, browser, microphone, MIDI, sound, drums, recording, wiring and hints, as a card to screenshot and as an object.',
      zh: '執行 🩺 體檢：版本、頁面、瀏覽器、麥克風、MIDI、聲音、鼓機、錄影、接線和提示，做成一張可以截圖的卡片，也回傳成物件。',
    },
    params: [
      { name: 'opts', type: 'Object', optional: true, en: "`{ show: false }` skips the card on the page and only returns the report (the text still goes to the console). Left out, the card is shown.", zh: '`{ show: false }` 不顯示頁面上的卡片，只回傳報告（文字還是會印到 console）。不寫的話就顯示卡片。' },
    ],
    returns: { type: 'Object', en: "The report: `{ version, time, page, browser, microphone, midi, sound, drums, wiring, own, hints, external, recording, text }`. `text` is the whole card as plain lines, the other fields are the same facts as data (`microphone.state`, `midi.hardware`, `midi.devices` …).", zh: '報告：`{ version, time, page, browser, microphone, midi, sound, drums, wiring, own, hints, external, recording, text }`。`text` 是整張卡片的純文字，其他欄位是同樣的資訊做成的資料（`microphone.state`、`midi.hardware`、`midi.devices` …）。' },
    description: [
      {
        en: "The same thing the 🩺 button in the panel does. When something does not work for a student, `OAVp5.check()` in the console (or 🩺) gives a card that says what this browser did: whether the page is in an iframe, whether the microphone is on or blocked, whether Web MIDI exists and which devices it found, the last message, the sound and drum state, whether MP4 recording works, what the controller is wired to, which of the sketch's own names stepped in the way, and which cards have appeared. It has a copy button and a link to the site's full device check.",
        zh: '跟面板裡的 🩺 按鈕做的事一樣。學生那邊有東西不能用的時候，在 console 打 `OAVp5.check()`（或按 🩺）就會得到一張卡片，說這個瀏覽器做了什麼：頁面是不是在 iframe 裡、麥克風開著還是被擋、有沒有 Web MIDI、找到哪些設備、最後一則訊息、聲音和鼓機的狀態、能不能錄 MP4、控制器接到哪些變數、草圖自己的哪些名稱擋住了路，還有出現過哪些卡片。卡片上有複製按鈕，也有連到網站完整裝置檢查的連結。',
      },
    ],
    notes: [
      { en: 'It is a snapshot taken when you call it, not a live view. Calling it again replaces the card.', zh: '它是呼叫那一刻的快照，不是即時的畫面。再呼叫一次會取代那張卡片。' },
    ],
    examples: [
      {
        code: `let report;

function setup() {
  createCanvas(400, 300);
  report = OAVp5.check({ show: false });   // the report, without the card on the page
}

function draw() {
  background(20);
  fill(255);
  textSize(10);
  text(report.text, 10, 10, width - 20, height - 20);
}`,
        caption: { en: 'Prints the check-up text on the canvas: version, browser, microphone, MIDI and the rest, one line each.', zh: '把體檢的文字印在畫布上：版本、瀏覽器、麥克風、MIDI 等等，一項一行。' },
      },
      {
        code: `function setup() {
  createCanvas(400, 300);
}

function mousePressed() {
  OAVp5.check();   // the card appears over the page
}

function draw() {
  background(20);
  fill(255);
  text('click the canvas for the check-up card', 20, 30);
}`,
        caption: { en: 'Click the canvas: the check-up card opens over the page, with a copy button, ready to screenshot.', zh: '點一下畫布：體檢卡片會蓋在頁面上，附有複製按鈕，可以直接截圖。' },
      },
    ],
    claims: [{ expr: "typeof OAVp5.check({ show: false }).text", equals: 'string' }],
    related: ['OAVp5.hints', 'OAVp5.version', 'option:debug', 'OAVp5.mic.state', 'OAVp5.hardware'],
    keywords: { en: ['check', 'check-up', 'diagnose', 'troubleshoot', 'report', 'screenshot', 'why does it not work'], zh: ['體檢', '檢查', '診斷', '疑難排解', '報告', '截圖', '為什麼不能用'] },
  },

  'OAVp5.clock': {
    group: 'oavp5',
    summary: {
      en: 'What oav-p5 hears of an external MIDI clock: its state, tempo and where it is in the bar. Nothing until another program or device starts sending one.',
      zh: 'oav-p5 聽到的外部 MIDI 時鐘：它的狀態、速度、現在在小節的哪裡。在別的程式或設備開始送時鐘之前什麼都沒有。',
    },
    description: [
      {
        en: "Some programs keep the time and everyone else follows: Strudel (`midicmd(\"clock*96, <start stop>/8\")`), a DAW over a virtual cable, a drum machine on a MIDI cable. They send 24 clock messages per beat, plus start, continue, stop and song position. oav-p5 counts them: [`OAVp5.clock.info`](#OAVp5.clock.info) says whether a clock is running, [`OAVp5.clock.bpm`](#OAVp5.clock.bpm) its tempo and [`OAVp5.clock.phase`](#OAVp5.clock.phase) how far through the bar and the beat it is now.",
        zh: '有些程式負責打拍子，其他人跟著走：Strudel（`midicmd("clock*96, <start stop>/8")`）、透過虛擬線連過來的 DAW、用 MIDI 線接的鼓機。它們每拍送 24 個時鐘訊息，加上 start、continue、stop 和 song position。oav-p5 把它們數起來：[`OAVp5.clock.info`](#OAVp5.clock.info) 說有沒有時鐘在跑，[`OAVp5.clock.bpm`](#OAVp5.clock.bpm) 是它的速度，[`OAVp5.clock.phase`](#OAVp5.clock.phase) 是現在走到小節和拍子的哪裡。',
      },
      {
        en: "When a clock is moving, [`drumPhase`](#drumPhase), [`beatPhase`](#beatPhase), [`drumBar`](#drumBar), [`drumStep`](#drumStep) and [`drumBpm`](#drumBpm) read it, and a drum machine that is up follows it. [`?oav_clock=off`](#option-clock) turns all of that off. Clock messages are not delivered to [`midiMessage()`](#midiMessage): they belong to the clock.",
        zh: '時鐘在動的時候，[`drumPhase`](#drumPhase)、[`beatPhase`](#beatPhase)、[`drumBar`](#drumBar)、[`drumStep`](#drumStep)、[`drumBpm`](#drumBpm) 讀的就是它，已經在跑的鼓機也會跟著它。[`?oav_clock=off`](#option-clock) 會把這些全部關掉。時鐘訊息不會交給 [`midiMessage()`](#midiMessage)：它們屬於時鐘。',
      },
    ],
    notes: [
      { en: 'The first clock message loads the counting code (@openav/midi\'s `MidiClock`) from next to oav-p5.js, which takes a few frames. Until then the members read `none`, `null` and `null`.', zh: '第一個時鐘訊息會從 oav-p5.js 旁邊載入負責計算的程式（@openav/midi 的 `MidiClock`），要幾個畫面。在那之前，這些成員讀到的是 `none`、`null`、`null`。' },
      { en: 'This is advanced: most sketches only read `drumPhase` and let it follow a clock.', zh: '這是進階用法：大多數草圖只讀 `drumPhase`，讓它自己去跟著時鐘。' },
    ],
    examples: [
      {
        code: `function setup() {
  createCanvas(400, 300);
${FAKE_CLOCK}
}

function draw() {
  background(20);
  fill(255);
  text('clock: ' + OAVp5.clock.info.state, 20, 30);
  text('tempo: ' + (OAVp5.clock.bpm ? nf(OAVp5.clock.bpm, 1, 1) : '-') + ' BPM', 20, 60);
  const p = OAVp5.clock.phase;
  if (p) circle(40 + p.beat * (width - 80), 150, 30);   // sweeps across once a beat
}`,
        caption: { en: 'The sketch sends itself a made-up MIDI clock at about 125 BPM. A circle sweeps across once per beat, and the state and tempo are printed.', zh: '草圖自己送出一個假的 MIDI 時鐘，大約 125 BPM。一個圓每拍從左掃到右一次，狀態和速度也印出來。' },
      },
    ],
    claims: [{ expr: 'OAVp5.clock.info.state', equals: 'none' }],
    related: ['OAVp5.clock.info', 'OAVp5.clock.bpm', 'OAVp5.clock.phase', 'option:clock', 'drumPhase', 'beatPhase'],
    keywords: { en: ['clock', 'midi clock', 'external clock', 'sync', 'tempo', 'follow', 'DAW', 'Strudel'], zh: ['時鐘', 'midi 時鐘', '外部時鐘', '同步', '速度', '跟隨', 'DAW', 'Strudel'] },
  },

  'OAVp5.clock.info': {
    group: 'oavp5',
    summary: {
      en: 'A snapshot of the external clock: `state` (`none`, `running`, `stopped` or `lost`), `bpm`, whether the drums follow it, where it came from, and counts.',
      zh: '外部時鐘的快照：`state`（`none`、`running`、`stopped` 或 `lost`）、`bpm`、鼓機有沒有跟著它、它從哪裡來，還有各種計數。',
    },
    value: {
      type: 'Object',
      en: "A new object each time you read it: `{ state, bpm, running, following, source, implicit, clocks, dupes, starts, stops, continues }`. Before any clock message it is `{ state: 'none', bpm: null, running: false, following: false, source: null, clocks: 0 }`.",
      zh: "每次讀都是一個新的物件：`{ state, bpm, running, following, source, implicit, clocks, dupes, starts, stops, continues }`。在任何時鐘訊息之前是 `{ state: 'none', bpm: null, running: false, following: false, source: null, clocks: 0 }`。",
    },
    description: [
      {
        en: "`state` is `'none'` until a clock message has come, `'running'` while the clock is going, `'stopped'` after a MIDI stop (the position holds and clocks may still arrive), and `'lost'` when no clock message has arrived for 0.6 seconds. `bpm` is the tempo fitted over the last 24 ticks, rounded to two decimals, or `null` before two ticks. `running` is true while the transport runs, which a stream of clocks with no start message counts as too (`implicit` is true then).",
        zh: "`state` 在收到任何時鐘訊息之前是 `'none'`，時鐘在走的時候是 `'running'`，MIDI stop 之後是 `'stopped'`（位置停住，時鐘訊息可能還在來），超過 0.6 秒沒收到時鐘訊息就是 `'lost'`。`bpm` 是用最近 24 個 tick 擬合出來的速度，四捨五入到小數兩位，兩個 tick 之前是 `null`。`running` 在播放中是 true，只有時鐘、沒有 start 訊息的串流也算（那時 `implicit` 是 true）。",
      },
      {
        en: "`following` is true when the drums read this clock: it is running, has a tempo and `clock=off` is not set. `source` says where the messages came from: `'hardware'`, `'screen'`, `'phone'`, `'virtual-out'` (a program playing into OAV Virtual MIDI) or `'link'`. `clocks`, `dupes`, `starts`, `stops` and `continues` count what arrived; a start sent three times with one timestamp counts once and adds to `dupes`.",
        zh: "`following` 在鼓機讀這個時鐘的時候是 true：它在跑、有速度、而且沒有設 `clock=off`。`source` 說訊息從哪裡來：`'hardware'`、`'screen'`、`'phone'`、`'virtual-out'`（某個程式送進 OAV Virtual MIDI）或 `'link'`。`clocks`、`dupes`、`starts`、`stops`、`continues` 數的是收到了什麼：用同一個時間戳送三次的 start 只算一次，其餘加進 `dupes`。",
      },
    ],
    examples: [
      {
        code: `function setup() {
  createCanvas(400, 300);
${FAKE_CLOCK}
}

function draw() {
  background(20);
  fill(255);
  const i = OAVp5.clock.info;
  text('state: ' + i.state + (i.running ? ' (running)' : ''), 20, 30);
  text('bpm: ' + i.bpm + ',  following: ' + i.following, 20, 60);
  text('source: ' + i.source + ',  clocks heard: ' + i.clocks, 20, 90);
}`,
        caption: { en: 'Prints the clock\'s snapshot while the sketch sends itself a made-up clock: the state goes from "none" to "running" within a moment.', zh: '草圖自己送一個假的時鐘，同時印出時鐘的快照：狀態很快就從 "none" 變成 "running"。' },
      },
    ],
    claims: [{ expr: 'OAVp5.clock.info.following', equals: false }],
    related: ['OAVp5.clock', 'OAVp5.clock.bpm', 'OAVp5.clock.phase', 'option:clock'],
    keywords: { en: ['clock info', 'clock state', 'is the clock running', 'external tempo', 'midi clock status'], zh: ['時鐘資訊', '時鐘狀態', '時鐘有沒有在跑', '外部速度', 'midi 時鐘狀態'] },
  },

  'OAVp5.clock.bpm': {
    group: 'oavp5',
    summary: {
      en: 'The tempo of the external MIDI clock in beats a minute, or `null` while there is none.',
      zh: '外部 MIDI 時鐘的速度，單位是每分鐘幾拍，沒有的時候是 `null`。',
    },
    value: {
      type: 'Number | null',
      en: 'Fitted over the last 24 clock ticks, so it settles within a moment and does not jump with one late tick. `null` before two ticks have arrived or when `clock=off`.',
      zh: '用最近 24 個時鐘 tick 擬合出來的，所以一下子就會穩定，不會因為一個晚到的 tick 就跳動。兩個 tick 到齊之前，或設了 `clock=off`，都是 `null`。',
    },
    description: [
      {
        en: "The raw number, not rounded. Use it for anything that should run at the clock's tempo: `OAVp5.clock.bpm / 60` is beats a second. If the drum machine follows the clock, [`drumBpm`](#drumBpm) shows it rounded to a tenth.",
        zh: '原始的數字，沒有四捨五入。任何要跟著時鐘速度走的東西都可以用它：`OAVp5.clock.bpm / 60` 就是每秒幾拍。鼓機如果跟著時鐘，[`drumBpm`](#drumBpm) 會顯示四捨五入到小數一位的值。',
      },
    ],
    examples: [
      {
        code: `function setup() {
  createCanvas(400, 300);
${FAKE_CLOCK}
}

function draw() {
  background(20);
  fill(255);
  textSize(48);
  textAlign(CENTER, CENTER);
  const bpm = OAVp5.clock.bpm;
  text(bpm ? nf(bpm, 1, 1) + ' BPM' : 'no clock', width / 2, height / 2);
}`,
        caption: { en: 'Prints the tempo of the made-up clock the sketch sends itself: about 125 BPM once a few ticks have arrived.', zh: '印出草圖自己送的假時鐘的速度：幾個 tick 到齊之後大約是 125 BPM。' },
      },
    ],
    claims: [{ expr: 'OAVp5.clock.bpm === null', equals: true }],
    related: ['OAVp5.clock', 'OAVp5.clock.info', 'OAVp5.clock.phase', 'drumBpm'],
    keywords: { en: ['bpm', 'tempo', 'beats per minute', 'external tempo', 'midi clock bpm'], zh: ['bpm', '速度', '每分鐘幾拍', '外部速度', 'midi 時鐘速度'] },
  },

  'OAVp5.clock.phase': {
    group: 'oavp5',
    summary: {
      en: 'Where the external clock is right now: `{ pos, bar, beat, bpm, running }`, or `null` while there is no tempo.',
      zh: '外部時鐘現在走到哪裡：`{ pos, bar, beat, bpm, running }`，沒有速度的時候是 `null`。',
    },
    value: {
      type: 'Object | null',
      en: "A new object each time you read it: `pos` is the number of bars since the start (0 is the downbeat of bar 1), `bar` and `beat` are 0..1 through the current bar and beat, `bpm` the tempo and `running` whether the transport is moving. `null` until a tempo is known.",
      zh: '每次讀都是一個新的物件：`pos` 是從 start 起算經過幾個小節（0 是第 1 小節的第一拍），`bar` 和 `beat` 是目前小節和拍子走了 0 到 1 的多少，`bpm` 是速度，`running` 是播放有沒有在動。知道速度之前是 `null`。',
    },
    description: [
      {
        en: "A bar is four beats. `bar` and `beat` count up from 0 and fall back to 0 at the next downbeat, the same way [`drumPhase`](#drumPhase) and [`beatPhase`](#beatPhase) do. After a stop the position holds. A clock with no start message gets its downbeat from the first tick after a silence of half a second, so a phase is there anyway.",
        zh: '一個小節是四拍。`bar` 和 `beat` 從 0 往上數，到下一個第一拍就回到 0，跟 [`drumPhase`](#drumPhase)、[`beatPhase`](#beatPhase) 一樣。stop 之後位置會停住。沒有 start 訊息的時鐘，以沉默半秒之後的第一個 tick 當第一拍，所以還是有相位可以用。',
      },
    ],
    examples: [
      {
        code: `function setup() {
  createCanvas(400, 300);
${FAKE_CLOCK}
}

function draw() {
  background(20);
  const p = OAVp5.clock.phase;
  if (!p) return;
  noStroke();
  fill(255, 211, 107);
  circle(40 + p.bar * (width - 80), 100, 30);   // once a bar (four beats)
  fill(120, 190, 255);
  circle(40 + p.beat * (width - 80), 200, 30);  // once a beat
}`,
        caption: { en: 'Two circles sweep from left to right on the made-up clock: the blue one once per beat, the yellow one once per bar of four beats.', zh: '兩個圓依著假的時鐘從左掃到右：藍色的每拍一次，黃色的每小節（四拍）一次。' },
      },
    ],
    claims: [{ expr: 'OAVp5.clock.phase === null', equals: true }],
    related: ['OAVp5.clock', 'OAVp5.clock.info', 'drumPhase', 'beatPhase'],
    keywords: { en: ['phase', 'position in the bar', 'beat phase', 'bar phase', 'downbeat', 'sync to clock'], zh: ['相位', '小節位置', '拍子相位', '第一拍', '同步時鐘'] },
  },

  'OAVp5.link': {
    group: 'oavp5',
    summary: {
      en: 'What the link to other oav-p5 pages in the same room is doing: only `OAVp5.link.info`, and `null` unless a room is set.',
      zh: '和同一個房間裡其他 oav-p5 頁面之間的連結現在的情形：只有 `OAVp5.link.info`，沒有設房間的時候是 `null`。',
    },
    description: [
      {
        en: "A link joins oav-p5 pages that share a room: what one page's programs play into OAV Virtual MIDI (notes, controllers and the clock) is heard by every other page in the room, at the moment it sounds there. You switch it on with [`?oav_link=my-room`](#option-link), and [`OAVp5.link.info`](#OAVp5.link.info) is where you look at how it is going. There is nothing else to call: the link is made and closed by the option.",
        zh: '連結把共用同一個房間的 oav-p5 頁面連在一起：一個頁面的程式送進 OAV Virtual MIDI 的東西（音符、控制器和時鐘），房間裡其他每個頁面都會在它在那邊響起的那一刻聽到。用 [`?oav_link=my-room`](#option-link) 打開它，[`OAVp5.link.info`](#OAVp5.link.info) 是看它進行得如何的地方。沒有別的東西要呼叫：連結的建立和結束都由那個選項決定。',
      },
    ],
    notes: [
      { en: 'This is advanced. It needs a network connection to the relay ([`relay`](#option-relay)).', zh: '這是進階用法。它需要連得上中繼（[`relay`](#option-relay)）。' },
    ],
    examples: [
      {
        code: `function setup() {
  createCanvas(400, 300);
}

function draw() {
  background(20);
  fill(255);
  text(OAVp5.link.info ? 'linked' : 'not linked: add link: \\'my-room\\' to the options', 20, 30);
}`,
        caption: { en: 'Says whether this page is linked. Without a `link` room it is not, and the sketch says so.', zh: '說這個頁面有沒有連結。沒有 `link` 房間的話就沒有，草圖會這麼說。' },
      },
    ],
    claims: [{ expr: 'OAVp5.link.info === null', equals: true }],
    related: ['OAVp5.link.info', 'option:link', 'option:linkdelay', 'option:relay'],
    keywords: { en: ['link', 'room', 'linked pages', 'share midi between pages', 'relay'], zh: ['連結', '房間', '連在一起的頁面', '頁面之間分享 midi', '中繼'] },
  },

  'OAVp5.link.info': {
    group: 'oavp5',
    summary: {
      en: 'The state of the link: its room, `state` (`connecting`, `open`, `closed`), how many other pages are there, and the trip time. `null` when no room is set.',
      zh: '連結的狀態：它的房間、`state`（`connecting`、`open`、`closed`）、有幾個其他頁面在、還有來回的時間。沒有設房間時是 `null`。',
    },
    value: {
      type: 'Object | null',
      en: "`null` without a `link` room. With one: `{ room, state, peers, rtt, trip, late, sent, received, … }`. `state` is `'connecting'`, `'open'` or `'closed'` (the relay is gone and it retries). `peers` is how many other pages were heard in the last 6 seconds. `rtt` is the shortest round trip to the relay in the last 30 seconds and `trip` the one-way trip estimated from it, both in milliseconds. `late` counts notes that arrived after the moment they should have sounded and were played at once. `sent` and `received` count messages. The object also has `diff`, `lead`, `msgs`, `dupes` and `id`, which explain the clock alignment (packages/relay/link.js).",
      zh: "沒有 `link` 房間的時候是 `null`。有的話是 `{ room, state, peers, rtt, trip, late, sent, received, … }`。`state` 是 `'connecting'`、`'open'` 或 `'closed'`（中繼不見了，正在重試）。`peers` 是最近 6 秒內聽到幾個其他頁面。`rtt` 是最近 30 秒到中繼最短的一趟來回，`trip` 是由它估出來的單程時間，單位都是毫秒。`late` 數的是比該響的時間晚到、被立刻播出的音符。`sent` 和 `received` 數訊息。物件裡還有 `diff`、`lead`、`msgs`、`dupes` 和 `id`，它們說明時鐘怎麼對齊（packages/relay/link.js）。",
    },
    description: [
      {
        en: "Read it in `draw()` for a status line, or look at the 🔗 on the 🎹, which turns green when another page is there, yellow while connecting or alone, and red when the relay is gone. The 🩺 check-up prints the same facts. A new object is made on every read.",
        zh: '在 `draw()` 裡讀它來做狀態列，或是看 🎹 上的 🔗：另一個頁面在的時候是綠色，連線中或只有自己是黃色，中繼不見是紅色。🩺 體檢也印出同樣的資訊。每次讀都會產生一個新的物件。',
      },
    ],
    tbd: [
      { en: 'The values between two real pages were not observed here: the headless check cannot reach a relay. The fields and their meanings are from the code (packages/relay/link.js) and the project\'s README.', zh: '兩個真的頁面之間的數值沒有親眼看過：無頭瀏覽器的檢查連不到中繼。欄位和它們的意思出自程式碼（packages/relay/link.js）和專案的 README。' },
    ],
    examples: [
      {
        code: `window.OAV_P5 = { link: 'my-room' };

function setup() {
  createCanvas(400, 300);
}

function draw() {
  background(20);
  fill(255);
  const i = OAVp5.link.info;
  text('room: ' + i.room + ',  state: ' + i.state, 20, 30);
  text('other pages: ' + i.peers + ',  one-way trip: ' + (i.trip == null ? '-' : i.trip + ' ms'), 20, 60);
}`,
        caption: { en: 'Open the same address in two tabs: both say "open" and one other page, and show the trip time.', zh: '在兩個分頁打開同一個網址：兩邊都顯示 "open" 和一個其他頁面，並顯示來回的時間。' },
        run: 'static',
        why: 'It connects to the network relay, which the headless check does not do.',
      },
      {
        code: `function setup() {
  createCanvas(400, 300);
}

function draw() {
  background(20);
  fill(255);
  text('link.info: ' + JSON.stringify(OAVp5.link.info), 20, 30);   // null: no room
}`,
        caption: { en: 'Without a `link` room it prints null.', zh: '沒有 `link` 房間的話，印出 null。' },
      },
    ],
    claims: [{ expr: 'OAVp5.link.info === null', equals: true }],
    related: ['OAVp5.link', 'option:link', 'option:linkdelay', 'option:relay'],
    keywords: { en: ['link info', 'link status', 'room', 'peers', 'latency', 'trip time'], zh: ['連結資訊', '連結狀態', '房間', '其他頁面', '延遲', '來回時間'] },
  },

  // ───────────────────────────────────────────────────────────────────────── MIDI state
  'OAVp5.note': {
    group: 'midi',
    summary: {
      en: 'An array of 128 numbers, one per MIDI key: how hard that key is held, 0 to 1, and 0 when it is up. `OAVp5.note[60]` is middle C.',
      zh: '128 個數字的陣列，每個 MIDI 鍵一個：那個鍵被按得多用力，0 到 1，放開就是 0。`OAVp5.note[60]` 是中央 C。',
    },
    value: {
      type: 'Array<Number>', range: '128 numbers, 0..1 each',
      en: 'The index is the MIDI note number, 0 to 127. A key that is down holds the velocity of its note-on divided by 127, a key that is up (or never pressed) holds 0. Changes when a message arrives, not once per frame.',
      zh: '索引是 MIDI 音符號碼，0 到 127。按著的鍵放的是它 note-on 的力道除以 127，放開（或從沒按過）的鍵是 0。訊息進來的時候才會變，不是每個畫面一次。',
    },
    description: [
      {
        en: "Read every key at once, in `draw()`: `OAVp5.note[60]` for one key, or a loop over a range to draw a piano roll. It is the array version of [`noteIsDown()`](#noteIsDown), with the velocity in it. It is not the variable [`note`](#note), which is just the number of the last key pressed. [`OAVp5.held`](#OAVp5.held) is the same information as a short list of the keys that are down.",
        zh: '在 `draw()` 裡一次讀每個鍵：`OAVp5.note[60]` 讀一個鍵，或用迴圈跑過一個範圍來畫鋼琴捲簾。它是 [`noteIsDown()`](#noteIsDown) 的陣列版，而且裡面有力道。它不是變數 [`note`](#note)，那個只是最後按下的鍵的號碼。[`OAVp5.held`](#OAVp5.held) 是同樣的資訊，做成只列出按著的鍵的短清單。',
      },
    ],
    notes: [
      { en: '`midi.note` is the same array. A note-on with velocity 0 sets the key to 0, like a note-off.', zh: '`midi.note` 是同一個陣列。力道是 0 的 note-on 會讓那個鍵變成 0，就像 note-off。' },
    ],
    examples: [
      {
        code: `function setup() {
  createCanvas(400, 300);
  noStroke();
}

function draw() {
  background(20);
  for (let n = 36; n < 96; n++) {   // five octaves, C2 to B6
    const v = OAVp5.note[n];
    fill(v > 0 ? color(255, 211, 107) : 60);
    rect(20 + (n - 36) * 6, height - 40 - v * 200, 5, 40 + v * 200);
  }
}`,
        caption: { en: 'A bar for each key: it rises while the key is down, higher for a harder press. ' + PLAY.en, zh: '每個鍵一根長條：按著的時候升起，按得越用力越高。' + PLAY.zh },
      },
      {
        code: `function setup() {
  createCanvas(400, 300);
}

function draw() {
  background(20);
  const v = lag(OAVp5.note[60], 0.05, 0.4);   // middle C, softened
  circle(width / 2, height / 2, 40 + v * 260);
}`,
        caption: { en: 'Middle C (60) swells the circle by how hard it is held, and the circle shrinks back slowly.', zh: '中央 C（60）按得多用力，圓就脹得多大，放開之後慢慢縮回去。' },
      },
    ],
    claims: [
      { before: "midi.input([0x90, 60, 127], 'screen')", expr: 'OAVp5.note[60]', equals: 1 },
      { before: "midi.input([0x80, 60, 0], 'screen')", expr: 'OAVp5.note[60]', equals: 0 },
    ],
    related: ['OAVp5.held', 'OAVp5.isDown', 'noteIsDown', 'note', 'velocity', 'OAVp5.cc'],
    keywords: { en: ['note array', 'all keys', 'key velocity', 'piano roll', 'held keys', 'midi.note'], zh: ['音符陣列', '所有琴鍵', '琴鍵力道', '鋼琴捲簾', '按著的鍵', 'midi.note'] },
  },

  'OAVp5.cc': {
    group: 'midi',
    summary: {
      en: 'An array of 128 numbers, one per MIDI controller number: where each control last was, 0 to 1. `OAVp5.cc[1]` is the mod wheel, `OAVp5.cc[64]` the sustain pedal.',
      zh: '128 個數字的陣列，每個 MIDI 控制器號碼一個：每個控制最後停在哪裡，0 到 1。`OAVp5.cc[1]` 是調變輪，`OAVp5.cc[64]` 是延音踏板。',
    },
    value: {
      type: 'Array<Number>', range: '128 numbers, 0..1 each',
      en: 'The index is the controller (CC) number, 0 to 127; the value is the last one received divided by 127. Changes when a message arrives. 0 before a control has moved, which is not the same as "at 0".',
      zh: '索引是控制器（CC）號碼，0 到 127，值是最後收到的那個除以 127。訊息進來的時候才會變。控制還沒動過之前是 0，這跟「剛好在 0」不是同一件事。',
    },
    description: [
      {
        en: "The array version of [`controlChange()`](#controlChange): read any controller in `draw()` without defining a function. It holds every CC, including the ones that are not a knob or a fader, such as the mod wheel (1), the volume (7) and the sustain pedal (64, which counts as down at 0.5 and above). The MIDI channel is ignored: the latest value of that controller number wins, whichever channel it came on.",
        zh: '[`controlChange()`](#controlChange) 的陣列版：不用定義函式，在 `draw()` 裡讀任何控制器。每個 CC 它都記著，包括不是旋鈕也不是推桿的那些，像調變輪（1）、音量（7）和延音踏板（64，0.5 以上算踩下去）。MIDI 通道被忽略：那個控制器號碼的最新值勝出，不管它是從哪個通道來的。',
      },
    ],
    notes: [
      { en: '`midi.cc` is the same array. The friendly names `knob1` and `fader1` are looked up through the controller\'s profile and read the same data.', zh: '`midi.cc` 是同一個陣列。比較親切的 `knob1` 和 `fader1` 是透過控制器的設定檔對應過去的，讀的是同樣的資料。' },
    ],
    examples: [
      {
        code: `function setup() {
  createCanvas(400, 300);
}

function mouseDragged() {
  OAVp5.input([0xB0, 1, constrain(round(mouseX / width * 127), 0, 127)]);   // no wheel? drag the mouse
}

function draw() {
  background(OAVp5.cc[64] >= 0.5 ? 90 : 20);   // sustain pedal down: lighter
  circle(width / 2, height / 2, 40 + OAVp5.cc[1] * 300);   // mod wheel: size
}`,
        caption: { en: 'The mod wheel (CC 1) sets the size of the circle and the sustain pedal (CC 64) lightens the background. No controller? Drag the mouse across the canvas: it sends CC 1.', zh: '調變輪（CC 1）決定圓的大小，延音踏板（CC 64）讓背景變亮。沒有控制器的話，在畫布上拖動滑鼠：它會送出 CC 1。' },
      },
    ],
    claims: [{ before: "midi.input([0xB0, 1, 127], 'screen')", expr: 'OAVp5.cc[1]', equals: 1 }],
    related: ['controlChange', 'knob1', 'fader1', 'OAVp5.note', 'OAVp5.bend'],
    keywords: { en: ['cc array', 'control change values', 'mod wheel', 'sustain pedal', 'controller number', 'midi.cc'], zh: ['cc 陣列', '控制變化的值', '調變輪', '延音踏板', '控制器號碼', 'midi.cc'] },
  },

  'OAVp5.bend': {
    group: 'midi',
    summary: {
      en: 'Where the pitch wheel is, from −1 (all the way down) through 0 (middle) to 1 (all the way up).',
      zh: '音高輪現在的位置，從 −1（推到底往下）、經過 0（中間）到 1（推到底往上）。',
    },
    value: {
      type: 'Number', range: '-1..1',
      en: 'Changes when the wheel moves. 0 before it has moved, and again when a spring-loaded wheel returns to the middle.',
      zh: '輪子動的時候才會變。還沒動過之前是 0，有彈簧的輪子彈回中間時也是 0。',
    },
    description: [
      {
        en: "Read it in `draw()` like a knob that goes both ways: `x = width / 2 + OAVp5.bend * 150`. MIDI sends the position as 14 bits (0 to 16383, with 8192 in the middle). oav-p5 maps the two halves to −1..0 and 0..1, so full travel reaches exactly −1 and 1. To be told on every movement, define [`pitchBend()`](#pitchBend).",
        zh: '像一顆可以往兩邊轉的旋鈕那樣在 `draw()` 裡讀：`x = width / 2 + OAVp5.bend * 150`。MIDI 用 14 位元送出位置（0 到 16383，中間是 8192）。oav-p5 把兩半分別對應成 −1 到 0 和 0 到 1，所以推到底剛好是 −1 和 1。想每次移動都被通知，就定義 [`pitchBend()`](#pitchBend)。',
      },
    ],
    notes: [
      { en: '`midi.bend` is the same number. There is no plain `bend` variable.', zh: '`midi.bend` 是同一個數字。沒有叫 `bend` 的變數。' },
    ],
    examples: [
      {
        code: `function setup() {
  createCanvas(400, 300);
}

function mouseDragged() {
  OAVp5.input([0xE0, 0, constrain(round(mouseX / width * 127), 0, 127)]);   // no wheel? drag the mouse
}

function draw() {
  background(20);
  circle(width / 2 + OAVp5.bend * 150, height / 2, 50);   // wheel up: right, wheel down: left
  text('bend ' + nf(OAVp5.bend, 1, 2), 20, 30);
}`,
        caption: { en: 'The circle follows the pitch wheel. No wheel? Drag the mouse across the canvas: it sends the same message.', zh: '圓跟著音高輪走。沒有輪子的話，在畫布上拖動滑鼠：它送出同樣的訊息。' },
      },
    ],
    claims: [
      { before: "midi.input([0xE0, 127, 127], 'screen')", expr: 'OAVp5.bend', equals: 1 },
      { before: "midi.input([0xE0, 0, 0], 'screen')", expr: 'OAVp5.bend', equals: -1 },
    ],
    related: ['pitchBend', 'OAVp5.cc', 'OAVp5.note'],
    keywords: { en: ['pitch bend value', 'pitch wheel', 'bend', 'wheel position', 'midi.bend'], zh: ['音高輪', '彎音', '輪子位置', 'midi.bend'] },
  },

  'OAVp5.held': {
    group: 'midi',
    summary: {
      en: 'A list of the MIDI numbers of the keys that are down right now, lowest first.',
      zh: '現在按著的鍵的 MIDI 號碼清單，由低到高。',
    },
    value: {
      type: 'Array<Number>',
      en: 'Empty when nothing is held. A key is added when its note-on arrives and removed at its note-off, and the list is kept sorted from low to high.',
      zh: '沒有按著任何鍵的時候是空的。note-on 進來時加入，note-off 時移除，清單一直照由低到高排好。',
    },
    description: [
      {
        en: "The short version of [`OAVp5.note`](#OAVp5.note): only the keys that are down, so `OAVp5.held.length` is how many, `OAVp5.held[0]` is the lowest and `OAVp5.held.map((n) => noteName(n))` spells the chord. [`noteIsPressed`](#noteIsPressed) is `OAVp5.held.length > 0`.",
        zh: '[`OAVp5.note`](#OAVp5.note) 的精簡版：只列按著的鍵，所以 `OAVp5.held.length` 是幾個鍵，`OAVp5.held[0]` 是最低的那個，`OAVp5.held.map((n) => noteName(n))` 把和弦寫出來。[`noteIsPressed`](#noteIsPressed) 就是 `OAVp5.held.length > 0`。',
      },
    ],
    notes: [
      { en: '`midi.held` is the same array. Read it, do not change it. It is the same array object every time, so copy it (`[...OAVp5.held]`) if you want to keep a moment of it.', zh: '`midi.held` 是同一個陣列。只讀，不要改它。它每次都是同一個陣列物件，想把某一刻存下來的話要複製一份（`[...OAVp5.held]`）。' },
    ],
    examples: [
      {
        code: `function setup() {
  createCanvas(400, 300);
  textAlign(CENTER, CENTER);
  textSize(40);
}

function mousePressed() { OAVp5.play(60 + floor(random(12)), 0.8); }   // no keys? click

function draw() {
  background(20);
  fill(255);
  text(OAVp5.held.map((n) => noteName(n)).join('  ') || 'play a chord', width / 2, height / 2);
}`,
        caption: { en: 'Spells the keys held down, lowest first. Click the canvas to hold one more key. ' + PLAY.en, zh: '把按著的鍵由低到高寫出來。點一下畫布就多按著一個鍵。' + PLAY.zh },
      },
    ],
    claims: [{ before: "midi.input([0x90, 64, 100], 'screen'); midi.input([0x90, 60, 100], 'screen')", expr: 'JSON.stringify(OAVp5.held)', equals: '[60,64]' }],
    related: ['OAVp5.note', 'noteIsPressed', 'noteIsDown', 'noteName'],
    keywords: { en: ['held keys', 'chord', 'pressed keys', 'keys down', 'midi.held'], zh: ['按著的鍵', '和弦', '按下的鍵', '琴鍵', 'midi.held'] },
  },

  'OAVp5.last': {
    group: 'midi',
    summary: {
      en: 'The latest note, control change or pitch bend that arrived: its type, number, value, channel, where it came from and which control it is. `null` before any.',
      zh: '最近收到的音符、控制變化或音高輪訊息：它的種類、號碼、值、通道、來自哪裡、是哪個控制。在任何訊息之前是 `null`。',
    },
    value: {
      type: 'Object | null',
      en: "`{ type, note | cc, value, channel, source, control }`. `type` is `'noteOn'`, `'noteOff'`, `'controlChange'` or `'pitchBend'` (a note-on with velocity 0 is a `'noteOff'`). `note` is there for notes, `cc` for control changes. `value` is the velocity 0..1 (0 for a note-off), the control's position 0..1, or the wheel −1..1. `channel` is 1 to 16. `source` is `'hardware'`, `'screen'`, `'phone'`, `'virtual-out'`, `'link'` or the label you gave [`OAVp5.input()`](#OAVp5.input). `control` is `'knob1'`, `'fader2'`, `'pad3'` … when the controller's profile knows it, otherwise `null`.",
      zh: "`{ type, note | cc, value, channel, source, control }`。`type` 是 `'noteOn'`、`'noteOff'`、`'controlChange'` 或 `'pitchBend'`（力道 0 的 note-on 算 `'noteOff'`）。音符有 `note`，控制變化有 `cc`。`value` 是力道 0 到 1（note-off 是 0）、控制的位置 0 到 1，或輪子的 −1 到 1。`channel` 是 1 到 16。`source` 是 `'hardware'`、`'screen'`、`'phone'`、`'virtual-out'`、`'link'`，或你在 [`OAVp5.input()`](#OAVp5.input) 給的標籤。`control` 在控制器的設定檔認得它的時候是 `'knob1'`、`'fader2'`、`'pad3'` …，否則是 `null`。",
    },
    description: [
      {
        en: "A single object that is replaced on every message, so read it, do not keep it. It is how a sketch finds out where a message came from (`OAVp5.last.source`) or which knob moved (`OAVp5.last.control`), and what to read when the sketch has its own `note` or `velocity` that keeps the plain names: `OAVp5.last.note` and `OAVp5.last.value`.",
        zh: '它是每收到一則訊息就整個換掉的單一物件，所以只讀，不要留著。草圖用它知道訊息從哪裡來（`OAVp5.last.source`）或哪顆旋鈕動了（`OAVp5.last.control`），草圖自己有 `note` 或 `velocity` 而保留了一般名稱的時候，也是改讀它：`OAVp5.last.note` 和 `OAVp5.last.value`。',
      },
      {
        en: 'It keeps only notes, control changes and pitch bends. Aftertouch and program change reach [`midiMessage()`](#midiMessage) but are not stored here.',
        zh: '它只留音符、控制變化和音高輪。觸後和音色切換只會到 [`midiMessage()`](#midiMessage)，這裡不存。',
      },
    ],
    notes: [
      { en: '`midi.last` is the same object. Clock messages (tick, start, stop) are not here: see [`OAVp5.clock`](#OAVp5.clock).', zh: '`midi.last` 是同一個物件。時鐘訊息（tick、start、stop）不在這裡，請看 [`OAVp5.clock`](#OAVp5.clock)。' },
    ],
    examples: [
      {
        code: `function setup() {
  createCanvas(400, 300);
  textSize(16);
}

function mousePressed() { OAVp5.input([0x90, 60 + floor(random(12)), 100], 'mouse'); }   // no controller? click

function draw() {
  background(20);
  fill(255);
  text(OAVp5.last ? JSON.stringify(OAVp5.last, null, 1) : 'play something', 20, 30);
}`,
        caption: { en: 'Prints the last message as an object. Click the canvas to send one from the mouse, and watch `source`. ' + PLAY.en, zh: '把最後一則訊息印成物件。點一下畫布就從滑鼠送一則，並看 `source`。' + PLAY.zh },
      },
    ],
    claims: [
      { expr: 'OAVp5.last === null', equals: true },
      { before: "midi.input([0x93, 60, 127], 'test')", expr: 'JSON.stringify([OAVp5.last.type, OAVp5.last.note, OAVp5.last.value, OAVp5.last.channel, OAVp5.last.source])', equals: '["noteOn",60,1,4,"test"]' },
    ],
    related: ['midiMessage', 'noteOn', 'note', 'velocity', 'OAVp5.input'],
    keywords: { en: ['last message', 'latest midi', 'source', 'which knob', 'midi.last', 'channel'], zh: ['最後一則訊息', '最新的 midi', '來源', '哪顆旋鈕', 'midi.last', '通道'] },
  },

  'OAVp5.hardware': {
    group: 'midi',
    summary: {
      en: 'Where Web MIDI stands: `\'off\'`, `\'asking\'`, `\'connected\'`, `\'waiting\'`, `\'denied\'` or `\'unavailable\'`.',
      zh: 'Web MIDI 目前的情形：`\'off\'`、`\'asking\'`、`\'connected\'`、`\'waiting\'`、`\'denied\'` 或 `\'unavailable\'`。',
    },
    value: {
      type: 'String', range: "'off' | 'asking' | 'connected' | 'waiting' | 'denied' | 'unavailable'",
      en: 'Changes when the browser answers and whenever a MIDI device is plugged in or out.',
      zh: '瀏覽器回答的時候，以及每次有 MIDI 設備插上或拔掉的時候會變。',
    },
    description: [
      {
        en: "`'off'`: Web MIDI has not been asked for yet (see [`hardware`](#option-hardware)). `'asking'`: waiting for the browser's permission answer. `'connected'`: allowed, and at least one device is plugged in ([`OAVp5.devices`](#OAVp5.devices) lists them). `'waiting'`: allowed, but no device yet: plug one in and it becomes `'connected'` by itself. `'denied'`: the permission was refused. `'unavailable'`: the browser has no Web MIDI (Safari, iPad) or could not open it.",
        zh: "`'off'`：還沒有去要過 Web MIDI（見 [`hardware`](#option-hardware)）。`'asking'`：等瀏覽器的權限回答。`'connected'`：允許了，而且至少插著一台設備（[`OAVp5.devices`](#OAVp5.devices) 列出它們）。`'waiting'`：允許了，但還沒有設備：插上一台就會自己變成 `'connected'`。`'denied'`：權限被拒絕。`'unavailable'`：這個瀏覽器沒有 Web MIDI（Safari、iPad），或是打不開它。",
      },
      {
        en: 'It is only about real hardware. The on-screen controller and a phone work in every state.',
        zh: '它只管真的硬體。螢幕上的控制器和手機在每一種狀態下都能用。',
      },
    ],
    notes: [
      { en: 'In the 🩺 check-up, `waiting` is written as "no device found".', zh: '在 🩺 體檢裡，`waiting` 寫成「沒偵測到裝置」。' },
    ],
    examples: [
      {
        code: `function setup() {
  createCanvas(400, 300);
}

function draw() {
  background(OAVp5.hardware === 'connected' ? color(20, 60, 30) : 20);
  fill(255);
  text('Web MIDI: ' + OAVp5.hardware, 20, 30);
  text('devices: ' + (OAVp5.devices.join(', ') || 'none'), 20, 60);
}`,
        caption: { en: 'Shows the state of Web MIDI and the devices found. The background turns green once a controller is connected. Plug one in to see it change.', zh: '顯示 Web MIDI 的狀態和找到的設備。控制器一連上，背景就變綠。插一台上去看它改變。' },
      },
    ],
    claims: [{ expr: "['off', 'asking', 'connected', 'waiting', 'denied', 'unavailable'].includes(OAVp5.hardware)", equals: true }],
    related: ['OAVp5.devices', 'OAVp5.connectHardware', 'option:hardware', 'OAVp5.check'],
    keywords: { en: ['hardware state', 'web midi', 'permission', 'connected', 'denied', 'no device', 'safari midi'], zh: ['硬體狀態', 'web midi', '權限', '已連上', '被拒絕', '沒有設備', 'safari midi'] },
  },

  'OAVp5.devices': {
    group: 'midi',
    summary: {
      en: 'The names of the MIDI controllers plugged in, as the browser reports them: an array of text, empty when there is none.',
      zh: '插著的 MIDI 控制器的名稱，照瀏覽器回報的樣子：一個文字陣列，沒有的時候是空的。',
    },
    value: {
      type: 'Array<String>',
      en: 'One entry per connected input port. Replaced whenever a device is plugged in or out. Empty until Web MIDI has been allowed ([`OAVp5.hardware`](#OAVp5.hardware)), and it never lists the on-screen controller or the phone.',
      zh: '每個連上的輸入埠一項。每次有設備插上或拔掉都會換成新的。在 Web MIDI 被允許之前是空的（[`OAVp5.hardware`](#OAVp5.hardware)），而且永遠不會列出螢幕上的控制器或手機。',
    },
    description: [
      {
        en: "Use it for a line like \"playing: Arturia MiniLab3\", or to tell whether a real controller is there. The names are whatever the operating system calls the port, so match them loosely (`name.toLowerCase().includes('minilab')`). The 🎹 panel uses them to follow the controller that is plugged in.",
        zh: "用來顯示像「正在彈：Arturia MiniLab3」這樣的一行，或判斷有沒有真的控制器。名稱是作業系統給連接埠取的名字，所以比對時要寬鬆一點（`name.toLowerCase().includes('minilab')`）。🎹 面板就是用它們來跟著插上去的那一台控制器。",
      },
    ],
    notes: [
      { en: '`midi.devices` is the same array, replaced as a whole, not changed in place: read it again after a change.', zh: '`midi.devices` 是同一個陣列，是整個換掉，不是就地修改：變動之後要重新讀一次。' },
    ],
    examples: [
      {
        code: `function setup() {
  createCanvas(400, 300);
}

function draw() {
  background(20);
  fill(255);
  text(OAVp5.devices.length ? 'playing: ' + OAVp5.devices.join(', ') : 'no MIDI controller plugged in', 20, 30);
}`,
        caption: { en: 'Names the controllers found, or says there are none. Plug a controller in while the page is open and the line changes.', zh: '寫出找到的控制器，或說沒有。頁面開著的時候插上一台控制器，這一行就會改變。' },
      },
    ],
    claims: [{ expr: 'Array.isArray(OAVp5.devices)', equals: true }],
    related: ['OAVp5.hardware', 'OAVp5.connectHardware', 'option:profile', 'option:hardware'],
    keywords: { en: ['devices', 'connected controllers', 'port names', 'midi inputs', 'what is plugged in'], zh: ['設備', '連上的控制器', '連接埠名稱', 'midi 輸入', '插了什麼'] },
  },

  'OAVp5.on': {
    group: 'midi',
    summary: {
      en: 'Listens to a MIDI event by name without defining a global function, and returns a function that stops listening.',
      zh: '用名字監聽一個 MIDI 事件，不必定義全域函式，並回傳一個停止監聽的函式。',
    },
    params: [
      { name: 'name', type: 'String', en: "The event: `'notePressed'`, `'noteReleased'`, `'knobMoved'`, `'faderMoved'`, `'padPressed'`, `'padReleased'`, `'noteOn'`, `'noteOff'`, `'controlChange'`, `'pitchBend'` or `'midiMessage'`. `'noteon'` and `'noteoff'` work in any case. Anything else throws an error that lists the names.", zh: "事件名稱：`'notePressed'`、`'noteReleased'`、`'knobMoved'`、`'faderMoved'`、`'padPressed'`、`'padReleased'`、`'noteOn'`、`'noteOff'`、`'controlChange'`、`'pitchBend'` 或 `'midiMessage'`。`'noteon'` 和 `'noteoff'` 大小寫隨便。其他的名稱會丟出一個錯誤，並列出可用的名稱。" },
      { name: 'fn', type: 'Function', en: 'Called with the same arguments the function of that name would get (`notePressed(note, velocity)`, `knobMoved(n, value)` …).', zh: '呼叫它的時候帶的參數跟同名函式會拿到的一樣（`notePressed(note, velocity)`、`knobMoved(n, value)` …）。' },
    ],
    returns: { type: 'Function', en: 'A function that takes `fn` off again: `const off = OAVp5.on(…); off();`.', zh: '一個把 `fn` 取消的函式：`const off = OAVp5.on(…); off();`。' },
    description: [
      {
        en: "The event functions ([`notePressed()`](#notePressed), [`knobMoved()`](#knobMoved), [`noteOn()`](#noteOn) …) are defined once, by name. `OAVp5.on('notePressed', fn)` is the other way: any number of listeners, added and removed while the sketch runs, with no global names taken. It is how a library, a class or a Hydra sketch listens, and the way to listen for a while and stop.",
        zh: "事件函式（[`notePressed()`](#notePressed)、[`knobMoved()`](#knobMoved)、[`noteOn()`](#noteOn) …）是用名字定義一次的。`OAVp5.on('notePressed', fn)` 是另一種方式：想要幾個監聽者都行，草圖在跑的時候可以加也可以拿掉，也不占用任何全域名稱。函式庫、類別或 Hydra 草圖就是這樣監聽的，要聽一陣子再停下來也用它。",
      },
      {
        en: "A listener counts as a defined function for the pad rule: once anything listens to `'padPressed'`, a pad stops calling `notePressed()`. An error inside `fn` shows in the console and on a card, and the other listeners still run. For the microphone's events use [`OAVp5.mic.on()`](#OAVp5.mic.on).",
        zh: "對打擊墊的規則來說，監聽者就跟定義過的函式一樣：只要有東西在聽 `'padPressed'`，打擊墊就不再呼叫 `notePressed()`。`fn` 裡面出錯會顯示在 console 和卡片上，其他的監聽者照樣執行。麥克風的事件要用 [`OAVp5.mic.on()`](#OAVp5.mic.on)。",
      },
    ],
    notes: [
      { en: '`midi.on(…)` is the same function.', zh: '`midi.on(…)` 是同一個函式。' },
    ],
    examples: [
      {
        code: `let heard = 0;

function setup() {
  createCanvas(400, 300);
  OAVp5.on('noteOn', (note, velocity) => { heard++; });
}

function mousePressed() { OAVp5.play(60 + floor(random(12)), 0.8); }   // no keys? click

function draw() {
  background(20);
  fill(255);
  text('notes heard: ' + heard, 20, 30);
}`,
        caption: { en: 'Counts the notes with a listener instead of a global function. Click the canvas to play one. ' + PLAY.en, zh: '用監聽者而不是全域函式來數音符。點一下畫布就彈一個。' + PLAY.zh },
      },
      {
        code: `let heard = 0;
let off;

function setup() {
  createCanvas(400, 300);
  off = OAVp5.on('noteOn', () => {
    heard++;
    if (heard === 5) off();   // stop listening after five notes
  });
}

function mousePressed() { OAVp5.play(60 + floor(random(12)), 0.8); }

function draw() {
  background(20);
  fill(255);
  text('notes heard: ' + heard + (heard >= 5 ? ' (stopped listening)' : ''), 20, 30);
}`,
        caption: { en: 'The number counts up to five and then stops, even though you keep playing: the listener took itself off.', zh: '數字數到五就停了，就算你繼續彈也一樣：監聽者把自己取消掉了。' },
      },
    ],
    claims: [{ before: "window.__n = 0; window.__off = OAVp5.on('noteOn', () => window.__n++); midi.input([0x90, 60, 100], 'screen'); midi.input([0x90, 62, 100], 'screen'); window.__off(); midi.input([0x90, 64, 100], 'screen')", expr: 'window.__n', equals: 2 }],
    related: ['OAVp5.mic.on', 'notePressed', 'noteOn', 'knobMoved', 'OAVp5.input'],
    keywords: { en: ['subscribe', 'listen', 'event listener', 'unsubscribe', 'off', 'callback without global', 'Hydra'], zh: ['訂閱', '監聽', '事件監聽', '取消訂閱', '不用全域函式', 'Hydra'] },
  },

  'OAVp5.isDown': {
    group: 'midi',
    summary: {
      en: 'True while the key `n` (a MIDI number or a name like `\'C4\'`) is held down: the same as `noteIsDown(n)`.',
      zh: '鍵 `n`（MIDI 號碼，或像 `\'C4\'` 這樣的音名）按著的時候是 true：跟 `noteIsDown(n)` 一樣。',
    },
    params: [
      { name: 'n', type: 'Number | String', en: 'The key: a MIDI number (60) or a note name (`\'C4\'`, `\'c#4\'`, `\'Db3\'`).', zh: '哪個鍵：MIDI 號碼（60）或音名（`\'C4\'`、`\'c#4\'`、`\'Db3\'`）。' },
    ],
    returns: { type: 'Boolean', en: 'True if that key is down right now.', zh: '那個鍵現在按著就是 true。' },
    description: [
      {
        en: "It is [`noteIsDown()`](#noteIsDown) under the `OAVp5` name, for a sketch that cannot use the plain one: `OAVp5.isDown('C4')`. A name that is not a note stops the sketch with a card that says how to write one.",
        zh: '它是用 `OAVp5` 這個名字呼叫的 [`noteIsDown()`](#noteIsDown)，給不能用一般名稱的草圖：`OAVp5.isDown(\'C4\')`。不是音符的名稱會讓草圖停下來，並用卡片說明怎麼寫。',
      },
    ],
    notes: [
      { en: '`midi.isDown(…)` is the same function.', zh: '`midi.isDown(…)` 是同一個函式。' },
    ],
    examples: [
      {
        code: `function setup() {
  createCanvas(400, 300);
  textAlign(CENTER, CENTER);
  textSize(32);
}

function mousePressed() { for (const n of ['C4', 'E4', 'G4']) OAVp5.play(n, 0.8); }   // no keys? click for a chord
function mouseReleased() { for (const n of ['C4', 'E4', 'G4']) OAVp5.play(n, 0); }

function draw() {
  const chord = OAVp5.isDown('C4') && OAVp5.isDown('E4') && OAVp5.isDown('G4');
  background(chord ? color(60, 100, 40) : 20);
  fill(255);
  text(chord ? 'C major' : 'hold C4 + E4 + G4', width / 2, height / 2);
}`,
        caption: { en: 'The background turns green while C, E and G are held together. Hold the mouse down to play the chord. ' + PLAY.en, zh: 'C、E、G 同時按著的時候，背景變綠。按住滑鼠就會彈出這個和弦。' + PLAY.zh },
      },
    ],
    claims: [
      { before: "midi.input([0x90, 60, 127], 'screen')", expr: "OAVp5.isDown('C4')", equals: true },
      { before: "midi.input([0x80, 60, 0], 'screen')", expr: 'OAVp5.isDown(60)', equals: false },
    ],
    related: ['noteIsDown', 'OAVp5.note', 'OAVp5.held', 'noteNumber'],
    keywords: { en: ['is down', 'key down', 'is key held', 'note name', 'midi.isDown'], zh: ['按著嗎', '琴鍵按著', '音名', 'midi.isDown'] },
  },

  'OAVp5.input': {
    group: 'midi',
    summary: {
      en: 'Sends one MIDI message into oav-p5 by hand, as bytes: the whole sketch reacts as if a controller had sent it.',
      zh: '用位元組手動送一則 MIDI 訊息給 oav-p5：整個草圖的反應就像是控制器送出來的。',
    },
    params: [
      { name: 'bytes', type: 'Array<Number>', en: 'One message, `[status, data1, data2]`: `[0x90, 60, 100]` is a note-on for key 60 with velocity 100 on channel 1, `[0xB0, 74, 127]` a control change, `[0xE0, 0, 64]` a pitch bend in the middle. The status byte sets the kind (top half) and the channel (bottom half). Only the first three numbers are read, and the data bytes are held to 0 to 127. System messages are not for this: the clock bytes (`0xF8`, `0xFA`, `0xFB`, `0xFC`, `0xF2`) go to [`OAVp5.clock`](#OAVp5.clock), and anything else from `0xF0` up is ignored.', zh: '一則訊息，`[status, data1, data2]`：`[0x90, 60, 100]` 是通道 1 上鍵 60、力道 100 的 note-on，`[0xB0, 74, 127]` 是控制變化，`[0xE0, 0, 64]` 是在中間的音高輪。status 位元組決定種類（上半）和通道（下半）。只讀前三個數字，資料位元組會被限制在 0 到 127。系統訊息不是給它用的：時鐘位元組（`0xF8`、`0xFA`、`0xFB`、`0xFC`、`0xF2`）會交給 [`OAVp5.clock`](#OAVp5.clock)，從 `0xF0` 起的其他東西都忽略。' },
      { name: 'source', type: 'String', optional: true, default: "'screen'", en: "A label for where it came from, which shows up as `OAVp5.last.source` and as the second argument of [`midiMessage()`](#midiMessage). Any text. `'hardware'` and `'virtual-out'` are taken as those real sources and are not repeated to a sketch's own Web MIDI code.", zh: "一個說明來源的標籤，會出現在 `OAVp5.last.source`，也是 [`midiMessage()`](#midiMessage) 的第二個參數。任何文字都行。`'hardware'` 和 `'virtual-out'` 會被當作真的那兩種來源，不會再轉給草圖自己的 Web MIDI 程式。" },
      { name: 'device', type: 'String', optional: true, en: "A profile id such as `'akai-lpd8'`: the numbering of `knob1`, `pad1` … follows that controller for this message. Left out, it is the controller on the on-screen panel.", zh: "設定檔 id，像 `'akai-lpd8'`：這則訊息裡 `knob1`、`pad1` … 的編號照那一台控制器來對應。不寫的話，就是螢幕面板上的那一台控制器。" },
    ],
    description: [
      {
        en: "It is the door every input goes through, and you can knock on it yourself: a sketch can test itself without a controller, drive itself from a timer, or take messages from a WebSocket or another library. The sketch cannot tell the difference: [`knob1`](#knob1), [`notePressed()`](#notePressed), [`OAVp5.note`](#OAVp5.note), the sound if [`startSound()`](#startSound) is on and the drum cues all react. [`OAVp5.play()`](#OAVp5.play) is the friendlier way to send a note.",
        zh: '每一種輸入都從這扇門進來，你也可以自己來敲：草圖可以在沒有控制器的時候測試自己、用計時器自己推動自己，或接收來自 WebSocket 或其他函式庫的訊息。草圖分不出差別：[`knob1`](#knob1)、[`notePressed()`](#notePressed)、[`OAVp5.note`](#OAVp5.note)、開著 [`startSound()`](#startSound) 時的聲音，還有鼓機的 cue 都會有反應。要送音符的話，[`OAVp5.play()`](#OAVp5.play) 是比較親切的方式。',
      },
    ],
    notes: [
      { en: '`midi.input(…)` is the same function. It returns nothing. A message with a source other than `\'screen\'` also lights the keys of the on-screen controller if it is open.', zh: '`midi.input(…)` 是同一個函式。它沒有回傳值。來源不是 `\'screen\'` 的訊息，會在螢幕控制器打開的時候也讓它的琴鍵亮起來。' },
    ],
    examples: [
      {
        code: `function setup() {
  createCanvas(400, 300);
  textAlign(CENTER, CENTER);
  textSize(24);
}

function mousePressed() {
  OAVp5.input([0x90, 60 + floor(random(12)), 100]);   // a note-on, as a key would send it
}

function notePressed(note, velocity) {
  background(20);
  fill(255);
  text(noteName(note) + ' (sent by hand)', width / 2, height / 2);
}`,
        caption: { en: 'Click the canvas: the sketch hears a note-on exactly as if you had played a key, and names it.', zh: '點一下畫布：草圖聽到一個 note-on，就跟你彈了一個鍵一樣，並說出它的名字。' },
      },
      {
        code: `function setup() {
  createCanvas(400, 300);
}

function mouseDragged() {
  OAVp5.input([0xB0, 74, constrain(round(mouseX / width * 127), 0, 127)]);   // CC 74 is knob 1 on a MiniLab 3
}

function draw() {
  background(20);
  circle(width / 2, height / 2, 40 + knob1 * 300);
}`,
        caption: { en: 'Drag the mouse across the canvas: it sends CC 74, which is knob 1, and the circle follows.', zh: '在畫布上拖動滑鼠：它送出 CC 74，也就是旋鈕 1，圓跟著動。' },
      },
      {
        code: `function setup() {
  createCanvas(400, 300);
  OAVp5.input([0xB0, 70, 127], 'test', 'akai-lpd8');   // CC 70 is knob 1 on an LPD8
}

function draw() {
  background(20);
  fill(255);
  text('knob1 = ' + knob1 + ' (from the LPD8 numbering)', 20, 30);
  text('last: ' + OAVp5.last.control + ' from ' + OAVp5.last.source, 20, 60);
}`,
        caption: { en: 'The third argument says which controller the message comes from, so CC 70 is knob 1 here, whatever profile the panel shows.', zh: '第三個參數說明這則訊息來自哪一台控制器，所以不管面板顯示哪個設定檔，這裡的 CC 70 都是旋鈕 1。' },
      },
    ],
    claims: [
      { before: "midi.input([0xB0, 70, 127], 'test', 'akai-lpd8')", expr: 'knob1', equals: 1 },
      { before: "midi.input([0x93, 61, 127], 'test')", expr: 'JSON.stringify([OAVp5.last.note, OAVp5.last.channel, OAVp5.last.source])', equals: '[61,4,"test"]' },
    ],
    related: ['OAVp5.play', 'OAVp5.last', 'OAVp5.on', 'midiMessage', 'noteOn', 'controlChange'],
    keywords: { en: ['input', 'send midi', 'fake midi', 'simulate controller', 'raw bytes', 'test without controller', 'midi.input'], zh: ['輸入', '送 midi', '假的 midi', '模擬控制器', '原始位元組', '沒有控制器也能測', 'midi.input'] },
  },

  'OAVp5.connectHardware': {
    group: 'midi',
    summary: {
      en: 'Asks the browser for Web MIDI now, and returns a promise that says whether a real controller can be heard.',
      zh: '現在就向瀏覽器要 Web MIDI，並回傳一個 promise，告訴你聽不聽得到真的控制器。',
    },
    params: [],
    returns: { type: 'Promise<Boolean>', en: 'Resolves to `true` once the browser has allowed Web MIDI (with or without a device plugged in), and to `false` if it refused or there is no Web MIDI in this browser. Calling it again while it is asking, or after it said yes, gives the same answer.', zh: '瀏覽器允許 Web MIDI 之後 resolve 成 `true`（不管有沒有插設備），被拒絕或這個瀏覽器沒有 Web MIDI 就 resolve 成 `false`。還在詢問的時候、或是已經答應之後再呼叫，會得到同樣的答案。' },
    description: [
      {
        en: "It does what [`?oav_hardware=auto`](#option-hardware) does at load, at a moment you pick: from a button, after an intro, or when [`hardware`](#option-hardware) is `click` or `off`. It works whatever the option says. After a refusal you can call it again to retry, but browsers usually remember a refusal and answer at once, so the way out is the lock icon left of the address.",
        zh: '它做的就是 [`?oav_hardware=auto`](#option-hardware) 在載入時做的事，只是時間由你挑：從一個按鈕、片頭結束之後，或是 [`hardware`](#option-hardware) 設成 `click` 或 `off` 的時候。不管選項怎麼設它都能用。被拒絕之後可以再呼叫一次重試，但瀏覽器通常會記住拒絕、立刻回答，所以要解決得靠網址列左邊的鎖頭。',
      },
    ],
    needs: {
      en: 'A browser with Web MIDI (Chrome, Edge, Firefox), on `https` or `localhost`. Some browsers want a click first: call it from `mousePressed()` or a button handler if `setup()` is too early. Safari and iPad have none: the promise resolves `false` and [`OAVp5.hardware`](#OAVp5.hardware) is `\'unavailable\'`.',
      zh: '要有 Web MIDI 的瀏覽器（Chrome、Edge、Firefox），網頁在 `https` 或 `localhost` 底下。有些瀏覽器要先有一次點擊：如果在 `setup()` 裡太早，就放在 `mousePressed()` 或按鈕的處理函式裡呼叫。Safari 和 iPad 沒有：promise 會 resolve 成 `false`，[`OAVp5.hardware`](#OAVp5.hardware) 是 `\'unavailable\'`。',
    },
    examples: [
      {
        code: `window.OAV_P5 = { hardware: 'click' };   // do not ask at load

let answer = 'click the canvas to ask for Web MIDI';

function setup() {
  createCanvas(400, 300);
}

function mousePressed() {
  OAVp5.connectHardware().then((ok) => { answer = ok ? 'Web MIDI allowed' : 'no Web MIDI for this page'; });
}

function draw() {
  background(20);
  fill(255);
  text(answer, 20, 30);
  text('state: ' + OAVp5.hardware, 20, 60);
}`,
        caption: { en: 'Nothing is asked at load. Click the canvas: the browser asks, the state goes from "off" through "asking" to "connected", "waiting" or "denied", and the text follows.', zh: '載入的時候什麼都沒有問。點一下畫布：瀏覽器才詢問，狀態從 "off" 經過 "asking" 變成 "connected"、"waiting" 或 "denied"，文字也跟著變。' },
      },
    ],
    related: ['OAVp5.hardware', 'OAVp5.devices', 'option:hardware'],
    keywords: { en: ['connect hardware', 'ask for midi', 'web midi permission', 'request midi', 'start midi'], zh: ['連接硬體', '要 midi', 'web midi 權限', '請求 midi', '啟動 midi'] },
  },

  'OAVp5.panel': {
    group: 'midi',
    summary: {
      en: 'The 🎹 panel as an object: `open()`, `close()` and `toggle()` show and hide it from code.',
      zh: '把 🎹 面板當成物件：用 `open()`、`close()`、`toggle()` 從程式裡顯示和收起它。',
    },
    description: [
      {
        en: "The panel behind the 🎹 button holds the on-screen controller and the buttons for 🎤, 🔊, 🥁, ⏺, 📷, 📱 and 🩺. [`OAVp5.panel.open()`](#OAVp5.panel.open), `close()` and `toggle()` do what pressing 🎹 does, from your code: open it on a key, or open it at the start for a workshop ([`?oav_panel=open`](#option-panel) does the same at load).",
        zh: '🎹 按鈕後面的面板裝著螢幕上的控制器，和 🎤、🔊、🥁、⏺、📷、📱、🩺 的按鈕。[`OAVp5.panel.open()`](#OAVp5.panel.open)、`close()`、`toggle()` 做的是按 🎹 做的事，只是從你的程式裡：按一個鍵就打開它，或是工作坊一開始就打開（[`?oav_panel=open`](#option-panel) 在載入時做同樣的事）。',
      },
    ],
    notes: [
      { en: 'With `?oav_panel=off` there is no 🎹 and these do nothing.', zh: '設了 `?oav_panel=off` 就沒有 🎹，這幾個也什麼都不做。' },
    ],
    examples: [
      {
        code: `function setup() {
  createCanvas(400, 300);
}

function keyPressed() {
  if (key === 'p') OAVp5.panel.toggle();
}

function draw() {
  background(20);
  fill(255);
  text('press p to show or hide the 🎹 panel', 20, 30);
}`,
        caption: { en: 'Press p: the 🎹 panel opens and, pressed again, closes.', zh: '按 p：🎹 面板打開，再按一次就關起來。' },
      },
    ],
    related: ['OAVp5.panel.open', 'option:panel', 'option:compact', 'OAVp5.phone'],
    keywords: { en: ['panel', 'open the panel', 'show piano panel', 'toggle panel', 'on-screen controller'], zh: ['面板', '打開面板', '顯示鋼琴面板', '切換面板', '螢幕控制器'] },
  },

  'OAVp5.panel.open': {
    group: 'midi',
    aliases: ['OAVp5.panel.close', 'OAVp5.panel.toggle'],
    summary: {
      en: 'Opens the 🎹 panel (`open()`), closes it (`close()`) or flips it (`toggle()`).',
      zh: '打開 🎹 面板（`open()`）、收起它（`close()`），或是切換（`toggle()`）。',
    },
    params: [],
    returns: { type: 'Promise<Element | null>', en: 'A promise. `open()` (and `toggle()` when it opens) resolves to the panel\'s element once the on-screen controller inside it has loaded, and the panel is on screen at once, before that. `close()` (and `toggle()` when it closes) resolves to `null`, and so does everything when the panel option is `off`.', zh: '一個 promise。`open()`（以及 `toggle()` 打開時）在面板裡的螢幕控制器載好之後 resolve 成面板的元素，面板本身一開始就會顯示，不用等。`close()`（以及 `toggle()` 關起來時）resolve 成 `null`，面板選項是 `off` 的時候全部都是 `null`。' },
    description: [
      {
        en: "Same as pressing the 🎹 button. The first time the panel opens, oav-p5 loads the on-screen controller (a few seconds on a slow connection, which the panel says while it loads), and if [`hardware`](#option-hardware) is `click` it asks for Web MIDI then. `OAVp5.panel.open()` when it is already open does nothing new.",
        zh: '就跟按 🎹 按鈕一樣。面板第一次打開的時候，oav-p5 才載入螢幕控制器（連線慢的話要幾秒，載入的時候面板會這麼說），而且 [`hardware`](#option-hardware) 是 `click` 的話，就在這時去要 Web MIDI。已經打開的時候再呼叫 `OAVp5.panel.open()` 不會有新的動作。',
      },
    ],
    notes: [
      { en: 'The three are listed together here: `OAVp5.panel.close` and `OAVp5.panel.toggle` take no arguments either. `midi.panel.open()` is the same function.', zh: '這三個放在一起說明：`OAVp5.panel.close` 和 `OAVp5.panel.toggle` 也都不帶參數。`midi.panel.open()` 是同一個函式。' },
    ],
    examples: [
      {
        code: `function setup() {
  createCanvas(400, 300);
}

function keyPressed() {
  if (key === 'o') OAVp5.panel.open();
  if (key === 'c') OAVp5.panel.close();
}

function draw() {
  background(20);
  fill(255);
  text('o: open the 🎹 panel,  c: close it', 20, 30);
}`,
        caption: { en: 'Press o to open the 🎹 panel and c to close it.', zh: '按 o 打開 🎹 面板，按 c 收起來。' },
      },
      {
        code: `function setup() {
  createCanvas(400, 300);
}

function mousePressed() {
  OAVp5.panel.open().then((panel) => console.log('the panel is', panel ? 'open and loaded' : 'not available'));
}

function draw() {
  background(20);
  fill(255);
  text('click the canvas to open the panel', 20, 30);
}`,
        caption: { en: 'Click the canvas: the panel opens at once, and the console says when the controller inside it has loaded.', zh: '點一下畫布：面板馬上打開，裡面的控制器載好的時候，console 會說一聲。' },
      },
    ],
    related: ['OAVp5.panel', 'option:panel', 'OAVp5.phone', 'OAVp5.check'],
    keywords: { en: ['open panel', 'close panel', 'toggle panel', 'show 🎹', 'hide 🎹'], zh: ['打開面板', '收起面板', '切換面板', '顯示 🎹', '隱藏 🎹'] },
  },

  'OAVp5.phone': {
    group: 'midi',
    summary: {
      en: 'Shows the 📱 card: a QR code that sends a phone to the remote page, whose MIDI tab then plays this sketch. Returns the room name.',
      zh: '顯示 📱 卡片：一個 QR code，讓手機打開遙控頁面，手機上的 MIDI 分頁就能彈這個草圖。回傳房間名稱。',
    },
    params: [],
    returns: { type: 'String', en: 'The name of the room the phone joins: the [`room`](#option-room) option, or the [`link`](#option-link) room, or a name made up for this browser (`p5-…`) and kept in it.', zh: '手機要加入的房間名稱：[`room`](#option-room) 選項、[`link`](#option-link) 的房間，或是為這個瀏覽器隨機取、並存在裡面的名字（`p5-…`）。' },
    description: [
      {
        en: "The same as the 📱 button in the panel. The card shows a QR code, the room and the link underneath; opening the link on a phone gives that phone an on-screen controller whose MIDI tab plays your sketch over the relay, as one more input (`OAVp5.last.source` is `'phone'`). Calling it again hides the card. The first call connects to the [`relay`](#option-relay) and loads a small QR-code library from jsDelivr.",
        zh: "跟面板裡的 📱 按鈕一樣。卡片上有 QR code、房間，和下面的連結。在手機上打開連結，那支手機就有一個螢幕控制器，它的 MIDI 分頁透過中繼來彈你的草圖，當作多一個輸入（`OAVp5.last.source` 是 `'phone'`）。再呼叫一次就把卡片收起來。第一次呼叫會連到 [`relay`](#option-relay)，並從 jsDelivr 載入一個很小的 QR code 函式庫。",
      },
    ],
    needs: {
      en: 'A network connection, to the relay (`wss://remote.cheyuwu.com/relay` unless you set another) and, for the picture of the QR code, to jsDelivr. Without the library the card shows the link as text.',
      zh: '要有網路，連到中繼（沒另外設的話是 `wss://remote.cheyuwu.com/relay`），顯示 QR code 的圖還要連到 jsDelivr。沒有那個函式庫的話，卡片就把連結用文字顯示。',
    },
    tbd: [
      { en: 'A phone playing a sketch through the relay was not tried for this page: the headless check cannot reach the relay, so the example is not run. The behaviour is as the code and the project\'s README describe it.', zh: '這一頁沒有試過用手機透過中繼彈草圖：無頭瀏覽器的檢查連不到中繼，所以範例沒有跑。行為依程式碼和專案的 README 所述。' },
    ],
    examples: [
      {
        code: `function setup() {
  createCanvas(400, 300);
}

function mousePressed() {
  const room = OAVp5.phone();   // the QR code card opens
  console.log('phones join room', room);
}

function notePressed(note) {
  background(random(255), random(255), random(255));   // a phone key changes the colour
}

function draw() {
  fill(255);
  text('click the canvas, scan the QR code, open the MIDI tab', 20, 30);
}`,
        caption: { en: 'Click the canvas and scan the QR code with a phone: the keys on its MIDI tab change the background of this sketch.', zh: '點一下畫布，用手機掃 QR code：手機 MIDI 分頁上的鍵會改變這個草圖的背景顏色。' },
        run: 'static',
        why: 'It opens a QR code and connects to the network relay, which the headless check does not do.',
      },
    ],
    related: ['option:room', 'option:relay', 'option:remote', 'OAVp5.panel.open'],
    keywords: { en: ['phone', 'qr code', 'play from phone', 'remote', 'mobile controller', 'scan'], zh: ['手機', 'qr code', '用手機彈', '遙控', '行動控制器', '掃描'] },
  },

  'OAVp5.wiring': {
    group: 'midi',
    summary: {
      en: 'Lists which controller knob, fader or pad drives which OpenProcessing OPC variable right now: `[{ control: \'knob1\', name: \'radius\' }, …]`.',
      zh: '列出現在哪一顆旋鈕、推桿或墊子在推動哪一個 OpenProcessing OPC 變數：`[{ control: \'knob1\', name: \'radius\' }, …]`。',
    },
    params: [
      { name: 'dev', type: 'String', optional: true, default: "'screen'", en: "Whose numbering to use: `'screen'` (the controller shown in the panel) or a profile id such as `'akai-lpd8'`. It matters for the faders, which are numbered after the knobs.", zh: "用誰的編號：`'screen'`（面板上顯示的那台控制器）或設定檔 id，像 `'akai-lpd8'`。它會影響推桿，因為推桿的編號接在旋鈕後面。" },
    ],
    returns: { type: 'Array<Object>', en: "One `{ control, name }` per wired variable: `control` is `'knob1'`, `'fader2'`, `'pad1'` …, `name` is the OPC variable. A control the sketch reads itself also has `sketch: true`, and its slider no longer follows it. An empty array when there is no OPC on the page or [`opc`](#option-opc) is `off`.", zh: "每個接上線的變數一筆 `{ control, name }`：`control` 是 `'knob1'`、`'fader2'`、`'pad1'` …，`name` 是 OPC 的變數。草圖自己有讀的控制還會多一個 `sketch: true`，對應的滑桿就不再跟著它。頁面上沒有 OPC，或 [`opc`](#option-opc) 是 `off` 的時候是空陣列。" },
    description: [
      {
        en: "With OP Configurator, `OPC.slider('radius', 10)` declares a variable and oav-p5 wires the controller to the OPC variables in order: knob 1 to the first slider, knob 2 to the second, the faders after the knobs, pad 1 to the first toggle or button. This is the list of who drives what, the same one the panel prints under the controller and the console says once. Use it when a knob moves the wrong thing.",
        zh: "搭配 OP Configurator 時，`OPC.slider('radius', 10)` 宣告一個變數，oav-p5 會依序把控制器接到 OPC 的變數：旋鈕 1 接第一個滑桿，旋鈕 2 接第二個，推桿接在旋鈕後面，打擊墊 1 接第一個開關或按鈕。這份清單就是誰推動什麼，面板在控制器下面印的、console 說一次的也是同一份。旋鈕推動錯東西的時候就看它。",
      },
    ],
    notes: [
      { en: '`midi.wiring(…)` is the same function.', zh: '`midi.wiring(…)` 是同一個函式。' },
    ],
    tbd: [
      { en: "Not tried with OpenProcessing's real OPC library: it was checked against a stand-in object with the same `options` shape (`{ type: 'slider', name, min, max }`). Outside OpenProcessing the result is an empty array.", zh: "沒有用 OpenProcessing 真正的 OPC 函式庫試過：是拿一個有同樣 `options` 結構（`{ type: 'slider', name, min, max }`）的替身物件檢查的。在 OpenProcessing 以外，結果是空陣列。" },
    ],
    examples: [
      {
        code: `function setup() {
  createCanvas(400, 300);
}

function draw() {
  background(20);
  fill(255);
  const wired = OAVp5.wiring();
  text(wired.length ? wired.map((w) => w.control + ' -> ' + w.name).join('\\n') : 'nothing wired (no OPC here)', 20, 30);
}`,
        caption: { en: 'Prints the controls and the OPC variables they drive, one per line. Outside OpenProcessing there is no OPC, so it says nothing is wired.', zh: '一行印一組控制和它推動的 OPC 變數。在 OpenProcessing 以外沒有 OPC，所以會說沒有接上任何東西。' },
      },
    ],
    claims: [
      { expr: 'OAVp5.wiring().length', equals: 0 },
      { before: "window.OPC = { options: { radius: { type: 'slider', name: 'radius', min: 0, max: 100, value: 10 }, go: { type: 'toggle', name: 'go', value: false } }, set() {} }", expr: 'JSON.stringify(OAVp5.wiring())', equals: '[{"control":"knob1","name":"radius"},{"control":"pad1","name":"go"}]' },
    ],
    related: ['option:opc', 'knob1', 'knob', 'pad1', 'OAVp5.check'],
    keywords: { en: ['wiring', 'opc', 'op configurator', 'which knob drives what', 'map controller to sliders'], zh: ['接線', 'opc', 'op configurator', '哪顆旋鈕推動什麼', '控制器對應滑桿'] },
  },

  // ───────────────────────────────────────────────────────────────────────── the microphone
  'OAVp5.mic': {
    group: 'mic',
    summary: {
      en: 'The microphone under the plain names: its state, the numbers of `micLevel` and `bass` that never turn it on when read, the raw loudness, start, stop and events.',
      zh: '平常那些名稱底下的麥克風：它的狀態、跟 `micLevel` 和 `bass` 一樣的數字（讀它們不會把麥克風打開）、原始的音量，還有 start、stop 和事件。',
    },
    description: [
      {
        en: "Everything the microphone names ([`micLevel`](#micLevel), [`bass`](#bass), [`micIsOn`](#micIsOn), [`startMic()`](#startMic) …) read from here. The difference is that reading `OAVp5.mic.level` never asks for the microphone: the plain `micLevel` does, the first time. So `OAVp5.mic` is for code that must look without waking anything: a status line, a library, a sketch with `?oav_mic=click`.",
        zh: '所有麥克風的名稱（[`micLevel`](#micLevel)、[`bass`](#bass)、[`micIsOn`](#micIsOn)、[`startMic()`](#startMic) …）讀的都是這裡。差別是讀 `OAVp5.mic.level` 永遠不會去要麥克風，而一般的 `micLevel` 第一次讀就會。所以 `OAVp5.mic` 是給「只想看、不想吵醒任何東西」的程式用的：狀態列、函式庫、設了 `?oav_mic=click` 的草圖。',
      },
      {
        en: 'The members: [`state`](#OAVp5.mic.state), [`error`](#OAVp5.mic.error), [`sensitivity`](#OAVp5.mic.sensitivity) (also `gain`), [`level`](#OAVp5.mic.level), [`bass`](#OAVp5.mic.bass) (also `mid`, `treble`), [`rms`](#OAVp5.mic.rms), [`db`](#OAVp5.mic.db), [`floor`](#OAVp5.mic.floor), [`analyzer`](#OAVp5.mic.analyzer), [`start()`](#OAVp5.mic.start), [`stop()`](#OAVp5.mic.stop) and [`on()`](#OAVp5.mic.on).',
        zh: '成員有：[`state`](#OAVp5.mic.state)、[`error`](#OAVp5.mic.error)、[`sensitivity`](#OAVp5.mic.sensitivity)（也叫 `gain`）、[`level`](#OAVp5.mic.level)、[`bass`](#OAVp5.mic.bass)（還有 `mid`、`treble`）、[`rms`](#OAVp5.mic.rms)、[`db`](#OAVp5.mic.db)、[`floor`](#OAVp5.mic.floor)、[`analyzer`](#OAVp5.mic.analyzer)、[`start()`](#OAVp5.mic.start)、[`stop()`](#OAVp5.mic.stop) 和 [`on()`](#OAVp5.mic.on)。',
      },
    ],
    notes: [
      { en: 'This is advanced. For most sketches the plain names are all you need.', zh: '這是進階用法。大多數草圖只要用一般的名稱就夠了。' },
    ],
    examples: [
      {
        code: `function setup() {
  createCanvas(400, 300);
}

function mousePressed() {
  if (OAVp5.mic.state === 'on') OAVp5.mic.stop(); else OAVp5.mic.start();
}

function draw() {
  background(20);
  fill(255);
  text('microphone: ' + OAVp5.mic.state + ' (click the canvas to switch it)', 20, 30);   // reading this asks for nothing
  circle(width / 2, height / 2, 50 + OAVp5.mic.level * 300);
}`,
        caption: { en: 'A circle that follows the microphone, which only starts when you click: reading OAVp5.mic never turns it on by itself.', zh: '一個跟著麥克風走的圓，要點一下畫布才會開始收音：讀 OAVp5.mic 不會自己把麥克風打開。' },
        needs: 'mic',
      },
    ],
    claims: [{ expr: 'OAVp5.mic.state', equals: 'off' }],
    related: ['micLevel', 'bass', 'micIsOn', 'startMic', 'stopMic', 'option:mic'],
    keywords: { en: ['mic object', 'microphone state', 'read without starting', 'raw microphone', 'mic members'], zh: ['麥克風物件', '麥克風狀態', '讀取但不啟動', '原始麥克風', '麥克風成員'] },
  },

  'OAVp5.mic.state': {
    group: 'mic',
    summary: {
      en: 'Where the microphone is: `\'off\'`, `\'asking\'`, `\'on\'`, `\'denied\'` or `\'unavailable\'`.',
      zh: '麥克風現在的情形：`\'off\'`、`\'asking\'`、`\'on\'`、`\'denied\'` 或 `\'unavailable\'`。',
    },
    value: {
      type: 'String', range: "'off' | 'asking' | 'on' | 'denied' | 'unavailable'",
      en: 'Changes when you start or stop the microphone and when the browser answers. `\'off\'` until something starts it. Reading it never starts it.',
      zh: '你開始或停止麥克風、瀏覽器回答的時候會變。在有東西啟動它之前是 `\'off\'`。讀它不會啟動它。',
    },
    description: [
      {
        en: "`'off'`: not started, or stopped. `'asking'`: the browser is waiting for the user's answer. `'on'`: sound is coming in, and [`micIsOn`](#micIsOn) is true. `'denied'`: the permission was refused (by the user, by the computer's settings, or by an iframe without `allow=\"microphone\"`). `'unavailable'`: there is no microphone, none the browser can open, or the page is not on `https` or `localhost`. When it is not `'on'`, [`OAVp5.mic.error`](#OAVp5.mic.error) has the browser's reason and a card beside the 🎹 says what to press.",
        zh: "`'off'`：還沒啟動，或已經停了。`'asking'`：瀏覽器在等使用者回答。`'on'`：聲音進來了，[`micIsOn`](#micIsOn) 是 true。`'denied'`：權限被拒絕（被使用者、被電腦的設定，或被沒有 `allow=\"microphone\"` 的 iframe）。`'unavailable'`：沒有麥克風、瀏覽器打不開，或網頁不在 `https` 或 `localhost` 底下。不是 `'on'` 的時候，[`OAVp5.mic.error`](#OAVp5.mic.error) 有瀏覽器給的原因，🎹 旁邊也會有卡片說明要按什麼。",
      },
    ],
    examples: [
      {
        code: `function setup() {
  createCanvas(400, 300);
  startMic();
}

function draw() {
  background(OAVp5.mic.state === 'on' ? 20 : color(90, 30, 30));
  fill(255);
  text('microphone: ' + OAVp5.mic.state, 20, 30);
  if (OAVp5.mic.state === 'denied') text('click the lock left of the address and allow it', 20, 60);
}`,
        caption: { en: 'The background is red until the microphone is on. The state goes "asking", then "on" when you allow it, or "denied" when you refuse.', zh: '麥克風開起來之前背景是紅的。狀態先是 "asking"，你允許之後變成 "on"，拒絕的話變成 "denied"。' },
        needs: 'mic',
      },
    ],
    claims: [{ expr: "['off', 'asking', 'on', 'denied', 'unavailable'].includes(OAVp5.mic.state)", equals: true }],
    related: ['micIsOn', 'OAVp5.mic.error', 'startMic', 'option:mic', 'OAVp5.check'],
    keywords: { en: ['mic state', 'permission state', 'microphone denied', 'asking', 'is the microphone on'], zh: ['麥克風狀態', '權限狀態', '麥克風被拒絕', '詢問中', '麥克風開了嗎'] },
  },

  'OAVp5.mic.error': {
    group: 'mic',
    summary: {
      en: 'Why the microphone did not start, as the browser\'s error name such as `\'NotAllowedError\'`; `null` while there is no error.',
      zh: '麥克風為什麼沒開起來，用瀏覽器的錯誤名稱表示，像 `\'NotAllowedError\'`，沒有錯誤的時候是 `null`。',
    },
    value: {
      type: 'String | null',
      en: "`null` at the start and again once the microphone is on. After a failure: the browser's error name (`'NotAllowedError'` or `'SecurityError'` for a refusal, `'NotFoundError'` when there is no microphone, `'NotReadableError'` when another program holds it) or `'no getUserMedia'` on a page that cannot ask.",
      zh: "一開始是 `null`，麥克風開起來之後又回到 `null`。失敗之後是瀏覽器的錯誤名稱（被拒絕是 `'NotAllowedError'` 或 `'SecurityError'`，沒有麥克風是 `'NotFoundError'`，被別的程式占住是 `'NotReadableError'`），或是在不能詢問的頁面上的 `'no getUserMedia'`。",
    },
    description: [
      {
        en: "For a sketch that wants to say more than a card does: `if (OAVp5.mic.error === 'NotAllowedError') …`. The card beside the 🎹 already tells the user what to press for each of these, in their language; this is the same fact for your code.",
        zh: "給想比卡片說得更多的草圖用：`if (OAVp5.mic.error === 'NotAllowedError') …`。🎹 旁邊的卡片已經用使用者的語言，針對每一種告訴他要按什麼了，這是同一件事給你的程式用。",
      },
    ],
    examples: [
      {
        code: `function setup() {
  createCanvas(400, 300);
  startMic();
}

function draw() {
  background(20);
  fill(255);
  text('state: ' + OAVp5.mic.state, 20, 30);
  text('error: ' + OAVp5.mic.error, 20, 60);   // null while all is well
}`,
        caption: { en: 'Prints the state and the error. Refuse the microphone to see "NotAllowedError".', zh: '印出狀態和錯誤。拒絕麥克風就會看到 "NotAllowedError"。' },
        needs: 'mic',
      },
    ],
    claims: [{ expr: 'OAVp5.mic.error === null', equals: true }],
    related: ['OAVp5.mic.state', 'startMic', 'micIsOn'],
    keywords: { en: ['mic error', 'NotAllowedError', 'why no microphone', 'permission error', 'getUserMedia error'], zh: ['麥克風錯誤', 'NotAllowedError', '為什麼沒有麥克風', '權限錯誤', 'getUserMedia 錯誤'] },
  },

  'OAVp5.mic.sensitivity': {
    group: 'mic',
    aliases: ['OAVp5.mic.gain'],
    summary: {
      en: 'The microphone\'s sensitivity: 1 normally, 2 for twice as sensitive. [`micSensitivity()`](#micSensitivity) sets it; `OAVp5.mic.gain` is the old name.',
      zh: '麥克風的靈敏度：平常是 1，2 是兩倍靈敏。用 [`micSensitivity()`](#micSensitivity) 來設定，`OAVp5.mic.gain` 是舊名字。',
    },
    value: {
      type: 'Number', range: '0.05..20',
      en: 'Starts at 1. [`micSensitivity(v)`](#micSensitivity) keeps what you give it between 0.05 and 20.',
      zh: '一開始是 1。[`micSensitivity(v)`](#micSensitivity) 會把你給的值限制在 0.05 到 20 之間。',
    },
    description: [
      {
        en: "The number multiplies what the microphone hears: on [`micLevel`](#micLevel) 2 adds 6 dB, on [`bass`](#bass), `mid` and `treble` it multiplies by 2. Read it to show the current setting, and set it with [`micSensitivity()`](#micSensitivity), which checks the number.",
        zh: '這個數字乘在麥克風聽到的東西上：對 [`micLevel`](#micLevel) 來說 2 等於加 6 dB，對 [`bass`](#bass)、`mid`、`treble` 是乘以 2。讀它來顯示目前的設定，要設定的話用 [`micSensitivity()`](#micSensitivity)，它會檢查數字。',
      },
    ],
    notes: [
      { en: '`OAVp5.mic.gain` is the same value under the name oav-p5 0.3.0 used. Assigning to either works (`OAVp5.mic.gain = 2`) but is not held between 0.05 and 20, and `gain` falls back to 1 for a number that is not above 0.', zh: '`OAVp5.mic.gain` 是同一個值，用的是 oav-p5 0.3.0 的名字。直接指定給任何一個都行（`OAVp5.mic.gain = 2`），但不會被限制在 0.05 到 20 之間，而且 `gain` 遇到不大於 0 的數字會退回 1。' },
    ],
    examples: [
      {
        code: `function setup() {
  createCanvas(400, 300);
  micSensitivity(3);   // a quiet or far-away microphone
}

function draw() {
  background(20);
  fill(255);
  text('sensitivity ' + OAVp5.mic.sensitivity, 20, 30);   // 3
  circle(width / 2, height / 2, 50 + micLevel * 300);
}`,
        caption: { en: 'micSensitivity(3) sets the number, and OAVp5.mic.sensitivity reads it back.', zh: 'micSensitivity(3) 設定這個數字，OAVp5.mic.sensitivity 把它讀回來。' },
        needs: 'mic',
      },
    ],
    claims: [{ expr: 'OAVp5.mic.sensitivity', equals: 1 }, { expr: 'OAVp5.mic.gain', equals: 1 }],
    related: ['micSensitivity', 'micLevel', 'bass'],
    keywords: { en: ['sensitivity', 'gain', 'boost', 'quiet microphone', 'mic gain'], zh: ['靈敏度', '增益', '放大', '麥克風很小聲', '麥克風增益'] },
  },

  'OAVp5.mic.level': {
    group: 'mic',
    summary: {
      en: 'The same 0 to 1 loudness as `micLevel`, read without ever turning the microphone on.',
      zh: '跟 `micLevel` 一樣的 0 到 1 音量，讀它不會把麥克風打開。',
    },
    value: {
      type: 'Number', range: '0..1',
      en: 'Updated once per display frame while the microphone is on; 0 while it is off, asking, blocked or missing.',
      zh: '麥克風開著的時候，每個畫面更新一次。關著、詢問中、被擋下或不存在的時候是 0。',
    },
    description: [
      {
        en: "[`micLevel`](#micLevel) is a getter that returns this number and, the first time it is read, asks for the microphone. `OAVp5.mic.level` is the number itself, so reading it is safe anywhere: before the user has chosen, with `?oav_mic=click`, or in a library. Start the microphone with [`startMic()`](#startMic) or 🎤, then it moves. How it is measured (decibels, the room as zero, −10 dBFS as 1) is described under [`micLevel`](#micLevel).",
        zh: '[`micLevel`](#micLevel) 是一個 getter，回傳這個數字，而且第一次被讀的時候會去要麥克風。`OAVp5.mic.level` 就是數字本身，所以在哪裡讀都安全：使用者還沒決定之前、設了 `?oav_mic=click`，或是在函式庫裡。用 [`startMic()`](#startMic) 或 🎤 啟動麥克風，它才會動。它怎麼量（分貝、以房間為 0、−10 dBFS 為 1）寫在 [`micLevel`](#micLevel) 底下。',
      },
    ],
    examples: [
      {
        code: `function setup() {
  createCanvas(400, 300);
  startMic();
}

function draw() {
  background(20);
  circle(width / 2, height / 2, 50 + OAVp5.mic.level * 300);
}`,
        caption: { en: 'The loudness circle, written with the raw number instead of micLevel. Allow the microphone and talk.', zh: '音量圓，這次用原始的數字，不用 micLevel。允許麥克風，然後說話。' },
        needs: 'mic',
      },
    ],
    claims: [{ before: 'startMic()', expr: 'OAVp5.mic.level', min: 0, max: 1, needs: 'mic' }],
    related: ['micLevel', 'OAVp5.mic.rms', 'OAVp5.mic.db', 'OAVp5.mic.floor', 'startMic'],
    keywords: { en: ['mic level', 'loudness', 'volume', 'read without starting', 'raw level'], zh: ['麥克風音量', '音量', '大小聲', '讀取但不啟動', '原始音量'] },
  },

  'OAVp5.mic.bass': {
    group: 'mic',
    aliases: ['OAVp5.mic.mid', 'OAVp5.mic.treble'],
    summary: {
      en: 'The same 0 to 1 low, middle and high energy as `bass`, `mid` and `treble`, read without ever turning the microphone on.',
      zh: '跟 `bass`、`mid`、`treble` 一樣的 0 到 1 低音、中音、高音能量，讀它們不會把麥克風打開。',
    },
    value: {
      type: 'Number', range: '0..1',
      en: '`bass` is 20–250 Hz, `mid` 250–2000 Hz and `treble` 2000–8000 Hz, scaled by the sensitivity and held to 1. Updated once per display frame while the microphone is on; 0 otherwise.',
      zh: '`bass` 是 20–250 Hz，`mid` 是 250–2000 Hz，`treble` 是 2000–8000 Hz，乘上靈敏度、最多算到 1。麥克風開著時每個畫面更新一次，其他時候是 0。',
    },
    description: [
      {
        en: "The plain [`bass`](#bass), `mid` and `treble` ask for the microphone when first read, and a sketch that already has a variable of that name keeps it. `OAVp5.mic.bass`, `.mid` and `.treble` are the numbers themselves: always there, never starting anything. They are also the answer when the plain names are taken: on strudel.cc, where Strudel owns `bass`, this is what the card tells you to read.",
        zh: '一般的 [`bass`](#bass)、`mid`、`treble` 第一次被讀的時候會去要麥克風，而且草圖本來就有同名變數的話就由草圖保留。`OAVp5.mic.bass`、`.mid`、`.treble` 就是數字本身：一直都在，也不會啟動任何東西。一般名稱被占用的時候也要讀它們：在 strudel.cc 上 `bass` 是 Strudel 的，卡片會告訴你改讀這個。',
      },
    ],
    notes: [
      { en: 'The three share this entry because they behave the same: only the frequency range differs.', zh: '三個名稱共用這一條，因為它們的行為完全相同，只有頻率範圍不同。' },
    ],
    examples: [
      {
        code: `function setup() {
  createCanvas(400, 300);
  noStroke();
  startMic();
}

function draw() {
  background(20);
  const bands = [OAVp5.mic.bass, OAVp5.mic.mid, OAVp5.mic.treble];
  for (let i = 0; i < 3; i++) {
    fill(255, 80 + i * 70, 120);
    rect(60 + i * 110, height - 20, 80, -20 - bands[i] * 240);
  }
}`,
        caption: { en: 'Three bars for low, middle and high, written with the raw members. Whistle for the right one, hum for the left.', zh: '低、中、高音三根長條，用原始的成員寫。吹口哨看右邊那根，哼低音看左邊那根。' },
        needs: 'mic',
      },
    ],
    claims: [
      { before: 'startMic()', expr: 'OAVp5.mic.bass', min: 0, max: 1, needs: 'mic' },
      { before: 'startMic()', expr: 'OAVp5.mic.treble', min: 0, max: 1, needs: 'mic' },
    ],
    related: ['bass', 'OAVp5.mic.level', 'micSensitivity', 'startMic'],
    keywords: { en: ['mic bass', 'mic mid', 'mic treble', 'frequency bands', 'low mid high', 'read without starting'], zh: ['麥克風低音', '麥克風中音', '麥克風高音', '頻段', '低中高', '讀取但不啟動'] },
  },

  'OAVp5.mic.rms': {
    group: 'mic',
    summary: {
      en: 'The raw loudness of the microphone: a smoothed RMS, 0 to 1, before oav-p5 turns it into the decibel scale of `micLevel`.',
      zh: '麥克風原始的音量：平滑過的 RMS，0 到 1，是 oav-p5 把它換成 `micLevel` 的分貝刻度之前的值。',
    },
    value: {
      type: 'Number', range: '0..1',
      en: 'Updated once per display frame while the microphone is on; 0 when it is off. A speaking voice into a laptop is a small number, in the range 0.01 to 0.05 according to the comment in the code, which is why `micLevel` works in decibels.',
      zh: '麥克風開著的時候，每個畫面更新一次，關著是 0。對著筆電說話是個很小的數字，程式碼裡的註解說大約在 0.01 到 0.05，所以 `micLevel` 才改用分貝來算。',
    },
    description: [
      {
        en: "The root mean square of the samples in the latest frame, smoothed a little. It is linear, the way a waveform is drawn, so it suits a quick check or your own scale. [`micLevel`](#micLevel) is built from it: [`OAVp5.mic.db`](#OAVp5.mic.db) is the same number in dBFS, and [`OAVp5.mic.floor`](#OAVp5.mic.floor) is the room's own noise, in dBFS too.",
        zh: '最新一個畫面裡所有取樣的均方根，稍微平滑過。它是線性的，就像波形畫出來的樣子，所以適合快速檢查，或是用在你自己的刻度上。[`micLevel`](#micLevel) 就是用它算出來的：[`OAVp5.mic.db`](#OAVp5.mic.db) 是同一個數字換成 dBFS，[`OAVp5.mic.floor`](#OAVp5.mic.floor) 是房間本身的底噪，單位也是 dBFS。',
      },
    ],
    tbd: [
      { en: 'Typical values for speech and music depend on the microphone and the room. The 0.01 to 0.05 for a voice is the code comment\'s figure and was not measured here.', zh: '說話和音樂的典型數值要看麥克風和房間。人聲的 0.01 到 0.05 是程式碼註解裡的數字，這裡沒有量過。' },
    ],
    examples: [
      {
        code: `function setup() {
  createCanvas(400, 300);
  startMic();
}

function draw() {
  background(20);
  fill(255);
  text('rms ' + nf(OAVp5.mic.rms, 1, 4), 20, 30);
  rect(20, 60, min(OAVp5.mic.rms * 10, 1) * (width - 40), 20);   // magnified 10 times: a voice is small
}`,
        caption: { en: 'The raw RMS as a number and a bar, magnified ten times because speech is a small number. Allow the microphone and talk.', zh: '原始的 RMS，用數字和長條表示，放大十倍，因為說話的數值很小。允許麥克風，然後說話。' },
        needs: 'mic',
      },
    ],
    claims: [{ before: 'startMic()', expr: 'OAVp5.mic.rms', min: 0, max: 1, needs: 'mic' }],
    related: ['OAVp5.mic.db', 'OAVp5.mic.floor', 'OAVp5.mic.level', 'micLevel'],
    keywords: { en: ['rms', 'raw loudness', 'amplitude', 'signal level', 'linear volume'], zh: ['rms', '原始音量', '振幅', '訊號大小', '線性音量'] },
  },

  'OAVp5.mic.db': {
    group: 'mic',
    summary: {
      en: 'The loudness of the microphone in decibels relative to full scale (dBFS): 0 is as loud as it gets, −100 is silence or the microphone being off.',
      zh: '麥克風的音量，單位是相對滿刻度的分貝（dBFS）：0 是最大聲，−100 是無聲或麥克風關著。',
    },
    value: {
      type: 'Number', range: '-100..0',
      en: '`20 * log10(rms)`, measured from [`OAVp5.mic.rms`](#OAVp5.mic.rms). −100 when the level is below about −100 dB and while the microphone is off. Updated once per display frame.',
      zh: '`20 * log10(rms)`，由 [`OAVp5.mic.rms`](#OAVp5.mic.rms) 算出來。低於約 −100 dB 和麥克風關著的時候是 −100。每個畫面更新一次。',
    },
    description: [
      {
        en: "Decibels are what an ear hears: each 6 dB is twice the amplitude, so a number in dB moves the way loudness feels. [`micLevel`](#micLevel) maps it onto 0 to 1 between the room's noise floor (+6 dB) and −10 dBFS. Use `db` directly when you want your own scale, for example `map(OAVp5.mic.db, -60, -10, 0, 1)`.",
        zh: '分貝就是耳朵聽到的樣子：每增加 6 dB 就是振幅兩倍，所以用 dB 的數字，變化的方式就跟聽起來的大小聲一致。[`micLevel`](#micLevel) 把它對應到 0 到 1，範圍從房間底噪（再加 6 dB）到 −10 dBFS。想用自己的刻度的話，直接用 `db`，例如 `map(OAVp5.mic.db, -60, -10, 0, 1)`。',
      },
    ],
    examples: [
      {
        code: `function setup() {
  createCanvas(400, 300);
  startMic();
}

function draw() {
  background(20);
  fill(255);
  text(nf(OAVp5.mic.db, 1, 1) + ' dBFS', 20, 30);
  const own = constrain(map(OAVp5.mic.db, -60, -10, 0, 1), 0, 1);   // an own scale: -60 dB to -10 dB
  circle(width / 2, height / 2, 50 + own * 300);
}`,
        caption: { en: 'The level in dBFS, and a circle on an own scale from −60 to −10 dB. Allow the microphone and talk.', zh: '用 dBFS 表示的音量，加上一個用自己的刻度（−60 到 −10 dB）的圓。允許麥克風，然後說話。' },
        needs: 'mic',
      },
    ],
    claims: [{ before: 'startMic()', expr: 'OAVp5.mic.db', min: -100, max: 0, needs: 'mic' }],
    related: ['OAVp5.mic.rms', 'OAVp5.mic.floor', 'OAVp5.mic.level', 'micLevel'],
    keywords: { en: ['db', 'decibel', 'dbfs', 'loudness in decibels', 'sound level'], zh: ['分貝', 'db', 'dbfs', '音量分貝', '聲音大小'] },
  },

  'OAVp5.mic.floor': {
    group: 'mic',
    summary: {
      en: 'The room\'s own noise as oav-p5 has measured it, in dBFS: the level that `micLevel` treats as silence (plus 6 dB).',
      zh: 'oav-p5 量到的房間本身的底噪，單位是 dBFS：`micLevel` 把它（再加 6 dB）當成安靜的那個音量。',
    },
    value: {
      type: 'Number', range: '-70..-45',
      en: 'Starts at −60 and is always held between −70 and −45. Updated once per display frame while the microphone is on.',
      zh: '一開始是 −60，永遠限制在 −70 到 −45 之間。麥克風開著時每個畫面更新一次。',
    },
    description: [
      {
        en: "A humming classroom should not read as loud, so [`micLevel`](#micLevel) is measured from the room itself: this floor follows the quietest recent readings. It drops within a second when the room gets quieter and rises at most 1.5 dB a second when it gets noisier, so a voice never becomes the new silence. 6 dB above the floor reads 0 on `micLevel`.",
        zh: '嗡嗡響的教室不該被讀成很大聲，所以 [`micLevel`](#micLevel) 是從房間本身量起的：這個底噪跟著最近最安靜的讀數走。房間變安靜時，一秒內就會降下去，變吵時每秒最多往上爬 1.5 dB，所以人聲不會變成新的安靜。比底噪高 6 dB 的音量，在 `micLevel` 上讀成 0。',
      },
    ],
    notes: [
      { en: 'Stopping the microphone does not reset it: the next start continues from the last floor.', zh: '停掉麥克風不會重設它：下次開始會從上一次的底噪接著走。' },
    ],
    examples: [
      {
        code: `function setup() {
  createCanvas(400, 300);
  startMic();
}

function draw() {
  background(20);
  fill(255);
  text('level ' + nf(OAVp5.mic.db, 1, 1) + ' dBFS', 20, 30);
  text('room noise ' + nf(OAVp5.mic.floor, 1, 1) + ' dBFS', 20, 60);
  text('micLevel ' + nf(OAVp5.mic.level, 1, 2), 20, 90);
}`,
        caption: { en: 'Shows the level, the room\'s noise floor and the resulting micLevel. Keep quiet for a few seconds and watch the floor settle.', zh: '顯示音量、房間的底噪，和算出來的 micLevel。安靜個幾秒，看底噪穩定下來。' },
        needs: 'mic',
      },
    ],
    claims: [{ before: 'startMic()', expr: 'OAVp5.mic.floor', min: -70, max: -45, needs: 'mic' }],
    related: ['micLevel', 'OAVp5.mic.db', 'OAVp5.mic.rms', 'OAVp5.mic.level'],
    keywords: { en: ['noise floor', 'room noise', 'background noise', 'silence level', 'floor'], zh: ['底噪', '房間噪音', '背景噪音', '安靜的音量', '地板值'] },
  },

  'OAVp5.mic.analyzer': {
    group: 'mic',
    summary: {
      en: 'The `AudioAnalyzer` from @openav/audio that listens to the microphone, while the microphone is on; `null` otherwise.',
      zh: '麥克風開著的時候，負責聽麥克風的那個 @openav/audio 的 `AudioAnalyzer`，其他時候是 `null`。',
    },
    value: {
      type: 'AudioAnalyzer | null',
      en: 'Made when the microphone starts and dropped when it stops. It has its own `AudioContext` (`OAVp5.mic.analyzer.ctx`) and the Web Audio `AnalyserNode` it reads from (`OAVp5.mic.analyzer.analyser`).',
      zh: '麥克風啟動時產生，停止時丟掉。它有自己的 `AudioContext`（`OAVp5.mic.analyzer.ctx`），也有它讀取的 Web Audio `AnalyserNode`（`OAVp5.mic.analyzer.analyser`）。',
    },
    description: [
      {
        en: "A way into the audio itself when the 0 to 1 numbers are not enough: read the spectrum of the microphone with the browser's own `OAVp5.mic.analyzer.analyser.getByteFrequencyData(array)`, or connect your own Web Audio nodes to it. oav-p5 updates the analyzer once per frame, so do not call its `update()` yourself.",
        zh: '0 到 1 的數字不夠用的時候，直接進到聲音本身的路：用瀏覽器自己的 `OAVp5.mic.analyzer.analyser.getByteFrequencyData(array)` 讀麥克風的頻譜，或把你自己的 Web Audio 節點接上去。oav-p5 每個畫面會更新一次這個分析器，所以不要自己去呼叫它的 `update()`。',
      },
    ],
    notes: [
      { en: 'This is advanced. Check it is not `null` first, and read it again after `stopMic()` and `startMic()`: it is a new object each time.', zh: '這是進階用法。先確認它不是 `null`，而且 `stopMic()` 再 `startMic()` 之後要重新讀：每次都是新的物件。' },
    ],
    examples: [
      {
        code: `let bins;

function setup() {
  createCanvas(400, 300);
  noStroke();
  startMic();
}

function draw() {
  background(20);
  const a = OAVp5.mic.analyzer;
  if (!a) return;   // the microphone is not on yet
  bins = bins || new Uint8Array(a.analyser.frequencyBinCount);
  a.analyser.getByteFrequencyData(bins);   // the spectrum, 0..255 per frequency bin
  fill(255, 211, 107);
  for (let i = 0; i < 64; i++) {
    const h = bins[i] / 255 * (height - 20);
    rect(20 + i * 5.8, height - 10 - h, 4, h);
  }
}`,
        caption: { en: 'The lowest 64 bins of the microphone\'s spectrum as bars, read straight from the analyser. Whistle and watch the bars move.', zh: '麥克風頻譜最低的 64 個頻格畫成長條，直接從分析器讀。吹口哨，看長條動起來。' },
        needs: 'mic',
      },
    ],
    claims: [{ expr: 'OAVp5.mic.analyzer === null', equals: true }],
    related: ['OAVp5.mic.start', 'OAVp5.mic.state', 'bass', 'micLevel'],
    keywords: { en: ['analyzer', 'spectrum', 'fft', 'AnalyserNode', 'audio context', 'frequency data'], zh: ['分析器', '頻譜', 'fft', 'AnalyserNode', '音訊環境', '頻率資料'] },
  },

  'OAVp5.mic.start': {
    group: 'mic',
    summary: {
      en: 'Turns the microphone on and returns a promise that says whether it worked: the same as `startMic()`.',
      zh: '開啟麥克風，並回傳一個 promise，告訴你有沒有成功：跟 `startMic()` 一樣。',
    },
    params: [],
    returns: { type: 'Promise<Boolean>', en: 'Resolves to `true` once the microphone is on, `false` if it was blocked, is missing, or the `mic` option is `off`.', zh: '麥克風開起來之後 resolve 成 `true`，被擋下、不存在、或 `mic` 選項是 `off` 的時候 resolve 成 `false`。' },
    description: [
      {
        en: "[`startMic()`](#startMic) is this function: see it for what must happen first (a click, `https` or `localhost`). `OAVp5.mic.start()` also lifts the \"stopped by you\" mark that [`stopMic()`](#stopMic) leaves, which is what lets a later read of [`micLevel`](#micLevel) switch the microphone on again.",
        zh: '[`startMic()`](#startMic) 就是這個函式：要先發生什麼（一次點擊、`https` 或 `localhost`）請看那一條。`OAVp5.mic.start()` 也會解除 [`stopMic()`](#stopMic) 留下的「你停掉的」記號，這樣之後再讀 [`micLevel`](#micLevel) 就又能把麥克風打開。',
      },
    ],
    examples: [
      {
        code: `function setup() {
  createCanvas(400, 300);
}

function mousePressed() {
  OAVp5.mic.start().then((ok) => console.log(ok ? 'microphone on' : 'no microphone'));
}

function draw() {
  background(20);
  fill(255);
  text(OAVp5.mic.state === 'on' ? 'listening' : 'click the canvas to start the microphone', 20, 30);
}`,
        caption: { en: 'Nothing happens until you click: then the browser asks, and the text changes when the microphone is on.', zh: '點下去之前什麼都不會發生：點了之後瀏覽器才詢問，麥克風開起來時文字就會改變。' },
        needs: 'mic',
      },
    ],
    related: ['startMic', 'OAVp5.mic.stop', 'OAVp5.mic.state', 'option:mic'],
    keywords: { en: ['mic start', 'start microphone', 'enable microphone', 'turn on microphone'], zh: ['啟動麥克風', '開啟麥克風', '打開麥克風', 'mic start'] },
  },

  'OAVp5.mic.stop': {
    group: 'mic',
    summary: {
      en: 'Turns the microphone off and sets every microphone value back to 0: the same as `stopMic()`.',
      zh: '關掉麥克風，所有麥克風的值都歸零：跟 `stopMic()` 一樣。',
    },
    params: [],
    returns: { type: 'Promise<Boolean>', en: 'Resolves to `false`, the new state of the microphone.', zh: 'resolve 成 `false`，也就是麥克風的新狀態。' },
    description: [
      {
        en: "[`stopMic()`](#stopMic) is this function. It stops the microphone's tracks and closes its audio context, so the browser's \"recording\" indicator goes away, and [`OAVp5.mic.level`](#OAVp5.mic.level), `bass`, `mid`, `treble`, `rms` read 0 and `db` reads −100. After it, only [`OAVp5.mic.start()`](#OAVp5.mic.start) or 🎤 turns the microphone back on: reading `micLevel` does not.",
        zh: '[`stopMic()`](#stopMic) 就是這個函式。它停掉麥克風的音軌並關掉它的音訊環境，所以瀏覽器上「正在錄音」的指示會消失，[`OAVp5.mic.level`](#OAVp5.mic.level)、`bass`、`mid`、`treble`、`rms` 都讀到 0，`db` 讀到 −100。之後只有 [`OAVp5.mic.start()`](#OAVp5.mic.start) 或 🎤 能再把麥克風打開：讀 `micLevel` 不行。',
      },
    ],
    examples: [
      {
        code: `function setup() {
  createCanvas(400, 300);
  startMic();
}

function mousePressed() {
  OAVp5.mic.stop();   // the browser's recording indicator goes away
}

function draw() {
  background(20);
  fill(255);
  text('microphone: ' + OAVp5.mic.state + ' (click the canvas to stop it)', 20, 30);
  circle(width / 2, height / 2, 50 + OAVp5.mic.level * 300);
}`,
        caption: { en: 'Click the canvas: the microphone stops, the state says "off" and the circle drops to its smallest size.', zh: '點一下畫布：麥克風停止，狀態變成 "off"，圓縮到最小。' },
        needs: 'mic',
      },
    ],
    related: ['stopMic', 'OAVp5.mic.start', 'OAVp5.mic.state', 'micIsOn'],
    keywords: { en: ['mic stop', 'stop microphone', 'mute', 'turn off microphone', 'disable microphone'], zh: ['停止麥克風', '關閉麥克風', '靜音', 'mic stop'] },
  },

  'OAVp5.mic.on': {
    group: 'mic',
    summary: {
      en: 'Listens to a microphone event (`\'beat\'`, `\'kick\'`, `\'snare\'` or `\'hat\'`) without defining a global function, and returns a function that stops listening.',
      zh: '監聽麥克風的事件（`\'beat\'`、`\'kick\'`、`\'snare\'` 或 `\'hat\'`），不必定義全域函式，並回傳一個停止監聽的函式。',
    },
    params: [
      { name: 'name', type: 'String', en: "`'beat'`, `'kick'`, `'snare'` or `'hat'`. Anything else throws an error that lists them.", zh: "`'beat'`、`'kick'`、`'snare'` 或 `'hat'`。其他的名稱會丟出一個錯誤，並列出這幾個。" },
      { name: 'fn', type: 'Function', en: 'Called as `fn(level)` with how strong the hit was, 0 to 1: the same number [`beatDetected(level)`](#beatDetected) and [`kickDetected(level)`](#kickDetected) get.', zh: '用 `fn(level)` 的方式呼叫，帶著這一下有多強，0 到 1：跟 [`beatDetected(level)`](#beatDetected) 和 [`kickDetected(level)`](#kickDetected) 拿到的數字一樣。' },
    ],
    returns: { type: 'Function', en: 'A function that takes `fn` off again: `const off = OAVp5.mic.on(…); off();`.', zh: '一個把 `fn` 取消的函式：`const off = OAVp5.mic.on(…); off();`。' },
    description: [
      {
        en: "The listener version of [`beatDetected()`](#beatDetected), [`kickDetected()`](#kickDetected), `snareDetected()` and `hatDetected()`: any number of them, added and removed while the sketch runs, with no global names taken. An error inside `fn` shows in the console and on a card.",
        zh: '[`beatDetected()`](#beatDetected)、[`kickDetected()`](#kickDetected)、`snareDetected()`、`hatDetected()` 的監聽者版本：想要幾個都行，草圖在跑的時候可以加也可以拿掉，也不占用任何全域名稱。`fn` 裡面出錯會顯示在 console 和卡片上。',
      },
    ],
    needs: {
      en: "Listening does not turn the microphone on: call [`startMic()`](#startMic), press 🎤, or read [`micLevel`](#micLevel) too, or nothing will ever fire. (Defining the global `beatDetected()` is different: oav-p5 sees that function and starts the microphone at the first click.) These events come from the microphone only, not from the drum machine.",
      zh: '監聽並不會把麥克風打開：要呼叫 [`startMic()`](#startMic)、按 🎤，或是也讀一下 [`micLevel`](#micLevel)，不然什麼事件都不會發生。（定義全域的 `beatDetected()` 就不一樣：oav-p5 看到那個函式，會在第一次點擊時啟動麥克風。）這些事件只來自麥克風，不來自鼓機。',
    },
    notes: [
      { en: 'When the drum machine plays, the global `beatDetected()`, `kickDetected()` and the others are also called for its hits. A listener added with `OAVp5.mic.on()` hears the microphone only.', zh: '鼓機在播的時候，全域的 `beatDetected()`、`kickDetected()` 這些也會為鼓機的每一下被呼叫。用 `OAVp5.mic.on()` 加的監聽者只聽得到麥克風。' },
    ],
    examples: [
      {
        code: `let flash = 0;

function setup() {
  createCanvas(400, 300);
  startMic();
  OAVp5.mic.on('beat', (level) => { flash = 0.4 + level * 0.6; });   // louder beat, brighter flash
}

function draw() {
  background(20 + flash * 200);
  flash *= 0.9;
}`,
        caption: { en: 'A flash on every beat the microphone hears, brighter for a louder one. Clap or tap the desk.', zh: '麥克風每聽到一個拍子就閃一下，拍子越大聲閃得越亮。拍手或敲桌子。' },
        needs: 'mic',
      },
    ],
    claims: [{ expr: "(() => { try { OAVp5.mic.on('nope', () => {}); return 'no error'; } catch (e) { return e.message.includes('unknown mic event'); } })()", equals: true }],
    related: ['beatDetected', 'kickDetected', 'OAVp5.on', 'beat', 'startMic'],
    keywords: { en: ['mic events', 'beat listener', 'kick listener', 'subscribe', 'onset', 'callback without global'], zh: ['麥克風事件', '拍子監聽', '大鼓監聽', '訂閱', '節拍偵測', '不用全域函式'] },
  },
};
