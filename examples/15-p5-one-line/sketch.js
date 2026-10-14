document.head.prepend(Object.assign(document.createElement('script'), { src: 'https://openaudiovisual.com/p5/oav-p5.js' }));
// ^ line 1 is the whole integration. Everything below is an ordinary p5.js sketch.
//   第一行就是全部的接線，下面是一份普通的 p5.js 草圖。

// A flower that breathes on its own. What you can play (MiniLab 3 numbering; the 🎹 on screen is the same):
//   knob1 colour · knob2 petals · knob3 size · knob4 trails · knob5 spin
//   pad1..pad8   a ring bursts from that spot on the outer circle, the flower pulses
//   keys         a spark flies up from the key's place on the strip, a beam stays while it is held
// 花自己會呼吸。旋鈕轉顏色／花瓣數／大小／殘影／轉速；打擊墊 1–8 在外圈對應的位置炸出一圈；琴鍵噴火花、按著有光柱。

let rings = [], sparks = [], beams = {};
let spin = 0, kick = 0;

function setup() {
  createCanvas(windowWidth, windowHeight);
  colorMode(HSB, 360, 100, 100, 100);
}

function draw() {
  const R = min(width, height);
  background(235, 40, 6, lerp(35, 4, knob4));             // knob4: 0 = crisp, 1 = long trails
  const base = 200 + knob1 * 360 + 40 * sin(frameCount * 0.004);   // (knob1 reads like mouseX: 0..1, no setup; the sin is a slow drift of its own)
  const petals = 6 + round(knob2 * 6);
  const r = R * (0.15 + knob3 * 0.12) * (1 + 0.05 * sin(frameCount * 0.02) + kick * 0.4);
  spin += 0.002 + knob5 * 0.03;
  kick *= 0.9;

  // no input at all? a quiet ghost ring every three seconds keeps it alive
  if (frameCount % 180 === 0) ring((frameCount / 180) % 8 + 1, 0.6);

  push();
  translate(width / 2, height / 2);
  for (let layer = 0; layer < 3; layer++) {
    for (let i = 0; i < petals; i++) {
      const c = (base + layer * 40 + i * 6) % 360;
      push();
      rotate((layer % 2 ? -spin : spin) + (i * TWO_PI) / petals);
      stroke(c, 60, 100, 70); fill(c, 70, 100, 10);
      const len = r * (0.6 + layer * 0.3);
      ellipse(len / 2, 0, len, r * 0.3);
      pop();
    }
  }
  pop();

  for (let n = 1; n <= 8; n++) {                           // the 8 pads sit on the outer circle
    const p = padPos(n), held = pad(n);                    // pad(n): velocity while held, 0 when let go
    stroke(n * 45, 70, 100, 40 + held * 60); fill(n * 45, 80, 100, held * 80);
    circle(p.x, p.y, R * 0.03 + held * R * 0.05);
    noStroke(); fill(0, 0, 100, 45); textAlign(CENTER, CENTER); textSize(10);
    text(n, p.x, p.y + R * 0.045);
  }

  for (const g of rings) {                                 // rings from the pads
    g.r += R * 0.006; g.a -= 0.009;
    noFill(); stroke(g.hue, 70, 100, g.a * g.v * 100); strokeWeight(2);
    circle(g.x, g.y, g.r * 2);
  }
  rings = rings.filter((g) => g.a > 0);
  strokeWeight(1);

  for (const k in beams) {                                 // keys: a beam while held, fades after release
    const b = beams[k];
    b.a = b.down ? 1 : b.a * 0.9;
    stroke(b.hue, 60, 100, b.a * 55); strokeWeight(3 + b.v * 6);
    line(b.x, height - 24, b.x, height * (0.8 - b.v * 0.45));
    if (b.a < 0.03) delete beams[k];
  }
  strokeWeight(1);

  for (const s of sparks) {                                // sparks from the keys
    s.vy += 0.15; s.x += s.vx; s.y += s.vy; s.life -= 1.5;
    noStroke(); fill(s.hue, 60, 100, s.life); circle(s.x, s.y, s.size);
  }
  sparks = sparks.filter((s) => s.life > 0);

  noStroke();                                              // the keyboard strip: lit while noteIsDown()
  for (let n = 36; n <= 84; n++) {
    fill(keyHue(n), 60, 100, noteIsDown(n) ? 100 : 18);
    rect(keyX(n) - 2, height - 16, 4, noteIsDown(n) ? 12 : 5);
  }

  hud(base);
}

// pads call padPressed(n, velocity), keys call notePressed(note, velocity): same idea as keyPressed()
function padPressed(n, velocity) { ring(n, velocity); kick = max(kick, velocity); }

function notePressed(n, velocity) {
  beams[n] = { x: keyX(n), v: velocity, hue: keyHue(n), a: 1, down: true };
  for (let i = 0; i < 8 + floor(velocity * 30); i++) {
    sparks.push({ x: keyX(n), y: height - 24, vx: random(-1.6, 1.6), vy: -random(3, 8) * (0.5 + velocity),
      size: random(3, 9), life: 100, hue: keyHue(n) + random(-20, 20) });
  }
}

function noteReleased(n) { if (beams[n]) beams[n].down = false; }

function ring(n, v) { const p = padPos(n); rings.push({ x: p.x, y: p.y, r: 8, a: 1, v, hue: n * 45 }); }
function padPos(n) {
  const a = -HALF_PI + ((n - 1) * TWO_PI) / 8, d = min(width, height) * 0.38;
  return { x: width / 2 + cos(a) * d, y: height / 2 + sin(a) * d };
}
function keyX(n) { return map(n, 36, 84, 24, width - 96, true); }   // leaves room for the 🎹 button
function keyHue(n) { return (n % 12) * 30; }

function hud(base) {                                       // what each knob is doing, at a glance
  const rows = ['colour', 'petals', 'size', 'trails', 'spin'];
  textAlign(LEFT, CENTER); textSize(12); noStroke();
  rows.forEach((name, i) => {
    const y = height - 36 - (rows.length - i) * 17, v = knob(i + 1);
    fill(0, 0, 100, 55); text('knob' + (i + 1) + ' ' + name, 20, y);
    fill(0, 0, 100, 18); rect(122, y - 3, 70, 6, 3);
    fill(base % 360, 60, 100, 90); rect(122, y - 3, 70 * v, 6, 3);
  });
  fill(0, 0, 100, 55);
  text(note ? 'last key ' + note + '  velocity ' + nf(velocity, 1, 2) : 'press a key', 20, height - 36);
}

function windowResized() { resizeCanvas(windowWidth, windowHeight); }
