// @openav/sound reference: the Tone.js engine, the instrument registry and the presets. Read by tools/build-reference.mjs
// (see AGENTS.md, "Documenting a public name"). The keys are the public names the code has; a key the code does not have is a red test.
// The entry points are @openav/sound, @openav/sound/registry and @openav/sound/picker: the names found in more than one are one entry.
// Module examples run as ES modules in the reference smoke, with an import map for every @openav/* package.

export default {
  Sound: {
    group: 'sound',
    summary: {
      en: 'Makes every midi/note/on and midi/note/off on a bus audible through a sound engine, and puts the engine\'s params on the bus as sound/*.',
      zh: '讓匯流排上每個 midi/note/on 和 midi/note/off 都透過發聲引擎聽得見，並把引擎的參數放到匯流排上，名稱是 sound/*。',
    },
    params: [
      { name: 'signals', type: 'Signals', optional: false, en: 'The [`Signals`](#Signals) bus. `Sound` listens to `midi/note/on` `{ note, vel, ch }`, `midi/note/off` `{ note, ch }` and `midi/cc/64` (the sustain pedal, down at 0.5 or more), and pulses `sound/instrument` `{ id, name }` when the instrument changes.', zh: '[`Signals`](#Signals) 匯流排。`Sound` 聽 `midi/note/on` `{ note, vel, ch }`、`midi/note/off` `{ note, ch }` 和 `midi/cc/64`（延音踏板，0.5 以上算踩下），並在樂器改變時發出 `sound/instrument` `{ id, name }` 脈衝。' },
      { name: 'params', type: 'Params', optional: true, default: 'null', en: 'A `Params` registry to add the engine\'s params to, named `sound/<key>` (`sound/cutoff`, `sound/space`, `sound/volume` and the instrument\'s own). Left out, no params are registered.', zh: '要把引擎的參數加進去的 `Params`，名稱是 `sound/<key>`（`sound/cutoff`、`sound/space`、`sound/volume`，和樂器自己的）。沒給的話，不註冊任何參數。' },
      { name: 'engine', type: 'Object', optional: false, en: 'The sound engine, such as [`toneEngine()`](#toneEngine) or [`drumEngine()`](#drumEngine). The contract is `{ params, enable(), noteOn(note, vel01), noteOff(note), set(key, value), dispose() }`, and optionally `setInstrument`, `instrument`, `status`, `subscribe`, `sustain(down)` and `skipChannels`.', zh: '發聲引擎，例如 [`toneEngine()`](#toneEngine) 或 [`drumEngine()`](#drumEngine)。約定是 `{ params, enable(), noteOn(note, vel01), noteOff(note), set(key, value), dispose() }`，選用的有 `setInstrument`、`instrument`、`status`、`subscribe`、`sustain(down)`、`skipChannels`。' },
      { name: 'instrument', type: 'String', optional: true, default: 'null', en: 'The instrument to start with, for an engine that has instruments (`\'piano\'`, `\'synth/pluck\'`). An unknown id is warned about in the console and ignored.', zh: '一開始用哪個樂器，給有樂器的引擎用（`\'piano\'`、`\'synth/pluck\'`）。不認識的 id 會在 console 警告，並被忽略。' },
      { name: 'remember', type: 'Boolean | String', optional: true, default: 'true', en: 'Keep the instrument the picker last chose, per page, in `localStorage`, and let it win over `instrument` the next time. A string is your own storage key; the default key is `openav:sound:<page path>`. `false` turns it off. Choices made from code are not remembered unless you ask (`setInstrument(id, { remember: true })`).', zh: '把選單最後選的樂器依頁面記在 `localStorage`，下一次它會贏過 `instrument`。給字串就是你自己的儲存鍵。預設的鍵是 `openav:sound:<頁面路徑>`。`false` 是關掉。用程式做的選擇不會被記住，除非你要求（`setInstrument(id, { remember: true })`）。' },
      { name: 'picker', type: 'Boolean', optional: true, default: 'true', en: 'Whether a console should show the instrument picker. It is stored as `sound.picker` for whoever builds the interface; `Sound` itself draws nothing.', zh: '控台要不要顯示樂器選單。它被存成 `sound.picker`，給建介面的人讀。`Sound` 自己不畫任何東西。' },
    ],
    description: [
      {
        en: "`Sound` is the shell that wires an engine into an app. Once `await sound.enable()` has run, every `midi/note/on` and `midi/note/off` on the bus is played, whatever sent it: a MIDI keyboard, the on-screen piano ([`mountKeys()`](#mountKeys)), a [`SimPlayer`](#SimPlayer), a [`TakePlayer`](#TakePlayer) or a phone. Notes on a channel in the engine's `skipChannels` are left out (the Tone engine skips channel 10, which belongs to the drum machine).",
        zh: "`Sound` 是把引擎接進應用程式的外殼。`await sound.enable()` 之後，匯流排上每個 `midi/note/on` 和 `midi/note/off` 都會被播出來，不管是誰送的：MIDI 鍵盤、螢幕鋼琴（[`mountKeys()`](#mountKeys)）、[`SimPlayer`](#SimPlayer)、[`TakePlayer`](#TakePlayer) 或手機。在引擎的 `skipChannels` 裡的頻道的音符不會播（Tone 引擎略過頻道 10，那是鼓機的）。",
      },
      {
        en: "The engine's params become `sound/*` params, so a knob, the timeline or a hand can play the filter the same way it plays the visuals: sound is performable state, not a side effect. Every frame, call `sound.update(state)` with the resolved param values, and the `sound/*` ones are pushed into the engine. The instrument is a discrete choice (`setInstrument()` or the picker); what you perform continuously stays a param.",
        zh: "引擎的參數會變成 `sound/*` 參數，所以旋鈕、時間軸或一隻手可以像操作畫面那樣操作濾波器：聲音是可以演奏的狀態，不是附帶的效果。每個畫面用解析好的參數值呼叫 `sound.update(state)`，其中 `sound/*` 的就會被送進引擎。樂器是離散的選擇（`setInstrument()` 或選單），要連續演奏的東西則維持是參數。",
      },
    ],
    needs: {
      en: "`sound.enable()` from a click: browsers start audio only after a user gesture. With [`toneEngine()`](#toneEngine) it also loads Tone.js from the network (jsDelivr) the first time. Before `enable()` nothing is heard, and the bus is not listened to.",
      zh: "要在點擊裡呼叫 `sound.enable()`：瀏覽器要使用者做過一個動作才讓聲音開始。用 [`toneEngine()`](#toneEngine) 的話，第一次還會從網路（jsDelivr）載入 Tone.js。`enable()` 之前什麼都聽不到，匯流排也沒有被聽。",
    },
    tbd: [
      {
        en: "The Tone.js engine was not run for this page: there was no network and no speakers. What is written here comes from the code and from the package tests, which use a stand-in for Tone.js, and the examples that run use a stand-in engine.",
        zh: "這一頁沒有實際跑過 Tone.js 引擎：這裡沒有網路也沒有喇叭。寫在這裡的內容來自程式碼，和套件的測試（測試用一個替身代替 Tone.js），能跑的範例用的是替身引擎。",
      },
    ],
    notes: [
      {
        en: "From a p5 sketch you do not build this: [`startSound()`](#startSound) does it, loading this package only when it is called.",
        zh: "在 p5 草圖裡不用自己建這個：[`startSound()`](#startSound) 會做，而且只在被呼叫的時候才載入這個套件。",
      },
    ],
    members: {
      enable: { en: 'Starts the engine and begins listening to the bus. Returns a promise of `true`. Call it from a click. Calling it again returns the same promise; if it fails you can try again. Emits `{ type: \'enabled\', id }` to `onChange` listeners.', zh: '啟動引擎並開始聽匯流排。回傳 `true` 的 promise。要在點擊裡呼叫。再呼叫一次會回傳同一個 promise。失敗了可以再試。會對 `onChange` 的監聽者發出 `{ type: \'enabled\', id }`。' },
      update: { en: 'Per frame: pushes every `sound/<key>` value of `state` into the engine\'s `set(key, value)`. Other keys of `state` are ignored. Does nothing before `enable()`.', zh: '每個畫面一次：把 `state` 裡每個 `sound/<key>` 的值送進引擎的 `set(key, value)`。`state` 的其他鍵會被忽略。`enable()` 之前什麼都不做。' },
      instrument: { en: 'Getter. The id of the current instrument (`\'piano\'`), or `null` for an engine without instruments, such as the drum kit.', zh: 'Getter。目前樂器的 id（`\'piano\'`），引擎沒有樂器（例如鼓組）的話是 `null`。' },
      status: { en: 'Getter. `{ id, state, progress, error }`: `state` is `\'idle\'`, `\'loading\'`, `\'ready\'` or `\'error\'` and `progress` is 0..1 while a sampler loads.', zh: 'Getter。`{ id, state, progress, error }`：`state` 是 `\'idle\'`、`\'loading\'`、`\'ready\'` 或 `\'error\'`，取樣樂器載入的時候 `progress` 是 0..1。' },
      choosable: { en: 'Getter. Whether the engine has instruments to choose from.', zh: 'Getter。引擎有沒有樂器可以選。' },
      setInstrument: { en: 'Switches instrument, live: `setInstrument(id, { remember = false })`. Held notes are released on the old one and the new one takes over once it is ready (a sampler keeps the old sound while its files load). Returns a promise: `true` once the instrument plays, `false` if the id is unknown, the engine has no instruments or the choice was replaced by a newer one. `remember: true` stores the choice for this page.', zh: '現場換樂器：`setInstrument(id, { remember = false })`。舊樂器按著的音會被放開，新的樂器準備好之後接手（取樣樂器在檔案載入的時候，還是用舊的聲音）。回傳 promise：樂器開始發聲是 `true`，id 不認得、引擎沒有樂器，或這個選擇被更新的選擇取代則是 `false`。`remember: true` 會把這個選擇記給這個頁面。' },
      onChange: { en: 'Listens for what happens: `cb({ type, id, progress, error })` with `type` `\'instrument\'`, `\'loading\'`, `\'ready\'`, `\'error\'` or `\'enabled\'`. Returns a function that stops listening.', zh: '聽發生了什麼事：`cb({ type, id, progress, error })`，`type` 是 `\'instrument\'`、`\'loading\'`、`\'ready\'`、`\'error\'` 或 `\'enabled\'`。回傳一個停止聽的函式。' },
      dispose: { en: 'Stops listening to the bus, drops the listeners and disposes the engine.', zh: '不再聽匯流排、移除監聽者，並釋放引擎。' },
    },
    examples: [
      {
        code: `import { Sound } from '@openav/sound';
import { Signals } from '@openav/core';

const signals = new Signals();
const heard = [];
const engine = {                                    // the smallest engine: it only writes down what it is told
  params: [{ key: 'cutoff', label: 'Cutoff', min: 100, max: 8000, def: 2500 }],
  async enable() {},
  noteOn: (note, vel) => heard.push('on ' + note + ' ' + vel),
  noteOff: (note) => heard.push('off ' + note),
  set: (key, value) => heard.push(key + '=' + value),
  dispose() {},
};
const sound = new Sound({ signals, engine });
await sound.enable();
signals.pulse('midi/note/on', { note: 60, vel: 0.8, ch: 1 });
signals.pulse('midi/note/off', { note: 60, ch: 1 });
sound.update({ 'sound/cutoff': 900, hue: 0.3 });     // only the sound/* keys go to the engine
console.log(heard.join(', '));                        // on 60 0.8, off 60, cutoff=900
console.log(sound.enabled, sound.choosable, sound.instrument);   // true false null`,
        caption: { en: 'A bus with a stand-in engine: notes on the bus reach the engine, and of the state only `sound/cutoff` does. The engine has no instruments, so `choosable` is false.', zh: '一個匯流排加一個替身引擎：匯流排上的音符傳到引擎，state 裡只有 `sound/cutoff` 會傳到。這個引擎沒有樂器，所以 `choosable` 是 false。' },
      },
      {
        code: `import { Signals } from '@openav/core';
import { mountKeys } from '@openav/keys';
import { Sound, toneEngine, mountSoundPicker } from '@openav/sound';

const signals = new Signals();
const sound = new Sound({ signals, engine: toneEngine({ instrument: 'piano' }) });
mountKeys(document.getElementById('app'), { signals });        // an on-screen piano that publishes midi/note/on
mountSoundPicker(document.getElementById('app'), sound);       // choosing an instrument also turns the sound on
document.body.addEventListener('click', () => sound.enable(), { once: true });
sound.onChange((e) => console.log(e.type, e.id));`,
        caption: { en: 'Click anywhere to start the sound, then click the piano keys: you hear the Salamander grand piano. Pick another instrument from the menu while you play.', zh: '在任何地方點一下開始發聲，然後點鋼琴的琴鍵：你會聽到 Salamander 平台鋼琴。彈的時候可以從選單換別的樂器。' },
        run: 'static',
        why: 'It loads Tone.js and the piano samples from the network, needs a click to start audio and a speaker to hear it; the logic with a stand-in engine is the example above.',
      },
    ],
    related: ['toneEngine', 'mountSoundPicker', 'registerInstrument', 'SOUND_PARAMS', 'startSound', 'Signals'],
    keywords: {
      en: ['sound', 'audio output', 'play notes', 'instrument', 'synth', 'engine', 'midi to sound', 'tone.js', 'enable sound'],
      zh: ['聲音', '音訊輸出', '彈出聲音', '樂器', '合成器', '引擎', 'midi 變成聲音', 'tone.js', '啟用聲音'],
    },
  },

  toneEngine: {
    group: 'sound',
    summary: {
      en: 'The sound engine that plays the registered instruments with Tone.js through a filter, a reverb and a limiter.',
      zh: '發聲引擎，用 Tone.js 播放登記好的樂器，聲音依序經過濾波器、殘響和限幅器。',
    },
    params: [
      { name: 'cdn', type: 'String', optional: true, default: 'TONE_CDN', en: 'Where Tone.js is imported from when the engine is enabled. The default is [`TONE_CDN`](#TONE_CDN). A module URL, so you can host your own copy.', zh: '引擎啟用時從哪裡匯入 Tone.js。預設是 [`TONE_CDN`](#TONE_CDN)。是一個模組網址，所以你可以放自己的備份。' },
      { name: 'instrument', type: 'String', optional: true, default: "'synth/pad'", en: 'The instrument to start with. An unknown id is warned about and `synth/pad` is used.', zh: '一開始用的樂器。不認識的 id 會警告，改用 `synth/pad`。' },
      { name: 'baseUrl', type: 'String', optional: true, default: 'SAMPLES_URL', en: 'The folder that holds the built-in sample sets (`salamander/…`). The default is [`SAMPLES_URL`](#SAMPLES_URL).', zh: '放內建取樣組（`salamander/…`）的資料夾。預設是 [`SAMPLES_URL`](#SAMPLES_URL)。' },
      { name: 'instruments', type: 'Object', optional: true, default: '{}', en: 'Options for single instruments, handed to their `create()` as `ctx.options`: `{ piano: { baseUrl: \'/my/salamander/\' } }`.', zh: '給單一樂器的選項，會當作 `ctx.options` 交給它的 `create()`：`{ piano: { baseUrl: \'/my/salamander/\' } }`。' },
      { name: 'drumChannel', type: 'Number | null', optional: true, default: '10', en: 'Notes on this MIDI channel belong to a drum engine (the drum machine sends General MIDI channel 10) and are not played here. `null` plays everything.', zh: '這個 MIDI 頻道的音符屬於鼓的引擎（鼓機送的是 General MIDI 的頻道 10），這裡不播。`null` 是全部都播。' },
    ],
    returns: {
      type: 'Object',
      en: 'An engine: `{ params, sharedParams, instrument, status, skipChannels, hasInstrument(id), subscribe(cb), setInstrument(id), enable(), noteOn(note, vel01, time), noteOff(note, time), sustain(down), releaseAll(), set(key, value), dispose() }`.',
      zh: '一個引擎：`{ params, sharedParams, instrument, status, skipChannels, hasInstrument(id), subscribe(cb), setInstrument(id), enable(), noteOn(note, vel01, time), noteOff(note, time), sustain(down), releaseAll(), set(key, value), dispose() }`。',
    },
    description: [
      {
        en: "Tone.js stays a neighbour, not a dependency: it is loaded from the network the first time `enable()` runs, so an app that never turns the sound on pays nothing. After `enable()` the instrument's output goes through a low-pass filter (`cutoff`, starting at 2500 Hz), a reverb (`space`, the wet amount, starting at 0.3), a volume (`volume`, in dB, starting at -8) and a limiter at -1 dB, so a loud organ never clips the room. These three are the [`SOUND_PARAMS`](#SOUND_PARAMS) shared by every instrument. Their starting values can follow the instrument (a piano wants the filter open), and the instrument may add params of its own.",
        zh: "Tone.js 只是鄰居，不是相依套件：第一次 `enable()` 的時候才從網路載入，所以從不開聲音的應用程式什麼代價都不用付。`enable()` 之後，樂器的輸出會經過低通濾波器（`cutoff`，起始 2500 Hz）、殘響（`space`，濕度，起始 0.3）、音量（`volume`，單位 dB，起始 -8）和 -1 dB 的限幅器，所以很大聲的風琴也不會把房間削波。這三個就是每個樂器共用的 [`SOUND_PARAMS`](#SOUND_PARAMS)。它們的起始值可以跟著樂器走（鋼琴想要濾波器全開），樂器也可以再加自己的參數。",
      },
      {
        en: "`setInstrument(id)` switches live and returns a promise of whether it worked. Before `enable()` it only remembers the choice. Held notes are released on the old instrument and its tail is left to ring for a few seconds. A sampler (the piano) keeps the old sound until its files are in; if they cannot load, the engine plays the instrument's `fallback` (the piano falls back to the electric piano), so a performance never goes silent because of one failed download. `subscribe(cb)` tells you about `instrument`, `loading`, `ready` and `error` events. `sustain(down)` is the pedal: note-offs wait until it comes up. `releaseAll()` is a panic button.",
        zh: "`setInstrument(id)` 現場換樂器，回傳換成功與否的 promise。在 `enable()` 之前它只是記住這個選擇。舊樂器按著的音會被放開，它的尾巴讓它再響幾秒。取樣樂器（鋼琴）在檔案進來之前會繼續用舊的聲音。如果載入失敗，引擎會播這個樂器的 `fallback`（鋼琴退回電鋼琴），所以演出不會因為一次下載失敗就沒聲音。`subscribe(cb)` 會告訴你 `instrument`、`loading`、`ready`、`error` 事件。`sustain(down)` 是踏板：放開音的動作要等到踏板抬起來才做。`releaseAll()` 是緊急停止鈕。",
      },
      {
        en: "You usually pass the engine to a [`Sound`](#Sound), which is what listens to the bus. Used on its own, `noteOn(60, 0.8)` plays a note.",
        zh: "通常你會把引擎交給 [`Sound`](#Sound)，由它去聽匯流排。單獨使用的話，`noteOn(60, 0.8)` 就是彈一個音。",
      },
    ],
    needs: {
      en: "`await engine.enable()` from a click: it loads Tone.js from the network, then starts its audio. Before that, `noteOn()` does nothing and `setInstrument()` only remembers the choice.",
      zh: "要在點擊裡 `await engine.enable()`：它從網路載入 Tone.js，然後啟動音訊。在那之前 `noteOn()` 什麼都不做，`setInstrument()` 只是記住選擇。",
    },
    tbd: [
      {
        en: "The Tone.js engine was not run for this page: there was no network and no speakers. What is written here comes from the code and from the package tests, which use a stand-in for Tone.js, and the examples that run use a stand-in engine.",
        zh: "這一頁沒有實際跑過 Tone.js 引擎：這裡沒有網路也沒有喇叭。寫在這裡的內容來自程式碼，和套件的測試（測試用一個替身代替 Tone.js），能跑的範例用的是替身引擎。",
      },
    ],
    examples: [
      {
        code: `import { toneEngine } from '@openav/sound';

const engine = toneEngine({ instrument: 'strings' });      // nothing is loaded yet
console.log(engine.instrument, engine.status.state);        // strings idle
console.log(engine.params.map((p) => p.key + ' ' + p.def).join(', '));
// cutoff 6000, space 0.45, volume -8, attack 0.35, vibrato 0.35   (the shared three, then the strings' own)
console.log(engine.skipChannels, engine.hasInstrument('piano'));   // [10] true
console.log(toneEngine({ drumChannel: null }).skipChannels);       // []`,
        caption: { en: 'Looks at an engine before it is enabled: its instrument, the params it will offer (the strings suggest a different starting cutoff and space, and add two of their own), and that channel 10 is left to the drums.', zh: '在引擎啟用之前看它：它的樂器、它會提供的參數（弦樂建議了不同的起始 cutoff 和 space，還多加了兩個自己的），以及頻道 10 是留給鼓的。' },
      },
      {
        code: `import { toneEngine } from '@openav/sound';

const engine = toneEngine({ instrument: 'epiano' });
document.body.addEventListener('click', async () => {
  await engine.enable();                                // loads Tone.js from the network, starts the audio
  engine.set('space', 0.6);                             // more reverb
  [60, 64, 67].forEach((note) => engine.noteOn(note, 0.8));   // a C major chord
  setTimeout(() => engine.releaseAll(), 1500);
}, { once: true });`,
        caption: { en: 'Click the page: an electric piano plays a C major chord, with more reverb than usual, and lets go after a second and a half.', zh: '在頁面上點一下：電鋼琴彈一個 C 大調和弦，殘響比平常多，一秒半之後放開。' },
        run: 'static',
        why: 'It loads Tone.js from the network, needs a click to start audio and a speaker to hear the chord; the inspection of an engine that is not enabled is the example above.',
      },
    ],
    related: ['Sound', 'registerInstrument', 'SOUND_PARAMS', 'TONE_CDN', 'SAMPLES_URL', 'drumEngine'],
    keywords: {
      en: ['tone.js', 'engine', 'synth', 'instrument player', 'reverb', 'filter', 'limiter', 'samples', 'enable', 'noteOn'],
      zh: ['tone.js', '引擎', '合成器', '樂器播放', '殘響', '濾波器', '限幅器', '取樣', '啟用', 'noteOn'],
    },
  },

  mountSoundPicker: {
    group: 'sound',
    summary: {
      en: 'Puts an instrument menu on the page: one group per category, a loading bar for samplers and the credit line an instrument asks for.',
      zh: '在頁面上放一個樂器選單：每個類別一組，取樣樂器有載入進度條，也會顯示樂器要求的出處說明。',
    },
    params: [
      { name: 'container', type: 'HTMLElement', en: 'The element to put the picker in.', zh: '要放選單的元素。' },
      { name: 'sound', type: 'Sound', en: 'The [`Sound`](#Sound) to control. The menu follows its instrument and its loading.', zh: '要控制的 [`Sound`](#Sound)。選單會跟著它的樂器和載入狀態走。' },
      { name: 'lang', type: "'en' | 'zh'", optional: true, default: 'from <html lang>', en: 'The language of the labels and instrument names. The default is `\'zh\'` when the page\'s `<html lang>` starts with `zh`, else `\'en\'`.', zh: '標籤和樂器名稱的語言。預設是頁面的 `<html lang>` 以 `zh` 開頭就用 `\'zh\'`，否則用 `\'en\'`。' },
      { name: 'className', type: 'String', optional: true, default: "'oav-sound-pick'", en: 'The class of the picker. The parts get `-row`, `-label`, `-status`, `-meter` and `-credit` added to it, for your own styling. The picker brings no CSS.', zh: '選單的 class。各個部分會在它後面加上 `-row`、`-label`、`-status`、`-meter`、`-credit`，讓你自己寫樣式。選單本身不帶 CSS。' },
      { name: 'label', type: 'String', optional: true, default: 'null', en: 'The label in front of the menu. Left out, it is the word "instrument" (in Chinese when `lang` is `\'zh\'`).', zh: '選單前面的標籤。沒給的話，依語言是 "instrument" 或「樂器」。' },
      { name: 'enableOnPick', type: 'Boolean', optional: true, default: 'true', en: 'Choosing an instrument also calls `sound.enable()` if the sound is off. A choice is a click, which is the gesture a browser wants before it plays audio.', zh: '選了樂器之後，如果聲音還沒開，就順便呼叫 `sound.enable()`。選擇本身就是一次點擊，正是瀏覽器要的那個動作。' },
    ],
    returns: { type: 'Object', en: '`{ el, select, refresh(), dispose() }`: the element it made, its `<select>`, a function that rebuilds the list, and a function that takes it away.', zh: '`{ el, select, refresh(), dispose() }`：它做出來的元素、裡面的 `<select>`、重建清單的函式，和把它拆掉的函式。' },
    description: [
      {
        en: "A native `<select>` with one `<optgroup>` per category ([`CATEGORIES`](#CATEGORIES)), so it works with a keyboard and on a phone and needs no styling to be usable. It lists whatever is registered, and it refreshes itself when an instrument is registered or removed ([`onInstrumentsChange()`](#onInstrumentsChange)). Choosing one calls `sound.setInstrument(id, { remember: true })`. While a sampler loads it shows a bar and a percentage; if the load fails it says so, and says which instrument plays instead. A credit line appears under the menu for an instrument that has one: the Salamander piano is CC-BY, and its credit is always shown.",
        zh: "這是原生的 `<select>`，每個類別（[`CATEGORIES`](#CATEGORIES)）一個 `<optgroup>`，所以用鍵盤、在手機上都能用，不用做任何樣式就能用。它列出所有已登記的樂器，而且在有樂器被登記或移除時自動更新（[`onInstrumentsChange()`](#onInstrumentsChange)）。選了一個就呼叫 `sound.setInstrument(id, { remember: true })`。取樣樂器載入的時候顯示進度條和百分比。載入失敗會說出來，並說明改播哪個樂器。有出處說明的樂器，選單底下會出現一行：Salamander 鋼琴是 CC-BY，它的出處說明一定會顯示。",
      },
    ],
    examples: [
      {
        code: `import { mountSoundPicker, registerInstrument, unregisterInstrument, Sound } from '@openav/sound';
import { Signals } from '@openav/core';

const engine = {                                     // a stand-in engine with instruments, so nothing is loaded
  instrument: 'synth/pad', params: [], enable() {}, noteOn() {}, noteOff() {}, set() {},
  setInstrument: async (id) => { engine.instrument = id; return true; }, subscribe: () => () => {},
};
const sound = new Sound({ signals: new Signals(), engine, remember: false });
const picker = mountSoundPicker(document.getElementById('app'), sound, { lang: 'en' });
console.log(picker.select.options.length, picker.select.value);    // 22 synth/pad

registerInstrument({ id: 'me/kalimba', name: 'Kalimba', category: 'mallets', create: () => ({ noteOn() {}, noteOff() {}, dispose() {} }) });
console.log(picker.select.options.length);                          // 23: the menu refreshed itself
unregisterInstrument('me/kalimba');`,
        caption: { en: 'A menu of the 22 built-in instruments, in groups, appears on the page. Registering one more adds it to the menu at once.', zh: '頁面上出現一個選單，22 個內建樂器分組列在裡面。再登記一個，它馬上就加進選單。' },
      },
    ],
    related: ['Sound', 'instrumentGroups', 'onInstrumentsChange', 'registerInstrument', 'CATEGORIES'],
    keywords: {
      en: ['picker', 'instrument menu', 'select', 'choose instrument', 'dropdown', 'ui', 'credit', 'loading progress'],
      zh: ['選單', '樂器選單', '選擇樂器', '下拉', '介面', '出處說明', '載入進度'],
    },
  },

  registerInstrument: {
    group: 'sound',
    summary: {
      en: 'Adds a sound to every picker on the page: an id, a name, a category and one create() function that builds the instrument.',
      zh: '把一個聲音加到頁面上每個選單：一個 id、一個名字、一個類別，和一個建立樂器的 create() 函式。',
    },
    params: [
      { name: 'def', type: 'Object', en: 'The instrument definition, see the table below.', zh: '樂器的定義，見下面的表。' },
      { name: 'replace', type: 'Boolean', optional: true, default: 'false', en: 'In the options `{ replace }`: allow replacing an instrument that has the same id. Without it a duplicate id throws.', zh: '在選項 `{ replace }` 裡：允許取代同樣 id 的樂器。沒有它的話，重複的 id 會丟出錯誤。' },
    ],
    returns: { type: 'Object', en: 'The definition you gave. It throws a `TypeError` listing everything wrong if the definition is not valid (see [`validateInstrument()`](#validateInstrument)), and an `Error` for a duplicate id.', zh: '你給的那個定義。定義不合格的話會丟出 `TypeError`，列出所有的問題（見 [`validateInstrument()`](#validateInstrument))，id 重複則丟出 `Error`。' },
    description: [
      {
        en: "A sound you can pick is plain data plus one factory. Registering it is all it takes: import the file before you start, and every [`mountSoundPicker()`](#mountSoundPicker) on the page lists it under its category, with no change to the package. The registry lives on `globalThis`, so two copies of this module on one page share one list. Built-in instruments only fill empty slots: register your own `'piano'` first and you keep it. The definition:",
        zh: "能選的聲音就是一份資料加一個工廠函式。登記它就夠了：在開始之前匯入那個檔案，頁面上每個 [`mountSoundPicker()`](#mountSoundPicker) 就會把它列在它的類別底下，不用改套件。登記表放在 `globalThis` 上，所以同一個頁面上有兩份這個模組也共用同一份清單。內建的樂器只會填空位：先登記你自己的 `'piano'`，就會保留你的。定義如下：",
      },
      {
        en: "```text\nid          lowercase letters, digits and \"-\", at most one \"/\": 'kalimba', 'me/kalimba'\nname        a string, or { en, zh }\ncategory    keys · mallets · strings · plucked · organ · voice · synth · drums · other, or your own\ncreate      create(Tone, ctx) → { noteOn(note, vel01, time), noteOff(note, time), set?(key, v),\n                                  releaseAll?(time), ready?: Promise, dispose() }\nparams      your own knobs [{ key, label, min, max, def }], shown as sound/<key> while it plays\ndefaults    starting values for the shared params: { cutoff, space, volume }\ncredit      a string, or { text, url }, shown in the picker\ngain        level in dB      transpose   semitones      tail   seconds the old one may ring after a switch\nfallback    the id of an instrument to play if `ready` rejects\n```",
        zh: "```text\nid          小寫字母、數字和 \"-\"，最多一個 \"/\"：'kalimba'、'me/kalimba'\nname        一個字串，或 { en, zh }\ncategory    keys · mallets · strings · plucked · organ · voice · synth · drums · other，或你自己的\ncreate      create(Tone, ctx) → { noteOn(note, vel01, time), noteOff(note, time), set?(key, v),\n                                  releaseAll?(time), ready?: Promise, dispose() }\nparams      你自己的旋鈕 [{ key, label, min, max, def }]，播放時顯示成 sound/<key>\ndefaults    共用參數的起始值：{ cutoff, space, volume }\ncredit      一個字串，或 { text, url }，顯示在選單裡\ngain        音量，單位 dB      transpose   半音數      tail   換樂器之後舊的可以再響幾秒\nfallback    如果 `ready` 失敗，要改播的樂器 id\n```",
      },
      {
        en: "`create(Tone, ctx)` runs on enable and on every switch to the instrument, with Tone.js already loaded. `ctx` is `{ output, rawOutput, rawContext, baseUrl, options, onProgress }`: connect Tone nodes to `output` (raw Web Audio nodes to `rawOutput`), `baseUrl` is where sample folders live, `options` is what was passed in `toneEngine({ instruments: { <id>: … } })`, and `onProgress(0..1)` shows a loading bar. If `ready` is a promise, the picker shows progress and the old sound keeps playing until it resolves. An instrument that makes mallet sounds from data can use [`modalInstrument()`](#modalInstrument), and one that is a Tone synth with settings, [`registerSynthPreset()`](#registerSynthPreset).",
        zh: "`create(Tone, ctx)` 在啟用的時候、以及每次切換到這個樂器的時候執行，那時 Tone.js 已經載入。`ctx` 是 `{ output, rawOutput, rawContext, baseUrl, options, onProgress }`：把 Tone 的節點接到 `output`（原生 Web Audio 節點接到 `rawOutput`），`baseUrl` 是取樣資料夾的位置，`options` 是 `toneEngine({ instruments: { <id>: … } })` 傳進來的東西，`onProgress(0..1)` 用來顯示載入進度。如果 `ready` 是 promise，選單會顯示進度，而且在它 resolve 之前舊的聲音繼續播。從資料做敲擊聲的樂器可以用 [`modalInstrument()`](#modalInstrument)，是有設定的 Tone 合成器就用 [`registerSynthPreset()`](#registerSynthPreset)。",
      },
    ],
    examples: [
      {
        code: `import { registerInstrument, getInstrument, listInstruments, unregisterInstrument } from '@openav/sound';

const def = {
  id: 'me/kalimba', name: { en: 'Kalimba', zh: '拇指琴' }, category: 'mallets',
  create: () => ({ noteOn() {}, noteOff() {}, dispose() {} }),     // a silent stand-in for the example
};
registerInstrument(def);
console.log(getInstrument('me/kalimba') === def);                   // true
console.log(listInstruments({ category: 'mallets' }).map((d) => d.id).join(' '));
// xylophone marimba vibraphone glockenspiel music-box me/kalimba

try { registerInstrument(def); } catch (e) { console.log(e.message); }
// [sound] instrument "me/kalimba" is already registered; pass { replace: true } to swap it on purpose
registerInstrument({ ...def, name: 'Kalimba 2' }, { replace: true });   // on purpose
unregisterInstrument('me/kalimba');`,
        caption: { en: 'Registers an instrument, finds it in its category, is refused when it registers the same id twice, and swaps it on purpose with `replace`.', zh: '登記一個樂器、在它的類別裡找到它、重複登記同一個 id 會被拒絕，再用 `replace` 刻意換掉。' },
      },
      {
        code: `import { registerInstrument } from '@openav/sound';

registerInstrument({
  id: 'kalimba',
  name: { en: 'Kalimba', zh: '拇指琴' },
  category: 'mallets',
  params: [{ key: 'decay', label: 'Decay (s)', min: 0.2, max: 4, def: 1.2 }],   // becomes sound/decay
  create(Tone, { output }) {
    const synth = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 5.1, modulationIndex: 2,
      envelope: { attack: 0.001, decay: 1.2, sustain: 0, release: 1 },
    }).connect(output);
    const hz = (note) => 440 * 2 ** ((note - 69) / 12);
    return {
      noteOn: (note, vel, time) => synth.triggerAttack(hz(note), time, vel),
      noteOff: (note, time) => synth.triggerRelease(hz(note), time),
      set: (key, value) => key === 'decay' && synth.set({ envelope: { decay: value } }),
      dispose: () => synth.dispose(),
    };
  },
});`,
        caption: { en: 'A whole instrument in one file: an FM synth with a knob of its own. Import it before the sound starts, and "Kalimba" appears under Mallets in every picker.', zh: '一個完整的樂器放在一個檔案裡：一個有自己旋鈕的 FM 合成器。在聲音開始之前匯入它，每個選單的「敲擊琴」底下就會出現 Kalimba。' },
        run: 'static',
        why: 'The instrument is only built, and so only heard, once Tone.js has loaded from the network after a click and speakers are on; the registry side of it runs in the example above.',
      },
    ],
    related: ['validateInstrument', 'unregisterInstrument', 'getInstrument', 'modalInstrument', 'registerSynthPreset', 'toneEngine', 'CATEGORIES'],
    keywords: {
      en: ['register', 'instrument', 'add a sound', 'custom instrument', 'plugin', 'create', 'definition', 'kalimba', 'extend'],
      zh: ['登記', '樂器', '加一個聲音', '自訂樂器', '外掛', '建立', '定義', '拇指琴', '擴充'],
    },
  },

  unregisterInstrument: {
    group: 'sound',
    summary: {
      en: 'Removes a registered sound, for tests and hot reload. Returns whether it was there.',
      zh: '移除一個登記過的聲音，給測試和熱重載用。回傳它原本在不在。',
    },
    params: [
      { name: 'id', type: 'String', en: 'The id of the instrument.', zh: '樂器的 id。' },
    ],
    returns: { type: 'Boolean', en: 'True if it existed. The listeners of [`onInstrumentsChange()`](#onInstrumentsChange) hear `{ type: \'unregister\', id }` only then.', zh: '原本有就是 true。只有這時候，[`onInstrumentsChange()`](#onInstrumentsChange) 的監聽者才會收到 `{ type: \'unregister\', id }`。' },
    description: [
      {
        en: "A picker refreshes itself. It does not stop an engine that is playing the instrument: switch away first.",
        zh: "選單會自己更新。它不會停掉正在播這個樂器的引擎：要先換掉。",
      },
    ],
    examples: [
      {
        code: `import { registerInstrument, unregisterInstrument, getInstrument } from '@openav/sound';

registerInstrument({ id: 'me/temp', name: 'Temp', category: 'other', create: () => ({ noteOn() {}, noteOff() {}, dispose() {} }) });
console.log(unregisterInstrument('me/temp'), getInstrument('me/temp'));   // true null
console.log(unregisterInstrument('me/temp'));                              // false`,
        caption: { en: 'Removes an instrument; the second time there is nothing to remove.', zh: '移除一個樂器。第二次就沒有東西可以移除了。' },
      },
    ],
    related: ['registerInstrument', 'getInstrument', 'onInstrumentsChange'],
    keywords: {
      en: ['remove', 'unregister', 'delete instrument', 'hot reload'],
      zh: ['移除', '取消登記', '刪除樂器', '熱重載'],
    },
  },

  getInstrument: {
    group: 'sound',
    summary: {
      en: "Finds a registered instrument definition by its id, or null.",
      zh: '用 id 找出一個登記過的樂器定義，找不到就是 null。',
    },
    params: [
      { name: 'id', type: 'String', en: 'The id, for example `\'piano\'` or `\'synth/pluck\'`.', zh: 'id，例如 `\'piano\'` 或 `\'synth/pluck\'`。' },
    ],
    returns: { type: 'Object | null', en: 'The definition you registered (`{ id, name, category, create, … }`), or `null`.', zh: '你登記的那個定義（`{ id, name, category, create, … }`），或 `null`。' },
    description: [
      {
        en: "Use it to check that an id exists before you pass it to [`toneEngine()`](#toneEngine) or `setInstrument()`, or to read an instrument's `credit`, `defaults` or `params`.",
        zh: "在把 id 交給 [`toneEngine()`](#toneEngine) 或 `setInstrument()` 之前，用它確認 id 存在，或讀一個樂器的 `credit`、`defaults`、`params`。",
      },
    ],
    examples: [
      {
        code: `import { getInstrument, instrumentName } from '@openav/sound';

const piano = getInstrument('piano');
console.log(instrumentName(piano), '/', piano.category);   // Grand piano (Salamander) / keys
console.log(piano.credit.text);                             // Salamander Grand Piano · Alexander Holm · CC-BY 3.0
console.log(getInstrument('theremin'));                     // null`,
        caption: { en: 'Reads the name, category and credit of the built-in piano, and shows that an id that is not registered gives `null`.', zh: '讀內建鋼琴的名字、類別和出處說明，並顯示沒登記過的 id 會得到 `null`。' },
      },
    ],
    related: ['listInstruments', 'registerInstrument', 'instrumentName'],
    keywords: {
      en: ['get instrument', 'lookup', 'find', 'definition', 'by id', 'credit'],
      zh: ['取得樂器', '查詢', '尋找', '定義', '用 id', '出處說明'],
    },
  },

  listInstruments: {
    group: 'sound',
    summary: {
      en: 'Lists every registered instrument, in the order they were registered, or only the ones of one category.',
      zh: '列出所有登記過的樂器，照登記的順序，或只列某一個類別的。',
    },
    params: [
      { name: 'category', type: 'String', optional: true, default: 'null', en: 'In the options `{ category }`: only the instruments of this category (`\'mallets\'`).', zh: '在選項 `{ category }` 裡：只列這個類別的樂器（`\'mallets\'`）。' },
    ],
    returns: { type: 'Object[]', en: 'A new array of instrument definitions.', zh: '一個新的樂器定義陣列。' },
    description: [
      {
        en: "The 22 built-in instruments are registered when `@openav/sound` loads, so a fresh page lists those. For a list shaped for a menu, with the groups in order, use [`instrumentGroups()`](#instrumentGroups).",
        zh: "22 個內建樂器在 `@openav/sound` 載入的時候就登記了，所以剛打開的頁面列出的就是這些。要一份適合做選單的清單，各組已排好序，用 [`instrumentGroups()`](#instrumentGroups)。",
      },
    ],
    examples: [
      {
        code: `import { listInstruments } from '@openav/sound';

console.log(listInstruments().length);                                       // 22
console.log(listInstruments({ category: 'mallets' }).map((d) => d.id).join(' '));
// xylophone marimba vibraphone glockenspiel music-box
console.log(listInstruments({ category: 'keys' }).map((d) => d.id).join(' '));    // piano epiano`,
        caption: { en: 'How many instruments there are, and which ones are mallets and keys.', zh: '一共有幾個樂器，以及哪些是敲擊琴和鍵盤。' },
      },
    ],
    related: ['instrumentGroups', 'getInstrument', 'BUILTIN_INSTRUMENTS', 'CATEGORIES'],
    keywords: {
      en: ['list', 'all instruments', 'category', 'filter', 'registry', 'available sounds'],
      zh: ['列出', '所有樂器', '類別', '篩選', '登記表', '有哪些聲音'],
    },
  },

  instrumentName: {
    group: 'sound',
    summary: {
      en: "Gives an instrument's display name in a language, falling back to English.",
      zh: '給一個樂器在某種語言下的顯示名稱，沒有就退回英文。',
    },
    params: [
      { name: 'def', type: 'Object', en: 'An instrument definition. `null` or `undefined` gives `\'\'`.', zh: '樂器的定義。`null` 或 `undefined` 會得到 `\'\'`。' },
      { name: 'lang', type: 'String', optional: true, default: "'en'", en: '`\'en\'`, `\'zh\'`… A longer tag such as `\'zh-TW\'` is tried by its first two letters.', zh: '`\'en\'`、`\'zh\'`…。比較長的標記，像 `\'zh-TW\'`，會用它前兩個字母去找。' },
    ],
    returns: { type: 'String', en: 'The name in that language, else the English one. A definition whose `name` is a plain string gives that string.', zh: '該語言的名稱，沒有就是英文的。`name` 只是一個字串的定義就回傳那個字串。' },
    description: [
      {
        en: "Instruments carry `name` as a string or as `{ en, zh }`. This hides which, so your own menu can just call `instrumentName(def, lang)`.",
        zh: "樂器的 `name` 可以是字串，也可以是 `{ en, zh }`。這個函式把差別藏起來，所以你自己的選單只要呼叫 `instrumentName(def, lang)`。",
      },
    ],
    examples: [
      {
        code: `import { getInstrument, instrumentName } from '@openav/sound';

const bar = getInstrument('glockenspiel');
console.log(instrumentName(bar), instrumentName(bar, 'zh'));   // Glockenspiel, then its Chinese name
console.log(instrumentName(bar, 'fr'));                         // Glockenspiel, English as the fallback
console.log(JSON.stringify(instrumentName(null)));              // ""`,
        caption: { en: 'The name in English, in Chinese, in a language that has no entry (English again), and for nothing at all.', zh: '英文的名字、中文的名字、沒有登記的語言（退回英文），以及什麼都沒有的情況。' },
      },
    ],
    related: ['instrumentGroups', 'getInstrument', 'mountSoundPicker'],
    keywords: {
      en: ['name', 'display name', 'translate', 'language', 'localized', 'label'],
      zh: ['名稱', '顯示名稱', '翻譯', '語言', '在地化', '標籤'],
    },
  },

  instrumentGroups: {
    group: 'sound',
    summary: {
      en: 'Groups the instruments by category in picker order: [{ id, label, items }], with empty groups left out.',
      zh: '把樂器依類別分組，照選單的順序：[{ id, label, items }]，沒有樂器的組會省略。',
    },
    params: [
      { name: 'lang', type: 'String', optional: true, default: "'en'", en: 'The language of the group labels.', zh: '組別標籤的語言。' },
      { name: 'list', type: 'Object[]', optional: true, default: 'listInstruments()', en: 'The instruments to group. Left out, all the registered ones.', zh: '要分組的樂器。沒給的話，就是所有登記過的。' },
    ],
    returns: { type: 'Object[]', en: '`[{ id, label, items: [definition…] }]`: the groups in the order of [`CATEGORIES`](#CATEGORIES), then any categories of your own, sorted by name.', zh: '`[{ id, label, items: [定義…] }]`：各組依 [`CATEGORIES`](#CATEGORIES) 的順序，接著是你自己的類別，依名稱排序。' },
    description: [
      {
        en: "It is the data behind the picker, so you can build your own menu, a list or a grid of buttons. A category that is not in `CATEGORIES` is allowed; it sorts after the known ones and its `label` is its id.",
        zh: "這就是選單背後的資料，所以你可以自己做選單、清單或一排按鈕。不在 `CATEGORIES` 裡的類別也可以，它排在已知的類別後面，`label` 就是它的 id。",
      },
    ],
    examples: [
      {
        code: `import { instrumentGroups } from '@openav/sound';

for (const g of instrumentGroups('en')) console.log(g.label + ' (' + g.items.length + ')');
// Keys (2), Mallets (5), Strings (1), Plucked (1), Organ (1), Voice (1), Synth (11)
console.log(instrumentGroups('zh')[1].label);   // the Chinese label of the mallets group`,
        caption: { en: 'The seven groups the built-in instruments make, with how many each holds (no drums yet, so that group is left out), and a group label in Chinese.', zh: '內建樂器組成的七個組，各有幾個樂器（還沒有鼓，所以那一組省略），以及一個中文的組別標籤。' },
      },
    ],
    related: ['listInstruments', 'CATEGORIES', 'instrumentName', 'mountSoundPicker'],
    keywords: {
      en: ['groups', 'categories', 'optgroup', 'menu data', 'picker data', 'organize'],
      zh: ['分組', '類別', '選單資料', '整理'],
    },
  },

  onInstrumentsChange: {
    group: 'sound',
    summary: {
      en: 'Calls your function whenever an instrument is registered or removed, so a menu can refresh. Returns a function that stops listening.',
      zh: '每當有樂器被登記或移除，就呼叫你的函式，讓選單可以更新。回傳一個停止監聽的函式。',
    },
    params: [
      { name: 'cb', type: 'Function', en: '`cb({ type, id })` with `type` `\'register\'` or `\'unregister\'`. An error inside it is logged and does not stop the others.', zh: '`cb({ type, id })`，`type` 是 `\'register\'` 或 `\'unregister\'`。裡面出錯只會被記在 console，不會影響其他監聽者。' },
    ],
    returns: { type: 'Function', en: 'Call it to stop listening.', zh: '呼叫它就停止監聽。' },
    description: [
      {
        en: "[`mountSoundPicker()`](#mountSoundPicker) listens this way, which is why an instrument registered after the picker was built still shows up. A replacement with `{ replace: true }` also reports `register`. A call to `unregisterInstrument()` for an id that is not there reports nothing.",
        zh: "[`mountSoundPicker()`](#mountSoundPicker) 就是這樣在聽，所以選單蓋好之後才登記的樂器也會出現。用 `{ replace: true }` 取代也會通報 `register`。對不存在的 id 呼叫 `unregisterInstrument()` 不會通報。",
      },
    ],
    examples: [
      {
        code: `import { onInstrumentsChange, registerInstrument, unregisterInstrument } from '@openav/sound';

const seen = [];
const stop = onInstrumentsChange((e) => seen.push(e.type + ' ' + e.id));
const def = { id: 'me/x', name: 'X', category: 'other', create: () => ({ noteOn() {}, noteOff() {}, dispose() {} }) };
registerInstrument(def);
unregisterInstrument('me/x');
stop();
registerInstrument(def); unregisterInstrument('me/x');        // nobody is listening now
console.log(seen.join(' | '));                                  // register me/x | unregister me/x`,
        caption: { en: 'Records two changes while listening, then stops listening and shows that the next two are not reported.', zh: '聽的時候記下兩次變化，然後停止監聽，顯示接下來的兩次不會被通報。' },
      },
    ],
    related: ['registerInstrument', 'unregisterInstrument', 'mountSoundPicker'],
    keywords: {
      en: ['listen', 'subscribe', 'change event', 'register event', 'refresh', 'observer'],
      zh: ['監聽', '訂閱', '變化事件', '登記事件', '更新', '觀察者'],
    },
  },

  validateInstrument: {
    group: 'sound',
    summary: {
      en: 'Checks an instrument definition and lists everything wrong with it as readable sentences. An empty list means it is valid.',
      zh: '檢查一個樂器定義，把有問題的地方都列成看得懂的句子。空的清單表示沒問題。',
    },
    params: [
      { name: 'def', type: 'any', en: 'The definition to check.', zh: '要檢查的定義。' },
    ],
    returns: { type: 'String[]', en: 'Sentences, one per problem. `[]` when valid. It never throws.', zh: '句子，每個問題一句。沒問題就是 `[]`。它不會丟出錯誤。' },
    description: [
      {
        en: "It checks: `id` (lowercase letters, digits and `-`, at most one `/`), `name` (a string, or `{ en, zh }` with at least `en`), `category` (a string), `create` (a function), `params` (each with a word as `key`, numbers `min < max`, a `def` within them, and a key that is not one of the shared three), `defaults` (only `cutoff`, `space` or `volume`, each within its range), `credit` (a string, or `{ text, url }`), `gain`, `transpose` and `tail` (numbers) and `fallback` (another instrument's id). [`registerInstrument()`](#registerInstrument) runs it and throws with these sentences.",
        zh: "它檢查：`id`（小寫字母、數字和 `-`，最多一個 `/`）、`name`（字串，或至少有 `en` 的 `{ en, zh }`）、`category`（字串）、`create`（函式）、`params`（每個的 `key` 是一個單字，`min < max` 是數字，`def` 在兩者之間，而且 key 不是共用的那三個之一）、`defaults`（只能是 `cutoff`、`space`、`volume`，且各自在範圍內）、`credit`（字串，或 `{ text, url }`）、`gain`、`transpose`、`tail`（數字），以及 `fallback`（另一個樂器的 id）。[`registerInstrument()`](#registerInstrument) 會執行它，並用這些句子丟出錯誤。",
      },
    ],
    examples: [
      {
        code: `import { validateInstrument } from '@openav/sound';

const ok = { id: 'me/ok', name: 'OK', category: 'other', create() {} };
console.log(validateInstrument(ok));                          // []
console.log(validateInstrument({ ...ok, id: 'Piano', params: [{ key: 'cutoff', min: 0, max: 1, def: 0 }] }));
// [ 'id "Piano": lowercase letters, digits and "-", at most one "/" (e.g. "synth/pad")',
//   'params[0] (cutoff): "cutoff" is a shared sound param; set its starting value with defaults: { cutoff: … }' ]
console.log(validateInstrument(null));                        // [ 'an instrument definition is an object' ]`,
        caption: { en: 'A good definition gives an empty list; a definition with a capital letter in the id and a param that is already shared gets two sentences.', zh: '好的定義得到空清單。id 有大寫字母、又有一個已經是共用參數的定義，得到兩句話。' },
      },
    ],
    related: ['registerInstrument', 'validateSynthPreset', 'SOUND_PARAMS'],
    keywords: {
      en: ['validate', 'check definition', 'errors', 'lint', 'instrument rules'],
      zh: ['驗證', '檢查定義', '錯誤', '樂器規則', '問題清單'],
    },
  },

  SOUND_PARAMS: {
    group: 'sound',
    summary: {
      en: 'The three params every instrument shares: cutoff (the filter), space (the reverb) and volume.',
      zh: '每個樂器共用的三個參數：cutoff（濾波器）、space（殘響）和 volume（音量）。',
    },
    value: {
      type: 'Object[]',
      en: '`[{ key: \'cutoff\', min: 100, max: 8000, def: 2500 }, { key: \'space\', min: 0, max: 1, def: 0.3 }, { key: \'volume\', min: -36, max: 0, def: -8 }]`, each also with a `label`.',
      zh: '`[{ key: \'cutoff\', min: 100, max: 8000, def: 2500 }, { key: \'space\', min: 0, max: 1, def: 0.3 }, { key: \'volume\', min: -36, max: 0, def: -8 }]`，每個還有一個 `label`。',
    },
    description: [
      {
        en: "`cutoff` is the low-pass filter's frequency in Hz, `space` is how much reverb is mixed in (the wet amount, 0..1), `volume` is the level in dB. They sit after the instrument on the output chain, so the timeline, a knob or a hand keep performing them across instrument switches. In a show they are the params `sound/cutoff`, `sound/space` and `sound/volume`. An instrument may suggest other starting values through its `defaults`, and automation and overrides always win over a suggestion. An instrument's own `params` cannot use these keys.",
        zh: "`cutoff` 是低通濾波器的頻率，單位是 Hz，`space` 是混進去多少殘響（濕度，0..1），`volume` 是音量，單位是 dB。它們在輸出鏈上排在樂器之後，所以換樂器的時候，時間軸、旋鈕或一隻手可以繼續演奏它們。在演出裡它們是參數 `sound/cutoff`、`sound/space`、`sound/volume`。樂器可以用它的 `defaults` 建議不同的起始值，自動化和覆寫永遠贏過建議。樂器自己的 `params` 不能用這幾個鍵。",
      },
    ],
    examples: [
      {
        code: `import { SOUND_PARAMS } from '@openav/sound';

console.log(SOUND_PARAMS.map((p) => p.key + ' ' + p.min + '..' + p.max + ' (' + p.def + ')').join(' | '));
// cutoff 100..8000 (2500) | space 0..1 (0.3) | volume -36..0 (-8)`,
        caption: { en: 'Logs the range and the default of each shared param.', zh: '印出每個共用參數的範圍和預設值。' },
      },
    ],
    related: ['toneEngine', 'Sound', 'registerInstrument'],
    keywords: {
      en: ['params', 'cutoff', 'space', 'reverb', 'volume', 'filter', 'shared', 'sound/cutoff'],
      zh: ['參數', 'cutoff', 'space', '殘響', '音量', '濾波器', '共用', 'sound/cutoff'],
    },
  },

  CATEGORIES: {
    group: 'sound',
    summary: {
      en: 'The instrument categories in picker order: keys, mallets, strings, plucked, organ, voice, synth, drums and other.',
      zh: '樂器的類別，照選單的順序：keys、mallets、strings、plucked、organ、voice、synth、drums、other。',
    },
    value: {
      type: 'Object[]',
      en: 'Nine items `{ id, name: { en, zh } }`, such as `{ id: \'mallets\', name: { en: \'Mallets\', zh: … } }`.',
      zh: '九個項目 `{ id, name: { en, zh } }`，例如 `{ id: \'mallets\', name: { en: \'Mallets\', zh: \'敲擊琴\' } }`。',
    },
    description: [
      {
        en: "The `category` of an instrument definition picks its group in the picker. A category that is not in this list is allowed: it sorts after these, and its label is its id. Every category also has a Chinese name, which the picker uses on a Chinese page.",
        zh: "樂器定義的 `category` 決定它在選單裡的組別。不在這份清單裡的類別也可以，它排在這些後面，標籤就是它的 id。中文名稱是 鍵盤、敲擊琴、弦樂、撥弦、風琴、人聲、合成器、鼓、其他。",
      },
    ],
    examples: [
      {
        code: `import { CATEGORIES } from '@openav/sound';

console.log(CATEGORIES.map((c) => c.id).join(' '));   // keys mallets strings plucked organ voice synth drums other
console.log(CATEGORIES[1].name.en, CATEGORIES[1].name.zh);`,
        caption: { en: 'Logs the nine ids in order and the English and Chinese name of the second.', zh: '依序印出九個 id，以及第二個的英文和中文名稱。' },
      },
    ],
    related: ['instrumentGroups', 'registerInstrument', 'listInstruments'],
    keywords: {
      en: ['categories', 'groups', 'keys', 'mallets', 'strings', 'synth', 'picker order'],
      zh: ['類別', '分組', '鍵盤', '敲擊琴', '弦樂', '合成器', '選單順序'],
    },
  },

  DEFAULT_INSTRUMENT: {
    group: 'sound',
    summary: {
      en: "The instrument used when none is named: 'synth/pad', the warm three-saw pad that was the framework's first voice.",
      zh: "沒指定樂器時用的那個：'synth/pad'，由三個鋸齒波組成的溫暖襯底，是這個框架最早的聲音。",
    },
    value: { type: 'String', en: '`\'synth/pad\'`.', zh: '字串 `\'synth/pad\'`。' },
    description: [
      {
        en: "[`toneEngine()`](#toneEngine) starts on it, and falls back to it when you name an instrument that is not registered. Its sound has not changed since the first version.",
        zh: "[`toneEngine()`](#toneEngine) 一開始用它，你指定了沒登記的樂器時也退回它。它的聲音從第一版以來沒有變過。",
      },
    ],
    examples: [
      {
        code: `import { DEFAULT_INSTRUMENT, getInstrument, instrumentName, toneEngine } from '@openav/sound';

console.log(DEFAULT_INSTRUMENT, '-', instrumentName(getInstrument(DEFAULT_INSTRUMENT)));   // synth/pad - Warm pad
console.log(toneEngine().instrument === DEFAULT_INSTRUMENT);                                 // true`,
        caption: { en: 'Logs the default instrument and its name, and that an engine with no options starts on it.', zh: '印出預設樂器和它的名字，以及沒給任何選項的引擎一開始用的就是它。' },
      },
    ],
    related: ['toneEngine', 'BUILTIN_INSTRUMENTS', 'SYNTH_PRESETS'],
    keywords: {
      en: ['default instrument', 'pad', 'warm pad', 'synth/pad', 'start sound'],
      zh: ['預設樂器', '襯底', '溫暖襯底', 'synth/pad', '起始聲音'],
    },
  },

  TONE_CDN: {
    group: 'sound',
    summary: {
      en: 'The address Tone.js is loaded from when the engine is enabled: Tone 15.0.4 on jsDelivr.',
      zh: '引擎啟用時載入 Tone.js 的位址：jsDelivr 上的 Tone 15.0.4。',
    },
    value: { type: 'String', en: '`\'https://cdn.jsdelivr.net/npm/tone@15.0.4/+esm\'`.', zh: '字串 `\'https://cdn.jsdelivr.net/npm/tone@15.0.4/+esm\'`。' },
    description: [
      {
        en: "A module URL that `toneEngine()` imports on `enable()`. To host Tone.js yourself, pass your own as the `cdn` option of [`toneEngine()`](#toneEngine).",
        zh: "`toneEngine()` 在 `enable()` 時匯入的模組網址。想自己放 Tone.js 的話，把你的網址當作 [`toneEngine()`](#toneEngine) 的 `cdn` 選項。",
      },
    ],
    examples: [
      {
        code: `import { TONE_CDN, toneEngine } from '@openav/sound';

console.log(TONE_CDN);   // https://cdn.jsdelivr.net/npm/tone@15.0.4/+esm
const own = toneEngine({ cdn: '/vendor/tone.mjs' });   // your own copy, used when enable() runs`,
        caption: { en: 'Logs the default address and shows where an own copy would be given.', zh: '印出預設位址，並示範自己的備份要寫在哪裡。' },
      },
    ],
    related: ['toneEngine', 'SAMPLES_URL'],
    keywords: {
      en: ['tone.js', 'cdn', 'jsdelivr', 'url', 'version', 'host yourself'],
      zh: ['tone.js', 'cdn', 'jsdelivr', '網址', '版本', '自己放'],
    },
  },

  SAMPLES_URL: {
    group: 'sound',
    summary: {
      en: 'The address of the folder with the built-in sample sets, when nobody says otherwise: openaudiovisual.com/packages/sound/samples/.',
      zh: '沒有人指定時，內建取樣組所在資料夾的位址：openaudiovisual.com/packages/sound/samples/。',
    },
    value: { type: 'String', en: '`\'https://openaudiovisual.com/packages/sound/samples/\'`, ending in a slash.', zh: '`\'https://openaudiovisual.com/packages/sound/samples/\'`，以斜線結尾。' },
    description: [
      {
        en: "It is the default `baseUrl` of [`toneEngine()`](#toneEngine). The piano reads its 30 mp3 files from the `salamander/` folder under it. The server sends CORS headers, so any page can load them. `createShow()` points the engine at the copy next to the page instead. To use your own copy, give `baseUrl`, or `instruments: { piano: { baseUrl } }` for the piano alone.",
        zh: "它是 [`toneEngine()`](#toneEngine) 的 `baseUrl` 預設值。鋼琴從它底下的 `salamander/` 資料夾讀 30 個 mp3 檔。伺服器有送 CORS 標頭，所以任何頁面都能載入。`createShow()` 會改指向頁面旁邊的那一份。要用自己的備份，就給 `baseUrl`，只想換鋼琴的話給 `instruments: { piano: { baseUrl } }`。",
      },
    ],
    examples: [
      {
        code: `import { SAMPLES_URL, toneEngine } from '@openav/sound';

console.log(SAMPLES_URL);   // https://openaudiovisual.com/packages/sound/samples/
const local = toneEngine({ instrument: 'piano', baseUrl: '/my/samples/' });   // the piano then reads /my/samples/salamander/…`,
        caption: { en: 'Logs the default folder and shows how to point the engine at your own.', zh: '印出預設資料夾，並示範怎麼讓引擎指向你自己的。' },
      },
    ],
    related: ['toneEngine', 'TONE_CDN', 'salamanderMap'],
    keywords: {
      en: ['samples', 'base url', 'salamander', 'piano samples', 'mp3', 'cors', 'host samples'],
      zh: ['取樣', '基底網址', 'salamander', '鋼琴取樣', 'mp3', 'cors', '自己放取樣'],
    },
  },

  BUILTIN_INSTRUMENTS: {
    group: 'sound',
    summary: {
      en: 'The 22 instruments that come with the package, as definitions: a grand piano, mallets, strings, harp, organ, choir and 11 synth presets.',
      zh: '套件內建的 22 個樂器的定義：平台鋼琴、敲擊琴、弦樂、豎琴、風琴、合唱和 11 個合成器預設。',
    },
    value: {
      type: 'Object[]',
      en: 'An array of 22 instrument definitions, in the order of the table.',
      zh: '一個有 22 個樂器定義的陣列，順序跟下面的表一樣。',
    },
    description: [
      {
        en: "```text\nid                 category  name\npiano              keys      Grand piano (Salamander), 30 samples, CC-BY 3.0\nepiano             keys      Electric piano (two FM pairs and a tremolo)\nxylophone          mallets   Xylophone (sounds an octave up)\nmarimba            mallets   Marimba\nvibraphone         mallets   Vibraphone (motor tremolo, key-up damps)\nglockenspiel       mallets   Glockenspiel (two octaves up)\nmusic-box          mallets   Music box (two octaves up)\nstrings            strings   String ensemble\nharp               plucked   Harp (Karplus-Strong)\norgan              organ     Drawbar organ (rotary tremolo)\nchoir              voice     Choir pad (aah)\nsynth/pad          synth     Warm pad (the default)\nsynth/saw-lead     synth     Saw lead\nsynth/square-lead  synth     Square lead\nsynth/pluck        synth     Pluck\nsynth/supersaw     synth     Supersaw\nsynth/bass         synth     Analog bass\nsynth/acid         synth     Acid\nsynth/brass        synth     Synth brass\nsynth/bell         synth     FM bell\nsynth/sub          synth     Sub bass\nsynth/chip         synth     Chip (8-bit)\n```",
        zh: "```text\nid                 類別      名稱\npiano              keys      平台鋼琴（Salamander），30 個取樣，CC-BY 3.0\nepiano             keys      電鋼琴（兩組 FM 加顫音）\nxylophone          mallets   木琴（高一個八度）\nmarimba            mallets   馬林巴\nvibraphone         mallets   顫音琴（馬達顫音，放開鍵會止音）\nglockenspiel       mallets   鐵琴（高兩個八度）\nmusic-box          mallets   音樂盒（高兩個八度）\nstrings            strings   弦樂合奏\nharp               plucked   豎琴（Karplus-Strong）\norgan              organ     音栓風琴（旋轉喇叭顫音）\nchoir              voice     合唱襯底（啊）\nsynth/pad          synth     溫暖襯底（預設）\nsynth/saw-lead     synth     鋸齒波主奏\nsynth/square-lead  synth     方波主奏\nsynth/pluck        synth     撥奏\nsynth/supersaw     synth     超級鋸齒波\nsynth/bass         synth     類比貝斯\nsynth/acid         synth     酸性 303\nsynth/brass        synth     合成銅管\nsynth/bell         synth     FM 鐘聲\nsynth/sub          synth     超低音\nsynth/chip         synth     晶片音（8-bit）\n```",
      },
      {
        en: "Loading the package registers all of them, except those whose id you registered first. Each one is a small file in the package's `instruments/` folder. The piano loads its samples only when it is picked, and falls back to the electric piano if they cannot be fetched. The organ, the strings, the choir, the electric piano and the vibraphone bring params of their own.",
        zh: "載入套件就會登記全部，除非你先登記了同樣 id 的樂器。每一個都是套件的 `instruments/` 資料夾裡的一個小檔案。鋼琴只有在被選到的時候才載入取樣，取樣抓不到就退回電鋼琴。風琴、弦樂、合唱、電鋼琴和顫音琴有自己的參數。",
      },
    ],
    examples: [
      {
        code: `import { BUILTIN_INSTRUMENTS, getInstrument } from '@openav/sound';

console.log(BUILTIN_INSTRUMENTS.length);                                       // 22
console.log(BUILTIN_INSTRUMENTS.slice(0, 3).map((d) => d.id).join(' '));      // piano epiano xylophone
console.log(getInstrument('piano') === BUILTIN_INSTRUMENTS[0]);                // true: they are the registered ones
console.log(getInstrument('organ').params.map((p) => p.key).join(' '));        // drawbars rotor`,
        caption: { en: 'How many built-in instruments there are, the first three, and that the registry holds these very objects. The organ lists the two params of its own.', zh: '有幾個內建樂器、前三個，以及登記表裡放的就是這些物件。風琴列出它自己的兩個參數。' },
      },
    ],
    related: ['listInstruments', 'SYNTH_PRESETS', 'DEFAULT_INSTRUMENT', 'registerInstrument', 'getInstrument'],
    keywords: {
      en: ['built-in', 'instruments', 'piano', 'organ', 'strings', 'marimba', 'vibraphone', 'choir', 'harp', 'what sounds are there'],
      zh: ['內建', '樂器', '鋼琴', '風琴', '弦樂', '馬林巴', '顫音琴', '合唱', '豎琴', '有哪些聲音'],
    },
  },

  SYNTH_PRESETS: {
    group: 'sound',
    summary: {
      en: 'The 11 synth presets as plain data: pad, saw lead, square lead, pluck, supersaw, bass, acid, brass, bell, sub and chip.',
      zh: '11 個合成器預設，是單純的資料：pad、saw lead、square lead、pluck、supersaw、bass、acid、brass、bell、sub、chip。',
    },
    value: {
      type: 'Object[]',
      en: 'An array of 11 presets `{ id, name: { en, zh }, voice, … }`: `pad`, `saw-lead`, `square-lead`, `pluck`, `supersaw`, `bass`, `acid`, `brass`, `bell`, `sub`, `chip`.',
      zh: '一個有 11 個預設的陣列 `{ id, name: { en, zh }, voice, … }`：`pad`、`saw-lead`、`square-lead`、`pluck`、`supersaw`、`bass`、`acid`、`brass`、`bell`、`sub`、`chip`。',
    },
    description: [
      {
        en: "Each preset is what [`synthInstrument()`](#synthInstrument) turns into an instrument `synth/<id>`. They are data in Tone.js's own vocabulary (`oscillator`, `envelope`, `filter`, `filterEnvelope`, `harmonicity`…), a good place to look when you write a preset of your own for [`registerSynthPreset()`](#registerSynthPreset). The `pad` is the framework's original voice: three detuned sawtooth waves with a quick attack and a long release.",
        zh: "每個預設都會被 [`synthInstrument()`](#synthInstrument) 變成一個樂器 `synth/<id>`。它們是用 Tone.js 自己的詞彙寫的資料（`oscillator`、`envelope`、`filter`、`filterEnvelope`、`harmonicity`…），要為 [`registerSynthPreset()`](#registerSynthPreset) 寫自己的預設時，是個好的參考。`pad` 是框架最早的聲音：三個失諧的鋸齒波，起音快、釋放長。",
      },
    ],
    examples: [
      {
        code: `import { SYNTH_PRESETS } from '@openav/sound';

console.log(SYNTH_PRESETS.map((p) => p.id).join(' '));
// pad saw-lead square-lead pluck supersaw bass acid brass bell sub chip
const bass = SYNTH_PRESETS.find((p) => p.id === 'bass');
console.log(bass.voice, bass.octave, bass.oscillator.type);   // mono -1 fatsawtooth`,
        caption: { en: 'Lists the preset ids and reads a few settings of the bass: a mono synth with a filter, an octave down.', zh: '列出預設的 id，並讀貝斯的幾個設定：有濾波器的單音合成器，降一個八度。' },
      },
    ],
    related: ['synthInstrument', 'registerSynthPreset', 'validateSynthPreset', 'BUILTIN_INSTRUMENTS'],
    keywords: {
      en: ['synth presets', 'pad', 'lead', 'bass', 'acid', 'supersaw', 'pluck', 'bell', 'chip', 'data'],
      zh: ['合成器預設', '襯底', '主奏', '貝斯', '酸性', '超級鋸齒波', '撥奏', '鐘聲', '晶片音', '資料'],
    },
  },

  synthInstrument: {
    group: 'sound',
    summary: {
      en: 'Turns a synth preset into an instrument definition whose id is synth/ followed by the preset id, without registering it.',
      zh: '把一個合成器預設變成樂器定義，id 是 synth/ 加上預設的 id，但不登記它。',
    },
    params: [
      { name: 'preset', type: 'Object', en: 'The preset, see [`registerSynthPreset()`](#registerSynthPreset). A preset that [`validateSynthPreset()`](#validateSynthPreset) refuses throws a `TypeError`.', zh: '預設，見 [`registerSynthPreset()`](#registerSynthPreset)。[`validateSynthPreset()`](#validateSynthPreset) 不接受的預設會丟出 `TypeError`。' },
    ],
    returns: { type: 'Object', en: 'An instrument definition: `id` is `\'synth/\' + preset.id`, `name` the preset\'s (or its id), `category` the preset\'s or `\'synth\'`, `transpose` is `octave × 12`, `gain`, `defaults`, `params` and `credit` come from the preset, `tail` is `min(8, release × 1.5 + 0.5)` seconds and `preset` is the preset itself.', zh: '一個樂器定義：`id` 是 `\'synth/\' + preset.id`，`name` 用預設的（沒有就用它的 id），`category` 用預設的或 `\'synth\'`，`transpose` 是 `octave × 12`，`gain`、`defaults`、`params`、`credit` 來自預設，`tail` 是 `min(8, release × 1.5 + 0.5)` 秒，`preset` 是預設本身。' },
    description: [
      {
        en: "The definition's `create()` builds one `Tone.PolySynth` of the preset's `voice` (`synth`, `mono`, `fm` or `am`), with the Tone settings the preset carries, a chain of its `effects`, and its `polyphony` (16 voices if left out). Use it when you want the definition for yourself (to adjust it before registering); otherwise [`registerSynthPreset()`](#registerSynthPreset) does both steps.",
        zh: "這個定義的 `create()` 會建一個 `Tone.PolySynth`，聲部是預設的 `voice`（`synth`、`mono`、`fm` 或 `am`），帶著預設的 Tone 設定、一串 `effects` 效果，以及它的 `polyphony`（沒給就是 16 個聲部）。想自己拿到這個定義（登記前先調整）時才用它。否則 [`registerSynthPreset()`](#registerSynthPreset) 兩步一起做完。",
      },
    ],
    examples: [
      {
        code: `import { synthInstrument, validateInstrument } from '@openav/sound';

const def = synthInstrument({ id: 'glass', name: 'Glass', voice: 'fm', octave: -1, gain: -3, envelope: { release: 2 } });
console.log(def.id, def.category, def.transpose, def.gain, def.tail);   // synth/glass synth -12 -3 3.5
console.log(validateInstrument(def));                                    // []
try { synthInstrument({ id: 'Glass!' }); } catch (e) { console.log(e instanceof TypeError); }   // true`,
        caption: { en: 'A preset becomes a valid instrument definition: an octave down is 12 semitones, and the tail follows the release. A bad id throws.', zh: '一個預設變成合格的樂器定義：降一個八度是 12 個半音，尾巴長度跟著釋放時間走。壞的 id 會丟出錯誤。' },
      },
    ],
    related: ['registerSynthPreset', 'SYNTH_PRESETS', 'validateSynthPreset', 'registerInstrument'],
    keywords: {
      en: ['synth', 'preset to instrument', 'polysynth', 'convert', 'definition', 'fm', 'mono'],
      zh: ['合成器', '預設轉樂器', '複音合成器', '轉換', '定義', 'fm', '單音'],
    },
  },

  registerSynthPreset: {
    group: 'sound',
    summary: {
      en: 'Adds a synth preset to every picker as synth/ plus its id: describe the voice, the envelope and the effects as data.',
      zh: '把一個合成器預設加到每個選單，名稱是 synth/ 加上它的 id：把聲部、包絡和效果寫成資料就好。',
    },
    params: [
      { name: 'preset', type: 'Object', en: 'The preset: `{ id, name, voice, … }`, see below.', zh: '預設：`{ id, name, voice, … }`，見下面。' },
      { name: 'opts', type: 'Object', optional: true, en: 'The options of [`registerInstrument()`](#registerInstrument): `{ replace: true }` swaps an existing one.', zh: '[`registerInstrument()`](#registerInstrument) 的選項：`{ replace: true }` 會換掉現有的。' },
    ],
    returns: { type: 'Object', en: 'The instrument definition that was registered ([`synthInstrument()`](#synthInstrument) of the preset).', zh: '被登記的那個樂器定義（這個預設的 [`synthInstrument()`](#synthInstrument)）。' },
    description: [
      {
        en: "A preset names a `voice`, its settings in Tone.js's vocabulary, and an optional effects chain, and nothing else. `id` is lowercase letters, digits and `-` (it becomes `synth/<id>`), `name` is a string or `{ en, zh }`. `voice` is `'synth'` (oscillator and envelope), `'mono'` (adds a resonant filter with its own envelope), `'fm'` or `'am'`. The Tone settings are `oscillator`, `envelope`, `filter`, `filterEnvelope`, `harmonicity`, `modulationIndex`, `modulation`, `modulationEnvelope`, `detune` and `portamento`. The rest: `octave` (a whole number of octaves, `-1` for a bass), `gain` (dB, to level it against the others), `polyphony`, `defaults` (starting `cutoff`, `space`, `volume`), `params`, `category` and `credit`, as in [`registerInstrument()`](#registerInstrument).",
        zh: "一個預設只有這些：一個 `voice`、用 Tone.js 的詞彙寫的設定，和選用的效果鏈。`id` 是小寫字母、數字和 `-`（會變成 `synth/<id>`），`name` 是字串或 `{ en, zh }`。`voice` 是 `'synth'`（振盪器加包絡）、`'mono'`（多一個有自己包絡的共振濾波器）、`'fm'` 或 `'am'`。Tone 的設定有 `oscillator`、`envelope`、`filter`、`filterEnvelope`、`harmonicity`、`modulationIndex`、`modulation`、`modulationEnvelope`、`detune`、`portamento`。其他的：`octave`（整數個八度，貝斯用 `-1`）、`gain`（dB，用來跟別的樂器配音量）、`polyphony`、`defaults`（起始的 `cutoff`、`space`、`volume`）、`params`、`category`、`credit`，跟 [`registerInstrument()`](#registerInstrument) 一樣。",
      },
      {
        en: "`effects` is a list of `{ type, …settings }` that the sound passes through in order. The types are `chorus`, `delay`, `pingpong`, `distortion`, `vibrato`, `tremolo`, `phaser`, `autofilter`, `filter`, `eq`, `compressor`, `chebyshev` and `widener`; the other keys are the effect's own Tone settings, including `wet`. A preset that is wrong throws a `TypeError` with the reasons.",
        zh: "`effects` 是一串 `{ type, …設定 }`，聲音依序通過它們。種類有 `chorus`、`delay`、`pingpong`、`distortion`、`vibrato`、`tremolo`、`phaser`、`autofilter`、`filter`、`eq`、`compressor`、`chebyshev`、`widener`。其他的鍵是那個效果自己的 Tone 設定，包括 `wet`。不合格的預設會丟出 `TypeError` 並說明原因。",
      },
    ],
    examples: [
      {
        code: `import { registerSynthPreset, getInstrument, unregisterInstrument } from '@openav/sound';

const def = registerSynthPreset({
  id: 'glass', name: { en: 'Glass', zh: '玻璃' },
  voice: 'fm', harmonicity: 3.01, modulationIndex: 14,
  envelope: { attack: 0.002, decay: 1.4, sustain: 0, release: 1.2 },
  effects: [{ type: 'chorus', frequency: 1.5, depth: 0.4, wet: 0.3 }],
});
console.log(def.id, getInstrument('synth/glass') === def);   // synth/glass true: it is in every picker now
unregisterInstrument('synth/glass');`,
        caption: { en: 'Registers an FM bell-like sound as plain data. It appears under Synth in the picker as "Glass".', zh: '把一個像 FM 鐘的聲音當作單純的資料登記。它會以「Glass」出現在選單的 Synth 組裡。' },
      },
    ],
    related: ['synthInstrument', 'SYNTH_PRESETS', 'validateSynthPreset', 'registerInstrument', 'modalInstrument'],
    keywords: {
      en: ['synth preset', 'add a synth', 'fm', 'envelope', 'effects', 'chorus', 'delay', 'custom synth', 'tone.js'],
      zh: ['合成器預設', '加合成器', 'fm', '包絡', '效果', '合唱效果', '延遲', '自訂合成器', 'tone.js'],
    },
  },

  validateSynthPreset: {
    group: 'sound',
    summary: {
      en: 'Checks a synth preset and lists what is wrong with it. An empty list means it is valid.',
      zh: '檢查一個合成器預設，列出有問題的地方。空的清單表示沒問題。',
    },
    params: [
      { name: 'p', type: 'Object', en: 'The preset to check.', zh: '要檢查的預設。' },
    ],
    returns: { type: 'String[]', en: 'Sentences, one per problem. `[]` when valid.', zh: '句子，每個問題一句。沒問題就是 `[]`。' },
    description: [
      {
        en: "It checks the `id` (lowercase letters, digits and `-`), the `voice` (`synth`, `mono`, `fm` or `am`), that every effect has a `type` the package knows, and that `octave` is a whole number. It does not check the Tone settings, which are Tone.js's to judge.",
        zh: "它檢查 `id`（小寫字母、數字和 `-`）、`voice`（`synth`、`mono`、`fm` 或 `am`）、每個效果的 `type` 是不是套件認得的，以及 `octave` 是不是整數。Tone 的設定它不檢查，那是 Tone.js 的事。",
      },
    ],
    examples: [
      {
        code: `import { validateSynthPreset } from '@openav/sound';

console.log(validateSynthPreset({ id: 'glass', voice: 'fm', effects: [{ type: 'chorus' }] }));   // []
console.log(validateSynthPreset({ id: 'Glass', voice: 'laser', effects: [{ type: 'zz' }], octave: 1.5 }));
// [ 'id "Glass": lowercase letters, digits and "-" (it becomes "synth/<id>")',
//   'voice "laser": one of synth, mono, fm, am',
//   'effects[0].type "zz": one of chorus, delay, pingpong, distortion, vibrato, tremolo, phaser, autofilter, filter, eq, compressor, chebyshev, widener',
//   'octave: a whole number' ]`,
        caption: { en: 'A good preset gives an empty list; a preset with four mistakes gets one sentence for each.', zh: '好的預設得到空清單。有四個錯誤的預設，每個錯誤得到一句話。' },
      },
    ],
    related: ['registerSynthPreset', 'synthInstrument', 'validateInstrument'],
    keywords: {
      en: ['validate preset', 'check', 'errors', 'synth rules'],
      zh: ['驗證預設', '檢查', '錯誤', '合成器規則'],
    },
  },

  modalInstrument: {
    group: 'sound',
    summary: {
      en: 'Makes a struck-bar or tine instrument from data: a list of partials that ring and die away, and a short noise for the mallet.',
      zh: '用資料做出敲擊的音條或音叉類樂器：一串會響然後衰減的泛音，加上一小段代表槌子的雜訊。',
    },
    params: [
      { name: 'id', type: 'String', optional: false, en: 'The instrument id (see [`registerInstrument()`](#registerInstrument)).', zh: '樂器的 id（見 [`registerInstrument()`](#registerInstrument)）。' },
      { name: 'name', type: 'String | Object', optional: false, en: 'The name: a string, or `{ en, zh }`.', zh: '名稱：字串，或 `{ en, zh }`。' },
      { name: 'category', type: 'String', optional: true, default: "'mallets'", en: 'The picker group.', zh: '選單的組別。' },
      { name: 'credit', type: 'String | Object', optional: true, default: 'null', en: 'A credit line, a string or `{ text, url }`.', zh: '出處說明，字串或 `{ text, url }`。' },
      { name: 'params', type: 'Object[]', optional: true, en: 'Params of its own: `[{ key, label, min, max, def }]`. Handled by the `set` function.', zh: '它自己的參數：`[{ key, label, min, max, def }]`。由 `set` 函式處理。' },
      { name: 'defaults', type: 'Object', optional: true, default: '{ cutoff: 8000 }', en: 'Starting values for the shared params. The default opens the filter, because bars are bright.', zh: '共用參數的起始值。預設把濾波器打開，因為敲擊的音條聲音是亮的。' },
      { name: 'partials', type: 'Object[]', optional: false, en: 'The modes of the bar: `[{ ratio, gain, decay }]`. `ratio` is the frequency as a multiple of the note (1 is the note itself, 3 a twelfth above it), `gain` the level relative to the others and `decay` the seconds to near silence at middle C. High notes die faster than low ones. A partial above 45% of the sample rate is skipped. Required: without it this throws.', zh: '音條的各個振動模式：`[{ ratio, gain, decay }]`。`ratio` 是頻率相對於音符的倍數（1 是音符本身，3 是高一個十二度），`gain` 是相對於其他泛音的音量，`decay` 是在中央 C 衰減到幾乎無聲要幾秒。高音比低音消失得快。高於取樣率 45% 的泛音會被略過。必須給：沒給的話會丟出錯誤。' },
      { name: 'strike', type: 'Object', optional: true, default: 'null', en: 'The mallet, a few milliseconds of band-passed noise: `{ ratio, q, gain, decay }`, where `ratio` sets its pitch as a multiple of the note, `q` its width, `gain` its level and `decay` its length in seconds.', zh: '槌子，幾毫秒的帶通雜訊：`{ ratio, q, gain, decay }`，`ratio` 是它的音高相對於音符的倍數，`q` 是寬度，`gain` 是音量，`decay` 是長度，單位是秒。' },
      { name: 'damp', type: 'Number', optional: true, default: '0', en: 'Seconds in which letting go of a key mutes the bar. 0 lets the bars ring free (xylophone, glockenspiel); a vibraphone has a damper.', zh: '放開鍵之後幾秒內把音條止音。0 是讓音條自由響完（木琴、鐵琴）。顫音琴有止音器。' },
      { name: 'pitchDecay', type: 'Number', optional: true, default: '0.6', en: 'How much faster high notes die than low ones. The decay is scaled by `(261.63 / frequency) ^ pitchDecay`, held between 0.2 and 3. 0 makes every note last the same.', zh: '高音比低音消失得快多少。衰減時間會乘上 `(261.63 / 頻率) ^ pitchDecay`，限制在 0.2 到 3 之間。0 讓每個音一樣長。' },
      { name: 'transpose', type: 'Number', optional: true, default: '0', en: 'Semitones to shift what is played (the xylophone sounds an octave up: 12).', zh: '把演奏的音移幾個半音（木琴高一個八度：12）。' },
      { name: 'gain', type: 'Number', optional: true, default: '0', en: 'The instrument\'s level, in dB.', zh: '樂器的音量，單位是 dB。' },
      { name: 'attack', type: 'Number', optional: true, default: '0.0015', en: 'Seconds the partials take to reach full level.', zh: '泛音達到全音量要幾秒。' },
      { name: 'tremolo', type: 'Object', optional: true, default: 'null', en: 'A level wobble over all voices, the vibraphone\'s motor: `{ frequency, depth, spread }`.', zh: '所有聲部一起的音量起伏，也就是顫音琴的馬達：`{ frequency, depth, spread }`。' },
      { name: 'maxVoices', type: 'Number', optional: true, default: '40', en: 'How many notes can ring at once. The oldest is faded out in 30 ms when it is exceeded.', zh: '最多能同時響幾個音。超過的時候，最舊的會在 30 毫秒內淡出。' },
      { name: 'set', type: 'Function', optional: true, default: 'null', en: '`set({ key, value, tremolo, Tone })`, called when one of the instrument\'s own params changes, so it can change the tremolo or anything else.', zh: '`set({ key, value, tremolo, Tone })`，樂器自己的參數改變時呼叫，好讓它改顫音或別的東西。' },
    ],
    returns: { type: 'Object', en: 'An instrument definition, not yet registered: pass it to [`registerInstrument()`](#registerInstrument). `tail` is set to `min(8, longest decay × 1.5 + 0.2)` seconds.', zh: '一個還沒登記的樂器定義：交給 [`registerInstrument()`](#registerInstrument)。`tail` 設成 `min(8, 最長的衰減 × 1.5 + 0.2)` 秒。' },
    description: [
      {
        en: "A xylophone bar, a glockenspiel bar and a music-box tine are the same physics with different numbers: a strike excites a few modes, each rings at its own multiple of the pitch and dies at its own rate. So a mallet instrument here is data, not code. The built-in xylophone is this short:",
        zh: "木琴的音條、鐵琴的音條和音樂盒的音叉是同樣的物理，只是數字不同：敲一下激發出幾個振動模式，每個模式以自己的音高倍數響，用自己的速度消失。所以這裡的敲擊類樂器是資料，不是程式。內建的木琴就這麼短：",
      },
      {
        en: "```js\nmodalInstrument({\n  id: 'xylophone', name: { en: 'Xylophone', zh: '…' }, transpose: 12,\n  partials: [{ ratio: 1, gain: 1, decay: 0.9 }, { ratio: 3, gain: 0.32, decay: 0.32 }, { ratio: 6.1, gain: 0.1, decay: 0.1 }],\n  strike: { ratio: 5, q: 1.1, gain: 0.35, decay: 0.012 },\n  pitchDecay: 0.75,\n});\n```",
        zh: "```js\nmodalInstrument({\n  id: 'xylophone', name: { en: 'Xylophone', zh: '木琴' }, transpose: 12,\n  partials: [{ ratio: 1, gain: 1, decay: 0.9 }, { ratio: 3, gain: 0.32, decay: 0.32 }, { ratio: 6.1, gain: 0.1, decay: 0.1 }],\n  strike: { ratio: 5, q: 1.1, gain: 0.35, decay: 0.012 },\n  pitchDecay: 0.75,\n});\n```",
      },
      {
        en: "Harder strikes brighten: the upper partials grow faster with velocity, as a real mallet does. The voices are raw Web Audio nodes built for each strike and left to the garbage collector.",
        zh: "打得越用力越亮：高的泛音會隨力度長得比較快，真的槌子就是這樣。每個聲部都是每敲一下就建一組的原生 Web Audio 節點，用完交給垃圾回收。",
      },
    ],
    examples: [
      {
        code: `import { modalInstrument, registerInstrument, validateInstrument, getInstrument, unregisterInstrument } from '@openav/sound';

const bar = modalInstrument({
  id: 'me/steel-bar', name: { en: 'Steel bar', zh: '鋼片' },
  partials: [{ ratio: 1, gain: 1, decay: 2.5 }, { ratio: 2.76, gain: 0.4, decay: 1.2 }],
  strike: { ratio: 6, q: 1, gain: 0.3, decay: 0.01 },
});
console.log(bar.id, bar.category, bar.tail, validateInstrument(bar));   // me/steel-bar mallets 3.95 []
registerInstrument(bar);                                                  // now it is in every picker, under Mallets
console.log(getInstrument('me/steel-bar') === bar);                       // true
unregisterInstrument('me/steel-bar');`,
        caption: { en: 'Two partials and a mallet make a steel-bar instrument that validates and registers. It is only built, and heard, once the sound engine plays it.', zh: '兩個泛音加一個槌子，就做出一個鋼片樂器，驗證通過也能登記。要等發聲引擎真的播它的時候，它才會被建出來、被聽見。' },
      },
    ],
    related: ['registerInstrument', 'registerSynthPreset', 'validateInstrument', 'BUILTIN_INSTRUMENTS'],
    keywords: {
      en: ['modal synthesis', 'mallet', 'xylophone', 'marimba', 'vibraphone', 'glockenspiel', 'bar', 'partials', 'music box', 'percussion'],
      zh: ['模態合成', '敲擊', '木琴', '馬林巴', '顫音琴', '鐵琴', '音條', '泛音', '音樂盒', '打擊樂器'],
    },
  },

  soundOptions: {
    group: 'sound',
    summary: {
      en: 'Reads the modules.sound option of createShow() (true, an instrument id, or an object) into one normalized object.',
      zh: '把 createShow() 的 modules.sound 選項（true、樂器 id 或物件）讀成一個整理好的物件。',
    },
    params: [
      { name: 'value', type: 'Boolean | String | Object', en: '`true` for the defaults, an instrument id (`\'piano\'`), or `{ instrument, remember, picker, engine, …toneEngine options }`. Anything falsy gives `null`.', zh: '`true` 是預設，樂器 id（`\'piano\'`），或 `{ instrument, remember, picker, engine, …toneEngine 的選項 }`。任何假值會得到 `null`。' },
    ],
    returns: { type: 'Object | null', en: '`{ engine, instrument, remember, picker, engineOptions }` (`engine` and `instrument` are `null` when not given, `remember` and `picker` are `true`), or `null` for a falsy value. `engineOptions` holds the rest of an object: `baseUrl`, `cdn`, `instruments`…. An `instrument` that is not a string, or a value of another kind, throws a `TypeError`.', zh: '`{ engine, instrument, remember, picker, engineOptions }`（沒給的 `engine` 和 `instrument` 是 `null`，`remember` 和 `picker` 是 `true`），假值則是 `null`。`engineOptions` 放物件裡其餘的東西：`baseUrl`、`cdn`、`instruments`…。`instrument` 不是字串，或給了別種值，會丟出 `TypeError`。' },
    description: [
      {
        en: "It is how `createShow({ modules: { sound: … } })` understands its option, so `sound: true`, `sound: 'piano'` and `sound: { instrument: 'organ', remember: false, picker: false }` all work. You only need it if you write something that takes the same option.",
        zh: "`createShow({ modules: { sound: … } })` 就是靠它理解選項，所以 `sound: true`、`sound: 'piano'` 和 `sound: { instrument: 'organ', remember: false, picker: false }` 都行。只有你要寫收同樣選項的東西時才需要它。",
      },
    ],
    examples: [
      {
        code: `import { soundOptions } from '@openav/sound';

console.log(soundOptions('piano').instrument);                                  // piano
console.log(soundOptions({ instrument: 'organ', remember: false, baseUrl: 'x/' }));
// { engine: null, instrument: 'organ', remember: false, picker: true, engineOptions: { baseUrl: 'x/' } }
console.log(soundOptions(false));                                               // null
try { soundOptions([]); } catch (e) { console.log(e.message); }
// modules.sound: true, an instrument id, or { instrument, remember, picker, engine, baseUrl, cdn, instruments }`,
        caption: { en: 'The three accepted shapes, a falsy value that turns the sound off, and the error for something that is none of them.', zh: '三種接受的形式、關掉聲音的假值，以及什麼都不是的東西會得到的錯誤。' },
      },
    ],
    related: ['Sound', 'toneEngine', 'createShow'],
    keywords: {
      en: ['createShow', 'modules.sound', 'options', 'normalize', 'config'],
      zh: ['createShow', 'modules.sound', '選項', '正規化', '設定'],
    },
  },

  salamanderMap: {
    group: 'sound',
    summary: {
      en: "Builds the sample map of the Salamander piano for Tone.Sampler: { 'A0': 'A0.mp3', 'D#1': 'Ds1.mp3', … }.",
      zh: "做出 Salamander 鋼琴給 Tone.Sampler 用的取樣對照表：{ 'A0': 'A0.mp3', 'D#1': 'Ds1.mp3', … }。",
    },
    params: [
      { name: 'notes', type: 'Number[]', optional: true, default: 'SALAMANDER_NOTES', en: 'Which MIDI notes to include. The default is [`SALAMANDER_NOTES`](#SALAMANDER_NOTES), all 30.', zh: '要包含哪些 MIDI 音符。預設是 [`SALAMANDER_NOTES`](#SALAMANDER_NOTES)，全部 30 個。' },
    ],
    returns: { type: 'Object', en: 'An object from Tone note names to file names. The files spell a sharp as "s": `D#1` is `Ds1.mp3`.', zh: '一個物件，從 Tone 的音名對應到檔名。檔名把升記號寫成 "s"：`D#1` 是 `Ds1.mp3`。' },
    description: [
      {
        en: "The piano instrument uses it to fetch its files from `baseUrl + 'salamander/'`. Use it if you want to load the same files into a sampler of your own.",
        zh: "鋼琴樂器用它從 `baseUrl + 'salamander/'` 抓檔案。想把同樣的檔案載入你自己的取樣器時可以用它。",
      },
    ],
    examples: [
      {
        code: `import { salamanderMap, SAMPLES_URL } from '@openav/sound';

const map = salamanderMap();
console.log(Object.keys(map).length, map['A0'], map['D#1']);   // 30 A0.mp3 Ds1.mp3
console.log(salamanderMap([60, 63]));                            // { C4: 'C4.mp3', 'D#4': 'Ds4.mp3' }
console.log(SAMPLES_URL + 'salamander/' + map['C4']);            // the address of one file`,
        caption: { en: 'The full map has 30 files; a map of two notes; and the full address of one sample.', zh: '完整的對照表有 30 個檔案。只有兩個音的對照表。以及一個取樣的完整位址。' },
      },
    ],
    related: ['SALAMANDER_NOTES', 'SAMPLES_URL', 'BUILTIN_INSTRUMENTS'],
    keywords: {
      en: ['salamander', 'piano samples', 'sample map', 'sampler', 'mp3', 'tone.sampler'],
      zh: ['salamander', '鋼琴取樣', '取樣對照表', '取樣器', 'mp3', 'tone.sampler'],
    },
  },

  SALAMANDER_NOTES: {
    group: 'sound',
    summary: {
      en: 'The 30 notes the Salamander piano has samples for: every minor third from A0 (MIDI 21) to C8 (108).',
      zh: 'Salamander 鋼琴有取樣的 30 個音：從 A0（MIDI 21）到 C8（108），每隔一個小三度一個。',
    },
    value: {
      type: 'Number[]',
      en: '`[21, 24, 27, …, 108]`: 30 MIDI note numbers, three semitones apart (the A, C, D♯ and F♯ of every octave).',
      zh: '`[21, 24, 27, …, 108]`：30 個 MIDI 音符號碼，彼此相隔三個半音（每個八度的 A、C、D♯、F♯）。',
    },
    description: [
      {
        en: "The sampler shifts the pitch of the notes in between by at most a semitone and a half, which is inaudible on a piano. There is only one velocity layer, so loud against soft is a gain curve, not a different hammer.",
        zh: "取樣器把中間的音升降最多一個半音半，在鋼琴上聽不出來。只有一個力度層，所以大聲和小聲是音量曲線，不是不同的琴槌。",
      },
    ],
    examples: [
      {
        code: `import { SALAMANDER_NOTES } from '@openav/sound';

console.log(SALAMANDER_NOTES.length, SALAMANDER_NOTES[0], SALAMANDER_NOTES.at(-1));   // 30 21 108
console.log(SALAMANDER_NOTES.slice(0, 4).join(' '));                                    // 21 24 27 30`,
        caption: { en: 'The count, the lowest and highest notes, and the first four.', zh: '數量、最低和最高的音，以及最前面四個。' },
      },
    ],
    related: ['salamanderMap', 'SAMPLES_URL'],
    keywords: {
      en: ['salamander', 'sampled notes', 'a0', 'c8', 'minor third', 'piano range'],
      zh: ['salamander', '取樣的音', 'a0', 'c8', '小三度', '鋼琴音域'],
    },
  },
};
