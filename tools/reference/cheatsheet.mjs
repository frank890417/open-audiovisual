// The oav-p5 cheat sheet: /docs/cheatsheet/ (en) and /zh/docs/cheatsheet/ (繁中), written by tools/build-reference.mjs.
//
// One page, the way p5.js's beginner cheat sheet works: the names a sketch uses, each with a few words, grouped by what
// you do (shout, hit, play, smooth), a handful of small drawings, and it prints on one landscape A4. Every name links to
// its API reference entry, and a name that has no entry there throws: the sheet cannot drift from the code.
// The few words are written here, in both languages; the signatures are written for a beginner's eye (the reference
// has the exact ones).

import { SITE, SOFTWARE_ID, esc, attr, headBasics, pageNode, breadcrumbNode, homeUrl, topBar, siteFooter, guardEmail } from '../site/chrome.mjs';
import { highlight } from '../docs/markdown.mjs';
import { LOADER, P5 } from './model.mjs';

const W = (en, zh) => ({ en, zh });
const VERSION = { now: '' };   // OAVp5.version's row says the version the page was built with (set in renderCheatsheetPage)

/** [code shown, reference key, few words] — the key must be an oav-p5 name (or alias) in the reference. */
const SECTIONS = [
  {
    id: 'shout', tone: 'sig', title: W('shout: the microphone', '喊：麥克風'),
    rows: [
      ['micLevel', 'micLevel', W('how loud, 0 (quiet room) to 1 (shouting)', '多大聲，0（安靜）到 1（大喊）')],
      ['bass  mid  treble', 'bass', W('low / middle / high sound, each 0 to 1', '低音、中音、高音，各 0 到 1')],
      ['beat', 'beat', W('true on the frame a beat is heard', '聽到一拍的那一格是 true')],
      ['micIsOn', 'micIsOn', W('is the microphone working?', '麥克風有沒有開成功')],
      ['micSensitivity(2)', 'micSensitivity', W('twice as sensitive (too quiet? try 3)', '靈敏兩倍，太小聲就試 3')],
      ['startMic()  stopMic()', 'startMic', W('turn it on / off yourself', '自己開、自己關')],
    ],
    events: [
      ['beatDetected(level)', 'beatDetected', W('a beat: the sound jumps', '有一拍：聲音突然跳起來')],
      ['kickDetected(level)', 'kickDetected', W('a kick in the low end (also snareDetected, hatDetected)', '低頻一下大鼓（還有 snareDetected、hatDetected）')],
    ],
    figure: 'bands',
  },
  {
    id: 'hit', tone: 'l3', title: W('hit: the drum machine', '敲：鼓機'),
    rows: [
      ["startDrums('four on floor', 120)", 'startDrums', W('a 16-step drum machine appears, at 120 BPM', '畫面上出現 16 格鼓機，每分鐘 120 拍')],
      ["startDrums('bd*4, ~ sd, hh*8')", 'startDrums', W('or write the rhythm in one line', '也可以用一行字寫節奏')],
      ['stopDrums()', 'stopDrums', W('stop it, put the card away', '停下來，卡片收起來')],
      ['drumStep', 'drumStep', W('which step just played, 0 to 15', '剛剛打到第幾格，0 到 15')],
      ['drumBar', 'drumBar', W('which bar, the first is 1', '第幾小節，從 1 開始')],
      ['drumPhase  beatPhase', 'drumPhase', W('0 → 1 smoothly, once a bar / once a beat', '一小節、一拍，平滑地從 0 走到 1')],
      ['drumBpm  drumsAreOn', 'drumBpm', W('the tempo / is it playing?', '速度／有沒有在打')],
      ['kickIsDetected  snareIsDetected', 'kickIsDetected', W('true in the frame of a hit: lag(kickIsDetected, 0, 0.3) fades it', '打到的那一格是 true：lag(kickIsDetected, 0, 0.3) 讓它慢慢退')],
      ['millis() - lastKickTs', 'lastKickTs', W('ms since the last kick (lastSnareTs, lastHatTs, lastBeatTs)', '離上一下大鼓幾毫秒（還有 lastSnareTs、lastHatTs、lastBeatTs）')],
    ],
    events: [
      ['drumHit(lane, velocity)', 'drumHit', W('every hit: which drum, how hard', '每打一下：哪一種鼓、多用力')],
      ['barStarted(bar)', 'barStarted', W('the first step of every bar', '每一小節的第一格')],
      ['stepStarted(step, bar)', 'stepStarted', W('every one of the 16 steps', '16 格的每一格')],
    ],
    figure: 'steps',
  },
  {
    id: 'time', tone: 'l3', title: W('a timeline in bars', '時間軸：用小節排'),
    rows: [
      ["cue(5, 'bloom', 12)", 'cue', W('at bar 5, then every 12 bars, call cueFired', '第 5 小節叫一次，之後每 12 小節再叫')],
      ['cueFired(name, bar)', 'cueFired', W('you write it: change the scene here', '你寫的函式：在這裡換場景')],
      ['cueName', 'cueName', W('the last cue that fired', '最近一個發動的 cue')],
      ["drawRhythm(x, y, w, h, 'circle')", 'drawRhythm', W("the rhythm on the canvas ('grid', 'circle', 'spiral'): it is in your recording", "把節奏畫在畫布上（'grid'、'circle'、'spiral'），錄影錄得到")],
    ],
  },
  {
    id: 'rhythm', tone: 'l3', title: W('a rhythm in one line', '一行字寫節奏'), kind: 'notation',
    rows: [
      ['bd  sd  hh', null, W('kick, snare, hi-hat', '大鼓、小鼓、鈸')],
      ['bd sd bd sd', null, W('spaces share the bar out evenly', '空白把一小節平均分')],
      ['hh*8', null, W('eight times', '打 8 下')],
      ['~', null, W('a rest', '休息')],
      ['[bd bd] sd', null, W('two squeezed into one place', '[ ] 把兩下擠進一格的位置')],
      ['bd*4, ~ sd', null, W('a comma plays them at the same time', '逗號：同時打')],
      ['bd(3,8)', null, W('3 hits spread over 8 steps', '8 格裡平均打 3 下')],
      ['<bd sd>', null, W('one each bar, taking turns', '每小節輪流換一個')],
    ],
  },
  {
    id: 'play', tone: 'l2', title: W('play: keys and knobs', '彈：鍵盤與旋鈕'),
    rows: [
      ['note', 'note', W('the last key, a MIDI number 0 to 127 (60 is C4)', '最後按的鍵，MIDI 號碼 0 到 127（60 是 C4）')],
      ['velocity', 'velocity', W('how hard, 0 to 1', '多用力，0 到 1')],
      ['millis() - lastNoteTs', 'lastNoteTs', W('ms since a key went down', '離上一次按鍵幾毫秒')],
      ["noteIsDown(60)  noteIsDown('C4')", 'noteIsDown', W('is that key held down?', '那個鍵現在有沒有按著')],
      ['knob1 … knob8', 'knob1', W('a knob, 0 to 1: read it like mouseX', '旋鈕，0 到 1，像 mouseX 一樣直接讀')],
      ['fader1 …  pad1 …', 'fader1', W('faders 0 to 1, pads (how hard, 0 when let go)', '推桿 0 到 1、打擊墊（多用力，放開是 0）')],
    ],
    events: [
      ['notePressed(note, velocity)', 'notePressed', W('a key goes down', '按下一個鍵')],
      ['noteReleased(note)', 'noteReleased', W('a key comes up', '放開一個鍵')],
      ['knobMoved(n, value)', 'knobMoved', W('a knob turns', '轉了一顆旋鈕')],
      ['padPressed(n, velocity)', 'padPressed', W('a pad is hit', '打了一下打擊墊')],
    ],
    note: W('No keyboard? 🎹 on the page is one, 📱 turns your phone into one.', '沒有鍵盤？畫面上的 🎹 就是一台，📱 讓手機變成一台。'),
    figure: 'keys',
  },
  {
    id: 'sound', tone: 'l2', title: W('sound and note names', '出聲與音名'),
    rows: [
      ["startSound('piano')", 'startSound', W('the keys you play are heard (click the page once first)', '彈的鍵有聲音（先點一下畫面）')],
      ['stopSound()  soundIsOn', 'stopSound', W('silence / is it on?', '關掉／有沒有在響')],
      ['noteName(61)', 'noteName', W("→ 'C#4'", "→ 'C#4'")],
      ["noteNumber('C4')", 'noteNumber', W('→ 60', '→ 60')],
      ["noteFreq('A4')", 'noteFreq', W('→ 440 (hertz)', '→ 440（赫茲）')],
    ],
  },
  {
    id: 'smooth', tone: 'l1', title: W('make numbers nice to use', '讓數字好用'),
    rows: [
      ['lag(micLevel, 0.03, 0.4)', 'lag', W('follow, not jump: 0.03 s up, 0.4 s down (Lag CHOP)', '用追的不要用跳的：0.03 秒上、0.4 秒下（Lag CHOP）')],
      ["env('kick', 0.01, 0.3)", 'env', W('jumps to 1 on each kick, sinks back in 0.3 s (Trigger CHOP)', '每下大鼓跳到 1，0.3 秒退回 0（Trigger CHOP）')],
      ['speed(TWO_PI)', 'speed', W('adds up every second: rotate() once a second', '每秒累加：rotate() 一秒轉一圈')],
      ['spring(knob1, 100, 6)', 'spring', W('overshoots and bounces, like a spring', '像彈簧，會衝過頭再彈回來')],
      ['trail(micLevel, 3)', 'trail', W('the last 3 seconds, as a list', '最近 3 秒的值，一個陣列')],
      ['drawTrail(list, x, y, w, h)', 'drawTrail', W('draw that list as a line', '把那個陣列畫成一條線')],
      ["count('kick', 4)", 'count', W('count: 0, 1, 2, 3, 0, …', '數次數：0、1、2、3、0…')],
      ["scope(value, 'name')", 'scope', W('a little scope in the corner, to look at a number', '角落的小示波器，看一個數字怎麼變')],
    ],
    note: W('Put them in draw(), not inside an if.', '寫在 draw() 裡，不要放進 if。'),
    figure: 'lag',
  },
  {
    id: 'keep', tone: 'l4', title: W('record and check', '錄影與體檢'),
    rows: [
      ['startRecording()  stopRecording()', 'startRecording', W('a video of the canvas with its sound (or 🎹 → ⏺)', '把畫布和聲音錄成影片（或 🎹 → ⏺）')],
      ['recordingIsOn', 'recordingIsOn', W('recording now?', '現在有沒有在錄')],
      ['recordingSaved(info)', 'recordingSaved', W('the file is saved', '影片存好了')],
      ['OAVp5.version', 'OAVp5.version', W("'{version}': the line has loaded", "'{version}'：第一行有載到")],
      ['OAVp5.check()', 'OAVp5.check', W('🩺 a card that says what works: screenshot it when you ask for help', '🩺 一張體檢卡，問問題時截圖貼上')],
    ],
  },
];

const SKELETON = `function setup() {
  createCanvas(400, 300);
  startDrums('four on floor');   // only if you want drums
}

function draw() {
  background(20);
  circle(200, 150, 40 + micLevel * 300);
}

function kickDetected(level) {   // oav-p5 calls it
  // a kick: do something
}`;

/** Each figure is a small drawing in the site's colours; text in it is the same in both languages unless given twice. */
function figureSvg(id, L) {
  const zh = L === 'zh';
  if (id === 'bands') {
    // a log frequency axis 20 Hz … 8 kHz, three bands
    const x = (hz) => 10 + (Math.log10(hz) - Math.log10(20)) / (Math.log10(8000) - Math.log10(20)) * 300;
    const band = (a, b, name, cls) => `<rect class="${cls}" x="${x(a).toFixed(1)}" y="18" width="${(x(b) - x(a)).toFixed(1)}" height="26" rx="2"/><text x="${((x(a) + x(b)) / 2).toFixed(1)}" y="35" text-anchor="middle">${name}</text>`;
    const tick = (hz, label) => `<line x1="${x(hz).toFixed(1)}" y1="44" x2="${x(hz).toFixed(1)}" y2="50"/><text class="t" x="${x(hz).toFixed(1)}" y="62" text-anchor="middle">${label}</text>`;
    return `<svg viewBox="0 0 320 70" role="img" aria-label="${zh ? '低音 20–250 Hz、中音 250–2000 Hz、高音 2000–8000 Hz' : 'bass 20–250 Hz, mid 250–2000 Hz, treble 2000–8000 Hz'}">
${band(20, 250, 'bass', 'b1')}${band(250, 2000, 'mid', 'b2')}${band(2000, 8000, 'treble', 'b3')}
${tick(20, '20')}${tick(250, '250')}${tick(2000, '2k')}${tick(8000, '8k Hz')}</svg>`;
  }
  if (id === 'steps') {
    const cells = [];
    for (let i = 0; i < 16; i++) {
      const on = i % 4 === 0;
      cells.push(`<rect class="${i === 6 ? 'now' : on ? 'on' : 'off'}" x="${8 + i * 19}" y="14" width="16" height="16" rx="2"/>`);
      if (i % 4 === 0) cells.push(`<text class="t" x="${8 + i * 19 + 8}" y="44" text-anchor="middle">${i}</text>`);
    }
    return `<svg viewBox="0 0 320 70" role="img" aria-label="${zh ? '一小節 16 格，大鼓打在 0、4、8、12，播放頭在第 6 格' : 'a bar of 16 steps, kicks on 0, 4, 8, 12, the playhead on step 6'}">
${cells.join('')}<text class="t" x="8" y="10">bd</text><text class="now-t" x="${8 + 6 * 19 + 8}" y="10" text-anchor="middle">drumStep = 6</text>
<line class="phase" x1="8" y1="56" x2="310" y2="56"/><circle class="dot" cx="${8 + 6.5 * 19}" cy="56" r="3"/>
<text class="t" x="8" y="68">drumPhase 0</text><text class="t" x="310" y="68" text-anchor="end">→ 1</text></svg>`;
  }
  if (id === 'lag') {
    // a step that goes up at 20 and down at 160; lag rises fast (0.03 s), falls slowly (0.4 s)
    const pts = [];
    let v = 0;
    for (let i = 0; i <= 300; i += 3) {
      const target = i >= 20 && i < 160 ? 1 : 0;
      v += (target - v) * (target > v ? 0.55 : 0.06);
      pts.push(`${(10 + i).toFixed(0)},${(60 - v * 44).toFixed(1)}`);
    }
    return `<svg viewBox="0 0 320 72" role="img" aria-label="${zh ? '虛線是原本的值，實線是 lag 之後：上升很快、下降很慢' : 'dashed: the value, solid: after lag, up fast and down slowly'}">
<path class="raw" d="M10 60 H30 V16 H170 V60 H310"/><polyline class="lagged" points="${pts.join(' ')}"/>
<text class="t" x="34" y="12">${zh ? '上 0.03 秒' : 'up 0.03 s'}</text><text class="t" x="176" y="30">${zh ? '下 0.4 秒' : 'down 0.4 s'}</text></svg>`;
  }
  if (id === 'keys') {
    // one octave and a bit: C4 = 60
    const whites = ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'C'];
    const wNum = [60, 62, 64, 65, 67, 69, 71, 72];
    const out = [];
    whites.forEach((n, i) => {
      out.push(`<rect class="${i === 0 ? 'hit' : 'w'}" x="${10 + i * 37}" y="6" width="35" height="46" rx="2"/>`);
      out.push(`<text class="kn" x="${10 + i * 37 + 17.5}" y="47" text-anchor="middle">${n}${i === 7 ? '5' : '4'}</text>`);
      out.push(`<text class="t" x="${10 + i * 37 + 17.5}" y="64" text-anchor="middle">${wNum[i]}</text>`);
    });
    [0, 1, 3, 4, 5].forEach((i) => out.push(`<rect class="k" x="${10 + i * 37 + 25}" y="6" width="22" height="28" rx="2"/>`));
    return `<svg viewBox="0 0 320 70" role="img" aria-label="${zh ? '鍵盤：中央 C 是 C4，號碼 60，往右一個白鍵加 2 或 1' : 'a keyboard: middle C is C4, number 60'}">${out.join('')}</svg>`;
  }
  return '';
}

function rowHtml([code, key, words], L, hrefOf, notation) {
  const c = notation ? `<code class="cs-n">${esc(code)}</code>` : `<code>${highlight(code, 'js')}</code>`;
  const name = key ? `<a href="${attr(hrefOf(key))}">${c}</a>` : c;
  return `<li>${name}<span class="cs-w">${esc(words[L].replace('{version}', VERSION.now))}</span></li>`;
}

/**
 * @param {object} t      strings (tools/reference/en.mjs | zh.mjs): t.cheat
 * @param {object} home   homepage strings (top bar, footer, html lang)
 * @param {object} o      { c: pathCtx, records, p5Version, assets: { css, docsCss } }
 */
export function renderCheatsheetPage(t, home, { c, records, p5Version, assets }) {
  const L = c.locale, s = t.cheat;
  VERSION.now = p5Version;
  const byName = new Map();
  for (const r of records) if (r.ns === P5) for (const k of r.covers) if (!byName.has(k)) byName.set(k, r);
  const ref = c.root + (L === 'zh' ? 'zh/' : '') + 'docs/reference/';
  const hrefOf = (key) => {
    const r = byName.get(key);
    if (!r) throw new Error(`cheat sheet: "${key}" is not an oav-p5 name in the reference (tools/reference/cheatsheet.mjs)`);
    if (!r.entry) throw new Error(`cheat sheet: "${key}" has no reference entry yet`);
    return ref + '#' + r.id;
  };
  const sections = SECTIONS.map((sec) => {
    const rows = sec.rows.map((r) => rowHtml(r, L, hrefOf, sec.kind === 'notation')).join('');
    const ev = sec.events ? `<p class="cs-sub">${esc(s.events)}</p><ul class="cs-rows">${sec.events.map((r) => rowHtml(r, L, hrefOf, false)).join('')}</ul>` : '';
    const fig = sec.figure ? `<figure class="cs-fig cs-fig-${sec.figure}">${figureSvg(sec.figure, L)}</figure>` : '';
    const note = sec.note ? `<p class="cs-note">${esc(sec.note[L])}</p>` : '';
    return `<section class="cs-box" data-tone="${sec.tone}" aria-labelledby="cs-${sec.id}">
<h2 id="cs-${sec.id}">${esc(sec.title[L])}</h2>
<ul class="cs-rows">${rows}</ul>${ev}${fig}${note}
</section>`;
  }).join('\n');

  const ld = [
    pageNode(c, home, {
      type: 'TechArticle', '@id': c.self + '#article', headline: s.title, name: s.meta.title, description: s.meta.description,
      about: { '@id': SOFTWARE_ID }, breadcrumb: { '@id': c.self + '#breadcrumb' },
    }),
    breadcrumbNode(c, [['open-audiovisual', homeUrl(c)], [home.ui.nav.docs, SITE + (L === 'zh' ? 'zh/' : '') + 'docs/'], [s.eyebrow, c.self]]),
  ];

  return guardEmail(`<!DOCTYPE html>
<html lang="${home.htmlLang}">
<head>
${headBasics(home, c, { title: s.meta.title, description: s.meta.description, ogType: 'article', ld })}
<link rel="stylesheet" href="${c.root}assets/docs/docs.css?v=${assets.docsCss}">
<link rel="stylesheet" href="${c.root}assets/reference/cheatsheet.css?v=${assets.cheatCss}">
</head>
<body class="cs-page">
${topBar(home, c)}

<main id="main" class="cs-main">
  <header class="cs-head">
    <div class="cs-brand"><span class="cs-name">oav-p5</span><span class="cs-tag">${esc(s.tag)}</span></div>
    <p class="cs-lede">${esc(s.lede)}</p>
    <p class="cs-links"><a href="${ref}">${esc(s.toReference)} →</a> <button type="button" class="cs-print" hidden>${esc(s.print)}</button> <span class="cs-ver">oav-p5 ${esc(p5Version)}</span></p>
  </header>

  <div class="cs-grid">
    <section class="cs-box cs-start" data-tone="sig" aria-labelledby="cs-start">
      <h2 id="cs-start">${esc(s.startTitle)}</h2>
      <p class="cs-w">${esc(s.startBody)}</p>
      <div class="term" data-lang="js"><pre><code class="language-js">${highlight(LOADER, 'js')}</code></pre></div>
      <p class="cs-sub">${esc(s.skeleton)}</p>
      <div class="term" data-lang="js"><pre><code class="language-js">${highlight(SKELETON, 'js')}</code></pre></div>
      <p class="cs-note">${esc(s.inside)}</p>
    </section>
${sections}
  </div>
  <p class="cs-foot">${esc(s.foot)}</p>
</main>

${siteFooter(home, c)}
<script>(function(){var b=document.querySelector('.cs-print');if(b&&window.print){b.hidden=false;b.addEventListener('click',function(){window.print()})}})()</script>
</body>
</html>
`);
}
