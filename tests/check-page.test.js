// /check/ and /zh/check/: the device check. One page that looks at this device (browser, secure context, Web MIDI,
// microphone, camera, graphics, the local bridge) and says green / yellow / red with one line of advice and a link
// into the docs. Rules that matter more than the layout:
//   - nothing asks for a permission or touches the network until a person presses that row's button;
//   - Web MIDI is only *detected* on load; the button reads inputs and never opens an output;
//   - the homepage and the controller pages show one strip, from one source, when there is no Web MIDI.
// The browser tests need Playwright (it lives outside the repo: set OAV_PLAYWRIGHT to its index.mjs, or have it in
// the scratchpad); without it they skip and the static tests still run.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(ROOT, rel));
const ROWS = ['browser', 'secure', 'midi', 'mic', 'camera', 'graphics', 'local'];

// ---------------------------------------------------------------------------- static
test('check: both pages exist, are generated, and --check finds them current', async () => {
  assert.ok(exists('tools/build-check.mjs'), 'tools/build-check.mjs');
  for (const f of ['check/index.html', 'zh/check/index.html']) assert.ok(exists(f), f);
  const { stalePages } = await import('../tools/build-check.mjs');
  assert.deepEqual(stalePages(), []);
});

test('check: registered, in the sitemap, with hreflang twins, canonical and JSON-LD', async () => {
  const { registry, sitemapXml } = await import('../tools/site/pages.mjs');
  const e = registry().find((x) => x.id === 'check');
  assert.ok(e, 'registered');
  assert.deepEqual(e.langs, ['en', 'zh']);
  const sm = sitemapXml();
  for (const u of ['https://openaudiovisual.com/check/', 'https://openaudiovisual.com/zh/check/']) assert.ok(sm.includes(`<loc>${u}</loc>`), u);
  for (const [f, self, lang] of [['check/index.html', 'https://openaudiovisual.com/check/', 'en'], ['zh/check/index.html', 'https://openaudiovisual.com/zh/check/', 'zh-Hant']]) {
    const s = read(f);
    assert.ok(s.includes(`<link rel="canonical" href="${self}">`), `${f} canonical`);
    assert.ok(s.includes('hreflang="en" href="https://openaudiovisual.com/check/"') && s.includes('hreflang="zh-Hant" href="https://openaudiovisual.com/zh/check/"'), `${f} hreflang`);
    assert.ok(s.includes(`<html lang="${lang === 'en' ? 'en' : 'zh-Hant'}`), `${f} lang`);
    assert.match(s, /<script type="application\/ld\+json">/, `${f} JSON-LD`);
    assert.ok(!/noindex/.test(s), `${f} is indexable`);
    for (const id of ROWS) assert.ok(s.includes(`id="chk-${id}"`), `${f} row ${id}`);
    for (const id of ['btn-midi', 'btn-mic', 'btn-camera', 'btn-local', 'btn-copy']) assert.ok(s.includes(`id="${id}"`), `${f} button ${id}`);
    assert.match(s, /<script[^>]+src="[^"]*assets\/check\/check\.js/, `${f} loads the check script`);
  }
});

test('check: every row links into the docs, and every link lands on a heading that exists', async () => {
  const docs = { en: read('docs/index.html'), zh: read('zh/docs/index.html') };
  for (const [f, lang] of [['check/index.html', 'en'], ['zh/check/index.html', 'zh']]) {
    const s = read(f);
    const links = [...s.matchAll(/href="[^"]*docs\/(#[\w-]+)"/g)].map((m) => m[1]);
    assert.ok(links.length >= 6, `${f}: at least six docs links (got ${links.length})`);
    for (const h of links) assert.ok(docs[lang].includes(`id="${h.slice(1)}"`), `${f}: ${h} exists in the ${lang} docs`);
  }
});

test('check: the page says in words that nothing runs before a press, and nothing leaves the device', () => {
  assert.match(read('check/index.html'), /Nothing (?:runs|starts)[^<]*(?:press|click)/i);
  assert.match(read('check/index.html'), /(?:never|nothing)[^<]*(?:sent|leaves)/i);
  assert.match(read('zh/check/index.html'), /按(?:了|下)[^<]*(?:才|之前)|(?:才|不會)[^<]*(?:按|點)/);
  assert.match(read('zh/check/index.html'), /不會把任何東西送出/);
});

test('check: the script never opens a MIDI output and asks nothing at load', () => {
  const js = read('assets/check/check.js');
  assert.ok(!/\.outputs\b/.test(js.replace(/\/\/.*$/gm, '')), 'does not read access.outputs');
  assert.ok(!/\.open\(\)/.test(js), 'no port.open()');
  assert.ok(!/onmidimessage/.test(js.replace(/\/\/.*$/gm, '')), 'does not attach onmidimessage');
  assert.ok(!/sysex:\s*true/.test(js), 'no sysex');
  // each permission call sits inside an async function bound to a button, never at the top level
  for (const call of ['requestMIDIAccess(', 'getUserMedia(', 'new WebSocket(']) {
    const at = js.indexOf(call);
    assert.ok(at > 0, call);
    const before = js.slice(0, at);
    assert.ok(/async function \w+\([^)]*\)\s*\{[^}]*$/.test(before.replace(/\n/g, ' ').slice(-1500)) || /async \([^)]*\) =>/.test(before.slice(-400)), `${call} is inside an async function`);
  }
});

test('check: linked from getting-started, troubleshooting, the controller strip and the homepage strip', () => {
  for (const f of ['docs/getting-started.md', 'docs/troubleshooting.md']) assert.ok(read(f).includes('/check/'), f);
  const strip = (f) => read(f).match(/<aside class="no-midi"[\s\S]*?<\/aside>/)[0];
  for (const f of ['controllers/index.html', 'index.html', 'controllers/akai-lpd8/index.html']) assert.match(strip(f), /href="[^"]*check\/"/, `${f}: strip links to /check/`);
  for (const f of ['zh/controllers/index.html', 'zh/index.html']) assert.match(strip(f), /href="[^"]*zh\/check\/"|href="\.\.\/check\/"|href="[^"]*check\/"/, `${f}: strip links to the check`);
});

test('home strip: same words and same script as the controller pages, one stylesheet rule set', () => {
  const norm = (s) => s.replace(/\s+/g, ' ');
  const text = (f) => norm(read(f).match(/<aside class="no-midi"[\s\S]*?<p>([\s\S]*?)<\/p>/)[1]).replace(/href="[^"]*"/, 'href=""');
  assert.equal(text('index.html'), text('controllers/index.html'));
  assert.equal(text('zh/index.html'), text('zh/controllers/index.html'));
  const script = (f) => read(f).match(/<script>(\(function\(\)\{var b=document\.getElementById\('no-midi'\)[\s\S]*?)<\/script>/)[1];
  assert.equal(script('index.html'), script('controllers/index.html'));
  assert.ok(/aside class="no-midi"[^>]*hidden/.test(read('index.html')), 'hidden in the HTML');
  const css = (f) => (read(f).match(/^\.no-midi\b/gm) || []).length;
  assert.equal(css('assets/home/home.css'), 6, 'the strip is styled once, in the shared stylesheet');
  assert.equal(css('assets/controllers/controllers.css'), 0, 'and not a second time');
  assert.ok(!/class="no-midi"/.test(read('check/index.html')), 'the check page itself does not carry the strip');
});

// ---------------------------------------------------------------------------- browser
const PW = process.env.OAV_PLAYWRIGHT || '/private/tmp/claude-501/-Users-cheyuwu-Projects-muse-bot/1526dd55-e397-43d9-81a7-f6abf72f8690/scratchpad/platform/node_modules/playwright-core/index.mjs';
let pw = null;
try { pw = await import(PW); } catch { /* skipped below */ }
const SKIP = pw ? false : 'Playwright not available (set OAV_PLAYWRIGHT)';

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.webp': 'image/webp', '.png': 'image/png', '.ico': 'image/x-icon', '.txt': 'text/plain', '.webmanifest': 'application/manifest+json' };
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

/** Counts every permission-asking or network-touching call, and answers none of them with the real thing. */
const SPY = `(() => {
  const log = (window.__calls = []);
  const note = (k, a) => log.push([k, String(a && a[0])]);
  const nav = navigator;
  if (typeof nav.requestMIDIAccess === 'function') {
    const real = nav.requestMIDIAccess.bind(nav);
    Object.defineProperty(nav, 'requestMIDIAccess', { configurable: true, value: function () { note('requestMIDIAccess', arguments); return Promise.reject(new DOMException('spy', 'SecurityError')); } });
    window.__realMidi = real;
  }
  if (nav.mediaDevices) {
    nav.mediaDevices.getUserMedia = function () { note('getUserMedia', arguments); return Promise.reject(new DOMException('spy', 'NotAllowedError')); };
  }
  window.WebSocket = function () { note('WebSocket', arguments); throw new Error('spy'); };
  const f = window.fetch;
  window.fetch = function (u) { const s = String(u && u.url || u); if (/^(https?:)?\\/\\/(127\\.0\\.0\\.1|localhost|\\[::1\\])[:\\/]/.test(s) && !s.startsWith(location.origin)) note('fetch', arguments); return f.apply(this, arguments); };
  const open = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (m, u) { note('xhr', [u]); return open.apply(this, arguments); };
})();`;

const NO_MIDI = `try { delete Navigator.prototype.requestMIDIAccess; } catch (e) {} try { Object.defineProperty(Navigator.prototype, 'requestMIDIAccess', { value: undefined, configurable: true }); } catch (e) {}`;

/** The installed browser build nearest the newest one in Playwright's cache (the npm package may expect a newer revision than the machine has). */
function executable(engine) {
  const cache = path.join(process.env.HOME || '', 'Library/Caches/ms-playwright');
  const pick = (prefix, rel) => {
    try {
      const dirs = fs.readdirSync(cache).filter((d) => d.startsWith(prefix + '-')).sort((a, b) => parseInt(b.split('-').pop()) - parseInt(a.split('-').pop()));
      for (const d of dirs) { const f = path.join(cache, d, rel); if (fs.existsSync(f)) return f; }
    } catch { /* no cache */ }
    return undefined;
  };
  if (process.env.OAV_BROWSER_EXEC && engine === 'chromium') return process.env.OAV_BROWSER_EXEC;
  return engine === 'chromium' ? pick('chromium_headless_shell', 'chrome-headless-shell-mac-arm64/chrome-headless-shell') : pick('webkit', 'pw_run.sh');
}

async function withBrowser(fn, { engine = 'chromium', args = [] } = {}) {
  const { srv, base } = await serve();
  const browser = await pw[engine].launch({ args, executablePath: executable(engine) });
  try { await fn(browser, base); } finally { await browser.close(); srv.close(); }
}
const never = (ctx) => ctx.route(/^https?:\/\/(?!127\.0\.0\.1:\d+\/)[^/]*(127\.0\.0\.1|localhost):(7456|7457|8090)\//, (r) => r.abort());

test('check: before any press, nothing asks for MIDI, microphone or camera, and nothing connects to this computer (5 s, en + zh)', { skip: SKIP, timeout: 60000 }, async () => {
  await withBrowser(async (browser, base) => {
    const seen = [];
    await Promise.all(['/check/', '/zh/check/'].map(async (p) => {
      const ctx = await browser.newContext();   // no permissions granted at all, midi least of all
      await ctx.addInitScript(SPY);
      const page = await ctx.newPage();
      page.on('request', (r) => { if (/:(7456|7457|8090)\b/.test(r.url())) seen.push(r.url()); });
      page.on('pageerror', (e) => seen.push('pageerror ' + e.message));
      await page.goto(base + p);
      await page.waitForTimeout(5000);
      const calls = await page.evaluate(() => window.__calls);
      assert.deepEqual(calls, [], `${p}: no calls before a press`);
      assert.equal(await page.locator('li.chk').count(), ROWS.length);
      // the rows that can be known without asking are settled; the rest wait, and say so
      assert.notEqual(await page.getAttribute('#chk-browser', 'data-state'), 'idle');
      assert.notEqual(await page.getAttribute('#chk-graphics', 'data-state'), 'idle');
      for (const id of ['mic', 'camera', 'local']) assert.equal(await page.getAttribute(`#chk-${id}`, 'data-state'), 'idle', `${p}: ${id} waits for a press`);
      await ctx.close();
    }));
    assert.deepEqual(seen, [], 'no request to 7456, 7457 or 8090, no page error');
  });
});

test('check: with Web MIDI present the row is detected, not requested; the button reads inputs and never touches an output', { skip: SKIP, timeout: 30000 }, async () => {
  await withBrowser(async (browser, base) => {
    const ctx = await browser.newContext();
    await ctx.addInitScript(`(() => {
      window.__midi = { requests: 0, outputsRead: 0, opened: 0, handlers: 0 };
      const port = (n) => ({ id: n, name: n, manufacturer: 'x', state: 'connected', type: 'input', open() { window.__midi.opened++; }, set onmidimessage(v) { window.__midi.handlers++; } });
      const inputs = new Map([['a', port('Fake Pad')], ['b', port('Fake Keys')]]);
      const access = { inputs, get outputs() { window.__midi.outputsRead++; return new Map(); }, sysexEnabled: false };
      navigator.requestMIDIAccess = function (o) { window.__midi.requests++; window.__midi.opts = JSON.stringify(o || {}); return Promise.resolve(access); };
    })();`);
    const page = await ctx.newPage();
    await page.goto(base + '/check/');
    await page.waitForTimeout(600);
    assert.equal(await page.evaluate(() => window.__midi.requests), 0, 'not requested on load');
    assert.equal(await page.getAttribute('#chk-midi', 'data-state'), 'ok');
    await page.click('#btn-midi');
    await page.waitForFunction(() => /Fake Pad/.test(document.querySelector('#chk-midi').textContent));
    const m = await page.evaluate(() => window.__midi);
    assert.equal(m.requests, 1);
    assert.ok(!/sysex":true/.test(m.opts), 'no sysex');
    assert.equal(m.outputsRead, 0, 'access.outputs never read');
    assert.equal(m.opened, 0, 'no port opened');
    assert.equal(m.handlers, 0, 'no message handler attached');
    assert.match(await page.textContent('#chk-midi'), /Fake Keys/);
    await ctx.close();
  });
});

test('check: no Web MIDI → the row is yellow with advice, not an error; the other rows still work', { skip: SKIP, timeout: 30000 }, async () => {
  await withBrowser(async (browser, base) => {
    for (const p of ['/check/', '/zh/check/']) {
      const ctx = await browser.newContext();
      await ctx.addInitScript(NO_MIDI);
      const page = await ctx.newPage();
      const errs = []; page.on('pageerror', (e) => errs.push(e.message));
      await page.goto(base + p);
      await page.waitForTimeout(500);
      assert.equal(await page.getAttribute('#chk-midi', 'data-state'), 'warn', p);
      assert.ok((await page.textContent('#chk-midi')).length > 40);
      assert.equal(await page.isDisabled('#btn-midi'), true, 'nothing to ask for');
      assert.deepEqual(errs, []);
      await ctx.close();
    }
  });
});

test('check: microphone and camera turn green after the press (fake devices), then the tracks are stopped', { skip: SKIP, timeout: 40000 }, async () => {
  await withBrowser(async (browser, base) => {
    const ctx = await browser.newContext({ permissions: ['microphone', 'camera'] });
    await ctx.addInitScript(`window.__tracks = []; const g = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getUserMedia = async (c) => { const s = await g(c); s.getTracks().forEach((t) => window.__tracks.push(t)); return s; };`);
    const page = await ctx.newPage();
    await page.goto(base + '/check/');
    await page.click('#btn-mic');
    await page.waitForFunction(() => document.querySelector('#chk-mic').dataset.state === 'ok', null, { timeout: 15000 });
    await page.click('#btn-camera');
    await page.waitForFunction(() => document.querySelector('#chk-camera').dataset.state === 'ok', null, { timeout: 15000 });
    await page.waitForFunction(() => window.__tracks.length >= 2 && window.__tracks.every((t) => t.readyState === 'ended'), null, { timeout: 15000 });
    await ctx.close();
  }, { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
});

test('check: a refused microphone is yellow/red with advice, not a crash', { skip: SKIP, timeout: 30000 }, async () => {
  await withBrowser(async (browser, base) => {
    const ctx = await browser.newContext();
    await ctx.addInitScript(`navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('no', 'NotAllowedError'));`);
    const page = await ctx.newPage();
    const errs = []; page.on('pageerror', (e) => errs.push(e.message));
    await page.goto(base + '/check/');
    await page.click('#btn-mic');
    await page.waitForFunction(() => ['warn', 'bad'].includes(document.querySelector('#chk-mic').dataset.state));
    assert.deepEqual(errs, []);
    await ctx.close();
  });
});

test('check: the local-bridge test connects only when pressed, to 127.0.0.1:7457 and :7456, and reports both outcomes', { skip: SKIP, timeout: 30000 }, async () => {
  await withBrowser(async (browser, base) => {
    for (const mode of ['open', 'fail']) {
      const ctx = await browser.newContext();
      await ctx.addInitScript(`(() => {
        window.__net = [];
        class FakeWS { constructor(u) { window.__net.push('ws ' + u); setTimeout(() => ${mode === 'open' ? "this.onopen && this.onopen({})" : "this.onerror && this.onerror({})"}, 20); } close() {} addEventListener(t, f) { this['on' + t] = f; } }
        window.WebSocket = FakeWS;
        const f = window.fetch;
        window.fetch = (u, o) => { const s = String(u); if (/127\\.0\\.0\\.1:(7456|7457)/.test(s)) { window.__net.push('fetch ' + s); return ${mode === 'open' ? "Promise.resolve(new Response('{\"ok\":true}'))" : "Promise.reject(new TypeError('Failed to fetch'))"}; } return f(u, o); };
      })();`);
      const page = await ctx.newPage();
      await page.goto(base + '/check/');
      await page.waitForTimeout(800);
      assert.deepEqual(await page.evaluate(() => window.__net), [], 'idle on load');
      await page.click('#btn-local');
      await page.waitForFunction(() => document.querySelector('#chk-local').dataset.state !== 'idle', null, { timeout: 10000 });
      const net = await page.evaluate(() => window.__net);
      assert.ok(net.some((x) => x === 'ws ws://127.0.0.1:7457'), 'monitor socket');
      assert.ok(net.some((x) => x === 'fetch http://127.0.0.1:7456/health'), 'osc bridge health');
      assert.equal(await page.getAttribute('#chk-local', 'data-state'), mode === 'open' ? 'ok' : 'warn');
      await ctx.close();
    }
  });
});

test('check: the copy button puts a plain-text summary of every row on the clipboard (nothing is sent anywhere)', { skip: SKIP, timeout: 30000 }, async () => {
  await withBrowser(async (browser, base) => {
    const ctx = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
    const page = await ctx.newPage();
    await page.goto(base + '/check/');
    await page.waitForTimeout(500);
    await page.click('#btn-copy');
    const txt = await page.evaluate(() => navigator.clipboard.readText());
    for (const id of ROWS) assert.ok(new RegExp(id, 'i').test(txt) || txt.split('\n').length >= ROWS.length, id);
    assert.ok(txt.split('\n').length >= ROWS.length);
    await ctx.close();
  });
});

test('check: phone width has no sideways scroll (en + zh)', { skip: SKIP, timeout: 30000 }, async () => {
  await withBrowser(async (browser, base) => {
    for (const p of ['/check/', '/zh/check/']) {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
      const page = await ctx.newPage();
      await page.goto(base + p);
      await page.waitForTimeout(500);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), p);
      await ctx.close();
    }
  });
});

test('home + controllers strip: shown when the browser has no Web MIDI, hidden when it has (chromium); shown in WebKit', { skip: SKIP, timeout: 60000 }, async () => {
  await withBrowser(async (browser, base) => {
    for (const p of ['/', '/zh/', '/controllers/']) {
      const withMidi = await browser.newContext();
      await withMidi.addInitScript(`navigator.requestMIDIAccess = navigator.requestMIDIAccess || function () { return Promise.reject(); };`);
      let page = await withMidi.newPage();
      await page.goto(base + p);
      assert.equal(await page.isVisible('#no-midi'), false, `${p}: hidden with Web MIDI`);
      await withMidi.close();

      const without = await browser.newContext();
      await without.addInitScript(NO_MIDI);
      page = await without.newPage();
      await page.goto(base + p);
      assert.equal(await page.isVisible('#no-midi'), true, `${p}: shown without Web MIDI`);
      const href = await page.getAttribute('#no-midi a', 'href');
      assert.match(href, /check\/$/);
      await page.click('#no-midi button');
      assert.equal(await page.isVisible('#no-midi'), false, 'dismissed');
      await page.reload();
      assert.equal(await page.isVisible('#no-midi'), false, 'and stays dismissed');
      await without.close();
    }
  });
  if (pw.webkit) {
    await withBrowser(async (browser, base) => {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
      const page = await ctx.newPage();
      await page.goto(base + '/');
      assert.equal(await page.evaluate(() => typeof navigator.requestMIDIAccess), 'undefined', 'WebKit has no Web MIDI');
      assert.equal(await page.isVisible('#no-midi'), true, 'WebKit: strip shown');
      await ctx.close();
    }, { engine: 'webkit' });
  }
});
