// @openav/keys reference: the on-screen piano, QWERTY playing and a simulated performer. Read by tools/build-reference.mjs
// (see AGENTS.md, "Documenting a public name"). The keys are the public names the code has; a key the code does not have is a red test.

export default {
  mountKeys: {
    group: 'keys',
    summary: {
      en: 'Puts a playable piano on the page in one call, with a keyboard switch and a self-playing performer, and publishes every note as `midi/note/on` and `midi/note/off`.',
      zh: '一個呼叫就在頁面上放一架可以彈的鋼琴，附電腦鍵盤開關和會自己演奏的演奏者，並把每個音發布成 `midi/note/on` 和 `midi/note/off`。',
    },
    params: [
      { name: 'container', type: 'HTMLElement', en: 'The element to put the piano in. It gets a small bar of checkboxes and the piano under it. `dispose()` empties it again.', zh: '要放鋼琴的元素。裡面會有一條小小的勾選列，和它底下的鋼琴。`dispose()` 會再把它清空。' },
      { name: 'signals', type: 'Signals', optional: true, en: 'The [`Signals`](#Signals) bus to publish into. Every key down is `midi/note/on` `{ note, vel, ch: 0 }` (`vel` 0..1) and every key up `midi/note/off` `{ note, ch: 0 }`. Without a bus the piano still works and calls `chord`.', zh: '要發布訊號的 [`Signals`](#Signals) 匯流排。每個按下去的鍵是 `midi/note/on` `{ note, vel, ch: 0 }`（`vel` 是 0..1），每個放開的鍵是 `midi/note/off` `{ note, ch: 0 }`。沒給匯流排的話鋼琴照樣能彈，也會呼叫 `chord`。' },
      { name: 'chord', type: 'ChordDetector', optional: true, default: 'null', en: 'Anything with `noteOn(note, vel01)` and `noteOff(note)`, usually a chord detector from `@openav/chord`, to be fed every note directly.', zh: '任何有 `noteOn(note, vel01)` 和 `noteOff(note)` 的東西，通常是 `@openav/chord` 的和弦偵測器，每個音都會直接餵給它。' },
      { name: 'base', type: 'Number', optional: true, default: '48', en: 'The MIDI note of the lowest key (48 is C3). The simulated performer plays an octave above it.', zh: '最低那個鍵的 MIDI 音符號碼（48 是 C3）。模擬演奏者彈的是它高一個八度的地方。' },
      { name: 'octaves', type: 'Number', optional: true, default: '2', en: 'How many octaves the piano shows. It has `octaves × 12 + 1` keys, so two octaves end on a C.', zh: '鋼琴有幾個八度。鍵數是 `octaves × 12 + 1`，所以兩個八度會結束在一個 C。' },
      { name: 'sim', type: 'Boolean', optional: true, default: 'true', en: 'Show the "simulate performance" checkbox. The performer exists either way: `keys.sim.toggle(true)` starts it from code.', zh: '要不要顯示「simulate performance」勾選框。不管有沒有顯示，演奏者都在：用程式 `keys.sim.toggle(true)` 就能開始。' },
      { name: 'capture', type: 'Boolean', optional: true, default: 'true', en: 'Show the "keyboard" checkbox that lets the computer keyboard play the piano. With `false` there is no checkbox and `captureBox` is `null`; you can still set `keys.piano.captureEnabled = true`.', zh: '要不要顯示「keyboard」勾選框，讓電腦鍵盤能彈這架鋼琴。給 `false` 就沒有勾選框，`captureBox` 是 `null`。你還是可以自己設 `keys.piano.captureEnabled = true`。' },
    ],
    returns: {
      type: 'Object',
      en: '`{ piano, sim, update(dt), dispose(), captureBox }`: the [`KeysPiano`](#KeysPiano), the [`SimPlayer`](#SimPlayer), a function to call every frame with the seconds since the last one (it drives the performer), a function that takes everything down again, and the "keyboard" checkbox (or `null`).',
      zh: '`{ piano, sim, update(dt), dispose(), captureBox }`：[`KeysPiano`](#KeysPiano)、[`SimPlayer`](#SimPlayer)、每個畫面要呼叫的函式（參數是距離上一次過了幾秒，它帶動演奏者）、把一切拆掉的函式，以及「keyboard」勾選框（或 `null`）。',
    },
    description: [
      {
        en: "`mountKeys()` is the whole keyboard department in one line: a [`KeysPiano`](#KeysPiano) you can play with the mouse, a finger or the computer keyboard, and a [`SimPlayer`](#SimPlayer) that plays by itself. Above the piano are two checkboxes, both off to begin with: **keyboard** (the QWERTY keys play, `Z` and `X` move an octave, `Shift` plays harder) and **simulate performance**.",
        zh: "`mountKeys()` 一行就把整個鍵盤部門裝好：一架可以用滑鼠、手指或電腦鍵盤彈的 [`KeysPiano`](#KeysPiano)，加上一個會自己彈的 [`SimPlayer`](#SimPlayer)。鋼琴上面有兩個勾選框，一開始都沒勾：**keyboard**（QWERTY 鍵能彈，`Z` 和 `X` 換八度，`Shift` 彈得比較重）和 **simulate performance**。",
      },
      {
        en: "Everything is published as the standard `midi/note/on` and `midi/note/off`, the same names a real MIDI keyboard uses, so a world, a sound engine or a chord detector cannot tell a QWERTY performance from hardware. Call `keys.update(dt)` once per frame, or the simulated performer does not move.",
        zh: "所有東西都發布成標準的 `midi/note/on` 和 `midi/note/off`，跟真的 MIDI 鍵盤用同樣的名字，所以世界、聲音引擎或和弦偵測器分不出 QWERTY 演奏和硬體的差別。每個畫面要呼叫一次 `keys.update(dt)`，不然模擬演奏者不會動。",
      },
    ],
    needs: {
      en: "A page with a DOM. The keyboard checkbox must be ticked before the computer keyboard plays, on purpose: while it is on, every letter key is taken by the piano, so hotkeys on letters stop working. A key listener goes on `window` until `dispose()`.",
      zh: "需要有 DOM 的頁面。要先勾「keyboard」電腦鍵盤才會彈，這是故意的：勾著的時候所有字母鍵都被鋼琴吃掉，字母的快捷鍵就不能用。`window` 上的按鍵監聽會一直在，直到 `dispose()`。",
    },
    notes: [
      {
        en: "In a p5 sketch you do not need this: the 🎹 panel of oav-p5 is a piano like this one, and [`notePressed()`](#notePressed) hears it. `mountKeys()` is for a page that has no oav-p5.",
        zh: "在 p5 草圖裡用不到這個：oav-p5 的 🎹 面板就是一架這樣的鋼琴，[`notePressed()`](#notePressed) 聽得到它。`mountKeys()` 是給沒有 oav-p5 的頁面用的。",
      },
    ],
    examples: [
      {
        code: `import { mountKeys } from '@openav/keys';
import { Signals } from '@openav/core';

const signals = new Signals();
signals.on('midi/note/on', ({ note, vel }) => console.log('on', note, vel.toFixed(2)));
signals.on('midi/note/off', ({ note }) => console.log('off', note));

const keys = mountKeys(document.getElementById('app'), { signals, base: 48 });
keys.piano.press(60, 0.8);     // as if C4 was clicked
keys.piano.release(60);
// on 60 0.80
// off 60`,
        caption: { en: 'A two-octave piano appears on the page with its two checkboxes; click a key and the console logs the same events the code below sends.', zh: '頁面上出現兩個八度的鋼琴和它的兩個勾選框。點一個鍵，console 就印出跟下面程式送出的同樣的事件。' },
      },
      {
        code: `import { mountKeys } from '@openav/keys';
import { Signals } from '@openav/core';

const signals = new Signals();
const heard = [];
signals.on('midi/note/on', ({ note }) => heard.push(note));

const keys = mountKeys(document.getElementById('app'), { signals, octaves: 3, capture: false });
keys.sim.toggle(true);                          // the performer plays by itself
const t0 = performance.now();
let last = t0;
(function frame(now) {
  keys.update((now - last) / 1000); last = now;   // seconds since the last frame
  if (now - t0 < 3000) return requestAnimationFrame(frame);
  console.log(heard.length > 0, keys.captureBox);  // true null
  keys.dispose();                                   // the piano is taken down
})(t0);`,
        caption: { en: 'A three-octave piano plays itself for three seconds, its keys lighting up, and then it is taken down. `capture: false` leaves out the keyboard checkbox.', zh: '一架三個八度的鋼琴自己彈三秒，琴鍵一個個亮起來，然後被拆掉。`capture: false` 讓「keyboard」勾選框不出現。' },
      },
    ],
    related: ['KeysPiano', 'SimPlayer', 'PIANO_KEYMAP', 'Signals', 'notePressed'],
    keywords: {
      en: ['piano', 'keyboard', 'keys', 'qwerty', 'on-screen piano', 'midi/note/on', 'simulate', 'virtual keyboard', 'play'],
      zh: ['鋼琴', '鍵盤', '琴鍵', '螢幕鋼琴', '電腦鍵盤', '模擬演奏', '虛擬鍵盤', '彈琴'],
    },
  },

  KeysPiano: {
    group: 'keys',
    summary: {
      en: 'An on-screen piano you can play with the mouse, a finger or the computer keyboard, that calls a function for every note.',
      zh: '一架螢幕上的鋼琴，可以用滑鼠、手指或電腦鍵盤彈，每彈一個音就呼叫你的函式。',
    },
    params: [
      { name: 'container', type: 'HTMLElement', en: 'The element the keys are built in. It gets the class `oav-keys` and is emptied first.', zh: '要把琴鍵蓋在裡面的元素。它會得到 `oav-keys` 這個 class，並且先被清空。' },
      { name: 'opts', type: 'Object', optional: true, default: '{}', en: 'Options: `base` (lowest key, default 48), `octaves` (default 2), `semitones` (the number of keys, default `octaves × 12 + 1`), `velocity` (0..127 for the mouse and the computer keyboard, default 100), `onNote(note, vel01, on)`, `onOctave(base)`, `fill` (size the keys in percent of the container, so it can be any width), `keyWidth` (px per white key when not filling, default 27), `minBase` (24) and `maxBase` (84), the range the octave keys can move `base` in.', zh: '選項：`base`（最低的鍵，預設 48）、`octaves`（預設 2）、`semitones`（鍵的數量，預設 `octaves × 12 + 1`）、`velocity`（滑鼠和電腦鍵盤的力道，0..127，預設 100）、`onNote(note, vel01, on)`、`onOctave(base)`、`fill`（琴鍵用容器的百分比算大小，所以可以是任何寬度）、`keyWidth`（不 fill 的時候每個白鍵幾像素，預設 27）、`minBase`（24）和 `maxBase`（84），也就是八度鍵能移動 `base` 的範圍。' },
    ],
    description: [
      {
        en: "`new KeysPiano(el, { onNote })` builds the keys inside `el`. Whatever plays a key (a click or a touch on it, sweeping across the keys with the button held, the computer keyboard, or your own call to `press()`) ends up in `onNote(note, vel01, on)`: `on` is `true` for a key going down and `false` for one coming up, and `vel01` is 0..1 (0 on the way up). The black and white pattern follows the real pitch, so a piano can start on any note. A key that is already down ignores a second `press()`.",
        zh: "`new KeysPiano(el, { onNote })` 在 `el` 裡蓋出琴鍵。不管是誰彈了一個鍵（在上面點一下或觸碰、按著按鈕滑過琴鍵、電腦鍵盤，或你自己呼叫 `press()`），最後都會進到 `onNote(note, vel01, on)`：`on` 是 `true` 表示鍵按下去，`false` 表示放開，`vel01` 是 0..1（放開時是 0）。黑白鍵的排法照真正的音高走，所以鋼琴可以從任何一個音開始。已經按著的鍵再 `press()` 會被忽略。",
      },
      {
        en: "The computer keyboard is off until you set `piano.captureEnabled = true`, and it is up to you to pass the page's `keydown` and `keyup` events to [`handleKeyDown(e)`](#KeysPiano) and `handleKeyUp(e)` (see [`PIANO_KEYMAP`](#PIANO_KEYMAP) for which letter is which note). [`mountKeys()`](#mountKeys) does all of that for you.",
        zh: "電腦鍵盤一開始是關的，要自己設 `piano.captureEnabled = true`，並且由你把頁面的 `keydown` 和 `keyup` 事件交給 `handleKeyDown(e)` 和 `handleKeyUp(e)`（哪個字母是哪個音見 [`PIANO_KEYMAP`](#PIANO_KEYMAP)）。[`mountKeys()`](#mountKeys) 把這些全部替你做了。",
      },
    ],
    notes: [
      {
        en: "`handleKeyDown(e)` returns `true` when the piano used the event, and then you should call `e.preventDefault()`. While capturing, every letter `a`–`z` counts as used, even those that play no note, so a stray letter cannot trigger a hotkey; digits, space and the arrows pass through. Held keys with `Ctrl`, `Cmd` or `Alt` are never used.",
        zh: "鋼琴用掉這個事件的時候，`handleKeyDown(e)` 會回傳 `true`，那時你要呼叫 `e.preventDefault()`。在擷取鍵盤的時候，每個字母 `a`–`z` 都算被用掉，連不發音的也是，這樣打錯的字母不會觸發快捷鍵。數字、空白鍵、方向鍵會放行。有按著 `Ctrl`、`Cmd`、`Alt` 的組合鍵永遠不算。",
      },
    ],
    members: {
      noteName: {
        en: 'The name of a MIDI note with sharps: `noteName(60)` is `\'C4\'`, `noteName(61)` is `\'C#4\'`.',
        zh: 'MIDI 音符號碼的音名，用升記號：`noteName(60)` 是 `\'C4\'`，`noteName(61)` 是 `\'C#4\'`。',
      },
      setBase: {
        en: 'Moves the piano to start on note `n`, held between `minBase` and `maxBase`. Sounding keys are released first, so no note sticks. `onOctave(base)` is called with the new value when it changed.',
        zh: '讓鋼琴改成從音符 `n` 開始，限制在 `minBase` 和 `maxBase` 之間。會先放開正在響的鍵，所以不會有音卡住。數值有改變的時候會呼叫 `onOctave(base)`。',
      },
      press: {
        en: 'Presses a key as if it was played: `press(60, 0.8)`. The key lights up and `onNote(60, 0.8, true)` is called. Pressing a key that is already down does nothing.',
        zh: '像有人彈了一個鍵那樣按下去：`press(60, 0.8)`。琴鍵會亮起來，並呼叫 `onNote(60, 0.8, true)`。已經按著的鍵再按沒有作用。',
      },
      release: {
        en: 'Lets a key go: `release(60)` calls `onNote(60, 0, false)`. A key that is not down does nothing.',
        zh: '放開一個鍵：`release(60)` 會呼叫 `onNote(60, 0, false)`。沒按著的鍵沒有作用。',
      },
      releaseAll: {
        en: 'Releases every key that is down, from the mouse, touch or computer keyboard. Call it when focus is lost so nothing sticks.',
        zh: '放開所有按著的鍵，不管是從滑鼠、觸碰還是電腦鍵盤按的。焦點離開時呼叫它，才不會有音卡住。',
      },
      handleKeyDown: {
        en: 'Give it a `keydown` event. `Z` and `X` move the piano an octave down and up, a letter in [`PIANO_KEYMAP`](#PIANO_KEYMAP) presses its note (`Shift` adds 20 to the velocity), and the other letters are swallowed. Returns `true` when the event was used. A key held down (`e.repeat`) does not retrigger.',
        zh: '把 `keydown` 事件交給它。`Z` 和 `X` 讓鋼琴降一個八度、升一個八度，[`PIANO_KEYMAP`](#PIANO_KEYMAP) 裡的字母會按下它的音（`Shift` 讓力道加 20），其他字母會被吃掉。事件被用掉就回傳 `true`。一直按著的鍵（`e.repeat`）不會重複觸發。',
      },
      handleKeyUp: {
        en: 'Give it a `keyup` event: it releases the note that key pressed. Returns `true` when the event was used.',
        zh: '把 `keyup` 事件交給它：會放開那個鍵按下的音。事件被用掉就回傳 `true`。',
      },
    },
    examples: [
      {
        code: `import { KeysPiano } from '@openav/keys';

const piano = new KeysPiano(document.getElementById('app'), {
  base: 60, octaves: 1,
  onNote: (note, vel, on) => console.log(on ? 'on' : 'off', piano.noteName(note), vel.toFixed(2)),
});
piano.press(64, 0.5);     // on E4 0.50
piano.release(64);        // off E4 0.00`,
        caption: { en: 'A one-octave piano from middle C appears on the page. Click its keys and the console logs each note by name.', zh: '頁面上出現一架從中央 C 開始、一個八度的鋼琴。點它的琴鍵，console 就用音名印出每個音。' },
      },
      {
        code: `import { KeysPiano } from '@openav/keys';

const piano = new KeysPiano(document.getElementById('app'), {
  fill: true,                                     // as wide as the container
  onNote: (note, vel, on) => { if (on) console.log('note', note); },
});
piano.captureEnabled = true;                      // the computer keyboard plays
window.addEventListener('keydown', (e) => { if (piano.handleKeyDown(e)) e.preventDefault(); });
window.addEventListener('keyup', (e) => piano.handleKeyUp(e));
window.addEventListener('blur', () => piano.releaseAll());`,
        caption: { en: 'Click the page, then press A, S, D, F… to play from C3, Z and X to change octave. The letter keys no longer reach the rest of the page.', zh: '點一下頁面，然後按 A、S、D、F…從 C3 開始彈，用 Z 和 X 換八度。字母鍵不會再傳到頁面的其他地方。' },
      },
    ],
    related: ['mountKeys', 'SimPlayer', 'PIANO_KEYMAP', 'notePressed', 'noteName'],
    keywords: {
      en: ['piano', 'keyboard', 'on-screen', 'keys', 'qwerty', 'press', 'release', 'glissando', 'touch', 'virtual piano'],
      zh: ['鋼琴', '鍵盤', '螢幕鋼琴', '琴鍵', '電腦鍵盤', '按下', '放開', '滑音', '觸控'],
    },
  },

  SimPlayer: {
    group: 'keys',
    summary: {
      en: 'A hands-free performer: it presses and releases notes on its own, in a scale, so a demo can play itself.',
      zh: '一個不用手的演奏者：它自己在音階裡按下和放開音符，讓示範可以自己演奏。',
    },
    params: [
      { name: 'press', type: 'Function', optional: false, en: '`press(note, vel01)`: called when a note starts, with its MIDI number and a velocity between 0.45 and 0.85. Usually the `press` of a [`KeysPiano`](#KeysPiano), so the keys light up.', zh: '`press(note, vel01)`：一個音開始時呼叫，帶著 MIDI 號碼和 0.45 到 0.85 之間的力道。通常是 [`KeysPiano`](#KeysPiano) 的 `press`，這樣琴鍵會亮。' },
      { name: 'release', type: 'Function', optional: false, en: '`release(note)`: called when the note ends.', zh: '`release(note)`：這個音結束時呼叫。' },
      { name: 'base', type: 'Number', optional: true, default: '60', en: 'The MIDI note the scale starts on.', zh: '音階從哪個 MIDI 音符開始。' },
      { name: 'scale', type: 'Number[]', optional: true, default: '[0, 2, 4, 7, 9]', en: 'The notes it may play, as semitones above `base`. The default is a pentatonic scale, which sounds fine whatever happens.', zh: '它可以彈的音，用比 `base` 高幾個半音來表示。預設是五聲音階，怎麼彈都不會難聽。' },
      { name: 'density', type: 'Number', optional: true, default: '1', en: 'How busy it is. The gaps between notes are divided by it, so 2 plays about twice as often.', zh: '多忙。音和音之間的間隔會除以它，所以 2 大約是兩倍密。' },
    ],
    description: [
      {
        en: "It plays like someone noodling. Every gesture it picks at random: mostly a step up or down the scale, sometimes a leap, now and then a triad stacked in the scale, and real rests. Notes last 0.18 to 0.68 seconds (a triad twice as long), the next gesture comes 0.22 to 0.77 seconds later (a rest lasts 0.6 to 2 seconds), all at the default `density` of 1, and the notes are kept between 36 and 96. Because it presses and releases through your own two functions, whatever listens downstream cannot tell it from a person.",
        zh: "它彈起來像有人隨手彈。每個動作都是隨機挑的：大多是在音階上往上或往下一步，有時跳一個音程，偶爾彈一個疊在音階上的三和弦，也有真正的休止。每個音持續 0.18 到 0.68 秒（三和弦長兩倍），下一個動作在 0.22 到 0.77 秒之後（休止 0.6 到 2 秒），這些都是 `density` 為預設的 1 時的數字，音符被限制在 36 到 96。因為它是透過你的兩個函式按下和放開，下游的東西分不出它跟真人的差別。",
      },
      {
        en: "It starts off. Call `toggle(true)` and then `update(dt)` once per frame with the seconds since the last frame; it does nothing while it is off. `toggle(false)` releases every note it is holding, so none sticks. The notes are random (it uses `Math.random`, there is no seed).",
        zh: "它一開始是關的。呼叫 `toggle(true)`，然後每個畫面用距離上一個畫面過了幾秒呼叫 `update(dt)`。關著的時候它什麼都不做。`toggle(false)` 會放開它按著的所有音，不會有音卡住。音是隨機的（用的是 `Math.random`，沒有 seed）。",
      },
    ],
    members: {
      toggle: {
        en: 'Turns the performer on or off; with no argument it flips. Returns the new state. Turning it off releases every note it holds.',
        zh: '開或關演奏者。不給參數就是反過來。回傳新的狀態。關掉的時候會放開它按著的所有音。',
      },
      update: {
        en: 'Advance by `dt` seconds: release the notes that are due and, when it is time, start the next gesture. Call it every frame. Does nothing while the performer is off.',
        zh: '前進 `dt` 秒：放開該結束的音，時間到了就開始下一個動作。每個畫面都呼叫。演奏者關著的時候什麼都不做。',
      },
    },
    examples: [
      {
        code: `import { SimPlayer } from '@openav/keys';

const played = [];
const sim = new SimPlayer({
  press: (note, vel) => played.push(note),
  release: () => {},
  base: 60, density: 2,
});
sim.toggle(true);
for (let i = 0; i < 600; i++) sim.update(1 / 60);   // ten seconds, in frames
console.log(played.length > 5, Math.min(...played) >= 36, Math.max(...played) <= 96);   // true true true
sim.toggle(false);`,
        caption: { en: 'Runs the performer for ten simulated seconds without any sound or screen and logs that it played a good number of notes, all inside 36 to 96.', zh: '不用聲音也不用畫面，讓演奏者跑十秒的模擬時間，印出它彈了不少音，而且全都在 36 到 96 之間。' },
      },
      {
        code: `import { KeysPiano, SimPlayer } from '@openav/keys';

const piano = new KeysPiano(document.getElementById('app'), { base: 48, octaves: 2 });
const sim = new SimPlayer({
  press: (n, v) => piano.press(n, v),        // through the piano: the keys light up
  release: (n) => piano.release(n),
  base: 60, scale: [0, 2, 3, 5, 7, 8, 10],   // a natural minor scale
});
sim.toggle(true);
const t0 = performance.now();
let last = t0;
(function frame(now) {
  sim.update((now - last) / 1000); last = now;
  if (now - t0 < 4000) requestAnimationFrame(frame); else sim.toggle(false);
})(t0);`,
        caption: { en: 'A piano plays itself in a minor scale for four seconds: the keys light up as the notes go down and up.', zh: '一架鋼琴在小調音階裡自己彈四秒：音符按下和放開的時候，琴鍵跟著亮和暗。' },
      },
    ],
    related: ['KeysPiano', 'mountKeys'],
    keywords: {
      en: ['simulate', 'simulated performer', 'auto play', 'demo', 'noodle', 'random notes', 'bot', 'generative'],
      zh: ['模擬演奏', '自動演奏', '示範', '隨手彈', '隨機音符', '演奏者'],
    },
  },

  PIANO_KEYMAP: {
    group: 'keys',
    summary: {
      en: 'Which computer-keyboard letter plays which note: `a` is the base note, `w` a semitone higher, `s` two.',
      zh: '電腦鍵盤的哪個字母彈哪個音：`a` 是最低音，`w` 高一個半音，`s` 高兩個半音。',
    },
    value: {
      type: 'Object',
      en: '`{ a: 0, w: 1, s: 2, e: 3, d: 4, f: 5, t: 6, g: 7, y: 8, h: 9, u: 10, j: 11, k: 12, o: 13, l: 14, p: 15, \';\': 16 }`: key to semitones above the piano\'s `base`.',
      zh: '`{ a: 0, w: 1, s: 2, e: 3, d: 4, f: 5, t: 6, g: 7, y: 8, h: 9, u: 10, j: 11, k: 12, o: 13, l: 14, p: 15, \';\': 16 }`：鍵對應到比鋼琴的 `base` 高幾個半音。',
    },
    description: [
      {
        en: "The layout the music software calls the DAW standard: the `A S D F G H J K L ;` row is the white keys and the `W E T Y U O P` row above it is the black keys, placed where they sit on a piano. With a piano that starts on C (`base` 48, 60…) it reads C, C♯, D, D♯, E, F, F♯, G, G♯, A, A♯, B, C, C♯, D, D♯, E. The keys are lowercase letters; [`KeysPiano.handleKeyDown(e)`](#KeysPiano) lowercases the key first. `Z` and `X` are not in the map: they move the octave.",
        zh: "這是音樂軟體稱為 DAW 標準的排法：`A S D F G H J K L ;` 這一排是白鍵，上面一排 `W E T Y U O P` 是黑鍵，位置就跟鋼琴上一樣。鋼琴從 C 開始（`base` 是 48、60…）的話，從左到右是 C、C♯、D、D♯、E、F、F♯、G、G♯、A、A♯、B、C、C♯、D、D♯、E。鍵是小寫字母。[`KeysPiano.handleKeyDown(e)`](#KeysPiano) 會先把鍵轉成小寫。`Z` 和 `X` 不在這張表裡：它們是換八度。",
      },
    ],
    examples: [
      {
        code: `import { PIANO_KEYMAP } from '@openav/keys';

const base = 60;                                   // middle C
const noteFor = (key) => (key in PIANO_KEYMAP ? base + PIANO_KEYMAP[key] : null);
console.log(noteFor('a'), noteFor('w'), noteFor('k'), noteFor('q'));   // 60 61 72 null
console.log(Object.keys(PIANO_KEYMAP).join(''));                        // awsedftgyhujkolp;`,
        caption: { en: 'Looks up the note of a few letters on a piano that starts on middle C: `k` is the C an octave up, and `q` plays nothing.', zh: '在從中央 C 開始的鋼琴上查幾個字母的音：`k` 是高八度的 C，`q` 不發音。' },
      },
    ],
    related: ['KeysPiano', 'mountKeys'],
    keywords: {
      en: ['keymap', 'qwerty', 'computer keyboard', 'letters', 'mapping', 'daw', 'a s d f'],
      zh: ['鍵盤對應', '電腦鍵盤', '字母', '對應表', 'qwerty', '彈琴'],
    },
  },
};
