#!/usr/bin/env node
// tile-smoke.cjs — @openav/tile end to end, in headless Chromium. Not part of `npm test` (it needs a browser and
// OpenCV.js); run it by hand before a release, like p5/test/*.cjs.
//
//   npm pack @techstark/opencv-js@4.12.0-release.1 && tar xzf techstark-opencv-js-4.12.0-release.1.tgz
//   OPENCV=package/dist/opencv.js PW=<path to playwright> [SHOTS=<dir>] [THUMB=assets/home/works/27.webp] \
//     node packages/tile/test/tile-smoke.cjs
//
// OPENCV is the very file the camera page loads from jsDelivr (detect.js OPENCV_URL); it is served for that URL by
// request interception, so the test also runs offline or behind a proxy that blocks the CDN.
//
//   1. demo: the camera page's ?demo=1 — a synthetic photo of three screens (test/synth.js), detected and solved in
//      the page, compared with the truth.
//   2. room: node serve.js; three tiles (examples/27-tile-dot) in three browser contexts the size of a laptop
//      (2560×1600), a tablet (2048×2732) and a phone (1170×2532), the camera page in a fourth. Join, Markers; each
//      tile's own screenshot (its real markers, drawn by drawMarkers on its canvas) is laid on a virtual table under a
//      tilted camera — that is the photo the camera page detects, solves and sends over the relay. Each tile must then
//      be placed where the photo put it; their clocks must agree; the page must log no error but the backstage
//      monitor's (ws://…:7457, expected when no monitor runs).
//   3. the thumbnail: the three tiles frozen at one shared instant, seen from above (THUMB writes the 800×500 webp).
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const PW = require(process.env.PW || 'playwright');
const ROOT = path.resolve(__dirname, '../../..');
const OPENCV = process.env.OPENCV;
const SHOTS = process.env.SHOTS || null;
const OPENCV_VERSION = /const OPENCV_VERSION = '([^']+)'/.exec(fs.readFileSync(path.join(ROOT, 'packages/tile/detect.js'), 'utf8'))[1];
const CDN = `https://cdn.jsdelivr.net/npm/@techstark/opencv-js@${OPENCV_VERSION}/dist/opencv.js`;
if (!OPENCV || !fs.existsSync(OPENCV)) { console.error('OPENCV=<path to opencv.js> is required (see the top of this file)'); process.exit(2); }
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });

const fails = [];
const check = (ok, what) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`); if (!ok) fails.push(what); };
const deg = 180 / Math.PI;
// 3×3 helpers (row-major), enough for the checks
const mul = (A, B) => { const C = []; for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) C.push(A[r * 3] * B[c] + A[r * 3 + 1] * B[3 + c] + A[r * 3 + 2] * B[6 + c]); return C; };
const inv = (M) => { const d = M[0] * (M[4] * M[8] - M[5] * M[7]) - M[1] * (M[3] * M[8] - M[5] * M[6]) + M[2] * (M[3] * M[7] - M[4] * M[6]); return [(M[4] * M[8] - M[5] * M[7]) / d, (M[2] * M[7] - M[1] * M[8]) / d, (M[1] * M[5] - M[2] * M[4]) / d, (M[5] * M[6] - M[3] * M[8]) / d, (M[0] * M[8] - M[2] * M[6]) / d, (M[2] * M[3] - M[0] * M[5]) / d, (M[3] * M[7] - M[4] * M[6]) / d, (M[1] * M[6] - M[0] * M[7]) / d, (M[0] * M[4] - M[1] * M[3]) / d]; };
const ap = (M, [x, y]) => { const w = M[6] * x + M[7] * y + M[8]; return [(M[0] * x + M[1] * y + M[2]) / w, (M[3] * x + M[4] * y + M[5]) / w]; };

async function serve(port) {
  const p = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(port)], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
  await new Promise((res, rej) => { p.stdout.on('data', (d) => { if (/localhost/.test(String(d))) res(); }); p.on('exit', rej); setTimeout(res, 3000); });
  return p;
}

(async () => {
  const port = 8100 + Math.floor(Math.random() * 800);
  const server = await serve(port);
  const base = `http://localhost:${port}`;
  const browser = await PW.chromium.launch({ executablePath: process.env.CHROME || undefined });
  const errors = [];
  const watch = (page, name) => {
    page.on('console', (m) => { if (m.type() === 'error' && !/ws:\/\/localhost:7457/.test(m.text())) errors.push(`${name}: ${m.text()}`); });
    page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  };
  const opencv = (ctx) => ctx.route(CDN, (r) => r.fulfill({ path: OPENCV, contentType: 'text/javascript', headers: { 'access-control-allow-origin': '*' } }));
  try {
    // ------------------------------------------------------------------ 1. demo
    {
      const ctx = await browser.newContext({ viewport: { width: 900, height: 1200 } });
      await opencv(ctx);
      const page = await ctx.newPage(); watch(page, 'camera demo');
      await page.goto(`${base}/packages/tile/?demo=1&room=smoke-demo`);
      await page.waitForFunction(() => window.oavTileCamera?.last, null, { timeout: 120000 });
      const r = await page.evaluate(() => { const l = window.oavTileCamera.last; return { ok: l.ok, found: l.found, ms: l.ms, report: l.report, truth: l.truth }; });
      console.log(`# demo: ${r.found} markers in ${r.ms} ms; ` + r.report.map((x) => `${x.id} ${x.status} ${x.markers} markers rms ${x.rms} px`).join(' · '));
      console.log('# demo vs truth: ' + (r.truth || []).map((t) => `${t.id} ${t.dAngle.toFixed(4)}° ${t.dScale.toFixed(4)} % ${t.dPx.toFixed(3)} px`).join(' · '));
      check(r.ok && r.report.every((x) => x.status === 'ok'), 'demo: every screen of the synthetic photo is placed');
      check(r.truth && r.truth.every((t) => t.dAngle < 0.2 && t.dScale < 0.5 && t.dPx < 2), 'demo: within 0.2°, 0.5 %, 2 px of the truth');
      if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'tile-demo.png'), fullPage: true });
      await ctx.close();
    }

    // ------------------------------------------------------------------ 2. a live room
    const room = 'smoke-' + Math.random().toString(36).slice(2, 7);
    const devices = [
      { id: 'laptop', viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2, px: [2560, 1600] },
      { id: 'tablet', viewport: { width: 1024, height: 1366 }, deviceScaleFactor: 2, px: [2048, 2732] },
      { id: 'phone', viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, px: [1170, 2532], isMobile: true, hasTouch: true },
    ];
    for (const d of devices) {
      d.ctx = await browser.newContext({ viewport: d.viewport, deviceScaleFactor: d.deviceScaleFactor, isMobile: !!d.isMobile, hasTouch: !!d.hasTouch });
      d.page = await d.ctx.newPage(); watch(d.page, d.id);
      await d.page.goto(`${base}/examples/27-tile-dot/?room=${room}&id=${d.id}`);
      await d.page.click('.tile-ui button');                    // the one tap: fullscreen + wake lock
    }
    const camCtx = await browser.newContext({ viewport: { width: 900, height: 1300 } });
    await opencv(camCtx);
    const cam = await camCtx.newPage(); watch(cam, 'camera');
    await cam.goto(`${base}/packages/tile/?room=${room}`);
    await cam.waitForFunction(() => window.oavTileCamera?.roster.size === 3, null, { timeout: 15000 });
    const roster = await cam.evaluate(() => [...window.oavTileCamera.roster.values()].map(({ id, index, w, h }) => ({ id, index, w, h })));
    console.log('# roster: ' + roster.map((r) => `#${r.index} ${r.id} ${r.w}×${r.h}`).join(' · '));
    check(devices.every((d) => roster.some((r) => r.id === d.id && r.w === d.px[0] && r.h === d.px[1])), 'every tile reported its real pixels (CSS size × devicePixelRatio)');

    await cam.click('#markers');
    for (const d of devices) await d.page.waitForFunction(() => window.oavTile.index != null && window.oavTile.mode === 'markers' && getComputedStyle(document.querySelector('.tile-markers')).display === 'block', null, { timeout: 10000 });
    await new Promise((r) => setTimeout(r, 400));
    const shots = {};
    for (const d of devices) {
      const buf = await d.page.screenshot({ type: 'png' });
      shots[d.id] = buf.toString('base64');
      if (SHOTS) fs.writeFileSync(path.join(SHOTS, `tile-${d.id}-markers.png`), buf);
    }

    // the photo: these three screenshots on a virtual table under a tilted camera (the placement is test/synth.js's)
    const sent = await cam.evaluate(async (shots) => {
      const { sceneThree, renderPhoto } = await import('/packages/tile/test/synth.js');
      const scene = sceneThree();
      const grey = {};
      for (const [id, b64] of Object.entries(shots)) {
        const bmp = await createImageBitmap(await (await fetch('data:image/png;base64,' + b64)).blob());
        const c = new OffscreenCanvas(bmp.width, bmp.height), x = c.getContext('2d');
        x.drawImage(bmp, 0, 0);
        const d = x.getImageData(0, 0, bmp.width, bmp.height).data, g = new Uint8ClampedArray(bmp.width * bmp.height);
        for (let i = 0; i < g.length; i++) g[i] = d[i * 4];
        grey[id] = { w: bmp.width, h: bmp.height, data: g };
      }
      const photo = renderPhoto(scene, { screenImage: (s) => grey[s.id] });
      const c = document.createElement('canvas'); c.width = photo.w; c.height = photo.h;
      const im = c.getContext('2d').createImageData(photo.w, photo.h);
      for (let i = 0; i < photo.data.length; i++) { const v = photo.data[i]; im.data.set([v, v, v, 255], i * 4); }
      c.getContext('2d').putImageData(im, 0, 0);
      window.__photo = c.toDataURL('image/jpeg', 0.9);
      const r = await window.oavTileCamera.usePhoto(c);
      return { ok: r.ok, found: r.found, ms: r.ms, report: r.report, layout: r.layout, T: Object.fromEntries(scene.screens.map((s) => [s.id, s.T])) };
    }, shots);
    if (SHOTS) {
      fs.writeFileSync(path.join(SHOTS, 'tile-room-photo.jpg'), Buffer.from((await cam.evaluate(() => window.__photo)).split(',')[1], 'base64'));
      await cam.screenshot({ path: path.join(SHOTS, 'tile-camera.png'), fullPage: true });
    }
    console.log(`# room photo: ${sent.found} markers in ${sent.ms} ms; ` + sent.report.map((x) => `${x.id} ${x.status} ${x.markers} markers rms ${x.rms} px`).join(' · '));
    check(sent.ok && sent.report.length === 3 && sent.report.every((x) => x.status === 'ok'), 'room: the camera page placed all three tiles from their own markers');

    for (const d of devices) await d.page.waitForFunction(() => window.oavTile.calibrated && window.oavTile.mode === 'show', null, { timeout: 10000 }).catch(() => {});
    const got = {};
    for (const d of devices) {
      got[d.id] = await d.page.evaluate(() => {
        const t = window.oavTile, local = performance.timeOrigin + performance.now();
        return { calibrated: t.calibrated, mode: t.mode, markers: getComputedStyle(document.querySelector('.tile-markers')).display, toCanvas: t.view.toCanvas, canvas: t.view.canvas,
          reference: t.layout?.reference, offset: t.clock.offset, rtt: t.clock.rtt, skew: t.now() - local, seed: t.seed, start: t.show?.start };
      });
    }
    check(devices.every((d) => got[d.id].calibrated && got[d.id].mode === 'show' && got[d.id].markers === 'none'), 'every tile got the layout over the relay, is placed, and plays (markers off)');
    check(new Set(devices.map((d) => got[d.id].seed)).size === 1 && new Set(devices.map((d) => got[d.id].start)).size === 1, 'every tile has the same seed and start');
    // where each tile sits, against the placement that made the photo (relative to the reference: the laptop)
    const ref = got.laptop.reference;
    check(ref === 'laptop', `the reference is the screen that covers the most of the photo (${ref})`);
    const rows = [];
    let worst = { a: 0, s: 0, mm: 0 };
    for (const d of devices) {
      const rel = mul(inv(got[ref].toCanvas), got[d.id].toCanvas), truth = mul(inv(sent.T[ref]), sent.T[d.id]);
      const a = Math.abs(((Math.atan2(rel[3], rel[0]) - Math.atan2(truth[3], truth[0])) * deg + 540) % 360 - 180);
      const s = Math.abs(Math.hypot(rel[0], rel[3]) / Math.hypot(truth[0], truth[3]) - 1) * 100;
      let mm = 0;
      const pitchRef = Math.hypot(sent.T[ref][0], sent.T[ref][3]);
      for (const c of [[0, 0], [d.px[0], 0], [d.px[0], d.px[1]], [0, d.px[1]]]) { const p = ap(rel, c), q = ap(truth, c); mm = Math.max(mm, Math.hypot(p[0] - q[0], p[1] - q[1]) * pitchRef); }
      worst = { a: Math.max(worst.a, a), s: Math.max(worst.s, s), mm: Math.max(worst.mm, mm) };
      rows.push(`${d.id} ${a.toFixed(4)}° ${s.toFixed(4)} % ${mm.toFixed(3)} mm`);
    }
    console.log('# placed vs truth (corners, on the table): ' + rows.join(' · '));
    check(worst.a < 0.2 && worst.s < 0.5 && worst.mm < 1, 'every tile within 0.2°, 0.5 % and 1 mm of where it lies');
    // a dot crossing the canvas: every tile puts it on the same millimetre of the table, at the same size
    const C = got.laptop.canvas;
    let apart = 0, size = 0;
    for (let k = 0; k <= 100; k++) {
      const x = C.w * k / 100, y = C.h * (0.5 + 0.4 * Math.sin(k / 9));
      const mm = devices.map((d) => ap(sent.T[d.id], ap(inv(got[d.id].toCanvas), [x, y])));
      const sz = devices.map((d) => Math.hypot(sent.T[d.id][0], sent.T[d.id][3]) / Math.hypot(got[d.id].toCanvas[0], got[d.id].toCanvas[3]));
      for (let i = 1; i < mm.length; i++) { apart = Math.max(apart, Math.hypot(mm[i][0] - mm[0][0], mm[i][1] - mm[0][1])); size = Math.max(size, Math.abs(sz[i] / sz[0] - 1) * 100); }
    }
    console.log(`# a dot across the canvas: the tiles agree within ${apart.toFixed(3)} mm, its size within ${size.toFixed(4)} %`);
    check(apart < 1 && size < 0.5, 'continuity: position within 1 mm, size within 0.5 % across the tiles');
    console.log('# clocks: ' + devices.map((d) => `${d.id} offset ${got[d.id].offset.toFixed(2)} ms (round trip ${got[d.id].rtt.toFixed(2)} ms)`).join(' · '));
    const skews = devices.map((d) => got[d.id].skew);
    check(Math.max(...skews) - Math.min(...skews) < 5, `the shared clock agrees across tiles within 5 ms (spread ${(Math.max(...skews) - Math.min(...skews)).toFixed(2)} ms; one machine, so the true spread is 0)`);

    // ------------------------------------------------------------------ 3. one instant, from above
    // params are performable: bigger dot and sparks so they read at thumbnail size, the same on every tile
    for (const d of devices) await d.page.evaluate(() => { for (const [k, v] of Object.entries({ size: 0.06, sparks: 320, spread: 0.85, grid: 0.45, tail: 0.8 })) window.openav.params.override(k, v); });
    // an instant worth a picture: the dot on a screen and sparks on more than one (bright pixels on each tile's own canvas)
    const now = await devices[0].page.evaluate(() => window.oavTile.time());
    let T0 = now, best = -1;
    for (let k = 0; k < 48; k++) {
      const t = now + 2 + k * 0.37;
      let score = 0;
      for (const d of devices) {
        score += await d.page.evaluate(async (t) => {
          window.oavTile.time = () => t;
          await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
          const c = document.querySelector('.oav-stage canvas'), g = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
          let core = 0, lit = 0;
          for (let i = 0; i < g.length; i += 16) { const v = g[i] + g[i + 1] + g[i + 2]; if (v > 640) core++; else if (v > 200) lit++; }
          return core * 4 + (lit > 50 ? 4000 : 0) + Math.min(lit, 4000);
        }, t);
      }
      if (score > best) { best = score; T0 = t; }
    }
    for (const d of devices) await d.page.evaluate((t) => { window.oavTile.time = () => t; }, T0);
    await new Promise((r) => setTimeout(r, 500));
    const still = {};
    for (const d of devices) { const b = await d.page.screenshot({ type: 'png' }); still[d.id] = b.toString('base64'); if (SHOTS) fs.writeFileSync(path.join(SHOTS, `tile-${d.id}-show.png`), b); }
    const top = await cam.evaluate(async ({ still, T }) => {
      // the table seen from straight above: millimetres → an 800×500 picture
      const W = 800, H = 500;
      const ids = Object.keys(still);
      const imgs = {};
      for (const id of ids) imgs[id] = await createImageBitmap(await (await fetch('data:image/png;base64,' + still[id])).blob());
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const id of ids) { const M = T[id], im = imgs[id]; for (const [u, v] of [[0, 0], [im.width, 0], [im.width, im.height], [0, im.height]]) { const x = M[0] * u + M[1] * v + M[2], y = M[3] * u + M[4] * v + M[5]; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); } }
      const pad = 18, k = Math.min((W - 2 * pad) / (x1 - x0), (H - 2 * pad) / (y1 - y0));
      const c = document.createElement('canvas'); c.width = W * 2; c.height = H * 2;
      const g = c.getContext('2d');
      g.fillStyle = '#2b2d33'; g.fillRect(0, 0, c.width, c.height);
      for (const id of ids) {
        const M = T[id], im = imgs[id], s = 2 * k;
        g.setTransform(s * M[0], s * M[3], s * M[1], s * M[4], s * (M[2] - x0) + 2 * (W - k * (x1 - x0)) / 2, s * (M[5] - y0) + 2 * (H - k * (y1 - y0)) / 2);
        const bz = 7 / Math.hypot(M[0], M[3]);       // a 7 mm frame
        g.fillStyle = '#0b0b0d'; g.beginPath(); g.roundRect(-bz, -bz, im.width + 2 * bz, im.height + 2 * bz, bz * 1.2); g.fill();
        g.drawImage(im, 0, 0);
      }
      const out = document.createElement('canvas'); out.width = W; out.height = H;
      out.getContext('2d').drawImage(c, 0, 0, W, H);
      return { webp: out.toDataURL('image/webp', 0.82), png: out.toDataURL('image/png') };
    }, { still, T: sent.T });
    const webp = Buffer.from(top.webp.split(',')[1], 'base64');
    console.log(`# thumbnail: 800×500 webp, ${webp.length} bytes`);
    if (SHOTS) fs.writeFileSync(path.join(SHOTS, 'tile-top.png'), Buffer.from(top.png.split(',')[1], 'base64'));
    if (process.env.THUMB) { fs.writeFileSync(path.resolve(ROOT, process.env.THUMB), webp); console.log(`# wrote ${process.env.THUMB}`); }

    check(errors.length === 0, 'no console errors on the camera page or the tiles (the ws://…:7457 backstage monitor aside)' + (errors.length ? ':\n  ' + errors.join('\n  ') : ''));
  } catch (e) {
    console.error(e);
    fails.push(String(e.message || e));
  } finally {
    await browser.close();
    server.kill();
  }
  console.log(fails.length ? `\n${fails.length} FAILED` : '\nall passed');
  process.exit(fails.length ? 1 : 0);
})();
