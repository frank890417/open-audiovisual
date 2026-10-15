#!/usr/bin/env node
// rec-smoke.cjs — oav-p5.js's recording (⏺ / startRecording) in real browsers, p5 1.x and 2.x, checked with ffprobe.
// Not part of `npm test` (needs browsers, ffmpeg and, for sound, jsDelivr's Tone.js): run it by hand before publishing a tag.
//
//   P5_DIR=<dir with p5-1.11.11.min.js, p5-2.0.5.min.js, p5-2.3.4full.min.js, p5sound-1.11.11.min.js, p5sound-0.4.1.min.js>
//   PW=<path to playwright(-core)> CHROME=<Google Chrome (H.264)> [CHROMIUM=<Playwright's Chromium>] [WEBKIT=<Playwright's WebKit>]
//   [SHOTS=<dir>] [OUT=<dir for the recorded files>] [TARGETS=chrome,chromium,webkit] [P5_VERSIONS=1.11.11,2.0.5,2.3.4full] node p5/test/rec-smoke.cjs
//
// Every take is the file the browser downloaded, read back with ffprobe (streams, codecs, length) and ffmpeg (volumedetect for
// the sound, signalstats for the picture). Per p5 version: none of the new names is a p5 / p5.sound name; an old sketch that
// records nothing builds no MediaRecorder, loads no packages/record and shows nothing new but ⏺ and 📷 in the panel;
// examples/record (startSound + startDrums) records 3 s of picture and sound; the fake microphone is recorded, and left out
// with record=nomic; a WEBGL canvas is recorded (not black); p5.sound 1.x is in the take (2.x's p5.sound says it is not);
// a sound that is on but silent, a browser without MP4 (WebM + the Instagram card), a black take (simulated: the iOS check)
// are said on the page; the ⏺ button, the red dot on the 🎹 and the saved card (screenshots); 📷 saves the canvas as a PNG.
const fs = require('fs'), path = require('path'), http = require('http'), { spawnSync } = require('child_process');
const PW = require(process.env.PW || 'playwright');
const ROOT = path.resolve(__dirname, '../..');
const OAV = process.env.OAV_ROOT || ROOT;   // OAV_ROOT=<another checkout>: the same checks against it (the red run on 0.4.0)
const P5_DIR = process.env.P5_DIR || path.join(ROOT, 'p5/test/vendor');
const SHOTS = process.env.SHOTS || __dirname;
const OUT = process.env.OUT || path.join(SHOTS, 'takes');
const VERSIONS = (process.env.P5_VERSIONS || '1.11.11,2.0.5,2.3.4full').split(',');
const TARGETS = (process.env.TARGETS || 'chrome,chromium').split(',');
const NAMES = ['startRecording', 'stopRecording', 'recordingIsOn', 'recordingSaved'];
const MIME = { '.js': 'text/javascript', '.json': 'application/json', '.html': 'text/html', '.css': 'text/css', '.mp3': 'audio/mpeg' };
const soundFor = (v) => (v.startsWith('1.') ? 'p5sound-1.11.11.min.js' : 'p5sound-0.4.1.min.js');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const LINE = "document.head.prepend(Object.assign(document.createElement('script'), { src: 'https://openaudiovisual.com/p5/oav-p5.js' }));\n";
const SKETCHES = {
  plain: () => read('p5/examples/particles/sketch.js'),
  record: () => read('p5/examples/record/sketch.js'),
  drums: () => read('p5/examples/drums/sketch.js'),
  mic: () => LINE + `function setup() { createCanvas(640, 360); startMic(); }
function draw() { background(20); fill(255); circle(width / 2, height / 2, 40 + micLevel * 300); }`,
  webgl: () => LINE + `function setup() { createCanvas(640, 360, WEBGL); }
function draw() { background(30, 40, 90); rotateX(frameCount * 0.02); rotateY(frameCount * 0.03); normalMaterial(); box(140); }`,
  quiet: () => LINE + `function setup() { createCanvas(641, 361); startSound('synth/pluck'); }
function draw() { background(frameCount % 200, 60, 90); fill(255); circle((frameCount * 4) % width, height / 2, 60); }`,
  p5sound: () => LINE + `let osc;
function setup() { createCanvas(400, 300); osc = new p5.Oscillator('sine'); osc.freq(330); osc.amp(0.5); }
function mousePressed() { if (typeof userStartAudio === 'function') userStartAudio(); osc.start(); }
function draw() { background(frameCount % 255, 80, 120); }`,
};
const INIT = `(() => {
  const M = window.MediaRecorder; window.__mr = 0;
  if (M) { window.MediaRecorder = class extends M { constructor(...a) { super(...a); window.__mr++; } }; }
  const o = (window.__testOpts || {});
})();`;
const NO_MP4 = `(() => { const M = window.MediaRecorder; if (!M) return; const yes = M.isTypeSupported.bind(M);
  M.isTypeSupported = (t) => !/mp4/i.test(t) && yes(t); })();`;
const BLACK = `(() => { const orig = HTMLCanvasElement.prototype.captureStream;
  HTMLCanvasElement.prototype.captureStream = function (fps) {
    if (!this.classList.contains('p5Canvas')) return orig.call(this, fps);
    const b = document.createElement('canvas'); b.width = this.width; b.height = this.height;
    const g = b.getContext('2d'); const paint = () => { g.fillStyle = '#000'; g.fillRect(0, 0, b.width, b.height); requestAnimationFrame(paint); }; paint();
    return orig.call(b, fps);
  }; })();`;

let bad = 0;
const report = [];
const row = (ok, name, extra) => { if (!ok) bad++; const line = `${ok ? '✅' : '❌'} ${name}${extra ? '  ' + extra : ''}`; console.log(line); report.push(line); };

// ---- the file, read back
function ff(args) { return spawnSync(args[0], args.slice(1), { encoding: 'utf8', maxBuffer: 64 << 20 }); }
function probe(f) {
  const r = ff(['ffprobe', '-v', 'error', '-show_entries', 'stream=codec_type,codec_name,width,height,profile:format=duration,size', '-of', 'json', f]);
  const j = JSON.parse(r.stdout || '{}');
  const v = (j.streams || []).find((s) => s.codec_type === 'video'), a = (j.streams || []).find((s) => s.codec_type === 'audio');
  let dur = j.format && +j.format.duration;
  if (!(dur > 0)) {                                  // a WebM straight from MediaRecorder has no duration in its header
    const p = ff(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'packet=pts_time', '-of', 'csv=p=0', f]).stdout.trim().split('\n').map(parseFloat).filter((x) => x >= 0);
    dur = p.length ? Math.max(...p) : 0;
  }
  return { video: v ? `${v.codec_name} ${v.width}×${v.height}${v.profile ? ' ' + v.profile : ''}` : null, audio: a ? a.codec_name : null, w: v && v.width, h: v && v.height, dur: Math.round(dur * 100) / 100 };
}
function volume(f) {
  const e = ff(['ffmpeg', '-nostats', '-hide_banner', '-i', f, '-vn', '-af', 'volumedetect', '-f', 'null', '-']).stderr;
  const mean = /mean_volume:\s*(-?[\d.]+|-inf) dB/.exec(e), max = /max_volume:\s*(-?[\d.]+|-inf) dB/.exec(e);
  const n = (m) => (m ? (m[1] === '-inf' ? -Infinity : +m[1]) : null);
  return { mean: n(mean), max: n(max) };
}
function luma(f) {                                    // per frame: the average luma and the brightest pixel's (0..255)
  const e = ff(['ffmpeg', '-nostats', '-hide_banner', '-i', f, '-an', '-vf', 'signalstats,metadata=print', '-f', 'null', '-']).stderr;
  const ys = [...e.matchAll(/YAVG=([\d.]+)/g)].map((m) => +m[1]), tops = [...e.matchAll(/YMAX=([\d.]+)/g)].map((m) => +m[1]);
  // a black frame is Y 0 (full range) or 16 (limited range, as Chromium's encoder writes it): judge by the brightest pixel
  return { frames: ys.length, avg: ys.length ? Math.round(ys.reduce((a, b) => a + b, 0) / ys.length) : null, top: tops.length ? Math.round(Math.max(...tops)) : null };
}

(async () => {
  const srv = http.createServer((q, r) => {
    const u = new URL(q.url, 'http://x');
    const send = (type, body) => { r.setHeader('Content-Type', type); r.setHeader('Access-Control-Allow-Origin', '*'); r.end(body); };
    const q1 = (k) => u.searchParams.get(k);
    if (u.pathname === '/page') {
      const v = q1('v'), snd = q1('snd') === '1';
      return send('text/html', `<!doctype html><meta charset="utf-8"><title>rec</title><style>body{margin:0;background:#111}</style>
<script>window.OAV_P5 = Object.assign({ hardware: 'off', relay: 'ws://127.0.0.1:1/relay' }, ${q1('opts') || '{}'});</script>
<script src="/p5/p5-${v}.min.js"></script>${snd ? `<script src="/p5/${soundFor(v)}"></script>` : ''}<script src="/sketch.js?kind=${q1('kind')}"></script>`);
    }
    if (u.pathname === '/bare') {
      const v = q1('v');
      return send('text/html', `<!doctype html><meta charset="utf-8"><script src="/p5/p5-${v}.min.js"></script><script src="/p5/${soundFor(v)}"></script>
<script>function setup(){createCanvas(100,100);}function draw(){}</script>`);
    }
    if (u.pathname === '/sketch.js') return send('text/javascript', SKETCHES[q1('kind')]().replace('https://openaudiovisual.com/p5/oav-p5.js', '/oav/p5/oav-p5.js'));
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
  fs.mkdirSync(SHOTS, { recursive: true }); fs.mkdirSync(OUT, { recursive: true });

  const EXE = {
    chrome: ['chromium', process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'],
    chromium: ['chromium', process.env.CHROMIUM],
    webkit: ['webkit', process.env.WEBKIT],
  };
  for (const target of TARGETS) {
    const [kind, exe] = EXE[target] || [];
    if (!kind || (exe && !fs.existsSync(exe))) { console.log(`(skipping ${target}: no browser at ${exe})`); continue; }
    // the fake microphone, "Allow" pressed for us; audio only after a click, as for a person (headless would allow it at once)
    const args = kind === 'chromium' ? ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=user-gesture-required'] : [];
    const b = await PW[kind].launch({ executablePath: exe || undefined, headless: true, args });
    const bname = `${target} ${b.version()}`;
    console.log(`\n== ${bname}`); report.push(`\n== ${bname}`);
    const versions = target === 'chrome' ? VERSIONS : [VERSIONS[0], VERSIONS[VERSIONS.length - 1]];

    /** a fresh page with error, request and download watching */
    const open = async (v, sk, { opts = {}, snd = false, init = [], locale = 'zh-TW', viewport = { width: 1000, height: 640 }, perms = true } = {}) => {
      const ctx = await b.newContext({ viewport, locale, acceptDownloads: true });
      if (perms && kind === 'chromium') await ctx.grantPermissions(['microphone']).catch(() => {});
      await ctx.routeWebSocket(/:7457|127\.0\.0\.1:1\//, (ws) => ws.close());
      await ctx.addInitScript(INIT);
      for (const s of init) await ctx.addInitScript(s);
      const p = await ctx.newPage(); const errs = [], urls = [];
      p.on('pageerror', (e) => errs.push(e.message));
      p.on('console', (m) => { const t = m.text(); if (m.type() === 'error' && !/Failed to load resource|favicon/.test(t)) errs.push('console: ' + t); if (/🌸 p5\.js says/.test(t) && /startRecording|stopRecording|recordingIsOn|recordingSaved/.test(t)) errs.push('p5 FES: ' + t.slice(0, 160)); });
      p.on('request', (q) => urls.push(q.url()));
      await p.goto(`${base}/page?v=${v}&kind=${sk}&snd=${snd ? 1 : 0}&opts=${encodeURIComponent(JSON.stringify(opts))}`);
      await p.waitForFunction(() => typeof frameCount === 'number' && frameCount > 5, null, { timeout: 10000 }).catch(() => {});
      return { ctx, p, errs, urls };
    };
    /** startRecording(sec) (or a click on ⏺), wait for the download, save it, read it back */
    const take = async (p, label, start, timeout = 20000) => {
      const dl = p.waitForEvent('download', { timeout });
      await start();
      const d = await dl.catch((e) => null);
      if (!d) return { file: null, name: null };
      const name = d.suggestedFilename(), file = path.join(OUT, `${label}-${name}`);
      await d.saveAs(file);
      await p.waitForFunction(() => OAVp5.record.state === 'off' && OAVp5.record.last, null, { timeout: 10000 }).catch(() => {});
      const info = await p.evaluate(() => { const l = OAVp5.record.last; return l && { name: l.name, format: l.format, type: l.type, seconds: l.seconds, bytes: l.bytes, width: l.width, height: l.height, audio: l.audio, heard: l.heard, sources: l.sources, warnings: l.warnings }; });
      const hints = await p.evaluate(() => OAVp5.hints.map((h) => h.id));
      return { file, name, info, hints, probe: probe(file), vol: volume(file), luma: luma(file) };
    };
    const clickCanvas = (p) => p.mouse.click(200, 150);

    for (const v of versions) {
      const tag = `${target} · p5 ${v}`;
      // 0. the names
      {
        const ctx = await b.newContext(); const p = await ctx.newPage();
        await p.goto(`${base}/bare?v=${v}`);
        await p.waitForFunction(() => typeof p5 !== 'undefined', null, { timeout: 10000 }).catch(() => {});
        await p.waitForTimeout(400);
        const taken = await p.evaluate((ours) => ours.filter((n) => n in window || n in p5.prototype), NAMES);
        row(taken.length === 0, `${tag}: none of ${NAMES.join(', ')} is a p5 / p5.sound name`, JSON.stringify(taken));
        await ctx.close();
      }

      // 1. an old sketch records nothing: no MediaRecorder, no packages/record, nothing new but ⏺ 📷 in the panel
      {
        const { ctx, p, errs, urls } = await open(v, 'plain');
        await clickCanvas(p); await p.keyboard.press('a');
        await p.evaluate(() => { midi.play(60, 0.8); midi.play(60, 0); });
        const before = await p.evaluate(() => ({ dot: !!document.getElementById('oav-p5-rec-dot'), hints: OAVp5.hints.length, on: recordingIsOn, state: OAVp5.record.state, btn: document.getElementById('oav-p5-button').textContent }));
        await p.click('#oav-p5-button');
        await p.waitForSelector('#oav-p5-rec-button', { timeout: 5000 }).catch(() => {});
        await p.waitForTimeout(500);
        const s = await p.evaluate(() => ({ mr: window.__mr, rec: (document.getElementById('oav-p5-rec-button') || {}).textContent, shot: (document.getElementById('oav-p5-shot-button') || {}).textContent, dot: !!document.getElementById('oav-p5-rec-dot'), hints: OAVp5.hints.map((h) => h.id) }));
        const rec = urls.filter((x) => /packages\/record\//.test(x));
        row(s.mr === 0 && rec.length === 0 && !before.dot && !s.dot && before.hints === 0 && s.hints.length === 0 && before.on === false && before.state === 'off' && before.btn.trim() === '🎹',
          `${tag}: an old sketch: no MediaRecorder, no packages/record, no red dot, no card, recordingIsOn false`, JSON.stringify({ mr: s.mr, rec, btn: before.btn, hints: s.hints }));
        row(/⏺/.test(s.rec || '') && /📷/.test(s.shot || ''), `${tag}: …the 🎹 panel offers ⏺ and 📷`, JSON.stringify({ rec: s.rec, shot: s.shot }));
        row(errs.length === 0, `${tag}: …no page errors`, errs.join(' | ').slice(0, 300));
        await ctx.close();
      }

      // 2. examples/record: startSound + startDrums, 3 s of picture and sound
      {
        const { ctx, p, errs } = await open(v, 'record');
        await clickCanvas(p);
        await p.waitForFunction(() => soundIsOn === true && drumsAreOn === true, null, { timeout: 25000 }).catch(() => {});
        await p.waitForTimeout(600);
        const t = await take(p, `${target}-p5-${v}-record`, () => p.evaluate(() => {
          startRecording(3);
          [0, 700, 1400, 2100].forEach((ms, i) => setTimeout(() => { midi.play(60 + i * 4, 0.9); setTimeout(() => midi.play(60 + i * 4, 0), 500); }, ms + 200));
        }));
        const pr = t.probe || {}, i = t.info || {};
        row(!!t.file && /^oav-\d{8}-\d{6}\.(mp4|webm)$/.test(t.name), `${tag}: examples/record → a download named oav-<date>-<time>.<ext>`, t.name);
        row(pr.video && pr.audio && pr.dur >= 2.4 && pr.dur <= 3.9, `${tag}: …ffprobe: a video and an audio stream, about 3 s`, JSON.stringify({ video: pr.video, audio: pr.audio, dur: pr.dur, bytes: i.bytes }));
        row(t.vol && t.vol.mean > -60, `${tag}: …the sound is in it (volumedetect, startSound + drums)`, JSON.stringify(t.vol));
        row(i.audio && i.heard && (i.sources || []).includes('sound') && (i.sources || []).includes('drums') && (i.warnings || []).length === 0,
          `${tag}: …recordingSaved info: sources sound + drums, heard, no warnings`, JSON.stringify({ format: i.format, type: i.type, sources: i.sources, warnings: i.warnings, wh: `${i.width}×${i.height}`, s: i.seconds }));
        row(t.luma && t.luma.top > 60, `${tag}: …the picture is not black`, JSON.stringify(t.luma));
        const last = await p.evaluate(() => typeof lastTake === 'string' ? lastTake : null);
        row(last && last.includes(t.name), `${tag}: …the sketch's recordingSaved(info) was called`, last);
        row(errs.length === 0, `${tag}: …no page errors`, errs.join(' | ').slice(0, 300));
        report.push(`   file ${t.file} · ${JSON.stringify(pr)} · mean ${t.vol && t.vol.mean} dB, max ${t.vol && t.vol.max} dB`);
        await ctx.close();
      }

      // 3. the fake microphone is recorded; record=nomic leaves it out
      if (kind === 'chromium') {
        for (const nomic of [false, true]) {
          const { ctx, p, errs } = await open(v, 'mic', { opts: nomic ? { record: 'nomic' } : {} });
          await clickCanvas(p);
          await p.waitForFunction(() => micIsOn === true, null, { timeout: 8000 }).catch(() => {});
          await p.waitForTimeout(500);
          const t = await take(p, `${target}-p5-${v}-mic${nomic ? '-nomic' : ''}`, () => p.evaluate(() => startRecording(3)));
          const i = t.info || {};
          if (!nomic) row(t.vol && t.vol.mean > -90 && (i.sources || []).includes('mic') && i.heard, `${tag}: the fake microphone is in the take`, JSON.stringify({ vol: t.vol, sources: i.sources, audio: t.probe && t.probe.audio }));
          else row(t.vol && !(t.vol.max > -80) && !(i.sources || []).includes('mic') && (i.warnings || []).length === 0, `${tag}: record=nomic: the microphone is on but stays out of the take`, JSON.stringify({ vol: t.vol, sources: i.sources, warnings: i.warnings }));
          row(errs.length === 0, `${tag}: …mic${nomic ? ' nomic' : ''}: no page errors`, errs.join(' | ').slice(0, 300));
          await ctx.close();
        }
      }

      // 4. a WEBGL canvas
      {
        const { ctx, p, errs } = await open(v, 'webgl');
        await clickCanvas(p);
        const px = await p.evaluate(() => { const c = [...document.querySelectorAll('canvas.p5Canvas')].find((x) => x.offsetWidth); return c && `${c.width}×${c.height}`; });
        const t = await take(p, `${target}-p5-${v}-webgl`, () => p.evaluate(() => startRecording(2)));
        const pr = t.probe || {}, i = t.info || {};
        row(pr.video && t.luma && t.luma.top > 60 && (i.warnings || []).length === 0, `${tag}: a WEBGL canvas is recorded, not black (canvas ${px})`, JSON.stringify({ video: pr.video, dur: pr.dur, luma: t.luma, warnings: i.warnings }));
        row(errs.length === 0, `${tag}: …webgl: no page errors`, errs.join(' | ').slice(0, 300));
        await ctx.close();
      }

      // 5. p5.sound next to it: 1.x is recorded; 2.x's p5.sound says it is not
      {
        const { ctx, p, errs } = await open(v, 'p5sound', { snd: true });
        await clickCanvas(p); await p.waitForTimeout(500);
        const t = await take(p, `${target}-p5-${v}-p5sound`, () => p.evaluate(() => startRecording(2)));
        const i = t.info || {};
        if (v.startsWith('1.')) row(t.vol && t.vol.mean > -40 && (i.sources || []).includes('p5sound'), `${tag}: p5.sound 1.x (an oscillator) is in the take`, JSON.stringify({ vol: t.vol, sources: i.sources }));
        else row((t.hints || []).includes('recP5sound') && !(i.sources || []).includes('p5sound'), `${tag}: p5.sound 0.4 (p5 2.x) is not recorded, and a card says so`, JSON.stringify({ vol: t.vol, hints: t.hints }));
        row(errs.length === 0, `${tag}: …p5.sound: no page errors`, errs.join(' | ').slice(0, 300));
        await ctx.close();
      }

      // 6. sound on, nothing played: the "no sound" card (and an odd-sized canvas: an MP4 is even-sized)
      if (target === 'chrome' || v === versions[0]) {
        const { ctx, p, errs } = await open(v, 'quiet');
        await clickCanvas(p);
        await p.waitForFunction(() => soundIsOn === true, null, { timeout: 25000 }).catch(() => {});
        const t = await take(p, `${target}-p5-${v}-quiet`, () => p.evaluate(() => startRecording(2)));
        const i = t.info || {}, pr = t.probe || {};
        row((t.hints || []).some((h) => /^recSilent/.test(h)) && i.heard === false, `${tag}: sound on but nothing played: the "no sound" card`, JSON.stringify({ hints: t.hints, vol: t.vol }));
        row(i.format !== 'mp4' || (pr.w === 640 && pr.h === 360 && i.width === 640 && i.height === 360), `${tag}: …a 641×361 canvas: ${i.format} ${pr.w}×${pr.h}, info says ${i.width}×${i.height}`);
        const k = await take(p, `${target}-p5-${v}-keys`, () => p.evaluate(() => {
          startRecording(2);
          [100, 600, 1100].forEach((ms, j) => setTimeout(() => { midi.play(62 + j * 3, 0.9); setTimeout(() => midi.play(62 + j * 3, 0), 400); }, ms));
        }));
        const ki = k.info || {};
        row(k.vol && k.vol.mean > -60 && ki.heard && (ki.warnings || []).length === 0 && (ki.sources || []).join() === 'sound', `${tag}: …then three notes: startSound() alone (Tone.js) is in the take`, JSON.stringify({ vol: k.vol, sources: ki.sources, warnings: ki.warnings }));
        row(errs.length === 0, `${tag}: …quiet: no page errors`, errs.join(' | ').slice(0, 300));
        await ctx.close();
      }

      // 6b. started from code before any click (a browser holds audio back until one): the picture is still recorded, at length
      if (v === versions[0]) {
        const { ctx, p, errs } = await open(v, 'webgl');
        const t = await take(p, `${target}-p5-${v}-noclick`, () => p.evaluate(() => startRecording(2)));
        const pr = t.probe || {}, i = t.info || {};
        row(pr.video && pr.dur >= 1.5 && pr.dur <= 2.6 && t.luma.top > 60 && (i.warnings || []).length === 0, `${tag}: startRecording(2) before any click: 2 s of picture, no false alarm`, JSON.stringify({ video: pr.video, audio: pr.audio, dur: pr.dur, warnings: i.warnings }));
        row(errs.length === 0, `${tag}: …no click: no page errors`, errs.join(' | ').slice(0, 300));
        await ctx.close();
      }

      // 7. a browser without MP4 (Firefox, Chrome before 126): WebM, and the card that says Instagram will not take it
      if (v === versions[0]) {
        const { ctx, p, errs } = await open(v, 'drums', { init: [NO_MP4] });
        await clickCanvas(p); await p.waitForTimeout(800);
        const t = await take(p, `${target}-p5-${v}-nomp4`, () => p.evaluate(() => startRecording(2)));
        const i = t.info || {}, pr = t.probe || {};
        const card = await p.evaluate(() => { const c = document.querySelector('[data-hint^="recWebm"]'); return c && c.textContent; });
        row(i.format === 'webm' && /\.webm$/.test(t.name || '') && /vp8|vp9/.test(pr.video || '') && pr.audio === 'opus' && t.vol.mean > -60 && card,
          `${tag}: no MP4 here: a .webm (VP9/Opus, with the drums) and the Instagram card`, JSON.stringify({ name: t.name, video: pr.video, audio: pr.audio, dur: pr.dur, vol: t.vol, card: card && card.slice(0, 40) }));
        row(errs.length === 0, `${tag}: …webm: no page errors`, errs.join(' | ').slice(0, 300));
        await ctx.close();
      }

      // 8. the iOS check, simulated: the file is black while the canvas was not
      if (v === versions[0]) {
        const { ctx, p, errs } = await open(v, 'drums', { init: [BLACK] });
        await clickCanvas(p); await p.waitForTimeout(800);
        const t = await take(p, `${target}-p5-${v}-black`, () => p.evaluate(() => startRecording(2)));
        await p.waitForTimeout(300);
        const card = await p.evaluate(() => { const c = document.querySelector('[data-hint^="recBlack"]'); return c && c.textContent; });
        row((t.info.warnings || []).includes('recBlack') && card && t.luma.top <= 20, `${tag}: a black take (simulated WebKit 229611) is said on the page`, JSON.stringify({ luma: t.luma, warnings: t.info.warnings, card: card && card.slice(0, 30) }));
        row(errs.length === 0, `${tag}: …black: no page errors`, errs.join(' | ').slice(0, 300));
        await ctx.close();
      }

      // 9. the buttons: ⏺ in the panel, the red dot on the 🎹, the saved card, 📷 (screenshots on the first run)
      if (v === versions[0] || target === 'chrome') {
        const { ctx, p, errs } = await open(v, 'record');
        await clickCanvas(p);
        await p.waitForFunction(() => soundIsOn === true && drumsAreOn === true, null, { timeout: 25000 }).catch(() => {});
        await p.click('#oav-p5-button');
        await p.waitForSelector('#oav-p5-rec-button', { timeout: 5000 });
        const dl = p.waitForEvent('download', { timeout: 20000 });
        await p.click('#oav-p5-rec-button');
        for (const [ms, n] of [[300, 60], [700, 64], [1100, 67]]) setTimeout(() => p.evaluate((x) => { midi.play(x, 0.9); setTimeout(() => midi.play(x, 0), 400); }, n).catch(() => {}), ms);
        await p.waitForTimeout(2300);
        const shots = v === versions[0] && target === 'chrome';
        const on = await p.evaluate(() => ({ btn: document.getElementById('oav-p5-rec-button').textContent, dot: (document.getElementById('oav-p5-rec-dot') || {}).textContent, on: recordingIsOn, state: OAVp5.record.state }));
        if (shots) await p.screenshot({ path: path.join(SHOTS, 'rec-panel.png') });
        await p.click('#oav-p5-panel button:has-text("收起")');            // 收起 the panel: the dot stays on the 🎹
        await p.waitForTimeout(1200);
        if (shots) await p.screenshot({ path: path.join(SHOTS, 'rec-dock.png') });
        if (shots) await p.locator('#oav-p5-button').screenshot({ path: path.join(SHOTS, 'rec-dock-zoom.png') }).catch(() => {});
        await p.click('#oav-p5-rec-dot');                                 // the dot stops it
        const d = await dl.catch(() => null);
        await p.waitForSelector('[data-hint^="recSaved"]', { timeout: 10000 }).catch(() => {});
        await p.waitForTimeout(600);
        const after = await p.evaluate(() => ({ card: (document.querySelector('[data-hint^="recSaved"]') || {}).textContent, dot: !!document.getElementById('oav-p5-rec-dot'), on: recordingIsOn }));
        if (shots) await p.screenshot({ path: path.join(SHOTS, 'rec-saved.png') });
        row(/⏹/.test(on.btn) && /^●\s*00:0[12]$/.test((on.dot || '').trim()) && on.on === true, `${tag}: ⏺ in the panel starts it: the button says ⏹ + time, the 🎹 grows a red dot + time, recordingIsOn`, JSON.stringify(on));
        row(!!d && /錄好了/.test(after.card || '') && !after.dot && after.on === false, `${tag}: the red dot stops it: a download, the saved card, the dot gone`, JSON.stringify({ file: d && d.suggestedFilename(), card: (after.card || '').slice(0, 120) }));
        // 📷
        await p.click('#oav-p5-button');
        await p.waitForSelector('#oav-p5-shot-button', { state: 'visible', timeout: 5000 }).catch(() => {});
        const sd = p.waitForEvent('download', { timeout: 8000 });
        await p.click('#oav-p5-shot-button');
        const s = await sd.catch(() => null);
        let png = null;
        if (s) { const f = path.join(OUT, `${target}-p5-${v}-shot-${s.suggestedFilename()}`); await s.saveAs(f); const buf = fs.readFileSync(f); png = { name: s.suggestedFilename(), w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) }; }
        const cv = await p.evaluate(() => { const c = [...document.querySelectorAll('canvas.p5Canvas')].find((x) => x.offsetWidth); return { w: c.width, h: c.height, id: c.id }; });
        row(png && /^oav-\d{8}-\d{6}\.png$/.test(png.name) && png.w === cv.w && png.h === cv.h, `${tag}: 📷 saves the canvas alone as a PNG at its pixel size`, JSON.stringify({ png, canvas: cv }));
        if (shots) { await p.waitForTimeout(300); await p.screenshot({ path: path.join(SHOTS, 'rec-shot-card.png') }); }
        row(errs.length === 0, `${tag}: …buttons: no page errors`, errs.join(' | ').slice(0, 300));
        await ctx.close();
      }

      // 10. record=off: no ⏺, startRecording() does nothing; and the 🩺 line
      if (v === versions[0]) {
        const { ctx, p, errs } = await open(v, 'plain', { opts: { record: 'off' } });
        const r = await p.evaluate(async () => ({ started: await startRecording(1), mr: window.__mr, state: OAVp5.record.state }));
        await p.click('#oav-p5-button'); await p.waitForTimeout(400);
        const ui = await p.evaluate(() => ({ rec: getComputedStyle(document.getElementById('oav-p5-rec-button')).display, shot: getComputedStyle(document.getElementById('oav-p5-shot-button')).display, line: OAVp5.check({ show: false }).text.split('\n').find((l) => /^錄影/.test(l)) }));
        row(r.started === false && r.mr === 0 && ui.rec === 'none' && ui.shot === 'none' && /record=off/.test(ui.line || ''), `${tag}: record=off: no ⏺ / 📷, startRecording() is false, 🩺 says so`, JSON.stringify({ r, ui }));
        const { ctx: c2, p: p2 } = await open(v, 'plain');
        const line = await p2.evaluate(() => OAVp5.check({ show: false }).text.split('\n').find((l) => /^錄影/.test(l)));
        row(/MP4|WebM/.test(line || ''), `${tag}: 🩺 has a line for recording`, line);
        row(errs.length === 0, `${tag}: …record=off: no page errors`, errs.join(' | ').slice(0, 300));
        await ctx.close(); await c2.close();
      }
    }
    await b.close();
  }
  srv.close();
  console.log(bad ? `\n${bad} check(s) failed` : '\nall checks passed');
  if (process.env.REPORT) fs.writeFileSync(process.env.REPORT, report.join('\n') + '\n');
  process.exit(bad ? 1 : 0);
})();
