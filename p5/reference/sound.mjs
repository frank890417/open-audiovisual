// oav-p5 reference: sound (startSound, soundIsOn, OAVp5.sound). Read by tools/build-reference.mjs (see AGENTS.md, "Documenting a public name").
// The keys are the public names the code has (tools/reference/scan.mjs reads them); a key the code does not have is a red test.
// Sketch examples leave out the loader line: the page puts it on top when you copy or run.

export default {
  startSound: {
    group: 'sound',
    aliases: ['OAVp5.sound.start'],
    summary: {
      en: 'Makes the keys you play heard through an instrument you name, and returns a promise that says whether sound is on.',
      zh: '讓你彈的鍵都聽得到，用你指定的樂器發聲，並回傳一個 promise，告訴你聲音有沒有開起來。',
    },
    params: [
      {
        name: 'id', type: 'String', optional: true, default: '\'piano\'',
        en: 'An instrument id, for example `\'organ\'` or `\'synth/pluck\'` (the list is in the description). Leave it out to keep the instrument chosen before; at the very first call that is the piano. A value that is not a non-empty string counts as left out.',
        zh: '樂器的代號，例如 `\'organ\'` 或 `\'synth/pluck\'`（完整清單在說明裡）。不傳就沿用之前選的樂器，第一次呼叫時就是鋼琴。不是非空字串的值，視同沒傳。',
      },
    ],
    returns: {
      type: 'Promise<Boolean>',
      en: 'Resolves to `true` once sound is on. When the browser wants a click first, that is after the first click or key press on the page. Resolves to `false` when the loading option `sound` is `off`, when [`stopSound()`](#stopSound) came first, or when Tone.js could not be loaded.',
      zh: '聲音開起來之後 resolve 成 `true`。瀏覽器要先有一次點擊的話，就是在頁面上第一次點擊或按鍵之後。載入選項 `sound` 是 `off`、[`stopSound()`](#stopSound) 先被呼叫、或 Tone.js 載入失敗的時候，resolve 成 `false`。',
    },
    description: [
      {
        en: 'Call it once in `setup()`: `startSound(\'organ\')`. From then on every note you play is heard: a MIDI keyboard, the 🎹 on screen, a phone, `midi.play(60, 0.8)`. Your own [`notePressed()`](#notePressed) still gets the note, and the sound is made before the sketch is told, so a slow callback never delays it. Pads on MIDI channel 10 (the General MIDI drum channel) play the drum kit instead of the instrument, and the sustain pedal holds notes.',
        zh: '在 `setup()` 裡呼叫一次：`startSound(\'organ\')`。從這時候起，你彈的每個音都聽得到：MIDI 鍵盤、螢幕上的 🎹、手機、`midi.play(60, 0.8)` 都算。你自己寫的 [`notePressed()`](#notePressed) 一樣會收到音符，而且是先發聲、再通知草圖，所以 callback 寫得慢也不會拖慢聲音。MIDI 第 10 軌（General MIDI 的鼓軌）的打擊墊打的是鼓組，不是樂器，延音踏板則會讓音延續。',
      },
      {
        en: 'The instrument ids are `piano`, `epiano`, `organ`, `strings`, `choir`, `harp`, `marimba`, `vibraphone`, `xylophone`, `glockenspiel`, `music-box` and the synth presets `synth/pad`, `synth/saw-lead`, `synth/square-lead`, `synth/pluck`, `synth/supersaw`, `synth/bass`, `synth/acid`, `synth/brass`, `synth/bell`, `synth/sub` and `synth/chip`. Calling `startSound(id)` while sound plays switches the instrument. An id that does not exist is listed in the console together with the real ones: an instrument that is already playing stays, and at the first call the warm pad `synth/pad` plays.',
        zh: '樂器代號有 `piano`、`epiano`、`organ`、`strings`、`choir`、`harp`、`marimba`、`vibraphone`、`xylophone`、`glockenspiel`、`music-box`，以及合成器音色 `synth/pad`、`synth/saw-lead`、`synth/square-lead`、`synth/pluck`、`synth/supersaw`、`synth/bass`、`synth/acid`、`synth/brass`、`synth/bell`、`synth/sub`、`synth/chip`。聲音在播的時候再呼叫 `startSound(id)`，就是換樂器。給了不存在的代號，主控台會連同真正的代號清單一起列出來：已經在播的樂器不變，第一次呼叫就給錯的話，會是溫暖的 `synth/pad`。',
      },
      {
        en: 'Nothing is loaded before the first call (or before 🔊 in the 🎹 panel): [@openav/sound](#Sound) comes from next to `oav-p5.js` and Tone.js 15 from jsDelivr (the `tone` option points it somewhere else). Only the `piano` plays recorded samples, about 2 MB the first time; the electric piano sounds meanwhile (or, when you switch from another instrument, that one keeps sounding), and [`OAVp5.sound.instrument`](#OAVp5.sound.instrument) changes to `piano` when the samples are in. Every other instrument is made by Tone.js and has no files to load.',
        zh: '在第一次呼叫之前（或按 🎹 面板裡的 🔊 之前）什麼都不會載入：[@openav/sound](#Sound) 從 `oav-p5.js` 旁邊載入，Tone.js 15 從 jsDelivr 載入（載入選項 `tone` 可以改成別的地方）。只有 `piano` 播的是錄好的取樣，第一次大約 2 MB，載好之前由電鋼琴先頂著（如果是從別的樂器切過來，就由原本那個繼續響），取樣到齊的時候 [`OAVp5.sound.instrument`](#OAVp5.sound.instrument) 會變成 `piano`。其他樂器都是 Tone.js 即時合成的，沒有檔案要載。',
      },
    ],
    needs: {
      en: 'A browser lets a page make sound only after a click or a key press on the page, and a key on a MIDI keyboard does not count. Calling `startSound()` in `setup()` is fine: [`OAVp5.sound.state`](#OAVp5.sound.state) is `\'waiting\'` and a card beside the 🎹 says "Sound is ready but silent"; the first click or key press turns sound on. [`soundIsOn`](#soundIsOn) tells when it has.',
      zh: '瀏覽器要頁面上先有一次點擊或按鍵才讓頁面出聲，MIDI 鍵盤上的鍵不算。在 `setup()` 裡呼叫 `startSound()` 沒有問題：[`OAVp5.sound.state`](#OAVp5.sound.state) 會是 `\'waiting\'`，🎹 旁邊有一張卡片說「聲音準備好了，還沒響」，第一次點擊或按鍵就會把聲音打開。[`soundIsOn`](#soundIsOn) 會告訴你什麼時候開了。',
    },
    notes: [
      {
        en: 'No code at all: `?oav_sound=piano` on the page address (any instrument id; on OpenProcessing `?sketch_oav_sound=piano`) makes any sketch heard from the first click, and [`?oav_sound=off`](#option-sound) keeps it silent: `startSound()` then does nothing and resolves to `false`. In the 🎹 panel, 🔊 turns sound on and off and shows a picker with every instrument.',
        zh: '完全不寫程式也行：在網址後面加 `?oav_sound=piano`（任何樂器代號都可以，在 OpenProcessing 上是 `?sketch_oav_sound=piano`），任何草圖從第一次點擊起就聽得到，[`?oav_sound=off`](#option-sound) 則讓它保持安靜，這時 `startSound()` 什麼都不做，並 resolve 成 `false`。🎹 面板裡的 🔊 可以開關聲音，並列出所有樂器讓你挑。',
      },
      {
        en: 'Sound is separate from the drum machine: [`startDrums()`](#startDrums) has its own kit and is heard from the first click without `startSound()`.',
        zh: '聲音和鼓機是分開的：[`startDrums()`](#startDrums) 有自己的鼓組，不用 `startSound()`，第一次點擊之後就聽得到。',
      },
    ],
    examples: [
      {
        code: `let playing = 60;

function setup() {
  createCanvas(400, 300);
  startSound('synth/pluck');   // every key you play is heard
}

function mousePressed() {
  playing = 48 + floor(mouseX / 25);   // low on the left, high on the right
  midi.play(playing, 0.8);
}

function mouseReleased() {
  midi.play(playing, 0);
}

function draw() {
  background(soundIsOn ? 30 : 90);
  fill(255);
  textAlign(CENTER, CENTER);
  text(soundIsOn ? 'click to play a note' : 'click once to turn sound on', width / 2, height / 2);
}`,
        caption: { en: 'The first click turns sound on and the background darkens; the clicks after that play a note, higher to the right.', zh: '第一次點擊把聲音打開，背景變暗，之後每點一下就彈一個音，越右邊音越高。' },
      },
      {
        code: `const KEYS = { a: 60, s: 62, d: 64, f: 65, g: 67, h: 69, j: 71, k: 72 };
let dots = [];

function setup() {
  createCanvas(400, 300);
  noStroke();
  startSound('epiano');
}

function keyPressed() {
  if (KEYS[key]) midi.play(KEYS[key], 0.8);
}

function keyReleased() {
  if (KEYS[key]) midi.play(KEYS[key], 0);
}

function notePressed(n, v) {
  dots.push({ x: map(n, 60, 72, 30, width - 30), y: height, v });
}

function draw() {
  background(20);
  for (const d of dots) {
    fill(255, 160, 80);
    circle(d.x, d.y, 20 + d.v * 30);
    d.y -= 2;
  }
  dots = dots.filter((d) => d.y > -40);
  fill(255);
  text(soundIsOn ? 'play with a s d f g h j k' : 'press a key once to turn sound on', 20, 24);
}`,
        caption: { en: 'Press a, s, d, f, g, h, j, k: each key sounds and a dot floats up from the matching place.', zh: '按 a、s、d、f、g、h、j、k：每個鍵都會發聲，並從對應的位置飄起一個圓點。' },
      },
      {
        code: `const IDS = ['synth/pluck', 'organ', 'marimba', 'piano'];

function setup() {
  createCanvas(400, 300);
  startSound(IDS[0]);
}

function keyPressed() {
  const i = Number(key) - 1;
  if (IDS[i]) startSound(IDS[i]);   // switches while it plays
}

function draw() {
  background(20);
  fill(255);
  const s = OAVp5.sound.status;   // the instrument being loaded
  text('keys 1-4 pick an instrument', 20, 30);
  text('playing: ' + OAVp5.sound.instrument, 20, 60);
  text('loading: ' + s.id + ' (' + s.state + ', ' + nf(s.progress * 100, 1, 0) + '%)', 20, 90);
}`,
        caption: { en: 'Press 4 for the piano: "loading" shows its samples arriving while "playing" still names the instrument you hear, and flips to piano when it is ready.', zh: '按 4 換鋼琴：「loading」會顯示取樣載入的進度，「playing」仍是你現在聽到的樂器，等準備好才換成 piano。' },
      },
    ],
    related: ['stopSound', 'soundIsOn', 'OAVp5.sound.state', 'OAVp5.sound.instrument', 'notePressed', 'startDrums'],
    keywords: {
      en: ['sound', 'audio', 'instrument', 'piano', 'organ', 'synth', 'play', 'tone', 'speaker', 'hear', 'make noise'],
      zh: ['聲音', '發聲', '樂器', '鋼琴', '風琴', '合成器', '彈奏', '喇叭', '出聲', '音色'],
    },
    claims: [{ expr: 'typeof startSound', equals: 'function' }],
  },

  stopSound: {
    group: 'sound',
    aliases: ['OAVp5.sound.stop'],
    summary: {
      en: 'Turns sound off and lets every ringing note go; the instrument stays loaded, so `startSound()` brings it back at once.',
      zh: '關掉聲音，讓正在響的音全部放開，樂器還留在記憶體裡，所以再呼叫 `startSound()` 馬上就回來。',
    },
    params: [],
    returns: { type: 'Promise<Boolean>', en: 'A promise that is already resolved to `false`, the new state of the sound.', zh: '一個已經 resolve 成 `false` 的 promise，`false` 就是聲音的新狀態。' },
    description: [
      {
        en: 'It releases every note that is ringing, sets [`soundIsOn`](#soundIsOn) to `false` and [`OAVp5.sound.state`](#OAVp5.sound.state) to `\'off\'`. Notes you play afterwards are not heard (the sketch\'s [`notePressed()`](#notePressed) is still called). Tone.js and the instrument stay loaded: [`startSound()`](#startSound) afterwards is on again at once, without a new download and without waiting for another click.',
        zh: '它會放開所有正在響的音，把 [`soundIsOn`](#soundIsOn) 設成 `false`，[`OAVp5.sound.state`](#OAVp5.sound.state) 設成 `\'off\'`。之後彈的音聽不到（草圖的 [`notePressed()`](#notePressed) 照樣會被呼叫）。Tone.js 和樂器都還載著，所以之後再呼叫 [`startSound()`](#startSound) 會馬上開，不用重新下載，也不用再等一次點擊。',
      },
      {
        en: 'It also works while sound is still loading or waiting for the first click: the pending [`startSound()`](#startSound) then resolves to `false`.',
        zh: '聲音還在載入、或還在等第一次點擊的時候呼叫也可以：還沒結束的 [`startSound()`](#startSound) 會 resolve 成 `false`。',
      },
    ],
    notes: [
      {
        en: 'It does not touch the drum machine (use [`stopDrums()`](#stopDrums)) or the microphone ([`stopMic()`](#stopMic)).',
        zh: '它不會動到鼓機（要用 [`stopDrums()`](#stopDrums)），也不會動到麥克風（[`stopMic()`](#stopMic)）。',
      },
    ],
    examples: [
      {
        code: `function setup() {
  createCanvas(400, 300);
  startSound('synth/pluck');
  textAlign(CENTER, CENTER);
}

function keyPressed() {
  if (key === 's') {
    if (soundIsOn) stopSound(); else startSound();
  }
}

function draw() {
  background(soundIsOn ? 40 : 100);
  fill(255);
  text('press s: sound is ' + (soundIsOn ? 'on' : 'off'), width / 2, height / 2);
}`,
        caption: { en: 'Press s to switch sound off and on; the background is dark while sound is on.', zh: '按 s 把聲音關掉再打開，聲音開著的時候背景是暗的。' },
      },
    ],
    related: ['startSound', 'soundIsOn', 'OAVp5.sound.state', 'stopDrums', 'stopMic'],
    keywords: {
      en: ['sound', 'stop', 'off', 'mute', 'silence', 'audio', 'release notes'],
      zh: ['聲音', '停止', '關閉', '靜音', '關掉聲音', '放開'],
    },
    claims: [{ before: 'stopSound()', expr: 'OAVp5.sound.state', equals: 'off' }],
  },

  soundIsOn: {
    group: 'sound',
    summary: {
      en: 'Whether notes are being heard right now: true once `startSound()` has finished, false before and after.',
      zh: '現在彈的音有沒有被聽到：`startSound()` 完成之後是 true，之前和之後都是 false。',
    },
    value: {
      type: 'Boolean',
      en: 'True only while [`OAVp5.sound.state`](#OAVp5.sound.state) is `\'on\'`. It is false at the start, while sound waits for a click, while it loads, after [`stopSound()`](#stopSound) and after an error.',
      zh: '只有 [`OAVp5.sound.state`](#OAVp5.sound.state) 是 `\'on\'` 的時候才是 true。一開始、等待點擊、載入中、呼叫 [`stopSound()`](#stopSound) 之後、以及出錯的時候都是 false。',
    },
    description: [
      {
        en: 'Read it in `draw()` like `mouseIsPressed`: `if (!soundIsOn) text(\'click to hear\', 20, 30);`. It changes only when the state of the sound changes, not every frame. Reading it never starts anything (unlike [`micLevel`](#micLevel)), so it is safe to check anywhere.',
        zh: '像 `mouseIsPressed` 一樣在 `draw()` 裡讀：`if (!soundIsOn) text(\'click to hear\', 20, 30);`。它只有在聲音的狀態改變的時候才會變，不是每個畫面都更新。讀它不會啟動任何東西（跟 [`micLevel`](#micLevel) 不一樣），所以在哪裡檢查都安全。',
      },
      {
        en: '`false` does not mean `startSound()` was never called. To tell "loading" from "waiting for the click" from "failed", read [`OAVp5.sound.state`](#OAVp5.sound.state), and [`OAVp5.sound.error`](#OAVp5.sound.error) for the reason of a failure.',
        zh: '`false` 不代表沒呼叫過 `startSound()`。要分辨「載入中」、「等點擊」和「失敗」，請讀 [`OAVp5.sound.state`](#OAVp5.sound.state)，失敗的原因在 [`OAVp5.sound.error`](#OAVp5.sound.error)。',
      },
    ],
    needs: {
      en: 'It becomes true only after [`startSound()`](#startSound) (or 🔊 in the 🎹 panel, or `?oav_sound=piano`), and after the click the browser wants.',
      zh: '要先呼叫 [`startSound()`](#startSound)（或按 🎹 面板的 🔊、或網址加 `?oav_sound=piano`），而且過了瀏覽器要求的那次點擊，它才會變成 true。',
    },
    notes: [
      {
        en: 'A sketch that already declares its own variable called `soundIsOn` keeps it: oav-p5 leaves the name alone and a card says to read `OAVp5.sound.state === \'on\'` instead.',
        zh: '如果草圖本來就宣告了自己的 `soundIsOn` 變數，就用你的：oav-p5 不動這個名稱，並用一張卡片提醒你改讀 `OAVp5.sound.state === \'on\'`。',
      },
    ],
    examples: [
      {
        code: `function setup() {
  createCanvas(400, 300);
  startSound('organ');
}

function draw() {
  background(20);
  fill(soundIsOn ? color(120, 220, 140) : color(220, 160, 60));
  circle(width / 2, height / 2, 80);
  fill(255);
  textAlign(CENTER);
  text(soundIsOn ? 'sound is on' : 'click the canvas to turn sound on', width / 2, height - 40);
}`,
        caption: { en: 'An amber circle until you click, then a green one: that is the moment [`soundIsOn`](#soundIsOn) turns true.', zh: '點擊之前是琥珀色的圓，點了之後變綠色：那一刻就是 `soundIsOn` 變成 true 的時候。' },
      },
    ],
    related: ['startSound', 'stopSound', 'OAVp5.sound.state', 'micIsOn', 'drumsAreOn', 'recordingIsOn'],
    keywords: {
      en: ['sound', 'on', 'status', 'audio', 'enabled', 'ready', 'playing'],
      zh: ['聲音', '開著', '狀態', '準備好', '有沒有出聲'],
    },
    claims: [{ expr: 'soundIsOn', equals: false }],
  },

  'OAVp5.sound': {
    group: 'sound',
    summary: {
      en: 'The object behind the sound names: the state, the instrument, the error, the loading progress and the loaded parts of @openav/sound.',
      zh: '聲音相關名稱背後的物件：狀態、樂器、錯誤、載入進度，以及載入進來的 @openav/sound 各部分。',
    },
    description: [
      {
        en: '`OAVp5.sound` (also reachable as `midi.sound`) is what [`startSound()`](#startSound), [`stopSound()`](#stopSound) and [`soundIsOn`](#soundIsOn) are built on. Read [`state`](#OAVp5.sound.state) to know where sound is, [`instrument`](#OAVp5.sound.instrument) for what you hear, [`status`](#OAVp5.sound.status) for the loading progress and [`error`](#OAVp5.sound.error) for a failure. `start(id)` and `stop()` are the same as the two global functions. [`shell`](#OAVp5.sound.shell), `engine` and `module` hand you the loaded @openav/sound parts for the rare case that you need them.',
        zh: '`OAVp5.sound`（也可以用 `midi.sound` 取得）是 [`startSound()`](#startSound)、[`stopSound()`](#stopSound) 和 [`soundIsOn`](#soundIsOn) 的底層。讀 [`state`](#OAVp5.sound.state) 知道聲音在哪個階段，[`instrument`](#OAVp5.sound.instrument) 是你聽到的樂器，[`status`](#OAVp5.sound.status) 是載入進度，[`error`](#OAVp5.sound.error) 是失敗的原因。`start(id)` 和 `stop()` 跟那兩個全域函式一模一樣。[`shell`](#OAVp5.sound.shell)、`engine`、`module` 把載入進來的 @openav/sound 各部分交給你，給少數真的需要的情況。',
      },
    ],
    notes: [
      {
        en: 'For a sketch the global names are enough. This object is for tools, the console and debugging: `OAVp5.sound.state` is the first thing to look at when nothing is heard.',
        zh: '一般草圖用全域名稱就夠了。這個物件是給工具、主控台和除錯用的：聽不到聲音的時候，先看 `OAVp5.sound.state`。',
      },
    ],
    examples: [
      {
        code: `function setup() {
  createCanvas(400, 300);
  startSound('harp');
}

function draw() {
  background(20);
  fill(255);
  const s = OAVp5.sound;
  text('state: ' + s.state, 20, 30);
  text('instrument: ' + s.instrument, 20, 60);
  text('error: ' + s.error, 20, 90);
}`,
        caption: { en: 'Three lines of the sound object: the state goes from "loading" or "waiting" to "on" after the first click.', zh: '聲音物件的三個欄位：狀態會從 "loading" 或 "waiting"，在第一次點擊之後變成 "on"。' },
      },
    ],
    related: ['startSound', 'stopSound', 'soundIsOn', 'OAVp5.sound.state', 'OAVp5.sound.status', 'OAVp5.drums', 'OAVp5.record'],
    keywords: {
      en: ['OAVp5.sound', 'sound object', 'midi.sound', 'sound state', 'debug', 'instrument', 'status'],
      zh: ['聲音物件', '聲音狀態', '除錯', '樂器', '載入進度'],
    },
  },

  'OAVp5.sound.state': {
    group: 'sound',
    summary: {
      en: 'Where sound is: `\'off\'`, `\'waiting\'` (for a click), `\'loading\'`, `\'on\'` or `\'error\'`.',
      zh: '聲音現在在哪個階段：`\'off\'`、`\'waiting\'`（等點擊）、`\'loading\'`、`\'on\'` 或 `\'error\'`。',
    },
    value: {
      type: 'String', range: 'off | waiting | loading | on | error',
      en: 'Starts as `\'off\'` and changes whenever the sound moves to another stage.',
      zh: '一開始是 `\'off\'`，聲音換到另一個階段的時候就跟著變。',
    },
    description: [
      {
        en: '`\'off\'` is where it starts and where [`stopSound()`](#stopSound) leaves it. [`startSound()`](#startSound) moves it to `\'loading\'` while @openav/sound and Tone.js arrive, to `\'waiting\'` when everything is ready but the browser has not yet had its click, and to `\'on\'` when notes are heard. `\'error\'` means the sound parts could not be loaded (a network, a school firewall or an ad blocker); the message is in [`OAVp5.sound.error`](#OAVp5.sound.error), and calling `startSound()` again tries once more.',
        zh: '`\'off\'` 是起點，也是 [`stopSound()`](#stopSound) 之後的狀態。呼叫 [`startSound()`](#startSound) 之後，@openav/sound 和 Tone.js 還在下載的時候是 `\'loading\'`，東西都到齊但瀏覽器還沒等到那次點擊的時候是 `\'waiting\'`，聽得到音符的時候是 `\'on\'`。`\'error\'` 表示聲音的部分載入失敗（網路、學校的防火牆或廣告攔截器）。訊息在 [`OAVp5.sound.error`](#OAVp5.sound.error)，再呼叫一次 `startSound()` 會重試。',
      },
      {
        en: '[`soundIsOn`](#soundIsOn) is the same thing reduced to `state === \'on\'`.',
        zh: '[`soundIsOn`](#soundIsOn) 就是把它縮成 `state === \'on\'` 的版本。',
      },
    ],
    examples: [
      {
        code: `function setup() {
  createCanvas(400, 300);
  startSound('marimba');
  textAlign(CENTER, CENTER);
  textSize(28);
}

function draw() {
  background(20);
  const hints = { off: 'off', loading: 'loading…', waiting: 'click to hear', on: 'listening', error: 'failed' };
  fill(255);
  text(hints[OAVp5.sound.state], width / 2, height / 2);
}`,
        caption: { en: 'One word for each stage; "click to hear" is what the sketch shows between a ready sound and the first click.', zh: '每個階段一句話，聲音準備好、但還沒點擊的那段時間，畫面會顯示 "click to hear"。' },
      },
    ],
    related: ['soundIsOn', 'startSound', 'stopSound', 'OAVp5.sound.error', 'OAVp5.sound.status'],
    keywords: {
      en: ['sound state', 'waiting', 'loading', 'error', 'off', 'on', 'status'],
      zh: ['聲音狀態', '等待', '載入中', '錯誤', '開關'],
    },
    claims: [{ expr: 'OAVp5.sound.state', equals: 'off' }],
  },

  'OAVp5.sound.instrument': {
    group: 'sound',
    summary: {
      en: 'The id of the instrument you hear right now, or `null` before sound has loaded.',
      zh: '你現在聽到的樂器代號，聲音還沒載入的時候是 `null`。',
    },
    value: {
      type: 'String | null',
      en: 'Changes when the instrument changes, which for a sampled instrument is when its samples are in.',
      zh: '樂器換了才會變，取樣型的樂器則是等取樣到齊的時候才換。',
    },
    description: [
      {
        en: 'After a first [`startSound(\'piano\')`](#startSound) the piano\'s samples (about 2 MB) download first, and the electric piano plays meanwhile, so the first key is never silent: `instrument` says `\'epiano\'` until the piano is ready and `\'piano\'` after. When you switch to the piano from another instrument, that one keeps sounding and `instrument` names it until the samples are in. How far the loading is, and which instrument it is on, is in [`OAVp5.sound.status`](#OAVp5.sound.status).',
        zh: '第一次呼叫 [`startSound(\'piano\')`](#startSound) 的時候，鋼琴的取樣（約 2 MB）要先下載，這段時間由電鋼琴頂著，所以第一個鍵不會沒聲音：鋼琴準備好之前 `instrument` 是 `\'epiano\'`，之後才是 `\'piano\'`。如果是從別的樂器切到鋼琴，取樣到齊之前原本那個樂器繼續響，`instrument` 也還是它的名字。載到哪裡、載的是哪個樂器，看 [`OAVp5.sound.status`](#OAVp5.sound.status)。',
      },
    ],
    examples: [
      {
        code: `function setup() {
  createCanvas(400, 300);
  startSound('piano');
  textAlign(CENTER, CENTER);
}

function draw() {
  background(20);
  fill(255);
  text(OAVp5.sound.instrument || 'nothing loaded yet', width / 2, height / 2);
}`,
        caption: { en: 'Shows the instrument you hear: epiano while the piano samples arrive, then piano.', zh: '顯示你聽到的樂器：鋼琴取樣下載的時候是 epiano，之後變成 piano。' },
      },
    ],
    related: ['startSound', 'OAVp5.sound.status', 'OAVp5.sound.state'],
    keywords: {
      en: ['instrument', 'current instrument', 'piano', 'epiano', 'preset', 'sound'],
      zh: ['樂器', '目前樂器', '音色', '鋼琴', '電鋼琴'],
    },
    claims: [{ expr: 'OAVp5.sound.instrument', equals: 'null' }],
  },

  'OAVp5.sound.error': {
    group: 'sound',
    summary: {
      en: 'The message of the last thing that went wrong while loading sound, or `null` when nothing has.',
      zh: '載入聲音的時候，最近一次出錯的訊息，沒出過錯就是 `null`。',
    },
    value: {
      type: 'String | null',
      en: 'Set when the state becomes `\'error\'`. It stays until the page is reloaded: a later try that works does not clear it.',
      zh: '狀態變成 `\'error\'` 的時候設定。它會一直留到頁面重新載入：之後重試成功也不會清掉。',
    },
    description: [
      {
        en: 'It is the error the browser reported when @openav/sound or Tone.js could not be loaded. A card beside the 🎹 already tells the person at the keyboard what to do (try another network, or point the `tone` option at another copy of Tone.js); read this value to log it or to show your own message. To know whether sound is failing right now, use [`OAVp5.sound.state`](#OAVp5.sound.state), not this.',
        zh: '這是 @openav/sound 或 Tone.js 載入失敗的時候，瀏覽器回報的錯誤。🎹 旁邊的卡片已經告訴現場的人該怎麼辦（換一個網路，或把 `tone` 選項指到另一份 Tone.js）。讀這個值是為了記錄下來，或顯示你自己的訊息。要知道聲音現在是不是在出錯，看 [`OAVp5.sound.state`](#OAVp5.sound.state)，不要看這個。',
      },
    ],
    examples: [
      {
        code: `function setup() {
  createCanvas(400, 300);
  startSound('strings');
  textAlign(CENTER, CENTER);
}

function draw() {
  background(OAVp5.sound.error ? color(120, 30, 30) : 20);
  fill(255);
  text(OAVp5.sound.error ? OAVp5.sound.error : 'no error', width / 2, height / 2);
}`,
        caption: { en: 'Stays on "no error" when sound loads; if Tone.js cannot be reached the background turns red and the message is printed.', zh: '聲音載入正常的時候一直是 "no error"，如果連不到 Tone.js，背景會變紅並印出訊息。' },
      },
    ],
    related: ['OAVp5.sound.state', 'startSound', 'soundIsOn'],
    keywords: {
      en: ['sound error', 'failed', 'could not load', 'tone.js', 'network', 'debug'],
      zh: ['聲音錯誤', '載入失敗', '連不到', '網路', '除錯'],
    },
    claims: [{ expr: 'OAVp5.sound.error', equals: 'null' }],
  },

  'OAVp5.sound.status': {
    group: 'sound',
    summary: {
      en: 'How the instrument is loading: `{ id, state, progress, error }`, with `progress` from 0 to 1.',
      zh: '樂器載入得怎麼樣了：`{ id, state, progress, error }`，其中 `progress` 從 0 到 1。',
    },
    value: {
      type: 'Object', range: '{ id, state: idle | loading | ready | error, progress: 0..1, error }',
      en: 'A new object on every read. `id` is the instrument the loader is working on, `state` is `\'idle\'` before anything loads, `\'loading\'`, `\'ready\'` or `\'error\'`, and `progress` is the fraction of the files loaded.',
      zh: '每次讀都是一個新的物件。`id` 是載入器現在處理的樂器，`state` 在還沒載任何東西時是 `\'idle\'`，之後是 `\'loading\'`、`\'ready\'` 或 `\'error\'`，`progress` 是檔案載入的比例。',
    },
    description: [
      {
        en: 'It is about the instrument, not about the whole sound: [`OAVp5.sound.state`](#OAVp5.sound.state) is the whole sound. Only the `piano` has files to load, so for every other instrument `progress` is 1 almost at once. While a sampler loads, [`OAVp5.sound.instrument`](#OAVp5.sound.instrument) is still the one you hear and `status.id` is the one on its way (at the very first call it may name the electric piano that stands in, and then the piano).',
        zh: '它講的是樂器，不是整個聲音：整個聲音的狀態是 [`OAVp5.sound.state`](#OAVp5.sound.state)。只有 `piano` 有檔案要載，所以其他樂器的 `progress` 幾乎馬上就是 1。取樣型樂器載入的時候，[`OAVp5.sound.instrument`](#OAVp5.sound.instrument) 仍是你現在聽到的那個，`status.id` 才是正在路上的那個（第一次呼叫的時候，一開始可能先是頂替用的電鋼琴，之後才是鋼琴）。',
      },
    ],
    examples: [
      {
        code: `function setup() {
  createCanvas(400, 300);
  startSound('piano');
  noStroke();
}

function draw() {
  background(20);
  const s = OAVp5.sound.status;
  fill(60);
  rect(40, 140, 320, 16);
  fill(120, 220, 140);
  rect(40, 140, 320 * s.progress, 16);
  fill(255);
  text(s.id + ': ' + s.state, 40, 120);
}`,
        caption: { en: 'A progress bar for the piano samples; it fills within a few seconds and the label changes to "ready".', zh: '鋼琴取樣的進度條，幾秒內會填滿，標籤變成 "ready"。' },
      },
    ],
    related: ['OAVp5.sound.instrument', 'OAVp5.sound.state', 'startSound'],
    keywords: {
      en: ['loading progress', 'progress', 'samples', 'piano loading', 'status', 'ready'],
      zh: ['載入進度', '進度條', '取樣', '鋼琴載入', '準備好'],
    },
  },

  'OAVp5.sound.shell': {
    group: 'oavp5',
    aliases: ['OAVp5.sound.engine', 'OAVp5.sound.module'],
    summary: {
      en: 'The loaded parts of @openav/sound: the `Sound` shell, its Tone.js engine and the module itself. All three are `null` until sound has loaded.',
      zh: '載入進來的 @openav/sound 各部分：`Sound` 外殼、它的 Tone.js 引擎，以及模組本身。聲音載入之前三個都是 `null`。',
    },
    value: {
      type: 'Object | null',
      en: 'Set once, when [`startSound()`](#startSound) has loaded @openav/sound (the engine and the shell at the same moment, the module a little before). `null` before that, and after a failed load.',
      zh: '[`startSound()`](#startSound) 載入 @openav/sound 之後設定一次（引擎和外殼同時，模組稍微早一點）。在那之前，或載入失敗之後，都是 `null`。',
    },
    description: [
      {
        en: '`OAVp5.sound.shell` is the `Sound` instance of [@openav/sound](#Sound), `OAVp5.sound.engine` is the Tone.js engine it plays through (`noteOn`, `noteOff`, `sustain`, `releaseAll`, `setInstrument`) and `OAVp5.sound.module` is the whole module, for example `OAVp5.sound.module.listInstruments()`, which lists every instrument id. They are advanced handles: the sketch-level names ([`startSound()`](#startSound), [`soundIsOn`](#soundIsOn)) cover everything a sketch normally needs.',
        zh: '`OAVp5.sound.shell` 是 [@openav/sound](#Sound) 的 `Sound` 實例，`OAVp5.sound.engine` 是它用來發聲的 Tone.js 引擎（`noteOn`、`noteOff`、`sustain`、`releaseAll`、`setInstrument`），`OAVp5.sound.module` 是整個模組，例如 `OAVp5.sound.module.listInstruments()` 會列出所有樂器代號。它們是進階的把手：草圖層級的名稱（[`startSound()`](#startSound)、[`soundIsOn`](#soundIsOn)）已經涵蓋草圖平常需要的一切。',
      },
    ],
    needs: {
      en: 'Call [`startSound()`](#startSound) first and wait until [`OAVp5.sound.state`](#OAVp5.sound.state) is no longer `\'loading\'`, or check for `null` before you use them.',
      zh: '先呼叫 [`startSound()`](#startSound)，等 [`OAVp5.sound.state`](#OAVp5.sound.state) 離開 `\'loading\'` 之後再用，也可以在使用之前先檢查它是不是 `null`。',
    },
    examples: [
      {
        code: `let ids = [];

function setup() {
  createCanvas(400, 300);
  startSound('synth/pluck');
}

function draw() {
  background(20);
  fill(255);
  textSize(12);
  if (!ids.length && OAVp5.sound.module) ids = OAVp5.sound.module.listInstruments().map((d) => d.id);
  text(ids.length ? ids.join(', ') : 'loading…', 20, 20, width - 40, height - 40);
}`,
        caption: { en: 'Lists every instrument id that [`startSound()`](#startSound) accepts, as soon as the module has loaded.', zh: '模組一載入，就列出 [`startSound()`](#startSound) 接受的所有樂器代號。' },
      },
    ],
    related: ['OAVp5.sound', 'startSound', 'OAVp5.sound.state'],
    keywords: {
      en: ['sound shell', 'engine', 'module', 'listInstruments', 'tone engine', 'instrument list', 'advanced'],
      zh: ['聲音外殼', '引擎', '模組', '樂器清單', '進階'],
    },
    claims: [{ expr: 'OAVp5.sound.shell', equals: 'null' }],
  },
};
