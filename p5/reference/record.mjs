// oav-p5 reference: recording (startRecording, recordingIsOn, recordingSaved, OAVp5.record). Read by tools/build-reference.mjs
// (see AGENTS.md, "Documenting a public name"). The keys are the public names the code has (tools/reference/scan.mjs reads them);
// a key the code does not have is a red test.
// Sketch examples leave out the loader line: the page puts it on top when you copy or run. None of them records by itself
// (a take downloads a file), so each waits for a key press.

export default {
  startRecording: {
    group: 'record',
    aliases: ['OAVp5.record.start'],
    summary: {
      en: 'Records the canvas and the sound your sketch makes into one video file, and returns a promise that says whether the recording began.',
      zh: '把畫布和草圖發出的聲音錄成一支影片檔，並回傳一個 promise，告訴你錄影有沒有開始。',
    },
    params: [
      {
        name: 'o', type: 'Number | Object', optional: true,
        en: 'A number is the length in seconds: `startRecording(10)` stops by itself after ten. An object can hold `seconds` (the same, never more than the longest take, 300 by default), `fps` (frames a second, at most 60, 30 by default), `mic` (`false` keeps the microphone out of the video), `name` (a word for the file name), `canvas` (the canvas to record: a `<canvas>`, a p5 canvas or a `createGraphics()` buffer; the biggest p5 canvas on the page by default) and `bitrate` (bits a second). Leave it out to record until [`stopRecording()`](#stopRecording).',
        zh: '給數字就是秒數：`startRecording(10)` 錄十秒後自己停。給物件的話，可以放 `seconds`（同樣是秒數，不會超過一支影片的長度上限，預設 300）、`fps`（每秒幾格，最多 60，預設 30）、`mic`（`false` 就不把麥克風錄進影片）、`name`（檔名裡的一個詞）、`canvas`（要錄的畫布：`<canvas>`、p5 畫布或 `createGraphics()` 的緩衝區，預設是頁面上最大的那張 p5 畫布）和 `bitrate`（每秒幾位元）。不傳就一直錄到呼叫 [`stopRecording()`](#stopRecording)。',
      },
    ],
    returns: {
      type: 'Promise<Boolean>',
      en: 'Resolves to `true` once the recording is running (or when one already is). Resolves to `false` when the loading option `record` is `off`, when there is no canvas to record, when this browser has no `MediaRecorder`, or when it could not start; a card says why.',
      zh: '錄影開始之後 resolve 成 `true`（已經在錄的話也是 `true`）。載入選項 `record` 是 `off`、找不到要錄的畫布、這個瀏覽器沒有 `MediaRecorder`、或是啟動失敗的時候，resolve 成 `false`，並且會有一張卡片說明原因。',
    },
    description: [
      {
        en: 'Start it from a key or a click: `if (key === \'r\') startRecording();`. What goes into the video is the canvas alone, at its own pixel size (a retina screen doubles it), and everything your sketch sounds like: the instrument of [`startSound()`](#startSound), the drum machine, the pads, the microphone while it is on, and p5.sound 1.x, mixed into one track while the speakers play as before. The 🎹, the drum grid and the cards are part of the page, not of the canvas, so they are never in the video. A sound that comes on during the take joins it.',
        zh: '從按鍵或點擊啟動：`if (key === \'r\') startRecording();`。進影片的只有畫布本身（用畫布自己的像素大小，視網膜螢幕會是兩倍），加上你的草圖發出的所有聲音：[`startSound()`](#startSound) 的樂器、鼓機、打擊墊、開著的麥克風、p5.sound 1.x，混成一條音軌，喇叭照常播放。🎹、鼓機格子和提示卡片是頁面的一部分，不在畫布上，所以不會出現在影片裡。錄到一半才開起來的聲音也會加入。',
      },
      {
        en: 'The file is MP4 (H.264 + AAC, which Instagram, YouTube and every editor take) where the browser can write it, and WebM where not; a card says Instagram will not take a WebM. It is named `oav-20261015-183005.mp4`, with `name` in the middle when you give one. When the take is done it is downloaded, and on a phone that can share files a Share button appears on the card. After [`stopRecording()`](#stopRecording), or when `seconds` has run out, [`recordingSaved(info)`](#recordingSaved) is called with the details. Without `seconds` a take stops by itself at the longest length (300 seconds unless the `reclimit` option says otherwise).',
        zh: '瀏覽器寫得出 MP4 的話，檔案就是 MP4（H.264 + AAC，Instagram、YouTube 和所有剪輯軟體都吃），不然就是 WebM，這時會有卡片說 Instagram 不收 WebM。檔名像 `oav-20261015-183005.mp4`，有給 `name` 的話會放在中間。錄完會自動下載，在能分享檔案的手機上，卡片會出現「分享」按鈕。呼叫 [`stopRecording()`](#stopRecording) 之後，或 `seconds` 時間到了，會呼叫 [`recordingSaved(info)`](#recordingSaved) 並把細節交給它。沒給 `seconds` 的話，錄到最長長度就會自己停（預設 300 秒，載入選項 `reclimit` 可以改）。',
      },
      {
        en: 'Without `bitrate` the quality follows the canvas: 0.16 bits per pixel per frame, kept between 4 and 16 megabits a second (24 above 30 frames a second). Calling `startRecording()` while a take is running starts nothing new. After every take a card says what was recorded and, when something looks wrong, what and why: nothing reached the sound track although a sound was on, WebM, a file that is almost empty, a black video of a canvas that was not black.',
        zh: '沒給 `bitrate` 的話，畫質跟著畫布大小走：每個像素、每一格 0.16 位元，限制在每秒 4 到 16 百萬位元之間（每秒超過 30 格時是 24）。已經在錄的時候再呼叫 `startRecording()`，不會開新的一支。每支錄完之後，卡片會說錄了什麼，有地方不對的話還會說是什麼、為什麼：有聲音開著、卻沒有任何東西進到音軌、WebM、幾乎是空的檔案、畫布明明不是黑的、影片卻是黑的。',
      },
    ],
    needs: {
      en: 'A browser that has `MediaRecorder`: where it is missing, a card says so and the promise resolves to `false`. The picture is recorded at once, but the page can only make sound after a click or key press on it, so a take that begins before the first one has nothing to hear at first. A canvas that shows an image from another site (no CORS) cannot be recorded, and a card says so.',
      zh: '瀏覽器要有 `MediaRecorder`，沒有的話會跳出卡片說明，promise 也會 resolve 成 `false`。畫面馬上就錄，但頁面要有一次點擊或按鍵之後才能發聲，所以在第一次點擊之前開始的錄影，一開始是沒有聲音可錄的。畫布上如果有別的網站來的圖片（沒有 CORS），就錄不了，卡片會告訴你。',
    },
    notes: [
      {
        en: 'In the 🎹 panel, ⏺ starts and stops a take with no code, and 📷 saves the canvas as a PNG (see [`OAVp5.record.shot()`](#OAVp5.record.shot)). While a take runs the 🎹 button shows a red dot and the time. The loading options [`record`](#option-record) (`on`, `nomic` or `off`), `recfps`, `reclimit` and `title` set the defaults.',
        zh: '在 🎹 面板裡，⏺ 不用寫程式就能開始和停止錄影，📷 把畫布存成 PNG（見 [`OAVp5.record.shot()`](#OAVp5.record.shot)）。錄影的時候，🎹 按鈕上會有紅點和時間。載入選項 [`record`](#option-record)（`on`、`nomic` 或 `off`）、`recfps`、`reclimit`、`title` 可以設定預設值。',
      },
      {
        en: 'The microphone is in the take while it is on: wear headphones, or the speakers are recorded twice. p5.sound for p5 2.x connects each sound straight to the speakers, so it cannot be recorded (a card says so); use p5 1.11, or [`startSound()`](#startSound) and [`startDrums()`](#startDrums). Sound that your sketch makes with its own Tone.js or Web Audio code is not recorded either.',
        zh: '麥克風開著的時候會錄進影片：請戴耳機，不然喇叭的聲音會被錄兩次。p5 2.x 用的 p5.sound 把每個聲音直接接到喇叭，沒辦法錄（卡片會說明），請改用 p5 1.11，或用 [`startSound()`](#startSound) 和 [`startDrums()`](#startDrums)。草圖自己用 Tone.js 或 Web Audio 程式發出的聲音，同樣不會被錄進去。',
      },
      {
        en: 'Whatever you draw on the canvas is in the video, so show hints only while [`recordingIsOn`](#recordingIsOn) is false.',
        zh: '畫在畫布上的東西都會進影片，所以提示文字只在 [`recordingIsOn`](#recordingIsOn) 是 false 的時候畫。',
      },
    ],
    examples: [
      {
        code: `function setup() {
  createCanvas(400, 300);
}

function keyPressed() {
  if (key === 'r') startRecording(5);   // five seconds, then it stops and downloads
}

function draw() {
  background(20);
  circle(200 + sin(frameCount * 0.05) * 120, 150, 50);
  if (!recordingIsOn) {
    fill(255);
    text('press r to record 5 seconds', 20, 30);   // not drawn while recording
  }
}`,
        caption: { en: 'Press r: after five seconds an MP4 of the moving circle is downloaded, without the hint text.', zh: '按 r：五秒後會下載一支圓在移動的 MP4，影片裡沒有那行提示文字。' },
      },
      {
        code: `function setup() {
  createCanvas(400, 300);
  startDrums('four on floor', 110);
  startSound('synth/pluck');
}

function keyPressed() {
  if (key === 'r') {
    if (recordingIsOn) stopRecording();
    else startRecording({ name: 'my piece', fps: 60 });
  }
  if (key === 'a') midi.play(60, 0.8);
}

function kickDetected(level) {
  background(255 * level);
}

function draw() {
  background(20);
  if (!recordingIsOn) {
    fill(255);
    text('click once, then: a plays a note, r starts and stops a recording', 20, 30);
  }
}`,
        caption: { en: 'Click once so the browser allows sound, then press r to start and r again to stop: the file holds the picture, the drums and the notes you played.', zh: '先點一下讓瀏覽器允許出聲，再按 r 開始、再按 r 停止：檔案裡有畫面、鼓聲和你彈的音。' },
      },
      {
        code: `let layer;

function setup() {
  createCanvas(400, 300);
  layer = createGraphics(200, 200);
}

function keyPressed() {
  if (key === 'g') startRecording({ canvas: layer, seconds: 3 });   // record the buffer, not the main canvas
}

function draw() {
  background(20);
  layer.background(40);
  layer.circle(100 + sin(frameCount * 0.1) * 60, 100, 40);
  image(layer, 100, 50);
  fill(255);
  text('press g to record the small square only (3 s)', 20, 30);
}`,
        caption: { en: 'Press g: the video is 200 by 200, the buffer alone, not the 400 by 300 canvas.', zh: '按 g：影片是 200 × 200，只有那個緩衝區，不是 400 × 300 的整張畫布。' },
      },
    ],
    related: ['stopRecording', 'recordingIsOn', 'recordingSaved', 'OAVp5.record', 'OAVp5.record.shot', 'startSound', 'startDrums', 'drawRhythm'],
    keywords: {
      en: ['record', 'recording', 'video', 'capture', 'mp4', 'webm', 'screen recording', 'export video', 'instagram', 'canvas', 'mediarecorder'],
      zh: ['錄影', '錄製', '影片', '輸出影片', '擷取', 'mp4', '存成影片', '畫布', '作品影片'],
    },
    claims: [
      { expr: 'recordingIsOn', equals: false },
      { expr: 'OAVp5.record.state', equals: 'off' },
    ],
  },

  stopRecording: {
    group: 'record',
    aliases: ['OAVp5.record.stop'],
    summary: {
      en: 'Stops the recording; the video is finished, downloaded, and handed to `recordingSaved(info)` and to the returned promise.',
      zh: '停止錄影，影片完成後會下載，並交給 `recordingSaved(info)` 和回傳的 promise。',
    },
    params: [],
    returns: {
      type: 'Promise<Object | null>',
      en: 'Resolves, once the file is saved and checked, to the same `info` that [`recordingSaved(info)`](#recordingSaved) gets. Resolves to `null` at once when nothing is recording, or when the recording was still starting (nothing was recorded then).',
      zh: '檔案存好、檢查完之後，resolve 成跟 [`recordingSaved(info)`](#recordingSaved) 拿到的同一份 `info`。沒有在錄、或錄影還在啟動中（那時還沒錄到東西）的時候，馬上 resolve 成 `null`。',
    },
    description: [
      {
        en: 'It ends a take that has no `seconds`, or ends one early. [`recordingIsOn`](#recordingIsOn) turns `false` at once, while the file is made (`OAVp5.record.state` is `\'saving\'` until then), so the promise or [`recordingSaved()`](#recordingSaved) is how you know the file is ready. Both come after a fraction of a second, a little more for a long take.',
        zh: '用來結束沒有給 `seconds` 的錄影，或是提早結束。[`recordingIsOn`](#recordingIsOn) 馬上變成 `false`，檔案這時還在製作（`OAVp5.record.state` 在那之前是 `\'saving\'`），所以要用 promise 或 [`recordingSaved()`](#recordingSaved) 才知道檔案好了。兩者都在不到一秒之後，很長的一支會再久一點。',
      },
    ],
    examples: [
      {
        code: `let message = 'press r to record, r again to stop';

function setup() {
  createCanvas(400, 300);
}

function keyPressed() {
  if (key !== 'r') return;
  if (recordingIsOn) {
    stopRecording().then((info) => {
      if (info) message = 'saved ' + info.name;   // the file is ready
    });
  } else {
    startRecording();
  }
}

function draw() {
  background(20);
  circle(200 + sin(frameCount * 0.05) * 120, 150, 50);
  if (!recordingIsOn) {
    fill(255);
    text(message, 20, 30);
  }
}`,
        caption: { en: 'Press r to start and r to stop: once the file is ready the text names it.', zh: '按 r 開始、再按 r 停止：檔案好了之後，文字會顯示它的檔名。' },
      },
    ],
    related: ['startRecording', 'recordingIsOn', 'recordingSaved', 'OAVp5.record.state'],
    keywords: {
      en: ['stop recording', 'finish', 'end recording', 'save video', 'download'],
      zh: ['停止錄影', '結束錄影', '存成影片', '下載'],
    },
    claims: [{ before: 'stopRecording()', expr: 'OAVp5.record.state', equals: 'off' }],
  },

  recordingIsOn: {
    group: 'record',
    summary: {
      en: 'Whether a recording is running right now.',
      zh: '現在有沒有在錄影。',
    },
    value: {
      type: 'Boolean',
      en: 'True while a take runs. It is false at the start, while the recorder is still loading, from the moment [`stopRecording()`](#stopRecording) is called (the file is then being made) and after the take.',
      zh: '錄影進行中是 true。一開始、錄影程式還在載入、從呼叫 [`stopRecording()`](#stopRecording) 的那一刻起（檔案這時還在製作）、以及錄完之後，都是 false。',
    },
    description: [
      {
        en: 'Use it to keep things out of the video: `if (!recordingIsOn) text(\'press r to record\', 20, 30);`, because everything on the canvas is recorded. Use it for a key that toggles: `recordingIsOn ? stopRecording() : startRecording()`. It changes when a take starts and when it ends, and reading it never starts anything. For the other stages (`starting`, `saving`) read [`OAVp5.record.state`](#OAVp5.record.state).',
        zh: '用它把東西留在影片之外：`if (!recordingIsOn) text(\'press r to record\', 20, 30);`，因為畫布上的所有東西都會被錄進去。也可以用在開關鍵上：`recordingIsOn ? stopRecording() : startRecording()`。它只在錄影開始和結束的時候改變，讀它不會啟動任何東西。想知道其他階段（`starting`、`saving`），請讀 [`OAVp5.record.state`](#OAVp5.record.state)。',
      },
    ],
    notes: [
      {
        en: 'A sketch that declares its own variable called `recordingIsOn` keeps it: oav-p5 leaves the name alone and a card says to read `OAVp5.record.state === \'on\'` instead.',
        zh: '如果草圖本來就宣告了自己的 `recordingIsOn` 變數，就用你的：oav-p5 不動這個名稱，並用一張卡片提醒你改讀 `OAVp5.record.state === \'on\'`。',
      },
    ],
    examples: [
      {
        code: `function setup() {
  createCanvas(400, 300);
  textSize(16);
}

function keyPressed() {
  if (key === 'r') recordingIsOn ? stopRecording() : startRecording();
}

function draw() {
  background(20);
  fill(255, 120, 90);
  circle(200 + sin(frameCount * 0.05) * 120, 150, 50);
  if (!recordingIsOn) {   // the guide never reaches the video
    fill(255);
    text('r: start / stop recording', 20, 30);
  }
}`,
        caption: { en: 'The guide text is on the canvas until you press r, and gone while recording, so the video has only the circle.', zh: '按 r 之前畫布上有說明文字，錄影的時候消失，所以影片裡只有那個圓。' },
      },
    ],
    related: ['startRecording', 'stopRecording', 'OAVp5.record.state', 'soundIsOn', 'drumsAreOn'],
    keywords: {
      en: ['recording', 'is recording', 'status', 'record state', 'on'],
      zh: ['錄影中', '有沒有在錄', '狀態', '錄影狀態'],
    },
    claims: [{ expr: 'recordingIsOn', equals: false }],
  },

  recordingSaved: {
    group: 'record',
    summary: {
      en: 'An event you define: it is called when a recording has been saved and checked, with an `info` object about the file.',
      zh: '一個由你定義的事件函式：錄影存好、檢查完之後呼叫它，帶著一個說明這支檔案的 `info` 物件。',
    },
    params: [
      {
        name: 'info', type: 'Object',
        en: '`name` (the file name), `format` (`\'mp4\'` or `\'webm\'`), `type` (the exact MIME type), `seconds` (length, to a tenth), `bytes`, `width` and `height` (even numbers for MP4), `fps`, `audio` (the video has a sound track), `heard` (something sounded), `sources` (which sounds were in it: `\'sound\'`, `\'drums\'`, `\'mic\'`, `\'p5sound\'`), `warnings` (what looked wrong: `\'recEmpty\'`, `\'recWebm\'`, `\'recNoAudio\'`, `\'recSilent\'`, `\'recBlack\'`, usually an empty list), `blob` (the file) and `url` (an address for the blob).',
        zh: '`name`（檔名）、`format`（`\'mp4\'` 或 `\'webm\'`）、`type`（精確的 MIME 類型）、`seconds`（長度，精確到 0.1 秒）、`bytes`、`width` 和 `height`（MP4 會是偶數）、`fps`、`audio`（影片有沒有音軌）、`heard`（有沒有真的出過聲）、`sources`（錄進去的聲音來源：`\'sound\'`、`\'drums\'`、`\'mic\'`、`\'p5sound\'`）、`warnings`（看起來哪裡不對：`\'recEmpty\'`、`\'recWebm\'`、`\'recNoAudio\'`、`\'recSilent\'`、`\'recBlack\'`，通常是空的）、`blob`（檔案本身）、`url`（blob 的位址）。',
      },
    ],
    description: [
      {
        en: 'Define `function recordingSaved(info) { … }` to know when the file is done: [`stopRecording()`](#stopRecording) or the end of `seconds` leads to it. By then the file has already been handed to the browser to download. The same `info` is given to the promise of `stopRecording()` and to `OAVp5.record.on(\'saved\', fn)`, and stays in [`OAVp5.record.last`](#OAVp5.record.last).',
        zh: '定義 `function recordingSaved(info) { … }`，就知道檔案什麼時候好了：[`stopRecording()`](#stopRecording) 或 `seconds` 時間到之後會走到這裡。那時檔案已經交給瀏覽器下載了。同一份 `info` 也會交給 `stopRecording()` 回傳的 promise 和 `OAVp5.record.on(\'saved\', fn)`，並且留在 [`OAVp5.record.last`](#OAVp5.record.last)。',
      },
      {
        en: '`info.url` works as a link to the file (`createA(info.url, \'play\')` or a `<video>`) until a minute after the next take is saved. `warnings` is what the card after the take says in words; an empty list means nothing looked wrong.',
        zh: '`info.url` 可以當成檔案的連結用（`createA(info.url, \'play\')` 或 `<video>`），直到下一支錄好之後一分鐘為止。`warnings` 是錄完之後卡片用文字說的那些事，空的清單表示沒有哪裡不對。',
      },
    ],
    examples: [
      {
        code: `let saved = '';

function setup() {
  createCanvas(400, 300);
}

function keyPressed() {
  if (key === 'r') startRecording(3);
}

function recordingSaved(info) {
  saved = info.name + '  ' + info.format + '  ' + info.seconds + ' s  ' + round(info.bytes / 1024) + ' KB';
}

function draw() {
  background(20);
  circle(200 + sin(frameCount * 0.05) * 120, 150, 50);
  if (!recordingIsOn) {
    fill(255);
    text(saved || 'press r to record 3 seconds', 20, 30);
  }
}`,
        caption: { en: 'Press r: three seconds later the file is downloaded and its name, format, length and size appear on the canvas.', zh: '按 r：三秒後檔案下載完成，檔名、格式、長度和大小會顯示在畫布上。' },
      },
      {
        code: `let note = '';

function setup() {
  createCanvas(400, 300);
  startDrums('breakbeat', 120);
}

function keyPressed() {
  if (key === 'r') startRecording(4);
}

function recordingSaved(info) {
  note = info.heard ? 'with sound: ' + info.sources.join(', ') : 'silent: click the page before you record';
  if (info.warnings.length) note += '  (' + info.warnings.join(', ') + ')';
}

function draw() {
  background(20);
  fill(255);
  if (!recordingIsOn) text(note || 'click once, then press r', 20, 30);
}`,
        caption: { en: 'Press r (after one click on the page): the text says whether the video has sound, from which sources, and lists anything that looked wrong.', zh: '（先在頁面上點一下）再按 r：文字會說影片有沒有聲音、來自哪些來源，以及有沒有哪裡不對。' },
      },
    ],
    related: ['startRecording', 'stopRecording', 'OAVp5.record.last', 'OAVp5.record.on', 'recordingIsOn'],
    keywords: {
      en: ['recording saved', 'file saved', 'recording done', 'info', 'callback', 'blob', 'download', 'file name'],
      zh: ['錄影存好', '檔案完成', '錄完', '檔案資訊', 'callback', '檔名'],
    },
  },

  'OAVp5.record': {
    group: 'record',
    summary: {
      en: 'The object behind the recording names: the state, the time, the last file, the formats this browser can write and the screenshot function.',
      zh: '錄影相關名稱背後的物件：狀態、時間、最後一支檔案、這個瀏覽器能寫的格式，以及存圖的函式。',
    },
    description: [
      {
        en: '`OAVp5.record` (also reachable as `midi.record`) is what [`startRecording()`](#startRecording), [`stopRecording()`](#stopRecording) and [`recordingIsOn`](#recordingIsOn) are built on. It holds the [`state`](#OAVp5.record.state) of the recording, how many [`seconds`](#OAVp5.record.seconds) it has run, the [`last`](#OAVp5.record.last) file\'s `info`, the [`sources`](#OAVp5.record.sources) in the take, and the [`fps`](#OAVp5.record.fps) and [`limit`](#OAVp5.record.fps) in force. [`formats()`](#OAVp5.record.formats) says what the browser can write, [`shot()`](#OAVp5.record.shot) saves a PNG of the canvas and [`on()`](#OAVp5.record.on) listens to `\'start\'` and `\'saved\'`. `start` and `stop` are the same as the two global functions.',
        zh: '`OAVp5.record`（也可以用 `midi.record` 取得）是 [`startRecording()`](#startRecording)、[`stopRecording()`](#stopRecording) 和 [`recordingIsOn`](#recordingIsOn) 的底層。裡面有錄影的 [`state`](#OAVp5.record.state)、已經錄了多少 [`seconds`](#OAVp5.record.seconds)、[`last`](#OAVp5.record.last) 最後一支檔案的 `info`、這一支裡有哪些聲音來源 [`sources`](#OAVp5.record.sources)，以及生效的 [`fps`](#OAVp5.record.fps) 和 [`limit`](#OAVp5.record.fps)。[`formats()`](#OAVp5.record.formats) 說明瀏覽器能寫什麼格式，[`shot()`](#OAVp5.record.shot) 把畫布存成 PNG，[`on()`](#OAVp5.record.on) 監聽 `\'start\'` 和 `\'saved\'`。`start` 和 `stop` 跟那兩個全域函式一模一樣。',
      },
    ],
    notes: [
      {
        en: 'For a sketch the global names are enough. This object is for tools, the console and debugging.',
        zh: '一般草圖用全域名稱就夠了。這個物件是給工具、主控台和除錯用的。',
      },
    ],
    examples: [
      {
        code: `function setup() {
  createCanvas(400, 300);
  textSize(14);
}

function draw() {
  background(20);
  fill(255);
  const r = OAVp5.record;
  text('state: ' + r.state, 20, 30);
  text('seconds: ' + nf(r.seconds, 1, 1), 20, 60);
  text('limit: ' + r.limit + ' s at ' + r.fps + ' fps', 20, 90);
}`,
        caption: { en: 'Three fields of the recording object; the state stays "off" until a take starts (press ⏺ in the 🎹 panel).', zh: '錄影物件的三個欄位，開始錄影之前狀態一直是 "off"（可以按 🎹 面板裡的 ⏺ 試試）。' },
      },
    ],
    related: ['startRecording', 'stopRecording', 'recordingIsOn', 'OAVp5.sound', 'OAVp5.drums'],
    keywords: {
      en: ['OAVp5.record', 'record object', 'midi.record', 'recording state', 'debug'],
      zh: ['錄影物件', '錄影狀態', '除錯', 'midi.record'],
    },
  },

  'OAVp5.record.state': {
    group: 'record',
    summary: {
      en: 'Where the recording is: `\'off\'`, `\'starting\'`, `\'on\'` or `\'saving\'`.',
      zh: '錄影現在在哪個階段：`\'off\'`、`\'starting\'`、`\'on\'` 或 `\'saving\'`。',
    },
    value: {
      type: 'String', range: 'off | starting | on | saving',
      en: 'Starts as `\'off\'`. A take goes `\'starting\'` (the recorder is loading, the first time), `\'on\'` (recording), `\'saving\'` (the file is being made) and back to `\'off\'`.',
      zh: '一開始是 `\'off\'`。一支錄影會依序是 `\'starting\'`（錄影程式載入中，第一次才會有）、`\'on\'`（錄影中）、`\'saving\'`（檔案製作中），然後回到 `\'off\'`。',
    },
    description: [
      {
        en: '[`recordingIsOn`](#recordingIsOn) is `state === \'on\'`. Read the state when the other stages matter: a button can show "starting…" and "saving…" and refuse a new take while one is being saved.',
        zh: '[`recordingIsOn`](#recordingIsOn) 就是 `state === \'on\'`。其他階段有影響的時候才需要讀它：按鈕可以顯示「啟動中……」和「儲存中……」，在檔案還在存的時候不接受新的一支。',
      },
    ],
    examples: [
      {
        code: `function setup() {
  createCanvas(400, 300);
  textAlign(CENTER, CENTER);
  textSize(28);
}

function keyPressed() {
  if (key === 'r' && OAVp5.record.state === 'off') startRecording(3);
}

function draw() {
  background(20);
  circle(200 + sin(frameCount * 0.05) * 120, 220, 40);
  fill(255);
  text(OAVp5.record.state === 'off' ? 'press r' : OAVp5.record.state, width / 2, 70);
}`,
        caption: { en: 'Press r: the word goes through starting, on and saving and comes back to the prompt; the key does nothing in between.', zh: '按 r：文字依序經過 starting、on、saving，然後回到提示，中間再按 r 沒有作用。' },
      },
    ],
    related: ['recordingIsOn', 'startRecording', 'stopRecording', 'OAVp5.record'],
    keywords: {
      en: ['record state', 'status', 'saving', 'starting', 'recording stage'],
      zh: ['錄影狀態', '儲存中', '啟動中', '錄影階段'],
    },
    claims: [{ expr: 'OAVp5.record.state', equals: 'off' }],
  },

  'OAVp5.record.seconds': {
    group: 'record',
    summary: {
      en: 'How long the running take has been going, in seconds, and the length of the last take after it.',
      zh: '正在錄的這一支已經錄了幾秒，錄完之後是那一支的長度。',
    },
    value: {
      type: 'Number', range: '0 …',
      en: '0 at the start, then refreshed four times a second while recording. When the take is saved it is that take\'s length, and the next take sets it back to 0.',
      zh: '一開始是 0，錄影中每秒更新四次。檔案存好之後是那一支的長度，下一支開始的時候又歸零。',
    },
    description: [
      {
        en: 'Use it as a clock that starts with the take: `const t = recordingIsOn ? OAVp5.record.seconds : 0;` makes an animation that always begins at 0 in the video. It is the time since the recording began, not the time of the sketch, so it does not count the moment before `startRecording()`.',
        zh: '當成跟著這一支錄影一起開始的時鐘：`const t = recordingIsOn ? OAVp5.record.seconds : 0;` 做出來的動畫，在影片裡一定從 0 開始。它是錄影開始之後的時間，不是草圖的時間，所以不包含 `startRecording()` 之前的那段。',
      },
    ],
    examples: [
      {
        code: `function setup() {
  createCanvas(400, 300);
}

function keyPressed() {
  if (key === 'r') startRecording(4);
}

function draw() {
  background(20);
  const t = recordingIsOn ? OAVp5.record.seconds : 0;   // 0 at the first frame of the video
  fill(255, 160, 80);
  circle(40 + t * 80, 150, 40);                         // slides right, 80 px a second
  if (!recordingIsOn) {
    fill(255);
    text('press r: the video starts with the circle at the left', 20, 30);
  }
}`,
        caption: { en: 'Press r: the circle jumps to the left edge and slides right for four seconds, so the video always begins the same way.', zh: '按 r：圓跳到最左邊，往右滑四秒，所以影片每次的開頭都一樣。' },
      },
    ],
    related: ['recordingIsOn', 'OAVp5.record.state', 'startRecording', 'OAVp5.record.last'],
    keywords: {
      en: ['seconds', 'elapsed', 'recording time', 'timer', 'duration', 'clock'],
      zh: ['秒數', '已錄時間', '錄影時間', '計時', '長度'],
    },
    claims: [{ expr: 'OAVp5.record.seconds', equals: 0 }],
  },

  'OAVp5.record.last': {
    group: 'record',
    summary: {
      en: 'The `info` of the last recording that was saved (the same object `recordingSaved` got), or `null` before the first one.',
      zh: '最近一支存好的錄影的 `info`（跟 `recordingSaved` 拿到的是同一個物件），第一支之前是 `null`。',
    },
    value: {
      type: 'Object | null',
      en: 'Replaced each time a take is saved. See [`recordingSaved()`](#recordingSaved) for its fields.',
      zh: '每存好一支就換成新的。欄位見 [`recordingSaved()`](#recordingSaved)。',
    },
    description: [
      {
        en: 'Handy when you did not keep `info` in `recordingSaved()`: show the last file name, or put `OAVp5.record.last.url` in a link. The address stays valid until a minute after the next take is saved.',
        zh: '當你沒有在 `recordingSaved()` 裡把 `info` 存下來的時候很方便：顯示最後一支的檔名，或把 `OAVp5.record.last.url` 放進連結。這個位址會一直有效，直到下一支存好之後一分鐘。',
      },
    ],
    examples: [
      {
        code: `function setup() {
  createCanvas(400, 300);
  textSize(14);
}

function keyPressed() {
  if (key === 'r') startRecording(2);
}

function draw() {
  background(20);
  fill(255);
  const last = OAVp5.record.last;
  text(last ? 'last file: ' + last.name + ' (' + last.seconds + ' s)' : 'nothing recorded yet, press r', 20, 30);
}`,
        caption: { en: 'Press r: two seconds later the last file name appears; press again and it changes.', zh: '按 r：兩秒後會顯示最近一支的檔名，再錄一次它就會換掉。' },
      },
    ],
    related: ['recordingSaved', 'OAVp5.record.seconds', 'stopRecording'],
    keywords: {
      en: ['last recording', 'last take', 'previous file', 'info', 'file name', 'url'],
      zh: ['最近一支', '上一次錄影', '檔名', '連結'],
    },
    claims: [{ expr: 'OAVp5.record.last', equals: 'null' }],
  },

  'OAVp5.record.fps': {
    group: 'record',
    aliases: ['OAVp5.record.limit'],
    summary: {
      en: 'The frame rate (`fps`) and the longest take in seconds (`limit`) that the loading options `recfps` and `reclimit` set.',
      zh: '載入選項 `recfps` 和 `reclimit` 設定的錄影格率（`fps`）和一支影片最長的秒數（`limit`）。',
    },
    value: {
      type: 'Number', range: 'fps 1..60, limit 1 …',
      en: '`fps` is 30 and `limit` is 300 unless the options say otherwise (`fps` is kept between 1 and 60).',
      zh: '`fps` 預設是 30，`limit` 預設是 300，除非載入選項另外設定（`fps` 會被限制在 1 到 60 之間）。',
    },
    description: [
      {
        en: 'They are there to read: `OAVp5.record.limit` tells a sketch how long a take can be. Writing to them changes nothing, because a take reads the options, not these two. To record at another frame rate once, pass `startRecording({ fps: 60 })`; to change the limit, set the `reclimit` option before oav-p5 loads (`window.OAV_P5 = { reclimit: 600 }`).',
        zh: '它們是拿來讀的：`OAVp5.record.limit` 讓草圖知道一支影片最長能錄多久。對它們賦值沒有作用，因為錄影讀的是載入選項，不是這兩個值。想用別的格率錄一次，就傳 `startRecording({ fps: 60 })`，要改長度上限，在 oav-p5 載入之前設定 `reclimit` 選項（`window.OAV_P5 = { reclimit: 600 }`）。',
      },
    ],
    examples: [
      {
        code: `function setup() {
  createCanvas(400, 300);
  textSize(14);
}

function draw() {
  background(20);
  fill(255);
  text('a take is ' + OAVp5.record.fps + ' frames a second', 20, 30);
  text('and at most ' + OAVp5.record.limit + ' seconds (' + OAVp5.record.limit / 60 + ' minutes)', 20, 60);
}`,
        caption: { en: 'Prints the two defaults: 30 frames a second and 300 seconds.', zh: '印出兩個預設值：每秒 30 格、最長 300 秒。' },
      },
    ],
    related: ['startRecording', 'OAVp5.record'],
    keywords: {
      en: ['fps', 'frame rate', 'limit', 'maximum length', 'recfps', 'reclimit', 'longest take'],
      zh: ['格率', '每秒幾格', '長度上限', '最長', 'recfps', 'reclimit'],
    },
    claims: [
      { expr: 'OAVp5.record.fps', equals: 30 },
      { expr: 'OAVp5.record.limit', equals: 300 },
    ],
  },

  'OAVp5.record.shot': {
    group: 'record',
    summary: {
      en: 'Saves the canvas alone as a PNG picture (not the 🎹, not the cards) and downloads it.',
      zh: '把畫布本身存成 PNG 圖片（不包含 🎹 和提示卡片）並下載。',
    },
    params: [
      { name: 'o', type: 'Object', optional: true, en: 'Options: `canvas` (the canvas to save: a `<canvas>`, a p5 canvas or a `createGraphics()` buffer; the biggest p5 canvas on the page by default) and `name` (a word for the file name).', zh: '選項：`canvas`（要存的畫布：`<canvas>`、p5 畫布或 `createGraphics()` 的緩衝區，預設是頁面上最大的 p5 畫布）和 `name`（檔名裡的一個詞）。' },
    ],
    returns: {
      type: 'Promise<Object | null>',
      en: 'Resolves to `{ name, blob, url, width, height, bytes }`, or to `null` when there is no canvas or it cannot be read (an image from another site on it, no CORS).',
      zh: 'resolve 成 `{ name, blob, url, width, height, bytes }`，找不到畫布、或畫布讀不出來（上面有別的網站來的圖片，沒有 CORS）的時候是 `null`。',
    },
    description: [
      {
        en: 'It is the button 📷 in the 🎹 panel as a function. The file is named `oav-20261015-183005.png` (with `name` in the middle when you give one) and is downloaded at once; on a phone that can share files a Share button appears on a card instead. The picture has the size of the canvas in pixels, so a retina screen gives twice the width and height. p5\'s own `saveCanvas(\'name\', \'png\')` does the same thing without the card.',
        zh: '就是 🎹 面板裡 📷 按鈕的函式版。檔名像 `oav-20261015-183005.png`（有給 `name` 的話會放在中間），馬上下載，在能分享檔案的手機上，會改成在卡片上出現「分享」按鈕。圖片的大小就是畫布的像素大小，所以視網膜螢幕的寬和高會是兩倍。p5 自己的 `saveCanvas(\'name\', \'png\')` 做的是同一件事，只是沒有卡片。',
      },
    ],
    notes: [
      {
        en: 'With the loading option `record=off` the 📷 button is gone and [`startRecording()`](#startRecording) does nothing, but this function still saves the PNG (tried).',
        zh: '載入選項 `record=off` 的時候，📷 按鈕會消失，[`startRecording()`](#startRecording) 也什麼都不做，但這個函式仍然可以存 PNG（實際試過）。',
      },
    ],
    examples: [
      {
        code: `function setup() {
  createCanvas(400, 300);
}

function keyPressed() {
  if (key === 'p') OAVp5.record.shot({ name: 'still' });
}

function draw() {
  background(20);
  circle(mouseX, mouseY, 60);
  fill(255);
  text('press p to save a PNG of the canvas', 20, 30);
}`,
        caption: { en: 'Move the circle with the mouse and press p: a PNG of the canvas is downloaded.', zh: '用滑鼠移動圓，按 p：會下載一張畫布的 PNG。' },
      },
    ],
    related: ['startRecording', 'OAVp5.record', 'recordingSaved'],
    keywords: {
      en: ['screenshot', 'png', 'still', 'save image', 'save canvas', 'snapshot', 'picture'],
      zh: ['截圖', 'png', '存圖', '靜態圖', '快照', '存畫布'],
    },
    claims: [{ expr: 'typeof OAVp5.record.shot', equals: 'function' }],
  },

  'OAVp5.record.formats': {
    group: 'record',
    summary: {
      en: 'Says what this browser can record: `{ recorder, mp4, webm, mime }`.',
      zh: '告訴你這個瀏覽器能錄什麼：`{ recorder, mp4, webm, mime }`。',
    },
    params: [],
    returns: {
      type: 'Object',
      en: '`recorder` is true when the browser has `MediaRecorder` at all, `mp4` and `webm` are true when it can write that format, and `mime` is the MIME type a recording asks for first (MP4 where possible), or `\'\'` when none works.',
      zh: '`recorder` 表示瀏覽器到底有沒有 `MediaRecorder`，`mp4` 和 `webm` 表示能不能寫那種格式，`mime` 是錄影最先要求的 MIME 類型（可以的話是 MP4），都不行的話是 `\'\'`。',
    },
    description: [
      {
        en: 'Use it before you offer a recording button, or to tell the person which file they will get: MP4 goes to Instagram and every editor, WebM does not. It asks the browser each time you call it.',
        zh: '在你要提供錄影按鈕之前用它，或是告訴使用的人會拿到哪種檔案：MP4 可以直接上傳 Instagram，也能放進所有剪輯軟體，WebM 不行。每次呼叫都會重新問一次瀏覽器。',
      },
    ],
    examples: [
      {
        code: `function setup() {
  createCanvas(400, 300);
  textSize(14);
}

function draw() {
  background(20);
  fill(255);
  const f = OAVp5.record.formats();
  text('recorder: ' + f.recorder, 20, 30);
  text('mp4: ' + f.mp4 + '   webm: ' + f.webm, 20, 60);
  text('asks for: ' + (f.mime || 'nothing'), 20, 90);
}`,
        caption: { en: 'Shows what this browser can write: Chrome 126 and later and Safari say mp4 true.', zh: '顯示這個瀏覽器能寫的格式：Chrome 126 之後的版本和 Safari 會顯示 mp4 為 true。' },
      },
    ],
    related: ['startRecording', 'OAVp5.record'],
    keywords: {
      en: ['formats', 'mp4', 'webm', 'mime', 'supported', 'mediarecorder', 'browser support'],
      zh: ['格式', 'mp4', 'webm', '支援', '瀏覽器支援', 'MIME'],
    },
    claims: [{ expr: 'OAVp5.record.formats().recorder', equals: true }],
  },

  'OAVp5.record.on': {
    group: 'record',
    summary: {
      en: 'Listens to the recording from anywhere: `OAVp5.record.on(\'saved\', fn)` or `on(\'start\', fn)`, and it returns a function that stops listening.',
      zh: '在任何地方監聽錄影：`OAVp5.record.on(\'saved\', fn)` 或 `on(\'start\', fn)`，並回傳一個可以取消監聽的函式。',
    },
    params: [
      { name: 'name', type: 'String', en: '`\'start\'` (a take began) or `\'saved\'` (a file is saved, like [`recordingSaved()`](#recordingSaved)). Any other name throws an error that lists the two.', zh: '`\'start\'`（一支錄影開始了）或 `\'saved\'`（檔案存好了，跟 [`recordingSaved()`](#recordingSaved) 一樣）。其他的名字會丟出錯誤，並列出這兩個。' },
      { name: 'fn', type: 'Function', en: 'For `\'start\'` it gets `{ width, height, fps, type, seconds }` (`seconds` is 0 when no length was asked for). For `\'saved\'` it gets the same `info` as [`recordingSaved()`](#recordingSaved).', zh: '`\'start\'` 拿到的是 `{ width, height, fps, type, seconds }`（沒指定長度的話 `seconds` 是 0）。`\'saved\'` 拿到的是跟 [`recordingSaved()`](#recordingSaved) 一樣的 `info`。' },
    ],
    returns: { type: 'Function', en: 'A function: call it to stop listening.', zh: '一個函式，呼叫它就停止監聽。' },
    description: [
      {
        en: '[`recordingSaved()`](#recordingSaved) is a single function that you define. `on()` is for the cases where that does not fit: several listeners, a library, a listener you want to remove again. It is the same idea as `OAVp5.drums.on()` and `midi.on()`. An error thrown inside `fn` is printed and the other listeners still run.',
        zh: '[`recordingSaved()`](#recordingSaved) 是你定義的單一函式。`on()` 是給不適用的情況：好幾個監聽者、函式庫、或是想把監聽者再拿掉。概念跟 `OAVp5.drums.on()` 和 `midi.on()` 一樣。`fn` 裡丟出的錯誤會被印出來，其他監聽者照樣執行。',
      },
    ],
    examples: [
      {
        code: `let status = 'press r to record 2 seconds';

function setup() {
  createCanvas(400, 300);
  OAVp5.record.on('start', (i) => { status = 'recording ' + i.width + 'x' + i.height + ' at ' + i.fps + ' fps'; });
  OAVp5.record.on('saved', (i) => { status = 'saved ' + i.name; });
}

function keyPressed() {
  if (key === 'r') startRecording(2);
}

function draw() {
  background(20);
  circle(200 + sin(frameCount * 0.05) * 120, 150, 50);
  if (!recordingIsOn) {
    fill(255);
    text(status, 20, 30);
  }
}`,
        caption: { en: 'Press r: the text reports the start (size and frame rate) and then the saved file name, from two listeners.', zh: '按 r：文字先回報開始錄影（大小和格率），再回報存好的檔名，這是由兩個監聽者做的。' },
      },
    ],
    related: ['recordingSaved', 'startRecording', 'OAVp5.drums.on', 'OAVp5.record'],
    keywords: {
      en: ['listen', 'subscribe', 'event', 'on saved', 'on start', 'listener', 'off'],
      zh: ['監聽', '訂閱', '事件', '取消監聽', '錄影事件'],
    },
    claims: [{ expr: 'typeof OAVp5.record.on(\'saved\', function () {})', equals: 'function' }],
  },

  'OAVp5.record.sources': {
    group: 'record',
    summary: {
      en: 'Which sounds the running take is hearing right now: a list of `\'sound\'`, `\'drums\'`, `\'mic\'` and `\'p5sound\'`; empty when no take runs.',
      zh: '正在錄的這一支現在錄進了哪些聲音：由 `\'sound\'`、`\'drums\'`、`\'mic\'`、`\'p5sound\'` 組成的清單，沒在錄的時候是空的。',
    },
    value: {
      type: 'Array<String>',
      en: 'A new list on every read. `\'sound\'` is the instrument of [`startSound()`](#startSound), `\'drums\'` the drum machine and the pads, `\'mic\'` the microphone, `\'p5sound\'` p5.sound 1.x.',
      zh: '每次讀都是一份新的清單。`\'sound\'` 是 [`startSound()`](#startSound) 的樂器，`\'drums\'` 是鼓機和打擊墊，`\'mic\'` 是麥克風，`\'p5sound\'` 是 p5.sound 1.x。',
    },
    description: [
      {
        en: 'It is what the take has connected, not whether something is audible at this moment. A source that is switched on halfway joins the list within a quarter of a second. After the take, [`recordingSaved()`](#recordingSaved) gives the final list in `info.sources`.',
        zh: '它是這一支已經接上的來源，不是此刻有沒有聲音聽得到。錄到一半才打開的來源，會在四分之一秒內加進清單。錄完之後，最終的清單在 [`recordingSaved()`](#recordingSaved) 的 `info.sources` 裡。',
      },
    ],
    examples: [
      {
        code: `function setup() {
  createCanvas(400, 300);
  startDrums('breakbeat', 120);
  startSound('synth/pluck');
  textSize(14);
}

function keyPressed() {
  if (key === 'r') recordingIsOn ? stopRecording() : startRecording();
}

function draw() {
  background(20);
  fill(255);
  text(recordingIsOn ? 'in the take: ' + OAVp5.record.sources.join(', ') : 'press r to start a take', 20, 30);
}`,
        caption: { en: 'Press r: the text lists what the take has connected, here the drum machine and the instrument.', zh: '按 r：文字列出這一支接上了什麼，這裡是鼓機和樂器。' },
      },
    ],
    related: ['recordingSaved', 'startRecording', 'startSound', 'startDrums', 'startMic'],
    keywords: {
      en: ['sources', 'audio sources', 'what is recorded', 'mic in take', 'tracks'],
      zh: ['來源', '聲音來源', '錄進了什麼', '音軌'],
    },
    claims: [{ expr: 'JSON.stringify(OAVp5.record.sources)', equals: '[]' }],
  },
};
