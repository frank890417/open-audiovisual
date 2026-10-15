#!/usr/bin/env node
// strudel-smoke.cjs — oav-p5 0.7 on the real strudel.cc, used the way a Strudel user would (its editor, Ctrl+Enter, its
// documented functions). Not part of `npm test` (needs a browser and the network). Nothing of Strudel is read or changed:
// the measurements wrap OAV's own virtual port and the browser's APIs.
//
//   PW=<path to playwright(-core)> CHROME=<chromium / chrome-headless-shell> [SHOTS=<dir>] [RELAY=live|local] [ONLY=page,link,recipes]
//   node p5/test/strudel-smoke.cjs
//   (RELAY=local: a relay of this script's own on 127.0.0.1 — measured: Chrome refuses strudel.cc's way to it,
//   net::ERR_BLOCKED_BY_LOCAL_NETWORK_ACCESS_CHECKS, so ③ times out there; the live wss:// relay is the one that works)
//
//   ① note("c3 e3 g3 c4").midi('OAV Virtual MIDI') → notePressed() on the same page: when, against Strudel's timestamps
//   ① b midikeys('OAV Virtual MIDI') played back out to .midi('OAV Virtual MIDI'): no loop
//   ② midicmd("clock*96, <start stop>/4") at 128 bpm → the drum machine (startDrums) and drumPhase follow it; the stop stops it
//   ③ two tabs, link=<room>: strudel.cc plays, p5/examples/with-strudel draws: notePressed there, and how late
//   ④ the hint in Strudel's words, the compact panel, 🩺 (screenshots)
//   ⑤ the three recipes of docs/strudel.md as written there: OAV in the prebake; knob1 / micLevel as Strudel parameters
//     (heard: the page's output level, from an AnalyserNode beside the speakers); Hydra + Strudel + OAV with Strudel's clock
// oav-p5 is this checkout's: every https://openaudiovisual.com/… request is answered from the working tree.
const fs = require('fs'), path = require('path'), http = require('http');
const PW = require(process.env.PW || 'playwright');
const ROOT = path.resolve(__dirname, '../..');
const SHOTS = process.env.SHOTS || __dirname;
const RELAY = process.env.RELAY || 'live';
const ONLY = (process.env.ONLY || 'page,link,recipes').split(',');   // page = ①②④ · link = ③ · recipes = ⑤
const MIME = { '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' };
fs.mkdirSync(SHOTS, { recursive: true });

let bad = 0;
const out = {};
const row = (ok, name, extra) => { if (!ok) bad++; console.log(`${ok ? '✅' : '❌'} ${name}${extra ? '  ' + extra : ''}`); };
const stats = (xs) => { const a = xs.slice().sort((p, q) => p - q), n = a.length; if (!n) return { n: 0 };
  const r = (x) => Math.round(x * 100) / 100; return { n, min: r(a[0]), median: r(a[n >> 1]), max: r(a[n - 1]), meanAbs: r(a.reduce((s, x) => s + Math.abs(x), 0) / n) }; };
const fileFor = (p) => { const f = path.join(ROOT, path.normalize(decodeURIComponent(p)).replace(/^([/\\])+/, '')); return f.startsWith(ROOT) && fs.existsSync(f) && fs.statSync(f).isFile() ? f : null; };

(async () => {
  // the working tree over http (page B) and, with RELAY=local, a relay of our own
  const srv = http.createServer((q, r) => {
    const u = new URL(q.url, 'http://x');
    const f = fileFor(u.pathname.endsWith('/') ? u.pathname + 'index.html' : u.pathname);
    if (!f) { r.writeHead(404); return r.end(); }
    r.setHeader('Content-Type', MIME[path.extname(f)] || 'application/octet-stream'); r.setHeader('Cache-Control', 'no-store'); r.setHeader('Access-Control-Allow-Origin', '*');
    r.end(fs.readFileSync(f));
  });
  const { attachRelay } = await import(path.join(ROOT, 'packages/relay/server.js'));
  attachRelay(srv);
  await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
  const LOCAL = `http://127.0.0.1:${srv.address().port}`;
  const relayUrl = RELAY === 'local' ? `ws://127.0.0.1:${srv.address().port}/relay` : 'wss://remote.cheyuwu.com/relay';

  const browser = await PW.chromium.launch({ executablePath: process.env.CHROME || undefined, headless: true,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'zh-TW' });
  await ctx.grantPermissions(['midi', 'midi-sysex'], { origin: 'https://strudel.cc' });
  await ctx.route('https://openaudiovisual.com/**', (route) => {
    const u = new URL(route.request().url()), f = fileFor(u.pathname);
    if (!f) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ status: 200, body: fs.readFileSync(f), headers: { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' } });
  });
  // the page's output level (RMS), from an AnalyserNode next to each connection to the speakers: a browser API, nothing of Strudel
  await ctx.addInitScript(() => {
    window.__taps = [];
    const conn = AudioNode.prototype.connect;
    AudioNode.prototype.connect = function (dest, ...rest) {
      try { if (dest instanceof AudioDestinationNode && !this.__tap) { this.__tap = true; const an = dest.context.createAnalyser(); an.fftSize = 2048; conn.call(this, an); window.__taps.push(an); } } catch (e) { /* */ }
      return conn.call(this, dest, ...rest);
    };
    window.__rms = () => { let m = 0; for (const an of window.__taps) { const b = new Float32Array(an.fftSize); an.getFloatTimeDomainData(b); let q = 0; for (const x of b) q += x * x; m = Math.max(m, Math.sqrt(q / b.length)); } return m; };
  });
  const logs = [];
  const watch = (p, tag) => { p.on('console', (m) => logs.push(`[${tag}] ${m.type()}: ${m.text()}`)); p.on('pageerror', (e) => logs.push(`[${tag}] pageerror: ${e.message}`)); };

  async function strudel(tag) {
    const p = await ctx.newPage(); watch(p, tag);
    await p.goto('https://strudel.cc/', { waitUntil: 'load', timeout: 60000 });
    await p.waitForSelector('.cm-content', { timeout: 30000 });
    await p.waitForTimeout(2500);
    return p;
  }
  async function code(p, src) {
    const ed = p.locator('.cm-content').first();
    await ed.click(); await p.keyboard.press('ControlOrMeta+a'); await p.keyboard.press('Backspace');
    await p.keyboard.insertText(src);
  }
  async function run(p, src, wait = 800) { if (src != null) await code(p, src); await p.locator('.cm-content').first().click(); await p.keyboard.press('Control+Enter'); await p.waitForTimeout(wait); }
  async function hush(p) { await p.locator('.cm-content').first().click(); await p.keyboard.press('Control+Period'); await p.waitForTimeout(400); }
  // wrap OAV's own virtual output: what Strudel sends, and with which timestamp (OAV's object, not Strudel's)
  const instrument = (p) => p.evaluate(async () => {
    const acc = await navigator.requestMIDIAccess();
    const o = [...acc.outputs.values()].find((x) => x.name === 'OAV Virtual MIDI');
    if (!o.__wrapped) { const send = o.send.bind(o); o.send = (d, ts) => { window.__sent.push({ d: Array.from(d), ts, at: performance.now() }); return send(d, ts); }; o.__wrapped = true; }
    window.__sent = []; window.__heard = [];
    OAVp5.on('notePressed', (n, v) => window.__heard.push({ n, t: performance.now(), src: OAVp5.last.source }));
    return { outputs: [...acc.outputs.values()].map((x) => x.name), version: OAVp5.version };
  });

  if (ONLY.includes('page')) {
  // ---------------------------------------------------------------- ① same page
  const A = await strudel('A');
  await run(A, "await import('https://openaudiovisual.com/p5/oav-p5.js')", 2500);
  const inst = await instrument(A);
  row(inst.version === '0.7.0', 'this checkout\'s oav-p5 runs on strudel.cc', inst.version);
  const env = await A.evaluate(() => ({ hardware: OAVp5.options.hardware, compact: OAVp5.options.compact, hints: OAVp5.hints.map((h) => h.id + ': ' + h.what + ' / ' + h.next),
    note: typeof note, s: typeof s, velocity: typeof velocity, beat: typeof beat }));
  out.env = env;
  row(env.hardware === 'click' && env.compact === true, 'in Strudel: hardware=click, compact panel', JSON.stringify(env).slice(0, 80));
  row(env.hints.some((h) => /^strudelNames: 這頁已經有 .*note.*（Strudel 的）/.test(h)) && env.note === 'function', 'the names card speaks of Strudel, Strudel\'s note() untouched', env.hints.join(' | ').slice(0, 160));
  await A.screenshot({ path: path.join(SHOTS, '01-strudel-loaded-hint.png') });

  await run(A, "note(\"c3 e3 g3 c4\").midi('OAV Virtual MIDI')", 4500);
  await hush(A);
  await A.waitForTimeout(800);
  const one = await A.evaluate(() => ({ sent: window.__sent.slice(), heard: window.__heard.slice() }));
  const ons = one.sent.filter((s) => (s.d[0] & 0xF0) === 0x90 && s.d[2] > 0);
  const errs = [], leads = [];
  const used = new Set();
  for (const s of ons) {
    const h = one.heard.find((x, i) => !used.has(i) && x.n === s.d[1] && x.t >= s.ts - 20 && (used.add(i) || true));
    if (h) errs.push(h.t - s.ts);
    leads.push(s.ts - s.at);
  }
  out.samePage = { notes: ons.length, heard: one.heard.length, sources: [...new Set(one.heard.map((h) => h.src))], errorMs: stats(errs), strudelLeadMs: stats(leads) };
  row(ons.length >= 6 && errs.length === ons.length && Math.abs(out.samePage.errorMs.max) < 10 && out.samePage.sources.join() === 'virtual-out',
    '① Strudel → notePressed on the same page, at Strudel\'s timestamps', JSON.stringify(out.samePage));

  // ① b: Strudel plays back out what it hears on the virtual input — still a bounded exchange, no loop
  await run(A, "const kb = await midikeys('OAV Virtual MIDI')\nkb().midi('OAV Virtual MIDI')", 1500);
  await A.evaluate(() => { window.__sent = []; window.__heard = []; OAVp5.play(64, 0.8); setTimeout(() => OAVp5.play(64, 0), 200); });
  await A.waitForTimeout(3000);
  const loop = await A.evaluate(() => ({ sent: window.__sent.length, heard: window.__heard.map((h) => h.src) }));
  await hush(A);
  out.loop = loop;
  row(loop.sent <= 4 && loop.heard.length <= 2, '① b midikeys → .midi on the same port: no feedback loop', JSON.stringify(loop));

  // ---------------------------------------------------------------- ② the clock
  await A.evaluate(() => startDrums('four on floor', 100));
  await A.waitForTimeout(1200);
  await A.evaluate(() => {
    window.__sent = [];
    const eng = OAVp5.drums.machine.engine, on = eng.noteOn.bind(eng);
    window.__kicks = [];
    eng.noteOn = (n, v, t) => { const c = eng.context, ts = c && c.getOutputTimestamp ? c.getOutputTimestamp() : null;
      if (n === 36 && ts && t != null) window.__kicks.push({ perf: ts.performanceTime + (t - ts.contextTime) * 1000, made: performance.now() }); return on(n, v, t); };
  });
  await run(A, 'setcps(128 / 60 / 4)\nmidicmd("clock*96, <start stop>/4").midi(\'OAV Virtual MIDI\')', 300);
  // drumPhase sampled every frame for 6 s (the start comes at the next cycle; stop 4 bars = 7.5 s after it)
  await A.evaluate(() => { window.__ph = []; const t0 = performance.now(); (function f() { window.__ph.push({ t: performance.now(), bar: drumPhase, beat: beatPhase, playing: OAVp5.drums.state }); if (performance.now() - t0 < 6000) requestAnimationFrame(f); })(); });
  await A.waitForTimeout(3500);
  const card = await A.evaluate(() => { const b = document.getElementById('oav-p5-follow'); return b ? b.textContent : null; });
  await A.screenshot({ path: path.join(SHOTS, '02-drums-follow-strudel-clock.png') });
  await A.waitForTimeout(3000);
  const ck = await A.evaluate(() => ({ sent: window.__sent.slice(), kicks: window.__kicks.slice(), ph: window.__ph.slice(), bpm: OAVp5.drums.bpm, clock: OAVp5.clock.info,
    follow: OAVp5.drums.machine.seq.followInfo && OAVp5.drums.machine.seq.followInfo(), latency: OAVp5.drums.clock.latency }));
  const starts = ck.sent.filter((s) => s.d[0] === 0xFA), clocks = ck.sent.filter((s) => s.d[0] === 0xF8);
  const start = starts.length ? starts[0].ts : null, beatMs = 60000 / 128, barMs = beatMs * 4;
  const kickErr = start == null ? [] : ck.kicks.filter((k) => k.perf > start + 1000 && k.perf < start + 7000).map((k) => { const b = (k.perf - start) / beatMs; return (b - Math.round(b)) * beatMs; });
  const phErr = start == null ? [] : ck.ph.filter((p) => p.t > start + 1500 && p.playing === 'on').map((p) => { let d = p.bar - (((p.t - start) / barMs) % 1); d -= Math.round(d); return d * barMs; });
  out.clock = { starts: starts.length, startTimestamps: [...new Set(starts.map((s) => s.ts))].length, clockIntervalMs: clocks.length > 1 ? Math.round((clocks.at(-1).ts - clocks[0].ts) / (clocks.length - 1) * 100) / 100 : null,
    drumsBpm: ck.bpm, clockInfo: ck.clock, follow: ck.follow, card, kickVsStrudelBeatMs: stats(kickErr), drumPhaseVsClockMs: stats(phErr), outputLatencyS: ck.latency };
  row(Math.abs(ck.bpm - 128) < 0.5 && ck.clock.state === 'running', '② the drum machine runs at Strudel\'s 128 bpm', `bpm ${ck.bpm} · ${JSON.stringify(ck.clock)}`);
  row(phErr.length > 50 && Math.abs(out.clock.drumPhaseVsClockMs.median) < 20, '② drumPhase on Strudel\'s bar', JSON.stringify(out.clock.drumPhaseVsClockMs));
  row(kickErr.length >= 6 && out.clock.kickVsStrudelBeatMs.max - out.clock.kickVsStrudelBeatMs.min < 6, '② each kick on Strudel\'s beat (spread)', JSON.stringify(out.clock.kickVsStrudelBeatMs));
  row(/跟著外部時鐘 · 128 BPM/.test(card || ''), '② the card says who leads', card);
  await A.waitForTimeout(3000);                                         // past the stop (4 bars after the start)
  const stopped = await A.evaluate(() => ({ state: OAVp5.drums.state, playing: OAVp5.drums.machine.seq.playing, clock: OAVp5.clock.info.state }));
  out.clock.afterStop = stopped;
  row(stopped.playing === false && stopped.state === 'stopped', '② Strudel\'s stop stops the machine', JSON.stringify(stopped));
  await hush(A);
  await A.evaluate(() => stopDrums());

  // ---------------------------------------------------------------- ④ the panel, 🩺
  await A.evaluate(() => OAVp5.panel.open());
  await A.waitForTimeout(2500);
  const box = await A.evaluate(() => { const d = document.getElementById('oav-p5-panel').getBoundingClientRect(); const e = document.querySelector('.cm-content').getBoundingClientRect();
    return { panel: { x: Math.round(d.x), y: Math.round(d.y), w: Math.round(d.width), h: Math.round(d.height) }, editor: { x: Math.round(e.x), y: Math.round(e.y), w: Math.round(e.width) }, vh: innerHeight, vw: innerWidth }; });
  out.panel = box;
  row(box.panel.h <= box.vh * 0.36 && box.panel.w <= 580, '④ the compact panel: a third of the height, in the corner', JSON.stringify(box));
  await A.screenshot({ path: path.join(SHOTS, '03-strudel-panel-compact.png') });
  const ck2 = await A.evaluate(() => OAVp5.check().text);
  out.check = ck2;
  row(/外部程式：OAV Virtual MIDI 被要過 \d+ 次/.test(ck2), '④ 🩺 has the "外部程式" row', ck2.split('\n').find((l) => /外部程式/.test(l)));
  await A.screenshot({ path: path.join(SHOTS, '04-strudel-checkup.png') });
  await A.setViewportSize({ width: 390, height: 844 });
  await A.evaluate(() => { const c = document.getElementById('oav-p5-check'); if (c) c.style.display = 'none'; });
  await A.waitForTimeout(800);
  await A.screenshot({ path: path.join(SHOTS, '05-strudel-phone-width-panel.png') });
  await A.close();
  }

  if (ONLY.includes('link')) {
  // ---------------------------------------------------------------- ③ two tabs, one room
  const room = 'oav-smoke-' + Math.random().toString(36).slice(2, 7);
  const B = await ctx.newPage(); watch(B, 'B');
  await B.goto(`${LOCAL}/p5/examples/with-strudel/?room=${room}` + (RELAY === 'local' ? `&oav_relay=${encodeURIComponent(relayUrl)}` : ''), { waitUntil: 'load' });
  await B.waitForFunction(() => window.OAVp5 && OAVp5.link.info && OAVp5.link.info.state === 'open', null, { timeout: 20000 });
  await B.evaluate(() => { window.__heardB = []; OAVp5.on('notePressed', (n) => window.__heardB.push({ n, epoch: performance.timeOrigin + performance.now(), src: OAVp5.last.source })); });
  const A2 = await strudel('A2');
  await run(A2, `window.OAV_P5 = { link: '${room}'${RELAY === 'local' ? `, relay: '${relayUrl}'` : ''} }\nawait import('https://openaudiovisual.com/p5/oav-p5.js')`, 2500);
  await instrument(A2);
  await A2.waitForFunction(() => OAVp5.link.info && OAVp5.link.info.state === 'open' && OAVp5.link.info.peers >= 1, null, { timeout: 20000 });
  await run(A2, 'setcps(0.5)\nstack(note("c3 e3 g3 c4"), midicmd("clock*96")).midi(\'OAV Virtual MIDI\')', 3600);
  await B.screenshot({ path: path.join(SHOTS, '06-linked-p5-page.png') });
  const playingB = await B.evaluate(() => ({ clock: OAVp5.clock.info, drumPhase, drumBpm, drumBar }));
  await A2.waitForTimeout(2400);
  await hush(A2);
  await A2.waitForTimeout(1000);
  const sentA = await A2.evaluate(() => window.__sent.map((s) => ({ d: s.d, epoch: s.ts == null ? null : performance.timeOrigin + s.ts, sentEpoch: performance.timeOrigin + s.at })));
  const linkA = await A2.evaluate(() => OAVp5.link.info), linkB = await B.evaluate(() => OAVp5.link.info);
  const heardB = await B.evaluate(() => window.__heardB.slice()), clockB = await B.evaluate(() => OAVp5.clock.info);
  const onsA = sentA.filter((s) => (s.d[0] & 0xF0) === 0x90 && s.d[2] > 0);
  const lerr = [], used2 = new Set();
  for (const s of onsA) { const i = heardB.findIndex((h, k) => !used2.has(k) && h.n === s.d[1] && h.epoch > s.epoch - 300); if (i >= 0) { used2.add(i); lerr.push(heardB[i].epoch - s.epoch); } }
  out.link = { relay: relayUrl, room, notesA: onsA.length, heardB: heardB.length, sourcesB: [...new Set(heardB.map((h) => h.src))], bVsStrudelMs: stats(lerr), linkA, linkB, clockB, playingB };
  row(onsA.length >= 8 && lerr.length >= onsA.length - 1 && out.link.sourcesB.join() === 'link', '③ another tab in the room hears Strudel\'s notes (source link)', `${lerr.length}/${onsA.length}`);
  row(Math.abs(out.link.bVsStrudelMs.median) < 40, '③ … when Strudel plays them', JSON.stringify(out.link.bVsStrudelMs));
  row(clockB.clocks > 100 && Math.abs((clockB.bpm || 0) - 120) < 1 && playingB.clock.state === 'running' && Math.abs(playingB.drumBpm - 120) < 0.5, '③ Strudel\'s clock reaches the other tab too (drumBpm there)', JSON.stringify(playingB));
  await A2.close(); await B.close();
  }

  if (ONLY.includes('recipes')) {
  // ---------------------------------------------------------------- ⑤ the recipes, as the docs write them
  const R = await strudel('R');
  await R.getByText('settings', { exact: true }).first().click(); await R.waitForTimeout(500);
  await R.getByText('prebake', { exact: true }).first().click(); await R.waitForTimeout(500);
  const pre = R.locator('.cm-content').nth(1);
  await pre.click(); await R.keyboard.press('ControlOrMeta+End');
  await R.keyboard.insertText("\nawait import('https://openaudiovisual.com/p5/oav-p5.js')\n");
  await R.locator('button:text-is("save")').first().click(); await R.waitForTimeout(800);
  await R.reload({ waitUntil: 'load' }); await R.waitForSelector('.cm-content');
  const t0 = Date.now();
  const preOk = await R.waitForFunction(() => !!(window.OAVp5 && OAVp5.version), null, { timeout: 15000 }).then(() => true, () => false);
  out.prebakeMs = Date.now() - t0;                                      // Strudel runs the prebake once its own start-up is done
  row(preOk, '⑤ prebake: OAV is on the page after a reload, before anything is played', `${out.prebakeMs} ms after the editor appeared`);
  // recipe 1: a knob and the microphone as Strudel parameters
  await R.evaluate(() => OAVp5.input([0xB0, 74, 0]));
  await run(R, 's("bd*4").gain(signal(() => knob1))', 2500);
  const q0 = await R.evaluate(async () => { let m = 0; for (let i = 0; i < 20; i++) { m = Math.max(m, __rms()); await new Promise((r) => setTimeout(r, 50)); } return m; });
  await R.evaluate(() => OAVp5.input([0xB0, 74, 127]));
  await R.waitForTimeout(600);
  const q1 = await R.evaluate(async () => { let m = 0; for (let i = 0; i < 30; i++) { m = Math.max(m, __rms()); await new Promise((r) => setTimeout(r, 50)); } return m; });
  out.recipe1 = { knob0Rms: Math.round(q0 * 1000) / 1000, knob1Rms: Math.round(q1 * 1000) / 1000 };
  row(q0 < 0.05 && q1 > 0.1, '⑤ recipe 1: s("bd*4").gain(signal(() => knob1)) — knob 1 at 0 silent, at 127 heard', JSON.stringify(out.recipe1));
  await run(R, 's("hh*8").lpf(signal(() => 300 + micLevel * 8000))', 3000);
  const mic = await R.evaluate(() => ({ state: OAVp5.mic.state, level: OAVp5.mic.level }));
  out.recipe1.mic = mic;
  row(mic.state === 'on', '⑤ recipe 1: micLevel in signal() opens the microphone', JSON.stringify(mic));
  await hush(R);
  // recipe 3: Hydra + Strudel + OAV, Strudel's clock turning Hydra through drumPhase
  await run(R, 'await initHydra()\nosc(10, 0.1, () => knob1 * 2).rotate(() => drumPhase * 6.28).color(1, () => micLevel, 0.6).out()\nsetcps(120 / 60 / 4)\n$: s("bd*4, [~ sd]*2, hh*8").gain(signal(() => 0.3 + knob1))\n$: midicmd("clock*96").midi(\'OAV Virtual MIDI\')', 4000);
  const h3 = await R.evaluate(async () => { const ps = []; for (let i = 0; i < 10; i++) { ps.push(Math.round(drumPhase * 1000) / 1000); await new Promise((r) => setTimeout(r, 120)); }
    return { canvas: !!document.querySelector('canvas'), phases: ps, bpm: OAVp5.clock.info.bpm, state: OAVp5.clock.info.state, rms: Math.round(__rms() * 1000) / 1000 }; });
  out.recipe3 = h3;
  await R.screenshot({ path: path.join(SHOTS, '07-recipe3-hydra-strudel-oav.png') });
  row(h3.canvas && h3.state === 'running' && Math.abs(h3.bpm - 120) < 0.5 && new Set(h3.phases).size > 5, '⑤ recipe 3: Hydra draws, Strudel plays, drumPhase follows Strudel\'s clock', JSON.stringify(h3));
  await hush(R);
  await R.close();
  }

  fs.writeFileSync(path.join(SHOTS, 'strudel-smoke.json'), JSON.stringify({ ...out, logs: logs.filter((l) => /oav-p5|error|Error/.test(l)).slice(-80) }, null, 1));
  console.log(JSON.stringify(out, null, 1).slice(0, 6000));
  await browser.close(); srv.close();
  console.log(bad ? `\n${bad} failed` : '\nall passed');
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
