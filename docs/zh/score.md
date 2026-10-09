# 總譜與導演

一場演出長大之後，需要一個能跟著長大的結構。**總譜**（`@openav/score`）把演出寫成一段一段、只有「長度」的段落，**導演**則負責執行每一段的程式。兩者都是純邏輯、不碰 DOM。`createShow()` 會幫你把它們接上[時間軸](show-control.md#timeline)、控台和提詞機。

## 核心想法：只寫長度，不寫秒數

把時間軸寫成一張絕對秒數的表，它就長不大。第二個場景拉長一點，後面每個場景、cue、曲線，還有程式裡的每一句 `if (t > 466)` 全都錯了，而且你只能在一次又一次排練裡一個一個找出來。在總譜裡你只寫每一段「多長」：

```js
const cuts = [
  { id: 'full', title: 'A day', segments: [
    { id: 'standby', title: 'Standby', dur: 6, hold: true, acts: ['Check sound', 'Press Space when the room is ready'] },
    { id: 'dawn',    title: 'Dawn',    dur: 24, cues: { birds: 0.3 } },
    { id: 'noon',    title: 'Noon',    dur: 30, cues: { flare: { s: 8 }, peak: 0.5 }, acts: ['Open the haze slowly'] },
    { id: 'dusk',    title: 'Dusk',    dur: 24, linger: 8 },
    { id: 'night',   title: 'Night',   dur: 36 },
  ] },
  { id: 'short', from: 'full', scale: 0.5 },          // the same show at half the length
];
```

每個起點、終點、cue 的時間、倒數和場景，都從這些長度算出來。把 `noon` 改成 `dur: 40`，它後面的一切往後挪十秒，前面的一切原地不動。第二個版本只是幾行資料，不是要和第一份時間軸同步維護的另一份時間軸。

## cut

一個 cut 是演出的一個版本。它有 `id`、選填的 `title`，加上「段落」或「基底 cut 與倍率」其中一種。

| cut 欄位 | 意義 |
|---|---|
| `id` | 在所有 cut 之間不重複，不能含 `.` |
| `title` | 顯示在版本選單 |
| `segments` | 下表的段落，依演出順序排列 |
| `from`、`scale` | 衍生 cut：名為 `from` 的 cut，每個長度乘上 `scale`（`scale` 要大於 0）。衍生的 cut 可以再被衍生，倍率會相乘 |
| `start` | 演出一開始停在哪一段、`reset` 回到哪一段（段落 id，預設是第一段） |

| 段落欄位 | 意義 |
|---|---|
| `id` | 在 cut 內不重複，不能含 `.`。它同時是負責演出這一段的模組 id |
| `title`、`note` | 導演台和提詞機顯示的字 |
| `dur` | 長度，單位秒，要大於 0。這是段落唯一的時間 |
| `cues` | 段落內有名字的時刻：比例 `0 ≤ r < 1`（佔這一段的幾分之幾），或 `{ s: 秒數 }`（段內第幾秒） |
| `acts` | 這一段操作者要做的事：字串陣列，顯示在導演台，也大字顯示在提詞機 |
| `linger` | 段落結束後，它的模組再繼續跑幾秒（餘韻、衰減的尾巴），預設 0 |
| `hold` | 播放到這一段的段尾就停住，等操作者放行（[Hold](#hold)） |
| `module` | 負責演出它的模組名稱，不是段落自己的 id 時才需要 |

衍生 cut 會縮放 `dur`、`linger` 和 `{ s }` 形式的 cue，所以 cue 在音樂裡的位置不變。比例形式的 cue 本來就不需要動。

cut 在建立總譜時就會檢查。id 重複、`dur` 等於或小於 0、`from` 指到不存在的 cut、`scale` 等於或小於 0、cut 衍生自己、cue 落在段落外面、`acts` 不是字串，每一種都會丟出 `ScoreError`，訊息裡寫明是哪個 cut、哪一段、為什麼，而且一次把所有問題列出來。有問題的總譜上不了台。

## 總譜 Score

```js
import { Score } from '@openav/score';
const score = new Score({ cuts, cut: 'full' });      // cut defaults to the first
```

| 成員 | 回傳 |
|---|---|
| `table()` | 每段一列：`{ index, id, title, start, end, dur, linger, hold }` |
| `total` | 演出全長：各段長度的總和 |
| `segmentAt(T)`、`indexAt(T)` | 演出時間 `T` 正在播的段落。一段擁有 `[start, end)`。小於 0 回第一段，超過全長回最後一段 |
| `cueTime('dusk')` | 以演出秒表示的某個時刻：`'dusk'` 是段落開頭，`'dusk.end'` 是段落結尾，`'dusk.glow'` 是 cue。不認得的名字回 `NaN` |
| `cuesBetween(T0, T1)` | 播放頭從 `T0` 走到 `T1` 之間經過的 cue：時間落在 `T0 < time ≤ T1` 的，依時間排序。`T1 ≤ T0` 時什麼也沒有 |
| `cues()` | 整個 cut 的所有 cue，依時間排序，每個帶著編號 `n` |
| `scenes()` | 把段落變成給[時間軸](show-control.md#timeline)用的 `scenes` 陣列（含 `acts`、`hold`、`cues`） |
| `validate()` | 有任何問題就丟 `ScoreError`，沒問題回 `true`（建構時已經呼叫過） |
| `cut`、`title`、`segments`、`startT` | 目前的 cut，以及 `reset` 要回到哪裡 |
| `cuts` | 每個 cut 的 `{ id, title, total, from, scale, base }`，做版本選單用 |
| `scale`、`base`、`baseTime(T)` | 這個 cut 相對於它最終衍生來源的總倍率、那個來源的 id，以及用來源 cut 表示的 `T` |

### 衍生 cut 上的自動化曲線

自動化曲線只要對著它衍生來源的那個 cut 寫一次，衍生 cut 會把它一起拉伸。`timeline.valueAt(key, t)` 讀的是 `score.baseTime(t)` 處的曲線值，也就是 `t / scale`。在上面的短版裡，`t = 20` 讀的是曲線 40 秒處。沒有被衍生的 cut 倍率是 1，什麼都不會變。

如果兩個 cut 的差別在結構而不只是長度，就不要讓它們共用自動化曲線。改用段落模組的 [`param()`](#segment-modules) 去驅動參數，那裡的 `ctx.p` 自己就會跟著縮放。

## cue

cue 是一個有名字的時刻：在 `noon` 段裡寫 `cues: { peak: 0.5 }`，就有了 `noon.peak`，位置在這一段的一半。有三個地方看得到它：

- 時間軸 scrubber 會畫一個刻度，點一下刻度就跳到那裡。
- 導演在播放頭「經過」它的那一刻呼叫一次 `onCue({ name, cue, T, n, segment })`，並呼叫目前這個模組的 `cue(name, ctx)`。
- 模組裡的 `ctx.cue('peak')` 會告訴你它在哪裡，單位是進度，可以直接和 `ctx.p` 比大小（別段的 cue 寫成 `'noon.peak'`，`ctx.cueT(name)` 回傳演出秒數）。

seek 跳過去的 cue 不算經過，播放時倒回去再經過，它會再觸發一次。剛好落在演出第一瞬間的 cue，會在第一個影格觸發。

## Hold

`hold: true` 的意思是：**播放到這一段的段尾，就停住等。** 最典型的用法是等現場準備好的待機段。確切的行為如下：

- 時間軸停在邊界前一微秒，所以演出仍然「在」被 hold 的那一段裡，並且設定 `timeline.holding = true`、`timeline.playing = false`。時鐘就凍結在那裡，你要等多久都行。
- 被 hold 的那一段的模組每個影格仍然會收到 `update()`，此時 `ctx.p === 1`、`ctx.holding === true`，還有 `ctx.held`，也就是已經等了幾秒。任何要在演出凍結時繼續呼吸的東西，就用 `ctx.held` 當它的時鐘。（這裡做的選擇是：演出在段尾「停住」，不是在段內循環。循環會讓 `p` 回到 0、讓 cue 重複觸發，也會打破「每個模組只 enter 一次、exit 一次」。）
- **Space**、**→**、▶ 按鈕、`timeline.play()` 和 `timeline.next()` 都能放行：下一段立刻開始，播放繼續。程式裡用 `timeline.release()` 也一樣。
- seek（scrubber、`goto`、←）或 reset 會清掉 hold，而 seek 永遠不會「停在」hold 上，只有播放才會。最後一段不會 hold（演出在那裡結束）。
- 後台監看會顯示 `⏸ HOLD`，導演台和提詞機會顯示閃動的橫幅。

## 段落模組

段落模組是負責演出某一段的程式。它的 `id` 就是那一段的 id（或是段落的 `module` 名稱）：

```js
const dusk = {
  id: 'dusk',
  enter(api, ctx)  { api.sky.caption = 'dusk'; },        // the segment began, or a seek landed inside it
  update(api, ctx) { /* every frame, playing or not */ },
  exit(api, ctx)   { api.sky.caption = ''; },            // it ended (after its linger) or a seek left it: give back what you took
  param(key, value, ctx) { return key === 'sun' ? 1 - ctx.p : value; },   // optional: bend a timeline param while this segment is current
  cue(name, ctx)   { /* optional: one of this segment's cues was just passed */ },
  reset(api)       { /* optional: R was pressed; forget everything */ },
};
```

`enter`、`update`、`exit` 的第一個參數是 `api`（你自己給的，見下面），每個鉤子都會收到 `ctx`：

| `ctx` | 意義 |
|---|---|
| `p` | 這一段走了多少，0 到 1。餘韻期間大於 1，hold 時剛好是 1 |
| `t` | 段內第幾秒（`p × dur`） |
| `dt` | 距離上一個影格幾秒 |
| `dur` | 這一段的長度，單位秒 |
| `T` | 演出時間，單位秒 |
| `segment` | 這一段：`id`、`title`、`start`、`end`、`dur`、`cues`、`acts`、`hold`、`linger`、`index` |
| `cue(name)`、`cueT(name)` | cue 的位置，分別以進度和演出秒表示（不認得的名字回 `NaN`） |
| `phase` | `'active'`、`'linger'`，或 `'failed'`（只出現在崩潰後的 `exit()` 裡） |
| `holding`、`held` | 是否正停在 hold，以及已經等了幾秒 |
| `playing` | 時間軸有沒有在跑（不管有沒有在播放，`update` 每個影格都會呼叫） |
| `api` | 同一個 `api` 物件，讓沒有拿到 `api` 參數的 `param()` 和 `cue()` 也碰得到演出 |

- **進一次、出一次。** 演出走進一段，那一段的模組就 enter，離開就 exit，不管是怎麼走過去的。seek 到段落中間，`enter` 收到的 `p` 是正確的值，所以模組要能從中間接上。
- **`linger`。** 段落結束後，它的模組仍會收到 `update()`（此時 `p > 1`、`phase: 'linger'`），直到餘韻結束才 `exit()`。這段時間裡，下一段的模組已經在跑了。
- **`param()`。** 一段（和它的餘韻）進行中，它的模組可以改寫任何一條時間軸參數。回傳數字就取代原值，回傳其他東西就維持原值。表演者的手永遠最大：手動覆寫是在這一層**之後**才套用的。
- **模組丟出錯誤，只停用它自己。** 每個鉤子都在自己的 `try/catch` 裡執行。如果有一個丟出錯誤，導演會對那個模組呼叫一次 `exit()`（`phase: 'failed'`）、印一行 `console.error`，之後不再呼叫它。其他模組和整場演出照常進行。導演台會用紅字警告，寫出模組名稱和錯誤訊息，按 **R**（reset）就能把它叫回來。影格迴圈不准因為房間裡最新、最沒測過的程式壞掉就停下來。

## 導演 Director

```js
import { Director } from '@openav/score';
const director = new Director({ score, modules: [dawn, noon, dusk], api: { sky } });
// every frame, after the timeline advanced:
director.update(timeline.t, dt, { holding: timeline.holding, playing: timeline.playing });
timeline.layer = (key, value, t) => director.param(key, value, t);
timeline.onSeek((t, kind) => (kind === 'reset' ? director.reset() : director.seek(t)));
```

| 選項 | 意義 |
|---|---|
| `score` | 那份 `Score` |
| `modules` | 模組陣列（用 `id` 對應），或是以段落 id 當 key 的物件 |
| `api` | `enter`/`update`/`exit` 的第一個參數（也是 `ctx.api`）。給函式的話，第一次用到時才呼叫一次 |
| `onStatus(status)` | 目前的段落、hold 狀態或被停用的模組清單有變化時才呼叫，不是每個影格 |
| `onCue(cue)` | 播放頭經過每個 cue 時呼叫 |
| `maxStep` | 兩次 `update()` 之間 T 跳超過這麼多秒，就當作 seek，中間的 cue 不會觸發（預設 2）。如果排練時把 `timeline.rate` 開得很高，就把它調大 |

| 成員 | 作用 |
|---|---|
| `update(T, dt, { holding, playing })` | 每個影格一次：進出並更新模組，觸發經過的 cue |
| `param(key, value, T)` | 時間軸的參數層 |
| `seek(T)` | 播放頭跳走了：不再涵蓋 `T` 的段落模組立刻 exit，下一次 `update()` 以正確的 `p` 進入新的段落 |
| `reset()` | 所有正在跑的模組 exit，每個模組收到 `reset(api)`，被停用的模組回來 |
| `status()` | `{ cut, T, total, segment: { index, id, title, note, start, end, dur, t, p, remaining, hold, acts, cues }, next: { id, title, start, in } 或 null, holding, held, active, failed, errors, missing }` |
| `register(module)`、`holding`、`failed` | 之後再加模組、讀取狀態 |

## 搭配 createShow 使用

```js
const show = await createShow({
  world,
  score: { cuts, cut: 'full', modules: [dawn, noon, dusk],
           api: (show) => ({ sky: show.stage.active }),       // what the modules may touch (default: the whole show)
           midi: false },                                      // see "Score to MIDI"
  timeline: { automation: { haze: [[0, 0.1], [60, 0.5]] } },   // optional: written against the base cut
});
```

| `score` 選項 | 意義 |
|---|---|
| `cuts`、`cut` | 所有的 cut，以及預設用哪一個。**網址上的 `?cut=<id>` 優先於 `cut`**，不認得的 id 會警告並忽略 |
| `modules` | 段落模組 |
| `api` | 一個物件，或一個吃 show 的函式，預設是 show 本身 |
| `onStatus`、`onCue`、`maxStep` | 直接交給導演 |
| `midi` | `false`（預設）、`true` 或 `{ channel, segment, cue, … }`：[Score to MIDI](#score-to-midi) |

有總譜的時候，時間軸的場景、總長和起點都從總譜來（你傳的 `timeline.scenes` 或 `timeline.total` 會被忽略），影格迴圈在時間軸前進之後多一步 `director.update(...)`。`createShow` 另外回傳 `show.score`、`show.director`，還有給排練和腳本用的 `show.show`（也就是 `window.openav.show`）：

| `window.openav.show` | |
|---|---|
| `table()` | 用 `console.table` 印出段落表，並回傳這些列 |
| `goto('dusk')`、`goto('dusk.glow')`、`goto(2)` | 跳到某一段、某個 cue，或第幾段 |
| `seek(T)` | 跳到演出秒數 |
| `cue('dusk.glow')` | 回傳這個 cue 的演出秒數（哪裡也不會跳） |
| `status()` | 導演的狀態 |
| `next()`、`prev()` | 和 → 與 ← 一樣 |
| `cuts` | cut 清單 |

## 導演台

有總譜的時候，控台會多出這些：

- **Scrubber。** 段落區塊、每個 cue 一個刻度（點一下就跳過去），以及 hold 段落那條虛線的尾端。
- **導演台面板。** 版本選單（選別的版本會用 `?cut=<id>` 重新載入頁面，不會有切一半的狀態）、目前的段落（有進度條和剩餘時間）、HOLD 橫幅、下一段與倒數、操作者要做的事（**acts**）、這一段的 cue（經過就打勾），以及被停用的模組的紅色警告。
- **提詞機**（**T**）。全螢幕、大字、高對比：段落標題、你要做什麼（`acts`）、剩幾秒、下一段、等待時的 HOLD 橫幅，以及被停用模組的紅字。點一下畫面或再按一次 **T** 離開。只要場景帶有 `acts`，一般的時間軸也能用。

### 按鍵

| 按鍵 | 作用 |
|---|---|
| <kbd>Space</kbd> | 播放／暫停。停在 HOLD 時：放行 |
| <kbd>→</kbd> | 下一段。停在 HOLD 時：放行 |
| <kbd>←</kbd> | 上一段 |
| <kbd>R</kbd> | 回到起點、停止，被停用的模組回來 |
| <kbd>T</kbd> | 提詞機 |
| <kbd>F</kbd> | 全螢幕 |
| <kbd>Esc</kbd> | 結束旋鈕對應精靈，或離開鍵盤鋼琴的捕捉 |

在輸入欄位裡打字、按住不放的連發，以及帶著 ⌘、Ctrl 或 Alt 的按鍵，一律忽略。**螢幕鋼琴捕捉鍵盤的時候**（鋼琴列上的 *keyboard* 勾起來），**字母鍵歸鋼琴**：R、T、F 都沒作用，因為 T 和 F 本來就是琴鍵，而且你正在彈的時候，不小心按到 R 不該把整場演出倒帶。Space、方向鍵和 Esc 永遠有效，所以你可以用同一個鍵盤又彈又控場。MIDI 控制器的 **M** 鍵也照這條規則。

### 依序對應旋鈕

L2 Mapping 面板有一個 **🎛 map knobs in order**。它先替第一個參數啟動 learn，你轉一顆旋鈕就綁上，接著自動換下一個參數。*skip*、*back* 和 *stop*（或按 Esc）可以操控它。learn 永遠是「加入」路由（`Mapper.learn`），所以再跑一次是替參數多綁第二顆旋鈕，原本那顆還在。順序是參數宣告的順序，跳過隱藏的參數。想自己指定順序就用 `mountConsole(el, app, { learnOrder: ['hue', 'size'] })`。邏輯在 `@openav/mapping` 的 `LearnWizard`：

```js
import { LearnWizard } from '@openav/mapping';
const wiz = new LearnWizard({ mapper, keys: () => params.schema.map((p) => p.key), onChange: (w) => draw(w) });
wiz.start(); wiz.current; wiz.skip(); wiz.back(); wiz.stop();
```

## Score to MIDI

要跟著演出走的軟體（每一段啟動一個 clip 的 DAW、要跳場景的燈光台）讀不到總譜，但讀得到 MIDI。`ScoreMidi`（`@openav/midi`）把段落切換和 cue 變成 note 與 CC。它**預設關閉**，要用才開：

```js
score: { cuts, midi: { channel: 15,
                       segment: { note: 36, cc: 20 },                       // segment i → note 36 + i, and CC 20 = i
                       cue: { note: 84, notes: { 'dusk.glow': 90 }, cc: 21 } } }  // a cue → note 84 (or its own note), CC 21 = its number
```

| 選項 | 預設 | 意義 |
|---|---|---|
| `channel` | 15 | MIDI 頻道 1 到 16 |
| `segment` | `{ note: 36 }` | `note`：基準音，送出的音是 `note + index`。`cc`：一個 CC，值就是段落編號。`velocity`。`false` 就不送段落標記 |
| `cue` | `{ note: 84 }` | `note` 是所有 cue 共用的音，`notes: { 'seg.name': note }` 替特定的 cue 指定音，`cc` 的值是這個 cue 在 cut 裡的編號。`false` 就不送 cue 標記 |
| `length` | 0.15 | 標記音的 note-off 在幾秒之後送 |
| `scrub` | `false` | 手動移動播放頭時也送標記。預設只有演出「在播放」（或 hold 被放行）時才送，所以拖動 scrubber 不會讓 DAW 亂觸發 clip |

reset 永遠不送。所有訊息都走 `Midi` 引擎自己的 `noteOn`/`cc`，所以 MIDI OUT 表會看到它們，`panic()` 也關得掉。程式裡這樣用：`new ScoreMidi({ midi, channel, segment, cue })`，再呼叫 `.segment({ index, cause })` 和 `.cue({ name, n })`。

## 為什麼沒有引擎時鐘

如果一場演出同時有兩條時間線（舊邏輯讀的「故事時間」，和觀眾經歷的「演出時間」），就需要替每個引擎說明它跟哪一條走：天氣從不停，城市則在插入的段落播放時暫停。那就是每個引擎一個時鐘。這個框架只有一條時間線，也就是演出的 `T`，沒有東西可以讓時鐘去選，段落模組想讓某個引擎暫停，只要自己不去推進它（`ctx.t` 是它自己的時鐘，`ctx.held` 又是另一個）。如果哪一場真實的演出需要兩條時間線，`clocks` 表就該放進 cut，和 `segments` 並排。在那之前它只是沒有人用的機器。

## 不用 createShow

```js
import { Score, Director } from '@openav/score';
import { Timeline } from '@openav/timeline';

const score = new Score({ cuts, cut: new URLSearchParams(location.search).get('cut') || 'full' });
const timeline = new Timeline({ params, score });                 // scenes, total and start come from the score
const director = new Director({ score, modules, api: { world } });
timeline.layer = (key, value, t) => director.param(key, value, t);
timeline.onSeek((t, kind) => (kind === 'reset' ? director.reset() : director.seek(t)));
const desk = mountConsole(deskEl, { timeline, params, mapper, signals, stage, score, director });

const loop = new Loop((dt) => {
  timeline.advance(dt);
  director.update(timeline.t, dt, { holding: timeline.holding, playing: timeline.playing });
  mapper.update(dt);
  desk.render(stage.frame(dt, timeline.state()));
});
```

## 排練檢查清單

- [ ] `show.show.table()` 印出來的，就是你心裡的演出順序
- [ ] 用 `timeline.rate = 4` 從頭到尾播一次：每個 cue 都響了，沒有模組被停用
- [ ] 每個版本都開 `?cut=` 試一次，確認導演台顯示的總長正確
- [ ] 每個 hold 都按一次 Space、再按一次 →，段落進行中也按一次 R
- [ ] 故意讓一個模組壞掉（在 `update` 裡 throw），看演出照常進行
- [ ] 提詞機（T）從你站的位置看得清楚
