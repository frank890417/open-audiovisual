// @openav/midi · canvas — a controller drawn into a 2D canvas, every frame, for video.
//
// The on-screen controller (view.js) is DOM: perfect to play, impossible to record (a page
// cannot capture its own DOM into a video). This draws the same faceplate — every section
// where it sits on the device, the same colours — straight into any 2D context, at any size.
// It is vector, drawn at the output size, so the bottom of a 2160 px wide 4K frame is as sharp
// as a 1080 one, and it costs a few hundred path calls a frame (well under a millisecond).
//
//   const panel = new ControllerCanvas({ profile: 'arturia-minilab3', signals });
//   panel.draw(ctx, { x: 0, y: 1080, w: 1080, h: 840 });   // each frame (performance.now() for the fades)
//   compositor.setPanel(panel);                            // @openav/record: the panel takes the camera's place
//
// Where the state comes from:
//   signals     (default) the generic MIDI names on a Signals bus — midi/ch/<ch>/…, midi/note/on|off,
//               midi/cc/<n>, midi/bend — turned back into bytes for a private, silent MidiController.
//               The hardware, the on-screen controller, the QWERTY piano, a phone AND a take playing
//               back (a TakePlayer publishes the same names) all move it, so a replayed clip animates
//               the panel exactly like the hands did.
//   controller  follow an existing MidiController instead (one device exactly, its learned mapping);
//               a take never reaches a controller's bytes, so playback does not move this one.
//
// What a video needs that a screen does not: a touch has to stay visible for a few frames
// (30 fps = 33 ms; a staccato note can be shorter), so released keys and pads fade instead
// of switching off, and the control a hand just moved glows for a moment. The device's own
// screen (MiniLab 3, KeyStep) shows the last thing touched, as the hardware's screen does;
// under the faceplate, when the area has room, the notes being held are written out large.

import { encodeMessage, eventOfSignal } from './parse.js?v=e353777';
import { MidiController } from './controller.js?v=e353777';
import { profileById } from './profiles/index.js?v=e353777';
import { CONTROL_COLORS } from './view.js?v=e353777';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const BLACK_KEYS = new Set([1, 3, 6, 8, 10]);
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const isWhiteKey = (n) => !BLACK_KEYS.has(((n % 12) + 12) % 12);
const defaultNow = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/** MIDI note → name, middle C = C4 (the on-screen keyboard's convention). */
export function midiNoteName(n) { return NOTE_NAMES[((n % 12) + 12) % 12] + (Math.floor(n / 12) - 1); }

/** How the canvas looks. Pass any subset as `theme`. */
export const CANVAS_THEME = Object.freeze({
  bg: '#060709',          // the area around the device; null leaves whatever is underneath
  body: null,             // the faceplate; null = the profile's face.body
  ink: '#e8ecf5',         // big text (held notes)
  label: 'rgba(255,255,255,.55)',   // control labels
  dim: 'rgba(255,255,255,.36)',     // faceplate and section lettering
  idle: '#25282f',        // a pad at rest
  button: '#2b2e36',      // a button at rest
  cap: '#2a2d35',         // knob caps
  well: '#0b0c0f',        // fader slots, strip wells
  screen: '#050607', screenInk: '#9fd3ff', screenDim: '#6c7a8c',
  accent: null,           // one colour for everything that moves; null = each control's own (profile colours)
  glow: 1,                // 0 = flat, 1 = the on-screen controller's glow
  font: 'system-ui, -apple-system, "Helvetica Neue", "PingFang TC", sans-serif',
  mono: 'ui-monospace, "SF Mono", Menlo, monospace',
});

// how long a touch stays visible on video (ms)
const FADE = { key: 180, pad: 450, touch: 650, last: 1600 };

/** 1 at `at`, 0 after `ms`, eased (a fade that reads at 30 fps). No `at` → 0. */
export function fadeLevel(now, at, ms) {
  if (at == null || !(ms > 0)) return 0;
  const k = 1 - (now - at) / ms;
  return k <= 0 ? 0 : k >= 1 ? 1 : k * k;
}

// ---------------------------------------------------------------- geometry (pure)

/**
 * Where everything goes when a profile's faceplate is drawn into `rect` (pixels).
 * The faceplate keeps its aspect, centred, with `padding` (share of the short side) around it;
 * a notes strip goes under it when asked (`notes: true`) or when the area has room (`'auto'`).
 * @param {object} profile a normalized profile (MidiController#profile)
 * @param {{x:number,y:number,w:number,h:number}} rect
 * @param {{padding?:number, notes?:boolean|'auto'}} [o]
 * @returns {{ u:number, face:{x,y,w,h}, notes:{x,y,w,h}|null, sections:object[], controls:Map<string,object>, deco:object[] }}
 */
export function controllerGeometry(profile, rect, { padding = 0.05, notes = 'auto' } = {}) {
  const f = profile.face, R = { x: +rect.x || 0, y: +rect.y || 0, w: Math.max(1, +rect.w || 0), h: Math.max(1, +rect.h || 0) };
  const pad = Math.min(R.w, R.h) * clamp01(padding);
  const iw = Math.max(1, R.w - 2 * pad), ih = Math.max(1, R.h - 2 * pad);
  const STRIP = 0.15, GAP = 0.04;                          // notes strip height and gap, × the face height
  let u = Math.min(iw / f.w, ih / f.h);
  let withNotes = false;
  if (notes === true) { u = Math.min(iw / f.w, ih / (f.h * (1 + STRIP + GAP))); withNotes = true; }
  else if (notes === 'auto') withNotes = ih - f.h * u >= f.h * u * (STRIP + GAP);
  const fw = f.w * u, fh = f.h * u, nh = withNotes ? fh * STRIP : 0, gap = withNotes ? fh * GAP : 0;
  const top = R.y + (R.h - (fh + gap + nh)) / 2;
  const face = { x: R.x + (R.w - fw) / 2, y: top, w: fw, h: fh };
  const notesRect = withNotes ? { x: face.x, y: top + fh + gap, w: fw, h: nh } : null;
  const at = (o) => ({ x: face.x + o.x * u, y: face.y + o.y * u, w: o.w * u, h: o.h * u });

  const controls = new Map(), sections = [];
  const types = new Map(profile.controls.map((c) => [c.id, c.type]));
  for (const sec of profile.sections) {
    const box = at(sec);
    const labelH = sec.label ? 2 * u : 0, g = 0.7 * u;
    const grid = { x: box.x, y: box.y + labelH, w: box.w, h: Math.max(1, box.h - labelH) };
    const cw = (grid.w - g * (sec.cols - 1)) / sec.cols, ch = (grid.h - g * (sec.rows - 1)) / sec.rows;
    sections.push({ id: sec.id, label: sec.label || '', ...box, grid });
    for (const p of gridPlace(sec)) {
      const x = grid.x + p.col * (cw + g), y = grid.y + p.row * (ch + g);
      controls.set(p.id, { id: p.id, type: types.get(p.id), section: sec.id, x, y, w: cw * p.cols + g * (p.cols - 1), h: ch * p.rows + g * (p.rows - 1) });
    }
  }
  const deco = (f.deco || []).map((d) => ({ ...d, ...at(d) }));
  return { u, face, notes: notesRect, sections, controls, deco };
}

/** CSS-grid auto-placement (sparse, row or column flow, spans) — the view lays sections out with CSS grid. */
function gridPlace(sec) {
  const cols = sec.cols, rows = sec.rows, column = sec.flow === 'column';
  const used = new Set(), out = [];
  const free = (c, r, sc, sr) => { if (c + sc > cols || r + sr > rows) return false; for (let i = 0; i < sc; i++) for (let j = 0; j < sr; j++) if (used.has((c + i) + ',' + (r + j))) return false; return true; };
  let cursor = 0;
  for (const id of sec.controls) {
    const [sc, sr] = (sec.spans && sec.spans[id]) || [1, 1];
    for (let k = cursor; k < cols * rows; k++) {
      const c = column ? Math.floor(k / rows) : k % cols, r = column ? k % rows : Math.floor(k / cols);
      if (!free(c, r, sc, sr)) continue;
      for (let i = 0; i < sc; i++) for (let j = 0; j < sr; j++) used.add((c + i) + ',' + (r + j));
      out.push({ id, col: c, row: r, cols: sc, rows: sr });
      cursor = k + 1;
      break;
    }
  }
  return out;
}

/**
 * Piano keys in a rect: whites side by side, blacks over the seams (60 % of the height).
 * A range never starts on a black key (the on-screen keyboard's rule).
 * @returns {{note:number, white:boolean, x:number, y:number, w:number, h:number}[]} whites first, then blacks (draw order)
 */
export function keyboardGeometry(from, to, rect) {
  let nW = 0; for (let n = from; n <= to; n++) if (isWhiteKey(n)) nW++;
  const ww = rect.w / Math.max(1, nW), whites = [], blacks = [];
  let wi = 0;
  for (let n = from; n <= to; n++) {
    if (isWhiteKey(n)) { whites.push({ note: n, white: true, x: rect.x + wi * ww, y: rect.y, w: ww, h: rect.h }); wi++; }
    else if (wi > 0) blacks.push({ note: n, white: false, x: rect.x + wi * ww - ww * 0.31, y: rect.y, w: ww * 0.62, h: rect.h * 0.6 });
  }
  return [...whites, ...blacks];
}

/**
 * The first note the drawn keyboard shows. A keyboard catches notes outside its printed
 * range (the device's octave buttons); when one arrives the drawing moves by as few octaves
 * as reach it (Oct+ on a 48–72 MiniLab → 60–84), and stays there, as the device does.
 * @param {number} from @param {number} to the printed range
 * @param {number} base what is shown now (its first note)
 * @param {number} note a note that just went down
 */
export function keyWindow(from, to, base, note) {
  const span = to - from;
  if (!Number.isFinite(note) || (note >= base && note <= base + span)) return base;
  const k = note > base + span ? Math.ceil((note - base - span) / 12) : -Math.ceil((base - note) / 12);
  let b = base + 12 * k;
  if (note < b || note > b + span) b = note > base + span ? note - span : note;   // a range narrower than an octave: just reach it
  return Math.max(0, Math.min(127 - span, b));
}

/** "Knob 1 · 87", "C4 · 100", "Pad 3 · 96", "Pitch +0.42" — what a device screen says about a touch. */
export function touchText(c, st, note = null) {
  if (!c) return '';
  const name = /^\d+$/.test(String(c.label ?? '')) ? `${c.type[0].toUpperCase()}${c.type.slice(1)} ${c.label}` : String(c.label ?? c.id);
  switch (c.type) {
    case 'keys': return note == null ? name : `${midiNoteName(note)} · ${st && st.raw ? st.raw : ''}`.replace(/ · $/, '');
    case 'pad': return st && st.held ? `${name} · ${st.raw}` : name;
    case 'button': return `${name} · ${st && st.held ? 'on' : 'off'}`;
    case 'encoder': return c.relative ? `${name} · ${Math.round((st?.pos ?? 0) * 100)}%` : `${name} · ${st?.raw ?? 0}`;
    case 'wheel': case 'strip': return c.bipolar ? `${name} ${(st?.value ?? 0) >= 0 ? '+' : '−'}${Math.abs(st?.value ?? 0).toFixed(2)}` : `${name} · ${st?.raw ?? 0}`;
    default: return `${name} · ${st?.raw ?? 0}`;
  }
}

// ---------------------------------------------------------------- signals → MIDI (once per message)

/**
 * Listen to a Signals bus and get each MIDI message back once, as an event.
 * Hardware and the on-screen controllers publish every message under two names (legacy
 * `midi/note/on` + per channel `midi/ch/1/note/60`, in that order, in one call); the QWERTY
 * piano and some takes only the legacy ones. Per-channel names count at once; a legacy one
 * waits for a microtask and is dropped if its per-channel twin shows up first — so a relative
 * encoder never turns twice and a legacy CC (which has no channel) never lands on the wrong one.
 * @param {{onAny:Function}} signals
 * @param {(ev:object) => void} onEvent parse.js events ({ type, ch, note, vel } …)
 * @param {{channel?:number, defer?:(fn:Function)=>void}} [o] channel for legacy CC/bend; defer = queueMicrotask
 * @returns {{ flush():void, dispose():void }}
 */
export function followMidiSignals(signals, onEvent, { channel = 1, defer = (fn) => queueMicrotask(fn) } = {}) {
  let pending = [], scheduled = false;
  const emit = (ev) => { try { onEvent(ev); } catch (e) { console.error('[midi canvas]', e); } };
  const flush = () => { scheduled = false; const list = pending; pending = []; list.forEach(emit); };
  const twin = (a, b) => {
    if (a.type !== b.type) return false;
    if (a.type === 'noteon' || a.type === 'noteoff') return a.ch === b.ch && a.note === b.note;
    if (a.type === 'cc') return a.cc === b.cc;                                // legacy CC never knew its channel
    return a.type === 'pitchbend';
  };
  const off = signals.onAny((name, value) => {
    const r = eventOfSignal(name, value, { channel });
    if (!r) return;
    if (r.family === 'legacy') {
      pending.push(r.ev);
      if (!scheduled) { scheduled = true; defer(flush); }
      return;
    }
    // everything still pending before the twin was legacy-only (a twin follows its legacy name at once): keep the order
    let i = pending.length - 1; while (i >= 0 && !twin(pending[i], r.ev)) i--;
    if (pending.length) { const before = i >= 0 ? pending.slice(0, i) : pending; pending = i >= 0 ? pending.slice(i + 1) : []; before.forEach(emit); }
    emit(r.ev);
  });
  return { flush, dispose() { off(); pending = []; } };
}

// ---------------------------------------------------------------- the canvas

const hexRgb = (c) => {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(c || '').trim());
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].replace(/./g, (x) => x + x) : m[1];
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
};
/** A colour at an alpha ('#ff5fb3', .5 → 'rgba(255,95,179,0.5)'); non-hex colours pass through. */
export function withAlpha(c, a) { const r = hexRgb(c); return r ? `rgba(${r[0]},${r[1]},${r[2]},${+clamp01(a).toFixed(3)})` : c; }
/** Mix two hex colours (t = 0 → a, 1 → b). */
export function mixColor(a, b, t) {
  const x = hexRgb(a), y = hexRgb(b);
  if (!x || !y) return t < 0.5 ? a : b;
  const v = x.map((p, i) => Math.round(p + (y[i] - p) * clamp01(t)));
  return '#' + v.map((p) => p.toString(16).padStart(2, '0')).join('');
}

function roundRect(ctx, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') { ctx.roundRect(x, y, w, h, r); return; }
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
/** A piano key: square top (it runs under the panel), rounded bottom. */
function keyPath(ctx, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r); ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r); ctx.closePath();
}
const deg = (d) => (d * Math.PI) / 180;

export class ControllerCanvas {
  /**
   * @param {object} [o]
   * @param {string|object} [o.profile='arturia-minilab3'] id, short name or a profile object
   * @param {object} [o.signals] follow the generic MIDI names on this bus (live, phones, takes)
   * @param {import('./controller.js?v=e353777').MidiController} [o.controller] …or follow this controller instead
   * @param {object} [o.mapping] learned bindings (controller.exportMapping() of the live device)
   * @param {Partial<typeof CANVAS_THEME>} [o.theme]
   * @param {boolean|'auto'} [o.notes='auto'] held notes written large under the faceplate ('auto': when there is room)
   * @param {boolean} [o.screen=true] the device's screen shows the last touch
   * @param {number} [o.padding=0.05] space around the faceplate, share of the area's short side
   * @param {() => number} [o.now] clock in ms (performance.now)
   */
  constructor({ profile = 'arturia-minilab3', signals = null, controller = null, mapping = null, theme = {}, notes = 'auto', screen = true,
    padding = 0.05, now = defaultNow } = {}) {
    this.theme = { ...CANVAS_THEME, ...theme };
    this.notes = notes; this.screen = screen; this.padding = padding; this.now = now;
    this._own = !controller;
    if (controller) this.controller = controller;
    else {
      const p = typeof profile === 'string' ? profileById(profile) : profile;
      if (!p) throw new Error(`ControllerCanvas: unknown profile "${profile}"`);
      this.controller = new MidiController(p);            // no signals, no sink: it only keeps state
      if (mapping) this.controller.applyMapping(mapping);
    }
    this._touch = new Map();      // control id → ms of its last change
    this._keyOn = new Map();      // note → { at, vel }   (held)
    this._keyOff = new Map();     // note → { at, vel }   (released: fading)
    this._padOff = new Map();     // pad id → { at, vel } (released: fading)
    this._padVel = new Map();
    this.last = null;             // { id, text, at, note }
    this._geo = null; this._geoKey = '';
    this._resetKeys();
    this._unsub = this.controller.onChange((id, st, info) => this._changed(id, st, info || {}));
    this._follow = signals && this._own
      ? followMidiSignals(signals, (ev) => { const b = encodeMessage(ev); if (b) this.controller.ingest(b, { source: 'mirror' }); }, { channel: this.controller.profile.channel || 1 })
      : null;
  }

  /** The profile being drawn (normalized). */
  get profile() { return this.controller.profile; }
  /** Width ÷ height of the faceplate — layouts reserve an area of this shape (a picture-in-picture corner). */
  get aspect() { const f = this.profile.face; return f.w / f.h; }

  _resetKeys() {
    this._keys = this.profile.controls.find((c) => c.type === 'keys') || null;
    this.keyBase = this._keys ? this._keys.from : 0;
  }

  _changed(id, st, info) {
    if (!id) { if (info.meta) { this._geoKey = ''; this._resetKeys(); } return; }
    const c = this.controller.control(id); if (!c) return;
    const t = this.now();
    this._touch.set(id, t);
    if (c.type === 'keys' && info.note != null) {
      const n = info.note, held = this.controller.keys.has(n);
      if (held) {
        const vel = (this.controller.keys.get(n) || 100) / 127;
        this._keyOn.set(n, { at: t, vel }); this._keyOff.delete(n);
        this.keyBase = keyWindow(c.from, c.to, this.keyBase, n);
        this.last = { id, note: n, text: touchText(c, { raw: this.controller.keys.get(n) }, n), at: t };
      } else {
        const was = this._keyOn.get(n);
        this._keyOn.delete(n);
        if (was) this._keyOff.set(n, { at: t, vel: was.vel });
      }
      return;
    }
    if (c.type === 'pad') {
      if (st.held) { this._padVel.set(id, st.value); this._padOff.delete(id); this.last = { id, text: touchText(c, st), at: t }; }
      else if (this._padVel.has(id)) { this._padOff.set(id, { at: t, vel: this._padVel.get(id) }); this._padVel.delete(id); }
      return;
    }
    if (c.type === 'button' && !st.held && c.mode !== 'toggle') return;
    this.last = { id, text: touchText(c, st), at: t };
  }

  /** Geometry for a rect (cached while the rect stays the same). */
  geometry(rect) {
    const key = `${rect.x},${rect.y},${rect.w},${rect.h}|${this.notes}|${this.padding}`;
    if (key !== this._geoKey) { this._geo = controllerGeometry(this.profile, rect, { padding: this.padding, notes: this.notes }); this._geoKey = key; }
    return this._geo;
  }

  /** Release everything (stuck-key insurance between takes). Nothing is published. */
  reset() {
    const c = this.controller;
    for (const n of [...c.keys.keys()]) if (this._keys) c.ingest(encodeMessage({ type: 'noteoff', ch: this._keys.ch, note: n }), { source: 'mirror' });
    for (const ctl of c.profile.controls) { const st = c.get(ctl.id); if (st.held && ctl.type === 'pad') c.ingest(encodeMessage(ctl.msg === 'cc' ? { type: 'cc', ch: ctl.ch, cc: ctl.cc, value: 0 } : { type: 'noteoff', ch: ctl.ch, note: ctl.note }), { source: 'mirror' }); }
  }

  /**
   * Draw into `rect` of a 2D context. Call it every frame.
   * @param {CanvasRenderingContext2D} ctx
   * @param {{x:number,y:number,w:number,h:number}} rect
   * @param {number} [now] ms on the same clock as `now` (performance.now)
   */
  draw(ctx, rect, now = this.now()) {
    this._follow?.flush();                  // legacy-only names that arrived since the last microtask
    const g = this.geometry(rect), T = this.theme, p = this.profile, u = g.u;
    ctx.save();
    if (T.bg) { ctx.fillStyle = T.bg; ctx.fillRect(rect.x, rect.y, rect.w, rect.h); }
    // the faceplate
    const F = g.face;
    roundRect(ctx, F.x, F.y, F.w, F.h, 2.2 * u);
    ctx.fillStyle = T.body || p.face.body || '#1b1d22'; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.06)'; ctx.lineWidth = Math.max(1, u * 0.12); ctx.stroke();
    if (p.face.label) this._text(ctx, String(p.face.label).toUpperCase(), F.x + 2 * u, F.y + 0.6 * u + 0.75 * u, { size: 1.5 * u, weight: 700, color: T.dim, spacing: 0.12, baseline: 'middle' });
    for (const d of g.deco) this._deco(ctx, d, u, now);
    for (const s of g.sections) if (s.label) this._text(ctx, s.label.toUpperCase(), s.x + 0.3 * u, s.y + 0.8 * u, { size: 1.15 * u, weight: 600, color: T.dim, spacing: 0.14, baseline: 'middle' });
    for (const [id, cell] of g.controls) {
      const c = this.controller.control(id); if (!c) continue;
      const col = T.accent || c.tint || CONTROL_COLORS[c.color] || CONTROL_COLORS.cyan;
      const hot = fadeLevel(now, this._touch.get(id), FADE.touch) * T.glow;
      switch (c.type) {
        case 'knob': case 'encoder': this._knob(ctx, c, cell, u, col, hot, now); break;
        case 'fader': this._fader(ctx, c, cell, u, col, hot); break;
        case 'pad': this._pad(ctx, c, cell, u, col, now); break;
        case 'button': this._button(ctx, c, cell, u, col); break;
        case 'wheel': case 'strip': this._strip(ctx, c, cell, u, col, hot); break;
        case 'keys': this._keyboard(ctx, c, cell, u, col, now); break;
      }
    }
    if (g.notes) this._notes(ctx, g.notes, now);
    ctx.restore();
  }

  /** Draw into a canvas of its own (an overlay, a thumbnail): fills the whole canvas. */
  renderTo(canvas, now = this.now()) {
    const ctx = canvas.getContext('2d');
    this.draw(ctx, { x: 0, y: 0, w: canvas.width, h: canvas.height }, now);
    return canvas;
  }

  /** Stop listening. A controller passed in stays as it was. */
  dispose() { this._unsub?.(); this._follow?.dispose(); this._unsub = null; this._follow = null; }

  // ---------------------------------------------------------------- painters

  _glow(ctx, col, k, u) {
    if (k > 0.01) { ctx.shadowColor = col; ctx.shadowBlur = 2.4 * u * k; } else { ctx.shadowBlur = 0; ctx.shadowColor = 'transparent'; }
  }

  _text(ctx, s, x, y, { size, weight = 600, color, font = this.theme.font, align = 'left', baseline = 'alphabetic', spacing = 0 }) {
    ctx.font = `${weight} ${Math.max(1, size).toFixed(1)}px ${font}`;
    ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = baseline;
    const ls = 'letterSpacing' in ctx;
    if (ls) ctx.letterSpacing = spacing ? `${(spacing * size).toFixed(2)}px` : '0px';
    ctx.fillText(s, x, y);
    if (ls && spacing) ctx.letterSpacing = '0px';
  }

  _label(ctx, c, cell, u) {
    this._text(ctx, String(c.label ?? c.id), cell.x + cell.w / 2, cell.y + cell.h - 0.15 * u, { size: 1.15 * u, color: this.theme.label, align: 'center', baseline: 'bottom' });
  }

  _knob(ctx, c, cell, u, col, hot, now) {
    const st = this.controller.get(c.id), T = this.theme;
    const lh = 1.7 * u, d = Math.max(2, Math.min(cell.w, cell.h - lh) * 0.96), k = d / 100;
    const cx = cell.x + cell.w / 2, cy = cell.y + (cell.h - lh - d) / 2 + d / 2;
    const endless = c.type === 'encoder' && c.relative;
    ctx.lineCap = 'round';
    if (endless) {
      ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 2 * k;
      ctx.beginPath();
      for (let i = 0; i < 24; i++) { const a = deg(i * 15); ctx.moveTo(cx + 44 * k * Math.sin(a), cy - 44 * k * Math.cos(a)); ctx.lineTo(cx + 48 * k * Math.sin(a), cy - 48 * k * Math.cos(a)); }
      ctx.stroke();
    } else {
      ctx.strokeStyle = 'rgba(255,255,255,.09)'; ctx.lineWidth = 7 * k;
      ctx.beginPath(); ctx.arc(cx, cy, 40 * k, deg(135), deg(405)); ctx.stroke();
      if (st.value > 0.001) {
        ctx.save(); this._glow(ctx, col, 0.35 + 0.65 * hot, u * 0.6);
        ctx.strokeStyle = col; ctx.beginPath(); ctx.arc(cx, cy, 40 * k, deg(135), deg(135 + 270 * clamp01(st.value))); ctx.stroke();
        ctx.restore();
      }
    }
    ctx.beginPath(); ctx.arc(cx, cy, (endless ? 36 : 30) * k, 0, Math.PI * 2);
    ctx.fillStyle = T.cap; ctx.fill(); ctx.strokeStyle = '#0d0e11'; ctx.lineWidth = 2 * k; ctx.stroke();
    if (hot > 0.01) { ctx.save(); ctx.globalAlpha = 0.5 * hot; ctx.strokeStyle = col; ctx.lineWidth = 2.5 * k; ctx.stroke(); ctx.restore(); }
    const a = deg((endless ? ((st.turns || 0) * 15) % 360 : -135 + clamp01(st.value) * 270) - 90);
    const r0 = (endless ? 16 : 12) * k, r1 = (endless ? 30 : 24) * k;
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 4.5 * k;
    ctx.beginPath(); ctx.moveTo(cx + r0 * Math.cos(a), cy + r0 * Math.sin(a)); ctx.lineTo(cx + r1 * Math.cos(a), cy + r1 * Math.sin(a)); ctx.stroke();
    if (hot > 0.01) this._text(ctx, endless ? `${Math.round(st.pos * 100)}%` : String(st.raw), cx, cy + 45 * k, { size: 1.05 * u, color: withAlpha(col, hot), font: T.mono, align: 'center', baseline: 'middle' });
    this._label(ctx, c, cell, u);
  }

  _fader(ctx, c, cell, u, col, hot) {
    const st = this.controller.get(c.id), v = clamp01(st.value);
    const lh = 1.7 * u, w = Math.min(cell.w, 7 * u), h = cell.h - lh, cx = cell.x + cell.w / 2, pad = 1.3 * u;
    const top = cell.y + pad, bot = cell.y + h - pad, sw = 0.9 * u;
    roundRect(ctx, cx - sw / 2, top, sw, bot - top, sw / 2); ctx.fillStyle = this.theme.well; ctx.fill();
    if (v > 0.001) {
      ctx.save(); this._glow(ctx, col, 0.5 + 0.5 * hot, u); ctx.globalAlpha = 0.85;
      roundRect(ctx, cx - sw / 2, bot - v * (bot - top), sw, v * (bot - top), sw / 2); ctx.fillStyle = col; ctx.fill(); ctx.restore();
    }
    const capW = Math.min(w, 5.5 * u), capH = 2.4 * u, y = bot - v * (bot - top);
    const grad = ctx.createLinearGradient(0, y - capH / 2, 0, y + capH / 2); grad.addColorStop(0, '#4a4e58'); grad.addColorStop(1, '#2a2d34');
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 0.6 * u; ctx.shadowOffsetY = 0.3 * u;
    roundRect(ctx, cx - capW / 2, y - capH / 2, capW, capH, 0.5 * u); ctx.fillStyle = grad; ctx.fill(); ctx.restore();
    if (hot > 0.01) { ctx.save(); ctx.globalAlpha = 0.7 * hot; ctx.strokeStyle = col; ctx.lineWidth = Math.max(1, 0.2 * u); roundRect(ctx, cx - capW / 2, y - capH / 2, capW, capH, 0.5 * u); ctx.stroke(); ctx.restore(); }
    ctx.fillStyle = '#fff'; ctx.fillRect(cx - capW * 0.38, y - Math.max(1, 0.12 * u), capW * 0.76, Math.max(2, 0.24 * u));
    this._label(ctx, c, cell, u);
  }

  _pad(ctx, c, cell, u, col, now) {
    const st = this.controller.get(c.id), T = this.theme, r = 0.9 * u;
    const fadeOut = this._padOff.get(c.id);
    const k = st.held ? 0.35 + 0.65 * (st.value || 1) : fadeOut ? fadeLevel(now, fadeOut.at, FADE.pad) * (0.35 + 0.65 * fadeOut.vel) : 0;
    roundRect(ctx, cell.x, cell.y, cell.w, cell.h, r); ctx.fillStyle = T.idle; ctx.fill();
    if (c.tint && k < 0.16) { ctx.fillStyle = withAlpha(col, 0.16); ctx.fill(); }      // the TD Launchpad tool: idle racks glow at ~16 %
    if (k > 0.005) {
      ctx.save(); this._glow(ctx, col, st.held ? T.glow : k * T.glow, u);
      const grad = ctx.createRadialGradient(cell.x + cell.w / 2, cell.y + cell.h * 0.55, 0, cell.x + cell.w / 2, cell.y + cell.h * 0.55, Math.max(cell.w, cell.h) * 0.75);
      grad.addColorStop(0, mixColor(col, '#ffffff', 0.85)); grad.addColorStop(0.55, col); grad.addColorStop(1, col);
      ctx.globalAlpha = clamp01(k); roundRect(ctx, cell.x, cell.y, cell.w, cell.h, r); ctx.fillStyle = grad; ctx.fill();
      ctx.restore();
    }
    ctx.strokeStyle = st.held ? 'rgba(255,255,255,.3)' : 'rgba(255,255,255,.06)'; ctx.lineWidth = Math.max(1, 0.12 * u); roundRect(ctx, cell.x, cell.y, cell.w, cell.h, r); ctx.stroke();
    if (st.pressure > 0) { ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fillRect(cell.x, cell.y + cell.h - Math.max(2, 0.4 * u), cell.w * clamp01(st.pressure), Math.max(2, 0.4 * u)); }
    if (c.label) this._text(ctx, String(c.label), cell.x + 0.6 * u, cell.y + cell.h - 0.45 * u, { size: 1.05 * u, color: k > 0.5 ? 'rgba(10,11,14,.65)' : 'rgba(255,255,255,.45)', baseline: 'bottom' });
  }

  _button(ctx, c, cell, u, col) {
    const st = this.controller.get(c.id), round = c.shape === 'round';
    let w = cell.w, h = Math.min(cell.h, 5 * u);
    if (round) w = h = Math.min(cell.w, cell.h);
    const x = cell.x + (cell.w - w) / 2, y = cell.y + (cell.h - h) / 2;
    ctx.save();
    if (st.held) this._glow(ctx, col, this.theme.glow * 0.8, u);
    roundRect(ctx, x, y, w, h, round ? w / 2 : 0.6 * u); ctx.fillStyle = st.held ? col : this.theme.button; ctx.fill();
    ctx.restore();
    if (c.label) this._text(ctx, String(c.label), x + w / 2, y + h / 2, { size: (round ? 1.05 : 1.15) * u, weight: 700, color: st.held ? '#0b0c0f' : 'rgba(255,255,255,.62)', align: 'center', baseline: 'middle' });
  }

  _strip(ctx, c, cell, u, col, hot) {
    const st = this.controller.get(c.id);
    const lh = 1.7 * u, w = Math.min(cell.w, 4.2 * u), h = cell.h - lh, x = cell.x + (cell.w - w) / 2, y = cell.y;
    roundRect(ctx, x, y, w, h, 0.8 * u); ctx.fillStyle = '#101115'; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.05)'; ctx.lineWidth = Math.max(1, 0.12 * u); ctx.stroke();
    const yv = c.bipolar ? (clamp01((st.value + 1) / 2)) : clamp01(st.value);
    if (c.bipolar) { ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(x + w * 0.15, y + h / 2, w * 0.7, Math.max(1, 0.12 * u)); }
    const t0 = c.bipolar ? Math.min(0.5, 1 - yv) : 1 - yv, th = c.bipolar ? Math.abs(yv - 0.5) : yv;
    if (th > 0.001) { ctx.save(); roundRect(ctx, x, y, w, h, 0.8 * u); ctx.clip(); ctx.fillStyle = withAlpha(col, 0.3); ctx.fillRect(x, y + t0 * h, w, th * h); ctx.restore(); }
    const ty = y + (1 - yv) * h;
    ctx.save(); this._glow(ctx, col, 0.6 + 0.4 * hot, u * 0.7);
    roundRect(ctx, x + w * 0.08, Math.min(y + h - 0.7 * u, Math.max(y, ty - 0.35 * u)), w * 0.84, 0.7 * u, 0.35 * u); ctx.fillStyle = col; ctx.fill();
    ctx.restore();
    this._label(ctx, c, cell, u);
  }

  _keyboard(ctx, c, cell, u, col, now) {
    const span = c.to - c.from, base = this.keyBase;
    const keys = keyboardGeometry(base, base + span, cell);
    const bw = Math.max(1, 0.12 * u), white = ctx.createLinearGradient(0, cell.y, 0, cell.y + cell.h);
    white.addColorStop(0, '#f3f4f7'); white.addColorStop(1, '#d6d9e0');
    const black = ctx.createLinearGradient(0, cell.y, 0, cell.y + cell.h * 0.6);
    black.addColorStop(0, '#2d3039'); black.addColorStop(1, '#15171c');
    const lit = (n) => { const on = this._keyOn.get(n); if (on) return { k: 1, vel: on.vel }; const off = this._keyOff.get(n); return off ? { k: fadeLevel(now, off.at, FADE.key), vel: off.vel } : null; };
    for (const key of keys) {
      const rr = key.white ? 0.45 * u : 0.3 * u;
      const L = lit(key.note);
      ctx.save();
      keyPath(ctx, key.x, key.y, key.w, key.h, rr);
      ctx.fillStyle = key.white ? white : black; ctx.fill();
      if (L && L.k > 0.01) {
        const a = L.k * (0.6 + 0.4 * L.vel);
        this._glow(ctx, col, L.k * this.theme.glow, u * 0.8);
        ctx.globalAlpha = a;
        if (key.white) { const g = ctx.createLinearGradient(0, key.y, 0, key.y + key.h); g.addColorStop(0, mixColor(col, '#ffffff', 0.4)); g.addColorStop(1, col); ctx.fillStyle = g; }
        else ctx.fillStyle = col;
        ctx.fill();
        ctx.globalAlpha = 1; ctx.shadowBlur = 0; ctx.shadowColor = 'transparent';
      }
      ctx.strokeStyle = key.white ? '#1a1c22' : '#08090b'; ctx.lineWidth = bw; ctx.stroke();
      ctx.restore();
      if (key.white && key.note % 12 === 0) this._text(ctx, midiNoteName(key.note), key.x + key.w / 2, key.y + key.h - 0.5 * u, { size: 1 * u, color: L && L.k > 0.5 ? 'rgba(10,11,14,.7)' : '#8a8f9c', align: 'center', baseline: 'bottom' });
    }
  }

  _deco(ctx, d, u, now) {
    const T = this.theme;
    if (d.type === 'screen') {
      roundRect(ctx, d.x, d.y, d.w, d.h, 0.5 * u); ctx.fillStyle = T.screen; ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.06)'; ctx.lineWidth = Math.max(1, 0.12 * u); ctx.stroke();
      const last = this.screen ? this.last : null, k = last ? fadeLevel(now, last.at, FADE.last * 2) : 0;
      if (k > 0.02) {
        this._text(ctx, last.text, d.x + d.w / 2, d.y + d.h / 2, { size: Math.min(1.7 * u, (d.w / Math.max(6, last.text.length)) * 1.6), weight: 600, color: withAlpha(T.screenInk, 0.35 + 0.65 * Math.sqrt(k)), font: T.mono, align: 'center', baseline: 'middle' });
      } else {
        this._text(ctx, String(d.text || ''), d.x + d.w / 2, d.y + d.h / 2, { size: 1.3 * u, color: T.screenInk, font: T.mono, align: 'center', baseline: 'middle' });
      }
    } else if (d.type === 'buttons') {
      const items = d.items || [], g = 0.6 * u, w = (d.w - g * (items.length - 1)) / Math.max(1, items.length);
      items.forEach((t, i) => {
        const x = d.x + i * (w + g);
        roundRect(ctx, x, d.y, w, d.h, 0.4 * u); ctx.fillStyle = T.button; ctx.fill();
        this._text(ctx, String(t), x + w / 2, d.y + d.h / 2, { size: 1 * u, color: 'rgba(255,255,255,.4)', align: 'center', baseline: 'middle' });
      });
    } else if (d.type === 'label') {
      this._text(ctx, String(d.text || '').toUpperCase(), d.x, d.y + d.h / 2, { size: 1.2 * u, weight: 700, color: T.dim, spacing: 0.12, baseline: 'middle' });
    } else if (d.type === 'logo') {
      roundRect(ctx, d.x, d.y, d.w, d.h, 0.5 * u);
      if (typeof ctx.createConicGradient === 'function') {
        const g = ctx.createConicGradient(0, d.x + d.w / 2, d.y + d.h / 2);
        ['#ff4b4b', '#ffea00', '#15ff00', '#35d4e6', '#a8a1ff', '#ff4b4b'].forEach((c, i, a) => g.addColorStop(i / (a.length - 1), c));
        ctx.fillStyle = g;
      } else ctx.fillStyle = '#35d4e6';
      ctx.save(); ctx.globalAlpha = 0.55; ctx.fill(); ctx.restore();
    }
  }

  _notes(ctx, r, now) {
    const T = this.theme, held = [...this.controller.keys.keys()].sort((a, b) => a - b);
    const size = r.h * 0.62;
    if (held.length) {
      const text = held.map(midiNoteName).join('  ');
      const fit = Math.min(size, (r.w / Math.max(4, text.length)) * 1.7);
      this._text(ctx, text, r.x + r.w / 2, r.y + r.h / 2, { size: fit, weight: 600, color: T.ink, font: T.font, align: 'center', baseline: 'middle', spacing: 0.02 });
      return;
    }
    const last = this.last, k = last ? fadeLevel(now, last.at, FADE.last) : 0;
    if (k > 0.02) this._text(ctx, last.text, r.x + r.w / 2, r.y + r.h / 2, { size: Math.min(size * 0.8, (r.w / Math.max(4, last.text.length)) * 1.7), weight: 500, color: withAlpha('#e8ecf5', 0.55 * k), font: T.font, align: 'center', baseline: 'middle' });
  }
}
