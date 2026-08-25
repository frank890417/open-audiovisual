// @openav/keys — on-screen piano + computer-keyboard playing + a simulated performer.
//
// Lineage: The Last Input core/keys-piano.js (IRCAM 2026) — the on-stage test
// piano, generalized. Three pieces, composable:
//
//   KeysPiano   on-screen keys (mouse/touch, glissando) + DAW-standard QWERTY
//               (A-row whites, W-row blacks, Z/X octave, Shift = accent)
//   SimPlayer   "simulated performance": a hands-free player that noodles
//               musically (scale walks, occasional triads, rests) — so every
//               demo can perform itself while you watch the mapping breathe
//   mountKeys   one call: piano UI + capture/sim toggles wired to signals
//
// Notes are published as the standard midi/note/on|off signals (same names the
// Midi engine uses), so everything downstream — chord detection, worlds,
// meters — cannot tell a QWERTY performance from a real keyboard. That
// indistinguishability is the point.

export const PIANO_KEYMAP = { a: 0, w: 1, s: 2, e: 3, d: 4, f: 5, t: 6, g: 7, y: 8, h: 9, u: 10, j: 11, k: 12, o: 13, l: 14, p: 15, ';': 16 };
const BLACK = new Set([1, 3, 6, 8, 10]);
const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const CSS = `
.oav-keys { position: relative; height: 96px; user-select: none; touch-action: none; }
.oav-keys .pk-key { position: absolute; top: 0; height: 92px; background: #f4f6fb; border: 1px solid #2a3348;
  border-radius: 0 0 4px 4px; cursor: pointer; box-sizing: border-box; }
.oav-keys .pk-key.on { background: #7ea6ff; }
.oav-keys .pk-black { height: 56px; background: #1a2030; z-index: 2; }
.oav-keys .pk-black.on { background: #2e6df6; }
.oav-keys .pk-lbl { position: absolute; bottom: 4px; left: 0; right: 0; text-align: center;
  font: 9px ui-monospace, monospace; color: #667; pointer-events: none; }
.oav-keys .pk-black .pk-lbl { color: #8892a8; }
.oav-keys .pk-nm { position: absolute; bottom: 16px; left: 0; right: 0; text-align: center;
  font: 8px ui-monospace, monospace; color: #99a; pointer-events: none; }
.oav-keysbar { display: flex; gap: 8px; align-items: center; margin: 6px 0;
  font: 11px ui-monospace, monospace; color: #8892a8; }
.oav-keysbar label { display: flex; gap: 4px; align-items: center; cursor: pointer; }
.oav-keysbar input { accent-color: #2e6df6; }
`;

function injectCss() {
  if (document.getElementById('openav-keys-css')) return;
  const s = document.createElement('style');
  s.id = 'openav-keys-css';
  s.textContent = CSS;
  document.head.appendChild(s);
}

export class KeysPiano {
  /** opts: { base=48, octaves=2, velocity=100, onNote(note, vel01, on), onOctave(base) } */
  constructor(container, opts = {}) {
    this.el = container;
    this.base = opts.base ?? 48;
    this.octaves = opts.octaves ?? 2;
    this.onNote = opts.onNote || (() => {});
    this.onOctave = opts.onOctave || (() => {});
    this.velocity = opts.velocity ?? 100;
    this.captureEnabled = false;      // keyboard capture is modal & off by default (protects hotkeys)
    this._kbdHeld = new Map();
    this._pressed = new Set();
    this._keyEls = new Map();
    if (this.el) { injectCss(); this.el.classList.add('oav-keys'); this._build(); }
  }

  noteName(n) { return NAMES[n % 12] + (Math.floor(n / 12) - 1); }

  _build() {
    this.el.innerHTML = '';
    this._keyEls.clear();
    const total = this.octaves * 12 + 1;
    const whites = [];
    for (let i = 0; i < total; i++) if (!BLACK.has(i % 12)) whites.push(i);
    const WW = 27, BW = 17;
    this.el.style.width = whites.length * WW + 'px';
    whites.forEach((semi, wi) => this._mkKey(semi, false, wi * WW, WW));
    let wi = 0;
    for (let i = 0; i < total; i++) {
      if (!BLACK.has(i % 12)) { wi++; continue; }
      this._mkKey(i, true, wi * WW - BW / 2, BW);
    }
    this._syncLabels();
  }
  _mkKey(semi, black, x, w) {
    const k = document.createElement('div');
    k.className = 'pk-key' + (black ? ' pk-black' : '');
    k.style.left = x + 'px'; k.style.width = w + 'px';
    k.dataset.semi = semi;
    k.appendChild(Object.assign(document.createElement('span'), { className: 'pk-lbl' }));
    k.appendChild(Object.assign(document.createElement('span'), { className: 'pk-nm' }));
    // pointer: down = on, up/leave = off; sweep while held (glissando)
    k.addEventListener('pointerdown', ev => { ev.preventDefault(); k.releasePointerCapture?.(ev.pointerId); this.press(this.base + semi, this.velocity / 127); });
    k.addEventListener('pointerenter', ev => { if (ev.buttons & 1) this.press(this.base + semi, this.velocity / 127); });
    k.addEventListener('pointerup', () => this.release(this.base + semi));
    k.addEventListener('pointerleave', () => this.release(this.base + semi));
    this.el.appendChild(k);
    this._keyEls.set(semi, k);
  }
  _syncLabels() {
    const inv = {}; for (const [ch, off] of Object.entries(PIANO_KEYMAP)) inv[off] = ch.toUpperCase();
    for (const [semi, k] of this._keyEls) {
      k.querySelector('.pk-lbl').textContent = inv[semi] ?? '';
      k.querySelector('.pk-nm').textContent = (this.base + semi) % 12 === 0 ? this.noteName(this.base + semi) : '';
    }
  }

  setBase(n) {
    const clamped = Math.max(24, Math.min(84, n));
    if (clamped === this.base) return;
    this.releaseAll();                 // change octave without stuck notes
    this.base = clamped; this._syncLabels(); this.onOctave(this.base);
  }

  press(note, vel01) {
    if (this._pressed.has(note)) return;
    this._pressed.add(note);
    const k = this._keyEls.get(note - this.base); if (k) k.classList.add('on');
    this.onNote(note, vel01, true);
  }
  release(note) {
    if (!this._pressed.delete(note)) return;
    const k = this._keyEls.get(note - this.base); if (k) k.classList.remove('on');
    this.onNote(note, 0, false);
  }
  releaseAll() { for (const n of [...this._pressed]) this.release(n); this._kbdHeld.clear(); }

  /** Returns true when the piano consumed the event (caller: preventDefault + return).
   *  Letters are fully consumed while capturing (unmapped letters = dead keys —
   *  protects destructive hotkeys like R-reset); Space/arrows/digits pass through. */
  handleKeyDown(e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return false;
    const key = e.key.toLowerCase();
    if (key === 'z') { if (!e.repeat) this.setBase(this.base - 12); return true; }
    if (key === 'x') { if (!e.repeat) this.setBase(this.base + 12); return true; }
    const off = PIANO_KEYMAP[key];
    if (off !== undefined) {
      if (!e.repeat && !this._kbdHeld.has(key)) {
        const note = this.base + off;
        this._kbdHeld.set(key, note);
        this.press(note, (e.shiftKey ? Math.min(127, this.velocity + 20) : this.velocity) / 127);
      }
      return true;
    }
    return /^[a-z]$/.test(key);
  }
  handleKeyUp(e) {
    const key = e.key.toLowerCase();
    const note = this._kbdHeld.get(key);
    if (note !== undefined) { this._kbdHeld.delete(key); this.release(note); return true; }
    return /^[a-z;]$/.test(key);
  }
}

/** SimPlayer — a hands-free performer for demos and rehearsal.
 *  Noodles in a scale: mostly steps, occasional leaps and triads, real rests.
 *  Call update(dt) per frame; it presses/releases through the same press/release
 *  callbacks a human uses, so downstream cannot tell the difference. */
export class SimPlayer {
  /** opts: { press(note, vel01), release(note), base=60,
   *          scale=[0,2,4,7,9] (pentatonic), density=1 (notes/sec-ish) } */
  constructor({ press, release, base = 60, scale = [0, 2, 4, 7, 9], density = 1 } = {}) {
    this.press = press; this.release = release;
    this.base = base; this.scale = scale; this.density = density;
    this.enabled = false;
    this._t = 0; this._next = 0.5;
    this._deg = Math.floor(scale.length / 2); this._oct = 0;
    this._held = [];                    // [{note, off}] scheduled releases
  }
  toggle(on = !this.enabled) {
    this.enabled = on;
    if (!on) { for (const h of this._held) this.release(h.note); this._held = []; }
    return this.enabled;
  }
  _noteAt(deg, oct) {
    const n = this.scale.length;
    const wrap = ((deg % n) + n) % n;
    const carry = Math.floor(deg / n);
    return this.base + (oct + carry) * 12 + this.scale[wrap];
  }
  /** press with re-strike safety: a note already held just gets its release
   *  extended — never a second press/duplicate release (early cut-off bug) */
  _strike(note, vel, off) {
    note = Math.max(36, Math.min(96, note));    // keep the noodling in a playable range
    const held = this._held.find(h => h.note === note);
    if (held) { held.off = Math.max(held.off, off); return; }
    this.press(note, vel);
    this._held.push({ note, off });
  }
  update(dt) {
    if (!this.enabled) return;
    this._t += dt;
    // releases due
    this._held = this._held.filter(h => { if (this._t >= h.off) { this.release(h.note); return false; } return true; });
    if (this._t < this._next) return;
    // choose the next gesture
    const r = Math.random();
    const dur = 0.18 + Math.random() * 0.5;
    if (r < 0.12) {                                   // rest — silence is phrasing
      this._next = this._t + (0.6 + Math.random() * 1.4) / this.density;
      return;
    }
    if (r < 0.24) {                                   // triad (scale-stacked)
      for (const d of [0, 2, 4])
        this._strike(this._noteAt(this._deg + d, this._oct), 0.55 + Math.random() * 0.3, this._t + dur * 2);
    } else {                                          // melodic step (mostly) or leap
      this._deg += (Math.random() < 0.75 ? (Math.random() < 0.5 ? 1 : -1) : (Math.random() < 0.5 ? 3 : -3));
      this._deg = Math.max(-3, Math.min(this.scale.length * 2 + 3, this._deg));
      if (Math.random() < 0.06) this._oct = this._oct === 0 ? 1 : 0;
      this._strike(this._noteAt(this._deg, this._oct), 0.45 + Math.random() * 0.4, this._t + dur);
    }
    this._next = this._t + (0.22 + Math.random() * 0.55) / this.density;
  }
}

/** mountKeys — one call: piano + toggles, publishing standard midi/note signals.
 *  Returns { piano, sim, update(dt), dispose }. Wire update(dt) into your Loop. */
export function mountKeys(container, { signals, chord = null, base = 48, octaves = 2, sim = true, capture = true } = {}) {
  injectCss();
  const bar = document.createElement('div');
  bar.className = 'oav-keysbar';
  const pianoEl = document.createElement('div');
  container.appendChild(bar);
  container.appendChild(pianoEl);

  const emit = (note, vel01, on) => {
    if (on) { signals?.pulse('midi/note/on', { note, vel: vel01, ch: 0 }); chord?.noteOn(note, vel01); }
    else { signals?.pulse('midi/note/off', { note, ch: 0 }); chord?.noteOff(note); }
  };
  const piano = new KeysPiano(pianoEl, { base, octaves, onNote: emit });
  const simPlayer = new SimPlayer({
    press: (n, v) => piano.press(n, v),      // through the piano → keys light up
    release: (n) => piano.release(n),
    base: base + 12,
  });

  const mk = (label, checked, onchange) => {
    const l = document.createElement('label');
    const c = Object.assign(document.createElement('input'), { type: 'checkbox', checked });
    c.addEventListener('change', () => onchange(c.checked));
    l.appendChild(c); l.appendChild(document.createTextNode(label));
    bar.appendChild(l);
    return c;
  };
  let captureBox = null;
  if (capture) captureBox = mk('keyboard (Z/X octave · Shift accent)', false, (on) => { piano.captureEnabled = on; if (!on) piano.releaseAll(); });
  if (sim) mk('simulate performance', false, (on) => simPlayer.toggle(on));

  const onDown = (e) => { if (piano.captureEnabled && piano.handleKeyDown(e)) e.preventDefault(); };
  const onUp = (e) => { if (piano.captureEnabled) piano.handleKeyUp(e); };
  const onBlur = () => piano.releaseAll();
  window.addEventListener('keydown', onDown);
  window.addEventListener('keyup', onUp);
  window.addEventListener('blur', onBlur);

  return {
    piano, sim: simPlayer,
    update(dt) { simPlayer.update(dt); },
    dispose() {
      simPlayer.toggle(false); piano.releaseAll();
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
      window.removeEventListener('blur', onBlur);
      container.innerHTML = '';
    },
    get captureBox() { return captureBox; },
  };
}
