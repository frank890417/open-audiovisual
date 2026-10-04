// @openav/surface · widgets — the TouchOSC-style control set.
//
// Every widget is: an id, a type, a label, a range, a default, a color — and
// ONE job: turn fingers into named, normalized signals (and, for feedback,
// turn values coming back into pixels). They never know the work, the relay or
// the mapper; they talk to `ctx` (see Surface). That is the "shell never
// knows the work" rule applied to a touch screen.
//
// Output naming (all normalized 0..1 unless said; `raw` travels beside it):
//   fader knob number       surface/<page>/<id>
//   button toggle           surface/<page>/<id>                   (0/1; buttons are momentary)
//   encoder                 surface/<page>/<id>  (phase 0..1, wraps) + /delta (turns per event)
//   xy                      surface/<page>/<id>/x  /y  /down
//   bank                    surface/<page>/<id>/<1..N>
//   radio                   surface/<page>/<id>                   (idx / (n-1); raw = idx)
//   pads                    surface/<page>/<id>/hit  pulse {pad,row,col,vel}  + /<pad> held velocity
//   keyboard                midi/note/on|off  (same shape as a hardware keyboard) + midi/cc/64 + midi/virtual (raw bytes)
//   text                    surface/<page>/<id>                   (string, as a pulse)
//   label meter             — receive-only (feedback)

import { KeysPiano } from '../keys/index.js?v=32849c5';
import { planKeyboard } from './kbplan.js?v=32849c5';

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const decimalsOf = (step) => { if (!step) return 2; const s = String(step); return s.includes('.') ? s.split('.')[1].length : 0; };
const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
const NOTE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/** Base class: card chrome (label + readout), geometry hooks, feedback registry. */
export class Widget {
  constructor(spec, ctx) {
    this.spec = spec; this.ctx = ctx; this.id = spec.id; this.type = spec.type;
    this.label = spec.label ?? spec.id;
    this.el = h('div', `oav-w oav-${spec.type}`);
    this.el.dataset.widget = spec.id;
    if (spec.color) this.el.dataset.color = spec.color;
    if (spec.label === '' || spec.hideLabel) this.el.classList.add('nohead');
    this.head = h('div', 'oav-head', `<span class="lbl"></span><span class="oav-val"></span>`);
    this.head.firstChild.textContent = this.label;
    this.valEl = this.head.lastChild;
    this.body = h('div', 'oav-body');
    if (!this.el.classList.contains('nohead')) this.el.appendChild(this.head);
    this.el.appendChild(this.body);
    this._touching = 0; this._lastTouch = -1e9;
    this.build();
  }
  build() {}
  /** Full signal name for this widget (+ optional suffix). */
  sig(suffix = '') { return `surface/${this.ctx.page}/${this.id}${suffix ? '/' + suffix : ''}`; }
  /** [[fullName, (value)=>void]] — what this widget does when the runner sends feedback. */
  feedbackTargets() { return []; }
  resize() {}
  setActive(on) { this.el.classList.toggle('active', !!on); }
  /** True for ~0.5 s after the last touch: feedback must not fight a finger. */
  get busy() { return this._touching > 0 || performance.now() - this._lastTouch < 500; }
  _touch(down) { this._touching = Math.max(0, (this._touching || 0) + (down ? 1 : -1)); this._lastTouch = performance.now(); this.setActive(this._touching > 0); }
  /** Double-tap anywhere on a value widget → back to default (TouchOSC convention). */
  _isDoubleTap(e) {
    const now = performance.now();
    const dbl = now - (this._tapT || 0) < 320 && Math.hypot(e.clientX - (this._tapX || 0), e.clientY - (this._tapY || 0)) < 30;
    this._tapT = dbl ? 0 : now; this._tapX = e.clientX; this._tapY = e.clientY;
    return dbl;
  }
  destroy() { this.el.remove(); }
}

/** Per-pointer drag helper: capture, route, release. Multi-finger safe. */
function track(el, { down, move, up }) {
  const active = new Map();
  el.addEventListener('pointerdown', (e) => {
    if (e.button > 0) return;
    e.preventDefault();
    try { el.setPointerCapture(e.pointerId); } catch {}
    const st = { id: e.pointerId };
    active.set(e.pointerId, st);
    down?.(e, st);
  });
  el.addEventListener('pointermove', (e) => { const st = active.get(e.pointerId); if (st) { e.preventDefault(); move?.(e, st); } });
  const end = (e) => { const st = active.get(e.pointerId); if (!st) return; active.delete(e.pointerId); up?.(e, st); };
  el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end); el.addEventListener('lostpointercapture', end);
  return active;
}

/** Shared model for single-value widgets: range, step, default, raw ↔ norm. */
class ValueWidget extends Widget {
  constructor(spec, ctx) {
    super(spec, ctx);
  }
  _init() {
    const s = this.spec;
    this.min = s.min ?? 0; this.max = s.max ?? 1; this.step = s.step || 0;
    this.def = s.def ?? s.default ?? this.min;
    this.unit = s.unit || '';
    this.dec = s.decimals ?? decimalsOf(this.step || (this.max - this.min) / 100);
    this.norm = this.toNorm(this.def);
  }
  toRaw(n) {
    let r = this.min + clamp(n) * (this.max - this.min);
    if (this.step) r = this.min + Math.round((r - this.min) / this.step) * this.step;
    return +r.toFixed(6);
  }
  toNorm(r) { return this.max === this.min ? 0 : clamp((r - this.min) / (this.max - this.min)); }
  fmt(n = this.norm) { return this.toRaw(n).toFixed(this.dec) + (this.unit ? ' ' + this.unit : ''); }
  paint() {}
  /** User moved it: quantize, repaint, publish. */
  setNorm(n, { emit = true } = {}) {
    n = clamp(n);
    if (this.step) n = this.toNorm(this.toRaw(n));
    const changed = n !== this.norm;
    this.norm = n; this.paint();
    if (emit && changed) this.ctx.out(this.sig(), n, { raw: this.toRaw(n) });
  }
  reset() { this.setNorm(this.toNorm(this.def)); this.ctx.haptic(12); }
  feedbackTargets() { return [[this.sig(), (v) => { if (!this.busy && typeof v === 'number') this.setNorm(v, { emit: false }); }]]; }
}

// ---------------------------------------------------------------- fader
export class Fader extends ValueWidget {
  build() {
    this._init();
    this.body.innerHTML = '<div class="trk"><div class="fill"></div><div class="def"></div><div class="cap"></div></div>';
    this.body.classList.add('oav-fader'); this.fa = this.body;
    this.fa.style.setProperty('--d', this.toNorm(this.def));
    this.orient = this.spec.orient || 'auto';
    if (this.orient === 'h') this.fa.classList.add('h');
    const at = (e) => {
      const r = this.body.getBoundingClientRect();
      return this.fa.classList.contains('h') ? (e.clientX - r.left) / r.width : 1 - (e.clientY - r.top) / r.height;
    };
    track(this.body, {
      down: (e) => { this._touch(true); if (this._isDoubleTap(e)) return this.reset(); this.setNorm(at(e)); },
      move: (e) => this.setNorm(at(e)),
      up: () => this._touch(false),
    });
    this.paint();
  }
  resize(w, hh) { if (this.orient === 'auto') this.fa.classList.toggle('h', w > hh * 1.15); }
  paint() { this.fa.style.setProperty('--v', this.norm); this.valEl.textContent = this.fmt(); }
}

// ---------------------------------------------------------------- knob
const ARC = (cx, cy, r, a0, a1) => {
  const p = (a) => [cx + r * Math.cos((a * Math.PI) / 180), cy + r * Math.sin((a * Math.PI) / 180)];
  const [x0, y0] = p(a0), [x1, y1] = p(a1);
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
};
export class Knob extends ValueWidget {
  build() {
    this._init();
    this.body.classList.add('oav-knob', 'svg');
    this.body.innerHTML = `<svg viewBox="0 0 100 100"><path class="arc-bg" d="${ARC(50, 50, 38, 135, 405)}"/><path class="arc-v" pathLength="100" d="${ARC(50, 50, 38, 135, 405)}"/><circle class="dot" r="4.5"/></svg><div class="bigval"></div>`;
    this.arc = this.body.querySelector('.arc-v'); this.dot = this.body.querySelector('.dot'); this.big = this.body.querySelector('.bigval');
    let mode = null, startN = 0, startY = 0, lastA = 0;
    const ang = (e, r) => Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2));
    track(this.body, {
      down: (e, st) => {
        this._touch(true);
        if (this._isDoubleTap(e)) { st.skip = true; return this.reset(); }
        const r = this.body.getBoundingClientRect(), rad = Math.min(r.width, r.height) / 2;
        const d = Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2));
        // grab the rim → turn it (angle); grab the middle → drag it (vertical). Both feel
        // like the control you thought you were touching.
        mode = d > rad * 0.45 ? 'turn' : 'drag';
        startN = this.norm; startY = e.clientY; lastA = ang(e, r);
      },
      move: (e, st) => {
        if (st.skip) return;
        const r = this.body.getBoundingClientRect(), rad = Math.min(r.width, r.height) / 2;
        if (mode === 'turn') {
          let d = ang(e, r) - lastA; lastA = ang(e, r);
          if (d > Math.PI) d -= 2 * Math.PI; else if (d < -Math.PI) d += 2 * Math.PI;
          this.setNorm(this.norm + d / (1.5 * Math.PI));                 // 270° sweep = full range
        } else this.setNorm(startN + (startY - e.clientY) / (rad * 3));  // 1.5 knob-diameters = full range
      },
      up: () => this._touch(false),
    });
    this.paint();
  }
  paint() {
    this.arc.setAttribute('stroke-dasharray', `${this.norm * 100} 1000`);       // pathLength=100 IS the 270° sweep: value 1 = the whole arc, same angle as the dot; the long gap keeps a second round cap from appearing at the far end when the dash is 0
    const a = ((135 + this.norm * 270) * Math.PI) / 180;
    this.dot.setAttribute('cx', (50 + 38 * Math.cos(a)).toFixed(2)); this.dot.setAttribute('cy', (50 + 38 * Math.sin(a)).toFixed(2));
    this.big.textContent = this.fmt(); this.valEl.textContent = '';
  }
}

// ---------------------------------------------------------------- encoder (endless)
export class Encoder extends Widget {
  build() {
    this.phase = 0; this.turns = 0;
    this.body.classList.add('oav-knob', 'svg');
    const ticks = Array.from({ length: 24 }, (_, i) => { const a = (i * 15 * Math.PI) / 180; const r0 = i % 6 ? 36 : 32;
      return `<line x1="${50 + r0 * Math.sin(a)}" y1="${50 - r0 * Math.cos(a)}" x2="${50 + 40 * Math.sin(a)}" y2="${50 - 40 * Math.cos(a)}" stroke="${i % 6 ? 'var(--oav-line)' : 'var(--c)'}" stroke-width="${i % 6 ? 2 : 3}" stroke-linecap="round"/>`; }).join('');
    this.body.innerHTML = `<svg viewBox="0 0 100 100"><g class="rot" style="transform-origin:50px 50px">${ticks}</g><circle cx="50" cy="50" r="22" fill="var(--oav-surface-2)"/><circle cx="50" cy="12" r="3.5" fill="#fff"/></svg><div class="bigval"></div>`;
    this.rot = this.body.querySelector('.rot'); this.big = this.body.querySelector('.bigval');
    let last = 0;
    const ang = (e) => { const r = this.body.getBoundingClientRect(); return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)); };
    track(this.body, {
      down: (e) => { this._touch(true); last = ang(e); },
      move: (e) => {
        let d = ang(e) - last; last = ang(e);
        if (d > Math.PI) d -= 2 * Math.PI; else if (d < -Math.PI) d += 2 * Math.PI;
        const dt = d / (2 * Math.PI);                       // turns
        this.turns += dt; this.phase = ((this.turns % 1) + 1) % 1; this.paint();
        this.ctx.out(this.sig(), this.phase, { raw: +this.turns.toFixed(4) });
        this.ctx.out(this.sig('delta'), +dt.toFixed(5));
      },
      up: () => this._touch(false),
    });
    this.paint();
  }
  paint() { this.rot.style.transform = `rotate(${this.turns * 360}deg)`; this.big.textContent = this.turns.toFixed(2); }
}

// ---------------------------------------------------------------- button / toggle
export class Button extends Widget {
  build() {
    this.body.classList.add('oav-btn');
    this.body.innerHTML = `<div class="face"></div>`;
    this.body.firstChild.textContent = this.spec.text ?? this.label;
    this.el.querySelector('.oav-head')?.remove();
    this.el.classList.add('nohead'); this.body.style.margin = '6px';
    this.on = false;
    track(this.body, {
      down: () => this.set(true), up: () => this.set(false),
    });
  }
  set(on, emit = true) {
    if (on === this.on) return; this.on = on;
    this.body.classList.toggle('active', on); this._touch(on);
    if (emit) { this.ctx.out(this.sig(), on ? 1 : 0); if (on) this.ctx.haptic(10); }
  }
  feedbackTargets() { return [[this.sig(), (v) => { if (!this._touching) { this.on = v > 0.5; this.body.classList.toggle('active', this.on); } }]]; }
}
export class Toggle extends Widget {
  build() {
    this.body.classList.add('oav-toggle', 'oav-btn');
    this.body.innerHTML = `<div class="face"><div class="sw"></div></div>`;
    this.el.classList.remove('oav-btn');
    this.on = (this.spec.def ?? this.spec.default ?? 0) >= 0.5;
    this.valEl.textContent = '';
    track(this.body, { down: () => { this._touch(true); this.set(!this.on); }, up: () => this._touch(false) });
    this.paint();
  }
  set(on, emit = true) { this.on = !!on; this.paint(); if (emit) { this.ctx.out(this.sig(), this.on ? 1 : 0); this.ctx.haptic(14); } }
  paint() { this.body.classList.toggle('on', this.on); this.valEl.textContent = this.on ? 'ON' : 'OFF'; }
  feedbackTargets() { return [[this.sig(), (v) => { if (!this.busy) this.set(v > 0.5, false); }]]; }
}

// ---------------------------------------------------------------- xy pad
export class XY extends Widget {
  build() {
    this.body.classList.add('oav-xy');
    this.body.innerHTML = `<div class="pad"><div class="hx"></div><div class="hy"></div></div><div class="puck"></div>`;
    this.x = this.spec.defX ?? 0.5; this.y = this.spec.defY ?? 0.5;
    this.spring = !!this.spec.spring;
    const at = (e) => { const r = this.body.getBoundingClientRect(); return [clamp((e.clientX - r.left) / r.width), clamp(1 - (e.clientY - r.top) / r.height)]; };
    const put = (x, y) => { this.x = x; this.y = y; this.paint(); this.ctx.out(this.sig('x'), x); this.ctx.out(this.sig('y'), y); };
    track(this.body, {
      down: (e) => { this._touch(true); this.body.classList.add('down'); this.ctx.out(this.sig('down'), 1); put(...at(e)); },
      move: (e) => put(...at(e)),
      up: () => {
        this._touch(false); this.body.classList.remove('down'); this.ctx.out(this.sig('down'), 0);
        if (this.spring) put(0.5, 0.5);
      },
    });
    this.paint();
  }
  paint() { this.body.style.setProperty('--x', this.x); this.body.style.setProperty('--y', this.y); this.valEl.textContent = `${this.x.toFixed(2)} · ${this.y.toFixed(2)}`; }
  feedbackTargets() {
    return [[this.sig('x'), (v) => { if (!this.busy) { this.x = clamp(v); this.paint(); } }], [this.sig('y'), (v) => { if (!this.busy) { this.y = clamp(v); this.paint(); } }]];
  }
}

// ---------------------------------------------------------------- bank (multi-fader)
export class Bank extends Widget {
  build() {
    const n = this.n = this.spec.count ?? 8;
    this.vals = Array.from({ length: n }, () => this.spec.def ?? 0);
    this.body.classList.add('oav-bank');
    this.body.innerHTML = `<div class="chs">${Array.from({ length: n }, (_, i) => `<div class="ch"><div class="fill"></div><div class="n">${(this.spec.labels?.[i]) ?? i + 1}</div></div>`).join('')}</div>`;
    this.chs = [...this.body.querySelectorAll('.ch')];
    this.valEl.textContent = '';
    // one finger can PAINT a curve across channels; several fingers set several channels
    const set = (e) => {
      const r = this.body.getBoundingClientRect();
      const i = Math.min(n - 1, Math.max(0, Math.floor(((e.clientX - r.left) / r.width) * n)));
      const v = clamp(1 - (e.clientY - r.top) / r.height);
      if (v !== this.vals[i]) { this.vals[i] = v; this.paint(i); this.ctx.out(this.sig(String(i + 1)), v); }
    };
    track(this.body, { down: (e) => { this._touch(true); set(e); }, move: set, up: () => this._touch(false) });
    this.vals.forEach((_, i) => this.paint(i));
  }
  paint(i) { this.chs[i].style.setProperty('--v', this.vals[i]); }
  feedbackTargets() { return this.vals.map((_, i) => [this.sig(String(i + 1)), (v) => { if (!this.busy) { this.vals[i] = clamp(v); this.paint(i); } }]); }
}

// ---------------------------------------------------------------- radio / segmented
export class Radio extends Widget {
  build() {
    this.opts = this.spec.options || ['A', 'B', 'C'];
    this.body.classList.add('oav-radio');
    this.body.innerHTML = `<div class="opts">${this.opts.map((o) => `<div class="opt">${String(o).replace(/</g, '&lt;')}</div>`).join('')}</div>`;
    this.optEls = [...this.body.querySelectorAll('.opt')];
    this.idx = Math.max(0, Math.min(this.opts.length - 1, Math.round(this.spec.def ?? this.spec.default ?? 0)));
    this.valEl.textContent = '';
    this.orient = this.spec.orient || 'auto';
    this.optEls.forEach((el, i) => track(el, { down: () => { this._touch(true); this.select(i); }, up: () => this._touch(false) }));
    this.paint();
  }
  resize(w, hh) { if (this.orient === 'auto') this.body.classList.toggle('col', hh > w * 0.9 && this.opts.length > 1); else this.body.classList.toggle('col', this.orient === 'v'); }
  select(i, emit = true) {
    if (i === this.idx && emit) return;
    this.idx = i; this.paint();
    if (emit) { const n = this.opts.length; this.ctx.out(this.sig(), n > 1 ? i / (n - 1) : 0, { raw: i }); this.ctx.haptic(10); }
  }
  paint() { this.optEls.forEach((el, i) => el.classList.toggle('on', i === this.idx)); }
  feedbackTargets() { return [[this.sig(), (v) => { if (!this.busy) this.select(Math.round(clamp(v) * (this.opts.length - 1)), false); }]]; }
}

// ---------------------------------------------------------------- pads (N×M, velocity)
export class Pads extends Widget {
  build() {
    const rows = this.rows = this.spec.rows ?? 4, cols = this.cols = this.spec.cols ?? 4;
    this.body.classList.add('oav-pads');
    this.body.innerHTML = `<div class="grid" style="grid-template-columns:repeat(${cols},1fr);grid-template-rows:repeat(${rows},1fr)">${
      Array.from({ length: rows * cols }, (_, i) => `<div class="pd"><span>${this.spec.labels?.[i] ?? ''}</span></div>`).join('')}</div>`;
    this.pds = [...this.body.querySelectorAll('.pd')];
    this.valEl.textContent = '';
    this.pds.forEach((el, i) => {
      track(el, {
        down: (e) => {
          this._touch(true);
          // velocity = where on the pad you hit it: top edge soft → bottom edge hard.
          // (Same rule as the keyboard: a finger has no pressure sensor, but it has a y.)
          const r = el.getBoundingClientRect(); const vel = +clamp(0.08 + 0.92 * ((e.clientY - r.top) / r.height), 0.05, 1).toFixed(3);
          el.style.setProperty('--vel', vel); el.classList.add('hit');
          const row = Math.floor(i / cols), col = i % cols;
          this.ctx.out(this.sig('hit'), { pad: i, row, col, vel }, { pulse: true });
          this.ctx.out(this.sig(String(i)), vel);
          this.ctx.haptic(8 + Math.round(vel * 12));
        },
        up: () => { el.classList.remove('hit'); this.ctx.out(this.sig(String(i)), 0); this._touch(false); },
      });
    });
  }
}

// ---------------------------------------------------------------- keyboard
// Wraps @openav/keys' KeysPiano — it already owns key geometry, glissando and
// the midi/note signal shape. This adds what a phone needs on top: shape
// (1 row wide / 2 rows tall, kbplan.js), vertical velocity, multi-touch is
// native pointer events, octave shift, a hold-to-sustain pedal.
export class Keyboard extends Widget {
  build() {
    this.body.remove(); this.head.remove();
    this.el.classList.add('oav-kb', 'nohead');
    this.base = this.spec.base ?? 48;
    this.sustain = false; this.held = new Set(); this.sounding = new Set(); this.sustained = new Set();
    this.bar = h('div', 'bar');
    this.bar.innerHTML = `<div class="b dn">−</div><div class="oct"></div><div class="b up">+</div><div style="flex:1"></div><div class="b sus">SUST</div>`;
    this.rowsEl = h('div', 'rows'); const wrap = h('div', 'oav-body'); wrap.appendChild(this.rowsEl);
    this.el.append(this.bar, wrap);
    this.octEl = this.bar.querySelector('.oct');
    const btn = (sel, fn, up) => track(this.bar.querySelector(sel), { down: () => fn(true), up: () => (up || fn)(false) });
    btn('.dn', (d) => { if (d) this.shift(-12); }, () => {});
    btn('.up', (d) => { if (d) this.shift(12); }, () => {});
    btn('.sus', (d) => this.setSustain(d));
    this.pianos = [];
    this.w = 0; this.hh = 0;
  }
  resize(w, hh) { this.w = w; this.hh = hh; this.layoutRows(); }
  shift(d) {
    const nb = Math.max(24, Math.min(72, this.base + d));
    if (nb === this.base) return;
    this.releaseAll(); this.base = nb; this.layoutRows(); this.ctx.haptic(8);
  }
  layoutRows() {
    if (!this.w) return;
    const width = this.rowsEl.clientWidth || this.w - 16, height = this.rowsEl.clientHeight || this.hh;
    const plan = planKeyboard({ width, height, base: this.base, minKeyPx: this.spec.minKeyPx ?? 38, forceRows: this.spec.rows || 0 });
    const sig = JSON.stringify(plan.rows);
    this.octEl.textContent = 'C' + (Math.floor(this.base / 12) - 1);
    if (sig === this._sig) return;
    this._sig = sig;
    this.releaseAll();
    this.rowsEl.innerHTML = ''; this.pianos = [];
    this.el.dataset.rows = plan.rows.length;
    for (const row of plan.rows) {
      const slot = h('div', 'row'), pe = h('div'); slot.appendChild(pe); this.rowsEl.appendChild(slot);
      const piano = new KeysPiano(pe, {
        base: row.base, semitones: row.semitones, fill: true, minBase: 0, maxBase: 127,
        onNote: (note, vel01, on) => this.note(note, vel01, on),
      });
      // vertical velocity: capture phase, before KeysPiano's own pointerdown handler reads piano.velocity
      const setVel = (e) => {
        const k = e.target?.closest?.('.pk-key'); if (!k) return;
        const r = k.getBoundingClientRect();
        piano.velocity = Math.round(1 + 126 * clamp((e.clientY - r.top) / r.height));
      };
      pe.addEventListener('pointerdown', setVel, true);
      pe.addEventListener('pointerenter', setVel, true);
      this.pianos.push(piano);
    }
  }
  // every note also travels as `midi/virtual` (the raw bytes): a host that hands old Web MIDI
  // sketches a virtual input (the lab's shim) plays them — the sketch's own code hears a keyboard
  off(note) { this.ctx.out('midi/note/off', { note, ch: 1, device: 'surface' }, { pulse: true }); this.ctx.out('midi/virtual', { data: [0x80, note, 0], device: 'surface' }, { pulse: true }); }
  note(note, vel01, on) {
    if (on) {
      if (this.sustained.delete(note)) this.off(note);   // re-strike of a pedal-held note
      this.sounding.add(note);
      const velocity = Math.max(1, Math.min(127, Math.round(vel01 * 127)));
      this.ctx.out('midi/note/on', { note, vel: velocity / 127, velocity, ch: 1, device: 'surface' }, { pulse: true });
      this.ctx.out('midi/virtual', { data: [0x90, note, velocity], device: 'surface' }, { pulse: true });
      this.setActive(true);
    } else {
      this.sounding.delete(note);
      if (this.sustain) this.sustained.add(note);
      else this.off(note);
      if (!this.sounding.size) this.setActive(false);
    }
  }
  setSustain(on) {
    this.sustain = on; this.bar.querySelector('.sus').classList.toggle('active', on);
    this.ctx.out('midi/cc/64', on ? 1 : 0);                        // same name/shape as @openav/midi's pedal
    this.ctx.out('midi/virtual', { data: [0xb0, 64, on ? 127 : 0], device: 'surface' }, { pulse: true });
    if (!on) { for (const n of this.sustained) this.off(n); this.sustained.clear(); }
    this.ctx.haptic(10);
  }
  releaseAll() { for (const p of this.pianos) p.releaseAll(); for (const n of this.sustained) this.off(n); this.sustained.clear(); }
  destroy() { this.releaseAll(); super.destroy(); }
}

// ---------------------------------------------------------------- number box
export class NumberBox extends ValueWidget {
  build() {
    this._init();
    this.body.classList.add('oav-num');
    this.body.innerHTML = `<div class="nb"><button type="button">−</button><input class="in" inputmode="decimal"><button type="button">+</button></div>`;
    const [dn, up] = this.body.querySelectorAll('button'); this.inp = this.body.querySelector('input');
    const inc = this.step || (this.max - this.min) / 100;
    const nudge = (dir) => this.setNorm(this.toNorm(this.toRaw(this.norm) + dir * inc));
    for (const [b, d] of [[dn, -1], [up, 1]]) {
      let t = null, iv = null;
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); nudge(d); this.ctx.haptic(6); t = setTimeout(() => { iv = setInterval(() => nudge(d), 70); }, 350); });
      const stop = () => { clearTimeout(t); clearInterval(iv); };
      b.addEventListener('pointerup', stop); b.addEventListener('pointerleave', stop); b.addEventListener('pointercancel', stop);
    }
    const commit = () => { const v = parseFloat(this.inp.value); if (Number.isFinite(v)) this.setNorm(this.toNorm(v)); this.paint(); };
    this.inp.addEventListener('change', commit);
    this.inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.inp.blur(); });
    this.valEl.textContent = this.unit;
    this.paint();
  }
  paint() { if (document.activeElement !== this.inp) this.inp.value = this.toRaw(this.norm).toFixed(this.dec); }
}

// ---------------------------------------------------------------- text input
export class TextInput extends Widget {
  build() {
    this.body.classList.add('oav-text');
    this.body.innerHTML = `<div class="tb"><input class="in" type="text" autocomplete="off" autocapitalize="off" enterkeyhint="send"><button type="button">↵</button></div>`;
    this.inp = this.body.querySelector('input'); this.inp.placeholder = this.spec.placeholder || '';
    const send = () => { const v = this.inp.value; if (v === '') return; this.ctx.out(this.sig(), v, { pulse: true }); if (this.spec.clear !== false) this.inp.value = ''; this.ctx.haptic(10); };
    this.inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { send(); this.inp.blur(); } });
    this.body.querySelector('button').addEventListener('pointerdown', (e) => { e.preventDefault(); send(); });
    this.valEl.textContent = '';
  }
}

// ---------------------------------------------------------------- label (receive-only)
export class Label extends Widget {
  build() {
    this.el.classList.add('nohead'); this.head.remove();
    this.body.classList.add('oav-label'); this.body.style.margin = '0';
    this.body.innerHTML = '<div class="txt"></div>'; this.txt = this.body.firstChild;
    this.txt.textContent = this.spec.text ?? this.label;
  }
  feedbackTargets() { return [[this.sig(), (v) => { this.txt.textContent = typeof v === 'number' ? v.toFixed(this.spec.decimals ?? 2) : String(v); }]]; }
}

// ---------------------------------------------------------------- meter (receive-only, bidirectional half)
export class Meter extends Widget {
  build() {
    this.min = this.spec.min ?? 0; this.max = this.spec.max ?? 1; this.v = 0; this.peak = 0;
    this.body.classList.add('oav-meter');
    this.body.innerHTML = '<div class="trk"><div class="fill"></div><div class="peak"></div></div>';
    this.orient = this.spec.orient || 'auto';
    this.paint();
  }
  resize(w, hh) { if (this.orient === 'auto') this.body.classList.toggle('h', w > hh * 1.15); else this.body.classList.toggle('h', this.orient === 'h'); }
  set(n) {
    this.v = clamp(n);
    if (this.v >= this.peak) { this.peak = this.v; this._hold = performance.now() + 900; }
    if (!this._iv) this._iv = setInterval(() => {
      if (performance.now() > this._hold) this.peak = Math.max(this.v, this.peak - 0.04);
      this.paint(); if (this.peak <= this.v) { clearInterval(this._iv); this._iv = null; }
    }, 50);
    this.paint();
  }
  paint() {
    this.body.style.setProperty('--v', this.v); this.body.style.setProperty('--p', this.peak);
    this.valEl.textContent = (this.min + this.v * (this.max - this.min)).toFixed(2);
  }
  feedbackTargets() { return [[this.sig(), (v) => { if (typeof v === 'number') this.set(v); }]]; }
  destroy() { clearInterval(this._iv); super.destroy(); }
}

export const WIDGET_CLASSES = {
  fader: Fader, knob: Knob, encoder: Encoder, button: Button, toggle: Toggle, xy: XY, bank: Bank,
  radio: Radio, pads: Pads, keyboard: Keyboard, number: NumberBox, text: TextInput, label: Label, meter: Meter,
};
