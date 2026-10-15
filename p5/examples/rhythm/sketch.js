// 第一行：Open Audio Visual 一行注入。這份草圖用「一行字」寫節奏，畫面上方的鼓機卡會把這一行顯示出來，正在響的字會亮。
document.head.prepend(Object.assign(document.createElement('script'), { src: 'https://openaudiovisual.com/p5/oav-p5.js' }));

// 一行節奏：bd 大鼓、sd 小鼓、hh 鈸、cp 拍手，~ 是休息。空白隔開的字平分一小節；[ ] 擠進一格；*4 在那一格打 4 下；
// 逗號「,」是疊在一起的另一行。改一個字就換節奏，試試：hh*8 → hh*16；bd*4 → bd(3,8)；最後加上 ", cp(2,8)"。
// 寫錯了，右邊會跳一張卡說第幾個字有問題，鼓機先打 four on floor。（這種寫法來自 TidalCycles／Strudel，strudel.cc）
const RHYTHM = "bd*4, [~ sd]*2, hh*8";

let swell = 0, flash = 0, sparks = [];

function setup() {
  createCanvas(windowWidth, windowHeight);
  colorMode(HSB, 360, 100, 100, 100);
  startDrums(RHYTHM, 110);        // 一行節奏、速度（bpm）
}

function draw() {
  background(230, 40, 7 + flash * 20, 30);
  flash *= 0.85;
  swell *= 0.88;
  translate(width / 2, height / 2 + 50);
  const R = min(width, height) * 0.26;

  // drumPhase：這一小節走到哪（0 → 1，連續的）。乘上 TWO_PI，指針一小節轉一圈。
  push();
  rotate(drumPhase * TWO_PI - HALF_PI);
  stroke(45, 60, 100, 85);
  strokeWeight(4);
  line(0, 0, R * 1.35, 0);
  pop();

  // beatPhase：這一拍走到哪（0 → 1）。1 - beatPhase：每一拍一開始最大，慢慢縮到下一拍。
  noStroke();
  fill(205 + swell * 90, 65, 100, 70);
  circle(0, 0, R * (0.55 + 0.3 * (1 - beatPhase)) + swell * 70);

  // 外圈 16 顆點：一小節 16 格，drumStep 是正在響的那一格
  for (let i = 0; i < 16; i++) {
    const a = -HALF_PI + i * TWO_PI / 16;
    const now = drumsAreOn && i === drumStep;
    fill(now ? color(45, 60, 100) : color(220, 30, 55, i % 4 === 0 ? 90 : 50));
    circle(cos(a) * R * 1.45, sin(a) * R * 1.45, now ? 16 : i % 4 === 0 ? 9 : 5);
  }

  // 鈸的火花
  for (const s of sparks) {
    fill(170, 50, 100, s.life * 100);
    circle(cos(s.a) * R * s.d, sin(s.a) * R * s.d, 6 * s.life + 2);
    s.d += 0.01;
    s.life -= 0.05;
  }
  sparks = sparks.filter((s) => s.life > 0);

  fill(0, 0, 100, 70);
  textAlign(CENTER);
  text(`第 ${drumBar} 小節`, 0, min(R * 1.75, height / 2 - 70));
}

function kickDetected(level) { swell = 0.4 + level * 0.6; }                     // 大鼓
function snareDetected(level) { flash = level; }                                // 小鼓（拍手也算）
function hatDetected(level) { sparks.push({ a: random(TWO_PI), d: random(1.1, 1.3), life: 1 }); }   // 鈸
function drumHit(lane, velocity) { if (lane === 'crash') flash = 1; }           // 每一種鼓都會叫它：字串裡的 cr（碎音鈸）也是

function windowResized() { resizeCanvas(windowWidth, windowHeight); }
