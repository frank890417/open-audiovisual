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
        zh: '控台要讀取的物件：`{ timeline, params, mapper, signals, stage }` 是必要的，`midi`、`controllers`、`keys`、`sound`、`audio`、`hands`、`pose`、`leap`、`chord`、`remote`、`drums`、`loop`、`osc`、`score`、`director` 是選填的。缺少的部分，它的區塊就會隱藏。[`createShow()`](#createShow) 傳的是 `show.app`。',
      },
      {
        name: 'opts', type: 'Object', optional: true, default: '{}',
        en: '`{ layers: false }` and `{ signals: false }` leave out the Layers and Signals panels; `{ learnOrder: [\'hue\', \'size\'] }` sets the order of the **🎛 map knobs in order** wizard (default: the params as declared, skipping hidden ones and any with `wizard: false`).',
        zh: '`{ layers: false }` 和 `{ signals: false }` 會省略 Layers 和 Signals 面板。`{ learnOrder: [\'hue\', \'size\'] }` 設定 **🎛 map knobs in order** 精靈的順序（預設是依宣告順序的參數，略過 hidden 的和 `wizard: false` 的）。',
      },
    ],
    returns: {
      type: 'Object',
      en: '`{ render(state), perf, director, wizard, dispose() }`: `render` redraws the desk, `perf` is the performance mode (`toggle()`, `active`, `render()`), `director` the Director panel (or `null`), `wizard` the knob-mapping wizard, and `dispose()` removes the keyboard handler and empties the element.',
      zh: '`{ render(state), perf, director, wizard, dispose() }`：`render` 重畫控台，`perf` 是演出模式（`toggle()`、`active`、`render()`），`director` 是 Director 面板（或 `null`），`wizard` 是旋鈕映射精靈，`dispose()` 會移除鍵盤處理並清空這個元素。',
    },
    description: [
      {
        en: 'The desk reads the same objects the loop runs and owns nothing. From top to bottom it has the transport (play, previous and next scene, reset, the clock) and a scrubber with a block for every scene (with a tick for every cue, and a dashed end for a hold, when the scenes have them); with a score, the Director panel; the **Layers** overview (L1 input, L2 mapping, L3 world, L4 output); **L1 · Input** (MIDI devices, 🎤 mic, 🖐 hands, 🕺 body, leap); **L2 · Mapping** (the routes with a mute box and ✕, **🎛 map knobs in order**, ⬇ export, ⬆ import, clear); **L3 · Params** (a slider per param with ✕ to clear the override and a *learn* chip; a yellow label means overridden); **L4 · sound** when there is a sound engine; and the **Signals** meters with the MIDI log. Every panel header collapses its section.',
        zh: '控台讀的是迴圈實際在跑的那些物件，自己什麼都不擁有。由上到下依序是：播放控制（播放、上一個與下一個場景、重設、時鐘）和一條 scrubber（每個場景一個區塊，場景有 cue 的話每個 cue 一個刻度、有 hold 的話尾端是虛線）。有總譜的話，Director 面板。**Layers** 總覽（L1 輸入、L2 映射、L3 世界、L4 輸出）。**L1 · Input**（MIDI 裝置、🎤 mic、🖐 hands、🕺 body、leap）。**L2 · Mapping**（路由清單，附靜音框與 ✕，還有 **🎛 map knobs in order**、⬇ export、⬆ import、clear）。**L3 · Params**（每個參數一支推桿，附清除覆寫的 ✕ 和 *learn* 標籤，黃色標籤代表被覆寫）。有聲音引擎的話是 **L4 · sound**。最後是 **Signals** 音量表和 MIDI 紀錄。每個面板的標題都可以收合它的區塊。',
      },
      {
        en: 'Keyboard, on the whole window: <kbd>Space</kbd> play and pause (at a hold: release it), <kbd>→</kbd> and <kbd>←</kbd> next and previous scene (→ at a hold releases it), <kbd>R</kbd> back to the start, <kbd>T</kbd> performance mode (a fullscreen teleprompter for the performer: scene title, note and acts, the clock, the next scene, a HOLD banner), <kbd>F</kbd> fullscreen, <kbd>Esc</kbd> stops the mapping wizard or leaves keyboard-piano capture. Typing in an input field, a held key and any combination with ⌘, Ctrl or Alt are ignored. While the on-screen piano captures the keyboard the **letters** (R, T, F) belong to the piano; Space, the arrows and Esc always work.',
        zh: '鍵盤，作用在整個視窗：<kbd>Space</kbd> 播放與暫停（在 hold 上則是放行）、<kbd>→</kbd> 和 <kbd>←</kbd> 下一個與上一個場景（在 hold 上，→ 是放行）、<kbd>R</kbd> 回到起點、<kbd>T</kbd> 演出模式（給表演者看的全螢幕提詞器：場景標題、備註與 acts、時鐘、下一個場景、HOLD 橫幅）、<kbd>F</kbd> 全螢幕、<kbd>Esc</kbd> 停止映射精靈，或離開鍵盤鋼琴的捕捉。在輸入欄位裡打字、按住不放的鍵，以及任何帶 ⌘、Ctrl 或 Alt 的組合都會被忽略。螢幕鋼琴捕捉鍵盤的時候，**字母鍵**（R、T、F）屬於鋼琴，Space、方向鍵和 Esc 則永遠有效。',
      },
    ],
    needs: {
      en: 'Call `desk.render(state)` every frame after `stage.frame()` (a show\'s loop does): the desk only redraws when you tell it to. `state` is the resolved params, `params.resolve(timeline.state())`.',
      zh: '每個畫面在 `stage.frame()` 之後呼叫 `desk.render(state)`（演出的迴圈會做）：控台只在你叫它的時候才重畫。`state` 是解析後的參數，也就是 `params.resolve(timeline.state())`。',
    },
    notes: [
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
    related: ['createShow', 'Timeline', 'Mapper', 'LearnWizard', 'Director', 'Params', 'MonitorFeed'],
    keywords: {
      en: ['console', 'desk', 'director desk', 'control panel', 'sliders', 'transport', 'scrubber', 'performance mode', 'teleprompter', 'keyboard shortcuts', 'ui', 'learn'],
      zh: ['控台', '導演控台', '控制面板', '推桿', '播放控制', 'scrubber', '演出模式', '提詞器', '鍵盤快速鍵', '介面', 'learn'],
    },
  },
};
