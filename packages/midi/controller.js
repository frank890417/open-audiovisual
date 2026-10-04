// @openav/midi · controller — one MIDI controller (a profile) as a live model.
//
// The single idea: the on-screen controller and the hardware speak the SAME
// language — MIDI bytes. Touching the virtual knob encodes the exact message
// the real knob would send and feeds it through the same ingest() the
// hardware uses. So virtual and real can never drift apart, a phone can be
// the controller for a screen across the room, and what the work receives is
// identical whichever hand moved it.
//
//   const mc = new MidiController(profile, { signals });
//   mc.ingest([0xb0, 74, 100], { source: 'hw' });   // hardware moved knob1
//   mc.setValue('knob1', 0.5);                      // a finger moved the on-screen knob1
//   mc.onChange((id, st, info) => repaint(id));     // views listen here
//
// Sources and what each publishes (so every event is published exactly once):
//   'hw'      the device lives here; @openav/midi's Midi already published the
//             generic midi/… names → this adds midi/<short>/… only
//   'ui'      a virtual controller lives here → midi/<short>/… + the generic
//             names + `midi/virtual` (the raw bytes, for Web MIDI consumers)
//   'mirror'  someone else published it (a phone over the relay, feedback) →
//             state + views only, nothing published
//
// Signals (normalised; `raw` keeps the MIDI value):
//   midi/<short>/<id>          0..1 (−1..1 for bipolar wheels)      + /raw
//   midi/<short>/<id>/delta    encoder steps (signed)
//   midi/<short>/<id>/hit      pad pulse {vel, velocity, note, ch}    + /pressure
//   midi/<short>/<keys>/on|off pulses {note, vel, velocity, ch}      midi/<short>/n<note> while held
//   midi/<short>/last          pulse {id, value, source} — the last thing touched

import { parseMessage, encodeMessage, genericSignals, relativeDelta, relativeValue, bendToUnit, unitToBend, describe } from './parse.js?v=114e448';
import { normalizeProfile, indexProfile, eventKey } from './profiles.js?v=114e448';

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
let instances = 0;

export class MidiController {
  /**
   * @param {object} profile                       raw or normalized profile JSON
   * @param {object} [o]
   * @param {import('../core/src/signals.js?v=114e448').Signals} [o.signals]   publish here…
   * @param {(name:string, value:any, info:{pulse?:boolean,min?:number,max?:number})=>void} [o.sink]  …or here (a relay)
   * @param {string} [o.short]                     override the signal namespace (two of the same device)
   * @param {(bytes:number[])=>void} [o.onLed]     LED feedback bytes for the hardware's MIDI out
   */
  constructor(profile, { signals = null, sink = null, short = null, onLed = null } = {}) {
    this.base = normalizeProfile(profile);
    this.profile = structuredCloneish(this.base);
    this.short = short || this.profile.short;
    this.signals = signals; this.sink = sink; this.onLed = onLed;
    this.uid = `c${++instances}-${Math.random().toString(36).slice(2, 6)}`;
    this.state = new Map();          // id → {value, raw, held, pressure, toggled}
    this.keys = new Map();           // note → velocity 1..127 (held keys, any keys control)
    this._subs = new Set();
    this._msgs = new Set();          // (bytes, ev, source, ids) — every message, once (MIDI out, monitors)
    this.learning = null;            // control id waiting for a hardware message
    this.autoLearn = !!this.profile.learn;
    this.learned = new Set();        // ids a human (or auto-learn) has bound on this device
    this.lastEvent = null;
    for (const c of this.profile.controls) this.state.set(c.id, initialState(c));
    // where each control sits on the faceplate (TD tools think in grid positions: Launchpad index / xPos / yPos)
    this.pos = new Map();
    for (const sec of this.profile.sections) sec.controls.forEach((id, i) => this.pos.set(id, sec.flow === 'column'
      ? { section: sec.id, index: i, col: Math.floor(i / sec.rows), row: i % sec.rows }
      : { section: sec.id, index: i, col: i % sec.cols, row: Math.floor(i / sec.cols) }));
    this._reindex();
  }

  get id() { return this.profile.id; }
  control(id) { return this.profile.controls.find((c) => c.id === id) || null; }
  get(id) { return this.state.get(id); }
  /** {group: [values…]} — the TouchDesigner tool's out CHOPs (out_knob, out_slider, out_pad…), as arrays. */
  groups() {
    const g = {};
    for (const c of this.profile.controls) { if (c.type === 'keys') continue; (g[c.group] ||= []).push(this.state.get(c.id).value); }
    return g;
  }
  onChange(fn) { this._subs.add(fn); return () => this._subs.delete(fn); }
  /** Every message that passes through, once, after state has moved: ({bytes, ev, source, ids}) → void.
   *  ids = the controls it moved (none for a message this profile does not know). Returns unsubscribe.
   *  An embed forwards source 'ui' to a MIDI output port here (one message, even if it moved two controls). */
  onMessage(fn) { this._msgs.add(fn); return () => this._msgs.delete(fn); }

  _reindex() {
    this.index = indexProfile(this.profile);
    this.keysByCh = new Map();
    for (const c of this.profile.controls) if (c.type === 'keys') this.keysByCh.set(c.ch, c);
  }

  // ------------------------------------------------------------------ in
  /** Feed MIDI bytes. Returns the parsed event (or null). */
  ingest(data, { source = 'hw' } = {}) {
    const ev = parseMessage(data);
    if (!ev || ev.type === 'clock' || ev.type === 'sysex' || ev.type === 'system') return ev;
    this.lastEvent = { ev, text: describe(ev), source, t: now() };
    if (source === 'hw' && this.learning && this._learn(ev)) return ev;
    let hits = this.index.get(eventKey(ev)) || [];
    if (!hits.length && (ev.type === 'noteon' || ev.type === 'noteoff' || ev.type === 'polyat')) {
      const k = this.keysByCh.get(ev.ch);          // keys catch any unclaimed note on their channel (octave shifts)
      if (k) hits = [{ control: k, note: ev.note }];
    }
    if (!hits.length && ev.type === 'chanat') hits = this.profile.controls.filter((c) => c.type === 'pad' && c.aftertouch === 'channel' && c.ch === ev.ch).map((c) => ({ control: c, chanat: true }));
    if (!hits.length && source === 'hw' && this.autoLearn && this._autoLearn(ev)) hits = this.index.get(eventKey(ev)) || [];
    const pub = source !== 'mirror', generic = source === 'ui';
    if (generic) {
      this._emitAll(genericSignals(ev, { device: this.short }));
      this._emit('midi/virtual', { data: Array.from(data).slice(0, 3), device: this.short, src: this.uid }, { pulse: true });
    }
    const bytes = Array.from(data);
    for (const h of hits) this._apply(h, ev, { source, pub, bytes });
    if (this._msgs.size) { const m = { bytes, ev, source, ids: hits.map((h) => h.control.id) }; for (const fn of this._msgs) { try { fn(m); } catch (e) { console.error('[midi controller]', e); } } }
    return ev;
  }

  _apply({ control: c, note, chanat }, ev, { source, pub, bytes = null }) {
    const st = this.state.get(c.id), S = `midi/${this.short}/${c.id}`;
    const out = [];
    let changed = true;
    switch (c.type) {
      case 'keys': {
        if (ev.type === 'noteon') {
          this.keys.set(note, ev.vel);
          out.push([`${S}/on`, { note, vel: ev.vel / 127, velocity: ev.vel, ch: ev.ch }, { pulse: true }], [`midi/${this.short}/n${note}`, ev.vel / 127]);
        } else if (ev.type === 'noteoff') {
          if (!this.keys.has(note)) changed = false;
          this.keys.delete(note);
          out.push([`${S}/off`, { note, ch: ev.ch }, { pulse: true }], [`midi/${this.short}/n${note}`, 0]);
        } else if (ev.type === 'polyat') out.push([`midi/${this.short}/n${note}/pressure`, ev.value / 127]);
        st.value = this.keys.size ? 1 : 0; st.raw = ev.vel ?? st.raw; st.note = note;
        break;
      }
      case 'pad': {
        if (chanat || ev.type === 'polyat') {
          if (chanat && !st.held) { changed = false; break; }
          st.pressure = ev.value / 127; out.push([`${S}/pressure`, st.pressure]);
          break;
        }
        const on = ev.type === 'noteon' || (ev.type === 'cc' && ev.value > 0);
        const vel = ev.type === 'cc' ? ev.value : ev.vel;
        st.held = on; st.raw = on ? vel : 0; st.value = on ? vel / 127 : 0; if (!on) st.pressure = 0;
        out.push([S, st.value], [`${S}/raw`, st.raw, { min: 0, max: 127 }]);
        if (on) out.push([`${S}/hit`, { vel: vel / 127, velocity: vel, note: c.msg === 'note' ? c.note : null, ch: c.ch }, { pulse: true }]);
        break;
      }
      case 'button': {
        const on = ev.type === 'noteon' || (ev.type === 'cc' && ev.value >= 64);
        if (c.mode === 'toggle' && source === 'ui') { /* ui toggles already flipped st.toggled before encoding */ }
        st.held = on; st.raw = ev.type === 'cc' ? ev.value : (on ? ev.vel : 0); st.value = on ? 1 : 0;
        out.push([S, st.value], [`${S}/raw`, st.raw, { min: 0, max: 127 }]);
        break;
      }
      case 'encoder': {
        if (c.relative) {
          const d = relativeDelta(ev.value, c.relative);
          st.pos = clamp(st.pos + d * (c.sensitivity ?? 1 / 100)); st.value = st.pos; st.raw = ev.value; st.turns = (st.turns || 0) + d;
          out.push([S, st.value], [`${S}/raw`, st.raw, { min: 0, max: 127 }], [`${S}/delta`, d, { min: -64, max: 64 }]);
        } else {
          st.value = st.pos = ev.value / 127; st.raw = ev.value;
          out.push([S, st.value], [`${S}/raw`, st.raw, { min: 0, max: 127 }]);
        }
        break;
      }
      default: { // knob fader wheel strip
        if (ev.type === 'pitchbend') {
          st.raw = ev.value; st.value = c.bipolar ? bendToUnit(ev.value) : ev.value / 16383;
          out.push([S, st.value, c.bipolar ? { min: -1, max: 1 } : {}], [`${S}/raw`, st.raw, { min: 0, max: 16383 }]);
        } else if (ev.type === 'cc' || ev.type === 'chanat') {
          st.raw = ev.value; st.value = c.bipolar ? (ev.value - 64) / (ev.value >= 64 ? 63 : 64) : ev.value / 127;
          out.push([S, st.value, c.bipolar ? { min: -1, max: 1 } : {}], [`${S}/raw`, st.raw, { min: 0, max: 127 }]);
        } else if (ev.type === 'noteon' || ev.type === 'noteoff') { // a note-mapped wheel/strip is unusual, but be total
          st.raw = ev.vel; st.value = ev.vel / 127; out.push([S, st.value]);
        } else changed = false;
      }
    }
    if (!changed) return;
    if (pub) {
      for (const [n, v, info] of out) this._emit(n, v, info || {});
      this._emit(`midi/${this.short}/last`, { id: c.id, value: st.value, note: note ?? null, source, ...this.pos.get(c.id) }, { pulse: true });
    }
    this._led(c, st, note);
    for (const fn of this._subs) { try { fn(c.id, st, { source, ev, note, bytes }); } catch (e) { console.error('[midi controller]', e); } }
  }

  _emit(name, value, { pulse = false, min = 0, max = 1 } = {}) {
    if (this.sink) { try { this.sink(name, value, { pulse, min, max }); } catch (e) { console.error('[midi sink]', e); } return; }
    const s = this.signals; if (!s) return;
    if (!s.meta.has(name)) s.define(name, pulse ? { kind: 'pulse', source: 'midi' } : { min, max, source: 'midi' });
    if (pulse) s.pulse(name, value); else s.set(name, value);
  }
  _emitAll(list) { for (const x of list) this._emit(x.name, x.value, x); }

  // ------------------------------------------------------------------ virtual hands
  // Each of these ENCODES what the real control would send and ingests it.
  // They return the bytes (the panel forwards them to a relay or a Web MIDI shim).
  _send(ev, source = 'ui') { const b = encodeMessage(ev); if (b) this.ingest(b, { source }); return b; }

  /** Absolute controls (knob, fader, wheel/strip, absolute encoder): v in 0..1 (−1..1 bipolar). */
  setValue(id, v, { source = 'ui' } = {}) {
    const c = this.control(id); if (!c) return null;
    if (c.type === 'encoder' && c.relative) { const st = this.state.get(id); return this.turn(id, Math.round((clamp(v) - st.pos) / (c.sensitivity ?? 1 / 100)), { source }); }
    if (c.msg === 'pitchbend') return this._send({ type: 'pitchbend', ch: c.ch, value: c.bipolar ? unitToBend(clamp(v, -1, 1)) : Math.round(clamp(v) * 16383) }, source);
    const raw = c.bipolar ? Math.round(64 + clamp(v, -1, 1) * (v >= 0 ? 63 : 64)) : Math.round(clamp(v) * 127);
    if (raw === this.state.get(id).raw && source === 'ui') return null;
    if (c.msg === 'chanat') return this._send({ type: 'chanat', ch: c.ch, value: raw }, source);
    return this._send({ type: 'cc', ch: c.ch, cc: c.cc, value: raw }, source);
  }
  /** Endless encoder: signed steps. */
  turn(id, steps, { source = 'ui' } = {}) {
    const c = this.control(id); if (!c || !steps) return null;
    if (!c.relative) return this.setValue(id, clamp(this.state.get(id).pos + steps / 127), { source });
    let last = null, left = Math.round(steps);
    while (left) { const d = Math.max(-63, Math.min(63, left)); last = this._send({ type: 'cc', ch: c.ch, cc: c.cc, value: relativeValue(d, c.relative) }, source); left -= d; }
    return last;
  }
  /** Pads, buttons, keys: press with velocity 0..1 (keys/pads: which note). */
  press(id, vel = 1, note = null, { source = 'ui' } = {}) {
    const c = this.control(id); if (!c) return null;
    const v = Math.max(1, Math.min(127, Math.round(vel * 127)));
    if (c.type === 'keys') return this._send({ type: 'noteon', ch: c.ch, note: note ?? c.from, vel: v }, source);
    if (c.type === 'button' && c.mode === 'toggle') {
      const st = this.state.get(id); const on = !st.held;
      return c.msg === 'note' ? this._send({ type: on ? 'noteon' : 'noteoff', ch: c.ch, note: c.note, vel: on ? 127 : 0 }, source)
        : this._send({ type: 'cc', ch: c.ch, cc: c.cc, value: on ? 127 : 0 }, source);
    }
    if (c.msg === 'note') return this._send({ type: 'noteon', ch: c.ch, note: c.note, vel: c.type === 'button' ? 127 : v }, source);
    if (c.msg === 'cc') return this._send({ type: 'cc', ch: c.ch, cc: c.cc, value: c.type === 'button' ? 127 : v }, source);
    return null;
  }
  release(id, note = null, { source = 'ui' } = {}) {
    const c = this.control(id); if (!c) return null;
    if (c.type === 'keys') return this._send({ type: 'noteoff', ch: c.ch, note: note ?? c.from }, source);
    if (c.type === 'button' && c.mode === 'toggle') return null;
    if (c.msg === 'note') return this._send({ type: 'noteoff', ch: c.ch, note: c.note }, source);
    if (c.msg === 'cc') return this._send({ type: 'cc', ch: c.ch, cc: c.cc, value: 0 }, source);
    return null;
  }
  /** Pad/key pressure (poly aftertouch, or channel pressure when the profile says so). */
  pressure(id, v, note = null, { source = 'ui' } = {}) {
    const c = this.control(id); if (!c || !c.aftertouch) return null;
    const value = Math.round(clamp(v) * 127);
    if (c.aftertouch === 'channel') return this._send({ type: 'chanat', ch: c.ch, value }, source);
    return this._send({ type: 'polyat', ch: c.ch, note: note ?? c.note, value }, source);
  }
  /** Spring-loaded wheels go home (pitch bend → centre). */
  rest(id, { source = 'ui' } = {}) { const c = this.control(id); if (c && c.spring) return this.setValue(id, c.bipolar ? 0 : (c.rest ?? 0), { source }); return null; }
  /** Let go of everything the virtual hands hold (blur, page hide, octave change). */
  releaseAll({ source = 'ui' } = {}) {
    for (const n of [...this.keys.keys()]) { const k = [...this.keysByCh.values()][0]; if (k) this.release(k.id, n, { source }); }
    for (const c of this.profile.controls) { const st = this.state.get(c.id); if (st.held && (c.type === 'pad' || (c.type === 'button' && c.mode !== 'toggle'))) this.release(c.id, null, { source }); }
  }
  /** Apply a value that arrived from elsewhere (relay feedback) without publishing. */
  mirror(id, value) {
    const c = this.control(id); if (!c || typeof value !== 'number') return;
    if (['knob', 'fader', 'wheel', 'strip'].includes(c.type) || (c.type === 'encoder' && !c.relative)) this.setValue(id, value, { source: 'mirror' });
    else if (c.type === 'encoder') { const st = this.state.get(id); st.pos = st.value = clamp(value); for (const fn of this._subs) fn(id, st, { source: 'mirror' }); }
    else if (c.type === 'button' && c.mode === 'toggle') { const st = this.state.get(id); if ((value > 0.5) !== !!st.held) this.press(id, 1, null, { source: 'mirror' }); }
  }

  // ------------------------------------------------------------------ LEDs
  /** Bytes that light (or dim) one control's LED on the hardware, from its state. */
  ledBytes(c, st = this.state.get(c.id), note = null) {
    const L = c.led; if (!L) return null;
    const lit = c.type === 'button' ? !!st.held : c.type === 'keys' ? this.keys.has(note) : st.held || st.value > 0;
    const val = lit ? (L.on ?? (c.type === 'pad' && L.velocity ? st.raw : 127)) : (L.off ?? 0);
    const ch = L.ch ?? c.ch;
    if (L.msg === 'cc') return encodeMessage({ type: 'cc', ch, cc: L.cc ?? c.cc, value: val });
    const n = L.note ?? (c.type === 'keys' ? note : c.note);
    return encodeMessage(val > 0 || L.off !== undefined ? { type: 'noteon', ch, note: n, vel: val } : { type: 'noteoff', ch, note: n });
  }
  _led(c, st, note) { if (c.led && this.onLed) { const b = this.ledBytes(c, st, note); if (b) this.onLed(b); } }
  /** Every LED at its current state — send once when the hardware connects (idle colours). */
  ledSnapshot() { return this.profile.controls.filter((c) => c.led && c.type !== 'keys').map((c) => this.ledBytes(c)).filter(Boolean); }

  // ------------------------------------------------------------------ learn
  /** Arm learn for one control: the next hardware message of a compatible kind is bound to it. */
  learn(id) { this.learning = this.learning === id ? null : id; this._notifyMeta(); return this.learning; }
  _compatible(c, ev) {
    if (c.type === 'keys' || c.type === 'pad') return ev.type === 'noteon' || (c.type === 'pad' && ev.type === 'cc');
    if (c.type === 'button') return ev.type === 'noteon' || ev.type === 'cc';
    if (c.type === 'wheel' || c.type === 'strip') return ev.type === 'cc' || ev.type === 'pitchbend' || ev.type === 'chanat';
    return ev.type === 'cc';
  }
  _learn(ev) {
    const c = this.control(this.learning);
    if (!c || !this._compatible(c, ev)) return false;
    this.bindMessage(c.id, ev);
    this.learning = null; this._notifyMeta();
    return false; // let the same message also move the control, so the learn feels instant
  }
  /** Generic layouts: an unknown message takes the next unlearned control that can carry it. */
  _autoLearn(ev) {
    if (!(ev.type === 'cc' || ev.type === 'noteon' || ev.type === 'pitchbend')) return false;
    const c = this.profile.controls.find((x) => !this.learned.has(x.id) && x.type !== 'keys' && this._compatible(x, ev) && (ev.type !== 'cc' || x.type !== 'pad'));
    if (!c) return false;
    this.bindMessage(c.id, ev);
    return true;
  }
  /** Rebind a control to the message `ev` (swapping with whoever had it). */
  bindMessage(id, ev) {
    const c = this.control(id); if (!c) return;
    const want = ev.type === 'pitchbend' ? { msg: 'pitchbend', ch: ev.ch } : ev.type === 'chanat' ? { msg: 'chanat', ch: ev.ch }
      : ev.type === 'cc' ? { msg: 'cc', ch: ev.ch, cc: ev.cc } : { msg: 'note', ch: ev.ch, note: ev.note };
    const old = { msg: c.msg, ch: c.ch, cc: c.cc, note: c.note, from: c.from, to: c.to };
    const holder = this.profile.controls.find((x) => x !== c && x.type !== 'keys' && x.msg === want.msg && x.ch === want.ch && (want.msg !== 'cc' || x.cc === want.cc) && (want.msg !== 'note' || x.note === want.note));
    if (c.type === 'keys') { const span = c.to - c.from; Object.assign(c, { ch: ev.ch, from: ev.note, to: Math.min(127, ev.note + span) }); }
    else { delete c.cc; delete c.note; Object.assign(c, want); }
    if (holder) { delete holder.cc; delete holder.note; Object.assign(holder, { msg: old.msg, ch: old.ch, ...(old.cc !== undefined ? { cc: old.cc } : {}), ...(old.note !== undefined ? { note: old.note } : {}) }); }
    this.learned.add(id);
    this._reindex();
    this._notifyMeta();
  }
  /** Learned bindings as JSON (persist per device: localStorage, a file, the work's meta). */
  exportMapping() {
    const m = {};
    for (const c of this.profile.controls) {
      const b = this.base.controls.find((x) => x.id === c.id);
      const pick = ({ msg, ch, cc, note, from, to }) => JSON.stringify({ msg, ch, cc, note, from, to });
      if (pick(c) !== pick(b)) m[c.id] = JSON.parse(pick(c));
    }
    return m;
  }
  applyMapping(m = {}) {
    for (const [id, b] of Object.entries(m || {})) {
      const c = this.control(id); if (!c || !b) continue;
      delete c.cc; delete c.note;
      Object.assign(c, Object.fromEntries(Object.entries(b).filter(([, v]) => v !== undefined && v !== null)));
      this.learned.add(id);
    }
    this._reindex(); this._notifyMeta();
  }
  resetMapping() { this.profile = structuredCloneish(this.base); this.learned.clear(); this._reindex(); this._notifyMeta(); }
  _notifyMeta() { for (const fn of this._subs) { try { fn(null, null, { meta: true }); } catch (e) { console.error(e); } } }
}

function initialState(c) {
  if (c.type === 'encoder') { const p = c.def ?? (c.relative ? 0.5 : 0); return { value: p, pos: p, raw: c.relative ? 64 : 0, held: false, pressure: 0, turns: 0 }; }
  return { value: c.def ?? 0, raw: c.bipolar ? (c.msg === 'pitchbend' ? 8192 : 64) : 0, held: false, pressure: 0, pos: 0 };
}
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
const structuredCloneish = (o) => JSON.parse(JSON.stringify(o));
