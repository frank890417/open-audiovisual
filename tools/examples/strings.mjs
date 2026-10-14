// Strings for the examples pages (/examples/, /zh/examples/), the guide card on every example page, and the
// /p5/ page: English and Traditional Chinese, same keys. Where a sentence already lived somewhere else on the
// site (the homepage's works lede, the examples' own comments, docs/p5.md) it is reused, not rewritten:
// ROUTE_INTRO, the route names in English, the guide labels and the page headings are the new sentences.

import { getFacts, enWords, zhWords, cap } from '../site/facts.mjs';
import { ROUTES } from './catalog.mjs';

/** Input tags used by catalog `needs` / `standIn`: [en, zh]. */
export const TAGS = {
  piano: ['On-screen piano', '螢幕鋼琴'],
  qwerty: ['QWERTY keys', '電腦鍵盤'],
  sim: ['Simulated performer', '模擬演奏者'],
  midi: ['MIDI controller', 'MIDI 控制器'],
  controller: ['On-screen controller', '螢幕上的控制器'],
  phone: ['Phone or iPad', '手機或 iPad'],
  mic: ['Microphone', '麥克風'],
  drums: ['Drum machine', '鼓機'],
  camera: ['Camera (hands)', '鏡頭（手）'],
  leap: ['Leap Motion', 'Leap Motion'],
  mouse: ['Mouse as a hand', '用滑鼠當手'],
  take: ['A demo take', '一段示範演奏'],
  auto: ['Plays itself', '它自己會播'],
  knobs: ['Knobs on screen', '螢幕旋鈕'],
};

export const ROUTE_NAMES = {
  start: ['First open', '第一次打開'],
  inputs: ['Anything can be an instrument', '什麼都能當樂器'],
  engines: ['Bring another picture engine', '接上別的畫面引擎'],
  'show-control': ['Run a show', '演出控制'],
  output: ['Take it out of the browser', '輸出與留存'],
};
/** Route layer, as the design notes call them. */
export const ROUTE_LAYER = { start: '', inputs: 'L1', engines: 'L3', 'show-control': 'Timeline · Score', output: 'L4' };
const CIRCLED = ['①', '②', '③', '④', '⑤', '⑥', '⑦'];
export const routeMark = (route) => CIRCLED[ROUTES.indexOf(route)] || '';

export const ROUTE_INTRO = {
  start: [
    'Read the whole framework in one file, then add one line to a p5 sketch you already have.',
    '一個檔案讀完整個框架，再替你已有的 p5 草圖加上一行。',
  ],
  inputs: [
    'A controller, a chord, a microphone, bare hands, a Leap Motion, a phone.',
    '控制器、和弦、麥克風、空手、Leap Motion、手機。',
  ],
  engines: [
    'Bring your own: a node patch, a 2023 p5 sketch, a 2021 particle system.',
    '帶你自己的：節點網路、2023 年的 p5 草圖、2021 年的粒子系統。',
  ],
  'show-control': [
    'The show, not just the piece: a timeline you can see, and a score with a director.',
    '演的是一場演出，不只一件作品：看得見的時間軸，以及有導演的總譜。',
  ],
  output: [
    'One synced video, with or without a camera.',
    '同步的一支影片，有鏡頭或沒有鏡頭都行。',
  ],
};

const count = () => getFacts().exampleCount;

export const STRINGS = {
  en: {
    index: {
      title: () => `${cap(enWords(count()))} examples, ${enWords(ROUTES.length)} routes · open-audiovisual`,
      h1: () => `${cap(enWords(count()))} examples, ${enWords(ROUTES.length)} routes`,
      description: () => `${cap(enWords(count()))} playable examples of open-audiovisual, grouped in ${enWords(ROUTES.length)} routes: MIDI, mic and hands as instruments, p5 and WebToe worlds, timelines and scores, video output. No hardware needed.`,
      eyebrow: 'Examples',
      howTitle: 'How to read this page',
      how: 'Each card says what the example teaches, what it plays with, and what stands in when you have no hardware. Open it, try the three things on its guide card, read the lines it points to, then follow the Next link.',
      routeLabel: 'Route',
      all: 'All examples',
    },
    card: { open: 'Open', source: 'Source', needs: 'Needs', without: 'No hardware?', noneNeeded: 'No hardware needed', docs: 'Docs', plays: 'Plays with' },
    guide: {
      label: 'Guide', hide: 'Hide', show: 'Guide', aria: 'Guide to this example', example: 'Example', route: 'Route',
      try: 'Try these three things', needs: 'Needs', without: 'No hardware? Use', noneNeeded: 'No hardware needed.',
      read: 'Read these lines', docs: 'In the docs', next: 'Next', last: 'That was the last one.', all: 'All examples',
      p5: 'Take this input into your own p5 sketch: one line.', p5Example: 'Example 15', p5Docs: 'Docs: p5.js in one line',
      copyright: 'Artwork credit',
    },
    p5: {
      title: 'oav-p5: play any p5.js sketch from a MIDI controller',
      eyebrow: 'p5.js · MIDI · one line',
      try: 'Try it live: example 15', tryNote: 'The sketch on that page is plain p5.js with this one line first. Click the 🎹, turn a knob, hit a pad.',
      docsLink: 'The same page in the handbook', github: 'p5/ on GitHub', file: 'oav-p5.js',
    },
    crumbs: { home: 'open-audiovisual', examples: 'Examples', p5: 'p5.js in one line' },
  },
  zh: {
    index: {
      title: () => `${zhWords(count())}個範例，${zhWords(ROUTES.length)}條路線｜open-audiovisual`,
      h1: () => `${zhWords(count())}個範例，${zhWords(ROUTES.length)}條路線`,
      description: () => `open-audiovisual 的${zhWords(count())}個可以直接玩的範例，分成${zhWords(ROUTES.length)}條路線：MIDI、麥克風與手當樂器，p5 與 WebToe 世界，時間軸與總譜，影片輸出。不需要硬體。`,
      eyebrow: '範例',
      howTitle: '這一頁怎麼讀',
      how: '每張卡片都寫了這個範例教什麼、用什麼彈，以及沒有硬體時用什麼代替。打開它，試試帶路卡上的三件事，讀它指出的那幾行程式，再往「下一個」走。',
      routeLabel: '路線',
      all: '所有範例',
    },
    card: { open: '開啟', source: '原始碼', needs: '需要', without: '沒有硬體？', noneNeeded: '不需要硬體', docs: '文件', plays: '演奏方式' },
    guide: {
      label: '帶路', hide: '收起', show: '帶路', aria: '這個範例的帶路卡', example: '範例', route: '路線',
      try: '試試這三件事', needs: '需要', without: '沒有硬體？用', noneNeeded: '不需要硬體。',
      read: '讀這幾行', docs: '文件裡', next: '下一個', last: '這是最後一個範例。', all: '所有範例',
      p5: '把這個輸入帶進你自己的 p5 草圖：一行。', p5Example: '範例 15', p5Docs: '文件：p5.js 一行接上',
      copyright: '作品版權',
    },
    p5: {
      title: 'oav-p5：用 MIDI 控制器玩任何 p5.js 草圖',
      eyebrow: 'p5.js · MIDI · 一行',
      try: '現場試玩：範例 15', tryNote: '那一頁的草圖就是普通的 p5.js，第一行是這一行。點 🎹、轉旋鈕、敲打擊墊。',
      docsLink: '手冊裡的同一章', github: 'GitHub 上的 p5/', file: 'oav-p5.js',
    },
    crumbs: { home: 'open-audiovisual', examples: '範例', p5: 'p5.js 一行接上' },
  },
};
