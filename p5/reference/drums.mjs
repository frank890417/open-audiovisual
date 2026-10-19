// oav-p5 reference: the drum machine, its clock and its names (startDrums, drumPhase, rhythmChanged, drawRhythm, OAVp5.drums),
// then the bars-and-cues half of the same machine (group 'timeline': drumStep, drumBar, cue, cueFired, barStarted, stepStarted…).
// Read by tools/build-reference.mjs (see AGENTS.md, "Documenting a public name"). The keys are the public names the code has
// (tools/reference/scan.mjs reads them); a key the code does not have is a red test.
// Sketch examples leave out the loader line: the page puts it on top when you copy or run.

export default {
  startDrums: {
    group: 'drums',
    aliases: ['OAVp5.drums.start'],
    summary: {
      en: 'Starts a drum machine: a 16-step grid on the page that plays a preset, your own grid or one line of rhythm, and counts the bars for your sketch.',
      zh: '啟動鼓機：頁面上出現一個 16 格的鼓機，播放預設節奏、你自己畫的格子或一行字寫的節奏，並替草圖數小節。',
    },
    params: [
      {
        name: 'pattern', type: 'String | Object | Number', optional: true,
        en: 'What to play. A preset name (`\'four on floor\'`, `\'breakbeat\'`, `\'half time\'`, `\'latin\'`, `\'sparse\'`). A line of rhythm such as `\'bd*4, [~ sd]*2, hh*8\'`, or one copied from strudel.cc. Your own grid `{ kick: \'x...x...x...x...\', snare, hat, clap }` (`x` or `1` is a hit, a lane you leave out is silent, `{}` is a silent clock). A number alone is the tempo. Leave it out to keep what plays now (`\'four on floor\'` at the start).',
        zh: '要播什麼。預設節奏的名字（`\'four on floor\'`、`\'breakbeat\'`、`\'half time\'`、`\'latin\'`、`\'sparse\'`）。一行字寫的節奏，例如 `\'bd*4, [~ sd]*2, hh*8\'`，或從 strudel.cc 複製來的。你自己畫的格子 `{ kick: \'x...x...x...x...\', snare, hat, clap }`（`x` 或 `1` 是打擊，沒寫的軌道是靜音，`{}` 是只走時間、不出聲的時鐘）。只給一個數字，那個數字就是速度。不傳就維持現在播的（一開始是 `\'four on floor\'`）。',
      },
      {
        name: 'bpm', type: 'Number', optional: true,
        en: 'The tempo in beats per minute (a beat is four steps). Kept between 30 and 300. Leave it out to keep the current tempo: 112 at the start, or the one a copied Strudel line sets with `setcpm(…)`.',
        zh: '速度，單位是每分鐘幾拍（一拍是四格）。會被限制在 30 到 300 之間。不傳就維持現在的速度：一開始是 112，或是複製來的 Strudel 程式用 `setcpm(…)` 設的那個。',
      },
    ],
    returns: {
      type: 'Promise<Boolean>',
      en: 'Resolves to `true` once the machine plays (or when a later `startDrums()` took over). Resolves to `false` when [`stopDrums()`](#stopDrums) came first, when there is no page to put the grid on, or when @openav/drums could not be loaded.',
      zh: '鼓機開始播之後 resolve 成 `true`（或者後面又有一次 `startDrums()` 接手的時候）。[`stopDrums()`](#stopDrums) 先被呼叫、沒有頁面可以放鼓機、或 @openav/drums 載入失敗的時候，resolve 成 `false`。',
    },
    description: [
      {
        en: 'Call it once in `setup()`: `startDrums(\'breakbeat\', 120)`. A grid of 16 steps by 4 lanes (kick, snare, hat, clap) appears at the top of the page, with the tempo and the bar it is in, and plays a synthesized drum kit (no sample files). The grid is part of the page, not of the canvas: a recording never shows it, so use [`drawRhythm()`](#drawRhythm) to draw the rhythm on the canvas. A click on a cell changes the beat, and 🥁 in the 🎹 panel starts and stops the machine with no code at all.',
        zh: '在 `setup()` 裡呼叫一次：`startDrums(\'breakbeat\', 120)`。頁面上方會出現 16 格 × 4 軌（大鼓、小鼓、鈸、拍手）的鼓機，旁邊有速度和目前的小節，用合成的鼓組發聲（沒有取樣檔）。這個鼓機是頁面的一部分，不在畫布上，所以錄影錄不到它，要把節奏畫進畫布請用 [`drawRhythm()`](#drawRhythm)。點格子可以改節奏，🎹 面板裡的 🥁 不用寫程式就能開關鼓機。',
      },
      {
        en: 'The machine is also a clock and a source of events. Every hit calls [`drumHit()`](#drumHit) and the microphone\'s own functions ([`kickDetected()`](#kickDetected), [`snareDetected()`](#kickDetected), [`hatDetected()`](#kickDetected), [`beatDetected()`](#beatDetected)), so a sketch written for the microphone moves over unchanged. [`drumStep`](#drumStep), [`drumBar`](#drumBar), [`drumPhase`](#drumPhase) and [`beatPhase`](#beatPhase) say where the machine is, and [`cue()`](#cue) lets you plan what happens at which bar.',
        zh: '鼓機同時也是時鐘和事件的來源。每一下打擊都會呼叫 [`drumHit()`](#drumHit) 和麥克風用的那幾個函式（[`kickDetected()`](#kickDetected)、[`snareDetected()`](#kickDetected)、[`hatDetected()`](#kickDetected)、[`beatDetected()`](#beatDetected)），所以為麥克風寫的草圖不用改就能換成鼓機。[`drumStep`](#drumStep)、[`drumBar`](#drumBar)、[`drumPhase`](#drumPhase)、[`beatPhase`](#beatPhase) 告訴你鼓機走到哪，[`cue()`](#cue) 讓你事先安排哪一小節發生什麼。',
      },
      {
        en: 'Calling it again while it plays changes the pattern or the tempo without restarting: `startDrums(90)` only changes the tempo, `startDrums(\'latin\')` only the pattern. A line of rhythm is any text that is not a preset name. A word is a drum (`bd` kick, `sd` snare, `hh` hat, `oh` open hat, `cp` clap, `rim`, `lt` `mt` `ht` toms, `cr` crash, `rd` ride, `cb` cowbell), `~` is a rest, words separated by spaces share the bar evenly, `[ ]` groups, `*4` repeats, `,` puts another line on top, `< >` takes one per bar and `bd(3,8)` spreads 3 hits over 8 steps. A mistake shows a card that points at the character and says how to fix it, and `\'four on floor\'` plays meanwhile.',
        zh: '機器播的時候再呼叫，是換節奏或換速度，不會重新開始：`startDrums(90)` 只改速度，`startDrums(\'latin\')` 只換節奏。不是預設節奏名字的文字，都當成一行節奏來讀。一個字就是一種鼓（`bd` 大鼓、`sd` 小鼓、`hh` 鈸、`oh` 開鈸、`cp` 拍手、`rim` 鼓邊、`lt` `mt` `ht` 三種中鼓、`cr` 碎音鈸、`rd` 疊音鈸、`cb` 牛鈴），`~` 是休息，用空白隔開的字平分一小節，`[ ]` 是一組，`*4` 是重複四次，`,` 是疊上另一行，`< >` 是每小節輪流一個，`bd(3,8)` 是把 3 下打擊平均分在 8 格裡。寫錯的話會跳出一張卡片，指出是哪個字、怎麼改，這時先播 `\'four on floor\'`。',
      },
      {
        en: 'A line copied from strudel.cc works too: `startDrums(\'s("bd*4, [~ sd]*2").fast(2)\')`. `s("…")` and `sound("…")` with `.fast(n)` and `.slow(n)` are read, `setcpm(110/4)` sets the tempo if you give none, `.bank(…)` is left out (oav-p5 plays its own kit), and any other call in the chain gets a card that says it is not supported yet. The rest plays.',
        zh: '從 strudel.cc 複製來的程式也可以：`startDrums(\'s("bd*4, [~ sd]*2").fast(2)\')`。`s("…")` 和 `sound("…")` 加上 `.fast(n)`、`.slow(n)` 會被讀進來，沒給速度的話 `setcpm(110/4)` 會設定速度，`.bank(…)` 會略過（oav-p5 用自己的鼓組），鏈裡其他的呼叫會跳一張卡片說目前還不支援，其餘照播。',
      },
    ],
    needs: {
      en: 'Nothing before the call. The counting, [`drumHit()`](#drumHit) and the other callbacks start at once, but a browser lets the page make sound only after a click or key press on it, so the drums are silent until the first one. A card at the top says so after a moment.',
      zh: '呼叫之前不用準備什麼。計數、[`drumHit()`](#drumHit) 和其他 callback 馬上就開始，但瀏覽器要頁面上先有一次點擊或按鍵才讓頁面出聲，所以在那之前鼓是沒聲音的，過一會兒上方會出現卡片提醒你。',
    },
    notes: [
      {
        en: 'Drum sound does not need [`startSound()`](#startSound): the machine has its own kit. Pads on MIDI channel 10 play the same kit once `startSound()` is on.',
        zh: '鼓的聲音不需要 [`startSound()`](#startSound)：鼓機有自己的鼓組。MIDI 第 10 軌的打擊墊，在 `startSound()` 開著的時候打的就是同一組鼓。',
      },
      {
        en: 'The card has – to fold the grid away and × to stop the machine. A tab in the background keeps counting and playing. The loading options [`drums`](#option-drums) (`lookahead` or `frame`) and [`drumlatency`](#option-drumlatency) tune the clock.',
        zh: '卡片上的 – 可以把格子收起來，× 會停掉鼓機。分頁在背景的時候，鼓機照樣數、照樣播。載入選項 [`drums`](#option-drums)（`lookahead` 或 `frame`）和 [`drumlatency`](#option-drumlatency) 可以調整時鐘。',
      },
    ],
    examples: [
      {
        code: `let swell = 0;

function setup() {
  createCanvas(400, 300);
  startDrums('breakbeat', 120);   // the grid appears at the top of the page
}

function kickDetected(level) {
  swell = 1;
}

function draw() {
  background(20);
  swell *= 0.9;
  circle(width / 2, height / 2, 60 + swell * 120);
}`,
        caption: { en: 'A grid appears at the top of the page. Click the canvas once to hear it: the circle jumps on every kick.', zh: '頁面上方出現鼓機。在畫布上點一下就聽得到鼓聲，每一下大鼓圓都會跳一下。' },
      },
      {
        code: `const LINES = ['bd*4, [~ sd]*2, hh*8', 'bd(3,8), [~ sd]*2, hh*16', 'bd ~ ~ bd, ~ sd ~ ~, [hh hh]*4'];
let n = 0;

function setup() {
  createCanvas(400, 300);
  startDrums(LINES[0], 110);
  textAlign(CENTER, CENTER);
}

function mousePressed() {
  n = (n + 1) % LINES.length;
  startDrums(LINES[n]);   // changes the rhythm while it plays
}

function draw() {
  background(20);
  fill(255);
  text('click to change the rhythm', width / 2, height / 2 - 20);
  text(OAVp5.drums.src, width / 2, height / 2 + 20);
}`,
        caption: { en: 'Click the canvas to step through three rhythms: the line of text under the caption is the one that plays now, and the grid at the top follows it.', zh: '在畫布上點一下就換下一個節奏：說明文字下面那一行就是現在播的節奏，上方的鼓機格子也跟著變。' },
      },
      {
        code: `function setup() {
  createCanvas(400, 300);
  startDrums({}, 90);   // no lane has a hit: nothing to hear, the clock still counts
  noStroke();
}

function draw() {
  background(20);
  for (let i = 0; i < 16; i++) {
    fill(i === drumStep ? 255 : 90);
    circle(30 + i * 22.5, height / 2, i === drumStep ? 18 : 8);
  }
}`,
        caption: { en: 'A silent clock: sixteen dots with the current step enlarged, running at 90 bpm with no sound at all.', zh: '一個沒有聲音的時鐘：十六個點，現在這一格的點比較大，以每分鐘 90 拍的速度走，完全沒有聲音。' },
      },
    ],
    related: ['stopDrums', 'drumsAreOn', 'drumHit', 'drumStep', 'drumPhase', 'drawRhythm', 'cue', 'rhythmChanged', 'beat'],
    keywords: {
      en: ['drums', 'drum machine', 'rhythm', 'beat', 'tempo', 'bpm', 'pattern', 'sequencer', 'strudel', 'tidal', 'kick', 'snare', 'hi-hat', 'metronome', 'clock'],
      zh: ['鼓機', '鼓', '節奏', '拍子', '速度', '節拍器', '節奏型', '大鼓', '小鼓', '時鐘', '一行節奏'],
    },
    claims: [
      { before: 'startDrums(\'latin\', 1000)', expr: 'OAVp5.drums.bpm', equals: 300 },
      { before: 'startDrums(\'latin\', 5)', expr: 'OAVp5.drums.bpm', equals: 30 },
      { before: 'startDrums(90)', expr: 'OAVp5.drums.bpm', equals: 90 },
    ],
  },

  stopDrums: {
    group: 'drums',
    aliases: ['OAVp5.drums.stop'],
    summary: {
      en: 'Stops the drum machine and hides its card.',
      zh: '停掉鼓機，並把它的卡片收起來。',
    },
    params: [],
    returns: { type: 'Promise<Boolean>', en: 'A promise that is already resolved to `false`, the new state of the machine.', zh: '一個已經 resolve 成 `false` 的 promise，`false` 就是鼓機的新狀態。' },
    description: [
      {
        en: 'The machine stops playing, the grid disappears and [`drumsAreOn`](#drumsAreOn) becomes `false`. The numbers keep the last value they had: [`drumStep`](#drumStep), [`drumBar`](#drumBar) and [`cueName`](#cueName) stay where they were, and [`drumPhase`](#drumPhase) and [`beatPhase`](#beatPhase) hold still. [`startDrums()`](#startDrums) afterwards begins again from bar 1.',
        zh: '鼓機停止播放，格子消失，[`drumsAreOn`](#drumsAreOn) 變成 `false`。各個數字停在最後的值：[`drumStep`](#drumStep)、[`drumBar`](#drumBar) 和 [`cueName`](#cueName) 留在原來的地方，[`drumPhase`](#drumPhase) 和 [`beatPhase`](#beatPhase) 也停住不動。之後再呼叫 [`startDrums()`](#startDrums) 會從第 1 小節重新開始。',
      },
      {
        en: 'It also works while the machine is still loading: the pending [`startDrums()`](#startDrums) then resolves to `false`. The × on the card does the same thing.',
        zh: '機器還在載入的時候呼叫也可以：還沒結束的 [`startDrums()`](#startDrums) 會 resolve 成 `false`。卡片上的 × 做的是同一件事。',
      },
    ],
    tbd: [
      {
        en: 'After `stopDrums()` and a second `startDrums()` on the same page the machine plays and counts again, but [`drumsAreOn`](#drumsAreOn) and `OAVp5.drums.state` stayed `false` and `\'off\'` when this was tried (Chromium, oav-p5 0.8.0). Whether that is intended is not confirmed.',
        zh: '在同一個頁面呼叫 `stopDrums()` 之後再呼叫一次 `startDrums()`，鼓機會再度播放、計數，但實際試的時候（Chromium，oav-p5 0.8.0），[`drumsAreOn`](#drumsAreOn) 和 `OAVp5.drums.state` 仍然是 `false` 和 `\'off\'`。這是不是預期的行為，還沒有確認。',
      },
    ],
    examples: [
      {
        code: `function setup() {
  createCanvas(400, 300);
  startDrums('four on floor', 120);
  textAlign(CENTER, CENTER);
}

function mousePressed() {
  stopDrums();
}

function draw() {
  background(drumsAreOn ? 40 : 100);
  fill(255);
  text(drumsAreOn ? 'click to stop the drums' : 'stopped at step ' + drumStep, width / 2, height / 2);
}`,
        caption: { en: 'Click the canvas: the grid disappears, the background turns light and the text shows the step it stopped on.', zh: '在畫布上點一下：鼓機消失，背景變亮，文字顯示它停在第幾格。' },
      },
    ],
    related: ['startDrums', 'drumsAreOn', 'stopSound'],
    keywords: {
      en: ['drums', 'stop', 'off', 'halt', 'silence', 'drum machine'],
      zh: ['鼓機', '停止', '關閉', '停掉', '靜音'],
    },
  },

  drumsAreOn: {
    group: 'drums',
    summary: {
      en: 'Whether the drum machine is playing right now.',
      zh: '鼓機現在有沒有在播。',
    },
    value: {
      type: 'Boolean',
      en: 'True while the machine plays, false at the start, after [`stopDrums()`](#stopDrums), after an error and while the grid\'s own checkbox is unticked.',
      zh: '鼓機在播的時候是 true，一開始、呼叫 [`stopDrums()`](#stopDrums) 之後、出錯的時候、以及格子上自己的勾選框取消勾選的時候是 false。',
    },
    description: [
      {
        en: 'Use it to tell "the drums are not running" from "the drums are at step 0": [`drumStep`](#drumStep) is 0 in both cases. `if (drumsAreOn) { … }` is also the right guard before you read [`drumPhase`](#drumPhase). It changes only when the machine starts or stops, and reading it never starts anything.',
        zh: '用它來分辨「鼓機沒在跑」和「鼓機剛好在第 0 格」：這兩種情況下 [`drumStep`](#drumStep) 都是 0。在讀 [`drumPhase`](#drumPhase) 之前用 `if (drumsAreOn) { … }` 把關也很合適。它只有在鼓機開始或停止的時候才會變，讀它不會啟動任何東西。',
      },
      {
        en: 'For the reason behind a `false` read `OAVp5.drums.state`: [`\'loading\'`](#OAVp5.drums.state) while the module arrives, `\'stopped\'` when the grid is up but not playing, `\'error\'` when it could not load.',
        zh: '`false` 的原因看 `OAVp5.drums.state`：模組還在下載是 [`\'loading\'`](#OAVp5.drums.state)，格子在但沒在播是 `\'stopped\'`，載入失敗是 `\'error\'`。',
      },
    ],
    needs: {
      en: 'It becomes true after [`startDrums()`](#startDrums) (or 🥁 in the 🎹 panel) has loaded the machine, usually within a fraction of a second.',
      zh: '要先呼叫 [`startDrums()`](#startDrums)（或按 🎹 面板的 🥁），等鼓機載入完才會變成 true，通常不到一秒。',
    },
    notes: [
      {
        en: 'A sketch that declares its own variable called `drumsAreOn` keeps it: oav-p5 leaves the name alone and a card says to read `OAVp5.drums.state === \'on\'` instead.',
        zh: '如果草圖本來就宣告了自己的 `drumsAreOn` 變數，就用你的：oav-p5 不動這個名稱，並用一張卡片提醒你改讀 `OAVp5.drums.state === \'on\'`。',
      },
    ],
    tbd: [
      {
        en: 'After [`stopDrums()`](#stopDrums) and a second [`startDrums()`](#startDrums) it stayed `false` while the machine played again (Chromium, oav-p5 0.8.0). Not confirmed whether that is intended.',
        zh: '呼叫 [`stopDrums()`](#stopDrums) 之後再呼叫一次 [`startDrums()`](#startDrums)，鼓機明明又在播，它卻仍是 `false`（Chromium，oav-p5 0.8.0）。這是不是預期的行為，還沒有確認。',
      },
    ],
    examples: [
      {
        code: `function setup() {
  createCanvas(400, 300);
  startDrums('half time', 100);
  textAlign(CENTER, CENTER);
}

function draw() {
  background(20);
  fill(drumsAreOn ? color(120, 220, 140) : color(220, 160, 60));
  circle(width / 2, height / 2, 80);
  fill(255);
  text(drumsAreOn ? 'drums are on' : 'drums are not running', width / 2, height - 40);
}`,
        caption: { en: 'An amber circle for a moment while the machine loads, then green.', zh: '鼓機載入的那一瞬間是琥珀色的圓，然後變成綠色。' },
      },
    ],
    related: ['startDrums', 'stopDrums', 'drumStep', 'soundIsOn', 'micIsOn', 'recordingIsOn'],
    keywords: {
      en: ['drums', 'on', 'playing', 'status', 'running', 'drum machine'],
      zh: ['鼓機', '開著', '播放中', '狀態', '有沒有在播'],
    },
    claims: [{ expr: 'drumsAreOn', equals: false }],
  },

  drumBpm: {
    group: 'drums',
    aliases: ['OAVp5.drums.bpm'],
    summary: {
      en: 'The tempo of the drum machine in beats per minute.',
      zh: '鼓機的速度，單位是每分鐘幾拍。',
    },
    value: {
      type: 'Number', range: '30..300',
      en: '112 until you set another one. It follows [`startDrums()`](#startDrums) and the tempo slider on the grid.',
      zh: '在你設定別的之前是 112。它會跟著 [`startDrums()`](#startDrums) 和格子上的速度滑桿走。',
    },
    description: [
      {
        en: 'A beat is a quarter note, four steps, so one step lasts `60 / drumBpm / 4` seconds and one bar `240 / drumBpm`: at 120 a bar takes 2 seconds. To change the tempo call [`startDrums(bpm)`](#startDrums): `startDrums(drumBpm + 5)` speeds up by five. Writing to `drumBpm` yourself changes nothing.',
        zh: '一拍是一個四分音符，也就是四格，所以一格長 `60 / drumBpm / 4` 秒，一小節長 `240 / drumBpm` 秒：速度 120 的時候一小節是 2 秒。要改速度就呼叫 [`startDrums(bpm)`](#startDrums)：`startDrums(drumBpm + 5)` 就是加快 5。自己對 `drumBpm` 賦值不會有任何作用。',
      },
      {
        en: '[`startDrums()`](#startDrums) keeps the tempo between 30 and 300; the slider on the grid goes from 60 to 180.',
        zh: '[`startDrums()`](#startDrums) 會把速度限制在 30 到 300 之間，格子上的滑桿則是從 60 到 180。',
      },
    ],
    notes: [
      {
        en: 'A sketch that declares its own variable called `drumBpm` keeps it: oav-p5 leaves the name alone and a card says to read `OAVp5.drums.bpm` instead.',
        zh: '如果草圖本來就宣告了自己的 `drumBpm` 變數，就用你的：oav-p5 不動這個名稱，並用一張卡片提醒你改讀 `OAVp5.drums.bpm`。',
      },
    ],
    examples: [
      {
        code: `function setup() {
  createCanvas(400, 300);
  startDrums('four on floor', 100);
  textAlign(CENTER, CENTER);
  textSize(32);
}

function keyPressed() {
  if (keyCode === UP_ARROW) startDrums(drumBpm + 5);
  if (keyCode === DOWN_ARROW) startDrums(drumBpm - 5);
}

function draw() {
  background(20);
  fill(255);
  text(round(drumBpm) + ' bpm', width / 2, height / 2);
}`,
        caption: { en: 'Press the up and down arrow keys to change the tempo by 5; the number shows it.', zh: '按上、下方向鍵，每次把速度加減 5，數字會顯示出來。' },
      },
    ],
    related: ['startDrums', 'drumPhase', 'beatPhase', 'drumBar'],
    keywords: {
      en: ['bpm', 'tempo', 'speed', 'beats per minute', 'drums', 'drum machine'],
      zh: ['速度', '節拍速度', '每分鐘幾拍', '鼓機', 'bpm'],
    },
    claims: [{ expr: 'drumBpm', equals: 112 }],
  },

  drumPhase: {
    group: 'drums',
    aliases: ['OAVp5.drums.phase'],
    summary: {
      en: 'How far through the current bar the drum machine is, smoothly from 0 up to just below 1, as it is heard.',
      zh: '鼓機走到這一小節的哪裡，從 0 平滑地增加到快要 1，是你耳朵聽到的位置。',
    },
    value: {
      type: 'Number', range: '0..1',
      en: 'Read fresh each time you look at it, so it is never a frame old. 0 at the start of a bar, close to 1 at its end, then 0 again. It is 0 before the machine has played and holds still while it is stopped.',
      zh: '每次讀都是當下的值，不會慢一個畫面。小節開頭是 0，結尾接近 1，然後回到 0。鼓機還沒播之前是 0，停下來的時候停在原地。',
    },
    description: [
      {
        en: 'Use it for anything that should move continuously with the music: `rotate(drumPhase * TWO_PI)` turns once per bar. [`drumStep`](#drumStep) says the same thing in 16 jumps; `drumPhase` is the smooth version. The value is what the listener hears, which is the machine\'s position corrected for the latency of the speakers, so a drawing driven by it lands on the beat you hear.',
        zh: '任何要跟著音樂連續移動的東西都用它：`rotate(drumPhase * TWO_PI)` 一小節轉一圈。[`drumStep`](#drumStep) 講的是同一件事，只是分成 16 次跳動，`drumPhase` 是平滑的版本。它的值是聽的人聽到的位置，也就是鼓機的位置再扣掉喇叭的延遲，所以用它驅動的畫面會落在你聽到的拍子上。',
      },
      {
        en: 'A bar has four beats; [`beatPhase`](#beatPhase) is the same idea for one beat.',
        zh: '一小節有四拍，[`beatPhase`](#beatPhase) 是同樣的概念，單位是一拍。',
      },
    ],
    needs: {
      en: 'Start the machine with [`startDrums()`](#startDrums); until it plays, `drumPhase` is 0.',
      zh: '先用 [`startDrums()`](#startDrums) 啟動鼓機，在它開始播之前，`drumPhase` 是 0。',
    },
    notes: [
      {
        en: 'A sketch that declares its own `drumPhase` keeps it, and oav-p5 does not write that name. `OAVp5.drums.phase` is the same number under a name nothing else can take.',
        zh: '如果草圖本來就宣告了自己的 `drumPhase`，就用你的，oav-p5 不會去寫這個名稱。`OAVp5.drums.phase` 是同一個數字，用一個不會跟別人衝突的名字。',
      },
    ],
    examples: [
      {
        code: `function setup() {
  createCanvas(400, 300);
  startDrums('four on floor', 120);
  strokeWeight(4);
}

function draw() {
  background(20);
  stroke(255, 211, 107);
  translate(width / 2, height / 2);
  rotate(drumPhase * TWO_PI - HALF_PI);
  line(0, 0, 110, 0);   // a hand that turns once per bar
}`,
        caption: { en: 'A clock hand that turns exactly once every bar, smoothly.', zh: '一根時鐘的指針，每一小節剛好轉一圈，轉得很平滑。' },
      },
      {
        code: `function setup() {
  createCanvas(400, 300);
  startDrums('breakbeat', 110);
  noStroke();
}

function draw() {
  background(20);
  const a = drumStep / 16 * TWO_PI - HALF_PI;   // hops from step to step
  const b = drumPhase * TWO_PI - HALF_PI;       // moves all the time
  fill(255, 120, 90);
  circle(200 + cos(a) * 100, 150 + sin(a) * 100, 20);
  fill(120, 200, 255);
  circle(200 + cos(b) * 70, 150 + sin(b) * 70, 20);
}`,
        caption: { en: 'Two dots on two circles: the orange one hops from step to step, the blue one runs smoothly.', zh: '兩個圓上各有一個點：橘色的一格一格跳，藍色的連續不斷地跑。' },
      },
    ],
    related: ['beatPhase', 'drumStep', 'drumBar', 'startDrums', 'drawRhythm'],
    keywords: {
      en: ['phase', 'bar phase', 'progress', 'smooth', 'rotate', 'cycle', 'drums', 'position in bar'],
      zh: ['相位', '小節進度', '平滑', '轉一圈', '週期', '鼓機', '走到哪'],
    },
    claims: [{ before: 'startDrums(\'four on floor\', 120)', expr: 'drumPhase', min: 0, max: 1, moves: true }],
  },

  beatPhase: {
    group: 'drums',
    aliases: ['OAVp5.drums.beatPhase'],
    summary: {
      en: 'How far through the current beat the drum machine is, smoothly from 0 up to just below 1, four times per bar.',
      zh: '鼓機走到這一拍的哪裡，從 0 平滑地增加到快要 1，一小節會跑四次。',
    },
    value: {
      type: 'Number', range: '0..1',
      en: 'Read fresh each time you look at it. 0 on the beat, close to 1 just before the next one, then 0 again. It is 0 before the machine has played and holds still while it is stopped.',
      zh: '每次讀都是當下的值。正拍上是 0，下一拍之前接近 1，然後回到 0。鼓機還沒播之前是 0，停下來的時候停在原地。',
    },
    description: [
      {
        en: 'A beat is a quarter note (four steps). `1 - beatPhase` is biggest right on the beat and shrinks until the next one, so `circle(width / 2, height / 2, 60 + (1 - beatPhase) * 80)` pulses with the tempo, with no callback needed. [`drumPhase`](#drumPhase) is the same thing across a whole bar.',
        zh: '一拍是一個四分音符（四格）。`1 - beatPhase` 在正拍上最大，然後縮小到下一拍，所以 `circle(width / 2, height / 2, 60 + (1 - beatPhase) * 80)` 會跟著速度脈動，不用任何 callback。[`drumPhase`](#drumPhase) 是同樣的東西，範圍是整個小節。',
      },
    ],
    needs: {
      en: 'Start the machine with [`startDrums()`](#startDrums); until it plays, `beatPhase` is 0.',
      zh: '先用 [`startDrums()`](#startDrums) 啟動鼓機，在它開始播之前，`beatPhase` 是 0。',
    },
    examples: [
      {
        code: `function setup() {
  createCanvas(400, 300);
  startDrums('four on floor', 120);
  noStroke();
}

function draw() {
  background(20);
  fill(255, 120, 90);
  circle(width / 2, height / 2, 60 + (1 - beatPhase) * 100);   // biggest on the beat
}`,
        caption: { en: 'A circle that pulses four times per bar: biggest on each beat, then shrinking until the next one.', zh: '一個圓，一小節脈動四次：每一拍最大，然後縮小到下一拍。' },
      },
    ],
    related: ['drumPhase', 'drumStep', 'startDrums', 'beat'],
    keywords: {
      en: ['beat phase', 'pulse', 'beat progress', 'quarter note', 'smooth', 'drums'],
      zh: ['拍子進度', '脈動', '一拍', '平滑', '鼓機'],
    },
    claims: [{ before: 'startDrums(\'four on floor\', 120)', expr: 'beatPhase', min: 0, max: 1, moves: true }],
  },

  drumHit: {
    group: 'drums',
    summary: {
      en: 'An event you define: it is called for every hit of the drum machine, with the drum that sounded and how hard.',
      zh: '一個由你定義的事件函式：鼓機每打一下就會呼叫它，告訴你是哪一種鼓、打得多用力。',
    },
    params: [
      { name: 'lane', type: 'String', en: 'The drum that sounded: `\'kick\'`, `\'snare\'`, `\'hat\'` or `\'clap\'` for the grid, and also `\'openhat\'`, `\'pedalhat\'`, `\'rim\'`, `\'lowtom\'`, `\'tom\'`, `\'hightom\'`, `\'crash\'`, `\'ride\'` or `\'cowbell\'` for a line of rhythm.', zh: '發聲的鼓：格子上是 `\'kick\'`、`\'snare\'`、`\'hat\'`、`\'clap\'`，一行字寫的節奏還會有 `\'openhat\'`、`\'pedalhat\'`、`\'rim\'`、`\'lowtom\'`、`\'tom\'`、`\'hightom\'`、`\'crash\'`、`\'ride\'`、`\'cowbell\'`。' },
      { name: 'velocity', type: 'Number', en: 'How hard, from 0.15 to 1. It varies a little from hit to hit, because the machine plays slightly softer or louder on purpose.', zh: '打得多用力，從 0.15 到 1。每一下會有一點點不同，因為鼓機故意打得時輕時重。' },
    ],
    description: [
      {
        en: 'Define `function drumHit(lane, velocity) { … }` and oav-p5 calls it for every hit of every drum, the way it calls [`notePressed()`](#notePressed) for a key. It is called in the frame in which the hit is heard, right before `draw()`.',
        zh: '定義 `function drumHit(lane, velocity) { … }`，鼓機每打一下、不論哪一種鼓，oav-p5 都會呼叫它，就像按一個鍵會呼叫 [`notePressed()`](#notePressed) 一樣。它是在你聽到那一下的那個畫面、`draw()` 之前被呼叫的。',
      },
      {
        en: 'The same hit also calls the microphone\'s functions, so you can pick the grain you want: [`kickDetected()`](#kickDetected) for the kick, `snareDetected()` for snare, clap and rim, `hatDetected()` for the three hats, and [`beatDetected()`](#beatDetected) (with [`beat`](#beat) true for a frame) for kick, snare, clap and rim, once per step. Toms, crash, ride and cowbell reach only `drumHit()`. On one step the order is: [`cueFired()`](#cueFired), [`barStarted()`](#barStarted), [`stepStarted()`](#stepStarted), then the hits.',
        zh: '同一下打擊也會呼叫麥克風用的那些函式，你可以挑想要的粒度：[`kickDetected()`](#kickDetected) 是大鼓，`snareDetected()` 是小鼓、拍手和鼓邊，`hatDetected()` 是三種鈸，[`beatDetected()`](#beatDetected)（同時 [`beat`](#beat) 在那個畫面是 true）是大鼓、小鼓、拍手和鼓邊，每一格最多一次。中鼓、碎音鈸、疊音鈸和牛鈴只會呼叫 `drumHit()`。同一格裡的順序是：[`cueFired()`](#cueFired)、[`barStarted()`](#barStarted)、[`stepStarted()`](#stepStarted)，最後才是各個打擊。',
      },
    ],
    notes: [
      {
        en: 'While the tab is hidden nobody sees a frame: the clock keeps counting, but no hit is told, and nothing is told twice when the tab comes back. An error thrown inside `drumHit()` is printed, with its file and line, and the next hit still comes.',
        zh: '分頁被藏起來的時候沒有人看得到畫面：時鐘照樣在數，但不會通知任何一下打擊，分頁回來時也不會把漏掉的補通知一次。`drumHit()` 裡丟出的錯誤會連同檔案和行號印出來，下一下打擊照樣會來。',
      },
    ],
    examples: [
      {
        code: `const COLORS = { kick: '#ff6b6b', snare: '#ffd166', hat: '#6fd3ff', clap: '#c792ff' };
const lit = { kick: 0, snare: 0, hat: 0, clap: 0 };

function setup() {
  createCanvas(400, 300);
  startDrums('breakbeat', 120);
  noStroke();
}

function drumHit(lane, velocity) {
  lit[lane] = velocity;
}

function draw() {
  background(20);
  Object.keys(lit).forEach((lane, i) => {
    fill(COLORS[lane]);
    circle(60 + i * 93, height / 2, 30 + lit[lane] * 70);
    lit[lane] *= 0.85;
  });
}`,
        caption: { en: 'Four circles, one per drum: each swells with the hit and shrinks back, and a harder hit swells more.', zh: '四個圓，一種鼓一個：每打一下就鼓起來再縮回去，打得越用力鼓得越大。' },
      },
      {
        code: `let last = '';

function setup() {
  createCanvas(400, 300);
  startDrums('bd*4, cr ~ ~ ~, lt(3,8), hh*8', 100);
  textAlign(CENTER, CENTER);
  textSize(32);
}

function drumHit(lane, velocity) {
  last = lane;
}

function draw() {
  background(20);
  fill(255);
  text(last, width / 2, height / 2);
}`,
        caption: { en: 'The name of the latest drum that sounded: a line of rhythm brings crash and low tom, which only drumHit() reports.', zh: '顯示最近一下是哪種鼓：一行字寫的節奏會有碎音鈸和落地鼓，這些只有 drumHit() 會通知。' },
      },
    ],
    related: ['startDrums', 'kickDetected', 'beatDetected', 'stepStarted', 'barStarted', 'OAVp5.drums.on', 'notePressed'],
    keywords: {
      en: ['drum hit', 'hit', 'drum event', 'kick', 'snare', 'hat', 'clap', 'callback', 'velocity', 'trigger'],
      zh: ['打擊', '鼓點', '鼓的事件', '大鼓', '小鼓', '力度', '觸發', 'callback'],
    },
  },

  rhythmChanged: {
    group: 'drums',
    summary: {
      en: 'An event you define: it is called with the new line of rhythm every time the rhythm changes.',
      zh: '一個由你定義的事件函式：節奏每次改變，就會帶著新的那一行節奏被呼叫。',
    },
    params: [
      { name: 'src', type: 'String', en: 'The line of rhythm that plays now, for example `\'bd*4, [~ sd]*2, hh*8\'`. A preset or a grid you drew comes as the line it is written as.', zh: '現在播的那一行節奏，例如 `\'bd*4, [~ sd]*2, hh*8\'`。預設節奏或你自己畫的格子，會以它對應的那一行字給你。' },
      { name: 'how', type: 'String', en: 'What changed it: `\'code\'` ([`startDrums()`](#startDrums)), `\'cell\'` (a click on a cell of the grid), `\'type\'` (typed into the line on the card, or [`OAVp5.drums.edit()`](#OAVp5.drums.edit)), `\'undo\'` (↶ or [`OAVp5.drums.undo()`](#OAVp5.drums.undo)) or `\'menu\'` (a preset picked on the card).', zh: '是什麼改變了它：`\'code\'`（[`startDrums()`](#startDrums)）、`\'cell\'`（點了格子上的一格）、`\'type\'`（在卡片的那行字上打字，或用 [`OAVp5.drums.edit()`](#OAVp5.drums.edit)）、`\'undo\'`（↶ 或 [`OAVp5.drums.undo()`](#OAVp5.drums.undo)）、`\'menu\'`（在卡片上挑了一個預設節奏）。' },
    ],
    description: [
      {
        en: 'The line over the grid and the cells edit each other, so the rhythm can change without your code: a click on a cell, a line typed into the card, ↶. `rhythmChanged(src, how)` tells the sketch, so it can show the line on the canvas (where a recording has it) or store it. It is also called once after [`startDrums()`](#startDrums), a moment after the rhythm module has loaded, with `how` equal to `\'code\'`.',
        zh: '格子上方的那一行字和格子本身會互相改寫，所以節奏可以在你的程式碼之外改變：點格子、在卡片上打字、按 ↶。`rhythmChanged(src, how)` 把這件事告訴草圖，讓它可以把那一行字畫在畫布上（錄影就錄得到），或是存起來。[`startDrums()`](#startDrums) 之後，節奏模組載入完的那一刻也會呼叫一次，這時 `how` 是 `\'code\'`。',
      },
    ],
    examples: [
      {
        code: `let current = '';
let how = '';

function setup() {
  createCanvas(400, 300);
  startDrums('bd*4, [~ sd]*2, hh*8', 110);
  textAlign(CENTER, CENTER);
}

function rhythmChanged(src, mode) {
  current = src;
  how = mode;
}

function mousePressed() {
  OAVp5.drums.edit('bd(3,8), [~ sd]*2, hh*16');   // as if typed on the card
}

function draw() {
  background(20);
  fill(255);
  text(current, width / 2, height / 2 - 10);
  text('changed by: ' + how, width / 2, height / 2 + 20);
  text('click the canvas, or click a cell of the grid', width / 2, height - 30);
}`,
        caption: { en: 'The line that plays and what changed it: "code" at the start, "type" after a click on the canvas, "cell" when you click a cell of the grid.', zh: '顯示正在播的那一行節奏和是誰改的：一開始是 "code"，點畫布之後是 "type"，點格子上的一格就是 "cell"。' },
      },
    ],
    related: ['startDrums', 'OAVp5.drums.src', 'OAVp5.drums.edit', 'OAVp5.drums.undo', 'OAVp5.drums.history', 'OAVp5.drums.on', 'drawRhythm'],
    keywords: {
      en: ['rhythm changed', 'line of rhythm', 'edit', 'callback', 'event', 'undo', 'strudel', 'pattern changed'],
      zh: ['節奏改變', '一行節奏', '編輯', '事件', '復原', '節奏型改變'],
    },
  },

  drawRhythm: {
    group: 'drums',
    aliases: ['OAVp5.drums.draw'],
    summary: {
      en: 'Draws the rhythm on the canvas as a grid, a circle or a spiral, with a playhead and the hits lighting up, so a recording has it too.',
      zh: '把節奏畫在畫布上，樣式可以是格子、圓或螺旋，有播放頭，打擊的時候會亮起來，所以錄影也錄得到。',
    },
    params: [
      { name: 'x', type: 'Number', optional: true, en: 'Left edge of the box to draw in. In `WEBGL` the middle of the canvas is (0, 0). If any of `x`, `y`, `w`, `h` is left out, the default box is used.', zh: '要畫的方框的左邊。在 `WEBGL` 裡，畫布中心是 (0, 0)。`x`、`y`、`w`、`h` 只要有一個沒傳，就用預設的方框。' },
      { name: 'y', type: 'Number', optional: true, en: 'Top edge of the box.', zh: '方框的上邊。' },
      { name: 'w', type: 'Number', optional: true, en: 'Width of the box.', zh: '方框的寬。' },
      { name: 'h', type: 'Number', optional: true, en: 'Height of the box.', zh: '方框的高。' },
      { name: 'style', type: 'String | Object', optional: true, default: '\'grid\'', en: '`\'grid\'` (the 16 steps with a playhead), `\'circle\'` (a ring of 16 per drum with a hand turned by [`drumPhase`](#drumPhase)) or `\'spiral\'` (the last few bars wound outwards, now at the tip). An object here is taken as `o`, with `style` inside it.', zh: '`\'grid\'`（16 格加一條播放頭）、`\'circle\'`（每種鼓一圈 16 格，指針照 [`drumPhase`](#drumPhase) 轉）或 `\'spiral\'`（最近幾小節往外繞，現在在最外面的尖端）。這裡如果給的是物件，就當成 `o`，`style` 寫在物件裡面。' },
      { name: 'o', type: 'Object', optional: true, en: 'Options: `colors` (`{ kick: \'#f66\', … }`, any p5 colour per drum), `color` (one colour for all), `off` (the empty steps), `playhead` (a colour, or `false` for none), `bg` (a background for the box) and `bars` (spiral only, 1 to 16, 4 if left out).', zh: '選項：`colors`（`{ kick: \'#f66\', … }`，每種鼓一個 p5 看得懂的顏色）、`color`（全部同一個顏色）、`off`（空格子的顏色）、`playhead`（顏色，或 `false` 表示不畫）、`bg`（方框的底色）、`bars`（只用在螺旋，1 到 16，沒寫就是 4）。' },
    ],
    returns: { type: 'Boolean', en: '`true` if it drew something, `false` when the box is empty (`w` or `h` is not above 0) or there is no p5 global mode to draw with.', zh: '有畫東西就是 `true`，方框是空的（`w` 或 `h` 不大於 0），或沒有 p5 全域模式可以畫的時候是 `false`。' },
    description: [
      {
        en: 'Call it in `draw()` after `background()`: `drawRhythm(20, 100, 360, 100)`. Each row is one drum that plays in the pattern, a hit lights up the moment it is heard (the clock [`drumPhase`](#drumPhase) reads), and a hit between two steps, such as a triplet, sits where it falls. The grid card is part of the page and a recording never shows it, but the canvas is what a recording takes, so this is how the rhythm gets into the video.',
        zh: '在 `draw()` 裡、`background()` 之後呼叫：`drawRhythm(20, 100, 360, 100)`。每一列是節奏裡有用到的一種鼓，打擊在你聽到的那一刻亮起來（用的就是 [`drumPhase`](#drumPhase) 讀的那個時鐘），兩格之間的打擊（例如三連音）會畫在它實際落下的位置。鼓機的卡片是頁面的一部分，錄影錄不到，但錄影錄的是畫布，所以要讓節奏進影片，就用這個。',
      },
      {
        en: 'With no box it draws a strip along the bottom for `\'grid\'` and a square in the middle for the other two. It draws with p5\'s own shapes between `push()` and `pop()`, so it leaves your styles alone and works in 2D and in `WEBGL`, in p5 1.x and 2.x. In `WEBGL` the origin is the middle of the canvas: `drawRhythm(-width / 2, -height / 2, width, height, \'circle\')` fills it.',
        zh: '不給方框的話，`\'grid\'` 畫在畫布下方的一條帶子，另外兩種畫在中間的正方形。它用 p5 自己的圖形，包在 `push()` 和 `pop()` 之間，所以不會弄亂你設定的樣式，2D 和 `WEBGL`、p5 1.x 和 2.x 都能用。在 `WEBGL` 裡原點是畫布中心：`drawRhythm(-width / 2, -height / 2, width, height, \'circle\')` 會鋪滿整個畫布。',
      },
    ],
    needs: {
      en: 'Start the machine with [`startDrums()`](#startDrums) first. Before it plays you get an empty four-lane grid.',
      zh: '要先用 [`startDrums()`](#startDrums) 啟動鼓機。在它開始播之前，畫出來的是一個空的四軌格子。',
    },
    notes: [
      {
        en: '`OAVp5.drums.draw(x, y, w, h, style, o)` is the same function as a method.',
        zh: '`OAVp5.drums.draw(x, y, w, h, style, o)` 是同一個函式，寫成方法的樣子。',
      },
    ],
    examples: [
      {
        code: `function setup() {
  createCanvas(400, 300);
  startDrums('breakbeat', 120);
}

function draw() {
  background(14, 16, 26);
  drawRhythm(20, 100, 360, 100);   // the 16 steps with a playhead
}`,
        caption: { en: 'The pattern as a grid on the canvas itself: a white playhead crosses it, and every hit lights up as it sounds.', zh: '節奏以格子的樣子畫在畫布上：一條白色的播放頭掃過去，每一下打擊發聲的時候那一格亮起來。' },
      },
      {
        code: `function setup() {
  createCanvas(400, 300);
  startDrums('bd(3,8), [~ sd]*2, hh*8, ~ ~ ~ cp', 104);
}

function draw() {
  background(14, 16, 26);
  drawRhythm(10, 10, 180, 180, 'circle');
  drawRhythm(210, 10, 180, 180, 'spiral', { bars: 4, colors: { kick: '#ff7b54' } });
  drawRhythm(20, 220, 360, 60, 'grid', { bg: 'rgba(255, 255, 255, 0.05)' });
}`,
        caption: { en: 'The same rhythm three ways: a ring per drum with a hand, the last four bars as a spiral, and the grid along the bottom.', zh: '同一個節奏的三種畫法：每種鼓一圈、有指針的圓，最近四小節繞成的螺旋，以及下方的格子。' },
      },
      {
        code: `function setup() {
  createCanvas(400, 300, WEBGL);
  startDrums('four on floor', 120);
}

function draw() {
  background(14, 16, 26);
  drawRhythm(-width / 2, -height / 2, width, height, 'circle');   // (0, 0) is the middle in WEBGL
}`,
        caption: { en: 'In a WEBGL canvas the box starts at (-width / 2, -height / 2), because (0, 0) is the middle.', zh: '在 WEBGL 畫布裡方框要從 (-width / 2, -height / 2) 開始，因為 (0, 0) 是畫布中心。' },
      },
    ],
    related: ['startDrums', 'drumPhase', 'drumStep', 'startRecording', 'rhythmChanged'],
    keywords: {
      en: ['draw rhythm', 'visualize', 'grid', 'circle', 'spiral', 'playhead', 'drum visual', 'sequencer view', 'recording'],
      zh: ['畫節奏', '視覺化', '格子', '圓形', '螺旋', '播放頭', '鼓機畫面', '錄影'],
    },
  },

  'OAVp5.drums': {
    group: 'drums',
    summary: {
      en: 'The object behind the drum names: the state of the machine, its counters, the line of rhythm, its history and the loaded machine.',
      zh: '鼓機相關名稱背後的物件：機器的狀態、各種計數、那一行節奏、它的歷史，以及載入進來的鼓機。',
    },
    description: [
      {
        en: '`OAVp5.drums` (also reachable as `midi.drums`) is what [`startDrums()`](#startDrums), [`drumStep`](#drumStep) and the rest are built on. It holds the numbers ([`state`](#OAVp5.drums.state), [`step`](#drumStep), [`bar`](#drumBar), [`count`](#OAVp5.drums.count), [`bpm`](#drumBpm), [`phase`](#drumPhase), `beatPhase`), the rhythm ([`pattern`](#OAVp5.drums.pattern), [`src`](#OAVp5.drums.src), [`copyText`](#OAVp5.drums.copyText), [`strudelUrl`](#OAVp5.drums.strudelUrl), [`history`](#OAVp5.drums.history), [`edit()`](#OAVp5.drums.edit), [`undo()`](#OAVp5.drums.undo)), the cues ([`cue()`](#OAVp5.drums.cue), [`cues`](#OAVp5.drums.cues), [`lastCue`](#cueName)), a way to listen ([`on()`](#OAVp5.drums.on)), what the machine hears right now ([`now`](#OAVp5.drums.now)) and handles for the curious ([`machine`](#OAVp5.drums.machine), [`clock`](#OAVp5.drums.clock)).',
        zh: '`OAVp5.drums`（也可以用 `midi.drums` 取得）是 [`startDrums()`](#startDrums)、[`drumStep`](#drumStep) 這些名稱的底層。它裡面有數字（[`state`](#OAVp5.drums.state)、[`step`](#drumStep)、[`bar`](#drumBar)、[`count`](#OAVp5.drums.count)、[`bpm`](#drumBpm)、[`phase`](#drumPhase)、`beatPhase`）、節奏（[`pattern`](#OAVp5.drums.pattern)、[`src`](#OAVp5.drums.src)、[`copyText`](#OAVp5.drums.copyText)、[`strudelUrl`](#OAVp5.drums.strudelUrl)、[`history`](#OAVp5.drums.history)、[`edit()`](#OAVp5.drums.edit)、[`undo()`](#OAVp5.drums.undo)）、cue（[`cue()`](#OAVp5.drums.cue)、[`cues`](#OAVp5.drums.cues)、[`lastCue`](#cueName)）、監聽的方法（[`on()`](#OAVp5.drums.on)）、鼓機此刻聽到的樣子（[`now`](#OAVp5.drums.now)），以及給好奇的人用的把手（[`machine`](#OAVp5.drums.machine)、[`clock`](#OAVp5.drums.clock)）。',
      },
      {
        en: '`start`, `stop` and `draw` are the same as [`startDrums()`](#startDrums), [`stopDrums()`](#stopDrums) and [`drawRhythm()`](#drawRhythm). For a sketch the global names are enough. This object is for tools, libraries (Hydra, for one), the console and debugging.',
        zh: '`start`、`stop`、`draw` 跟 [`startDrums()`](#startDrums)、[`stopDrums()`](#stopDrums)、[`drawRhythm()`](#drawRhythm) 是同一回事。一般草圖用全域名稱就夠了。這個物件是給工具、函式庫（例如 Hydra）、主控台和除錯用的。',
      },
    ],
    examples: [
      {
        code: `function setup() {
  createCanvas(400, 300);
  startDrums('latin', 110);
  textSize(14);
}

function draw() {
  background(20);
  fill(255);
  const d = OAVp5.drums;
  text('state: ' + d.state, 20, 30);
  text('pattern: ' + d.pattern, 20, 60);
  text('bar ' + d.bar + ', step ' + d.step + ', count ' + d.count, 20, 90);
  text('bpm: ' + d.bpm, 20, 120);
}`,
        caption: { en: 'Four lines read from the drums object while the machine plays.', zh: '機器在播的時候，從鼓機物件讀出來的四行資料。' },
      },
    ],
    related: ['startDrums', 'OAVp5.drums.state', 'OAVp5.drums.on', 'OAVp5.sound', 'OAVp5.record'],
    keywords: {
      en: ['OAVp5.drums', 'drums object', 'midi.drums', 'drum state', 'debug', 'drum machine'],
      zh: ['鼓機物件', '鼓機狀態', '除錯', 'midi.drums'],
    },
  },

  'OAVp5.drums.state': {
    group: 'drums',
    summary: {
      en: 'Where the drum machine is: `\'off\'`, `\'loading\'`, `\'on\'`, `\'stopped\'` or `\'error\'`.',
      zh: '鼓機現在在哪個階段：`\'off\'`、`\'loading\'`、`\'on\'`、`\'stopped\'` 或 `\'error\'`。',
    },
    value: {
      type: 'String', range: 'off | loading | on | stopped | error',
      en: 'Starts as `\'off\'` and changes when the machine loads, plays, is stopped or fails.',
      zh: '一開始是 `\'off\'`，鼓機載入、播放、停止或失敗的時候就跟著變。',
    },
    description: [
      {
        en: '`\'loading\'` is the moment after [`startDrums()`](#startDrums) while the module arrives, `\'on\'` is playing, `\'stopped\'` is a grid that is up but not playing (its checkbox is unticked), `\'off\'` is where it starts and where [`stopDrums()`](#stopDrums) leaves it, and `\'error\'` means @openav/drums could not be loaded. [`drumsAreOn`](#drumsAreOn) is `state === \'on\'`.',
        zh: '`\'loading\'` 是呼叫 [`startDrums()`](#startDrums) 之後，模組還在下載的那段時間，`\'on\'` 是正在播，`\'stopped\'` 是格子還在但沒在播（它的勾選框取消勾選了），`\'off\'` 是起點，也是 [`stopDrums()`](#stopDrums) 之後的狀態，`\'error\'` 表示 @openav/drums 載入失敗。[`drumsAreOn`](#drumsAreOn) 就是 `state === \'on\'`。',
      },
    ],
    tbd: [
      {
        en: 'After [`stopDrums()`](#stopDrums) and a second [`startDrums()`](#startDrums) the state stayed `\'off\'` while the machine played again (Chromium, oav-p5 0.8.0). Not confirmed whether that is intended.',
        zh: '呼叫 [`stopDrums()`](#stopDrums) 之後再呼叫一次 [`startDrums()`](#startDrums)，鼓機明明又在播，狀態卻仍是 `\'off\'`（Chromium，oav-p5 0.8.0）。這是不是預期的行為，還沒有確認。',
      },
    ],
    examples: [
      {
        code: `function setup() {
  createCanvas(400, 300);
  startDrums('sparse', 90);
  textAlign(CENTER, CENTER);
  textSize(28);
}

function draw() {
  background(20);
  fill(255);
  text(OAVp5.drums.state, width / 2, height / 2);
}`,
        caption: { en: 'Shows "loading" for a moment, then "on". Untick the checkbox on the grid and it reads "stopped".', zh: '先短暫顯示 "loading"，然後是 "on"。把鼓機上的勾選框取消勾選，就變成 "stopped"。' },
      },
    ],
    related: ['drumsAreOn', 'startDrums', 'stopDrums', 'OAVp5.drums'],
    keywords: {
      en: ['drum state', 'status', 'loading', 'stopped', 'drums', 'machine state'],
      zh: ['鼓機狀態', '載入中', '已停止', '狀態'],
    },
    claims: [{ expr: 'OAVp5.drums.state', equals: 'off' }],
  },

  'OAVp5.drums.pattern': {
    group: 'drums',
    summary: {
      en: 'What the drum machine plays, as a name: the preset\'s name, `\'custom\'` for a grid, or the line of rhythm itself.',
      zh: '鼓機正在播的東西，用名字表示：預設節奏的名字、自己畫的格子是 `\'custom\'`，一行節奏就是那一行字本身。',
    },
    value: {
      type: 'String',
      en: '`\'four on floor\'` until you choose another. It follows what plays, including clicks on the grid.',
      zh: '在你選別的之前是 `\'four on floor\'`。它跟著正在播的東西走，包括在格子上點的修改。',
    },
    description: [
      {
        en: 'After `startDrums(\'breakbeat\')` it is `\'breakbeat\'`, after `startDrums({ kick: \'x...x...x...x...\' })` it is `\'custom\'`, and after `startDrums(\'bd*4, hh*8\')` it is that line. A click on a cell of a preset makes it `\'custom\'`. To get the line of rhythm in every case, read [`OAVp5.drums.src`](#OAVp5.drums.src): a preset also has one.',
        zh: '`startDrums(\'breakbeat\')` 之後是 `\'breakbeat\'`，`startDrums({ kick: \'x...x...x...x...\' })` 之後是 `\'custom\'`，`startDrums(\'bd*4, hh*8\')` 之後就是那一行字。在預設節奏的格子上點一下，它就變成 `\'custom\'`。想在每一種情況下都拿到那一行節奏，請讀 [`OAVp5.drums.src`](#OAVp5.drums.src)：預設節奏也有對應的那一行。',
      },
    ],
    examples: [
      {
        code: `function setup() {
  createCanvas(400, 300);
  startDrums('breakbeat', 110);
  textAlign(CENTER, CENTER);
  textSize(24);
}

function draw() {
  background(20);
  fill(255);
  text(OAVp5.drums.pattern, width / 2, height / 2);
}`,
        caption: { en: 'Shows "breakbeat"; click a cell of the grid and it turns into "custom".', zh: '顯示 "breakbeat"，在鼓機的格子上點一下，就變成 "custom"。' },
      },
    ],
    related: ['startDrums', 'OAVp5.drums.src', 'rhythmChanged'],
    keywords: {
      en: ['pattern', 'preset', 'current pattern', 'custom', 'rhythm name', 'drums'],
      zh: ['節奏型', '預設節奏', '目前節奏', '自訂', '鼓機'],
    },
    claims: [{ expr: 'OAVp5.drums.pattern', equals: 'four on floor' }],
  },

  'OAVp5.drums.src': {
    group: 'drums',
    summary: {
      en: 'The line of rhythm that plays now, such as `\'bd*4, [~ sd]*2, hh*8\'`; an empty string until the machine has loaded.',
      zh: '現在播的那一行節奏，例如 `\'bd*4, [~ sd]*2, hh*8\'`。鼓機載入之前是空字串。',
    },
    value: {
      type: 'String',
      en: 'Read fresh each time. A preset or a grid you drew shows as the line it is written as, and it changes with every click on a cell and every typed edit.',
      zh: '每次讀都是當下的值。預設節奏或你自己畫的格子，會顯示成它對應的那一行字，每點一次格子、每改一次文字，它就跟著變。',
    },
    description: [
      {
        en: 'Show it on the canvas so a recording has it (`text(OAVp5.drums.src, 20, 30)`), or keep it to come back to the rhythm later with [`startDrums(src)`](#startDrums). [`rhythmChanged()`](#rhythmChanged) tells you when it changes, and [`OAVp5.drums.copyText`](#OAVp5.drums.copyText) is the same line wrapped in a `startDrums("…")` call.',
        zh: '把它畫在畫布上，錄影就錄得到（`text(OAVp5.drums.src, 20, 30)`），或是存起來，之後用 [`startDrums(src)`](#startDrums) 回到這個節奏。它改變的時候 [`rhythmChanged()`](#rhythmChanged) 會通知你，[`OAVp5.drums.copyText`](#OAVp5.drums.copyText) 則是同一行字外面包上 `startDrums("…")`。',
      },
    ],
    needs: {
      en: 'It is `\'\'` until [`startDrums()`](#startDrums) has loaded the machine and the rhythm module, a fraction of a second.',
      zh: '在 [`startDrums()`](#startDrums) 載入鼓機和節奏模組之前都是 `\'\'`，大約不到一秒。',
    },
    examples: [
      {
        code: `function setup() {
  createCanvas(400, 300);
  startDrums('half time', 100);
  textAlign(CENTER, CENTER);
}

function draw() {
  background(20);
  fill(255);
  text(OAVp5.drums.src || 'loading…', width / 2, height / 2);
}`,
        caption: { en: 'The preset "half time" written as the line of rhythm it is; click cells on the grid and the line is rewritten.', zh: '預設節奏 "half time" 對應的那一行字，在格子上點一點，這一行就會被改寫。' },
      },
    ],
    related: ['OAVp5.drums.pattern', 'OAVp5.drums.copyText', 'OAVp5.drums.edit', 'rhythmChanged', 'startDrums'],
    keywords: {
      en: ['line of rhythm', 'source', 'rhythm string', 'current line', 'mini notation', 'drums'],
      zh: ['一行節奏', '節奏文字', '目前這一行', '鼓機', '寫法'],
    },
  },

  'OAVp5.drums.strudelUrl': {
    group: 'drums',
    summary: {
      en: 'The rhythm that plays now as a link that opens it at strudel.cc, or an empty string when there is none.',
      zh: '現在播的節奏做成的連結，打開就會在 strudel.cc 裡開啟同一個節奏，沒有的時候是空字串。',
    },
    value: {
      type: 'String',
      en: 'A `https://strudel.cc/#…` address, read fresh each time. `\'\'` before the machine has loaded.',
      zh: '一個 `https://strudel.cc/#…` 的網址，每次讀都是當下的。鼓機載入之前是 `\'\'`。',
    },
    description: [
      {
        en: 'It holds the line as `s("…")` with `setcpm(bpm/4)` (one bar here is one Strudel cycle of four beats), the same thing the "Open in Strudel" link on the card opens. Open it in a new tab: `window.open(OAVp5.drums.strudelUrl)` from a click handler.',
        zh: '裡面是那一行節奏，寫成 `s("…")`，再加上 `setcpm(bpm/4)`（這裡的一小節就是 Strudel 的一個週期，四拍），跟卡片上「在 Strudel 打開」連結開啟的是同一個東西。用新分頁打開它：在點擊的處理函式裡寫 `window.open(OAVp5.drums.strudelUrl)`。',
      },
    ],
    tbd: [
      {
        en: 'Not tried: whether the sketch frame of OpenProcessing lets `window.open` open the link.',
        zh: '還沒試過：OpenProcessing 的草圖框是否允許 `window.open` 開啟這個連結。',
      },
    ],
    examples: [
      {
        code: `function setup() {
  createCanvas(400, 300);
  startDrums('bd*4, [~ sd]*2, hh*8', 110);
  textAlign(CENTER, CENTER);
}

function mousePressed() {
  if (OAVp5.drums.strudelUrl) window.open(OAVp5.drums.strudelUrl, '_blank');
}

function draw() {
  background(20);
  fill(255);
  text('click to open this rhythm in strudel.cc', width / 2, height / 2 - 15);
  text(OAVp5.drums.strudelUrl.slice(0, 40) + '…', width / 2, height / 2 + 15);
}`,
        caption: { en: 'Shows the start of the link; a click opens it at strudel.cc in a new tab.', zh: '顯示連結的開頭，點一下就在新分頁的 strudel.cc 裡打開。' },
      },
    ],
    related: ['OAVp5.drums.src', 'OAVp5.drums.copyText', 'startDrums'],
    keywords: {
      en: ['strudel', 'strudel.cc', 'open in strudel', 'link', 'url', 'live coding'],
      zh: ['Strudel', '連結', '網址', '在 Strudel 打開', '即時編碼'],
    },
  },

  'OAVp5.drums.copyText': {
    group: 'drums',
    summary: {
      en: 'The text the Copy button on the card puts on the clipboard: the rhythm that plays now as a ready `startDrums("…", bpm)` call.',
      zh: '卡片上「複製」按鈕放進剪貼簿的文字：把現在播的節奏寫成可以直接貼上的 `startDrums("…", bpm)`。',
    },
    value: {
      type: 'String',
      en: 'For example `startDrums("bd*4, [~ sd]*2, hh*8", 110)`. Read fresh each time; `\'\'` before the machine has loaded.',
      zh: '例如 `startDrums("bd*4, [~ sd]*2, hh*8", 110)`。每次讀都是當下的值，鼓機載入之前是 `\'\'`。',
    },
    description: [
      {
        en: 'Click cells, type a line, find a rhythm you like, and paste this into `setup()` to keep it. The tempo is the current one, rounded to two decimals.',
        zh: '點格子、打字，找到喜歡的節奏之後，把這一行貼進 `setup()` 就能留住它。速度是現在的速度，四捨五入到小數點後兩位。',
      },
    ],
    examples: [
      {
        code: `function setup() {
  createCanvas(400, 300);
  startDrums('breakbeat', 120);
  textSize(12);
}

function draw() {
  background(20);
  fill(255);
  text(OAVp5.drums.copyText, 20, 20, width - 40, 200);
}`,
        caption: { en: 'The line to paste back into setup(); click cells on the grid and it follows.', zh: '可以貼回 setup() 的那一行，在格子上點一點，它也會跟著變。' },
      },
    ],
    related: ['OAVp5.drums.src', 'OAVp5.drums.strudelUrl', 'startDrums'],
    keywords: {
      en: ['copy', 'clipboard', 'copy code', 'startDrums call', 'save rhythm'],
      zh: ['複製', '剪貼簿', '複製程式碼', '存下節奏'],
    },
  },

  'OAVp5.drums.history': {
    group: 'drums',
    summary: {
      en: 'The earlier lines of rhythm, oldest first: every click on a cell, typed line or menu pick leaves the line before it here.',
      zh: '之前播過的節奏，最舊的在最前面：每點一次格子、每改一次文字、每從選單挑一次，前一行就會存到這裡。',
    },
    value: {
      type: 'Array<String>',
      en: 'Empty at the start, and at most 50 lines long. The line that plays now is not in it: that is [`OAVp5.drums.src`](#OAVp5.drums.src).',
      zh: '一開始是空的，最多保留 50 行。現在在播的那一行不在裡面，那一行是 [`OAVp5.drums.src`](#OAVp5.drums.src)。',
    },
    description: [
      {
        en: '[`OAVp5.drums.undo()`](#OAVp5.drums.undo) takes the last line off this list and plays it. Changes made by [`startDrums()`](#startDrums) are not recorded here, only the ones made on the card or with [`OAVp5.drums.edit()`](#OAVp5.drums.edit). The array is the machine\'s own, so treat it as read-only.',
        zh: '[`OAVp5.drums.undo()`](#OAVp5.drums.undo) 會把這份清單最後一行拿出來播。用 [`startDrums()`](#startDrums) 做的改變不會記在這裡，只有在卡片上做的，或用 [`OAVp5.drums.edit()`](#OAVp5.drums.edit) 做的才會。這個陣列是鼓機自己的，請當成唯讀。',
      },
    ],
    examples: [
      {
        code: `const LINES = ['bd*4, hh*8', 'bd(3,8), hh*8', 'bd ~ ~ bd, [~ sd]*2, hh*16'];
let n = 0;

function setup() {
  createCanvas(400, 300);
  startDrums(LINES[0], 110);
  textSize(14);
}

function mousePressed() {
  n = (n + 1) % LINES.length;
  OAVp5.drums.edit(LINES[n]);
}

function draw() {
  background(20);
  fill(255);
  text('click to edit the line', 20, 30);
  text('history: ' + OAVp5.drums.history.length + ' earlier lines', 20, 60);
  text(OAVp5.drums.history.join('\\n'), 20, 90);
}`,
        caption: { en: 'Each click edits the line and adds the one before it to the history list.', zh: '每點一下就改一次那一行，前一行會加進歷史清單。' },
      },
    ],
    related: ['OAVp5.drums.undo', 'OAVp5.drums.edit', 'OAVp5.drums.src', 'rhythmChanged'],
    keywords: {
      en: ['history', 'undo list', 'earlier rhythms', 'previous lines'],
      zh: ['歷史', '復原清單', '之前的節奏', '上一行'],
    },
    claims: [{ expr: 'OAVp5.drums.history.length', equals: 0 }],
  },

  'OAVp5.drums.undo': {
    group: 'drums',
    summary: {
      en: 'Goes back one line of rhythm, like ↶ on the card; returns `true` if there was an earlier line.',
      zh: '回到上一行節奏，跟卡片上的 ↶ 一樣，如果有上一行就回傳 `true`。',
    },
    params: [],
    returns: { type: 'Boolean', en: '`true` if it went back one line, `false` if [`OAVp5.drums.history`](#OAVp5.drums.history) was empty or the machine is not loaded.', zh: '回到上一行就是 `true`，[`OAVp5.drums.history`](#OAVp5.drums.history) 是空的、或鼓機還沒載入就是 `false`。' },
    description: [
      {
        en: 'The line before the current one is played again and removed from the history. [`rhythmChanged()`](#rhythmChanged) is called with `how` equal to `\'undo\'`. On the card the same thing is ⌘Z or Ctrl+Z after touching it.',
        zh: '上一行會再播一次，並從歷史清單裡拿掉。[`rhythmChanged()`](#rhythmChanged) 會被呼叫，`how` 是 `\'undo\'`。在卡片上，點一下卡片之後按 ⌘Z 或 Ctrl+Z 也是同樣的事。',
      },
    ],
    examples: [
      {
        code: `function setup() {
  createCanvas(400, 300);
  startDrums('bd*4, hh*8', 110);
  textAlign(CENTER, CENTER);
}

function mousePressed() {
  OAVp5.drums.edit('bd(3,8), hh*16');
}

function keyPressed() {
  if (key === 'z') OAVp5.drums.undo();
}

function draw() {
  background(20);
  fill(255);
  text(OAVp5.drums.src, width / 2, height / 2 - 10);
  text('click: change the line   z: undo', width / 2, height / 2 + 20);
}`,
        caption: { en: 'Click to change the line, press z to go back to the one before.', zh: '點一下換一行節奏，按 z 回到前一行。' },
      },
    ],
    related: ['OAVp5.drums.history', 'OAVp5.drums.edit', 'rhythmChanged'],
    keywords: {
      en: ['undo', 'back', 'revert', 'previous rhythm', 'drums'],
      zh: ['復原', '上一步', '回上一行', '鼓機'],
    },
  },

  'OAVp5.drums.edit': {
    group: 'drums',
    summary: {
      en: 'Plays a line of rhythm as if it was typed on the card, and returns whether it worked and, if not, what is wrong with it.',
      zh: '把一行節奏當成在卡片上打的字來播，並回傳有沒有成功，不成功的話告訴你哪裡有問題。',
    },
    params: [
      { name: 'text', type: 'String', en: 'The line of rhythm, for example `\'bd*4, [~ sd]*2, hh*8\'`, or a line copied from strudel.cc.', zh: '一行節奏，例如 `\'bd*4, [~ sd]*2, hh*8\'`，或是從 strudel.cc 複製來的程式。' },
    ],
    returns: {
      type: 'Object',
      en: '`{ ok: true, error: null, text }` when the line plays. `{ ok: false, error, text }` when it has a mistake: `error` has `code`, `index` and `length` (where the bad word is in `text`), a `message` and a `hint`, and the last line that worked keeps playing. Before the machine has loaded: `{ ok: false, error: null }`.',
      zh: '這行節奏播起來了就回傳 `{ ok: true, error: null, text }`。有錯的話回傳 `{ ok: false, error, text }`：`error` 裡有 `code`、`index` 和 `length`（錯的那個字在 `text` 的位置）、`message` 和 `hint`，這時上一行能播的節奏繼續播。鼓機還沒載入的時候回傳 `{ ok: false, error: null }`。',
    },
    description: [
      {
        en: 'Unlike [`startDrums(text)`](#startDrums), which plays \'four on floor\' when the line has a mistake, `edit()` keeps the line that was playing and tells you why the new one failed, so a live-coding sketch can show the message. The line goes into [`OAVp5.drums.history`](#OAVp5.drums.history) and [`rhythmChanged()`](#rhythmChanged) is called with `how` equal to `\'type\'`. A mistake also shows the card that points at the character.',
        zh: '跟 [`startDrums(text)`](#startDrums) 不同：那一行有錯的時候，`startDrums` 會改播 \'four on floor\'，而 `edit()` 會讓原本那一行繼續播，並告訴你新的為什麼失敗，所以即時編碼的草圖可以把訊息顯示出來。這一行會進到 [`OAVp5.drums.history`](#OAVp5.drums.history)，[`rhythmChanged()`](#rhythmChanged) 也會被呼叫，`how` 是 `\'type\'`。有錯的時候也會跳出卡片，指出是哪個字。',
      },
    ],
    needs: {
      en: 'The machine and the rhythm module must have loaded: call [`startDrums()`](#startDrums) first and give it a moment.',
      zh: '鼓機和節奏模組必須已經載入完成：先呼叫 [`startDrums()`](#startDrums)，再等一下。',
    },
    examples: [
      {
        code: `const TRIES = ['bd*4, hh*8', 'bd(3,8), [~ sd]*2', 'bd*4, xyz*8'];
let n = 0;
let result = '';

function setup() {
  createCanvas(400, 300);
  startDrums('bd*4, [~ sd]*2, hh*8', 110);
  textAlign(CENTER, CENTER);
}

function mousePressed() {
  const r = OAVp5.drums.edit(TRIES[n % TRIES.length]);
  result = r.ok ? 'ok: ' + r.text : 'wrong: ' + r.error.message;
  n++;
}

function draw() {
  background(20);
  fill(255);
  text('click to try the next line', width / 2, 40);
  text(result, width / 2, height / 2 - 10);
  text('playing: ' + OAVp5.drums.src, width / 2, height / 2 + 30);
}`,
        caption: { en: 'Click three times: the first two lines play; the third has a mistake, so the message is shown and the line before it keeps playing.', zh: '連點三下：前兩行會播，第三行有錯，所以顯示錯誤訊息，並讓前一行繼續播。' },
      },
    ],
    related: ['startDrums', 'OAVp5.drums.undo', 'OAVp5.drums.history', 'rhythmChanged', 'OAVp5.drums.src'],
    keywords: {
      en: ['edit', 'type a line', 'live coding', 'change rhythm', 'error message', 'mistake', 'drums'],
      zh: ['編輯', '改節奏', '即時編碼', '錯誤訊息', '打字', '鼓機'],
    },
  },

  'OAVp5.drums.on': {
    group: 'drums',
    summary: {
      en: 'Listens to the drum machine from anywhere: `OAVp5.drums.on(\'hit\', fn)` calls `fn` like `drumHit` does, and returns a function that stops listening.',
      zh: '在任何地方監聽鼓機：`OAVp5.drums.on(\'hit\', fn)` 會像 `drumHit` 一樣呼叫 `fn`，並回傳一個可以取消監聽的函式。',
    },
    params: [
      { name: 'name', type: 'String', en: 'What to listen to: `\'hit\'` (like [`drumHit()`](#drumHit)), `\'step\'` (like [`stepStarted()`](#stepStarted)), `\'bar\'` (like [`barStarted()`](#barStarted)), `\'cue\'` (like [`cueFired()`](#cueFired)) or `\'rhythm\'` (like [`rhythmChanged()`](#rhythmChanged)). Any other name throws an error that lists them.', zh: '要監聽什麼：`\'hit\'`（像 [`drumHit()`](#drumHit)）、`\'step\'`（像 [`stepStarted()`](#stepStarted)）、`\'bar\'`（像 [`barStarted()`](#barStarted)）、`\'cue\'`（像 [`cueFired()`](#cueFired)）、`\'rhythm\'`（像 [`rhythmChanged()`](#rhythmChanged)）。其他的名字會丟出錯誤，並列出這幾個。' },
      { name: 'fn', type: 'Function', en: 'Called with the same arguments as the function it matches: `(lane, velocity)`, `(step, bar)`, `(bar)`, `(name, bar)` or `(src, how)`.', zh: '被呼叫的時候帶的參數跟對應的函式一樣：`(lane, velocity)`、`(step, bar)`、`(bar)`、`(name, bar)` 或 `(src, how)`。' },
    ],
    returns: { type: 'Function', en: 'A function: call it to stop listening.', zh: '一個函式，呼叫它就停止監聽。' },
    description: [
      {
        en: 'The functions you define (`drumHit`, `barStarted` …) are one listener each. `on()` is for the cases where that does not fit: several listeners for one event, a library or a Hydra sketch that has no `drumHit()` of its own, a listener you want to remove again. It is the same idea as `midi.on()`. An error thrown inside `fn` is printed and the other listeners still run.',
        zh: '你定義的函式（`drumHit`、`barStarted` ……）每種事件只能有一個。`on()` 是給不適用的情況：同一個事件要有好幾個監聽者、函式庫或 Hydra 草圖沒有自己的 `drumHit()`、或是想把監聽者再拿掉。概念跟 `midi.on()` 一樣。`fn` 裡丟出的錯誤會被印出來，其他監聽者照樣執行。',
      },
    ],
    examples: [
      {
        code: `let bars = 0;
let off = null;

function setup() {
  createCanvas(400, 300);
  startDrums('four on floor', 160);
  off = OAVp5.drums.on('bar', (bar) => { bars++; });   // returns a function that stops it
  textAlign(CENTER, CENTER);
}

function mousePressed() {
  if (off) { off(); off = null; }   // stop counting
}

function draw() {
  background(20);
  fill(255);
  text('bars counted: ' + bars, width / 2, height / 2);
  text(off ? 'click to stop counting' : 'stopped', width / 2, height / 2 + 30);
}`,
        caption: { en: 'A counter that goes up once per bar; a click removes the listener and the number stops.', zh: '一個每小節加一的計數器，點一下就拿掉監聽者，數字就停住。' },
      },
    ],
    related: ['drumHit', 'stepStarted', 'barStarted', 'cueFired', 'rhythmChanged', 'OAVp5.drums'],
    keywords: {
      en: ['listen', 'subscribe', 'event', 'listener', 'on', 'hydra', 'drums', 'off'],
      zh: ['監聽', '訂閱', '事件', '聽事件', '取消監聽', '鼓機'],
    },
    claims: [{ expr: 'typeof OAVp5.drums.on(\'bar\', function () {})', equals: 'function' }],
  },

  'OAVp5.drums.now': {
    group: 'drums',
    summary: {
      en: 'A snapshot of what the machine hears right now: the bar, the step, both phases and which words of the line are lit.',
      zh: '鼓機此刻聽到的樣子，一次拿齊：小節、格、兩個相位，以及那一行字裡哪些字亮著。',
    },
    value: {
      type: 'Object', range: '{ bar, step, phase, beatPhase, tokens, mode, text }',
      en: 'A new object on every read. `phase` and `beatPhase` are [`drumPhase`](#drumPhase) and [`beatPhase`](#beatPhase). `tokens` is a list of `{ start, end }`: the places in `text` of the words that sound now. `mode` is `\'string\'` for a line of rhythm and `\'grid\'` for a preset or a grid you drew. `text` is the line.',
      zh: '每次讀都是一個新的物件。`phase` 和 `beatPhase` 就是 [`drumPhase`](#drumPhase) 和 [`beatPhase`](#beatPhase)。`tokens` 是 `{ start, end }` 的清單，標出 `text` 裡現在正在響的那幾個字的位置。`mode` 在播一行節奏時是 `\'string\'`，預設節奏或你自己畫的格子是 `\'grid\'`。`text` 是那一行字。',
    },
    description: [
      {
        en: 'It is what the card uses to light the word that sounds. Read it when you want the line and its lit words in one go, for example to draw the line on the canvas with the sounding word marked. Before the machine has loaded it answers with zeros and an empty `text`.',
        zh: '卡片就是用它讓正在響的字亮起來。想一次拿到那一行字和亮著的字的時候讀它，例如把那一行字畫在畫布上，並標出正在響的字。鼓機載入之前，它給的是零和空的 `text`。',
      },
    ],
    examples: [
      {
        code: `function setup() {
  createCanvas(400, 300);
  startDrums('bd*4, [~ sd]*2, hh*8', 80);
  textFont('monospace');
  textSize(18);
  noStroke();
}

function draw() {
  background(20);
  const n = OAVp5.drums.now;
  fill(255, 211, 107);
  for (const t of n.tokens) {
    rect(20 + textWidth(n.text.slice(0, t.start)), 150, textWidth(n.text.slice(t.start, t.end)), 3);   // underline the sounding words
  }
  fill(255);
  text(n.text, 20, 140);
}`,
        caption: { en: 'The line of rhythm with a yellow underline that follows the words as they sound.', zh: '那一行節奏，下面有一條黃色底線，跟著正在響的字移動。' },
      },
    ],
    related: ['OAVp5.drums.src', 'drumPhase', 'beatPhase', 'drumStep', 'drumBar'],
    keywords: {
      en: ['now', 'snapshot', 'current state', 'tokens', 'lit words', 'highlight', 'drums'],
      zh: ['現在', '快照', '目前狀態', '亮著的字', '標示', '鼓機'],
    },
  },

  'OAVp5.drums.clock': {
    group: 'oavp5',
    summary: {
      en: 'How the drum machine keeps time: which clock moves it, how far ahead it schedules and how long the callbacks wait for the speakers.',
      zh: '鼓機怎麼計時：用哪一種時鐘推動、提前排程多久，以及 callback 為了等喇叭而延後多久。',
    },
    value: {
      type: 'Object', range: '{ clock, heartbeat, lookahead, latency, audio, extended, preDraw, … }',
      en: 'A new object on every read. `clock` is `\'lookahead\'` (hits are handed to the audio clock ahead of time, the default) or `\'frame\'` (moved by the frames, the [`drums`](#option-drums) option). `heartbeat` is `\'worker\'` (a Web Worker wakes it every 25 ms), `\'interval\'` (the fallback), `\'frame\'` with the frame clock, or `\'none\'` before the machine exists. `lookahead` is the seconds scheduled ahead and `extended` is true when a slow `draw()` made it look further ahead. `latency` is the seconds the callbacks wait for the output of the speakers, `audio` whether the kit\'s audio clock is running, and `preDraw` the p5 hook that delivers the callbacks right before `draw()`.',
      zh: '每次讀都是一個新的物件。`clock` 是 `\'lookahead\'`（打擊事先交給音訊時鐘排好，預設）或 `\'frame\'`（跟著畫面走，載入選項 [`drums`](#option-drums)）。`heartbeat` 是 `\'worker\'`（Web Worker 每 25 毫秒叫醒它）、`\'interval\'`（備用的做法）、用畫面時鐘的時候是 `\'frame\'`，鼓機還沒有的時候是 `\'none\'`。`lookahead` 是提前排程的秒數，`extended` 為 true 表示 `draw()` 太慢，讓它看得更遠。`latency` 是 callback 為了等喇叭輸出而延後的秒數，`audio` 是鼓組的音訊時鐘有沒有在跑，`preDraw` 是在 `draw()` 前面送 callback 的 p5 掛鉤。',
    },
    description: [
      {
        en: 'This is the diagnostic behind the 🩺 check-up. When drum hits feel late or early, look here first: the handbook puts a Bluetooth speaker at 0.15 to 0.25 seconds of `latency`, and [`?oav_drumlatency=200`](#option-drumlatency) sets it by hand. `late`, `skipped`, `warning` and `why` are further notes the check-up reads.',
        zh: '這是 🩺 檢查報告背後的診斷資料。打擊感覺太晚或太早的時候，先看這裡：說明文件寫藍牙喇叭的 `latency` 大約是 0.15 到 0.25 秒，[`?oav_drumlatency=200`](#option-drumlatency) 可以手動設定。`late`、`skipped`、`warning`、`why` 是檢查報告會讀的其他備註。',
      },
    ],
    tbd: [
      {
        en: 'What exactly `late`, `skipped`, `warning` and `why` count was not checked.',
        zh: '`late`、`skipped`、`warning`、`why` 各自精確計的是什麼，還沒有查證。',
      },
    ],
    examples: [
      {
        code: `function setup() {
  createCanvas(400, 300);
  startDrums('four on floor', 120);
  textSize(14);
}

function draw() {
  background(20);
  fill(255);
  const c = OAVp5.drums.clock;
  text('clock: ' + c.clock + ' (' + c.heartbeat + ')', 20, 30);
  text('lookahead: ' + c.lookahead + ' s', 20, 60);
  text('latency: ' + c.latency + ' s', 20, 90);
  text('hook before draw: ' + (c.preDraw || 'none'), 20, 120);
}`,
        caption: { en: 'The clock settings of the machine while it plays.', zh: '鼓機播放時的時鐘設定。' },
      },
    ],
    related: ['OAVp5.drums', 'startDrums', 'drumPhase'],
    keywords: {
      en: ['clock', 'latency', 'lookahead', 'timing', 'late', 'delay', 'heartbeat', 'diagnostic', 'check-up'],
      zh: ['時鐘', '延遲', '提前排程', '時間準不準', '診斷', '檢查報告'],
    },
  },

  'OAVp5.drums.machine': {
    group: 'oavp5',
    summary: {
      en: 'The drum machine from @openav/drums that the grid on the page belongs to, or `null` before it has loaded.',
      zh: '頁面上那個鼓機格子背後的 @openav/drums 鼓機，還沒載入的時候是 `null`。',
    },
    value: {
      type: 'Object | null',
      en: 'Set once, when [`startDrums()`](#startDrums) has loaded the machine. `null` before that and after a failed load.',
      zh: '[`startDrums()`](#startDrums) 把鼓機載入之後設定一次。在那之前，或載入失敗之後，都是 `null`。',
    },
    description: [
      {
        en: 'It is what `mountDrums()` of [@openav/drums](#mountDrums) returns, with `seq` (the sequencer), `engine` (the kit), `play(on)`, `setPattern(p)`, `setBpm(bpm)`, `phase()`, `now()`, `info()` and the rhythm functions. `OAVp5.drums.machine.play(false)` stops the sound and the counting but leaves the grid up: [`OAVp5.drums.state`](#OAVp5.drums.state) then says `\'stopped\'`. It is an advanced handle; the names on this page cover what a sketch normally needs.',
        zh: '就是 [@openav/drums](#mountDrums) 的 `mountDrums()` 回傳的東西，有 `seq`（序列器）、`engine`（鼓組）、`play(on)`、`setPattern(p)`、`setBpm(bpm)`、`phase()`、`now()`、`info()` 和節奏相關的函式。`OAVp5.drums.machine.play(false)` 會讓鼓機停止發聲和計數，但格子還留在畫面上：[`OAVp5.drums.state`](#OAVp5.drums.state) 這時是 `\'stopped\'`。它是進階的把手，這一頁的名稱已經涵蓋草圖平常需要的一切。',
      },
    ],
    needs: {
      en: 'It is `null` until [`startDrums()`](#startDrums) (or 🥁) has loaded the machine. Check for `null` before you use it.',
      zh: '在 [`startDrums()`](#startDrums)（或 🥁）把鼓機載入之前都是 `null`，使用之前先檢查。',
    },
    examples: [
      {
        code: `function setup() {
  createCanvas(400, 300);
  startDrums('four on floor', 120);
  textAlign(CENTER, CENTER);
}

function mousePressed() {
  const m = OAVp5.drums.machine;
  if (m) m.play(!m.seq.playing);   // pause and resume, the grid stays
}

function draw() {
  background(OAVp5.drums.state === 'stopped' ? 80 : 20);
  fill(255);
  text('click to pause or resume (' + OAVp5.drums.state + ')', width / 2, height / 2);
}`,
        caption: { en: 'A click pauses the machine and the grid stays on the page; the state reads "stopped" until the next click.', zh: '點一下讓鼓機暫停，格子還留在頁面上，狀態會顯示 "stopped"，再點一下就繼續。' },
      },
    ],
    related: ['OAVp5.drums', 'OAVp5.drums.state', 'startDrums'],
    keywords: {
      en: ['machine', 'mountDrums', 'sequencer', 'engine', 'advanced', 'drums handle'],
      zh: ['鼓機', '序列器', '引擎', '進階', '把手'],
    },
    claims: [{ expr: 'OAVp5.drums.machine', equals: 'null' }],
  },

  drumStep: {
    group: 'timeline',
    aliases: ['OAVp5.drums.step'],
    summary: {
      en: 'Which of the 16 steps of the bar the drum machine just played, from 0 to 15.',
      zh: '鼓機剛剛播到這一小節 16 格裡的第幾格，從 0 到 15。',
    },
    value: {
      type: 'Number', range: '0..15',
      en: 'Changes in the frame in which a step is heard, right before `draw()`. 0 at the start, and it keeps its last value when the machine stops.',
      zh: '在你聽到那一格的那個畫面、`draw()` 之前改變。一開始是 0，鼓機停止之後停在最後的值。',
    },
    description: [
      {
        en: 'A bar has 16 steps (sixteenth notes) and a beat has 4, so `drumStep % 4 === 0` is a beat and `drumStep === 0` the start of a bar. At 120 bpm a step lasts 125 ms. Use it to light a cell or pick a frame: `fill(i === drumStep ? 255 : 80)`. If you would rather be called on each step, define [`stepStarted()`](#stepStarted). For something that moves smoothly instead of in 16 jumps, use [`drumPhase`](#drumPhase).',
        zh: '一小節有 16 格（十六分音符），一拍有 4 格，所以 `drumStep % 4 === 0` 就是正拍，`drumStep === 0` 是小節的開頭。速度 120 的時候一格是 125 毫秒。可以用它讓某一格亮起來或挑選畫面：`fill(i === drumStep ? 255 : 80)`。如果你比較想在每一格被呼叫，就定義 [`stepStarted()`](#stepStarted)。想要平滑移動，不要 16 次跳動的話，用 [`drumPhase`](#drumPhase)。',
      },
    ],
    needs: {
      en: 'Start the machine with [`startDrums()`](#startDrums). Before that, and when the machine is stopped, the value is 0 or the last one, so check [`drumsAreOn`](#drumsAreOn) if the difference matters.',
      zh: '先用 [`startDrums()`](#startDrums) 啟動鼓機。在那之前、以及鼓機停止之後，值是 0 或最後的值，這個差別重要的話，要檢查 [`drumsAreOn`](#drumsAreOn)。',
    },
    notes: [
      {
        en: 'A sketch that declares its own variable called `drumStep` keeps it: oav-p5 leaves the name alone and a card says to read `OAVp5.drums.step` instead. While the tab is hidden the clock keeps counting but nothing else is told.',
        zh: '如果草圖本來就宣告了自己的 `drumStep` 變數，就用你的：oav-p5 不動這個名稱，並用一張卡片提醒你改讀 `OAVp5.drums.step`。分頁被藏起來的時候，時鐘照樣在數，但不會通知任何事件。',
      },
    ],
    examples: [
      {
        code: `function setup() {
  createCanvas(400, 300);
  startDrums('four on floor', 120);
  noStroke();
}

function draw() {
  background(20);
  for (let i = 0; i < 16; i++) {
    fill(drumsAreOn && i === drumStep ? 255 : 70);
    rect(20 + i * 22, 130, 18, 40);   // sixteen cells, the current one lights up
  }
}`,
        caption: { en: 'Sixteen cells in a row with the current step lit, one cell at a time, from left to right.', zh: '一排十六個格子，現在的那一格亮著，從左到右一格一格走。' },
      },
      {
        code: `function setup() {
  createCanvas(400, 300);
  startDrums('breakbeat', 110);
  textAlign(CENTER, CENTER);
  textSize(18);
}

function draw() {
  background(drumStep % 4 === 0 ? 70 : 20);   // a flash on every beat
  fill(255);
  text('step ' + drumStep + ' of 16' + (drumStep === 0 ? '  (bar starts)' : ''), width / 2, height / 2);
}`,
        caption: { en: 'The background lights up on every beat (steps 0, 4, 8, 12) and the text counts the steps.', zh: '每一拍（第 0、4、8、12 格）背景亮一下，文字數著現在是第幾格。' },
      },
    ],
    related: ['stepStarted', 'drumBar', 'drumPhase', 'beatPhase', 'drumsAreOn', 'startDrums'],
    keywords: {
      en: ['step', 'drum step', 'sixteenth', '16 steps', 'sequencer step', 'current step', 'counter', 'beat'],
      zh: ['格', '第幾格', '十六分音符', '16 格', '目前這一格', '計數', '鼓機'],
    },
    claims: [
      { expr: 'drumStep', equals: 0 },
      { before: 'startDrums(\'four on floor\', 120)', expr: 'drumStep', min: 0, max: 15, moves: true },
    ],
  },

  drumBar: {
    group: 'timeline',
    aliases: ['OAVp5.drums.bar'],
    summary: {
      en: 'Which bar the drum machine is in, counted from 1 when it started.',
      zh: '鼓機現在在第幾小節，從啟動的時候起算，第一小節是 1。',
    },
    value: {
      type: 'Number', range: '0, 1, 2, 3 …',
      en: '0 before the machine has played its first step, then 1, 2, 3 … with no upper limit. It keeps its last value when the machine stops.',
      zh: '鼓機播第一格之前是 0，之後是 1、2、3 ……，沒有上限。鼓機停止之後停在最後的值。',
    },
    description: [
      {
        en: 'A bar is 16 steps, four beats. Use it to give a piece a shape: `floor((drumBar - 1) / 4) % 3` is the section number when you change every four bars. To make something happen at an exact bar, [`cue()`](#cue) is neater than testing `drumBar` in `draw()`. [`barStarted()`](#barStarted) is the function that is called at the start of each bar.',
        zh: '一小節是 16 格、四拍。用它替作品安排結構：每四小節換一段的話，`floor((drumBar - 1) / 4) % 3` 就是現在是第幾段。要讓某件事剛好發生在某一小節，[`cue()`](#cue) 比在 `draw()` 裡判斷 `drumBar` 更簡潔。[`barStarted()`](#barStarted) 則是每小節開頭會被呼叫的函式。',
      },
    ],
    needs: {
      en: 'Start the machine with [`startDrums()`](#startDrums). Stopping and starting again counts from bar 1 again.',
      zh: '先用 [`startDrums()`](#startDrums) 啟動鼓機。停止之後再啟動，會從第 1 小節重新算起。',
    },
    notes: [
      {
        en: 'A sketch that declares its own variable called `drumBar` keeps it: oav-p5 leaves the name alone and a card says to read `OAVp5.drums.bar` instead.',
        zh: '如果草圖本來就宣告了自己的 `drumBar` 變數，就用你的：oav-p5 不動這個名稱，並用一張卡片提醒你改讀 `OAVp5.drums.bar`。',
      },
    ],
    examples: [
      {
        code: `function setup() {
  createCanvas(400, 300);
  startDrums('four on floor', 150);
  textAlign(CENTER, CENTER);
  textSize(64);
}

function draw() {
  background(20);
  fill(255);
  text(drumBar, width / 2, height / 2);
}`,
        caption: { en: 'A big number that goes up by one at the start of every bar.', zh: '一個大數字，每一小節開頭加一。' },
      },
      {
        code: `const SECTIONS = ['#3b5bdb', '#e8590c', '#2f9e44'];

function setup() {
  createCanvas(400, 300);
  startDrums('breakbeat', 160);
  noStroke();
}

function draw() {
  const section = floor((max(drumBar, 1) - 1) / 2) % SECTIONS.length;   // a new section every 2 bars
  background(SECTIONS[section]);
  fill(255);
  text('bar ' + drumBar + ', section ' + (section + 1), 20, 30);
}`,
        caption: { en: 'The background changes colour every two bars and the text names the bar and the section.', zh: '背景每兩小節換一個顏色，文字說明現在是第幾小節、第幾段。' },
      },
    ],
    related: ['barStarted', 'drumStep', 'cue', 'OAVp5.drums.count', 'startDrums'],
    keywords: {
      en: ['bar', 'measure', 'bar number', 'section', 'count bars', 'timeline', 'drums'],
      zh: ['小節', '第幾小節', '段落', '計數小節', '時間軸', '鼓機'],
    },
    claims: [
      { expr: 'drumBar', equals: 0 },
      { before: 'startDrums(\'four on floor\', 300)', expr: 'drumBar', min: 0, moves: true },
    ],
  },

  'OAVp5.drums.count': {
    group: 'timeline',
    summary: {
      en: 'How many steps the drum machine has played since it started, from 0; -1 before the first one.',
      zh: '鼓機從啟動到現在一共播了幾格，從 0 開始算，第一格之前是 -1。',
    },
    value: {
      type: 'Number', range: '-1, 0, 1, 2 …',
      en: 'Goes up by one at every step and never goes back to 0 at a new bar. It starts again from 0 when the machine is started again.',
      zh: '每一格加一，到了新的小節也不會歸零。機器重新啟動的時候，才會從 0 重新算。',
    },
    description: [
      {
        en: 'It is the single clock the others are cut from: `drumBar` is `floor(count / 16) + 1`, `drumStep` is `count % 16`, and [`cue()`](#cue) fires when `count` reaches the step of its bar. It is handy when you want one number that only grows: a position on a very long timeline, or an index into a list.',
        zh: '其他的數字都是從它切出來的：`drumBar` 是 `floor(count / 16) + 1`，`drumStep` 是 `count % 16`，[`cue()`](#cue) 是在 `count` 走到它那一小節的位置時發動。想要一個只會一直變大的數字的時候很好用，例如很長的時間軸上的位置，或是清單的索引。',
      },
    ],
    needs: {
      en: 'Start the machine with [`startDrums()`](#startDrums); it is -1 until the first step has played.',
      zh: '先用 [`startDrums()`](#startDrums) 啟動鼓機，第一格播出來之前都是 -1。',
    },
    examples: [
      {
        code: `function setup() {
  createCanvas(400, 300);
  startDrums('half time', 140);
  textAlign(CENTER, CENTER);
  textSize(28);
}

function draw() {
  background(20);
  fill(255);
  const n = OAVp5.drums.count;
  text('step ' + n + '  =  bar ' + (floor(n / 16) + 1) + ', step ' + (n % 16), width / 2, height / 2);
}`,
        caption: { en: 'The running step count and the bar and step it is made of.', zh: '一路累加的格數，以及它換算成的小節和格。' },
      },
    ],
    related: ['drumBar', 'drumStep', 'cue', 'startDrums'],
    keywords: {
      en: ['count', 'step count', 'running count', 'total steps', 'ticks', 'timeline position'],
      zh: ['計數', '累計格數', '總格數', '時間軸位置'],
    },
    claims: [{ expr: 'OAVp5.drums.count', equals: -1 }],
  },

  cue: {
    group: 'timeline',
    summary: {
      en: 'Plans something for a bar: at bar `bar` the function `cueFired(name, bar)` is called and `cueName` becomes `name`; with `every`, again every that many bars.',
      zh: '替某一小節安排事情：到了第 `bar` 小節，就呼叫 `cueFired(name, bar)`，`cueName` 變成 `name`，給了 `every`，之後每隔那麼多小節再來一次。',
    },
    params: [
      { name: 'bar', type: 'Number', en: 'The bar, counted from 1 (the first bar). A fraction is a place inside a bar: 4.5 is halfway through bar 4 (the nearest of the 16 steps is used). A value below 1, or one that is not a number, prints a warning in the console and adds nothing.', zh: '第幾小節，第一小節是 1。小數表示小節裡的位置：4.5 是第 4 小節的一半（會取最接近的那一格，共 16 格）。小於 1 或不是數字的值，會在主控台印一個警告，什麼都不會加。' },
      { name: 'name', type: 'Any', en: 'What to call it, usually a string. It is passed to [`cueFired()`](#cueFired) and becomes [`cueName`](#cueName).', zh: '給它取的名字，通常是字串。會傳給 [`cueFired()`](#cueFired)，並成為 [`cueName`](#cueName)。' },
      { name: 'every', type: 'Number', optional: true, default: '0', en: 'Repeat every this many bars after the first time (fractions work, at least one step). 0 or left out: only once.', zh: '第一次之後，每隔這麼多小節再來一次（小數可以，至少一格）。0 或不傳：只發動一次。' },
    ],
    returns: { type: 'undefined', en: 'Nothing. [`OAVp5.drums.cue()`](#OAVp5.drums.cue) is the same function and returns the cue it made.', zh: '沒有回傳值。[`OAVp5.drums.cue()`](#OAVp5.drums.cue) 是同一個函式，它會回傳建立出來的 cue。' },
    description: [
      {
        en: 'The drum machine counts the bars, so it can run a plan: `cue(1, \'calm\', 12); cue(5, \'bloom\', 12); cue(9, \'storm\', 12);` in `setup()` makes three scenes that come round every 12 bars. When a cue is due, [`cueFired(name, bar)`](#cueFired) is called and [`cueName`](#cueName) holds the name; read it in `draw()` if you prefer that to a callback. Several cues on one step fire in the order you declared them, before [`barStarted()`](#barStarted), [`stepStarted()`](#stepStarted) and the hits of that step.',
        zh: '鼓機會數小節，所以可以照著計畫走：在 `setup()` 裡寫 `cue(1, \'calm\', 12); cue(5, \'bloom\', 12); cue(9, \'storm\', 12);`，就是三個場景，每 12 小節輪一圈。cue 到的時候會呼叫 [`cueFired(name, bar)`](#cueFired)，[`cueName`](#cueName) 裡也會是它的名字，不想用 callback 的話，在 `draw()` 裡讀它就好。同一格有好幾個 cue 的時候，會依你宣告的順序發動，並且在 [`barStarted()`](#barStarted)、[`stepStarted()`](#stepStarted) 和那一格的打擊之前。',
      },
      {
        en: 'Calling `cue()` twice with the same values adds nothing, so it is safe in `draw()` too. Counting starts with [`startDrums()`](#startDrums), and a cue only fires when the machine passes its place: declare the cues right after `startDrums()` in `setup()` so that a cue at bar 1 is not missed. After the machine is stopped and started again, the cues fire again from bar 1.',
        zh: '用同樣的值呼叫兩次 `cue()` 不會重複加，所以放在 `draw()` 裡也安全。計數從 [`startDrums()`](#startDrums) 開始，cue 只在鼓機走過它的位置時才發動：請在 `setup()` 裡緊接著 `startDrums()` 宣告，第 1 小節的 cue 才不會漏掉。鼓機停止再啟動之後，cue 會從第 1 小節重新發動。',
      },
    ],
    notes: [
      {
        en: 'A cue declared after its bar has passed fires at its next repeat if it has an `every`, otherwise never until the machine is started again. Without a running machine no cue fires at all.',
        zh: '如果 cue 是在它的那一小節已經過了之後才宣告的，有 `every` 就會在下一次重複時發動，沒有的話，要等到鼓機重新啟動才會發動。鼓機沒在跑的時候，任何 cue 都不會發動。',
      },
    ],
    examples: [
      {
        code: `let scene = 'calm';

function setup() {
  createCanvas(400, 300);
  startDrums('four on floor', 140);
  cue(1, 'calm', 4);    // bars 1, 5, 9 ...
  cue(3, 'storm', 4);   // bars 3, 7, 11 ...
  textAlign(CENTER, CENTER);
  textSize(32);
}

function cueFired(name, bar) {
  scene = name;
}

function draw() {
  background(scene === 'storm' ? color(130, 30, 40) : color(20, 40, 100));
  fill(255);
  text(scene + ' (bar ' + drumBar + ')', width / 2, height / 2);
}`,
        caption: { en: 'The picture swaps between "calm" (blue) and "storm" (red) every two bars, and the text names the scene and the bar.', zh: '畫面每兩小節在 "calm"（藍色）和 "storm"（紅色）之間切換，文字說明現在的場景和小節。' },
      },
      {
        code: `let flash = 0;

function setup() {
  createCanvas(400, 300);
  startDrums('breakbeat', 130);
  cue(2.5, 'flash', 2);   // halfway through bar 2, then every 2 bars
  textAlign(CENTER, CENTER);
}

function cueFired(name, bar) {
  if (name === 'flash') flash = 1;
}

function draw() {
  flash *= 0.92;
  background(20 + flash * 200);
  fill(255 - flash * 255);
  text('a flash halfway through every second bar (bar ' + drumBar + ')', width / 2, height / 2);
}`,
        caption: { en: 'The screen flashes in the middle of bar 2 and again in the middle of every second bar after it.', zh: '畫面在第 2 小節的中間閃一下，之後每隔一小節的中間又閃一次。' },
      },
      {
        code: `function setup() {
  createCanvas(400, 300);
  startDrums('latin', 120);
  textAlign(CENTER, CENTER);
  textSize(28);
}

function draw() {
  cue(2, 'drop', 4);   // the same call every frame adds nothing
  background(20);
  fill(255);
  text(cueName === '' ? 'waiting for the first cue' : 'last cue: ' + cueName, width / 2, height / 2);
}`,
        caption: { en: 'cue() inside draw() is safe: the text changes to "last cue: drop" at bar 2 and stays that way.', zh: '在 draw() 裡呼叫 cue() 也沒問題：到了第 2 小節，文字變成 "last cue: drop" 就一直是這樣。' },
      },
    ],
    related: ['cueFired', 'cueName', 'barStarted', 'drumBar', 'startDrums', 'OAVp5.drums.cue'],
    keywords: {
      en: ['cue', 'schedule', 'timeline', 'scene', 'at bar', 'plan', 'automation', 'sections', 'repeat'],
      zh: ['cue', '時間軸', '場景', '排程', '第幾小節', '安排', '段落', '重複'],
    },
    claims: [
      { before: 'cue(1, \'a\'); cue(1, \'a\'); cue(3, \'b\', 4)', expr: 'OAVp5.drums.cues.length', equals: 2 },
      { before: 'cue(0, \'never\')', expr: 'OAVp5.drums.cues.length', equals: 0 },
    ],
  },

  'OAVp5.drums.cue': {
    group: 'timeline',
    summary: {
      en: 'The same as `cue(bar, name, every)`, but it returns the cue it made (or the one that was already there), and `null` when `bar` is not valid.',
      zh: '跟 `cue(bar, name, every)` 一樣，但會回傳建立出來的 cue（或原本就有的那個），`bar` 無效的時候回傳 `null`。',
    },
    params: [
      { name: 'bar', type: 'Number', en: 'The bar, counted from 1; 4.5 is halfway through bar 4. See [`cue()`](#cue).', zh: '第幾小節，從 1 算起，4.5 是第 4 小節的一半。見 [`cue()`](#cue)。' },
      { name: 'name', type: 'Any', en: 'What to call the cue.', zh: '這個 cue 的名字。' },
      { name: 'every', type: 'Number', optional: true, en: 'Repeat every this many bars; 0 or left out: once.', zh: '每隔幾小節再來一次，0 或不傳：只一次。' },
    ],
    returns: { type: 'Object | null', en: 'The cue: `{ bar, name, every, at, period, key }` with `at` and `period` counted in steps. `null` if `bar` is below 1 or not a number. A repeat of an earlier call gives back the cue that exists.', zh: '這個 cue：`{ bar, name, every, at, period, key }`，其中 `at` 和 `period` 以格為單位。`bar` 小於 1 或不是數字就是 `null`。重複前面呼叫過的，會回傳已經存在的那個 cue。' },
    description: [
      {
        en: 'Use it when you want to hold on to the cue, for example to find out which step it fires at. For a plain plan, [`cue()`](#cue) is shorter. The list of every cue is [`OAVp5.drums.cues`](#OAVp5.drums.cues).',
        zh: '想拿著這個 cue 的時候用它，例如想知道它在第幾格發動。只是安排計畫的話，[`cue()`](#cue) 比較短。所有 cue 的清單在 [`OAVp5.drums.cues`](#OAVp5.drums.cues)。',
      },
    ],
    examples: [
      {
        code: `let c = null;

function setup() {
  createCanvas(400, 300);
  startDrums('four on floor', 120);
  c = OAVp5.drums.cue(3.5, 'half', 4);
  textAlign(CENTER, CENTER);
}

function draw() {
  background(20);
  fill(255);
  text(c ? 'cue "' + c.name + '" at step ' + c.at + ', every ' + c.period + ' steps' : 'no cue', width / 2, height / 2);
}`,
        caption: { en: 'Bar 3.5 is step 40 of the count, and "every 4 bars" is 64 steps.', zh: '第 3.5 小節是累計的第 40 格，「每 4 小節」是 64 格。' },
      },
    ],
    related: ['cue', 'OAVp5.drums.cues', 'cueFired'],
    keywords: {
      en: ['cue', 'cue object', 'schedule', 'timeline', 'return value'],
      zh: ['cue', '回傳 cue', '時間軸', '排程'],
    },
    claims: [{ before: 'OAVp5.drums.cue(1, \'a\')', expr: 'OAVp5.drums.cues.length', equals: 1 }],
  },

  cueName: {
    group: 'timeline',
    aliases: ['OAVp5.drums.lastCue'],
    summary: {
      en: 'The name of the last cue that fired, or an empty string before the first one.',
      zh: '最近一個發動的 cue 的名字，第一個發動之前是空字串。',
    },
    value: {
      type: 'String', range: '\'\' or a cue name',
      en: 'Changes when a cue fires, and keeps the name until the next one. It is `\'\'` at the start.',
      zh: 'cue 發動的時候改變，之後一直是那個名字，直到下一個。一開始是 `\'\'`。',
    },
    description: [
      {
        en: 'Read it in `draw()` instead of waiting for [`cueFired()`](#cueFired): `look = SCENES[cueName];`. It is the name of the last cue only, so it is the right thing for "which scene am I in", and `cueFired()` is the right thing for "something just began". Cues are declared with [`cue()`](#cue).',
        zh: '可以在 `draw()` 裡直接讀，不用等 [`cueFired()`](#cueFired)：`look = SCENES[cueName];`。它只是最近一個 cue 的名字，所以回答「我現在在哪個場景」用它最適合，「某件事剛剛開始」則適合用 `cueFired()`。cue 用 [`cue()`](#cue) 宣告。',
      },
    ],
    notes: [
      {
        en: 'A sketch that declares its own variable called `cueName` keeps it: oav-p5 leaves the name alone and a card says to read `OAVp5.drums.lastCue` instead.',
        zh: '如果草圖本來就宣告了自己的 `cueName` 變數，就用你的：oav-p5 不動這個名稱，並用一張卡片提醒你改讀 `OAVp5.drums.lastCue`。',
      },
    ],
    examples: [
      {
        code: `const SCENES = { calm: '#3b5bdb', bloom: '#e64980', storm: '#495057' };

function setup() {
  createCanvas(400, 300);
  startDrums('breakbeat', 150);
  cue(1, 'calm', 6);
  cue(3, 'bloom', 6);
  cue(5, 'storm', 6);
  textAlign(CENTER, CENTER);
  textSize(32);
}

function draw() {
  background(SCENES[cueName] || '#111');   // nothing yet: dark
  fill(255);
  text(cueName, width / 2, height / 2);
}`,
        caption: { en: 'The background and the word follow the last cue: blue "calm", pink "bloom", grey "storm", every six bars.', zh: '背景和文字跟著最近一個 cue 走：藍色 "calm"、粉紅色 "bloom"、灰色 "storm"，每六小節輪一圈。' },
      },
    ],
    related: ['cue', 'cueFired', 'drumBar', 'startDrums'],
    keywords: {
      en: ['cue name', 'scene', 'current scene', 'last cue', 'section name'],
      zh: ['cue 名字', '場景', '目前場景', '最近的 cue', '段落名稱'],
    },
    claims: [{ expr: 'cueName', equals: '' }],
  },

  'OAVp5.drums.cues': {
    group: 'timeline',
    summary: {
      en: 'The list of every cue declared so far, in the order they were declared.',
      zh: '到目前為止宣告過的所有 cue，照宣告的順序排。',
    },
    value: {
      type: 'Array<Object>',
      en: 'Each item is `{ bar, name, every, at, period, key }`: the values you passed, and `at` and `period` counted in steps. An empty list at the start.',
      zh: '每一項是 `{ bar, name, every, at, period, key }`：你傳進去的值，以及以格為單位的 `at` 和 `period`。一開始是空的。',
    },
    description: [
      {
        en: 'Read it to show a plan on screen or to check what is declared. It is the machine\'s own list, so treat it as read-only; declare cues with [`cue()`](#cue).',
        zh: '想把計畫顯示在畫面上，或檢查宣告了哪些 cue 的時候讀它。它是鼓機自己的清單，請當成唯讀，要宣告 cue 請用 [`cue()`](#cue)。',
      },
    ],
    examples: [
      {
        code: `function setup() {
  createCanvas(400, 300);
  startDrums('four on floor', 120);
  cue(1, 'calm', 8);
  cue(5, 'storm', 8);
  textSize(14);
}

function draw() {
  background(20);
  fill(255);
  OAVp5.drums.cues.forEach((c, i) => {
    text('bar ' + c.bar + (c.every ? ' (every ' + c.every + ')' : '') + ': ' + c.name, 20, 30 + i * 24);
  });
}`,
        caption: { en: 'The plan as a list: one line per cue.', zh: '把計畫列成清單：每個 cue 一行。' },
      },
    ],
    related: ['cue', 'OAVp5.drums.cue', 'cueName'],
    keywords: {
      en: ['cues', 'cue list', 'plan', 'all cues', 'timeline'],
      zh: ['cue 清單', '所有 cue', '計畫', '時間軸'],
    },
    claims: [{ expr: 'OAVp5.drums.cues.length', equals: 0 }],
  },

  cueFired: {
    group: 'timeline',
    summary: {
      en: 'An event you define: it is called when the bar of a cue declared with `cue()` has come, with the cue\'s name and the bar.',
      zh: '一個由你定義的事件函式：用 `cue()` 宣告的 cue，到了它的那一小節就會呼叫它，帶著 cue 的名字和小節。',
    },
    params: [
      { name: 'name', type: 'Any', en: 'The name you gave to [`cue()`](#cue).', zh: '你給 [`cue()`](#cue) 的名字。' },
      { name: 'bar', type: 'Number', en: 'The bar the cue fired in, counted from 1. For a cue in the middle of a bar (4.5) it is the whole bar it falls in (4).', zh: 'cue 發動時所在的小節，從 1 算起。小節中間的 cue（4.5）給的是它落在的那一整小節（4）。' },
    ],
    description: [
      {
        en: 'Define `function cueFired(name, bar) { … }` and it is called at the step where a cue is due, before [`barStarted()`](#barStarted), [`stepStarted()`](#stepStarted) and the hits of that step. A good place to change a scene: `function cueFired(name) { look = SCENES[name]; }`. If you only need the latest name, read [`cueName`](#cueName) in `draw()` instead.',
        zh: '定義 `function cueFired(name, bar) { … }`，cue 該發動的那一格就會呼叫它，順序在 [`barStarted()`](#barStarted)、[`stepStarted()`](#stepStarted) 和那一格的打擊之前。很適合用來換場景：`function cueFired(name) { look = SCENES[name]; }`。如果你只需要最近的名字，在 `draw()` 裡讀 [`cueName`](#cueName) 就好。',
      },
    ],
    notes: [
      {
        en: 'Cues keep firing while the tab is hidden, so the scene is right when you come back. Several cues on one step call it once each, in the order they were declared.',
        zh: '分頁被藏起來的時候，cue 照樣會發動，所以回來的時候場景是對的。同一格有好幾個 cue，會依宣告的順序各呼叫一次。',
      },
    ],
    examples: [
      {
        code: `let scene = '-';
let when = 0;

function setup() {
  createCanvas(400, 300);
  startDrums('four on floor', 150);
  cue(1, 'intro');
  cue(3, 'verse', 4);
  cue(5, 'chorus', 4);
  textAlign(CENTER, CENTER);
  textSize(32);
}

function cueFired(name, bar) {
  scene = name + ' (bar ' + bar + ')';
  when = millis();
}

function draw() {
  background(20 + max(0, 1 - (millis() - when) / 400) * 120);   // a flash on every cue
  fill(255);
  text(scene, width / 2, height / 2);
}`,
        caption: { en: 'The screen flashes and names the scene each time a cue fires: intro once, then verse and chorus take turns.', zh: '每次 cue 發動，畫面閃一下並顯示場景名稱：intro 只有一次，之後 verse 和 chorus 輪流。' },
      },
    ],
    related: ['cue', 'cueName', 'barStarted', 'stepStarted', 'OAVp5.drums.on'],
    keywords: {
      en: ['cue fired', 'cue event', 'scene change', 'callback', 'timeline event'],
      zh: ['cue 發動', 'cue 事件', '換場景', 'callback', '時間軸事件'],
    },
  },

  barStarted: {
    group: 'timeline',
    summary: {
      en: 'An event you define: it is called at the first step of every bar of the drum machine, with the bar number.',
      zh: '一個由你定義的事件函式：鼓機每一小節的第一格就會呼叫它，帶著小節的號碼。',
    },
    params: [
      { name: 'bar', type: 'Number', en: 'The bar that starts, counted from 1.', zh: '剛開始的小節，從 1 算起。' },
    ],
    description: [
      {
        en: 'Define `function barStarted(bar) { … }` to do something once per bar: `function barStarted(bar) { drift += 9; }`. It is called in the frame where the first step of the bar is heard, right before `draw()`, and the first call is `barStarted(1)` when the machine starts. Within a step, [`cueFired()`](#cueFired) comes before it and [`stepStarted()`](#stepStarted) after.',
        zh: '定義 `function barStarted(bar) { … }`，就可以每小節做一次事：`function barStarted(bar) { drift += 9; }`。它是在你聽到那一小節第一格的那個畫面、`draw()` 之前被呼叫的，鼓機啟動時的第一次呼叫是 `barStarted(1)`。在同一格裡，[`cueFired()`](#cueFired) 在它之前，[`stepStarted()`](#stepStarted) 在它之後。',
      },
    ],
    notes: [
      {
        en: 'While the tab is hidden it is still called once per bar, but nothing is told twice when the tab comes back. [`stepStarted()`](#stepStarted) and the hits are not told in that time.',
        zh: '分頁被藏起來的時候，每一小節仍然會呼叫一次，分頁回來的時候也不會補呼叫漏掉的。這段時間不會呼叫 [`stepStarted()`](#stepStarted)，也不會通知打擊。',
      },
    ],
    examples: [
      {
        code: `let shade = 200;

function setup() {
  createCanvas(400, 300);
  colorMode(HSB, 360, 100, 100);
  startDrums('four on floor', 150);
}

function barStarted(bar) {
  shade = (shade + 40) % 360;   // a new colour every bar
}

function draw() {
  background(shade, 60, 80);
  fill(0, 0, 100);
  textAlign(CENTER, CENTER);
  textSize(48);
  text(drumBar, width / 2, height / 2);
}`,
        caption: { en: 'The background changes colour at the start of every bar, while the number counts the bars.', zh: '每一小節的開頭背景換一個顏色，數字數著現在是第幾小節。' },
      },
    ],
    related: ['stepStarted', 'cueFired', 'drumBar', 'drumHit', 'OAVp5.drums.on'],
    keywords: {
      en: ['bar started', 'new bar', 'bar event', 'downbeat', 'measure', 'callback'],
      zh: ['小節開始', '新的一小節', '小節事件', '強拍', 'callback'],
    },
  },

  stepStarted: {
    group: 'timeline',
    summary: {
      en: 'An event you define: it is called at every one of the 16 steps of the drum machine, with the step and the bar.',
      zh: '一個由你定義的事件函式：鼓機 16 格裡的每一格都會呼叫它，帶著這一格和小節。',
    },
    params: [
      { name: 'step', type: 'Number', en: 'The step that starts, 0 to 15. Every 4 steps is a beat.', zh: '剛開始的那一格，0 到 15。每 4 格是一拍。' },
      { name: 'bar', type: 'Number', en: 'The bar it is in, counted from 1.', zh: '它所在的小節，從 1 算起。' },
    ],
    description: [
      {
        en: 'Define `function stepStarted(step, bar) { … }` for something on every step: `if (step % 4 === 0) ping = 1;` is a pulse on the beat. It is called in the frame where the step is heard, right before `draw()`, after [`barStarted()`](#barStarted) and before the hits of that step. [`drumStep`](#drumStep) holds the same number if you would rather read than be called.',
        zh: '定義 `function stepStarted(step, bar) { … }`，每一格都能做事：`if (step % 4 === 0) ping = 1;` 就是每一拍脈動一下。它是在你聽到那一格的那個畫面、`draw()` 之前被呼叫的，在 [`barStarted()`](#barStarted) 之後、那一格的打擊之前。如果你比較想讀值而不是被呼叫，[`drumStep`](#drumStep) 裡是同一個數字。',
      },
    ],
    notes: [
      {
        en: 'It is not called while the tab is hidden, so a sketch that adds a particle per step does not burst when you come back.',
        zh: '分頁被藏起來的時候不會呼叫它，所以每一格就加一個粒子的草圖，在你回來的時候不會一口氣冒出一大堆。',
      },
    ],
    examples: [
      {
        code: `let ping = 0;

function setup() {
  createCanvas(400, 300);
  startDrums('breakbeat', 120);
  noStroke();
}

function stepStarted(step, bar) {
  if (step % 4 === 0) ping = 1;   // on every beat
}

function draw() {
  background(20);
  ping *= 0.9;
  fill(255, 160, 80);
  circle(width / 2, height / 2, 40 + ping * 120);
}`,
        caption: { en: 'A circle that pulses on every beat (every fourth step) and shrinks back in between.', zh: '一個圓，每一拍（每四格）脹一下，中間縮回去。' },
      },
    ],
    related: ['drumStep', 'barStarted', 'drumHit', 'cueFired', 'OAVp5.drums.on'],
    keywords: {
      en: ['step started', 'step event', 'every step', 'sixteenth', 'tick', 'callback', 'beat'],
      zh: ['每一格', '格開始', '步進事件', '十六分音符', 'callback', '拍子'],
    },
  },
};
