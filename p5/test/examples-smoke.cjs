#!/usr/bin/env node
// examples-smoke.cjs — every example page that runs a p5 sketch (examples/NN-p5-*), in a real (headless) Chromium.
// Not part of `npm test` (needs a browser and the p5 CDN): run it before publishing, or let CI run it where a browser exists.
//
//   PW=<path to playwright(-core)> node p5/test/examples-smoke.cjs
//   ONLY=24-p5-note-names,25-p5-chop   only these pages
//   P5_VERSIONS=1.11.11,2.3.4          the p5 builds to run each page with (default: the page's own)
//   VIEWPORTS=1440x900,390x844         default both
//   SHOTS=<dir>                        a screenshot per page × viewport (default: a temp dir, printed at the end)
//
// The page is the real one from this checkout; `https://openaudiovisual.com/…` (the one line every sketch starts with,
// and the packages oav-p5 loads next to itself) is answered from this checkout too, so what runs is the commit, not the
// live site. No MIDI permission is given and no hardware exists; the microphone is Chromium's fake device.
//
// Per page × viewport it checks:
//   · no page error, no console error (the refused ws://…:7457 monitor and analytics are expected), no oav-p5 error card
//   · the sketch runs (frameCount moves) and draws something
//   · it survives being played: notes, a knob, a pad (midi.input), and nothing in the console says otherwise
//   · nothing the sketch writes on its canvas is hidden under the 🎹 panel or the drum card (it records every text() call,
//     the lines a student is told to read): example 24 shipped its note labels at 59% of the window height under a panel
//     that covers the bottom half, and every line it drew to explain itself sat behind it
//
// Exit code 1 when any row fails (the rows say which).
const fs = require('fs'), path = require('path'), http = require('http'), os = require('os');
const PW = require(process.env.PW || 'playwright');
const ROOT = path.resolve(__dirname, '../..');
const OAV = process.env.OAV_ROOT || ROOT;
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.html': 'text/html', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.txt': 'text/plain', '.ico': 'image/x-icon', '.mp3': 'audio/mpeg', '.wasm': 'application/wasm' };
const VIEWPORTS = (process.env.VIEWPORTS || '1440x900,390x844').split(',').map((s) => s.split('x').map(Number));
const P5_VERSIONS = process.env.P5_VERSIONS ? process.env.P5_VERSIONS.split(',') : [null];
const SHOTS = process.env.SHOTS || fs.mkdtempSync(path.join(os.tmpdir(), 'oav-shots-'));
const KNOWN_NOISE = [/ws:\/\/[^ ]*:7457/, /WebSocket connection to 'ws:\/\/[^']*7457/, /googletagmanager|google-analytics|cloudflareinsights/, /net::ERR_(BLOCKED|FAILED|INTERNET)/, /Failed to load resource/];

function pagesToTest() {
  const cat = JSON.parse(fs.readFileSync(path.join(OAV, 'examples/catalog.json'), 'utf8'));
  const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
  return cat.examples.filter((e) => e.sketch && (!only || only.includes(e.id))).map((e) => ({ id: e.id, dir: e.dir }));
}

(async () => {
  const srv = http.createServer((q, r) => {
    const u = new URL(q.url, 'http://x');
    let p = decodeURIComponent(u.pathname);
    if (p.endsWith('/')) p += 'index.html';
    const f = path.join(OAV, p);
    if (!f.startsWith(OAV) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
    r.setHeader('Content-Type', MIME[path.extname(f)] || 'application/octet-stream'); r.setHeader('Access-Control-Allow-Origin', '*');
    r.end(fs.readFileSync(f));
  });
  await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
  const base = `http://127.0.0.1:${srv.address().port}`;
  const browser = await PW.chromium.launch({ headless: true, args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'] });
  let bad = 0, rows = 0;
  const say = (ok, name, why) => { rows++; if (!ok) bad++; console.log(`${ok ? '✅' : '❌'} ${name}${!ok && why ? '\n     ' + why.split('\n').join('\n     ') : ''}`); };

  for (const ex of pagesToTest()) {
    for (const v of P5_VERSIONS) for (const [w, h] of VIEWPORTS) {
      const label = `${ex.id} · p5 ${v || 'as the page loads it'} · ${w}×${h}`;
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, permissions: ['microphone'] });
      const page = await ctx.newPage();
      const problems = [];
      page.on('pageerror', (e) => problems.push('page error: ' + (e.stack || e.message).split('\n').slice(0, 3).join(' ⏎ ')));
      page.on('console', (m) => { if (m.type() === 'error' && !KNOWN_NOISE.some((re) => re.test(m.text()))) problems.push('console.error: ' + m.text().slice(0, 300)); });
      // what the page asks of openaudiovisual.com is answered from this checkout
      await page.route('https://openaudiovisual.com/**', async (route) => {
        const u = new URL(route.request().url());
        let p = decodeURIComponent(u.pathname); if (p.endsWith('/')) p += 'index.html';
        const f = path.join(OAV, p);
        if (f.startsWith(OAV) && fs.existsSync(f) && fs.statSync(f).isFile()) return route.fulfill({ status: 200, contentType: MIME[path.extname(f)] || 'application/octet-stream', headers: { 'Access-Control-Allow-Origin': '*' }, body: fs.readFileSync(f) });
        return route.fulfill({ status: 404, body: '' });
      });
      await page.route(/googletagmanager|cloudflareinsights/, (route) => route.abort());
      if (v) {
        await page.route(/cdn\.jsdelivr\.net\/npm\/p5@[^/]+\/lib\/p5\.min\.js/, async (route) => route.fulfill({ response: await route.fetch({ url: `https://cdn.jsdelivr.net/npm/p5@${v}/lib/p5.min.js` }) }));
      }
      try {
        await page.goto(`${base}/${ex.dir}`, { waitUntil: 'load', timeout: 30000 });
        await page.waitForFunction(() => typeof window.frameCount === 'number' && window.frameCount > 12 && typeof window.OAVp5 === 'object', null, { timeout: 25000 });
        // listen to every line the sketch writes on its canvas
        await page.evaluate(() => {
          window.__texts = [];
          for (const name of ['text']) { const o = window[name]; if (typeof o === 'function') window[name] = function (s, x, y) { window.__texts.push({ s: String(s), x, y }); return o.apply(this, arguments); }; }
        });
        // play it: keys (a chord and a single note), a knob, a pad; then let it draw
        await page.evaluate(() => {
          const m = window.midi;
          [60, 64, 67].forEach((n) => m.input([0x90, n, 110], 'screen'));
          m.input([0xB0, 74, 90], 'screen'); m.input([0xB0, 71, 30], 'screen');
          m.input([0x99, 36, 100], 'screen');
        });
        await page.waitForTimeout(1500);
        await page.evaluate(() => { const m = window.midi; [60, 64, 67].forEach((n) => m.input([0x80, n, 0], 'screen')); m.input([0x89, 36, 0], 'screen'); m.input([0x90, 72, 80], 'screen'); });
        await page.waitForTimeout(1200);
        const r = await page.evaluate(() => {
          const out = { frames: window.frameCount, version: window.OAVp5 && window.OAVp5.version, p5: window.p5 && window.p5.VERSION };
          const canvas = document.querySelector('canvas');
          out.canvas = !!canvas;
          if (canvas) {
            const cr = canvas.getBoundingClientRect(); out.canvasRect = [cr.left, cr.top, cr.width, cr.height];
            let ctx2d = null; try { ctx2d = canvas.getContext('2d'); } catch (e) { /* */ }
            if (ctx2d) {
              const seen = new Set(); const W = canvas.width, H = canvas.height;
              for (let i = 0; i < 400; i++) { const d = ctx2d.getImageData(Math.floor((i * 37 % 20) / 20 * W), Math.floor(Math.floor(i / 20) / 20 * H), 1, 1).data; seen.add(d.join(',')); }
              out.colors = seen.size;
            } else out.colors = -1;   // WEBGL: not read back
          }
          const covers = [];
          for (const id of ['oav-p5-panel', 'oav-p5-drums']) {
            const el = document.getElementById(id);
            if (!el) continue; const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden') continue;
            const b = el.getBoundingClientRect(); if (b.width > 0 && b.height > 0) covers.push({ id, left: b.left, top: b.top, right: b.right, bottom: b.bottom });
          }
          out.covers = covers;
          out.texts = (window.__texts || []).filter((t) => t.y != null);
          out.cards = (window.OAVp5.hints || []).filter((x) => x.kind === 'error').map((x) => x.id + ': ' + x.what);
          return out;
        });
        if (!r.canvas) problems.push('no <canvas> on the page');
        if (r.frames < 20) problems.push(`the sketch is not drawing (frameCount ${r.frames})`);
        if (r.colors !== -1 && r.colors < 2) problems.push(`the canvas is blank (${r.colors} colour(s) in 400 samples)`);
        r.cards.forEach((c) => problems.push('oav-p5 error card: ' + c));
        // text under a cover (the canvas is placed at r.canvasRect; WEBGL sketches write text(…) in centred coordinates, so only 2D is judged)
        if (r.colors !== -1 && r.canvasRect) {
          const [cx, cy] = r.canvasRect, hidden = new Map();
          for (const t of r.texts) for (const c of r.covers) {
            const px = cx + t.x, py = cy + t.y;
            if (py > c.top + 2 && py < c.bottom && px > c.left - 2 && px < c.right) hidden.set(t.s.slice(0, 40), `${c.id} covers it (the line's baseline is at y=${Math.round(py)}, the cover starts at y=${Math.round(c.top)})`);
          }
          for (const [s, why] of hidden) problems.push(`text hidden: "${s}": ${why}`);
        }
        await page.screenshot({ path: path.join(SHOTS, `${ex.id}-${v || 'page'}-${w}x${h}.png`) });
        say(problems.length === 0, `${label}  (oav-p5 ${r.version}, p5 ${r.p5}, ${r.frames} frames)`, problems.join('\n'));
      } catch (e) {
        say(false, label, [...problems, 'did not run: ' + e.message.split('\n')[0]].join('\n'));
      }
      await ctx.close();
    }
  }
  await browser.close(); srv.close();
  console.log(`\n${rows - bad}/${rows} rows green; screenshots in ${SHOTS}`);
  process.exit(bad ? 1 : 0);
})();
