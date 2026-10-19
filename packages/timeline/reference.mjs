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
        en: 'The keyframes of each param: `{ hue: [[0, 200], [30, 320, \'ease\'], [60, 40]] }`. A keyframe is `[seconds, value, curve?]`, sorted by time.',
        zh: '每個參數的關鍵影格：`{ hue: [[0, 200], [30, 320, \'ease\'], [60, 40]] }`。一個關鍵影格是 `[秒數, 值, 曲線?]`，依時間排序。',
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
        en: 'Call once per frame with the seconds that passed. Moves `t` by `dt × rate` while playing, parks at a hold, wraps a loop, stops at `total`, and fires scene changes and cues on the way. Returns whether it is still playing.',
        zh: '每個畫面呼叫一次，傳入經過的秒數。播放中會讓 `t` 前進 `dt × rate`，遇到 hold 就停住，遇到循環就繞回去，到 `total` 就停下來，途中會觸發場景改變和 cue。回傳是否仍在播放。',
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
    ],
    related: ['Params', 'Loop', 'Score', 'Director', 'CURVES', 'HOLD_EPS', 'createShow', 'mountConsole'],
    keywords: {
      en: ['timeline', 'automation', 'keyframe', 'keyframes', 'scene', 'scenes', 'cue', 'hold', 'loop', 'seek', 'play', 'transport', 'record', 'state', 'playhead'],
      zh: ['時間軸', '自動化', '關鍵影格', '場景', 'cue', 'hold', '循環', '跳轉', '播放', '播放頭', '錄製', '曲線'],
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
};
