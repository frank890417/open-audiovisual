// 第一行：Open Audio Visual 一行注入。這份草圖把節奏「畫在畫布上」：錄影（startRecording）只錄畫布，所以畫面上的節奏也會進影片。
document.head.prepend(Object.assign(document.createElement('script'), { src: 'https://openaudiovisual.com/p5/oav-p5.js' }));

// 一行節奏（寫法來自 TidalCycles／Strudel，strudel.cc）。上方鼓機卡上的這一行可以直接點進去改；點格子，這一行也會跟著改寫。
// 卡上的 ↶ 回上一步，「複製」拿到 startDrums("…") 一行，「在 Strudel 打開」把同一行帶去 strudel.cc。
const RHYTHM = "bd(3,8), [~ sd]*2, hh*8, ~ ~ ~ cp";

let line = RHYTHM;        // 現在打的那一行：rhythmChanged() 會告訴我們
let pulse = 0;

function setup() {
  createCanvas(windowWidth, windowHeight);
  startDrums(RHYTHM, 104);
}

function draw() {
  background(14, 16, 26);
  pulse *= 0.9;
  const s = min(width * 0.36, height * 0.5);

  // drawRhythm(x, y, 寬, 高, 樣式)：'circle' 一圈 16 格，指針照 drumPhase 轉；響的那格亮起來
  drawRhythm(width * 0.27 - s / 2, height * 0.46 - s / 2, s, s, 'circle');
  // 'spiral'：最近 4 小節往外繞，現在在最外面的尖端
  drawRhythm(width * 0.73 - s / 2, height * 0.46 - s / 2, s, s, 'spiral', { bars: 4 });
  // 'grid'：跟鼓機卡一樣的 16 格，加一條播放頭；顏色可以自己給
  drawRhythm(width * 0.08, height * 0.8, width * 0.84, height * 0.13, 'grid', { colors: { kick: '#ff7b54', hat: '#5ce1e6' } });

  // 這一行字也畫在畫布上（錄影看得到）；大鼓一響就亮一下
  noStroke();
  fill(255, 200 + pulse * 55);
  textFont('monospace');
  textAlign(CENTER, BOTTOM);
  textSize(max(14, min(22, width / 50)));
  text(line, width / 2, height * 0.78);
}

// 這一行換了：程式呼叫 startDrums、點了格子（how = 'cell'）、在卡上打字（'type'）、按 ↶（'undo'）
function rhythmChanged(src, how) { line = src; }
function kickDetected(level) { pulse = level; }

// 按 R 錄 8 秒（畫面和鼓聲一起，存成 MP4）
function keyPressed() { if (key === 'r' || key === 'R') startRecording(8); }

function windowResized() { resizeCanvas(windowWidth, windowHeight); }
