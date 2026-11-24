// Shared by the DMX flash tests: how many times a light flashes, counted from a brightness series by the WCAG 2.3.1 notion
// of a general flash (a pair of opposing changes of 10% of full scale or more), written apart from packages/dmx/flash-guard.js
// on purpose: a test that counted with the guard's own counter would agree with it whatever it did.
//
//   const s = [];  for (let f = 0; f < 400; f++) s.push([f / 40, level]);   // [seconds, 0..1], in time order
//   maxFlashes(s)  → { flashes, transitions, rises }   flashes: the most in any second
//
// A change is measured from the last turning point (a slow sine that moves 3% a frame still turns once it has moved 10%),
// the light is dark before the first sample (a light that is on from the start has risen once), and a second is half open,
// [s, s + 1): a regular 3 Hz has its seventh edge on the next second's first instant, not on this one's last.

/** The times the series turned: [{ t, up }], each one the opposite of the one before. */
export function turns(series, { step = 0.1 } = {}) {
  const out = [];
  let rising = false, lowest = 0, highest = 0;      // dark before: waiting for the first rise, from 0
  for (const [t, v] of series) {
    if (!rising) {
      lowest = Math.min(lowest, v);
      // a hair under the step counts too: this counter errs toward more flashes, never fewer
      if (v - lowest >= step - 1e-9) { out.push({ t, up: true }); rising = true; highest = v; }
    } else {
      highest = Math.max(highest, v);
      if (highest - v >= step - 1e-9) { out.push({ t, up: false }); rising = false; lowest = v; }
    }
  }
  return out;
}

/**
 * The most flashes in any window of `window` seconds: for each window that starts at a turn, the turns inside it, halved
 * (a flash is two of them) and rounded down. `rises` is the most rises in any window, `transitions` all turns.
 */
export function maxFlashes(series, { step = 0.1, window = 1 } = {}) {
  const T = turns(series, { step });
  let most = 0, mostRises = 0;
  for (let i = 0; i < T.length; i++) {
    let n = 0, up = 0;
    for (let j = i; j < T.length && T[j].t < T[i].t + window; j++) { n++; if (T[j].up) up++; }
    most = Math.max(most, Math.floor(n / 2));
    mostRises = Math.max(mostRises, up);
  }
  return { flashes: most, transitions: T.length, rises: mostRises };
}

/** One fixture's brightness from a universe's bytes, the plain way: intensity byte × the brightest colour byte, both / 255. */
export function plainLevel(bytes, { intensity, colors = [] }) {
  const i = intensity === undefined ? 1 : bytes[intensity - 1] / 255;
  const c = colors.length ? Math.max(...colors.map((a) => bytes[a - 1] / 255)) : 1;
  return i * c;
}
