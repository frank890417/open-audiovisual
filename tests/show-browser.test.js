// createShow in a real page: the `monitor` option, end to end (the pure parts are in
// show-options.test.js). Needs Playwright with a Chromium; without it these skip.
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

test('show: monitor — default tries the relay on this machine, false never opens a socket, { url } uses that address', opts, async () => {
  await withPage(async (page) => {
    const r = await page.evaluate(async () => {
      window.__sockets.length = 0;
      const on = await window.__start({});
      const dflt = { sockets: [...window.__sockets], hasFeed: !!on.monitor, url: on.monitor?.url };
      window.__sockets.length = 0;
      const off = await window.__start({ monitor: false });
      const none = { sockets: [...window.__sockets], monitor: off.monitor };
      window.__sockets.length = 0;
      const custom = await window.__start({ monitor: { url: 'ws://192.168.1.50:7457', hz: 4 } });
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

test('show: a bad monitor option throws before the page is touched', opts, async () => {
  await withPage(async (page) => {
    const errs = await page.evaluate(async () => {
      const out = [];
      for (const o of [{ monitor: 'off' }]) {
        const before = document.querySelectorAll('.oav-stage').length;
        try { await window.__start(o); out.push('no error'); } catch (e) { out.push(e.message + ' | stages added: ' + (document.querySelectorAll('.oav-stage').length - before)); }
      }
      return out;
    });
    assert.match(errs[0], /monitor.*stages added: 0/s);
  });
});
