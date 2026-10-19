// @openav/score reference: the score (a show as segment lengths) and the director (the modules that perform each segment).
// Read by tools/build-reference.mjs (see AGENTS.md, "Documenting a public name").

export default {
  Score: {
    group: 'timeline',
    summary: {
      en: 'A show written as segments with lengths, never as absolute seconds: it works out every start, end, cue and countdown, for every version (cut) of the show.',
      zh: '把一場演出寫成「每一段有多長」，而不是絕對秒數：每個起點、終點、cue 和倒數，以及每一個版本（cut）的時間，都由它算出來。',
    },
    params: [
      {
        name: 'cuts', type: 'Array | Object', optional: false,
        en: 'The cuts this show can be performed as: an array of cuts, or an object keyed by cut id. A cut is `{ id, title?, start?, segments: [...] }`, or a derived one, `{ id, title?, from, scale }`. Required: without a cut it throws.',
        zh: '這場演出可以表演成哪些 cut：一個 cut 的陣列，或以 cut id 為 key 的物件。一個 cut 是 `{ id, title?, start?, segments: [...] }`，或衍生的 `{ id, title?, from, scale }`。必填，沒有 cut 就會丟出錯誤。',
      },
      {
        name: 'cut', type: 'String', optional: true, default: 'the first cut',
        en: 'The id of the cut to perform. Defaults to the first one; an id that is not in `cuts` is an error.',
        zh: '要表演的 cut 的 id。預設是第一個，不在 `cuts` 裡的 id 是錯誤。',
      },
    ],
    description: [
      {
        en: 'A timeline written as a table of absolute seconds cannot grow: make one scene longer and every later cue, curve and `if (t > 466)` is wrong. In a score you write only how **long** each segment is, and `Score` computes every start, end, cue time, countdown and scene from those lengths. Change one `dur` and everything after it moves; a second version of the show is a few lines of data.',
        zh: '把時間軸寫成一張絕對秒數的表，它就長不大：某個場景拉長一點，後面每個 cue、曲線和 `if (t > 466)` 全都錯了。在總譜裡你只寫每一段「多**長**」，`Score` 從這些長度算出每個起點、終點、cue 的時間、倒數和場景。改一個 `dur`，它後面的一切都跟著挪。第二個版本只是幾行資料。',
      },
      {
        en: 'A cut is one version of the show; a segment is one stretch of it:\n\n```js\n{ id: \'full\', title: \'A day\', segments: [\n  { id: \'standby\', dur: 6, hold: true, acts: [\'Press Space when the room is ready\'] },\n  { id: \'dawn\',    dur: 24, cues: { birds: 0.3 } },          // a ratio of the segment\n  { id: \'noon\',    dur: 30, cues: { flare: { s: 8 } } },     // or seconds into it\n  { id: \'dusk\',    dur: 24, linger: 8 },\n] }\n{ id: \'short\', from: \'full\', scale: 0.5 }                     // the same show at half the length\n```\n\n`dur` is the only time a segment has. `cues` are named moments (a ratio `0 <= r < 1`, or `{ s: seconds }`), `acts` is what the human operator does (strings shown on the desk), `linger` keeps a segment\'s module running for some seconds after it ends, `hold` stops playback at the end of the segment until the operator releases it, and `module` names the module that performs it when that is not the segment\'s own id. A derived cut scales `dur`, `linger` and `{ s }` cues, so a cue keeps its place in the music.',
        zh: '一個 cut 是演出的一個版本，一個 segment（段落）是其中的一段：\n\n```js\n{ id: \'full\', title: \'A day\', segments: [\n  { id: \'standby\', dur: 6, hold: true, acts: [\'Press Space when the room is ready\'] },\n  { id: \'dawn\',    dur: 24, cues: { birds: 0.3 } },          // a ratio of the segment\n  { id: \'noon\',    dur: 30, cues: { flare: { s: 8 } } },     // or seconds into it\n  { id: \'dusk\',    dur: 24, linger: 8 },\n] }\n{ id: \'short\', from: \'full\', scale: 0.5 }                     // the same show at half the length\n```\n\n`dur` 是一個段落唯一擁有的時間。`cues` 是有名字的時刻（比例 `0 <= r < 1`，或 `{ s: 秒數 }`），`acts` 是操作者要做的事（顯示在控台上的字串），`linger` 讓段落的模組在段落結束後再多跑幾秒，`hold` 讓播放停在段落尾端，等操作者放行，`module` 在負責表演的模組不是段落自己的 id 時，指定模組名稱。衍生的 cut 會縮放 `dur`、`linger` 和 `{ s }` 形式的 cue，所以 cue 在音樂裡的位置不變。',
      },
      {
        en: 'Everything is checked when the score is built. Duplicate ids, a `dur` of 0 or below, a `from` that is not a cut, a cut derived from itself, a cue outside its segment: each throws a [`ScoreError`](#ScoreError) that lists every problem at once. In a show, [`createShow()`](#createShow) builds the score from its `score` option and hands it to a [`Timeline`](#Timeline) and a [`Director`](#Director); `?cut=<id>` in the page address picks the cut.',
        zh: '總譜在建立的時候就會全部檢查一遍。id 重複、`dur` 等於或小於 0、`from` 指到不存在的 cut、cut 衍生自己、cue 落在段落外面，每一種都會丟出 [`ScoreError`](#ScoreError)，一次把所有問題列出來。在演出裡，[`createShow()`](#createShow) 依 `score` 選項建好總譜，交給 [`Timeline`](#Timeline) 和 [`Director`](#Director)，網址上的 `?cut=<id>` 可以選 cut。',
      },
    ],
    members: {
      cuts: {
        en: 'Every cut, for a version picker: `[{ id, title, total, from, scale, base }]`.',
        zh: '所有的 cut，給版本選單用：`[{ id, title, total, from, scale, base }]`。',
      },
      validate: {
        en: 'Check everything again; throws a `ScoreError` that lists every problem, and returns `true` when sound. The constructor already calls it.',
        zh: '把所有東西再檢查一遍：有問題就丟出列出所有問題的 `ScoreError`，沒問題就回傳 `true`。建構函式已經呼叫過了。',
      },
      table: {
        en: 'One row per segment, `{ index, id, title, start, end, dur, linger, hold }`, for `console.table()` and docs.',
        zh: '每個段落一列，`{ index, id, title, start, end, dur, linger, hold }`，給 `console.table()` 和文件用。',
      },
      segment: {
        en: 'The segment with this id, or `undefined`.',
        zh: '這個 id 的段落，沒有就是 `undefined`。',
      },
      indexAt: {
        en: 'The index of the segment playing at show time `T`. A segment owns `[start, end)`. Before 0 (or `NaN`) answers 0, after the end the last one.',
        zh: '演出時間 `T` 正在播的段落的索引。一個段落擁有 `[start, end)` 這段時間。小於 0（或 `NaN`）回答 0，超過結尾回答最後一個。',
      },
      segmentAt: {
        en: 'The segment playing at show time `T` (see `indexAt`).',
        zh: '演出時間 `T` 正在播的段落（規則同 `indexAt`）。',
      },
      cueTime: {
        en: 'A moment in show seconds: `\'dusk\'` is the segment\'s start, `\'dusk.end\'` its end, `\'dusk.glow\'` a cue declared in the cut. `NaN` when the name means nothing here.',
        zh: '以演出秒數表示的某個時刻：`\'dusk\'` 是段落開頭，`\'dusk.end\'` 是段落結尾，`\'dusk.glow\'` 是 cut 裡宣告的 cue。名字在這裡沒有意義就回傳 `NaN`。',
      },
      cues: {
        en: 'Every cue of the cut in time order: `[{ name, cue, T, p, n, segment }]`, where `n` is its place in that order.',
        zh: '這個 cut 的所有 cue，依時間排序：`[{ name, cue, T, p, n, segment }]`，`n` 是它在這個順序中的位置。',
      },
      cuesBetween: {
        en: 'The cues a playhead passed going from `T0` to `T1`: those with `T0 < time <= T1`, in order. Nothing when `T1 <= T0`.',
        zh: '播放頭從 `T0` 走到 `T1` 的途中經過的 cue：時間滿足 `T0 < 時間 <= T1` 的那些，依序排列。`T1 <= T0` 時什麼都沒有。',
      },
      baseTime: {
        en: 'Time `T` expressed on the cut this one was derived from (`T / scale`). Equal to `T` when the cut is not derived. This is how automation written once against the full cut stretches with a short one.',
        zh: '把時間 `T` 換算成這個 cut 衍生來源的那個 cut 上的時間（`T / scale`）。不是衍生的 cut 就等於 `T`。只對完整版寫一次的自動化曲線，就是靠這個跟著短版一起拉伸。',
      },
      scenes: {
        en: 'The segments as a `scenes` array for a [`Timeline`](#Timeline), with `acts`, `hold` and `cues` (cue times in show seconds).',
        zh: '把段落轉成給 [`Timeline`](#Timeline) 用的 `scenes` 陣列，帶著 `acts`、`hold` 和 `cues`（cue 的時間是演出秒數）。',
      },
    },
    notes: [
      {
        en: 'Plain fields: `cut` (the id being performed), `title`, `segments` (each with `start`, `end`, `dur`, `index`, `cues` …), `total` (the length of the show), `startT` (where `reset` goes), `scale` and `base`.',
        zh: '普通欄位：`cut`（正在表演的 id）、`title`、`segments`（每一段都有 `start`、`end`、`dur`、`index`、`cues` ……）、`total`（演出總長）、`startT`（`reset` 回到哪裡）、`scale` 和 `base`。',
      },
      {
        en: 'Segment and cue ids must not contain a dot: the dot is how `cueTime(\'dusk.glow\')` separates a segment from its cue. A cue cannot be called `end`.',
        zh: '段落和 cue 的 id 不能含有句點：`cueTime(\'dusk.glow\')` 就是靠句點把段落和它的 cue 分開。cue 也不能叫 `end`。',
      },
      {
        en: 'If two cuts differ in structure and not only in length, do not share automation between them. Drive the params from the segment modules instead, where `ctx.p` already scales for free.',
        zh: '如果兩個 cut 不只是長度不同、連結構都不同，就不要讓它們共用自動化曲線，改由段落模組來驅動參數，那裡的 `ctx.p` 本來就會跟著縮放。',
      },
    ],
    examples: [
      {
        code: `import { Score } from '@openav/score';

const score = new Score({ cuts: [{ id: 'full', segments: [
  { id: 'dawn', dur: 24, cues: { birds: 0.25 } },
  { id: 'noon', dur: 30, cues: { flare: { s: 8 } } },
  { id: 'dusk', dur: 26 },
] }] });
console.table(score.table());
console.log(score.total, score.segmentAt(40).id, score.cueTime('noon.flare'));`,
        caption: { en: 'The console shows a table of the three segments (`dawn` 0 to 24, `noon` 24 to 54, `dusk` 54 to 80), then `80 noon 32`: the show is 80 seconds long, second 40 is in `noon`, and the flare cue sits at 32.', zh: '主控台會顯示三個段落的表格（`dawn` 0 到 24、`noon` 24 到 54、`dusk` 54 到 80），然後印出 `80 noon 32`：演出長 80 秒，第 40 秒在 `noon`，flare 這個 cue 在第 32 秒。' },
      },
      {
        code: `import { Score } from '@openav/score';

const cuts = [
  { id: 'full', segments: [{ id: 'dawn', dur: 24, cues: { birds: 0.25 } }, { id: 'noon', dur: 30, cues: { flare: { s: 8 } } }] },
  { id: 'short', from: 'full', scale: 0.5 },
];
for (const cut of ['full', 'short']) {
  const score = new Score({ cuts, cut });
  console.log(cut, score.total, score.cueTime('dawn.birds'), score.cueTime('noon.flare'));
}`,
        caption: { en: 'The same show at two lengths: `full 54 6 32`, then `short 27 3 16`. Every time is halved and the cues stay in the same place in the music.', zh: '同一場演出的兩種長度：`full 54 6 32`，然後 `short 27 3 16`。所有時間都減半，cue 在音樂裡的位置不變。' },
      },
      {
        code: `import { Params } from '@openav/core';
import { Score } from '@openav/score';
import { Timeline } from '@openav/timeline';

const cuts = [
  { id: 'full', segments: [{ id: 'a', dur: 20 }, { id: 'b', dur: 40, hold: true }, { id: 'c', dur: 20 }] },
  { id: 'short', from: 'full', scale: 0.5 },
];
const params = new Params([{ key: 'haze', min: 0, max: 1, def: 0 }]);
for (const cut of ['full', 'short']) {
  const timeline = new Timeline({ params, score: new Score({ cuts, cut }), automation: { haze: [[0, 0], [80, 1]] } });
  console.log(cut, timeline.total, timeline.scenes.map((s) => s.id + '@' + s.t).join(' '), timeline.valueAt('haze', 20));
}`,
        caption: { en: 'The timeline takes its scenes and total from the score, and reads the haze curve (written once for the full cut) stretched: `full 80 a@0 b@20 c@60 0.25`, then `short 40 a@0 b@10 c@30 0.5`.', zh: '時間軸的場景和總長都從總譜來，而且讀的是被拉伸的 haze 曲線（只對完整版寫過一次）：`full 80 a@0 b@20 c@60 0.25`，然後 `short 40 a@0 b@10 c@30 0.5`。' },
      },
    ],
    related: ['ScoreError', 'Director', 'Timeline', 'createShow'],
    keywords: {
      en: ['score', 'cut', 'cuts', 'segment', 'segments', 'cue', 'cues', 'hold', 'linger', 'dur', 'duration', 'structure', 'version', 'show structure'],
      zh: ['總譜', '樂譜', 'cut', '段落', '版本', 'cue', '長度', '結構', '倒數', '場景', 'hold'],
    },
  },

  ScoreError: {
    group: 'timeline',
    summary: {
      en: 'The error a Score throws when it cannot be built: its `problems` array lists every reason at once, and its message lists them too.',
      zh: '總譜建不起來的時候丟出的錯誤：它的 `problems` 陣列一次列出所有原因，錯誤訊息裡也會一起列出來。',
    },
    params: [
      {
        name: 'problems', type: 'Array<String>', optional: false,
        en: 'The reasons, one string each. Each one names the cut, the segment and what is wrong.',
        zh: '所有原因，每個一個字串。每一個都會指出是哪個 cut、哪個段落、哪裡不對。',
      },
    ],
    description: [
      {
        en: 'You rarely build one yourself: [`new Score()`](#Score) throws it. `error.problems` is an array of strings and `error.message` is the same list as one text, headed "Score is invalid (3 problems)". `error.name` is `\'ScoreError\'`, and it is a normal `Error`, so `instanceof ScoreError` and `instanceof Error` both work.',
        zh: '通常不用自己建：[`new Score()`](#Score) 會丟出它。`error.problems` 是字串陣列，`error.message` 是同一份清單串成的文字，開頭是「Score is invalid (3 problems)」。`error.name` 是 `\'ScoreError\'`，它是一般的 `Error`，所以 `instanceof ScoreError` 和 `instanceof Error` 都成立。',
      },
      {
        en: 'It lists every problem it found, not only the first, so one run of the show shows you everything to fix. Nothing half-valid can reach the stage.',
        zh: '它會列出找到的所有問題，不是只列第一個，所以跑一次就能看到所有要修的地方。有問題的總譜上不了台。',
      },
    ],
    examples: [
      {
        code: `import { Score, ScoreError } from '@openav/score';

try {
  new Score({ cuts: [
    { id: 'a', segments: [{ id: 'x', dur: 0 }, { id: 'x', dur: 5 }] },
    { id: 'b', from: 'missing', scale: 1 },
  ] });
} catch (error) {
  console.log(error instanceof ScoreError, error.problems.length);
  for (const problem of error.problems) console.log('-', problem);
}`,
        caption: { en: 'Three mistakes, all reported at once: the console prints `true 3` and then one line for each (a `dur` of 0, a repeated id, a `from` that is not a cut).', zh: '三個錯誤一次全部報出來：主控台印出 `true 3`，然後每個錯誤一行（`dur` 是 0、id 重複、`from` 指到不存在的 cut）。' },
      },
    ],
    related: ['Score', 'Director'],
    keywords: {
      en: ['score error', 'ScoreError', 'validation', 'invalid score', 'problems', 'error', 'throws'],
      zh: ['總譜錯誤', '驗證', '檢查', '錯誤', '問題清單', '例外'],
    },
  },

  Director: {
    group: 'timeline',
    summary: {
      en: 'Runs a score\'s segment modules: enters each once, updates it every frame, exits it once, fires cues, and switches off a module that crashes without stopping the show.',
      zh: '執行總譜的段落模組：每個模組進場一次、每個畫面更新、退場一次，觸發 cue，而且某個模組當掉時只關掉它，不會讓演出停下來。',
    },
    params: [
      {
        name: 'score', type: 'Score', optional: false,
        en: 'The [`Score`](#Score) to perform. Required: without it the constructor throws "Director needs a score".',
        zh: '要表演的 [`Score`](#Score)。必填，沒有的話建構函式會丟出 "Director needs a score"。',
      },
      {
        name: 'modules', type: 'Array | Object', optional: true, default: '[]',
        en: 'The segment modules: an array (matched to segments by each module\'s `id`) or an object keyed by segment id. A segment with no module is simply not performed.',
        zh: '段落模組：一個陣列（依每個模組的 `id` 對應到段落），或以段落 id 為 key 的物件。沒有模組的段落就單純不被表演。',
      },
      {
        name: 'api', type: 'Object | Function', optional: true, default: '{}',
        en: 'What every module hook receives as its first argument (also `ctx.api`). A function is called once, the first time it is needed, and its result is used.',
        zh: '每個模組的掛鉤收到的第一個參數（也是 `ctx.api`）。如果是函式，會在第一次需要時呼叫一次，然後使用它回傳的結果。',
      },
      {
        name: 'onStatus', type: 'Function | null', optional: true, default: 'null',
        en: 'Called with `status()` when the segment, the holding state or the list of switched-off modules changes, not every frame.',
        zh: '當段落、hold 的狀態或被關掉的模組清單改變的時候，以 `status()` 呼叫，不是每個畫面都呼叫。',
      },
      {
        name: 'onCue', type: 'Function | null', optional: true, default: 'null',
        en: 'Called for each cue the playhead passes: `{ name, cue, T, n, segment }`.',
        zh: '播放頭每經過一個 cue 就呼叫一次：`{ name, cue, T, n, segment }`。',
      },
      {
        name: 'maxStep', type: 'Number', optional: true, default: '2',
        en: 'A jump bigger than this many seconds between two `update()` calls counts as a seek, so the cues in between are not fired. Raise it if you rehearse at a very high `timeline.rate`.',
        zh: '兩次 `update()` 之間跳超過這麼多秒，就算是 seek，中間的 cue 不會觸發。如果你用很高的 `timeline.rate` 排練，把它調大。',
      },
    ],
    description: [
      {
        en: 'A **segment module** is the code that performs one segment (the dawn, the storm, the finale). The director calls its hooks as the show moves through the score:\n\n```js\n{\n  id: \'dusk\',                                  // the id of the segment it performs\n  enter(api, ctx)  {},                         // the segment began, or a seek landed inside it\n  update(api, ctx) {},                         // every frame while the segment (and its linger) is current\n  exit(api, ctx)   {},                         // it ended, or a seek left it: give back what you took\n  param(key, value, ctx) { return value; },    // optional: rewrite a timeline param meanwhile\n  cue(name, ctx)   {},                         // optional: one of its cues was just passed\n  reset(api)       {},                         // optional: R was pressed, forget everything\n}\n```',
        zh: '**段落模組**就是負責表演一個段落（黎明、暴風雨、終曲）的程式碼。演出走過總譜的時候，導演會呼叫它的掛鉤：\n\n```js\n{\n  id: \'dusk\',                                  // the id of the segment it performs\n  enter(api, ctx)  {},                         // the segment began, or a seek landed inside it\n  update(api, ctx) {},                         // every frame while the segment (and its linger) is current\n  exit(api, ctx)   {},                         // it ended, or a seek left it: give back what you took\n  param(key, value, ctx) { return value; },    // optional: rewrite a timeline param meanwhile\n  cue(name, ctx)   {},                         // optional: one of its cues was just passed\n  reset(api)       {},                         // optional: R was pressed, forget everything\n}\n```',
      },
      {
        en: 'Every hook gets a `ctx`: `p` (progress through the segment, 0 to 1; above 1 during `linger`; exactly 1 while holding), `t` (seconds into the segment), `dt`, `dur`, `T` (show time), `segment`, `cue(name)` and `cueT(name)` (where a cue sits, as a progress and in show seconds), `phase` (`\'active\'`, `\'linger\'`, or `\'failed\'` inside `exit()` after a crash), `holding`, `held` (seconds waited at a hold: a clock for ambient motion while `T` is frozen), `playing` and `api`.',
        zh: '每個掛鉤都會收到一個 `ctx`：`p`（這一段走了多少，0 到 1，餘韻期間大於 1，hold 的時候剛好是 1）、`t`（段內第幾秒）、`dt`、`dur`、`T`（演出時間）、`segment`、`cue(name)` 和 `cueT(name)`（cue 的位置，一個是進度、一個是演出秒數）、`phase`（`\'active\'`、`\'linger\'`，崩潰後的 `exit()` 裡是 `\'failed\'`）、`holding`、`held`（在 hold 上等了幾秒，演出時間 `T` 凍結時可以拿它當環境動態的時鐘）、`playing` 和 `api`。',
      },
      {
        en: 'A module is entered once and exited once, however the show got there: a seek into the middle of a segment calls `enter` with the right `p`, so a module must be able to start from the middle. A module that throws is switched off alone: the director calls its `exit()` once with `phase: \'failed\'`, logs one `console.error`, and never calls it again; the other modules and the show carry on. Reset brings it back.',
        zh: '一個模組只進場一次、只退場一次，不管演出是怎麼走到那裡的：seek 到段落中間，會用正確的 `p` 呼叫 `enter`，所以模組必須能從中間開始。丟出錯誤的模組只有它自己會被關掉：導演用 `phase: \'failed\'` 呼叫一次它的 `exit()`，印出一行 `console.error`，之後不再呼叫它，其他模組和演出照常進行。reset 可以把它請回來。',
      },
      {
        en: 'In a show, [`createShow()`](#createShow) builds the director from its `score` option and calls `update()` every frame after the timeline has advanced; the director\'s `param()` plugs into `timeline.layer`. Without `createShow()` you do that wiring yourself: `director.update(timeline.t, dt, { holding: timeline.holding, playing: timeline.playing })`.',
        zh: '在演出裡，[`createShow()`](#createShow) 依 `score` 選項建好導演，每個畫面在時間軸前進之後呼叫 `update()`，導演的 `param()` 接到 `timeline.layer` 上。不用 `createShow()` 的話，這些接線要自己做：`director.update(timeline.t, dt, { holding: timeline.holding, playing: timeline.playing })`。',
      },
    ],
    members: {
      api: {
        en: 'The `api` object the modules receive (a function given as `api` is called on first use).',
        zh: '模組收到的 `api` 物件（傳進來的 `api` 如果是函式，會在第一次使用時呼叫）。',
      },
      register: {
        en: 'Add a segment module (it replaces one with the same id). Throws when the module has no string `id`. Returns the director.',
        zh: '加入一個段落模組（同 id 的會被取代）。模組沒有字串 `id` 時會丟出錯誤。回傳導演本身。',
      },
      moduleFor: {
        en: 'The module that performs a segment: the one named by its `module` field, else the one with its own id, else `null`.',
        zh: '負責表演某個段落的模組：先找它的 `module` 欄位指定的名稱，再找跟它自己同 id 的，都沒有就是 `null`。',
      },
      holding: {
        en: 'Whether the show is parked at a hold, as told by the last `update()`.',
        zh: '根據最近一次 `update()`，演出是否停在 hold 上。',
      },
      update: {
        en: 'Call once per frame, after the timeline advanced: `update(T, dt, { holding, playing })` with `T` the show time. Enters, updates and exits the modules and fires the cues passed since the previous call.',
        zh: '每個畫面在時間軸前進之後呼叫一次：`update(T, dt, { holding, playing })`，`T` 是演出時間。負責模組的進場、更新、退場，並觸發從上一次呼叫以來經過的 cue。',
      },
      param: {
        en: 'The timeline\'s param layer: `param(key, value, T)` lets the modules of the current segments rewrite the value (a module returns a number to replace it). A performer\'s override still wins afterwards.',
        zh: '時間軸的參數圖層：`param(key, value, T)` 讓目前段落的模組改寫這個值（模組回傳一個數字就取代它）。表演者的覆寫之後套用，仍然以覆寫為準。',
      },
      seek: {
        en: 'The playhead jumped to `T`: modules whose segment no longer covers `T` exit now, and the next `update()` enters the new ones with the right `p`.',
        zh: '播放頭跳到了 `T`：不再涵蓋 `T` 的段落的模組現在退場，下一次 `update()` 會用正確的 `p` 讓新的模組進場。',
      },
      reset: {
        en: 'Back to the start: every active module exits, every module hears `reset(api)`, and switched-off modules come back.',
        zh: '回到起點：所有進行中的模組退場，每個模組都會收到 `reset(api)`，被關掉的模組也回來了。',
      },
      status: {
        en: 'For the desk and the backstage: `{ cut, T, total, segment, next, holding, held, active, failed, errors, missing }`, with the current segment\'s progress and time remaining, the next segment and its countdown, and who is switched off.',
        zh: '給控台和後台用：`{ cut, T, total, segment, next, holding, held, active, failed, errors, missing }`，包含目前段落的進度與剩餘時間、下一個段落與倒數，以及哪些模組被關掉了。',
      },
    },
    notes: [
      {
        en: 'The last segment is never exited by time: while the show sits at its end (or past it), the last module stays entered. It exits on a seek that leaves it, or on `reset()`.',
        zh: '最後一個段落不會因為時間而退場：演出停在尾端（或超過尾端）時，最後一個模組仍維持進場狀態。它只在 seek 離開或 `reset()` 時退場。',
      },
      {
        en: 'A new segment\'s module is entered before the old one exits, and during `linger` both run at the same time.',
        zh: '新段落的模組會先進場、舊的才退場，在 `linger` 期間兩個會同時在跑。',
      },
      {
        en: 'A module whose `module` or `id` matches no segment, or a segment that names a module nobody registered (listed in `status().missing`), is simply not performed. The show keeps going.',
        zh: '`module` 或 `id` 對不到任何段落的模組，或段落指定了沒人登記的模組（會列在 `status().missing`），都只是不被表演，演出照常進行。',
      },
    ],
    examples: [
      {
        code: `import { Score, Director } from '@openav/score';

const score = new Score({ cuts: [{ id: 'full', segments: [
  { id: 'dawn', dur: 4, cues: { birds: 0.5 } },
  { id: 'noon', dur: 4 },
] }] });
const say = (id) => ({
  id,
  enter(api, ctx) { console.log(id, 'enter, p =', ctx.p); },
  exit() { console.log(id, 'exit'); },
  cue(name) { console.log(id, 'cue', name); },
});
const director = new Director({ score, modules: [say('dawn'), say('noon')] });
for (let T = 0; T <= 8; T += 1) director.update(T, 1, { playing: true });   // one call per frame`,
        caption: { en: 'The console prints `dawn enter, p = 0`, `dawn cue birds` (second 2), then `noon enter, p = 0` and `dawn exit` at second 4. The last segment stays entered to the end.', zh: '主控台印出 `dawn enter, p = 0`、`dawn cue birds`（第 2 秒），然後第 4 秒是 `noon enter, p = 0` 和 `dawn exit`。最後一個段落會一直維持進場到結束。' },
      },
      {
        code: `import { Score, Director } from '@openav/score';

const score = new Score({ cuts: [{ id: 'full', segments: [{ id: 'dawn', dur: 4 }, { id: 'noon', dur: 4 }] }] });
const sun = { id: 'dawn', param: (key, value, ctx) => (key === 'sun' ? ctx.p : value) };
const director = new Director({ score, modules: [sun] });

director.update(1, 1, { playing: true });
console.log(director.param('sun', 0.9, 1), director.param('moon', 0.9, 1));   // 0.25 0.9
director.update(2, 1, { playing: true });
console.log(director.param('sun', 0.9, 2));                                     // 0.5`,
        caption: { en: 'While `dawn` is current its module bends only the `sun` param, following its own progress: the console prints `0.25 0.9`, then `0.5`.', zh: '`dawn` 在進行的時候，它的模組只改動 `sun` 這個參數，跟著自己的進度走：主控台印出 `0.25 0.9`，然後是 `0.5`。' },
      },
      {
        code: `import { Score, Director } from '@openav/score';

console.error = (message) => console.log('logged:', String(message).slice(0, 62));   // show the director's error line here

const score = new Score({ cuts: [{ id: 'full', segments: [{ id: 'dawn', dur: 4 }, { id: 'noon', dur: 4 }] }] });
const dawn = { id: 'dawn', update() { throw new Error('boom'); } };
const noon = { id: 'noon', enter() { console.log('noon is still performed'); } };
const director = new Director({ score, modules: [dawn, noon] });

director.update(1, 1, { playing: true });     // dawn throws: it is switched off, once
director.update(5, 1, { playing: true });     // the show goes on
console.log(director.status().failed, director.status().errors);
director.reset();                              // brings dawn back
console.log(director.status().failed);`,
        caption: { en: 'A crash is contained: the console prints `logged: [score] segment module "dawn" crashed in update: boom and was` (normally a red error line), then `noon is still performed`, `[ \'dawn\' ] { dawn: \'update: boom\' }`, and after the reset `[]`.', zh: '崩潰被關在原地：主控台印出 `logged: [score] segment module "dawn" crashed in update: boom and was`（平常那是一行紅色的錯誤訊息），接著是 `noon is still performed`、`[ \'dawn\' ] { dawn: \'update: boom\' }`，reset 之後是 `[]`。' },
      },
    ],
    related: ['Score', 'ScoreError', 'Timeline', 'createShow', 'mountConsole'],
    keywords: {
      en: ['director', 'segment module', 'module', 'enter', 'exit', 'update', 'cue', 'linger', 'hold', 'param layer', 'crash', 'status', 'score player'],
      zh: ['導演', '段落模組', '模組', '進場', '退場', 'cue', '餘韻', 'hold', '參數圖層', '崩潰', '狀態'],
    },
  },
};
