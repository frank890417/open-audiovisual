// @openav/chord reference: held notes in, chord quality and consonance out.
// Read by tools/build-reference.mjs (see AGENTS.md, "Documenting a public name").

export default {
  ChordDetector: {
    group: 'chord',
    summary: {
      en: 'Groups notes struck close together into one gesture and analyses it: chord type, consonance, triad and cluster flags, published as `chord/*` signals.',
      zh: '把幾乎同時按下的音歸成一個手勢並分析它：和弦類型、協和度、三和弦與音叢的旗標，發布成 `chord/*` 訊號。',
    },
    params: [
      {
        name: 'window', type: 'Number', optional: true, default: '80',
        en: 'How many milliseconds after the **last** `noteOn` the gesture is closed and analysed. Notes struck within this time of each other are one chord.',
        zh: '**最後一個** `noteOn` 之後等幾毫秒，就把這個手勢收尾並分析。彼此相隔不到這個時間按下的音，算同一個和弦。',
      },
      {
        name: 'onChord', type: 'Function | null', optional: true, default: 'null',
        en: 'Called with the analysis object each time a gesture is closed.',
        zh: '每次一個手勢收尾，就以分析結果物件呼叫一次。',
      },
      {
        name: 'signals', type: 'Signals | null', optional: true, default: 'null',
        en: 'A [`Signals`](#Signals) registry to publish `chord/*` into. The signals are declared when the detector is built.',
        zh: '要把 `chord/*` 發布進去的 [`Signals`](#Signals) 登錄表。訊號在建立偵測器時就宣告好了。',
      },
    ],
    description: [
      {
        en: 'This is not a music-theory library. It is a **performance semantics** layer: raw notes in, one analysed event per gesture out, with features that are made to drive a work. A single note is a seed, a chord a colony, a consonant chord a flourish, a dissonant one decay; rename them for your own piece. In a show, `createShow({ modules: { chord: true } })` builds one (`{ chord: { window: 120 } }` tunes it) and connects it to `midi/note/on` and `midi/note/off`, so a MIDI keyboard, the on-screen piano and phones all feed it.',
        zh: '它管的是**演出語意**，不是樂理：原始的音進去，每個手勢出來一個分析過的事件，特徵都是為了驅動作品而設計的。單一個音是種子，和弦是一群生物，協和的和弦是繁盛，不協和的和弦是衰敗。你可以替自己的作品換掉這些名字。在演出裡，`createShow({ modules: { chord: true } })` 會建好一個（`{ chord: { window: 120 } }` 可以調整）並接上 `midi/note/on` 和 `midi/note/off`，所以 MIDI 鍵盤、螢幕上的鋼琴和手機都能餵它。',
      },
      {
        en: 'Each closed gesture publishes `chord/consonance` (−1..1), `chord/count` (0..10), `chord/root` (the lowest note) and the pulse `chord/event`, whose payload is the whole analysis: `{ notes, count, root, vel, pcs, consonance, isConsonant, isDissonant, isTriad, thirdsFraction, dissonanceLevel, chordType }`. `chordType` is one of `single`, `major`, `minor`, `sus2`, `sus4`, `dim`, `aug`, `maj7`, `min7`, `dom7`, `halfdim7`, `maj9`, `min9`, `dom9`, `six`, `min6`, `cluster` (a very dissonant pile) or `chord` (anything else). Inversions resolve to the root-position name.',
        zh: '每個收尾的手勢會發布 `chord/consonance`（−1..1）、`chord/count`（0..10）、`chord/root`（最低音）和脈衝 `chord/event`，脈衝的內容就是整份分析：`{ notes, count, root, vel, pcs, consonance, isConsonant, isDissonant, isTriad, thirdsFraction, dissonanceLevel, chordType }`。`chordType` 是 `single`、`major`、`minor`、`sus2`、`sus4`、`dim`、`aug`、`maj7`、`min7`、`dom7`、`halfdim7`、`maj9`、`min9`、`dom9`、`six`、`min6`、`cluster`（非常不協和的一堆音）或 `chord`（其他任何和弦）之一。轉位會被還原成原位和弦的名稱。',
      },
      {
        en: '`consonance` is the average of an interval weight for every pair of notes (an octave or fifth is high, a semitone or tritone is negative). `isConsonant` is `consonance > 0.25` and `isDissonant` is `consonance < −0.15`, both only for two notes or more. `dissonanceLevel` is 0 for none, 1 for **mild** (a storm warning: foreshadow it) and 2 for **severe** (three or more notes that are a true cluster: commit to the decay). `isTriad` is true for `major`, `minor`, `sus2`, `sus4`, `dim` and `aug`, and `thirdsFraction` is the share of neighbouring notes exactly 3 or 4 semitones apart, so "genuinely stacked thirds" can be told from "some consonant notes".',
        zh: '`consonance` 是每一對音的音程權重的平均（八度或五度很高，半音或三全音是負的）。`isConsonant` 是 `consonance > 0.25`，`isDissonant` 是 `consonance < −0.15`，都只在兩個音以上才成立。`dissonanceLevel` 0 是沒有，1 是**輕微**（風暴警報：預告它），2 是**嚴重**（三個音以上的真正音叢：直接進入衰敗）。`isTriad` 在 `major`、`minor`、`sus2`、`sus4`、`dim`、`aug` 時為真，`thirdsFraction` 是相鄰兩個音剛好相差 3 或 4 個半音的比例，這樣就分得出「真正疊起來的三度」和「幾個協和的音」。',
      },
    ],
    needs: {
      en: 'Feed it with `noteOn(note, vel)` (and `noteOff(note)`), or let `createShow` do it from `midi/note/on|off`. Nothing is published until `window` milliseconds after the last `noteOn`, so the result is asynchronous. `analyze()` is the exception: it is instant and needs no setup.',
      zh: '用 `noteOn(note, vel)`（和 `noteOff(note)`）餵它，或讓 `createShow` 從 `midi/note/on|off` 餵。要等到最後一個 `noteOn` 之後 `window` 毫秒才會發布，所以結果是非同步的。`analyze()` 是例外：它立刻回傳，也不需要任何前置動作。',
    },
    members: {
      noteOn: {
        en: 'A note was struck: `noteOn(note, vel = 0.8)`, `note` a MIDI number and `vel` 0..1. Restarts the `window` timer; striking the same note twice in a gesture counts once, with the harder velocity.',
        zh: '有一個音被按下：`noteOn(note, vel = 0.8)`，`note` 是 MIDI 號碼，`vel` 是 0..1。會重新計時 `window`。同一個手勢裡同一個音按兩次只算一次，取力道比較大的那個。',
      },
      noteOff: {
        en: 'A note was released. It only updates the `held` map; a gesture is made of the notes struck inside the window, not of what is still held.',
        zh: '有一個音被放開。它只會更新 `held`，手勢是由時間窗口裡按下的音組成，而不是由還按著的音組成。',
      },
      analyze: {
        en: 'A pure function: `analyze(notes, vels = [])` takes MIDI note numbers (lowest first) and returns the analysis object at once, without timers or signals. `vel` is the mean of `vels`, or 0.8 without them.',
        zh: '純函式：`analyze(notes, vels = [])` 接收 MIDI 音符號碼（由低到高），立刻回傳分析結果物件，沒有計時器也不發布訊號。`vel` 是 `vels` 的平均值，沒給就是 0.8。',
      },
    },
    notes: [
      {
        en: 'Pass notes to `analyze()` lowest first: `root` is the first note, and the detector sorts for you but a direct call does not.',
        zh: '呼叫 `analyze()` 時音要由低到高：`root` 就是第一個音，偵測器會替你排序，但直接呼叫就不會。',
      },
      {
        en: 'A major second like `[60, 62]` is typed `cluster` (no template fits and its consonance is below −0.3) even though its `dissonanceLevel` is only 1. Level 2 needs three or more notes.',
        zh: '像 `[60, 62]` 這樣的大二度，類型會是 `cluster`（沒有範本符合，而且協和度低於 −0.3），不過它的 `dissonanceLevel` 只有 1。要到 2 至少得有三個音。',
      },
      {
        en: 'The gesture window does not know about held notes: a note already down when you play two more does not join them.',
        zh: '手勢窗口不知道還按著的音：已經按著的一個音，不會跟你後來彈的兩個音湊成一個和弦。',
      },
    ],
    examples: [
      {
        code: `import { ChordDetector } from '@openav/chord';

const chord = new ChordDetector();
const major = chord.analyze([60, 64, 67]);
console.log(major.chordType, major.isTriad, major.consonance, major.thirdsFraction);   // major true 0.75 1
const cluster = chord.analyze([60, 61, 62, 63]);
console.log(cluster.chordType, cluster.dissonanceLevel, cluster.isDissonant);          // cluster 2 true`,
        caption: { en: 'The console prints `major true 0.75 1` for C-E-G, then `cluster 2 true` for four neighbouring semitones.', zh: '主控台對 C-E-G 印出 `major true 0.75 1`，對四個相鄰半音印出 `cluster 2 true`。' },
      },
      {
        code: `import { Signals } from '@openav/core';
import { ChordDetector } from '@openav/chord';

const signals = new Signals();
signals.define('midi/note/on', { kind: 'pulse' });
signals.define('midi/note/off', { kind: 'pulse' });
const chord = new ChordDetector({ signals, window: 30 });
signals.on('chord/event', (a) => console.log('chord/event:', a.chordType, a.count, 'notes'));
signals.on('midi/note/on', ({ note, vel }) => chord.noteOn(note, vel));      // what createShow wires for you
signals.on('midi/note/off', ({ note }) => chord.noteOff(note));

for (const note of [60, 64, 67]) signals.pulse('midi/note/on', { note, vel: 0.8 });   // struck together
setTimeout(() => console.log(signals.get('chord/consonance'), signals.get('chord/root')), 100);`,
        caption: { en: 'Three notes struck together become one event: the console prints `chord/event: major 3 notes`, then `0.75 60` (consonance and root).', zh: '同時按下的三個音變成一個事件：主控台印出 `chord/event: major 3 notes`，然後是 `0.75 60`（協和度和根音）。' },
      },
      {
        code: `import { ChordDetector } from '@openav/chord';

const chord = new ChordDetector();
const types = [[60, 64, 67], [64, 67, 72], [60, 64, 67, 70], [60, 63, 66], [60, 65, 67], [60, 67]];
for (const notes of types) console.log(JSON.stringify(notes), chord.analyze(notes).chordType);`,
        caption: { en: 'Inversions resolve to the root-position name: the console prints `major`, `major` (E-G-C is C major again), `dom7`, `dim`, `sus4`, and `chord` for the bare fifth, which matches no template.', zh: '轉位會還原成原位和弦的名稱：主控台印出 `major`、`major`（E-G-C 還是 C 大三和弦）、`dom7`、`dim`、`sus4`，以及空心五度的 `chord`，它不符合任何範本。' },
      },
    ],
    related: ['Signals', 'Mapper', 'createShow'],
    keywords: {
      en: ['chord', 'chord detection', 'consonance', 'dissonance', 'triad', 'cluster', 'major', 'minor', 'harmony', 'notes', 'midi', 'gesture window'],
      zh: ['和弦', '和弦偵測', '協和度', '不協和', '三和弦', '音叢', '大調', '小調', '和聲', '音符', '手勢窗口'],
    },
  },
};
