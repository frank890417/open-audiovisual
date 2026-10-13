/* oav-p5.js — Open Audio Visual for p5.js sketches. One line at the top of a sketch and it plays from MIDI.
 *
 *   document.head.prepend(Object.assign(document.createElement('script'), { src: 'https://openaudiovisual.com/p5/oav-p5.js' }))
 *
 * (or paste the same URL into OpenProcessing → Sketch → Libraries → Add Custom Library). p5 1.x and 2.x, global mode.
 *
 * Written the way p5 writes the mouse and the keyboard — read a variable, or define a function:
 *   knob1 … knob8       0..1, the controller's knobs in the order printed on it      knob(n) for any n
 *   fader1 … fader8     0..1, its faders                                              fader(n)
 *   pad1 … pad16        velocity 0..1 while the pad is held, 0 when released          pad(n)
 *   note, velocity      the last key (MIDI number) and how hard (0..1)                noteIsPressed, noteIsDown(60)
 *   function notePressed(note, velocity) {}   function noteReleased(note) {}
 *   function knobMoved(n, value) {}           function faderMoved(n, value) {}
 *   function padPressed(n, velocity) {}       function padReleased(n) {}
 *   (a pad also calls notePressed, unless the sketch defines padPressed)
 * Knob 1 is knob 1 on any controller OAV knows (MiniLab 3, LPD8, nanoKONTROL2, … 21 profiles); on one it doesn't,
 * the first knob you turn becomes knob1, the next knob2.
 *
 * With OP Configurator (OpenProcessing's OPC library): `OPC.slider('radius', 10)` names a variable and its range;
 * this file then wires the controller to it, in order — knob 1 → the first slider, knob 2 → the second, the faders
 * after the knobs, pad 1 → the first toggle or button. OPC's own panel moves with the knob. On OpenProcessing, whose
 * OPC panel can learn hardware itself (its MIDI switch), hardware is left to it once it is seen working.
 *
 * Three inputs, one stream of MIDI bytes, so a sketch never knows which one played:
 *   hardware  a real controller over Web MIDI (Chrome, Edge, Firefox; Safari and iPad have no Web MIDI)
 *   screen    🎹 bottom-right opens @openav/midi's <oav-controller>, the controller drawn on screen
 *   phone     📱 in that panel: a QR code to the OAV remote page; its MIDI tab plays the sketch over the relay
 *
 * MIDI-level access for those who want it: midi.note[60], midi.cc[74] (0..1), midi.bend, midi.held, midi.last
 * ({ type, note | cc, value, channel, source, control }), noteOn / noteOff / controlChange / pitchBend /
 * midiMessage(bytes, source), midi.on(event, fn) → off(), midi.play(60, 0.8). A sketch with its own Web MIDI code
 * (navigator.requestMIDIAccess, WebMidi.js) hears the screen and the phone as one more input, "OAV Virtual MIDI".
 *
 * Why `prepend`: p5's friendly errors read the page's last <script> as the sketch; first in <head>, this file is never
 * mistaken for the student's code (with `append` it was: p5 checked this file instead of theirs).
 *
 * Why one async line is enough: p5 1.x and 2.x start global mode on window `load`, and a script inserted while the
 * page is still loading holds `load` back until it has run, so this file is in place before setup(). If it cannot
 * load at all, code that reads knob1 / midi stops with "… is not defined": that message means the line did not load.
 *
 * Options (window.OAV_P5 = {…} before the line, ?key=value on this script's URL, or ?oav_key=value on the page —
 * OpenProcessing passes its page's ?sketch_oav_key=value through to the sketch):
 *   hardware  auto (ask for Web MIDI at once; the browser remembers) | click (ask from the 🎹 panel) | off
 *   panel     closed (just 🎹) | open | off        profile  the on-screen controller (default arturia-minilab3)
 *   dock      bottom | top · corner right | left (OpenProcessing: top-left — its console floats over the bottom, OPC's icon sits top-right)
 *   opc       on | off (wire the controller to OPC variables)   shim  on | off (the virtual port)
 *   relay / room   the phone relay (wss://remote.cheyuwu.com/relay) and room (one per browser)
 *   telemetry off | on — @openav/midi's one anonymous page-load hit (packages/midi/README "Telemetry")
 */
(function () {
  'use strict';
  var g = typeof window !== 'undefined' ? window : globalThis;
  var OAV_P5_VERSION = '0.2.2';   // (not `VERSION`: p5's friendly errors flag any declaration that shares a p5 name)
  if (g.OAVp5 && g.OAVp5.version) return;            // the line and the library both loaded it: the first one wins

  // ---------------------------------------------------------------- options
  var script = typeof document !== 'undefined' ? document.currentScript : null;
  var src = (script && script.src) || '';
  var fromSrc = {};
  try { new URL(src).searchParams.forEach(function (v, k) { fromSrc[k] = v; }); } catch (e) { /* inline or no DOM */ }
  var page = {};
  try { new URLSearchParams(g.location.search).forEach(function (v, k) { if (k.indexOf('oav_') === 0) page[k.slice(4)] = v; }); } catch (e) { /* */ }
  var user = (g.OAV_P5 && typeof g.OAV_P5 === 'object') ? g.OAV_P5 : {};
  function opt(k, d) { return user[k] != null ? String(user[k]) : page[k] != null ? page[k] : fromSrc[k] != null ? fromSrc[k] : d; }
  // where the rest of OAV lives: next to this file (a jsDelivr tag pins the whole tree), else the site
  var BASE = 'https://openaudiovisual.com/';
  try { if (src) BASE = new URL('../', src).href; } catch (e) { /* */ }
  var O = {
    hardware: opt('hardware', 'auto'), panel: opt('panel', 'closed'), profile: opt('profile', 'arturia-minilab3'),
    opc: opt('opc', 'on'), shim: opt('shim', 'on'), relay: opt('relay', 'wss://remote.cheyuwu.com/relay'), room: opt('room', ''),
    telemetry: opt('telemetry', 'off'), remote: opt('remote', 'https://openaudiovisual.com/packages/remote/'),
  };
  // OpenProcessing's console floats over the bottom of the sketch, so there the 🎹 and its panel live at the top
  var onOP = false;
  try { onOP = /(^|\.)openprocessing\.org$/.test(g.location.hostname); } catch (e) { /* */ }
  O.dock = opt('dock', onOP ? 'top' : 'bottom') === 'top' ? 'top' : 'bottom';
  O.corner = opt('corner', onOP ? 'left' : 'right') === 'left' ? 'left' : 'right';   // OpenProcessing puts OPC's icon top-right
  var profileChosen = opt('profile', null) != null;   // nobody chose ⇒ the panel follows the controller that is plugged in
  var zh = /^zh/i.test((g.navigator && g.navigator.language) || '');
  var T = zh
    ? { btn: 'MIDI：接鍵盤、按螢幕上的控制器，或用手機彈', phone: '📱 手機', close: '收起', hwOff: '沒接 MIDI 裝置', knob: '旋鈕', fader: '推桿', pad: '打擊墊',
        hwNone: '這個瀏覽器沒有 Web MIDI（Safari）：用螢幕上的控制器或手機', hwDenied: 'MIDI 權限被擋下了：網址列左邊可以重新允許',
        scan: '用手機掃描，打開 MIDI 分頁就能彈這個作品', room: '房間', wired: '已接上 OPC',
        opMidi: 'OpenProcessing 的 OPC MIDI 對應開著：實體控制器交給它，OAV 只接螢幕上的控制器和手機' }
    : { btn: 'MIDI: plug in a controller, play the one on screen, or use a phone', phone: '📱 Phone', close: 'Hide', hwOff: 'No MIDI device', knob: 'knob', fader: 'fader', pad: 'pad',
        hwNone: 'No Web MIDI in this browser (Safari): use the on-screen controller or a phone',
        hwDenied: 'MIDI permission is blocked: allow it again from the address bar', scan: 'Scan with a phone, open the MIDI tab and play this sketch', room: 'Room', wired: 'Wired to OPC',
        opMidi: "OpenProcessing's own OPC MIDI mapping is on: hardware is left to it; OAV wires the on-screen controller and the phone" };

  // ---------------------------------------------------------------- state the sketch reads
  function zeros(n) { var a = new Array(n); for (var i = 0; i < n; i++) a[i] = 0; return a; }
  var EVENTS = ['notePressed', 'noteReleased', 'knobMoved', 'faderMoved', 'padPressed', 'padReleased',
    'noteOn', 'noteOff', 'controlChange', 'pitchBend', 'midiMessage'];
  var subs = {}; EVENTS.forEach(function (k) { subs[k] = []; });
  var CTL = { knob: zeros(129), fader: zeros(129), pad: zeros(129) };   // 1-based, as printed on the controller
  var midi = {
    version: OAV_P5_VERSION, note: zeros(128), cc: zeros(128), bend: 0, held: [], last: null,
    hardware: 'off', devices: [], options: O,
    /** subscribe to any of the events above (noteon / noteoff spelled either way) → returns off() */
    on: function (name, fn) {
      var k = String(name).replace(/^note(on|off)$/i, function (m, s) { return 'note' + (s.toLowerCase() === 'on' ? 'On' : 'Off'); });
      if (!subs[k]) throw new Error('[oav-p5] unknown event "' + name + '" (' + EVENTS.join(', ') + ')');
      subs[k].push(fn);
      return function () { var i = subs[k].indexOf(fn); if (i >= 0) subs[k].splice(i, 1); };
    },
    /** play as if a controller did: midi.play(60, 0.8) … midi.play(60, 0) releases; source 'screen' */
    play: function (note, velocity) { var v = Math.max(0, Math.min(127, Math.round((velocity == null ? 1 : velocity) * 127))); input([v > 0 ? 0x90 : 0x80, note & 127, v], 'screen'); },
    /** feed raw bytes from anywhere (a WebSocket, a test): one message [status, d1, d2]; device = a profile id */
    input: function (bytes, source, device) { input(bytes, source || 'screen', device ? 'id:' + device : null); },
    connectHardware: function () { return connectHardware(); },
    panel: { open: function () { return openPanel(true); }, close: function () { return openPanel(false); }, toggle: function () { return openPanel(); } },
    phone: function () { return openPhone(); },
    /** which controller drives which OPC variable right now: [{ control: 'knob1', name: 'radius' }, …] */
    wiring: function (dev) { return opcWiring(tableFor(dev || 'screen')); },
  };

  // p5-style globals: what the mouse is to p5 (mouseX, mouseIsPressed, keyIsDown) the controller is here
  function setGlobal(name, value) { try { g[name] = value; } catch (e) { /* a sketch's own const of that name */ } }
  // a name is ours only while it still holds what we last wrote: a sketch that has (or later assigns) its own
  // `note` / `velocity` / `knob1` keeps it, and this file stops writing there (midi.last and knob(n) still work)
  var owned = {};
  function claim(name, value) { if (typeof g[name] === 'undefined') { setGlobal(name, value); if (g[name] === value) owned[name] = { v: value }; } }
  function put(name, value) {
    var o = owned[name];
    if (!o) return;
    if (g[name] !== o.v) { delete owned[name]; if (g.console) console.info('[oav-p5] the sketch has its own `' + name + '`: left alone'); return; }
    setGlobal(name, value); o.v = value;
  }
  var GLOBALS = { note: 0, velocity: 0, noteIsPressed: false };
  for (var gi = 1; gi <= 8; gi++) { GLOBALS['knob' + gi] = 0; GLOBALS['fader' + gi] = 0; }
  for (gi = 1; gi <= 16; gi++) GLOBALS['pad' + gi] = 0;
  var FUNCS = {
    knob: function (n) { return CTL.knob[n | 0] || 0; },
    fader: function (n) { return CTL.fader[n | 0] || 0; },
    pad: function (n) { return CTL.pad[n | 0] || 0; },
    noteIsDown: function (n) { return midi.note[n & 127] > 0; },
  };

  // ---------------------------------------------------------------- which control is which (per device)
  // An OAV profile (packages/midi/profiles/*.json) → { cc: {'ch:cc': [kind, n]}, note: {'ch:note': [kind, n]} },
  // knobs / faders / pads numbered in the order the profile lists them (= as printed on the device).
  function tableOf(p) {
    var t = { id: p.id, short: p.short, cc: {}, note: {}, count: { knob: 0, fader: 0, pad: 0 }, learn: false };
    var dch = p.channel || 1;
    (p.controls || []).forEach(function (c) {
      var kind = c.type === 'knob' ? 'knob' : c.type === 'fader' ? 'fader' : c.type === 'pad' ? 'pad' : null;
      if (!kind) return;
      var n = ++t.count[kind], ch = c.ch || dch;
      if (c.msg === 'cc' && c.cc != null) t.cc[ch + ':' + c.cc] = [kind, n];
      else if (c.msg === 'note' && c.note != null) t.note[ch + ':' + c.note] = [kind, n];
    });
    return t;
  }
  // the two controllers the course recommends, in profile shape so they go through tableOf like any other;
  // tests/p5-inject.test.js checks they still match packages/midi/profiles/*.json
  function mini(id, short, port, knobs, faders, pads) {
    var c = [];
    knobs.forEach(function (cc) { c.push({ type: 'knob', msg: 'cc', cc: cc, ch: 1 }); });
    faders.forEach(function (cc) { c.push({ type: 'fader', msg: 'cc', cc: cc, ch: 1 }); });
    pads.forEach(function (n) { c.push({ type: 'pad', msg: 'note', note: n, ch: 10 }); });
    return { id: id, short: short, kind: 'device', match: { ports: [port] }, channel: 1, controls: c };
  }
  var PADS = [36, 37, 38, 39, 40, 41, 42, 43];
  var BUILTIN = [
    mini('arturia-minilab3', 'minilab3', 'minilab\\s*3', [74, 71, 76, 77, 93, 18, 19, 16], [82, 83, 85, 17], PADS),
    mini('akai-lpd8', 'lpd8', 'lpd\\s*8', [70, 71, 72, 73, 74, 75, 76, 77], [], PADS),
  ];
  var profiles = null, profilesLoading = null;      // every OAV profile, loaded the first time a device needs one
  function loadProfiles() {
    if (!profilesLoading) {
      profilesLoading = Promise.resolve().then(function () { return import(BASE + 'packages/midi/profiles/index.js'); }).then(function (m) { profiles = m.PROFILES || []; tables = {}; return profiles; },
        function (e) { if (g.console) console.info('[oav-p5] controller profiles did not load (' + (e && e.message) + '): unknown devices map knobs in the order you turn them'); profiles = []; return profiles; });
    }
    return profilesLoading;
  }
  function findProfile(ref) {      // ref: an id / short name, or a port name to match
    var all = BUILTIN.concat(profiles || []);
    for (var i = 0; i < all.length; i++) if (all[i].id === ref || all[i].short === ref) return all[i];
    for (i = 0; i < all.length; i++) {
      var p = all[i];
      if (p.kind === 'device' && p.match && (p.match.ports || []).some(function (r) { return new RegExp(r, 'i').test(ref); })) return p;
    }
    return null;
  }
  var tables = {}, screenProfile = null;
  function tableFor(dev) {          // dev: 'hw:<port>' · 'screen' · 'id:<profile>' · null (= the on-screen profile)
    dev = dev || 'screen';
    if (tables[dev]) return tables[dev];
    var p = dev === 'screen' ? (screenProfile || findProfile(O.profile)) : findProfile(dev.replace(/^(hw|id):/, ''));
    if (!p && profiles === null) { loadProfiles(); return null; }   // not known yet: fetch every profile; this one message goes by without a knob number
    var t = p ? tableOf(p) : { id: null, cc: {}, note: {}, count: { knob: 0, fader: 0, pad: 0 }, learn: true };
    tables[dev] = t;
    return t;
  }

  // ---------------------------------------------------------------- the OPC bridge (OP Configurator 3000)
  function opcRef() { try { return typeof OPC !== 'undefined' && OPC && OPC.options ? OPC : null; } catch (e) { return null; } }
  function opcOf(types) {
    var o = opcRef(), out = [];
    if (!o || O.opc === 'off') return out;
    for (var k in o.options) { var x = o.options[k]; if (x && types.indexOf(x.type) >= 0) out.push(x); }
    return out;
  }
  // knobs → sliders in order, then the faders; pads → toggles and buttons in order
  function opcTarget(t, kind, n) {
    if (kind === 'pad') return opcOf(['toggle', 'button'])[n - 1] || null;
    var sliders = opcOf(['slider']);
    return sliders[(kind === 'fader' ? ((t && t.count.knob) || 0) : 0) + n - 1] || null;
  }
  function opcWiring(t) {
    var out = [], sliders = opcOf(['slider']), pads = opcOf(['toggle', 'button']), nKnob = (t && t.count.knob) || 8, nFader = (t && t.count.fader) || 0;
    sliders.forEach(function (s, i) { out.push({ control: i < nKnob ? 'knob' + (i + 1) : i < nKnob + nFader ? 'fader' + (i - nKnob + 1) : null, name: s.name }); });
    pads.forEach(function (s, i) { out.push({ control: 'pad' + (i + 1), name: s.name }); });
    return out.filter(function (w) { return w.control; });
  }
  // OpenProcessing (24.x) maps hardware to OPC itself when its OPC panel's MIDI switch is on (learned per sketch).
  // Seen working = an OPC_update from the page right after our own hardware message: from then on hardware is its job,
  // and OAV only wires what OpenProcessing cannot see — the on-screen controller and the phone.
  var lastHw = -1e9, opMapsHardware = false;
  var clock = function () { return typeof performance !== 'undefined' ? performance.now() : Date.now(); };
  if (onOP && g.addEventListener) g.addEventListener('message', function (e) {
    var d = e && e.data;
    if (opMapsHardware || !d || d.messageType !== 'OPC_update' || clock() - lastHw > 250) return;
    opMapsHardware = true;
    if (g.console) console.info('[oav-p5] ' + T.opMidi);
  });
  function opcDrive(t, kind, n, value, on, source) {
    if (source === 'hardware' && opMapsHardware) return;
    var o = opcRef(), x = o && opcTarget(t, kind, n);
    if (!x) return;
    try {
      if (x.type === 'slider') {
        var lo = +x.min || 0, hi = x.max == null ? lo + 1 : +x.max, v = lo + value * (hi - lo);
        if (x.step) v = Math.round((v - lo) / x.step) * x.step + lo;
        o.set(x.name, +v.toFixed(6));
      } else if (x.type === 'toggle') { if (on) o.set(x.name, !x.value); }
      else if (x.type === 'button') { if (on) o.buttonPressed(x.name, x.value); else o.buttonReleased(x.name, x.value); }
    } catch (e) { report('OPC', e); }
  }

  // ---------------------------------------------------------------- one parser for every source
  function call(name, args) {
    var fn = g[name];
    if (typeof fn === 'function') { try { fn.apply(g, args); } catch (e) { report(name, e); } }
    var list = subs[name].slice();
    for (var i = 0; i < list.length; i++) { try { list[i].apply(g, args); } catch (e) { report(name, e); } }
  }
  function has(name) { return typeof g[name] === 'function' || subs[name].length > 0; }
  // the sketch's own error: show it like p5 would (the console, with its stack), keep the MIDI loop alive
  function report(name, e) { if (g.console) console.error('[oav-p5] error inside ' + name + '():', e); }

  var virtualPort = null;                              // the shim's virtual input, once a sketch asked for Web MIDI
  function input(data, source, dev) {
    if (!data || data.length < 1) return;
    var b0 = data[0] | 0, b1 = (data[1] | 0) & 127, b2 = (data[2] | 0) & 127;
    if (b0 < 0x80 || b0 >= 0xF0) return;               // clock (0xF8 ×24 per beat), sysex, running status: not for sketches
    var type = b0 & 0xF0, ch = (b0 & 0x0F) + 1, bytes = [b0, b1, b2];
    if (source === 'hardware') lastHw = clock();
    if (source !== 'hardware' && virtualPort) virtualPort.emit(bytes);   // hardware already reaches the sketch's own Web MIDI code
    if (source !== 'screen' && view && view.ingest) { try { view.ingest(bytes); } catch (e) { /* never block a note on the faceplate */ } }
    var t = tableFor(dev || (source === 'screen' ? 'screen' : null));
    var on = type === 0x90 && b2 > 0;
    if (type === 0x90 || type === 0x80) {
      var v = on ? b2 / 127 : 0, m = t && t.note[ch + ':' + b1];
      midi.note[b1] = v;
      var i = midi.held.indexOf(b1);
      if (on && i < 0) { midi.held.push(b1); midi.held.sort(function (a, b) { return a - b; }); } else if (!on && i >= 0) midi.held.splice(i, 1);
      midi.last = { type: on ? 'noteOn' : 'noteOff', note: b1, value: v, channel: ch, source: source, control: m ? m[0] + m[1] : null };
      put('noteIsPressed', midi.held.length > 0);
      if (on) { put('note', b1); put('velocity', v); }
      if (m) { CTL.pad[m[1]] = v; put('pad' + m[1], v); }
      call('midiMessage', [bytes, source]);
      call(on ? 'noteOn' : 'noteOff', on ? [b1, v, ch] : [b1, ch]);
      if (m) { call(on ? 'padPressed' : 'padReleased', on ? [m[1], v] : [m[1]]); opcDrive(t, 'pad', m[1], v, on, source); }
      if (!m || !has(on ? 'padPressed' : 'padReleased')) call(on ? 'notePressed' : 'noteReleased', on ? [b1, v] : [b1]);
    } else if (type === 0xB0) {
      var c = b2 / 127, k = t && t.cc[ch + ':' + b1];
      if (!k && t && t.learn && t.count.knob < 128) { k = t.cc[ch + ':' + b1] = ['knob', ++t.count.knob]; }   // unknown device: in the order turned
      midi.cc[b1] = c;
      midi.last = { type: 'controlChange', cc: b1, value: c, channel: ch, source: source, control: k ? k[0] + k[1] : null };
      call('midiMessage', [bytes, source]); call('controlChange', [b1, c, ch]);
      if (k && (k[0] === 'knob' || k[0] === 'fader')) {
        CTL[k[0]][k[1]] = c; put(k[0] + k[1], c);
        call(k[0] === 'knob' ? 'knobMoved' : 'faderMoved', [k[1], c]);
        opcDrive(t, k[0], k[1], c, true, source);
      } else if (k && k[0] === 'pad') {                // a pad in CC mode
        CTL.pad[k[1]] = c; put('pad' + k[1], c);
        call(c > 0 ? 'padPressed' : 'padReleased', c > 0 ? [k[1], c] : [k[1]]); opcDrive(t, 'pad', k[1], c, c > 0, source);
      }
    } else if (type === 0xE0) {
      var raw = (b2 << 7) | b1;
      midi.bend = raw >= 8192 ? (raw - 8192) / 8191 : (raw - 8192) / 8192;
      midi.last = { type: 'pitchBend', value: midi.bend, channel: ch, source: source, control: null };
      call('midiMessage', [bytes, source]); call('pitchBend', [midi.bend, ch]);
    } else {
      call('midiMessage', [bytes, source]);              // aftertouch, program change: raw only
    }
  }

  // ---------------------------------------------------------------- hardware (Web MIDI)
  var nav = g.navigator || {};
  var realRequest = typeof nav.requestMIDIAccess === 'function' ? nav.requestMIDIAccess.bind(nav) : null;
  var access = null, wired = typeof WeakSet === 'function' ? new WeakSet() : null, asking = null;
  function setHardware(s) { midi.hardware = s; paintButton(); }
  function wire() {
    var names = [];
    access.inputs.forEach(function (inp) {
      if (inp.state === 'disconnected') return;
      var name = inp.name || 'MIDI';
      names.push(name);
      if (wired && wired.has(inp)) return;
      if (wired) wired.add(inp);
      if (!findProfile(name)) loadProfiles().then(function () { delete tables['hw:' + name]; });   // nanoKONTROL2 & co.
      // addEventListener, not onmidimessage: the sketch's own Web MIDI code may hold the same port object
      try { inp.addEventListener('midimessage', function (e) { input(e.data, 'hardware', 'hw:' + name); }); if (inp.open) inp.open().catch(function () {}); } catch (e) { /* */ }
      var p = findProfile(name);
      if (p && !profileChosen) { O.profile = p.id; screenProfile = null; delete tables.screen; if (view) view.setAttribute('profile', p.id); }
    });
    midi.devices = names;
    setHardware(names.length ? 'connected' : 'waiting');
  }
  function connectHardware() {
    if (asking) return asking;
    if (!realRequest) { setHardware('unavailable'); return Promise.resolve(false); }
    setHardware('asking');
    asking = Promise.resolve().then(function () { return realRequest({ sysex: false }); }).then(function (acc) {
      access = acc; wire();
      try { acc.addEventListener('statechange', function () { wire(); }); } catch (e) { /* */ }
      return true;
    }, function (e) {
      setHardware(e && (e.name === 'NotAllowedError' || e.name === 'SecurityError') ? 'denied' : 'unavailable');
      if (g.console) console.info('[oav-p5] no hardware MIDI here (' + (e && e.name) + ') — the 🎹 on-screen controller and a phone still play the sketch');
      asking = null;
      return false;
    });
    return asking;
  }

  // ---------------------------------------------------------------- the shim: sketches with their own Web MIDI code
  // Safari / iPad included: there the sketch gets the virtual port alone, so a WebMidi.js sketch still runs
  if (O.shim !== 'off' && g.navigator) {
    nav.requestMIDIAccess = function (opts) {
      return import(BASE + 'packages/midi/virtual-access.js').then(function (m) {
        var make = function () {
          if (!virtualPort) virtualPort = m.createVirtualMIDIAccess({ name: 'OAV Virtual MIDI', manufacturer: 'open-audiovisual', id: 'oav-p5' });
          return virtualPort;
        };
        // the sketch's request asks for real ports too (its own permission prompt, its own answer)
        return m.virtualRequestMIDIAccess({ real: realRequest, make: make })(opts || {});
      });
    };
  }

  // ---------------------------------------------------------------- on-screen UI: 🎹 button → docked controller
  var doc = g.document, btn = null, dock = null, view = null, legend = null, panelOpen = false, loading = null;
  var Z = 2147483000;
  function el(tag, css, txt) { var e = doc.createElement(tag); if (css) e.style.cssText = css; if (txt != null) e.textContent = txt; return e; }
  // a press on the panel is not a press on the sketch (p5 listens on window)
  function fence(e) { ['mousedown', 'mouseup', 'click', 'touchstart', 'touchend', 'pointerdown', 'pointerup', 'wheel', 'keydown', 'keyup'].forEach(function (t) { e.addEventListener(t, function (ev) { ev.stopPropagation(); }); }); }
  function paintButton() {
    if (!btn) return;
    var hwColor = { connected: '#5fe08a', waiting: '#e0c25f', asking: '#e0c25f', denied: '#e06b5f', unavailable: '#8a8a8a', off: '#8a8a8a' }[midi.hardware] || '#8a8a8a';
    btn.firstChild.style.background = hwColor;
    var hint = midi.hardware === 'connected' ? midi.devices.join(', ') : midi.hardware === 'unavailable' ? T.hwNone : midi.hardware === 'denied' ? T.hwDenied : T.hwOff;
    btn.title = T.btn + '\n' + hint;
  }
  function wiringText() {
    var w = opcWiring(tableFor('screen'));
    if (!w.length) return '';
    return T.wired + '：' + w.map(function (x) { var m = /^(\D+)(\d+)$/.exec(x.control); return T[m[1]] + m[2] + ' → ' + x.name; }).join(' · ');
  }
  function placeButton() {
    if (O.panel === 'off' || btn || !doc || !doc.body) return;
    btn = el('button', 'position:fixed;' + O.corner + ':10px;' + O.dock + ':10px;z-index:' + Z + ';display:flex;align-items:center;gap:6px;padding:6px 10px;' +
      'border-radius:999px;border:1px solid rgba(255,255,255,.3);background:rgba(18,18,22,.78);color:#fff;font:600 13px system-ui,sans-serif;' +
      'cursor:pointer;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)');
    btn.type = 'button'; btn.id = 'oav-p5-button';
    btn.appendChild(el('span', 'width:7px;height:7px;border-radius:50%;background:#8a8a8a;display:inline-block'));
    btn.appendChild(el('span', '', '🎹'));
    btn.addEventListener('click', function () { openPanel(); btn.blur(); });
    fence(btn);
    doc.body.appendChild(btn);
    paintButton();
    if (O.panel === 'open') openPanel(true);
    // say once, in the console, what the controller is wired to (OPC variables are declared by now)
    setTimeout(function () { var s = wiringText(); if (s && g.console) console.info('[oav-p5] ' + s); }, 0);
  }
  function lift() { if (btn) btn.style[O.dock] = (10 + (panelOpen && dock ? dock.getBoundingClientRect().height : 0)) + 'px'; }
  function openPanel(want) {
    if (!doc || O.panel === 'off') return Promise.resolve(null);
    var on = want == null ? !panelOpen : !!want;
    if (!on) { panelOpen = false; if (dock) dock.style.display = 'none'; lift(); return Promise.resolve(null); }
    if (O.hardware === 'click' && midi.hardware === 'off') connectHardware();
    if (!loading) loading = buildDock();
    return loading.then(function (d) { panelOpen = true; d.style.display = 'block'; if (legend) legend.textContent = wiringText(); lift(); return d; });
  }
  function buildDock() {
    dock = el('div', 'position:fixed;left:0;right:0;' + O.dock + ':0;z-index:' + (Z - 1) + ';max-height:50vh;overflow:auto;display:none;' +
      'background:rgba(14,14,18,.92);border-' + (O.dock === 'top' ? 'bottom' : 'top') + ':1px solid rgba(255,255,255,.18);padding:6px 10px 10px;box-sizing:border-box;' +
      'backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)');
    dock.id = 'oav-p5-panel';
    fence(dock);
    var bar = el('div', 'display:flex;gap:8px;align-items:center;margin-bottom:4px;font:600 12px system-ui,sans-serif;color:#ddd' + (O.corner === 'left' ? ';flex-direction:row-reverse' : ''));
    legend = el('div', 'flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#9fd8ff;font-weight:500');
    var ph = el('button', 'padding:4px 10px;border-radius:8px;border:1px solid rgba(255,255,255,.3);background:none;color:#fff;cursor:pointer;font:inherit', T.phone);
    ph.type = 'button'; ph.addEventListener('click', function () { openPhone(); });
    var cl = el('button', 'padding:4px 10px;border-radius:8px;border:1px solid rgba(255,255,255,.3);background:none;color:#fff;cursor:pointer;font:inherit', T.close);
    cl.type = 'button'; cl.addEventListener('click', function () { openPanel(false); });
    bar.appendChild(legend); bar.appendChild(ph); bar.appendChild(cl);
    dock.appendChild(bar);
    doc.body.appendChild(dock);
    return import(BASE + 'packages/midi/element.js').then(function () {
      view = doc.createElement('oav-controller');
      view.setAttribute('profile', O.profile);
      view.setAttribute('picker', '');
      view.setAttribute('layout', g.innerWidth >= 600 ? 'face' : 'auto');
      view.setAttribute('telemetry', O.telemetry === 'on' ? 'on' : 'off');
      if (zh) view.setAttribute('lang', 'zh');
      // what a hand plays on the faceplate enters like any controller; what the faceplate shows because
      // hardware or a phone played (ingest → source 'hardware') is already in
      view.addEventListener('control', function (e) {
        var d = e.detail || {};
        if (d.source !== 'ui' || !d.bytes || !d.bytes.length) return;
        var list = Array.isArray(d.bytes[0]) ? d.bytes : [d.bytes];
        for (var i = 0; i < list.length; i++) input(list[i], 'screen', 'screen');
      });
      // the whole faceplate in one screen: on a wide window, shrink it to the dock's height (the keys are at the bottom);
      // a narrow one (a phone) gets the element's own stacked layout instead
      var fit = function () {
        var f = view.profileData && view.profileData.face;
        var wide = g.innerWidth >= 600, layout = wide ? 'face' : 'auto';
        if (view.getAttribute('layout') !== layout) view.setAttribute('layout', layout);   // auto would re-grid a shrunk face into a tall stack
        if (!f || !f.w || !f.h || !wide) { view.style.width = ''; return; }
        var room = g.innerHeight * 0.5 - 86;               // the dock's cap minus its bar and the element's picker row
        view.style.width = Math.max(320, Math.min(dock.clientWidth - 20, room * f.w / f.h)) + 'px';
        view.style.margin = '0 auto';
      };
      var follow = function () {                          // the device on screen decides what knob1 means for the screen
        screenProfile = view.profileData || null; delete tables.screen;
        if (legend) legend.textContent = wiringText();
        if (relay && view.profileData) relay.config('midi', { profile: view.profileData.id });
        fit();
      };
      view.addEventListener('ready', follow); view.addEventListener('profilechange', follow); g.addEventListener('resize', fit);
      dock.appendChild(view);
      if (typeof ResizeObserver === 'function') new ResizeObserver(lift).observe(dock);
      return dock;
    }, function (e) {
      dock.appendChild(el('div', 'color:#e06b5f;font:12px system-ui,sans-serif', '[oav-p5] could not load the on-screen controller: ' + (e && e.message)));
      return dock;
    });
  }

  // ---------------------------------------------------------------- phone: the OAV remote page over the public relay
  var relay = null, card = null;
  function roomName() {
    if (O.room) return O.room.replace(/[^\w-]/g, '').slice(0, 32) || 'default';
    var r = null;
    try { r = g.localStorage.getItem('oav.p5.room'); } catch (e) { /* */ }
    if (!r) { r = 'p5-' + Math.random().toString(36).slice(2, 7); try { g.localStorage.setItem('oav.p5.room', r); } catch (e) { /* */ } }
    return r;
  }
  function phoneURL(room) { return O.remote + '?relay=' + encodeURIComponent(O.relay) + '&room=' + encodeURIComponent(room) + '&tab=midi'; }
  function openPhone() {
    var room = roomName();
    if (!relay) {
      relay = { config: function () {} };              // placeholder until the client module is in
      import(BASE + 'packages/relay/index.js').then(function (m) {
        var url = O.relay + (O.relay.indexOf('?') >= 0 ? '&' : '?') + 'role=runner&room=' + encodeURIComponent(room) + '&id=p5-' + Math.random().toString(36).slice(2, 6);
        relay = new m.RelayClient({
          role: 'runner', room: room, url: url,
          onStatus: function (c) { if (c.status === 'open') c.config('midi', { profile: (view && view.profileData && view.profileData.id) || O.profile }); },
          // the phone's MIDI tab sends `midi/virtual` = the raw bytes it played, and which device it shows (it also
          // sends midi/note/…, midi/cc/… for shows — taking only the bytes means every press counts once)
          onSignal: function (name, value) { if (name === 'midi/virtual' && value && Array.isArray(value.data)) input(value.data, 'phone', value.device ? 'id:' + value.device : 'screen'); },
        });
        relay.connect();
      }, function (e) { if (g.console) console.warn('[oav-p5] relay client did not load', e); });
    }
    if (!doc) return room;
    if (card) { card.style.display = card.style.display === 'none' ? 'flex' : 'none'; return room; }
    card = el('div', 'position:fixed;inset:0;z-index:' + (Z + 1) + ';display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.55)');
    fence(card);
    var cardBox = el('div', 'background:#fff;color:#111;border-radius:14px;padding:16px;max-width:300px;text-align:center;font:500 13px/1.45 system-ui,sans-serif');
    var link = phoneURL(room);
    var qr = el('div', 'margin:0 auto 10px;width:220px;height:220px;display:flex;align-items:center;justify-content:center;color:#888', '…');
    var a = el('a', 'word-break:break-all;color:#225;font-size:11px', link); a.href = link; a.target = '_blank'; a.rel = 'noopener';
    cardBox.appendChild(qr); cardBox.appendChild(el('div', 'margin-bottom:6px', T.scan)); cardBox.appendChild(el('div', 'font:700 15px ui-monospace,monospace;margin-bottom:6px', T.room + ' ' + room)); cardBox.appendChild(a);
    card.appendChild(cardBox);
    card.addEventListener('click', function (e) { if (e.target === card) card.style.display = 'none'; });
    doc.body.appendChild(card);
    // a small MIT QR encoder, loaded only when someone asks for a phone (qrcode-generator, Kazuhiko Arase)
    loadScript('https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js').then(function () {
      var q = g.qrcode(0, 'M'); q.addData(link); q.make();
      qr.innerHTML = q.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
      var svg = qr.firstChild; if (svg && svg.style) { svg.style.width = '220px'; svg.style.height = '220px'; }
    }, function () { qr.textContent = link; });
    return room;
  }
  function loadScript(u) {
    return new Promise(function (ok, no) { var s = doc.createElement('script'); s.src = u; s.onload = ok; s.onerror = no; doc.head.appendChild(s); });
  }

  // ---------------------------------------------------------------- publish + start
  g.OAVp5 = midi;
  midi._tableOf = tableOf; midi._builtin = BUILTIN;   // for tests: the built-in tables are checked against the profiles
  // `midi` is the name MIDI-minded sketches read; a page that already has its own keeps it (then use OAVp5)
  var taken = false;
  try { taken = typeof g.midi !== 'undefined' && g.midi !== midi; } catch (e) { taken = true; }
  if (!taken) setGlobal('midi', midi);
  else if (g.console) console.warn('[oav-p5] this page already has a `midi` — read OAVp5.note / OAVp5.cc instead');
  g.oavMidi = midi;
  // the p5-style names: never over a sketch's own variable or function of the same name
  Object.keys(GLOBALS).forEach(function (k) { claim(k, GLOBALS[k]); });
  Object.keys(FUNCS).forEach(function (k) { if (typeof g[k] === 'undefined') setGlobal(k, FUNCS[k]); });

  if (O.hardware === 'auto') connectHardware();
  if (doc) { if (doc.body) placeButton(); else doc.addEventListener('DOMContentLoaded', placeButton); }
})();
