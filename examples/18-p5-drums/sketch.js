// 第一行：Open Audio Visual 一行注入。這份草圖開一台鼓機，畫面上方那 16 格就是它（點格子可以改節奏）。
document.head.prepend(Object.assign(document.createElement('script'), { src: 'https://openaudiovisual.com/p5/oav-p5.js' }));

// 鼓機也是時間軸：16 格是一小節，外圈 16 顆點跟著它走。
// 大鼓：花瓣鼓起來。小鼓：整朵轉半瓣。Hi-hat：外圈閃一下。拍手：整個畫面亮一下。每一小節：顏色往前走一點；每一拍（4 格）：外圈的大點脹一下。
// 第 1、5、9 小節換場景，每 12 小節繞一圈：cue() 宣告，cueFired() 接。
// kickDetected() 這幾個是麥克風的同名函式：拿掉 startDrums()、開麥克風，這份草圖照樣會動。
const SCENES = {
  calm:  { petals: 6,  hue: 200, spin: 0.002 },
  bloom: { petals: 9,  hue: 310, spin: 0.006 },
  storm: { petals: 14, hue: 25,  spin: -0.014 },
};
let look = SCENES.calm;
let swell = 0, spin = 0, turn = 0, turnTo = 0, drift = 0, flash = 0, ping = 0;
let sparks = [];

function setup() {
  createCanvas(windowWidth, windowHeight);
  colorMode(HSB, 360, 100, 100, 100);
  startDrums('breakbeat', 110);   // 節奏、速度（bpm）
  cue(1, 'calm', 12);             // 第 1 小節，每 12 小節再一次
  cue(5, 'bloom', 12);
  cue(9, 'storm', 12);
}

function draw() {
  background(230, 40, 7 + flash * 25, 30);                       // 拍手：整個畫面亮一下
  flash *= 0.85; ping *= 0.9;
  translate(width / 2, height / 2 + 50);
  const R = min(width, height) * 0.26;
  const shade = (look.hue + drift) % 360;          // 不叫 hue、tint：p5 都有
  spin += look.spin;
  turn = lerp(turn, turnTo, 0.25);
  swell *= 0.88;

  // 花瓣：一層一層疊，越裡面越亮
  noStroke();
  for (let layer = 3; layer >= 1; layer--) {
    const r = R * (0.35 + layer * 0.22) * (1 + swell * 0.25);
    fill((shade + layer * 18) % 360, 70, 30 + layer * 22, 55);
    for (let i = 0; i < look.petals; i++) {
      push();
      rotate(spin + turn + i * TWO_PI / look.petals + layer * 0.2);
      ellipse(r * 0.5, 0, r, r * (0.9 / look.petals + 0.18));
      pop();
    }
  }

  // 外圈 16 顆點：鼓機現在走到第幾格（drumStep 0–15）
  for (let i = 0; i < 16; i++) {
    const a = -HALF_PI + i * TWO_PI / 16;
    const now = drumsAreOn && i === drumStep;
    fill(now ? color(shade, 30, 100) : color(shade, 40, 45, 60));
    circle(cos(a) * R * 1.45, sin(a) * R * 1.45, now ? 16 : i % 4 === 0 ? 9 + ping * 7 : 5);
  }

  // Hi-hat 的火花
  for (const s of sparks) {
    fill((shade + 180) % 360, 50, 100, s.life * 100);
    circle(cos(s.a) * R * s.d, sin(s.a) * R * s.d, 6 * s.life + 2);
    s.life -= 0.05;
  }
  sparks = sparks.filter((s) => s.life > 0);

  fill(0, 0, 100, 70);
  textAlign(CENTER);
  text(`第 ${drumBar} 小節 · ${cueName} · ${round(drumBpm)} bpm`, 0, min(R * 1.7, height / 2 - 80));
}

function kickDetected(level) { swell = 0.6 + level; }          // 大鼓
function snareDetected(level) { turnTo += PI / look.petals; }   // 小鼓（拍手也算）
function hatDetected(level) { sparks.push({ a: random(TWO_PI), d: random(1.1, 1.35), life: 1 }); }
function barStarted(bar) { drift += 9; }                        // 每一小節的第一格
function cueFired(name, bar) { look = SCENES[name]; }           // cue() 宣告的那一小節
function drumHit(lane, velocity) { if (lane === 'clap') flash = velocity; }   // 四軌都會叫它：kick、snare、hat、clap
function stepStarted(step, bar) { if (step % 4 === 0) ping = 1; }   // 每一格（0–15）的開頭；每 4 格是一拍

function windowResized() { resizeCanvas(windowWidth, windowHeight); }
