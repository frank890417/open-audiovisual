// @openav/tile · clock — one time for every screen, from a few pings to the relay. Pure (the clock is injectable).
//
//   const clock = new ClockSync();
//   clock.add(t0, server, t1);     // a ping left at t0 (my clock), the relay stamped `server`, the pong came back at t1
//   clock.now()                    // the relay's clock, read here (ms since 1970)
//
// NTP, simplified. If the trip out and the trip back took as long as each other, the relay read its clock at the
// midpoint of my t0…t1, so offset = server − (t0 + t1) / 2. They rarely do, and the error is at most half the round
// trip; so of the recent samples, the one with the SHORTEST round trip is trusted (a phone busy drawing answers late,
// a crowded wifi queues; neither ever makes a trip shorter than it was). Every screen then computes its own frame
// from the same time and the same seed: nothing but a few numbers travels, never a picture.

const epochNow = () => (typeof performance !== 'undefined' && performance.timeOrigin ? performance.timeOrigin + performance.now() : Date.now());

/** One ping: { rtt, offset, at } — or null when the numbers cannot be a ping (a pong from before it was sent). */
export function clockSample(t0, server, t1) {
  if (![t0, server, t1].every((v) => typeof v === 'number' && Number.isFinite(v)) || t1 < t0) return null;
  return { rtt: t1 - t0, offset: server - (t0 + t1) / 2, at: t1 };
}

/** The offset from the sample with the shortest round trip: { offset, rtt, n } or null with no sample. */
export function estimateOffset(samples) {
  let best = null, n = 0;
  for (const s of samples || []) {
    if (!s || !Number.isFinite(s.rtt) || !Number.isFinite(s.offset) || s.rtt < 0) continue;
    n++;
    if (!best || s.rtt < best.rtt) best = s;
  }
  return best ? { offset: best.offset, rtt: best.rtt, n } : null;
}

export class ClockSync {
  /**
   * @param {object} [o]
   * @param {() => number} [o.now]   this device's clock, ms (default performance.timeOrigin + performance.now(): it never jumps)
   * @param {number} [o.window]      only samples this recent count, ms (clocks drift apart by a few ms a minute)
   * @param {number} [o.keep]        at most this many samples
   */
  constructor({ now = epochNow, window = 60000, keep = 40 } = {}) {
    this._now = now; this.window = window; this.keep = keep;
    this.samples = [];
    this.best = null;
  }
  /** Add one ping. Returns the sample, or null when it was not a ping. */
  add(t0, server, t1) {
    const s = clockSample(t0, server, t1);
    if (!s) return null;
    this.samples.push(s);
    const t = s.at;
    this.samples = this.samples.filter((x) => t - x.at <= this.window).slice(-this.keep);
    this.best = estimateOffset(this.samples);
    return s;
  }
  /** At least one ping has come back. */
  get ready() { return !!this.best; }
  /** The relay's clock minus mine, ms (0 until the first pong). */
  get offset() { return this.best ? this.best.offset : 0; }
  /** Round trip of the trusted sample, ms (null until the first pong): the offset is good to half of it. */
  get rtt() { return this.best ? this.best.rtt : null; }
  /** This device's own clock, ms. */
  local() { return this._now(); }
  /** The shared clock, ms. */
  now() { return this._now() + this.offset; }
}
