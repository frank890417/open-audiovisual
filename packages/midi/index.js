// @openav/midi — WebMIDI in/out for performance use.
//
// Lineage: The Last Input (2026 IRCAM) core/midi-engine.js — battle-tested on stage.
// Input: CC / Note / Bend → published as signals (midi/cc/N, midi/note/on…).
// Output: send(bytes) with an observer hook (meters), plus a proper panic().
//
// Chrome-only reality: Web MIDI is not in Safari. Performance machines run
// Chrome/Edge; audio+pose inputs cover the rest of the browsers.

export class Midi {
  /**
   * @param {object} opts
   * @param {import('../core/src/signals.js?v=0c76e80').Signals} [opts.signals] publish inputs here
   * @param {string} [opts.filterOut] regex source-name filter to avoid feedback loops (default: IAC)
   */
  constructor({ signals = null, filterOut = 'IAC' } = {}) {
    this.signals = signals;
    this.filterOut = filterOut ? new RegExp(filterOut, 'i') : null;
    this.access = null; this.out = null;
    this.outputs = []; this.inputs = [];
    this.enabled = false;
    this.onCC = null;      // (cc, val01, ch) =>
    this.onNote = null;    // (note, vel01, on, ch) =>
    this.onMessage = null; // ({dir, text}) => console/log hook
    this.onSend = null;    // (bytes) => output observer (meters)
    this.onDeviceChange = null;   // (devices) => UI hook
    this._slugs = new Map();      // input port → slug (stable by NAME, so a device
    this._muted = new Set();      //   that reconnects keeps its identity & routes)
  }

  /** Device list for UIs: [{slug, name, listening}]. */
  devices() {
    return this.inputs.map(i => ({ slug: this._slugs.get(i), name: i.name || '?', listening: !this._muted.has(this._slugs.get(i)) }));
  }
  /** Mute/unmute one device (by slug) without unplugging it. */
  setListening(slug, on) { on ? this._muted.delete(slug) : this._muted.add(slug); this.onDeviceChange?.(this.devices()); }

  log(dir, text) { if (this.onMessage) this.onMessage({ dir, text }); }

  /** Request access and wire inputs. `preferredOut` matches by exact name, then substring. */
  async enable(preferredOut = '') {
    try {
      this.access = await navigator.requestMIDIAccess({ sysex: false });
    } catch (e) { this.log('in', 'WebMIDI unavailable: ' + e.message); return false; }
    this.enabled = true;
    this._refresh(preferredOut);
    this.access.onstatechange = () => this._refresh(preferredOut);
    return true;
  }

  _refresh(preferredOut) {
    this.outputs = Array.from(this.access.outputs.values());
    const exact = this.outputs.find(o => o.name === preferredOut);
    const sub = preferredOut ? this.outputs.find(o => o.name && o.name.includes(preferredOut)) : null;
    this.out = exact || sub || this.out || this.outputs[0] || null;
    this.inputs = Array.from(this.access.inputs.values())
      .filter(i => !(this.filterOut && this.filterOut.test(i.name || '')));   // don't listen to our own OUT
    // slug by NAME (not port id): a device that drops and reconnects keeps its
    // identity — and therefore its routes. Duplicate names get -2, -3…
    const seen = new Map();
    this._slugs = new Map();
    for (const inp of this.inputs) {
      let slug = (inp.name || 'midi-device').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'midi-device';
      const n = (seen.get(slug) || 0) + 1; seen.set(slug, n);
      if (n > 1) slug += '-' + n;
      this._slugs.set(inp, slug);
    }
    this.inputs.forEach(inp => { inp.onmidimessage = (m) => this._onIn(m, inp.name, this._slugs.get(inp)); });
    this.log('in', `inputs: ${this.inputs.map(i => i.name).join(', ') || '(none)'} | out: ${this.out?.name || '(none)'}`);
    this.onDeviceChange?.(this.devices());
  }

  selectOutput(name) { const o = this.outputs.find(o => o.name === name); if (o) this.out = o; }

  _onIn(msg, src, slug) {
    if (slug && this._muted.has(slug)) return;
    const [status, d1, d2] = msg.data, type = status & 0xf0, ch = (status & 0x0f) + 1;
    // with 2+ devices, signals also publish under midi/<slug>/… so controllers
    // don't collide; single-device stays terse (midi/cc/N) — zero-config default
    const multi = this.inputs.length > 1 && slug;
    let text;
    if (type === 0x90 && d2 > 0) {
      text = `Note On  ch${ch} n${d1} v${d2}`;
      this.onNote?.(d1, d2 / 127, true, ch);
      this.signals?.pulse('midi/note/on', { note: d1, vel: d2 / 127, ch, device: slug });
      if (multi) this.signals?.pulse(`midi/${slug}/note/on`, { note: d1, vel: d2 / 127, ch });
    } else if (type === 0x80 || (type === 0x90 && d2 === 0)) {
      text = `Note Off ch${ch} n${d1}`;
      this.onNote?.(d1, 0, false, ch);
      this.signals?.pulse('midi/note/off', { note: d1, ch, device: slug });
      if (multi) this.signals?.pulse(`midi/${slug}/note/off`, { note: d1, ch });
    } else if (type === 0xb0) {
      text = `CC ch${ch} #${d1}=${d2}`;
      this.onCC?.(d1, d2 / 127, ch);
      this.signals?.set(`midi/cc/${d1}`, d2 / 127);
      if (multi) this.signals?.set(`midi/${slug}/cc/${d1}`, d2 / 127);
    } else if (type === 0xe0) {
      const bend = (((d2 << 7) | d1) - 8192) / 8192;
      text = `Bend ch${ch} ${bend.toFixed(2)}`;
      this.signals?.set('midi/bend', bend);
      if (multi) this.signals?.set(`midi/${slug}/bend`, bend);
    } else text = `0x${status.toString(16)} ${d1} ${d2}`;
    this.log('in', text + (src ? ' ·' + src.slice(0, 14) : ''));
  }

  /** Send raw bytes out. onSend observer sees everything (single throat for meters). */
  send(bytes) {
    if (this.onSend) try { this.onSend(bytes); } catch (e) {}
    if (this.out) try { this.out.send(bytes); } catch (e) {}
  }
  noteOn(note, vel = 100, ch = 1) { this.send([0x90 | (ch - 1), note & 127, vel & 127]); }
  noteOff(note, ch = 1) { this.send([0x80 | (ch - 1), note & 127, 0]); }
  cc(cc, val, ch = 1) { this.send([0xb0 | (ch - 1), cc & 127, val & 127]); }

  /** Full panic — all notes off / all sound off / sustain off / per-note insurance.
   *  Goes through send() so observers see the sweep and meters don't show stuck notes. */
  panic() {
    for (let ch = 0; ch < 16; ch++) {
      this.send([0xb0 | ch, 123, 0]);
      this.send([0xb0 | ch, 120, 0]);
      this.send([0xb0 | ch, 64, 0]);
      for (let n = 0; n < 128; n++) this.send([0x80 | ch, n, 0]);
    }
  }
}
