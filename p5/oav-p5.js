/* oav-p5.js — Open Audio Visual for p5.js sketches. One line at the top of a sketch and it plays from MIDI.
 *
 *   document.head.append(Object.assign(document.createElement('script'), { src: 'https://openaudiovisual.com/p5/oav-p5.js' }))
 *
 * (or paste the same URL into OpenProcessing → Sketch → Libraries → Add Custom Library). Works in p5 1.x and 2.x
 * global mode; no import, nothing to call in setup().
 *
 * Three inputs, one stream of MIDI bytes, so a sketch never knows which one played:
 *   hardware  a real controller over Web MIDI (Chrome, Edge, Firefox; Safari and iPad have no Web MIDI)
 *   screen    the on-screen controller: 🎹 bottom-right opens @openav/midi's <oav-controller> (MiniLab 3 by default)
 *   phone     📱 in that panel: a QR code to the OAV remote page; the phone's MIDI tab plays this sketch over the relay
 *
 * What the sketch gets:
 *   midi.note[60]   velocity 0..1 while key 60 is held, 0 once released       midi.held   notes held now, low → high
 *   midi.cc[74]     the last value of CC 74, 0..1                              midi.bend   pitch bend −1..1
 *   midi.last       the last message { type, note | cc, value, channel, source }
 *   function noteOn(note, velocity, channel) {}       define any of these four and they are called (velocity 0..1)
 *   function noteOff(note, channel) {}
 *   function controlChange(cc, value, channel) {}    value 0..1
 *   function midiMessage(bytes, source) {}            every message, raw; source = 'hardware' | 'screen' | 'phone'
 *   midi.on('noteOn', fn) → off()                     the same, for instance mode or several listeners
 *   midi.panel.open() / close() / toggle()            midi.phone() opens the QR card
 * A sketch that already uses Web MIDI itself (navigator.requestMIDIAccess, WebMidi.js) also hears the screen and the
 * phone: they appear as one more input port, "OAV Virtual MIDI", after the real ones (@openav/midi virtual-access.js).
 *
 * Why one async line is enough: p5 1.x and 2.x start global mode on window `load`, and a script inserted while the page
 * is still loading holds `load` back until it has run, so this file is in place before setup(). A page that runs the
 * sketch after `load` gets it a moment later: callbacks still fire (they are looked up when a message arrives), but code
 * that reads `midi` in the first frames would throw — the Custom Library route has no such gap.
 *
 * Options (any of: window.OAV_P5 = {…} before this line, ?key=value on this script's URL, ?oav_key=value on the page —
 * OpenProcessing passes its page's ?sketch_oav_key=value through to the sketch):
 *   hardware  auto (ask for Web MIDI at once; the browser remembers the answer) | click (ask from the 🎹 panel) | off
 *   panel     closed (just the 🎹 button) | open | off (no on-screen UI at all)
 *   profile   arturia-minilab3 | akai-lpd8 | any @openav/midi profile id
 *   shim      on | off — the virtual port for sketches that call requestMIDIAccess themselves
 *   relay     wss://remote.cheyuwu.com/relay (the OAV public relay)   room   a name; default one per browser
 *   telemetry off | on — @openav/midi's one anonymous page-load hit (README "Telemetry"); off here unless asked
 */
(function () {
  'use strict';
  var g = typeof window !== 'undefined' ? window : globalThis;
  var VERSION = '0.1.0';
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
    shim: opt('shim', 'on'), relay: opt('relay', 'wss://remote.cheyuwu.com/relay'), room: opt('room', ''),
    telemetry: opt('telemetry', 'off'), remote: opt('remote', 'https://openaudiovisual.com/packages/remote/'),
  };
  var zh = /^zh/i.test((g.navigator && g.navigator.language) || '');
  var T = zh
    ? { btn: 'MIDI：接鍵盤、按螢幕上的控制器，或用手機彈', phone: '📱 手機', close: '收起', hwOff: '沒接 MIDI 裝置', hwAsk: '連接 MIDI',
        hwNone: '這個瀏覽器沒有 Web MIDI（Safari）：用螢幕上的控制器或手機', hwDenied: 'MIDI 權限被擋下了：網址列左邊可以重新允許',
        scan: '用手機掃描，打開 MIDI 分頁就能彈這個作品', room: '房間' }
    : { btn: 'MIDI: plug in a controller, play the one on screen, or use a phone', phone: '📱 Phone', close: 'Hide', hwOff: 'No MIDI device',
        hwAsk: 'Connect MIDI', hwNone: 'No Web MIDI in this browser (Safari): use the on-screen controller or a phone',
        hwDenied: 'MIDI permission is blocked: allow it again from the address bar', scan: 'Scan with a phone, open the MIDI tab and play this sketch', room: 'Room' };

  // ---------------------------------------------------------------- state the sketch reads
  function zeros() { var a = new Array(128); for (var i = 0; i < 128; i++) a[i] = 0; return a; }
  var subs = { noteOn: [], noteOff: [], controlChange: [], pitchBend: [], midiMessage: [] };
  var midi = {
    version: VERSION, note: zeros(), cc: zeros(), bend: 0, held: [], last: null,
    hardware: 'off', devices: [], options: O,
    /** subscribe: 'noteOn' | 'noteOff' | 'controlChange' | 'pitchBend' | 'midiMessage' → returns off() */
    on: function (name, fn) {
      var k = String(name).replace(/^note(on|off)$/i, function (m, s) { return 'note' + (s.toLowerCase() === 'on' ? 'On' : 'Off'); });
      if (!subs[k]) throw new Error('[oav-p5] unknown event "' + name + '" (noteOn, noteOff, controlChange, pitchBend, midiMessage)');
      subs[k].push(fn);
      return function () { var i = subs[k].indexOf(fn); if (i >= 0) subs[k].splice(i, 1); };
    },
    /** play as if a controller did: midi.play(60, 0.8) … midi.play(60, 0) releases; source 'screen' */
    play: function (note, velocity) { var v = Math.max(0, Math.min(127, Math.round((velocity == null ? 1 : velocity) * 127))); input([v > 0 ? 0x90 : 0x80, note & 127, v], 'screen'); },
    /** feed raw bytes from anywhere (a WebSocket, a test): one message [status, d1, d2] */
    input: function (bytes, source) { input(bytes, source || 'screen'); },
    connectHardware: function () { return connectHardware(); },
    panel: { open: function () { return openPanel(true); }, close: function () { return openPanel(false); }, toggle: function () { return openPanel(); } },
    phone: function () { return openPhone(); },
  };

  // ---------------------------------------------------------------- one parser for every source
  var CALLBACKS = { noteOn: 1, noteOff: 1, controlChange: 1, pitchBend: 1, midiMessage: 1 };
  function call(name, args) {
    var fn = g[name];
    if (typeof fn === 'function' && CALLBACKS[name]) {
      try { fn.apply(g, args); } catch (e) { report(name, e); }
    }
    var list = subs[name].slice();
    for (var i = 0; i < list.length; i++) { try { list[i].apply(g, args); } catch (e) { report(name, e); } }
  }
  // the sketch's own error: show it like p5 would (the console, with its stack), keep the MIDI loop alive
  function report(name, e) { if (g.console) console.error('[oav-p5] error inside ' + name + '():', e); }

  var virtualPort = null;                              // the shim's virtual input, once a sketch asked for Web MIDI
  function input(data, source) {
    if (!data || data.length < 1) return;
    var b0 = data[0] | 0, b1 = (data[1] | 0) & 127, b2 = (data[2] | 0) & 127;
    if (b0 < 0x80 || b0 >= 0xF0) return;               // clock (0xF8 ×24 per beat), sysex, running status: not for sketches
    var type = b0 & 0xF0, ch = (b0 & 0x0F) + 1, bytes = [b0, b1, b2];
    if (source !== 'hardware' && virtualPort) virtualPort.emit(bytes);   // hardware already reaches the sketch's own Web MIDI code directly
    if (source !== 'screen' && view && view.ingest) { try { view.ingest(bytes); } catch (e) { /* the faceplate follows; never block a note on it */ } }
    if (type === 0x90 && b2 > 0) {
      var v = b2 / 127;
      midi.note[b1] = v;
      if (midi.held.indexOf(b1) < 0) { midi.held.push(b1); midi.held.sort(function (a, b) { return a - b; }); }
      midi.last = { type: 'noteOn', note: b1, value: v, channel: ch, source: source };
      call('midiMessage', [bytes, source]); call('noteOn', [b1, v, ch]);
    } else if (type === 0x80 || type === 0x90) {
      midi.note[b1] = 0;
      var i = midi.held.indexOf(b1); if (i >= 0) midi.held.splice(i, 1);
      midi.last = { type: 'noteOff', note: b1, value: 0, channel: ch, source: source };
      call('midiMessage', [bytes, source]); call('noteOff', [b1, ch]);
    } else if (type === 0xB0) {
      var c = b2 / 127;
      midi.cc[b1] = c;
      midi.last = { type: 'controlChange', cc: b1, value: c, channel: ch, source: source };
      call('midiMessage', [bytes, source]); call('controlChange', [b1, c, ch]);
    } else if (type === 0xE0) {
      var raw = (b2 << 7) | b1;
      midi.bend = raw >= 8192 ? (raw - 8192) / 8191 : (raw - 8192) / 8192;
      midi.last = { type: 'pitchBend', value: midi.bend, channel: ch, source: source };
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
  function onPortMessage(e) { input(e.data, 'hardware'); }
  function wire() {
    var names = [];
    access.inputs.forEach(function (inp) {
      if (inp.state === 'disconnected') return;
      names.push(inp.name || 'MIDI');
      if (wired && wired.has(inp)) return;
      if (wired) wired.add(inp);
      // addEventListener, not onmidimessage: the sketch's own Web MIDI code may hold the same port object
      try { inp.addEventListener('midimessage', onPortMessage); if (inp.open) inp.open().catch(function () {}); } catch (e) { /* */ }
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
  var doc = g.document, btn = null, dock = null, view = null, panelOpen = false, loading = null;
  var Z = 2147483000;
  function el(tag, css, text) { var e = doc.createElement(tag); if (css) e.style.cssText = css; if (text != null) e.textContent = text; return e; }
  // a press on the panel is not a press on the sketch (p5 listens on window)
  function fence(e) { ['mousedown', 'mouseup', 'click', 'touchstart', 'touchend', 'pointerdown', 'pointerup', 'wheel', 'keydown', 'keyup'].forEach(function (t) { e.addEventListener(t, function (ev) { ev.stopPropagation(); }); }); }
  function paintButton() {
    if (!btn) return;
    var dot = { connected: '#5fe08a', waiting: '#e0c25f', asking: '#e0c25f', denied: '#e06b5f', unavailable: '#8a8a8a', off: '#8a8a8a' }[midi.hardware] || '#8a8a8a';
    btn.firstChild.style.background = dot;
    var hint = midi.hardware === 'connected' ? midi.devices.join(', ') : midi.hardware === 'unavailable' ? T.hwNone : midi.hardware === 'denied' ? T.hwDenied : T.hwOff;
    btn.title = T.btn + '\n' + hint;
  }
  function placeButton() {
    if (O.panel === 'off' || btn || !doc || !doc.body) return;
    btn = el('button', 'position:fixed;right:10px;bottom:10px;z-index:' + Z + ';display:flex;align-items:center;gap:6px;padding:6px 10px;' +
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
  }
  function lift() { if (btn) btn.style.bottom = (10 + (panelOpen && dock ? dock.getBoundingClientRect().height : 0)) + 'px'; }
  function openPanel(want) {
    if (!doc || O.panel === 'off') return Promise.resolve(null);
    var on = want == null ? !panelOpen : !!want;
    if (!on) { panelOpen = false; if (dock) dock.style.display = 'none'; lift(); return Promise.resolve(null); }
    if (O.hardware === 'click' && midi.hardware === 'off') connectHardware();
    if (!loading) loading = buildDock();
    return loading.then(function (d) { panelOpen = true; d.style.display = 'block'; lift(); return d; });
  }
  function buildDock() {
    dock = el('div', 'position:fixed;left:0;right:0;bottom:0;z-index:' + (Z - 1) + ';max-height:50vh;overflow:auto;display:none;' +
      'background:rgba(14,14,18,.92);border-top:1px solid rgba(255,255,255,.18);padding:6px 10px 10px;box-sizing:border-box;' +
      'backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)');
    dock.id = 'oav-p5-panel';
    fence(dock);
    var bar = el('div', 'display:flex;gap:8px;align-items:center;justify-content:flex-end;margin-bottom:4px;font:600 12px system-ui,sans-serif;color:#ddd');
    var ph = el('button', 'padding:4px 10px;border-radius:8px;border:1px solid rgba(255,255,255,.3);background:none;color:#fff;cursor:pointer;font:inherit', T.phone);
    ph.type = 'button'; ph.addEventListener('click', function () { openPhone(); });
    var cl = el('button', 'padding:4px 10px;border-radius:8px;border:1px solid rgba(255,255,255,.3);background:none;color:#fff;cursor:pointer;font:inherit', T.close);
    cl.type = 'button'; cl.addEventListener('click', function () { openPanel(false); });
    bar.appendChild(ph); bar.appendChild(cl);
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
        for (var i = 0; i < list.length; i++) input(list[i], 'screen');
      });
      view.addEventListener('profilechange', function (e) { if (relay && e.detail) relay.config('midi', { profile: e.detail.profile }); });
      dock.appendChild(view);
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
      view.addEventListener('ready', fit); view.addEventListener('profilechange', fit); g.addEventListener('resize', fit);
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
          onStatus: function (c) { if (c.status === 'open') c.config('midi', { profile: (view && view.profile) || O.profile }); },
          // the phone's MIDI tab sends `midi/virtual` = the raw bytes it played (it also sends midi/note/…, midi/cc/…
          // for shows — taking only the bytes means every press counts once)
          onSignal: function (name, value) { if (name === 'midi/virtual' && value && Array.isArray(value.data)) input(value.data, 'phone'); },
        });
        relay.connect();
      }, function (e) { if (g.console) console.warn('[oav-p5] relay client did not load', e); });
    }
    if (!doc) return room;
    if (card) { card.style.display = card.style.display === 'none' ? 'flex' : 'none'; return room; }
    card = el('div', 'position:fixed;inset:0;z-index:' + (Z + 1) + ';display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.55)');
    fence(card);
    var box = el('div', 'background:#fff;color:#111;border-radius:14px;padding:16px;max-width:300px;text-align:center;font:500 13px/1.45 system-ui,sans-serif');
    var link = phoneURL(room);
    var qr = el('div', 'margin:0 auto 10px;width:220px;height:220px;display:flex;align-items:center;justify-content:center;color:#888', '…');
    var a = el('a', 'word-break:break-all;color:#225;font-size:11px', link); a.href = link; a.target = '_blank'; a.rel = 'noopener';
    box.appendChild(qr); box.appendChild(el('div', 'margin-bottom:6px', T.scan)); box.appendChild(el('div', 'font:700 15px ui-monospace,monospace;margin-bottom:6px', T.room + ' ' + room)); box.appendChild(a);
    card.appendChild(box);
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
  // `midi` is the name a sketch reads; a sketch that already has its own `midi` keeps it (then use OAVp5 / oavMidi)
  var taken = false;
  try { taken = typeof g.midi !== 'undefined' && g.midi !== midi; } catch (e) { taken = true; }
  if (!taken) { try { /* a top-level `let midi` elsewhere would shadow this; then the warning below is the hint */ g.midi = midi; } catch (e) { taken = true; } }
  if (taken && g.console) console.warn('[oav-p5] this page already has a `midi` — read OAVp5.note / OAVp5.cc instead');
  g.oavMidi = midi;

  if (O.hardware === 'auto') connectHardware();
  if (doc) { if (doc.body) placeButton(); else doc.addEventListener('DOMContentLoaded', placeButton); }
})();
