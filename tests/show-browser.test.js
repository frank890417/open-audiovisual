// createShow in a real page: the `loop` and `monitor` options, end to end (the pure parts are in
// show-options.test.js, loop.test.js). Needs Playwright with a Chromium; without it these skip.
//   OAV_PLAYWRIGHT=/path/to/playwright-core/index.mjs  (as in tests/check-page.test.js)   OAV_BROWSER_EXEC=/path/to/chrome (optional)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pw = null;
for (const p of [process.env.OAV_PLAYWRIGHT, '/opt/node-tools/node_modules/playwright-core/index.mjs'].filter(Boolean)) {
  try { pw = await import(p); break; } catch { /* try the next */ }
}
const SKIP = pw ? false : 'Playwright not available (set OAV_PLAYWRIGHT)';

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
function serve() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (p.endsWith('/')) p += 'index.html';
      const f = path.join(ROOT, p);
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('nf'); }
      res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' });
      fs.createReadStream(f).pipe(res);
    });
    srv.listen(0, '127.0.0.1', () => resolve({ srv, base: `http://127.0.0.1:${srv.address().port}` }));
  });
}

/** Records every WebSocket the page tries to open and never connects (so nothing logs a refused connection). */
const SPY = `window.__sockets = []; window.WebSocket = class { constructor(u) { window.__sockets.push(String(u)); } close() {} send() {} };`;

async function withPage(fn) {
  const { srv, base } = await serve();
  const browser = await pw.chromium.launch({ executablePath: process.env.OAV_BROWSER_EXEC || undefined });
  try {
    const ctx = await browser.newContext();
    await ctx.addInitScript(SPY);
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push('pageerror ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push('console ' + m.text()); });
    await page.goto(base + '/tests/fixtures/show-page.html');
    await page.waitForFunction(() => typeof window.__start === 'function');
    await fn(page, errors);
    assert.deepEqual(errors, [], 'no console errors');
  } finally { await browser.close(); srv.close(); }
}
const opts = { skip: SKIP, timeout: 60000 };

test('show: loop "manual" — real time moves nothing; each show.loop.step(dt) is one frame of the whole show', opts, async () => {
  await withPage(async (page) => {
    const r = await page.evaluate(async () => {
      const show = await window.__start({ loop: 'manual', monitor: false });
      show.timeline.play();
      await new Promise((res) => setTimeout(res, 400));                    // real time passes; requestAnimationFrame is not used
      const idle = { frames: window.__frames, t: show.timeline.t, running: show.loop.running, manual: show.loop.manual };
      for (let i = 0; i < 60; i++) show.loop.step(1 / 60);
      return { idle, frames: window.__frames, t: show.timeline.t, x: window.__x, dt: window.__lastDt, fps: show.loop.fps };
    });
    assert.deepEqual(r.idle, { frames: 0, t: 0, running: true, manual: true });
    assert.equal(r.frames, 60);
    assert.ok(Math.abs(r.t - 1) < 1e-9, 'sixty frames of 1/60 s = one show second, whatever the wall clock did: ' + r.t);
    assert.ok(Math.abs(r.x - 1 / 60) < 1e-6, 'the param followed the timeline: ' + r.x);
    assert.ok(Math.abs(r.dt - 1 / 60) < 1e-12);
    assert.equal(r.fps, 60);
  });
});

test('show: loop "manual" is deterministic — two runs of the same steps end in the same state, a paused show stays still', opts, async () => {
  const run = (page) => page.evaluate(async () => {
    const show = await window.__start({ loop: 'manual', monitor: false });
    show.timeline.play();
    for (let i = 0; i < 300; i++) show.loop.step(i % 2 ? 1 / 30 : 1 / 60);
    show.timeline.pause();
    const t = show.timeline.t;
    show.loop.step(5);                                                       // a long step while paused moves nothing
    return { t, after: show.timeline.t, x: window.__x };
  });
  let a, b;
  await withPage(async (page) => { a = await run(page); });
  await withPage(async (page) => { b = await run(page); });
  assert.deepEqual(a, b);
  assert.equal(a.t, a.after);
});

test('show: loop { clock, raf } — a fake clock and raf drive the whole show, and the page\'s own requestAnimationFrame is never asked', opts, async () => {
  await withPage(async (page) => {
    const r = await page.evaluate(async () => {
      const f = window.__fakes();
      let realRaf = 0; const orig = window.requestAnimationFrame; window.requestAnimationFrame = (cb) => { realRaf++; return orig(cb); };
      const show = await window.__start({ loop: { clock: f.clock, raf: f.raf }, monitor: false });
      const afterStart = window.__frames;
      show.timeline.play();
      await new Promise((res) => setTimeout(res, 300));
      const idle = window.__frames;
      for (let i = 0; i < 30; i++) f.advance(1000 / 60);
      return { afterStart, idle, frames: window.__frames, t: show.timeline.t, realRaf, pending: f.pending };
    });
    assert.equal(r.idle, r.afterStart, 'no frame until the fake raf is advanced');
    assert.equal(r.frames - r.afterStart, 30);
    assert.ok(Math.abs(r.t - 0.5) < 1e-9, String(r.t));
    assert.equal(r.realRaf, 0);
    assert.equal(r.pending, 1);
  });
});

test('show: monitor — default tries the relay on this machine, false never opens a socket, { url } uses that address', opts, async () => {
  await withPage(async (page) => {
    const r = await page.evaluate(async () => {
      window.__sockets.length = 0;
      const on = await window.__start({ loop: 'manual' });
      const dflt = { sockets: [...window.__sockets], hasFeed: !!on.monitor, url: on.monitor?.url };
      window.__sockets.length = 0;
      const off = await window.__start({ loop: 'manual', monitor: false });
      const none = { sockets: [...window.__sockets], monitor: off.monitor };
      window.__sockets.length = 0;
      const custom = await window.__start({ loop: 'manual', monitor: { url: 'ws://192.168.1.50:7457', hz: 4 } });
      return { dflt, none, custom: { sockets: [...window.__sockets], url: custom.monitor.url, hz: custom.monitor.hz } };
    });
    assert.deepEqual(r.dflt.sockets, [r.dflt.url], 'one socket, to the default address');
    assert.match(r.dflt.url, /^ws:\/\/127\.0\.0\.1:7457\?role=stage$/);
    assert.equal(r.dflt.hasFeed, true);
    assert.deepEqual(r.none.sockets, []);
    assert.equal(r.none.monitor, null);
    assert.deepEqual(r.custom.sockets, ['ws://192.168.1.50:7457?role=stage']);
    assert.equal(r.custom.hz, 4);
  });
});

test('show: a bad loop or monitor option throws before the page is touched', opts, async () => {
  await withPage(async (page) => {
    const errs = await page.evaluate(async () => {
      const out = [];
      for (const o of [{ loop: 'fast' }, { monitor: 'off' }]) {
        const before = document.querySelectorAll('.oav-stage').length;
        try { await window.__start(o); out.push('no error'); } catch (e) { out.push(e.message + ' | stages added: ' + (document.querySelectorAll('.oav-stage').length - before)); }
      }
      return out;
    });
    assert.match(errs[0], /loop.*stages added: 0/s);
    assert.match(errs[1], /monitor.*stages added: 0/s);
  });
});
