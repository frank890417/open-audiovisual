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
//   embed.js     options, event payloads, postMessage   element.js     <oav-controller> (not imported here:
//   createController() below: one controller, its events, hardware and MIDI out — the headless embed
// Docs: packages/midi/README.md.                                         load it with its own <script>)

import { parseMessage, genericSignals, publish, describe } from './parse.js?v=2cd2e50';
import { MidiControllers } from './manager.js?v=2cd2e50';
import { ControllerView } from './view.js?v=2cd2e50';
import { PROFILES } from './profiles/index.js?v=2cd2e50';
import { track } from './telemetry.js?v=2cd2e50';
import { resolveProfile, findProfile, withChannel, findPort, controlDetail, setControl, valuesOf, restValue } from './embed.js?v=2cd2e50';
export { parseMessage, encodeMessage, relativeDelta, relativeValue, bendToUnit, unitToBend, genericSignals, publish, describe, RELATIVE_MODES, BEND_CENTER } from './parse.js?v=2cd2e50';
export { validateProfile, normalizeProfile, matchProfile, pickPort, profileSignals, groupsOf, indexProfile, CONTROL_TYPES, RESERVED_IDS } from './profiles.js?v=2cd2e50';
export { MidiController } from './controller.js?v=2cd2e50';
export { MidiControllers, controllerRoutes } from './manager.js?v=2cd2e50';
export { linkControllers } from './link.js?v=2cd2e50';
export { createVirtualMIDIAccess, virtualRequestMIDIAccess } from './virtual-access.js?v=2cd2e50';
export { PROFILES, profileById } from './profiles/index.js?v=2cd2e50';
export { ControllerView, VIEW_CSS } from './view.js?v=2cd2e50';
export { mountMidiPanel, PANEL_CSS } from './panel.js?v=2cd2e50';
export { parseEmbedOptions, resolveProfile, controlDetail, describeDetail, describeMessage, setControl, valuesOf, findPort, preferredAspect,
  toParent, fromParent, toFrame, fromFrame, EMBED_ATTRS, EMBED_EVENTS, FRAME_COMMANDS, POST_SOURCE } from './embed.js?v=2cd2e50';

export class Midi {
  /**
   * @param {object} opts
   * @param {import('../core/src/signals.js?v=2cd2e50').Signals} [opts.signals] publish inputs here
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

  /** Let go of every port and listener (an embed removed from the page). The MIDIAccess itself is the browser's. */
  dispose() {
    for (const i of this.inputs) { try { if (i.onmidimessage) i.onmidimessage = null; } catch { /* port gone */ } }
    if (this.access) this.access.onstatechange = null;
    this._listeners.clear(); this._devSubs.clear();
    this.inputs = []; this.outputs = []; this.out = null; this.access = null; this.enabled = false;
  }

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

// ------------------------------------------------------------------ embedding: one controller, five lines
//
//   import { createController } from 'https://openaudiovisual.com/packages/midi/index.js';
//   const ctl = createController('akai-lpd8');                 // id, short name, or a profile object
//   ctl.mount(document.querySelector('#pads'));                // the playable faceplate (optional — headless works)
//   ctl.on('control', (e) => console.log(e.signal, e.value));  // every knob, pad, key, from screen or hardware
//   ctl.connectHardware();                                      // follow the real LPD8 (asks for Web MIDI)
//
// <oav-controller> (element.js) and /embed/controller/ are thin shells over this.

// One Web MIDI engine per page for embeds: one permission prompt, one listener per port, however many
// controllers the page holds. Its input filter is the Midi default 'IAC' — the macOS bus you send INTO
// Ableton / TouchDesigner is never listened to, so MIDI out can never loop back in.
const SHARED = { midi: null, users: 0, ready: null };
function acquireShared() {
  if (!SHARED.midi) SHARED.midi = new Midi();
  SHARED.users++;
  if (!SHARED.midi.enabled && !SHARED.ready) SHARED.ready = SHARED.midi.enable().then((ok) => { if (!ok) SHARED.ready = null; return ok; });
  return SHARED.ready || Promise.resolve(SHARED.midi.enabled);
}
function releaseShared() {
  if (--SHARED.users > 0 || !SHARED.midi) return;
  SHARED.midi.dispose(); SHARED.midi = null; SHARED.users = 0; SHARED.ready = null;
}
const hasWebMidi = () => typeof navigator !== 'undefined' && typeof navigator.requestMIDIAccess === 'function';
const SOURCE_IN = { hardware: 'hw', hw: 'hw', ui: 'ui', quiet: 'mirror', mirror: 'mirror' };

/** Load a profile by id, short name or URL (a profile JSON anywhere CORS allows). */
export function loadProfile(ref, o = {}) { return resolveProfile(ref, { profiles: PROFILES, base: typeof document !== 'undefined' ? document.baseURI : undefined, ...o }); }

/**
 * One MIDI controller you can play, listen to, and point at hardware or a DAW.
 * Events (ctl.on(name, fn) → unsubscribe): control · noteon · noteoff · connect · disconnect · status · profilechange
 * @param {string|object} profile        id ('akai-lpd8'), short ('lpd8') or a profile object (loadProfile() for URLs)
 * @param {object} [o]
 * @param {object[]} [o.profiles]        the profiles a picker / `follow` may switch to (default: every shipped one)
 * @param {import('../core/src/signals.js?v=2cd2e50').Signals} [o.signals]   also publish midi/<short>/… into a show
 * @param {number} [o.channel]           move every control to this MIDI channel (your unit is set to another one)
 * @param {boolean} [o.follow]           plug a different known device in → show that one
 * @param {Midi} [o.midi]                use this engine (a show's) instead of the page-shared one
 * @param {(o:object)=>Promise<any>} [o.requestAccess]   where MIDIAccess comes from (tests, shims)
 */
export function createController(profile = 'arturia-minilab3', o = {}) { return new ControllerHost(profile, o); }

export class ControllerHost {
  constructor(profile = 'arturia-minilab3', { profiles = PROFILES, signals = null, sink = null, channel = null, follow = false, midi = null, requestAccess = null, filterOut = 'IAC', storage = undefined, telemetry = true, embedKind = 'headless' } = {}) {
    const base = typeof profile === 'string' ? findProfile(profile, profiles) : profile;
    if (!base) throw new Error(`unknown MIDI profile "${profile}" (known: ${profiles.map((p) => p.id).join(', ')})`);
    this.channel = channel || null;
    this._chan = new Set();
    const p = this.channel ? withChannel(base, this.channel) : base;
    if (this.channel) this._chan.add(p.id);
    this.follow = !!follow;
    this.controllers = new MidiControllers({ profiles: [p, ...profiles.filter((x) => x.id !== p.id)], signals, sink, initial: p.id, storage });
    this.profileId = p.id;
    this.midi = null;            // the Web MIDI engine, once hardware or MIDI out is on
    this.output = null;          // the output port what you play is sent to
    this.view = null;
    this.learning = false;
    this.status = { hardware: 'off', input: null, output: null, outputState: 'off' };
    this._opt = { midi, requestAccess, filterOut };
    this._subs = new Map();
    this._hwOn = false; this._hwName = null; this._hwProfile = null; this._outQuery = null; this._keep = false;
    // one anonymous hit per page: which kind of embed, which device (telemetry.js says exactly what and how to turn it off)
    this._tele = { enabled: telemetry !== false, kind: embedKind };
    this._offMgr = this.controllers.onChange((e) => this._onManager(e));
    this._watch();
    track('oav_embed_load', { oav_kind: embedKind, oav_profile: this.profileId }, { enabled: this._tele.enabled });
  }

  /** The live model (MidiController) of the device on screen. */
  get controller() { return this.controllers.get(this.profileId); }
  /** Its normalized profile (controls, faceplate, sources). */
  get profile() { return this.controller.profile; }

  // ---------------------------------------------------------------- events
  /** Subscribe: 'control' | 'noteon' | 'noteoff' | 'connect' | 'disconnect' | 'status' | 'profilechange' | '*' (name, detail). */
  on(name, fn) { if (!this._subs.has(name)) this._subs.set(name, new Set()); this._subs.get(name).add(fn); return () => this._subs.get(name)?.delete(fn); }
  _emit(name, detail) {
    for (const fn of this._subs.get(name) || []) { try { fn(detail); } catch (e) { console.error('[oav controller]', name, e); } }
    for (const fn of this._subs.get('*') || []) { try { fn(name, detail); } catch (e) { console.error('[oav controller]', e); } }
  }
  _status(patch) { Object.assign(this.status, patch); this._emit('status', { ...this.status, profile: this.profileId }); }

  _watch() {
    this._offC?.(); this._offM?.();
    const c = this.controller;
    this._offC = c.onChange((id, st, info) => {
      if (!id || info?.meta || info?.source === 'mirror') return;
      const d = controlDetail(c, id, st, info);
      this._emit('control', d);
      const t = info.ev?.type;
      if (t === 'noteon' || t === 'noteoff') this._emit(t, d);
    });
    // what a hand plays here leaves through the output port; hardware moves do not (your DAW already hears the device)
    this._offM = c.onMessage(({ bytes, source }) => { if (source === 'ui' && this.output) this.send(bytes); });
  }

  // ---------------------------------------------------------------- play
  /** Move a control like a hand would (see embed.js setControl). quiet: only the faceplate moves — no event, no MIDI out. */
  set(id, value, { note = null, quiet = false } = {}) { return setControl(this.controller, id, value, { note, source: quiet ? 'mirror' : 'ui' }); }
  press(id, velocity = 1, note = null) { return this.controller.press(id, velocity, note); }
  release(id, note = null) { return this.controller.release(id, note); }
  /** Current value of one control (0..1, −1..1 bipolar), or null. */
  get(id) { const st = this.controller.get(id); return st ? st.value : null; }
  /** { id: value } for every control. */
  values() { return valuesOf(this.controller); }
  /** Let go of everything and bring every control home (sends what a hand would, unless quiet). */
  reset({ quiet = false } = {}) {
    const c = this.controller, source = quiet ? 'mirror' : 'ui';
    c.releaseAll({ source });
    for (const x of c.profile.controls) {
      if (x.type === 'keys' || x.type === 'pad' || (x.type === 'button' && x.mode !== 'toggle')) continue;
      if (x.type === 'encoder' && x.relative) { c.mirror(x.id, restValue(x)); continue; }   // endless: no position to send
      setControl(c, x.id, restValue(x), { source });
    }
  }
  /** Let go of every held pad and key (blur, page hide): the DAW gets its note-offs. */
  releaseAll() { this.controller.releaseAll(); }
  /** MIDI arriving from anywhere (a WebSocket, another page, a port you manage): the faceplate follows.
   *  One message ([0xb0, 74, 64]) or a list of them. source 'hardware' (default) | 'ui' | 'quiet'. */
  ingest(bytes, { source = 'hardware' } = {}) {
    const s = SOURCE_IN[source] || 'hw';
    if (Array.isArray(bytes) && Array.isArray(bytes[0])) return bytes.map((b) => this.controller.ingest(b, { source: s }));
    return this.controller.ingest(bytes, { source: s });
  }
  /** Raw bytes out of the MIDI output port (if one is open). → sent? */
  send(bytes) {
    if (!this.output) return false;
    try { this.output.send(bytes); return true; } catch { return false; }
  }

  // ---------------------------------------------------------------- screen
  /** Draw the playable faceplate into `el` (it fills el and follows its size). */
  mount(el, { layout = 'auto' } = {}) {
    this.view?.dispose();
    this.view = new ControllerView(el, this.controller, { mode: layout });
    if (this.learning) this.view.setLearning(true);
    return this.view;
  }
  setLayout(layout) { this.view?.setMode(layout); }
  /** Learn mode: tap a control on screen, then move the one on your hardware (or ingest() it). */
  learn(on = !this.learning) {
    this.learning = !!on;
    if (!on) this.controller.learning = null;
    this.view?.setLearning(this.learning);
    return this.learning;
  }

  /** Show another device: id, short name, URL, or profile object. */
  async setProfile(ref) {
    const known = typeof ref === 'string' ? findProfile(ref, this.controllers.profiles) : null;
    let p = known || (await resolveProfile(ref, { profiles: this.controllers.profiles, base: typeof document !== 'undefined' ? document.baseURI : undefined }));
    if (this.channel && !this._chan.has(p.id)) { p = withChannel(p, this.channel); this._chan.add(p.id); this.controllers.register(p); }
    else if (!known) this.controllers.register(p);
    return this._show(p.id);
  }
  _show(id) {
    if (id === this.profileId) return this.controller;
    try { this.controller.releaseAll(); } catch { /* */ }    // a held note must not hang when the device changes
    this.profileId = id;
    this._selecting = true; this.controllers.select(id); this._selecting = false;
    this._watch();
    this.view?.setController(this.controller);
    if (this.learning) this.view?.setLearning(true);
    this._emit('profilechange', { profile: id, name: this.profile.name });
    this._autoAssign(); this._hwCheck();
    return this.controller;
  }
  _onManager(e) {
    if (e.type === 'select' && !this._selecting && this.follow && this.controllers.current.id !== this.profileId) this._show(this.controllers.current.id);
    if (e.type === 'ports') { this._autoAssign(); this._hwCheck(); }
  }

  // ---------------------------------------------------------------- hardware
  /** Follow the real device: its port drives the on-screen one (asks for Web MIDI). → connected? */
  async connectHardware(port = null) {
    this._hwOn = true;
    this._hwPort = port || null;           // a port name / /regex/ to route here by hand (an unknown or renamed device)
    this._status({ hardware: 'asking' });
    const midi = await this._engine();
    if (!this._hwOn) return false;                         // switched off while the browser was asking
    if (!midi) { this._status({ hardware: this._noMidi() }); return false; }
    this.controllers.attach(midi);
    this._autoAssign(); this._hwCheck();
    this._status({ hardware: this._hwName ? 'connected' : 'waiting', input: this._hwName });
    return true;
  }
  disconnectHardware() {
    this._hwOn = false;
    this.controllers.detach();
    this._hwCheck();
    this._status({ hardware: 'off', input: null });
    this._release();
  }
  /** A generic layout on screen + a device nobody recognises → that device plays this layout (auto-learn fills it). */
  _autoAssign() {
    if (!this._hwOn || !this.controllers.midi) return;
    const devs = this.controllers.devices();
    if (devs.some((d) => d.profileId === this.profileId)) return;
    if (this._hwPort) { const d = findPort(devs, this._hwPort); if (d) this.controllers.assign(d.slug, this.profileId, { persist: false }); return; }
    if (this.profile.kind !== 'generic') return;
    const free = devs.find((d) => !d.profileId && d.listening && d.name !== this.output?.name);
    if (free) this.controllers.assign(free.slug, this.profileId, { persist: false });
  }
  _hwCheck() {
    const name = this.controllers.midi ? this.controllers.hardwareFor(this.profileId) : null;
    if (name !== this._hwName || (name && this._hwProfile !== this.profileId)) {
      if (this._hwName) this._emit('disconnect', { port: this._hwName, profile: this._hwProfile });
      if (name) {
        this._emit('connect', { port: name, profile: this.profileId });
        track('oav_hardware_connect', { oav_kind: this._tele.kind, oav_profile: this.profileId }, { enabled: this._tele.enabled });
      }
    }
    this._hwName = name; this._hwProfile = this.profileId;
    if (this._hwOn && this.midi) this._status({ hardware: name ? 'connected' : 'waiting', input: name });
  }

  // ---------------------------------------------------------------- MIDI out
  /** Ask for Web MIDI without connecting anything (an output picker needs the port list). → the output names */
  async requestMidi() { this._keep = true; const m = await this._engine(); if (!m) this._status({ outputState: this._noMidi() }); return this.outputs(); }
  /** Output port names, once Web MIDI is on. */
  outputs() { return (this.midi?.outputs || []).map((o) => o.name); }
  /** Send what is played here to a MIDI output: a name, a substring ('IAC', 'loopMIDI') or '/regex/'. null = off. */
  async setOutput(query) {
    this._outQuery = query || null;
    if (!query) { this.output = null; this._status({ output: null, outputState: 'off' }); this._release(); return null; }
    this._status({ outputState: 'asking' });
    const midi = await this._engine();
    if (this._outQuery !== query) return this.output?.name || null;
    if (!midi) { this._status({ outputState: this._noMidi() }); return null; }
    this._matchOutput();
    return this.output?.name || null;
  }
  _matchOutput() {
    if (!this.midi || !this._outQuery) return;
    const port = findPort(this.midi.outputs, this._outQuery);
    if (port !== this.output) { try { this.controller.releaseAll(); } catch { /* */ } this.output = port; }
    // an input with the output's name is the same virtual cable coming back (loopMIDI): never listen to it
    if (port) { const loop = this.midi.devices().find((d) => d.name === port.name); if (loop && loop.listening) this.midi.setListening(loop.slug, false); }
    if (this.status.output !== (port?.name || null) || this.status.outputState !== (port ? 'open' : 'missing')) this._status({ output: port?.name || null, outputState: port ? 'open' : 'missing' });
  }

  async _engine() {
    if (this.midi?.enabled) return this.midi;
    const { midi, requestAccess, filterOut } = this._opt;
    let m = null;
    if (midi) { if (!midi.enabled) await midi.enable(); m = midi.enabled ? midi : null; }
    else if (requestAccess || filterOut !== 'IAC') {
      this._ownEngine ||= new Midi({ requestAccess, filterOut });
      if (!this._ownEngine.enabled) await this._ownEngine.enable();
      m = this._ownEngine.enabled ? this._ownEngine : null;
    } else {
      if (!this._shared) this._shared = true; else SHARED.users--;     // one reference per host
      m = (await acquireShared()) ? SHARED.midi : null;
    }
    if (m && m !== this.midi) {
      this.midi = m;
      this._offDev?.();
      this._offDev = m.onDevices(() => this._matchOutput());   // hot-plug: the output port may come (back) later
    }
    return m;
  }
  _noMidi() { return hasWebMidi() || this._opt.requestAccess ? 'denied' : 'unavailable'; }
  _release() {
    if (this._hwOn || this._outQuery || this._keep) return;
    this._offDev?.(); this._offDev = null;
    if (this._shared) { this._shared = false; releaseShared(); }
    this.midi = null;
  }

  /** Remove everything this controller added: listeners, the view, its share of the MIDI engine. Held notes are released first. */
  dispose() {
    try { this.controller.releaseAll(); } catch { /* */ }
    this._offC?.(); this._offM?.(); this._offMgr?.(); this._offDev?.();
    this.view?.dispose(); this.view = null;
    this.controllers.dispose();
    this.output = null; this._outQuery = null; this._hwOn = false; this._keep = false;
    if (this._shared) { this._shared = false; releaseShared(); }
    this._ownEngine?.dispose(); this._ownEngine = null;
    this.midi = null; this._subs.clear();
  }
}
