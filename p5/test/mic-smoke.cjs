#!/usr/bin/env node
// mic-smoke.cjs — oav-p5.js's microphone in a real (headless) Chromium with a fake microphone, p5 1.x and 2.x.
// Not part of `npm test` (needs a browser): run it by hand before publishing a tag.
//
//   P5_DIR=<dir with p5-1.11.11.min.js, p5-2.0.5.min.js, p5-2.3.4full.min.js, p5sound-1.11.11.min.js, p5sound-0.4.1.min.js>
//   PW=<path to playwright(-core)> node p5/test/mic-smoke.cjs
//
// Per p5 version it checks: a sketch that reads nothing from the microphone never asks for it (and the page prints no
// error); examples/mic/sketch.js — micLevel / bass / mid / treble get values, `beat` and beatDetected() fire on the fake
// device's beeps, the 🎹 panel has a 🎤 button that turns it off and on; a refused microphone leaves every read at 0 with
// no page error; p5.sound on the same page (1.x addon, 0.4.1 for 2.x) keeps working beside it, and none of our names is
// a p5 or p5.sound name. No MIDI permission is given, no MIDI port is opened, and port 7457 is blocked.
const fs = require('fs'), path = require('path'), http = require('http');
const PW = require(process.env.PW || 'playwright');
const ROOT = path.resolve(__dirname, '../..');
const OAV = process.env.OAV_ROOT || ROOT;   // OAV_ROOT=<another checkout>: run the same checks against it (the red run on the old file)
const P5_DIR = process.env.P5_DIR || path.join(ROOT, 'p5/test/vendor');
const SHOTS = process.env.SHOTS || __dirname;
const MIC_SKETCH = fs.readFileSync(path.join(ROOT, 'p5/examples/mic/sketch.js'), 'utf8');
const PLAIN_SKETCH = fs.readFileSync(path.join(ROOT, 'p5/examples/particles/sketch.js'), 'utf8');
const VERSIONS = (process.env.P5_VERSIONS || '1.11.11,2.0.5,2.3.4full').split(',');
const OURS = ['micLevel', 'micIsOn', 'startMic', 'stopMic', 'micSensitivity', 'bass', 'mid', 'treble', 'beat', 'beatDetected', 'kickDetected', 'snareDetected', 'hatDetected'];
const MIME = { '.js': 'text/javascript', '.json': 'application/json', '.html': 'text/html', '.css': 'text/css' };
const soundFor = (v) => (v.startsWith('1.') ? 'p5sound-1.11.11.min.js' : 'p5sound-0.4.1.min.js');

let bad = 0;
const row = (ok, name, extra) => { if (!ok) bad++; console.log(`${ok ? '✅' : '❌'} ${name}${!ok && extra ? '  ' + extra : ''}`); };

(async () => {
  const srv = http.createServer((q, r) => {
    const u = new URL(q.url, 'http://x');
    const send = (type, body) => { r.setHeader('Content-Type', type); r.setHeader('Access-Control-Allow-Origin', '*'); r.end(body); };
    const q1 = (k) => u.searchParams.get(k);
    if (u.pathname === '/page') {
      const v = q1('v'), kind = q1('kind'), sound = q1('sound') === '1';
      return send('text/html', `<!doctype html><meta charset="utf-8"><style>body{margin:0}</style>
<script>window.OAV_P5 = { hardware: 'off', relay: 'ws://127.0.0.1:1/relay' };
window.__gum = 0; { const g = navigator.mediaDevices && navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  if (g) navigator.mediaDevices.getUserMedia = (...a) => { window.__gum++; return g(...a); }; }</script>
<script src="/p5/p5-${v}.min.js"></script>${sound ? `<script src="/p5/${soundFor(v)}"></script>` : ''}<script src="/sketch.js?kind=${kind}&sound=${sound ? 1 : 0}"></script>`);
    }
    if (u.pathname === '/bare') {   // p5 (and p5.sound) with nothing of ours: which names are already taken?
      const v = q1('v');
      return send('text/html', `<!doctype html><meta charset="utf-8"><script src="/p5/p5-${v}.min.js"></script><script src="/p5/${soundFor(v)}"></script>
<script>function setup(){createCanvas(100,100);}function draw(){}</script>`);
    }
    if (u.pathname === '/sketch.js') {
      const kind = q1('kind'), sound = q1('sound') === '1';
      let code = (kind === 'plain' ? PLAIN_SKETCH : MIC_SKETCH).replace('https://openaudiovisual.com/p5/oav-p5.js', '/oav/p5/oav-p5.js');
      if (kind === 'mic') code += `
;window.__seen = { maxLevel: 0, maxBass: 0, maxMid: 0, maxTreble: 0, beatFrames: 0, beatCalls: 0, frames: 0, levelAtFirstFrame: null };
function beatDetected(level) { window.__seen.beatCalls++; window.__seen.lastBeatLevel = level; }
;(() => { const d = draw; draw = function () { d(); const s = window.__seen; s.frames++;
  if (s.levelAtFirstFrame === null) s.levelAtFirstFrame = micLevel;
  s.maxLevel = Math.max(s.maxLevel, micLevel); s.maxBass = Math.max(s.maxBass, bass); s.maxMid = Math.max(s.maxMid, mid); s.maxTreble = Math.max(s.maxTreble, treble);
  if (beat) s.beatFrames++; }; })();`;
      if (kind === 'own') code = `document.head.prepend(Object.assign(document.createElement('script'), { src: '/oav/p5/oav-p5.js' }));
let bass = 5; var mid; mid = 7; treble = 9; var beat = 11; function micLevel() { return 'mine'; }
function setup(){createCanvas(100,100);} function draw(){ window.__own = { bass, mid, treble, beat, fn: typeof micLevel }; }`;
      if (kind === 'denied') code = `document.head.prepend(Object.assign(document.createElement('script'), { src: '/oav/p5/oav-p5.js' }));
function setup(){createCanvas(300,200);} function draw(){ background(micLevel*255, bass*255, 40); }`;
      if (sound) code += `
;window.__snd = { ok: false };
;(() => { const s = setup; setup = function () { s(); try { const m = new p5.AudioIn(); m.start(); window.__snd.mic = m; window.__snd.ok = true; window.__snd.ctx = typeof getAudioContext === 'function'; } catch (e) { window.__snd.err = String(e); } }; })();`;
      return send('text/javascript', code);
    }
    if (u.pathname.startsWith('/p5/')) { const f = path.join(P5_DIR, u.pathname.slice(4)); if (!fs.existsSync(f)) { r.writeHead(404); return r.end(); } return send('text/javascript', fs.readFileSync(f)); }
    if (u.pathname.startsWith('/oav/')) {
      const f = path.join(OAV, decodeURIComponent(u.pathname.slice(5)));
      if (!f.startsWith(OAV) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); }
      return send(MIME[path.extname(f)] || 'application/octet-stream', fs.readFileSync(f));
    }
    r.writeHead(404); r.end();
  });
  await new Promise((ok) => srv.listen(+(process.env.PORT || 0), '127.0.0.1', ok));
  const base = `http://127.0.0.1:${srv.address().port}`;
  const exe = process.env.CHROME;
  // Chrome 151 (headless) answers an un-allowed getUserMedia with NotSupportedError, not the NotAllowedError a person who clicks "Block" gets: say what "Block" looks like.
  const REFUSE_MIC = () => { const md = navigator.mediaDevices; if (md) md.getUserMedia = () => Promise.reject(new DOMException('Permission denied', 'NotAllowedError')); };
  const launch = (extra) => PW.chromium.launch({ executablePath: exe && fs.existsSync(exe) ? exe : undefined, headless: true, args: ['--use-fake-device-for-media-stream', ...extra] });
  const okBrowser = await launch(['--use-fake-ui-for-media-stream']);      // the fake microphone, "Allow" pressed for us
  const noBrowser = await launch([]);                                      // the same, but nobody allows: the prompt is dismissed
  const watch = async (ctx, errs, baseline = new Set()) => {
    await ctx.routeWebSocket(/:7457/, (ws) => ws.close());
    ctx.on('page', (p) => {
      p.on('pageerror', (e) => errs.push(e.message));
      p.on('console', (m) => { const t = m.text(); if (m.type() === 'error' && !/Failed to load resource|favicon/.test(t) && !baseline.has(t)) errs.push('console: ' + t); if (/redeclared|🌸 p5\.js says/.test(t) && !baseline.has(t)) errs.push('p5 FES: ' + t.slice(0, 160)); });
    });
  };

  for (const v of VERSIONS) {
    // what p5 (and p5.sound) alone already say and own
    const bctx = await okBrowser.newContext(); const bp = await bctx.newPage(); const baseline = new Set();
    bp.on('console', (m) => { if (m.type() === 'error' || /🌸/.test(m.text())) baseline.add(m.text()); });
    await bp.goto(`${base}/bare?v=${v}`); await bp.waitForTimeout(1000);
    const taken = await bp.evaluate((ours) => ours.filter((n) => n in window || n in p5.prototype), OURS);
    row(taken.length === 0, `p5 ${v}: none of our ${OURS.length} names is a p5 / p5.sound name`, JSON.stringify(taken));
    await bctx.close();

    // 1. a sketch that does not read the microphone never asks for it
    {
      const errs = []; const ctx = await noBrowser.newContext({ viewport: { width: 900, height: 600 } }); await watch(ctx, errs, baseline);
      const p = await ctx.newPage(); await p.goto(`${base}/page?v=${v}&kind=plain`); await p.waitForTimeout(1500);
      await p.mouse.click(300, 300); await p.keyboard.press('a'); await p.waitForTimeout(300);
      const s = await p.evaluate(() => ({ gum: window.__gum, state: OAVp5.mic.state, on: micIsOn, fc: frameCount, names: ['micLevel', 'bass', 'mid', 'treble', 'beat'].filter((n) => Object.keys(window).includes(n)) }));
      row(s.gum === 0 && s.state === 'off' && s.on === false && s.fc > 10, `p5 ${v}: a sketch that never reads the microphone never asks for it`, JSON.stringify(s));
      row(s.names.length === 0, `p5 ${v}: the mic names are not enumerable`, JSON.stringify(s.names));
      row(errs.length === 0, `p5 ${v}: …and no page errors`, errs.join(' | ').slice(0, 300));
      await ctx.close();
    }

    // 1b. sketches that already have these names (let, var, function, an assignment) keep them and never wake the microphone
    {
      const errs = []; const ctx = await okBrowser.newContext({ viewport: { width: 400, height: 300 } }); await watch(ctx, errs, baseline);
      const p = await ctx.newPage(); await p.goto(`${base}/page?v=${v}&kind=own`); await p.waitForTimeout(1500);
      const s = await p.evaluate(() => ({ gum: window.__gum, state: OAVp5.mic.state, seen: window.__own }));
      row(s.gum === 0 && s.state === 'off' && s.seen && s.seen.bass === 5 && s.seen.mid === 7 && s.seen.treble === 9 && s.seen.beat === 11 && s.seen.fn === 'function', `p5 ${v}: a sketch's own bass / mid / treble / beat / micLevel are kept and the microphone stays off`, JSON.stringify(s));
      row(errs.length === 0, `p5 ${v}: …no page errors`, errs.join(' | ').slice(0, 300));
      await ctx.close();
    }

    // 2. examples/mic with the fake microphone (+ the 🎤 button), with and without p5.sound next to it
    for (const sound of [false, true]) {
      const tag = `p5 ${v}${sound ? ' + p5.sound' : ''}`;
      const errs = []; const ctx = await okBrowser.newContext({ viewport: { width: 900, height: 600 } });
      await watch(ctx, errs, baseline);
      const p = await ctx.newPage(); await p.goto(`${base}/page?v=${v}&kind=mic&sound=${sound ? 1 : 0}`);
      await p.waitForFunction(() => window.micIsOn === true, null, { timeout: 8000 }).catch(() => {});
      await p.waitForTimeout(4500);   // the fake device beeps about once a second
      const s = await p.evaluate(() => ({ ...window.__seen, state: OAVp5.mic.state, gum: window.__gum, on: micIsOn, snd: window.__snd && { ok: window.__snd.ok, err: window.__snd.err },
        sameCtx: window.__snd && typeof getAudioContext === 'function' ? getAudioContext() === OAVp5.mic.analyzer.ctx : null,
        ctxState: OAVp5.mic.analyzer && OAVp5.mic.analyzer.ctx.state }));
      row(s.state === 'on' && s.on === true && s.gum === (sound ? 2 : 1), `${tag}: the first read of micLevel turned the microphone on (we asked once; p5.AudioIn asks for its own)`, JSON.stringify(s));
      row(s.levelAtFirstFrame === 0, `${tag}: the very first read is 0 (not undefined, not NaN)`, JSON.stringify(s.levelAtFirstFrame));
      row(s.maxLevel > 0 && s.maxLevel <= 1 && s.maxBass > 0 && s.maxBass <= 1 && s.maxMid >= 0 && s.maxTreble >= 0, `${tag}: micLevel and the bands have values in 0..1`, JSON.stringify(s));
      row(s.beatCalls >= 1 && s.beatFrames >= 1 && s.beatCalls >= s.beatFrames, `${tag}: beatDetected() was called and \`beat\` was true for a frame`, `calls=${s.beatCalls} frames=${s.beatFrames}`);
      if (sound) row(s.snd && s.snd.ok && s.sameCtx === false, `${tag}: p5.AudioIn() starts beside it, on another AudioContext`, JSON.stringify({ snd: s.snd, same: s.sameCtx }));
      // the 🎹 panel carries a 🎤
      await p.click('#oav-p5-button');
      await p.waitForSelector('#oav-p5-mic', { timeout: 5000 });
      const t1 = await p.evaluate(() => document.getElementById('oav-p5-mic').textContent);
      row(/🎤/.test(t1) && /關|off/i.test(t1), `${tag}: 🎹 panel has a 🎤 button that says it can turn the microphone off`, t1);
      if (v === VERSIONS[0] && !sound) {
        await p.waitForTimeout(600);
        await p.screenshot({ path: path.join(SHOTS, 'smoke-mic-panel.png') });
      }
      await p.click('#oav-p5-mic'); await p.waitForTimeout(400);
      const off = await p.evaluate(() => ({ state: OAVp5.mic.state, on: micIsOn, lvl: micLevel, text: document.getElementById('oav-p5-mic').textContent }));
      row(off.state === 'off' && off.on === false && off.lvl === 0 && off.state === 'off', `${tag}: 🎤 turns it off, the reads fall back to 0 and do not turn it on again`, JSON.stringify(off));
      await p.click('#oav-p5-mic');
      await p.waitForFunction(() => micIsOn === true, null, { timeout: 5000 }).catch(() => {});
      await p.waitForTimeout(1200);
      const again = await p.evaluate(() => ({ state: OAVp5.mic.state, lvl: micLevel }));
      row(again.state === 'on', `${tag}: …and on again`, JSON.stringify(again));
      if (v === VERSIONS[0] && !sound) {
        await p.click('#oav-p5-mic'); await p.click('#oav-p5-button');   // panel closed, microphone on: the sketch alone
        await p.evaluate(() => OAVp5.mic.start()); await p.waitForTimeout(2200);
        await p.screenshot({ path: path.join(SHOTS, 'smoke-mic.png') });
      }
      row(errs.length === 0, `${tag}: no page errors`, errs.join(' | ').slice(0, 400));
      await ctx.close();
    }

    // 3. a refused microphone: reads stay 0, nothing throws, the 🎤 says why
    {
      const errs = []; const ctx = await noBrowser.newContext({ viewport: { width: 700, height: 500 } }); await ctx.addInitScript(REFUSE_MIC); await watch(ctx, errs, baseline);
      const p = await ctx.newPage(); await p.goto(`${base}/page?v=${v}&kind=denied`); await p.waitForTimeout(2000);
      const s = await p.evaluate(() => ({ state: OAVp5.mic.state, lvl: micLevel, bass, on: micIsOn, err: OAVp5.mic.error }));
      row(s.state === 'denied' && s.lvl === 0 && s.bass === 0 && s.on === false, `p5 ${v}: a refused microphone: state "denied", reads stay 0`, JSON.stringify(s));
      await p.click('#oav-p5-button'); await p.waitForSelector('#oav-p5-mic', { timeout: 5000 });
      await p.waitForFunction(() => OAVp5.mic.state !== 'asking', null, { timeout: 5000 });   // opening the panel is a click: the one retry
      const t = await p.evaluate(() => document.getElementById('oav-p5-mic').textContent);
      row(/🎤/.test(t) && /(擋|Blocked)/.test(t), `p5 ${v}: …and the 🎤 button says it was blocked`, t);
      if (v === VERSIONS[0]) await p.screenshot({ path: path.join(SHOTS, 'smoke-mic-denied.png') });
      row(errs.length === 0, `p5 ${v}: …with no page errors`, errs.join(' | ').slice(0, 300));
      await ctx.close();
    }
  }
  await okBrowser.close(); await noBrowser.close(); srv.close();
  console.log(bad ? `\n${bad} check(s) failed` : '\nall checks passed');
  process.exit(bad ? 1 : 0);
})();
