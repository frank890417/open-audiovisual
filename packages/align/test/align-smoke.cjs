#!/usr/bin/env node
// align-smoke.cjs — example 31 in a real (headless) Chromium: no hardware, no permissions granted.
//
//   PW=<path to playwright> [SHOTS=<dir>] [THUMB=assets/home/works/31.webp] node packages/align/test/align-smoke.cjs
//
// Starts `node serve.js` on a free port (stopped again by its PID), then:
//   1. example 31 loads with no console error, for every example layout (the identification screen and the chart of each)
//   2. the pictures switch: the cells and the grid paint different pixels through the warp
//   3. in the align mode a corner dragged with the mouse moves the zone's corner and changes the rendered picture
//   4. the calibration survives a reload (saved a second after the change)
//   5. the Gray-code frames step, in output pixels; the screenshots align-example.png, align-patterns.png, align-graycode.png
// three.js comes from jsDelivr (the example's import map), as it does on the site.
const fs = require('fs'), path = require('path'), net = require('net'), os = require('os'), { spawn } = require('child_process');
const PW = require(process.env.PW || 'playwright');
const ROOT = path.resolve(__dirname, '../../..');
const SHOTS = process.env.SHOTS || fs.mkdtempSync(path.join(os.tmpdir(), 'oav-align-'));
const NOISE = [/ws:\/\/[^ ]*:7457/, /WebSocket connection to 'ws:\/\/[^']*7457/, /ERR_CONNECTION_REFUSED/, /Failed to load resource/];
let bad = 0;
const say = (ok, what, why) => { if (!ok) bad++; console.log(`${ok ? '✅' : '❌'} ${what}${!ok && why ? `\n     ${why}` : ''}`); };
const freePort = () => new Promise((res) => { const s = net.createServer(); s.listen(0, () => { const p = s.address().port; s.close(() => res(p)); }); });

(async () => {
  const port = await freePort();
  const server = spawn(process.execPath, ['serve.js', String(port)], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
  await new Promise((res, rej) => { server.stdout.on('data', (d) => { if (/localhost/.test(String(d))) res(); }); server.on('exit', (c) => rej(new Error(`serve.js exited ${c}`))); setTimeout(() => rej(new Error('serve.js did not start')), 10000); });
  const base = `http://localhost:${port}/examples/31-align/`;
  const browser = await PW.chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    const watch = (page) => {
      page.on('console', (m) => { if (m.type() === 'error' && !NOISE.some((re) => re.test(m.text()))) errors.push(m.text()); });
      page.on('pageerror', (e) => errors.push(String(e)));
    };
    const page = await ctx.newPage(); watch(page);
    const ready = () => page.waitForFunction(() => window.openav && window.openav.align && window.openav.align.ui, null, { timeout: 30000 });
    const settle = (ms = 400) => page.waitForTimeout(ms);
    const pixels = () => page.evaluate(() => { const c = document.querySelector('.align-desk canvas'); return c.toDataURL('image/png'); });
    const stage = () => page.$('.oav-stage');

    // 1. every example layout loads, ident and chart included
    for (const id of ['example-edge-blend', 'one-projector', 'led-wall-two-outputs', 'stacked-double', 'room-corner']) {
      errors.length = 0;
      await page.goto(`${base}?layout=${id}&source=ident`); await ready(); await settle(800);
      await page.evaluate(() => window.openav.align.setMode('chart')); await settle(300);
      const info = await page.evaluate(() => ({ id: window.openav.align.M.id, tiles: window.openav.align.M.tiles.length, meshes: window.openav.align.warp.meshes.size }));
      say(errors.length === 0 && info.id === id && info.meshes === info.tiles, `example 31 ?layout=${id}: no console error, ${info.tiles} tile(s) → ${info.meshes} warp mesh(es), ident and chart drawn`, errors.join(' | '));
    }

    // a clean start for the calibration checks
    await page.goto(base); await ready();
    await page.evaluate(() => { localStorage.removeItem('oav-example-31/calibration'); localStorage.removeItem('oav-example-31/backups'); localStorage.removeItem('oav-example-31/state'); });
    errors.length = 0;
    await page.goto(`${base}?source=tiles`); await ready(); await settle(800);

    // 2. the pictures switch
    const tilesPx = await pixels();
    await page.selectOption('.align-bar select[title="picture"]', 'grid'); await settle(500);
    const gridPx = await pixels();
    say(tilesPx !== gridPx && await page.evaluate(() => window.openav.align.state.source) === 'grid', 'the picture list switches cells → grid, and the warped canvas changes');
    await page.selectOption('.align-bar select[title="picture"]', 'tiles'); await settle(500);
    await (await stage()).screenshot({ path: path.join(SHOTS, 'align-patterns.png') });

    // 3. drag the right projector's bottom-right corner in the align mode
    await page.click('.align-bar button:text-is("Align")'); await settle(300);
    const before = await pixels();
    const at = await page.evaluate(() => {
      const A = window.openav.align, c = document.querySelector('.align-desk canvas'), r = c.getBoundingClientRect(), M = A.M;
      const k = Math.min(r.width / M.desktop.w, r.height / M.desktop.h), ox = r.left + (r.width - M.desktop.w * k) / 2, oy = r.top + (r.height - M.desktop.h * k) / 2;
      const z = A.cal.variants[M.id].zones.R, [x, y] = z.corners[2];
      return { x: ox + x * k, y: oy + y * k, k, corner: [...z.corners[2]] };
    });
    await page.mouse.move(at.x - 2, at.y - 2); await page.mouse.down();
    for (let i = 1; i <= 10; i++) await page.mouse.move(at.x - 2 - i * 12, at.y - 2 - i * 6);
    await page.mouse.up(); await settle(500);
    const moved = await page.evaluate(() => [...window.openav.align.cal.variants[window.openav.align.M.id].zones.R.corners[2]]);
    const after = await pixels();
    const dx = moved[0] - at.corner[0], dy = moved[1] - at.corner[1];
    say(Math.abs(dx + 120 / at.k) < 2 / at.k && Math.abs(dy + 60 / at.k) < 2 / at.k && before !== after,
      `a dragged corner moves zone R's corner by (${dx.toFixed(1)}, ${dy.toFixed(1)}) desktop px and changes the warped picture`, `corner ${at.corner} → ${moved}`);
    await page.addStyleTag({ content: '.oav-guide { display: none !important }' });   // the guide card would cover the left output
    await (await stage()).screenshot({ path: path.join(SHOTS, 'align-example.png') });
    if (process.env.THUMB) {
      // the work itself, both projectors a little off square, the handles and the panel: the stage's top 16:10
      await page.selectOption('.align-bar select[title="picture"]', 'live');
      await page.evaluate(() => { const A = window.openav.align, z = A.cal.variants[A.M.id].zones.L; z.corners[0] = [z.corners[0][0] + 60, z.corners[0][1] + 40]; A.replaceCalibration(A.cal); A.ui.draw(); });
      await settle(600);
      const box = await page.evaluate(() => { const s = document.querySelector('.oav-stage').getBoundingClientRect(); const h = Math.min(s.height, s.width * 10 / 16); return { x: s.left, y: s.top, width: s.width, height: h }; });   // from the top: the panel whole, the outputs under it
      const png = (await page.screenshot({ clip: box })).toString('base64');
      const webp = await page.evaluate(async (src) => {
        const img = new Image(); img.src = 'data:image/png;base64,' + src; await img.decode();
        const c = Object.assign(document.createElement('canvas'), { width: 800, height: 500 }), g = c.getContext('2d');
        const s = Math.max(800 / img.width, 500 / img.height), w = img.width * s, h = img.height * s;
        g.drawImage(img, (800 - w) / 2, (500 - h) / 2, w, h);
        return c.toDataURL('image/webp', 0.82).split(',')[1];
      }, png);
      fs.writeFileSync(path.resolve(ROOT, process.env.THUMB), Buffer.from(webp, 'base64'));
      console.log(`# wrote ${process.env.THUMB} (800×500 webp)`);
    }

    // 4. the calibration survives a reload
    await settle(1400);                                  // saved a second after the last change
    await page.reload(); await ready(); await settle(500);
    const kept = await page.evaluate(() => [...window.openav.align.cal.variants[window.openav.align.M.id].zones.R.corners[2]]);
    say(Math.abs(kept[0] - moved[0]) < 1e-6 && Math.abs(kept[1] - moved[1]) < 1e-6, `after a reload zone R's corner is still (${kept.map((v) => v.toFixed(1))})`, `${kept} vs ${moved}`);

    // the panel in Chinese, from the guide's language switch
    await page.evaluate(() => localStorage.setItem('oav-ui', 'zh'));
    await page.goto(`${base}?align`); await ready(); await settle(300);
    const zh = await page.evaluate(() => document.querySelector('#align-ui h3').textContent);
    say(/^對位模式/.test(zh), `with the guide set to 中文 the align panel reads "${zh.slice(0, 12)}…"`);
    await page.evaluate(() => localStorage.setItem('oav-ui', 'en'));
    await page.goto(base); await ready(); await settle(300);

    // 5. the Gray-code frames
    await page.click('.align-bar button:text-is("Gray code")'); await settle(300);
    const g0 = await page.evaluate(() => document.querySelectorAll('.align-desk canvas')[1].toDataURL());
    for (let i = 0; i < 4; i++) await page.click('.align-bar button:text-is("▶")');
    await settle(200);
    const g1 = await page.evaluate(() => ({ png: document.querySelectorAll('.align-desk canvas')[1].toDataURL(), frame: window.openav.align.gray.frame, label: document.querySelector('.align-bar span').textContent }));
    say(g0 !== g1.png && g1.frame === 4 && /frame 5\/46 · X bit 2 of 11$/.test(g1.label), `Gray code: four steps on, ${g1.label}`, g1.label);
    await (await stage()).screenshot({ path: path.join(SHOTS, 'align-graycode.png') });
    say(errors.length === 0, 'no console error through all of it', errors.join(' | '));
  } finally {
    await browser.close();
    process.kill(server.pid);
  }
  console.log(`# screenshots in ${SHOTS}`);
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
