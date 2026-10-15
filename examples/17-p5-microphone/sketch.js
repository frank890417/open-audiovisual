// 第一行：Open Audio Visual 一行注入。這份草圖讀 micLevel、bass、beat，第一次讀到時瀏覽器會問你要不要開麥克風。
document.head.prepend(Object.assign(document.createElement('script'), { src: 'https://openaudiovisual.com/p5/oav-p5.js' }));

// 出聲：圓變大。低音多：顏色往紫紅走。每個拍子：外面彈出一圈。
// 沒有 p5.sound，也不用寫 userStartAudio()。🎹 → 🎤 也能手動開關。
// micLevel 是「聽起來多大聲」：房間本身是 0，說話大約 0.4–0.6，大喊接近 1。麥克風太小聲：在 setup() 寫 micSensitivity(3)。
let ring = 0;

function setup() {
  createCanvas(windowWidth, windowHeight);
  colorMode(HSB, 360, 100, 100, 100);
}

function draw() {
  background(230, 40, 10);
  noStroke();
  fill(200 + bass * 160, 70, 100);              // bass：低音，0–1，跟 mouseX 一樣直接讀
  circle(width / 2, height / 2, 50 + micLevel * 300);   // micLevel：聽起來多大聲，0–1
  if (beat) ring = 1;                           // beat：這一格剛好有一個拍子
  if (ring > 0) {
    noFill(); stroke(0, 0, 100, ring * 80); strokeWeight(4);
    circle(width / 2, height / 2, 360 + (1 - ring) * 300);
    ring -= 0.04;
  }
  if (!micIsOn) { noStroke(); fill(0, 0, 100, 70); textAlign(CENTER); text('允許麥克風，然後出點聲音', width / 2, height - 40); }
}

function windowResized() { resizeCanvas(windowWidth, windowHeight); }
