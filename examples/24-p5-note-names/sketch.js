// 第一行：Open Audio Visual 一行注入。接上 MIDI 鍵盤、按 🎹 打開螢幕上的控制器，或用手機彈。
document.head.prepend(Object.assign(document.createElement('script'), { src: 'https://openaudiovisual.com/p5/oav-p5.js' }));

// 音名直接寫：noteIsDown('C4') 跟 noteIsDown(60) 一樣，C4 就是中央 C（MIDI 60）。
// 按著 C4 畫圓、按著 E4 畫方、按著 G4 畫三角；三個一起按（C 大調和弦）三個圖形就轉起來。
// 升降記號也行：'C#4'、'Db4'、'f#3'（大小寫都可以）。有些軟體（Ableton、Yamaha）把 60 叫 C3，這裡是 C4。
// 沒有鍵盤？🎹 打開螢幕上的鍵盤，或用電腦鍵盤。
const NOTES = ['C4', 'E4', 'G4'];

function setup() {
  createCanvas(windowWidth, windowHeight);
  textFont('system-ui');
  midi.panel.open();
}

function draw() {
  background(16, 18, 26);
  // 🎹 面板最多蓋住視窗的下半（max-height: 50vh）：要讀的東西全放在上半，名字和赫茲才看得到
  const stage = height * 0.48;
  const gap = min(width / 3, 260), size = min(gap * 0.55, stage * 0.3), cy = stage * 0.4;
  const chord = NOTES.every((n) => noteIsDown(n));   // 三個都按著
  const spin = chord ? frameCount * 0.04 : 0;
  noStroke(); textAlign(CENTER);
  NOTES.forEach((name, i) => {
    const x = width / 2 + (i - 1) * gap, on = noteIsDown(name);
    push();
    translate(x, cy); rotate(spin * (i + 1));
    fill(on ? color(255, 211, 107) : color(60, 66, 84));
    if (i === 0) circle(0, 0, size);
    else if (i === 1) { rectMode(CENTER); square(0, 0, size * 0.9); }
    else triangle(0, -size * 0.55, -size * 0.5, size * 0.4, size * 0.5, size * 0.4);
    pop();
    fill(on ? 255 : 130); textSize(18);
    text(name + ' = ' + noteNumber(name), x, cy + size * 0.9 + 24);   // noteNumber('C4') → 60
  });
  // 最後按的那個鍵：notePressed 拿到的還是號碼，noteName() 把它翻回名字，noteFreq() 算出赫茲
  fill(235); textSize(22);
  const last = midi.last && midi.last.note != null ? midi.last.note : null;
  text(last == null ? '彈 C4、E4、G4' : noteName(last) + '  ·  ' + noteFreq(last).toFixed(1) + ' Hz', width / 2, stage * 0.92);
}

function windowResized() { resizeCanvas(windowWidth, windowHeight); }
