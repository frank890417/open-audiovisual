#!/usr/bin/env node
// hydra-smoke.cjs — oav-p5.js inside Hydra (hydra-synth 1.4.0), the way a hydra.ojack.xyz user loads it:
//
//   await loadScript('https://openaudiovisual.com/p5/oav-p5.js')
//   osc(10, 0.1, () => knob1 * 2).out()
//
// Not part of `npm test` (needs a browser and hydra-synth): run it by hand.
//   HYDRA_JS=<hydra-synth.js 1.4.0, default: cdn.jsdelivr.net/npm/hydra-synth@1.4.0/dist/hydra-synth.js>
//   PW=<path to playwright(-core)> CHROME=<Chrome for Testing binary, optional> node p5/test/hydra-smoke.cjs
// Checks: knob1, note, velocity exist after loadScript and move with a played key and a turned knob; the 🎹 is on the
// page; Hydra renders non-black pixels driven by knob1; the microphone is not touched until a `micLevel` is read, and
// then (fake microphone) it answers; no page error. No MIDI permission is given and no MIDI port is opened.
const fs = require('fs'), path = require('path'), http = require('http');
const PW = require(process.env.PW || 'playwright');
const ROOT = path.resolve(__dirname, '../..');
const HYDRA = process.env.HYDRA_JS && fs.existsSync(process.env.HYDRA_JS) ? process.env.HYDRA_JS : null;
const HYDRA_URL = 'https://cdn.jsdelivr.net/npm/hydra-synth@1.4.0/dist/hydra-synth.js';
const MIME = { '.js': 'text/javascript', '.json': 'application/json', '.html': 'text/html', '.css': 'text/css' };

let bad = 0;
const row = (ok, name, extra) => { if (!ok) bad++; console.log(`${ok ? '✅' : '❌'} ${name}${!ok && extra ? '  ' + extra : ''}`); };

(async () => {
  const srv = http.createServer((q, r) => {
    const u = new URL(q.url, 'http://x');
    const send = (type, body) => { r.setHeader('Content-Type', type); r.setHeader('Access-Control-Allow-Origin', '*'); r.end(body); };
    if (u.pathname === '/') {
      return send('text/html', `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#000"><canvas id="c" width="320" height="240"></canvas>
<script>window.OAV_P5 = { hardware: 'off', relay: 'ws://127.0.0.1:1/relay' }; window.__gum = 0;
{ const g = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices); navigator.mediaDevices.getUserMedia = (...a) => { window.__gum++; return g(...a); }; }</script>
<script src="${HYDRA ? '/hydra.js' : HYDRA_URL}"></script>
<script>
window.errs = [];
window.addEventListener('error', (e) => errs.push(String(e.message)));
window.hydra = new Hydra({ canvas: document.getElementById('c'), detectAudio: false, makeGlobal: true });
(async () => {
  await loadScript('/oav/p5/oav-p5.js');
  window.loaded = true;
  osc(10, 0.1, () => knob1 * 2).out();
})().catch((e) => errs.push('load: ' + e));
</script>`);
    }
    if (u.pathname === '/hydra.js') return send('text/javascript', fs.readFileSync(HYDRA));
    if (u.pathname.startsWith('/oav/')) {
      const f = path.join(ROOT, decodeURIComponent(u.pathname.slice(5)));
      if (!f.startsWith(ROOT) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); }
      return send(MIME[path.extname(f)] || 'application/octet-stream', fs.readFileSync(f));
    }
    r.writeHead(404); r.end();
  });
  await new Promise((ok) => srv.listen(+(process.env.PORT || 0), '127.0.0.1', ok));
  const base = `http://127.0.0.1:${srv.address().port}/`;
  const exe = process.env.CHROME;
  const b = await PW.chromium.launch({ executablePath: exe && fs.existsSync(exe) ? exe : undefined, headless: true,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
  const ctx = await b.newContext();   // no midi permission
  await ctx.routeWebSocket(/:7457/, (ws) => ws.close());
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|favicon/.test(m.text())) errs.push('console: ' + m.text()); });
  await p.goto(base);
  await p.waitForFunction(() => window.loaded === true, null, { timeout: 30000 }).catch(() => {});
  const before = await p.evaluate(() => ({ knob1: typeof knob1, note: typeof note, velocity: typeof velocity, btn: !!document.getElementById('oav-p5-button'), ver: window.OAVp5 && OAVp5.version,
    gum: window.__gum, mic: OAVp5.mic && OAVp5.mic.state }));
  row(before.knob1 === 'number' && before.note === 'number' && before.velocity === 'number', 'Hydra: knob1, note, velocity exist after loadScript', JSON.stringify(before));
  row(before.btn, 'Hydra: the 🎹 is on the page', JSON.stringify(before));
  row(before.gum === 0 && before.mic === 'off', 'Hydra: the microphone is untouched until something reads it', JSON.stringify(before));
  await p.evaluate(() => { window.__heard = []; midi.on('notePressed', (n, v) => window.__heard.push([n, v])); OAVp5.play(64, 0.9); OAVp5.input([0xB0, 74, 127]); });
  await p.waitForTimeout(500);
  const shot = (await p.locator('#c').screenshot()).toString('base64');   // the compositor's picture of the canvas (a WebGL canvas reads back blank otherwise)
  const after = await p.evaluate(async (png) => {
    const bmp = await createImageBitmap(await (await fetch('data:image/png;base64,' + png)).blob());
    const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height; const x = c.getContext('2d'); x.drawImage(bmp, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data; let lit = 0; for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] > 30) lit++;
    return { note: note, velocity: velocity, knob1: knob1, lit };
  }, shot);
  row(after.note === 64 && Math.abs(after.velocity - 0.9) < 0.01 && after.knob1 === 1, 'Hydra: a played key and a turned knob reach note / velocity / knob1', JSON.stringify(after));
  row(await p.evaluate(() => window.__heard.length === 1 && window.__heard[0][0] === 64), 'Hydra: midi.on(\'notePressed\', fn) hears the key', JSON.stringify(await p.evaluate(() => window.__heard)));
  row(after.lit > 100, 'Hydra: osc(10, 0.1, () => knob1 * 2) renders (non-black pixels)', JSON.stringify(after));
  // one more line: the microphone, read inside an arrow function the way Hydra reads everything
  await p.evaluate(() => { osc(10, 0.1, () => 1 + micLevel * 3).out(); });
  await p.waitForFunction(() => OAVp5.mic.state === 'on', null, { timeout: 8000 }).catch(() => {});
  const mic = await p.evaluate(() => new Promise((ok) => { let max = 0, maxBass = 0; const t0 = performance.now();   // the fake device beeps about once a second: look for a while
    (function look() { max = Math.max(max, micLevel); maxBass = Math.max(maxBass, bass);
      if (performance.now() - t0 < 3000) requestAnimationFrame(look); else ok({ state: OAVp5.mic.state, lvl: max, bass: maxBass, gum: window.__gum }); })(); }));
  row(mic.state === 'on' && mic.lvl > 0 && mic.gum === 1, 'Hydra: reading micLevel in an arrow function turns the microphone on and it answers', JSON.stringify(mic));
  row(errs.length === 0 && (await p.evaluate(() => window.errs)).length === 0, 'Hydra: no page errors', errs.join(' | ').slice(0, 300));
  await b.close(); srv.close();
  console.log(bad ? `\n${bad} check(s) failed` : '\nall checks passed');
  process.exit(bad ? 1 : 0);
})();
