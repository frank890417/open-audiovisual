// keepAwake() — Screen Wake Lock for the phone/iPad pages (packages/surface/platform.js).
//
// The browsers disagree about WHEN a lock may be requested, and the surface runs on all of them:
//   chrome-like  Chrome, Firefox, Android: a visible document may ask any time, no gesture needed.
//   webkit-like  Safari (iPhone, iPad, Mac): request() rejects with NotAllowedError ("Permission was
//                denied") unless it runs inside a user gesture (transient activation). Once one request
//                has succeeded that way WebKit remembers it for the life of the document, so asking
//                again from visibilitychange works. (WebKit's Modules/screen-wake-lock/WakeLock.cpp,
//                WebKit bug 255363.) Touch is the subtle part: pointerdown (touch) is NOT an
//                activation-triggering event; pointerup, touchend and the click that follows are.
// Both browsers drop the lock when the page is hidden, and tell the page with a 'release' event.
//
// There is no real Safari here: these tests drive keepAwake() against a small model of each, with a
// fake document/navigator. What the model encodes was checked against real WebKit (Playwright's
// WebKit build) when this was written; whether a physical iPad agrees is a hands-on check.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { keepAwake } from '../packages/surface/platform.js';

const tick = () => new Promise((r) => setImmediate(r));
const notAllowed = () => Object.assign(new Error('Permission was denied'), { name: 'NotAllowedError' });

/** A document + navigator.wakeLock pair. gestureRequired: webkit-like. */
function world({ gestureRequired, latency = false } = {}) {
  const doc = {
    visibilityState: 'visible', listeners: [],
    addEventListener(type, fn, o) { this.listeners.push({ type, fn, capture: typeof o === 'boolean' ? o : !!o?.capture }); },
    // like the DOM: a listener added with capture:true is only removed by a call that says capture:true
    removeEventListener(type, fn, o) { const c = typeof o === 'boolean' ? o : !!o?.capture; this.listeners = this.listeners.filter((l) => !(l.type === type && l.fn === fn && l.capture === c)); },
    /** Fire `type` the way the browser would; inGesture = the event carries transient activation. */
    fire(type, { inGesture = false } = {}) { w.inGesture = inGesture; try { for (const l of [...this.listeners]) if (l.type === type) l.fn({ type }); } finally { w.inGesture = false; } },
    setVisibility(v) { this.visibilityState = v; if (v === 'hidden') w.dropAll(); this.fire('visibilitychange'); },
  };
  const w = {
    inGesture: false, sticky: false, calls: [], sentinels: [], held() { return this.sentinels.filter((s) => !s.released); },
    resolveLate: null,
    dropAll() { for (const s of this.sentinels) if (!s.released) s.drop(); },
    async request(type) {
      const gesture = w.inGesture;                      // transient activation is read synchronously, at call time
      w.calls.push({ type, gesture, visibility: doc.visibilityState });
      if (latency) await new Promise((r) => { w.resolveLate = r; });
      if (doc.visibilityState !== 'visible') throw notAllowed();
      if (gestureRequired && !gesture && !w.sticky) throw notAllowed();
      if (gestureRequired) w.sticky = true;
      const ls = [];
      const s = {
        released: false,
        addEventListener(t, fn) { if (t === 'release') ls.push(fn); },
        drop() { if (s.released) return; s.released = true; for (const f of ls) f({ type: 'release' }); },
        async release() { s.drop(); },
      };
      w.sentinels.push(s);
      return s;
    },
  };
  return { doc, w, nav: { wakeLock: { request: (t) => w.request(t) } } };
}

async function inWorld(opts, fn) {
  const { doc, w, nav } = world(opts);
  const had = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  globalThis.document = doc;
  Object.defineProperty(globalThis, 'navigator', { value: nav, configurable: true, writable: true });
  try { await fn({ doc, w }); }
  finally {
    delete globalThis.document;
    if (had) Object.defineProperty(globalThis, 'navigator', had); else delete globalThis.navigator;
  }
}

test('chrome-like: the lock is taken at load, no gesture needed, and a tap does not stack a second one', async () => {
  await inWorld({ gestureRequired: false }, async ({ doc, w }) => {
    keepAwake(); await tick();
    assert.equal(w.held().length, 1, 'taken at load');
    doc.fire('click', { inGesture: true }); doc.fire('pointerup', { inGesture: true }); await tick();
    assert.equal(w.calls.length, 1, 'already held: taps ask for nothing more');
    assert.equal(w.held().length, 1);
  });
});

test('webkit-like: refused at load (no gesture), taken by the first tap', async () => {
  await inWorld({ gestureRequired: true }, async ({ doc, w }) => {
    keepAwake(); await tick();
    assert.equal(w.held().length, 0, 'load-time request is refused: no gesture yet');
    assert.equal(w.calls.length, 1);
    doc.fire('click', { inGesture: true }); await tick();
    assert.equal(w.held().length, 1, 'the first tap takes the lock');
    assert.ok(w.calls.at(-1).gesture, 'the request ran inside the gesture, not after an await');
  });
});

test('webkit-like touch: pointerdown (no activation) does not take it, pointerup does; touchend and keydown do too', async () => {
  for (const [name, ev] of [['pointerup', 'pointerup'], ['touchend', 'touchend'], ['keydown', 'keydown']]) {
    await inWorld({ gestureRequired: true }, async ({ doc, w }) => {
      keepAwake(); await tick();
      doc.fire('pointerdown', { inGesture: false }); doc.fire('touchstart', { inGesture: false }); await tick();
      assert.equal(w.held().length, 0, `${name}: finger down is not a gesture`);
      doc.fire(ev, { inGesture: true }); await tick();
      assert.equal(w.held().length, 1, `${name}: lifting the finger / pressing a key takes it`);
    });
  }
});

test('webkit-like: after the screen sleeps and wakes, visibilitychange alone takes the lock back (no gesture)', async () => {
  await inWorld({ gestureRequired: true }, async ({ doc, w }) => {
    keepAwake(); await tick();
    doc.fire('click', { inGesture: true }); await tick();
    assert.equal(w.held().length, 1);
    doc.setVisibility('hidden'); await tick();
    assert.equal(w.held().length, 0, 'the browser dropped it while hidden');
    doc.setVisibility('visible'); await tick();
    assert.equal(w.held().length, 1, 'taken back on return');
    assert.equal(w.calls.at(-1).gesture, false, 'WebKit remembers the first tap, so no gesture is needed now');
  });
});

test('webkit-like: if the user never tapped before the screen slept, the return does not take it, the next tap does', async () => {
  await inWorld({ gestureRequired: true }, async ({ doc, w }) => {
    keepAwake(); await tick();
    doc.setVisibility('hidden'); doc.setVisibility('visible'); await tick();
    assert.equal(w.held().length, 0, 'still refused: nobody tapped yet');
    doc.fire('click', { inGesture: true }); await tick();
    assert.equal(w.held().length, 1);
  });
});

test('a lock the system released while the page stayed visible (power saver) is asked for again on the next tap', async () => {
  await inWorld({ gestureRequired: true }, async ({ doc, w }) => {
    keepAwake(); await tick();
    doc.fire('click', { inGesture: true }); await tick();
    w.sentinels[0].drop();                              // released, document still visible
    doc.fire('click', { inGesture: true }); await tick();
    assert.equal(w.held().length, 1);
    assert.equal(w.sentinels.length, 2);
  });
});

test('taps during a pending request do not pile up requests', async () => {
  await inWorld({ gestureRequired: false, latency: true }, async ({ doc, w }) => {
    keepAwake();
    doc.fire('click', { inGesture: true }); doc.fire('pointerup', { inGesture: true });
    assert.equal(w.calls.length, 1, 'one request in flight, not three');
    w.resolveLate(); await tick();
    assert.equal(w.held().length, 1);
  });
});

test('release(): lets go of the lock and every listener, and nothing re-takes it afterwards', async () => {
  await inWorld({ gestureRequired: true }, async ({ doc, w }) => {
    const k = keepAwake(); await tick();
    doc.fire('click', { inGesture: true }); await tick();
    assert.equal(w.held().length, 1);
    k.release(); await tick();
    assert.equal(w.held().length, 0, 'lock released');
    assert.equal(doc.listeners.length, 0, 'no listener left (capture flag matched on removal)');
    doc.fire('click', { inGesture: true }); doc.setVisibility('hidden'); doc.setVisibility('visible'); await tick();
    assert.equal(w.held().length, 0, 'stays released');
  });
});

test('release() while a request is still in flight: the lock that arrives late is let go at once', async () => {
  await inWorld({ gestureRequired: false, latency: true }, async ({ w }) => {
    const k = keepAwake();
    k.release();
    w.resolveLate(); await tick();
    assert.equal(w.held().length, 0, 'a late lock must not outlive release()');
  });
});

test('no navigator.wakeLock (older browsers): silent, and release() is still safe', async () => {
  const had = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const { doc } = world({});
  globalThis.document = doc;
  Object.defineProperty(globalThis, 'navigator', { value: {}, configurable: true, writable: true });
  try {
    const k = keepAwake(); doc.fire('click', { inGesture: true }); await tick();
    assert.doesNotThrow(() => k.release());
  } finally {
    delete globalThis.document;
    if (had) Object.defineProperty(globalThis, 'navigator', had); else delete globalThis.navigator;
  }
});
