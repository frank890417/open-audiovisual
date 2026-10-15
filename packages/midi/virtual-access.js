// @openav/midi · virtual-access — a Web MIDI `MIDIAccess` that always has one
// more input: the on-screen controller (or a phone across the room).
//
// Why: a 2018 sketch that does `navigator.requestMIDIAccess()` (or WebMidi.js)
// and waits for a keyboard shows NOTHING on a laptop without one, on an iPad
// (no Web MIDI at all), in a gallery. Handing it this access instead makes the
// virtual controller a real-looking MIDI input: the sketch's own unmodified
// code receives `midimessage` events with the same bytes a keyboard sends.
//
//   const v = createVirtualMIDIAccess({ name: 'Lab Virtual MIDI' });
//   v.addReal(await navigator.requestMIDIAccess());   // hardware ports join (and hot-plug)
//   navigator.requestMIDIAccess = async () => v.access;
//   v.emit([0x90, 60, 100]);                          // → every listener on the virtual input
//
// The virtual OUTPUT is a real-looking port too: a program that plays out to "OAV Virtual MIDI" (Strudel's
// `.midi('OAV Virtual MIDI')`, a WebMidi.js sketch) calls `send(bytes, timestamp)` on it, and onOutput(bytes,
// timestamp) hears both — the timestamp is when the bytes should sound (performance.now() milliseconds; missing = now),
// exactly what a hardware port would wait for. `clear()` (Web MIDI: drop what is still waiting) calls onClear().
//
// Port order: real inputs FIRST, the virtual one last — sketches that only
// listen to `inputs[0]` (WebMidi.inputs[0]) take the hardware when it is
// there and the virtual controller when it is not. Real ports are passed
// through untouched (their events never pass through this file), so nothing is
// ever delivered twice.

const ET = typeof EventTarget !== 'undefined' ? EventTarget : class { constructor() { this._l = new Map(); }
  addEventListener(t, f) { if (!this._l.has(t)) this._l.set(t, new Set()); this._l.get(t).add(f); }
  removeEventListener(t, f) { this._l.get(t)?.delete(f); }
  dispatchEvent(e) { for (const f of this._l.get(e.type) || []) f.call(this, e); return true; } };
const mkEvent = (type, props) => {
  const e = typeof Event !== 'undefined' ? new Event(type) : { type };
  for (const [k, v] of Object.entries(props)) Object.defineProperty(e, k, { value: v, enumerable: true });
  return e;
};
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/** A Map that also behaves like Web MIDI's MIDIInputMap (insertion-ordered, read-only to callers). */
class PortMap extends Map {}

class VirtualPort extends ET {
  constructor({ id, name, manufacturer, type, version = '1.0' }) {
    super();
    Object.assign(this, { id, name, manufacturer, type, version });
    this.state = 'connected';
    this.connection = 'closed';
    this._on = null; this._onstate = null; this._fns = new Set();
  }
  get onmidimessage() { return this._on; }
  set onmidimessage(fn) { this._on = typeof fn === 'function' ? fn : null; if (this._on) this.connection = 'open'; }
  get onstatechange() { return this._onstate; }
  set onstatechange(fn) { this._onstate = typeof fn === 'function' ? fn : null; }
  open() { this.connection = 'open'; return Promise.resolve(this); }
  close() { this.connection = 'closed'; return Promise.resolve(this); }
  addEventListener(t, f, o) {
    if (t === 'midimessage') { this.connection = 'open'; if (typeof f === 'function' && !this._fns.has(f)) this._fns.add(f); }
    return super.addEventListener(t, f, o);
  }
  removeEventListener(t, f, o) { if (t === 'midimessage') this._fns.delete(f); return super.removeEventListener(t, f, o); }
  /** how many listeners a program has on this port (onmidimessage counts as one): "is anybody listening?" */
  get listening() { return (this._on ? 1 : 0) + this._fns.size; }
  toJSON() { return { id: this.id, name: this.name, manufacturer: this.manufacturer, type: this.type, state: this.state, connection: this.connection }; }
}

class VirtualInput extends VirtualPort {
  /** Deliver bytes to everyone listening (onmidimessage + addEventListener). */
  emit(data, t = now()) {
    const bytes = data instanceof Uint8Array ? data : Uint8Array.from(data || []);
    if (!bytes.length) return;
    const e = mkEvent('midimessage', { data: bytes, receivedTime: t, timeStamp: t, target: this, currentTarget: this, srcElement: this });
    if (this._on) { try { this._on.call(this, e); } catch (err) { console.error('[virtual midi] listener', err); } }
    this.dispatchEvent(e);
  }
}

class VirtualOutput extends VirtualPort {
  constructor(o, onSend, onClear) { super(o); this._send = onSend; this._clear = onClear; this.sent = 0; this.lastSend = null; }
  /** Web MIDI's send(data, timestamp): `timestamp` (performance.now() ms) is when it should sound; left out = now */
  send(data, timestamp) {
    this.sent++; this.lastSend = now();
    const t = typeof timestamp === 'number' && isFinite(timestamp) && timestamp > 0 ? timestamp : undefined;
    try { this._send?.(Array.from(data), t); } catch (e) { console.error('[virtual midi] out', e); }
  }
  /** Web MIDI's clear(): what is still waiting to be sent is dropped */
  clear() { try { this._clear?.(); } catch (e) { console.error('[virtual midi] clear', e); } }
}

/** One send() may carry several MIDI messages back to back (Web MIDI allows it): split them, each one whole.
 *  Running status is not allowed in send(), so a data byte with no status before it is dropped; sysex runs to 0xF7.
 *  @param {ArrayLike<number>} bytes  @returns {number[][]} */
export function splitMidi(bytes) {
  const out = [], b = Array.from(bytes || [], (x) => x & 0xFF);
  let i = 0;
  while (i < b.length) {
    const s = b[i];
    if (s < 0x80) { i++; continue; }
    let n;
    if (s === 0xF0) { let j = i + 1; while (j < b.length && b[j] !== 0xF7) j++; n = j - i + 1; }
    else if (s >= 0xF8 || s === 0xF6 || s === 0xF7 || s === 0xF4 || s === 0xF5) n = 1;
    else if (s === 0xF1 || s === 0xF3) n = 2;
    else if (s === 0xF2) n = 3;
    else { const hi = s & 0xF0; n = hi === 0xC0 || hi === 0xD0 ? 2 : 3; }
    const m = b.slice(i, i + n);
    // a realtime byte (clock) may sit inside another message: lift it out, keep the message whole
    const rt = m.slice(1).filter((x) => x >= 0xF8);
    if (rt.length && s !== 0xF0) {
      const rest = [s];
      let j = i + 1;
      while (rest.length < n && j < b.length) { if (b[j] >= 0xF8) out.push([b[j]]); else rest.push(b[j]); j++; }
      out.push(rest); i = j; continue;
    }
    if (m.length === n || s === 0xF0) out.push(m);
    i += n;
  }
  return out;
}

class VirtualAccess extends ET {
  constructor(sysex) { super(); this.inputs = new PortMap(); this.outputs = new PortMap(); this.sysexEnabled = !!sysex; this._onstate = null; }
  get onstatechange() { return this._onstate; }
  set onstatechange(fn) { this._onstate = typeof fn === 'function' ? fn : null; }
  _state(port) {
    const e = mkEvent('statechange', { port, target: this });
    if (this._onstate) { try { this._onstate.call(this, e); } catch (err) { console.error('[virtual midi] statechange', err); } }
    this.dispatchEvent(e);
    try { port.dispatchEvent?.(mkEvent('statechange', { port })); port.onstatechange?.(mkEvent('statechange', { port })); } catch { /* port listener */ }
  }
}

/**
 * @param {object} [o]
 * @param {string} [o.name]          port name the sketch sees
 * @param {string} [o.manufacturer]
 * @param {string} [o.id]
 * @param {boolean} [o.sysex]        what access.sysexEnabled reports
 * @param {(bytes:number[], timestamp?:number)=>void} [o.onOutput]   bytes a program sends to the virtual OUTPUT, and when
 *                                    they should sound (performance.now() ms; undefined = now)
 * @param {()=>void} [o.onClear]      the program called output.clear(): drop what is still waiting
 */
export function createVirtualMIDIAccess({ name = 'OAV Virtual MIDI', manufacturer = 'open-audiovisual', id = 'oav-virtual', sysex = false, onOutput = null, onClear = null } = {}) {
  const access = new VirtualAccess(sysex);
  const input = new VirtualInput({ id: id + '-in', name, manufacturer, type: 'input' });
  const output = new VirtualOutput({ id: id + '-out', name, manufacturer, type: 'output' }, (b, t) => onOutput?.(b, t), () => onClear?.());
  output.connection = 'open';
  let real = null, realListener = null;

  // rebuild the maps: real ports first (in their own order), virtual last
  const sync = () => {
    const before = new Set([...access.inputs.keys(), ...access.outputs.keys()]);
    const ri = real ? [...real.inputs.values()].filter((p) => p.state !== 'disconnected') : [];
    const ro = real ? [...real.outputs.values()].filter((p) => p.state !== 'disconnected') : [];
    access.inputs.clear(); access.outputs.clear();
    for (const p of ri) access.inputs.set(p.id, p);
    access.inputs.set(input.id, input);
    for (const p of ro) access.outputs.set(p.id, p);
    access.outputs.set(output.id, output);
    const after = new Set([...access.inputs.keys(), ...access.outputs.keys()]);
    return { added: [...after].filter((k) => !before.has(k)), removed: [...before].filter((k) => !after.has(k)) };
  };
  sync();

  let handedOut = 0;
  return {
    access, input, output,
    get real() { return real; },
    /** how many times a program asked for this access (virtualRequestMIDIAccess counts) */
    get requests() { return handedOut; },
    _handed() { handedOut++; },
    /** Feed bytes in as if the virtual device played them. */
    emit: (data) => input.emit(data),
    /** Merge a real MIDIAccess (now or later). Ports added after the sketch got its access arrive as statechange events. */
    addReal(r) {
      if (!r || r === real) return;
      if (real && realListener) real.removeEventListener?.('statechange', realListener);
      real = r;
      const all = () => new Map([...access.inputs, ...access.outputs]);
      const { added } = sync();
      const now0 = all();
      for (const k of added) access._state(now0.get(k));
      realListener = (e) => {
        const prev = all();
        const { added: a, removed: d } = sync();
        const cur = all();
        for (const k of a) access._state(cur.get(k));
        for (const k of d) { const p = prev.get(k); access._state(p); }
        if (!a.length && !d.length && e?.port) access._state(e.port);
      };
      r.addEventListener?.('statechange', realListener);
    },
    dispose() { if (real && realListener) real.removeEventListener?.('statechange', realListener); real = null; },
  };
}

/** Wrap `navigator.requestMIDIAccess` so every caller gets the virtual access.
 *  The real request still happens (permission prompt and all); if it answers
 *  within `waitMs` its ports are there from the start, if it answers later they
 *  hot-plug in, if it is refused or missing (Safari, iPad) the virtual input is
 *  still there.
 *  @param {object} o
 *  @param {(opts:object)=>Promise<any>} [o.real]   the original requestMIDIAccess (bound), or null
 *  @param {()=>ReturnType<typeof createVirtualMIDIAccess>} o.make  build (or return the shared) virtual access
 *  @param {number} [o.waitMs=1200]
 *  @returns {(opts?:object)=>Promise<any>} */
export function virtualRequestMIDIAccess({ real = null, make, waitMs = 1200 }) {
  return function requestMIDIAccess(opts = {}) {
    const v = make(opts);
    v._handed?.();
    if (!real) return Promise.resolve(v.access);
    let settled = false;
    const r = Promise.resolve().then(() => real(opts)).then((acc) => { v.addReal(acc); return true; }, () => false);
    return new Promise((resolve) => {
      const done = () => { if (!settled) { settled = true; resolve(v.access); } };
      r.then(done);
      setTimeout(done, waitMs);   // a permission prompt nobody answers must not hang the sketch
    });
  };
}
