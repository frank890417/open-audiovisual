// 404.html — what GitHub Pages serves for any url that does not exist. One page, both languages
// (a missing url has no language), noindex, and every link absolute from "/" because the page answers
// at any depth (/nope/ and /a/b/c/ alike).

import { absoluteCtx, headBasics, topBar, siteFooter, guardEmail, esc, attr } from './chrome.mjs';
import { registry } from './pages.mjs';
import en from '../home/en.mjs';
import zh from '../home/zh.mjs';

const COPY = {
  en: {
    lang: 'en', eyebrow: '404', title: 'This page is not here',
    lede: 'The address may have moved or never existed. These are the places that do exist.',
    links: [
      ['Home', '/', 'the framework, running: play the instrument, see how it works'],
      ['Documentation', '/docs/', 'the handbook, every chapter on one page'],
      ['MIDI controllers', '/controllers/', 'every controller with its exact MIDI map'],
      ['Examples', '/#works', 'works you can open now'],
      ['p5.js in one line', '/p5/', 'play any p5.js sketch from MIDI'],
      ['WebToe', '/webtoe/', 'the node engine in the browser'],
    ],
  },
  zh: {
    lang: 'zh-Hant-TW', eyebrow: '404', title: '找不到這一頁',
    lede: '這個網址可能搬家了，或是從來沒有存在過。下面是確實存在的地方。',
    links: [
      ['首頁', '/zh/', '正在運作的框架：玩一玩樂器，看看它怎麼運作'],
      ['文件', '/zh/docs/', '使用手冊，每一章在同一頁'],
      ['MIDI 控制器', '/zh/controllers/', '每台控制器確切的 MIDI 對照表'],
      ['範例', '/zh/#works', '現在就能打開的作品'],
      ['p5.js 一行指令', '/p5/', '用 MIDI 玩任何 p5.js 草圖'],
      ['WebToe', '/zh/webtoe/', '瀏覽器裡的節點引擎'],
    ],
  },
};

export function renderNotFound() {
  const has = (p) => registry().some((e) => e.path === p);
  const c = absoluteCtx('en');
  const block = (k) => {
    const t = COPY[k];
    const links = t.links.map(([name, href, what]) => [name, href === '/#works' && has('examples/') ? '/examples/' : href === '/zh/#works' && has('examples/') ? '/zh/examples/' : href, what]);
    return `  <section class="sec" lang="${t.lang}" aria-labelledby="nf-${k}">
    <header class="sec-head">
      <p class="eyebrow">${t.eyebrow}</p>
      <h${k === 'en' ? 1 : 2} id="nf-${k}">${esc(t.title)}</h${k === 'en' ? 1 : 2}>
      <p class="sec-lede">${esc(t.lede)}</p>
    </header>
    <ul class="docs">
      ${links.map(([name, href, what]) => `<li><a href="${href}">${esc(name)}</a><span>${esc(what)}</span></li>`).join('\n      ')}
    </ul>
  </section>`;
  };
  return guardEmail(`<!DOCTYPE html>
<html lang="en">
<head>
${headBasics(en, c, { title: 'Page not found · 找不到頁面 · open-audiovisual', description: 'This page does not exist. Home, documentation, MIDI controllers and examples of open-audiovisual are one click away. 找不到這一頁。', noindex: true, ld: false })}
</head>
<body>
${topBar(en, c)}

<main id="main">
${block('en')}
${block('zh')}
</main>

${siteFooter(en, c)}
</body>
</html>
`);
}
