// @openav/midi · manager — hardware ports ⇄ profiles ⇄ controllers.
//
//   const mcs = new MidiControllers({ signals, midi });      // midi: an enabled @openav/midi Midi (or null)
//   mcs.current                    // the controller the panel shows (virtual until hardware arrives)
//   mcs.select('akai-lpd8')        // switch the on-screen device by hand
//   mcs.assign(portSlug, 'generic-8k8p')   // an unknown device → a generic layout (+ auto-learn)
//
// Plug a MiniLab 3 in and the on-screen MiniLab 3 appears and starts moving with
// your hands (port name → profile via profile.match). Unplug it and the
// virtual one stays, still playable. One controller per profile, so a virtual
// MiniLab and a real MiniLab are the SAME object: whichever hand moves it, the
// work receives the same midi/minilab3/… signals.

import { MidiController } from './controller.js?v=8dce886';
import { matchProfile, pickPort } from './profiles.js?v=8dce886';

export class MidiControllers {
  /**
   * @param {object} o
   * @param {object[]} o.profiles             profile JSON list (packages/midi/profiles)
   * @param {import('../core/src/signals.js?v=8dce886').Signals} [o.signals]
   * @param {(name:string, value:any, info:object)=>void} [o.sink]   publish here instead (a phone → relay)
   * @param {import('./index.js?v=8dce886').Midi} [o.midi]   hardware engine (enabled or about to be)
   * @param {string} [o.initial]               profile id shown before any hardware
   * @param {Storage} [o.storage]              learned mappings & manual port assignments persist here
   */
  constructor({ profiles, signals = null, sink = null, midi = null, initial = null, storage = safeStorage() } = {}) {
    this.profiles = profiles;
    this.signals = signals; this.sink = sink; this.midi = midi; this.storage = storage;
    this.byId = new Map(profiles.map((p) => [p.id, p]));
    this.controllers = new Map();   // profile id → MidiController
    this.ports = new Map();         // input slug → { profileId, name, auto }
    this._subs = new Set();
    this.current = this.get(initial && this.byId.has(initial) ? initial : profiles[0].id);
    this.midi = null;
    if (midi) this.attach(midi);
  }

  /** Start following a hardware engine (now, or later: an embed connects only when asked). */
  attach(midi) {
    if (!midi || (midi === this.midi && this._unlisten)) return this;
    this.detach();
    this.midi = midi;
    this._unlisten = midi.listen((data, port) => this._hw(data, port));
    this._undev = midi.onDevices((devs) => this._devices(devs));
    if (midi.enabled) this._devices(midi.devices());
    return this;
  }
  /** Stop following hardware; the on-screen controllers stay, still playable. */
  detach() {
    this._unlisten?.(); this._undev?.();
    this._unlisten = this._undev = null;
    const had = this.midi && this.ports.size;
    this.midi = null; this.ports.clear();
    if (had) this._emit({ type: 'ports' });
    return this;
  }
  /** Add (or replace) a profile at runtime — one loaded from a URL, one moved to another channel. */
  register(profile) {
    const had = this.byId.has(profile.id);
    this.profiles = [...this.profiles.filter((p) => p.id !== profile.id), profile];
    this.byId.set(profile.id, profile);
    if (had && this.controllers.has(profile.id)) {
      this.controllers.delete(profile.id);
      if (this.current?.id === profile.id) this.current = this.get(profile.id);
    }
    return this;
  }

  /** The controller for a profile (created on first use, with any learned mapping restored). */
  get(profileId) {
    if (this.controllers.has(profileId)) return this.controllers.get(profileId);
    const p = this.byId.get(profileId);
    if (!p) throw new Error(`unknown MIDI profile "${profileId}"`);
    const c = new MidiController(p, { signals: this.signals, sink: this.sink, onLed: (b) => this._led(profileId, b) });
    try { const m = JSON.parse(this.storage?.getItem(this._mapKey(profileId)) || 'null'); if (m) c.applyMapping(m); } catch { /* none */ }
    c.onChange((id, st, info) => { if (info?.meta) this._saveMapping(c); });
    this.controllers.set(profileId, c);
    return c;
  }
  select(profileId) { this.current = this.get(profileId); this._emit({ type: 'select' }); return this.current; }
  onChange(fn) { this._subs.add(fn); return () => this._subs.delete(fn); }
  _emit(e) { for (const fn of this._subs) { try { fn(e, this); } catch (err) { console.error('[midi controllers]', err); } } }

  /** Hardware ports and who they drive: [{slug, name, profileId, auto, listening}] */
  devices() {
    return (this.midi?.devices() || []).map((d) => ({ ...d, profileId: this.ports.get(d.slug)?.profileId || null, auto: this.ports.get(d.slug)?.auto ?? false }));
  }
  /** Is a hardware port feeding this controller right now? → its name, else null. */
  hardwareFor(profileId) {
    for (const d of this.midi?.devices() || []) if (this.ports.get(d.slug)?.profileId === profileId && d.listening) return d.name;
    return null;
  }
  /** Route a port to a profile by hand (unknown device → generic layout), or null to un-route.
   *  persist: remember the choice for this port name (default); an embed's automatic choice does not. */
  assign(slug, profileId, { persist = true } = {}) {
    const name = this.midi?.devices().find((d) => d.slug === slug)?.name || slug;
    if (profileId) this.ports.set(slug, { profileId, name, auto: false }); else this.ports.delete(slug);
    if (persist) try { const a = JSON.parse(this.storage?.getItem('openav.midi.assign') || '{}'); if (profileId) a[name] = profileId; else delete a[name]; this.storage?.setItem('openav.midi.assign', JSON.stringify(a)); } catch { /* private mode */ }
    if (profileId) { this.select(profileId); this._sendSnapshot(profileId); }
    this._emit({ type: 'ports' });
  }

  _devices(devs) {
    let manual = {};
    try { manual = JSON.parse(this.storage?.getItem('openav.midi.assign') || '{}'); } catch { /* none */ }
    const seen = new Set();
    let first = null;
    // a device often exposes several ports (MIDI / DIN THRU / MCU): route only the best one
    const byProfile = new Map();
    for (const d of devs) {
      seen.add(d.slug);
      if (this.ports.has(d.slug) && !this.ports.get(d.slug).auto) continue;
      if (manual[d.name] && this.byId.has(manual[d.name])) { this.ports.set(d.slug, { profileId: manual[d.name], name: d.name, auto: false }); continue; }
      const m = matchProfile(d.name, this.profiles);
      if (m) (byProfile.get(m.profile.id) || byProfile.set(m.profile.id, []).get(m.profile.id)).push(d);
    }
    for (const [pid, list] of byProfile) {
      const best = pickPort(list, this.byId.get(pid)) || list[0];
      for (const d of list) if (d === best) { const was = this.ports.get(d.slug); this.ports.set(d.slug, { profileId: pid, name: d.name, auto: true }); if (!was) first ||= pid; } else this.ports.delete(d.slug);
    }
    for (const slug of [...this.ports.keys()]) if (!seen.has(slug)) this.ports.delete(slug);
    if (first) { this.select(first); this._sendSnapshot(first); }   // plug a device in → it appears on screen
    this._emit({ type: 'ports' });
  }

  _hw(data, port) {
    const r = this.ports.get(port.slug);
    if (!r) return;
    const c = this.get(r.profileId);
    c.ingest(data, { source: 'hw' });
  }

  _outputFor(profileId) {
    const p = this.byId.get(profileId), midi = this.midi;
    if (!midi?.outputs?.length) return null;
    const portName = [...this.ports.values()].find((r) => r.profileId === profileId)?.name;
    if (!portName) return null;
    return midi.outputs.find((o) => o.name === portName) || pickPort(midi.outputs, p) || null;
  }
  _led(profileId, bytes) {
    const out = this._outputFor(profileId);
    if (out) try { out.send(bytes); } catch { /* port went away */ }
  }
  _sendSnapshot(profileId) {
    const c = this.controllers.get(profileId); const out = this._outputFor(profileId);
    if (c && out) for (const b of c.ledSnapshot()) try { out.send(b); } catch { /* */ }
  }
  _mapKey(profileId) { return `openav.midi.map.${profileId}`; }
  _saveMapping(c) { try { this.storage?.setItem(this._mapKey(c.id), JSON.stringify(c.exportMapping())); } catch { /* private mode */ } }

  dispose() { this.detach(); this._subs.clear(); }
}

/** Mapper routes for "this control drives that param" — rule #1: continuous control goes through params.
 *    routes = controllerRoutes(profile, { knob1: 'hue', s1: 'size', pad1: 'burst' });
 *    routes.forEach((r) => mapper.addRoute(r));
 *  Pads route their velocity (0 on release); bind a `pulse` param to a pad and the Mapper fires it on the hit. */
export function controllerRoutes(profile, bindings, { short = profile.short, ...extra } = {}) {
  return Object.entries(bindings).map(([id, target]) => {
    const c = profile.controls.find((x) => x.id === id);
    if (!c) throw new Error(`profile ${profile.id} has no control "${id}"`);
    const r = typeof target === 'string' ? { target } : target;
    const source = c.type === 'pad' && r.on === 'hit' ? `midi/${short}/${id}/hit` : `midi/${short}/${id}`;
    return { source, ...(c.bipolar ? { inMin: -1, inMax: 1 } : {}), ...extra, ...r, target: r.target };
  });
}

function safeStorage() { try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch { return null; } }
