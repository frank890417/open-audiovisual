#!/usr/bin/env node
// timing-probe.cjs — how steady oav-p5's drums are, measured on the sound itself, in a real Chromium.
// Not part of `npm test` (needs a browser): run it by hand when the drum clock changes.
//
//   P5_DIR=<dir with p5-1.11.11.min.js> PW=<path to playwright(-core)> [CHROME=<Chrome for Testing>]
//   [OAV_OLD=<a checkout of oav-p5 0.5.0, for the side-by-side>] [SECONDS=10] [BUSY=30] [BACKGROUND=1] node p5/test/timing-probe.cjs
//
// The sketch: four on floor at 120 bpm, humanize 0, and a draw() that keeps the main thread busy BUSY ms every frame (a heavy
// sketch, ~25 fps). The kit's output goes into an AudioWorklet that notes the sample frame of every onset (the first sample
// above -34 dBFS after 100 ms of quiet), for SECONDS seconds. Reported: the spread (standard deviation) of the intervals
// between onsets, kick to kick (the same drum, so the same attack: pure timing) and between all onsets (every 8th: hats
// between the kicks), the worst deviation, onsets missing, and the frame rate the sketch got. Rows: this checkout on its
// lookahead clock, this checkout with drums=frame (the safety net), and oav-p5 0.5.0 when OAV_OLD is given.
// BACKGROUND=1 adds a headed run (CHROME= required): the drums play, another tab comes to the front for 30 s, then the drums'
// tab again — onsets heard while hidden, drumBar against the time that passed, the callbacks told while hidden, and how many
// arrive in the first 100 ms back (no flood). Playwright keeps every page "visible" (its focus emulation), so this part
// drives a plain Chrome over the DevTools protocol: real tabs, Chrome's own background throttling.
const fs = require('fs'), path = require('path'), http = require('http'), os = require('os');
const { spawn } = require('child_process');
const PW = require(process.env.PW || 'playwright');
const ROOT = path.resolve(__dirname, '../..');
const P5_DIR = process.env.P5_DIR || path.join(ROOT, 'p5/test/vendor');
const SECONDS = +(process.env.SECONDS || 10), BUSY = +(process.env.BUSY ?? 30), BPM = 120;
const OLD = process.env.OAV_OLD || '';
const MIME = { '.js': 'text/javascript', '.json': 'application/json', '.html': 'text/html' };

const SKETCH = `
window.__probe = { frames: 0, kicks: 0, bars: [], hidden: { kicks: 0, bars: 0, steps: 0 }, back: [] };
function setup() { createCanvas(320, 200); startDrums('four on floor', ${BPM}); }
function draw() {
  const t0 = performance.now(); while (performance.now() - t0 < (window.__busy || 0)) {}   // a heavy sketch
  window.__probe.frames++;
  background(20); fill(255); circle(160, 100, 40 + 60 * (typeof beatPhase === 'number' ? 1 - beatPhase : 0));
}
function kickDetected() { const p = window.__probe; p.kicks++; if (document.hidden) p.hidden.kicks++; p.back.push(performance.now()); }
function barStarted(b) { const p = window.__probe; p.bars.push(b); if (document.hidden) p.hidden.bars++; }
function stepStarted() { if (document.hidden) window.__probe.hidden.steps++; }`;

// onsets on the audio thread: sample-frame exact, never held up by the busy main thread
const WORKLET = `class Onset extends AudioWorkletProcessor {
  constructor() { super(); this.last = -1e12; this.quiet = 0; }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (ch) for (let i = 0; i < ch.length; i++) {
      const f = currentFrame + i, x = Math.abs(ch[i]);
      if (x > 0.02) { if (f - this.last > sampleRate * 0.1) this.port.postMessage(f); this.last = f; }
    }
    return true;
  }
}
registerProcessor('oav-onset', Onset);`;

const stats = (xs) => { const m = xs.reduce((a, b) => a + b, 0) / xs.length; return { mean: m, sd: Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length), worst: Math.max(...xs.map((x) => Math.abs(x - m))) }; };
const ms = (s) => (s * 1000).toFixed(3);

(async () => {
  const roots = { new: ROOT, old: OLD };
  const srv = http.createServer((q, r) => {
    const u = new URL(q.url, 'http://x');
    const send = (type, body) => { r.setHeader('Content-Type', type); r.end(body); };
    if (u.pathname === '/page') {
      const tree = u.searchParams.get('tree'), opts = u.searchParams.get('opts') || '{}';
      return send('text/html', `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#111">
<script>window.__busy = ${+u.searchParams.get('busy') || 0}; window.OAV_P5 = Object.assign({ hardware: 'off', relay: 'ws://127.0.0.1:1/relay' }, ${opts});</script>
<script src="/${tree}/p5/oav-p5.js"></script><script src="/p5/p5-1.11.11.min.js"></script><script src="/sketch.js"></script>`);
    }
    if (u.pathname === '/sketch.js') return send('text/javascript', SKETCH);
    if (u.pathname.startsWith('/p5/')) { const f = path.join(P5_DIR, u.pathname.slice(4)); return fs.existsSync(f) ? send('text/javascript', fs.readFileSync(f)) : (r.writeHead(404), r.end()); }
    const m = /^\/(new|old)\/(.*)$/.exec(u.pathname);
    if (m && roots[m[1]]) {
      const base = roots[m[1]], f = path.join(base, decodeURIComponent(m[2]));
      if (!f.startsWith(base) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); }
      return send(MIME[path.extname(f)] || 'application/octet-stream', fs.readFileSync(f));
    }
    r.writeHead(404); r.end();
  });
  await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
  const base = `http://127.0.0.1:${srv.address().port}`;
  const exe = process.env.CHROME;
  const launch = (headless) => PW.chromium.launch({ executablePath: exe && fs.existsSync(exe) ? exe : undefined, headless,
    // Playwright turns off Chrome's background throttling by default; a probe of background behaviour needs it back on
    ignoreDefaultArgs: ['--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'],
    args: ['--autoplay-policy=user-gesture-required'] });

  /** open a page, let it run, click (the gesture audio waits for), tap the kit's output with the onset worklet */
  const start = async (b, tree, opts, busy) => {
    const ctx = await b.newContext({ viewport: { width: 640, height: 480 }, locale: 'en-US' });
    await ctx.routeWebSocket(/127\.0\.0\.1:1\//, (ws) => ws.close());
    const p = await ctx.newPage(); const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(`${base}/page?tree=${tree}&busy=${busy}&opts=${encodeURIComponent(JSON.stringify(opts))}`);
    await p.waitForFunction(() => window.OAVp5 && OAVp5.drums.state === 'on', null, { timeout: 10000 });
    await p.mouse.click(320, 300);
    await p.waitForFunction(() => { const c = OAVp5.drums.machine.engine.context; return c && c.state === 'running' && c.currentTime > 0.2; }, null, { timeout: 10000 });
    await p.evaluate(async (src) => {
      const m = OAVp5.drums.machine, c = m.engine.context;
      m.seq.humanize = 0;                                             // the probe measures the clock, not the groove
      await c.audioWorklet.addModule(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
      const node = new AudioWorkletNode(c, 'oav-onset'), sink = c.createGain(); sink.gain.value = 0;
      m.engine.output.connect(node); node.connect(sink); sink.connect(c.destination);
      window.__onsets = []; window.__rate = c.sampleRate;
      node.port.onmessage = (e) => window.__onsets.push(e.data);
      window.__probe.frames = 0; window.__t0 = performance.now();
    }, WORKLET);
    return { ctx, p, errs };
  };
  const measure = async (b, label, tree, opts) => {
    const { ctx, p, errs } = await start(b, tree, opts, BUSY);
    await p.waitForTimeout(SECONDS * 1000 + 300);
    const d = await p.evaluate(() => ({ onsets: window.__onsets.slice(), rate: window.__rate, frames: window.__probe.frames, secs: (performance.now() - window.__t0) / 1000,
      clock: OAVp5.drums.clock, version: OAVp5.version }));
    await ctx.close();
    // the first two onsets are left out: hits handed over before the probe set humanize to 0 (up to 5 ms late on purpose)
    const t = d.onsets.slice(2).map((f) => f / d.rate), all = t.slice(1).map((x, i) => x - t[i]);
    // kick to kick: every other onset (the 8ths alternate kick+hat and hat alone); take the phase whose intervals sit near 0.5 s
    const pick = (o) => t.filter((_, i) => i % 2 === o).slice(1).map((x, i, a) => x - t.filter((_, j) => j % 2 === o)[i]);
    const k0 = pick(0), k1 = pick(1), kicks = Math.abs(stats(k0).mean - 0.5) < Math.abs(stats(k1).mean - 0.5) ? k0 : k1;
    const expected = Math.floor(SECONDS * BPM / 30) - 2;             // 8ths, less the two left out
    return { label, version: d.version, clock: d.clock, onsets: t.length, expected, fps: d.frames / d.secs, all: stats(all), kick: stats(kicks), errs };
  };

  const rows = [];
  const b = await launch(true);
  rows.push(await measure(b, 'lookahead (default)', 'new', {}));
  rows.push(await measure(b, 'drums=frame (safety net)', 'new', { drums: 'frame' }));
  if (OLD) rows.push(await measure(b, 'oav-p5 0.5.0', 'old', {}));
  await b.close();
  console.log(`\n120 bpm four on floor, humanize 0, draw() busy ${BUSY} ms a frame, ${SECONDS} s recorded on the kit's output (AudioWorklet, sample-frame onsets)\n`);
  console.log('| run | version | fps | onsets (expected) | kick→kick sd (ms) | worst (ms) | all 8ths sd (ms) | worst (ms) | heartbeat | lookahead | late |');
  console.log('|---|---|---|---|---|---|---|---|---|---|---|');
  for (const r of rows) {
    const c = r.clock || {};
    console.log(`| ${r.label} | ${r.version} | ${r.fps.toFixed(1)} | ${r.onsets} (${r.expected}) | ${ms(r.kick.sd)} | ${ms(r.kick.worst)} | ${ms(r.all.sd)} | ${ms(r.all.worst)} | ${c.heartbeat || '—'} | ${c.lookahead ?? '—'} | ${c.late ?? '—'} |`);
    if (r.errs.length) console.log('   page errors: ' + r.errs.join(' | ').slice(0, 300));
  }
  const goal = rows[0].kick.sd < 0.001 && rows[0].all.sd < 0.001 && rows[0].onsets >= rows[0].expected;
  console.log(goal ? '\n✅ lookahead: spread under 1 ms' : '\n❌ lookahead: spread at or over 1 ms (or onsets missing)');

  if (process.env.BACKGROUND === '1') await background(base);
  srv.close();
  process.exit(goal ? 0 : 1);
})();

/** a plain Chrome over the DevTools protocol (Node 22's WebSocket): two tabs in one window, the second one brought forward */
async function background(base) {
  console.log('\nBackground tab (headed Chrome, its own throttling): 30 s behind another tab, then back\n');
  const exe = process.env.CHROME;
  if (!exe) { console.log('(skipped: CHROME= not set)'); return; }
  const runs = [['lookahead (default)', 'new', {}], ['drums=frame', 'new', { drums: 'frame' }]].concat(OLD ? [['oav-p5 0.5.0', 'old', {}]] : []);
  for (const [label, tree, opts] of runs) {
    const ud = fs.mkdtempSync(path.join(os.tmpdir(), 'oav-probe-'));
    const ch = spawn(exe, ['--remote-debugging-port=0', '--user-data-dir=' + ud, '--no-first-run', '--no-default-browser-check', '--window-size=800,600', 'about:blank']);
    const url = await new Promise((ok) => ch.stderr.on('data', (d) => { const m = /DevTools listening on (ws:\S+)/.exec(String(d)); if (m) ok(m[1]); }));
    const sock = new WebSocket(url); await new Promise((ok) => sock.addEventListener('open', ok));
    let id = 0; const wait = new Map();
    sock.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && wait.has(m.id)) { wait.get(m.id)(m); wait.delete(m.id); } });
    const send = (method, params = {}, sessionId) => new Promise((ok) => { const i = ++id; wait.set(i, ok); sock.send(JSON.stringify({ id: i, method, params, sessionId })); });
    const sleep = (t) => new Promise((r) => setTimeout(r, t));
    const A = (await send('Target.createTarget', { url: `${base}/page?tree=${tree}&busy=0&opts=${encodeURIComponent(JSON.stringify(opts))}` })).result.targetId;
    const sa = (await send('Target.attachToTarget', { targetId: A, flatten: true })).result.sessionId;
    const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }, sa); return r.result && r.result.result ? r.result.result.value : r; };
    for (let i = 0; i < 50 && !(await ev("!!(window.OAVp5 && OAVp5.drums.state === 'on')")); i++) await sleep(200);
    for (const type of ['mousePressed', 'mouseReleased']) await send('Input.dispatchMouseEvent', { type, x: 320, y: 300, button: 'left', clickCount: 1 }, sa);
    for (let i = 0; i < 50 && !(await ev('(() => { const c = OAVp5.drums.machine.engine.context; return !!c && c.state === "running" && c.currentTime > 0.2; })()')); i++) await sleep(200);
    await ev(`(async () => {
      const m = OAVp5.drums.machine, c = m.engine.context;
      await c.audioWorklet.addModule(URL.createObjectURL(new Blob([${JSON.stringify(WORKLET)}], { type: 'text/javascript' })));
      const node = new AudioWorkletNode(c, 'oav-onset'), sink = c.createGain(); sink.gain.value = 0;
      m.engine.output.connect(node); node.connect(sink); sink.connect(c.destination);
      window.__onsets = []; node.port.onmessage = (e) => window.__onsets.push(e.data);
      window.__told = []; const p = window.__probe;
      for (const n of ['kickDetected', 'hatDetected', 'drumHit', 'stepStarted', 'barStarted']) { const f = window[n]; window[n] = function () { window.__told.push([n, performance.now()]); return f && f.apply(this, arguments); }; }
      document.addEventListener('visibilitychange', () => { if (!document.hidden && !window.__backAt) window.__backAt = performance.now(); });
      return true; })()`);
    await sleep(2000);
    const before = await ev('({ bar: drumBar, t: performance.now(), onsets: __onsets.length })');
    const B = (await send('Target.createTarget', { url: 'about:blank' })).result.targetId;
    await send('Target.activateTarget', { targetId: B });
    await sleep(1000);
    const vis = await ev('document.visibilityState');
    const hidAt = await ev('performance.now()');
    await sleep(29000);
    const mid = await ev(`({ onsets: __onsets.length, told: __told.filter((x) => x[1] >= ${hidAt}).reduce((o, x) => (o[x[0]] = (o[x[0]] || 0) + 1, o), {}) })`);
    await send('Target.activateTarget', { targetId: A });
    await sleep(600);
    const after = await ev('({ bar: drumBar, t: performance.now(), onsets: __onsets.length, backAt: __backAt, first: __told.filter((x) => x[1] >= __backAt && x[1] < __backAt + 100).map((x) => x[0]), clock: OAVp5.drums.clock || null, version: OAVp5.version })');
    await send('Browser.close').catch(() => {}); ch.kill();
    const secs = (after.t - before.t) / 1000, bars = after.bar - before.bar;
    const hiddenSecs = (after.backAt - hidAt) / 1000;
    console.log(`${label} (${after.version}): away "${vis}"; ${mid.onsets - before.onsets} onsets heard in the first ~30 s away (${Math.round(30 * BPM / 30)} if it never stopped); ` +
      `drumBar +${bars} in ${secs.toFixed(1)} s (${(secs * BPM / 240).toFixed(1)} if it never stopped); told while hidden ${JSON.stringify(mid.told)}; ` +
      `told in the first 100 ms back: ${after.first.length ? after.first.join(', ') : 'nothing'}; heartbeat ${(after.clock && after.clock.heartbeat) || '—'}`);
  }
}
