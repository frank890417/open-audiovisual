// 第一行：Open Audio Visual 一行注入。這份草圖用 startDrums() 自己打鼓，不用麥克風也不用 MIDI，貼到 OpenProcessing 就會動。
document.head.prepend(Object.assign(document.createElement('script'), { src: 'https://openaudiovisual.com/p5/oav-p5.js' }));

// 一個圓盤：大鼓一敲就撐開，彈簧把它彈回來；指針一直轉；每數到第 4 下大鼓，換一個顏色。
// 這幾個是 TouchDesigner 的 CHOP（Trigger、Spring、Speed、Count、Slope），在 draw() 裡呼叫就好，不用宣告：
//   env('kick', 0.01, 0.3)   大鼓一響就升到 1（0.01 秒），0.3 秒落回 0
//   spring(值, 140, 6)        像彈簧上的一個重物追著那個值，會過衝、會彈
//   speed(TWO_PI * 0.15)      每秒加 TWO_PI * 0.15，每 6.7 秒轉一圈
//   count('kick', 4)          大鼓響了幾下，數到 4 又從 0 開始；count('kick') 是總共幾下
// 想自己敲一下？按空白鍵或點一下畫面：trigger('boom') 是你自己的事件，env('boom') 接。
const COLORS = [[18, 85, 100], [48, 80, 100], [170, 70, 90], [260, 55, 100], [320, 65, 100]];   // HSB：色相、飽和、亮度

function setup() {
  createCanvas(windowWidth, windowHeight);
  colorMode(HSB, 360, 100, 100, 100);
  textFont('system-ui');
  startDrums('bd*4, [~ sd]*2, hh*8', 108);   // 沒有麥克風、沒有鍵盤也有大鼓：一行字寫節奏，bd 是大鼓
  trigger('boom');                           // 開場先敲一下
}

function draw() {
  background(235, 30, 8);
  const R = min(width, height) * 0.24;
  const kick = env('kick', 0.01, 0.3);                       // 0..1：大鼓一敲就是 1，然後落下
  const r = spring(R * (0.62 + kick * 0.4), 140, 6);         // 圓盤的半徑：被大鼓推開，彈簧把它彈回來（過衝再穩住）
  const turn = speed(TWO_PI * 0.15);                         // 一直轉：角度每秒加一點
  const nth = count('kick', 4);                             // 0 1 2 3 0 1 …：這一組的第幾下
  const group = floor(count('kick') / 4) % COLORS.length;    // 第幾組：每 4 下大鼓換一個顏色
  const boom = env('boom', 0.005, 0.7);                      // 你自己敲的（空白鍵或點一下）
  const moving = abs(slope(r));                              // 圓盤現在長大或縮小得多快（每秒幾像素）
  scope(r, 'disc');                                          // 角落的小示波器：看彈簧怎麼彈
  const [h, s, b] = COLORS[group];

  translate(width / 2, height * 0.6);
  noFill();
  stroke(0, 0, 100, 18 + boom * 60); strokeWeight(3 + boom * 8);
  circle(0, 0, R * 1.9 + boom * R * 0.9);                    // 你敲的那一下：一圈白色往外推
  noStroke(); fill(h, s, b);
  circle(0, 0, r * 2);                                       // 圓盤
  noFill(); stroke(h, 20, 100, 90); strokeWeight(2 + min(14, moving / 120));
  circle(0, 0, r * 2);                                       // 圓邊：動得越快越粗
  push(); rotate(turn);
  stroke(0, 0, 100, 90); strokeWeight(5); line(0, 0, r * 0.9, 0);   // 指針
  noStroke(); fill(0, 0, 100); circle(r * 0.9, 0, 18);
  pop();
  noStroke(); fill(h, s * 0.5, 100); circle(0, 0, 22);

  // 這一組的 4 顆點（圓盤下半）：數到第幾下就亮到第幾顆
  for (let i = 0; i < 4; i++) {
    fill(h, i <= nth ? s : 20, i <= nth ? 100 : 40, i <= nth ? 100 : 60);
    circle((i - 1.5) * 34, R * 0.42, i === nth ? 20 : 12);
  }

  // 說明：上面那幾個 CHOP 現在的值
  resetMatrix();
  fill(0, 0, 100, 75); textAlign(CENTER); textSize(max(12, min(15, width / 60)));
  text('env(\'kick\') ' + nf(kick, 1, 2) + '   spring ' + nf(r, 1, 0) + ' px   count(\'kick\', 4) ' + nth + '   第 ' + (group + 1) + ' 組', width / 2, height - 54);
  fill(0, 0, 100, 45);
  text('空白鍵或點一下畫面：自己敲一下（trigger(\'boom\')）', width / 2, height - 30);
}

function keyPressed() { if (key === ' ') { trigger('boom'); return false; } }
function mousePressed() { trigger('boom'); }

function windowResized() { resizeCanvas(windowWidth, windowHeight); }
