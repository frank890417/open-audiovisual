#!/usr/bin/env node
// rhythm-smoke.cjs — oav-p5 0.6's drum card in a real (headless) Chromium: one line of rhythm, the score line that lights the
// word that sounds, the lanes in the page's language, the bar number, a mistake's card, the cells taking over, drums=frame,
// and (DEMOS=<dir>) the course's Demo 2 sketches unchanged. Not part of `npm test` (needs a browser).
//
//   P5_DIR=<dir with p5-1.11.11.min.js, p5-2.3.4full.min.js> PW=<path to playwright(-core)> [CHROME=…] [SHOTS=<dir>]
//   [P5_VERSIONS=1.11.11,2.3.4full] [STUB_PATTERN=0: use packages/pattern itself] [DEMOS=<…/lesson-04/demos/02-drums>] node p5/test/rhythm-smoke.cjs
//
// Until packages/pattern is merged, /packages/pattern/index.js is served from p5/test/pattern-stub.js (same interface).
const fs = require('fs'), path = require('path'), http = require('http');
const PW = require(process.env.PW || 'playwright');
const ROOT = path.resolve(__dirname, '../..');
const P5_DIR = process.env.P5_DIR || path.join(ROOT, 'p5/test/vendor');
const SHOTS = process.env.SHOTS || __dirname;
const VERSIONS = (process.env.P5_VERSIONS || '1.11.11,2.3.4full').split(',');
const REAL_PATTERN = path.join(ROOT, 'packages/pattern/index.js');
const STUB = process.env.STUB_PATTERN === '0' && fs.existsSync(REAL_PATTERN) ? null : path.join(__dirname, 'pattern-stub.js');
const DEMOS = process.env.DEMOS || '';
const MIME = { '.js': 'text/javascript', '.json': 'application/json', '.html': 'text/html' };

const probe = `
window.__r = { kick: [], snare: [], hat: [], hits: {}, phases: [], bars: [], cues: [] };
function kickDetected() { __r.kick.push({ tokens: OAVp5.drums.now.tokens, beat: beatPhase }); }
function snareDetected() { __r.snare.push({ tokens: OAVp5.drums.now.tokens }); }
function hatDetected() { __r.hat.push({ tokens: OAVp5.drums.now.tokens }); }
function drumHit(lane) { __r.hits[lane] = (__r.hits[lane] || 0) + 1; }
function barStarted(b) { __r.bars.push(b); }`;
const sketch = (line, bpm) => `${probe}
function setup() { createCanvas(windowWidth, windowHeight); startDrums(${JSON.stringify(line)}, ${bpm}); }
function draw() { background(16, 18, 28); noStroke(); fill(120, 160, 255); translate(width / 2, height / 2 + 60);
  rotate(drumPhase * TWO_PI); rect(0, -4, 140, 8); fill(255, 210, 100); circle(0, 0, 30 + 50 * (1 - beatPhase));
  if (frameCount % 5 === 0) __r.phases.push([drumBar, drumPhase]); }`;

let bad = 0;
const row = (ok, name, extra) => { if (!ok) bad++; console.log(`${ok ? '✅' : '❌'} ${name}${extra ? '  ' + extra : ''}`); };
// WCAG 2 contrast of two CSS colours (the second may be translucent over the first)
const rgb = (s) => (s.match(/[\d.]+/g) || []).map(Number);
const lum = ([r, g, b]) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const over = (fg, bg) => { const a = fg[3] == null ? 1 : fg[3]; return [0, 1, 2].map((i) => fg[i] * a + bg[i] * (1 - a)); };
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

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
      const demo = q1('demo');
      if (demo) {
        let code = fs.readFileSync(path.join(DEMOS, demo), 'utf8').replace('https://openaudiovisual.com/p5/oav-p5.js', '/oav/p5/oav-p5.js');
        code += `\n;window.__d = { kick: 0, cues: [], bars: 0 };(() => { const w = (n, f) => { const o = window[n]; if (typeof o === 'function') window[n] = function (...a) { f(...a); return o.apply(this, a); }; };
          w('kickDetected', () => __d.kick++); w('cueFired', (n, b) => __d.cues.push(n + '@' + b + ':' + OAVp5.drums.pattern)); })();`;
        return send('text/javascript', code);
      }
      return send('text/javascript', `document.head.prepend(Object.assign(document.createElement('script'), { src: '/oav/p5/oav-p5.js' }));\n` + sketch(q1('line'), +q1('bpm') || 120));
    }
    if (u.pathname.startsWith('/p5/')) { const f = path.join(P5_DIR, u.pathname.slice(4)); return fs.existsSync(f) ? send('text/javascript', fs.readFileSync(f)) : (r.writeHead(404), r.end()); }
    if (u.pathname === '/oav/packages/pattern/index.js' && STUB) return send('text/javascript', fs.readFileSync(STUB));
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
  console.log(`pattern: ${STUB ? 'the stub (p5/test/pattern-stub.js)' : 'packages/pattern'}`);

  const open = async (v, q, { locale = 'zh-TW', viewport = { width: 1000, height: 700 } } = {}) => {
    const ctx = await b.newContext({ viewport, locale });
    await ctx.routeWebSocket(/127\.0\.0\.1:1\//, (ws) => ws.close());
    const p = await ctx.newPage(); const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|favicon/.test(m.text())) errs.push('console: ' + m.text()); });
    await p.goto(`${base}/page?v=${v}&${new URLSearchParams(q)}`);
    return { ctx, p, errs };
  };
  const card = (p) => p.evaluate(() => {
    const c = document.getElementById('oav-p5-drums'); if (!c) return null;
    const score = c.querySelector('.score');
    return { lanes: [...c.querySelectorAll('.lane-lbl')].map((e) => e.textContent), barno: (c.querySelector('.barno') || {}).textContent,
      score: score && !score.hidden ? score.textContent : null, toks: [...c.querySelectorAll('.score .tok')].map((e) => e.textContent),
      cells: c.querySelectorAll('.cell').length, part: c.querySelectorAll('.cell.part').length, marks: c.querySelectorAll('.cell i').length,
      mode: OAVp5.drums.now.mode, pattern: OAVp5.drums.pattern, state: OAVp5.drums.state, clock: OAVp5.drums.clock };
  });
  const hints = (p) => p.evaluate(() => [...OAVp5.hints].map((h) => ({ id: h.id, what: h.what, why: h.why, next: h.next, shown: !!(h.el && h.el.isConnected) })));

  for (const v of VERSIONS) {
    const first = v === VERSIONS[0];
    // 1. one line of rhythm, zh: the card, the score line lighting the word that sounds, contrast, drumPhase
    {
      const line = 'bd*4, [~ sd]*2, hh*8';
      const { ctx, p, errs } = await open(v, { line, bpm: 120 });
      await p.waitForFunction(() => window.OAVp5 && OAVp5.drums.state === 'on' && document.querySelector('#oav-p5-drums .score .tok'), null, { timeout: 10000 }).catch(() => {});
      await p.mouse.click(500, 600);
      await p.waitForTimeout(4300);
      const c = await card(p);
      const r = await p.evaluate(() => window.__r);
      row(c && c.score === line && c.toks.join('|') === 'bd|sd|hh', `p5 ${v}: startDrums("${line}") shows the line over the grid, its words marked`, JSON.stringify(c && { score: c.score, toks: c.toks }));
      row(c && c.clock.clock === 'lookahead' && c.clock.heartbeat === 'worker' && /^p5 [12]\.x/.test(c.clock.preDraw || '') && c.clock.late === 0,
        `p5 ${v}: the lookahead clock: a Worker heartbeat, the callbacks right before draw()`, JSON.stringify(c && c.clock));
      row(c && c.lanes.join(',') === '大鼓,小鼓,鈸,拍手' && /^第 \d+ 小節$/.test(c.barno || ''), `p5 ${v}: zh lanes 大鼓 小鼓 鈸 拍手 and the bar number on the card`, JSON.stringify(c && { lanes: c.lanes, barno: c.barno }));
      const has = (xs, s, e) => xs.length > 0 && xs.every((x) => x.tokens.some((t) => t.start === s && t.end === e));
      row(has(r.kick, 0, 2) && has(r.snare, 9, 11) && has(r.hat, 16, 18) && r.kick.length >= 7 && r.snare.length >= 3,
        `p5 ${v}: in kickDetected "bd" is lit, in snareDetected "sd", in hatDetected "hh" (OAVp5.drums.now.tokens)`, `kicks ${r.kick.length}, snares ${r.snare.length}, hats ${r.hat.length}`);
      row(r.kick.length > 2 && r.kick.slice(1).every((k) => k.beat < 0.1), `p5 ${v}: beatPhase is ~0 in the frame a kick is heard`, r.kick.map((k) => k.beat.toFixed(3)).join(' '));
      const ph = r.phases.filter((x, i, a) => i && a[i - 1][0] === x[0]);
      row(ph.length > 20 && ph.every((x, i) => i === 0 || ph[i - 1][0] !== x[0] || x[1] >= ph[i - 1][1] - 1e-9), `p5 ${v}: drumPhase rises through each bar`, `${ph.length} samples`);
      const col = await p.evaluate(async () => {
        const st = (el) => getComputedStyle(el);
        const now = document.querySelector('#oav-p5-drums .cell.now:not(.on)'), on = document.querySelector('#oav-p5-drums .cell.on.now');
        const tok = document.querySelector('#oav-p5-drums .score .tok'); tok.classList.add('lit'); const lit = st(tok); const out = { litFg: lit.color, litBg: lit.backgroundColor };
        tok.classList.remove('lit');
        // the line's own colour for the unlit word (a token may be lit again by the next hit while we look)
        return { ...out, text: st(document.querySelector('#oav-p5-drums .score')).color, card: st(document.getElementById('oav-p5-drums')).backgroundColor, outline: now ? st(now).outlineColor : null, nowBg: now ? st(now).backgroundColor : null, onNow: on ? st(on).backgroundColor : null };
      });
      const cardBg = over(rgb(col.card), [17, 17, 17]);
      const cs = { litWord: contrast(rgb(col.litFg), over(rgb(col.litBg), cardBg)), word: contrast(over(rgb(col.text), cardBg), cardBg),
        nowOutlineOnCard: contrast(rgb(col.outline || 'rgb(0,0,0)'), cardBg), nowOutlineOnCell: contrast(rgb(col.outline || 'rgb(0,0,0)'), rgb(col.nowBg || 'rgb(0,0,0)')) };
      row(Object.values(cs).every((x) => x >= 4.5), `p5 ${v}: contrast on the dark card ≥ 4.5:1 (lit word, word, the column that sounds)`, Object.entries(cs).map(([k, x]) => `${k} ${x.toFixed(1)}`).join(', '));
      if (first) {
        await p.waitForFunction(() => OAVp5.drums.now.tokens.length > 0, null, { timeout: 3000, polling: 5 }).catch(() => {});
        await p.screenshot({ path: path.join(SHOTS, 'rhythm-score-zh.png') });
        await p.locator('#oav-p5-drums').screenshot({ path: path.join(SHOTS, 'rhythm-score-zh-card.png') });
      }
      // the cells take over
      await p.evaluate(() => { const lanes = [...document.querySelectorAll('#oav-p5-drums .lane-lbl')]; const i = [...lanes[0].parentNode.children].indexOf(lanes[0]); lanes[0].parentNode.children[i + 3].click(); });
      await p.waitForTimeout(300);
      const t = await card(p), h = await hints(p);
      const ho = h.find((x) => x.id === 'rhythmTakeover');
      row(t.mode === 'grid' && t.pattern === 'custom' && t.score === null && ho && ho.shown && /格子接手了/.test(ho.what), `p5 ${v}: a click on a cell: the cells take over (the grid it was playing, one card)`, JSON.stringify({ mode: t.mode, pattern: t.pattern, hint: ho && ho.why }));
      if (first) await p.screenshot({ path: path.join(SHOTS, 'rhythm-takeover-zh.png') });
      row(errs.length === 0, `p5 ${v}: no page errors`, errs.join(' | ').slice(0, 300));
      await ctx.close();
    }
    // 2. triplets, a Euclidean kick, a crash the grid has no lane for
    {
      const line = 'bd(3,8), [sd sd sd]*2, cr ~';
      const { ctx, p, errs } = await open(v, { line, bpm: 100 });
      await p.waitForFunction(() => window.OAVp5 && OAVp5.drums.state === 'on' && document.querySelector('#oav-p5-drums .score .tok'), null, { timeout: 10000 }).catch(() => {});
      await p.mouse.click(500, 600);
      await p.waitForTimeout(2600);
      const c = await card(p), r = await p.evaluate(() => window.__r);
      row(c.lanes.join(',') === '大鼓,小鼓,鈸,拍手,碎音鈸' && c.part >= 2 && c.marks >= 4, `p5 ${v}: a row for the crash, triplets drawn where they fall inside their 16ths`, JSON.stringify({ lanes: c.lanes, part: c.part, marks: c.marks }));
      row(r.hits.crash >= 1 && r.kick.length >= 3, `p5 ${v}: the crash is heard and calls drumHit('crash'); (3,8) kicks call kickDetected`, JSON.stringify(r.hits));
      if (first) await p.screenshot({ path: path.join(SHOTS, 'rhythm-triplets-zh.png') });
      row(errs.length === 0, `p5 ${v}: triplets: no page errors`, errs.join(' | ').slice(0, 300));
      await ctx.close();
    }
    // 3. a mistake: the card says where and how, the machine plays four on floor
    {
      const { ctx, p, errs } = await open(v, { line: 'bd [sd', bpm: 120 });
      await p.waitForFunction(() => window.OAVp5 && OAVp5.drums.state === 'on', null, { timeout: 10000 }).catch(() => {});
      await p.waitForTimeout(600);
      const c = await card(p), h = (await hints(p)).find((x) => /^rhythm:/.test(x.id));
      row(h && h.shown && h.what === '節奏字串第 4 個字有問題' && /補上 \]/.test(h.next) && c.pattern === 'four on floor' && c.state === 'on',
        `p5 ${v}: "bd [sd": a card (which character, how to fix it), four on floor plays`, JSON.stringify({ what: h && h.what, why: h && h.why, pattern: c.pattern }));
      if (first) await p.screenshot({ path: path.join(SHOTS, 'rhythm-error-zh.png') });
      row(errs.length === 0, `p5 ${v}: mistake: no page errors`, errs.join(' | ').slice(0, 300));
      await ctx.close();
    }
    // 4. drums=frame (the safety net) with a line: 16 steps of bar 1 on the grid, the line shown
    {
      const { ctx, p, errs } = await open(v, { line: 'bd*4, [~ sd]*2, hh*8', bpm: 120, opts: JSON.stringify({ drums: 'frame' }) });
      await p.waitForFunction(() => window.OAVp5 && OAVp5.drums.state === 'on', null, { timeout: 10000 }).catch(() => {});
      await p.waitForTimeout(2500);
      const c = await card(p), r = await p.evaluate(() => window.__r);
      row(c.clock.clock === 'frame' && c.score === 'bd*4, [~ sd]*2, hh*8' && r.kick.length >= 4 && r.bars.length >= 1, `p5 ${v}: ?oav_drums=frame plays the line on the frame clock`, JSON.stringify({ clock: c.clock.clock, kicks: r.kick.length }));
      row(errs.length === 0, `p5 ${v}: frame: no page errors`, errs.join(' | ').slice(0, 300));
      await ctx.close();
    }
    // 5. English page: lanes and the card in English
    {
      const { ctx, p } = await open(v, { line: 'bd kik', bpm: 120 }, { locale: 'en-US' });
      await p.waitForFunction(() => window.OAVp5 && OAVp5.drums.state === 'on', null, { timeout: 10000 }).catch(() => {});
      await p.waitForTimeout(500);
      const c = await card(p), h = (await hints(p)).find((x) => /^rhythm:/.test(x.id));
      row(c.lanes.join(',') === 'kick,snare,hat,clap' && h && /character 4/.test(h.what) && /No drum called "kik"/.test(h.why), `p5 ${v}: en: lanes and the card in English`, JSON.stringify({ lanes: c.lanes, what: h && h.what }));
      await ctx.close();
    }
  }

  // 6. the course's Demo 2 (lesson 4), unchanged: kickDetected is called, the cues come in order and change the rhythm
  if (DEMOS) {
    for (const step of ['step1.js', 'step2.js', 'step3.js']) {
      const { ctx, p, errs } = await open(VERSIONS[VERSIONS.length - 1], { demo: step });
      await p.waitForFunction(() => window.OAVp5 && OAVp5.drums.state === 'on', null, { timeout: 10000 }).catch(() => {});
      await p.mouse.click(500, 650);
      await p.waitForTimeout(step === 'step3.js' ? 19000 : 3000);
      const d = await p.evaluate(() => ({ ...window.__d, bar: drumBar, cue: cueName, pattern: OAVp5.drums.pattern }));
      if (step === 'step3.js') {
        row(d.kick > 10 && d.cues.join(',') === 'calm@1:half time,bloom@5:half time,storm@9:latin' && d.cue === 'storm' && d.pattern === 'breakbeat',
          `Demo 2 ${step}: kickDetected, cues calm → bloom → storm at bars 1, 5, 9, each switching the rhythm`, JSON.stringify(d));
      } else row(d.kick >= 4 && d.bar >= 2, `Demo 2 ${step}: kickDetected is called, drumBar counts`, JSON.stringify(d));
      if (step === 'step3.js') await p.screenshot({ path: path.join(SHOTS, 'demo2-step3.png') });
      row(errs.length === 0, `Demo 2 ${step}: no page errors`, errs.join(' | ').slice(0, 300));
      await ctx.close();
    }
  }
  await b.close(); srv.close();
  console.log(bad ? `\n${bad} check(s) failed` : '\nall checks passed');
  process.exit(bad ? 1 : 0);
})();
