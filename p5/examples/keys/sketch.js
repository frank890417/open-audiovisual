// 第一行：Open Audio Visual 一行注入。接上 MIDI 鍵盤、按 🎹 打開螢幕上的控制器，或用手機彈，都會出聲也會長出粒子。
document.head.prepend(Object.assign(document.createElement('script'), { src: 'https://openaudiovisual.com/p5/oav-p5.js' }));

// 每按一個鍵：鋼琴響一聲，那個音高的位置炸開一團粒子，按得越用力散得越開。
// 顏色跟著音名走（C 是紅、G 是青……），同一個音不管高低八度都是同一個顏色。
// 打擊墊（第 10 軌）會打鼓，不會彈成鋼琴。🎹 → 🔊 可以換樂器、關聲音。
let particles = [];

function setup() {
  createCanvas(windowWidth, windowHeight);
  colorMode(HSB, 360, 100, 100, 100);
  noStroke();
  startSound('piano');   // 鋼琴（第一次載入要幾秒，載好之前先用電鋼琴頂著）；瀏覽器要你先點一下畫面才出聲
  midi.panel.open();     // 沒有實體鍵盤：螢幕上的鍵盤直接打開
}

function draw() {
  background(230, 30, 8, 25);
  for (const p of particles) {
    p.vy += 0.06;
    p.x += p.vx;
    p.y += p.vy;
    p.life -= 1;
    fill(p.hue, 70, 100, p.life);
    circle(p.x, p.y, p.size * (p.life / 100));
  }
  particles = particles.filter((p) => p.life > 0);
  if (!soundIsOn) {
    fill(0, 0, 100, 70);
    textAlign(CENTER);
    text('點一下畫面就有聲音', width / 2, height / 2 - 40);
  }
}

function notePressed(note, velocity) {
  const shade = (note % 12) * 30;                    // 十二個音名，一圈色相（不叫 hue、tint：p5 都有）
  const x = map(note, 36, 96, 40, width - 40, true);  // 低音在左、高音在右
  for (let i = 0; i < 10 + velocity * 50; i++) {
    const a = random(TWO_PI), speed = random(1, 7) * (0.4 + velocity);
    particles.push({
      x, y: height / 2, hue: (shade + random(-12, 12) + 360) % 360,
      vx: cos(a) * speed, vy: sin(a) * speed - 2,      // 像煙火往四面散開，再慢慢落下
      size: random(6, 18), life: 100,
    });
  }
}

function windowResized() { resizeCanvas(windowWidth, windowHeight); }
