// createShow({ sync }) — the option that makes several pages one show (packages/sync, relay roles leader/follower).
// 純邏輯的部分（選項檢查、follower 預設關掉會產生輸入的模組）在 node 跑；後半在真的 Chromium 裡開兩個頁面，
// 一對用 BroadcastChannel、一對用真的 relay WebSocket。沒有 Playwright 時後半 skip（和 show-browser.test.js 一樣）。
//   OAV_PLAYWRIGHT=/path/to/playwright-core/index.mjs   OAV_BROWSER_EXEC=/path/to/chrome (optional)
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { syncOptions, syncModules, SYNC_INPUT_MODULES } from '../packages/show/options.js';
import { attachRelay } from '../packages/relay/server.js';

// ───────────── 選項 ─────────────

test('createShow sync: absent (undefined, null, false) is no sync at all', () => {
  for (const v of [undefined, null, false]) assert.equal(syncOptions(v), null, String(v));
});

test('createShow sync: a leader and a follower need a role and a channel; the leader takes input, the follower does not unless told', () => {
  const l = syncOptions({ role: 'leader', channel: 'show-sync' });
  assert.deepEqual([l.role, l.channel, l.url, l.input], ['leader', 'show-sync', null, true]);
  const f = syncOptions({ role: 'follower', channel: 'show-sync' });
  assert.deepEqual([f.role, f.url, f.input], ['follower', null, false]);
  assert.equal(syncOptions({ role: 'follower', channel: 'x', input: true }).input, true);
  assert.equal(syncOptions({ role: 'leader', channel: 'x', input: false }).input, false);
});

test('createShow sync: url is a relay — true means this page\'s own /relay, a string is ws:// or wss://', () => {
  assert.equal(syncOptions({ role: 'leader', channel: 'x', url: true }).url, true);
  assert.equal(syncOptions({ role: 'leader', channel: 'x', url: 'wss://example.org/relay' }).url, 'wss://example.org/relay');
  assert.equal(syncOptions({ role: 'leader', channel: 'x', url: 'ws://192.168.1.5:8080/relay' }).url, 'ws://192.168.1.5:8080/relay');
  assert.equal(syncOptions({ role: 'leader', channel: 'x', url: null }).url, null);
  for (const bad of ['http://x/relay', '/relay', 5, '']) assert.throws(() => syncOptions({ role: 'leader', channel: 'x', url: bad }), /sync\.url/, String(bad));
});

test('createShow sync: the options that are wrong stop the show before it touches the page, and say what is allowed', () => {
  assert.throws(() => syncOptions('leader'), /sync must be/);
  assert.throws(() => syncOptions([]), /sync must be/);
  assert.throws(() => syncOptions({ channel: 'x' }), /sync\.role.*'leader'.*'follower'/s);
  assert.throws(() => syncOptions({ role: 'boss', channel: 'x' }), /sync\.role/);
  assert.throws(() => syncOptions({ role: 'leader' }), /sync\.channel/);
  for (const bad of ['', 'a b', 'x'.repeat(33), 'a/b', 5]) assert.throws(() => syncOptions({ role: 'leader', channel: bad }), /sync\.channel/, String(bad));
  assert.throws(() => syncOptions({ role: 'leader', channel: 'x', chanel: 'typo' }), /chanel.*allowed/s);
  assert.throws(() => syncOptions({ role: 'leader', channel: 'x', hz: -1 }), /sync\.hz/);
  assert.throws(() => syncOptions({ role: 'leader', channel: 'x', extra: 5 }), /sync\.extra/);
  assert.throws(() => syncOptions({ role: 'follower', channel: 'x', follow: 'fast' }), /sync\.follow/);
  assert.throws(() => syncOptions({ role: 'follower', channel: 'x', input: 'yes' }), /sync\.input/);
});

test('createShow sync: the options for the parts (extra, state, hooks, follow, now) pass through untouched', () => {
  const extra = () => 1, onState = () => {}, now = () => 0;
  const o = syncOptions({ role: 'follower', channel: 'x', extra, onState, now, hz: 30, follow: { jump: 1 }, info: { build: 1 }, helloEvery: 500 });
  assert.equal(o.extra, extra); assert.equal(o.onState, onState); assert.equal(o.now, now);
  assert.deepEqual([o.hz, o.follow, o.info, o.helloEvery], [30, { jump: 1 }, { build: 1 }, 500]);
});

test('createShow sync: a follower without input switches off what makes input — keyboard piano, MIDI, drums, microphone, camera, Leap, phones; everything else stays', () => {
  const modules = { keys: { base: 48 }, midi: { controllers: { profile: 'x' } }, drums: true, audio: 'mic', hands: true, pose: true, leap: true, remote: { room: 'main' }, sound: true, chord: true };
  const f = syncModules(modules, syncOptions({ role: 'follower', channel: 'x' }));
  for (const k of SYNC_INPUT_MODULES) assert.equal(f[k], false, k);
  assert.deepEqual(SYNC_INPUT_MODULES.slice().sort(), ['audio', 'drums', 'hands', 'keys', 'leap', 'midi', 'pose', 'remote']);
  assert.equal(f.sound, true); assert.equal(f.chord, true, 'the rest is the work\'s');
  assert.deepEqual(modules.keys, { base: 48 }, 'the caller\'s object is not written into');
  const nothing = syncModules({}, syncOptions({ role: 'follower', channel: 'x' }));
  assert.equal(nothing.keys, false); assert.equal(nothing.midi, false, 'keys and midi are on by default, so they are named off');
});

test('createShow sync: a leader, a follower with input: true, and no sync leave the modules exactly as given', () => {
  const modules = { keys: {}, midi: true };
  assert.equal(syncModules(modules, syncOptions({ role: 'leader', channel: 'x' })), modules);
  assert.equal(syncModules(modules, syncOptions({ role: 'follower', channel: 'x', input: true })), modules);
  assert.equal(syncModules(modules, null), modules);
});

// ───────────── 真的瀏覽器 ─────────────

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pw = null;
for (const p of [process.env.OAV_PLAYWRIGHT, '/opt/node-tools/node_modules/playwright-core/index.mjs'].filter(Boolean)) {
  try { pw = await import(p); break; } catch { /* try the next */ }
}
const SKIP = pw ? false : 'Playwright not available (set OAV_PLAYWRIGHT)';
const opts = { skip: SKIP, timeout: 90000 };

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
/** the repository as static files, plus the room relay at /relay (what `node serve.js` is) */
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
    const relay = attachRelay(srv);
    srv.listen(0, '127.0.0.1', () => resolve({ srv, relay, base: `http://127.0.0.1:${srv.address().port}` }));
  });
}

// one Chromium for the whole file (a launch is the expensive part, and a quiet machine matters to the timing tests next door)
let browserP = null;
const sharedBrowser = () => (browserP ||= pw.chromium.launch({ executablePath: process.env.OAV_BROWSER_EXEC || undefined }));
after(async () => { if (browserP) await (await browserP).close(); });

/** a context of its own (so BroadcastChannel reaches between its pages and nowhere else), n pages on the show fixture */
async function withPages(n, fn, { init } = {}) {
  const { srv, relay, base } = await serve();
  const browser = await sharedBrowser();
  let ctx = null;
  try {
    ctx = await browser.newContext();
    if (init) await ctx.addInitScript(init);
    const errors = [];
    const pages = [];
    for (let i = 0; i < n; i++) {
      const page = await ctx.newPage();
      page.on('pageerror', (e) => errors.push('pageerror ' + e.message));
      page.on('console', (m) => { if (m.type() === 'error') errors.push('console ' + m.text()); });
      await page.goto(base + '/tests/fixtures/show-page.html');
      await page.waitForFunction(() => typeof window.__start === 'function');
      pages.push(page);
    }
    await fn(pages, { base, relay });
    assert.deepEqual(errors, [], 'no console errors');
  } finally { await ctx?.close(); relay.close(); srv.close(); }
}
const poll = async (page, fn, arg, ms = 5000) => {
  const t0 = Date.now();
  for (;;) { if (await page.evaluate(fn, arg)) return; if (Date.now() - t0 > ms) assert.fail('timed out polling ' + fn); await page.waitForTimeout(15); }
};
/** start a manual-loop show with a fake sync clock (window.__clock, ms) so the frames are the same every time */
const startManual = (page, sync, extra = {}) => page.evaluate(async ({ sync, extra }) => {
  window.__clock = 0;
  const show = await window.__start({ loop: 'manual', monitor: false, ...extra, sync: { ...sync, now: () => window.__clock } });
  window.__step = (n) => { for (let i = 0; i < n; i++) { window.__clock += 1000 / 60; show.loop.step(1 / 60); } };
  return { role: show.sync?.role, keys: show.keys !== null, midi: show.midi !== null };
}, { sync, extra });

test('show: sync leader / follower over BroadcastChannel — the follower page lands on the leader\'s T, then walks and pauses with it; no keyboard piano or MIDI on the follower', opts, async () => {
  await withPages(2, async ([L, F]) => {
    const l = await startManual(L, { role: 'leader', channel: 'oav-b1' });
    const f = await startManual(F, { role: 'follower', channel: 'oav-b1' });
    assert.deepEqual(l, { role: 'leader', keys: true, midi: true });
    assert.deepEqual(f, { role: 'follower', keys: false, midi: false }, 'the follower has no input of its own');
    await L.evaluate(() => { window.openav.timeline.play(); window.__step(90); });
    await poll(F, () => window.openav.sync.status().seq >= 90);
    const lt = await L.evaluate(() => window.openav.timeline.t);
    await F.evaluate(() => window.__step(1));
    const first = await F.evaluate(() => ({ t: window.openav.timeline.t, playing: window.openav.timeline.playing, st: window.openav.timeline.followStatus() }));
    assert.ok(Math.abs(first.t - lt) <= 1 / 60 + 1e-6, `on the leader\'s T at its first frame (within the one frame that went by): ${first.t} vs ${lt}`);
    assert.equal(first.playing, true); assert.equal(first.st.jumps, 1);
    // 走：兩邊各 60 幀，每幀主控端先送、從屬端再走
    for (let i = 0; i < 60; i++) {
      await L.evaluate(() => window.__step(1));
      await poll(F, (n) => window.openav.sync.status().seq >= n, 91 + i);
      await F.evaluate(() => window.__step(1));
    }
    const [a, b] = [await L.evaluate(() => window.openav.timeline.t), await F.evaluate(() => window.openav.timeline.t)];
    assert.ok(Math.abs(a - b) <= 2 / 60, `leader ${a} follower ${b}`);
    await L.evaluate(() => { window.openav.timeline.pause(); window.__step(1); });
    await poll(F, () => window.openav.sync.status().seq >= 151);
    await F.evaluate(() => window.__step(1));
    assert.deepEqual(await F.evaluate(() => [window.openav.timeline.playing, window.openav.timeline.t]), [false, await L.evaluate(() => window.openav.timeline.t)]);
    assert.equal(await F.evaluate(() => window.openav.timeline.followStatus().lost), false);
  });
});

test('show: sync with a score — a follower on another cut of the show refuses the leader (its T would mean something else); on the same cut it follows', opts, async () => {
  await withPages(3, async ([L, S, F]) => {
    const cuts = [{ id: 'full', segments: [{ id: 'a', dur: 10 }, { id: 'b', dur: 10 }] }, { id: 'short', from: 'full', scale: 0.5 }];
    const start = (page, role, cut) => page.evaluate(async ({ role, cut, cuts }) => {
      window.__clock = 0;
      const show = await window.__start({ loop: 'manual', monitor: false, score: { cuts, cut }, sync: { role, channel: 'oav-cut', now: () => window.__clock } });
      window.__step = (n) => { for (let i = 0; i < n; i++) { window.__clock += 1000 / 60; show.loop.step(1 / 60); } };
      return show.score.cut;
    }, { role, cut, cuts });
    assert.equal(await start(L, 'leader', 'full'), 'full');
    assert.equal(await start(S, 'follower', 'short'), 'short');
    assert.equal(await start(F, 'follower', 'full'), 'full');
    await L.evaluate(() => { window.openav.timeline.seek(8); window.openav.timeline.play(); window.__step(20); });
    await poll(F, () => window.openav.sync.status().seq >= 20);
    await poll(S, () => window.openav.sync.status().rejected >= 1);
    await F.evaluate(() => window.__step(1)); await S.evaluate(() => window.__step(1));
    const lt = await L.evaluate(() => window.openav.timeline.t);
    assert.ok(Math.abs(await F.evaluate(() => window.openav.timeline.t) - lt) <= 1 / 60 + 1e-6, 'same cut: on the leader');
    const refused = await S.evaluate(() => ({ t: window.openav.timeline.t, state: window.openav.sync.monitor()['sync/state'], heard: window.openav.timeline.followStatus().heard }));
    assert.equal(refused.t, 0, 'other cut: nothing moved'); assert.match(refused.state, /^refused: cut full ≠ short/); assert.equal(refused.heard, false);
  });
});

test('show: sync follower with input: true keeps the keyboard piano and MIDI', opts, async () => {
  await withPages(1, async ([F]) => {
    const f = await startManual(F, { role: 'follower', channel: 'oav-b2', input: true });
    assert.deepEqual(f, { role: 'follower', keys: true, midi: true });
  });
});

test('show: sync over the relay — two pages, a leader and a follower, through the room relay\'s WebSocket (url: true = this page\'s own /relay)', opts, async () => {
  await withPages(2, async ([L, F]) => {
    await startManual(L, { role: 'leader', channel: 'oav-ws1', url: true });
    await poll(L, () => window.openav.sync.transport.open);                    // the leader is in the room before the follower says hello
    await startManual(F, { role: 'follower', channel: 'oav-ws1', url: true });
    await poll(F, () => window.openav.sync.transport.open);
    await poll(F, () => window.openav.sync.status().haveState);                // the hello was answered with a state
    await L.evaluate(() => { window.openav.timeline.seek(40); window.openav.timeline.play(); window.__step(30); });
    await poll(F, () => window.openav.sync.status().seq >= 30);
    const lt = await L.evaluate(() => window.openav.timeline.t);
    await F.evaluate(() => window.__step(1));
    const ft = await F.evaluate(() => window.openav.timeline.t);
    assert.ok(Math.abs(ft - lt) <= 1 / 60 + 1e-6, `${ft} vs ${lt}`);
    assert.ok(ft > 40);
    assert.equal(await L.evaluate(() => window.openav.sync.status().followers), 1);
  });
});

test('show: sync in real time — two auto-looped pages on a BroadcastChannel, the follower stays within a few frames of the leader', opts, async () => {
  await withPages(2, async ([L, F]) => {
    await F.evaluate(async () => { await window.__start({ monitor: false, sync: { role: 'follower', channel: 'oav-live' } }); });
    await L.evaluate(async () => { const s = await window.__start({ monitor: false, sync: { role: 'leader', channel: 'oav-live' } }); s.timeline.seek(10); s.timeline.play(); });
    await F.waitForTimeout(1800);
    const stamp = (p) => p.evaluate(() => ({ t: window.openav.timeline.t, at: performance.timeOrigin + performance.now(), st: window.openav.timeline.followStatus() }));
    const a = await stamp(L), b = await stamp(F);
    const truth = a.t + (b.at - a.at) / 1000;
    assert.ok(Math.abs(b.t - truth) < 0.1, `follower ${b.t} vs leader ${truth}`);
    assert.equal(b.st.lost, false); assert.ok(b.st.jumps <= 2, 'jumps ' + b.st.jumps);
    assert.ok(a.t > 11, 'the leader really ran: ' + a.t);
  });
});

test('show: without sync nothing changes — show.sync is null, no BroadcastChannel is opened, no WebSocket is made, keyboard and MIDI are there', opts, async () => {
  const spy = `window.__bc = 0; window.__ws = 0; const BC = window.BroadcastChannel; window.BroadcastChannel = class extends BC { constructor(n) { super(n); window.__bc++; } };
    const WS = window.WebSocket; window.WebSocket = class extends WS { constructor(...a) { super(...a); window.__ws++; } };`;
  await withPages(1, async ([P]) => {
    const r = await P.evaluate(async () => {
      const show = await window.__start({ loop: 'manual', monitor: false });
      show.timeline.play(); for (let i = 0; i < 30; i++) show.loop.step(1 / 60);
      return { sync: show.sync, bc: window.__bc, ws: window.__ws, keys: show.keys !== null, midi: show.midi !== null, t: show.timeline.t, following: show.timeline.following };
    });
    assert.ok(Math.abs(r.t - 0.5) < 1e-9, `thirty frames of 1/60: ${r.t}`);
    assert.deepEqual({ ...r, t: 0 }, { sync: null, bc: 0, ws: 0, keys: true, midi: true, t: 0, following: false });
  }, { init: spy });
});

test('show: a bad sync option throws before the page is touched', opts, async () => {
  await withPages(1, async ([P]) => {
    const errs = await P.evaluate(async () => {
      const out = [];
      for (const sync of [{ role: 'boss', channel: 'a' }, { role: 'leader' }, { role: 'leader', channel: 'a b' }, { role: 'leader', channel: 'a', url: 'http://x' }]) {
        const before = document.querySelectorAll('.oav-stage').length;
        try { await window.__start({ sync }); out.push('no error'); } catch (e) { out.push(e.message + ' | stages added: ' + (document.querySelectorAll('.oav-stage').length - before)); }
      }
      return out;
    });
    assert.match(errs[0], /sync\.role.*stages added: 0/s); assert.match(errs[1], /sync\.channel.*stages added: 0/s);
    assert.match(errs[2], /sync\.channel.*stages added: 0/s); assert.match(errs[3], /sync\.url.*stages added: 0/s);
  });
});

test('show: the sync status reaches the backstage monitor as extra numbers', opts, async () => {
  await withPages(1, async ([P]) => {
    const r = await P.evaluate(async () => {
      const show = await window.__start({ loop: 'manual', monitor: { url: null }, sync: { role: 'follower', channel: 'oav-mon' } });
      const parts = []; for (const fn of show.monitor._extras) parts.push(fn());
      return parts;
    });
    assert.equal(r.length, 1); assert.equal(r[0]['sync/role'], 'follower');
  });
});
