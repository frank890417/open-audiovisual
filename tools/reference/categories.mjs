// The categories of the API reference: the left column of /docs/reference/ and the `group` of every entry.
//
// Grouped by what you are trying to do, not by file: oav-p5's names and the packages that do the same job
// (micLevel and @openav/audio) sit together, each entry carrying a badge for where it lives. The list is the
// real set of areas the API has; tests/reference.test.js fails when an entry names a category that is not here
// and when a category here has no entry.
//
//   id   anchor (#cat-mic) and the value of an entry's `group`
//   en / zh   the label; hint = one line under the label on the page
export const CATEGORIES = [
  { id: 'midi', en: 'MIDI: knobs, faders, pads, keys', zh: 'MIDI：旋鈕、推桿、打擊墊、琴鍵',
    hint: { en: 'Read a controller like the mouse (knob1, notePressed), and the raw MIDI messages behind it.', zh: '像讀滑鼠一樣讀控制器（knob1、notePressed），以及背後的 MIDI 訊息。' } },
  { id: 'notes', en: 'Note names and pitch', zh: '音名與音高',
    hint: { en: 'C4, c#4, Db3: write a note as a name, convert to number and Hz.', zh: 'C4、c#4、Db3：用音名寫音符，換算成號碼與赫茲。' } },
  { id: 'mic', en: 'Microphone and audio analysis', zh: '麥克風與音訊分析',
    hint: { en: 'How loud (micLevel), bass / mid / treble, beats; @openav/audio underneath.', zh: '多大聲（micLevel）、低中高音、拍子；底層是 @openav/audio。' } },
  { id: 'sound', en: 'Sound and instruments', zh: '聲音與樂器',
    hint: { en: 'Every key you play is heard: startSound(), @openav/sound.', zh: '彈的每個鍵都聽得到：startSound()、@openav/sound。' } },
  { id: 'drums', en: 'Drum machine and rhythm', zh: '鼓機與節奏',
    hint: { en: 'startDrums(), one line of rhythm, drumPhase; @openav/drums and @openav/pattern.', zh: 'startDrums()、一行字寫節奏、drumPhase；@openav/drums 與 @openav/pattern。' } },
  { id: 'timeline', en: 'Timeline, cues and score', zh: '時間軸、cue 與樂譜',
    hint: { en: 'Bars and cues in a sketch; @openav/timeline and @openav/score for a whole show.', zh: '草圖裡的小節與 cue；整場演出用 @openav/timeline 與 @openav/score。' } },
  { id: 'chop', en: 'Values over time (CHOP)', zh: '數值隨時間變化（CHOP）',
    hint: { en: 'lag(), env(), spring(), trail(): the way TouchDesigner shapes a value.', zh: 'lag()、env()、spring()、trail()：像 TouchDesigner 那樣整形一個數值。' } },
  { id: 'record', en: 'Recording', zh: '錄影與錄音',
    hint: { en: 'startRecording(): the canvas and its sound as one video; @openav/record.', zh: 'startRecording()：畫布和聲音錄成一支影片；@openav/record。' } },
  { id: 'options', en: 'Loading options', zh: '載入選項',
    hint: { en: '?oav_mic=click, window.OAV_P5 = { … }: how oav-p5 starts.', zh: '?oav_mic=click、window.OAV_P5 = { … }：oav-p5 怎麼起動。' } },
  { id: 'oavp5', en: 'The OAVp5 object (advanced)', zh: 'OAVp5 物件（進階）',
    hint: { en: 'Everything oav-p5 exposes under OAVp5 and midi: state, subscriptions, the check-up.', zh: 'oav-p5 掛在 OAVp5 與 midi 底下的東西：狀態、訂閱、體檢。' } },
  { id: 'midi-io', en: 'MIDI in and out (@openav/midi)', zh: 'MIDI 輸入輸出（@openav/midi）',
    hint: { en: 'Ports, parsing, profiles, clock, virtual MIDI.', zh: '連接埠、解析、設定檔、時鐘、虛擬 MIDI。' } },
  { id: 'controllers', en: 'Controller faceplates and embedding', zh: '控制器面板與嵌入',
    hint: { en: '<oav-controller>, the iframe embed, drawing a controller on a canvas.', zh: '<oav-controller>、iframe 嵌入、在畫布上畫控制器。' } },
  { id: 'keys', en: 'Keyboard (@openav/keys)', zh: '鍵盤（@openav/keys）',
    hint: { en: 'The on-screen piano and the QWERTY fallback.', zh: '螢幕上的鋼琴與電腦鍵盤備案。' } },
  { id: 'leap', en: 'Leap Motion (@openav/leap)', zh: 'Leap Motion（@openav/leap）',
    hint: { en: 'Hands as signals: frames, gestures, the bridge.', zh: '把手當訊號：影格、手勢、橋接程式。' } },
  { id: 'pose', en: 'Body and hand pose (@openav/pose)', zh: '身體與手部姿態（@openav/pose）',
    hint: { en: 'Camera in, landmarks and pinches out.', zh: '鏡頭進來，關節點與捏合出去。' } },
  { id: 'chord', en: 'Chords (@openav/chord)', zh: '和弦分析（@openav/chord）',
    hint: { en: 'Held notes in, chord quality and consonance out.', zh: '按住的音進來，和弦性質與協和度出去。' } },
  { id: 'osc', en: 'OSC and outputs', zh: 'OSC 與外部輸出',
    hint: { en: 'Send signals to TouchDesigner, Max or a hardware bridge.', zh: '把訊號送到 TouchDesigner、Max 或硬體橋接。' } },
  { id: 'mapping', en: 'Mapping (@openav/mapping)', zh: '映射（@openav/mapping）',
    hint: { en: 'Routes from signals to params, curves, smoothing, learn.', zh: '從訊號到參數的路由、曲線、平滑、learn。' } },
  { id: 'core', en: 'Core: signals, params, stage, show', zh: '核心：訊號、參數、舞台、演出',
    hint: { en: 'The bus every package talks through, worlds, createShow().', zh: '所有套件共用的匯流排、世界、createShow()。' } },
  { id: 'remote', en: 'Phones, relay and control surfaces', zh: '手機、中繼與控制面板',
    hint: { en: '@openav/remote, @openav/relay, @openav/surface.', zh: '@openav/remote、@openav/relay、@openav/surface。' } },
  { id: 'backstage', en: 'Console and monitor', zh: '控台與後台監看',
    hint: { en: 'The director\'s console and the backstage monitor feed.', zh: '導演控台與後台監看的資料流。' } },
  { id: 'fab', en: 'Digital fabrication (@openav/fab)', zh: '數位製造（@openav/fab）',
    hint: { en: 'Meshes, STL / GLB / OBJ export, checks.', zh: '網格、STL／GLB／OBJ 輸出、檢查。' } },
  { id: 'mcp', en: 'MCP tools for agents', zh: '給代理的 MCP 工具',
    hint: { en: 'The tools of packages/mcp/server.js.', zh: 'packages/mcp/server.js 提供的工具。' } },
];

export const CATEGORY_IDS = CATEGORIES.map((c) => c.id);

/** Where a name without an entry sits on the page while it waits for one (the ledger): by package. */
export const PACKAGE_CATEGORY = {
  audio: 'mic', chop: 'chop', chord: 'chord', console: 'backstage', core: 'core', drums: 'drums', fab: 'fab', keys: 'keys', leap: 'leap',
  mapping: 'mapping', mcp: 'mcp', midi: 'midi-io', monitor: 'backstage', osc: 'osc', out: 'osc', pattern: 'drums', pose: 'pose', record: 'record',
  relay: 'remote', remote: 'remote', score: 'timeline', show: 'core', sound: 'sound', stage: 'core', surface: 'remote', timeline: 'timeline',
  'world-webtoe': 'core',
};
