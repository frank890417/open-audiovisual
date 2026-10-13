#!/usr/bin/env node
// smoke.cjs — oav-p5.js in a real (headless) Chromium, p5 1.x and 2.x, the way a student's sketch would load it.
// Not part of `npm test` (needs a browser): run it by hand before publishing a tag.
//
//   P5_DIR=<dir with p5-1.11.11.min.js, p5-2.0.5.min.js> PW=<path to playwright> node p5/test/smoke.cjs
//
// Per p5 version × load route (`line` = the injected first line, `slow` = the same with the file 1.5 s late,
// `lib` = OpenProcessing's Custom Library route) it checks: no page error, the sketch runs, `midi` exists in setup(),
// keys and knobs reach the sketch's callbacks and midi.note / midi.cc, the 🎹 button is there and the on-screen
// controller plays the sketch, a sketch's own Web MIDI code hears the virtual port, and a phone over a local relay
// plays it — all with no MIDI hardware and no MIDI permission.
const fs = require('fs'), path = require('path'), http = require('http');
const PW = require(process.env.PW || 'playwright');
const ENGINE = process.env.BROWSER || 'chromium';   // chromium · webkit (≈ Safari: no Web MIDI) · firefox
const ROOT = path.resolve(__dirname, '../..');
const P5_DIR = process.env.P5_DIR || path.join(ROOT, 'p5/test/vendor');
const SKETCH = fs.readFileSync(path.join(ROOT, 'p5/examples/particles/sketch.js'), 'utf8');
const OPC_SKETCH = fs.readFileSync(path.join(ROOT, 'p5/examples/opc/sketch.js'), 'utf8');
// OP Configurator 3000 as OpenProcessing loads it (a classic script that declares `class OPC`), pinned
const OPC_URL = 'https://cdn.jsdelivr.net/gh/msawired/OPC@v0.7.1/opc.min.js';
const VERSIONS = (process.env.P5_VERSIONS || '1.11.11,2.0.5').split(',');
const ROUTES = (process.env.ROUTES || 'line,slow,lib,opc').split(',');
const MIME = { '.js': 'text/javascript', '.json': 'application/json', '.html': 'text/html', '.css': 'text/css' };

(async () => {
  // a local OAV relay (the same server.js the public one runs) so the phone path is tested end to end
  const relayPort = 18000 + Math.floor(Math.random() * 1000);
  const relayProc = require('child_process').spawn(process.execPath, [path.join(ROOT, 'packages/relay/server.js'), String(relayPort)], { env: { ...process.env, RELAY_HOST: '127.0.0.1' }, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 600));

  const srv = http.createServer((q, r) => {
    const u = new URL(q.url, 'http://x');
    const send = (type, body) => { r.setHeader('Content-Type', type); r.setHeader('Access-Control-Allow-Origin', '*'); r.end(body); };
    if (u.pathname === '/page') {
      const v = u.searchParams.get('v'), route = u.searchParams.get('route');
      const head = route === 'lib' ? '<script src="/oav/p5/oav-p5.js"></script>' : route === 'opc' ? `<script src="${OPC_URL}"></script>` : '';
      return send('text/html', `<!doctype html><meta charset="utf-8"><style>body{margin:0}</style>
<script>window.OAV_P5 = { relay: 'ws://127.0.0.1:${relayPort}/relay', room: 'smoke' };</script>
<script src="/p5/${v}"></script>${head}<script src="/sketch.js?route=${route}"></script>`);
    }
    if (u.pathname === '/bare') {
      return send('text/html', `<!doctype html><meta charset="utf-8"><script src="/p5/${u.searchParams.get('v')}"></script>
<script>function setup(){createCanvas(400,300);colorMode(HSB,360,100,100,100);noStroke();}function draw(){background(230,30,8,30);fill(200,70,100,50);circle(frameCount%400,150,20);}</script>`);
    }
    if (u.pathname === '/sketch.js') {
      const route = u.searchParams.get('route');
      let code = (route === 'opc' ? OPC_SKETCH : SKETCH).replace('https://openaudiovisual.com/p5/oav-p5.js', route === 'slow' ? '/oav/p5/oav-p5.js?delay=1500' : '/oav/p5/oav-p5.js');
      // probe: what does setup() see?
      code += '\n;(() => { const s = setup; setup = function () { window.__midiAtSetup = typeof midi; s(); }; })();\n';
      return send('text/javascript', code);
    }
    if (u.pathname === '/phone') {
      return send('text/html', `<!doctype html><meta charset="utf-8"><script type="module">
import { RelayClient } from '/oav/packages/relay/index.js';
const c = new RelayClient({ role: 'controller', room: 'smoke', url: 'ws://127.0.0.1:${relayPort}/relay?role=controller&room=smoke&id=phone1' });
c.connect(); window.phone = c;</script>`);
    }
    if (u.pathname.startsWith('/p5/')) return send('text/javascript', fs.readFileSync(path.join(P5_DIR, `p5-${u.pathname.slice(4)}.min.js`)));
    if (u.pathname.startsWith('/oav/')) {
      const f = path.join(ROOT, decodeURIComponent(u.pathname.slice(5)));
      if (!f.startsWith(ROOT) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); }
      const delay = +(u.searchParams.get('delay') || 0);
      return setTimeout(() => send(MIME[path.extname(f)] || 'application/octet-stream', fs.readFileSync(f)), delay);
    }
    r.writeHead(404); r.end();
  });
  await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
  const base = `http://127.0.0.1:${srv.address().port}`;
  const b = await PW[ENGINE].launch({ headless: true });
  let bad = 0;
  const row = (ok, label, extra = '') => { if (!ok) bad++; console.log(`${ok ? '✅' : '❌'} ${label}${extra ? '  ' + extra : ''}`); };

  // control group: what does each p5 version print here with no oav-p5 at all?
  const baseline = {};
  for (const v of VERSIONS) {
    const p = await b.newPage(); const seen = [];
    p.on('console', (m) => { if (m.type() === 'error') seen.push(m.text()); });
    await p.goto(`${base}/bare?v=${v}`); await p.waitForTimeout(1200); await p.close();
    baseline[v] = new Set(seen);
    if (seen.length) console.log(`ℹ️  p5 ${v} without oav-p5 already prints: ${[...baseline[v]].join(' | ')}`);
  }

  for (const v of VERSIONS) for (const route of ROUTES) {
    const ctx = await b.newContext({ viewport: { width: 900, height: 600 } });
    const p = await ctx.newPage(); const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|favicon/.test(m.text()) && !baseline[v].has(m.text())) errs.push('console: ' + m.text()); });
    const tag = `p5 ${v} ${route}`;
    await p.goto(`${base}/page?v=${v}&route=${route}`);
    await p.waitForTimeout(route === 'slow' ? 2600 : 1200);
    const s = await p.evaluate(() => ({ fc: typeof frameCount === 'number' ? frameCount : null, atSetup: window.__midiAtSetup, hw: window.midi && midi.hardware,
      btn: !!document.getElementById('oav-p5-button'), version: window.OAVp5 && OAVp5.version }));
    row(s.fc > 10, `${tag}: sketch runs`, `frameCount=${s.fc}`);
    row(s.atSetup === 'object', `${tag}: midi exists in setup()`, `typeof midi in setup = ${s.atSetup}`);
    row(s.btn, `${tag}: 🎹 button on the page`, `hardware=${s.hw}`);
    if (route === 'opc') {
      // OP Configurator 3000: knob 1 → the first OPC.slider, pad 1 → the first OPC.toggle; OPC's own variable changes
      const o = await p.evaluate(() => {
        const out = { before: radius, trails0: trails };
        midi.input([0xB0, 74, 127]); out.radius = radius;           // the on-screen MiniLab 3's knob 1 → radius 10..300
        midi.input([0xB0, 71, 0]); out.speed = speed;               // knob 2 → speed 0..5
        midi.input([0x99, 36, 100]); midi.input([0x89, 36, 0]); out.trails = trails;   // pad 1 flips trails
        out.wiring = midi.wiring().map((w) => w.control + '>' + w.name).join(' ');
        return out;
      });
      // OPC's own default step (value / 10 = 6 from 10) tops radius out at 298, as OpenProcessing's slider does
      row(o.before === 60 && o.radius === 298 && o.speed === 0 && o.trails === !o.trails0, `${tag}: knobs and pads drive the OPC variables`, JSON.stringify(o));
      await p.click('#oav-p5-button');
      await p.waitForFunction(() => { const c = document.querySelector('oav-controller'); return c && c.ready; }, null, { timeout: 8000 }).catch(() => {});
      const scr = await p.evaluate(async () => {
        const c = document.querySelector('oav-controller'); if (!c) return { error: 'no oav-controller' };
        await c.ready; c.set('knob1', 0.5);
        return { radius, legend: document.querySelector('#oav-p5-panel div div') && document.querySelector('#oav-p5-panel div div').textContent };
      });
      row(scr.radius === 154 && /radius/.test(scr.legend || ''), `${tag}: the on-screen knob 1 moves radius; the panel says what is wired`, JSON.stringify(scr));
      if (v === VERSIONS[0]) await p.screenshot({ path: path.join(ROOT, 'p5/test/smoke-opc.png') });
    } else {
      const k = await p.evaluate(() => {
        const out = {};
        midi.play(60, 0.8); out.held = midi.note[60]; out.particles = particles.length; out.note = note; out.velocity = velocity; out.down = noteIsDown(60);
        midi.play(60, 0); out.released = midi.note[60];
        midi.input([0xB0, 74, 127]); out.knob1 = knob1; out.cc = midi.cc[74];
        return out;
      });
      row(Math.abs(k.held - Math.round(0.8 * 127) / 127) < 0.001 && k.particles > 0 && k.released === 0 && k.note === 60 && k.down === true,
        `${tag}: a key reaches notePressed + note / velocity / noteIsDown`, JSON.stringify(k));
      row(k.knob1 === 1 && k.cc === 1, `${tag}: knob 1 reaches knob1 + midi.cc`);

      // the on-screen controller (lazy: loads @openav/midi's <oav-controller> on first open)
      await p.click('#oav-p5-button');
      await p.waitForFunction(() => { const c = document.querySelector('oav-controller'); return c && c.ready; }, null, { timeout: 8000 }).catch(() => {});
      const scr = await p.evaluate(async () => {
        const c = document.querySelector('oav-controller'); if (!c) return { error: 'no oav-controller' };
        await c.ready; const before = particles.length;
        c.set('keys', 0.9, { note: 62 }); const on = { note: midi.note[62], src: midi.last && midi.last.source, grew: particles.length - before };
        c.set('keys', 0, { note: 62 }); on.off = midi.note[62];
        c.set('knob2', 0.5); on.knob2 = knob2;
        const panel = document.getElementById('oav-p5-panel'); on.panelH = panel ? Math.round(panel.getBoundingClientRect().height) : 0;
        return on;
      });
      row(scr.src === 'screen' && scr.note > 0 && scr.grew > 0 && scr.off === 0 && Math.abs(scr.knob2 - 0.5) < 0.01, `${tag}: the on-screen controller plays the sketch`, JSON.stringify(scr));
      if (v === VERSIONS[0] && route === 'line') await p.screenshot({ path: path.join(ROOT, 'p5/test/smoke-panel.png') });

      // a sketch's own Web MIDI code (requestMIDIAccess / WebMidi.js) hears the screen through the virtual port
      const shim = await p.evaluate(() => navigator.requestMIDIAccess().then((a) => {
        const ins = [...a.inputs.values()]; let got = null;
        const vin = ins.find((i) => i.name === 'OAV Virtual MIDI'); if (vin) vin.onmidimessage = (e) => { got = Array.from(e.data); };
        midi.play(64, 0.5);
        return new Promise((r) => setTimeout(() => r({ names: ins.map((i) => i.name), got }), 100));
      }));
      row(shim.got && shim.got[0] === 0x90 && shim.got[1] === 64, `${tag}: requestMIDIAccess gets the virtual port`, JSON.stringify(shim));

      // a phone: relay controller → this sketch (runner) → notePressed, source 'phone'
      if (route === 'line') {
        await p.evaluate(() => { midi.phone(); });
        await p.waitForTimeout(800);
        const ph = await ctx.newPage();
        await ph.goto(`${base}/phone`); await ph.waitForTimeout(600);
        await ph.evaluate(() => window.phone.send('midi/virtual', { data: [0xB0, 76, 127], device: 'minilab3', src: 'phone-test' }, true));
        await ph.evaluate(() => window.phone.send('midi/virtual', { data: [0x90, 67, 100], device: 'minilab3', src: 'phone-test' }, true));
        await p.waitForTimeout(400);
        const pr = await p.evaluate(() => ({ note: midi.note[67], src: midi.last && midi.last.source, knob3, qr: !!document.querySelector('svg') }));
        row(pr.src === 'phone' && pr.note > 0 && pr.knob3 === 1, `${tag}: a phone over the relay plays the sketch (key + knob 3)`, JSON.stringify(pr));
        await ph.close();
      }
    }
    row(errs.length === 0, `${tag}: no page errors`, errs.join(' | ').slice(0, 400));
    await ctx.close();
  }
  await b.close(); srv.close(); relayProc.kill();
  console.log(bad ? `\n${bad} check(s) failed` : '\nall checks passed');
  process.exit(bad ? 1 : 0);
})();
