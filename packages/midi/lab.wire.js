// lab.wire.js — @openav/midi in the cheyuwu-lab runtime (declared in package.json → "lab").
// Runs inside the lab's generated runtime/modules/midi.js, with `lab` (window.lab) and every export of
// the files listed in the declaration in scope. Not an ES module: no import/export, no top-level return.
//
// What a work gets from `"modules": ["midi"]` (or, for an old sketch, just by calling
// navigator.requestMIDIAccess / WebMidi.enable — lab.js loads this module on demand):
//   lab.midi                  the hardware engine (@openav/midi Midi) — as before
//   lab.midi.controllers      MidiControllers: plug a known device in → it appears on screen and moves
//   lab.midi.panel            the on-screen controller (🎹 in the toolbar; docked at the bottom)
//   lab.midi.bind(c, key)     a control drives a param: lab.midi.bind('knob1', 'hue') → lab.setParam
//   meta.params[i].midi       the same, declared: { "key": "hue", …, "midi": "knob1" }
//   meta.midi                 { "profile": "<id>", "open": true } — which device to show, panel open on load
//   Web MIDI for old sketches a virtual input ("實驗室虛擬 MIDI") next to the real ports: the on-screen
//                             controller and phones (the /remote 琴鍵 and MIDI tabs) play the sketch's own code
//   relay                     phones on /remote?work=<id> get the same device on their MIDI tab; their
//                             plays show up here, this machine's hardware moves show up there
(() => {
  const real = typeof lab.realMIDIAccess === 'function' ? lab.realMIDIAccess : null;  // lab.js keeps the browser's own
  const cfg = (lab.meta && lab.meta.midi) || {};
  const qs = new URLSearchParams(location.search);
  const shim = !!lab.midiShim;   // loaded on demand because an old sketch asked for Web MIDI

  // never fall back to navigator.requestMIDIAccess: lab.js has wrapped it with the virtual port, and the
  // hardware engine must not hear what the on-screen controller feeds the sketches (it would double every note)
  const midi = new Midi({ signals: lab.signals, requestAccess: real || (() => Promise.reject(new Error('this browser has no Web MIDI'))) });
  lab.midi = midi;
  const controllers = new MidiControllers({ profiles: PROFILES, signals: lab.signals, midi,
    initial: qs.get('midiProfile') || cfg.profile || (shim ? 'generic-keys25' : 'arturia-minilab3') });
  midi.controllers = controllers;
  const enabled = midi.enable().then((ok) => { if (!ok) console.info('[lab:midi] no Web MIDI here — the on-screen controller still plays'); return ok; });

  // ---- Web MIDI for sketches that call requestMIDIAccess themselves (lab.js routes the call here)
  let shared = null;
  const make = () => shared || (shared = createVirtualMIDIAccess({ name: '實驗室虛擬 MIDI (Lab Virtual MIDI)', manufacturer: 'cheyuwu-lab', id: 'lab-virtual',
    onOutput: (bytes) => controllers.current.ingest(bytes, { source: 'mirror' }) }));   // a sketch that plays OUT lights the screen
  OpenAV.labRequestMIDIAccess = virtualRequestMIDIAccess({ real, make });
  lab.signals.on('midi/virtual', (v) => { if (shared && v && Array.isArray(v.data)) shared.emit(v.data); });
  lab.virtualMidi = { emit: (bytes) => { make().emit(bytes); }, get access() { return shared && shared.access; } };

  // ---- controls → params (continuous control goes through params)
  const shortOf = (pid) => (PROFILES.find((p) => p.id === pid || p.short === pid) || {}).short;
  // meta.params[].midi is the lab's one binding list (the workbench's ⌁ learn and `lab param bind` write it), so a
  // full signal name from another input binds too — a hand height drives a param exactly like a knob
  const OTHER_SOURCE = /^(leap|phone|audio|pose|hand|surface|chord|drum)\//;
  const signalOf = (ref) => {
    const r = String(ref);
    if (r.startsWith('midi/')) return r;
    if (OTHER_SOURCE.test(r)) return r;                               // another input's full name: "leap/hand/right/y"
    if (/^(cc|ch|note|bend)\b/.test(r)) return 'midi/' + r;           // generic: "cc/74", "ch/2/cc/74"
    if (r.includes('/')) return 'midi/' + r;                          // "minilab3/knob1"
    return `midi/${shortOf(cfg.profile) || controllers.current.short}/${r}`;   // "knob1" → the work's device
  };
  const bind = (ref, key) => {
    const name = signalOf(ref);
    return lab.signals.on(name, (v) => {                              // exact name (lab.on would also catch …/raw)
      if (typeof v !== 'number') return;
      const p = lab.paramSpecs && lab.paramSpecs[key];
      const m = lab.signals.meta.get(name) || {};                      // the declared range → 0..1 (bend -1..1, roll -π..π)
      const lo = typeof m.min === 'number' ? m.min : 0, hi = typeof m.max === 'number' ? m.max : 1;
      const u = Math.min(1, Math.max(0, hi === lo ? 0 : (v - lo) / (hi - lo)));
      if (!p || p.type === 'number' || p.type === 'int') lab.setParam(key, p && typeof p.min === 'number' && typeof p.max === 'number' ? p.min + u * (p.max - p.min) : u);
      else if (p.type === 'bool') lab.setParam(key, u > 0.5);
      else if (p.type === 'enum' && Array.isArray(p.options) && p.options.length) { const o = p.options[Math.min(p.options.length - 1, Math.floor(u * p.options.length))]; lab.setParam(key, o && typeof o === 'object' ? o.value : o); }
    });
  };
  midi.bind = bind;
  for (const p of (lab.meta && Array.isArray(lab.meta.params) ? lab.meta.params : [])) {
    // leap/… refs are bound by the leap module when the work declares it (no double binding)
    if (p && p.midi) for (const ref of [].concat(p.midi)) if (!(/^leap\//.test(String(ref)) && lab.uses && lab.uses.has('leap'))) bind(ref, p.key);
  }

  // ---- phones (/remote?work=<id>, MIDI tab): same device there, mirrored both ways
  if (!(window.__LAB__ && window.__LAB__.static) || qs.get('relay')) {
    let link = null;
    link = new RelayClient({ role: 'runner', room: lab.room, id: 'lab:' + lab.id,
      onStatus: (c) => { if (c.status === 'open' && !c._midiCfg) { c._midiCfg = true; c.config('midi', { profile: controllers.current.id }); } if (c.status !== 'open') c._midiCfg = false; } });
    const ln = linkControllers(link, lab.signals, controllers);
    link.connect();
    lab.frame(() => ln.flush());
  }

  // ---- the on-screen controller: 🎹 in the run page's toolbar (or a small button), docked at the bottom
  let panel = null;
  // the lab's own floating bits (toolbar, permission buttons) sit above the docked panel, not under it
  const lift = () => {
    const hh = panel && panel.isOpen ? panel.el.getBoundingClientRect().height : 0;
    for (const id of ['lab-rec', 'lab-dock', 'lab-midi-btn']) { const e = document.getElementById(id); if (e) e.style.bottom = (8 + hh) + 'px'; }
  };
  const openPanel = (on) => {
    if (!panel) {
      panel = mountMidiPanel(document.body, controllers, { mode: 'dock', open: false, id: 'lab-midi', onToggle: () => requestAnimationFrame(lift) });
      if (typeof ResizeObserver !== 'undefined') new ResizeObserver(lift).observe(panel.el);
    }
    on === undefined ? panel.toggle() : on ? panel.open() : panel.close();
    return panel;
  };
  midi.panel = { toggle: () => openPanel(), open: () => openPanel(true), close: () => openPanel(false), get el() { return panel && panel.el; } };
  const place = () => {
    if (lab.hideUi) return;
    const btn = document.createElement('button');
    btn.textContent = '🎹'; btn.title = 'MIDI 控制器：螢幕上彈，或接上硬體（' + controllers.current.profile.name + '）';
    btn.style.cssText = 'padding:7px 10px;border-radius:10px;border:1px solid rgba(255,255,255,.35);background:rgba(20,20,24,.72);color:#fff;font:inherit;backdrop-filter:blur(6px);cursor:pointer';
    btn.onclick = (e) => { openPanel(); btn.blur(); e.stopPropagation(); };
    let tries = 0;
    const t = setInterval(() => {   // lab.js builds its toolbar (#lab-rec) on DOMContentLoaded; static pages have none
      const row = document.getElementById('lab-rec');
      if (row && row.lastChild) { clearInterval(t); row.lastChild.insertBefore(btn, row.lastChild.lastChild); }
      else if (++tries > 12) { clearInterval(t); btn.id = 'lab-midi-btn'; btn.style.cssText += ';position:fixed;right:8px;bottom:8px;z-index:2147483646;font:13px system-ui,sans-serif'; document.body.appendChild(btn); }
    }, 150);
    // an old sketch waiting for a keyboard, and no keyboard: open the controller (not for automated checks)
    const auto = cfg.open === true || (shim && cfg.open !== false && !navigator.webdriver);
    if (auto) enabled.then(() => setTimeout(() => { if (!controllers.hardwareFor(controllers.current.id) || cfg.open === true) openPanel(true); }, 300));
  };
  if (document.body) place(); else document.addEventListener('DOMContentLoaded', place);
})();
