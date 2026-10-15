// Strudel 寫音樂、這份草圖畫畫面。strudel.cc 那一頁和這一頁設同一個房間（link），Strudel 的 .midi('OAV Virtual MIDI')
// 就會傳到這裡：每個音呼叫 notePressed()，Strudel 送的 MIDI 時鐘推著 drumPhase（一小節轉一圈）。
// 在 OpenProcessing：房間名寫在第一行前面 —— window.OAV_P5 = { link: 'oav-strudel-demo' }
// strudel.cc 那邊（設定 → prebake 放第一行，或程式第一行；網址一定用單引號）：
//   window.OAV_P5 = { link: 'oav-strudel-demo' }; await import('https://openaudiovisual.com/p5/oav-p5.js')
//   setcps(120 / 60 / 4)
//   stack(note("c3 [e3 g3] <a3 b3> c4"), midicmd("clock*96, <start stop>/8")).midi('OAV Virtual MIDI')
// （Strudel 是另一個獨立程式，AGPL-3.0，strudel.cc；OAV 不含它的任何程式，兩邊只透過 MIDI 溝通。）
window.OAV_P5 = window.OAV_P5 || { link: 'oav-strudel-demo' };
document.head.prepend(Object.assign(document.createElement('script'), { src: 'https://openaudiovisual.com/p5/oav-p5.js' }));

let drops = [];

function setup() {
  createCanvas(windowWidth, windowHeight);
  colorMode(HSB, 360, 100, 100, 100);
  textFont('monospace');   // one family name: p5 reads a CSS list as a single (missing) font and falls back to serif
}

// Strudel 的每個音：音高決定顏色和位置，力度決定大小
function notePressed(n, v) {
  drops.push({ x: map(n % 24, 0, 23, width * 0.15, width * 0.85), y: height * 0.75, r: 30 + v * 90, h: (n * 29) % 360, life: 1 });
}

function draw() {
  background(230, 40, 6, 35);
  // drumPhase：外部時鐘（Strudel 的 midicmd clock）在這一小節走到哪，0 → 1；beatPhase 每一拍 0 → 1
  push();
  translate(width / 2, height * 0.42);
  noFill();
  stroke(200, 30, 60, 60);
  strokeWeight(2);
  circle(0, 0, min(width, height) * 0.5);
  rotate(drumPhase * TWO_PI - HALF_PI);
  stroke(45, 70, 100, 90);
  strokeWeight(5);
  line(0, 0, min(width, height) * 0.25, 0);
  pop();
  noStroke();
  fill(45, 70, 100, 40 * (1 - beatPhase));
  circle(width / 2, height * 0.42, 30 + 40 * (1 - beatPhase));

  for (const d of drops) {
    fill(d.h, 70, 100, d.life * 80);
    circle(d.x, d.y, d.r * (1.4 - d.life * 0.4));
    d.y -= 2.2; d.life *= 0.965;
  }
  drops = drops.filter((d) => d.life > 0.03);

  // 房間和時鐘：link 連上了沒、另一頁在不在、外部時鐘幾 BPM
  const L = OAVp5.link.info, C = OAVp5.clock.info;
  fill(0, 0, 85);
  textSize(13);
  text((L ? '🔗 ' + L.room + ' · ' + L.state + ' · ' + (L.peers || 0) + ' other page(s)' + (L.trip != null ? ' · ~' + L.trip + ' ms' : '') : 'no link') +
    '   ⏱ ' + (C.state === 'running' ? Math.round(C.bpm) + ' BPM, bar ' + drumBar : C.state), 16, height - 18);
}

function windowResized() { resizeCanvas(windowWidth, windowHeight); }
