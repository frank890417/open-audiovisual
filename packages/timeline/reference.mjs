// @openav/timeline reference: param automation, scenes and transport. Read by tools/build-reference.mjs (see AGENTS.md, "Documenting a public name").
// The keys are the public names the code has (tools/reference/scan.mjs reads them); a key the code does not have is a red test.

export default {
  Timeline: {
    group: 'timeline',
    summary: {
      en: 'Answers "what is every param at time t?" from keyframes, and runs the transport around it: play, seek, scenes, holds, loops, cues and recording.',
      zh: '用關鍵影格回答「時間 t 的時候，每個參數是多少？」，並在外面包一層播放控制：播放、跳轉、場景、hold、循環、cue 和錄製。',
    },
    params: [
      {
        name: 'params', type: 'Params | Array', optional: false,
        en: 'The [`Params`](#Params) of the show, or a plain schema array. The timeline reads the schema to know which params to resolve. Required.',
        zh: '演出的 [`Params`](#Params)，或一個單純的 schema 陣列。時間軸讀 schema 來知道要解析哪些參數。必填。',
      },
      {
        name: 'automation', type: 'Object', optional: true, default: '{}',
        en: 'The keyframes of each param: `{ hue: [[0, 200], [30, 320, \'ease\'], [60, 40]] }`. A keyframe is `[seconds, value, curve?]`, sorted by time. A param may instead be a lane, an object written per segment: `{ glow: { dawn: [[0, 0.2], [1, 0.9]], noon: 0.4 } }`, where a point is `[p, value, curve?]` and `p` runs from 0 to 1 through that segment. Lanes are turned into seconds when the timeline is built (see [`compileLane()`](#compileLane)).',
        zh: '每個參數的關鍵影格：`{ hue: [[0, 200], [30, 320, \'ease\'], [60, 40]] }`。一個關鍵影格是 `[秒數, 值, 曲線?]`，依時間排序。參數也可以改寫成 lane，也就是按段落寫的物件：`{ glow: { dawn: [[0, 0.2], [1, 0.9]], noon: 0.4 } }`，其中一個點是 `[p, 值, 曲線?]`，`p` 是在那個段落裡從 0 走到 1 的進度。lane 會在時間軸建立的時候換算成秒數（見 [`compileLane()`](#compileLane)）。',
      },
      {
        name: 'scenes', type: 'Array', optional: true, default: '[]',
        en: 'The scenes: `{ id, t, title?, note?, acts?, hold?, cues? }`, sorted by `t`. A negative `t` is a pre-show standby. Ignored when a `score` is given.',
        zh: '場景：`{ id, t, title?, note?, acts?, hold?, cues? }`，依 `t` 排序。`t` 是負的就是開演前的待機。有給 `score` 的時候會被忽略。',
      },
      {
        name: 'total', type: 'Number', optional: true, default: '600',
        en: 'The length of the show in seconds. Playback stops by itself there. (`createShow()` passes 120 unless you say otherwise.) Ignored when a `score` is given.',
        zh: '演出的長度，單位是秒。播放到這裡會自己停下來。（`createShow()` 沒特別指定的時候傳 120。）有給 `score` 的時候會被忽略。',
      },
      {
        name: 'score', type: 'Score | null', optional: true, default: 'null',
        en: 'A [`Score`](#Score): the scenes, the total and the start then come from it, and automation is read at `score.baseTime(t)`, so a derived cut stretches the curves with it.',
        zh: '一份 [`Score`](#Score)：場景、總長和起點都改從它來，自動化曲線讀的是 `score.baseTime(t)`，所以衍生的 cut 會把曲線一起拉伸。',
      },
      {
        name: 'start', type: 'Number | \'first\' | null', optional: true, default: 'null',
        en: 'Where `reset()` goes and where the playhead starts: a number of seconds, or `\'first\'` for the start of the first scene (a standby at −30, say). `null` means 0, or the score\'s start.',
        zh: '`reset()` 要回到哪裡，播放頭一開始也在這裡：一個秒數，或 `\'first\'` 代表第一個場景的起點（例如 −30 的待機）。`null` 表示 0，或總譜的起點。',
      },
      {
        name: 'loop', type: 'Boolean | String | Object', optional: true, default: 'false',
        en: '`true` wraps the show at its end and plays on; `\'scene\'` repeats the scene the playhead is in; a scene id repeats that scene; `{ from, to }` repeats a range (seconds or scene ids). It is a plain property: set `timeline.loop` any time.',
        zh: '`true` 是演出到尾端就繞回去繼續播，`\'scene\'` 是反覆播目前所在的場景，給場景 id 就反覆播那個場景，`{ from, to }` 反覆播一段範圍（秒數或場景 id）。它是個普通屬性，隨時可以設定 `timeline.loop`。',
      },
      {
        name: 'onCue', type: 'Function | null', optional: true, default: 'null',
        en: 'The same as calling `timeline.onCue(cb)` once: `cb(cue, { cause })`.',
        zh: '等於呼叫一次 `timeline.onCue(cb)`：`cb(cue, { cause })`。',
      },
      {
        name: 'anchor', type: 'Boolean | Number | Date | String | Object | null', optional: true, default: 'null',
        en: 'The same as calling `timeline.anchor()` once. `true` measures against the wall clock from the first playing frame; a number of milliseconds (`0` included), a `Date` or an ISO date string is the wall-clock moment of show time 0; an object is `{ epoch, mode, tolerance, warnAt, jump, wait, stall, now, onDrift }`. `null`, `false` and `\'\'` mean no anchor.',
        zh: '等於呼叫一次 `timeline.anchor()`。`true` 是從第一個播放中的影格開始對牆鐘計帳。毫秒數（包括 `0`）、`Date` 或 ISO 日期字串，是演出時間 0 對應的牆鐘時刻。物件則是 `{ epoch, mode, tolerance, warnAt, jump, wait, stall, now, onDrift }`。`null`、`false` 和 `\'\'` 是不錨定。',
      },
    ],
    description: [
      {
        en: '`timeline.state(t)` returns `{ key: value }` for every param at time `t`, interpolated from `automation`. That is the whole job: the timeline owns time, and a world never reads the clock. In a show, [`createShow()`](#createShow) builds the timeline from its `timeline` option, [`Loop`](#Loop) calls `advance(dt)` every frame, and what `state()` returns goes into [`params.resolve()`](#Params), where a hand or a knob that has overridden a param still wins.',
        zh: '`timeline.state(t)` 回傳時間 `t` 的時候每個參數的 `{ key: value }`，由 `automation` 內插得來。它的工作就這一件：時間歸時間軸管，世界從來不讀時鐘。在演出裡，[`createShow()`](#createShow) 依 `timeline` 選項建好時間軸，[`Loop`](#Loop) 每個畫面呼叫 `advance(dt)`，`state()` 的結果再交給 [`params.resolve()`](#Params)，被手或旋鈕覆寫的參數仍然以覆寫為準。',
      },
      {
        en: 'Between two keyframes the value moves in a straight line. The optional third item of a keyframe says how the segment that **ends** at that keyframe gets there: `\'linear\'`, `\'ease\'`, `\'in\'`, `\'out\'`, `\'step\'`, or your own function of 0..1 (see [`CURVES`](#CURVES)). Before the first keyframe the value is the first one, after the last it is the last one, and a param with no keyframes stays at its `def`. A param declared with `step` holds each keyframe instead of interpolating.',
        zh: '兩個關鍵影格之間，值走直線。關鍵影格選填的第三項，說的是「**抵達**這個影格的那一段」怎麼走：`\'linear\'`、`\'ease\'`、`\'in\'`、`\'out\'`、`\'step\'`，或你自己寫的 0..1 函式（見 [`CURVES`](#CURVES)）。第一個影格之前，值就是第一個影格的值。最後一個影格之後，就是最後一個的值。沒有任何關鍵影格的參數維持在 `def`。宣告了 `step` 的參數會停在每個關鍵影格，不做內插。',
      },
      {
        en: 'Scenes give the show its shape: `{ id: \'storm\', t: 90, title: \'Storm\', note: \'clusters welcome\' }`. `onSceneChange` is the hook to fire sound, lights or prompts, and the console shows the title and note to the performer. A scene with `hold: true` stops playback at its end until someone calls `release()`. Scene `cues` are `{ name, t }` with `t` in show seconds (not seconds into the scene), and they fire only when **playback** passes them: a seek, a jump or a reset never does.',
        zh: '場景給了演出一個結構：`{ id: \'storm\', t: 90, title: \'Storm\', note: \'clusters welcome\' }`。`onSceneChange` 是用來觸發聲音、燈光或提詞的掛鉤，主控台會把標題和備註顯示給表演者。`hold: true` 的場景，播放到它的尾端就停住，直到有人呼叫 `release()`。場景的 `cues` 是 `{ name, t }`，`t` 是演出秒數（不是場景內的第幾秒），而且只有**播放**經過它們的時候才會觸發：seek、跳轉或 reset 都不會。',
      },
      {
        en: 'A **lane** writes a param per segment instead of in seconds. The segments are those of the score\'s root cut, or the scenes when there is no score (a scene lasts until the next one starts). A point `[p, value, curve?]` is the keyframe at `segment start + p × segment length`; a bare number holds that value for the whole segment; `null` leaves the segment unwritten. A lane names segments, so a cut with other lengths reads it the same way. A lane that names a segment only another cut has is skipped for that segment, and one that names a segment no cut has throws (most likely a typo). `exportAutomation()` and `importAutomation()` move automation in and out as JSON, in seconds or per segment.',
        zh: '**lane** 是按段落寫參數，不是按秒數。段落指的是總譜 root cut 的段落，沒有總譜的話就是場景（一個場景持續到下一個場景開始為止）。一個點 `[p, 值, 曲線?]` 就是位在「段首 + p × 段長」的關鍵影格。只寫一個數字，表示整段維持這個值。`null` 表示這一段不寫。lane 用段落的名字來寫，所以長度不同的 cut 讀起來是同一個意思。lane 寫到「這個 cut 沒有、別的 cut 有」的段落，那一段會被略過。寫到所有 cut 都沒有的段落就丟出錯誤（多半是打錯字）。`exportAutomation()` 和 `importAutomation()` 把自動化曲線以 JSON 匯出、匯入，可以用秒數，也可以按段落。',
      },
      {
        en: 'Two optional clocks, and nothing changes unless you call them. `anchor()` reads the wall clock: [`Loop`](#Loop) clamps every `dt` to 0.1 s, so over a long show the playhead falls behind real time, and `drift()` counts by how much. In the mode `\'warn\'` it only counts and warns; in `\'catch-up\'` it gives the lost time back. `follow()` makes the timeline chase another timeline\'s clock, for several pages that perform one show: it nudges its rate when it is close, seeks when it is far, copies the leader\'s pause and hold, and runs on alone when the leader goes silent. The wire between the pages is [`createSync()`](#createSync).',
        zh: '還有兩個選用的時鐘，不呼叫就什麼都不會變。`anchor()` 會去讀牆鐘：[`Loop`](#Loop) 把每個 `dt` 夾在 0.1 秒以內，所以演出一長，播放頭就會慢於真實時間，`drift()` 會算出慢了多少。`\'warn\'` 模式只計數和警告，`\'catch-up\'` 模式會把欠的時間追回來。`follow()` 讓時間軸去追另一條時間軸的時鐘，給好幾個頁面演同一場用：差得少就微調 rate，差得多就 seek，主控端暫停或停在 hold 它也跟著，主控端沒聲音了就自己往前走。頁面之間的傳輸是 [`createSync()`](#createSync)。',
      },
    ],
    needs: {
      en: 'Time only moves when you call `play()` and then `advance(dt)` every frame (a show does this for you). `state(t)` and `valueAt(key, t)` work at any moment, playing or not. The callbacks do not fire for the starting scene until the first `advance()` or `seek()`.',
      zh: '時間只在你呼叫 `play()`、並且每個畫面呼叫 `advance(dt)` 的時候才會往前走（演出會替你做）。`state(t)` 和 `valueAt(key, t)` 隨時都能用，不論有沒有在播放。起始場景的回呼，要等到第一次 `advance()` 或 `seek()` 才會觸發。',
    },
    members: {
      valueAt: {
        en: 'One param at time `t` (default: now): the automation value with the curves applied, before the `layer` and before any override.',
        zh: '一個參數在時間 `t`（預設是現在）的值：套用曲線之後的自動化數值，還沒經過 `layer`，也還沒套用覆寫。',
      },
      state: {
        en: 'Every param at time `t` as `{ key: value }`. This is the base state that `params.resolve()` then lets overrides win over. If `layer` is set, each value passes through it.',
        zh: '時間 `t` 的所有參數，格式是 `{ key: value }`。這是基準狀態，`params.resolve()` 之後會讓覆寫值蓋過它。如果設了 `layer`，每個值都會先經過它。',
      },
      sceneIndexAt: {
        en: 'The index of the scene that contains time `t` (the first scene before any scene starts).',
        zh: '包含時間 `t` 的那個場景的索引（所有場景都還沒開始時是第一個）。',
      },
      sceneEnd: {
        en: 'The end of scene `i` in seconds: the start of the next scene, or `total` for the last one.',
        zh: '第 `i` 個場景的結束時間（秒）：下一個場景的開頭，最後一個場景則是 `total`。',
      },
      currentScene: {
        en: 'The scene object that contains time `t` (default: now).',
        zh: '包含時間 `t`（預設是現在）的那個場景物件。',
      },
      onSceneChange: {
        en: 'Register `cb(index, scene, { cause })`, called when the playhead lands in a different scene. `cause` is `\'play\'`, `\'release\'`, `\'seek\'`, `\'jump\'`, `\'reset\'` or `\'loop\'`. There is no way to remove it again.',
        zh: '登記 `cb(index, scene, { cause })`，播放頭落進另一個場景時呼叫。`cause` 是 `\'play\'`、`\'release\'`、`\'seek\'`、`\'jump\'`、`\'reset\'` 或 `\'loop\'`。登記之後沒辦法取消。',
      },
      onSeek: {
        en: 'Register `cb(t, kind)`, called when the playhead is moved by hand: `kind` is `\'seek\'`, `\'jump\'` or `\'reset\'`. Never called while playing.',
        zh: '登記 `cb(t, kind)`，播放頭被手動移動時呼叫：`kind` 是 `\'seek\'`、`\'jump\'` 或 `\'reset\'`。播放中不會呼叫。',
      },
      play: {
        en: 'Start playing. Parked at a hold? Then this releases it instead.',
        zh: '開始播放。如果停在 hold 上，這會改成放行。',
      },
      pause: {
        en: 'Stop playing and close any take being recorded.',
        zh: '停止播放，並把正在錄的片段收尾。',
      },
      toggle: {
        en: 'Play if paused, pause if playing (at a hold: release). Returns whether it is playing now.',
        zh: '暫停中就播放，播放中就暫停（在 hold 上則是放行）。回傳現在是不是在播放。',
      },
      seek: {
        en: 'Move the playhead to `t`, held between the first scene\'s start (when negative) or 0, and `total`. Leaving a hold this way releases it. `cause` (default `\'seek\'`) is what `onSceneChange` and `onSeek` report. A seek never fires cues.',
        zh: '把播放頭移到 `t`，範圍限制在第一個場景的起點（為負時）或 0，到 `total` 之間。用這個方式離開 hold 就等於放行。`cause`（預設 `\'seek\'`）是 `onSceneChange` 和 `onSeek` 收到的原因。seek 不會觸發 cue。',
      },
      jumpScene: {
        en: 'Go to the start of the scene `d` steps away (`1` next, `-1` previous), stopping at the first and last. It is a seek with the cause `\'jump\'`.',
        zh: '跳到相隔 `d` 個場景的那個場景的開頭（`1` 是下一個，`-1` 是上一個），到第一個或最後一個就停住。它是原因為 `\'jump\'` 的 seek。',
      },
      next: {
        en: 'The → key: release a hold and keep playing, otherwise jump to the next scene.',
        zh: '→ 鍵：停在 hold 上就放行並繼續播放，否則跳到下一個場景。',
      },
      prev: {
        en: 'The ← key: jump to the previous scene.',
        zh: '← 鍵：跳到上一個場景。',
      },
      release: {
        en: 'Let a hold go: the next scene starts now and playback continues. Returns `false` when nothing was holding.',
        zh: '讓 hold 放行：下一個場景立刻開始，播放繼續。如果本來就沒有停住，回傳 `false`。',
      },
      reset: {
        en: 'Back to the start (`start`, default 0): stopped, not holding, loop count cleared.',
        zh: '回到起點（`start`，預設 0）：停止播放、不在 hold、循環次數歸零。',
      },
      advance: {
        en: 'Call once per frame with the seconds that passed. Moves `t` by `dt × rate` while playing, parks at a hold, wraps a loop, stops at `total`, and fires scene changes and cues on the way. Returns whether it is still playing. With `anchor()` it also reads the wall clock; with `follow()` it follows the leader\'s clock instead.',
        zh: '每個畫面呼叫一次，傳入經過的秒數。播放中會讓 `t` 前進 `dt × rate`，遇到 hold 就停住，遇到循環就繞回去，到 `total` 就停下來，途中會觸發場景改變和 cue。回傳是否仍在播放。有 `anchor()` 的時候它還會讀牆鐘，有 `follow()` 的時候改成追主控端的時鐘。',
      },
      loopRange: {
        en: 'The range being looped at time `t`, as `{ a, b }` in seconds, or `null` when `loop` is off or empty.',
        zh: '時間 `t` 所在的循環範圍，格式是秒數的 `{ a, b }`。`loop` 關著或範圍是空的時候回傳 `null`。',
      },
      onLoop: {
        en: 'Register `cb({ t, from, to, count })`, called each time the playhead wraps round the loop.',
        zh: '登記 `cb({ t, from, to, count })`，播放頭每次繞回循環的起點時呼叫。',
      },
      cues: {
        en: 'Every cue of every scene in time order, as `{ …cue, scene: sceneId, sceneIndex }`.',
        zh: '所有場景的所有 cue，依時間排序，格式是 `{ …cue, scene: sceneId, sceneIndex }`。',
      },
      onCue: {
        en: 'Register `cb(cue, { cause })`, called when playback passes a scene cue (`cause` `\'play\'`) or `fireCue()` sets one off (`\'manual\'`).',
        zh: '登記 `cb(cue, { cause })`，播放經過場景 cue 的時候（`cause` 是 `\'play\'`），或 `fireCue()` 手動觸發的時候（`\'manual\'`）呼叫。',
      },
      fireCue: {
        en: 'Set a cue off by hand (the scrubber\'s ◆ click). Takes an item of `cues()` or any `{ name, t }`.',
        zh: '手動觸發一個 cue（點 scrubber 上的 ◆）。接受 `cues()` 的一個項目，或任何 `{ name, t }`。',
      },
      record: {
        en: 'Arm a lane: while the timeline plays, whatever `source()` returns is written into `automation[key]` as keyframes. `source` returns a number while someone is touching the control and `null` when not; that closes the take. Throws for an unknown key or a `source` that is not a function. Returns the recorder (`{ key, take, active, commit(), stop() }`).',
        zh: '備好一條錄製軌：時間軸播放的時候，`source()` 回傳的值會被當成關鍵影格寫進 `automation[key]`。有人正在碰控制項時 `source` 回傳數字，沒有人碰時回傳 `null`，這會讓片段收尾。key 不認識、或 `source` 不是函式會丟出錯誤。回傳錄製器（`{ key, take, active, commit(), stop() }`）。',
      },
      recording: {
        en: 'Whether any lane is armed.',
        zh: '有沒有任何一條錄製軌處於備好的狀態。',
      },
      stopRecording: {
        en: 'Close every armed recorder, committing what each holds.',
        zh: '把所有備好的錄製器都關掉，並把它們手上的內容寫進去。',
      },
      onRecord: {
        en: 'Register `cb({ key, from, to, count, cause, keyframes })`, called when a take closes. `count` 0 means it was too short to keep.',
        zh: '登記 `cb({ key, from, to, count, cause, keyframes })`，片段收尾時呼叫。`count` 是 0 表示太短，沒有保留。',
      },
      lanePlan: {
        en: 'The segments that lanes are written against, as a new array of `{ id, start, end, dur }` in automation seconds: the score\'s root cut, or the scenes without a score.',
        zh: 'lane 對照的段落表，每次都是新的陣列，內容是 `{ id, start, end, dur }`，單位是自動化的秒數：有總譜就是它的 root cut，沒有就是場景。',
      },
      lanePos: {
        en: 'Which segment the automation second `t` is in and how far through it: `{ id, index, p }`, or `null` outside the show. See [`lanePos()`](#lanePos).',
        zh: '自動化的第 `t` 秒落在哪一段、走了多少：`{ id, index, p }`，演出之外是 `null`。見 [`lanePos()`](#lanePos)。',
      },
      laneTime: {
        en: 'The inverse of `lanePos`: the automation second of progress `p` (default 0) through segment `id`. `NaN` when there is no such segment.',
        zh: '`lanePos` 的反函數：第 `id` 段走到 `p`（預設 0）是自動化的第幾秒。沒有這個段落就是 `NaN`。',
      },
      lanes: {
        en: 'The automation rewritten as lanes: `{ key: { segmentId: [[p, value, curve?], …] } }`. `keys` defaults to every param that has keyframes; `{ precision }` is the number of decimals `p` is rounded to. Throws a `RangeError` for a keyframe outside the show.',
        zh: '把自動化曲線改寫成 lane：`{ key: { 段落 id: [[p, 值, 曲線?], …] } }`。`keys` 預設是所有有關鍵影格的參數，`{ precision }` 是 `p` 要四捨五入到小數第幾位。關鍵影格落在演出之外會丟出 `RangeError`。',
      },
      exportAutomation: {
        en: 'A copy of the automation that survives `JSON.stringify`: `{ format: \'openav-automation\', version: 1, cut, as, automation }`. `{ as: \'seconds\' }` (the default) writes keyframes in the root cut\'s seconds; `{ as: \'segments\' }` writes lanes, which also fit a cut with other lengths. `cut` is the root cut\'s id, or `null` without a score. `{ keys }` picks the params. A keyframe whose curve is a function throws: JSON cannot hold it.',
        zh: '一份通得過 `JSON.stringify` 的自動化曲線拷貝：`{ format: \'openav-automation\', version: 1, cut, as, automation }`。`{ as: \'seconds\' }`（預設）寫的是 root cut 秒數的關鍵影格，`{ as: \'segments\' }` 寫的是 lane，換了長度的 cut 也能用。`cut` 是 root cut 的 id，沒有總譜就是 `null`。`{ keys }` 可以挑參數。曲線是函式的關鍵影格會丟出錯誤，因為 JSON 裝不下它。',
      },
      importAutomation: {
        en: 'Read what `exportAutomation()` wrote (an object or a JSON string), or a bare `{ key: keyframes | lane }`. Returns the keys it imported. Only the keys in the file are replaced (`{ keys }` narrows them, `{ replace: true }` also removes the keys the file does not mention). All or nothing: if one key is bad, it throws and nothing changes. Keyframes in seconds written against another root cut throw unless `{ ignoreCut: true }`; lanes are not affected.',
        zh: '讀進 `exportAutomation()` 寫出來的東西（物件或 JSON 字串），或是一張單純的 `{ key: 關鍵影格 | lane }`。回傳匯入了哪些 key。只會換掉檔案裡有的 key（`{ keys }` 可以再挑，`{ replace: true }` 連檔案沒提到的 key 也清掉）。全有或全無：只要有一個 key 是壞的就丟出錯誤，什麼都不會變。對著另一個 root cut 寫的秒數關鍵影格會丟出錯誤，除非給 `{ ignoreCut: true }`。lane 不受影響。',
      },
      anchor: {
        en: '`anchor(epoch?, opts?)`: start keeping accounts against the wall clock; calling it again starts over. `epoch` is the wall-clock moment of show time 0 (milliseconds, a `Date` or an ISO string); without it the first playing frame is zero and the timeline only measures. `opts.mode` is `\'warn\'` (default: count, and report once when more than `warnAt` seconds behind) or `\'catch-up\'` (add what is owed to the frame\'s step, so cues, holds and loops behave as usual; seek when more than `jump` seconds behind; wait for an `epoch` in the future). Defaults: `tolerance` 0.05, `warnAt` 1, `jump` 10, `wait` true, `stall` 0.02 (seconds), `now` `Date.now`. Returns the timeline.',
        zh: '`anchor(epoch?, opts?)`：開始對牆鐘計帳，再呼叫一次就重來。`epoch` 是演出時間 0 對應的牆鐘時刻（毫秒、`Date` 或 ISO 字串）。不給的話，以第一個播放中的影格為零點，時間軸只量不對時。`opts.mode` 是 `\'warn\'`（預設：只計數，慢超過 `warnAt` 秒通知一次）或 `\'catch-up\'`（把欠的加進這一個影格的步長，所以 cue、hold、循環都照常。慢超過 `jump` 秒就直接 seek。`epoch` 在未來就等到那一刻）。預設值：`tolerance` 0.05、`warnAt` 1、`jump` 10、`wait` true、`stall` 0.02（單位都是秒）、`now` 是 `Date.now`。回傳時間軸本身。',
      },
      unanchor: {
        en: 'Stop keeping accounts against the wall clock. The counts are dropped; callbacks registered with `onDrift()` stay.',
        zh: '不再對牆鐘計帳。計數丟掉，用 `onDrift()` 登記的回呼留著。',
      },
      onDrift: {
        en: 'Register `cb(e)`, where `e` is `{ kind, …drift() }` and `kind` is `\'behind\'` (more than `warnAt` behind), `\'recovered\'` (back under half of it) or `\'jump\'` (catch-up made up the difference with a seek). With nobody listening, `\'behind\'` is a `console.warn`.',
        zh: '登記 `cb(e)`，`e` 是 `{ kind, …drift() }`，`kind` 是 `\'behind\'`（慢超過 `warnAt`）、`\'recovered\'`（降回它的一半以下）或 `\'jump\'`（catch-up 用 seek 補上差額）。沒有人接的時候，`\'behind\'` 會變成 `console.warn`。',
      },
      drift: {
        en: 'The drift and its counts, or `null` when not anchored. In show seconds: `behind` (negative means ahead), `lost`, `repaid`, `held`, `forgiven`. Also `stalls`, `worst` (the longest wall-clock gap between frames), `frames`, `jumps`, `started`, `waiting`, `startsIn`, `epoch`, `mode`, `expected`, `shown`, and `text`, a one-line summary. A pause, a hold and the end of the show are not drift: what was owed at that moment is forgiven.',
        zh: '目前的漂移和計數，沒有錨定就是 `null`。以演出秒數計的有 `behind`（負數表示超前）、`lost`、`repaid`、`held`、`forgiven`。另外還有 `stalls`、`worst`（兩個影格之間最長的牆鐘間隔）、`frames`、`jumps`、`started`、`waiting`、`startsIn`、`epoch`、`mode`、`expected`、`shown`，以及一行摘要 `text`。暫停、hold 和演出結束都不算漂移，停下來那一刻欠的帳一筆勾銷。',
      },
      follow: {
        en: '`follow(source, opts?)`: chase another timeline\'s clock. `source` is a function that returns the leader\'s last frame `{ T, playing, holding, rate, at }` (or `null` before any arrived), or an object with `latest()` such as a [`SyncFollower`](#SyncFollower). Options and defaults: `nudge` 0.05 (how far the rate may move from the leader\'s), `deadband` 1/60 s, `jump` 0.5 s (further off than this: seek), `lostAfter` 4 s, `latency` 0 (seconds, or a function), `now` (milliseconds, the clock that stamped `at`), `onFollow`. While following, your own `play()`, `pause()`, `seek()` and `rate` are overwritten by the next frame, and `anchor()` stands aside. Returns the timeline.',
        zh: '`follow(source, opts?)`：去追另一條時間軸的時鐘。`source` 是一個函式，回傳主控端最後一則 frame `{ T, playing, holding, rate, at }`（還沒收到就回 `null`），或是一個有 `latest()` 的物件，例如 [`SyncFollower`](#SyncFollower)。選項與預設值：`nudge` 0.05（rate 最多偏離主控端多少）、`deadband` 1/60 秒、`jump` 0.5 秒（差超過這麼多就 seek）、`lostAfter` 4 秒、`latency` 0（秒數，或一個函式）、`now`（毫秒，就是蓋 `at` 用的那個鐘）、`onFollow`。在追的時候，你自己的 `play()`、`pause()`、`seek()` 和 `rate` 會被下一幀蓋掉，`anchor()` 也暫時不作用。回傳時間軸本身。',
      },
      unfollow: {
        en: 'Stop following: `rate` goes back to what it was before `follow()`, and the timeline walks by itself again. Callbacks registered with `onFollow()` stay.',
        zh: '不再追：`rate` 還原成 `follow()` 之前的值，時間軸又是自己往前走。用 `onFollow()` 登記的回呼留著。',
      },
      following: {
        en: 'Whether the timeline is following another clock (a getter).',
        zh: '時間軸是不是正在追另一個時鐘（getter）。',
      },
      onFollow: {
        en: 'Register `cb(e)`, where `e` is `{ kind, …followStatus() }` and `kind` is `\'found\'` (the leader was heard for the first time, or came back), `\'lost\'` (silent for `lostAfter` seconds: running alone) or `\'jump\'` (too far off: it seeked; `e.by` is the difference). With nobody listening, `\'lost\'` is a `console.warn`.',
        zh: '登記 `cb(e)`，`e` 是 `{ kind, …followStatus() }`，`kind` 是 `\'found\'`（第一次聽到主控端，或它回來了）、`\'lost\'`（`lostAfter` 秒沒聲音，自己往前走了）或 `\'jump\'`（差太多，seek 過去了，`e.by` 是差額）。沒有人接的時候，`\'lost\'` 會變成 `console.warn`。',
      },
      followStatus: {
        en: 'How following is going, or `null` when not following: `state` (`\'waiting\'`, `\'tracking\'` or `\'lost\'`), `error` (the leader\'s `T` minus ours in seconds; positive means we are behind), `worst`, `jumps`, `silence`, `lost`, `lostCount`, `lostAfter`, `heard`, `frames`, `nudging` (−1, 0 or 1), `rate`, `leaderRate`, `leaderT`, `leaderPlaying`, `leaderHolding`, and `text`, a one-line summary. The numbers are those of the last frame.',
        zh: '目前追的情形，沒有在追就是 `null`：`state`（`\'waiting\'`、`\'tracking\'` 或 `\'lost\'`）、`error`（主控端的 `T` 減我們的，單位是秒，正數表示我們落後）、`worst`、`jumps`、`silence`、`lost`、`lostCount`、`lostAfter`、`heard`、`frames`、`nudging`（−1、0 或 1）、`rate`、`leaderRate`、`leaderT`、`leaderPlaying`、`leaderHolding`，以及一行摘要 `text`。數字是最後一幀的。',
      },
      mergeTake: {
        en: 'Write a take (an array of `[t, value]`) into `automation[key]`: thin it, replace the keyframes inside its time span, keep the ones outside. Returns `{ from, to, count }`, or `null` for fewer than two points.',
        zh: '把一段錄好的片段（`[t, value]` 的陣列）寫進 `automation[key]`：先精簡，再取代它時間範圍內的關鍵影格，範圍外的保留。回傳 `{ from, to, count }`，少於兩個點則回傳 `null`。',
      },
    },
    notes: [
      {
        en: 'These are plain fields you can read and set: `t`, `playing`, `holding`, `rate` (1 is real time; 4 rehearses at four times the speed), `total`, `start`, `scenes`, `automation`, `score`, `loop`, `loops` (laps since the last reset), and `layer`.',
        zh: '這些是可以直接讀、也可以直接設定的普通欄位：`t`、`playing`、`holding`、`rate`（1 是真實速度，4 是四倍速排練）、`total`、`start`、`scenes`、`automation`、`score`、`loop`、`loops`（上次 reset 以來繞了幾圈）和 `layer`。',
      },
      {
        en: '`layer` is `(key, value, t) => value`. A [`Director`](#Director) plugs in here so segment modules can bend a param; the performer\'s override is still applied afterwards and wins.',
        zh: '`layer` 是 `(key, value, t) => value`。[`Director`](#Director) 會接在這裡，讓段落模組可以改動參數，表演者的覆寫之後才套用，所以仍然以覆寫為準。',
      },
      {
        en: 'When `automation` holds a lane, `timeline.automation` is a new object with every lane already turned into keyframes in seconds; when it holds none, it is the very object you passed in.',
        zh: '`automation` 裡有 lane 的時候，`timeline.automation` 是一個新物件，每條 lane 都已經換算成秒數的關鍵影格。一條 lane 都沒有的時候，它就是你傳進來的那個物件。',
      },
      {
        en: 'When you drive the timeline from a manual or test loop, pass the same fake clock as `now` to `anchor()` and `follow()`: otherwise they measure real time.',
        zh: '用手動或測試用的迴圈推時間軸的時候，要把同一個假時鐘當成 `now` 傳給 `anchor()` 和 `follow()`，不然它們量的是真實時間。',
      },
      {
        en: 'With a `score`, anything you pass as `scenes` or `total` is ignored, and `reset()` goes to the score\'s start.',
        zh: '有 `score` 的時候，你傳的 `scenes` 和 `total` 都會被忽略，`reset()` 回到的是總譜的起點。',
      },
    ],
    examples: [
      {
        code: `import { Params } from '@openav/core';
import { Timeline } from '@openav/timeline';

const params = new Params([{ key: 'hue', min: 0, max: 360, def: 200 }]);
const timeline = new Timeline({
  params,
  total: 60,
  automation: { hue: [[0, 200], [30, 320], [60, 40, 'ease']] },
});
for (const t of [0, 15, 30, 45]) console.log(t, timeline.state(t).hue);`,
        caption: { en: 'The console prints the hue at four moments: `0 200`, `15 260`, `30 320`, `45 180`. Nothing plays; `state(t)` just looks the answer up.', zh: '主控台印出四個時刻的色相：`0 200`、`15 260`、`30 320`、`45 180`。什麼都沒有在播放，`state(t)` 只是把答案查出來。' },
      },
      {
        code: `import { Params } from '@openav/core';
import { Timeline } from '@openav/timeline';

const params = new Params([{ key: 'energy', min: 0, max: 1, def: 0.2 }]);
const timeline = new Timeline({
  params,
  total: 20,
  scenes: [
    { id: 'standby', t: 0, hold: true },
    { id: 'go', t: 6, cues: [{ name: 'flash', t: 10 }] },
  ],
});
timeline.onSceneChange((i, scene, { cause }) => console.log('scene', scene.id, cause));
timeline.onCue((cue) => console.log('cue', cue.name, 'at', cue.t));

timeline.play();
for (let i = 0; i < 8; i++) timeline.advance(1);   // one second per call
console.log('holding:', timeline.holding, 'at', timeline.t.toFixed(3));
timeline.release();                                  // the operator says go
for (let i = 0; i < 6; i++) timeline.advance(1);`,
        caption: { en: 'The console prints `scene standby play`, then `holding: true at 6.000` (the show waits at the end of the standby), then `scene go release`, then `cue flash at 10`.', zh: '主控台依序印出 `scene standby play`、`holding: true at 6.000`（演出停在待機場景的尾端等候），然後是 `scene go release`，最後是 `cue flash at 10`。' },
      },
      {
        code: `import { Params } from '@openav/core';
import { Timeline } from '@openav/timeline';

const params = new Params([{ key: 'hue', min: 0, max: 360, def: 100 }]);
const timeline = new Timeline({ params, total: 30, automation: { hue: [[0, 100], [30, 100]] } });

let knob = null;                                  // a number while a hand holds the knob
timeline.record('hue', () => knob);
timeline.onRecord((take) => console.log('take', take.from, 'to', take.to, take.cause));

timeline.play();
for (let i = 0; i < 20; i++) {
  knob = i >= 5 && i < 12 ? 100 + (i - 5) * 20 : null;   // turned from second 5 to 11
  timeline.advance(1);
}
console.log(JSON.stringify(timeline.automation.hue));`,
        caption: { en: 'The knob turns for seven seconds; the console prints `take 6 to 12 release`, then the new keyframes: the take replaced the middle of the curve and the old ends stayed.', zh: '旋鈕轉了七秒，主控台印出 `take 6 to 12 release`，接著是新的關鍵影格：這段錄製取代了曲線的中段，原本的兩端保留下來。' },
      },
      {
        code: `import { Params } from '@openav/core';
import { Timeline } from '@openav/timeline';

const params = new Params([{ key: 'glow', min: 0, max: 1, def: 0 }]);
const timeline = new Timeline({
  params,
  total: 60,
  scenes: [{ id: 'dawn', t: 0 }, { id: 'noon', t: 20 }],
  automation: { glow: { dawn: [[0, 0.2], [1, 0.9]], noon: 0.4 } },   // a lane: written per scene, p from 0 to 1
});
console.log(JSON.stringify(timeline.automation.glow));
console.log(timeline.valueAt('glow', 10), timeline.valueAt('glow', 30));
console.log(JSON.stringify(timeline.exportAutomation({ as: 'segments' }).automation));`,
        caption: { en: 'A lane becomes keyframes in seconds: the console prints `[[0,0.2],[20,0.9],[20,0.4],[60,0.4]]` (two keyframes on second 20 are a jump), then `0.55 0.4`, then the same automation written per scene again: `{"glow":{"dawn":[[0,0.2],[1,0.9]],"noon":[[0,0.4],[1,0.4]]}}`.', zh: 'lane 變成秒數的關鍵影格：主控台印出 `[[0,0.2],[20,0.9],[20,0.4],[60,0.4]]`（第 20 秒有兩個關鍵影格，就是一次跳變），接著是 `0.55 0.4`，最後是同一份自動化曲線再寫回按場景的樣子：`{"glow":{"dawn":[[0,0.2],[1,0.9]],"noon":[[0,0.4],[1,0.4]]}}`。' },
      },
    ],
    related: ['Params', 'Loop', 'Score', 'Director', 'CURVES', 'HOLD_EPS', 'compileLane', 'decompileLane', 'lanePos', 'AUTOMATION_FORMAT', 'createSync', 'createShow', 'mountConsole'],
    keywords: {
      en: ['timeline', 'automation', 'keyframe', 'keyframes', 'scene', 'scenes', 'cue', 'hold', 'loop', 'seek', 'play', 'transport', 'record', 'state', 'playhead', 'lane', 'lanes', 'export', 'import', 'anchor', 'wall clock', 'drift', 'follow', 'leader', 'follower'],
      zh: ['時間軸', '自動化', '關鍵影格', '場景', 'cue', 'hold', '循環', '跳轉', '播放', '播放頭', '錄製', '曲線', 'lane', '段落', '匯出', '匯入', '牆鐘', '漂移', '錨定', '主控端', '從屬端'],
    },
  },

  CURVES: {
    group: 'timeline',
    summary: {
      en: 'The curve names a keyframe can use to say how its segment gets there: `linear`, `ease`, `in`, `out`, `step`, each a function from 0..1 to 0..1.',
      zh: '關鍵影格可以用來說明「這一段怎麼抵達」的曲線名稱：`linear`、`ease`、`in`、`out`、`step`，每個都是 0..1 對應到 0..1 的函式。',
    },
    description: [
      {
        en: 'In a [`Timeline`](#Timeline), the third item of a keyframe names the curve of the segment that **ends** at that keyframe: `[30, 320, \'ease\']` means "arrive at 320 at second 30 the `ease` way". `linear` is the default, and an unknown name or a typo also falls back to `linear`, so a mistake never stops a show. You can pass your own function instead of a name.',
        zh: '在 [`Timeline`](#Timeline) 裡，關鍵影格的第三項是「**抵達**這個影格的那一段」的曲線名稱：`[30, 320, \'ease\']` 的意思是「用 `ease` 的方式，在第 30 秒抵達 320」。預設是 `linear`，名稱不認得或打錯也會退回 `linear`，所以打錯字不會讓演出停下來。你也可以傳自己的函式，不用名稱。',
      },
      {
        en: '`linear` goes straight. `ease` is a smoothstep: slow, fast, slow. `in` starts slowly (f²). `out` starts fast and lands softly (1 − (1 − f)²). `step` is special: the segment holds the **old** value until the keyframe, then jumps. The `step` function stored here returns 0 and is never called to interpolate; it is listed so that the object is the whole vocabulary.',
        zh: '`linear` 走直線。`ease` 是 smoothstep：慢、快、慢。`in` 起頭慢（f²）。`out` 起頭快、輕輕落地（1 − (1 − f)²）。`step` 比較特別：這一段會一直守著**舊**值，到了關鍵影格才跳過去。放在這裡的 `step` 函式永遠回傳 0，內插的時候不會用它來算，列在這裡只是為了讓這個物件涵蓋整套名稱。',
      },
      {
        en: 'A param declared with `step` in its [`Params`](#Params) schema holds each keyframe whatever curve you name.',
        zh: '在 [`Params`](#Params) 的 schema 裡宣告了 `step` 的參數，不管你寫哪種曲線，都會停在每個關鍵影格。',
      },
    ],
    examples: [
      {
        code: `import { CURVES } from '@openav/timeline';

for (const name of ['linear', 'ease', 'in', 'out']) {
  console.log(name, CURVES[name](0.5));        // halfway through the segment
}`,
        caption: { en: 'The console prints how far each curve has got at the halfway point: `linear 0.5`, `ease 0.5`, `in 0.25`, `out 0.75`.', zh: '主控台印出每條曲線在一半的時間點走到了哪裡：`linear 0.5`、`ease 0.5`、`in 0.25`、`out 0.75`。' },
      },
      {
        code: `import { Params } from '@openav/core';
import { Timeline } from '@openav/timeline';

const params = new Params([{ key: 'speed', min: 0, max: 4, def: 0 }]);
const timeline = new Timeline({ params, automation: {
  speed: [[0, 0.3], [16, 1.6, 'in'], [20, 3.4, 'step'], [30, 0.8, 'out']],
} });
for (const t of [8, 16, 19, 20, 25, 30]) console.log(t, timeline.valueAt('speed', t).toFixed(2));`,
        caption: { en: 'One lane, three curves: the console prints a slow start (`8 0.63`), the arrival at `16 1.60`, a long hold (`19 1.60`) until the step jumps at 20 (`20 3.40`), then an `out` curve down to `30 0.80`.', zh: '一條軌道，三種曲線：主控台印出緩慢的起頭（`8 0.63`）、第 16 秒抵達 `16 1.60`、一路守著（`19 1.60`）到第 20 秒 step 才跳（`20 3.40`），最後用 `out` 曲線降到 `30 0.80`。' },
      },
      {
        code: `import { Params } from '@openav/core';
import { Timeline } from '@openav/timeline';

const params = new Params([{ key: 'speed', min: 0, max: 4, def: 0 }]);
const timeline = new Timeline({ params, automation: {
  speed: [[0, 0], [10, 4, (f) => f * f * f]],      // your own curve: a function of 0..1
} });
console.log(timeline.valueAt('speed', 5));`,
        caption: { en: 'A function works wherever a name does. Halfway through, a cubic curve is only an eighth of the way: the console prints `0.5` (4 × 0.125).', zh: '函式可以用在任何可以寫名稱的地方。走到一半的時候，三次方曲線只走了八分之一：主控台印出 `0.5`（4 × 0.125）。' },
      },
    ],
    related: ['Timeline', 'Params', 'approach'],
    keywords: {
      en: ['curve', 'curves', 'easing', 'ease', 'ease in', 'ease out', 'step', 'linear', 'interpolation', 'smoothstep', 'keyframe'],
      zh: ['曲線', '緩動', '緩入', '緩出', '階梯', '內插', '關鍵影格', '線性'],
    },
  },

  HOLD_EPS: {
    group: 'timeline',
    summary: {
      en: 'How far before the boundary the playhead parks when a hold stops the show: one microsecond, so it still belongs to the scene that is waiting.',
      zh: 'hold 讓演出停住的時候，播放頭停在邊界前多遠的地方：一微秒，這樣它仍然屬於正在等候的那個場景。',
    },
    description: [
      {
        en: 'A scene with `hold: true` stops playback at its end. The [`Timeline`](#Timeline) parks `HOLD_EPS` (0.000001 seconds) **before** the boundary rather than on it, so `sceneIndexAt(t)` and the director still say "the held scene", `timeline.t` reads 5.999999 for a hold at 6, and the next scene has not started. `release()` then moves the playhead onto the boundary itself.',
        zh: '`hold: true` 的場景會在尾端讓播放停住。[`Timeline`](#Timeline) 把播放頭停在邊界**前面** `HOLD_EPS`（0.000001 秒）的地方，而不是正好停在邊界上，所以 `sceneIndexAt(t)` 和導演仍然說「現在是被 hold 的那個場景」，在 6 秒的 hold 上 `timeline.t` 讀到的是 5.999999，下一個場景還沒開始。之後 `release()` 才把播放頭移到邊界本身。',
      },
      {
        en: 'You only need it when you compare the playhead with a boundary yourself: while holding, `timeline.t` is `boundary - HOLD_EPS`, not exactly `boundary`.',
        zh: '只有在你自己拿播放頭跟邊界做比較的時候才會用到：hold 的時候，`timeline.t` 是 `邊界 - HOLD_EPS`，不是剛好等於邊界。',
      },
    ],
    examples: [
      {
        code: `import { Params } from '@openav/core';
import { Timeline, HOLD_EPS } from '@openav/timeline';

const params = new Params([]);
const timeline = new Timeline({ params, total: 20, scenes: [{ id: 'wait', t: 0, hold: true }, { id: 'go', t: 6 }] });
timeline.play();
for (let i = 0; i < 10; i++) timeline.advance(1);
console.log(timeline.holding, timeline.currentScene().id, Math.abs(6 - timeline.t - HOLD_EPS) < 1e-9);`,
        caption: { en: 'The show parks just before second 6, still inside the held scene: the console prints `true wait true` (`6 - timeline.t` is `HOLD_EPS`, apart from rounding).', zh: '演出停在第 6 秒的稍前方，仍然在被 hold 的場景裡：主控台印出 `true wait true`（`6 - timeline.t` 在捨入誤差內等於 `HOLD_EPS`）。' },
      },
    ],
    related: ['Timeline', 'Director', 'Score'],
    keywords: {
      en: ['hold', 'eps', 'epsilon', 'park', 'standby', 'boundary', 'release'],
      zh: ['hold', '停住', '待機', '邊界', '放行', '微秒'],
    },
  },

  AUTOMATION_FORMAT: {
    group: 'timeline',
    summary: {
      en: 'The `format` field of an automation file: the string `\'openav-automation\'`, which `exportAutomation()` writes and `importAutomation()` checks.',
      zh: '自動化檔案的 `format` 欄位：字串 `\'openav-automation\'`，`exportAutomation()` 會寫上它，`importAutomation()` 會檢查它。',
    },
    description: [
      {
        en: '[`timeline.exportAutomation()`](#Timeline) returns `{ format, version: 1, cut, as, automation }` with this constant as `format`. `importAutomation()` reads the field: a document whose `format` is another string is refused with an error, and so is a `version` above 1. A document without a `format` string is read as a bare `{ key: keyframes | lane }` map.',
        zh: '[`timeline.exportAutomation()`](#Timeline) 回傳 `{ format, version: 1, cut, as, automation }`，其中的 `format` 就是這個常數。`importAutomation()` 會讀這個欄位：`format` 是別的字串的檔案會被拒絕並丟出錯誤，`version` 大於 1 的也是。沒有 `format` 字串的檔案，會被當成一張單純的 `{ key: 關鍵影格 | lane }` 表來讀。',
      },
      {
        en: 'Use it to recognise such a file before you hand it over, for example in a file picker that also accepts map files.',
        zh: '可以拿它在交給時間軸之前先認出這種檔案，例如一個同時也收映射檔的檔案選擇器。',
      },
    ],
    examples: [
      {
        code: `import { Params } from '@openav/core';
import { Timeline, AUTOMATION_FORMAT } from '@openav/timeline';

const params = new Params([{ key: 'hue', min: 0, max: 360, def: 200 }]);
const timeline = new Timeline({ params, total: 60, automation: { hue: [[0, 200], [60, 320]] } });
const file = timeline.exportAutomation();
console.log(file.format === AUTOMATION_FORMAT, JSON.stringify(file));`,
        caption: { en: 'The console prints `true`, then the file: `{"format":"openav-automation","version":1,"cut":null,"as":"seconds","automation":{"hue":[[0,200],[60,320]]}}`.', zh: '主控台印出 `true`，接著是檔案內容：`{"format":"openav-automation","version":1,"cut":null,"as":"seconds","automation":{"hue":[[0,200],[60,320]]}}`。' },
      },
    ],
    related: ['Timeline', 'isLane', 'decompileLane'],
    keywords: {
      en: ['automation file', 'format', 'export', 'import', 'json', 'openav-automation'],
      zh: ['自動化檔案', '格式', '匯出', '匯入', 'json', 'openav-automation'],
    },
  },

  isLane: {
    group: 'timeline',
    summary: {
      en: 'Tells a lane from keyframes: `true` for a plain object (points per segment), `false` for an array (keyframes in seconds), `null` and anything else.',
      zh: '分辨 lane 和關鍵影格：普通物件（每段一組點）回傳 `true`，陣列（秒數的關鍵影格）、`null` 和其他東西都回傳 `false`。',
    },
    params: [
      {
        name: 'x', type: 'any',
        en: 'One value of an `automation` object.',
        zh: '`automation` 物件裡的一個值。',
      },
    ],
    returns: {
      type: 'Boolean',
      en: '`true` when `x` is an object that is neither `null` nor an array.',
      zh: '`x` 是物件，而且不是 `null`、也不是陣列的時候是 `true`。',
    },
    description: [
      {
        en: 'In a [`Timeline`](#Timeline), each param\'s automation is either an array of `[seconds, value, curve?]` keyframes or a lane, `{ segmentId: [[p, value, curve?], …] }`. `isLane()` is the test the timeline itself uses to decide which one it was given. It looks only at the shape: it does not check that the segment ids exist or that the points are valid ([`compileLane()`](#compileLane) does that).',
        zh: '在 [`Timeline`](#Timeline) 裡，每個參數的自動化曲線不是 `[秒數, 值, 曲線?]` 關鍵影格的陣列，就是一條 lane：`{ 段落 id: [[p, 值, 曲線?], …] }`。`isLane()` 就是時間軸自己用來判斷拿到的是哪一種的那個測試。它只看形狀：不檢查段落 id 存不存在，也不檢查點合不合格（那是 [`compileLane()`](#compileLane) 的事）。',
      },
    ],
    examples: [
      {
        code: `import { isLane } from '@openav/timeline';

console.log(isLane({ dawn: [[0, 0.2], [1, 0.9]] }));   // true: points per segment
console.log(isLane([[0, 200], [60, 320]]));            // false: keyframes in seconds
console.log(isLane(null));                             // false`,
        caption: { en: 'The console prints `true`, `false`, `false`.', zh: '主控台印出 `true`、`false`、`false`。' },
      },
    ],
    related: ['compileLane', 'decompileLane', 'Timeline'],
    keywords: {
      en: ['lane', 'is lane', 'keyframes', 'automation', 'per segment'],
      zh: ['lane', '關鍵影格', '自動化', '按段落', '判斷'],
    },
  },

  lanePos: {
    group: 'timeline',
    summary: {
      en: 'Turns a second into a place in a segment plan: `{ id, index, p }`, the segment that owns it and how far through it (0 to 1). `null` outside the show.',
      zh: '把秒數換成段落表裡的位置：`{ id, index, p }`，也就是它屬於哪一段、走了多少（0 到 1）。演出之外是 `null`。',
    },
    params: [
      {
        name: 'plan', type: 'Array',
        en: 'The segments in order: `[{ id, start, end }]` or `[{ id, start, dur }]`, in seconds. This is the shape of `score.rootSegments` and of `timeline.lanePlan()`.',
        zh: '依序排好的段落：`[{ id, start, end }]` 或 `[{ id, start, dur }]`，單位是秒。`score.rootSegments` 和 `timeline.lanePlan()` 就是這個樣子。',
      },
      {
        name: 't', type: 'Number',
        en: 'A time in the plan\'s seconds.',
        zh: '段落表所用秒數的一個時間。',
      },
    ],
    returns: {
      type: 'Object | null',
      en: '`{ id, index, p }`. `null` when the plan is empty, `t` is not a finite number, or `t` is before the first segment or after the last.',
      zh: '`{ id, index, p }`。段落表是空的、`t` 不是有限數字，或 `t` 在第一段之前、最後一段之後，都回傳 `null`。',
    },
    description: [
      {
        en: 'A boundary belongs to the segment that starts there, so the second where `noon` begins answers `{ id: \'noon\', p: 0 }`, not the end of the segment before. The one exception is the last second of the show, which is `p: 1` of the last segment. A segment of zero length answers `p: 0`. [`laneTime()`](#laneTime) goes the other way.',
        zh: '段界屬於從那裡開始的那一段，所以 `noon` 開始的那一秒回答的是 `{ id: \'noon\', p: 0 }`，不是前一段的結尾。唯一的例外是演出的最後一秒，它是最後一段的 `p: 1`。長度是 0 的段落回答 `p: 0`。反方向的換算是 [`laneTime()`](#laneTime)。',
      },
      {
        en: 'These functions do not know a [`Timeline`](#Timeline), so a tool can use them alone. On a timeline, `timeline.lanePos(t)` and `timeline.laneTime(id, p)` call them with the timeline\'s own plan. The seconds are automation seconds (the root cut\'s): for a derived cut\'s show time use `score.locate(T)` and `score.timeAt(id, p)`.',
        zh: '這幾個函式不認得 [`Timeline`](#Timeline)，所以工具可以單獨拿來用。在時間軸上，`timeline.lanePos(t)` 和 `timeline.laneTime(id, p)` 會帶著時間軸自己的段落表去呼叫它們。這裡的秒是自動化的秒（root cut 的秒）：衍生 cut 的演出時間要用 `score.locate(T)` 和 `score.timeAt(id, p)`。',
      },
    ],
    examples: [
      {
        code: `import { lanePos, laneTime } from '@openav/timeline';

const plan = [{ id: 'dawn', start: 0, end: 20 }, { id: 'noon', start: 20, end: 60 }];
console.log(lanePos(plan, 10));               // halfway through dawn
console.log(lanePos(plan, 20));               // the boundary belongs to noon
console.log(lanePos(plan, 61));               // outside the show
console.log(laneTime(plan, 'noon', 0.5));     // and back: 40`,
        caption: { en: 'The console prints `{ id: \'dawn\', index: 0, p: 0.5 }`, `{ id: \'noon\', index: 1, p: 0 }`, `null`, and `40`.', zh: '主控台印出 `{ id: \'dawn\', index: 0, p: 0.5 }`、`{ id: \'noon\', index: 1, p: 0 }`、`null`，以及 `40`。' },
      },
    ],
    related: ['laneTime', 'compileLane', 'decompileLane', 'Timeline', 'Score'],
    keywords: {
      en: ['lane', 'segment', 'progress', 'seconds to segment', 'locate', 'plan'],
      zh: ['lane', '段落', '進度', '秒數換段落', '定位', '段落表'],
    },
  },

  laneTime: {
    group: 'timeline',
    summary: {
      en: 'The inverse of `lanePos()`: the second at progress `p` through the segment `id` of a plan. `NaN` when the plan has no such segment.',
      zh: '`lanePos()` 的反函數：段落表裡第 `id` 段走到進度 `p` 是第幾秒。段落表裡沒有這個段落就是 `NaN`。',
    },
    params: [
      {
        name: 'plan', type: 'Array',
        en: 'The segments: `[{ id, start, end }]` or `[{ id, start, dur }]`, in seconds.',
        zh: '段落表：`[{ id, start, end }]` 或 `[{ id, start, dur }]`，單位是秒。',
      },
      {
        name: 'id', type: 'String',
        en: 'The id of a segment. With two segments of the same id, the first one is used.',
        zh: '段落的 id。有兩個段落 id 相同的話，用的是第一個。',
      },
      {
        name: 'p', type: 'Number', optional: true, default: '0',
        en: 'Progress through the segment: 0 is its start, 1 its end. It is not clamped, so 1.5 answers a second past the end.',
        zh: '在這個段落裡的進度：0 是段首，1 是段尾。它不會被限制範圍，所以 1.5 會回答超過段尾的秒數。',
      },
    ],
    returns: {
      type: 'Number',
      en: '`start + p × (end − start)` in the plan\'s seconds; exactly `start` for `p` 0 and exactly `end` for `p` 1. `NaN` when there is no segment with that id or `p` is not a finite number.',
      zh: '段落表所用秒數的 `start + p × (end − start)`。`p` 是 0 的時候剛好等於 `start`，是 1 的時候剛好等於 `end`。沒有這個 id 的段落，或 `p` 不是有限數字，就是 `NaN`。',
    },
    description: [
      {
        en: 'Use it to say "halfway through `noon`" without knowing how long `noon` is: `laneTime(plan, \'noon\', 0.5)`. With [`lanePos()`](#lanePos) it converts between seconds and (segment, p) in both directions. On a [`Timeline`](#Timeline), `timeline.laneTime(id, p)` does the same with the timeline\'s own plan.',
        zh: '用它可以說「`noon` 的一半」而不必知道 `noon` 有多長：`laneTime(plan, \'noon\', 0.5)`。它和 [`lanePos()`](#lanePos) 一起，讓秒數和（段落, p）可以雙向換算。在 [`Timeline`](#Timeline) 上，`timeline.laneTime(id, p)` 用時間軸自己的段落表做同一件事。',
      },
    ],
    examples: [
      {
        code: `import { laneTime } from '@openav/timeline';

const plan = [{ id: 'dawn', start: 0, end: 20 }, { id: 'noon', start: 20, end: 60 }];
console.log(laneTime(plan, 'noon', 0.5));   // 40
console.log(laneTime(plan, 'dawn'));        // 0: p defaults to the start
console.log(laneTime(plan, 'dusk'));        // NaN: no such segment`,
        caption: { en: 'The console prints `40`, `0`, `NaN`.', zh: '主控台印出 `40`、`0`、`NaN`。' },
      },
    ],
    related: ['lanePos', 'compileLane', 'Timeline', 'Score'],
    keywords: {
      en: ['lane', 'segment', 'progress', 'segment to seconds', 'time at'],
      zh: ['lane', '段落', '進度', '段落換秒數'],
    },
  },

  compileLane: {
    group: 'timeline',
    summary: {
      en: 'Turns a lane (points written per segment, `p` from 0 to 1) into keyframes in seconds, `[[t, value, curve?], …]`, sorted by time.',
      zh: '把 lane（按段落寫的點，`p` 從 0 到 1）換成秒數的關鍵影格 `[[t, 值, 曲線?], …]`，依時間排好。',
    },
    params: [
      {
        name: 'plan', type: 'Array',
        en: 'The segments the lane is written against: `[{ id, start, end }]` or `[{ id, start, dur }]`, in seconds.',
        zh: 'lane 對照的段落表：`[{ id, start, end }]` 或 `[{ id, start, dur }]`，單位是秒。',
      },
      {
        name: 'lane', type: 'Object',
        en: '`{ segmentId: points }`. `points` is an array of `[p, value, curve?]` with `p` from 0 to 1 in ascending order, or a bare number (that value for the whole segment), or `null` / `undefined` (this segment is not written).',
        zh: '`{ 段落 id: 點 }`。「點」是 `[p, 值, 曲線?]` 的陣列，`p` 在 0 到 1 之間、由小到大。也可以只寫一個數字（整段維持這個值），或 `null`、`undefined`（這一段不寫）。',
      },
      {
        name: 'key', type: 'String', optional: true, default: '\'?\'',
        en: 'In the options object: the param\'s name, used only in error messages.',
        zh: '放在選項物件裡：參數的名字，只用在錯誤訊息裡。',
      },
      {
        name: 'known', type: 'Set | null', optional: true, default: 'null',
        en: 'In the options object: the segment ids that any cut has (`score.allSegmentIds()`). A lane entry for an id that is in `known` but not in `plan` is skipped; without `known`, every id missing from `plan` throws.',
        zh: '放在選項物件裡：任何一個 cut 有過的段落 id（`score.allSegmentIds()`）。lane 寫到的 id 在 `known` 裡、但不在 `plan` 裡，那一筆會被略過。沒給 `known` 的話，`plan` 裡沒有的 id 一律丟出錯誤。',
      },
    ],
    returns: {
      type: 'Array',
      en: 'Keyframes `[[t, value], [t, value, curve], …]` in the plan\'s seconds, sorted by time. On the same second, the `p: 1` of the earlier segment comes before the `p: 0` of the later one.',
      zh: '以段落表秒數表示的關鍵影格 `[[t, 值], [t, 值, 曲線], …]`，依時間排好。落在同一秒的時候，前一段的 `p: 1` 排在後一段的 `p: 0` 前面。',
    },
    description: [
      {
        en: 'A point `[p, value, curve]` is the keyframe `[segment start + p × segment length, value, curve]`, and there is no other rule. Between segments the value interpolates like any two keyframes; two points on the same second (the `p: 1` of one segment and the `p: 0` of the next) are a jump. A [`Timeline`](#Timeline) calls this for every lane in its `automation` when it is built, and again in `importAutomation()`; call it yourself in a tool that reads lanes without a timeline.',
        zh: '一個點 `[p, 值, 曲線]` 就是關鍵影格 `[段首 + p × 段長, 值, 曲線]`，沒有別的規則。段與段之間照一般兩個關鍵影格那樣內插。兩個點落在同一秒（前一段的 `p: 1` 和後一段的 `p: 0`）就是一次跳變。[`Timeline`](#Timeline) 建立的時候，會替 `automation` 裡的每條 lane 呼叫它，`importAutomation()` 裡也會再呼叫。不透過時間軸讀 lane 的工具，可以自己呼叫。',
      },
      {
        en: 'It throws an `Error` that names the param, the segment and the point when something is wrong: a segment id that is not in the plan (and not in `known`), a value that is not a finite number, a `p` outside 0 to 1 or out of order, an empty list of points, or a point that is not `[p, value, curve?]`.',
        zh: '有問題的時候它會丟出 `Error`，訊息裡指出是哪個參數、哪個段落、第幾個點：段落 id 不在段落表裡（也不在 `known` 裡）、值不是有限數字、`p` 超出 0 到 1 或順序不對、點的清單是空的，或某個點不是 `[p, 值, 曲線?]`。',
      },
    ],
    examples: [
      {
        code: `import { compileLane } from '@openav/timeline';

const plan = [{ id: 'dawn', start: 0, end: 20 }, { id: 'noon', start: 20, end: 60 }];
const keyframes = compileLane(plan, {
  dawn: [[0, 0.2], [1, 0.9, 'ease']],     // rise through dawn
  noon: 0.4,                              // one value for the whole of noon
});
console.log(JSON.stringify(keyframes));

try { compileLane(plan, { dusk: 1 }, { key: 'glow' }); } catch (e) { console.log(e.message); }`,
        caption: { en: 'The console prints `[[0,0.2],[20,0.9,"ease"],[20,0.4],[60,0.4]]` (the value jumps from 0.9 to 0.4 at second 20), then the error for a segment that does not exist: `[timeline] automation "glow": there is no segment "dusk" (segments: dawn, noon)`.', zh: '主控台印出 `[[0,0.2],[20,0.9,"ease"],[20,0.4],[60,0.4]]`（值在第 20 秒從 0.9 跳到 0.4），接著是寫到不存在的段落時的錯誤：`[timeline] automation "glow": there is no segment "dusk" (segments: dawn, noon)`。' },
      },
    ],
    related: ['decompileLane', 'isLane', 'lanePos', 'laneTime', 'Timeline', 'Score', 'CURVES'],
    keywords: {
      en: ['lane', 'compile', 'per segment', 'automation', 'keyframes', 'segment', 'cut'],
      zh: ['lane', '編譯', '按段落', '自動化', '關鍵影格', '段落', 'cut'],
    },
  },

  decompileLane: {
    group: 'timeline',
    summary: {
      en: 'The inverse of `compileLane()`: turns keyframes in seconds into a lane, `{ segmentId: [[p, value, curve?], …] }`, each keyframe in the segment it falls in.',
      zh: '`compileLane()` 的反函數：把秒數的關鍵影格換成 lane `{ 段落 id: [[p, 值, 曲線?], …] }`，每個關鍵影格歸到它落在的那一段。',
    },
    params: [
      {
        name: 'plan', type: 'Array',
        en: 'The segments: `[{ id, start, end }]` or `[{ id, start, dur }]`, in seconds. It must not be empty, and every id must be different.',
        zh: '段落表：`[{ id, start, end }]` 或 `[{ id, start, dur }]`，單位是秒。不能是空的，而且每個 id 都要不一樣。',
      },
      {
        name: 'keyframes', type: 'Array',
        en: 'Keyframes `[[t, value, curve?], …]` in the plan\'s seconds. They need not be sorted.',
        zh: '以段落表秒數表示的關鍵影格 `[[t, 值, 曲線?], …]`。不用先排好。',
      },
      {
        name: 'key', type: 'String', optional: true, default: '\'?\'',
        en: 'In the options object: the param\'s name, used only in error messages.',
        zh: '放在選項物件裡：參數的名字，只用在錯誤訊息裡。',
      },
      {
        name: 'precision', type: 'Number | null', optional: true, default: '9',
        en: 'In the options object: how many decimals `p` is rounded to. `null` does not round.',
        zh: '放在選項物件裡：`p` 要四捨五入到小數第幾位。`null` 表示不捨入。',
      },
    ],
    returns: {
      type: 'Object',
      en: 'The lane. A segment that no keyframe falls in has no entry.',
      zh: '一條 lane。沒有任何關鍵影格落在裡面的段落，就不會出現在結果裡。',
    },
    description: [
      {
        en: 'A keyframe exactly on a boundary: alone, it becomes `p: 0` of the segment that starts there. Two or more on the same second are a jump, so all but the last become `p: 1` of the segment before and the last becomes `p: 0` of the next. That is why a lane made by [`compileLane()`](#compileLane) comes back exactly as it was. Keyframes on the last second of the show are `p: 1` of the last segment.',
        zh: '剛好落在段界上的關鍵影格：只有一個的話，它是從那裡開始的那一段的 `p: 0`。同一秒有兩個以上就是跳變，前面的歸前一段的 `p: 1`，最後一個歸後一段的 `p: 0`。所以 [`compileLane()`](#compileLane) 編出來的 lane，拆回去會一模一樣。落在演出最後一秒的關鍵影格，是最後一段的 `p: 1`。',
      },
      {
        en: 'A keyframe outside the show has no (segment, p), so it throws a `RangeError`; export in seconds instead. An empty plan, or one where two segments share an id, throws an `Error`. On a [`Timeline`](#Timeline), `timeline.lanes()` and `exportAutomation({ as: \'segments\' })` call this for you.',
        zh: '演出範圍之外的關鍵影格寫不成（段落, p），所以會丟出 `RangeError`，這種情況請改用秒數匯出。段落表是空的，或有兩個段落共用一個 id，會丟出 `Error`。在 [`Timeline`](#Timeline) 上，`timeline.lanes()` 和 `exportAutomation({ as: \'segments\' })` 會替你呼叫它。',
      },
    ],
    examples: [
      {
        code: `import { decompileLane } from '@openav/timeline';

const plan = [{ id: 'dawn', start: 0, end: 20 }, { id: 'noon', start: 20, end: 60 }];
console.log(JSON.stringify(decompileLane(plan, [[0, 200], [30, 320], [60, 40]])));
console.log(JSON.stringify(decompileLane(plan, [[0, 0.2], [20, 0.9, 'ease'], [20, 0.4], [60, 0.4]])));`,
        caption: { en: 'The console prints `{"dawn":[[0,200]],"noon":[[0.25,320],[1,40]]}` (second 30 is a quarter of the way through noon), then `{"dawn":[[0,0.2],[1,0.9,"ease"]],"noon":[[0,0.4],[1,0.4]]}`: the two keyframes on second 20 went to the end of dawn and the start of noon.', zh: '主控台印出 `{"dawn":[[0,200]],"noon":[[0.25,320],[1,40]]}`（第 30 秒是 noon 的四分之一），接著是 `{"dawn":[[0,0.2],[1,0.9,"ease"]],"noon":[[0,0.4],[1,0.4]]}`：第 20 秒的兩個關鍵影格，分別歸到 dawn 的結尾和 noon 的開頭。' },
      },
    ],
    related: ['compileLane', 'isLane', 'lanePos', 'laneTime', 'Timeline', 'AUTOMATION_FORMAT'],
    keywords: {
      en: ['lane', 'decompile', 'per segment', 'export', 'automation', 'keyframes'],
      zh: ['lane', '反編譯', '按段落', '匯出', '自動化', '關鍵影格'],
    },
  },
};
