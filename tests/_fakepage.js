// A page in Node, just enough for createShow() to build a whole show: every DOM call answers, nothing is drawn, no timer
// runs by itself, nothing reaches a device. tests/known-bugs-1115.test.js grew the first copy of these two helpers.
//
//   await onFakeShow({ world, routes, modules, … }, async (show, step) => { step(180); … })
//
// The show runs with loop: 'manual', so step(n) is n frames of 1/60 s, and nothing happens between two calls.

/** Put fakes on globalThis for the length of fn (sync or async), then put back exactly what was there. */
export async function withGlobals(fakes, fn) {
  const before = {};
  for (const k of Object.keys(fakes)) { before[k] = Object.getOwnPropertyDescriptor(globalThis, k); Object.defineProperty(globalThis, k, { value: fakes[k], configurable: true, writable: true }); }
  try { return await fn(); } finally {
    for (const k of Object.keys(fakes)) { if (before[k]) Object.defineProperty(globalThis, k, before[k]); else delete globalThis[k]; }
  }
}

/** A value that says yes to everything: every property is another one of these, every call returns one, it counts as 0
 *  and iterates as empty. Enough for createShow to build its desk. */
export function anything() {
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

/** Build a show on a fake page and hand it to fn with step(n) (n frames of 1/60 s). The globals stay faked until fn ends. */
export async function onFakeShow(options, fn) {
  const store = {};
  const fakes = {
    document: anything(), window: anything(),
    localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } },
    location: { search: '', href: 'http://localhost:8080/examples/x/', pathname: '/examples/x/', hostname: 'localhost', host: 'localhost:8080', protocol: 'http:', origin: 'http://localhost:8080' },
    getComputedStyle: () => ({ position: 'relative' }),
    requestAnimationFrame: () => 1, cancelAnimationFrame: () => {},
    setInterval: () => 0, clearInterval: () => {},
    addEventListener: () => {}, removeEventListener: () => {},
    ResizeObserver: class { observe() {} disconnect() {} },
  };
  if (!('navigator' in globalThis) || !globalThis.navigator) fakes.navigator = {};
  return withGlobals(fakes, async () => {
    const { createShow } = await import('../packages/show/index.js');
    const show = await createShow({
      telemetry: false, signature: false, monitor: false, loop: 'manual', map: false, profile: false,
      mount: { stage: anything(), side: anything() },
      ...options,
      modules: { midi: false, keys: false, ...options.modules },
    });
    const step = (n = 1) => { for (let i = 0; i < n; i++) show.loop.step(1 / 60); };
    return fn(show, step);
  });
}
