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
 * The microphone reads the same way (off until the sketch reads one of these, calls startMic(), or 🎹 → 🎤 is pressed):
 *   micLevel            0..1, how loud (smoothed)                                     micIsOn, startMic(), stopMic()
 *   bass, mid, treble   0..1, the energy in 20–250 Hz, 250–2000 Hz, 2000–8000 Hz
 *   beat                true for one frame per beat — the way mouseIsPressed is true while pressed
 *   function beatDetected(level) {}           function kickDetected(level) {}   snareDetected, hatDetected
 *   (the analysis is @openav/audio, loaded from next to this file the first time; no p5.sound needed, none disturbed)
 * Sound, a drum machine and a timeline (nothing of them loads until the sketch calls one, or 🎹 → 🔊 / 🥁 is pressed):
 *   startSound('piano'), stopSound(), soundIsOn   every key, pad, the 🎹 on screen and a phone are heard (@openav/sound)
 *   startDrums('breakbeat', 120), stopDrums()     a 16-step × 4-lane machine on screen (@openav/drums); drumsAreOn
 *   drumStep 0..15, drumBar 1, 2, 3 …, drumBpm    where the machine is
 *   function drumHit(lane, velocity) {}           and each hit also calls kickDetected / snareDetected / hatDetected
 *   function barStarted(bar) {}                   function stepStarted(step, bar) {}   (beatDetected on kick and snare)
 *   cue(5, 'storm'), cue(1, 'calm', 8)            at bar 5 (every 8 bars) → function cueFired(name, bar) {}; cueName
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
 *   mic       auto (the first read of micLevel / bass / … asks for the microphone) | click (only 🎹 → 🎤 or startMic()) | off
 *   sound     click (startSound() or 🎹 → 🔊) | off | an instrument id: heard from the first click, no code (piano, organ, …)
 *   tone      where Tone.js 15 comes from (an ES module URL; default jsDelivr)
 *   relay / room   the phone relay (wss://remote.cheyuwu.com/relay) and room (one per browser)
 *   telemetry off | on — @openav/midi's one anonymous page-load hit (packages/midi/README "Telemetry")
 */
(function () {
  'use strict';
  var g = typeof window !== 'undefined' ? window : globalThis;
  var OAV_P5_VERSION = '0.4.0';   // (not `VERSION`: p5's friendly errors flag any declaration that shares a p5 name)
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
  // where the rest of OAV lives: next to this file (a jsDelivr tag pins the whole tree), else the site; the imports
  // carry ?v=p5-<version> because the site's .js is cached for 4 h (tools/stamp-version.mjs does this for pages)
  var BASE = 'https://openaudiovisual.com/';
  try { if (src) BASE = new URL('../', src).href; } catch (e) { /* */ }
  var O = {
    hardware: opt('hardware', 'auto'), panel: opt('panel', 'closed'), profile: opt('profile', 'arturia-minilab3'),
    opc: opt('opc', 'on'), shim: opt('shim', 'on'), relay: opt('relay', 'wss://remote.cheyuwu.com/relay'), room: opt('room', ''),
    mic: opt('mic', 'auto') === 'click' ? 'click' : opt('mic', 'auto') === 'off' ? 'off' : 'auto',
    telemetry: opt('telemetry', 'off'), remote: opt('remote', 'https://openaudiovisual.com/packages/remote/'),
    sound: opt('sound', 'click'), tone: opt('tone', ''),   // sound: click | off | an instrument id to start with
  };
  // OpenProcessing's console floats over the bottom of the sketch, so there the 🎹 and its panel live at the top
  var onOP = false;
  try { onOP = /(^|\.)openprocessing\.org$/.test(g.location.hostname); } catch (e) { /* */ }
  O.dock = opt('dock', onOP ? 'top' : 'bottom') === 'top' ? 'top' : 'bottom';
  O.corner = opt('corner', onOP ? 'left' : 'right') === 'left' ? 'left' : 'right';   // OpenProcessing puts OPC's icon top-right
  var DEBUG = opt('debug', '') !== '' && opt('debug', '') !== '0';   // ?debug=1: say in the console what the 🎹 sees
  function dbg() { if (DEBUG && g.console) console.log.apply(console, ['[oav-p5 debug]'].concat([].slice.call(arguments))); }
  var profileChosen = opt('profile', null) != null;   // nobody chose ⇒ the panel follows the controller that is plugged in
  var zh = /^zh/i.test((g.navigator && g.navigator.language) || '');
  var T = zh
    ? { btn: 'MIDI：接鍵盤、按螢幕上的控制器，或用手機彈', phone: '📱 手機', close: '收起', hwOff: '沒接 MIDI 裝置', knob: '旋鈕', fader: '推桿', pad: '打擊墊',
        hwNone: '這個瀏覽器沒有 Web MIDI（Safari）：用螢幕上的控制器或手機', hwDenied: 'MIDI 權限被擋下了：網址列左邊可以重新允許',
        scan: '用手機掃描，打開 MIDI 分頁就能彈這個作品', room: '房間', wired: '已接上 OPC', loading: '載入控制器中…（第一次要幾秒）',
        opMidi: 'OpenProcessing 的 OPC MIDI 對應開著：實體控制器交給它，OAV 只接螢幕上的控制器和手機',
        micOn: '🎤 開麥克風', micOff: '🎤 關麥克風', micAsking: '🎤 等你允許麥克風…', micDenied: '🎤 麥克風被擋下，再試一次', micDeniedHint: '網址列左邊可以重新允許，然後按這個鈕', micNone: '🎤 這裡拿不到麥克風（要 https 或 localhost）',
        micHint: 'micLevel、bass、mid、treble、beat',
        sndOn: '🔊 開聲音', sndOff: '🔊 關聲音', sndLoading: '🔊 載入聲音中…', sndWaiting: '🔊 點一下就有聲音', sndError: '🔊 聲音沒載到，再按一次',
        sndHint: '點一下畫面（或按一個鍵）就聽得到：瀏覽器要網頁被點過才讓它出聲', drumsOn: '🥁 鼓機', drumsOff: '🥁 關鼓機', fold: '收起格子', closeDrums: '關掉鼓機' }
    : { btn: 'MIDI: plug in a controller, play the one on screen, or use a phone', phone: '📱 Phone', close: 'Hide', hwOff: 'No MIDI device', knob: 'knob', fader: 'fader', pad: 'pad',
        hwNone: 'No Web MIDI in this browser (Safari): use the on-screen controller or a phone',
        hwDenied: 'MIDI permission is blocked: allow it again from the address bar', scan: 'Scan with a phone, open the MIDI tab and play this sketch', room: 'Room', wired: 'Wired to OPC', loading: 'Loading the controller… (a few seconds the first time)',
        opMidi: "OpenProcessing's own OPC MIDI mapping is on: hardware is left to it; OAV wires the on-screen controller and the phone",
        micOn: '🎤 Turn on microphone', micOff: '🎤 Turn off microphone', micAsking: '🎤 Waiting for you to allow the microphone…', micDenied: '🎤 Blocked: try again', micDeniedHint: 'Allow the microphone again from the address bar, then press this button', micNone: '🎤 No microphone here (needs https or localhost)',
        micHint: 'micLevel, bass, mid, treble, beat',
        sndOn: '🔊 Turn on sound', sndOff: '🔊 Turn off sound', sndLoading: '🔊 Loading sound…', sndWaiting: '🔊 Click to hear', sndError: '🔊 Sound did not load: try again',
        sndHint: 'click the page (or press a key) once to hear it: browsers let a page play audio only after a click', drumsOn: '🥁 Drums', drumsOff: '🥁 Stop drums', fold: 'Fold the grid', closeDrums: 'Stop the drum machine' };

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
  var GLOBALS = { note: 0, velocity: 0, noteIsPressed: false, micIsOn: false,
    soundIsOn: false, drumsAreOn: false, drumStep: 0, drumBar: 0, drumBpm: 112, cueName: '' };
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
      profilesLoading = Promise.resolve().then(function () { return import(BASE + 'packages/midi/profiles/index.js?v=p5-' + OAV_P5_VERSION); }).then(function (m) { profiles = m.PROFILES || []; tables = {}; return profiles; },
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
      if (sndOn) soundNote(on, b1, v, ch);               // heard before the sketch draws it: a slow callback never delays the sound
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
      if (sndOn && b1 === 64) sndBus.emit('midi/cc/64', c);   // the sustain pedal
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
      // A listener, plus onmidimessage only while nobody else has set one: the sketch's own Web MIDI code (WebMidi.js
      // sets onmidimessage) may hold the same port object, and a browser that opens a port only for onmidimessage still
      // delivers. The same event reaching both is counted once.
      var seen = null;
      var onPort = function (e) { if (e === seen) return; seen = e; input(e.data, 'hardware', 'hw:' + name); };
      try {
        inp.addEventListener('midimessage', onPort);
        if (!inp.onmidimessage) inp.onmidimessage = onPort;
        if (inp.open) inp.open().catch(function () {});
      } catch (e) { /* */ }
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
      return import(BASE + 'packages/midi/virtual-access.js?v=p5-' + OAV_P5_VERSION).then(function (m) {
        var make = function () {
          if (!virtualPort) virtualPort = m.createVirtualMIDIAccess({ name: 'OAV Virtual MIDI', manufacturer: 'open-audiovisual', id: 'oav-p5' });
          return virtualPort;
        };
        // the sketch's request asks for real ports too (its own permission prompt, its own answer)
        return m.virtualRequestMIDIAccess({ real: realRequest, make: make })(opts || {});
      });
    };
  }

  // ---------------------------------------------------------------- the microphone: micLevel · bass · mid · treble · beat
  // Off until a sketch asks: it reads one of the names below, calls startMic(), or someone presses 🎤 in the 🎹 panel.
  // The analysis is @openav/audio's AudioAnalyzer (loaded from next to this file, the first time) with its own
  // AudioContext, so p5.sound can run beside it. Browsers want a click before audio plays: a read from draw() asks
  // for the microphone at once, and the first click or key afterwards starts it if the browser held it back.
  var micCbs = { beat: 'beatDetected', kick: 'kickDetected', snare: 'snareDetected', hat: 'hatDetected' };
  var micSubs = { beat: [], kick: [], snare: [], hat: [] };
  var mic = {
    state: 'off',                                   // off · asking · on · denied · unavailable
    gain: 1,                                        // multiplies micLevel / bass / mid / treble (clamped to 1): for a quiet microphone
    level: 0, bass: 0, mid: 0, treble: 0, error: null, analyzer: null,
    start: function () { micStopped = false; return startMic(); }, stop: function () { return stopMic(); },
    /** mic.on('beat' | 'kick' | 'snare' | 'hat', fn(level)) → off() */
    on: function (name, fn) {
      if (!micSubs[name]) throw new Error('[oav-p5] unknown mic event "' + name + '" (' + Object.keys(micSubs).join(', ') + ')');
      micSubs[name].push(fn);
      return function () { var i = micSubs[name].indexOf(fn); if (i >= 0) micSubs[name].splice(i, 1); };
    },
    _frame: function (f) { return micFrame(f); },   // for tests: one analyser frame in
  };
  midi.mic = mic;
  var micStarting = null, micAudio = null, micStopped = false, micTries = 0, micRead = false, micLoop = false;
  var micSeq = 0, micSeen = 0, micTick = 0, micFrameAt = null, micFrameBeat = false;
  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function setMic(s) {
    if (mic.state === s) return;
    mic.state = s; put('micIsOn', s === 'on'); paintMic();
    if (s === 'on' && g.console) console.info('[oav-p5] microphone on: ' + T.micHint + ' · beatDetected(level), kickDetected, snareDetected, hatDetected');
  }
  function micNeeded(why) {                          // a sketch read a mic name
    if (O.mic !== 'auto' || micStopped || mic.state !== 'off') return;
    micRead = true; dbg('microphone asked for by a read of', why);
    startMic();
  }
  function startMic() {
    if (O.mic === 'off') return Promise.resolve(false);   // the option is a promise to the page: nothing here opens the microphone
    if (mic.state === 'on') return Promise.resolve(true);
    if (micStarting) return micStarting;
    var md = nav.mediaDevices;
    if (!md || typeof md.getUserMedia !== 'function') {
      mic.error = 'no getUserMedia'; setMic('unavailable');
      if (g.console) console.info('[oav-p5] no microphone here: the browser offers none to this page (it needs https or localhost)');
      return Promise.resolve(false);
    }
    micTries++; setMic('asking');
    var p = micStarting = Promise.resolve().then(function () { return import(BASE + 'packages/audio/index.js?v=p5-' + OAV_P5_VERSION); }).then(function (m) {
      var a = new m.AudioAnalyzer({ fftSize: 2048 });
      return a.enableMic().then(function () { micAudio = a; mic.analyzer = a; mic.error = null; micStopped = false; setMic('on'); runMic(); return true; });
    }).then(null, function (e) {
      mic.error = (e && (e.name || e.message)) || String(e);
      setMic(e && (e.name === 'NotAllowedError' || e.name === 'SecurityError') ? 'denied' : 'unavailable');
      if (g.console) console.info('[oav-p5] no microphone (' + mic.error + '): ' + (mic.state === 'denied' ? 'allow it from the address bar, then click once' : 'is one plugged in?'));
      return false;
    });
    p.then(function () { if (micStarting === p) micStarting = null; });
    return p;
  }
  function stopMic() {
    micStopped = true;
    try { var s = micAudio && micAudio.source && micAudio.source.mediaStream; if (s) s.getTracks().forEach(function (t) { t.stop(); }); } catch (e) { /* */ }
    try { if (micAudio && micAudio.ctx && micAudio.ctx.close) micAudio.ctx.close(); } catch (e) { /* */ }
    micAudio = null; mic.analyzer = null; micStarting = null;
    mic.level = mic.bass = mic.mid = mic.treble = 0;
    setMic('off'); paintMic();
    return Promise.resolve(false);
  }
  function runMic() {
    if (micLoop) return;
    micLoop = true;
    var raf = typeof g.requestAnimationFrame === 'function' ? function (fn) { g.requestAnimationFrame(fn); } : function (fn) { setTimeout(fn, 16); };
    (function tick() {
      if (mic.state !== 'on' || !micAudio) { micLoop = false; return; }
      var f = null;
      try { f = micAudio.update(); } catch (e) { report('microphone', e); }
      if (f) micFrame(f);
      raf(tick);
    })();
  }
  function micCall(kind, level) {
    var name = micCbs[kind], fn = g[name];
    if (typeof fn === 'function') { try { fn.call(g, level); } catch (e) { report(name, e); } }
    var list = micSubs[kind].slice();
    for (var i = 0; i < list.length; i++) { try { list[i].call(g, level); } catch (e) { report(name, e); } }
  }
  function micFrame(f) {
    var k = mic.gain;
    var db = f.rms > 1e-5 ? 20 * Math.log10(f.rms) : -100;
    mic.level = clamp01((db + 60) / 50 * k);          // -60 dB (a quiet room) → 0, -10 dB (loud, close) → 1
    mic.bass = clamp01(f.low * k); mic.mid = clamp01(f.mid * k); mic.treble = clamp01(f.high * k);
    micTick++;
    if (f.onset) { micSeq++; micCall('beat', mic.level); }
    if (f.kick && f.kick.hit) micCall('kick', clamp01(f.kick.level * k));
    if (f.snare && f.snare.hit) micCall('snare', clamp01(f.snare.level * k));
    if (f.hat && f.hat.hit) micCall('hat', clamp01(f.hat.level * k));
    paintMic();
  }
  // `beat`: true in the first p5 frame after a beat, the same answer however often that frame reads it
  function beatNow() {
    var at = typeof g.frameCount === 'number' ? g.frameCount : micTick;
    if (at !== micFrameAt) { micFrameAt = at; micFrameBeat = micSeq !== micSeen; micSeen = micSeq; }
    return micFrameBeat;
  }
  // the names are readers on the page: the first read is the sketch saying it wants the microphone. Not listed (so
  // nothing that lists the page's globals wakes it); a sketch with its own `bass` keeps it, and assigning one later
  // turns the name into a plain variable again.
  function micName(name, read) {
    if (name in g) return;
    try {
      Object.defineProperty(g, name, {
        configurable: true, enumerable: false,
        get: function () { micNeeded(name); return read(); },
        set: function (v) { Object.defineProperty(g, name, { value: v, writable: true, configurable: true, enumerable: true }); },
      });
    } catch (e) { /* a page that sealed its globals */ }
  }
  micName('micLevel', function () { return mic.level; });
  micName('bass', function () { return mic.bass; });
  micName('mid', function () { return mic.mid; });
  micName('treble', function () { return mic.treble; });
  micName('beat', beatNow);
  FUNCS.startMic = function () { return mic.start(); };
  FUNCS.stopMic = function () { return mic.stop(); };
  // first click or key: resume audio a browser held back; start a microphone the sketch asked for but the browser refused
  // without a gesture; start one for a sketch that defines beatDetected() & co. but reads nothing
  function micGesture() {
    if (O.mic === 'off' || micStopped) return;
    if (mic.state === 'on') { try { if (micAudio.ctx.state === 'suspended') micAudio.ctx.resume(); } catch (e) { /* */ } return; }
    // (a sketch that started the drum machine defines kickDetected() & co. for the drums: that alone does not open the microphone)
    var wants = micRead || (O.mic === 'auto' && !drumsWanted && Object.keys(micCbs).some(function (kd) { return typeof g[micCbs[kd]] === 'function'; }));
    if (wants && (mic.state === 'off' || (mic.state === 'denied' && micTries < 3))) startMic();
  }
  if (O.mic !== 'off' && g.addEventListener) ['pointerdown', 'keydown', 'touchend'].forEach(function (t) { g.addEventListener(t, micGesture, { capture: true, passive: true }); });
  var micBtn = null, micMeter = null;
  function paintMic() {
    if (btn && btn.querySelector) {                  // 🎹 grows a small 🎤, underlined green / yellow / red, once the microphone is in play
      var dot = btn.querySelector('#oav-p5-mic-dot');
      if (mic.state !== 'off' && !dot) { dot = el('span', 'font-size:12px;line-height:1;border-bottom:2px solid #8a8a8a', '🎤'); dot.id = 'oav-p5-mic-dot'; btn.appendChild(dot); }
      if (dot) dot.style.borderBottomColor = { on: '#5fe08a', asking: '#e0c25f', denied: '#e06b5f', unavailable: '#8a8a8a', off: '#8a8a8a' }[mic.state];
    }
    if (!micBtn) return;
    micBtn.firstChild.textContent = { on: T.micOff, asking: T.micAsking, denied: T.micDenied, unavailable: T.micNone, off: T.micOn }[mic.state];
    micBtn.title = mic.state === 'denied' ? T.micDeniedHint : '';
    micMeter.style.width = (mic.state === 'on' ? Math.round(mic.level * 100) : 0) + '%';
  }

  // ---------------------------------------------------------------- the rest of OAV, loaded the first time it is needed
  // from next to this file (one URL pins one tree); tests swap midi._import for their own loader
  midi._import = function (url) { return import(url); };
  function load(rel) { return Promise.resolve().then(function () { return midi._import(BASE + rel + '?v=p5-' + OAV_P5_VERSION); }); }
  /** a tiny signal bus in @openav/core's shape (on / define / pulse / set): what @openav/sound and @openav/drums talk to */
  function bus() {
    var subs = {};
    var b = {
      on: function (n, fn) { (subs[n] = subs[n] || []).push(fn); return function () { var a = subs[n], i = a ? a.indexOf(fn) : -1; if (i >= 0) a.splice(i, 1); }; },
      emit: function (n, v) { var a = subs[n]; if (!a) return; a = a.slice(); for (var i = 0; i < a.length; i++) { try { a[i](v); } catch (e) { report(n, e); } } },
      define: function () {}, pulse: function (n, v) { b.emit(n, v); }, set: function (n, v) { b.emit(n, v); },
    };
    return b;
  }
  function callSketch(name, args) { var fn = g[name]; if (typeof fn === 'function') { try { fn.apply(g, args); } catch (e) { report(name, e); } } }
  var raf = typeof g.requestAnimationFrame === 'function' ? function (fn) { g.requestAnimationFrame(fn); } : function (fn) { setTimeout(fn, 16); };

  // ---------------------------------------------------------------- audio out: a browser plays sound only after a click
  // A key on a MIDI keyboard is not a click to a browser. So sound and drums started from setup() wait for the first
  // click or key on the page (the visuals do not wait: drumHit() and the cues run from the start), the way the
  // microphone does; there is no userStartAudio() to write.
  var audioOK = false, audioProbed = false, audioWaiters = [];
  function audioAllowed() {
    if (audioOK) return true;
    try { if (nav.userActivation && nav.userActivation.hasBeenActive) return (audioOK = true); } catch (e) { /* */ }
    if (audioProbed) return false;
    audioProbed = true;                                // ask the browser once; after that the first click decides
    try { if (typeof nav.getAutoplayPolicy === 'function') return (audioOK = nav.getAutoplayPolicy('audiocontext') === 'allowed'); } catch (e) { /* */ }
    try {
      var C = g.AudioContext || g.webkitAudioContext;
      if (C) { var c = new C(); audioOK = c.state === 'running'; if (c.close) c.close().then(null, function () {}); }
    } catch (e) { /* */ }
    return audioOK;
  }
  function whenAudio(fn) { if (audioAllowed()) fn(); else audioWaiters.push(fn); }
  function audioGesture() {
    audioOK = true;
    var w = audioWaiters; audioWaiters = [];
    for (var i = 0; i < w.length; i++) { try { w[i](); } catch (e) { report('audio', e); } }
    try { if (toneMod && sndWanted) toneMod.start(); } catch (e) { /* */ }
    try { var c = kit && kit.context; if (c && c.state === 'suspended') c.resume(); } catch (e) { /* */ }
  }
  if (g.addEventListener) ['pointerdown', 'keydown', 'touchend'].forEach(function (t) { g.addEventListener(t, audioGesture, { capture: true, passive: true }); });

  // ---------------------------------------------------------------- sound: what is played is heard (@openav/sound)
  // Off, and nothing loaded, until the sketch calls startSound() or someone presses 🔊 in the 🎹 panel (or the page says
  // ?oav_sound=piano). Then every note — a keyboard, the 🎹 on screen, a phone, midi.play() — goes through @openav/sound's
  // Sound shell to its toneEngine (Tone.js 15 from jsDelivr), the road a show's notes take. Notes on channel 10 (pads:
  // MiniLab 3, LPD8, the General MIDI drum channel) play @openav/drums' kit instead: a pad is a drum, never a piano note.
  var sndBus = bus(), sndOn = false, sndWanted = false, sndTarget = null, sndShellP = null, toneMod = null, sndSaid = false, sndPct = null;
  var snd = {
    state: 'off',                                   // off · waiting (for a click) · loading (Tone.js) · on · error
    instrument: null, error: null, shell: null, engine: null, module: null,
    /** startSound('organ') while it plays switches the instrument (a sampler keeps the old one sounding until it is in) */
    start: function (id) { return startSound(id); }, stop: function () { return stopSound(); },
    /** { id, state: 'idle' | 'loading' | 'ready' | 'error', progress 0..1 } of the instrument */
    get status() { return snd.shell ? snd.shell.status : { id: sndTarget, state: 'idle', progress: 0, error: null }; },
    _bus: sndBus,
  };
  midi.sound = snd;
  function setSound(s) {
    if (snd.state === s) { paintSound(); return; }
    snd.state = s; put('soundIsOn', s === 'on'); paintSound();
    if (s === 'waiting' && !sndSaid && g.console) { sndSaid = true; console.info('[oav-p5] sound: ' + T.sndHint); }
  }
  function soundNote(on, note, v, ch) {
    if (ch === 10) { if (on) padDrum(note, v); return; }
    sndBus.emit(on ? 'midi/note/on' : 'midi/note/off', { note: note, vel: v, ch: ch });
  }
  // a sampler (the piano: 2 MB) starts on its fallback (the electric piano), so the first key is never silent
  function firstOf(m, id) { var d = m.getInstrument(id); return d && d.fallback && m.getInstrument(d.fallback) ? d.fallback : id; }
  function soundShell() {
    if (sndShellP) return sndShellP;
    sndShellP = load('packages/sound/index.js').then(function (m) {
      snd.module = m;
      var tone = O.tone || m.TONE_CDN;
      // Tone.js comes now, before the click, so the click itself can start its AudioContext (Safari wants that)
      Promise.resolve().then(function () { return midi._import(tone); }).then(function (t) { toneMod = (t && t.default) || t; }, function () { /* enable() says it */ });
      var engine = m.toneEngine({ cdn: tone, instrument: firstOf(m, sndTarget), baseUrl: BASE + 'packages/sound/samples/' });
      var shell = new m.Sound({ signals: sndBus, engine: engine, remember: false, picker: false });
      shell.onChange(function (ev) {
        if (ev.type === 'instrument') snd.instrument = ev.id;
        sndPct = ev.type === 'loading' ? Math.round((ev.progress || 0) * 100) : null;
        if (ev.type === 'loading' && !ev.progress && g.console) console.info('[oav-p5] loading ' + ev.id + '…');
        if (ev.type === 'error' && g.console) console.info('[oav-p5] ' + ev.id + ' did not load' + (ev.fallback ? ': playing ' + ev.fallback + ' instead' : ''));
        paintSound();
      });
      snd.shell = shell; snd.engine = engine; snd.instrument = engine.instrument;
      return shell;
    }).then(null, function (e) {
      sndShellP = null; snd.error = (e && e.message) || String(e); setSound('error');
      if (g.console) console.info('[oav-p5] @openav/sound did not load (' + snd.error + ')');
      return null;
    });
    return sndShellP;
  }
  function chooseInstrument(m, shell, id) {
    if (!m.getInstrument(id)) {
      if (g.console) console.info('[oav-p5] no instrument "' + id + '": ' + m.listInstruments().map(function (d) { return d.id; }).join(', '));
      return;
    }
    sndTarget = id;
    shell.setInstrument(shell.enabled ? id : firstOf(m, id));   // before the click: remembered; the sampler follows once Tone is in
  }
  function enableSound() {
    var shell = snd.shell;
    if (!shell || !sndWanted) return Promise.resolve(false);
    if (shell.enabled) { sndOn = true; setSound('on'); return Promise.resolve(true); }
    try { if (toneMod) toneMod.start(); } catch (e) { /* */ }      // inside the click, before anything async
    setSound('loading');
    return shell.enable().then(function () {
      if (!sndWanted) return false;                                // stopSound() came first
      sndOn = true; setSound('on');
      if (sndTarget && shell.instrument !== sndTarget) shell.setInstrument(sndTarget);
      if (g.console) console.info('[oav-p5] sound on (' + sndTarget + '): every key, pad, the 🎹 and a phone are heard');
      return true;
    }, function (e) {
      snd.error = (e && e.message) || String(e); setSound('error');
      if (g.console) console.info('[oav-p5] sound did not start (' + snd.error + '): Tone.js comes from ' + (O.tone || 'cdn.jsdelivr.net'));
      return false;
    });
  }
  function startSound(id) {
    if (O.sound === 'off') return Promise.resolve(false);   // the option is a promise to the page
    sndWanted = true;
    if (typeof id !== 'string' || !id) id = null;
    sndTarget = id || sndTarget || 'piano';
    if (snd.state === 'off' || snd.state === 'error') setSound(snd.shell ? 'waiting' : 'loading');
    ensureKit().then(null, function () {});                         // the pads' drum kit, so the first pad hit is not late
    return soundShell().then(function (shell) {
      if (!shell || !sndWanted) return false;
      chooseInstrument(snd.module, shell, sndTarget);
      if (shell.enabled) { sndOn = true; setSound('on'); return true; }
      if (snd.state !== 'loading' || !audioAllowed()) setSound('waiting');
      return new Promise(function (ok) { whenAudio(function () { enableSound().then(ok); }); });
    });
  }
  function stopSound() {
    sndWanted = false; sndOn = false;
    try { if (snd.engine && snd.engine.releaseAll) snd.engine.releaseAll(); } catch (e) { /* */ }
    setSound('off');
    return Promise.resolve(false);
  }
  FUNCS.startSound = function (id) { return snd.start(id); };
  FUNCS.stopSound = function () { return snd.stop(); };

  // ---------------------------------------------------------------- drums: a 16-step machine that is also the clock
  // startDrums() puts @openav/drums' grid on screen and plays it with its synthesized kit. Each hit reaches the sketch the way
  // the microphone's hits do — kickDetected / snareDetected (snare and clap) / hatDetected, beatDetected on a kick or
  // snare — so a sketch written for the microphone moves to the machine unchanged, plus drumHit(lane, velocity) for all
  // four lanes. The machine is also the timeline: drumStep, drumBar, stepStarted(), barStarted(), and cue(bar, name).
  var DRUM_CB = { kick: 'kickDetected', snare: 'snareDetected', clap: 'snareDetected', hat: 'hatDetected' };
  var drumSubs = { hit: [], step: [], bar: [], cue: [] };
  var drumBus = bus(), drumsMod = null, drumsModP = null, kit = null, kitStarted = false, machineP = null, drumsWanted = false;
  var drumBeatAt = -1, drumLoop = false, drumCard = null, drumBtn = null;
  var cues = [];
  var drums = {
    state: 'off',                                   // off · loading · on · stopped (grid up, not playing) · error
    step: 0, bar: 0, count: -1, bpm: 112, pattern: 'four on floor', lastCue: '', cues: cues, machine: null,
    start: function (pattern, bpm) { return startDrums(pattern, bpm); }, stop: function () { return stopDrums(); },
    cue: function (bar, name, every) { return addCue(bar, name, every); },
    /** drums.on('hit' | 'step' | 'bar' | 'cue', fn) → off(): what the callbacks hear, for Hydra and libraries */
    on: function (name, fn) {
      if (!drumSubs[name]) throw new Error('[oav-p5] unknown drums event "' + name + '" (' + Object.keys(drumSubs).join(', ') + ')');
      drumSubs[name].push(fn);
      return function () { var i = drumSubs[name].indexOf(fn); if (i >= 0) drumSubs[name].splice(i, 1); };
    },
    _step: function (i, n) { drumStepped(i, n); }, _hit: function (lane, v) { drumHitIn(lane, v); },   // for tests
  };
  midi.drums = drums;
  function drumEmit(kind, cb, args) {
    callSketch(cb, args);
    var list = drumSubs[kind].slice();
    for (var i = 0; i < list.length; i++) { try { list[i].apply(g, args); } catch (e) { report(cb, e); } }
  }
  function drumStepped(i, n) {
    var bar = Math.floor(n / 16) + 1;
    drums.step = i; drums.bar = bar; drums.count = n;
    put('drumStep', i); put('drumBar', bar);
    for (var k = 0; k < cues.length; k++) {
      var c = cues[k];
      if (n === c.at || (c.period > 0 && n > c.at && (n - c.at) % c.period === 0)) {
        drums.lastCue = c.name; put('cueName', c.name);
        drumEmit('cue', 'cueFired', [c.name, bar]);
      }
    }
    if (i === 0) drumEmit('bar', 'barStarted', [bar]);
    drumEmit('step', 'stepStarted', [i, bar]);
  }
  function drumHitIn(lane, v) {
    drumEmit('hit', 'drumHit', [lane, v]);
    if (DRUM_CB[lane]) callSketch(DRUM_CB[lane], [v]);
    if (lane !== 'hat' && drums.count !== drumBeatAt) { drumBeatAt = drums.count; micSeq++; callSketch('beatDetected', [v]); }   // one beat per step
  }
  /** cue(bar, name, every): at bar `bar` (1 = the first; 4.5 = halfway through bar 4) cueFired(name, bar) is called and
   *  cueName becomes name; with `every`, again every that many bars. Calling it again with the same values adds nothing. */
  function addCue(bar, name, every) {
    bar = +bar; every = every == null ? 0 : +every;
    if (!(bar >= 1) || !isFinite(bar)) { if (g.console) console.warn('[oav-p5] cue(bar, name): bar 1 is the first bar (got ' + bar + ')'); return null; }
    var at = Math.round((bar - 1) * 16), period = every > 0 && isFinite(every) ? Math.max(1, Math.round(every * 16)) : 0;
    var key = at + '|' + period + '|' + String(name);
    for (var i = 0; i < cues.length; i++) if (cues[i].key === key) return cues[i];
    var c = { bar: bar, name: name, every: period ? every : 0, at: at, period: period, key: key };
    cues.push(c);
    return c;
  }
  function setDrums(s) {
    if (drums.state !== s) { drums.state = s; put('drumsAreOn', s === 'on'); }
    if (drumBtn) drumBtn.textContent = s === 'on' || s === 'stopped' ? T.drumsOff : T.drumsOn;
  }
  function ensureDrumsModule() {
    if (!drumsModP) drumsModP = load('packages/drums/index.js').then(function (m) { drumsMod = m; return m; }, function (e) { drumsModP = null; throw e; });
    return drumsModP;
  }
  function ensureKit() { return ensureDrumsModule().then(function (m) { if (!kit) kit = m.drumEngine(); return kit; }); }
  function kitEnable() {
    if (!kit || kitStarted || !audioAllowed()) return;
    kitStarted = true;                                // its AudioContext is made here, inside the click when there was one
    kit.enable().then(null, function (e) { kitStarted = false; report('the drum kit', e); });
  }
  function padDrum(note, v) {
    if (kit && kitStarted) { kit.noteOn(note, v); return; }
    ensureKit().then(function (k) { kitEnable(); if (sndOn) k.noteOn(note, v); }, function () { /* */ });
  }
  function ensureMachine() {
    if (machineP) return machineP;
    if (!doc || !doc.body) return Promise.resolve(null);
    setDrums('loading');
    machineP = ensureKit().then(function (k) {
      buildDrumCard();
      var host = drumCard.firstChild;
      var m = drumsMod.mountDrums(host, { signals: drumBus, engine: k, autoEnableEngine: false, onStep: drumStepped, bpm: drums.bpm, pattern: drums.pattern });
      ['kick', 'snare', 'hat', 'clap'].forEach(function (lane) { drumBus.on('drum/' + lane, function (p) { drumHitIn(lane, p && p.level != null ? p.level : 0.8); }); });
      drums.machine = m;
      return m;
    }).then(null, function (e) {
      machineP = null; setDrums('error');
      if (g.console) console.info('[oav-p5] @openav/drums did not load (' + ((e && e.message) || e) + ')');
      return null;
    });
    return machineP;
  }
  function startDrums(pattern, bpm) {
    if (typeof pattern === 'number' && bpm == null) { bpm = pattern; pattern = null; }
    if (pattern != null) drums.pattern = pattern;
    if (bpm != null && +bpm > 0) drums.bpm = Math.max(30, Math.min(300, +bpm));
    drumsWanted = true;
    return ensureMachine().then(function (m) {
      if (!m || !drumsWanted) return false;
      if (pattern != null) {
        if (typeof pattern === 'string' && !drumsMod.PATTERNS[pattern] && g.console) console.info('[oav-p5] no pattern "' + pattern + '": ' + Object.keys(drumsMod.PATTERNS).join(', ') + ', or your own { kick: \'x...x...x...x...\', snare, hat, clap }');
        m.setPattern(pattern);
      }
      m.setBpm(drums.bpm);
      showDrums(true);
      if (!m.seq.playing) m.play(true);
      whenAudio(kitEnable);
      syncDrums(); runDrums();
      return true;
    });
  }
  function stopDrums() {
    drumsWanted = false;
    if (drums.machine) drums.machine.play(false);
    showDrums(false);
    setDrums('off');
    return Promise.resolve(false);
  }
  function syncDrums() {
    var m = drums.machine;
    if (!m) return;
    if (drums.state !== 'off') setDrums(m.seq.playing ? 'on' : 'stopped');   // the grid's own checkbox counts too
    drums.bpm = m.seq.bpm; drums.pattern = m.seq.pattern; put('drumBpm', drums.bpm);
  }
  function runDrums() {
    if (drumLoop) return;
    drumLoop = true;
    var last = clock();
    (function tick() {
      var m = drums.machine;
      if (!m || drums.state === 'off') { drumLoop = false; return; }
      var now = clock(), dt = Math.min(0.1, Math.max(0, (now - last) / 1000));   // a hidden tab skips ahead instead of bursting
      last = now;
      try { m.update(dt); } catch (e) { report('drums', e); }
      syncDrums();
      raf(tick);
    })();
  }
  FUNCS.startDrums = function (pattern, bpm) { return drums.start(pattern, bpm); };
  FUNCS.stopDrums = function () { return drums.stop(); };
  FUNCS.cue = function (bar, name, every) { drums.cue(bar, name, every); };

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
  // one click handler on the window (capture), not on the button: a host page that re-renders its <body> after this file
  // ran leaves a copy of the 🎹 with no listeners; the id still finds it
  function onClick(e) {
    var b = e.target && e.target.closest && e.target.closest('#oav-p5-button');
    if (DEBUG && e.type === 'pointerdown') { var top = doc.elementFromPoint(e.clientX, e.clientY); dbg('pointerdown', Math.round(e.clientX), Math.round(e.clientY), 'target', e.target.tagName + '#' + e.target.id, 'top', top && (top.tagName + '#' + top.id), 'button is ours', doc.getElementById('oav-p5-button') === btn); }
    if (!b || e.type !== 'click') return;
    if (b !== btn) { dbg('the page replaced the 🎹: re-adopting the copy'); btn = b; fence(btn); paintButton(); }
    e.stopPropagation(); openPanel(); try { btn.blur(); } catch (x) { /* */ }
  }
  function placeButton() {
    if (O.panel === 'off' || btn || !doc || !doc.body) return;
    g.addEventListener('click', onClick, true);
    if (DEBUG) g.addEventListener('pointerdown', onClick, true);
    btn = el('button', 'position:fixed;' + O.corner + ':10px;' + O.dock + ':10px;z-index:' + Z + ';display:flex;align-items:center;gap:6px;padding:6px 10px;' +
      'border-radius:999px;border:1px solid rgba(255,255,255,.3);background:rgba(18,18,22,.78);color:#fff;font:600 13px system-ui,sans-serif;' +
      'cursor:pointer;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)');
    btn.type = 'button'; btn.id = 'oav-p5-button';
    btn.appendChild(el('span', 'width:7px;height:7px;border-radius:50%;background:#8a8a8a;display:inline-block'));
    btn.appendChild(el('span', '', '🎹'));
    fence(btn);
    doc.body.appendChild(btn);
    paintButton();
    if (O.panel === 'open') openPanel(true);
    // say once, in the console, what the controller is wired to (OPC variables are declared by now)
    var hint = function () { setTimeout(function () { var s = wiringText(); if (s && g.console) console.info('[oav-p5] ' + s); }, 0); };
    if (doc.readyState === 'complete') hint(); else g.addEventListener('load', hint);
    if (DEBUG) setTimeout(function () { dbg('2 s after placing: the 🎹 in the page is ours:', doc.getElementById('oav-p5-button') === btn, '| base', BASE); }, 2000);
  }
  function lift() {
    var h = panelOpen && dock ? dock.getBoundingClientRect().height : 0;
    if (btn) btn.style[O.dock] = (10 + h) + 'px';
    if (drumCard) drumCard.style.top = O.dock === 'top' && h ? (10 + h) + 'px' : '';   // below a panel docked at the top (OpenProcessing)
  }
  function openPanel(want) {
    if (!doc || O.panel === 'off') return Promise.resolve(null);
    var on = want == null ? !panelOpen : !!want;
    if (!on) { panelOpen = false; if (dock) dock.style.display = 'none'; lift(); return Promise.resolve(null); }
    if (O.hardware === 'click' && midi.hardware === 'off') connectHardware();
    if (!loading) loading = buildDock();
    // show the panel at once (the controller itself can take seconds to arrive the first time), so a click is never silent
    panelOpen = true; dock.style.display = 'block'; lift(); dbg('panel open; controller', view ? 'ready' : 'loading');
    return loading.then(function (d) { if (panelOpen) { d.style.display = 'block'; if (legend) legend.textContent = wiringText(); lift(); } return d; });
  }
  // ---- the drum machine's card: top centre, between the 🎹 (top-left on OpenProcessing) and OPC's icon (top-right),
  // clear of OpenProcessing's console at the bottom; – folds the grid away, × stops the machine
  function buildDrumCard() {
    if (drumCard) return drumCard;
    var st = el('style');
    st.textContent = '#oav-p5-drums{position:fixed;top:10px;left:50%;transform:translateX(-50%);width:min(520px,calc(100vw - 190px));min-width:250px;' +
      'box-sizing:border-box;z-index:' + (Z - 2) + ';padding:6px 10px 8px;border-radius:12px;background:rgba(14,14,18,.88);border:1px solid rgba(255,255,255,.18);' +
      'backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}#oav-p5-drums .oav-drums .bar{padding-right:52px;margin-bottom:5px}' +
      '#oav-p5-drums .oav-drums .lane-lbl{color:#9aa3b8}#oav-p5-drums .oav-drums{color:#cfd6e4}' +
      '@media (max-width:600px){#oav-p5-drums{top:52px;width:calc(100vw - 20px);min-width:0}}';
    doc.head.appendChild(st);
    drumCard = el('div'); drumCard.id = 'oav-p5-drums';
    fence(drumCard);
    drumCard.appendChild(el('div'));                   // mountDrums goes here
    var tools = el('div', 'position:absolute;top:5px;right:6px;display:flex;gap:4px');
    var b = 'width:22px;height:22px;padding:0;border-radius:6px;border:1px solid rgba(255,255,255,.3);background:none;color:#fff;cursor:pointer;font:600 13px/1 system-ui,sans-serif';
    var fold = el('button', b, '–'); fold.type = 'button'; fold.title = T.fold;
    fold.addEventListener('click', function () {
      var gr = drumCard.querySelector('.grid'); if (!gr) return;
      var hide = gr.style.display !== 'none'; gr.style.display = hide ? 'none' : ''; fold.textContent = hide ? '+' : '–';
    });
    var x = el('button', b, '×'); x.type = 'button'; x.title = T.closeDrums;
    x.addEventListener('click', function () { stopDrums(); });
    tools.appendChild(fold); tools.appendChild(x);
    drumCard.appendChild(tools);
    doc.body.appendChild(drumCard);
    lift();
    return drumCard;
  }
  function showDrums(on) { if (drumCard) drumCard.style.display = on ? '' : 'none'; }

  // ---- 🔊: the button in the panel, the instrument picker under it, and a 🔊 on the 🎹 (with the piano's loading %)
  var sndBtn = null, sndRow = null, sndPicker = null;
  function paintSound() {
    if (btn && btn.querySelector) {
      var dot = btn.querySelector('#oav-p5-sound-dot');
      if (snd.state !== 'off' && !dot) { dot = el('span', 'font-size:12px;line-height:1;border-bottom:2px solid #8a8a8a;white-space:nowrap'); dot.id = 'oav-p5-sound-dot'; btn.appendChild(dot); }
      if (dot) {
        dot.style.display = snd.state === 'off' ? 'none' : '';
        dot.style.borderBottomColor = { on: '#5fe08a', waiting: '#e0c25f', loading: '#e0c25f', error: '#e06b5f', off: '#8a8a8a' }[snd.state];
        dot.textContent = '🔊' + (sndPct != null && snd.state !== 'off' ? ' ' + sndPct + '%' : '');
        dot.title = snd.state === 'waiting' ? T.sndHint : '';
      }
    }
    if (!sndBtn) return;
    sndBtn.textContent = { on: T.sndOff, waiting: T.sndWaiting, loading: T.sndLoading, error: T.sndError, off: T.sndOn }[snd.state];
    sndBtn.title = snd.state === 'waiting' ? T.sndHint : '';
    var show = snd.state !== 'off' && !!snd.shell;
    sndRow.style.display = show ? 'block' : 'none';
    if (show && !sndPicker && snd.module && snd.module.mountSoundPicker) {
      var css = el('style', '', '#oav-p5-sound .oav-sound-pick{display:flex;flex-wrap:wrap;align-items:center;gap:4px 12px;font:500 12px system-ui,sans-serif;color:#ccc}' +
        '#oav-p5-sound .oav-sound-pick-row{display:flex;gap:6px;align-items:center}#oav-p5-sound select{background:#1a2030;color:#e6e9f0;border:1px solid rgba(255,255,255,.3);border-radius:6px;font:inherit;padding:2px 4px;max-width:60vw}' +
        '#oav-p5-sound .oav-sound-pick-status{display:flex;gap:6px;align-items:center;color:#e0c25f}#oav-p5-sound .oav-sound-pick-meter{display:inline-block;width:80px;height:4px;background:rgba(255,255,255,.15);border-radius:2px;overflow:hidden}' +
        '#oav-p5-sound .oav-sound-pick-meter i{display:block;height:100%;background:#e0c25f}#oav-p5-sound .oav-sound-pick-credit{color:#8a8f9c;font-size:11px}#oav-p5-sound a{color:#9fd8ff}#oav-p5-sound [hidden]{display:none!important}');
      sndRow.appendChild(css);
      try {
        sndPicker = snd.module.mountSoundPicker(sndRow, snd.shell, { lang: zh ? 'zh' : 'en', enableOnPick: false });
        // picking is a click: it also turns sound on (and is the click the browser wanted)
        sndPicker.select.addEventListener('change', function () { startSound(sndPicker.select.value); });
      } catch (e) { report('the instrument picker', e); }
    }
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
    micBtn = el('button', 'position:relative;overflow:hidden;padding:4px 10px;border-radius:8px;border:1px solid rgba(255,255,255,.3);background:none;color:#fff;cursor:pointer;font:inherit;max-width:46vw');
    micBtn.id = 'oav-p5-mic'; micBtn.type = 'button';
    micBtn.appendChild(el('span', 'position:relative;white-space:nowrap'));
    micMeter = el('span', 'position:absolute;left:0;bottom:0;height:3px;width:0;background:#5fe08a');
    micBtn.appendChild(micMeter);
    micBtn.addEventListener('click', function () { if (mic.state === 'on') mic.stop(); else mic.start(); });
    paintMic();
    var small = 'padding:4px 10px;border-radius:8px;border:1px solid rgba(255,255,255,.3);background:none;color:#fff;cursor:pointer;font:inherit;white-space:nowrap';
    sndBtn = el('button', small); sndBtn.id = 'oav-p5-sound-button'; sndBtn.type = 'button';
    sndBtn.addEventListener('click', function () { if (snd.state === 'on' || snd.state === 'loading') stopSound(); else startSound(); });
    if (O.sound === 'off') sndBtn.style.display = 'none';
    drumBtn = el('button', small); drumBtn.id = 'oav-p5-drums-button'; drumBtn.type = 'button';
    drumBtn.addEventListener('click', function () { if (drums.state === 'on' || drums.state === 'stopped' || drums.state === 'loading') stopDrums(); else startDrums(); });
    setDrums(drums.state);
    bar.appendChild(legend); bar.appendChild(micBtn); bar.appendChild(sndBtn); bar.appendChild(drumBtn); bar.appendChild(ph); bar.appendChild(cl);
    dock.appendChild(bar);
    sndRow = el('div', 'display:none;margin:0 0 6px'); sndRow.id = 'oav-p5-sound';
    dock.appendChild(sndRow);
    paintSound();
    var wait = el('div', 'padding:18px;text-align:center;color:#aaa;font:500 13px system-ui,sans-serif', T.loading);
    dock.appendChild(wait);
    doc.body.appendChild(dock);
    return import(BASE + 'packages/midi/element.js?v=p5-' + OAV_P5_VERSION).then(function () {
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
      if (wait.parentNode) wait.parentNode.removeChild(wait);
      dock.appendChild(view);
      if (typeof ResizeObserver === 'function') new ResizeObserver(lift).observe(dock);
      return dock;
    }, function (e) {
      if (wait.parentNode) wait.parentNode.removeChild(wait);
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
      import(BASE + 'packages/relay/index.js?v=p5-' + OAV_P5_VERSION).then(function (m) {
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
  // ?oav_sound=piano (OpenProcessing: ?sketch_oav_sound=piano): any sketch is heard, from the first click, with no code
  if (O.sound !== 'click' && O.sound !== 'off') startSound(O.sound === 'on' || O.sound === 'auto' ? null : O.sound);
})();
