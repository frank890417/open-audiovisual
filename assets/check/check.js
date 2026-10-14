// /check/ — the device check. Plain script, no dependencies.
//
// What runs at load: reading what the browser says about itself (user agent, isSecureContext, whether the Web MIDI,
// WebGL and WebGPU APIs exist, a throw-away canvas). Nothing else. In particular nothing is *requested* at load: no
// MIDI permission, no microphone, no camera, no connection to this computer. Each of those waits for the button of
// its own row. The MIDI button reads the names of the inputs and nothing more: it never touches the outputs.

(function () {
  'use strict';
  var S = JSON.parse(document.getElementById('chk-strings').textContent);
  var $ = function (id) { return document.getElementById(id); };
  var fill = function (s, o) { return String(s).replace(/\{(\w+)\}/g, function (m, k) { return k in o ? o[k] : m; }); };
  var rows = ['browser', 'secure', 'midi', 'mic', 'camera', 'graphics', 'local'];
  var report = {};

  function set(id, state, msg) {
    var li = $('chk-' + id);
    li.dataset.state = state;
    li.querySelector('.chk-badge').textContent = S.state[state];
    li.querySelector('.chk-msg').textContent = msg;
    report[id] = { state: state, msg: msg };
    summary();
  }
  function summary() {
    var n = { ok: 0, warn: 0, bad: 0, idle: 0 };
    rows.forEach(function (id) { n[$('chk-' + id).dataset.state]++; });
    $('chk-summary').textContent = fill(S.summary, n);
  }

  // ---------------------------------------------------------------- browser and system
  function whoami() {
    var ua = navigator.userAgent, m;
    var ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    var os = ios ? (/iPad/.test(ua) || /Macintosh/.test(ua) ? 'iPadOS' : 'iOS') : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'macOS' : /CrOS/.test(ua) ? 'ChromeOS' : /Linux/.test(ua) ? 'Linux' : '?';
    var name = '?', version = '';
    if ((m = /(?:Edg|EdgA|EdgiOS)\/(\d+)/.exec(ua))) { name = 'Edge'; version = m[1]; }
    else if ((m = /(?:OPR|Opera)\/(\d+)/.exec(ua))) { name = 'Opera'; version = m[1]; }
    else if ((m = /(?:Firefox|FxiOS)\/(\d+)/.exec(ua))) { name = 'Firefox'; version = m[1]; }
    else if ((m = /(?:Chrome|CriOS)\/(\d+)/.exec(ua))) { name = 'Chrome'; version = m[1]; }
    else if ((m = /Version\/(\d+)[\d.]*.*Safari/.exec(ua))) { name = 'Safari'; version = m[1]; }
    return { name: name, version: version, os: os, ios: ios, mobile: ios || /Mobi|Android/.test(ua) };
  }
  function checkBrowser() {
    var w = whoami(), J = S.browser;
    var head = fill(J.is, { name: w.name, version: w.version, os: w.os });
    var advice, state;
    if (w.ios) { advice = J.ios; state = 'warn'; }
    else if (w.mobile) { advice = J.mobile; state = 'warn'; }
    else if (w.name === 'Chrome' || w.name === 'Edge') { advice = J.chrome; state = 'ok'; }
    else if (w.name === 'Firefox') { advice = J.firefox; state = 'warn'; }
    else if (w.name === 'Safari') { advice = J.safari; state = 'warn'; }
    else { advice = J.other; state = 'warn'; }
    set('browser', state, head + ' ' + advice);
  }

  // ---------------------------------------------------------------- secure context
  function checkSecure() {
    var J = S.secure, h = location.hostname;
    var local = h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || /\.localhost$/.test(h);
    if (location.protocol === 'file:') return set('secure', 'warn', J.file);
    var where = location.protocol === 'https:' ? J.https : local ? J.localhost : location.protocol.replace(':', '') + '://' + h;
    set('secure', window.isSecureContext ? 'ok' : 'bad', fill(window.isSecureContext ? J.ok : J.bad, { where: where }));
  }

  // ---------------------------------------------------------------- Web MIDI: detected here, asked only by the button
  function checkMidi() {
    var has = typeof navigator.requestMIDIAccess === 'function';
    var btn = $('btn-midi');
    if (has) return set('midi', 'ok', S.midi.yes);
    btn.disabled = true;
    set('midi', 'warn', S.midi.no);
  }
  async function listMidi() {
    var J = S.midi, btn = $('btn-midi');
    btn.disabled = true;
    set('midi', 'idle', J.asking);
    var access;
    try { access = await navigator.requestMIDIAccess({ sysex: false }); }
    catch (e) {
      btn.disabled = false;
      var denied = e && (e.name === 'SecurityError' || e.name === 'NotAllowedError');
      return set('midi', 'warn', denied ? J.denied : fill(J.failed, { reason: (e && e.name) || 'error' }));
    }
    btn.disabled = false;
    var names = [];
    access.inputs.forEach(function (p) { names.push(p.name || p.id); });
    if (!names.length) return set('midi', 'warn', J.none);
    set('midi', 'ok', fill(J.list, { n: names.length, names: names.join(', ') }));
  }

  // ---------------------------------------------------------------- microphone / camera: asked only by their buttons
  function stopAll(stream) { stream.getTracks().forEach(function (t) { t.stop(); }); }
  function hasMedia() { return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia); }
  function noMedia(kind) { set(kind, 'bad', fill(S.media.none, { what: S.media[kind] })); }
  function mediaError(kind, e) {
    var J = S.media, what = J[kind];
    var n = e && e.name;
    if (n === 'NotAllowedError' || n === 'SecurityError' || n === 'PermissionDeniedError') return ['warn', fill(J.denied, { what: what })];
    if (n === 'NotFoundError' || n === 'OverconstrainedError') return ['warn', fill(J.missing, { what: what })];
    return ['bad', fill(J.busy, { what: what, reason: n || 'error' })];
  }
  async function testMic() {
    var J = S.media, btn = $('btn-mic'), meter = $('chk-meter');
    if (!hasMedia()) return noMedia('mic');
    btn.disabled = true;
    set('mic', 'idle', J.asking);
    var stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } }); }
    catch (e) { btn.disabled = false; var r = mediaError('mic', e); return set('mic', r[0], r[1]); }
    var label = (stream.getAudioTracks()[0] || {}).label || J.unnamed;
    var peak = 0, ctx = null;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      var an = ctx.createAnalyser(); an.fftSize = 1024;
      ctx.createMediaStreamSource(stream).connect(an);
      var buf = new Uint8Array(an.fftSize);
      meter.hidden = false;
      var t0 = performance.now();
      await new Promise(function (done) {
        (function tick() {
          an.getByteTimeDomainData(buf);
          var m = 0; for (var i = 0; i < buf.length; i++) m = Math.max(m, Math.abs(buf[i] - 128) / 128);
          peak = Math.max(peak, m);
          meter.firstElementChild.style.width = Math.min(100, Math.round(m * 140)) + '%';
          if (performance.now() - t0 < 3500) requestAnimationFrame(tick); else done();
        })();
      });
    } catch (e) { /* no analyser: the stream itself opened, which is the answer */ peak = -1; }
    stopAll(stream);
    if (ctx) ctx.close();
    meter.hidden = true;
    btn.disabled = false;
    if (peak === 0) set('mic', 'warn', J.micQuiet);
    else set('mic', 'ok', fill(J.micOk, { label: label, level: peak < 0 ? '–' : Math.round(peak * 100) }));
  }
  async function testCamera() {
    var J = S.media, btn = $('btn-camera'), video = $('chk-video');
    if (!hasMedia()) return noMedia('camera');
    btn.disabled = true;
    set('camera', 'idle', J.asking);
    var stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ video: true }); }
    catch (e) { btn.disabled = false; var r = mediaError('camera', e); return set('camera', r[0], r[1]); }
    var track = stream.getVideoTracks()[0] || {};
    var st = track.getSettings ? track.getSettings() : {};
    video.srcObject = stream; video.hidden = false;
    try { await video.play(); } catch (e) { /* autoplay refused: the track still opened */ }
    set('camera', 'ok', fill(J.camOk, { label: track.label || J.unnamed, size: (st.width || '?') + '×' + (st.height || '?') }));
    await new Promise(function (done) { setTimeout(done, 3500); });
    stopAll(stream);
    video.srcObject = null; video.hidden = true;
    btn.disabled = false;
  }

  // ---------------------------------------------------------------- graphics: a throw-away canvas, no permission involved
  async function checkGraphics() {
    var J = S.graphics, c = document.createElement('canvas'), gl2 = null, gl1 = null;
    try { gl2 = c.getContext('webgl2'); } catch (e) { /* none */ }
    if (!gl2) { try { gl1 = document.createElement('canvas').getContext('webgl'); } catch (e) { /* none */ } }
    var gpu = false;
    try { if (navigator.gpu) gpu = !!(await navigator.gpu.requestAdapter()); } catch (e) { /* none */ }
    var yn = function (b) { return b ? J.yes : J.no; };
    if (gl2) set('graphics', 'ok', fill(J.ok, { gl2: J.yes, gpu: yn(gpu) }));
    else if (gl1) set('graphics', 'warn', fill(J.weak, { gpu: yn(gpu) }));
    else set('graphics', 'bad', J.bad);
  }

  // ---------------------------------------------------------------- the bridges on this computer: only when asked
  async function testLocal() {
    var J = S.local, btn = $('btn-local');
    btn.disabled = true;
    set('local', 'idle', J.testing);
    var bridge = false, monitor = false;
    var results = await Promise.all([
      new Promise(function (resolve) {
        var ws = null;
        var timer = setTimeout(() => resolve(false), 2500);
        try { ws = new WebSocket('ws://127.0.0.1:7457'); } catch (e) { clearTimeout(timer); return resolve(false); }
        ws.addEventListener('open', () => { clearTimeout(timer); ws.close(); resolve(true); });
        ws.addEventListener('error', () => { clearTimeout(timer); resolve(false); });
      }),
      fetch('http://127.0.0.1:7456/health', { cache: 'no-store', signal: AbortSignal.timeout(2500) }).then(function (r) { return r.ok; }, function () { return false; }),
    ]);
    monitor = results[0]; bridge = results[1];
    btn.disabled = false;
    var lines = [fill(J.bridge, { r: bridge ? J.answered : J.silent }), fill(J.monitor, { r: monitor ? J.answered : J.silent })];
    var pub = location.protocol === 'https:' ? ' ' + J.publicPage : '';
    set('local', bridge || monitor ? 'ok' : 'warn', lines.join(' ') + ' ' + (bridge || monitor ? J.ok : J.none) + pub);
  }

  // ---------------------------------------------------------------- copy
  function text() {
    var out = [S.copy.head + ' · ' + new Date().toISOString().slice(0, 10) + ' · ' + location.href.split('#')[0]];
    rows.forEach(function (id) {
      var li = $('chk-' + id), r = report[id];
      out.push('[' + li.dataset.state.toUpperCase() + '] ' + id + ' · ' + li.querySelector('h2').textContent + ': ' + (r ? r.msg : li.querySelector('.chk-msg').textContent));
    });
    out.push(S.copy.ua + ': ' + navigator.userAgent);
    return out.join('\n');
  }
  async function copy() {
    var t = text(), note = $('copy-note'), area = $('chk-out');
    try { await navigator.clipboard.writeText(t); note.textContent = S.copy.copied; area.hidden = true; }
    catch (e) { area.value = t; area.hidden = false; area.select(); note.textContent = S.copy.copyFailed; }
  }

  // ---------------------------------------------------------------- wiring
  checkBrowser(); checkSecure(); checkMidi(); checkGraphics();
  if (!hasMedia()) { noMedia('mic'); noMedia('camera'); $('btn-mic').disabled = true; $('btn-camera').disabled = true; }
  summary();
  $('btn-midi').addEventListener('click', listMidi);
  $('btn-mic').addEventListener('click', testMic);
  $('btn-camera').addEventListener('click', testCamera);
  $('btn-local').addEventListener('click', testLocal);
  $('btn-copy').addEventListener('click', copy);
})();
