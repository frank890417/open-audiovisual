// 第一行：Open Audio Visual 一行注入。這份草圖是節奏實驗台：改一行字換節奏、上一步、把這一行帶去 Strudel。
document.head.prepend(Object.assign(document.createElement('script'), { src: 'https://openaudiovisual.com/p5/oav-p5.js' }));

// 一行節奏（寫法來自 TidalCycles／Strudel）：數字鍵 1–4 換節奏，Z 回上一步，S 把這一行帶去 strudel.cc。
//   OAVp5.drums.edit('bd(3,8), [~ sd]*2')   像在鼓機卡上打字：換節奏，打錯的話繼續打上一行能用的
//   OAVp5.drums.undo()                       回到上一行（鼓機卡的 ↶ 也是它）；OAVp5.drums.history 是更早的幾行
//   OAVp5.drums.strudelUrl                   這一行在 strudel.cc 的網址，用新分頁開
//   rhythmChanged(src, how)                  這一行換了：how 是 'code'、'cell'、'type'、'undo'、'menu' 其中一個（edit() 算打字：'type'）
// 也可以直接點上面鼓機卡的格子，或在那一行字上打字：下面的圖和歷史都跟著變。
const RHYTHMS = [
  'bd*4, [~ sd]*2, hh*8',                     // 1  四四拍，後拍小鼓
  'bd(3,8), [~ sd]*2, hh*8',                  // 2  歐幾里得：8 格裡放 3 下大鼓
  'bd [~ bd] ~ bd, ~ sd ~ sd, hh*16',         // 3  大鼓切分，十六分音符的 hi-hat
  'bd ~ [~ bd] ~, ~ cp ~ cp, hh(5,8)',        // 4  拍手，hi-hat 在 8 格裡放 5 下
];

let nowLine = '', how = '', msg = '';   // msg：剛剛那個動作的結果，寫在畫面上

function setup() {
  createCanvas(windowWidth, windowHeight);
  textFont('monospace');
  startDrums(RHYTHMS[0], 104);
}

function draw() {
  background(14, 16, 26);
  const d = min(width * 0.36, height * 0.42), ts = max(11, min(15, width / 55));
  drawRhythm(width * 0.27 - d / 2, height * 0.6 - d / 2, d, d, 'circle');   // 一圈 16 格，指針照 drumPhase 轉

  const x = width * 0.5;                                                     // 右半邊：現在那一行、怎麼改的、更早的幾行
  noStroke(); textAlign(LEFT, TOP);
  fill(255, 225); textSize(min(ts * 1.25, width * 0.46 / max(8, nowLine.length * 0.62)));   // 長的一行縮小一點，放得下
  text(nowLine || '（鼓機載入中）', x, height * 0.42);                       // rhythmChanged() 告訴我們現在打的那一行
  fill(130, 200, 255); textSize(ts);
  text(how ? '改自：' + how + (msg ? '　' + msg : '') : msg, x, height * 0.42 + ts * 2.4);
  const hist = drumsAreOn ? OAVp5.drums.history : [];                       // 更早的幾行，舊的在前
  fill(255, 110); textSize(ts);
  hist.slice(-3).reverse().forEach((h, i) => text('↶ ' + h, x, height * 0.42 + ts * 4.6 + i * ts * 1.6));   // 最近的在最上面

  textAlign(CENTER, BOTTOM); fill(235); textSize(max(12, min(15, width / 60)));
  text('1–4 換節奏　·　Z 上一步（' + hist.length + '）　·　S 開到 Strudel　·　也可以點格子、在那一行字上打字', width / 2, height - 20);
}

// 這一行換了：程式呼叫 startDrums() 或 edit()（'code'、'type'）、點了格子（'cell'）、按 ↶ 或 Z（'undo'）、選單（'menu'）
function rhythmChanged(src, why) { nowLine = src; how = why; }

function keyPressed() {
  const n = '1234'.indexOf(key);
  if (n >= 0) {
    const r = OAVp5.drums.edit(RHYTHMS[n]);                    // → { ok, error }
    msg = r && r.ok ? '' : '還沒準備好，再按一次';
  } else if (key === 'z' || key === 'Z') {
    msg = OAVp5.drums.undo() ? '' : '沒有更早的了';             // → true 或 false
  } else if (key === 's' || key === 'S') {
    const url = OAVp5.drums.strudelUrl;                         // strudel.cc 的網址，這一行就在裡面
    if (url) window.open(url, '_blank');
    else msg = '還沒有可以開的節奏';
  }
}

function windowResized() { resizeCanvas(windowWidth, windowHeight); }
