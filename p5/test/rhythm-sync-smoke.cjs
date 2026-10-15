#!/usr/bin/env node
// rhythm-sync-smoke.cjs — oav-p5 0.7 in a real (headless) Chromium: the cells and the line edit each other, ↶ / ⌘Z, Copy, the
// strudel.cc link, a line copied from strudel.cc, and drawRhythm('grid' | 'circle' | 'spiral') on p5 1.x / 2.x, 2D and WEBGL, read
// back pixel by pixel, and in a recording (startRecording(2), one frame pulled out with ffmpeg). Not part of `npm test`.
//
//   P5_DIR=<dir with p5-1.11.11.min.js, p5-2.3.4full.min.js> PW=<path to playwright(-core)> [CHROME=…] [SHOTS=<dir>]
//   [P5_VERSIONS=1.11.11,2.3.4full] [REC=0: skip the recording (needs ffmpeg)] node p5/test/rhythm-sync-smoke.cjs
const fs = require('fs'), path = require('path'), http = require('http'), os = require('os');
const { spawnSync } = require('child_process');
const PW = require(process.env.PW || 'playwright');
const ROOT = path.resolve(__dirname, '../..');
const P5_DIR = process.env.P5_DIR || path.join(ROOT, 'p5/test/vendor');
const SHOTS = process.env.SHOTS || __dirname;
const VERSIONS = (process.env.P5_VERSIONS || '1.11.11,2.3.4full').split(',');
const MIME = { '.js': 'text/javascript', '.json': 'application/json', '.html': 'text/html' };

const probe = `
window.__r = { changed: [], hits: [] };
function rhythmChanged(src, how) { __r.changed.push([src, how]); }
function drumHit(lane) { __r.hits.push([lane, drumBar, drumPhase]); }
function keyPressed() { window.__keys = (window.__keys || 0) + 1; }`;
const SKETCH = {
  probe: (q) => `${probe}
function setup() { createCanvas(windowWidth, windowHeight); startDrums(${JSON.stringify(q.get('line'))}${q.get('bpm') ? ', ' + q.get('bpm') : ''}); }
function draw() { background(16, 18, 28); }`,
  // three styles in fixed boxes (the pixels are read back at known places); WEBGL draws the same boxes after translate()
  vis: (q) => `${probe}
function setup() { pixelDensity(1); createCanvas(800, 500${q.get('gl') === '1' ? ', WEBGL' : ''}); startDrums("bd*4, [~ sd]*2, hh*8", 120); }
function draw() {
  background(0);
  ${q.get('gl') === '1' ? 'translate(-width / 2, -height / 2);' : ''}
  drawRhythm(20, 20, 360, 120, 'grid');
  drawRhythm(20, 160, 320, 320, 'circle');
  drawRhythm(420, 160, 320, 320, 'spiral', { bars: 4 });
}
function recordingSaved(info) { window.__saved = { name: info.name, format: info.format, seconds: info.seconds, bytes: info.bytes }; }`,
  example: () => fs.readFileSync(path.join(ROOT, 'p5/examples/rhythm-visual/sketch.js'), 'utf8').replace('https://openaudiovisual.com/p5/oav-p5.js', '/oav/p5/oav-p5.js'),
};

let bad = 0;
const row = (ok, name, extra) => { if (!ok) bad++; console.log(`${ok ? '✅' : '❌'} ${name}${extra ? '  ' + extra : ''}`); };

(async () => {
  const srv = http.createServer((q, r) => {
    const u = new URL(q.url, 'http://x');
    const send = (type, body) => { r.setHeader('Content-Type', type); r.end(body); };
    const q1 = (k) => u.searchParams.get(k);
    if (u.pathname === '/page') {
      return send('text/html', `<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#111}</style>
<script>window.OAV_P5 = Object.assign({ hardware: 'off', relay: 'ws://127.0.0.1:1/relay' }, ${q1('opts') || '{}'});</script>
<script src="/p5/p5-${q1('v')}.min.js"></script><script src="/sketch.js?${u.searchParams}"></script>`);
    }
    if (u.pathname === '/sketch.js') {
      const kind = q1('kind') || 'probe', body = SKETCH[kind](u.searchParams);
      return send('text/javascript', (kind === 'example' ? '' : `document.head.prepend(Object.assign(document.createElement('script'), { src: '/oav/p5/oav-p5.js' }));\n`) + body);
    }
    if (u.pathname.startsWith('/p5/')) { const f = path.join(P5_DIR, u.pathname.slice(4)); return fs.existsSync(f) ? send('text/javascript', fs.readFileSync(f)) : (r.writeHead(404), r.end()); }
    if (u.pathname.startsWith('/oav/')) {
      const f = path.join(ROOT, decodeURIComponent(u.pathname.slice(5)));
      if (!f.startsWith(ROOT) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); }
      return send(MIME[path.extname(f)] || 'application/octet-stream', fs.readFileSync(f));
    }
    r.writeHead(404); r.end();
  });
  await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
  const base = `http://127.0.0.1:${srv.address().port}`;
  const exe = process.env.CHROME;
  const b = await PW.chromium.launch({ executablePath: exe && fs.existsSync(exe) ? exe : undefined, headless: true });
  fs.mkdirSync(SHOTS, { recursive: true });

  const open = async (v, q, { locale = 'zh-TW', viewport = { width: 1000, height: 720 } } = {}) => {
    const ctx = await b.newContext({ viewport, locale, deviceScaleFactor: 1, acceptDownloads: true });
    await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: base }).catch(() => {});
    await ctx.routeWebSocket(/127\.0\.0\.1:1\//, (ws) => ws.close());
    const p = await ctx.newPage(); const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|favicon/.test(m.text())) errs.push('console: ' + m.text()); });
    await p.goto(`${base}/page?v=${v}&${new URLSearchParams(q)}`);
    return { ctx, p, errs };
  };
  const ready = (p) => p.waitForFunction(() => window.OAVp5 && OAVp5.drums.state === 'on' && OAVp5.drums.machine && OAVp5.drums.machine.rhythm && document.querySelector('#oav-p5-drums .score textarea'), null, { timeout: 10000 }).catch(() => {});
  const state = (p) => p.evaluate(() => {
    const c = document.getElementById('oav-p5-drums'), lanes = [...c.querySelectorAll('.lane-lbl')];
    const rows = {};
    for (const l of lanes) { const cells = []; let n = l.nextElementSibling; for (let i = 0; i < 16; i++, n = n.nextElementSibling) cells.push(n.classList.contains('on') ? 'x' : '.'); rows[l.textContent] = cells.join(''); }
    return { src: OAVp5.drums.src, score: c.querySelector('.score .view').textContent, mode: OAVp5.drums.now.mode, history: [...OAVp5.drums.history], rows,
      bad: (c.querySelector('.score .bad') || {}).textContent || null, undo: c.querySelector('[data-undo]').disabled, changed: window.__r.changed.slice(),
      hints: [...OAVp5.hints].map((h) => ({ id: h.id, what: h.what, why: h.why, next: h.next, shown: !!(h.el && h.el.isConnected) })) };
  });
  const cell = (p, row, i) => p.evaluate(({ row, i }) => { const l = [...document.querySelectorAll('#oav-p5-drums .lane-lbl')][row]; let n = l.nextElementSibling; for (let k = 0; k < i; k++) n = n.nextElementSibling; n.click(); }, { row, i });
  // what the machine plays from now on: the kicks of the next bars, as heard (drumHit with drumPhase)
  const kicksAfter = async (p, ms) => {
    const from = await p.evaluate(() => __r.hits.length);
    await p.waitForTimeout(ms);
    return p.evaluate((from) => __r.hits.slice(from).filter((h) => h[0] === 'kick').map((h) => [h[1], Math.round(h[2] * 16 * 10) / 10]), from);
  };

  for (const v of VERSIONS) {
    const first = v === VERSIONS[0];
    // 1. a click on a cell: the line is rewritten, the machine plays the new line, undo, ⌘Z, Copy, the strudel.cc link
    {
      const line = 'bd*4, [~ sd]*2, hh*8';
      const { ctx, p, errs } = await open(v, { line, bpm: 120 });
      await ready(p);
      await p.mouse.click(500, 650);
      await p.waitForTimeout(400);
      const s0 = await state(p);
      row(s0.src === line && s0.score === line && s0.undo === true && s0.changed.length === 1 && s0.changed[0][1] === 'code', `p5 ${v}: the line, editable, ↶ off; rhythmChanged(src, 'code') once`, JSON.stringify({ src: s0.src, changed: s0.changed }));
      await cell(p, 0, 3);                                     // kick, step 4
      await p.waitForTimeout(150);
      const s1 = await state(p);
      const want = '[bd ~ ~ bd] bd bd bd, [~ sd]*2, hh*8';
      row(s1.src === want && s1.score === want && s1.mode === 'string' && s1.rows['大鼓'] === 'x..xx...x...x...' && s1.history.join('|') === line && s1.undo === false && s1.changed.at(-1).join() === want + ',cell',
        `p5 ${v}: a click on a cell rewrites the line (fromGrid), the grid follows, the old line is in history, rhythmChanged(…, 'cell')`, JSON.stringify({ src: s1.src, kick: s1.rows['大鼓'], history: s1.history }));
      const k1 = await kicksAfter(p, 4600);
      const perBar = {}; for (const [bar] of k1) perBar[bar] = (perBar[bar] || 0) + 1;
      const full = Object.entries(perBar).filter(([bar]) => k1.filter((k) => k[0] === +bar).some((k) => k[1] < 0.5) && k1.filter((k) => k[0] === +bar).some((k) => k[1] > 11.5));
      row(k1.some((k) => Math.abs(k[1] - 3) < 0.6) && full.length >= 1 && full.every(([, n]) => n === 5), `p5 ${v}: …and the machine plays it: 5 kicks a bar, one heard at step 3`, JSON.stringify(k1.slice(0, 12)));
      if (first) await p.locator('#oav-p5-drums').screenshot({ path: path.join(SHOTS, 'v07-cell-clicked.png') });
      // undo: ↶ on the card, then ⌘Z after touching the card
      await p.click('#oav-p5-drums [data-undo]');
      await p.waitForTimeout(150);
      const s2 = await state(p);
      row(s2.src === line && s2.history.length === 0 && s2.changed.at(-1).join() === line + ',undo' && s2.rows['大鼓'] === 'x...x...x...x...', `p5 ${v}: ↶ brings the line back (rhythmChanged …, 'undo')`, JSON.stringify({ src: s2.src, history: s2.history }));
      await cell(p, 2, 1);                                     // two more hats: two steps of history
      const oneHat = (await state(p)).src;
      await cell(p, 2, 3);
      await p.waitForTimeout(100);
      await p.mouse.click(5, 300);                             // a press on the canvas: ⌘Z is the sketch's again
      await p.keyboard.press('Meta+z');
      const s3a = await state(p);
      await p.locator('#oav-p5-drums .grid').click({ position: { x: 2, y: 2 } });   // touch the card (the grid's edge)
      await p.keyboard.press('Meta+z');
      await p.waitForTimeout(100);
      const s3 = await state(p);
      row(oneHat === 'bd*4, [~ sd]*2, hh*2 hh*2 hh*2 hh*2'.replace(/.*/, oneHat) && s3a.history.length === 2 && s3a.src !== oneHat && s3.history.length === 1 && s3.src === oneHat && s3.changed.at(-1)[1] === 'undo',
        `p5 ${v}: ⌘Z undoes only after the card was touched (a press on the canvas gives the keys back to the sketch)`, JSON.stringify({ oneHat, before: s3a.history.length, after: s3.history.length, src: s3.src }));
      // Copy and Open in Strudel
      await p.click('#oav-p5-drums [data-copy]');
      await p.waitForTimeout(200);
      const cp = await p.evaluate(async () => ({ copied: OAVp5.drums.machine.copied, label: document.querySelector('#oav-p5-drums [data-copy]').textContent, text: OAVp5.drums.copyText,
        clip: await navigator.clipboard.readText().catch((e) => 'unreadable: ' + e.message) }));
      const expectCopy = `startDrums(${JSON.stringify(s3.src)}, 120)`;
      row(cp.copied === expectCopy && cp.text === expectCopy && cp.clip === expectCopy && cp.label === '已複製', `p5 ${v}: Copy puts startDrums("…", 120) on the clipboard`, JSON.stringify(cp));
      const st = await p.evaluate(() => { const a = document.querySelector('#oav-p5-drums [data-strudel]'); return { url: OAVp5.drums.strudelUrl, href: a.href, target: a.target, rel: a.rel, label: a.textContent }; });
      const code = Buffer.from(decodeURIComponent(st.url.split('#')[1] || ''), 'base64').toString('utf8');
      row(st.url.startsWith('https://strudel.cc/#') && st.href === st.url && st.target === '_blank' && /noopener/.test(st.rel) && st.label === '在 Strudel 打開' &&
        code === `// 來自 OAV 鼓機（openaudiovisual.com）\nsetcpm(120/4)\ns(${JSON.stringify(s3.src)})`, `p5 ${v}: "在 Strudel 打開" is a new-tab link; its # decodes to the line with setcpm(120/4)`, JSON.stringify(code));
      row(errs.length === 0, `p5 ${v}: clicks, undo, copy: no page errors`, errs.join(' | ').slice(0, 300));
      await ctx.close();
    }
    // 2. typing into the line: the cells follow; a mistake is marked red, a card, the last line that worked keeps playing; Escape
    {
      const { ctx, p, errs } = await open(v, { line: 'bd*4, [~ sd]*2, hh*8', bpm: 120 });
      await ready(p);
      await p.mouse.click(500, 650);
      await p.click('#oav-p5-drums .score');
      await p.keyboard.press('Meta+a');
      await p.keyboard.type('bd(3,8), hh*16', { delay: 15 });
      await p.waitForTimeout(650);                              // 400 ms after the last key it plays
      const s1 = await state(p);
      row(s1.src === 'bd(3,8), hh*16' && s1.rows['大鼓'] === 'x.....x.....x...' && s1.rows['鈸'] === 'xxxxxxxxxxxxxxxx' && s1.rows['小鼓'] === '................' && s1.changed.at(-1)[1] === 'type',
        `p5 ${v}: typed "bd(3,8), hh*16": a pause plays it, the cells follow`, JSON.stringify({ src: s1.src, rows: s1.rows }));
      await p.keyboard.type(', kik', { delay: 15 });
      await p.waitForTimeout(650);
      const s2 = await state(p), k2 = await kicksAfter(p, 1300);
      const he = s2.hints.find((h) => h.id === 'rhythmEdit');
      row(s2.bad === 'kik' && he && he.shown && he.what === '節奏字串第 17 個字有問題' && /不認得「kik」/.test(he.why) && /上一個能用的版本/.test(he.next) && s2.src === 'bd(3,8), hh*16' && s2.mode === 'string',
        `p5 ${v}: "…, kik": the word is marked red, one card says where and why, the line before keeps playing`, JSON.stringify({ bad: s2.bad, what: he && he.what, src: s2.src }));
      row(k2.length >= 2 && k2.every((k) => [0, 6, 12].some((x) => Math.abs(k[1] - x) < 0.6)), `p5 ${v}: …the kicks heard meanwhile are still bd(3,8)'s (steps 0, 6, 12), not four on floor`, JSON.stringify(k2));
      if (first) {
        await p.screenshot({ path: path.join(SHOTS, 'v07-card-editing.png') });
        await p.locator('#oav-p5-drums').screenshot({ path: path.join(SHOTS, 'v07-card-editing-card.png') });
      }
      await p.keyboard.press('Backspace'); await p.keyboard.press('Backspace'); await p.keyboard.press('Backspace');
      await p.keyboard.type('cp');
      await p.keyboard.press('Enter');                          // Enter plays at once
      await p.waitForTimeout(80);
      const s3 = await state(p);
      row(s3.src === 'bd(3,8), hh*16, cp' && !s3.bad && !s3.hints.some((h) => h.id === 'rhythmEdit' && h.shown) && s3.rows['拍手'] === 'x...............', `p5 ${v}: fixed + Enter: plays at once, the red mark and the card go`, JSON.stringify({ src: s3.src, clap: s3.rows['拍手'] }));
      await p.keyboard.type(' sd');
      await p.keyboard.press('Escape');
      const s4 = await state(p);
      const sketchKeys = await p.evaluate(() => window.__keys || 0);
      row(s4.src === 'bd(3,8), hh*16, cp' && s4.score === 'bd(3,8), hh*16, cp' && sketchKeys === 0, `p5 ${v}: Escape drops what was not played yet; typed keys never reach the sketch`, JSON.stringify({ src: s4.src, score: s4.score }));
      row(errs.length === 0, `p5 ${v}: typing: no page errors`, errs.join(' | ').slice(0, 300));
      await ctx.close();
    }
    // 3. a line the grid cannot hold: the first click says what goes; the second rewrites it; ↶ brings the original back
    {
      const line = 'bd(3,8), [sd sd sd]*2, <hh oh>';
      const { ctx, p, errs } = await open(v, { line, bpm: 110 });
      await ready(p);
      await cell(p, 3, 4);                                     // clap, step 5
      await p.waitForTimeout(150);
      const s1 = await state(p), hl = s1.hints.find((h) => /^rhythmLossy:/.test(h.id));
      row(s1.src === line && hl && hl.shown && hl.what === '格子寫不出這一行的全部' && /三連音/.test(hl.why) && /每小節不一樣/.test(hl.why), `p5 ${v}: first click on "${line}": a card says what the grid cannot keep, nothing changes yet`, JSON.stringify({ src: s1.src, why: hl && hl.why }));
      if (first) await p.screenshot({ path: path.join(SHOTS, 'v07-lossy.png') });
      await cell(p, 3, 4);
      await p.waitForTimeout(150);
      const s2 = await state(p);
      const exact = await p.evaluate((src) => OAVp5.drums.machine.rhythm.toGrid(src).exact, s2.src);
      row(s2.src !== line && exact && /cp/.test(s2.src) && s2.history.at(-1) === line, `p5 ${v}: second click rewrites it the grid's way (exact now), the original in history`, JSON.stringify({ src: s2.src }));
      await p.click('#oav-p5-drums [data-undo]');
      const s3 = await state(p);
      row(s3.src === line, `p5 ${v}: ↶: the triplets and < > are back`, s3.src);
      row(errs.length === 0, `p5 ${v}: lossy: no page errors`, errs.join(' | ').slice(0, 300));
      await ctx.close();
    }
    // 4. a line copied from strudel.cc, and a preset shown as its line
    {
      const { ctx, p, errs } = await open(v, { line: 'setcpm(100/4)\ns("bd*4, [~ sd]*2").bank("RolandTR909").fast(2).jux(rev)' });
      await ready(p);
      await p.mouse.click(500, 650);
      const k = await kicksAfter(p, 2700);
      const s = await state(p), bpm = await p.evaluate(() => drumBpm);
      row(s.src === '[bd*4, [~ sd]*2]*2' && bpm === 100 && k.length >= 6 && s.hints.some((h) => /^rhythmBank:/.test(h.id) && h.shown) && s.hints.some((h) => h.id === 'rhythmChain:.jux(rev)' && /在 Strudel 打開/.test(h.next)) && !s.hints.some((h) => /^rhythm:/.test(h.id)),
        `p5 ${v}: startDrums('setcpm(100/4) s("…").bank(…).fast(2).jux(rev)'): plays [ … ]*2 at 100 bpm; .bank and .jux each get a card`, JSON.stringify({ src: s.src, bpm, kicks: k.length, hints: s.hints.map((h) => h.id) }));
      if (first) await p.screenshot({ path: path.join(SHOTS, 'v07-strudel-in.png') });
      row(errs.length === 0, `p5 ${v}: strudel in: no page errors`, errs.join(' | ').slice(0, 300));
      await ctx.close();
      const pr = await open(v, { line: 'breakbeat', bpm: 110 });
      await ready(pr.p);
      const a = await state(pr.p);
      await cell(pr.p, 3, 12);
      await pr.p.waitForTimeout(100);
      const b2 = await state(pr.p);
      const pat = await pr.p.evaluate(() => OAVp5.drums.pattern);
      row(a.src === 'bd [~ ~ ~ bd] bd*2 ~, ~ sd ~ [sd ~ ~ sd], hh*8, ~ cp ~ ~' && a.mode === 'grid' && b2.src === 'bd [~ ~ ~ bd] bd*2 ~, ~ sd ~ [sd ~ ~ sd], hh*8, [~ cp]*2' && pat === 'custom' && b2.history.length === 1,
        `p5 ${v}: a preset (breakbeat) shows the line its grid is; a click updates it (the grid plays, 'custom')`, JSON.stringify({ before: a.src, after: b2.src, mode: a.mode, pat, history: b2.history }));
      row(pr.errs.length === 0, `p5 ${v}: preset: no page errors`, pr.errs.join(' | ').slice(0, 300));
      await pr.ctx.close();
    }
    // 5. drawRhythm: three styles, 2D and WEBGL, the pixels read back
    for (const gl of ['0', '1']) {
      const tag = `p5 ${v} ${gl === '1' ? 'WEBGL' : '2D'}`;
      const { ctx, p, errs } = await open(v, { kind: 'vis', gl });
      await p.waitForFunction(() => window.OAVp5 && OAVp5.drums.state === 'on' && OAVp5.drums.machine && OAVp5.drums.machine.rhythm, null, { timeout: 10000 }).catch(() => {});
      await p.mouse.click(900, 690);
      await p.waitForTimeout(1500);
      const read = () => p.evaluate(() => {
        const cv = document.querySelector('canvas'), c2 = document.createElement('canvas');
        c2.width = cv.width; c2.height = cv.height;
        const x = c2.getContext('2d'); x.drawImage(cv, 0, 0);
        const at = (px, py) => Array.from(x.getImageData(Math.round(px), Math.round(py), 1, 1).data);
        const P = Math.PI, ring = (q, pos) => { const a = -P / 2 + (pos + 1 / 32) * 2 * P, r = 48 + (q + 0.5) * (112 / 3); return at(180 + Math.cos(a) * r, 320 + Math.sin(a) * r); };
        const box = (x0, y0, w, h) => { const d = x.getImageData(x0, y0, w, h).data; let lit = 0, red = 0, blue = 0; for (let i = 0; i < d.length; i += 4) { const m = Math.max(d[i], d[i + 1], d[i + 2]); if (m > 150) lit++; if (d[i] > 150 && d[i] - d[i + 1] > 30) red++; if (d[i + 2] > 150 && d[i + 2] - d[i] > 30) blue++; } return { lit, red, blue }; };
        return {
          gridKick: [0, 4, 8, 12].map((i) => at(20 + (i + 0.5) * 22.5, 40)), gridOff: at(20 + 2.5 * 22.5, 40), gridSnare: [4, 12].map((i) => at(20 + (i + 0.5) * 22.5, 80)), gridHat: at(20 + 2.5 * 22.5, 120),
          ringKick: [0, 0.25, 0.5, 0.75].map((pos) => ring(0, pos)), ringOff: ring(0, 0.125), ringHat: ring(2, 0.125),
          spiral: box(420, 160, 320, 320), w: cv.width, h: cv.height,
        };
      });
      const r1 = await read();
      await p.waitForTimeout(400);
      const r2 = await read();
      const isKick = (c) => c[0] > 150 && c[0] - c[1] > 30, isSnare = (c) => c[0] > 150 && c[1] > 130 && c[0] - c[2] > 50, isHat = (c) => c[2] > 150 && c[2] - c[0] > 30, dark = (c) => Math.max(c[0], c[1], c[2]) < 70;
      row(r1.gridKick.filter(isKick).length >= 3 && dark(r1.gridOff) && r1.gridSnare.filter(isSnare).length >= 1 && isHat(r1.gridHat), `${tag}: drawRhythm 'grid': kick cells red, an empty step dark, snare yellow, hat blue`, JSON.stringify({ kick: r1.gridKick, off: r1.gridOff, snare: r1.gridSnare, hat: r1.gridHat }));
      row(r1.ringKick.filter(isKick).length >= 3 && dark(r1.ringOff) && isHat(r1.ringHat), `${tag}: drawRhythm 'circle': the kick ring lit at 0, ¼, ½, ¾, dark between; the hat ring outside`, JSON.stringify({ kick: r1.ringKick, off: r1.ringOff, hat: r1.ringHat }));
      row(r1.spiral.lit > 300 && r1.spiral.red > 30 && r1.spiral.blue > 30 && (r1.spiral.lit !== r2.spiral.lit || r1.spiral.red !== r2.spiral.red), `${tag}: drawRhythm 'spiral': dots of each drum, and it moves`, JSON.stringify([r1.spiral, r2.spiral]));
      if (v === VERSIONS[0] || v === VERSIONS[VERSIONS.length - 1]) await p.screenshot({ path: path.join(SHOTS, `v07-visual-${gl === '1' ? 'webgl' : '2d'}-p5-${v}.png`) });
      // the recording takes the canvas alone: drawRhythm is in it (one frame pulled out with ffmpeg)
      if (gl === '0' && process.env.REC !== '0') {
        const dl = p.waitForEvent('download', { timeout: 20000 }).catch(() => null);
        await p.evaluate(() => startRecording(2));
        const d = await dl;
        const file = d ? path.join(os.tmpdir(), `oav-v07-${process.pid}-${d.suggestedFilename()}`) : null;
        if (d) await d.saveAs(file);
        let frame = null, px = null;
        if (file) {
          frame = path.join(SHOTS, `v07-rec-frame-p5-${v}.png`);
          spawnSync('ffmpeg', ['-v', 'error', '-y', '-ss', '1.0', '-i', file, '-frames:v', '1', frame]);
          if (fs.existsSync(frame)) {
            px = await p.evaluate(async (b64) => {
              const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
              const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0);
              const at = (px, py) => Array.from(x.getImageData(px, py, 1, 1).data);
              return { w: img.width, h: img.height, kick: [0, 4, 8, 12].map((i) => at(Math.round(20 + (i + 0.5) * 22.5), 40)), off: at(76, 40), hat: at(76, 120) };
            }, fs.readFileSync(frame).toString('base64'));
          }
        }
        const saved = await p.evaluate(() => window.__saved || null);
        row(px && px.w === 800 && px.kick.filter(isKick).length >= 3 && dark(px.off) && isHat(px.hat), `${tag}: startRecording(2): a frame of the video has drawRhythm in it (red kicks, a dark step, blue hats)`, JSON.stringify({ saved, px }));
      }
      row(errs.length === 0, `${tag}: drawRhythm: no page errors`, errs.join(' | ').slice(0, 300));
      await ctx.close();
    }
  }
  // 6. drums=frame (the safety net): the line is there and editable; a typed line plays its first bar on the grid; a click rewrites it
  {
    const v = VERSIONS[VERSIONS.length - 1];
    const { ctx, p, errs } = await open(v, { line: 'bd*4, [~ sd]*2, hh*8', bpm: 120, opts: JSON.stringify({ drums: 'frame' }) });
    await ready(p);
    const r = await p.evaluate(() => OAVp5.drums.edit('bd*2, hh*4'));
    await p.waitForTimeout(100);
    const a = await state(p);
    await cell(p, 1, 4);
    await p.waitForTimeout(100);
    const c = await state(p), clk = await p.evaluate(() => OAVp5.drums.clock.clock);
    row(clk === 'frame' && r.ok && a.src === 'bd*2, hh*4' && a.rows['大鼓'] === 'x.......x.......' && c.src === 'bd*2, ~ sd ~ ~, hh*4' && c.history.length === 2,
      `p5 ${v}: drums=frame: typing and clicking edit the line too`, JSON.stringify({ clk, a: a.src, c: c.src, history: c.history }));
    row(errs.length === 0, `p5 ${v}: drums=frame: no page errors`, errs.join(' | ').slice(0, 300));
    await ctx.close();
  }
  // 7. the example sketch: all three styles and the line on the canvas
  {
    const v = VERSIONS[VERSIONS.length - 1];
    const { ctx, p, errs } = await open(v, { kind: 'example' }, { viewport: { width: 1200, height: 760 } });
    await p.waitForFunction(() => window.OAVp5 && OAVp5.drums.state === 'on' && OAVp5.drums.src, null, { timeout: 10000 }).catch(() => {});
    await p.mouse.click(600, 700);
    await p.waitForTimeout(1800);
    const src = await p.evaluate(() => OAVp5.drums.src);
    await p.screenshot({ path: path.join(SHOTS, 'v07-example-rhythm-visual.png') });
    row(src === 'bd(3,8), [~ sd]*2, hh*8, ~ ~ ~ cp' && errs.length === 0, `p5 ${v}: p5/examples/rhythm-visual runs (three styles + the line on the canvas)`, JSON.stringify({ src, errs }));
    await ctx.close();
  }
  await b.close(); srv.close();
  console.log(bad ? `\n${bad} check(s) failed` : '\nall checks passed');
  process.exit(bad ? 1 : 0);
})();
