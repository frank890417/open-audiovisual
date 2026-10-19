// oav-p5 reference: values over time (the CHOP-style shapers) and OAVp5.chop.
// Read by tools/build-reference.mjs (see AGENTS.md, "Documenting a public name"). Sketch examples leave out the loader line.
//
// The math is @openav/chop (packages/chop/index.js); what oav-p5 adds is the memory: one call in draw(), nothing to declare.
// The functions are also on OAVp5.chop (the same functions), which is why each entry here lists its OAVp5.chop.* twin as an alias.

// A trailing name is read from `arguments`, not declared: the same words for every function.
const NAME = {
  name: 'name', type: 'String | Number', optional: true, viaArguments: true,
  en: "A name for this call's memory, written as the last argument. Optional. Without one, oav-p5 tells calls apart by their order in `draw()`; with one, the call is the same wherever it is made.",
  zh: '給這次呼叫的記憶取的名字，寫在最後一個參數。可以不寫。不寫的話，oav-p5 用 `draw()` 裡呼叫的先後順序來區分。有名字的呼叫，在哪裡呼叫都是同一個。',
};

// What every unnamed call remembers by, and the way out.
const ORDER_NOTE = {
  en: "Unnamed calls find their memory by their order in `draw()`: the first `lag()` is the first lag, the second is the second. Put one inside an `if`, or in a loop whose length changes, and the order slips: a card says so, and from then on oav-p5 matches each call by the line it is written on. A name at the end is the sure way. Outside `draw()` an unnamed call has nothing to remember by: it returns what Returns says and a card says so.",
  zh: '沒有名字的呼叫靠它在 `draw()` 裡的順序找回自己的記憶：第一個 `lag()` 是第一個 lag，第二個是第二個。放進 `if`，或放進長度會變的迴圈，順序就會對不上。這時會跳出一張卡片，從那之後 oav-p5 改成照「寫在哪一行」來對應。最穩的做法是在最後加一個名字。在 `draw()` 外面，沒有名字的呼叫沒有東西可以記，會回傳「回傳」欄寫的值，也會跳出卡片。',
};

export default {
  lag: {
    group: 'chop',
    aliases: ['OAVp5.chop.lag'],
    summary: {
      en: 'Follows `value` smoothly instead of jumping: up in `up` seconds, down in `down` seconds (TouchDesigner\'s Lag CHOP).',
      zh: '讓數值平順地跟上 `value`，不要跳：上升花 `up` 秒，下降花 `down` 秒（TouchDesigner 的 Lag CHOP）。',
    },
    params: [
      { name: 'value', type: 'Number | Boolean', en: 'The number to follow. A boolean counts as 0 or 1. Anything that is not a finite number (a string, `NaN`) goes straight through and the lag keeps what it had.', zh: '要跟隨的數字。布林值算成 0 或 1。不是有限數字的東西（字串、`NaN`）會直接穿過去，lag 保留原來的狀態。' },
      { name: 'up', type: 'Number', optional: true, default: '0.1', en: 'Seconds to follow a rise: about how long the output takes to cover 90% of a jump upward. Negative numbers count as 0.', zh: '跟上升的秒數：輸出大約花這麼久走完往上跳的 90%。負數算 0。' },
      { name: 'down', type: 'Number', optional: true, default: 'up', en: 'Seconds to follow a fall. Left out, it is the same as `up`.', zh: '跟下降的秒數。不寫的話跟 `up` 一樣。' },
      NAME,
    ],
    returns: { type: 'Number', en: 'The smoothed value. It returns `value` as it is until @openav/chop has loaded (a few frames), and for an unnamed call outside `draw()`.', zh: '平順過的數值。@openav/chop 還沒載好之前（幾個畫面），以及在 `draw()` 外面沒有名字的呼叫，原樣回傳 `value`。' },
    description: [
      {
        en: "Wrap any number that jumps: `circle(width / 2, height / 2, 50 + lag(micLevel, 0.03, 0.4) * 300)` is a VU meter. It opens within 0.03 seconds when someone speaks and takes 0.4 seconds to close. `up` is the time to follow a rise, `down` the time to follow a fall. Leave `down` out and both are `up`. Leave both out and they are 0.1.",
        zh: '包住任何會跳的數字：`circle(width / 2, height / 2, 50 + lag(micLevel, 0.03, 0.4) * 300)` 就是一個音量表。有人說話時 0.03 秒內張開，要 0.4 秒才收回去。`up` 是跟上升的時間，`down` 是跟下降的時間。不寫 `down`，兩個都是 `up`。兩個都不寫，就都是 0.1。',
      },
      {
        en: "The seconds are TouchDesigner's: `lag(x, 0.1)` moves like a Lag CHOP set to 0.1, so the numbers you learn here carry over. That is about the time the output takes to cover 90% of a jump (underneath, a one-pole lag whose time constant is the seconds divided by 2.3). The curve is the same at 30 and at 144 frames per second.",
        zh: '這裡的秒數跟 TouchDesigner 一樣：`lag(x, 0.1)` 的動法就像把 Lag CHOP 設成 0.1，所以在這裡學的數字可以直接帶到 TouchDesigner。意思大約是輸出走完一次跳動的 90% 所花的時間（底層是一階的 lag，時間常數是秒數除以 2.3）。每秒 30 格和每秒 144 格畫出來的曲線一樣。',
      },
      {
        en: 'The first value it sees is taken as it is, so nothing glides in from 0. A boolean counts as 0 or 1: `lag(mouseIsPressed, 0.2)` is a soft switch.',
        zh: '它看到的第一個值照單全收，所以不會從 0 慢慢滑進來。布林值算成 0 或 1：`lag(mouseIsPressed, 0.2)` 就是一個柔軟的開關。',
      },
    ],
    needs: {
      en: 'Nothing to call or declare: write it in `draw()`. The first call loads @openav/chop from next to oav-p5.js, which takes a few frames.',
      zh: '不用呼叫別的東西，也不用宣告：直接寫在 `draw()` 裡。第一次呼叫時會從 oav-p5.js 旁邊載入 @openav/chop，要幾個畫面。',
    },
    notes: [
      ORDER_NOTE,
      {
        en: "A sketch with its own variable or function called `lag` keeps it. `OAVp5.chop.lag(…)` is this function under another name.",
        zh: '草圖如果自己有叫 `lag` 的變數或函式，就由草圖保留。`OAVp5.chop.lag(…)` 是同一個函式的另一個名字。',
      },
    ],
    examples: [
      {
        code: `function setup() {
  createCanvas(400, 300);
}

function draw() {
  background(20);
  const x = lag(mouseX, 0.5);   // follows the mouse, half a second behind
  circle(x, height / 2, 40);
}`,
        caption: { en: 'A circle that chases the mouse: it never jumps, it glides, and takes about half a second to catch up.', zh: '一個追著滑鼠跑的圓：它不會跳，而是滑過去，大約半秒追上。' },
      },
      {
        code: `function setup() {
  createCanvas(400, 300);
}

function draw() {
  background(20);
  const open = lag(mouseIsPressed, 0.15, 0.8);   // a boolean counts as 0 or 1
  fill(255, 211, 107);
  circle(width / 2, height / 2, 40 + open * 240);
}`,
        caption: { en: 'Hold the mouse down: the circle swells quickly and, when you let go, shrinks back slowly.', zh: '按住滑鼠：圓很快脹大，放開之後慢慢縮回去。' },
      },
      {
        code: `function setup() {
  createCanvas(400, 300);
  noStroke();
}

function draw() {
  background(20);
  for (let i = 0; i < 6; i++) {
    const seconds = 0.1 + i * 0.12;
    const x = lag(mouseX, seconds, seconds, 'dot' + i);   // a name per dot
    fill(255, 211, 107);
    circle(x, 40 + i * 44, 24);
  }
}`,
        caption: { en: 'Six dots follow the mouse, each a little slower than the one above. The names keep each dot\'s memory its own even if you later add or remove dots.', zh: '六個圓點跟著滑鼠，每一個都比上面那個慢一點。有了名字，之後就算增減圓點，每一個記得的還是自己的位置。' },
      },
    ],
    claims: [{ expr: "lag(7, 0.5, 0.5, 'claim-first')", equals: 7 }],
    related: ['spring', 'env', 'micLevel', 'knob1', 'trail', 'scope', 'OAVp5.chop'],
    keywords: {
      en: ['lag', 'smooth', 'smoothing', 'ease', 'follow', 'low pass', 'damping', 'inertia', 'vu meter', 'Lag CHOP', 'TouchDesigner'],
      zh: ['平滑', '緩動', '延遲', '跟隨', '慣性', '抖動', '不要抖', '音量表', 'TouchDesigner'],
    },
  },

  env: {
    group: 'chop',
    aliases: ['OAVp5.chop.env'],
    summary: {
      en: 'A 0..1 pulse that jumps up after each event (a kick, a beat, a key, a press) and then fades out: TouchDesigner\'s Trigger CHOP.',
      zh: '一個 0 到 1 的脈衝：每次事件（大鼓、拍子、琴鍵、按下）之後就跳起來，然後慢慢退下去（TouchDesigner 的 Trigger CHOP）。',
    },
    params: [
      { name: 'event', type: 'String | Boolean | Number', optional: true, default: "'beat'", en: "What to react to. A name: `'kick'`, `'snare'`, `'hat'`, `'beat'` (from the microphone or the drum machine), `'note'` (any key), `'bar'`, `'step'` (the drum machine), a cue's name, or an event of your own fired with [`trigger()`](#trigger). Or a switch: a boolean, or a number above 0.5, and each time it turns on counts as an event. Left out: `'beat'`.", zh: "要對什麼起反應。可以是名字：`'kick'`、`'snare'`、`'hat'`、`'beat'`（來自麥克風或鼓機）、`'note'`（任何琴鍵）、`'bar'`、`'step'`（鼓機）、某個 cue 的名字，或你自己用 [`trigger()`](#trigger) 發出的事件。也可以是開關：布林值，或大於 0.5 的數字，每次從關變成開就算一次事件。不寫就是 `'beat'`。" },
      { name: 'attack', type: 'Number', optional: true, default: '0.01', en: 'Seconds the rise from 0 to 1 takes.', zh: '從 0 升到 1 要花的秒數。' },
      { name: 'decay', type: 'Number', optional: true, default: '0.3', en: 'Seconds the fall from 1 back to 0 takes.', zh: '從 1 落回 0 要花的秒數。' },
      { ...NAME, en: "Only for the switch form (`env(mouseIsPressed, …, 'a')`): a name for its memory, as the last argument. A named event such as `'kick'` needs none.", zh: "只用在開關的寫法（`env(mouseIsPressed, …, 'a')`）：給它的記憶取的名字，寫在最後一個參數。像 `'kick'` 這種有名字的事件不需要。" },
    ],
    returns: { type: 'Number', en: '0..1: 0 when nothing has happened, 1 at the top of the pulse. Until @openav/chop has loaded (a few frames) it returns 0.', zh: '0 到 1：什麼都沒發生是 0，脈衝的頂點是 1。@openav/chop 還沒載好之前（幾個畫面）回傳 0。' },
    description: [
      {
        en: "Call it every frame and use the number like a size or a brightness: `circle(width / 2, height / 2, 60 + env('kick', 0.01, 0.3) * 200)` swells on every kick. The number rises to 1 in `attack` seconds after an event and falls back to 0 in `decay` seconds, quick at first and landing softly, the way a bass drum's swell looks right.",
        zh: "每個畫面都呼叫它，把這個數字當成大小或亮度來用：`circle(width / 2, height / 2, 60 + env('kick', 0.01, 0.3) * 200)` 讓圓在每一下大鼓都脹大。事件之後，數字在 `attack` 秒內升到 1，再用 `decay` 秒落回 0，一開始退得快，最後輕輕落地，就像大鼓的那一下看起來該有的樣子。",
      },
      {
        en: 'An event that arrives while the last pulse is still sounding restarts from where the pulse is, never from zero, so fast hits pile up into a plateau instead of flickering. The attack is measured from 0: a retrigger from halfway up takes half the attack.',
        zh: '上一個脈衝還沒退完時又來一個事件，會從脈衝現在的位置重新開始，不會回到 0，所以很快的連打會堆成一個平台，不會閃爍。attack 是從 0 算起的：從一半的地方再觸發，只花一半的 attack。',
      },
      {
        en: "The events: `'kick'`, `'snare'` and `'hat'` are the hits [`kickDetected()`](#kickDetected) hears (from the microphone, or from the drum machine when it plays), `'beat'` is [`beat`](#beat), `'note'` is any key going down, `'bar'` and `'step'` come from the drum machine, a cue's name fires when [`cue()`](#cue) does, and any other name is yours to fire with [`trigger()`](#trigger). The switch form, `env(mouseIsPressed, 0.02, 0.5)`, fires on every press.",
        zh: "事件有這些：`'kick'`、`'snare'`、`'hat'` 就是 [`kickDetected()`](#kickDetected) 聽到的那些打擊（來自麥克風，或鼓機在播的時候來自鼓機），`'beat'` 是 [`beat`](#beat)，`'note'` 是任何一個琴鍵按下，`'bar'` 和 `'step'` 來自鼓機，cue 的名字在 [`cue()`](#cue) 觸發時發出，其他的名字由你用 [`trigger()`](#trigger) 發出。開關的寫法 `env(mouseIsPressed, 0.02, 0.5)` 在每次按下時發出事件。",
      },
    ],
    needs: {
      en: "`'kick'`, `'snare'`, `'hat'` and `'beat'` need something that makes them. If the sketch has not started the drum machine ([`startDrums()`](#startDrums)), the first `env('kick')` asks for the microphone, like reading [`micLevel`](#micLevel), and `?oav_mic=off` means nothing ever fires. Once the drum machine is started, the microphone is not opened for it. `'note'` needs a key: play one, press 🎹, or call [`OAVp5.play()`](#OAVp5.play). A name of your own needs [`trigger()`](#trigger): if nothing fires it within 4 seconds, a card says so.",
      zh: "`'kick'`、`'snare'`、`'hat'`、`'beat'` 要有東西去產生它們。草圖還沒啟動鼓機（[`startDrums()`](#startDrums)）的話，第一次 `env('kick')` 就會像讀 [`micLevel`](#micLevel) 一樣去要麥克風，而 `?oav_mic=off` 表示永遠不會有事件。鼓機一啟動，就不會為它去開麥克風。`'note'` 要有琴鍵：彈一個、按 🎹，或呼叫 [`OAVp5.play()`](#OAVp5.play)。你自己取的名字要靠 [`trigger()`](#trigger)：4 秒內沒有任何東西觸發它，會跳出一張卡片告訴你。",
    },
    notes: [
      {
        en: "A named event needs no place in `draw()`: `env('kick')` works in `setup()` or `mousePressed()` too. Only the switch form remembers anything between frames, and an unnamed switch outside `draw()` returns 0. Calls in `draw()` are matched by order, like [`lag()`](#lag).",
        zh: "有名字的事件不需要待在 `draw()` 裡：`env('kick')` 在 `setup()` 或 `mousePressed()` 裡也能用。只有開關的寫法會在畫面之間記東西，沒有名字的開關在 `draw()` 外面回傳 0。在 `draw()` 裡的呼叫跟 [`lag()`](#lag) 一樣，靠順序來對應。",
      },
      {
        en: '`OAVp5.chop.env(…)` is this function under another name.',
        zh: '`OAVp5.chop.env(…)` 是同一個函式的另一個名字。',
      },
    ],
    examples: [
      {
        code: `function setup() {
  createCanvas(400, 300);
}

function draw() {
  background(20);
  const k = env(mouseIsPressed, 0.02, 0.5);   // 1 right after each press, then it fades
  circle(width / 2, height / 2, 60 + k * 200);
}`,
        caption: { en: 'Click the canvas: the circle jumps open and fades back each time.', zh: '點一下畫布：圓每次都彈開，再慢慢退回去。' },
      },
      {
        code: `function setup() {
  createCanvas(400, 300);
  noStroke();
  startDrums('bd*4, [~ sd]*2, hh*8', 108);   // a drum machine, so no microphone is needed
}

function draw() {
  background(20);
  const kick = env('kick', 0.01, 0.3);       // 1 on every kick, 0 again 0.3 s later
  const snare = env('snare', 0.005, 0.15);
  fill(255, 90, 31);
  circle(120, 150, 40 + kick * 160);
  fill(120, 190, 255);
  circle(280, 150, 40 + snare * 160);
}`,
        caption: { en: 'Two circles swell on the drum machine\'s kick and snare. Click the canvas once if you hear nothing: browsers wait for a click before they play sound.', zh: '兩個圓分別在鼓機的大鼓和小鼓時脹大。如果沒聽到聲音，點一下畫布：瀏覽器要先有一次點擊才會播聲音。' },
      },
      {
        code: `function setup() {
  createCanvas(400, 300);
}

function mousePressed() {
  OAVp5.play(48 + floor(random(24)), 0.8);   // play a key, as a controller would
}

function draw() {
  background(20);
  const k = env('note', 0.005, 0.8);         // every key makes it flash
  fill(255, 211, 107);
  circle(width / 2, height / 2, 40 + k * 240);
}`,
        caption: { en: 'Click the canvas, or play a key on a controller or the 🎹: every key pulses the circle.', zh: '點一下畫布，或在控制器或 🎹 上彈一個鍵：每個鍵都讓圓跳一下。' },
      },
    ],
    claims: [{ before: "trigger('claim-boom'); env('claim-boom')", expr: "env('claim-boom', 0.01, 5)", min: 0.5, max: 1 }],
    related: ['trigger', 'count', 'lag', 'beat', 'kickDetected', 'startDrums', 'OAVp5.chop'],
    keywords: {
      en: ['envelope', 'env', 'trigger', 'pulse', 'attack', 'decay', 'flash', 'kick', 'beat', 'Trigger CHOP', 'TouchDesigner'],
      zh: ['包絡', '脈衝', '觸發', '起音', '衰減', '閃一下', '大鼓', '拍子', 'TouchDesigner'],
    },
  },

  trigger: {
    group: 'chop',
    aliases: ['OAVp5.chop.trigger'],
    summary: {
      en: 'Fires an event of your own, by name, for [`env()`](#env) and [`count()`](#count) to react to.',
      zh: '用名字發出一個你自己的事件，讓 [`env()`](#env) 和 [`count()`](#count) 去對它起反應。',
    },
    params: [
      { name: 'name', type: 'String', optional: true, default: "'trigger'", en: 'The name of the event. Anything is fine except the built-in meanings: `\'kick\'`, `\'snare\'`, `\'hat\'`, `\'beat\'`, `\'note\'`, `\'bar\'` and `\'step\'` are also fired by the microphone, the keys and the drum machine. Left out: `\'trigger\'`.', zh: "事件的名字。隨便取，只是要留意內建的意思：`'kick'`、`'snare'`、`'hat'`、`'beat'`、`'note'`、`'bar'`、`'step'` 也會被麥克風、琴鍵和鼓機發出。不寫就是 `'trigger'`。" },
    ],
    description: [
      {
        en: "Call it where the thing happens: `function mousePressed() { trigger('boom'); }`. Then read it anywhere in `draw()` with `env('boom', 0.01, 0.6)` (a pulse that fades) or `count('boom')` (how many times so far). It returns nothing.",
        zh: "在事情發生的地方呼叫它：`function mousePressed() { trigger('boom'); }`。然後在 `draw()` 的任何地方，用 `env('boom', 0.01, 0.6)`（會退下去的脈衝）或 `count('boom')`（到現在發生幾次）去讀它。它沒有回傳值。",
      },
      {
        en: "It works anywhere, not only in `draw()`, and each call is one event, remembered with the time it happened. You can fire the built-in names by hand as well: `trigger('kick')` pulses `env('kick')` as a real kick would.",
        zh: "它在哪裡都能用，不只是 `draw()`，每呼叫一次就是一個事件，連同發生的時間一起被記下來。內建的名字也可以用手發出：`trigger('kick')` 會讓 `env('kick')` 跳一下，就像真的大鼓一樣。",
      },
    ],
    notes: [
      {
        en: '`OAVp5.chop.trigger(…)` is this function under another name.',
        zh: '`OAVp5.chop.trigger(…)` 是同一個函式的另一個名字。',
      },
    ],
    examples: [
      {
        code: `function setup() {
  createCanvas(400, 300);
}

function mousePressed() {
  trigger('boom');   // an event of our own
}

function draw() {
  background(20);
  const k = env('boom', 0.01, 0.6);
  circle(width / 2, height / 2, 60 + k * 220);
}`,
        caption: { en: 'Click the canvas: each click fires "boom" and the circle pulses once.', zh: '點一下畫布：每點一下就發出一次 "boom"，圓跳一下。' },
      },
      {
        code: `function setup() {
  createCanvas(400, 300);
  noStroke();
}

function mousePressed() { trigger('boom'); }
function keyPressed() { trigger('spark'); }

function draw() {
  background(20);
  fill(255, 90, 31);
  circle(120, 150, 40 + env('boom', 0.01, 0.6) * 160);
  fill(120, 190, 255);
  circle(280, 150, 40 + env('spark', 0.005, 0.2) * 160);
}`,
        caption: { en: 'Click for the orange circle, press any key for the blue one: each reacts only to its own event.', zh: '點一下讓橘色的圓跳，按任何一個鍵讓藍色的圓跳：各自只對自己的事件起反應。' },
      },
    ],
    claims: [{ before: "trigger('claim-count'); trigger('claim-count'); trigger('claim-count'); count('claim-count')", expr: "count('claim-count')", equals: 3 }],
    related: ['env', 'count', 'OAVp5.chop'],
    keywords: {
      en: ['trigger', 'fire', 'event', 'custom event', 'emit', 'signal', 'Trigger CHOP'],
      zh: ['觸發', '事件', '自訂事件', '發出', '訊號', 'TouchDesigner'],
    },
  },

  speed: {
    group: 'chop',
    aliases: ['OAVp5.chop.speed'],
    summary: {
      en: 'Adds `rate` to a running total every second, so `rotate(speed(TWO_PI))` turns once a second and the rate can change without the total ever jumping.',
      zh: '每秒把 `rate` 加進一個累計值，所以 `rotate(speed(TWO_PI))` 每秒轉一圈，而且速率隨時可以變，累計值不會跳（TouchDesigner 的 Speed CHOP）。',
    },
    params: [
      { name: 'rate', type: 'Number | Boolean', en: 'How much to add per second, in the unit you use the result in (radians for `rotate()`, pixels for a position). It may change every frame. A boolean counts as 0 or 1.', zh: '每秒要加多少，單位看你怎麼用結果（給 `rotate()` 就是弧度，給位置就是像素）。每個畫面都可以不一樣。布林值算成 0 或 1。' },
      NAME,
    ],
    returns: { type: 'Number', en: 'The running total, 0 at the start. It is 0 until @openav/chop has loaded (a few frames), and for an unnamed call outside `draw()`.', zh: '累計值，一開始是 0。@openav/chop 還沒載好之前（幾個畫面），以及在 `draw()` 外面沒有名字的呼叫，都回傳 0。' },
    description: [
      {
        en: "Use the total to turn or move something: `rotate(speed(TWO_PI))` is one turn a second, `x = speed(60) % width` slides 60 pixels a second and wraps around. You pass the rate, not the position, so the rate can follow a knob or the microphone (`speed(micLevel * TWO_PI)` spins faster the louder it gets) and the angle never jumps, which `frameCount * rate` would do.",
        zh: '用累計值來轉或移動東西：`rotate(speed(TWO_PI))` 是每秒轉一圈，`x = speed(60) % width` 是每秒滑 60 像素，到邊界再繞回來。你傳的是速率，不是位置，所以速率可以跟著旋鈕或麥克風走（`speed(micLevel * TWO_PI)` 越大聲轉越快），角度也不會跳，換成 `frameCount * rate` 就會跳。',
      },
      {
        en: 'Time is in seconds, the same at any frame rate. One frame counts for at most a quarter of a second, so coming back to a hidden tab does not make the shape leap.',
        zh: '時間是以秒計，任何畫面更新率都一樣。一個畫面最多只算四分之一秒，所以從被藏起來的分頁回來時，圖形不會一下子衝出去。',
      },
    ],
    needs: {
      en: 'Nothing to call or declare: write it in `draw()`. The first call loads @openav/chop, which takes a few frames.',
      zh: '不用呼叫別的東西，也不用宣告：直接寫在 `draw()` 裡。第一次呼叫會載入 @openav/chop，要幾個畫面。',
    },
    notes: [
      ORDER_NOTE,
      {
        en: "Plenty of sketches have a variable called `speed`. If yours does, it keeps the name, and `OAVp5.chop.speed(…)` is this function under another name (third example).",
        zh: '很多草圖都有一個叫 `speed` 的變數。你的草圖有的話，名稱就歸你的草圖，而 `OAVp5.chop.speed(…)` 是同一個函式的另一個名字（第三個範例）。',
      },
    ],
    examples: [
      {
        code: `function setup() {
  createCanvas(400, 300);
  rectMode(CENTER);
}

function draw() {
  background(20);
  translate(width / 2, height / 2);
  rotate(speed(TWO_PI));   // one turn a second
  rect(0, 0, 120, 120);
}`,
        caption: { en: 'A square that turns once a second, steadily.', zh: '一個方塊，每秒平穩地轉一圈。' },
      },
      {
        code: `function setup() {
  createCanvas(400, 300);
  rectMode(CENTER);
}

function draw() {
  background(20);
  const rate = map(mouseX, 0, width, -TWO_PI, TWO_PI);   // turns per second, left to right
  translate(width / 2, height / 2);
  rotate(speed(rate));
  rect(0, 0, 120, 120);
}`,
        caption: { en: 'Move the mouse: the left side spins the square one way, the middle stops it, the right side spins it the other way, and it never jumps.', zh: '移動滑鼠：左邊讓方塊往一個方向轉，中間讓它停下，右邊往另一個方向轉，而且不會跳。' },
      },
      {
        code: `let speed = 2;   // the sketch's own variable called speed

function setup() {
  createCanvas(400, 300);
  rectMode(CENTER);
}

function draw() {
  background(20);
  translate(width / 2, height / 2);
  rotate(OAVp5.chop.speed(speed));   // the same function, under another name
  rect(0, 0, 120, 120);
}`,
        caption: { en: 'The sketch keeps its own `speed` (2 radians a second) and reaches the function as OAVp5.chop.speed.', zh: '草圖保留自己的 `speed`（每秒 2 弧度），並用 OAVp5.chop.speed 呼叫這個函式。' },
      },
    ],
    related: ['lag', 'spring', 'slope', 'OAVp5.chop'],
    keywords: {
      en: ['speed', 'rotate', 'spin', 'integrate', 'accumulate', 'rate', 'angle', 'Speed CHOP', 'TouchDesigner'],
      zh: ['速度', '旋轉', '轉動', '累計', '積分', '角度', 'TouchDesigner'],
    },
  },

  spring: {
    group: 'chop',
    aliases: ['OAVp5.chop.spring'],
    summary: {
      en: 'Follows `value` like a mass on a spring: it overshoots, bounces and settles (TouchDesigner\'s Spring CHOP).',
      zh: '像彈簧上的重物那樣跟上 `value`：會衝過頭、彈幾下、然後穩住（TouchDesigner 的 Spring CHOP）。',
    },
    params: [
      { name: 'value', type: 'Number | Boolean', en: 'The target the spring is pulled toward. A boolean counts as 0 or 1.', zh: '彈簧被拉向的目標。布林值算成 0 或 1。' },
      { name: 'stiffness', type: 'Number', optional: true, default: '100', en: 'How fast it swings: 100 swings about 1.6 times a second. Higher is snappier. Negative numbers count as 0.', zh: '擺動得多快：100 大約每秒擺 1.6 次。越大越俐落。負數算 0。' },
      { name: 'damping', type: 'Number', optional: true, default: '6', en: 'How soon it settles: 6 gives two or three bounces, 20 and up none. The edge where it stops bouncing is `2 * sqrt(stiffness)`.', zh: '多快穩下來：6 會彈兩三下，20 以上就不彈了。剛好不再彈的界線是 `2 * sqrt(stiffness)`。' },
      NAME,
    ],
    returns: { type: 'Number', en: 'The spring\'s position now. The first value it sees is taken as it is. It returns `value` as it is until @openav/chop has loaded (a few frames), and for an unnamed call outside `draw()`.', zh: '彈簧現在的位置。看到的第一個值照單全收。@openav/chop 還沒載好之前（幾個畫面），以及在 `draw()` 外面沒有名字的呼叫，原樣回傳 `value`。' },
    description: [
      {
        en: "Wrap a target that jumps: `circle(width / 2, height / 2, spring(mouseIsPressed ? 300 : 100, 100, 6))`. The size does not just glide to the new target (that is [`lag()`](#lag)): it swings past it, comes back and settles.",
        zh: '包住一個會跳的目標：`circle(width / 2, height / 2, spring(mouseIsPressed ? 300 : 100, 100, 6))`。大小不是單純滑到新目標（那是 [`lag()`](#lag)），而是衝過頭、回來、再穩住。',
      },
      {
        en: 'Stiffness and damping are the two knobs. A stiff, lightly damped spring rings like a ruler on a table. A soft, heavily damped one just eases. A big jump or a low frame rate does not break it: the motion is the same at any frame rate.',
        zh: '剛性（stiffness）和阻尼（damping）是兩個旋鈕。很硬、阻尼很小的彈簧像桌邊的尺一樣一直顫。很軟、阻尼很大的就只是緩緩靠近。目標跳很大，或畫面更新率很低，都不會弄壞它：任何更新率的動作都一樣。',
      },
    ],
    needs: {
      en: 'Nothing to call or declare: write it in `draw()`. The first call loads @openav/chop, which takes a few frames.',
      zh: '不用呼叫別的東西，也不用宣告：直接寫在 `draw()` 裡。第一次呼叫會載入 @openav/chop，要幾個畫面。',
    },
    notes: [
      ORDER_NOTE,
      { en: '`OAVp5.chop.spring(…)` is this function under another name.', zh: '`OAVp5.chop.spring(…)` 是同一個函式的另一個名字。' },
    ],
    examples: [
      {
        code: `function setup() {
  createCanvas(400, 300);
}

function draw() {
  background(20);
  const size = spring(mouseIsPressed ? 300 : 100, 100, 6);   // overshoots, then settles
  circle(width / 2, height / 2, size);
}`,
        caption: { en: 'Hold the mouse: the circle springs open, overshoots and settles. Let go and it bounces back down.', zh: '按住滑鼠：圓彈開、衝過頭、再穩住。放開就彈回去。' },
      },
      {
        code: `function setup() {
  createCanvas(400, 300);
}

function draw() {
  background(20);
  const x = spring(mouseX, 60, 4);   // soft and bouncy
  const y = spring(mouseY, 60, 4);
  circle(x, y, 40);
}`,
        caption: { en: 'A circle hung on the mouse by a soft spring: it swings around the pointer instead of sticking to it.', zh: '一個用軟彈簧掛在滑鼠上的圓：它繞著滑鼠擺動，不會黏在上面。' },
      },
      {
        code: `function setup() {
  createCanvas(400, 300);
  noStroke();
}

function draw() {
  background(20);
  const target = mouseIsPressed ? 340 : 60;
  const dampings = [2, 6, 20];
  for (let i = 0; i < 3; i++) {
    const x = spring(target, 100, dampings[i]);   // same pull, three dampings
    circle(x, 60 + i * 90, 36);
  }
}`,
        caption: { en: 'Hold the mouse: three circles are pulled right by the same spring with different damping. The top one bounces many times, the middle one a few, the bottom one not at all.', zh: '按住滑鼠：三個圓被同一個彈簧、不同的阻尼往右拉。最上面的彈很多下，中間的彈幾下，最下面的完全不彈。' },
      },
    ],
    related: ['lag', 'speed', 'slope', 'OAVp5.chop'],
    keywords: {
      en: ['spring', 'bounce', 'overshoot', 'elastic', 'damping', 'stiffness', 'physics', 'Spring CHOP', 'TouchDesigner'],
      zh: ['彈簧', '彈跳', '過衝', '彈性', '阻尼', '剛性', '物理', 'TouchDesigner'],
    },
  },

  trail: {
    group: 'chop',
    aliases: ['OAVp5.chop.trail'],
    summary: {
      en: 'The last few seconds of `value` as an array, 60 values a second, oldest first and newest last (TouchDesigner\'s Trail CHOP).',
      zh: '`value` 最近幾秒的歷史，做成一個陣列，每秒 60 個值，最舊的在前、最新的在最後（TouchDesigner 的 Trail CHOP）。',
    },
    params: [
      { name: 'value', type: 'Number | Boolean', en: 'The number to record. A boolean counts as 0 or 1. Anything that is not a finite number is skipped.', zh: '要記錄的數字。布林值算成 0 或 1。不是有限數字的東西會被略過。' },
      { name: 'seconds', type: 'Number', optional: true, default: '2', en: 'How many seconds of history to keep, from 0.05 to 600.', zh: '要保留幾秒的歷史，範圍是 0.05 到 600。' },
      NAME,
    ],
    returns: { type: 'Array<Number>', en: 'About `seconds * 60 + 1` numbers (121 for 2 seconds), a new array every call. The length is fixed from the first call and filled with the first value, so you can draw it from frame one. It is an empty array until @openav/chop has loaded, and for an unnamed call outside `draw()`.', zh: '大約 `seconds * 60 + 1` 個數字（2 秒是 121 個），每次呼叫都是一個新的陣列。長度從第一次呼叫就固定，並且用第一個值填滿，所以從第一個畫面就能畫。@openav/chop 還沒載好之前，以及在 `draw()` 外面沒有名字的呼叫，是空陣列。' },
    description: [
      {
        en: "A history to draw or measure: `drawTrail(trail(micLevel, 3), 20, 20, width - 40, 100)` plots the last three seconds of the microphone level, and `Math.max(...trail(x, 2))` is a two-second peak. The values are sampled 60 times a second whatever the frame rate, and the gaps between two frames are interpolated, so 30 fps and 144 fps give the same shape.",
        zh: '要畫出來或量一量的歷史：`drawTrail(trail(micLevel, 3), 20, 20, width - 40, 100)` 畫出麥克風音量最近三秒的樣子，`Math.max(...trail(x, 2))` 是兩秒內的最高值。不管畫面更新率是多少，都是每秒取 60 個值，兩個畫面之間的空隙用內插補起來，所以每秒 30 格和 144 格得到同樣的形狀。',
      },
      {
        en: 'Change `seconds` between frames and the history is resized, keeping the newest values. The array you got last frame is never changed afterwards.',
        zh: '在畫面之間改 `seconds`，歷史會跟著調整大小，保留最新的值。上一個畫面拿到的陣列之後不會再被改動。',
      },
    ],
    needs: {
      en: 'Nothing to call or declare: write it in `draw()`. The first call loads @openav/chop, which takes a few frames.',
      zh: '不用呼叫別的東西，也不用宣告：直接寫在 `draw()` 裡。第一次呼叫會載入 @openav/chop，要幾個畫面。',
    },
    notes: [
      ORDER_NOTE,
      { en: '`OAVp5.chop.trail(…)` is this function under another name. To see the line on the canvas use [`drawTrail()`](#drawTrail), to see it in the corner of the page use [`scope()`](#scope).', zh: '`OAVp5.chop.trail(…)` 是同一個函式的另一個名字。要在畫布上看這條線用 [`drawTrail()`](#drawTrail)，要在網頁角落看就用 [`scope()`](#scope)。' },
    ],
    examples: [
      {
        code: `function setup() {
  createCanvas(400, 300);
}

function draw() {
  background(20);
  const wave = 0.5 + 0.5 * sin(frameCount * 0.05);   // 0..1
  stroke(255);
  drawTrail(trail(wave, 3), 20, 100, width - 40, 100);   // the last 3 seconds
}`,
        caption: { en: 'A sine wave drawn from its own history: it scrolls to the left as new values arrive at the right.', zh: '用自己的歷史畫出一條正弦波：新的值從右邊進來，波形往左捲動。' },
      },
      {
        code: `function setup() {
  createCanvas(400, 300);
  noStroke();
}

function draw() {
  background(20);
  const t = trail(mouseX, 1);   // where the mouse was during the last second
  for (let i = 0; i < t.length; i += 6) {
    fill(255, 211, 107, 10 + (i / t.length) * 200);
    circle(t[i], mouseY, 24);
  }
}`,
        caption: { en: 'A ghost trail behind the pointer: the older the copy, the fainter it is.', zh: '滑鼠後面拖著一串殘影：越舊的越淡。' },
      },
      {
        code: `function setup() {
  createCanvas(400, 300);
}

function draw() {
  background(20);
  const t = trail(mouseX, 3);   // the last 3 seconds of the mouse position
  const left = Math.min(...t), right = Math.max(...t);
  noStroke();
  fill(255, 211, 107, 90);
  rect(left, 0, right - left, height);   // the band the mouse covered
  stroke(255);
  drawTrail(t, 0, 20, width, 60, 0, width);
}`,
        caption: { en: 'A band shows how far left and right the mouse went in the last three seconds, with the trail itself drawn across the top.', zh: '一條色帶顯示滑鼠最近三秒往左往右走了多遠，上方畫出軌跡本身。' },
      },
    ],
    claims: [{ before: "trail(0.5, 2, 'claim-trail')", expr: "trail(0.5, 2, 'claim-trail').length", equals: 121 }],
    related: ['drawTrail', 'scope', 'lag', 'slope', 'OAVp5.chop'],
    keywords: {
      en: ['trail', 'history', 'buffer', 'record values', 'past', 'oscilloscope', 'waveform', 'Trail CHOP', 'TouchDesigner'],
      zh: ['軌跡', '歷史', '緩衝', '殘影', '波形', '示波器', 'TouchDesigner'],
    },
  },

  slope: {
    group: 'chop',
    aliases: ['OAVp5.chop.slope'],
    summary: {
      en: 'How fast `value` is changing, per second: positive while it rises, negative while it falls, 0 while it holds still (TouchDesigner\'s Slope CHOP).',
      zh: '`value` 每秒變化多快：上升時是正的，下降時是負的，靜止時是 0（TouchDesigner 的 Slope CHOP）。',
    },
    params: [
      { name: 'value', type: 'Number | Boolean', en: 'The number to watch. A boolean counts as 0 or 1. Anything that is not a finite number keeps the last slope.', zh: '要觀察的數字。布林值算成 0 或 1。不是有限數字的東西，就保留上一個斜率。' },
      NAME,
    ],
    returns: { type: 'Number', en: 'The change per second, in the units of `value` (pixels per second for a pixel position). 0 on the first call, and 0 until @openav/chop has loaded or for an unnamed call outside `draw()`.', zh: '每秒的變化量，單位跟 `value` 一樣（像素位置就是每秒幾像素）。第一次呼叫是 0。@openav/chop 還沒載好之前，以及在 `draw()` 外面沒有名字的呼叫，也是 0。' },
    description: [
      {
        en: "Ask how hard something is moving rather than where it is: `abs(slope(mouseX))` is the mouse speed in pixels per second, and `slope(micLevel)` jumps up at the start of a word. It is as noisy as its input, so smooth it when it flickers: `lag(abs(slope(x)), 0.05, 0.3)`.",
        zh: '問的是東西動得多用力，而不是在哪裡：`abs(slope(mouseX))` 是滑鼠每秒移動幾像素，`slope(micLevel)` 在一個字開頭的時候會往上衝。它的雜訊跟輸入一樣多，閃爍的時候先平滑一下：`lag(abs(slope(x)), 0.05, 0.3)`。',
      },
    ],
    needs: {
      en: 'Nothing to call or declare: write it in `draw()`. The first call loads @openav/chop, which takes a few frames.',
      zh: '不用呼叫別的東西，也不用宣告：直接寫在 `draw()` 裡。第一次呼叫會載入 @openav/chop，要幾個畫面。',
    },
    notes: [
      ORDER_NOTE,
      { en: '`OAVp5.chop.slope(…)` is this function under another name.', zh: '`OAVp5.chop.slope(…)` 是同一個函式的另一個名字。' },
    ],
    examples: [
      {
        code: `function setup() {
  createCanvas(400, 300);
  textSize(16);
}

function draw() {
  background(20);
  const v = abs(slope(mouseX));   // pixels per second
  fill(255);
  text(nf(v, 1, 0) + ' px/s', 20, 120);
  rect(20, 140, min(v / 10, width - 40), 24);
}`,
        caption: { en: 'Move the mouse sideways: the bar and the number show how fast you are going, and drop to 0 when you stop.', zh: '左右移動滑鼠：長條和數字顯示你動得多快，停下來就回到 0。' },
      },
      {
        code: `function setup() {
  createCanvas(400, 300);
}

function draw() {
  background(20);
  const r = spring(mouseIsPressed ? 140 : 60, 100, 6);   // a radius that bounces
  const moving = lag(abs(slope(r)), 0.05, 0.3);          // how fast it is changing, smoothed
  noFill();
  stroke(255, 211, 107);
  strokeWeight(2 + min(14, moving / 40));
  circle(width / 2, height / 2, r * 2);
}`,
        caption: { en: 'Hold the mouse: the ring grows and bounces, and its outline is thickest while it is changing fastest.', zh: '按住滑鼠：圓環長大、彈跳，變化最快的時候外框最粗。' },
      },
    ],
    related: ['lag', 'speed', 'spring', 'trail', 'OAVp5.chop'],
    keywords: {
      en: ['slope', 'derivative', 'velocity', 'rate of change', 'how fast', 'delta', 'Slope CHOP', 'TouchDesigner'],
      zh: ['斜率', '變化率', '速度', '微分', '動得多快', 'TouchDesigner'],
    },
  },

  count: {
    group: 'chop',
    aliases: ['OAVp5.chop.count'],
    summary: {
      en: 'Counts how often `on` has turned on, or how many `\'kick\'` (or any other event) have happened; with a limit it loops 0, 1, … limit − 1.',
      zh: '數 `on` 打開過幾次，或某個事件（像 `\'kick\'`）發生過幾次。給了上限就會循環：0、1、…、上限 − 1（TouchDesigner 的 Count CHOP）。',
    },
    params: [
      { name: 'on', type: 'Boolean | Number | String', en: "A switch: a boolean, or a number above 0.5, and each time it goes from off to on counts one. Or an event name (`'kick'`, `'beat'`, `'note'`, or one of your own fired with [`trigger()`](#trigger)): how many of those events have happened.", zh: "可以是開關：布林值，或大於 0.5 的數字，每次從關變成開就算一次。也可以是事件名字（`'kick'`、`'beat'`、`'note'`，或你自己用 [`trigger()`](#trigger) 發出的）：那種事件到現在發生了幾次。" },
      { name: 'limit', type: 'Number', optional: true, default: '0', en: 'Loop at this number: 4 gives 0 1 2 3 0 1 … Left out, or 0 or less, it keeps counting up.', zh: '數到這個數字就繞回去：4 會得到 0 1 2 3 0 1 …。不寫、或是 0 以下，就一直往上數。' },
      { ...NAME, en: "Only for the switch form (`count(beat, 4, 'a')`): a name for its memory, as the last argument. The event-name form needs none.", zh: "只用在開關的寫法（`count(beat, 4, 'a')`）：給它的記憶取的名字，寫在最後一個參數。事件名字的寫法不需要。" },
    ],
    returns: { type: 'Number', en: 'The count, a whole number from 0. It is 0 until @openav/chop has loaded (a few frames), and for an unnamed switch outside `draw()`.', zh: '計數，從 0 開始的整數。@openav/chop 還沒載好之前（幾個畫面），以及在 `draw()` 外面沒有名字的開關，都回傳 0。' },
    description: [
      {
        en: "A counter you do not have to keep yourself: `count(mouseIsPressed)` is the number of clicks so far, `count(beat, 4)` walks 0 1 2 3 0 1 … on the beat, and `count('kick')` counts the kicks of the drum machine. A switch has to go off and on again to be counted twice.",
        zh: "不用自己維護的計數器：`count(mouseIsPressed)` 是到現在的點擊次數，`count(beat, 4)` 跟著拍子數 0 1 2 3 0 1 …，`count('kick')` 數鼓機的大鼓。開關要關掉再打開，才會算第二次。",
      },
      {
        en: "Event counts start when `count('kick')` is first called, so earlier kicks are not counted. An event of your own fired with `trigger()` is counted from its first firing, whenever `count()` is first called.",
        zh: "事件的計數從第一次呼叫 `count('kick')` 才開始，之前的大鼓不算。你自己用 `trigger()` 發出的事件，從它第一次發出就開始算，不管 `count()` 什麼時候第一次被呼叫。",
      },
    ],
    needs: {
      en: "The event names work like [`env()`](#env): `'kick'`, `'snare'`, `'hat'` and `'beat'` come from the microphone, or from the drum machine once [`startDrums()`](#startDrums) has been called, and the first `count('kick')` asks for the microphone if the drum machine is not on. The first call loads @openav/chop, which takes a few frames.",
      zh: "事件名字的規則跟 [`env()`](#env) 一樣：`'kick'`、`'snare'`、`'hat'`、`'beat'` 來自麥克風，或是呼叫過 [`startDrums()`](#startDrums) 之後來自鼓機，而鼓機沒開的時候，第一次 `count('kick')` 會去要麥克風。第一次呼叫會載入 @openav/chop，要幾個畫面。",
    },
    notes: [
      ORDER_NOTE,
      { en: "A sketch with its own variable or function called `count` keeps it. `OAVp5.chop.count(…)` is this function under another name.", zh: '草圖如果自己有叫 `count` 的變數或函式，就由草圖保留。`OAVp5.chop.count(…)` 是同一個函式的另一個名字。' },
    ],
    examples: [
      {
        code: `function setup() {
  createCanvas(400, 300);
  textAlign(CENTER, CENTER);
  textSize(96);
}

function draw() {
  background(20);
  fill(255);
  text(count(mouseIsPressed), width / 2, height / 2);   // clicks so far
}`,
        caption: { en: 'A counter that goes up by one on every click. Holding the button down counts once.', zh: '每點一下加一的計數器。按住不放只算一次。' },
      },
      {
        code: `function setup() {
  createCanvas(400, 300);
  noStroke();
  startDrums('bd*4, [~ sd]*2, hh*8', 108);
}

function draw() {
  background(20);
  const nth = count('kick', 4);   // 0 1 2 3 0 1 ...
  for (let i = 0; i < 4; i++) {
    fill(i === nth ? color(255, 90, 31) : 70);
    circle(100 + i * 67, 150, i === nth ? 50 : 30);
  }
}`,
        caption: { en: 'Four dots light up one after another, one step per kick of the drum machine. Click the canvas once if you hear nothing.', zh: '四個圓點依序亮起，鼓機每一下大鼓前進一格。如果沒聽到聲音，點一下畫布。' },
      },
      {
        code: `const colors = ['#ff5a1f', '#78beff', '#ffd36b'];

function setup() {
  createCanvas(400, 300);
}

function mousePressed() { trigger('boom'); }

function draw() {
  background(colors[count('boom', 3)]);   // 0 1 2 0 1 2 ...
  fill(20);
  text('clicks: ' + count('boom'), 20, 30);
}`,
        caption: { en: 'Each click cycles the background through three colours, and the text counts the clicks without end.', zh: '每點一下，背景就在三種顏色之間輪流換，文字則不停地數點擊次數。' },
      },
    ],
    claims: [{ before: "trigger('claim-cycle'); trigger('claim-cycle'); trigger('claim-cycle'); trigger('claim-cycle'); trigger('claim-cycle'); count('claim-cycle')", expr: "count('claim-cycle', 4)", equals: 1 }],
    related: ['env', 'trigger', 'beat', 'startDrums', 'OAVp5.chop'],
    keywords: {
      en: ['count', 'counter', 'tally', 'loop', 'modulo', 'step', 'sequence', 'Count CHOP', 'TouchDesigner'],
      zh: ['計數', '計數器', '次數', '循環', '步進', '序列', 'TouchDesigner'],
    },
  },

  scope: {
    group: 'chop',
    aliases: ['OAVp5.chop.scope'],
    summary: {
      en: 'Shows `value` in a small oscilloscope in the corner of the page and gives it back, so you can wrap any expression to watch it.',
      zh: '把 `value` 顯示在網頁角落的小示波器上，並原樣還給你，所以可以包住任何運算式來觀察它。',
    },
    params: [
      { name: 'value', type: 'Number | Boolean', en: 'The number to watch. A boolean is drawn as 0 or 1. Anything that is not a finite number is returned as it is and not drawn.', zh: '要觀察的數字。布林值畫成 0 或 1。不是有限數字的東西原樣回傳，也不會畫。' },
      { name: 'label', type: 'String', optional: true, en: 'The name of this line in the legend. Each label is one line, and a label longer than 9 characters is cut short there. Without one the line is numbered.', zh: '這條線在圖例上的名字。每個標籤是一條線，超過 9 個字元的標籤在圖例上會被截短。不寫的話，這條線用編號。' },
    ],
    returns: { type: 'Number | Boolean', en: 'Exactly `value`, so `circle(x, y, scope(lag(micLevel, 0.03, 0.4), \'lag\') * 300)` works.', zh: '原封不動的 `value`，所以 `circle(x, y, scope(lag(micLevel, 0.03, 0.4), \'lag\') * 300)` 這樣寫就行。' },
    description: [
      {
        en: 'It is a CHOP\'s viewer: each label is one line in a small plot across the page from the 🎹, with the last 4 seconds of the value and its number now. Call it twice in a frame with two labels and you get two lines to compare, raw against smoothed. The scale is at least 0 to 1 and grows to hold whatever the values reach.',
        zh: '它就是 CHOP 的檢視器：每個標籤是一條線，畫在跟 🎹 對角的網頁角落一個小圖上，顯示這個值最近 4 秒的樣子和現在的數字。在一個畫面裡用兩個標籤呼叫兩次，就有兩條線可以比較，例如原始的和平滑過的。刻度至少是 0 到 1，值跑出去就跟著放大。',
      },
      {
        en: 'It lives on the page, not on the canvas: never in a recording or in 📷, and it never takes a click from the sketch. To draw the same line inside the work, use [`drawTrail()`](#drawTrail).',
        zh: '它在網頁上，不在畫布上：不會錄進影片，也不會進 📷，而且不會搶走草圖的點擊。要把同樣的線畫進作品裡，用 [`drawTrail()`](#drawTrail)。',
      },
    ],
    needs: {
      en: 'Only inside `draw()`: anywhere else it just returns `value`. `?oav_scope=off` hides it, and so does `?oav_hints=off`, which is the one thing to know if it does not appear. See [`scope`](#option-scope). The first call loads @openav/chop, which takes a few frames.',
      zh: '只在 `draw()` 裡有作用：其他地方它只會原樣回傳 `value`。`?oav_scope=off` 會把它藏起來，`?oav_hints=off` 也會，這是它沒出現時唯一要知道的事。見 [`scope`](#option-scope)。第一次呼叫會載入 @openav/chop，要幾個畫面。',
    },
    notes: [
      ORDER_NOTE,
      { en: '`OAVp5.chop.scope(…)` is this function under another name. The lines keep coming from the last second: stop calling it for a second and its line leaves the plot.', zh: '`OAVp5.chop.scope(…)` 是同一個函式的另一個名字。線條只保留最近一秒內還有呼叫的：停止呼叫一秒之後，那條線就會從圖上消失。' },
    ],
    examples: [
      {
        code: `function setup() {
  createCanvas(400, 300);
}

function draw() {
  background(20);
  const wave = 0.5 + 0.5 * sin(frameCount * 0.05);
  circle(width / 2, height / 2, 40 + scope(wave, 'wave') * 200);   // watch it in the corner
}`,
        caption: { en: 'The circle breathes, and a small plot in the corner of the page draws the same number as a moving line.', zh: '圓一漲一縮，網頁角落的小圖把同一個數字畫成一條移動的線。' },
      },
      {
        code: `function setup() {
  createCanvas(400, 300);
}

function draw() {
  background(20);
  const raw = frameCount % 120 < 60 ? 1 : 0;   // a square wave
  scope(raw, 'raw');
  const smooth = scope(lag(raw, 0.3, 0.6), 'lag');
  fill(255, 211, 107);
  circle(width / 2, height / 2, 40 + smooth * 200);
}`,
        caption: { en: 'The corner plot shows two lines: the square wave and what lag() makes of it, rising in 0.3 seconds and falling in 0.6.', zh: '角落的圖有兩條線：方波，以及 lag() 把它變成的樣子，上升 0.3 秒、下降 0.6 秒。' },
      },
    ],
    related: ['drawTrail', 'trail', 'lag', 'option:scope', 'option:hints'],
    keywords: {
      en: ['scope', 'oscilloscope', 'plot', 'graph', 'debug', 'watch a value', 'monitor', 'viewer'],
      zh: ['示波器', '圖表', '除錯', '觀察數值', '監看', '檢視器', 'scope'],
    },
  },

  drawTrail: {
    group: 'chop',
    aliases: ['OAVp5.chop.drawTrail'],
    summary: {
      en: 'Draws a line through `values` on the canvas, so it is in the work and in a recording: the oldest at `x`, `lo` at the bottom of the box, `hi` at the top.',
      zh: '在畫布上畫一條穿過 `values` 的線，所以它會在作品裡、也會被錄進影片：最舊的在 `x`，`lo` 在方框底，`hi` 在方框頂。',
    },
    params: [
      { name: 'values', type: 'Array<Number> | Number', en: 'An array such as the one [`trail()`](#trail) returns. Or a single number: then drawTrail keeps its own trail of the last 2 seconds.', zh: '像 [`trail()`](#trail) 回傳的那種陣列。或是單一個數字：這時 drawTrail 會自己保留最近 2 秒的軌跡。' },
      { name: 'x', type: 'Number', optional: true, default: '0', en: 'Left edge of the box.', zh: '方框左邊的位置。' },
      { name: 'y', type: 'Number', optional: true, default: '0', en: 'Top edge of the box.', zh: '方框上緣的位置。' },
      { name: 'w', type: 'Number', optional: true, default: 'width', en: 'Width of the box. Left out, it is the canvas width.', zh: '方框的寬度。不寫就是畫布的寬度。' },
      { name: 'h', type: 'Number', optional: true, default: 'height', en: 'Height of the box. Left out, it is the canvas height.', zh: '方框的高度。不寫就是畫布的高度。' },
      { name: 'lo', type: 'Number', optional: true, default: '0', en: 'The value drawn at the bottom of the box.', zh: '畫在方框底部的那個值。' },
      { name: 'hi', type: 'Number', optional: true, default: '1', en: 'The value drawn at the top of the box. Values outside `lo`..`hi` sit on the edge of the box. If `hi` equals `lo`, the line runs through the middle.', zh: '畫在方框頂部的那個值。超出 `lo` 到 `hi` 的值會貼在方框的邊上。`hi` 等於 `lo` 的話，線會從中間穿過。' },
      { ...NAME, en: "Only when `values` is a single number: a name for its own trail, as the 8th argument (after `hi`).", zh: '只有 `values` 是單一個數字的時候才用：給它自己的軌跡取的名字，寫在第 8 個參數（`hi` 後面）。' },
    ],
    returns: { type: 'Array<Number>', en: 'The array that was drawn: the one you passed, or the number\'s own trail. Nothing is drawn when it has fewer than 2 values.', zh: '畫出來的那個陣列：你傳進來的，或是那個數字自己的軌跡。少於 2 個值的時候不會畫。' },
    description: [
      {
        en: 'The picture [`scope()`](#scope) shows in the corner, but drawn on the canvas: `stroke(255); drawTrail(trail(micLevel, 3), 0, height - 100, width, 100)`. The line is one shape in the sketch\'s own `stroke()` colour and weight (white while `noStroke()` is in effect), with no fill, and the style you had before is put back afterwards.',
        zh: '就是 [`scope()`](#scope) 顯示在角落的那張圖，只是畫在畫布上：`stroke(255); drawTrail(trail(micLevel, 3), 0, height - 100, width, 100)`。這條線是草圖自己的 `stroke()` 顏色和粗細畫出的一個形狀（`noStroke()` 生效時是白色），不填色，畫完之後會把你原本的樣式還原。',
      },
      {
        en: 'The oldest value is at the left edge `x`, the newest at `x + w`. A number instead of an array is the shortcut: `drawTrail(micLevel, 0, 0, width, 100)` draws the last 2 seconds without a separate [`trail()`](#trail) call.',
        zh: '最舊的值在左邊的 `x`，最新的在 `x + w`。傳數字而不傳陣列是捷徑：`drawTrail(micLevel, 0, 0, width, 100)` 不用另外呼叫 [`trail()`](#trail) 就能畫出最近 2 秒。',
      },
    ],
    needs: {
      en: 'Call it in `draw()` after `createCanvas()`. With a number, the first call loads @openav/chop, which takes a few frames, and nothing is drawn until then.',
      zh: '在 `createCanvas()` 之後的 `draw()` 裡呼叫。傳數字的話，第一次呼叫會載入 @openav/chop，要幾個畫面，那之前不會畫任何東西。',
    },
    notes: [
      ORDER_NOTE,
      { en: '`OAVp5.chop.drawTrail(…)` is this function under another name.', zh: '`OAVp5.chop.drawTrail(…)` 是同一個函式的另一個名字。' },
    ],
    examples: [
      {
        code: `function setup() {
  createCanvas(400, 300);
}

function draw() {
  background(20);
  const wave = 0.5 + 0.5 * sin(frameCount * 0.05);
  stroke(255, 211, 107);
  strokeWeight(2);
  drawTrail(wave, 20, 100, width - 40, 100);   // a number: keeps its own 2 seconds
}`,
        caption: { en: 'A moving sine line drawn on the canvas itself, so it would appear in a recording.', zh: '一條移動的正弦線，直接畫在畫布上，所以錄影也會錄到。' },
      },
      {
        code: `function setup() {
  createCanvas(400, 300);
  noFill();
  strokeWeight(2);
}

function draw() {
  background(20);
  const raw = frameCount % 120 < 60 ? 1 : 0;
  const smooth = lag(raw, 0.3, 0.6);
  stroke(95, 224, 138);
  drawTrail(trail(raw, 3), 20, 60, width - 40, 80);       // 0 at the bottom, 1 at the top
  stroke(255, 211, 107);
  drawTrail(trail(smooth, 3), 20, 60, width - 40, 80);    // same box: drawn on top
}`,
        caption: { en: 'The raw square wave in green and its lagged version in yellow, in the same box so you can see the delay.', zh: '綠色是原始的方波，黃色是加了 lag 的版本，畫在同一個方框裡，看得出延遲。' },
      },
      {
        code: `function setup() {
  createCanvas(400, 300);
  noFill();
  stroke(255);
}

function draw() {
  background(20);
  const wave = sin(frameCount * 0.05);   // -1..1
  drawTrail(trail(wave, 3), 20, 100, width - 40, 100, -1, 1);   // lo and hi say what the box shows
}`,
        caption: { en: 'A wave that goes below 0: lo = -1 and hi = 1 put the bottom of the box at -1 and the top at 1, so the whole wave fits.', zh: '一條會掉到 0 以下的波：`lo` = -1、`hi` = 1 讓方框底是 -1、頂是 1，整條波就放得下。' },
      },
    ],
    related: ['trail', 'scope', 'lag', 'OAVp5.chop'],
    keywords: {
      en: ['drawTrail', 'draw a trail', 'plot', 'graph', 'line chart', 'history line', 'waveform', 'record the plot'],
      zh: ['畫軌跡', '圖表', '折線圖', '歷史曲線', '波形', '畫在畫布上', '錄進影片'],
    },
  },

  'OAVp5.chop': {
    group: 'chop',
    summary: {
      en: 'The CHOP functions under one roof, plus the state of the module behind them: `OAVp5.chop.lag(…)`, `.state`, `.slots()`, `.reset()`.',
      zh: 'CHOP 函式放在同一個地方，加上它們背後模組的狀態：`OAVp5.chop.lag(…)`、`.state`、`.slots()`、`.reset()`。',
    },
    description: [
      {
        en: "Every function of this group is also here: `OAVp5.chop.lag`, `.env`, `.trigger`, `.speed`, `.spring`, `.trail`, `.slope`, `.count`, `.scope` and `.drawTrail` are the same functions as the plain names, for a sketch whose own `speed` or `count` keeps the plain name.",
        zh: '這一組的每個函式這裡都有：`OAVp5.chop.lag`、`.env`、`.trigger`、`.speed`、`.spring`、`.trail`、`.slope`、`.count`、`.scope`、`.drawTrail` 跟一般的名稱是同一批函式，給那些自己的 `speed` 或 `count` 保留了一般名稱的草圖用。',
      },
      {
        en: 'The rest is for looking inside: [`state`](#OAVp5.chop.state) says whether the module is loaded, [`module`](#OAVp5.chop.module) is the module itself, [`slots()`](#OAVp5.chop.slots) lists every memory in use and [`reset()`](#OAVp5.chop.reset) forgets them.',
        zh: '其餘的是用來看裡面的：[`state`](#OAVp5.chop.state) 說模組載好了沒，[`module`](#OAVp5.chop.module) 就是模組本身，[`slots()`](#OAVp5.chop.slots) 列出正在用的每一個記憶，[`reset()`](#OAVp5.chop.reset) 把它們忘掉。',
      },
    ],
    notes: [
      { en: 'This is advanced: a sketch that only calls `lag()` and friends never needs it.', zh: '這是進階用法：只呼叫 `lag()` 這些函式的草圖用不到它。' },
    ],
    examples: [
      {
        code: `function setup() {
  createCanvas(400, 300);
}

function draw() {
  background(20);
  const x = OAVp5.chop.lag(mouseX, 0.4);   // the same as lag(mouseX, 0.4)
  fill(255);
  text('chop ' + OAVp5.chop.state + ', ' + OAVp5.chop.slots().length + ' memory in use', 20, 30);
  circle(x, height / 2, 40);
}`,
        caption: { en: 'A circle chasing the mouse through OAVp5.chop.lag, with the module\'s state and the number of memories in use printed above it.', zh: '一個透過 OAVp5.chop.lag 追著滑鼠的圓，上方印出模組的狀態和正在用的記憶數量。' },
      },
    ],
    related: ['lag', 'env', 'OAVp5.chop.state', 'OAVp5.chop.slots', 'OAVp5.chop.reset'],
    keywords: {
      en: ['OAVp5.chop', 'chop object', 'chop module', 'values over time', 'TouchDesigner'],
      zh: ['chop 物件', 'chop 模組', '數值隨時間變化', 'TouchDesigner'],
    },
  },

  'OAVp5.chop.state': {
    group: 'chop',
    summary: {
      en: 'Where the @openav/chop module is: `\'off\'`, `\'loading\'`, `\'on\'` or `\'error\'`.',
      zh: '@openav/chop 模組目前的狀態：`\'off\'`、`\'loading\'`、`\'on\'` 或 `\'error\'`。',
    },
    value: {
      type: 'String', range: "'off' | 'loading' | 'on' | 'error'",
      en: 'Changes the first time a CHOP function is called and once more when the module has arrived. `off` before any call.',
      zh: '第一次呼叫 CHOP 函式的時候會變，模組載好時再變一次。在任何呼叫之前是 `off`。',
    },
    description: [
      {
        en: "`off` until one of these functions is first called, `loading` while @openav/chop arrives (a few frames), `on` once it is in, `error` if it could not be loaded: a card says so and every function then passes its input through. [`trigger()`](#trigger) on its own never loads it, because it only records that something happened.",
        zh: '在任何一個函式第一次被呼叫之前是 `off`，@openav/chop 在載入的時候（幾個畫面）是 `loading`，載好之後是 `on`，載不到是 `error`：這時會跳出卡片，所有函式也都改成把輸入直接穿過去。單獨呼叫 [`trigger()`](#trigger) 不會載入它，因為它只記錄「發生了一件事」。',
      },
    ],
    examples: [
      {
        code: `function setup() {
  createCanvas(400, 300);
}

function draw() {
  background(20);
  fill(255);
  text('chop: ' + OAVp5.chop.state, 20, 30);   // off, then loading, then on
  if (frameCount > 30) circle(lag(mouseX, 0.3), height / 2, 30);   // the first lag() loads the module
}`,
        caption: { en: 'For half a second it says off. The first lag() call then loads the module: loading, then on.', zh: '前半秒它顯示 off。接著第一次呼叫 lag() 就載入模組：loading，然後 on。' },
      },
    ],
    claims: [{ expr: 'OAVp5.chop.state', equals: 'off' }],
    related: ['OAVp5.chop.module', 'OAVp5.chop', 'lag'],
    keywords: { en: ['chop state', 'loaded', 'loading', 'module ready'], zh: ['chop 狀態', '載入', '載好了沒', '模組'] },
  },

  'OAVp5.chop.module': {
    group: 'chop',
    summary: {
      en: 'The @openav/chop module itself once it has loaded, otherwise `null`: the classes and functions the CHOP functions are built on.',
      zh: '@openav/chop 模組本身，載好之後才有，之前是 `null`：CHOP 函式底下用的那些類別和函式。',
    },
    value: {
      type: 'Object | null',
      en: '`null` until the first CHOP function has been called and the module has arrived, then the module (`Lag`, `Spring`, `Trail`, `envelope()`, `DEFAULTS` and the rest).',
      zh: '第一次呼叫 CHOP 函式、而且模組載好之前是 `null`，之後就是那個模組（`Lag`、`Spring`、`Trail`、`envelope()`、`DEFAULTS` 等等）。',
    },
    description: [
      {
        en: 'For reaching below the p5-style calls: `OAVp5.chop.module.DEFAULTS` lists the defaults the functions use, and `new OAVp5.chop.module.Lag({ up: 0.1 })` makes a lag you keep yourself. Check it is not `null` first.',
        zh: '要用到比 p5 風格呼叫更底層的東西時才需要：`OAVp5.chop.module.DEFAULTS` 列出這些函式用的預設值，`new OAVp5.chop.module.Lag({ up: 0.1 })` 做出一個你自己保管的 lag。先確認它不是 `null`。',
      },
    ],
    notes: [
      { en: 'This is advanced. The module is also published as `@openav/chop` for sketches and shows that do not go through oav-p5.', zh: '這是進階用法。這個模組也以 `@openav/chop` 發布，給不經過 oav-p5 的草圖和演出使用。' },
    ],
    examples: [
      {
        code: `function setup() {
  createCanvas(400, 300);
}

function draw() {
  background(20);
  lag(mouseX, 0.3, 0.3, 'warm-up');   // the first call loads the module
  const m = OAVp5.chop.module;
  fill(255);
  text(m ? 'spring defaults: ' + JSON.stringify(m.DEFAULTS.spring) : 'not loaded yet', 20, 30);
}`,
        caption: { en: 'Prints the spring defaults from the module as soon as it has loaded.', zh: '模組一載好，就印出它裡面 spring 的預設值。' },
      },
    ],
    claims: [{ expr: 'OAVp5.chop.module === null', equals: true }],
    related: ['OAVp5.chop.state', 'OAVp5.chop'],
    keywords: { en: ['chop module', '@openav/chop', 'Lag class', 'DEFAULTS'], zh: ['chop 模組', '@openav/chop', '預設值'] },
  },

  'OAVp5.chop.slots': {
    group: 'chop',
    summary: {
      en: 'Lists every memory the CHOP functions are using right now: its kind, how it is found, and its latest value.',
      zh: '列出 CHOP 函式現在用的每一個記憶：是哪一種、怎麼找到它、最新的值是多少。',
    },
    params: [],
    returns: { type: 'Array<Object>', en: "One `{ kind, key, mode, value }` per memory. `kind` is the function (`'lag'`, `'spring'`, …). `key` is `'#1'`, `'#2'` for calls found by order, a name for named ones, or the line of code for calls matched by line. `mode` says which: `'order'`, `'name'` or `'site'`. `value` is its latest output (missing for a trail).", zh: "每一個記憶一筆 `{ kind, key, mode, value }`。`kind` 是哪個函式（`'lag'`、`'spring'` …）。`key` 是靠順序找到的呼叫的 `'#1'`、`'#2'`，有名字的就是名字，靠行號對應的就是那一行程式。`mode` 說明是哪一種：`'order'`、`'name'` 或 `'site'`。`value` 是它最近一次的輸出（trail 沒有）。" },
    description: [
      {
        en: 'For finding out why two calls seem to share a memory, or whether a loop made hundreds: `OAVp5.chop.slots().length` is how many there are. It reads the state and changes nothing.',
        zh: '用來查為什麼兩個呼叫好像共用同一個記憶，或迴圈是不是做出了好幾百個：`OAVp5.chop.slots().length` 就是現在有幾個。它只讀取狀態，不會改任何東西。',
      },
    ],
    notes: [
      { en: 'This is advanced. 🩺 and tests use it; a sketch rarely needs to.', zh: '這是進階用法。🩺 和測試會用到，草圖很少需要。' },
    ],
    examples: [
      {
        code: `function setup() {
  createCanvas(400, 300);
  textSize(14);
}

function draw() {
  background(20);
  lag(mouseX, 0.3);
  lag(mouseY, 0.3);
  spring(mouseX, 100, 6, 'ball');
  fill(255);
  const lines = OAVp5.chop.slots().map((s) => s.kind + ' ' + s.key + ' (' + s.mode + ')');
  text(lines.join('\\n'), 20, 30);
}`,
        caption: { en: 'Lists the memories the three calls are using: two lags found by order and one spring found by its name.', zh: '列出這三個呼叫在用的記憶：兩個靠順序找到的 lag，和一個靠名字找到的 spring。' },
      },
    ],
    related: ['OAVp5.chop.reset', 'OAVp5.chop', 'lag'],
    keywords: { en: ['chop slots', 'memory', 'list', 'debug', 'inspect'], zh: ['chop 記憶', '列出', '除錯', '檢查'] },
  },

  'OAVp5.chop.reset': {
    group: 'chop',
    summary: {
      en: 'Forgets the memory named `name` (a lag, a speed total, a count …), or every memory when you give no name: the next call starts fresh.',
      zh: '忘掉叫 `name` 的那個記憶（lag、speed 的累計、計數…），不給名字就全部忘掉：下一次呼叫會重新開始。',
    },
    params: [
      { name: 'name', type: 'String', optional: true, en: "The name you gave a call as its last argument (`'spin'` in `speed(1, 'spin')`). The memory of that name is forgotten in every function that has one. Left out, every memory is forgotten, named or not.", zh: "你在呼叫的最後一個參數給的名字（`speed(1, 'spin')` 裡的 `'spin'`）。每個函式裡那個名字的記憶都會被忘掉。不寫的話，不管有沒有名字，全部忘掉。" },
    ],
    description: [
      {
        en: 'The call that follows starts from nothing, as if it were the first one: a `speed()` total is 0 again, a `lag()` takes its input as it is, a `count()` is back at 0. Use it to restart a named effect, for example on a key press.',
        zh: '接下來的那次呼叫會從零開始，就像是第一次：`speed()` 的累計值回到 0，`lag()` 照單全收輸入，`count()` 回到 0。想讓某個有名字的效果重新開始時用，例如按一個鍵的時候。',
      },
      {
        en: 'Calling it with no name also drops the unnamed memories. They are made again by order on the next frame, so nothing breaks, but every unnamed value starts over too. Event counts from `trigger()` are not memories of a call and are not touched.',
        zh: '不給名字的時候，沒有名字的記憶也一起丟掉。下一個畫面會重新照順序建立，所以不會壞掉，但每一個沒有名字的值也都重新開始。`trigger()` 的事件次數不是某個呼叫的記憶，不受影響。',
      },
    ],
    examples: [
      {
        code: `function setup() {
  createCanvas(400, 300);
}

function mousePressed() {
  OAVp5.chop.reset('spin');   // forget the named speed
}

function draw() {
  background(20);
  translate(width / 2, height / 2);
  rotate(speed(1, 'spin'));
  rect(-40, -40, 80, 80);
}`,
        caption: { en: 'The square turns steadily. Click: it jumps back to its starting angle and carries on from there.', zh: '方塊平穩地轉。點一下：它跳回起始的角度，再從那裡繼續轉。' },
      },
    ],
    related: ['OAVp5.chop.slots', 'OAVp5.chop', 'speed', 'count'],
    keywords: { en: ['reset', 'restart', 'forget', 'clear memory', 'start over'], zh: ['重設', '重新開始', '忘掉', '清除記憶', '歸零'] },
  },
};
