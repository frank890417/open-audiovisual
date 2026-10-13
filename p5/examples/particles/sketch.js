// 第一行：Open Audio Visual 一行注入——接上 MIDI 鍵盤、按右下角 🎹 的螢幕控制器，或用手機彈，都會進到下面的 noteOn。
document.head.append(Object.assign(document.createElement('script'), { src: 'https://openaudiovisual.com/p5/oav-p5.js' }));

// 按一個鍵：從那個音高的位置噴出一團粒子，按得越用力越多、飛得越高。
// 轉任何一顆旋鈕：整體顏色跟著轉。按著不放的鍵，底下那一格會一直亮。
let particles = [];
let hue = 200;

function setup() {
  createCanvas(windowWidth, windowHeight);
  colorMode(HSB, 360, 100, 100, 100);
  noStroke();
}

function draw() {
  background(230, 30, 8, 30);
  for (const p of particles) {
    p.vy += 0.08;
    p.x += p.vx;
    p.y += p.vy;
    p.life -= 1.2;
    fill((hue + p.shift + 360) % 360, 70, 100, p.life);
    circle(p.x, p.y, p.size);
  }
  particles = particles.filter((p) => p.life > 0 && p.y < height + 40);

  // midi.note[n] 是那個鍵現在的力度（0–1），放開就回到 0
  for (let n = 36; n <= 84; n++) {
    if (midi.note[n] > 0) {
      fill(hue, 60, 100, 40 + 60 * midi.note[n]);
      rect(keyX(n) - 6, height - 14, 12, 14);
    }
  }
}

function noteOn(note, velocity) {
  const count = 6 + floor(velocity * 40);
  for (let i = 0; i < count; i++) {
    particles.push({
      x: keyX(note), y: height - 20,
      vx: random(-2.5, 2.5), vy: -random(3, 9) * (0.4 + velocity),
      size: random(4, 14) * (0.5 + velocity), life: 100, shift: random(-40, 40),
    });
  }
}

function controlChange(cc, value) {
  hue = value * 360;
}

// MIDI 36（C2）到 84（C6）鋪滿畫面寬度
function keyX(note) {
  return map(note, 36, 84, 40, width - 40, true);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
