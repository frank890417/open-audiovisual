// @openav/console reference: the director's desk, a side panel built around the objects a show runs on.
// Read by tools/build-reference.mjs (see AGENTS.md, "Documenting a public name").

export default {
  mountConsole: {
    group: 'backstage',
    summary: {
      en: 'Mounts the director\'s desk into an element: transport and scrubber, layers overview, inputs, mapping, param sliders, signal meters and a fullscreen performance mode.',
      zh: '把導演控台掛進一個元素：播放控制與 scrubber、圖層總覽、輸入、映射、參數推桿、訊號音量表，以及全螢幕的演出模式。',
    },
    params: [
      {
        name: 'root', type: 'HTMLElement',
        en: 'The element to build the desk in. It gets the class `oav-console`, and the desk\'s styles are added once to the head.',
        zh: '要在裡面建出控台的元素。它會得到 `oav-console` 這個 class，控台的樣式也會一次加進 `<head>`。',
      },
      {
        name: 'app', type: 'Object',
        en: 'The objects the desk reads: `{ timeline, params, mapper, signals, stage }` are needed, and `midi`, `controllers`, `keys`, `sound`, `audio`, `hands`, `pose`, `leap`, `chord`, `remote`, `drums`, `loop`, `osc`, `score`, `director` are optional. A missing part hides its section. [`createShow()`](#createShow) passes `show.app`.',
        zh: '控台要讀取的物件：`{ timeline, params, mapper, signals, stage }` 一定要有，`midi`、`controllers`、`keys`、`sound`、`audio`、`hands`、`pose`、`leap`、`chord`、`remote`、`drums`、`loop`、`osc`、`score`、`director` 是選填的。缺少的部分，它的區塊就會隱藏。[`createShow()`](#createShow) 傳的是 `show.app`。',
      },
      {
        name: 'opts', type: 'Object', optional: true, default: '{}',
        en: '`{ layers: false }` and `{ signals: false }` leave out the Layers and Signals panels; `{ learnOrder: [\'hue\', \'size\'] }` sets the order of the **🎛 map knobs in order** wizard (default: the params as declared, skipping hidden ones and any with `wizard: false`). `{ keys: { reset: \'F6\', perf: \'F7\' } }` moves keyboard shortcuts (see [`resolveKeys()`](#resolveKeys)) and `{ keys: false }` switches them all off. `{ curves: false }` leaves out the Curves panel and `{ curves: { open: true } }` starts it open.',
        zh: '`{ layers: false }` 和 `{ signals: false }` 會省略 Layers 和 Signals 面板。`{ learnOrder: [\'hue\', \'size\'] }` 設定 **🎛 map knobs in order** 精靈的順序（預設是依宣告順序的參數，略過 hidden 的和 `wizard: false` 的）。`{ keys: { reset: \'F6\', perf: \'F7\' } }` 可以挪動鍵盤快速鍵（見 [`resolveKeys()`](#resolveKeys)），`{ keys: false }` 把它們全部關掉。`{ curves: false }` 會省略 Curves 面板，`{ curves: { open: true } }` 讓它一開始就是打開的。',
      },
    ],
    returns: {
      type: 'Object',
      en: '`{ render(state), perf, director, curves, wizard, keys, dispose() }`: `render` redraws the desk, `perf` is the performance mode (`toggle()`, `active`, `render()`), `director` the Director panel (or `null`), `curves` the Curves panel (`toggle()`, `open`, `info()`; `null` with `{ curves: false }`), `wizard` the knob-mapping wizard, `keys` the shortcuts in force (what [`resolveKeys()`](#resolveKeys) returned), and `dispose()` removes the keyboard handler and empties the element.',
      zh: '`{ render(state), perf, director, curves, wizard, keys, dispose() }`：`render` 重畫控台，`perf` 是演出模式（`toggle()`、`active`、`render()`），`director` 是 Director 面板（或 `null`），`curves` 是 Curves 面板（`toggle()`、`open`、`info()`，給了 `{ curves: false }` 就是 `null`），`wizard` 是旋鈕映射精靈，`keys` 是目前生效的快速鍵（也就是 [`resolveKeys()`](#resolveKeys) 的回傳值），`dispose()` 會移除鍵盤處理並清空這個元素。',
    },
    description: [
      {
        en: 'The desk reads the same objects the loop runs and owns nothing. From top to bottom it has the transport (play, previous and next scene, reset, the clock) and a scrubber with a block for every scene (with a tick for every cue, and a dashed end for a hold, when the scenes have them); with a score, the Director panel; the **Layers** overview (L1 input, L2 mapping, L3 world, L4 output); **L1 · Input** (MIDI devices, 🎤 mic, 🖐 hands, 🕺 body, leap); **L2 · Mapping** (the routes with a mute box and ✕, **🎛 map knobs in order**, ⬇ export, ⬆ import, clear); **L3 · Params** (a slider per param with ✕ to clear the override and a *learn* chip; a yellow label means overridden); **L4 · sound** when there is a sound engine; and the **Signals** meters with the MIDI log. Every panel header collapses its section.',
        zh: '控台讀的是迴圈實際在跑的那些物件，自己什麼都不擁有。由上到下依序是：播放控制（播放、上一個與下一個場景、重設、時鐘）和一條 scrubber（每個場景一個區塊，場景有 cue 的話每個 cue 一個刻度、有 hold 的話尾端是虛線）。有總譜的話，Director 面板。**Layers** 總覽（L1 輸入、L2 映射、L3 世界、L4 輸出）。**L1 · Input**（MIDI 裝置、🎤 mic、🖐 hands、🕺 body、leap）。**L2 · Mapping**（路由清單，附靜音框與 ✕，還有 **🎛 map knobs in order**、⬇ export、⬆ import、clear）。**L3 · Params**（每個參數一支推桿，附清除覆寫的 ✕ 和 *learn* 標籤，黃色標籤代表被覆寫）。有聲音引擎的話是 **L4 · sound**。最後是 **Signals** 音量表和 MIDI 紀錄。每個面板的標題都可以收合它的區塊。',
      },
      {
        en: 'Keyboard, on the whole window: <kbd>Space</kbd> play and pause (at a hold: release it), <kbd>→</kbd> and <kbd>←</kbd> next and previous scene (→ at a hold releases it), <kbd>R</kbd> back to the start, <kbd>T</kbd> performance mode (a fullscreen teleprompter for the performer: scene title, note and acts, the clock, the next scene, a HOLD banner), <kbd>F</kbd> fullscreen, <kbd>M</kbd> the on-screen MIDI controller panel (when the show has one), <kbd>C</kbd> opens and closes the Curves panel, <kbd>Esc</kbd> stops the mapping wizard or leaves keyboard-piano capture. Typing in an input field, a held key and any combination with ⌘, Ctrl or Alt are ignored. While the on-screen piano captures the keyboard the **letters** (R, T, F, M, C) belong to the piano; Space, the arrows and Esc always work. These are the defaults ([`DEFAULT_KEYS`](#DEFAULT_KEYS)): `opts.keys` moves each action to another key.',
        zh: '鍵盤，作用在整個視窗：<kbd>Space</kbd> 播放與暫停（在 hold 上則是放行）、<kbd>→</kbd> 和 <kbd>←</kbd> 下一個與上一個場景（在 hold 上，→ 是放行）、<kbd>R</kbd> 回到起點、<kbd>T</kbd> 演出模式（給表演者看的全螢幕提詞器：場景標題、備註與 acts、時鐘、下一個場景、HOLD 橫幅）、<kbd>F</kbd> 全螢幕、<kbd>M</kbd> 螢幕上的 MIDI 控制器面板（演出有的話）、<kbd>C</kbd> 打開與收起 Curves 面板、<kbd>Esc</kbd> 停止映射精靈，或離開鍵盤鋼琴的捕捉。在輸入欄位裡打字、按住不放的鍵，以及任何帶 ⌘、Ctrl 或 Alt 的組合都會被忽略。螢幕鋼琴捕捉鍵盤的時候，**字母鍵**（R、T、F、M、C）屬於鋼琴，Space、方向鍵和 Esc 則永遠有效。這些是預設值（[`DEFAULT_KEYS`](#DEFAULT_KEYS)）：`opts.keys` 可以把每個動作挪到別的鍵。',
      },
    ],
    needs: {
      en: 'Call `desk.render(state)` every frame after `stage.frame()` (a show\'s loop does): the desk only redraws when you tell it to. `state` is the resolved params, `params.resolve(timeline.state())`.',
      zh: '每個畫面在 `stage.frame()` 之後呼叫 `desk.render(state)`（演出的迴圈會做）：控台只在你叫它的時候才重畫。`state` 是解析後的參數，也就是 `params.resolve(timeline.state())`。',
    },
    notes: [
      {
        en: 'The **Curves** panel draws the automation of every param across the whole show, with the segments, the playhead and the overrides. It starts collapsed and costs nothing until it is opened; a show where no param has automation has no such panel.',
        zh: '**Curves** 面板把每個參數在整場演出裡的自動化曲線畫出來，連同段落、播放頭和覆寫。它一開始是收起來的，打開之前不花任何成本。沒有任何參數有自動化曲線的演出，就沒有這個面板。',
      },
      {
        en: 'The keyboard handler is on `window`, so two desks on one page both answer the keys. `dispose()` removes it. The performance mode\'s teleprompter is appended to `document.body`, not to `root`.',
        zh: '鍵盤處理是掛在 `window` 上的，所以同一頁有兩個控台的話，兩個都會回應按鍵。`dispose()` 會移除它。演出模式的提詞器是加在 `document.body` 底下，不是 `root`。',
      },
      {
        en: 'Touch a slider (or a mapped control) and that param leaves the timeline\'s hands until you press its ✕: the score gives way when a person grabs a control.',
        zh: '碰一下推桿（或被映射的控制），那個參數就離開時間軸的掌控，直到你按下它的 ✕：有人抓住控制項的時候，樂譜讓路。',
      },
    ],
    examples: [
      {
        code: `import { Signals, Params, Loop } from '@openav/core';
import { Mapper } from '@openav/mapping';
import { Timeline } from '@openav/timeline';
import { Stage } from '@openav/stage';
import { mountConsole } from '@openav/console';

const signals = new Signals();
const params = new Params([{ key: 'hue', label: 'Hue', min: 0, max: 360, def: 200 }, { key: 'size', min: 0, max: 1, def: 0.3 }]);
const mapper = new Mapper({ signals, params });
const timeline = new Timeline({ params, total: 60, automation: { hue: [[0, 200], [60, 320]] },
  scenes: [{ id: 'dawn', t: 0, title: 'Dawn' }, { id: 'noon', t: 30, title: 'Noon' }] });
const stage = new Stage({ container: document.createElement('div'), params, signals });

const desk = mountConsole(document.getElementById('app'), { timeline, params, mapper, signals, stage });
timeline.play();
new Loop((dt) => {
  timeline.advance(dt);
  desk.render(params.resolve(timeline.state()));      // once per frame
}).start();`,
        caption: { en: 'The desk appears in the page: a transport with a clock running, a scrubber with two scene blocks (Dawn, Noon), the layers overview and a slider each for Hue and Size. The Hue slider follows the timeline until you drag it.', zh: '控台出現在頁面上：一個時鐘在走的播放控制、一條有兩個場景區塊（Dawn、Noon）的 scrubber、圖層總覽，以及 Hue 和 Size 各一支推桿。Hue 推桿會跟著時間軸走，直到你去拖它。' },
      },
      {
        code: `import { Signals, Params } from '@openav/core';
import { Mapper } from '@openav/mapping';
import { Timeline } from '@openav/timeline';
import { Stage } from '@openav/stage';
import { mountConsole } from '@openav/console';

const signals = new Signals();
const params = new Params([{ key: 'hue', min: 0, max: 360, def: 200 }]);
const timeline = new Timeline({ params, total: 30 });
const app = { timeline, params, signals, mapper: new Mapper({ signals, params }), stage: new Stage({ container: document.createElement('div'), params, signals }) };

const desk = mountConsole(document.getElementById('app'), app, { layers: false, signals: false });
desk.render(params.resolve(timeline.state()));
console.log(desk.perf.active, desk.perf.toggle(), desk.perf.active);    // false true true: the T key, in code
desk.perf.toggle();                                                     // back to the desk
desk.dispose();                                                         // removes the key handler and empties the element
console.log(document.getElementById('app').children.length);            // 0`,
        caption: { en: 'A desk without the Layers and Signals panels: the console prints `false true true` as performance mode is switched on from code, then `0` after `dispose()` has emptied the element.', zh: '一個沒有 Layers 和 Signals 面板的控台：用程式打開演出模式，主控台印出 `false true true`，`dispose()` 把元素清空之後印出 `0`。' },
      },
    ],
    related: ['createShow', 'Timeline', 'Mapper', 'LearnWizard', 'Director', 'Params', 'MonitorFeed', 'DEFAULT_KEYS', 'resolveKeys', 'keyLabel'],
    keywords: {
      en: ['console', 'desk', 'director desk', 'control panel', 'sliders', 'transport', 'scrubber', 'performance mode', 'teleprompter', 'keyboard shortcuts', 'ui', 'learn'],
      zh: ['控台', '導演控台', '控制面板', '推桿', '播放控制', 'scrubber', '演出模式', '提詞器', '鍵盤快速鍵', '介面', 'learn'],
    },
  },

  DEFAULT_KEYS: {
    group: 'backstage',
    summary: {
      en: 'The console\'s keyboard shortcuts unless a show moves them: a frozen object from action name to key, `{ play: \'Space\', next: \'ArrowRight\', … }`.',
      zh: '演出沒有挪動的時候，控台用的鍵盤快速鍵：一個凍結的物件，從動作名稱對到按鍵，`{ play: \'Space\', next: \'ArrowRight\', … }`。',
    },
    value: {
      type: 'Object',
      en: '`{ play: \'Space\', next: \'ArrowRight\', prev: \'ArrowLeft\', reset: \'R\', perf: \'T\', fullscreen: \'F\', midi: \'M\', cancel: \'Escape\', curves: \'C\' }`. Frozen: it cannot be changed.',
      zh: '`{ play: \'Space\', next: \'ArrowRight\', prev: \'ArrowLeft\', reset: \'R\', perf: \'T\', fullscreen: \'F\', midi: \'M\', cancel: \'Escape\', curves: \'C\' }`。它是凍結的，不能改。',
    },
    description: [
      {
        en: 'What each action does:\n\n```text\nplay        Space        play and pause (at a hold: release it)\nnext        ArrowRight   next scene (at a hold: release it)\nprev        ArrowLeft    previous scene\nreset       R            back to the start\nperf        T            performance mode\nfullscreen  F            fullscreen\nmidi        M            the on-screen MIDI controller panel\ncancel      Escape       stop the mapping wizard, or leave keyboard-piano capture\ncurves      C            open and close the Curves panel\n```',
        zh: '每個動作做什麼：\n\n```text\nplay        Space        play and pause (at a hold: release it)\nnext        ArrowRight   next scene (at a hold: release it)\nprev        ArrowLeft    previous scene\nreset       R            back to the start\nperf        T            performance mode\nfullscreen  F            fullscreen\nmidi        M            the on-screen MIDI controller panel\ncancel      Escape       stop the mapping wizard, or leave keyboard-piano capture\ncurves      C            open and close the Curves panel\n```',
      },
      {
        en: 'They are only the defaults. A show that plays the computer keyboard as a piano wants its letters back, so [`mountConsole(el, app, { keys })`](#mountConsole) and `createShow({ console: { keys } })` lay your own map over this one: see [`resolveKeys()`](#resolveKeys).',
        zh: '它們只是預設值。把電腦鍵盤當鋼琴彈的演出會想把字母鍵要回來，所以 [`mountConsole(el, app, { keys })`](#mountConsole) 和 `createShow({ console: { keys } })` 會把你自己的對照表疊在這一份上面：見 [`resolveKeys()`](#resolveKeys)。',
      },
    ],
    examples: [
      {
        code: `import { DEFAULT_KEYS } from '@openav/console';

console.log(DEFAULT_KEYS.play, DEFAULT_KEYS.reset, DEFAULT_KEYS.curves);
console.log(Object.isFrozen(DEFAULT_KEYS));`,
        caption: { en: 'The console prints `Space R C`, then `true`.', zh: '主控台印出 `Space R C`，接著是 `true`。' },
      },
    ],
    related: ['KEY_ACTIONS', 'resolveKeys', 'keyLabel', 'mountConsole', 'createShow'],
    keywords: {
      en: ['keyboard shortcuts', 'hotkeys', 'default keys', 'space', 'key bindings'],
      zh: ['鍵盤快速鍵', '快捷鍵', '預設按鍵', '空白鍵', '按鍵對照'],
    },
  },

  KEY_ACTIONS: {
    group: 'backstage',
    summary: {
      en: 'The names of the actions a console key can do, in order: `play`, `next`, `prev`, `reset`, `perf`, `fullscreen`, `midi`, `cancel`, `curves`.',
      zh: '控台的按鍵可以做的動作名稱，依序是：`play`、`next`、`prev`、`reset`、`perf`、`fullscreen`、`midi`、`cancel`、`curves`。',
    },
    value: {
      type: 'Array',
      en: '`[\'play\', \'next\', \'prev\', \'reset\', \'perf\', \'fullscreen\', \'midi\', \'cancel\', \'curves\']`: the keys of [`DEFAULT_KEYS`](#DEFAULT_KEYS).',
      zh: '`[\'play\', \'next\', \'prev\', \'reset\', \'perf\', \'fullscreen\', \'midi\', \'cancel\', \'curves\']`：也就是 [`DEFAULT_KEYS`](#DEFAULT_KEYS) 的鍵。',
    },
    description: [
      {
        en: 'These are the only names a `keys` map may use: [`resolveKeys()`](#resolveKeys) throws for any other. The order matters once: when two actions are given the same key, the one that comes first here gets it.',
        zh: '`keys` 對照表只能用這些名字：其他名字會讓 [`resolveKeys()`](#resolveKeys) 丟出錯誤。順序只在一個地方有影響：兩個動作被設成同一個鍵的時候，在這裡排前面的那個拿到它。',
      },
    ],
    examples: [
      {
        code: `import { KEY_ACTIONS } from '@openav/console';

console.log(KEY_ACTIONS.join(' '));`,
        caption: { en: 'The console prints `play next prev reset perf fullscreen midi cancel curves`.', zh: '主控台印出 `play next prev reset perf fullscreen midi cancel curves`。' },
      },
    ],
    related: ['DEFAULT_KEYS', 'resolveKeys', 'keyLabel', 'mountConsole'],
    keywords: {
      en: ['key actions', 'shortcut names', 'actions', 'keyboard'],
      zh: ['按鍵動作', '快速鍵名稱', '動作', '鍵盤'],
    },
  },

  resolveKeys: {
    group: 'backstage',
    summary: {
      en: 'Lays a show\'s `keys` map over the default shortcuts and parses every key: the map the console runs on, from action name to a list of parsed keys.',
      zh: '把演出的 `keys` 對照表疊在預設快速鍵上面，並把每個鍵解析好：這就是控台實際在用的對照表，從動作名稱對到一串解析過的鍵。',
    },
    params: [
      {
        name: 'keys', type: 'Object | false | null', optional: true,
        en: '`{ action: \'key\' }`, `{ action: [\'key\', \'key\'] }` or `{ action: false }`, laid over [`DEFAULT_KEYS`](#DEFAULT_KEYS). `false`, `null` or `\'\'` switches that action off. Nothing (`undefined` or `null`) gives the defaults; `false` instead of the object switches every shortcut off.',
        zh: '`{ 動作: \'鍵\' }`、`{ 動作: [\'鍵\', \'鍵\'] }` 或 `{ 動作: false }`，疊在 [`DEFAULT_KEYS`](#DEFAULT_KEYS) 上面。`false`、`null` 或 `\'\'` 會關掉那個動作。什麼都不給（`undefined` 或 `null`）就是預設值。整個參數給 `false` 則關掉所有快速鍵。',
      },
    ],
    returns: {
      type: 'Object',
      en: 'A frozen object with one entry per action of [`KEY_ACTIONS`](#KEY_ACTIONS): a frozen array of `{ spec, key, shift, ctrl, alt, meta, typing, label }`, empty for an action that is switched off. `label` is what a hint prints (`→` for `ArrowRight`, `Esc` for `Escape`); `typing` is true for a key the on-screen piano takes while it captures the keyboard.',
      zh: '一個凍結的物件，[`KEY_ACTIONS`](#KEY_ACTIONS) 的每個動作各有一項：一個凍結的陣列，內容是 `{ spec, key, shift, ctrl, alt, meta, typing, label }`，被關掉的動作是空陣列。`label` 是提示上要印的字（`ArrowRight` 印 `→`，`Escape` 印 `Esc`）。`typing` 為 true 表示螢幕鋼琴捕捉鍵盤的時候，這個鍵會被鋼琴拿走。',
    },
    description: [
      {
        en: 'A key is a string, and it matches either the character typed or the physical key. `\'r\'` or `\'R\'` is the character (Shift does not matter unless the spec says `Shift+`). `\'KeyR\'` is the physical R key whatever the layout types there. `\'Space\'`, `\'F6\'`, `\'Backquote\'`, `\'ArrowUp\'`, `\'Enter\'` are `KeyboardEvent.code` or key names, in any case. Modifiers go in front: `\'Shift+T\'`, `\'Ctrl+R\'`, `\'Alt+…\'`, `\'Meta+…\'` (also `Control`, `Option`, `Cmd`, `Command`). When the spec has no Ctrl, Alt or Meta, those keys must not be held, so ⌘R and Ctrl+F stay with the browser.',
        zh: '鍵寫成字串，可以比對打出來的字元，也可以比對實體按鍵。`\'r\'` 或 `\'R\'` 是字元（有沒有按 Shift 都算，除非寫法裡有 `Shift+`）。`\'KeyR\'` 是實體的 R 鍵，不管鍵盤配置在那個位置打出什麼字。`\'Space\'`、`\'F6\'`、`\'Backquote\'`、`\'ArrowUp\'`、`\'Enter\'` 是 `KeyboardEvent.code` 或按鍵名稱，大小寫不拘。修飾鍵寫在前面：`\'Shift+T\'`、`\'Ctrl+R\'`、`\'Alt+…\'`、`\'Meta+…\'`（也可以寫 `Control`、`Option`、`Cmd`、`Command`）。寫法裡沒有 Ctrl、Alt、Meta 的時候，這三個鍵不能被按著，所以 ⌘R 和 Ctrl+F 仍然歸瀏覽器。',
      },
      {
        en: 'It throws an `Error` for an action name that is not in `KEY_ACTIONS`, for a `keys` that is not an object, and for a key that cannot be parsed (an empty string inside a list, an unknown modifier). [`mountConsole()`](#mountConsole) and [`createShow()`](#createShow) call it first, so a typo stops the show before anything is mounted.',
        zh: '動作名稱不在 `KEY_ACTIONS` 裡、`keys` 不是物件、鍵的寫法解析不了（清單裡有空字串、不認得的修飾鍵），它都會丟出 `Error`。[`mountConsole()`](#mountConsole) 和 [`createShow()`](#createShow) 一開始就會呼叫它，所以打錯字會在任何東西掛上去之前就把演出擋下來。',
      },
    ],
    notes: [
      {
        en: 'While the on-screen piano captures the keyboard, a letter key (a to z, and `;`) without Ctrl, Alt or Meta does nothing wherever you put an action, `Shift+T` included. Keys such as `F6` or `Backquote` keep working.',
        zh: '螢幕鋼琴捕捉鍵盤的時候，不帶 Ctrl、Alt、Meta 的字母鍵（a 到 z，以及 `;`）不管你把哪個動作放上去都不作用，`Shift+T` 也一樣。`F6`、`Backquote` 這類鍵則照常有效。',
      },
    ],
    examples: [
      {
        code: `import { resolveKeys, keyLabel } from '@openav/console';

// the piano owns the letters: move reset and perf off them, switch the MIDI panel key off
const keys = resolveKeys({ reset: 'F6', perf: ['F7', 'Shift+T'], midi: false });
console.log(keyLabel(keys, 'play'), keyLabel(keys, 'reset'), keyLabel(keys, 'perf'));
console.log(keys.perf.map((k) => k.label).join(' or '), keys.midi.length);

try { resolveKeys({ rewind: 'B' }); } catch (e) { console.log(e.message); }`,
        caption: { en: 'The console prints `Space F6 F7`, then `F7 or Shift+T 0`, then the error for a name that is not an action: `unknown key action "rewind" (play, next, prev, reset, perf, fullscreen, midi, cancel, curves)`.', zh: '主控台印出 `Space F6 F7`，接著是 `F7 or Shift+T 0`，最後是用了不是動作的名字時的錯誤：`unknown key action "rewind" (play, next, prev, reset, perf, fullscreen, midi, cancel, curves)`。' },
      },
    ],
    related: ['DEFAULT_KEYS', 'KEY_ACTIONS', 'keyLabel', 'mountConsole', 'createShow'],
    keywords: {
      en: ['keys', 'keyboard shortcuts', 'rebind', 'remap keys', 'hotkeys', 'key bindings', 'piano'],
      zh: ['按鍵', '鍵盤快速鍵', '改鍵', '挪動快速鍵', '快捷鍵', '按鍵對照', '鋼琴'],
    },
  },

  keyLabel: {
    group: 'backstage',
    summary: {
      en: 'What to print in a hint for an action: the label of its first key (`Space`, `R`, `→`, `Esc`), or an empty string when the action is switched off.',
      zh: '提示上要替某個動作印什麼：它第一個鍵的標籤（`Space`、`R`、`→`、`Esc`），動作被關掉的話是空字串。',
    },
    params: [
      {
        name: 'bindings', type: 'Object',
        en: 'What [`resolveKeys()`](#resolveKeys) returned, or `desk.keys` of a mounted console.',
        zh: '[`resolveKeys()`](#resolveKeys) 的回傳值，或已掛上的控台的 `desk.keys`。',
      },
      {
        name: 'action', type: 'String',
        en: 'An action name from [`KEY_ACTIONS`](#KEY_ACTIONS).',
        zh: '[`KEY_ACTIONS`](#KEY_ACTIONS) 裡的一個動作名稱。',
      },
    ],
    returns: {
      type: 'String',
      en: 'The label of the action\'s first key, as it was written in the spec, with `ArrowRight`, `ArrowLeft`, `ArrowUp`, `ArrowDown` and `Escape` shown as `→`, `←`, `↑`, `↓` and `Esc`. `\'\'` when the action has no key or the name is unknown.',
      zh: '這個動作第一個鍵的標籤，照你寫的樣子，其中 `ArrowRight`、`ArrowLeft`、`ArrowUp`、`ArrowDown` 和 `Escape` 會顯示成 `→`、`←`、`↑`、`↓` 和 `Esc`。動作沒有鍵，或名稱不認得，就是 `\'\'`。',
    },
    description: [
      {
        en: 'A show that moves the shortcuts should not keep saying "press R". Build the hint from the keys in force: `keyLabel(show.console.keys, \'reset\')` gives `F6` once the show has moved reset there. The console\'s own buttons and the performance mode do the same.',
        zh: '挪動了快速鍵的演出，不該還在說「按 R」。提示請從目前生效的按鍵組出來：演出把 reset 挪到 F6 之後，`keyLabel(show.console.keys, \'reset\')` 會回答 `F6`。控台自己的按鈕和演出模式也是這樣做的。',
      },
    ],
    examples: [
      {
        code: `import { resolveKeys, keyLabel } from '@openav/console';

const keys = resolveKeys({ reset: 'F6', midi: false });
console.log(keyLabel(keys, 'next'), keyLabel(keys, 'cancel'), keyLabel(keys, 'reset'));
console.log(JSON.stringify(keyLabel(keys, 'midi')));     // switched off
console.log('Press ' + keyLabel(keys, 'play') + ' to start');`,
        caption: { en: 'The console prints `→ Esc F6`, then `""` for the action that is switched off, then `Press Space to start`.', zh: '主控台印出 `→ Esc F6`，被關掉的動作印出 `""`，最後是 `Press Space to start`。' },
      },
    ],
    related: ['resolveKeys', 'DEFAULT_KEYS', 'KEY_ACTIONS', 'mountConsole'],
    keywords: {
      en: ['key label', 'hint', 'shortcut label', 'keyboard', 'arrow'],
      zh: ['按鍵標籤', '提示', '快速鍵標籤', '鍵盤', '方向鍵'],
    },
  },
};
