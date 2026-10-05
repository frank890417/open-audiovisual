// @openav/midi · view — the on-screen controller (a faceplate you can play,
// and that your hardware plays in front of you).
//
//   const view = new ControllerView(el, controller);   // fills `el`, follows its size
//
// Two shapes, chosen from the box it lives in:
//   face   the device as it looks: sections where they sit on the real
//          faceplate, scaled to fit (desktop, iPad, phone held sideways)
//   stack  the same controls re-gridded top-to-bottom for a tall box (phone
//          held upright) — profile.portrait says how; nothing scrolls, nothing
//          shrinks below a thumb. Launchpad-like square devices stay `face`.
// Every control repaints from controller state: a finger here and a knob on
// the desk look the same, and hardware moves get a brief glow ring so you can
// see your hand arrive on screen.
//
// Inside a shadow root (<oav-controller>) the CSS goes into that root, not the
// page. Keyboard: Tab reaches every control except piano keys; arrows / Page
// keys / Home / End move knobs, faders and strips; Space or Enter strikes pads
// and buttons (held while the key is held).

/** The named control colours a profile may use (`color: "amber"`); `tint` takes any CSS colour. */
export const CONTROL_COLORS = { cyan: '#35d4e6', amber: '#ffb547', magenta: '#ff5fb3', lime: '#7be25b', violet: '#a58bff', coral: '#ff6b57', white: '#e8ecf5' };
const COLORS = CONTROL_COLORS;
const BLACK = new Set([1, 3, 6, 8, 10]);
const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const isWhite = (n) => !BLACK.has(((n % 12) + 12) % 12);
const noteName = (n) => NAMES[((n % 12) + 12) % 12] + (Math.floor(n / 12) - 1);
const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export const VIEW_CSS = `
.mcv { position: relative; width: 100%; height: 100%; overflow: hidden; touch-action: none; -webkit-user-select: none; user-select: none;
  -webkit-tap-highlight-color: transparent; font-family: system-ui, -apple-system, 'Helvetica Neue', sans-serif; color: #e8ecf5; --u: 6px; }
.mcv * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
.mcv-face { position: absolute; border-radius: calc(var(--u) * 2.2); background: var(--body, #1b1d22);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.07), inset 0 -2px 0 rgba(0,0,0,.35), 0 10px 40px -12px rgba(0,0,0,.8); }
.mcv-face.stack { inset: 0; border-radius: 0; background: transparent; box-shadow: none; display: flex; flex-direction: column; gap: calc(var(--u) * 1.2); padding: calc(var(--u) * 1.2); }
.mcv-flabel { position: absolute; left: calc(var(--u) * 2); top: calc(var(--u) * .6); font: 700 calc(var(--u) * 1.5)/1 system-ui, sans-serif; letter-spacing: .12em;
  text-transform: uppercase; color: rgba(255,255,255,.38); pointer-events: none; white-space: nowrap; }
.mcv-face.stack .mcv-flabel { display: none; }
.mcv-sec { position: absolute; display: flex; flex-direction: column; min-width: 0; min-height: 0; }
.mcv-face.stack .mcv-sec { position: relative; flex: var(--w, 1) 1 0; left: auto !important; top: auto !important; width: auto !important; height: auto !important; }
.mcv-slabel { flex: none; font: 600 calc(var(--u) * 1.15)/1.2 system-ui, sans-serif; letter-spacing: .14em; text-transform: uppercase; color: rgba(255,255,255,.34); padding: 0 0 calc(var(--u) * .4) calc(var(--u) * .3); white-space: nowrap; }
.mcv-face.stack .mcv-slabel { display: none; }
.mcv-grid { flex: 1; min-height: 0; display: grid; gap: calc(var(--u) * .7); }
.mcv-c { position: relative; min-width: 0; min-height: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; --c: #7ea6ff; cursor: pointer; }
.mcv-lbl { flex: none; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: 600 calc(var(--u) * 1.15)/1.2 system-ui, sans-serif;
  color: rgba(255,255,255,.55); margin-top: calc(var(--u) * .25); pointer-events: none; }
.mcv-c.unv .mcv-lbl::after { content: '?'; margin-left: .2em; color: #f5a524; }
/* hardware arrived: a ring that fades */
@keyframes mcv-hw { from { box-shadow: 0 0 0 calc(var(--u) * .35) var(--c), 0 0 calc(var(--u) * 3) var(--c); } to { box-shadow: 0 0 0 0 transparent, 0 0 0 transparent; } }
.mcv-c.hw .mcv-hit { animation: mcv-hw .7s ease-out; }
.mcv.learning .mcv-c .mcv-hit { outline: 1px dashed rgba(255,255,255,.35); outline-offset: 2px; }
@keyframes mcv-arm { 50% { outline-color: #f5a524; } }
.mcv-c.armed .mcv-hit { outline: 2px solid #f5a524 !important; animation: mcv-arm .8s infinite; }
.mcv-c.learned .mcv-lbl { color: #f5a524; }
.mcv-c:focus { outline: none; }
.mcv-c:focus-visible .mcv-hit { outline: 2px solid var(--oav-focus, #ff5a1f); outline-offset: 2px; }

/* knob / encoder */
.mcv-dial { position: relative; flex: 1 1 0; min-height: 0; aspect-ratio: 1; max-width: 100%; border-radius: 50%; }
.mcv-dial svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
.mcv-dial .cap { fill: #2a2d35; stroke: #0d0e11; stroke-width: 2; }
.mcv-dial .cap2 { fill: url(#mcv-cap); }
.mcv-dial .bg { fill: none; stroke: rgba(255,255,255,.09); stroke-width: 7; stroke-linecap: round; }
.mcv-dial .arc { fill: none; stroke: var(--c); stroke-width: 7; stroke-linecap: round; filter: drop-shadow(0 0 3px var(--c)); }
.mcv-dial .ptr { stroke: #fff; stroke-width: 4.5; stroke-linecap: round; }
.mcv-dial .tick { stroke: rgba(255,255,255,.25); stroke-width: 2; }
.mcv-dial .num { position: absolute; left: 0; right: 0; bottom: -2%; text-align: center; font: 600 calc(var(--u) * 1.05)/1 ui-monospace, Menlo, monospace;
  color: rgba(255,255,255,.0); transition: color .2s; pointer-events: none; font-variant-numeric: tabular-nums; }
.mcv-c:hover .num, .mcv-c.active .num, .mcv-c.hw .num { color: var(--c); }

/* fader */
.mcv-fader { position: relative; flex: 1 1 0; min-height: 0; width: 100%; max-width: calc(var(--u) * 7); }
.mcv-fader { --pad: calc(var(--u) * 1.3); }
.mcv-fader .slot { position: absolute; left: 50%; top: var(--pad); bottom: var(--pad); width: calc(var(--u) * .9); transform: translateX(-50%); border-radius: 99px; background: #0b0c0f; box-shadow: inset 0 1px 2px #000; }
.mcv-fader .fill { position: absolute; left: 50%; bottom: var(--pad); width: calc(var(--u) * .9); height: calc(var(--v, 0) * (100% - var(--pad) * 2)); transform: translateX(-50%); border-radius: 99px;
  background: var(--c); opacity: .85; box-shadow: 0 0 calc(var(--u) * 1.2) var(--c); }
.mcv-fader .cap { position: absolute; left: 50%; width: min(100%, calc(var(--u) * 5.5)); height: calc(var(--u) * 2.4); transform: translate(-50%, 50%);
  bottom: calc(var(--pad) + var(--v, 0) * (100% - var(--pad) * 2)); border-radius: calc(var(--u) * .5); background: linear-gradient(#4a4e58, #2a2d34); border: 1px solid #0d0e11;
  box-shadow: 0 2px 4px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.12); }
.mcv-fader .cap::after { content: ''; position: absolute; left: 12%; right: 12%; top: 50%; height: 2px; margin-top: -1px; background: #fff; border-radius: 1px; }

/* pad */
.mcv-pad { position: relative; flex: 1 1 0; min-height: 0; width: 100%; border-radius: calc(var(--u) * .9); background: #25282f;
  box-shadow: inset 0 0 0 1px rgba(255,255,255,.06), inset 0 -3px 0 rgba(0,0,0,.35); overflow: hidden; }
.mcv-pad::before { content: ''; position: absolute; inset: 0; background: var(--c); opacity: var(--idle, 0); transition: opacity .5s ease-out; }
.mcv-pad::after { content: ''; position: absolute; inset: 0; background: radial-gradient(circle at 50% 55%, #fff, var(--c) 55%); opacity: 0; transition: opacity .45s ease-out; }
.mcv-c.on .mcv-pad::after { opacity: calc(.35 + var(--vel, 1) * .65); transition: none; }
.mcv-c.on .mcv-pad { box-shadow: 0 0 calc(var(--u) * 2.4) var(--c), inset 0 0 0 1px rgba(255,255,255,.3); }
.mcv-pad .pr { position: absolute; left: 0; bottom: 0; height: 3px; width: calc(var(--p, 0) * 100%); background: #fff; opacity: .85; z-index: 2; }
.mcv-pad .pl { position: absolute; left: calc(var(--u) * .6); bottom: calc(var(--u) * .4); z-index: 1; font: 600 calc(var(--u) * 1.05)/1 system-ui, sans-serif; color: rgba(255,255,255,.45); pointer-events: none; }
.mcv-c.padc .mcv-lbl { display: none; }

/* stack mode: pads stay square-ish however tall the row is */
.mcv-face.stack .mcv-c.padc { container-type: size; }
.mcv-face.stack .mcv-c.padc .mcv-pad { flex: none; width: min(100cqw, 100cqh * 1.8); height: min(100cqh, 100cqw); }

/* button */
.mcv-btn { position: relative; flex: 1 1 0; min-height: 0; width: 100%; max-height: calc(var(--u) * 5); border-radius: calc(var(--u) * .6); background: #2b2e36;
  box-shadow: inset 0 0 0 1px rgba(255,255,255,.07), 0 2px 0 #0c0d10; display: grid; place-items: center; font: 700 calc(var(--u) * 1.15)/1 system-ui, sans-serif;
  color: rgba(255,255,255,.62); letter-spacing: .03em; overflow: hidden; white-space: nowrap; }
.mcv-btn.round { border-radius: 50%; aspect-ratio: 1; width: auto; max-width: 100%; max-height: 100%; font-size: calc(var(--u) * 1.05); }
.mcv-c.on .mcv-btn { background: var(--c); color: #0b0c0f; box-shadow: 0 0 calc(var(--u) * 1.8) var(--c); }
.mcv-c.btnc .mcv-lbl { display: none; }

/* wheel / strip */
.mcv-strip { position: relative; flex: 1 1 0; min-height: 0; width: 100%; max-width: calc(var(--u) * 4.2); border-radius: calc(var(--u) * .8); background: #101115;
  box-shadow: inset 0 1px 3px #000, inset 0 0 0 1px rgba(255,255,255,.05); overflow: hidden; }
.mcv-strip .mid { position: absolute; left: 15%; right: 15%; top: 50%; height: 1px; background: rgba(255,255,255,.18); }
.mcv-strip .bar { position: absolute; left: 0; right: 0; background: var(--c); opacity: .3; }
.mcv-strip .th { position: absolute; left: 8%; right: 8%; height: calc(var(--u) * .7); margin-top: calc(var(--u) * -.35); border-radius: 99px; background: var(--c);
  box-shadow: 0 0 calc(var(--u) * 1.4) var(--c); top: calc((1 - var(--y, 0)) * 100%); }

/* keys */
.mcv-c.t-keys { align-items: stretch; }
.mcv-keys { position: relative; flex: 1 1 0; min-height: 0; width: 100%; display: flex; flex-direction: column; gap: calc(var(--u) * .6); }
.mcv-krow { position: relative; flex: 1 1 0; min-height: 0; }
.mcv-k { position: absolute; top: 0; height: 100%; border-radius: 0 0 calc(var(--u) * .45) calc(var(--u) * .45); background: linear-gradient(#f3f4f7, #dcdfe6);
  border: 1px solid #1a1c22; box-shadow: inset 0 -3px 0 #b9bdc7; }
.mcv-k.b { height: 60%; z-index: 2; background: linear-gradient(#2d3039, #15171c); border-color: #08090b; box-shadow: inset 0 -2px 0 #444; border-radius: 0 0 calc(var(--u) * .3) calc(var(--u) * .3); }
.mcv-k.on { background: linear-gradient(color-mix(in srgb, var(--c) 60%, #fff), var(--c)); box-shadow: 0 0 calc(var(--u) * 1.6) var(--c); }
.mcv-k.b.on { background: var(--c); }
.mcv-k .kn { position: absolute; left: 0; right: 0; bottom: calc(var(--u) * .5); text-align: center; font: 600 calc(var(--u) * 1)/1 system-ui, sans-serif; color: #8a8f9c; pointer-events: none; }
.mcv-oct { flex: none; order: -1; align-self: stretch; display: flex; justify-content: flex-end; align-items: center; gap: calc(var(--u) * .4); margin-bottom: calc(var(--u) * .4); }
.mcv-oct button { min-width: calc(var(--u) * 3.6); height: calc(var(--u) * 2.6); padding: 0 calc(var(--u) * .6); border-radius: calc(var(--u) * .5); border: 1px solid rgba(255,255,255,.14);
  background: #22252c; color: #cfd6e4; font: 700 calc(var(--u) * 1.1)/1 ui-monospace, monospace; touch-action: manipulation; }
.mcv-oct span { align-self: center; font: 600 calc(var(--u) * 1.1)/1 ui-monospace, monospace; color: var(--c); min-width: calc(var(--u) * 5); text-align: center; }

/* decorations */
.mcv-deco { position: absolute; pointer-events: none; }
.mcv-deco.screen { border-radius: calc(var(--u) * .5); background: #050607; box-shadow: inset 0 0 0 1px rgba(255,255,255,.06); display: grid; place-items: center;
  font: 600 calc(var(--u) * 1.3)/1.25 ui-monospace, monospace; color: #9fd3ff; text-align: center; padding: calc(var(--u) * .4); overflow: hidden; }
.mcv-deco.screen small { display: block; color: #6c7a8c; font-size: .8em; }
.mcv-deco.logo { border-radius: calc(var(--u) * .5); background: conic-gradient(#ff4b4b, #ffea00, #15ff00, #35d4e6, #a8a1ff, #ff4b4b); opacity: .55; }
.mcv-deco.buttons { display: flex; gap: calc(var(--u) * .6); }
.mcv-deco.buttons i { flex: 1; border-radius: calc(var(--u) * .4); background: #2b2e36; font: 600 calc(var(--u) * 1)/1 system-ui, sans-serif; font-style: normal;
  color: rgba(255,255,255,.4); display: grid; place-items: center; }
.mcv-deco.label { display: flex; align-items: center; font: 700 calc(var(--u) * 1.2)/1 system-ui, sans-serif; letter-spacing: .12em; text-transform: uppercase;
  color: rgba(255,255,255,.36); white-space: nowrap; overflow: hidden; }
@media (prefers-reduced-motion: reduce) { .mcv *, .mcv *::before, .mcv *::after { animation: none !important; transition: none !important; } }
`;

/** The view's CSS, once per document — or once per shadow root, when the view lives inside one. */
function injectCss(node) {
  if (typeof document === 'undefined') return;
  const root = node && node.getRootNode ? node.getRootNode() : document;
  const inShadow = typeof ShadowRoot !== 'undefined' && root instanceof ShadowRoot;
  if ((inShadow ? root : document).querySelector('#openav-midi-view-css')) return;
  const s = document.createElement('style'); s.id = 'openav-midi-view-css'; s.textContent = VIEW_CSS;
  (inShadow ? root : document.head).appendChild(s);
}

/** Pointer helper: capture, per-pointer state, multi-touch safe. */
function track(el, { down, move, up }) {
  el.addEventListener('pointerdown', (e) => {
    if (e.button > 0) return;
    e.preventDefault(); e.stopPropagation();
    try { el.setPointerCapture(e.pointerId); } catch { /* synthetic */ }
    const st = { id: e.pointerId, x0: e.clientX, y0: e.clientY };
    (el._ptr ||= new Map()).set(e.pointerId, st);
    down?.(e, st);
  });
  el.addEventListener('pointermove', (e) => { const st = el._ptr?.get(e.pointerId); if (st) { e.preventDefault(); move?.(e, st); } });
  const end = (e) => { const st = el._ptr?.get(e.pointerId); if (!st) return; el._ptr.delete(e.pointerId); up?.(e, st); };
  el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end); el.addEventListener('lostpointercapture', end);
}

const arcPath = (a0, a1, r = 40) => {
  const p = (a) => [50 + r * Math.cos((a * Math.PI) / 180), 50 + r * Math.sin((a * Math.PI) / 180)];
  const [x0, y0] = p(a0), [x1, y1] = p(a1);
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
};

export class ControllerView {
  /**
   * @param {HTMLElement} container
   * @param {import('./controller.js?v=e353777').MidiController} controller
   * @param {object} [o]
   * @param {'auto'|'face'|'stack'} [o.mode='auto']
   * @param {number} [o.minTouch=38]   px a control needs before `face` gives way to `stack`
   */
  constructor(container, controller, { mode = 'auto', minTouch = 38 } = {}) {
    injectCss(container);
    this.container = container; this.forced = mode; this.minTouch = minTouch;
    this.root = h('div', 'mcv');
    container.appendChild(this.root);
    this.els = new Map();
    this._ro = new ResizeObserver(() => this._fit());
    this._ro.observe(this.root);
    this.setController(controller);
  }

  setController(c) {
    this._unsub?.();
    this.c = c;
    this._unsub = c.onChange((id, st, info) => {
      if (info?.meta) return this._paintMeta();
      this._paint(id, info);
    });
    this.mode = null;
    this._fit(true);
  }
  setLearning(on) { this.learning = !!on; this.root.classList.toggle('learning', this.learning); this._paintMeta(); }
  /** 'auto' (choose from the box) | 'face' | 'stack'. */
  setMode(mode = 'auto') { this.forced = ['face', 'stack'].includes(mode) ? mode : 'auto'; this._fit(true); }

  // ---------------------------------------------------------------- layout
  _fit(force = false) {
    const W = this.root.clientWidth, H = this.root.clientHeight;
    if (!W || !H) return;
    const p = this.c.profile, f = p.face;
    const s = Math.min(W / f.w, H / f.h);
    // the smallest control's long side on the faceplate (a strip is narrow but tall — that is fine)
    const smallest = Math.min(...p.sections.map((sec) => Math.max(sec.w / sec.cols, (sec.h - (sec.label ? 2 : 0)) / sec.rows)));
    const fill = (f.w * s * f.h * s) / (W * H);
    // a wide box shows the device as it is (phone sideways included); a tall box re-grids it,
    // unless the faceplate already fills it (a square Launchpad on an upright phone)
    const wide = W >= H * 1.15;
    const faceOk = wide ? smallest * s >= this.minTouch * 0.8 : smallest * s >= this.minTouch && fill >= 0.55;
    let mode = this.forced !== 'auto' ? this.forced : (!p.stack || faceOk ? 'face' : 'stack');
    if (!p.stack && mode === 'stack') mode = 'face';
    const key = `${mode}:${W}x${H}`;
    if (!force && key === this._key) return;
    const rebuild = force || mode !== this.mode;
    this._key = key; this.mode = mode;
    if (rebuild) this._build();
    const u = mode === 'face' ? s : Math.max(4.5, Math.min(W, H * 0.75) / 52);
    this.root.style.setProperty('--u', u.toFixed(2) + 'px');
    if (mode === 'face') {
      const fw = f.w * s, fh = f.h * s;
      Object.assign(this.face.style, { width: fw + 'px', height: fh + 'px', left: (W - fw) / 2 + 'px', top: (H - fh) / 2 + 'px' });
    }
    for (const k of this.keyboards) k.layout();
  }

  _build() {
    const p = this.c.profile, stack = this.mode === 'stack';
    this.root.innerHTML = '';
    this.root.dataset.mode = this.mode; this.root.dataset.profile = p.id;
    this.els.clear(); this.keyboards = [];
    const face = this.face = h('div', 'mcv-face' + (stack ? ' stack' : ''));
    if (p.face.body) face.style.setProperty('--body', p.face.body);
    this.root.appendChild(face);
    if (!stack) {
      if (p.face.label) face.appendChild(h('div', 'mcv-flabel', esc(p.face.label)));
      for (const d of p.face.deco || []) face.appendChild(this._deco(d, p.face));
    }
    const secs = stack ? p.portrait : p.sections;
    for (const sec of secs) {
      const se = h('div', 'mcv-sec'); se.dataset.sec = sec.id;
      if (stack) se.style.setProperty('--w', sec.weight ?? 1);
      else Object.assign(se.style, { left: (sec.x / p.face.w) * 100 + '%', top: (sec.y / p.face.h) * 100 + '%', width: (sec.w / p.face.w) * 100 + '%', height: (sec.h / p.face.h) * 100 + '%' });
      if (sec.label) se.appendChild(h('div', 'mcv-slabel', esc(sec.label)));
      const g = h('div', 'mcv-grid');
      g.style.gridTemplateColumns = `repeat(${sec.cols}, minmax(0, 1fr))`;
      g.style.gridTemplateRows = `repeat(${sec.rows}, minmax(0, 1fr))`;
      g.style.gridAutoFlow = sec.flow === 'column' ? 'column' : 'row';
      for (const id of sec.controls) {
        const c = this.c.control(id); if (!c) continue;
        const el = this._control(c);
        const sp = sec.spans?.[id];
        if (sp) { el.style.gridColumn = `span ${sp[0]}`; el.style.gridRow = `span ${sp[1]}`; }
        g.appendChild(el);
      }
      se.appendChild(g); face.appendChild(se);
    }
    for (const c of p.controls) this._paint(c.id);
    this._paintMeta();
  }

  _deco(d, f) {
    const el = h('div', 'mcv-deco ' + d.type);
    Object.assign(el.style, { left: (d.x / f.w) * 100 + '%', top: (d.y / f.h) * 100 + '%', width: (d.w / f.w) * 100 + '%', height: (d.h / f.h) * 100 + '%' });
    if (d.type === 'screen') { el.innerHTML = `<div>${esc(d.text || '')}<small class="mon"></small></div>`; this.screen = el.querySelector('.mon'); }
    if (d.type === 'buttons') el.innerHTML = (d.items || []).map((t) => `<i>${esc(t)}</i>`).join('');
    if (d.type === 'label') el.textContent = d.text || '';     // printed lettering on the faceplate
    return el;
  }

  // ---------------------------------------------------------------- controls
  _control(c) {
    const el = h('div', `mcv-c t-${c.type}`); el.dataset.id = c.id;
    const col = c.tint || COLORS[c.color] || COLORS.cyan;
    el.style.setProperty('--c', col);
    // c.note is a remark on cc controls but the MIDI note number on note controls
    if (c.verified === false) { el.classList.add('unv'); el.title = (typeof c.note === 'string' && c.note) || '未經實機確認：可用「學習」重新對應 (unverified — use Learn)'; }
    const lbl = () => h('div', 'mcv-lbl', esc(c.label ?? c.id));
    const ui = { el };
    const learnTap = (e) => {
      if (!this.learning) return false;
      this.c.learn(c.id); this.onLearnTap?.(c.id); e?.preventDefault?.(); return true;
    };
    switch (c.type) {
      case 'knob': case 'encoder': {
        const endless = c.type === 'encoder' && c.relative;
        const ticks = endless ? Array.from({ length: 24 }, (_, i) => { const a = (i * 15 * Math.PI) / 180; return `<line class="tick" x1="${50 + 44 * Math.sin(a)}" y1="${50 - 44 * Math.cos(a)}" x2="${50 + 48 * Math.sin(a)}" y2="${50 - 48 * Math.cos(a)}"/>`; }).join('') : '';
        el.innerHTML = `<div class="mcv-dial mcv-hit"><svg viewBox="0 0 100 100">${ticks}${endless ? '' : `<path class="bg" d="${arcPath(135, 405)}"/><path class="arc" pathLength="100" d="${arcPath(135, 405)}"/>`}
          <circle class="cap" cx="50" cy="50" r="${endless ? 36 : 30}"/><g class="rot"><line class="ptr" x1="50" y1="${endless ? 20 : 26}" x2="50" y2="${endless ? 34 : 38}"/></g></svg><div class="num"></div></div>`;
        el.appendChild(lbl());
        ui.arc = el.querySelector('.arc'); ui.rot = el.querySelector('.rot'); ui.num = el.querySelector('.num');
        const dial = el.querySelector('.mcv-dial');
        let acc = 0, last = 0;
        track(dial, {
          down: (e, st) => { if (learnTap(e)) { st.skip = 1; return; } el.classList.add('active'); st.v0 = this.c.get(c.id).value; st.r = Math.max(120, dial.clientHeight * 2.6); acc = 0; last = 0; },
          move: (e, st) => {
            if (st.skip) return;
            const d = ((e.clientX - st.x0) - (e.clientY - st.y0)) / st.r;
            if (endless) { const steps = Math.trunc(d * 64) - last; if (steps) { last += steps; this.c.turn(c.id, steps); } }
            else this.c.setValue(c.id, clamp(st.v0 + d));
          },
          up: () => el.classList.remove('active'),
        });
        dial.addEventListener('wheel', (e) => { e.preventDefault(); const steps = Math.sign(-e.deltaY || e.deltaX) * (e.shiftKey ? 1 : 3);
          if (endless) this.c.turn(c.id, steps); else this.c.setValue(c.id, clamp(this.c.get(c.id).value + steps / 127)); }, { passive: false });
        void acc;
        break;
      }
      case 'fader': {
        el.innerHTML = `<div class="mcv-fader mcv-hit"><div class="slot"></div><div class="fill"></div><div class="cap"></div></div>`;
        el.appendChild(lbl());
        const f = ui.fader = el.querySelector('.mcv-fader');
        const at = (e) => { const r = f.getBoundingClientRect(), pad = (parseFloat(this.root.style.getPropertyValue('--u')) || 6) * 1.3; return clamp(1 - (e.clientY - r.top - pad) / (r.height - pad * 2)); };
        track(f, { down: (e, st) => { if (learnTap(e)) { st.skip = 1; return; } el.classList.add('active'); this.c.setValue(c.id, at(e)); },
          move: (e, st) => { if (!st.skip) this.c.setValue(c.id, at(e)); }, up: () => el.classList.remove('active') });
        f.addEventListener('wheel', (e) => { e.preventDefault(); this.c.setValue(c.id, clamp(this.c.get(c.id).value - Math.sign(e.deltaY) * 3 / 127)); }, { passive: false });
        break;
      }
      case 'pad': {
        el.classList.add('padc');
        el.innerHTML = `<div class="mcv-pad mcv-hit"><div class="pr"></div>${c.label ? `<span class="pl">${esc(c.label)}</span>` : ''}</div>`;
        const pad = ui.pad = el.querySelector('.mcv-pad');
        if (c.tint) el.style.setProperty('--idle', '.16');           // the TD Launchpad tool: idle racks glow at ~16 %
        track(pad, {
          down: (e, st) => {
            if (learnTap(e)) { st.skip = 1; return; }
            // velocity = where you strike: top edge soft → bottom edge hard (a finger has no velocity sensor, it has a y)
            const r = pad.getBoundingClientRect(); const vel = clamp(0.15 + 0.85 * ((e.clientY - r.top) / r.height), 0.08, 1);
            this.c.press(c.id, vel);
            if (e.pressure && e.pressure !== 0.5 && c.aftertouch) this.c.pressure(c.id, e.pressure);
          },
          move: (e, st) => { if (!st.skip && c.aftertouch && e.pressure && e.pressure !== 0.5) this.c.pressure(c.id, e.pressure); },
          up: (e, st) => { if (!st.skip) this.c.release(c.id); },
        });
        break;
      }
      case 'button': {
        el.classList.add('btnc');
        el.innerHTML = `<div class="mcv-btn mcv-hit${c.shape === 'round' ? ' round' : ''}">${esc(c.label ?? '')}</div>`;
        const b = el.querySelector('.mcv-btn');
        track(b, { down: (e, st) => { if (learnTap(e)) { st.skip = 1; return; } this.c.press(c.id, 1); }, up: (e, st) => { if (!st.skip) this.c.release(c.id); } });
        break;
      }
      case 'wheel': case 'strip': {
        el.innerHTML = `<div class="mcv-strip mcv-hit">${c.bipolar ? '<div class="mid"></div>' : ''}<div class="bar"></div><div class="th"></div></div>`;
        el.appendChild(lbl());
        const s = ui.strip = el.querySelector('.mcv-strip'); ui.bar = el.querySelector('.bar');
        const at = (e) => { const r = s.getBoundingClientRect(); const y = clamp(1 - (e.clientY - r.top) / r.height); return c.bipolar ? y * 2 - 1 : y; };
        track(s, { down: (e, st) => { if (learnTap(e)) { st.skip = 1; return; } el.classList.add('active'); this.c.setValue(c.id, at(e)); },
          move: (e, st) => { if (!st.skip) this.c.setValue(c.id, at(e)); },
          up: (e, st) => { el.classList.remove('active'); if (!st.skip && c.spring) this.c.rest(c.id); } });
        break;
      }
      case 'keys': {
        el.innerHTML = `<div class="mcv-keys mcv-hit"></div>`;
        const kb = new Keys(el.querySelector('.mcv-keys'), this.c, c, this);
        this.keyboards.push(kb); ui.keys = kb;
        break;
      }
    }
    this._a11y(el, c);
    this.els.set(c.id, ui);
    return el;
  }

  /** Keyboard + screen readers: one Tab stop per control (piano keys excepted: they are a labelled group). */
  _a11y(el, c) {
    const name = c.label || c.id;
    if (c.type === 'keys') { el.setAttribute('role', 'group'); el.setAttribute('aria-label', `${name} ${noteName(c.from)}–${noteName(c.to)}`); return; }
    const slider = c.type === 'knob' || c.type === 'fader' || c.type === 'wheel' || c.type === 'strip' || c.type === 'encoder';
    el.tabIndex = 0;
    el.setAttribute('aria-label', name);
    if (slider) {
      el.setAttribute('role', 'slider');
      el.setAttribute('aria-valuemin', c.bipolar ? '-1' : '0'); el.setAttribute('aria-valuemax', '1');
    } else {
      el.setAttribute('role', 'button');
      if (c.type === 'button' && c.mode === 'toggle') el.setAttribute('aria-pressed', 'false');
    }
    let down = false;
    el.addEventListener('keydown', (e) => {
      if (e.altKey || e.metaKey || e.ctrlKey) return;
      if (this.learning && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); this.c.learn(c.id); this.onLearnTap?.(c.id); return; }
      if (slider) {
        const d = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1, PageUp: 8, PageDown: -8 }[e.key];
        if (c.type === 'encoder' && c.relative) { if (d) { e.preventDefault(); this.c.turn(c.id, d * (e.shiftKey ? 1 : 3)); } return; }
        const lo = c.bipolar ? -1 : 0, st = this.c.get(c.id);
        const v = e.key === 'Home' ? lo : e.key === 'End' ? 1 : d ? st.value + (d * (e.shiftKey ? 1 : 4) * (1 - lo)) / 127 : null;
        if (v === null) return;
        e.preventDefault(); this.c.setValue(c.id, clamp(v, lo, 1));
        return;
      }
      if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); down = true; this.c.press(c.id, c.type === 'pad' ? 0.8 : 1); }
    });
    el.addEventListener('keyup', (e) => {
      if (slider) { if (c.spring && /^(Arrow|Page)/.test(e.key)) this.c.rest(c.id); return; }
      if ((e.key === ' ' || e.key === 'Enter') && down) { down = false; this.c.release(c.id); }
    });
    el.addEventListener('blur', () => { if (down) { down = false; this.c.release(c.id); } });
  }

  _paint(id, info = {}) {
    const ui = this.els.get(id); if (!ui) return;
    const c = this.c.control(id), st = this.c.get(id);
    const el = ui.el;
    if (info.source === 'hw' || info.source === 'mirror') { el.classList.remove('hw'); void el.offsetWidth; el.classList.add('hw'); clearTimeout(ui._hw); ui._hw = setTimeout(() => el.classList.remove('hw'), 700); }
    switch (c.type) {
      case 'knob': case 'encoder': {
        if (c.type === 'encoder' && c.relative) {
          ui.rot.setAttribute('transform', `rotate(${((st.turns || 0) * 15) % 360} 50 50)`);
          ui.num.textContent = (st.pos * 100).toFixed(0) + '%';
        } else {
          // pathLength=100 is the whole 270° sweep (not a full circle), so value 1 = 100 — same angle as the pointer (gap 1000 so a zero-length dash never repeats at the far end)
          ui.arc.setAttribute('stroke-dasharray', `${st.value * 100} 1000`);
          ui.rot.setAttribute('transform', `rotate(${-135 + st.value * 270} 50 50)`);
          ui.num.textContent = String(st.raw);
        }
        break;
      }
      case 'fader': ui.fader.style.setProperty('--v', st.value); break;
      case 'pad': el.classList.toggle('on', !!st.held); el.style.setProperty('--vel', st.value || 1); ui.pad.style.setProperty('--p', st.pressure || 0); break;
      case 'button': el.classList.toggle('on', !!st.held); break;
      case 'wheel': case 'strip': {
        const y = c.bipolar ? (st.value + 1) / 2 : st.value;
        ui.strip.style.setProperty('--y', y);
        const top = c.bipolar ? Math.min(0.5, 1 - y) : 1 - y, hgt = c.bipolar ? Math.abs(y - 0.5) : y;
        Object.assign(ui.bar.style, { top: top * 100 + '%', height: hgt * 100 + '%' });
        break;
      }
      case 'keys': ui.keys.paint(info); break;
    }
    if (c.type !== 'keys') {
      if (el.getAttribute('role') === 'slider') { el.setAttribute('aria-valuenow', (+st.value || 0).toFixed(2)); el.setAttribute('aria-valuetext', String(st.raw)); }
      else if (c.type === 'button' && c.mode === 'toggle') el.setAttribute('aria-pressed', st.held ? 'true' : 'false');
    }
    if (this.screen && info.ev) this.screen.textContent = this.c.lastEvent?.text || '';
  }

  _paintMeta() {
    for (const [id, ui] of this.els) {
      ui.el.classList.toggle('armed', this.c.learning === id);
      ui.el.classList.toggle('learned', this.c.learned.has(id));
    }
  }

  dispose() { this._unsub?.(); this._ro.disconnect(); for (const k of this.keyboards || []) k.dispose(); this.root.remove(); }
}

/** The keyboard: one row when wide, two stacked rows when tall (the upper row
 *  continues the range), a window you can shift by octaves when the box is too
 *  narrow for the whole range — and it follows the hardware's octave shifts. */
class Keys {
  constructor(el, controller, c, view) {
    this.el = el; this.c = controller; this.k = c; this.view = view;
    this.base = c.from - (((c.from % 12) + 12) % 12 === 0 ? 0 : 0);
    this.held = new Map();          // pointerId → note
    this.keyEls = new Map();
    this.bar = h('div', 'mcv-oct', `<button type="button" data-d="-12">◀</button><span></span><button type="button" data-d="12">▶</button>`);
    this.bar.querySelectorAll('button').forEach((b) => b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); this.shift(+b.dataset.d); }));
    el.parentElement.appendChild(this.bar);
    // inside a shadow root the document only sees the host element: ask the root the keys live in
    const at = (e) => { const r = el.getRootNode(); const t = (r && r.elementFromPoint ? r : document).elementFromPoint(e.clientX, e.clientY); return t && t.closest && t.closest('.mcv-k'); };
    const vel = (k, e) => { const r = k.getBoundingClientRect(); return clamp(0.12 + 0.88 * ((e.clientY - r.top) / r.height), 0.06, 1); };
    track(el, {
      down: (e, st) => {
        if (this.view.learning) { this.c.learn(c.id); this.view.onLearnTap?.(c.id); st.skip = 1; return; }
        const k = at(e); if (!k) return; const n = +k.dataset.n; st.note = n; this.c.press(c.id, vel(k, e), n);
      },
      move: (e, st) => {          // glissando: slide across keys
        if (st.skip) return;
        const k = at(e); const n = k ? +k.dataset.n : null;
        if (n === st.note) return;
        if (st.note != null) this.c.release(c.id, st.note);
        st.note = n; if (n != null) this.c.press(c.id, vel(k, e), n);
      },
      up: (e, st) => { if (!st.skip && st.note != null) this.c.release(c.id, st.note); },
    });
  }
  span() { return this.k.to - this.k.from + 1; }
  layout() {
    const W = this.el.clientWidth, H = this.el.clientHeight; if (!W || !H) return;
    // a white key needs ~22 px under a mouse, ~30 px under a thumb
    const coarse = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
    const minKey = coarse ? 30 : 22;
    const whitesIn = (a, b) => { let n = 0; for (let x = a; x <= b; x++) if (isWhite(x)) n++; return n; };
    const total = whitesIn(this.k.from, this.k.to);
    const perRowMax = Math.max(5, Math.floor(W / minKey));
    // rows: the fewest (≤ 3, stacked like manuals) that show the whole range with keys at least
    // twice as tall as wide; when none can, one row and a window you shift with ◀ ▶
    let rows = 0;
    for (let r = 1; r <= 3 && !rows; r++) { const per = Math.ceil(total / r); if (per <= perRowMax && H / r >= (W / per) * 2) rows = r; }
    if (!rows) { const keyW = W / Math.min(perRowMax, total); rows = Math.max(1, Math.min(3, Math.round(H / (keyW * 4.6)))); }
    // the window: whole range if it fits, else as many whites as fit from `base` (◀ ▶ shift it)
    const want = Math.min(perRowMax, Math.ceil(total / rows));
    const fits = rows * want >= total;
    if (fits) this.base = this.k.from;
    const plan = [];
    let start = this.base;
    for (let r = 0; r < rows; r++) {
      // end each row but the last on E or B, so no black key is lost at a seam (the surface keyboard's rule)
      let whites = 0, end = start, best = null;
      for (let n = start; whites < want && n <= 127; n++) {
        if (isWhite(n)) { whites++; end = n; const pc = n % 12; if (pc === 4 || pc === 11) best = { end: n, whites }; }
      }
      if (r < rows - 1 && best && best.whites >= Math.ceil(want * 0.6)) end = best.end;
      if (r === rows - 1 && fits) end = Math.max(end, this.k.to);
      plan.push({ from: start, to: Math.min(127, end) });
      start = end + 1; while (start <= 127 && !isWhite(start)) start++;
      if (start > 127) break;
    }
    const sig = JSON.stringify(plan);
    this.bar.style.display = fits ? 'none' : '';
    this.bar.querySelector('span').textContent = noteName(plan[0].from) + '–' + noteName(plan[plan.length - 1].to);
    if (sig === this._sig) return;
    this._sig = sig; this.plan = plan;
    this.el.innerHTML = ''; this.keyEls.clear();
    const maxW = Math.max(...plan.map((p) => whitesIn(p.from, p.to)));
    for (const p of [...plan].reverse()) {           // upper row (higher notes) on top, like two manuals
      const row = h('div', 'mcv-krow');
      const nW = whitesIn(p.from, p.to); row.style.width = (nW / maxW) * 100 + '%';
      const ww = 100 / nW; let wi = 0;
      for (let n = p.from; n <= p.to; n++) {
        if (!isWhite(n)) continue;
        const k = h('div', 'mcv-k'); k.dataset.n = n; k.style.left = wi * ww + '%'; k.style.width = ww + '%';
        if (n % 12 === 0) k.appendChild(h('span', 'kn', noteName(n)));
        row.appendChild(k); this.keyEls.set(n, k); wi++;
      }
      wi = 0;
      for (let n = p.from; n <= p.to; n++) {
        if (isWhite(n)) { wi++; continue; }
        if (wi === 0) continue;                       // a row never starts on a black key
        const k = h('div', 'mcv-k b'); k.dataset.n = n; k.style.left = (wi * ww - ww * 0.31) + '%'; k.style.width = ww * 0.62 + '%';
        row.appendChild(k); this.keyEls.set(n, k);
      }
      this.el.appendChild(row);
    }
    this.paint();
  }
  shift(d) {
    this.c.releaseAll();
    this.base = Math.max(0, Math.min(108, this.base + d)); this._sig = null; this.layout();
  }
  paint(info = {}) {
    // follow the hardware: a note outside the window scrolls it there (an octave shift on the device)
    if (info.note != null && info.source === 'hw' && this.plan && !this.keyEls.has(info.note) && this.c.keys.has(info.note)) {
      this.base = Math.max(0, info.note - (info.note % 12) - (info.note - (info.note % 12) > this.k.from ? 12 : 0)); this._sig = null; this.layout();
    }
    for (const [n, k] of this.keyEls) k.classList.toggle('on', this.c.keys.has(n));
    if (info.note != null && (info.source === 'hw' || info.source === 'mirror')) {
      const k = this.keyEls.get(info.note); if (k) { k.style.transition = 'none'; requestAnimationFrame(() => { k.style.transition = ''; }); }
    }
  }
  dispose() { this.bar.remove(); }
}
