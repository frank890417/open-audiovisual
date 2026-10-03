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
    this._on = null; this._onstate = null;
  }
  get onmidimessage() { return this._on; }
  set onmidimessage(fn) { this._on = typeof fn === 'function' ? fn : null; if (this._on) this.connection = 'open'; }
  get onstatechange() { return this._onstate; }
  set onstatechange(fn) { this._onstate = typeof fn === 'function' ? fn : null; }
  open() { this.connection = 'open'; return Promise.resolve(this); }
  close() { this.connection = 'closed'; return Promise.resolve(this); }
  addEventListener(t, f, o) { if (t === 'midimessage') this.connection = 'open'; return super.addEventListener(t, f, o); }
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
  constructor(o, onSend) { super(o); this._send = onSend; }
  send(data) { try { this._send?.(Array.from(data)); } catch (e) { console.error('[virtual midi] out', e); } }
  clear() {}
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
 * @param {(bytes:number[])=>void} [o.onOutput]   bytes a sketch sends to the virtual OUTPUT (mirror them on screen)
 */
export function createVirtualMIDIAccess({ name = 'OAV Virtual MIDI', manufacturer = 'open-audiovisual', id = 'oav-virtual', sysex = false, onOutput = null } = {}) {
  const access = new VirtualAccess(sysex);
  const input = new VirtualInput({ id: id + '-in', name, manufacturer, type: 'input' });
  const output = new VirtualOutput({ id: id + '-out', name, manufacturer, type: 'output' }, (b) => onOutput?.(b));
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

  return {
    access, input, output,
    get real() { return real; },
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
