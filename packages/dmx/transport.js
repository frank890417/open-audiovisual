// @openav/dmx · transport — where the rendered universes go each frame. Browser and Node alike; nothing here opens a socket
// or a port by itself.
//
//   const out = dmxTransport('sim');                      // memory only: out.bytes(1) is what the lights would get
//   const out = dmxTransport('bridge', { client });        // an OutClient (or lab.out) → the out-bridge → Art-Net / sACN / Enttec
//   const out = dmxTransport('serial', { universe: 1 });   // Web Serial → an Enttec DMX USB Pro, no bridge
//   button.onclick = () => out.connect();                     //   (the browser asks which port: only from a click)
//   out.send(engine.render(t));                               // every frame: only what changed leaves
//
// Every transport puts the frame through a flash guard first (flash-guard.js): no light may flash more than maxFlashHz (3)
// times in any second, whatever made it flash. Give it the patch ({ patch }) and it reads each fixture's light; without one
// it can only hold each channel on its own, which is coarser. Turning it off takes { flashGuard: false }, and the monitor
// then says so for as long as it is off. The guard counts real seconds (`now`, wall time by default), never the time a
// timeline is scrubbed to.
//
// Every transport keeps a copy of what it last delivered per universe and sends only the difference: for the bridge, one
// `dmx/<universe>/<address>` value (byte / 255) per changed channel; for the Enttec, a frame when anything in its universe
// changed (its frame always carries all 512) and once a second otherwise, at most 40 frames a second.
// Not here: an Enttec Open DMX or any bare FTDI cable (the computer has to time the DMX break itself, which a page cannot
// do reliably), RDM, Art-Net discovery.

import { encodeEnttecDmx } from './protocol/enttec.js?v=6b091ec6';
import { FlashGuard, ChannelFlashGuard, universeList } from './flash-guard.js?v=6b091ec6';

const SLOTS = 512;
const FRAME_MS = 25;            // 40 Hz at most to a serial widget
const KEEPALIVE_MS = 1000;

// wall time in milliseconds: the one clock in this package, and only for the guard (the engine stays a function of time)
const wallClock = () => (typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now());

/**
 * The guard a transport applies: per fixture with a patch, per channel without one, none only when asked for in so many words.
 * → { list(universes): [[id, bytes]] after the guard, status(): what it is doing }
 */
function guardOf({ patch, flashGuard = true, maxFlashHz = 3, now = wallClock } = {}) {
  if (flashGuard !== true && flashGuard !== false) throw new TypeError(`dmxTransport: flashGuard is true (the default) or false, to switch the flash guard off on purpose (got ${JSON.stringify(flashGuard)})`);
  if (typeof now !== 'function') throw new TypeError('dmxTransport: now is a function that returns milliseconds');
  if (patch !== undefined && patch !== null && !(typeof patch.ids === 'function' && 'fixtures' in patch)) throw new TypeError('dmxTransport: patch is the Patch the universes were rendered from');
  if (!flashGuard) return { list: universeList, status: () => ({ on: false, unit: null, maxFlashHz: null, held: [] }) };
  const g = patch ? new FlashGuard(patch, { maxFlashHz }) : new ChannelFlashGuard({ maxFlashHz });
  let at = null;
  return {
    list(universes) {
      at = now() / 1000;
      const list = universeList(universes);
      return patch ? g.apply(list, at) : list.map(([id, bytes]) => [id, g.apply(id, bytes, at)]);
    },
    status: () => (patch ? g.status(at ?? undefined) : g.status()),
  };
}

function base(kind, options) {
  const last = new Map();             // universe → the bytes delivered last
  const listeners = new Set();
  const guard = guardOf(options);
  const t = {
    kind, status: 'closed', sent: 0, frames: 0,
    /**
     * What the flash guard is doing: { on, unit: 'fixture' | 'channel' | null, maxFlashHz, held: [fixture ids, or
     * "universe/address" per channel] }. `on: false` only when the transport was made with { flashGuard: false }.
     */
    get flashGuard() { return guard.status(); },
    /** What this transport last delivered for a universe (512 bytes, zeros before anything). */
    bytes(id = 1) { const b = last.get(id); return b ? b.slice() : new Uint8Array(SLOTS); },
    /** The universes it has delivered, lowest first. */
    get universes() { return [...last.keys()].sort((a, b) => a - b); },
    onStatus(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  };
  const setStatus = (s) => { if (s === t.status) return; t.status = s; for (const f of [...listeners]) try { f(s); } catch {} };
  /** Compare with what was delivered: call put(id, address, byte) for each change, return how many changed. */
  const diff = (id, bytes, put) => {
    let prev = last.get(id);
    if (!prev) { prev = new Uint8Array(SLOTS); last.set(id, prev); }
    let n = 0;
    for (let i = 0; i < SLOTS; i++) {
      const b = bytes[i] | 0;
      if (b === prev[i]) continue;
      prev[i] = b; n++;
      if (put) put(id, i + 1, b);
    }
    return n;
  };
  return { t, setStatus, diff, last, guard };
}

function simTransport(options) {
  const { t, setStatus, diff, guard } = base('sim', options);
  setStatus('sim');
  /** The channels the last send() changed: [{ universe, address, value }]. */
  t.changed = [];
  t.send = (universes) => {
    const changed = [];
    let n = 0;
    for (const [id, bytes] of guard.list(universes)) n += diff(id, bytes, (universe, address, value) => changed.push({ universe, address, value }));
    t.changed = changed;
    t.sent += n; if (n) t.frames++;
    return n;
  };
  t.close = () => {};
  return t;
}

function bridgeTransport(options = {}) {
  const { client } = options;
  if (!client || typeof client.set !== 'function') throw new TypeError("dmxTransport('bridge', { client }): client is an OutClient (or lab.out), connected or simulating");
  const { t, setStatus, diff, guard } = base('bridge', options);
  const follow = () => setStatus(client.status || 'open');
  follow();
  const un = typeof client.onStatus === 'function' ? client.onStatus(follow) : null;
  t.client = client;
  t.send = (universes) => {
    let n = 0;
    for (const [id, bytes] of guard.list(universes)) n += diff(id, bytes, (u, a, b) => client.set(`dmx/${u}/${a}`, b / 255));
    t.sent += n; if (n) t.frames++;
    return n;
  };
  t.close = () => { un?.(); };     // the client is yours: close it when the page should let the lights go (the bridge then sends its safe values)
  return t;
}

function serialTransport(options = {}) {
  const { universe = 1, serial, baudRate = 57600, filters } = options;
  if (!Number.isInteger(universe) || universe < 0 || universe > 63999) throw new RangeError(`dmxTransport('serial', { universe }): an integer 0–63999 (got ${universe})`);
  const api = serial !== undefined ? serial : (typeof navigator !== 'undefined' ? navigator.serial : undefined);
  const { t, setStatus, diff, guard } = base('serial', options);
  let port = null, writer = null, writing = false, cooling = false, pending = false, cool = null, alive = null, inflight = Promise.resolve();
  const stopTimers = () => { clearTimeout(cool); clearTimeout(alive); cool = alive = null; cooling = false; };
  t.universe = universe;
  t.supported = !!(api && typeof api.requestPort === 'function');
  t.error = null;
  setStatus(t.supported ? 'idle' : 'unsupported');

  const fail = (e) => {
    t.error = e && e.message ? e.message : String(e);
    stopTimers();
    try { writer?.releaseLock(); } catch {}
    writer = null; writing = false;
    const p = port; port = null;
    if (p) Promise.resolve().then(() => p.close()).catch(() => {});
    setStatus('closed');
  };
  // one frame at a time, at most every 25 ms: a change that comes sooner waits for its slot (it is never lost), and a
  // frame still on its way is never interrupted; whatever is newest when the slot comes is what goes. Timers, not a
  // clock: after each frame a 25 ms cool-down, and a keep-alive 1 s later if nothing else went
  const arm = () => {
    cooling = true;
    clearTimeout(cool); cool = setTimeout(() => { cooling = false; if (pending) flush(false); }, FRAME_MS); cool.unref?.();
    clearTimeout(alive); alive = setTimeout(() => flush(true), KEEPALIVE_MS); alive.unref?.();
  };
  const flush = (force) => {
    if (!writer || writing || (!pending && !force) || (cooling && !force)) return;
    pending = false; writing = true; arm();
    inflight = writer.write(encodeEnttecDmx(t.bytes(universe))).then(() => { writing = false; t.frames++; if (pending && !cooling) flush(false); }, fail);
  };
  if (t.supported && typeof api.addEventListener === 'function') {
    api.addEventListener('disconnect', (e) => { if (port && e.target === port) fail(new Error('the interface was unplugged')); });
  }

  /** Ask for the port and open it. Call it from a click (the browser shows its port picker); never called for you. */
  t.connect = async () => {
    if (!t.supported) throw new Error('Web Serial is not in this browser: Chrome or Edge on a computer, on https or localhost');
    if (port) return t;
    setStatus('connecting');
    try {
      const p = await api.requestPort(filters ? { filters } : undefined);
      await p.open({ baudRate });
      port = p; writer = p.writable.getWriter(); t.error = null;
      setStatus('open');
      flush(true);                   // what the page shows now, at once
    } catch (e) { fail(e); throw e; }
    return t;
  };
  t.send = (universes) => {
    let n = 0;
    for (const [id, bytes] of guard.list(universes)) if (id === universe) n += diff(id, bytes);
    if (n) pending = true;
    t.sent += n;
    flush(false);
    return n;
  };
  /** Let go of the port, after the newest frame has left. The widget keeps repeating the last frame: send a blackout first to leave the rig dark. */
  t.close = async () => {
    stopTimers();
    const w = writer, p = port;
    if (w) {
      try { await inflight; } catch {}
      if (pending && writer === w) { pending = false; try { await w.write(encodeEnttecDmx(t.bytes(universe))); t.frames++; } catch {} }
    }
    writer = null; port = null;
    try { await w?.close(); } catch {}
    try { await p?.close(); } catch {}
    setStatus(t.supported ? 'closed' : 'unsupported');
  };
  return t;
}

const KINDS = { sim: simTransport, bridge: bridgeTransport, serial: serialTransport };

/**
 * Where the rendered universes go. `kind` is 'sim' (memory only), 'bridge' (through an OutClient to the out-bridge) or
 * 'serial' (Web Serial to an Enttec DMX USB Pro). Every kind holds every light to `maxFlashHz` flashes in any second.
 * @param {'sim'|'bridge'|'serial'} kind
 * @param {object} [options]  all: { patch, flashGuard = true, maxFlashHz = 3, now } · bridge: { client } · serial: { universe = 1, baudRate, filters, serial }
 */
export function dmxTransport(kind = 'sim', options = {}) {
  const make = KINDS[kind];
  if (!make) throw new RangeError(`dmxTransport(kind): 'sim', 'bridge' or 'serial' (got ${JSON.stringify(kind)})`);
  return make(options);
}
