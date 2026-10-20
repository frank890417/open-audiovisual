// oav-p5 reference: reading a MIDI controller like the mouse, and the events it sends.
// Read by tools/build-reference.mjs (see AGENTS.md, "Documenting a public name"). Sketch examples leave out the loader line.
//
// No MIDI hardware is needed to try any of this: the 🎹 button (bottom right) opens an on-screen controller, and a phone can
// be the controller too. All three arrive as the same MIDI bytes, so a sketch cannot tell them apart.

const PLAY = {
  en: 'Plug in a controller, or press 🎹 (bottom right) and use the on-screen one.',
  zh: '接上控制器，或按右下角的 🎹 用螢幕上的控制器。',
};

export default {
  knob1: {
    group: 'midi',
    aliases: ['knob2', 'knob3', 'knob4', 'knob5', 'knob6', 'knob7', 'knob8'],
    summary: {
      en: 'The position of a controller knob, from 0 to 1: `knob1` is the first knob, `knob2` the second, up to `knob8`.',
      zh: '控制器上旋鈕的位置，從 0 到 1：`knob1` 是第一顆旋鈕，`knob2` 是第二顆，一直到 `knob8`。',
    },
    value: {
      type: 'Number', range: '0..1',
      en: 'Changes when the knob moves, not once per frame; the sketch just reads the latest value. 0 until the knob has been turned.',
      zh: '旋鈕轉動的時候才會改變，不是每個畫面一次。草圖只要讀最新的值。旋鈕還沒轉過之前是 0。',
    },
    description: [
      {
        en: 'Read it in `draw()` the way you read `mouseX`: `background(knob1 * 255)`. Knobs are numbered the way they are printed on the controller, so knob 1 is knob 1 on any controller OAV has a [profile](/controllers/) for: the MiniLab 3\'s first knob is CC 74, the LPD8\'s is CC 70. The sketch never needs to know a CC number.',
        zh: '像讀 `mouseX` 一樣在 `draw()` 裡讀：`background(knob1 * 255)`。旋鈕的編號照控制器上印的順序，所以在 OAV 有[設定檔](/zh/controllers/)的任何控制器上，旋鈕 1 就是旋鈕 1：MiniLab 3 的第一顆是 CC 74，LPD8 的是 CC 70。草圖完全不用知道 CC 號碼。',
      },
      {
        en: 'On a controller OAV has no profile for, the first knob you turn becomes `knob1`, the next one `knob2`, and so on, in the order you turn them. Past eight, use [`knob(n)`](#knob).',
        zh: '遇到 OAV 沒有設定檔的控制器，你轉的第一顆旋鈕就變成 `knob1`，下一顆是 `knob2`，依你轉的順序往下排。超過八顆就用 [`knob(n)`](#knob)。',
      },
    ],
    needs: {
      en: 'Nothing to call. With the default `hardware=auto`, oav-p5 asks the browser for Web MIDI as soon as it loads, whatever the sketch reads (Chrome, Edge and Firefox have it; Safari and iPad do not: use 🎹 or a phone there). Reading a knob also tells oav-p5 the sketch plays from MIDI, so when Web MIDI is missing or refused a card beside the 🎹 says so; a sketch that uses none of this never sees that card. [`?oav_hardware=click`](#option-hardware) waits for the 🎹 panel instead.',
      zh: '不用呼叫任何東西。預設的 `hardware=auto` 下，oav-p5 一載入就會向瀏覽器要 Web MIDI，不管草圖有沒有讀東西（Chrome、Edge、Firefox 有。Safari 和 iPad 沒有，那裡改用 🎹 或手機）。讀旋鈕還會讓 oav-p5 知道這份草圖要用 MIDI 玩，所以 Web MIDI 不存在或被拒絕的時候，🎹 旁邊會有一張卡片說明。完全沒用到這些的草圖不會看到那張卡片。[`?oav_hardware=click`](#option-hardware) 則是等你按 🎹 面板裡的按鈕才去要。',
    },
    notes: [
      {
        en: 'A sketch that already has its own `knob1` (a `let`, a function) keeps it, and a card beside the 🎹 says what to read instead (`knob(1)`).',
        zh: '草圖如果本來就有自己的 `knob1`（`let`、函式都算），就由草圖保留，🎹 旁邊會有一張卡片說明改讀什麼（`knob(1)`）。',
      },
      {
        en: 'With OP Configurator, knobs also drive the OPC sliders in the order they are declared. A knob the sketch reads itself stays the sketch\'s: that slider no longer follows it.',
        zh: '搭配 OP Configurator 時，旋鈕也會依宣告順序推動 OPC 的滑桿。草圖自己有讀的那顆旋鈕就歸草圖：對應的滑桿不再跟著動。',
      },
    ],
    examples: [
      {
        code: `function setup() {
  createCanvas(400, 300);
}

function draw() {
  background(knob1 * 255);   // knob 1 sets the brightness
}`,
        caption: { en: 'Turn knob 1 and the whole canvas goes from black to white. ' + PLAY.en, zh: '轉旋鈕 1，整個畫布從黑變到白。' + PLAY.zh },
      },
      {
        code: `function setup() {
  createCanvas(400, 300);
  colorMode(HSB, 1);
}

function draw() {
  background(0.65, 0.5, 0.15);
  fill(knob2, 0.8, 1);                        // knob 2: colour
  circle(width / 2, height / 2, 40 + knob1 * 300);   // knob 1: size
}`,
        caption: { en: 'Two knobs, two jobs: size and colour.', zh: '兩顆旋鈕，兩件事：大小與顏色。' },
      },
    ],
    claims: [
      { before: "midi.input([0xB0, 74, 127], 'screen')", expr: 'knob1', equals: 1 },
      { before: "midi.input([0xB0, 74, 0], 'screen')", expr: 'knob1', equals: 0 },
    ],
    related: ['knob', 'fader1', 'pad1', 'knobMoved', 'noteIsDown'],
    keywords: { en: ['knob', 'dial', 'rotary', 'controller', 'cc', 'control change', 'midi', 'potentiometer'], zh: ['旋鈕', '控制器', '轉鈕', 'midi', '控制訊號'] },
  },

  fader1: {
    group: 'midi',
    aliases: ['fader2', 'fader3', 'fader4', 'fader5', 'fader6', 'fader7', 'fader8'],
    summary: {
      en: 'The position of a controller fader (slider), from 0 to 1: `fader1` is the first fader, up to `fader8`.',
      zh: '控制器上推桿（滑桿）的位置，從 0 到 1：`fader1` 是第一支推桿，一直到 `fader8`。',
    },
    value: {
      type: 'Number', range: '0..1',
      en: 'Changes when the fader moves; 0 until it has moved.',
      zh: '推桿移動的時候才會改變。還沒推過之前是 0。',
    },
    description: [
      {
        en: 'Works exactly like [`knob1`](#knob1), for the controller\'s faders, numbered in the order the controller\'s profile lists them (as printed on the device). A controller with only four faders, like the MiniLab 3, has `fader1` to `fader4`.',
        zh: '用法跟 [`knob1`](#knob1) 完全一樣，只是對應控制器上的推桿，編號依控制器設定檔列出的順序（也就是機器上印的順序）。只有四支推桿的控制器（像 MiniLab 3）就只有 `fader1` 到 `fader4`。',
      },
    ],
    needs: {
      en: 'Nothing to call. Web MIDI is asked for at load, exactly as for a knob ([`knob1`](#knob1)); reading a fader also makes a missing or refused Web MIDI show as a card.',
      zh: '不用呼叫任何東西。Web MIDI 在載入時就會去要，跟旋鈕一樣（見 [`knob1`](#knob1)）。讀推桿還會讓「Web MIDI 不存在或被拒絕」顯示成一張卡片。',
    },
    examples: [
      {
        code: `function setup() {
  createCanvas(400, 300);
}

function draw() {
  background(20);
  fill(255);
  rect(40, height - 40, fader1 * (width - 80), 24);   // fader 1 is a level bar
}`,
        caption: { en: 'A bar that follows fader 1. ' + PLAY.en, zh: '一條跟著推桿 1 走的橫條。' + PLAY.zh },
      },
    ],
    claims: [{ before: "midi.input([0xB0, 82, 127], 'screen')", expr: 'fader1', equals: 1 }],
    related: ['fader', 'knob1', 'faderMoved'],
    keywords: { en: ['fader', 'slider', 'controller', 'midi'], zh: ['推桿', '滑桿', '控制器', 'midi'] },
  },

  pad1: {
    group: 'midi',
    aliases: ['pad2', 'pad3', 'pad4', 'pad5', 'pad6', 'pad7', 'pad8', 'pad9', 'pad10', 'pad11', 'pad12', 'pad13', 'pad14', 'pad15', 'pad16'],
    summary: {
      en: 'How hard a drum pad is pressed, from 0 to 1: `pad1` is the first pad, up to `pad16`; 0 when it is let go.',
      zh: '打擊墊被按得多用力，從 0 到 1：`pad1` 是第一個墊子，一直到 `pad16`。放開就是 0。',
    },
    value: {
      type: 'Number', range: '0..1',
      en: 'The velocity of the hit while the pad is held (1 is as hard as the controller sends), and 0 as soon as it is released.',
      zh: '墊子按著的時候是這一下的力道（1 是控制器能送出的最大力道），一放開就變成 0。',
    },
    description: [
      {
        en: 'Read it like a held mouse button that also knows how hard: `if (pad1 > 0) fill(255, 90, 31)`. Pads are numbered in the order the controller\'s profile lists them. To react once per hit rather than ask every frame, define [`padPressed()`](#padPressed).',
        zh: '像一個知道力道的滑鼠按鍵那樣讀：`if (pad1 > 0) fill(255, 90, 31)`。墊子編號依控制器設定檔列出的順序。想「每打一下反應一次」而不是每個畫面都問，就定義 [`padPressed()`](#padPressed)。',
      },
    ],
    needs: {
      en: 'Nothing to call. Web MIDI is asked for at load, exactly as for a knob ([`knob1`](#knob1)); reading a pad also makes a missing or refused Web MIDI show as a card.',
      zh: '不用呼叫任何東西。Web MIDI 在載入時就會去要，跟旋鈕一樣（見 [`knob1`](#knob1)）。讀墊子還會讓「Web MIDI 不存在或被拒絕」顯示成一張卡片。',
    },
    examples: [
      {
        code: `function setup() {
  createCanvas(400, 300);
}

function draw() {
  background(20);
  fill(255, 90, 31);
  circle(width / 2, height / 2, 40 + pad1 * 260);   // swells while pad 1 is held
}`,
        caption: { en: 'The circle swells while pad 1 is down, more for a harder hit. On the on-screen controller, click the first pad.', zh: '按著墊子 1 的時候圓會脹大，打得越用力越大。用螢幕上的控制器就點第一個墊子。' },
      },
    ],
    claims: [
      { before: "midi.input([0x99, 36, 127], 'screen')", expr: 'pad1', equals: 1 },
      { before: "midi.input([0x89, 36, 0], 'screen')", expr: 'pad1', equals: 0 },
    ],
    related: ['pad', 'padPressed', 'padReleased', 'knob1'],
    keywords: { en: ['pad', 'drum pad', 'button', 'velocity', 'trigger', 'controller'], zh: ['打擊墊', '墊子', '按鍵', '力道', '觸發', '控制器'] },
  },

  knob: {
    group: 'midi',
    summary: { en: 'Returns the position of knob number `n`, from 0 to 1: the same as `knob1` to `knob8`, for any `n`.', zh: '回傳第 `n` 顆旋鈕的位置，0 到 1：跟 `knob1` 到 `knob8` 一樣，但 `n` 可以是任何數字。' },
    params: [{ name: 'n', type: 'Number', en: 'Which knob, counting from 1 (as printed on the controller).', zh: '第幾顆旋鈕，從 1 開始算（照控制器上印的）。' }],
    returns: { type: 'Number', en: 'The knob\'s position, 0..1; 0 until it has been turned.', zh: '旋鈕的位置，0..1。還沒轉過之前是 0。' },
    description: [
      {
        en: 'Use it when the number of the knob is a variable: `for (let i = 1; i <= 16; i++) bar(i, knob(i));`. It also works in a sketch that has its own `knob1`, which oav-p5 then leaves alone.',
        zh: '旋鈕的編號是變數的時候用它：`for (let i = 1; i <= 16; i++) bar(i, knob(i));`。草圖自己已經有 `knob1` 的話也可以用，oav-p5 不會去動那個名稱。',
      },
    ],
    examples: [
      {
        code: `function setup() {
  createCanvas(400, 300);
  noStroke();
}

function draw() {
  background(20);
  fill(255);
  for (let i = 1; i <= 8; i++) {
    rect(i * 44 - 20, height - 20, 30, -10 - knob(i) * 250);   // one bar per knob
  }
}`,
        caption: { en: 'Eight bars, one per knob. Knobs you have not touched stay at the bottom.', zh: '八根長條，一顆旋鈕一根。還沒碰過的旋鈕停在最低。' },
      },
    ],
    related: ['knob1', 'fader', 'pad'],
    keywords: { en: ['knob', 'dial', 'number', 'index', 'controller'], zh: ['旋鈕', '編號', '控制器'] },
  },

  fader: {
    group: 'midi',
    summary: { en: 'Returns the position of fader number `n`, from 0 to 1: the same as `fader1` to `fader8`, for any `n`.', zh: '回傳第 `n` 支推桿的位置，0 到 1：跟 `fader1` 到 `fader8` 一樣，但 `n` 可以是任何數字。' },
    params: [{ name: 'n', type: 'Number', en: 'Which fader, counting from 1.', zh: '第幾支推桿，從 1 開始算。' }],
    returns: { type: 'Number', en: 'The fader\'s position, 0..1; 0 until it has moved.', zh: '推桿的位置，0..1。還沒推過之前是 0。' },
    description: [
      { en: 'The function form of [`fader1`](#fader1), for when the fader\'s number is a variable.', zh: '[`fader1`](#fader1) 的函式版本，推桿的編號是變數的時候用。' },
    ],
    examples: [
      {
        code: `function setup() {
  createCanvas(400, 300);
}

function draw() {
  background(20);
  fill(255);
  for (let i = 1; i <= 4; i++) circle(i * 80, height - 40 - fader(i) * 200, 30);
}`,
        caption: { en: 'Four dots that rise with four faders.', zh: '四個點，跟著四支推桿升高。' },
      },
    ],
    related: ['fader1', 'knob', 'pad'],
    keywords: { en: ['fader', 'slider', 'number', 'index'], zh: ['推桿', '滑桿', '編號'] },
  },

  pad: {
    group: 'midi',
    summary: { en: 'Returns how hard pad number `n` is pressed, 0 to 1: the same as `pad1` to `pad16`, for any `n`.', zh: '回傳第 `n` 個打擊墊被按得多用力，0 到 1：跟 `pad1` 到 `pad16` 一樣，但 `n` 可以是任何數字。' },
    params: [{ name: 'n', type: 'Number', en: 'Which pad, counting from 1.', zh: '第幾個墊子，從 1 開始算。' }],
    returns: { type: 'Number', en: 'The velocity while the pad is held (0..1), 0 when it is released.', zh: '墊子按著的時候是力道（0..1），放開是 0。' },
    description: [
      { en: 'The function form of [`pad1`](#pad1).', zh: '[`pad1`](#pad1) 的函式版本。' },
    ],
    examples: [
      {
        code: `function setup() {
  createCanvas(400, 300);
  noStroke();
}

function draw() {
  background(20);
  for (let i = 1; i <= 8; i++) {
    fill(255, 90, 31, 60 + pad(i) * 195);
    square(20 + ((i - 1) % 4) * 92, 40 + floor((i - 1) / 4) * 110, 80);
  }
}`,
        caption: { en: 'A grid of eight squares that light up under the pads you hit.', zh: '八個方塊排成格子，你打哪個墊子，哪個方塊就亮起來。' },
      },
    ],
    related: ['pad1', 'knob', 'padPressed'],
    keywords: { en: ['pad', 'drum pad', 'index', 'velocity'], zh: ['打擊墊', '墊子', '編號', '力道'] },
  },

  note: {
    group: 'midi',
    summary: { en: 'The MIDI number (0 to 127) of the last key pressed.', zh: '最後被按下的那個鍵的 MIDI 號碼（0 到 127）。' },
    value: {
      type: 'Number', range: '0..127',
      en: 'Set when a key goes down and kept after it is released; 0 before any key has been pressed.',
      zh: '鍵按下的時候設定，放開之後也保留。還沒有按過任何鍵之前是 0。',
    },
    description: [
      {
        en: 'Middle C is 60, A4 is 69. [`noteName(note)`](#noteName) writes the number as a name (`60` → `\'C4\'`) and [`noteFreq(note)`](#noteFreq) as a frequency in Hz. [`velocity`](#velocity) says how hard it was pressed. For every key, not just the last, define [`notePressed()`](#notePressed).',
        zh: '中央 C 是 60，A4 是 69。[`noteName(note)`](#noteName) 把號碼寫成音名（`60` → `\'C4\'`），[`noteFreq(note)`](#noteFreq) 換成赫茲。[`velocity`](#velocity) 告訴你按得多用力。想要每個鍵都知道、不只最後一個，就定義 [`notePressed()`](#notePressed)。',
      },
    ],
    needs: {
      en: 'Nothing to call. Web MIDI is asked for at load (see [`knob1`](#knob1)). Unlike a knob, merely reading `note` does not tell oav-p5 the sketch plays from MIDI: defining [`notePressed()`](#notePressed) or reading a knob or pad does, which is what makes a missing or refused Web MIDI show as a card. 🎹 and a phone always work.',
      zh: '不用呼叫任何東西。Web MIDI 在載入時就會去要（見 [`knob1`](#knob1)）。跟旋鈕不一樣，單單讀 `note` 並不會讓 oav-p5 知道草圖要用 MIDI 玩：定義 [`notePressed()`](#notePressed)，或讀旋鈕、墊子才會，也才會讓「Web MIDI 不存在或被拒絕」顯示成卡片。🎹 和手機隨時都能用。',
    },
    notes: [
      {
        en: 'A sketch with its own `note` (a `let note`, a function) keeps it; read `midi.last.note` instead. oav-p5 says so in a card the first time.',
        zh: '草圖如果自己有 `note`（`let note`、函式都算），就由草圖保留。改讀 `midi.last.note`。oav-p5 第一次會用卡片告訴你。',
      },
    ],
    examples: [
      {
        code: `function setup() {
  createCanvas(400, 300);
  textAlign(CENTER, CENTER);
  textSize(64);
}

function draw() {
  background(20);
  fill(255);
  text(noteName(note), width / 2, height / 2);   // the last key, as a name
}`,
        caption: { en: 'Shows the name of the last key you played. ' + PLAY.en, zh: '顯示你最後彈的那個鍵的名字。' + PLAY.zh },
      },
    ],
    claims: [{ before: "midi.input([0x90, 60, 127], 'screen')", expr: 'note', equals: 60 }],
    related: ['velocity', 'noteIsPressed', 'notePressed', 'noteName'],
    keywords: { en: ['note', 'key', 'pitch', 'keyboard', 'midi number'], zh: ['音符', '琴鍵', '音高', '鍵盤', 'midi 號碼'] },
  },

  velocity: {
    group: 'midi',
    summary: { en: 'How hard the last key was pressed, from 0 to 1.', zh: '最後那個鍵被按得多用力，從 0 到 1。' },
    value: {
      type: 'Number', range: '0..1',
      en: 'Set together with [`note`](#note) when a key goes down; kept after release; 0 before any key.',
      zh: '跟 [`note`](#note) 一起在鍵按下的時候設定。放開之後保留。還沒按過任何鍵之前是 0。',
    },
    description: [
      { en: 'MIDI sends velocity as 0 to 127; oav-p5 hands you it divided by 127, so 1 is the hardest hit the controller can send.', zh: 'MIDI 的力道是 0 到 127。oav-p5 給你的是除以 127 之後的值，所以 1 就是控制器能送出的最大力道。' },
    ],
    notes: [{ en: 'A sketch with its own `velocity` keeps it; read `midi.last.value`.', zh: '草圖自己有 `velocity` 的話就由草圖保留。改讀 `midi.last.value`。' }],
    examples: [
      {
        code: `function setup() {
  createCanvas(400, 300);
}

function draw() {
  background(20);
  fill(255, 90, 31);
  circle(width / 2, height / 2, 20 + velocity * 300);   // a harder key makes a bigger circle
}`,
        caption: { en: 'The circle stays at the size of the last key\'s velocity.', zh: '圓的大小停在最後那個鍵的力道上。' },
      },
    ],
    claims: [{ before: "midi.input([0x90, 60, 127], 'screen')", expr: 'velocity', equals: 1 }],
    related: ['note', 'notePressed', 'noteIsPressed'],
    keywords: { en: ['velocity', 'force', 'how hard', 'dynamics'], zh: ['力道', '力度', '多用力', '強弱'] },
  },

  noteIsPressed: {
    group: 'midi',
    summary: { en: 'True while at least one key is held down.', zh: '只要有任何一個鍵按著，就是 true。' },
    value: { type: 'Boolean', en: 'Like `keyIsPressed`, for MIDI keys. False when nothing is held.', zh: '像 `keyIsPressed`，但是對 MIDI 琴鍵。沒有任何鍵按著就是 false。' },
    description: [
      { en: 'To ask about one particular key, use [`noteIsDown()`](#noteIsDown). `midi.held` lists every key held right now, lowest first.', zh: '想問某一個特定的鍵，用 [`noteIsDown()`](#noteIsDown)。`midi.held` 列出現在按著的所有鍵，由低到高。' },
    ],
    examples: [
      {
        code: `function setup() {
  createCanvas(400, 300);
}

function draw() {
  background(noteIsPressed ? 90 : 20);   // lighter while any key is down
}`,
        caption: { en: 'The background lightens while any key is held.', zh: '只要有鍵按著，背景就變亮。' },
      },
    ],
    claims: [{ before: "midi.input([0x90, 60, 100], 'screen')", expr: 'noteIsPressed', equals: true }],
    related: ['noteIsDown', 'note', 'notePressed'],
    keywords: { en: ['key pressed', 'held', 'any key', 'keyIsPressed'], zh: ['按著', '任一個鍵', '琴鍵'] },
  },

  noteIsDown: {
    group: 'midi',
    summary: { en: 'True while the key `n` (a MIDI number or a name like `\'C4\'`) is held down.', zh: '鍵 `n`（MIDI 號碼，或像 `\'C4\'` 這樣的音名）按著的時候是 true。' },
    params: [{ name: 'n', type: 'Number | String', en: 'The key: a MIDI number (60) or a note name (`\'C4\'`, `\'c#4\'`, `\'Db3\'`).', zh: '哪個鍵：MIDI 號碼（60）或音名（`\'C4\'`、`\'c#4\'`、`\'Db3\'`）。' }],
    returns: { type: 'Boolean', en: 'True if that key is down right now.', zh: '那個鍵現在按著就是 true。' },
    description: [
      {
        en: 'The MIDI version of `keyIsDown()`. `noteIsDown(\'C4\')` is the same as `noteIsDown(60)`: C4 is middle C. A name that is not a note (`\'H4\'`, `\'C-2\'`) stops the sketch with a one-line card saying how to write it.',
        zh: '就是 MIDI 版的 `keyIsDown()`。`noteIsDown(\'C4\')` 跟 `noteIsDown(60)` 一樣：C4 是中央 C。不是音符的名稱（`\'H4\'`、`\'C-2\'`）會讓草圖停下來，並用一張卡片告訴你怎麼寫。',
      },
    ],
    examples: [
      {
        code: `function setup() {
  createCanvas(400, 300);
}

function draw() {
  background(20);
  fill(noteIsDown('C4') ? color(255, 211, 107) : 80);
  circle(width / 2, height / 2, 140);   // lights up while middle C is held
}`,
        caption: { en: 'A circle that lights up only while C4 (middle C) is held. On the on-screen keyboard, middle C is the C labelled C4.', zh: '只有按著 C4（中央 C）的時候才亮的圓。螢幕鍵盤上，標著 C4 的那個 C 就是中央 C。' },
      },
    ],
    claims: [
      { before: "midi.input([0x90, 60, 127], 'screen')", expr: "noteIsDown('C4')", equals: true },
      { before: "midi.input([0x80, 60, 0], 'screen')", expr: "noteIsDown(60)", equals: false },
    ],
    related: ['noteIsPressed', 'noteNumber', 'notePressed'],
    keywords: { en: ['key down', 'held', 'keyIsDown', 'note name', 'C4'], zh: ['按著', '琴鍵', '音名', 'keyIsDown'] },
  },

  notePressed: {
    group: 'midi',
    summary: { en: 'You define this function; oav-p5 calls it each time a key (or a pad) goes down.', zh: '你來定義這個函式。每當有一個鍵（或打擊墊）按下，oav-p5 就呼叫它。' },
    params: [
      { name: 'note', type: 'Number', en: 'The MIDI number of the key (60 is middle C). [`noteName(note)`](#noteName) turns it into a name.', zh: '這個鍵的 MIDI 號碼（60 是中央 C）。[`noteName(note)`](#noteName) 可以把它轉成音名。' },
      { name: 'velocity', type: 'Number', en: 'How hard, 0..1.', zh: '多用力，0..1。' },
    ],
    description: [
      {
        en: 'Declare it the way you declare `keyPressed()`:\n\n```js\nfunction notePressed(note, velocity) {\n  // a key went down\n}\n```\n\nIt is called once per key, with the key and how hard. A pad also calls it, unless the sketch defines [`padPressed()`](#padPressed).',
        zh: '用宣告 `keyPressed()` 的方式宣告它：\n\n```js\nfunction notePressed(note, velocity) {\n  // 有一個鍵按下去了\n}\n```\n\n每個鍵呼叫一次，帶著是哪個鍵、多用力。打擊墊也會呼叫它，除非草圖有定義 [`padPressed()`](#padPressed)。',
      },
    ],
    needs: {
      en: 'Defining it is enough: oav-p5 calls it from every source, and if Web MIDI is missing or refused it says so in a card beside the 🎹 (Web MIDI itself is asked for at load, see [`knob1`](#knob1)). Keys from 🎹 and from a phone call it too.',
      zh: '只要定義了它就夠了：不管是哪一種來源，oav-p5 都會呼叫它。Web MIDI 不存在或被拒絕的時候，🎹 旁邊會有一張卡片說明（Web MIDI 本身在載入時就會去要，見 [`knob1`](#knob1)）。🎹 和手機上彈的鍵也會呼叫它。',
    },
    notes: [
      { en: 'An error inside it does not stop the music: the next key still plays, and the message shows in the console and on a card beside the 🎹, with the file and line.', zh: '裡面出錯不會讓音樂停掉：下一個鍵還是照樣處理，錯誤訊息會出現在 console，也會在 🎹 旁邊的卡片上顯示檔案與行號。' },
    ],
    examples: [
      {
        code: `function setup() {
  createCanvas(400, 300);
  background(20);
  noStroke();
}

function notePressed(note, velocity) {
  fill(random(255), random(255), random(255), 200);
  circle(map(note, 36, 96, 20, width - 20), height / 2, 10 + velocity * 120);
}`,
        caption: { en: 'Every key leaves a circle: low keys on the left, high on the right, harder keys bigger.', zh: '每個鍵留下一個圓：低音在左、高音在右，按得越用力圓越大。' },
      },
    ],
    related: ['noteReleased', 'padPressed', 'noteOn', 'note', 'noteName'],
    keywords: { en: ['key pressed', 'note on', 'callback', 'event', 'keyboard'], zh: ['按下', '琴鍵', '事件', '回呼', '鍵盤'] },
  },

  noteReleased: {
    group: 'midi',
    summary: { en: 'You define this function; oav-p5 calls it each time a key (or a pad) is let go.', zh: '你來定義這個函式。每當有一個鍵（或打擊墊）放開，oav-p5 就呼叫它。' },
    params: [{ name: 'note', type: 'Number', en: 'The MIDI number of the key that was released.', zh: '被放開的那個鍵的 MIDI 號碼。' }],
    description: [
      {
        en: 'The partner of [`notePressed()`](#notePressed), like `keyReleased()` to `keyPressed()`:\n\n```js\nfunction noteReleased(note) {\n  // a key came up\n}\n```',
        zh: '[`notePressed()`](#notePressed) 的另一半，就像 `keyReleased()` 之於 `keyPressed()`：\n\n```js\nfunction noteReleased(note) {\n  // 有一個鍵放開了\n}\n```',
      },
    ],
    examples: [
      {
        code: `let held = {};

function setup() {
  createCanvas(400, 300);
}

function notePressed(note) { held[note] = millis(); }
function noteReleased(note) { delete held[note]; }

function draw() {
  background(20);
  fill(255);
  text(Object.keys(held).map((n) => noteName(+n)).join('  '), 20, 40);   // the keys down now
}`,
        caption: { en: 'Lists the names of the keys that are down right now.', zh: '列出現在按著的那些鍵的名字。' },
      },
    ],
    related: ['notePressed', 'padReleased', 'noteOff', 'noteIsDown'],
    keywords: { en: ['key released', 'note off', 'callback', 'event'], zh: ['放開', '琴鍵', '事件', '回呼'] },
  },

  knobMoved: {
    group: 'midi',
    summary: { en: 'You define this function; oav-p5 calls it whenever a knob moves.', zh: '你來定義這個函式。旋鈕一轉動，oav-p5 就呼叫它。' },
    params: [
      { name: 'n', type: 'Number', en: 'Which knob (1 is the first, as printed on the controller).', zh: '哪一顆旋鈕（1 是第一顆，照控制器上印的）。' },
      { name: 'value', type: 'Number', en: 'Where it is now, 0..1.', zh: '現在的位置，0..1。' },
    ],
    description: [
      {
        en: 'Like `mouseMoved()` for knobs:\n\n```js\nfunction knobMoved(n, value) {\n  // knob n is now at value\n}\n```\n\nIt is called for every step the knob sends, so many times per second while it turns. To read a knob once a frame, use [`knob1`](#knob1) instead.',
        zh: '就像旋鈕版的 `mouseMoved()`：\n\n```js\nfunction knobMoved(n, value) {\n  // 旋鈕 n 現在在 value\n}\n```\n\n旋鈕每送出一格就呼叫一次，轉動的時候每秒會呼叫很多次。想要每個畫面讀一次，就改用 [`knob1`](#knob1)。',
      },
    ],
    examples: [
      {
        code: `let last = 'turn a knob';

function setup() {
  createCanvas(400, 300);
  textAlign(CENTER, CENTER);
  textSize(32);
}

function knobMoved(n, value) {
  last = 'knob ' + n + ': ' + nf(value, 1, 2);
}

function draw() {
  background(20);
  fill(255);
  text(last, width / 2, height / 2);
}`,
        caption: { en: 'Shows which knob moved and where it is. ' + PLAY.en, zh: '顯示哪一顆旋鈕動了、現在在哪。' + PLAY.zh },
      },
    ],
    related: ['knob1', 'faderMoved', 'controlChange'],
    keywords: { en: ['knob moved', 'callback', 'event', 'turn'], zh: ['旋鈕', '轉動', '事件', '回呼'] },
  },

  faderMoved: {
    group: 'midi',
    summary: { en: 'You define this function; oav-p5 calls it whenever a fader moves.', zh: '你來定義這個函式。推桿一移動，oav-p5 就呼叫它。' },
    params: [
      { name: 'n', type: 'Number', en: 'Which fader (1 is the first).', zh: '哪一支推桿（1 是第一支）。' },
      { name: 'value', type: 'Number', en: 'Where it is now, 0..1.', zh: '現在的位置，0..1。' },
    ],
    description: [
      { en: 'The fader twin of [`knobMoved()`](#knobMoved): `function faderMoved(n, value) { … }`.', zh: '[`knobMoved()`](#knobMoved) 的推桿版本：`function faderMoved(n, value) { … }`。' },
    ],
    examples: [
      {
        code: `let level = 0;

function setup() {
  createCanvas(400, 300);
}

function faderMoved(n, value) {
  if (n === 1) level = value;   // fader 1 only
}

function draw() {
  background(20);
  fill(255);
  rect(40, height - 40, level * (width - 80), 24);
}`,
        caption: { en: 'A bar that follows fader 1, driven by the event instead of a read.', zh: '一條跟著推桿 1 的橫條，用事件驅動，不是每個畫面去讀。' },
      },
    ],
    related: ['fader1', 'knobMoved', 'controlChange'],
    keywords: { en: ['fader moved', 'slider', 'callback', 'event'], zh: ['推桿', '滑桿', '事件', '回呼'] },
  },

  padPressed: {
    group: 'midi',
    summary: { en: 'You define this function; oav-p5 calls it each time a drum pad is hit.', zh: '你來定義這個函式。每打一下打擊墊，oav-p5 就呼叫它一次。' },
    params: [
      { name: 'n', type: 'Number', en: 'Which pad (1 is the first).', zh: '哪個墊子（1 是第一個）。' },
      { name: 'velocity', type: 'Number', en: 'How hard, 0..1.', zh: '多用力，0..1。' },
    ],
    description: [
      {
        en: '```js\nfunction padPressed(n, velocity) {\n  // pad n was hit\n}\n```\n\nWhen the sketch defines `padPressed()`, a pad calls it and **not** [`notePressed()`](#notePressed); without it, a pad calls `notePressed()` like any key.',
        zh: '```js\nfunction padPressed(n, velocity) {\n  // 墊子 n 被打了一下\n}\n```\n\n草圖有定義 `padPressed()` 的話，打擊墊會呼叫它，而**不會**呼叫 [`notePressed()`](#notePressed)。沒有定義的話，打擊墊會像任何一個鍵一樣呼叫 `notePressed()`。',
      },
    ],
    examples: [
      {
        code: `let hits = [];

function setup() {
  createCanvas(400, 300);
  noStroke();
}

function padPressed(n, velocity) {
  hits.push({ x: 40 + ((n - 1) % 4) * 105, y: 70 + floor((n - 1) / 4) * 130, r: 20 + velocity * 60 });
}

function draw() {
  background(20, 40);
  fill(255, 90, 31);
  for (const h of hits) { circle(h.x, h.y, h.r); h.r *= 0.95; }
  hits = hits.filter((h) => h.r > 2);
}`,
        caption: { en: 'Each hit pops a circle where its pad would sit on a 4×2 grid, and it fades away.', zh: '每打一下，就在那個墊子在 4×2 格子裡的位置冒出一個圓，然後慢慢消失。' },
      },
    ],
    related: ['padReleased', 'pad1', 'notePressed'],
    keywords: { en: ['pad hit', 'drum pad', 'callback', 'event', 'trigger'], zh: ['打擊墊', '事件', '回呼', '觸發'] },
  },

  padReleased: {
    group: 'midi',
    summary: { en: 'You define this function; oav-p5 calls it each time a drum pad is let go.', zh: '你來定義這個函式。每當打擊墊放開，oav-p5 就呼叫它。' },
    params: [{ name: 'n', type: 'Number', en: 'Which pad (1 is the first).', zh: '哪個墊子（1 是第一個）。' }],
    description: [
      { en: 'The partner of [`padPressed()`](#padPressed): `function padReleased(n) { … }`. Without it, a pad calls [`noteReleased()`](#noteReleased).', zh: '[`padPressed()`](#padPressed) 的另一半：`function padReleased(n) { … }`。沒有定義的話，打擊墊會呼叫 [`noteReleased()`](#noteReleased)。' },
    ],
    examples: [
      {
        code: `let down = {};

function setup() {
  createCanvas(400, 300);
}

function padPressed(n) { down[n] = true; }
function padReleased(n) { down[n] = false; }

function draw() {
  background(20);
  fill(255, 90, 31);
  for (let i = 1; i <= 8; i++) if (down[i]) square(10 + (i - 1) * 48, 130, 40);   // lit while held
}`,
        caption: { en: 'A square per pad, lit from press to release.', zh: '一個墊子一個方塊，從按下到放開都亮著。' },
      },
    ],
    related: ['padPressed', 'pad1', 'noteReleased'],
    keywords: { en: ['pad released', 'callback', 'event'], zh: ['打擊墊', '放開', '事件', '回呼'] },
  },

  lastNoteTs: {
    group: 'midi',
    summary: {
      en: 'When the last key went down, on the `millis()` clock: `millis() - lastNoteTs` is how many ms ago.',
      zh: '上一個鍵是什麼時候按下的，用 `millis()` 的時鐘：`millis() - lastNoteTs` 就是幾毫秒前。',
    },
    value: {
      type: 'Number',
      en: 'Milliseconds on the same clock as `millis()`, set with [`note`](#note) and [`velocity`](#velocity); `-Infinity` before any key. Since oav-p5 0.8.2.',
      zh: '毫秒，跟 `millis()` 同一個時鐘，跟 [`note`](#note)、[`velocity`](#velocity) 一起更新。還沒按過任何鍵之前是 `-Infinity`。oav-p5 0.8.2 起。',
    },
    description: [
      { en: 'Any key counts: a MIDI keyboard, the 🎹 on screen, a phone. Releasing a key does not change it.', zh: '任何鍵都算：MIDI 鍵盤、畫面上的 🎹、手機。放開鍵不會改變它。' },
    ],
    examples: [
      {
        code: `function setup() {
  createCanvas(400, 300);
  noStroke();
}

function draw() {
  background(20);
  const ago = millis() - lastNoteTs;    // ms since a key went down
  fill(255, 200 * exp(-ago / 400) + 30);
  circle(200, 150, 60 + 160 * exp(-ago / 400));
}`,
        caption: { en: 'Each key you press (on 🎹 too) makes the circle bright and big, then it dims.', zh: '每按一個鍵（🎹 也可以），圓就變亮變大，然後慢慢暗下來。' },
      },
    ],
    claims: [{ before: "midi.input([0x90, 60, 100], 'screen')", expr: 'lastNoteTs > -Infinity', equals: true }],
    related: ['note', 'velocity', 'notePressed', 'lastKickTs'],
    keywords: { en: ['last note', 'timestamp', 'time since', 'millis', 'key pressed'], zh: ['上一個音', '時間', '多久以前', '毫秒', '按鍵'] },
  },

  lastNoteFrameCount: {
    group: 'midi',
    summary: {
      en: 'The `frameCount` of the frame that saw the last key go down: `frameCount - lastNoteFrameCount` is how many frames ago.',
      zh: '看到上一個鍵按下的那一格的 `frameCount`：`frameCount - lastNoteFrameCount` 就是幾格以前。',
    },
    value: {
      type: 'Number',
      en: 'A frame number, on the same count as `frameCount`, set with [`note`](#note); `-Infinity` before any key. Since oav-p5 0.8.3.',
      zh: '畫面的編號，跟 `frameCount` 同一套數法，跟 [`note`](#note) 一起更新。還沒按過任何鍵之前是 `-Infinity`。oav-p5 0.8.3 起。',
    },
    description: [
      { en: 'The frame-counting twin of [`lastNoteTs`](#lastNoteTs): 0 in the first frame after the key, then 1, 2, 3 …', zh: '[`lastNoteTs`](#lastNoteTs) 的「數格子」版本：按下之後的第一格是 0，接下來 1、2、3……' },
    ],
    examples: [
      {
        code: `function setup() {
  createCanvas(400, 300);
  noStroke();
}

function draw() {
  background(20);
  const f = frameCount - lastNoteFrameCount;    // frames since a key went down
  fill(120, 190, 255);
  circle(200, 150, max(0, 200 - f * 5));        // shrinks by 5 px a frame
}`,
        caption: { en: 'Each key you press (on 🎹 too) brings back a big circle that shrinks 5 px a frame.', zh: '每按一個鍵（🎹 也可以），大圓就回來，然後每一格縮 5 px。' },
      },
    ],
    claims: [{ before: "midi.input([0x90, 60, 100], 'screen')", expr: 'lastNoteFrameCount > -Infinity', equals: true }],
    related: ['lastNoteTs', 'note', 'notePressed', 'lastKickFrameCount'],
    keywords: { en: ['last note', 'frameCount', 'frames since', 'key pressed'], zh: ['上一個音', '幾格以前', '畫面數', '按鍵'] },
  },
};
