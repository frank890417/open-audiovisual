// dmx-frames — what the three DMX sinks (artnet, sacn, enttec) share: the channel names, one 512-byte buffer per universe,
// and when a frame leaves.
//
//   channel  dmx/<universe>/<address>   address 1..512 as a patch sheet counts; value 0..1 → byte 0..255 (rounded, clamped)
//   universe the number the page patched on: dmx/1/… is "universe 1" (Art-Net Port-Address 1, sACN universe 1, the Enttec's port)
//
// A universe's frame goes out on a fixed 40 Hz tick while its values change, never sooner than 23 ms after its last frame
// (DMX itself carries about 44 frames a second at 512 channels, so a node gets nothing it could not pass on), and at least
// once a second while nothing changes: an Art-Net node or an sACN receiver that hears nothing for about 2.5 s decides the
// source is gone and does whatever it was set to do on loss. A universe nobody has sent a value to sends nothing at all.
// The scheduling is pure: the sink gives `emit`, time comes from `now`, so a test can drive tick() with a clock of its own.
//
// The flash guard, on by default in all three sinks ("flashGuard": false on the route switches it off): no channel may brighten
// by 10% of full scale or more than maxFlashHz (3) times in any second; a rise that would be one too many waits (the channel
// stays at the value it last sent) until the second has room, and falls always pass. A bridge knows no patch, so one DMX channel is the
// only unit it has. That is coarser than the page's guard, which reads each fixture's light: it also holds channels that do
// not flash anything. The one that matters: during a smooth pan or tilt the fine byte of a 16-bit pair runs a fast sawtooth,
// and holding it makes the beam step by up to one coarse step. List such channels in "exempt" ("dmx/1/50", or "dmx/1/49-52"
// for a head's pan, pan fine, tilt, tilt fine). A colour that changes at constant brightness, a pixel chase on a bar and a fast
// gobo or colour wheel can be held too. flush() (the safe values, a clean stop) is never held: what it sends is what was set,
// for every channel of a universe that changed, so a watchdog event also lets one unguarded frame of any channel held then.

import { ChannelFlashGuard } from '../../../dmx/flash-guard.js?v=6c223527';

export const DMX_CHANNEL = /^dmx\/(\d{1,5})\/(\d{1,3})$/;
export const SLOTS = 512;
export const TICK_MS = 25;            // 40 Hz
export const MIN_GAP_MS = 23;         // ≤ 43.5 frames a second per universe, whatever the timer does
export const KEEPALIVE_MS = 1000;

/** "dmx/1/49" → { universe: 1, address: 49 }, or null (another name, an address outside 1..512, a universe above 63999). */
export function parseDmxChannel(ch) {
  const m = DMX_CHANNEL.exec(ch);
  if (!m) return null;
  const universe = Number(m[1]), address = Number(m[2]);
  if (universe > 63999 || address < 1 || address > SLOTS) return null;
  return { universe, address };
}

/** 0..1 → 0..255: rounded, clamped (a value above 1 is full, NaN is 0). */
export const toByte = (v) => (v >= 1 ? 255 : v > 0 ? Math.round(v * 255) : 0);

const EXEMPT = /^dmx\/(\d{1,5})\/(\d{1,3})(?:-(\d{1,3}))?$/;

/**
 * A route's "flashGuard" → a ChannelFlashGuard, or null when the route says false. true or nothing: on, 3 Hz.
 * { "maxFlashHz": 3, "exempt": ["dmx/1/49", "dmx/1/50-52"] }: another cap, and channels left alone (a head's pan and tilt).
 */
export function flashGuardOf(cfg, sink) {
  const g = cfg.flashGuard;
  if (g === false) return null;
  const isObj = g && typeof g === 'object' && !Array.isArray(g);
  if (g !== undefined && g !== true && !isObj) throw new Error(`${sink} flashGuard 要是 false（關掉頻閃保護）、true，或 { "maxFlashHz": 3, "exempt": ["dmx/1/49-52"] }（收到 ${JSON.stringify(g)}）`);
  const o = isObj ? g : {};
  const maxFlashHz = o.maxFlashHz === undefined ? 3 : o.maxFlashHz;
  if (!(typeof maxFlashHz === 'number' && maxFlashHz > 0)) throw new Error(`${sink} flashGuard.maxFlashHz 要是大於 0 的數字（收到 ${JSON.stringify(o.maxFlashHz)}）`);
  const list = o.exempt === undefined ? [] : o.exempt;
  if (!Array.isArray(list)) throw new Error(`${sink} flashGuard.exempt 要是通道清單，例如 ["dmx/1/49-52"]`);
  const ranges = list.map((x) => {
    const m = EXEMPT.exec(typeof x === 'string' ? x : '');
    const u = m && Number(m[1]), a = m && Number(m[2]), b = m && (m[3] === undefined ? a : Number(m[3]));
    if (!m || u > 63999 || a < 1 || b > SLOTS || b < a) throw new Error(`${sink} flashGuard.exempt：${JSON.stringify(x)} 要寫成 "dmx/<universe>/<address>" 或 "dmx/<universe>/<from>-<to>"，位址 1–512`);
    return [u, a, b];
  });
  const guard = new ChannelFlashGuard({ maxFlashHz, exempt: (u, a) => ranges.some(([U, A, B]) => U === u && a >= A && a <= B) });
  guard.exemptList = [...list];
  return guard;
}

export class DmxFrames {
  #u = new Map();            // universe → { data, dirty, last, n }
  #timer = null;

  /**
   * @param {object} o
   * @param {(universe:number, data:Uint8Array, n:number) => void} o.emit  put one frame on the wire (n counts this universe's frames from 1)
   * @param {(universe:number) => boolean} [o.accept]  which universes this sink carries (the rest are counted in `ignored`)
   * @param {() => number} [o.now]
   * @param {(e:Error) => void} [o.onError]  an emit that throws is counted and reported here, never thrown into a timer
   * @param {object|null} [o.flashGuard]  a ChannelFlashGuard (flashGuardOf(cfg)), or null for none
   */
  constructor({ emit, accept = () => true, now = Date.now, onError = () => {}, keepAliveMs = KEEPALIVE_MS, minGapMs = MIN_GAP_MS, flashGuard = null } = {}) {
    this.emit = emit; this.accept = accept; this.now = now; this.onError = onError;
    this.keepAliveMs = keepAliveMs; this.minGapMs = minGapMs; this.flashGuard = flashGuard;
    this.frames = 0; this.keepAlives = 0; this.ignored = 0; this.errors = 0;
  }

  /** Take one channel value; true when this sink carries it. Changes the buffer only; the frame leaves on the next tick. */
  set(ch, v) {
    const c = parseDmxChannel(ch);
    if (!c || !this.accept(c.universe)) { this.ignored++; return false; }
    let u = this.#u.get(c.universe);
    if (!u) { u = { data: new Uint8Array(SLOTS), dirty: true, last: -Infinity, n: 0 }; this.#u.set(c.universe, u); }
    const b = toByte(Number(v));
    if (u.data[c.address - 1] !== b) { u.data[c.address - 1] = b; u.dirty = true; }
    return true;
  }

  #send(id, u, keepAlive, asSet = false) {
    u.last = this.now(); u.n++;
    let data = u.data;
    const g = this.flashGuard;
    if (g && asSet) g.sync(id, data, u.last / 1000);           // the safe values go as they are; the guard learns they went
    else if (g) data = g.apply(id, data, u.last / 1000);
    u.dirty = data !== u.data;                                   // something held back: look again on the next tick
    u.out = data === u.data ? null : data;                       // what went, when it is not what was set
    this.frames++; if (keepAlive) this.keepAlives++;
    try { this.emit(id, data, u.n); } catch (e) { this.errors++; this.onError(e); }
  }

  /** One tick of the 40 Hz clock: changed universes whose gap has passed, and quiet ones whose keep-alive is due. */
  tick() {
    const now = this.now();
    let sent = 0;
    for (const [id, u] of this.#u) {
      const since = now - u.last;
      if (u.dirty ? since >= this.minGapMs : since >= this.keepAliveMs) { this.#send(id, u, !u.dirty); sent++; }
    }
    return sent;
  }

  /**
   * Every changed universe at once, gap or not, and as it was set, past the flash guard: the bridge calls this right after it
   * sent safe values (dark, usually, which the guard would pass anyway) and on a clean stop, when a held frame left on a node
   * that repeats it would stay lit.
   */
  flush() {
    let sent = 0;
    for (const [id, u] of this.#u) if (u.dirty) { this.#send(id, u, false, true); sent++; }
    return sent;
  }

  /** Start the 40 Hz timer (idempotent; it never keeps the process alive on its own). */
  start(tickMs = TICK_MS) {
    if (this.#timer) return this;
    this.#timer = setInterval(() => this.tick(), tickMs);
    this.#timer.unref?.();
    return this;
  }
  stop() { clearInterval(this.#timer); this.#timer = null; return this; }

  /** The universes that have been sent a value, lowest first. */
  get universes() { return [...this.#u.keys()].sort((a, b) => a - b); }
  /** A copy of one universe's 512 bytes as they were set (zeros for one never sent to). */
  bytes(id) { const u = this.#u.get(id); return u ? u.data.slice() : new Uint8Array(SLOTS); }
  /** A copy of the last frame that left for a universe (what the flash guard let out; what was set when it held nothing). */
  sent(id) { const u = this.#u.get(id); return u ? (u.out || u.data).slice() : new Uint8Array(SLOTS); }
  /** [universe, live buffer] pairs, for a sink's last words (sACN's stream-terminated packets). */
  entries() { return this.universes.map((id) => [id, this.#u.get(id).data]); }
  stats() { return { universes: this.universes, frames: this.frames, keepAlives: this.keepAlives, ignored: this.ignored, errors: this.errors, flashGuard: this.guardStatus() }; }
  /** { on: false } or { on: true, unit: 'channel', maxFlashHz, exempt, held: ["universe/address"] } */
  guardStatus() {
    const g = this.flashGuard;
    return g ? { ...g.status(), exempt: [...(g.exemptList || [])] } : { on: false };
  }
}

/**
 * A UDP socket that is bound before anything is sent and closes only after its last packet has left: the bridge closes its
 * sinks 30 ms after the safe values, and a datagram queued on a socket that closes under it is lost.
 */
export function udpSender(dgram, { onError = () => {}, setup = () => {} } = {}) {
  const sock = dgram.createSocket('udp4');
  let inflight = 0, closing = false, closed = false, sent = 0;
  sock.on('error', (e) => onError(e));
  sock.bind(0, () => { try { setup(sock); } catch (e) { onError(e); } });
  const finish = () => { if (closed) return; closed = true; try { sock.close(); } catch {} };
  return {
    send(buf, port, host) {
      if (closing) return false;
      inflight++;
      try {
        sock.send(buf, port, host, (e) => { inflight--; if (e) onError(e); else sent++; if (closing && !inflight) finish(); });
      } catch (e) { inflight--; onError(e); return false; }
      return true;
    },
    /** Close once the packets already handed over have left (or after 200 ms, whichever comes first). */
    close() {
      if (closing) return;
      closing = true;
      if (!inflight) return finish();
      const t = setTimeout(finish, 200); t.unref?.();
    },
    get sent() { return sent; },
    get closed() { return closing; },
  };
}
