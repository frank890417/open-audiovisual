// @openav/pattern reference: one line of rhythm text. Read by tools/build-reference.mjs (see AGENTS.md, "Documenting a public name").
// The keys are the public names the code has (tools/reference/scan.mjs reads them); a key the code does not have is a red test.
// Module examples run as ES modules in the reference smoke, with an import map for every @openav/* package.

export default {
  compile: {
    group: 'drums',
    summary: {
      en: "Reads one line of rhythm text, like 'bd*4, [~ sd]*2, hh*8', and gives back the drum hits of any bar you ask for. It never throws.",
      zh: "把一行節奏文字，像 'bd*4, [~ sd]*2, hh*8'，讀成任何一個小節要打哪些鼓。它不會丟出錯誤。",
    },
    params: [
      { name: 'src', type: 'String', en: 'The line of rhythm, for example `\'bd sd hh\'`. Anything that is not a string is turned into one (`null` and `undefined` become an empty line, which is an error).', zh: '一行節奏，例如 `\'bd sd hh\'`。不是字串的東西會被轉成字串（`null` 和 `undefined` 變成空的一行，那是錯誤）。' },
      { name: 'words', type: 'Object', optional: true, default: 'WORDS', en: 'Which words mean which drum: `{ word: voice }`. The default is [`WORDS`](#WORDS). To add a word, spread the default: `{ ...WORDS, boom: \'kick\' }`. The voice should be one the drum kit plays, see [`GM`](#GM).', zh: '哪個字代表哪一種鼓：`{ 字: 鼓聲 }`。預設是 [`WORDS`](#WORDS)。要多加一個字，就把預設展開：`{ ...WORDS, boom: \'kick\' }`。鼓聲要是鼓組會打的，見 [`GM`](#GM)。' },
    ],
    returns: {
      type: 'Object',
      en: '`{ ok, error, src, voices, layers, period, eventsInBar(bar, { seed }) }`. `ok` is true when the line was read. `error` is `null`, or `{ code, index, length, message, hint }`. `voices` lists the drums the line uses, in the order they first appear. `layers` counts the comma parts. `period` is the number of bars until the written rhythm repeats.',
      zh: '`{ ok, error, src, voices, layers, period, eventsInBar(bar, { seed }) }`。`ok` 是 true 表示這一行讀懂了。`error` 是 `null`，或 `{ code, index, length, message, hint }`。`voices` 列出這一行用到的鼓，依第一次出現的順序。`layers` 是逗號分出來的層數。`period` 是寫出來的節奏要幾個小節才會重複。',
    },
    description: [
      {
        en: "`compile()` is the one function you need to turn a line of rhythm into hits. `compile('bd sd hh').eventsInBar(1)` answers \"what happens in bar 1?\" with a list of hits, sorted by `pos`. Bars count from 1, and one bar is one cycle of the line: the words share the bar equally, so `bd sd hh` puts a kick at 0, a snare at 1/3 and a hat at 2/3.",
        zh: "要把一行節奏變成鼓點，用 `compile()` 就夠了。`compile('bd sd hh').eventsInBar(1)` 回答「第 1 小節發生什麼事」，給你一串按 `pos` 排好的鼓點。小節從 1 開始數，一個小節就是這一行的一個循環：字平分這個小節，所以 `bd sd hh` 是大鼓在 0、小鼓在 1/3、鈸在 2/3。",
      },
      {
        en: "Each hit from `eventsInBar(bar, { seed })` is `{ word, voice, n, pos, dur, vel, layer, token }`. `word` is what was written, `voice` the drum it plays (`'kick'`), `pos` where in the bar, 0 up to (not including) 1. `dur` is how long it lasts, in bars, and may run past the bar (`bd/2` lasts two). `vel` is always 1. `layer` is the index of the comma part it came from. `token` is `{ start, end }`, the character range of the word in `src`, so you can light the word while it sounds. `n` is the sample number from `bd:2`, or `null`. `n` is kept for you but does not change the sound.",
        zh: "`eventsInBar(bar, { seed })` 給的每個鼓點是 `{ word, voice, n, pos, dur, vel, layer, token }`。`word` 是寫的字，`voice` 是它打的鼓（`'kick'`），`pos` 是在小節的哪裡，從 0 到（不含）1。`dur` 是持續多久，單位是小節，可以超過這個小節（`bd/2` 長兩個小節）。`vel` 永遠是 1。`layer` 是它來自第幾個逗號層。`token` 是 `{ start, end }`，這個字在 `src` 裡的字元範圍，字在響的時候可以拿來點亮它。`n` 是 `bd:2` 的取樣編號，沒寫就是 `null`。`n` 會保留給你，但不會改變聲音。",
      },
      {
        en: "It never throws. A line it cannot read comes back as `{ ok: false, error }`, and `eventsInBar()` returns `[]` for every bar, so check `ok` before you trust the hits. `error.index` and `error.length` mark the characters that are wrong, `error.message` and `error.hint` are English sentences, and `error.code` is one of `empty`, `unclosed`, `unexpected`, `bad-number`, `bad-euclid`, `unknown-word` or `unsupported`. An `unknown-word` error also carries `suggestion`, the closest word or `null`. The words and the symbols you can write are listed below.",
        zh: "它不會丟出錯誤。讀不懂的一行會回傳 `{ ok: false, error }`，而且每個小節的 `eventsInBar()` 都回傳 `[]`，所以相信鼓點之前先檢查 `ok`。`error.index` 和 `error.length` 標出錯的字元，`error.message` 和 `error.hint` 是英文句子，`error.code` 是 `empty`、`unclosed`、`unexpected`、`bad-number`、`bad-euclid`、`unknown-word`、`unsupported` 其中之一。`unknown-word` 錯誤還會帶 `suggestion`，也就是最接近的字，沒有就是 `null`。可以寫的字和符號列在下面。",
      },
      {
        en: "```text\nbd sd hh      steps share the bar equally\n~  or  -       a rest\n[bd sd]        a group takes one step and splits it again\nbd*4           faster: 4 times in its step (decimals work: bd*1.5)\nbd/2           slower: once every 2 bars\n<bd sd>        one per bar, in turn\nbd, hh*8       a comma stacks layers\nbd(3,8)        Euclidean: 3 hits spread over 8 steps\nbd(3,8,2)      the same, starting 2 steps later\nbd!2  bd !     repeat the step (each copy takes a step)\nbd@3  bd _ _   make the step 3 times as long\nhh*8?  hh*8?0.3   drop each hit by chance (1/2, or 0.3)\nbd:2           sample number, kept in n\n```",
        zh: "```text\nbd sd hh      字平分一個小節\n~  或  -       休止\n[bd sd]        一組佔一格，再平分那一格\nbd*4           加快：在它那一格裡打 4 次（小數也行：bd*1.5）\nbd/2           放慢：每 2 個小節打一次\n<bd sd>        每小節輪一個\nbd, hh*8       逗號把幾層疊在一起\nbd(3,8)        歐幾里得節奏：3 下平均分在 8 格\nbd(3,8,2)      一樣，但晚 2 格開始\nbd!2  bd !     重複這一格（每個複本各佔一格）\nbd@3  bd _ _   這一格拉長成 3 倍\nhh*8?  hh*8?0.3   每一下用機率省略（1/2 或 0.3）\nbd:2           取樣編號，存在 n\n```",
      },
      {
        en: "Modifiers chain in the order written (`bd(3,8)*2`, `hh*8?`). Word case does not matter (`BD` is `bd`). `?` is decided by `seed` and the time of the hit, so the same seed and bar always give the same hits, while other bars and other seeds differ. Not supported, and refused with an `unsupported` error and a hint: `.` (Strudel's grouping), `|`, `{ }`, `%`, `..` and `^`. A dot matters most: lane strings like `'x...x...'` are not a line of rhythm, and a rest is `~`.",
        zh: "修飾符號照寫的順序一個接一個（`bd(3,8)*2`、`hh*8?`）。字的大小寫不影響（`BD` 就是 `bd`）。`?` 由 `seed` 和鼓點的時間決定，所以同一個 seed、同一個小節永遠打出一樣的鼓點，換一個小節或換一個 seed 就不同。不支援，並會用 `unsupported` 錯誤和提示拒絕的有：`.`（Strudel 的分組）、`|`、`{ }`、`%`、`..`、`^`。其中最重要的是點：像 `'x...x...'` 這種軌道字串不是一行節奏，休止要寫 `~`。",
      },
    ],
    notes: [
      {
        en: "Time inside is exact fractions, and each bar is computed on its own. Bar 1 000 000 of `[bd sd sn]*3` lands on the same ninths as bar 1, and asking for bar 500 is as cheap as asking for bar 2.",
        zh: "內部的時間用精確的分數，每個小節各自計算。`[bd sd sn]*3` 的第 1 000 000 小節跟第 1 小節落在一模一樣的九分之幾，問第 500 小節跟問第 2 小節一樣便宜。",
      },
      {
        en: "From a p5 sketch you do not call it: [`startDrums()`](#startDrums) takes the line and compiles it for you. Use `compile()` yourself when you want the hits as data, for a score, a drawing or a test.",
        zh: "在 p5 草圖裡不用自己呼叫：[`startDrums()`](#startDrums) 收下這一行，會替你編譯。想把鼓點當資料用，例如畫譜、畫圖或寫測試的時候，才自己呼叫 `compile()`。",
      },
      {
        en: "The way of writing comes from TidalCycles and Strudel. This is an independent implementation written from their public documentation. Where it differs from strudel.cc on purpose (a rotation of `n` steps or more wraps around, `*0` and `(9,8)` are errors, unknown names are errors), the package README says so.",
        zh: "這種寫法來自 TidalCycles 和 Strudel，這個套件是依他們的公開文件獨立實作的。刻意跟 strudel.cc 不同的地方（旋轉 `n` 格以上會繞回來、`*0` 和 `(9,8)` 是錯誤、不認識的字是錯誤），套件的 README 都有寫。",
      },
    ],
    examples: [
      {
        code: `import { compile } from '@openav/pattern';

const p = compile('bd sd hh');
for (const e of p.eventsInBar(1)) console.log(e.word, e.voice, e.pos.toFixed(2));
// bd kick 0.00
// sd snare 0.33
// hh hat 0.67`,
        caption: { en: 'Logs the three hits of bar 1: the word, the drum it plays, and where in the bar. Open the console to see them.', zh: '印出第 1 小節的三個鼓點：字、它打的鼓、在小節的哪裡。打開 console 就看得到。' },
      },
      {
        code: `import { compile } from '@openav/pattern';

const p = compile('<bd sd>, hh*4');
console.log(p.period);                                   // 2
for (const bar of [1, 2, 3]) {
  const words = p.eventsInBar(bar).filter((e) => e.layer === 0).map((e) => e.word);
  console.log('bar', bar, words.join(' '));
}
// bar 1 bd
// bar 2 sd
// bar 3 bd

const bad = compile('bd [sd');
console.log(bad.ok, bad.error.code, bad.error.index);   // false unclosed 3
console.log(bad.eventsInBar(1));                         // []`,
        caption: { en: 'A line that changes every bar: `<bd sd>` alternates, so `period` is 2. A line with a mistake comes back with `ok: false`, the error code and the character it starts at.', zh: '每個小節都不一樣的一行：`<bd sd>` 輪流出現，所以 `period` 是 2。有錯的一行會回傳 `ok: false`、錯誤代碼，和錯誤從哪個字元開始。' },
      },
      {
        code: `import { compile } from '@openav/pattern';

const p = compile('bd(3,8), [~ sd]*2, hh*8');
const g = document.getElementById('c').getContext('2d');
g.fillStyle = '#111'; g.fillRect(0, 0, 400, 300);
const colors = ['#ff7b54', '#ffd166', '#6f9bff'];
for (const e of p.eventsInBar(1)) {
  g.fillStyle = colors[e.layer];
  g.fillRect(20 + e.pos * 360, 40 + e.layer * 70, e.dur * 360 - 4, 40);   // dur is in bars
}`,
        caption: { en: 'Draws bar 1 on the canvas, one row per comma part: each hit is a block at its position, as long as it lasts.', zh: '把第 1 小節畫在畫布上，每個逗號層一排：每個鼓點是在它位置上的一塊，長度就是它持續的時間。' },
      },
    ],
    related: ['parse', 'WORDS', 'euclid', 'toGrid', 'DrumScheduler', 'startDrums'],
    keywords: {
      en: ['rhythm', 'mini-notation', 'tidal', 'strudel', 'pattern', 'drum', 'parse', 'events', 'bar', 'eventsInBar'],
      zh: ['節奏', '一行節奏', '鼓點', '小節', '編譯', '解析', 'strudel', '歐幾里得', '鼓機'],
    },
  },

  parse: {
    group: 'drums',
    summary: {
      en: 'Reads a line of rhythm into a tree of nodes, each with its character range. It does not look words up in the drum kit.',
      zh: '把一行節奏讀成一棵節點樹，每個節點都帶著它的字元範圍。它不會去查鼓組有沒有這個字。',
    },
    params: [
      { name: 'src', type: 'String', en: 'The line of rhythm, for example `\'bd [sd sd]\'`.', zh: '一行節奏，例如 `\'bd [sd sd]\'`。' },
    ],
    returns: {
      type: 'Object',
      en: '`{ ok: true, tree, error: null }`, or `{ ok: false, tree: null, error }` with the same `{ code, index, length, message, hint }` error as [`compile()`](#compile).',
      zh: '`{ ok: true, tree, error: null }`，或 `{ ok: false, tree: null, error }`，`error` 跟 [`compile()`](#compile) 的一樣，是 `{ code, index, length, message, hint }`。',
    },
    description: [
      {
        en: "`parse()` is the first half of [`compile()`](#compile): it checks the grammar and builds the tree, and stops there. Use it when you want to look at the structure of a line, for example to colour its words or find a mistake. For the hits, call `compile()`.",
        zh: "`parse()` 是 [`compile()`](#compile) 的前半段：只檢查文法、建出樹，到此為止。想看一行的結構，例如幫字上色或找錯誤的時候用它。要鼓點的話，呼叫 `compile()`。",
      },
      {
        en: "The root is always a `layer` whose `layers` are the top-level comma parts, and each of those is a `seq`. The node types are `step` `{ word, n }`, `rest`, `seq` `{ steps: [{ node, weight }] }`, `layer` `{ layers }`, `alt` `{ steps }` (one per bar), `fast` and `slow` `{ factor, node }`, `euclid` `{ pulses, slots, rotate, node }` and `maybe` `{ chance, id, node }`. Every node has `start` and `end`, its character range in `src`. Weights and factors are fractions `[numerator, denominator]`, so `bd*1.5` has the factor `[3, 2]`.",
        zh: "樹根永遠是 `layer`，它的 `layers` 是最上層用逗號分開的幾部分，每一部分是一個 `seq`。節點的種類有 `step` `{ word, n }`、`rest`、`seq` `{ steps: [{ node, weight }] }`、`layer` `{ layers }`、`alt` `{ steps }`（每小節一個）、`fast` 和 `slow` `{ factor, node }`、`euclid` `{ pulses, slots, rotate, node }`、`maybe` `{ chance, id, node }`。每個節點都有 `start` 和 `end`，也就是它在 `src` 裡的字元範圍。權重和倍數是分數 `[分子, 分母]`，所以 `bd*1.5` 的倍數是 `[3, 2]`。",
      },
    ],
    notes: [
      {
        en: "Because `parse()` never looks at the drum kit, `parse('kik')` succeeds while `compile('kik')` fails with `unknown-word`. Everything else (an unclosed bracket, `*0`, `(9,8)`) fails in both.",
        zh: "因為 `parse()` 不看鼓組，`parse('kik')` 會成功，`compile('kik')` 卻會失敗，錯誤是 `unknown-word`。其他的錯（括號沒關、`*0`、`(9,8)`）兩個都會失敗。",
      },
    ],
    examples: [
      {
        code: `import { parse } from '@openav/pattern';

const r = parse('bd [sd hh]*2');
console.log(r.ok);                                          // true
console.log(r.tree.layers[0].steps.map((s) => s.node.type)); // ['step', 'fast']
console.log(parse('bd [sd').error.code);                    // unclosed`,
        caption: { en: 'Logs the type of each step of the first layer (a plain step, then a group made faster), and the error code of a line with an unclosed bracket.', zh: '印出第一層每一格的種類（一個普通的字，接著一組被加快的），以及括號沒關的那一行的錯誤代碼。' },
      },
      {
        code: `import { parse } from '@openav/pattern';

// light every word of the line: each step node knows its characters
const src = 'bd*4, [~ sd]*2, hh*8';
const words = [];
const walk = (node) => {
  if (node.type === 'step') words.push(src.slice(node.start, node.end) + '@' + node.start);
  for (const s of node.steps || []) walk(s.node);
  for (const l of node.layers || []) walk(l);
  if (node.node) walk(node.node);
};
walk(parse(src).tree);
console.log(words.join(' '));   // bd@0 sd@9 hh@16`,
        caption: { en: 'Walks the tree and logs each word with the character it starts at, the data you need to colour words in an editor.', zh: '走過整棵樹，印出每個字和它開始的字元位置，在編輯器裡幫字上色就需要這份資料。' },
      },
    ],
    related: ['compile', 'toGrid', 'toStrudel'],
    keywords: {
      en: ['parse', 'tree', 'syntax', 'grammar', 'ast', 'mini-notation', 'nodes', 'tokens'],
      zh: ['解析', '語法樹', '文法', '節點', '一行節奏', '字元範圍'],
    },
  },

  euclid: {
    group: 'drums',
    summary: {
      en: 'Spreads a number of hits as evenly as possible over a number of steps, the Euclidean rhythm. `euclid(3, 8)` is the tresillo.',
      zh: '把一些鼓點盡量平均地分在一些格子上，也就是歐幾里得節奏。`euclid(3, 8)` 就是 tresillo。',
    },
    params: [
      { name: 'pulses', type: 'Number', en: 'How many hits. A negative number plays the gaps instead: `euclid(-3, 8)` is the five steps `euclid(3, 8)` leaves out. More hits than steps fills every step. The number is cut to a whole number.', zh: '有幾下。負數會打空隙：`euclid(-3, 8)` 是 `euclid(3, 8)` 沒打的那五格。比格數多的話，每一格都會打。小數會被去掉。' },
      { name: 'steps', type: 'Number', en: 'How many steps. Fewer than 1 gives an empty array.', zh: '有幾格。小於 1 會得到空陣列。' },
      { name: 'rotate', type: 'Number', optional: true, default: '0', en: 'Start the pattern this many steps later. Negative starts earlier, and a number of `steps` or more wraps around.', zh: '讓節奏晚這麼多格開始。負數是提早，`steps` 以上的數字會繞回來。' },
    ],
    returns: { type: 'Boolean[]', en: 'An array of `steps` booleans, true where there is a hit.', zh: '一個長度 `steps` 的布林陣列，有鼓點的地方是 true。' },
    description: [
      {
        en: "It is the function behind `bd(3,8)` in a line of rhythm: [`compile()`](#compile) calls it for every `(k,n)`. Use it on its own when you want the pattern as data, for a drawing or your own sequencer. `euclid(3, 8)` is `x..x..x.`, and `euclid(5, 8)` is `x.xx.xx.`.",
        zh: "一行節奏裡的 `bd(3,8)` 就是靠它：[`compile()`](#compile) 每遇到一個 `(k,n)` 就會呼叫它。想把這個節奏當資料用，例如畫圖或接到自己的音序器，就單獨呼叫它。`euclid(3, 8)` 是 `x..x..x.`，`euclid(5, 8)` 是 `x.xx.xx.`。",
      },
      {
        en: "It follows Bjorklund's procedure as Toussaint (2005) describes it. `rotate` moves the pattern later, the direction strudel.cc plays: `euclid(3, 8, 2)` is `x.x..x..`, the hits of `euclid(3, 8)` moved two steps to the right.",
        zh: "它照 Toussaint（2005）說明的 Bjorklund 方法做。`rotate` 把節奏往後移，方向跟 strudel.cc 一樣：`euclid(3, 8, 2)` 是 `x.x..x..`，也就是 `euclid(3, 8)` 的鼓點往右移兩格。",
      },
    ],
    examples: [
      {
        code: `import { euclid } from '@openav/pattern';

const show = (bits) => bits.map((b) => (b ? 'x' : '.')).join('');
console.log(show(euclid(3, 8)));      // x..x..x.
console.log(show(euclid(5, 8)));      // x.xx.xx.
console.log(show(euclid(3, 8, 2)));   // x.x..x..`,
        caption: { en: 'Logs three rhythms as text: `x` is a hit and `.` is a rest. The third is the first one moved two steps later.', zh: '把三個節奏印成文字：`x` 是鼓點、`.` 是休止。第三個是第一個往後移兩格。' },
      },
      {
        code: `import { euclid } from '@openav/pattern';

const g = document.getElementById('c').getContext('2d');
g.fillStyle = '#111'; g.fillRect(0, 0, 400, 300);
g.fillStyle = '#ffd166';
euclid(5, 16).forEach((hit, i) => {          // 5 hits on 16 steps
  g.globalAlpha = hit ? 1 : 0.2;
  g.fillRect(12 + i * 23, 120, 18, 60);
});
console.log(euclid(5, 16).filter(Boolean).length);   // 5`,
        caption: { en: 'Draws sixteen blocks and lights five of them, spread as evenly as sixteen steps allow.', zh: '畫十六個方塊，點亮其中五個，分得跟十六格能做到的一樣平均。' },
      },
    ],
    related: ['compile', 'toGrid', 'fromGrid'],
    keywords: {
      en: ['euclidean', 'euclid', 'bjorklund', 'toussaint', 'tresillo', 'cinquillo', 'spread hits', 'rhythm generator', 'polyrhythm'],
      zh: ['歐幾里得', '歐氏節奏', 'bjorklund', '平均分配', '節奏產生器', '旋轉', 'tresillo'],
    },
  },

  fromGrid: {
    group: 'drums',
    summary: {
      en: 'Turns a grid of steps, like the drum machine card, into the one line of rhythm a person would write for it.',
      zh: '把一張格子圖，像鼓機卡上的那種，轉成一個人會為它寫的那一行節奏。',
    },
    params: [
      { name: 'grid', type: 'Object', en: 'The steps: `{ lane: \'x...x...\' }` or `{ lane: [1, 0, 0, 0, …] }`. A lane is named by its drum (`kick`) or its word (`bd`). `x`, `X`, `1` and `true` are hits, `|` and spaces are ignored. A lane with no name the kit knows is left out.', zh: '格子：`{ 軌道: \'x...x...\' }` 或 `{ 軌道: [1, 0, 0, 0, …] }`。軌道可以用鼓的名字（`kick`）或字（`bd`）命名。`x`、`X`、`1`、`true` 是鼓點，`|` 和空白會被忽略。名字不是鼓組認得的軌道會被丟掉。' },
      { name: 'steps', type: 'Number', optional: true, default: '16', en: 'How many steps each lane has.', zh: '每條軌道有幾格。' },
      { name: 'words', type: 'Object', optional: true, default: 'null', en: 'Keep your own spelling: `{ kick: \'kick\' }` writes `kick*4` instead of `bd*4`.', zh: '保留你自己的寫法：`{ kick: \'kick\' }` 會寫成 `kick*4` 而不是 `bd*4`。' },
      { name: 'order', type: 'String[]', optional: true, default: 'null', en: 'Drums to put first, in this order, for example `[\'kick\', \'snare\']`. The rest follow in the order of the grid\'s keys.', zh: '要放在最前面的鼓，照這個順序，例如 `[\'kick\', \'snare\']`。其他的接在後面，照格子圖的鍵的順序。' },
    ],
    returns: { type: 'String', en: 'One line of rhythm that plays exactly the grid. A grid with no hit anywhere gives `\'~\'`.', zh: '一行剛好打出這張格子圖的節奏。完全沒有鼓點的格子圖會得到 `\'~\'`。' },
    description: [
      {
        en: "It is what happens when you click a cell of the drum machine card: the grid has to come back as text. Each lane becomes one layer, joined with `, `, and it picks the shortest honest spelling. Steady hits become `bd*4` or `hh*8`, one hit per group `[~ sd]*2`, a Euclidean rhythm `bd(3,8)`, and anything else is written beat by beat, like `bd [~ ~ ~ bd] bd*2 ~`. It never throws.",
        zh: "按下鼓機卡上的一個格子，就是在做這件事：格子圖要變回文字。每條軌道變成一層，用 `, ` 接起來，並選最短又準確的寫法。平穩的鼓點寫成 `bd*4` 或 `hh*8`，每組一下寫成 `[~ sd]*2`，歐幾里得節奏寫成 `bd(3,8)`，其他的一拍一拍寫，像 `bd [~ ~ ~ bd] bd*2 ~`。它不會丟出錯誤。",
      },
      {
        en: "The line is exact: [`compile()`](#compile) of the result lands on the same steps, in every bar. The rules are in the package README, and the tests check a thousand random grids.",
        zh: "這一行是精確的：把結果交給 [`compile()`](#compile)，每個小節都會落在同樣的格子上。規則寫在套件的 README，測試用一千張隨機的格子圖驗證過。",
      },
    ],
    examples: [
      {
        code: `import { fromGrid } from '@openav/pattern';

console.log(fromGrid({
  kick: 'x...x...x...x...',
  snare: '....x.......x...',
  hat: 'x.x.x.x.x.x.x.x.',
}));
// bd*4, [~ sd]*2, hh*8`,
        caption: { en: 'Logs the line for a classic four-on-the-floor grid: a kick on every beat, a snare on 2 and 4, eight hats.', zh: '印出經典四四拍格子圖的那一行：每一拍大鼓、第 2 和第 4 拍小鼓、八下鈸。' },
      },
      {
        code: `import { fromGrid, compile } from '@openav/pattern';

const grid = { kick: [1,0,0,0,0,0,1,0,0,0,0,0,1,0,0,0], hat: 'x.x.x.x.x.x.x.x.' };
const line = fromGrid(grid, { order: ['kick'] });
console.log(line);                          // bd(3,8), hh*8
console.log(compile(line).ok);              // true
console.log(fromGrid(grid, { words: { kick: 'kick' } }));   // kick(3,8), hh*8
console.log(fromGrid({}));                  // ~`,
        caption: { en: 'A lane can be an array of 0 and 1. The hits at steps 0, 6 and 12 are recognised as a Euclidean rhythm. `words` keeps your own spelling, and an empty grid is one rest.', zh: '一條軌道也可以是 0 和 1 的陣列。第 0、6、12 格的鼓點被認成歐幾里得節奏。`words` 保留你自己的寫法，空的格子圖就是一個休止。' },
      },
    ],
    related: ['toGrid', 'compile', 'euclid', 'toStrudel'],
    keywords: {
      en: ['grid', 'steps', 'step sequencer', 'cells', 'lanes', 'to text', 'write rhythm', 'drum machine card'],
      zh: ['格子', '步進', '步進音序器', '軌道', '轉成文字', '鼓機卡', '一行節奏'],
    },
  },

  toGrid: {
    group: 'drums',
    summary: {
      en: 'Shows one bar of a line of rhythm on a grid of steps, and tells you what the grid cannot hold.',
      zh: '把一行節奏的某一個小節畫成格子圖，並告訴你格子放不下哪些東西。',
    },
    params: [
      { name: 'p', type: 'String | Object', en: 'A line of rhythm, or the result of [`compile()`](#compile).', zh: '一行節奏，或 [`compile()`](#compile) 的結果。' },
      { name: 'bar', type: 'Number', optional: true, default: '1', en: 'Which bar to show, counting from 1.', zh: '要看哪個小節，從 1 開始數。' },
      { name: 'steps', type: 'Number', optional: true, default: '16', en: 'How many steps the grid has.', zh: '格子有幾格。' },
      { name: 'seed', type: 'Number', optional: true, default: '0', en: 'Decides each `?`, the same way as in `eventsInBar()`.', zh: '決定每一個 `?`，跟 `eventsInBar()` 裡的用法一樣。' },
      { name: 'bars', type: 'Number', optional: true, default: '16', en: 'How many bars to look through to find out whether the other bars differ (`lost.varies`). At most the line\'s `period`, and never more than 64.', zh: '要看幾個小節，用來判斷其他小節有沒有不同（`lost.varies`）。最多看到這一行的 `period`，而且不會超過 64。' },
      { name: 'words', type: 'Object', optional: true, default: 'WORDS', en: 'Which words mean which drum, the same as in [`compile()`](#compile).', zh: '哪個字代表哪一種鼓，跟 [`compile()`](#compile) 一樣。' },
    ],
    returns: {
      type: 'Object',
      en: '`{ ok, grid, words, voices, exact, lost }`. `grid` is `{ voice: [0 or 1 × steps] }`. `words` is the word the line used for each drum. `voices` lists the drums. `exact` is true when the grid holds the bar completely. `lost` counts what it cannot: `{ offGrid, stacked, varies, random, samples }`. If the line cannot be read, `ok` is false and the rest is empty.',
      zh: '`{ ok, grid, words, voices, exact, lost }`。`grid` 是 `{ 鼓聲: [0 或 1，共 steps 個] }`。`words` 是這一行為每種鼓用的字。`voices` 列出鼓。`exact` 是 true 表示格子完整放得下這個小節。`lost` 數出放不下的東西：`{ offGrid, stacked, varies, random, samples }`。這一行讀不懂的話，`ok` 是 false，其他都是空的。',
    },
    description: [
      {
        en: "It is the way back from [`fromGrid()`](#fromGrid), and what the drum machine card uses to draw the cells of a line. Each hit goes to the step it is nearest to. The `lost` fields say what that cost: `offGrid` is the number of hits that sit between steps (triplets) and were moved to the nearest one. `stacked` counts two hits of one drum on one step. `varies` is true when other bars differ (`< >`, `/2`). `random` is true when the line has a `?`. `samples` is true when it has a sample number like `bd:2`. `exact` is true only when none of these happened.",
        zh: "它是 [`fromGrid()`](#fromGrid) 的反方向，鼓機卡就是用它畫出一行節奏的格子。每個鼓點會放到離它最近的那一格。`lost` 的欄位告訴你這樣損失了什麼：`offGrid` 是落在格子之間（三連音）而被移到最近一格的鼓點數量。`stacked` 是同一種鼓在同一格有兩下。`varies` 為 true 表示其他小節不一樣（`< >`、`/2`）。`random` 為 true 表示這一行有 `?`。`samples` 為 true 表示有像 `bd:2` 的取樣編號。只有這些都沒發生，`exact` 才是 true。",
      },
      {
        en: "A line that fails to compile does not throw: you get `ok: false`.",
        zh: "編譯失敗的一行不會丟出錯誤，你會得到 `ok: false`。",
      },
    ],
    examples: [
      {
        code: `import { toGrid } from '@openav/pattern';

const g = toGrid('bd*4, [~ sd]*2, hh*8');
console.log(g.exact);                        // true
console.log(g.grid.snare.join(''));          // 0000100000001000
console.log(g.words);                        // { kick: 'bd', snare: 'sd', hat: 'hh' }`,
        caption: { en: 'A line that fits the sixteen steps: `exact` is true, and each drum has its row of 0 and 1.', zh: '一行放得進十六格：`exact` 是 true，每種鼓有它那一排 0 和 1。' },
      },
      {
        code: `import { toGrid } from '@openav/pattern';

console.log(toGrid('bd [sd sd sd]').lost.offGrid);      // 2, the triplet sits between steps
console.log(toGrid('<bd sd>', { bar: 2 }).lost.varies); // true
console.log(toGrid('hh*8?').lost.random);               // true
console.log(toGrid('bd:2').exact);                      // false, the sample number is lost
console.log(toGrid('bd . sd').ok);                      // false, not a line of rhythm`,
        caption: { en: 'Five lines and what each costs on a grid: triplets move, alternating bars and chance cannot be shown, and a line that does not compile has no grid at all.', zh: '五行節奏，以及各自放進格子要付出的代價：三連音會移位，輪流的小節和機率顯示不出來，編譯失敗的一行根本沒有格子。' },
      },
    ],
    related: ['fromGrid', 'compile', 'DrumScheduler', 'mountDrums'],
    keywords: {
      en: ['grid', 'steps', 'cells', 'to grid', 'step sequencer', 'quantize', 'triplet', 'off grid', 'lossy'],
      zh: ['格子', '步進', '轉成格子', '三連音', '對齊格子', '鼓機卡', '放不下'],
    },
  },

  fromStrudel: {
    group: 'drums',
    summary: {
      en: 'Reads code copied from strudel.cc, like `s("bd*4").fast(2)`, into the line of rhythm OAV plays, plus the tempo it found.',
      zh: '把從 strudel.cc 複製來的程式碼，像 `s("bd*4").fast(2)`，讀成 OAV 會打的那一行節奏，並附上找到的速度。',
    },
    params: [
      { name: 'code', type: 'String', en: 'The Strudel code, as copied from the strudel.cc editor.', zh: '從 strudel.cc 編輯器複製來的 Strudel 程式碼。' },
    ],
    returns: {
      type: 'Object',
      en: '`{ strudel, ok, src, bpm, ignored, unsupported }`. `strudel` is false when the text has no `s(…)` or `sound(…)` in it. `ok` is true when there is a line of rhythm in `src`. `bpm` is the tempo from `setcpm()` or `setcps()`, else `null`. `ignored` lists what was left out on purpose (`.bank(…)`), `unsupported` what OAV does not do (`.jux(rev)`, `.gain(…)`).',
      zh: '`{ strudel, ok, src, bpm, ignored, unsupported }`。文字裡沒有 `s(…)` 或 `sound(…)` 的話，`strudel` 是 false。`src` 裡有一行節奏的話，`ok` 是 true。`bpm` 是 `setcpm()` 或 `setcps()` 給的速度，沒有就是 `null`。`ignored` 列出刻意略過的（`.bank(…)`），`unsupported` 列出 OAV 不做的（`.jux(rev)`、`.gain(…)`）。',
    },
    description: [
      {
        en: "It lets someone paste what they made in Strudel. It reads `s(\"…\")` and `sound(\"…\")` with `\"`, `'` or backtick quotes. Several of them (also with a label like `$:` or `name:` in front) become layers. A `.fast(n)` or `.slow(n)` is folded into the line as `[…]*n` or `[…]/n`. `setcpm(x)` gives `bpm` as x times 4, `setcps(x)` as x times 240. `.bank(…)` goes to `ignored`, because OAV plays its own kit. Any other call or statement goes to `unsupported`, and the rest still plays. It never throws.",
        zh: "它讓人可以貼上自己在 Strudel 做的東西。它讀 `s(\"…\")` 和 `sound(\"…\")`，引號可以是 `\"`、`'` 或反引號。好幾個（前面也可以有 `$:` 或 `name:` 這種標籤）會變成好幾層。`.fast(n)` 或 `.slow(n)` 會折進那一行，變成 `[…]*n` 或 `[…]/n`。`setcpm(x)` 的 `bpm` 是 x 乘 4，`setcps(x)` 是 x 乘 240。`.bank(…)` 進 `ignored`，因為 OAV 打的是自己的鼓組。其他的呼叫或敘述都進 `unsupported`，剩下的照樣會打。它不會丟出錯誤。",
      },
      {
        en: "It only reshapes text: it does not check the words. `fromStrudel('s(\"bd kik\")')` gives `ok: true` with `src: 'bd kik'`, so pass `src` to [`compile()`](#compile) and look at its `ok`. [`startDrums()`](#startDrums) accepts Strudel code directly and does all of this for you.",
        zh: "它只是把文字重新整理，不會檢查字。`fromStrudel('s(\"bd kik\")')` 會回 `ok: true` 和 `src: 'bd kik'`，所以要把 `src` 交給 [`compile()`](#compile)，看它的 `ok`。[`startDrums()`](#startDrums) 可以直接收 Strudel 程式碼，這些事都替你做了。",
      },
    ],
    examples: [
      {
        code: `import { fromStrudel, compile } from '@openav/pattern';

const r = fromStrudel('setcpm(110/4)\\ns("bd*4, [~ sd]*2").bank("RolandTR909").fast(2).jux(rev)');
console.log(r.src);            // [bd*4, [~ sd]*2]*2
console.log(r.bpm);            // 110
console.log(r.ignored);        // ['.bank("RolandTR909")']
console.log(r.unsupported);    // ['.jux(rev)']
console.log(compile(r.src).ok); // true`,
        caption: { en: 'Reads a typical Strudel snippet: `.fast(2)` is folded into the line, the tempo is found, `.bank()` is ignored and `.jux()` is reported as unsupported.', zh: '讀一段常見的 Strudel 程式：`.fast(2)` 折進那一行，找到速度，`.bank()` 被略過，`.jux()` 被回報為不支援。' },
      },
      {
        code: `import { fromStrudel } from '@openav/pattern';

console.log(fromStrudel('note("c e g")').strudel);   // false, no s("…") in it
console.log(fromStrudel('s("bd kik")').ok);          // true: the words are not checked
console.log(fromStrudel('setcps(0.5)\\ns("bd")').bpm); // 120`,
        caption: { en: 'The edges: text with no `s(…)` is not Strudel for OAV, a misspelled word still passes, and `setcps(0.5)` is 120 bpm.', zh: '邊界情況：沒有 `s(…)` 的文字對 OAV 來說不是 Strudel，拼錯的字還是會通過，`setcps(0.5)` 是 120 bpm。' },
      },
    ],
    related: ['toStrudel', 'strudelUrl', 'compile', 'startDrums'],
    keywords: {
      en: ['strudel', 'strudel.cc', 'import', 'paste', 'tidal', 'live coding', 'setcpm', 'fast', 'slow'],
      zh: ['strudel', '匯入', '貼上', '直播編碼', 'live coding', '速度', 'setcpm'],
    },
  },

  toStrudel: {
    group: 'drums',
    summary: {
      en: "Turns a line of rhythm into Strudel code: OAV's drum words become Strudel's, with a tempo line and a comment if you give them.",
      zh: '把一行節奏轉成 Strudel 程式碼：OAV 的鼓的字換成 Strudel 的字，有給的話還會加上速度那行和註解。',
    },
    params: [
      { name: 'src', type: 'String', en: 'The line of rhythm.', zh: '一行節奏。' },
      { name: 'bpm', type: 'Number', optional: true, default: 'null', en: 'The tempo. When it is above 0 a `setcpm(bpm/4)` line is written, because one OAV bar is one Strudel cycle of four beats.', zh: '速度。大於 0 的話會寫一行 `setcpm(bpm/4)`，因為 OAV 的一個小節就是 Strudel 的一個四拍的循環。' },
      { name: 'comment', type: 'String', optional: true, default: "''", en: 'A line to put first as a `//` comment.', zh: '要放在最前面的一行 `//` 註解。' },
      { name: 'words', type: 'Object', optional: true, default: 'WORDS', en: 'Which words mean which drum, the same as in [`compile()`](#compile).', zh: '哪個字代表哪一種鼓，跟 [`compile()`](#compile) 一樣。' },
    ],
    returns: { type: 'String', en: 'The Strudel code, one to three lines, ending in `s("…")`.', zh: 'Strudel 程式碼，一到三行，最後一行是 `s("…")`。' },
    description: [
      {
        en: "The words become the names Strudel's drum sounds use: `kick` becomes `bd`, `pedalhat` becomes `hh`. A rotation of `n` steps or more in a Euclidean part, like `bd(3,8,10)`, is written as the rotation OAV plays (`bd(3,8,2)`), because strudel.cc would play it unrotated. A line that does not read is passed through unchanged, so the result may not play in Strudel: check it with [`compile()`](#compile) first. It never throws.",
        zh: "字會換成 Strudel 的鼓的名字：`kick` 變 `bd`，`pedalhat` 變 `hh`。歐幾里得的旋轉在 `n` 格以上的，像 `bd(3,8,10)`，會寫成 OAV 實際打的旋轉（`bd(3,8,2)`），因為 strudel.cc 會把它當作沒旋轉。讀不懂的一行會原樣放過去，所以結果在 Strudel 裡可能打不出來，先用 [`compile()`](#compile) 檢查。它不會丟出錯誤。",
      },
      {
        en: "To open the result in the Strudel editor, use [`strudelUrl()`](#strudelUrl).",
        zh: "要在 Strudel 編輯器裡打開結果，用 [`strudelUrl()`](#strudelUrl)。",
      },
    ],
    examples: [
      {
        code: `import { toStrudel } from '@openav/pattern';

console.log(toStrudel('kick*4, pedalhat*8', { bpm: 110, comment: 'from OAV' }));
// // from OAV
// setcpm(110/4)
// s("bd*4, hh*8")`,
        caption: { en: 'Logs three lines of Strudel code: the comment, the tempo, and the pattern with Strudel\'s names for the drums.', zh: '印出三行 Strudel 程式碼：註解、速度，和用 Strudel 的鼓名寫的節奏。' },
      },
      {
        code: `import { toStrudel } from '@openav/pattern';

console.log(toStrudel('bd(3,8,10)'));   // s("bd(3,8,2)")
console.log(toStrudel('bd . sd'));      // s("bd . sd"), a line that does not read passes through`,
        caption: { en: 'A rotation past the number of steps is written the way OAV plays it, and a line with a mistake is not touched.', zh: '超過格數的旋轉，會寫成 OAV 實際打的樣子，有錯的一行則不會被動到。' },
      },
    ],
    related: ['strudelUrl', 'fromStrudel', 'compile'],
    keywords: {
      en: ['strudel', 'export', 'strudel.cc', 'open in strudel', 'setcpm', 'bd', 'convert'],
      zh: ['strudel', '匯出', '轉成 strudel', '速度', 'setcpm', '轉換'],
    },
  },

  strudelUrl: {
    group: 'drums',
    summary: {
      en: 'Makes a strudel.cc link that opens the line of rhythm in the Strudel editor.',
      zh: '做出一個 strudel.cc 的連結，打開後 Strudel 編輯器裡就是這一行節奏。',
    },
    params: [
      { name: 'src', type: 'String', en: 'The line of rhythm.', zh: '一行節奏。' },
      { name: 'opts', type: 'Object', optional: true, default: '{}', en: 'The options of [`toStrudel()`](#toStrudel): `{ bpm, comment, words }`.', zh: '[`toStrudel()`](#toStrudel) 的選項：`{ bpm, comment, words }`。' },
    ],
    returns: { type: 'String', en: 'A URL: `\'https://strudel.cc/#\'` and the code from [`toStrudel()`](#toStrudel), as UTF-8 base64, URL-encoded.', zh: '一個網址：`\'https://strudel.cc/#\'` 加上 [`toStrudel()`](#toStrudel) 的程式碼，轉成 UTF-8 的 base64，再做網址編碼。' },
    description: [
      {
        en: "The format is the one strudel.cc shows in its own address bar. It is what the drum machine card's **Open in Strudel** link uses. Open it in a **new tab**: a strudel.cc tab that is already open does not read a changed `#`.",
        zh: "格式就是 strudel.cc 自己的網址列顯示的那種，鼓機卡上的 **在 Strudel 打開** 連結用的就是它。要在**新分頁**打開：已經開著的 strudel.cc 分頁不會重讀改變過的 `#`。",
      },
    ],
    notes: [
      {
        en: "OAV only builds the link. No Strudel code runs in, or ships with, OAV.",
        zh: "OAV 只是做出連結，沒有任何 Strudel 的程式碼在 OAV 裡執行，也沒有隨 OAV 一起發佈。",
      },
    ],
    tbd: [
      {
        en: "Not opened in strudel.cc from this build: the link format was read off strudel.cc's address bar on 2026-10-15 (README), and a strudel.cc change could break it.",
        zh: "這個版本沒有實際在 strudel.cc 打開過：連結格式是 2026-10-15 從 strudel.cc 的網址列讀出來的（見 README），strudel.cc 改版的話可能會失效。",
      },
    ],
    examples: [
      {
        code: `import { strudelUrl } from '@openav/pattern';

const url = strudelUrl('bd*4, [~ sd]*2, hh*8', { bpm: 110 });
console.log(url.startsWith('https://strudel.cc/#'));            // true
const code = atob(decodeURIComponent(url.split('#')[1]));
console.log(code);                                              // setcpm(110/4)
                                                                // s("bd*4, [~ sd]*2, hh*8")

const a = document.getElementById('app').appendChild(document.createElement('a'));
a.href = url; a.target = '_blank'; a.textContent = 'Open in Strudel';`,
        caption: { en: 'Builds the link, decodes it again to show the code inside, and puts it on the page as a link that opens in a new tab.', zh: '做出連結，再解碼一次讓你看到裡面的程式碼，並放在頁面上，做成會在新分頁打開的連結。' },
      },
    ],
    related: ['toStrudel', 'fromStrudel', 'mountDrums'],
    keywords: {
      en: ['strudel', 'link', 'url', 'open', 'share', 'strudel.cc', 'base64'],
      zh: ['strudel', '連結', '網址', '打開', '分享', 'base64'],
    },
  },

  WORDS: {
    group: 'drums',
    summary: {
      en: 'The drum words a line of rhythm may use and the drum each one plays: `bd` is `kick`, `sd` is `snare`, `hh` is `hat`.',
      zh: '一行節奏可以用的鼓的字，以及每個字打哪一種鼓：`bd` 是 `kick`，`sd` 是 `snare`，`hh` 是 `hat`。',
    },
    value: {
      type: 'Object',
      en: 'A frozen object of 26 `{ word: voice }` pairs. Keys are lowercase, and [`compile()`](#compile) ignores the case of what you write.',
      zh: '一個凍結的物件，有 26 組 `{ 字: 鼓聲 }`。鍵是小寫，[`compile()`](#compile) 不管你寫的大小寫。',
    },
    description: [
      {
        en: "The short words are the ones TidalCycles and Strudel use: `bd` kick, `sd` and `sn` snare, `hh` hat, `oh` open hat, `cp` clap, `rim` and `rs` rim, `lt` low tom, `mt` tom, `ht` high tom, `cr` crash, `rd` ride, `cb` cowbell. Each drum's own name works too: `kick`, `snare`, `hat`, `openhat`, `pedalhat`, `clap`, `lowtom`, `tom`, `hightom`, `crash`, `ride`, `cowbell`. The values are the drum names of [`GM`](#GM).",
        zh: "短的字是 TidalCycles 和 Strudel 用的：`bd` 大鼓、`sd` 和 `sn` 小鼓、`hh` 鈸、`oh` 開鈸、`cp` 拍手、`rim` 和 `rs` 鼓邊、`lt` 落地鼓、`mt` 中鼓、`ht` 高音中鼓、`cr` 碎音鈸、`rd` 疊音鈸、`cb` 牛鈴。每種鼓自己的名字也能用：`kick`、`snare`、`hat`、`openhat`、`pedalhat`、`clap`、`lowtom`、`tom`、`hightom`、`crash`、`ride`、`cowbell`。值就是 [`GM`](#GM) 裡的鼓的名字。",
      },
      {
        en: "It is the default of the `words` option of [`compile()`](#compile), [`toGrid()`](#toGrid) and [`toStrudel()`](#toStrudel). To teach a line a new word, pass a copy with your word added.",
        zh: "它是 [`compile()`](#compile)、[`toGrid()`](#toGrid)、[`toStrudel()`](#toStrudel) 的 `words` 選項的預設值。要讓一行節奏認得新的字，就傳一份加了你的字的複本。",
      },
    ],
    examples: [
      {
        code: `import { WORDS, compile } from '@openav/pattern';

console.log(WORDS.bd, WORDS.sn, WORDS.rs, WORDS.mt);   // kick snare rim tom
console.log(Object.keys(WORDS).length);                 // 26

const mine = compile('boom tss boom tss', { words: { ...WORDS, boom: 'kick', tss: 'hat' } });
console.log(mine.ok, mine.voices.join(' '));            // true kick hat`,
        caption: { en: 'Looks up a few words, counts them, and teaches a line two words of your own by spreading `WORDS` into a new object.', zh: '查幾個字、數有幾個，再把 `WORDS` 展開到新物件裡，讓一行節奏認得兩個你自己的字。' },
      },
    ],
    related: ['SHORT', 'compile', 'GM', 'voiceForNote'],
    keywords: {
      en: ['words', 'drum names', 'bd', 'sd', 'hh', 'vocabulary', 'kick', 'snare', 'hat', 'sound names'],
      zh: ['字', '鼓的名字', '詞彙', '大鼓', '小鼓', '鈸', 'bd sd hh'],
    },
  },

  SHORT: {
    group: 'drums',
    summary: {
      en: 'The short word Tidal and Strudel write for each drum: `kick` is `bd`, `snare` is `sd`. The other direction from `WORDS`.',
      zh: 'Tidal 和 Strudel 為每種鼓寫的短字：`kick` 是 `bd`，`snare` 是 `sd`。跟 `WORDS` 方向相反。',
    },
    value: {
      type: 'Object',
      en: 'A frozen object of 13 `{ voice: word }` pairs, one per drum of the kit. `pedalhat` has no short word, so it maps to `\'pedalhat\'`, OAV\'s own.',
      zh: '一個凍結的物件，有 13 組 `{ 鼓聲: 字 }`，鼓組每種鼓一組。`pedalhat` 沒有短字，所以對到 OAV 自己的 `\'pedalhat\'`。',
    },
    description: [
      {
        en: "[`fromGrid()`](#fromGrid) writes with these words when you do not give it your own spelling, and [`toStrudel()`](#toStrudel) uses them (with `hh` for `pedalhat`) to speak Strudel.",
        zh: "[`fromGrid()`](#fromGrid) 沒給你自己的寫法時，就是用這些字寫。[`toStrudel()`](#toStrudel) 也用它們（`pedalhat` 用 `hh`）來說 Strudel 的話。",
      },
    ],
    examples: [
      {
        code: `import { SHORT } from '@openav/pattern';

console.log(SHORT.kick, SHORT.snare, SHORT.hat, SHORT.hightom);   // bd sd hh ht
console.log(SHORT.pedalhat);                                       // pedalhat`,
        caption: { en: 'Logs the short word for a few drums, and the one drum that has none.', zh: '印出幾種鼓的短字，以及唯一沒有短字的那一種。' },
      },
    ],
    related: ['WORDS', 'fromGrid', 'toStrudel'],
    keywords: {
      en: ['short names', 'bd', 'sd', 'hh', 'reverse', 'words', 'voice to word'],
      zh: ['短字', '縮寫', '鼓的名字', '反查', 'bd sd hh'],
    },
  },
};
