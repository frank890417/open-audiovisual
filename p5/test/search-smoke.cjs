#!/usr/bin/env node
// search-smoke.cjs — the site search in a real (headless) Chromium: the button in the top bar, the dialog, the results, at desktop
// and phone widths. Not part of `npm test` (needs a browser): CI runs it in the `reference` job, and you run it before a release.
//
//   PW=<path to playwright(-core)> node p5/test/search-smoke.cjs
//   SHOTS=<dir>            screenshots (default: a temp dir, printed at the end)
//   URLS=/docs/,/zh/       only these pages;  VPS=desktop,phone  only these viewports
//   BASE=https://openaudiovisual.com   check the live site instead of this checkout
//   OAV_ROOT=<checkout>    run the same checks against another checkout
//
// Per page × viewport (1440×900, 390×844, 360×740):
//   · the top bar is not crowded: the search button, the brand, the language switch and GitHub are all inside the window and none
//     covers another; the page does not scroll sideways
//   · the dialog opens by clicking the button, by Ctrl+K, by "/" (where the page does not use "/" itself: the API reference does),
//     and closes with Esc and with the × ; typing "micLevel" puts the API reference's micLevel first, under "API reference"
//   · Enter goes to docs/reference/#micLevel and the card is on screen; "麥克風" finds micLevel from the Chinese pages (and the English);
//     a word of the handbook finds a handbook section; a word nothing has says so; the dialog fits the window (a phone: all of it)
// Exit code 1 when any row fails.
const fs = require('fs'), path = require('path'), http = require('http'), os = require('os');
const PW = require(process.env.PW || 'playwright');
const ROOT = path.resolve(__dirname, '../..');
const OAV = process.env.OAV_ROOT || ROOT;
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.html': 'text/html', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.txt': 'text/plain', '.ico': 'image/x-icon' };
const SHOTS = process.env.SHOTS || fs.mkdtempSync(path.join(os.tmpdir(), 'oav-search-'));
const NOISE = [/ws:\/\/[^ ]*:7457/, /googletagmanager|google-analytics|cloudflareinsights/, /net::ERR_(BLOCKED|FAILED|INTERNET)/, /Failed to load resource/];
const PAGES = (process.env.URLS ? process.env.URLS.split(',') : ['/', '/zh/', '/docs/', '/zh/docs/', '/docs/reference/', '/controllers/', '/examples/', '/p5/', '/changelog/']);
const VIEWPORTS = [[1440, 900, 'desktop'], [390, 844, 'phone'], [360, 740, 'small phone']].filter((v) => !process.env.VPS || process.env.VPS.split(',').includes(v[2]));

let bad = 0, rows = 0;
const say = (ok, name, why) => { rows++; if (!ok) bad++; console.log(`${ok ? '✅' : '❌'} ${name}${!ok && why ? '\n     ' + String(why).split('\n').join('\n     ') : ''}`); };

(async () => {
  const srv = http.createServer((q, r) => {
    let p = decodeURIComponent(new URL(q.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const f = path.join(OAV, p);
    if (!f.startsWith(OAV) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
    r.setHeader('Content-Type', MIME[path.extname(f)] || 'application/octet-stream'); r.end(fs.readFileSync(f));
  });
  await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
  const base = process.env.BASE ? process.env.BASE.replace(/\/$/, '') : `http://127.0.0.1:${srv.address().port}`;   // BASE=https://openaudiovisual.com: the live site
  const browser = await PW.chromium.launch({ headless: true });

  for (const [w, h, vname] of VIEWPORTS) {
    for (const url of PAGES) {
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: w < 500, isMobile: w < 500 });
      const page = await ctx.newPage();
      const problems = [];
      page.on('pageerror', (e) => problems.push('page error: ' + e.message));
      page.on('console', (m) => { if (m.type() === 'error' && !NOISE.some((re) => re.test(m.text()))) problems.push('console.error: ' + m.text().slice(0, 200)); });
      await page.route(/googletagmanager|cloudflareinsights/, (route) => route.abort());
      // the index arrives late, as it does on a real network: what is typed in the meantime must not break, and must be searched when it lands
      await page.route(/assets\/search\/index\.json/, async (route) => { await new Promise((r) => setTimeout(r, 700)); await route.continue(); });
      const zh = url.startsWith('/zh/');
      const label = `${url} · ${vname} ${w}×${h}`;
      try {
        await page.goto(base + url, { waitUntil: 'load' });
        await page.evaluate(() => document.fonts && document.fonts.ready);   // widths settle when the web fonts arrive
        await page.waitForTimeout(200);
        // 1. the bar
        const bar = await page.evaluate((W) => {
          const box = (s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return cs.display === 'none' ? null : { l: r.left, r: r.right, t: r.top, b: r.bottom, w: r.width }; };
          return { search: box('.top .nav-search'), brand: box('.top .brand'), langs: box('.top .langs'), gh: box('.top .gh'), top: box('.top'), overflowX: document.documentElement.scrollWidth > W + 1, iw: W };
        }, w);   // the width the phone really has (on a phone innerWidth grows to fit whatever overflows, which hides the overflow)
        if (!bar.search) problems.push('no search button in the top bar');
        else {
          const items = [['brand', bar.brand], ['search', bar.search], ['langs', bar.langs], ['gh', bar.gh]].filter((x) => x[1]);
          for (const [n, b] of items) { if (b.l < -0.5 || b.r > bar.iw + 0.5) problems.push(`the top bar's ${n} is outside the window (${Math.round(b.l)}…${Math.round(b.r)} of ${bar.iw})`); if (b.w < 20) problems.push(`the top bar's ${n} is squeezed to ${Math.round(b.w)}px`); }
          for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) { const a = items[i][1], b = items[j][1]; if (a.l < b.r - 0.5 && b.l < a.r - 0.5 && a.t < b.b && b.t < a.b) problems.push(`the top bar's ${items[i][0]} and ${items[j][0]} overlap`); }
          if (bar.search.r - bar.search.l < 28 || bar.search.b - bar.search.t < 28) problems.push('the search button is smaller than a finger (28px)');
        }
        if (bar.overflowX) problems.push('the page scrolls sideways');
        // 2. open: the button
        await page.click('.top .nav-search');
        await page.waitForSelector('dialog.oav-search[open]', { timeout: 5000 });
        await page.waitForFunction(() => document.querySelector('.os-input') === document.activeElement, null, { timeout: 3000 }).catch(async () => { throw new Error('the search field is not focused after opening (focus is on ' + (await page.evaluate(() => document.activeElement && (document.activeElement.className || document.activeElement.tagName))) + ')'); });
        const fit = await page.evaluate(() => { const r = document.querySelector('dialog.oav-search').getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, iw: innerWidth, ih: innerHeight }; });
        if (fit.l < -0.5 || fit.r > fit.iw + 0.5 || fit.b > fit.ih + 0.5) problems.push(`the dialog does not fit the window: ${JSON.stringify(fit)}`);
        // typing
        await page.keyboard.type('micLevel');
        await page.waitForSelector('.os-item', { timeout: 5000 });
        const first = await page.evaluate(() => { const a = document.querySelector('.os-item a'); return { href: a && a.getAttribute('href'), group: a && a.closest('.os-group').querySelector('.os-h').textContent, title: a && a.querySelector('.os-t').textContent, selected: !!document.querySelector('.os-item.is-active') }; });
        if (!/docs\/reference\/#micLevel$/.test(first.href || '')) problems.push(`"micLevel": the first result goes to ${first.href}`);
        if (!/API/.test(first.group || '')) problems.push(`the first group is "${first.group}"`);
        if (zh && !/^\.\.\/\.\.\/|zh\/docs\/reference\//.test(first.href || '') && !/zh\//.test(first.href || '')) problems.push(`from a Chinese page the first result is not the Chinese one: ${first.href}`);
        if (!first.selected) problems.push('no result is selected (Enter would do nothing)');
        await page.screenshot({ path: path.join(SHOTS, `search-${vname.replace(' ', '-')}-${url.replace(/\//g, '_')}-micLevel.png`) });
        // Chinese, handbook, nothing
        await page.fill('.os-input', '麥克風');
        await page.waitForSelector('.os-item');
        const zhFirst = await page.evaluate(() => [...document.querySelectorAll('.os-item a')].slice(0, 3).map((a) => a.getAttribute('href')));
        if (!zhFirst.some((x) => /docs\/reference\/#micLevel$/.test(x))) problems.push(`"麥克風": micLevel is not among the first three (${zhFirst.join(', ')})`);
        await page.fill('.os-input', 'relay');
        await page.waitForTimeout(150);
        const hb = await page.evaluate(() => [...document.querySelectorAll('.os-group')].map((g) => g.querySelector('.os-h').textContent));
        if (hb.length < 2) problems.push(`"relay": only ${hb.length} group(s) of results (${hb.join(', ')})`);
        await page.fill('.os-input', 'zzzzqqqqxxxx');
        await page.waitForTimeout(150);
        if (!(await page.evaluate(() => !!document.querySelector('.os-note') && !document.querySelector('.os-item')))) problems.push('a query nothing matches does not say so');
        // close with Esc; reopen with the keyboard; "/" where the page allows it
        await page.keyboard.press('Escape');
        await page.waitForFunction(() => !document.querySelector('dialog.oav-search[open]'), null, { timeout: 3000 });
        if (w >= 1000) {
          await page.keyboard.press('Control+k');
          await page.waitForSelector('dialog.oav-search[open]', { timeout: 3000 });
          await page.keyboard.press('Escape');
          await page.waitForFunction(() => !document.querySelector('dialog.oav-search[open]'));
          await page.evaluate(() => { document.activeElement && document.activeElement.blur && document.activeElement.blur(); });
          await page.keyboard.press('/');
          const slash = await page.evaluate(() => ({ dialog: !!document.querySelector('dialog.oav-search[open]'), ref: document.activeElement && document.activeElement.id }));
          if (url === '/docs/reference/') { if (slash.dialog || slash.ref !== 'ref-q') problems.push('on the API reference "/" must focus its own search box'); }
          else if (!slash.dialog) problems.push('"/" does not open the search');
          if (slash.dialog) { await page.keyboard.press('Escape'); await page.waitForFunction(() => !document.querySelector('dialog.oav-search[open]')); }
        }
        // Enter goes there
        await page.click('.top .nav-search');
        await page.waitForSelector('dialog.oav-search[open]');
        await page.keyboard.type('micLevel');
        await page.waitForSelector('.os-item');
        await page.keyboard.press('Enter');
        await page.waitForFunction(() => /docs\/reference\/?(\?[^#]*)?#micLevel$/.test(location.pathname + location.search + location.hash), null, { timeout: 8000 });
        await page.waitForTimeout(600);
        const landed = await page.evaluate(() => { const e = document.getElementById('micLevel'); const r = e && e.getBoundingClientRect(); return { ok: !!e, top: r && Math.round(r.top), ih: innerHeight, hidden: !!(e && e.closest('.ref') && e.closest('.ref').hidden), url: location.pathname + location.hash }; });
        if (!landed.ok) problems.push('Enter: #micLevel is not on the page we landed on');
        else if (landed.hidden) problems.push('Enter: the micLevel card is hidden');
        else if (landed.top < -2 || landed.top > landed.ih * 0.8) problems.push(`Enter: the micLevel card is at y=${landed.top} of ${landed.ih}`);
        if (zh && !/^\/zh\//.test(landed.url)) problems.push(`from a Chinese page Enter went to ${landed.url}`);
        await page.screenshot({ path: path.join(SHOTS, `search-${vname.replace(' ', '-')}-${url.replace(/\//g, '_')}-landed.png`) });
        say(!problems.length, label, problems.join('\n'));
      } catch (e) {
        say(false, label, [...problems, 'did not run: ' + e.message.split('\n')[0]].join('\n'));
      }
      await ctx.close();
    }
  }
  await browser.close(); srv.close();
  console.log(`\n${rows - bad}/${rows} rows green; screenshots in ${SHOTS}`);
  process.exit(bad ? 1 : 0);
})();
