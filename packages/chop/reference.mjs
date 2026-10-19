// @openav/chop reference: values over time. Read by tools/build-reference.mjs (see AGENTS.md, "Documenting a public name").
// Every number in here was run against packages/chop/index.js. The module examples run headless: they print into <div id="app">
// or draw into <canvas id="c"> (400 x 300), so the result is visible on the smoke page and in any page that has the same two ids.

export default {
  approach: {
    group: 'chop',
    summary: {
      en: 'One step of a one-pole lag: moves `current` toward `target`, closing 63% of the gap after `seconds`.',
      zh: '一階低通跟隨的一步：把 `current` 往 `target` 推近，經過 `seconds` 秒走完 63% 的差距。',
    },
    params: [
      { name: 'current', type: 'Number', en: 'Where the value is now.', zh: '數值現在的位置。' },
      { name: 'target', type: 'Number', en: 'Where it is heading.', zh: '它要去的地方。' },
      { name: 'seconds', type: 'Number', en: 'The time constant: after this many seconds the gap to `target` has closed by 63% (1 − 1/e). 0, a negative number or NaN jumps straight to `target`, whatever `dt` is.', zh: '時間常數：經過這麼多秒，與 `target` 的差距縮小 63%（1 − 1/e）。0、負數或 NaN 會直接跳到 `target`，不管 `dt` 是多少。' },
      { name: 'dt', type: 'Number', en: 'Seconds since the last step. 0, a negative number or NaN leaves `current` where it is.', zh: '距離上一步過了幾秒。0、負數或 NaN 時 `current` 原地不動。' },
    ],
    returns: { type: 'Number', en: 'The new value, between `current` and `target`.', zh: '新的數值，落在 `current` 與 `target` 之間。' },
    description: [
      {
        en: 'The smallest piece of smoothing. Call it once per frame, `value = approach(value, target, 0.2, dt)`, and `value` chases `target`: 63% of the way after `seconds`, 90% after 2.3 × `seconds`, 99% after 4.6 × `seconds`. It is exact for any `dt`, so a sketch at 30 fps and one at 144 fps draw the same curve.',
        zh: '平滑裡最小的一塊。每個畫面呼叫一次，`value = approach(value, target, 0.2, dt)`，`value` 就會追著 `target` 跑：經過 `seconds` 走完 63%，2.3 × `seconds` 走完 90%，4.6 × `seconds` 走完 99%。不管 `dt` 多大都是精確解，所以 30 fps 和 144 fps 畫出同一條曲線。',
      },
      {
        en: '`seconds` here is a time constant, which is shorter than the "seconds" of TouchDesigner\'s Lag CHOP. [`Lag`](#Lag) takes the TouchDesigner kind and divides it by [`TD_LAG_RATIO`](#TD_LAG_RATIO) before calling this function. `@openav/mapping`\'s `smooth` steps with `approach` and means the time constant too.',
        zh: '這裡的 `seconds` 是時間常數，比 TouchDesigner 的 Lag CHOP 的「秒數」短。[`Lag`](#Lag) 收的是 TouchDesigner 那種秒數，會先除以 [`TD_LAG_RATIO`](#TD_LAG_RATIO) 再呼叫這個函式。`@openav/mapping` 的 `smooth` 也是用 `approach` 一步一步走，意思同樣是時間常數。',
      },
    ],
    needs: {
      en: 'Nothing. It is pure arithmetic with no memory: you keep `current` yourself and pass in the seconds since the last call. For a value with its own memory use [`Lag`](#Lag).',
      zh: '不需要先做什麼。它只是算術，沒有記憶：`current` 由你自己保管，並把距離上次呼叫的秒數傳進來。想要自帶記憶的版本，用 [`Lag`](#Lag)。',
    },
    examples: [
      {
        code: `import { approach } from '@openav/chop';

let value = 0;
const seen = [];
for (let frame = 0; frame < 6; frame++) {
  value = approach(value, 1, 0.1, 1 / 60);   // chase 1, time constant 0.1 s
  seen.push(value.toFixed(3));
}
document.getElementById('app').textContent = seen.join('  ');`,
        caption: { en: 'Six frames of a value chasing 1: it covers about 15% of the remaining gap each frame (0.154, 0.283, 0.393 …).', zh: '一個數值追著 1 跑的六個畫面：每個畫面大約走完剩下差距的 15%（0.154、0.283、0.393 …）。' },
      },
      {
        code: `import { approach } from '@openav/chop';

// one second of time constant: the gap is 63% closed after 1 s, 90% after 2.3 s
const seconds = 1;
const after = (t) => approach(0, 1, seconds, t).toFixed(3);
document.getElementById('app').textContent =
  \`after 1 s: \${after(1)}   after 2.3 s: \${after(2.3026)}   after 4.6 s: \${after(4.6052)}\`;`,
        caption: { en: 'Prints 0.632, 0.900 and 0.990: the three numbers worth remembering.', zh: '印出 0.632、0.900、0.990：值得記住的三個數字。' },
      },
    ],
    related: ['Lag', 'TD_LAG_RATIO', 'lag'],
    keywords: {
      en: ['lag', 'smooth', 'smoothing', 'ease', 'easing', 'time constant', 'one-pole', 'low-pass', 'follow', 'chase', 'exponential'],
      zh: ['平滑', '緩動', '跟隨', '時間常數', '低通', '延遲', '追趕'],
    },
  },

  TD_LAG_RATIO: {
    group: 'chop',
    summary: {
      en: 'ln 10 (about 2.303): how many time constants a lag needs to cover 90% of a jump, which is what TouchDesigner\'s Lag seconds mean.',
      zh: 'ln 10（約 2.303）：一個 lag 走完 90% 要幾個時間常數，也就是 TouchDesigner 的 Lag 秒數的意思。',
    },
    value: {
      type: 'Number',
      en: 'Exactly `Math.LN10`, 2.302585092994046. A fixed number: it never changes.',
      zh: '就是 `Math.LN10`，2.302585092994046。固定的數字，不會變。',
    },
    description: [
      {
        en: 'TouchDesigner\'s Lag CHOP quotes its seconds as roughly the time the output takes to follow 90% of a change. A one-pole lag reaches 90% after ln 10 time constants, so `seconds / TD_LAG_RATIO` is the time constant to hand to [`approach()`](#approach). [`Lag`](#Lag) does exactly that, which is why `lag(x, 0.1)` in a p5 sketch moves like a Lag CHOP set to 0.1.',
        zh: 'TouchDesigner 的 Lag CHOP 把秒數定義成大約是輸出追上 90% 變化所花的時間。一階低通要走 ln 10 個時間常數才到 90%，所以 `seconds / TD_LAG_RATIO` 就是該交給 [`approach()`](#approach) 的時間常數。[`Lag`](#Lag) 做的正是這件事，所以 p5 草圖裡的 `lag(x, 0.1)` 動起來就像把 Lag CHOP 設成 0.1。',
      },
      {
        en: 'You only need it when you mix the two kinds of seconds: a time constant `tau` is `tdSeconds / TD_LAG_RATIO`, and `tdSeconds` is `tau * TD_LAG_RATIO`. Attack and decay of an [`envelope()`](#envelope) are plain lengths and are not converted.',
        zh: '只有在兩種秒數混著用的時候才會用到它：時間常數 `tau` 等於 `tdSeconds / TD_LAG_RATIO`，`tdSeconds` 等於 `tau * TD_LAG_RATIO`。[`envelope()`](#envelope) 的 attack 和 decay 是單純的長度，不用換算。',
      },
    ],
    examples: [
      {
        code: `import { approach, TD_LAG_RATIO } from '@openav/chop';

const tdSeconds = 0.5;                       // as you would type it into a TouchDesigner Lag CHOP
const tau = tdSeconds / TD_LAG_RATIO;        // the time constant approach() wants
const reached = approach(0, 1, tau, tdSeconds);
document.getElementById('app').textContent =
  \`tau = \${tau.toFixed(3)} s, after \${tdSeconds} s the value is \${reached.toFixed(2)}\`;`,
        caption: { en: 'Prints "tau = 0.217 s, after 0.5 s the value is 0.90": half a second of Lag CHOP seconds is 90% of the way.', zh: '印出「tau = 0.217 s, after 0.5 s the value is 0.90」：Lag CHOP 的 0.5 秒就是走完 90%。' },
      },
    ],
    related: ['approach', 'Lag', 'lag'],
    keywords: {
      en: ['ln 10', 'touchdesigner', 'lag chop', 'seconds', 'time constant', '90%', 'ratio', 'convert'],
      zh: ['時間常數', 'touchdesigner', 'lag chop', '秒數', '換算', '比例', '90%'],
    },
  },

  Lag: {
    group: 'chop',
    summary: {
      en: 'Follows its input with one speed while the input is above the output and another while it is below; the TouchDesigner Lag CHOP.',
      zh: '輸入比輸出高的時候用一種速度跟上去，比輸出低的時候用另一種速度，就是 TouchDesigner 的 Lag CHOP。',
    },
    params: [
      { name: 'up', type: 'Number', en: 'Seconds to follow a rise, while the input is above the output. TouchDesigner\'s seconds: about the time to cover 90% of a jump. 0 follows at once.', zh: '追上升高的輸入要幾秒（輸入比輸出高的時候）。用 TouchDesigner 的秒數：大約是走完 90% 跳躍的時間。0 表示立刻跟上。' },
      { name: 'down', type: 'Number', en: 'Seconds to follow a fall, while the input is below the output. Leave it out and it is the same as `up`.', zh: '追上降低的輸入要幾秒（輸入比輸出低的時候）。不給就跟 `up` 一樣。' },
      { name: 'value', type: 'Number', en: 'A starting value. Leave it out and the first input is taken as it is, so nothing glides in from 0.', zh: '起始值。不給的話，第一個輸入原樣當作輸出，所以不會從 0 慢慢滑進來。' },
    ],
    description: [
      {
        en: 'Make one `Lag` per value you want to smooth, then call `step(input, dt)` once per frame. `new Lag({ up: 0.03, down: 0.4 })` is a VU meter: it opens almost at once and closes slowly. `up` and `down` are in TouchDesigner\'s seconds: with `up: 1`, a jump from 0 to 1 is at 0.9 one second later, at 30, 60 or 144 fps alike.',
        zh: '每一個要平滑的數值做一個 `Lag`，每個畫面呼叫一次 `step(input, dt)`。`new Lag({ up: 0.03, down: 0.4 })` 就是音量表：幾乎立刻張開，慢慢收回。`up` 和 `down` 用 TouchDesigner 的秒數：`up: 1` 的話，從 0 跳到 1 之後一秒是 0.9，30、60 或 144 fps 都一樣。',
      },
      {
        en: 'Each step is the exact answer for an input held at its new value over `dt` seconds, so the frame rate does not change the curve. A boolean counts as 0 or 1 (`lag.step(mouseIsPressed, dt)` is a soft switch). A value that is not a number, such as `NaN`, comes back untouched and leaves the memory as it was.',
        zh: '每一步都是「輸入在這 `dt` 秒內維持新值」的精確解，所以影格率不會改變曲線。布林值算成 0 或 1（`lag.step(mouseIsPressed, dt)` 是柔和的開關）。不是數字的值（像 `NaN`）原樣傳回，記憶不受影響。',
      },
      {
        en: 'In a p5 sketch you do not import this: [`lag()`](#lag) keeps one `Lag` per call for you.',
        zh: '在 p5 草圖裡不用 import 它：[`lag()`](#lag) 會替每一個呼叫保管一個 `Lag`。',
      },
    ],
    needs: {
      en: 'Nothing to load or start. Pass the seconds since the previous frame as `dt` (in a browser: the difference of two `performance.now() / 1000`). The first `step` only stores the input, so the output equals the input on frame one.',
      zh: '不用載入或啟動任何東西。把距離上一個畫面的秒數當作 `dt` 傳進來（瀏覽器裡：兩次 `performance.now() / 1000` 的差）。第一次 `step` 只是把輸入記下來，所以第一個畫面輸出等於輸入。',
    },
    members: {
      step: {
        en: '`step(input, dt, up?, down?)`: advance by `dt` seconds toward `input` and return the new output. `up` and `down` override the constructor\'s for this call only, so a knob can change them every frame. A non-number input is returned as it is.',
        zh: '`step(input, dt, up?, down?)`：朝 `input` 前進 `dt` 秒，回傳新的輸出。`up`、`down` 只在這次呼叫蓋過建構時的值，所以可以用旋鈕每個畫面改它們。輸入不是數字就原樣傳回。',
      },
      reset: {
        en: '`reset(value?)`: forget the memory. With no argument the next input is taken as it is again; with a number the output restarts from there. Returns the `Lag`, so calls chain.',
        zh: '`reset(value?)`：忘掉記憶。不給參數的話，下一個輸入會再次原樣當作輸出。給數字就從那個值重新開始。回傳 `Lag` 本身，可以接著呼叫。',
      },
    },
    notes: [
      {
        en: 'Public fields: `up`, `down` and `value`, the last output (`null` until the first step). You can change `up` and `down` any time.',
        zh: '公開的欄位有 `up`、`down` 和 `value`（最後一次的輸出，第一次 `step` 之前是 `null`）。`up`、`down` 隨時可以改。',
      },
      {
        en: 'The time constant underneath is `seconds / ` [`TD_LAG_RATIO`](#TD_LAG_RATIO), not `seconds`. If you want the plain 63% kind, call [`approach()`](#approach).',
        zh: '底層的時間常數是 `seconds / ` [`TD_LAG_RATIO`](#TD_LAG_RATIO)，不是 `seconds`。想要單純 63% 那一種，直接呼叫 [`approach()`](#approach)。',
      },
    ],
    examples: [
      {
        code: `import { Lag } from '@openav/chop';

const lag = new Lag({ up: 0.03, down: 0.4 });   // opens fast, closes slowly
const seen = [];
for (let frame = 0; frame < 12; frame++) {
  const input = frame >= 2 && frame < 6 ? 1 : 0;   // on for four frames
  seen.push(lag.step(input, 1 / 60).toFixed(2));
}
document.getElementById('app').textContent = seen.join('  ');`,
        caption: { en: 'The output shoots up within two frames when the input turns on, then sags back slowly after it turns off (0.00 0.00 0.72 0.92 0.98 0.99 0.90 0.82 …).', zh: '輸入打開時，輸出兩個畫面內就衝上去，輸入關掉之後才慢慢掉下來（0.00 0.00 0.72 0.92 0.98 0.99 0.90 0.82 …）。' },
      },
      {
        code: `import { Lag } from '@openav/chop';

const ctx = document.getElementById('c').getContext('2d');
ctx.fillStyle = '#111'; ctx.fillRect(0, 0, 400, 300);
ctx.lineWidth = 2;
const input = (t) => (t < 0.25 || t > 1.25 ? 0 : 1);   // a pulse, 1 s long

for (const [fps, color] of [[30, '#555'], [30, '#fa4'], [144, '#4af']]) {
  const lag = new Lag({ up: 0.1, down: 0.4 });
  ctx.strokeStyle = color; ctx.beginPath();
  for (let k = 0; k <= fps * 2; k++) {
    const t = k / fps;
    const y = color === '#555' ? input(t) : lag.step(input(t), k ? 1 / fps : 0);
    ctx.lineTo(20 + t * 180, 260 - y * 220);
  }
  ctx.stroke();
}`,
        caption: { en: 'A one-second pulse (grey) through a Lag at 30 fps (orange) and at 144 fps (blue): it rises in about 0.1 s, falls over about 0.4 s, and the two curves lie on top of each other.', zh: '一個一秒長的脈衝（灰）分別用 30 fps（橘）和 144 fps（藍）走過 Lag：大約 0.1 秒升上去、0.4 秒左右落下來，兩條曲線疊在一起。' },
      },
      {
        code: `import { Lag } from '@openav/chop';

const lag = new Lag();                       // up and down are both 0.1
lag.step(0.5, 0);                            // the first input is taken as it is
const nan = lag.step(NaN, 1 / 60);           // not a number: passed through, memory kept
const kept = lag.value;                      // still 0.5
const toward = lag.step(true, 1 / 60);       // a boolean counts as 1, so it moves up from 0.5
document.getElementById('app').textContent =
  \`NaN in: \${nan}, memory still \${kept}, true in: \${toward.toFixed(2)}\`;`,
        caption: { en: 'Prints "NaN in: NaN, memory still 0.5, true in: 0.66": a non-number leaves the memory alone, and a boolean counts as 0 or 1.', zh: '印出「NaN in: NaN, memory still 0.5, true in: 0.66」：不是數字就不動記憶，布林值算成 0 或 1。' },
      },
    ],
    related: ['approach', 'TD_LAG_RATIO', 'lag', 'Spring', 'envelope'],
    keywords: {
      en: ['lag', 'smooth', 'smoothing', 'follow', 'vu meter', 'attack release', 'ease', 'low-pass', 'touchdesigner', 'lag chop', 'up down'],
      zh: ['平滑', '緩動', '跟隨', '音量表', '延遲', '低通', 'touchdesigner', '上升下降'],
    },
  },

  envelopeStage: {
    group: 'chop',
    summary: {
      en: 'The level of one envelope `elapsed` seconds after its trigger: a straight rise to `peak`, then a fall to 0 in `decay` seconds.',
      zh: '一個包絡在被觸發 `elapsed` 秒之後的高度：先直線升到 `peak`，再用 `decay` 秒落回 0。',
    },
    params: [
      { name: 'elapsed', type: 'Number', en: 'Seconds since the trigger. Below 0 (or NaN) gives `from`.', zh: '觸發之後過了幾秒。小於 0（或 NaN）時回傳 `from`。' },
      { name: 'attack', type: 'Number', en: 'Seconds to rise from 0 to `peak`. 0 or less starts at the peak at once.', zh: '從 0 升到 `peak` 要幾秒。0 或更小就一開始直接在峰值。' },
      { name: 'decay', type: 'Number', en: 'Seconds to fall from `peak` to 0, along (1 − u)² where u runs 0 to 1. 0 or less drops to 0 right after the attack.', zh: '從 `peak` 落到 0 要幾秒，走 (1 − u)² 的曲線（u 從 0 跑到 1）。0 或更小就在起音結束後立刻變 0。' },
      { name: 'from', type: 'Number', optional: true, en: 'The level at the moment of the trigger. The attack still counts from 0 to the peak, so starting from halfway up takes half the attack.', zh: '觸發當下的高度。起音仍然以 0 到峰值計算，所以從一半高度開始只要一半的起音時間。' },
      { name: 'peak', type: 'Number', optional: true, en: 'The top of the envelope.', zh: '包絡的最高點。' },
    ],
    returns: { type: 'Number', en: 'The level, from 0 to `peak`.', zh: '高度，從 0 到 `peak`。' },
    description: [
      {
        en: 'The building block of [`envelope()`](#envelope), which strings several of these together for a list of events. On its own it answers: "how high is a kick that happened `elapsed` seconds ago?" With the defaults of `envelope()` (attack 0.01, decay 0.3) it is 0.5 at 5 ms, 1 at 10 ms, 0.49 at 100 ms and 0 from 310 ms on.',
        zh: '[`envelope()`](#envelope) 的基本零件，它把好幾個這樣的片段串起來處理一串事件。單獨使用時，它回答的是：「`elapsed` 秒前發生的一次大鼓，現在有多高？」用 `envelope()` 的預設值（attack 0.01、decay 0.3），5 毫秒時是 0.5，10 毫秒是 1，100 毫秒是 0.49，310 毫秒起是 0。',
      },
      {
        en: 'The fall is quick at first and lands softly: that is the shape a kick drum swell looks right with. It reaches 0 in exactly `decay` seconds, not asymptotically.',
        zh: '下降一開始很快、收尾很柔：大鼓的律動配這個形狀看起來最對。它剛好在 `decay` 秒落到 0，不是無限接近。',
      },
    ],
    notes: [
      {
        en: 'Advanced. Most sketches never call it: use [`envelope()`](#envelope), or `env()` in p5.',
        zh: '進階用法。大部分草圖不會直接呼叫它：請用 [`envelope()`](#envelope)，p5 裡用 `env()`。',
      },
    ],
    examples: [
      {
        code: `import { envelopeStage } from '@openav/chop';

const row = [0, 0.005, 0.01, 0.1, 0.16, 0.31].map(
  (t) => \`\${t} s: \${envelopeStage(t, 0.01, 0.3).toFixed(2)}\`
);
document.getElementById('app').textContent = row.join('   ');`,
        caption: { en: 'Prints the level at six moments after a trigger: 0.00, 0.50, 1.00, 0.49, 0.25, 0.00.', zh: '印出觸發後六個時間點的高度：0.00、0.50、1.00、0.49、0.25、0.00。' },
      },
    ],
    related: ['envelope', 'env', 'Lag'],
    keywords: {
      en: ['envelope', 'attack', 'decay', 'trigger', 'adsr', 'kick', 'pulse', 'swell'],
      zh: ['包絡', '起音', '衰減', '觸發', '大鼓', '脈衝'],
    },
  },

  envelope: {
    group: 'chop',
    summary: {
      en: 'The level, 0 to `peak`, of an attack-and-decay envelope at time `t`, for events that happened at the given `times`; the Trigger CHOP.',
      zh: '給定事件發生的時間 `times`，算出起音加衰減的包絡在時間 `t` 的高度（0 到 `peak`），就是 Trigger CHOP。',
    },
    params: [
      { name: 'times', type: 'Number[]', en: 'When the events happened, in seconds on any clock you like, oldest first. An empty array (or none) gives 0. Events later than `t` have not happened yet and are ignored. Only the last few matter, so you can trim the list.', zh: '事件發生的時間，單位是秒，用哪個時鐘都行，最舊的排前面。空陣列（或沒給）回傳 0。比 `t` 晚的事件還沒發生，會被忽略。只有最後幾筆有影響，所以可以把舊的剪掉。' },
      { name: 't', type: 'Number', en: 'The moment to read, on the same clock as `times`.', zh: '要讀取的時間點，跟 `times` 用同一個時鐘。' },
      { name: 'attack', type: 'Number', optional: true, en: 'Seconds to rise from 0 to the peak. 0 starts at the peak at once.', zh: '從 0 升到峰值要幾秒。0 就一開始直接在峰值。' },
      { name: 'decay', type: 'Number', optional: true, en: 'Seconds to fall back to 0 after the peak: it is exactly 0 from `attack + decay` seconds after an event.', zh: '到達峰值後落回 0 要幾秒：事件之後 `attack + decay` 秒起正好是 0。' },
      { name: 'peak', type: 'Number', optional: true, en: 'The top of the envelope.', zh: '包絡的最高點。' },
    ],
    returns: { type: 'Number', en: '0 to `peak`: `peak` just after an event, 0 once it has died away.', zh: '0 到 `peak`：事件剛發生時是 `peak`，消散之後是 0。' },
    description: [
      {
        en: 'Keep a list of the times something happened (a kick, a key press, a cue) and ask for the level at the time you are drawing: `scale(1 + envelope(kicks, now, 0.01, 0.3))`. It rises in a straight line to 1 in `attack` seconds, then falls to 0 in `decay` seconds, quick at first and landing softly.',
        zh: '把某件事發生的時間（大鼓、按鍵、cue）存成一個清單，畫的時候問它「現在多高」：`scale(1 + envelope(kicks, now, 0.01, 0.3))`。它在 `attack` 秒內直線升到 1，再用 `decay` 秒落回 0，一開始快、收尾柔。',
      },
      {
        en: 'It is a pure function of the times and of `t`: ask twice, or at 30 fps and at 144 fps, and the same moment gives the same level; `attack` and `decay` may change every frame (a knob on the decay). A new event while the last one still sounds restarts from where the envelope is, never from 0, so fast hits pile up into a plateau instead of flickering. The attack counts from 0 to the peak, so a retrigger from halfway up takes half the attack.',
        zh: '它是 `times` 和 `t` 的純函式：問兩次、或在 30 fps 與 144 fps 問同一個時間點，答案一樣。`attack` 和 `decay` 每個畫面都可以改（例如用旋鈕調 decay）。上一個事件還沒消散時又來一個，包絡從目前的高度重新出發，不會先掉到 0，所以快速的連擊會堆成一個高原，不會閃爍。起音以 0 到峰值計算，所以從一半高度重新觸發只要一半的起音時間。',
      },
      {
        en: 'In a p5 sketch you do not import it: [`env()`](#env) and `trigger()` keep the event list for you and read the drum machine and the microphone.',
        zh: '在 p5 草圖裡不用 import：[`env()`](#env) 和 `trigger()` 會替你保管事件清單，也會讀鼓機和麥克風。',
      },
    ],
    needs: {
      en: 'Nothing to load. You record the event times yourself (for example `kicks.push(performance.now() / 1000)` when a kick arrives) and pass the same clock as `t`.',
      zh: '不用載入任何東西。事件的時間由你自己記（例如大鼓來的時候 `kicks.push(performance.now() / 1000)`），`t` 要用同一個時鐘。',
    },
    examples: [
      {
        code: `import { envelope } from '@openav/chop';

const kicks = [1];   // one kick, at 1 s
const times = [0.9, 1, 1.005, 1.01, 1.1, 1.2, 1.31];
document.getElementById('app').innerHTML = times
  .map((t) => \`\${t} s: \${envelope(kicks, t).toFixed(2)}\`)
  .join('<br>');`,
        caption: { en: 'Before the kick 0.00, half way up the attack 0.50 at 1.005 s, the peak 1.00 at 1.01 s, then 0.49, 0.13 and 0.00 at 1.31 s.', zh: '大鼓之前是 0.00，1.005 秒到起音一半 0.50，1.01 秒到峰值 1.00，然後是 0.49、0.13，1.31 秒回到 0.00。' },
      },
      {
        code: `import { envelope } from '@openav/chop';

const ctx = document.getElementById('c').getContext('2d');
const kicks = [];
let nextKick = 0;

function frame(ms) {
  const t = ms / 1000;
  if (t >= nextKick) { kicks.push(nextKick); nextKick += 0.5; }   // a kick every half second
  const level = envelope(kicks, t, 0.01, 0.3);
  ctx.fillStyle = '#111'; ctx.fillRect(0, 0, 400, 300);
  ctx.fillStyle = '#fc4';
  ctx.beginPath(); ctx.arc(200, 150, 40 + level * 80, 0, Math.PI * 2); ctx.fill();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);`,
        caption: { en: 'A disc that swells on every kick (twice a second) and shrinks back within 0.3 s.', zh: '一個圓盤，每次大鼓（每秒兩次）都脹大，0.3 秒內縮回去。' },
      },
      {
        code: `import { envelope } from '@openav/chop';

// three hits 50 ms apart pile up; one lone hit at the same moment is much lower
const pile = envelope([0, 0.05, 0.1], 0.11);
const lone = envelope([0], 0.11);
document.getElementById('app').textContent =
  \`pile-up: \${pile.toFixed(2)}   lone hit: \${lone.toFixed(2)}\`;`,
        caption: { en: 'Prints "pile-up: 0.95   lone hit: 0.44": each new hit restarts from where the envelope is, so quick hits hold it high.', zh: '印出「pile-up: 0.95   lone hit: 0.44」：每一擊都從目前高度重新出發，所以密集的擊打會把它撐在高處。' },
      },
    ],
    related: ['envelopeStage', 'env', 'Lag', 'Count'],
    keywords: {
      en: ['envelope', 'trigger', 'trigger chop', 'attack', 'decay', 'kick', 'pulse', 'swell', 'adsr', 'on every beat'],
      zh: ['包絡', '觸發', 'trigger', '起音', '衰減', '大鼓', '脈衝', '每個拍子'],
    },
  },

  Speed: {
    group: 'chop',
    summary: {
      en: 'Adds `rate` every second to a running total: a rate in units per second becomes a position; the Speed CHOP.',
      zh: '每秒把 `rate` 加進一個累計值：每秒多少單位的速率變成位置，就是 Speed CHOP。',
    },
    params: [
      { name: 'value', type: 'Number', en: 'The starting total. Anything that is not a finite number starts at 0.', zh: '累計值的起點。不是有限數字的話就從 0 開始。' },
    ],
    description: [
      {
        en: '`speed.step(rate, dt)` adds `rate * dt` to the total and returns it. With `rate` 1 the total grows by 1 every second; `rotate(speed.step(TWO_PI, dt))` is one turn a second. Feed it a rate that changes (a knob, `micLevel`) and the motion speeds up and slows down smoothly, without the jump you get from multiplying `frameCount` by it.',
        zh: '`speed.step(rate, dt)` 把 `rate * dt` 加到累計值裡並回傳。`rate` 是 1 的話，累計值每秒增加 1。`rotate(speed.step(TWO_PI, dt))` 就是每秒轉一圈。餵給它會變動的速率（旋鈕、`micLevel`），動作會平順地變快變慢，不會像把 `frameCount` 乘上速率那樣一跳一跳。',
      },
      {
        en: 'It is the integral of the rate, so it is the same at any frame rate. A boolean rate counts as 1 per second while true. A rate that is not a number, or a `dt` of 0 or less, adds nothing.',
        zh: '它是速率的積分，所以不論影格率都一樣。布林值的速率在 true 的時候算每秒 1。速率不是數字、或 `dt` 是 0 或更小，就什麼都不加。',
      },
      {
        en: 'In a p5 sketch use [`speed()`](#speed), which keeps one for each call.',
        zh: '在 p5 草圖裡請用 [`speed()`](#speed)，它會替每個呼叫保管一個。',
      },
    ],
    needs: {
      en: 'Nothing to load. Pass the seconds since the previous frame as `dt`.',
      zh: '不用載入任何東西。把距離上一個畫面的秒數當作 `dt` 傳進來。',
    },
    members: {
      step: {
        en: '`step(rate, dt)`: add `rate * dt` to the total and return the total.',
        zh: '`step(rate, dt)`：把 `rate * dt` 加到累計值並回傳累計值。',
      },
      reset: {
        en: '`reset(value?)`: set the total back to `value` (0 if left out). Returns the `Speed`.',
        zh: '`reset(value?)`：把累計值設回 `value`（沒給就是 0）。回傳 `Speed` 本身。',
      },
    },
    notes: [
      { en: 'The total is the public field `value`.', zh: '累計值就是公開欄位 `value`。' },
    ],
    examples: [
      {
        code: `import { Speed } from '@openav/chop';

const speed = new Speed();
const seen = [];
for (let i = 0; i < 4; i++) seen.push(speed.step(2, 0.5).toFixed(1));   // 2 units a second
document.getElementById('app').textContent = seen.join('  ');`,
        caption: { en: 'Prints 1.0  2.0  3.0  4.0: two units a second, half a second per step.', zh: '印出 1.0  2.0  3.0  4.0：每秒 2 單位，每一步半秒。' },
      },
      {
        code: `import { Speed } from '@openav/chop';

const ctx = document.getElementById('c').getContext('2d');
const spin = new Speed();
let last = performance.now();

function frame(now) {
  const dt = (now - last) / 1000; last = now;
  const angle = spin.step(Math.PI * 2, dt);        // one turn a second
  ctx.fillStyle = '#111'; ctx.fillRect(0, 0, 400, 300);
  ctx.strokeStyle = '#fc4'; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(200, 150);
  ctx.lineTo(200 + Math.cos(angle) * 90, 150 + Math.sin(angle) * 90); ctx.stroke();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);`,
        caption: { en: 'A hand that turns once a second, at any frame rate. Change the rate to a changing number (a level, a knob) and it speeds up and slows down smoothly.', zh: '一根每秒轉一圈的指針，不論影格率。把速率換成會變動的數字（音量、旋鈕），它就會平順地加速減速。' },
      },
    ],
    related: ['speed', 'Slope', 'Lag'],
    keywords: {
      en: ['speed', 'speed chop', 'integrate', 'rate', 'per second', 'rotate', 'accumulate', 'position from velocity'],
      zh: ['速度', 'speed chop', '積分', '速率', '每秒', '旋轉', '累計'],
    },
  },

  springStep: {
    group: 'chop',
    summary: {
      en: 'One exact step of a damped spring of mass 1 pulled toward `target`; returns `[position, velocity]`.',
      zh: '質量為 1 的阻尼彈簧朝 `target` 被拉的一個精確步驟，回傳 `[位置, 速度]`。',
    },
    params: [
      { name: 'x', type: 'Number', en: 'The position now.', zh: '現在的位置。' },
      { name: 'v', type: 'Number', en: 'The velocity now, in units per second.', zh: '現在的速度，單位是每秒多少單位。' },
      { name: 'target', type: 'Number', en: 'Where the other end of the spring is held.', zh: '彈簧另一端固定的位置。' },
      { name: 'stiffness', type: 'Number', en: 'How hard it pulls. Negative counts as 0.', zh: '拉得多用力。負數當作 0。' },
      { name: 'damping', type: 'Number', en: 'How much friction slows it. Negative counts as 0.', zh: '摩擦力多大。負數當作 0。' },
      { name: 'dt', type: 'Number', en: 'Seconds to advance. 0 or less (or NaN) returns `[x, v]` unchanged.', zh: '要前進幾秒。0 或更小（或 NaN）原樣回傳 `[x, v]`。' },
    ],
    returns: { type: '[Number, Number]', en: 'The new position and velocity.', zh: '新的位置與速度。' },
    description: [
      {
        en: 'Solves x\'\' = −stiffness·(x − target) − damping·x\' exactly over `dt` for a `target` that stays still during the step. It handles all three cases (under-damped: it bounces; critically damped; over-damped: it creeps) and a huge `dt` never blows up, which is why a sketch can fall behind for a whole second and the spring just lands on the target.',
        zh: '對 `dt` 這段時間內 `target` 不動的情況，精確解 x\'\' = −stiffness·(x − target) − damping·x\'。欠阻尼（會彈）、臨界阻尼、過阻尼（慢慢爬）三種情況都處理，而且 `dt` 再大也不會發散，所以草圖卡了一整秒，彈簧也只是落在目標上。',
      },
      {
        en: '`damping = 2 * Math.sqrt(stiffness)` is the edge where it stops bouncing: with `stiffness` 100 that is a damping of 20. With no spring (`stiffness` 0) only the damping acts and the velocity just fades.',
        zh: '`damping = 2 * Math.sqrt(stiffness)` 是剛好不再彈的臨界點：`stiffness` 是 100 的話，就是 damping 20。沒有彈簧（`stiffness` 為 0）的時候只剩阻尼作用，速度慢慢消失。',
      },
    ],
    notes: [
      { en: 'Advanced. The [`Spring`](#Spring) class holds the position and the velocity for you and calls this.', zh: '進階用法。[`Spring`](#Spring) 類別會替你保管位置與速度，並呼叫這個函式。' },
    ],
    examples: [
      {
        code: `import { springStep } from '@openav/chop';

let x = 0, v = 0;
const seen = [];
for (let frame = 0; frame < 8; frame++) {
  [x, v] = springStep(x, v, 1, 100, 6, 1 / 60);   // pulled toward 1
  seen.push(x.toFixed(2));
}
document.getElementById('app').textContent = seen.join('  ');`,
        caption: { en: 'Eight frames of a spring released at 0 and pulled toward 1: it accelerates (0.01, 0.05, 0.11 …).', zh: '從 0 放開、朝 1 拉的彈簧的八個畫面：愈來愈快（0.01、0.05、0.11 …）。' },
      },
      {
        code: `import { springStep } from '@openav/chop';

const [x, v] = springStep(0, 0, 1, 100, 6, 10);   // a ten-second step in one go
document.getElementById('app').textContent = \`after 10 s: position \${x.toFixed(3)}, velocity \${v.toFixed(3)}\`;`,
        caption: { en: 'A ten-second step lands on the target (position 1.000, velocity 0.000) instead of exploding.', zh: '一次走十秒也只是落在目標上（位置 1.000、速度 0.000），不會發散。' },
      },
    ],
    related: ['Spring', 'spring', 'approach'],
    keywords: {
      en: ['spring', 'damped', 'oscillator', 'physics', 'bounce', 'overshoot', 'integrator', 'step'],
      zh: ['彈簧', '阻尼', '振盪', '物理', '彈跳', '過衝'],
    },
  },

  Spring: {
    group: 'chop',
    summary: {
      en: 'Follows its input like a mass on a spring: it overshoots, swings back and settles; the Spring CHOP with the input as position.',
      zh: '像吊在彈簧上的重物一樣追著輸入：會衝過頭、彈回來、再安定下來，就是輸入當作位置的 Spring CHOP。',
    },
    params: [
      { name: 'stiffness', type: 'Number', en: 'How hard the spring pulls, so how fast it swings. With nothing damping it, it swings about `√stiffness / 2π` times a second (100 is about 1.6).', zh: '彈簧拉得多用力，也就是擺動多快。沒有阻尼的時候，每秒大約擺 `√stiffness / 2π` 次（100 大約是 1.6 次）。' },
      { name: 'damping', type: 'Number', en: 'How soon it settles. 6 with a stiffness of 100 bounces a few times; `2 * √stiffness` (20 for 100) and above never bounces.', zh: '多快安定下來。stiffness 100 配 damping 6 會彈幾下。`2 * √stiffness`（100 的話是 20）以上就完全不彈。' },
      { name: 'value', type: 'Number', en: 'A starting position. Leave it out and the first input is taken as it is, so it does not swing in from 0.', zh: '起始位置。不給的話，第一個輸入原樣當作位置，所以不會從 0 擺進來。' },
    ],
    description: [
      {
        en: 'Make one `Spring` per value, call `step(target, dt)` once per frame and draw what it returns. With the defaults (stiffness 100, damping 6), a jump of the input from 0 to 1 sends the output to 1.37 after a third of a second, and it is within 1% of 1 from about 1.4 s on. Raise the damping to 20 and it glides to the target without overshooting.',
        zh: '每個數值做一個 `Spring`，每個畫面呼叫一次 `step(target, dt)`，畫它回傳的值。用預設值（stiffness 100、damping 6）的話，輸入從 0 跳到 1，輸出在約三分之一秒時衝到 1.37，大約 1.4 秒之後就落在 1 的 1% 以內。把 damping 調到 20，它就會滑到目標上，不衝過頭。',
      },
      {
        en: 'Each step is the exact answer from [`springStep()`](#springStep), so 30 fps and 144 fps give the same motion and a long frame cannot blow it up. The input is the position it is pulled toward; a boolean counts as 0 or 1; a value that is not a number is returned as it is and changes nothing.',
        zh: '每一步都是 [`springStep()`](#springStep) 的精確解，所以 30 fps 和 144 fps 動得一樣，一個很長的畫面也不會讓它發散。輸入是它被拉向的位置，布林值算成 0 或 1，不是數字的值原樣傳回，什麼都不改。',
      },
      {
        en: 'In a p5 sketch use [`spring()`](#spring).',
        zh: '在 p5 草圖裡請用 [`spring()`](#spring)。',
      },
    ],
    needs: {
      en: 'Nothing to load. Pass the seconds since the previous frame as `dt`. The first `step` only stores the input (the spring starts at rest on it).',
      zh: '不用載入任何東西。把距離上一個畫面的秒數當作 `dt` 傳進來。第一次 `step` 只是把輸入記下來（彈簧就靜止在那裡開始）。',
    },
    members: {
      step: {
        en: '`step(target, dt, stiffness?, damping?)`: advance the spring by `dt` seconds toward `target` and return the new position. `stiffness` and `damping` override the constructor\'s for this call.',
        zh: '`step(target, dt, stiffness?, damping?)`：讓彈簧朝 `target` 前進 `dt` 秒，回傳新的位置。`stiffness`、`damping` 只在這次呼叫蓋過建構時的值。',
      },
      reset: {
        en: '`reset(value?)`: stop the spring. With no argument the next input is taken as it is; with a number it rests there. Returns the `Spring`.',
        zh: '`reset(value?)`：讓彈簧停下來。不給參數的話，下一個輸入會原樣當作位置。給數字就靜止在那裡。回傳 `Spring` 本身。',
      },
    },
    notes: [
      {
        en: 'Public fields: `stiffness`, `damping`, `value` (the position; `null` before the first step) and `velocity`.',
        zh: '公開的欄位有 `stiffness`、`damping`、`value`（位置，第一次 `step` 之前是 `null`）和 `velocity`。',
      },
    ],
    examples: [
      {
        code: `import { Spring } from '@openav/chop';

const spring = new Spring();             // stiffness 100, damping 6
spring.step(0, 0);                        // rest at 0
const seen = [];
for (let frame = 0; frame < 24; frame += 3) {
  for (let i = 0; i < 3; i++) spring.step(1, 1 / 60);   // the input jumps to 1
  seen.push(spring.value.toFixed(2));
}
document.getElementById('app').textContent = seen.join('  ');`,
        caption: { en: 'Every third frame after the input jumps to 1: the value overshoots past 1 (to about 1.37), comes back and settles.', zh: '輸入跳到 1 之後每隔三個畫面看一次：數值衝過 1（約 1.37）、彈回來、再安定。' },
      },
      {
        code: `import { Spring } from '@openav/chop';

const ctx = document.getElementById('c').getContext('2d');
ctx.fillStyle = '#111'; ctx.fillRect(0, 0, 400, 300);
ctx.lineWidth = 2;
const target = (t) => (t < 0.2 ? 0 : 1);   // the input jumps at 0.2 s

for (const [damping, color] of [[null, '#555'], [6, '#fa4'], [20, '#4af']]) {
  const s = new Spring({ stiffness: 100, damping: damping ?? 6 });
  ctx.strokeStyle = color; ctx.beginPath();
  for (let k = 0; k <= 180; k++) {
    const t = k / 60;
    const y = damping === null ? target(t) : s.step(target(t), k ? 1 / 60 : 0);
    ctx.lineTo(20 + t * 120, 250 - y * 150);
  }
  ctx.stroke();
}`,
        caption: { en: 'Two springs follow the same jump (grey): damping 6 (orange) overshoots and wobbles, damping 20 (blue) glides straight to the target.', zh: '兩個彈簧追同一個跳躍（灰）：damping 6（橘）衝過頭再晃幾下，damping 20（藍）直接滑到目標。' },
      },
    ],
    related: ['springStep', 'spring', 'Lag', 'approach'],
    keywords: {
      en: ['spring', 'spring chop', 'overshoot', 'bounce', 'wobble', 'elastic', 'damping', 'stiffness', 'physics', 'follow'],
      zh: ['彈簧', 'spring chop', '過衝', '彈跳', '晃動', '彈性', '阻尼', '勁度'],
    },
  },

  Trail: {
    group: 'chop',
    summary: {
      en: 'Remembers the input over the last few seconds as a list of values, oldest first, at a fixed 60 values a second; the Trail CHOP.',
      zh: '把輸入最近幾秒的變化記成一串數值，最舊的在前，固定每秒 60 個，就是 Trail CHOP。',
    },
    params: [
      { name: 'seconds', type: 'Number', en: 'How many seconds of history to keep. 0 or less falls back to 2.', zh: '要保留幾秒的歷史。0 或更小的話改用 2。' },
      { name: 'rate', type: 'Number', en: 'Values per second in the list. 0 or less falls back to 60.', zh: '清單裡每秒幾個值。0 或更小的話改用 60。' },
    ],
    description: [
      {
        en: '`trail.step(value, dt)` returns an array of `seconds * rate` past values followed by this step\'s input at the end, so the array is `seconds * rate + 1` long (121 for the defaults). Draw it across the canvas as a line: that is a scope of the value.',
        zh: '`trail.step(value, dt)` 回傳一個陣列：`seconds * rate` 個過去的值，最後接上這一步的輸入，所以長度是 `seconds * rate + 1`（預設是 121）。把它橫跨畫布畫成一條線，就是這個數值的示波器。',
      },
      {
        en: 'The length is fixed from the first step, filled with the first value, so a sketch can draw the whole line from frame one. The values are interpolated between steps, so 30 fps and 144 fps give the same line. A gap longer than the whole window (a tab that was hidden) restarts it filled with the new value.',
        zh: '長度從第一步就固定，用第一個值填滿，所以草圖從第一個畫面就能畫出整條線。步與步之間會內插，所以 30 fps 和 144 fps 得到同一條線。如果有一段空檔比整個視窗還長（例如分頁被藏起來），就用新的值填滿重新開始。',
      },
      {
        en: 'In a p5 sketch use [`trail()`](#trail) and [`drawTrail()`](#drawTrail).',
        zh: '在 p5 草圖裡請用 [`trail()`](#trail) 和 [`drawTrail()`](#drawTrail)。',
      },
    ],
    needs: {
      en: 'Nothing to load. Pass the seconds since the previous frame as `dt`. A value that is not a number leaves the history as it is and returns the current list.',
      zh: '不用載入任何東西。把距離上一個畫面的秒數當作 `dt` 傳進來。不是數字的值不會改動歷史，只是回傳目前的清單。',
    },
    members: {
      size: {
        en: 'How many past values are kept: `seconds * rate`, rounded and held between 2 and 36000. The list from `step()` is one longer.',
        zh: '保留幾個過去的值：`seconds * rate` 四捨五入後，限制在 2 到 36000 之間。`step()` 回傳的清單比它多一個。',
      },
      ordered: {
        en: '`ordered()`: the stored past values, oldest first, without the newest input (an empty array before the first step).',
        zh: '`ordered()`：儲存的過去的值，最舊的在前，不含最新的輸入（第一次 `step` 之前是空陣列）。',
      },
      step: {
        en: '`step(value, dt, seconds?)`: take in this frame\'s `value` and return the list. A different `seconds` resizes the window and keeps the newest values.',
        zh: '`step(value, dt, seconds?)`：收下這個畫面的 `value` 並回傳清單。給不同的 `seconds` 會調整視窗大小，並保留最新的值。',
      },
      values: {
        en: '`values()`: the list again, oldest first, the newest input last; an empty array before the first step.',
        zh: '`values()`：再取一次清單，最舊的在前、最新的輸入在最後。第一次 `step` 之前是空陣列。',
      },
      reset: {
        en: '`reset()`: forget the history; the next `step` fills the list with its value again. Returns the `Trail`.',
        zh: '`reset()`：清掉歷史。下一次 `step` 會再用它的值填滿清單。回傳 `Trail` 本身。',
      },
    },
    examples: [
      {
        code: `import { Trail } from '@openav/chop';

const trail = new Trail({ seconds: 0.1 });   // 6 values a tenth of a second
let list;
for (let i = 0; i < 10; i++) list = trail.step(i, 1 / 60);
document.getElementById('app').textContent =
  \`\${list.length} values: \${list.join(' ')}\`;`,
        caption: { en: 'Prints "7 values: 4 5 6 7 8 9 9": the last six steps of the input, then the newest input once more at the end.', zh: '印出「7 values: 4 5 6 7 8 9 9」：輸入最近的六步，最後再接一次最新的輸入。' },
      },
      {
        code: `import { Trail } from '@openav/chop';

const ctx = document.getElementById('c').getContext('2d');
const trail = new Trail({ seconds: 3 });
let last = performance.now();

function frame(now) {
  const dt = (now - last) / 1000; last = now;
  const list = trail.step(0.5 + 0.5 * Math.sin(now / 400), dt);   // a slow sine, 0..1
  ctx.fillStyle = '#111'; ctx.fillRect(0, 0, 400, 300);
  ctx.strokeStyle = '#4af'; ctx.beginPath();
  list.forEach((v, i) => ctx.lineTo((i / (list.length - 1)) * 400, 260 - v * 220));
  ctx.stroke();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);`,
        caption: { en: 'A scope of a sine wave that scrolls across the canvas: the newest value is at the right edge, with three seconds of history behind it (flat on the left until that much has passed).', zh: '一個正弦波的示波器，從畫布上捲過去：最新的值在右邊緣，後面是三秒的歷史（過滿三秒之前，左邊是平的）。' },
      },
    ],
    related: ['trail', 'drawTrail', 'scope', 'Slope'],
    keywords: {
      en: ['trail', 'trail chop', 'history', 'buffer', 'scope', 'oscilloscope', 'last seconds', 'ring buffer', 'plot'],
      zh: ['軌跡', 'trail chop', '歷史', '緩衝', '示波器', '最近幾秒', '繪圖'],
    },
  },

  Slope: {
    group: 'chop',
    summary: {
      en: 'How fast the input is changing, in units per second; 0 on the first step. The Slope CHOP.',
      zh: '輸入變化得多快，單位是每秒多少，第一步是 0。就是 Slope CHOP。',
    },
    description: [
      {
        en: '`slope.step(value, dt)` returns `(value − previous value) / dt`. A value rising by 3 every second gives 3 at any frame rate; a value that stands still gives 0; a falling one gives a negative number. Use it for "how hard did the knob just move": `scale(1 + abs(slope.step(knob, dt)))`.',
        zh: '`slope.step(value, dt)` 回傳 `(value − 上一個值) / dt`。每秒升 3 的數值，在任何影格率下都回傳 3，沒動的數值是 0，往下掉的是負數。用來表達「旋鈕剛剛轉得多用力」：`scale(1 + abs(slope.step(knob, dt)))`。',
      },
      {
        en: 'It has no smoothing: a single jump of the input is one big spike for one step. Put the result through a [`Lag`](#Lag) if you want it to fade. A `dt` of 0 or less changes nothing and returns the last slope, and a value that is not a number returns the last slope too.',
        zh: '它不做任何平滑：輸入跳一下，就是一步裡的一根大尖峰。想讓它淡出，把結果交給 [`Lag`](#Lag)。`dt` 是 0 或更小，什麼都不改，回傳上一次的斜率。值不是數字時也回傳上一次的斜率。',
      },
      {
        en: 'In a p5 sketch use [`slope()`](#slope).',
        zh: '在 p5 草圖裡請用 [`slope()`](#slope)。',
      },
    ],
    needs: {
      en: 'Nothing to load. The first `step` only stores the value and returns 0, because there is no earlier value to compare with.',
      zh: '不用載入任何東西。第一次 `step` 只是把值記下來並回傳 0，因為沒有更早的值可以比。',
    },
    members: {
      step: {
        en: '`step(input, dt)`: return the change per second since the last step.',
        zh: '`step(input, dt)`：回傳自上一步以來每秒的變化量。',
      },
      reset: {
        en: '`reset()`: forget the previous value; the next step returns 0 again. Returns the `Slope`.',
        zh: '`reset()`：忘掉上一個值。下一步又會回傳 0。回傳 `Slope` 本身。',
      },
    },
    notes: [
      { en: 'The last slope is the public field `value`.', zh: '最近一次的斜率是公開欄位 `value`。' },
    ],
    examples: [
      {
        code: `import { Slope } from '@openav/chop';

const slope = new Slope();
const seen = [];
for (const [value, dt] of [[0, 1 / 60], [0.05, 1 / 60], [0.1, 1 / 60], [0.1, 1 / 60]]) {
  seen.push(slope.step(value, dt).toFixed(1));
}
document.getElementById('app').textContent = seen.join('  ');`,
        caption: { en: 'Prints 0.0  3.0  3.0  0.0: nothing on the first step, then 3 units a second while it rises, then 0 when it stops.', zh: '印出 0.0  3.0  3.0  0.0：第一步沒有東西，上升時每秒 3 單位，停下來就是 0。' },
      },
    ],
    related: ['slope', 'Speed', 'Lag'],
    keywords: {
      en: ['slope', 'slope chop', 'derivative', 'rate of change', 'velocity', 'how fast', 'delta per second'],
      zh: ['斜率', 'slope chop', '微分', '變化率', '速度', '多快', '每秒變化'],
    },
  },

  Count: {
    group: 'chop',
    summary: {
      en: 'Counts how many times its input turned on (true, or a number above `threshold`); with a limit it loops 0 … limit − 1. The Count CHOP.',
      zh: '數輸入打開了幾次（true，或超過 `threshold` 的數字），給上限就會在 0 … 上限 − 1 之間循環。就是 Count CHOP。',
    },
    params: [
      { name: 'threshold', type: 'Number', en: 'A number counts as "on" when it is above this. A boolean true is 1, false is 0.', zh: '數字超過這個值才算「打開」。布林值 true 是 1，false 是 0。' },
    ],
    description: [
      {
        en: '`count.step(input, limit)` counts a rising edge, the moment the input goes from off to on, not the time it stays on. Hold a button for ten seconds and that is one. With `limit` 4 the result walks 0 1 2 3 0 1 …, which is how a beat becomes "beat 1 of 4".',
        zh: '`count.step(input, limit)` 數的是上升的那一下，也就是輸入從關變成開的瞬間，不是開著的時間。按住按鈕十秒也只算一次。給 `limit` 4，結果會是 0 1 2 3 0 1 …，一個拍子就這樣變成「四拍裡的第幾拍」。',
      },
      {
        en: 'The counter keeps counting underneath even when you pass a limit, so you can change the limit later without losing your place. A value that is not a number counts as off.',
        zh: '就算給了上限，底下的計數器還是一直累加，所以之後改上限也不會失去進度。不是數字的值算成關。',
      },
      {
        en: 'In a p5 sketch use [`count()`](#count): `count(beat, 4)`, or `count(\'kick\')` to count the drum machine\'s kicks.',
        zh: '在 p5 草圖裡請用 [`count()`](#count)：`count(beat, 4)`，或用 `count(\'kick\')` 數鼓機的大鼓。',
      },
    ],
    needs: {
      en: 'Nothing to load. Call `step` every frame, even while the input is off: it has to see the "off" to notice the next "on". It has no `dt`, because a count does not depend on time.',
      zh: '不用載入任何東西。每個畫面都呼叫 `step`，連輸入關著的時候也要：它得看到「關」，才認得出下一次的「開」。它沒有 `dt`，因為計數跟時間無關。',
    },
    members: {
      step: {
        en: '`step(input, limit?)`: look at the input and return the count, looped to 0 … `limit` − 1 if `limit` is above 0 (a fraction is rounded down).',
        zh: '`step(input, limit?)`：看一眼輸入並回傳計數。`limit` 大於 0 的話，計數會循環在 0 … `limit` − 1（小數會無條件捨去）。',
      },
      reset: {
        en: '`reset(value?)`: set the counter to `value` (0 if left out; a fraction is cut to a whole number) and forget whether the input was on. Returns the `Count`.',
        zh: '`reset(value?)`：把計數設成 `value`（沒給就是 0，小數會取整數）並忘掉輸入是否開著。回傳 `Count` 本身。',
      },
    },
    notes: [
      { en: 'Public fields: `threshold`, `on` (is the input on right now) and `total` (the count before looping).', zh: '公開的欄位有 `threshold`、`on`（輸入現在是不是開著）和 `total`（循環之前的計數）。' },
    ],
    examples: [
      {
        code: `import { Count } from '@openav/chop';

const count = new Count();
const inputs = [0, 1, 1, 0, 1, true, false, true];
document.getElementById('app').textContent =
  inputs.map((x) => count.step(x)).join('  ');`,
        caption: { en: 'Prints 0  1  1  1  2  2  2  3: it counts each time the input goes from off to on, and holding it on adds nothing.', zh: '印出 0  1  1  1  2  2  2  3：輸入每次從關變開就加一，一直開著不會再加。' },
      },
      {
        code: `import { Count } from '@openav/chop';

const count = new Count();
const beats = [];
for (let i = 0; i < 12; i++) beats.push(count.step(i % 2, 4));   // off, on, off, on …
document.getElementById('app').textContent = beats.join('  ');`,
        caption: { en: 'With a limit of 4 the count loops: 0  1  1  2  2  3  3  0  0  1  1  2.', zh: '給上限 4，計數就會循環：0  1  1  2  2  3  3  0  0  1  1  2。' },
      },
    ],
    related: ['count', 'wrapCount', 'envelope'],
    keywords: {
      en: ['count', 'count chop', 'counter', 'beat counter', 'rising edge', 'loop', 'modulo', 'bar', 'step sequencer'],
      zh: ['計數', 'count chop', '計數器', '拍子', '上升緣', '循環', '取餘數'],
    },
  },

  wrapCount: {
    group: 'chop',
    summary: {
      en: 'Loops a count to 0 … limit − 1: `wrapCount(5, 4)` is 1. A limit of 0 or less leaves the count as it is.',
      zh: '把計數循環到 0 … 上限 − 1：`wrapCount(5, 4)` 是 1。上限是 0 或更小就維持原樣。',
    },
    params: [
      { name: 'total', type: 'Number', en: 'The count so far.', zh: '目前累計的次數。' },
      { name: 'limit', type: 'Number', en: 'How many values to loop through. A fraction is rounded down. 0, a negative number, or no value at all returns `total` unchanged.', zh: '要循環幾個值。小數會無條件捨去。0、負數或沒給，就原樣回傳 `total`。' },
    ],
    returns: { type: 'Number', en: '`total` looped into 0 … `limit` − 1 (never negative, even for a negative `total`).', zh: '循環到 0 … `limit` − 1 的 `total`（就算 `total` 是負的，結果也不會是負的）。' },
    description: [
      {
        en: 'The modulo that [`Count`](#Count) uses, made safe for negative numbers: `wrapCount(-1, 4)` is 3, where `-1 % 4` is -1. It is useful on its own for anything that loops, such as a step number: `wrapCount(frameCount, 16)`.',
        zh: '[`Count`](#Count) 使用的取餘數，並且對負數也安全：`wrapCount(-1, 4)` 是 3，而 `-1 % 4` 是 -1。拿來處理任何要循環的東西也很方便，例如步序編號：`wrapCount(frameCount, 16)`。',
      },
    ],
    examples: [
      {
        code: `import { wrapCount } from '@openav/chop';

const row = [0, 3, 4, 5, 9, -1].map((n) => wrapCount(n, 4));
document.getElementById('app').textContent =
  \`0 3 4 5 9 -1 in a loop of 4: \${row.join(' ')}   no limit: \${wrapCount(5, 0)}\`;`,
        caption: { en: 'Prints 0 3 0 1 1 3, then 5 when there is no limit.', zh: '印出 0 3 0 1 1 3。沒有上限的話則是 5。' },
      },
    ],
    related: ['Count', 'count'],
    keywords: {
      en: ['wrap', 'modulo', 'mod', 'loop', 'cycle', 'wrap around', 'step number'],
      zh: ['循環', '取餘數', '包裹', '繞回來', '步序'],
    },
  },

  DEFAULTS: {
    group: 'chop',
    summary: {
      en: 'The default settings of every CHOP in the package, as one frozen object: lag, envelope, spring, trail and count.',
      zh: '這個套件裡每個 CHOP 的預設設定，收在一個凍結的物件裡：lag、envelope、spring、trail 和 count。',
    },
    value: {
      type: 'Object',
      en: '`{ lag: { up: 0.1, down: 0.1 }, envelope: { attack: 0.01, decay: 0.3 }, spring: { stiffness: 100, damping: 6 }, trail: { seconds: 2, rate: 60 }, count: { threshold: 0.5 } }`. Frozen: assigning to it does nothing.',
      zh: '`{ lag: { up: 0.1, down: 0.1 }, envelope: { attack: 0.01, decay: 0.3 }, spring: { stiffness: 100, damping: 6 }, trail: { seconds: 2, rate: 60 }, count: { threshold: 0.5 } }`。已凍結：指定新值不會有作用。',
    },
    description: [
      {
        en: 'For documentation and for interfaces that show the defaults, such as the placeholder text of a field. The classes and [`envelope()`](#envelope) have these same numbers written in their own signatures; changing this object changes nothing about how they behave.',
        zh: '給文件和要顯示預設值的介面用，例如輸入欄的提示文字。這些類別和 [`envelope()`](#envelope) 在自己的簽名裡已經寫了同樣的數字。改這個物件不會改變它們的行為。',
      },
    ],
    examples: [
      {
        code: `import { DEFAULTS } from '@openav/chop';

document.getElementById('app').textContent = JSON.stringify(DEFAULTS.spring);`,
        caption: { en: 'Prints {"stiffness":100,"damping":6}: what a Spring does when you give it no settings.', zh: '印出 {"stiffness":100,"damping":6}：沒給設定時 Spring 用的值。' },
      },
    ],
    related: ['Lag', 'Spring', 'Trail', 'Count', 'envelope'],
    keywords: {
      en: ['defaults', 'default values', 'settings', 'constants', 'options'],
      zh: ['預設值', '預設', '設定', '常數', '選項'],
    },
  },
};
