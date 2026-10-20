// oav-p5 reference: the microphone. Read by tools/build-reference.mjs (see AGENTS.md, "Documenting a public name").
// The keys are the public names the code has (tools/reference/scan.mjs reads them); a key the code does not have is a red test.
// Sketch examples leave out the loader line: the page puts it on top when you copy or run.

export default {
  micLevel: {
    group: 'mic',
    summary: {
      en: 'How loud the microphone hears things, from 0 (a quiet room) to 1 (shouting).',
      zh: '麥克風聽到的聲音有多大聲，從 0（安靜的房間）到 1（大喊）。',
    },
    value: {
      type: 'Number', range: '0..1',
      en: 'Updated once per display frame while the microphone is on. It is 0 while the microphone is off, still asking, blocked or missing.',
      zh: '麥克風開著的時候，每個畫面更新一次。麥克風關著、還在詢問、被擋下或根本沒有的時候，一直是 0。',
    },
    description: [
      {
        en: 'Read it in `draw()` the way you read `mouseX`: `circle(width / 2, height / 2, 50 + micLevel * 300)` grows when someone talks. It is a loudness in decibels, which is how an ear hears it, measured from the room itself: the bottom of the scale follows the room\'s own noise (it settles within a second or two and rises at most 1.5 dB a second, so a voice never becomes the new silence), and −10 dBFS, shouting into a laptop, is 1.',
        zh: '像讀 `mouseX` 一樣在 `draw()` 裡直接讀：`circle(width / 2, height / 2, 50 + micLevel * 300)`，有人說話圓就變大。它是以分貝量的音量，跟耳朵聽起來的感覺一致，而且是從房間本身量起：量表的底部跟著房間的底噪走（一兩秒內安頓下來，每秒最多往上爬 1.5 dB，所以人聲不會變成新的安靜），−10 dBFS（對著筆電大喊）就是 1。',
      },
      {
        en: 'In practice a quiet room reads 0, a quiet voice about 0.4 to 0.6, shouting close to 1. If the microphone is quiet or far away, raise it with [`micSensitivity()`](#micSensitivity).',
        zh: '實際上，安靜的房間是 0，小聲說話約 0.4 到 0.6，大喊接近 1。麥克風很小聲或離得很遠的話，用 [`micSensitivity()`](#micSensitivity) 把它調大。',
      },
      {
        en: 'It follows the browser\'s animation frames rather than `draw()`, so a sketch running at `frameRate(10)` still reads the latest value, and the number stops changing while the tab is hidden (browsers pause animation frames there).',
        zh: '它跟著瀏覽器的動畫畫面更新，不是跟著 `draw()`，所以用 `frameRate(10)` 跑的草圖讀到的還是最新的值。分頁被藏起來時數字會停住（瀏覽器在那時會暫停動畫畫面）。',
      },
    ],
    needs: {
      en: 'Nothing to call. The first time a sketch reads `micLevel` (or [`bass`](#bass), `mid`, `treble`, [`beat`](#beat)), oav-p5 asks the browser for the microphone, and every value stays `0` until you allow it. The page needs `https` or `localhost`. If the browser kept audio quiet until a click, the first click or key starts it. [`?oav_mic=click`](#option-mic) makes only the 🎤 button and [`startMic()`](#startMic) turn it on; `?oav_mic=off` means nothing can.',
      zh: '不用呼叫任何東西。草圖第一次讀 `micLevel`（或 [`bass`](#bass)、`mid`、`treble`、[`beat`](#beat)）的時候，oav-p5 就會向瀏覽器要麥克風，在你按下允許之前所有的值都是 `0`。網頁要在 `https` 或 `localhost` 底下。如果瀏覽器在你點一下之前不讓聲音出來，第一次點擊或按鍵就會把它啟動。[`?oav_mic=click`](#option-mic) 表示只有 🎤 按鈕和 [`startMic()`](#startMic) 能開。`?oav_mic=off` 表示什麼都開不了。',
    },
    notes: [
      {
        en: 'In the 🎹 panel the 🎤 button turns the microphone on and off by hand and shows the level. When the browser blocked it, a card beside the 🎹 says why and what to press: click the lock left of the address, set Microphone to Allow, then click the canvas.',
        zh: '🎹 面板裡的 🎤 按鈕可以手動開關麥克風，並顯示音量。瀏覽器擋下麥克風的時候，🎹 旁邊會跳出一張卡片說明原因和怎麼處理：點網址列左邊的鎖頭，把麥克風設成允許，再點一下畫布。',
      },
      {
        en: 'On openprocessing.org the sketch frame allows the microphone and MIDI (checked 2026-10-19: its `allow` list contains `microphone` and `midi`), and the first read of `micLevel` there asks for the microphone. An embed code copied from OpenProcessing does not carry that: add `allow="microphone"` to that `<iframe>`.',
        zh: '在 openprocessing.org 上，草圖的框允許麥克風和 MIDI（2026-10-19 實際檢查過：它的 `allow` 清單有 `microphone` 和 `midi`），而且在那裡第一次讀 `micLevel` 就會去要麥克風。從 OpenProcessing 複製出來的嵌入碼沒有這個設定：要在那個 `<iframe>` 加上 `allow="microphone"`。',
      },
      {
        en: 'The raw numbers behind it are [`OAVp5.mic.rms`](#OAVp5.mic.rms) (0..1), `OAVp5.mic.db` and `OAVp5.mic.floor` (the room\'s own noise, in dBFS).',
        zh: '它背後的原始數字是 [`OAVp5.mic.rms`](#OAVp5.mic.rms)（0..1）、`OAVp5.mic.db` 和 `OAVp5.mic.floor`（房間本身的底噪，單位 dBFS）。',
      },
    ],
    tbd: [
      {
        en: 'On openprocessing.org the pasted sketch runs, loads oav-p5 and asks for the microphone, but the sound itself was not tried there: the browser used for the check blocks the microphone, so the allow-and-listen step is still unconfirmed on that site.',
        zh: '貼進 openprocessing.org 的草圖會跑、會載入 oav-p5、也會去要麥克風，但那裡的聲音本身沒有試：檢查用的瀏覽器擋掉了麥克風，所以在那個網站上「按允許、然後聽到聲音」這一步還沒確認。',
      },
    ],
    examples: [
      {
        code: `function setup() {
  createCanvas(400, 300);
}

function draw() {
  background(20);
  circle(width / 2, height / 2, 50 + micLevel * 300);
}`,
        caption: { en: 'Allow the microphone when the browser asks, then talk: the circle grows with your voice.', zh: '瀏覽器詢問的時候按允許，然後說話：圓會跟著你的聲音變大。' },
        needs: 'mic',
      },
      {
        code: `function setup() {
  createCanvas(400, 300);
}

function draw() {
  background(20);
  const level = lag(micLevel, 0.03, 0.4);   // opens fast, closes slowly
  fill(255, 120 + level * 135, 60);
  circle(width / 2, height / 2, 50 + level * 300);
}`,
        caption: { en: 'The same circle through lag(): it opens at once when someone speaks and closes slowly, like a VU meter.', zh: '同一個圓，加上 lag()：有人開口就立刻張開，之後慢慢收回去，像音量表。' },
        needs: 'mic',
      },
      {
        code: `function setup() {
  createCanvas(400, 300);
  micSensitivity(3);   // a quiet or far-away microphone
}

function draw() {
  background(20);
  fill(255);
  if (!micIsOn) text('Allow the microphone, then make a sound', 20, 30);
  rect(20, height - 40, micLevel * (width - 40), 20);
}`,
        caption: { en: 'A bar that fills with the level. micIsOn tells you whether the browser has said yes yet.', zh: '一條隨音量變長的橫條。micIsOn 告訴你瀏覽器是不是已經答應了。' },
        needs: 'mic',
      },
    ],
    related: ['bass', 'beat', 'micIsOn', 'micSensitivity', 'startMic', 'lag'],
    keywords: {
      en: ['microphone', 'mic', 'volume', 'loudness', 'audio', 'sound level', 'input level', 'vu meter', 'decibel'],
      zh: ['麥克風', '音量', '聲音大小', '聲音', '收音', '音量表', '分貝'],
    },
    claims: [{ expr: 'micLevel', min: 0, max: 1, needs: 'mic', moves: true }],
  },

  bass: {
    group: 'mic',
    aliases: ['mid', 'treble'],
    summary: {
      en: 'How much of the microphone\'s sound is low (`bass`), middle (`mid`) or high (`treble`), each from 0 to 1.',
      zh: '麥克風聽到的聲音裡，低音（`bass`）、中音（`mid`）、高音（`treble`）各佔多少，各自從 0 到 1。',
    },
    value: {
      type: 'Number', range: '0..1',
      en: 'The energy in 20–250 Hz (`bass`), 250–2000 Hz (`mid`) and 2000–8000 Hz (`treble`). Updated once per display frame while the microphone is on; 0 otherwise.',
      zh: '`bass` 是 20–250 Hz 的能量，`mid` 是 250–2000 Hz，`treble` 是 2000–8000 Hz。麥克風開著時每個畫面更新一次，其他時候是 0。',
    },
    description: [
      {
        en: 'Use them like [`micLevel`](#micLevel), one number per band: `fill(200 + bass * 160, 70, 100)` pushes the colour with the low end. The three share one entry because they behave the same; only the frequency range differs.',
        zh: '用法跟 [`micLevel`](#micLevel) 一樣，每個頻段一個數字：`fill(200 + bass * 160, 70, 100)` 讓顏色跟著低音走。三個名稱共用這一條，因為它們的行為完全相同，只有頻率範圍不同。',
      },
      {
        en: 'Unlike `micLevel` they are not measured in decibels: each is the average strength of the frequencies in its band, scaled by [`micSensitivity()`](#micSensitivity) and held to 1. A band that is faint in your room can stay close to 0; raise the sensitivity rather than multiplying by a large number.',
        zh: '跟 `micLevel` 不一樣，它們不是用分貝量的：每一個是該頻段所有頻率的平均強度，乘上 [`micSensitivity()`](#micSensitivity) 之後最多算到 1。如果某個頻段在你的房間裡很微弱，數字會一直貼近 0。這時調高靈敏度，比自己乘一個很大的數字好。',
      },
    ],
    needs: {
      en: 'Reading any of them asks for the microphone the first time, exactly like [`micLevel`](#micLevel); until you allow it they are `0`.',
      zh: '第一次讀其中任何一個，就會跟 [`micLevel`](#micLevel) 一樣去要麥克風。在你允許之前都是 `0`。',
    },
    notes: [
      {
        en: 'A sketch that already has its own variable, function or library called `bass`, `mid` or `treble` keeps it: oav-p5 leaves that name alone and never starts the microphone for it. Assigning one later turns the name back into a plain variable.',
        zh: '如果草圖本來就有自己的 `bass`、`mid` 或 `treble`（變數、函式、函式庫都算），oav-p5 就不動那個名稱，也不會為它去開麥克風。之後自己指定值的話，那個名稱就變回一般變數。',
      },
    ],
    tbd: [
      {
        en: 'Typical values for speech and for music depend on the microphone and the room; no typical numbers are given here until they have been measured.',
        zh: '說話和音樂的典型數值要看麥克風和房間。在量過之前，這裡不給典型數字。',
      },
    ],
    examples: [
      {
        code: `function setup() {
  createCanvas(400, 300);
  colorMode(HSB, 360, 100, 100);
}

function draw() {
  background(230, 40, 10);
  fill(200 + bass * 160, 70, 100);   // low sounds push the colour toward magenta
  circle(width / 2, height / 2, 80 + bass * 220);
}`,
        caption: { en: 'A circle that swells and changes colour with the low end: tap the desk or play something with a kick.', zh: '一個隨低音變大、變色的圓：敲桌子或放一段有大鼓的音樂。' },
        needs: 'mic',
      },
      {
        code: `function setup() {
  createCanvas(400, 300);
  noStroke();
}

function draw() {
  background(20);
  const bands = [bass, mid, treble];
  for (let i = 0; i < 3; i++) {
    fill(255, 80 + i * 70, 120);
    rect(60 + i * 110, height - 20, 80, -20 - bands[i] * 240);
  }
}`,
        caption: { en: 'Three bars, one per band, from low to high. Whistle for the right one, hum for the left.', zh: '三根長條，依序是低、中、高音。吹口哨看右邊那根，哼低音看左邊那根。' },
        needs: 'mic',
      },
    ],
    related: ['micLevel', 'beat', 'micSensitivity', 'kickDetected'],
    keywords: {
      en: ['bass', 'mid', 'treble', 'low', 'high', 'frequency', 'band', 'spectrum', 'equalizer', 'fft'],
      zh: ['低音', '中音', '高音', '頻段', '頻率', '頻譜', '麥克風'],
    },
    claims: [
      { expr: 'bass', min: 0, max: 1, needs: 'mic' },
      { expr: 'mid', min: 0, max: 1, needs: 'mic' },
      { expr: 'treble', min: 0, max: 1, needs: 'mic' },
    ],
  },

  beat: {
    group: 'mic',
    summary: {
      en: 'True for one frame each time the microphone (or the drum machine) hears a beat.',
      zh: '麥克風（或鼓機）每聽到一個拍子，就在那一個畫面是 true。',
    },
    value: {
      type: 'Boolean',
      en: 'True in the first `draw()` after a beat, and false until the next one. Reading it twice in the same frame gives the same answer.',
      zh: '拍子之後的第一個 `draw()` 是 true，到下一個拍子之前都是 false。同一個畫面裡讀兩次，答案一樣。',
    },
    description: [
      {
        en: 'It behaves like `mouseIsPressed` while a button is down, except the "press" lasts one frame: `if (beat) flash = 1;` is all it takes to react to the music. A beat is a jump in loudness over what the room has been doing, with at least 100 ms between two beats; two beats between two frames count as one.',
        zh: '它的用法像按著滑鼠鍵時的 `mouseIsPressed`，只是「按下」只持續一個畫面：`if (beat) flash = 1;` 就能對音樂做出反應。一個拍子是音量比房間一直以來的聲音突然跳高，兩個拍子之間至少隔 100 毫秒。兩個畫面之間發生的兩個拍子只算一次。',
      },
      {
        en: 'When the drum machine is playing, `beat` is also true for a frame on every kick and snare, so a sketch written for the microphone moves over to the machine unchanged.',
        zh: '鼓機在播的時候，每一下大鼓和小鼓也會讓 `beat` 在那個畫面是 true，所以為麥克風寫的草圖不用改就能換成鼓機。',
      },
    ],
    needs: {
      en: 'Reading `beat` asks for the microphone the first time, like [`micLevel`](#micLevel). If you would rather be called, define [`beatDetected()`](#beatDetected).',
      zh: '第一次讀 `beat` 就會跟 [`micLevel`](#micLevel) 一樣去要麥克風。如果你比較想被呼叫，就定義 [`beatDetected()`](#beatDetected)。',
    },
    examples: [
      {
        code: `let flash = 0;

function setup() {
  createCanvas(400, 300);
}

function draw() {
  if (beat) flash = 1;        // true for exactly one frame per beat
  background(20 + flash * 200);
  flash *= 0.9;               // fade back down
}`,
        caption: { en: 'The screen flashes on every beat and fades out. Clap or tap the desk.', zh: '每個拍子畫面閃一下再慢慢暗下去。拍手或敲桌子試試。' },
        needs: 'mic',
      },
      {
        code: `let count = 0;

function setup() {
  createCanvas(400, 300);
  textAlign(CENTER, CENTER);
  textSize(96);
}

function draw() {
  if (beat) count++;
  background(20);
  fill(255);
  text(count, width / 2, height / 2);
}`,
        caption: { en: 'A counter that goes up by one per beat, never twice for the same one.', zh: '每個拍子加一的計數器，同一個拍子不會算兩次。' },
        needs: 'mic',
      },
    ],
    related: ['beatDetected', 'micLevel', 'kickDetected', 'startDrums'],
    keywords: { en: ['beat', 'onset', 'tempo', 'rhythm', 'clap', 'trigger', 'transient'], zh: ['拍子', '節拍', '節奏', '鼓點', '觸發', '麥克風'] },
  },

  micIsOn: {
    group: 'mic',
    summary: {
      en: 'Whether the microphone is running right now.',
      zh: '麥克風現在有沒有在運作。',
    },
    value: {
      type: 'Boolean',
      en: 'True once the browser has said yes and sound is coming in; false while the microphone is off, still asking, blocked or missing.',
      zh: '瀏覽器答應了、聲音進來之後是 true。麥克風關著、還在詢問、被擋下或不存在的時候是 false。',
    },
    description: [
      {
        en: 'Use it to show a hint until sound arrives: `if (!micIsOn) text("Allow the microphone", 20, 30);`. Reading it never starts the microphone (unlike [`micLevel`](#micLevel)), so it is safe to check anywhere. The reason behind a `false` is in `OAVp5.mic.state` (`off`, `asking`, `on`, `denied` or `unavailable`) and, when something failed, `OAVp5.mic.error`.',
        zh: '可以用它在聲音進來之前顯示提示：`if (!micIsOn) text("請允許麥克風", 20, 30);`。讀它不會啟動麥克風（跟 [`micLevel`](#micLevel) 不一樣），所以在哪裡檢查都安全。`false` 的原因看 `OAVp5.mic.state`（`off`、`asking`、`on`、`denied` 或 `unavailable`），失敗的時候還有 `OAVp5.mic.error`。',
      },
    ],
    examples: [
      {
        code: `function setup() {
  createCanvas(400, 300);
}

function draw() {
  background(micIsOn ? 20 : 90);
  fill(255);
  textAlign(CENTER, CENTER);
  text(micIsOn ? 'listening' : 'allow the microphone', width / 2, height / 2);
}`,
        caption: { en: 'Grey with a prompt until the microphone is on, then dark. (Nothing here reads micLevel, so nothing asks for the microphone: press 🎤 in the 🎹 panel.)', zh: '麥克風開起來之前是灰色加提示，開了之後變暗。（這裡沒有讀 micLevel，所以不會自己去要麥克風：按 🎹 面板裡的 🎤。）' },
      },
    ],
    related: ['micLevel', 'startMic', 'stopMic'],
    keywords: { en: ['microphone', 'mic', 'on', 'status', 'permission', 'allowed'], zh: ['麥克風', '開著', '狀態', '權限', '允許'] },
  },

  startMic: {
    group: 'mic',
    summary: {
      en: 'Turns the microphone on and returns a promise that says whether it worked.',
      zh: '開啟麥克風，並回傳一個 promise，告訴你有沒有成功。',
    },
    params: [],
    returns: {
      type: 'Promise<Boolean>',
      en: 'Resolves to `true` once the microphone is on, `false` if it was blocked, is missing, or the `mic` option is `off`.',
      zh: '麥克風開起來之後 resolve 成 `true`。被擋下、不存在、或載入選項 `mic` 是 `off` 的時候 resolve 成 `false`。',
    },
    description: [
      {
        en: 'You rarely need it: reading [`micLevel`](#micLevel) and its friends already starts the microphone. Call it when you want to choose the moment (a button, the end of an intro) or know the answer: `startMic().then((ok) => { … })`. Calling it again while it is on, or while the browser is still asking, returns the same result.',
        zh: '通常用不到：只要讀 [`micLevel`](#micLevel) 之類的名稱，麥克風就會自己啟動。想自己決定時機（一個按鈕、片頭結束的時候）或想知道結果時才呼叫：`startMic().then((ok) => { … })`。已經開著、或瀏覽器還在詢問的時候再呼叫，會回傳同一個結果。',
      },
    ],
    needs: {
      en: 'Browsers want a click before audio plays: call it from `mousePressed()` or a button handler if `setup()` is too early. It works whatever the `mic` option is, except `?oav_mic=off`, where nothing can start the microphone.',
      zh: '瀏覽器要先有一次點擊才讓聲音出來：如果在 `setup()` 裡太早，就放在 `mousePressed()` 或按鈕的處理函式裡呼叫。不管載入選項 `mic` 是什麼都能用，只有 `?oav_mic=off` 例外，那時什麼都開不了麥克風。',
    },
    notes: [
      {
        en: 'After [`stopMic()`](#stopMic), only `startMic()` (or 🎤) turns it back on; reading `micLevel` does not.',
        zh: '呼叫過 [`stopMic()`](#stopMic) 之後，只有 `startMic()`（或 🎤）能再把它打開。讀 `micLevel` 不會。',
      },
    ],
    examples: [
      {
        code: `function setup() {
  createCanvas(400, 300);
  textAlign(CENTER, CENTER);
}

function mousePressed() {
  startMic().then((ok) => console.log(ok ? 'microphone on' : 'no microphone'));
}

function draw() {
  background(20);
  fill(255);
  text(micIsOn ? 'level ' + nf(micLevel, 1, 2) : 'click to start the microphone', width / 2, height / 2);
}`,
        caption: { en: 'Nothing happens until you click; then the browser asks, and the number starts moving.', zh: '點下去之前什麼都不會發生。點了之後瀏覽器才詢問，數字就開始動。' },
        needs: 'mic',
      },
    ],
    related: ['stopMic', 'micIsOn', 'micLevel'],
    keywords: { en: ['microphone', 'start', 'enable', 'permission', 'getUserMedia', 'promise'], zh: ['麥克風', '開啟', '啟動', '權限', '允許'] },
  },

  stopMic: {
    group: 'mic',
    summary: {
      en: 'Turns the microphone off and sets every microphone value back to 0.',
      zh: '關掉麥克風，所有麥克風的值都歸零。',
    },
    params: [],
    returns: { type: 'Promise<Boolean>', en: 'Resolves to `false`, the new state of the microphone.', zh: 'resolve 成 `false`，也就是麥克風的新狀態。' },
    description: [
      {
        en: 'It stops the microphone\'s tracks and closes its audio context, so the browser\'s "recording" indicator goes away. [`micLevel`](#micLevel), [`bass`](#bass), `mid`, `treble` and the rest read `0` again, and [`micIsOn`](#micIsOn) is `false`.',
        zh: '它會停掉麥克風的音軌並關掉它的音訊環境，所以瀏覽器上「正在錄音」的指示會消失。[`micLevel`](#micLevel)、[`bass`](#bass)、`mid`、`treble` 等等都回到 `0`，[`micIsOn`](#micIsOn) 變成 `false`。',
      },
    ],
    notes: [
      {
        en: 'After `stopMic()`, reading `micLevel` does not turn the microphone back on: that needs [`startMic()`](#startMic) or the 🎤 button.',
        zh: '`stopMic()` 之後，讀 `micLevel` 不會再把麥克風打開：要用 [`startMic()`](#startMic) 或 🎤 按鈕。',
      },
    ],
    examples: [
      {
        code: `function setup() {
  createCanvas(400, 300);
  textAlign(CENTER, CENTER);
}

function keyPressed() {
  if (key === 'm') { if (micIsOn) stopMic(); else startMic(); }
}

function draw() {
  background(20);
  fill(255);
  circle(width / 2, height / 2, 50 + micLevel * 300);
  text('press m to turn the microphone ' + (micIsOn ? 'off' : 'on'), width / 2, height - 24);
}`,
        caption: { en: 'Press m to switch the microphone on and off; the circle drops to its smallest size when it is off.', zh: '按 m 開關麥克風。關掉的時候圓縮到最小。' },
        needs: 'mic',
      },
    ],
    related: ['startMic', 'micIsOn', 'micLevel'],
    keywords: { en: ['microphone', 'stop', 'disable', 'mute', 'off'], zh: ['麥克風', '關閉', '停止', '靜音'] },
  },

  micSensitivity: {
    group: 'mic',
    summary: {
      en: 'Makes the microphone more or less sensitive: `micSensitivity(2)` is twice as sensitive, `micSensitivity()` says what it is now.',
      zh: '調整麥克風的靈敏度：`micSensitivity(2)` 是兩倍靈敏，`micSensitivity()` 會告訴你現在是多少。',
    },
    params: [
      { name: 'v', type: 'Number', optional: true, en: 'The new sensitivity, greater than 0 (kept between 0.05 and 20). Leave it out, or pass something that is not greater than 0, to change nothing.', zh: '新的靈敏度，要大於 0（會被限制在 0.05 到 20 之間）。不傳，或傳不大於 0 的值，就什麼都不改。' },
    ],
    returns: { type: 'Number', en: 'The sensitivity now in effect (1 until you change it).', zh: '現在生效的靈敏度（沒改過就是 1）。' },
    description: [
      {
        en: 'The number multiplies what the microphone hears. On [`micLevel`](#micLevel), 2 adds 6 dB; on [`bass`](#bass), `mid` and `treble` it multiplies by 2 (they stay held to 1). Use it for a quiet microphone or a far-away voice: `micSensitivity(3)` in `setup()` adds about 9.5 dB.',
        zh: '這個數字乘在麥克風聽到的東西上。對 [`micLevel`](#micLevel) 來說，2 等於加 6 dB。對 [`bass`](#bass)、`mid`、`treble` 是乘以 2（最多還是 1）。麥克風很小聲或人離得很遠的時候用它：在 `setup()` 寫 `micSensitivity(3)` 大約加 9.5 dB。',
      },
    ],
    notes: [
      {
        en: '`OAVp5.mic.gain` is the same knob under the name oav-p5 0.3.0 used.',
        zh: '`OAVp5.mic.gain` 是同一個旋鈕，用的是 oav-p5 0.3.0 的舊名字。',
      },
    ],
    examples: [
      {
        code: `function setup() {
  createCanvas(400, 300);
  micSensitivity(3);   // three times as sensitive
}

function draw() {
  background(20);
  circle(width / 2, height / 2, 50 + micLevel * 300);
  text('sensitivity ' + micSensitivity(), 20, 30);   // no argument: just reads it
}`,
        caption: { en: 'The same loudness circle on a microphone that needed a boost; the number shows the sensitivity in effect.', zh: '同樣的音量圓，用在需要加強的麥克風上。數字顯示現在的靈敏度。' },
        needs: 'mic',
      },
    ],
    related: ['micLevel', 'bass', 'startMic'],
    keywords: { en: ['sensitivity', 'gain', 'boost', 'quiet microphone', 'volume', 'threshold'], zh: ['靈敏度', '增益', '放大', '麥克風很小聲', '音量'] },
  },

  beatDetected: {
    group: 'mic',
    summary: {
      en: 'You define this function; oav-p5 calls it each time the microphone (or the drum machine) hears a beat.',
      zh: '你來定義這個函式。麥克風（或鼓機）每聽到一個拍子，oav-p5 就呼叫它一次。',
    },
    params: [
      { name: 'level', type: 'Number', en: 'How loud it was at that moment, 0..1 (the value of [`micLevel`](#micLevel)).', zh: '那一刻有多大聲，0..1（就是 [`micLevel`](#micLevel) 的值）。' },
    ],
    description: [
      {
        en: 'Declare it the way you declare `keyPressed()`:\n\n```js\nfunction beatDetected(level) {\n  // flash, spawn, jump to the next scene\n}\n```\n\nIt is called once per beat, right when the beat lands, not once per frame. Use [`beat`](#beat) instead if you would rather ask each frame.',
        zh: '用宣告 `keyPressed()` 的方式宣告它：\n\n```js\nfunction beatDetected(level) {\n  // 閃一下、生出東西、跳到下一個場景\n}\n```\n\n每個拍子呼叫一次，在拍子落下的當下，不是每個畫面一次。如果你比較想每個畫面自己問，改用 [`beat`](#beat)。',
      },
    ],
    needs: {
      en: 'A sketch that defines `beatDetected()` and reads no microphone value starts the microphone on the first click or key. When the drum machine is on, the same function is called for its kicks and snares and the microphone is not opened for it. `OAVp5.mic.on(\'beat\', fn)` hears the same beats without defining a global and returns a function that stops listening, but a listener alone never starts the microphone: read [`micLevel`](#micLevel) or call [`startMic()`](#startMic) as well.',
      zh: '草圖只要定義了 `beatDetected()` 而沒有讀任何麥克風的值，第一次點擊或按鍵時就會啟動麥克風。鼓機開著的時候，鼓機的大鼓和小鼓也會呼叫同一個函式，而且不會為它去開麥克風。`OAVp5.mic.on(\'beat\', fn)` 聽到的是同樣的拍子，不用定義全域函式，也會回傳一個停止監聽的函式，但只有監聽並不會啟動麥克風：還要讀 [`micLevel`](#micLevel) 或呼叫 [`startMic()`](#startMic)。',
    },
    notes: [
      {
        en: 'If your function throws, the sketch keeps running: the error appears in the console and as a card beside the 🎹 with the file and line.',
        zh: '你的函式如果出錯，草圖會繼續跑：錯誤會出現在 console，也會在 🎹 旁邊的卡片上顯示檔案和行號。',
      },
    ],
    examples: [
      {
        code: `let flash = 0;

function setup() {
  createCanvas(400, 300);
}

function beatDetected(level) {
  flash = 0.4 + level * 0.6;   // louder beat, brighter flash
}

function draw() {
  background(20 + flash * 200);
  flash *= 0.9;
}`,
        caption: { en: 'A flash per beat, brighter for a louder one.', zh: '每個拍子閃一下，拍子越大聲閃得越亮。' },
        needs: 'mic',
      },
    ],
    related: ['beat', 'kickDetected', 'micLevel', 'startDrums'],
    keywords: { en: ['beat', 'callback', 'event', 'onset', 'rhythm', 'clap'], zh: ['拍子', '事件', '回呼', '節拍', '節奏', '麥克風'] },
  },

  kickDetected: {
    group: 'mic',
    aliases: ['snareDetected', 'hatDetected'],
    summary: {
      en: 'You define these; oav-p5 calls them when the microphone (or the drum machine) hears a kick, a snare or a hat.',
      zh: '你來定義這幾個函式。麥克風（或鼓機）聽到大鼓、小鼓或鈸的時候，oav-p5 會呼叫 `kickDetected(level)`、`snareDetected(level)`、`hatDetected(level)`。',
    },
    params: [
      { name: 'level', type: 'Number', en: 'How strong the hit was, 0..1 (for the drum machine, its velocity).', zh: '這一下有多強，0..1（鼓機的話就是力道）。' },
    ],
    description: [
      {
        en: 'The microphone splits what it hears into three drum-like bands and calls the matching function when each band jumps: 20–120 Hz for the kick, 150–800 Hz for the snare, 6–14 kHz for the hat. There is no machine learning in it, just a transient in a frequency band, so a bass voice can trigger a kick.',
        zh: '麥克風把聽到的聲音分成三個像鼓的頻段，哪個頻段突然跳高，就呼叫對應的函式：大鼓是 20–120 Hz，小鼓是 150–800 Hz，鈸是 6–14 kHz。裡面沒有機器學習，只是某個頻段出現瞬間的衝擊，所以低沉的人聲也可能觸發大鼓。',
      },
      {
        en: 'When the drum machine plays, each of its hits calls the same functions: kick for the kick, snare for a snare, clap or rim, hat for a closed, open or pedal hat. A sketch written for the microphone therefore works with [`startDrums()`](#startDrums) unchanged.',
        zh: '鼓機在播的時候，它的每一下也會呼叫同樣的函式：大鼓呼叫 kick，小鼓、拍手或 rim 呼叫 snare，閉合、開放或腳踏的鈸呼叫 hat。所以為麥克風寫的草圖，不用改就能搭配 [`startDrums()`](#startDrums)。',
      },
      {
        en: 'While the drum machine plays, only its hits call these functions (from oav-p5 0.8.1). A microphone that is on at the same time mostly hears the drums coming out of the speakers, so its hits would call the same function twice and hear a kick as a snare. [`micLevel`](#micLevel), [`bass`](#bass), `mid` and `treble` still follow the microphone; the microphone\'s hits come back when the drums stop.',
        zh: '鼓機在打的時候，只有鼓機的每一下會呼叫這幾個函式（oav-p5 0.8.1 起）。這時候如果麥克風也開著，它聽到的多半是喇叭放出來的鼓聲，同一下會被叫兩次，大鼓也可能被聽成小鼓。[`micLevel`](#micLevel)、[`bass`](#bass)、`mid`、`treble` 照樣跟著麥克風。鼓機停下來，麥克風的打擊就會回來。',
      },
    ],
    needs: {
      en: 'Defining one of them is not enough to open the microphone once the drum machine has started; reading [`micLevel`](#micLevel) (or calling [`startMic()`](#startMic)) is. Without the drum machine, a sketch that defines any of them and reads nothing starts the microphone on the first click or key.',
      zh: '鼓機啟動之後，只定義其中一個函式並不會去開麥克風。要讀 [`micLevel`](#micLevel)（或呼叫 [`startMic()`](#startMic)）才會。沒有鼓機的時候，草圖只要定義了其中任何一個、又沒有讀任何值，第一次點擊或按鍵時會啟動麥克風。',
    },
    examples: [
      {
        code: `let kick = 0, snare = 0;

function setup() {
  createCanvas(400, 300);
  noStroke();
}

function kickDetected(level) { kick = level; }
function snareDetected(level) { snare = level; }

function draw() {
  background(20);
  fill(255, 90, 31);
  circle(120, 150, 40 + kick * 160);
  fill(120, 190, 255);
  circle(280, 150, 40 + snare * 160);
  kick *= 0.9;
  snare *= 0.9;
}`,
        caption: { en: 'Two circles, orange for kicks and blue for snares, each swelling and shrinking back on its own hits.', zh: '兩個圓，橘色對應大鼓、藍色對應小鼓，各自在自己的聲音出現時脹大再縮回去。' },
        needs: 'mic',
      },
    ],
    related: ['beatDetected', 'beat', 'bass', 'startDrums'],
    keywords: { en: ['kick', 'snare', 'hat', 'drum', 'callback', 'event', 'percussion'], zh: ['大鼓', '小鼓', '鈸', '鼓', '事件', '回呼', '打擊', '麥克風'] },
  },

  kickIsDetected: {
    group: 'mic',
    aliases: ['snareIsDetected', 'hatIsDetected'],
    summary: {
      en: 'True in the one frame after a kick (snare, hat) is heard, from the drum machine or the microphone, like `mouseIsPressed` for a hit.',
      zh: '聽到一下大鼓（小鼓、鈸）之後的那一格是 true，鼓機或麥克風都算。就像打擊版的 `mouseIsPressed`。',
    },
    value: {
      type: 'Boolean',
      en: 'True for exactly one p5 frame per hit, however often that frame reads it; false otherwise. Since oav-p5 0.8.2.',
      zh: '每一下只在一個 p5 畫面裡是 true，那一格讀幾次都一樣。其他時候是 false。oav-p5 0.8.2 起。',
    },
    description: [
      {
        en: 'The same hits that call [`kickDetected()`](#kickDetected), `snareDetected()` and `hatDetected()`, as a value you read in `draw()` instead of a function you write. Hand it to [`lag()`](#lag) and it becomes a number that jumps to 1 on the hit and fades: `lag(kickIsDetected, 0, 0.3)` is 1 on a kick and back near 0 about 0.3 s later, ready for an alpha or a size. `lag()` takes `true` as 1.',
        zh: '跟呼叫 [`kickDetected()`](#kickDetected)、`snareDetected()`、`hatDetected()` 的是同一批打擊，只是改成在 `draw()` 裡讀的值，不用寫函式。交給 [`lag()`](#lag) 就變成一個數字：打到時跳到 1，然後慢慢退回去。`lag(kickIsDetected, 0, 0.3)` 在大鼓那一下是 1，大約 0.3 秒後回到 0 附近，可以直接拿來控制透明度或大小。`lag()` 把 `true` 當成 1。',
      },
      {
        en: 'While the drum machine plays, only its hits count. Reading these does not ask for the microphone by itself: with no drums, it counts as wanting the microphone\'s hits, the way defining `kickDetected()` does, so the first click on the page opens it.',
        zh: '鼓機在打的時候只算鼓機的。讀這幾個名字本身不會去要麥克風。沒有鼓機的時候，它就跟定義 `kickDetected()` 一樣，算是想要麥克風的打擊，所以第一次點畫面會開麥克風。',
      },
    ],
    examples: [
      {
        code: `function setup() {
  createCanvas(400, 300);
  startDrums('bd*4, ~ sd ~ sd', 110);
  noStroke();
}

function draw() {
  background(20);
  fill(255, 90, 31, 255 * lag(kickIsDetected, 0, 0.3));    // a kick lights it, then it fades
  circle(130, 200, 140);
  fill(120, 190, 255, 255 * lag(snareIsDetected, 0, 0.3));
  circle(270, 200, 140);
}`,
        caption: { en: 'The orange circle flashes on every kick and fades out, the blue one on every snare.', zh: '橘色的圓每一下大鼓亮起來再淡掉，藍色的圓跟著小鼓。' },
      },
    ],
    claims: [{ before: "OAVp5.drums._hit('kick', 0.9)", expr: 'kickIsDetected && !snareIsDetected', equals: true }],
    related: ['kickDetected', 'beat', 'lastKickTs', 'lag'],
    keywords: { en: ['kick', 'snare', 'hat', 'is detected', 'this frame', 'flash', 'trigger', 'boolean'], zh: ['大鼓', '小鼓', '鈸', '這一格', '閃一下', '觸發', '瞬間'] },
  },

  lastKickTs: {
    group: 'mic',
    aliases: ['lastSnareTs', 'lastHatTs', 'lastBeatTs'],
    summary: {
      en: 'When the last kick (snare, hat, beat) came, on the `millis()` clock: `millis() - lastKickTs` is how many ms ago.',
      zh: '上一下大鼓（小鼓、鈸、拍子）是什麼時候來的，用 `millis()` 的時鐘：`millis() - lastKickTs` 就是幾毫秒前。',
    },
    value: {
      type: 'Number',
      en: 'Milliseconds on the same clock as `millis()`; `-Infinity` before the first hit, so `millis() - lastKickTs` is then `Infinity`. Since oav-p5 0.8.2.',
      zh: '毫秒，跟 `millis()` 同一個時鐘。第一下之前是 `-Infinity`，所以那時 `millis() - lastKickTs` 是 `Infinity`。oav-p5 0.8.2 起。',
    },
    description: [
      {
        en: 'Set by every hit that calls [`kickDetected()`](#kickDetected), `snareDetected()`, `hatDetected()` or [`beatDetected()`](#beatDetected): the drum machine\'s, or the microphone\'s when no drums play. Use it for anything that depends on how long ago: `exp(-(millis() - lastKickTs) / 200)` is 1 on the kick and fades with a 0.2 s time constant.',
        zh: '每一下會呼叫 [`kickDetected()`](#kickDetected)、`snareDetected()`、`hatDetected()` 或 [`beatDetected()`](#beatDetected) 的打擊都會更新它：鼓機的，或沒有鼓機時麥克風的。要算「多久以前」就用它，例如 `exp(-(millis() - lastKickTs) / 200)` 在大鼓那一下是 1，然後以 0.2 秒的時間常數淡掉。',
      },
    ],
    examples: [
      {
        code: `function setup() {
  createCanvas(400, 300);
  startDrums('bd*4, hh*8', 100);
  noStroke();
}

function draw() {
  background(20);
  const ago = millis() - lastKickTs;    // ms since the last kick
  fill(255, 90, 31);
  circle(200, 200, 40 + 160 * exp(-ago / 200));
  fill(255);
  text(isFinite(ago) ? round(ago) + ' ms since the kick' : 'no kick yet', 20, 290);
}`,
        caption: { en: 'The circle swells on each kick and shrinks back; the line says how many ms ago the kick was.', zh: '每一下大鼓圓就鼓起來再縮回去，下面那行字寫離上一下大鼓幾毫秒。' },
      },
    ],
    claims: [{ before: "OAVp5.drums._hit('kick', 0.9)", expr: 'lastKickTs > -Infinity && lastSnareTs === -Infinity', equals: true }],
    related: ['kickIsDetected', 'kickDetected', 'lastNoteTs'],
    keywords: { en: ['last kick', 'timestamp', 'time since', 'millis', 'ago', 'last snare', 'last hat', 'last beat'], zh: ['上一下', '時間', '多久以前', '毫秒', '大鼓', '小鼓', '鈸', '拍子'] },
  },

  lastKickFrameCount: {
    group: 'mic',
    aliases: ['lastSnareFrameCount', 'lastHatFrameCount', 'lastBeatFrameCount'],
    summary: {
      en: 'The `frameCount` of the frame that saw the last kick (snare, hat, beat): `frameCount - lastKickFrameCount` is how many frames ago.',
      zh: '看到上一下大鼓（小鼓、鈸、拍子）的那一格的 `frameCount`：`frameCount - lastKickFrameCount` 就是幾格以前。',
    },
    value: {
      type: 'Number',
      en: 'A frame number, on the same count as `frameCount`; `-Infinity` before the first hit. Since oav-p5 0.8.3.',
      zh: '畫面的編號，跟 `frameCount` 同一套數法。第一下之前是 `-Infinity`。oav-p5 0.8.3 起。',
    },
    description: [
      {
        en: 'The frame-counting twin of [`lastKickTs`](#lastKickTs). `frameCount - lastKickFrameCount` is 0 in the frame where [`kickIsDetected`](#kickIsDetected) is true, then 1, 2, 3 …, so a shape can last a fixed number of frames after each hit. Use the `Ts` version when it should last a fixed time whatever the frame rate.',
        zh: '[`lastKickTs`](#lastKickTs) 的「數格子」版本。在 [`kickIsDetected`](#kickIsDetected) 是 true 的那一格，`frameCount - lastKickFrameCount` 是 0，接下來是 1、2、3……，所以可以讓一個形狀在每一下之後固定留幾格。想要不管幀率都留固定秒數，就用 `Ts` 那一組。',
      },
    ],
    examples: [
      {
        code: `function setup() {
  createCanvas(400, 300);
  startDrums('bd*4, ~ sd ~ sd', 110);
  noStroke();
}

function draw() {
  background(20);
  const k = frameCount - lastKickFrameCount;    // frames since the kick
  if (k < 10) {                                 // the ring stays for 10 frames after each kick
    fill(255, 90, 31);
    circle(200, 200, 60 + k * 16);
  }
}`,
        caption: { en: 'After every kick a circle shows for ten frames, growing each frame.', zh: '每一下大鼓之後，圓會出現 10 格，每一格變大一點。' },
      },
    ],
    claims: [{ before: "OAVp5.drums._hit('kick', 0.9)", expr: 'lastKickFrameCount > -Infinity && lastSnareFrameCount === -Infinity', equals: true }],
    related: ['lastKickTs', 'kickIsDetected', 'lastNoteFrameCount'],
    keywords: { en: ['last kick', 'frameCount', 'frames since', 'frames ago', 'last snare', 'last hat', 'last beat'], zh: ['上一下', '幾格以前', '畫面數', 'frameCount', '大鼓', '小鼓', '鈸', '拍子'] },
  },
};
