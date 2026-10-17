#!/usr/bin/env node
// hints-smoke.cjs — oav-p5.js's hints on the page (the cards beside the 🎹), the knob shared with OPC, and the 🩺 check-up,
// in a real (headless) Chromium, p5 1.x and 2.x, in a Chinese browser. Not part of `npm test`: run it by hand before a tag.
//
//   P5_DIR=<dir with p5-1.11.11.min.js, p5-2.0.5.min.js, p5-2.3.4full.min.js> PW=<playwright(-core)> [CHROME=…] [SHOTS=<dir>] node p5/test/hints-smoke.cjs
//
// Per p5 version it checks: a sketch that uses nothing shows no card (clicks, keys, a load); a refused microphone shows
// "麥克風被擋下了" with the lock to click, in the 🎹's corner and clear of the canvas centre; a notePressed() that throws shows
// "你的 notePressed() 出錯了" with the file and line, once, and the sketch keeps drawing and hearing notes; hints=off shows no card
// (the console still says it); "click to hear" comes before the first click and goes after it; a sketch that reads knob1 under an
// OPC slider gets the "旋鈕1交給你的草圖了" card and the panel's wiring line; 🩺 in the 🎹 panel opens the check-up. No page errors.
const fs = require('fs'), path = require('path'), http = require('http');
const PW = require(process.env.PW || 'playwright');
const ROOT = path.resolve(__dirname, '../..');
const OAV = process.env.OAV_ROOT || ROOT;
const P5_DIR = process.env.P5_DIR || path.join(ROOT, 'p5/test/vendor');
const SHOTS = process.env.SHOTS || __dirname;
const VERSIONS = (process.env.P5_VERSIONS || '1.11.11,2.0.5,2.3.4full').split(',');
const OPC_URL = 'https://cdn.jsdelivr.net/gh/msawired/OPC@v0.7.1/opc.min.js';
const MIME = { '.js': 'text/javascript', '.json': 'application/json', '.html': 'text/html', '.css': 'text/css', '.mp3': 'audio/mpeg' };
const LINE = "document.head.prepend(Object.assign(document.createElement('script'), { src: '/oav/p5/oav-p5.js' }));\n";
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8').replace('https://openaudiovisual.com/p5/oav-p5.js', '/oav/p5/oav-p5.js');
const SKETCHES = {
  bare: () => LINE + 'function setup(){createCanvas(windowWidth,windowHeight);}\nfunction draw(){background(20);circle(frameCount%width,height/2,40);}',
  mic: () => read('p5/examples/mic/sketch.js'),
  // a student's bug on line 6 of their file: reading a property of something that is not there
  throws: () => LINE + 'let dots = [];\nfunction setup(){createCanvas(windowWidth,windowHeight);}\nfunction draw(){background(20);for(const d of dots)circle(d.x,d.y,20);}\nfunction notePressed(note, velocity) {\n  dots.push({ x: dots[dots.length].x + 10, y: 100 });\n}\n',
  keys: () => read('p5/examples/keys/sketch.js'),
  // the course template's OPC sliders, and a demo that reads knob1 as gravity
  opc: () => read('p5/examples/opc/sketch.js') + '\n;window.__gravity = () => 0.1 + knob1;\n;(() => { const d = draw; draw = function () { d(); window.__g = window.__gravity(); }; })();\n',
};

// a Tone.js stand-in (every class, method and property exists), as in kit-smoke.cjs
const STUB_TONE = `function fake(path) {
  return new Proxy(function () {}, {
    get(t, k) {
      if (k === 'then' || typeof k === 'symbol') return k === Symbol.toPrimitive ? () => 0 : undefined;
      if (k === 'fromUrl') return () => Promise.resolve({ get: () => ({ duration: 1 }) });
      if (k === 'start' && path === 'Tone') return () => Promise.resolve();
      if (k === 'state') return 'running';
      return fake(path + '.' + k);
    },
    apply() { return fake(path + '()'); }, construct() { return fake(path + '#'); }, set() { return true; },
  });
}
export default fake('Tone');`;

let bad = 0;
const row = (ok, name, extra) => { if (!ok) bad++; console.log(`${ok ? '✅' : '❌'} ${name}${extra ? '  ' + extra : ''}`); };

(async () => {
  const srv = http.createServer((q, r) => {
    const u = new URL(q.url, 'http://x');
    const send = (type, body) => { r.setHeader('Content-Type', type); r.setHeader('Access-Control-Allow-Origin', '*'); r.end(body); };
    const q1 = (k) => u.searchParams.get(k);
    if (u.pathname === '/page') {
      const kind = q1('kind');
      return send('text/html', `<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#111}</style>
<script>window.OAV_P5 = Object.assign({ relay: 'ws://127.0.0.1:1/relay' }, ${q1('opts') || '{}'});</script>
<script src="/p5/p5-${q1('v')}.min.js"></script>${kind === 'opc' ? `<script src="${OPC_URL}"></script>` : ''}<script src="/sketch.js?kind=${kind}"></script>`);
    }
    if (u.pathname === '/sketch.js') return send('text/javascript', SKETCHES[q1('kind')]());
    if (u.pathname === '/stub-tone.js') return send('text/javascript', STUB_TONE);
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
  // no fake-ui flag: a microphone request is refused, as when a student presses Block
  const b = await PW.chromium.launch({ executablePath: exe && fs.existsSync(exe) ? exe : undefined, headless: true, args: ['--use-fake-device-for-media-stream'] });
  fs.mkdirSync(SHOTS, { recursive: true });
  // Chrome 151 (headless) answers an un-allowed getUserMedia with NotSupportedError, not the NotAllowedError a person who clicks "Block" gets: say what "Block" looks like.
  const REFUSE_MIC = () => { const md = navigator.mediaDevices; if (md) md.getUserMedia = () => Promise.reject(new DOMException('Permission denied', 'NotAllowedError')); };
  const open = async (v, kind, opts = {}) => {
    const ctx = await b.newContext({ viewport: { width: 1000, height: 700 }, locale: 'zh-TW' });
    if (kind === 'mic') await ctx.addInitScript(REFUSE_MIC);   // this page's microphone is refused (see the check below)
    await ctx.routeWebSocket(/:7457|127\.0\.0\.1:1\//, (ws) => ws.close());
    const p = await ctx.newPage(); const errs = [], logs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    p.on('console', (m) => { const t = m.text(); logs.push(t);
      if (m.type() === 'error' && !/Failed to load resource|favicon|出錯了|error inside/.test(t)) errs.push('console: ' + t);   // the sketch's own error is the point of one check
      if (/redeclared|🌸 p5\.js says/.test(t)) errs.push('p5 FES: ' + t.slice(0, 160)); });
    await p.goto(`${base}/page?v=${v}&kind=${kind}&opts=${encodeURIComponent(JSON.stringify(opts))}`);
    return { ctx, p, errs, logs };
  };
  const cards = (p) => p.evaluate(() => [...document.querySelectorAll('#oav-p5-hints .oav-p5-hint')].map((c) => {
    const r = c.getBoundingClientRect(); return { id: c.dataset.hint, text: c.innerText, left: r.left, top: r.top, right: r.right, bottom: r.bottom };
  }));

  for (const v of VERSIONS) {
    // 1. a sketch that uses nothing: no card, ever
    {
      const { ctx, p, errs } = await open(v, 'bare');
      await p.waitForTimeout(1500);
      await p.mouse.click(500, 350); await p.keyboard.press('a'); await p.waitForTimeout(600);
      const c = await cards(p); const listed = await p.evaluate(() => OAVp5.hints.length);
      row(c.length === 0 && listed === 0, `p5 ${v}: a sketch that uses nothing shows no hint card`, JSON.stringify({ cards: c.map((x) => x.id), listed }));
      row(errs.length === 0, `p5 ${v}: …no page errors`, errs.join(' | ').slice(0, 300));
      await ctx.close();
    }
    // 2. the microphone refused
    {
      const { ctx, p, errs } = await open(v, 'mic', { hardware: 'off' });
      await p.waitForFunction(() => OAVp5.mic.state === 'denied', null, { timeout: 8000 }).catch(() => {});
      await p.waitForTimeout(400);
      const c = await cards(p); const btn = await p.evaluate(() => { const r = document.getElementById('oav-p5-button').getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom }; });
      const card = c.find((x) => x.id === 'micDenied');
      const centre = card && card.left < 500 && card.right > 500 && card.top < 350 && card.bottom > 350;
      row(!!card && /麥克風被擋下了/.test(card.text) && /鎖頭/.test(card.text) && /允許/.test(card.text), `p5 ${v}: a refused microphone: the card says what, why and where to click (in Chinese)`, card && card.text.replace(/\n/g, ' / '));
      row(!!card && !centre && Math.abs(card.right - btn.right) < 2 && card.bottom <= btn.top, `p5 ${v}: …above the 🎹 in its corner, clear of the canvas centre`, JSON.stringify({ card, btn }));
      if (v === VERSIONS[0]) await p.screenshot({ path: path.join(SHOTS, 'hints-mic-denied.png') });
      await p.click('#oav-p5-hints .oav-p5-hint button');
      const gone = (await cards(p)).length;
      row(gone === 0, `p5 ${v}: …× closes it`);
      await p.mouse.click(500, 350); await p.waitForTimeout(800);   // the retry on a click: refused again, and not said twice
      row((await cards(p)).length === 0, `p5 ${v}: …and the same hint does not come back`);
      row(errs.length === 0, `p5 ${v}: …no page errors`, errs.join(' | ').slice(0, 300));
      await ctx.close();
    }
    // 3. the sketch's notePressed() throws; then the same with hints=off
    for (const off of [false, true]) {
      const { ctx, p, errs, logs } = await open(v, 'throws', off ? { hints: 'off', hardware: 'off' } : { hardware: 'off' });
      await p.waitForTimeout(1200);
      const f0 = await p.evaluate(() => frameCount);
      await p.evaluate(() => { midi.play(60, 0.8); midi.play(62, 0.8); midi.play(64, 0.8); });
      await p.waitForTimeout(800);
      const s = await p.evaluate(() => ({ fc: frameCount, note: midi.last.note, listed: OAVp5.hints.map((h) => h.id) }));
      const c = await cards(p);
      if (!off) {
        const card = c.find((x) => /^err:notePressed/.test(x.id));
        row(!!card && /你的 notePressed\(\) 出錯了/.test(card.text) && /sketch\.js 第 6 行/.test(card.text) && c.length === 1,
          `p5 ${v}: notePressed() throws: one card with the message, the file and the line`, card && card.text.replace(/\n/g, ' / '));
        row(s.fc > f0 + 20 && s.note === 64, `p5 ${v}: …and the sketch keeps drawing and hearing notes`, JSON.stringify({ f0, ...s }));
        if (v === VERSIONS[0]) await p.screenshot({ path: path.join(SHOTS, 'hints-callback-error.png') });
      } else {
        row(c.length === 0 && s.listed.some((x) => /^err:notePressed/.test(x)) && logs.some((t) => /你的 notePressed\(\) 出錯了/.test(t)),
          `p5 ${v}: hints=off: no card on the page, the console still says it (in Chinese)`, JSON.stringify({ cards: c.length, listed: s.listed }));
      }
      row(errs.length === 0, `p5 ${v}: …no page errors besides the sketch's own`, errs.join(' | ').slice(0, 300));
      await ctx.close();
    }
    // 4. sound: "click to hear" before the first click, gone after it
    {
      const { ctx, p, errs } = await open(v, 'keys', { tone: '/stub-tone.js', hardware: 'off' });
      await p.waitForTimeout(3500);                                   // no polling: Playwright's evaluate counts as a user gesture
      const before = (await cards(p)).find((x) => x.id === 'sndClick');
      await p.mouse.click(500, 150);
      await p.waitForFunction(() => soundIsOn === true, null, { timeout: 8000 }).catch(() => {});
      const after = (await cards(p)).find((x) => x.id === 'sndClick');
      row(!!before && /點一下畫面/.test(before.text) && !after, `p5 ${v}: startSound(): "點一下畫面" before the first click, gone after it`, before && before.text.replace(/\n/g, ' / '));
      row(errs.length === 0, `p5 ${v}: …no page errors`, errs.join(' | ').slice(0, 300));
      await ctx.close();
    }
    // 5. one knob, two jobs: the sketch reads knob1 under OPC's first slider
    {
      const { ctx, p, errs } = await open(v, 'opc', { hardware: 'off' });
      await p.waitForTimeout(1500);
      await p.evaluate(() => { midi.input([0xB0, 74, 127]); });
      await p.waitForTimeout(150);                                    // a frame or two: draw() reads knob1 again
      const s = await p.evaluate(() => ({ radius, g: window.__g, wiring: midi.wiring() }));
      const card = (await cards(p)).find((x) => x.id === 'both:knob1');
      row(!!card && /旋鈕1交給你的草圖了/.test(card.text) && /radius/.test(card.text), `p5 ${v}: a sketch that reads knob1 under OPC's radius: one card says knob 1 is the sketch's now`, card && card.text.replace(/\n/g, ' / '));
      row(s.radius === 60 && s.g === 1.1 && s.wiring[0].sketch === true, `p5 ${v}: …knob 1 moves the sketch's gravity, not radius`, JSON.stringify({ radius: s.radius, g: s.g, w0: s.wiring[0] }));
      await p.click('#oav-p5-button');
      await p.waitForSelector('#oav-p5-check-button', { timeout: 5000 }).catch(() => {});
      await p.waitForTimeout(600);
      const legend = await p.evaluate(() => document.querySelector('#oav-p5-panel div div').textContent);
      row(/接線：旋鈕1 → knob1（草圖；radius 改用滑桿） · 旋鈕2 → speed（OPC）/.test(legend), `p5 ${v}: …the panel's wiring line says who has which knob`, legend);
      // 6. 🩺
      await p.click('#oav-p5-check-button'); await p.waitForTimeout(300);
      const chk = await p.evaluate(() => { const c = document.getElementById('oav-p5-check'); return c && getComputedStyle(c).display !== 'none' ? c.innerText : null; });
      row(!!chk && /oav-p5 體檢/.test(chk) && /麥克風：/.test(chk) && /MIDI：/.test(chk) && /聲音：/.test(chk) && /接線：旋鈕1/.test(chk) && /check/.test(await p.evaluate(() => document.querySelector('#oav-p5-check a').href)),
        `p5 ${v}: 🩺 in the panel opens the check-up: microphone, MIDI, sound, wiring, and a link to /check/`, chk && chk.split('\n').slice(0, 4).join(' / '));
      if (v === VERSIONS[0]) await p.screenshot({ path: path.join(SHOTS, 'hints-check.png') });
      row(errs.length === 0, `p5 ${v}: …no page errors`, errs.join(' | ').slice(0, 300));
      await ctx.close();
    }
  }
  await b.close(); srv.close();
  console.log(bad ? `\n${bad} check(s) failed` : '\nall checks passed');
  process.exit(bad ? 1 : 0);
})();
