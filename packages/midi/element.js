// @openav/midi · element — <oav-controller>: a MIDI controller you can paste into any page.
//
//   <script type="module" src="https://openaudiovisual.com/packages/midi/element.js"></script>
//   <oav-controller profile="akai-lpd8"></oav-controller>
//
// One line, no import map, no build. Shadow DOM, so the page's CSS cannot bend
// it and it cannot bend the page. Plays with a mouse, a finger, a pen, the
// keyboard — with or without Web MIDI (Safari / iPad: events still fire;
// hardware and MIDI out say they are unavailable). A thin shell over
// createController() in index.js; the rules it follows are in embed.js.
//
// Attributes (each is also a property)
//   profile    id or short name (arturia-minilab3, lpd8 …) or a URL to a profile JSON   default arturia-minilab3
//   layout     auto | face | stack                                                       default auto
//   hardware   (off) | on | ask | <port name>  — follow the real device; `ask` shows a button so the
//              browser's permission prompt waits for a click. Off by default: embedding never prompts.
//   midi-out   (off) | ask | <port name or /regex/>  — what you play is sent to that output (IAC, loopMIDI)
//   channel    1–16: move every control to this channel (your unit is set to another one)
//   learn      show a Learn button (tap a control, move the hardware one)
//   picker     show a device picker            readout   show the last message under the faceplate
//   follow     plug a different known device in → show that one
//   theme      dark | light (the toolbar; the device stays the device)
// CSS: --oav-bg --oav-fg --oav-accent --oav-line --oav-font, --oav-ratio (width ÷ height), ::part(toolbar|body|readout)
//
// Events (CustomEvent, bubbling, composed; payloads in packages/midi/README.md)
//   ready · control · noteon · noteoff · connect · disconnect · status · profilechange · error
// Methods
//   set(id, value, {note, quiet}) · get(id) · values() · reset() · press(id, vel, note) · release(id, note)
//   ingest(bytes) · send(bytes) · on(name, fn) → off · connectHardware() · disconnectHardware()
//   setOutput(nameOrRegex) · toggleLearn(on) · ready (Promise) · core / controller / controllers / view / midi

import { createController, loadProfile, PROFILES } from './index.js?v=8dce886';
import { parseEmbedOptions, describeDetail, preferredAspect, findProfile, EMBED_ATTRS, DEFAULT_PROFILE } from './embed.js?v=8dce886';

const UI = {
  en: {
    device: 'Device', devices: 'Devices', generic: 'Generic layouts', connect: 'Connect MIDI', asking: 'Asking for MIDI…',
    waiting: 'Plug in {name}', connected: '{port}', unavailable: 'No Web MIDI in this browser', denied: 'MIDI permission blocked',
    outAsk: 'MIDI out…', outLabel: 'MIDI output', outOff: 'MIDI out: off', outTo: '→ {port}', outMissing: 'No output "{q}"',
    learn: 'Learn', learnHint: 'Learn: tap a control, then move the one on your hardware.', error: 'Could not load this controller',
  },
  zh: {
    device: '裝置', devices: '裝置', generic: '通用版面', connect: '連接 MIDI', asking: '正在請求 MIDI…',
    waiting: '接上 {name} 就會動', connected: '{port}', unavailable: '這個瀏覽器沒有 Web MIDI', denied: 'MIDI 權限被擋下',
    outAsk: 'MIDI 輸出…', outLabel: 'MIDI 輸出', outOff: 'MIDI 輸出：關', outTo: '→ {port}', outMissing: '找不到輸出「{q}」',
    learn: '學習', learnHint: '學習：點畫面上的一個控制項，再動硬體上對應的那一個。', error: '無法載入這台控制器',
  },
};
const fill = (s, o) => s.replace(/\{(\w+)\}/g, (m, k) => (o[k] ?? ''));
const nameOf = (p, lang) => (lang === 'zh' ? p.name : p.nameEn || p.name);

const CSS = `
:host { display: block; position: relative; box-sizing: border-box; min-width: 120px;
  color: var(--oav-fg, #edebe5); background: var(--oav-bg, transparent);
  font: 500 12px/1.35 var(--oav-font, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace); -webkit-text-size-adjust: 100%; }
:host([hidden]) { display: none; }
:host([theme="light"]) { --oav-fg: #1d1d20; --oav-dim: #5f5d58; --oav-line: #c9c6be; --oav-ctl: #ffffff; --oav-bg: #f2f0ea; }
*, *::before, *::after { box-sizing: border-box; }
.oav { display: flex; flex-direction: column; gap: 6px; height: 100%; min-height: inherit; }
.bar { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.bar[hidden], .readout[hidden], [hidden] { display: none !important; }
.bar select, .bar button { height: 28px; max-width: 100%; padding: 0 9px; border: 1px solid var(--oav-line, #36363c); border-radius: 0;
  background: var(--oav-ctl, #111113); color: inherit; font: inherit; cursor: pointer; }
.bar select { padding-right: 4px; min-width: 0; text-overflow: ellipsis; }
.bar button:hover, .bar select:hover { border-color: var(--oav-dim, #8a8882); }
.bar button[aria-pressed="true"] { background: var(--oav-accent, #ff5a1f); border-color: var(--oav-accent, #ff5a1f); color: #000; }
.bar :focus-visible { outline: 2px solid var(--oav-accent, #ff5a1f); outline-offset: 1px; }
.chip { display: inline-flex; align-items: center; gap: 6px; min-width: 0; max-width: 100%; color: var(--oav-dim, #8a8882); white-space: nowrap; }
.chip span { overflow: hidden; text-overflow: ellipsis; }
.chip i { flex: none; width: 7px; height: 7px; border-radius: 50%; background: currentColor; opacity: .55; }
.chip.on { color: var(--oav-ok, #4fd08a); } .chip.on i { opacity: 1; box-shadow: 0 0 6px currentColor; }
.chip.bad { color: var(--oav-warn, #ff8a5c); }
.body { position: relative; flex: 1 1 auto; min-height: 0; aspect-ratio: var(--oav-ratio, var(--oav-aspect, 3)); }
.readout { min-height: 1.35em; color: var(--oav-dim, #aaa8a1); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-variant-numeric: tabular-nums; }
.err { position: absolute; inset: 0; display: grid; place-items: center; padding: 12px; text-align: center; color: var(--oav-warn, #ff8a5c); white-space: pre-wrap; overflow: auto; }
`;

const Base = typeof HTMLElement !== 'undefined' ? HTMLElement : class {};
const BOOLS = { learn: 'learn', picker: 'picker', readout: 'readout', follow: 'follow' };
const STRS = { profile: 'profile', layout: 'layout', theme: 'theme', hardware: 'hardware', midiOut: 'midi-out' };

export class OavController extends Base {
  static get observedAttributes() { return [...EMBED_ATTRS, 'lang']; }

  constructor() {
    super();
    this._root = this.attachShadow({ mode: 'open' });
    this._root.innerHTML = `<style>${CSS}</style><div class="oav" part="root">
      <div class="bar" part="toolbar" hidden></div>
      <div class="body" part="body"></div>
      <div class="readout" part="readout" hidden></div></div>`;
    this._bar = this._root.querySelector('.bar');
    this._body = this._root.querySelector('.body');
    this._readout = this._root.querySelector('.readout');
    this._core = null; this._gen = 0; this._o = null; this._w = 0;
    this._onVis = () => { if (document.visibilityState === 'hidden') this._core?.releaseAll(); };
    /** Resolves with the element once its controller is live (methods before that return null). */
    this.ready = new Promise((r) => { this._resolveReady = r; });
  }

  // ---------------------------------------------------------------- lifecycle
  connectedCallback() { this._queueBoot(); }
  disconnectedCallback() { this._gen++; this._teardown(); }
  attributeChangedCallback(name, was, now) {
    if (was === now || !this.isConnected) return;
    const core = this._core;
    if (!core || name === 'channel' || name === 'lang') return this._queueBoot();
    this._o = parseEmbedOptions(this);
    switch (name) {
      case 'profile': {
        const p = findProfile(this._o.profile, core.controllers.profiles);
        if (p && p.id === core.profileId) return;
        core.setProfile(this._o.profile).catch((e) => this._fail(e));
        return;
      }
      case 'layout': core.setLayout(this._o.layout); this._aspect(); return;
      case 'hardware': this._applyHardware(); this._renderBar(); return;
      case 'midi-out': this._applyOut(); this._renderBar(); return;
      case 'follow': core.follow = this._o.follow; return;
      case 'readout': this._readout.hidden = !this._o.readout; return;
      default: this._renderBar();
    }
  }

  _queueBoot() {
    if (this._queued) return;
    this._queued = true;
    queueMicrotask(() => { this._queued = false; if (this.isConnected) this._boot(); });
  }

  async _boot() {
    const gen = ++this._gen;
    this._teardown();
    const o = this._o = parseEmbedOptions(this);
    this._lang = langOf(this);
    let profile;
    try { profile = await loadProfile(o.profile || DEFAULT_PROFILE); } catch (e) { if (gen === this._gen) this._fail(e); return; }
    if (gen !== this._gen || !this.isConnected) return;
    let core;
    try { core = this._core = createController(profile, { channel: o.channel, follow: o.follow }); } catch (e) { this._fail(e); return; }
    core.mount(this._body, { layout: o.layout });
    this._offs = [
      core.on('*', (name, detail) => this._emit(name, detail)),
      core.on('control', (d) => { if (this._o.readout) this._readout.textContent = describeDetail(d); }),
      core.on('status', () => this._paintBar()),
      core.on('profilechange', (d) => {
        // reflect a switch made inside (picker, follow) — attributeChangedCallback sees the same id and does nothing
        if (findProfile(this.getAttribute('profile') || DEFAULT_PROFILE, core.controllers.profiles)?.id !== d.profile) this.setAttribute('profile', d.profile);
        this._readout.textContent = ''; this._w = 0; this._aspect(); this._renderBar();
      }),
    ];
    this._ro = new ResizeObserver(() => this._aspect());
    this._ro.observe(this);
    document.addEventListener('visibilitychange', this._onVis);
    addEventListener('pagehide', this._onVis);
    this._readout.hidden = !o.readout;
    this._aspect();
    this._renderBar();
    this._applyHardware(); this._applyOut();
    this._resolveReady(this);
    this._emit('ready', { profile: core.profileId, name: core.profile.name, controls: core.profile.controls.map((c) => c.id) });
  }

  _teardown() {
    this._offs?.forEach((f) => f()); this._offs = null;
    this._ro?.disconnect(); this._ro = null;
    cancelAnimationFrame(this._raf);
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', this._onVis);
    if (typeof removeEventListener === 'function') removeEventListener('pagehide', this._onVis);
    this._core?.dispose(); this._core = null;
    this._body.replaceChildren(); this._bar.replaceChildren(); this._bar.hidden = true; this._readout.textContent = '';
    this._w = 0;
  }

  _fail(e) {
    const t = UI[this._lang || 'en'];
    this._body.replaceChildren();
    const div = document.createElement('div'); div.className = 'err'; div.textContent = `${t.error}\n${e && e.message ? e.message : e}`;
    this._body.appendChild(div);
    console.warn('[oav-controller]', e);
    this._emit('error', { message: String(e && e.message ? e.message : e) });
  }

  _emit(name, detail) { this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true })); }

  /** Height from the faceplate's proportions (or a taller stack on a phone) unless the page sets one. */
  _aspect() {
    cancelAnimationFrame(this._raf);
    this._raf = requestAnimationFrame(() => {
      const core = this._core; if (!core) return;
      const w = Math.round(this.getBoundingClientRect().width);
      if (!w || w === this._w) return;
      this._w = w;
      const { aspect } = preferredAspect(core.profile, w, { layout: this._o.layout });
      this._body.style.setProperty('--oav-aspect', String(+aspect.toFixed(4)));
    });
  }

  // ---------------------------------------------------------------- hardware / output
  _applyHardware() {
    const core = this._core; if (!core) return;
    const h = this._o.hardware;
    if (h.mode === 'on') core.connectHardware(h.port);
    else if (h.mode === 'off' && core.status.hardware !== 'off') core.disconnectHardware();
  }
  _applyOut() {
    const core = this._core; if (!core) return;
    const m = this._o.midiOut;
    if (m.mode === 'on') core.setOutput(m.port);
    else if (m.mode === 'off' && core.status.outputState !== 'off') core.setOutput(null);
  }

  // ---------------------------------------------------------------- toolbar
  _renderBar() {
    const core = this._core, o = this._o; if (!core) return;
    const t = UI[this._lang], bar = this._bar;
    bar.replaceChildren();
    const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
    if (o.picker) {
      const sel = el('select', 'pick'); sel.setAttribute('aria-label', t.device);
      const groups = [['device', t.devices], ['generic', t.generic]];
      for (const [kind, label] of groups) {
        const g = el('optgroup'); g.label = label;
        for (const p of core.controllers.profiles.filter((x) => (x.kind === 'generic') === (kind === 'generic'))) { const op = el('option', null, nameOf(p, this._lang)); op.value = p.id; g.appendChild(op); }
        if (g.children.length) sel.appendChild(g);
      }
      sel.value = core.profileId;
      sel.addEventListener('change', () => core.setProfile(sel.value).catch((e) => this._fail(e)));
      bar.appendChild(sel);
    }
    if (o.hardware.mode !== 'off') {
      if (o.hardware.mode === 'ask') { const b = el('button', 'connect', t.connect); b.type = 'button'; b.addEventListener('click', () => core.connectHardware(o.hardware.port)); bar.appendChild(b); }
      const chip = el('span', 'chip hw'); chip.append(el('i'), el('span')); bar.appendChild(chip);
    }
    if (o.midiOut.mode !== 'off') {
      if (o.midiOut.mode === 'ask') {
        const b = el('button', 'outask', t.outAsk); b.type = 'button';
        const sel = el('select', 'out'); sel.setAttribute('aria-label', t.outLabel); sel.hidden = true;
        b.addEventListener('click', async () => { await core.requestMidi(); this._fillOutputs(sel); if (core.midi) { b.hidden = true; sel.hidden = false; sel.focus(); } });
        sel.addEventListener('change', () => core.setOutput(sel.value || null));
        bar.append(b, sel);
      }
      const chip = el('span', 'chip out'); chip.append(el('i'), el('span')); bar.appendChild(chip);
    }
    if (o.learn) {
      const b = el('button', 'learn', t.learn); b.type = 'button'; b.setAttribute('aria-pressed', String(core.learning));
      b.addEventListener('click', () => this.toggleLearn());
      bar.appendChild(b);
    }
    bar.hidden = !bar.children.length;
    this._paintBar();
  }
  _fillOutputs(sel) {
    const t = UI[this._lang], cur = this._core?.output?.name || '';
    sel.replaceChildren();
    const off = document.createElement('option'); off.value = ''; off.textContent = t.outOff; sel.appendChild(off);
    for (const n of this._core?.outputs() || []) { const op = document.createElement('option'); op.value = n; op.textContent = n; sel.appendChild(op); }
    sel.value = cur;
  }
  _paintBar() {
    const core = this._core; if (!core) return;
    const t = UI[this._lang], s = core.status;
    const hw = this._bar.querySelector('.chip.hw');
    if (hw) {
      const want = nameOf(core.profile, this._lang);
      const text = s.hardware === 'connected' ? fill(t.connected, { port: s.input }) : s.hardware === 'waiting' ? fill(t.waiting, { name: want })
        : s.hardware === 'asking' ? t.asking : s.hardware === 'unavailable' ? t.unavailable : s.hardware === 'denied' ? t.denied : '';
      hw.querySelector('span').textContent = text; hw.hidden = !text;
      hw.classList.toggle('on', s.hardware === 'connected'); hw.classList.toggle('bad', s.hardware === 'unavailable' || s.hardware === 'denied');
      const b = this._bar.querySelector('.connect'); if (b) b.hidden = s.hardware !== 'off' && s.hardware !== 'denied';
    }
    const out = this._bar.querySelector('.chip.out');
    if (out) {
      const q = this._o.midiOut.port || '';
      const text = s.outputState === 'open' ? fill(t.outTo, { port: s.output }) : s.outputState === 'missing' ? fill(t.outMissing, { q }) : s.outputState === 'asking' ? t.asking
        : s.outputState === 'unavailable' ? t.unavailable : s.outputState === 'denied' ? t.denied : '';
      out.querySelector('span').textContent = text; out.hidden = !text || this._o.midiOut.mode === 'ask' && s.outputState === 'open';
      out.classList.toggle('on', s.outputState === 'open'); out.classList.toggle('bad', ['missing', 'unavailable', 'denied'].includes(s.outputState));
      const sel = this._bar.querySelector('select.out'); if (sel && !sel.hidden && sel.options.length - 1 !== core.outputs().length) this._fillOutputs(sel);
    }
    const lb = this._bar.querySelector('.learn'); if (lb) lb.setAttribute('aria-pressed', String(core.learning));
    if (core.learning) { this._readout.hidden = false; this._readout.textContent = t.learnHint; }
  }

  // ---------------------------------------------------------------- the public API
  _need() { if (!this._core && !this._warned) { this._warned = true; console.warn('[oav-controller] not ready yet: await el.ready (or listen for "ready") first'); } return this._core; }
  /** Move a control like a hand (pads / buttons: > 0 presses, 0 releases; keys: set('keys', vel, {note})). quiet: no event, no MIDI out. */
  set(id, value, opts = {}) { return this._need()?.set(id, value, typeof opts === 'number' ? { note: opts } : opts) ?? null; }
  get(id) { return this._core ? this._core.get(id) : null; }
  values() { return this._core ? this._core.values() : {}; }
  reset(opts) { this._need()?.reset(opts); }
  press(id, velocity = 1, note = null) { return this._need()?.press(id, velocity, note) ?? null; }
  release(id, note = null) { return this._need()?.release(id, note) ?? null; }
  /** MIDI in from anywhere (a WebSocket, another tab): the faceplate follows, `control` fires with source 'hardware'. */
  ingest(bytes, opts) { return this._need()?.ingest(bytes, opts) ?? null; }
  /** Raw bytes to the MIDI output port (when midi-out is open). */
  send(bytes) { return this._core ? this._core.send(bytes) : false; }
  /** Subscribe to an event by name; the callback gets the payload. Returns unsubscribe. */
  on(name, fn) { const h = (e) => fn(e.detail, e); this.addEventListener(name, h); return () => this.removeEventListener(name, h); }
  connectHardware() { return this._core ? this._core.connectHardware(this._o.hardware.port) : Promise.resolve(false); }
  disconnectHardware() { this._core?.disconnectHardware(); }
  setOutput(query) { return this._core ? this._core.setOutput(query) : Promise.resolve(null); }
  toggleLearn(on) {
    const core = this._core; if (!core) return false;
    const v = core.learn(on);
    if (v && core.status.hardware === 'off') core.connectHardware(this._o.hardware.port);   // learning listens to hardware
    if (!v) this._readout.textContent = '';
    this._readout.hidden = !(v || this._o.readout);
    this._paintBar();
    return v;
  }
  /** The headless controller (same API as createController()). */
  get core() { return this._core; }
  /** The live model of the device on screen (MidiController). */
  get controller() { return this._core ? this._core.controller : null; }
  /** Every device this element can show (MidiControllers). */
  get controllers() { return this._core ? this._core.controllers : null; }
  /** The faceplate (ControllerView). */
  get view() { return this._core ? this._core.view : null; }
  /** The Web MIDI engine, once hardware or MIDI out is on. */
  get midi() { return this._core ? this._core.midi : null; }
  /** { hardware, input, output, outputState, profile } */
  get status() { return this._core ? { ...this._core.status, profile: this._core.profileId } : null; }
  /** The normalized profile on screen. */
  get profileData() { return this._core ? this._core.profile : null; }
}

// attributes ⇄ properties
for (const [prop, attr] of Object.entries(BOOLS)) {
  Object.defineProperty(OavController.prototype, prop, {
    get() { return this.hasAttribute(attr) && !/^(false|0|off|no)$/i.test(this.getAttribute(attr)); },
    set(v) { if (v) this.setAttribute(attr, ''); else this.removeAttribute(attr); },
  });
}
for (const [prop, attr] of Object.entries(STRS)) {
  Object.defineProperty(OavController.prototype, prop, {
    get() { return this.getAttribute(attr); },
    set(v) { if (v === null || v === undefined || v === false) this.removeAttribute(attr); else this.setAttribute(attr, v === true ? '' : String(v)); },
  });
}
Object.defineProperty(OavController.prototype, 'channel', {
  get() { const n = Number(this.getAttribute('channel')); return Number.isInteger(n) && n >= 1 && n <= 16 ? n : null; },
  set(v) { if (v === null || v === undefined || v === '') this.removeAttribute('channel'); else this.setAttribute('channel', String(v)); },
});

function langOf(el) {
  const l = (el.closest && el.closest('[lang]')?.getAttribute('lang')) || (typeof document !== 'undefined' && document.documentElement.lang) || 'en';
  return /^zh/i.test(l) ? 'zh' : 'en';
}

/** Register under another tag name (the default registers <oav-controller> on import). */
export function defineController(tag = 'oav-controller') {
  if (typeof customElements === 'undefined') return null;
  if (customElements.get(tag)) return customElements.get(tag);
  const C = tag === 'oav-controller' ? OavController : class extends OavController {};
  customElements.define(tag, C);
  return C;
}
defineController();

export { PROFILES };
