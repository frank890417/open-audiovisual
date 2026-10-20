// oav-p5 reference: the loading options. Read by tools/build-reference.mjs (see AGENTS.md, "Documenting a public name").
// Every example starts with `window.OAV_P5 = { … };`: it has to run before oav-p5 loads, so the page puts the loader line right after it.
//
// How an option is read (p5/oav-p5.js, opt()): window.OAV_P5[key] first, then ?oav_<key> on the page address, then ?<key> on the
// script's own URL, then the default. A value from window.OAV_P5 is turned into text (String(value)), which is why 'off' works and false does not.

const how = (key) => ({
  en: `Set it before oav-p5 loads. \`window.OAV_P5 = { ${key}: … };\` above the loader line wins, then \`?oav_${key}=…\` on the page address, then \`?${key}=…\` on the script's own URL. Values in \`window.OAV_P5\` are turned into text, so write \`'off'\`, not \`false\`. On OpenProcessing the page address takes \`?sketch_oav_${key}=…\` (the project's README says OpenProcessing forwards it to the sketch).`,
  zh: `要在 oav-p5 載入之前設好。寫在載入那一行上面的 \`window.OAV_P5 = { ${key}: … };\` 優先，其次是網頁網址上的 \`?oav_${key}=…\`，最後是 script 自己網址上的 \`?${key}=…\`。寫在 \`window.OAV_P5\` 裡的值會被轉成文字，所以要寫 \`'off'\`，不要寫 \`false\`。在 OpenProcessing 上，網頁網址要寫成 \`?sketch_oav_${key}=…\`（專案的 README 說 OpenProcessing 會把它轉給草圖）。`,
});

const PLAY = {
  en: 'Plug in a controller, or press 🎹 (bottom right) and use the on-screen one.',
  zh: '接上控制器，或按右下角的 🎹 用螢幕上的控制器。',
};

export default {
  'option:clock': {
    group: 'options',
    summary: {
      en: 'Whether an external MIDI clock (from a DAW, Strudel or a drum machine) moves `drumPhase`, `drumBpm` and the drum machine: `follow` or `off`.',
      zh: '外部的 MIDI 時鐘（來自 DAW、Strudel 或鼓機）要不要推動 `drumPhase`、`drumBpm` 和鼓機：`follow` 或 `off`。',
    },
    value: {
      type: 'String', options: 'follow | off', default: 'follow',
      en: 'Anything except `off` means `follow`.',
      zh: '`off` 以外的任何值都當作 `follow`。',
    },
    description: [
      {
        en: "With `follow`, an external MIDI clock (24 ticks a beat, plus start, stop and song position) is followed: [`drumPhase`](#drumPhase), [`beatPhase`](#beatPhase), [`drumBar`](#drumBar), [`drumStep`](#drumStep) and [`drumBpm`](#drumBpm) read it, and a drum machine that is up takes its tempo and its downbeat from it, starting and stopping with it. [`OAVp5.clock`](#OAVp5.clock) tells you what it hears. With nothing sending a clock, nothing changes.",
        zh: '設成 `follow` 的時候，外部的 MIDI 時鐘（每拍 24 個 tick，加上 start、stop 和 song position）會被跟隨：[`drumPhase`](#drumPhase)、[`beatPhase`](#beatPhase)、[`drumBar`](#drumBar)、[`drumStep`](#drumStep)、[`drumBpm`](#drumBpm) 讀的就是它，已經在跑的鼓機也會從它取得速度和第一拍，跟著它開始和停止。[`OAVp5.clock`](#OAVp5.clock) 會告訴你它聽到什麼。沒有東西送時鐘過來的時候，什麼都不會改變。',
      },
      {
        en: "`off` ignores every clock message: `OAVp5.clock.info.state` stays `'none'`. Use it when something on the page or the machine sends a clock you do not want the sketch to follow.",
        zh: "`off` 會忽略所有時鐘訊息：`OAVp5.clock.info.state` 一直是 `'none'`。頁面上或機器上有東西在送時鐘、而你不想讓草圖跟著它走的時候用。",
      },
    ],
    notes: [how('clock')],
    examples: [
      {
        code: `window.OAV_P5 = { clock: 'off' };

function setup() {
  createCanvas(400, 300);
  OAVp5.input([0xFA]);                          // MIDI start
  setInterval(() => OAVp5.input([0xF8]), 20);   // clock ticks: 24 a beat, here 50 a second
}

function draw() {
  background(20);
  fill(255);
  text('clock option: ' + OAVp5.options.clock, 20, 30);
  text('external clock: ' + OAVp5.clock.info.state, 20, 60);   // none: the clock is ignored
}`,
        caption: { en: 'The sketch sends itself a made-up MIDI clock, and with `clock: \'off\'` it is ignored: the state stays "none". Delete the first line and it reads "running".', zh: "草圖自己送出一個假的 MIDI 時鐘，設成 `clock: 'off'` 就被忽略：狀態一直是 \"none\"。把第一行刪掉，就會變成 \"running\"。" },
      },
    ],
    claims: [{ expr: 'OAVp5.options.clock', equals: 'follow' }],
    related: ['OAVp5.clock', 'drumPhase', 'beatPhase', 'startDrums', 'option:link'],
    keywords: { en: ['clock', 'midi clock', 'sync', 'tempo', 'external clock', 'follow', 'DAW', 'Strudel'], zh: ['時鐘', 'midi 時鐘', '同步', '速度', '外部時鐘', '跟隨', 'DAW'] },
  },

  'option:compact': {
    group: 'options',
    summary: {
      en: 'Shows the 🎹 panel as a small box in the corner, a third of the window high, instead of a full-width bar: `on` or `off`.',
      zh: '把 🎹 面板顯示成角落的一個小方塊，高度是視窗的三分之一，而不是整條橫幅：`on` 或 `off`。',
    },
    value: {
      type: 'String', options: 'on | off', default: 'off (on in Strudel)',
      en: 'Only `on` turns it on. `OAVp5.options.compact` reads back as `true` or `false`.',
      zh: '只有 `on` 會打開它。`OAVp5.options.compact` 讀回來是 `true` 或 `false`。',
    },
    description: [
      {
        en: 'Normally the panel opened by 🎹 is a bar across the whole window, up to half its height. With `compact` it is a box at most 560 pixels wide and a third of the window high, in the corner the 🎹 sits in, so the page beside it stays in view. It is the default on strudel.cc, where the code editor needs the room.',
        zh: '一般來說，按 🎹 打開的面板是橫跨整個視窗的一條，最高到視窗的一半。設成 `compact` 就變成一個最寬 560 像素、高度是視窗三分之一的方塊，放在 🎹 所在的那個角落，旁邊的頁面還看得到。在 strudel.cc 上它是預設，因為程式編輯器需要那塊空間。',
      },
    ],
    notes: [how('compact')],
    examples: [
      {
        code: `window.OAV_P5 = { compact: 'on', panel: 'open' };

function setup() {
  createCanvas(400, 300);
}

function draw() {
  background(20);
  fill(255);
  text('compact: ' + OAVp5.options.compact, 20, 30);   // true
}`,
        caption: { en: 'The panel opens at once as a box in the bottom-right corner instead of a bar across the whole window.', zh: '面板一開始就打開，是右下角的一個方塊，而不是橫跨整個視窗的一條。' },
      },
    ],
    claims: [{ expr: 'OAVp5.options.compact', equals: false }],
    related: ['option:panel', 'option:strudel', 'option:corner', 'option:dock'],
    keywords: { en: ['compact', 'small panel', 'corner box', 'strudel', 'panel size'], zh: ['精簡', '小面板', '角落', 'strudel', '面板大小'] },
  },

  'option:corner': {
    group: 'options',
    summary: {
      en: 'Which side of the window the 🎹 button, its cards and the compact panel sit on: `right` or `left`.',
      zh: '🎹 按鈕、它的提示卡片和精簡面板放在視窗的哪一邊：`right` 或 `left`。',
    },
    value: {
      type: 'String', options: 'right | left', default: 'right (left on OpenProcessing)',
      en: 'Anything except `left` means `right`.',
      zh: '`left` 以外的任何值都當作 `right`。',
    },
    description: [
      {
        en: "Moves the 🎹 to the left or right edge, with the cards that appear beside it. [`scope()`](#scope) draws on the opposite side, so the two never meet. On openprocessing.org the default is `left`, because OpenProcessing's own icon sits at the top right.",
        zh: '把 🎹 移到左邊或右邊，它旁邊出現的卡片也跟著移動。[`scope()`](#scope) 畫在對面那一側，所以兩個不會碰在一起。在 openprocessing.org 上預設是 `left`，因為 OpenProcessing 自己的圖示在右上角。',
      },
    ],
    notes: [how('corner')],
    examples: [
      {
        code: `window.OAV_P5 = { corner: 'left' };

function setup() {
  createCanvas(400, 300);
}

function draw() {
  background(20);
  fill(255);
  text('corner: ' + OAVp5.options.corner + ' (look for the 🎹)', 20, 30);
}`,
        caption: { en: 'The 🎹 button sits in the bottom-left corner of the window instead of the bottom-right.', zh: '🎹 按鈕在視窗的左下角，不是右下角。' },
      },
    ],
    claims: [{ expr: 'OAVp5.options.corner', equals: 'right' }],
    related: ['option:dock', 'option:panel', 'option:compact', 'scope'],
    keywords: { en: ['corner', 'left', 'right', 'position', 'move the button', 'layout'], zh: ['角落', '左邊', '右邊', '位置', '移動按鈕', '版面'] },
  },

  'option:debug': {
    group: 'options',
    summary: {
      en: 'Prints `[oav-p5 debug]` lines in the console about clicks, the 🎹 button and loading, for finding out why the 🎹 does not respond.',
      zh: '在 console 印出 `[oav-p5 debug]` 開頭的幾行，關於點擊、🎹 按鈕和載入，用來查 🎹 為什麼沒反應。',
    },
    value: {
      type: 'String', options: '1 | 0', default: "'' (off)",
      en: 'Any value except an empty one and `0` turns it on.',
      zh: '除了空的和 `0`，任何值都會打開它。',
    },
    description: [
      {
        en: "Two seconds after the 🎹 is placed, a line says whether the 🎹 in the page is oav-p5's own copy and where oav-p5 loads the rest of OAV from. Every click then adds a line with the pointer position, what was clicked, and what is on top at that spot, which is how you find a page element sitting over the 🎹. It also says when the panel opens, when the page replaced the 🎹 and which name asked for the microphone.",
        zh: '🎹 放上頁面兩秒之後，會印出一行說頁面上的 🎹 是不是 oav-p5 自己的那一個，以及 oav-p5 從哪裡載入 OAV 的其他部分。之後每次點擊都多一行，記下指標的位置、點到了什麼、那個位置最上面是什麼，這就是找出是哪個頁面元素蓋在 🎹 上面的方法。面板打開、頁面把 🎹 換掉、是哪個名稱去要了麥克風，它也會說。',
      },
    ],
    notes: [how('debug')],
    examples: [
      {
        code: `window.OAV_P5 = { debug: 1 };

function setup() {
  createCanvas(400, 300);
}

function draw() {
  background(20);
  fill(255);
  text('open the console, then click the canvas', 20, 30);   // [oav-p5 debug] lines appear
}`,
        caption: { en: 'Open the console: two seconds after load a debug line talks about the 🎹, and every click on the canvas adds one saying what was under the pointer.', zh: '打開 console：載入兩秒之後會有一行 debug 說到 🎹，之後每點一下畫布就多一行，說指標底下是什麼。' },
      },
    ],
    related: ['option:hints', 'option:panel', 'OAVp5.check'],
    keywords: { en: ['debug', 'console', 'troubleshoot', 'button does not respond', 'trace', 'log'], zh: ['除錯', 'console', '疑難排解', '按鈕沒反應', '追蹤', '記錄'] },
  },

  'option:dock': {
    group: 'options',
    summary: {
      en: 'Which edge of the window the 🎹 button and its cards sit on, `bottom` or `top`; set it and the panel starts on that edge too.',
      zh: '🎹 按鈕和它的提示卡片放在視窗的哪個邊：`bottom` 或 `top`。有設定的話，面板一開始也在這個邊。',
    },
    value: {
      type: 'String', options: 'bottom | top', default: 'bottom (top on OpenProcessing)',
      en: 'Anything except `top` means `bottom`.',
      zh: '`top` 以外的任何值都當作 `bottom`。',
    },
    description: [
      {
        en: "Moves the 🎹, its cards and the panel to the top or bottom edge. On openprocessing.org the default is `top`, because OpenProcessing's console floats over the bottom of the sketch. The drum machine's card sits below a panel docked at the top.",
        zh: '把 🎹、它的卡片和面板移到上緣或下緣。在 openprocessing.org 上預設是 `top`，因為 OpenProcessing 的 console 會浮在草圖的下方。鼓機的卡片會放在固定在上緣的面板下面。',
      },
      {
        en: "The panel itself has two buttons for whoever is looking at it: **Dock** cycles bottom → top → floating (drag a floating panel by its bar), and **Size** cycles small → medium → large. This browser remembers the choice, and it wins over the option. When the sketch sets no `dock`, the panel starts at the bottom, also on openprocessing.org (from 2026-10-20: at the top it covered the sketch). The 🎹 moves out of the panel's way only when the two share an edge. Reloading the same page (Cmd+Enter on OpenProcessing) opens the panel again if it was open, and restarts drums started from its 🥁 on the same line and tempo.",
        zh: '面板上有兩個按鈕給正在看的人用：「位置」依序切換下方、上方、浮動（浮動時拖曳面板上面那一列就能移動），「大小」依序切換小、中、大。這個瀏覽器會記住你的選擇，而且優先於這個選項。草圖沒有設定 `dock` 時，面板一開始在下方，openprocessing.org 上也一樣（2026-10-20 起，之前放在上方會蓋住草圖）。只有面板和 🎹 在同一個邊時，🎹 才會讓開。同一個頁面重新整理（OpenProcessing 按 Cmd+Enter）時，面板原本開著就會自動打開，從面板 🥁 開的鼓機也會用同一行節奏和速度再打起來。',
      },
    ],
    notes: [how('dock')],
    examples: [
      {
        code: `window.OAV_P5 = { dock: 'top' };

function setup() {
  createCanvas(400, 300);
}

function draw() {
  background(20);
  fill(255);
  text('dock: ' + OAVp5.options.dock + ' (look for the 🎹)', 20, 30);
}`,
        caption: { en: 'The 🎹 button sits at the top-right of the window instead of the bottom-right.', zh: '🎹 按鈕在視窗的右上角，不是右下角。' },
      },
    ],
    claims: [{ expr: 'OAVp5.options.dock', equals: 'bottom' }],
    related: ['option:corner', 'option:panel', 'option:compact'],
    keywords: { en: ['dock', 'top', 'bottom', 'position', 'move the button', 'layout', 'openprocessing console'], zh: ['停靠', '上方', '下方', '位置', '移動按鈕', '版面', 'openprocessing console'] },
  },

  'option:drumlatency': {
    group: 'options',
    summary: {
      en: 'How long it takes a drum hit to be heard after oav-p5 hands it to the audio clock, so pictures land with the sound: `auto` or milliseconds.',
      zh: '鼓點從 oav-p5 交給音訊時鐘到你聽到要多久，讓畫面跟聲音同時到：`auto` 或毫秒數。',
    },
    value: {
      type: 'String | Number', options: 'auto | 0 to 500 (milliseconds)', default: 'auto',
      en: 'A number is held between 0 and 500. Anything that is not a number means `auto`. `OAVp5.options.drumlatency` reads back in seconds (`0.2` for 200).',
      zh: '數字會被限制在 0 到 500 之間。不是數字的值都當作 `auto`。`OAVp5.options.drumlatency` 讀回來的單位是秒（200 讀回 `0.2`）。',
    },
    description: [
      {
        en: "The drum machine hands each hit to the audio clock slightly ahead of time, and tells the sketch ([`drumHit()`](#drumHit), [`kickDetected()`](#kickDetected), [`env('kick')`](#env)) when you will hear it, which is the scheduled moment plus the output latency. `auto` uses the latency the browser reports. If the browser's figure is smaller than what your output really takes, the picture runs ahead of the sound, and giving the number yourself fixes that. The project's README names a Bluetooth speaker as the case and suggests trying 200.",
        zh: "鼓機把每一下鼓點稍微提前交給音訊時鐘，並在你會聽到的那一刻通知草圖（[`drumHit()`](#drumHit)、[`kickDetected()`](#kickDetected)、[`env('kick')`](#env)），那一刻就是排定的時間加上輸出的延遲。`auto` 用瀏覽器回報的延遲。瀏覽器回報的數字如果比你的輸出實際花的時間小，畫面就會跑在聲音前面，自己給一個數字就能解決。專案的 README 舉的例子是藍牙喇叭，並建議試試 200。",
      },
    ],
    notes: [
      { en: "Only the default drum machine (`drums=lookahead`) uses it: the frame-driven one has nothing scheduled ahead.", zh: '只有預設的鼓機（`drums=lookahead`）會用到它：逐幀推進的那一種沒有提前排程的東西。' },
      how('drumlatency'),
    ],
    tbd: [
      { en: 'No Bluetooth speaker was tried: the suggested 200 comes from the project\'s README, not from a measurement made for this page.', zh: '沒有用藍牙喇叭試過：建議的 200 來自專案的 README，不是為這一頁量過的。' },
    ],
    examples: [
      {
        code: `window.OAV_P5 = { drumlatency: 200 };

function setup() {
  createCanvas(400, 300);
  startDrums('bd*4, [~ sd]*2, hh*8', 108);
}

function draw() {
  background(20);
  fill(255);
  text('drumlatency: ' + OAVp5.options.drumlatency + ' s', 20, 30);
  circle(width / 2, height / 2, 50 + env('kick', 0.01, 0.3) * 200);   // told 0.2 s after the hit is scheduled
}`,
        caption: { en: 'The circle swells on each kick, told 200 milliseconds after the hit was handed to the audio clock, to match a speaker that is that late. Click the canvas once if you hear nothing.', zh: '圓在每一下大鼓脹大，通知的時間是鼓點交給音訊時鐘 200 毫秒之後，配合一個正好慢那麼多的喇叭。如果沒聽到聲音，點一下畫布。' },
      },
    ],
    claims: [{ expr: 'OAVp5.options.drumlatency', equals: 'auto' }],
    related: ['option:drums', 'startDrums', 'drumHit', 'env'],
    keywords: { en: ['drum latency', 'latency', 'bluetooth', 'audio delay', 'sync picture and sound', 'lip sync'], zh: ['鼓機延遲', '延遲', '藍牙', '聲音延遲', '畫面聲音同步', '對嘴'] },
  },

  'option:drums': {
    group: 'options',
    summary: {
      en: 'How the drum machine is clocked: `lookahead` (hits scheduled ahead on the audio clock) or `frame` (moved by animation frames, 0.5\'s way).',
      zh: '鼓機用什麼來計時：`lookahead`（提前在音訊時鐘上排程）或 `frame`（跟著動畫畫面走，0.5 版的做法）。',
    },
    value: {
      type: 'String', options: 'lookahead | frame', default: 'lookahead',
      en: 'Anything except `frame` means `lookahead`.',
      zh: '`frame` 以外的任何值都當作 `lookahead`。',
    },
    description: [
      {
        en: "With `lookahead`, a heartbeat in a Web Worker hands the hits to the audio clock a little ahead of time, so the beat stays steady when frames stutter or the tab is busy, and the sketch is told when each hit is heard. With `frame`, the machine is moved by the animation frames instead, as it was in oav-p5 0.5. It is the safety net: where the lookahead machine misbehaves, `frame` brings the old behaviour back, and the timing is then only as steady as the frame rate.",
        zh: '設成 `lookahead` 的時候，Web Worker 裡有一個心跳，會把鼓點提前一點交給音訊時鐘，所以畫面卡頓或分頁很忙的時候，拍子還是穩的，草圖也會在每一下鼓點被聽到的時候收到通知。設成 `frame` 則是回到 oav-p5 0.5 的做法，由動畫畫面推著鼓機走。這是保險：提前排程的鼓機在某個地方出狀況的時候，`frame` 把舊的做法找回來，這時拍子只會跟畫面更新率一樣穩。',
      },
    ],
    notes: [
      { en: '`OAVp5.drums.clock` and the 🩺 check-up say which clock is running.', zh: '`OAVp5.drums.clock` 和 🩺 體檢會告訴你現在是哪一種時鐘在跑。' },
      how('drums'),
    ],
    examples: [
      {
        code: `window.OAV_P5 = { drums: 'frame' };

function setup() {
  createCanvas(400, 300);
  startDrums('bd*4, [~ sd]*2, hh*8', 108);
}

function draw() {
  background(20);
  fill(255);
  text('drums: ' + OAVp5.options.drums + ' (clock: ' + OAVp5.drums.clock.clock + ')', 20, 30);
  circle(width / 2, height / 2, 50 + env('kick', 0.01, 0.3) * 200);
}`,
        caption: { en: 'The drum machine is moved by the animation frames, and the text says so. Click the canvas once if you hear nothing.', zh: '鼓機由動畫畫面推著走，文字也這麼說。如果沒聽到聲音，點一下畫布。' },
      },
    ],
    claims: [{ expr: 'OAVp5.options.drums', equals: 'lookahead' }],
    related: ['option:drumlatency', 'startDrums', 'OAVp5.check'],
    keywords: { en: ['drums clock', 'lookahead', 'frame', 'timing', 'safety net', 'worker', 'drum machine'], zh: ['鼓機時鐘', '提前排程', '逐幀', '節拍準確', '保險', 'worker', '鼓機'] },
  },

  'option:hardware': {
    group: 'options',
    summary: {
      en: 'When oav-p5 asks the browser for Web MIDI, which a real controller needs: `auto` at load, `click` when the 🎹 panel opens, or `off`.',
      zh: 'oav-p5 什麼時候向瀏覽器要 Web MIDI（真的控制器需要它）：`auto` 是載入時，`click` 是 🎹 面板打開時，`off` 是不要。',
    },
    value: {
      type: 'String', options: 'auto | click | off', default: 'auto (click in Strudel)',
      en: 'Only `auto` and `click` ask. Any other value acts like `off`.',
      zh: '只有 `auto` 和 `click` 會去要。其他的值效果跟 `off` 一樣。',
    },
    description: [
      {
        en: "With `auto`, oav-p5 asks for Web MIDI as soon as it loads, so a plugged-in controller plays the sketch without anyone pressing anything. The browser remembers your answer per site. With `click`, it asks only when the 🎹 panel is first opened. With `off`, it never asks by itself, and the on-screen controller and a phone still play the sketch.",
        zh: '設成 `auto` 的時候，oav-p5 一載入就去要 Web MIDI，所以接上去的控制器不用誰按什麼就能彈草圖。瀏覽器會依網站記住你的答案。設成 `click`，只有第一次打開 🎹 面板時才去要。設成 `off`，它自己永遠不會去要，螢幕上的控制器和手機還是能彈草圖。',
      },
      {
        en: "[`OAVp5.connectHardware()`](#OAVp5.connectHardware) asks whatever the option says, and [`OAVp5.hardware`](#OAVp5.hardware) tells you the state: `'off'` until it has been asked.",
        zh: "不管這個選項怎麼設，[`OAVp5.connectHardware()`](#OAVp5.connectHardware) 都會去要，[`OAVp5.hardware`](#OAVp5.hardware) 告訴你現在的狀態：還沒要過之前是 `'off'`。",
      },
    ],
    notes: [
      { en: 'On strudel.cc (or a page where Strudel\'s own functions are present) the default is `click`, because Strudel\'s `midin()` asks for MIDI itself. Setting `hardware` yourself wins.', zh: '在 strudel.cc（或頁面上本來就有 Strudel 自己的函式）預設是 `click`，因為 Strudel 的 `midin()` 會自己去要 MIDI。你自己設了 `hardware` 就以你的為準。' },
      { en: 'Safari and iPad have no Web MIDI at all: when oav-p5 asks (or you call `OAVp5.connectHardware()`), the state there becomes `\'unavailable\'`.', zh: 'Safari 和 iPad 根本沒有 Web MIDI：oav-p5 去要的時候（或你呼叫 `OAVp5.connectHardware()`），那裡的狀態就會變成 `\'unavailable\'`。' },
      how('hardware'),
    ],
    examples: [
      {
        code: `window.OAV_P5 = { hardware: 'click' };

function setup() {
  createCanvas(400, 300);
}

function draw() {
  background(20);
  fill(255);
  text('hardware option: ' + OAVp5.options.hardware, 20, 30);
  text('Web MIDI state: ' + OAVp5.hardware, 20, 60);   // stays "off" until you open the 🎹 panel
}`,
        caption: { en: 'The page does not ask for Web MIDI when it loads, and the state stays "off". Press 🎹: that opens the panel and asks. Delete the first line and it asks at once.', zh: '載入的時候頁面不會去要 Web MIDI，狀態一直是 "off"。按 🎹：這會打開面板並去要。把第一行刪掉，就會一載入就去要。' },
      },
    ],
    claims: [{ expr: 'OAVp5.options.hardware', equals: 'auto' }],
    related: ['OAVp5.hardware', 'OAVp5.connectHardware', 'OAVp5.devices', 'option:panel', 'option:strudel'],
    keywords: { en: ['hardware', 'web midi', 'midi permission', 'ask for midi', 'controller', 'usb midi'], zh: ['硬體', 'web midi', 'midi 權限', '要 midi', '控制器', 'usb midi'] },
  },

  'option:hints': {
    group: 'options',
    summary: {
      en: 'Whether oav-p5 shows its explaining cards beside the 🎹 (blocked microphone, no Web MIDI, an error in your callback): `on` or `off`.',
      zh: 'oav-p5 要不要在 🎹 旁邊顯示說明的卡片（麥克風被擋、沒有 Web MIDI、你的回呼出錯）：`on` 或 `off`。',
    },
    value: {
      type: 'String', options: 'on | off', default: 'on',
      en: 'Only `off` turns the cards off. Any other value, including the text `false`, leaves them on.',
      zh: '只有 `off` 會把卡片關掉。其他任何值，包括文字 `false`，都讓卡片保持開著。',
    },
    description: [
      {
        en: "When something goes wrong, a small card beside the 🎹 says what happened, why, and what to press, in the browser's language, once per page. `hints: 'off'` takes the cards off the page: the console still says the same thing and [`OAVp5.hints`](#OAVp5.hints) still lists what was said. Use it for a finished piece that goes on a wall or into a recording.",
        zh: "出問題的時候，🎹 旁邊會跳出一張小卡片，用瀏覽器的語言說明發生了什麼、為什麼、要按什麼，每個頁面只說一次。`hints: 'off'` 讓卡片從頁面上消失：console 還是說一樣的話，[`OAVp5.hints`](#OAVp5.hints) 也還是列出說過的內容。做好的作品要放在展場牆上或錄影的時候用。",
      },
      {
        en: "It also hides the corner oscilloscope of [`scope()`](#scope), which is part of the same on-page help. `scope=off` hides only that.",
        zh: '它也會把 [`scope()`](#scope) 的角落示波器藏起來，因為那是同一套網頁上的輔助。`scope=off` 只藏它。',
      },
    ],
    notes: [how('hints')],
    examples: [
      {
        code: `window.OAV_P5 = { hints: 'off' };

function setup() {
  createCanvas(400, 300);
  lag(1);   // an unnamed lag() outside draw(): oav-p5 has something to say about that
}

function draw() {
  background(20);
  fill(255);
  text('cards said: ' + OAVp5.hints.length + ' (none on the page)', 20, 30);
  text(OAVp5.hints.map((h) => h.what).join('\\n'), 20, 60);
}`,
        caption: { en: 'oav-p5 notices the lag() in setup() and would normally show a card. With hints off nothing appears on the page, but the console and the list in OAVp5.hints still have it.', zh: 'oav-p5 注意到 setup() 裡的 lag()，平常會顯示一張卡片。設成 hints off，頁面上什麼都不會出現，但 console 和 OAVp5.hints 的清單裡還是有。' },
      },
      {
        code: `window.OAV_P5 = { hints: false };   // not 'off': the value is turned into the text "false"

function setup() {
  createCanvas(400, 300);
  lag(1);
}

function draw() {
  background(20);
  fill(255);
  text('the card is still beside the 🎹', 20, 30);
}`,
        caption: { en: 'The gotcha: `false` is not `\'off\'`, so the card still appears.', zh: "常見的陷阱：`false` 不等於 `'off'`，所以卡片還是會出現。" },
      },
    ],
    claims: [{ before: 'lag(1)', expr: "document.querySelectorAll('.oav-p5-hint').length", equals: 1 }],
    related: ['OAVp5.hints', 'option:scope', 'option:debug', 'OAVp5.check'],
    keywords: { en: ['hints', 'cards', 'messages', 'quiet', 'hide the cards', 'exhibition', 'warnings'], zh: ['提示', '卡片', '訊息', '安靜', '藏起卡片', '展場', '警告'] },
  },

  'option:link': {
    group: 'options',
    summary: {
      en: 'Joins a room: oav-p5 pages with the same room hear what each other\'s programs play, over the relay. A room name, or empty for none.',
      zh: '加入一個房間：房間相同的 oav-p5 頁面，會透過中繼聽到彼此的程式送出的聲音。填房間名，空的就是不加入。',
    },
    value: {
      type: 'String', options: 'a room name', default: "'' (no room)",
      en: 'Only letters, digits, `_` and `-` are kept, and only the first 32 characters.',
      zh: '只留下字母、數字、`_` 和 `-`，而且只取前 32 個字元。',
    },
    description: [
      {
        en: "Every oav-p5 page with the same room (another tab, another computer) gets what this page's programs play into the virtual MIDI output (notes, controllers and the clock), over the phone relay, and plays it at the moment it sounds here. On the other side, `OAVp5.last.source` is `'link'`. Nothing it receives is sent on, so two pages cannot loop. The room is also the phones' room, so one QR code plays every linked page.",
        zh: "房間相同的 oav-p5 頁面（另一個分頁、另一台電腦），會透過手機中繼收到這個頁面的程式送進虛擬 MIDI 輸出的東西（音符、控制器和時鐘），並在這裡聽到的那一刻播出來。收到的那一邊，`OAVp5.last.source` 是 `'link'`。收到的東西不會再往外送，所以兩個頁面不會互相繞圈。房間也是手機用的房間，所以一個 QR code 就能彈每一個連起來的頁面。",
      },
      {
        en: "[`OAVp5.link.info`](#OAVp5.link.info) tells you the room, whether it is connected and how many other pages were heard. The 🎹 grows a 🔗: green when another page is there, yellow while connecting or alone, red when the relay is gone. [`linkdelay`](#option-linkdelay) adds a buffer.",
        zh: '[`OAVp5.link.info`](#OAVp5.link.info) 告訴你房間、有沒有連上、聽到幾個其他頁面。🎹 會多一個 🔗：另一個頁面在的時候是綠色，連線中或只有自己是黃色，中繼斷線是紅色。[`linkdelay`](#option-linkdelay) 可以多加一段緩衝。',
      },
    ],
    needs: {
      en: 'A network connection to the relay ([`relay`](#option-relay), `wss://remote.cheyuwu.com/relay` unless you set another). Without it the 🔗 is red and nothing is shared.',
      zh: '要能連上中繼（[`relay`](#option-relay)，沒另外設的話是 `wss://remote.cheyuwu.com/relay`）。連不上的話 🔗 是紅色，什麼都不會分享。',
    },
    notes: [how('link')],
    tbd: [
      { en: 'The headless check cannot reach a relay, so this example is not run. Behaviour between two pages was read from the code and the project\'s README, not seen here.', zh: '無頭瀏覽器的檢查連不到中繼，所以這個範例沒有跑。兩個頁面之間的行為是讀程式碼和專案的 README 得知的，這裡沒有親眼看過。' },
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
  const info = OAVp5.link.info;
  text('room: ' + OAVp5.options.link, 20, 30);
  text('state: ' + (info ? info.state + ', ' + info.peers + ' other page(s)' : 'not linked'), 20, 60);
}`,
        caption: { en: 'Open the same address in two tabs: each shows the room and, once connected, one other page. Anything one tab\'s program plays into OAV Virtual MIDI is heard by the other.', zh: '在兩個分頁打開同一個網址：兩邊都顯示房間，連上之後顯示有另一個頁面。一個分頁的程式送進 OAV Virtual MIDI 的東西，另一個分頁也聽得到。' },
        run: 'static',
        why: 'It connects to the network relay, which the headless check does not do.',
      },
    ],
    claims: [{ expr: 'OAVp5.options.link', equals: '' }],
    related: ['OAVp5.link', 'OAVp5.link.info', 'option:linkdelay', 'option:relay', 'option:room'],
    keywords: { en: ['link', 'room', 'sync pages', 'two computers', 'relay', 'share midi', 'strudel'], zh: ['連結', '房間', '同步頁面', '兩台電腦', '中繼', '分享 midi', 'strudel'] },
  },

  'option:linkdelay': {
    group: 'options',
    summary: {
      en: 'Extra milliseconds of buffer on the notes a linked page receives, to smooth out an uneven network: 0 to 2000.',
      zh: '連在一起的頁面收到音符時多加的緩衝毫秒數，用來撫平不穩的網路：0 到 2000。',
    },
    value: {
      type: 'Number', options: '0 to 2000 (milliseconds)', default: '0',
      en: 'Held between 0 and 2000. Anything that is not a number is 0.',
      zh: '會被限制在 0 到 2000 之間。不是數字的值就是 0。',
    },
    description: [
      {
        en: "Only matters together with [`link`](#option-link): without a room nothing is received. Each note arriving from another page is played at the moment it sounded there, which already allows for the trip. `linkdelay` adds this much on top, so a note that took longer than usual is still on time. The price is that everything from the other page arrives that much later.",
        zh: '只有跟 [`link`](#option-link) 一起用才有意義：沒有房間就不會收到任何東西。從另一個頁面來的每個音符，會在它在那邊響起的那一刻播出，這已經把路上花的時間算進去了。`linkdelay` 在那之上再多加這麼多，所以走得比平常久的音符也還是準時。代價是另一個頁面來的所有東西都晚這麼多才到。',
      },
    ],
    notes: [how('linkdelay')],
    examples: [
      {
        code: `window.OAV_P5 = { linkdelay: 80 };

function setup() {
  createCanvas(400, 300);
}

function draw() {
  background(20);
  fill(255);
  text('linkdelay: ' + OAVp5.options.linkdelay + ' ms', 20, 30);
  text('link: ' + (OAVp5.link.info ? 'room ' + OAVp5.link.info.room : 'no room, so nothing to delay'), 20, 60);   // add link: 'my-room' to use it
}`,
        caption: { en: 'Without a `link` room the number is only stored: the sketch says there is nothing to delay. Add `link: \'my-room\'` to the options and it applies to every note that arrives.', zh: "沒有 `link` 房間的時候，這個數字只是存著：草圖說沒有東西可以延遲。在選項裡加上 `link: 'my-room'`，就會套用到每個收到的音符。" },
      },
    ],
    claims: [{ expr: 'OAVp5.options.linkdelay', equals: 0 }],
    related: ['option:link', 'OAVp5.link.info', 'option:relay'],
    keywords: { en: ['link delay', 'buffer', 'network jitter', 'late notes', 'smooth'], zh: ['連結延遲', '緩衝', '網路抖動', '晚到的音符', '平順'] },
  },

  'option:mic': {
    group: 'options',
    summary: {
      en: 'Who may turn the microphone on: `auto` (the first read of `micLevel` and friends), `click` (only 🎤 or `startMic()`) or `off` (nobody).',
      zh: '誰可以把麥克風打開：`auto`（第一次讀 `micLevel` 這些）、`click`（只有 🎤 或 `startMic()`）或 `off`（誰都不行）。',
    },
    value: {
      type: 'String', options: 'auto | click | off', default: 'auto',
      en: 'Anything else means `auto`.',
      zh: '其他的值都當作 `auto`。',
    },
    description: [
      {
        en: "With `auto`, the first time a sketch reads [`micLevel`](#micLevel), [`bass`](#bass), `mid`, `treble` or [`beat`](#beat), oav-p5 asks the browser for the microphone. With `click`, reading them does nothing: the microphone starts only when someone presses 🎤 in the 🎹 panel or the sketch calls [`startMic()`](#startMic), so the permission prompt arrives when you choose. With `off`, nothing opens the microphone, not even `startMic()`, which resolves `false`.",
        zh: '設成 `auto`，草圖第一次讀 [`micLevel`](#micLevel)、[`bass`](#bass)、`mid`、`treble` 或 [`beat`](#beat) 的時候，oav-p5 就會向瀏覽器要麥克風。設成 `click`，讀它們不會有任何作用：只有有人在 🎹 面板按 🎤、或草圖呼叫 [`startMic()`](#startMic) 時麥克風才會開，這樣權限的詢問會在你決定的時候才跳出來。設成 `off`，什麼都不能開麥克風，連 `startMic()` 也不行，它會 resolve 成 `false`。',
      },
      {
        en: "`off` is a promise to the page: a gallery piece that must never listen can say so. `click` is for pieces where a permission prompt out of nowhere would be rude, or where the sound only matters after an intro. The values of the microphone stay `0` while it is off.",
        zh: '`off` 是對頁面的一個承諾：一件絕對不能收音的展場作品可以這樣宣告。`click` 適合不該憑空跳出權限詢問的作品，或是聲音要等片頭之後才有意義的作品。麥克風關著的時候，它的所有值都是 `0`。',
      },
    ],
    notes: [how('mic')],
    tbd: [
      { en: 'Not tried on openprocessing.org itself: that `?sketch_oav_mic=click` on the page address reaches the sketch.', zh: '還沒有在 openprocessing.org 本站實測：頁面網址上的 `?sketch_oav_mic=click` 有沒有傳到草圖。' },
    ],
    examples: [
      {
        code: `window.OAV_P5 = { mic: 'click' };

function setup() {
  createCanvas(400, 300);
}

function mousePressed() {
  startMic();   // now the browser asks
}

function draw() {
  background(20);
  circle(width / 2, height / 2, 50 + micLevel * 300);   // reading micLevel no longer asks
  fill(255);
  text('microphone: ' + OAVp5.mic.state + ' (click the canvas to start it)', 20, 30);
}`,
        caption: { en: 'Reading micLevel does not ask for the microphone: the state stays "off" and the circle stays small. Click the canvas and the browser asks.', zh: '讀 micLevel 不會去要麥克風：狀態一直是 "off"，圓一直很小。點一下畫布，瀏覽器才會詢問。' },
        needs: 'mic',
      },
      {
        code: `window.OAV_P5 = { mic: 'off' };

let answer = 'click the canvas to try';

function setup() {
  createCanvas(400, 300);
}

function mousePressed() {
  startMic().then((ok) => { answer = 'startMic() resolved ' + ok; });
}

function draw() {
  background(20);
  fill(255);
  text('microphone: ' + OAVp5.mic.state, 20, 30);
  text(answer, 20, 60);   // startMic() resolved false
}`,
        caption: { en: 'Nothing can open the microphone: the state stays "off" and startMic() resolves false.', zh: '什麼都不能開麥克風：狀態一直是 "off"，`startMic()` resolve 成 false。' },
      },
    ],
    claims: [{ expr: 'OAVp5.options.mic', equals: 'auto' }],
    related: ['micLevel', 'startMic', 'stopMic', 'OAVp5.mic.state', 'micIsOn'],
    keywords: { en: ['mic option', 'mic permission', 'ask for the mic', 'no mic', 'privacy', 'click to start'], zh: ['收音選項', '收音權限', '要不要收音', '不收音', '隱私', '點了才開'] },
  },

  'option:opc': {
    group: 'options',
    summary: {
      en: 'Whether oav-p5 wires the controller to the variables of OP Configurator (OpenProcessing\'s sliders and buttons): `on` or `off`.',
      zh: 'oav-p5 要不要把控制器接到 OP Configurator（OpenProcessing 的滑桿和按鈕）的變數上：`on` 或 `off`。',
    },
    value: {
      type: 'String', options: 'on | off', default: 'on',
      en: 'Only `off` turns it off.',
      zh: '只有 `off` 會把它關掉。',
    },
    description: [
      {
        en: "On OpenProcessing, `OPC.slider('radius', 10)` declares a variable with a slider. With `opc` on, oav-p5 then wires the controller to the OPC variables in order: knob 1 to the first slider, knob 2 to the second, the faders after the knobs, pad 1 to the first toggle or button. OPC's own panel moves with the knob. [`OAVp5.wiring()`](#OAVp5.wiring) lists who drives what.",
        zh: "在 OpenProcessing 上，`OPC.slider('radius', 10)` 宣告一個有滑桿的變數。`opc` 開著的時候，oav-p5 會依序把控制器接到 OPC 的變數：旋鈕 1 接第一個滑桿，旋鈕 2 接第二個，推桿接在旋鈕之後，打擊墊 1 接第一個開關或按鈕。OPC 自己的面板會跟著旋鈕動。[`OAVp5.wiring()`](#OAVp5.wiring) 會列出誰推動什麼。",
      },
      {
        en: "`off` leaves OPC's variables to their own sliders. A control the sketch reads itself (`knob1` in `draw()`) is the sketch's anyway: the slider at that place stops following it.",
        zh: '`off` 讓 OPC 的變數只聽自己的滑桿。草圖自己有讀的控制（`draw()` 裡的 `knob1`）本來就歸草圖：那個位置的滑桿不再跟著它動。',
      },
    ],
    tbd: [
      { en: "Not tried with OpenProcessing's real OPC library. The wiring was checked against a stand-in object with the same `options` shape, and the example here runs where no OPC exists, so it only shows the option arriving.", zh: '沒有用 OpenProcessing 真正的 OPC 函式庫試過。接線是拿一個有同樣 `options` 結構的替身物件檢查的，這裡的範例在沒有 OPC 的地方跑，所以只能看到選項有送達。' },
    ],
    notes: [how('opc')],
    examples: [
      {
        code: `window.OAV_P5 = { opc: 'off' };

function setup() {
  createCanvas(400, 300);
}

function draw() {
  background(20);
  fill(255);
  text('opc option: ' + OAVp5.options.opc, 20, 30);
  text('controls wired to OPC variables: ' + OAVp5.wiring().length, 20, 60);   // 0
}`,
        caption: { en: 'Outside OpenProcessing there is no OPC, so the count is 0 either way. On OpenProcessing with sliders declared, it is 0 with `opc: \'off\'` and the number of sliders and buttons without it.', zh: "在 OpenProcessing 以外沒有 OPC，所以不管怎麼設都是 0。在 OpenProcessing 上宣告了滑桿的話，設成 `opc: 'off'` 是 0，沒設就是滑桿和按鈕的數量。" },
      },
    ],
    claims: [
      { expr: 'OAVp5.options.opc', equals: 'on' },
      { before: "window.OPC = { options: { radius: { type: 'slider', name: 'radius', min: 0, max: 100, value: 10 } }, set() {} }", expr: 'JSON.stringify(OAVp5.wiring())', equals: '[{"control":"knob1","name":"radius"}]' },
    ],
    related: ['OAVp5.wiring', 'knob1', 'knob', 'pad1'],
    keywords: { en: ['opc', 'op configurator', 'openprocessing sliders', 'wire controller to sliders', 'map knobs'], zh: ['opc', 'op configurator', 'openprocessing 滑桿', '控制器接滑桿', '對應旋鈕'] },
  },

  'option:panel': {
    group: 'options',
    summary: {
      en: 'Whether the 🎹 panel starts shut, open, or does not exist: `closed`, `open` or `off`.',
      zh: '🎹 面板一開始是收起來、打開，還是根本沒有：`closed`、`open` 或 `off`。',
    },
    value: {
      type: 'String', options: 'closed | open | off', default: 'closed',
      en: 'Any value except `open` and `off` means `closed`.',
      zh: '`open` 和 `off` 以外的任何值都當作 `closed`。',
    },
    description: [
      {
        en: "`closed` shows just the small 🎹 button, and pressing it opens the panel: the on-screen controller, the buttons for 🎤, 🔊, 🥁, ⏺, 📷, 📱 and 🩺. `open` opens the panel as soon as the page loads, for a workshop where everyone needs the on-screen controller at once. `off` removes the 🎹 button altogether, for a piece in an exhibition: there is no button and [`OAVp5.panel.open()`](#OAVp5.panel.open) does nothing. The cards that explain a problem still appear in the corner, unless [`hints`](#option-hints) is `off` too.",
        zh: '`closed` 只顯示小小的 🎹 按鈕，按下去才打開面板：螢幕上的控制器，加上 🎤、🔊、🥁、⏺、📷、📱、🩺 這些按鈕。`open` 在頁面一載入就打開面板，適合工作坊，每個人一開始就需要螢幕上的控制器。`off` 把 🎹 按鈕整個拿掉，適合展場裡的作品：沒有按鈕，[`OAVp5.panel.open()`](#OAVp5.panel.open) 也什麼都不做。說明問題的卡片還是會出現在角落，除非 [`hints`](#option-hints) 也設成 `off`。',
      },
    ],
    notes: [
      { en: 'With `off` everything the panel does is still there as code: `startMic()`, `startSound()`, `startRecording()` and the options keep working, and the console still says what goes wrong.', zh: '設成 `off` 之後，面板能做的事還是都能用程式做：`startMic()`、`startSound()`、`startRecording()` 和各個選項照常運作，出問題時 console 也還是會說。' },
      how('panel'),
    ],
    examples: [
      {
        code: `window.OAV_P5 = { panel: 'open' };

function setup() {
  createCanvas(400, 300);
}

function draw() {
  background(20);
  fill(255);
  text('panel: ' + OAVp5.options.panel, 20, 30);
}`,
        caption: { en: 'The 🎹 panel is open as soon as the page loads: the on-screen controller and its buttons.', zh: '頁面一載入，🎹 面板就是打開的：螢幕上的控制器和它的按鈕。' },
      },
      {
        code: `window.OAV_P5 = { panel: 'off' };

function setup() {
  createCanvas(400, 300);
}

function draw() {
  background(20);
  fill(255);
  text('panel: ' + OAVp5.options.panel + ' (no 🎹 on this page)', 20, 30);
}`,
        caption: { en: 'There is no 🎹 button at all. The sketch still hears a real controller and everything else.', zh: '完全沒有 🎹 按鈕。草圖還是聽得到真的控制器和其他一切。' },
      },
    ],
    claims: [{ expr: 'OAVp5.options.panel', equals: 'closed' }],
    related: ['OAVp5.panel', 'OAVp5.panel.open', 'option:compact', 'option:dock', 'option:corner'],
    keywords: { en: ['panel', 'open the panel', 'hide the button', 'exhibition mode', 'on-screen controller', 'piano button'], zh: ['面板', '打開面板', '藏起按鈕', '展場模式', '螢幕控制器', '鋼琴按鈕'] },
  },

  'option:profile': {
    group: 'options',
    summary: {
      en: 'Which controller the on-screen 🎹 shows, by profile id such as `akai-lpd8`; by default it follows the one that is plugged in.',
      zh: '螢幕上的 🎹 顯示哪一種控制器，用設定檔 id 指定，例如 `akai-lpd8`。不指定的話，它跟著插上去的那一個。',
    },
    value: {
      type: 'String', options: 'a profile id', default: 'arturia-minilab3',
      en: 'Any id that @openav/midi has a profile for: `arturia-minilab3`, `akai-lpd8`, `korg-nanokontrol2`, `generic-keys49` and the rest. When you set nothing, the panel follows the controller that is plugged in.',
      zh: '@openav/midi 有設定檔的任何 id：`arturia-minilab3`、`akai-lpd8`、`korg-nanokontrol2`、`generic-keys49` 等等。你不設的話，面板跟著插上去的那一台控制器。',
    },
    description: [
      {
        en: "The on-screen controller of the 🎹 panel draws this device, and `knob1`, `fader1` and `pad1` mean the first knob, fader and pad printed on it. A sketch written with the LPD8 in mind, for instance, can ask for it with `profile: 'akai-lpd8'` so that whoever has no LPD8 still gets one on screen. The picker inside the panel changes it by hand.",
        zh: "🎹 面板上的螢幕控制器會畫出這一台設備，`knob1`、`fader1`、`pad1` 指的就是它上面印的第一顆旋鈕、第一支推桿、第一個墊子。例如照著 LPD8 寫的草圖，可以用 `profile: 'akai-lpd8'` 指定它，沒有 LPD8 的人螢幕上也有一台。面板裡的選單可以手動換。",
      },
      {
        en: "If you do not set it, the panel starts as the MiniLab 3 and then follows a real controller as soon as one that OAV has a profile for is plugged in. If you do set it, that choice stays. An id that does not exist is reported in the console with the list of known ids, and the panel shows no controller.",
        zh: '你不設的話，面板一開始是 MiniLab 3，一旦插上 OAV 有設定檔的真控制器，就改成跟著它。你設了的話，就維持你的選擇。不存在的 id 會在 console 回報，並列出已知的 id，面板也不會顯示控制器。',
      },
    ],
    notes: [how('profile')],
    examples: [
      {
        code: `window.OAV_P5 = { profile: 'akai-lpd8', panel: 'open' };

function setup() {
  createCanvas(400, 300);
}

function draw() {
  background(20);
  fill(255);
  text('profile: ' + OAVp5.options.profile, 20, 30);
  circle(width / 2, height / 2, 40 + knob1 * 240);   // knob 1 of the LPD8
}`,
        caption: { en: 'The panel opens with an Akai LPD8 on screen: eight pads and eight knobs. Turn its first knob and the circle grows.', zh: '面板打開，螢幕上是一台 Akai LPD8：八個墊子、八顆旋鈕。轉它的第一顆旋鈕，圓就變大。' },
      },
    ],
    claims: [{ expr: 'OAVp5.options.profile', equals: 'arturia-minilab3' }],
    related: ['knob1', 'fader1', 'pad1', 'option:panel', 'OAVp5.input'],
    keywords: { en: ['profile', 'controller model', 'minilab', 'lpd8', 'on-screen controller', 'device layout'], zh: ['設定檔', '控制器型號', 'minilab', 'lpd8', '螢幕控制器', '設備配置'] },
  },

  'option:recfps': {
    group: 'options',
    summary: {
      en: 'The frame rate of recorded video, 1 to 60 frames a second.',
      zh: '錄下的影片的畫面更新率，每秒 1 到 60 格。',
    },
    value: {
      type: 'Number', options: '1 to 60', default: '30',
      en: 'Rounded to a whole number and held between 1 and 60. Anything that is not a number means 30.',
      zh: '會四捨五入成整數，並限制在 1 到 60 之間。不是數字的值就當作 30。',
    },
    description: [
      {
        en: "How many frames a second the recorder takes from the canvas, for [`startRecording()`](#startRecording) and the ⏺ button. 30 suits most places Instagram and YouTube accept. 60 is smoother for fast motion and makes a bigger file. One take can ask for its own rate: `startRecording({ fps: 60 })`.",
        zh: '錄影時每秒從畫布取幾格，給 [`startRecording()`](#startRecording) 和 ⏺ 按鈕用。30 適合 Instagram 和 YouTube 接受的大多數場合。60 對快速的動作比較順，檔案也比較大。單一次錄影也可以自己指定：`startRecording({ fps: 60 })`。',
      },
    ],
    notes: [
      { en: 'It is read back as `OAVp5.options.recfps` and as `OAVp5.record.fps`.', zh: '它可以用 `OAVp5.options.recfps` 和 `OAVp5.record.fps` 讀回來。' },
      how('recfps'),
    ],
    examples: [
      {
        code: `window.OAV_P5 = { recfps: 60 };

function setup() {
  createCanvas(400, 300);
}

function draw() {
  background(20);
  fill(255);
  text('recording frame rate: ' + OAVp5.record.fps, 20, 30);
}`,
        caption: { en: 'Takes recorded from this page are 60 frames a second instead of 30.', zh: '這個頁面錄下的影片是每秒 60 格，不是 30 格。' },
      },
    ],
    claims: [{ expr: 'OAVp5.options.recfps', equals: 30 }],
    related: ['option:reclimit', 'option:record', 'startRecording', 'OAVp5.record.fps'],
    keywords: { en: ['recfps', 'recording frame rate', 'fps', '60 fps', 'video smoothness'], zh: ['錄影畫面更新率', 'fps', '每秒幾格', '60 fps', '影片流暢'] },
  },

  'option:reclimit': {
    group: 'options',
    summary: {
      en: 'The longest one recording may last, in seconds: a take stops by itself there.',
      zh: '一次錄影最長可以錄多久，單位是秒：錄到這裡就會自己停下來。',
    },
    value: {
      type: 'Number', options: '1 or more (seconds)', default: '300',
      en: 'At least 1. Anything that is not a number means 300 (five minutes).',
      zh: '至少是 1。不是數字的值就當作 300（五分鐘）。',
    },
    description: [
      {
        en: "A long take fills the tab's memory, so every recording stops by itself at this length, saves what it has and shows a card saying so. Raise it for a long piece, record in parts, or give one take its own length: `startRecording(10)` stops after ten seconds, and a number above the limit is cut down to the limit.",
        zh: '太長的影片會把分頁的記憶體吃光，所以每次錄影都會在這個長度自己停下來，存下已經錄到的，並跳出一張卡片說明。長的作品就把它調高，或是分段錄，也可以替單次錄影指定長度：`startRecording(10)` 十秒後停下，超過上限的數字會被砍到上限。',
      },
    ],
    notes: [
      { en: 'It is read back as `OAVp5.options.reclimit` and as `OAVp5.record.limit`.', zh: '它可以用 `OAVp5.options.reclimit` 和 `OAVp5.record.limit` 讀回來。' },
      how('reclimit'),
    ],
    examples: [
      {
        code: `window.OAV_P5 = { reclimit: 60 };

function setup() {
  createCanvas(400, 300);
}

function draw() {
  background(20);
  fill(255);
  text('longest take: ' + OAVp5.record.limit + ' seconds', 20, 30);
}`,
        caption: { en: 'A recording from this page stops by itself after a minute.', zh: '這個頁面錄的影片，錄滿一分鐘就會自己停。' },
      },
    ],
    claims: [{ expr: 'OAVp5.options.reclimit', equals: 300 }],
    related: ['option:recfps', 'option:record', 'startRecording', 'OAVp5.record.limit'],
    keywords: { en: ['reclimit', 'recording limit', 'maximum length', 'long recording', 'stops by itself'], zh: ['錄影上限', '最長時間', '長時間錄影', '自動停止'] },
  },

  'option:record': {
    group: 'options',
    summary: {
      en: 'Whether recording is available and whether it includes the microphone: `on`, `nomic` or `off`.',
      zh: '錄影能不能用、錄影要不要包含麥克風：`on`、`nomic` 或 `off`。',
    },
    value: {
      type: 'String', options: 'on | nomic | off', default: 'on',
      en: 'Anything else means `on`.',
      zh: '其他的值都當作 `on`。',
    },
    description: [
      {
        en: "With `on`, ⏺ and 📷 are in the 🎹 panel and [`startRecording()`](#startRecording) records the canvas together with the sound the sketch makes, the microphone included when it is on. `nomic` keeps the microphone out of the recording. With it in and no headphones, the speakers are recorded a second time through the microphone, so leave it out when you play sound out loud. `off` takes ⏺ and 📷 away and makes `startRecording()` do nothing.",
        zh: '設成 `on`，⏺ 和 📷 都在 🎹 面板裡，[`startRecording()`](#startRecording) 會把畫布和草圖發出的聲音一起錄下來，麥克風開著的話也包含在內。`nomic` 讓麥克風不進錄影。麥克風收進去又沒戴耳機的話，喇叭的聲音會透過麥克風被錄第二次，所以大聲放聲音的時候把它關掉。`off` 把 ⏺ 和 📷 拿掉，讓 `startRecording()` 什麼都不做。',
      },
      {
        en: "`off` is a promise to the page, like `mic=off`: a piece that must not be captured can say so. One take can still choose its own: `startRecording({ mic: false })`.",
        zh: '`off` 跟 `mic=off` 一樣是對頁面的承諾：一件不能被錄下來的作品可以這樣宣告。單次錄影還是可以自己決定：`startRecording({ mic: false })`。',
      },
    ],
    notes: [how('record')],
    examples: [
      {
        code: `window.OAV_P5 = { record: 'nomic' };

function setup() {
  createCanvas(400, 300);
}

function keyPressed() {
  if (key === 'r') startRecording(3);   // three seconds, without the microphone
}

function draw() {
  background(20 + 20 * sin(frameCount * 0.05));
  fill(255);
  text('press r to record 3 seconds (' + (recordingIsOn ? 'recording' : 'idle') + ')', 20, 30);
}`,
        caption: { en: 'Press r: three seconds of the canvas are recorded and downloaded, with the microphone left out even if it is on.', zh: '按 r：錄下三秒的畫布並下載，就算麥克風開著也不會錄進去。' },
      },
    ],
    claims: [{ expr: 'OAVp5.options.record', equals: 'on' }],
    related: ['startRecording', 'option:recfps', 'option:reclimit', 'option:title', 'recordingIsOn'],
    keywords: { en: ['record option', 'recording', 'no mic in recording', 'disable recording', 'screenshot button'], zh: ['錄影選項', '錄影', '錄影不含收音', '關閉錄影', '截圖按鈕'] },
  },

  'option:relay': {
    group: 'options',
    summary: {
      en: 'The address of the relay that phones and `link` rooms talk through: a WebSocket URL.',
      zh: '手機和 `link` 房間用來傳話的中繼的位址：一個 WebSocket 網址。',
    },
    value: {
      type: 'String (URL)', options: 'a ws:// or wss:// address', default: 'wss://remote.cheyuwu.com/relay',
      en: 'Used as given.',
      zh: '照你給的使用。',
    },
    description: [
      {
        en: "The 📱 button shows a QR code that sends a phone to the remote page, and the phone's MIDI tab plays your sketch through this relay. [`link`](#option-link) rooms use it too. The default is the project's public relay. To keep your traffic on your own machine, run the relay from a checkout of the repository with `node packages/relay/server.js` and point `relay` at `ws://localhost:7458/relay`.",
        zh: '📱 按鈕會顯示一個 QR code，讓手機打開遙控頁面，手機的 MIDI 分頁就是透過這個中繼來彈你的草圖。[`link`](#option-link) 的房間也用它。預設是專案的公開中繼。想讓資料只留在自己的機器上，就從儲存庫的副本執行 `node packages/relay/server.js`，再把 `relay` 指到 `ws://localhost:7458/relay`。',
      },
    ],
    notes: [
      { en: 'Nothing connects to it at load. It is used when you open the 📱 card ([`OAVp5.phone()`](#OAVp5.phone)) or set `link`.', zh: '載入的時候不會連它。要打開 📱 卡片（[`OAVp5.phone()`](#OAVp5.phone)）或設了 `link` 才會用到。' },
      how('relay'),
    ],
    examples: [
      {
        code: `window.OAV_P5 = { relay: 'ws://localhost:7458/relay' };

function setup() {
  createCanvas(400, 300);
}

function draw() {
  background(20);
  fill(255);
  text('relay: ' + OAVp5.options.relay, 20, 30);   // used when you open 📱 or set link
}`,
        caption: { en: 'The sketch only prints the address in use: a phone or a linked page would now connect to a relay on your own computer.', zh: '草圖只印出現在用的位址：手機或連在一起的頁面，現在會連到你自己電腦上的中繼。' },
      },
    ],
    related: ['option:room', 'option:remote', 'option:link', 'OAVp5.phone'],
    keywords: { en: ['relay', 'websocket', 'server', 'phone connection', 'self-host', 'wss'], zh: ['中繼', 'websocket', '伺服器', '手機連線', '自己架', 'wss'] },
  },

  'option:remote': {
    group: 'options',
    summary: {
      en: 'The address of the remote page that the 📱 QR code opens on a phone.',
      zh: '📱 的 QR code 在手機上打開的那個遙控頁面的位址。',
    },
    value: {
      type: 'String (URL)', options: 'an https:// address', default: 'https://openaudiovisual.com/packages/remote/',
      en: 'Used as given, with `?relay=…&room=…&tab=midi` added.',
      zh: '照你給的使用，後面接上 `?relay=…&room=…&tab=midi`。',
    },
    description: [
      {
        en: "The phone's page is where the on-screen controller on the phone lives. The QR code and the link under it are this address plus the relay, the room and the MIDI tab. Change it when you host the remote page yourself, for example on a local network where the phone cannot reach the public site.",
        zh: '手機上的控制器就在那個頁面裡。QR code 和它下面的連結，是這個位址再加上中繼、房間和 MIDI 分頁。自己架遙控頁面的時候才需要改它，例如手機連不到公開網站的區域網路。',
      },
    ],
    notes: [how('remote')],
    examples: [
      {
        code: `window.OAV_P5 = { remote: 'http://192.168.0.10:8080/packages/remote/' };

function setup() {
  createCanvas(400, 300);
}

function draw() {
  background(20);
  fill(255);
  text('remote page: ' + OAVp5.options.remote, 20, 30);   // the 📱 QR code points here
}`,
        caption: { en: 'The sketch prints the remote page address in use. Press 🎹, then 📱: the QR code and the link under it point at that address.', zh: '草圖印出現在用的遙控頁面位址。按 🎹 再按 📱：QR code 和它下面的連結都指向那個位址。' },
      },
    ],
    related: ['option:relay', 'option:room', 'OAVp5.phone'],
    keywords: { en: ['remote page', 'qr code', 'phone page', 'self-host remote'], zh: ['遙控頁面', 'qr code', '手機頁面', '自己架遙控'] },
  },

  'option:room': {
    group: 'options',
    summary: {
      en: 'The name of the room phones join to play this page: by default one made up per browser.',
      zh: '手機要加入哪個房間才能彈這個頁面：預設是每個瀏覽器自己亂數取的一個。',
    },
    value: {
      type: 'String', options: 'a room name', default: "'' (random per browser)",
      en: 'Left empty, a name like `p5-k3x9a` is made up and kept in this browser. Only letters, digits, `_` and `-` are kept, and only the first 32 characters. If nothing is left, the room is `default`.',
      zh: '留空的話，會自己取一個像 `p5-k3x9a` 的名字，存在這個瀏覽器裡。只留下字母、數字、`_` 和 `-`，而且只取前 32 個字元。如果什麼都沒剩下，房間就叫 `default`。',
    },
    description: [
      {
        en: "A phone and a page meet in a room on the [`relay`](#option-relay). Left empty, oav-p5 picks a name like `p5-k3x9a` the first time and keeps it in this browser (`localStorage`), so the same QR code keeps working on reload. If [`link`](#option-link) is set, its room is used. Set `room` yourself when you want a name people can type or remember, such as one per class.",
        zh: '手機和頁面在 [`relay`](#option-relay) 上的一個房間碰面。留空的話，oav-p5 第一次會挑一個像 `p5-k3x9a` 的名字，存在這個瀏覽器裡（`localStorage`），所以重新整理之後同一個 QR code 還是有用。設了 [`link`](#option-link) 的話，就用它的房間。想要一個大家打得出來、記得住的名字，例如一班一個，就自己設 `room`。',
      },
      {
        en: "A phone needs only the room name to join, so pick a name people cannot guess if that matters. [`OAVp5.phone()`](#OAVp5.phone) returns the room in use.",
        zh: '手機只需要房間名稱就能加入，所以如果這很重要，就取一個別人猜不到的名字。[`OAVp5.phone()`](#OAVp5.phone) 會回傳現在用的房間。',
      },
    ],
    notes: [how('room')],
    examples: [
      {
        code: `window.OAV_P5 = { room: 'class-2026' };

function setup() {
  createCanvas(400, 300);
}

function draw() {
  background(20);
  fill(255);
  text('room: ' + OAVp5.options.room, 20, 30);   // the phones' QR code uses this room
}`,
        caption: { en: 'The sketch prints the room name. The 📱 card now shows `class-2026` instead of a random name.', zh: '草圖印出房間名稱。📱 卡片上現在顯示 `class-2026`，不是亂數的名字。' },
      },
    ],
    claims: [{ expr: 'OAVp5.options.room', equals: '' }],
    related: ['option:relay', 'option:link', 'option:remote', 'OAVp5.phone'],
    keywords: { en: ['room', 'phone room', 'channel', 'session name', 'qr code'], zh: ['房間', '手機房間', '頻道', '場次名稱', 'qr code'] },
  },

  'option:scope': {
    group: 'options',
    summary: {
      en: 'Whether `scope()` draws its oscilloscope in the corner of the page: `on` or `off`. `hints=off` turns it off too.',
      zh: '`scope()` 要不要在網頁角落畫它的示波器：`on` 或 `off`。`hints=off` 也會把它關掉。',
    },
    value: {
      type: 'String', options: 'on | off', default: 'on',
      en: 'Only `off` turns it off.',
      zh: '只有 `off` 會把它關掉。',
    },
    description: [
      {
        en: "With `off`, [`scope()`](#scope) draws nothing in the corner and only returns its value, so a sketch can leave its `scope()` calls in and hide the plot for a show. [`drawTrail()`](#drawTrail), which draws on the canvas, is not affected.",
        zh: '設成 `off`，[`scope()`](#scope) 不會在角落畫任何東西，只回傳它的值，所以演出的時候草圖可以把 `scope()` 留在程式裡，只是把圖藏起來。畫在畫布上的 [`drawTrail()`](#drawTrail) 不受影響。',
      },
    ],
    notes: [
      { en: "If the plot does not show up, check [`hints`](#option-hints) too: `hints=off` hides it as well.", zh: '圖沒有出現的話，也要檢查 [`hints`](#option-hints)：`hints=off` 也會把它藏起來。' },
      how('scope'),
    ],
    examples: [
      {
        code: `window.OAV_P5 = { scope: 'off' };

function setup() {
  createCanvas(400, 300);
}

function draw() {
  background(20);
  const wave = 0.5 + 0.5 * sin(frameCount * 0.05);
  circle(width / 2, height / 2, 40 + scope(wave, 'wave') * 200);   // returns wave, draws nothing
}`,
        caption: { en: 'The circle still breathes, but there is no plot in the corner of the page. Delete the first line and it comes back.', zh: '圓還是一漲一縮，但網頁角落沒有圖。把第一行刪掉，圖就回來了。' },
      },
    ],
    related: ['scope', 'drawTrail', 'option:hints'],
    keywords: { en: ['scope option', 'hide oscilloscope', 'hide plot', 'exhibition', 'no corner plot'], zh: ['示波器選項', '藏起示波器', '藏起圖', '展場', '角落沒有圖'] },
  },

  'option:shim': {
    group: 'options',
    summary: {
      en: 'Whether oav-p5 replaces `navigator.requestMIDIAccess` so sketches with their own Web MIDI code also hear the 🎹 and phones: `on` or `off`.',
      zh: 'oav-p5 要不要取代 `navigator.requestMIDIAccess`，讓自己寫了 Web MIDI 程式的草圖也聽得到 🎹 和手機：`on` 或 `off`。',
    },
    value: {
      type: 'String', options: 'on | off', default: 'on',
      en: 'Only `off` turns it off.',
      zh: '只有 `off` 會把它關掉。',
    },
    description: [
      {
        en: "With `on`, a sketch that calls `navigator.requestMIDIAccess()` itself (WebMidi.js does) gets the real ports and one more input called \"OAV Virtual MIDI\", which carries whatever the on-screen controller and the phone play. It also works in Safari and on iPad, where there is no Web MIDI: the sketch gets the virtual port alone, so a WebMidi.js sketch still runs there. Programs can play into its output as well (Strudel's `.midi('OAV Virtual MIDI')`).",
        zh: '設成 `on`，自己呼叫 `navigator.requestMIDIAccess()` 的草圖（WebMidi.js 就是）會拿到真的連接埠，再多一個叫 "OAV Virtual MIDI" 的輸入，螢幕控制器和手機彈的東西都從它進來。在沒有 Web MIDI 的 Safari 和 iPad 上也能用：草圖只拿到虛擬連接埠，所以 WebMidi.js 的草圖在那裡還是能跑。其他程式也可以把東西送進它的輸出（Strudel 的 `.midi(\'OAV Virtual MIDI\')`）。',
      },
      {
        en: "`off` leaves the browser's own `requestMIDIAccess` alone. Use it when a page already has its own MIDI handling that must not see an extra port.",
        zh: '`off` 不動瀏覽器自己的 `requestMIDIAccess`。頁面本來就有自己的 MIDI 處理、不能多出一個連接埠的時候用。',
      },
    ],
    notes: [
      { en: 'Order matters: oav-p5 has to load before the code that asks for MIDI, which is why the loader line goes first. A page that opened MIDI earlier keeps the browser\'s own answer, and 🩺 says so.', zh: '順序很重要：oav-p5 要比要 MIDI 的程式先載入，這就是為什麼載入那一行要放在最前面。更早就開了 MIDI 的頁面會維持瀏覽器自己的答案，🩺 也會這麼說。' },
      how('shim'),
    ],
    examples: [
      {
        code: `window.OAV_P5 = { shim: 'off' };

let names = 'asking…';

function setup() {
  createCanvas(400, 300);
  navigator.requestMIDIAccess().then(
    (access) => { names = [...access.inputs.values()].map((i) => i.name).join(', ') || 'no inputs'; },
    (error) => { names = 'refused: ' + error.name; }
  );
}

function draw() {
  background(20);
  fill(255);
  text('shim: ' + OAVp5.options.shim, 20, 30);
  text('MIDI inputs: ' + names, 20, 60);
}`,
        caption: { en: 'With the shim off, the sketch gets only the browser\'s own answer (the real inputs, or a refusal). Delete the first line and "OAV Virtual MIDI" is in the list. The browser may ask you for MIDI permission.', zh: '關掉 shim，草圖只會拿到瀏覽器自己的答案（真的輸入，或被拒絕）。把第一行刪掉，清單裡就多了 "OAV Virtual MIDI"。瀏覽器可能會問你要不要給 MIDI 權限。' },
      },
    ],
    claims: [{ expr: 'OAVp5.options.shim', equals: 'on' }],
    related: ['OAVp5.input', 'option:hardware', 'midiMessage', 'OAVp5.last'],
    keywords: { en: ['shim', 'virtual midi', 'requestMIDIAccess', 'WebMidi.js', 'OAV Virtual MIDI', 'safari midi'], zh: ['shim', '虛擬 midi', 'requestMIDIAccess', 'WebMidi.js', 'OAV Virtual MIDI', 'safari midi'] },
  },

  'option:sound': {
    group: 'options',
    summary: {
      en: 'Whether notes are heard: `click` (only after `startSound()` or 🔊), `off` (never), or an instrument id that starts at the first click.',
      zh: '音符有沒有聲音：`click`（要呼叫 `startSound()` 或按 🔊 才有）、`off`（永遠沒有），或一個樂器 id，從第一次點擊就開始出聲。',
    },
    value: {
      type: 'String', options: 'click | off | an instrument id', default: 'click',
      en: 'An instrument id such as `piano`, `organ`, `strings`, `harp` or `music-box`. `on` and `auto` start the default instrument (the piano). An id that does not exist plays the default synth (`synth/pad`) and the console lists the ids that exist.',
      zh: '樂器 id，像是 `piano`、`organ`、`strings`、`harp` 或 `music-box`。`on` 和 `auto` 會啟動預設的樂器（鋼琴）。不存在的 id 會播預設的合成器（`synth/pad`），console 會列出存在的 id。',
    },
    description: [
      {
        en: "With `click`, nothing makes a sound until the sketch calls [`startSound()`](#startSound) or someone presses 🔊 in the 🎹 panel. With an instrument id, every key, pad, the on-screen controller and a phone are heard from the first click on the page, with no code at all, so any MIDI sketch becomes playable by adding the option to the page address: `?oav_sound=piano`. `off` is a promise to the page: nothing sounds, [`startSound()`](#startSound) resolves `false` and the 🔊 button is hidden.",
        zh: '設成 `click`，要等草圖呼叫 [`startSound()`](#startSound)，或有人在 🎹 面板按 🔊，才會有聲音。給一個樂器 id，每個琴鍵、打擊墊、螢幕控制器和手機，從頁面上的第一次點擊開始就都聽得到，一行程式都不用寫，所以任何 MIDI 草圖只要在網址加上 `?oav_sound=piano` 就能彈。`off` 是對頁面的承諾：什麼都不發聲，[`startSound()`](#startSound) 會 resolve 成 `false`，🔊 按鈕也會被藏起來。',
      },
      {
        en: "Browsers let a page play sound only after a click, and a MIDI key is not a click, so the first sound waits for one: a card says \"sound is ready but silent\" until then.",
        zh: '瀏覽器要網頁被點過一下才讓它出聲，而 MIDI 的琴鍵不算點擊，所以第一個聲音要等一次點擊：在那之前會有一張卡片說「聲音準備好了，還沒響」。',
      },
    ],
    notes: [how('sound')],
    examples: [
      {
        code: `window.OAV_P5 = { sound: 'organ' };

function setup() {
  createCanvas(400, 300);
}

function mousePressed() {
  OAVp5.play(60 + floor(random(12)), 0.8);   // a key, as a controller would play it
}

function draw() {
  background(20);
  fill(255);
  text('sound: ' + OAVp5.sound.state + ' (' + OAVp5.sound.instrument + ')', 20, 30);
  text('click the canvas to play a note', 20, 60);
}`,
        caption: { en: 'No startSound() call: the organ is heard from your first click, which also plays a note. The state goes from "waiting" to "on".', zh: '沒有呼叫 startSound()：從你的第一次點擊開始就聽得到管風琴，那一下點擊同時彈一個音。狀態從 "waiting" 變成 "on"。' },
      },
      {
        code: `window.OAV_P5 = { sound: 'off' };

let answer = 'click the canvas to try';

function setup() {
  createCanvas(400, 300);
}

function mousePressed() {
  startSound().then((ok) => { answer = 'startSound() resolved ' + ok; });
}

function draw() {
  background(20);
  fill(255);
  text('sound: ' + OAVp5.sound.state, 20, 30);
  text(answer, 20, 60);   // startSound() resolved false
}`,
        caption: { en: 'Nothing can make sound: the state stays "off", startSound() resolves false, and the 🔊 button is not in the panel.', zh: '什麼都不能發聲：狀態一直是 "off"，`startSound()` resolve 成 false，面板裡也沒有 🔊 按鈕。' },
      },
    ],
    claims: [{ expr: 'OAVp5.options.sound', equals: 'click' }],
    related: ['startSound', 'stopSound', 'soundIsOn', 'option:tone', 'OAVp5.play'],
    keywords: { en: ['sound option', 'instrument', 'piano', 'organ', 'play without code', 'audio output', 'mute'], zh: ['聲音選項', '樂器', '鋼琴', '管風琴', '不用寫程式就有聲音', '音訊輸出', '靜音'] },
  },

  'option:strudel': {
    group: 'options',
    summary: {
      en: 'Whether oav-p5 treats the page as Strudel, the live-coding editor, and behaves politely beside it: `auto`, `on` or `off`.',
      zh: 'oav-p5 要不要把這個頁面當成 Strudel（即時編碼編輯器），在它旁邊客氣一點：`auto`、`on` 或 `off`。',
    },
    value: {
      type: 'String', options: 'auto | on | off', default: 'auto',
      en: '`auto` means on strudel.cc, or on a page where Strudel\'s own functions (`note()` and `s()` with `stack()` or `samples()`) are already there. Anything else means `auto`.',
      zh: '`auto` 的意思是在 strudel.cc 上，或頁面上本來就有 Strudel 自己的函式（`note()` 和 `s()`，加上 `stack()` 或 `samples()`）。其他的值都當作 `auto`。',
    },
    description: [
      {
        en: "Strudel is a live-coding editor, not a sketch, so a few things change when oav-p5 sees it: the names Strudel owns (`note`, `velocity`, `beat`) are left alone and one card says what to read instead, MIDI is asked for by Strudel's own `midin()` rather than at load ([`hardware`](#option-hardware) becomes `click`), the 🎹 panel becomes the [`compact`](#option-compact) box, and the 🎹 sits above Strudel's side-panel buttons. oav-p5 only looks at the address and at the names on the page: nothing of Strudel is called.",
        zh: 'Strudel 是即時編碼編輯器，不是草圖，所以 oav-p5 看到它的時候有幾件事會改變：Strudel 自己擁有的名稱（`note`、`velocity`、`beat`）不去動，並用一張卡片說明要改讀什麼，MIDI 交給 Strudel 自己的 `midin()` 去要，不是載入的時候（[`hardware`](#option-hardware) 變成 `click`），🎹 面板變成 [`compact`](#option-compact) 的小方塊，🎹 放在 Strudel 側邊按鈕的上面。oav-p5 只看網址和頁面上有哪些名稱：不會呼叫 Strudel 的任何東西。',
      },
      {
        en: "`on` forces this behaviour on any page, `off` forces the plain one even on strudel.cc. Settings you give yourself ([`hardware`](#option-hardware), [`compact`](#option-compact)) still win over what Strudel mode would choose.",
        zh: '`on` 讓任何頁面都用這種做法，`off` 讓 strudel.cc 上也用一般的做法。你自己給的設定（[`hardware`](#option-hardware)、[`compact`](#option-compact)）還是比 Strudel 模式的選擇優先。',
      },
    ],
    notes: [how('strudel')],
    examples: [
      {
        code: `window.OAV_P5 = { strudel: 'on' };

function setup() {
  createCanvas(400, 300);
}

function draw() {
  background(20);
  fill(255);
  text('hardware: ' + OAVp5.options.hardware, 20, 30);   // click: Strudel asks for MIDI itself
  text('compact panel: ' + OAVp5.options.compact, 20, 60);   // true
}`,
        caption: { en: 'On an ordinary page, strudel on switches to Strudel\'s manners: Web MIDI is not asked for at load and the panel will be the compact box.', zh: '在一般的頁面上，strudel 設成 on 就換成 Strudel 的規矩：載入的時候不去要 Web MIDI，面板也會是精簡的小方塊。' },
      },
    ],
    claims: [{ expr: 'OAVp5.options.compact', equals: false }],
    related: ['option:hardware', 'option:compact', 'option:link', 'option:clock', 'OAVp5.clock'],
    keywords: { en: ['strudel', 'live coding', 'strudel.cc', 'tidal', 'midin', 'strudel mode'], zh: ['strudel', '即時編碼', 'strudel.cc', 'tidal', 'midin', 'strudel 模式'] },
  },

  'option:telemetry': {
    group: 'options',
    summary: {
      en: 'Whether the on-screen controller may send one anonymous page-load count to the project: `off` or `on`.',
      zh: '螢幕上的控制器可不可以把一筆匿名的頁面載入次數送給專案：`off` 或 `on`。',
    },
    value: {
      type: 'String', options: 'off | on', default: 'off',
      en: 'Only `on` turns it on.',
      zh: '只有 `on` 會打開它。',
    },
    description: [
      {
        en: "In oav-p5 it is off. With `on`, when the 🎹 panel builds the on-screen controller, @openav/midi sends one anonymous hit per page load to the project's Google Analytics, so the project can see where its controllers end up. The @openav/midi README (section Telemetry) lists exactly what it sends: the kind of embed, the profile, the page's origin (never the path, query or title) and the version. Nothing anyone plays is sent and no cookie is set.",
        zh: '在 oav-p5 裡預設是關的。設成 `on`，🎹 面板建立螢幕控制器的時候，@openav/midi 會把每次頁面載入的一筆匿名紀錄送到專案的 Google Analytics，讓專案知道它的控制器用在哪些地方。@openav/midi 的 README（Telemetry 那一節）列出它確切送了什麼：嵌入的種類、設定檔、頁面的來源網域（絕不含路徑、查詢字串或標題）和版本。沒有任何人彈的東西會被送出，也不會設定 cookie。',
      },
    ],
    notes: [
      { en: 'According to that README nothing is sent from localhost, local network addresses, `file://` or openaudiovisual.com itself, or when the browser sends Do Not Track or Global Privacy Control.', zh: '依照那份 README，從 localhost、區域網路位址、`file://` 或 openaudiovisual.com 本身都不會送，瀏覽器送出「不要追蹤」或 Global Privacy Control 的時候也不會送。' },
      how('telemetry'),
    ],
    tbd: [
      { en: 'The hit itself was not observed here: the example runs on localhost, where nothing is sent. What it sends is as stated in the @openav/midi README.', zh: '這裡沒有親眼看到那筆紀錄送出：範例在 localhost 上跑，那裡不會送任何東西。它送了什麼，以 @openav/midi 的 README 為準。' },
    ],
    examples: [
      {
        code: `window.OAV_P5 = { telemetry: 'on' };

function setup() {
  createCanvas(400, 300);
}

function draw() {
  background(20);
  fill(255);
  text('telemetry: ' + OAVp5.options.telemetry, 20, 30);   // nothing visible changes
}`,
        caption: { en: 'Nothing visible changes. The option is passed to the on-screen controller when the 🎹 panel first opens.', zh: '畫面上看不出任何變化。這個選項會在 🎹 面板第一次打開的時候傳給螢幕控制器。' },
      },
    ],
    claims: [{ expr: 'OAVp5.options.telemetry', equals: 'off' }],
    related: ['option:panel', 'option:profile'],
    keywords: { en: ['telemetry', 'analytics', 'privacy', 'anonymous', 'tracking', 'opt in'], zh: ['遙測', '分析', '隱私', '匿名', '追蹤', '選擇加入'] },
  },

  'option:title': {
    group: 'options',
    summary: {
      en: 'A name that goes into the file name of recordings and images, as in `oav-my-piece-20261015-183012.mp4`.',
      zh: '放進錄影和圖片檔名裡的名稱，例如 `oav-my-piece-20261015-183012.mp4`。',
    },
    value: {
      type: 'String', options: 'a name', default: "'' (no name)",
      en: 'Spaces and the characters a file name cannot hold become `-`, and only the first 40 characters are used.',
      zh: '空白和檔名不能用的字元會變成 `-`，而且只取前 40 個字元。',
    },
    description: [
      {
        en: "Without it a recording is `oav-20261015-183012.mp4`. With `title: 'my-piece'` it is `oav-my-piece-20261015-183012.mp4`, so takes from several pieces sort themselves. One take can have its own name: `startRecording({ name: 'take-2' })` replaces it.",
        zh: "沒有它的話，錄影檔名是 `oav-20261015-183012.mp4`。設了 `title: 'my-piece'`，就是 `oav-my-piece-20261015-183012.mp4`，好幾件作品的錄影就會自己排好。單次錄影也可以有自己的名字：`startRecording({ name: 'take-2' })` 會取代它。",
      },
    ],
    notes: [how('title')],
    examples: [
      {
        code: `window.OAV_P5 = { title: 'my-piece' };

let saved = 'press r to record 2 seconds';

function setup() {
  createCanvas(400, 300);
}

function keyPressed() {
  if (key === 'r') startRecording(2);
}

function recordingSaved(info) {
  saved = 'saved as ' + info.name;
}

function draw() {
  background(20);
  fill(255);
  text(saved, 20, 30);
}`,
        caption: { en: 'Press r: two seconds are recorded and downloaded, and the sketch shows the file name, which starts with oav-my-piece-.', zh: '按 r：錄兩秒並下載，草圖顯示檔名，檔名以 oav-my-piece- 開頭。' },
      },
    ],
    claims: [{ expr: 'OAVp5.options.title', equals: '' }],
    related: ['startRecording', 'recordingSaved', 'option:record'],
    keywords: { en: ['title', 'file name', 'recording name', 'name the video', 'download name'], zh: ['標題', '檔名', '錄影名稱', '影片命名', '下載檔名'] },
  },

  'option:tone': {
    group: 'options',
    summary: {
      en: 'Where Tone.js, the sound engine behind `startSound()`, is loaded from: an ES module address. Empty means jsDelivr.',
      zh: 'Tone.js（`startSound()` 背後的聲音引擎）從哪裡載入：一個 ES module 的位址。空的就是 jsDelivr。',
    },
    value: {
      type: 'String (URL)', options: 'an ES module URL', default: "'' (jsDelivr)",
      en: 'The address of Tone.js version 15 as an ES module. Left empty, it is `https://cdn.jsdelivr.net/npm/tone@15.0.4/+esm`, and `OAVp5.options.tone` reads `\'\'`.',
      zh: 'Tone.js 第 15 版的 ES module 位址。留空的話用 `https://cdn.jsdelivr.net/npm/tone@15.0.4/+esm`，`OAVp5.options.tone` 讀回來是 `\'\'`。',
    },
    description: [
      {
        en: "Sound ([`startSound()`](#startSound), the `sound` option, the 🔊 button) uses Tone.js 15, which oav-p5 loads the first time sound is wanted. By default it comes from jsDelivr. Point `tone` at your own copy when the page is behind a school firewall or an ad blocker that stops the CDN, or when you serve everything yourself. If it cannot be loaded, a card says which host was unreachable and what to try.",
        zh: '聲音（[`startSound()`](#startSound)、`sound` 選項、🔊 按鈕）用的是 Tone.js 15，oav-p5 在第一次需要聲音的時候才載入它。預設從 jsDelivr 來。頁面在學校防火牆或擋廣告的外掛後面、CDN 被擋住，或是你自己架所有東西的時候，把 `tone` 指到你自己的那一份。載不到的時候，會有一張卡片說是哪個主機連不上，以及可以怎麼試。',
      },
    ],
    notes: [how('tone')],
    examples: [
      {
        code: `window.OAV_P5 = { tone: 'https://cdn.jsdelivr.net/npm/tone@15.0.4/+esm' };

function setup() {
  createCanvas(400, 300);
}

function draw() {
  background(20);
  fill(255);
  text('Tone.js from: ' + OAVp5.options.tone, 20, 30);   // the address here is the built-in one
}`,
        caption: { en: 'Prints where Tone.js would come from. The address here is the built-in one, so nothing changes. Swap in your own copy to host it yourself.', zh: '印出 Tone.js 會從哪裡來。這裡的位址就是內建的那個，所以不會有任何改變。換成你自己的那一份，就能自己架。' },
      },
    ],
    claims: [{ expr: 'OAVp5.options.tone', equals: '' }],
    related: ['option:sound', 'startSound', 'soundIsOn'],
    keywords: { en: ['tone', 'tone.js', 'cdn', 'offline sound', 'self-host', 'jsdelivr', 'firewall'], zh: ['tone', 'tone.js', 'cdn', '離線聲音', '自己架', 'jsdelivr', '防火牆'] },
  },
};
