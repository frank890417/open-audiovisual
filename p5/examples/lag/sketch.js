// 第一行：Open Audio Visual 一行注入。這份草圖讀 micLevel，第一次讀到時瀏覽器會問你要不要開麥克風。
document.head.prepend(Object.assign(document.createElement('script'), { src: 'https://openaudiovisual.com/p5/oav-p5.js' }));

// 左邊：麥克風原本的值，一抖一抖的。右邊：同一個值經過 lag()，像 VU 表：出聲立刻撐開（0.03 秒）、安靜下來慢慢收（0.4 秒）。
// 這就是 TouchDesigner 的 Lag CHOP（Lag 1、Lag 2）。改改看兩個秒數：lag(micLevel, 0.3, 0.3) 會變得很懶。
// 角落的小示波器是 scope()：只在網頁上，不會錄進影片。下面那條橫的是 drawTrail()：畫在畫布上，作品裡看得到、錄影也錄得到。
// 不用宣告、不用寫在 setup()：draw() 裡呼叫就好。

function setup() {
  createCanvas(windowWidth, windowHeight);
  textFont('system-ui');
}

function draw() {
  background(16, 18, 26);
  const raw = micLevel;                               // 原值：0–1，跟 mouseX 一樣直接讀
  const smooth = lag(raw, 0.03, 0.4);                 // lag 後：上升 0.03 秒、下降 0.4 秒
  scope(raw, 'mic');                                  // 角落的示波器：同一幀呼叫兩次就疊兩條線（綠、黃，跟下面畫布上的顏色一樣）
  scope(smooth, 'lag');

  const y = height * 0.34, size = min(width / 2, height * 0.45) * 0.8;
  noStroke();
  fill(95, 224, 138);
  circle(width * 0.25, y, 20 + raw * size);
  fill(255, 211, 107);
  circle(width * 0.75, y, 20 + smooth * size);

  fill(235); textAlign(CENTER); textSize(16);
  text('micLevel', width * 0.25, y + size / 2 + 34);
  text('lag(micLevel, 0.03, 0.4)', width * 0.75, y + size / 2 + 34);

  // 下面這一條：最近 3 秒，兩條線疊在一起（框的底是 0、頂是 1）。左下角留給 scope。
  const top = height * 0.62, h = min(100, height * 0.16);
  noFill(); strokeWeight(2);
  stroke(95, 224, 138); drawTrail(trail(raw, 3), 16, top, width - 32, h);
  stroke(255, 211, 107); drawTrail(trail(smooth, 3), 16, top, width - 32, h);

  if (!micIsOn) { noStroke(); fill(255, 180); text('允許麥克風，然後出點聲音', width / 2, 40); }
}

function windowResized() { resizeCanvas(windowWidth, windowHeight); }
