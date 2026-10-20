#!/usr/bin/env node
// reference-smoke.cjs — the API reference page and every example on it, in a real (headless) Chromium.
// Not part of `npm test` (needs a browser and the p5 CDN): CI runs it as the `reference` job, and you run it before a release.
//
//   PW=<path to playwright(-core)> node p5/test/reference-smoke.cjs
//   ONLY=micLevel,noteName          only the entries with these keys
//   P5_VERSIONS=1.11.11,2.3.4       the p5 builds each sketch runs under (default: both)
//   CONCURRENCY=6                   pages at a time
//   SHOTS=<dir>                     screenshots of the page checks
//   OAV_ROOT=<another checkout>     run the same checks against it
//
// It reads docs/reference/reference.json (the dataset tools/build-reference.mjs writes from the code and the words beside it) and:
//
//   1. the PAGE, at 1440 and 390 wide: ?q=micLevel puts micLevel first; #micLevel lands on its card; the search box filters,
//      "/" focuses it, a Chinese query finds an entry through its keywords; no sideways scroll; ▶ Run puts a live sketch in the page
//   2. every SKETCH example (run: 'sketch'), once per p5 version: the entry's code, with oav-p5 loaded before it as the loader line
//      does, must run (frameCount moves, a canvas is drawn) with no page error and no console error. A fake microphone is the
//      browser's own fake device; no MIDI hardware exists
//   3. every MODULE example (run: 'module'): the code runs as a module with an import map for @openav/* and a <div id="app"> and
//      <canvas id="c"> to draw into; no page error, no console error
//   4. every CLAIM an entry makes about a value ({ before, expr, equals | min, max, moves }): the expression is read in a running sketch
//      and must say what the entry says. `moves` = the value takes more than one value in a few seconds (a microphone that is listening)
//
// Exit code 1 when any row fails; each row says which entry, which example, which p5.
const fs = require('fs'), path = require('path'), http = require('http'), os = require('os');
const PW = require(process.env.PW || 'playwright');
const ROOT = path.resolve(__dirname, '../..');
const OAV = process.env.OAV_ROOT || ROOT;
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.html': 'text/html', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.txt': 'text/plain', '.ico': 'image/x-icon', '.mp3': 'audio/mpeg', '.wasm': 'application/wasm' };
const P5_VERSIONS = (process.env.P5_VERSIONS || '1.11.11,2.3.4').split(',');
const CONCURRENCY = Math.max(1, +(process.env.CONCURRENCY || 5));
const SHOTS = process.env.SHOTS || fs.mkdtempSync(path.join(os.tmpdir(), 'oav-ref-'));
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const NOISE = [/ERR_UNSAFE_PORT/, /ws:\/\/127\.0\.0\.1:1\/relay/, /ws:\/\/[^ ]*:7457/, /WebSocket connection to 'ws:\/\/[^']*7457/, /googletagmanager|google-analytics|cloudflareinsights/, /net::ERR_(BLOCKED|FAILED|INTERNET)/, /Failed to load resource/];
const LOADER_SRC = 'https://openaudiovisual.com/p5/oav-p5.js';
const data = JSON.parse(fs.readFileSync(path.join(OAV, 'docs/reference/reference.json'), 'utf8'));
const entries = data.entries.filter((e) => !ONLY || ONLY.includes(e.key) || ONLY.includes(e.id));

// the import map: every package's entry points, from its package.json
function importMap() {
  const imports = {};
  for (const d of fs.readdirSync(path.join(OAV, 'packages'))) {
    const f = path.join(OAV, 'packages', d, 'package.json');
    if (!fs.existsSync(f)) continue;
    const pj = JSON.parse(fs.readFileSync(f, 'utf8'));
    const ex = pj.exports && typeof pj.exports === 'object' ? pj.exports : { '.': pj.main || 'index.js' };
    for (const [sub, target] of Object.entries(ex)) {
      if (!sub.startsWith('.') || sub.includes('*') || typeof target !== 'string') continue;
      imports[sub === '.' ? pj.name : pj.name + sub.slice(1)] = `/packages/${d}/${target.replace(/^\.\//, '')}`;
    }
  }
  return imports;
}

let bad = 0, rows = 0;
const say = (ok, name, why) => { rows++; if (!ok) bad++; console.log(`${ok ? '✅' : '❌'} ${name}${!ok && why ? '\n     ' + String(why).split('\n').join('\n     ') : ''}`); };

(async () => {
  const jobs = new Map();   // id → { kind: 'sketch' | 'module', code, v }
  const srv = http.createServer((q, r) => {
    const u = new URL(q.url, 'http://x');
    let p = decodeURIComponent(u.pathname);
    if (p.startsWith('/__run/')) {
      const job = jobs.get(p.slice(7));
      if (!job) { r.writeHead(404); return r.end(); }
      r.setHeader('Content-Type', 'text/html; charset=utf-8');
      const p5 = `https://cdn.jsdelivr.net/npm/p5@${job.v}/lib/p5.min.js`;
      if (job.kind === 'sketch') {
        // an example about a loading option starts with `window.OAV_P5 = { … };`: it runs before oav-p5.js, the sketch after
        const m = /^(window\.OAV_P5\s*=\s*\{[\s\S]*?\};)[ \t]*\n/.exec(job.code);
        const opts = m ? m[1] : '', rest = m ? job.code.slice(m[0].length) : job.code;
        const esc = (x) => x.replace(/<\/script/gi, '<\\/script');
        return r.end(`<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:#111}</style><script>${esc(opts)}\nwindow.OAV_P5=Object.assign({panel:'closed',relay:'ws://127.0.0.1:1/relay'},window.OAV_P5||{})</script><script src="${p5}"></script><script src="/p5/oav-p5.js"></script><script>${esc(rest)}</script>`);
      }
      return r.end(`<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:#111}</style><script type="importmap">${JSON.stringify({ imports: importMap() })}</script><div id="app"></div><canvas id="c" width="400" height="300"></canvas><script type="module">${job.code.replace(/<\/script/gi, '<\\/script')}</script>`);
    }
    if (p.endsWith('/')) p += 'index.html';
    const f = path.join(OAV, p);
    if (!f.startsWith(OAV) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
    r.setHeader('Content-Type', MIME[path.extname(f)] || 'application/octet-stream'); r.setHeader('Access-Control-Allow-Origin', '*');
    r.end(fs.readFileSync(f));
  });
  await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
  const base = `http://127.0.0.1:${srv.address().port}`;
  const browser = await PW.chromium.launch({ headless: true, args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'] });

  async function newPage(viewport) {
    const ctx = await browser.newContext({ viewport: viewport || { width: 800, height: 600 }, permissions: ['microphone'] });
    const page = await ctx.newPage();
    const problems = [];
    page.on('pageerror', (e) => problems.push('page error: ' + (e.stack || e.message).split('\n').slice(0, 3).join(' ⏎ ')));
    page.on('console', (m) => { if (m.type() === 'error' && !NOISE.some((re) => re.test(m.text()))) problems.push('console.error: ' + m.text().slice(0, 300)); });
    await page.route('https://openaudiovisual.com/**', async (route) => {
      const pathname = decodeURIComponent(new URL(route.request().url()).pathname);
      const f = path.join(OAV, pathname.endsWith('/') ? pathname + 'index.html' : pathname);
      if (f.startsWith(OAV) && fs.existsSync(f) && fs.statSync(f).isFile()) return route.fulfill({ status: 200, contentType: MIME[path.extname(f)] || 'application/octet-stream', headers: { 'Access-Control-Allow-Origin': '*' }, body: fs.readFileSync(f) });
      return route.fulfill({ status: 404, body: '' });
    });
    await page.route(/googletagmanager|cloudflareinsights/, (route) => route.abort());
    return { ctx, page, problems };
  }

  // ───────────────────────── 1. the page
  for (const [w, h, label, lang] of [[1440, 900, 'desktop', 'en'], [390, 844, 'mobile', 'en'], [1440, 900, 'desktop', 'zh']]) {
    const { ctx, page, problems } = await newPage({ width: w, height: h });
    const root = lang === 'zh' ? '/zh/docs/reference/' : '/docs/reference/';
    try {
      await page.goto(`${base}${root}?q=micLevel`, { waitUntil: 'load', timeout: 30000 });
      await page.waitForTimeout(700);
      const r = await page.evaluate(() => ({
        first: (([...document.querySelectorAll('.ref')].find((e) => !e.hidden && e.style.order === '0') || {}).dataset || {}).name,
        status: document.querySelector('.ref-search-status').textContent, q: document.querySelector('#ref-q').value,
        overflowX: document.documentElement.scrollWidth > innerWidth + 1, total: document.querySelectorAll('.ref').length,
      }));
      const bad1 = [];
      if (r.first !== 'micLevel') bad1.push(`?q=micLevel: the first result is "${r.first}"`);
      if (r.q !== 'micLevel') bad1.push('?q= did not fill the box');
      if (r.overflowX) bad1.push('the page scrolls sideways');
      await page.screenshot({ path: path.join(SHOTS, `reference-${lang}-${label}-q.png`) });
      // the anchor
      await page.goto(`${base}${root}#micLevel`, { waitUntil: 'load' });
      await page.waitForTimeout(900);
      const a = await page.evaluate(() => { const e = document.getElementById('micLevel'); if (!e) return null; const b = e.getBoundingClientRect(); return { top: Math.round(b.top), h: innerHeight }; });
      if (!a) bad1.push('#micLevel: no such anchor'); else if (a.top < 0 || a.top > a.h * 0.6) bad1.push(`#micLevel lands at y=${a.top} of ${a.h}`);
      await page.screenshot({ path: path.join(SHOTS, `reference-${lang}-${label}-hash.png`) });
      // typing, the "/" key, a Chinese word
      await page.goto(`${base}${root}`, { waitUntil: 'load' });
      await page.keyboard.press('/');
      const focused = await page.evaluate(() => document.activeElement && document.activeElement.id);
      if (focused !== 'ref-q') bad1.push('"/" does not focus the search box');
      await page.keyboard.type('麥克風');
      await page.waitForTimeout(300);
      const zhHit = await page.evaluate(() => [...document.querySelectorAll('.ref')].filter((e) => !e.hidden).sort((x, y) => (+x.style.order) - (+y.style.order)).slice(0, 5).map((e) => e.dataset.name));
      if (!zhHit.includes('micLevel')) bad1.push(`searching 麥克風: micLevel is not in the first five (${zhHit.join(', ')})`);
      await page.fill('#ref-q', 'mic level');
      await page.waitForTimeout(300);
      const words = await page.evaluate(() => [...document.querySelectorAll('.ref')].filter((e) => !e.hidden).sort((x, y) => (+x.style.order) - (+y.style.order)).slice(0, 3).map((e) => e.dataset.name));
      if (!words.includes('micLevel')) bad1.push(`searching "mic level": micLevel is not in the first three (${words.join(', ')})`);
      await page.fill('#ref-q', 'zzzzqqqq');
      await page.waitForTimeout(300);
      if (!(await page.evaluate(() => !document.querySelector('.ref-none').hidden))) bad1.push('a query with no match shows no message');
      await page.screenshot({ path: path.join(SHOTS, `reference-${lang}-${label}-none.png`) });
      // the live example
      await page.goto(`${base}${root}?q=micLevel`, { waitUntil: 'load' });
      await page.waitForTimeout(500);
      // an example on screen runs by itself (quiet: the microphone waits for a click inside the frame)
      await page.locator('.ref:not([hidden]) .ref-live').first().scrollIntoViewIfNeeded();
      const quiet = await page.waitForFunction(() => {
        const f = document.querySelector('.ref-ex.is-live[data-mode="quiet"] iframe');
        const w = f && f.contentWindow;
        return w && typeof w.frameCount === 'number' && w.frameCount > 15 && w.OAVp5 ? { mic: w.OAVp5.mic.state, button: !!f.contentDocument.getElementById('oav-ref-mic') } : false;
      }, null, { timeout: 25000 }).then((h) => h.jsonValue()).catch(() => null);
      if (!quiet) bad1.push('no example ran by itself when scrolled to');
      else if (quiet.mic !== 'off' || !quiet.button) bad1.push(`a quiet micLevel preview asked for the microphone (${quiet.mic}) or has no 🎤 button`);
      const run = page.locator('.ref:not([hidden]) .ref-run').first();
      await run.scrollIntoViewIfNeeded();
      await run.click();
      const fh = await page.waitForSelector('.ref-live iframe', { timeout: 10000 });
      const frame = await fh.contentFrame();
      await frame.waitForFunction(() => typeof window.frameCount === 'number' && window.frameCount > 15, null, { timeout: 25000 });
      await page.screenshot({ path: path.join(SHOTS, `reference-${lang}-${label}-live.png`) });
      say(!bad1.length && !problems.length, `page · ${lang} · ${label} (${w}×${h}): ${r.total} entries, ?q=, #anchor, "/", 麥克風, "mic level", no-match, runs by itself, ▶ Run`, [...bad1, ...problems].join('\n'));
    } catch (e) {
      say(false, `page · ${lang} · ${label}`, [...problems, 'did not run: ' + e.message.split('\n')[0]].join('\n'));
    }
    await ctx.close();
  }

  // ───────────────────────── 2 + 3. the examples, 4. the claims
  const work = [];
  for (const e of entries) {
    e.examples.forEach((ex, i) => {
      if (ex.run === 'static' || (ex.lang && ex.lang !== 'js')) return;
      if (ex.run === 'sketch') for (const v of P5_VERSIONS) work.push({ type: 'example', e, ex, i, v });
      else if (ex.run === 'module') work.push({ type: 'example', e, ex, i, v: null });
    });
  }
  const claimsOf = (e) => (e.claims || []).map((c, i) => ({ type: 'claim', e, c, i }));
  for (const e of entries) for (const w of claimsOf(e)) for (const v of P5_VERSIONS.slice(0, 1)) work.push({ ...w, v });
  console.log(`\n${work.length} runs (${entries.length} entries, p5 ${P5_VERSIONS.join(' & ')}), ${CONCURRENCY} at a time`);

  let n = 0;
  async function one(wk) {
    const id = String(++n);
    const { ctx, page, problems } = await newPage();
    const label = wk.type === 'example'
      ? `${wk.e.key} · example ${wk.i + 1} · ${wk.ex.run}${wk.v ? ' · p5 ' + wk.v : ''}`
      : `${wk.e.key} · claim ${wk.i + 1}: ${wk.c.before ? wk.c.before + ' ⇒ ' : ''}${wk.c.expr}`;
    try {
      if (wk.type === 'example') {
        jobs.set(id, { kind: wk.ex.run, code: wk.ex.code, v: wk.v });
        await page.goto(`${base}/__run/${id}`, { waitUntil: 'load', timeout: 30000 });
        if (wk.ex.run === 'sketch') {
          // a sketch with no draw() never advances frameCount (p5 does not loop): it has run when its canvas is there
          if (/\bfunction\s+draw\b/.test(wk.ex.code)) await page.waitForFunction(() => typeof window.frameCount === 'number' && window.frameCount > 20, null, { timeout: 25000 });
          else await page.waitForSelector('canvas', { timeout: 25000 });
          await page.waitForTimeout(600);
          const r = await page.evaluate(() => ({ canvas: !!document.querySelector('canvas'), cards: ((window.OAVp5 && window.OAVp5.hints) || []).filter((x) => x.kind === 'error').map((x) => x.id + ': ' + x.what) }));
          if (!r.canvas) problems.push('no <canvas>');
          r.cards.forEach((c) => problems.push('oav-p5 error card: ' + c));
        } else {
          await page.waitForTimeout(1200);
        }
      } else {
        jobs.set(id, { kind: 'sketch', code: `function setup(){createCanvas(200,100)} function draw(){background(20)}`, v: wk.v });
        await page.goto(`${base}/__run/${id}`, { waitUntil: 'load', timeout: 30000 });
        await page.waitForFunction(() => typeof window.frameCount === 'number' && window.frameCount > 8 && typeof window.OAVp5 === 'object', null, { timeout: 25000 });
        if (wk.c.before) await page.evaluate((code) => (0, eval)(code), wk.c.before);
        await page.waitForTimeout(150);
        const read = () => page.evaluate((expr) => { try { const v = (0, eval)(expr); return { v: typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean' ? v : JSON.stringify(v) }; } catch (e) { return { err: String(e && e.message || e) }; } }, wk.c.expr);
        const first = await read();
        if (first.err) problems.push(`${wk.c.expr}: ${first.err}`);
        else if (wk.c.moves || wk.c.needs === 'mic') {
          const seen = [first.v]; const t0 = Date.now();
          while (Date.now() - t0 < 5000) { await page.waitForTimeout(60); const x = await read(); if (x.err) { problems.push(x.err); break; } seen.push(x.v); }
          const nums = seen.filter((x) => typeof x === 'number');
          if (wk.c.min !== undefined && nums.some((x) => x < wk.c.min)) problems.push(`${wk.c.expr} went below ${wk.c.min} (${Math.min(...nums)})`);
          if (wk.c.max !== undefined && nums.some((x) => x > wk.c.max)) problems.push(`${wk.c.expr} went above ${wk.c.max} (${Math.max(...nums)})`);
          if (wk.c.moves && new Set(seen).size < 2) problems.push(`${wk.c.expr} never moved in 5 s (always ${seen[0]}): is the microphone really listening?`);
        } else {
          if (wk.c.equals !== undefined && first.v !== wk.c.equals && !(typeof first.v === 'number' && typeof wk.c.equals === 'number' && Math.abs(first.v - wk.c.equals) < 1e-9)) problems.push(`${wk.c.expr} is ${JSON.stringify(first.v)}, the entry says ${JSON.stringify(wk.c.equals)}`);
          if (wk.c.min !== undefined && !(first.v >= wk.c.min)) problems.push(`${wk.c.expr} is ${first.v}, below ${wk.c.min}`);
          if (wk.c.max !== undefined && !(first.v <= wk.c.max)) problems.push(`${wk.c.expr} is ${first.v}, above ${wk.c.max}`);
        }
      }
    } catch (e) { problems.push('did not run: ' + e.message.split('\n')[0]); }
    say(!problems.length, label, problems.join('\n'));
    await ctx.close();
  }
  const queue = [...work];
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => { while (queue.length) await one(queue.shift()); }));

  await browser.close(); srv.close();
  console.log(`\n${rows - bad}/${rows} rows green; screenshots in ${SHOTS}`);
  process.exit(bad ? 1 : 0);
})();
