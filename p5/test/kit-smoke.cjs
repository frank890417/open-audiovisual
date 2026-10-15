#!/usr/bin/env node
// kit-smoke.cjs — oav-p5.js's sound, drum machine and cues in a real (headless) Chromium, p5 1.x and 2.x.
// Not part of `npm test` (needs a browser and, for one check, jsDelivr): run it by hand before publishing a tag.
//
//   P5_DIR=<dir with p5-1.11.11.min.js, p5-2.0.5.min.js, p5-2.3.4full.min.js, p5sound-1.11.11.min.js, p5sound-0.4.1.min.js>
//   PW=<path to playwright(-core)> [CHROME=<Chrome for Testing>] [SHOTS=<dir>] node p5/test/kit-smoke.cjs
//
// Per p5 version it checks: none of the new names is a p5 / p5.sound name; an old sketch (examples/particles) that calls
// none of it loads no sound, no drums and no Tone.js, shows no grid, and plays exactly as before, even with the 🎹 panel
// open and a click; examples/drums puts the 16 × 4 grid at the top centre clear of the 🎹 and OPC's corner (OpenProcessing
// layout), the machine moves drumStep / drumBar, fires the cue at bar 1, calls kickDetected / drumHit / barStarted, a
// simulated hit reaches kickDetected and drumHit, its kit starts on the first click (and that click does not ask for the
// microphone the drums stand in for), and the grid moves below a 🎹 panel
// docked at the top; examples/keys with a stubbed Tone.js: no sound before the click, then midi.play(60, 0.8) reaches the
// engine and Tone (Sampler.triggerAttack at 261.6 Hz), a pad does not, the 🔊 panel row has the instrument picker; and once
// with the real Tone.js 15 from jsDelivr and the real piano samples: sound on, the piano ready, notes played, no page errors.
const fs = require('fs'), path = require('path'), http = require('http');
const PW = require(process.env.PW || 'playwright');
const ROOT = path.resolve(__dirname, '../..');
const OAV = process.env.OAV_ROOT || ROOT;   // OAV_ROOT=<another checkout>: the same checks against it (the red run on the old file)
const P5_DIR = process.env.P5_DIR || path.join(ROOT, 'p5/test/vendor');
const SHOTS = process.env.SHOTS || __dirname;
const VERSIONS = (process.env.P5_VERSIONS || '1.11.11,2.0.5,2.3.4full').split(',');
const REAL_TONE = process.env.REAL_TONE !== '0';
const SKETCH = { plain: 'particles', drums: 'drums', keys: 'keys' };
const NEW_NAMES = ['startSound', 'stopSound', 'soundIsOn', 'startDrums', 'stopDrums', 'drumsAreOn', 'drumStep', 'drumBar', 'drumBpm', 'cue', 'cueName',
  'drumHit', 'barStarted', 'stepStarted', 'cueFired', 'micSensitivity'];
const MIME = { '.js': 'text/javascript', '.json': 'application/json', '.html': 'text/html', '.css': 'text/css', '.mp3': 'audio/mpeg' };
const soundFor = (v) => (v.startsWith('1.') ? 'p5sound-1.11.11.min.js' : 'p5sound-0.4.1.min.js');

// Tone.js stand-in: every class, method and property exists and records its calls in window.__toneCalls
const STUB_TONE = `const calls = (window.__toneCalls = []);
const num = (x) => (typeof x === 'number' ? Math.round(x * 1000) / 1000 : typeof x);
function fake(path) {
  return new Proxy(function () {}, {
    get(t, k) {
      if (k === 'then' || typeof k === 'symbol') return k === Symbol.toPrimitive ? () => 0 : undefined;
      if (k === 'fromUrl') return (url) => { calls.push(['fromUrl', url]); return Promise.resolve({ get: () => ({ duration: 1 }) }); };
      if (k === 'start' && path === 'Tone') return () => { calls.push(['Tone.start']); return Promise.resolve(); };
      if (k === 'state') return 'running';
      return fake(path + '.' + k);
    },
    apply(t, self, args) { calls.push([path].concat(args.map(num))); return fake(path + '()'); },
    construct(t, args) { calls.push(['new ' + path]); return fake(path.replace(/^Tone\\./, '') + '#'); },
    set() { return true; },
  });
}
export default fake('Tone');`;

let bad = 0;
const row = (ok, name, extra) => { if (!ok) bad++; console.log(`${ok ? '✅' : '❌'} ${name}${extra ? '  ' + extra : ''}`); };
const overlap = (a, b) => a && b && !(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top);

(async () => {
  const srv = http.createServer((q, r) => {
    const u = new URL(q.url, 'http://x');
    const send = (type, body) => { r.setHeader('Content-Type', type); r.setHeader('Access-Control-Allow-Origin', '*'); r.end(body); };
    const q1 = (k) => u.searchParams.get(k);
    if (u.pathname === '/page') {
      const opts = q1('opts') || '{}';
      return send('text/html', `<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#111}</style>
<script>window.OAV_P5 = Object.assign({ hardware: 'off', relay: 'ws://127.0.0.1:1/relay' }, ${opts});</script>
<script src="/p5/p5-${q1('v')}.min.js"></script><script src="/sketch.js?kind=${q1('kind')}"></script>`);
    }
    if (u.pathname === '/bare') {
      const v = q1('v');
      return send('text/html', `<!doctype html><meta charset="utf-8"><script src="/p5/p5-${v}.min.js"></script><script src="/p5/${soundFor(v)}"></script>
<script>function setup(){createCanvas(100,100);}function draw(){}</script>`);
    }
    if (u.pathname === '/sketch.js') {
      const kind = q1('kind');
      let code = fs.readFileSync(path.join(ROOT, 'p5/examples', SKETCH[kind], 'sketch.js'), 'utf8').replace('https://openaudiovisual.com/p5/oav-p5.js', '/oav/p5/oav-p5.js');
      // probes: count what the sketch's own functions are called with, without changing what they do
      code += `
;window.__d = { kick: 0, hit: 0, bars: [], cues: [], steps: {}, frames: 0 };
;(() => {
  const wrap = (name, fn) => { const f = window[name]; if (typeof f === 'function') window[name] = function (...a) { fn(...a); return f.apply(this, a); }; };
  wrap('kickDetected', () => window.__d.kick++);
  wrap('drumHit', () => window.__d.hit++);
  wrap('barStarted', (b) => window.__d.bars.push(b));
  wrap('cueFired', (n, b) => window.__d.cues.push(n + '@' + b));
  wrap('draw', () => { window.__d.frames++; if (typeof drumStep === 'number') window.__d.steps[drumStep] = 1; });
})();`;
      return send('text/javascript', code);
    }
    if (u.pathname === '/stub-tone.js') return send('text/javascript', STUB_TONE);
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
  const b = await PW.chromium.launch({ executablePath: exe && fs.existsSync(exe) ? exe : undefined, headless: true });
  fs.mkdirSync(SHOTS, { recursive: true });

  /** a fresh page with error and request watching */
  const open = async (v, kind, opts = {}, viewport = { width: 1000, height: 700 }) => {
    const ctx = await b.newContext({ viewport });
    await ctx.routeWebSocket(/:7457|127\.0\.0\.1:1\//, (ws) => ws.close());
    const p = await ctx.newPage(); const errs = [], urls = [];
    p.on('pageerror', (e) => errs.push(e.message));
    p.on('console', (m) => { const t = m.text(); if (m.type() === 'error' && !/Failed to load resource|favicon/.test(t)) errs.push('console: ' + t); if (/redeclared|🌸 p5\.js says/.test(t)) errs.push('p5 FES: ' + t.slice(0, 160)); });
    p.on('request', (q) => urls.push(q.url()));
    await p.goto(`${base}/page?v=${v}&kind=${kind}&opts=${encodeURIComponent(JSON.stringify(opts))}`);
    return { ctx, p, errs, urls };
  };
  const lazy = (urls) => urls.filter((x) => /packages\/(sound|drums)\/|tone|stub-tone/i.test(x));

  for (const v of VERSIONS) {
    // 0. the names
    {
      const ctx = await b.newContext(); const p = await ctx.newPage();
      await p.goto(`${base}/bare?v=${v}`);
      await p.waitForFunction(() => typeof p5 !== 'undefined', null, { timeout: 10000 }).catch(() => {});
      await p.waitForTimeout(500);
      const taken = await p.evaluate((ours) => ours.filter((n) => n in window || n in p5.prototype), NEW_NAMES);
      row(taken.length === 0, `p5 ${v}: none of the ${NEW_NAMES.length} new names is a p5 / p5.sound name`, JSON.stringify(taken));
      await ctx.close();
    }

    // 1. an old sketch: nothing new loads, nothing new shows, it plays as before
    {
      const { ctx, p, errs, urls } = await open(v, 'plain');
      await p.waitForTimeout(1500);
      await p.mouse.click(500, 400); await p.keyboard.press('a');
      const s = await p.evaluate(() => {
        const before = particles.length;
        midi.play(60, 0.8); midi.play(60, 0); midi.input([0x99, 36, 100]); midi.input([0x89, 36, 0]);
        return { grew: particles.length - before, sound: OAVp5.sound.state, drums: OAVp5.drums.state, soundIsOn, drumsAreOn, card: !!document.getElementById('oav-p5-drums'), fc: frameCount };
      });
      await p.click('#oav-p5-button');
      await p.waitForSelector('#oav-p5-sound-button', { timeout: 5000 }).catch(() => {});
      await p.waitForTimeout(800);
      const panel = await p.evaluate(() => ({ snd: (document.getElementById('oav-p5-sound-button') || {}).textContent, drums: (document.getElementById('oav-p5-drums-button') || {}).textContent }));
      row(s.fc > 10 && s.grew > 0 && s.sound === 'off' && s.drums === 'off' && s.soundIsOn === false && s.drumsAreOn === false && !s.card,
        `p5 ${v}: an old sketch plays as before (notePressed), no sound, no drums, no grid`, JSON.stringify(s));
      row(lazy(urls).length === 0, `p5 ${v}: …and loads no @openav/sound, @openav/drums or Tone.js, even with the 🎹 panel open`, JSON.stringify(lazy(urls)));
      row(/🔊/.test(panel.snd || '') && /🥁/.test(panel.drums || ''), `p5 ${v}: …the panel offers 🔊 and 🥁`, JSON.stringify(panel));
      row(errs.length === 0, `p5 ${v}: …no page errors`, errs.join(' | ').slice(0, 300));
      await ctx.close();
    }

    // 2. examples/drums in OpenProcessing's layout (🎹 top-left, OPC's icon top-right, console at the bottom)
    {
      const { ctx, p, errs, urls } = await open(v, 'drums', { dock: 'top', corner: 'left' });
      await p.waitForFunction(() => document.querySelectorAll('#oav-p5-drums .oav-drums .cell').length === 64, null, { timeout: 8000 }).catch(() => {});
      await p.waitForTimeout(2800);                                   // > one bar at 110 bpm
      const s = await p.evaluate(() => {
        const r = (id) => { const e = document.getElementById(id); if (!e) return null; const b = e.getBoundingClientRect(); return { left: b.left, right: b.right, top: b.top, bottom: b.bottom }; };
        return { cells: document.querySelectorAll('#oav-p5-drums .oav-drums .cell').length, lanes: [...document.querySelectorAll('#oav-p5-drums .lane-lbl')].map((e) => e.textContent).join(','),
          on: drumsAreOn, step: drumStep, bar: drumBar, bpm: drumBpm, cue: cueName, d: window.__d, card: r('oav-p5-drums'), btn: r('oav-p5-button'), w: innerWidth, h: innerHeight,
          state: OAVp5.drums.state, pattern: OAVp5.drums.pattern };
      });
      row(s.cells === 64 && s.lanes === 'kick,snare,hat,clap', `p5 ${v}: startDrums() puts the 16 × 4 grid on screen`, `cells=${s.cells} lanes=${s.lanes}`);
      row(s.on === true && s.state === 'on' && Object.keys(s.d.steps).length >= 8 && s.bar >= 2 && s.bpm === 110 && s.pattern === 'breakbeat',
        `p5 ${v}: the machine runs: drumStep moves, drumBar counts, drumBpm`, JSON.stringify({ steps: Object.keys(s.d.steps).length, bar: s.bar, bpm: s.bpm, pattern: s.pattern }));
      row(s.d.kick >= 2 && s.d.hit >= 4 && s.d.bars.length >= 2 && s.d.bars[0] === 1 && s.cue === 'calm' && s.d.cues[0] === 'calm@1',
        `p5 ${v}: its hits call kickDetected / drumHit, barStarted(1, 2 …), cue(1, 'calm') fired`, JSON.stringify({ kick: s.d.kick, hit: s.d.hit, bars: s.d.bars, cues: s.d.cues }));
      row(!overlap(s.card, s.btn) && s.card.right <= s.w - 60 && s.card.left >= 80 && s.card.bottom < s.h / 2,
        `p5 ${v}: OpenProcessing layout: the grid is top-centre, clear of the 🎹 (top-left), OPC's corner (top-right) and the console (bottom)`, JSON.stringify({ card: s.card, btn: s.btn }));
      const sim = await p.evaluate(() => { const k = window.__d.kick, h = window.__d.hit; OAVp5.drums._hit('kick', 0.9); return { kick: window.__d.kick - k, hit: window.__d.hit - h }; });
      row(sim.kick === 1 && sim.hit === 1, `p5 ${v}: a simulated hit calls kickDetected and drumHit once each`, JSON.stringify(sim));
      const before = await p.evaluate(() => { const c = OAVp5.drums.machine.engine.context; return c ? c.state : 'not made yet'; });
      await p.mouse.click(500, 600);                                   // the click a browser wants before audio
      await p.waitForTimeout(600);
      const after = await p.evaluate(() => { const c = OAVp5.drums.machine.engine.context; return c ? c.state : null; });
      row(after === 'running', `p5 ${v}: the kit plays from the first click`, `before=${before} after=${after}`);
      const micState = await p.evaluate(() => OAVp5.mic.state);
      row(micState === 'off', `p5 ${v}: kickDetected() fed by the drums: the click does not ask for the microphone`, micState);
      if (v === VERSIONS[0]) await p.screenshot({ path: path.join(SHOTS, 'kit-drums-op.png') });
      await p.click('#oav-p5-button');
      await p.waitForFunction(() => { const c = document.querySelector('oav-controller'); return c && c.ready; }, null, { timeout: 8000 }).catch(() => {});
      await p.waitForTimeout(500);
      const lifted = await p.evaluate(() => ({ card: document.getElementById('oav-p5-drums').getBoundingClientRect().top, panel: document.getElementById('oav-p5-panel').getBoundingClientRect().bottom,
        btn: (document.getElementById('oav-p5-drums-button') || {}).textContent }));
      row(lifted.card >= lifted.panel - 1 && /🥁/.test(lifted.btn), `p5 ${v}: with the 🎹 panel docked at the top, the grid moves below it`, JSON.stringify(lifted));
      if (v === VERSIONS[0]) await p.screenshot({ path: path.join(SHOTS, 'kit-drums-op-panel.png') });
      await p.click('#oav-p5-drums-button');                           // 🥁 in the panel stops it
      await p.waitForTimeout(400);
      const stopped = await p.evaluate(() => { const st = drumStep; return new Promise((r) => setTimeout(() => r({ on: drumsAreOn, same: drumStep === st, shown: getComputedStyle(document.getElementById('oav-p5-drums')).display }), 500)); });
      row(stopped.on === false && stopped.same && stopped.shown === 'none', `p5 ${v}: 🥁 stops the machine and hides the grid`, JSON.stringify(stopped));
      row(!lazy(urls).some((x) => /tone|packages\/sound/i.test(x)), `p5 ${v}: drums alone load no Tone.js`, JSON.stringify(lazy(urls)));
      row(errs.length === 0, `p5 ${v}: drums: no page errors`, errs.join(' | ').slice(0, 300));
      await ctx.close();
    }
    if (v === VERSIONS[0]) {                                           // the default layout (🎹 bottom-right), for the picture
      const { ctx, p } = await open(v, 'drums', {}, { width: 1200, height: 760 });
      await p.waitForTimeout(3500);
      await p.screenshot({ path: path.join(SHOTS, 'kit-drums.png') });
      await ctx.close();
    }

    // 3. examples/keys with a stubbed Tone.js: the notes reach the engine and Tone
    {
      const { ctx, p, errs, urls } = await open(v, 'keys', { tone: '/stub-tone.js' });
      await p.waitForTimeout(1500);
      const pre = await p.evaluate(() => ({ state: OAVp5.sound.state, on: soundIsOn, starts: (window.__toneCalls || []).filter((c) => c[0] === 'Tone.start').length }));
      row(pre.state === 'waiting' && pre.on === false && pre.starts === 0, `p5 ${v}: startSound() in setup() waits for a click (no Tone.start before it)`, JSON.stringify(pre));
      await p.mouse.click(500, 200);
      await p.waitForFunction(() => soundIsOn === true, null, { timeout: 8000 }).catch(() => {});
      await p.waitForFunction(() => OAVp5.sound.status.id === 'piano' && OAVp5.sound.status.state === 'ready', null, { timeout: 8000 }).catch(() => {});
      const s = await p.evaluate(() => {
        const seen = []; const e = OAVp5.sound.engine; const on = e.noteOn; e.noteOn = function (n, vel) { seen.push([n, Math.round(vel * 100) / 100]); return on.apply(this, arguments); };
        const n0 = window.__toneCalls.length, before = particles.length;
        midi.play(60, 0.8); midi.play(60, 0); midi.input([0x99, 36, 100]);
        const tone = window.__toneCalls.slice(n0).filter((c) => /triggerAttack$/.test(c[0]));
        e.noteOn = on;
        return { seen, tone, grew: particles.length - before, on: soundIsOn, status: OAVp5.sound.status, starts: window.__toneCalls.filter((c) => c[0] === 'Tone.start').length };
      });
      row(s.on && s.status.id === 'piano' && s.status.state === 'ready' && s.starts >= 1, `p5 ${v}: the click starts it: soundIsOn, the piano ready, Tone.start() called`, JSON.stringify({ status: s.status, starts: s.starts }));
      row(s.seen.length === 1 && s.seen[0][0] === 60 && s.seen[0][1] === 0.8 && s.tone.length === 1 && Math.abs(s.tone[0][1] - 261.626) < 0.01,
        `p5 ${v}: midi.play(60, 0.8) reaches the engine and Tone (Sampler.triggerAttack 261.6 Hz); the pad on channel 10 does not`, JSON.stringify({ seen: s.seen, tone: s.tone }));
      row(s.grew > 0, `p5 ${v}: …and the sketch's notePressed still draws`, `particles +${s.grew}`);
      await p.waitForSelector('#oav-p5-sound select', { timeout: 8000 }).catch(() => {});
      await p.waitForTimeout(500);
      const ui = await p.evaluate(() => ({ btn: (document.getElementById('oav-p5-sound-button') || {}).textContent, pick: (document.querySelector('#oav-p5-sound select') || {}).value,
        credit: (document.querySelector('#oav-p5-sound .oav-sound-pick-credit') || {}).textContent, dot: (document.getElementById('oav-p5-sound-dot') || {}).textContent }));
      row(/🔊/.test(ui.btn || '') && ui.pick === 'piano' && /Salamander/.test(ui.credit || '') && /🔊/.test(ui.dot || ''), `p5 ${v}: the 🎹 panel has 🔊, the instrument picker (piano, credited) and a 🔊 on the 🎹`, JSON.stringify(ui));
      if (v === VERSIONS[0]) await p.screenshot({ path: path.join(SHOTS, 'kit-keys-panel.png') });
      await p.selectOption('#oav-p5-sound select', 'organ'); await p.waitForTimeout(300);
      const org = await p.evaluate(() => OAVp5.sound.instrument);
      row(org === 'organ', `p5 ${v}: picking organ in the panel switches the instrument`, org);
      await p.click('#oav-p5-sound-button'); await p.waitForTimeout(200);
      const off = await p.evaluate(() => ({ on: soundIsOn, state: OAVp5.sound.state }));
      row(off.on === false && off.state === 'off', `p5 ${v}: 🔊 turns it off`, JSON.stringify(off));
      const samples = await p.evaluate(() => window.__toneCalls.filter((c) => c[0] === 'fromUrl').map((c) => c[1]));
      row(samples.length === 30 && samples.every((x) => x.startsWith(base + '/oav/packages/sound/samples/salamander/')) && !urls.some((x) => /jsdelivr\.net\/npm\/tone/.test(x)),
        `p5 ${v}: the 30 piano samples are asked from next to oav-p5.js; the tone option replaced jsDelivr`, `${samples.length} samples, first ${samples[0]}`);
      row(errs.length === 0, `p5 ${v}: keys (stubbed Tone): no page errors`, errs.join(' | ').slice(0, 300));
      await ctx.close();
    }

    // 4. examples/keys with the real Tone.js 15 from jsDelivr and the real piano samples
    if (REAL_TONE && (v === VERSIONS[0] || v === VERSIONS[VERSIONS.length - 1])) {
      const { ctx, p, errs, urls } = await open(v, 'keys');
      await p.waitForTimeout(1200);
      await p.mouse.click(500, 200);
      await p.waitForFunction(() => soundIsOn === true, null, { timeout: 20000 }).catch(() => {});
      await p.waitForFunction(() => OAVp5.sound.status.id === 'piano' && OAVp5.sound.status.state === 'ready', null, { timeout: 30000 }).catch(() => {});
      const s = await p.evaluate(async () => {
        midi.play(60, 0.8); midi.play(64, 0.7); midi.play(67, 0.6);
        await new Promise((r) => setTimeout(r, 400));
        midi.play(60, 0); midi.play(64, 0); midi.play(67, 0);
        await new Promise((r) => setTimeout(r, 200));
        return { on: soundIsOn, state: OAVp5.sound.state, status: OAVp5.sound.status, error: OAVp5.sound.error };
      });
      const tone = urls.filter((x) => /cdn\.jsdelivr\.net\/npm\/tone@15/.test(x));
      row(s.on && s.status.state === 'ready' && s.status.id === 'piano' && tone.length > 0, `p5 ${v}: the real Tone.js 15 from jsDelivr: sound on, the Salamander piano ready, a chord played`, JSON.stringify({ status: s.status, toneRequests: tone.length, error: s.error }));
      row(errs.length === 0, `p5 ${v}: real Tone.js: no page errors`, errs.join(' | ').slice(0, 300));
      await ctx.close();
    }
  }
  await b.close(); srv.close();
  console.log(bad ? `\n${bad} check(s) failed` : '\nall checks passed');
  process.exit(bad ? 1 : 0);
})();
