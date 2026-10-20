#!/usr/bin/env node
// panel-place-smoke.cjs — where the 🎹 panel sits, in a real (headless) Chromium, p5 1.x and 2.x.
// Not part of `npm test` (needs a browser). Run it by hand before publishing:
//
//   P5_DIR=<dir with p5-1.11.11.min.js, p5-2.3.4.min.js> PW=<path to playwright(-core)> [SHOTS=<dir>] node p5/test/panel-place-smoke.cjs
//
// 2026-10-20 哲宇：「浮動面板可以預設在下方……但是可以切換嗎？因為它現在會遮擋畫面……可以浮動拖曳，然後又可以切換大小」.
// Checks: with no dock option the panel opens docked at the bottom (on OpenProcessing it used to open at the top, over the
// sketch); 位置 cycles bottom → top → floating; a floating panel moves when its bar is dragged and the sketch's
// mousePressed / mouseDragged do not fire; 大小 cycles the height cap; the choice survives a reload (this browser); a sketch
// that sets dock: 'top' still opens the panel at the top (the drum card moves below it); the 🎹 moves out of the panel's
// way only when they share an edge; no page errors.

const fs = require('fs'), path = require('path'), http = require('http'), os = require('os');
const { chromium } = require(process.env.PW || 'playwright');
const ROOT = path.resolve(__dirname, '../..');
const P5_DIR = process.env.P5_DIR;
const VERSIONS = (process.env.P5_VERSIONS || '1.11.11,2.3.4').split(',');
const SHOTS = process.env.SHOTS || fs.mkdtempSync(path.join(os.tmpdir(), 'oav-panel-'));
if (!P5_DIR) { console.error('P5_DIR is required (a folder with p5-<version>.min.js)'); process.exit(2); }

const SKETCH = `let pressed = 0, dragged = 0;
function setup() { createCanvas(windowWidth, windowHeight); }
function draw() { background(20); fill(255); circle(width / 2, height / 2, 40 + knob1 * 200); }
function mousePressed() { pressed++; }
function mouseDragged() { dragged++; }
window.__counts = () => ({ pressed, dragged });`;
const HITS = `window.__hits = { kick: 0, snare: 0 };
function kickDetected() { window.__hits.kick++; }
function snareDetected() { window.__hits.snare++; }`;

let fails = 0;
const row = (ok, label, detail = '') => { if (!ok) fails++; console.log(`${ok ? '✅' : '❌'} ${label}${!ok && detail ? '\n     ' + detail : ''}`); };

(async () => {
  const srv = http.createServer((q, r) => {
    const u = new URL(q.url, 'http://x');
    const send = (type, body) => { r.setHeader('Content-Type', type); r.end(body); };
    if (u.pathname === '/page') {
      const opts = u.searchParams.get('opts') || '{}';
      return send('text/html', `<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#111}</style>
<script>window.OAV_P5 = Object.assign({ hardware: 'off', relay: 'ws://127.0.0.1:1/relay' }, ${opts});</script>
<script src="/p5/p5-${u.searchParams.get('v')}.min.js"></script><script src="/oav/p5/oav-p5.js"></script><script>${SKETCH}${u.searchParams.get('hits') ? '\n' + HITS : ''}</script>`);
    }
    if (u.pathname.startsWith('/p5/')) return send('text/javascript', fs.readFileSync(path.join(P5_DIR, path.basename(u.pathname))));
    if (u.pathname.startsWith('/oav/')) {
      const f = path.join(ROOT, u.pathname.slice(5));
      if (!f.startsWith(ROOT) || !fs.existsSync(f)) { r.statusCode = 404; return r.end(); }
      return send(f.endsWith('.js') ? 'text/javascript' : f.endsWith('.json') ? 'application/json' : 'text/plain', fs.readFileSync(f));
    }
    r.statusCode = 404; r.end();
  });
  await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
  const base = `http://127.0.0.1:${srv.address().port}`;
  const browser = await chromium.launch();
  const box = (p, id) => p.evaluate((id) => { const e = document.getElementById(id); if (!e) return null; const b = e.getBoundingClientRect(); return { left: Math.round(b.left), top: Math.round(b.top), right: Math.round(b.right), bottom: Math.round(b.bottom), h: Math.round(b.height), w: Math.round(b.width), cap: e.style.maxHeight }; }, id);
  const openPanel = async (p) => { await p.click('#oav-p5-button'); await p.waitForFunction(() => { const c = document.querySelector('oav-controller'); return c && c.ready; }, null, { timeout: 8000 }).catch(() => {}); await p.waitForTimeout(300); };

  for (const v of VERSIONS) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const p = await ctx.newPage();
    const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(`${base}/page?v=${v}`);
    await p.waitForSelector('#oav-p5-button', { timeout: 8000 });
    await openPanel(p);
    let pn = await box(p, 'oav-p5-panel'), bt = await box(p, 'oav-p5-button');
    row(pn && pn.bottom === 800 && pn.left === 0 && pn.w === 1280 && pn.cap === '50vh', `p5 ${v}: no dock option → the panel opens docked at the bottom, medium (50vh)`, JSON.stringify(pn));
    row(bt && bt.bottom <= pn.top, `p5 ${v}: …and the 🎹 sits above it`, JSON.stringify({ bt, pn }));
    const label = await p.textContent('#oav-p5-place');
    row(/下方|bottom/.test(label), `p5 ${v}: the 位置 button says where it is`, label);

    await p.click('#oav-p5-place'); await p.waitForTimeout(200);
    pn = await box(p, 'oav-p5-panel'); bt = await box(p, 'oav-p5-button');
    row(pn.top === 0 && pn.w === 1280, `p5 ${v}: 位置 → top`, JSON.stringify(pn));
    row(bt.bottom === 800 - 10, `p5 ${v}: …the 🎹 stays at its bottom corner (not lifted by a panel on the other edge)`, JSON.stringify(bt));

    await p.click('#oav-p5-place'); await p.waitForTimeout(200);
    pn = await box(p, 'oav-p5-panel');
    row(pn.w <= 640 && pn.w > 500 && pn.cap === '42vh', `p5 ${v}: 位置 → floating: a box, 640 px wide at most, 42vh`, JSON.stringify(pn));
    const before = await p.evaluate(() => window.__counts());
    const grab = { x: pn.left + 30, y: pn.top + 14 };              // the bar's empty left edge (the legend)
    await p.mouse.move(grab.x, grab.y); await p.mouse.down(); await p.mouse.move(grab.x - 300, grab.y - 250, { steps: 8 }); await p.mouse.up();
    await p.waitForTimeout(200);
    const moved = await box(p, 'oav-p5-panel'), after = await p.evaluate(() => window.__counts());
    row(Math.abs(moved.left - (pn.left - 300)) <= 2 && Math.abs(moved.top - (pn.top - 250)) <= 2, `p5 ${v}: dragging the bar moves the floating panel`, JSON.stringify({ from: pn, to: moved }));
    row(after.pressed === before.pressed && after.dragged === before.dragged, `p5 ${v}: …without mousePressed / mouseDragged in the sketch`, JSON.stringify({ before, after }));

    await p.click('#oav-p5-size'); await p.waitForTimeout(150);
    const big = await box(p, 'oav-p5-panel');
    await p.click('#oav-p5-size'); await p.waitForTimeout(150);
    const small = await box(p, 'oav-p5-panel');
    row(big.cap === '60vh' && big.w > pn.w && small.cap === '32vh' && small.w < pn.w, `p5 ${v}: 大小 cycles medium → large → small`, JSON.stringify({ big, small }));
    await p.screenshot({ path: path.join(SHOTS, `panel-float-${v}.png`) });

    // drums started from the panel's 🥁, on a line typed into the card, at another tempo
    await p.click('#oav-p5-drums-button');
    await p.waitForFunction(() => drumsAreOn && OAVp5.drums.src, null, { timeout: 8000 });
    await p.evaluate(() => startDrums('bd*2, hh*8', 97));
    await p.waitForTimeout(400);
    const src0 = await p.evaluate(() => ({ src: OAVp5.drums.src, bpm: drumBpm }));

    // Cmd+Enter on OpenProcessing reloads the sketch: the panel comes back open where it was, the drums come back playing
    await p.reload(); await p.waitForSelector('#oav-p5-button', { timeout: 8000 });
    await p.waitForFunction(() => { const d = document.getElementById('oav-p5-panel'); return d && getComputedStyle(d).display !== 'none'; }, null, { timeout: 8000 }).catch(() => {});
    await p.waitForFunction(() => drumsAreOn, null, { timeout: 8000 }).catch(() => {});
    await p.waitForTimeout(300);
    const again = await box(p, 'oav-p5-panel');
    const src1 = await p.evaluate(() => ({ src: OAVp5.drums.src, bpm: drumBpm, on: drumsAreOn, card: !!document.getElementById('oav-p5-drums') }));
    row(again && again.h > 0 && again.left === moved.left && again.top === moved.top && again.cap === '32vh', `p5 ${v}: after a reload the panel is open again, same place and size`, JSON.stringify({ moved, again }));
    row(src1.on && src1.card && src1.src === src0.src && src1.bpm === src0.bpm, `p5 ${v}: …and the drums started from the panel play again, same line and tempo`, JSON.stringify({ src0, src1 }));

    // closing them is remembered too
    await p.click('#oav-p5-drums-button'); await p.waitForTimeout(200);
    await p.click('#oav-p5-panel button:has-text("' + (await p.evaluate(() => /^zh/i.test(navigator.language) ? '收起' : 'Hide')) + '")');
    await p.reload(); await p.waitForSelector('#oav-p5-button', { timeout: 8000 }); await p.waitForTimeout(1500);
    const closed = await p.evaluate(() => { const d = document.getElementById('oav-p5-panel'); return { panel: !!d && getComputedStyle(d).display !== 'none', drums: drumsAreOn }; });
    row(!closed.panel && !closed.drums, `p5 ${v}: a panel closed and drums stopped stay that way after a reload`, JSON.stringify(closed));
    row(errs.length === 0, `p5 ${v}: no page errors`, errs.join(' | ').slice(0, 300));
    await ctx.close();

    // a sketch that asks for the top (the old OpenProcessing layout) still gets it, with the drum card below the panel
    const c2 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const p2 = await c2.newPage();
    const e2 = []; p2.on('pageerror', (e) => e2.push(e.message));
    await p2.goto(`${base}/page?v=${v}&opts=${encodeURIComponent("{ dock: 'top', corner: 'left' }")}`);
    await p2.waitForSelector('#oav-p5-button', { timeout: 8000 });
    await p2.evaluate(() => startDrums('four on floor'));
    await p2.waitForSelector('#oav-p5-drums', { timeout: 8000 });
    await openPanel(p2);
    const tp = await box(p2, 'oav-p5-panel'), card = await box(p2, 'oav-p5-drums'), b2 = await box(p2, 'oav-p5-button');
    row(tp.top === 0 && card.top >= tp.bottom - 1 && b2.top >= tp.bottom, `p5 ${v}: dock: 'top' → the panel at the top, the drum card and the 🎹 below it`, JSON.stringify({ tp, card, b2 }));
    row(e2.length === 0, `p5 ${v}: dock: 'top': no page errors`, e2.join(' | ').slice(0, 300));
    await c2.close();

    // the microphone while the drums play: its hits are not the sketch's (the speakers' drums would come twice)
    const c3 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const p3 = await c3.newPage();
    const e3 = []; p3.on('pageerror', (e) => e3.push(e.message));
    await p3.goto(`${base}/page?v=${v}&hits=1&opts=${encodeURIComponent("{ mic: 'click' }")}`);
    await p3.waitForSelector('#oav-p5-button', { timeout: 8000 });
    const FRAME = "({ rms: 0.2, low: 0.5, mid: 0.4, high: 0.2, onset: true, kick: { hit: true, level: 0.8, env: 0.8 }, snare: { hit: true, level: 0.6, env: 0.6 }, hat: { hit: false, level: 0, env: 0 } })";
    const alone = await p3.evaluate((F) => { const a = { ...window.__hits }; OAVp5.mic._frame(eval(F)); return { kick: window.__hits.kick - a.kick, snare: window.__hits.snare - a.snare }; }, FRAME);
    await p3.evaluate(() => startDrums('bd*4', 120));
    await p3.waitForFunction(() => drumsAreOn, null, { timeout: 8000 });
    const withDrums = await p3.evaluate((F) => { const a = { ...window.__hits }; OAVp5.drums._hit('kick', 0.9); const b = { ...window.__hits }; OAVp5.mic._frame(eval(F));
      return { drumKick: b.kick - a.kick, drumSnare: b.snare - a.snare, micKick: window.__hits.kick - b.kick, micSnare: window.__hits.snare - b.snare, bass: bass }; }, FRAME);
    row(alone.kick === 1 && alone.snare === 1, `p5 ${v}: no drums: the microphone's kick and snare reach the sketch`, JSON.stringify(alone));
    row(withDrums.drumKick === 1 && withDrums.drumSnare === 0 && withDrums.micKick === 0 && withDrums.micSnare === 0 && withDrums.bass > 0,
      `p5 ${v}: drums on: a kick is one kickDetected and no snareDetected; the microphone's hits stay out, bass still moves`, JSON.stringify(withDrums));
    row(e3.length === 0, `p5 ${v}: mic + drums: no page errors`, e3.join(' | ').slice(0, 300));
    await c3.close();
  }
  await browser.close(); srv.close();
  console.log(`\n${fails ? '❌ ' + fails + ' failed' : '✅ all green'}; screenshots in ${SHOTS}`);
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
