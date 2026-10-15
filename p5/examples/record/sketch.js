// 第一行：Open Audio Visual 一行注入。這份草圖示範「錄一支有聲音的作品影片」：鼓機打拍子、鍵盤彈旋律，按 R 錄影。
document.head.prepend(Object.assign(document.createElement('script'), { src: 'https://openaudiovisual.com/p5/oav-p5.js' }));

// 錄影：按 R（或 🎹 → ⏺ 錄影）開始，再按一次 R 停止；寫 startRecording(10) 就是錄 10 秒自動停。
// 進影片的只有「畫布＋作品的聲音」（鼓機、彈的音、開著的麥克風），🎹、鼓機格子和提示條都不會出現在影片裡。
// 錄好自動下載 mp4（IG 可以直接上傳），然後 recordingSaved(info) 會被叫到：info 有檔名、長度、大小。
// 存圖：按 P（或 🎹 → 📷 存圖），只存畫布的 PNG；作品要交的靜態圖就這樣一張一張存。
// 彈：電腦鍵盤 A S D F G H J K（C 大調），或 🎹 螢幕上的鍵盤、MIDI 鍵盤、手機。
const SCALE = { a: 60, s: 62, d: 64, f: 65, g: 67, h: 69, j: 71, k: 72 };
let rings = [];
let pulse = 0;
let lastTake = '';

function setup() {
  createCanvas(windowWidth, windowHeight);
  colorMode(HSB, 360, 100, 100, 100);
  startDrums('four on floor', 100);   // 鼓機：第一次點畫面之後才有聲音
  startSound('synth/pluck');          // 撥奏的合成器：不用下載音色，點一下就響
}

function draw() {
  background(250, 40, 8, 30);
  translate(width / 2, height / 2);
  pulse *= 0.88;

  // 每彈一個音，從中間擴散一圈；顏色跟著音名走
  noFill();
  for (const r of rings) {
    stroke(r.shade, 70, 100, r.life);
    strokeWeight(2 + r.life / 25);
    circle(0, 0, r.size);
    r.size += 7;
    r.life -= 1.3;
  }
  rings = rings.filter((r) => r.life > 0);

  // 中間的圓：大鼓一下就鼓起來，顏色跟著鼓機走到第幾格
  noStroke();
  fill(drumStep * 22, 60, 100, 85);
  circle(0, 0, 50 + pulse * 140);

  // 說明字只在「沒在錄」的時候畫：錄影時畫面是乾淨的作品
  if (!recordingIsOn) {
    fill(0, 0, 100, 60);
    textAlign(CENTER);
    textSize(14);
    text('點一下畫面就有聲音 · A–K 彈 · R 錄影 · P 存圖', 0, height / 2 - 40);
    if (lastTake) text('上一段：' + lastTake, 0, height / 2 - 18);
  }
}

function keyPressed() {
  const k = key.toLowerCase();
  if (SCALE[k]) midi.play(SCALE[k], 0.8);          // 跟按 🎹 上的鍵一樣：有聲音，也會叫 notePressed()
  if (k === 'r') {
    if (recordingIsOn) stopRecording();
    else startRecording();                          // 不給秒數：錄到再按一次 R（最長 5 分鐘）
  }
  if (k === 'p') OAVp5.record.shot();               // p5 自己的 saveCanvas('作品', 'png') 也可以
}

function keyReleased() {
  const k = key.toLowerCase();
  if (SCALE[k]) midi.play(SCALE[k], 0);
}

function notePressed(note, velocity) {
  rings.push({ size: 60, life: 100, shade: (note % 12) * 30 });   // 不叫 hue：p5 有這個名字
}

function kickDetected(level) { pulse = level; }

function recordingSaved(info) {                     // 錄好了：info.name、info.seconds、info.bytes、info.format（mp4 或 webm）
  lastTake = `${info.name}（${info.seconds} 秒）`;
}

function windowResized() { resizeCanvas(windowWidth, windowHeight); }
