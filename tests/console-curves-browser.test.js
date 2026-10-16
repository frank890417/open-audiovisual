// The desk's curve view (G6) in a real page: createShow() with a score and some automation, then the Curves panel —
// open it with the C key, read what it drew, override a param, click ↩, click a curve to seek.
// The pure parts (axis, bands, sampling, cursor, signature) are in console-curves.test.js; the keys in console-keys.test.js.
// Needs Playwright with a Chromium; without it these skip.   OAV_PLAYWRIGHT=/path/to/playwright/index.mjs   OAV_BROWSER_EXEC=/path/to/chrome (optional)
//
// "Does it draw / does it not draw" is measured, not trusted: a spy on CanvasRenderingContext2D counts every drawing call
// made on a canvas inside .oav-curves, split into the cached curve layer (.cv-base) and the per-frame layer (.cv-over).
// And "it drew the right thing" is read back from the pixels (the cursor is a white column, an override an amber dot).
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

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
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

/** Never connects (so nothing logs a refused monitor connection), and counts every drawing call inside the curve view. */
const SPY = `
window.WebSocket = class { constructor(u) {} close() {} send() {} };
window.__draws = { base: 0, over: 0 };
for (const m of ['clearRect', 'fillRect', 'stroke', 'fill', 'fillText', 'drawImage', 'setTransform', 'putImageData']) {
  const orig = CanvasRenderingContext2D.prototype[m];
  CanvasRenderingContext2D.prototype[m] = function (...a) {
    const c = this.canvas;
    if (c && c.closest && c.closest('.oav-curves')) window.__draws[c.classList.contains('cv-over') ? 'over' : 'base']++;
    return orig.apply(this, a);
  };
}
/** Pixels, read back: how much ink a canvas has, which column is the white cursor, where the amber (override) dot is. */
window.__ink = (el) => { const d = el.getContext('2d').getImageData(0, 0, el.width, el.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) n++; return n; };
window.__cursorColumn = (el) => {
  const { width: w, height: h } = el, d = el.getContext('2d').getImageData(0, 0, w, h).data, col = new Array(w).fill(0);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4; if (d[i + 3] > 150 && d[i] > 235 && d[i + 1] > 235 && d[i + 2] > 235) col[x]++; }
  const best = Math.max(...col);
  return best ? col.indexOf(best) : -1;
};
window.__amberDot = (el) => {
  const { width: w, height: h } = el, d = el.getContext('2d').getImageData(0, 0, w, h).data;
  let n = 0, sx = 0, sy = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4; if (d[i + 3] >= 250 && d[i] > 230 && d[i + 1] > 150 && d[i + 1] < 200 && d[i + 2] < 90) { n++; sx += x; sy += y; } }
  return n ? { n, x: sx / n, y: sy / n } : null;
};
`;

async function withPage(fn, { url = '/tests/fixtures/curves-page.html', ready = () => typeof window.__start === 'function', viewport } = {}) {
  const { srv, base } = await serve();
  const browser = await pw.chromium.launch({ executablePath: process.env.OAV_BROWSER_EXEC || undefined });
  try {
    const ctx = await browser.newContext(viewport ? { viewport } : {});
    await ctx.addInitScript(SPY);
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push('pageerror ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push('console ' + m.text()); });
    await page.goto(base + url);
    await page.waitForFunction(ready);
    await fn(page, errors, base);
    assert.deepEqual(errors, [], 'no console errors');
  } finally { await browser.close(); srv.close(); }
}
const opts = { skip: SKIP, timeout: 90000 };

const start = (page, o = {}) => page.evaluate(async (o) => { await window.__start({ loop: 'manual', monitor: false, ...o }); return true; }, o);
const frames = (page, n = 1, dt = 1 / 60) => page.evaluate(([n, dt]) => { for (let i = 0; i < n; i++) window.openav.loop.step(dt); }, [n, dt]);
const draws = (page) => page.evaluate(() => ({ ...window.__draws }));
const zero = (page) => page.evaluate(() => { window.__draws.base = 0; window.__draws.over = 0; });
const isOpen = (page) => page.evaluate(() => { const p = document.querySelector('.oav-curves'); return !!p && !p.hidden && !p.classList.contains('closed'); });
const keysOf = (page) => page.evaluate(() => [...document.querySelectorAll('.oav-curves .cv-row')].map((r) => r.dataset.key));
const box = async (page, sel) => { await page.locator(sel).scrollIntoViewIfNeeded(); const b = await page.locator(sel).boundingBox(); assert.ok(b, sel + ' has a box'); return b; };
/** Where a level (0 = bottom of the param's range, 1 = top) sits in a plot of this height: 4 px of padding top and bottom. Written out here, not imported, so it checks the panel's own. */
const plotY = (level, h) => 4 + (1 - level) * (h - 8);
const near = (a, b, e, msg) => assert.ok(Math.abs(a - b) <= e, `${msg || ''} ${a} ≉ ${b} (±${e})`);

// ───────────────────────────────────────────────────────────────────────────── there, or not there

test('curves: a show with nothing automated has no Curves panel on its desk, and C does nothing', opts, async () => {
  await withPage(async (page) => {
    await start(page, { score: null, timeline: { automation: {} } });
    await page.keyboard.press('c');
    await frames(page, 5);
    assert.equal(await page.evaluate(() => { const p = document.querySelector('.oav-curves'); return !p || p.hidden; }), true);
    assert.equal(await page.evaluate(() => window.openav.console.curves?.open ?? false), false);
    assert.deepEqual(await draws(page), { base: 0, over: 0 });
  });
});

test('curves: with automation the panel is there, collapsed — the same collapsible header as every other panel — and draws nothing', opts, async () => {
  await withPage(async (page) => {
    await start(page);
    assert.equal(await page.evaluate(() => { const p = document.querySelector('.oav-curves'); return !!p && !p.hidden && p.classList.contains('closed'); }), true, 'there, and closed');
    assert.equal(await page.locator('.oav-curves h3').textContent(), 'Curves');   // (innerText would be the CSS's uppercase)
    // 2 s of a playing show with the panel closed: not one drawing call, and no canvas exists to draw on
    await page.evaluate(() => window.openav.timeline.seek(10));
    await page.evaluate(() => window.openav.timeline.play());
    await frames(page, 120);
    assert.deepEqual(await draws(page), { base: 0, over: 0 }, 'a closed panel draws nothing');
    assert.equal(await page.evaluate(() => document.querySelectorAll('.oav-curves canvas').length), 0, 'and it has not even made its canvases');
    // the header opens it like any panel
    await page.click('.oav-curves h3');
    assert.equal(await isOpen(page), true);
    await page.click('.oav-curves h3');
    assert.equal(await isOpen(page), false);
  });
});

test('curves: C opens and closes it; closing stops the drawing again at once', opts, async () => {
  await withPage(async (page) => {
    await start(page);
    await page.keyboard.press('c');
    assert.equal(await isOpen(page), true);
    await frames(page, 3);
    assert.ok((await draws(page)).over > 0, 'drawing while open');
    await page.keyboard.press('c');
    assert.equal(await isOpen(page), false);
    await zero(page);
    await frames(page, 60);
    assert.deepEqual(await draws(page), { base: 0, over: 0 }, 'closed again: silent');
    assert.match(await page.locator('.oav-curves h3').getAttribute('title'), /\(C\)/, 'the tooltip prints the key');
  });
});

// ───────────────────────────────────────────────────────────────────────────── what it shows

test('curves: one row per automated param in schema order (not the pulse, not the param nobody automated), segment ids on the ruler', opts, async () => {
  await withPage(async (page) => {
    await start(page);
    await page.keyboard.press('c');
    await frames(page, 2);
    assert.deepEqual(await keysOf(page), ['haze', 'glow', 'mode']);
    assert.deepEqual(await page.locator('.oav-curves .cv-row b').allInnerTexts(), ['Haze', 'Glow', 'Mode']);
    const info = await page.evaluate(() => window.openav.console.curves.info());
    assert.deepEqual(info.keys, ['haze', 'glow', 'mode']);
    assert.deepEqual(info.bands.map((b) => b.id), ['standby', 'dawn', 'noon', 'night']);
    assert.deepEqual(info.axis, { lo: 0, hi: 100, span: 100 });
    assert.equal(await page.locator('.oav-curves .cv-ruler').count(), 1);
    assert.equal(await page.evaluate(() => document.querySelector('.oav-curves .cv-ruler').hidden), false);
    assert.match(await page.locator('.oav-curves .cv-sum').innerText(), /^3 curves$/);
    // every layer has ink: the curves and the ruler were really drawn
    const ink = await page.evaluate(() => [...document.querySelectorAll('.oav-curves .cv-base')].map((c) => window.__ink(c)));
    assert.equal(ink.length, 4);
    assert.ok(ink.every((n) => n > 200), 'ink: ' + ink);
  });
});

test('curves: a show without a score or scenes still gets its curves — just no ruler and no bands', opts, async () => {
  await withPage(async (page) => {
    await start(page, { score: null, timeline: { total: 60, automation: { haze: [[0, 0.1], [60, 0.9]] } } });
    await page.keyboard.press('c');
    await frames(page, 2);
    assert.deepEqual(await keysOf(page), ['haze']);
    assert.equal(await page.evaluate(() => { const r = document.querySelector('.oav-curves .cv-ruler'); return !r || r.hidden; }), true, 'nothing to name');
    assert.deepEqual(await page.evaluate(() => window.openav.console.curves.info().bands), []);
    assert.match(await page.locator('.oav-curves .cv-sum').innerText(), /^1 curve$/);
  });
});

test('curves: the cursor is a column at the playhead, and the head prints the value the show is using', opts, async () => {
  await withPage(async (page) => {
    await start(page);
    await page.keyboard.press('c');
    for (const t of [18, 50, 90]) {
      await page.evaluate((t) => window.openav.timeline.seek(t), t);
      await frames(page, 1);
      const r = await page.evaluate(() => {
        const row = document.querySelector('.cv-row[data-key="haze"]'), c = row.querySelector('.cv-over');
        return { col: window.__cursorColumn(c), w: c.width, css: c.clientWidth, val: row.querySelector('.val').textContent, haze: window.openav.timeline.state().haze };
      });
      near(r.col, (t / 100) * r.css * (r.w / r.css), 2, `cursor at ${t} s`);
      assert.equal(r.val, r.haze.toFixed(2), `the head prints haze (${r.haze}) at ${t} s`);
    }
  });
});

test('curves: the cursor moves with the show while it plays, on every row, and only the cursor layer is redrawn', opts, async () => {
  await withPage(async (page) => {
    await start(page);
    await page.keyboard.press('c');
    await page.evaluate(() => { window.openav.timeline.seek(10); window.openav.timeline.play(); });
    await frames(page, 1);
    const at = () => page.evaluate(() => ['haze', 'glow', 'mode'].map((k) => window.__cursorColumn(document.querySelector(`.cv-row[data-key="${k}"] .cv-over`))));
    const a = await at();
    await frames(page, 60 * 5);                                               // 5 show seconds
    const b = await at();
    const w = await page.evaluate(() => document.querySelector('.cv-row .cv-over').width);
    a.forEach((x, i) => near(b[i] - x, (5 / 100) * w, 2, 'row ' + i + ' moved 5 s'));
  });
});

// ───────────────────────────────────────────────────────────────────────────── the cache

test('curves: the curves are drawn once; a playing show redraws only the cursor — until the automation, the size or the cut changes', opts, async () => {
  await withPage(async (page) => {
    await start(page);
    await page.keyboard.press('c');
    await frames(page, 1);
    const first = await draws(page);
    assert.ok(first.base > 0 && first.over > 0, 'first frame draws both layers: ' + JSON.stringify(first));
    await zero(page);
    await page.evaluate(() => { window.openav.timeline.seek(10); window.openav.timeline.play(); });
    await frames(page, 120);
    const playing = await draws(page);
    assert.equal(playing.base, 0, 'two seconds of playing did not touch the cached curves');
    assert.ok(playing.over >= 120 * 4, 'but the cursor layer was drawn every frame (' + playing.over + ' calls)');

    // the automation changes (an import, as a take would) → the curves are redrawn on the next frame, once
    await zero(page);
    await page.evaluate(() => window.openav.timeline.importAutomation({ glow: [[0, 0.9], [100, 0.1]] }));
    await frames(page, 1);
    const changed = await draws(page);
    assert.ok(changed.base > 0, 'the import redrew the curves');
    const inkAfter = await page.evaluate(() => window.__ink(document.querySelector('.cv-row[data-key="glow"] .cv-base')));
    assert.ok(inkAfter > 200);
    await zero(page);
    await frames(page, 30);
    assert.equal((await draws(page)).base, 0, 'and then they are cached again');

    // an edit in place is noticed too
    await page.evaluate(() => { window.openav.timeline.automation.glow[1][1] = 0.5; });
    await zero(page);
    await frames(page, 1);
    assert.ok((await draws(page)).base > 0, 'a keyframe edited in place redraws');

    // the width changes (the desk goes full width on a phone held upright) → redrawn at the new width
    await zero(page);
    const before = await page.evaluate(() => document.querySelector('.cv-row .cv-base').clientWidth);
    await page.setViewportSize({ width: 600, height: 1000 });
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    await frames(page, 2);
    const after = await page.evaluate(() => { const c = document.querySelector('.cv-row .cv-base'); return { css: c.clientWidth, px: c.width }; });
    assert.notEqual(after.css, before, 'the layout really changed width');
    assert.equal(after.px, Math.round(after.css * await page.evaluate(() => Math.min(2, devicePixelRatio || 1))), 'the canvas follows the new width');
    assert.ok((await draws(page)).base > 0, 'a new width redraws the curves');
    await zero(page);
    await frames(page, 30);
    assert.equal((await draws(page)).base, 0, 'cached again at the new width');
  });
});

test('curves: a long list scrolls, and only the rows in view are drawn', opts, async () => {
  await withPage(async (page) => {
    const N = 40;
    await page.evaluate(async (N) => {
      const world = { name: 'big', params: Array.from({ length: N }, (_, i) => ({ key: 'p' + i, label: 'Param ' + i, min: 0, max: 1, def: 0.5 })), init() {}, update() {}, render() {}, dispose() {} };
      await window.__start({
        loop: 'manual', monitor: false, world, score: null,
        timeline: { total: 60, automation: Object.fromEntries(Array.from({ length: N }, (_, i) => ['p' + i, [[0, 0], [30, (i % 5) / 4], [60, 1]]])) },
      });
    }, N);
    await page.keyboard.press('c');
    await frames(page, 2);
    const scroll = await page.evaluate(() => { const s = document.querySelector('.oav-curves .cv-scroll'); return { h: s.clientHeight, all: s.scrollHeight, overflow: getComputedStyle(s).overflowY }; });
    assert.ok(scroll.all > scroll.h * 3, 'the list is longer than its window: ' + JSON.stringify(scroll));
    assert.ok(['auto', 'scroll'].includes(scroll.overflow));
    const drawn = () => page.evaluate(() => [...document.querySelectorAll('.oav-curves .cv-row')].map((r) => (window.__ink(r.querySelector('.cv-base')) > 0 ? 1 : 0)));
    const d0 = await drawn();
    assert.equal(d0.length, N);
    assert.ok(d0[0] === 1 && d0[2] === 1, 'the rows in view are drawn');
    assert.ok(d0.reduce((a, b) => a + b) <= 12, 'but not all 40: ' + d0.reduce((a, b) => a + b));
    assert.equal(d0[N - 1], 0, 'the last one waits');
    await page.evaluate(() => { const s = document.querySelector('.oav-curves .cv-scroll'); s.scrollTop = s.scrollHeight; });
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(r)));
    await frames(page, 2);
    const d1 = await drawn();
    assert.equal(d1[N - 1], 1, 'scrolled to the end, the last row is drawn');
    assert.ok(d1.reduce((a, b) => a + b) <= 24);
  });
});

// ───────────────────────────────────────────────────────────────────────────── overrides

test('curves: an override shows as an amber dot at its value, the row is marked, ↩ appears and gives the param back to its curve', opts, async () => {
  await withPage(async (page) => {
    await start(page);
    await page.keyboard.press('c');
    await page.evaluate(() => window.openav.timeline.seek(18));
    await frames(page, 1);
    const row = '.cv-row[data-key="haze"]';
    assert.equal(await page.locator(`${row} [data-clear]`).isHidden(), true, 'no ↩ while the curve is in charge');
    assert.equal(await page.evaluate((r) => document.querySelector(r).classList.contains('ovr'), row), false);
    assert.equal(await page.evaluate(() => window.__amberDot(document.querySelector('.cv-row[data-key="haze"] .cv-over'))), null, 'no amber on the canvas');

    await page.evaluate(() => window.openav.params.override('haze', 0.9));
    await frames(page, 1);
    assert.equal(await page.evaluate((r) => document.querySelector(r).classList.contains('ovr'), row), true);
    assert.equal(await page.locator(`${row} [data-clear]`).isVisible(), true, '↩ is there');
    assert.equal(await page.locator(`${row} .val`).innerText(), '0.90', 'the head prints the override');
    assert.match(await page.locator('.oav-curves .cv-sum').innerText(), /3 curves · 1 overridden/);
    const dot = await page.evaluate(() => { const c = document.querySelector('.cv-row[data-key="haze"] .cv-over'); return { ...window.__amberDot(c), w: c.width, h: c.height, css: c.clientWidth, cssH: c.clientHeight }; });
    near(dot.x, (18 / 100) * dot.w, 2, 'the dot is at the playhead');
    near(dot.y, plotY(0.9, dot.cssH) * (dot.h / dot.cssH), 2, 'and at the override level (0.9 of the range)');
    assert.equal(await page.evaluate(() => window.__amberDot(document.querySelector('.cv-row[data-key="glow"] .cv-over'))), null, 'other rows have none');

    await page.click(`${row} [data-clear]`);
    assert.equal(await page.evaluate(() => window.openav.params.isOverridden('haze')), false, '↩ cleared the override');
    await frames(page, 1);
    assert.equal(await page.evaluate((r) => document.querySelector(r).classList.contains('ovr'), row), false);
    assert.equal(await page.locator(`${row} [data-clear]`).isHidden(), true);
    assert.equal(await page.evaluate(() => window.__amberDot(document.querySelector('.cv-row[data-key="haze"] .cv-over'))), null);
    assert.match(await page.locator('.oav-curves .cv-sum').innerText(), /^3 curves$/);
  });
});

test('curves: "↩ all" gives back every curve in the view and leaves an override on a param the view does not show', opts, async () => {
  await withPage(async (page) => {
    await start(page);
    await page.keyboard.press('c');
    await frames(page, 1);
    assert.equal(await page.locator('.oav-curves [data-all]').isDisabled(), true, 'nothing to give back');
    await page.evaluate(() => { const p = window.openav.params; p.override('haze', 0.9); p.override('glow', 0.1); p.override('plain', 0.3); });
    await frames(page, 1);
    assert.equal(await page.locator('.oav-curves [data-all]').isDisabled(), false);
    assert.match(await page.locator('.oav-curves .cv-sum').innerText(), /2 overridden/, 'plain has no curve, so it is not counted');
    await page.click('.oav-curves [data-all]');
    const left = await page.evaluate(() => ['haze', 'glow', 'mode', 'plain'].filter((k) => window.openav.params.isOverridden(k)));
    assert.deepEqual(left, ['plain'], 'the Params panel\'s override stays as it was');
    await frames(page, 1);
    assert.equal(await page.locator('.oav-curves [data-all]').isDisabled(), true);
    assert.equal(await page.locator('.oav-curves .cv-row.ovr').count(), 0);
  });
});

test('curves: a slider moved on the Params panel shows up on the curve at once — the same override, seen from both panels', opts, async () => {
  await withPage(async (page) => {
    await start(page);
    await page.keyboard.press('c');
    await frames(page, 1);
    await page.evaluate(() => {
      const slider = [...document.querySelectorAll('.oav-param')].find((r) => r.querySelector('label').textContent === 'Glow').querySelector('input');
      slider.value = '0.75'; slider.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await frames(page, 1);
    assert.equal(await page.evaluate(() => window.openav.params.overrides.glow), 0.75);
    assert.equal(await page.evaluate(() => document.querySelector('.cv-row[data-key="glow"]').classList.contains('ovr')), true);
    await page.click('.cv-row[data-key="glow"] [data-clear]');
    await frames(page, 1);
    assert.equal(await page.evaluate(() => document.querySelector('.oav-param.ovr') === null), true, 'the Params panel un-marks it too');
  });
});

test('curves: a take being recorded is drawn in red as it plays, and the curve is redrawn when the take closes', opts, async () => {
  await withPage(async (page) => {
    await start(page);
    await page.keyboard.press('c');
    await page.evaluate(() => {
      const { timeline, params } = window.openav;
      timeline.record('glow', () => (params.isOverridden('glow') ? params.overrides.glow : null));
      timeline.seek(10); timeline.play(); params.override('glow', 0.8);
    });
    await frames(page, 600);                                                   // ten seconds of "a hand on the knob" (30 px of a 100 s show)
    const red = () => page.evaluate(() => {
      const c = document.querySelector('.cv-row[data-key="glow"] .cv-over'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200 && d[i] > 230 && d[i + 1] < 110 && d[i + 2] < 130) n++;
      return n;
    });
    assert.ok(await red() > 20, 'the take is a red line on the glow curve');
    assert.equal(await page.evaluate(() => document.querySelector('.cv-row[data-key="haze"]').classList.contains('ovr')), false);
    const before = await page.evaluate(() => JSON.stringify(window.openav.timeline.automation.glow));
    await zero(page);
    await page.evaluate(() => window.openav.params.clearOverride('glow'));      // let go: the recorder closes the take into the lane
    await frames(page, 2);
    const after = await page.evaluate(() => JSON.stringify(window.openav.timeline.automation.glow));
    assert.notEqual(after, before, 'the take was written into the lane');
    assert.ok((await draws(page)).base > 0, 'so the curve was redrawn');
    assert.equal(await red(), 0, 'and the red line is gone');
    await zero(page);
    await frames(page, 30);
    assert.equal((await draws(page)).base, 0, 'cached again');
  });
});

// ───────────────────────────────────────────────────────────────────────────── seek

test('curves: a click on a curve or on the ruler seeks like the scrubber; dragging scrubs; it works while the show plays', opts, async () => {
  await withPage(async (page) => {
    await start(page);
    await page.keyboard.press('c');
    await frames(page, 1);
    const t = () => page.evaluate(() => window.openav.timeline.t);
    const plot = await box(page, '.cv-row[data-key="glow"] .cv-plot');
    const at = (b, f) => [b.x + b.width * f, b.y + b.height / 2];
    await page.mouse.click(...at(plot, 0.25));
    near(await t(), 25, 100 / plot.width + 0.5, 'click at 25 %');
    // the scrubber above says the same for the same fraction of its width (one axis, two widths: the panel has its padding)
    const scrub = await box(page, '.oav-scrub');
    await page.mouse.click(...at(scrub, 0.25));
    near(await t(), 25, 100 / scrub.width + 0.5, 'click at 25 % on the scrubber');

    const ruler = await box(page, '.oav-curves .cv-ruler');
    await page.mouse.click(...at(ruler, 0.6));
    near(await t(), 60, 100 / plot.width + 0.5, 'click on the ruler');

    const [x0, y0] = at(plot, 0.1), [x1] = at(plot, 0.8);                   // drag
    await page.mouse.move(x0, y0); await page.mouse.down();
    near(await t(), 10, 100 / plot.width + 0.5, 'press');
    await page.mouse.move((x0 + x1) / 2, y0, { steps: 4 });
    await page.mouse.move(x1, y0, { steps: 4 });
    near(await t(), 80, 100 / plot.width + 0.5, 'drag');
    await page.mouse.move(plot.x + plot.width + 6, y0);                    // past the right edge: the end
    assert.equal(await t(), 100);
    await page.mouse.up();
    await page.mouse.move(x0, y0);
    assert.equal(await t(), 100, 'letting go ends the drag');

    await page.evaluate(() => { window.openav.timeline.seek(40); window.openav.timeline.play(); });
    await page.mouse.click(...at(plot, 0.5));
    assert.equal(await page.evaluate(() => window.openav.timeline.playing), true, 'seeking does not stop the show (as on the scrubber)');
    near(await t(), 50, 100 / plot.width + 0.5);
    await frames(page, 1);
    // a click on the ↩ chip is not a seek
    await page.evaluate(() => window.openav.params.override('glow', 0.4));
    await frames(page, 1);
    const before = await t();
    await page.click('.cv-row[data-key="glow"] [data-clear]');
    assert.equal(await t(), before);
  });
});

test('curves: hovering a curve or the ruler names the segment and the time under the pointer', opts, async () => {
  await withPage(async (page) => {
    await start(page);
    await page.keyboard.press('c');
    await frames(page, 1);
    const ruler = await box(page, '.oav-curves .cv-ruler');
    await page.mouse.move(ruler.x + ruler.width * 0.03, ruler.y + 8);          // 3 s into the 6 s standby, a band too narrow for its own name
    await page.mouse.move(ruler.x + ruler.width * 0.03 + 1, ruler.y + 8);
    assert.match(await page.locator('.oav-curves .cv-ruler').getAttribute('title'), /^standby · 0:03 — click or drag/);
    const plot = await box(page, '.cv-row[data-key="haze"] .cv-plot');
    await page.mouse.move(plot.x + plot.width * 0.5, plot.y + 10);
    await page.mouse.move(plot.x + plot.width * 0.5 + 1, plot.y + 10);
    assert.match(await page.locator('.cv-row[data-key="haze"] .cv-plot').getAttribute('title'), /^noon · 0:50 — click or drag/);
  });
});

test('curves: a derived cut (?cut=short) shows the same curves in half the time, and a click seeks in that cut\'s seconds', opts, async () => {
  await withPage(async (page) => {
    await start(page, { score: { cuts: [
      { id: 'full', segments: [{ id: 'standby', dur: 6 }, { id: 'dawn', dur: 24 }, { id: 'noon', dur: 30 }, { id: 'night', dur: 40 }] },
      { id: 'short', from: 'full', scale: 0.5 },
    ], cut: 'short', modules: ['standby', 'dawn', 'noon', 'night'].map((id) => ({ id })) } });
    await page.keyboard.press('c');
    await frames(page, 1);
    const info = await page.evaluate(() => window.openav.console.curves.info());
    assert.deepEqual(info.axis, { lo: 0, hi: 50, span: 50 });
    assert.deepEqual(info.bands.map((b) => [b.id, b.t1]), [['standby', 3], ['dawn', 15], ['noon', 30], ['night', 50]]);
    const plot = await box(page, '.cv-row[data-key="haze"] .cv-plot');
    await page.mouse.click(plot.x + plot.width * 0.5, plot.y + 10);
    near(await page.evaluate(() => window.openav.timeline.t), 25, 50 / plot.width + 0.5, 'half of the short cut is 25 s');
  });
});

// ───────────────────────────────────────────────────────────────────────────── keys and options

test('curves: the C key follows the console\'s key table — movable, switchable off, and the piano keeps its letters', opts, async () => {
  await withPage(async (page) => {                                           // moved to F4
    await start(page, { console: { keys: { curves: 'F4' } } });
    await page.keyboard.press('c');
    assert.equal(await isOpen(page), false, 'C is free');
    await page.keyboard.press('F4');
    assert.equal(await isOpen(page), true);
    assert.match(await page.locator('.oav-curves h3').getAttribute('title'), /\(F4\)/);
    await page.keyboard.press('F4');
    assert.equal(await isOpen(page), false);
    await page.evaluate(() => { window.openav.keys.piano.captureEnabled = true; });
    await page.keyboard.press('F4');
    assert.equal(await isOpen(page), true, 'an F-key works through the piano');
    assert.deepEqual(await page.evaluate(() => window.openav.console.keys.curves.map((b) => b.label)), ['F4']);
  });
  await withPage(async (page) => {                                           // the default key, and the piano holding the letters
    await start(page);
    await page.evaluate(() => { window.openav.keys.piano.captureEnabled = true; });
    await page.keyboard.press('c');
    assert.equal(await isOpen(page), false, 'C is a piano letter while it captures');
    await page.evaluate(() => { window.openav.keys.piano.captureEnabled = false; });
    await page.keyboard.press('c');
    assert.equal(await isOpen(page), true);
  });
  await withPage(async (page) => {                                           // switched off: the header still opens it
    await start(page, { console: { keys: { curves: false } } });
    await page.keyboard.press('c');
    assert.equal(await isOpen(page), false);
    assert.equal(await page.evaluate(() => window.openav.console.keys.curves.length), 0);
    assert.doesNotMatch(await page.locator('.oav-curves h3').getAttribute('title'), /\(/);
    await page.click('.oav-curves h3');
    assert.equal(await isOpen(page), true);
  });
  await withPage(async (page) => {                                           // keys: false
    await start(page, { console: { keys: false } });
    await page.keyboard.press('c');
    assert.equal(await isOpen(page), false);
  });
});

test('curves: console { curves: false } leaves the panel out, { curves: { open: true } } starts it open; Space and the other keys are untouched', opts, async () => {
  await withPage(async (page) => {
    await start(page, { console: { curves: false } });
    await page.keyboard.press('c');
    await frames(page, 2);
    assert.equal(await page.evaluate(() => document.querySelector('.oav-curves')), null);
    assert.equal(await page.evaluate(() => window.openav.console.curves), null);
    await page.keyboard.press('Space');
    assert.equal(await page.evaluate(() => window.openav.timeline.playing), true);
    assert.deepEqual(await draws(page), { base: 0, over: 0 });
  });
  await withPage(async (page) => {
    await start(page, { console: { curves: { open: true } } });
    await frames(page, 1);
    assert.equal(await isOpen(page), true);
    assert.ok((await draws(page)).base > 0);
  });
});

// ───────────────────────────────────────────────────────────────────────────── the real examples

test('curves: example 13 (score, lanes) and example 14 (timeline) open the curve view with no console error', opts, async () => {
  const ready = () => !!window.openav?.timeline?.scenes?.length;
  await withPage(async (page) => {
    await page.keyboard.press('c');
    await page.waitForSelector('.oav-curves:not(.closed) .cv-row');
    await page.evaluate(() => new Promise((r) => setTimeout(r, 400)));
    assert.deepEqual(await keysOf(page), ['haze'], '13 automates haze, per segment');
    const info = await page.evaluate(() => window.openav.console.curves.info());
    assert.deepEqual(info.bands.map((b) => b.id), ['standby', 'dawn', 'noon', 'dusk', 'night']);
    assert.ok(await page.evaluate(() => window.__ink(document.querySelector('.cv-row[data-key="haze"] .cv-base'))) > 200);
  }, { url: '/examples/13-score-director/', ready });
  await withPage(async (page) => {
    await page.keyboard.press('c');
    await page.waitForSelector('.oav-curves:not(.closed) .cv-row');
    await page.evaluate(() => new Promise((r) => setTimeout(r, 400)));
    assert.deepEqual(await keysOf(page), ['hue', 'speed', 'density', 'zoom', 'shape']);
    const info = await page.evaluate(() => window.openav.console.curves.info());
    assert.deepEqual(info.bands.map((b) => b.id), ['dawn', 'swell', 'drop', 'afterglow']);
    assert.ok((await draws(page)).over > 0);
    // the example's own timeline and the desk's view read the same automation: move a knob on the example's lane, see ↩ on the desk's
    await page.evaluate(() => window.openav.params.override('hue', 300));
    await page.evaluate(() => new Promise((r) => setTimeout(r, 200)));
    assert.equal(await page.locator('.oav-curves .cv-row[data-key="hue"] [data-clear]').isVisible(), true);
  }, { url: '/examples/14-timeline/', ready });
});
