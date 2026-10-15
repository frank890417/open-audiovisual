#!/usr/bin/env node
// chop-smoke.cjs — oav-p5.js's lag() family (0.7) in a real (headless) Chromium, p5 1.x and 2.x.
// Not part of `npm test` (needs a browser): run it by hand before publishing a tag.
//
//   P5_DIR=<dir with p5-1.11.11.min.js, p5-2.3.4full.min.js (p5-2.0.5.min.js), p5sound-1.11.11.min.js, p5sound-0.4.1.min.js>
//   PW=<path to playwright(-core)> [CHROME=<binary>] [SHOTS=<dir>] [P5_VERSIONS=1.11.11,2.3.4full] node p5/test/chop-smoke.cjs
//
// The microphone is Chromium's fake device playing a file this script writes: 0.8 s of a 440 Hz tone, then 2.2 s of silence,
// looped — a clean rise and a clean fall. Per p5 version it checks: none of the new names is a p5 / p5.sound name; an old
// sketch (examples/particles) loads no packages/chop and shows no scope; lag(micLevel, 0.03, 0.4) is exactly the one-pole lag
// of the micLevel it was given at the frames' own times (replayed here with packages/chop), rises in a few frames and falls
// 63% in about 0.4 s; lag() in setup() returns its input and the slots live in draw() only; env('kick') with startDrums()
// jumps to 1 on each kick of four on the floor and falls to 0 between them, without opening the microphone; a call inside an
// if switches to matching by line and keeps every other call's memory; scope() draws in the corner across from the 🎹 and a
// recorded frame (startRecording) has no scope in it but does have drawTrail()'s line; p5/examples/lag runs (screenshot).
const fs = require('fs'), path = require('path'), http = require('http'), os = require('os');
const PW = require(process.env.PW || 'playwright');
const ROOT = path.resolve(__dirname, '../..');
const OAV = process.env.OAV_ROOT || ROOT;   // OAV_ROOT=<another checkout>: the same checks against it (the red run on 0.6.0)
const P5_DIR = process.env.P5_DIR || path.join(ROOT, 'p5/test/vendor');
const SHOTS = process.env.SHOTS || __dirname;
const VERSIONS = (process.env.P5_VERSIONS || '1.11.11,2.3.4full').split(',');
const NAMES = ['lag', 'env', 'trigger', 'speed', 'spring', 'trail', 'slope', 'count', 'scope', 'drawTrail'];
const MIME = { '.js': 'text/javascript', '.json': 'application/json', '.html': 'text/html', '.css': 'text/css' };
const soundFor = (v) => (v.startsWith('1.') ? 'p5sound-1.11.11.min.js' : 'p5sound-0.4.1.min.js');
const LINE = "document.head.prepend(Object.assign(document.createElement('script'), { src: '/oav/p5/oav-p5.js' }));\n";
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
fs.mkdirSync(SHOTS, { recursive: true });

// the fake microphone: 0.8 s of 440 Hz at 0.3, 2.2 s of silence (16-bit mono 48 kHz), looped by Chromium
const WAV = path.join(os.tmpdir(), 'oav-chop-smoke-bursts.wav');
{
  const sr = 48000, n = sr * 3, b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVE', 8); b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22); b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) { const t = i / sr; let a = t < 0.8 ? 0.3 : 0; if (t < 0.005) a *= t / 0.005; if (t > 0.795 && t < 0.8) a *= (0.8 - t) / 0.005; b.writeInt16LE(Math.round(32767 * a * Math.sin(2 * Math.PI * 440 * t)), 44 + i * 2); }
  fs.writeFileSync(WAV, b);
}

const SKETCHES = {
  plain: () => read('p5/examples/particles/sketch.js').replace('https://openaudiovisual.com/p5/oav-p5.js', '/oav/p5/oav-p5.js'),
  example: () => read('p5/examples/lag/sketch.js').replace('https://openaudiovisual.com/p5/oav-p5.js', '/oav/p5/oav-p5.js'),
  lag: () => LINE + `window.__f = []; window.__setup = null;
function setup() { createCanvas(480, 320); window.__setup = { v: lag(0.42, 0.1), slots: (OAVp5.chop?.slots() || []).length }; }
function draw() {
  background(20);
  const raw = micLevel, v = lag(raw, 0.03, 0.4);
  window.__f.push([performance.now(), raw, v]);
  fill(255); circle(width / 2, height / 2, 20 + v * 200);
}`,
  kick: () => LINE + `window.__e = [];
function setup() { createCanvas(480, 320); startDrums('four on floor', 120); }
function draw() { background(20); const e = env('kick', 0.01, 0.3); window.__e.push([performance.now(), e]); fill(255); circle(width / 2, height / 2, 40 + e * 200); }`,
  order: () => LINE + `window.__o = null;
function setup() { createCanvas(320, 200); }
function draw() {
  background(20);
  const o = {};
  if (frameCount > 40) o.x = speed(100);
  o.a = speed(1);
  o.b = speed(2);
  window.__o = o;
}`,
  scope: () => LINE + `
function setup() { createCanvas(windowWidth, windowHeight); }
function draw() {
  background(0);
  const s = 0.5 + 0.5 * sin(frameCount * 0.1);
  scope(s, 'sine'); scope(lag(s, 0.2), 'lag');         // the scope: bottom-left, over the canvas
  strokeWeight(4); stroke(255, 0, 0);
  drawTrail(trail(s, 2), 0, 20, width, 100);          // the top band: red on black
}
function recordingSaved(info) { window.__rec = info; }`,
};

let bad = 0;
const row = (ok, name, extra) => { if (!ok) bad++; console.log(`${ok ? '✅' : '❌'} ${name}${extra ? '  ' + extra : ''}`); };

(async () => {
  const chop = await import(path.join(OAV, 'packages/chop/index.js')).catch(() => null);
  const srv = http.createServer((q, r) => {
    const u = new URL(q.url, 'http://x');
    const send = (type, body) => { r.setHeader('Content-Type', type); r.setHeader('Access-Control-Allow-Origin', '*'); r.end(body); };
    if (u.pathname === '/page') {
      const v = u.searchParams.get('v'), kind = u.searchParams.get('kind'), opts = u.searchParams.get('opts') || '{}';
      return send('text/html', `<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#111}</style>
<script>window.OAV_P5 = Object.assign({ hardware: 'off', relay: 'ws://127.0.0.1:1/relay' }, ${opts});
window.__gum = 0; { const g = navigator.mediaDevices && navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  if (g) navigator.mediaDevices.getUserMedia = (...a) => { window.__gum++; return g(...a); }; }</script>
<script src="/p5/p5-${v}.min.js"></script><script src="/sketch.js?kind=${kind}"></script>`);
    }
    if (u.pathname === '/bare') {
      const v = u.searchParams.get('v');
      return send('text/html', `<!doctype html><meta charset="utf-8"><script src="/p5/p5-${v}.min.js"></script><script src="/p5/${soundFor(v)}"></script>
<script>function setup(){createCanvas(100,100);}function draw(){}</script>`);
    }
    if (u.pathname === '/sketch.js') return send('text/javascript', SKETCHES[u.searchParams.get('kind')]());
    if (u.pathname.startsWith('/p5/')) { const f = path.join(P5_DIR, u.pathname.slice(4)); if (!fs.existsSync(f)) { r.writeHead(404); return r.end(); } return send('text/javascript', fs.readFileSync(f)); }
    if (u.pathname.startsWith('/oav/')) {
      const f = path.join(OAV, decodeURIComponent(u.pathname.slice(5)));
      if (!f.startsWith(OAV) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); }
      return send(MIME[path.extname(f)] || 'application/octet-stream', fs.readFileSync(f));
    }
    r.writeHead(404); r.end();
  });
  await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
  const base = `http://127.0.0.1:${srv.address().port}`;
  const exe = process.env.CHROME;
  const browser = await PW.chromium.launch({ executablePath: exe && fs.existsSync(exe) ? exe : undefined, headless: true,
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', `--use-file-for-fake-audio-capture=${WAV}`, '--autoplay-policy=no-user-gesture-required'] });
  const open = async (url, viewport = { width: 900, height: 600 }) => {
    const ctx = await browser.newContext({ viewport });
    await ctx.routeWebSocket(/:7457/, (ws) => ws.close());
    const p = await ctx.newPage(), errs = [], reqs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    p.on('console', (m) => { const t = m.text(); if (m.type() === 'error' && !/Failed to load resource|favicon/.test(t)) errs.push('console: ' + t); if (/🌸 p5\.js says/.test(t) && NAMES.some((n) => t.includes(n))) errs.push('p5 FES: ' + t.slice(0, 160)); });
    p.on('request', (q) => reqs.push(q.url()));
    await p.goto(base + url);
    return { ctx, p, errs, reqs };
  };

  for (const v of VERSIONS) {
    const tag = `p5 ${v}`;
    // 0. names
    {
      const { ctx, p } = await open(`/bare?v=${v}`); await p.waitForTimeout(800);
      const taken = await p.evaluate((n) => n.filter((k) => k in window || (typeof p5 !== 'undefined' && k in p5.prototype)), NAMES);
      row(taken.length === 0, `${tag}: none of ${NAMES.join(', ')} is a p5 / p5.sound name`, taken.length ? JSON.stringify(taken) : '');
      await ctx.close();
    }
    // 1. an old sketch: nothing new loads, nothing new shows
    {
      const { ctx, p, errs, reqs } = await open(`/page?v=${v}&kind=plain`); await p.waitForTimeout(1500);
      const s = await p.evaluate(() => ({ scope: !!document.getElementById('oav-p5-scope'), state: OAVp5.chop?.state, fc: frameCount, cards: document.querySelectorAll('.oav-p5-hint').length }));
      row(!reqs.some((u) => /packages\/chop/.test(u)) && !s.scope && s.state === 'off' && s.cards === 0 && s.fc > 10, `${tag}: an old sketch loads no packages/chop, shows no scope and no card`, JSON.stringify(s));
      row(errs.length === 0, `${tag}: …no page errors`, errs.join(' | ').slice(0, 300));
      await ctx.close();
    }
    // 2. lag(micLevel, 0.03, 0.4) on the fake microphone
    {
      const { ctx, p, errs } = await open(`/page?v=${v}&kind=lag`);
      await p.waitForFunction(() => window.micIsOn === true, null, { timeout: 8000 }).catch(() => {});
      await p.waitForTimeout(6500);
      const s = await p.evaluate(() => ({ f: window.__f, setup: window.__setup, slots: (OAVp5.chop?.slots() || []), cards: [...document.querySelectorAll('.oav-p5-hint')].map((c) => c.dataset.hint) }));
      row(s.setup && s.setup.v === 0.42 && s.setup.slots === 0 && s.cards.includes('chopOut:lag'), `${tag}: lag() in setup() returns its input, keeps nothing, says so`, JSON.stringify({ setup: s.setup, cards: s.cards }));
      row(s.slots.length === 1 && s.slots[0].mode === 'order', `${tag}: in draw() one lag slot, by order`, JSON.stringify(s.slots));
      // replay: the lag of the micLevel it was given, at the frames' own times (from the first frame chop was loaded in)
      const f = s.f, first = f.findIndex((x) => x[2] !== x[1] || x[1] === 0);
      let worst = 0, y = null;
      if (chop) for (let i = Math.max(1, first); i < f.length; i++) {
        if (y === null) { y = f[i][2]; continue; }
        y = chop.approach(y, f[i][1], f[i][1] > y ? 0.03 : 0.4, (f[i][0] - f[i - 1][0]) / 1000);
        worst = Math.max(worst, Math.abs(y - f[i][2]));
      }
      row(chop && f.length > 100 && worst < 0.02, `${tag}: lag() is the one-pole lag of what it was given, at real frame times (worst ${worst.toFixed(4)} over ${f.length} frames)`);
      // the shape: find a burst's end (raw drops below 0.05 from above 0.5) and a start
      let rise = null, fall = null;
      for (let i = 1; i < f.length - 1; i++) {
        if (rise === null && f[i - 1][1] < 0.05 && f[i][1] > 0.5) {
          const t0 = f[i][0]; const after = f.filter((x) => x[0] >= t0 && x[0] <= t0 + 100);
          rise = { raw: f[i][1], at100ms: Math.max(...after.map((x) => x[2])) };
        }
        // the microphone's own level takes ~0.1 s to reach 0 once the tone stops: count from the frame it is there
        if (fall === null && f[i][1] < 0.02 && f.some((x) => x[0] < f[i][0] && x[0] > f[i][0] - 300 && x[1] > 0.5)) {
          const t0 = f[i][0], top = f[i][2], at = f.find((x) => x[0] >= t0 + 400);
          fall = { top, at400: at && at[2], ratio: at && at[2] / top, dt: at && Math.round(at[0] - t0) };
        }
      }
      row(rise && rise.at100ms > 0.9 * rise.raw, `${tag}: the tone starts: lag is up within 0.1 s (0.03 s up)`, JSON.stringify(rise));
      row(fall && fall.ratio > 0.3 && fall.ratio < 0.45, `${tag}: the tone stops: 0.4 s later lag has fallen to ~37% of where it was (0.4 s down)`, JSON.stringify(fall));
      if (v === VERSIONS[0]) { await p.screenshot({ path: path.join(SHOTS, 'chop-lag-setup-card.png') }); }
      row(errs.length === 0, `${tag}: …no page errors`, errs.join(' | ').slice(0, 300));
      await ctx.close();
    }
    // 3. env('kick') with the drum machine: four on the floor at 120 bpm, a kick every 0.5 s
    {
      const { ctx, p, errs } = await open(`/page?v=${v}&kind=kick`);
      await p.waitForFunction(() => OAVp5.drums.state === 'on', null, { timeout: 8000 }).catch(() => {});
      await p.waitForTimeout(4200);
      const s = await p.evaluate(() => ({ e: window.__e.slice(-200), gum: window.__gum, mic: OAVp5.mic.state, kicks: OAVp5.chop ? count('kick') : null }));
      const e = s.e; let peaks = 0, zeros = 0, gaps = [], lastPeak = null;
      for (let i = 1; i < e.length - 1; i++) {
        if (e[i][1] > 0.85 && e[i][1] >= e[i - 1][1] && e[i][1] >= e[i + 1][1]) { if (lastPeak !== null) gaps.push(Math.round(e[i][0] - lastPeak)); lastPeak = e[i][0]; peaks++; }
        if (e[i][1] === 0) zeros++;
      }
      const span = e.length > 1 ? (e.at(-1)[0] - e[0][0]) / 1000 : 0;
      row(peaks >= Math.floor(span / 0.5) - 1 && gaps.every((g) => g > 400 && g < 600), `${tag}: env('kick') jumps to ~1 on every kick (${peaks} peaks in ${span.toFixed(1)} s, gaps ${gaps.join(' ')} ms)`);
      row(zeros > 10, `${tag}: …and falls to 0 between them (0.3 s decay; ${zeros} frames at 0)`);
      row(s.gum === 0 && s.mic === 'off', `${tag}: …and with the drums asked for, the microphone stays closed`, JSON.stringify({ gum: s.gum, mic: s.mic }));
      row(errs.length === 0, `${tag}: …no page errors`, errs.join(' | ').slice(0, 300));
      if (v === VERSIONS[0]) await p.screenshot({ path: path.join(SHOTS, 'chop-env-kick.png') });
      await ctx.close();
    }
    // 4. a call inside an if: the card, matching by line, the others keep their memory
    {
      const { ctx, p, errs } = await open(`/page?v=${v}&kind=order`);
      await p.waitForTimeout(3000);
      const s = await p.evaluate(() => ({ o: window.__o, fc: frameCount, slots: (OAVp5.chop?.slots() || []).map((x) => x.mode), card: (OAVp5.hints.find((h) => h.id === 'chopOrder:speed') || {}).what, t: performance.now() / 1000 }));
      const ratio = s.o && s.o.b / s.o.a;
      row(s.card && s.slots.every((m) => m === 'site') && Math.abs(ratio - 2) < 0.02 && s.o.x > 50, `${tag}: an if around one speed(): a card, then by line; a and b keep their own (b / a = ${ratio && ratio.toFixed(3)})`, JSON.stringify(s));
      row(errs.length === 0, `${tag}: …no page errors`, errs.join(' | ').slice(0, 300));
      await ctx.close();
    }
    // 5. scope() in its corner, out of the recording; drawTrail() in it
    {
      const { ctx, p, errs } = await open(`/page?v=${v}&kind=scope`, { width: 900, height: 600 });
      await p.waitForTimeout(1500);
      const box = await p.evaluate(() => { const e = document.getElementById('oav-p5-scope'); if (!e) return null; const r = e.getBoundingClientRect(); const c = document.querySelector('canvas.p5Canvas, canvas'); const cr = c.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, vw: innerWidth, vh: innerHeight, pe: getComputedStyle(e).pointerEvents, canvas: { x: cr.x, y: cr.y, w: cr.width, h: cr.height } }; });
      row(box && box.x <= 12 && box.y + box.h >= box.vh - 12 && box.pe === 'none' && box.w < 300, `${tag}: the scope sits bottom-left (across from the 🎹), takes no clicks`, JSON.stringify(box));
      if (v === VERSIONS[0]) await p.screenshot({ path: path.join(SHOTS, 'chop-scope-page.png') });
      await p.evaluate(() => startRecording(2));
      await p.waitForFunction(() => !!window.__rec, null, { timeout: 15000 }).catch(() => {});
      const frame = await p.evaluate(async (b) => {
        const info = window.__rec; if (!info) return null;
        const vid = document.createElement('video'); vid.muted = true; vid.src = info.url || URL.createObjectURL(info.blob);
        await new Promise((ok, no) => { vid.onloadeddata = ok; vid.onerror = () => no(new Error('video')); setTimeout(ok, 4000); });
        vid.currentTime = 1; await new Promise((ok) => { vid.onseeked = ok; setTimeout(ok, 3000); });
        const c = document.createElement('canvas'); c.width = vid.videoWidth; c.height = vid.videoHeight;
        const g = c.getContext('2d'); g.drawImage(vid, 0, 0);
        const sx = c.width / b.canvas.w, sy = c.height / b.canvas.h;
        // where the scope sits over the canvas (page px → video px), and the drawTrail band at the canvas bottom
        const rx = Math.max(0, Math.round((b.x - b.canvas.x) * sx)), ry = Math.max(0, Math.round((b.y - b.canvas.y) * sy));
        const rw = Math.min(c.width - rx, Math.round(b.w * sx)), rh = Math.min(c.height - ry, Math.round(b.h * sy));
        const stats = (x, y, w, h) => { const d = g.getImageData(x, y, Math.max(1, w), Math.max(1, h)).data; let lit = 0, red = 0; for (let i = 0; i < d.length; i += 4) { if (d[i] + d[i + 1] + d[i + 2] > 60) lit++; if (d[i] > 120 && d[i + 1] < 80 && d[i + 2] < 80) red++; } return { lit, red, px: d.length / 4 }; };
        const scopeArea = stats(rx, ry, rw, rh);
        const band = stats(0, Math.round(20 * sy), c.width, Math.round(100 * sy));
        return { format: info.format, wh: c.width + '×' + c.height, scopeArea, band, url: g.canvas.toDataURL('image/png') };
      }, box);
      if (frame && frame.url) fs.writeFileSync(path.join(SHOTS, `chop-recorded-frame-${v}.png`), Buffer.from(frame.url.split(',')[1], 'base64'));
      if (frame) delete frame.url;
      row(frame && frame.scopeArea.px > 1000 && frame.scopeArea.lit / frame.scopeArea.px < 0.01, `${tag}: a recorded frame has no scope where the scope is on the page`, JSON.stringify(frame && { format: frame.format, wh: frame.wh, scopeArea: frame.scopeArea }));
      row(frame && frame.band.red > 200, `${tag}: …and has drawTrail()'s red line`, JSON.stringify(frame && frame.band));
      row(errs.length === 0, `${tag}: …no page errors`, errs.join(' | ').slice(0, 300));
      await ctx.close();
    }
    // 6. p5/examples/lag with the fake microphone (screenshot); OpenProcessing's layout puts the scope top-right
    {
      const { ctx, p, errs } = await open(`/page?v=${v}&kind=example`, { width: 1000, height: 640 });
      await p.waitForFunction(() => window.micIsOn === true, null, { timeout: 8000 }).catch(() => {});
      await p.waitForTimeout(1500);
      // the picture worth taking: just after the tone stops, the raw level is down and the lagged one is still on its way
      await p.waitForFunction(() => micLevel > 0.5, null, { timeout: 5000, polling: 16 }).catch(() => {});
      await p.waitForFunction(() => micLevel < 0.05, null, { timeout: 5000, polling: 16 }).catch(() => {});
      await p.waitForTimeout(150);
      const s = await p.evaluate(() => ({ slots: (OAVp5.chop?.slots() || []).map((x) => x.kind + ':' + x.mode), scope: !!document.getElementById('oav-p5-scope') }));
      row(s.scope && s.slots.filter((k) => k === 'lag:order').length === 1 && s.slots.filter((k) => k === 'trail:order').length === 2, `${tag}: p5/examples/lag runs: one lag, two trails, two scope lines`, JSON.stringify(s));
      await p.screenshot({ path: path.join(SHOTS, `chop-example-lag-${v}.png`) });
      row(errs.length === 0, `${tag}: …no page errors`, errs.join(' | ').slice(0, 300));
      await ctx.close();
      if (v === VERSIONS[0]) {
        const o = await open(`/page?v=${v}&kind=example&opts=${encodeURIComponent(JSON.stringify({ dock: 'top', corner: 'left' }))}`, { width: 1000, height: 640 });
        await o.p.waitForTimeout(2600);
        const b = await o.p.evaluate(() => { const r = document.getElementById('oav-p5-scope').getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), right: Math.round(innerWidth - r.right) }; });
        row(b.right <= 12 && b.y <= 12, `${tag}: with the 🎹 top-left (OpenProcessing's layout) the scope goes top-right`, JSON.stringify(b));
        await o.p.screenshot({ path: path.join(SHOTS, 'chop-example-lag-top.png') });
        await o.ctx.close();
      }
    }
  }
  await browser.close(); srv.close();
  console.log(bad ? `\n${bad} check(s) failed` : '\nall checks passed');
  process.exit(bad ? 1 : 0);
})();
