// @openav/midi — WebMIDI in/out for performance use.
//
// Lineage: The Last Input (2026 IRCAM) core/midi-engine.js — battle-tested on stage.
// Input: CC / Note / Bend → published as signals (midi/cc/N, midi/note/on…).
// Output: send(bytes) with an observer hook (meters), plus a proper panic().
//
// Chrome-only reality: Web MIDI is not in Safari. Performance machines run
// Chrome/Edge; audio+pose inputs cover the rest of the browsers — and the
// virtual controllers below cover "no hardware at all".
//
// Controllers (2026-10): device profiles as data, a live model per device, an
// on-screen controller that hardware animates in real time, learn mode, LED
// feedback, a Web MIDI shim for old sketches, and a phone/iPad remote tab.
//   profiles.js  validate / match / index           controller.js  MidiController
//   parse.js     bytes ⇄ events ⇄ signal names       manager.js     MidiControllers (hardware ⇄ profiles)
//   view.js      ControllerView (the faceplate)      panel.js       mountMidiPanel (header + port picker + view)
//   virtual-access.js  Web MIDI shim                 remote-tab.js  the /remote MIDI tab
// Docs: packages/midi/README.md.

import { parseMessage, genericSignals, publish, describe } from './parse.js?v=3ef3261';
export { parseMessage, encodeMessage, relativeDelta, relativeValue, bendToUnit, unitToBend, genericSignals, publish, describe, RELATIVE_MODES, BEND_CENTER } from './parse.js?v=3ef3261';
export { validateProfile, normalizeProfile, matchProfile, pickPort, profileSignals, groupsOf, indexProfile, CONTROL_TYPES, RESERVED_IDS } from './profiles.js?v=3ef3261';
export { MidiController } from './controller.js?v=3ef3261';
export { MidiControllers, controllerRoutes } from './manager.js?v=3ef3261';
export { linkControllers } from './link.js?v=3ef3261';
export { createVirtualMIDIAccess, virtualRequestMIDIAccess } from './virtual-access.js?v=3ef3261';
export { PROFILES, profileById } from './profiles/index.js?v=3ef3261';
export { ControllerView, VIEW_CSS } from './view.js?v=3ef3261';
export { mountMidiPanel, PANEL_CSS } from './panel.js?v=3ef3261';

export class Midi {
  /**
   * @param {object} opts
   * @param {import('../core/src/signals.js?v=3ef3261').Signals} [opts.signals] publish inputs here
   * @param {string} [opts.filterOut] regex source-name filter to avoid feedback loops (default: IAC)
   * @param {(opts:object)=>Promise<any>} [opts.requestAccess] where MIDIAccess comes from (default
   *        navigator.requestMIDIAccess). A host that shims Web MIDI for old sketches passes the REAL one
   *        here, so this engine never listens to the virtual port it feeds (no loops).
   */
  constructor({ signals = null, filterOut = 'IAC', requestAccess = null } = {}) {
    this.signals = signals;
    this.requestAccess = requestAccess;
    this._listeners = new Set();  // (bytes, port{slug,name,input}) — controllers, meters
    this._devSubs = new Set();    // (devices) — every subscriber, unlike the single onDeviceChange hook
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
  setListening(slug, on) { on ? this._muted.delete(slug) : this._muted.add(slug); this._devChanged(); }
  /** Subscribe to device-list changes (hot-plug, mute). Returns unsubscribe. */
  onDevices(fn) { this._devSubs.add(fn); return () => this._devSubs.delete(fn); }
  _devChanged() {
    const d = this.devices();
    this.onDeviceChange?.(d);
    for (const fn of this._devSubs) { try { fn(d); } catch (e) { console.error('[midi] devices', e); } }
  }

  log(dir, text) { if (this.onMessage) this.onMessage({ dir, text }); }

  /** Request access and wire inputs. `preferredOut` matches by exact name, then substring. */
  async enable(preferredOut = '') {
    try {
      const req = this.requestAccess || (typeof navigator !== 'undefined' && navigator.requestMIDIAccess ? (o) => navigator.requestMIDIAccess(o) : null);
      if (!req) throw new Error('this browser has no Web MIDI');
      this.access = await req({ sysex: false });
    } catch (e) { this.log('in', 'WebMIDI unavailable: ' + e.message); this._devChanged(); return false; }
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
    this._devChanged();
  }

  selectOutput(name) { const o = this.outputs.find(o => o.name === name); if (o) this.out = o; }
  /** The output port a device answers on (LED feedback): same name as its input, else a regex match. */
  outputFor(nameOrRe) {
    const re = nameOrRe instanceof RegExp ? nameOrRe : null;
    return this.outputs.find((o) => (re ? re.test(o.name || '') : o.name === nameOrRe)) || null;
  }
  /** Raw bytes from every (listened) input: (bytes, {slug, name, input}) → void. Returns unsubscribe. */
  listen(fn) { this._listeners.add(fn); return () => this._listeners.delete(fn); }

  _onIn(msg, src, slug) {
    if (slug && this._muted.has(slug)) return;
    const data = msg.data;
    for (const fn of this._listeners) { try { fn(data, { slug, name: src, input: this.inputs.find((i) => this._slugs.get(i) === slug) }); } catch (e) { console.error('[midi] listener', e); } }
    const ev = parseMessage(data);
    if (!ev) return;
    if (ev.type === 'clock') return;                         // 24 per beat — not a log line
    // generic names (parse.js genericSignals): legacy midi/note/on… + per channel midi/ch/<ch>/…
    publish(this.signals, genericSignals(ev, { device: slug }));
    // with 2+ devices, signals also publish under midi/<slug>/… so controllers
    // don't collide; single-device stays terse (midi/cc/N) — zero-config default
    const multi = this.inputs.length > 1 && slug;
    if (ev.type === 'noteon') {
      this.onNote?.(ev.note, ev.vel / 127, true, ev.ch);
      if (multi) this.signals?.pulse(`midi/${slug}/note/on`, { note: ev.note, vel: ev.vel / 127, ch: ev.ch });
    } else if (ev.type === 'noteoff') {
      this.onNote?.(ev.note, 0, false, ev.ch);
      if (multi) this.signals?.pulse(`midi/${slug}/note/off`, { note: ev.note, ch: ev.ch });
    } else if (ev.type === 'cc') {
      this.onCC?.(ev.cc, ev.value / 127, ev.ch);
      if (multi) this.signals?.set(`midi/${slug}/cc/${ev.cc}`, ev.value / 127);
    } else if (ev.type === 'pitchbend') {
      if (multi) this.signals?.set(`midi/${slug}/bend`, this.signals.get('midi/bend'));
    }
    this.log('in', describe(ev) + (src ? ' ·' + src.slice(0, 14) : ''));
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
