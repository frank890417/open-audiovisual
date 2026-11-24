// Seven small bugs found on 2026-10-19 while the API reference was being written: each entry had to say what the code
// does, and these seven did something nobody would write down. One test per bug, each red before its fix.
//
//   1  Stage.activate('typo')            killed the running world before noticing the name was unknown
//   2  run_checks (packages/mcp)         no maxBuffer: a long test log overflowed and every run came back ok:false
//   3  scaffold_world without a slug     made examples/NN-undefined
//   4  autoArrange with a size-less item never returned
//   5  RelayClient.connect()             returned undefined when new WebSocket threw
//   6  lockViewport()                    its undo left the viewport meta locked
//   7  createShow({ profile: false })    still wrote the routes to localStorage every 3 s
//
// No browser: where the code wants a page it gets the smallest fake that answers (as tests/keepawake.test.js does).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Put fakes on globalThis for the length of fn (sync or async), then put back exactly what was there. */
async function withGlobals(fakes, fn) {
  const before = {};
  for (const k of Object.keys(fakes)) { before[k] = Object.getOwnPropertyDescriptor(globalThis, k); Object.defineProperty(globalThis, k, { value: fakes[k], configurable: true, writable: true }); }
  try { return await fn(); } finally {
    for (const k of Object.keys(fakes)) { if (before[k]) Object.defineProperty(globalThis, k, before[k]); else delete globalThis[k]; }
  }
}

// ------------------------------------------------------------------------------------------------ 1 · Stage.activate
test('1 · Stage.activate(unknown name) throws and leaves the running world alone: not disposed, layer not cleared, frame() still drives it', async () => {
  const layer = { style: {}, cleared: 0, _html: '<canvas>', get innerHTML() { return this._html; }, set innerHTML(v) { this._html = v; this.cleared++; } };
  const fakes = {
    document: { createElement: () => layer },
    getComputedStyle: () => ({ position: 'relative' }),
  };
  await withGlobals(fakes, async () => {
    const { Stage } = await import('../packages/stage/index.js');
    const calls = { init: 0, dispose: 0, update: 0, render: 0 };
    const world = { name: 'sea', init() { calls.init++; }, dispose() { calls.dispose++; }, update() { calls.update++; }, render() { calls.render++; } };
    const params = { add() {}, resolve: (base) => ({ ...base }) };
    const stage = new Stage({ container: { style: {}, prepend() {} }, params, signals: {} });
    stage.register(world);
    await stage.activate('sea');
    const clearedByFirst = layer.cleared;
    layer._html = '<canvas>';                       // what the world drew into

    await assert.rejects(() => stage.activate('see'), /unknown world: see/);
    assert.equal(calls.dispose, 0, 'a typo on stage must not kill the world that is playing');
    assert.equal(layer.cleared, clearedByFirst, 'its layer is not emptied');
    assert.equal(layer.innerHTML, '<canvas>');
    assert.equal(stage.active, world); assert.equal(stage.activeName, 'sea');
    stage.frame(1 / 60, {});
    assert.deepEqual([calls.update, calls.render], [1, 1], 'the world keeps running');

    // a real switch still disposes the old world, and only once
    stage.register({ name: 'sky' });
    await stage.activate('sky');
    assert.equal(calls.dispose, 1); assert.equal(stage.activeName, 'sky');
  });
});

// ------------------------------------------------------------------------------------------------ 2 · run_checks
test('2 · run_checks: asks for a buffer that holds a whole test log (≥ 64 MB), and tells a failing test from a run that broke', async () => {
  const { runChecks } = await import('../packages/mcp/server.js');
  // the runner is injected: nothing here starts the real suite (it would start this file again)
  let seen = null;
  const big = 'ok 1 - x\n'.repeat(200000) + '# pass 200000\n# fail 0\n';        // 1.8 MB: over Node's 1 MB default
  const ok = runChecks((cmd, args, opts) => { seen = { cmd, args, opts }; return big; });
  assert.equal(seen.cmd, 'node'); assert.equal(seen.args[0], '--test');
  assert.ok(seen.args.includes('tests/known-bugs-1115.test.js'), 'every tests/*.test.js is handed to the runner');
  assert.ok(seen.opts.maxBuffer >= 64 * 1024 * 1024, `maxBuffer is ${seen.opts.maxBuffer}`);
  assert.deepEqual(ok, { pass: 200000, fail: 0, ok: true });

  // a test really failed: node --test exits 1 and the log says which
  const failed = runChecks(() => { throw Object.assign(new Error('Command failed'), { status: 1, stdout: 'ok 1 - a\nnot ok 2 - the chord test\n# pass 1\n# fail 1\n', stderr: '' }); });
  assert.equal(failed.ok, false); assert.equal(failed.pass, 1); assert.equal(failed.fail, 1);
  assert.match(failed.output, /not ok 2 - the chord test/);
  assert.equal(failed.error, undefined, 'a failing test is not a broken run');

  // the run itself broke (buffer, timeout, node missing): say so, do not dress it up as failing tests
  for (const code of ['ENOBUFS', 'ETIMEDOUT', 'ENOENT']) {
    const broke = runChecks(() => { throw Object.assign(new Error(`spawnSync node ${code}`), { code, status: null, stdout: 'ok 1 - a\n', stderr: '' }); });
    assert.equal(broke.ok, false, code);
    assert.match(broke.error, new RegExp(code), 'the reason is in the answer');
    assert.equal(broke.fail, undefined, 'no invented fail count');
  }

  // exit 0 but no summary line (a reporter changed): not ok, and it says why — NaN counts would read as "ok: false, no reason"
  const odd = runChecks(() => 'something else entirely\n');
  assert.equal(odd.ok, false); assert.match(odd.error, /summary/);
});

// ------------------------------------------------------------------------------------------------ 3 · scaffold_world
test('3 · scaffold_world: a missing, empty or non-string slug is refused before anything is written', async () => {
  const { scaffoldWorld } = await import('../packages/mcp/server.js');
  // the server uses node:fs through its default export, the same object as here: stop it from writing, whatever happens
  const real = { mkdirSync: fs.mkdirSync, copyFileSync: fs.copyFileSync };
  const wrote = [];
  fs.mkdirSync = (p) => { wrote.push(String(p)); };
  fs.copyFileSync = (a, b) => { wrote.push(String(b)); };
  try {
    for (const bad of [{}, { slug: undefined }, { slug: null }, { slug: '' }, { slug: 42 }, { slug: ['a'] }, { slug: true }, { slug: 'Has Spaces' }, { slug: '-' }, { slug: '---' }]) {
      assert.throws(() => scaffoldWorld(bad), /slug/, JSON.stringify(bad));
    }
    assert.deepEqual(wrote, [], 'nothing was created under examples/');
    // a good slug still gets through to the copy (caught by the stub above)
    const out = scaffoldWorld({ slug: 'jellyfish-bloom' });
    assert.match(out.created, /^examples\/\d+-jellyfish-bloom$/);
    assert.ok(wrote.length > 0 && wrote.every((p) => p.includes('-jellyfish-bloom')));
  } finally { Object.assign(fs, real); }
  assert.ok(!fs.readdirSync(path.join(ROOT, 'examples')).some((d) => /-(undefined|null|jellyfish-bloom)$/.test(d)), 'examples/ is as it was');
});

// ------------------------------------------------------------------------------------------------ 4 · autoArrange
test('4 · autoArrange: an item without a usable size (no w, w ≤ 0, NaN, wider than the grid) is given one and the packing ends', () => {
  // in a child with a deadline: before the fix this loop never ended, and a hung test tells nobody anything
  const code = `
    import { autoArrange, DEFAULT_SIZE } from ${JSON.stringify(pathToFileURL(path.join(ROOT, 'packages/surface/layout.js')).href)};   // a file URL: on Windows import() refuses a C: path (#8)
    const out = {
      bare: autoArrange([{ id: 'a' }, { id: 'b' }], 4),
      typed: autoArrange([{ id: 'f', type: 'fader' }, { id: 'k', type: 'keyboard' }], 4),
      bad: autoArrange([{ id: 'z', w: 0, h: -2 }, { id: 'n', w: NaN, h: 'tall' }, { id: 'wide', w: 99, h: 1 }, { id: 'half', w: 0.2, h: 0.2 }], 4),
      mixed: autoArrange([{ id: 'x' }], 4, [{ id: 'fix', x: 0, y: 0, w: 4, h: 2 }]),
      noCols: [autoArrange([{ id: 'a', w: 2, h: 1 }], 0), autoArrange([{ id: 'a', w: 2, h: 1 }], NaN), autoArrange([{ id: 'a' }], undefined)],
      asBefore: autoArrange([{ id: 'a', w: 2, h: 2 }, { id: 'b', w: 2, h: 1 }, { id: 'c', w: 4, h: 1 }], 4),
    };
    console.log(JSON.stringify(out));`;
  let raw;
  try { raw = execFileSync(process.execPath, ['--input-type=module', '-e', code], { encoding: 'utf8', timeout: 8000 }); }
  catch (e) { assert.fail(e.code === 'ETIMEDOUT' || e.signal ? 'autoArrange did not return within 8 s (endless loop)' : String(e.stderr || e)); }
  const r = JSON.parse(raw);
  const whole = (list, cols) => { for (const p of list) for (const k of ['x', 'y', 'w', 'h']) assert.ok(Number.isInteger(p[k]) && p[k] >= (k === 'w' || k === 'h' ? 1 : 0), `${p.id}.${k} = ${p[k]}`); for (const p of list) assert.ok(p.x + p.w <= cols, `${p.id} fits in ${cols} columns`); };

  assert.deepEqual(r.bare, { placements: [{ id: 'a', x: 0, y: 0, w: 1, h: 1 }, { id: 'b', x: 1, y: 0, w: 1, h: 1 }], rows: 1 }, 'no size, no type: one cell');
  assert.deepEqual(r.typed.placements, [{ id: 'f', x: 0, y: 0, w: 1, h: 4 }, { id: 'k', x: 0, y: 4, w: 4, h: 4 }], 'the size of its type, held to the grid width');
  assert.equal(r.typed.rows, 8);
  whole(r.bad.placements, 4);
  assert.equal(r.bad.placements.find((p) => p.id === 'wide').w, 4);
  assert.equal(r.bad.rows, Math.max(...r.bad.placements.map((p) => p.y + p.h)));
  assert.deepEqual(r.mixed.placements[1], { id: 'x', x: 0, y: 2, w: 1, h: 1 }, 'fixed cells are still respected');
  for (const one of r.noCols) { assert.equal(one.placements.length, 1); whole(one.placements, 1); }
  assert.deepEqual(r.asBefore, { placements: [{ id: 'a', x: 0, y: 0, w: 2, h: 2 }, { id: 'b', x: 2, y: 0, w: 2, h: 1 }, { id: 'c', x: 0, y: 2, w: 4, h: 1 }], rows: 3 }, 'items that had a size land where they always did');
});

// ------------------------------------------------------------------------------------------------ 5 · RelayClient.connect
test('5 · RelayClient.connect(): when new WebSocket throws it still returns the client, marks it closed and queues a retry; close() cancels it', async () => {
  const { RelayClient } = await import('../packages/relay/index.js');
  const timeouts = [], cleared = [], intervals = [], sockets = [];
  let refuse = true;
  class FakeWS { constructor(url) { if (refuse) throw new DOMException('insecure', 'SecurityError'); this.url = url; this.readyState = 0; sockets.push(this); } send() {} close() {} }
  const fakes = {
    WebSocket: FakeWS,
    setTimeout: (fn, ms) => { timeouts.push({ fn, ms }); return timeouts.length; },
    clearTimeout: (id) => { cleared.push(id); },
    setInterval: (fn) => { intervals.push(fn); return 100 + intervals.length; },
    clearInterval: () => {},
  };
  await withGlobals(fakes, () => {
    const statuses = [];
    const c = new RelayClient({ role: 'runner', room: 'main', id: 'test1', url: 'ws://relay.test/relay', onStatus: (x) => statuses.push(x.status) });
    let got;
    assert.doesNotThrow(() => { got = c.connect(); });
    assert.equal(got, c, 'new RelayClient(…).connect() is how the docs start it: the next line calls a method on what comes back');
    assert.equal(c.status, 'closed'); assert.deepEqual(statuses, ['closed'], 'the page is told, like any other lost connection');
    assert.equal(c.open, false);
    assert.doesNotThrow(() => { c.set('phone/me/tilt/x', 0.3); c.send('midi/note/on', { note: 60 }, true); }, 'sending while down is silent');
    assert.equal(timeouts.length, 1, 'one retry queued'); assert.equal(timeouts[0].ms, 500);

    // the retry connects once the socket can be made
    refuse = false;
    timeouts[0].fn();
    assert.equal(sockets.length, 1); assert.equal(sockets[0].url.split('?')[0], 'ws://relay.test/relay');

    // refused again, then closed by the page: the queued retry is cancelled, so a closed client stays closed
    refuse = true;
    assert.equal(c.connect(), c);
    assert.equal(timeouts.length, 2);
    c.close();
    assert.ok(cleared.includes(2), 'close() clears the pending retry');
  });
});

// ------------------------------------------------------------------------------------------------ 6 · lockViewport
function fakePage(existingViewport) {
  const listeners = [];
  const head = { children: [], appendChild(n) { this.children.push(n); n.parent = this; return n; } };
  const node = (tag) => ({ tag, name: '', content: '', textContent: '', parent: null, remove() { if (this.parent) { this.parent.children = this.parent.children.filter((c) => c !== this); this.parent = null; } } });
  if (existingViewport !== undefined) { const m = node('meta'); m.name = 'viewport'; m.content = existingViewport; head.appendChild(m); }
  const document = {
    head, listeners,
    createElement: node,
    querySelector: (sel) => (sel === 'meta[name=viewport]' ? head.children.find((c) => c.tag === 'meta' && c.name === 'viewport') ?? null : null),
    addEventListener(type, fn) { listeners.push({ type, fn }); },
    removeEventListener(type, fn) { const i = listeners.findIndex((l) => l.type === type && l.fn === fn); if (i >= 0) listeners.splice(i, 1); },
  };
  return document;
}

test('6 · lockViewport(): the function it returns puts the viewport meta back as it was — the old content, or no tag if there was none', async () => {
  const { lockViewport } = await import('../packages/surface/platform.js');
  const LOCKED = /user-scalable=no/;

  // a page that had its own viewport
  const had = fakePage('width=device-width, initial-scale=1');
  await withGlobals({ document: had }, () => {
    const meta = had.querySelector('meta[name=viewport]');
    const undo = lockViewport();
    assert.match(meta.content, LOCKED);
    assert.equal(had.listeners.length, 3); assert.equal(had.head.children.length, 2, 'the meta and the style');
    undo();
    assert.equal(meta.content, 'width=device-width, initial-scale=1', 'pinch-zoom comes back when the panel leaves the page');
    assert.deepEqual(had.head.children, [meta], 'same tag, the style is gone');
    assert.equal(had.listeners.length, 0);
    assert.doesNotThrow(undo, 'twice is harmless');
    assert.equal(meta.content, 'width=device-width, initial-scale=1');
  });

  // a page without one: the tag lockViewport made leaves with it
  const none = fakePage();
  await withGlobals({ document: none }, () => {
    const undo = lockViewport();
    assert.match(none.querySelector('meta[name=viewport]').content, LOCKED);
    undo();
    assert.equal(none.querySelector('meta[name=viewport]'), null);
    assert.deepEqual(none.head.children, []);
  });

  // an empty content="" is a value too, not "there was none"
  const empty = fakePage('');
  await withGlobals({ document: empty }, () => {
    lockViewport()();
    assert.equal(empty.querySelector('meta[name=viewport]')?.content, '');
  });

  // two locks, undone in either order: the page ends where it began (the second lock must not "restore" the first one's lock)
  for (const order of [[0, 1], [1, 0]]) {
    const page = fakePage('width=640');
    await withGlobals({ document: page }, () => {
      const undos = [lockViewport(), lockViewport()];
      undos[order[0]]();
      assert.match(page.querySelector('meta[name=viewport]').content, LOCKED, 'still locked while one lock is held');
      undos[order[1]]();
      assert.equal(page.querySelector('meta[name=viewport]').content, 'width=640', `order ${order}`);
      assert.equal(page.head.children.length, 1); assert.equal(page.listeners.length, 0);
    });
    const bare = fakePage();
    await withGlobals({ document: bare }, () => {
      const undos = [lockViewport(), lockViewport()];
      undos[order[0]](); undos[order[1]]();
      assert.deepEqual(bare.head.children, [], `order ${order}`);
    });
  }
});

// ------------------------------------------------------------------------------------------------ 7 · createShow profile: false
/** A page that says yes to everything: every property is another one of these, every call returns one, it counts as 0
 *  and iterates as empty. Enough for createShow to build its desk; what the test looks at is localStorage and timers. */
function anything() {
  const own = Object.create(null);
  const p = new Proxy(function () {}, {
    get(t, k) {
      if (k === Symbol.toPrimitive) return (hint) => (hint === 'number' ? 0 : '');
      if (k === Symbol.iterator) return function* () {};
      if (k === 'then') return undefined;                      // not a promise
      if (k === 'length' || k === 'size') return 0;
      if (k === 'firstChild' || k === 'lastChild' || k === 'nextSibling' || k === 'parentNode' || k === 'firstElementChild') return null;   // `while (el.firstChild)` must end
      if (k in own) return own[k];
      return (own[k] = anything());
    },
    set(t, k, v) { own[k] = v; return true; },
    has() { return true; },
    apply() { return anything(); },
    construct() { return anything(); },
  });
  return p;
}

async function showWith(options, stored = {}) {
  const store = { ...stored }, storage = { get: [], set: [] }, intervals = [];
  const localStorage = {
    getItem(k) { storage.get.push(k); return k in store ? store[k] : null; },
    setItem(k, v) { storage.set.push(k); store[k] = String(v); },
    removeItem(k) { delete store[k]; },
  };
  const doc = anything();
  const fakes = {
    document: doc, window: anything(), localStorage,
    location: { search: '', href: 'http://localhost:8080/examples/x/', hostname: 'localhost', host: 'localhost:8080', protocol: 'http:', origin: 'http://localhost:8080' },
    getComputedStyle: () => ({ position: 'relative' }),
    requestAnimationFrame: () => 1, cancelAnimationFrame: () => {},
    setInterval: (fn, ms) => { intervals.push({ fn, ms }); return intervals.length; }, clearInterval: () => {},
    addEventListener: () => {}, removeEventListener: () => {},
    ResizeObserver: class { observe() {} disconnect() {} },
  };
  if (!('navigator' in globalThis) || !globalThis.navigator) fakes.navigator = {};
  let show;
  await withGlobals(fakes, async () => {
    const { createShow } = await import('../packages/show/index.js');
    show = await createShow({
      world: { name: 'tide', params: [{ key: 'hue', min: 0, max: 1, def: 0.5 }] },
      routes: [{ source: 'midi/cc/74', target: 'hue' }],
      timeline: { total: 10 }, modules: {}, telemetry: false, signature: false, monitor: false, loop: 'manual', map: false,
      mount: { stage: anything(), side: anything() },
      ...options,
    });
    // let the show live a while: every timer it set fires a few times, and the mapper is edited the way the console does
    for (let i = 0; i < 3; i++) for (const t of intervals) t.fn();
    show.mapper.addRoute({ source: 'midi/cc/75', target: 'hue' });
    show.mapper.clear();
    for (const t of intervals) t.fn();
  });
  const mapKeys = (list) => list.filter((k) => k.startsWith('openav.map.'));
  return { show, store, read: mapKeys(storage.get), written: mapKeys(storage.set) };
}

test('7 · createShow({ profile: false }): the mapping is neither read from nor written to localStorage — not at start, not every 3 s, not on an edit', async () => {
  const yesterday = { 'openav.map.tide': JSON.stringify([{ source: 'midi/cc/1', target: 'hue' }]), 'openav.map.false': '[]', 'openav.map.show': '[]' };
  const off = await showWith({ profile: false }, yesterday);
  assert.deepEqual(off.written, [], 'nothing saved');
  assert.deepEqual(off.read, [], 'nothing loaded');
  assert.deepEqual(off.store, yesterday, 'what another show saved under the same name is untouched');

  // and the declared routes are what it started with (yesterday's cc/1 did not come back)
  const fresh = await showWith({ profile: false, loop: 'manual' }, yesterday);
  assert.equal(fresh.show.mapper.routes.length, 0, 'clear() emptied it in memory');

  // the default still remembers: read at start, written by the timer, under the world's name
  const on = await showWith({}, {});
  assert.ok(on.read.includes('openav.map.tide'), 'default: loads the saved mapping');
  assert.ok(on.written.includes('openav.map.tide'), 'default: saves it');
  const named = await showWith({ profile: 'tour-2026' }, {});
  assert.ok(named.written.every((k) => k === 'openav.map.tide' ? false : true) && named.written.includes('openav.map.tour-2026'), 'a named profile saves under its name');
});
