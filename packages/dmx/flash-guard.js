// @openav/dmx · flash-guard — the last line before the bytes leave: no light flashes more than maxFlashHz times in any second,
// whatever made it flash (a live value from the microphone, a kick drum on a dimmer, two engines, a combination the engine's
// own cap could not see).
//
//   const guard = new FlashGuard(patch);                 // per fixture: what each light really emits
//   const safe = guard.apply(engine.render(t), now);     // now in seconds, on a clock that runs at real speed
//
// What a flash is (WCAG 2.3.1, "general flash"): a pair of opposing changes in brightness of 10% of full scale or more. A
// change is measured from the last turning point, not frame to frame, so a slow sine that moves 3% a frame still counts once
// it has moved 10%. A light's brightness here is its intensity times its brightest colour channel, read from the bytes the
// way the fixture reads them (16 bits where the mode has the fine byte). Several intensity channels (cells) count as their
// average; CMY flags in front of a white lamp as the light that passes them.
//
// How it holds: only RISES are rationed. A light may brighten by 10% or more at most maxFlashHz times in any second; when the
// next rise would be one too many, the light stays at the level it last had (steady: a held 12 Hz square does not ripple
// under the line at 12 Hz) until the second has room, then goes where it was asked. Falls always pass at once, so blackout,
// a cue to dark and the bridge's safe values are never held back, and the guard never sends more light than was asked for.
// maxFlashHz rises in a second make at most maxFlashHz flashes in it (a flash needs a rise).
//
// What it changes: only a held light, and only its intensity bytes (coarse and fine), or its colour bytes, all scaled by
// the same factor, when it has no intensity channel. Position, zoom, gobo, strobe and control channels, and every light that
// is not held, leave exactly as they came: bytes in are bytes out.
//
// This file has no imports: the out-bridge copies it and uses ChannelFlashGuard, the same rule for one DMX channel at a time
// (a bridge knows no patch, so a channel is the only unit it has).

/** A change of this much (0..1 of full scale) is half a flash. */
export const FLASH_STEP = 0.1;
const EDGE = 1e-6;                 // a rise exactly one window ago is outside it (float time from summed frame lengths)

/** The rule for a cap: `rises` per `window` seconds (3 Hz: 3 in any second; 2.5: 2 in any second; 0.5: 1 in any 2 s). */
export function flashBudget(maxFlashHz) {
  if (!(typeof maxFlashHz === 'number' && maxFlashHz > 0)) throw new RangeError(`maxFlashHz is a number above 0, Infinity for no limit (got ${maxFlashHz})`);
  if (maxFlashHz === Infinity) return { rises: Infinity, window: 1 };
  if (maxFlashHz < 1) return { rises: 1, window: 1 / maxFlashHz };
  return { rises: Math.floor(maxFlashHz), window: 1 };
}

/** One light (or one channel): where its brightness last turned, and when it last rose. */
class Limiter {
  dir = -1;                        // -1: watching for a rise (ext is the lowest since); +1: watching for a fall (ext is the highest)
  ext = 0;                         // dark before the first frame: a light that comes on counts as a rise
  last = 0;                        // the level last sent: where a held light stays (always under ext + step while dir is -1)
  rises = [];

  #prune(t, window) {
    while (this.rises.length && this.rises[0] <= t - window + EDGE) this.rises.shift();
  }

  /** The brightest this light may be at time t without one rise too many: the level it was asked for, or the one it last had. */
  allow(level, t, { rises, window }, step) {
    this.#prune(t, window);
    if (this.dir > 0 || level < this.ext + step || this.rises.length < rises) return level;
    return Math.min(level, this.last);
  }

  /** What was really sent at time t: move the turning point, count a rise. */
  commit(level, t, step) {
    this.last = level;
    if (this.dir > 0) {
      if (level > this.ext) this.ext = level;
      else if (level <= this.ext - step) { this.dir = -1; this.ext = level; }
    } else if (level < this.ext) this.ext = level;
    else if (level >= this.ext + step) { this.dir = 1; this.ext = level; this.rises.push(t); }
  }

  /** Rises in the window that ends at t. */
  count(t, window) {
    this.#prune(t, window);
    return this.rises.length;
  }
}

/** The universes to guard: a Universes, a Map, { id: bytes } or [[id, bytes]] → [[id, bytes]]. */
export function universeList(universes) {
  if (!universes) return [];
  if (Array.isArray(universes)) return universes.map(([id, b]) => [Number(id), b && b.data ? b.data : b]);
  if (typeof universes.ids === 'function' && typeof universes.bytes === 'function') return universes.ids().map((id) => [id, universes.bytes(id)]);
  const entries = universes instanceof Map ? [...universes] : Object.entries(universes);
  return entries.map(([id, b]) => [Number(id), b && b.data ? b.data : b]);
}

const CMY = new Set(['cyan', 'magenta', 'yellow']);
const readSlot = (data, at, s) => (s.fineOffset >= 0 ? ((data[at + s.offset] | 0) * 256 + (data[at + s.fineOffset] | 0)) / 65535 : (data[at + s.offset] | 0) / 255);
function writeSlot(data, at, s, v) {
  // floor, never round: a held light must not come out a step brighter than it may be (the 1e-9 keeps 0.6 · 255 at 153)
  if (s.fineOffset >= 0) { const x = Math.floor(Math.min(1, Math.max(0, v)) * 65535 + 1e-9); data[at + s.offset] = x >> 8; data[at + s.fineOffset] = x & 255; }
  else data[at + s.offset] = Math.floor(Math.min(1, Math.max(0, v)) * 255 + 1e-9);
}

/**
 * How bright one placed fixture is for a universe's bytes, 0..1: its intensity (the average of its intensity channels, 1 when
 * it has none) times its brightest colour channel (1 when it has none; CMY flags: the light that passes the thinnest one).
 * @param {object} rec  a placed fixture (Patch.get(id))
 * @param {ArrayLike<number>} data  the 512 bytes of its universe
 */
export function fixtureLevel(rec, data) {
  const L = rec.layout, at = rec.address - 1;
  let intensity = 1;
  if (L.intensities.length) intensity = L.intensities.reduce((a, s) => a + readSlot(data, at, s), 0) / L.intensities.length;
  let colour = 1;
  if (L.colors.length) {
    const emitters = L.colors.filter((s) => !CMY.has(s.color));
    colour = emitters.length ? Math.max(...emitters.map((s) => readSlot(data, at, s))) : 1 - Math.min(...L.colors.map((s) => readSlot(data, at, s)));
  }
  return intensity * colour;
}

/** Scale a fixture's light down by `f` (0..1) in `data`: its intensity channels, or its colour channels when it has no intensity. */
function dimFixture(rec, data, f) {
  const L = rec.layout, at = rec.address - 1;
  const slots = L.intensities.length ? L.intensities : L.colors.filter((s) => !CMY.has(s.color));
  if (slots.length) { for (const s of slots) writeSlot(data, at, s, readSlot(data, at, s) * f); return; }
  // CMY only: close the flags toward full (darker) so the light that passes is f of what it was
  for (const s of L.colors) writeSlot(data, at, s, 1 - (1 - readSlot(data, at, s)) * f);
}

/**
 * The flash guard for a patch: each fixture's light, frame by frame, held to `maxFlashHz` flashes in any second.
 * It keeps a memory (when each light last turned and rose), so it sits outside the engine, which stays a pure function of time.
 */
export class FlashGuard {
  #patch;
  #lights = new Map();             // fixture id → Limiter
  #held = new Set();
  #rule;

  /**
   * @param {import('./patch.js?v=9a90f849').Patch} patch  the fixtures whose light to read and hold
   * @param {object} [options]
   * @param {number} [options.maxFlashHz=3]  flashes a light may make in any second (Infinity: no limit)
   */
  constructor(patch, { maxFlashHz = 3 } = {}) {
    if (!patch || typeof patch.ids !== 'function' || !('fixtures' in patch)) throw new TypeError('FlashGuard(patch): a Patch');
    this.#rule = flashBudget(maxFlashHz);
    this.#patch = patch;
    /** The cap this guard holds every light to. */
    this.maxFlashHz = maxFlashHz;
  }

  /**
   * The bytes to send at time `t` (seconds, on a clock that runs at real speed: wall time, not a timeline you can scrub).
   * Returns [[universe, bytes]]: the same arrays that came in when nothing was held, a changed copy of a universe where a
   * light was held. Call it once per frame, in time order.
   * @param {object} universes  a Universes (what render() returns), a Map, { id: bytes } or [[id, bytes]]
   * @param {number} t
   */
  apply(universes, t) {
    if (!(typeof t === 'number' && Number.isFinite(t))) throw new TypeError('FlashGuard.apply(universes, t): t is a time in seconds');
    const rule = this.#rule, recs = this.#patch.fixtures;
    this.#held.clear();
    return universeList(universes).map(([id, bytes]) => {
      let out = bytes;
      for (const rec of recs) {
        if (rec.universe !== id) continue;
        let lim = this.#lights.get(rec.id);
        if (!lim) this.#lights.set(rec.id, (lim = new Limiter()));
        const want = fixtureLevel(rec, out);
        const may = lim.allow(want, t, rule, FLASH_STEP);
        let sent = want;
        if (may < want) {
          if (out === bytes) out = Uint8Array.from(bytes);
          dimFixture(rec, out, may / want);
          sent = fixtureLevel(rec, out);
          this.#held.add(rec.id);
        }
        lim.commit(sent, t, FLASH_STEP);
      }
      return [id, out];
    });
  }

  /** The fixtures held back in the last apply() (their light stays where it was until the second has room). */
  get held() {
    return [...this.#held];
  }

  /**
   * What the guard is doing, for a monitor or a log: { on, unit: 'fixture', maxFlashHz, held: [ids], rises: { id: n } }
   * (`rises`: how many times each light brightened by a step in the second up to `t`; lights with none are left out).
   */
  status(t) {
    const rises = {};
    if (typeof t === 'number') for (const [id, lim] of this.#lights) { const n = lim.count(t, this.#rule.window); if (n) rises[id] = n; }
    return { on: true, unit: 'fixture', maxFlashHz: this.maxFlashHz, held: this.held, rises };
  }

  /** Forget every light's history (a new show, a new rig). */
  reset() {
    this.#lights.clear();
    this.#held.clear();
  }
}

/**
 * The same rule for one DMX channel at a time, where nothing says which channels make one light: the out-bridge's DMX sinks.
 * Coarser than FlashGuard: a channel is not a light, so it also rations the rises of channels that do not flash anything
 * (the fine byte of a 16-bit pan runs a fast sawtooth during a smooth move), and it cannot see two channels of one light
 * that trade places. `exempt(universe, address)` true leaves a channel alone.
 */
export class ChannelFlashGuard {
  #u = new Map();                  // universe → Limiter[512]
  #held = new Map();               // universe → Set of addresses held in the last apply
  #rule;

  /** @param {{ maxFlashHz?: number, exempt?: (universe: number, address: number) => boolean }} [options] */
  constructor({ maxFlashHz = 3, exempt = () => false } = {}) {
    this.#rule = flashBudget(maxFlashHz);
    this.maxFlashHz = maxFlashHz;
    this.exempt = exempt;
  }

  /** One universe's 512 bytes at time t (seconds): the same array when nothing was held, else a changed copy. */
  apply(universe, data, t) {
    let lims = this.#u.get(universe);
    if (!lims) this.#u.set(universe, (lims = []));
    const held = new Set();
    let out = data;
    for (let i = 0; i < data.length; i++) {
      if (this.exempt(universe, i + 1)) continue;
      const lim = lims[i] || (lims[i] = new Limiter());
      const want = (data[i] | 0) / 255;
      const may = lim.allow(want, t, this.#rule, FLASH_STEP);
      let sent = want;
      if (may < want) {
        if (out === data) out = Uint8Array.from(data);
        out[i] = Math.floor(may * 255 + 1e-9);
        sent = out[i] / 255;
        held.add(i + 1);
      }
      lim.commit(sent, t, FLASH_STEP);
    }
    this.#held.set(universe, held);
    return out;
  }

  /** Tell the guard a universe was sent as is (a frame that bypassed it, such as the safe values on a clean stop). */
  sync(universe, data, t) {
    let lims = this.#u.get(universe);
    if (!lims) this.#u.set(universe, (lims = []));
    for (let i = 0; i < data.length; i++) {
      if (this.exempt(universe, i + 1)) continue;
      (lims[i] || (lims[i] = new Limiter())).commit((data[i] | 0) / 255, t, FLASH_STEP);
    }
    this.#held.set(universe, new Set());
  }

  /** The channels held back in the last apply(), as "universe/address", lowest first. */
  get held() {
    const out = [];
    for (const [u, set] of [...this.#held].sort((a, b) => a[0] - b[0])) for (const a of [...set].sort((x, y) => x - y)) out.push(`${u}/${a}`);
    return out;
  }

  status() {
    return { on: true, unit: 'channel', maxFlashHz: this.maxFlashHz, held: this.held };
  }
}
