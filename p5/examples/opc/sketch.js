// 第一行：Open Audio Visual 一行注入。
document.head.append(Object.assign(document.createElement('script'), { src: 'https://openaudiovisual.com/p5/oav-p5.js' }));

// 用 OpenProcessing 的 OP Configurator 3000（右側 Libraries 打開它）宣告有名字、有範圍的變數；
// OAV 會把控制器依序接上：第 1 個 slider 給旋鈕 1、第 2 個給旋鈕 2……，第 1 個 toggle 給打擊墊 1。
// 沒有控制器時，OpenProcessing 側欄的滑桿照樣能拉；轉旋鈕時，側欄的滑桿也會跟著動。
OPC.slider('radius', 60, 10, 300);    // 旋鈕 1
OPC.slider('speed', 1, 0, 5, 0.1);    // 旋鈕 2
OPC.slider('baseHue', 200, 0, 360, 1); // 旋鈕 3（別取 hue、fill 這類 p5 已經有的名字）
OPC.toggle('trails', true);           // 打擊墊 1：按一下切換

let t = 0;

function setup() {
  createCanvas(windowWidth, windowHeight);
  colorMode(HSB, 360, 100, 100, 100);
  noStroke();
}

function draw() {
  background(230, 30, 8, trails ? 12 : 100);
  t += speed * 0.02;
  fill(baseHue, 70, 100);
  circle(width / 2 + cos(t) * width * 0.3, height / 2 + sin(t * 1.3) * height * 0.3, radius);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
