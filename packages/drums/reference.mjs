// @openav/drums reference: the drum machine (a synthesized kit, a 16-step sequencer, the lookahead clock and the card).
// Read by tools/build-reference.mjs (see AGENTS.md, "Documenting a public name").
// The keys are the public names the code has (tools/reference/scan.mjs reads them); a key the code does not have is a red test.
// Module examples run as ES modules in the reference smoke, with an import map for every @openav/* package.

export default {
  mountDrums: {
    group: 'drums',
    summary: {
      en: 'Puts a drum machine on the page: a step grid, a transport and a line of rhythm you can type into. It publishes every hit as `drum/*` signals.',
      zh: '在頁面上放一台鼓機：步進格子、播放控制，和一行可以直接打字修改的節奏。它把每一下鼓發布成 `drum/*` 訊號。',
    },
    params: [
      { name: 'container', type: 'HTMLElement', en: 'The element to put the card in. `dispose()` takes it out again.', zh: '要放鼓機卡的元素。`dispose()` 會把它拆掉。' },
      { name: 'signals', type: 'Signals', optional: true, en: 'A [`Signals`](#Signals) bus. Every hit is published as `drum/<voice>` (a pulse `{ level }`), `drum/<voice>/env` (0..1, decays) and `midi/note/on` `{ note, vel, ch: 10 }`. Without one the machine plays and calls your functions, and publishes nothing.', zh: '一個 [`Signals`](#Signals) 匯流排。每一下鼓都會發布成 `drum/<voice>`（脈衝 `{ level }`）、`drum/<voice>/env`（0..1，會衰減）和 `midi/note/on` `{ note, vel, ch: 10 }`。沒給的話鼓機照樣會打、會呼叫你的函式，但什麼都不發布。' },
      { name: 'engine', type: 'Object', optional: true, default: 'null', en: 'The sound engine. Left out, the machine makes its own [`drumEngine()`](#drumEngine). Anything with `enable()` and `noteOn(note, vel01, time)` works.', zh: '發聲的引擎。沒給的話，鼓機自己做一個 [`drumEngine()`](#drumEngine)。任何有 `enable()` 和 `noteOn(note, vel01, time)` 的東西都可以。' },
      { name: 'autoEnableEngine', type: 'Boolean', optional: true, default: 'true', en: 'Switch the engine on by the first hit (or by `play()` with the lookahead clock), so no extra click is needed beyond the one the browser wants.', zh: '讓第一下鼓（用 lookahead 時鐘的話是 `play()`）自己把引擎打開，所以除了瀏覽器要的那一次點擊，不用再多一次點擊。' },
      { name: 'onStep', type: 'Function', optional: true, default: 'null', en: '`onStep(i, n, ev)`, once for every 16th step when it is heard. `i` is 0..15 in the bar, `n` counts steps since the start, before that step\'s hits. It is the clock a timeline counts bars on.', zh: '`onStep(i, n, ev)`，每個十六分音符步在聽到的時候呼叫一次。`i` 是小節裡的 0..15，`n` 是從開始算起的步數，在那一步的鼓之前呼叫。時間軸就是靠它數小節。' },
      { name: 'onHit', type: 'Function', optional: true, default: 'null', en: '`onHit(voice, vel, ev)`, once for every drum hit when it is heard. `voice` is a name like `\'kick\'`, `vel` is 0..1.', zh: '`onHit(voice, vel, ev)`，每一下鼓在聽到的時候呼叫一次。`voice` 是像 `\'kick\'` 的名字，`vel` 是 0..1。' },
      { name: 'onTakeover', type: 'Function', optional: true, default: 'null', en: '`onTakeover({ text, bar, offGrid, dropped, varied })`: without a `rhythm` module, a click on a cell turned a line of rhythm into the grid it was playing. `offGrid` hits moved to the nearest step and `dropped` drums had no row.', zh: '`onTakeover({ text, bar, offGrid, dropped, varied })`：沒有 `rhythm` 模組的時候，點一個格子把一行節奏換成它正在打的格子圖。`offGrid` 個鼓點被移到最近的一格，`dropped` 是沒有對應列的鼓。' },
      { name: 'bpm', type: 'Number', optional: true, default: '112', en: 'The starting tempo, in beats per minute. The slider on the card goes from 60 to 180.', zh: '一開始的速度，每分鐘幾拍。卡上的滑桿範圍是 60 到 180。' },
      { name: 'pattern', type: 'String | Object', optional: true, default: "'four on floor'", en: 'A preset name from [`PATTERNS`](#PATTERNS) or your own grid `{ kick: \'x...x...\', … }`. Not a line of rhythm: to start with one, call `drums.edit(line)` or `drums.setPattern(compile(line), { text: line })`.', zh: '[`PATTERNS`](#PATTERNS) 裡的預設名稱，或你自己的格子圖 `{ kick: \'x...x...\', … }`。不是一行節奏：要用一行節奏開始，就呼叫 `drums.edit(line)` 或 `drums.setPattern(compile(line), { text: line })`。' },
      { name: 'clock', type: "'frame' | 'lookahead'", optional: true, default: "'frame'", en: '`\'frame\'`: the machine moves in `update(dt)` and each hit sounds in the frame it is due. `\'lookahead\'`: hits are handed to the kit ahead of time on its audio clock, so the beat is steady under a heavy frame and in a hidden tab (`\'audio\'` means the same). See [`DrumTransport`](#DrumTransport).', zh: '`\'frame\'`：鼓機在 `update(dt)` 裡前進，每一下在到時間的那個畫面響。`\'lookahead\'`：鼓點提前交給鼓組，用它的音訊時鐘排程，所以畫面很重或分頁被藏起來時節拍還是穩的（`\'audio\'` 是同一個意思）。見 [`DrumTransport`](#DrumTransport)。' },
      { name: 'lang', type: "'en' | 'zh'", optional: true, default: "'en'", en: '`\'zh\'` names the lanes and the buttons in Chinese. Anything else is English.', zh: '`\'zh\'` 會用中文為軌道和按鈕命名（大鼓 小鼓 鈸 拍手）。其他的值都是英文。' },
      { name: 'heartbeat', type: "'auto' | 'interval' | false", optional: true, default: "'auto'", en: 'Only for `clock: \'lookahead\'`. Who wakes the scheduler: `\'auto\'` a Web Worker timer (falls back to `setInterval` where a worker cannot start), `\'interval\'` always `setInterval`, `false` nobody (you call `drums.update()` often enough).', zh: '只在 `clock: \'lookahead\'` 時有用。誰來叫醒排程器：`\'auto\'` 是 Web Worker 的計時器（worker 起不來的地方退回 `setInterval`），`\'interval\'` 一律用 `setInterval`，`false` 是沒人叫（你要自己夠頻繁地呼叫 `drums.update()`）。' },
      { name: 'latency', type: "'auto' | Number", optional: true, default: "'auto'", en: 'Only for `clock: \'lookahead\'`. How long after a hit is scheduled it is heard, in seconds. `\'auto\'` asks the browser for its output latency; a number sets it by hand (a Bluetooth speaker is 0.15 to 0.25).', zh: '只在 `clock: \'lookahead\'` 時有用。一下鼓排程之後多久才聽到，單位是秒。`\'auto\'` 向瀏覽器問輸出延遲。給數字就是手動設定（藍牙喇叭是 0.15 到 0.25）。' },
      { name: 'now', type: 'Function', optional: true, en: 'Only for `clock: \'lookahead\'`. A function that returns the time in seconds. The default is `performance.now() / 1000`. Replace it to run the machine on a fake clock in a test.', zh: '只在 `clock: \'lookahead\'` 時有用。回傳目前時間（秒）的函式。預設是 `performance.now() / 1000`。測試時換掉它，就能讓鼓機跑在假的時鐘上。' },
      { name: 'hidden', type: 'Function', optional: true, en: 'Only for `clock: \'lookahead\'`. A function that returns true while nobody can see the page. The default looks at `document.visibilityState`.', zh: '只在 `clock: \'lookahead\'` 時有用。沒有人看得到頁面時回傳 true 的函式。預設看的是 `document.visibilityState`。' },
      { name: 'rhythm', type: 'Module', optional: true, default: 'null', en: 'The [`@openav/pattern`](#compile) module (`import * as rhythm from \'@openav/pattern\'`, anything with `compile` and `fromGrid`). With it the line of rhythm over the grid is always there and editable, and the cells and the line rewrite each other. It can also be handed over later with `drums.useRhythm(mod)`.', zh: '[`@openav/pattern`](#compile) 模組（`import * as rhythm from \'@openav/pattern\'`，只要有 `compile` 和 `fromGrid` 就行）。有了它，格子上面那一行節奏就一直在、可以編輯，格子和那一行會互相改寫。也可以之後再用 `drums.useRhythm(mod)` 交給它。' },
      { name: 'onRhythm', type: 'Function', optional: true, default: 'null', en: '`onRhythm(line, { how, prev })`, once for every new line. `how` is `\'code\'`, `\'cell\'`, `\'type\'`, `\'undo\'` or `\'menu\'`.', zh: '`onRhythm(line, { how, prev })`，每一行新的節奏呼叫一次。`how` 是 `\'code\'`、`\'cell\'`、`\'type\'`、`\'undo\'`、`\'menu\'` 其中之一。' },
      { name: 'onLossy', type: 'Function', optional: true, default: 'null', en: '`onLossy({ text, bar, lost })`: a click on a cell would lose something the 16 steps cannot hold (triplets, `< >`, `?`, `bd:2`). `lost` is the same as in [`toGrid()`](#toGrid). Left out, a note appears on the card. The next click rewrites the line anyway.', zh: '`onLossy({ text, bar, lost })`：點一個格子會損失 16 格放不下的東西（三連音、`< >`、`?`、`bd:2`）。`lost` 跟 [`toGrid()`](#toGrid) 的一樣。沒給的話，卡上會出現一行提示。再點一次就會照樣改寫那一行。' },
      { name: 'onEditError', type: 'Function', optional: true, default: 'null', en: '`onEditError(error, text)` when what was typed is not a line of rhythm (the mistake is marked in red and the last line that worked keeps playing), and `onEditError(null)` once it is fixed.', zh: '打進去的不是一行節奏的時候呼叫 `onEditError(error, text)`（錯的地方標紅，上一行能用的繼續打），修好之後呼叫 `onEditError(null)`。' },
      { name: 'copyText', type: 'Function', optional: true, default: 'null', en: '`copyText(line, bpm)` returns what the Copy button puts on the clipboard. The default is the line itself.', zh: '`copyText(line, bpm)` 回傳「複製」按鈕要放進剪貼簿的文字。預設就是那一行本身。' },
      { name: 'strudelComment', type: 'String', optional: true, default: "''", en: 'A comment to put at the head of the code that **Open in Strudel** sends.', zh: '要放在「在 Strudel 打開」送出去的程式碼最前面的註解。' },
    ],
    returns: {
      type: 'Object',
      en: '`{ seq, engine, root, clock, play(on), setPattern(p, { text }), setBpm(bpm), update(dt), deliver(), phase(), now(), info(), dispose(), useRhythm(mod), src(), strudelUrl(), history, undo(), edit(text), copy(), copyText(), barEvents(bar), voices() }` (and the getters `rhythm` and `copied`).',
      zh: '`{ seq, engine, root, clock, play(on), setPattern(p, { text }), setBpm(bpm), update(dt), deliver(), phase(), now(), info(), dispose(), useRhythm(mod), src(), strudelUrl(), history, undo(), edit(text), copy(), copyText(), barEvents(bar), voices() }`（還有 getter `rhythm` 和 `copied`）。',
    },
    description: [
      {
        en: "`mountDrums(el, { signals })` builds a drum machine card inside `el`: a play checkbox, a preset menu, a tempo slider, the bar it is in, and a grid with a lane per drum (kick, snare, hat, clap, and a row of their own for the crash, ride, toms and open hat that a line of rhythm uses). A click on a cell toggles it. The returned object lets you do from code what the card does with the mouse: `play(true)`, `setPattern('breakbeat')`, `setBpm(96)`.",
        zh: "`mountDrums(el, { signals })` 在 `el` 裡蓋一張鼓機卡：播放勾選框、預設選單、速度滑桿、現在在第幾小節，和一個每種鼓一條軌道的格子（大鼓、小鼓、鈸、拍手，一行節奏用到的碎音鈸、疊音鈸、中鼓、開鈸各有自己的一列）。點一個格子就切換它。回傳的物件讓你用程式做卡片上用滑鼠做的事：`play(true)`、`setPattern('breakbeat')`、`setBpm(96)`。",
      },
      {
        en: "**You must call `drums.update(dt)` every frame**, with the seconds since the last one. It moves the machine (with the frame clock), tells your `onStep` and `onHit` what is heard, paints the grid and lets the `drum/*/env` signals decay. A machine that is never updated does not move.",
        zh: "**每個畫面都要呼叫 `drums.update(dt)`**，參數是距離上一個畫面過了幾秒。它讓鼓機前進（用 frame 時鐘的時候）、把聽到的事告訴你的 `onStep` 和 `onHit`、畫格子，並讓 `drum/*/env` 訊號衰減。從來不更新的鼓機不會動。",
      },
      {
        en: "Hits travel the same road as a drummer heard through the microphone, so a sketch written for the microphone moves over unchanged: `drum/kick`, `drum/snare`, `drum/hat`, `drum/clap` as pulses with `{ level }`, `drum/<voice>/env` as continuous 0..1 values, and `midi/note/on` `{ note, vel, ch: 10 }` with the General MIDI drum note (see [`GM`](#GM)). A voice a line of rhythm adds, like `drum/crash`, is defined the first time it is hit.",
        zh: "鼓點走的路跟麥克風聽到的鼓手一樣，所以為麥克風寫的草圖不用改就能換成它：`drum/kick`、`drum/snare`、`drum/hat`、`drum/clap` 是帶 `{ level }` 的脈衝，`drum/<voice>/env` 是 0..1 的連續值，還有 `midi/note/on` `{ note, vel, ch: 10 }`，音符是 General MIDI 的鼓音符（見 [`GM`](#GM)）。一行節奏多出來的鼓，像 `drum/crash`，會在第一次被打到的時候才定義。",
      },
      {
        en: "Give it the pattern module (`rhythm`) and the line of rhythm is always shown over the grid: a preset shows the line its grid is (`'four on floor'` is `bd*4, [~ sd]*2, hh*8`), and the word that sounds lights up. Then the two edit each other. A click on a cell rewrites the line (with [`fromGrid()`](#fromGrid)). Typing in the line changes the cells: Enter, or 400 ms without a key, plays what was typed. A mistake is marked red, `onEditError` is told, and the last line that worked keeps playing. Escape drops what was not played yet. Every change is kept in `history`; **↶** on the card, or `Cmd/Ctrl+Z` after touching the card, goes back one. **Copy** puts the line on the clipboard and **Open in Strudel** opens it at strudel.cc in a new tab ([`strudelUrl()`](#strudelUrl)).",
        zh: "把鼓的模組（`rhythm`）交給它，格子上面就一直有那一行節奏：預設會顯示它的格子圖是哪一行（`'four on floor'` 就是 `bd*4, [~ sd]*2, hh*8`），正在響的字會亮起來。接著兩邊互相修改。點一個格子會改寫那一行（用 [`fromGrid()`](#fromGrid)）。在那一行打字會改變格子：按 Enter，或停手 400 毫秒，就播放打進去的內容。有錯的地方標紅、通知 `onEditError`，上一行能用的繼續打。按 Escape 丟掉還沒播的。每次改動都存在 `history`。卡上的 **↶**，或碰過卡片之後按 `Cmd/Ctrl+Z`，退一步。**Copy** 把那一行放進剪貼簿，**Open in Strudel** 在新分頁的 strudel.cc 打開它（[`strudelUrl()`](#strudelUrl)）。",
      },
      {
        en: "What the returned object offers:",
        zh: "回傳的物件提供這些：",
      },
      {
        en: "```text\nplay(on)               start (true) or stop (false) like the checkbox; no argument flips; returns whether it plays\nsetPattern(p, {text})  a preset name, your own grid, or a compiled line (text: the line it came from); the card follows\nsetBpm(bpm)            the tempo, like the slider; returns the tempo\nupdate(dt)             call every frame\ndeliver()              tell onStep/onHit what is heard by now without painting (call it right before you draw)\nphase()                { bar, beat, pos }: how far through the bar and the beat the listener is, 0..1\nnow()                  { bar, step, phase, beatPhase, tokens, mode, text } for the display\ninfo()                 { clock, heartbeat, lookahead, late, extended, audio, latency, ... } the health of the clock\nuseRhythm(mod)         hand over @openav/pattern later (it can load on its own)\nsrc()                  the line that plays now ('' with a grid and no rhythm module)\nstrudelUrl()           the line as a strudel.cc link, or ''\nedit(text)             play a line as if typed: { ok, error }; a mistake keeps the last line playing\nhistory, undo()        the lines before, oldest first; undo goes back one and returns whether it did\ncopy()                 put copyText() on the clipboard: Promise<{ ok, text }>\nbarEvents(bar)         the hits of a bar: [{ voice, pos, ... }]\nvoices()               the rows on the grid now\nseq, engine, root      the DrumSequencer or DrumTransport, the sound engine, the card's element\ndispose()              stop, release the kit and take the card out\n```",
        zh: "```text\nplay(on)               像勾選框那樣開始（true）或停止（false）。不給參數就是反過來。回傳現在有沒有在打\nsetPattern(p, {text})  預設名稱、你自己的格子圖，或編譯好的一行（text：它原本的那行字）。卡片會跟著變\nsetBpm(bpm)            速度，像滑桿。回傳速度\nupdate(dt)             每個畫面都要呼叫\ndeliver()              把現在聽到的告訴 onStep/onHit，但不畫圖（在你畫圖之前呼叫）\nphase()                { bar, beat, pos }：聽的人在小節和拍子的哪裡，0..1\nnow()                  { bar, step, phase, beatPhase, tokens, mode, text }，給畫面顯示用\ninfo()                 { clock, heartbeat, lookahead, late, extended, audio, latency, ... } 時鐘的健康狀況\nuseRhythm(mod)         之後再把 @openav/pattern 交給它（它可以自己載入）\nsrc()                  現在在打的那一行（只有格子又沒有節奏模組的時候是 ''）\nstrudelUrl()           那一行變成 strudel.cc 連結，沒有就是 ''\nedit(text)             像打字一樣播放一行：{ ok, error }。有錯就繼續打上一行\nhistory, undo()        之前的幾行，舊的在前。undo 退一步，回傳有沒有退成\ncopy()                 把 copyText() 放進剪貼簿：Promise<{ ok, text }>\nbarEvents(bar)         某一小節的鼓點：[{ voice, pos, ... }]\nvoices()               現在格子上有哪幾列\nseq, engine, root      DrumSequencer 或 DrumTransport、發聲引擎、卡片的元素\ndispose()              停止、釋放鼓組並把卡片拆掉\n```",
      },
    ],
    needs: {
      en: "A page with a DOM, and `update(dt)` called every frame. Sound waits for the browser: the kit's `AudioContext` is made by the first hit (or by `play()` with the lookahead clock), and until the page has had a click it stays suspended. Callbacks and signals run from the start; the sound comes in on the first click, and nothing from before it is played late.",
      zh: "需要有 DOM 的頁面，而且每個畫面都要呼叫 `update(dt)`。聲音要等瀏覽器：鼓組的 `AudioContext` 在第一下鼓（用 lookahead 時鐘的話是 `play()`）的時候才建立，頁面被點一下之前它都是暫停的。回呼和訊號從一開始就會跑。聲音在第一次點擊之後才進來，點擊之前的鼓不會補打。",
    },
    notes: [
      {
        en: "With `clock: 'frame'` the first bar of a compiled line is played on the 16-step grid of four lanes: hits between steps move to the nearest step, and drums with no lane (crash, ride, toms, open hat) are left out. The console says so. `clock: 'lookahead'` plays a line exactly as written.",
        zh: "用 `clock: 'frame'` 的時候，編譯過的一行只有第一小節會在四條軌道、十六格的格子上打：落在格子之間的鼓點會移到最近的一格，沒有軌道的鼓（碎音鈸、疊音鈸、中鼓、開鈸）會被略過，console 會說一聲。`clock: 'lookahead'` 則照寫的樣子打。",
      },
      {
        en: "In a p5 sketch you do not call it: [`startDrums()`](#startDrums) builds this card for you, with the lookahead clock, and calls `update()` every frame.",
        zh: "在 p5 草圖裡不用自己呼叫：[`startDrums()`](#startDrums) 會替你蓋這張卡，用 lookahead 時鐘，並且每個畫面幫你呼叫 `update()`。",
      },
    ],
    examples: [
      {
        code: `import { mountDrums } from '@openav/drums';

const drums = mountDrums(document.getElementById('app'), { bpm: 120, pattern: 'breakbeat' });
drums.play(true);                          // start, like ticking the checkbox
let last = performance.now();
(function frame(now) {
  drums.update((now - last) / 1000);       // the machine only moves when you call this
  last = now;
  requestAnimationFrame(frame);
})(last);`,
        caption: { en: 'A drum machine card appears and plays a breakbeat; the yellow column runs along the grid. Click the page once to hear the kit; click the cells to change the beat.', zh: '頁面上出現一張鼓機卡，打著 breakbeat，黃色的那一欄沿著格子跑。在頁面上點一下才聽得到鼓組。點格子就能改節奏。' },
      },
      {
        code: `import * as rhythm from '@openav/pattern';
import { mountDrums } from '@openav/drums';

const told = [];
const drums = mountDrums(document.getElementById('app'), {
  rhythm, bpm: 110, clock: 'lookahead',
  onRhythm: (line, { how }) => told.push(how + ': ' + line),
  onEditError: (error) => told.push(error ? 'error ' + error.code : 'fixed'),
});
console.log(drums.src());                         // bd*4, [~ sd]*2, hh*8
console.log(drums.edit('bd(3,8), cr ~ ~ ~').ok);  // true: the crash gets a row of its own
console.log(drums.edit('bd [sd').ok);              // false: the last line that worked keeps playing
console.log(drums.src());                          // bd(3,8), cr ~ ~ ~
console.log(drums.undo(), drums.src());            // true bd*4, [~ sd]*2, hh*8
console.log(told.join(' | '));
// code: bd*4, [~ sd]*2, hh*8 | type: bd(3,8), cr ~ ~ ~ | fixed | error unclosed | undo: bd*4, [~ sd]*2, hh*8 | fixed
let last = performance.now();
(function frame(now) { drums.update((now - last) / 1000); last = now; requestAnimationFrame(frame); })(last);`,
        caption: { en: 'With the pattern module the line is shown over the grid. The code types two lines for you, one of them wrong, then goes back; type into the line yourself and the cells follow.', zh: '有了節奏模組，格子上面就會顯示那一行。程式替你打了兩行，其中一行是錯的，然後退回去。你自己在那一行打字，格子會跟著變。' },
      },
      {
        code: `import { mountDrums } from '@openav/drums';
import { Signals } from '@openav/core';

const signals = new Signals();
const g = document.getElementById('c').getContext('2d');
const drums = mountDrums(document.getElementById('app'), { signals, clock: 'lookahead', bpm: 100 });
drums.play(true);

let last = performance.now();
(function frame(now) {
  drums.update((now - last) / 1000); last = now;
  g.fillStyle = '#111'; g.fillRect(0, 0, 400, 300);
  g.fillStyle = '#ff7b54';
  g.beginPath();
  g.arc(200, 150, 30 + signals.get('drum/kick/env') * 90, 0, Math.PI * 2);   // 0..1, decays after each hit
  g.fill();
  requestAnimationFrame(frame);
})(last);`,
        caption: { en: 'A circle on the canvas swells with every kick: the drum machine publishes `drum/kick/env`, and the sketch only reads the signal.', zh: '畫布上的圓隨著每一下大鼓脹大：鼓機發布 `drum/kick/env`，草圖只要讀這個訊號。' },
      },
    ],
    tbd: [
      {
        en: "The figure of 0.15 to 0.25 seconds for a Bluetooth speaker (the `latency` option) is from the handbook (docs/p5.md); it was not measured here.",
        zh: "藍牙喇叭的 0.15 到 0.25 秒（`latency` 選項）這個數字來自手冊（docs/p5.md），這裡沒有實際量過。",
      },
    ],
    related: ['DrumTransport', 'DrumSequencer', 'drumEngine', 'compile', 'startDrums', 'drumHit', 'Signals'],
    keywords: {
      en: ['drum machine', 'drums', 'sequencer', 'step grid', 'tr-808', 'beat', 'rhythm', 'transport', 'play', 'tempo'],
      zh: ['鼓機', '鼓', '音序器', '步進格子', '節奏', '播放', '速度', '格子', '掛上頁面', 'strudel'],
    },
  },

  DrumTransport: {
    group: 'drums',
    summary: {
      en: 'The runtime around a DrumScheduler: it hands every hit to the kit ahead of time on its audio clock, and tells the page each step and hit when it is heard.',
      zh: '包在 DrumScheduler 外面的執行環境：它用鼓組的音訊時鐘，把每一下鼓提前交給鼓組，並在聽到的時候才告訴頁面每一步和每一下。',
    },
    params: [
      { name: 'scheduler', type: 'DrumScheduler', optional: true, default: 'new DrumScheduler()', en: 'The [`DrumScheduler`](#DrumScheduler) that decides what is played when.', zh: '決定什麼時候打什麼的 [`DrumScheduler`](#DrumScheduler)。' },
      { name: 'engine', type: 'Object', optional: true, default: 'null', en: 'The sound engine, usually a [`drumEngine()`](#drumEngine). If it has a `context` property (an `AudioContext`, or `null` before it is enabled), hits are scheduled ahead on that clock. If not, each hit is played by calling `engine.noteOn(note, vel)` at the moment it is heard.', zh: '發聲的引擎，通常是 [`drumEngine()`](#drumEngine)。它有 `context` 這個屬性（一個 `AudioContext`，啟用之前是 `null`）的話，鼓點就用那個時鐘提前排程。沒有的話，每一下鼓就在聽到的那一刻呼叫 `engine.noteOn(note, vel)` 來打。' },
      { name: 'onStep', type: 'Function', optional: true, default: 'null', en: '`onStep(i, n, ev)` for every 16th step when it is heard. `ev.quiet` and `ev.announce` say whether it was told quietly (below).', zh: '`onStep(i, n, ev)`，每個十六分音符步在聽到的時候呼叫。`ev.quiet` 和 `ev.announce` 說明它是不是被安靜地告知（見下面）。' },
      { name: 'onHit', type: 'Function', optional: true, default: 'null', en: '`onHit(voice, vel, ev)` for every drum hit when it is heard.', zh: '`onHit(voice, vel, ev)`，每一下鼓在聽到的時候呼叫。' },
      { name: 'onLate', type: 'Function', optional: true, default: 'null', en: '`onLate(margin, transport)`: a hit was handed to the kit after its time, because the page held the main thread longer than the lookahead. `margin` is how many seconds early it was (negative or tiny).', zh: '`onLate(margin, transport)`：因為頁面佔住主執行緒的時間比預讀還長，有一下鼓交給鼓組的時候已經過了它的時間。`margin` 是它早了幾秒（負的或很小）。' },
      { name: 'autoEnable', type: 'Boolean', optional: true, default: 'false', en: 'Call `engine.enable()` by `start()` when the engine has no `AudioContext` yet.', zh: '引擎還沒有 `AudioContext` 的話，在 `start()` 時呼叫 `engine.enable()`。' },
      { name: 'now', type: 'Function', optional: true, default: 'performance.now() / 1000', en: 'A function that returns the time in seconds. Pass your own to drive the transport from a fake clock in a test.', zh: '回傳目前時間（秒）的函式。測試時傳自己的，就能用假的時鐘帶動傳輸控制。' },
      { name: 'hidden', type: 'Function', optional: true, default: 'checks document.visibilityState', en: 'A function that returns true while nobody can see the page.', zh: '沒有人看得到頁面時回傳 true 的函式。' },
      { name: 'heartbeat', type: "'auto' | 'interval' | false", optional: true, default: "'auto'", en: 'Who calls `pump()`: `\'auto\'` a Web Worker timer (a hidden tab does not slow a worker), falling back to `setInterval`; `\'interval\'` always `setInterval`; `false` (or `\'none\'`) nobody, and you call `pump()` or `frame()` yourself.', zh: '誰來呼叫 `pump()`：`\'auto\'` 是 Web Worker 的計時器（被藏起來的分頁不會讓 worker 變慢），不行就退回 `setInterval`。`\'interval\'` 一律用 `setInterval`。`false`（或 `\'none\'`）是沒人叫，你自己呼叫 `pump()` 或 `frame()`。' },
      { name: 'tick', type: 'Number', optional: true, default: '0.025', en: 'Seconds between two heartbeats.', zh: '兩次心跳之間隔幾秒。' },
      { name: 'latency', type: "'auto' | Number", optional: true, default: "'auto'", en: 'Seconds between a hit being scheduled and being heard. `\'auto\'` asks the browser (`getOutputTimestamp()`, `outputLatency`); a number sets it by hand.', zh: '一下鼓從排程到聽到之間隔幾秒。`\'auto\'` 向瀏覽器問（`getOutputTimestamp()`、`outputLatency`）。給數字就是手動設定。' },
      { name: 'stale', type: 'Number', optional: true, default: '0.25', en: 'A step that is told more than this many seconds late (a frame loop catching up) is told quietly.', zh: '一步如果被告知的時候已經晚了超過這麼多秒（畫面迴圈在追趕），就會被安靜地告知。' },
      { name: 'startDelay', type: 'Number', optional: true, default: '0.05', en: 'When the audio clock is running, the first downbeat is put this many seconds after `start()`, so the first hit is not already late.', zh: '音訊時鐘在跑的時候，第一個強拍會放在 `start()` 之後這麼多秒，這樣第一下才不會已經晚了。' },
    ],
    description: [
      {
        en: "A page that plays a hit in the frame it is due is late by up to a frame, and silent when its tab is hidden. `DrumTransport` fixes both. A timer (the heartbeat, from a Web Worker, 25 ms by default) looks 0.1 seconds ahead on the kit's own audio clock and hands the kit every hit with its exact start time. The page is told separately, in the frame in which each step and hit is **heard**: its time plus the output latency the browser reports. So the beat stays steady under a heavy `draw()` and in a hidden tab, and the callbacks still arrive in order: a step before its hits, hits in time order.",
        zh: "在到時間的那個畫面才打的鼓，最多會晚一個畫面，分頁被藏起來的時候還會停。`DrumTransport` 兩個都解決。一個計時器（心跳，預設用 Web Worker，每 25 毫秒一次）在鼓組自己的音訊時鐘上往前看 0.1 秒，把每一下鼓連同確切的開始時間交給鼓組。頁面則是另外被通知，在每一步、每一下**被聽到**的那個畫面：它的時間加上瀏覽器回報的輸出延遲。所以畫面很重或分頁被藏起來，節拍還是穩的，回呼也依然按順序到：一步在它的鼓之前，鼓依時間排序。",
      },
      {
        en: "Call `start()`, then `frame()` once per animation frame. The heartbeat calls `pump()` for you. Tempo and pattern changes (`setBpm()`, `setPattern()`, `toggleCell()`) take back what was already handed over after now and make it again, so no hit is doubled or lost. Before the kit's `AudioContext` runs (no click yet) the clock runs on `now()` and the callbacks run but nothing sounds; once it runs, the hits from then on sound, and none from before.",
        zh: "呼叫 `start()`，然後每個動畫畫面呼叫一次 `frame()`。心跳會替你呼叫 `pump()`。速度和節奏的改變（`setBpm()`、`setPattern()`、`toggleCell()`）會把現在之後已經交出去的收回來重做，所以不會有鼓重複或漏掉。鼓組的 `AudioContext` 還沒跑（還沒點擊）的時候，時鐘用 `now()` 跑，回呼照常執行但沒有聲音。開始跑之後，從那之後的鼓才會響，之前的不補。",
      },
      {
        en: "A hidden page, or a frame loop that catches up more than `stale` seconds late, tells its steps quietly: `ev.quiet` is true, the clock moves and cues fire, but `onHit` is not called, and of several bar starts at once only the last has `ev.announce`. Nothing floods the page when the tab comes back. If a `draw()` ever holds the thread longer than the lookahead, the lookahead grows to 0.3 seconds (`info().extended`).",
        zh: "頁面被藏起來，或畫面迴圈追趕時已經晚了超過 `stale` 秒的時候，步會被安靜地告知：`ev.quiet` 是 true，時鐘照走、cue 照發，但 `onHit` 不會被呼叫，而且同時到的好幾個小節開頭，只有最後一個有 `ev.announce`。分頁回來的時候不會一下子湧進一大堆。如果某個 `draw()` 佔住執行緒的時間比預讀還長，預讀會增加到 0.3 秒（`info().extended`）。",
      },
      {
        en: "It has the getters `playing`, `pattern`, `grid`, `mode`, `text`, `bpm`, `swing`, `humanize` and `lookahead` of its scheduler; `bpm`, `swing` and `humanize` can also be set. You usually get one through [`mountDrums()`](#mountDrums) with `clock: 'lookahead'`; build your own when you want the clock without the card.",
        zh: "它有它的排程器的 getter：`playing`、`pattern`、`grid`、`mode`、`text`、`bpm`、`swing`、`humanize`、`lookahead`。`bpm`、`swing`、`humanize` 也可以設定。通常是透過 `clock: 'lookahead'` 的 [`mountDrums()`](#mountDrums) 拿到一個。想要時鐘而不要卡片的時候再自己建。",
      },
    ],
    members: {
      playing: { en: 'Getter. Whether the machine is playing.', zh: 'Getter。鼓機有沒有在打。' },
      pattern: { en: 'Getter. The preset name, `\'custom\'` for your own grid, or the line of rhythm text.', zh: 'Getter。預設的名稱，自己的格子圖是 `\'custom\'`，一行節奏的話就是那行文字。' },
      grid: { en: 'Getter. The grid as `{ kick: [0|1 × 16], snare, hat, clap }`. For a line of rhythm it is what bar 1 looks like on the grid.', zh: 'Getter。格子圖 `{ kick: [0|1 × 16], snare, hat, clap }`。一行節奏的話，是第 1 小節放在格子上的樣子。' },
      mode: { en: 'Getter. `\'grid\'` or `\'string\'` (a compiled line of rhythm).', zh: 'Getter。`\'grid\'` 或 `\'string\'`（編譯過的一行節奏）。' },
      text: { en: 'Getter. The line of rhythm that plays, or `\'\'` for a grid.', zh: 'Getter。正在打的那一行節奏，格子圖的話是 `\'\'`。' },
      bpm: { en: 'Getter and setter. The tempo; setting it does what `setBpm()` does.', zh: 'Getter 和 setter。速度。設定它就是 `setBpm()`。' },
      swing: { en: 'Getter and setter. 0 to 0.5: how much later every odd 16th is, as a share of a 16th. Setting it makes the scheduled hits again.', zh: 'Getter 和 setter。0 到 0.5：每個奇數的十六分音符晚多少，單位是一個十六分音符的幾分之幾。設定它會把已排程的鼓重做。' },
      humanize: { en: 'Getter and setter. 0..1, a few milliseconds of lateness and a little change of velocity. Setting it makes the scheduled hits again.', zh: 'Getter 和 setter。0..1，幾毫秒的遲到和一點力道的變化。設定它會把已排程的鼓重做。' },
      lookahead: { en: 'Getter. Seconds handed to the kit ahead of time (0.1; it grows to 0.3 after a hit was late).', zh: 'Getter。提前交給鼓組的秒數（0.1，有一下鼓太晚之後會增加到 0.3）。' },
      stepDur: { en: 'Seconds one 16th lasts at the current tempo: `60 / bpm / 4`.', zh: '現在的速度下，一個十六分音符多少秒：`60 / bpm / 4`。' },
      times: { en: 'The master time line, in seconds: `{ sched, heard, live, ct }`. `sched` is the earliest time a hit can still be handed to the kit, `heard` is what the listener hears right now, `live` is whether the audio clock runs. Until it does, it is `now()`.', zh: '總時間軸，單位是秒：`{ sched, heard, live, ct }`。`sched` 是鼓點最早還能交給鼓組的時間，`heard` 是聽的人現在聽到的時間，`live` 是音訊時鐘有沒有在跑。沒在跑的時候用的是 `now()`。' },
      start: { en: 'Starts from bar 1 (again, if it was playing) and returns `true`. When the audio clock runs, the first downbeat is `startDelay` seconds away. Starts the heartbeat.', zh: '從第 1 小節開始（已經在打的話就重來）並回傳 `true`。音訊時鐘在跑的時候，第一個強拍在 `startDelay` 秒之後。會啟動心跳。' },
      stop: { en: 'Stops, takes back what was handed to the kit and has not started, and stops the heartbeat. Returns `false`.', zh: '停止，把交給鼓組但還沒開始的收回來，並停掉心跳。回傳 `false`。' },
      toggle: { en: '`toggle(on)` starts or stops; with no argument it flips. Starting begins at bar 1.', zh: '`toggle(on)` 開始或停止。不給參數就是反過來。開始的時候從第 1 小節起。' },
      setPattern: { en: 'A preset name, your own grid, or a compiled line of rhythm (with `{ text }`, the line it came from). The change is heard at once. Returns the new `pattern`.', zh: '預設名稱、你自己的格子圖，或編譯過的一行節奏（用 `{ text }` 帶上它原本那行字）。改動會馬上聽到。回傳新的 `pattern`。' },
      toggleCell: { en: '`toggleCell(lane, i)` flips one cell of the grid (`lane` is `kick`, `snare`, `hat` or `clap`, `i` is 0..15). A line of rhythm is first turned into the grid it plays.', zh: '`toggleCell(lane, i)` 切換格子上的一格（`lane` 是 `kick`、`snare`、`hat`、`clap`，`i` 是 0..15）。如果在打的是一行節奏，會先換成它打出來的格子圖。' },
      takeover: { en: 'Turns the line of rhythm into the grid it plays in bar `bar`, so the cells can be edited. Returns `{ grid, offGrid, dropped }`.', zh: '把一行節奏換成它在第 `bar` 小節打出來的格子圖，這樣格子就可以編輯。回傳 `{ grid, offGrid, dropped }`。' },
      setBpm: { en: 'A new tempo from now on. What was handed to the kit after now is taken back and made again at the new tempo. The same tempo again does nothing. Returns the tempo.', zh: '從現在起換成新的速度。現在之後已經交給鼓組的會收回來，用新速度重做。再給同一個速度不會有任何動作。回傳速度。' },
      rewind: { en: 'Takes back everything handed to the kit after now (with 10 ms of margin, so a hit already sounding is not cut) and makes it again from the pattern and tempo as they are. The setters call it for you.', zh: '把現在之後交給鼓組的全部收回來（留 10 毫秒的餘裕，所以已經在響的不會被切斷），再依現在的節奏和速度重做。setter 會替你呼叫它。' },
      pump: { en: 'The heartbeat: hand the next hits to the kit. When the page is hidden, or no frame has run for 0.1 seconds, it also tells the page what is heard. Call it yourself only with `heartbeat: false`.', zh: '心跳：把接下來的鼓交給鼓組。頁面被藏起來，或超過 0.1 秒沒有畫面在跑的時候，它也會把聽到的告訴頁面。只有 `heartbeat: false` 時才需要自己呼叫。' },
      frame: { en: 'Call it once per animation frame. Hands over what is due, then tells the page every step and hit heard by now through `onStep` and `onHit`. Returns those events.', zh: '每個動畫畫面呼叫一次。把該交的交出去，然後透過 `onStep` 和 `onHit` 告訴頁面到現在為止聽到的每一步和每一下。回傳這些事件。' },
      phase: { en: '`{ bar, beat, pos }` where the listener is: how far through the bar and through the beat, 0..1, and bars since the start. It holds still while stopped.', zh: '`{ bar, beat, pos }` 聽的人在哪裡：在小節和拍子裡走了多遠（0..1），以及從開始算起的小節數。停止的時候它不動。' },
      info: { en: 'How the clock is doing: `{ clock, heartbeat, why, lookahead, late, extended, audio, latency, skipped, warning }`. `heartbeat` is `\'worker\'`, `\'interval\'` or `\'none\'`, `late` counts hits handed over late.', zh: '時鐘的狀況：`{ clock, heartbeat, why, lookahead, late, extended, audio, latency, skipped, warning }`。`heartbeat` 是 `\'worker\'`、`\'interval\'` 或 `\'none\'`，`late` 是交得太晚的鼓的數量。' },
      dispose: { en: 'Stops the machine.', zh: '停止鼓機。' },
      heardAt: { en: 'The scheduler\'s time line (what is heard) at a moment `at` of the `now` clock. For `follow()`.', zh: '`now` 時鐘的某個時刻 `at`，對應到排程器時間軸（聽到的時間）上的哪裡。給 `follow()` 用。' },
      follow: { en: 'Plays on an external clock (Strudel, a DAW, a linked page): `follow({ pos, at, bpm })` says that position `pos` (bars from its start, 0 is the downbeat of bar 1) is heard at `at` (the `now` clock, in seconds) at tempo `bpm`. Stopped, it starts so bar 1 lands on the external 0. Playing, an error over `jump` bars (0.125) restarts the same way; a smaller one is closed over `catchUp` seconds by a tempo a little faster or slower (at most `pull` of it, 0.08), then the external tempo again. An error under `still` (0.0005 seconds) is left alone. The second argument is `{ catchUp, jump, pull, still }`. Returns the error in seconds (positive: the machine was behind). Call it with every new reading of the external clock.', zh: '跟著外部時鐘打（Strudel、DAW、連結的頁面）：`follow({ pos, at, bpm })` 表示位置 `pos`（從它開始算起的小節數，0 是第 1 小節的強拍）在 `at`（`now` 時鐘，秒）被聽到，速度是 `bpm`。停著的時候，它會這樣開始：讓第 1 小節落在外部時鐘的 0。正在打的時候，誤差超過 `jump` 小節（0.125）就用同樣的方式重新開始。比較小的誤差用 `catchUp` 秒的時間，靠稍微快一點或慢一點的速度（最多 `pull`，0.08）補回來，然後回到外部速度。誤差小於 `still`（0.0005 秒）就不處理。第二個參數是 `{ catchUp, jump, pull, still }`。回傳誤差，單位是秒（正數表示鼓機落後）。外部時鐘每有新的讀數就呼叫一次。' },
      followInfo: { en: '`{ bpm, err, jumps, steers, at }` while following (`err` is the last correction in seconds), and `null` if it never followed.', zh: '跟隨的時候是 `{ bpm, err, jumps, steers, at }`（`err` 是最後一次修正的秒數），從來沒跟隨過就是 `null`。' },
      unfollow: { en: 'Stops following. The machine keeps the tempo it has, on its own clock.', zh: '停止跟隨。鼓機保持現在的速度，用自己的時鐘打下去。' },
    },
    examples: [
      {
        code: `import { DrumScheduler, DrumTransport } from '@openav/drums';

let T = 100;                                         // a clock we move by hand, in seconds
const log = [];
const transport = new DrumTransport({
  scheduler: new DrumScheduler({ bpm: 120, humanize: 0 }),
  heartbeat: false, now: () => T,                    // no timer, our own clock
  onStep: (i) => { if (i % 4 === 0) log.push('step ' + i); },
  onHit: (voice, vel) => { if (voice !== 'hat') log.push(voice); },
});
transport.start();
for (let k = 0; k < 40; k++) { T += 1 / 20; transport.frame(); }   // two seconds in 20 fps frames
console.log(log.join(', '));
// step 0, kick, step 4, kick, snare, step 8, kick, step 12, kick, snare
console.log(transport.playing, transport.phase().bar.toFixed(2));  // true 1.00`,
        caption: { en: 'Runs a whole bar of four on the floor on a clock we move by hand, and logs what the page is told: the downbeats of each beat, the kicks and the snares on 2 and 4.', zh: '在我們手動撥動的時鐘上跑完一整個小節的四四拍，印出頁面被告知的事：每一拍的強拍、大鼓，和第 2、4 拍的小鼓。' },
      },
      {
        code: `import { DrumScheduler, DrumTransport, drumEngine } from '@openav/drums';

const kit = drumEngine();
const transport = new DrumTransport({
  scheduler: new DrumScheduler({ bpm: 100, swing: 0.1, pattern: 'breakbeat' }),
  engine: kit, autoEnable: true,                      // the click that starts it also starts the audio
  onHit: (voice, vel) => console.log(voice, vel.toFixed(2)),
});
document.body.addEventListener('click', () => transport.start(), { once: true });
(function frame() { transport.frame(); requestAnimationFrame(frame); })();`,
        caption: { en: 'Click the page and a breakbeat starts on the kit\'s audio clock; the console logs each hit when it is heard. Switch to another tab: the beat keeps going.', zh: '在頁面上點一下，breakbeat 就用鼓組的音訊時鐘開始打。console 在聽到每一下的時候印出來。切到別的分頁：節拍照樣繼續。' },
        run: 'static',
        why: 'It needs a click to start the browser\'s audio, and a speaker to hear the beat; only the callbacks could be checked without one.',
      },
    ],
    related: ['DrumScheduler', 'mountDrums', 'drumEngine', 'DrumSequencer', 'startDrums', 'drumPhase'],
    keywords: {
      en: ['transport', 'lookahead', 'audio clock', 'heartbeat', 'scheduling', 'steady tempo', 'web worker', 'hidden tab', 'latency', 'follow'],
      zh: ['傳輸控制', '預讀', '音訊時鐘', '心跳', '排程', '穩定速度', '分頁被藏起來', '延遲', '跟隨', '外部時鐘'],
    },
  },

  DrumScheduler: {
    group: 'drums',
    summary: {
      en: 'Pure drum logic with no timers and no audio: a grid or a line of rhythm goes in, timed events come out, ahead of time, on any clock you pass.',
      zh: '純粹的鼓的邏輯，沒有計時器也沒有聲音：放進一張格子圖或一行節奏，就提前吐出有時間的事件，時鐘由你傳進來。',
    },
    params: [
      { name: 'bpm', type: 'Number', optional: true, default: '112', en: 'The tempo, in beats per minute. A value that is not above 0 becomes 112.', zh: '速度，每分鐘幾拍。不大於 0 的值會變成 112。' },
      { name: 'swing', type: 'Number', optional: true, default: '0', en: '0 to 0.5: every odd 16th is that share of a 16th late. 0 is straight.', zh: '0 到 0.5：每個奇數的十六分音符晚那麼多個十六分音符。0 是直的。' },
      { name: 'humanize', type: 'Number', optional: true, default: '0.35', en: '0..1: a few milliseconds late and a little softer or louder, so it grooves instead of ticking. Use 0 for exact, repeatable times.', zh: '0..1：晚幾毫秒、力道有一點大小變化，讓它有律動而不是機械的滴答。要精準、可重複的時間就用 0。' },
      { name: 'lookahead', type: 'Number', optional: true, default: '0.1', en: 'Seconds `advance()` schedules beyond `now`.', zh: '`advance()` 在 `now` 之後多排幾秒。' },
      { name: 'pattern', type: 'String | Object', optional: true, default: "'four on floor'", en: 'A preset name from [`PATTERNS`](#PATTERNS), your own grid, or a compiled line of rhythm (see `setPattern()`).', zh: '[`PATTERNS`](#PATTERNS) 裡的預設名稱、你自己的格子圖，或編譯過的一行節奏（見 `setPattern()`）。' },
      { name: 'seed', type: 'Number', optional: true, default: '0', en: 'Passed to the rhythm line as `eventsInBar(bar, { seed })`, so each `?` decides the same way every time.', zh: '當作 `eventsInBar(bar, { seed })` 交給那一行節奏，讓每個 `?` 每次都做同樣的決定。' },
      { name: 'random', type: 'Function', optional: true, default: 'Math.random', en: 'Where `humanize` gets its randomness: a function that returns a number from 0 up to 1. Pass your own for repeatable output.', zh: '`humanize` 的隨機從哪裡來：回傳 0 到 1 之間數字的函式。傳自己的就能得到可重複的結果。' },
    ],
    description: [
      {
        en: "A `DrumScheduler` knows what plays in which bar, and when a bar happens, but it owns no clock: every time you give it is in seconds on one clock of your choosing, so it runs the same under a fake clock in a test as under the audio clock in a page. [`DrumTransport`](#DrumTransport) is the runtime that feeds it the real one. Use the scheduler on its own when you want drum events as data, for your own sound engine or a test.",
        zh: "`DrumScheduler` 知道哪個小節要打什麼，也知道一個小節在什麼時候發生，但它沒有自己的時鐘：你給它的每個時間，都是你選的某一個時鐘上的秒數，所以它在測試裡用假時鐘跑、在頁面裡用音訊時鐘跑，結果一樣。[`DrumTransport`](#DrumTransport) 是把真的時鐘餵給它的執行環境。想把鼓的事件當資料用，例如給自己的發聲引擎或測試，就單獨用排程器。",
      },
      {
        en: "The loop is: `start(at)` puts the downbeat of bar 1 at time `at`. Then, again and again, `advance(now)` schedules everything up to `now + lookahead` and returns the new events, in order. `due(t)` hands out the events whose time has come (they stay in `queue` until then). Two kinds of event come out: a step `{ kind: 'step', i, n, bar, pos, time }` for every 16th, and a hit `{ kind: 'hit', voice, vel, pos, n, bar, token, word, layer, dur, time }`. `pos` counts bars from the start (0 is the downbeat of bar 1, 1.5 is half way through bar 2), `time` is in your seconds, `i` is the step 0..15 and `n` counts steps since the start. For a grid, the step comes before its hits. `token`, `word`, `layer` and `dur` come from a line of rhythm and are `null` or `undefined` for a grid.",
        zh: "流程是這樣：`start(at)` 讓第 1 小節的強拍落在時間 `at`。然後一再地呼叫 `advance(now)`，它排好直到 `now + lookahead` 的全部，並依序回傳新的事件。`due(t)` 把時間到了的事件交出來（在那之前它們留在 `queue` 裡）。事件有兩種：每個十六分音符一個步 `{ kind: 'step', i, n, bar, pos, time }`，和一下鼓 `{ kind: 'hit', voice, vel, pos, n, bar, token, word, layer, dur, time }`。`pos` 從開始算起以小節為單位（0 是第 1 小節的強拍，1.5 是第 2 小節的一半），`time` 是你的時鐘的秒數，`i` 是步 0..15，`n` 是從開始算起的步數。格子圖的話，步在它的鼓之前。`token`、`word`、`layer`、`dur` 來自一行節奏，格子圖的話是 `null` 或 `undefined`。",
      },
      {
        en: "Positions turn into seconds by multiplication from the last tempo anchor, never by adding up frame times, so a thousand bars later nothing has drifted (the test measures under a microsecond). A tempo change adds an anchor, so the past keeps the tempo it had.",
        zh: "位置是從最近一個速度錨點用乘法換成秒的，不是把畫面時間加起來，所以一千個小節之後也沒有漂移（測試量到的誤差不到一微秒）。速度改變會多加一個錨點，所以過去保持它當時的速度。",
      },
    ],
    members: {
      bpm: { en: 'Getter and setter. The tempo; setting it does what `setBpm(bpm)` does.', zh: 'Getter 和 setter。速度。設定它就是 `setBpm(bpm)`。' },
      stepDur: { en: 'Seconds one 16th lasts at the current tempo: `60 / bpm / 4`.', zh: '現在的速度下，一個十六分音符多少秒：`60 / bpm / 4`。' },
      setPattern: { en: 'A preset name, your own grid `{ kick: \'x...x...\', … }` (a lane left out is silent), or a compiled line of rhythm: anything with `eventsInBar(bar, { seed })`, such as [`compile(text)`](#compile). With a line, `{ text }` is the text it came from. An unknown name plays `\'four on floor\'`. Returns the new `pattern`.', zh: '預設名稱、你自己的格子圖 `{ kick: \'x...x...\', … }`（沒寫的軌道是靜音），或編譯過的一行節奏：任何有 `eventsInBar(bar, { seed })` 的東西，例如 [`compile(text)`](#compile)。給一行節奏的話，`{ text }` 是它原本的那行字。不認識的名稱會打 `\'four on floor\'`。回傳新的 `pattern`。' },
      toggleCell: { en: 'Flips one cell of the grid: `toggleCell(\'snare\', 4)`. The pattern becomes `\'custom\'`. A line of rhythm is first turned into the grid it plays in bar 1.', zh: '切換格子上的一格：`toggleCell(\'snare\', 4)`。節奏會變成 `\'custom\'`。如果是一行節奏，會先換成它在第 1 小節打出來的格子圖。' },
      gridOf: { en: 'Bar `bar` of what plays, on the 16 steps of the four lanes: `{ grid, offGrid, dropped }`. `offGrid` counts hits that sat between steps and were moved to the nearest one, `dropped` lists the drums the grid has no lane for.', zh: '正在打的內容的第 `bar` 小節，放在四條軌道的 16 格上：`{ grid, offGrid, dropped }`。`offGrid` 是原本落在格子之間而被移到最近一格的鼓點數量，`dropped` 列出格子沒有軌道的鼓。' },
      takeover: { en: 'The line of rhythm becomes the grid it plays in `bar`, and from then on the cells play. Returns what `gridOf(bar)` returns.', zh: '一行節奏換成它在 `bar` 小節打出來的格子圖，從此改由格子來打。回傳 `gridOf(bar)` 的結果。' },
      barEvents: { en: 'The hits of bar `bar` (1 is the first) as `[{ voice, pos, … }]`, `pos` 0..1 in the bar, from whichever source plays. A line that fails or names a drum the kit does not have leaves `warning` set and skips that hit.', zh: '第 `bar` 小節（1 是第一個）的鼓點，格式是 `[{ voice, pos, … }]`，`pos` 是小節裡的 0..1，不管來源是哪一種。一行節奏出錯，或用了鼓組沒有的鼓，會設定 `warning` 並略過那一下。' },
      posAt: { en: 'Where the music is at time `t`, in bars from the start. The downbeat of bar 1 is 0, and before it the value is negative.', zh: '時間 `t` 的時候，音樂在哪裡，單位是從開始算起的小節。第 1 小節的強拍是 0，在它之前是負數。' },
      timeAt: { en: 'The time when position `p` sounds, before swing and humanize. The reverse of `posAt()`.', zh: '位置 `p` 在什麼時間響，還沒算 swing 和 humanize。是 `posAt()` 的反函數。' },
      bpmAt: { en: 'The tempo at time `t`.', zh: '時間 `t` 的速度。' },
      phaseAt: { en: '`{ pos, bar, beat }` at time `t`: `bar` and `beat` are 0..1 through the bar and through the beat. 0 before the first downbeat.', zh: '時間 `t` 的 `{ pos, bar, beat }`：`bar` 和 `beat` 是在小節和拍子裡走了多遠，0..1。第一個強拍之前是 0。' },
      start: { en: 'Starts: the downbeat of bar 1 is at time `at`. Clears the queue and returns the scheduler.', zh: '開始：第 1 小節的強拍在時間 `at`。清空佇列並回傳排程器本身。' },
      stop: { en: 'Stops, and returns the events that were scheduled and not yet heard, so you can take them back from the kit.', zh: '停止，並回傳已經排程但還沒被聽到的事件，讓你可以把它們從鼓組收回來。' },
      setBpm: { en: 'A new tempo from time `at` on. Left out, from the end of what is already scheduled, so nothing is taken back. Returns the events taken back (`[]` if none). Does nothing for a value that is not above 0.', zh: '從時間 `at` 起換成新的速度。沒給的話，從已經排程的內容的結尾起算，所以不會有東西被收回。回傳被收回的事件（沒有就是 `[]`）。不大於 0 的值不會有任何動作。' },
      rewind: { en: 'Takes back everything scheduled at or after time `at`; the next `advance()` makes it again from the pattern and tempo as they are then. Returns the events taken back. Events already handed out by `due()` are never taken back.', zh: '把排在時間 `at` 或之後的全部收回來。下一次 `advance()` 會依那時的節奏和速度重做。回傳被收回的事件。已經被 `due()` 交出去的事件絕不會被收回。' },
      advance: { en: 'Schedules everything up to `now + lookahead` and returns the new events in order (they stay in `queue` until `due()` hands them out). If the page was frozen so long that more than 64 bars are due, it skips ahead instead of returning minutes of hits at once, and counts them in `skipped`. Does nothing, and returns `[]`, when stopped.', zh: '排好直到 `now + lookahead` 的全部，並依序回傳新的事件（它們留在 `queue` 裡，直到 `due()` 交出去）。如果頁面凍結太久，到期的超過 64 個小節，它會直接跳過去，不會一次吐出好幾分鐘的鼓，並把跳過的記在 `skipped`。停止的時候什麼都不做，回傳 `[]`。' },
      due: { en: 'The events whose time is `t` or earlier, in order, removed from the queue.', zh: '時間在 `t` 或更早的事件，依序，並從佇列移除。' },
    },
    examples: [
      {
        code: `import { DrumScheduler } from '@openav/drums';

const s = new DrumScheduler({ bpm: 120, humanize: 0 });
s.start(0);                                   // the downbeat of bar 1 is at time 0
s.advance(1.9);                               // schedule up to 1.9 + 0.1 seconds: one whole bar
const heard = s.due(0.5);                     // what is heard by 0.5 s
console.log(heard.filter((e) => e.kind === 'hit').map((e) => e.voice + '@' + e.time).join(' '));
// kick@0 hat@0 hat@0.25 kick@0.5 snare@0.5 hat@0.5
console.log(s.phaseAt(1).bar, s.posAt(2), s.timeAt(1));   // 0.5 1 2`,
        caption: { en: 'No clock, no audio: the scheduler is asked for one bar of four on the floor at 120 bpm and logs the hits heard in the first half second, with their times in seconds.', zh: '沒有時鐘、沒有聲音：向排程器要 120 bpm 四四拍的一個小節，印出前半秒聽到的鼓，連同以秒為單位的時間。' },
      },
      {
        code: `import { DrumScheduler } from '@openav/drums';
import { compile } from '@openav/pattern';

const s = new DrumScheduler({ bpm: 120, humanize: 0 });
s.setPattern(compile('bd [~ sd]*2'), { text: 'bd [~ sd]*2' });
console.log(s.mode, s.pattern);                          // string bd [~ sd]*2
console.log(s.barEvents(1).map((e) => e.voice + '@' + e.pos).join(' '));   // kick@0 snare@0.625 snare@0.875
const g = s.gridOf(1);
console.log(g.grid.snare.join(''), g.offGrid);           // 0000000000100010 0

s.start(10);
s.advance(10);
s.setBpm(60, 12);                                        // half the tempo from time 12
console.log(s.posAt(12), s.posAt(14));                   // 1 1.5`,
        caption: { en: 'A line of rhythm goes in: its first bar is read as hits, then as a 16-step grid, and a tempo change halves the speed at time 12 without moving what came before.', zh: '放進一行節奏：先把它的第一小節讀成鼓點，再讀成 16 格的格子圖，然後在時間 12 把速度減半，在那之前的不受影響。' },
      },
    ],
    related: ['DrumTransport', 'DrumSequencer', 'compile', 'toGrid', 'PATTERNS', 'GM'],
    keywords: {
      en: ['scheduler', 'schedule', 'lookahead', 'events', 'fake clock', 'tempo map', 'bar', 'position', 'swing', 'humanize'],
      zh: ['排程器', '預讀', '事件', '假時鐘', '速度', '小節', '位置', '搖擺', '擬人化', '佇列'],
    },
  },

  DrumSequencer: {
    group: 'drums',
    summary: {
      en: 'A 16-step, four-lane drum pattern clock that you move forward with `update(dt)` every frame and that calls your function for each hit.',
      zh: '一個 16 步、四條軌道的鼓節奏時鐘，每個畫面用 `update(dt)` 往前推，每一下鼓就呼叫你的函式。',
    },
    params: [
      { name: 'onHit', type: 'Function', optional: false, en: '`onHit(lane, velocity)` for every hit: `lane` is `\'kick\'`, `\'snare\'`, `\'hat\'` or `\'clap\'`, `velocity` is 0.15 to 1. You decide what a hit does: play a sound, draw, publish a signal.', zh: '每一下鼓呼叫 `onHit(lane, velocity)`：`lane` 是 `\'kick\'`、`\'snare\'`、`\'hat\'`、`\'clap\'`，`velocity` 是 0.15 到 1。一下鼓要做什麼由你決定：發聲、畫圖、發布訊號。' },
      { name: 'onStep', type: 'Function', optional: true, default: 'null', en: '`onStep(i, n)` for every 16th step: `i` is 0..15, `n` counts steps since the start. It comes before that step\'s hits. A timeline counts bars on it.', zh: '每個十六分音符步呼叫 `onStep(i, n)`：`i` 是 0..15，`n` 是從開始算起的步數。它在那一步的鼓之前。時間軸靠它數小節。' },
      { name: 'bpm', type: 'Number', optional: true, default: '112', en: 'The tempo, in beats per minute. It can be changed later: `seq.bpm = 90`.', zh: '速度，每分鐘幾拍。之後可以改：`seq.bpm = 90`。' },
      { name: 'swing', type: 'Number', optional: true, default: '0.12', en: '0 to 0.5: every odd 16th is that share of a 16th late. 0 is straight.', zh: '0 到 0.5：每個奇數的十六分音符晚那麼多個十六分音符。0 是直的。' },
      { name: 'humanize', type: 'Number', optional: true, default: '0.35', en: '0..1: some hits a few milliseconds late and a little softer or louder. Use 0 for exact, repeatable velocities (0.9 on the beat, 0.6 between).', zh: '0..1：有些鼓晚幾毫秒、力道有一點大小。要精準、可重複的力道就用 0（拍點上 0.9，其他 0.6）。' },
      { name: 'pattern', type: 'String | Object', optional: true, default: "'four on floor'", en: 'A preset name from [`PATTERNS`](#PATTERNS) or your own grid.', zh: '[`PATTERNS`](#PATTERNS) 裡的預設名稱，或你自己的格子圖。' },
    ],
    description: [
      {
        en: "It is the simplest clock: no audio, no timers, no DOM. Make it with an `onHit` that does something, call `toggle(true)`, then call `update(dt)` once per frame with the seconds since the last frame. It walks through the 16 steps of a bar (a 16th lasts `60 / bpm / 4` seconds) and calls `onHit(lane, velocity)` for each hit in the four lanes `kick`, `snare`, `hat` and `clap`. A hit is told in the frame in which it is due, so it can be late by up to a frame, and nothing happens in a hidden tab. For a steady beat under a heavy frame, use [`DrumTransport`](#DrumTransport).",
        zh: "這是最簡單的時鐘：沒有聲音、沒有計時器、沒有 DOM。做一個會做事的 `onHit`，呼叫 `toggle(true)`，然後每個畫面用距離上一個畫面過了幾秒呼叫 `update(dt)`。它會走過一個小節的 16 步（一個十六分音符是 `60 / bpm / 4` 秒），每一下 `kick`、`snare`、`hat`、`clap` 四條軌道上的鼓就呼叫 `onHit(lane, velocity)`。鼓是在到時間的那個畫面才被告知，所以最多會晚一個畫面，分頁被藏起來的時候什麼都不會發生。要在畫面很重的時候也有穩的節拍，用 [`DrumTransport`](#DrumTransport)。",
      },
      {
        en: "The grid is `seq.grid`: `{ kick: [0|1 × 16], snare, hat, clap }`. `seq.pattern` is the preset name, or `'custom'` once you changed a cell or gave your own grid. `seq.playing`, `seq.bpm`, `seq.swing` and `seq.humanize` are plain properties you can read and set.",
        zh: "格子圖是 `seq.grid`：`{ kick: [0|1 × 16], snare, hat, clap }`。`seq.pattern` 是預設的名稱，改過格子或給了自己的格子圖之後就是 `'custom'`。`seq.playing`、`seq.bpm`、`seq.swing`、`seq.humanize` 都是可以直接讀和設的普通屬性。",
      },
    ],
    members: {
      setPattern: { en: 'A preset name (`\'breakbeat\'`), or your own grid `{ kick: \'x...x...x...x...\', snare: …, hat: …, clap: … }`; a lane you leave out is silent, and `pattern` becomes `\'custom\'`. An unknown name plays `\'four on floor\'`.', zh: '預設名稱（`\'breakbeat\'`），或你自己的格子圖 `{ kick: \'x...x...x...x...\', snare: …, hat: …, clap: … }`。沒寫的軌道是靜音，`pattern` 變成 `\'custom\'`。不認識的名稱會打 `\'four on floor\'`。' },
      toggleCell: { en: 'Flips one cell: `toggleCell(\'kick\', 4)`. `lane` must be one of the four lanes. `pattern` becomes `\'custom\'`.', zh: '切換一格：`toggleCell(\'kick\', 4)`。`lane` 必須是四條軌道之一。`pattern` 變成 `\'custom\'`。' },
      toggle: { en: '`toggle(on)` starts or stops; with no argument it flips. Starting begins from step 0, and a hit left over from before a stop never lands after the next start. Returns the new state.', zh: '`toggle(on)` 開始或停止。不給參數就是反過來。開始的時候從第 0 步起，停止之前還沒送出的鼓不會在下一次開始之後跑出來。回傳新的狀態。' },
      stepDur: { en: 'Seconds one 16th lasts at the current tempo: `60 / bpm / 4`.', zh: '現在的速度下，一個十六分音符多少秒：`60 / bpm / 4`。' },
      update: { en: 'Moves the clock forward by `dt` seconds and calls `onStep` and `onHit` for what falls in that time. Does nothing while stopped. Call it once per frame.', zh: '把時鐘往前推 `dt` 秒，並對這段時間內的每一步和每一下呼叫 `onStep` 和 `onHit`。停止的時候什麼都不做。每個畫面呼叫一次。' },
    },
    examples: [
      {
        code: `import { DrumSequencer } from '@openav/drums';

const hits = [];
const seq = new DrumSequencer({
  onHit: (lane, vel) => hits.push(lane + ' ' + vel.toFixed(1)),
  bpm: 120, swing: 0, humanize: 0,
});
seq.toggle(true);
for (let i = 0; i < 32; i++) seq.update(1 / 60);   // about half a second, in 60 fps frames
console.log(hits.join(', '));
// kick 0.9, hat 0.9, hat 0.6, kick 0.9, snare 0.9, hat 0.9
console.log(seq.pattern, seq.grid.kick.join(''));   // four on floor 1000100010001000`,
        caption: { en: 'Runs half a second of four on the floor with no sound and no screen, and logs the hits: a kick and a hat on the downbeat, the off-beat hat, then kick, snare and hat on beat 2.', zh: '不用聲音也不用畫面，跑半秒的四四拍，印出鼓點：強拍上的大鼓和鈸、反拍的鈸，然後第二拍的大鼓、小鼓和鈸。' },
      },
      {
        code: `import { DrumSequencer } from '@openav/drums';

const g = document.getElementById('c').getContext('2d');
let lit = 0;
const seq = new DrumSequencer({
  bpm: 110, pattern: { kick: 'x...x...x...x...', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.' },
  onStep: (i) => { lit = i; },          // onHit would be the place to play a sound
});
seq.toggle(true);
let last = performance.now();
(function frame(now) {
  seq.update((now - last) / 1000); last = now;
  g.fillStyle = '#111'; g.fillRect(0, 0, 400, 300);
  for (let i = 0; i < 16; i++) { g.fillStyle = i === lit ? '#ffd166' : '#2a3348'; g.fillRect(12 + i * 23, 120, 18, 60); }
  requestAnimationFrame(frame);
})(last);`,
        caption: { en: 'Sixteen blocks on the canvas, and a bright one runs along them in time with the beat. There is no sound: `onHit` is where you would play one.', zh: '畫布上有十六個方塊，亮的那一個跟著節拍跑。這裡沒有聲音：`onHit` 就是你放發聲程式的地方。' },
      },
    ],
    related: ['DrumTransport', 'DrumScheduler', 'PATTERNS', 'laneSteps', 'mountDrums', 'GM'],
    keywords: {
      en: ['sequencer', 'step sequencer', '16 steps', 'pattern clock', 'tempo', 'swing', 'humanize', 'lanes', 'kick', 'snare'],
      zh: ['音序器', '步進音序器', '16 步', '節奏時鐘', '速度', '搖擺', '擬人化', '軌道', '大鼓', '小鼓'],
    },
  },

  drumEngine: {
    group: 'drums',
    summary: {
      en: 'A drum kit made of Web Audio synthesis, with no sample files: General MIDI drum notes go in, drum sounds come out.',
      zh: '一組用 Web Audio 合成的鼓組，沒有取樣檔：送進 General MIDI 的鼓音符，就打出鼓聲。',
    },
    params: [
      { name: 'samples', type: 'Object', optional: true, default: 'null', en: 'Play audio files instead of the synthesis: `{ 36: \'kick.wav\', 38: \'snare.wav\' }`, MIDI note number to URL. They are fetched and decoded by `enable()`; a file that fails to load is skipped without an error, and a note of the kit then plays its synthesized sound instead.', zh: '用音檔取代合成：`{ 36: \'kick.wav\', 38: \'snare.wav\' }`，MIDI 音符號碼對應網址。`enable()` 會去下載並解碼。載入失敗的檔案會被略過、不報錯，屬於鼓組的音符就改用合成的聲音打。' },
    ],
    returns: {
      type: 'Object',
      en: 'An engine: `{ params, context, output, enable(), noteOn(note, vel01, time), hit(what, vel01, time), noteOff(), set(key, value), dispose() }`.',
      zh: '一個引擎：`{ params, context, output, enable(), noteOn(note, vel01, time), hit(what, vel01, time), noteOff(), set(key, value), dispose() }`。',
    },
    description: [
      {
        en: "It follows the small engine contract of [`@openav/sound`](#Sound), so the same shell and the same signals drive it: `enable()` makes the `AudioContext`, `noteOn(note, vel01, time)` plays a drum, `set(key, value)` sets a param. The kit has thirteen voices (see [`GM`](#GM)): kick, rim, snare, clap, low tom, hat, pedal hat, tom, open hat, high tom, crash, ride and cowbell. A note the kit does not know (any melodic note) plays nothing and returns `null`.",
        zh: "它遵守 [`@openav/sound`](#Sound) 的小小引擎約定，所以同一個外殼、同樣的訊號都能驅動它：`enable()` 建立 `AudioContext`，`noteOn(note, vel01, time)` 打一下鼓，`set(key, value)` 設定參數。鼓組有十三種鼓聲（見 [`GM`](#GM)）：大鼓、鼓邊、小鼓、拍手、落地鼓、鈸、踩鈸、中鼓、開鈸、高音中鼓、碎音鈸、疊音鈸、牛鈴。鼓組不認得的音符（任何旋律音符）不會發聲，並回傳 `null`。",
      },
      {
        en: "`noteOn(note, vel01, time)` returns `{ time, cancel() }`, or `null` before `enable()` or for a note it does not play. `time` is on the kit's own clock (`engine.context.currentTime`); left out, or already past, the hit sounds now. `cancel()` silences a hit that has not started, which is how [`DrumTransport`](#DrumTransport) takes back what it scheduled when the tempo changes. `hit('crash', 0.9)` plays a voice by name (or a note number) for code that is not a MIDI pad. There is one param, `kitVolume`, from −30 to 0 dB (default −6).",
        zh: "`noteOn(note, vel01, time)` 回傳 `{ time, cancel() }`，在 `enable()` 之前，或遇到它不打的音符時回傳 `null`。`time` 是鼓組自己的時鐘（`engine.context.currentTime`）上的時間。沒給，或已經過了，這一下就馬上響。`cancel()` 能讓還沒開始的鼓靜音，[`DrumTransport`](#DrumTransport) 在速度改變時就是用它把排好的收回來。`hit('crash', 0.9)` 用名字（或音符號碼）打一種鼓，給不是 MIDI 墊子的程式用。它有一個參數 `kitVolume`，從 −30 到 0 dB（預設 −6）。",
      },
      {
        en: "Once enabled, `engine.context` is its `AudioContext` and `engine.output` is the node that goes to the speakers, which a recorder can tap. Before that both are `null`. `noteOff()` does nothing (drums ring out) and `dispose()` closes the context.",
        zh: "啟用之後，`engine.context` 是它的 `AudioContext`，`engine.output` 是接到喇叭的節點，錄音器可以從這裡接。在那之前兩個都是 `null`。`noteOff()` 什麼都不做（鼓聲自己響完），`dispose()` 會關掉 context。",
      },
    ],
    needs: {
      en: "`await kit.enable()` from a click: browsers start audio only after a user gesture. [`mountDrums()`](#mountDrums) and [`DrumTransport`](#DrumTransport) with `autoEnable` do that for you on the first hit.",
      zh: "要在點擊裡 `await kit.enable()`：瀏覽器要使用者做過一個動作才讓聲音開始。[`mountDrums()`](#mountDrums) 和 `autoEnable` 的 [`DrumTransport`](#DrumTransport) 會在第一下鼓的時候替你做。",
    },
    examples: [
      {
        code: `import { drumEngine, GM } from '@openav/drums';

const kit = drumEngine();
console.log(kit.params.map((p) => p.key + ' ' + p.min + '..' + p.max + ' (' + p.def + ')').join());
// kitVolume -30..0 (-6)
console.log(kit.noteOn(GM.kick, 1), kit.context);   // null null: not enabled yet`,
        caption: { en: 'Before \`enable()\` the kit has a param but no sound and no \`AudioContext\`: \`noteOn()\` returns \`null\`.', zh: '在 `enable()` 之前，鼓組有參數但沒有聲音也沒有 `AudioContext`：`noteOn()` 回傳 `null`。' },
      },
      {
        code: `import { drumEngine } from '@openav/drums';

const kit = drumEngine();
document.body.addEventListener('click', async () => {
  await kit.enable();                                          // from a click: audio may start
  kit.hit('kick');
  kit.hit('snare', 0.9, kit.context.currentTime + 0.5);        // half a second from now
  kit.hit('crash', 0.8, kit.context.currentTime + 1);
});`,
        caption: { en: 'Click the page: a kick, then a snare half a second later and a crash after a second. The times are on the kit\'s own audio clock.', zh: '在頁面上點一下：先是大鼓，半秒後小鼓，一秒後碎音鈸。時間是鼓組自己的音訊時鐘上的時間。' },
        run: 'static',
        why: 'It needs a click to start the browser\'s audio and a speaker to hear it; the silent part (the params, `null` before `enable()`) is the other example.',
      },
    ],
    related: ['DrumTransport', 'mountDrums', 'GM', 'voiceForNote', 'Sound', 'toneEngine'],
    keywords: {
      en: ['drum kit', 'drum sounds', 'synth drums', 'web audio', 'engine', 'noteOn', 'kick', 'snare', 'general midi', 'samples'],
      zh: ['鼓組', '鼓聲', '合成鼓', '引擎', '大鼓', '小鼓', '取樣', '音量', 'general midi'],
    },
  },

  drumName: {
    group: 'drums',
    summary: {
      en: 'The name of a drum for the screen, in English or in Chinese: `drumName(\'lowtom\')` is `\'low tom\'`.',
      zh: '給人讀的鼓的名字，英文或中文：`drumName(\'lowtom\', \'zh\')` 是 `\'落地鼓\'`。',
    },
    params: [
      { name: 'voice', type: 'String', en: 'The drum: `kick`, `snare`, `hat`, `clap`, `openhat`, `pedalhat`, `rim`, `lowtom`, `tom`, `hightom`, `crash`, `ride` or `cowbell`.', zh: '哪種鼓：`kick`、`snare`、`hat`、`clap`、`openhat`、`pedalhat`、`rim`、`lowtom`、`tom`、`hightom`、`crash`、`ride`、`cowbell`。' },
      { name: 'lang', type: "'en' | 'zh'", optional: true, default: "'en'", en: '`\'zh\'` for Chinese; anything else is English.', zh: '`\'zh\'` 是中文。其他都是英文。' },
    ],
    returns: { type: 'String', en: 'The name, or `voice` itself if it is not a drum of the kit.', zh: '名字。如果 `voice` 不是鼓組的鼓，就原樣回傳 `voice`。' },
    description: [
      {
        en: "The drum names inside code stay English everywhere (`'kick'`, `'snare'`), and this is for the screen: the row labels of the drum machine card use it, and with `'zh'` they are written in Chinese.",
        zh: "程式裡的鼓的名字到處都保持英文（`'kick'`、`'snare'`），這個函式是給畫面顯示用的：鼓機卡的列標籤就是用它，中文的瀏覽器裡是 大鼓 小鼓 鈸 拍手。",
      },
    ],
    examples: [
      {
        code: `import { drumName } from '@openav/drums';

console.log(drumName('kick'), drumName('kick', 'zh'));         // kick, then the Chinese name of the kick
console.log(drumName('openhat', 'zh'), drumName('lowtom', 'zh')); // Chinese names of the open hat and the low tom
console.log(drumName('banjo', 'zh'));                           // banjo, not a drum: returned as is`,
        caption: { en: 'Logs a few drums in English and in Chinese, and what a name that is not a drum gives back.', zh: '印出幾種鼓的英文和中文名字，以及不是鼓的名字會得到什麼。' },
      },
    ],
    related: ['GM', 'mountDrums', 'WORDS'],
    keywords: {
      en: ['drum names', 'labels', 'translate', 'chinese', 'display name', 'localization'],
      zh: ['鼓的名字', '標籤', '翻譯', '中文', '顯示名稱', '在地化'],
    },
  },

  GM: {
    group: 'drums',
    summary: {
      en: 'The General MIDI drum note each drum of the kit plays: `GM.kick` is 36, `GM.snare` is 38.',
      zh: '鼓組裡每種鼓對應的 General MIDI 鼓音符：`GM.kick` 是 36，`GM.snare` 是 38。',
    },
    value: {
      type: 'Object',
      en: '`{ kick: 36, rim: 37, snare: 38, clap: 39, lowtom: 41, hat: 42, pedalhat: 44, tom: 45, openhat: 46, hightom: 48, crash: 49, ride: 51, cowbell: 56 }`: drum name to MIDI note number.',
      zh: '`{ kick: 36, rim: 37, snare: 38, clap: 39, lowtom: 41, hat: 42, pedalhat: 44, tom: 45, openhat: 46, hightom: 48, crash: 49, ride: 51, cowbell: 56 }`：鼓的名字對應 MIDI 音符號碼。',
    },
    description: [
      {
        en: "Drum pads and drum machines send these notes on MIDI channel 10. The drum machine sends them as `midi/note/on` `{ note, vel, ch: 10 }` for every hit, so anything that listens to MIDI hears the drums. The reverse, from a note to a drum, is [`voiceForNote()`](#voiceForNote), which also knows the neighbouring General MIDI notes (35 is also a kick, 40 is also a snare).",
        zh: "打擊墊和鼓機在 MIDI 頻道 10 送這些音符。鼓機每打一下就送一個 `midi/note/on` `{ note, vel, ch: 10 }`，所以任何聽 MIDI 的東西都聽得到鼓。從音符反查是哪種鼓用 [`voiceForNote()`](#voiceForNote)，它也認得 General MIDI 相鄰的音符（35 也是大鼓，40 也是小鼓）。",
      },
    ],
    examples: [
      {
        code: `import { GM, voiceForNote } from '@openav/drums';

console.log(GM.kick, GM.snare, GM.hat);        // 36 38 42
console.log(Object.keys(GM).length);            // 13
console.log(voiceForNote(GM.crash));            // crash`,
        caption: { en: 'Logs the notes of three drums, how many drums the kit has, and that the note of a drum maps back to the drum.', zh: '印出三種鼓的音符、鼓組有幾種鼓，以及鼓的音符可以反查回那種鼓。' },
      },
    ],
    related: ['voiceForNote', 'drumEngine', 'WORDS', 'drumHit'],
    keywords: {
      en: ['general midi', 'gm', 'drum notes', 'channel 10', 'midi drum map', 'note numbers', 'kick 36'],
      zh: ['general midi', 'gm', '鼓音符', '頻道 10', '音符號碼', '鼓對照表', '大鼓 36'],
    },
  },

  voiceForNote: {
    group: 'drums',
    summary: {
      en: 'Tells which drum of the kit a General MIDI drum note plays, or `null` for a note it does not play.',
      zh: '告訴你一個 General MIDI 鼓音符會打鼓組裡的哪一種鼓，不打的音符回傳 `null`。',
    },
    params: [
      { name: 'note', type: 'Number', en: 'A MIDI note number.', zh: 'MIDI 音符號碼。' },
    ],
    returns: { type: 'String | null', en: 'The drum name (`\'kick\'`, `\'crash\'`…), or `null`.', zh: '鼓的名字（`\'kick\'`、`\'crash\'`…），或 `null`。' },
    description: [
      {
        en: "Pads and drum machines send notes on channel 10, and several notes map to the same drum: 35 and 36 are kicks, 38 and 40 snares, 41 and 43 low toms, 45 and 47 toms, 48 and 50 high toms, 49, 52, 55 and 57 crashes, 51, 53 and 59 rides. A note that is not in the table, such as a melodic 60, gives `null`: the kit stays silent instead of guessing, because a wrong cymbal on a kick pad is worse than nothing.",
        zh: "打擊墊和鼓機在頻道 10 送音符，好幾個音符會對到同一種鼓：35 和 36 是大鼓，38 和 40 是小鼓，41 和 43 是落地鼓，45 和 47 是中鼓，48 和 50 是高音中鼓，49、52、55、57 是碎音鈸，51、53、59 是疊音鈸。不在表裡的音符，像旋律用的 60，會回傳 `null`：鼓組寧可不出聲也不亂猜，因為大鼓的打擊墊打出錯的鈸，比沒聲音還糟。",
      },
    ],
    examples: [
      {
        code: `import { voiceForNote } from '@openav/drums';

console.log(voiceForNote(36), voiceForNote(35));   // kick kick
console.log(voiceForNote(49), voiceForNote(57));   // crash crash
console.log(voiceForNote(60));                      // null, a melodic note`,
        caption: { en: 'Logs which drum a few notes play: two notes for one drum, and a melodic note that plays none.', zh: '印出幾個音符打哪一種鼓：兩個音符對同一種鼓，以及一個不打任何鼓的旋律音符。' },
      },
    ],
    related: ['GM', 'drumEngine', 'WORDS'],
    keywords: {
      en: ['general midi', 'note to drum', 'channel 10', 'pad', 'drum map', 'reverse lookup'],
      zh: ['general midi', '音符對應鼓', '頻道 10', '打擊墊', '鼓對照表', '反查'],
    },
  },

  laneSteps: {
    group: 'drums',
    summary: {
      en: "Turns a lane written as text, like 'x...x...x...x...', or as a list into 16 steps of 0 and 1.",
      zh: "把寫成文字的軌道，像 'x...x...x...x...'，或寫成陣列的軌道，變成 16 格 0 和 1。",
    },
    params: [
      { name: 'v', type: 'String | Array', en: 'The lane. In text, `x`, `X` and `1` are hits and everything else is a rest; spaces and `|` are ignored, so they can help the eye. In a list, `1` and `true` are hits.', zh: '軌道。文字的話，`x`、`X`、`1` 是鼓點，其他都是休止。空白和 `|` 會被忽略，可以用來幫助眼睛。陣列的話，`1` 和 `true` 是鼓點。' },
    ],
    returns: { type: 'Number[]', en: 'An array of 16 numbers, 1 for a hit and 0 for a rest. A short lane is padded with rests, a long one is cut at 16.', zh: '一個 16 個數字的陣列，1 是鼓點、0 是休止。太短的軌道用休止補滿，太長的在第 16 格截掉。' },
    description: [
      {
        en: "It is how every grid you write is read: `{ kick: 'x...x...x...x...' }` in [`DrumSequencer`](#DrumSequencer), [`DrumScheduler`](#DrumScheduler) and [`startDrums()`](#startDrums). `'x... x... x... x...'` and `'1000100010001000'` are the same lane. Note that the dot is a rest here, and only here: in a line of rhythm (see [`compile()`](#compile)) a rest is `~`.",
        zh: "你寫的每一張格子圖都是這樣被讀的：[`DrumSequencer`](#DrumSequencer)、[`DrumScheduler`](#DrumScheduler) 和 [`startDrums()`](#startDrums) 裡的 `{ kick: 'x...x...x...x...' }`。`'x... x... x... x...'` 和 `'1000100010001000'` 是同一條軌道。注意點在這裡是休止，只有在這裡：一行節奏（見 [`compile()`](#compile)）裡的休止是 `~`。",
      },
    ],
    examples: [
      {
        code: `import { laneSteps } from '@openav/drums';

console.log(laneSteps('x... x... x... x...').join(''));   // 1000100010001000
console.log(laneSteps([1, 0, true]).join(''));            // 1010000000000000
console.log(laneSteps('x').length, laneSteps('x'.repeat(40)).length);   // 16 16`,
        caption: { en: 'Logs a lane written with spaces, a lane written as a list, and that any length comes out as 16 steps.', zh: '印出用空白寫的軌道、用陣列寫的軌道，以及不管多長出來都是 16 格。' },
      },
    ],
    related: ['PATTERNS', 'DrumSequencer', 'DrumScheduler', 'fromGrid'],
    keywords: {
      en: ['lane', 'steps', 'grid', 'x...', 'pattern string', 'parse lane', '16 steps'],
      zh: ['軌道', '步進', '格子', '格子字串', '解析軌道', '16 格'],
    },
  },

  PATTERNS: {
    group: 'drums',
    summary: {
      en: "The five preset grids of the drum machine: 'four on floor', breakbeat, 'half time', latin and sparse.",
      zh: "鼓機內建的五個預設格子圖：'four on floor'、breakbeat、'half time'、latin、sparse。",
    },
    value: {
      type: 'Object',
      en: 'Five presets, each `{ kick, snare, hat, clap }` as 16-character strings of `1` and `0`.',
      zh: '五個預設，每個都是 `{ kick, snare, hat, clap }`，各是 16 個字的 `1` 和 `0`。',
    },
    description: [
      {
        en: "The preset names are what [`startDrums()`](#startDrums), [`DrumSequencer`](#DrumSequencer) and [`mountDrums()`](#mountDrums) accept as a `pattern`. A preset is just data, so you can start from one: `{ ...PATTERNS.latin, clap: 'x...x...x...x...' }` is `latin` with a clap on every beat.",
        zh: "預設的名稱就是 [`startDrums()`](#startDrums)、[`DrumSequencer`](#DrumSequencer)、[`mountDrums()`](#mountDrums) 的 `pattern` 收的值。預設就只是資料，所以你可以從其中一個開始改：`{ ...PATTERNS.latin, clap: 'x...x...x...x...' }` 就是在 `latin` 上每一拍加一下拍手。",
      },
      {
        en: "The five presets as text, one lane per column:\n\n```text\n                  kick              snare             hat               clap\nfour on floor     1000100010001000  0000100000001000  1010101010101010  0000000000000000\nbreakbeat         1000000110100000  0000100000001001  1010101010101010  0000100000000000\nhalf time         1000000000001000  0000000010000000  1010101010101010  0000000010000000\nlatin             1000001000100000  0010010000100100  1011101110111011  0000000000000000\nsparse            1000000000100000  0000000000000000  0010001000100010  0000000010000000\n```",
        zh: "五個預設的內容，一欄一條軌道：\n\n```text\n                  kick              snare             hat               clap\nfour on floor     1000100010001000  0000100000001000  1010101010101010  0000000000000000\nbreakbeat         1000000110100000  0000100000001001  1010101010101010  0000100000000000\nhalf time         1000000000001000  0000000010000000  1010101010101010  0000000010000000\nlatin             1000001000100000  0010010000100100  1011101110111011  0000000000000000\nsparse            1000000000100000  0000000000000000  0010001000100010  0000000010000000\n```",
      },
    ],
    examples: [
      {
        code: `import { PATTERNS, DrumSequencer } from '@openav/drums';

console.log(Object.keys(PATTERNS).join(' | '));   // four on floor | breakbeat | half time | latin | sparse
console.log(PATTERNS['half time'].snare);          // 0000000010000000

const seq = new DrumSequencer({ onHit() {} });
seq.setPattern({ ...PATTERNS.latin, clap: 'x...x...x...x...' });   // latin plus a clap on every beat
console.log(seq.pattern, seq.grid.clap.join(''));  // custom 1000100010001000`,
        caption: { en: 'Lists the presets, reads one lane, and builds a variation of `latin` by spreading it into a new grid.', zh: '列出預設、讀其中一條軌道，並把 `latin` 展開成新的格子圖，做出一個變化版。' },
      },
    ],
    related: ['laneSteps', 'DrumSequencer', 'DrumScheduler', 'mountDrums', 'startDrums'],
    keywords: {
      en: ['presets', 'patterns', 'four on floor', 'breakbeat', 'half time', 'latin', 'sparse', 'beats', 'grids'],
      zh: ['預設', '節奏', 'four on floor', 'breakbeat', 'half time', 'latin', 'sparse', '格子圖'],
    },
  },
};
